/**
 * publish_report — publish a FINISHED run's report, the MCP twin of
 * `mt-eval publish <report> [--scores-only] [--redact-coaching]`.
 *
 * Round 7: an MCP-only agent could publish only at run time (run_benchmark
 * publish: true); an existing report, or a scores-only publish of one, was a
 * terminal step. This drives the harness's own publish, behind the same gate
 * as run_benchmark's (Round 6):
 *
 *   1. every call first runs `mt-eval publish <report> … --dry-run` — no
 *      network, no sign-in — and reads from ITS preview what would go public:
 *      the sentence rows WITH their text or scores only (its "Entries:" line),
 *      the prompt published / redacted / none (its "Prompt:" line), and where
 *      (its "Target would be:" line, cross-checked with MT_EVAL_SUPABASE_URL);
 *   2. without confirm: true, that preview IS the answer, with the exact
 *      publish_ack words (publish-preview.js's vocabulary);
 *   3. only confirm: true with that exact publish_ack publishes — `--yes`, and
 *      `--prod` for the production board (the explicit opt-in the harness
 *      demands). A preview the tool cannot read is a refusal, never a guess.
 *
 * preview_publish (Round 13) is step 1 alone, as its own READ-ONLY tool: no
 * confirm, no publish_ack, no path to the real publish — so an agent host
 * can allow the preview without allowing a production write (the researcher
 * persona's host blocked publish_report's preview as a deploy). Its answer
 * ends with the exact publish_report call that would publish what it showed.
 */

import { readFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

import { isMtEvalInstalled, publishTarget, stripAbsolutePaths } from './harness.js';
import { runBounded } from './harness-fst.js';
import { ackLines } from './publish-preview.js';
import { trimMiddle } from './output-trim.js';
import { displayPath } from './state.js';

export const PUBLISH_DRY_RUN_TIMEOUT_MS = 45_000;
export const PUBLISH_TIMEOUT_MS = 50_000;

// eslint-disable-next-line no-control-regex
const CTRL_RE = /[\u0000-\u001f\u007f]/;

/**
 * The report a call names, as an absolute path (it can never start with '-').
 * Throws a message an agent can act on.
 */
export function resolveReport(report, {
  isFile = (p) => { try { return statSync(p).isFile(); } catch { return false; } },
} = {}) {
  if (typeof report !== 'string' || !report.trim() || CTRL_RE.test(report)) {
    throw new Error('report must be the path to a *_report.json (get_run_status prints it under "Results")');
  }
  const v = report.trim();
  const p = resolve(v.startsWith('~') ? join(homedir(), v.slice(1)) : v);
  if (!isFile(p)) throw new Error(`report not found: ${v}`);
  if (!/\.json$/i.test(p)) throw new Error(`report must be a TestReport .json file (a *_report.json), not ${v}`);
  return p;
}

/** How many sentence rows the report holds (read locally; nothing is printed). */
function entryCount(path, read) {
  let doc;
  try { doc = JSON.parse(read(path, 'utf-8')); } catch (err) {
    throw new Error(`report is not valid JSON (${err.message}): ${displayPath(path)}`);
  }
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) throw new Error(`report is not a TestReport: ${displayPath(path)}`);
  return Array.isArray(doc.entries) ? doc.entries.length : 0;
}

/**
 * The harness's dry-run preview without its run-card JSON payload (the
 * summary lines, the incomplete-card warning, the target line).
 */
export function previewLines(stdout) {
  const lines = String(stdout || '').split('\n').map((l) => l.replace(/\s+$/, ''));
  const m = lines.findIndex((l) => l.includes('--- DRY RUN: run-card payload'));
  if (m < 0) return lines;
  let j = m + 1;
  if ((lines[j] || '').startsWith('{')) {
    while (j < lines.length && lines[j] !== '}') j += 1;
    j += 1;
  }
  return [...lines.slice(0, m), ...lines.slice(j)];
}

