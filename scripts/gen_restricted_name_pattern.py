#!/usr/bin/env python3
"""gen_restricted_name_pattern.py — derive the NAMED-check pattern from the data.

WHY THIS EXISTS
  scripts/quarantine_gate.sh's NAMED check catches a restricted-corpus dump that
  the content detector cannot parse — a filename backstop. Its pattern was
  hand-written and crk-family only:

      edtekla|wolvengrey|itwewina|raw_harvest|gold_standard|held_out|
      crk-master|textbook_dev|eng-crk-dev

  Meanwhile the registry carries 32 corpus families — flores, wmt14..wmt24,
  nusatranslation, americasnlp2021, gamayun, mafand, tatoeba, tico19 and the
  rest — none of which the pattern could see. A hand-maintained blocklist
  silently falls behind the data it is supposed to guard, and nothing tells you.

  So the pattern is DERIVED. A new corpus family widens the gate automatically
  the next time build_registry.py runs and this generator is re-run; the test in
  scripts/tests/test_corpus_content_scan.py asserts every registry family is
  covered, so falling behind becomes a test failure rather than a silent hole.

BOUNDARIES, AND WHY THEY MATTER
  The gate matches the pattern as a SUBSTRING of the path. Several family names
  are short, ordinary English fragments: 'alt' occurs inside "default.json",
  'smol' inside a minified bundle name, 'prize' inside prize-spec docs. Each
  term is therefore emitted with word boundaries:

      (^|[^a-z0-9])term([^a-z0-9]|$)

COLLISION HANDLING — the honest part
  A blocklist that bricks pushes gets bypassed, and a bypassed gate protects
  nothing. So this generator VERIFIES its own output against the real tracked
  tree: any term that would flag a currently-tracked, non-exempt file is
  EXCLUDED and the collision is recorded in the generated file, naming the paths
  and stating that the term stays covered by the content detector (which is
  license-agnostic and whole-tree). Excluding a term is a narrowing of a
  backstop, never of the primary check — and it is written down rather than
  quietly dropped.

USAGE
  python3 scripts/gen_restricted_name_pattern.py            # write the pattern
  python3 scripts/gen_restricted_name_pattern.py --check    # verify it is current

Exit: 0 ok · 1 drift (with --check) or could not run.
"""
import argparse
import json
import os
import re
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REGISTRY = os.path.join(ROOT, "arena", "datasets", "registry.json")
OUT = os.path.join(ROOT, "scripts", "restricted_name_pattern.txt")

# Terms that are NOT registry ids and never will be: the crk-family assets and
# the generic split markers. These are the original hand-curated list and must
# survive any regeneration — they name things that must never be tracked at all.
CURATED = [
    "edtekla", "wolvengrey", "itwewina", "raw_harvest",
    "gold_standard", "held[_-]?out", "crk-master", "textbook_dev", "eng-crk-dev",
]

# Kept byte-identical to quarantine_gate.sh. If these drift apart the generator
# verifies against a different surface than the gate enforces on.
NAME_EXTS = ("json|jsonl|ndjson|tsv|csv|tab|txt|tmx|xml|po|pot|ya?ml|"
             "parquet|arrow|feather|xlsx|ods|gz|bz2|zst|xz|zip")
NAME_EXEMPT = (r"^cli/shared/corpora-cards/|^cli/shared/language-cards/|"
               r"^(cli/)?shared/schemas/|^scripts/tests/fixtures/|"
               r"^arena/scripts/corpora-builder/corpora_builder/recipes/|"
               r"^research/w2-irt/results/")


def bounded(term):
    """Wrap a term so it cannot match inside a longer word."""
    return f"(^|[^a-z0-9]){term}([^a-z0-9]|$)"


def registry_families():
    with open(REGISTRY, encoding="utf-8") as fh:
        data = json.load(fh)
    rows = data if isinstance(data, list) else (
        data.get("datasets") or data.get("entries") or [])
    fams = {r.get("registry_source") for r in rows
            if isinstance(r, dict) and r.get("registry_source")}
    return sorted(f.strip().lower() for f in fams if isinstance(f, str) and f.strip())


