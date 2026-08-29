#!/usr/bin/env python3
"""Doc-set integrity gate.

Three invariants that were conventions until 2026-07-31 and therefore rotted:

  1. Every ``[[wikilink]]`` in ``docs/`` resolves to a real doc (or a declared
     ``aliases:`` entry).  56 of them did not, all pointing at an agent-private
     memory store outside the repo — invisible to a human reader and to any
     agent without that store.
  2. No public doc (``cli/website/docs/``) references an internal-only path.
     Referencing is unidirectional: internal may cite public, never the reverse.
  3. Every ``docs/`` file's ``status:`` is in the declared vocabulary.  The
     ``record`` value exists because ``current`` was doing two jobs — "true
     today" and "true when written" — and agents cannot tell those apart.

Exits non-zero on any violation.  Run it from the repo root.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
INTERNAL = ROOT / "docs"

# Everything that reaches an outside reader.  The website tree is the obvious
# one; ``cli/shared/`` is the one that was missed — its markdown ships inside
# the npm tarball AND the public squash, so a pointer to the internal wiki
# there resolves for nobody.  Scanning only the website tree let
# ``cli/shared/DATA-SOVEREIGNTY.md`` sit for weeks telling npm consumers to
# "see docs/DATA-ARCHITECTURE.md", a file they will never have.
PUBLISHED = [
    ROOT / "cli" / "website" / "docs",
    ROOT / "cli" / "shared",
]

# Source trees that ship publicly (mirrors PUBLIC_ROOTS in check_sovereignty_usage.py).
# Runtime output from these reaches people who have none of docs/.
# NOT cli/scripts or arena/scripts: those are monorepo-only build and audit
# tooling that legitimately READS docs/ as input (check-component-licenses.mjs
# opens docs/LICENSING.md on purpose). They never run on a user's machine.
PUBLISHED_SOURCE = [
    ROOT / "arena" / "mt_eval_harness",
    ROOT / "cli" / "lib",
    ROOT / "forge" / "nmt_forge",
    ROOT / "mcp-server" / "src",
    ROOT / "mt-eval-arena" / "supabase" / "migrations",
]

VALID_STATUS = {
    "current",
    "record",
    "draft",
    "superseded",
    "archived",
    "needs-review",
}

# Paths a public doc must never point a reader at.  ``references/`` and
# ``.vault/`` are excluded from the public squash; ``docs/`` is the internal
# wiki.  A public link to any of them 404s for every real visitor.
#
# Note the deliberate narrowness of the first pattern.  The site *serves* its
# own pages under the ``/docs/`` URL prefix (Docusaurus ``routeBasePath``), so
# ``](/docs/reference/plugin-spec)`` is a perfectly good internal site link.
# What is forbidden is a reference to the repo's internal wiki, which is
# recognisable by its SCREAMING_SNAKE filenames and the ``.md`` extension.
FORBIDDEN_IN_PUBLIC = (
    re.compile(r"(?:^|[\s(\[`])(?:\.\./)*docs/[A-Za-z0-9_/-]*[A-Z][A-Za-z0-9_/-]*\.md"),
    re.compile(r"\.vault/"),
    re.compile(r"(?:^|[\s(\[`])(?:\.\./)*references/"),
)

# Internal wiki paths that reach a USER AT RUNTIME, from published code.
#
# Three instances of this were found on 2026-08-01 and it is clearly a class,
# not a coincidence:
#   * migration 063 put `docs/DATA_BOUNDARIES.md` inside a live RAISE
#     EXCEPTION, so it is emitted to any external publisher who trips the
#     run-card content guard;
#   * six `mt-eval --help` strings cited `docs/ORGANIZER_NODE_RUNBOOK.md` and
#     the internal multisig plan doc, so `mt-eval node --help` told
#     users to read files that ship nowhere;
#   * `cli/shared/DATA-SOVEREIGNTY.md` pointed npm consumers at
#     `docs/DATA-ARCHITECTURE.md`.
#
# The markdown check above cannot see the first two — they live in string
# literals in code. This one looks for an internal-wiki path inside a quoted
# string in published source. A path in a plain `#` comment is left alone:
# the source is public, so a developer reading it is a different audience from
# a user reading program output.
RUNTIME_INTERNAL_PATH = re.compile(
    r"""["'][^"'\n]*\bdocs/(?:[a-z-]+/)*[A-Z][A-Za-z0-9_-]*\.md[^"'\n]*["']"""
)
RUNTIME_SOURCE_SUFFIXES = (".py", ".mjs", ".js", ".ts", ".sql")

