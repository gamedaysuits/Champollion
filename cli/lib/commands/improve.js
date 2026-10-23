/**
 * champollion improve — the improve loop's steps, between one model in use and
 * the next (journey plan, Phase 2; docs/RAILS_WORKING_MODEL_JOURNEY_PLAN_2026-10-11.md).
 *
 *   champollion improve time --per-week "<their words>" --total "<their words>"
 *   champollion improve wishlist [--prompts 40]
 *                                 a printable sheet of what to write next: words the
 *                                 model never saw, the kinds of sentence it gets
 *                                 wrong on dev, open prompts (nmt-forge wishlist)
 *   champollion improve sheet     the model in use drafts the family's sentences
 *                                 onto a sheet the speaker marks; while the practice
 *                                 (dev) set is small, one row in two (under 50
 *                                 sentences) or four (under 200) has no draft — the
 *                                 speaker writes it, and it grows the practice set
 *   champollion improve marks     read the speaker's marks: how many drafts were
 *                                 right, the fixes and confirmed drafts as new
 *                                 training pairs, the practice rows as data/dev/
 *   champollion improve prepare   this round's training file, screened, the practice
 *                                 set grown (nmt-forge grow-dev), and the config
 *                                 pointed at it
 *   champollion improve report    the round's report: progress on new sentences and on
 *                                 the practice set, each with its unit; a check that the
 *                                 gains are real (not overfitted); a projection; what to do next
 *   champollion improve status    the rounds so far
 *
 * A round is numbered by forge's verdicts so far (`nmt-forge compare-runs`
 * writes one per round). Its files live in improve/round-<k>/. On the screen:
 * counts and plain words, never a sentence — the sheets hold the sentences, in
 * the project folder.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { checkDocument, PROJECT_FILE, SCHEMA_IDS, SIDECAR_SUFFIX } from '../framework/index.js';
import { findTool, languageName } from '../framework/journey.js';
import { ImportError } from '../community-import.js';
import { chosenRuns, currentRound, devRows, forgeEvents, practiceRows, PRACTICE_MARK, PRACTICE_TARGET, readSheet,
  roundDir, roundReport, sha256File, singleCorpus, verdictWords, wilson } from '../framework/rounds.js';
import { output } from '../output.js';

const LOOPBACK = new Set(['127.0.0.1', 'localhost', '[::1]', '::1']);
export const SHEET_HEADER = ['#', 'English — what we want to say', 'The model\'s draft',
  'Right? (Y / N / ?)', 'How it is said (if the draft is not right, or there is no draft)', 'Note'];
const MIN_SENTENCES = 20;

function refuse(msg) {
  output.error(msg);
  return 1;
}

function projectRoot(start) {
  let dir = start;
  for (;;) {
    if (fs.existsSync(path.join(dir, PROJECT_FILE))) return dir;
    const up = path.dirname(dir);
    if (up === dir) return null;
    dir = up;
  }
}

const csvCell = (v) => {
  const s = String(v ?? '');
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** The model this project serves on this computer, from forge's jobs. */
async function servedBase(root, hooks = {}) {
  const tool = (hooks.findTool || findTool)('nmt-forge');
  if (!tool) return { error: 'nmt-forge is not installed — the rails install it before training' };
  const r = (hooks.spawn || spawnSync)(tool, ['jobs', '--json'], { cwd: root, encoding: 'utf-8', timeout: 60_000 });
  let jobs;
  try {
    jobs = JSON.parse(r.stdout.slice(r.stdout.indexOf('[')));
  } catch {
    return { error: `nmt-forge jobs gave no answer (exit ${r.status})` };
  }
  const serving = (Array.isArray(jobs) ? jobs : [])
    .filter((j) => j.kind === 'serve' && j.state === 'running' && j.healthy && j.health_url);
  if (!serving.length) {
    return { error: 'no model is being served for this project — champollion next names the step that starts it' };
  }
  const url = new URL(serving[serving.length - 1].health_url);
  if (!LOOPBACK.has(url.hostname)) return { error: `the served model is at ${url.host}, not on this computer` };
  return { base: url.href.replace(/\/health\/?$/, '') };
}

async function time(args, root) {
  const perWeek = String(args['per-week'] || '').trim();
  const total = String(args.total || '').trim();
  if (!perWeek || !total) {
    return refuse('Usage: champollion improve time --per-week "<their words>" --total "<their words>" — '
      + 'how much the speaker can give, a week and in all, exactly as they said it');
  }
  fs.mkdirSync(path.join(root, 'improve'), { recursive: true });
  const rec = { per_week: perWeek, total, said: new Date().toISOString().slice(0, 10) };
  fs.writeFileSync(path.join(root, 'improve', 'time.json'), JSON.stringify(rec, null, 2) + '\n');
  output.raw(`\n  Recorded, in their words: "${perWeek}" a week, "${total}" in all (improve/time.json).`);
  output.raw('  Each round is planned around it; when it looks like too little for a working model, the rails say so.\n');
  return 0;
}

