/**
 * The rails, walked: which step of a project's journey comes next.
 *
 * The journey itself is DATA (shared/journeys/<kind>.json): ordered steps,
 * each with a `done_when` check over the project's files. This module is the
 * one evaluator — `champollion next`, the MCP rails profile and (later) a GUI
 * all ask it the same question and get the same answer. The first step not
 * done is THE next step.
 *
 * Read-only and content-free: it lists data files and reads sidecars, the
 * project file and nmt-forge's registry — never a data file's text. It runs
 * nothing except, for the training stages, `nmt-forge status --json` (the
 * workshop's own advisor, bounded at 60 s) so forge's ladder is not restated
 * here and the two can never disagree.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { checkProject, readSet, PROJECT_FILE, SIDECAR_SUFFIX } from './index.js';
import { getLanguageCard, isPrivateUseCode } from '../registers.js';
import { currentRound, lastVerdict, roundPrepared, sheetProgress, trainedOnCurrent, readTime, timeNote } from './rounds.js';

const JOURNEY_DIRS = [
  path.join(import.meta.dirname, '..', '..', 'shared', 'journeys'),
  path.join(import.meta.dirname, '..', '..', '..', 'shared', 'journeys'),
];

/** Files beside data that are not data. */
const NOT_DATA = [SIDECAR_SUFFIX, '.reads.jsonl'];
const SKIP_DIRS = new Set(['node_modules', '.git', '.champollion', '.forge', '__pycache__']);

/** nmt-forge's bounded status call (founder rule: every step bounded). */
export const FORGE_STATUS_TIMEOUT_MS = 60_000;

/** forge advisor state → rails mode (anything else: auto). */
// Every advisor state forge can report, and what an agent may do with it.
// A state not listed is a PERSON's step (fail closed): an unknown state with a
// command used to run as \`auto\` — found by a code reviewer in the release
// candidate's evaluation (2026-10-18). test/rails-journey.test.js fails when
// forge gains a state this table does not name.
export const FORGE_MODES = {
  training: 'wait',
  // after the prediction is written and the model chosen: scored once, then
  // exported and served — forge's own automatic steps on the rails
  'ready-to-score': 'auto',
  exported: 'auto',
  // the people judge their own prediction (judgeStep asks with its slots;
  // this is the fallback should forge report it first)
  'judge-prediction': 'human_only',
  // states the journey's own steps come before (workshop, split, floor): if
  // forge reports them, a person looks
  'empty-workspace': 'human_only',
  initialized: 'human_only',
  'no-dev-set': 'human_only',
  'evaluated-no-model': 'human_only',
  serving: 'human_only',
  'ready-to-train': 'confirm',             // it spends compute, minutes to hours
  'needs-training-extra': 'confirm',       // a large download (torch, transformers)
  'missing-preregistration': 'ask_user',   // predictions are the user's own words
  'choose-export': 'human_only',
  // the improve loop: a round's verdict is forge's to compute; putting a
  // better model to use changes what the people's app or page answers — asked
  'improve-compare': 'auto',
  'improve-promote': 'confirm',
  // rounds that stopped moving the model: a stronger one is offered — a big
  // download and longer training, so the people answer yes or not now
  'improve-stronger-model': 'ask_user',
};

const journeyCache = new Map();

/** The journey for a project kind, read from shared/journeys/<kind>.json. */
export function loadJourney(kind) {
  if (journeyCache.has(kind)) return journeyCache.get(kind);
  for (const dir of JOURNEY_DIRS) {
    let text;
    try {
      text = fs.readFileSync(path.join(dir, `${kind}.json`), 'utf-8');
    } catch {
      continue;
    }
    const journey = JSON.parse(text);
    journeyCache.set(kind, journey);
    return journey;
  }
  return null;
}

function dataFiles(root, rel) {
  const out = [];
  const walk = (dir) => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      if (ent.name.startsWith('.')) continue;
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        if (!SKIP_DIRS.has(ent.name)) walk(full);
      } else if (ent.isFile() && !NOT_DATA.some((s) => ent.name.endsWith(s))) {
        out.push(path.relative(root, full).split(path.sep).join('/'));
      }
    }
  };
  walk(path.join(root, rel));
  return out.sort();
}

const TOOL_VERSION_TIMEOUT_MS = 30_000;

