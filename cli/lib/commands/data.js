/**
 * Command: data <subcommand>
 *
 *   champollion data mark <file> [--role R] [--kind K] [--training allowed|not-allowed]
 *                                [--owner "…"] [--speakers "…" --speakers-agreed yes|not-yet|some-said-no]
 *                                [--consent-record path] (--local-only | --may-leave)
 *
 * Records what the people who hold a data file decided — who holds it,
 * whether a model may be trained on it, whether its text may ever leave this
 * computer — in the set/1 sidecar beside it (<file>.champollion.json), which
 * mt-eval, nmt-forge, the MCP server and this CLI all obey.
 *
 * A sidecar only ever gets STRICTER: a local-only file cannot be marked
 * may-leave, training not-allowed cannot become allowed, and a test or sealed
 * set cannot be given another role. Undoing a restriction is a decision for
 * the data's holders, made by hand — never by a command an agent can run.
 *
 * Whose words a file holds is asked too (wave 1, 2026-10-12: a family chat
 * exported without asking anyone, notebook stories that may be off-limits):
 * --speakers names them, --speakers-agreed says whether they agreed. Until
 * they all have (not-yet), or when some said no, no model may learn from the
 * file. The one loosening a command makes: not-yet → yes, with training
 * allowed — the agreement the not-yet was waiting for.
 *
 * Read only the sidecar; the data file's text is never opened.
 *
 *   champollion data add <file> [--into parallel|test|lexicon] …   a spreadsheet/table → pairs
 *   champollion data combine [--name <stem>]                data/parallel/*.tsv → one file
 *
 * `combine` joins the pair files into the one file training reads, with the
 * strictest of their terms, and moves the originals to data/combined-from/.
 * In a later round (the improve loop) the file it wrote before is the previous
 * version: kept as data/combined-from/<stem>-v<k>.tsv, its pairs first, the new
 * files' after, the version counted in the sidecar.
 * A file whose holders said no model may learn from it is not joined (it
 * would make the whole file untrainable): it moves to data/not-for-training/.
 * Like `add`, it reports counts, never sentences.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { checkDocument, readSet, SCHEMA_IDS, PROJECT_FILE, SIDECAR_SUFFIX, upgradeSet } from '../framework/index.js';
import { ImportError, readTable, profileColumns, columnLetter, liftTables, eafTierProfile, eafPairs,
  readUsfmInput, usfmPairs } from '../community-import.js';
import { resolveLanguageInput, resolveCode } from '../registers.js';
import { languageName } from '../framework/journey.js';
import { qualityLines, screenPairs } from '../framework/pair-quality.js';
import { output } from '../output.js';

const ROLES = ['train', 'dev', 'test', 'sealed', 'input', 'resource'];
const KINDS = ['parallel', 'monolingual', 'lexicon', 'grammar', 'glossary'];
const PROTECTED_ROLES = ['test', 'sealed'];
const SPEAKERS_AGREED = ['yes', 'not-yet', 'some-said-no'];

function refuse(msg) {
  output.error(msg);
  return 1;
}

/**
 * Compute the new sidecar, or a refusal. Pure (exported for tests).
 * @returns {{doc?: object, error?: string, renamed?: string[]}}
 */
export function markedSidecar(existing, flags) {
  const doc = { ...(existing || {}) };
  const renamed = [];
  const { role, kind, training, owner, speakers, speakersAgreed, consentRecord, localOnly, mayLeave } = flags;

  if (localOnly && mayLeave) return { error: 'choose one: --local-only or --may-leave' };
  if (role !== undefined && !ROLES.includes(role)) {
    return { error: `--role must be one of ${ROLES.join(', ')}` };
  }
  if (kind !== undefined && !KINDS.includes(kind)) {
    return { error: `--kind must be one of ${KINDS.join(', ')}` };
  }
  if (training !== undefined && !['allowed', 'not-allowed'].includes(training)) {
    return { error: '--training must be allowed or not-allowed' };
  }
  if (speakersAgreed !== undefined && !SPEAKERS_AGREED.includes(speakersAgreed)) {
    return { error: `--speakers-agreed must be one of ${SPEAKERS_AGREED.join(', ')}` };
  }
  if (speakers !== undefined && !String(speakers).trim()) {
    return { error: '--speakers needs the people whose words the file holds, in the person\'s words' };
  }

  // A local-only mark `data add` applied from the project's default is the
  // TOOL's protection until the holders decide — their first answer may lift
  // it. Everything the holders themselves decided only ever gets stricter.
  const provisional = doc['x-transmission-default'] === true;
  if (mayLeave && doc.transmission === 'local-only' && provisional) {
    delete doc.transmission;
    delete doc['x-transmission-default'];
  }
  if (localOnly) delete doc['x-transmission-default'];
  // Only stricter, never looser.
  if (mayLeave && doc.transmission === 'local-only') {
    return { error: 'this file is marked local-only, and a sidecar only ever gets stricter. '
      + 'Whether it may leave this computer is its holders\' decision — if they agree, '
      + 'edit the sidecar by hand.' };
  }
  // Likewise "training not-allowed" that `data add` applied to scripture:
  // the tool's caution until the holders answer, not their decision.
  const provisionalTraining = doc['x-training-default'] === true;
  if (training !== undefined) delete doc['x-training-default'];
  const prevTerms = doc.terms || {};
  const agreed = speakersAgreed ?? prevTerms.speakers_agreed;
  if (prevTerms.speakers_agreed === 'some-said-no' && speakersAgreed !== undefined && speakersAgreed !== 'some-said-no') {
    return { error: 'some of the people whose words this file holds said no, and a sidecar only ever gets '
      + 'stricter. Take their words out into another file, and mark the rest.' };
  }
  if (training === 'allowed' && agreed && agreed !== 'yes') {
    return { error: agreed === 'not-yet'
      ? 'the people whose words this file holds have not agreed yet, so no model may learn from it: mark it '
        + '--training not-allowed now, and --speakers-agreed yes --training allowed once they all have'
      : 'some of the people whose words this file holds said no, so no model may learn from it: take their '
        + 'words out into another file, and mark the rest' };
  }
  // the agreement a not-yet was waiting for lifts the not-allowed it caused
  const nowAgreed = prevTerms.speakers_agreed === 'not-yet' && speakersAgreed === 'yes';
  if (training === 'allowed' && prevTerms.training === 'not-allowed' && !provisionalTraining && !nowAgreed) {
    return { error: 'training is not-allowed for this file, and a sidecar only ever gets '
      + 'stricter. If its holders agree to training, edit the sidecar by hand.' };
  }
  if (role !== undefined && PROTECTED_ROLES.includes(doc.role) && role !== doc.role) {
    return { error: `this file is the ${doc.role} set; giving it another role would let a model `
      + 'learn from what it is judged on. Put other data in another file.' };
  }
  const finalRole = role ?? doc.role;
  if (PROTECTED_ROLES.includes(finalRole) && training === 'allowed') {
    return { error: `a ${finalRole} set is never trained on: --training allowed is refused for it` };
  }
  if (!localOnly && !mayLeave && doc.transmission !== 'local-only') {
    return { error: 'say --local-only or --may-leave: whether this file\'s text may ever be '
      + 'sent to an outside AI service is its holders\' decision, so it is never assumed' };
  }

  if (localOnly) doc.transmission = 'local-only';
  if (role !== undefined) doc.role = role;
  if (kind !== undefined) doc.kind = kind;
  const terms = { ...prevTerms };
  if (training !== undefined) terms.training = training;
  else if (PROTECTED_ROLES.includes(finalRole)) terms.training = 'not-allowed';
  if (agreed && agreed !== 'yes') terms.training = 'not-allowed';
  if (owner !== undefined) terms.owner = owner;
  if (speakers !== undefined) terms.speakers = String(speakers).trim();
  if (speakersAgreed !== undefined) terms.speakers_agreed = speakersAgreed;
  if (consentRecord !== undefined) terms.consent_record = consentRecord;
  if (Object.keys(terms).length) doc.terms = terms;
  doc.written_by = 'champollion data mark';

  // set/0 keys set/1 would refuse are kept under x- (never dropped).
  const up = upgradeSet(doc);
  renamed.push(...up.renamed);
  if (up.errors.length) return { error: `the sidecar would not be valid: ${up.errors.join('; ')}` };
  Object.keys(doc).forEach((k) => delete doc[k]);
  Object.assign(doc, up.doc);
  // A stable key order a person can read.
  const order = ['$schema', 'role', 'kind', 'pair', 'fields', 'transmission', 'terms'];
  const sorted = {};
  for (const k of order) if (k in doc) sorted[k] = doc[k];
  for (const k of Object.keys(doc)) if (!(k in sorted)) sorted[k] = doc[k];
  return { doc: sorted, renamed };
}

