-- ---------------------------------------------------------------------------
-- 069: trading_card_vocabulary — the vocabulary explorer's own table.
--
-- Vocabulary was 70–95% of every trading_card_detail.detail blob (san: 2.4MB
-- of a 2.5MB payload; the full detail staging was ~500MB and uploads ran at
-- 50-row batches because of statement timeouts). Splitting it out shrinks the
-- detail blobs ~75% and lets the site lazy-fetch forms per code when the
-- vocabulary panel opens — "no truncation, every item accessible" preserved.
--
-- Provenance upgrade over the legacy lane: items[] entries carry the PINNED
-- release id (e.g. "ids-v4.3") from the atlas cldf_forms sidecar, where the
-- legacy store's 3.1M lexical rows had NULL release pins. Only forms whose
-- pinned license permits redistribution are ever staged (the ingest withholds
-- the rest at the source), and sources[] carries the license alongside.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS trading_card_vocabulary (
    code        TEXT PRIMARY KEY REFERENCES trading_card_index(code) ON DELETE CASCADE,
    items       JSONB NOT NULL,       -- [{concept, gloss, form, source, displayType, ...}]
    total_forms INTEGER NOT NULL,
    sources     JSONB NOT NULL,       -- [{id, dataset, license, url, displayType, ...}]
    asjp_only   BOOLEAN NOT NULL DEFAULT false,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Same read model as the other trading-card tables: anon reads, service_role
-- writes (no anon policy for INSERT/UPDATE/DELETE means RLS denies them).
ALTER TABLE trading_card_vocabulary ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anonymous read access on trading_card_vocabulary"
    ON trading_card_vocabulary
    FOR SELECT
    TO anon
    USING (true);
