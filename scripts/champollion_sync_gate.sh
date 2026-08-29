#!/usr/bin/env bash
# champollion_sync_gate.sh — DOGFOOD ENFORCEMENT for the website translations.
#
# Champollion's whole pitch is "i18n that stays in sync via the CLI." So our own
# Docusaurus sites must NEVER carry hand-edited or stale translations: the locale
# files are champollion output, regenerated from the English source. This gate
# enforces that on `git push` by actually RUNNING champollion (real provider keys,
# real network — pre-push is the right place: infrequent, network already needed,
# keeps the cost off every commit). See [[dogfood-champollion-always]].
#
# WHAT IT DOES, in order:
#   1. Checks that cli/website/static/llms-full.txt is current (offline,
#      deterministic reassembly from static/llms.txt + the docs tree — zero
#      API calls, sub-second). A stale committed copy is drift: HARD block,
#      regenerate + commit.
#   1b. Checks that the public datasets doc's hand-maintained license table
#      (cli/website/docs/network/leaderboard/datasets.md) matches
#      arena/datasets/registry.json (cli/scripts/check-datasets-doc-parity.mjs
#      — offline, sub-second). A doc telling agents a different license story
#      than the registry enforces is drift: HARD block. Same degradation
#      contract as the llms-full check (exit 3 = drift, other non-zero =
#      tooling failure → warn).
#   2. Loads translation-provider keys from the repo's .env.local files (root,
#      then cli/.env.local, then arena/.env.local) and EXPORTS them, because
#      champollion only reads .env.local relative to its OWN cwd (the website
#      dir, which has none) and process.env takes priority. Quote-wrapped values
#      are parsed safely (the Supabase service key is a quoted JWT — we only read
#      the translation keys, never that).
#   3. For the champollion-managed site (cli/website — has a champollion.config.json
#      + i18n/ dir; the Arena docs are now merged in under docs/network/), runs
#      `champollion sync --max-cost <ceiling>`.
#      Sync is INCREMENTAL, and the cost bound is TWO mechanisms working
#      together: the translation memory (.champollion/tm.json) caches key-value
#      strings AND Markdown blocks/bodies/front-matter fields, and the content
#      lock (.champollion-content.lock) skips Markdown files whose source hash
#      is unchanged. A no-change push re-translates nothing, and a changed
#      Markdown file re-bills only its changed blocks (unchanged blocks are TM
#      hits). Neither cache is a HARD bound — clobbered caches (tm.json + the
#      content lock together) would queue the entire docs tree for
#      re-translation inside the timeout window — so the gate also passes a
#      SPEND CEILING via champollion's --max-cost flag (the CLI estimates cost
#      up front, TM-aware, and aborts BEFORE any API call when the estimate
#      exceeds the cap, or is unknowable). Default ceiling: $5.00 USD; override
#      or disable with CHAMPOLLION_SYNC_MAX_COST. Pass extra flags (e.g. to
#      scope languages) via CHAMPOLLION_SYNC_ARGS (a --max-cost there
#      suppresses the default ceiling).
#   4. If sync REGENERATED any locale file (the i18n/ tree differs after the run):
#      ABORT the push — the generated translations must be committed, not left
#      behind. Re-run after committing them.
#   5. If nothing drifted: allow the push.
#   6. GRACEFUL DEGRADATION (a pre-push hook must never brick pushing): if no key
#      is present, or node/the CLI is missing, or sync fails with no progress
#      (network/API/timeout), print a WARNING and ALLOW the push. Set
#      CHAMPOLLION_SYNC_STRICT=1 to turn those warnings into hard blocks instead.
#      DEGRADATION APPLIES TO THE TRANSLATION HALF ONLY. The three offline
#      checks (llms-full, datasets-doc parity, prose-counts parity) are
#      deterministic, zero-API, tracked-files-only — so a crash there is a
#      DEFECT, not an environment, and they HARD BLOCK on any non-zero exit
#      (drift or crash alike). Previously a checker that threw waved the push
#      through indistinguishably from one that passed. Bypass a broken offline
#      checker with CHAMPOLLION_OFFLINE_LENIENT=1 if you must ship first.
#      (A genuinely missing node/builder script still only warns: that is an
#      unprovisioned clone, not a defect.)
#
# WHAT IT NEVER DOES: it does not `git push`, does not commit, and does not write
# to Supabase. It only runs `champollion sync`, which writes local locale files.
# (sync's startup card-cache refresh is a TTL-gated, error-swallowed READ.)
#
# CHAMPOLLION'S MANAGED SURFACE (what this gate keeps in sync):
#   - Phase 1, i18n UI JSON: code.json, docusaurus-theme-classic/{navbar,footer}.json,
#     docusaurus-plugin-content-docs/current.json, blog options.json, and
#     glossary.json (regenerated below from cli/shared/explainers/glossary.json —
#     the localized-glossary pipeline, see plugins/shared-data/mergeGlossaryLocale.js).
#   - Phase 2, mirrored Markdown: docs/ and blog/ → i18n/<locale>/...-content-*/.
#   NOT covered (champollion can't reach these): hardcoded English in React/JS
#   components that isn't wrapped for Docusaurus i18n (so it never lands in
#   code.json), docusaurus.config.js values, and raw HTML attributes. Wrap such
#   strings with <Translate>/translate() so they flow into code.json.
#
# ENV TOGGLES:
#   CHAMPOLLION_SYNC_SKIP=1       skip this gate entirely (push allowed)
#   CHAMPOLLION_SYNC_STRICT=1     hard-block instead of warn on missing key/
#                                 network/cost-ceiling abort
#   CHAMPOLLION_OFFLINE_LENIENT=1 warn instead of hard-block when one of the
#                                 three OFFLINE checkers crashes (they are
#                                 strict by default — see step 6)
#   CHAMPOLLION_SYNC_TIMEOUT=N    per-site sync timeout in seconds (default 900)
#   CHAMPOLLION_SYNC_MAX_COST=N   spend ceiling in USD passed as --max-cost
#                                 (default 5.00; set EMPTY to disable:
#                                 CHAMPOLLION_SYNC_MAX_COST= git push)
#   CHAMPOLLION_SYNC_ARGS="..."   extra flags appended to `champollion sync`
#                                 (a --max-cost here suppresses the default
#                                 ceiling so it isn't passed twice)
#
# Invoked by .githooks/pre-push AFTER scripts/quarantine_gate.sh. Bypass the whole
# pre-push chain with `git push --no-verify`.

