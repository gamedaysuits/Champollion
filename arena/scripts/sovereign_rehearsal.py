#!/usr/bin/env python3
"""
sovereign_rehearsal.py — the GUEST-side runner for the sovereign-node rehearsal.

Runs inside a Lima guest (see arena/deploy/sovereign-node/). Every step shells
out to the real CLI (`mt-eval …`, `docker …`, `node …`) — the CLI surface is
what is being proven — and every step is an assertion: the first failure stops
the run, is named in the report, and exits 2. A missing tool is a failure,
never a skip. Nothing here mocks anything.

Roles / modes
  --role airgap    --tier 1   ceremony · seal · keygen · node.json · refusals · re-key
  --role airgap    --tier 2   import · sub-quorum refusal · quorum run (real Docker,
                              --network=none) · teardown proof · plaintext-never-
                              survived grep · signed export
  --role organizer --phase a  local Supabase, the R2 entry path end to end: prepare TWO
                              sealed contests (one executed here, one sealed to the
                              air-gap node's custodian key) · sign-up · contest qualify
                              (the public admission receipt) · Lane B submit-method →
                              node run-method: qualifier re-executed HERE → custodian
                              hold → approve → Docker (--network=none) on the sealed set
                              → aggregates-only publish · then the relay contest:
                              submit-method → approve → relay pass 1 · plus a DB-less
                              `node stage-request`
  --role organizer --relay 2  relay pass 2: verify the returned bundle and WITHHOLD it
                              (hidden_until_close + the always-withheld holdout)
  --role organizer --close    rank while open · refusals · close (publishes the withheld
                              main + holdout, reveals identities, freezes) · rank closed ·
                              export · shared-task report (or a printed reason)

Report: <report-dir>/report.json + report.md (outside the repo).
stdlib only.
"""
from __future__ import annotations

import argparse
import base64
import datetime as dt
import json
import os
import re
import shutil
import stat
import subprocess
import sys
import tarfile
import time
import urllib.error
import urllib.request
from pathlib import Path

HOME = Path.home()
VENV_BIN = HOME / ".venvs" / "mt-eval" / "bin"
MT = str(VENV_BIN / "mt-eval")
PY = str(VENV_BIN / "python")
SECRET_TOKEN = "noluvo"  # a reference-side token from the synthetic blind set


class RehearsalFailure(Exception):
    pass


# ---------------------------------------------------------------------------
# Runner + report
# ---------------------------------------------------------------------------

class Runner:
    def __init__(self, role: str, mode: str, report_dir: Path):
        self.role, self.mode = role, mode
        self.report_dir = report_dir
        self.report_dir.mkdir(parents=True, exist_ok=True)
        self.steps: list[dict] = []
        self.artifacts: dict = {}
        self.started = dt.datetime.now(dt.timezone.utc)

    # -- shell -------------------------------------------------------------
    def sh(self, argv: list[str], *, expect: int | None = 0, env: dict | None = None,
           timeout: int = 1800, cwd: Path | None = None, stdin: str | None = None) -> tuple[int, str]:
        e = dict(os.environ); e.update(env or {})
        e["PATH"] = f"{VENV_BIN}:{HOME/'.local/node/bin'}:{e.get('PATH','')}"
        try:
            p = subprocess.run(argv, capture_output=True, text=True, env=e, timeout=timeout,
                               cwd=str(cwd) if cwd else None, input=stdin)
        except FileNotFoundError as exc:
            raise RehearsalFailure(f"tool missing: {argv[0]} ({exc})")
        out = (p.stdout or "") + (p.stderr or "")
        if expect is not None and p.returncode != expect:
            raise RehearsalFailure(
                f"`{' '.join(argv)}` exited {p.returncode} (expected {expect}):\n{out[-3000:]}")
        return p.returncode, out

    def must_fail(self, argv: list[str], *, env: dict | None = None, contains: str | None = None) -> str:
        rc, out = self.sh(argv, expect=None, env=env)
        if rc == 0:
            raise RehearsalFailure(f"`{' '.join(argv)}` succeeded but MUST be refused")
        if contains and contains.lower() not in out.lower():
            raise RehearsalFailure(f"refusal text for `{' '.join(argv[:4])}…` lacks '{contains}':\n{out[-1500:]}")
        return out

    # -- steps -------------------------------------------------------------
    def step(self, name: str, fn):
        t0 = time.time()
        print(f"\n[{len(self.steps)+1:02d}] {name}", flush=True)
        try:
            detail = fn() or {}
            self.steps.append({"name": name, "ok": True, "seconds": round(time.time()-t0, 2), "detail": detail})
            print(f"     ✓ {name}" + (f" — {detail}" if detail and len(json.dumps(detail)) < 200 else ""), flush=True)
        except RehearsalFailure as exc:
            self.steps.append({"name": name, "ok": False, "seconds": round(time.time()-t0, 2), "error": str(exc)})
            print(f"     ✗ {name}\n{exc}", flush=True)
            self.write(status="failed")
            sys.exit(2)
        except Exception as exc:  # any other exception is also a failure, loudly
            self.steps.append({"name": name, "ok": False, "seconds": round(time.time()-t0, 2),
                               "error": f"{type(exc).__name__}: {exc}"})
            print(f"     ✗ {name}\n{type(exc).__name__}: {exc}", flush=True)
            self.write(status="failed")
            raise

    def write(self, status: str = "passed"):
        rec = {
            "role": self.role, "mode": self.mode, "status": status,
            "started": self.started.isoformat(), "finished": dt.datetime.now(dt.timezone.utc).isoformat(),
            "host": os.uname().nodename, "steps": self.steps, "artifacts": self.artifacts,
        }
        prov = HOME / ".champollion-provision.json"
        if prov.exists():
            rec["provision"] = json.loads(prov.read_text())
        name = f"{self.role}-{self.mode}"
        (self.report_dir / f"report-{name}.json").write_text(json.dumps(rec, indent=2))
        lines = [f"### {self.role} / {self.mode} — {status.upper()} ({len([s for s in self.steps if s['ok']])}/{len(self.steps)} steps)", "",
                 "| # | step | ok | s | detail |", "|---|---|---|---|---|"]
        for i, s in enumerate(self.steps, 1):
            d = s.get("error") or json.dumps(s.get("detail", {}), ensure_ascii=False)
            d = d.replace("|", "\\|").replace("\n", " ")
            lines.append(f"| {i} | {s['name']} | {'✓' if s['ok'] else '✗'} | {s['seconds']} | {d[:220]} |")
        if self.artifacts:
            lines += ["", "```json", json.dumps(self.artifacts, indent=2)[:6000], "```"]
        md = self.report_dir / "report.md"
        prev = md.read_text() if md.exists() else ""
        md.write_text(prev + "\n".join(lines) + "\n\n")


# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------

def load_versions() -> dict:
    for p in (HOME / "deploy" / "versions.env",
              HOME / "in" / "bundle-drive" / "bundle" / "artifacts" / "versions.env"):
        if p.exists():
            out = {}
            for line in p.read_text().splitlines():
                m = re.match(r'^([A-Z_]+)="?([^"]*)"?\s*$', line.strip())
                if m:
                    out[m.group(1)] = m.group(2)
            return out
    raise RehearsalFailure(
        "versions.env not found under ~/deploy or the offline bundle's "
        "artifacts/ — the rehearsal is pinned by that file and will not "
        "guess its values")


def find_one(root: Path, name: str) -> Path:
    hits = [p for p in root.rglob(name)]
    if not hits:
        raise RehearsalFailure(f"{name} not found under {root}")
    return hits[0]


def grep_absent(token: str, roots: list[Path], exclude_dirs: tuple[str, ...] = (),
                exclude_names: tuple[str, ...] = ()) -> dict:
    """Assert `token` appears in NO file under any root (except excluded dir names)."""
    scanned, hits = 0, []
    for root in roots:
        if not root.exists():
            continue
        paths = [root] if root.is_file() else root.rglob("*")
        for p in paths:
            if not p.is_file():
                continue
            if p.name in exclude_names:
                continue
            if any(part in exclude_dirs for part in p.relative_to(root).parts[:-1]) if p != root else False:
                continue
            scanned += 1
            try:
                if token.encode() in p.read_bytes():
                    hits.append(str(p))
            except OSError as exc:
                raise RehearsalFailure(f"cannot read {p}: {exc}")
    if hits:
        raise RehearsalFailure(f"plaintext token '{token}' survived in: {hits}")
    return {"files_scanned": scanned, "token": token, "hits": 0}


def shred(path: Path):
    """Overwrite then unlink a plaintext copy (best effort on a journaling fs; stated as such)."""
    if path.exists():
        n = path.stat().st_size
        with open(path, "r+b") as fh:
            fh.write(b"\0" * n); fh.flush(); os.fsync(fh.fileno())
        path.unlink()


def read_json(p: Path | str) -> dict:
    return json.loads(Path(p).read_text(encoding="utf-8"))


def ledger_records(state_dir: Path) -> list[dict]:
    led = state_dir / "authorization-ledger.jsonl"
    if not led.exists():
        return []
    return [json.loads(line) for line in led.read_text().splitlines() if line.strip()]


def ledger_events(state_dir: Path) -> list[str]:
    return [rec.get("event") or rec.get("event_type") or rec.get("type") or "?"
            for rec in ledger_records(state_dir)]


def toy_translate(line: str) -> str:
    """The synthetic qaa>qab rule the fixtures encode: 'w1 w2 w3' → 'w2 w1vo'."""
    w = line.split()
    return f"{w[1]} {w[0]}vo" if len(w) >= 2 else line.strip()


def group_public_key_b64(ceremony_json: Path) -> str:
    """The custodian-group public key from ceremony.json, base64 — fail loud on an unknown layout."""
    doc = read_json(ceremony_json)
    for k in ("publicKeyDerB64", "groupPublicKey", "group_public_key", "publicKey", "public_key"):
        v = doc.get(k)
        if isinstance(v, str) and v:
            return v
    raise RehearsalFailure(f"no group public key field in {ceremony_json}; keys: {sorted(doc)}")


# ---------------------------------------------------------------------------
# TIER 1 — the ceremony on the darkened node
# ---------------------------------------------------------------------------

