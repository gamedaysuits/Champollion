#!/usr/bin/env python3
"""integrity_cleanup_20260612.py — founder-ordered prod cleanup (2026-06-12).

Two operations against the PRODUCTION Supabase (sjdomynysdljkbemupqa), both
verified against live data on 2026-06-12 before this script was written:

1. DELETE the four collided baseline-sweep runs (concurrent sweep starts
   shared a log-filename stem, so each published card mixes two different
   runs — unpublishable; see docs/TATOEBA_FAIR_SCORING_POLICY.md and the
   2026-06-12 lint baseline). Local file halves are already removed.
   Rows (id · model · pair · n):
     6a41604d-530b-52bf-917e-3c90a004ca17 · anthropic/claude-opus-4.8     · eng>ibo · 56
     60b73fea-f3ed-59ae-8a60-d59a38fe29e8 · google/gemini-3.1-pro-preview · eng>ilo · 113
     4a915cbd-538e-523d-8529-1093cc5afc97 · google/gemini-3.5-flash       · eng>cmn · 200
     7b900658-1987-50b2-83fb-29a6d9ac33ad · google/gemini-3.5-flash       · eng>jpn · 200
   (569 run_card_entries rows hang off these four cards.)
   Rerun of these four configs happens in the harness-integrity pass AFTER
   the runner's filename-collision fix lands.

2. CANONICALIZE the queryable identity columns. Only the COLUMNS are
   updated — the submitted run_card JSON blob is the sealed original
   artifact and is never rewritten. Forward enforcement (normalize at
   publish time) is a harness change, queued separately.
     language_pair:  'en>crk'               -> 'eng>crk'   (5 rows)
                     'english>plains cree'  -> 'eng>crk'   (1 row)
     model_slug:     'claude-opus-4.7'   -> 'anthropic/claude-opus-4.7'   (1)
                     'claude-sonnet-4'   -> 'anthropic/claude-sonnet-4'   (2)
                     'claude-sonnet-4.6' -> 'anthropic/claude-sonnet-4.6' (1)
                     'gemini-3.1-pro'    -> 'google/gemini-3.1-pro-preview' (3)
                     'gemini-3.5-flash'  -> 'google/gemini-3.5-flash'     (3)
                     'gemini-flash'      -> 'google/gemini-3.5-flash'     (3)
                     'gpt-5.5'           -> 'openai/gpt-5.5'              (3)
                     'deepseek-r1'       -> 'deepseek/deepseek-r1'        (2)
   Deliberately LEFT AS-IS (flagged for the integrity pass, do not guess):
     '?>crk' (1 legacy row, source unknown) · 'deepseek-v4-pro' (2) ·
     'qwen3-235b' (2) · 'meta-llama/omt-1600' (1, vacuous 404 run —
     separate founder decision).

Usage:
    python3 mt-eval-arena/scripts/integrity_cleanup_20260612.py            # dry run
    python3 mt-eval-arena/scripts/integrity_cleanup_20260612.py --apply    # execute

FULL RESET (founder order 2026-06-13, supersedes the targeted cleanup):
    python3 mt-eval-arena/scripts/integrity_cleanup_20260612.py --wipe-all-runs

  Deletes EVERY row from run_card_entries and run_cards. Rationale: the
  2026-06-11 baseline sweep ran eng>crk against the EdTeKLA-derived dev
  file under the wrong protocol (proper crk protocol = EdTeKLA full with
  50 holdouts, crk-translate only), publishing inflated chrF++ AND making
  NC-licensed sentences publicly queryable through run_card_entries. The
  founder ordered all prior runs deleted; proper sweeps re-run once the
  harness integrity pass lands. Language/trading cards, datasets metadata,
  and experts are NOT touched. run_cards_audit captures the deletion.

Needs SUPABASE_ACCESS_TOKEN in .env.local (same as apply_prod_migrations.py).
All deletes/updates are captured by the run_cards_audit trigger.
"""

import json
import os
import sys
import urllib.request
from pathlib import Path

PROJECT_REF = "sjdomynysdljkbemupqa"
API = f"https://api.supabase.com/v1/projects/{PROJECT_REF}/database/query"

COLLIDED_IDS = [
    "6a41604d-530b-52bf-917e-3c90a004ca17",
    "60b73fea-f3ed-59ae-8a60-d59a38fe29e8",
    "4a915cbd-538e-523d-8529-1093cc5afc97",
    "7b900658-1987-50b2-83fb-29a6d9ac33ad",
]

PAIR_MAP = {
    "en>crk": "eng>crk",
    "english>plains cree": "eng>crk",
}

SLUG_MAP = {
    "claude-opus-4.7": "anthropic/claude-opus-4.7",
    "claude-sonnet-4": "anthropic/claude-sonnet-4",
    "claude-sonnet-4.6": "anthropic/claude-sonnet-4.6",
    "gemini-3.1-pro": "google/gemini-3.1-pro-preview",
    "gemini-3.5-flash": "google/gemini-3.5-flash",
    "gemini-flash": "google/gemini-3.5-flash",
    "gpt-5.5": "openai/gpt-5.5",
    "deepseek-r1": "deepseek/deepseek-r1",
}


def load_token() -> str:
    root = Path(__file__).resolve().parents[2]
    env = root / ".env.local"
    if env.exists():
        for line in env.read_text().splitlines():
            if line.startswith("SUPABASE_ACCESS_TOKEN="):
                return line.split("=", 1)[1].strip().strip('"')
    tok = os.environ.get("SUPABASE_ACCESS_TOKEN", "")
    if not tok:
        sys.exit("error: SUPABASE_ACCESS_TOKEN not found in .env.local or env")
    return tok


