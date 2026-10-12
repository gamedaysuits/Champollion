-- 055_regenerate_queue_auth.sql
--
-- THE HOLE (launch-readiness audit 2026-07-18, M2). The regenerate-queue
-- edge function is deployed with verify_jwt=true — but the PUBLIC ANON KEY
-- is a valid JWT, so verify_jwt is satisfied by the key printed into every
-- browser. Any anon-key holder could loop the heavy refresh (streaming a
-- ~58 MB artifact, three service-key Storage writes per call): a free
-- cost-amplification lever against the project.
--
-- THE FIX has two halves — the edge-function half (in-handler shared-secret
-- check + minimum-interval debounce; functions/regenerate-queue/index.ts,
-- shipped with this migration) and THIS DB half:
--
--   1. `regen_state` — a single-row table the function uses for its
--      debounce window. The claim is an ATOMIC conditional UPDATE
--      (last_started_at < now() - interval) so concurrent invocations
--      cannot double-run. Service-role only (the 050 deny-all posture).
--
--   2. `notify_regenerate_queue()` (036) is REPLACED verbatim-plus-secret:
--      it now also reads the Vault secret `regenerate_queue_secret` and,
--      when set, sends it as the `x-regen-secret` header — so the
--      DB-trigger invocation path (pg_net, migration 036) keeps working
--      against the hardened function. When the Vault secret is unset the
--      function still posts WITHOUT the header (the 036 transition
--      posture): the hardened endpoint answers 401, which is VISIBLE in
--      the edge-function logs and net._http_response — a loud misconfig,
--      never a silent skip.
--
-- ONE-TIME SECRET SETUP (paired with the function deploy; the two must
-- carry the SAME value):
--
--     select vault.create_secret('<RANDOM-64-HEX>', 'regenerate_queue_secret');
--     supabase secrets set REGEN_SHARED_SECRET=<RANDOM-64-HEX>
--
-- Any OTHER scheduler (dashboard Scheduled Functions, external cron) must
-- send the same `x-regen-secret` header. The commented pg_cron heartbeat
-- from 036 is reproduced below with the header included.
--
-- Idempotent (CREATE TABLE IF NOT EXISTS + CREATE OR REPLACE + seeded row
-- ON CONFLICT DO NOTHING). DEV/STAGING BRANCH ONLY without the founder's
-- explicit go-ahead (CLAUDE.md); applied to prod 2026-07-18 under the
-- founder's launch-hardening authorization.
--
-- ROLLBACK:
--   DROP TABLE IF EXISTS public.regen_state;
--   -- re-apply migration 036 to restore the two-secret notifier.

-- ---------------------------------------------------------------------------
-- 1. Debounce state — one row, service-role only.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.regen_state (
    id              smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    last_started_at timestamptz NOT NULL DEFAULT to_timestamp(0),
    last_source     text,
    updated_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.regen_state IS
    'Single-row debounce state for the regenerate-queue edge function (migration 055): the function claims a run with an atomic conditional UPDATE on last_started_at, so bursts coalesce and concurrent invocations cannot double-run. Service-role only (RLS deny-all below service_role).';

INSERT INTO public.regen_state (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.regen_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS regen_state_service_role_only ON public.regen_state;
CREATE POLICY regen_state_service_role_only ON public.regen_state
    FOR ALL
    TO service_role
    USING (TRUE)
    WITH CHECK (TRUE);

-- ---------------------------------------------------------------------------
-- 2. The 036 notifier, replaced verbatim-plus-secret (see header).
-- ---------------------------------------------------------------------------
create or replace function public.notify_regenerate_queue()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, vault
as $$
declare
  fn_url    text;
  fn_token  text;
  fn_secret text;
  hdrs      jsonb;
begin
  -- Read the URL + token from Vault. If they are not set, do nothing (so the
  -- trigger can exist before the secrets are configured without erroring).
  select decrypted_secret into fn_url
    from vault.decrypted_secrets where name = 'regenerate_queue_url';
  select decrypted_secret into fn_token
    from vault.decrypted_secrets where name = 'regenerate_queue_token';
  -- The shared secret the hardened function requires (migration 055). When
  -- unset, the post still fires WITHOUT the header — the function's 401 is
  -- the loud, log-visible signal to finish the secret setup.
  select decrypted_secret into fn_secret
    from vault.decrypted_secrets where name = 'regenerate_queue_secret';

  if fn_url is null or fn_token is null then
    return null;
  end if;

  hdrs := jsonb_build_object(
            'Authorization', 'Bearer ' || fn_token,
            'Content-Type',  'application/json');
  if fn_secret is not null then
    hdrs := hdrs || jsonb_build_object('x-regen-secret', fn_secret);
  end if;

  perform net.http_post(
    url     := fn_url,
    headers := hdrs,
    body    := jsonb_build_object('source', 'run_cards_trigger')
  );
  return null;  -- AFTER STATEMENT trigger; return value is ignored
end;
$$;

comment on function public.notify_regenerate_queue() is
  'Fire-and-forget pg_net call to the regenerate-queue edge function. Wired '
  'to run_cards (036). URL + token + shared secret come from Vault secrets '
  'regenerate_queue_url / regenerate_queue_token / regenerate_queue_secret; '
  'no-op until url+token are set; posts without x-regen-secret (and is '
  'refused 401, visibly) until the secret is set. Migrations 036 + 055.';

-- ---------------------------------------------------------------------------
-- Optional pg_cron heartbeat (the 036 template, updated with the secret
-- header). Uncomment to enable (requires pg_cron):
--
--   create extension if not exists pg_cron with schema extensions;
--   select cron.schedule(
--     'regenerate-queue-heartbeat',
--     '*/10 * * * *',
--     $cron$
--       select net.http_post(
--         url     := (select decrypted_secret from vault.decrypted_secrets
--                      where name = 'regenerate_queue_url'),
--         headers := jsonb_build_object(
--                      'Authorization', 'Bearer ' ||
--                        (select decrypted_secret from vault.decrypted_secrets
--                          where name = 'regenerate_queue_token'),
--                      'x-regen-secret',
--                        (select decrypted_secret from vault.decrypted_secrets
--                          where name = 'regenerate_queue_secret'),
--                      'Content-Type', 'application/json'),
--         body    := jsonb_build_object('source', 'cron_heartbeat'));
--     $cron$);
--
-- To remove the schedule later: select cron.unschedule('regenerate-queue-heartbeat');