# NOTE: intentionally NOT `set -e` / `set -u`. This gate must degrade gracefully,
# never abort on an incidental command failure, and stay bash-3.2 safe (macOS).
set -o pipefail

root="$(git rev-parse --show-toplevel 2>/dev/null)"
if [ -z "$root" ]; then
  echo "champollion-gate: not in a git repo — skipping (push allowed)." >&2
  exit 0
fi

CLI_ENTRY="$root/cli/bin/cli.js"
# The Arena site was merged into cli/website (its docs now live under
# cli/website/docs/network/*), so cli/website is the only champollion-managed
# site. (arena/website was retired 2026-06-20.)
SITES="cli/website"

# Translation-provider env vars champollion's methods read (provider-env SSOT +
# OpenRouter/direct-LLM). We export ONLY these — never the Supabase JWT etc.
TRANSLATION_KEYS="OPENROUTER_API_KEY GOOGLE_TRANSLATE_API_KEY GOOGLE_API_KEY DEEPL_API_KEY MICROSOFT_TRANSLATOR_API_KEY MICROSOFT_TRANSLATOR_REGION AZURE_TRANSLATOR_KEY LIBRETRANSLATE_API_URL LIBRETRANSLATE_API_KEY LIBRETRANSLATE_URL LIBRE_URL TILDE_API_KEY LARA_ACCESS_KEY_ID LARA_ACCESS_KEY_SECRET ANTHROPIC_API_KEY OPENAI_API_KEY GEMINI_API_KEY"