async function mark(args, cwd) {
  const rel = args._[2];
  if (!rel || args._.length > 3) {
    return refuse('Usage: champollion data mark <file> [--role R] [--training allowed|not-allowed] '
      + '[--owner "…"] [--speakers "…" --speakers-agreed yes|not-yet|some-said-no] [--consent-record path] '
      + '(--local-only | --may-leave)');
  }
  const file = path.resolve(cwd, rel);
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
    return refuse(`${rel}: no such file — mark the data file itself, not a folder`);
  }
  const current = readSet(file);
  if (current.errors.length) {
    return refuse(`${rel}.champollion.json is not valid — fix it first `
      + `(champollion validate): ${current.errors.join('; ')}`);
  }
  const res = markedSidecar(current.data, {
    role: args.role, kind: args.kind, training: args.training, owner: args.owner,
    speakers: args.speakers, speakersAgreed: args['speakers-agreed'], consentRecord: args['consent-record'], localOnly: args['local-only'] === true,
    mayLeave: args['may-leave'] === true,
  });
  if (res.error) return refuse(`${rel}: ${res.error}`);
  fs.writeFileSync(current.path, JSON.stringify(res.doc, null, 2) + '\n', 'utf-8');
  // a file combine set aside while its speakers had not agreed: now that a
  // model may learn from it, it rejoins the pair files, and the next round's
  // combine joins it (wave 1: "I'll ask Lea and come back")
  let rejoined = null;
  const root = projectRoot(path.dirname(file));
  if (root && res.doc.terms?.training === 'allowed'
    && path.dirname(file) === path.join(root, NOT_FOR_TRAINING)) {
    const back = path.join(root, INTO.parallel, path.basename(file));
    if (!fs.existsSync(back) && !fs.existsSync(`${back}${SIDECAR_SUFFIX}`)) {
      fs.mkdirSync(path.dirname(back), { recursive: true });
      fs.renameSync(file, back);
      fs.renameSync(current.path, `${back}${SIDECAR_SUFFIX}`);
      rejoined = path.relative(cwd, back);
    }
  }
  if (args.json) {
    output.raw(JSON.stringify({ file: rel, sidecar: path.relative(cwd, rejoined ? `${path.join(cwd, rejoined)}${SIDECAR_SUFFIX}` : current.path),
      set: res.doc, ...(rejoined ? { moved_to: rejoined } : {}) }, null, 2));
    return 0;
  }
  const terms = res.doc.terms || {};
  const parts = [
    res.doc.role && `role ${res.doc.role}`,
    res.doc.transmission === 'local-only' ? 'local-only (stays on this computer)' : 'may leave this computer',
    terms.training && `training ${terms.training}`,
    terms.owner && `held by ${terms.owner}`,
    terms.speakers && `words of ${terms.speakers}${terms.speakers_agreed && terms.speakers_agreed !== 'yes'
      ? ` (${terms.speakers_agreed === 'not-yet' ? 'not agreed yet' : 'some said no'})` : ''}`,
  ].filter(Boolean);
  output.raw(`\n  ${rel}: ${parts.join(' · ')}`);
  output.raw(`  written to ${path.relative(cwd, current.path) || current.path} — every tool obeys it.`);
  if (rejoined) output.raw(`  its speakers agreed: it is back in ${rejoined}, and the next combine joins it`);
  if (res.renamed.length) {
    output.raw(`  kept older keys under x-: ${res.renamed.map((k) => `x-${k}`).join(', ')}`);
  }
  output.raw('  Next: champollion next\n');
  return 0;
}

// ── data add ─────────────────────────────────────────────────────────────

const INTO = { parallel: 'data/parallel', test: 'data/test', lexicon: 'data/lexicon' };

function projectRoot(start) {
  let dir = start;
  for (;;) {
    if (fs.existsSync(path.join(dir, PROJECT_FILE))) return dir;
    const up = path.dirname(dir);
    if (up === dir) return null;
    dir = up;
  }
}

function slug(text) {
  return String(text).normalize('NFKD').replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'data';
}

/** Does this header cell name one of the pair's languages? → 'source' | 'target' | null */
function headerSide(cell, pair) {
  const raw = String(cell || '').trim();
  if (!raw) return null;
  const r = resolveLanguageInput(raw);
  const code = r.code ? resolveCode(r.code) : null;
  const names = (side) => [pair[side], pair[`${side}_name`]].filter(Boolean).map((x) => String(x).toLowerCase());
  if (code === pair.source || names('source').includes(raw.toLowerCase())) return 'source';
  if (code === pair.target || names('target').includes(raw.toLowerCase())) return 'target';
  return null;
}

