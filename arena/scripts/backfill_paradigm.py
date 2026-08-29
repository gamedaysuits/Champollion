#!/usr/bin/env python3
"""Backfill ``run_cards.paradigm`` from ``method_class`` where unambiguous.

The paradigm axis (migration 030) is the orthogonal "how a method translates"
dimension — rule-based / statistical / neural-nmt / llm / hybrid / human /
unknown. New runs populate it from the method card on publish
(``publish._extract_method_taxonomy``); this one-off seeds the column on rows
that predate it.

ONLY the unambiguous mappings are applied:

    method_class      → paradigm
    ----------------    --------
    raw-llm           → llm
    coached-llm       → llm
    human             → human

``pipeline`` / ``api`` / ``custom-plugin`` are LEFT NULL on purpose: a pipeline
or api can be rule-based OR neural OR hybrid, and guessing would be exactly the
LLM-centric collapse the paradigm axis exists to fix. Those need manual review.
Rows that already carry a paradigm are never touched.

Safety:
  * DRY-RUN by default — prints the plan and changes nothing. Pass ``--apply``
    to write.
  * No hardcoded project. Reads ``SUPABASE_URL`` from the environment so it can
    NEVER accidentally target production; ``--apply`` additionally requires
    ``SUPABASE_SERVICE_ROLE_KEY`` (run_cards is RLS-locked against anon writes).
  * DEV BRANCH ONLY (CLAUDE.md operational conventions). Point it at the
    dev/staging Supabase project.

Usage:
    export SUPABASE_URL="https://<dev-ref>.supabase.co"
    export SUPABASE_SERVICE_ROLE_KEY="<service-role-key>"   # only for --apply
    python3 scripts/backfill_paradigm.py            # dry run (reads only)
    python3 scripts/backfill_paradigm.py --apply    # write the mappings
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request

# Unambiguous method_class → paradigm mappings. Deliberately partial: see the
# module docstring for why pipeline/api/custom-plugin are excluded.
UNAMBIGUOUS = {
    "raw-llm": "llm",
    "coached-llm": "llm",
    "human": "human",
}


def _headers(key: str) -> dict:
    return {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }


def _count_candidates(base: str, key: str, method_class: str) -> int:
    """Count rows with this method_class and a NULL paradigm."""
    q = urllib.parse.urlencode({
        "select": "id",
        "method_class": f"eq.{method_class}",
        "paradigm": "is.null",
    })
    req = urllib.request.Request(
        f"{base}/rest/v1/run_cards?{q}",
        headers={**_headers(key), "Prefer": "count=exact", "Range": "0-0"},
        method="GET",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            # PostgREST returns the total in Content-Range: "0-0/<total>".
            content_range = resp.headers.get("Content-Range", "")
            resp.read()
    except urllib.error.HTTPError as exc:
        body = exc.read().decode()
        if exc.code == 400 and "paradigm" in body:
            print(
                "  ✗ The 'paradigm' column does not exist in this database.\n"
                "    Apply migration 030 on the dev branch first.",
                file=sys.stderr,
            )
            sys.exit(2)
        raise
    if "/" in content_range:
        tail = content_range.rsplit("/", 1)[1]
        if tail.isdigit():
            return int(tail)
    return 0


def _apply(base: str, key: str, method_class: str, paradigm: str) -> int:
    """PATCH paradigm for rows with this method_class and NULL paradigm."""
    q = urllib.parse.urlencode({
        "method_class": f"eq.{method_class}",
        "paradigm": "is.null",
    })
    data = json.dumps({"paradigm": paradigm}).encode()
    req = urllib.request.Request(
        f"{base}/rest/v1/run_cards?{q}",
        data=data,
        headers={**_headers(key), "Prefer": "return=representation"},
        method="PATCH",
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        updated = json.loads(resp.read().decode() or "[]")
    return len(updated)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--apply", action="store_true",
        help="Write the mappings. Without this, the script is a dry run.",
    )
    args = parser.parse_args()

    base = os.environ.get("SUPABASE_URL", "").rstrip("/")
    if not base:
        print(
            "✗ Set SUPABASE_URL to the DEV Supabase project (no default — this\n"
            "  script must never accidentally target production).",
            file=sys.stderr,
        )
        return 2

    # Reads can use the service-role key; --apply requires it (RLS blocks anon
    # writes to run_cards).
    service_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    read_key = service_key or os.environ.get("SUPABASE_ANON_KEY", "")
    if not read_key:
        print(
            "✗ Set SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY for a dry "
            "run).",
            file=sys.stderr,
        )
        return 2
    if args.apply and not service_key:
        print(
            "✗ --apply requires SUPABASE_SERVICE_ROLE_KEY (run_cards is "
            "RLS-locked against anon writes).",
            file=sys.stderr,
        )
        return 2

    mode = "APPLY" if args.apply else "DRY RUN"
    print(f"paradigm backfill — {mode}")
    print(f"  target: {base}")
    print(f"  mappings: {UNAMBIGUOUS}\n")

    total = 0
    for method_class, paradigm in sorted(UNAMBIGUOUS.items()):
        n = _count_candidates(base, read_key, method_class)
        total += n
        if args.apply and n:
            written = _apply(base, service_key, method_class, paradigm)
            print(f"  {method_class:12s} → {paradigm:6s}  updated {written} row(s)")
        else:
            verb = "would set" if not args.apply else "no rows"
            print(f"  {method_class:12s} → {paradigm:6s}  {verb} ({n} candidate row(s))")

    print(f"\n  {total} total candidate row(s) with a NULL paradigm.")
    if not args.apply:
        print("  Dry run — nothing written. Re-run with --apply to commit.")
    print(
        "  pipeline / api / custom-plugin rows are intentionally left NULL "
        "(unknown) for manual review."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