/**
 * The harness preview's local-only block (publish.local_only_publication_
 * lines): its paragraphs — what of a local-only corpus is published with
 * the score, what a new `datasets` row would carry, what stays on this
 * machine, how others read the score — each re-joined from its wrapped
 * lines. [] when the corpus is not local-only (no block). The relay used to
 * name the dataset id and licence without saying they would become public
 * (synthetic Cree school, Round 12).
 *
 * @param {string} text  the dry run's stdout
 * @returns {string[]}
 */
export function localOnlyPublication(text) {
  const lines = String(text || '').split('\n');
  const i = lines.findIndex((l) => /^\s*Local-only corpus — what this publish makes public/.test(l));
  if (i < 0) return [];
  const paras = [];
  for (const l of lines.slice(i + 1)) {
    if (/^ {6}\S/.test(l) && paras.length) paras[paras.length - 1] += ` ${l.trim()}`;
    else if (/^ {4}\S/.test(l)) paras.push(l.trim());
    else break;
  }
  return paras;
}

/**
 * What the harness's preview says goes public, and the exact acknowledgement
 * (the vocabulary run_benchmark's publish gate uses).
 *
 * @param {{output: string, entries: number, target: {prod: boolean, label: string}, anonymous?: boolean}} input
 * @returns {{ok: boolean, lines: string[], ack: string|null, error?: string}}
 */
export function reportPublishFacts({ output, entries, target, anonymous = false }) {
  const text = String(output || '');
  const fail = (error) => ({ ok: false, ack: null, error, lines: [] });
  const tgt = /Target would be:\s*(PRODUCTION|non-prod)/.exec(text);
  if (tgt && (tgt[1] === 'PRODUCTION') !== target.prod) {
    return fail(`the harness's preview names ${tgt[1] === 'PRODUCTION' ? 'PRODUCTION' : 'a non-production project'} `
      + `but this server would publish to ${target.label}`);
  }
  const ent = /^\s*Entries:\s+(.*)$/m.exec(text);
  let rows;
  let why = '';
  if (ent) {
    why = /\(([^()]*)\)\s*$/.exec(ent[1])?.[1] || '';
    if (/WITH their source \+ reference text/.test(ent[1])) rows = 'text';
    else if (/WITHHELD/.test(ent[1])) rows = 'scores';
    else return fail(`the harness's "Entries:" line is not one this tool knows: ${ent[1].slice(0, 160)}`);
  } else if (entries === 0) {
    rows = 'none';
  } else {
    return fail(`the harness's preview does not say what happens to the report's ${entries} sentence rows`);
  }
  const pr = /^\s*Prompt:\s+(.*)$/m.exec(text);
  let prompt;
  if (!pr) prompt = 'none';
  else if (/REDACTED/.test(pr[1])) prompt = 'redacted';
  else if (/IS published/.test(pr[1])) prompt = 'published';
  else return fail(`the harness's "Prompt:" line is not one this tool knows: ${pr[1].slice(0, 160)}`);

  // How the board will LIST the row (harness 2026-10-04+): its trust tier
  // (every publish from mt-eval is self-benchmarked, 'unverified') and its
  // score lane (absolute-quality vs relative-comparison-only, by the
  // corpus's contamination grade). Relayed when the preview says them; an
  // older harness that does not is not a refusal — these do not change what
  // goes public.
  const trust = /^\s*Trust:\s+(.*)$/m.exec(text)?.[1]?.trim();
  const lane = /^\s*Score lane:\s+(.*)$/m.exec(text)?.[1]?.trim();
  // What the board shows beside the scores (harness 2026-10-04+ prints
  // them: method + class + paradigm, dependency class, tools, open source,
  // a plugin's code hash and version and the model it was handed, an
  // engine's model). Relayed as the harness says them, in its order —
  // never reconstructed here. Round 10 researcher: the preview listed the
  // model and scores only, so "what goes public" was incomplete for a
  // plugin run.
  const methodLines = [];
  for (const m of text.matchAll(/^\s*(Method|Dependency|Tools|Open source|Code|Model given|Models called|Engine model|⚠ Pair):\s+(.*)$/gm)) {
    methodLines.push(`      ${m[1]}: ${m[2].trim()}`);
  }

  const localOnly = localOnlyPublication(text);

  const where = target.prod ? 'production' : 'non-production';
  const lines = [
    'WHAT GETS PUBLISHED (read from the harness\'s own preview above):',
    `  • the run card — scores, model, settings — goes to ${target.label}`,
    rows === 'text'
      ? `  • EVERY row WITH its source, reference and model output text goes to the PUBLIC run_card_entries table${why ? ` (${why})` : ''}`
      : rows === 'scores'
        ? `  • sentence text is WITHHELD — scores only${why ? ` (${why})` : ''}`
        : '  • no sentence rows — the report holds none; scores only',
    prompt === 'none'
      ? '  • no prompt — the run card carries none'
      : prompt === 'redacted'
        ? '  • the prompt is REDACTED on the card — only its sha256 is published'
        : '  • the system/coaching prompt\'s FULL TEXT is published with the card — also when sentence text is withheld '
          + '(redact_coaching: true publishes only its sha256)',
    anonymous
      ? '  • submitted as "anonymous" — no sign-in (the anonymous intake is rate-limited per IP)'
      : '  • submitted under the account `mt-eval` is signed in to (without one the publish fails: pass anonymous: true)',
    ...(localOnly.length
      ? ['  • the corpus is marked LOCAL-ONLY — what of it goes public, as the harness\'s preview says:',
        ...localOnly.map((p) => `      ${p}`)] : []),
    ...(trust ? [`  • listed with trust ${trust}`] : []),
    ...(lane ? [`  • score lane: ${lane}`] : []),
    ...(methodLines.length
      ? ['  • the method, as the board shows it beside the scores:', ...methodLines] : []),
  ];
  const ack = `publish to ${where}: ${rows === 'text' ? 'sentence text' : 'scores only'}, `
    + `${prompt === 'none' ? 'no prompt' : `prompt ${prompt}`}`;
  return { ok: true, lines, ack };
}

