-- =============================================================================
-- Migration 040: authorization_audit_log — append-only, hash-chained trail
-- =============================================================================
-- Wave 1 (data backbone) of the zero-knowledge sovereign-eval PoC.
-- Implements the sovereign multisig plan M3 / Part 5 Phase 2: every authorization
-- request, every approve/reject vote, every grant minted, every use of a sealed
-- set — AND every blocked single-party attempt — is recorded in an append-only
-- log that is tamper-evident (each row chains a hash of the prior row; the head
-- digest is publishable) and community-inspectable (anyone may read the full
-- history of what was run against a sealed set).
--
-- This is DISTINCT from the migration-033 content guard: 033 stops corpus
-- content from leaking; this log records the DECISIONS and USES so they cannot
-- be quietly rewritten. Together: what happened is provable; nothing happened
-- unilaterally.
--
-- TAMPER-EVIDENCE (hash chain). A BEFORE INSERT trigger sets:
--     prev_hash = row_hash of the immediately preceding row (genesis = 64 zeros)
--     row_hash  = sha256( prev_hash | event_type | sealed_set_id | request_id |
--                         grant_id | actor | fingerprint | detail::text |
--                         created_at(UTC, microseconds) )
-- using CORE PostgreSQL sha256(bytea) (PG 11+) — no pgcrypto/extension needed.
-- Both hashes are trigger-computed, so a client cannot forge them. Any edit to a
-- stored field would change that row's recomputed row_hash and break linkage in
-- every later row — detectable by replaying the chain. The recipe is documented
-- so an inspector can recompute it from the public rows. A transaction-level
-- advisory lock serializes appends so the chain is strictly linear.
--
-- IMMUTABILITY. A BEFORE UPDATE OR DELETE trigger RAISES (mirrors the
-- migration-033/017 reject-trigger pattern) so the log is strictly append-only
-- beneath every client and key — service_role does NOT bypass triggers.
--
-- CONTENT-FREE. `detail` is structured JSON metadata about a decision/use — it
-- must never carry corpus source/reference text (that is the L3/L4 job). There
-- is no source/reference/expected/plaintext column.
--
-- Idempotent. DEV/STAGING BRANCH ONLY — do NOT apply to production without the
-- founder's explicit go-ahead.
--
-- ROLLBACK:
--   DROP FUNCTION IF EXISTS public.authorization_audit_head();
--   DROP TRIGGER IF EXISTS authorization_audit_log_immutable ON public.authorization_audit_log;
--   DROP FUNCTION IF EXISTS public.reject_audit_log_mutation();
--   DROP TRIGGER IF EXISTS authorization_audit_log_chain ON public.authorization_audit_log;
--   DROP FUNCTION IF EXISTS public.authorization_audit_chain();
--   DROP TABLE IF EXISTS public.authorization_audit_log CASCADE;
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Table: authorization_audit_log
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.authorization_audit_log (
    -- id IS the chain order (monotonic identity). Replaying ORDER BY id asc and
    -- recomputing row_hash reproduces the chain.
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    event_type    TEXT NOT NULL
                  CHECK (event_type IN (
                      'request_created',
                      'vote_cast',
                      'request_authorized',
                      'request_denied',
                      'request_expired',
                      'grant_minted',
                      'grant_used',
                      'grant_expired',
                      'single_party_attempt_blocked'
                  )),

    -- Related entities (all nullable — a global event may reference none)
    sealed_set_id TEXT,
    request_id    TEXT,
    grant_id      TEXT,
    actor         TEXT,                              -- Opaque custodian id / 'platform' / eval-node id (never a public name)
    fingerprint   TEXT,
    detail        JSONB,                             -- Structured, content-free event metadata

    -- Hash chain (trigger-computed; clients cannot forge)
    prev_hash     TEXT NOT NULL,                     -- row_hash of the preceding row (genesis = 64 zeros)
    row_hash      TEXT NOT NULL,                     -- sha256 over (prev_hash | canonical fields) — see header

    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.authorization_audit_log IS
    'Append-only, hash-chained, community-inspectable record of every sealed-set authorization decision and use, AND every blocked single-party attempt (the sovereign multisig plan, M3). prev_hash/row_hash are trigger-computed (core sha256); UPDATE/DELETE are rejected. The head digest (authorization_audit_head) is publishable. Content-free. Wave 1.';

COMMENT ON COLUMN public.authorization_audit_log.row_hash IS
    'sha256( prev_hash | event_type | sealed_set_id | request_id | grant_id | actor | fingerprint | detail::text | created_at[UTC us] ), trigger-computed with core PostgreSQL sha256(bytea). Recomputable from the public row; any silent edit breaks the chain.';

COMMENT ON COLUMN public.authorization_audit_log.detail IS
    'Structured, content-free metadata about the decision/use (e.g. vote tallies, reasons, node measurement). NEVER corpus source/reference text — that is withheld by the L3 publish gate + migration-033 trigger.';

-- ---------------------------------------------------------------------------
-- Indexes — inspectors filter by sealed set / request.
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_auth_audit_set
    ON public.authorization_audit_log (sealed_set_id);

CREATE INDEX IF NOT EXISTS idx_auth_audit_request
    ON public.authorization_audit_log (request_id);

-- ---------------------------------------------------------------------------
-- Hash-chain trigger (BEFORE INSERT). Sets prev_hash from the current head and
-- computes row_hash deterministically. A transaction-level advisory lock
-- serializes concurrent appends so the chain never forks.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.authorization_audit_chain()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_prev    text;
  v_payload text;
BEGIN
  -- Serialize appends (one logical chain). The constant is arbitrary but fixed.
  PERFORM pg_advisory_xact_lock(73960339);

  SELECT a.row_hash INTO v_prev
  FROM public.authorization_audit_log a
  ORDER BY a.id DESC
  LIMIT 1;

  IF v_prev IS NULL THEN
    v_prev := repeat('0', 64);     -- genesis
  END IF;

  NEW.prev_hash := v_prev;

  -- Canonical payload — pipe-joined, NULLs coalesced to empty, created_at
  -- rendered as UTC microseconds. A client-supplied prev_hash/row_hash is
  -- ignored (overwritten here), so the chain cannot be forged on insert.
  v_payload := concat_ws('|',
      v_prev,
      coalesce(NEW.event_type, ''),
      coalesce(NEW.sealed_set_id, ''),
      coalesce(NEW.request_id, ''),
      coalesce(NEW.grant_id, ''),
      coalesce(NEW.actor, ''),
      coalesce(NEW.fingerprint, ''),
      coalesce(NEW.detail::text, ''),
      coalesce(to_char(NEW.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US'), '')
  );

  NEW.row_hash := encode(sha256(convert_to(v_payload, 'UTF8')), 'hex');
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.authorization_audit_chain() IS
    'BEFORE INSERT hash-chain: prev_hash := current head row_hash (genesis 64 zeros); row_hash := core sha256 over (prev_hash | canonical fields). Advisory-locked for a linear chain. Clients cannot forge the hashes. the sovereign multisig plan M3.';

DROP TRIGGER IF EXISTS authorization_audit_log_chain ON public.authorization_audit_log;
CREATE TRIGGER authorization_audit_log_chain
    BEFORE INSERT ON public.authorization_audit_log
    FOR EACH ROW
    EXECUTE FUNCTION public.authorization_audit_chain();

-- ---------------------------------------------------------------------------
-- Immutability trigger (BEFORE UPDATE OR DELETE) — append-only. Mirrors the
-- migration-033 reject-trigger pattern. Un-bypassable (service_role does not
-- bypass triggers).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reject_audit_log_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION
    'AUTH AUDIT LOG is append-only: % on authorization_audit_log (id=%) is rejected — the log is tamper-evident and hash-chained (the sovereign multisig plan, M3).',
    TG_OP, OLD.id;
  RETURN NULL;   -- unreachable; RAISE aborts
END;
$$;

COMMENT ON FUNCTION public.reject_audit_log_mutation() IS
    'Rejects any UPDATE/DELETE on authorization_audit_log — the log is strictly append-only. Mirrors the migration-033/017 reject-trigger pattern; un-bypassable (service_role does not bypass triggers).';

DROP TRIGGER IF EXISTS authorization_audit_log_immutable ON public.authorization_audit_log;
CREATE TRIGGER authorization_audit_log_immutable
    BEFORE UPDATE OR DELETE ON public.authorization_audit_log
    FOR EACH ROW
    EXECUTE FUNCTION public.reject_audit_log_mutation();

-- ---------------------------------------------------------------------------
-- Publishable head digest — the tip of the chain. Anchoring this value (on the
-- public board or an external timestamping service) makes any silent edit or
-- deletion detectable (M3 / Part 7 Q2).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.authorization_audit_head()
RETURNS text
LANGUAGE sql
STABLE
SET search_path = public
AS $$
    SELECT coalesce(
        (SELECT a.row_hash FROM public.authorization_audit_log a ORDER BY a.id DESC LIMIT 1),
        repeat('0', 64)
    );
$$;

COMMENT ON FUNCTION public.authorization_audit_head() IS
    'Returns the current chain head (latest row_hash, or 64 zeros if empty). Publishable/anchorable so silent edits or deletions to the audit log are detectable. the sovereign multisig plan M3.';

-- ---------------------------------------------------------------------------
-- Row-Level Security — community-inspectable. anon may READ the full history;
-- there is NO anon/authenticated write policy (appends go through service_role).
-- UPDATE/DELETE are blocked for everyone by the immutability trigger regardless.
-- ---------------------------------------------------------------------------
ALTER TABLE public.authorization_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS authorization_audit_log_anon_read ON public.authorization_audit_log;
CREATE POLICY authorization_audit_log_anon_read
    ON public.authorization_audit_log
    FOR SELECT
    TO anon, authenticated
    USING (true);

GRANT EXECUTE ON FUNCTION public.authorization_audit_head() TO anon, authenticated, service_role;