def tier1(r: Runner):
    V = load_versions()
    # The IN drive: the offline bundle sits ON it, with the drive manifest
    # beside the bundle rather than inside it (a manifest written into the
    # bundle directory makes `node bundle --verify` fail on it as an unlisted
    # file).
    drive = HOME / "in" / "bundle-drive"
    bundle = drive / "bundle"
    state_dir = HOME / ".mt-eval" / "airgap"
    cer = HOME / "ceremony"
    tokens = HOME / "tokens"
    sealed = HOME / "sealed"
    keys = HOME / "keys"
    out = HOME / "out"
    out.mkdir(exist_ok=True)
    M, N, GROUP, SET_ID, CONTEST = int(V["CEREMONY_M"]), int(V["CEREMONY_N"]), V["CEREMONY_GROUP"], V["SEALED_SET_ID"], V["CONTEST_ID"]
    RELAY_SET_ID = V["RELAY_SET_ID"]
    custodians = [f"custodian-{i}" for i in range(1, N + 1)]

    r.step("offline bundle verifies (bundle hashes + the drive manifest beside it)", lambda: (
        r.sh([MT, "node", "bundle", "--verify", str(bundle)]),
        r.sh([MT, "node", "manifest", "verify", str(drive)]),
        {"bundle": str(bundle), "drive": str(drive)})[-1])

    def egress():
        _, out_ = r.sh([MT, "node", "egress-check", "--json"], expect=None)
        rep = json.loads(out_[out_.index("{"):out_.rindex("}") + 1])
        if rep.get("airgapped") is not True:
            raise RehearsalFailure(f"egress-check says NOT air-gapped: {rep}")
        r.must_fail(["curl", "--max-time", "3", "-sS", "https://1.1.1.1"])
        r.must_fail(["getent", "hosts", "example.com"])
        # bridge-networked container (NOT --network=none) must ALSO fail: FORWARD drop
        r.must_fail(["docker", "run", "--rm", V["PYTHON_BASE_IMAGE"], "python3", "-c",
                     "import socket; socket.create_connection(('1.1.1.1',443),3)"])
        r.artifacts["egress_check"] = rep
        return {"airgapped": True, "default_route": rep.get("default_route"), "dns_resolved": rep.get("dns_resolved")}
    r.step("egress is gone (egress-check + curl + DNS + bridge container)", egress)

    # ONE CEREMONY PER SEALED SET — that is the doctrine, and the code
    # enforces it: `quorum_unseal_for_run` refuses shares whose `sealedSetId`
    # is not the artifact's own cardId, so a single key cannot be re-used to
    # open a differently-named set. This node serves two sets, so it holds two
    # ceremonies:
    #   A  the tier-1 fixture it seals itself (the DB-less staged lane)
    #   B  the relay contest's secret set, which the ORGANIZER seals to B's
    #      group public key (its holdout split rides the same ceremony —
    #      same key, same group, a second cardId: contract D1).
    ceremonies = [("A", SET_ID, cer, tokens),
                  ("B", RELAY_SET_ID, HOME / "ceremony-t2", HOME / "tokens-t2")]

    def ceremony_argv(dirp: Path, set_id: str) -> list[str]:
        argv = [MT, "node", "ceremony", "init", "--dir", str(dirp), "--set", set_id,
                "--group", GROUP, "--quorum", str(M), "--shares", str(N)]
        for c in custodians:
            argv += ["--custodian", c]
        return argv

    def init():
        detail = {}
        for label, set_id, dirp, _tok in ceremonies:
            if dirp.exists():
                shutil.rmtree(dirp)
            argv = ceremony_argv(dirp, set_id)
            r.sh(argv)
            doc = read_json(dirp / "ceremony.json")
            if not doc.get("keyId") or doc.get("m") != M or doc.get("n") != N:
                raise RehearsalFailure(f"ceremony.json malformed: {doc}")
            shares = sorted((dirp / "shares").glob("*.json"))
            if len(shares) != N:
                raise RehearsalFailure(f"expected {N} share files, found {len(shares)}")
            for sfile in shares:
                mode = stat.S_IMODE(sfile.stat().st_mode)
                if mode & 0o077:
                    raise RehearsalFailure(f"share {sfile.name} mode {oct(mode)} is group/world readable")
            r.must_fail(argv, contains="")  # a second init into the same dir is refused
            detail[label] = {"set": set_id, "keyId": doc["keyId"]}
        keys_seen = {d["keyId"] for d in detail.values()}
        if len(keys_seen) != len(detail):
            raise RehearsalFailure(
                f"two ceremonies produced the same key id {keys_seen} — each "
                f"sealed set gets its own key")
        r.artifacts["ceremonies"] = {**detail, "m": M, "n": N, "group": GROUP}
        return detail
    r.step(f"ceremony init {M}-of-{N} for EACH sealed set (second init refused, shares mode 0600, distinct keys)", init)

    def share():
        out_ = {}
        for label, _set_id, dirp, tokdir in ceremonies:
            if tokdir.exists():
                shutil.rmtree(tokdir)
            for i, c in enumerate(custodians, 1):
                dest = tokdir / str(i)
                r.sh([MT, "node", "ceremony", "share", "--dir", str(dirp), "--custodian", c, "--dest", str(dest)])
                if not list(dest.glob("*.json")):
                    raise RehearsalFailure(f"no share file emitted for {c} in {dest}")
            r.must_fail([MT, "node", "ceremony", "share", "--dir", str(dirp), "--dest", str(tokdir / "all")])
            out_[label] = N
        return out_
    r.step("share ×N to custodian tokens for each ceremony (bulk emit without a custodian refused)", share)

    def token_in(tokdir: Path, i: int) -> str:
        return str(next((tokdir / str(i)).glob("*.json")))

    def token(i: int) -> str:
        return token_in(tokens, i)

    def verify():
        out_ = {}
        for label, _set_id, dirp, tokdir in ceremonies:
            r.sh([MT, "node", "ceremony", "verify", "--dir", str(dirp),
                  "--share", token_in(tokdir, 1), "--share", token_in(tokdir, 3), "--share", token_in(tokdir, 5)])
            r.must_fail([MT, "node", "ceremony", "verify", "--dir", str(dirp),
                         "--share", token_in(tokdir, 1), "--share", token_in(tokdir, 2)])
            out_[label] = {"verified_with": M, "refused_with": M - 1}
        # And ceremony A's shares must NOT verify against ceremony B's
        # commitment: two sets, two keys, no crossover.
        r.must_fail([MT, "node", "ceremony", "verify", "--dir", str(ceremonies[1][2]),
                     "--share", token_in(tokens, 1), "--share", token_in(tokens, 3), "--share", token_in(tokens, 5)])
        out_["cross_ceremony_refused"] = True
        return out_
    r.step("verify from distributed tokens (M ok, M-1 refused, the other ceremony's shares refused)", verify)

    def wipe():
        for _label, _set_id, dirp, _tok in ceremonies:
            r.sh([MT, "node", "ceremony", "share", "--dir", str(dirp), "--wipe-originals"])
            left = list((dirp / "shares").glob("*.json")) if (dirp / "shares").exists() else []
            if left:
                raise RehearsalFailure(f"originals survived --wipe-originals: {left}")
            read_json(dirp / "ceremony.json")
        return {"originals_left": 0, "ceremonies": len(ceremonies)}
    r.step("wipe originals (ceremony.json intact) on both ceremonies", wipe)

    def seal():
        # Ceremony A's set: the fixture this node seals for itself (the
        # DB-less staged lane). The relay contest's splits are sealed by the
        # ORGANIZER, to ceremony B's public key.
        corpus = find_one(bundle, "corpus_blind_refs.json")
        if sealed.exists():
            shutil.rmtree(sealed)
        sealed.mkdir()
        r.sh([MT, "node", "seal", "--corpus", str(corpus), "--pubkey", str(cer / "ceremony.json"),
              "--card-id", SET_ID, "--group", GROUP, "--out-dir", str(sealed)])
        arts = sorted(sealed.glob("*.json"))
        if not arts:
            raise RehearsalFailure("seal produced no artifact")
        grep_absent(SECRET_TOKEN, [sealed])
        shred(corpus)  # the plaintext copy on this node is read once, then gone
        if corpus.exists():
            raise RehearsalFailure("plaintext corpus copy survived shred")
        art = (next(pth for pth in arts if "sealed" in pth.name and "block" not in pth.name)
               if any("sealed" in pth.name for pth in arts) else arts[0])
        r.artifacts["secret_artifact"] = str(art)
        return {"artifact": art.name, "set": SET_ID, "plaintext_shredded": True}
    r.step("seal the synthetic secret set to ceremony A's group key; shred the plaintext", seal)

    def keygen():
        if keys.exists():
            shutil.rmtree(keys)
        keys.mkdir()
        # Stale public keys from an earlier pass must not sit on the OUT
        # medium: whoever picked one up would verify this run's scores against
        # a key that did not sign them.
        for old in out.glob("*.pub.json"):
            old.unlink()
        r.sh([MT, "node", "keygen", "--out", str(keys)])
        pub = next(keys.glob("*.pub.json")); priv = next(keys.glob("*.key.json"))
        if stat.S_IMODE(priv.stat().st_mode) & 0o077:
            raise RehearsalFailure(f"signing key {priv.name} is group/world readable")
        shutil.copy(pub, out / pub.name)
        # Public halves only: ids, the group public key, share fingerprints.
        # BOTH ceremonies travel — the organizer seals the relay contest's
        # splits to ceremony B's group key and cannot do that without it.
        shutil.copy(cer / "ceremony.json", out / "ceremony.json")
        shutil.copy(HOME / "ceremony-t2" / "ceremony.json", out / "ceremony-t2.json")
        r.artifacts["signing_pub"] = str(out / pub.name)
        r.artifacts["signing_key"] = str(priv)
        return {"pub": pub.name, "ceremonies_out": ["ceremony.json", "ceremony-t2.json"]}
    r.step("node signing keypair (pub + ceremony.json carried OUT)", keygen)

    def nodejson():
        tpl = read_json(find_one(bundle, "node.airgap.json"))
        tpl.pop("_comment", None)
        cpus = os.cpu_count() or 1
        text = json.dumps(tpl)
        text = (text.replace("__HOME__", str(HOME)).replace("__CONTEST_ID__", CONTEST)
                .replace("__SEALED_SET_ID__", SET_ID).replace("__SECRET_ARTIFACT__", r.artifacts["secret_artifact"])
                .replace("__SIGNING_KEY__", r.artifacts["signing_key"]).replace('"__CPUS__"', str(cpus)))
        cfg = json.loads(text)
        p = HOME / ".mt-eval" / "node.json"
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(json.dumps(cfg, indent=2))
        r.sh([MT, "node", "ledger", "verify"])  # loads the config; empty ledger verifies
        # a single-party bypass must be refused by the loader
        bad = json.loads(text)
        bad["contests"][CONTEST]["secret_privkey"] = r.artifacts["signing_key"]
        badp = HOME / "node.bad.json"; badp.write_text(json.dumps(bad))
        r.must_fail([MT, "node", "ledger", "verify", "--config", str(badp)], contains="secret_privkey")
        badp.unlink()
        return {"node_id": cfg["node_id"], "custody": cfg["contests"][CONTEST]["custody"], "cpus": cpus}
    r.step("node.json (threshold-quorum, no secret_privkey; a configured privkey is refused)", nodejson)

    def rekey():
        cer2 = HOME / "ceremony2"
        if cer2.exists():
            shutil.rmtree(cer2)
        r.sh(ceremony_argv(cer2, SET_ID))
        r.must_fail([MT, "node", "ceremony", "verify", "--dir", str(cer2), "--share", token(1), "--share", token(3), "--share", token(5)])
        shutil.rmtree(cer2)
        return {"old_shares_refused_by_new_commitment": True}
    r.step("re-key drill (old tokens fail the new commitment)", rekey)

    r.write()


# ---------------------------------------------------------------------------
# TIER 2 — import, refusals, the quorum run, export
# ---------------------------------------------------------------------------

