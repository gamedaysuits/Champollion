/**
 * Command: leaderboard
 *
 * Fetches and displays MT evaluation leaderboard data from Supabase.
 * Provides sorting, filtering, JSON export, and method installation.
 *
 * Usage:
 *   champollion leaderboard                      # Show all results
 *   champollion leaderboard --pair "en>crk"       # Filter by language pair (quote the >)
 *   champollion leaderboard --sort composite      # Sort by composite score
 *   champollion leaderboard --json                # Machine-readable NDJSON
 *   champollion leaderboard --top 5               # Show top N results
 *   champollion leaderboard --install 1           # Install method config from rank 1
 *   champollion leaderboard --install 1 --apply   # Install and wire to config
 */

import { output } from '../output.js';
import { getLanguageCard } from '../registers.js';
// Supabase public config — shared with the dynamic card loader
// (RLS restricts the anon role to read-only)
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../cards/env.js';
import {
  LANE_ABSOLUTE, LANE_RELATIVE_ONLY, normalizeGrade, isRelativeOnly,
} from '../contamination-lane.js';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Sortable metric definitions.
 * key: CLI flag value   →   column: Supabase column   →   label: Display header
 */
const SORT_KEYS = {
  composite:   { column: 'composite_score',     label: 'Composite',    desc: true },
  chrf:        { column: 'chrf_plus_plus',      label: 'chrF++',       desc: true },
  exact:       { column: 'exact_match_rate',     label: 'Exact Match',  desc: true },
  fst:         { column: 'fst_acceptance_rate',  label: 'FST Accept',   desc: true },
  equivalent:  { column: 'equivalent_match_rate', label: 'Equiv Match', desc: true },
  semantic:    { column: 'semantic_score',       label: 'Semantic',     desc: true },
  cost:        { column: 'total_cost_usd',       label: 'Cost (USD)',   desc: false },
  date:        { column: 'run_timestamp',        label: 'Date',         desc: true },
};

/**
 * Quality tier → display label with color hint.
 */
const TIER_LABELS = {
  baseline:    '○ Baseline',
  emerging:    '◔ Emerging',
  functional:  '◑ Functional',
  deployable:  '◕ Deployable',
  fluent:      '● Fluent',
};

// ---------------------------------------------------------------------------
// Contamination lane — FAIL SAFE. The lane policy lives in
// lib/contamination-lane.js (the CLI-side mirror of the SSOT in
// arena/mt_eval_harness/contamination.py).
//
// The CLI reads each run's grade from run_card.contamination (publish.py stamps
// it; there is no top-level column) — it does not fetch the datasets table, so
// a run with no stamped grade fails safe to relative-only rather than silently
// ranking as absolute quality. This is intentionally conservative.
// ---------------------------------------------------------------------------

/** Row's normalized contamination grade from run_card.contamination, or null. */
function rowContamination(row) {
  return normalizeGrade(row?.run_card?.contamination);
}

/** FAIL SAFE: true ⇒ relative-comparison-only (do not co-rank as absolute
 *  quality). Known HIGH/MEDIUM or unknown grade → true; only LOW → false. */
function rowIsRelativeOnly(row) {
  return isRelativeOnly(rowContamination(row));
}

/**
 * Format a language pair code into display name using language cards.
 * "en>crk" → "English → Plains Cree"
 */
function formatPairDisplay(pair) {
  if (!pair) return '?';
  const sep = pair.includes('>') ? '>' : ' → ';
  const [src, tgt] = pair.split(sep);
  if (!tgt) return pair;

  const srcCard = getLanguageCard(src.trim());
  const tgtCard = getLanguageCard(tgt.trim());
  const srcName = srcCard?.name || src.trim().toUpperCase();
  const tgtName = tgtCard?.name || tgt.trim().toUpperCase();
  return `${srcName} → ${tgtName}`;
}

/**
 * Format a metric value for table display.
 */
function fmtMetric(value, decimals = 2) {
  if (value == null) return '—';
  return Number(value).toFixed(decimals);
}

/**
 * Pad a string to a fixed width for table alignment.
 */
function pad(str, width, align = 'left') {
  const s = String(str);
  if (s.length >= width) return s.slice(0, width);
  const padding = ' '.repeat(width - s.length);
  return align === 'right' ? padding + s : s + padding;
}

/**
 * Fetch leaderboard data from Supabase.
 */
