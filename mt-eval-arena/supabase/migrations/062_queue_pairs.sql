-- 062_queue_pairs.sql — per-pair queue aggregation for the website (B1, 2026-07-20)
--
-- WHY. The leaderboard's "N benchmarks waiting for this selection" strip and the
-- /contribute page's live open-item count read a static /queue-preview.json blob
-- (its pre-aggregated `pairs` array + `metadata.open_items`), which freezes the
-- moment the Python ranker last ran. Migration 059 already serves the ORDERED
-- queue live from queue_top(); this adds the matching AGGREGATE view so the
-- website's per-pair counts are live too — coverage-filtered against the board
-- exactly like queue_top, so a pair's waiting-count drops the instant a VERIFIED
-- run covers its last open combo. "The map must be true" for the counts as well.
--
-- WHAT. queue_pairs() returns one row per language_pair over queue_items in a
-- rank_mode, carrying the item count and the cheapest est_cost_usd, with the
-- SAME `NOT EXISTS ... trust='verified'` coverage filter as queue_top() (059).
-- Because every queue item belongs to exactly one pair, SUM(item_count) over the
-- returned rows equals the live open-item total — the /contribute headline count.
--
-- SAFETY. Purely ADDITIVE, read-only. SECURITY INVOKER: it relies on the
-- public-read policies on queue_items (059) and run_cards, so anon/authenticated
-- callers see exactly what they may see — and, mirroring queue_top's filter
-- verbatim, the two agree by construction (a bogus UNVERIFIED run can never
-- inflate or deflate a pair's count; only refereed results count as "covered").

create or replace function public.queue_pairs(
  p_rank_mode text default 'map'
)
returns table (
  pair       text,
  src        text,
  tgt        text,
  item_count bigint,
  min_cost   numeric
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    qi.language_pair                       as pair,
    split_part(qi.language_pair, '>', 1)   as src,
    split_part(qi.language_pair, '>', 2)   as tgt,
    count(*)                               as item_count,
    min(qi.est_cost_usd)                   as min_cost
  from public.queue_items qi
  where qi.rank_mode = p_rank_mode
    -- IDENTICAL coverage filter to queue_top() (059): only a VERIFIED run marks a
    -- (corpus, model, condition) combo as done. Keep these two in lockstep.
    and not exists (
      select 1
      from public.run_cards rc
      where rc.dataset_id = qi.corpus_id
        and rc.model_slug = qi.model
        and rc.condition  = qi.condition
        and rc.trust      = 'verified'
    )
  group by qi.language_pair
  order by qi.language_pair;
$$;

comment on function public.queue_pairs(text) is
  'Per-language-pair queue aggregation: {pair, src, tgt, item_count, min_cost} '
  'over queue_items, live-excluding combos covered by a VERIFIED run (same filter '
  'as queue_top/059). Feeds the leaderboard waiting-count strip and the '
  '/contribute open-item total (SUM(item_count)). Public-read; service-role write.';

grant execute on function public.queue_pairs(text) to anon, authenticated;