def tier2(r: Runner):
    V = load_versions()
    exchange_in = HOME / "in" / "exchange"
    cfgp = HOME / ".mt-eval" / "node.json"
    cfg = read_json(cfgp)
    state_dir = Path(cfg["airgap"]["state_dir"]).expanduser()
    out_ex = HOME / "out" / "exchange"
    # The public half of the key node.json actually signs with — derived from
    # the configured private key, never "the first *.pub.json lying around"
    # (an earlier pass's key would verify nothing and say so far too late).
    signing_key = Path(cfg["signing_key"]).expanduser()
    signing_pub = signing_key.with_name(
        signing_key.name.replace(".key.json", ".pub.json"))
    if not signing_pub.is_file():
        raise RehearsalFailure(
            f"node.json signs with {signing_key} but its public half "
            f"{signing_pub} is not on this machine")

    meta_p = exchange_in / "rehearsal-meta.json"
    meta = read_json(meta_p) if meta_p.exists() else {}

    # One ceremony per SEALED SET (tier 1 held two), so the custodian tokens a
    # run needs depend on which set the request targets. Picking the wrong pile
    # is not a near miss — the unseal refuses it by name.
    def tokens_for(request_id: str) -> Path:
        return (HOME / "tokens-t2" if request_id == meta.get("db_request_id")
                else HOME / "tokens")

    def token_in(tokdir: Path, i: int) -> str:
        return str(next((tokdir / str(i)).glob("*.json")))

    def fresh_state():
        """One rehearsal, one chain. Requests and the local ledger from an
        earlier pass would make the ledger-tail assertions read somebody
        else's events and leave stale rejected requests in the plaintext
        sweep. A real node never does this — it is a rehearsal affordance and
        it is named as one."""
        n = 0
        if state_dir.exists():
            n = len([d for d in state_dir.iterdir() if d.is_dir()])
            shutil.rmtree(state_dir)
        state_dir.mkdir(parents=True)
        r.sh([MT, "node", "ledger", "verify"])  # an empty chain verifies
        return {"cleared_requests": n,
                "note": "rehearsal affordance: a fresh state dir + empty ledger per pass"}
    r.step("start from a clean node state (fresh authorization ledger)", fresh_state)

    def wire_run_sets():
        """Everything this node is about to score, declared before it runs.

        The DB-backed contest's SECRET set and its sealed HOLDOUT split (one
        custodian group, one ceremony — contract D1), plus the contest's frozen
        prize-terms hash so the acceptance in the entry's manifest is CHECKED
        here rather than only warned about. And, for the DB-less staged
        request, the qualifier facts the exchange cannot carry: no relay wrote
        it, so the organizer declares the public gate on the scoring machine
        (`qualifier` + `dev_corpus`, both or neither).
        """
        detail: dict = {}
        staged_dev = meta.get("staged_qualifier_corpus")
        if staged_dev and meta.get("staged_qualifier"):
            dev_src = exchange_in / str(staged_dev)
            if not dev_src.is_file():
                raise RehearsalFailure(
                    f"the IN drive names a staged qualifier corpus "
                    f"{staged_dev!r} that is not on the medium")
            dev_dst = HOME / "sets"; dev_dst.mkdir(exist_ok=True)
            dev = dev_dst / dev_src.name
            shutil.copy(dev_src, dev)
            cfg["contests"][V["CONTEST_ID"]]["qualifier"] = meta["staged_qualifier"]
            cfg["contests"][V["CONTEST_ID"]]["dev_corpus"] = str(dev)
            detail["staged_gate"] = meta["staged_qualifier"]["qualifier_id"]
        if meta.get("db_contest"):
            dst = HOME / "sealed-db"; dst.mkdir(exist_ok=True)
            art_src = find_one(exchange_in / "secret", Path(meta["db_secret_artifact"]).name)
            art = dst / art_src.name; shutil.copy(art_src, art)
            grep_absent(SECRET_TOKEN, [art])
            base = cfg["contests"][V["CONTEST_ID"]]
            entry = {k: v for k, v in base.items()
                     if k not in ("secret_set_id", "secret_artifact",
                                  "qualifier", "dev_corpus")}
            entry.update({"secret_set_id": meta["db_sealed_set_id"],
                          "secret_artifact": str(art),
                          "custody": "threshold-quorum"})
            if meta.get("db_holdout_set_id"):
                h_src = find_one(exchange_in / "secret", Path(meta["db_holdout_artifact"]).name)
                hold = dst / h_src.name; shutil.copy(h_src, hold)
                grep_absent(SECRET_TOKEN, [hold])
                entry["holdout_set_id"] = meta["db_holdout_set_id"]
                entry["holdout_corpus"] = str(hold)
                detail["holdout"] = meta["db_holdout_set_id"]
            if meta.get("db_prize_terms_sha256"):
                entry["prize_terms_sha256"] = meta["db_prize_terms_sha256"]
                detail["prize_terms_sha256"] = meta["db_prize_terms_sha256"][:16] + "…"
            cfg["contests"][meta["db_contest"]] = entry
            detail.update({"db_contest": meta["db_contest"],
                           "sealed_set": meta["db_sealed_set_id"]})
        cfgp.write_text(json.dumps(cfg, indent=2))
        # The config must LOAD — every declared file present, every pin
        # matching, the terms hash well-formed — before a single request is
        # imported. `ledger verify` is the cheapest verb that loads it.
        r.sh([MT, "node", "ledger", "verify"])
        # And a malformed terms hash must be refused at startup, not accepted
        # and then silently mismatched against every honest entry.
        if meta.get("db_prize_terms_sha256"):
            bad = json.loads(cfgp.read_text())
            bad["contests"][meta["db_contest"]]["prize_terms_sha256"] = "not-a-digest"
            badp = HOME / "node.bad-terms.json"; badp.write_text(json.dumps(bad))
            r.must_fail([MT, "node", "ledger", "verify", "--config", str(badp)],
                        contains="prize_terms_sha256")
            badp.unlink()
        return detail
    r.step("wire the run's sets into node.json (DB contest secret + sealed HOLDOUT under one custody group, "
           "frozen prize-terms hash, staged request's declared public gate; a malformed hash is refused)",
           wire_run_sets)

    r.step("IN-drive manifest verifies", lambda: (r.sh([MT, "node", "manifest", "verify", str(exchange_in)]), {})[-1])

    def import_():
        r.sh([MT, "node", "import-bundle", str(exchange_in)])
        rids = sorted(p.name for p in (exchange_in / "requests").iterdir() if p.is_dir())
        states = {}
        for rid in rids:
            st = read_json(state_dir / rid / "state.json")
            states[rid] = st.get("status")
            if st.get("status") != "imported":
                raise RehearsalFailure(f"{rid} imported with status {st.get('status')}: {st}")
        r.artifacts["requests"] = states
        return states
    r.step("import-bundle → every request 'imported'", import_)

    rids = list(r.artifacts["requests"])
    rid0 = rids[0]

    tok0 = tokens_for(rid0)

    def wrong_ceremony():
        """The OTHER set's custodians cannot open this one."""
        other = (HOME / "tokens" if tok0.name == "tokens-t2" else HOME / "tokens-t2")
        before = len(ledger_events(state_dir))
        out = r.must_fail([MT, "node", "run-method", rid0, "--offline",
                           "--share", token_in(other, 1), "--share", token_in(other, 3),
                           "--share", token_in(other, 5), "--assert-airgap"],
                          contains="wrong ceremony for this sealed set")
        evs = ledger_events(state_dir)
        if "single_party_attempt_blocked" not in evs[before:]:
            raise RehearsalFailure(
                f"a wrong-ceremony attempt was refused but not LOGGED: {evs[before:]}")
        if read_json(state_dir / rid0 / "state.json").get("status") != "imported":
            raise RehearsalFailure("state advanced after a refused wrong-ceremony attempt")
        r.sh([MT, "node", "ledger", "verify"])
        return {"refused": next((ln.strip() for ln in out.splitlines()
                                 if "wrong ceremony" in ln), "")[:180]}
    r.step("a QUORUM from the OTHER sealed set's custodians is refused AND logged "
           "(one ceremony per set; a key is not a licence to open a different set)",
           wrong_ceremony)

    def subquorum():
        before = len(ledger_events(state_dir))
        r.must_fail([MT, "node", "run-method", rid0, "--offline", "--share", token_in(tok0, 1), "--share", token_in(tok0, 2), "--assert-airgap"])
        evs = ledger_events(state_dir)
        if "single_party_attempt_blocked" not in evs[before:]:
            raise RehearsalFailure(f"no single_party_attempt_blocked on the ledger after a 2-share attempt: {evs[before:]}")
        if read_json(state_dir / rid0 / "state.json").get("status") != "imported":
            raise RehearsalFailure("state advanced after a refused sub-quorum attempt")
        r.sh([MT, "node", "ledger", "verify"])
        return {"blocked_event": True}
    r.step("sub-quorum (2 of 3 required) refused AND logged; ledger verifies", subquorum)

    def custody():
        before = len(ledger_events(state_dir))
        r.must_fail([MT, "node", "run-method", rid0, "--offline", "--assert-airgap"], contains="threshold-quorum")
        if len(ledger_events(state_dir)) != before:
            raise RehearsalFailure("ledger grew on a no-share attempt")
        return {"refused_naming_custody": True}
    r.step("no shares at all → refused naming custody 'threshold-quorum'", custody)

    def quorum(rid):
        def run():
            before = len(ledger_events(state_dir))
            is_db = rid == meta.get("db_request_id")
            expect_holdout = bool(is_db and meta.get("db_holdout_set_id"))
            tok = tokens_for(rid)
            r.sh([MT, "node", "run-method", rid, "--offline", "--share", token_in(tok, 1), "--share", token_in(tok, 3), "--share", token_in(tok, 5), "--assert-airgap"], timeout=3600)
            st = read_json(state_dir / rid / "state.json")
            if st.get("status") != "scored":
                raise RehearsalFailure(f"{rid} status {st.get('status')} after quorum run: {st}")

            # -- the public gate, MEASURED on this air-gapped machine --------
            # Exchange version 2 ships the qualifiers row and the public dev
            # corpus with every relayed request; the DB-less staged lane gets
            # them from node.json. Either way the node re-executes the method
            # and gates on what IT measured, never on the participant's claim.
            gate = st.get("qualifier_gate") or {}
            want_source = "exchange" if is_db else "node.json"
            if not gate.get("verified") or not gate.get("eligible"):
                raise RehearsalFailure(
                    f"{rid}: the public qualifier gate was not measured here "
                    f"({gate!r}) — an air-gapped node must re-execute it "
                    f"before it opens anything sealed.")
            if gate.get("source") != want_source:
                raise RehearsalFailure(
                    f"{rid}: qualifier gate facts came from "
                    f"{gate.get('source')!r}, expected {want_source!r}")

            # -- the chain: one request, three votes, one grant, both splits --
            tail_recs = ledger_records(state_dir)[before:]
            tail = [t.get("event") or t.get("event_type") for t in tail_recs]
            want = ["request_created", "vote_cast", "vote_cast", "vote_cast", "request_authorized", "grant_minted", "grant_used"]
            if tail != want:
                raise RehearsalFailure(f"ledger tail {tail} != {want}")
            created = tail_recs[0].get("detail") or {}
            arts = created.get("artifacts") or []
            want_arts = 2 if expect_holdout else 1
            if len(arts) != want_arts:
                raise RehearsalFailure(
                    f"{rid}: request_created names {len(arts)} sealed "
                    f"artifact(s), expected {want_arts}: {arts}")
            roles = [a.get("role") for a in arts]
            if roles != (["main", "holdout"] if expect_holdout else ["main"]):
                raise RehearsalFailure(f"{rid}: artifact roles {roles}")
            if any(not a.get("ciphertext_digest") for a in arts):
                raise RehearsalFailure(
                    f"{rid}: an artifact in the chain has no ciphertext "
                    f"digest — the ledger has to say WHICH bytes the quorum "
                    f"was asked to open: {arts}")
            used = (tail_recs[-1].get("detail") or {})
            want_sets = ["main", "holdout"] if expect_holdout else ["main"]
            if used.get("sets") != want_sets:
                raise RehearsalFailure(
                    f"{rid}: grant_used.detail.sets is {used.get('sets')!r}, "
                    f"expected {want_sets} (contract D1: one grant, every "
                    f"split it covered, named on the chain)")

            # -- the holdout is a SECOND full result, built and validated here
            holdout = st.get("holdout") or {}
            if expect_holdout:
                if holdout.get("sealed_set_id") != meta["db_holdout_set_id"]:
                    raise RehearsalFailure(
                        f"{rid}: holdout result labels set "
                        f"{holdout.get('sealed_set_id')!r}, expected "
                        f"{meta['db_holdout_set_id']!r}")
                if not (holdout.get("row") or {}).get("id"):
                    raise RehearsalFailure(f"{rid}: holdout carries no run-card row")
                if holdout["row"]["id"] == st.get("card_id"):
                    raise RehearsalFailure(
                        f"{rid}: the holdout row reuses the main card id — "
                        f"two splits, two cards")
            elif holdout:
                raise RehearsalFailure(
                    f"{rid}: a holdout result appeared on a contest that "
                    f"declares none: {holdout}")

            man = find_one(state_dir / rid, "score-manifest.json")
            sig = man.with_name(man.name + ".sig.json")
            if not sig.exists():
                raise RehearsalFailure("score manifest not signed")
            m = read_json(man)
            _, head = r.sh([MT, "node", "ledger", "head"])
            if (m.get("auditHead") or m.get("audit_head")) not in head:
                raise RehearsalFailure(f"manifest auditHead not the ledger head:\n{head}")
            r.sh([MT, "node", "verify-manifest", str(man), "--sig", str(sig), "--pubkey", str(signing_pub)])
            r.artifacts.setdefault("scored", {})[rid] = {
                "qualifier_score": st.get("qualifier_score"), "quorum": (st.get("authorization") or {}).get("quorum"),
                "qualifier_gate": gate, "grant_sets": used.get("sets"),
                "holdout": {"sealed_set_id": holdout.get("sealed_set_id"),
                            "card_id": holdout.get("card_id"),
                            "qualifier_score": holdout.get("qualifier_score")} if holdout else None,
                "methodSha256": m.get("methodSha256") or m.get("method_sha256"), "auditHead": m.get("auditHead") or m.get("audit_head")}
            r.artifacts.setdefault("ledger_tail", {})[rid] = tail_recs
            return {k: v for k, v in r.artifacts["scored"][rid].items() if k != "qualifier_gate"}
        return run
    for rid in rids:
        r.step(f"quorum run {rid} (3 shares, real Docker --network=none) → qualifier re-executed air-gapped, "
               f"main + holdout under ONE ceremony, ledger tail exact, manifest anchored + signed", quorum(rid))

    def teardown():
        _, imgs = r.sh(["docker", "image", "ls", "--filter", "reference=mteval-method-*", "-q"])
        _, ctrs = r.sh(["docker", "ps", "-a", "--filter", "name=mteval-run-", "-q"])
        if imgs.strip() or ctrs.strip():
            raise RehearsalFailure(f"leftover images/containers: {imgs.strip()} {ctrs.strip()}")
        for rid in rids:
            if (state_dir / rid / "scratch").exists():
                raise RehearsalFailure(f"scratch dir survived for {rid}")
        return {"images": 0, "containers": 0}
    r.step("teardown proof (no method images, no run containers, no scratch)", teardown)

    def plaintext():
        roots = [state_dir, HOME / "out", HOME / ".mt-eval" / "node.json", HOME / "in" / "exchange", HOME / "sealed", HOME / "sealed-db"]
        # SECRET_TOKEN is a reference-side token of the tier-1 fixture this
        # node sealed itself; db_canaries are tokens that exist ONLY inside
        # the relay contest's sealed splits (the organizer derived them from
        # what it sealed). Every one of them must be absent from everything
        # that stays on, or leaves, this machine.
        tokens = [SECRET_TOKEN] + list(meta.get("db_canaries") or [])
        if len(tokens) < 2:
            raise RehearsalFailure(
                "the IN drive carried no sealed-split canaries, so this step "
                "would only prove the tier-1 fixture stayed sealed — re-run "
                "phase-a to write them into rehearsal-meta.json.")
        rep = {"tokens": len(tokens), "files_scanned": 0}
        for tok in tokens:
            one = grep_absent(tok, roots, exclude_dirs=("runs",),
                              exclude_names=("rehearsal-meta.json",))
            rep["files_scanned"] = one["files_scanned"]
        rep["excluded"] = ("runs/ (RunLog/TestReport carry references by "
                           "design and never leave the node); "
                           "rehearsal-meta.json (the rehearsal's own "
                           "instrument — it LISTS the canaries, and a real "
                           "IN medium carries no such file)")
        return rep
    r.step("plaintext-never-survived grep over every sealed-split canary "
           "(state, out, ledger, manifest, node.json; runs/ excluded)", plaintext)

    def export():
        if out_ex.exists():
            shutil.rmtree(out_ex)
        out_ex.mkdir(parents=True)
        # The rehearsal meta rides back with the scores: the relay leg reads
        # it out of ~/exchange-return to know which request is the DB-backed
        # one and which sets it covered. Ids only — the plaintext grep below
        # covers it like everything else on the medium.
        if meta_p.exists():
            shutil.copy(meta_p, out_ex / meta_p.name)
        r.sh([MT, "node", "export-scores", str(out_ex)])
        bundles = list(out_ex.rglob("score-bundle.json"))
        if len(bundles) != len(rids):
            raise RehearsalFailure(f"expected {len(rids)} score bundles, found {len(bundles)}")
        carried = {}
        for b in bundles:
            if not b.with_name(b.name + ".sig.json").exists():
                raise RehearsalFailure(f"{b} unsigned")
            doc = read_json(b)
            if doc.get("status") != "scored":
                raise RehearsalFailure(f"{b} status {doc.get('status')}")
            rid = doc["request_id"]
            # The gate verdict crosses the gap with the scores: the relay must
            # be able to say the public gate was measured, and by whom.
            g = doc.get("qualifier_gate") or {}
            if not g.get("verified"):
                raise RehearsalFailure(
                    f"{b}: the score bundle carries no measured qualifier "
                    f"gate ({g!r}) — the relay would publish a score whose "
                    f"admission nobody can check.")
            h = doc.get("holdout")
            if rid == meta.get("db_request_id") and meta.get("db_holdout_set_id"):
                if not h or h.get("sealed_set_id") != meta["db_holdout_set_id"]:
                    raise RehearsalFailure(
                        f"{b}: the holdout result is missing from the OUT "
                        f"bundle ({h!r}) — the contest promised it would be "
                        f"scored in this run.")
            elif h:
                raise RehearsalFailure(f"{b}: unexpected holdout result {h!r}")
            carried[rid] = {"gate": g.get("source"),
                            "holdout": (h or {}).get("sealed_set_id")}
        bad = [str(p) for p in out_ex.rglob("*") if p.is_file() and re.search(r"report|run_log|runlog", p.name, re.I)]
        if bad:
            raise RehearsalFailure(f"per-entry artifacts on the OUT medium: {bad}")
        for tok in [SECRET_TOKEN] + list(meta.get("db_canaries") or []):
            grep_absent(tok, [out_ex], exclude_names=("rehearsal-meta.json",))
        r.sh([MT, "node", "manifest", "write", str(out_ex), "--direction", "out", "--note", "rehearsal OUT drive: signed scores only"])
        return {"bundles": len(bundles), "carried": carried}
    r.step("export signed scores carrying the gate verdict and the holdout result "
           "(scores only, no reports, no plaintext) + OUT manifest", export)

    r.write()


