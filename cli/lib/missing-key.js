/**
 * What to tell someone whose method cannot run for want of a key — ONE helper
 * for every place that says it (the sync preflight, real and dry; a method
 * that returned nothing; the content and Docusaurus lanes; `models`).
 *
 * On a CI runner the fix is a repository secret passed to the step, not
 * `export …` or `.env.local`: the Round 8 fix reached one of these places and
 * a real CI run still printed the laptop advice from the others (Round 9,
 * i18next persona). Off CI, the method's own setup help stands as before.
 */

/**
 * Is this a CI runner? `CI` or `GITHUB_ACTIONS` set to anything but an empty
 * string, "false" or "0" (a developer's shell may export CI=false).
 *
 * @param {object} [env]
 * @returns {boolean}
 */
export function onCIRunner(env = process.env) {
  const on = (v) => typeof v === 'string' && v.trim() !== '' && !/^(false|0)$/i.test(v.trim());
  return on(env.CI) || on(env.GITHUB_ACTIONS);
}

/**
 * The secret names a readiness reason names, in its first parenthesis:
 *   "No OpenRouter API key (OPENROUTER_API_KEY)."                → OPENROUTER_API_KEY
 *   "No Google Translate API key (GOOGLE_TRANSLATE_API_KEY (or GOOGLE_API_KEY))." → the first (canonical) one
 *   "No Lara credentials (LARA_ACCESS_KEY_ID + LARA_ACCESS_KEY_SECRET)."            → both (a key pair)
 *
 * @param {Iterable<string>} reasons
 * @returns {string[]} distinct names, in order
 */
export function secretNamesIn(reasons) {
  const names = [];
  for (const reason of reasons || []) {
    const m = /\(([A-Z][A-Z0-9]*_[A-Z0-9_]+(?:\s*\+\s*[A-Z][A-Z0-9]*_[A-Z0-9_]+)*)/.exec(String(reason));
    if (!m) continue;
    for (const n of m[1].split('+').map(x => x.trim())) if (!names.includes(n)) names.push(n);
  }
  return names;
}

/**
 * "In CI: add a repository secret named X and pass it to the sync step (env: X: ${{ secrets.X }})."
 *
 * @param {string[]} names
 * @param {string} [step] - what the secret is passed to
 * @returns {string|null} null when no name is known
 */
export function ciSecretLine(names, step = 'the sync step') {
  if (!names || names.length === 0) return null;
  const plural = names.length > 1;
  return `In CI: add ${plural ? 'repository secrets' : 'a repository secret'} named ${names.join(' and ')} and pass `
    + `${plural ? 'them' : 'it'} to ${step} (env: ${names.map(n => `${n}: \${{ secrets.${n} }}`).join(', ')}).`;
}

/**
 * The advice lines for a missing key: on a CI runner, the repository-secret
 * line INSTEAD of the shell advice; elsewhere, the method's own setup help
 * (export …, .env.local). A reason that names no secret (a model server that
 * does not answer) keeps the setup help everywhere — its reason already says
 * what to do on a runner (lib/methods/local.js).
 *
 * @param {object} p
 * @param {Iterable<string>} p.reasons - readiness reasons
 * @param {string[]} [p.setupHelp] - the method's getSetupHelp() lines
 * @param {string} [p.indent]
 * @param {object} [p.env]
 * @param {string} [p.step] - what the secret is passed to (default: the sync step)
 * @returns {string[]}
 */
export function missingKeyAdvice({ reasons, setupHelp = [], indent = '  ', env = process.env, step = 'the sync step' }) {
  const line = ciSecretLine(secretNamesIn(reasons), step);
  if (onCIRunner(env) && line) return [`${indent}${line}`];
  return [...setupHelp];
}

/**
 * The setup help for a method that returned nothing: when its key is missing
 * (its readiness check says so), the missing-key advice above; when the key
 * is there, the method's own HTTP-failure help.
 *
 * @param {object} method - a method instance (lib/methods/base.js)
 * @param {{ apiKey?: string|null, cwd?: string }} [context]
 * @returns {Promise<string[]>}
 */
export async function methodSetupAdvice(method, context = {}) {
  const help = method.getSetupHelp();
  let readiness = { ready: true };
  try { readiness = await method.checkReadiness({ apiKey: context.apiKey ?? null, cwd: context.cwd }); } catch { /* the help stands */ }
  if (readiness && readiness.ready === false) return missingKeyAdvice({ reasons: [readiness.reason], setupHelp: help });
  return help;
}
