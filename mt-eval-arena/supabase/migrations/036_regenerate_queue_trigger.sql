-- 036_regenerate_queue_trigger.sql
--
-- Event-driven regeneration of the public network artifacts (queue.json,
-- queue-preview.json, mesh.json). Replaces the deleted "Regenerate queue +
-- mesh" GitHub Action: instead of a nightly CI job committing the artifacts to
-- git, the `regenerate-queue` Supabase Edge Function does a cheap delta refresh
-- (drop completed items, fold new results into the mesh) and the site serves
-- the result from Storage. This migration is the TRIGGER that fires it when
-- run_cards change.
--
-- ⚠️  NOT APPLIED. Per the repo's Supabase rule (dev branch only without an
-- explicit go-ahead; never write prod from a chip), this file is staged for the
-- FOUNDER to apply — to the dev/staging branch first, then prod after review.
-- Renumber if your target branch already has a 036 (the blind-eval PoC reserved
-- 036+ on a separate dev branch).
--
-- It is idempotent (IF NOT EXISTS / CREATE OR REPLACE) and safe to re-run.
--
-- ── Before applying, set two project secrets (one-time) ──────────────────────
--   The trigger calls the function over HTTP and must authenticate. Store the
--   function URL + a bearer token in Vault so they are not hard-coded here:
--
--     select vault.create_secret(
--       'https://<PROJECT_REF>.supabase.co/functions/v1/regenerate-queue',
--       'regenerate_queue_url');
--     select vault.create_secret('<SERVICE_ROLE_OR_ANON_KEY>',
--       'regenerate_queue_token');
--
--   (Use the service_role key if the function writes Storage with it; the anon
--   key is fine if the bucket allows authenticated writes for the function.)
-- ─────────────────────────────────────────────────────────────────────────────

-- pg_net: lets a trigger make an outbound HTTP request (fire-and-forget).
create extension if not exists pg_net with schema extensions;

-- ── The notifier ─────────────────────────────────────────────────────────────
-- Statement-level: one call per INSERT statement (a bulk publish fires it once,
-- not once per row). Fire-and-forget — net.http_post queues the request and
-- returns immediately, so publishing is never blocked or slowed by the refresh.
create or replace function public.notify_regenerate_queue()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, vault
as $$
declare
  fn_url   text;
  fn_token text;
begin
  -- Read the URL + token from Vault. If they are not set, do nothing (so the
  -- trigger can exist before the secrets are configured without erroring).
  select decrypted_secret into fn_url
    from vault.decrypted_secrets where name = 'regenerate_queue_url';
  select decrypted_secret into fn_token
    from vault.decrypted_secrets where name = 'regenerate_queue_token';

  if fn_url is null or fn_token is null then
    return null;
  end if;

  perform net.http_post(
    url     := fn_url,
    headers := jsonb_build_object(
                 'Authorization', 'Bearer ' || fn_token,
                 'Content-Type',  'application/json'),
    body    := jsonb_build_object('source', 'run_cards_trigger')
  );
  return null;  -- AFTER STATEMENT trigger; return value is ignored
end;
$$;

-- ── The trigger ──────────────────────────────────────────────────────────────
-- AFTER INSERT (a new published result can complete a queue item and light up a
-- mesh edge) and AFTER UPDATE OF trust (a disqualification removes coverage, so
-- the dropped item should return to the queue). DELETE is not wired — run_cards
-- are immutable by policy.
drop trigger if exists run_cards_regenerate_queue on public.run_cards;
create trigger run_cards_regenerate_queue
  after insert or update of trust on public.run_cards
  for each statement
  execute function public.notify_regenerate_queue();

-- ── Optional debounce / heartbeat (pg_cron) ──────────────────────────────────
-- The trigger fires per statement, so a burst of publishes (e.g. a give batch)
-- triggers several refreshes in quick succession. The function is idempotent so
-- that is harmless, but if you prefer to coalesce them, you can DISABLE the
-- trigger above and instead schedule a periodic refresh. A periodic heartbeat
-- also catches new corpora (registry changes the function folds in) that no
-- run_cards insert would surface. Uncomment to enable (requires pg_cron):
--
--   create extension if not exists pg_cron with schema extensions;
--   select cron.schedule(
--     'regenerate-queue-heartbeat',
--     '*/10 * * * *',  -- every 10 minutes
--     $cron$
--       select net.http_post(
--         url     := (select decrypted_secret from vault.decrypted_secrets
--                      where name = 'regenerate_queue_url'),
--         headers := jsonb_build_object(
--                      'Authorization', 'Bearer ' ||
--                        (select decrypted_secret from vault.decrypted_secrets
--                          where name = 'regenerate_queue_token'),
--                      'Content-Type', 'application/json'),
--         body    := jsonb_build_object('source', 'cron_heartbeat'));
--     $cron$);
--
-- To remove the schedule later: select cron.unschedule('regenerate-queue-heartbeat');

comment on function public.notify_regenerate_queue() is
  'Fire-and-forget pg_net call to the regenerate-queue edge function. Wired '
  'to run_cards (036). URL + token come from Vault secrets '
  'regenerate_queue_url / regenerate_queue_token; no-op until both are set.';
