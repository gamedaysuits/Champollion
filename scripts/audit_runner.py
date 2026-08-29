#!/usr/bin/env python3
"""
audit_runner.py — the ONE data-accuracy audit runner.

WHY THIS EXISTS
  Before this, pass/fail for the deep checks was decided by grepping a child
  process's HUMAN output for literal strings — `"0 errors"`, `"MISMATCH: 0"`,
  and `"COUNTERFEIT                   0"` (a column-width match that silently
  flips green the day a total crosses a digit boundary). Reformatting a report
  could turn a red gate green with no code change. This runner deletes that
  class of bug: **a verdict is derived ONLY from (a) a checker's exit code and
  (b) parsed JSON on its stdout. Never from stdout text.**

WHAT IT IS
  A driver over declarative checker descriptors. It owns NO checking logic —
  every check lives in its own script and stays independently runnable. The
  runner's whole job is to run them, normalise their output into one Finding
  schema, and emit one machine-readable artifact plus one human report.

THE THREE RULES THAT MAKE IT HONEST
  1. `UNVERIFIABLE` is a first-class verdict. A check that could not run is
     never silence and never a pass. Absence of data never produces a green.
  2. A green `--profile static` run is NEVER reported as "the audit passed".
     The report leads with what was NOT run.
  3. `remediationOwner` splits the queue: `agent-fixable` vs `founder-ruling`
     vs `upstream-blocked`. An agent may never move a finding OUT of
     `founder-ruling` — those change what the project asserts or its licensing
     posture, and only the founder rules on them.

PROFILES
  static  — cards/docs only; runs on any clone, no network, no atlas DB
  gates   — + the pre-push gate battery (quarantine, doc parity, sovereignty usage)
  deep    — + everything needing the gitignored dumps and cli/data/atlas.db

USAGE
  python3 scripts/audit_runner.py                      # profile static
  python3 scripts/audit_runner.py --profile deep
  python3 scripts/audit_runner.py --json               # machine-readable to stdout
  python3 scripts/audit_runner.py --write-baseline     # freeze the current ratchet
  python3 scripts/audit_runner.py --report             # + docs/audit/ artifacts

EXIT CODES (same contract as check-prose-counts-parity.mjs, so the gate
scripts treat this identically):
  0 = clean            2 = baseline malformed
  1 = could not run    3 = findings at or above the failing threshold
"""
import argparse
import hashlib
import json
import os
import subprocess
import sys
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# ── Finding vocabulary ──────────────────────────────────────────────────────

SEVERITIES = ("error", "warning", "info")

# A check that could not run is UNVERIFIABLE — never OK, never silent.
VERDICTS = ("VIOLATION", "SUSPECT", "UNVERIFIABLE", "WAIVED")

OWNERS = ("agent-fixable", "founder-ruling", "upstream-blocked")

CATEGORIES = (
    "sovereignty", "license", "provenance", "value-accuracy",
    "snapshot-integrity", "public-claim", "schema", "coverage", "gate-health",
)


def finding(checker, rule_id, severity, category, *, file=None, code=None,
            field=None, verdict="VIOLATION", evidence=None,
            owner="agent-fixable", remediation=None, summary=""):
    """Build one Finding.

    `id` is content-addressed so the same defect keeps the same id across runs.
    `baselineKey` is deliberately MESSAGE-FREE (`ruleId|code`) — if it embedded
    the human message, rewording a diagnostic would silently reset a ratchet.
    """
    locus = {"file": file, "code": code, "field": field}
    key_src = "|".join(str(x) for x in (checker, rule_id, file, code, field))
    return {
        "id": hashlib.sha1(key_src.encode("utf-8")).hexdigest()[:12],
        "checker": checker,
        "ruleId": rule_id,
        "severity": severity if severity in SEVERITIES else "error",
        "category": category,
        "locus": locus,
        "verdict": verdict,
        "summary": summary,
        "evidence": evidence or {},
        "remediationOwner": owner,
        "remediation": remediation or {},
        "baselineKey": f"{rule_id}|{code or file or ''}",
    }


