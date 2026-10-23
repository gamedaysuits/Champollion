-- Migration 079, exercised as each role would on Supabase. Each check prints
-- PASS or raises. Owner A = a@x, helper B = b@x, stranger C = c@x.
\set ON_ERROR_STOP on
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION pg_temp.as_user(email text) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('email', email)::text, false)
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

-- 1. A registers: born pending_review, owner bound by the trigger
SELECT pg_temp.as_user('a@x');
SET ROLE authenticated;
INSERT INTO public.projects (slug, display_name, owner_display, source_code, target_code, target_name, purpose)
VALUES ('rays-words', 'Grandpa''s words', 'The Ray family', 'eng', 'qaa', 'Our language', 'everyday phrases');
SELECT pg_temp.ok((SELECT count(*) FROM public.projects WHERE slug = 'rays-words') = 1, 'the owner sees their pending project') AS check1;
SELECT pg_temp.ok((SELECT created_by FROM public.project_owners o JOIN public.projects p ON p.id = o.project_id
                   WHERE p.slug = 'rays-words') = 'a@x', 'the trigger bound the owner') AS check1b;
-- born listed is refused
SELECT pg_temp.expect_fail($$INSERT INTO public.projects (slug, display_name, owner_display, source_code, target_code, target_name, purpose, status)
  VALUES ('sneaky', 'S', 'S', 'eng', 'qaa', 'X', 'p', 'listed')$$, 'born pending_review');
-- a private-use code needs its name
SELECT pg_temp.expect_fail($$INSERT INTO public.projects (slug, display_name, owner_display, source_code, target_code, purpose)
  VALUES ('noname', 'N', 'N', 'eng', 'qaa', 'p')$$, 'projects_private_use_named');
RESET ROLE;

-- 2. nobody else sees a pending project; nobody can write an ownership row
SELECT pg_temp.as_user('c@x');
SET ROLE anon;
SELECT pg_temp.ok((SELECT count(*) FROM public.projects) = 0, 'anon sees no pending project') AS check2;
RESET ROLE;
-- the curator makes a project with no owner yet; a stranger cannot claim it by its number
SET ROLE service_role;
INSERT INTO public.projects (slug, display_name, owner_display, source_code, target_code, purpose)
  VALUES ('curated', 'C', 'Curator', 'eng', 'deu', 'p');
RESET ROLE;
SET ROLE authenticated;
SELECT pg_temp.expect_fail(format('INSERT INTO public.project_owners (project_id, created_by) VALUES (%s, %L)',
  (SELECT id FROM public.projects WHERE slug = 'curated'), 'c@x'), 'row-level security');
SELECT pg_temp.expect_fail($$SELECT public.project_bind_owner()$$, 'permission denied');
RESET ROLE;

-- 3. the owner cannot list it; the curator can (listed_at set)
SELECT pg_temp.as_user('a@x');
SET ROLE authenticated;
SELECT pg_temp.expect_fail($$UPDATE public.projects SET status = 'listed' WHERE slug = 'rays-words'$$, 'row-level security');
RESET ROLE;
SELECT pg_temp.as_user('');
SET ROLE service_role;
SELECT pg_temp.expect_fail($$UPDATE public.projects SET status = 'declined' WHERE slug = 'rays-words'$$, 'review_note');
UPDATE public.projects SET status = 'listed' WHERE slug = 'rays-words';
SELECT pg_temp.ok((SELECT listed_at IS NOT NULL FROM public.projects WHERE slug = 'rays-words'), 'the curator listed it') AS check3;
RESET ROLE;

-- 4. anon now sees it; the owner adds an ask, public while listed
SET ROLE anon;
SELECT pg_temp.ok((SELECT count(*) FROM public.projects WHERE status = 'listed') = 1, 'anon sees the listed project') AS check4;
RESET ROLE;
SELECT pg_temp.as_user('a@x');
SET ROLE authenticated;
INSERT INTO public.project_asks (project_id, kind, what, how_many)
  SELECT id, 'sentences', 'greetings and weather', 40 FROM public.projects WHERE slug = 'rays-words';
