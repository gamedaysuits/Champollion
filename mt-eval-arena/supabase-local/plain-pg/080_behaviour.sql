-- Migration 080, exercised as each role would on Supabase. Each check prints
-- PASS or raises. Owner A (a@x, sub aaaa…), helper B (b@x, sub bbbb…), stranger C.
\set ON_ERROR_STOP on
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION pg_temp.as_user(email text, sub text) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('email', email, 'sub', sub)::text, false)
$$;
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

-- A registers; the curator lists it; A asks
SELECT pg_temp.as_user('a@x', 'aaaaaaaa-0000-0000-0000-000000000001');
SET ROLE authenticated;
INSERT INTO public.projects (slug, display_name, owner_display, source_code, target_code, target_name, purpose)
VALUES ('rays-words', 'Grandpa''s words', 'The Ray family', 'eng', 'qaa', 'Our language', 'everyday phrases');
RESET ROLE;
SET ROLE service_role;
UPDATE public.projects SET status = 'listed' WHERE slug = 'rays-words';
RESET ROLE;

-- 1. B offers: the row and the folder name B's account id, never B's email —
--    even when the client sends the email (the trigger sets it from the token)
SELECT pg_temp.as_user('b@x', 'bbbbbbbb-0000-0000-0000-000000000002');
SET ROLE authenticated;
SELECT pg_temp.expect_fail($$INSERT INTO storage.objects (bucket_id, name) VALUES ('project-offers', 'rays-words/b@x/abcd1234/a.tsv')$$,
  'row-level security');
INSERT INTO storage.objects (bucket_id, name)
  VALUES ('project-offers', 'rays-words/bbbbbbbb-0000-0000-0000-000000000002/abcd1234/a.tsv');
INSERT INTO public.project_offers (offer_id, project_id, submitted_by, helper_display, terms, file_name,
                                   storage_path, sha256, bytes)
  SELECT 'abcd1234', id, 'b@x', 'Ana', 'for training only', 'a.tsv',
         'rays-words/bbbbbbbb-0000-0000-0000-000000000002/abcd1234/a.tsv', repeat('a', 64), 10
  FROM public.projects WHERE slug = 'rays-words';
SELECT pg_temp.ok((SELECT submitted_by FROM public.project_offers WHERE offer_id = 'abcd1234')
                 = 'bbbbbbbb-0000-0000-0000-000000000002', 'the offer is keyed by the account id, not the email the client sent') AS check1;
SELECT pg_temp.expect_fail($$INSERT INTO public.project_offers (offer_id, project_id, submitted_by, helper_display, terms,
  file_name, storage_path, sha256, bytes) SELECT 'emailpath1', id, 'b@x', 'Ana', 't', 'a.tsv', 'rays-words/b@x/emailpath1/a.tsv',
  repeat('a', 64), 10 FROM public.projects WHERE slug = 'rays-words'$$, 'your account id');
RESET ROLE;

-- 2. A, the owner, reads the offer: a name and an account id, no email anywhere
SELECT pg_temp.as_user('a@x', 'aaaaaaaa-0000-0000-0000-000000000001');
SET ROLE authenticated;
SELECT pg_temp.ok((SELECT count(*) FROM public.project_offers
                   WHERE helper_display = 'Ana' AND position('@' in submitted_by || storage_path) = 0) = 1, 'the owner sees the helper''s name and no email') AS check2;
RESET ROLE;

-- 3. a stranger sees nothing and removes nothing
SELECT pg_temp.as_user('c@x', 'cccccccc-0000-0000-0000-000000000003');
SET ROLE authenticated;
SELECT pg_temp.ok((SELECT count(*) FROM public.project_offers) = 0 AND (SELECT count(*) FROM storage.objects) = 0, 'a stranger sees no offer and no file') AS check3;
DELETE FROM storage.objects WHERE bucket_id = 'project-offers';
RESET ROLE;
SELECT pg_temp.ok((SELECT count(*) FROM storage.objects) = 1, 'a stranger removed nothing') AS check3b;