/** `<tool> --version` → "X.Y.Z" when its first line is the tool's own ("nmt-forge 0.3.0 …"), else null. */
function toolVersion(ctx, bin, name) {
  const res = (ctx.spawn || spawnSync)(bin, ['--version'], { encoding: 'utf-8', timeout: TOOL_VERSION_TIMEOUT_MS });
  const m = new RegExp(`^\\s*${name.replace(/[-]/g, '\\-')}\\s+v?(\\d+\\.\\d+\\.\\d+)`).exec(String(res.stdout || ''));
  return m ? m[1] : null;
}

/** "0.2.2" older than "0.2.3"? (numeric, major.minor.patch) */
function olderThan(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) < (pb[i] || 0);
  return false;
}

/** Where a command-line tool is, if anywhere: PATH, then uv's tool bin. */
export function findTool(tool, env = process.env) {
  // An explicit override wins (NMT_FORGE_BIN for nmt-forge — the MCP server
  // honours the same variable, so the two always agree on which tool runs).
  const override = env[`${tool.toUpperCase().replace(/-/g, '_')}_BIN`];
  if (override) return override;
  const exts = process.platform === 'win32' ? ['.exe', '.cmd', ''] : [''];
  const dirs = (env.PATH || '').split(path.delimiter).filter(Boolean);
  // `uv tool install` puts entry points here; a GUI-launched agent host may
  // not have it on PATH.
  dirs.push(env.UV_TOOL_BIN_DIR || path.join(os.homedir(), '.local', 'bin'));
  for (const dir of dirs) {
    for (const ext of exts) {
      const p = path.join(dir, tool + ext);
      try {
        if (fs.statSync(p).isFile()) return p;
      } catch { /* next */ }
    }
  }
  return null;
}

function forgeRegistry(root) {
  try {
    return JSON.parse(fs.readFileSync(path.join(root, '.forge', 'eval-registry.json'), 'utf-8'));
  } catch {
    return null;
  }
}

/**
 * The closed set of checks a journey step may use. Each returns
 * `{ done: boolean, file?: string }` — `file` names the data file a
 * not-done step is about.
 */