# ── Checker descriptors ─────────────────────────────────────────────────────

class Checker:
    def __init__(self, id, cmd, profile, parser, *, requires=(), requires_soft=(),
                 category="gate-health", cwd=None, timeout=3600, ok_exits=(0,),
                 violation_exits=(3,)):
        self.id = id
        self.cmd = cmd
        self.profile = profile          # static | gates | deep
        self.parser = parser            # name of a function in PARSERS
        self.requires = list(requires)  # absent → UNVERIFIABLE, checker not run
        self.requires_soft = list(requires_soft)
        self.category = category
        self.cwd = cwd or ROOT
        self.timeout = timeout
        self.ok_exits = ok_exits
        # Exit codes meaning "ran fine, found violations" — as opposed to
        # "could not run", which is UNVERIFIABLE. Most checkers use the 0/3/1
        # convention (see check-prose-counts-parity.mjs); the older gates
        # signal violations with 1, so they must declare it.
        self.violation_exits = violation_exits

    @property
    def expects_json(self):
        """A checker wired to a JSON parser MUST produce JSON.

        Without this, a checker that prints nothing parseable falls through to
        the exit-code path and a zero exit reads as CLEAN — reintroducing the
        exact silent-pass the runner exists to kill.
        """
        return self.parser != "parse_exit_only"


CHECKERS = [
    # ── static: runs on any clone ───────────────────────────────────────────
    Checker("card-lint",
            ["node", "cli/scripts/lint-language-cards.mjs", "--json"],
            "static", "parse_card_lint", category="schema",
            requires=["cli/shared/language-cards", "shared/licenses.json"]),
    Checker("card-quality",
            ["node", "cli/scripts/audit-card-data-quality.mjs", "--json"],
            "static", "parse_card_quality", category="value-accuracy",
            requires=["cli/shared/language-cards"], ok_exits=(0, 1)),
    Checker("endonyms",
            ["node", "cli/scripts/validate-endonyms.mjs", "--json-stdout"],
            "static", "parse_endonyms", category="value-accuracy",
            requires=["cli/shared/language-cards"],
            requires_soft=["cli/data/linguameta/data"], ok_exits=(0, 1)),

    # ── gates: the pre-push battery ─────────────────────────────────────────
    # quarantine_gate.sh signals BOTH "found content" and "refusing to pass
    # blind" with 1; both are hard blocks, so both are violations here.
    Checker("quarantine",
            ["bash", "scripts/quarantine_gate.sh"],
            "gates", "parse_exit_only", category="sovereignty",
            violation_exits=(1,)),
    Checker("prose-parity",
            ["node", "cli/scripts/check-prose-counts-parity.mjs"],
            "gates", "parse_exit_only", category="public-claim"),
    Checker("datasets-parity",
            ["node", "cli/scripts/check-datasets-doc-parity.mjs"],
            "gates", "parse_exit_only", category="license"),
    Checker("component-licenses",
            ["node", "cli/scripts/check-component-licenses.mjs"],
            "gates", "parse_exit_only", category="license"),
    # Offline and deterministic: re-derives every licence verdict from the
    # tracked evidence and fails if the committed file no longer matches. Does
    # NOT hit the network — refreshing the Zenodo records is a separate,
    # deliberate act (cli/scripts/harvest-zenodo-cldf.mjs).
    Checker("license-evidence",
            ["node", "cli/scripts/build-license-evidence.mjs", "--check"],
            "gates", "parse_exit_only", category="license",
            requires=["shared/license-evidence.json", "cli/data/zenodo-cldf-records.json"]),
    Checker("sovereignty-usage",
            ["python3", "scripts/check_sovereignty_usage.py", "--quiet"],
            "gates", "parse_exit_only", category="sovereignty",
            violation_exits=(1,)),

    # ── deep: needs the gitignored dumps / cli/data/atlas.db ────────────────
    Checker("license-gate",
            ["node", "cli/scripts/audit-license-gate.mjs", "--json"],
            "deep", "parse_license_gate", category="license",
            requires=["cli/data/atlas.db", "shared/licenses.json",
                      "cli/shared/language-cards"],
            ok_exits=(0, 1)),
    Checker("fact-provenance",
            ["node", "cli/scripts/audit-fact-provenance.mjs", "--json"],
            "deep", "parse_fact_provenance", category="provenance",
            requires=["cli/data/atlas.db", "cli/shared/language-cards"],
            ok_exits=(0, 1)),
    Checker("card-sources",
            ["python3", "scripts/verify-card-sources.py", "--json"],
            "deep", "parse_card_sources", category="value-accuracy",
            requires=["cli/data", "cli/data/atlas.db",
                      "cli/shared/language-cards"], ok_exits=(0, 1)),
]