# ---------------------------------------------------------------------------
# Graceful-degradation helper: warn + allow push, unless STRICT is set.
# ---------------------------------------------------------------------------
degrade() {
  echo "⚠ champollion sync skipped: $1" >&2
  echo "  → push ALLOWED; website translations NOT verified this push." >&2
  if [ -n "${CHAMPOLLION_SYNC_STRICT:-}" ]; then
    echo "  → CHAMPOLLION_SYNC_STRICT is set: treating this as a hard block." >&2
    exit 1
  fi
  exit 0
}

# ---------------------------------------------------------------------------
# Offline-check failure handling.
#
# The translation half above degrades on purpose: it needs provider keys and a
# network, so a failure there is usually environmental and must not block a
# push. The three checks BELOW (llms-full builder, datasets-doc parity,
# prose-counts parity) are different in kind — offline, deterministic, zero API
# calls, reading only tracked files. A crash there is a DEFECT, not an
# environment, and letting it warn-and-continue meant a checker that threw
# (missing input, parse error) waved the push through exactly as if it had
# passed. They are strict by default now.
#
#   CHAMPOLLION_OFFLINE_LENIENT=1  restore warn-and-continue for these three
#   CHAMPOLLION_SYNC_STRICT=1      also hard-block the degradable network half
# ---------------------------------------------------------------------------
offline_check_failed() {
  if [ -n "${CHAMPOLLION_OFFLINE_LENIENT:-}" ]; then
    echo "  → CHAMPOLLION_OFFLINE_LENIENT is set: warning only, push allowed." >&2
    return 0
  fi
  echo "  → this check is offline and deterministic, so a crash is a defect." >&2
  echo "    Fix the checker, or re-run with CHAMPOLLION_OFFLINE_LENIENT=1 to bypass." >&2
  exit 1
}

# ---------------------------------------------------------------------------
# Env loading — mirrors champollion's own parser (cli/lib/api-key.js):
# strips an optional `export ` prefix, splits on the FIRST `=`, trims, and
# removes one layer of surrounding matching quotes. First match wins; an env var
# already set in the shell takes priority and is never overridden.
# ---------------------------------------------------------------------------
read_env_value() {
  # $1 = file, $2 = key. Echoes the parsed value (or nothing).
  local file="$1" key="$2" line val
  [ -f "$file" ] || return 0
  line="$(grep -E "^[[:space:]]*(export[[:space:]]+)?${key}=" "$file" 2>/dev/null | head -n 1)"
  [ -n "$line" ] || return 0
  val="${line#*=}"                                   # everything after first '='
  val="$(printf '%s' "$val" | sed -E 's/^[[:space:]]+//; s/[[:space:]]+$//')"
  case "$val" in
    \"*\") val="${val#\"}"; val="${val%\"}" ;;       # strip surrounding "  "
    \'*\') val="${val#\'}"; val="${val%\'}" ;;       # strip surrounding '  '
  esac
  printf '%s' "$val"
}

load_env_file() {
  local file="$1" key cur v
  [ -f "$file" ] || return 0
  for key in $TRANSLATION_KEYS; do
    cur="${!key:-}"
    [ -n "$cur" ] && continue                        # already in env — respect it
    v="$(read_env_value "$file" "$key")"
    [ -n "$v" ] && export "$key=$v"
  done
}

has_any_key() {
  local key
  for key in $TRANSLATION_KEYS; do
    [ -n "${!key:-}" ] && return 0
  done
  return 1
}

# ---------------------------------------------------------------------------
# Fingerprint a site's i18n/ tree so we can tell whether sync changed anything.
# Scoped to i18n/ ONLY: champollion's TM (.champollion/) and content-lock
# (.champollion-content.lock) live at the site root and would otherwise cause
# false positives. Content-hash based: catches edited JSON, new mirrored
# Markdown, and deletions. Falls back to git porcelain if no hasher exists.
# ---------------------------------------------------------------------------
HASH_CMD=""
if command -v shasum >/dev/null 2>&1; then HASH_CMD="shasum"
elif command -v sha1sum >/dev/null 2>&1; then HASH_CMD="sha1sum"
elif command -v md5sum >/dev/null 2>&1; then HASH_CMD="md5sum"
elif command -v cksum >/dev/null 2>&1; then HASH_CMD="cksum"
fi

snapshot_i18n() {
  local dir="$1"
  [ -d "$dir" ] || return 0
  if [ -n "$HASH_CMD" ]; then
    find "$dir" -type f 2>/dev/null | LC_ALL=C sort | while IFS= read -r f; do
      "$HASH_CMD" "$f" 2>/dev/null
    done
  else
    git -C "$root" status --porcelain -- "$dir" 2>/dev/null | LC_ALL=C sort
  fi
}

# ---------------------------------------------------------------------------
# Spend ceiling — passed to champollion as --max-cost (USD). The CLI estimates
# translation cost up front (TM-aware) and aborts BEFORE any API call when the
# estimate exceeds the ceiling or cannot be bounded. This is the gate's guard
# against unbounded re-translation (e.g. a clobbered content lock queueing the
# whole docs tree) inside the sync timeout window.
#   - default: 5.00 USD (a no-change push estimates ~$0; routine doc edits
#     stay well under this; a full-tree disaster is far above it)
#   - override: CHAMPOLLION_SYNC_MAX_COST=20 git push
#   - disable:  CHAMPOLLION_SYNC_MAX_COST= git push   (empty = no ceiling)
#   - a --max-cost inside CHAMPOLLION_SYNC_ARGS wins; the default is suppressed.
# NOTE: ${VAR-default} (no colon) on purpose — an EXPLICITLY EMPTY variable
# disables the ceiling, while an unset one gets the default.
# ---------------------------------------------------------------------------
SYNC_MAX_COST="${CHAMPOLLION_SYNC_MAX_COST-5.00}"
case " ${CHAMPOLLION_SYNC_ARGS:-} " in
  *" --max-cost"*) SYNC_MAX_COST="" ;;   # user supplied their own cap in ARGS
