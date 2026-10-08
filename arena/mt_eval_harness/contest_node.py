"""contest_node — the ORGANIZER'S scoring node (`mt-eval node …`).

Self-hosted daemon an organizer (a shared task like AmericasNLP, a sovereign
org) runs on THEIR OWN machine. It is the only place the secret references
ever exist in plaintext — and only transiently, decrypted to scratch for the
seconds a scoring takes. Champollion infrastructure never sees them.

The loop per intake item (contest_intake table, migration 043 one-way
lifecycle — the DB trigger backstops every transition this daemon makes):

  received
    ├─ download bundle (private bucket, 044), verify the recorded digests
    ├─ RE-SCORE the dev hypotheses against the node's own public dev refs —
    │  the participant's local verdict was a preview; THIS score gates
    ├─ qualifier gate (qualifier_gate.py ↔ sealed-qualifier.mjs, threshold
    │  from the qualifiers row, migration 042)
    └─ → qualifier_checked (or → rejected, with the exact reason)
  authorization (per contests.authorization_model, plan D3 — ONE code path):
    open            → straight to scoring (public-refs contests only)
    blanket         → authorization_request created AND auto-authorized under
                      recorded policy; grant minted + claimed; every step in
                      the hash-chained audit log (040). → scoring
    per-submission  → authorization_request stays PENDING; → pending_authorization.
                      A custodian runs `mt-eval node approve <request>`; the
                      next poll mints + claims the grant. (deny → rejected.)
  scoring
    ├─ decrypt the sealed refs to scratch (champollion seal-corpus open) or
    │  read the plaintext refs path (blanket/open contests only)
    ├─ external_scoring.score_hypotheses → RunLog + TestReport
    ├─ assemble_run_card → publish AGGREGATES-ONLY (entries suppressed —
    │  founder decision 2026-07-07: per-entry rows on a small secret set are
    │  a slow reference oracle) with trust='verified' (the reference holder
    │  scored it) + the participant-claimed method label
    ├─ link into contest_submissions; wipe the decrypted refs
    └─ → scored → published

Every failure path lands in `rejected` WITH a reason (the 043 trigger refuses
a reasonless rejection), or is logged and retried next poll — no silent drops.

Config (~/.mt-eval/node.json — `mt-eval node init` writes a starter from
data/node-template.json):
{
  "node_id": "org-node-1",              // self-reported (honest: no attestation yet)
  "poll_seconds": 30,
  "scratch_dir": "~/.mt-eval/node-scratch",
  "output_dir": "~/.mt-eval/node-runs", // RunLogs/TestReports — contain secret
                                        // ref text; keep organizer-local
  "grant_ttl_seconds": 3600,
  // The language-card index this node scores WITH — a local directory holding
  // a card per language it evaluates. The node NEVER fetches card metadata
  // over the network (an outbound lookup would announce a sealed run), so a
  // node with no local index refuses at startup. Omit only when the machine
  // already resolves one (MT_EVAL_CARDS_DIR, or a monorepo checkout).
  "cards_dir": "~/in/bundle/artifacts/cards",
  "contests": {
    "<contest-id>": {
      // The PUBLIC qualifier corpus. Required on any node that EXECUTES:
      // every submitted method is re-run on it before the sealed run
      // (sandbox_runner.verify_qualifier_by_execution). Also the corpus the
      // retired hypotheses drain re-scores dev files against.
      "dev_corpus": "/path/to/eval-...-qualifier-vYYYY.json",
      // The gate's facts for the lanes no relay carries them on (node
      // stage-request, submit-method --offline). Both this AND dev_corpus,
      // or neither — load_node_config refuses half a gate:
      "qualifier": {"qualifier_id": "...", "corpus_card_id": "...",
                    "threshold": 35.0, "metric": "chrf_plus_plus",
                    "year": 2026},
      // threshold: on the chrF++ 0-100 qualifier scale (corpus chrF++ of the
      // dev outputs, scoring standard/1). A block still naming metric
      // "composite" is gated on chrF++ with its threshold read on that scale.
      // Retired hypotheses drain (organizer-internal legacy) — optional:
      "refs_artifact": "/path/to/...refs.sealed.json",   // sealed (default)
      "refs_privkey": "/path/to/threshold-....key.json",
      // OR (blanket/open only): "refs_plaintext": "/path/to/refs.json"
      "corpus_version": "v1",
      // THE contest lane: methods executed on the sealed set (sandbox_runner
      // / model_runner):
      "secret_set_id": "eval-...-secret-v1",
      "secret_artifact": "/path/to/...secret....sealed.json",
      // custody: how the T2 set is unsealed at run time.
      //   "single-key" (default): a secret_privkey file opens it (Wave-1
      //                 stand-in; a run WITHOUT a custodian quorum is allowed
      //                 and announced).
      //   "threshold-quorum": M-of-N custodian shares MUST be presented
      //                 (`run-method --share ...`); the privkey fallback is
      //                 REFUSED. secret_privkey must NOT be set.
      "custody": "single-key",
      "secret_privkey": "/path/to/threshold-....key.json",  // single-key only
      "sandbox": {"runtime": "docker", "gpus": false},  // Lane B (code methods)
      // Lane A (declarative models) architecture policy — permissive default;
      // a careful host may set "known" or a ["Arch1","Arch2"] allowlist:
      "declarative": {"architecture_policy": "permissive"}
    }
  },
  // Phase B airgap transport (airgap_transport.py — optional):
  "signing_key": "/path/to/score-sign-....key.json",   // AIRGAPPED node only
  "airgap": {"state_dir": "~/.mt-eval/airgap"},
  "relay": {"verify_key": "/path/to/score-sign-....pub.json",
            "airgap_node_id": "org-airgap-1"}          // CONNECTED relay only
}
"""

from __future__ import annotations

import json
import re
import subprocess
import tarfile
import time
import urllib.error
import urllib.request
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

from mt_eval_harness.contest_policy import DEFERRED_ROLES, RESULTS_VISIBILITY
from mt_eval_harness.contest_prep import find_champollion_cli
from mt_eval_harness.external_scoring import (
    HypothesesFormatError,
    build_claimed_method_card,
    score_hypotheses,
    sha256_file,
)
from mt_eval_harness.qualifier_gate import (
    is_eligible_for_sealed_run,
    qualifier_score_phrase,
    resolve_qualifier_metric,
)
from mt_eval_harness.queue_runner import compute_request_fingerprint
from mt_eval_harness.sovereign_service import (
    append_audit_event,
    rpc,
    service_key,
    service_request,
)

BUCKET = "contest-intake"
DEFAULT_CONFIG_PATH = Path.home() / ".mt-eval" / "node.json"
#: The starter config `mt-eval node init` writes. It ships IN the package: the
#: only template used to be this module's docstring and the rehearsal's
#: deploy/ files, neither of which a pip-installed organizer has, and neither
#: declared a live `qualifier` — so the node skipped the public gate
#: (synthetic organizer persona, 2026-10-03).
NODE_TEMPLATE_PATH = Path(__file__).resolve().parent / "data" / "node-template.json"


class NodeConfigError(RuntimeError):
    """Bad/missing node configuration — fail loud at startup, never mid-item."""


# An address-shaped identity. Not a validator (no attempt at RFC 5322) — a
# tripwire on the ONE shape that must never reach a world-readable byline.
_EMAIL_SHAPE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def display_identity_from_manifest(manifest: dict | None) -> str:
    """The submission's own public byline: the declared developer name, else
    the method name. Both are participant-authored, public-by-intent manifest
    fields (spec §2.1) — unlike the JWT email, which exists to bind RLS."""
    m = manifest or {}
    for candidate in (((m.get("developer") or {}).get("name")),
                      ((m.get("method") or {}).get("name")),
                      m.get("system_label")):   # legacy hypotheses manifest
        name = str(candidate or "").strip()
        if name:
            return assert_display_identity(name)
    raise NodeConfigError(
        "The submission manifest declares no developer.name, method.name or "
        "system_label — there is no public byline to publish this run under, "
        "and the JWT email must never be used as one.")


def assert_display_identity(submitter: str) -> str:
    """Refuse an email address where a public byline belongs."""
    value = str(submitter or "").strip()
    if not value:
        raise NodeConfigError(
            "A run card needs a submitter byline (display identity).")
    if _EMAIL_SHAPE.match(value):
        raise NodeConfigError(
            f"Refusing to publish run_cards.submitter={value!r}: that is an "
            f"email address, and the board's submitter column is "
            f"world-readable. Pass the manifest's developer/method name "
            f"(contest_node.display_identity_from_manifest).")
    return value


# ---------------------------------------------------------------------------
# Config.
# ---------------------------------------------------------------------------

_HEX64 = re.compile(r"^[0-9a-f]{64}$")


def _declared_file(cid: str, key: str, value, *, sha: str | None = None,
                   what: str) -> Path:
    """Resolve a file a node config declares, or refuse with the reason.

    A declared corpus that is not on disk, or whose bytes are not the bytes
    the organizer pinned, must stop the node at STARTUP. Discovering it
    mid-run means a request has already been authorized against a set the
    node cannot actually score.
    """
    fp = Path(str(value)).expanduser()
    if not fp.is_file():
        raise NodeConfigError(
            f"contests[{cid}] declares {what} {value!r} but that file does "
            f"not exist on this node. The node must hold every set it "
            f"promises to score before it accepts a single request.")
    if sha is None:
        return fp
    if not _HEX64.match(str(sha).strip().lower()):
        raise NodeConfigError(
            f"contests[{cid}] pins {what} with sha256 {sha!r} — a pin is 64 "
            f"hex characters or it is not a pin.")
    actual = sha256_file(fp)
    if actual != str(sha).strip().lower():
        raise NodeConfigError(
            f"contests[{cid}] pins {what} at sha256 {sha} but {fp} hashes to "
            f"{actual}. These are different bytes; the node refuses to score "
            f"a set that is not the one the organizer declared.")
    return fp


def _validate_test_suites(cid: str, entry: dict) -> list[dict]:
    """The third-party diagnostic suites this node holds for a contest.

    Node-side shape: ``{suite_id, corpus_path, corpus_sha256}`` — the id the
    contest froze, the local copy, and the pin that proves the local copy IS
    the published suite. All three are required: an unpinned local file is
    'some corpus', not the suite the organizer promised participants.
    """
    declared = entry.get("test_suites")
    if declared in (None, []):
        return []
    if not isinstance(declared, list):
        raise NodeConfigError(
            f"contests[{cid}].test_suites must be a list of "
            f"{{suite_id, corpus_path, corpus_sha256}} objects (got "
            f"{type(declared).__name__}).")
    resolved: list[dict] = []
    seen: set[str] = set()
    for i, suite in enumerate(declared):
        if not isinstance(suite, dict):
            raise NodeConfigError(
                f"contests[{cid}].test_suites[{i}] is not an object — each "
                f"suite declares suite_id, corpus_path and corpus_sha256.")
        missing = [k for k in ("suite_id", "corpus_path", "corpus_sha256")
                   if not suite.get(k)]
        if missing:
            raise NodeConfigError(
                f"contests[{cid}].test_suites[{i}] is missing {missing} — a "
                f"suite is an id, a local corpus file, and the sha256 that "
                f"pins it.")
        sid = str(suite["suite_id"])
        if sid in seen:
            raise NodeConfigError(
                f"contests[{cid}].test_suites declares {sid!r} twice.")
        seen.add(sid)
        fp = _declared_file(cid, "test_suites", suite["corpus_path"],
                            sha=suite["corpus_sha256"],
                            what=f"test suite {sid!r} corpus")
        resolved.append({"suite_id": sid, "corpus_path": str(fp),
                         "corpus_sha256": str(suite["corpus_sha256"]).lower()})
    return resolved


