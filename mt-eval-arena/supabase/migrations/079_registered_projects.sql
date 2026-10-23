-- =============================================================================
-- Migration 079: registered projects — "Join a project" (the rails' helper door)
-- =============================================================================
-- A family, school or language office building a translator on the rails can
-- REGISTER its project: a language pair with task parameters, and an owner
-- (founder, 2026-10-12). After a short review a curator LISTS it; helpers
-- browse the list, see what the project asks for, and OFFER files (sentences,
-- a word list, a method). The owner authorizes each offer — an offered file is
-- held by both: submitted by the helper, authorized by the owner. Nothing of the
-- project's own data passes through here: this is its public face and its
-- inbox, never its corpus. Design: docs/JOIN_A_PROJECT_DESIGN_2026-10-12.md.
--
-- WHAT THIS MIGRATION ADDS
--   1. public.projects — the public face: slug, the project's name, the
--      owner's name as shown, the pair (each language as its people name it),
--      the task parameters (purpose, domain, register), a short text. NO email:
--      the owner's identity lives in project_owners, so the listing is a plain
--      public read of listed rows. Born 'pending_review'; only the curator
--      lists (service_role — owners have no UPDATE path to 'listed').
--   2. public.project_owners — project -> owner (JWT email), written by the
--      projects INSERT trigger at birth, readable only by that owner. Every
--      self-registered project is born with exactly one owner, so no one can
--      claim an ownerless row.
--   3. public.project_asks — what a project asks for (sentences, a word list,
--      a method; review and compute are a later phase), owner-written, public
--      while the project is listed.
--   4. public.project_offers — a helper's offer of a file to a listed
--      project: private to the helper and the project's owner. One-way
--      lifecycle offered -> accepted | declined | withdrawn; the helper may only
--      withdraw, the owner may only accept or decline.
--   5. Storage bucket 'project-offers' (private), path
--      <project slug>/<helper email>/<offer id>/<file name>: the helper uploads
--      into their own folder of a LISTED project; the helper and the project's
--      owner may read; no UPDATE or DELETE (an offered file is immutable).
--
-- THE REVIEW, WITHOUT ROLE DETECTION. No trigger here asks who is calling
-- (none in this schema does). The split is the house one: guard triggers bind
-- EVERYONE, service_role included, to the legal transitions; RLS decides who
-- may make which. The owner's UPDATE policy lets a new row carry only status
-- 'pending_review' or 'closed', so an owner can edit (which sends a listed
-- project back to review) or close, never list. The curator lists, declines
-- (a reason is required) and pauses through service_role, which bypasses RLS
-- but not the triggers.
--
-- CONTENT-FREE. No column holds a sentence of anyone's data. The text
-- columns are what an owner writes about their project and what a helper
-- writes about an offer, length-capped; the offered file itself sits in the
-- private bucket, readable by two identities only.
--
-- Idempotent (IF NOT EXISTS / DROP ... IF EXISTS / CREATE OR REPLACE), in the
-- migration-043/046 trigger style. DEV/STAGING BRANCH ONLY — do NOT apply to
-- production without the founder's explicit go-ahead (CLAUDE.md). Validate on
-- the local stack (mt-eval-arena/supabase-local, reset.sh) first.
--
-- ROLLBACK:
--   DROP POLICY IF EXISTS project_offers_upload_own_folder ON storage.objects;
--   DROP POLICY IF EXISTS project_offers_read_helper_or_owner ON storage.objects;
--   DELETE FROM storage.buckets WHERE id = 'project-offers';   -- only if empty
--   DROP TABLE IF EXISTS public.project_offers;
--   DROP TABLE IF EXISTS public.project_asks;
--   DROP TABLE IF EXISTS public.project_owners;
--   DROP TABLE IF EXISTS public.projects;
--   DROP FUNCTION IF EXISTS public.project_admission_check();
--   DROP FUNCTION IF EXISTS public.project_bind_owner();
--   DROP FUNCTION IF EXISTS public.reject_illegal_project_transition();
--   DROP FUNCTION IF EXISTS public.project_offer_admission_check();
--   DROP FUNCTION IF EXISTS public.reject_illegal_offer_transition();
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. projects — the public face
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.projects (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    slug          TEXT NOT NULL UNIQUE
                  CHECK (slug ~ '^[a-z0-9][a-z0-9-]{1,62}$'),
    display_name  TEXT NOT NULL CHECK (length(trim(display_name)) BETWEEN 1 AND 80),
    owner_display TEXT NOT NULL CHECK (length(trim(owner_display)) BETWEEN 1 AND 80),
    -- the pair: codes as the language cards resolve them; a private-use code
    -- (qaa–qtz) carries the name its people give it
    source_code   TEXT NOT NULL CHECK (source_code ~ '^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$'),
    source_name   TEXT CHECK (source_name IS NULL OR length(trim(source_name)) BETWEEN 1 AND 80),
    target_code   TEXT NOT NULL CHECK (target_code ~ '^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$'),
    target_name   TEXT CHECK (target_name IS NULL OR length(trim(target_name)) BETWEEN 1 AND 80),
    -- the task parameters
    purpose       TEXT NOT NULL CHECK (length(trim(purpose)) BETWEEN 1 AND 300),
    domain        TEXT CHECK (domain IS NULL OR length(trim(domain)) BETWEEN 1 AND 80),
    register      TEXT CHECK (register IS NULL OR length(trim(register)) BETWEEN 1 AND 80),
    about         TEXT CHECK (about IS NULL OR length(about) <= 1200),
    status        TEXT NOT NULL DEFAULT 'pending_review'
                  CHECK (status IN ('pending_review', 'listed', 'declined', 'paused', 'closed')),
    review_note   TEXT CHECK (review_note IS NULL OR length(review_note) <= 600),
    listed_at     TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT projects_private_use_named CHECK (
        (source_code !~ '^q[a-t][a-z]$' OR source_name IS NOT NULL)
        AND (target_code !~ '^q[a-t][a-z]$' OR target_name IS NOT NULL)),
    CONSTRAINT projects_pair_distinct CHECK (source_code <> target_code
        OR coalesce(source_name, '') <> coalesce(target_name, ''))
);

COMMENT ON TABLE public.projects IS
    'Registered rails projects — the public face of a project (a language pair with task parameters, and an owner). Born pending_review; listed by the curator after a short review. Holds no email and no data: the owner lives in project_owners. Migration 079.';

CREATE INDEX IF NOT EXISTS idx_projects_status ON public.projects (status, listed_at);

-- ---------------------------------------------------------------------------
-- 2. project_owners — who owns which project (private)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.project_owners (
    project_id  BIGINT PRIMARY KEY REFERENCES public.projects (id) ON DELETE CASCADE,
    created_by  TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.project_owners IS
    'The owner (JWT email) of each registered project, written at the project''s birth by the projects INSERT trigger; readable only by that owner. Migration 079.';

CREATE INDEX IF NOT EXISTS idx_project_owners_creator ON public.project_owners (created_by, created_at);

-- ---------------------------------------------------------------------------
-- Admission (BEFORE INSERT): born pending_review, never pre-listed; a rolling
-- 24h per-creator throttle (the 046 constant shape — a registration has no
-- parent row to carry its limit as data).
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
  IF v_email IS NOT NULL THEN
    SELECT COUNT(*) INTO v_count FROM public.project_owners o
     WHERE o.created_by = v_email AND o.created_at > NOW() - INTERVAL '24 hours';
    IF v_count >= v_limit THEN
      RAISE EXCEPTION
        'PROJECT GUARD: % has registered % projects in the last 24 hours (limit %) — try again tomorrow.',
        v_email, v_count, v_limit;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS projects_admission_guard ON public.projects;
CREATE TRIGGER projects_admission_guard
    BEFORE INSERT ON public.projects
    FOR EACH ROW
    EXECUTE FUNCTION public.project_admission_check();

-- ---------------------------------------------------------------------------
-- Owner binding (AFTER INSERT): the registering identity becomes the owner in
-- the same transaction. A row made by the curator lane (no JWT email) has no
-- owner row until the curator writes one. SECURITY DEFINER so it is the ONLY
-- writer of project_owners besides service_role — no user may insert an
-- ownership row directly (else anyone could claim a curator-made project);
-- trigger-only and un-callable (the 025 run_cards_audit_fn shape).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.project_bind_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text := current_setting('request.jwt.claims', true)::json->>'email';
BEGIN
  IF v_email IS NOT NULL THEN
    INSERT INTO public.project_owners (project_id, created_by) VALUES (NEW.id, v_email);
  END IF;
  RETURN NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.project_bind_owner() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS projects_bind_owner ON public.projects;
CREATE TRIGGER projects_bind_owner
    AFTER INSERT ON public.projects
    FOR EACH ROW
    EXECUTE FUNCTION public.project_bind_owner();

-- ---------------------------------------------------------------------------
-- Transition guard (BEFORE UPDATE): frozen identity; the legal moves; an
-- edit of the public text sends a project back to review; a decline says why.
-- Binds everyone, service_role included.
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
        'PROJECT GUARD: illegal transition % -> % for project % (pending_review -> listed | declined; listed -> paused; any open -> pending_review after an edit; any -> closed).',
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
    'Registered projects: frozen slug and pair; legal status moves only; a public-text edit returns the project to pending_review; a decline requires a reason; closed is final. Un-bypassable (service_role does not bypass triggers). Migration 079.';

DROP TRIGGER IF EXISTS projects_transition_guard ON public.projects;
CREATE TRIGGER projects_transition_guard
    BEFORE UPDATE ON public.projects
    FOR EACH ROW
    EXECUTE FUNCTION public.reject_illegal_project_transition();

-- ---------------------------------------------------------------------------
-- 3. project_asks — what a project asks helpers for
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.project_asks (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    project_id  BIGINT NOT NULL REFERENCES public.projects (id) ON DELETE CASCADE,
    kind        TEXT NOT NULL CHECK (kind IN ('sentences', 'word-list', 'method')),
    what        TEXT NOT NULL CHECK (length(trim(what)) BETWEEN 1 AND 600),
    how_many    INT CHECK (how_many IS NULL OR how_many > 0),
    terms       TEXT CHECK (terms IS NULL OR length(terms) <= 600),
    status      TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.project_asks IS
    'What a registered project asks helpers for (sentences, a word list, a method — review and compute come later), written by its owner; public while the project is listed. Content-free: a description, never data. Migration 079.';

CREATE INDEX IF NOT EXISTS idx_project_asks_project ON public.project_asks (project_id, status);

-- ---------------------------------------------------------------------------
-- 4. project_offers — a helper's offer of a file (private)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.project_offers (
    id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    offer_id       TEXT NOT NULL UNIQUE CHECK (offer_id ~ '^[a-z0-9-]{8,64}$'),
    project_id     BIGINT NOT NULL REFERENCES public.projects (id) ON DELETE CASCADE,
    ask_id         BIGINT REFERENCES public.project_asks (id) ON DELETE SET NULL,
    submitted_by   TEXT NOT NULL,
    helper_display TEXT NOT NULL CHECK (length(trim(helper_display)) BETWEEN 1 AND 80),
    note           TEXT CHECK (note IS NULL OR length(note) <= 1200),
    terms          TEXT NOT NULL CHECK (length(trim(terms)) BETWEEN 1 AND 600),
    file_name      TEXT NOT NULL CHECK (file_name ~ '^[A-Za-z0-9._-]{1,120}$'),
    storage_path   TEXT NOT NULL,
    sha256         TEXT NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
    bytes          BIGINT NOT NULL CHECK (bytes > 0 AND bytes <= 52428800),
    status         TEXT NOT NULL DEFAULT 'offered'
                   CHECK (status IN ('offered', 'accepted', 'declined', 'withdrawn')),
    decline_reason TEXT CHECK (decline_reason IS NULL OR length(decline_reason) <= 600),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.project_offers IS
    'A helper''s offer of a file to a listed project, held by both: submitted by the helper, authorized (accepted) by the project''s owner. Private to those two. The file sits in the private project-offers bucket. Migration 079.';

CREATE INDEX IF NOT EXISTS idx_project_offers_project ON public.project_offers (project_id, status);
CREATE INDEX IF NOT EXISTS idx_project_offers_helper ON public.project_offers (submitted_by, created_at);

-- Admission: born 'offered', to a LISTED project, to one of ITS open asks
-- (when named), into the helper's own folder; a rolling 24h per-helper limit.
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
      'OFFER GUARD: storage_path must be <project slug>/<your email>/<offer id>/<file name> (got %).', NEW.storage_path;
  END IF;
  SELECT COUNT(*) INTO v_count FROM public.project_offers o
   WHERE o.submitted_by = NEW.submitted_by AND o.created_at > NOW() - INTERVAL '24 hours';
  IF v_count >= v_limit THEN
    RAISE EXCEPTION 'OFFER GUARD: % has made % offers in the last 24 hours (limit %).',
      NEW.submitted_by, v_count, v_limit;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS project_offers_admission_guard ON public.project_offers;
CREATE TRIGGER project_offers_admission_guard
    BEFORE INSERT ON public.project_offers
    FOR EACH ROW
    EXECUTE FUNCTION public.project_offer_admission_check();

-- Transition: frozen identity and file; offered -> accepted | declined | withdrawn, once.
CREATE OR REPLACE FUNCTION public.reject_illegal_offer_transition()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.offer_id IS DISTINCT FROM OLD.offer_id
     OR NEW.project_id IS DISTINCT FROM OLD.project_id
     OR NEW.ask_id IS DISTINCT FROM OLD.ask_id
     OR NEW.submitted_by IS DISTINCT FROM OLD.submitted_by
     OR NEW.helper_display IS DISTINCT FROM OLD.helper_display
     OR NEW.note IS DISTINCT FROM OLD.note
     OR NEW.terms IS DISTINCT FROM OLD.terms
     OR NEW.file_name IS DISTINCT FROM OLD.file_name
     OR NEW.storage_path IS DISTINCT FROM OLD.storage_path
     OR NEW.sha256 IS DISTINCT FROM OLD.sha256
     OR NEW.bytes IS DISTINCT FROM OLD.bytes
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'OFFER GUARD: offer % is immutable once made (who, what file, on what terms).', OLD.offer_id;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF OLD.status <> 'offered' OR NEW.status NOT IN ('accepted', 'declined', 'withdrawn') THEN
      RAISE EXCEPTION
        'OFFER GUARD: illegal transition % -> % for offer % (offered -> accepted | declined | withdrawn, once).',
        OLD.status, NEW.status, OLD.offer_id;
    END IF;
  ELSIF NEW.decline_reason IS DISTINCT FROM OLD.decline_reason THEN
    RAISE EXCEPTION 'OFFER GUARD: a decline reason is written with the decline, not after.';
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS project_offers_transition_guard ON public.project_offers;
CREATE TRIGGER project_offers_transition_guard
    BEFORE UPDATE ON public.project_offers
    FOR EACH ROW
    EXECUTE FUNCTION public.reject_illegal_offer_transition();

-- ---------------------------------------------------------------------------
-- Row-Level Security. The JWT email in the 057 wrapped form throughout.
-- ---------------------------------------------------------------------------
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_owners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_asks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_offers ENABLE ROW LEVEL SECURITY;

-- projects: anyone reads listed projects; an owner reads their own in any state.
DROP POLICY IF EXISTS projects_read ON public.projects;
CREATE POLICY projects_read ON public.projects
    FOR SELECT TO anon, authenticated
    USING (
      status = 'listed'
      OR EXISTS (SELECT 1 FROM public.project_owners o
                  WHERE o.project_id = projects.id
                    AND o.created_by = (((SELECT current_setting('request.jwt.claims', true)))::json ->> 'email'))
    );

-- projects: any signed-in identity registers (the admission trigger pins the
-- birth state; the owner trigger binds the owner).
DROP POLICY IF EXISTS projects_register ON public.projects;
CREATE POLICY projects_register ON public.projects
    FOR INSERT TO authenticated
    WITH CHECK (status = 'pending_review');

-- projects: an owner edits (back to review) or closes — never lists.
DROP POLICY IF EXISTS projects_owner_update ON public.projects;
CREATE POLICY projects_owner_update ON public.projects
    FOR UPDATE TO authenticated
    USING (EXISTS (SELECT 1 FROM public.project_owners o
                    WHERE o.project_id = projects.id
                      AND o.created_by = (((SELECT current_setting('request.jwt.claims', true)))::json ->> 'email')))
    WITH CHECK (
      status IN ('pending_review', 'closed')
      AND EXISTS (SELECT 1 FROM public.project_owners o
                   WHERE o.project_id = projects.id
                     AND o.created_by = (((SELECT current_setting('request.jwt.claims', true)))::json ->> 'email'))
    );

-- project_owners: you read your own ownership. No INSERT, UPDATE or DELETE
-- policy: the definer trigger (and the curator) are its only writers.
DROP POLICY IF EXISTS project_owners_read_own ON public.project_owners;
CREATE POLICY project_owners_read_own ON public.project_owners
    FOR SELECT TO authenticated
    USING (created_by = (((SELECT current_setting('request.jwt.claims', true)))::json ->> 'email'));

-- project_asks: public while the project is listed; the owner sees and writes their own.
DROP POLICY IF EXISTS project_asks_read ON public.project_asks;
CREATE POLICY project_asks_read ON public.project_asks
    FOR SELECT TO anon, authenticated
    USING (
      EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_asks.project_id AND p.status = 'listed')
      OR EXISTS (SELECT 1 FROM public.project_owners o
                  WHERE o.project_id = project_asks.project_id
                    AND o.created_by = (((SELECT current_setting('request.jwt.claims', true)))::json ->> 'email'))
    );

DROP POLICY IF EXISTS project_asks_owner_write ON public.project_asks;
CREATE POLICY project_asks_owner_write ON public.project_asks
    FOR INSERT TO authenticated
    WITH CHECK (EXISTS (SELECT 1 FROM public.project_owners o
                         WHERE o.project_id = project_asks.project_id
                           AND o.created_by = (((SELECT current_setting('request.jwt.claims', true)))::json ->> 'email')));

DROP POLICY IF EXISTS project_asks_owner_update ON public.project_asks;
CREATE POLICY project_asks_owner_update ON public.project_asks
    FOR UPDATE TO authenticated
    USING (EXISTS (SELECT 1 FROM public.project_owners o
                    WHERE o.project_id = project_asks.project_id
                      AND o.created_by = (((SELECT current_setting('request.jwt.claims', true)))::json ->> 'email')))
    WITH CHECK (EXISTS (SELECT 1 FROM public.project_owners o
                         WHERE o.project_id = project_asks.project_id
                           AND o.created_by = (((SELECT current_setting('request.jwt.claims', true)))::json ->> 'email')));

-- project_offers: you offer as yourself; the helper and the project's owner read.
DROP POLICY IF EXISTS project_offers_submit ON public.project_offers;
CREATE POLICY project_offers_submit ON public.project_offers
    FOR INSERT TO authenticated
    WITH CHECK (submitted_by = (((SELECT current_setting('request.jwt.claims', true)))::json ->> 'email'));

DROP POLICY IF EXISTS project_offers_read ON public.project_offers;
CREATE POLICY project_offers_read ON public.project_offers
    FOR SELECT TO authenticated
    USING (
      submitted_by = (((SELECT current_setting('request.jwt.claims', true)))::json ->> 'email')
      OR EXISTS (SELECT 1 FROM public.project_owners o
                  WHERE o.project_id = project_offers.project_id
                    AND o.created_by = (((SELECT current_setting('request.jwt.claims', true)))::json ->> 'email'))
    );

-- the helper may only withdraw their own offer …
DROP POLICY IF EXISTS project_offers_helper_withdraw ON public.project_offers;
CREATE POLICY project_offers_helper_withdraw ON public.project_offers
    FOR UPDATE TO authenticated
    USING (submitted_by = (((SELECT current_setting('request.jwt.claims', true)))::json ->> 'email'))
    WITH CHECK (status = 'withdrawn'
                AND submitted_by = (((SELECT current_setting('request.jwt.claims', true)))::json ->> 'email'));

-- … and the owner may only accept or decline an offer to their project.
DROP POLICY IF EXISTS project_offers_owner_decide ON public.project_offers;
CREATE POLICY project_offers_owner_decide ON public.project_offers
    FOR UPDATE TO authenticated
    USING (EXISTS (SELECT 1 FROM public.project_owners o
                    WHERE o.project_id = project_offers.project_id
                      AND o.created_by = (((SELECT current_setting('request.jwt.claims', true)))::json ->> 'email')))
    WITH CHECK (status IN ('accepted', 'declined')
                AND EXISTS (SELECT 1 FROM public.project_owners o
                             WHERE o.project_id = project_offers.project_id
                               AND o.created_by = (((SELECT current_setting('request.jwt.claims', true)))::json ->> 'email')));

-- ---------------------------------------------------------------------------
-- 5. Storage: the private 'project-offers' bucket (the 044 pattern)
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('project-offers', 'project-offers', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- upload: into your own folder (segment 2 = your email) of a LISTED project (segment 1)
DROP POLICY IF EXISTS project_offers_upload_own_folder ON storage.objects;
CREATE POLICY project_offers_upload_own_folder ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
      bucket_id = 'project-offers'
      AND (storage.foldername(name))[2] = (((SELECT current_setting('request.jwt.claims', true)))::json ->> 'email')
      AND EXISTS (SELECT 1 FROM public.projects p
                   WHERE p.slug = (storage.foldername(name))[1] AND p.status = 'listed')
    );

-- read: the helper who offered it, or the project's owner
DROP POLICY IF EXISTS project_offers_read_helper_or_owner ON storage.objects;
CREATE POLICY project_offers_read_helper_or_owner ON storage.objects
    FOR SELECT TO authenticated
    USING (
      bucket_id = 'project-offers'
      AND (
        (storage.foldername(name))[2] = (((SELECT current_setting('request.jwt.claims', true)))::json ->> 'email')
        OR EXISTS (SELECT 1 FROM public.projects p
                     JOIN public.project_owners o ON o.project_id = p.id
                    WHERE p.slug = (storage.foldername(name))[1]
                      AND o.created_by = (((SELECT current_setting('request.jwt.claims', true)))::json ->> 'email'))
      )
    );
-- No UPDATE or DELETE policy on project-offers objects: an offered file is immutable.