/** Files under dir/ with one of the extensions, sidecars left out, sorted. */
function filesIn(dir, exts) {
  try {
    return fs.readdirSync(dir).filter((f) => exts.includes(path.extname(f).toLowerCase())
      && !f.endsWith('.champollion.json')).sort().map((f) => path.join(dir, f));
  } catch {
    return [];
  }
}

async function wishlist(args, root, hooks = {}) {
  const k = currentRound(root);
  const dir = roundDir(root, k);
  const tool = (hooks.findTool || findTool)('nmt-forge');
  if (!tool) return refuse('nmt-forge is not installed — the rails install it before training');
  // the sentences the people asked for in every round so far: words they want
  // and the model never learned come first on the sheet
  const wanted = [];
  for (let i = 1; i <= k; i++) {
    const f = path.join(roundDir(root, i), 'to-translate.txt');
    if (fs.existsSync(f)) wanted.push(path.relative(root, f));
  }
  const lexicons = filesIn(path.join(root, 'data', 'lexicon'), ['.tsv', '.txt', '.json', '.jsonl'])
    .map((f) => path.relative(root, f));
  const out = path.relative(root, path.join(dir, 'wishlist.md'));
  const n = Number(args.prompts) > 0 ? String(Math.floor(Number(args.prompts))) : '40';
  const argv = ['wishlist', '--out', out, '--n', n, '--round', String(k), '--json'];
  if (wanted.length) argv.push('--wanted', ...wanted);
  if (lexicons.length) argv.push('--lexicon', ...lexicons);
  const r = (hooks.spawn || spawnSync)(tool, argv, { cwd: root, encoding: 'utf-8', timeout: 600_000 });
  let d = {};
  try {
    d = JSON.parse(r.stdout);
  } catch { /* the refusal is in stderr */ }
  if (r.status !== 0 || d.error || !d.sheet) {
    return refuse(`the wishlist was refused: ${d.error?.message || (r.stderr || r.stdout || '').trim().split('\n').slice(-3).join(' ')}`);
  }
  output.raw(`\n  Round ${k} wishlist — ${(d.text || []).join('\n  ')}`);
  output.raw(`  The people print or open ${out} and write their sentences, one per line, in`);
  output.raw(`  ${path.relative(root, path.join(dir, 'to-translate.txt'))}. Nothing from the sheet was printed here.\n`);
  return 0;
}