esac

# ---------------------------------------------------------------------------
# Run `champollion sync` for one site (cwd = the site dir, so it finds its
# champollion.config.json + i18n/). Returns champollion's exit code:
#   0 clean · 1 catastrophic (no progress: bad key / network) · 2 partial
#   OR a --max-cost abort (also 2, by the CLI's documented contract — the
#   caller tells them apart by grepping the captured output in $2).
# Output is tee'd to $2 (and still streamed to stderr) so the caller can
# distinguish a cost-ceiling abort from a genuine partial sync.
# Wrapped in a timeout when one is available so a hung API can't block forever.
# ---------------------------------------------------------------------------
TIMEOUT_BIN=""
if command -v timeout >/dev/null 2>&1; then TIMEOUT_BIN="timeout"
elif command -v gtimeout >/dev/null 2>&1; then TIMEOUT_BIN="gtimeout"; fi
SYNC_TIMEOUT="${CHAMPOLLION_SYNC_TIMEOUT:-900}"

run_sync_for_site() {
  local site_abs="$1" log_file="$2"
  (
    cd "$site_abs" || exit 99
    # Word-splitting of CHAMPOLLION_SYNC_ARGS is intentional (extra flags);
    # the ceiling is appended AFTER it so a repeated flag can't shadow ours.
    set -- sync ${CHAMPOLLION_SYNC_ARGS:-}
    if [ -n "$SYNC_MAX_COST" ]; then
      set -- "$@" --max-cost "$SYNC_MAX_COST"
    fi
    if [ -n "$TIMEOUT_BIN" ]; then
      "$TIMEOUT_BIN" "$SYNC_TIMEOUT" node "$CLI_ENTRY" "$@"
    else
      node "$CLI_ENTRY" "$@"
    fi
  ) 2>&1 | tee "$log_file" >&2
  return "${PIPESTATUS[0]}"
}

# ===========================================================================
# Main
# ===========================================================================
if [ -n "${CHAMPOLLION_SYNC_SKIP:-}" ]; then
  echo "champollion-gate: CHAMPOLLION_SYNC_SKIP set — skipping (push allowed)." >&2
  exit 0
