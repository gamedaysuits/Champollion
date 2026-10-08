#!/usr/bin/env python3
"""contest_beta.py — the end-to-end proof that a SOVEREIGN CONTEST works.

Founder ruling R2 (2026-09-06): a contest IS sovereign hosting. An entry is a
MODEL (Lane A, ``submit-model``) or a METHOD (Lane B, ``submit-method``)
handed to the organizer's own node, which executes it against a sealed set on
its own machine and publishes the score it measured itself. Uploading
translations (``submit-hypotheses``) and linking a self-reported card
(``contest submit``) are retired and deleted. The open leaderboard — the
public board indexed by corpus × pair direction — is a different thing and is
not a contest.

This script drives that whole shape ON THE LOCAL SUPABASE STACK, for real:

    contest prepare/register  → a sealed contest with declared promises
    contest qualify           → the public admission receipt (self-scored)
    contest submit-method ×3  → primary + contrastive + an out-of-track entry
    node approve / run-method → Docker, --network=none, qualifier re-executed
                                on this node BEFORE any grant is claimed
    (results deferred)        → hidden_until_close: run_cards does not move
    contest rank              → pseudonyms, deferred count, declared terms
    contest close             → publishes the withheld cards, then freezes
    contest rank / export     → the frozen ranking, json + csv

…and, as first-class assertions, the REFUSALS that make those promises real:

    * a second close;
    * ``rank --reveal-identities`` from someone who does not own the contest;
    * ``submit-method`` with no qualifier receipt;
    * a bundle that accepted the WRONG prize-terms hash (node-side BLOCK);
    * a prize-terms override the declared disposition does not offer;
    * an entry whose ``--track`` is outside the contest's ``allowed_tracks``
      (excluded from the ranking, with the reason printed).

Every assertion names what it checked. The first failure exits 2 with the
step name. ``--json-out`` writes the machine-readable report; ``--cleanup``
deletes the rows and objects this run created, and only those.

Targets
-------
``--target local`` is the only live target: the loopback stack in the Lima
organizer guest (``limactl shell champollion-organizer``), where Docker and a
from-nothing 001→074 database exist. ``--target prod`` REFUSES: under R2 a
contest is sovereign hosting, so the contest lane is proven on the local
stack and never rehearsed against the live project.

    limactl shell champollion-organizer -- bash -lc \\
      'cd ~/src/champollion/arena && ~/.venvs/mt-eval/bin/python \\
       scripts/contest_beta.py --target local --json-out ~/beta-report.json --cleanup'

Nothing is tracked: the synthetic qaa>qab corpus (ISO 639-2 reserved
local-use codes, invented words, no real language content) is generated at
run time, and the Lane B entry is ``arena/examples/lane-b-toy-method``, whose
rule reproduces that corpus exactly — it proves the pipe, not MT quality.
"""
from __future__ import annotations

import argparse
import json
import os
import random
import re
import secrets
import shutil
import subprocess
import sys
import traceback
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

# Runnable from a checkout without installation: arena/ is the parent.
ARENA_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ARENA_DIR))

SLUG_PREFIX = "zzbeta"
PROD_HOST = "sjdomynysdljkbemupqa.supabase.co"
TOY_EXAMPLE = ARENA_DIR / "examples" / "lane-b-toy-method"
QUALIFIER_THRESHOLD = 35.0
PRIZE_DISPOSITION = "retain_ip"
ALLOWED_TRACKS = ["constrained"]

# The synthetic language. qaa/qab are ISO 639-2 codes RESERVED for local use,
# so no real language is misrepresented; the words are invented.
_HEADS = ["mira", "kani", "veno", "tolu", "sira", "pelo", "nuka", "vera",
          "loma", "tesu", "rina", "dako", "menu", "sabi", "kuro", "fela",
          "gida", "hora", "iven", "juno", "kade", "lumi", "nera", "obik"]
_TAILS = ["sol", "luna", "pira", "keno", "vasu", "doro", "miko", "sela",
          "tano", "buri", "ceni", "davo", "efim", "gulo", "hane", "ivor",
          "jaku", "kilo", "moro", "nusa", "opal", "puno", "reso", "tivu"]
_EXTRA = ["volu", "telo", "selu", "vira", "nomu", "tira", "beso", "ludo"]


class StageFailure(RuntimeError):
    """A stage assertion that failed — always with the reason."""


# ---------------------------------------------------------------------------
# The synthetic corpus and the toy rule (the same rule the example implements)
# ---------------------------------------------------------------------------

def toy_translate(line: str) -> str:
    """``w1 w2 w3…`` → ``w2 w1vo`` — the rule examples/lane-b-toy-method runs."""
    words = line.split()
    return f"{words[1]} {words[0]}vo" if len(words) >= 2 else line.strip()


def synthetic_master(n: int, *, seed: int) -> list[dict]:
    """``n`` toy pairs, generated at run time. Nothing is tracked."""
    rng = random.Random(seed)
    seen: set[str] = set()
    entries: list[dict] = []
    while len(entries) < n:
        source = f"{rng.choice(_HEADS)} {rng.choice(_TAILS)} {rng.choice(_EXTRA)}"
        if source in seen:
            continue
        seen.add(source)
        entries.append({"id": len(entries), "source": source,
                        "reference": toy_translate(source)})
    return entries


# ---------------------------------------------------------------------------
# Target + environment — refuse before any network call
# ---------------------------------------------------------------------------

def resolve_target(target: str) -> dict:
    """``local`` is the only live target. Anything else refuses, with R2."""
    if target == "prod":
        raise StageFailure(
            "--target prod is REFUSED. Founder ruling R2 (2026-09-06): a "
            "contest is sovereign hosting — entries are executed by the "
            "organizer's own air-gapped node against a sealed set that never "
            "leaves that machine. There is nothing about that lane that a "
            "write to the live shared project would prove, and this script "
            "would have to publish real run cards on the public board to try. "
            "The contest lane is validated on the local stack "
            "(--target local). There is no live-project counterpart: the "
            "live smoke was removed on 2026-09-07 rather than pointed at "
            "prod (founder call).")
    if target == "dev":
        raise StageFailure(
            "--target dev is REFUSED. The dev branch has no Docker to execute "
            "a Lane B entry in and no organizer node attached to it, so a run "
            "there would prove the database half and silently skip the half "
            "that matters. Use --target local (the Lima organizer guest).")
    if target != "local":
        raise StageFailure(f"unknown target {target!r}")
    return {"target": target}


def _read_status_env(path: Path) -> dict:
    kv: dict[str, str] = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        m = re.match(r'^([A-Z_]+)="?(.*?)"?$', line.strip())
        if m:
            kv[m.group(1)] = m.group(2)
    return kv


