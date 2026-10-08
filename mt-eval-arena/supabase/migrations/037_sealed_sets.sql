-- =============================================================================
-- Migration 037: sealed_sets — the content-free registry of sealed corpora
-- =============================================================================
-- Wave 1 (data backbone) of the zero-knowledge sovereign-eval PoC.
-- Grounds in the sovereign multisig plan (M1 + Part 5 Phase 2/3) and
-- arena/docs/sandbox-evaluation-spec.md. Mirrors the proven migration-033 /
-- migration-022 patterns (data-driven flag + un-bypassable trigger; never a
-- parallel approach).
--
-- WHAT a sealed set is: a corpus a community has chosen to keep held-out, made
-- available for on-demand evaluation WITHOUT ever existing in plaintext on our
-- infrastructure (the sovereign multisig plan, M1). This table stores ONLY the metadata
-- card fields needed to gate and audit a sealed run:
--   - the ciphertext DIGEST (so anyone can verify integrity; the hash is public,
--     the data is not — corpora-card.schema.json secretTest.sha256 precedent);
--   - the custodian-group id (who holds the threshold key shares — M2/M4);
--   - the current public-qualifier id (the public round a method must clear
--     before a sealed run is even proposed);
--   - the language pair + cipher/scheme labels.
--
-- CONTENT-FREE INVARIANT (L1, never-host-content doctrine). This table has NO
-- source / reference / expected / plaintext / content / ciphertext column and
-- never will. It stores a DIGEST of the ciphertext, not the ciphertext, and not
-- one sentence of the corpus. The ciphertext itself lives in a dedicated
-- encrypted object store (M1) — off-git, off-allowlist, off this DB. The only
-- "source"/"target" columns are ISO 639-3 language CODES (the datasets-table
-- convention), not corpus text. arena/tests/test_sovereign_authorization_
-- migrations.py asserts no content column exists.
--
-- QUARANTINE BY DEFAULT (L5, migration 022). A sealed set is `quarantined =
-- true` by default, so migration 022's reject_quarantined_datasets() keeps it
-- off the public leaderboard AS A DATASET even while its SCORES are publishable
-- (the WMT-style "a secret test set exists; here are the scores against it"
-- posture, the sovereign multisig plan M5).
--
-- SOVEREIGNTY (the internal governance doc). custodian_group_id is an opaque group id,
-- never a nation/organization name; no community is named publicly as a key
-- custodian before it has consented ("community key custodians (in
-- confirmation)").
--
-- IDEMPOTENT (CREATE ... IF NOT EXISTS, CREATE OR REPLACE, DROP POLICY IF
-- EXISTS). DEV/STAGING BRANCH ONLY — do NOT apply to the production main project
-- without the founder's explicit go-ahead (CLAUDE.md). Phases 1-4 of the plan
-- touch no prod and no real corpus; real community data enters only at Phase 5,
-- gated on community consent sign-off.
--
-- ROLLBACK:
--   DROP TABLE IF EXISTS public.sealed_sets CASCADE;
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Table: sealed_sets
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sealed_sets (
    -- Identity
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    sealed_set_id       TEXT UNIQUE NOT NULL,        -- Stable public id (kebab-case), e.g. 'sealed-eng-crk-v1'

    -- Integrity (digest only — NEVER the ciphertext, NEVER plaintext)
    ciphertext_digest   TEXT NOT NULL,               -- SHA-256 hex of the encrypted corpus blob (published; data is not)
    cipher              TEXT,                         -- AEAD/cipher scheme label, e.g. 'age-x25519' / 'AES-256-GCM' (metadata)
    key_scheme          TEXT,                         -- Threshold custody label, e.g. 'FROST-3-of-5' (metadata; cf. secretTest.keyScheme)

    -- Custody + qualifier (who controls it; what gates entry)
    custodian_group_id  TEXT NOT NULL,               -- Opaque id of the multisig custodian group (M2/M4). NEVER a public nation/org name.
    current_qualifier_id TEXT,                        -- Public-qualifier round id a method must clear before a sealed run is proposed

    -- Language pair (ISO 639-3 CODES — not corpus content)
    source_lang         TEXT NOT NULL,               -- ISO 639-3 source language code
    target_lang         TEXT NOT NULL,               -- ISO 639-3 target language code
    language_pair       TEXT NOT NULL,               -- e.g. 'eng>crk'
    variety             TEXT,                         -- Script/dialect qualifier (e.g. 'SRO')

    -- Sovereignty / leaderboard floor (L5)
    quarantined         BOOLEAN NOT NULL DEFAULT true, -- Sealed sets default quarantined: never rank AS A DATASET (migration 022)
    quarantine_reason   TEXT DEFAULT 'Sealed sovereign held-out set — never ranks as a dataset; scores publish via the L3/L4 gates.',

    -- Lifecycle
    status              TEXT NOT NULL DEFAULT 'active'  -- Mirrors corpora-card secretTest.status vocabulary
                        CHECK (status IN ('active', 'planned', 'retired')),
    sealed_at           TIMESTAMPTZ,                  -- When the corpus was encrypted at rest (M1)
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.sealed_sets IS
    'Content-free registry of sealed (encrypted-at-rest) sovereign held-out corpora. Stores the ciphertext DIGEST, custodian-group id, public-qualifier id, and language pair only — NEVER source/reference/plaintext. Quarantined by default (migration 022) so it never ranks as a dataset while its scores remain publishable (the sovereign multisig plan, M1/M5). Wave 1.';

COMMENT ON COLUMN public.sealed_sets.ciphertext_digest IS
    'SHA-256 hex of the encrypted corpus blob. PUBLIC (integrity-verifiable); the data is NOT. This is a digest, never the ciphertext and never plaintext — the ciphertext lives in an off-DB encrypted object store (M1).';

COMMENT ON COLUMN public.sealed_sets.custodian_group_id IS
    'Opaque id of the multisig custodian group that holds the threshold key shares (the sovereign multisig plan, M2/M4; Champollion holds zero shares). NEVER a public nation/organization name before consent (the internal governance doc).';

COMMENT ON COLUMN public.sealed_sets.current_qualifier_id IS
    'Id of the current PUBLIC qualifier round a method must clear before a sealed-set run is even proposed (the public-then-sealed posture).';

COMMENT ON COLUMN public.sealed_sets.quarantined IS
    'Sovereignty/L5 floor: true by default so migration 022 keeps a sealed set off the public leaderboard AS A DATASET even while its scores publish (WMT-style secret-test posture).';

-- ---------------------------------------------------------------------------
-- Indexes — per-pair lookup and custody/qualifier joins.
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_sealed_sets_pair
    ON public.sealed_sets (source_lang, target_lang);

CREATE INDEX IF NOT EXISTS idx_sealed_sets_custodian
    ON public.sealed_sets (custodian_group_id);

-- ---------------------------------------------------------------------------
-- Row-Level Security
-- ---------------------------------------------------------------------------
-- The card is content-free, so its metadata (existence, digest, pair, status)
-- is publicly readable — the same "a secret test set exists, here is its hash"
-- posture as corpora-card secretTest. There is NO anon/authenticated WRITE
-- policy: the registry is curator-owned (service_role, which bypasses RLS),
-- exactly like datasets after the migration 024 lockdown.
-- ---------------------------------------------------------------------------
ALTER TABLE public.sealed_sets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sealed_sets_anon_read ON public.sealed_sets;
CREATE POLICY sealed_sets_anon_read
    ON public.sealed_sets
    FOR SELECT
    TO anon, authenticated
    USING (true);