fi

# ---------------------------------------------------------------------------
# llms-full.txt drift check — BEFORE the key gate, because it needs no keys:
# static/llms-full.txt is a DERIVED artifact, reassembled offline from
# static/llms.txt + the live docs tree (zero API calls, sub-second). A stale
# committed copy is the same class of drift as stale translations → HARD block.
# Missing node / missing builder script are environmental, not drift → warn.
# ---------------------------------------------------------------------------
LLMS_FULL_BUILDER="$root/cli/website/scripts/build-llms-full.mjs"
if command -v node >/dev/null 2>&1 && [ -f "$LLMS_FULL_BUILDER" ]; then
  node "$LLMS_FULL_BUILDER" --check >&2
  llms_rc=$?
  if [ "$llms_rc" -eq 3 ]; then
    # Exit 3 = the builder RAN and the committed copy is stale — real drift.
    echo "" >&2
    echo "✗ cli/website/static/llms-full.txt is STALE (docs or llms.txt changed)." >&2
    echo "  It is a derived artifact — regenerate and commit it, then push again:" >&2
    echo "" >&2
    echo "      node cli/website/scripts/build-llms-full.mjs" >&2
    echo "      git add cli/website/static/llms-full.txt" >&2
    echo "      git commit -m 'chore(docs): regenerate llms-full.txt'" >&2
    echo "" >&2
    echo "  (Regeneration is deterministic local reassembly — no API calls.)" >&2
    echo "  (Emergency bypass, not recommended: git push --no-verify)" >&2
    exit 1
  elif [ "$llms_rc" -ne 0 ]; then
    # Any other non-zero exit = the builder FAILED (crash, unresolvable index
    # link) — not staleness, and regenerating won't fix it. Environmental /
    # tooling failure → warn and continue, per the degradation contract.
    echo "⚠ llms-full.txt check could not complete: builder exited $llms_rc (error above — not staleness)." >&2
    echo "  → fix the builder error it reported." >&2
    offline_check_failed
  fi
else
  echo "⚠ llms-full.txt check skipped: node or cli/website/scripts/build-llms-full.mjs not found." >&2
fi

# ---------------------------------------------------------------------------
# for-agents.md drift check — same class, same contract as llms-full above:
# static/for-agents.md is a DERIVED artifact (the raw-markdown serve of the
# /for-agents page), regenerated offline from src/pages/for-agents.md (zero
# API calls, sub-second). Stale committed copy = drift → HARD block on exit 3;
# missing node / missing builder = environmental → warn.
# ---------------------------------------------------------------------------
FOR_AGENTS_BUILDER="$root/cli/website/scripts/build-for-agents-md.mjs"
if command -v node >/dev/null 2>&1 && [ -f "$FOR_AGENTS_BUILDER" ]; then
  node "$FOR_AGENTS_BUILDER" --check >&2
  fa_rc=$?
  if [ "$fa_rc" -eq 3 ]; then
    echo "" >&2
    echo "✗ cli/website/static/for-agents.md is STALE (src/pages/for-agents.md changed)." >&2
    echo "  It is a derived artifact — regenerate and commit it, then push again:" >&2
    echo "" >&2
    echo "      node cli/website/scripts/build-for-agents-md.mjs" >&2
    echo "      git add cli/website/static/for-agents.md" >&2
    echo "      git commit -m 'chore(docs): regenerate for-agents.md'" >&2
    echo "" >&2
    echo "  (Regeneration is deterministic local reassembly — no API calls.)" >&2
    echo "  (Emergency bypass, not recommended: git push --no-verify)" >&2
    exit 1
  elif [ "$fa_rc" -ne 0 ]; then
    echo "⚠ for-agents.md check could not complete: builder exited $fa_rc (error above — not staleness)." >&2
    echo "  → fix the builder error it reported." >&2
    offline_check_failed
  fi
else
  echo "⚠ for-agents.md check skipped: node or cli/website/scripts/build-for-agents-md.mjs not found." >&2
fi

