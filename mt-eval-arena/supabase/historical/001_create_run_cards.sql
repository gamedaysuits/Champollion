-- ============================================================
-- Champollion Leaderboard: run_cards table
-- Apply via Supabase Dashboard > SQL Editor
-- ============================================================

-- The run_cards table stores eval harness submissions.
-- Each row is a single run card submitted via --submit.
-- The primary key is the harness-computed SHA-256 hash,
-- which prevents duplicate submissions.

create table public.run_cards (
  -- Primary key: SHA-256 hash of the run card (deterministic per-run)
  id text primary key,
  
  -- Submission metadata
  submitter text not null,
  affirmation text not null,
  submitted_at timestamptz not null default now(),
  trust text not null default 'unverified'
    check (trust in ('unverified', 'verified', 'disqualified')),
  
  -- Denormalized fields for efficient leaderboard queries
  model_slug text not null,
  condition text not null,
  dataset_id text not null,
  language_pair text not null,
  harness_version text not null,
  
  -- Core metrics (denormalized for sort performance)
  chrf_plus_plus real,
  exact_match_rate real,
  fst_acceptance_rate real,
  
  -- Cost & performance
  total_cost_usd real,
  elapsed_seconds real,
  corpus_size integer,
  
  -- The complete run card JSON (source of truth)
  run_card jsonb not null,
  
  -- Fingerprint hash for grouping runs by method+config
  fingerprint_hash text not null,
  
  -- Timestamp from the run itself
  run_timestamp timestamptz
);

-- Indexes for leaderboard queries
create index idx_run_cards_leaderboard 
  on public.run_cards (dataset_id, chrf_plus_plus desc nulls last);

create index idx_run_cards_model 
  on public.run_cards (model_slug, dataset_id);

create index idx_run_cards_fingerprint 
  on public.run_cards (fingerprint_hash);

-- Row Level Security
alter table public.run_cards enable row level security;

-- Anyone can read (leaderboard is public)
create policy "Public read access"
  on public.run_cards for select
  using (true);

-- Anyone can insert with anon key (trust must be 'unverified')
create policy "Anonymous insert access"
  on public.run_cards for insert
  with check (
    trust = 'unverified'
    and id is not null
    and length(id) > 10
  );

-- No update/delete for anon — submissions are immutable
-- Admins use service_role key via dashboard to moderate
