-- ===========================================================================
-- Migration 078 — shared_tasks catalog comments name no real shared task
-- ===========================================================================
-- 047's table and column comments gave a real shared task's future edition as
-- the example slug. A catalog comment is public: PostgREST serves it in the
-- API description to anyone holding the anon key. Nothing has been agreed
-- with that shared task, so the example is now fictional ('example-task-2026'),
-- the same change made to 047's file text, the harness help and the tests on
-- 2026-10-11. Comment-only: no table, column, policy or function changes, and
-- re-applying is a no-op. Applied to prod 2026-10-12 with the founder's
-- go-ahead, after a local Postgres 16 check (the dev branch was unusable).

COMMENT ON TABLE public.shared_tasks IS
    'Multi-pair shared-task EDITION umbrella (one row = one edition-year, e.g. example-task-2026): groups N per-pair contests via contests.shared_task_id and carries the edition''s policy defaults. Thin by design — no per-pair machinery (qualifiers 042, intake 043, authorization 038-040) reads this table; defaults are copied onto contests at prepare time. Content-free. Migration 047.';

COMMENT ON COLUMN public.shared_tasks.shared_task_id IS
    'Stable public edition slug (e.g. example-task-2026). One row per edition-year, mirroring qualifier vYYYY rotation — next year''s cycle is a NEW row, never an edit.';