# Known, deliberately-unfixed instances, each with the reason it stays.
#
# These three live in migrations that are ALREADY APPLIED to production.
# Editing an applied migration file changes nothing that is running — the fix
# is a NEW migration replacing the function body, which is a founder-authorized
# production write. Recorded as D12 in arena/DATABASE_SCHEMA.md. 051 is 063's
# predecessor (same message, superseded); 034's is a table COMMENT rather than
# an error emitted to a caller, so it is the least urgent of the three.
#
# An allowlist entry is a promise to fix, not a pardon. Remove the entry with
# the migration that fixes it.
RUNTIME_PATH_ALLOWLIST = {
    ("mt-eval-arena/supabase/migrations/034_translation_services.sql", 92),
    ("mt-eval-arena/supabase/migrations/051_run_cards_content_guard.sql", 269),
    ("mt-eval-arena/supabase/migrations/063_run_cards_content_guard_perf.sql", 115),
}

WIKILINK = re.compile(r"\[\[([^\]|#]+)")
ALIASES = re.compile(r"^aliases:\s*\[(.*?)\]", re.M)
STATUS = re.compile(r"^status:\s*(\S+)", re.M)

# A ``[[...]]`` inside a code span or fence is a literal example of the syntax,
# not a link — docs that explain the convention necessarily contain some.
CODE_SPAN = re.compile(r"`[^`\n]*`|```.*?```", re.S)


def strip_code(text: str) -> str:
    """Blank out code spans/fences, preserving offsets."""
    return CODE_SPAN.sub(lambda m: " " * len(m.group(0)), text)


def _in_vendored_project(path: Path, root: Path) -> bool:
    """True when `path` sits inside a self-contained project checked in under
    docs/ — currently a HyperFrames composition, marked by its hyperframes.json.

    Those trees carry their own tooling prose (AGENTS.md, CLAUDE.md, BRIEF.md)
    that belongs to the tool, not to this wiki: the `status:` vocabulary and the
    [[wikilink]] graph are rules for OUR planning docs, and imposing them on a
    vendored project would mean editing files the tool regenerates. Detected
    structurally rather than by path, so the next deck needs no new entry here.
    """
    for parent in path.parents:
        if parent == root.parent:
            break
        if (parent / "hyperframes.json").is_file():
            return True
    return False


def md_files(root: Path) -> list[Path]:
    return sorted(
        p
        for p in root.rglob("*.md")
        if "node_modules" not in p.parts and not _in_vendored_project(p, root)
    )


