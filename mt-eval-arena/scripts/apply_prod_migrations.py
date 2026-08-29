#!/usr/bin/env python3
"""Apply migrations 013-020 to PRODUCTION Supabase via the Management API.

The production project (sjdomynysdljkbemupqa) has tracked migrations through
012; everything 013-020 (license registry, corpus-license passthrough,
datasets RLS, audit trail, experts, insert parity + trust hardening, advisor
hardening) was verified on the acl-staging branch on 2026-06-11 and is
idempotent.

Usage:
    SUPABASE_ACCESS_TOKEN=sbp_... python3 scripts/apply_prod_migrations.py
    # add --project <ref> to target a different project (default: prod)

Reads token from env or from the monorepo root .env.local.
"""
import json
import os
import sys
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
MIGRATIONS = HERE.parent / "supabase" / "migrations"
PROJECT = "sjdomynysdljkbemupqa"
FILES = [
    "013_create_source_licenses.sql",
    "014_add_license_to_detail.sql",
    "015_add_corpus_license.sql",
    "016_datasets_rls.sql",
    "017_run_cards_audit.sql",
    "018_language_experts.sql",
    "019_run_cards_insert_parity.sql",
    "020_advisor_hardening.sql",
    "021_run_cards_trust_vocabulary.sql",
]


def get_token() -> str:
    tok = os.environ.get("SUPABASE_ACCESS_TOKEN")
    if tok:
        return tok
    env_local = HERE.parent.parent / ".env.local"
    if env_local.exists():
        for line in env_local.read_text().splitlines():
            if line.startswith("SUPABASE_ACCESS_TOKEN="):
                return line.split("=", 1)[1].strip().strip('"')
    sys.exit("No SUPABASE_ACCESS_TOKEN in env or .env.local")


def select_files() -> list[str]:
    """Which migrations to apply. Default: the legacy 013-021 list above.
    ``--from NNN`` applies every numbered migration >= NNN in order (all
    migrations are written idempotent, so re-applying an already-applied one
    is safe — e.g. ``--from 022`` for the 2026-07-07 launch brings any prod
    state current through 041)."""
    if "--from" in sys.argv:
        start = int(sys.argv[sys.argv.index("--from") + 1])
        names = sorted(
            p.name for p in MIGRATIONS.glob("[0-9][0-9][0-9]_*.sql")
            if int(p.name[:3]) >= start
        )
        if not names:
            sys.exit(f"No migrations numbered >= {start:03d} in {MIGRATIONS}")
        return names
    return FILES


def main() -> None:
    project = PROJECT
    if "--project" in sys.argv:
        project = sys.argv[sys.argv.index("--project") + 1]
    token = get_token()
    url = f"https://api.supabase.com/v1/projects/{project}/database/query"
    failed = False
    for name in select_files():
        sql = (MIGRATIONS / name).read_text()
        req = urllib.request.Request(
            url,
            data=json.dumps({"query": sql}).encode(),
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
                # Cloudflare in front of api.supabase.com blocks the default
                # Python-urllib UA with a 403/1010; any real UA string passes.
                "User-Agent": "champollion-migration-runner/1.0",
            },
        )
        try:
            resp = urllib.request.urlopen(req, timeout=120)
            print(f"  ✓ {name} ({resp.status})")
        except urllib.error.HTTPError as e:
            print(f"  ✗ {name} FAILED {e.code}: {e.read().decode()[:300]}")
            failed = True
            break
    if failed:
        sys.exit(1)
    print(f"\nAll migrations applied to {project}.")
    print("Next: upload trading cards (upload-trading-cards.mjs, needs service "
          "key) and publish run reports (publish_all_reports.py --allow-prod).")


if __name__ == "__main__":
    main()
