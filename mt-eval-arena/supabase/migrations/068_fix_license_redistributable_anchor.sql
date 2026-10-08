-- ---------------------------------------------------------------------------
-- 068: anchor the redistributable-license family match to the START of the
-- license string.
--
-- Migration 033 defined is_license_redistributable() with an unanchored
-- strpos comparison — substring containment — mirroring a Python bug
-- (`low.startswith(p) or p in low`, publish.py) in which the `p in low` arm
-- made the startswith dead weight. Substring containment is a fail-open:
-- 'mit' occurs inside 'li*mit*ed' and 'per*mit*ted', so bespoke restrictive
-- grants such as 'Limited Use License' or 'Usage permitted for research only'
-- classified as redistributable, clearing corpus text for public upload.
--
-- This migration redefines the function with `strpos(low, pref) = 1`
-- (1-based, i.e. an anchored prefix match ≡ Python's startswith). The Python
-- twin was fixed the same day; parity is pinned by
-- arena/tests/test_content_guard_migration.py, whose battery now includes the
-- adversarial 'limited'/'permitted' shapes.
--
-- Never edit 033 — forward migration only. Everything except the one
-- comparison (and the comment above it) is byte-identical to 033's definition.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION is_license_redistributable(license_str text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  low    text;
  toks   text;   -- non-alphanumeric runs -> single spaces, space-padded (token test)
  sub    text;
  pref   text;
BEGIN
  IF license_str IS NULL OR btrim(license_str) = '' THEN
    RETURN false;
  END IF;
  low := lower(btrim(license_str));

  -- (1) NC / ND / proprietary / restricted substrings -> never redistributable.
  FOREACH sub IN ARRAY ARRAY[
    'noncommercial', 'non-commercial', 'noderiv', 'no-deriv',
    'noderivatives', 'proprietary', 'restricted', 'wolvengrey',
    'all rights reserved'
  ] LOOP
    IF strpos(low, sub) > 0 THEN
      RETURN false;
    END IF;
  END LOOP;

  -- (2) Standalone 'nc' / 'nd' tokens (Python: split on [^a-z0-9]+).
  toks := ' ' || regexp_replace(low, '[^a-z0-9]+', ' ', 'g') || ' ';
  IF strpos(toks, ' nc ') > 0 OR strpos(toks, ' nd ') > 0 THEN
    RETURN false;
  END IF;

  -- (3) Cleared only when the string STARTS WITH a redistributable license
  --     family (anchored: strpos = 1, ≡ Python startswith — a mid-string hit
  --     like 'li*mit*ed' must NOT clear).
  FOREACH pref IN ARRAY ARRAY[
    'cc-by', 'cc0', 'cc-zero', 'public domain', 'publicdomain', 'pd-',
    'mit', 'apache', 'bsd', 'odc-by', 'odbl', 'gpl', 'lgpl', 'mpl',
    'unlicense', 'the unlicense'
  ] LOOP
    IF strpos(low, pref) = 1 THEN
      RETURN true;
    END IF;
  END LOOP;

  RETURN false;
END;
$$;

COMMENT ON FUNCTION is_license_redistributable(text) IS
  'True only when a corpus license is cleared for public redistribution. Anchored prefix match (068; 033 used substring containment — fail-open on e.g. "Limited"). Mirrors mt_eval_harness/publish.py _license_is_redistributable (parity pinned by tests/test_content_guard_migration.py). NULL/empty/NC/ND/proprietary/restricted -> false.';
