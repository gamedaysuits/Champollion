# Database Migrations

SQL migrations for the Supabase-hosted leaderboard database.

> [!IMPORTANT]
> **This directory is a historical mirror of migrations 001–011 only.**
> The canonical, active migration directory is
> [`mt-eval-arena/supabase/migrations/`](../../mt-eval-arena/supabase/migrations/)
> (currently through **067** — trading cards, source licenses, corpus license
> passthrough, datasets RLS hardening, the run_cards audit trail, the contest
> and organizer lane, anonymous intake, queue_items/queue_pairs, contributor
> reputation, and the tickets + docent lane).
> All new migrations go there — see [`MOVED.md`](./MOVED.md). Nothing past
> 011 is duplicated here.
>
> *Count corrected 2026-07-31: this said "017+", roughly 50 migrations stale.
> Verify with `ls mt-eval-arena/supabase/migrations/*.sql | wc -l` rather than
> trusting this line — it will drift again.*

> **Canonical schema**: [`DATABASE_SCHEMA.md`](../DATABASE_SCHEMA.md) is the
> single source of truth for the current database schema. When in doubt,
> that document wins over any individual migration file.

## Overview

Each migration is a standalone SQL file that can be run via the Supabase SQL Editor
or `supabase db push`. Migrations are **idempotent** — they use `IF NOT EXISTS`
guards and can be safely re-run.

## Schema History

The schema is the result of three phases:

### Phase 1: Base table (applied via Supabase Dashboard)

The `run_cards` table was created manually via the Supabase SQL Editor before
any migration system existed. The original DDL is preserved at:

the original `001_create_run_cards.sql` (historical, dashboard-applied)

### Phase 2: CLI migrations (applied via `supabase db push`)

Two timestamped migrations in `cli/supabase/migrations/` added columns and
created the `datasets` table. These are **already applied** to the live DB.

| File | Effect |
|------|--------|
| `20260528023253_add_missing_columns_and_language_cards.sql` | Added 6 columns to `run_cards` |
| `20260528024953_drop_language_cards_add_datasets.sql` | Added 4 columns, created `datasets` table |

### Phase 3: Arena migrations

Historically this directory; now `mt-eval-arena/supabase/migrations/` (the
mirror below stops at 011 — later migrations exist only in the canonical
directory).

## Migration Order

| # | File | Purpose |
|---|------|---------|
| 001 | `001_add_comet_and_ci_columns.sql` | COMET score, corpus BLEU, chrF++/exact-match CI columns |
| 002 | `002_add_metric_columns.sql` | Additional metric and CI columns, API provider |
| 003 | `003_add_quality_params.sql` | Method config columns (batch_size, temperature, max_tokens) |
| 004 | `004_add_missing_ci_columns.sql` | FST and composite CI columns |
| 005 | `005_create_run_card_entries.sql` | Per-entry results table (`run_card_entries`) |
| 006 | `006_add_full_metric_columns.sql` | Behavioral metrics, throughput, LYSS verdict columns |
| 007 | `007_add_token_efficiency_columns.sql` | Token efficiency columns (tokens_per_entry, cost_per_1k_tokens) |
| 008 | `008_create_contests.sql` | Contest infrastructure (contests + contest_submissions) |
| 009 | `009_create_datasets.sql` | ~~Datasets table~~ **SUPERSEDED** by 011 (was no-op due to CLI migration) |
| 010 | `010_add_style_column.sql` | Writing style consistency rate column on run_cards |
| 011 | `011_reconcile_datasets.sql` | Reconciles CLI and arena datasets schemas, adds missing columns |

## How to Apply

### Via Supabase SQL Editor (recommended)

1. Open the Supabase project dashboard
2. Navigate to SQL Editor
3. Paste the migration SQL
4. Run

### Via CLI

```bash
supabase db push
```

## Rollback

Each migration file includes rollback instructions in its header comments.
Rollbacks are manual — there is no automated rollback mechanism.

## Adding New Migrations

1. Check `DATABASE_SCHEMA.md` first — your column may already exist
2. Create a new file: `NNN_description.sql`
3. Include a header comment explaining WHAT, WHY, and ROLLBACK
4. Use `IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS` for idempotency
5. Update `DATABASE_SCHEMA.md` with the new column(s)
6. Test on a branch database before applying to production

> [!IMPORTANT]
> **Never** add migrations to this directory, `cli/supabase/migrations/`, or
> earlier project layouts. Those are historical only.
> All new SQL goes in `mt-eval-arena/supabase/migrations/`.
