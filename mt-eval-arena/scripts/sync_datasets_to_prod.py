#!/usr/bin/env python3
"""sync_datasets_to_prod.py — sync the corpora registry SSOT → prod `datasets` table.

This is the maintainable, repeatable uploader for the corpora-metadata layer
(there was none before; the table had drifted to a stale 141-row snapshot under
an old id scheme). Run it whenever corpora are added/built so prod's `datasets`
stays aligned with the harness's corpus ids.

WHAT IT DOES (metadata only — NEVER corpus content; see docs/DATA_BOUNDARIES.md):
  - Reads arena/datasets/registry.json (the corpora SSOT, built from the cards).
  - Maps each dataset to the prod `datasets` columns. `source`/`source_export`
    reference the UPSTREAM (Tatoeba Challenge / OPUS / HF) — corpora are
    fetch-from-source, never hosted by us.
  - EXCLUDES non-commercial / no-redistribute corpora (EdTeKLA / CC-*-NC-*).
  - Upserts (idempotent, merge-duplicates on id) and retires prod rows whose id
    is no longer in the registry (stale old-scheme rows).
  - Catalogue entries that aren't built yet keep sha256=NULL (not runnable until
    built); built ones carry their pinned sha so the harness's sha-parity guard
    validates a published run.
  - NEVER touches run_cards. Runs are produced by the harness, not by this.

USAGE:
  SUPABASE_SERVICE_KEY=… python3 mt-eval-arena/scripts/sync_datasets_to_prod.py --dry-run
  SUPABASE_SERVICE_KEY=… python3 mt-eval-arena/scripts/sync_datasets_to_prod.py --apply
  (loads .env.local automatically if present; strips surrounding quotes on values)
"""
from __future__ import annotations
import argparse, json, os, re, sys, urllib.parse, urllib.request, urllib.error

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
REGISTRY = os.path.join(ROOT, "arena", "datasets", "registry.json")
SUPABASE_URL = "https://sjdomynysdljkbemupqa.supabase.co"
ANON = "sb_publishable_bV6CFNFnzxhQI0wlBx2J0A_5Vm5gFBp"  # read-only, RLS-guarded
REST = f"{SUPABASE_URL}/rest/v1"


def load_env():
    """Load .env.local (KEY=VALUE), stripping surrounding quotes — the service
    key is stored quote-wrapped, which silently produces a 401 if not stripped."""
    path = os.path.join(ROOT, ".env.local")
    if os.path.exists(path):
        for line in open(path):
            m = re.match(r"^([A-Z_]+)=(.*)$", line.strip())
            if m and m.group(1) not in os.environ:
                os.environ[m.group(1)] = m.group(2).strip().strip('"').strip("'")


def is_restricted(d: dict) -> bool:
    """NC / no-redistribute corpora never enter prod (DATA_BOUNDARIES.md)."""
    s = (d.get("id", "") + str(d.get("source", "")) + str(d.get("license", ""))).lower()
    return "edtekla" in s or "cc-by-nc" in s or "nc-sa" in s or "noncommercial" in s


def code_names(codes):
    out = {}
    cl = list(codes)
    for i in range(0, len(cl), 80):
        inlist = "(" + ",".join(cl[i : i + 80]) + ")"
        url = f"{REST}/trading_card_index?select=code,name&code=in." + urllib.parse.quote(inlist)
        req = urllib.request.Request(url, headers={"apikey": ANON, "Authorization": f"Bearer {ANON}"})
        for r in json.load(urllib.request.urlopen(req, timeout=60)):
            out[r["code"]] = r.get("name")
    return out