def main() -> int:
    failures: list[str] = []

    internal = md_files(INTERNAL)

    # --- invariant 3 + build the resolvable-name set for invariant 1 ---------
    names: set[str] = set()
    for path in internal:
        rel = path.relative_to(ROOT)
        text = path.read_text(encoding="utf-8")
        names.add(path.stem)
        names.add(str(path.relative_to(INTERNAL).with_suffix("")))

        head = text[:400]
        alias_match = ALIASES.search(head)
        if alias_match:
            names.update(
                a.strip().strip("\"'") for a in alias_match.group(1).split(",") if a.strip()
            )

        status_match = STATUS.search(head)
        if not status_match:
            failures.append(f"{rel}: no `status:` in frontmatter")
        elif status_match.group(1) not in VALID_STATUS:
            failures.append(
                f"{rel}: status `{status_match.group(1)}` is not one of "
                f"{' | '.join(sorted(VALID_STATUS))}"
            )

    # --- invariant 1 --------------------------------------------------------
    for path in internal:
        rel = path.relative_to(ROOT)
        for match in WIKILINK.finditer(strip_code(path.read_text(encoding="utf-8"))):
            target = match.group(1).strip()
            if target in names or target.split("/")[-1] in names:
                continue
            failures.append(
                f"{rel}: [[{target}]] resolves to nothing. If it names an "
                f"agent-memory note, write it as `{target}` in backticks — "
                f"wikilink syntax promises an in-repo doc."
            )

    # --- invariant 2 --------------------------------------------------------
    for tree in PUBLISHED:
        if not tree.is_dir():
            continue
        for path in md_files(tree):
            rel = path.relative_to(ROOT)
            for lineno, line in enumerate(
                path.read_text(encoding="utf-8").splitlines(), start=1
            ):
                for pattern in FORBIDDEN_IN_PUBLIC:
                    if pattern.search(line):
                        failures.append(
                            f"{rel}:{lineno}: published doc references an "
                            f"internal-only path — {line.strip()[:90]}"
                        )
                        break

    # --- invariant 4: no internal wiki path in published runtime strings ----
    for tree in PUBLISHED_SOURCE:
        if not tree.is_dir():
            continue
        for path in sorted(tree.rglob("*")):
            if path.suffix not in RUNTIME_SOURCE_SUFFIXES or not path.is_file():
                continue
            if "node_modules" in path.parts or "__pycache__" in path.parts:
                continue
            rel = path.relative_to(ROOT)
            for lineno, line in enumerate(
                path.read_text(encoding="utf-8", errors="replace").splitlines(), start=1
            ):
                stripped = line.lstrip()
                if stripped.startswith("#") or stripped.startswith("--"):
                    continue  # developer comment, not program output
                if (str(rel), lineno) in RUNTIME_PATH_ALLOWLIST:
                    continue
                if RUNTIME_INTERNAL_PATH.search(line):
                    failures.append(
                        f"{rel}:{lineno}: internal wiki path in a published "
                        f"runtime string — users have no docs/ — "
                        f"{stripped[:80]}"
                    )


    # --- invariant 4: the standard describes the system ----------------------
    # CLAUDE.md is what every future agent reads first. A repo path it names
    # must exist, or be in the deprecation ledger with its replacement.
    # (cli/data/champollion.db is the RETIRED legacy store — every live reader
    # was retargeted onto the atlas 2026-08-18 (retirement B7); when the file
    # itself is deleted, this invariant is what catches any stale reference.)
    import json as _json
    ledger_path = ROOT / "shared" / "cldf" / "deprecations.json"
    deprecated = {}
    if ledger_path.exists():
        for e in _json.loads(ledger_path.read_text())["entries"]:
            deprecated[e["what"]] = e.get("replacedBy", "?")
    path_re = re.compile(
        r"`((?:cli|arena|shared|scripts|forge|mcp-server|mt-eval-arena)/[A-Za-z0-9_./-]+"
        r"\.(?:mjs|js|py|json|csv|sh|db|md))`"
    )
    for doc in [ROOT / "CLAUDE.md", INTERNAL / "AGENTS.md", INTERNAL / "INDEX.md"]:
        if not doc.exists():
            continue
        for m in path_re.finditer(doc.read_text(encoding="utf-8")):
            rel = m.group(1)
            if (ROOT / rel).exists():
                continue
            if rel in deprecated:
                failures.append(
                    f"{doc.relative_to(ROOT)}: names `{rel}`, which is DEPRECATED — "
                    f"update the doc to its replacement: {deprecated[rel]}"
                )
            else:
                failures.append(
                    f"{doc.relative_to(ROOT)}: names `{rel}`, which does not exist and is "
                    "not in shared/cldf/deprecations.json. Either the doc rotted or a "
                    "deletion skipped the ledger."
                )

    if failures:
        print(f"docs integrity gate: {len(failures)} violation(s)\n", file=sys.stderr)
        for failure in failures:
            print(f"  ✗ {failure}", file=sys.stderr)
        return 1

    print(
        f"docs integrity gate: clean "
        f"({len(internal)} internal docs, wikilinks resolve, "
        f"status vocabulary valid, no public→internal references)"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