/** The harness's output for the agent: path-stripped, head and tail kept. */
function shown(r) {
  return stripAbsolutePaths(trimMiddle([r.stdout, r.stderr].filter((s) => s && s.trim()).join('\n'))) || '(no output)';
}

/**
 * The exact publish_report call that publishes what a preview showed — the
 * same report and flags (the acknowledgement depends on them) plus confirm
 * and the exact publish_ack. One line an agent can copy.
 *
 * @param {{path: string, scoresOnly: boolean, redact: boolean, anonymous: boolean, ack: string}} p
 * @returns {string}
 */
export function publishCall({ path, scoresOnly = false, redact = false, anonymous = false, ack }) {
  const args = {
    report: displayPath(path),
    ...(scoresOnly ? { scores_only: true } : {}),
    ...(redact ? { redact_coaching: true } : {}),
    ...(anonymous ? { anonymous: true } : {}),
    confirm: true,
    publish_ack: ack,
  };
  return `publish_report { ${Object.entries(args).map(([k, v]) => `${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(', ')} }`;
}

/** The argv of the harness's dry run — always ends in --dry-run, never --yes / --prod. */
export function dryRunArgv(path, { scoresOnly = false, redact = false, anonymous = false } = {}) {
  return ['publish', path, ...(scoresOnly ? ['--scores-only'] : []), ...(redact ? ['--redact-coaching'] : []),
    ...(anonymous ? ['--anonymous'] : []), '--dry-run'];
}

/**
 * Step 1 of every publish_report call and the WHOLE of preview_publish: the
 * harness's own `mt-eval publish <report> … --dry-run` (no network, no
 * sign-in), read into what would go public. Runs nothing else — no path
 * from here reaches the real publish. Never throws.
 *
 * @returns {Promise<{error: {text: string, isError: true}}
 *   | {path: string, flags: string[], target: object, facts: object, head: string[],
 *      scoresOnly: boolean, redact: boolean, anonymous: boolean}>}
 */
async function harnessPreview(params, deps, { verb }) {
  const { report, scores_only: scoresOnly = false, redact_coaching: redact = false, anonymous = false } = params;
  const {
    isMtEvalInstalled: checkInstalled = isMtEvalInstalled, run = runBounded, env = process.env,
    isFile, read = readFileSync,
  } = deps;
  const error = (text) => ({ error: { text, isError: true } });

  if (!(await checkInstalled())) {
    return error(`mt-eval is not installed on this machine, so there is no harness to ${verb} with. Install it: `
      + '`pipx install mt-eval-harness` — then call this tool again.');
  }
  let path;
  let entries;
  try {
    path = resolveReport(report, isFile ? { isFile } : {});
    entries = entryCount(path, read);
  } catch (err) {
    return error(`Cannot ${verb}: ${err.message}`);
  }
  const flags = [...(scoresOnly ? ['--scores-only'] : []), ...(redact ? ['--redact-coaching'] : [])];
  const target = publishTarget(env);

  // The harness's own preview — every call, so the acknowledgement always
  // matches what the report would publish NOW. --anonymous rides the dry run
  // too, so the harness's preview names the identity the publish will use.
  const argv = dryRunArgv(path, { scoresOnly, redact, anonymous });
  if (argv[argv.length - 1] !== '--dry-run' || argv.includes('--yes') || argv.includes('--prod')) {
    // unreachable by construction; a preview must never become a publish
    return error('internal error: the preview argv is not a dry run — nothing was run.');
  }
  const dry = await run('mt-eval', argv, { env, timeout: PUBLISH_DRY_RUN_TIMEOUT_MS });
  if (dry.spawnError || dry.timedOut || dry.code !== 0) {
    const why = dry.spawnError ? `could not start mt-eval (${stripAbsolutePaths(dry.spawnError)})`
      : dry.timedOut ? `it did not finish within ${PUBLISH_DRY_RUN_TIMEOUT_MS / 1000}s` : `it exited ${dry.code}`;
    return error([`PUBLISH PREVIEW FAILED — the harness's dry run did not complete (${why}); nothing was published.`,
      '', shown(dry)].join('\n'));
  }
  const facts = reportPublishFacts({ output: dry.stdout, entries, target, anonymous });
  const preview = stripAbsolutePaths(trimMiddle(previewLines(dry.stdout).join('\n')));
  const head = [
    `Report:  ${displayPath(path)}`,
    `Target:  ${target.label}`,
    ...(flags.length ? [`Flags:   ${flags.join(' ')}`] : []),
    '',
    'The harness\'s own preview (`mt-eval publish <report> --dry-run` — no network, no sign-in):',
    preview,
  ];
  if (!facts.ok) {
    return error(['REFUSED — what this report would publish could not be read from the harness\'s preview '
      + `(${facts.error}), so nothing was published.`, '', ...head, '',
    'Show the user the preview above; a publish waits until what goes public can be named.'].join('\n'));
  }
  return { path, flags, target, facts, head, scoresOnly, redact, anonymous };
}

