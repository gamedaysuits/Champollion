"""contest_prep — `mt-eval contest prepare`: split, seal, and register a contest.

One command takes an organizer's master corpus and produces the three-tier
secrecy ladder of an organizer-run contest (docs/ORGANIZER_NODE_RUNBOOK.md):

  T0  PUBLIC DEV / QUALIFIER — source + references released. This corpus IS
      the public qualifier (migration 042): a submission must clear its
      threshold before the secret set is ever scored. Its corpus id follows
      the qualifier shape eval-<src>-<tgt>-<slug>-qualifier-vYYYY.
  T1  BLIND TEST (OPTIONAL — ORGANIZER DIAGNOSTIC, default off) — the SOURCE
      side is released; the REFERENCES exist only on the organizer's machine,
      SEALED AT REST by default. Founder ruling R2 (2026-09-06) RETIRED this
      as a contest tier: nobody enters a contest by uploading translations, so
      --blind-size defaults to 0 and the tier survives only as a diagnostic an
      organizer may choose to run. Registered content-free in sealed_sets (037).
  T2  FULLY SECRET — source AND references sealed; participants never see the
      source. This is the set the contest is registered against
      (``contests.corpus_id``) and the one the Phase-B method-execution lane
      scores (sandbox-evaluation-spec).
  T2b SEALED HOLDOUT (optional, --sealed-holdout-size) — a SECOND fully sealed
      split, registered as its own sealed_sets row and named on the contest as
      ``metadata.sealed_holdout_set_id``. One authorized run covers both sets
      (contract D1); the holdout's scores are withheld until close. This is
      the public/private-split discipline of a shared task with the private
      half never leaving the node.

Alongside the ladder, ``--test-suite`` declares THIRD-PARTY public diagnostic
corpora (practice 14): registry-resolved, sha-pinned, frozen on the contest as
``metadata.test_suites``. The node runs each entry on them too; the numbers
are reported and never ranked.

Hard rules encoded here:
  * DETERMINISTIC split — an explicit --seed is REQUIRED and recorded in the
    organizer-local manifest, so the split is reproducible and auditable.
  * --qualifier-threshold is REQUIRED (thresholds are data, never a code
    default — CLAUDE.md SSOT rule).
  * Plaintext refs (--plaintext-refs) REFUSE authorization_model
    'per-submission': per-submission custody ceremonies over refs that are
    lying around unencrypted would be security theater (fail-closed, plan D2).
  * Registration never creates a quarantined `datasets` row for the blind
    set: migration 022's run_cards guard would then BLOCK score publishing.
    The WMT-style posture ("the secret set never ranks as a dataset, its
    scores publish") is carried by the sealed_sets registration alone —
    quarantined-by-default in ITS table (037), contest-gated by 041, with
    per-entry content withheld by publish.py + migration 033 regardless.
  * NO corpus content ever reaches Supabase — registration rows are
    content-free (ids, digests, thresholds, ISO codes).

The crypto is NOT reimplemented here: sealing shells out (shell-free argv)
to `champollion seal-corpus`, so lib/seal.mjs stays the single cipher
implementation.
"""

from __future__ import annotations

import json
import os
import random
import shutil
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from mt_eval_harness.contest_policy import (
    DEFAULT_RESULTS_VISIBILITY,
    TEST_SUITE_KEYS,
)
from mt_eval_harness.external_scoring import sha256_file
from mt_eval_harness.qualifier_gate import (
    QUALIFIER_METRIC,
    build_qualifier_id,
    threshold_phrase,
)

AUTHORIZATION_MODELS = ("per-submission", "blanket", "open")


class ContestPrepError(ValueError):
    """A prepare request that must not proceed — always with the reason."""


# ---------------------------------------------------------------------------
# Deterministic split — pure function.
# ---------------------------------------------------------------------------

#: How prepare splits a master corpus — recorded in the manifest.
#: ``group-disjoint/1``: rows sharing a source or a reference (compared by
#: :func:`_norm_text`) form one group, and a group lands whole in one tier.
SPLIT_METHOD = "group-disjoint/1"


def duplicate_groups(entries: list[dict]) -> list[list[int]]:
    """Row indices grouped so that rows sharing a SOURCE or a REFERENCE —
    exactly, or after :func:`_norm_text` (case, punctuation, spacing) — are
    in one group, transitively. Groups come in first-occurrence order, rows
    in index order; a master with no repeats gives one singleton per row."""
    parent = list(range(len(entries)))

    def find(i: int) -> int:
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    seen: dict[tuple[str, str], int] = {}
    for i, e in enumerate(entries):
        for side in ("source", "reference"):
            key = _norm_text(e.get(side))
            if not key:
                continue
            j = seen.setdefault((side, key), i)
            if j != i:
                a, b = find(i), find(j)
                if a != b:
                    parent[max(a, b)] = min(a, b)
    groups: dict[int, list[int]] = {}
    for i in range(len(entries)):
        groups.setdefault(find(i), []).append(i)
    return [groups[r] for r in sorted(groups)]


def _first_fit(groups: list[list[int]], sizes: list[int]
               ) -> Optional[list[list[int]]]:
    """Each group, in order, into the first tier with room for all of it;
    None unless every tier ends exactly full."""
    tiers: list[list[int]] = [[] for _ in sizes]
    for g in groups:
        for t, size in enumerate(sizes):
            if len(tiers[t]) + len(g) <= size:
                tiers[t].extend(g)
                break
    if any(len(tiers[t]) != size for t, size in enumerate(sizes)):
        return None
    return tiers


def split_corpus(
    entries: list[dict],
    *,
    dev_size: int,
    blind_size: int = 0,
    secret_size: int = 0,
    holdout_size: int = 0,
    seed: int,
    stats: Optional[dict] = None,
) -> tuple[list[dict], list[dict], list[dict], list[dict]]:
    """Deterministically split a master corpus into GROUP-disjoint
    dev / blind / secret / holdout.

    Rows that share a source or a reference (:func:`duplicate_groups`) always
    land in ONE tier, so no sealed row repeats a released one. The split used
    to be disjoint by row only: 4 of 30 sealed rows and 2 of 10 holdout rows
    of a rehearsal matched the released dev set, and prepare only warned —
    sealed answers leaked through the dev release (synthetic researcher,
    Round 13).

    Same entries + same seed => byte-identical split, forever (the seed is
    recorded in the organizer-local manifest). The groups are shuffled with
    the seed and placed in a FIXED tier order — dev, blind, secret, holdout —
    each into the first tier with room for all of it. A master with no
    repeated sentence is all singleton groups, and its split is exactly the
    one the row-disjoint split gave (same shuffle, same slices). When that
    order cannot fill every tier exactly, the largest groups are placed first
    (still seeded); when no packing does, the split is REFUSED with the
    counts and the fix — never quietly leaked.

    Only ``dev_size`` is required: the public qualifier is the one tier every
    contest has. Under founder ruling R2 the blind (source-public) tier is an
    optional organizer diagnostic, so ``blind_size=0`` is a normal contest.
    ``stats`` (optional dict) is filled with what the manifest records:
    method, group counts, the packing used, rows left out.
    """
    if dev_size <= 0:
        raise ContestPrepError(
            f"dev-size must be positive (got {dev_size}) — the public "
            f"qualifier is the one tier every contest has.")
    for label, value in (("blind-size", blind_size),
                         ("secret-size", secret_size),
                         ("holdout-size", holdout_size)):
        if value < 0:
            raise ContestPrepError(f"{label} cannot be negative (got {value}).")
    need = dev_size + blind_size + secret_size + holdout_size
    if need > len(entries):
        raise ContestPrepError(
            f"Split needs {need} entries (dev {dev_size} + blind {blind_size} "
            f"+ secret {secret_size} + holdout {holdout_size}) but the master "
            f"corpus has only {len(entries)}.")

    groups = duplicate_groups(entries)
    order = list(groups)
    random.Random(seed).shuffle(order)
    sizes = [dev_size, blind_size, secret_size, holdout_size]
    packing = "seeded order"
    tiers = _first_fit(order, sizes)
    if tiers is None:
        packing = "largest groups first (seeded order within a size)"
        tiers = _first_fit(sorted(order, key=len, reverse=True), sizes)
    multi = [g for g in groups if len(g) > 1]
    if tiers is None:
        largest = max(len(g) for g in groups)
        raise ContestPrepError(
            f"The master corpus cannot be split so that repeated sentences "
            f"stay on one side: dev {dev_size} + blind {blind_size} + secret "
            f"{secret_size} + holdout {holdout_size} = {need} of its "
            f"{len(entries)} rows, but {sum(len(g) for g in multi)} rows "
            f"share a source or a reference with another row (after "
            f"normalizing case, punctuation and spacing), in {len(multi)} "
            f"groups of 2 to {largest}, and each group must land whole in "
            f"one split — no combination of whole groups fills those sizes "
            f"exactly. A sealed row that repeats a released one is not "
            f"sealed. Fix: remove the {sum(len(g) - 1 for g in multi)} "
            f"repeated rows from the master (keep one row of each group), or "
            f"choose sizes whole groups can fill — leaving some rows out of "
            f"every split (a total below {len(entries)}) gives the packing "
            f"room — and prepare again.")
    if stats is not None:
        stats.update({
            "method": SPLIT_METHOD,
            "groups": len(groups),
            "multi_row_groups": len(multi),
            "rows_in_multi_row_groups": sum(len(g) for g in multi),
            "packing": packing,
            "rows_left_out": len(entries) - need,
        })
    dev, blind, secret, holdout = ([entries[i] for i in t] for t in tiers)
    return dev, blind, secret, holdout


# ---------------------------------------------------------------------------
# Sealed-vs-public overlap — a sealed row that is already public is not sealed.
# ---------------------------------------------------------------------------

def _norm_text(text) -> str:
    """The comparison form for the split's groups AND the overlap check — one
    definition, so a row the check would call public is never split away
    from its twin: ``text_compare.repeat_compare_key`` (NFKC, casefolded,
    punctuation to spaces, whitespace collapsed, diacritics kept) — so
    "Thank you." and "thank  you" are the same sentence for this purpose."""
    from mt_eval_harness.text_compare import repeat_compare_key
    return repeat_compare_key(str(text or ""))


