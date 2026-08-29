-- Migration 027 — bind run_card_entries to the run's owner; anchor run_cards
-- ownership to auth.uid() (red-team R1, 2026-06-15)
--
-- THE HOLE. run_card_entries INSERT was `WITH CHECK (auth.uid() IS NOT NULL)`
-- only (migration 005, unchanged by 024 which merely dropped the UPDATE path).
-- Any authenticated user — a free GitHub/Google account — could insert
-- per-entry rows under ANY run_card_id: their own fabricated run, OR another
-- user's card to pollute/frame it. And run_cards had no auth-linked owner
-- column to bind against: migration 019 deliberately removed `submitter`
-- matching because `submitter` is derived from EDITABLE jwt user_metadata.
--
-- THIS MIGRATION.
--   1. run_cards.owner_uid uuid DEFAULT auth.uid() — the immutable, server-set
--      identity of the inserting user (NOT the spoofable `submitter` string).
--      Nullable on purpose: service_role inserts (verifier/CI) have no JWT, so
--      auth.uid() is NULL there; RLS is bypassed for service_role anyway.
--   2. run_cards INSERT now also requires owner_uid = auth.uid() — a client
--      cannot claim another user's uid; omitting the column gets the default,
--      which WITH CHECK then validates against the caller's uid.
--   3. run_card_entries INSERT now requires the parent run_card to be owned by
--      the same auth.uid() — you may only attach entries to your OWN run. This
--      gives the server-side verifier trustworthy entry provenance and closes
--      the cross-user grief/frame path.
--
-- The board is freshly wiped (0 run_cards / 0 entries on prod), so owner_uid
-- needs no backfill. Idempotent; safe on prod and fresh branches. service_role
-- bypasses RLS, so the upload pipeline / verifier are unaffected.
--
-- COMPANION: verifier.py re-fetches the sha-pinned corpus and scores against
-- the REAL references (not the submitter's stored `expected`). Together they
-- make trust='verified' mean "your own outputs, against the registered corpus."

-- 1. Server-set owner identity.
ALTER TABLE run_cards ADD COLUMN IF NOT EXISTS owner_uid uuid DEFAULT auth.uid();

-- 2. run_cards INSERT — authenticated, unverified, owned by the caller.
--    (Re-creates migration 019's policy with the owner_uid binding added.)
DROP POLICY IF EXISTS "Authenticated users can insert" ON run_cards;
CREATE POLICY "Authenticated users can insert" ON run_cards
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND trust = 'unverified'
    AND id IS NOT NULL
    AND length(id) > 10
    AND owner_uid = auth.uid()
  );

-- 3. run_card_entries INSERT — only onto a run_card you own.
DROP POLICY IF EXISTS "Authenticated insert"                ON run_card_entries;
DROP POLICY IF EXISTS run_card_entries_authenticated_insert ON run_card_entries;
DROP POLICY IF EXISTS "Owner insert"                        ON run_card_entries;
CREATE POLICY "Owner insert" ON run_card_entries
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM run_cards rc
      WHERE rc.id = run_card_entries.run_card_id
        AND rc.owner_uid = auth.uid()
    )
  );