def tracked_files():
    r = subprocess.run(["git", "ls-files"], cwd=ROOT, capture_output=True,
                       text=True, timeout=120)
    if r.returncode != 0:
        raise SystemExit("gen_restricted_name_pattern: git ls-files failed")
    exempt = re.compile(NAME_EXEMPT)
    return [p for p in r.stdout.splitlines() if p and not exempt.search(p)]


def collisions_for(term, files, ext_re):
    """Paths a term would flag today. Non-empty means the term is unusable.

    Mirrors the gate exactly: extension and name are two separate matches (see
    the comment in quarantine_gate.sh). Combining them into one expression
    would let the term's trailing boundary eat the extension's dot, and this
    generator would then certify a pattern the gate does not actually apply.
    """
    pat = re.compile(bounded(term), re.IGNORECASE)
    return [p for p in files if ext_re.search(p) and pat.search(p)]


def build():
    files = tracked_files()
    ext_re = re.compile(r"\.(" + NAME_EXTS + r")$", re.IGNORECASE)

    accepted, excluded = [], []
    for term in CURATED:
        # Curated terms are non-negotiable: a collision here would mean a
        # restricted asset IS tracked, which is the gate doing its job.
        accepted.append(term)
    for fam in registry_families():
        hits = collisions_for(fam, files, ext_re)
        (accepted if not hits else excluded).append(fam if not hits else (fam, hits))

    pattern = "|".join(bounded(t) for t in accepted)

    lines = [
        "# GENERATED by scripts/gen_restricted_name_pattern.py — do not edit by hand.",
        "#",
        "# The NAMED-check pattern for scripts/quarantine_gate.sh: a filename",
        "# backstop for restricted-corpus dumps the content detector cannot parse.",
        "# Derived from registry_source in arena/datasets/registry.json plus the",
        "# curated crk-family terms, so a new corpus family widens the gate",
        "# automatically instead of silently falling outside it.",
        "#",
        f"# terms: {len(accepted)} accepted, {len(excluded)} excluded",
        "#",
    ]
    if excluded:
        lines += [
            "# EXCLUDED — each of these family names collides with a legitimate",
            "# tracked file, so including it would flag real content and the gate",
            "# would get bypassed. They remain covered by the CONTENT detector",
            "# (scripts/corpus_content_scan.py), which is license-agnostic and",
            "# whole-tree; only the filename backstop is narrowed, and only here,",
            "# in writing:",
        ]
        for fam, hits in excluded:
            shown = ", ".join(hits[:3]) + (" …" if len(hits) > 3 else "")
            lines.append(f"#   {fam}: {len(hits)} collision(s) — {shown}")
        lines.append("#")
    lines.append(pattern)
    return "\n".join(lines) + "\n", accepted, excluded


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true",
                    help="verify the committed pattern matches the data")
    args = ap.parse_args()

    text, accepted, excluded = build()

    if args.check:
        if not os.path.exists(OUT):
            print("restricted_name_pattern.txt missing — run the generator", file=sys.stderr)
            return 1
        with open(OUT, encoding="utf-8") as fh:
            if fh.read() != text:
                print("restricted_name_pattern.txt is STALE — regenerate:\n"
                      "  python3 scripts/gen_restricted_name_pattern.py", file=sys.stderr)
                return 1
        print(f"restricted-name pattern current ({len(accepted)} terms).")
        return 0

    with open(OUT, "w", encoding="utf-8") as fh:
        fh.write(text)
    print(f"wrote {os.path.relpath(OUT, ROOT)} — "
          f"{len(accepted)} term(s) accepted, {len(excluded)} excluded")
    for fam, hits in excluded:
        print(f"  excluded '{fam}': collides with {len(hits)} tracked path(s), "
              f"e.g. {hits[0]}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