async function fetchLeaderboard(sortKey, pair) {
  const sort = SORT_KEYS[sortKey] || SORT_KEYS.composite;
  const order = `${sort.column}.${sort.desc ? 'desc' : 'asc'}.nullslast`;

  let url = `${SUPABASE_URL}/rest/v1/run_cards?select=*&order=${order}`;
  if (pair) {
    url += `&language_pair=eq.${pair}`;
  }

  const resp = await fetch(url, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
  });

  if (!resp.ok) {
    throw new Error(`Supabase returned HTTP ${resp.status}: ${resp.statusText}`);
  }

  return resp.json();
}

/**
 * @param {import('../types.js').CLIArgs} args - Parsed CLI arguments
 * @param {string} cwd - Working directory
 * @returns {Promise<number>} Exit code (0 = success, 1 = error)
 */
async function run(args, cwd) {
  const sortKey = args.sort || 'composite';
  const pair = args.pair || null;
  const topN = args.top ? parseInt(args.top, 10) : null;
  const jsonMode = args.json || false;

  // Resolve --install into an integer rank. Because --install is a string flag,
  // a bare `--install` (no rank) parses as boolean `true`, and parseInt(true)
  // is NaN — which previously slipped past the range check in _handleInstall
  // and crashed on `rows[NaN - 1].run_card`. Validate here: --install requires
  // a positive-integer rank.
  let installRank = null;
  if (args.install != null && args.install !== false) {
    installRank = parseInt(args.install, 10);
    if (!Number.isInteger(installRank) || installRank < 1) {
      output.error('--install requires a positive integer rank, e.g. `champollion leaderboard --install 1`.');
      return 1;
    }
  }

  // Validate sort key
  if (!SORT_KEYS[sortKey]) {
    output.error(`Unknown sort key: "${sortKey}"`);
    output.error(`Valid keys: ${Object.keys(SORT_KEYS).join(', ')}`);
    return 1;
  }

  try {
    const rows = await fetchLeaderboard(sortKey, pair);

    if (rows.length === 0) {
      if (jsonMode) {
        // Empty JSON array for machine consumers
        console.log('[]');
      } else {
        output.raw('\n  No leaderboard entries found.');
        if (pair) output.raw(`  (filtered by pair: ${pair})`);
        output.raw('  Submit results with `mt-eval publish`.\n');
      }
      return 0;
    }

    // ---- --install mode: extract method config from a ranked entry ----
    if (installRank != null) {
      return _handleInstall(rows, installRank, sortKey, cwd, args);
    }

    // Apply --top limit
    const display = topN ? rows.slice(0, topN) : rows;

    // Lane warning (FAIL SAFE) — goes to stderr so it never pollutes --json
    // stdout. A relative-comparison-only corpus (HIGH/MEDIUM contamination,
    // FLORES, or unknown grade) is NOT absolute quality; flag it loudly when it
    // surfaces at the top so the rank isn't misread as "best quality".
    const relRows = display.filter(rowIsRelativeOnly);
    if (relRows.length > 0) {
      if (display.length > 0 && rowIsRelativeOnly(display[0])) {
        output.warn(
          `Rank #1 is a relative-comparison-only corpus `
          + `(${rowContamination(display[0]) || 'grade unknown'}) — its score is valid only `
          + `against other methods on that corpus, NOT as absolute quality.`,
        );
      }
      output.warn(
        `${relRows.length} of ${display.length} shown row(s) are relative-comparison-only `
        + `and must not be ranked against absolute-quality corpora.`,
      );
    }

    if (jsonMode) {
      // NDJSON output for CI/CD piping
      for (const row of display) {
        console.log(JSON.stringify({
          rank: display.indexOf(row) + 1,
          model: row.model_slug,
          condition: row.condition,
          pair: row.language_pair,
          composite: row.composite_score,
          chrF: row.chrf_plus_plus,
          exactMatch: row.exact_match_rate,
          fstAcceptance: row.fst_acceptance_rate,
          equivalentMatch: row.equivalent_match_rate,
          semanticScore: row.semantic_score,
          tier: row.quality_tier,
          cost_usd: row.total_cost_usd,
          submitter: row.submitter,
          date: row.run_timestamp?.split('T')[0],
          dataset: row.dataset_id,
          // Contamination lane (FAIL SAFE) — relative_only rows are valid only
          // for comparing methods on the same corpus, NOT as absolute quality.
          contamination: rowContamination(row),
          relative_only: rowIsRelativeOnly(row),
          score_lane: rowIsRelativeOnly(row) ? LANE_RELATIVE_ONLY : LANE_ABSOLUTE,
        }));
      }
      return 0;
    }

    // ---- Human-readable table output ----

    const pairDisplay = pair ? formatPairDisplay(pair) : 'All Pairs';
    const sortLabel = SORT_KEYS[sortKey].label;

    output.raw('');
    output.raw(`  champollion — Method Leaderboard`);
    output.raw(`  ${pairDisplay}  |  Sorted by: ${sortLabel}`);
    if (topN) output.raw(`  Showing top ${topN} of ${rows.length}`);
    output.raw('');

    // Table header
    const header = [
      pad('#', 4),
      pad('Model', 28),
      pad('Condition', 12),
      pad('Score', 7, 'right'),
      pad('chrF++', 8, 'right'),
      pad('EM%', 7, 'right'),
      pad('Tier', 14),
      pad('Date', 12),
      pad('Lane', 9),
    ].join('  ');

    output.raw(`  ${header}`);
    output.raw(`  ${'─'.repeat(header.length)}`);

    for (let i = 0; i < display.length; i++) {
      const row = display[i];
      const tier = TIER_LABELS[row.quality_tier?.toLowerCase()] || row.quality_tier || '—';
      const date = row.run_timestamp?.split('T')[0] || '—';

      const lane = rowIsRelativeOnly(row) ? 'rel-only' : 'abs';
      const line = [
        pad(String(i + 1), 4),
        pad(row.model_slug || '—', 28),
        pad(row.condition || '—', 12),
        pad(fmtMetric(row.composite_score, 4), 7, 'right'),
        pad(fmtMetric(row.chrf_plus_plus), 8, 'right'),
        pad(fmtMetric(row.exact_match_rate), 7, 'right'),
        pad(tier, 14),
        pad(date, 12),
        pad(lane, 9),
      ].join('  ');

      output.raw(`  ${line}`);
    }

    output.raw('');
    output.raw(`  ${display.length} result${display.length !== 1 ? 's' : ''} shown.`);
    output.raw(`  Lane: abs = absolute-quality · rel-only = relative-comparison-only`);
    output.raw(`        (HIGH/MEDIUM contamination, FLORES, or unknown grade — compare within that corpus only)`);
    output.raw(`  → Install a method: champollion leaderboard --install <rank>`);
    output.raw(`  View full leaderboard: https://champollion.dev/leaderboard`);
    output.raw('');

  } catch (err) {
    output.error(`Failed to fetch leaderboard: ${err.message}`);
    return 1;
  }

  return 0;
}

