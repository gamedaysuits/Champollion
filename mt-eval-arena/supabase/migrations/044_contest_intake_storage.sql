-- =============================================================================
-- Migration 044: contest-intake storage — the private bucket for hypothesis bytes
-- =============================================================================
-- Phase A (organizer scoring node) of the sovereign contest pipeline.
-- The contest_intake table (043) stores DIGESTS + lifecycle only; the actual
-- hypothesis bundles (tar.gz of dev + test hypotheses + manifest) live here, in
-- a PRIVATE storage bucket. Hypotheses are the PARTICIPANT'S OWN translations —
-- participant-owned artifacts, not corpus content — so they may transit our
-- storage without violating the never-host-corpus-content doctrine
-- (docs/DATA_BOUNDARIES.md). The secret REFERENCES never touch this bucket, or
-- any Champollion infrastructure, at all: they exist only on the organizer's
-- machine.
--
-- PATH CONVENTION (enforced by the policies below):
--   contest-intake/<contest_id>/<submitter_email>/<intake_id>.tar.gz
-- The second path segment must equal the uploader's JWT email, so a
-- participant can only ever write into (and read back from) their own folder.
--
-- IMMUTABLE + RETAINED INDEFINITELY (founder decision 2026-07-07): there are
-- NO authenticated UPDATE or DELETE policies — an uploaded bundle can never be
-- swapped after its digests are recorded in contest_intake (043 freezes the
-- digests; this freezes the bytes), and bundles are kept as the artifact audit
-- trail. The organizer node (service_role) reads bundles for scoring; it never
-- deletes them.
--
-- IDEMPOTENT. DEV/STAGING BRANCH ONLY — do NOT apply to production without the
-- founder's explicit go-ahead (CLAUDE.md).
--
-- ROLLBACK:
--   DROP POLICY IF EXISTS contest_intake_upload_own_folder ON storage.objects;
--   DROP POLICY IF EXISTS contest_intake_read_own_folder ON storage.objects;
--   DELETE FROM storage.buckets WHERE id = 'contest-intake';
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Bucket: contest-intake (private — public=false; no anonymous access path)
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('contest-intake', 'contest-intake', false)
ON CONFLICT (id) DO UPDATE SET public = false;  -- re-running must never flip it public

-- ---------------------------------------------------------------------------
-- Policies on storage.objects — participants write/read ONLY their own folder;
-- everything else is service_role (the organizer node), which bypasses RLS.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS contest_intake_upload_own_folder ON storage.objects;
CREATE POLICY contest_intake_upload_own_folder
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
      bucket_id = 'contest-intake'
      AND (storage.foldername(name))[2] =
          current_setting('request.jwt.claims', true)::json->>'email'
    );

DROP POLICY IF EXISTS contest_intake_read_own_folder ON storage.objects;
CREATE POLICY contest_intake_read_own_folder
    ON storage.objects
    FOR SELECT
    TO authenticated
    USING (
      bucket_id = 'contest-intake'
      AND (storage.foldername(name))[2] =
          current_setting('request.jwt.claims', true)::json->>'email'
    );

-- Deliberately NO UPDATE and NO DELETE policies for anon/authenticated:
-- bundles are immutable once uploaded (their digests are frozen in
-- contest_intake) and retained indefinitely as the artifact audit trail.
