#!/usr/bin/env bash
# ssot_parity_gate.sh — CROSS-RUNTIME SSOT PARITY for the shared registries.
#
# Both runtimes (Node CLI + Python harness) carry parity tests that fail when
# their view of shared/*.json (method registry, model aliases, metric
# registry) drifts from the SSOT. Those tests live in the full suites, which
# are too slow for a hook — this gate runs ONLY the parity subset, so registry
# drift is caught at push time instead of at the next full test run.
#
#   JS  (sub-second each):  cli/test/method-registry-ssot.test.js
#                           cli/test/model-aliases-ssot.test.js
#                           cli/test/method-bridge-parity.test.js
#                           cli/test/register-parity.test.js
#   Py  (needs pytest):     arena/tests/test_method_registry_ssot.py
#                           arena/tests/test_metric_registry_ssot.py
#
# DEGRADATION CONTRACT (a pre-push hook must never brick pushing on tooling):
# missing node → warn + allow. Missing pytest/venv → run the JS half, warn
# about the Python half, allow. An actual parity FAILURE is a HARD block —
# that is real drift, and pushing it would ship two runtimes that disagree.
#
# Invoked by .githooks/pre-push after the card-integrity gate.
set -uo pipefail

root="$(git rev-parse --show-toplevel 2>/dev/null)"
if [ -z "$root" ]; then
  echo "ssot-parity: not in a git repo — skipping (push allowed)." >&2
  exit 0
fi

warn_skip() {
  echo "⚠ ssot-parity: $1" >&2
  echo "  → push ALLOWED; SSOT parity NOT verified this push." >&2
}

echo "── ssot parity gate: shared registries vs both runtimes ──" >&2

# ── JS half ────────────────────────────────────────────────────────────────
JS_TESTS=(
  "cli/test/method-registry-ssot.test.js"
  "cli/test/model-aliases-ssot.test.js"
  "cli/test/method-bridge-parity.test.js"
  "cli/test/register-parity.test.js"
  # Bundled-copy drift for ALL shared SSOT (licenses.json + license-corrections
  # especially — license-gate.mjs resolves the bundled cli/shared copy first,
  # Python reads the root SSOT; a stale copy ships two runtimes that classify
  # licenses differently, and no other gate caught it).
  "cli/test/shared-bundle-parity.test.js"
  # cq-v1 connection-quality constants: the JS twin's exports + the tracked
  # website copy must equal shared/connection-quality.json (the one authority
  # for the map/route/leaderboard-ordering math). Python mirror below.
  "cli/test/connection-quality-ssot.test.js"
  # Card-adapter parity: normalizeCard must project the golden fixtures
  # (shared/test-fixtures/card-adapter/) to the committed arbiter, and the
  # website plugin's inline CJS envelope handling must match the reader.
  # Python mirror below — a divergence fails exactly one side, naming the
  # drifted runtime.
  "cli/test/card-adapter-parity.test.js"
  "cli/test/website-card-adapter.test.js"
)
if command -v node >/dev/null 2>&1; then
  js_paths=()
  for t in "${JS_TESTS[@]}"; do
    [ -f "$root/$t" ] && js_paths+=("$root/$t")
  done
  if [ "${#js_paths[@]}" -gt 0 ]; then
    if ! (cd "$root/cli" && node --test "${js_paths[@]}" >/dev/null 2>&1); then
      echo "✗ ssot-parity: the Node CLI disagrees with shared/*.json." >&2
      echo "  Re-run for detail:  cd cli && node --test ${JS_TESTS[*]/#/../}" >&2
      exit 1
    fi
    echo "  ✓ JS parity (${#js_paths[@]} test file(s))" >&2
  else
    warn_skip "JS parity tests not found"
  fi
else
  warn_skip "node not on PATH"
fi

# ── Python half ────────────────────────────────────────────────────────────
PY_TESTS=(
  "arena/tests/test_method_registry_ssot.py"
  "arena/tests/test_metric_registry_ssot.py"
  # cq-v1: the Python twin's constants + its standalone fallback must equal
  # shared/connection-quality.json (JS mirror above).
  "arena/tests/test_connection_quality_ssot.py"
  # Card-adapter parity: normalize_card vs the committed arbiter (JS mirror
  # above).
  "arena/tests/test_card_adapter_parity.py"
)
PYBIN=""
if [ -x "$root/arena/.venv/bin/python" ]; then
  PYBIN="$root/arena/.venv/bin/python"
elif command -v python3 >/dev/null 2>&1 && python3 -c 'import pytest' >/dev/null 2>&1; then
  PYBIN="python3"
fi

if [ -n "$PYBIN" ]; then
  py_paths=()
  for t in "${PY_TESTS[@]}"; do
    [ -f "$root/$t" ] && py_paths+=("$root/$t")
  done
  if [ "${#py_paths[@]}" -gt 0 ]; then
    if ! (cd "$root/arena" && "$PYBIN" -m pytest -q "${py_paths[@]}" >/dev/null 2>&1); then
      echo "✗ ssot-parity: the Python harness disagrees with shared/*.json." >&2
      echo "  Re-run for detail:  cd arena && $PYBIN -m pytest ${PY_TESTS[*]/#/../}" >&2
      exit 1
    fi
    echo "  ✓ Python parity (${#py_paths[@]} test file(s))" >&2
  else
    warn_skip "Python parity tests not found"
  fi
else
  warn_skip "no python with pytest available (arena/.venv or system)"
fi

echo "✓ ssot parity: both runtimes agree with shared/*.json." >&2
exit 0