# ---------------------------------------------------------------------------
# component-license declarations — offline, zero API calls, sub-second. Every
# licensed component (discovered from git, not from a list) must be declared in
# docs/LICENSING.md, the root LICENSE, and docs/DATA_BOUNDARIES.md, with
# matching SPDX; and no permissive component may IMPORT an AGPL one.
#
# `forge/` — 86 files of AGPL-3.0-or-later approved for the public squash — was
# declared in none of the three tables until 2026-08-01. Hand-maintained tables
# fall behind the tree silently; this is what makes that a hard block instead.
# ---------------------------------------------------------------------------
COMPONENT_LICENSES="$root/cli/scripts/check-component-licenses.mjs"
if command -v node >/dev/null 2>&1 && [ -f "$COMPONENT_LICENSES" ]; then
  node "$COMPONENT_LICENSES" >&2
  comp_rc=$?
  if [ "$comp_rc" -eq 3 ]; then
    echo "" >&2
    echo "✗ a licensed component is undeclared, or a declaration disagrees with the code." >&2
    echo "  Declare it in all three tables (docs/LICENSING.md, LICENSE," >&2
    echo "  docs/DATA_BOUNDARIES.md), commit, and push again. Details above." >&2
    echo "  (Emergency bypass, not recommended: git push --no-verify)" >&2
    exit 1
  elif [ "$comp_rc" -ne 0 ]; then
    echo "⚠ component-license check could not complete: checker exited $comp_rc." >&2
    echo "  → fix the checker error it reported." >&2
    offline_check_failed
  fi
else
  echo "⚠ component-license check skipped: node or the checker not found." >&2
fi

# ---------------------------------------------------------------------------
# datasets-doc ↔ registry parity — also BEFORE the key gate (offline, zero
# API calls, sub-second): the hand-maintained per-family license table in
# cli/website/docs/network/leaderboard/datasets.md must match
# arena/datasets/registry.json. The public license story drifting from what
# the harness enforces is the same class of drift as a stale llms-full.txt
# → HARD block on exit 3; any other failure is tooling → warn.
# ---------------------------------------------------------------------------
DATASETS_PARITY="$root/cli/scripts/check-datasets-doc-parity.mjs"
if command -v node >/dev/null 2>&1 && [ -f "$DATASETS_PARITY" ]; then
  node "$DATASETS_PARITY" >&2
  parity_rc=$?
  if [ "$parity_rc" -eq 3 ]; then
    echo "" >&2
    echo "✗ cli/website/docs/network/leaderboard/datasets.md disagrees with arena/datasets/registry.json." >&2
    echo "  The public license table is a projection of the registry — fix the doc (or, for a" >&2
    echo "  new/renamed family, update FAMILY_MAP in cli/scripts/check-datasets-doc-parity.mjs)," >&2
    echo "  commit, and push again. Details above." >&2
    echo "  (Emergency bypass, not recommended: git push --no-verify)" >&2
    exit 1
  elif [ "$parity_rc" -ne 0 ]; then
    echo "⚠ datasets-doc parity check could not complete: checker exited $parity_rc (error above — not drift)." >&2
    echo "  → fix the checker error it reported." >&2
    offline_check_failed
  fi
else
  echo "⚠ datasets-doc parity check skipped: node or cli/scripts/check-datasets-doc-parity.mjs not found." >&2
fi

# ---------------------------------------------------------------------------
# prose counts ↔ SSOT parity — same lane as the two checks above (offline,
# sub-second): hand-written counts that cannot be build-time reads
# (docs/LICENSING.md rollup, floor claims, the social-card SVG) must match
# the machine SSOTs (shared/licenses.json, the card SSOT, graph-poster).
# Exit 3 = drift → HARD block; any other failure = tooling → warn.
# ---------------------------------------------------------------------------
PROSE_COUNTS="$root/cli/scripts/check-prose-counts-parity.mjs"
if command -v node >/dev/null 2>&1 && [ -f "$PROSE_COUNTS" ]; then
  node "$PROSE_COUNTS" >&2
  prose_rc=$?
  if [ "$prose_rc" -eq 3 ]; then
    echo "" >&2
    echo "✗ hand-written counts disagree with the machine SSOTs (details above)." >&2
    echo "  Fix the prose (docs/LICENSING.md / the flagged doc / the social-card SVG) to match" >&2
    echo "  shared/licenses.json and the card SSOT, commit, and push again." >&2
    echo "  (Emergency bypass, not recommended: git push --no-verify)" >&2
    exit 1
  elif [ "$prose_rc" -ne 0 ]; then
    echo "⚠ prose-counts parity check could not complete: checker exited $prose_rc (error above — not drift)." >&2
    echo "  → fix the checker error it reported." >&2
    offline_check_failed
  fi