/** The lines that hand over to the real publish: who must agree, and the exact call. */
function nextCallLines(p) {
  return [
    `To publish exactly this — only after the user has seen the lines above and agreed — the next call is `
      + `publish_report, which WRITES to ${p.target.label}:`,
    `  ${publishCall({ path: p.path, scoresOnly: p.scoresOnly, redact: p.redact, anonymous: p.anonymous, ack: p.facts.ack })}`,
    'Any other publish_ack, or other flags, is refused and nothing is written.',
  ];
}

/**
 * preview_publish — the READ-ONLY half of publish_report: what publishing a
 * finished report would put on the board, and the exact call that would.
 * It runs only the harness's dry run (harnessPreview) and has no confirm or
 * publish_ack, so no input reaches the real publish. A cautious agent host
 * can allow this tool on its own and keep publish_report behind approval
 * (Round 13 researcher: the host blocked the preview as a production deploy,
 * because preview and publish were one tool). Never throws.
 *
 * @param {object} params  report, scores_only?, redact_coaching?, anonymous?
 * @param {object} [deps]  isMtEvalInstalled, run (runBounded's contract), env, isFile, read
 * @returns {Promise<{text: string, isError: boolean}>}
 */
export async function previewReport(params, deps = {}) {
  const p = await harnessPreview(params, deps, { verb: 'preview a publish' });
  if (p.error) return p.error;
  return {
    isError: false,
    text: ['PUBLISH PREVIEW (read-only) — nothing was published; this tool cannot publish.', '', ...p.head, '',
      ...p.facts.lines, '', ...nextCallLines(p), '',
      'Show the user what goes public and where; publish only with their agreement to exactly that.'].join('\n'),
  };
}