PROFILE_ORDER = {"static": 0, "gates": 1, "deep": 2}


# ── Parsers: JSON + exit code in, Findings out. NEVER stdout text. ──────────

def parse_exit_only(chk, proc, _payload):
    """For checkers with no JSON mode yet: the exit code IS the contract.

    The 0/3/1 convention (see check-prose-counts-parity.mjs): 0 parity,
    3 drift, 1 could-not-run. A checker that CRASHES (1, or anything
    unexpected) is UNVERIFIABLE, not a pass — this is the exact degradation
    that champollion_sync_gate.sh used to swallow.
    """
    if proc.returncode in chk.ok_exits:
        return []
    if proc.returncode in chk.violation_exits:
        return [finding(chk.id, f"{chk.id}-violation", "error", chk.category,
                        verdict="VIOLATION",
                        summary=f"{chk.id} reports violations (exit {proc.returncode})",
                        evidence={"exitCode": proc.returncode, "tail": _tail(proc)},
                        remediation={"kind": "doc-edit",
                                     "command": " ".join(chk.cmd)})]
    return [finding(chk.id, f"{chk.id}-unavailable", "error", "gate-health",
                    verdict="UNVERIFIABLE",
                    summary=f"{chk.id} could not run (exit {proc.returncode})",
                    evidence={"exitCode": proc.returncode, "tail": _tail(proc)},
                    remediation={"kind": "generator-fix",
                                 "command": " ".join(chk.cmd)})]


def parse_card_lint(chk, proc, payload):
    """lint-language-cards.mjs --json → {counts, pass, dataFiles, diagnostics[]}."""
    if payload is None:
        return parse_exit_only(chk, proc, payload)
    out = []

    # A rule whose input data is absent silently returns null and the linter
    # still exits 0. Surface that as UNVERIFIABLE so absence can't read as OK.
    for name, meta in (payload.get("dataFiles") or {}).items():
        if isinstance(meta, dict) and meta.get("loaded") is False:
            out.append(finding(
                chk.id, "rule-input-unavailable", "error", "gate-health",
                file=f"dataFiles/{name}", code=name, verdict="UNVERIFIABLE",
                summary=f"card-lint input '{name}' absent — its rules did not run",
                evidence={"dataFile": name},
                remediation={"kind": "snapshot-refetch",
                             "command": "node cli/scripts/download-enrichment-data.mjs"}))

    for d in payload.get("diagnostics") or []:
        sev = d.get("severity", "error")
        if sev == "info":
            continue  # info is reported in counts, not as a finding
        fn = d.get("filename")
        out.append(finding(
            chk.id, d.get("ruleId", "unknown"), sev, chk.category,
            file=f"cli/shared/language-cards/{fn}" if fn else None,
            code=(fn or "").removesuffix(".json") or None,
            verdict="VIOLATION",
            summary=d.get("message", ""),
            evidence={"message": d.get("message", "")},
            remediation={"kind": "generator-fix"}))
    return out


def parse_card_quality(chk, proc, payload):
    if payload is None:
        return parse_exit_only(chk, proc, payload)
    out = []
    for f in _iter_findings(payload):
        code = f.get("code") or f.get("card")
        out.append(finding(
            chk.id, f.get("rule") or f.get("type") or "card-quality",
            "error", "value-accuracy",
            file=f.get("file"), code=code, field=f.get("field"),
            summary=f.get("message") or f.get("detail") or "",
            evidence={k: v for k, v in f.items() if k not in ("file", "code")},
            remediation={"kind": "generator-fix"}))
    return out