def overlap_counts(sealed: list[dict], public: list[dict], *,
                   sides=("source", "reference")) -> dict:
    """How many rows of a SEALED split also appear in a PUBLIC set.

    A row counts once if its source or its reference matches the same side
    of any public row, exactly or after :func:`_norm_text`. ``sides`` names
    the sides the public set actually releases (a blind release is source
    only). Returns ``{rows, of, by_source, by_reference, exact}``.
    """
    exact = {side: {str(e.get(side) or "").strip() for e in public} - {""}
             for side in sides}
    norm = {side: {_norm_text(e.get(side)) for e in public} - {""}
            for side in sides}
    rows = 0
    by_side = {"source": 0, "reference": 0}
    exact_rows = 0
    for e in sealed:
        hit = False
        hit_exact = False
        for side in sides:
            value = str(e.get(side) or "").strip()
            if not value:
                continue
            if value in exact[side]:
                hit = hit_exact = True
                by_side[side] += 1
            elif _norm_text(value) in norm[side]:
                hit = True
                by_side[side] += 1
        rows += hit
        exact_rows += hit_exact
    return {"rows": rows, "of": len(sealed), "by_source": by_side["source"],
            "by_reference": by_side["reference"], "exact": exact_rows}


def _local_suite_copy(suite_id: str, registry_path=None) -> Optional[Path]:
    """A copy of a registered corpus ALREADY on this machine, or None.

    Looks where the harness itself leaves corpora — the registry entry's
    ``local_path`` (under the working directory or MT_EVAL_DATA_ROOT), the
    URL-download cache, and the fetch-from-source build cache — and never
    downloads or builds anything: preparation is offline by design."""
    import hashlib

    from mt_eval_harness import corpus_fetch as cf
    from mt_eval_harness.config import _CACHE_ROOT, load_registry

    reg = Path(registry_path) if registry_path else None
    registry = load_registry(reg)
    entry = next((d for d in registry.get("datasets", [])
                  if d.get("id") == suite_id), None) or {}
    candidates: list[Path] = []
    local = entry.get("local_path")
    if local:
        bases = [Path.cwd()]
        if os.environ.get("MT_EVAL_DATA_ROOT"):
            bases.insert(0, Path(os.environ["MT_EVAL_DATA_ROOT"]).expanduser())
        candidates += [b / local for b in bases]
    url = entry.get("url")
    if url:
        url_hash = hashlib.sha256(str(url).encode()).hexdigest()[:16]
        candidates.append(_CACHE_ROOT / "datasets"
                          / f"{suite_id}_{url_hash}.json")
    for key in (local, entry.get("path"), suite_id):
        if not key:
            continue
        card = cf.find_card_for_corpus(key)
        if card is not None:
            candidates.append(cf.CACHE_DIR / card[1])
        export = cf.find_registry_export_for_corpus(key, registry_path=reg)
        if export is not None and export.get("path"):
            candidates.append(cf.CACHE_DIR / export["path"])
    return next((c for c in candidates if c.is_file()), None)


def _suite_entries(suite: dict, local_path: Optional[str], *,
                   registry_path=None) -> tuple[Optional[list[dict]], str]:
    """A declared suite's rows for the overlap check, or ``(None, why)``.

    ``local_path`` is the organizer's copy (``--test-suite ID=PATH``); its
    bytes must be the pinned bytes, or it is not the suite. Without one, a
    copy already on this machine is used if its bytes are the pinned bytes
    (nothing is downloaded — preparation is offline); otherwise the check is
    reported as NOT done — never passed.
    """
    from mt_eval_harness.config import RunConfig
    from mt_eval_harness.corpus_loader import load_corpus

    sid = suite["suite_id"]
    if local_path:
        fp = Path(local_path).expanduser()
        if not fp.is_file():
            raise ContestPrepError(
                f"--test-suite {sid}={local_path}: no such file.")
        actual = sha256_file(fp)
        if actual != suite["sha256"]:
            raise ContestPrepError(
                f"--test-suite {sid}={local_path}: that file hashes to "
                f"{actual}, but the registry pins {suite['sha256']} — it is "
                f"not the suite (your node would refuse it too).")
    else:
        try:
            fp = _local_suite_copy(sid, registry_path)
        except Exception as exc:  # noqa: BLE001 — reported as "not checked"
            return None, f"{type(exc).__name__}: {exc}".splitlines()[0]
        if fp is None:
            return None, ("no copy of it is on this machine, and prepare "
                          "downloads nothing")
        actual = sha256_file(fp)
        if actual != suite["sha256"]:
            return None, (f"the local copy {fp} hashes to {actual}, not the "
                          f"pinned {suite['sha256']}")
    cfg = RunConfig(corpus_path=str(fp))
    entries, _meta = load_corpus(cfg)
    return ([{"source": e.get(cfg.source_field, ""),
              "reference": e.get(cfg.target_field, "")} for e in entries],
            str(fp))


def sealed_overlap_findings(*, sealed_sets: list[tuple[str, list[dict]]],
                            public_sets: list[tuple[str, list[dict], tuple]],
                            ) -> list[dict]:
    """Every (sealed split, public set) pair with at least one shared row."""
    findings = []
    for sealed_id, sealed_rows in sealed_sets:
        if not sealed_rows:
            continue
        for public_id, public_rows, sides in public_sets:
            c = overlap_counts(sealed_rows, public_rows, sides=sides)
            if c["rows"]:
                findings.append({"sealed_set": sealed_id,
                                 "public_set": public_id, **c})
    return findings


def print_overlap_warnings(findings: list[dict],
                           unchecked: list[dict]) -> None:
    """Loud, counted, and specific — the organizer decides what to do."""
    if findings:
        print("\n  ⚠ SEALED ROWS THAT ARE ALREADY PUBLIC — a sealed set that is "
              "public is not sealed:")
        for f in findings:
            fuzzy = f["rows"] - f["exact"]
            print(f"    {f['sealed_set']}: {f['rows']} of {f['of']} rows also "
                  f"appear in {f['public_set']} ({f['by_source']} by source, "
                  f"{f['by_reference']} by reference; {f['exact']} exact"
                  + (f", {fuzzy} after normalizing case, punctuation and "
                     f"spacing" if fuzzy else "") + ").")
        print("    Anyone can read those rows, so scores on them measure "
              "recall of public text, not translation. Remove them from the "
              "master corpus (or drop the public set) and prepare again.")
    for u in unchecked:
        print(f"\n  ⚠ test suite {u['public_set']}: NOT checked for overlap "
              f"with the sealed sets — its sentences could not be read here "
              f"({u['reason']}). Pass --test-suite {u['public_set']}=<your "
              f"local copy> to check it.")


# ---------------------------------------------------------------------------
# Third-party diagnostic test suites (practice 14) — declared at prepare,
# frozen on the contest once entries exist (migration 074).
# ---------------------------------------------------------------------------

def resolve_test_suites(
    card_ids,
    *,
    language_pair: str,
    exclude_ids=(),
    registry_path=None,
) -> list[dict]:
    """Validate the organizer's ``--test-suite`` picks against the corpus
    registry and return the frozen ``metadata.test_suites`` blocks.

    A declared suite is a PROMISE to participants: "your method will also be
    run on this public diagnostic set, and the numbers will be reported".
    Every part of that promise has to be checkable by anyone, so each pick
    must be a registered PUBLIC corpus card that is
      * present in the registry (never an id we cannot resolve),
      * not quarantined (a quarantined corpus may never rank OR report),
      * pinned by a 64-hex sha256 of the exact bytes,
      * publicly locatable (a url) and attributable (a publisher),
      * for the contest's own language pair, and
      * NOT one of the contest's own corpora — a "third-party suite" that is
        the sealed set would be the contest scoring itself twice and calling
        the second one independent.

    Every failure is a refusal with the reason; nothing is skipped silently.
    """
    ids = [str(c).strip() for c in (card_ids or []) if str(c).strip()]
    if not ids:
        return []
    from mt_eval_harness.config import load_registry

    registry = load_registry(Path(registry_path) if registry_path else None)
    by_id = {e.get("id"): e for e in registry.get("datasets", [])}
    excluded = {str(x) for x in exclude_ids if x}

    suites: list[dict] = []
    seen: set[str] = set()
    for cid in ids:
        if cid in seen:
            raise ContestPrepError(
                f"--test-suite {cid} was declared twice — each diagnostic "
                f"suite is declared once.")
        seen.add(cid)
        if cid in excluded:
            raise ContestPrepError(
                f"--test-suite {cid} is one of THIS contest's own corpora "
                f"({', '.join(sorted(excluded))}). A declared test suite is a "
                f"third-party diagnostic set; the contest's own qualifier, "
                f"blind, secret or holdout split can never be one.")
        entry = by_id.get(cid)
        if entry is None:
            raise ContestPrepError(
                f"--test-suite {cid} is not in the corpus registry "
                f"({len(by_id):,} cards). Declare a registered public corpus "
                f"card id (`mt-eval list datasets`); an unresolvable id is a "
                f"promise nobody can check.")
        if entry.get("quarantine"):
            raise ContestPrepError(
                f"--test-suite {cid} is QUARANTINED "
                f"({entry.get('quarantine_reason') or 'no reason recorded'}) "
                f"— a quarantined corpus never ranks and never reports.")
        sha = str(entry.get("sha256") or "").strip().lower()
        if len(sha) != 64 or any(ch not in "0123456789abcdef" for ch in sha):
            raise ContestPrepError(
                f"--test-suite {cid} has no pinned sha256 in the registry "
                f"(got {entry.get('sha256')!r}). A declared suite is pinned "
                f"by the SHA-256 of the exact bytes — otherwise 'we ran your "
                f"method on suite X' names no particular X.")
        url = (str(entry.get("url") or "").strip()
               or str((entry.get("source_export") or {}).get("url") or "").strip())
        if not url:
            raise ContestPrepError(
                f"--test-suite {cid} carries no url in the registry (neither "
                f"`url` nor `source_export.url`) — a diagnostic suite has to "
                f"be publicly locatable for the report to mean anything.")
        publisher = (str(entry.get("source") or "").strip()
                     or str(entry.get("attribution") or "").strip())
        if not publisher:
            raise ContestPrepError(
                f"--test-suite {cid} names no publisher in the registry "
                f"(`source`/`attribution`) — a third-party suite is only "
                f"third-party if we say whose it is.")
        pair = entry.get("language_pair") or {}
        suite_pair = f"{pair.get('source', '')}>{pair.get('target', '')}"
        if suite_pair != language_pair:
            raise ContestPrepError(
                f"--test-suite {cid} is {suite_pair} but this contest is "
                f"{language_pair} — running a method on another pair's suite "
                f"would produce a number about nothing.")
        suite = {
            # suite_id and corpus_card_id coincide today (a suite IS a
            # registered card); 074 keeps them separate so a future suite can
            # name a documented subset of one card without renaming the card.
            "suite_id": cid,
            "corpus_card_id": cid,
            "publisher": publisher,
            "url": url,
            "sha256": sha,
        }
        missing = [k for k in TEST_SUITE_KEYS if not suite.get(k)]
        if missing:  # unreachable — the checks above cover every key
            raise ContestPrepError(
                f"--test-suite {cid} resolved without {missing} — migration "
                f"074 requires every key.")
        suites.append(suite)
    return suites


