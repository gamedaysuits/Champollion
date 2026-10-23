-- ===========================================================================
-- Migration 076 — a contest ranks on ANY registered metric, and promises the
--                  computation, not just the name
-- ===========================================================================
--
-- Founder ruling 2026-09-27: "contests should be able to rank on any metric
-- whatsoever, that's a contest config question" — COMET, a custom metric,
-- whatever. Until now the rankable set was four ids hard-coded in two places
-- (contest_rank.PRIMARY_METRICS and 072/074's `v_metric NOT IN (...)`), and
-- `--metric chrf` silently meant chrF++.
--
--   1. public.rankable_metrics — the vocabulary as DATA (the 070 pattern for
--      quarantined_id_patterns). Seeded from every shared/metric-registry.json
--      entry that carries a `ranking` block. Making another registered metric
--      rankable is an INSERT here plus a ranking block in the registry, never
--      a new guard. Public-read (the vocabulary is not secret; the guard reads
--      it under the writer's role), service-role write.
--   2. contest_lifecycle_guard() re-issued from 074's text with exactly three
--      changes:
--        a. primary_metric is checked against public.rankable_metrics;
--        b. metric_signature, harness_version and declared_power join the
--           frozen PROMISE keys (Python twin: contest_policy.FROZEN_PROMISE_KEYS) — a
--           contest promises the exact computation (sacreBLEU signature, or
--           neural model id + harness version) and the harness version that
--           scores entries, recorded at creation by `mt-eval contest create`;
--           declared_power states what the test can resolve (its size and
--           minimum detectable effect) before it opens;
--        c. the two strings must be non-empty; declared_power must be an
--           object with an integer n_segments >= 1.
--      Everything else 072/074 enforce is unchanged (the body is 074's).
--
-- CONTENT-FREE: metric ids and display names only.
--
-- DEV/LOCAL ONLY until the founder applies it. A database without 076 keeps
-- 074's four-metric vocabulary; the harness still records the two promise
-- keys (074 lets unknown metadata keys through) and contest_rank enforces them
-- client-side, but only 076 freezes them beneath every client.
--
-- ROLLBACK: re-run section 5 of 074 (its CREATE OR REPLACE FUNCTION
-- public.contest_lifecycle_guard() through its CREATE TRIGGER), then
--   DROP TABLE IF EXISTS public.rankable_metrics;
-- ===========================================================================

CREATE TABLE IF NOT EXISTS public.rankable_metrics (
  metric_id    text PRIMARY KEY CHECK (metric_id ~ '^[a-z0-9][a-z0-9_]*$'),
  display_name text NOT NULL,
  direction    text NOT NULL CHECK (direction IN ('higher', 'lower')),
  recorded_by  text NOT NULL,
  recorded_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.rankable_metrics IS
  'Metrics a contest may rank on (migration 076): contests.metadata.primary_metric must name a row here. Seeded from the shared/metric-registry.json entries that carry a ranking block; data, not code — a newly rankable metric is an INSERT plus a registry ranking block. Read by contest_lifecycle_guard().';

-- Migration 054's event trigger auto-enables RLS on new tables, so WITHOUT an
-- explicit SELECT policy this table is deny-all and the guard would refuse
-- every metric. Public-read, service-role write (the 070 pattern).
ALTER TABLE public.rankable_metrics ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rankable_metrics_public_read ON public.rankable_metrics;
CREATE POLICY rankable_metrics_public_read
  ON public.rankable_metrics FOR SELECT USING (true);

-- Seed: the registry's ranking entries (arena/tests/test_rankable_metrics_migration.py
-- asserts this list equals rankable_metrics.RANKABLE_METRICS).
INSERT INTO public.rankable_metrics (metric_id, display_name, direction, recorded_by) VALUES
  ('exact_match_rate', 'Exact Match', 'higher', 'shared/metric-registry.json ranking block'),
  ('chrf_plus_plus', 'chrF++', 'higher', 'shared/metric-registry.json ranking block'),
  ('bleu', 'BLEU', 'higher', 'shared/metric-registry.json ranking block'),
  ('ter', 'Translation Edit Rate', 'lower', 'shared/metric-registry.json ranking block'),
  ('comet_score', 'COMET / AfriCOMET', 'higher', 'shared/metric-registry.json ranking block'),
  ('spbleu', 'spBLEU (FLORES-200)', 'higher', 'shared/metric-registry.json ranking block'),
  ('chrf_plain', 'Plain chrF (word_order=0)', 'higher', 'shared/metric-registry.json ranking block'),
  ('composite', 'Composite Score (experimental)', 'higher', 'shared/metric-registry.json ranking block')
ON CONFLICT (metric_id) DO NOTHING;

-- ===========================================================================
-- The lifecycle guard — 074's body with the three 076 changes above.
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.contest_lifecycle_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  -- The participant-facing PROMISES. Frozen the moment the contest has
  -- entries. (Python twin: contest_policy.FROZEN_PROMISE_KEYS.)
  v_frozen_promise_keys CONSTANT text[] := ARRAY[
    'tie_test', 'alpha', 'n_resamples', 'seed', 'require_description',
    'prize_terms', 'test_suites', 'anonymize_until_close',
    'results_visibility', 'allowed_tracks', 'open_weight_only',
    'sealed_holdout_set_id', 'metric_signature', 'harness_version',
    'declared_power'];
  -- The only metadata key that may still change after close.
  -- (Python twin: contest_policy.POST_CLOSE_KEYS.)
  v_post_close_keys CONSTANT text[] := ARRAY['human_eval_selection'];

  v_metric      text;
  v_rankable    text;
  v_has_entries boolean;
  v_key         text;
  v_visibility  text;
  v_tie_test    text;
  v_alpha       numeric;
  v_resamples   numeric;
  v_track       jsonb;
  v_suite       jsonb;
  v_suite_key   text;
  v_holdout     text;
  v_prize       jsonb;
  v_prize_key   text;
  v_disposition text;
  v_old_md      jsonb;
  v_new_md      jsonb;
BEGIN
  -- ---- 5./076. primary_metric: any metric in public.rankable_metrics -------
  -- The vocabulary is DATA (076): the rankable_metrics table, seeded from the
  -- shared/metric-registry.json entries that carry a ranking block. Making a
  -- metric rankable is an INSERT there, not a new guard.
  IF NEW.metadata IS NOT NULL AND NEW.metadata ? 'primary_metric' THEN
    SELECT string_agg(metric_id, ' | ' ORDER BY metric_id) INTO v_rankable
      FROM public.rankable_metrics;
    IF jsonb_typeof(NEW.metadata -> 'primary_metric') <> 'string' THEN
      RAISE EXCEPTION
        'CONTEST LIFECYCLE GUARD: metadata.primary_metric must be a string naming a rankable metric (%), got %.',
        coalesce(v_rankable, 'none registered'), NEW.metadata -> 'primary_metric';
    END IF;
    v_metric := NEW.metadata ->> 'primary_metric';
    IF NOT EXISTS (SELECT 1 FROM public.rankable_metrics r WHERE r.metric_id = v_metric) THEN
      RAISE EXCEPTION
        'CONTEST LIFECYCLE GUARD: metadata.primary_metric ''%'' is not rankable — allowed: % (public.rankable_metrics, seeded from shared/metric-registry.json).',
        v_metric, coalesce(v_rankable, 'none registered');
    END IF;
  END IF;

  -- ---- 076: the computation promises are non-empty strings -----------------
  IF NEW.metadata IS NOT NULL THEN
    FOREACH v_key IN ARRAY ARRAY['metric_signature', 'harness_version'] LOOP
      IF NEW.metadata ? v_key AND (
           jsonb_typeof(NEW.metadata -> v_key) <> 'string'
           OR btrim(NEW.metadata ->> v_key) = '') THEN
        RAISE EXCEPTION
          'CONTEST LIFECYCLE GUARD: metadata.% must be a non-empty string (the promised computation), got %.',
          v_key, NEW.metadata -> v_key;
      END IF;
    END LOOP;
    -- declared_power: what the test can resolve (size + minimum detectable
    -- effect, power.declare_test_power). An object with an integer
    -- n_segments >= 1; its MDE may be null, with the reason in its note.
    IF NEW.metadata ? 'declared_power' AND (
         jsonb_typeof(NEW.metadata -> 'declared_power') <> 'object'
         OR jsonb_typeof(NEW.metadata -> 'declared_power' -> 'n_segments') IS DISTINCT FROM 'number'
         OR (NEW.metadata -> 'declared_power' ->> 'n_segments') !~ '^[1-9][0-9]*$') THEN
      RAISE EXCEPTION
        'CONTEST LIFECYCLE GUARD: metadata.declared_power must be an object with an integer n_segments >= 1 (power.declare_test_power), got %.',
        NEW.metadata -> 'declared_power';
    END IF;
  END IF;

  -- ---- 074: promise-key vocabularies, checked at WRITE time ---------------
  IF NEW.metadata IS NOT NULL THEN

    IF NEW.metadata ? 'results_visibility' THEN
      v_visibility := NEW.metadata ->> 'results_visibility';
      IF jsonb_typeof(NEW.metadata -> 'results_visibility') <> 'string'
         OR v_visibility NOT IN ('immediate', 'hidden_until_close') THEN
        RAISE EXCEPTION
          'CONTEST LIFECYCLE GUARD: metadata.results_visibility must be one of immediate | hidden_until_close, got %.',
          NEW.metadata -> 'results_visibility';
      END IF;
    END IF;

    IF NEW.metadata ? 'tie_test' THEN
      v_tie_test := NEW.metadata ->> 'tie_test';
      IF jsonb_typeof(NEW.metadata -> 'tie_test') <> 'string'
         OR v_tie_test NOT IN ('ar', 'bootstrap') THEN
        RAISE EXCEPTION
          'CONTEST LIFECYCLE GUARD: metadata.tie_test must be one of ar | bootstrap (the significance tests contest_rank implements), got %.',
          NEW.metadata -> 'tie_test';
      END IF;
    END IF;

    IF NEW.metadata ? 'alpha' THEN
      IF jsonb_typeof(NEW.metadata -> 'alpha') <> 'number' THEN
        RAISE EXCEPTION
          'CONTEST LIFECYCLE GUARD: metadata.alpha must be a number strictly between 0 and 1, got %.',
          NEW.metadata -> 'alpha';
      END IF;
      v_alpha := (NEW.metadata ->> 'alpha')::numeric;
      IF NOT (v_alpha > 0 AND v_alpha < 1) THEN
        RAISE EXCEPTION
          'CONTEST LIFECYCLE GUARD: metadata.alpha must be strictly between 0 and 1, got %.',
          v_alpha;
      END IF;
    END IF;

    IF NEW.metadata ? 'n_resamples' THEN
      IF jsonb_typeof(NEW.metadata -> 'n_resamples') <> 'number' THEN
        RAISE EXCEPTION
          'CONTEST LIFECYCLE GUARD: metadata.n_resamples must be an integer >= 1, got %.',
          NEW.metadata -> 'n_resamples';
      END IF;
      v_resamples := (NEW.metadata ->> 'n_resamples')::numeric;
      IF v_resamples < 1 OR v_resamples <> trunc(v_resamples) THEN
        RAISE EXCEPTION
          'CONTEST LIFECYCLE GUARD: metadata.n_resamples must be an integer >= 1, got %.',
          v_resamples;
      END IF;
    END IF;

    IF NEW.metadata ? 'allowed_tracks' THEN
      IF jsonb_typeof(NEW.metadata -> 'allowed_tracks') <> 'array' THEN
        RAISE EXCEPTION
          'CONTEST LIFECYCLE GUARD: metadata.allowed_tracks must be an array of tracks (constrained | unconstrained), got %.',
          NEW.metadata -> 'allowed_tracks';
      END IF;
      FOR v_track IN SELECT jsonb_array_elements(NEW.metadata -> 'allowed_tracks') LOOP
        IF jsonb_typeof(v_track) <> 'string'
           OR (v_track #>> '{}') NOT IN ('constrained', 'unconstrained') THEN
          RAISE EXCEPTION
            'CONTEST LIFECYCLE GUARD: metadata.allowed_tracks entry % is not a track — allowed: constrained | unconstrained.',
            v_track;
        END IF;
      END LOOP;
    END IF;

    FOREACH v_key IN ARRAY ARRAY['open_weight_only', 'anonymize_until_close', 'require_description'] LOOP
      IF NEW.metadata ? v_key AND jsonb_typeof(NEW.metadata -> v_key) <> 'boolean' THEN
        RAISE EXCEPTION
          'CONTEST LIFECYCLE GUARD: metadata.% must be a boolean, got %.',
          v_key, NEW.metadata -> v_key;
      END IF;
    END LOOP;

    IF NEW.metadata ? 'test_suites' THEN
      IF jsonb_typeof(NEW.metadata -> 'test_suites') <> 'array' THEN
        RAISE EXCEPTION
          'CONTEST LIFECYCLE GUARD: metadata.test_suites must be an array of declared diagnostic suites, got %.',
          NEW.metadata -> 'test_suites';
      END IF;
      FOR v_suite IN SELECT jsonb_array_elements(NEW.metadata -> 'test_suites') LOOP
        IF jsonb_typeof(v_suite) <> 'object' THEN
          RAISE EXCEPTION
            'CONTEST LIFECYCLE GUARD: metadata.test_suites entry % is not an object — each suite declares suite_id, corpus_card_id, publisher, url, sha256.',
            v_suite;
        END IF;
        FOREACH v_suite_key IN ARRAY ARRAY['suite_id', 'corpus_card_id', 'publisher', 'url', 'sha256'] LOOP
          IF jsonb_typeof(v_suite -> v_suite_key) IS DISTINCT FROM 'string' THEN
            RAISE EXCEPTION
              'CONTEST LIFECYCLE GUARD: metadata.test_suites entry % is missing string key ''%'' — a declared suite is pinned by suite_id, corpus_card_id, publisher, url and sha256.',
              v_suite, v_suite_key;
          END IF;
        END LOOP;
        IF (v_suite ->> 'sha256') !~ '^[0-9a-f]{64}$' THEN
          RAISE EXCEPTION
            'CONTEST LIFECYCLE GUARD: metadata.test_suites entry ''%'' has sha256 ''%'' — a declared suite is pinned by a 64-hex SHA-256 of the exact bytes.',
            v_suite ->> 'suite_id', v_suite ->> 'sha256';
        END IF;
      END LOOP;
    END IF;

    IF NEW.metadata ? 'sealed_holdout_set_id' THEN
      IF jsonb_typeof(NEW.metadata -> 'sealed_holdout_set_id') <> 'string' THEN
        RAISE EXCEPTION
          'CONTEST LIFECYCLE GUARD: metadata.sealed_holdout_set_id must be a registered sealed_sets id (string), got %.',
          NEW.metadata -> 'sealed_holdout_set_id';
      END IF;
      v_holdout := NEW.metadata ->> 'sealed_holdout_set_id';
      IF NOT EXISTS (SELECT 1 FROM public.sealed_sets s WHERE s.sealed_set_id = v_holdout) THEN
        RAISE EXCEPTION
          'CONTEST LIFECYCLE GUARD: metadata.sealed_holdout_set_id ''%'' is not a registered sealed set (sealed_sets).',
          v_holdout;
      END IF;
    END IF;

    -- metadata.prize_terms — the PRIZE DISPOSITION (founder ruling
    -- 2026-09-07: "I think it should be kinda trinary: 'pass to holders' /
    -- 'retain IP' / 'release open' options"). The headline, participant-facing
    -- term of a prized contest is ONE choice out of three. retention / rights
    -- / host_use / release are DERIVED from that choice
    -- (contest_policy.PRIZE_DISPOSITION_DERIVED); rights and host_use are
    -- never written here at all, and retention / release only as the one
    -- narrow override their disposition offers. The EXECUTION mode is fixed
    -- (the entry is handed to the host's air-gapped node to be scored); the
    -- disposition says what happens to it AFTERWARDS. Vocabulary twin:
    -- contest_policy.PRIZE_* + contest_prize_terms.parse_prize_terms.
    IF NEW.metadata ? 'prize_terms' THEN
      IF jsonb_typeof(NEW.metadata -> 'prize_terms') <> 'object' THEN
        RAISE EXCEPTION
          'CONTEST LIFECYCLE GUARD: metadata.prize_terms must be an object declaring disposition — one of pass_to_holders | retain_ip | release_open, got %.',
          NEW.metadata -> 'prize_terms';
      END IF;
      v_prize := NEW.metadata -> 'prize_terms';

      IF v_prize ? 'release_required_before_scores' THEN
        RAISE EXCEPTION
          'CONTEST LIFECYCLE GUARD: metadata.prize_terms.release_required_before_scores is RETIRED (founder ruling 2026-09-07 — the prize term is one choice of three). Declare disposition = pass_to_holders | retain_ip | release_open; ''release_open'' is the option that requires publication.';
      END IF;

      IF v_prize ? 'preset' THEN
        RAISE EXCEPTION
          'CONTEST LIFECYCLE GUARD: metadata.prize_terms.preset is RETIRED — the named presets open / audit / community / strict were retired on 2026-09-07. Declare disposition = pass_to_holders | retain_ip | release_open.';
      END IF;

      IF v_prize ? 'rights' OR v_prize ? 'host_use' THEN
        RAISE EXCEPTION
          'CONTEST LIFECYCLE GUARD: metadata.prize_terms.rights and host_use are DERIVED from disposition and are never declared — a hand-written copy of a derived value is a second source of truth waiting to disagree with the first. Declare disposition (pass_to_holders | retain_ip | release_open); the only overrides are retention (retain_ip only: retain_sealed_audit | delete_after_scoring) and release + release_license (release_open only), plus community_terms_url.';
      END IF;

      FOR v_prize_key IN SELECT jsonb_object_keys(v_prize) LOOP
        IF v_prize_key NOT IN ('disposition', 'retention', 'release', 'release_license', 'community_terms_url') THEN
          RAISE EXCEPTION
            'CONTEST LIFECYCLE GUARD: metadata.prize_terms has unknown key ''%'' — the declarable keys are exactly disposition, retention, release, release_license, community_terms_url. Prize money is declared in metadata.prize, never inside the terms.',
            v_prize_key;
        END IF;
      END LOOP;

      IF (v_prize -> 'disposition') #>> '{}' IS NULL
         OR jsonb_typeof(v_prize -> 'disposition') <> 'string'
         OR (v_prize ->> 'disposition') NOT IN ('pass_to_holders', 'retain_ip', 'release_open') THEN
        RAISE EXCEPTION
          'CONTEST LIFECYCLE GUARD: metadata.prize_terms.disposition must be one of pass_to_holders | retain_ip | release_open, got %.',
          v_prize -> 'disposition';
      END IF;
      v_disposition := v_prize ->> 'disposition';

      -- retention: the one override 'retain_ip' offers, and nobody else.
      IF v_prize ? 'retention' THEN
        IF v_disposition <> 'retain_ip' THEN
          RAISE EXCEPTION
            'CONTEST LIFECYCLE GUARD: metadata.prize_terms.retention is not an override disposition ''%'' allows — what the host keeps follows from the disposition. Only ''retain_ip'' may set it (retain_sealed_audit | delete_after_scoring).',
            v_disposition;
        END IF;
        IF jsonb_typeof(v_prize -> 'retention') <> 'string'
           OR (v_prize ->> 'retention') NOT IN ('retain_sealed_audit', 'delete_after_scoring') THEN
          RAISE EXCEPTION
            'CONTEST LIFECYCLE GUARD: metadata.prize_terms.retention must be one of retain_sealed_audit | delete_after_scoring (the values disposition ''retain_ip'' allows), got %.',
            v_prize -> 'retention';
        END IF;
      END IF;

      -- release: the timing override 'release_open' offers, and nobody else.
      IF v_prize ? 'release' THEN
        IF v_disposition <> 'release_open' THEN
          RAISE EXCEPTION
            'CONTEST LIFECYCLE GUARD: metadata.prize_terms.release is not an override disposition ''%'' allows — only ''release_open'' requires a public release, and only it may say when (required_before_scores | required_before_prize | required_after_prize).',
            v_disposition;
        END IF;
        IF jsonb_typeof(v_prize -> 'release') <> 'string'
           OR (v_prize ->> 'release') NOT IN ('required_before_scores', 'required_before_prize', 'required_after_prize') THEN
          RAISE EXCEPTION
            'CONTEST LIFECYCLE GUARD: metadata.prize_terms.release must be one of required_before_scores | required_before_prize | required_after_prize (the values disposition ''release_open'' allows), got %.',
            v_prize -> 'release';
        END IF;
      END IF;

      -- release_license: required exactly under 'release_open', and forbidden
      -- otherwise (a licence for a release nobody has to make is a term about
      -- nothing).
      IF v_disposition = 'release_open' THEN
        IF jsonb_typeof(v_prize -> 'release_license') IS DISTINCT FROM 'string'
           OR btrim(v_prize ->> 'release_license') = '' THEN
          RAISE EXCEPTION
            'CONTEST LIFECYCLE GUARD: disposition ''release_open'' requires release_license — an SPDX identifier or ''any_osi''. "Publish it" without saying under what terms is not a term.';
        END IF;
      ELSIF v_prize ? 'release_license' THEN
        RAISE EXCEPTION
          'CONTEST LIFECYCLE GUARD: metadata.prize_terms.release_license is declared but disposition is ''%'' — only ''release_open'' requires a public release, so drop the licence or choose that option.',
          v_disposition;
      END IF;

      IF v_prize ? 'community_terms_url'
         AND (jsonb_typeof(v_prize -> 'community_terms_url') <> 'string'
              OR (v_prize ->> 'community_terms_url') !~ '^https://[^[:space:]]+$') THEN
        RAISE EXCEPTION
          'CONTEST LIFECYCLE GUARD: metadata.prize_terms.community_terms_url must be an https:// URL, got %.',
          v_prize -> 'community_terms_url';
      END IF;
    END IF;
  END IF;

  -- ---- INSERT: born open, born without a result ---------------------------
  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'open' THEN
      RAISE EXCEPTION
        'CONTEST LIFECYCLE GUARD: a contest is born ''open'' (got ''%'') — closed/archived are reached only through the one-way lifecycle.',
        NEW.status;
    END IF;
    IF NEW.metadata IS NOT NULL
       AND (NEW.metadata ? 'final_ranking'
            OR NEW.metadata ? 'closed_at'
            OR NEW.metadata ? 'closed_by') THEN
      RAISE EXCEPTION
        'CONTEST LIFECYCLE GUARD: a contest is born without a result — metadata.final_ranking / closed_at / closed_by are written only by the close transition.';
    END IF;
    RETURN NEW;
  END IF;

  -- ---- 1. identity freeze (UPDATE) ----------------------------------------
  IF NEW.id            IS DISTINCT FROM OLD.id
     OR NEW.corpus_id     IS DISTINCT FROM OLD.corpus_id
     OR NEW.language_pair IS DISTINCT FROM OLD.language_pair
     OR NEW.lane          IS DISTINCT FROM OLD.lane
     OR NEW.use_context   IS DISTINCT FROM OLD.use_context
     OR NEW.created_by    IS DISTINCT FROM OLD.created_by
     OR NEW.created_at    IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION
      'CONTEST LIFECYCLE GUARD: contest % identity is frozen (id, corpus_id, language_pair, lane, use_context, created_by, created_at) — entries were ranked against these terms; create a new contest instead.',
      OLD.id;
  END IF;

  IF OLD.shared_task_id IS NOT NULL
     AND NEW.shared_task_id IS DISTINCT FROM OLD.shared_task_id THEN
    RAISE EXCEPTION
      'CONTEST LIFECYCLE GUARD: contest % is attached to shared task ''%'' — an edition attachment is made once and never detached or re-pointed.',
      OLD.id, OLD.shared_task_id;
  END IF;

  -- ---- 5./074. primary_metric + the promise keys, frozen once entries -----
  -- "Entries" is the R2 definition: a linked submission, an intake row, OR an
  -- authorization request against any of the contest's sealed sets — because
  -- under R2 the request IS the entry.
  IF (NEW.metadata ->> 'primary_metric') IS DISTINCT FROM (OLD.metadata ->> 'primary_metric') THEN
    SELECT EXISTS (SELECT 1 FROM public.contest_submissions cs WHERE cs.contest_id = OLD.id)
           OR EXISTS (SELECT 1 FROM public.contest_intake ci WHERE ci.contest_id = OLD.id)
           OR EXISTS (SELECT 1 FROM public.authorization_requests ar
                      WHERE ar.sealed_set_id = ANY (public.contest_sealed_set_ids(OLD.id)))
      INTO v_has_entries;
    IF v_has_entries THEN
      RAISE EXCEPTION
        'CONTEST LIFECYCLE GUARD: contest % already has entries — metadata.primary_metric (''%'' → ''%'') is frozen; the ranking rule cannot change after submissions are in.',
        OLD.id, OLD.metadata ->> 'primary_metric', NEW.metadata ->> 'primary_metric';
    END IF;
  END IF;

  FOREACH v_key IN ARRAY v_frozen_promise_keys LOOP
    IF (NEW.metadata -> v_key) IS DISTINCT FROM (OLD.metadata -> v_key) THEN
      IF v_has_entries IS NULL THEN
        SELECT EXISTS (SELECT 1 FROM public.contest_submissions cs WHERE cs.contest_id = OLD.id)
               OR EXISTS (SELECT 1 FROM public.contest_intake ci WHERE ci.contest_id = OLD.id)
               OR EXISTS (SELECT 1 FROM public.authorization_requests ar
                          WHERE ar.sealed_set_id = ANY (public.contest_sealed_set_ids(OLD.id)))
          INTO v_has_entries;
      END IF;
      IF v_has_entries THEN
        RAISE EXCEPTION
          'CONTEST LIFECYCLE GUARD: contest % already has entries — metadata.% is a PROMISE to participants and is frozen (a term that can be rewritten after entries are in is a setting, not a promise).',
          OLD.id, v_key;
      END IF;
    END IF;
  END LOOP;

  -- ---- 2./3. one-way lifecycle + close requires a result ------------------
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NOT (   (OLD.status = 'open'   AND NEW.status = 'closed')
            OR (OLD.status = 'closed' AND NEW.status = 'archived')) THEN
      RAISE EXCEPTION
        'CONTEST LIFECYCLE GUARD: illegal status transition % -> % on contest % — the lifecycle is one-way: open -> closed -> archived (no re-opening, no skipping).',
        OLD.status, NEW.status, OLD.id;
    END IF;

    IF NEW.status = 'closed' THEN
      IF NEW.metadata IS NULL
         OR jsonb_typeof(NEW.metadata -> 'final_ranking') IS DISTINCT FROM 'object' THEN
        RAISE EXCEPTION
          'CONTEST LIFECYCLE GUARD: closing contest % requires metadata.final_ranking to be a JSON object (the frozen ranking `mt-eval contest close` writes) — a contest never closes without a result of record.',
          OLD.id;
      END IF;
      -- Intake shuts with the contest; the close time is the server's.
      NEW.intake_open := false;
      NEW.metadata := NEW.metadata || jsonb_build_object('closed_at', now());
    END IF;
  END IF;

  -- ---- 4. frozen result + intake pinned shut after close ------------------
  IF OLD.status IN ('closed', 'archived') THEN
    IF NEW.intake_open THEN
      RAISE EXCEPTION
        'CONTEST LIFECYCLE GUARD: contest % is % — intake cannot reopen after close.',
        OLD.id, OLD.status;
    END IF;
    IF (NEW.metadata -> 'final_ranking') IS DISTINCT FROM (OLD.metadata -> 'final_ranking')
       OR (NEW.metadata -> 'closed_at')  IS DISTINCT FROM (OLD.metadata -> 'closed_at')
       OR (NEW.metadata -> 'closed_by')  IS DISTINCT FROM (OLD.metadata -> 'closed_by') THEN
      RAISE EXCEPTION
        'CONTEST LIFECYCLE GUARD: contest % is % — metadata.final_ranking / closed_at / closed_by are the result of record and immutable.',
        OLD.id, OLD.status;
    END IF;

    -- 074: after close the whole metadata object is the result of record.
    -- human_eval_selection is the ONE key that may still be written, because
    -- the selection is drawn FROM the frozen ranking and so necessarily lands
    -- after the close.
    v_old_md := COALESCE(OLD.metadata, '{}'::jsonb);
    v_new_md := COALESCE(NEW.metadata, '{}'::jsonb);
    FOREACH v_key IN ARRAY v_post_close_keys LOOP
      v_old_md := v_old_md - v_key;
      v_new_md := v_new_md - v_key;
    END LOOP;
    IF v_new_md IS DISTINCT FROM v_old_md THEN
      RAISE EXCEPTION
        'CONTEST LIFECYCLE GUARD: contest % is % — its metadata is the result of record; human_eval_selection is the only key that may still change after close.',
        OLD.id, OLD.status;
    END IF;
  END IF;

  -- ---- 6. no result keys while open, except through the close itself -----
  IF OLD.status = 'open' AND NEW.status = 'open'
     AND NEW.metadata IS NOT NULL
     AND (NEW.metadata ? 'final_ranking'
          OR NEW.metadata ? 'closed_at'
          OR NEW.metadata ? 'closed_by') THEN
    RAISE EXCEPTION
      'CONTEST LIFECYCLE GUARD: contest % is open — metadata.final_ranking / closed_at / closed_by are written only by the close transition (status open -> closed in the same update).',
      OLD.id;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.contest_lifecycle_guard() IS
    'Contest lifecycle discipline beneath every client and key (migrations 072 + 074 + 076): identity freeze (id/corpus_id/language_pair/lane/use_context/created_by/created_at; shared_task_id attaches once), one-way open -> closed -> archived, close REQUIRES metadata.final_ranking (object) and forces intake_open=false + server-stamps metadata.closed_at, result immutable after close, metadata.primary_metric checked against the public.rankable_metrics table (076; any registry metric with a ranking block), no result keys at INSERT — PLUS the 074 promise layer: tie_test/alpha/n_resamples/seed/require_description/prize_terms/test_suites/anonymize_until_close/results_visibility/allowed_tracks/open_weight_only/sealed_holdout_set_id/metric_signature/harness_version/declared_power are vocabulary-checked at write time and frozen once the contest has entries (submission, intake, or an authorization request against its sealed sets), and after close human_eval_selection is the only metadata key that may change. prize_terms carries the PRIZE DISPOSITION (founder ruling 2026-09-07, trinary): the execution mode is fixed (entries are handed to the host air-gapped node to be scored), and the participant-facing term is exactly one disposition (pass_to_holders|retain_ip|release_open), from which retention (delete_after_scoring|retain_sealed_audit|retain), rights (participant_retains_all|license_to_host|assignment_to_host), host_use (evaluation_only|non_commercial|any) and release (not_required|required_before_scores|required_before_prize|required_after_prize) are DERIVED. rights and host_use are refused as explicit keys; retention is an override only retain_ip offers (retain_sealed_audit|delete_after_scoring) and release only release_open (required_before_scores|required_before_prize|required_after_prize), release_license is required exactly under release_open, community_terms_url is optional on any disposition, unknown keys are refused, and the retired release_required_before_scores switch and preset key are each named with their replacement. Un-bypassable (service_role does not bypass triggers).';

DROP TRIGGER IF EXISTS contests_lifecycle_guard ON public.contests;
CREATE TRIGGER contests_lifecycle_guard
    BEFORE INSERT OR UPDATE ON public.contests
    FOR EACH ROW
    EXECUTE FUNCTION public.contest_lifecycle_guard();
