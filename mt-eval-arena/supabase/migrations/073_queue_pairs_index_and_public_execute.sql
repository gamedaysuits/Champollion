-- 073_queue_pairs_index_and_public_execute.sql
--
-- THE HOLE (live smoke 2026-09-06, finding SMK-02). queue_pairs(p_rank_mode)
-- — the per-pair open-item aggregate behind the /contribute strip, the MCP
-- server's live open count and the harness's `queue --top` — does a
-- sequential scan of queue_items (211,082 rows, ~300 MB of heap with the
-- diagnostics JSONB + run_command text) and groups by language_pair. Measured
-- on prod: 3,413 ms, 63,590 buffers (38,378 read from disk). The anon role's
-- statement_timeout is 3 s, so EVERY anonymous caller gets
--   500 {"code":"57014","message":"canceling statement due to statement timeout"}
-- and the callers fall back to the generation-time count from
-- queue-preview.json (9 days stale on the day of measurement — defect D2).
-- The queue was 9,815 rows when 062 shipped; the 2026-08-27 lane-both
-- decision (071) took it to 211k and past the timeout.
--
-- THIS MIGRATION:
--   1. A covering index so queue_pairs and queue_top's coverage filter can
--      be answered from the index (index-only scan once the visibility map
--      is current — VACUUM runs after the first regenerate). The leading
--      columns match queue_pairs' predicate + group key; the INCLUDE columns
--      are exactly what the aggregate and the NOT EXISTS join read.
--   2. D4 (DATABASE_SCHEMA ledger): queue_top / queue_pairs were granted to
--      anon/authenticated/service_role but never REVOKEd FROM PUBLIC, so the
--      proacl still carries '=X/postgres'. Not an escalation (SECURITY
--      INVOKER over public-read tables) — off-standard. Revoke, then re-grant
--      the three roles explicitly.
--
-- Idempotent (IF NOT EXISTS / REVOKE+GRANT are idempotent). Plain CREATE
-- INDEX (not CONCURRENTLY — migrations run in a transaction); on 211k rows it
-- takes seconds and blocks writes for that long, which only the ranker's
-- upsert would notice.
--
-- VERIFY (as anon, over PostgREST):
--   POST /rest/v1/rpc/queue_pairs {"p_rank_mode":"map"} → 200 within the 3 s
--   statement_timeout;  EXPLAIN (ANALYZE, BUFFERS) select * from
--   queue_pairs('map') should show an Index Only Scan on
--   idx_queue_items_mode_pair_cover.
--
-- ROLLBACK:
--   DROP INDEX IF EXISTS public.idx_queue_items_mode_pair_cover;
--   (the grants can stay; PUBLIC EXECUTE was the defect)

CREATE INDEX IF NOT EXISTS idx_queue_items_mode_pair_cover
  ON public.queue_items (rank_mode, language_pair)
  INCLUDE (est_cost_usd, corpus_id, model, condition);

COMMENT ON INDEX public.idx_queue_items_mode_pair_cover IS
  'Covering index for queue_pairs() (group by language_pair per rank_mode) and the coverage anti-join; added 2026-09-06 after queue_pairs exceeded the anon 3 s statement_timeout at 211k rows (SMK-02).';

REVOKE EXECUTE ON FUNCTION public.queue_top(text, integer, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.queue_pairs(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.queue_top(text, integer, integer) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.queue_pairs(text) TO anon, authenticated, service_role;

ANALYZE public.queue_items;
