#!/usr/bin/env python3
"""
steward_report.py — the one-command site-steward exception report.

Prints ONLY what needs attention (with the exact remedial command), and stays
quiet when everything is fine. Never mutates anything. This is the automation
half of docs/SITE_MANAGEMENT_STRATEGY.md: the founder runs it on demand (or a
cron/schedule wraps it and surfaces only non-zero runs).

Usage:
  python3 scripts/steward_report.py            # fast static checks (~seconds)
  python3 scripts/steward_report.py --gates    # + card lint, sovereignty-usage gate
  python3 scripts/steward_report.py --deep     # + provenance audit, source verification
  python3 scripts/steward_report.py --net      # + GitHub queue / npm / PyPI checks
  python3 scripts/steward_report.py --json     # machine-readable
Exit code = number of attention items (0 = all quiet).

Freshness checks are mtime heuristics (a fresh git checkout writes sources and
artifacts together, so they read as fresh; a post-checkout edit bumps the
source and flags the artifact). The AUTHORITATIVE bundle-freshness gate is the
cli test suite (test/card-fetch.test.js) — this report is the early warning.
"""
import argparse
import json
import os
import subprocess
import sys
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

ITEMS = []

def attn(area, message, fix):
    ITEMS.append({"area": area, "message": message, "fix": fix})

def newest_mtime(path, exts=None, limit_dirs=None):
    newest = 0.0
    if os.path.isfile(path):
        return os.path.getmtime(path)
    for dirpath, dirnames, filenames in os.walk(path):
        dirnames[:] = [d for d in dirnames if d not in
                       {"node_modules", ".git", "build", ".docusaurus", "i18n", "__pycache__"}]
        if limit_dirs is not None:
            rel = os.path.relpath(dirpath, path)
            top = rel.split(os.sep, 1)[0]
            if rel != "." and top not in limit_dirs:
                dirnames[:] = []
                continue
        for f in filenames:
            if exts and os.path.splitext(f)[1] not in exts:
                continue
            try:
                m = os.path.getmtime(os.path.join(dirpath, f))
            except OSError:
                continue
            if m > newest:
                newest = m
    return newest

def run(cmd, timeout=900):
    return subprocess.run(cmd, cwd=ROOT, capture_output=True, text=True, timeout=timeout)

# ── fast static checks ──────────────────────────────────────────────────────

def check_generated_freshness():
    TOL = 2.0  # seconds; same-checkout writes
    pairs = [
        ("cli/shared/language-cards", {".json"},
         "cli/shared/cards-fallback.json",
         "node cli/scripts/build-cards-fallback.mjs"),
        ("cli/website/docs", {".md", ".mdx"},
         "cli/website/static/llms-full.txt",
         "cd cli/website && node scripts/build-llms-full.mjs"),
        ("cli/website/src/pages/for-agents.md", {".md"},
         "cli/website/static/for-agents.md",
         "cd cli/website && node scripts/build-for-agents-md.mjs"),
    ]
    for src, exts, artifact, fix in pairs:
        a = os.path.join(ROOT, artifact)
        if not os.path.exists(a):
            attn("generated", f"{artifact} missing", fix)
            continue
        if newest_mtime(os.path.join(ROOT, src), exts) > os.path.getmtime(a) + TOL:
            attn("generated", f"{artifact} older than its sources ({src})", fix)

def check_upstream_dump_ages(max_days=210):
    dumps = ["glottolog", "phoible", "wals", "grambank", "linguameta", "elcat"]
    now = time.time()
    for d in dumps:
        p = os.path.join(ROOT, "cli", "data", d)
        if not os.path.exists(p):
            attn("upstreams", f"cli/data/{d} dump absent (generators can't run)",
                 "node cli/scripts/download-enrichment-data.mjs  # or restore the data dir/symlinks")
            continue
        age_days = (now - newest_mtime(p)) / 86400
        if age_days > max_days:
            attn("upstreams",
                 f"cli/data/{d} dump is ~{int(age_days)} days old",
                 f"refresh the {d} dump, re-ingest, regenerate affected cards, re-run scripts/verify-card-sources.py")

def check_dead_link_regressions():
    """The known dead-end classes: wrong GitHub org, nonexistent issue templates."""
    bad_org = "Champollion-Dev"
    templates = set(os.listdir(os.path.join(ROOT, ".github", "ISSUE_TEMPLATE")))
    roots = ["cli/website/src", "cli/website/docs", "README.md", "CONTRIBUTING.md"]
    import re
    tmpl_re = re.compile(r"issues/new\?[^\"'\s)]*template=([A-Za-z0-9._-]+\.yml)")
    for root in roots:
        p = os.path.join(ROOT, root)
        files = []
        if os.path.isfile(p):
            files = [p]
        else:
            for dirpath, dirnames, filenames in os.walk(p):
                dirnames[:] = [d for d in dirnames if d not in {"node_modules", "build", ".docusaurus", "i18n"}]
                files += [os.path.join(dirpath, f) for f in filenames
                          if os.path.splitext(f)[1] in {".js", ".jsx", ".ts", ".tsx", ".md", ".mdx", ".json"}]
        for fp in files:
            try:
                text = open(fp, encoding="utf-8", errors="ignore").read()
            except OSError:
                continue
            rel = os.path.relpath(fp, ROOT)
            if bad_org in text:
                attn("links", f"{rel} references the nonexistent GitHub org '{bad_org}'",
                     "point at github.com/gamedaysuits/Champollion")
            for m in tmpl_re.finditer(text):
                if m.group(1) not in templates:
                    attn("links", f"{rel} links issue template '{m.group(1)}' which does not exist",
                         f"use one of: {', '.join(sorted(t for t in templates if t.endswith('.yml')))}")