def resolve_stack(status_env: str | None) -> dict:
    """The loopback Supabase this run drives: URL, anon key, service key.

    Environment first (``MT_EVAL_SUPABASE_URL`` / ``_ANON_KEY`` /
    ``_SERVICE_KEY``), then the ``status.env`` the local-stack reset writes
    (``~/supabase-out/status.env`` — what ``rehearse.sh supabase`` produces).
    A non-loopback URL is a refusal: this script creates contests, executes
    containers and deletes rows.
    """
    url = os.environ.get("MT_EVAL_SUPABASE_URL", "").strip()
    anon = os.environ.get("MT_EVAL_SUPABASE_ANON_KEY", "").strip()
    service = os.environ.get("MT_EVAL_SUPABASE_SERVICE_KEY", "").strip()
    source = "environment"
    if not (url and anon and service):
        candidate = Path(status_env).expanduser() if status_env else (
            Path.home() / "supabase-out" / "status.env")
        if not candidate.exists():
            raise StageFailure(
                f"No local Supabase configured: set MT_EVAL_SUPABASE_URL / "
                f"_ANON_KEY / _SERVICE_KEY, or bring the stack up so "
                f"{candidate} exists (mt-eval-arena/supabase-local/reset.sh, "
                f"i.e. `rehearse.sh supabase` in the organizer guest).")
        kv = _read_status_env(candidate)
        url = url or kv.get("API_URL") or kv.get("SUPABASE_URL") or ""
        anon = anon or kv.get("ANON_KEY") or kv.get("PUBLISHABLE_KEY") or ""
        service = (service or kv.get("SERVICE_ROLE_KEY")
                   or kv.get("SECRET_KEY") or "")
        source = str(candidate)
    if not (url and anon and service):
        raise StageFailure(
            f"Incomplete Supabase config from {source}: need an API URL, an "
            f"anon key and a service-role key (the node writes as the "
            f"service role).")
    host = urlparse(url).hostname or ""
    if PROD_HOST in url or host not in ("127.0.0.1", "localhost", "::1"):
        raise StageFailure(
            f"Refusing: MT_EVAL_SUPABASE_URL is not loopback ({url}). This "
            f"script only ever drives the local stack.")
    return {"url": url, "anon": anon, "service": service, "source": source}


# ---------------------------------------------------------------------------
# REST + identity on the local stack
# ---------------------------------------------------------------------------

