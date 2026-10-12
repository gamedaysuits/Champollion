/**
 * language_overview — the north-star stage-1 answer.
 *
 * "Let's build a Cree model for our school — how do we get started?" needs
 * one answer that says what exists and what to do next, each step naming the
 * exact tool or command. This composes the other tools' logic (never a
 * parallel implementation):
 *
 *   what the index knows      get_language        (the CLI's card resolver)
 *   benchmarks that exist     list_corpora        (the corpus registry)
 *   published results         get_results         (the public leaderboard)
 *   methods + evidence        the CLI's own `champollion network recommend` logic
 *                             (lib/recommend.js) + the card's listings
 *   contests                  list_contests       (anon-readable)
 *   licence / consent         the corpora's licence lanes + the transmission
 *                             rule the harness enforces
 *   FST usable here?          the installed harness's own FST pins
 *                             (harness-fst.js) — kept apart from the card's
 *                             "an FST exists"
 *
 * Every section degrades to an explicit "unavailable: why" line — a slow or
 * missing source never sinks the whole answer, and never reads as "none".
 */

import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

import { getLanguage, speakerClaimTexts, summarizeCard } from './language-card.js';
import { selectCorpora } from './corpora.js';
import { fetchResults, formatChrf } from './results.js';
import { listContests } from './contests.js';
import { METHOD_KEYLESS } from './translate.js';
import { probeHarnessFst, formatFstLines } from './harness-fst.js';
import { count, plural } from './plural.js';
import {
  registerLocalOnlyCommand, REGISTER_LOCAL_ONLY_EFFECT, forgeBeforeBaselineSteps, BENCHMARK_IS_A_SCORING_READ,
} from './register-corpus-hint.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

const SECTION_TIMEOUT_MS = 35_000;

/** Import the CLI's recommend module (monorepo first, then the package). */
export async function loadRecommend() {
  const candidates = [resolve(__dirname, '../../../cli/lib/recommend.js')];
  try {
    candidates.push(resolve(dirname(require.resolve('champollion')), 'lib', 'recommend.js'));
  } catch { /* no installed champollion package */ }
  for (const p of candidates) {
    if (!existsSync(p)) continue;
    try {
      const mod = await import(pathToFileURL(p).href);
      if (typeof mod.recommend === 'function') return mod;
    } catch { /* try the next */ }
  }
  return null;
}

/** Run one section with a time bound; never throws. */
async function section(fn) {
  let timer;
  try {
    return await Promise.race([
      Promise.resolve().then(fn).then((value) => ({ ok: true, value })),
      new Promise((done) => {
        timer = setTimeout(() => done({ ok: false, error: `timed out after ${SECTION_TIMEOUT_MS / 1000}s` }), SECTION_TIMEOUT_MS);
      }),
    ]);
  } catch (err) {
    return { ok: false, error: err.message };
  } finally {
    clearTimeout(timer);
  }
}

/** The transmission lane the harness applies to a corpus licence (summary). */
export function licenceLane(license) {
  const l = String(license || '');
  if (!l) return 'unstated';
  if (/^LicenseRef-/i.test(l)) return 'consent';
  if (/(^|[-\s])NC([-\s]|$)|NonCommercial/i.test(l)) return 'nc';
  return 'open';
}

/**
 * The open models to try with local-model: the CLI's ONE selection
 * (`declaredModelCandidates` in cli/lib/recommend.js, carried on the
 * recommend payload as `declared_models`) — the same list `champollion
 * network recommend` prints. This file kept its own copy of the rule until
 * Round 11, and the two disagreed. Only candidates the payload marks
 * runnable (a local-model engine in this registry, allowed in the lane);
 * none when the recommend logic is unavailable.
 */
function localModelCandidates(rec) {
  const d = rec?.ok ? rec.value?.declared_models : null;
  return (Array.isArray(d?.candidates) ? d.candidates : [])
    .filter((c) => c && c.runnable !== false && typeof c.id === 'string' && c.id)
    .map((c) => c.id);
}

/**
 * Assemble the overview. Pure apart from the injected loaders.
 *
 * @param {{code: string, source?: string}} args
 * @param {object} [deps]  champollion, index, corpora, results, contests, recommend,
 *   harnessFst ((codes) => probe; see harness-fst.js)
 */