def parse_endonyms(chk, proc, payload):
    if payload is None:
        return parse_exit_only(chk, proc, payload)
    out = []

    # Without the LinguaMeta / Wikidata mirrors this checker silently degrades
    # to script-consistency only. A degraded run is not an attestation, so it
    # must not read as a clean one.
    if payload.get("degraded"):
        avail = payload.get("evidenceAvailable") or {}
        out.append(finding(
            chk.id, "endonym-evidence-degraded", "error", "gate-health",
            verdict="UNVERIFIABLE",
            summary="endonym verdicts computed WITHOUT the attestation mirrors "
                    "— script-consistency only",
            evidence={"evidenceAvailable": avail},
            remediation={"kind": "snapshot-refetch",
                         "command": "node cli/scripts/download-enrichment-data.mjs"}))

    for d in payload.get("details") or []:
        v = d.get("verdict")
        if v in ("verified", "plausible"):
            continue
        # `suspect` is template-suspicion — it needs a human eye, so it is a
        # warning owned by the founder, never an auto-fail. `fail` is a defect.
        is_fail = v == "fail"
        code = d.get("code")
        out.append(finding(
            chk.id, f"endonym-{v}", "error" if is_fail else "warning",
            "value-accuracy",
            file=f"cli/shared/language-cards/{code}.json", code=code,
            field="nativeName",
            verdict="VIOLATION" if is_fail else "SUSPECT",
            summary=f"{code}: nativeName {d.get('nativeName')!r} — verdict '{v}'",
            evidence=d,
            owner="agent-fixable" if is_fail else "founder-ruling",
            remediation={"kind": "generator-fix",
                         "generator": "cli/scripts/fix-endonym-authenticity.mjs"}))
    return out


def parse_license_gate(chk, proc, payload):
    if payload is None:
        return parse_exit_only(chk, proc, payload)
    out = []

    # Fact-table surface: a source ingested without any licence record.
    for src in payload.get("unknown") or []:
        name = src if isinstance(src, str) else src.get("source")
        out.append(finding(
            chk.id, "fact-source-unlicensed", "error", "license",
            code=name, verdict="VIOLATION",
            summary=f"ingested source '{name}' has no licence record at all",
            evidence=src if isinstance(src, dict) else {"source": name},
            owner="agent-fixable",
            remediation={"kind": "register-entry",
                         "command": "add to shared/licenses.json or shared/license-corrections.json"}))

    cards = payload.get("cards")
    if cards:
        # A stamp that resolves to nothing cannot be licensed because it cannot
        # be identified — distinct from a source whose terms are simply unknown.
        seen = set()
        for u in cards.get("unresolved") or []:
            stamp = u.get("stamp")
            if stamp in seen:
                continue
            seen.add(stamp)
            out.append(finding(
                chk.id, "card-stamp-unresolvable", "error", "provenance",
                code=stamp, verdict="VIOLATION",
                summary=f"card stamp '{stamp}' resolves to no register entry "
                        f"({u.get('cards')} cards)",
                evidence=u, owner="agent-fixable",
                remediation={"kind": "register-entry"}))

        by_key = {}
        for u in cards.get("unknown") or []:
            by_key.setdefault((u.get("source"), u.get("state"), u.get("spdx")), 0)
            by_key[(u.get("source"), u.get("state"), u.get("spdx"))] += u.get("cards", 0)
        for (key, state, spdx), n in by_key.items():
            unregistered = state == "unregistered"
            out.append(finding(
                chk.id,
                "card-source-unlicensed" if unregistered else "license-ref-unmapped",
                "error" if unregistered else "warning", "license",
                code=key, verdict="VIOLATION" if unregistered else "SUSPECT",
                summary=(f"'{key}' is cited by {n} card-field(s) with no register entry"
                         if unregistered else
                         f"'{key}' is registered as {spdx}, which maps to no licence "
                         f"tier — what it permits is a determination ({n} card-citations)"),
                evidence={"source": key, "spdx": spdx, "cardCitations": n, "state": state},
                owner="agent-fixable" if unregistered else "founder-ruling",
                remediation={"kind": "register-entry" if unregistered else "ruling"}))
    return out