# ---------------------------------------------------------------------------
# PHASE A — the connected organizer against the local Supabase stack
# ---------------------------------------------------------------------------

def _supabase_env() -> dict:
    p = HOME / "supabase-out" / "status.env"
    if not p.exists():
        raise RehearsalFailure("no ~/supabase-out/status.env — run reset.sh (rehearse.sh supabase) first")
    kv = {}
    for line in p.read_text().splitlines():
        m = re.match(r'^([A-Z_]+)="?(.*?)"?$', line.strip())
        if m:
            kv[m.group(1)] = m.group(2)
    url = kv.get("API_URL") or kv.get("SUPABASE_URL")
    anon = kv.get("ANON_KEY") or kv.get("PUBLISHABLE_KEY")
    service = kv.get("SERVICE_ROLE_KEY") or kv.get("SECRET_KEY")
    if not (url and anon and service):
        raise RehearsalFailure(f"status.env lacks API_URL/ANON_KEY/SERVICE_ROLE_KEY; keys: {sorted(kv)}")
    if not re.match(r"^https?://(127\.0\.0\.1|localhost)[:/]", url):
        raise RehearsalFailure(f"refusing: Supabase URL is not loopback: {url}")
    return {"MT_EVAL_SUPABASE_URL": url, "MT_EVAL_SUPABASE_ANON_KEY": anon,
            "MT_EVAL_SUPABASE_SERVICE_KEY": service, "SUPABASE_SERVICE_KEY": service,
            "MT_EVAL_TOKEN_PATH": str(HOME / "rehearsal" / "auth.json"),
            "CHAMPOLLION_CLI": str(HOME / "src" / "champollion" / "cli" / "bin" / "cli.js"),
            "DB_URL": kv.get("DB_URL", "")}


# Two DISTINCT identities, because the contest's promises are about two
# different people: the ORGANIZER owns the contest row (created_by — what
# `close` and `rank --reveal-identities` check standing against) and the
# PARTICIPANT enters it (the JWT the 045 door binds requested_by to). Running
# both under one login would prove neither refusal.
IDENTITIES = {
    "organizer": ("organizer@example.test", "rehearsal-org-2026"),
    "participant": ("participant@example.test", "rehearsal-pass-2026"),
}