def build_rows():
    reg = json.load(open(REGISTRY))
    ds = reg["datasets"] if isinstance(reg, dict) and "datasets" in reg else reg
    codes = {c for d in ds for c in (d.get("language_pair") or {}).values() if c}
    names = code_names(codes)
    rows = []
    for d in ds:
        if is_restricted(d):
            continue
        lp = d.get("language_pair") or {}
        s, t = lp.get("source"), lp.get("target")
        if not (s and t):
            continue
        rows.append({
            "id": d["id"], "name": d.get("name"), "version": str(d.get("version") or "0.1.0"),
            "language_pair": f"{s}>{t}", "source_language": names.get(s) or s,
            "target_language": names.get(t) or t, "domain": d.get("domain") or "mixed",
            "license": d.get("license"), "entry_count": d.get("size"),
            "segment": d.get("segment") or "development", "source": d.get("source"),
            "sha256": d.get("sha256"), "quarantined": bool(d.get("quarantine")),
            "quarantine_reason": d.get("quarantine_reason"),
            "metadata": {k: d.get(k) for k in
                         ("contamination", "attribution", "source_export", "registry_source",
                          "path", "usage_commercial", "usage_training") if d.get(k) is not None},
        })
    return rows


def rest(method, path, key, body=None, prefer=None):
    h = {"apikey": key, "Authorization": f"Bearer {key}"}
    if body is not None:
        h["Content-Type"] = "application/json"
    if prefer:
        h["Prefer"] = prefer
    data = json.dumps(body).encode() if body is not None else None
    return urllib.request.urlopen(urllib.request.Request(f"{REST}/{path}", data=data, method=method, headers=h), timeout=120)


def count(tbl, key=ANON):
    h = {"apikey": key, "Authorization": f"Bearer {key}", "Prefer": "count=exact", "Range": "0-0"}
    r = urllib.request.urlopen(urllib.request.Request(f"{REST}/{tbl}?select=id", headers=h), timeout=60)
    return (r.headers.get("content-range") or "?/?").split("/")[-1]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true", help="write to prod (default is dry-run)")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    apply = args.apply and not args.dry_run
    load_env()

    rows = build_rows()
    runnable = sum(1 for r in rows if r["sha256"])
    print(f"registry → {len(rows)} datasets ({runnable} runnable / {len(rows)-runnable} catalogue), "
          f"NC excluded.")

    # Page through ALL prod ids — PostgREST caps single responses (commonly at
    # 1,000 rows) regardless of the limit parameter, and prod is past 5,000
    # rows. An unpaginated GET silently truncates prod_ids, which both
    # under-detects stale rows and mis-reports the drift.
    prod_ids = set()
    page_size, offset = 1000, 0
    while True:
        req = urllib.request.Request(
            f"{REST}/datasets?select=id&order=id.asc&limit={page_size}&offset={offset}",
            headers={"apikey": ANON, "Authorization": f"Bearer {ANON}"})
        page = json.load(urllib.request.urlopen(req, timeout=60))
        prod_ids.update(d["id"] for d in page)
        if len(page) < page_size:
            break
        offset += page_size
    stale = sorted(prod_ids - {r["id"] for r in rows})
    print(f"prod has {len(prod_ids)} rows; {len(stale)} stale (will be retired).")

    if not apply:
        print("\nDRY RUN — no writes. Re-run with --apply to sync.")
        print("sample:", json.dumps({k: rows[0][k] for k in ("id", "language_pair", "source", "sha256")}, ensure_ascii=False))
        return

    key = os.environ.get("SUPABASE_SERVICE_KEY")
    if not key:
        sys.exit("SUPABASE_SERVICE_KEY not set (and not in .env.local).")
    print(f"\nbefore: datasets={count('datasets')} run_cards={count('run_cards')}")
    for i in range(0, len(rows), 200):
        rest("POST", "datasets", key, rows[i:i+200], "resolution=merge-duplicates,return=minimal")
    for i in range(0, len(stale), 50):
        inlist = "(" + ",".join(stale[i:i+50]) + ")"
        rest("DELETE", f"datasets?id=in.{urllib.parse.quote(inlist)}", key, prefer="return=minimal")
    print(f"after:  datasets={count('datasets')} run_cards={count('run_cards')}  (run_cards must stay 0)")


if __name__ == "__main__":
    main()