def parse_fact_provenance(chk, proc, payload):
    if payload is None:
        return parse_exit_only(chk, proc, payload)
    out = []
    totals = payload.get("totals") or {}
    for bucket, owner, sev in (("COUNTERFEIT", "agent-fixable", "error"),
                               ("DERIVED-MISATTRIBUTED", "agent-fixable", "error"),
                               ("AMBIGUOUS", "founder-ruling", "warning")):
        n = totals.get(bucket)
        if isinstance(n, dict):
            n = n.get("facts") or n.get("pairs") or 0
        if n:
            out.append(finding(
                chk.id, f"fact-{bucket.lower()}", sev, "provenance",
                code=bucket, verdict="VIOLATION",
                summary=f"{n} fact(s) bucket as {bucket}",
                evidence={"bucket": bucket, "count": n}, owner=owner,
                remediation={"kind": "regenerate",
                             "command": "node cli/scripts/decontaminate-counterfeit-facts.mjs --confirm"}))
    # staleBySource is a LIST of per-source records, not a map.
    for rec in payload.get("staleBySource") or []:
        n = rec.get("staleCodeFacts") or 0
        if not n:
            continue
        src = rec.get("source")
        out.append(finding(
            chk.id, "fact-stale-code", "warning", "provenance", code=src,
            summary=f"{n} fact(s) from '{src}' store a bare categorical code, not its label",
            evidence=rec,
            remediation={"kind": "regenerate",
                         "command": f"re-ingest {src} via cli/scripts/ingest-cldf.mjs"}))

    # Per-(source, property) findings carry the bucket that made them notable.
    for f in payload.get("findings") or []:
        bucket = f.get("bucket")
        if bucket not in ("COUNTERFEIT", "DERIVED-MISATTRIBUTED", "AMBIGUOUS"):
            continue
        is_hard = bucket in ("COUNTERFEIT", "DERIVED-MISATTRIBUTED")
        out.append(finding(
            chk.id, f"fact-pair-{bucket.lower()}",
            "error" if is_hard else "warning", "provenance",
            code=f.get("source"), field=f.get("property"),
            verdict="VIOLATION" if is_hard else "SUSPECT",
            summary=f"{f.get('source')} :: {f.get('property')} — {bucket} "
                    f"({f.get('facts')} fact(s))",
            evidence=f,
            owner="agent-fixable" if is_hard else "founder-ruling",
            remediation={"kind": "regenerate", "generator": f.get("creators")}))
    return out


def parse_card_sources(chk, proc, payload):
    if payload is None:
        return parse_exit_only(chk, proc, payload)
    out = []
    if payload.get("completed") is not True:
        out.append(finding(
            chk.id, "verification-incomplete", "error", "gate-health",
            verdict="UNVERIFIABLE",
            summary="card source verification did not run to completion",
            evidence={"payloadKeys": sorted(payload.keys())}))

    # This checker covers a FROZEN 62-card sample, not the corpus. Say so on
    # every run: a clean sample is not a corpus-wide verdict, and reporting it
    # as one is the failure mode Phase 4 exists to remove.
    sample = payload.get("sample") or {}
    out.append(finding(
        chk.id, "verification-sample-only", "warning", "coverage",
        verdict="UNVERIFIABLE",
        summary=f"only {sample.get('cards', '?')} of 8,678 cards verified "
                f"against upstream ({sample.get('profile')})",
        evidence=sample, owner="agent-fixable",
        remediation={"kind": "generator-fix",
                     "command": "Phase 4: scripts/card_verify/ full-corpus engine"}))

    for r in payload.get("results") or []:
        status = r.get("status")
        if status in ("OK", "NA", "GAP"):
            continue  # GAP = upstream has a value, card is silent (generators are merge-only)
        is_mismatch = status == "MISMATCH"
        code = r.get("code")
        out.append(finding(
            chk.id, f"card-source-{str(status).lower()}",
            "error" if is_mismatch else "warning", "value-accuracy",
            file=f"cli/shared/language-cards/{code}.json" if code else None,
            code=code, field=r.get("check"),
            verdict="VIOLATION" if is_mismatch else "SUSPECT",
            summary=f"{r.get('check')}: card={r.get('card')!r} "
                    f"upstream={r.get('upstream')!r}",
            evidence=r,
            remediation={"kind": "generator-fix"}))
    return out