def _assert_suites_match_contest(cid: str, resolved: list[dict]) -> None:
    """When the node can reach the database, the suites it holds must be
    exactly the suites the contest FROZE (074's metadata.test_suites).

    Running a method on a suite the contest never declared, or silently
    skipping one it did, both break the same promise. Only the commands that
    read or write the contest database run it (``load_node_config(...,
    database=True)``) — they need the service key anyway, so a missing key
    fails here, once, with its own message. An offline command never reaches
    it: it used to run on EVERY config load, so each `--offline` node command
    printed the six-line "set the service key … or add --offline" text even
    with --offline given (synthetic researcher, Round 8). The offline scoring
    run announces instead that the suite ids were not compared
    (airgap_transport.run_imported) — never quietly passed.
    """
    if not resolved:
        return
    service_key()  # a database command needs it: fail loud, once
    try:
        rows = _fetch_rows("contests", {"id": f"eq.{cid}",
                                        "select": "metadata"})
    except Exception as exc:  # noqa: BLE001 — every transport failure is one case
        print(f"  ⚠ contests[{cid}]: could not read the contest's frozen "
              f"test_suites to compare against this node's copies "
              f"({type(exc).__name__}: {exc}). The suite ids were NOT "
              f"verified against the contest.")
        return
    if not rows:
        raise NodeConfigError(
            f"contests[{cid}] declares test suites but the contest is not "
            f"visible on this endpoint — the node cannot confirm it is "
            f"holding the suites the contest froze.")
    frozen = ((rows[0].get("metadata") or {}).get("test_suites") or [])
    frozen_ids = {str(s.get("suite_id")) for s in frozen if isinstance(s, dict)}
    local_ids = {s["suite_id"] for s in resolved}
    if frozen_ids != local_ids:
        raise NodeConfigError(
            f"contests[{cid}] test suites do not match the contest: the "
            f"contest froze {sorted(frozen_ids) or '[]'}, this node holds "
            f"{sorted(local_ids)}. Missing here: "
            f"{sorted(frozen_ids - local_ids) or '[]'}; not declared by the "
            f"contest: {sorted(local_ids - frozen_ids) or '[]'}. A reported "
            f"suite has to be one the contest promised.")
    by_id = {str(s.get("suite_id")): s for s in frozen if isinstance(s, dict)}
    for suite in resolved:
        pinned = str(by_id[suite["suite_id"]].get("sha256") or "").lower()
        if pinned and pinned != suite["corpus_sha256"]:
            raise NodeConfigError(
                f"contests[{cid}] test suite {suite['suite_id']!r} is pinned "
                f"at sha256 {pinned} by the contest, but this node's copy is "
                f"pinned at {suite['corpus_sha256']}.")


def _bind_card_index(cfg: dict, config_path: Path) -> None:
    """Bind this node to a LOCAL language-card index — never the network.

    `publish.assemble_run_card` names the run's language pair through the
    language-card SSOT, and with no local index that read goes out to the
    trading-card index over HTTP. On a node that is wrong in BOTH directions:
    air-gapped the fetch fails and the scoring dies (measured on the Lima
    guests, 2026-09-07), and CONNECTED it succeeds — which means the act of
    scoring a sealed contest announces to the index host that a sealed run is
    happening. That is a sovereignty leak, not a convenience.

    So the node lane never fetches card metadata. The index is a local
    directory the node carries, declared as top-level ``cards_dir`` in
    node.json (or MT_EVAL_CARDS_DIR, or found in a monorepo checkout), and a
    node that has none REFUSES here — at startup, with the missing
    configuration named — rather than reaching for the network mid-ceremony.
    A node must carry the cards for every language it scores.

    The refusal is deliberate and matches `language_cards`'s standing rule: a
    failed read is not an empty catalogue, so a node without cards stops
    instead of naming languages it cannot look up.
    """
    from mt_eval_harness.language_cards import require_local_cards
    from mt_eval_harness.language_cards_remote import LanguageCardsUnavailable

    try:
        bound = require_local_cards(cfg.get("cards_dir"),
                                    reason=f"node config {config_path}")
    except LanguageCardsUnavailable as exc:
        raise NodeConfigError(str(exc)) from exc
    cfg["cards_dir"] = str(bound)


def node_template_text() -> str:
    """The packaged starter node.json (see NODE_TEMPLATE_PATH)."""
    return NODE_TEMPLATE_PATH.read_text(encoding="utf-8")


def init_node_config(path: str | Path | None = None, *,
                     force: bool = False, text: str | None = None) -> Path:
    """Write the starter node.json (or ``text``, e.g. from
    :func:`node_config_from_contest`); never overwrite one without
    ``force``."""
    p = Path(path).expanduser() if path else DEFAULT_CONFIG_PATH
    if p.exists() and not force:
        raise NodeConfigError(
            f"{p} already exists — left untouched. Pass --force to replace "
            f"it, --config <other path> to write elsewhere, or --print to "
            f"see the template.")
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(node_template_text() if text is None else text,
                 encoding="utf-8")
    return p


def _resolve_prepared_manifest(where: str | Path) -> Path:
    """``contest prepare``'s organizer-local manifest, given it or its out dir."""
    p = Path(where).expanduser()
    if p.is_dir():
        for candidate in (p / "local" / "manifest.json", p / "manifest.json"):
            if candidate.is_file():
                return candidate
        raise NodeConfigError(
            f"--from-contest {where}: no local/manifest.json (or "
            f"manifest.json) in that directory — pass the --out directory "
            f"`mt-eval contest prepare` wrote, or its local/manifest.json.")
    if not p.is_file():
        raise NodeConfigError(f"--from-contest {where}: no such file or "
                              f"directory.")
    return p


def node_config_from_contest(where: str | Path, *,
                             contest_id: str | None = None
                             ) -> tuple[str, list[str]]:
    """The starter node.json with every value ``contest prepare`` recorded
    filled in from its organizer-local manifest. Returns ``(text, notes)``.

    Filled from manifest.json (the mapping the runbook documents):
    ``contest.language_pair`` → language_pair; ``secret.sealed_set_id`` /
    ``secret.corpus_sealed_artifact`` → secret_set_id / secret_artifact;
    ``holdout.*`` → holdout_set_id / holdout_corpus (both keys removed when
    there is no holdout); ``qualifier.{qualifier_id, corpus_card_id,
    threshold, metric, year}`` → qualifier; ``qualifier.corpus_file`` →
    dev_corpus; ``test_suites[].{suite_id, sha256}`` → test_suites, with
    ``test_suite_local_copies`` (the pin-checked copy prepare read) →
    each suite's corpus_path when that file is here with the pinned bytes;
    the sealing key scheme →
    custody; ``registration.prize_terms`` (recorded by `contest prepare` /
    `contest register`) → prize_terms_sha256, the acceptance hash, when the
    contest declares terms. Left as ``<…>`` because no manifest knows them: node_id,
    cards_dir, signing_key and — for a set sealed to a single keypair — the
    private key file. `node ledger verify` names each one still unfilled.

    The contest id is the manifest's (``contest_prep.contest_id_of``: the
    --slug given to `contest prepare`, or the name-derived id of a manifest
    written before that was recorded) — what entrants pass to `contest
    qualify` / `submit-method` — unless ``contest_id`` says otherwise. Nothing is guessed silently: every value
    not taken from the manifest, and every artifact not found on this
    machine, is in ``notes``.
    """
    import copy

    from mt_eval_harness.contest_prep import (
        contest_id_is_legacy,
        contest_id_of,
    )

    manifest_path = _resolve_prepared_manifest(where)
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise NodeConfigError(
            f"{manifest_path} is not readable JSON ({exc}).") from exc
    contest = manifest.get("contest") or {}
    secret = manifest.get("secret")
    q = manifest.get("qualifier") or {}
    if not isinstance(secret, dict) or not secret.get("sealed_set_id"):
        raise NodeConfigError(
            f"{manifest_path} has no sealed set (secret) — a node runs "
            f"methods against one. Prepare the contest with --secret-size.")
    for key in ("qualifier_id", "corpus_card_id", "threshold", "year",
                "corpus_file"):
        if q.get(key) in (None, ""):
            raise NodeConfigError(
                f"{manifest_path} qualifier block lacks {key!r} — it is not "
                f"a manifest `contest prepare` wrote (or it was edited).")
    if not contest.get("language_pair"):
        raise NodeConfigError(f"{manifest_path} names no contest."
                              f"language_pair.")

    notes: list[str] = []
    out_dir = manifest_path.parent.parent

    def artifact(value: str, what: str) -> str:
        """An absolute path to a file prepare wrote. Recorded paths are
        relative to wherever prepare ran; the file sits at
        <out>/<local|public>/<name>, so that is tried too."""
        p = Path(str(value)).expanduser()
        candidates = [p] if p.is_absolute() else [
            Path.cwd() / p, out_dir / p.parent.name / p.name,
            manifest_path.parent / p.name]
        for c in candidates:
            if c.is_file():
                return str(c.resolve())
        notes.append(f"{what}: {value!r} is not on this machine — set the "
                     f"path to where the file is on the scoring node.")
        return str(value)

    tpl = json.loads(node_template_text())
    (entry,) = tpl["contests"].values()
    entry = copy.deepcopy(entry)

    cid = (contest_id or "").strip() or contest_id_of(manifest)
    if not cid:
        raise NodeConfigError(f"{manifest_path} names no contest — pass "
                              f"--contest-id.")
    if not contest_id:
        if contest_id_is_legacy(manifest):
            notes.append(
                f"contest id {cid!r}: this manifest predates recording the "
                f"contest id, so it is the id registration derived from the "
                f"name {contest.get('name')!r} — entrants pass this same id "
                f"to `contest qualify` and `submit-method`. If the contest "
                f"was registered under another id, re-run with "
                f"--contest-id <it>.")
        else:
            notes.append(
                f"contest id {cid!r}: the --slug given to `contest prepare` "
                f"— the id entrants pass to `contest qualify` and "
                f"`submit-method`.")

    entry["language_pair"] = contest["language_pair"]
    entry["secret_set_id"] = secret["sealed_set_id"]
    entry["secret_artifact"] = artifact(secret["corpus_sealed_artifact"],
                                        "secret_artifact")
    m = re.search(r"-(v\d+)$", secret["sealed_set_id"])
    if m:
        entry["corpus_version"] = m.group(1)
    holdout = manifest.get("holdout")
    if isinstance(holdout, dict) and holdout.get("sealed_set_id"):
        entry["holdout_set_id"] = holdout["sealed_set_id"]
        entry["holdout_corpus"] = artifact(holdout["corpus_sealed_artifact"],
                                           "holdout_corpus")
    else:
        for key in ("holdout_set_id", "holdout_corpus", "_comment_holdout"):
            entry.pop(key, None)
    entry["dev_corpus"] = artifact(q["corpus_file"], "dev_corpus")
    entry["qualifier"] = {k: q[k] for k in ("qualifier_id", "corpus_card_id",
                                            "threshold", "metric", "year")
                          if k in q}
    block = secret.get("sealed_block") or {}
    scheme = str(block.get("keyScheme") or "")
    if scheme.startswith("shamir"):
        entry["custody"] = "threshold-quorum"
    else:
        entry["custody"] = "single-key"
        entry["secret_privkey"] = (
            f"<path to the private key matching the --threshold-pubkey the "
            f"set was sealed to (keyId {block.get('thresholdKeyId')}) — "
            f"`champollion seal-corpus keygen` wrote it>")
        notes.append(
            f"custody single-key: the sealed set's key scheme is "
            f"{scheme or 'unrecorded'!r}; fill secret_privkey with the "
            f"matching private key file (or re-seal under a custodian "
            f"ceremony and switch to threshold-quorum).")
    suites = manifest.get("test_suites") or []
    if suites:
        # The pin-checked copy `contest prepare` read (--test-suite ID=PATH,
        # or one it found on this machine) — the path, not a placeholder,
        # when the manifest records it and the file is here with the pinned
        # bytes (Round 9 researcher: the sha was filled, the path was not).
        copies = manifest.get("test_suite_local_copies") or {}
        entry["test_suites"] = []
        unfilled = []
        for s in suites:
            sid = s["suite_id"]
            path = copies.get(sid)
            if path and Path(path).is_file():
                if sha256_file(path) == s["sha256"]:
                    corpus_path = str(Path(path).resolve())
                else:
                    corpus_path = None
                    notes.append(
                        f"test_suites {sid}: {path} (the copy prepare read) "
                        f"no longer hashes to the pinned {s['sha256'][:12]}… "
                        f"— point corpus_path at a copy with the pinned "
                        f"bytes.")
            else:
                corpus_path = None
                if path:
                    notes.append(f"test_suites {sid}: {path} (the copy "
                                 f"prepare read) is not on this machine — "
                                 f"set corpus_path to where it is on the "
                                 f"scoring node.")
            if corpus_path is None:
                unfilled.append(sid)
                corpus_path = (f"<path to your local copy of {sid} "
                               f"({s.get('url')})>")
            entry["test_suites"].append({"suite_id": sid,
                                         "corpus_path": corpus_path,
                                         "corpus_sha256": s["sha256"]})
        if unfilled:
            notes.append(
                f"test_suites: point corpus_path at your local copy of "
                f"{', '.join(unfilled)} (its sha256 is pinned: the node "
                f"refuses other bytes)"
                + ("" if copies else
                   " — `contest prepare --test-suite ID=PATH` records the "
                   "path, so `node init --from-contest` can fill it")
                + ".")
    # The contest's declared prize terms, by hash: what entrants pass to
    # --accept-terms and what an air-gapped node checks every bundle's
    # acceptance against. `contest prepare` / `contest register` record the
    # terms in the manifest's registration block; the hash is computed by the
    # one function every other side uses (contest_prize_terms.terms_sha256).
    registration = manifest.get("registration")
    if isinstance(registration, dict) and "prize_terms" in registration:
        terms = registration.get("prize_terms")
        if terms:
            from mt_eval_harness.contest_prize_terms import terms_sha256
            entry["prize_terms_sha256"] = terms_sha256(terms)
            notes.append(
                f"prize_terms_sha256: {entry['prize_terms_sha256']} — from "
                f"the prize terms the manifest records (disposition "
                f"{terms.get('disposition')!r}); entrants pass the same hash "
                f"to --accept-terms. If the terms were changed on the "
                f"contest after this manifest was written (e.g. `contest "
                f"create`), use the contest's current hash.")
        else:
            notes.append(
                "prize terms: the manifest records none — a contest with no "
                "prize, so node.json carries no prize_terms_sha256. If terms "
                "were declared on the contest some other way, add "
                "contests[<id>].prize_terms_sha256 (the hash entrants pass "
                "to --accept-terms).")
    else:
        notes.append(
            "prize terms: this manifest predates recording them (no "
            "registration block). If the contest declares any, add "
            "contests[<id>].prize_terms_sha256 — the hash entrants pass to "
            "--accept-terms.")
    tpl["contests"] = {cid: entry}
    tpl["_comment"] = (
        f"Filled from {manifest_path} by `mt-eval node init --from-contest`. "
        f"Still to fill: every remaining <...> value (node_id, cards_dir, "
        f"signing_key, and any key file). " + tpl.get("_comment", ""))
    return json.dumps(tpl, ensure_ascii=False, indent=2) + "\n", notes


