# Historical Migrations (Read-Only)

> These migrations were created during earlier development phases in `cli/supabase/migrations/` and `crk-translate/eval/supabase/`. They are archived here for reference. **Never apply, modify, or add files to this directory.**

All new migrations go in `../migrations/`.

## Origin

| File | Original Location | Phase |
|------|------------------|-------|
| `001_create_run_cards.sql` | `crk-translate/eval/supabase/` | Phase 1 — initial schema |
| `20260528023253_add_missing_columns_and_language_cards.sql` | `cli/supabase/migrations/` | Phase 2 — column additions |
| `20260528024953_drop_language_cards_add_datasets.sql` | `cli/supabase/migrations/` | Phase 2 — datasets table |
