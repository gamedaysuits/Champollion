/**
 * Generates `data/field.json` — the Translation Field dataset for the
 * homepage hero (Landing v3, the design log §"The Landing v3").
 *
 * The field's background visualization shows REAL translation flows:
 * a real corpus sentence drifts in, dissolves through a transformation
 * state, and crystallizes as the REAL model output from a recorded
 * benchmark run — with that RUN's corpus-level composite score attached
 * as the chip (the model × pair whole-corpus score, project decision
 * 2026-06-12).
 *
 * SOURCE = THE DB (design directive). This generator reads the
 * Arena scoreboard (Supabase run_cards + run_card_entries), the system of
 * record, filled by people running the harness (queue or solo). It NEVER
 * reads local harness run logs — those are run *outputs*, redundant once
 * published, and have no place in git or in the build.
 *
 * TRUTHFULNESS CONTRACT (cli/website/CLAIMS.md §"The Translation Field"
 * is binding):
 *   - Sources/references/predictions are copied verbatim from published
 *     run_card_entries — real corpus sentences, real model outputs.
 *   - LICENSE/SOVEREIGNTY GATE: a run is shown only if its dataset is
 *     plain CC-BY, not a held-out/gold-standard segment, and not
 *     quarantined (gateDataset() below). run_card_entries is anon-readable
 *     in full, so this gate — not RLS — is what keeps NC (EdTeKLA) and
 *     held-out reference text off the public homepage. Fail-closed: a run
 *     whose dataset row is absent (e.g. held-out rows hidden by RLS) is
 *     dropped.
 *   - The score the UI displays is the RUN's corpus-level composite
 *     (`runs[].composite`); per-entry chrF++ (`c`) stays as selection-audit
 *     data only — the renderer does not display it.
 *
 * Featured selection: one run per language pair (prefer the naive
 * condition, then most recent), newest pairs first — no score
 * cherry-picking. Pre-launch the scoreboard is empty, so field.json is
 * written empty and the hero is sparse; it self-populates as runs publish.
 *
 * Dissolution-mode hints (`m`) implement the Morph v2 guardrail
 * (the design log §"The Morph v2"): a transition state may be
 * suggested by the MEANING of the sentence (keyword match on the source
 * text), never by the language. The hint is pure choreography — no claim.
 */

const fs = require('fs-extra');
const {fetchRunsAndDatasets, fetchRunEntries} = require('./supabaseRuns');

/** How many language pairs to feature in the hero field. */
const FIELD_LIMIT = 10;

/** ISO 639-3 prefix → display name for sources (fallback only). */
const ISO_NAMES = {eng: 'English', dan: 'Danish', deu: 'German', spa: 'Spanish'};

/** Target languages written right-to-left (canvas needs the direction). */
const RTL_TARGETS = new Set(['arb', 'urd']);

/** Length limits — field text must stay one quiet line. */
const MAX_SOURCE = 44;
const MAX_TARGET = 46;

/** Per pair: 2 high + 2 mid + 1 low scoring entries (honest spread). */
const BUCKETS = [
  {min: 65, take: 2},
  {min: 40, max: 65, take: 2},
  {max: 40, take: 1},
];

/**
 * Semantics → transition-state hints (the Morph v2 guardrail: linked to
 * the MEANING of the sentence, never to a language). English-source
 * keyword match only; conservative on purpose.
 */
const MODE_HINTS = [
  {mode: 'water', re: /\b(water|sea|ocean|rain|river|lake|swim|wave|wet)\b/i},
  {mode: 'embers', re: /\b(fire|burn|flame|hot|sun|star|stars|light)\b/i},
  {mode: 'petals', re: /\b(flower|rose|roses|garden|tree|spring|bloom|plant)\b/i},
  {mode: 'murmuration', re: /\b(bird|birds|fly|flies|flew|sky|wing)\b/i},
  {mode: 'sand', re: /\b(sand|desert|dust|earth|stone|ground|mountain)\b/i},
  {mode: 'mist', re: /\b(speak|spoke|say|said|word|words|breath|wind|fog|voice|sing|sang|sings)\b/i},
];

function modeHint(source) {
  for (const h of MODE_HINTS) {
    if (h.re.test(source)) return h.mode;
  }
  return null;
}

function round1(x) {
  return Math.round(x * 10) / 10;
}

/** Plain CC-BY only (matches the legacy registry gate). */
function isPlainCcBy(license) {
  return /^CC-BY(-\d|\s|$)/i.test(license || '');
}

/**
 * License/segment/quarantine gate. Returns the dataset row if the run may
 * appear on the public homepage, else null (fail-closed).
 */
function gateDataset(run, dsById) {
  const d = dsById.get(run.dataset_id);
  if (!d) return null; // no public dataset row (held-out hidden by RLS, etc.)
  if (!isPlainCcBy(d.license)) return null;
  if (d.segment === 'held_out' || d.segment === 'gold_standard') return null;
  if (d.quarantined) return null;
  return d;
}

function runTs(r) {
  return Date.parse(r.run_timestamp || r.submitted_at || '') || 0;
}

/** One run per language pair: prefer the naive condition, then most recent. */
function selectFeatured(runs, limit) {
  const byPair = new Map();
  for (const r of runs) {
    const cur = byPair.get(r.language_pair);
    if (!cur) {
      byPair.set(r.language_pair, r);
      continue;
    }
    const rNaive = r.condition === 'naive';
    const curNaive = cur.condition === 'naive';
    const better = rNaive !== curNaive ? rNaive : runTs(r) > runTs(cur);
    if (better) byPair.set(r.language_pair, r);
  }
  return [...byPair.values()].sort((a, b) => runTs(b) - runTs(a)).slice(0, limit);
}

