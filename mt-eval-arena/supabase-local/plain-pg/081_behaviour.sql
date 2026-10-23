-- Migration 081, exercised as each role would on Supabase (after 079 and 080).
-- Each check prints PASS or raises. Owner D (d@x), helper E (e@x), a sign-in
-- with no email N, the curator (service_role).
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

-- 1. D19: a sign-in with no email registers nothing; the curator still can
SELECT pg_temp.as_user(NULL, 'nnnnnnnn-0000-0000-0000-000000000009');
SET ROLE authenticated;
SELECT pg_temp.expect_fail($$INSERT INTO public.projects (slug, display_name, owner_display, source_code, target_code,
  target_name, purpose) VALUES ('no-owner', 'No owner', 'Nobody', 'eng', 'qaa', 'Ours', 'x')$$,
  'registered from an account with an email');
RESET ROLE;
SELECT pg_temp.as_user(NULL, NULL);
SET ROLE service_role;
INSERT INTO public.projects (slug, display_name, owner_display, source_code, target_code, target_name, purpose)
VALUES ('curated', 'Curated', 'The curator', 'eng', 'qaa', 'Ours', 'seed');
RESET ROLE;
SELECT pg_temp.ok(EXISTS (SELECT 1 FROM public.projects WHERE slug = 'curated'), 'the curator registers without an email') AS check1;

-- D registers; the curator lists it
SELECT pg_temp.as_user('d@x', 'dddddddd-0000-0000-0000-000000000004');
SET ROLE authenticated;
INSERT INTO public.projects (slug, display_name, owner_display, source_code, target_code, target_name, purpose)
VALUES ('dees-words', 'D''s words', 'The D family', 'eng', 'qaa', 'Our language', 'everyday phrases');
RESET ROLE;
SELECT pg_temp.as_user(NULL, NULL);
SET ROLE service_role;
UPDATE public.projects SET status = 'listed', review_note = 'fine' WHERE slug = 'dees-words';
RESET ROLE;

-- 2. D20: the owner cannot rewrite the curator's record; may still take it off the list
SELECT pg_temp.as_user('d@x', 'dddddddd-0000-0000-0000-000000000004');
SET ROLE authenticated;
SELECT pg_temp.expect_fail($$UPDATE public.projects SET review_note = 'approved by me' WHERE slug = 'dees-words'$$,
  'are the curator''s');
SELECT pg_temp.expect_fail($$UPDATE public.projects SET listed_at = NOW() - INTERVAL '1 year' WHERE slug = 'dees-words'$$,
  'are the curator''s');
RESET ROLE;
SELECT pg_temp.ok((SELECT review_note FROM public.projects WHERE slug = 'dees-words') = 'fine', 'the curator''s note stands') AS check2;

-- 3. D21: the owner reads a file only while its offer stands
SELECT pg_temp.as_user('e@x', 'eeeeeeee-0000-0000-0000-000000000005');
SET ROLE authenticated;
INSERT INTO storage.objects (bucket_id, name)
  VALUES ('project-offers', 'dees-words/eeeeeeee-0000-0000-0000-000000000005/never001/a.tsv');
INSERT INTO storage.objects (bucket_id, name)
  VALUES ('project-offers', 'dees-words/eeeeeeee-0000-0000-0000-000000000005/offer001/b.tsv');
INSERT INTO public.project_offers (offer_id, project_id, submitted_by, helper_display, terms, file_name,
                                   storage_path, sha256, bytes)
  SELECT 'offer001', id, 'x', 'Eve', 'for training only', 'b.tsv',
         'dees-words/eeeeeeee-0000-0000-0000-000000000005/offer001/b.tsv', repeat('b', 64), 10
  FROM public.projects WHERE slug = 'dees-words';
RESET ROLE;
SELECT pg_temp.as_user('d@x', 'dddddddd-0000-0000-0000-000000000004');
SET ROLE authenticated;
SELECT pg_temp.ok((SELECT count(*) FROM storage.objects WHERE name LIKE 'dees-words/%') = 1
             AND (SELECT count(*) FROM storage.objects WHERE name LIKE '%/offer001/%') = 1, 'the owner reads the offered file, not the one nobody offered') AS check3;
RESET ROLE;
SELECT pg_temp.as_user('e@x', 'eeeeeeee-0000-0000-0000-000000000005');
SET ROLE authenticated;
UPDATE public.project_offers SET status = 'withdrawn' WHERE offer_id = 'offer001';
SELECT pg_temp.ok((SELECT count(*) FROM storage.objects WHERE name LIKE 'dees-words/%') = 2, 'the helper still reads both of their own files') AS check3b;
RESET ROLE;
SELECT pg_temp.as_user('d@x', 'dddddddd-0000-0000-0000-000000000004');
SET ROLE authenticated;
SELECT pg_temp.ok((SELECT count(*) FROM storage.objects WHERE name LIKE 'dees-words/%') = 0, 'a withdrawn offer''s file is no longer the owner''s to read') AS check3c;
RESET ROLE;

-- 4. the bucket itself holds the 50 MiB limit
SELECT pg_temp.ok((SELECT file_size_limit FROM storage.buckets WHERE id = 'project-offers') = 52428800, 'the bucket refuses a file over 50 MiB') AS check4;
SELECT 'ALL CHECKS PASSED' AS done;