def _first_placeholder(node, path: str = "") -> tuple[str, str] | None:
    """The first ``"<…>"`` template placeholder in a node config, as
    ``(key path, value)``; None when every value is filled in. Keys starting
    with ``_`` are notes and are skipped."""
    if isinstance(node, dict):
        for k, v in node.items():
            if str(k).startswith("_"):
                continue
            hit = _first_placeholder(v, f"{path}.{k}" if path else str(k))
            if hit:
                return hit
    elif isinstance(node, list):
        for i, v in enumerate(node):
            hit = _first_placeholder(v, f"{path}[{i}]")
            if hit:
                return hit
    elif isinstance(node, str):
        # Every template placeholder opens with "<" (some go on, e.g.
        # "<source>><target>, e.g. eng>crk"); no real id, path or pair does.
        if node.strip().startswith("<"):
            return path, node
    return None


#: The files a node config can declare, per contest and at the top level.
#: `ledger verify` checks each DECLARED one is on this machine — a relay that
#: legitimately holds no sealed artifact simply does not declare one.
_CONTEST_FILE_KEYS = ("secret_artifact", "secret_privkey", "dev_corpus",
                      "holdout_corpus", "refs_artifact", "refs_privkey",
                      "refs_plaintext")
_TOP_FILE_KEYS = ("signing_key",)


def check_node_config(cfg: dict) -> list[str]:
    """What `mt-eval node ledger verify` checks beyond loading the config.

    ``cfg`` is a config :func:`load_node_config` already accepted (shape,
    custody, the qualifier gate, the holdout pair, prize-terms hash, suites,
    no leftover placeholder, a local card index). This adds the one thing a
    load does not check because a relay legitimately lacks it: every file the
    config DECLARES must be on this machine. Returns the human summary lines
    of what was checked; raises NodeConfigError naming the first declared
    file that is missing.
    """
    from mt_eval_harness.qualifier_gate import threshold_phrase

    def must_exist(where: str, value) -> str:
        fp = Path(str(value)).expanduser()
        if not fp.is_file():
            raise NodeConfigError(
                f"{where} is {value!r}, but no file is there on this machine. "
                f"Fix the path (manifest.json from `contest prepare` lists "
                f"each artifact), or delete the key if this node does not "
                f"hold that file.")
        return str(fp)

    lines = [f"node_id {cfg['node_id']}"
             + (f", cards_dir {cfg['cards_dir']}" if cfg.get("cards_dir")
                else "")]
    for key in _TOP_FILE_KEYS:
        if cfg.get(key):
            lines.append(f"{key}: {must_exist(key, cfg[key])} (present)")
    for cid, c in (cfg.get("contests") or {}).items():
        parts = []
        if c.get("secret_set_id"):
            parts.append(f"sealed set {c['secret_set_id']} "
                         f"(custody {c.get('custody', 'single-key')})")
        if c.get("holdout_set_id"):
            parts.append(f"sealed holdout {c['holdout_set_id']}")
        q = c.get("qualifier")
        if isinstance(q, dict):
            parts.append(f"qualifier {q.get('qualifier_id')} at "
                         f"{threshold_phrase(q.get('threshold'))}")
        lines.append(f"contest {cid}: " + ("; ".join(parts) or "declared"))
        for key in _CONTEST_FILE_KEYS:
            if c.get(key):
                lines.append(f"  {key}: "
                             f"{must_exist(f'contests[{cid}].{key}', c[key])}"
                             f" (present)")
    return lines


def _check_declared_qualifier(cid: str, c: dict) -> None:
    """A node-declared qualifier gate is whole and filled in, or refused."""
    q = c.get("qualifier")
    where = f"contests[{cid}].qualifier"
    if not isinstance(q, dict):
        raise NodeConfigError(f"{where} must be an object — the qualifier "
                              f"block from `contest prepare`'s manifest.json.")
    for key in ("qualifier_id", "corpus_card_id"):
        val = q.get(key)
        if not isinstance(val, str) or not val.strip() or val.startswith("<"):
            raise NodeConfigError(
                f"{where}.{key} is {val!r} — fill it in from manifest.json "
                f"(qualifier.{key}).")
    threshold = q.get("threshold")
    if isinstance(threshold, bool) or not isinstance(threshold, (int, float)) \
            or threshold <= 0:
        raise NodeConfigError(
            f"{where}.threshold is {threshold!r} — set it to the contest's "
            f"qualifier threshold (manifest.json: qualifier.threshold).")
    year = q.get("year")
    if isinstance(year, bool) or not isinstance(year, int):
        raise NodeConfigError(
            f"{where}.year is {year!r} — set it to the qualifier vintage "
            f"year (manifest.json: qualifier.year).")
    # The qualifier gates on corpus chrF++ (scoring standard/1). A block
    # naming the retired composite is accepted (gated on chrF++, said where
    # it gates); any other metric is refused at startup.
    from mt_eval_harness.qualifier_gate import resolve_qualifier_metric
    try:
        resolve_qualifier_metric(q.get("metric"), threshold)
    except ValueError as exc:
        raise NodeConfigError(f"{where}.metric: {exc}") from exc
    dev = c.get("dev_corpus")
    if not isinstance(dev, str) or not dev.strip() or dev.startswith("<"):
        raise NodeConfigError(
            f"contests[{cid}] declares a qualifier but dev_corpus is "
            f"{dev!r} — the gate re-runs each method on that PUBLIC dev set "
            f"(manifest.json: qualifier.corpus_file). Declare both, or "
            f"neither; half a gate is not a gate.")