PARSERS = {
    "parse_exit_only": parse_exit_only,
    "parse_card_lint": parse_card_lint,
    "parse_card_quality": parse_card_quality,
    "parse_endonyms": parse_endonyms,
    "parse_license_gate": parse_license_gate,
    "parse_fact_provenance": parse_fact_provenance,
    "parse_card_sources": parse_card_sources,
}


# ── Plumbing ────────────────────────────────────────────────────────────────

def _tail(proc, n=400):
    text = (proc.stderr or proc.stdout or "").strip()
    return text[-n:] if text else ""


def _iter_findings(payload):
    """Findings live under a few different keys across the checkers."""
    for key in ("findings", "problems", "violations", "issues"):
        v = payload.get(key)
        if isinstance(v, list):
            return v
    return []


def _extract_json(stdout):
    """Parse JSON from stdout, tolerating a banner before the document.

    This is NOT a stdout-text verdict: we are decoding the machine payload,
    and a failure to decode yields UNVERIFIABLE, never a pass.
    """
    s = (stdout or "").strip()
    if not s:
        return None
    try:
        return json.loads(s)
    except json.JSONDecodeError:
        pass
    for opener, closer in (("{", "}"), ("[", "]")):
        i, j = s.find(opener), s.rfind(closer)
        if i != -1 and j > i:
            try:
                return json.loads(s[i:j + 1])
            except json.JSONDecodeError:
                continue
    return None


def missing_requirements(chk):
    return [p for p in chk.requires if not os.path.exists(os.path.join(ROOT, p))]


def run_checker(chk):
    """Returns (findings, record). A checker is never silently skipped."""
    missing = missing_requirements(chk)
    if missing:
        rec = {"id": chk.id, "profile": chk.profile, "ran": False,
               "reason": "missing-inputs", "missing": missing}
        return [finding(chk.id, "checker-inputs-missing", "error", "gate-health",
                        verdict="UNVERIFIABLE",
                        summary=f"{chk.id} not run — missing {', '.join(missing)}",
                        evidence={"missing": missing},
                        remediation={"kind": "snapshot-refetch",
                                     "command": "make fetch-data"})], rec

    started = time.time()
    try:
        proc = subprocess.run(chk.cmd, cwd=chk.cwd, capture_output=True,
                              text=True, timeout=chk.timeout)
    except FileNotFoundError as e:
        rec = {"id": chk.id, "profile": chk.profile, "ran": False,
               "reason": "executable-missing", "error": str(e)}
        return [finding(chk.id, "checker-executable-missing", "error", "gate-health",
                        verdict="UNVERIFIABLE",
                        summary=f"{chk.id} not run — {e}",
                        evidence={"cmd": chk.cmd})], rec
    except subprocess.TimeoutExpired:
        rec = {"id": chk.id, "profile": chk.profile, "ran": False,
               "reason": "timeout", "timeout": chk.timeout}
        return [finding(chk.id, "checker-timeout", "error", "gate-health",
                        verdict="UNVERIFIABLE",
                        summary=f"{chk.id} timed out after {chk.timeout}s",
                        evidence={"cmd": chk.cmd})], rec

    payload = _extract_json(proc.stdout)

    if chk.expects_json and payload is None:
        rec = {"id": chk.id, "profile": chk.profile, "ran": False,
               "reason": "no-json-payload", "exitCode": proc.returncode}
        return [finding(chk.id, "checker-no-json-payload", "error", "gate-health",
                        verdict="UNVERIFIABLE",
                        summary=f"{chk.id} produced no parseable JSON "
                                f"(exit {proc.returncode}) — cannot be scored",
                        evidence={"cmd": chk.cmd, "exitCode": proc.returncode,
                                  "tail": _tail(proc)},
                        remediation={"kind": "generator-fix",
                                     "command": f"add a JSON stdout mode to {chk.cmd[1]}"})], rec

    # A parser bug must degrade to UNVERIFIABLE for THIS checker, never abort
    # the run. An audit that dies on checker 8 of 10 and reports nothing is
    # strictly worse than one that reports 9 results and one honest failure.
    try:
        findings = PARSERS[chk.parser](chk, proc, payload)
    except Exception as e:  # noqa: BLE001 — a driver must survive its parsers
        rec = {"id": chk.id, "profile": chk.profile, "ran": False,
               "reason": "parser-error", "error": f"{type(e).__name__}: {e}"}
        return [finding(chk.id, "checker-parser-error", "error", "gate-health",
                        verdict="UNVERIFIABLE",
                        summary=f"{chk.id} ran but its parser failed: "
                                f"{type(e).__name__}: {e}",
                        evidence={"parser": chk.parser,
                                  "exitCode": proc.returncode})], rec

    rec = {"id": chk.id, "profile": chk.profile, "ran": True,
           "exitCode": proc.returncode, "jsonParsed": payload is not None,
           "findings": len(findings), "seconds": round(time.time() - started, 2)}
    return findings, rec