async function sheet(args, root, hooks = {}) {
  const k = currentRound(root);
  const dir = roundDir(root, k);
  const src = path.join(dir, 'to-translate.txt');
  let lines;
  try {
    lines = fs.readFileSync(src, 'utf-8').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  } catch {
    return refuse(`round ${k}: no ${path.relative(root, src)} yet — the people write the sentences they want `
      + 'translated there, one per line (champollion next says so)');
  }
  if (!lines.length) return refuse(`${path.relative(root, src)} is empty`);
  const served = await servedBase(root, hooks);
  if (served.error) return refuse(served.error);
  // practice rows: no draft — the speaker writes them, and they grow the dev
  // set rounds are judged on (FORGE_MACHINE_CRITIQUE finding 1)
  const dev = devRows(root);
  const practice = new Set(dev ? practiceRows(lines.length, dev.rows) : []);
  const drafted = lines.map((l, i) => [i, l]).filter(([i]) => !practice.has(i));
  // a newer model than the one in use (a round that saw no measurable gain on
  // the practice set), or after a promotion the model the one in use replaced:
  // half the drafted rows, at random and unmarked, are its — the speaker judges
  // both blind, on the same visit (FORGE_MACHINE_CRITIQUE finding 2; stress
  // test 12: the replaced model checks a promotion where a speaker's marking
  // drifts)
  const newer = draftNewer(root, k, drafted, hooks);
  const fromNewer = new Map(newer.drafts);
  let res;
  try {
    res = await (hooks.fetch || fetch)(`${served.base}/translate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ keys: Object.fromEntries(drafted.filter(([i]) => !fromNewer.has(i))
        .map(([i, l]) => [`l${i}`, l])) }),
      signal: AbortSignal.timeout(600_000),
    });
  } catch (e) {
    return refuse(`the model at ${served.base} did not answer (${e.name === 'TimeoutError' ? 'timed out' : e.message})`);
  }
  let d;
  try {
    d = await res.json();
  } catch {
    return refuse(`the model at ${served.base} answered ${res.status} with no JSON`);
  }
  if (!d.translations) return refuse(d.error?.message || `the model answered ${res.status}`);
  // repeats (founder decision 7, 2026-10-13: announced): about one row in ten
  // is a draft the speaker already judged on an earlier sheet, shown again
  // unmarked. How often they agree with their own earlier mark measures how far
  // the marks can be trusted (stress test 12: a speaker's own marking error
  // moves their "80%"). The sheet says a few rows come back — never which
  const repeats = repeatRows(root, k, lines);
  const entries = lines.map((l, i) => ({ i, english: l, draft: practice.has(i) ? PRACTICE_MARK
    : fromNewer.has(i) ? fromNewer.get(i) : (d.translations[`l${i}`] ?? '') }));
  const at = seededShuffle(entries.map((_, x) => x + 1), `repeat-at-${k}:${lines.join('\n')}`)
    .slice(0, repeats.length).sort((a, b) => b - a);
  at.forEach((x, t) => entries.splice(x, 0, { repeat: repeats[t], english: repeats[t].english, draft: repeats[t].draft }));
  const rows = [...(repeats.length ? [[REPEAT_NOTE, '', '', '', '', '']] : []), SHEET_HEADER,
    ...entries.map((e, x) => [x + 1, e.english, e.draft, '', '', ''])];
  const numOf = new Map(entries.flatMap((e, x) => (e.repeat ? [] : [[e.i, x + 1]])));
  // which model drafted which row, and which rows came back: kept beside the
  // sheet, never on it
  fs.writeFileSync(path.join(dir, 'sheet-key.json'), JSON.stringify({ round: k, in_use: newer.in_use ?? null,
    in_use_pairs: newer.in_use_pairs ?? null, other: newer.other ?? null, relation: newer.relation ?? null,
    other_pairs: newer.other_pairs ?? null,
    other_rows: [...fromNewer.keys()].map((i) => numOf.get(i)).sort((a, b) => a - b),
    repeat_rows: entries.map((e, x) => (e.repeat ? { row: x + 1, from_round: e.repeat.from_round,
      from_row: e.repeat.from_row, mark: e.repeat.mark } : null)).filter(Boolean) }, null, 2) + '\n');
  // a byte-order mark: spreadsheets then read the letters right
  const BOM = String.fromCharCode(0xfeff);
  fs.writeFileSync(path.join(dir, 'review.csv'), BOM + rows.map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n');
  const whose = newer.relation === 'replaced' ? 'the model the one in use replaced'
    : 'the newer model (not in use yet)';
  output.raw(`\n  Round ${k}: ${drafted.length - fromNewer.size} sentence(s) drafted by the model in use`
    + (fromNewer.size ? ` and ${fromNewer.size} by ${whose} — mixed in at random and not `
      + 'marked, so the speaker judges both blind' : '') + ` → ${path.relative(root, dir)}/review.csv`);
  if (newer.note) output.raw(`  ${newer.note}`);
  if (repeats.length) {
    output.raw(`  ${repeats.length} row(s) come back from earlier sheets on purpose, as the sheet says at the top (which`);
    output.raw('  ones is not marked): the speaker marks them fresh. How often they agree with their own earlier');
    output.raw('  marks tells how far the marks can be trusted — about 10 seconds a row, never trained on again.');
  }
  output.raw('  The speaker marks each draft in the "Right?" column — Y if it is right, N if it is wrong (then writes');
  output.raw('  how it is said in the next column), ? if unsure — and saves it as it is (or as review.xlsx beside it).');
  if (practice.size) {
    output.raw(`  ${practice.size} row(s) have no draft: the speaker writes how each is said. They become practice`);
    output.raw(`  sentences — the set that tells whether a new model is better (now ${dev.rows}, growing to ${PRACTICE_TARGET});`);
    output.raw('  kept on this computer and never trained on.');
  }
  output.raw('  Nothing was printed here: the sheet stays in the project folder.\n');
  return 0;
}

/** A seeded shuffle (the round and its sentences fix it): the same sheet twice draws the same rows. */
function seededShuffle(items, seedText) {
  let h = 2166136261;
  for (const ch of seedText) h = Math.imul(h ^ ch.codePointAt(0), 16777619) >>> 0;
  const rand = () => ((h = (Math.imul(h, 1103515245) + 12345) >>> 0) / 2 ** 32);
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
const seededHalf = (items, seedText) => seededShuffle(items, seedText).slice(0, Math.floor(items.length / 2));

/** One repeat for every this many new sentences on a sheet (decision 7). */
export const REPEAT_EVERY = 10;
/** What a sheet with repeats says at its top — the repeats are announced
 * (founder decision 7: open, not a hidden check of an elder's consistency). */
export const REPEAT_NOTE = 'A few rows below come back from earlier sheets on purpose. Please mark them fresh, '
  + 'as if new: how often the marks agree tells how far they can be trusted.';

/** Drafts the speaker marked Y or N on earlier sheets — never a practice row,
 * never a row that was itself a repeat, never one shown again already, never a
 * sentence on this sheet — one for every REPEAT_EVERY new sentences, drawn
 * seeded: [{english, draft, from_round, from_row, mark}]. */
function repeatRows(root, k, lines) {
  const want = Math.floor(lines.length / REPEAT_EVERY);
  if (!want || k < 2) return [];
  const pool = [];
  const shown = new Set();
  const sheets = [];
  for (let j = 1; j < k; j++) {
    let s = null;
    let key = null;
    try {
      s = readSheet(roundDir(root, j));
    } catch { /* an unreadable old sheet: nothing to repeat from it */ }
    try {
      key = JSON.parse(fs.readFileSync(path.join(roundDir(root, j), 'sheet-key.json'), 'utf-8'));
    } catch { /* a sheet from before the key */ }
    for (const x of key?.repeat_rows || []) shown.add(`${x.from_round}:${x.from_row}`);
    if (s) sheets.push([j, s, new Set((key?.repeat_rows || []).map((x) => x.row))]);
  }
  const now = new Set(lines);
  for (const [j, s, again] of sheets) {
    for (const r of s.rows) {
      if (r.practice || !r.draft || !r.num || again.has(r.num) || shown.has(`${j}:${r.num}`) || now.has(r.english)) continue;
      if (r.mark === 'Y' || r.mark === 'N') {
        pool.push({ english: r.english, draft: r.draft, from_round: j, from_row: r.num, mark: r.mark });
      }
    }
  }
  return seededShuffle(pool, `repeat-${k}:${lines.join('\n')}`).slice(0, want);
}

/** The other model's drafts for a seeded half of the drafted rows, through
 * `nmt-forge draft-newer` — {drafts: [[i, draft]…], other, relation ("newer":
 * not in use yet; "replaced": the model the one in use replaced), in_use,
 * in_use_pairs, other_pairs, note}. No other model, or one that cannot draft:
 * every row is the model in use's, said. */
function draftNewer(root, k, drafted, hooks) {
  const tool = (hooks.findTool || findTool)('nmt-forge');
  if (!tool || drafted.length < 2) return { drafts: [] };
  const half = seededHalf(drafted, `round-${k}:${drafted.map(([, l]) => l).join('\n')}`);
  const dir = roundDir(root, k);
  const inFile = path.join(dir, '.newer-lines.txt');
  const outFile = path.join(dir, '.newer-drafts.jsonl');
  fs.writeFileSync(inFile, half.map(([, l]) => l).join('\n') + '\n');
  try {
    const r = (hooks.spawn || spawnSync)(tool, ['draft-newer', path.relative(root, inFile), '--out',
      path.relative(root, outFile), '--json'], { cwd: root, encoding: 'utf-8', timeout: 900_000 });
    let d = {};
    try {
      d = JSON.parse(r.stdout);
    } catch { /* the reason is in stderr */ }
    if (r.status !== 0 || d.error) {
      return { drafts: [], note: 'the newer model could not draft its rows ('
        + `${d.error?.message || (r.stderr || '').trim().split('\n').slice(-1)[0] || `exit ${r.status}`}) — every row is the model in use's` };
    }
    // the other model: the newer one (not in use), or — after a promotion — the
    // one the model in use replaced (stress test 12); a forge before 2026-10-13
    // names only a newer one
    const other = d.other ?? d.newer ?? null;
    const pairs = { in_use_pairs: d.in_use_pairs ?? null, other_pairs: d.other_pairs ?? null };
    if (!other) return { drafts: [], in_use: d.in_use, ...pairs };
    const got = fs.readFileSync(outFile, 'utf-8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
    return { drafts: got.map((g) => [half[g.row][0], g.draft]), other, relation: d.relation ?? 'newer',
      in_use: d.in_use, ...pairs };
  } finally {
    fs.rmSync(inFile, { force: true });
    fs.rmSync(outFile, { force: true });
  }
}

/** The speaker's blind marks on a newer model, recorded with forge
 * (`nmt-forge speaker-verdict`): where the practice set is too small to tell,
 * a clear preference lets forge offer to put the newer model to use. Returns
 * a line to print, or null; a failure is said, never dropped. */
function speakerVerdict(root, blind, hooks) {
  const tool = (hooks.findTool || findTool)('nmt-forge');
  if (!tool) return 'the speaker\'s blind marks were not recorded with forge: nmt-forge is not installed here';
  const r = (hooks.spawn || spawnSync)(tool, ['speaker-verdict', '--newer', blind.other, '--in-use', blind.in_use,
    '--newer-right', String(blind.other_right), '--newer-judged', String(blind.other_judged),
    '--in-use-right', String(blind.in_use_right), '--in-use-judged', String(blind.in_use_judged), '--json'],
  { cwd: root, encoding: 'utf-8', timeout: 60_000 });
  let d = {};
  try {
    d = JSON.parse(r.stdout);
  } catch { /* the reason is in stderr */ }
  if (r.status !== 0 || d.error) {
    return 'the speaker\'s blind marks could not be recorded with forge ('
      + `${d.error?.message || (r.stderr || '').trim().split('\n').slice(-1)[0] || `exit ${r.status}`})`;
  }
  return d.clear === 'newer' ? 'forge recorded it: it offers to put the newer model to use (the people say yes first)'
    : null;
}

async function marks(args, root, hooks = {}) {
  const k = currentRound(root);
  const dir = roundDir(root, k);
  let s;
  try {
    s = readSheet(dir);
  } catch (e) {
    if (e instanceof ImportError) return refuse(e.message);
    throw e;
  }
  if (!s) return refuse(`round ${k}: no review sheet in ${path.relative(root, dir)}/ — champollion improve sheet makes it`);
  // the rows the other model drafted (sheet-key.json): judged, counted apart —
  // the progress measure stays the model in use's
  let key = null;
  try {
    key = JSON.parse(fs.readFileSync(path.join(dir, 'sheet-key.json'), 'utf-8'));
  } catch { /* a sheet from before the key, or none */ }
  // a key written before 2026-10-13 names a newer model only (newer, newer_rows)
  const otherName = key?.other ?? key?.newer ?? null;
  const relation = key?.relation ?? (key?.newer ? 'newer' : null);
  const newerRows = new Set(key?.other_rows || key?.newer_rows || []);
  // rows shown again (decision 7): judged against the speaker's own earlier
  // mark only — never counted in this round's share, never a training pair again
  const repeatOf = new Map((key?.repeat_rows || []).map((x) => [x.row, x]));
  const again = s.rows.filter((r) => repeatOf.has(r.num));
  const all = s.rows.filter((r) => !r.practice && !repeatOf.has(r.num));
  const drafts = all.filter((r) => !newerRows.has(r.num));
  const theirs = all.filter((r) => newerRows.has(r.num));
  const right = drafts.filter((r) => r.mark === 'Y');
  const wrong = drafts.filter((r) => r.mark === 'N');
  const unsure = drafts.filter((r) => r.mark === '?').length;
  const unmarked = drafts.filter((r) => !r.mark).length;
  const practice = s.rows.filter((r) => r.practice && r.fix && !/\t|\n/.test(r.english + r.fix));
  if (!all.some((r) => r.mark === 'Y' || r.mark === 'N') && !practice.length) {
    return refuse(`round ${k}: no draft is marked Y or N yet in ${path.relative(root, s.file)} — the speaker marks them first`);
  }
  // every right draft and every fix is a training pair, whichever model drafted it
  const rightAll = all.filter((r) => r.mark === 'Y');
  const fixes = all.filter((r) => r.mark === 'N' && r.fix);
  const pairs = [...rightAll.map((r) => [r.english, r.draft]), ...fixes.map((r) => [r.english, r.fix])]
    .filter(([a, b]) => a && b && !/\t|\n/.test(a + b));
  const [lo, hi] = wilson(right.length, right.length + wrong.length);
  const rec = {
    round: k, sheet: path.relative(root, s.file),
    sheet_sha256: sha256File(s.file),
    drafts: drafts.length, right: right.length, wrong: wrong.length, unsure, unmarked, fixes: fixes.length,
    acceptance: right.length + wrong.length ? Math.round((right.length / (right.length + wrong.length)) * 1000) / 1000 : null,
    ci95: [Math.round(lo * 1000) / 1000, Math.round(hi * 1000) / 1000], pairs: pairs.length,
    practice: practice.length, read: new Date().toISOString(),
    // the training pairs behind the model in use: the progress projection
    // reads the rise per doubling of them (stress test 12)
    in_use_pairs: key?.in_use_pairs ?? null,
  };
  if (again.length) rec.repeats = repeatAgreement(again, repeatOf, k);
  if (theirs.length && otherName) {
    // the blind comparison: the same speaker, the same visit, rows assigned at
    // random — the other model against the model in use on new sentences
    rec.blind = blindComparison(right.length, wrong.length, theirs.filter((r) => r.mark === 'Y').length,
      theirs.filter((r) => r.mark === 'N').length, relation);
    Object.assign(rec.blind, { other: otherName, in_use: key.in_use, relation,
      in_use_pairs: key.in_use_pairs ?? null, other_pairs: key.other_pairs ?? null });
    if (relation === 'newer') rec.blind.newer = otherName;
  }
  let pairsNote = 'no new training pairs (nothing right, no fixes written)';
  if (pairs.length) {
    // the new pairs come in the ordinary way: `data add` writes them, with a
    // sidecar whose terms the people are asked for next
    const project = JSON.parse(fs.readFileSync(path.join(root, PROJECT_FILE), 'utf-8'));
    const tgt = languageName(project.pair?.target, project.pair?.target_name);
    const inbox = path.join(dir, `review-pairs-round-${k}.tsv`);
    fs.writeFileSync(inbox, `English\t${tgt}\n` + pairs.map((p) => p.join('\t')).join('\n') + '\n');
    const { run: data } = await import('./data.js');
    const code = await data({ _: ['data', 'add', inbox], name: `review-round-${k}`, header: true }, root);
    if (code !== 0) return refuse(`round ${k}: the new pairs could not be added (above says why) — they are in ${path.relative(root, inbox)}`);
    rec.added_as = `data/parallel/review-round-${k}.tsv`;
    pairsNote = `${pairs.length} new training pair(s) — ${rightAll.length} confirmed draft(s) and ${fixes.length} fix(es) — `
      + `in ${rec.added_as}; the people say next who holds them and how they may be used`;
  }
  let practiceNote = '';
  if (practice.length) {
    // the practice rows: the speaker's own translations of sentences no model
    // drafted — they grow the dev set (prepare), never a training file
    rec.practice_file = writePractice(root, k, practice, rec.added_as || null);
    practiceNote = `${practice.length} practice sentence(s) the speaker wrote → ${rec.practice_file} (kept on this `
      + 'computer, never trained on; the next prepare adds them to the practice set)';
  }
  fs.writeFileSync(path.join(dir, 'marks.json'), JSON.stringify(rec, null, 2) + '\n');
  const pct = (x) => `${Math.round(x * 100)}%`;
  output.raw(`\n  Round ${k} review: ${drafts.length} draft(s) — ${right.length} right, ${wrong.length} wrong`
    + `${unsure ? `, ${unsure} unsure` : ''}${unmarked ? `, ${unmarked} not marked` : ''}.`);
  if (rec.acceptance != null) {
    output.raw(`  Right on ${pct(rec.acceptance)} of the drafts the speaker judged (95% interval ${pct(lo)}–${pct(hi)}) —`);
    output.raw('  the measure that matters: a speaker reading the model\'s own translations.');
  }
  if (rec.blind) output.raw(`  ${rec.blind.text}`);
  if (rec.repeats?.judged) {
    const r = rec.repeats;
    output.raw(`  Rows shown again: the speaker marked ${r.agreed} of ${r.judged} the way they did before (${pct(r.agreement)})`
      + (r.wrong_to_right || r.right_to_wrong ? ` — ${r.wrong_to_right} once wrong now right, ${r.right_to_wrong} once right `
        + 'now wrong' : '') + '. Not counted in this round\'s share, and not trained on again.');
  }
  if (rec.blind?.relation === 'newer' && rec.blind.other_judged && rec.blind.in_use_judged) {
    const said = speakerVerdict(root, rec.blind, hooks);
    if (said) output.raw(`  ${said}.`);
  }
  output.raw(`  ${pairsNote}.`);
  if (practiceNote) output.raw(`  ${practiceNote}.`);
  output.raw('');
  return 0;
}

/** The rows shown again, against the speaker's own earlier marks (decision 7):
 * {shown, judged, agreed, agreement, wrong_to_right, right_to_wrong} — a row
 * marked "?" or left blank this time is shown but not judged. */
export function repeatAgreement(again, repeatOf, round) {
  const judged = again.filter((r) => r.mark === 'Y' || r.mark === 'N');
  const before = (r) => repeatOf.get(r.num)?.mark;
  const agreed = judged.filter((r) => r.mark === before(r)).length;
  return { shown: again.length, judged: judged.length, agreed,
    agreement: judged.length ? Math.round((agreed / judged.length) * 1000) / 1000 : null,
    wrong_to_right: judged.filter((r) => before(r) === 'N' && r.mark === 'Y').length,
    right_to_wrong: judged.filter((r) => before(r) === 'Y' && r.mark === 'N').length,
    // for drift: how many rounds apart the two marks were, over the rows once
    // marked wrong (the ones kinder marking can flip)
    wrong_before: judged.filter((r) => before(r) === 'N').length,
    rounds_apart_wrong_before: judged.filter((r) => before(r) === 'N')
      .reduce((a, r) => a + Math.max(0, round - (repeatOf.get(r.num)?.from_round ?? round)), 0) };
}

/** The newer model against the model in use on the speaker's own new
 * sentences, rows assigned at random: each share right with its interval, and
 * whether the difference is clear (a two-proportion test, two-sided 5%). */
export function blindComparison(useRight, useWrong, otherRight, otherWrong, relation = 'newer') {
  const nU = useRight + useWrong;
  const nO = otherRight + otherWrong;
  const pU = nU ? useRight / nU : null;
  const pO = nO ? otherRight / nO : null;
  // "newer": the other model is the newer one, not put to use; "replaced": it
  // is the model the one in use replaced at the last promotion
  const other = relation === 'replaced' ? 'replaced' : 'newer';
  let clear = null;
  if (nU && nO) {
    const p = (useRight + otherRight) / (nU + nO);
    const se = Math.sqrt(p * (1 - p) * (1 / nU + 1 / nO));
    const z = se ? (pO - pU) / se : 0;
    clear = Math.abs(z) > 1.96 ? (z > 0 ? other : 'in-use') : 'neither';
  }
  const r3 = (x) => (x == null ? null : Math.round(x * 1000) / 1000);
  const pct = (x) => `${Math.round(x * 100)}%`;
  const said = other === 'newer'
    ? { them: 'the newer model (not in use)', us: 'the model in use',
      themBetter: 'the newer model is clearly better on the sentences the family needs',
      usBetter: 'the model in use is clearly better' }
    : { them: 'the model it replaced', us: 'the model put to use last',
      themBetter: 'the model it replaced was clearly better — the new one has not helped on the sentences the family needs',
      usBetter: 'the new model is clearly better on the sentences the family needs' };
  const text = nU && nO
    ? `Blind, on new sentences: ${said.us} was marked right on ${useRight} of ${nU} (${pct(pU)}), `
      + `${said.them} on ${otherRight} of ${nO} (${pct(pO)}) — `
      + (clear === other ? said.themBetter : clear === 'in-use' ? said.usBetter
        : `no clear difference on ${nU + nO} sentences`)
      + '.'
    : 'Blind comparison: too few rows of one model were judged to compare.';
  const out = { in_use_right: useRight, in_use_judged: nU, other_right: otherRight, other_judged: nO,
    in_use_share: r3(pU), other_share: r3(pO), clear, text };
  // the names the newer-model comparison has always carried
  if (other === 'newer') Object.assign(out, { newer_right: otherRight, newer_judged: nO, newer_share: r3(pO) });
  return out;
}

/** Round k's practice rows → data/dev/practice-round-k.tsv, with a sidecar: role
 * dev, local-only, never trained on; the round's review pairs (if any) are the
 * file whose holders' answers it follows (consentFor). */
function writePractice(root, k, rows, reviewPairs) {
  const project = JSON.parse(fs.readFileSync(path.join(root, PROJECT_FILE), 'utf-8'));
  const rel = `data/dev/practice-round-${k}.tsv`;
  const file = path.join(root, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, rows.map((r) => `${r.english}\t${r.fix}`).join('\n') + '\n', 'utf-8');
  const sidecar = {
    $schema: SCHEMA_IDS.set, role: 'dev', kind: 'parallel',
    pair: { source: project.pair?.source, target: project.pair?.target },
    transmission: 'local-only', terms: { training: 'not-allowed' },
    derived_from: 'review.csv', written_by: 'champollion improve marks',
    'x-practice': { round: k, rows: rows.length, review_pairs: reviewPairs },
  };
  const checked = checkDocument(sidecar, 'set');
  if (checked.errors.length) throw new Error(`improve marks wrote an invalid sidecar: ${checked.errors.join('; ')}`);
  fs.writeFileSync(`${file}${SIDECAR_SUFFIX}`, JSON.stringify(sidecar, null, 2) + '\n', 'utf-8');
  return rel;
}

/** May round k's practice sentences grow the dev set? They follow the answers
 * the holders gave for the same sheet's review pairs: not while those wait
 * for an answer, and never when the speakers have not all agreed. */
function consentFor(root, practiceRel) {
  let side;
  try {
    side = JSON.parse(fs.readFileSync(path.join(root, `${practiceRel}${SIDECAR_SUFFIX}`), 'utf-8'));
  } catch {
    return { ok: false, why: 'its sidecar is missing or unreadable' };
  }
  const review = side['x-practice']?.review_pairs;
  if (!review) return { ok: true };            // no review pairs that round: the speaker's own practice sentences
  const base = path.basename(review);
  const found = ['data/parallel', 'data/combined-from', 'data/not-for-training']
    .map((d) => path.join(root, d, `${base}${SIDECAR_SUFFIX}`)).find((f) => fs.existsSync(f));
  if (!found) return { ok: true };
  let terms;
  try {
    terms = JSON.parse(fs.readFileSync(found, 'utf-8')).terms || {};
  } catch {
    return { ok: false, why: `${base}'s sidecar is unreadable` };
  }
  if (!terms.training) return { ok: false, why: `it waits for the answers about ${base}` };
  if (['not-yet', 'some-said-no'].includes(terms.speakers_agreed)) {
    return { ok: false, why: `the speakers of ${base} have not all agreed (${terms.speakers_agreed})` };
  }
  return { ok: true };
}

/** Grow the dev set with every practice file whose holders' answers allow it. */
function growPractice(root, tool, spawn) {
  const dev = devRows(root);
  const dir = path.join(root, 'data', 'dev');
  let files = [];
  try {
    files = fs.readdirSync(dir).filter((f) => /^practice-round-\d+\.tsv$/.test(f)).sort()
      .map((f) => `data/dev/${f}`);
  } catch { /* none yet */ }
  if (!dev || !files.length) return { note: null };
  const held = [];
  const use = [];
  for (const f of files) {
    const c = consentFor(root, f);
    if (c.ok) use.push(f); else held.push(`${f}: ${c.why}`);
  }
  if (!use.length) return { note: `practice sentences held back — ${held.join('; ')}` };
  const r = spawn(tool, ['grow-dev', ...use, '--set', dev.name, '--json'], { cwd: root, encoding: 'utf-8', timeout: 600_000 });
  let d = {};
  try {
    d = JSON.parse(r.stdout);
  } catch { /* the refusal is in stderr */ }
  if (r.status !== 0 || d.error) {
    return { error: `the practice set could not grow: ${d.error?.message || (r.stderr || r.stdout || '').trim().split('\n').slice(-3).join(' ')}` };
  }
  return { grown: d, note: `the practice set: ${d.before} → ${d.after} sentences`
    + (held.length ? ` (held back — ${held.join('; ')})` : '') };
}

async function prepare(args, root, hooks = {}) {
  const k = currentRound(root);
  const corpus = singleCorpus(root);
  if (!corpus) return refuse('data/parallel/ should hold one pair file — combine them first (champollion data combine)');
  const out = `data/split/train-r${k}.jsonl`;
  const tool = (hooks.findTool || findTool)('nmt-forge');
  if (!tool) return refuse('nmt-forge is not installed — the rails install it before training');
  // the practice sentences first: the training file is screened against the
  // dev set as it will be judged
  const grown = growPractice(root, tool, hooks.spawn || spawnSync);
  if (grown.error) return refuse(grown.error);
  // the leak screen: test copies and dev rows set aside (the dev set stays the
  // one every round is judged on), a fresh file for the round
  const r = (hooks.spawn || spawnSync)(tool, ['leak-audit', corpus, '--clean-to', out, '--json'],
    { cwd: root, encoding: 'utf-8', timeout: 600_000 });
  let audit = {};
  try {
    audit = JSON.parse(r.stdout);
  } catch { /* the refusal is in stderr */ }
  if (r.status !== 0 || audit.error) {
    return refuse(`the leak screen refused: ${audit.error?.message || (r.stderr || r.stdout).trim().split('\n').slice(-3).join(' ')}`);
  }
  const cfgPath = path.join(root, 'config.json');
  const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf-8'));
  cfg.data = { ...(cfg.data || {}), gold: [out] };
  fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2) + '\n');
  // on from the model in use, or from the start: forge decides and says why
  // (a continued round is a few passes, not hours — plan A4)
  const rp = (hooks.spawn || spawnSync)(tool, ['round-plan', '--config', 'config.json', '--json'],
    { cwd: root, encoding: 'utf-8', timeout: 300_000 });
  let plan = {};
  try {
    plan = JSON.parse(rp.stdout);
  } catch { /* the refusal is in stderr */ }
  if (rp.status !== 0 || plan.error) {
    return refuse(`the round's training plan was refused: ${plan.error?.message || (rp.stderr || rp.stdout || '').trim().split('\n').slice(-3).join(' ')}`);
  }
  const kept = fs.readFileSync(path.join(root, out), 'utf-8').split('\n').filter((l) => l.trim()).length;
  const rec = { round: k, corpus, corpus_sha256: sha256File(path.join(root, corpus)),
    train_file: out, pairs: kept, ...(grown.grown ? { dev_before: grown.grown.before, dev_after: grown.grown.after } : {}),
    training: plan.mode ? { mode: plan.mode, epochs: plan.epochs } : undefined, at: new Date().toISOString() };
  fs.mkdirSync(roundDir(root, k), { recursive: true });
  fs.writeFileSync(path.join(roundDir(root, k), 'prepared.json'), JSON.stringify(rec, null, 2) + '\n');
  output.raw(`\n  Round ${k}'s training file: ${out} — ${kept} pair(s), screened against the test set and with the dev`);
  output.raw('  sentences set aside (rounds are judged on the dev set: it keeps its sentences and only grows).');
  if (grown.note) output.raw(`  ${grown.note}.`);
  if (plan.text) output.raw(`  ${plan.text[0].toUpperCase()}${plan.text.slice(1)}.`);
  output.raw('  config.json now trains on it.\n');
  return 0;
}