def load_node_config(path: str | Path | None = None, *,
                     database: bool = False) -> dict:
    """Read and check node.json.

    ``database``: the caller reads or writes the contest database with the
    service-role key (serve, list, approve, deny, connected run-method). Only
    then are the node's test suites compared with the suites the contest
    froze — the one check here that needs the database. Every offline
    command (the air-gapped lane, ledger, manifest, verdicts) loads the
    config without it, so it never touches the key or prints the key's
    message.
    """
    p = Path(path) if path else DEFAULT_CONFIG_PATH
    if not p.exists():
        raise NodeConfigError(
            f"Node config not found: {p}. Write a starter config with "
            f"`mt-eval node init` (it goes to {DEFAULT_CONFIG_PATH} unless "
            f"you pass --config), fill in its <...> values, then re-run — "
            f"champollion.dev/docs/network/sovereignty/sovereign-eval-node.")
    cfg = json.loads(p.read_text(encoding="utf-8"))
    if not cfg.get("node_id"):
        raise NodeConfigError("node.json needs a node_id (self-reported node "
                              "identity bound into request fingerprints).")
    contests = cfg.get("contests")
    if not isinstance(contests, dict) or not contests:
        raise NodeConfigError("node.json needs a non-empty 'contests' map.")
    for cid, c in contests.items():
        # A contest entry serves the METHOD lane (secret_*) — the only entry
        # path since R2 — and/or the retired hypotheses drain (refs_*). An
        # entry serving neither is a misconfiguration, loudly.
        #
        # dev_corpus is NOT tied to the hypotheses lane any more: it is the
        # public qualifier corpus this node re-executes every submitted method
        # on before the sealed run (sandbox_runner.verify_qualifier_by_
        # execution). A method-lane-only entry therefore carries dev_corpus
        # with no refs_* at all, which the old T1 coupling rejected outright.
        # It is required at EXECUTION time, not here, because a connected
        # relay that only moves files legitimately holds neither corpus.
        serves_intake = bool(c.get("refs_artifact") or c.get("refs_plaintext"))
        serves_method = bool(c.get("secret_set_id") or c.get("secret_artifact")
                             or c.get("secret_privkey"))
        if not serves_intake and not serves_method:
            raise NodeConfigError(
                f"contests[{cid}] serves neither lane — give it secret_set_id "
                f"+ secret_artifact + secret_privkey (the method lane, plus "
                f"dev_corpus for the qualifier re-execution) and/or refs_* "
                f"(the retired hypotheses drain).")
        if serves_intake:
            if not c.get("dev_corpus"):
                raise NodeConfigError(f"contests[{cid}] needs dev_corpus (the "
                                      f"public qualifier corpus file).")
            sealed = bool(c.get("refs_artifact"))
            plain = bool(c.get("refs_plaintext"))
            if sealed == plain:  # neither, or confusingly both
                raise NodeConfigError(
                    f"contests[{cid}] needs EXACTLY ONE of refs_artifact "
                    f"(+refs_privkey) or refs_plaintext.")
            if sealed and not c.get("refs_privkey"):
                raise NodeConfigError(
                    f"contests[{cid}] has refs_artifact but no refs_privkey — "
                    f"the node cannot decrypt at scoring time.")
        if serves_method:
            if not c.get("secret_set_id"):
                raise NodeConfigError(
                    f"contests[{cid}] has T2 secret_* entries but no "
                    f"secret_set_id (the sealed_sets id the requests target).")
            # secret_artifact/secret_privkey are EXECUTION-side needs: the
            # scoring machine must have them (run-method checks before any
            # grant is claimed); a connected RELAY serving the same contest
            # legitimately has neither — it only moves files and rows.
            custody = c.get("custody", "single-key")
            if custody not in ("single-key", "threshold-quorum"):
                raise NodeConfigError(
                    f"contests[{cid}] custody must be 'single-key' or "
                    f"'threshold-quorum' (got {custody!r}).")
            if custody == "threshold-quorum" and c.get("secret_privkey"):
                # The whole point of threshold custody: no standing key file
                # that could open the set without a quorum. A configured
                # secret_privkey would be exactly that bypass — refuse it.
                # (A relay that only moves files legitimately has neither
                # privkey nor artifact; run_imported enforces the artifact
                # requirement execution-side.)
                raise NodeConfigError(
                    f"contests[{cid}] declares custody 'threshold-quorum' but "
                    f"also configures secret_privkey — that key file is a "
                    f"single-party bypass of the quorum. Remove it; the set "
                    f"opens ONLY by presenting M-of-N custodian shares to "
                    f"`run-method --share`.")

        # --- the public qualifier gate, when declared HERE -----------------
        # The DB-less lanes take the gate from node.json (airgap_transport.
        # run_imported). A half-declared or placeholder gate used to be
        # skipped there at run time with only a warning — "the public gate was
        # NOT re-executed" (synthetic organizer persona, 2026-10-03: the
        # template they copied had no live `qualifier`). Shape-check it at
        # startup instead, so a wrong gate stops the node before any request.
        if "qualifier" in c:
            _check_declared_qualifier(cid, c)

        # --- the SECOND sealed split (contract D1) --------------------------
        # `holdout_corpus` is the holdout set's artifact on THIS node (the
        # sealed artifact under threshold custody, or the corpus file for a
        # plaintext deployment). It is executed inside the same authorized run
        # as the secret set, so a node that advertises a holdout must hold it
        # at startup — not discover it missing after a custody ceremony.
        if c.get("holdout_corpus") or c.get("holdout_set_id"):
            if not serves_method:
                raise NodeConfigError(
                    f"contests[{cid}] declares a holdout but serves no method "
                    f"lane — the holdout is the SECOND set of the secret "
                    f"set's run, and there is no run without secret_set_id.")
            if not c.get("holdout_set_id"):
                raise NodeConfigError(
                    f"contests[{cid}] has holdout_corpus but no "
                    f"holdout_set_id (the sealed_sets id the scores are "
                    f"labeled with — contests.metadata.sealed_holdout_set_id).")
            if not c.get("holdout_corpus"):
                raise NodeConfigError(
                    f"contests[{cid}] names holdout_set_id "
                    f"{c['holdout_set_id']!r} but no holdout_corpus — the "
                    f"node cannot score a set it does not hold.")
            if c["holdout_set_id"] == c.get("secret_set_id"):
                raise NodeConfigError(
                    f"contests[{cid}] points holdout_set_id at the secret set "
                    f"{c['secret_set_id']!r} — the holdout is a SECOND, "
                    f"disjoint split; scoring the same set twice and calling "
                    f"one of them held out is not a holdout.")
            c["holdout_corpus"] = str(_declared_file(
                cid, "holdout_corpus", c["holdout_corpus"],
                sha=c.get("holdout_corpus_sha256"),
                what="holdout corpus"))

        # --- the contest's DECLARED prize terms, by hash (P2/R1-trinary) ----
        # An air-gapped scoring node cannot read contests.metadata, so the
        # organizer carries the frozen terms hash across the gap in node.json.
        # With it, the node BLOCKS a bundle that accepted different terms (or
        # none) exactly as the connected node does; without it, the acceptance
        # is only ever a labelled WARN. Shape-checked here so a truncated or
        # pasted-wrong value fails at startup, not mid-ceremony.
        terms_sha = c.get("prize_terms_sha256")
        if terms_sha is not None:
            if (not isinstance(terms_sha, str)
                    or not re.fullmatch(r"[0-9a-f]{64}", terms_sha.strip())):
                raise NodeConfigError(
                    f"contests[{cid}].prize_terms_sha256 must be the contest's "
                    f"declared prize-terms digest — 64 lowercase hex "
                    f"characters (contest_prize_terms.terms_sha256, the same "
                    f"hash entrants pass to --accept-terms). Got "
                    f"{terms_sha!r}. Remove the key on a contest with no "
                    f"prize; a wrong hash would refuse every honest entry.")
            c["prize_terms_sha256"] = terms_sha.strip()

        # --- third-party diagnostic suites (practice 14) --------------------
        suites = _validate_test_suites(cid, c)
        if suites:
            c["test_suites"] = suites
            if database:
                _assert_suites_match_contest(cid, suites)

    # --- no template placeholder survives ---------------------------------
    # `node init` writes "<…>" placeholders; a value still in that shape was
    # never filled in. Checked after the structured checks above (which name
    # the gate and holdout values in their own words) and before the card
    # index, so every leftover — node_id, secret_artifact, signing_key,
    # cards_dir — is named rather than passed through to fail mid-run.
    leftover = _first_placeholder(cfg)
    if leftover:
        key, value = leftover
        raise NodeConfigError(
            f"{key} is still the template placeholder {value!r} — fill it in "
            f"(the contest's values are in `contest prepare`'s "
            f"<out>/local/manifest.json, which `mt-eval node init "
            f"--from-contest <out>` copies in for you), or delete the key if "
            f"this node does not use it.")

    # --- the language-card index this node scores WITH ---------------------
    _bind_card_index(cfg, p)

    cfg.setdefault("poll_seconds", 30)
    cfg.setdefault("grant_ttl_seconds", 3600)
    cfg.setdefault("scratch_dir", str(Path.home() / ".mt-eval" / "node-scratch"))
    cfg.setdefault("output_dir", str(Path.home() / ".mt-eval" / "node-runs"))
    return cfg


# ---------------------------------------------------------------------------
# Storage + bundle handling (service side).
# ---------------------------------------------------------------------------

def _storage_download(object_path: str) -> bytes:
    from mt_eval_harness.auth import SUPABASE_URL
    key = service_key()
    url = f"{SUPABASE_URL}/storage/v1/object/{BUCKET}/{object_path}"
    req = urllib.request.Request(url, headers={
        "apikey": key, "Authorization": f"Bearer {key}"})
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            return resp.read()
    except urllib.error.HTTPError as e:
        detail = e.read().decode() if e.fp else ""
        raise RuntimeError(f"Bundle download failed ({e.code}): {detail}") from e


def extract_bundle(bundle_bytes: bytes, dest: Path) -> dict:
    """Safely extract a submission bundle; return its manifest.

    Guards against path traversal (absolute names / ..) — participant-supplied
    archives are untrusted input.
    """
    dest.mkdir(parents=True, exist_ok=True)
    import io
    with tarfile.open(fileobj=io.BytesIO(bundle_bytes), mode="r:gz") as tar:
        for member in tar.getmembers():
            name = Path(member.name)
            if name.is_absolute() or ".." in name.parts or not member.isfile():
                raise HypothesesFormatError(
                    f"Bundle member {member.name!r} is not a plain relative "
                    f"file — refusing to extract.")
        tar.extractall(dest, filter="data")
    manifest_path = dest / "manifest.json"
    if not manifest_path.exists():
        raise HypothesesFormatError("Bundle has no manifest.json.")
    return json.loads(manifest_path.read_text(encoding="utf-8"))


def _find_hyp_file(dest: Path, stem: str) -> Path:
    matches = sorted(dest.glob(f"{stem}.*"))
    if not matches:
        raise HypothesesFormatError(f"Bundle has no {stem}.* file.")
    return matches[0]


# ---------------------------------------------------------------------------
# Row helpers.
# ---------------------------------------------------------------------------

def _advance(intake_id: str, patch: dict) -> None:
    service_request("PATCH", "contest_intake",
                    params={"intake_id": f"eq.{intake_id}"}, data=patch)


def _reject(intake_id: str, reason: str) -> None:
    print(f"    ✗ {intake_id}: {reason}")
    _advance(intake_id, {"status": "rejected", "reject_reason": reason})


def _fetch_rows(path: str, params: dict) -> list[dict]:
    rows = service_request("GET", path, params=params)
    return rows if isinstance(rows, list) else []


# ---------------------------------------------------------------------------
# Authorization (plan D3 — one path for all three models).
# ---------------------------------------------------------------------------

def _fingerprint_for(item: dict, contest_cfg: dict, sealed_set_id: str,
                     node_id: str) -> str:
    # In the hypotheses lane the "method" IS the submitted bundle's test file:
    # method_sha := test_hyp_sha256. The Phase-B method lane binds a real
    # method tarball sha here instead.
    return compute_request_fingerprint({
        "method_sha": item["test_hyp_sha256"],
        "corpus_id": sealed_set_id,
        "corpus_version": contest_cfg.get("corpus_version", "v1"),
    }, node_measurement=node_id)


def create_authorization_request(item: dict, contest_cfg: dict,
                                 sealed_set_id: str, node_id: str) -> str:
    request_id = f"authreq-{uuid.uuid4().hex}"
    fingerprint = _fingerprint_for(item, contest_cfg, sealed_set_id, node_id)
    service_request("POST", "authorization_requests", data={
        "request_id": request_id,
        "sealed_set_id": sealed_set_id,
        "state": "pending",
        "fingerprint": fingerprint,
        "method_sha": item["test_hyp_sha256"],
        "corpus_id": sealed_set_id,
        "corpus_version": contest_cfg.get("corpus_version", "v1"),
        "node_measurement": node_id,
        "requested_by": item["submitted_by"],
    })
    append_audit_event(
        "request_created", sealed_set_id=sealed_set_id, request_id=request_id,
        actor=item["submitted_by"], fingerprint=fingerprint,
        detail={"intake_id": item["intake_id"], "lane": "hypotheses"})
    return request_id