def load_baseline(path):
    if not path or not os.path.exists(path):
        return None, None
    try:
        with open(path, encoding="utf-8") as fh:
            data = json.load(fh)
    except (OSError, json.JSONDecodeError) as e:
        return None, f"baseline unreadable: {e}"
    rules = data.get("rules")
    if not isinstance(rules, dict):
        return None, "baseline malformed: missing 'rules' object"
    keys = set()
    for rule, meta in rules.items():
        for code in (meta or {}).get("codes", []):
            keys.add(f"{rule}|{code}")
    return keys, None


def git_sha():
    try:
        r = subprocess.run(["git", "rev-parse", "--short", "HEAD"], cwd=ROOT,
                           capture_output=True, text=True, timeout=15)
        return r.stdout.strip() if r.returncode == 0 else "unknown"
    except (OSError, subprocess.SubprocessError):
        return "unknown"


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--profile", choices=("static", "gates", "deep"), default="static")
    ap.add_argument("--only", default=None, help="comma-separated checker ids")
    ap.add_argument("--baseline", default="cli/shared/card-lint-baseline.json")
    ap.add_argument("--ratchet", action="store_true",
                    help="downgrade baselined findings to info; fail only on new ones")
    ap.add_argument("--write-baseline", action="store_true")
    ap.add_argument("--report", action="store_true", help="write docs/audit/ artifacts")
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()

    want = PROFILE_ORDER[args.profile]
    only = set(args.only.split(",")) if args.only else None
    selected = [c for c in CHECKERS
                if PROFILE_ORDER[c.profile] <= want and (only is None or c.id in only)]
    not_run = [c.id for c in CHECKERS
               if PROFILE_ORDER[c.profile] > want and (only is None or c.id in only)]

    baseline, berr = load_baseline(os.path.join(ROOT, args.baseline))
    if berr:
        print(f"audit: {berr}", file=sys.stderr)
        return 2

    findings, records = [], []
    for chk in selected:
        f, rec = run_checker(chk)
        findings.extend(f)
        records.append(rec)

    if args.ratchet and baseline:
        for f in findings:
            if f["baselineKey"] in baseline and f["severity"] != "info":
                f["severity"] = "info"
                f["verdict"] = "WAIVED"

    counts = {s: sum(1 for f in findings if f["severity"] == s) for s in SEVERITIES}
    counts["unverifiable"] = sum(1 for f in findings if f["verdict"] == "UNVERIFIABLE")
    by_owner = {o: sum(1 for f in findings if f["remediationOwner"] == o) for o in OWNERS}

    doc = {
        "_generated": {"at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                       "by": "scripts/audit_runner.py", "gitSha": git_sha()},
        "profile": args.profile,
        "notRun": not_run,
        "checkers": records,
        "counts": counts,
        "byOwner": by_owner,
        "findings": findings,
    }

    if args.write_baseline:
        # Record every non-info finding, warnings included. The ratchet's job is
        # to let a WARNING rule be promoted to error without the existing
        # backlog blocking the promotion — so the backlog is exactly what has
        # to be captured. Recording errors alone would freeze nothing useful
        # here, where errors are 2 and warnings are ~3,100.
        rules = {}
        for f in findings:
            if f["severity"] == "info":
                continue
            entry = rules.setdefault(f["ruleId"], {"count": 0, "codes": []})
            entry["count"] += 1
            entry["codes"].append(f["locus"].get("code") or f["locus"].get("file") or "")
        for e in rules.values():
            e["codes"] = sorted(set(e["codes"]))
            e["count"] = len(e["codes"])
        out = {"_generated": doc["_generated"],
               "_note": "Ratchet baseline. SHRINK-ONLY: cli/test/card-lint-baseline.test.js "
                        "refuses any per-rule count that increased versus HEAD.",
               "profile": args.profile, "rules": dict(sorted(rules.items()))}
        bpath = os.path.join(ROOT, args.baseline)
        os.makedirs(os.path.dirname(bpath), exist_ok=True)
        with open(bpath, "w", encoding="utf-8") as fh:
            json.dump(out, fh, indent=2)
            fh.write("\n")
        print(f"baseline written: {args.baseline} ({len(rules)} rule(s))")

    if args.report:
        _write_report(doc)

    if args.json:
        print(json.dumps(doc, indent=1))
    else:
        _print_human(doc)

    return 3 if counts["error"] else 0


def _write_report(doc):
    outdir = os.path.join(ROOT, "docs", "audit", "findings")
    os.makedirs(outdir, exist_ok=True)
    stamp = doc["_generated"]["at"].replace(":", "").replace("-", "")
    name = f"{stamp}-{doc['_generated']['gitSha']}.json"
    for p in (os.path.join(outdir, name), os.path.join(outdir, "latest.json")):
        with open(p, "w", encoding="utf-8") as fh:
            json.dump(doc, fh, indent=1)
            fh.write("\n")
    print(f"findings written: docs/audit/findings/{name} (+ latest.json)")


def _print_human(doc):
    c = doc["counts"]
    print(f"\n  AUDIT — profile: {doc['profile']}  ({doc['_generated']['gitSha']})")

    # Rule 2: a green partial run is never reported as "the audit passed".
    if doc["notRun"]:
        print(f"\n  NOT RUN in this profile ({len(doc['notRun'])}): {', '.join(doc['notRun'])}")
        print("  → this is NOT a complete audit. Use --profile deep on a provisioned machine.")

    skipped = [r for r in doc["checkers"] if not r.get("ran")]
    if skipped:
        print(f"\n  COULD NOT RUN ({len(skipped)}):")
        for r in skipped:
            print(f"    {r['id']}: {r.get('reason')} {r.get('missing') or ''}")

    print(f"\n  {c['error']} error · {c['warning']} warning · {c['info']} info"
          f" · {c['unverifiable']} UNVERIFIABLE")
    if any(doc["byOwner"].values()):
        print("  owners: " + " · ".join(f"{k} {v}" for k, v in doc["byOwner"].items() if v))

    by_rule = {}
    for f in doc["findings"]:
        if f["severity"] == "info":
            continue
        k = (f["severity"], f["checker"], f["ruleId"])
        by_rule.setdefault(k, []).append(f)
    if by_rule:
        print()
        for (sev, checker, rule), fs in sorted(by_rule.items(),
                                               key=lambda kv: (kv[0][0], -len(kv[1]))):
            ex = fs[0]["locus"].get("code") or fs[0]["locus"].get("file") or ""
            print(f"    [{sev}] {checker}/{rule}: {len(fs)}"
                  + (f"  e.g. {ex}" if ex else ""))
    elif not skipped and not doc["notRun"]:
        print("\n  ✓ clean")
    print()


if __name__ == "__main__":
    sys.exit(main())
