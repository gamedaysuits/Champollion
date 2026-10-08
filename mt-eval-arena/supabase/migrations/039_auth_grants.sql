-- =============================================================================
-- Migration 039: auth_grants — single-use, time-boxed, target-bound grants
-- =============================================================================
-- Wave 1 (data backbone) of the zero-knowledge sovereign-eval PoC.
-- Implements the DATA half of the sovereign multisig plan M2 step 3: when M-of-N
-- custodians approve a request, their shares jointly mint a grant that (a)
-- EXPIRES after a short window, (b) authorizes exactly ONE evaluation batch
-- (single-use), and (c) is BOUND to the specific request fingerprint. The real
-- threshold signing that produces the grant is Wave 2; this migration provides
-- the data-layer guarantees that make those three properties enforceable
-- beneath every client and key:
--
--   1. TARGET-BOUND. A grant can only be inserted for an AUTHORIZED request, and
--      its fingerprint + sealed_set_id MUST equal that request's (the
--      auth_grant_bind_check trigger). A grant minted for one request cannot be
--      pointed at another, and a grant cannot exist for a pending/denied
--      request. This is the data-layer expression of "no grant without M-of-N
--      approval" — there is simply no row a single party can write that the
--      trigger will accept unless the request is already authorized.
--   2. SINGLE-USE. claim_auth_grant() flips used false->true ATOMICALLY in the
--      same UPDATE that checks used=false; a second claim of the same grant
--      matches no row and returns nothing. The bind trigger also forbids
--      un-using a grant (true->false) and freezes its terms.
--   3. TIME-BOXED. expires_at is required and must be in the future at mint
--      time (CHECK + trigger); claim_auth_grant() refuses an expired grant.
--
-- CONTENT-FREE. No source/reference/expected/plaintext column — a grant is a
-- capability, not corpus data.
--
-- Mirrors migration-033/022 idempotent + trigger style. DEV/STAGING BRANCH ONLY
-- — do NOT apply to production without the founder's explicit go-ahead.
--
-- ROLLBACK:
--   DROP FUNCTION IF EXISTS public.claim_auth_grant(text, text, text);
--   DROP FUNCTION IF EXISTS public.auth_grant_is_valid(text, text);
--   DROP TRIGGER IF EXISTS auth_grants_bind_guard ON public.auth_grants;
--   DROP FUNCTION IF EXISTS public.auth_grant_bind_check();
--   DROP TABLE IF EXISTS public.auth_grants CASCADE;
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Table: auth_grants
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.auth_grants (
    -- Identity
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    grant_id        TEXT UNIQUE NOT NULL,            -- Stable single-use credential id

    -- What it authorizes (FKs to the request + the sealed set)
    request_id      TEXT NOT NULL
                    REFERENCES public.authorization_requests (request_id),
    sealed_set_id   TEXT NOT NULL
                    REFERENCES public.sealed_sets (sealed_set_id),
    fingerprint     TEXT NOT NULL,                   -- MUST equal the request's fingerprint (target-bound; enforced by trigger)

    -- Single-use + time-box
    expires_at      TIMESTAMPTZ NOT NULL,            -- Time-boxed: claim refused at/after this instant
    used            BOOLEAN NOT NULL DEFAULT false,  -- Single-use: flipped true atomically by claim_auth_grant
    used_at         TIMESTAMPTZ,                     -- When it was consumed
    used_by         TEXT,                            -- Which eval node consumed it (the attested context)

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- A grant must be born with a future expiry (defense in depth with the
    -- trigger, which also blocks now()-relative expiry at mint time).
    CONSTRAINT auth_grants_expiry_future CHECK (expires_at > created_at),
    -- used_at is set iff used.
    CONSTRAINT auth_grants_used_consistency CHECK (used = (used_at IS NOT NULL))
);

COMMENT ON TABLE public.auth_grants IS
    'Single-use, time-boxed, fingerprint-bound decryption/evaluation grants minted only for an AUTHORIZED request (the sovereign multisig plan, M2 step 3). Consumed atomically via claim_auth_grant(); a second use, an expired grant, or a fingerprint mismatch is refused at the data layer. Content-free. Wave 1.';