def authorize_request(request_id: str, *, actor: str, policy: str,
                      sealed_set_id: Optional[str] = None) -> None:
    """Transition a pending request to authorized (custodian act, or recorded
    blanket policy) + the audit events."""
    service_request("PATCH", "authorization_requests",
                    params={"request_id": f"eq.{request_id}"},
                    data={"state": "authorized",
                          "decided_at": datetime.now(timezone.utc).isoformat()})
    append_audit_event("request_authorized", request_id=request_id,
                       sealed_set_id=sealed_set_id, actor=actor,
                       detail={"policy": policy})


def deny_request(request_id: str, *, actor: str, reason: str,
                 sealed_set_id: Optional[str] = None) -> None:
    service_request("PATCH", "authorization_requests",
                    params={"request_id": f"eq.{request_id}"},
                    data={"state": "denied",
                          "decided_at": datetime.now(timezone.utc).isoformat()})
    append_audit_event("request_denied", request_id=request_id,
                       sealed_set_id=sealed_set_id, actor=actor,
                       detail={"reason": reason})


def mint_and_claim_grant(request_id: str, fingerprint: str,
                         sealed_set_id: str, *, node_id: str,
                         ttl_seconds: int,
                         used_detail: Optional[dict] = None) -> str:
    """Mint the single-use grant for an AUTHORIZED request and consume it for
    THIS scoring. The 039 bind trigger enforces request-authorized +
    fingerprint match; claim_auth_grant() consumes atomically.

    ``used_detail`` extends the grant_used audit detail (content-free ids/
    digests only) — the airgap relay records transport evidence there."""
    grant_id = f"grant-{uuid.uuid4().hex}"
    expires = datetime.now(timezone.utc) + timedelta(seconds=ttl_seconds)
    service_request("POST", "auth_grants", data={
        "grant_id": grant_id,
        "request_id": request_id,
        "sealed_set_id": sealed_set_id,
        "fingerprint": fingerprint,
        "expires_at": expires.isoformat(),
    })
    append_audit_event("grant_minted", request_id=request_id,
                       grant_id=grant_id, sealed_set_id=sealed_set_id,
                       fingerprint=fingerprint,
                       detail={"expires_at": expires.isoformat()})
    claimed = rpc("claim_auth_grant", {
        "p_grant_id": grant_id, "p_fingerprint": fingerprint,
        "p_node": node_id})
    if not claimed:
        raise RuntimeError(
            f"claim_auth_grant returned no row for {grant_id} — the grant "
            f"was expired, already used, or fingerprint-mismatched. Not "
            f"scoring.")
    append_audit_event("grant_used", request_id=request_id, grant_id=grant_id,
                       sealed_set_id=sealed_set_id, fingerprint=fingerprint,
                       detail={"node": node_id, **(used_detail or {})})
    return grant_id


# ---------------------------------------------------------------------------
# Refs resolution — decrypt-to-scratch (sealed) or plaintext path.
# ---------------------------------------------------------------------------

def resolve_refs_corpus(contest_cfg: dict, scratch: Path) -> tuple[Path, bool]:
    """Return (refs_corpus_path, is_scratch_copy). Sealed refs are decrypted
    via `champollion seal-corpus open` into scratch (wiped by the caller)."""
    if contest_cfg.get("refs_plaintext"):
        p = Path(contest_cfg["refs_plaintext"]).expanduser()
        if not p.exists():
            raise NodeConfigError(f"refs_plaintext not found: {p}")
        return p, False

    artifact = Path(contest_cfg["refs_artifact"]).expanduser()
    privkey = Path(contest_cfg["refs_privkey"]).expanduser()
    return _open_sealed_to_scratch(artifact, privkey, scratch), True


def _open_sealed_to_scratch(artifact: Path, privkey: Path,
                            scratch: Path) -> Path:
    """Decrypt one sealed artifact into scratch via `seal-corpus open`
    (crypto single-sourced in cli/lib/seal.mjs — never reimplemented here)."""
    out = scratch / f"refs-{uuid.uuid4().hex}.json"
    argv = find_champollion_cli() + [
        "seal-corpus", "open",
        "--artifact", str(artifact),
        "--privkey", str(privkey),
        "--out", str(out),
    ]
    proc = subprocess.run(argv, capture_output=True, text=True, timeout=120)
    if proc.returncode != 0 or not out.exists():
        raise RuntimeError(
            f"Could not decrypt sealed artifact {artifact}:\n"
            f"{proc.stderr or proc.stdout}")
    return out


def resolve_secret_corpus(contest_cfg: dict, scratch: Path) -> Path:
    """Decrypt the T2 FULLY-SECRET corpus (source AND refs) to scratch.

    Phase-B method lane only. Unlike the T1 refs there is NO plaintext
    escape hatch: a T2 set's whole point is that even the source is sealed
    (contest_prep enforces the same at split time)."""
    artifact = Path(contest_cfg["secret_artifact"]).expanduser()
    privkey = Path(contest_cfg["secret_privkey"]).expanduser()
    if not artifact.exists():
        raise NodeConfigError(f"secret_artifact not found: {artifact}")
    if not privkey.exists():
        raise NodeConfigError(f"secret_privkey not found: {privkey}")
    return _open_sealed_to_scratch(artifact, privkey, scratch)


def wipe_scratch_file(path: Path) -> None:
    """Best-effort overwrite-then-delete of transient plaintext.

    A file the SANDBOX wrote belongs to root (the container's uid 0), so the
    overwrite pass fails EACCES even though the node owns the directory and
    may perfectly well unlink it. Deleting it is the part that matters —
    without the fallback the run scratch survived every teardown, which on a
    real node is where the decrypted corpus workspace lives (measured
    2026-09-07 in the air-gap guest). The weaker outcome is SAID, never
    silently accepted.
    """
    if not path.exists():
        return
    overwritten = True
    try:
        size = path.stat().st_size
        with open(path, "r+b") as fh:
            fh.write(b"\0" * size)
    except OSError as exc:
        overwritten = False
        print(f"    ⚠ could not overwrite {path} before deleting it ({exc}) — "
              f"container-written files are owned by root; deleting without "
              f"the overwrite pass.")
    try:
        path.unlink()
    except OSError as exc:
        print(f"    ⚠ could not wipe {path}: {exc}")
        return
    if not overwritten:
        print(f"    · {path.name} deleted (unlink only, not overwritten).")


# Backwards-compatible internal alias (pre-Phase-B name).
_wipe = wipe_scratch_file


# ---------------------------------------------------------------------------
# Publish (service-role; aggregates-only; trust='verified').
# ---------------------------------------------------------------------------

def publish_scored_run(report_path: str | Path, *, submitter: str,
                       node_id: str, affirmation: str | None = None) -> str:
    """Publish a node-scored run: aggregates-only, trust='verified'.

    ``submitter`` is a DISPLAY identity — the developer/method name off the
    submission's own manifest, never the JWT email the request row binds to.
    ``run_cards.submitter`` is world-readable (it is the board's byline), and
    the node lane used to write participants' email addresses straight into
    it, which the ordinary `mt-eval publish` path never does
    (auth.get_submitter_name is display-only by contract). An email-shaped
    value is refused here rather than silently published.

    The default affirmation is the Phase-A hypotheses-lane text; the Phase-B
    method lane (sandbox_runner.run_method_request) passes its
    execution-verified wording. Same path either way — §9 scores-only egress
    has exactly one implementation."""
    row, card_id = build_scored_run_row(
        report_path, submitter=submitter, node_id=node_id,
        affirmation=affirmation)
    service_request(
        "POST", "run_cards", data=row,
        prefer="return=representation,resolution=ignore-duplicates")
    # Aggregates-only BY CONSTRUCTION: run_card_entries is never written in
    # this path (no per-entry metric rows, no text — the anti-oracle posture).
    return card_id


def build_scored_run_row(report_path: str | Path, *, submitter: str,
                         node_id: str,
                         affirmation: str | None = None) -> tuple[dict, str]:
    """Assemble the ``run_cards`` row a node-scored report would publish.

    The row-building half of :func:`publish_scored_run`, split out so a
    publication policy can decide WHETHER to insert it (contract C5,
    :func:`publish_or_defer`) without duplicating the assembly. Same
    display-identity refusal, same corpus-integrity warnings, same
    validation — a row this function returns is a row the database will
    accept, or it raised.

    Returns ``(row, card_id)``."""
    assert_display_identity(submitter)
    from mt_eval_harness.publish import (
        assemble_run_card,
        build_run_card_row,
        validate_row,
        verify_corpus_integrity,
    )
    run_card, card_id, fingerprint_hash = assemble_run_card(report_path)
    for w in verify_corpus_integrity(run_card):
        print(f"    ⚠ {w}")
    row = build_run_card_row(
        run_card, card_id, fingerprint_hash,
        submitter=submitter,
        trust="verified",
        affirmation=affirmation or (
            f"Hypotheses submission scored by the organizer node '{node_id}' "
            f"against organizer-held references (mt-eval contest node). "
            f"Scores verified by the reference holder; method identity is "
            f"participant-claimed. Published aggregates-only."
        ),
    )
    problems = validate_row(row)
    if problems:
        raise RuntimeError(f"Run card incomplete (would be rejected): {problems}")
    return row, card_id


# ---------------------------------------------------------------------------
# Publication policy — contract C5 (practices 2 and 6, founder plan 2026-09-06).
#
# A contest may PROMISE participants that no score is visible while it is open
# (`contests.metadata.results_visibility = 'hidden_until_close'`, a key
# migration 072/074 freezes the moment the contest has entries). The promise is
# kept HERE, at the one place a sealed run's card would reach `run_cards`:
#
#   immediate           → insert run_cards + contest_submissions (today's path)
#   hidden_until_close  → insert contest_deferred_results (migration 074) and
#                         nothing else; `mt-eval contest close` publishes every
#                         deferred row BEFORE it freezes the ranking, so the
#                         wait costs a participant time, never a run.
#
# WITHHELD IS A STATE, NOT A LOSS. The deferred row holds the assembled row
# verbatim, is immutable after insert, and its publication pointer is set once
# (074's contest_deferred_result_guard, un-bypassable by service_role). A
# database without that table FAILS LOUD naming 074 — the one thing that must
# never happen is publishing a card the organizer promised to hide.
#
# BOARD-SIDE ANONYMITY IS OUT OF SCOPE. `metadata.anonymize_until_close` only
# pseudonymises the organizer's own ranking artifacts while the contest is open
# (contest_rank); a published run card shows whatever `run_cards` shows.
# Hiding results is what hidden_until_close does; anonymising them is not.
#
# THE 040 LEDGER CANNOT RECORD THIS YET. `authorization_audit_log.event_type`
# is a closed CHECK vocabulary (migration 040: request_created, vote_cast,
# request_authorized, request_denied, request_expired, grant_minted,
# grant_used, grant_expired, single_party_attempt_blocked) and 074 did not
# extend it, so a `result_deferred` / `deferred_result_published` event would
# be REFUSED by the database. Rather than invent a second ledger (or write an
# event the DB rejects and swallow the error), the deferral record IS the
# contest_deferred_results row: service-role-only, trigger-frozen, with
# deferred_at and a set-once published_run_card_id/published_at. Extending
# 040's vocabulary needs a migration, which this lane may not write.
# ---------------------------------------------------------------------------

DEFERRED_TABLE = "contest_deferred_results"

# The ONE reserved key inside contest_deferred_results.run_card_row. A deferred
# result must also carry the entry DECLARATIONS that `contest_submissions`
# needs at publication time (track, primary/contrastive, description, release
# url, constraints, byline — migration 074's columns, assembled by
# contest_declarations from the participant's own manifest). 074 gave the
# deferred table no column for them and the manifest is not readable at close
# time (the method bundle stays on the node, and in the air-gapped lane it
# never leaves the dark machine at all), so they ride inside the held JSONB
# under this reserved key and are stripped again before the run_cards INSERT.
# The published bytes are therefore exactly the row that was assembled;
# `_strip_sidecar` is the only thing that ever removes anything. A follow-up
# migration giving the table its own declarations column would retire this.
DEFERRED_SIDECAR_KEY = "_contest_submission"