def rest(stack: dict, path: str, *, method: str = "GET", body=None,
         service: bool = True, prefer: str | None = None):
    key = stack["service"] if service else stack["anon"]
    headers = {"apikey": key, "Authorization": f"Bearer {key}",
               "Accept": "application/json"}
    if body is not None:
        headers["Content-Type"] = "application/json"
    if prefer:
        headers["Prefer"] = prefer
    req = urllib.request.Request(
        stack["url"] + path, method=method,
        data=json.dumps(body).encode() if body is not None else None,
        headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            raw = resp.read().decode()
            return json.loads(raw) if raw.strip() else None
    except urllib.error.HTTPError as exc:
        raise StageFailure(
            f"{method} {path} → HTTP {exc.code}: {exc.read().decode()[:600]}")


def signup(stack: dict, email: str, password: str) -> str:
    """Sign an identity up on the local GoTrue; return its refresh token."""
    payload = json.dumps({"email": email, "password": password}).encode()
    headers = {"apikey": stack["anon"], "Content-Type": "application/json"}
    for path in ("/auth/v1/signup", "/auth/v1/token?grant_type=password"):
        req = urllib.request.Request(stack["url"] + path, method="POST",
                                     data=payload, headers=headers)
        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                doc = json.loads(resp.read().decode())
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode()[:400]
            if path.endswith("signup") and "already" in detail.lower():
                continue  # existing user from an earlier run → password grant
            raise StageFailure(f"{path} for {email} → HTTP {exc.code}: {detail}")
        token = doc.get("refresh_token")
        if not token:
            raise StageFailure(
                f"{path} for {email} returned no refresh_token "
                f"(keys: {sorted(doc)})")
        return token
    raise StageFailure(f"could not obtain a session for {email}")


def identity_env(stack: dict, run_dir: Path, name: str, token: str) -> dict:
    """A complete subprocess environment for one signed-in identity."""
    env = dict(os.environ)
    env.update({
        "MT_EVAL_SUPABASE_URL": stack["url"],
        "MT_EVAL_SUPABASE_ANON_KEY": stack["anon"],
        "MT_EVAL_SUPABASE_SERVICE_KEY": stack["service"],
        "SUPABASE_SERVICE_KEY": stack["service"],
        "MT_EVAL_TOKEN_PATH": str(run_dir / f"auth-{name}.json"),
        "MT_EVAL_REFRESH_TOKEN": token,
        "PYTHONPATH": str(ARENA_DIR),
    })
    return env


def cli(env: dict, argv: list[str], *, timeout: int = 1800,
        expect_failure: bool = False) -> tuple[int, str]:
    """Run `mt-eval …` as a subprocess. Returns (rc, stdout+stderr)."""
    proc = subprocess.run(
        [sys.executable, "-m", "mt_eval_harness.cli", *argv],
        capture_output=True, text=True, cwd=str(ARENA_DIR), env=env,
        timeout=timeout)
    out = (proc.stdout or "") + (proc.stderr or "")
    if proc.returncode != 0 and not expect_failure:
        raise StageFailure(
            f"`mt-eval {' '.join(argv[:3])}…` exited {proc.returncode}:\n"
            f"{out[-2500:]}")
    if proc.returncode == 0 and expect_failure:
        raise StageFailure(
            f"`mt-eval {' '.join(argv[:3])}…` SUCCEEDED but was expected to "
            f"refuse:\n{out[-2500:]}")
    return proc.returncode, out


def cli_json(env: dict, argv: list[str], *, timeout: int = 900) -> dict:
    """Run a `--json` verb and parse STDOUT alone — banners go to stderr and
    must never end up inside the parsed document."""
    proc = subprocess.run(
        [sys.executable, "-m", "mt_eval_harness.cli", *argv],
        capture_output=True, text=True, cwd=str(ARENA_DIR), env=env,
        timeout=timeout)
    if proc.returncode != 0:
        raise StageFailure(
            f"`mt-eval {' '.join(argv[:3])}… --json` exited "
            f"{proc.returncode}:\n{(proc.stderr or '')[-2000:]}")
    try:
        return json.loads(proc.stdout)
    except json.JSONDecodeError as exc:
        raise StageFailure(
            f"`mt-eval {' '.join(argv[:3])}… --json` did not print pure JSON "
            f"on stdout ({exc}); head={proc.stdout[:300]!r}") from exc


# ---------------------------------------------------------------------------
# Stage plumbing
# ---------------------------------------------------------------------------

class Report:
    def __init__(self, runid: str, target: str, out_dir: Path):
        self.doc: dict = {
            "runid": runid, "target": target, "out_dir": str(out_dir),
            "started_at": datetime.now(timezone.utc).isoformat(
                timespec="seconds"),
            "stages": [], "contest_id": None, "refusals": [],
            "created": {}, "cleanup": None, "ok": False,
        }

    def stage(self, name: str, fn, *args, **kwargs):
        started = datetime.now(timezone.utc).isoformat(timespec="seconds")
        try:
            detail = fn(*args, **kwargs)
        except Exception as exc:  # noqa: BLE001 — recorded, then re-raised
            self.doc["stages"].append({
                "name": name, "status": "FAIL", "at": started,
                "detail": f"{type(exc).__name__}: {exc}"})
            print(f"  ✗ {name}: {type(exc).__name__}: {exc}", file=sys.stderr)
            raise
        self.doc["stages"].append({"name": name, "status": "PASS",
                                   "at": started, "detail": detail})
        print(f"  ✓ {name}: {detail}")
        return detail

    def refusal(self, what: str, message: str) -> None:
        self.doc["refusals"].append({"what": what,
                                     "message": message.strip()[:1200]})


def _first_line(text: str, needle: str) -> str:
    for line in text.splitlines():
        if needle in line:
            return line.strip()
    return text.strip().splitlines()[-1] if text.strip() else ""


# ---------------------------------------------------------------------------
# The run
# ---------------------------------------------------------------------------

def run(args: argparse.Namespace) -> dict:
    runid = (datetime.now(timezone.utc).strftime("%Y%m%d")
             + "-" + secrets.token_hex(3))
    slug = f"{SLUG_PREFIX}-{runid}"
    out_dir = Path(args.out_dir or (Path.home() / ".mt-eval" / "contest-beta"
                                    / runid)).expanduser()
    out_dir.mkdir(parents=True, exist_ok=True)
    report = Report(runid, args.target, out_dir)
    S: dict = {"slug": slug, "out_dir": out_dir}

    try:
        report.stage("target", resolve_target, args.target)
        report.stage("stack", lambda: _stack_stage(args, S))
        stack = S["stack"]
        report.stage("docker", _docker_stage)
        report.stage("corpus", lambda: _corpus_stage(S, out_dir))
        report.stage("identities", lambda: _identities_stage(stack, S, out_dir))
        report.stage("keypair", lambda: _keypair_stage(S, out_dir))
        report.stage("prepare", lambda: _prepare_stage(S, out_dir))
        report.stage("register", lambda: _register_stage(S))
        report.stage("declare-promises", lambda: _promises_stage(stack, S))
        report.stage("refuse-unoffered-prize-override",
                     lambda: _refuse_unoffered_override(report, S))
        report.stage("node-config", lambda: _node_config_stage(S, out_dir))
        report.stage("refuse-submit-without-receipt",
                     lambda: _refuse_no_receipt(report, S))
        report.stage("qualify", lambda: _qualify_stage(S, out_dir))
        report.stage("refuse-wrong-terms-hash-at-submit",
                     lambda: _refuse_wrong_terms_client(report, S))
        report.stage("refuse-wrong-terms-hash-on-node",
                     lambda: _refuse_wrong_terms_node(report, S, out_dir))
        report.stage("submit-entries", lambda: _submit_stage(S, out_dir))
        report.stage("execute-entries", lambda: _execute_stage(stack, S))
        report.stage("assert-deferred", lambda: _deferred_stage(stack, S))
        report.stage("rank-open", lambda: _rank_open_stage(S, out_dir))
        report.stage("refuse-reveal-without-ownership",
                     lambda: _refuse_reveal(report, S))
        report.stage("close", lambda: _close_stage(stack, S))
        report.stage("refuse-second-close",
                     lambda: _refuse_second_close(report, S))
        report.stage("rank-closed", lambda: _rank_closed_stage(S, out_dir))
        report.stage("export", lambda: _export_stage(S, out_dir))
        report.doc["ok"] = True
    except Exception:  # noqa: BLE001
        report.doc["ok"] = False
        report.doc["traceback"] = traceback.format_exc()
    finally:
        report.doc["contest_id"] = S.get("contest_id")
        report.doc["created"] = {
            "contest_id": S.get("contest_id"),
            "sealed_set_ids": S.get("sealed_set_ids", []),
            "qualifier_id": S.get("qualifier_id"),
            "run_card_ids": S.get("published_card_ids", []),
            "request_ids": [e["request_id"] for e in S.get("entries", [])
                            if e.get("request_id")],
        }
        report.doc["cleanup"] = _cleanup(args, S)
        report.doc["finished_at"] = datetime.now(timezone.utc).isoformat(
            timespec="seconds")
        (out_dir / "contest_beta_report.json").write_text(
            json.dumps(report.doc, indent=2, ensure_ascii=False),
            encoding="utf-8")
        if args.json_out:
            Path(args.json_out).expanduser().write_text(
                json.dumps(report.doc, indent=2, ensure_ascii=False),
                encoding="utf-8")
    return report.doc


# --- stages ----------------------------------------------------------------

def _stack_stage(args, S):
    stack = resolve_stack(args.status_env)
    S["stack"] = stack
    # Set BEFORE any mt_eval_harness import: auth.py reads the URL, the anon
    # key and the token path at import time.
    os.environ.update({
        "MT_EVAL_SUPABASE_URL": stack["url"],
        "MT_EVAL_SUPABASE_ANON_KEY": stack["anon"],
        "MT_EVAL_SUPABASE_SERVICE_KEY": stack["service"],
        "SUPABASE_SERVICE_KEY": stack["service"],
    })
    # Reachability + the 074 table this run depends on, checked once, here.
    rest(stack, "/rest/v1/contests?select=id&limit=1")
    rest(stack, "/rest/v1/contest_deferred_results?select=request_id&limit=1")
    S["run_cards_before"] = len(
        rest(stack, "/rest/v1/run_cards?select=id") or [])
    return (f"{stack['url']} (from {stack['source']}); contests and "
            f"contest_deferred_results (074) reachable; "
            f"{S['run_cards_before']} run_cards already on this stack")


def _docker_stage():
    docker = shutil.which("docker")
    if not docker:
        raise StageFailure(
            "docker is not on PATH. A Lane B entry is executed in a container "
            "with --network=none; without a runtime there is no contest to "
            "prove. Run this inside the organizer guest "
            "(limactl shell champollion-organizer).")
    proc = subprocess.run([docker, "info", "--format", "{{.ServerVersion}}"],
                          capture_output=True, text=True, timeout=120)
    if proc.returncode != 0:
        raise StageFailure(
            f"`docker info` failed ({proc.returncode}): "
            f"{(proc.stderr or '').strip()[:400]}")
    return f"docker server {proc.stdout.strip()}"


def _corpus_stage(S, out_dir):
    entries = synthetic_master(24, seed=20260907)  # 8 public dev + 16 sealed
    doc = {
        "dataset": {
            "corpus_id": f"eval-qaa-qab-{S['slug']}-master",
            "version": "1.0",
            "language_pair": {"source": "qaa", "target": "qab"},
            "description": ("SYNTHETIC contest_beta master — invented toy "
                            "pairs over ISO 639-2 local-use codes, generated "
                            "at run time, never tracked."),
            "provenance": {"license": "CC0-1.0"},
        },
        "entries": entries,
    }
    path = out_dir / "master.json"
    path.write_text(json.dumps(doc, ensure_ascii=False, indent=2) + "\n",
                    encoding="utf-8")
    S["master"] = path
    return f"{len(entries)} synthetic qaa>qab pairs at {path.name}"


def _identities_stage(stack, S, out_dir):
    people = {
        "organizer": f"organizer+{S['slug']}@example.test",
        "entrant1": f"entrant1+{S['slug']}@example.test",
        "entrant2": f"entrant2+{S['slug']}@example.test",
    }
    envs = {}
    for name, email in people.items():
        token = signup(stack, email, "contest-beta-pass-2026")
        envs[name] = identity_env(stack, out_dir, name, token)
    S["emails"] = people
    S["envs"] = envs
    # The in-process half (prepare/register) runs as the ORGANIZER.
    os.environ["MT_EVAL_TOKEN_PATH"] = envs["organizer"]["MT_EVAL_TOKEN_PATH"]
    os.environ["MT_EVAL_REFRESH_TOKEN"] = envs["organizer"][
        "MT_EVAL_REFRESH_TOKEN"]
    import mt_eval_harness.auth as auth
    auth.TOKEN_PATH = Path(os.environ["MT_EVAL_TOKEN_PATH"])
    return ", ".join(f"{k}={v}" for k, v in people.items())


def _keypair_stage(S, out_dir):
    """The organizer's own sealing keypair.

    A WAVE-1 STAND-IN — one X25519 keypair, not an M-of-N group key. That is
    the honest shape for an organizer node holding its own sealed set on one
    machine; the threshold ceremony is the air-gapped node's lane
    (sovereign_rehearsal.py --role airgap).
    """
    from mt_eval_harness.contest_prep import find_champollion_cli
    keys = out_dir / "keys"
    keys.mkdir(exist_ok=True)
    argv = find_champollion_cli() + ["seal-corpus", "keygen", "--out", str(keys)]
    proc = subprocess.run(argv, capture_output=True, text=True, timeout=300)
    if proc.returncode != 0:
        raise StageFailure(
            f"seal-corpus keygen exited {proc.returncode}: "
            f"{(proc.stderr or proc.stdout)[-600:]}")
    pub = next(iter(sorted(keys.glob("threshold-*.pub.json"))), None)
    priv = next(iter(sorted(keys.glob("threshold-*.key.json"))), None)
    if not pub or not priv:
        raise StageFailure(f"keygen wrote no keypair into {keys}")
    S["pubkey"], S["privkey"] = pub, priv
    return f"single-key stand-in {pub.name} (private key mode 600, local only)"


def _prepare_stage(S, out_dir):
    from mt_eval_harness.contest_prep import prepare_contest
    manifest = prepare_contest(
        master_corpus_path=S["master"],
        slug=S["slug"],
        name=f"contest_beta {S['slug']}",
        source_lang="qaa", target_lang="qab",
        dev_size=8, blind_size=0, secret_size=16,
        seed=20260907,
        qualifier_threshold=QUALIFIER_THRESHOLD,
        authorization_model="per-submission",
        intake_daily_limit=20,
        custodian_group_id="contest-beta-council",
        threshold_pubkey=str(S["pubkey"]),
        license_id="CC0-1.0",
        year=2026,
        out_dir=out_dir / "contest",
    )
    S["manifest"] = manifest
    S["dev_corpus"] = Path(manifest["qualifier"]["corpus_file"])
    S["qualifier_id"] = manifest["qualifier"]["qualifier_id"]
    secret = manifest["secret"]
    S["secret_set_id"] = secret["sealed_set_id"]
    S["secret_artifact"] = Path(secret["corpus_sealed_artifact"])
    if manifest["blind"] is not None:
        raise StageFailure(
            "prepare produced a blind tier — R2 retired it as a contest tier "
            "and this run asked for none (blind_size=0).")
    return (f"dev {manifest['sizes']['dev']} (public) + secret "
            f"{manifest['sizes']['secret']} (sealed as {S['secret_set_id']})")


def _register_stage(S):
    from mt_eval_harness.contest_prep import register_prepared
    record = register_prepared(
        S["manifest"],
        visibility="public",
        use_context="non-commercial",
        description="contest_beta local-stack run — synthetic, safe to delete",
        open_intake=True,
        primary_metric="chrf_plus_plus",
        results_visibility="hidden_until_close",
        anonymize_until_close=True,
    )
    S["contest_id"] = record["id"]
    S["sealed_set_ids"] = [sid for sid, _ in _sealed_ids(S["manifest"])]
    if record.get("lane") != "sealed":
        raise StageFailure(
            f"contest {record['id']} registered in lane {record.get('lane')!r} "
            f"— a sovereign contest must be in the sealed lane (041).")
    return (f"contest {record['id']} lane=sealed, hidden_until_close, "
            f"anonymize_until_close")


def _sealed_ids(manifest):
    from mt_eval_harness.contest_prep import sealed_registrations
    return sealed_registrations(manifest)


def _promises_stage(stack, S):
    """The two promises this run adds on top of registration: the declared
    PRIZE TERM (``retain_ip`` — founder ruling R1-trinary, 2026-09-07) and the
    allowed entry tracks.

    The stored form is the DECLARED spelling (the disposition plus only the
    overrides it allows); the derived detail is asserted here so a silent
    change to the derivation table cannot pass this beta.
    """
    from mt_eval_harness.contest_prep import _write_contest_metadata
    from mt_eval_harness.contest_prize_terms import (
        DISPOSITION_DERIVED, declared_prize_terms, describe,
        normalize_prize_terms, prize_gate, terms_sha256,
    )
    from mt_eval_harness.sovereign_service import service_request
    terms = declared_prize_terms({"disposition": PRIZE_DISPOSITION})
    derived = normalize_prize_terms(terms)
    expected = dict(DISPOSITION_DERIVED[PRIZE_DISPOSITION],
                    disposition=PRIZE_DISPOSITION)
    if derived != expected:
        raise StageFailure(
            f"disposition {PRIZE_DISPOSITION} derived {derived}, expected "
            f"{expected}")
    gate = prize_gate(derived)
    if gate != ["handover_verified"]:
        raise StageFailure(
            f"disposition {PRIZE_DISPOSITION} requires payout verifications "
            f"{gate}, expected ['handover_verified'] — nothing moves under "
            f"retain_ip, so the host can only be asked to show what it ran.")
    S["prize_terms"] = terms
    S["prize_terms_derived"] = derived
    S["terms_sha"] = terms_sha256(terms)
    S["terms_text"] = describe(terms)
    _write_contest_metadata(
        S["contest_id"],
        {"prize_terms": terms, "allowed_tracks": list(ALLOWED_TRACKS)},
        request=service_request)
    row = rest(stack, f"/rest/v1/contests?id=eq.{S['contest_id']}"
                      f"&select=metadata")[0]
    md = row.get("metadata") or {}
    if md.get("prize_terms") != terms:
        raise StageFailure(f"prize_terms not recorded: {md.get('prize_terms')}")
    if md.get("allowed_tracks") != ALLOWED_TRACKS:
        raise StageFailure(
            f"allowed_tracks not recorded: {md.get('allowed_tracks')}")
    if md.get("results_visibility") != "hidden_until_close":
        raise StageFailure(
            f"results_visibility is {md.get('results_visibility')!r}, "
            f"expected hidden_until_close")
    if not md.get("anonymize_until_close"):
        raise StageFailure("anonymize_until_close not recorded")
    return (f"disposition {PRIZE_DISPOSITION} (derived "
            + " ".join(f"{k}={v}" for k, v in S["prize_terms_derived"].items()
                       if k != "disposition")
            + f"), gate ['handover_verified'], sha256 "
              f"{S['terms_sha'][:16]}…, allowed_tracks={ALLOWED_TRACKS}")


def _node_config_stage(S, out_dir):
    """The organizer's node.json — the method lane only.

    No ``refs_*`` entry: the hypotheses drain is retired (R2), and this node
    exists to execute handed-over entries against the sealed secret set.
    """
    cpus = min(2, os.cpu_count() or 1)
    cfg = {
        "_note": ("contest_beta local-stack node — single-key custody, a "
                  "WAVE-1 stand-in. The threshold ceremony is the air-gapped "
                  "node's lane."),
        "node_id": f"contest-beta-{S['slug']}",
        "poll_seconds": 5,
        "scratch_dir": str(out_dir / "node-scratch"),
        "output_dir": str(out_dir / "node-runs"),
        "grant_ttl_seconds": 3600,
        "sandbox": {"cpus": cpus},
        "contests": {
            S["contest_id"]: {
                "dev_corpus": str(S["dev_corpus"]),
                "secret_set_id": S["secret_set_id"],
                "secret_artifact": str(S["secret_artifact"]),
                "secret_privkey": str(S["privkey"]),
                "custody": "single-key",
                "corpus_version": "v1",
            }
        },
    }
    path = out_dir / "node.json"
    path.write_text(json.dumps(cfg, indent=2) + "\n", encoding="utf-8")
    S["node_config"] = path
    S["node_id"] = cfg["node_id"]
    from mt_eval_harness.contest_node import load_node_config
    load_node_config(path)  # fail loud here, not on the first request
    return f"node {cfg['node_id']} serves {S['contest_id']} (single-key, {cpus} cpu)"


def _submit_argv(S, *, contest_id, node_id, track, primary, accept_terms,
                 name, receipt_dir=None, extra=()):
    argv = [
        "contest", "submit-method", contest_id,
        "--method-dir", str(TOY_EXAMPLE / "method"),
        "--dockerfile", str(TOY_EXAMPLE / "Dockerfile"),
        "--name", name, "--version", "1.0.0",
        "--entrypoint", "method/translate.py",
        "--method-class", "pipeline", "--paradigm", "rule-based",
        "--developer", f"Beta {name}", "--agree",
        "--node-id", node_id,
        "--secret-set", S["secret_set_id"],
        "--track", track,
        # The toy method is rule-based and has no trainable parameters at
        # all; the declaration vocabulary has no "not applicable" value, so
        # the smallest positive integer is declared and said out loud here.
        # A rule-based toy method: zero trainable parameters is the true
        # declaration (founder call 2026-09-07 — 0 is admissible; it used
        # to have to claim 1 to pass a positive-integer check).
        "--parameter-count", "0",
        "--weights-license", "CC0-1.0",
        "--weights-public",
        "--training-data-file", str(TOY_EXAMPLE / "training-data.txt"),
        "--primary" if primary else "--contrastive",
    ]
    if accept_terms:
        argv += ["--accept-terms", accept_terms]
    if receipt_dir:
        argv += ["--receipt-dir", str(receipt_dir)]
    return argv + list(extra)


def _refuse_no_receipt(report, S):
    """entrant2 has not qualified yet: the entry door must refuse."""
    empty = S["out_dir"] / "receipts-empty"
    empty.mkdir(exist_ok=True)
    rc, out = cli(S["envs"]["entrant2"], _submit_argv(
        S, contest_id=S["contest_id"], node_id=S["node_id"],
        track="constrained", primary=True, accept_terms=S["terms_sha"],
        name="no-receipt", receipt_dir=empty), expect_failure=True)
    if "No qualifier receipt for contest" not in out:
        raise StageFailure(
            f"submit-method without a receipt failed for the wrong reason "
            f"(rc {rc}):\n{out[-1500:]}")
    report.refusal("submit-method without a qualifier receipt", out)
    return _first_line(out, "No qualifier receipt for contest")


def _qualify_stage(S, out_dir):
    dev = json.loads(S["dev_corpus"].read_text(encoding="utf-8"))
    hyp = out_dir / "dev-hypotheses.txt"
    hyp.write_text("\n".join(toy_translate(e["source"])
                             for e in dev["entries"]) + "\n", encoding="utf-8")
    S["dev_hyp"] = hyp
    receipts = {}
    for who in ("entrant1", "entrant2"):
        rdir = out_dir / f"receipts-{who}"
        rdir.mkdir(exist_ok=True)
        cli(S["envs"][who], [
            "contest", "qualify", S["contest_id"],
            "--dev", str(hyp), "--dev-corpus", str(S["dev_corpus"]),
            "--system", f"toy-swap-{who}", "--method-class", "pipeline",
            "--paradigm", "rule-based", "--receipt-dir", str(rdir)])
        path = rdir / f"{S['contest_id']}.json"
        if not path.exists():
            raise StageFailure(f"no qualifier receipt written at {path}")
        receipt = json.loads(path.read_text(encoding="utf-8"))
        if not receipt.get("passed"):
            raise StageFailure(f"{who} receipt says passed={receipt.get('passed')} "
                               f"(score {receipt.get('score')})")
        receipts[who] = {"dir": rdir, "receipt": receipt}
    S["receipts"] = receipts
    scores = ", ".join(f"{w}={receipts[w]['receipt']['score']}"
                       for w in receipts)
    return (f"receipts written and PASSING against threshold "
            f"{QUALIFIER_THRESHOLD} ({scores})")



def _refuse_wrong_terms_client(report, S):
    wrong = "0" * 64
    rc, out = cli(S["envs"]["entrant1"], _submit_argv(
        S, contest_id=S["contest_id"], node_id=S["node_id"],
        track="constrained", primary=True, accept_terms=wrong,
        name="wrong-terms",
        receipt_dir=S["receipts"]["entrant1"]["dir"]), expect_failure=True)
    if "does not match the prize terms" not in out:
        raise StageFailure(
            f"a wrong --accept-terms hash was not refused for the terms "
            f"reason (rc {rc}):\n{out[-1200:]}")
    report.refusal("submit-method with the wrong prize-terms hash (client)", out)
    return _first_line(out, "does not match the prize terms")


def _refuse_wrong_terms_node(report, S, out_dir):
    """The NODE's own refusal: a bundle built offline against different terms.

    Built with ``--offline`` (offline there is nothing to check the hash
    against, so the acceptance is taken on trust) and then put through
    ``run_static_checks`` exactly as ``run_method_request`` calls it — the
    same function, the same arguments, before any grant could be claimed.
    """
    from mt_eval_harness.sandbox_runner import run_static_checks
    bundle_out = out_dir / "wrong-terms-bundle"
    if bundle_out.exists():
        shutil.rmtree(bundle_out)
    wrong = "1" * 64
    cli(S["envs"]["entrant1"], _submit_argv(
        S, contest_id=S["contest_id"], node_id=S["node_id"],
        track="constrained", primary=False, accept_terms=wrong,
        name="wrong-terms-offline",
        receipt_dir=S["receipts"]["entrant1"]["dir"],
        extra=["--offline", "--bundle-out", str(bundle_out),
               "--pair", "qaa>qab",
               "--developer-email", S["emails"]["entrant1"],
               "--offline-threshold", str(QUALIFIER_THRESHOLD),
               "--offline-qualifier-id", S["qualifier_id"]]))
    tarballs = sorted(bundle_out.rglob("method.tar.gz"))
    if not tarballs:
        raise StageFailure(f"no method.tar.gz under {bundle_out}")
    from mt_eval_harness.contest_node import extract_bundle
    extracted = out_dir / "wrong-terms-extracted"
    if extracted.exists():
        shutil.rmtree(extracted)
    extract_bundle(tarballs[0].read_bytes(), extracted)
    checks = run_static_checks(
        extracted, tarball_path=tarballs[0],
        expected_corpus_id=S["secret_set_id"],
        contest_terms_sha=S["terms_sha"], contest_id=S["contest_id"])
    if not checks["blocked"]:
        raise StageFailure(
            "the node's static checks ACCEPTED a bundle that accepted the "
            "wrong prize-terms hash — the acceptance would be meaningless.")
    blocks = "; ".join(b["detail"] for b in checks["blocks"])
    if "terms" not in blocks.lower():
        raise StageFailure(
            f"the bundle was blocked, but not for the prize terms: {blocks}")
    report.refusal("node static checks vs a bundle accepting other terms",
                   blocks)
    return blocks[:220]


def _refuse_unoffered_override(report, S):
    """An override the declared disposition does not offer, refused AT
    DECLARATION — the cheapest possible moment, before a row exists.

    ``pass_to_holders`` means the holders keep the method; asking for it to be
    deleted after scoring is not a narrowing of that term, it is a different
    term. The organizer door refuses it by name rather than silently picking
    one of the two.
    """
    import argparse as _argparse
    from mt_eval_harness.cli import _prize_terms_from_args
    args = _argparse.Namespace(
        prize_disposition="pass_to_holders", prize_terms=None,
        prize_retention="delete_after_scoring", prize_release_timing=None,
        prize_release_license=None, prize_terms_url=None)
    try:
        terms = _prize_terms_from_args(args)
    except ValueError as exc:
        message = str(exc)
    else:
        raise StageFailure(
            f"`--prize-disposition pass_to_holders --prize-retention "
            f"delete_after_scoring` was ACCEPTED and produced {terms} — an "
            f"override the disposition does not offer must be refused at "
            f"declaration.")
    if "pass_to_holders" not in message or "retention" not in message:
        raise StageFailure(
            f"the override was refused, but the message names neither the "
            f"disposition nor the key: {message}")
    report.refusal("contest create with an override the disposition does not "
                   "offer", message)
    return _first_line(message, "is not an override")


def _submit_stage(S, out_dir):
    """Three entries: primary + contrastive (entrant1), out-of-track (entrant2)."""
    plan = [
        ("primary", "entrant1", "constrained", True),
        ("contrastive", "entrant1", "constrained", False),
        ("out-of-track", "entrant2", "unconstrained", True),
    ]
    entries = []
    for label, who, track, primary in plan:
        rc, out = cli(S["envs"][who], _submit_argv(
            S, contest_id=S["contest_id"], node_id=S["node_id"],
            track=track, primary=primary, accept_terms=S["terms_sha"],
            name=f"toy-swap-{label}",
            receipt_dir=S["receipts"][who]["dir"]))
        # No requested_by filter: the identities carry a "+" tag, and a
        # PostgREST query value is form-encoded, so "+" would silently become
        # a space and match nothing. The newest unseen row is unambiguous
        # because entries are submitted one at a time.
        rows = rest(S["stack"],
                    f"/rest/v1/authorization_requests"
                    f"?sealed_set_id=eq.{S['secret_set_id']}"
                    f"&select=request_id,state,method_sha,requested_by,"
                    f"created_at&order=created_at.desc")
        if not rows:
            raise StageFailure(f"{label}: no authorization request appeared")
        known = {e["request_id"] for e in entries}
        fresh = next((r for r in rows if r["request_id"] not in known), None)
        if fresh is None or fresh["state"] != "pending":
            raise StageFailure(
                f"{label}: expected a new PENDING request, got {rows[:2]}")
        if fresh["requested_by"] != S["emails"][who]:
            raise StageFailure(
                f"{label}: the new request is bound to "
                f"{fresh['requested_by']!r}, not to the submitter "
                f"{S['emails'][who]!r}")
        entries.append({"label": label, "who": who, "track": track,
                        "is_primary": primary,
                        "request_id": fresh["request_id"],
                        "method_sha": fresh["method_sha"]})
    S["entries"] = entries
    shas = {e["method_sha"] for e in entries}
    if len(shas) != len(entries):
        raise StageFailure(
            f"the three entries share a method_sha ({shas}) — the "
            f"declarations are supposed to be covered by it.")
    return ", ".join(f"{e['label']}={e['request_id']} ({e['track']}, "
                     f"{'primary' if e['is_primary'] else 'contrastive'})"
                     for e in entries)


def _execute_stage(stack, S):
    """node list → run-method (refused: pending) → approve → run-method."""
    env = S["envs"]["organizer"]
    cfg = ["--config", str(S["node_config"])]
    _, listing = cli(env, ["node", "list", *cfg])
    for e in S["entries"]:
        if e["request_id"] not in listing:
            raise StageFailure(
                f"`node list` does not show {e['request_id']}:\n{listing[-800:]}")
    first = S["entries"][0]
    _, out = cli(env, ["node", "run-method", first["request_id"], *cfg])
    if "waiting for custodian approval" not in out:
        raise StageFailure(
            f"a per-submission request executed WITHOUT custodian approval "
            f"(or failed differently):\n{out[-1200:]}")
    state = rest(stack, f"/rest/v1/authorization_requests"
                        f"?request_id=eq.{first['request_id']}&select=state"
                 )[0]["state"]
    if state != "pending":
        raise StageFailure(f"request state after the un-approved run: {state!r}")
    S["pending_proof"] = _first_line(out, "waiting for custodian approval")

    outcomes = []
    for e in S["entries"]:
        cli(env, ["node", "approve", e["request_id"],
                  "--actor", "contest-beta-custodian", *cfg])
        row = rest(stack, f"/rest/v1/authorization_requests"
                          f"?request_id=eq.{e['request_id']}&select=state")[0]
        if row["state"] != "authorized":
            raise StageFailure(
                f"{e['label']}: state after approve is {row['state']!r}")
        _, ran = cli(env, ["node", "run-method", e["request_id"], *cfg])
        if "qualifier" not in ran.lower():
            raise StageFailure(
                f"{e['label']}: the node did not re-execute the qualifier "
                f"before the sealed run:\n{ran[-1200:]}")
        e["run_output"] = ran[-4000:]
        outcomes.append(f"{e['label']}=executed")
    return ("qualifier re-executed on the node for every entry; "
            + ", ".join(outcomes))


def _deferred_stage(stack, S):
    """hidden_until_close means run_cards does NOT move before the close."""
    deferred = rest(stack, f"/rest/v1/contest_deferred_results"
                           f"?contest_id=eq.{S['contest_id']}"
                           f"&select=request_id,role,published_run_card_id")
    if len(deferred or []) != len(S["entries"]):
        raise StageFailure(
            f"expected {len(S['entries'])} deferred results, found "
            f"{len(deferred or [])}: {deferred}")
    if any(d.get("published_run_card_id") for d in deferred):
        raise StageFailure(
            f"a deferred result is already published before close: {deferred}")
    submissions = rest(stack, f"/rest/v1/contest_submissions"
                              f"?contest_id=eq.{S['contest_id']}&select=id")
    if submissions:
        raise StageFailure(
            f"{len(submissions)} contest_submissions rows exist before close "
            f"— a withheld result must not be linked yet.")
    now = len(rest(stack, "/rest/v1/run_cards?select=id") or [])
    if now != S["run_cards_before"]:
        raise StageFailure(
            f"run_cards moved from {S['run_cards_before']} to {now} while the "
            f"contest promised hidden_until_close — a withheld result was "
            f"published anyway.")
    S["deferred_request_ids"] = sorted(d["request_id"] for d in deferred)
    return (f"{len(deferred)} results withheld in contest_deferred_results; "
            f"0 contest_submissions, 0 run_cards published")


def _rank_open_stage(S, out_dir):
    env = S["envs"]["organizer"]
    ranking = cli_json(env, ["contest", "rank", S["contest_id"], "--json"])
    (out_dir / "rank-open.json").write_text(
        json.dumps(ranking, indent=2, ensure_ascii=False), encoding="utf-8")
    if ranking.get("entries"):
        raise StageFailure(
            f"an open hidden_until_close contest ranked "
            f"{len(ranking['entries'])} entries — the results are supposed to "
            f"be withheld until close.")
    deferred = ranking.get("deferred_results") or {}
    n_deferred = (deferred.get("count") if isinstance(deferred, dict)
                  else deferred)
    if n_deferred != len(S["entries"]):
        raise StageFailure(
            f"deferred_results is {deferred!r}, expected a count of "
            f"{len(S['entries'])}")
    ident = ranking.get("identity_policy") or {}
    if not ident.get("anonymized"):
        raise StageFailure(f"identity_policy is not anonymised: {ident}")
    terms = ranking.get("prize_terms") or {}
    if not terms.get("declared") or terms.get("terms_sha256") != S["terms_sha"]:
        raise StageFailure(f"prize_terms in the ranking: {terms}")
    S["rank_open"] = ranking
    return (f"0 entries, {n_deferred} withheld, identities pseudonymised "
            f"({ident.get('source')}), prize terms declared "
            f"(gate {terms.get('gate')})")



def _refuse_reveal(report, S):
    rc, out = cli(S["envs"]["entrant1"], [
        "contest", "rank", S["contest_id"], "--reveal-identities"],
        expect_failure=True)
    if "Refusing --reveal-identities" not in out:
        raise StageFailure(
            f"rank --reveal-identities was not refused for the ownership "
            f"reason (rc {rc}):\n{out[-1200:]}")
    report.refusal("rank --reveal-identities without ownership", out)
    return _first_line(out, "Refusing --reveal-identities")


def _close_stage(stack, S):
    before = len(rest(stack, "/rest/v1/run_cards?select=id") or [])
    cli(S["envs"]["organizer"], [
        "contest", "close", S["contest_id"], "--yes"])
    row = rest(stack, f"/rest/v1/contests?id=eq.{S['contest_id']}"
                      f"&select=status,intake_open,metadata")[0]
    if row["status"] != "closed":
        raise StageFailure(f"status after close: {row['status']!r}")
    if row["intake_open"]:
        raise StageFailure("intake_open is still true after close")
    md = row.get("metadata") or {}
    frozen = md.get("final_ranking")
    if not isinstance(frozen, dict):
        raise StageFailure(f"metadata.final_ranking missing: keys={sorted(md)}")
    deferred = rest(stack, f"/rest/v1/contest_deferred_results"
                           f"?contest_id=eq.{S['contest_id']}"
                           f"&select=request_id,published_run_card_id")
    unpublished = [d for d in deferred if not d.get("published_run_card_id")]
    if unpublished:
        raise StageFailure(
            f"close left {len(unpublished)} withheld result(s) unpublished: "
            f"{unpublished}")
    S["published_card_ids"] = [d["published_run_card_id"] for d in deferred]
    subs = rest(stack, f"/rest/v1/contest_submissions"
                       f"?contest_id=eq.{S['contest_id']}"
                       f"&select=run_card_id,is_primary,track,submitter_label")
    if len(subs) != len(S["entries"]):
        raise StageFailure(
            f"{len(subs)} contest_submissions after close, expected "
            f"{len(S['entries'])}")
    if any("@" in (s.get("submitter_label") or "") for s in subs):
        raise StageFailure(
            f"a submitter_label is email-shaped: "
            f"{[s.get('submitter_label') for s in subs]}")
    ident = (frozen.get("identity_policy") or {})
    if ident.get("anonymized"):
        raise StageFailure(
            "the FROZEN ranking is still pseudonymised — close reveals by "
            "default (the promise was anonymity UNTIL close).")
    # --- policy assertions on the FROZEN artifact (M5) --------------------
    # The four things the frozen snapshot has to say about itself: which of
    # the three prize terms this contest declared, that it promised no second
    # sealed split, that the anonymity promise has expired, and that nothing
    # is still being withheld.
    terms = frozen.get("prize_terms") or {}
    disposition = (terms.get("terms") or {}).get("disposition")
    if disposition != PRIZE_DISPOSITION:
        raise StageFailure(
            f"the frozen ranking's prize_terms.terms.disposition is "
            f"{disposition!r}, expected {PRIZE_DISPOSITION!r} (R1-trinary: "
            f"the headline term is ONE of three, and it is frozen with the "
            f"ranking).")
    if frozen.get("holdout") is not None:
        raise StageFailure(
            f"the frozen ranking carries a holdout section "
            f"({frozen['holdout']!r}), but this beta declares no "
            f"--sealed-holdout-size — a contest must not report a split it "
            f"never promised.")
    deferred_after = frozen.get("deferred_results") or {}
    n_after = (deferred_after.get("count") if isinstance(deferred_after, dict)
               else deferred_after)
    if n_after:
        raise StageFailure(
            f"the frozen ranking still counts {n_after} withheld result(s) — "
            f"close publishes every deferred result BEFORE it freezes.")
    S["frozen"] = frozen
    after = len(rest(stack, "/rest/v1/run_cards?select=id") or [])
    if after - before != len(S["entries"]):
        raise StageFailure(
            f"run_cards moved by {after - before} at close, expected "
            f"{len(S['entries'])} (the withheld cards)")
    return (f"closed; {len(S['published_card_ids'])} withheld cards published; "
            f"final_ranking frozen with {len(frozen.get('entries') or [])} "
            f"ranked entries; identities revealed; prize disposition "
            f"{disposition}; no holdout declared; 0 still withheld")


def _refuse_second_close(report, S):
    rc, out = cli(S["envs"]["organizer"], [
        "contest", "close", S["contest_id"], "--yes"], expect_failure=True)
    if "closed" not in out.lower():
        raise StageFailure(
            f"the second close failed for the wrong reason (rc {rc}):\n"
            f"{out[-1200:]}")
    report.refusal("a second close of an already-closed contest", out)
    return _first_line(out, "closed")


def _rank_closed_stage(S, out_dir):
    env = S["envs"]["organizer"]
    ranking = cli_json(env, ["contest", "rank", S["contest_id"], "--json",
                             "--include-contrastive"])
    (out_dir / "rank-closed.json").write_text(
        json.dumps(ranking, indent=2, ensure_ascii=False), encoding="utf-8")
    entries = ranking.get("entries") or []
    if len(entries) != 1:
        raise StageFailure(
            f"expected exactly ONE ranked primary entry (the constrained "
            f"primary), got {len(entries)}: "
            f"{[(e.get('track'), e.get('is_primary')) for e in entries]}")
    if not (ranking.get("identity_policy") or {}).get("anonymized"):
        raise StageFailure(
            "rank without --reveal-identities dropped the pseudonyms — the "
            "organizer's own view is supposed to stay pseudonymised unless "
            "identities are asked for explicitly.")
    labels = [e.get("submitter_label") for e in entries]
    pseudonyms = [e.get("pseudonym") for e in entries]
    if any("@" in (l or "") for l in labels):
        raise StageFailure(f"an email leaked into the ranking: {labels}")
    if not all(pseudonyms):
        raise StageFailure(f"a pseudonymised entry has no pseudonym: {entries}")
    contrastive = ranking.get("contrastive") or []
    if len(contrastive) != 1:
        raise StageFailure(
            f"expected 1 contrastive entry, got {len(contrastive)}")
    live_deferred = ranking.get("deferred_results") or {}
    n_live = (live_deferred.get("count") if isinstance(live_deferred, dict)
              else live_deferred)
    if n_live:
        raise StageFailure(
            f"a LIVE ranking after close still counts {n_live} withheld "
            f"result(s) — nothing may stay in contest_deferred_results once "
            f"the contest is closed.")
    if ranking.get("holdout") is not None:
        raise StageFailure(
            f"a holdout section appeared on a contest that declares no "
            f"sealed holdout: {ranking['holdout']!r}")
    exclusions = ranking.get("exclusions") or []
    track_excl = [x for x in exclusions
                  if "track" in (x.get("rule") or "").lower()
                  or "track" in (x.get("reason") or "").lower()]
    if not track_excl:
        raise StageFailure(
            f"the unconstrained entry was not excluded by allowed_tracks; "
            f"exclusions={exclusions}")
    eligibility = ranking.get("prize_eligibility") or {}
    winner = entries[0]
    verdict = eligibility.get(winner["run_card_id"]) or {}
    if not verdict.get("eligible"):
        raise StageFailure(
            f"the winning entry is not prize-eligible under disposition "
            f"{PRIZE_DISPOSITION}: {verdict}")
    if verdict.get("gate", {}).get("handover_verified") is not True:
        raise StageFailure(
            f"handover_verified is {verdict.get('gate')} — disposition "
            f"{PRIZE_DISPOSITION} requires it and nothing else.")
    # The promise is about ENTRANTS: a participant's login is not a byline.
    # The organizer's own address legitimately appears as contest.created_by
    # (already public on the contests row) and as generated_by (who ran the
    # ranking), so the check names the entrants rather than banning "@".
    leaked = [e for who, e in S["emails"].items()
              if who != "organizer" and e in json.dumps(ranking)]
    if leaked:
        raise StageFailure(
            f"an entrant's login leaked into the ranking JSON: {leaked}")
    stray = [v for v in json_emails(ranking)
             if v != S["emails"]["organizer"]]
    if stray:
        raise StageFailure(
            f"an unexpected email-shaped value is in the ranking JSON "
            f"(only the organizer's own created_by / generated_by belong "
            f"there): {stray}")
    S["rank_closed"] = ranking
    return (f"1 primary ranked (pseudonym {pseudonyms[0]}), 1 contrastive, "
            f"1 excluded ({track_excl[0].get('reason', '')[:80]}), "
            f"prize gate handover_verified=True")


def json_emails(doc) -> list[str]:
    """Every email-shaped value anywhere in a document."""
    text = json.dumps(doc, ensure_ascii=False)
    return sorted(set(re.findall(r"[\w.+-]+@[\w-]+\.[\w.-]+", text)))


def _export_stage(S, out_dir):
    env = S["envs"]["organizer"]
    jpath = out_dir / "export.json"
    cpath = out_dir / "export.csv"
    cli(env, ["contest", "export", S["contest_id"], "--format", "json",
              "--out", str(jpath)])
    cli(env, ["contest", "export", S["contest_id"], "--format", "csv",
              "--out", str(cpath)])
    frozen = json.loads(jpath.read_text(encoding="utf-8"))
    if not frozen.get("frozen"):
        raise StageFailure("the export of a closed contest is not marked frozen")
    rows = cpath.read_text(encoding="utf-8").strip().splitlines()
    if len(rows) < 2:
        raise StageFailure(f"the CSV export has no data rows: {rows}")
    header = rows[0]
    for col in ("rank_min", "rank_max", "is_primary", "track",
                "prize_eligible", "submitter_label_or_pseudonym"):
        if col not in header:
            raise StageFailure(f"CSV header is missing {col}: {header}")
    return (f"export.json (frozen) + export.csv ({len(rows) - 1} rows, "
            f"{len(header.split(','))} columns)")


# ---------------------------------------------------------------------------
# Cleanup — what this run created, and only that
# ---------------------------------------------------------------------------

def _cleanup(args, S) -> dict:
    stack = S.get("stack")
    contest_id = S.get("contest_id")
    if not stack or not contest_id:
        return {"mode": "nothing-to-clean"}
    if not args.cleanup:
        return {"mode": "kept",
                "note": (f"rows left in place for inspection; re-run with "
                         f"--cleanup, or delete contest {contest_id} and its "
                         f"sealed sets by hand."),
                "contest_id": contest_id}
    steps: list[dict] = []

    def delete(table: str, params: str):
        try:
            rest(stack, f"/rest/v1/{table}?{params}", method="DELETE")
            steps.append({"table": table, "params": params, "status": "OK"})
        except StageFailure as exc:
            steps.append({"table": table, "params": params, "status": "FAILED",
                          "error": str(exc)[:400]})

    cards = S.get("published_card_ids") or []
    requests = [e["request_id"] for e in S.get("entries", [])
                if e.get("request_id")]
    delete("contest_submissions", f"contest_id=eq.{contest_id}")
    delete("contest_deferred_results", f"contest_id=eq.{contest_id}")
    if cards:
        delete("run_cards", "id=in.(" + ",".join(cards) + ")")
    if requests:
        delete("auth_grants", "request_id=in.(" + ",".join(requests) + ")")
        delete("authorization_requests",
               "request_id=in.(" + ",".join(requests) + ")")
        # authorization_audit_log is deliberately NOT deleted: it is
        # append-only and hash-chained, and the database refuses a DELETE on
        # it. Cutting rows out of a tamper-evident log to tidy up a test run
        # is the one thing that log exists to make impossible.
        steps.append({"table": "authorization_audit_log",
                      "params": "request_id=in.(" + ",".join(requests) + ")",
                      "status": "KEPT-BY-DESIGN",
                      "note": ("append-only, hash-chained: the audit trail of "
                               "this run stays on the record")})
    delete("contests", f"id=eq.{contest_id}")
    if S.get("qualifier_id"):
        delete("qualifiers", f"qualifier_id=eq.{S['qualifier_id']}")
    for set_id in S.get("sealed_set_ids", []):
        delete("sealed_sets", f"sealed_set_id=eq.{set_id}")
    failed = [s for s in steps
              if s["status"] not in ("OK", "KEPT-BY-DESIGN")]
    if failed:
        print("\n  ⚠ cleanup could not delete everything (local stack — the "
              "rows are harmless, but they are named here rather than "
              "hidden):", file=sys.stderr)
        for s in failed:
            print(f"    {s['table']}?{s['params']}: {s['error']}",
                  file=sys.stderr)
    else:
        kept = [s for s in steps if s["status"] == "KEPT-BY-DESIGN"]
        print(f"\n  ✓ cleanup: "
              f"{len(steps) - len(kept)} delete(s), contest {contest_id} "
              f"and everything it created are gone")
        for s in kept:
            print(f"    kept by design: {s['table']} — {s['note']}")
    return {"mode": "deleted", "steps": steps,
            "all_ok": not failed}


# ---------------------------------------------------------------------------

def parse_args(argv=None) -> argparse.Namespace:
    p = argparse.ArgumentParser(
        prog="contest_beta.py", description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--target", required=True, choices=["local", "dev", "prod"],
                   help="Which stack to drive. 'local' is the only live "
                        "target (the loopback stack in the Lima organizer "
                        "guest); 'dev' and 'prod' refuse, with the reason")
    p.add_argument("--status-env",
                   help="Path to the local stack's status.env (default "
                        "~/supabase-out/status.env); ignored when "
                        "MT_EVAL_SUPABASE_URL/_ANON_KEY/_SERVICE_KEY are set")
    p.add_argument("--out-dir",
                   help="Where the corpus, keys, bundles, node state and "
                        "exports land (default "
                        "~/.mt-eval/contest-beta/<runid>/)")
    p.add_argument("--json-out", help="Also write the stage report here")
    p.add_argument("--cleanup", action="store_true",
                   help="Delete the rows this run created (contest, sealed "
                        "sets, qualifier, requests, published cards) — and "
                        "only those. Without it everything is left in place "
                        "for inspection")
    return p.parse_args(argv)


def main(argv=None) -> int:
    args = parse_args(argv)
    print(f"contest_beta — target {args.target}")
    report = run(args)
    print("\n  Stages:")
    for s in report["stages"]:
        print(f"    {s['status']:4s} {s['name']}")
    if report["refusals"]:
        print("\n  Refusals proven:")
        for r in report["refusals"]:
            print(f"    • {r['what']}")
    print(f"\n  Report: {report['out_dir']}/contest_beta_report.json")
    if report["ok"]:
        return 0
    failed = next((s["name"] for s in report["stages"]
                   if s["status"] == "FAIL"), "startup")
    print(f"\n  ✗ FAILED at stage: {failed}", file=sys.stderr)
    if report.get("traceback"):
        print(report["traceback"], file=sys.stderr)
    return 2


if __name__ == "__main__":
    sys.exit(main())