/**
 * publish_report — publish one finished report. Without confirm: true it
 * answers with the same preview as preview_publish and writes nothing (kept
 * for callers written before preview_publish existed). Never throws.
 *
 * @param {object} params  report, scores_only?, redact_coaching?, anonymous?, confirm?, publish_ack?
 * @param {object} [deps]  isMtEvalInstalled, run (runBounded's contract), env, isFile, read
 * @returns {Promise<{text: string, isError: boolean}>}
 */
export async function publishReport(params, deps = {}) {
  const { confirm = false, publish_ack: given } = params;
  const { run = runBounded, env = process.env } = deps;
  const error = (text) => ({ text, isError: true });

  // 1. The harness's own preview (preview_publish's whole job).
  const p = await harnessPreview(params, deps, { verb: 'publish' });
  if (p.error) return p.error;
  const { path, flags, target, facts, head, anonymous } = p;
  if (confirm !== true) {
    return {
      isError: false,
      text: ['PUBLISH PREVIEW — nothing was published.', '', ...head, '', ...facts.lines, '', ...ackLines(facts), '',
        ...nextCallLines(p), '',
        'Show the user what goes public and where; publish only with their agreement to exactly that. '
        + '(preview_publish gives this same preview from a read-only tool.)'].join('\n'),
    };
  }
  if (given !== facts.ack) {
    return error([...ackLines(facts, { refused: true, given: given ?? null }), '', ...facts.lines, '',
      'Nothing was published. Show the user what goes public; only with their agreement call again with confirm: true '
      + 'and that publish_ack.'].join('\n'));
  }

  // 2. The real publish: --yes (no TTY under MCP), --prod for the production
  // board (the harness's separate opt-in), the user's flags.
  const argv = ['publish', path, ...flags, '--yes', ...(target.prod ? ['--prod'] : []), ...(anonymous ? ['--anonymous'] : [])];
  const r = await run('mt-eval', argv, { env, timeout: PUBLISH_TIMEOUT_MS });
  if (r.spawnError) return error(`PUBLISH FAILED — could not start mt-eval (${stripAbsolutePaths(r.spawnError)}); nothing was published.`);
  if (r.timedOut) {
    return error([`PUBLISH DID NOT FINISH within ${PUBLISH_TIMEOUT_MS / 1000}s and was stopped — it may or may not have reached `
      + `${target.label}. Check with get_results before trying again (a second publish of the same run is refused as a `
      + 'duplicate, never posted twice).', '', shown(r)].join('\n'));
  }
  if (r.code !== 0) {
    return error([`PUBLISH FAILED (exit ${r.code}) — the harness's message is below; relay it. Nothing is retried.`, '', shown(r)].join('\n'));
  }
  return {
    isError: false,
    text: [`PUBLISHED to ${target.label} (${facts.ack.replace(/^publish to [^:]+: /, '')}).`, '', shown(r), '',
      'Call get_results (filtered to this pair/model) to see the entry.'].join('\n'),
  };
}
