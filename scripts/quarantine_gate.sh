#!/usr/bin/env bash
# quarantine_gate.sh — THE sovereignty gate. One blunt instrument, applied to
# the WHOLE repo. No mirrors, no history filters, no per-subtree special cases.
#
# RULE (data-boundaries doctrine): corpus CONTENT
# is NEVER tracked in git — translation pairs, parallel source-target text,
# reference answers, eval gold. ANY license (CC-BY, CC0, public-domain and
# proprietary alike), ANYWHERE in the tree (cli/ arena/ mt-eval-arena/ shared/
# everywhere. Corpora are fetch-from-source from
# their third-party hosts; only metadata cards + builder scripts live here.
#
# This is a deliberate widening: the old gate scanned only a four-directory
# subset and only blocked NC/named-restricted content — which is exactly how 44
# The new rule is license-agnostic and whole-tree.
#
# Three checks, all whole-tree:
#   1. CONTENT     — any tracked corpus-shaped file (pairs / parallel text /
#                    eval gold), via scripts/corpus_content_scan.py (the SSOT
#                    detector; carries the narrow synthetic-fixture allowlist).
#   2. NAMED       — any tracked data file NAMED like a restricted corpus,
#                    outside the metadata-card lane (catches non-pair-shaped
#                    dumps the content detector can't parse).
#   3. HARVEST     — the Wolvengrey/itwêwina dictionary harvest (highest-risk
#                    no-redistribute asset), anywhere.
#
# Project doctrine.

set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

SCAN="scripts/corpus_content_scan.py"
NAME_PATTERN_FILE="scripts/restricted_name_pattern.txt"

# The NAMED pattern is DERIVED from the registry's corpus families plus the
# curated crk-family terms — see scripts/gen_restricted_name_pattern.py. It used
# to be this hand-written crk-only list, which could not see any of the 32
# families the registry actually carries (flores, wmt14..wmt25, nusatranslation,
# americasnlp2021, gamayun, mafand, tico19 …). A hand-maintained blocklist falls
# behind the data it guards and never says so.
#
# The fallback below is that original curated list: if the generated file is
# missing we still enforce the crk-family terms rather than passing blind. It is
# strictly weaker, so we say so out loud.
NAME_PATTERN_FALLBACK='edtekla|wolvengrey|itwewina|raw_harvest|gold_standard|held[_-]?out|crk-master|textbook_dev|eng-crk-dev'
if [[ -f "$NAME_PATTERN_FILE" ]]; then
  NAME_PATTERN="$(grep -v '^#' "$NAME_PATTERN_FILE" | grep -v '^[[:space:]]*$' | head -1)"
fi
if [[ -z "${NAME_PATTERN:-}" ]]; then
  echo "SOVEREIGNTY GATE WARNING — $NAME_PATTERN_FILE missing or empty;"
  echo "  falling back to the curated crk-family terms only (registry families NOT covered)."
  echo "  Regenerate: python3 scripts/gen_restricted_name_pattern.py"
  NAME_PATTERN="$NAME_PATTERN_FALLBACK"
fi
# Data / interchange / compressed extensions a restricted-named dump could wear.
# (Widened past json/jsonl/tsv/csv/txt to the formats a corpus actually ships as
# — TMX/XML, gettext PO, YAML, .tab, and columnar/compressed blobs — so a
# restricted-NAMED file the content detector can't parse is still caught here.)
NAME_EXTS='json|jsonl|ndjson|tsv|csv|tab|txt|tmx|xml|po|pot|ya?ml|parquet|arrow|feather|xlsx|ods|gz|bz2|zst|xz|zip'
# Lanes that legitimately NAME a corpus without carrying its content: metadata
# cards, schemas, and the detector's own synthetic test fixtures. ANCHORED to
# their real locations (^prefix) — the old unanchored substrings ("language-cards/"
# anywhere) let a fabricated "evil/language-cards/edtekla_dev.tsv" path inherit the
# exemption. Fail-closed if a lane relocates: better to over-flag a moved legit dir
# than silently exempt a smuggled file.
#
# corpora-builder recipes are the same category as a corpora card: build
# configuration that NAMES a corpus (fetch URL, code mapping, provenance notes)
# and carries none of its content — verified, the content detector flags none
# of the 9. Without this lane the derived pattern could not use 9 of the 32
# registry family names at all, since each has a recipe file named after it.
# The CONTENT detector still scans them; only the filename backstop exempts.
NAME_EXEMPT='^cli/shared/corpora-cards/|^cli/shared/language-cards/|^(cli/)?shared/schemas/|^scripts/tests/fixtures/|^arena/scripts/corpora-builder/corpora_builder/recipes/|^research/w2-irt/results/'
viol=0

