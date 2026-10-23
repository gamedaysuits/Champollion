-- 083_contest_phases_no_late_windows.sql — a phase window is announced ahead,
-- never added after the fact (arena/DATABASE_SCHEMA.md D23, 2026-10-13)
--
-- D23  074's contest_phase_guard() froze a window once it had started, and every
--      window once the contest had entries — but only on UPDATE and DELETE.
--      INSERT was checked for overlap only, so through contest_phases_owner_insert
--      an owner could add a window that starts in the past (re-opening the method
--      door in authorization_request_admission_check), or add a missing phase
--      after entries existed. The table's own comment: "a deadline that can be
--      moved after the fact is not a deadline".
--
-- Founder ruling (2026-10-13): refuse both. A new window must start in the
-- future, and a contest with entries takes no new window. An organizer who
-- needs more time opens a new contest round.
--
-- Every other rule of 074's guard is kept verbatim. Applied to prod 2026-10-18
-- (founder go-ahead, after check_083.sh passed again). Re-runnable.

CREATE OR REPLACE FUNCTION public.contest_phase_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_has_entries boolean;
  v_overlap     text;
  v_contest     text := CASE WHEN TG_OP = 'INSERT' THEN NEW.contest_id ELSE OLD.contest_id END;
BEGIN
  -- UPDATE / DELETE: a window that has started, or any window of a contest
  -- that already has entries, is frozen.
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    IF OLD.starts_at <= now() THEN
      RAISE EXCEPTION
        'PHASE GUARD: phase ''%'' of contest % started at % — a window that has opened is never edited or deleted (participants planned against it).',
        OLD.name, OLD.contest_id, OLD.starts_at;
    END IF;
  END IF;

  -- INSERT: a window is announced ahead — never one that has already started
  -- (it would re-open the method door after the fact) (083, D23)
  IF TG_OP = 'INSERT' AND NEW.starts_at <= now() THEN
    RAISE EXCEPTION
      'PHASE GUARD: phase ''%'' of contest % would start at %, which is not in the future — a window is announced before it opens, never added after the fact. Choose a start time ahead of now.',
      NEW.name, NEW.contest_id, NEW.starts_at;
  END IF;

  -- every write: a contest with entries keeps its windows as they were (on
  -- INSERT too since 083, D23 — no phase is added once methods are in)
  SELECT EXISTS (SELECT 1 FROM public.contest_submissions cs WHERE cs.contest_id = v_contest)
         OR EXISTS (SELECT 1 FROM public.authorization_requests ar
                    WHERE ar.sealed_set_id = ANY (public.contest_sealed_set_ids(v_contest)))
    INTO v_has_entries;
  IF v_has_entries THEN
    RAISE EXCEPTION
      'PHASE GUARD: contest % already has entries — its phase windows are frozen, and no new one is added (deadlines cannot move once methods have been proposed). An organizer who needs more time opens a new contest round.',
      v_contest;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  -- INSERT / UPDATE: windows within one contest never overlap.
  SELECT p.name INTO v_overlap
  FROM public.contest_phases p
  WHERE p.contest_id = NEW.contest_id
    AND p.id IS DISTINCT FROM NEW.id
    AND tstzrange(p.starts_at, p.ends_at, '[)')
        && tstzrange(NEW.starts_at, NEW.ends_at, '[)')
  LIMIT 1;

  IF v_overlap IS NOT NULL THEN
    RAISE EXCEPTION
      'PHASE GUARD: phase ''%'' (% → %) of contest % overlaps phase ''%'' — contest phases are consecutive, never simultaneous.',
      NEW.name, NEW.starts_at, NEW.ends_at, NEW.contest_id, v_overlap;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.created_at := now();
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.contest_phase_guard() IS
    'Phase-window discipline beneath every client and key: windows never overlap within a contest; a started window, and every window of a contest that already has entries, can be neither edited nor deleted; a new window must start in the future and is refused once the contest has entries (083, D23); created_at is server-stamped. Un-bypassable (service_role does not bypass triggers). Migrations 074, 083.';

COMMENT ON TABLE public.contest_phases IS
    'The phase windows of a sovereign contest (practice | evaluation | post-evaluation) and their per-phase caps. Windows never overlap within a contest; a window is announced before it opens (a new one must start in the future); a window that has started can no longer be edited or deleted, and no window is added, edited or deleted once the contest has entries — a deadline that can be moved after the fact is not a deadline. Enforced at the method door by authorization_request_admission_check (045/074). Migrations 074, 083.';
