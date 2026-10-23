-- Migration 082 on stand-ins of the three tables it guards (the shapes of 070,
-- 076 + 077, and 038 + 074 + 075). Each check prints PASS or raises.
\set ON_ERROR_STOP on
CREATE OR REPLACE FUNCTION pg_temp.ok(cond boolean, label text) RETURNS text LANGUAGE plpgsql AS $$
BEGIN
  IF cond IS NOT TRUE THEN RAISE EXCEPTION 'FAILED: %', label; END IF;
  RETURN 'PASS ' || label;
END $$;
CREATE OR REPLACE FUNCTION pg_temp.expect_fail(stmt text, want text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE went boolean := false; msg text;
BEGIN
  BEGIN
    EXECUTE stmt;
    went := true;
  EXCEPTION WHEN OTHERS THEN
    msg := SQLERRM;
  END;
  IF went THEN RAISE EXCEPTION 'EXPECTED A REFUSAL (%), the statement went through: %', want, stmt; END IF;
  IF msg NOT ILIKE '%' || want || '%' THEN
    RAISE EXCEPTION 'refused, but not as expected (wanted %): %', want, msg;
  END IF;
  RETURN 'PASS refused: ' || left(msg, 110);
END $$;

-- D18: patterns
INSERT INTO public.quarantined_id_patterns (pattern, reason, recorded_by)
  VALUES ('sample[-_]?62(?![0-9])', 'seed', 'test');
SELECT pg_temp.ok((SELECT count(*) FROM public.quarantined_id_patterns) = 1, 'a pattern with a lookahead is accepted') AS d18a;
SELECT pg_temp.expect_fail($$INSERT INTO public.quarantined_id_patterns (pattern, reason, recorded_by) VALUES ('dev[-_(124', 'x', 't')$$,
  'not a regex Postgres can compile');
SELECT pg_temp.expect_fail($$INSERT INTO public.quarantined_id_patterns (pattern, reason, recorded_by) VALUES ('  ', 'x', 't')$$,
  'non-empty regex');
SELECT pg_temp.expect_fail($$UPDATE public.quarantined_id_patterns SET pattern = '(unclosed' WHERE reason = 'seed'$$,
  'not a regex Postgres can compile');
SELECT pg_temp.ok('eval-sample-62' ~* (SELECT pattern FROM public.quarantined_id_patterns), 'the stored pattern still matches') AS d18b;

-- D24: metrics
INSERT INTO public.rankable_metrics (metric_id, display_name, direction, recorded_by)
  VALUES ('chrf_plus_plus', 'chrF++', 'higher', 'test'), ('composite', 'composite', 'higher', 'test');
SELECT pg_temp.expect_fail($$DELETE FROM public.rankable_metrics WHERE metric_id = 'composite'$$, 'is never deleted');
UPDATE public.rankable_metrics SET retired_at = now(), retired_reason = 'scoring standard/1: use chrf_plus_plus'
 WHERE metric_id = 'composite';
SELECT pg_temp.ok((SELECT count(*) FROM public.rankable_metrics WHERE retired_at IS NOT NULL) = 1,
  'a metric is retired, and stays') AS d24;

-- D17: the decision record
INSERT INTO public.authorization_requests (request_id, sealed_set_id, fingerprint, method_sha, corpus_id,
                                           corpus_version, node_measurement)
  VALUES ('authreq-1', 'set-1', 'f', 'm', 'c', 'v1', 'n'), ('authreq-2', 'set-1', 'f2', 'm', 'c', 'v1', 'n');
UPDATE public.authorization_requests SET state = 'authorized' WHERE request_id = 'authreq-1';
SELECT pg_temp.ok((SELECT decided_at FROM public.authorization_requests WHERE request_id = 'authreq-1') IS NOT NULL,
  'a decision without a date is dated') AS d17a;
UPDATE public.authorization_requests SET state = 'denied', decided_at = '2026-10-13T08:00:00Z' WHERE request_id = 'authreq-2';
SELECT pg_temp.ok((SELECT decided_at FROM public.authorization_requests WHERE request_id = 'authreq-2') = '2026-10-13T08:00:00Z',
  'the caller''s date is kept (the node writes it with the state)') AS d17b;
SELECT pg_temp.expect_fail($$UPDATE public.authorization_requests SET decided_at = now() + interval '1 day' WHERE request_id = 'authreq-1'$$,
  'the decision record is closed');
SELECT pg_temp.expect_fail($$UPDATE public.authorization_requests SET decided_at = NULL WHERE request_id = 'authreq-1'$$,
  'the decision record is closed');
UPDATE public.authorization_requests SET execution_diagnostics = '{"rows": 50}' WHERE request_id = 'authreq-1';
UPDATE public.authorization_requests SET state = 'completed' WHERE request_id = 'authreq-1';
SELECT pg_temp.ok((SELECT state FROM public.authorization_requests WHERE request_id = 'authreq-1') = 'completed'
  AND (SELECT execution_diagnostics->>'rows' FROM public.authorization_requests WHERE request_id = 'authreq-1') = '50',
  'diagnostics and the state''s own moves still go through') AS d17c;
SELECT 'ALL CHECKS PASSED' AS done;
