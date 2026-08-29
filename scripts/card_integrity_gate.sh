#!/usr/bin/env bash
# card_integrity_gate.sh — THE card-integrity gate. Enforces the project's
# "every fact cited" promise at the data layer: a language card may assert
# language PROPERTIES and resource EXISTENCE/CAPABILITY only, each backed by a
# source that actually supports it. Champollion is an INDEX, not an arbiter —
# this gate enforces FAITHFUL REPRESENTATION + SURFACED DISAGREEMENT, never
# "force the card to internally agree."
#
# It runs the four ERROR-severity card-integrity rules (R1–R4) inside the
# existing card linter:
#   R1 no-unsupported-assertion  — no typological claim (tone/case/evidentiality/
#        gender) without a supporting source; tone needs PHOIBLE isTonal===true,
#        never Grambank GB079 ("verb prefixes").
#   R2 value-supported-by-source — a numeric field stamped with an upstream
#        source must match that source's own value (or be labeled
#        champollion-derived). Multi-source disagreement SHOWN is fine.
#   R3 no-run-results-on-cards   — no measured score (chrF/BLEU/COMET/TER, FST
#        acceptance, %-valid) on a language card; those live on the leaderboard.
#   R4 metric-label-match        — no acceptance→"validity" relabel, no
#        "% of words" for a per-entry/per-sentence measurement.
#
# Scope: FULL HYGIENE (--ci) — the exit code keys on EVERY error-severity rule,
# not just the integrity ones.
#
# It used to key on --integrity-ci (the integrity rules alone), so ~16 other
# ERROR-severity rules — has-classification, no-bookkeeping-family,
# filename-matches-code, dataSources-not-empty, nllb/flores-code-valid,
# explainer-coverage, modality-valid, corpora-license-known,
# macrolanguage-members-bijection and the rest — were PRINTED but could never
# block a push. That scoping was a deliberate concession to a backlog of
# pre-existing card errors.
#
# The backlog is gone: measured 2026-08-01, the full linter reports 0 errors
# across 8,678 cards. Widening the exit code therefore costs nothing today and
# stops the next error-severity regression from landing silently. Warnings
# (has-script, card-schema-valid, classification-unresolved) remain non-blocking
# and are tracked by the ratchet in scripts/audit_runner.py --write-baseline.
#
# No GitHub Actions: the project deleted the CI robots and they stay gone. This
# runs locally (chained after scripts/quarantine_gate.sh in .githooks/pre-push)
# and on demand:  bash scripts/card_integrity_gate.sh
#
# Project doctrine. See cli/scripts/card-integrity-rules.mjs.

set -uo pipefail
cd "$(git rev-parse --show-toplevel)"

LINTER="cli/scripts/lint-language-cards.mjs"

if ! command -v node >/dev/null 2>&1; then
  echo "CARD-INTEGRITY GATE ERROR — node not found; refusing to pass blind." >&2
  exit 1
fi
if [[ ! -f "$LINTER" ]]; then
  echo "CARD-INTEGRITY GATE ERROR — $LINTER missing; refusing to pass blind." >&2
  exit 1
fi

# --ci: exit 1 on ANY error-severity rule (integrity rules included).
node "$LINTER" --ci
status=$?

if [[ "$status" -ne 0 ]]; then
  echo
  echo "Blocked. Card lint must report 0 errors (integrity rules included)." >&2
  echo "Fix the GENERATORS and regenerate — never hand-edit thousands of cards." >&2
  echo "Re-run: bash scripts/card_integrity_gate.sh" >&2
  echo "Scope down only if you must: node $LINTER --integrity-ci" >&2
  exit "$status"
fi

echo "card-integrity gate: clean (0 errors — every surfaced fact has a supporting source)."
