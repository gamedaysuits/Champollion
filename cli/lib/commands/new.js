/**
 * Command: new
 *
 *   champollion new <folder> --from <language> --to <language>
 *                   [--name "…"] [--purpose "…"] [--target-name "…"] [--source-name "…"] [--dry]
 *
 * Starts a project on the rails: one folder with a place for everything
 * (data/parallel, data/test, data/lexicon, data/grammar, data/monolingual,
 * consent/, inbox/), a champollion.project.json recording the decisions, a
 * README that says what goes where, a .gitignore that keeps the data off any
 * repository you push, NEXT.md — the next step — and AGENTS.md: the rules an
 * AI agent working in the folder follows (the operating contract,
 * /docs/agents/contract, copied verbatim from the template that
 * cli/scripts/build-agents-md.mjs generates; an existing AGENTS.md is never
 * overwritten).
 *
 * Languages are given as codes or names and resolved through the language
 * cards; a private-use code (qaa–qtz) for a variety without one is accepted
 * with the name the people building it give. Only `language` projects are on
 * the rails so far: task (a sealed bounty) and service (an API) arrive with
 * their own steps, and are refused rather than half-built.
 *
 * --dry resolves the languages and checks the folder, and writes nothing: the
 * rails say the direction back to the person before a project is made (wave 1,
 * 2026-10-12: a learner who wanted their language INTO English got a project
 * built the other way, in all five runs).
 */

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { checkDocument, SCHEMA_IDS, PROJECT_FILE } from '../framework/index.js';
import { nextStep, renderNextMd } from '../framework/journey.js';
import { getLanguageCard, isPrivateUseCode, resolveCode, resolveLanguageInput } from '../registers.js';
import { output } from '../output.js';

const require = createRequire(import.meta.url);
const { version } = require('../../package.json');

const TEMPLATE_DIRS = [
  path.join(import.meta.dirname, '..', '..', 'shared', 'templates'),
  path.join(import.meta.dirname, '..', '..', '..', 'shared', 'templates'),
];
const FOLDERS = ['inbox', 'data/parallel', 'data/test', 'data/lexicon', 'data/grammar',
  'data/monolingual', 'consent'];
const ON_THE_RAILS = ['language'];

function template(kind, name) {
  for (const dir of TEMPLATE_DIRS) {
    try {
      return fs.readFileSync(path.join(dir, kind, name), 'utf-8');
    } catch { /* next */ }
  }
  throw new Error(`template ${kind}/${name} is missing from this install; reinstall champollion`);
}

function fill(text, vars) {
  return text.replace(/\{([a-z_]+)\}/g, (m, k) => (k in vars ? vars[k] : m));
}

/** A language argument → { code, name } or { error }. */
export function resolveLanguage(input, givenName) {
  const r = resolveLanguageInput(input);
  if (r.error) return { error: `${input}: ${r.error}` };
  if (r.candidates) return { error: `"${input}" could mean ${r.candidates.join(', ')} — give the code` };
  const code = isPrivateUseCode(r.code) ? r.code.toLowerCase() : resolveCode(r.code);
  if (isPrivateUseCode(code)) {
    if (!givenName) {
      return { error: `${code} is a private-use code: no language card names it, so give the `
        + 'language\'s name as its people say it (--target-name / --source-name)' };
    }
    return { code, name: givenName, privateUse: true };
  }
  const card = getLanguageCard(code);
  if (!card) {
    return { error: `no language card for "${input}". Search with \`champollion card <name>\`, or `
      + 'use a private-use code (qaa) with --target-name for a variety without a code' };
  }
  return {
    code: card.code || code,
    name: givenName || card.name,
    // A name the card records but does not display ("Blackfoot" for Siksika):
    // said back with its source, so the person can see what they were matched to.
    ...(r.recorded?.length ? { matchedAs: matchedAs(r.input, r.recorded) } : {}),
    // Other languages that carry the same word as another name, or as what
    // their speakers call them: named, so the person can say "not that one".
    ...(r.alsoRecordedFor?.length
      ? { alsoNamed: `"${r.input}" is also recorded for ${r.alsoRecordedFor.map((l) => `${l.name} (${l.code})`).join(', ')}`
        + ' — pass that code instead if it is the one meant' }
      : {}),
  };
}

/** `"Blackfoot" is another name for this language (sil-langtags-1.4@2026-06-09)` */
function matchedAs(typed, claims) {
  const sources = [...new Set(claims.map((c) => c.source).filter(Boolean))];
  const what = claims.some((c) => c.field === 'alternateNames')
    ? 'another name for this language' : 'the name another registry gives this language';
  return `"${typed}" is ${what}${sources.length ? ` (${sources.join(', ')})` : ''}`;
}

