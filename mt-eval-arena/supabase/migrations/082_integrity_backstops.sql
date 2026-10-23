-- 082_integrity_backstops.sql — three live defects the schema write-up found
-- (arena/DATABASE_SCHEMA.md, defect ledger, 2026-10-13)
--
-- D18  quarantined_id_patterns rows are regexes run inside the run_cards publish
--      guard and the contest corpus guard (070). Nothing checked them on the way
--      in: one row Postgres cannot compile makes EVERY publish fail. A row is now
--      tried once when it is written, and refused if it does not compile.
-- D24  rankable_metrics rows must never be deleted — 076's contest guard reads
--      every contest's primary_metric against the table on every UPDATE, so a
--      deleted row makes every later update of a contest that recorded it (its
--      close included) fail. Nothing stopped a DELETE; now one is refused, with
--      what to do instead (retire it: 077's retired_at + retired_reason).
-- D17  Once a request is decided, 074/075 close its record — but decided_at
--      itself stayed writable: rewriting it, or setting it NULL, reopened the
--      record. And a decision that arrived without decided_at never got the
--      protection. Now decided_at and id are frozen once set, and the first move
--      out of 'pending' stamps decided_at when the caller did not (the node's
--      authorize/deny write it with the state; an expiry may not).
--
-- Not here: D23 (phase windows added after the fact) — whether a later phase may
-- be added on purpose is the founder's call; and 076's refusal text listing a
-- retired metric as allowed (cosmetic; 077's guard refuses it for a new contest).
--
-- Drafted 2026-10-13; applied to prod 2026-10-18 (founder go-ahead, after
-- check_082.sh passed again). Re-runnable.

-- ---------------------------------------------------------------------------
-- D18: a pattern is a regex Postgres compiles, or it is refused
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.quarantined_id_pattern_check()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.pattern IS NULL OR length(trim(NEW.pattern)) = 0 THEN
    RAISE EXCEPTION 'QUARANTINE PATTERN GUARD: a pattern is a non-empty regex (it would match every id).';
  END IF;
  BEGIN
    PERFORM 'quarantine-pattern-probe' ~* NEW.pattern;
  EXCEPTION WHEN invalid_regular_expression THEN
    RAISE EXCEPTION
      'QUARANTINE PATTERN GUARD: % is not a regex Postgres can compile (%) — every publish runs these patterns, so it is refused.',
      NEW.pattern, SQLERRM;
  END;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.quarantined_id_pattern_check() IS
  'Refuses a quarantined_id_patterns row whose pattern is empty or does not compile: the run_cards publish guard and the contest corpus guard run every pattern, so one bad row would refuse every publish. Migration 082 (D18).';

DROP TRIGGER IF EXISTS quarantined_id_patterns_check ON public.quarantined_id_patterns;
CREATE TRIGGER quarantined_id_patterns_check
    BEFORE INSERT OR UPDATE ON public.quarantined_id_patterns
    FOR EACH ROW
    EXECUTE FUNCTION public.quarantined_id_pattern_check();

-- ---------------------------------------------------------------------------
-- D24: a rankable metric is retired, never deleted
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rankable_metric_never_deleted()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION
    'RANKABLE METRIC GUARD: % is never deleted — contests that recorded it are checked against this table on every update. Retire it instead: UPDATE public.rankable_metrics SET retired_at = now(), retired_reason = ''<why, and what to use>'' WHERE metric_id = ''%''.',
    OLD.metric_id, OLD.metric_id;
END;
$$;

COMMENT ON FUNCTION public.rankable_metric_never_deleted() IS
  'Refuses every DELETE on rankable_metrics: 076''s contest guard reads a contest''s recorded primary_metric against the table on every UPDATE, so a deleted row would block every later update of those contests. Retire with 077''s retired_at + retired_reason. Migration 082 (D24).';

DROP TRIGGER IF EXISTS rankable_metrics_never_deleted ON public.rankable_metrics;
CREATE TRIGGER rankable_metrics_never_deleted
    BEFORE DELETE ON public.rankable_metrics
    FOR EACH ROW
    EXECUTE FUNCTION public.rankable_metric_never_deleted();

-- ---------------------------------------------------------------------------
-- D17: 075's guard, with decided_at and id frozen once set, and decided_at
-- stamped on the first move out of 'pending' (every other rule verbatim)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reject_illegal_request_transition()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Request terms are frozen at creation — the fingerprint and every input
  -- that produced it is immutable, so a grant can never be re-bound by editing
  -- the request out from under it.
  IF NEW.fingerprint     IS DISTINCT FROM OLD.fingerprint
     OR NEW.method_sha       IS DISTINCT FROM OLD.method_sha
     OR NEW.corpus_id        IS DISTINCT FROM OLD.corpus_id
     OR NEW.corpus_version   IS DISTINCT FROM OLD.corpus_version
     OR NEW.node_measurement IS DISTINCT FROM OLD.node_measurement
     OR NEW.sealed_set_id    IS DISTINCT FROM OLD.sealed_set_id
     OR NEW.emit             IS DISTINCT FROM OLD.emit THEN
    RAISE EXCEPTION
      'AUTH REQUEST GUARD: request % terms are immutable (fingerprint/method/corpus/version/node/sealed_set/emit cannot change after creation).',
      OLD.request_id;
  END IF;

  -- One-way state machine.
  IF NEW.state IS DISTINCT FROM OLD.state THEN
    IF OLD.state = 'pending' AND NEW.state IN ('authorized', 'denied', 'expired') THEN
      -- the decision is dated: by the caller (the node writes it with the
      -- state), else now (082, D17)
      NEW.decided_at := coalesce(NEW.decided_at, now());
    ELSIF OLD.state = 'authorized' AND NEW.state IN ('expired', 'completed') THEN
      NULL;  -- an authorized request may lapse, or have its result recorded (075)
    ELSE
      RAISE EXCEPTION
        'AUTH REQUEST GUARD: illegal state transition % -> % for request % (allowed: pending->authorized/denied/expired, authorized->expired/completed).',
        OLD.state, NEW.state, OLD.request_id;
    END IF;
  END IF;

  -- 074: once the custodians have DECIDED, the record of the decision is
  -- closed — its date and row id included (082, D17). execution_diagnostics is
  -- the single field still written — the node reports counts-only diagnostics
  -- back against an already-decided request — and the state may still move
  -- under the machine above (authorized -> expired, or -> completed once the
  -- result is recorded, 075).
  IF OLD.decided_at IS NOT NULL THEN
    IF NEW.request_id   IS DISTINCT FROM OLD.request_id
       OR NEW.id           IS DISTINCT FROM OLD.id
       OR NEW.decided_at   IS DISTINCT FROM OLD.decided_at
       OR NEW.threshold    IS DISTINCT FROM OLD.threshold
       OR NEW.requested_by IS DISTINCT FROM OLD.requested_by
       OR NEW.created_at   IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION
        'AUTH REQUEST GUARD: request % is decided (%) — the decision record is closed: only execution_diagnostics, and the state''s own moves, may still be written.',
        OLD.request_id, OLD.decided_at;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.reject_illegal_request_transition() IS
    'Enforces the one-way authorization_requests state machine (075: authorized->completed, terminal), freezes the fingerprint/method/corpus/version/node/sealed_set/emit terms after creation, dates the first move out of pending, and closes the decision record once decided — decided_at and id included (074, 082; execution_diagnostics excepted). Un-bypassable (service_role does not bypass triggers). the sovereign multisig plan M2/M4.';
