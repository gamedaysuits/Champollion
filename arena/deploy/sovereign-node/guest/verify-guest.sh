#!/usr/bin/env bash
# Guest acceptance checks. Every line is an assertion; the first failure exits
# non-zero with the failing check named. --role organizer|airgap selects the
# role-specific checks. --json writes a machine-readable result.
set -uo pipefail
ROLE=""; JSON_OUT=""
while [ $# -gt 0 ]; do case "$1" in
  --role) ROLE="$2"; shift 2;; --json) JSON_OUT="$2"; shift 2;; *) echo "unknown arg $1" >&2; exit 2;; esac; done
[ -n "$ROLE" ] || { echo "usage: verify-guest.sh --role organizer|airgap [--json FILE]" >&2; exit 2; }
VENV="${HOME}/.venvs/mt-eval"
export PATH="${VENV}/bin:${HOME}/.local/node/bin:${PATH}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=../versions.env
source "${HERE}/../versions.env"

declare -a RESULTS=()
FAILED=0
check() {  # name, command...
  local name="$1"; shift
  local out; out="$("$@" 2>&1)"; local rc=$?
  if [ $rc -eq 0 ]; then printf '  ✓ %s\n' "$name"; RESULTS+=("{\"check\":\"$name\",\"ok\":true}")
  else printf '  ✗ %s\n      %s\n' "$name" "$(printf '%s' "$out" | tail -3 | tr '\n' ' ')"; RESULTS+=("{\"check\":\"$name\",\"ok\":false}"); FAILED=1; fi
}
expect_fail() {  # name, must_match_regex, command... (must exit non-zero AND the failure must be the RIGHT one)
  local name="$1" must="$2"; shift 2
  local out; out="$("$@" 2>&1)"; local rc=$?
  if [ $rc -eq 0 ]; then printf '  ✗ %s (unexpectedly succeeded)\n' "$name"; RESULTS+=("{\"check\":\"$name\",\"ok\":false}"); FAILED=1
  elif ! printf '%s' "$out" | grep -qE "$must"; then
    # A failure for the WRONG reason (e.g. docker itself unusable) must not
    # pass as "no egress" — that would make a broken daemon look air-gapped.
    printf '  ✗ %s (failed for the wrong reason: %s)\n' "$name" "$(printf '%s' "$out" | tail -1 | cut -c1-120)"
    RESULTS+=("{\"check\":\"$name\",\"ok\":false}"); FAILED=1
  else printf '  ✓ %s\n' "$name"; RESULTS+=("{\"check\":\"$name\",\"ok\":true}"); fi
}

echo "verify-guest (${ROLE}) on $(hostname)"
check "docker daemon answers" docker info --format '{{.ServerVersion}}'
check "hardened --network=none container runs" docker run --rm --network=none --read-only \
  --cap-drop ALL --security-opt no-new-privileges -e HOME=/tmp "${PYTHON_BASE_IMAGE}" python3 -c 'print("ok")'
# The refusal must come from INSIDE the container (a socket error raised by
# Python), never from docker being unusable on the host.
expect_fail "--network=none container has no egress" 'OSError|TimeoutError|ConnectionRefused|Network is unreachable|Errno' \
  docker run --rm --network=none "${PYTHON_BASE_IMAGE}" \
  python3 -c "import socket; socket.create_connection(('1.1.1.1',443),2)"
check "venv python present" "${VENV}/bin/python" -c 'import sys; assert sys.version_info >= (3,11), sys.version'
if [ "$ROLE" = "organizer" ]; then
  check "mt-eval on PATH" mt-eval --help
  check "cryptography importable" "${VENV}/bin/python" -c 'import cryptography'
  check "node >= 20.11" node -e 'const [a,b]=process.versions.node.split(".").map(Number); if(a<20||(a===20&&b<11)) process.exit(1)'
  check "supabase CLI present" supabase --version
  check "cli seal-corpus usage (no npm install needed)" bash -c "node ~/src/champollion/cli/bin/cli.js seal-corpus 2>&1 | grep -qi usage"
  check "egress-check runs (connected: expects NOT air-gapped)" bash -c "mt-eval node egress-check --json | python3 -c 'import json,sys; d=json.load(sys.stdin); assert d[\"airgapped\"] is False, d'"
else
  # The node's harness arrives via the offline bundle; before it lands only the
  # base checks apply. After `pip install --no-index`, re-run with the bundle
  # installed and these must pass too.
  if [ -x "${VENV}/bin/mt-eval" ]; then
    check "mt-eval installed from the offline bundle" mt-eval --help
    check "cryptography importable" "${VENV}/bin/python" -c 'import cryptography'
  else
    echo "  · mt-eval not yet installed on the node (expected before the bundle arrives)"
  fi
fi

if [ -n "$JSON_OUT" ]; then
  printf '{"role":"%s","host":"%s","failed":%s,"checks":[%s]}\n' "$ROLE" "$(hostname)" "$FAILED" "$(IFS=,; echo "${RESULTS[*]}")" > "$JSON_OUT"
fi
[ $FAILED -eq 0 ] && echo "verify-guest: ALL PASSED" || { echo "verify-guest: FAILED" >&2; exit 1; }
