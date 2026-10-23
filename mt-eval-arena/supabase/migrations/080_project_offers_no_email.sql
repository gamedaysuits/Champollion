-- 080_project_offers_no_email.sql — Join a project: a helper is never known by email
-- (docs review 2026-10-12: defects #2 and #24 against 079)
--
-- 1. 079 keyed a helper's offer by their JWT EMAIL — in project_offers.submitted_by,
--    in the storage path (<slug>/<email>/<offer>/<file>) and so in the consent
--    note — and the project's owner reads all three. A helper offers under a NAME
--    (helper_display); their email is theirs. From here a helper is their account
--    id: the JWT `sub` (a random UUID that names nobody), set by a trigger from the
--    caller's own token, so a client cannot write another's.
-- 2. 079 let no one delete an offered file: a withdrawn or declined offer, or an
--    upload whose offer row was never written, left its file in the bucket. Files
--    are removed through the storage API (never a SQL DELETE: that orphans the
--    blob), so this adds the DELETE policies that allow it:
--      - the helper: their own folder's files, unless the offer stands (offered or
--        accepted);
--      - the owner: a declined offer's file in their project.
--    An accepted file stays (the owner's copy is in their project; the stored one
--    is the record of what was offered).
--
-- Drafted 2026-10-12, NOT applied anywhere yet — see migrations/README.md.
-- Refuses to run while any offer row, or any stored file's folder, is still keyed
-- by an email (none existed: no third-party use yet). After it, a CHECK keeps an
-- email out of submitted_by for every writer, the service role included (the
-- schema write-up's D22, 2026-10-13: the first draft checked rows only, and
-- nothing but RLS kept an email out).

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.project_offers WHERE submitted_by LIKE '%@%') THEN
    RAISE EXCEPTION '080: project_offers holds offers keyed by an email — move them by hand before applying';
  END IF;
  IF EXISTS (SELECT 1 FROM storage.objects
              WHERE bucket_id = 'project-offers' AND (storage.foldername(name))[2] LIKE '%@%') THEN
    RAISE EXCEPTION '080: the project-offers bucket holds files in a folder named by an email — move or remove them by hand before applying';
  END IF;
END $$;

ALTER TABLE public.project_offers DROP CONSTRAINT IF EXISTS project_offers_submitted_by_not_email;
ALTER TABLE public.project_offers ADD CONSTRAINT project_offers_submitted_by_not_email
    CHECK (position('@' IN submitted_by) = 0);

COMMENT ON COLUMN public.project_offers.submitted_by IS
    'The helper''s account id (the JWT sub, a random UUID) — never an email (a CHECK refuses one): the project''s owner reads this row. Set from the caller''s own token by project_offers_aa_set_helper. Migration 080.';

-- ---------------------------------------------------------------------------
-- The helper's identity, from their own token (fires before 079's admission guard:
-- triggers run in name order, and _aa_ sorts before _admission_)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.project_offer_set_helper()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_sub text := current_setting('request.jwt.claims', true)::json->>'sub';
BEGIN
  IF v_sub IS NOT NULL AND v_sub <> '' THEN
    NEW.submitted_by := v_sub;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS project_offers_aa_set_helper ON public.project_offers;
CREATE TRIGGER project_offers_aa_set_helper
    BEFORE INSERT ON public.project_offers
    FOR EACH ROW
    EXECUTE FUNCTION public.project_offer_set_helper();

-- 079's admission check, its storage-path message naming the account id
CREATE OR REPLACE FUNCTION public.project_offer_admission_check()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_limit CONSTANT int := 24;
  v_slug text;
  v_status text;
  v_count int;
