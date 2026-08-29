-- =============================================================================
-- Migration 046: the organizer self-serve registration door — identity-bound
--                sealed_sets + qualifiers INSERT (gap G3, shared-task onboarding)
-- =============================================================================
-- Closes gap G3 of docs/SHARED_TASK_HOSTING_MODES.md: sealed-set/qualifier
-- registration was curator-mediated ("open an issue" —
-- run-a-sovereign-contest Step 4; service_role only, migrations 037/042). A
-- shared-task organizer (the AmericasNLP onboarding path) can now register
-- their OWN sealed set(s) and qualifier with their OWN sign-in
-- (`mt-eval contest register`, arena/mt_eval_harness/contest_prep.py
-- register_prepared_self_serve) — no Champollion service key, no issue queue.
--
-- WHAT THIS MIGRATION ADDS (all on existing tables — no new table):
--   1. A `created_by` creator column on sealed_sets and qualifiers (JWT email
--      for self-serve rows; NULL = the pre-046 curator/service lane, which is
--      unchanged). Attribution is frozen at birth for qualifiers (the 042
--      terms guard is extended below); sealed_sets stays UPDATE-closed to
--      non-service roles, so its attribution has no mutation door at all.
--   2. Authenticated INSERT policies, bound the 043/045 way:
--      * sealed_sets_register_own — created_by = the JWT email; born
--        quarantined (the 022/037 leaderboard floor is pinned at the door);
--        born 'planned' or 'active', never 'retired'.
--      * qualifiers_register_own — created_by = the JWT email; born 'active'
--        (a 'frozen' row is immutable HISTORY — history cannot be inserted);
--        and the qualifier may only gate a sealed set the SAME identity
--        registered (ownership EXISTS check) — otherwise any signed-in user
--        could attach the gate to someone else's set (the node resolves the
--        active qualifier per set, so the gate is security-load-bearing).
--   3. Admission triggers (043/045 admission-check style), enforced beneath
--      every client (service_role bypasses RLS but NOT these):
--      * sealed sets: born quarantined, born planned/active, rolling 24h
--        per-creator registration throttle;
--      * qualifiers: born active, target sealed set (when named) must exist
--        and not be retired, same rolling 24h per-creator throttle.
--   4. The 042 terms guard reject_illegal_qualifier_mutation() is REPLACED
--      verbatim-plus-one-line: created_by joins the frozen-at-creation terms
--      (no reattribution, not even by service_role — the 043 frozen
--      submitted_by precedent).
--
-- RATE LIMIT AS A CONSTANT, STATED HONESTLY. 043/045 carry their throttles as
-- DATA on a parent row (contests.intake_daily_limit,
-- sealed_sets.request_daily_limit). A REGISTRATION has no parent row — the
-- rows being born here are the roots of the object graph — so the limit lives
-- as a named constant in the two guard functions (24 registrations / creator
-- / rolling 24h / table: sized to one AmericasNLP-scale multi-pair edition —
-- ~11 pairs x 2 sealed sets + 11 qualifiers — in a single sitting, while
-- still bounding registry spam). The curator lane (created_by NULL, exactly
-- the 045 requested_by-NULL exemption shape) is not throttled.
--
-- ONE-WAY LIFECYCLE PRESERVED. This door is INSERT-only: no UPDATE or DELETE
-- policy is added on either table. Qualifier rotation (active -> frozen,
-- 042), sealed-set retirement, and any un-quarantining remain
-- curator/service-lane acts governed by the existing un-bypassable triggers.
-- A self-serve organizer who needs a rotation still goes through the curator
-- today — honest limit, follow-up shape in SHARED_TASK_HOSTING_MODES G3.
--
-- CONTENT-FREE. created_by is an email (the 043 submitted_by precedent),
-- never corpus text; no source/reference/plaintext column is added. The
-- content-free invariant of 037/042 is untouched and still test-asserted
-- (arena/tests/test_sovereign_authorization_migrations.py).
--
-- Mirrors the migration-038/043/045 idempotent + trigger style. DEV/STAGING
-- BRANCH ONLY — do NOT apply to production without the founder's explicit
-- go-ahead (CLAUDE.md).
--
-- ROLLBACK:
--   DROP POLICY IF EXISTS sealed_sets_register_own ON public.sealed_sets;
--   DROP POLICY IF EXISTS qualifiers_register_own ON public.qualifiers;
--   DROP TRIGGER IF EXISTS sealed_sets_admission_guard ON public.sealed_sets;
--   DROP FUNCTION IF EXISTS public.sealed_set_admission_check();
--   DROP TRIGGER IF EXISTS qualifiers_admission_guard ON public.qualifiers;
--   DROP FUNCTION IF EXISTS public.qualifier_admission_check();
--   DROP INDEX IF EXISTS idx_sealed_sets_creator;
--   DROP INDEX IF EXISTS idx_qualifiers_creator;
--   ALTER TABLE public.sealed_sets DROP COLUMN IF EXISTS created_by;
--   ALTER TABLE public.qualifiers DROP COLUMN IF EXISTS created_by;
--   -- (then re-apply 042 to restore the original terms-guard function body)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Creator columns — the identity the door binds. NULL = curator/service lane
-- (pre-046 rows and contest_prep.register_prepared, both unchanged).
-- ---------------------------------------------------------------------------
ALTER TABLE public.sealed_sets
  ADD COLUMN IF NOT EXISTS created_by TEXT;