class PublicationPolicyError(RuntimeError):
    """The contest's publication policy could not be honoured.

    Always a refusal to act, never a fallback: the alternative to raising
    here is publishing a score the organizer promised to withhold."""


def _looks_like_missing_deferred_table(exc: Exception) -> bool:
    """True when a PostgREST/Postgres error means 'no such table' (074)."""
    text = str(exc)
    return ("PGRST205" in text
            or "42P01" in text
            or (DEFERRED_TABLE in text and "does not exist" in text))


def _missing_074(what: str, exc: Exception) -> PublicationPolicyError:
    return PublicationPolicyError(
        f"{what}: this database has no public.{DEFERRED_TABLE} table — "
        f"migration 074 (074_contest_entries_phases_and_promises.sql) is not "
        f"applied. The contest promised participants that results stay hidden "
        f"until close, so publishing the card anyway is refused. Apply 074 to "
        f"this database and re-run.\n  (underlying error: {exc})")


def contest_publication_policy(contest: Optional[dict]) -> dict:
    """The publication policy in force for ``contest``.

    Returns ``{results_visibility, anonymize_until_close, source}``. A contest
    dict that does not carry its ``metadata`` column is RE-FETCHED rather than
    assumed open: a caller with a partial row must never cause a promised
    withholding to be silently downgraded to a publication. ``None`` means
    "this run belongs to no contest" (the plain board lane) — publish.
    """
    if contest is None:
        return {"results_visibility": "immediate",
                "anonymize_until_close": False,
                "source": "no-contest"}
    contest_id = contest.get("id")
    if not contest_id:
        raise PublicationPolicyError(
            "publish_or_defer needs the contest row (with its id) to resolve "
            "metadata.results_visibility — got a contest without an id.")
    if "metadata" in contest:
        metadata = contest.get("metadata") or {}
        source = "caller"
    else:
        rows = _fetch_rows("contests", {"id": f"eq.{contest_id}",
                                        "select": "id,metadata"})
        if not rows:
            raise PublicationPolicyError(
                f"Contest {contest_id!r} is not on this database — its "
                f"publication policy cannot be read, so nothing is published.")
        metadata = rows[0].get("metadata") or {}
        source = "database"
    visibility = metadata.get("results_visibility") or "immediate"
    if visibility not in RESULTS_VISIBILITY:
        raise PublicationPolicyError(
            f"Contest {contest_id!r} declares results_visibility "
            f"{visibility!r}, which is not in the migration-074 vocabulary "
            f"{list(RESULTS_VISIBILITY)} — refusing to guess what was "
            f"promised.")
    return {"results_visibility": visibility,
            "anonymize_until_close": bool(
                metadata.get("anonymize_until_close", False)),
            "source": source}


def _strip_sidecar(stored: dict) -> dict:
    """The run_cards row held inside a deferred result (sidecar removed)."""
    return {k: v for k, v in stored.items() if k != DEFERRED_SIDECAR_KEY}


def _submission_row(contest_id: str, run_card_id: str, sidecar: dict) -> dict:
    """The contest_submissions row a deferred/immediate publication writes."""
    notes = sidecar.get("notes") or ""
    role = sidecar.get("role") or "main"
    if role != "main" and f"[{role}" not in notes:
        notes = f"{notes} [sealed {role} split]".strip()
    return {
        "contest_id": contest_id,
        "run_card_id": run_card_id,
        "submitted_by": sidecar.get("submitted_by"),
        "authorization_request_id": sidecar.get("authorization_request_id"),
        "notes": notes,
        # track / is_primary / description / method_release_url /
        # constraints / submitter_label — the participant's own declarations
        # (contract C2, migration 074), carried verbatim.
        **dict(sidecar.get("fields") or {}),
    }


def _sealed_set_for_request(request_id: str) -> str:
    rows = _fetch_rows("authorization_requests",
                       {"request_id": f"eq.{request_id}",
                        "select": "request_id,sealed_set_id"})
    if not rows or not rows[0].get("sealed_set_id"):
        raise PublicationPolicyError(
            f"Cannot resolve the sealed set for authorization request "
            f"{request_id!r} — a deferred result records WHICH sealed split "
            f"produced it, so it is not written without one.")
    return rows[0]["sealed_set_id"]


def publish_or_defer(row: dict, *, contest: Optional[dict], request_id: str,
                     requested_by: Optional[str], notes: str,
                     role: str = "main", force_defer: bool = False,
                     submission_fields: Optional[dict] = None,
                     sealed_set_id: Optional[str] = None) -> dict:
    """Publish a scored run now, or park it until the contest closes (C5).

    ``row`` is the assembled ``run_cards`` row (``build_scored_run_row``, or
    the relayed row a signed airgap score bundle carries). ``contest`` is the
    contest row this entry belongs to (``None`` for a run that belongs to no
    contest — nothing to promise, so it publishes). ``submission_fields`` is
    ``contest_declarations.submission_fields_from_manifest(manifest)``;
    ``sealed_set_id`` names the split (resolved from the authorization request
    when omitted). ``force_defer`` is how a holdout split is ALWAYS withheld,
    whatever ``results_visibility`` says.

    Returns ``{"outcome": "published"|"deferred", "run_card_id": id|None,
    "results_visibility": …, "role": …}``.
    """
    if role not in DEFERRED_ROLES:
        raise ValueError(
            f"role must be one of {list(DEFERRED_ROLES)}, got {role!r} "
            f"(contest_policy.DEFERRED_ROLES / migration 074).")
    card_id = row.get("id")
    if not card_id:
        raise PublicationPolicyError(
            "publish_or_defer needs an assembled run_cards row with an id — "
            "got a row without one.")
    policy = contest_publication_policy(contest)
    defer = force_defer or policy["results_visibility"] == "hidden_until_close"

    if not defer:
        service_request(
            "POST", "run_cards", data=row,
            prefer="return=representation,resolution=ignore-duplicates")
        if contest is not None:
            service_request(
                "POST", "contest_submissions",
                data=_submission_row(contest["id"], card_id, {
                    "submitted_by": requested_by,
                    "authorization_request_id": request_id,
                    "notes": notes, "role": role,
                    "fields": submission_fields}),
                prefer="return=representation,resolution=ignore-duplicates")
        return {"outcome": "published", "run_card_id": card_id,
                "results_visibility": policy["results_visibility"],
                "role": role}

    if contest is None:
        raise PublicationPolicyError(
            "A result can only be deferred to a contest close, and this run "
            "belongs to no contest — refusing to withhold a card nothing will "
            "ever publish.")
    contest_id = contest["id"]
    sealed = sealed_set_id or _sealed_set_for_request(request_id)

    try:
        existing = _fetch_rows(DEFERRED_TABLE, {
            "request_id": f"eq.{request_id}",
            "select": "request_id,contest_id,role,run_card_row,"
                      "deferred_at,published_run_card_id,published_at"})
    except RuntimeError as exc:
        if _looks_like_missing_deferred_table(exc):
            raise _missing_074(
                f"request {request_id} scored under "
                f"results_visibility={policy['results_visibility']}", exc)
        raise
    if existing:
        held = existing[0]
        if held.get("published_run_card_id"):
            print(f"    ℹ {request_id}: deferred result already published as "
                  f"{held['published_run_card_id']} — nothing to defer.")
            return {"outcome": "published",
                    "run_card_id": held["published_run_card_id"],
                    "results_visibility": policy["results_visibility"],
                    "role": held.get("role", role)}
        held_id = _strip_sidecar(held.get("run_card_row") or {}).get("id")
        if held_id == card_id:
            print(f"    ℹ {request_id}: already deferred (run card {card_id}) "
                  f"— unchanged.")
            return {"outcome": "deferred", "run_card_id": None,
                    "results_visibility": policy["results_visibility"],
                    "role": held.get("role", role)}
        raise PublicationPolicyError(
            f"Request {request_id} already has a withheld result (run card "
            f"{held_id}, deferred {held.get('deferred_at')}) and this run "
            f"produced a different card ({card_id}). A withheld score is a "
            f"recorded score: it is not overwritten. Close the contest to "
            f"publish what is held, or file a fresh request for a re-run.")

    stored = dict(row)
    stored[DEFERRED_SIDECAR_KEY] = {
        "submitted_by": requested_by,
        "authorization_request_id": request_id,
        "notes": notes,
        "role": role,
        "fields": dict(submission_fields or {}),
    }
    try:
        service_request("POST", DEFERRED_TABLE, data={
            "request_id": request_id,
            "contest_id": contest_id,
            "sealed_set_id": sealed,
            "role": role,
            "run_card_row": stored,
        })
    except RuntimeError as exc:
        if _looks_like_missing_deferred_table(exc):
            raise _missing_074(
                f"request {request_id} scored under "
                f"results_visibility={policy['results_visibility']}", exc)
        raise
    # Say WHICH rule withheld it. A holdout split is deferred on a contest
    # that publishes immediately, so quoting the visibility promise there
    # would name a promise this contest never made.
    if policy["results_visibility"] == "hidden_until_close":
        why = (f"contest {contest_id} promised "
               f"results_visibility=hidden_until_close")
    else:
        why = (f"the {role} split is ALWAYS withheld — contest {contest_id} "
               f"publishes results immediately "
               f"(results_visibility={policy['results_visibility']}), but a "
               f"holdout score is not feedback for a contest still open")
    print(f"    ⏳ {request_id}: scored and WITHHELD ({role} split, run card "
          f"{card_id}) — {why}; `mt-eval contest close {contest_id}` "
          f"publishes it before the ranking is frozen.")
    return {"outcome": "deferred", "run_card_id": None,
            "results_visibility": policy["results_visibility"],
            "role": role}


def fetch_deferred_results(contest_id: str, *,
                           session: Optional[dict] = None,
                           unpublished_only: bool = True) -> list[dict]:
    """The withheld results recorded for a contest, oldest first.

    Reads with the ORGANIZER'S session when one is given (074's owner-SELECT
    policy) and with the service key otherwise. Raises
    :class:`PublicationPolicyError` naming migration 074 when the table is
    absent — a count of "0" that really means "the table is missing" would be
    the exact lie this lane exists to prevent."""
    params = {"contest_id": f"eq.{contest_id}",
              "order": "deferred_at.asc",
              "select": "request_id,contest_id,sealed_set_id,role,"
                        "run_card_row,deferred_at,published_run_card_id,"
                        "published_at"}
    try:
        if session is not None:
            from mt_eval_harness.contest import _api_request
            rows = _api_request("GET", DEFERRED_TABLE, params=params,
                                session=session)
        else:
            rows = service_request("GET", DEFERRED_TABLE, params=params)
    except RuntimeError as exc:
        if _looks_like_missing_deferred_table(exc):
            raise _missing_074(
                f"contest {contest_id}: withheld results cannot be read", exc)
        raise
    rows = rows if isinstance(rows, list) else []
    if unpublished_only:
        rows = [r for r in rows if not r.get("published_run_card_id")]
    return rows


def fetch_deferred_count(contest_id: str, *,
                         session: Optional[dict] = None) -> int:
    """How many scored results this contest is still withholding.

    Feeds the pre-close banner ("N deferred result(s) will be published by
    close") and the close leg's own accounting."""
    return len(fetch_deferred_results(contest_id, session=session))