async function run(args, cwd) {
  const folderArg = args._[1];
  if (!folderArg || args._.length > 2) {
    output.error('Usage: champollion new <folder> --from <language> --to <language> '
      + '[--name "…"] [--purpose "…"] [--target-name "…"]');
    return 2;
  }
  const kind = args.kind || 'language';
  if (!ON_THE_RAILS.includes(kind)) {
    output.error(`a "${kind}" project is not on the rails yet — only language projects `
      + '(build a translation method for a pair) are so far. Hosting a sealed bounty and '
      + 'running an API service get their own steps; until then use `mt-eval contest` and '
      + '`champollion serve` directly.');
    return 2;
  }
  if (!args.from || !args.to) {
    output.error('say which languages: --from <language> --to <language> (codes like eng and crk, '
      + 'or names like "English" and "Plains Cree")');
    return 2;
  }
  // A name no card carries: the refusal ends with the one command that takes
  // the person's own name as a private-use language (E5, 2026-10-18: nine
  // models of every size wrote --to "Our language" first; none ran)
  const q = (v) => (/^[\w.-]+$/.test(String(v)) ? String(v) : `"${String(v).replace(/"/g, '\\"')}"`);
  const unknown = (r) => /is neither a language code nor the name|^no language card for/.test(r.error.replace(/^[^:]*: /, ''));
  const src = resolveLanguage(args.from, args['source-name']);
  if (src.error) {
    output.error(src.error + (unknown(src) && !args['source-name']
      ? `\n  If ${q(args.from)} has no code: champollion new ${q(folderArg)} --from qaa --source-name ${q(args.from)} --to ${q(args.to)}`
      : ''));
    return 2;
  }
  const tgt = resolveLanguage(args.to, args['target-name']);
  if (tgt.error) {
    output.error(tgt.error + (unknown(tgt) && !args['target-name']
      ? `\n  If ${q(args.to)} has no code: champollion new ${q(folderArg)} --from ${q(args.from)} --to qaa --target-name ${q(args.to)}`
      : ''));
    return 2;
  }
  if (src.code === tgt.code) {
    output.error(`--from and --to are the same language (${src.code})`);
    return 2;
  }

  const root = path.resolve(cwd, folderArg);
  if (fs.existsSync(path.join(root, PROJECT_FILE))) {
    output.error(`${folderArg} is already a project. Ask what comes next: champollion next ${folderArg}`);
    return 1;
  }
  if (fs.existsSync(root) && fs.readdirSync(root).filter((f) => !f.startsWith('.')).length) {
    output.error(`${folderArg} already has files in it. Start the project in a new folder, then `
      + 'copy your data into its data/ folders.');
    return 1;
  }

  const language = ({ code, name: n, matchedAs: m, alsoNamed: a }) => ({
    code, name: n, ...(m ? { matchedAs: m } : {}), ...(a ? { alsoNamed: a } : {}),
  });
  if (args.dry) {
    if (args.json) {
      output.raw(JSON.stringify({ project: root, dry: true,
        languages: { source: language(src), target: language(tgt) } }, null, 2));
    } else {
      output.raw(`\n  ${folderArg} would translate ${src.name} (${src.code}) into ${tgt.name} (${tgt.code}):`);
      output.raw(`    ${src.name} goes in, ${tgt.name} comes out. Nothing was written.\n`);
    }
    return 0;
  }

  const name = args.name || `${src.name} → ${tgt.name}`;
  const project = {
    $schema: SCHEMA_IDS.project,
    kind,
    name,
    pair: {
      source: src.code, target: tgt.code,
      ...(src.privateUse || args['source-name'] ? { source_name: src.name } : {}),
      ...(tgt.privateUse || args['target-name'] ? { target_name: tgt.name } : {}),
    },
    ...(args.purpose ? { purpose: args.purpose } : {}),
    defaults: { transmission: 'local-only', training: 'ask', share_scores: 'ask' },
    created_with: `champollion ${version}`,
  };
  const checked = checkDocument(project, 'project');
  if (checked.errors.length) {
    output.error(`the project file would not be valid: ${checked.errors.join('; ')}`);
    return 1;
  }

  fs.mkdirSync(root, { recursive: true });
  for (const f of FOLDERS) fs.mkdirSync(path.join(root, f), { recursive: true });
  fs.writeFileSync(path.join(root, PROJECT_FILE), JSON.stringify(project, null, 2) + '\n', 'utf-8');
  const vars = {
    name, source_name: src.name, target_name: tgt.name,
    purpose_line: args.purpose ? `\nWhat it is for: ${args.purpose}\n` : '',
  };
  fs.writeFileSync(path.join(root, 'README.md'), fill(template(kind, 'README.md'), vars), 'utf-8');
  const gi = path.join(root, '.gitignore');
  if (!fs.existsSync(gi)) fs.writeFileSync(gi, template(kind, 'gitignore'), 'utf-8');
  const next = nextStep(root);
  fs.writeFileSync(path.join(root, 'NEXT.md'), renderNextMd(next, name), 'utf-8');
  const agents = path.join(root, 'AGENTS.md');
  if (!fs.existsSync(agents)) fs.writeFileSync(agents, template(kind, 'AGENTS.md'), 'utf-8');

  if (args.json) {
    output.raw(JSON.stringify({
      project: root, file: project, languages: { source: language(src), target: language(tgt) }, next,
    }, null, 2));
    return 0;
  }
  output.raw(`\n  Started ${name} in ${path.relative(cwd, root) || '.'}/`);
  output.raw(`    ${src.name} (${src.code}) → ${tgt.name} (${tgt.code})`);
  for (const side of [src, tgt]) {
    if (side.matchedAs) output.raw(`    ${side.matchedAs}: ${side.name} (${side.code})`);
    if (side.alsoNamed) output.raw(`    ${side.alsoNamed}`);
  }
  output.raw('    data/parallel/  sentence pairs to learn from');
  output.raw('    data/test/      the sentences a fluent speaker checked (never learned from)');
  output.raw('    data/lexicon/   word lists · data/grammar/ notes · consent/ who agreed to what');
  output.raw('    AGENTS.md       the rules an AI agent helping here works under');
  output.raw('  Nothing here leaves this computer; the .gitignore keeps data off any repository you push.');
  if (next.step) output.raw(`\n  Next: ${next.step.say}`);
  output.raw(`  Ask again any time: champollion next ${path.relative(cwd, root) || '.'}\n`);
  return 0;
}

export { run };
