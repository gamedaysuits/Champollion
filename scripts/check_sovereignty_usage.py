#!/usr/bin/env python3
"""
check_sovereignty_usage.py — OCAP® exclusion gate.

OCAP® is a registered trademark of the First Nations Information Governance
Centre (FNIGC). It is not Champollion's mark to invoke: naming it in our
licenses, notices, or public copy could read as claiming a status only FNIGC
(and the communities it serves) can confer. Founder ruling 2026-08-29: the
term does not appear on any public surface, in any form — not even the old
"aspirant" framing. House wording is "Indigenous data-sovereignty principles
— community ownership and control of language data" / "sovereignty-aspirant".

This gate scans every public root for the token and fails on ANY occurrence.

WHY THIS IS PYTHON, NOT GREP: on macOS BSD grep a multibyte character inside
a bracket expression silently fails to match, so a grep-based scan once
reported CLEAN while violations sat on public surfaces (found 2026-07-19).
A byte-exact Python scan has no such mode.

False-positive handling: language names can contain the letter sequence
(e.g. "Docapúaraye", the Tuyuca endonym). A match is ignored when it sits
strictly inside a longer letter run — the trademark never does.

Exclusions (each for a reason, not convenience):
  - node_modules/, build/, .vercel/, .docusaurus/: build artifacts, rebuilt
    from clean source. (i18n/ is deliberately NOT excluded since 2026-08-29 —
    the locale copies were purged with the sources and must stay clean.)
  - cli/data/: pinned upstream datasets (SIL langtags etc.) — third-party
    content we do not edit.
  - cli/website/.champollion/tm.json: untracked single-line ~50 MB
    translation-memory cache; guarded by `tm prune --matching` instead.
  - arena/docent_eval/ + arena/tests/test_docent_eval.py + the docent system
    prompt: the docent must HANDLE users who ask about OCAP, so its
    instructions and eval fixtures name the term in order to teach the
    correct disclaiming answer. The eval scorer is the guard on the docent's
    actual output.
  - this file, which must name what it bans.

Exit 0 = clean; exit 1 = violations (printed file:line).
Usage: python3 scripts/check_sovereignty_usage.py  [--quiet]
"""
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

PUBLIC_ROOTS = ["README.md", ".github", "cli", "arena", "mcp-server", "lyss",
                "forge", "shared", "mt-eval-arena", "scripts"]

EXCLUDE_DIRS = {"node_modules", "build", ".vercel", ".docusaurus", ".git",
                "__pycache__", "docent_eval", ".venv", ".pytest_cache",
                ".hypothesis"}
EXCLUDE_FILES = {
    os.path.join("cli", "website", ".champollion", "tm.json"),
    os.path.join("scripts", "check_sovereignty_usage.py"),
    os.path.join("scripts", "tests", "test_check_sovereignty_usage.py"),
    os.path.join("cli", "shared", "docent", "system-prompt.md"),
    os.path.join("arena", "tests", "test_docent_eval.py"),
}
EXCLUDE_PREFIXES = (
    os.path.join("cli", "data") + os.sep,          # pinned upstream datasets
    os.path.join("cli", "website", "data") + os.sep,  # untracked build-time
    # plugin output (generateCatalogueJson.js), reassembled from clean SSOTs
    # at every site build.
    os.path.join("mt-eval-arena", "data") + os.sep,  # untracked prod data
    # snapshots; carry upstream linguistic forms (ASJP "th~ocap", "oCapeni")
    # that are DATA, plus historical served copies of retired notices.
)
TEXT_EXTS = {".md", ".mdx", ".json", ".js", ".mjs", ".jsx", ".ts", ".tsx",
             ".py", ".txt", ".html", ".css", ".yaml", ".yml", ".toml", ".sh",
             ""}

TOKEN = re.compile(r"ocap", re.IGNORECASE)
# A letter adjacent on either side means the sequence is inside a longer
# word (Docapúaraye). Digits/underscores/hyphens do NOT rescue a match:
# identifiers like ocap_review are violations.
LETTER = re.compile(r"[^\W\d_]", re.UNICODE)


def is_inside_word(line: str, start: int, end: int) -> bool:
    before = line[start - 1] if start > 0 else ""
    after = line[end] if end < len(line) else ""
    return bool(before and LETTER.match(before)) and bool(after and LETTER.match(after))


def iter_files(rel_root):
    p = os.path.join(ROOT, rel_root)
    if os.path.isfile(p):
        yield rel_root
        return
    for dirpath, dirnames, filenames in os.walk(p):
        dirnames[:] = [d for d in dirnames
                       if d not in EXCLUDE_DIRS and not d.endswith(".egg-info")]
        for f in filenames:
            rel = os.path.relpath(os.path.join(dirpath, f), ROOT)
            if rel in EXCLUDE_FILES or rel.startswith(EXCLUDE_PREFIXES):
                continue
            if os.path.splitext(f)[1].lower() in TEXT_EXTS:
                yield rel


def main():
    quiet = "--quiet" in sys.argv
    hits = []
    seen = set()
    for root in PUBLIC_ROOTS:
        if not os.path.exists(os.path.join(ROOT, root)):
            continue
        for rel in iter_files(root):
            if rel in seen:
                continue
            seen.add(rel)
            try:
                with open(os.path.join(ROOT, rel), encoding="utf-8", errors="replace") as fh:
                    for i, line in enumerate(fh, 1):
                        for m in TOKEN.finditer(line):
                            if is_inside_word(line, m.start(), m.end()):
                                continue
                            hits.append((rel, i, line.rstrip()[:200]))
                            break  # one report per line is enough
            except OSError:
                continue
    if hits:
        print(f"OCAP exclusion gate: {len(hits)} violation line(s) — the term "
              f"must not appear on public surfaces:")
        for rel, i, line in hits:
            print(f"  {rel}:{i}: {line}")
        return 1
    if not quiet:
        print(f"OCAP exclusion gate: clean ({len(seen)} files scanned).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