def publish_deferred(contest_id: str) -> list[str]:
    """Publish every withheld result for a contest, oldest first (C5).

    Service-role: the run card is a ``trust='verified'`` insert and the
    deferred pointer is service-only under 074's RLS. Each row is published
    with the bytes that were held — the 023/026/041/051/053 triggers see
    exactly the card the node assembled — then its ``published_run_card_id`` /
    ``published_at`` are stamped. That pointer is set-once in the database, so
    a second call publishes nothing: already-published rows are not re-read
    into the work list at all, and the guard is the backstop if they were.

    Returns the run-card ids published by THIS call (empty on the second)."""
    service_key()  # fail loud before the first insert, not between two
    rows = fetch_deferred_results(contest_id, unpublished_only=True)
    published: list[str] = []
    for held in rows:
        request_id = held["request_id"]
        stored = held.get("run_card_row") or {}
        sidecar = dict(stored.get(DEFERRED_SIDECAR_KEY) or {})
        card = _strip_sidecar(stored)
        card_id = card.get("id")
        if not card_id:
            raise PublicationPolicyError(
                f"Deferred result {request_id} holds a run-card row with no "
                f"id — it cannot be published, and it is not silently "
                f"skipped. Inspect {DEFERRED_TABLE} for this request.")
        service_request(
            "POST", "run_cards", data=card,
            prefer="return=representation,resolution=ignore-duplicates")
        service_request(
            "POST", "contest_submissions",
            data=_submission_row(contest_id, card_id, sidecar),
            prefer="return=representation,resolution=ignore-duplicates")
        stamped = service_request(
            "PATCH", DEFERRED_TABLE,
            params={"request_id": f"eq.{request_id}"},
            data={"published_run_card_id": card_id,
                  "published_at": datetime.now(timezone.utc).isoformat()})
        if not stamped:
            raise PublicationPolicyError(
                f"Published run card {card_id} for {request_id} but the "
                f"deferred row's publication pointer did not stick (no row "
                f"updated) — stop and inspect {DEFERRED_TABLE} before closing "
                f"the contest.")
        published.append(card_id)
        print(f"    ✅ {request_id}: withheld result published as {card_id} "
              f"({held.get('role', 'main')} split).")
    return published


# ---------------------------------------------------------------------------
# The per-item state machine.
#
# LEGACY LANE (founder ruling R2, 2026-09-06): the hypotheses intake below is
# no longer a contest ENTRY path — `mt-eval contest submit-hypotheses` is
# retired. It survives as the organizer-internal drain for rows already in
# flight (and for an organizer's own diagnostic uploads); a contest is entered
# by handing a METHOD to this node (sandbox_runner.run_method_request /
# airgap_transport.run_imported).
# ---------------------------------------------------------------------------

def _find_scored_report(output_dir: Path) -> Optional[Path]:
    """The TestReport a completed scoring left on disk, if it is still here."""
    if not output_dir.is_dir():
        return None
    reports = sorted(output_dir.glob("*_report.json"))
    return reports[-1] if reports else None


def _ensure_intake_bundle(item: dict, scratch: Path) -> dict:
    """The submission manifest, re-fetching the bundle if scratch is gone."""
    manifest_path = scratch / "manifest.json"
    if manifest_path.is_file():
        return json.loads(manifest_path.read_text(encoding="utf-8"))
    bundle = _storage_download(item["storage_path"])
    return extract_bundle(bundle, scratch)


def process_intake_item(item: dict, *, contest: dict, qualifier: dict,
                        contest_cfg: dict, cfg: dict) -> None:
    intake_id = item["intake_id"]
    status = item["status"]
    node_id = cfg["node_id"]
    # Set by the scoring branch; absent when a 'scored' row is picked up on a
    # later poll (the recovery path publishes from the report on disk).
    scored_report: Optional[Path | str] = None
    scored_headline = None   # "chrF++ 47.5 [45.9, 49.0]" of the sealed scoring
    scratch = Path(cfg["scratch_dir"]).expanduser() / intake_id
    output_dir = Path(cfg["output_dir"]).expanduser() / intake_id
    sealed_set_id = contest["corpus_id"]
    model = contest.get("authorization_model", "per-submission")

    if status == "received":
        # 1. Download + digest-verify + extract.
        try:
            bundle = _storage_download(item["storage_path"])
            manifest = extract_bundle(bundle, scratch)
        except (RuntimeError, HypothesesFormatError, json.JSONDecodeError) as e:
            _reject(intake_id, f"bundle unreadable: {e}")
            return
        try:
            dev_file = _find_hyp_file(scratch, "dev-hypotheses")
            test_file = _find_hyp_file(scratch, "test-hypotheses")
        except HypothesesFormatError as e:
            _reject(intake_id, str(e))
            return
        if sha256_file(dev_file) != item["dev_hyp_sha256"] or \
           sha256_file(test_file) != item["test_hyp_sha256"]:
            _reject(intake_id,
                    "bundle digests do not match the recorded submission "
                    "digests — the uploaded bytes are not what was declared.")
            return
        # Method claim must be valid vocabulary BEFORE any scoring effort.
        try:
            build_claimed_method_card(
                system_label=manifest.get("system_label", ""),
                method_class=manifest.get("method_class", ""),
                paradigm=manifest.get("paradigm"),
            )
        except ValueError as e:
            _reject(intake_id, f"invalid method claim in manifest: {e}")
            return

        # 2. The node's OWN dev re-score — this is what gates.
        from mt_eval_harness.pair_notation import split_pair
        src, tgt = split_pair(contest.get("language_pair"))
        try:
            dev_result = score_hypotheses(
                corpus_path=Path(contest_cfg["dev_corpus"]).expanduser(),
                hypotheses_path=dev_file,
                dataset_id=qualifier["corpus_card_id"],
                source_lang=src or "source",
                target_lang=tgt or "target",
                system_label=manifest.get("system_label", "unnamed"),
                method_class=manifest.get("method_class", "api"),
                paradigm=manifest.get("paradigm"),
                output_dir=output_dir / "dev",
                compute_ci=False,
                submission={"contest_id": contest["id"],
                            "intake_id": intake_id,
                            "submitted_by": item["submitted_by"]},
            )
        except (HypothesesFormatError, RuntimeError, ValueError) as e:
            _reject(intake_id, f"dev hypotheses could not be scored: {e}")
            return
        # The qualifier gates on corpus chrF++; a row naming the retired
        # composite is gated on it with a note, any other metric refused.
        try:
            _q_metric = resolve_qualifier_metric(qualifier.get("metric"),
                                                 qualifier["threshold"])
        except ValueError as e:
            _reject(intake_id, str(e))
            return
        verdict = is_eligible_for_sealed_run(
            qualifier_id=qualifier["qualifier_id"],
            score=dev_result["qualifier_score"],
            threshold=qualifier["threshold"],
            qualifier_year=qualifier.get("year"),
            current_year=datetime.now(timezone.utc).year,
        )
        # Mostly copies of the source is not translating, whatever the score
        # (score_caveats.source_copy_refusal — the same refusal every
        # qualifier gate applies).
        from mt_eval_harness.score_caveats import source_copy_refusal
        copy_refusal = None
        if dev_result.get("report_path"):
            _dev_report = json.loads(Path(dev_result["report_path"])
                                     .read_text(encoding="utf-8"))
            copy_refusal = source_copy_refusal(_dev_report.get("entries") or [])
        if copy_refusal is not None:
            verdict = {**verdict, "eligible": False,
                       "reason": copy_refusal["reason"]}
        if not verdict["eligible"]:
            _advance(intake_id, {"qualifier_id": qualifier["qualifier_id"],
                                 "qualifier_score": dev_result["qualifier_score"]})
            _reject(intake_id, verdict["reason"])
            return
        _advance(intake_id, {
            "status": "qualifier_checked",
            "qualifier_id": qualifier["qualifier_id"],
            "qualifier_score": dev_result["qualifier_score"],
        })
        print(f"    ✓ {intake_id}: qualifier cleared at chrF++ "
              f"{dev_result['qualifier_score']} ≥ {qualifier['threshold']} "
              f"on the chrF++ 0-100 qualifier scale")
        if _q_metric["note"]:
            print(f"      Note: {_q_metric['note']}")
        item = {**item, "status": "qualifier_checked"}
        status = "qualifier_checked"
        # fall through to authorization

    if status == "qualifier_checked":
        if model == "open":
            _advance(intake_id, {"status": "scoring"})
            item = {**item, "status": "scoring"}
            status = "scoring"
        else:
            request_id = create_authorization_request(
                item, contest_cfg, sealed_set_id, node_id)
            if model == "blanket":
                # Auto-authorize under RECORDED policy — the full request/
                # grant/audit trail exists for every scoring anyway.
                authorize_request(request_id, actor=f"node:{node_id}",
                                  policy="blanket",
                                  sealed_set_id=sealed_set_id)
                fingerprint = _fingerprint_for(item, contest_cfg,
                                               sealed_set_id, node_id)
                mint_and_claim_grant(request_id, fingerprint, sealed_set_id,
                                     node_id=node_id,
                                     ttl_seconds=cfg["grant_ttl_seconds"])
                _advance(intake_id, {"status": "scoring",
                                     "authorization_request_id": request_id})
                item = {**item, "status": "scoring",
                        "authorization_request_id": request_id}
                status = "scoring"
            else:  # per-submission
                _advance(intake_id, {"status": "pending_authorization",
                                     "authorization_request_id": request_id})
                print(f"    ⏸ {intake_id}: waiting for custodian approval "
                      f"({request_id}) — `mt-eval node approve {request_id}`")
                return

    if status == "pending_authorization":
        request_id = item.get("authorization_request_id")
        reqs = _fetch_rows("authorization_requests",
                           {"request_id": f"eq.{request_id}",
                            "select": "request_id,state,fingerprint"})
        state = reqs[0]["state"] if reqs else "missing"
        if state == "pending":
            return  # still waiting — check again next poll
        if state in ("denied", "expired", "missing"):
            _reject(intake_id,
                    f"authorization request {request_id} is {state} — the "
                    f"custodian did not approve this scoring.")
            return
        # authorized → mint + claim, then score.
        fingerprint = _fingerprint_for(item, contest_cfg, sealed_set_id,
                                       node_id)
        mint_and_claim_grant(request_id, fingerprint, sealed_set_id,
                             node_id=node_id,
                             ttl_seconds=cfg["grant_ttl_seconds"])
        _advance(intake_id, {"status": "scoring"})
        item = {**item, "status": "scoring"}
        status = "scoring"

    if status == "scoring":
        # Bundle may need re-fetching (e.g. daemon restarted mid-flight).
        if not scratch.exists() or not list(scratch.glob("test-hypotheses.*")):
            try:
                bundle = _storage_download(item["storage_path"])
                extract_bundle(bundle, scratch)
            except (RuntimeError, HypothesesFormatError) as e:
                _reject(intake_id, f"bundle unreadable at scoring time: {e}")
                return
        manifest = json.loads((scratch / "manifest.json").read_text(encoding="utf-8"))
        test_file = _find_hyp_file(scratch, "test-hypotheses")

        refs_path, is_scratch = None, False
        try:
            refs_path, is_scratch = resolve_refs_corpus(
                contest_cfg, Path(cfg["scratch_dir"]).expanduser())
            from mt_eval_harness.pair_notation import split_pair
            src, tgt = split_pair(contest.get("language_pair"))
            result = score_hypotheses(
                corpus_path=refs_path,
                hypotheses_path=test_file,
                dataset_id=sealed_set_id,
                source_lang=src or "source",
                target_lang=tgt or "target",
                system_label=manifest.get("system_label", "unnamed"),
                method_class=manifest.get("method_class", "api"),
                paradigm=manifest.get("paradigm"),
                description=manifest.get("description", ""),
                output_dir=output_dir / "test",
                default_segment="held_out",
                compute_ci=True,
                submission={"contest_id": contest["id"],
                            "intake_id": intake_id,
                            "submitted_by": item["submitted_by"]},
            )
        except (HypothesesFormatError, RuntimeError, ValueError,
                NodeConfigError) as e:
            _reject(intake_id, f"scoring against the secret set failed: {e}")
            return
        finally:
            if is_scratch and refs_path is not None:
                _wipe(refs_path)

        _advance(intake_id, {"status": "scored"})
        item = {**item, "status": "scored"}
        status = "scored"
        scored_report = result["report_path"]
        from mt_eval_harness.scoring import format_primary
        scored_headline = format_primary(result.get("chrf_plus_plus"),
                                         result.get("chrf_ci_lower"),
                                         result.get("chrf_ci_upper"))

    if status == "scored":
        # A row that reached 'scored' but not 'published' used to be stranded
        # forever: 'scored' was in _ACTIONABLE with no branch, so every later
        # poll re-fetched it and did nothing (a crash between the two writes —
        # or a publish that raised something other than RuntimeError — parked
        # the participant's work permanently). Publishing is idempotent
        # (deterministic card id + resolution=ignore-duplicates), so the
        # recovery is simply to publish again from the report already on disk.
        report_path = scored_report or _find_scored_report(output_dir / "test")
        if report_path is None:
            _reject(intake_id,
                    "recorded as scored but this node no longer holds the "
                    "TestReport for it (scratch/output cleared or the row was "
                    "scored on another machine) — republishing would have to "
                    "re-open the secret set, which needs a fresh "
                    "authorization. Re-submit to be scored again.")
            return
        try:
            manifest = _ensure_intake_bundle(item, scratch)
            card_id = publish_scored_run(
                report_path,
                submitter=display_identity_from_manifest(manifest),
                node_id=node_id)
            service_request(
                "POST", "contest_submissions", data={
                    "contest_id": contest["id"],
                    "run_card_id": card_id,
                    "submitted_by": item["submitted_by"],
                    "submitter_label": display_identity_from_manifest(manifest),
                    "team": item.get("team"),
                    "notes": f"organizer-node scored ({intake_id})",
                }, prefer="return=representation,resolution=ignore-duplicates")
        except (RuntimeError, HypothesesFormatError,
                json.JSONDecodeError) as e:
            _reject(intake_id, f"scored but could not publish: {e}")
            return
        _advance(intake_id, {"status": "published", "run_card_id": card_id})
        print(f"    ✅ {intake_id}: published {card_id} "
              + (f"({scored_headline} on the sealed set; "
                 if scored_headline is not None
                 else "(republished from the scored report, ")
              + "aggregates-only, trust=verified)")


