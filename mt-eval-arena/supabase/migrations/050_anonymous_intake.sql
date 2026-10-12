-- Migration 050 — anonymous intake lane (founder directive 2026-07-13)
--
-- "We don't want people to NEED to OAuth to contribute to the queue through
-- the bash function built on the site — optional, not required."
--
-- THE LANE. A new edge function (functions/submit-run, verify_jwt=false)
-- accepts one run-card payload from an unauthenticated contributor, validates
-- it strictly, and inserts with the service role as:
--
--     submitter = 'anonymous', owner_uid = NULL, trust = 'unverified'
--
-- WHAT THIS MIGRATION DOES and deliberately does NOT do:
--
--   1. run_cards.owner_uid — ALREADY nullable by design (migration 027 added
--      it via ADD COLUMN with no NOT NULL, precisely because service-role
--      inserts have auth.uid() = NULL). The DO block below only drops a
--      NOT NULL constraint if some branch ever acquired one (defensive,
--      idempotent, a no-op on prod).
--
--   2. NO trigger amendments are needed. The owner binding (027) is an RLS
--      POLICY, not a trigger — the service role bypasses RLS, and an
--      owner_uid = NULL service-role insert is the established verifier/CI
--      pattern 027's own header documents. Every integrity TRIGGER still
--      fires under the service role and is deliberately kept in force for
--      the anonymous lane:
--        · 022 run_cards_quarantine_guard   (quarantined datasets never rank)
--        · 023 run_cards_score_integrity    (ranges, non-vacuous, tier vocab)
--        · 026 run_cards_sha_parity_guard   (corpus sha must match the pin)
--        · 033 run_card_entries_content_guard (NC/sealed/unregistered content
--                                              never exposed)
--        · 036 regenerate_queue trigger     (the board refresh that shrinks
--                                            the queue — the whole point)
--
--   3. anon_intake_log — the rate-limit ledger for the edge function's
--      per-IP sliding window (default 5 cards/hour/IP) and global daily cap
--      (default 200/day; both env-tunable on the function). PRIVACY: the
--      client IP is never stored — only a salted SHA-256 hash, used solely
--      for windowed counting. RLS is enabled with NO anon/authenticated
--      policies (deny-all; the 017 run_cards_audit pattern) — only the
--      service role (the edge function) reads or writes it.
--
-- IDENTITY / HONESTY NOTES (documented here because this is the migration a
-- future reader will find):
--   · `submitter` has always been DISPLAY-ONLY (019/027: it derives from
--     editable JWT user_metadata for authed inserts). 'anonymous' is a
--     display value, not an authorization identity; the authorization
--     identity remains owner_uid, which is NULL for this lane.
--   · Anonymous rows rank exactly like any other trust='unverified' row —
--     same tier, same verifier eligibility, no fabricated attribution.
--   · MODERATION: anonymous rows are purgeable through the existing audit
--     lane — service-role UPDATE/DELETE on run_cards is captured by the 017
--     run_cards_audit trigger, so removal is recorded and reversible. The
--     `owner_uid IS NULL AND submitter = 'anonymous'` pair is the lane's
--     queryable marker.
--
-- Idempotent; safe on prod and fresh branches. DO NOT apply to prod without
-- the founder's explicit go-ahead (Supabase rule).
--
-- ROLLBACK:
--   DROP TABLE IF EXISTS anon_intake_log;
--   -- (owner_uid nullability was the 027 status quo; nothing to restore)

-- 1. Defensive: owner_uid must accept NULL (it already does on prod — 027
--    added it without NOT NULL. Branch safety only).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'run_cards'
      AND column_name  = 'owner_uid'
      AND is_nullable  = 'NO'
  ) THEN
    ALTER TABLE run_cards ALTER COLUMN owner_uid DROP NOT NULL;
  END IF;
END;
$$;

-- 2. Rate-limit ledger for the anonymous intake edge function.
CREATE TABLE IF NOT EXISTS anon_intake_log (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    ip_hash      TEXT NOT NULL,            -- salted SHA-256 of the client IP; the raw IP is never stored
    run_card_id  TEXT NOT NULL,            -- run_cards.id the anonymous insert published
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE anon_intake_log IS
    'Rate-limit ledger for the anonymous run-card intake (submit-run edge function). One row per successfully published anonymous card. ip_hash is a salted SHA-256 — raw IPs are never stored. Service-role only (RLS deny-all).';

-- Windowed counting: per-IP hourly window + global daily cap.
CREATE INDEX IF NOT EXISTS idx_anon_intake_ip_time
    ON anon_intake_log (ip_hash, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_anon_intake_time
    ON anon_intake_log (submitted_at DESC);

-- 3. RLS — deny-all below service_role. RLS enabled + no anon/authenticated
--    policies = deny (the 017 pattern); the explicit service_role policy is
--    documentation of intent (service_role bypasses RLS anyway).
ALTER TABLE anon_intake_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_intake_log_service_role_only" ON anon_intake_log;
CREATE POLICY "anon_intake_log_service_role_only" ON anon_intake_log
    FOR ALL
    TO service_role
    USING (TRUE)
    WITH CHECK (TRUE);

-- 4. Retention: the ledger only needs 24h of history (the widest window the
--    function counts over). Uncomment to purge on a schedule via pg_cron, or
--    run the DELETE ad hoc — keeping extra rows is harmless, just clutter.
--
-- SELECT cron.schedule(
--   'purge-anon-intake-log', '17 * * * *',
--   $$DELETE FROM anon_intake_log WHERE submitted_at < now() - interval '48 hours'$$
-- );