def _signup(env: dict, email: str, password: str) -> str:
    """Sign an identity up on the local GoTrue; return its refresh token."""
    key = env["MT_EVAL_SUPABASE_ANON_KEY"]
    payload = json.dumps({"email": email, "password": password}).encode()
    for path in ("/auth/v1/signup", "/auth/v1/token?grant_type=password"):
        req = urllib.request.Request(
            env["MT_EVAL_SUPABASE_URL"] + path, method="POST", data=payload,
            headers={"apikey": key, "Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                doc = json.loads(resp.read().decode())
        except urllib.error.HTTPError as exc:
            body = exc.read().decode()
            if path.endswith("signup") and "already" in body.lower():
                continue  # an earlier run created them → password grant
            raise RehearsalFailure(
                f"{path} for {email} → HTTP {exc.code}: {body[:400]}")
        tok = doc.get("refresh_token")
        if not tok:
            raise RehearsalFailure(
                f"{path} for {email} returned no refresh_token "
                f"(keys: {sorted(doc)})")
        return tok
    raise RehearsalFailure(f"could not obtain a session for {email}")


def _identity_env(base: dict, name: str) -> dict:
    """A complete subprocess environment for one signed-in identity."""
    email, password = IDENTITIES[name]
    env = dict(base)
    env["MT_EVAL_TOKEN_PATH"] = str(HOME / "rehearsal" / f"auth-{name}.json")
    env["MT_EVAL_REFRESH_TOKEN"] = _signup(base, email, password)
    Path(env["MT_EVAL_TOKEN_PATH"]).parent.mkdir(parents=True, exist_ok=True)
    return env


def _phase_a_state_path() -> Path:
    return HOME / "rehearsal" / "phase-a-state.json"


def _rest(env: dict, path: str, *, service: bool = True, method: str = "GET", body=None, prefer: str | None = None):
    key = env["MT_EVAL_SUPABASE_SERVICE_KEY"] if service else env["MT_EVAL_SUPABASE_ANON_KEY"]
    h = {"apikey": key, "Authorization": f"Bearer {key}", "Accept": "application/json"}
    if body is not None:
        h["Content-Type"] = "application/json"
    if prefer:
        h["Prefer"] = prefer
    req = urllib.request.Request(env["MT_EVAL_SUPABASE_URL"] + path, method=method,
                                 data=json.dumps(body).encode() if body is not None else None, headers=h)
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            raw = resp.read().decode()
            return json.loads(raw) if raw.strip() else None
    except urllib.error.HTTPError as exc:
        raise RehearsalFailure(f"{method} {path} → HTTP {exc.code}: {exc.read().decode()[:800]}")


def phase_a(r: Runner):
    V = load_versions()
    env = _supabase_env()
    src = HOME / "src" / "champollion"
    fx = src / "arena" / "tests" / "fixtures" / "contest_synthetic"
    work = HOME / "contest"; work.mkdir(exist_ok=True)
    node_pub_dir = HOME / "node-public"
    cer_json = node_pub_dir / "ceremony.json"
    # The relay contest's own ceremony: one ceremony per sealed set, so the
    # secret + holdout splits are sealed to the key whose shares carry THIS
    # set's id (quorum_unseal_for_run refuses a relabelled artifact).
    relay_cer_json = node_pub_dir / "ceremony-t2.json"
    for pth in (cer_json, relay_cer_json):
        if not pth.exists():
            raise RehearsalFailure(
                f"{pth} missing (carry both ceremony.json files from the "
                f"node's tier-1 OUT)")
    sign_pub = next(node_pub_dir.glob("*.pub.json"), None)
    if not sign_pub:
        raise RehearsalFailure("~/node-public/*.pub.json missing (the node's score-signing public key)")
    exchange = HOME / "exchange"
    if exchange.exists():
        shutil.rmtree(exchange)
    exchange.mkdir()

    def master():
        dev = read_json(fx / "corpus_dev.json")["entries"]; blind = read_json(fx / "corpus_blind_refs.json")["entries"]
        ents = [{"id": i, "source": e["source"], "reference": e["reference"]} for i, e in enumerate(dev + blind)]
        doc = {"dataset": {"corpus_id": "eval-qaa-qab-synth-master", "version": "1.0",
                           "language_pair": {"source": "qaa", "target": "qab"},
                           "description": "SYNTHETIC rehearsal master (12 toy pairs; generated at run time, never tracked)",
                           "provenance": {"license": "CC0-1.0"}}, "entries": ents}
        (work / "master.json").write_text(json.dumps(doc, indent=2))
        # A SECOND master for the relay contest, with a vocabulary that
        # appears nowhere else. The plaintext-never-survived proof needs
        # tokens that live ONLY inside the sealed splits: the two contests
        # partition their corpora independently, so an entry sealed by one can
        # legitimately be published by the other, and a canary drawn from a
        # shared corpus proves nothing. Generated at run time, never tracked.
        t2_ents = []
        for i in range(12):
            src = f"qzeta{i:02d}a qzeta{i:02d}b qzeta{i:02d}c"
            t2_ents.append({"id": i, "source": src, "reference": toy_translate(src)})
        (work / "master-t2.json").write_text(json.dumps(
            {"dataset": {"corpus_id": "eval-qaa-qab-synth-t2-master", "version": "1.0",
                         "language_pair": {"source": "qaa", "target": "qab"},
                         "description": ("SYNTHETIC rehearsal master for the RELAY contest "
                                         "(12 toy pairs, disjoint vocabulary; generated at "
                                         "run time, never tracked)"),
                         "provenance": {"license": "CC0-1.0"}},
             "entries": t2_ents}, indent=2))
        return {"entries": len(ents), "relay_entries": len(t2_ents)}
    r.step("two master corpora: the synthetic fixtures (12) and a disjoint-vocabulary "
           "relay master (12, so the sealed splits have their own canary tokens)", master)

    # The organizer's session has to exist BEFORE `contest prepare`:
    # register_prepared → contest.create_contest stamps created_by from the
    # JWT email (migration 052), so a prepare run with no session has nothing
    # to stamp and no owner to close the contest later.
    envs: dict = {}

    def identities():
        for name in IDENTITIES:
            envs[name] = _identity_env(env, name)
        r.artifacts["identities"] = {n: IDENTITIES[n][0] for n in IDENTITIES}
        return {n: IDENTITIES[n][0] for n in IDENTITIES}
    r.step("two identities on the local GoTrue (organizer owns the contest, "
           "participant enters it; refresh tokens, no browser)", identities)

    def prepare(slug, *, plaintext, sizes, auth_model, extra, corpus="master.json"):
        def run():
            outd = work / slug
            if outd.exists():
                shutil.rmtree(outd)
            argv = [MT, "contest", "prepare", "--corpus", str(work / corpus), "--slug", slug,
                    "--name", f"Synthetic {slug}", "--pair", "qaa>qab", "--dev-size", str(sizes[0]),
                    "--blind-size", str(sizes[1]), "--secret-size", str(sizes[2]), "--seed", "20260906",
                    "--qualifier-threshold", "35", "--authorization-model", auth_model,
                    "--custodian-group", V["CEREMONY_GROUP"], "--year", "2026", "--out", str(outd),
                    "--license", "CC0-1.0", "--visibility", "public", "--use-context", "non-commercial"] + extra
            if plaintext:
                argv.append("--plaintext-refs")
            r.sh(argv, env=envs["organizer"], timeout=600)
            man = read_json(outd / "local" / "manifest.json")
            # The prepared manifest records the SLUG it was prepared under;
            # the registered id is create_contest's slugified NAME, which is
            # not the same string. Look the row up by the one identifier both
            # sides agree on — the sealed set the contest ranks (its
            # corpus_id) — rather than re-deriving somebody else's slug rule.
            secret_id = (man.get("secret") or {}).get("sealed_set_id")
            if not secret_id:
                raise RehearsalFailure(
                    f"prepared manifest for {slug} names no secret sealed set")
            rows = _rest(env, f"/rest/v1/contests?corpus_id=eq.{secret_id}"
                              f"&select=id,lane,intake_open,authorization_model,status")
            if not rows:
                raise RehearsalFailure(
                    f"no contest registered against sealed set {secret_id}")
            if len(rows) != 1:
                raise RehearsalFailure(
                    f"{len(rows)} contests point at sealed set {secret_id}: "
                    f"{[r['id'] for r in rows]}")
            cid = rows[0]["id"]
            q = _rest(env, f"/rest/v1/qualifiers?qualifier_id=eq.{man['qualifier']['qualifier_id']}&select=qualifier_id")
            if not q:
                raise RehearsalFailure("qualifier row missing")
            r.artifacts.setdefault("contests", {})[slug] = {"id": cid, "manifest": str(outd / "local" / "manifest.json"),
                                                            "row": rows[0], "qualifier": man["qualifier"]["qualifier_id"],
                                                            "dev_corpus": man["qualifier"]["corpus_file"],
                                                            "blind": (man.get("blind") or {}).get("sealed_set_id"),
                                                            "secret": (man.get("secret") or {}).get("sealed_set_id"),
                                                            "secret_artifact": (man.get("secret") or {}).get("corpus_sealed_artifact"),
                                                            "holdout": (man.get("holdout") or {}).get("sealed_set_id"),
                                                            "holdout_artifact": (man.get("holdout") or {}).get("corpus_sealed_artifact")}
            md = _rest(env, f"/rest/v1/contests?id=eq.{cid}&select=metadata")[0]["metadata"] or {}
            declared_holdout = md.get("sealed_holdout_set_id")
            expected_holdout = (man.get("holdout") or {}).get("sealed_set_id")
            if declared_holdout != expected_holdout:
                raise RehearsalFailure(
                    f"prepare sealed holdout {expected_holdout!r} but "
                    f"contests.metadata.sealed_holdout_set_id is "
                    f"{declared_holdout!r} — the promise and the artifact "
                    f"must name the same set.")
            r.artifacts["contests"][slug]["metadata"] = md
            return {"contest": cid, "lane": rows[0]["lane"],
                    "intake_open": rows[0]["intake_open"],
                    "holdout": declared_holdout,
                    "results_visibility": md.get("results_visibility"),
                    "prize_disposition": (md.get("prize_terms") or {}).get("disposition")}
        return run

    # The ORGANIZER's own sealing key. A WAVE-1 STAND-IN: one X25519 keypair,
    # not an M-of-N group key — the honest shape for a connected organizer
    # node that holds its own sealed set. The threshold ceremony belongs to
    # the air-gapped node (tier 1/2) and the T2 contest below is sealed to it.
    def organizer_key():
        keys = HOME / "organizer-keys"
        # A FRESH keypair per run: `seal-corpus keygen` adds a file rather
        # than replacing one, and picking "the first sorted" out of a pile
        # would seal this run's corpus to one key and configure the node with
        # another.
        if keys.exists():
            shutil.rmtree(keys)
        keys.mkdir()
        r.sh(["node", env["CHAMPOLLION_CLI"], "seal-corpus", "keygen", "--out", str(keys)], env=env)
        pub = next(iter(sorted(keys.glob("threshold-*.pub.json"))), None)
        priv = next(iter(sorted(keys.glob("threshold-*.key.json"))), None)
        if not pub or not priv:
            raise RehearsalFailure(f"seal-corpus keygen wrote no keypair into {keys}")
        r.artifacts["organizer_key"] = {"pub": str(pub), "priv": str(priv)}
        return {"pub": pub.name, "priv": priv.name, "note": "wave-1 single-key stand-in"}
    r.step("organizer sealing keypair (seal-corpus keygen — single-key stand-in, labelled)", organizer_key)

    # R2: a contest is entered by handing a METHOD to the node, so BOTH
    # contests are sealed and neither has a blind (source-public) tier.
    #   synth    — executed HERE, by this connected organizer node, against a
    #              secret set sealed to the organizer's own key.
    #   synth-t2 — relayed to the AIR-GAPPED node: sealed to the ceremony's
    #              custodian-group key, which this machine cannot open.
    r.step("prepare the LOCAL contest (6 dev + 6 secret sealed to the organizer's key, per-submission)",
           prepare("synth", plaintext=False, sizes=(6, 0, 6), auth_model="per-submission",
                   extra=["--threshold-pubkey", r.artifacts["organizer_key"]["pub"]]))
    # The RELAY contest carries everything the sovereign practices promise:
    # a SECOND sealed split (practice 7, scored inside the same authorized
    # run and withheld until close), results withheld until close (practice
    # 6), pseudonyms while open (practice 2), and ONE declared prize term
    # (R1-trinary). All four are frozen by migration 074 once it has entries.
    r.step("prepare the RELAY contest (4 dev + 4 secret + 4 sealed HOLDOUT to the AIR-GAP node's "
           "custodian-group key; hidden_until_close, anonymised, prize disposition retain_ip)",
           prepare("synth-t2", plaintext=False, sizes=(4, 0, 4), auth_model="per-submission",
                   corpus="master-t2.json",
                   extra=["--threshold-pubkey", group_public_key_b64(relay_cer_json),
                          "--sealed-holdout-size", "4",
                          "--results-visibility", "hidden_until_close",
                          "--anonymize-until-close",
                          "--prize-disposition", "retain_ip"]))
    t1 = r.artifacts["contests"]["synth"]; t2 = r.artifacts["contests"]["synth-t2"]
    if t2["secret"] != V["RELAY_SET_ID"]:
        raise RehearsalFailure(
            f"the relay contest sealed {t2['secret']!r} but the node held a "
            f"ceremony for {V['RELAY_SET_ID']!r} (versions.env RELAY_SET_ID) "
            f"— the custodians would hold shares for a set that does not "
            f"exist.")

    # --- The R2 entry path: qualify locally, then hand the METHOD over -------
    # Founder ruling R2 (2026-09-06) retired `contest submit-hypotheses`; a
    # contest is entered by giving the organizer's node something it can RUN.
    # The admission gate is the participant's own score on the PUBLIC dev set,
    # written as a receipt — which the node then re-executes for itself before
    # any grant is minted.
    ex = src / "arena" / "examples" / "lane-b-toy-method"
    receipts = work / "receipts"

    def entry_declarations(track="constrained", primary=True):
        """Contract C2 — every entry declares its own track, size, licence."""
        return ["--track", track,
                # The toy method is rule-based: it has no trainable parameters
                # at all, and the vocabulary has no "not applicable", so the
                # smallest positive integer is declared and named as such.
                # rule-based: no trainable parameters (0 is the honest
                # declaration; admissible since 2026-09-07)
                "--parameter-count", "0",
                "--weights-license", "CC0-1.0", "--weights-public",
                "--training-data-file", str(ex / "training-data.txt"),
                "--primary" if primary else "--contrastive",
                # What the toy method actually needs. The manifest defaults
                # (8 GB / 10 GB / 120 min) describe a large neural system; a
                # node with smaller caps refuses a bundle that asks for more
                # than it has, so a rule-based method that declares 8 GB is
                # refused for a number nobody chose.
                "--ram-gb", "1", "--disk-gb", "1", "--max-runtime-minutes", "10",
                "--receipt-dir", str(receipts)]

    def qualify():
        receipts.mkdir(parents=True, exist_ok=True)
        out = {}
        for c in (t1, t2):
            dev_path = Path(c["dev_corpus"])
            hyp = work / f"dev-{c['id']}.txt"
            dev = read_json(dev_path)
            hyp.write_text("\n".join(toy_translate(e["source"]) for e in dev["entries"]) + "\n")
            r.sh([MT, "contest", "qualify", c["id"], "--dev", str(hyp), "--dev-corpus", str(dev_path),
                  "--system", "toy-swap", "--method-class", "pipeline", "--paradigm", "rule-based",
                  "--receipt-dir", str(receipts)], env=envs["participant"], timeout=600)
            receipt = read_json(receipts / f"{c['id']}.json")
            if not receipt.get("passed"):
                raise RehearsalFailure(f"qualifier receipt for {c['id']} is not passing: {receipt}")
            out[c["id"]] = receipt["score"]
        return {"receipts": out, "threshold": 35.0}
    r.step("participant: contest qualify on each PUBLIC dev set → passing receipts (the admission gate)", qualify)

    def submit_local():
        argv = [MT, "contest", "submit-method", t1["id"], "--method-dir", str(ex / "method"),
                "--dockerfile", str(ex / "Dockerfile"), "--name", "toy-swap", "--version", "1.0.0",
                "--entrypoint", "method/translate.py", "--method-class", "pipeline", "--paradigm", "rule-based",
                "--developer", "Rehearsal", "--agree", "--node-id", "lima-organizer-1",
                "--secret-set", t1["secret"]] + entry_declarations()
        r.sh(argv, env=envs["participant"], timeout=900)
        rows = _rest(env, f"/rest/v1/authorization_requests?sealed_set_id=eq.{t1['secret']}"
                          f"&select=request_id,state,method_sha&order=created_at.desc")
        if not rows or rows[0]["state"] != "pending":
            raise RehearsalFailure(f"no pending method request on the local contest: {rows}")
        r.artifacts["local_request"] = rows[0]
        return {"request": rows[0]["request_id"], "state": rows[0]["state"]}
    r.step("participant: submit-method to the LOCAL contest (045 door, C2 declarations, receipt embedded)", submit_local)

    def nodejson():
        tpl = read_json(HOME / "deploy" / "templates" / "node.organizer.json"); tpl.pop("_comment", None)
        tpl.pop("_comment_extra_sets", None)
        text = (json.dumps(tpl).replace("__HOME__", str(HOME)).replace("__CONTEST_ID__", t1["id"])
                .replace("__DEV_CORPUS__", t1["dev_corpus"]).replace("__REFS_PLAINTEXT__", "")
                .replace("__SEALED_SET_ID__", t1["secret"] or "").replace("__AIRGAP_VERIFY_KEY__", str(sign_pub)))
        cfg = json.loads(text)
        # The LOCAL contest is a METHOD-lane entry: this node holds the secret
        # set and its own key, and re-executes the qualifier on the dev corpus
        # before every sealed run. There is no refs_* entry — R2 retired the
        # hypotheses drain, so a node that serves it would be serving nothing.
        cfg["contests"][t1["id"]] = {
            "dev_corpus": t1["dev_corpus"],
            "secret_set_id": t1["secret"],
            "secret_artifact": t1["secret_artifact"],
            "secret_privkey": r.artifacts["organizer_key"]["priv"],
            "custody": "single-key",
            "corpus_version": "v1",
            "sandbox": {"cpus": max(1, min(2, os.cpu_count() or 1))},
        }
        # The RELAY contest carries no secret material on this machine at all
        # — but it MUST carry the PUBLIC dev corpus: since exchange version 2
        # the relay copies it into every exported request so the air-gapped
        # node can re-execute the public gate itself, and a contest entry with
        # no dev_corpus exports nothing (fail-safe).
        cfg["contests"][t2["id"]] = {
            "secret_set_id": t2["secret"],
            "dev_corpus": t2["dev_corpus"],
            "corpus_version": "v1",
        }
        # The DB-less staging contest, bound to the AIR-GAP node's id (fingerprints bind to node_id).
        p = HOME / ".mt-eval" / "node.json"; p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(json.dumps(cfg, indent=2))
        stage_cfg = {"node_id": "lima-airgap-1", "contests": {V["CONTEST_ID"]: {"secret_set_id": V["SEALED_SET_ID"], "corpus_version": "v1"}}}
        (HOME / "stage-config.json").write_text(json.dumps(stage_cfg, indent=2))
        return {"contests": sorted(cfg["contests"]), "node_id": cfg["node_id"]}
    r.step("organizer node.json (LOCAL contest = method lane, single-key custody; RELAY contest holds nothing; staging config bound to lima-airgap-1)", nodejson)

    def execute_local():
        rid = r.artifacts["local_request"]["request_id"]
        _, listing = r.sh([MT, "node", "list"], env=envs["organizer"])
        if rid not in listing:
            raise RehearsalFailure(f"node list does not show {rid}:\n{listing}")
        # Per-submission custody: the FIRST run must refuse and wait, even
        # though the static checks and the qualifier re-execution have passed.
        _, held = r.sh([MT, "node", "run-method", rid], env=envs["organizer"], timeout=2400)
        if "waiting for custodian approval" not in held:
            raise RehearsalFailure(f"an unapproved per-submission request did not wait:\n{held[-1500:]}")
        if "qualifier" not in held.lower():
            raise RehearsalFailure(f"the node did not re-execute the qualifier before authorization:\n{held[-1500:]}")
        r.sh([MT, "node", "approve", rid, "--actor", "rehearsal-custodian"], env=envs["organizer"])
        st = _rest(env, f"/rest/v1/authorization_requests?request_id=eq.{rid}&select=state")[0]["state"]
        if st != "authorized":
            raise RehearsalFailure(f"request state after approve: {st}")
        r.sh([MT, "node", "run-method", rid], env=envs["organizer"], timeout=2400)
        subs = _rest(env, f"/rest/v1/contest_submissions?contest_id=eq.{t1['id']}"
                          f"&select=run_card_id,is_primary,track,submitter_label")
        if not subs:
            raise RehearsalFailure("no contest_submissions row after the sealed run")
        if any("@" in (s.get("submitter_label") or "") for s in subs):
            raise RehearsalFailure(f"a participant email leaked into submitter_label: {subs}")
        card = _rest(env, f"/rest/v1/run_cards?id=eq.{subs[0]['run_card_id']}"
                          f"&select=id,trust,condition,dataset_id,chrf_plus_plus,submitter")[0]
        if card["trust"] != "verified" or card["condition"] != "method-execution":
            raise RehearsalFailure(f"run card not verified/method-execution: {card}")
        if card["dataset_id"] != t1["secret"]:
            raise RehearsalFailure(f"run card scored against {card['dataset_id']}, expected the secret set {t1['secret']}")
        if "@" in (card.get("submitter") or ""):
            raise RehearsalFailure(f"the run card's submitter is email-shaped: {card['submitter']}")
        n_entries = _rest(env, f"/rest/v1/run_card_entries?run_card_id=eq.{card['id']}&select=entry_id")
        if n_entries:
            raise RehearsalFailure(f"aggregates-only violated: {len(n_entries)} per-entry rows published")
        evs = _rest(env, f"/rest/v1/authorization_audit_log?request_id=eq.{rid}&select=event_type&order=id.asc")
        names = [e["event_type"] for e in evs]
        if names[:1] != ["request_created"] or "grant_used" not in names:
            raise RehearsalFailure(f"audit trail unexpected: {names}")
        head = _rest(env, "/rest/v1/rpc/authorization_audit_head", method="POST", body={})
        r.artifacts["t1"] = {"run_card": card, "audit": names, "audit_head": head}
        return {"run_card": card["id"], "trust": card["trust"], "condition": card["condition"],
                "chrf": card["chrf_plus_plus"], "entries": 0, "audit": names}
    r.step("node run-method (LOCAL): qualifier re-executed here → custodian hold → approve → grant → Docker "
           "(--network=none) on the sealed set → aggregates-only publish; audit trail exact", execute_local)

    def submit_method():
        argv = [MT, "contest", "submit-method", t2["id"], "--method-dir", str(ex / "method"), "--dockerfile", str(ex / "Dockerfile"),
                "--name", "toy-swap", "--version", "1.0.0", "--entrypoint", "method/translate.py", "--method-class", "pipeline",
                "--paradigm", "rule-based", "--developer", "Rehearsal", "--developer-email", "participant@example.test",
                "--agree", "--node-id", "lima-airgap-1", "--pair", "qaa>qab", "--secret-set", t2["secret"]] + entry_declarations()
        # This contest declares a PRIZE TERM, so the entry has to accept it
        # explicitly (P2/R1-trinary). The first run is expected to REFUSE and
        # print the term in plain language with its hash — that refusal is the
        # documented way a participant reads the terms, so it is exercised
        # here rather than short-circuited by looking the hash up in the DB.
        refusal = r.must_fail(argv, env=envs["participant"],
                              contains="--accept-terms")
        m = re.search(r"Terms hash:\s*([0-9a-f]{64})", refusal)
        if not m:
            raise RehearsalFailure(
                f"submit-method refused without printing the terms hash a "
                f"participant is supposed to accept:\n{refusal[-1500:]}")
        terms_sha = m.group(1)
        row_terms = (r.artifacts["contests"]["synth-t2"]["metadata"]
                     or {}).get("prize_terms") or {}
        if row_terms.get("disposition") != "retain_ip":
            raise RehearsalFailure(
                f"contest metadata.prize_terms is {row_terms!r}, expected "
                f"disposition retain_ip")
        r.artifacts["prize_terms_sha256"] = terms_sha
        r.must_fail(argv + ["--accept-terms", "0" * 64],
                    env=envs["participant"], contains="does not match")
        r.sh(argv + ["--accept-terms", terms_sha],
             env=envs["participant"], timeout=600)
        rows = _rest(env, f"/rest/v1/authorization_requests?sealed_set_id=eq.{t2['secret']}&select=request_id,state,method_sha&order=created_at.desc")
        if not rows or rows[0]["state"] != "pending":
            raise RehearsalFailure(f"no pending method request: {rows}")
        r.artifacts["db_request"] = rows[0]
        _, listing = r.sh([MT, "node", "list"], env=envs["organizer"])
        if rows[0]["request_id"] not in listing:
            raise RehearsalFailure(f"node list does not show {rows[0]['request_id']}:\n{listing}")
        r.sh([MT, "node", "approve", rows[0]["request_id"], "--actor", "rehearsal-custodian"], env=envs["organizer"])
        st = _rest(env, f"/rest/v1/authorization_requests?request_id=eq.{rows[0]['request_id']}&select=state")[0]["state"]
        if st != "authorized":
            raise RehearsalFailure(f"request state after approve: {st}")
        return {"request": rows[0]["request_id"], "state": st,
                "prize_terms_sha256": terms_sha[:16] + "…"}
    r.step("Lane B: submit-method (prize terms read → refused → wrong hash refused → accepted; 045 door) "
           "→ node list → approve (038 one-way, 040 chain)", submit_method)

    def relay1():
        r.sh([MT, "node", "relay", str(exchange)], env=envs["organizer"], timeout=600)
        rid = r.artifacts["db_request"]["request_id"]
        req = exchange / "requests" / rid
        if not (req / "request.json").exists() or not (req / "method.tar.gz").exists():
            raise RehearsalFailure(f"relay pass 1 did not export {rid}")
        return {"exported": rid}
    r.step("relay pass 1 → exchange/requests/<rid>/{request.json, method.tar.gz}", relay1)

    def stage():
        bout = HOME / "bundles" / "toy"
        if bout.exists():
            shutil.rmtree(bout)
        # The staged contest has no database row at all, so its qualifier
        # facts come from the organizer's published release rather than a
        # lookup: `contest qualify --offline-*` writes the receipt, and
        # submit-method is given the same two facts to check it against.
        stage_qualifier_id = f"qual-{V['CONTEST_ID']}"
        # The SAME public dev set the node will re-execute the gate on (the
        # one that travels to it as staged-qualifier-corpus.json) — a claim
        # measured on a different corpus is not a claim about this gate.
        r.sh([MT, "contest", "qualify", V["CONTEST_ID"], "--dev", str(work / f"dev-{t2['id']}.txt"),
              "--dev-corpus", t2["dev_corpus"], "--system", "toy-swap", "--method-class", "pipeline",
              "--paradigm", "rule-based", "--receipt-dir", str(receipts),
              "--offline-threshold", "35", "--offline-qualifier-id", stage_qualifier_id], env=envs["organizer"], timeout=600)
        r.sh([MT, "contest", "submit-method", V["CONTEST_ID"], "--method-dir", str(ex / "method"), "--dockerfile", str(ex / "Dockerfile"),
              "--name", "toy-swap", "--version", "1.0.0", "--entrypoint", "method/translate.py", "--method-class", "pipeline",
              "--paradigm", "rule-based", "--developer", "Rehearsal", "--developer-email", "organizer@example.test", "--agree",
              "--node-id", "lima-airgap-1", "--pair", "qaa>qab", "--secret-set", V["SEALED_SET_ID"], "--offline", "--bundle-out", str(bout),
              "--offline-threshold", "35", "--offline-qualifier-id", stage_qualifier_id] + entry_declarations(), env=envs["organizer"], timeout=600)
        tarball = find_one(bout, "method.tar.gz")
        _, out_ = r.sh([MT, "node", "stage-request", str(tarball), "--contest", V["CONTEST_ID"], "--out", str(exchange),
                        "--requested-by", "organizer@example.test", "--config", str(HOME / "stage-config.json")], env=envs["organizer"])
        staged = [p.name for p in (exchange / "requests").iterdir() if p.is_dir() and p.name != r.artifacts["db_request"]["request_id"]]
        if len(staged) != 1:
            raise RehearsalFailure(f"expected exactly one staged request, found {staged}")
        req = read_json(exchange / "requests" / staged[0] / "request.json")
        if req.get("origin") != "stage-request" or req["request"]["node_measurement"] != "lima-airgap-1":
            raise RehearsalFailure(f"staged request shape unexpected: {req}")
        r.artifacts["staged_request"] = staged[0]
        return {"staged": staged[0]}
    r.step("DB-less: build a bundle offline → node stage-request (bound to lima-airgap-1)", stage)

    def meta():
        (exchange / "secret").mkdir(exist_ok=True)
        shutil.copy(t2["secret_artifact"], exchange / "secret" / Path(t2["secret_artifact"]).name)
        # The SECOND sealed split travels with the first: one custodian group,
        # one ceremony, both artifacts (contract D1). Still ciphertext — the
        # organizer sealed it to the air-gap node's group key and cannot open
        # it either.
        if not t2.get("holdout_artifact"):
            raise RehearsalFailure(
                "the relay contest was prepared with --sealed-holdout-size "
                "but its manifest names no holdout artifact")
        shutil.copy(t2["holdout_artifact"],
                    exchange / "secret" / Path(t2["holdout_artifact"]).name)
        # The PUBLIC dev corpus for the DB-less staged request. The relay ships
        # one per exported request (exchange v2); a staged request has no relay
        # behind it, so its gate facts are declared in the node's own config
        # instead — and the corpus has to be on the medium for that to be true.
        # It is the RELAY contest's dev set: a public gate is measured on a
        # public set, and this one shares no vocabulary with the tier-1 fixture
        # the staged request's sealed set was cut from.
        staged_dev = exchange / "staged-qualifier-corpus.json"
        shutil.copy(t2["dev_corpus"], staged_dev)

        # The canaries the node-side proof will use: tokens that occur in the
        # relay contest's SEALED splits and in nothing that legitimately
        # travels. Derived from what was actually sealed (the master minus the
        # published dev set), never hardcoded — a canary that turns out to be
        # public proves nothing, so an empty set is a failure.
        master2 = {e["source"]: e for e in read_json(work / "master-t2.json")["entries"]}
        dev_sources = {e["source"] for e in read_json(t2["dev_corpus"])["entries"]}
        sealed_entries = [e for src, e in master2.items() if src not in dev_sources]
        if len(sealed_entries) != 8:
            raise RehearsalFailure(
                f"expected 8 sealed relay entries (4 secret + 4 holdout), "
                f"derived {len(sealed_entries)}")
        public_text = "".join(
            Path(p_).read_text(encoding="utf-8")
            for p_ in (t1["dev_corpus"], t2["dev_corpus"], str(staged_dev)))
        canaries = sorted({tok for e in sealed_entries
                           for tok in (e["source"] + " " + e["reference"]).split()
                           if tok not in public_text})
        if len(canaries) < 4:
            raise RehearsalFailure(
                f"only {len(canaries)} sealed-only token(s) — the rehearsal "
                f"cannot prove the sealed splits stayed sealed with a canary "
                f"that also appears in a public corpus: {canaries}")
        grep_absent(SECRET_TOKEN, [exchange])
        for tok in canaries:
            grep_absent(tok, [exchange])
        meta_doc = {
            "db_contest": t2["id"], "db_sealed_set_id": t2["secret"],
            "db_secret_artifact": t2["secret_artifact"],
            "db_holdout_set_id": t2["holdout"],
            "db_holdout_artifact": t2["holdout_artifact"],
            "db_prize_terms_sha256": r.artifacts.get("prize_terms_sha256"),
            "db_request_id": r.artifacts["db_request"]["request_id"],
            "staged_request_id": r.artifacts["staged_request"],
            "staged_contest": V["CONTEST_ID"],
            "staged_qualifier": {
                "qualifier_id": f"qual-{V['CONTEST_ID']}",
                "corpus_card_id": Path(t2["dev_corpus"]).stem,
                "threshold": 35.0, "metric": "composite", "year": 2026,
            },
            "staged_qualifier_corpus": staged_dev.name,
            # Tokens that exist ONLY inside the relay contest's sealed splits.
            # The node greps for every one of them after the run.
            "db_canaries": canaries,
        }
        (exchange / "rehearsal-meta.json").write_text(json.dumps(meta_doc, indent=2))
        r.sh([MT, "node", "manifest", "write", str(exchange), "--direction", "in", "--note", "rehearsal IN drive: requests + sealed T2 set"], env=envs["organizer"])
        return {"secret_artifact": Path(t2["secret_artifact"]).name,
                "holdout_artifact": Path(t2["holdout_artifact"]).name,
                "staged_qualifier_corpus": staged_dev.name,
                "sealed_only_canaries": len(canaries)}
    r.step("carry the organizer-sealed T2 secret + HOLDOUT sets, the staged request's public dev "
           "corpus and the meta onto the IN drive (no plaintext), write manifest", meta)

    def persist():
        """The `--relay 2` and `--close` legs are separate processes: hand
        them the ids and the identities rather than making them re-derive
        anything."""
        state = {
            "contests": {k: {kk: vv for kk, vv in v.items() if kk != "metadata"}
                         for k, v in r.artifacts["contests"].items()},
            "identities": r.artifacts["identities"],
            "prize_terms_sha256": r.artifacts.get("prize_terms_sha256"),
            "db_request_id": r.artifacts["db_request"]["request_id"],
            "staged_request_id": r.artifacts["staged_request"],
            "local_run_card": (r.artifacts.get("t1") or {}).get("run_card", {}).get("id"),
        }
        _phase_a_state_path().parent.mkdir(parents=True, exist_ok=True)
        _phase_a_state_path().write_text(json.dumps(state, indent=2))
        return {"state": str(_phase_a_state_path())}
    r.step("persist the phase-A state for the relay-2 and close legs", persist)

    r.write()


def relay2(r: Runner):
    """Relay pass 2 on the organizer: verify the returned bundle, WITHHOLD.

    The relay contest promised ``results_visibility: hidden_until_close``
    (practice 6) and carries a sealed holdout (practice 7, always withheld).
    So the correct outcome of pass 2 is NOT a published card: it is two rows
    parked in ``contest_deferred_results`` and ``run_cards`` unmoved. The
    close leg publishes them.
    """
    env = _supabase_env()
    ret = HOME / "exchange-return"
    read_json(HOME / ".mt-eval" / "node.json")  # fail loud if the config went missing
    state = read_json(_phase_a_state_path()) if _phase_a_state_path().exists() else {}
    org_env = dict(env)
    org_env["MT_EVAL_TOKEN_PATH"] = str(HOME / "rehearsal" / "auth-organizer.json")
    org_env["MT_EVAL_REFRESH_TOKEN"] = _signup(env, *IDENTITIES["organizer"])

    def relay():
        meta = read_json(ret / "rehearsal-meta.json") if (ret / "rehearsal-meta.json").exists() else {}
        if not meta.get("db_request_id"):
            raise RehearsalFailure(
                f"{ret / 'rehearsal-meta.json'} is missing or names no "
                f"db_request_id — the OUT drive did not carry the meta back, "
                f"so this leg cannot say which request it is publishing.")
        rid = meta["db_request_id"]
        contest_id = meta["db_contest"]
        before = len(_rest(env, "/rest/v1/run_cards?select=id") or [])
        r.sh([MT, "node", "manifest", "verify", str(ret)], env=org_env)
        _, out_ = r.sh([MT, "node", "relay", str(ret)], env=org_env, timeout=600)

        # The RETURN drive is a scores-only medium. `relay` does scores-IN
        # before requests-OUT precisely so the request whose signed scores it
        # just imported is already marked done when the export half runs —
        # otherwise the participant's method tarball is written back onto the
        # drive for nothing (measured here 2026-09-07) and the OUT manifest
        # stops describing what is on the medium.
        # Scoped to THIS request on purpose. A relay that serves several
        # participants may legitimately export OTHER pending work onto the
        # return drive (and that, separately, is what makes the OUT manifest
        # go stale — `node manifest verify` would then report the new files
        # as added in transit). What must never happen is the request whose
        # scores this pass just imported going back out again.
        def scores_only(which: str) -> None:
            if (ret / "requests" / rid).exists():
                raise RehearsalFailure(
                    f"{which} wrote requests/{rid} back onto the RETURN "
                    f"drive — the method tarball of the request it just "
                    f"imported crossed the gap for nothing.")

        scores_only("relay pass 2")

        after = len(_rest(env, "/rest/v1/run_cards?select=id") or [])
        if after != before:
            raise RehearsalFailure(
                f"run_cards moved by {after - before} on relay pass 2 — this "
                f"contest promised hidden_until_close, so nothing may publish "
                f"before `contest close`.")
        deferred = _rest(env, f"/rest/v1/contest_deferred_results"
                              f"?contest_id=eq.{contest_id}"
                              f"&select=request_id,role,sealed_set_id,published_run_card_id"
                              f"&order=role.asc")
        roles = sorted(d["role"] for d in deferred)
        if roles != ["holdout", "main"]:
            raise RehearsalFailure(
                f"contest_deferred_results holds roles {roles}, expected the "
                f"main result and the holdout: {deferred}")
        holdout_row = next(d for d in deferred if d["role"] == "holdout")
        if holdout_row["sealed_set_id"] != meta["db_holdout_set_id"]:
            raise RehearsalFailure(
                f"the withheld holdout is labelled "
                f"{holdout_row['sealed_set_id']!r}, expected "
                f"{meta['db_holdout_set_id']!r}")
        if any(d["published_run_card_id"] for d in deferred):
            raise RehearsalFailure(f"a withheld result is already published: {deferred}")

        evs = _rest(env, f"/rest/v1/authorization_audit_log?request_id=eq.{rid}&select=event_type,detail&order=id.asc")
        used = [e for e in evs if e["event_type"] == "grant_used"]
        detail = (used[-1].get("detail") or {}) if used else {}
        if detail.get("transport") != "airgap-relay":
            raise RehearsalFailure(f"grant_used.detail.transport != airgap-relay: {used}")
        if detail.get("sets") != ["main", "holdout"]:
            raise RehearsalFailure(
                f"grant_used.detail.sets is {detail.get('sets')!r} on the "
                f"DATABASE audit log, expected ['main','holdout'] — the "
                f"relay records what the node returned (contract D1).")

        # The STAGED request has no authorization_requests row, so pass 2 must
        # refuse it by name rather than publish it.
        staged = meta.get("staged_request_id")
        if staged and staged not in out_:
            raise RehearsalFailure(
                f"relay pass 2 never mentioned the staged request {staged} — "
                f"the documented limit is that it is REFUSED, and a silent "
                f"skip is not a refusal:\n{out_[-1500:]}")

        # A third pass moves nothing (idempotent; .relayed markers).
        _, _again = r.sh([MT, "node", "relay", str(ret)], env=org_env, timeout=600)
        n3 = len(_rest(env, "/rest/v1/run_cards?select=id") or [])
        d3 = _rest(env, f"/rest/v1/contest_deferred_results?contest_id=eq.{contest_id}&select=request_id")
        if n3 != after or len(d3) != len(deferred):
            raise RehearsalFailure(
                f"a third relay pass moved rows (run_cards {after}→{n3}, "
                f"deferred {len(deferred)}→{len(d3)})")
        scores_only("a third relay pass")
        r.artifacts["deferred"] = deferred
        r.artifacts["grant_used_detail"] = detail
        return {"run_cards_unchanged": after, "withheld": roles,
                "holdout_set": holdout_row["sealed_set_id"],
                "grant_sets": detail.get("sets"),
                "staged_refused": bool(staged),
                "imported_request_not_re_exported": True}
    r.step("relay pass 2: verify + WITHHOLD (hidden_until_close + holdout), grant_used.transport="
           "airgap-relay with sets [main, holdout]; the staged request is refused; the imported request is "
           "not written back onto the return drive; a third pass moves nothing",
           relay)
    if state:
        r.artifacts["phase_a"] = state
    r.write()


# ---------------------------------------------------------------------------
# CLOSE — rank, close, export, refusals (organizer, connected)
# ---------------------------------------------------------------------------

def close_leg(r: Runner):
    env = _supabase_env()
    if not _phase_a_state_path().exists():
        raise RehearsalFailure(
            f"{_phase_a_state_path()} is missing — run `--phase a` (and the "
            f"relay legs) before the close leg.")
    state = read_json(_phase_a_state_path())
    t2 = state["contests"]["synth-t2"]
    contest_id = t2["id"]
    out_dir = HOME / "close-out"; out_dir.mkdir(exist_ok=True)

    envs = {name: dict(env, **{
        "MT_EVAL_TOKEN_PATH": str(HOME / "rehearsal" / f"auth-{name}.json"),
        "MT_EVAL_REFRESH_TOKEN": _signup(env, *IDENTITIES[name])})
        for name in IDENTITIES}

    def cli_json(name, argv, *, timeout=900):
        """`--json` verbs: parse STDOUT alone — banners go to stderr."""
        e = dict(os.environ); e.update(envs[name])
        e["PATH"] = f"{VENV_BIN}:{HOME/'.local/node/bin'}:{e.get('PATH','')}"
        p = subprocess.run(argv, capture_output=True, text=True, env=e, timeout=timeout)
        if p.returncode != 0:
            raise RehearsalFailure(
                f"`{' '.join(argv[:4])}… --json` exited {p.returncode}:\n"
                f"{(p.stderr or '')[-2000:]}")
        try:
            return json.loads(p.stdout)
        except json.JSONDecodeError as exc:
            raise RehearsalFailure(
                f"`{' '.join(argv[:4])}… --json` did not print JSON on stdout "
                f"({exc}):\n{p.stdout[:800]}")

    def rank_open():
        ranking = cli_json("organizer", [MT, "contest", "rank", contest_id, "--json"])
        (out_dir / "rank-open.json").write_text(json.dumps(ranking, indent=2, ensure_ascii=False))
        if ranking.get("entries"):
            raise RehearsalFailure(
                f"an open hidden_until_close contest ranked "
                f"{len(ranking['entries'])} entries — the results are "
                f"withheld until close.")
        deferred = ranking.get("deferred_results") or {}
        count = deferred.get("count") if isinstance(deferred, dict) else deferred
        if count != 2:
            raise RehearsalFailure(
                f"deferred_results is {deferred!r}, expected the main result "
                f"and the holdout (count 2)")
        ident = ranking.get("identity_policy") or {}
        if not ident.get("anonymized"):
            raise RehearsalFailure(f"identity_policy is not anonymised while open: {ident}")
        holdout = ranking.get("holdout")
        if not holdout or holdout.get("set_id") != t2["holdout"]:
            raise RehearsalFailure(
                f"the ranking has no holdout section for {t2['holdout']!r}: {holdout}")
        if holdout.get("count"):
            raise RehearsalFailure(
                f"the holdout section shows {holdout['count']} result(s) "
                f"while the contest is open — every holdout result is "
                f"withheld until close.")
        terms = ranking.get("prize_terms") or {}
        if not terms.get("declared"):
            raise RehearsalFailure(f"the ranking declares no prize terms: {terms}")
        if (terms.get("terms") or {}).get("disposition") != "retain_ip":
            raise RehearsalFailure(
                f"prize_terms.terms.disposition is "
                f"{(terms.get('terms') or {}).get('disposition')!r}, expected "
                f"retain_ip (R1-trinary: the headline term is one of three)")
        if state.get("prize_terms_sha256") and terms.get("terms_sha256") != state["prize_terms_sha256"]:
            raise RehearsalFailure(
                f"the ranking hashes the terms to {terms.get('terms_sha256')} "
                f"but the entry accepted {state['prize_terms_sha256']}")
        if terms.get("gate") != ["handover_verified"]:
            raise RehearsalFailure(
                f"the derived payout checks for retain_ip are "
                f"{terms.get('gate')!r}, expected ['handover_verified']")
        r.artifacts["rank_open"] = {"deferred": count, "holdout": holdout.get("set_id"),
                                    "prize": terms.get("terms")}
        return {"entries": 0, "withheld": count, "anonymised": True,
                "holdout_section": holdout.get("set_id"),
                "prize_disposition": "retain_ip",
                "prize_gate": terms.get("gate"),
                "describe": (terms.get("describe") or "")[:160]}
    r.step("rank while OPEN: nothing ranked, 2 results withheld, pseudonyms, holdout section present "
           "and empty, ONE declared prize term (retain_ip → handover_verified)", rank_open)

    def refuse_reveal():
        out = r.must_fail([MT, "contest", "rank", contest_id, "--reveal-identities"],
                          env=envs["participant"], contains="Refusing --reveal-identities")
        r.artifacts.setdefault("refusals", {})["rank --reveal-identities without ownership"] = \
            next((ln.strip() for ln in out.splitlines() if "Refusing" in ln), "")[:300]
        return {"refused": True}
    r.step("an entrant cannot lift the anonymity promise: rank --reveal-identities without ownership is refused",
           refuse_reveal)

    def close():
        before = len(_rest(env, "/rest/v1/run_cards?select=id") or [])
        _, out = r.sh([MT, "contest", "close", contest_id, "--yes"],
                      env=envs["organizer"], timeout=900)
        row = _rest(env, f"/rest/v1/contests?id=eq.{contest_id}&select=status,intake_open,metadata")[0]
        if row["status"] != "closed":
            raise RehearsalFailure(f"status after close: {row['status']!r}")
        if row["intake_open"]:
            raise RehearsalFailure("intake_open is still true after close")
        frozen = (row.get("metadata") or {}).get("final_ranking")
        if not isinstance(frozen, dict):
            raise RehearsalFailure(
                f"metadata.final_ranking missing: keys={sorted(row.get('metadata') or {})}")
        if (frozen.get("identity_policy") or {}).get("anonymized"):
            raise RehearsalFailure(
                "the FROZEN ranking is still pseudonymised — the promise was "
                "anonymity UNTIL close, and close reveals.")
        deferred = _rest(env, f"/rest/v1/contest_deferred_results"
                              f"?contest_id=eq.{contest_id}"
                              f"&select=request_id,role,published_run_card_id")
        unpublished = [d for d in deferred if not d.get("published_run_card_id")]
        if unpublished:
            raise RehearsalFailure(
                f"close left {len(unpublished)} withheld result(s) "
                f"unpublished: {unpublished}")
        after = len(_rest(env, "/rest/v1/run_cards?select=id") or [])
        if after - before != len(deferred):
            raise RehearsalFailure(
                f"run_cards moved by {after - before} at close, expected "
                f"{len(deferred)} (the withheld main result and the holdout)")
        r.artifacts["close"] = {"published": [d["published_run_card_id"] for d in deferred],
                                "frozen_entries": len(frozen.get("entries") or [])}
        return {"published": len(deferred), "run_cards": f"{before}→{after}",
                "frozen_entries": len(frozen.get("entries") or []),
                "identities_revealed": True}
    r.step("contest close: publishes the withheld main + holdout results, reveals identities, freezes the ranking",
           close)

    def refuse_second_close():
        out = r.must_fail([MT, "contest", "close", contest_id, "--yes"],
                          env=envs["organizer"], contains="closed")
        r.artifacts.setdefault("refusals", {})["a second close"] = \
            next((ln.strip() for ln in out.splitlines() if "closed" in ln.lower()), "")[:300]
        return {"refused": True}
    r.step("a second close of an already-closed contest is refused (one-way)", refuse_second_close)

    def rank_closed():
        # No --i-am-the-organizer here: the OWNER of a CLOSED contest is
        # permitted by standing alone, which is the path the promise depends
        # on. (The assertion flag is the escape hatch for an organizer whose
        # sign-in differs from created_by, and it is recorded as such.)
        ranking = cli_json("organizer", [MT, "contest", "rank", contest_id,
                                         "--json", "--reveal-identities"])
        (out_dir / "rank-closed.json").write_text(json.dumps(ranking, indent=2, ensure_ascii=False))
        entries = ranking.get("entries") or []
        if len(entries) != 1:
            raise RehearsalFailure(
                f"expected exactly one ranked entry after close, got "
                f"{len(entries)}")
        holdout = ranking.get("holdout") or {}
        if holdout.get("count") != 1:
            raise RehearsalFailure(
                f"the holdout section shows {holdout.get('count')} result(s) "
                f"after close, expected 1: {holdout}")
        for e in holdout.get("entries") or []:
            if e.get("rank") is not None:
                raise RehearsalFailure(
                    f"a holdout result carries a rank ({e.get('rank')}) — the "
                    f"holdout is REPORTED, never ranked.")
        deferred = ranking.get("deferred_results") or {}
        count = deferred.get("count") if isinstance(deferred, dict) else deferred
        if count:
            raise RehearsalFailure(
                f"deferred_results still counts {count} after close")
        verdict = (ranking.get("prize_eligibility") or {}).get(entries[0]["run_card_id"]) or {}
        if not verdict.get("eligible"):
            raise RehearsalFailure(
                f"the winning entry is not prize-eligible under retain_ip: {verdict}")
        if (verdict.get("gate") or {}).get("handover_verified") is not True:
            raise RehearsalFailure(
                f"handover_verified is {(verdict.get('gate') or {}).get('handover_verified')!r} "
                f"— retain_ip requires it and nothing else.")
        emails = set(re.findall(r"[\w.+-]+@[\w-]+\.[\w.-]+", json.dumps(ranking)))
        stray = sorted(emails - {IDENTITIES["organizer"][0]})
        if stray:
            raise RehearsalFailure(
                f"an unexpected email-shaped value is in the revealed "
                f"ranking (only the organizer's own created_by / generated_by "
                f"belongs there): {stray}")
        r.artifacts["rank_closed"] = {
            "entry": entries[0]["run_card_id"], "holdout": holdout.get("count"),
            "prize_eligible": verdict.get("eligible")}
        return {"ranked": 1, "holdout_reported": holdout.get("count"),
                "deferred_left": 0, "prize_eligible": True,
                "label": entries[0].get("submitter_label")}
    r.step("rank after close: one ranked entry, the holdout REPORTED (never ranked), nothing withheld, "
           "prize gate handover_verified", rank_closed)

    def export():
        jp, cp = out_dir / "export.json", out_dir / "export.csv"
        r.sh([MT, "contest", "export", contest_id, "--format", "json", "--out", str(jp)],
             env=envs["organizer"], timeout=600)
        r.sh([MT, "contest", "export", contest_id, "--format", "csv", "--out", str(cp)],
             env=envs["organizer"], timeout=600)
        frozen = read_json(jp)
        if not frozen.get("frozen"):
            raise RehearsalFailure("the export of a closed contest is not marked frozen")
        rows = cp.read_text().strip().splitlines()
        if len(rows) < 2:
            raise RehearsalFailure(f"the CSV export has no data rows: {rows}")
        for col in ("rank_min", "rank_max", "is_primary", "track",
                    "prize_eligible", "submitter_label_or_pseudonym"):
            if col not in rows[0]:
                raise RehearsalFailure(f"CSV header is missing {col}: {rows[0]}")
        return {"json": "frozen", "csv_rows": len(rows) - 1,
                "csv_columns": len(rows[0].split(","))}
    r.step("contest export: the FROZEN snapshot verbatim (json) + the CSV with the reporting columns", export)

    def shared_task_report():
        """`shared-task report` needs an EDITION. The rehearsal prepares
        standalone contests (no `--shared-task`), so there is no edition to
        report on — say which, and why, rather than inventing one."""
        _, help_ = r.sh([MT, "shared-task", "--help"], env=envs["organizer"])
        if "report" not in help_:
            raise RehearsalFailure(f"`shared-task report` is not in the CLI:\n{help_}")
        editions = _rest(env, "/rest/v1/shared_tasks?select=shared_task_id")
        mine = [e["shared_task_id"] for e in (editions or [])]
        if mine:
            raise RehearsalFailure(
                f"unexpected shared-task editions on the local stack: {mine} "
                f"— the rehearsal creates none, so this leg would be "
                f"reporting on somebody else's rows.")
        return {"skipped": True,
                "reason": ("no shared-task edition exists: the rehearsal "
                           "prepares two standalone contests, and `contest "
                           "prepare --shared-task <id>` is the only door that "
                           "makes one. `shared-task report` is exercised by "
                           "arena/tests/test_shared_task.py, not here.")}
    r.step("shared-task report: SKIPPED (no edition), with the reason recorded", shared_task_report)

    r.write()


# ---------------------------------------------------------------------------

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--role", choices=["airgap", "organizer"], required=True)
    ap.add_argument("--tier", type=int, choices=[1, 2])
    ap.add_argument("--phase", choices=["a"])
    ap.add_argument("--relay", type=int, choices=[2])
    ap.add_argument("--close", action="store_true",
                    help="organizer: rank → refusals → close → rank → export")
    ap.add_argument("--report-dir", default=str(HOME / "rehearsal-report"))
    a = ap.parse_args()
    if a.role == "airgap" and a.tier:
        mode = f"tier{a.tier}"
    elif a.role == "organizer" and a.phase:
        mode = f"phase-{a.phase}"
    elif a.role == "organizer" and a.relay:
        mode = f"relay{a.relay}"
    elif a.role == "organizer" and a.close:
        mode = "close"
    else:
        ap.error("airgap needs --tier 1|2; organizer needs --phase a, --relay 2 or --close")
    r = Runner(a.role, mode, Path(a.report_dir))
    {"tier1": tier1, "tier2": tier2, "phase-a": phase_a, "relay2": relay2,
     "close": close_leg}[mode](r)
    print(f"\n{a.role}/{mode}: ALL {len(r.steps)} STEPS PASSED → {r.report_dir}")


if __name__ == "__main__":
    main()