-- an edit without going back to review is refused; with it, accepted
SELECT pg_temp.expect_fail($$UPDATE public.projects SET about = 'new text' WHERE slug = 'rays-words'$$, 'goes back through review');
UPDATE public.projects SET about = 'new text', status = 'pending_review' WHERE slug = 'rays-words';
RESET ROLE;
SET ROLE service_role;
UPDATE public.projects SET status = 'listed' WHERE slug = 'rays-words';
RESET ROLE;
SET ROLE anon;
SELECT pg_temp.ok((SELECT count(*) FROM public.project_asks) = 1, 'anon sees the ask of a listed project') AS check4b;
RESET ROLE;

-- 5. B offers a file: into B's own folder of a listed project
SELECT pg_temp.as_user('b@x');
SET ROLE authenticated;
INSERT INTO storage.objects (bucket_id, name) VALUES ('project-offers', 'rays-words/b@x/abcd1234/a.tsv');
SELECT pg_temp.expect_fail($$INSERT INTO storage.objects (bucket_id, name) VALUES ('project-offers', 'rays-words/a@x/zzzz9999/a.tsv')$$,
  'row-level security');
INSERT INTO public.project_offers (offer_id, project_id, ask_id, submitted_by, helper_display, terms, file_name,
                                   storage_path, sha256, bytes)
  SELECT 'abcd1234', p.id, a.id, 'b@x', 'Ana', 'for training only', 'a.tsv', 'rays-words/b@x/abcd1234/a.tsv',
         repeat('a', 64), 10
  FROM public.projects p JOIN public.project_asks a ON a.project_id = p.id WHERE p.slug = 'rays-words';
SELECT pg_temp.expect_fail($$INSERT INTO public.project_offers (offer_id, project_id, submitted_by, helper_display, terms,
  file_name, storage_path, sha256, bytes) SELECT 'wrongpath1', id, 'b@x', 'Ana', 't', 'a.tsv', 'rays-words/other/x/a.tsv',
  repeat('a', 64), 10 FROM public.projects WHERE slug = 'rays-words'$$, 'storage_path must be');
-- B cannot accept their own offer to someone else's project
SELECT pg_temp.expect_fail($$UPDATE public.project_offers SET status = 'accepted' WHERE offer_id = 'abcd1234'$$,
  'row-level security');
RESET ROLE;

-- 6. C sees neither the offer nor the file; A sees both and accepts, once
SELECT pg_temp.as_user('c@x');
SET ROLE authenticated;
SELECT pg_temp.ok((SELECT count(*) FROM public.project_offers) = 0 AND (SELECT count(*) FROM storage.objects) = 0, 'a stranger sees no offer and no file') AS check6;
RESET ROLE;
SELECT pg_temp.as_user('a@x');
SET ROLE authenticated;
SELECT pg_temp.ok((SELECT count(*) FROM public.project_offers) = 1 AND (SELECT count(*) FROM storage.objects) = 1, 'the owner sees the offer and its file') AS check6b;
UPDATE public.project_offers SET status = 'accepted' WHERE offer_id = 'abcd1234';
SELECT pg_temp.expect_fail($$UPDATE public.project_offers SET status = 'declined' WHERE offer_id = 'abcd1234'$$,
  'illegal transition');
SELECT pg_temp.expect_fail($$UPDATE public.project_offers SET terms = 'changed' WHERE offer_id = 'abcd1234'$$,
  'immutable');
RESET ROLE;

-- 7. the throttle: five registrations a day
SELECT pg_temp.as_user('a@x');
SET ROLE authenticated;
INSERT INTO public.projects (slug, display_name, owner_display, source_code, target_code, purpose)
  SELECT 'p' || g, 'P' || g, 'A', 'eng', 'fra', 'p' FROM generate_series(2, 5) g;
SELECT pg_temp.expect_fail($$INSERT INTO public.projects (slug, display_name, owner_display, source_code, target_code, purpose)
  VALUES ('p6', 'P6', 'A', 'eng', 'fra', 'p')$$, 'limit 5');
-- closing is final
UPDATE public.projects SET status = 'closed' WHERE slug = 'p2';
SELECT pg_temp.expect_fail($$UPDATE public.projects SET status = 'pending_review' WHERE slug = 'p2'$$, 'closing is final');
RESET ROLE;
SELECT 'ALL CHECKS PASSED' AS done;