# ---------------------------------------------------------------------------
# The champollion CLI bridge (crypto single-sourced in cli/lib/seal.mjs).
# ---------------------------------------------------------------------------

def find_champollion_cli() -> list[str]:
    """Resolve the champollion CLI invocation as an argv list (shell-free).

    Order: $CHAMPOLLION_CLI (a path to cli.js or an executable), then the
    monorepo checkout's cli/bin/cli.js (walk up from this file), then a
    `champollion` on PATH. Fails loud when none is found — sealing cannot
    silently degrade to no encryption.
    """
    override = os.environ.get("CHAMPOLLION_CLI", "").strip()
    if override:
        p = Path(override)
        if p.suffix == ".js":
            return ["node", str(p)]
        return [str(p)]
    here = Path(__file__).resolve()
    for ancestor in here.parents:
        candidate = ancestor / "cli" / "bin" / "cli.js"
        if candidate.is_file():
            return ["node", str(candidate)]
    on_path = shutil.which("champollion")
    if on_path:
        return [on_path]
    raise ContestPrepError(
        "champollion CLI not found (needed for `seal-corpus`). Set "
        "CHAMPOLLION_CLI to cli/bin/cli.js or install the champollion "
        "package. Sealing never silently downgrades to plaintext.")


def seal_file_via_cli(
    *,
    plaintext_path: Path,
    card_id: str,
    custodian_group_id: str,
    threshold_pubkey: str,
    artifact_out: Path,
    card_block_out: Path,
    qualifier_id: Optional[str] = None,
    qualifier_threshold: Optional[float] = None,
) -> dict:
    """Seal a file via `champollion seal-corpus seal`; return the card block."""
    argv = find_champollion_cli() + [
        "seal-corpus", "seal",
        "--seal-input", str(plaintext_path),
        "--id", card_id,
        "--custodian-group", custodian_group_id,
        "--threshold-pubkey", threshold_pubkey,
        "--seal-out", str(artifact_out),
        "--card-block-out", str(card_block_out),
    ]
    if qualifier_id:
        argv += ["--qualifier-id", qualifier_id]
    if qualifier_threshold is not None:
        argv += ["--qualifier-threshold", str(qualifier_threshold)]
    proc = subprocess.run(argv, capture_output=True, text=True, timeout=120)
    if proc.returncode != 0:
        raise ContestPrepError(
            f"seal-corpus failed for {card_id}:\n{proc.stderr or proc.stdout}")
    return json.loads(card_block_out.read_text(encoding="utf-8"))


# ---------------------------------------------------------------------------
# Artifact preparation (fully offline — registration is a separate step).
# ---------------------------------------------------------------------------

#: What/why/fix when `contest prepare` is given no licence. The consequences
#: follow transmission_policy.resolve_transmission_policy: an entrant's run on
#: the released dev set is gated by the licence stamped on it.
LICENSE_REQUIRED_MESSAGE = (
    "--license is required: name the licence the released files (the public "
    "dev set, and any blind source) are offered under.\n"
    "  Why: the files carry it, and every entrant's run is gated by it. "
    "mt-eval will not choose a licence for someone else's data.\n"
    "  How to name one (an SPDX id, as the rights-holder grants it):\n"
    "    --license CC-BY-4.0        open; entrants may evaluate with any model "
    "service\n"
    "    --license CC-BY-NC-4.0     non-commercial; remote models only over "
    "no-training channels\n"
    "    --license LicenseRef-<your-terms>   your own terms; remote "
    "evaluation is refused until the rights-holder's permission is recorded, "
    "so entrants run local models\n"
    "  If the data is not yours to license, ask its steward first."
)

def dev_set_description(name: str, *, year, threshold, has_secret: bool,
                        has_holdout: bool, has_blind: bool) -> str:
    """The released dev set's own description: what clearing it admits to.

    Names only the sets this contest HAS, in the current vocabulary (the
    sealed set, the sealed holdout; the blind tier is an organizer diagnostic
    under R2, not an entry path), and states the threshold's scale. It used
    to say "gates scoring on the blind set" even with --blind-size 0
    (synthetic researcher persona, Round 2, 2026-10-03).
    """
    if has_secret:
        gated = ("the sealed set and the sealed holdout" if has_holdout
                 else "the sealed set")
        what = f"before the organizer's node runs it on {gated}"
    elif has_blind:
        gated = "the blind set (the organizer's diagnostic round)"
        what = f"before it is scored on {gated}"
    else:  # prepare refuses a contest with neither; kept total for callers
        what = "to qualify"
    return (f"{name} — public dev set / qualifier v{year}. Source and "
            f"references are public. A method must reach "
            f"{threshold_phrase(threshold)} on this set {what}.")


def _corpus_file(corpus_id: str, pair: tuple[str, str], entries: list[dict],
                 *, license_id: str, description: str,
                 fields: tuple[str, ...] = ("source", "reference"),
                 segment: Optional[str] = None,
                 terms: Optional[dict] = None) -> dict:
    """A self-describing harness-JSON corpus file (corpus_loader shape).

    The licence is ``dataset.license`` — the one envelope field every reader
    of a released file uses: the loader hands it to the transmission gate,
    and publish / ``contest qualify`` stamp it on the run card. It used to be
    written as ``dataset.provenance.license``, which none of them read: the
    released dev set ran as UNLICENSED ("NO-TRAIN corpus … no cleared license
    on the envelope") and qualify warned "has no recorded licence" although
    the organizer named one (synthetic researcher persona, Round 2,
    2026-10-03).
    """
    out_entries = []
    for i, e in enumerate(entries):
        row = {"id": i}
        for f in fields:
            row[f] = e.get(f, "")
        if segment:
            row["segment"] = segment
        out_entries.append(row)
    dataset = {
        "corpus_id": corpus_id,
        "version": "1.0",
        "language_pair": {"source": pair[0], "target": pair[1]},
        "description": description,
        "license": license_id,
    }
    # A RELEASED file states its training and transmission terms, read from
    # the master (release_terms) — the keys every reader of a file's own
    # envelope reads: the harness's transmission gate (``transmission``) and
    # the MCP plan (``do_not_train``). Round 13.
    if terms:
        if terms.get("do_not_train") is not None:
            dataset["do_not_train"] = bool(terms["do_not_train"])
        if terms.get("transmission"):
            dataset["transmission"] = terms["transmission"]
        sources = {k: terms[f"{k}_from"] for k in ("do_not_train", "transmission")
                   if terms.get(k) is not None and terms.get(f"{k}_from")}
        if sources:
            dataset["terms_from"] = sources
    return {"dataset": dataset, "entries": out_entries}


def master_release_terms(master_path, meta: dict | None = None) -> dict:
    """The training and transmission terms the MASTER corpus states about
    itself — what its released split must carry.

    Read, metadata only, from: the master's own envelope (``dataset``
    block), its steward sidecar (``<file>.champollion.json``) and the corpus
    card that sidecar names (what ``champollion network register-corpus``
    writes: ``doNotTrain``, ``license.spdx``, ``exposureTier``,
    ``usageRestrictions``). ``meta`` is the loader's merged metadata, if
    already loaded. Strictness only: any source saying do_not_train true or
    local-only makes it so. The released dev set used to state none of it —
    a do_not_train master gave a dev file the plan called "do_not_train
    unknown" (synthetic researcher, Round 13).
    """
    from mt_eval_harness.corpus_loader import (
        LOCAL_ONLY, read_steward_sidecar, registered_card)
    out = {"license": None, "license_from": None,
           "do_not_train": None, "do_not_train_from": None,
           "transmission": None, "transmission_from": None,
           "redistribution": None, "card": None}
    path = Path(str(master_path))
    docs: list[tuple[dict, str]] = []
    if path.suffix.lower() == ".json" and path.is_file():
        try:
            raw = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            raw = None
        if isinstance(raw, dict):
            block = raw.get("dataset") if isinstance(raw.get("dataset"), dict) else raw
            docs.append((block, f"the master's own envelope ({path.name})"))
    side = read_steward_sidecar(path)
    if side:
        docs.append((side, f"the master's steward sidecar ({path.name}.champollion.json)"))
    card = registered_card(path, side) if side else None
    if card is not None:
        try:
            card_doc = json.loads(Path(card["path"]).read_text(encoding="utf-8"))
        except (OSError, ValueError):
            card_doc = None
        if isinstance(card_doc, dict):
            docs.append((card_doc, f"the master's corpus card {card['id']}"))
            out["card"] = {"id": card["id"], "path": card["path"]}
    if meta and str(meta.get("transmission") or "").strip().lower() == LOCAL_ONLY:
        out["transmission"] = LOCAL_ONLY
        out["transmission_from"] = "the master's steward mark"
    for doc, where in docs:
        lic = doc.get("license")
        if isinstance(lic, dict):
            lic = lic.get("spdx")
        if out["license"] is None and isinstance(lic, str) and lic.strip():
            out["license"], out["license_from"] = lic.strip(), where
        dnt = doc.get("do_not_train", doc.get("doNotTrain"))
        if isinstance(dnt, bool) and out["do_not_train"] is not True:
            out["do_not_train"], out["do_not_train_from"] = dnt, where
        tier = str(doc.get("transmission") or doc.get("exposureTier") or "")
        if tier.strip().lower() == LOCAL_ONLY and out["transmission"] is None:
            out["transmission"], out["transmission_from"] = LOCAL_ONLY, where
        # Redistribution: the card's usageRestrictions.redistribution, else
        # its licence's own redistribution flag (register-corpus writes
        # license.redistribution from the licence and may leave
        # usageRestrictions absent or null). Strictness only: a prohibition
        # from any source replaces a permissive or unstated reading.
        usage = doc.get("usageRestrictions")
        found = None
        if isinstance(usage, dict) and usage.get("redistribution"):
            found = {"value": str(usage["redistribution"]), "from": where}
        elif isinstance(doc.get("license"), dict) \
                and _redistribution_prohibited(doc["license"].get("redistribution")):
            found = {"value": "prohibited",
                     "from": f"{where} (license.redistribution: false)"}
        if found and (out["redistribution"] is None or (
                _redistribution_prohibited(found["value"])
                and not _redistribution_prohibited(
                    out["redistribution"]["value"]))):
            out["redistribution"] = found
    return out


