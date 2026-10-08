-- Migration 008: Create contests and contest_submissions tables.
--
-- WHY: The Arena README advertises contest infrastructure for structured
-- evaluation challenges. This migration creates the backing tables.
--
-- DESIGN:
--   contests: Named evaluation challenges scoped to a corpus + language pair.
--     Visibility modes control who can see/submit:
--       - public: anyone can see and submit
--       - private: visible to all, submissions hidden except to creator
--       - team: only listed teams can see and submit
--
--   contest_submissions: Links a run_card to a contest. One run can be
--     submitted to multiple contests. One contest can have many submissions.
--
-- PRIVACY MODEL (per user directive):
--   Private contests are VISIBLE (anyone can see they exist) but
--   submissions are HIDDEN (only the contest creator sees all scores).
--   Individual submitters can see their own submissions.

CREATE TABLE IF NOT EXISTS contests (
  id TEXT PRIMARY KEY,                          -- slug, e.g. "en-crk-open-2026"
  name TEXT NOT NULL,                           -- display name
  description TEXT DEFAULT '',

  -- Scoping
  corpus_id TEXT NOT NULL,                      -- which dataset to evaluate against
  language_pair TEXT NOT NULL,                   -- e.g. "en>crk"

  -- Access control
  visibility TEXT NOT NULL DEFAULT 'public'
    CHECK (visibility IN ('public', 'private', 'team')),
  teams TEXT[] DEFAULT '{}',                    -- team slugs (for team-scoped mode)

  -- Ownership
  created_by TEXT NOT NULL,                     -- submitter email (from OAuth)
  created_at TIMESTAMPTZ DEFAULT now(),

  -- Lifecycle
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'closed', 'archived')),

  -- Extensible metadata (prizes, rules, external links, etc.)
  metadata JSONB DEFAULT '{}'
);

-- Contest submissions: links a run_card to a contest
CREATE TABLE IF NOT EXISTS contest_submissions (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

  contest_id TEXT NOT NULL REFERENCES contests(id) ON DELETE CASCADE,
  run_card_id TEXT NOT NULL REFERENCES run_cards(id) ON DELETE CASCADE,

  -- Attribution
  submitted_by TEXT NOT NULL,                   -- submitter email (from OAuth)
  submitted_at TIMESTAMPTZ DEFAULT now(),
  team TEXT,                                    -- optional team attribution
  notes TEXT DEFAULT '',

  -- One submission per run per contest
  UNIQUE(contest_id, run_card_id)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_contests_status ON contests(status);
CREATE INDEX IF NOT EXISTS idx_contests_language_pair ON contests(language_pair);
CREATE INDEX IF NOT EXISTS idx_cs_contest ON contest_submissions(contest_id);
CREATE INDEX IF NOT EXISTS idx_cs_run_card ON contest_submissions(run_card_id);

-- ============================================================================
-- Row-Level Security
-- ============================================================================

ALTER TABLE contests ENABLE ROW LEVEL SECURITY;
ALTER TABLE contest_submissions ENABLE ROW LEVEL SECURITY;

-- Contests: public and private are visible to everyone.
-- Team-scoped contests require authentication (team membership
-- is checked in the Python layer until JWT claims include teams).
CREATE POLICY "Read public and private contests" ON contests
  FOR SELECT USING (
    visibility IN ('public', 'private')
    OR auth.uid() IS NOT NULL  -- team-scoped: must be logged in
  );

CREATE POLICY "Authenticated create contests" ON contests
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Owner update contests" ON contests
  FOR UPDATE USING (
    created_by = current_setting('request.jwt.claims', true)::json->>'email'
  );

-- Contest submissions: public contest submissions are visible to all.
-- Private contest submissions are visible only to the submitter or
-- the contest creator. This is the key privacy guarantee.
CREATE POLICY "Read own or public submissions" ON contest_submissions
  FOR SELECT USING (
    -- Public contests: everyone sees everything
    EXISTS (
      SELECT 1 FROM contests c
      WHERE c.id = contest_submissions.contest_id
        AND c.visibility = 'public'
    )
    -- Private/team contests: see only your own submissions
    OR submitted_by = current_setting('request.jwt.claims', true)::json->>'email'
    -- Contest creator sees all submissions
    OR EXISTS (
      SELECT 1 FROM contests c
      WHERE c.id = contest_submissions.contest_id
        AND c.created_by = current_setting('request.jwt.claims', true)::json->>'email'
    )
  );

CREATE POLICY "Authenticated submit" ON contest_submissions
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