else
  echo "⚠ prose-counts parity check skipped: node or cli/scripts/check-prose-counts-parity.mjs not found." >&2
fi

# Load keys: root .env.local first (canonical), then per-app files fill any gaps.
load_env_file "$root/.env.local"
load_env_file "$root/cli/.env.local"
load_env_file "$root/arena/.env.local"

has_any_key || degrade "no translation-provider key found in .env.local (e.g. OPENROUTER_API_KEY)"
command -v node >/dev/null 2>&1 || degrade "node not found on PATH"
[ -f "$CLI_ENTRY" ] || degrade "champollion CLI not found at cli/bin/cli.js"

echo "── champollion dogfood gate: syncing website translations ──" >&2

any_changed=0
changed_sites=""
any_infra_fail=0
any_cost_capped=0
ran=0

for site in $SITES; do
  site_abs="$root/$site"
  [ -f "$site_abs/champollion.config.json" ] || continue
  [ -d "$site_abs/i18n" ] || continue
  ran=1

  sync_log="$(mktemp "${TMPDIR:-/tmp}/champollion-gate.XXXXXX" 2>/dev/null)" || sync_log=""

  echo "  • $site …" >&2
  before="$(snapshot_i18n "$site_abs/i18n")"
  # Regenerate the glossary Phase-1 source (SSOT cli/shared/explainers/
  # glossary.json → i18n/en/glossary.json) INSIDE the snapshot window, so a
  # glossary edit flows into the same sync → drift → commit cycle as any
  # other source change. Local + deterministic (no network, no deps);
  # fail-soft like the rest of this gate.
  if [ -f "$site_abs/scripts/generate-glossary-i18n.mjs" ]; then
    node "$site_abs/scripts/generate-glossary-i18n.mjs" >&2 || \
      echo "  (glossary i18n source regeneration failed — syncing the committed copy)" >&2
  fi
  run_sync_for_site "$site_abs" "${sync_log:-/dev/null}"
  rc=$?
  after="$(snapshot_i18n "$site_abs/i18n")"

  if [ "$before" != "$after" ]; then
    any_changed=1
    changed_sites="$changed_sites $site"
  fi

  case "$rc" in
    0) ;;                                  # clean
    2) # Exit 2 is EITHER a real partial sync OR a --max-cost abort (the
       # CLI's documented contract maps both to 2). A cost abort prints
       # "--max-cost cap: $N. Aborting before any API call." — grep the
       # captured output to tell them apart. A cost abort spends nothing
       # and writes nothing; it means pending work exceeded the ceiling.
       if [ -n "$sync_log" ] && grep -q -- "--max-cost cap:" "$sync_log" 2>/dev/null; then
         any_cost_capped=1
         echo "    (champollion hit the spend ceiling for $site — aborted BEFORE any API call, nothing spent)" >&2
         echo "     Pending translation work exceeds --max-cost ${SYNC_MAX_COST:-<from CHAMPOLLION_SYNC_ARGS>} USD." >&2
         echo "     This usually means a large source change — or a clobbered content lock" >&2
         echo "     queueing a full re-translation. Review what's pending, then either:" >&2
         echo "       preview:   cd $site && node $CLI_ENTRY sync --dry" >&2
         echo "       raise cap: CHAMPOLLION_SYNC_MAX_COST=20 git push" >&2
         echo "       no cap:    CHAMPOLLION_SYNC_MAX_COST= git push" >&2
       else
         echo "    (champollion reported a PARTIAL sync for $site — some pairs failed)" >&2
       fi ;;
    *) any_infra_fail=1
       echo "    (champollion sync did not complete for $site — exit $rc)" >&2 ;;
  esac

  [ -n "$sync_log" ] && rm -f "$sync_log"