// ---------------------------------------------------------------------------
// --install implementation
// ---------------------------------------------------------------------------

/**
 * Extract method configuration from a leaderboard entry and write it as a
 * champollion method plugin manifest.
 *
 * The generated manifest can be used with `champollion sync` by setting
 * `"methodPlugin": "<name>"` in the pair config. The manifest follows
 * the champollion-plugin.schema.json format.
 *
 * @param {Array} rows - Sorted leaderboard rows from Supabase
 * @param {number} rank - 1-based rank to install
 * @param {string} sortKey - Active sort key (for display context)
 * @param {string} cwd - Current working directory
 * @returns {Promise<number>} Exit code
 */
async function _handleInstall(rows, rank, sortKey, cwd, args = {}) {
  if (rank < 1 || rank > rows.length) {
    output.error(`Rank ${rank} is out of range (1–${rows.length}).`);
    return 1;
  }

  const row = rows[rank - 1];
  const runCard = row.run_card || {};
  const methodCard = runCard.method_card || null;
  const condition = row.condition || 'unknown';
  const model = row.model_slug || 'unknown';
  const pair = row.language_pair || '';
  const [, targetLang] = pair.includes('>') ? pair.split('>') : ['', ''];

  // Generate a plugin name from the method details
  const safeName = [
    targetLang || 'any',
    condition,
    model.replace(/[^a-z0-9]/gi, '-').toLowerCase(),
  ].filter(Boolean).join('-').replace(/--+/g, '-');

  // Use the canonical MethodConfig from the harness run card if available.
  // Fall back to reconstruction from individual fields for backward compat
  // with old run cards that don't include method_config.
  const methodConfig = runCard.method_config || {
    model: model,
    temperature: runCard.temperature ?? 0.3,
    batchSize: runCard.batch_size ?? 80,
    register: null,
    coachingFile: null,
    coachingPrompt: null,
    promptContext: null,
    qualityTier: null,
  };

  // Build the plugin manifest (champollion-plugin.schema.json format)
  const manifest = {
    name: safeName,
    type: _inferMethodType(condition, runCard),
    version: '1.0.0',
    description: methodCard?.description
      || `Method extracted from leaderboard rank #${rank} (${formatPairDisplay(pair)}, ${condition}).`,
    author: row.submitter || methodCard?.author || 'unknown',
    locales: targetLang ? [targetLang] : ['unknown'],  // schema requires minItems: 1
    config: methodConfig,
    benchmarks: {
      [targetLang || 'unknown']: {
        date: row.run_timestamp || new Date().toISOString(),
        corpus_size: row.corpus_size || runCard.dataset?.entry_count || 0,
        exact_match_rate: row.exact_match_rate ?? 0,
        corpus_chrf: row.chrf_plus_plus ?? 0,
        model: model,
        harness_version: row.harness_version || runCard.harness_version || '',
      },
    },
    provenance: {
      resources: [],
      commercialReady: false,
      flags: ['extracted-from-leaderboard'],
    },
  };

  // Note: method_card data is available in the Supabase run_card but is NOT
  // included here — the plugin manifest follows champollion-plugin.schema.json
  // which does not allow _method_card (additionalProperties: false).

  // If condition is coached, note that coaching data is needed
  if (condition.includes('coached') || _inferMethodType(condition, runCard) === 'llm-coached') {
    manifest.coaching = { dir: 'coaching' };
  }

  // Write to .champollion/methods/<name>/method.json (directory convention per plugins.js)
  const pluginDir = path.join(cwd, '.champollion', 'methods', safeName);
  const outPath = path.join(pluginDir, 'method.json');

  fs.mkdirSync(pluginDir, { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(manifest, null, 2) + '\n', 'utf-8');

  // Display confirmation
  output.raw('');
  output.ok(`Installed method: ${safeName}`);
  output.raw(`  → ${outPath}`);
  output.raw('');
  output.raw(`  Source: Rank #${rank} on leaderboard (${formatPairDisplay(pair)})`);
  output.raw(`  Model:  ${model}`);
  output.raw(`  Score:  ${fmtMetric(row.composite_score, 4)} composite (${row.quality_tier || 'unscored'})`);
  if (methodCard?.name) {
    output.raw(`  Method: ${methodCard.name} (${methodCard.class || 'unclassified'})`);
  }
  output.raw('');

  // --apply: auto-wire the installed plugin into champollion.config.json
  if (args.apply) {
    const configPath = path.join(cwd, 'champollion.config.json');
    if (fs.existsSync(configPath)) {
      try {
        const configRaw = fs.readFileSync(configPath, 'utf-8');
        const config = JSON.parse(configRaw);

        // Ensure pairs object exists
        if (!config.pairs) config.pairs = {};

        // Build the pair key from the leaderboard entry
        const [srcLang, tgtLang] = pair.includes('>') ? pair.split('>') : ['en', targetLang || 'unknown'];
        const pairKey = `${srcLang}:${tgtLang}`;

        // Set or update the pair entry with the plugin reference
        config.pairs[pairKey] = config.pairs[pairKey] || {};
        config.pairs[pairKey].methodPlugin = safeName;

        fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', 'utf-8');
        output.ok(`Applied plugin to config: pairs["${pairKey}"].methodPlugin = "${safeName}"`);
        output.raw(`  → ${configPath}`);
      } catch (err) {
        output.error(`Failed to update config: ${err.message}`);
        output.raw('  You can manually add the plugin reference to your config.');
      }
    } else {
      output.raw('  [WARN] No champollion.config.json found — skipping --apply.');
      output.raw('  Run `champollion init` first, then re-install with --apply.');
    }
    output.raw('');
  } else {
    output.raw('  To use this method in your project:');
    output.raw(`    "methodPlugin": "${safeName}"`);
    output.raw('');
    output.raw('  Or auto-wire it: champollion leaderboard --install ' + rank + ' --apply');
    output.raw('');
  }

  if (manifest.coaching) {
    output.raw('  ⚠ This method uses coaching data. Create a coaching/ directory');
    output.raw('    in the plugin folder with language-specific examples.');
    output.raw('');
  }

  return 0;
}

/**
 * Infer the champollion method type from a condition string and run card.
 * Maps arena condition names to plugin schema type enum values.
 */
function _inferMethodType(condition, runCard) {
  if (!condition) return 'llm';
  const c = condition.toLowerCase();
  if (c.includes('coached')) return 'llm-coached';
  if (c.includes('fst')) return 'llm-coached';  // FST-gated methods are coached pipelines
  if (c.includes('google')) return 'google-translate';
  if (c.includes('deepl')) return 'deepl';
  if (c.includes('microsoft')) return 'microsoft-translator';
  if (runCard?.tools_enabled) return 'llm';
  return 'llm';
}

export { run };

