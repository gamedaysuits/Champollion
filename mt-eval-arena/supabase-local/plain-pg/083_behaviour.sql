-- Migration 083 on stand-ins of the tables its guard reads (the shapes of 008,
-- 074 and 038). Each check prints PASS or raises.
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

INSERT INTO public.contests (id, corpus_id, metadata) VALUES
  ('c-open', 'sealed-a', '{}'), ('c-entered', 'sealed-b', '{}'), ('c-requested', 'sealed-c', '{}');

-- a window announced ahead: accepted, created_at stamped by the server
INSERT INTO public.contest_phases (contest_id, name, starts_at, ends_at, created_at)
  VALUES ('c-open', 'practice', now() + interval '1 day', now() + interval '10 days', '2000-01-01');
SELECT pg_temp.ok((SELECT created_at > '2001-01-01' FROM public.contest_phases WHERE contest_id = 'c-open'),
  'a window that starts in the future is added, its created_at the server''s') AS d23a;

-- D23: a window that starts in the past, or now, is refused
SELECT pg_temp.expect_fail($$INSERT INTO public.contest_phases (contest_id, name, starts_at, ends_at)
  VALUES ('c-open', 'evaluation', now() - interval '1 hour', now() + interval '20 days')$$, 'not in the future');
SELECT pg_temp.expect_fail($$INSERT INTO public.contest_phases (contest_id, name, starts_at, ends_at)
  VALUES ('c-open', 'evaluation', now(), now() + interval '20 days')$$, 'not in the future');

-- D23: a contest with entries takes no new window, even one in the future
INSERT INTO public.contest_submissions (contest_id) VALUES ('c-entered');
SELECT pg_temp.expect_fail($$INSERT INTO public.contest_phases (contest_id, name, starts_at, ends_at)
  VALUES ('c-entered', 'post-evaluation', now() + interval '30 days', now() + interval '40 days')$$, 'already has entries');
-- … nor one whose sealed set already has a method proposed (an authorization request)
INSERT INTO public.authorization_requests (sealed_set_id) VALUES ('sealed-c');
SELECT pg_temp.expect_fail($$INSERT INTO public.contest_phases (contest_id, name, starts_at, ends_at)
  VALUES ('c-requested', 'evaluation', now() + interval '30 days', now() + interval '40 days')$$, 'already has entries');

-- 074's rules, unchanged
SELECT pg_temp.expect_fail($$INSERT INTO public.contest_phases (contest_id, name, starts_at, ends_at)
  VALUES ('c-open', 'evaluation', now() + interval '5 days', now() + interval '12 days')$$, 'overlaps');
INSERT INTO public.contest_phases (contest_id, name, starts_at, ends_at)
  VALUES ('c-open', 'evaluation', now() + interval '10 days', now() + interval '20 days');
SELECT pg_temp.ok((SELECT count(*) = 2 FROM public.contest_phases WHERE contest_id = 'c-open'),
  'consecutive windows ahead are added') AS d23b;
UPDATE public.contest_phases SET ends_at = now() + interval '21 days' WHERE contest_id = 'c-open' AND name = 'evaluation';
SELECT pg_temp.ok((SELECT ends_at > now() + interval '20 days' FROM public.contest_phases
  WHERE contest_id = 'c-open' AND name = 'evaluation'), 'a window not yet started, in a contest without entries, can still be moved') AS d23c;
-- a window that has started is frozen (put in place as the table owner would, bypassing the guard)
ALTER TABLE public.contest_phases DISABLE TRIGGER contest_phases_guard;
UPDATE public.contest_phases SET starts_at = now() - interval '1 day' WHERE contest_id = 'c-open' AND name = 'practice';
ALTER TABLE public.contest_phases ENABLE TRIGGER contest_phases_guard;
SELECT pg_temp.expect_fail($$DELETE FROM public.contest_phases WHERE contest_id = 'c-open' AND name = 'practice'$$,
  'never edited or deleted');
SELECT 'ALL CHECKS PASSED';