done

if [ "$ran" = 0 ]; then
  degrade "no champollion-managed website found (no champollion.config.json + i18n/)"
fi

# ---------------------------------------------------------------------------
# README lane — the GitHub/npm README translations (cli/docs/README.<locale>.md)
# are champollion output too. Source of truth is cli/README.md; the build script
# derives the gitignored sync input (cli/docs/README.en.md) so it can never
# drift, then champollion regenerates any stale translations. Same drift rule
# as the sites: regenerated files must be committed. Config lives in
# cli/readme-i18n/champollion.config.json (cwd-discovered, like the sites).
# ---------------------------------------------------------------------------
readme_lane="$root/cli/readme-i18n"
if [ -f "$readme_lane/champollion.config.json" ] && [ -f "$root/cli/scripts/build-readme-i18n-source.mjs" ]; then
  echo "  • cli/README.md → cli/docs/README.<locale>.md …" >&2
  if node "$root/cli/scripts/build-readme-i18n-source.mjs" >/dev/null 2>&1; then
    readme_log="$(mktemp "${TMPDIR:-/tmp}/champollion-gate.XXXXXX" 2>/dev/null)" || readme_log=""
    before="$(snapshot_i18n "$root/cli/docs")"
    run_sync_for_site "$readme_lane" "${readme_log:-/dev/null}"
    rc=$?
    after="$(snapshot_i18n "$root/cli/docs")"
    if [ "$before" != "$after" ]; then
      any_changed=1
      changed_sites="$changed_sites cli/docs"
    fi
    case "$rc" in
      0) ;;
      2) if [ -n "$readme_log" ] && grep -q -- "--max-cost cap:" "$readme_log" 2>/dev/null; then
           any_cost_capped=1
           echo "    (champollion hit the spend ceiling for the README lane — aborted BEFORE any API call, nothing spent)" >&2
         else
           echo "    (champollion reported a PARTIAL sync for the README — some pairs failed)" >&2
         fi ;;
      *) any_infra_fail=1
         echo "    (champollion sync did not complete for the README — exit $rc)" >&2 ;;
    esac
    [ -n "$readme_log" ] && rm -f "$readme_log"
  else
    any_infra_fail=1
    echo "    (build-readme-i18n-source.mjs failed — README lane not verified)" >&2
  fi
fi

# Drift wins over everything: if translations changed, they must be committed.
if [ "$any_changed" = 1 ]; then
  echo "" >&2
  echo "✗ champollion regenerated translations to match your source changes." >&2
  echo "" >&2
  echo "  Updated locale files in:$changed_sites" >&2
  echo "" >&2
  echo "  These are champollion OUTPUT (dogfooding — never hand-edit them)." >&2
  echo "  Review and commit the regenerated translations, then push again:" >&2
  echo "" >&2
  echo "      git add$changed_sites" >&2
  echo "      git commit -m 'chore(i18n): champollion-regenerated translations'" >&2
  echo "      git push" >&2
  echo "" >&2
  echo "  (Emergency bypass, not recommended: git push --no-verify)" >&2
  exit 1
fi

# Spend ceiling tripped: sync deliberately refused to run (nothing spent,
# nothing verified). Degrade like any other could-not-verify outcome —
# STRICT users get a hard block, everyone else a loud warning.
if [ "$any_cost_capped" = 1 ]; then
  degrade "estimated translation cost exceeds the spend ceiling (see options above)"
fi

# No drift, but sync couldn't complete cleanly → degrade, don't brick the push.
if [ "$any_infra_fail" = 1 ]; then
  degrade "sync could not complete (network / API / timeout) and produced no changes"
fi

echo "✓ champollion: website translations already in sync." >&2
exit 0