COMMENT ON COLUMN public.auth_grants.fingerprint IS
    'Target binding: must equal authorization_requests.fingerprint for request_id (enforced by auth_grant_bind_check). A grant authorizes exactly one (method, sealed corpus version, node) — never replayable elsewhere.';

COMMENT ON COLUMN public.auth_grants.used IS
    'Single-use flag. claim_auth_grant flips it false->true atomically while asserting used=false; the bind trigger forbids true->false. A consumed grant can never be re-used.';

-- ---------------------------------------------------------------------------
-- Index — claim looks up by grant_id (already UNIQUE); inspectors filter by
-- request and validity.
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_auth_grants_request
    ON public.auth_grants (request_id);

CREATE INDEX IF NOT EXISTS idx_auth_grants_open
    ON public.auth_grants (sealed_set_id) WHERE used = false;

-- ---------------------------------------------------------------------------
-- Bind / immutability guard. On INSERT: the referenced request must exist, be
-- AUTHORIZED, and the grant's fingerprint + sealed_set_id must match it; expiry
-- must be in the future. On UPDATE: the terms are frozen and a grant can only
-- go used false->true. Un-bypassable (service_role does not bypass triggers).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.auth_grant_bind_check()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  r_state        text;
  r_fingerprint  text;
  r_sealed       text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT ar.state, ar.fingerprint, ar.sealed_set_id
      INTO r_state, r_fingerprint, r_sealed
    FROM public.authorization_requests ar
    WHERE ar.request_id = NEW.request_id;

    IF r_state IS NULL THEN
      RAISE EXCEPTION
        'AUTH GRANT GUARD: no authorization request % — a grant cannot be minted for a non-existent request.',
        NEW.request_id;
    END IF;
    -- No grant without M-of-N approval: the request must already be authorized.
    IF r_state <> 'authorized' THEN
      RAISE EXCEPTION
        'AUTH GRANT GUARD: request % is ''%'' (not authorized) — no grant may be minted until M-of-N custodians authorize it.',
        NEW.request_id, r_state;
    END IF;
    -- Target binding: fingerprint + sealed set must match the request exactly.
    IF NEW.fingerprint IS DISTINCT FROM r_fingerprint THEN
      RAISE EXCEPTION
        'AUTH GRANT GUARD: grant fingerprint does not match request % fingerprint — a grant is bound to exactly one request fingerprint.',
        NEW.request_id;
    END IF;
    IF NEW.sealed_set_id IS DISTINCT FROM r_sealed THEN
      RAISE EXCEPTION
        'AUTH GRANT GUARD: grant sealed_set_id % does not match request % sealed_set_id %.',
        NEW.sealed_set_id, NEW.request_id, r_sealed;
    END IF;
    -- Time-box must be in the future at mint time.
    IF NEW.expires_at <= NOW() THEN
      RAISE EXCEPTION
        'AUTH GRANT GUARD: grant for request % is born expired (expires_at % <= now) — grants must be time-boxed into the future.',
        NEW.request_id, NEW.expires_at;
    END IF;
    -- A freshly minted grant is unused.
    IF NEW.used THEN
      RAISE EXCEPTION
        'AUTH GRANT GUARD: a grant must be minted unused (used=false); claim it via claim_auth_grant.';
    END IF;
    RETURN NEW;
  END IF;

  -- TG_OP = 'UPDATE': terms are frozen; only single-use consumption is allowed.
  IF NEW.grant_id IS DISTINCT FROM OLD.grant_id
     OR NEW.request_id    IS DISTINCT FROM OLD.request_id
     OR NEW.sealed_set_id IS DISTINCT FROM OLD.sealed_set_id
     OR NEW.fingerprint   IS DISTINCT FROM OLD.fingerprint
     OR NEW.expires_at    IS DISTINCT FROM OLD.expires_at
     OR NEW.created_at    IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION
      'AUTH GRANT GUARD: grant % terms are immutable (id/request/sealed_set/fingerprint/expires_at/created_at cannot change).',
      OLD.grant_id;
  END IF;
  -- Single-use is one-way: a consumed grant can never be un-used.
  IF OLD.used AND NOT NEW.used THEN
    RAISE EXCEPTION
      'AUTH GRANT GUARD: grant % is already used — it cannot be reset to unused (single-use).',
      OLD.grant_id;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.auth_grant_bind_check() IS
    'Binds a grant to an AUTHORIZED request (matching fingerprint + sealed_set, future expiry, born-unused) and freezes its terms / forbids un-using it. The data-layer expression of "no grant without M-of-N approval, bound to one fingerprint, single-use" (the sovereign multisig plan, M2).';