ALTER TABLE public.qualifiers
  ADD COLUMN IF NOT EXISTS created_by TEXT;

COMMENT ON COLUMN public.sealed_sets.created_by IS
  'Registering identity (JWT email) for self-serve rows — the identity the qualifiers_register_own ownership check binds to. NULL = curator/service-lane registration (pre-046 behavior, unchanged). Migration 046.';

COMMENT ON COLUMN public.qualifiers.created_by IS
  'Registering identity (JWT email) for self-serve rows; NULL = curator/service lane. Frozen at creation by the extended 042 terms guard. Migration 046.';

-- ---------------------------------------------------------------------------
-- Indexes — the rolling 24h per-creator throttle lookups.
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_sealed_sets_creator
    ON public.sealed_sets (created_by, created_at);

CREATE INDEX IF NOT EXISTS idx_qualifiers_creator
    ON public.qualifiers (created_by, created_at);

-- ---------------------------------------------------------------------------
-- Admission guard: sealed_sets (BEFORE INSERT) — the door checks, beneath
-- every client (service_role bypasses RLS but NOT this trigger).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sealed_set_admission_check()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  -- Registrations per creator per rolling 24h. A named constant, not a
  -- column: a registration has no parent row to carry policy DATA (contrast
  -- 043/045 where the throttle rides the contest / sealed set). Sized to one
  -- AmericasNLP-scale multi-pair edition (~11 pairs x 2 sealed sets) in a
  -- single sitting.
  v_limit CONSTANT int := 24;
  v_count int;
BEGIN
  -- Born in the safe state: quarantined (the 022/037 leaderboard floor — a
  -- sealed set never ranks AS A DATASET) and never born retired.
  IF NOT NEW.quarantined THEN
    RAISE EXCEPTION
      'REGISTRATION GUARD: a sealed set must be born quarantined (the migration-022 floor: it never ranks as a dataset; its scores publish through the sovereign gates). Un-quarantining is a curator decision, never a registration option.';
  END IF;
  IF NEW.status NOT IN ('planned', 'active') THEN
    RAISE EXCEPTION
      'REGISTRATION GUARD: a sealed set must be born ''planned'' or ''active'' (got ''%'') — ''retired'' is a lifecycle end-state, not a birth state.',
      NEW.status;
  END IF;

  -- Rolling 24h per-creator registration throttle (anti registry-spam).
  -- created_by NULL = the curator/service lane, exempt (the 045
  -- requested_by-NULL shape).
  IF NEW.created_by IS NOT NULL THEN
    SELECT COUNT(*) INTO v_count
    FROM public.sealed_sets s
    WHERE s.created_by = NEW.created_by
      AND s.created_at > NOW() - INTERVAL '24 hours';

    IF v_count >= v_limit THEN
      RAISE EXCEPTION
        'REGISTRATION GUARD: % has reached the % sealed-set registrations / 24h limit — the registry is public; registration is throttled against spam.',
        NEW.created_by, v_limit;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.sealed_set_admission_check() IS
    'Registration door checks beneath every client: born quarantined (022 floor), born planned/active, rolling 24h per-creator throttle (curator lane created_by NULL exempt). Un-bypassable (service_role does not bypass triggers). Migration 046.';

DROP TRIGGER IF EXISTS sealed_sets_admission_guard ON public.sealed_sets;
CREATE TRIGGER sealed_sets_admission_guard
    BEFORE INSERT ON public.sealed_sets
    FOR EACH ROW
    EXECUTE FUNCTION public.sealed_set_admission_check();

-- ---------------------------------------------------------------------------
-- Admission guard: qualifiers (BEFORE INSERT).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.qualifier_admission_check()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_limit CONSTANT int := 24;  -- same rationale as sealed_set_admission_check
  v_set_status text;
  v_count int;