/** A column given as a letter (B), a 1-based number (2) or a header text. */
function pickColumn(spec, header, width) {
  const s = String(spec).trim();
  if (/^[A-Za-z]{1,3}$/.test(s)) {
    let n = 0;
    for (const ch of s.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
    return n - 1 < width ? n - 1 : null;
  }
  if (/^\d+$/.test(s)) return Number(s) - 1 < width && Number(s) > 0 ? Number(s) - 1 : null;
  if (header) {
    const i = header.findIndex((h) => String(h || '').trim().toLowerCase() === s.toLowerCase());
    return i >= 0 ? i : null;
  }
  return null;
}

function nfc(v) {
  return String(v ?? '').normalize('NFC').trim();
}

/**
 * Turn a sheet's rows into pairs, by the chosen columns. Content-free report.
 * Exported for tests.
 */
export function rowsToPairs(rows, srcCol, tgtCol, { header }) {
  const body = header ? rows.slice(1) : rows;
  const pairs = [];
  // the sheet row each pair came from (1-based, the header counted): what the
  // quality screen names, so the person can find it in their own file
  const rowNumbers = [];
  const report = { rows_read: body.length, pairs_written: 0, empty_rows: 0,
    dropped_one_side_empty: 0, joined_multiline_cells: 0, nfc_composed_cells: 0 };
  for (const [k, r] of body.entries()) {
    let src = nfc(r[srcCol]);
    let tgt = nfc(r[tgtCol]);
    // Unicode NFC writes "a" + a combining accent as the one composed letter:
    // the same letters to every tool, stored one way — said and counted, never
    // silent (E1 criterion: a normalization a person can see, 2026-10-18)
    for (const [raw, out] of [[r[srcCol], src], [r[tgtCol], tgt]]) {
      if (out && String(raw ?? '').trim() !== out) report.nfc_composed_cells++;
    }
    if (!src && !tgt) { report.empty_rows++; continue; }
    if (!src || !tgt) { report.dropped_one_side_empty++; continue; }
    for (const side of ['src', 'tgt']) {
      const v = side === 'src' ? src : tgt;
      if (/[\t\r\n]/.test(v)) {
        report.joined_multiline_cells++;
        const joined = v.replace(/\s*[\t\r\n]+\s*/g, ' ');
        if (side === 'src') src = joined; else tgt = joined;
      }
    }
    pairs.push([src, tgt]);
    rowNumbers.push(k + 1 + (header ? 1 : 0));
  }
  report.pairs_written = pairs.length;
  return { pairs, report, rowNumbers };
}

/**
 * A header cell as the column note may show it: its text only when it names
 * one of the pair's languages — otherwise its length. "A header" is what the
 * caller SAID the first row is; when it was a sentence pair, the note printed
 * a family sentence to the agent, and so to its model provider (GPT-5 nano,
 * model ladder round 7: a canary in a "which column" refusal). Never a cell
 * the tool cannot tell is a label.
 */
function headerLabel(cell, pair) {
  const raw = String(cell ?? '').trim();
  if (!raw) return '(empty)';
  return headerSide(raw, pair) ? `"${raw}"` : `(a header cell of ${raw.length} characters)`;
}

function columnsNote(profile, header, pair) {
  return profile.map((c) => `${c.column}${header ? ` ${headerLabel(header[c.index], pair)}` : ''}: `
    + `${Math.round(c.filled * 100)}% filled, ~${c.mean_length} characters`
    + (c.latin_share === null ? '' : `, ${Math.round(c.latin_share * 100)}% Latin letters`)).join('\n    ');
}

async function add(args, cwd) {
  const rel = args._[2];
  if (!rel || args._.length > 3) {
    return refuse('Usage: champollion data add <file> [--into parallel|test|lexicon] [--source-col A] '
      + '[--target-col B] [--sheet <name>] [--header | --no-header] [--name <stem>] '
      + '[--usfm-source <file or folder>] [--replace]');
  }
  const file = path.resolve(cwd, rel);
  const usfm = args['usfm-source'] !== undefined;
  // scripture comes as one file per book: a folder of them is read whole
  if (!fs.existsSync(file) || (!fs.statSync(file).isFile() && !usfm)) return refuse(`${rel}: no such file`);
  const root = projectRoot(cwd);
  if (!root) return refuse('run this inside a project (champollion new <folder> --from … --to …)');
  const project = JSON.parse(fs.readFileSync(path.join(root, PROJECT_FILE), 'utf-8'));
  const pair = project.pair || {};
  const into = args.into || 'parallel';
  if (!INTO[into]) return refuse(`--into must be one of ${Object.keys(INTO).join(', ')}`);

  let table;
  try {
    if (usfm) {
      // USFM scripture: this file (or folder) is the project's target
      // language, --usfm-source the source language's text; verses numbered
      // the same in both become pairs — never matched by position
      if (typeof args['usfm-source'] !== 'string' || !args['usfm-source']) {
        return refuse('--usfm-source names the other language\'s text: a .usfm file or a folder of them');
      }
      if (into === 'lexicon') return refuse('verses are sentences, not a word list: add scripture as pairs (or --into test)');
      // --usfm-source is for scripture only: a source that is not there, or
      // a file that is not USFM, is most often the option given by mistake
      // ("usfm_source": "none" — Llama 3.1 8B, model ladder round 6; the
      // refusal then said to export the family's notes as USFM)
      const onlyScripture = `--usfm-source is only for scripture (both languages' texts as USFM); for any `
        + `other file leave it out (MCP add_data: leave "usfm_source" out): champollion data add ${rel}`
        + (into !== 'parallel' ? ` --into ${into}` : '');
      const srcPath = path.resolve(cwd, args['usfm-source']);
      if (!fs.existsSync(srcPath)) return refuse(`${args['usfm-source']}: no such file or folder. ${onlyScripture}`);
      let tgt;
      try {
        tgt = readUsfmInput(file);
      } catch (e) {
        if (/not USFM scripture/.test(e.message)) return refuse(`${e.message}. ${onlyScripture}`);
        throw e;
      }
      const src = readUsfmInput(srcPath);
      const { rows, counts } = usfmPairs(src, tgt);
      if (!rows.length) {
        return refuse(`${rel}: no verse is numbered the same in both texts (books ${tgt.books.join(' ')} · `
          + `${src.books.join(' ')}) — nothing to pair`);
      }
      table = { format: 'usfm', sheets: [{ name: 'verses', rows }], sha256: tgt.sha256,
        counts: { ...counts, books: tgt.books.filter((b) => src.books.includes(b)),
          source_sha256: src.sha256, source: path.basename(path.resolve(cwd, args['usfm-source'])) } };
      if (!args.sheet) args.sheet = 'verses';
    } else {
      table = readTable(file);
    }
  } catch (e) {
    if (e instanceof ImportError) return refuse(e.message);
    throw e;
  }
  // A Toolbox / MDF dictionary: its markers say which side is which (\ge
  // and \xe are English glosses and translations by the MDF standard; \lx
  // is the language) — so there is no column to ask about. Its words go to
  // the word list, its example sentences to the pairs.
  const toolbox = table.format === 'toolbox';
  if (toolbox) {
    if (resolveCode(pair.source) !== 'eng') {
      return refuse(`${rel}: a Toolbox dictionary's glosses (\\ge) and example translations (\\xe) are `
        + `English by the MDF standard, and this project translates from ${languageName(pair.source, pair.source_name)}`);
    }
    if (!args.sheet) args.sheet = into === 'lexicon' ? 'words' : 'examples';
  }
  // A LIFT dictionary (FieldWorks / FLEx) names the language of every form:
  // the project's pair is matched through the cards; where the file has
  // several and none is the project's, the person names them (--source-col
  // and --target-col take a LIFT language code here). Never guessed.
  const lift = table.format === 'lift';
  let liftLangs = null;
  if (lift) {
    const L = table.lift.langs;
    const canon = (c) => resolveCode(String(c || '').replace('_', '-')) || String(c || '').toLowerCase();
    const heads = [...new Set([...L.headword, ...L.example])];
    const glosses = [...new Set([...L.gloss, ...L.translation])];
    const tgt = args['target-col'] || heads.find((l) => canon(l) === canon(pair.target))
      || (heads.length === 1 ? heads[0] : null);
    const src = args['source-col'] || glosses.find((l) => canon(l) === canon(pair.source));
    if (!src || !tgt) {
      return refuse(`${rel}: a LIFT dictionary names its languages — headwords and examples in `
        + `${heads.join(', ') || 'none'}; glosses and translations in ${glosses.join(', ') || 'none'} — and `
        + `which is ${languageName(pair.source, pair.source_name)} and which is `
        + `${languageName(pair.target, pair.target_name)} is not clear. Ask the person who made it, then: `
        + `champollion data add ${rel} --source-col <its language code> --target-col <its language code>`);
    }
    // a named code may be one the cards do not know (a private tag), never
    // ANOTHER known language: the sidecar would say one language and the
    // file hold another
    for (const [side, code, want] of [['source', src, pair.source], ['target', tgt, pair.target]]) {
      const a = resolveCode(String(code).replace('_', '-'));
      const b = resolveCode(String(want || ''));
      if (a && b && a !== b) {
        return refuse(`${rel}: ${code} is ${languageName(a)}, and this project's ${side} is `
          + `${languageName(want, side === 'source' ? pair.source_name : pair.target_name)} — the pairs `
          + 'would be written under the wrong language');
      }
    }
    liftLangs = { source: src, target: tgt };
    table.sheets = liftTables(table.lift, src, tgt);
    if (!args.sheet) args.sheet = into === 'lexicon' ? 'words' : 'examples';
  }
  // An ELAN file: pairs come from two LINKED tiers (one refers to the
  // other, or both sit on the same time slots). Tiers that name their
  // language (LANG_REF) are matched through the cards; otherwise the person
  // names them (--source-col / --target-col take a tier id). Never guessed.
  const elan = table.format === 'elan';
  let elanTiers = null;
  if (elan) {
    // tiers by NUMBER (file order), language and count: an ELAN tier's id is
    // often a person's name ("Mary's transcription"), and what is printed
    // here reaches a hosted agent — the names stay in the person's own file
    // (founder ruling 7, 2026-10-11; docs review 2026-10-12)
    const profile = eafTierProfile(table.eaf);
    const num = (id) => profile.findIndex((t) => t.id === id) + 1;
    const label = (t) => `tier ${num(t.id)} (${t.lang || 'no language'}, ${t.annotations} annotation(s)`
      + `${t.parent ? `, under tier ${num(t.parent)}` : ''})`;
    const canon = (c) => resolveCode(String(c || '').replace('_', '-')) || String(c || '').toLowerCase();
    const byLang = (want) => profile.filter((t) => t.lang && canon(t.lang) === canon(want)).map((t) => t.id);
    // a tier is named by its number, or (typed by the person) its exact id
    const named = (v) => (v == null || v === '' ? null : /^\d+$/.test(String(v))
      ? (profile[Number(v) - 1]?.id ?? false) : (profile.some((t) => t.id === String(v)) ? String(v) : false));
    const pick = (v, want) => (v != null && v !== '' ? named(v) : (byLang(want).length === 1 ? byLang(want)[0] : null));
    const srcTier = pick(args['source-col'], pair.source);
    const tgtTier = pick(args['target-col'], pair.target);
    const tierList = profile.map(label).join('; ');
    if (srcTier === false || tgtTier === false) {
      return refuse(`${rel}: no such tier — tiers: ${tierList}. Name a tier by its number: `
        + `champollion data add ${rel} --source-col <number> --target-col <number>`);
    }
    if (!srcTier || !tgtTier) {
      return refuse(`${rel}: which tier holds ${languageName(pair.source, pair.source_name)} and which `
        + `${languageName(pair.target, pair.target_name)}? Ask the person who made it.\n  tiers: ${tierList}\n`
        + `  then: champollion data add ${rel} --source-col <number> --target-col <number>`);
    }
    for (const [side, id, want] of [['source', srcTier, pair.source], ['target', tgtTier, pair.target]]) {
      const t = profile.find((x) => x.id === id);
      const a = t.lang ? resolveCode(t.lang) : null;
      const b = resolveCode(String(want || ''));
      if (a && b && a !== b) {
        return refuse(`${rel}: tier ${num(id)} is in ${languageName(a)}, and this project's ${side} is `
          + `${languageName(want, side === 'source' ? pair.source_name : pair.target_name)}`);
      }
    }
    const { rows, linked } = eafPairs(table.eaf, srcTier, tgtTier);
    if (!linked) {
      return refuse(`${rel}: tiers ${num(srcTier)} and ${num(tgtTier)} are not linked — neither refers to the other `
        + 'and they share no time slots, so their annotations are never paired by guesswork');
    }
    elanTiers = { source: num(srcTier), target: num(tgtTier) };
    table.sheets = [{ name: `tier ${elanTiers.source} → tier ${elanTiers.target}`, rows }];
    args.sheet = table.sheets[0].name;
  }
  const fixedColumns = toolbox || lift || elan || usfm;
  const sheets = table.sheets.filter((s) => s.rows.some((r) => r.some((c) => String(c).trim())));
  let sheet;
  if (args.sheet) {
    sheet = sheets.find((s) => s.name === args.sheet)
      || (/^\d+$/.test(args.sheet) ? sheets[Number(args.sheet) - 1] : null);
    if (!sheet && lift) {
      return refuse(args.sheet === 'examples'
        ? `${rel}: this dictionary has no example in ${liftLangs.target} with a translation in `
          + `${liftLangs.source} — bring its words in as a word list: --into lexicon`
        : `${rel}: this dictionary has no headword in ${liftLangs.target} with a gloss in ${liftLangs.source}`);
    }
    if (!sheet && toolbox) {
      return refuse(args.sheet === 'examples'
        ? `${rel}: this dictionary has no example sentences with their English (\\xv with \\xe) — `
          + 'bring its words in as a word list: --into lexicon'
        : `${rel}: this dictionary has no headword with an English gloss (\\lx with \\ge)`);
    }
    // a sheet name guessed ("Sheet1"): say the one to pass, or that none is
    // needed — a model given only "sheets: Sentences" never tried again, and
    // the file's 120 pairs were left out (model ladder, 2026-10-11)
    if (!sheet) {
      return refuse(sheets.length === 1
        ? `${rel}: no sheet "${args.sheet}" — its one sheet with data is "${sheets[0].name}": add it again `
          + `without --sheet (MCP add_data: leave "sheet" out)`
        : `${rel}: no sheet "${args.sheet}" with data — say which: `
          + sheets.map((s) => `--sheet "${s.name}" (${s.rows.length} rows)`).join(', '));
    }
  } else if (sheets.length === 1) {
    sheet = sheets[0];
  } else if (!sheets.length) {
    return refuse(`${rel} has no rows with data`);
  } else {
    return refuse(`${rel} has ${sheets.length} sheets with data — say which: `
      + sheets.map((s) => `--sheet "${s.name}" (${s.rows.length} rows)`).join(', '));
  }
  const rows = sheet.rows.map((r) => r.map((c) => String(c ?? '')))
    .filter((r) => r.some((c) => c.trim()));
  const width = Math.max(0, ...rows.map((r) => r.length));

  // Header and columns: stated, or read from a header row that names the
  // pair's languages. Never guessed from the sentences.
  const first = rows[0] || [];
  const sides = first.map((c) => headerSide(c, pair));
  const autoSrc = sides.indexOf('source');
  const autoTgt = sides.indexOf('target');
  const headerNamesLanguages = autoSrc >= 0 && autoTgt >= 0
    && sides.filter((s) => s === 'source').length === 1 && sides.filter((s) => s === 'target').length === 1;
  // A first row that names ONE of the pair's languages, the other cells short
  // labels, reads as a header too: "English | Our language" in a project the
  // family named "Our family language", or whose code was chosen for them.
  // Wave 1 (2026-10-12): 17 of 55 runs put that row into the test set as a
  // sentence pair — the columns were given, and the header never mentioned.
  // Not guessed: asked, unless --header or --no-header was said.
  const named = sides.filter(Boolean).length;
  const labelLike = (c) => {
    const t = String(c || '').trim();
    return !t || (t.split(/\s+/).length <= 4 && !/[.?!…]$/.test(t));
  };
  const halfHeader = !headerNamesLanguages && named === 1 && width >= 2
    && first.every((c, i) => sides[i] || labelLike(c));
  if (halfHeader && !fixedColumns && !args.header && !args['no-header']) {
    const at = autoSrc >= 0 ? autoSrc : autoTgt;
    const lang = autoSrc >= 0 ? languageName(pair.source, pair.source_name) : languageName(pair.target, pair.target_name);
    return refuse(`${rel}: its first row names ${lang} in column ${columnLetter(at)}, as a header row would — `
      + 'is that row a header? Ask the person who made the file; the tools never guess. Then add it again with '
      + '--header (a header row, left out) or --no-header (a sentence pair, kept)'
      + (args['source-col'] !== undefined || args['target-col'] !== undefined ? ', with the same columns' : '')
      + ` — MCP add_data: "header": true or false. champollion data add ${rel}`
      + (into !== 'parallel' ? ` --into ${into}` : '') + ' --header');
  }
  const header = fixedColumns ? false : (args['no-header'] ? false : (args.header || headerNamesLanguages));
  let srcCol = fixedColumns ? 0
    : args['source-col'] !== undefined ? pickColumn(args['source-col'], header ? first : null, width) : null;
  let tgtCol = fixedColumns ? 1
    : args['target-col'] !== undefined ? pickColumn(args['target-col'], header ? first : null, width) : null;
  if (args['source-col'] !== undefined && srcCol === null) return refuse(`--source-col ${args['source-col']}: no such column`);
  if (args['target-col'] !== undefined && tgtCol === null) return refuse(`--target-col ${args['target-col']}: no such column`);
  if (srcCol === null && tgtCol === null && headerNamesLanguages && !args['no-header']) {
    srcCol = autoSrc;
    tgtCol = autoTgt;
  }
  // "no header" said of a file whose first row names exactly the two
  // languages: that row is a header, and read as a pair it would teach the
  // model the languages' names. Say so — it names only the languages, never
  // a sentence (Haiku acceptance run, 2026-10-11: the brief's "no header"
  // was about another file). With columns given as well it still holds:
  // a run that passed "header": false with A and B put the row "English →
  // Our language" into the test set as a sentence pair.
  if (args['no-header'] && headerNamesLanguages) {
    const sn = languageName(pair.source, pair.source_name);
    const tn = languageName(pair.target, pair.target_name);
    return refuse(`${rel}: its first row names ${sn} and ${tn}, as a header row does — so it has `
      + 'a header, and that row says which column is which. Add it again without --no-header '
      + `(MCP add_data: leave out "header": false): champollion data add ${rel}`
      + (into !== 'parallel' ? ` --into ${into}` : ''));
  }
  if (srcCol === null || tgtCol === null || srcCol === tgtCol) {
    const profile = profileColumns(header ? rows.slice(1) : rows);
    const sn = languageName(pair.source, pair.source_name);
    const tn = languageName(pair.target, pair.target_name);
    return refuse(`${rel}: which column holds ${sn} and which holds ${tn}? Ask the person `
      + 'who made the file — the tools never guess from the sentences.\n'
      + `  columns${header ? ' (first row is a header)' : ''}:\n    ${columnsNote(profile, header ? first : null, pair)}\n`
      + `  then: champollion data add ${rel} --source-col <letter> --target-col <letter>`
      + (header ? '' : ' [--header if the first row is a header]'));
  }

  const { pairs, report, rowNumbers } = rowsToPairs(rows, srcCol, tgtCol, { header });
  if (!pairs.length) return refuse(`${rel}: no row has both a ${pair.source} and a ${pair.target} sentence in those columns`);
  // what the rows look like before a model learns from them: copies, repeats,
  // odd lengths, swapped or shifted rows — counted and named by row, never
  // removed (plan A9); a word list's rows are words, so only copies and
  // repeats mean anything there
  const quality = screenPairs(pairs, { rowNumbers });
  if (into === 'lexicon') {
    quality.length = { count: 0, rows: [] };
    quality.swapped = { count: 0, rows: [] };
    quality.shifted = { count: 0, runs: [] };
  }
  report.quality = { rows: quality.rows, checked: quality.checked, copies: quality.copies.count,
    duplicates: quality.duplicates.count, length: quality.length.count, swapped: quality.swapped.count,
    shifted: quality.shifted.count };

  const stem = slug(args.name || (table.sheets.length > 1
    ? `${path.parse(file).name}-${sheet.name}` : path.parse(file).name));
  const outDir = path.join(root, INTO[into]);
  const out = path.join(outDir, `${stem}.tsv`);
  const originalSha = usfm ? table.sha256
    : crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  // --replace: read the same original again (another header or columns) —
  // only over what `data add` made from THIS file, and keeping every answer
  // its holders gave; the rails have no other way to correct a mistaken
  // import (model ladder, 2026-10-11)
  let kept = null;
  if (fs.existsSync(out)) {
    let before = null;
    try {
      before = JSON.parse(fs.readFileSync(`${out}${SIDECAR_SUFFIX}`, 'utf-8'));
    } catch { /* no sidecar: not one of ours */ }
    const same = before?.['x-import']?.original_sha256 === originalSha;
    if (!args.replace || !same) {
      return refuse(`${path.relative(root, out)} already exists — `
        + (same ? 'to read the same file again (another header or columns), add --replace '
          + '(MCP add_data: "replace": true); its holders\' answers are kept'
          : 'add this file under another name (--name <stem>)'));
    }
    const { 'x-import': _i, derived_from: _d, written_by: _w, ...answers } = before;
    kept = answers;
  }
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(out, pairs.map(([s, t]) => `${s}\t${t}`).join('\n') + '\n', 'utf-8');

  const projectLocalOnly = (project.defaults?.transmission || 'local-only') === 'local-only';
  const sidecar = {
    $schema: SCHEMA_IDS.set,
    ...(into === 'test' ? { role: 'test' } : {}),
    // a word list is looked up in (the dictionary floor), not a set of pairs
    ...(into === 'lexicon' ? { role: 'resource' } : {}),
    kind: into === 'lexicon' ? 'lexicon' : 'parallel',
    pair: { source: pair.source, target: pair.target },
    ...((projectLocalOnly || into === 'test') ? { transmission: 'local-only', 'x-transmission-default': true } : {}),
    ...(into === 'test' ? { terms: { training: 'not-allowed' } } : {}),
    // scripture translations are usually published under a Bible society's
    // or publisher's copyright: no model learns from one until its holders
    // say so — the TOOL's protection, which their first answer may lift
    ...(usfm && into !== 'test' ? { terms: { training: 'not-allowed' }, 'x-training-default': true } : {}),
    derived_from: path.basename(file),
    written_by: 'champollion data add',
    'x-import': {
      format: table.format, sheet: sheet.name,
      source_column: columnLetter(srcCol), target_column: columnLetter(tgtCol), header: !!header,
      original_sha256: originalSha,
      ...report,
      // which books paired, and what was left out (verses numbered differently)
      ...(usfm ? { usfm: table.counts } : {}),
      // which MDF markers made the two sides, and the dictionary's counts
      ...(toolbox ? { markers: sheet.name === 'words'
        ? { source: '\\ge', target: '\\lx (\\lc, \\se)' } : { source: '\\xe', target: '\\xv' },
      toolbox: table.counts } : {}),
      // which LIFT languages made the two sides, and the dictionary's counts
      ...(lift ? { lift_languages: liftLangs, lift: table.counts } : {}),
      // which ELAN tiers made the two sides
      ...(elan ? { elan_tiers: elanTiers, elan: table.counts } : {}),
    },
  };
  // a replaced import keeps its sidecar as its holders left it (owner, terms,
  // where it may go — even a provisional mark they lifted); only the record
  // of how it was read is new
  const written = kept ? { ...kept, derived_from: sidecar.derived_from, written_by: sidecar.written_by,
    'x-import': sidecar['x-import'] } : sidecar;
  const checked = checkDocument(written, 'set');
  if (checked.errors.length) throw new Error(`data add wrote an invalid sidecar: ${checked.errors.join('; ')}`);
  fs.writeFileSync(`${out}${SIDECAR_SUFFIX}`, JSON.stringify(written, null, 2) + '\n', 'utf-8');

  const outRel = path.relative(cwd, out) || out;
  if (args.json) {
    output.raw(JSON.stringify({ file: rel, wrote: outRel, set: written }, null, 2));
    return 0;
  }
  output.raw(usfm
    ? `\n  ${rel} → ${outRel}: ${report.pairs_written} verse pair(s) from USFM scripture (${table.counts.source} → `
      + `${path.basename(file)}; book(s) ${table.counts.books.join(' ')}`
      + `${table.counts.only_source + table.counts.only_target
        ? `; ${table.counts.only_source + table.counts.only_target} verse(s) numbered in one text only, left out` : ''})`
    : elan
    ? `\n  ${rel} → ${outRel}: ${report.pairs_written} pair(s) from an ELAN file (tier ${elanTiers.source} → `
      + `tier ${elanTiers.target})`
    : lift
    ? `\n  ${rel} → ${outRel}: ${report.pairs_written} pair(s) from a LIFT dictionary (${table.counts.entries} `
      + `entr${table.counts.entries === 1 ? 'y' : 'ies'}; ${sheet.name === 'words'
        ? `gloss [${liftLangs.source}] → headword [${liftLangs.target}]`
        : `translation [${liftLangs.source}] → example [${liftLangs.target}]`})`
    : toolbox
    ? `\n  ${rel} → ${outRel}: ${report.pairs_written} pair(s) from a Toolbox dictionary (${table.counts.records} `
      + `record(s); ${sheet.name === 'words' ? 'English gloss \\ge → headword \\lx' : 'English \\xe → example \\xv'})`
    : `\n  ${rel} → ${outRel}: ${report.pairs_written} pair(s) (${table.format}, sheet "${sheet.name}", `
      + `${columnLetter(srcCol)} → ${columnLetter(tgtCol)}${header ? ', first row a header' : ''})`);
  if (lift && sheet.name === 'words' && (table.sheets[1]?.rows.length || 0)) {
    output.raw(`  it also holds ${table.sheets[1].rows.length} example sentence(s) with their translation — `
      + `as pairs to learn from: champollion data add ${rel}`);
  }
  if (lift && sheet.name === 'examples' && (table.sheets[0]?.rows.length || 0)) {
    output.raw(`  it also holds ${table.sheets[0].rows.length} gloss(es) — as a word list (the dictionary floor): `
      + `champollion data add ${rel} --into lexicon`);
  }
  if (toolbox && sheet.name === 'words' && table.counts.examples) {
    output.raw(`  it also holds ${table.counts.examples} example sentence(s) with their English — `
      + `as pairs to learn from: champollion data add ${rel}`);
  }
  if (toolbox && sheet.name === 'examples' && table.counts.glosses) {
    output.raw(`  it also holds ${table.counts.glosses} gloss(es) — as a word list (the dictionary floor): `
      + `champollion data add ${rel} --into lexicon`);
  }
  if (report.dropped_one_side_empty) output.raw(`  left out ${report.dropped_one_side_empty} row(s) with one side empty`);
  const qlines = qualityLines(quality);
  if (qlines.length) {
    output.raw('  a check of the rows (nothing was removed — look at these rows in the original and decide):');
    for (const l of qlines) output.raw(`    · ${l}`);
  }
  if (report.joined_multiline_cells) output.raw(`  joined ${report.joined_multiline_cells} cell(s) written on several lines into one line`);
  if (report.nfc_composed_cells) {
    output.raw(`  wrote ${report.nfc_composed_cells} cell(s) in composed form (Unicode NFC): a letter typed as a base `
      + 'letter plus an accent mark is stored as the one accented letter — the same letters, written one way');
  }
  // told "a header" of a first row that names neither language: said, so a
  // mistaken --header (it drops a sentence pair) can be caught — a model said
  // a file the person called header-less had one (model ladder, 2026-10-11)
  if (args.header && !headerNamesLanguages && !halfHeader && !fixedColumns) {
    output.raw(`  its first row was left out as a header, as asked — it does not name ${languageName(pair.source, pair.source_name)} `
      + `or ${languageName(pair.target, pair.target_name)}. If the file has no header row, that row is a sentence `
      + `pair: add it again with --no-header --replace (MCP add_data: "header": false, "replace": true)`);
  }
  if (kept) output.raw('  replaced what data add made from this file before — its holders\' answers are kept');
  if (written['x-training-default']) {
    output.raw('  no model may learn from it for now: a scripture translation is usually published under a '
      + 'Bible society\'s or publisher\'s copyright — whether a model may is for its holders to say '
      + '(champollion next asks them)');
  }
  // (the holders of a replaced import may have answered already)
  if (written.transmission && (!kept || written['x-transmission-default'])) {
    output.raw(`  marked local-only for now (${into === 'test' ? 'a test set' : 'the project\'s default'}) — `
      + 'its holders decide the rest: champollion next');
  }
  output.raw(`  The original ${path.basename(file)} is untouched.\n`);
  return 0;
}

// ── data combine ─────────────────────────────────────────────────────────

const COMBINED_FROM = 'data/combined-from';
/** Pair files whose holders said no model may learn from them: kept, never trained on. */
const NOT_FOR_TRAINING = 'data/not-for-training';

/**
 * The sidecar for a file made from several: every protection any of them
 * carries holds (local-only if one is, training not-allowed if one is), and
 * every holder is named. Pure (exported for tests).
 */
export function combinedSidecar(sides, { pair, files, version = 1 }) {
  const owners = [...new Set(sides.map((s) => s.terms?.owner).filter(Boolean))];
  const consents = [...new Set(sides.map((s) => s.terms?.consent_record).filter(Boolean))];
  const speakers = [...new Set(sides.map((s) => s.terms?.speakers).filter(Boolean))];
  // the least agreement any of them carries (a file not agreed to is never
  // joined — combine moves it aside — but the record says it as it is)
  // ("yes" only when every file says yes: an unasked file is not an agreement)
  const agreed = ['some-said-no', 'not-yet'].find((v) => sides.some((s) => s.terms?.speakers_agreed === v))
    || (sides.length && sides.every((s) => s.terms?.speakers_agreed === 'yes') ? 'yes' : undefined);
  const terms = {
    training: sides.some((s) => s.terms?.training === 'not-allowed') ? 'not-allowed' : 'allowed',
    ...(owners.length ? { owner: owners.join('; ') } : {}),
    ...(speakers.length ? { speakers: speakers.join('; ') } : {}),
    ...(agreed ? { speakers_agreed: agreed } : {}),
    ...(consents.length ? { consent_record: consents.join('; ') } : {}),
  };
  return {
    $schema: SCHEMA_IDS.set,
    kind: 'parallel',
    pair: { source: pair.source, target: pair.target },
    ...(sides.some((s) => s.transmission === 'local-only') ? { transmission: 'local-only' } : {}),
    terms,
    derived_from: `${COMBINED_FROM}/`,
    written_by: 'champollion data combine',
    'x-combined-from': files,
    ...(version > 1 ? { 'x-version': version } : {}),
  };
}

async function combine(args, cwd) {
  if (args._.length > 2) return refuse('Usage: champollion data combine [--name <stem>]');
  const root = projectRoot(cwd);
  if (!root) return refuse('run this inside a project (champollion new <folder> --from … --to …)');
  const project = JSON.parse(fs.readFileSync(path.join(root, PROJECT_FILE), 'utf-8'));
  const pair = project.pair || {};
  const dir = path.join(root, INTO.parallel);
  let names;
  try {
    names = fs.readdirSync(dir).filter((n) => !n.startsWith('.') && !n.endsWith(SIDECAR_SUFFIX)
      && fs.statSync(path.join(dir, n)).isFile()).sort();
  } catch {
    names = [];
  }
  if (names.length < 2) {
    return refuse(`${INTO.parallel}/ holds ${names.length} file(s) — there is nothing to combine`);
  }
  const stem = slug(args.name || 'combined');
  const out = path.join(dir, `${stem}.tsv`);
  // a later round: the file this command wrote before is the previous version
  // — its pairs come first, then the new files'; it is kept, renamed, in
  // data/combined-from/ (a family that added sentences after its first model
  // was stopped here: "already exists", wave 1 2026-10-11)
  let previous = null;
  if (fs.existsSync(out)) {
    const side = readSet(out);
    if (!side.exists || side.errors.length || side.data.written_by !== 'champollion data combine') {
      return refuse(`${path.relative(root, out)} already exists and is not a file this command wrote — `
        + 'choose another --name');
    }
    const version = Number(side.data['x-version'] || 1);
    previous = { name: `${stem}.tsv`, version, as: `${stem}-v${version}.tsv` };
    names = [`${stem}.tsv`, ...names.filter((n) => n !== `${stem}.tsv`)];
  }

  // Every file must be one `data add` wrote (two columns, tab) and carry the
  // terms its holders decided: a file nobody has spoken for is not merged
  // into one whose terms say otherwise. A file whose holders said no model
  // may learn from it is not merged at all — the file training reads would
  // otherwise carry that "no" for every sentence in it, and nothing could be
  // trained. It moves to data/not-for-training/ (kept, never learned from).
  const heldOut = [];
  const learnable = [];
  for (const n of names) {
    const side = n.endsWith('.tsv') ? readSet(path.join(dir, n)) : null;
    const notAllowed = side?.exists && !side.errors.length && side.data.terms?.training === 'not-allowed'
      && side.data['x-training-default'] !== true;
    (notAllowed ? heldOut : learnable).push(n);
  }
  if (!learnable.length) {
    return refuse(`every file in ${INTO.parallel}/ is one its holders said no model may learn from — `
      + 'there is nothing to train on; nothing was moved');
  }
  const moveHeldOut = () => {
    if (!heldOut.length) return;
    const away = path.join(root, NOT_FOR_TRAINING);
    fs.mkdirSync(away, { recursive: true });
    for (const n of heldOut) {
      for (const f of [n, `${n}${SIDECAR_SUFFIX}`]) {
        if (fs.existsSync(path.join(dir, f))) fs.renameSync(path.join(dir, f), path.join(away, f));
      }
    }
  };
  const heldOutNote = () => (heldOut.length
    ? `  left out ${heldOut.length} file(s) its holders said no model may learn from (${heldOut.join(', ')}) — `
      + `moved to ${NOT_FOR_TRAINING}/ with their sidecars: kept, never learned from` : null);

  const sides = [];
  const files = [];
  const seen = new Set();
  const lines = [];
  let repeats = 0;
  for (const n of learnable) {
    const rel = `${INTO.parallel}/${n}`;
    if (!n.endsWith('.tsv')) {
      return refuse(`${rel}: only .tsv files written by \`champollion data add\` are combined — bring this `
        + `file in with \`champollion data add\` (from inbox/), then move it out of ${INTO.parallel}/`);
    }
    const side = readSet(path.join(dir, n));
    if (!side.exists || side.errors.length) {
      return refuse(`${rel}: it has no valid .champollion.json sidecar — champollion validate says why`);
    }
    if (!side.data.terms?.training || side.data['x-training-default'] === true) {
      return refuse(`${rel}: its holders have not said yet whether a model may learn from it — `
        + 'champollion next asks them; combine afterwards');
    }
    if (!side.data.terms?.speakers_agreed) {
      return refuse(`${rel}: nobody has said yet whether everyone whose words are in it agreed — `
        + 'champollion next asks the people; combine afterwards');
    }
    const sp = side.data.pair;
    if (sp && (sp.source !== pair.source || sp.target !== pair.target)) {
      return refuse(`${rel} runs ${sp.source} → ${sp.target}, but the project is ${pair.source} → ${pair.target}`);
    }
    const bytes = fs.readFileSync(path.join(dir, n));
    let kept = 0;
    for (const line of bytes.toString('utf-8').split('\n')) {
      if (!line.trim()) continue;
      const cells = line.split('\t');
      if (cells.length !== 2 || !cells[0].trim() || !cells[1].trim()) {
        return refuse(`${rel}: a line without exactly two tab-separated sides — this is not a file `
          + '`champollion data add` wrote; fix it or add it again');
      }
      if (seen.has(line)) { repeats++; continue; }
      seen.add(line);
      lines.push(line);
      kept++;
    }
    sides.push(side.data);
    files.push({ file: previous && n === previous.name ? previous.as : n,
      sha256: crypto.createHash('sha256').update(bytes).digest('hex'), pairs_kept: kept,
      ...(previous && n === previous.name ? { previous_version: previous.version } : {}) });
  }

  // one file a model may learn from: it IS the file training reads
  if (learnable.length === 1) {
    moveHeldOut();
    const only = path.relative(cwd, path.join(dir, learnable[0])) || learnable[0];
    if (args.json) {
      output.raw(JSON.stringify({ wrote: null, training_reads: only, not_for_training: heldOut,
        moved_to: NOT_FOR_TRAINING }, null, 2));
      return 0;
    }
    output.raw(`\n  ${only} is the one file training reads — nothing to combine`);
    if (heldOut.length) output.raw(heldOutNote());
    output.raw('  Next: champollion next\n');
    return 0;
  }

  const sidecar = combinedSidecar(sides, { pair, files, version: previous ? previous.version + 1 : 1 });
  const checked = checkDocument(sidecar, 'set');
  if (checked.errors.length) throw new Error(`data combine wrote an invalid sidecar: ${checked.errors.join('; ')}`);
  // The originals move (never deleted) so data/parallel/ holds the one file;
  // the previous version first, under its versioned name.
  const keep = path.join(root, COMBINED_FROM);
  fs.mkdirSync(keep, { recursive: true });
  for (const n of learnable) {
    const as = previous && n === previous.name ? previous.as : n;
    for (const [f, g] of [[n, as], [`${n}${SIDECAR_SUFFIX}`, `${as}${SIDECAR_SUFFIX}`]]) {
      if (fs.existsSync(path.join(dir, f))) fs.renameSync(path.join(dir, f), path.join(keep, g));
    }
  }
  fs.writeFileSync(out, lines.join('\n') + '\n', 'utf-8');
  fs.writeFileSync(`${out}${SIDECAR_SUFFIX}`, JSON.stringify(sidecar, null, 2) + '\n', 'utf-8');
  moveHeldOut();

  const outRel = path.relative(cwd, out) || out;
  if (args.json) {
    output.raw(JSON.stringify({ wrote: outRel, pairs: lines.length, exact_repeats_dropped: repeats,
      version: previous ? previous.version + 1 : 1, moved_to: COMBINED_FROM, not_for_training: heldOut,
      set: sidecar }, null, 2));
    return 0;
  }
  output.raw(`\n  ${learnable.length} files → ${outRel}: ${lines.length} pair(s)`
    + (repeats ? ` (${repeats} exact repeat(s) left out)` : '')
    + (previous ? ` — version ${previous.version + 1}; version ${previous.version} kept as `
      + `${COMBINED_FROM}/${previous.as}` : ''));
  const t = sidecar.terms;
  output.raw(`  terms: ${sidecar.transmission === 'local-only' ? 'local-only' : 'may leave this computer'} · `
    + `training ${t.training}${t.owner ? ` · held by ${t.owner}` : ''} — the strictest of the files'`);
  output.raw(`  the originals moved to ${COMBINED_FROM}/ (with their sidecars); nothing was deleted`);
  if (heldOut.length) output.raw(heldOutNote());
  output.raw('  Next: champollion next\n');
  return 0;
}

async function run(args, cwd) {
  const sub = args._[1];
  if (sub === 'mark') return mark(args, cwd);
  if (sub === 'add') return add(args, cwd);
  if (sub === 'combine') return combine(args, cwd);
  output.error(sub ? `Unknown data subcommand: "${sub}".` : 'Missing data subcommand.');
  output.error('Usage: champollion data add <file> … | data mark <file> … | data combine (see champollion data --help)');
  return 2;
}

export { run };