/**
 * Deterministically select entries from one run's entry rows.
 * Entries are sorted by id, then bucketed by per-entry chrF++; each
 * bucket contributes its first N qualifying entries.
 */
function selectEntries(entries) {
  const ok = entries
    .filter(
      (e) =>
        !e.error &&
        e.predicted &&
        e.expected &&
        typeof e.chrf_score === 'number' &&
        e.source.length <= MAX_SOURCE &&
        e.predicted.length <= MAX_TARGET &&
        e.expected.length <= MAX_TARGET &&
        !/\n/.test(e.source + e.predicted + e.expected),
    )
    .sort((a, b) => String(a.id).localeCompare(String(b.id)));
  const picked = [];
  for (const b of BUCKETS) {
    let n = 0;
    for (const e of ok) {
      if (n >= b.take) break;
      if (picked.includes(e)) continue;
      if (b.min != null && e.chrf_score < b.min) continue;
      if (b.max != null && e.chrf_score >= b.max) continue;
      picked.push(e);
      n += 1;
    }
  }
  return picked;
}

async function writeEmpty(outFile, reason) {
  await fs.writeJson(outFile, {
    generated: new Date().toISOString().slice(0, 10),
    source: 'supabase:run_cards',
    note: `No publishable runs (${reason}). The homepage hero is sparse until benchmarked runs publish to the Arena scoreboard.`,
    runs: [],
    flows: [],
  });
}

/**
 * @param {object} opts
 * @param {string} opts.outFile — data/field.json
 * @param {number} [opts.limit] — number of pairs to feature
 */
async function generateFieldJson({outFile, limit = FIELD_LIMIT}) {
  let runsRaw;
  let datasets;
  try {
    ({runs: runsRaw, datasets} = await fetchRunsAndDatasets());
  } catch (err) {
    // Network/DB unreachable: keep the committed snapshot rather than
    // blank the hero or fail the build.
    if (await fs.pathExists(outFile)) {
      console.log(
        `[shared-data] field.json: scoreboard unreachable (${err.message}) — keeping committed snapshot`,
      );
      return;
    }
    await writeEmpty(outFile, 'scoreboard unreachable');
    return;
  }

  const dsById = new Map(datasets.map((d) => [d.id, d]));
  const eligible = runsRaw.filter((r) => gateDataset(r, dsById));
  const featured = selectFeatured(eligible, limit);

  const runs = [];
  const flows = [];
  for (const run of featured) {
    const d = gateDataset(run, dsById);
    const m = /^([a-z]{2,3})>([a-z]{2,3})$/.exec(run.language_pair || '');
    if (!m) continue;
    const [, srcIso, tgtIso] = m;
    const runIdx = runs.length;
    runs.push({
      id: run.id,
      model: run.model_slug,
      pair: `${srcIso} → ${tgtIso}`.toUpperCase(),
      source_lang: d.source_language || ISO_NAMES[srcIso] || srcIso,
      target_lang: d.target_language || tgtIso,
      corpus: `${srcIso}-${tgtIso}`,
      license: d.license,
      attribution: d.source,
      corpus_chrf:
        typeof run.chrf_plus_plus === 'number' ? run.chrf_plus_plus : null,
      composite: Math.round(run.composite_score * 100) / 100,
    });
    let rows;
    try {
      rows = await fetchRunEntries(run.id);
    } catch (err) {
      console.log(
        `[shared-data] field.json: entries for ${run.id} unreachable (${err.message}) — route kept, no flows`,
      );
      continue;
    }
    const entries = rows.map((e) => ({
      id: e.entry_id,
      source: e.source,
      predicted: e.predicted,
      expected: e.expected,
      chrf_score: e.chrf_score,
    }));
    for (const e of selectEntries(entries)) {
      flows.push({
        r: runIdx,
        id: e.id,
        s: e.source,
        t: e.predicted,
        e: e.expected,
        c: round1(e.chrf_score),
        ...(RTL_TARGETS.has(tgtIso) ? {d: 'rtl'} : {}),
        ...(modeHint(e.source) ? {m: modeHint(e.source)} : {}),
      });
    }
  }

  if (runs.length === 0) {
    await writeEmpty(outFile, 'scoreboard empty');
    console.log('[shared-data] field.json: no publishable runs yet — wrote empty field');
    return;
  }

  const out = {
    generated: new Date().toISOString().slice(0, 10),
    source: 'supabase:run_cards',
    note:
      'Real benchmark data from the Arena scoreboard (Supabase run_cards / ' +
      'run_card_entries) — never local logs. Sources/references/predictions ' +
      'are verbatim published entries; gated to plain-CC-BY, non-held-out, ' +
      'non-quarantined datasets. Displayed score: runs[].composite — the ' +
      "run's corpus-level composite. c is that entry's per-entry chrF++, kept " +
      'for selection audit only (not displayed). See cli/website/CLAIMS.md ' +
      '§"The Translation Field".',
    runs,
    flows,
  };
  await fs.writeJson(outFile, out);
  console.log(
    `[shared-data] Wrote ${flows.length} field flows from ${runs.length} runs (DB) to ${outFile}`,
  );
}

module.exports = {generateFieldJson};