def _redistribution_prohibited(value) -> bool:
    """True for a redistribution term that forbids it: ``False`` (a
    licence's flag) or "prohibited" / "no" / "false"."""
    if value is False:
        return True
    return isinstance(value, str) and value.strip().lower() in (
        "prohibited", "no", "false")


def release_terms(master: dict, *, license_id: str,
                  do_not_train: Optional[bool]) -> dict:
    """The terms the RELEASED files carry: the organizer's licence, the
    master's do_not_train (the organizer may state it when the master does
    not, or tighten it — never loosen it) and the master's transmission mark.
    Raises :class:`ContestPrepError` on an attempt to loosen."""
    if master.get("do_not_train") is True and do_not_train is False:
        raise ContestPrepError(
            f"--do-not-train false loosens the master's own term: "
            f"{master['do_not_train_from']} says do_not_train: true, so text "
            f"cut from it stays evaluation-only. Only the rights-holder can "
            f"change that — on the master's card, not on the release.")
    if master.get("do_not_train") is True or do_not_train is True:
        dnt, dnt_from = True, (master.get("do_not_train_from")
                               if master.get("do_not_train") is True
                               else "--do-not-train true")
    elif do_not_train is False:
        dnt, dnt_from = False, "--do-not-train false"
    elif master.get("do_not_train") is False:
        dnt, dnt_from = False, master.get("do_not_train_from")
    else:
        dnt, dnt_from = None, None
    return {"license": license_id,
            "do_not_train": dnt, "do_not_train_from": dnt_from,
            "transmission": master.get("transmission"),
            "transmission_from": master.get("transmission_from"),
            "master_license": master.get("license"),
            "master_license_from": master.get("license_from"),
            "redistribution": master.get("redistribution"),
            "card": master.get("card")}


def release_terms_lines(terms: dict) -> list[str]:
    """What prepare prints about the released files' terms."""
    lines = ["  Released files' terms (written into each released file's "
             "dataset block):",
             f"    licence:       {terms['license']} (--license)"]
    ml = terms.get("master_license")
    if ml and ml != terms["license"]:
        lines.append(f"    ⚠ the master states {ml} ({terms['master_license_from']}) "
                     f"— only the rights-holder can offer its text under "
                     f"another licence; confirm {terms['license']} with them.")
    if terms["do_not_train"] is None:
        lines.append("    do_not_train:  not stated — the master's card does "
                     "not say; pass --do-not-train true|false to state it "
                     "(entrants' tools treat an unstated file as "
                     "evaluation-only)")
    else:
        lines.append(f"    do_not_train:  {str(terms['do_not_train']).lower()} "
                     f"(from {terms['do_not_train_from']})")
    if terms.get("transmission"):
        lines.append(f"    transmission:  {terms['transmission']} (from "
                     f"{terms['transmission_from']}) — entrants may run the "
                     f"dev set only with a model on their own machine")
    else:
        lines.append("    transmission:  no steward mark — the licence "
                     "decides which model services may see it")
    red = terms.get("redistribution")
    if red and _redistribution_prohibited(red.get("value")):
        lines.append(f"    ⚠ redistribution: {red['value']} ({red['from']}) — "
                     f"releasing public/ IS redistribution. Do not release it "
                     f"until the rights-holder agrees.")
    return lines


