-- 071_queue_items_engine_and_edv.sql
--
-- Two founder decisions (2026-08-27, queue reassessment execution):
--
--   1. LANE BOTH — the public queue carries non-LLM MT-service work
--      (Google Translate, DeepL, Microsoft Translator, LibreTranslate,
--      Tilde) alongside LLM work. Engine items publish condition
--      'engine' (the generator's ENGINE_CONDITION sentinel), which 059's
--      CHECK rejected — that CHECK was the schema half of the llm-only
--      lane ruling of 2026-07-19, now reversed.
--
--   2. RANK-MODE EDV — the expected-decision-value ordering
--      (queue-construction spec §2.3) may materialize rows. The
--      map_value column is the generic rank-value column: map rows fill
--      it with map_value, edv rows with edv_value; the row's rank_mode
--      says which value model filled it. Full derivations stay in the
--      diagnostics JSONB either way.
--
-- Both constraints were created inline in 059 and carry Postgres's
-- auto-generated names. queue_top()/queue_pairs() are unchanged: they
-- filter by rank_mode and coverage, never by condition list.

alter table public.queue_items
  drop constraint if exists queue_items_condition_check;
alter table public.queue_items
  add constraint queue_items_condition_check
  check (condition in ('naive', 'coached', 'engine'));

alter table public.queue_items
  drop constraint if exists queue_items_rank_mode_check;
alter table public.queue_items
  add constraint queue_items_rank_mode_check
  check (rank_mode in ('map', 'ecv', 'edv'));
