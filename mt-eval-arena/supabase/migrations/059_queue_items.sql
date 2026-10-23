-- 059_queue_items.sql — the DB-as-queue foundation (B1, 2026-07-20)
--
-- WHY. Today the queue is a ~7–58 MB static queue.json blob: too big to
-- JSON.parse in the 256 MB edge isolate (a hand-rolled streaming scanner works
-- around it), and its RANKING is frozen between manual Python regens — the edge
-- function folds new results into the mesh but never re-ranks, so items already
-- covered keep showing and map-value connectivity classes go stale. "The map
-- must be true" quietly breaks.
--
-- WHAT. Move the queue's STORAGE + live COVERAGE-FILTERING + PAGINATION into the
-- database. The tested Python ranker (arena/scripts/generate_sweep_queue.py)
-- stays the ranking AUTHORITY — it now upserts its ranked candidate items into
-- public.queue_items. The queue is SERVED by queue_top(), which live-excludes
-- combos already covered by a VERIFIED run and returns an ordered page. So the
-- served list is never stale against the board, and the blob + streaming scanner
-- can retire once consumers migrate to the RPC.
--
-- SAFETY. Purely ADDITIVE — nothing reads queue_items yet, so this breaks no
-- existing path. Rehearse on the Supabase DEV branch before prod (standing rule).
-- The (corpus_id, model, condition) join keys were verified 2026-07-20 to match
-- run_cards.(dataset_id, model_slug, condition) exactly on the live board.

create table if not exists public.queue_items (
  id              text primary key,          -- served item id: corpus__model__condition
  rank_mode       text not null,             -- 'map' | 'ecv' (which ordering set priority)
  priority        int  not null,             -- 1-based rank within rank_mode
  language_pair   text not null,
  source_language text,
  target_language text,
  corpus_id       text not null,             -- = datasets.id / run_cards.dataset_id
  corpus_license  text,
  entry_count     int,
  contamination   text,
  domain          text,
  source_length   int,
  model           text not null,             -- = run_cards.model_slug
  condition       text not null,             -- = run_cards.condition ('naive'|'coached')
  est_cost_usd    numeric,
  est_basis       text,
  run_command     text,
  map_value       numeric,                   -- ordering currency in map mode; null in ecv
  diagnostics     jsonb not null default '{}'::jsonb,  -- full ecv/map re-derivability fields
  generation_id   text not null,             -- stamps one full ranker run (atomic swap)
  generated_at    timestamptz not null default now(),
  check (condition in ('naive','coached')),
  check (rank_mode in ('map','ecv'))
);

create index if not exists idx_queue_items_mode_priority on public.queue_items (rank_mode, priority);
create index if not exists idx_queue_items_coverage      on public.queue_items (corpus_id, model, condition);

-- RLS: the queue is public to READ; only the ranker (service role, which bypasses
-- RLS) writes. Migration 054's event trigger auto-enables RLS on new tables, so
-- WITHOUT this SELECT policy the table would be deny-all — add it explicitly.
alter table public.queue_items enable row level security;
drop policy if exists queue_items_public_read on public.queue_items;
create policy queue_items_public_read on public.queue_items for select using (true);

comment on table public.queue_items is
  'DB-as-queue (059/B1). Ranked candidate items materialized by the Python ranker '
  '(generate_sweep_queue.py, the ranking authority). Served via queue_top() with '
  'live verified-coverage filtering. Public-read; service-role write.';

-- ── The serving RPC ──────────────────────────────────────────────────────────
-- Ranked page for a rank_mode, live-excluding combos already covered by a
-- VERIFIED run. Unverified/pending work does NOT remove an item — only refereed
-- results count as "done" (closes the "unverified rows suppress queue work"
-- issue). SECURITY INVOKER: relies on the public-read policies on queue_items and
-- run_cards, so anon/authenticated callers see exactly what they may see.
create or replace function public.queue_top(
  p_rank_mode text default 'map',
  p_limit     int  default 25,
  p_offset    int  default 0
)
returns setof public.queue_items
language sql
stable
security invoker
set search_path = public
as $$
  select qi.*
  from public.queue_items qi
  where qi.rank_mode = p_rank_mode
    and not exists (
      select 1
      from public.run_cards rc
      where rc.dataset_id = qi.corpus_id
        and rc.model_slug = qi.model
        and rc.condition  = qi.condition
        and rc.trust      = 'verified'
    )
  order by qi.priority
  limit  greatest(0, least(coalesce(p_limit, 25), 500))   -- hard page-size cap
  offset greatest(0, coalesce(p_offset, 0));
$$;

comment on function public.queue_top(text,int,int) is
  'Serve the queue: ranked page for a rank_mode, live-excluding combos already '
  'covered by a VERIFIED run. Replaces the static queue.json blob + the edge '
  'streaming scanner; the ordering is never stale against the board.';

grant execute on function public.queue_top(text,int,int) to anon, authenticated;