BEGIN
  IF NEW.status IS DISTINCT FROM 'offered' OR NEW.decline_reason IS NOT NULL THEN
    RAISE EXCEPTION 'OFFER GUARD: an offer is born ''offered'' (got %).', NEW.status;
  END IF;
  SELECT p.slug, p.status INTO v_slug, v_status FROM public.projects p WHERE p.id = NEW.project_id;
  IF v_status IS DISTINCT FROM 'listed' THEN
    RAISE EXCEPTION 'OFFER GUARD: project % is not listed (%), so it takes no offers.', NEW.project_id, v_status;
  END IF;
  IF NEW.ask_id IS NOT NULL AND NOT EXISTS (
       SELECT 1 FROM public.project_asks a
        WHERE a.id = NEW.ask_id AND a.project_id = NEW.project_id AND a.status = 'open') THEN
    RAISE EXCEPTION 'OFFER GUARD: ask % is not an open ask of project %.', NEW.ask_id, v_slug;
  END IF;
  IF NEW.storage_path IS DISTINCT FROM
       v_slug || '/' || NEW.submitted_by || '/' || NEW.offer_id || '/' || NEW.file_name THEN
    RAISE EXCEPTION
      'OFFER GUARD: storage_path must be <project slug>/<your account id>/<offer id>/<file name> (got %).',
      NEW.storage_path;
  END IF;
  SELECT COUNT(*) INTO v_count FROM public.project_offers o
   WHERE o.submitted_by = NEW.submitted_by AND o.created_at > NOW() - INTERVAL '24 hours';
  IF v_count >= v_limit THEN
    RAISE EXCEPTION 'OFFER GUARD: you have made % offers in the last 24 hours (limit %).', v_count, v_limit;
  END IF;
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- project_offers RLS: the helper by account id (the owner side is unchanged)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS project_offers_submit ON public.project_offers;
CREATE POLICY project_offers_submit ON public.project_offers
    FOR INSERT TO authenticated
    WITH CHECK (submitted_by = (((SELECT current_setting('request.jwt.claims', true)))::json ->> 'sub'));

DROP POLICY IF EXISTS project_offers_read ON public.project_offers;
CREATE POLICY project_offers_read ON public.project_offers
    FOR SELECT TO authenticated
    USING (
      submitted_by = (((SELECT current_setting('request.jwt.claims', true)))::json ->> 'sub')
      OR EXISTS (SELECT 1 FROM public.project_owners o
                  WHERE o.project_id = project_offers.project_id
                    AND o.created_by = (((SELECT current_setting('request.jwt.claims', true)))::json ->> 'email'))
    );

DROP POLICY IF EXISTS project_offers_helper_withdraw ON public.project_offers;
CREATE POLICY project_offers_helper_withdraw ON public.project_offers
    FOR UPDATE TO authenticated
    USING (submitted_by = (((SELECT current_setting('request.jwt.claims', true)))::json ->> 'sub'))
    WITH CHECK (status = 'withdrawn'
                AND submitted_by = (((SELECT current_setting('request.jwt.claims', true)))::json ->> 'sub'));

-- ---------------------------------------------------------------------------
-- Storage: the helper's folder is their account id; files can be removed
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS project_offers_upload_own_folder ON storage.objects;
CREATE POLICY project_offers_upload_own_folder ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
      bucket_id = 'project-offers'
      AND (storage.foldername(name))[2] = (((SELECT current_setting('request.jwt.claims', true)))::json ->> 'sub')
      AND EXISTS (SELECT 1 FROM public.projects p
                   WHERE p.slug = (storage.foldername(name))[1] AND p.status = 'listed')
    );

DROP POLICY IF EXISTS project_offers_read_helper_or_owner ON storage.objects;
CREATE POLICY project_offers_read_helper_or_owner ON storage.objects
    FOR SELECT TO authenticated
    USING (
      bucket_id = 'project-offers'
      AND (
        (storage.foldername(name))[2] = (((SELECT current_setting('request.jwt.claims', true)))::json ->> 'sub')
        OR EXISTS (SELECT 1 FROM public.projects p
                     JOIN public.project_owners o ON o.project_id = p.id
                    WHERE p.slug = (storage.foldername(name))[1]
                      AND o.created_by = (((SELECT current_setting('request.jwt.claims', true)))::json ->> 'email'))
      )
    );

-- the helper removes their own file — unless its offer stands (offered or accepted):
-- a withdrawn or declined offer's, or an upload whose offer row was never written
DROP POLICY IF EXISTS project_offers_helper_remove ON storage.objects;
CREATE POLICY project_offers_helper_remove ON storage.objects
    FOR DELETE TO authenticated
    USING (
      bucket_id = 'project-offers'
      AND (storage.foldername(name))[2] = (((SELECT current_setting('request.jwt.claims', true)))::json ->> 'sub')
      AND NOT EXISTS (SELECT 1 FROM public.project_offers f
                       WHERE f.storage_path = storage.objects.name AND f.status IN ('offered', 'accepted'))
    );

-- the owner removes a declined offer's file in their project
DROP POLICY IF EXISTS project_offers_owner_remove_declined ON storage.objects;
CREATE POLICY project_offers_owner_remove_declined ON storage.objects
    FOR DELETE TO authenticated
    USING (
      bucket_id = 'project-offers'
      AND EXISTS (SELECT 1 FROM public.project_offers f
                    JOIN public.project_owners o ON o.project_id = f.project_id
                   WHERE f.storage_path = storage.objects.name AND f.status = 'declined'
                     AND o.created_by = (((SELECT current_setting('request.jwt.claims', true)))::json ->> 'email'))
    );