/**
 * ISO 639-3 reserves qaa–qtz for local (private) use: a code no registry
 * assigns, so no language card can exist for it. forge init and champollion
 * init both accept one for a variety the community has not yet confirmed.
 */
export function isPrivateUseCode(code) {
  const c = String(code ?? '').trim().toLowerCase();
  return /^q[a-t][a-z]$/.test(c);
}

export async function languageOverview({ code, source = 'eng' }, deps = {}) {
  if (isPrivateUseCode(code)) {
    // Not a lookup failure: no card exists for it BY DESIGN. Round 9's
    // hospital persona got "No language card… use search_languages" — a
    // dead end — while forge init and champollion init both accept the code.
    return { status: 'private-use', code: String(code).trim().toLowerCase(),
      source: String(source || 'eng').trim().toLowerCase() };
  }
  let lang = await getLanguage(code, { champollion: deps.champollion, index: deps.index });
  if (lang.status !== 'ok' && lang.nameOnly) {
    // Catalogued by name, no published card: the benchmarks, results and next
    // steps do not depend on the card, so the overview still answers — with
    // the index section saying plainly that there is nothing cited to show.
    lang = {
      status: 'ok',
      code: lang.nameOnly.code,
      tierNote: 'no published card — the language is catalogued by name only',
      summary: summarizeCard({ code: lang.nameOnly.code, name: lang.nameOnly.name }, { tier: 'remote' }),
    };
  }
  if (lang.status !== 'ok') return { status: lang.status, note: lang.note, language: lang };
  const tgt = lang.code;
  const src = String(source || 'eng').trim().toLowerCase();

  const [corpora, results, contests, rec, fst] = await Promise.all([
    // The whole list (≤ 100) so the licence counts below cover every listed
    // corpus, not just the five shown.
    section(() => (deps.corpora ?? selectCorpora)({ target_language: tgt, limit: 100 })),
    section(() => (deps.results ?? fetchResults)({ target_language: tgt, limit: 3, sort: 'chrf' })),
    section(() => (deps.contests ?? listContests)({ language: tgt, status: 'all', limit: 5 })),
    section(async () => {
      const mod = deps.recommend !== undefined ? deps.recommend : await loadRecommend();
      if (!mod) return null;
      return mod.recommend(src, tgt, { useContext: 'non-commercial' });
    }),
    // The card says an FST EXISTS; only the harness can say whether it can
    // download and load one here (its pins). Kalaallisut's card lists lang-kal
    // and the harness has no pin for it — the overview used to read the card
    // line as if the FST metrics would run.
    section(() => (deps.harnessFst ?? probeHarnessFst)([tgt])),
  ]);

  return { status: 'ok', code: tgt, source: src, language: lang, corpora, results, contests, rec, fst };
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

function unavailable(label, s) {
  return `${label}: unavailable right now (${s.error}).`;
}

/**
 * The overview for a private-use code (qaa–qtz): what the code is, what it
 * means here, and what still applies — every step a tool or command.
 */
export function formatPrivateUseOverview(o) {
  const c = o.code;
  const src = o.source || 'eng';
  return [
    `# ${c} — an ISO 639-3 private-use code`,
    `${c} is in the range qaa–qtz that ISO 639-3 reserves for local use: no registry assigns it, so no `
      + 'public language card exists for it — by design, not a gap in the index. Communities use one while '
      + 'the variety they speak is not yet confirmed.',
    '',
    'What that means here: no cited card facts (family, speakers, scripts), no FST or other evaluation tools, '
      + 'and no registered benchmarks, published results or contests — all of those are keyed by real codes. '
      + 'A model can still be measured and built; everything a card would say is simply unknown.',
    '',
    'WHAT STILL APPLIES (each names the exact tool or command):',
    '1. Candidate varieties. search_languages { "query": "<the language\'s name, or a place it is spoken>" } lists '
      + 'catalogued languages and dialects that match. If the community recognizes one, its real code unlocks its '
      + 'card (language_overview with that code). The choice is theirs — never pick one for them.',
    '2. Protect your data first. Keep the community\'s sentences on your machine: '
      + `\`${registerLocalOnlyCommand({ pair: `${src}-${c}` })}\` — ${REGISTER_LOCAL_ONLY_EFFECT}. `
      + `The corpus card it writes states the pair (${src}-${c}), so run_benchmark passes ${c} to the harness as the target code.`,
    // Round 10: the preregistration comes before the baseline (the guide's
    // order) — a benchmark of the test file is a scoring read.
    '3. If a model may ever be trained on your data: register, screen, predict — BEFORE any score. '
      + `${forgeBeforeBaselineSteps({ code: c, noCard: true })}. Do this before step 4: ${BENCHMARK_IS_A_SCORING_READ}. `
      + 'NEXT_STEPS.md in the project says what the private-use code costs. Not training? Skip to step 4.',
    '4. Baseline — measure what exists on YOUR test set (a real one, never synthetic; after step 3\'s predictions if you may train against it):',
    `   run_benchmark { "corpus": "/path/to/test.jsonl", "provider": "local", "model": "llama3.1", "target_language": "<the language's name>", "dry_run": true }`,
    '   (the prompt names the language as given; scoring is generic — chrF++, BLEU, exact match and the behavioural checks).',
    '5. Build, in the step-3 project: forge_split the cleaned corpus (test: 0) → forge_preflight { "target": "run" } → '
      + '`nmt-forge run config.json` in a terminal; forge_status names the next step at any point.',
    `6. App translation. \`champollion init --langs ${c} --name ${c}="<name> (variety not yet confirmed)"\` — the name is what the model is told.`,
    `7. When the community confirms the variety and its ISO 639-3 code: language_overview with that code shows its card, `
      + '`nmt-forge init <code>` in the project directory moves the project to it, and new runs carry the real code.',
  ].join('\n');
}

/** Agent-readable overview text. */
export function formatOverview(o) {
  if (o.status === 'private-use') return formatPrivateUseOverview(o);
  if (o.status !== 'ok') return o.note;
  const L = o.language.summary;
  const out = [];
  const name = L.name;

  // ---- 1. What the index knows -------------------------------------------
  out.push(`# ${name} (${o.code}) — what exists, and how to start`);
  // The index invariant: when sources disagree, every value is shown with
  // its source — none elected. This line used to keep three unattributed
  // endangerment values (Plains Cree has five assessments from three
  // sources) and joined disputed families without saying whose they were.
  const attributed = (list) => {
    const seen = new Set();
    const shown = [];
    for (const c of list) {
      const k = `${c.value}\u0000${c.source}`;
      if (seen.has(k)) continue;
      seen.add(k);
      shown.push(`${c.value} [${c.source || 'source not stated'}]`);
    }
    return shown.join('; ');
  };
  const disputed = (list) => new Set(list.map((c) => c.value)).size > 1;
  const fam = L.isolate ? 'isolate' : (L.family.length
    ? (disputed(L.family) ? `sources differ: ${attributed(L.family)}` : L.family[0].value) : 'family not asserted');
  // Each claim with its year and scope note, and — for two claims from one
  // source — what tells them apart, or that the card says nothing that does
  // (Round 13: ELCat's "10-99" is British Columbia only; the line dropped it).
  const spk = L.speakers.length
    ? speakerClaimTexts(L.speakers).join('; ')
    : 'no cited speaker estimate';
  const end = L.endangerment.length
    ? `${disputed(L.endangerment) ? 'sources differ: ' : ''}${attributed(L.endangerment)}`
    : (L.vitality ? `${L.vitality.tier} (derived)` : 'not assessed');
  out.push(`Index: ${fam} · speakers ${spk} · endangerment ${end} · scripts ${L.scripts.map((s) => s.code).join(', ') || 'not asserted'}`);
  out.push(`(card: ${o.language.tierNote}; full cited card: get_language { "code": "${o.code}" })`);

  // ---- 2. Tooling -----------------------------------------------------------
  const R = L.resources;
  const tools = [
    R.fsts.length && `FST/analyzer ×${R.fsts.length} (${R.fsts.map((t) => t.publisher).filter(Boolean).join(', ')})`,
    R.dictionaries.length && `dictionary ×${R.dictionaries.length}`,
    R.keyboards.length && `keyboard ×${R.keyboards.length}`,
    R.parallelCorpora.length && `public parallel text: ${[...R.parallelCorpora]
      .sort((a, b) => (b.alignmentPairs ?? -1) - (a.alignmentPairs ?? -1)).slice(0, 3)
      .map((p) => `${p.corpus} ${p.alignmentPairs == null ? '? pairs' : count(p.alignmentPairs, 'pair')}`).join(', ')}`
      + (R.parallelCorpora.length > 3 ? ` (+${R.parallelCorpora.length - 3} more OPUS corpora)` : ''),
    R.lexicalDatasets.length && `wordlists ×${R.lexicalDatasets.length}`,
    R.documentation && `documentation: ${R.documentation.level}`,
  ].filter(Boolean);
  out.push(`Tooling: ${tools.length ? tools.join(' · ') : 'none listed on this card'}`
    + (L.absent.length && tools.length < 3 ? ' (absent ≠ none — see get_language for what the card does not cover)' : ''));
  // Existence (the card) vs. usable by the harness here (its pins), per FST.
  out.push(...formatFstLines(o.code, R.fsts, o.fst));

  // ---- 3. Benchmarks --------------------------------------------------------
  out.push('');
  let runnable = [];
  if (!o.corpora.ok) {
    out.push(unavailable('Benchmarks', o.corpora));
  } else {
    const c = o.corpora.value;
    runnable = c.items.filter((i) => !i.quarantine);
    out.push(`Benchmarks (registered eval corpora into ${o.code}): ${c.total} runnable`
      + `${c.hiddenQuarantined ? `, ${c.hiddenQuarantined} quarantined (catalogued, never runnable or rankable)` : ''}`
      + ` · source: ${c.source}`);
    for (const i of runnable.slice(0, 5)) {
      out.push(`  - ${i.id}  ${i.source}→${i.target}  ${i.size == null ? '? rows' : count(i.size, 'row')}  ${i.license || 'licence ?'}  contamination ${i.contamination || '?'}  ${i.availability}`);
    }
    if (c.total === 0) {
      out.push('  None registered — normal for most languages. Your own private test set is the benchmark (step 2).');
    }
  }

  // ---- 4. Published results -----------------------------------------------
  if (!o.results.ok) {
    out.push(unavailable('Published results', o.results));
  } else if (!o.results.value.length) {
    out.push(`Published results: none on the public leaderboard for →${o.code} yet.`);
  } else {
    // Scoring standard/1: ranked by chrF++, shown with its 95% CI.
    out.push('Published results (top by chrF++, with its 95% CI; get_results for more):');
    for (const r of o.results.value) {
      out.push(`  - ${r.pair}  ${r.model}  ${formatChrf(r.chrf, r.chrf_ci)}  ${r.trust}${r.relative_only ? '  ⚠ relative-only' : ''}`);
    }
  }

  // ---- 5. Methods ------------------------------------------------------------
  out.push('');
  const M = L.methods;
  const listed = Object.entries(M.services).filter(([, v]) => v).map(([k]) => k);
  out.push(`Methods — services listing ${name}: ${listed.length ? listed.join(', ') : 'none'}`
    + `${M.declaredModels.length ? ` · open models whose card declares it: ${M.declaredTotal} (a claim, not a measurement)` : ''}`
    + ' · LLMs will attempt it (quality unmeasured until benchmarked).');
  if (!o.rec.ok) {
    out.push(unavailable('Runnable here', o.rec));
  } else if (!o.rec.value) {
    out.push('Runnable here: the CLI\'s recommend logic is not importable in this install — run `champollion network recommend '
      + `${o.source} ${o.code}\` in a terminal.`);
  } else {
    const r = o.rec.value;
    // The CLI's availability check treats the local engine's endpoint vars as
    // credentials and reports "needs-key"; the method registry says its
    // default endpoint is this machine (keyless — METHOD_KEYLESS). Report it
    // as a local engine, not as a key the user lacks.
    const availability = (m) => (m.availability === 'needs-key' && METHOD_KEYLESS[m.cli_name || m.method]
      ? 'local-setup' : m.availability);
    const by = (a) => r.runnable_methods.filter((m) => m.lane_ok !== false && availability(m) === a)
      .map((m) => m.cli_name && m.cli_name !== m.method ? `${m.method} (${m.cli_name})` : m.method);
    const ready = by('ready');
    // Runnable, but whether the service covers this pair is not indexed
    // (cli/lib/recommend.js): listed, never counted as ready.
    const unverified = by('unverified');
    const local = by('local-setup');
    const needs = by('needs-key');
    out.push(`Runnable here: ${ready.length ? `READY ${ready.join(', ')}` : 'nothing ready (no API key set)'}`
      + `${unverified.length ? ` · UNVERIFIED (coverage of this pair not indexed — check the service) ${unverified.join(', ')}` : ''}`
      + `${local.length ? ` · LOCAL ${local.join(', ')}` : ''}`
      + `${needs.length ? ` · needs a key: ${needs.slice(0, 6).join(', ')}${needs.length > 6 ? '…' : ''}` : ''}`);
    const ev = r.curated_evidence.length + r.bulk_evidence.length;
    out.push(`Published evidence for ${o.source}→${o.code}: ${ev ? `${count(ev, 'cited datapoint')} — \`champollion network recommend ${o.source} ${o.code}\` lists ${plural(ev, 'it', 'them')} (relative ordering only)` : 'none indexed — measure instead of guessing'}.`);
    const rel = r.metric_reliability;
    // A family read from the card (WMT never judged the language) can rest on
    // ONE source's classification when the card's sources disagree — say so,
    // or the line reads as if Champollion had picked a winner.
    const basis = rel?.family_basis;
    const split = basis && Array.isArray(basis.claims)
      && basis.claims.some((c) => c && c.value !== rel.target_family);
    const restsOn = split
      ? ` — the card's family sources disagree; this rests on ${(basis.matched_sources || []).filter(Boolean).join(', ') || 'one source'}'s classification alone`
      : '';
    out.push(rel
      ? `Metric trust: family-level evidence for ${rel.target_family}${rel.exact_pairs_measured.length ? '' : ' (this language itself never judged — transfer is an assumption)'}${restsOn} — get_metric_reliability { "target": "${o.code}" }.`
      : `Metric trust: UNMEASURED for ${o.code} — no WMT human-judgment study covers it; native-speaker judgment is the real signal.`);
  }

  // ---- 6. Licence & consent -------------------------------------------------
  out.push('');
  const lanes = { consent: 0, nc: 0, open: 0, unstated: 0 };
  let noTrain = 0;
  for (const i of runnable) {
    lanes[licenceLane(i.license)] += 1;
    if (i.do_not_train) noTrain += 1;
  }
  const lic = [];
  if (lanes.consent) lic.push(`${lanes.consent} ${plural(lanes.consent, 'carries', 'carry')} a bespoke licence (LicenseRef-*): the harness REFUSES remote evaluation until the rights-holder's consent is recorded — run ${plural(lanes.consent, 'it', 'them')} on a local model`);
  if (lanes.nc) lic.push(`${lanes.nc} ${plural(lanes.nc, 'is', 'are')} non-commercial: remote evaluation only over no-train channels, and the user must accept the NC terms (accept_nc_terms)`);
  if (noTrain) lic.push(`${noTrain} ${plural(noTrain, 'is', 'are')} marked do_not_train — never put ${plural(noTrain, 'it', 'them')} in a training mix`);
  const ofN = runnable.length ? ` (of the ${count(runnable.length, 'listed corpus', 'listed corpora')})` : '';
  out.push(`Licence & consent${lic.length ? ofN : ''}: ${lic.length ? lic.join('; ') : 'no registered corpora constrain you here'}. `
    + 'YOUR data stays yours: nothing is uploaded unless you choose; mark a file `<file>.champollion.json` = '
    + '{"transmission":"local-only"} and the harness refuses every remote model for it.');

  // ---- 7. Contests ------------------------------------------------------------
  if (o.contests.ok) {
    const cs = o.contests.value;
    out.push(`Contests for ${o.code}: ${cs.total ? cs.contests.map((c) => `${c.id} (${c.status})`).join(', ') + ' — get_contest for terms' : 'none visible'}.`);
  } else {
    out.push(unavailable('Contests', o.contests));
  }

  // ---- 8. Next steps -----------------------------------------------------------
  const lname = JSON.stringify(name);
  const localIds = localModelCandidates(o.rec);
  out.push('');
  out.push('NEXT STEPS (each names the exact tool or command):');
  out.push('1. Protect your data first. Keep your community\'s sentences on your machine: '
    + `\`${registerLocalOnlyCommand({ pair: `${o.source}-${o.code}` })}\` — ${REGISTER_LOCAL_ONLY_EFFECT}, `
    + 'so only a model on this machine can ever read the file (`--tier private` instead registers metadata only — text never uploaded). '
    + 'Decide WITH the community who may see what.');
  // Round 10 (school + hospital): the baseline used to come second and the
  // preregistration fourth, so an agent that followed the numbers in order
  // spent a scoring read first and forge then refused the predictions. The
  // order is the guide's: register, screen, predict — THEN measure.
  out.push('2. If a model may ever be trained on your data: register, screen, predict — BEFORE any score. '
    + `forge_discover { "code": "${o.code}" } shows what forge sees, then `
    + `${forgeBeforeBaselineSteps({ code: o.code })}. Do this before step 3: ${BENCHMARK_IS_A_SCORING_READ}. `
    + 'Install: `python3 -m pip install \'nmt-forge[hf]\'`. Not training? Skip to step 3.');
  out.push('3. Baseline — measure what exists on YOUR test set (a real one, never synthetic). If you may train against '
    + 'that test set, this comes AFTER step 2\'s predictions, never before:');
  out.push(`   run_benchmark { "corpus": "/path/to/test.jsonl", "provider": "local", "model": "llama3.1", "target_language": ${lname}, "dry_run": true }`
    + '  (a model on this machine via Ollama; then confirm: true)');
  if (localIds.length) {
    out.push(`   run_benchmark { "corpus": "/path/to/test.jsonl", "method": "local-model", "model": "${localIds[0]}", "dry_run": true }`
      + `  (its model card declares ${o.code} — a claim to benchmark, not a measurement; local-model runs seq2seq `
      + 'translation checkpoints — check the model card first; needs `python3 -m pip install \'mt-eval-harness[local-models]\'`; '
      + 'confirming downloads its weights from Hugging Face — the dry run says how much)');
  }
  if (runnable.length) {
    out.push(`   run_benchmark { "corpus": "${runnable[0].id}", "provider": "openrouter", "model": "<slug>", "attest_no_training": true, "dry_run": true }`
      + '  (a registered benchmark; the harness enforces its licence)');
  }
  out.push('4. Build. get_training_guardrails first; in the step-2 project: forge_split the cleaned corpus (test: 0 when your '
    + 'test set is a separate file) → forge_preflight { "target": "run" } → `nmt-forge run config.json` in a terminal; '
    + 'forge_status names the next step at any point. '
    + (R.parallelCorpora.length
      ? `Public parallel text on the card: ${R.parallelCorpora.reduce((n, p) => n + (p.alignmentPairs ?? 0), 0).toLocaleString('en-US')} aligned pairs across ${R.parallelCorpora.length} OPUS ${R.parallelCorpora.length === 1 ? 'corpus' : 'corpora'} (check each licence and the do_not_train flags before training on any of it). `
      : 'No public parallel text is listed — your own aligned sentences are the training data. ')
    + 'forge sets no minimum size: its group-disjoint split, dev fence and bootstrap CIs make a too-small set show up as wide intervals, not a flattering number.');
  out.push('5. Prove. After training, forge_export scores the test set once, judges it against its preregistration and packages the model '
    + '(forge_evaluate is the score-only half); forge_compare sets models side by side; get_metric_reliability for which metric to believe; '
    + 'have speakers judge outputs. Publish only with consent (run_benchmark publish: true writes to the public board).');
  out.push('6. Deploy. `nmt-forge serve <export dir>/model` in a terminal puts the model behind a local endpoint; then the `translate` tool or the '
    + 'champollion CLI (`champollion sync`) with method "local" and LOCAL_API_BASE set to its OpenAI-compatible /v1 URL '
    + '(model/DEPLOY.md in the export has the exact config; evaluation/ is never deployed) — the Translation Memory and quality gate apply to every output.');
  return out.join('\n');
}
