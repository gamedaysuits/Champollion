-- 081_projects_hardening.sql — Join a project: three holes in 079, found writing
-- the schema up (arena/DATABASE_SCHEMA.md, defect ledger, 2026-10-13)
--
-- D19  A sign-in with no email claim (an anonymous or phone sign-in) registered a
--      project with NO owner row, outside the 24-hour limit (079's admission check
--      skipped both when the email was missing). A project is now registered from
--      an account with an email — its owner is recorded by it. The curator (the
--      service role, or the database owner) is not bound.
-- D20  An owner could rewrite the curator's review_note and listed_at through
--      their own update. Those two are now the curator's alone. (Sending an
--      unchanged project back to review stays allowed: it is the owner's one way
--      to take a listed project off the list short of closing it.)
-- D21  An owner could read every file in their project's folder — one nobody
--      offered, or a withdrawn offer's. Now only a file whose offer stands
--      (offered or accepted), or one they declined and may remove (080). And the
--      bucket had no size limit — 079's
--      50 MiB cap held only for the size a client DECLARES on the offer row; the
--      bucket itself now refuses a larger file.
--
-- Builds on 080 (the helper's folder is their account id). Drafted 2026-10-13;
-- applied to prod 2026-10-18 (founder go-ahead, after check_081.sh passed again). Re-runnable.

-- ---------------------------------------------------------------------------
-- D19: registered from an account with an email
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.project_admission_check()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_limit CONSTANT int := 5;
  v_email text := current_setting('request.jwt.claims', true)::json->>'email';
  v_count int;
BEGIN
  IF NEW.status IS DISTINCT FROM 'pending_review' THEN
    RAISE EXCEPTION
      'PROJECT GUARD: a project is born pending_review (got %) — it is listed only after review.', NEW.status;
  END IF;
  IF NEW.listed_at IS NOT NULL OR NEW.review_note IS NOT NULL THEN
    RAISE EXCEPTION 'PROJECT GUARD: listed_at and review_note are the curator''s, never set at registration.';
  END IF;
  IF v_email IS NULL OR length(trim(v_email)) = 0 THEN
    -- the curator registers without one; everyone else is the project's owner, by it
    IF current_user NOT IN ('service_role', 'postgres', 'supabase_admin') THEN
      RAISE EXCEPTION
        'PROJECT GUARD: a project is registered from an account with an email — its owner is recorded by it, and this sign-in has none.';
    END IF;
    RETURN NEW;
  END IF;
  SELECT COUNT(*) INTO v_count FROM public.project_owners o
   WHERE o.created_by = v_email AND o.created_at > NOW() - INTERVAL '24 hours';
  IF v_count >= v_limit THEN
    RAISE EXCEPTION
      'PROJECT GUARD: % has registered % projects in the last 24 hours (limit %) — try again tomorrow.',
      v_email, v_count, v_limit;
  END IF;
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- D20: review_note and listed_at are the curator's (079's guard, plus that)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reject_illegal_project_transition()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.slug IS DISTINCT FROM OLD.slug
     OR NEW.source_code IS DISTINCT FROM OLD.source_code
     OR NEW.target_code IS DISTINCT FROM OLD.target_code
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION
      'PROJECT GUARD: project % identity is immutable (slug and pair are fixed at registration — register a new project for another pair).',
      OLD.slug;
  END IF;

  IF OLD.status = 'closed' THEN
    RAISE EXCEPTION 'PROJECT GUARD: project % is closed — closing is final.', OLD.slug;
  END IF;

  -- the curator's record of a review is the curator's (081, D20)
  IF current_user NOT IN ('service_role', 'postgres', 'supabase_admin')
     AND (NEW.review_note IS DISTINCT FROM OLD.review_note OR NEW.listed_at IS DISTINCT FROM OLD.listed_at) THEN
    RAISE EXCEPTION 'PROJECT GUARD: review_note and listed_at of project % are the curator''s.', OLD.slug;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'closed' THEN NULL;
    ELSIF NEW.status = 'pending_review' AND OLD.status IN ('listed', 'paused', 'declined') THEN NULL;
    ELSIF NEW.status = 'listed' AND OLD.status IN ('pending_review', 'paused') THEN
      NEW.listed_at := coalesce(OLD.listed_at, NOW());
    ELSIF NEW.status = 'declined' AND OLD.status = 'pending_review' THEN
      IF NEW.review_note IS NULL OR length(trim(NEW.review_note)) = 0 THEN
        RAISE EXCEPTION 'PROJECT GUARD: declining % needs a review_note that says why — no silent refusals.', OLD.slug;
      END IF;
    ELSIF NEW.status = 'paused' AND OLD.status = 'listed' THEN NULL;
    ELSE
      RAISE EXCEPTION
        'PROJECT GUARD: illegal transition % -> % for project % (pending_review -> listed | declined; listed -> paused; any open -> pending_review; any -> closed).',
        OLD.status, NEW.status, OLD.slug;
    END IF;
  END IF;

  -- an edit of what the public sees goes back through review
  IF (NEW.display_name, NEW.owner_display, NEW.source_name, NEW.target_name,
      NEW.purpose, NEW.domain, NEW.register, NEW.about)
     IS DISTINCT FROM
     (OLD.display_name, OLD.owner_display, OLD.source_name, OLD.target_name,
      OLD.purpose, OLD.domain, OLD.register, OLD.about)
     AND NEW.status IN ('listed', 'paused') THEN
    RAISE EXCEPTION
      'PROJECT GUARD: an edit of project % goes back through review — set status pending_review with the edit.', OLD.slug;
  END IF;

  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.reject_illegal_project_transition() IS
    'Registered projects: frozen slug and pair; legal status moves only; a public-text edit returns the project to pending_review; a decline requires a reason; review_note and listed_at are the curator''s (081); closed is final. Un-bypassable (service_role does not bypass triggers). Migrations 079, 081.';

-- ---------------------------------------------------------------------------
-- D21: the owner reads a file whose offer stands; the bucket refuses > 50 MiB
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS project_offers_read_helper_or_owner ON storage.objects;
CREATE POLICY project_offers_read_helper_or_owner ON storage.objects
    FOR SELECT TO authenticated
    USING (
      bucket_id = 'project-offers'
      AND (
        (storage.foldername(name))[2] = (((SELECT current_setting('request.jwt.claims', true)))::json ->> 'sub')
        -- declined too: the owner removes a declined offer's file (080), and a
        -- row the caller cannot see is a row their DELETE never reaches
        OR EXISTS (SELECT 1 FROM public.project_offers f
                     JOIN public.project_owners o ON o.project_id = f.project_id
                    WHERE f.storage_path = storage.objects.name
                      AND f.status IN ('offered', 'accepted', 'declined')
                      AND o.created_by = (((SELECT current_setting('request.jwt.claims', true)))::json ->> 'email'))
      )
    );

-- the same 50 MiB the offer row declares (project_offers.bytes), held by the bucket
UPDATE storage.buckets SET file_size_limit = 52428800 WHERE id = 'project-offers';