# ---------------------------------------------------------------------------
# The poll loop + operator commands.
# ---------------------------------------------------------------------------

_ACTIONABLE = ("received", "qualifier_checked", "pending_authorization",
               "scoring", "scored")


def poll_once(cfg: dict) -> int:
    """One pass over every served contest's HYPOTHESES intake. Returns items
    processed.

    Organizer-internal legacy since 2026-09-06 (R2): the hypotheses lane is
    retired as a contest entry path. Contest entries are methods, and they do
    not appear here — `mt-eval node run-method <request-id>` executes those
    (see `mt-eval node list` for the request queue). This drain exists so rows
    already in flight, and an organizer's own diagnostic uploads, still finish.
    """
    processed = 0
    for contest_id, contest_cfg in cfg["contests"].items():
        contests = _fetch_rows("contests", {
            "id": f"eq.{contest_id}",
            "select": "id,name,status,corpus_id,language_pair,"
                      "authorization_model,intake_open"})
        if not contests:
            print(f"  ⚠ contest {contest_id} not found on the DB — skipping")
            continue
        contest = contests[0]
        qualifiers = _fetch_rows("qualifiers", {
            "sealed_set_id": f"eq.{contest['corpus_id']}",
            "status": "eq.active",
            "select": "qualifier_id,corpus_card_id,threshold,metric,year"})
        if not qualifiers:
            print(f"  ⚠ contest {contest_id} has no active qualifier — "
                  f"holding ALL submissions (fail-safe)")
            continue
        qualifier = qualifiers[0]
        # Sanity: refuse plaintext refs on a per-submission contest (mirror of
        # contest_prep's refusal, in case configs were hand-edited).
        if (contest.get("authorization_model") == "per-submission"
                and contest_cfg.get("refs_plaintext")):
            print(f"  ⚠ contest {contest_id} is per-submission but the node "
                  f"config points at PLAINTEXT refs — refusing to serve it "
                  f"(seal the refs; see the runbook).")
            continue

        statuses = ",".join(_ACTIONABLE)
        items = _fetch_rows("contest_intake", {
            "contest_id": f"eq.{contest_id}",
            "status": f"in.({statuses})",
            "order": "created_at.asc"})
        if items:
            print(f"  ℹ {contest_id}: draining {len(items)} hypotheses-lane "
                  f"row(s). That lane is RETIRED as a contest entry path "
                  f"(2026-09-06) — contest entries are methods executed by "
                  f"this node (`mt-eval node run-method`).")
        for item in items:
            processed += 1
            try:
                process_intake_item(item, contest=contest,
                                    qualifier=qualifier,
                                    contest_cfg=contest_cfg, cfg=cfg)
            except Exception as e:  # noqa: BLE001 — daemon must not die mid-queue
                print(f"    ⚠ {item['intake_id']}: {e} (will retry next poll)")
    return processed


def serve(config_path: str | Path | None = None, *, once: bool = False) -> None:
    cfg = load_node_config(config_path, database=True)
    service_key()  # fail loud at startup, not on the first item
    print(f"  Organizer node '{cfg['node_id']}' serving "
          f"{len(cfg['contests'])} contest(s); poll every "
          f"{cfg['poll_seconds']}s. Ctrl-C to stop.")
    while True:
        n = poll_once(cfg)
        if once:
            print(f"  --once: processed {n} item(s); exiting.")
            return
        time.sleep(cfg["poll_seconds"])


def _submitter_labels(contest_ids: list[str]) -> dict[str, str]:
    """request_id → the public byline recorded for it (074's
    contest_submissions.submitter_label). Empty on an endpoint without those
    columns, and it SAYS SO — a missing label must never read as anonymity."""
    labels: dict[str, str] = {}
    for cid in contest_ids:
        try:
            rows = _fetch_rows("contest_submissions", {
                "contest_id": f"eq.{cid}",
                "select": "authorization_request_id,submitter_label,"
                          "run_card_id"})
        except RuntimeError as e:
            print(f"  ⚠ submitter labels unavailable for {cid} ({e}) — the "
                  f"queue shows the filing account instead. Migration 074 "
                  f"adds contest_submissions.submitter_label.")
            return {}
        for row in rows:
            rid = row.get("authorization_request_id")
            if rid and row.get("submitter_label"):
                labels[rid] = row["submitter_label"]
    return labels


def list_queue(config_path: str | Path | None = None,
               contest_id: str | None = None) -> list[dict]:
    cfg = load_node_config(config_path, database=True)
    ids = [contest_id] if contest_id else list(cfg["contests"])
    all_rows: list[dict] = []
    for cid in ids:
        rows = _fetch_rows("contest_intake", {
            "contest_id": f"eq.{cid}", "order": "created_at.asc",
            "select": "intake_id,contest_id,submitted_by,status,"
                      "qualifier_score,authorization_request_id,"
                      "run_card_id,reject_reason,created_at"})
        all_rows.extend(rows)

    # THE contest lane (R2): participant-created method requests against the
    # served secret sets — there is no intake row here, the request IS the
    # queue item; `mt-eval node run-method <id>` executes it.
    method_rows: list[dict] = []
    for cid in ids:
        secret_set = (cfg["contests"].get(cid) or {}).get("secret_set_id")
        if not secret_set:
            continue
        method_rows.extend(_fetch_rows("authorization_requests", {
            "sealed_set_id": f"eq.{secret_set}",
            "state": "in.(pending,authorized)",
            "order": "created_at.asc",
            "select": "request_id,sealed_set_id,state,method_sha,"
                      "requested_by,created_at"}))
    labels = _submitter_labels(ids)

    if not all_rows and not method_rows:
        print("  Queue empty.")
        return []
    for r in all_rows:
        extra = ""
        if r.get("authorization_request_id") and \
                r["status"] == "pending_authorization":
            extra = f"  ← approve/deny {r['authorization_request_id']}"
        print(f"  {r['intake_id']}  [{r['status']}]  {r['submitted_by']}"
              f"  qualifier "
              f"{qualifier_score_phrase(r.get('qualifier_score'))}{extra}")
    for r in method_rows:
        step = ("← approve/deny, then run-method" if r["state"] == "pending"
                else "← run-method")
        # The public byline the entry will publish under, when the node has
        # already recorded one; before that there is only the account that
        # filed the request (organizer-side view, never the board's).
        label = labels.get(r["request_id"]) or f"{r.get('requested_by')} (account)"
        r["submitter_label"] = labels.get(r["request_id"])
        print(f"  {r['request_id']}  [method:{r['state']}]  "
              f"{label}  sha={r['method_sha'][:12]}…  {step}")
    return all_rows + method_rows


def approve(request_id: str, *, actor: str,
            config_path: str | Path | None = None) -> None:
    cfg = load_node_config(config_path, database=True)
    reqs = _fetch_rows("authorization_requests",
                       {"request_id": f"eq.{request_id}",
                        "select": "request_id,state,sealed_set_id"})
    if not reqs:
        raise RuntimeError(f"No authorization request {request_id}.")
    if reqs[0]["state"] != "pending":
        raise RuntimeError(f"Request {request_id} is {reqs[0]['state']} — "
                           f"only a pending request can be approved.")
    append_audit_event("vote_cast", request_id=request_id,
                       sealed_set_id=reqs[0].get("sealed_set_id"),
                       actor=actor, detail={"vote": "approve",
                                            "node": cfg["node_id"]})
    authorize_request(request_id, actor=actor, policy="per-submission",
                      sealed_set_id=reqs[0].get("sealed_set_id"))
    print(f"  ✅ {request_id} authorized by {actor}. The node will mint the "
          f"grant and score on its next poll.")


def deny(request_id: str, *, actor: str, reason: str,
         config_path: str | Path | None = None) -> None:
    load_node_config(config_path, database=True)  # the operator context
    reqs = _fetch_rows("authorization_requests",
                       {"request_id": f"eq.{request_id}",
                        "select": "request_id,state,sealed_set_id"})
    if not reqs:
        raise RuntimeError(f"No authorization request {request_id}.")
    if reqs[0]["state"] != "pending":
        raise RuntimeError(f"Request {request_id} is {reqs[0]['state']} — "
                           f"only a pending request can be denied.")
    append_audit_event("vote_cast", request_id=request_id,
                       sealed_set_id=reqs[0].get("sealed_set_id"),
                       actor=actor, detail={"vote": "deny", "reason": reason})
    deny_request(request_id, actor=actor, reason=reason,
                 sealed_set_id=reqs[0].get("sealed_set_id"))
    print(f"  ✗ {request_id} denied by {actor}: {reason}")