def q(token: str, query: str):
    req = urllib.request.Request(
        API,
        data=json.dumps({"query": query}).encode(),
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            # Cloudflare 403s default urllib UA — same workaround as
            # apply_prod_migrations.py.
            "User-Agent": "champollion-ops/1.0",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode())


def sql_ids() -> str:
    return ",".join(f"'{i}'" for i in COLLIDED_IDS)


def wipe_all_runs(token: str) -> None:
    pre = q(token, "SELECT (SELECT count(*) FROM run_cards) AS cards, "
                   "(SELECT count(*) FROM run_card_entries) AS entries")[0]
    print(f"== FULL RUN WIPE ==\n  before: {pre['cards']} cards, {pre['entries']} entries")
    res = q(token,
            "WITH del_e AS (DELETE FROM run_card_entries RETURNING 1), "
            "del_c AS (DELETE FROM run_cards RETURNING 1) "
            "SELECT (SELECT count(*) FROM del_e) AS entries_deleted, "
            "       (SELECT count(*) FROM del_c) AS cards_deleted")[0]
    print(f"  deleted: {res['cards_deleted']} cards, {res['entries_deleted']} entries")
    post = q(token, "SELECT (SELECT count(*) FROM run_cards) AS cards, "
                    "(SELECT count(*) FROM run_card_entries) AS entries")[0]
    print(f"  after:  {post['cards']} cards, {post['entries']} entries")
    if post["cards"] == 0 and post["entries"] == 0:
        print("  board is clean. Audit rows in run_cards_audit.")
    else:
        sys.exit("  WARNING: rows remain — investigate.")


def main() -> None:
    apply = "--apply" in sys.argv
    token = load_token()
    if "--wipe-all-runs" in sys.argv:
        wipe_all_runs(token)
        return

    print("== Pre-flight (live prod counts) ==")
    pre = q(token, "SELECT (SELECT count(*) FROM run_cards) AS cards, "
                   "(SELECT count(*) FROM run_card_entries) AS entries")[0]
    print(f"  run_cards: {pre['cards']}   run_card_entries: {pre['entries']}")

    rows = q(token,
             f"SELECT id, model_slug, language_pair, corpus_size "
             f"FROM run_cards WHERE id IN ({sql_ids()}) ORDER BY run_timestamp")
    print(f"\n== Collided runs found in prod: {len(rows)}/4 ==")
    for r in rows:
        print(f"  {r['id']} · {r['model_slug']} · {r['language_pair']} · n={r['corpus_size']}")

    print("\n== Canonicalization (rows that would change) ==")
    for old, new in PAIR_MAP.items():
        n = q(token, f"SELECT count(*) AS n FROM run_cards WHERE language_pair = '{old}'")[0]["n"]
        print(f"  pair  {old!r:24} -> {new!r}: {n} rows")
    for old, new in SLUG_MAP.items():
        n = q(token, f"SELECT count(*) AS n FROM run_cards WHERE model_slug = '{old}'")[0]["n"]
        print(f"  slug  {old!r:24} -> {new!r}: {n} rows")

    if not apply:
        print("\nDRY RUN — nothing changed. Re-run with --apply to execute.")
        return

    print("\n== APPLYING ==")
    res = q(token,
            f"WITH del_e AS (DELETE FROM run_card_entries "
            f"  WHERE run_card_id IN ({sql_ids()}) RETURNING 1), "
            f"del_c AS (DELETE FROM run_cards "
            f"  WHERE id IN ({sql_ids()}) RETURNING 1) "
            f"SELECT (SELECT count(*) FROM del_e) AS entries_deleted, "
            f"       (SELECT count(*) FROM del_c) AS cards_deleted")[0]
    print(f"  deleted: {res['cards_deleted']} cards, {res['entries_deleted']} entries")

    for old, new in PAIR_MAP.items():
        r = q(token, f"WITH u AS (UPDATE run_cards SET language_pair = '{new}' "
                     f"WHERE language_pair = '{old}' RETURNING 1) "
                     f"SELECT count(*) AS n FROM u")[0]
        print(f"  pair {old!r} -> {new!r}: {r['n']} updated")
    for old, new in SLUG_MAP.items():
        r = q(token, f"WITH u AS (UPDATE run_cards SET model_slug = '{new}' "
                     f"WHERE model_slug = '{old}' RETURNING 1) "
                     f"SELECT count(*) AS n FROM u")[0]
        print(f"  slug {old!r} -> {new!r}: {r['n']} updated")

    post = q(token, "SELECT (SELECT count(*) FROM run_cards) AS cards, "
                    "(SELECT count(*) FROM run_card_entries) AS entries")[0]
    print(f"\n== Post-flight ==\n  run_cards: {post['cards']}   run_card_entries: {post['entries']}")
    print("  (expected: cards -4, entries -569 from pre-flight)")
    leftovers = q(token, "SELECT DISTINCT language_pair FROM run_cards "
                         "WHERE language_pair <> lower(trim(language_pair)) "
                         "   OR language_pair LIKE 'en>%' OR language_pair LIKE '%plains%'")
    print(f"  remaining non-canonical pairs: {leftovers or 'none'}")
    print("\nDone. Audit rows captured in run_cards_audit.")


if __name__ == "__main__":
    main()