async function report(args, root) {
  const r = roundReport(root);
  const dir = roundDir(root, r.round);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'report.json'), JSON.stringify({ ...r, written: new Date().toISOString() }, null, 2) + '\n');
  if (args.json) {
    output.raw(JSON.stringify(r, null, 2));
    return 0;
  }
  output.raw(`\n  Round ${r.round} report (${path.relative(root, path.join(dir, 'report.json'))})`);
  output.raw('\n  How it is going:');
  for (const l of r.progress.length ? r.progress : ['No round has been measured yet.']) output.raw(`    · ${l}`);
  if (r.projection) output.raw(`\n  Where it is heading:\n    · ${r.projection}`);
  if (r.checks.length) {
    output.raw('\n  Checks:');
    for (const l of r.checks) output.raw(`    · ${l}`);
  }
  output.raw('\n  What to do next:');
  for (const l of r.actions) output.raw(`    · ${l}`);
  output.raw('');
  return 0;
}

async function status(args, root) {
  const verdicts = forgeEvents(root, 'improve-compare');
  const chosen = chosenRuns(root);
  const k = currentRound(root);
  const lines = [];
  for (let i = 1; i <= k; i++) {
    let m = null;
    try { m = JSON.parse(fs.readFileSync(path.join(roundDir(root, i), 'marks.json'), 'utf-8')); } catch { /* not yet */ }
    const v = verdicts[i - 1];
    lines.push(`  round ${i}: ${m ? (m.acceptance != null
      ? `speaker said ${m.right} of ${m.right + m.wrong} drafts were right (${Math.round(m.acceptance * 100)}%)`
      : 'no draft judged') + (m.practice ? `, ${m.practice} practice sentence(s) written` : '') : 'no review yet'}`
      + (v ? ` · new model on the practice (dev) sentences: ${verdictWords(root, v, chosen)}` : ''));
  }
  if (args.json) {
    output.raw(JSON.stringify({ round: k, verdicts }, null, 2));
    return 0;
  }
  output.raw(`\n${lines.join('\n')}\n`);
  return 0;
}

export async function run(args, cwd, hooks = {}) {
  const root = projectRoot(cwd);
  if (!root) return refuse('run this inside a project (champollion new <folder> --from … --to …)');
  const sub = args._[1];
  const cmds = { time, wishlist, sheet, marks, prepare, report, status };
  if (!cmds[sub]) {
    output.error(sub ? `Unknown improve subcommand: "${sub}".` : 'Missing improve subcommand.');
    output.error('Usage: champollion improve time | wishlist | sheet | marks | prepare | report | status');
    return 2;
  }
  return cmds[sub](args, root, hooks);
}

export const MIN_IMPROVE_SENTENCES = MIN_SENTENCES;
