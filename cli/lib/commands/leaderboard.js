/**
 * Command: leaderboard
 *
 * Fetches and displays MT evaluation leaderboard data from Supabase.
 * Provides sorting, filtering, JSON export, and method installation.
 *
 * Usage:
 *   champollion leaderboard                      # Show all results
 *   champollion leaderboard --pair "eng>crk"      # Filter by language pair (quote the >; eng-crk works too)
 *   champollion leaderboard --sort bleu           # Sort by BLEU (default: chrF++)
 *   champollion leaderboard --json                # Machine-readable NDJSON
 *   champollion leaderboard --top 5               # Show top N results
 *   champollion leaderboard --install 1           # Install method config from rank 1
 *   champollion leaderboard --install 1 --apply   # Install and wire to config
 */

import { output } from '../output.js';
import { getLanguageCard, resolveCode } from '../registers.js';
import { parseLanguagePair, formatLanguagePair } from '../language-pair.js';
// Supabase public config — shared with the dynamic card loader
// (RLS restricts the anon role to read-only)
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../cards/env.js';
import {
  LANE_ABSOLUTE, LANE_RELATIVE_ONLY, normalizeGrade, isRelativeOnly,
} from '../contamination-lane.js';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Scoring standard/1 (founder, 2026-10-04: "we want scoring to be industry
 * standard"). As in WMT, FLORES-200 and AmericasNLP: ONE headline and ranking
 * metric, chrF++ with its 95% bootstrap CI; the other standard metrics (BLEU,
 * spBLEU, TER, COMET) beside it, never blended; diagnostics apart, never a
 * headline or a default sort; no quality labels read off automatic scores.
 * A run card declares `scores.scoring_standard`; a card without it is legacy,
 * and only a legacy card's stored composite is ever shown — labelled
 * "legacy composite (retired)".
 */
const SCORING_STANDARD = 'standard/1';
const LEGACY_COMPOSITE_LABEL = 'legacy composite (retired)';
const DEFAULT_SORT = 'chrf';

/**
 * Sortable metric definitions.
 * key: CLI flag value → column: Supabase column → label: display header →
 * group: standard | diagnostic | legacy | other. Metrics sort best-first
 * (desc), TER lowest-first; nulls always last.
 */
const SORT_KEYS = {
  chrf:        { column: 'chrf_plus_plus',        label: 'chrF++',        desc: true,  group: 'standard' },
  bleu:        { column: 'corpus_bleu',           label: 'BLEU',          desc: true,  group: 'standard' },
  ter:         { column: 'ter',                   label: 'TER (lower is better)', desc: false, group: 'standard' },
  comet:       { column: 'comet_score',           label: 'COMET',         desc: true,  group: 'standard' },
  exact:       { column: 'exact_match_rate',      label: 'Exact Match (diagnostic)',  desc: true, group: 'diagnostic' },
  fst:         { column: 'fst_acceptance_rate',   label: 'FST Accept (diagnostic)',   desc: true, group: 'diagnostic' },
  equivalent:  { column: 'equivalent_match_rate', label: 'Equiv Match (diagnostic)',  desc: true, group: 'diagnostic' },
  semantic:    { column: 'semantic_score',        label: 'Semantic (diagnostic)',     desc: true, group: 'diagnostic' },
  cost:        { column: 'total_cost_usd',        label: 'Cost (USD)',    desc: false, group: 'other' },
  date:        { column: 'run_timestamp',         label: 'Date',          desc: true,  group: 'other' },
  // Kept so an existing `--sort composite` keeps working: it orders by the
  // retired composite, which standard/1 cards do not carry (they sort last).
  composite:   { column: 'composite_score',       label: 'Legacy composite (retired)', desc: true, group: 'legacy' },
};

/** True when the run card predates standard/1 (no scores.scoring_standard). */
function isLegacyRow(row) {
  return !row?.run_card?.scores?.scoring_standard;
}

/** A finite number or null (JSON-extracted values may be strings). */
function num(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** [lo, hi] of the chrF++ 95% CI, or null when either bound is missing. */
function chrfCi(row) {
  const lo = num(row.chrf_ci_lower);
  const hi = num(row.chrf_ci_upper);
  return lo != null && hi != null ? [lo, hi] : null;
}

/** "47.5 [45.9, 49.0]" — the chrF++ headline with its CI (no label). */
function fmtChrf(row) {
  const v = num(row.chrf_plus_plus);
  if (v == null) return '—';
  const ci = chrfCi(row);
  return ci ? `${v.toFixed(1)} [${ci[0].toFixed(1)}, ${ci[1].toFixed(1)}]` : v.toFixed(1);
}

/** The stored composite of a LEGACY card, else null (never a headline). */
function legacyComposite(row) {
  const c = num(row.composite_score);
  return c != null && isLegacyRow(row) ? c : null;
}

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
 * The board's key for a --pair value. Published runs store their pair as
 * `eng>crk`: lower-case ISO 639-3 codes joined by > (mt-eval's publish writes
 * it), and the filter is an exact match. So --pair is read in any spelling
 * lib/language-pair.js accepts (eng-crk used to match nothing, silently), a
 * bare 2-letter code goes to its ISO 639-3 code through the card aliases
 * (en → eng, as `recommend` does), and the result is lower-cased. A code with
 * a subtag (pt-BR) is kept as typed: the alias bridge would drop the subtag.
 *
 * @returns {{ok: true, pair: string, resolved: string[]} | {ok: false, error: string}}
 */
function boardPair(raw) {
  const p = parseLanguagePair(raw, { label: '--pair' });
  if (!p.ok) return p;
  const resolved = [];
  const toBoard = (code) => {
    const lower = code.toLowerCase();
    if (/[-_]/.test(code)) return lower;
    const r = String(resolveCode(lower)).toLowerCase();
    if (r !== lower) resolved.push(`${code} → ${r}`);
    return r;
  };
  return { ok: true, pair: formatLanguagePair({ source: toBoard(p.source), target: toBoard(p.target) }), resolved };
}

/**
 * Fetch leaderboard data from Supabase.
 */
async function fetchLeaderboard(sortKey, pair) {
  const sort = SORT_KEYS[sortKey] || SORT_KEYS[DEFAULT_SORT];
  const order = `${sort.column}.${sort.desc ? 'desc' : 'asc'}.nullslast`;

  let url = `${SUPABASE_URL}/rest/v1/run_cards?select=*&order=${order}`;
  if (pair) {
    url += `&language_pair=eq.${encodeURIComponent(pair)}`;
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
  const sortKey = args.sort || DEFAULT_SORT;
  const topN = args.top ? parseInt(args.top, 10) : null;
  const jsonMode = args.json || false;

  // --pair: read in any accepted spelling, filtered as the board writes it.
  let pair = null;
  let resolvedNote = null;
  if (args.pair !== undefined && args.pair !== false) {
    const bp = boardPair(args.pair);
    if (!bp.ok) {
      output.error(bp.error);
      return 1;
    }
    pair = bp.pair;
    if (bp.resolved.length > 0) {
      resolvedNote = `(codes resolved to ISO 639-3: ${bp.resolved.join(', ')})`;
      // --json: on stderr, so stdout stays one JSON object per line.
      if (jsonMode) console.error(`--pair ${pair} ${resolvedNote}`);
    }
  }

  // Resolve --install into an integer rank. Because --install is a string flag,
  // a bare `--install` (no rank) parses as boolean `true`, and parseInt(true)
  // is NaN — which previously slipped past the range check in _handleInstall
  // and crashed on `rows[NaN - 1].run_card`. Validate here: --install requires
  // a positive-integer rank.
  let installRank = null;
  if (args.install != null && args.install !== false) {
    installRank = parseInt(args.install, 10);
    if (!Number.isInteger(installRank) || installRank < 1) {
      output.error('--install requires a positive integer rank, e.g. `champollion network leaderboard --install 1`.');
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
        if (pair) output.raw(`  (filtered by pair: ${pair}${resolvedNote ? ` ${resolvedNote}` : ''})`);
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
        const legacy = isLegacyRow(row);
        console.log(JSON.stringify({
          rank: display.indexOf(row) + 1,
          model: row.model_slug,
          condition: row.condition,
          pair: row.language_pair,
          // Scoring standard/1: chrF++ (with its 95% CI) is the headline and
          // the ranking metric; the other standard metrics sit beside it.
          scoring_standard: legacy ? null : row.run_card.scores.scoring_standard,
          primary_metric: 'chrf_plus_plus',
          chrF: row.chrf_plus_plus ?? null,
          chrF_ci: chrfCi(row),
          bleu: row.corpus_bleu ?? null,
          spbleu: num(row.run_card?.scores?.spbleu),
          ter: row.ter ?? null,
          comet: row.comet_score ?? null,
          // Diagnostics: apart, never a headline or blended.
          diagnostics: {
            exactMatch: row.exact_match_rate ?? null,
            fstAcceptance: row.fst_acceptance_rate ?? null,
            equivalentMatch: row.equivalent_match_rate ?? null,
            semanticScore: row.semantic_score ?? null,
          },
          // Only a legacy card's stored composite, under its retired name.
          // No quality tier: tiers read off automatic scores are retired.
          legacy_composite: legacyComposite(row),
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

    const pairDisplay = pair ? `${formatPairDisplay(pair)} (${pair})` : 'All Pairs';
    const sortLabel = SORT_KEYS[sortKey].label;

    output.raw('');
    output.raw(`  champollion — Method Leaderboard`);
    output.raw(`  ${pairDisplay}  |  Sorted by: ${sortLabel}`);
    if (resolvedNote) output.raw(`  ${resolvedNote}`);
    if (topN) output.raw(`  Showing top ${topN} of ${rows.length}`);
    if (SORT_KEYS[sortKey].group === 'diagnostic') {
      output.raw(`  (${sortLabel} is a diagnostic: it can explain a score, it does not rank quality — the headline is chrF++.)`);
    }
    if (sortKey === 'composite') {
      output.raw(`  (The ${LEGACY_COMPOSITE_LABEL} exists only on cards scored before ${SCORING_STANDARD}; it is not a ranking of quality. Rank by chrF++.)`);
    }
    output.raw('');

    // Columns: the chrF++ headline with its CI, the other standard metrics
    // beside it, then the diagnostics apart under their own label. The legacy
    // composite is shown only when it is the requested sort.
    const showLegacy = sortKey === 'composite';
    const cols = [
      { w: 4,  head: '#',                          cell: (r, i) => String(i + 1) },
      { w: 28, head: 'Model',                      cell: (r) => r.model_slug || '—' },
      { w: 12, head: 'Condition',                  cell: (r) => r.condition || '—' },
      { w: 18, head: 'chrF++ [95% CI]', group: 'standard', align: 'right', cell: (r) => fmtChrf(r) },
      { w: 6,  head: 'BLEU',  group: 'standard',   align: 'right', cell: (r) => fmtMetric(r.corpus_bleu, 1) },
      { w: 6,  head: 'TER',   group: 'standard',   align: 'right', cell: (r) => fmtMetric(r.ter, 1) },
      { w: 6,  head: 'COMET', group: 'standard',   align: 'right', cell: (r) => fmtMetric(r.comet_score, 3) },
      { w: 7,  head: 'EM',    group: 'diagnostic', align: 'right', cell: (r) => fmtMetric(r.exact_match_rate) },
      { w: 7,  head: 'FST',   group: 'diagnostic', align: 'right', cell: (r) => fmtMetric(r.fst_acceptance_rate) },
      ...(showLegacy ? [{ w: 9, head: 'composite', group: 'legacy', align: 'right', cell: (r) => fmtMetric(legacyComposite(r), 4) }] : []),
      { w: 12, head: 'Date',                       cell: (r) => r.run_timestamp?.split('T')[0] || '—' },
      { w: 9,  head: 'Lane',                       cell: (r) => (rowIsRelativeOnly(r) ? 'rel-only' : 'abs') },
    ];
    const SEP = '  ';
    const GROUP_TITLES = { standard: 'standard metrics', diagnostic: 'diagnostics', legacy: 'legacy (retired)' };
    // Group line above the header: each group's title over its columns.
    let groupLine = '';
    for (let c = 0; c < cols.length; c++) {
      const g = cols[c].group;
      if (g && (c === 0 || cols[c - 1].group !== g)) {
        let span = 0;
        let k = c;
        while (k < cols.length && cols[k].group === g) { span += cols[k].w + SEP.length; k++; }
        groupLine += pad(`┌ ${GROUP_TITLES[g]}`, span - SEP.length) + SEP;
        c = k - 1;
      } else if (!g) {
        groupLine += ' '.repeat(cols[c].w) + SEP;
      }
    }
    const header = cols.map((c) => pad(c.head, c.w, c.align)).join(SEP);

    output.raw(`  ${groupLine.trimEnd()}`);
    output.raw(`  ${header}`);
    output.raw(`  ${'─'.repeat(header.length)}`);

    for (let i = 0; i < display.length; i++) {
      const row = display[i];
      const line = cols.map((c) => pad(c.cell(row, i), c.w, c.align)).join(SEP);
      output.raw(`  ${line}`);
    }

    output.raw('');
    output.raw(`  ${display.length} result${display.length !== 1 ? 's' : ''} shown.`);
    output.raw(`  Headline: chrF++ with its 95% bootstrap CI (${SCORING_STANDARD}); rows whose intervals overlap are not distinguishable.`);
    output.raw(`  Diagnostics (EM = exact match, FST = FST acceptance) explain a score; they never rank and are never blended into it.`);
    output.raw(`  Lane: abs = absolute-quality · rel-only = relative-comparison-only`);
    output.raw(`        (HIGH/MEDIUM contamination, FLORES, or unknown grade — compare within that corpus only)`);
    output.raw(`  → Install a method: champollion network leaderboard --install <rank>`);
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
  output.raw(`  Score:  chrF++ ${fmtChrf(row)}${chrfCi(row) ? ' (95% CI)' : ''}`);
  if (legacyComposite(row) != null) {
    output.raw(`          ${LEGACY_COMPOSITE_LABEL}: ${fmtMetric(legacyComposite(row), 4)} — scored before ${SCORING_STANDARD}; for the record only`);
  }
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
    output.raw('  Or auto-wire it: champollion network leaderboard --install ' + rank + ' --apply');
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

