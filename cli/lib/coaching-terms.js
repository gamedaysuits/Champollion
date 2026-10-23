/**
 * coaching-terms.js — a pair's coaching files are held to their holders' terms.
 *
 * The coaching prompt (`coachingFile`) rides in every LLM method's system
 * message, and the coaching file's dictionary (.champollion/coaching/<locale>.json)
 * is sent to every LLM method and to DeepL as a glossary. A dictionary or notes
 * can be data its holders marked local-only (`champollion data mark … --local-only`,
 * a set/1 sidecar beside the file). Until 2026-10-09 nothing checked: a marked
 * coaching file went to a hosted model like any other prompt (the harness had
 * the same gap; arena/mt_eval_harness/transmission_policy.coaching_file_policy).
 *
 * The rule: a pair whose coaching files carry a local-only mark may only run a
 * method that is verifiably on this machine — `local`, or `llm-coached` with
 * provider `local`, whose endpoint is loopback. Anything else stops at
 * preflight, before a string is sent. An unreadable mark is a mark.
 */

import fs from 'node:fs';
import path from 'node:path';
import { readSet } from './framework/index.js';
import { coachingDirFor } from './methods/coaching-data.js';
import { isLoopbackEndpoint } from './methods/http-utils.js';

/** Methods that send the coaching prompt and/or the coaching glossary. */
export const SENDS_COACHING = new Set(['llm', 'llm-coached', 'openai', 'anthropic', 'gemini', 'local', 'deepl']);


/** The coaching files this pair would send, that exist. */
export function coachingFilesFor(pairConfig, cwd) {
  const files = [];
  if (typeof pairConfig.coachingFile === 'string' && pairConfig.coachingFile.trim()) {
    files.push(path.resolve(cwd, pairConfig.coachingFile));
  }
  const locale = pairConfig.target || pairConfig.locale;
  // the pair's coaching folder: its plugin's own, else the project's
  if (locale) files.push(path.join(coachingDirFor(pairConfig, cwd), `${locale}.json`));
  return files.filter((f) => fs.existsSync(f));
}

/** Coaching files whose sidecar says local-only (or cannot be read). */
export function markedCoachingFiles(pairConfig, cwd) {
  return coachingFilesFor(pairConfig, cwd).filter((f) => {
    const side = readSet(f);
    return side.errors.length > 0 || side.data?.transmission === 'local-only';
  });
}

/**
 * Why this pair may not run, or null.
 * @param {object} pairConfig
 * @param {{ cwd: string, getMethod: Function }} ctx
 * @returns {string|null}
 */
export function coachingTermsFailure(pairConfig, { cwd, getMethod }) {
  const methodName = pairConfig.method || 'llm';
  if (!SENDS_COACHING.has(methodName)) return null;
  const marked = markedCoachingFiles(pairConfig, cwd);
  if (!marked.length) return null;
  const provider = String(pairConfig.provider || '').trim().toLowerCase() || 'openrouter';
  const isLocalTransport = methodName === 'local' || (methodName === 'llm-coached' && provider === 'local');
  let where = methodName === 'llm-coached' ? `${methodName} via ${provider}` : methodName;
  if (isLocalTransport) {
    // The endpoint the run would use: the pair's own baseUrl, else the
    // environment, else the default (LocalMethod.estimateCost's resolution).
    const local = getMethod('local', pairConfig);
    const base = local._resolveApiBase({
      ...(pairConfig.baseUrl ? { baseUrl: pairConfig.baseUrl } : {}),
      cwd,
    });
    if (base && isLoopbackEndpoint(base)) return null;
    where = `${where} at ${base || 'an unset endpoint'}, which is not on this machine`;
  }
  const names = marked.map((f) => path.relative(cwd, f) || f).join(', ');
  return `the coaching file${marked.length === 1 ? '' : 's'} ${names} ${marked.length === 1 ? 'is' : 'are'} `
    + `marked local-only by the people who hold it, and ${where} sends coaching to the model. `
    + 'Use the local method (a model on this machine) for this pair, or remove the coaching file '
    + 'from it. Only its holders can lift the mark, by hand.';
}