export const CHECKS = {
  project_valid: (ctx) => ({ done: ctx.report.project.exists && ctx.report.project.errors.length === 0 }),
  data_files: (ctx, spec) => ({ done: dataFiles(ctx.root, spec.dir).length >= (spec.min ?? 1) }),
  every_data_file_has_terms: (ctx, spec) => {
    for (const dir of spec.dirs) {
      for (const rel of dataFiles(ctx.root, dir)) {
        const side = readSet(path.join(ctx.root, rel));
        // a training term the TOOL set (x-training-default: scripture) is a
        // caution, not the holders' answer — they are still asked; and
        // whether everyone whose words are in it agreed is asked of every
        // file: nobody's words are trained on until that is answered (docs
        // review 2026-10-12 — a file marked training allowed with no answer
        // about its speakers was trained on)
        if (!side.exists || side.errors.length || !side.data?.terms?.training
          || !side.data?.terms?.speakers_agreed
          || side.data['x-training-default'] === true) return { done: false, file: rel };
      }
    }
    return { done: true };
  },
  protected_test_set: (ctx, spec) => {
    // EVERY file in data/test is the test set: one marked file used to make the
    // step done while a second one sat unmarked (Gemini 4 Argon, release-
    // candidate code review 2026-10-18)
    const files = dataFiles(ctx.root, spec.dir);
    const isMarked = (rel) => {
      const side = readSet(path.join(ctx.root, rel));
      return side.exists && !side.errors.length && side.data.role === 'test'
        && side.data.transmission === 'local-only';
    };
    const unmarked = files.find((rel) => !isMarked(rel));
    if (!files.length || unmarked) return { done: false, file: unmarked || files[0] };
    return { done: true, file: files[0] };
  },
  // present — and, with min_version, new enough: an older install would fail
  // a later step with "invalid choice" instead of saying it is too old
  tool_on_path: (ctx, spec) => {
    const tool = (ctx.findTool || findTool)(spec.tool);
    if (!tool) return { done: false };
    if (!spec.min_version) return { done: true };
    const found = toolVersion(ctx, tool, spec.tool);
    // a version line that is not the tool's own (a wrapper, a test double)
    // cannot be judged here; the tool's own steps still say what they need
    if (!found || !olderThan(found, spec.min_version)) return { done: true };
    return { done: false, variant: 'outdated', found, need: spec.min_version };
  },
  path_exists: (ctx, spec) => ({ done: fs.existsSync(path.join(ctx.root, spec.path)) }),
  // the project's own test file is the one registered: any test set used to
  // count, a stale or unrelated one included (GPT-6 Luna, release-candidate
  // code review 2026-10-18)
  forge_test_registered: (ctx) => {
    const reg = forgeRegistry(ctx.root);
    const sets = Object.values(reg?.sets || {}).filter((s) => s.role === 'test' || s.role === 'sealed');
    const own = dataFiles(ctx.root, 'data/test').map((rel) => realOrSelf(path.join(ctx.root, rel)));
    if (!own.length) return { done: sets.length > 0 };
    return { done: sets.some((s) => s.path && own.includes(realOrSelf(path.resolve(ctx.root, s.path)))) };
  },
  single_file: (ctx, spec) => ({ done: dataFiles(ctx.root, spec.dir).length === 1 }),
  forge_role_registered: (ctx, spec) => ({
    done: Object.values(forgeRegistry(ctx.root)?.sets || {}).some((s) => s.role === spec.role),
  }),
  forge_ledger_event: (ctx, spec) => ({
    done: forgeLedger(ctx.root).some((e) => e.event === spec.event),
  }),
  // enough screened pairs to train on: the leak screen's clean copies
  // (<dir>/*.clean.jsonl), counted — never read for their text
  // the improve loop (journey plan, Phase 2) — counts and hashes, never a sentence
  lines_in_file: (ctx, spec) => {
    let n = 0;
    try {
      n = fs.readFileSync(path.join(ctx.root, spec.path), 'utf-8').split(/\r?\n/).filter((l) => l.trim()).length;
    } catch { /* not written yet */ }
    return { done: n >= (spec.min ?? 1), found: n, need: spec.min ?? 1 };
  },
  review_marked: (ctx, spec) => {
    const p = sheetProgress(path.join(ctx.root, spec.path));
    const need = Math.ceil(p.rows * (spec.min_share ?? 1));
    return { done: p.exists && p.rows > 0 && p.marked >= need, found: p.marked, need: p.rows };
  },
  improve_prepared: (ctx) => ({ done: roundPrepared(ctx.root, ctx.round) }),
  forge_trained_on_current: (ctx) => ({ done: trainedOnCurrent(ctx.root) }),
  screened_rows: (ctx, spec) => {
    let kept = 0;
    let dir;
    try {
      dir = fs.readdirSync(path.join(ctx.root, spec.dir));
    } catch {
      dir = [];
    }
    for (const name of dir.filter((n) => n.endsWith('.clean.jsonl'))) {
      const text = fs.readFileSync(path.join(ctx.root, spec.dir, name), 'utf-8');
      kept += text.split('\n').filter((l) => l.trim()).length;
    }
    return { done: kept >= spec.min, found: kept, need: spec.min };
  },
};

/** forge's ledger events (content-free records), or [] when there is none. */
function forgeLedger(root) {
  let text;
  try {
    text = fs.readFileSync(path.join(root, '.forge', 'ledger.jsonl'), 'utf-8');
  } catch {
    return [];
  }
  return text.split('\n').filter((l) => l.trim()).map((l) => {
    try { return JSON.parse(l); } catch { return {}; }
  });
}

/** The name forge registered the test set under, if any. */
function forgeTestSet(root) {
  const sets = forgeRegistry(root)?.sets || {};
  return Object.keys(sets).find((n) => sets[n].role === 'test' || sets[n].role === 'sealed') || null;
}

/** The checks a journey's `done_when` may name (the evaluator refuses others). */
export const CHECK_NAMES = Object.freeze(Object.keys(CHECKS));

/** A language's name: the one the project gives, else its card's, else its code. */
export function languageName(code, given) {
  if (given) return given;
  const card = isPrivateUseCode(code) ? null : getLanguageCard(code);
  return card?.name || code;
}

