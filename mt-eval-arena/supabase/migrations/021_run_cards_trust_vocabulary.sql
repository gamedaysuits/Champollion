-- Migration 021 — run_cards trust vocabulary alignment (prod parity)
--
-- Production predates the trust-vocabulary rename and still enforces
-- CHECK (trust IN ('self-benchmarked','gds-verified','community-validated')),
-- while the harness, the RLS policies (019: WITH CHECK trust='unverified'),
-- and staging all use ('unverified','verified','disqualified'). Every
-- harness publish to prod therefore 400s on run_cards_trust_check
-- (observed 2026-06-12, first prod publish attempt).
--
-- Maps the legacy rows (5 pre-flip cards on prod), then swaps the CHECK.
-- Idempotent: the UPDATE matches nothing on re-run; the constraint is
-- dropped IF EXISTS and recreated with the target definition. Safe on
-- staging (already the target vocabulary — UPDATE no-ops, CHECK identical).

-- Drop the legacy CHECK *before* remapping — the legacy constraint would
-- otherwise reject the UPDATE that writes the new vocabulary.
ALTER TABLE run_cards DROP CONSTRAINT IF EXISTS run_cards_trust_check;

UPDATE run_cards
SET trust = CASE trust
    WHEN 'self-benchmarked'    THEN 'unverified'
    WHEN 'gds-verified'        THEN 'verified'
    WHEN 'community-validated' THEN 'verified'
    ELSE trust
END
WHERE trust IN ('self-benchmarked', 'gds-verified', 'community-validated');

ALTER TABLE run_cards ADD CONSTRAINT run_cards_trust_check
    CHECK (trust = ANY (ARRAY['unverified'::text, 'verified'::text, 'disqualified'::text]));