def prepare_contest(
    *,
    master_corpus_path: str | Path,
    slug: str,
    name: str,
    source_lang: str,
    target_lang: str,
    dev_size: int,
    blind_size: int = 0,
    secret_size: int = 0,
    holdout_size: int = 0,
    seed: int,
    qualifier_threshold: float,
    authorization_model: str = "per-submission",
    intake_daily_limit: int = 5,
    custodian_group_id: Optional[str] = None,
    threshold_pubkey: Optional[str] = None,
    plaintext_refs: bool = False,
    license_id: Optional[str] = None,
    do_not_train: Optional[bool] = None,
    year: Optional[int] = None,
    shared_task_id: Optional[str] = None,
    test_suites=(),
    registry_path=None,
    out_dir: str | Path,
) -> dict:
    """Split + write + seal all contest artifacts. Returns the manifest dict.

    Everything lands under ``out_dir``:
      public/  — what the organizer RELEASES (dev corpus incl. refs; blind
                 source side). Publishing these is the organizer's act.
      local/   — what NEVER leaves the organizer's machine (sealed refs
                 artifact + key block, the manifest, any plaintext refs if
                 --plaintext-refs). The plaintext refs file is DELETED after
                 sealing in the default path.

    Two tiers beyond the original ladder (2026-09-06):

    ``holdout_size`` carves a SECOND fully-sealed split (source AND refs) that
    is registered as its own ``sealed_sets`` row and named on the contest as
    ``metadata.sealed_holdout_set_id``. It is executed inside the SAME
    authorized run as the secret set (contract D1: one grant covers both) and
    its scores are always withheld until close. It is the public/private-split
    idea of a shared task (practice 7) with the private half never leaving the
    node.

    ``test_suites`` are third-party PUBLIC diagnostic corpora (practice 14),
    validated against the registry here and frozen on the contest. They are
    reported, never ranked.

    ``blind_size`` defaults to 0: under founder ruling R2 the blind
    (source-public) tier is retired as a contest tier and survives only as an
    optional ORGANIZER DIAGNOSTIC.
    """
    if authorization_model not in AUTHORIZATION_MODELS:
        raise ContestPrepError(
            f"authorization_model must be one of {AUTHORIZATION_MODELS} "
            f"(got {authorization_model!r}).")
    # --slug IS the contest id (contest_id_of): checked before anything is
    # written, because it is baked into every set id below and into the
    # receipts entrants write.
    from mt_eval_harness.contest import validate_contest_id
    try:
        slug = validate_contest_id(slug)
    except ValueError as exc:
        raise ContestPrepError(str(exc)) from exc
    # The released dev set (and any blind source) is stamped with this
    # licence. It used to default to CC-BY-4.0 — licensing someone's data on
    # their behalf, without asking (synthetic organizer persona, 2026-10-03).
    # A licence is the rights-holder's statement, so it is never defaulted.
    if not (license_id or "").strip():
        raise ContestPrepError(LICENSE_REQUIRED_MESSAGE)
    if qualifier_threshold is None or float(qualifier_threshold) <= 0:
        raise ContestPrepError(
            "--qualifier-threshold is required and must be > 0 — the "
            "threshold is contest data, never a code default.")
    if plaintext_refs and authorization_model == "per-submission":
        raise ContestPrepError(
            "--plaintext-refs cannot be combined with authorization_model="
            "'per-submission': a per-submission custody ceremony over refs "
            "stored unencrypted is security theater. Seal the refs (default) "
            "or choose 'blanket'/'open' and accept the honest weaker posture.")
    if not plaintext_refs:
        if not custodian_group_id:
            raise ContestPrepError(
                "--custodian-group is required to seal refs (an OPAQUE id — "
                "never a real nation/org name before consent).")
        if not threshold_pubkey:
            raise ContestPrepError(
                "--threshold-pubkey is required to seal refs (generate one "
                "with `champollion seal-corpus keygen`).")

    year = year or datetime.now(timezone.utc).year
    qualifier_id = build_qualifier_id(
        source=source_lang, target=target_lang, slug=slug, year=year)
    blind_id = f"eval-{source_lang}-{target_lang}-{slug}-blindtest-v1"
    secret_id = f"eval-{source_lang}-{target_lang}-{slug}-secret-v1"
    holdout_id = f"eval-{source_lang}-{target_lang}-{slug}-holdout-v1"
    pair = (source_lang, target_lang)
    language_pair = f"{source_lang}>{target_lang}"

    if not blind_size and not secret_size:
        raise ContestPrepError(
            "A contest needs a sealed set the node can execute methods "
            "against: pass --secret-size (the R2 method lane) and/or "
            "--blind-size (the retired organizer diagnostic). A qualifier "
            "alone is an admission gate with nothing behind it.")
    if holdout_size and not secret_size:
        raise ContestPrepError(
            "--sealed-holdout-size needs --secret-size: the holdout is the "
            "SECOND sealed split executed inside the same authorized run as "
            "the secret set. Without a secret set there is no run to attach "
            "it to.")
    if holdout_size and plaintext_refs:
        raise ContestPrepError(
            "--sealed-holdout-size requires sealing (the holdout's whole "
            "point is that neither its source nor its references are ever "
            "released) — drop --plaintext-refs or --sealed-holdout-size.")

    # Validate the declared third-party diagnostic suites BEFORE any file is
    # written: a bad suite id should cost the organizer nothing. A suite may
    # be given as ID=PATH — the organizer's local copy, used (pin-checked) for
    # the sealed-vs-public overlap check below.
    suite_ids, suite_paths = [], {}
    for item in test_suites or ():
        sid, sep, local = str(item).partition("=")
        sid = sid.strip()
        suite_ids.append(sid)
        if sep and local.strip():
            suite_paths[sid] = local.strip()
    resolved_suites = resolve_test_suites(
        suite_ids, language_pair=language_pair,
        exclude_ids=(qualifier_id, blind_id, secret_id, holdout_id),
        registry_path=registry_path)

    # Load the master corpus (harness JSON / JSONL / TSV via corpus_loader).
    from mt_eval_harness.config import RunConfig
    from mt_eval_harness.corpus_loader import load_corpus
    cfg = RunConfig(corpus_path=str(master_corpus_path),
                    source_lang=source_lang, target_lang=target_lang)
    entries, _meta = load_corpus(cfg)
    # Normalize to source/reference keys for the split output.
    norm = [{"source": e.get(cfg.source_field, ""),
             "reference": e.get(cfg.target_field, "")} for e in entries]
    # The released files carry the master's training and transmission terms
    # (Round 13) — resolved before anything is written, so a release that
    # would loosen them costs nothing.
    terms = release_terms(master_release_terms(master_corpus_path, _meta),
                          license_id=license_id, do_not_train=do_not_train)

    split_stats: dict = {}
    dev, blind, secret, holdout = split_corpus(
        norm, dev_size=dev_size, blind_size=blind_size,
        secret_size=secret_size, holdout_size=holdout_size, seed=seed,
        stats=split_stats)
    if secret_size and not secret:
        raise ContestPrepError("secret split unexpectedly empty")  # unreachable
    if holdout_size and not holdout:
        raise ContestPrepError("holdout split unexpectedly empty")  # unreachable

    # A sealed row that is also in a PUBLIC set is not sealed: the released
    # dev set (duplicates in the master corpus survive a disjoint split), the
    # blind source release, and every declared third-party suite. The Round 3
    # researcher's stand-in "private" set was a copy of the public suite it
    # declared, and nothing said so (2026-10-03). Warned, counted, recorded on
    # the manifest — the organizer decides; a suite that cannot be read here
    # is reported as NOT checked, never as clean.
    public_sets = [(f"the released dev set ({qualifier_id})", dev,
                    ("source", "reference"))]
    if blind:
        public_sets.append((f"the released blind source ({blind_id})", blind,
                            ("source",)))
    overlap_unchecked = []
    # Where each suite's pinned copy is on this machine (the ID=PATH given,
    # or a copy prepare found and hash-checked): recorded in the manifest so
    # `node init --from-contest` fills node.json's corpus_path instead of a
    # placeholder (Round 9 researcher). Organizer-local — never registered.
    suite_copies: dict[str, str] = {}
    for suite in resolved_suites:
        rows, how = _suite_entries(suite, suite_paths.get(suite["suite_id"]),
                                   registry_path=registry_path)
        if rows is None:
            overlap_unchecked.append({"public_set": suite["suite_id"],
                                      "reason": how})
        else:
            suite_copies[suite["suite_id"]] = str(Path(how).resolve())
            public_sets.append((f"test suite {suite['suite_id']}", rows,
                                ("source", "reference")))
    overlap_findings = sealed_overlap_findings(
        sealed_sets=[(secret_id, secret), (holdout_id, holdout)],
        public_sets=public_sets)
    print_overlap_warnings(overlap_findings, overlap_unchecked)

    out = Path(out_dir)
    public_dir = out / "public"
    local_dir = out / "local"
    public_dir.mkdir(parents=True, exist_ok=True)
    local_dir.mkdir(parents=True, exist_ok=True)
    # The releasable folder says so, for every tool that might write into it
    # (release_folder: mt-eval run and the MCP server keep run logs and
    # caches out of it — Round 13).
    from mt_eval_harness.release_folder import write_marker
    write_marker(public_dir, contest_id=slug)

    # --- T0: the public dev corpus (source + refs) = THE QUALIFIER ---------
    dev_path = public_dir / f"{qualifier_id}.json"
    dev_path.write_text(json.dumps(_corpus_file(
        qualifier_id, pair, dev,
        license_id=license_id, segment="dev", terms=terms,
        description=dev_set_description(
            name, year=year, threshold=qualifier_threshold,
            has_secret=bool(secret), has_holdout=bool(holdout),
            has_blind=bool(blind)),
    ), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    # --- T1 (OPTIONAL, organizer diagnostic): blind source release +
    #     organizer-local refs. Retired as a CONTEST tier by founder ruling R2
    #     (2026-09-06): an entry is a method handed to the sovereign node, not
    #     a file of translations. The code path stays because an organizer may
    #     still want a source-public diagnostic round of their own — it just
    #     is not how anyone enters the contest, and --blind-size 0 (the
    #     default) leaves it out entirely.
    blind_source_path = None
    refs_plain_path = None
    refs_plain_sha = None
    sealed_block = None
    refs_artifact_path = None
    if blind:
        blind_source_path = public_dir / f"{blind_id}.source.json"
        blind_source_path.write_text(json.dumps(_corpus_file(
            f"{blind_id}-source", pair, blind,
            license_id=license_id, fields=("source",), terms=terms,
            description=(f"{name} — blind test SOURCE side (ORGANIZER "
                         f"DIAGNOSTIC tier; not a contest entry path). "
                         f"References are withheld by the organizer."),
        ), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

        refs_plain_path = local_dir / f"{blind_id}.refs.json"
        refs_plain_path.write_text(json.dumps(_corpus_file(
            blind_id, pair, blind,
            license_id=license_id, segment="held_out",
            description=(f"{name} — blind test REFERENCES. ORGANIZER-LOCAL "
                         f"ONLY; never uploaded, never tracked, sealed at "
                         f"rest."),
        ), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        refs_plain_sha = sha256_file(refs_plain_path)

        if not plaintext_refs:
            refs_artifact_path = local_dir / f"{blind_id}.refs.sealed.json"
            sealed_block = seal_file_via_cli(
                plaintext_path=refs_plain_path,
                card_id=blind_id,
                custodian_group_id=custodian_group_id,
                threshold_pubkey=threshold_pubkey,
                artifact_out=refs_artifact_path,
                card_block_out=local_dir / f"{blind_id}.sealed-block.json",
                qualifier_id=qualifier_id,
                qualifier_threshold=float(qualifier_threshold),
            )
            refs_plain_path.unlink()  # sealed at rest — plaintext gone

    # --- T2 (optional): fully secret corpus, sealed source+refs ------------
    secret_block = None
    secret_artifact_path = None
    if secret:
        secret_plain_path = local_dir / f"{secret_id}.corpus.json"
        secret_plain_path.write_text(json.dumps(_corpus_file(
            secret_id, pair, secret,
            license_id=license_id, segment="gold_standard",
            description=(f"{name} — FULLY SECRET set (source AND references). "
                         f"Method-execution lane only (Phase B); no hypotheses "
                         f"intake exists for it because participants never "
                         f"see the source."),
        ), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        if plaintext_refs:
            raise ContestPrepError(
                "A T2 fully-secret split requires sealing (its whole point is "
                "that even the source is secret) — drop --plaintext-refs or "
                "--secret-size.")
        secret_artifact_path = local_dir / f"{secret_id}.corpus.sealed.json"
        secret_block = seal_file_via_cli(
            plaintext_path=secret_plain_path,
            card_id=secret_id,
            custodian_group_id=custodian_group_id,
            threshold_pubkey=threshold_pubkey,
            artifact_out=secret_artifact_path,
            card_block_out=local_dir / f"{secret_id}.sealed-block.json",
            qualifier_id=qualifier_id,
            qualifier_threshold=float(qualifier_threshold),
        )
        secret_plain_path.unlink()

    # --- HOLDOUT (optional): the SECOND sealed split ------------------------
    # Practice 7 (public/private split + final rerun), with the private half
    # never leaving the node. Same sealing as the secret set — source AND
    # references — because participants must never be able to tune against it.
    # Contract D1: it is executed inside the SAME authorized run as the secret
    # set, so there is one grant, one fingerprint, one audit trail.
    holdout_block = None
    holdout_artifact_path = None
    if holdout:
        holdout_plain_path = local_dir / f"{holdout_id}.corpus.json"
        holdout_plain_path.write_text(json.dumps(_corpus_file(
            holdout_id, pair, holdout,
            license_id=license_id, segment="gold_standard",
            description=(f"{name} — SEALED HOLDOUT split (source AND "
                         f"references). Executed in the same authorized run "
                         f"as the secret set; its scores are withheld until "
                         f"the contest closes."),
        ), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        holdout_artifact_path = local_dir / f"{holdout_id}.corpus.sealed.json"
        holdout_block = seal_file_via_cli(
            plaintext_path=holdout_plain_path,
            card_id=holdout_id,
            custodian_group_id=custodian_group_id,
            threshold_pubkey=threshold_pubkey,
            artifact_out=holdout_artifact_path,
            card_block_out=local_dir / f"{holdout_id}.sealed-block.json",
            qualifier_id=qualifier_id,
            qualifier_threshold=float(qualifier_threshold),
        )
        holdout_plain_path.unlink()

    manifest = {
        "prepared_at": datetime.now(timezone.utc).isoformat(),
        "_note": ("ORGANIZER-LOCAL manifest — reveals the split recipe; keep "
                  "off git and out of participant hands."),
        "contest": {
            # The contest's id (contests.id) — the --slug. Recorded so
            # register, node init --from-contest and every message read the
            # SAME value (contest_id_of); a manifest without it predates
            # 2026-10-03 and keeps the name-derived id it was registered
            # under.
            "id": slug,
            "slug": slug,
            "name": name,
            "language_pair": f"{source_lang}>{target_lang}",
            "authorization_model": authorization_model,
            "intake_daily_limit": intake_daily_limit,
            # The multi-pair edition umbrella (047) this per-pair contest
            # belongs to, or None for a standalone contest.
            "shared_task_id": shared_task_id,
        },
        "seed": seed,
        "sizes": {"dev": len(dev), "blind": len(blind), "secret": len(secret),
                  "holdout": len(holdout)},
        # How the split was made (group-disjoint/1): rows sharing a source or
        # a reference never straddle two tiers.
        "split": split_stats,
        "license": license_id,
        # The terms the released files carry, and where each was read.
        "release_terms": terms,
        # The marker that keeps run logs and caches out of public/.
        "releasable_dir": str(public_dir),
        # Practice 14: third-party diagnostic suites, validated against the
        # registry above and frozen on the contest at registration.
        "test_suites": resolved_suites,
        # suite_id → the pin-checked copy of it on the organizer's machine.
        # A separate key on purpose: contest_metadata_extra registers
        # test_suites, and a local path never leaves the organizer's machine.
        "test_suite_local_copies": suite_copies,
        # Sealed rows that also appear in a public set (counts only), and the
        # suites that could not be checked. Organizer-local, like the recipe.
        "sealed_overlap": {"findings": overlap_findings,
                           "unchecked": overlap_unchecked},
        "qualifier": {
            "qualifier_id": qualifier_id,
            "corpus_card_id": qualifier_id,
            "threshold": float(qualifier_threshold),
            # The qualifier gates on corpus chrF++ (scoring standard/1); the
            # qualifiers.metric column's DEFAULT 'composite' (migration 042)
            # is never relied on — the row always names its metric.
            "metric": QUALIFIER_METRIC,
            "year": year,
            "corpus_file": str(dev_path),
            "corpus_sha256": sha256_file(dev_path),
        },
        "blind": ({
            "sealed_set_id": blind_id,
            "source_release_file": str(blind_source_path),
            "source_release_sha256": sha256_file(blind_source_path),
            "refs_plaintext_sha256": refs_plain_sha,
            "refs_sealed_artifact": (str(refs_artifact_path)
                                     if refs_artifact_path else None),
            "refs_plaintext_file": (str(refs_plain_path)
                                    if plaintext_refs else None),
            "sealed_block": sealed_block,
            "lane": "ORGANIZER DIAGNOSTIC (retired as a contest tier, R2)",
        } if blind else None),
        "secret": ({
            "sealed_set_id": secret_id,
            "corpus_sealed_artifact": str(secret_artifact_path),
            "sealed_block": secret_block,
            "lane": "secret-set method lanes (Phase B: declarative model + sandbox)",
        } if secret else None),
        "holdout": ({
            "sealed_set_id": holdout_id,
            "corpus_sealed_artifact": str(holdout_artifact_path),
            "sealed_block": holdout_block,
            "role": "holdout",
            "lane": ("second sealed split — same authorized run as the "
                     "secret set (D1); scores withheld until close"),
        } if holdout else None),
        "custodian_group_id": custodian_group_id,
    }
    manifest_path = local_dir / "manifest.json"
    manifest_path.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8")
    manifest["manifest_path"] = str(manifest_path)
    return manifest


# ---------------------------------------------------------------------------
# Registration — the Supabase (dev branch) writes. Separate from preparation
# so artifacts can be produced fully offline and inspected first.
# ---------------------------------------------------------------------------

def sealed_registrations(manifest: dict) -> list[tuple[str, dict]]:
    """Every sealed set this manifest registers, in write order:
    blind (if the diagnostic tier was prepared and sealed), secret, holdout.

    A tier present in the manifest but carrying no ``sealed_block`` was
    prepared with --plaintext-refs and is deliberately NOT registered.
    """
    rows: list[tuple[str, dict]] = []
    for key in ("blind", "secret", "holdout"):
        tier = manifest.get(key) or {}
        if tier.get("sealed_block"):
            rows.append((tier["sealed_set_id"], tier["sealed_block"]))
    return rows


def contest_id_of(manifest: dict) -> str:
    """The contest id a prepared manifest registers under — ONE answer for
    register, ``node init --from-contest`` and every printed hint.

    Canonical (manifests written since 2026-10-03): ``contest.id``, the
    ``--slug`` given to `contest prepare`. A manifest without it predates the
    change; its contest was (or would have been) registered under the id
    derived from its NAME (``contest._slugify``), and receipts and node
    configs already written use that id, so it is kept for those manifests
    rather than silently moved to the slug.
    """
    contest = manifest.get("contest") or {}
    cid = str(contest.get("id") or "").strip()
    if cid:
        return cid
    from mt_eval_harness.contest import _slugify
    return _slugify(str(contest.get("name") or contest.get("slug") or ""))


def contest_id_is_legacy(manifest: dict) -> bool:
    """True for a manifest written before ``contest.id`` was recorded — its
    id is name-derived (see :func:`contest_id_of`)."""
    return not str(((manifest.get("contest") or {}).get("id")) or "").strip()


def contest_corpus_id(manifest: dict) -> str:
    """The sealed set the CONTEST is registered against (``contests.corpus_id``).

    Under founder ruling R2 that is the SECRET set — the set the organizer's
    node executes handed-over methods on. The blind set is the fallback for a
    diagnostic-only contest prepared before R2, and the public qualifier the
    last resort for a contest with nothing sealed at all.
    """
    secret = manifest.get("secret") or {}
    if secret.get("sealed_set_id"):
        return secret["sealed_set_id"]
    blind = manifest.get("blind") or {}
    if blind.get("sealed_block") and blind.get("sealed_set_id"):
        return blind["sealed_set_id"]
    return manifest["qualifier"]["corpus_card_id"]


def contest_metadata_extra(manifest: dict) -> dict:
    """The ``contests.metadata`` keys prepare declares: the sealed holdout set
    and the third-party diagnostic suites. Both are participant-facing
    PROMISES frozen by migration 074 the moment the contest has entries, so
    they are written once, at registration, and never edited afterwards."""
    extra: dict = {}
    holdout = manifest.get("holdout") or {}
    if holdout.get("sealed_set_id"):
        extra["sealed_holdout_set_id"] = holdout["sealed_set_id"]
    suites = manifest.get("test_suites") or []
    if suites:
        extra["test_suites"] = suites
    return extra


def _write_contest_metadata(contest_id: str, extra: dict, *, request) -> None:
    """Merge ``extra`` into ``contests.metadata`` (a JSONB PATCH REPLACES the
    column, so the merge happens client-side over a fresh read).

    ``request(method, path, params=..., data=...)`` is the caller's own REST
    lane — the service key for `register_prepared`, the organizer's session
    for the self-serve door. A contest row that cannot be read back is a loud
    failure: silently dropping a declared holdout or suite would leave the
    organizer believing a promise the database never recorded.
    """
    if not extra:
        return
    rows = request("GET", "contests",
                   params={"id": f"eq.{contest_id}", "select": "metadata"})
    if not rows:
        raise RuntimeError(
            f"Could not read contest {contest_id} back to record "
            f"{sorted(extra)} in metadata — the row is not visible to this "
            f"identity. Nothing was written; re-run registration once the "
            f"contest is readable rather than leaving a declared holdout or "
            f"test suite unrecorded.")
    current = rows[0].get("metadata")
    merged = dict(current) if isinstance(current, dict) else {}
    merged.update(extra)
    request("PATCH", "contests", params={"id": f"eq.{contest_id}"},
            data={"metadata": merged})


def _declared_power(manifest: dict, primary_metric: str | None,
                    power_pilot: list | None) -> dict | None:
    """The sealed test's declared power, from the prepared manifest's size.

    None when the contest has no sealed test (a blind-only preparation) —
    there is then no sealed test size to state.
    """
    n = int(((manifest.get("sizes") or {}).get("secret")) or 0)
    if n < 1:
        return None
    from mt_eval_harness.contest_rank import DEFAULT_PRIMARY_METRIC, canonical_metric
    from mt_eval_harness.power import declare_test_power
    return declare_test_power(
        n, canonical_metric(primary_metric or DEFAULT_PRIMARY_METRIC),
        pilot_reports=power_pilot)


# ---------------------------------------------------------------------------
# Registration choices made at prepare time with --no-register.
#
# `contest prepare` accepts every registration flag (--results-visibility,
# --anonymize-until-close, --primary-metric, the prize flags, …) because it
# can register in the same call. With --no-register nothing is registered —
# and those flags used to vanish: `contest register` later created the
# contest with its OWN defaults, so a `--results-visibility immediate` the
# organizer typed at prepare time was silently not what the contest promised
# (synthetic researcher, Round 4). They are now recorded in the organizer-local
# manifest's "registration" block, and `contest register` applies them unless
# its own flags say otherwise (and says so when they do).
# ---------------------------------------------------------------------------

#: The registration choices a prepared manifest can carry, with the value
#: each takes when neither prepare recorded one nor register was given one.
REGISTRATION_DEFAULTS: dict = {
    "visibility": "public",
    "use_context": "non-commercial",
    "description": "",
    "open_intake": True,
    "primary_metric": "chrf_plus_plus",
    "metric_model": None,
    "results_visibility": DEFAULT_RESULTS_VISIBILITY,
    "anonymize_until_close": False,
    "prize_terms": None,
    "power_pilot": None,
}


#: When each registration term stops being changeable — what the database
#: enforces, said where the organizer chooses it. `contest prepare` recorded
#: use_context=non-commercial and visibility=public without a word, and its
#: --help named no default (synthetic researcher, Round 12).
REGISTRATION_FREEZE: dict = {
    "use_context": ("fixed at registration: part of the contest's identity, "
                    "which the database never lets change (migration 072)"),
    "visibility": ("not frozen by the database (no mt-eval command changes "
                   "it after registration)"),
    "primary_metric": ("frozen once the contest has its first entry "
                       "(migration 072)"),
    "metric_model": ("frozen with the metric signature once the contest has "
                     "its first entry (migration 076)"),
    "results_visibility": ("a promise: frozen once the contest has its first "
                           "entry (migration 074)"),
    "anonymize_until_close": ("a promise: frozen once the contest has its "
                              "first entry (migration 074)"),
    "prize_terms": ("a promise: frozen once the contest has its first entry "
                    "(migration 074)"),
    "power_pilot": ("its declared power is frozen once the contest has its "
                    "first entry (migration 076)"),
    "open_intake": ("not frozen (`mt-eval contest open-intake` / "
                    "`close-intake`)"),
    "description": "not frozen",
}


def registration_term_lines(block: dict, given: set | frozenset,
                            *, registered: bool) -> list[str]:
    """The registration terms a prepare/register records, one line each:
    the effective value, whether it was GIVEN on this command line or is the
    DEFAULT, and when it stops being changeable (:data:`REGISTRATION_FREEZE`).
    ``registered``: whether this command registered the contest (else the
    values are only recorded, and `contest register` may still change them).
    """
    def shown(key: str) -> str:
        value = block.get(key)
        if key == "prize_terms":
            return "declared" if value else "none (no prize)"
        if key == "open_intake":
            return "open" if value else "closed"
        if key == "description":
            return repr(value) if value else "(none)"
        if key == "metric_model":
            return value or "none (a model-scored primary metric needs one)"
        if key == "power_pilot":
            return "two pilot reports" if value else "none"
        return str(value)

    order = ("use_context", "visibility", "primary_metric",
             "results_visibility", "anonymize_until_close", "prize_terms",
             "open_intake", "description")
    keys = list(order) + [k for k in ("metric_model", "power_pilot")
                          if block.get(k) or k in given]
    import textwrap
    width = max(len(k) for k in keys)
    lines = textwrap.wrap(
        ("Contest terms registered" if registered
         else "Contest terms recorded for registration (`contest register` "
              "may still change them; nothing is registered yet)")
        + " — given = on this command line, default = not given:",
        width=96, initial_indent="  ", subsequent_indent="    ")
    for key in keys:
        origin = "given" if key in given else "default"
        lines.extend(textwrap.wrap(
            f"{key:<{width}}  {shown(key)} ({origin}) — "
            f"{REGISTRATION_FREEZE[key]}", width=96, initial_indent="    ",
            subsequent_indent=" " * (6 + width), break_on_hyphens=False))
    return lines


def record_registration_choices(manifest: dict, choices: dict) -> dict:
    """Write ``choices`` into the manifest's ``registration`` block (in
    memory and in ``manifest_path`` on disk); returns the block written.

    Only REGISTRATION_DEFAULTS keys are kept. The block is organizer-local
    like the rest of the manifest — registration sends only the content-free
    values themselves."""
    block = {k: choices.get(k, REGISTRATION_DEFAULTS[k])
             for k in REGISTRATION_DEFAULTS}
    if block.get("primary_metric"):
        # A NEW contest may not promise a retired ranking metric (the
        # composite, scoring standard/1) — refused before it is recorded,
        # not later at `contest register`.
        from mt_eval_harness.contest_rank import canonical_metric
        from mt_eval_harness.rankable_metrics import refuse_retired_for_new
        refuse_retired_for_new(canonical_metric(block["primary_metric"]))
    manifest["registration"] = block
    path = manifest.get("manifest_path")
    if path:
        on_disk = json.loads(Path(path).read_text(encoding="utf-8"))
        on_disk["registration"] = block
        Path(path).write_text(
            json.dumps(on_disk, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8")
    return block


def resolve_registration_choices(manifest: dict,
                                 explicit: dict) -> tuple[dict, list[str]]:
    """The registration values `contest register` applies, and notes.

    ``explicit`` maps each REGISTRATION_DEFAULTS key to the value given on
    register's command line, or None when the flag was not given. Order:
    the register flag, then what prepare recorded, then the default. A
    register flag that changes a recorded value is allowed (nothing is
    registered yet, so nothing is weakened) but named in the notes."""
    recorded = manifest.get("registration") or {}
    resolved: dict = {}
    notes: list[str] = []
    for key, default in REGISTRATION_DEFAULTS.items():
        given = explicit.get(key)
        if given is not None:
            if key in recorded and recorded[key] != given:
                notes.append(f"{key}: {given!r} from this command replaces "
                             f"{recorded[key]!r}, which `contest prepare` "
                             f"recorded in the manifest")
            resolved[key] = given
        elif key in recorded:
            resolved[key] = recorded[key]
            if recorded[key] != default:
                notes.append(f"{key}: {recorded[key]!r}, as `contest "
                             f"prepare` recorded it in the manifest")
        else:
            resolved[key] = default
    return resolved, notes


def _note_legacy_contest_id(manifest: dict) -> None:
    """Say which id a pre-2026-10-03 manifest registers under, and why."""
    if contest_id_is_legacy(manifest):
        contest = manifest.get("contest") or {}
        print(f"  Note: this manifest predates recording the contest id, so "
              f"it registers under the id derived from its name, "
              f"{contest_id_of(manifest)!r} (receipts and node configs "
              f"already written use that one). A contest prepared now uses "
              f"its --slug ({contest.get('slug')!r} here) as the id.")


# ---------------------------------------------------------------------------
# The registration payload — built in ONE place. Both registrars send these
# rows, and `contest prepare --no-register` prints them as the registration
# plan, so the plan an organizer reviews is what registration sends. It used
# to print the contest id, qualifier and recorded flags but not the sealed-set
# rows or digests that go on the public record (synthetic researcher, Round
# 11). Every row is content-free: ids, digests, thresholds, policy.
# ---------------------------------------------------------------------------

#: created_by in a plan printed before anyone has signed in. The self-serve
#: registrar fills in the JWT email (migrations 046/052).
SIGN_IN_PLACEHOLDER = "<your sign-in email>"


def sealed_set_rows(manifest: dict, *,
                    created_by: str | None = None) -> list[dict]:
    """The ``sealed_sets`` rows registration POSTs (037/046), one per sealed
    tier, in write order. ``created_by`` None is the service-key lane (the
    table defaults apply: born quarantined, created_by NULL); an email is the
    self-serve lane — identity-bound and explicitly born quarantined.

    NEVER a datasets row (022 would then block the score publishes — see the
    module docstring)."""
    q = manifest["qualifier"]
    contest = manifest["contest"]
    src, tgt = contest["language_pair"].split(">")
    rows = []
    for set_id, block in sealed_registrations(manifest):
        row = {
            "sealed_set_id": set_id,
            "ciphertext_digest": block["ciphertextDigest"],
            "cipher": block["cipher"],
            "key_scheme": block.get("keyScheme"),
            "custodian_group_id": manifest["custodian_group_id"],
            "current_qualifier_id": q["qualifier_id"],
            "source_lang": src,
            "target_lang": tgt,
            "language_pair": contest["language_pair"],
        }
        if created_by is not None:
            row["quarantined"] = True
        row["status"] = "active"
        row["sealed_at"] = manifest["prepared_at"]
        if created_by is not None:
            row["created_by"] = created_by
        rows.append(row)
    return rows


def qualifier_row(manifest: dict, *, created_by: str | None = None) -> dict:
    """The ``qualifiers`` row (042/046) — the data half of the dev-set gate.
    It back-points at the set it gates, which under R2 is the contest's own
    sealed set (the secret set the node executes methods on)."""
    q = manifest["qualifier"]
    row = {
        "qualifier_id": q["qualifier_id"],
        "corpus_card_id": q["corpus_card_id"],
        "sealed_set_id": (contest_corpus_id(manifest)
                          if sealed_registrations(manifest) else None),
        "threshold": q["threshold"],
        "metric": q["metric"],
        "year": q["year"],
        "status": "active",
    }
    if created_by is not None:
        row["created_by"] = created_by
    return row


def contest_policy_patch(manifest: dict, *, open_intake: bool) -> dict:
    """The policy columns (043) and edition membership (047) PATCHed onto the
    contest after it is created. Both doors send the same patch: the
    self-serve door used to leave out ``shared_task_id``, so `contest
    register` silently dropped the edition `contest prepare --shared-task`
    recorded (the 047 FK still validates it; 072 lets it attach once)."""
    contest = manifest["contest"]
    patch = {
        "authorization_model": contest["authorization_model"],
        "intake_daily_limit": contest["intake_daily_limit"],
        "intake_open": bool(open_intake),
    }
    if contest.get("shared_task_id"):
        patch["shared_task_id"] = contest["shared_task_id"]
    return patch


def prepared_contest_args(manifest: dict, choices: dict) -> dict:
    """The ``contest.create_contest`` keyword arguments a prepared manifest
    registers with, from the registration ``choices`` (REGISTRATION_DEFAULTS
    keys)."""
    contest = manifest["contest"]
    return {
        "name": contest["name"],
        "contest_id": contest_id_of(manifest),
        "corpus_id": contest_corpus_id(manifest),
        "language_pair": contest["language_pair"],
        "visibility": choices["visibility"],
        "description": choices["description"],
        "use_context": choices["use_context"],
        "primary_metric": choices["primary_metric"],
        "results_visibility": choices["results_visibility"],
        "anonymize_until_close": bool(choices["anonymize_until_close"]),
        "metric_model": choices["metric_model"],
        "declared_power": _declared_power(manifest, choices["primary_metric"],
                                          choices["power_pilot"]),
    }


def _choices(**given) -> dict:
    """A registrar's keyword arguments as registration choices."""
    return {k: given.get(k, REGISTRATION_DEFAULTS[k])
            for k in REGISTRATION_DEFAULTS}


def registration_plan(manifest: dict, choices: dict, *,
                      created_by: str = SIGN_IN_PLACEHOLDER) -> list[dict]:
    """Every write `contest register --manifest` makes, in order, built by
    the same functions the registrars send with:

        [{"table", "method", "key", "row", "note"}, ...]

    ``method`` is POST, PATCH, or "MERGE" (read ``contests.metadata``,
    merge ``row`` into it, PATCH it back — _write_contest_metadata).
    ``choices`` are the registration choices (``record_registration_choices``
    / ``resolve_registration_choices``). The contest row is built by
    ``contest.contest_row`` exactly as create_contest builds it; its lane is
    the one create_contest resolves once step 1's sealed-set registration
    exists. Content-free by construction: no row carries a sentence."""
    from mt_eval_harness.contest import (
        computation_promise, contest_row, validate_contest_id,
    )
    sizes = manifest.get("sizes") or {}
    tier_of = {(manifest.get(k) or {}).get("sealed_set_id"): k
               for k in ("blind", "secret", "holdout")}
    steps: list[dict] = []
    for row in sealed_set_rows(manifest, created_by=created_by):
        n = sizes.get(tier_of.get(row["sealed_set_id"]) or "")
        steps.append({
            "table": "sealed_sets", "method": "POST",
            "key": row["sealed_set_id"], "row": row,
            "note": (f"{n} sealed row{'' if n == 1 else 's'} stay"
                     f"{'s' if n == 1 else ''} on this machine; only the "
                     f"sha256 of the ciphertext is sent" if n is not None else
                     "the sealed rows stay on this machine; only the sha256 "
                     "of the ciphertext is sent")})
    qrow = qualifier_row(manifest, created_by=created_by)
    n_dev = sizes.get("dev")
    steps.append({
        "table": "qualifiers", "method": "POST", "key": qrow["qualifier_id"],
        "row": qrow,
        "note": (f"the gate on the dev set you release"
                 + (f" ({n_dev} public rows; not sent)" if n_dev is not None
                    else "")
                 + f"; threshold on the chrF++ 0-100 qualifier scale")})
    args = prepared_contest_args(manifest, choices)
    primary, signature, harness = computation_promise(
        args["primary_metric"], args["metric_model"])
    sealed = bool(sealed_registrations(manifest))
    crow = contest_row(
        contest_id=validate_contest_id(args["contest_id"]),
        name=args["name"], description=args["description"],
        corpus_id=args["corpus_id"], language_pair=args["language_pair"],
        visibility=args["visibility"], teams=None, created_by=created_by,
        use_context=args["use_context"],
        lane="sealed" if sealed else "standard",
        primary_metric=primary, metric_signature=signature,
        harness_version=harness, declared_power=args["declared_power"],
        results_visibility=args["results_visibility"],
        anonymize_until_close=args["anonymize_until_close"])
    steps.append({
        "table": "contests", "method": "POST", "key": crow["id"], "row": crow,
        "note": ("lane sealed: resolved from the sealed-set registration "
                 "above" if sealed else
                 "standard lane: nothing sealed is registered")})
    steps.append({
        "table": "contests", "method": "PATCH", "key": crow["id"],
        "row": contest_policy_patch(manifest,
                                    open_intake=choices["open_intake"]),
        "note": "policy columns"})
    extra = contest_metadata_extra(manifest)
    if extra:
        steps.append({
            "table": "contests", "method": "MERGE", "key": crow["id"],
            "row": extra,
            "note": "the declared promises"})
    if choices.get("prize_terms"):
        steps.append({
            "table": "contests", "method": "MERGE", "key": crow["id"],
            "row": {"prize_terms": choices["prize_terms"]},
            "note": "the declared prize terms"})
    return steps


def format_registration_plan(steps: list[dict]) -> str:
    """The plan as the organizer reads it: every field of every row, in
    write order. Values are printed whole (a digest is never shortened —
    it is what the organizer checks the public registry against later)."""
    def _value(v) -> str:
        if isinstance(v, str) and v:
            return v
        return json.dumps(v, ensure_ascii=False)

    verbs = {"POST": "insert", "PATCH": "update", "MERGE": "merge into"}
    lines = ["    Registration plan — every row `contest register` sends, "
             "in order (nothing has been sent):"]
    for i, step in enumerate(steps, 1):
        target = ("contests.metadata" if step["method"] == "MERGE"
                  else step["table"])
        lines.append(f"      {i}. {verbs[step['method']]} {target} — "
                     f"{step['key']}  ({step['note']})")
        width = max(len(k) for k in step["row"]) if step["row"] else 0
        for k, v in step["row"].items():
            suffix = ("  (sha256 of the ciphertext)"
                      if k == "ciphertext_digest" else "")
            lines.append(f"           {k:<{width}}  {_value(v)}{suffix}")
    n_sealed = sum(1 for s in steps if s["table"] == "sealed_sets")
    lines.append(
        f"    {len(steps)} writes: {n_sealed} sealed set(s), 1 qualifier, 1 "
        f"contest. Content-free: no sentence of any split is in them — the "
        f"sealed sets go on the record as ciphertext digests. created_by "
        f"is the account you sign in with. (Re-running prepare with the "
        f"service key instead sends the same rows, except that the "
        f"sealed_sets and qualifiers rows carry no created_by or quarantined "
        f"— the table defaults apply.)")
    return "\n".join(lines)


def register_prepared(manifest: dict, *, visibility: str = "public",
                      use_context: str = "non-commercial",
                      description: str = "", open_intake: bool = True,
                      primary_metric: str | None = None,
                      results_visibility: str = DEFAULT_RESULTS_VISIBILITY,
                      anonymize_until_close: bool = False,
                      metric_model: str | None = None,
                      power_pilot: list | None = None) -> dict:
    """Register a prepared contest: qualifier row, sealed set(s), contest row,
    policy columns. Content-free rows only. Service key + (for the contest)
    the organizer's OAuth session. ``primary_metric`` is recorded on the
    contest as ``metadata.primary_metric`` (the metric `contest rank` /
    `close` use; default chrF++).

    ``results_visibility`` and ``anonymize_until_close`` are the two PROMISES
    contract C5 hangs on, and they are passed straight through to
    ``contest.create_contest`` with its own defaults — a prepared contest can
    declare them at registration instead of needing a second write. Migration
    074 freezes both the moment the contest has an entry, so they cannot be
    set later on a running contest; declaring them here is the only way a
    prepared contest gets them."""
    from mt_eval_harness.sovereign_service import service_request

    q = manifest["qualifier"]
    contest = manifest["contest"]
    sealed_rows = sealed_registrations(manifest)
    choices = _choices(
        visibility=visibility, use_context=use_context,
        description=description, open_intake=open_intake,
        primary_metric=primary_metric, metric_model=metric_model,
        results_visibility=results_visibility,
        anonymize_until_close=anonymize_until_close, power_pilot=power_pilot)

    # 1. sealed_sets registrations (037) — content-free; quarantined defaults
    #    true in that table. NEVER a datasets row (022 would then block the
    #    score publishes themselves — see module docstring).
    idempotent = "return=representation,resolution=ignore-duplicates"
    for row in sealed_set_rows(manifest):
        service_request("POST", "sealed_sets", data=row, prefer=idempotent)

    # 2. The qualifier row (042) — the data half of the dev-set gate.
    service_request("POST", "qualifiers", data=qualifier_row(manifest),
                    prefer=idempotent)

    # 3. The contest itself (008/041; lane auto-resolves 'sealed' now that the
    #    registration exists). Uses the organizer's OAuth session.
    _note_legacy_contest_id(manifest)
    from mt_eval_harness.contest import create_contest
    record = create_contest(**prepared_contest_args(manifest, choices))

    # 4. Policy columns (043) + edition membership (047) — service-role PATCH
    #    (one-way triggers don't apply to contests; RLS just restricts who may
    #    write). The shared_task_id FK fails loud if the edition row is missing.
    service_request("PATCH", "contests", params={
        "id": f"eq.{record['id']}",
    }, data=contest_policy_patch(manifest, open_intake=open_intake))

    # 5. The declared PROMISES (074): the sealed holdout set and the
    #    third-party diagnostic suites, merged into contests.metadata.
    _write_contest_metadata(record["id"], contest_metadata_extra(manifest),
                            request=service_request)

    print(f"\n  ✅ Registered: contest {record['id']} "
          f"(authorization_model={contest['authorization_model']}, "
          f"intake {'OPEN' if open_intake else 'closed'})")
    if contest.get("shared_task_id"):
        print(f"     Edition: attached to shared task {contest['shared_task_id']}")
    print(f"     Qualifier {q['qualifier_id']} @ threshold "
          f"{threshold_phrase(q['threshold'])}")
    for set_id, block in sealed_rows:
        print(f"     Sealed set {set_id} digest {block['ciphertextDigest'][:16]}…")
    _print_declarations(manifest)
    return record


def _print_declarations(manifest: dict) -> None:
    """Say out loud what the contest just promised participants."""
    holdout = manifest.get("holdout") or {}
    if holdout.get("sealed_set_id"):
        print(f"     Sealed HOLDOUT {holdout['sealed_set_id']} — executed in "
              f"the same authorized run; scores withheld until close")
    for suite in manifest.get("test_suites") or []:
        print(f"     Test suite {suite['suite_id']} "
              f"({suite['publisher']}, sha {suite['sha256'][:12]}…) — "
              f"reported, never ranked")


def register_prepared_self_serve(manifest: dict, *, visibility: str = "public",
                                 use_context: str = "non-commercial",
                                 description: str = "",
                                 open_intake: bool = True,
                                 primary_metric: str | None = None,
                                 results_visibility: str = DEFAULT_RESULTS_VISIBILITY,
                                 anonymize_until_close: bool = False,
                                 metric_model: str | None = None,
                                 power_pilot: list | None = None) -> dict:
    """Register a prepared contest through the migration-046 self-serve door:
    the organizer's OWN OAuth session, no service key (gap G3 of
    docs/SHARED_TASK_HOSTING_MODES.md — the AmericasNLP onboarding path).

    Same content-free rows and order as register_prepared. Every registry row
    is identity-bound: created_by = the JWT email, which is what the 046 RLS
    policies admit and what the qualifiers ownership check compares — a
    qualifier may only gate a sealed set the SAME identity registered. The
    contest row binds the owner email too (create_contest always stamps the
    JWT email since migration 052), so the 043 policy PATCH goes through the
    008 owner-update policy with the same session. Registration is idempotent for the registry rows
    (resolution=ignore-duplicates) and tolerant of an already-created contest,
    so a partially-registered contest can be re-run to completion.
    """
    from mt_eval_harness.contest import _api_request
    from mt_eval_harness.auth import get_session, get_submitter_email
    # Same prod refusal as the service lane: the sovereign tables (and the
    # 046 door) exist only on the dev/staging branch.
    from mt_eval_harness.sovereign_service import assert_not_prod
    assert_not_prod()

    try:
        session = get_session()
    except SystemExit as exc:
        # What works for THIS command (the generic sign-in refusal names no
        # command's flags — it used to suggest --no-publish, which register
        # does not have).
        raise SystemExit(
            f"{exc}\n  Registering needs that sign-in: the contest row lives "
            f"in the contest database and there is no anonymous "
            f"registration. Nothing is lost meanwhile — the prepared manifest "
            f"keeps every value, so run `mt-eval contest register --manifest "
            f"<out>/local/manifest.json` again once this machine is signed "
            f"in.") from exc
    email = get_submitter_email(session)

    q = manifest["qualifier"]
    contest = manifest["contest"]
    sealed_rows = sealed_registrations(manifest)
    choices = _choices(
        visibility=visibility, use_context=use_context,
        description=description, open_intake=open_intake,
        primary_metric=primary_metric, metric_model=metric_model,
        results_visibility=results_visibility,
        anonymize_until_close=anonymize_until_close, power_pilot=power_pilot)

    # 1. sealed_sets registrations (037/046) — content-free; born quarantined
    #    (the trigger pins it beneath us anyway); NEVER a datasets row (022
    #    would then block the score publishes — see module docstring).
    idempotent = "return=representation,resolution=ignore-duplicates"
    for row in sealed_set_rows(manifest, created_by=email):
        _api_request("POST", "sealed_sets", data=row, session=session,
                     prefer=idempotent)

    # 2. The qualifier row (042/046) — born active; the ownership check binds
    #    it to the sealed set registered above under the same identity.
    _api_request("POST", "qualifiers",
                 data=qualifier_row(manifest, created_by=email),
                 session=session, prefer=idempotent)

    # 3. The contest itself (008/041/052) — the same OAuth session;
    #    create_contest always stamps the JWT email, so step 4's PATCH passes
    #    the 008 owner-update policy. An already-existing contest (a re-run)
    #    is not an error IF it is ours — step 4 proves ownership either way.
    _note_legacy_contest_id(manifest)
    from mt_eval_harness.contest import create_contest
    try:
        record = create_contest(**prepared_contest_args(manifest, choices))
    except RuntimeError as exc:
        if "409" not in str(exc):
            raise
        record = {"id": contest_id_of(manifest)}
        print(f"  Contest {record['id']} already exists — continuing to the "
              f"policy update (ownership is proven by the PATCH).")

    # 4. Policy columns (043) — through the 008 owner-update policy with the
    #    organizer's own session. Zero rows back means the row is not ours
    #    (or created_by holds a display identity): fail loud, never silently
    #    leave a contest with default policy.
    patched = _api_request("PATCH", "contests", params={
        "id": f"eq.{record['id']}",
    }, data=contest_policy_patch(manifest, open_intake=open_intake),
       session=session)
    if not patched:
        raise RuntimeError(
            f"Could not set the policy columns on contest {record['id']}: "
            f"the owner-update policy matched no row for {email}. The "
            f"contest was created under a different identity — if it "
            f"predates the self-serve lane, ask the curator to align "
            f"contests.created_by with your sign-in email."
        )

    # 5. The declared PROMISES (074) — same session, same owner-update policy.
    _write_contest_metadata(
        record["id"], contest_metadata_extra(manifest),
        request=lambda method, path, **kw: _api_request(
            method, path, session=session, **kw))

    print(f"\n  ✅ Self-serve registered: contest {record['id']} as {email} "
          f"(authorization_model={contest['authorization_model']}, "
          f"intake {'OPEN' if open_intake else 'closed'})")
    print(f"     Qualifier {q['qualifier_id']} @ threshold "
          f"{threshold_phrase(q['threshold'])}")
    for set_id, block in sealed_rows:
        print(f"     Sealed set {set_id} digest {block['ciphertextDigest'][:16]}…")
    _print_declarations(manifest)
    print("     No service key was used — rows are identity-bound to your "
          "sign-in (migration 046). Rotation/retirement remain "
          "curator-mediated for now.")
    return record