BEGIN
  -- Born active: 'frozen' is immutable history (042) — history cannot be
  -- inserted, only reached by the one-way active -> frozen rotation.
  IF NEW.status <> 'active' THEN
    RAISE EXCEPTION
      'REGISTRATION GUARD: a qualifier must be born ''active'' (got ''%'') — frozen rows are rotation history, reachable only via the one-way 042 lifecycle.',
      NEW.status;
  END IF;

  -- The gated sealed set (when named) must exist and not be retired. The FK
  -- would also refuse an unknown set, but after this trigger and with a
  -- worse message; 'planned' is admitted (registered ahead, the 042 shape).
  IF NEW.sealed_set_id IS NOT NULL THEN
    SELECT s.status INTO v_set_status
    FROM public.sealed_sets s
    WHERE s.sealed_set_id = NEW.sealed_set_id;

    IF v_set_status IS NULL THEN
      RAISE EXCEPTION
        'REGISTRATION GUARD: sealed set % is not registered — register the sealed set before its qualifier.',
        NEW.sealed_set_id;
    END IF;
    IF v_set_status = 'retired' THEN
      RAISE EXCEPTION
        'REGISTRATION GUARD: sealed set % is retired — a retired set cannot take a new qualifier.',
        NEW.sealed_set_id;
    END IF;
  END IF;

  -- Rolling 24h per-creator registration throttle (curator lane exempt).
  IF NEW.created_by IS NOT NULL THEN
    SELECT COUNT(*) INTO v_count
    FROM public.qualifiers q
    WHERE q.created_by = NEW.created_by
      AND q.created_at > NOW() - INTERVAL '24 hours';

    IF v_count >= v_limit THEN
      RAISE EXCEPTION
        'REGISTRATION GUARD: % has reached the % qualifier registrations / 24h limit — the registry is public; registration is throttled against spam.',
        NEW.created_by, v_limit;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.qualifier_admission_check() IS
    'Registration door checks beneath every client: born active (frozen = history, never a birth state), gated sealed set exists and is not retired, rolling 24h per-creator throttle (curator lane created_by NULL exempt). Un-bypassable. Migration 046.';

DROP TRIGGER IF EXISTS qualifiers_admission_guard ON public.qualifiers;
CREATE TRIGGER qualifiers_admission_guard
    BEFORE INSERT ON public.qualifiers
    FOR EACH ROW
    EXECUTE FUNCTION public.qualifier_admission_check();

-- ---------------------------------------------------------------------------
-- The 042 terms guard, extended: created_by joins the frozen-at-creation
-- terms. Body otherwise verbatim from 042 (rotation stays active -> frozen).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reject_illegal_qualifier_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.qualifier_id     IS DISTINCT FROM OLD.qualifier_id
     OR NEW.corpus_card_id IS DISTINCT FROM OLD.corpus_card_id
     OR NEW.sealed_set_id  IS DISTINCT FROM OLD.sealed_set_id
     OR NEW.threshold      IS DISTINCT FROM OLD.threshold
     OR NEW.metric         IS DISTINCT FROM OLD.metric
     OR NEW.year           IS DISTINCT FROM OLD.year
     OR NEW.created_by     IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION
      'QUALIFIER GUARD: qualifier % terms are immutable (id/corpus/sealed_set/threshold/metric/year/created_by cannot change after creation — rotate to a new vYYYY row instead).',
      OLD.qualifier_id;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF OLD.status = 'active' AND NEW.status = 'frozen' THEN
      NULL;  -- rotation freezes the old round
    ELSE
      RAISE EXCEPTION
        'QUALIFIER GUARD: illegal status transition % -> % for qualifier % (allowed: active->frozen only; a frozen qualifier is immutable history).',
        OLD.status, NEW.status, OLD.qualifier_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.reject_illegal_qualifier_mutation() IS
    'Freezes a qualifier''s terms after creation (no mid-contest threshold edits; rotate instead), including created_by attribution (046), and enforces one-way active->frozen. Un-bypassable (service_role does not bypass triggers). Migrations 042 + 046.';

-- ---------------------------------------------------------------------------
-- Row-Level Security: the self-serve registration door.
-- 037/042 grant anon SELECT (content-free registries are public evidence) and
-- reserve every UPDATE/DELETE to service_role — both unchanged. These
-- policies open INSERT to authenticated organizers, identity-bound the
-- 043/045 way; the triggers above pin the birth states beneath every client.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS sealed_sets_register_own ON public.sealed_sets;
CREATE POLICY sealed_sets_register_own
    ON public.sealed_sets
    FOR INSERT
    TO authenticated
    WITH CHECK (
      created_by = current_setting('request.jwt.claims', true)::json->>'email'
      AND quarantined = true
      AND status IN ('planned', 'active')
    );

DROP POLICY IF EXISTS qualifiers_register_own ON public.qualifiers;
CREATE POLICY qualifiers_register_own
    ON public.qualifiers
    FOR INSERT
    TO authenticated
    WITH CHECK (
      created_by = current_setting('request.jwt.claims', true)::json->>'email'
      AND status = 'active'
      -- You may only gate a sealed set YOU registered: the node resolves the
      -- active qualifier per set, so the gate is security-load-bearing.
      -- Curator-registered sets (created_by NULL) stay curator-gated.
      AND (
        sealed_set_id IS NULL
        OR EXISTS (
          SELECT 1 FROM public.sealed_sets s
          WHERE s.sealed_set_id = qualifiers.sealed_set_id
            AND s.created_by = current_setting('request.jwt.claims', true)::json->>'email'
        )
      )
    );