-- 4. the helper cannot remove a file whose offer stands; after withdrawing, can
SELECT pg_temp.as_user('b@x', 'bbbbbbbb-0000-0000-0000-000000000002');
SET ROLE authenticated;
DELETE FROM storage.objects WHERE name LIKE 'rays-words/bbbbbbbb-%/abcd1234/%';
RESET ROLE;
SELECT pg_temp.ok((SELECT count(*) FROM storage.objects) = 1, 'a standing offer''s file stays') AS check4;
SET ROLE authenticated;
UPDATE public.project_offers SET status = 'withdrawn' WHERE offer_id = 'abcd1234';
DELETE FROM storage.objects WHERE name LIKE 'rays-words/bbbbbbbb-%/abcd1234/%';
RESET ROLE;
SELECT pg_temp.ok((SELECT count(*) FROM storage.objects) = 0, 'a withdrawn offer''s file is removed by its helper') AS check4b;

-- 5. an upload whose offer row was never written: its helper removes it
SET ROLE authenticated;
INSERT INTO storage.objects (bucket_id, name)
  VALUES ('project-offers', 'rays-words/bbbbbbbb-0000-0000-0000-000000000002/orphan01/a.tsv');
DELETE FROM storage.objects WHERE name LIKE '%/orphan01/%';
RESET ROLE;
SELECT pg_temp.ok((SELECT count(*) FROM storage.objects) = 0, 'an orphaned upload is removed by its helper') AS check5;

-- 6. the owner removes a declined offer's file, never a standing one
SET ROLE authenticated;
INSERT INTO storage.objects (bucket_id, name)
  VALUES ('project-offers', 'rays-words/bbbbbbbb-0000-0000-0000-000000000002/second01/b.tsv');
INSERT INTO public.project_offers (offer_id, project_id, submitted_by, helper_display, terms, file_name,
                                   storage_path, sha256, bytes)
  SELECT 'second01', id, 'x', 'Ana', 'for training only', 'b.tsv',
         'rays-words/bbbbbbbb-0000-0000-0000-000000000002/second01/b.tsv', repeat('b', 64), 10
  FROM public.projects WHERE slug = 'rays-words';
RESET ROLE;
SELECT pg_temp.as_user('a@x', 'aaaaaaaa-0000-0000-0000-000000000001');
SET ROLE authenticated;
DELETE FROM storage.objects WHERE name LIKE '%/second01/%';
RESET ROLE;
SELECT pg_temp.ok((SELECT count(*) FROM storage.objects) = 1, 'the owner cannot remove a standing offer''s file') AS check6;
SET ROLE authenticated;
UPDATE public.project_offers SET status = 'declined', decline_reason = 'not what we asked for' WHERE offer_id = 'second01';
DELETE FROM storage.objects WHERE name LIKE '%/second01/%';
RESET ROLE;
SELECT pg_temp.ok((SELECT count(*) FROM storage.objects) = 0, 'the owner removes a declined offer''s file') AS check6b;

-- 7. no writer — the service role included — keys an offer by an email (D22, 2026-10-13)
SELECT pg_temp.as_user(NULL, NULL);       -- a service call: no user token to take an id from
SET ROLE service_role;
SELECT pg_temp.expect_fail($$INSERT INTO public.project_offers (offer_id, project_id, submitted_by, helper_display, terms,
  file_name, storage_path, sha256, bytes) SELECT 'byemail1', id, 'b@x', 'Ana', 't', 'a.tsv',
  'rays-words/b@x/byemail1/a.tsv', repeat('a', 64), 10 FROM public.projects WHERE slug = 'rays-words'$$,
  'project_offers_submitted_by_not_email');
RESET ROLE;
SELECT 'ALL CHECKS PASSED' AS done;