def check_unmerged_work():
    r = run(["git", "branch", "--no-merged", "main", "--format=%(refname:short)"])
    if r.returncode != 0:
        return
    branches = [b for b in r.stdout.split() if b and b != "main"]
    if branches:
        attn("git", f"{len(branches)} local branch(es) not merged to main: {', '.join(branches[:8])}"
             + (" …" if len(branches) > 8 else ""),
             "review/merge or delete: git log main..<branch> --oneline")

# ── opt-in slower checks ────────────────────────────────────────────────────

def check_audit(profile):
    """Delegate the whole checker battery to scripts/audit_runner.py.

    This function used to decide pass/fail by grepping child stdout for the
    literals "0 errors", "COUNTERFEIT                   0" (a column-width
    match), and "MISMATCH: 0". Reformatting a report could silently turn a red
    gate green — and verify-card-sources.py had no sys.exit at all, so its
    grep was the ONLY thing standing between a real mismatch and a clean
    steward run. It had been reporting 2 mismatches unnoticed.

    Verdicts now come from the runner's JSON only. Never from text.
    """
    r = run(["python3", "scripts/audit_runner.py", "--profile", profile, "--json"],
            timeout=7200)
    try:
        doc = json.loads(r.stdout)
    except (json.JSONDecodeError, ValueError):
        attn("audit", f"audit runner produced no parseable report (exit {r.returncode})",
             f"python3 scripts/audit_runner.py --profile {profile}")
        return

    # A checker that could not run is its own attention item — absence of a
    # result is never treated as a passing result.
    for rec in doc.get("checkers", []):
        if not rec.get("ran"):
            attn("audit", f"checker '{rec['id']}' did not run ({rec.get('reason')})",
                 f"python3 scripts/audit_runner.py --profile {profile} --only {rec['id']}")

    by_rule = {}
    for f in doc.get("findings", []):
        if f.get("severity") != "error":
            continue
        by_rule.setdefault(f"{f['checker']}/{f['ruleId']}", []).append(f)
    for rule, fs in sorted(by_rule.items(), key=lambda kv: -len(kv[1])):
        ex = fs[0]["locus"].get("code") or fs[0]["locus"].get("file") or ""
        owner = fs[0].get("remediationOwner")
        attn("audit",
             f"{rule}: {len(fs)} finding(s)" + (f" (e.g. {ex})" if ex else "")
             + (" [FOUNDER RULING]" if owner == "founder-ruling" else ""),
             fs[0].get("remediation", {}).get("command")
             or f"python3 scripts/audit_runner.py --profile {profile} --report")

def check_net():
    # Submission queue (works once the public repo is public and gh is authed).
    r = run(["gh", "issue", "list", "--repo", "gamedaysuits/Champollion",
             "--label", "needs-review", "--state", "open", "--json", "number,title"],
            timeout=60)
    if r.returncode == 0:
        try:
            issues = json.loads(r.stdout or "[]")
        except json.JSONDecodeError:
            issues = []
        if issues:
            attn("queue", f"{len(issues)} submission(s) awaiting human review",
                 "gh issue list --repo gamedaysuits/Champollion --label needs-review  # docs/SUBMISSION_REVIEW.md")
    else:
        attn("queue", "could not read the submission queue (repo private or gh unauthenticated) — fine before launch",
             "gh auth login  # once the public repo is live")

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--gates", action="store_true")
    ap.add_argument("--deep", action="store_true")
    ap.add_argument("--net", action="store_true")
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()

    check_generated_freshness()
    check_upstream_dump_ages()
    check_dead_link_regressions()
    check_unmerged_work()
    # One battery, run once at the highest requested profile.
    if args.deep:
        check_audit("deep")
    elif args.gates:
        check_audit("gates")
    if args.net:
        check_net()

    if args.json:
        print(json.dumps({"attention": ITEMS, "count": len(ITEMS)}, indent=1))
    elif not ITEMS:
        print("✓ steward: all quiet — nothing needs attention"
              + ("" if args.deep else " (fast checks; add --gates/--deep/--net for the full pass)"))
    else:
        print(f"⚠ steward: {len(ITEMS)} item(s) need attention\n")
        for it in ITEMS:
            print(f"  [{it['area']}] {it['message']}")
            print(f"      fix: {it['fix']}")
    sys.exit(len(ITEMS))

if __name__ == "__main__":
    main()
