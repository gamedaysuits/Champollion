-- 061_contributor_reputation.sql — reputation-weighted auditing (B3, 2026-07-20)
--
-- WHY. The board must be *valid by construction* while keeping distributed
-- contribution worthwhile: contributors do the expensive work (running
-- translations), so the project must NOT re-run everything. Provenance ("this run
-- came through the harness") is not server-verifiable for self-hosted compute —
-- the open harness's key is in the user's hands (the sovereign layer already says
-- "a signature authenticates a machine, not honesty") — so validity is *earned
-- and self-correcting* via reputation-weighted auditing, not attested. The four
-- layers (docs/TRUST_MODEL_REPUTATION.md):
--   L0  re-score submitted outputs vs the sha-pinned reference (verifier.py) — 100%.
--   L1  a contributor REPUTATION ladder (THIS migration's `contributors` table).
--   L2  re-run a SAMPLE to confirm outputs are real; sampling = f(reputation ↓,
--       stakes ↑, anomaly ↑). Outcomes recorded in `contributor_audit_log`.
--   L3  corroboration: two INDEPENDENT contributors agreeing = free verification.
--
-- WHAT. Two ADDITIVE, PUBLIC-READ, service-role-write tables:
--   · contributors           — one reputation ledger row per stable identity.
--   · contributor_audit_log  — append-only audit/retraction trail (public, like a
--                              journal retraction).
-- Plus a SECURITY INVOKER read helper so the website can show a reputation badge.
--
-- IDENTITY. contributor_id is TEXT (canonical: 'uid:<run_cards.owner_uid>') so a
-- future pseudonymous-key scheme ('key:<fp>') can slot into the SAME table + math
-- with no migration. Wave-1 keys reputation to owner_uid (OAuth). Anonymous
-- submissions (migration 050: owner_uid NULL) carry NO persistent reputation —
-- they are the provisional floor (always sampled, never promoted on L0 alone).
--
-- SAFETY. Purely ADDITIVE: no existing table/trigger/policy is touched. The
-- run_cards quarantine (022), score-integrity (023), sha-parity (026), content
-- (033/051) triggers and queue_top's (059) verified-only serving are all UNCHANGED
-- — this migration adds a reputation dimension ALONGSIDE them, it does not weaken
-- them. Idempotent; safe on prod and fresh replays. DO NOT apply to prod without
-- the founder's explicit go-ahead (Supabase standing rule).
--
-- ROLLBACK:
--   DROP FUNCTION IF EXISTS public.contributor_reputation(text);
--   DROP TABLE IF EXISTS public.contributor_audit_log;
--   DROP TABLE IF EXISTS public.contributors;

-- ── 1. contributors — the reputation ledger ─────────────────────────────────
create table if not exists public.contributors (
  contributor_id     text primary key,                 -- 'uid:<owner_uid>' | future 'key:<fp>'
  reputation         int  not null default 0,          -- earned ONLY by clean L2 audit / L3 corroboration
  status             text not null default 'provisional',
  clean_audits       int  not null default 0,          -- L2 audits passed
  total_audits       int  not null default 0,          -- L2 audits attempted
  corroborations     int  not null default 0,          -- L3 independent agreements
  caught_fraud_count int  not null default 0,          -- times burned (permanent scar)
  verified_runs      int  not null default 0,          -- runs that reached trust='verified' (track record, not trust)
  first_seen_at      timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  check (reputation >= 0),
  check (status in ('provisional','established','burned'))
);

comment on table public.contributors is
  'Reputation-weighted auditing (061/B3, L1). One reputation ledger row per stable '
  'contributor identity (contributor_id = ''uid:<owner_uid>'' today; ''key:<fp>'' '
  'reserved for a future pseudonymous scheme). Reputation is earned ONLY by '
  'hard-to-fake signals (a clean L2 re-run, or L3 corroboration) — never by L0 '
  'pass alone — so minting fresh identities buys nothing (Sybil resistance). '
  'Public-read (transparency is the point); service-role write (the verifier).';

-- ── 2. contributor_audit_log — append-only audit / retraction trail ─────────
-- No FK to run_cards or contributors: this trail must OUTLIVE a board wipe
-- (run_cards DELETE) and must be writable before a contributors row exists on a
-- first audit — exactly the durability the 017 run_cards_audit table has.
create table if not exists public.contributor_audit_log (
  id                bigint generated always as identity primary key,
  contributor_id    text,                              -- NULL for anonymous (owner_uid NULL)
  run_card_id       text not null,                     -- the run this outcome is about
  layer             text not null,                     -- 'L0' | 'L2' | 'L3'
  outcome           text not null,                     -- pass|fail|corroborated|disagreement|burn|reaudit
  reputation_delta  int  not null default 0,
  reputation_after  int,
  detail            jsonb not null default '{}'::jsonb,
  created_at        timestamptz not null default now(),
  check (layer in ('L0','L2','L3')),
  check (outcome in ('pass','fail','corroborated','disagreement','burn','reaudit'))
);

create index if not exists idx_contributor_audit_contributor
  on public.contributor_audit_log (contributor_id, created_at desc);
create index if not exists idx_contributor_audit_run
  on public.contributor_audit_log (run_card_id);
create index if not exists idx_contributor_audit_outcome
  on public.contributor_audit_log (outcome, created_at desc);

comment on table public.contributor_audit_log is
  'Reputation-weighted auditing (061/B3). Append-only public audit + retraction '
  'trail: L0 re-score outcomes, L2 sampled re-runs, L3 corroborations, and burn / '
  'history-reaudit events. A ''burn'' row (and the ''reaudit'' rows it spawns) is '
  'as public as a journal retraction. No FK — the trail outlives a board wipe. '
  'Public-read; service-role write.';

-- ── 3. RLS — public READ (transparency), service-role WRITE only ────────────
-- Migration 054's event trigger auto-enables RLS on new tables, so WITHOUT an
-- explicit SELECT policy each table would be deny-all. The public-read policy is
-- the whole point (the reputation + retraction record is the moat). There is NO
-- client INSERT/UPDATE policy: only the service-role verifier writes, and
-- service_role bypasses RLS.
alter table public.contributors           enable row level security;
alter table public.contributor_audit_log  enable row level security;

drop policy if exists contributors_public_read on public.contributors;
create policy contributors_public_read
  on public.contributors for select using (true);

drop policy if exists contributor_audit_log_public_read on public.contributor_audit_log;
create policy contributor_audit_log_public_read
  on public.contributor_audit_log for select using (true);

-- ── 4. Read helper — the public reputation badge ────────────────────────────
-- SECURITY INVOKER over the public-read table (same posture as queue_top, 059),
-- so anon/authenticated callers see exactly what the SELECT policy allows.
create or replace function public.contributor_reputation(p_contributor_id text)
returns public.contributors
language sql
stable
security invoker
set search_path = public
as $$
  select * from public.contributors where contributor_id = p_contributor_id;
$$;

comment on function public.contributor_reputation(text) is
  'Public reputation badge lookup for one contributor_id. SECURITY INVOKER over '
  'the public-read contributors table.';

-- EXECUTE hygiene (replay-clean, mirrors 058/DB2): drop the default PUBLIC grant,
-- then grant only the two API roles — so a from-scratch migration replay never
-- leaves a broad PUBLIC EXECUTE for the advisor to flag.
revoke execute on function public.contributor_reputation(text) from public;
grant  execute on function public.contributor_reputation(text) to anon, authenticated;