# 1. CONTENT — blanket, license-agnostic, whole-tree. Delegates to the one
#    detector so "what is corpus content" + "what is an allowed fixture" have a
#    single definition shared with the launch report.
if [[ -f "$SCAN" ]]; then
  # 1a. The detector's OWN tests run first. They existed but had no runner
  #     anywhere in the tree — no pytest.ini, no gate, no workflow referenced
  #     them — so a regression in the one component that decides "what is
  #     corpus content" would not have been caught by anything. A scanner whose
  #     correctness is unverified is the same posture as a missing scanner, so
  #     this refuses to pass blind for the same reason the block below does.
  #     Two guards. The tests spawn this gate inside throwaway git repos to
  #     assert end-to-end behaviour, so (a) the self-test step must not recurse
  #     into itself, and (b) it must no-op when the test file is absent, which
  #     is exactly the case inside those temp repos.
  SELFTEST="scripts/tests/test_corpus_content_scan.py"
  if [[ -f "$SELFTEST" && -z "${QUARANTINE_GATE_SELFTEST_RUNNING:-}" ]]; then
    if python3 -c 'import pytest' >/dev/null 2>&1; then
      if ! QUARANTINE_GATE_SELFTEST_RUNNING=1 \
           python3 -m pytest "$SELFTEST" -q >/dev/null 2>&1; then
        echo "SOVEREIGNTY GATE ERROR — the corpus-content detector's own tests FAIL;"
        echo "  refusing to trust it. Run: python3 -m pytest $SELFTEST"
        exit 1
      fi
    else
      echo "SOVEREIGNTY GATE WARNING — pytest not installed; detector self-tests skipped."
    fi
  fi
  if ! python3 "$SCAN"; then
    viol=1
  fi
else
  echo "SOVEREIGNTY GATE ERROR — $SCAN missing; refusing to pass blind."
  exit 1
fi

# 2. NAMED — no tracked data file may be NAMED like a restricted corpus,
#    anywhere, outside the exempt lanes (any license).
# Extension and name are matched as SEPARATE passes, not as one
# "(pattern).*\.(ext)$" expression. The derived pattern carries word boundaries
# so a term cannot match inside a longer word ('alt' inside "default.json"), and
# a trailing boundary would otherwise consume the very dot the extension part
# needs — "raw_harvest.json" would stop matching. POSIX ERE has no lookahead
# (grep -E), so splitting the passes is how both properties hold at once.
hits="$(git ls-files \
        | grep -iE "\.(${NAME_EXTS})$" \
        | grep -iE "${NAME_PATTERN}" \
        | grep -vE "$NAME_EXEMPT" || true)"
if [[ -n "$hits" ]]; then
  echo
  echo "SOVEREIGNTY VIOLATION — restricted-corpus-named tracked files:"
  echo "$hits"
  viol=1
fi

# 3. HARVEST — the Wolvengrey/itwêwina dictionary harvest must never be tracked
#    ANYWHERE (whole-tree, defense in depth).
harvest="$(git ls-files | grep -iE '(raw_harvest|lemmas)\.json$' \
           | grep -iE 'dictionary|wolvengrey|itwewina|eval_standards' || true)"
if [[ -n "$harvest" ]]; then
  echo
  echo "SOVEREIGNTY VIOLATION — Wolvengrey/itwêwina dictionary harvest is tracked:"
  echo "$harvest"
  viol=1
fi

# 4. LOCAL-ASSETS — local-assets/ is the third-party language-asset fetch
#    cache (SIL grammars/wordlists/primers, scripture translations — mixed
#    copyright, some no-redistribute). Doctrine: fetch-from-source, local
#    working copies only. NOTHING under it may ever be tracked — any file
#    type, any license. (.gitignore carries the same rule; this assertion
#    is the gate's belt-and-suspenders.)
la_hits="$(git ls-files | grep -E '^local-assets/' || true)"
if [[ -n "$la_hits" ]]; then
  echo
  echo "SOVEREIGNTY VIOLATION — local-assets/ fetch cache is tracked:"
  echo "$la_hits"
  viol=1
fi

if [[ "$viol" -ne 0 ]]; then
  echo
  echo "Blocked. Corpus content may never enter git — ANY license, ANYWHERE."
  echo "Corpora are fetch-from-source. Remove with 'git rm --cached <file>'"
  echo "(keep on disk). "
  exit 1
fi
echo "sovereignty gate: clean (whole tree — no corpus content tracked)."