function fill(text, vars) {
  if (typeof text !== 'string') return text;
  return text.replace(/\{([a-z_]+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
}

// The command slots that hold ONE file path or set name: each is quoted as one
// argument. A file name is data, never part of the command: "a && nmt-forge
// run config.json #.tsv" in data/grammar turned answering its terms question
// into a training run (release-candidate code review, 2026-10-18). Slots that
// carry several arguments (forge_init_args, lexicon_files) are quoted when
// they are built.
const ONE_ARG_SLOTS = new Set(['file', 'test_file', 'corpus', 'corpus_stem', 'test_set']);

/** fill() for a command. */
function fillCommand(text, vars) {
  if (typeof text !== 'string') return text;
  return text.replace(/\{([a-z_]+)\}/g, (m, k) => {
    if (!(k in vars)) return m;
    return ONE_ARG_SLOTS.has(k) ? quote(String(vars[k])) : String(vars[k]);
  });
}

function realOrSelf(p) {
  try { return fs.realpathSync(p); } catch { return p; }
}

/** Characters a command would act on: a forge input's name must not hold them. */
const UNSAFE_NAME = /[&|;<>`$'"#\\(){}[\]*?!\n\r\t]/;

/** data/parallel and data/test files whose names a command would read as instructions. */
function unsafeDataNames(root) {
  const out = [];
  for (const dir of ['data/parallel', 'data/test']) {
    let names = [];
    try { names = fs.readdirSync(path.join(root, dir)); } catch { continue; }
    for (const n of names) if (UNSAFE_NAME.test(n)) out.push(`${dir}/${n}`);
  }
  return out;
}

/** A check's spec with its paths filled ({round}). */
function fillSpec(spec, vars) {
  return Object.fromEntries(Object.entries(spec || {}).map(([k, v]) => [k, fill(v, vars)]));
}

function stepId(journeyStepId, command) {
  const h = crypto.createHash('sha256').update(`${journeyStepId}\n${command || ''}`).digest('hex');
  return `${journeyStepId}:${h.slice(0, 8)}`;
}

function quote(arg) {
  return /^[A-Za-z0-9_./:=-]+$/.test(arg) ? arg : `"${String(arg).replace(/(["\\$`])/g, '\\$1')}"`;
}

/** Ask nmt-forge's own advisor, bounded. */
function forgeAdvice(ctx) {
  const tool = (ctx.findTool || findTool)('nmt-forge');
  if (!tool) return { error: 'nmt-forge is not installed (the tools step should have come first)' };
  const res = (ctx.spawn || spawnSync)(tool, ['status', '--json'], {
    cwd: ctx.root, encoding: 'utf-8', timeout: FORGE_STATUS_TIMEOUT_MS,
  });
  if (res.error?.code === 'ETIMEDOUT' || res.signal === 'SIGTERM') {
    return { error: `nmt-forge status did not answer within ${FORGE_STATUS_TIMEOUT_MS / 1000} s` };
  }
  if (res.error) return { error: `nmt-forge status could not run: ${res.error.message}` };
  try {
    const doc = JSON.parse(res.stdout);
    if (doc.error) return { error: `nmt-forge status refused: ${doc.error.message}` };
    return { advice: doc.advice, snapshot: doc.snapshot };
  } catch {
    return { error: `nmt-forge status gave no JSON (exit ${res.status})` };
  }
}

/**
 * What is true right now, from forge's own record — the lines an agent says
 * when it tells the people what has been done, and never more. Wave 1
 * (2026-10-12): the judges scored honesty 0 in 25 of 55 runs, nearly all for
 * "your model is live", "the test set is clean" or "the GPU run is done" said
 * before (or without) it being so. Counts and states only — never a sentence.
 */
// What a chrF++ number is, said with it — wave 2 (2026-10-18): small models
// told families "7.3 means 73% of the letters match". A fact, not a verdict.
const CHRF_WORDS = ' (chrF++ runs from 0 to 100: how closely the model\'s sentences match the speaker\'s own, '
  + 'character by character — not a percentage of anything; a fluent speaker decides what is good enough.)';

export function forgeFacts(snapshot) {
  const s = snapshot || {};
  const num = (v) => (typeof v === 'number' ? v : v && typeof v.score === 'number' ? v.score : null);
  const out = [];
  const runs = (s.runs || []).filter((r) => r.selected_checkpoint);
  if (!runs.length) out.push('No model has been trained yet.');
  else {
    const best = Math.max(...runs.map((r) => num(r.dev_score)).filter((x) => x !== null));
    out.push(`${runs.length} model${runs.length === 1 ? '' : 's'} trained`
      + (Number.isFinite(best) ? `; the best scores chrF++ ${best.toFixed(1)} on the practice (dev) sentences` : '') + '.');
  }
  // the test set's cleanliness, as the leak audit judged it — wave 1: 17 runs
  // called a test set "clean" the audit had not passed (or never ran)
  const audits = Object.entries(s.leak_audits || {});
  if (!audits.length) out.push('The test set has not been checked for leaks yet: nobody can call it clean.');
  for (const [name, a] of audits) {
    if ((a.severe || []).length && !a.twin_free_trained) {
      out.push(`The leak audit found copies of "${name}" test sentences in the training data: scores on it are not clean`
        + (a.twin_free ? ' until a model is trained on the twin-free file.' : '.'));
    } else if ((a.severe || []).length) {
      out.push(`The leak audit found copies of "${name}" test sentences in the training data; a model was trained on the twin-free file, and only its score is clean.`);
    } else if ((a.twins || []).length) {
      const n = Math.max(...a.twins.map((t) => t.near_twin_rows || 0));
      out.push(`The leak audit found ${n} near-copies of "${name}" test sentences in the training data (not severe): scores are reported with and without them.`);
    } else out.push(`The leak audit found no "${name}" test sentences in the training data.`);
  }
  const scored = (s.exports || []).filter((e) => num(e.score) !== null);
  out.push(scored.length
    ? `Scored on the locked test set ${scored.length} time${scored.length === 1 ? '' : 's'}; the latest: chrF++ ${num(scored[scored.length - 1].score).toFixed(1)}.` + CHRF_WORDS
    : 'Not scored on the locked test set yet.');
  const jobs = s.jobs || [];
  if (jobs.some((j) => j.kind === 'train' && j.state === 'running') || s.active_run) out.push('A training run is in progress.');
  const serving = jobs.filter((j) => j.kind === 'serve' && j.state === 'running' && j.healthy && j.health_url);
  out.push(serving.length
    ? `A model is being served on this computer: ${serving[serving.length - 1].health_url.replace(/\/health\/?$/, '/')}`
    : 'No model is being served right now.');
  return out;
}

/**
 * Files waiting for the agreement of the people whose words they hold
 * (speakers_agreed: not-yet) — each a question the people can answer when
 * they have it, without holding up the rest of the rails. Wave 1
 * (2026-10-12): four of five late-aunt runs ended at "I'll ask Lea and come
 * back"; there was no "not yet" that let the other files go on.
 */
export function waitingForAgreement(root) {
  const out = [];
  for (const dir of ['data/parallel', 'data/not-for-training', 'data/lexicon', 'data/grammar', 'data/monolingual']) {
    for (const rel of dataFiles(root, dir)) {
      const side = readSet(path.join(root, rel));
      if (!side.exists || side.errors.length || side.data?.terms?.speakers_agreed !== 'not-yet') continue;
      // the holders' training answer is asked again with the yes, never assumed:
      // a "not-allowed" may have been theirs, not only the not-yet's (Opus 5.5
      // and Gemini 4 Argon, release-candidate code review 2026-10-18 — the
      // command wrote --training allowed over it)
      const command = `champollion data mark ${quote(rel)} --speakers-agreed yes --training {training}`
        + (side.data.transmission === 'local-only' ? '' : ' --may-leave');
      out.push({
        id: stepId('agreed', command), file: rel, mode: 'ask_user',
        question: `Have all the people whose words are in ${rel} (${side.data.terms.speakers || 'its speakers'}) `
          + 'agreed now that a model may learn from them? And now that they have, may a model learn from it — '
          + 'the holders\' answer (they may still say not-allowed)?',
        answers: { agreed: { enum: ['yes'] },
          training: { enum: ['allowed', 'not-allowed'], say: 'may a model learn from it now — the holders\' answer' } },
        command,
        say: `Nothing learns from ${rel} until the people whose words it holds agree. Ask once a session, `
          + 'gently — never press, never answer for them.',
      });
    }
  }
  return out;
}

/** Where the score falls against the numbers the people wrote — arithmetic,
 * not a verdict (wave 2: an agent told a family 12.3 was "outside" 10–25). */
export function rangeFact(predicted, observed) {
  if (typeof observed !== 'number') return '';
  const nums = (String(predicted).match(/\d+(?:\.\d+)?/g) || []).map(Number);
  if (nums.length === 2) {
    const [lo, hi] = nums[0] <= nums[1] ? nums : [nums[1], nums[0]];
    const where = observed >= lo && observed <= hi ? 'inside' : observed < lo ? 'below' : 'above';
    return ` ${observed.toFixed(1)} is ${where} the range ${lo}–${hi} they wrote.`;
  }
  if (nums.length === 1) return ` They wrote ${nums[0]}; it scored ${observed.toFixed(1)}.`;
  return '';
}

/** The first free-text prediction still waiting for a person's verdict, as a step. */
function judgeStep(snapshot) {
  for (const e of [...(snapshot?.exports || [])].reverse()) {
    const pre = e.prereg || {};
    const p = (pre.pending || [])[0];
    if (!p) continue;
    const ci = Array.isArray(p.observed_ci) && p.observed_ci.length === 2
      ? ` [${p.observed_ci[0].toFixed(2)}, ${p.observed_ci[1].toFixed(2)}]` : '';
    const observed = p.observed == null ? 'not scored' : `chrF++ ${p.observed.toFixed(2)}${ci}`;
    return {
      command: `nmt-forge prereg verdict ${pre.id} --prediction ${p.number} --{verdict} --by "{by}"`,
      question: `Before the model is used: they predicted "${p.predicted}", and it scored ${observed} `
        + `on their checked sentences.${rangeFact(p.predicted, p.observed)} Did the prediction hold? (Their answer, not yours.)`,
      say: 'The people who made the prediction judge it now. Their verdict is written beside the score, whatever it is.',
      answers: { verdict: { enum: ['held', 'missed'] }, by: { type: 'string', say: 'who judged it' } },
    };
  }
  return null;
}

/**
 * The next step for the project at `root`.
 *
 * @param {string} root
 * @param {object} [hooks] test seams: { findTool, spawn }
 * @returns {object} { project, kind, stage, step, done, forge?, error? }
 */
export function nextStep(root, hooks = {}) {
  const report = checkProject(root);
  const projectFile = path.join(root, PROJECT_FILE);
  let project = null;
  if (report.project.exists && !report.project.errors.length) {
    project = JSON.parse(fs.readFileSync(projectFile, 'utf-8'));
  }
  const kind = project?.kind || 'language';
  const journey = loadJourney(kind);
  if (!journey) {
    return { project: root, kind, error: `no journey for a "${kind}" project yet — `
      + 'only language projects are on the rails so far' };
  }
  // forge builds its commands from these files' paths: a name holding a
  // character a command acts on is renamed by a person before anything runs
  // (\`champollion data add\` never writes one)
  const unsafe = unsafeDataNames(root);
  if (unsafe.length) {
    return { project: root, kind, done: [],
      step: { id: stepId('rename-files', unsafe.join('\n')), mode: 'human_only',
        say: `Rename ${unsafe.length === 1 ? 'this file' : 'these files'} — ${unsafe.join(', ')} — to a name without `
          + '& | ; < > ` $ \' " # \\ ( ) { } [ ] * ? ! or line breaks: letters, numbers, spaces, dots, dashes and '
          + 'underscores are fine. A command the rails run names it, and these characters would be read as part '
          + 'of the command.',
        why: 'A file name is data, never an instruction to the tools.' } };
  }
  const pair = project?.pair || {};
  const vars = {
    project: '.',
    source_name: languageName(pair.source, pair.source_name),
    target_name: languageName(pair.target, pair.target_name),
  };
  if (pair.target) {
    const noCard = isPrivateUseCode(pair.target) || !getLanguageCard(pair.target);
    // --model auto: the strongest model this computer can train in hours —
    // ByT5-small on a GPU, else the tiny one, said why (founder, 2026-10-12:
    // "we are aiming for working models by default")
    vars.forge_init_args = [pair.target, '--dir', '.', '--pair', `${pair.source}-${pair.target}`,
      ...(noCard ? ['--no-card', '--name', vars.target_name] : []), '--model', 'auto'].map(quote).join(' ');
  }
  // the training pairs (when there is exactly one file) and the test set's
  // registered name — filled into the screen / predict commands
  const parallel = dataFiles(root, 'data/parallel');
  if (parallel.length === 1) {
    vars.corpus = parallel[0];
    vars.corpus_stem = path.basename(parallel[0]).replace(/\.[^.]+$/, '');
  }
  vars.test_set = forgeTestSet(root) || 'project-test';
  // the people's word lists, for the dictionary floor
  vars.lexicon_files = dataFiles(root, 'data/lexicon').map(quote).join(' ');
  // dev-set size convention: one in ten of the screened pairs, at least 50 (a
  // quarter when there are fewer than 200, so training keeps most), at most
  // 500 — below 50 no verdict rule decides a round (stress test 6, on G1's
  // outputs: at 23 sentences 9 wrong calls in 100 between near-equal models
  // and 21% of a real +5.9 gain seen; at 50, 4 and 96%); practice sentences
  // grow it later (counted, never read: lines of the clean copy the screen wrote)
  if (vars.corpus_stem) {
    try {
      const clean = fs.readFileSync(path.join(root, 'data', 'clean', `${vars.corpus_stem}.clean.jsonl`), 'utf-8');
      const n = clean.split('\n').filter((l) => l.trim()).length;
      vars.dev_n = Math.min(500, Math.max(Math.min(50, Math.round(n / 4)), Math.round(n / 10)));
      // near-copies kept on one side (forge's --near-dupe at the near-twin
      // threshold, 0.6), as every later round's leak screen does — before,
      // round 0's dev score kept near-copy memory that round 1 was denied
      // (FORGE_MACHINE_CRITIQUE finding 8); groups capped so no side
      // overshoots (forge's suggested_max_group: tolerance 1.5)
      vars.dev_max_group = Math.floor(0.5 * vars.dev_n) + 1;
    } catch { /* not screened yet: the screen step comes first */ }
  }
  // the improve loop's round: one past the rounds forge has judged, and the
  // last verdict, relayed as forge wrote it when the next round begins
  vars.round = currentRound(root);
  const verdict = lastVerdict(root);
  vars.round_result = verdict?.text ? `Round ${verdict.round}'s result: ${verdict.text} ` : '';
  // what they said the speaker can give, in their words, and what the rounds
  // so far say that time can buy
  vars.per_week = readTime(root)?.per_week || 'as much as they can';
  vars.time_note = timeNote(root);
  const ctx = { root, report, findTool: hooks.findTool, spawn: hooks.spawn, round: vars.round };
  const stages = journey.stages.map((s) => s.id);
  const done = [];
  let served = null;
  let now = null;                   // forge's facts, once forge is reached
  const waiting = waitingForAgreement(root);
  const withNow = (r) => ({ ...r, ...(now ? { now } : {}), ...(waiting.length ? { waiting } : {}) });
  for (const step of journey.steps) {
    const stageN = stages.indexOf(step.stage) + 1;
    const stage = { n: stageN, of: stages.length, id: step.stage,
      title: journey.stages[stageN - 1]?.title };
    if (step.delegate === 'nmt-forge') {
      const got = forgeAdvice(ctx);
      if (got.error) {
        return { project: root, kind, stage, done, error: got.error,
          step: { id: stepId(step.id, ''), mode: 'human_only', say: got.error, why: step.why } };
      }
      const a = got.advice;
      now = forgeFacts(got.snapshot);
      // A prediction the people wrote in their own words waits for THEM to
      // judge it against the score — the step before the model is put to use.
      const judge = a.state !== 'training' && judgeStep(got.snapshot);
      if (judge) {
        return withNow({ project: root, kind, stage, done,
          step: { id: stepId('judge', judge.command), mode: 'ask_user', ...judge, why: step.why },
          forge: { state: a.state, blockers: a.blockers || [], warnings: a.warnings || [] } });
      }
      // A served model ends a language project's rails: the people try it on
      // its page. An app or a website is what they may do next (forge's
      // words, kept as `finished`), never a step to stop at — a family with
      // no app was left at "connect it to your app" (model ladder, 2026-10-11).
      if (a.state === 'serving') {
        // a model in use: the improve stage's rounds come next, when the
        // journey has one (founder, 2026-10-11: serving is where making it
        // better starts, not where the rails end)
        if (journey.steps.some((st) => st.stage === 'improve')) {
          // what forge said about the model in use travels with the next step
          served = { state: a.state, why: a.why, ...(a.next_command ? { command: a.next_command } : {}),
            blockers: a.blockers || [], warnings: a.warnings || [] };
          done.push(step.id);
          continue;
        }
        return withNow({ project: root, kind, done: [...done, step.id], step: null, finished: a.why,
          forge: { state: a.state, blockers: a.blockers || [], warnings: a.warnings || [] } });
      }
      return withNow({
        project: root, kind, stage, done,
        step: {
          // no command from forge = nothing for an agent to run: the person's step
          id: stepId(`forge-${a.state}`, a.next_command),
          mode: FORGE_MODES[a.state] || 'human_only',
          say: a.why, why: step.why, command: a.next_command, source: 'nmt-forge status',
          // a step only the people can answer: forge names the slots
          ...(a.answers ? { answers: a.answers, question: a.why } : {}),
        },
        forge: { state: a.state, blockers: a.blockers || [], warnings: a.warnings || [] },
      });
    }
    const check = CHECKS[step.done_when?.check];
    if (!check) {
      throw new Error(`journey step "${step.id}" uses unknown check `
        + `"${step.done_when?.check}" (known: ${Object.keys(CHECKS).join(', ')})`);
    }
    // A step that applies only when its `when` check holds (the dictionary
    // floor needs a dictionary): otherwise it is passed over, not done.
    if (step.when) {
      const applies = CHECKS[step.when.check];
      if (!applies) {
        throw new Error(`journey step "${step.id}" uses unknown when-check "${step.when.check}"`);
      }
      if (!applies(ctx, fillSpec(step.when, vars)).done) continue;
    }
    const r = check(ctx, fillSpec(step.done_when, vars));
    if (r.done) {
      done.push(step.id);
      // a later step may need the file this one found (the marked test set)
      if (step.done_when.check === 'protected_test_set') vars.test_file = r.file;
      continue;
    }
    const local = { ...vars, file: r.file, test_file: vars.test_file || r.file, found: r.found, need: r.need };
    // a check may name a variant of its step (the tool is there, but too old)
    const s = r.variant && step[r.variant] ? { ...step, ...step[r.variant] } : step;
    const out = {
      id: stepId(step.id, fill(s.command, local)),
      mode: s.mode,
      say: fill(s.say, local),
      why: s.why,
    };
    if (s.command) out.command = fillCommand(s.command, local);
    // what an AI agent does for a person's step with its own tools (bring
    // in the files the person named) — not handed back to them
    if (s.agent) out.agent = fill(s.agent, local);
    if (s.agent_tool) out.agent_tool = s.agent_tool;
    if (s.question) out.question = fill(s.question, local);
    if (s.answers) out.answers = s.answers;
    if (r.file) out.file = r.file;
    return withNow({ project: root, kind, stage, done, step: out, ...(served ? { forge: served } : {}) });
  }
  return withNow({ project: root, kind, done, step: null,
    ...(served ? { forge: served, finished: served.why } : {}) });
}

/** NEXT.md: the same answer, as a page a person can read. */
export function renderNextMd(result, projectName = '') {
  const lines = [`# Next — ${projectName || path.basename(result.project)}`, ''];
  lines.push('<!-- Written by `champollion next --write`. It is a view of the project\'s files;');
  lines.push('     edit the files, not this page. -->', '');
  if (result.error && !result.step) {
    lines.push(result.error, '');
    return lines.join('\n');
  }
  if (!result.step) {
    lines.push('Every step on the rails is done.', '');
    if (result.finished) lines.push(result.finished, '');
    if (result.forge?.warnings?.length) {
      lines.push('**Read before trusting a number:**', ...result.forge.warnings.map((w) => `- ${w}`), '');
    }
    return lines.join('\n');
  }
  const { stage, step } = result;
  lines.push(`**Stage ${stage.n} of ${stage.of}: ${stage.title}**`, '');
  if (step.question) lines.push(`**Question for the people who hold the data:** ${step.question}`, '');
  lines.push(step.say, '');
  if (step.command) lines.push('```bash', step.command, '```', '');
  if (step.why) lines.push(`*Why:* ${step.why}`, '');
  if (result.forge?.state === 'serving' && result.forge.why) lines.push(`**The model in use:** ${result.forge.why}`, '');
  if (result.forge?.blockers?.length) {
    lines.push('**Blocked:**', ...result.forge.blockers.map((b) => `- ${b}`), '');
  }
  if (result.forge?.warnings?.length) {
    lines.push('**Read before trusting a number:**', ...result.forge.warnings.map((w) => `- ${w}`), '');
  }
  if (result.done.length) lines.push(`Done: ${result.done.join(' · ')}`, '');
  return lines.join('\n');
}
