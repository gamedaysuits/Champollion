# Historical Migrations — Do Not Modify

These migrations were applied to the live Supabase database during the
initial CLI development phase. They are kept for historical reference
and migration numbering continuity.

**Do NOT add new migrations here.**

## Canonical Schema

The single source of truth for the current database schema is:

**[`arena/DATABASE_SCHEMA.md`](../../../arena/DATABASE_SCHEMA.md)**

All new migrations go in:

**[`mt-eval-arena/supabase/migrations/`](../../../mt-eval-arena/supabase/migrations/)**

> **Corrected 2026-07-31.** This file previously routed new migrations to
> `arena/migrations/` — a directory whose own `MOVED.md` explicitly forbids it
> (*"Never add migrations to this directory"*) and which has been an archived
> mirror since the canonical directory moved. Following the old instruction put
> migrations somewhere nothing applies them. The canonical directory is
> `mt-eval-arena/supabase/migrations/`, currently through **067**.
> (The relative paths above were also one level too shallow from this
> directory; both are fixed.)

## What These Migrations Did

| File | Applied | Effect |
|------|---------|--------|
| `20260528023253_add_missing_columns_and_language_cards.sql` | ✅ Live | Added `equivalent_match_rate`, `semantic_score`, `composite_score`, `quality_tier`, `cost_per_entry_usd`, `avg_latency_seconds` to `run_cards` |
| `20260528024953_drop_language_cards_add_datasets.sql` | ✅ Live | Dropped `language_cards`, added `cost_per_1k_tokens`/`median_latency_seconds`/`p95_latency_seconds`/`method_class` to `run_cards`, created `datasets` table, seeded `edtekla-dev-v1` |