DROP TRIGGER IF EXISTS auth_grants_bind_guard ON public.auth_grants;
CREATE TRIGGER auth_grants_bind_guard
    BEFORE INSERT OR UPDATE ON public.auth_grants
    FOR EACH ROW
    EXECUTE FUNCTION public.auth_grant_bind_check();

-- ---------------------------------------------------------------------------
-- claim_auth_grant — the atomic single-use consume. Returns the grant's target
-- iff it is currently unused, unexpired, AND its fingerprint matches what the
-- caller presents (the fingerprint the eval context recomputed for THIS run).
-- A second call, an expired grant, or a mismatched fingerprint returns no row.
--
-- SECURITY DEFINER so the trusted controlled-eval context (service_role) can
-- consume a grant under RLS; EXECUTE is granted to service_role ONLY — the
-- public web roles can never claim a grant.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.claim_auth_grant(
    p_grant_id    text,
    p_fingerprint text,
    p_node        text
)
RETURNS TABLE (grant_id text, sealed_set_id text, request_id text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    UPDATE public.auth_grants g
       SET used    = true,
           used_at = NOW(),
           used_by = p_node
     WHERE g.grant_id    = p_grant_id
       AND g.used        = false
       AND g.expires_at  > NOW()
       AND g.fingerprint = p_fingerprint
    RETURNING g.grant_id, g.sealed_set_id, g.request_id;
$$;

COMMENT ON FUNCTION public.claim_auth_grant(text, text, text) IS
    'Atomic single-use consume of a grant: flips used false->true while asserting unused + unexpired + fingerprint-match in one UPDATE. Returns the bound target iff valid; a second call / expired / mismatched fingerprint returns no row. service_role only.';

-- Read-side validity probe (no mutation) for inspection / the controlled
-- context to pre-check before claiming.
CREATE OR REPLACE FUNCTION public.auth_grant_is_valid(
    p_grant_id    text,
    p_fingerprint text
)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.auth_grants g
        WHERE g.grant_id    = p_grant_id
          AND g.used        = false
          AND g.expires_at  > NOW()
          AND g.fingerprint = p_fingerprint
    );
$$;

COMMENT ON FUNCTION public.auth_grant_is_valid(text, text) IS
    'True iff the named grant is currently unused, unexpired, and fingerprint-matching. Read-only probe mirroring claim_auth_grant''s WHERE clause. service_role only.';

-- ---------------------------------------------------------------------------
-- Row-Level Security
-- ---------------------------------------------------------------------------
-- A grant is a CAPABILITY, not inspectable history — there is NO anon/
-- authenticated read or write policy. The public sees grants only through the
-- tamper-evident audit log (migration 040: grant_minted / grant_used events).
-- service_role (the controlled eval context) bypasses RLS to mint via the bind
-- trigger and to consume via claim_auth_grant.
-- ---------------------------------------------------------------------------
ALTER TABLE public.auth_grants ENABLE ROW LEVEL SECURITY;

-- EXECUTE only for service_role — the public web roles can never claim or probe
-- a grant.
REVOKE ALL ON FUNCTION public.claim_auth_grant(text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.auth_grant_is_valid(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_auth_grant(text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.auth_grant_is_valid(text, text) TO service_role;
