/**
 * Command: connect
 *
 *   champollion connect <model> [--app <folder>] [--holders-agreed-by "<who>"] [--json]
 *
 * The last mile of the Serve rail: puts a served method — usually a model
 * nmt-forge exported and serves — into an app or website project, so
 * `champollion sync` translates with it. <model> is the method's method.json,
 * its folder, a forge export's model/ folder or the export folder itself.
 *
 * It installs the method (method/1 — or an older manifest) into the app's
 * .champollion/methods/ and points the app's pair at it ("methodPlugin"),
 * keeping everything else the pair already says (a fallback, a register).
 *
 * One guardrail it will not skip: a model that learned from sentences marked
 * local-only can repeat them, and what it writes into an app's locale files
 * is published with the app. Such a model (or one whose training terms were
 * never recorded), or a service whose /health says its output is local-only
 * (output_local_only: nmt-forge serve, mt-eval serve), is connected only when
 * the person says who among the data's holders agreed (--holders-agreed-by),
 * and that is written on the pair as holdersAgreed, naming the method. Never
 * inferred, never defaulted. `sync` holds a local-only answer to the same
 * rule (lib/methods/api.js), so a service that was not running here, or
 * changed since, is still caught.
 */

import fs from 'node:fs';
import path from 'node:path';
import { readMethod } from '../framework/method.js';
import { checkServiceBody } from '../framework/service-api.js';
import { installPluginFromLocal, pluginFromMethod } from '../plugins.js';
import { output } from '../output.js';
import { resolveCode } from '../registers.js';

const APP_CONFIG = 'champollion.config.json';
const HEALTH_TIMEOUT_MS = 3000;

function refuse(msg) {
  output.error(msg);
  return 1;
}

/** The method.json a <model> argument names, or null. */
export function findMethodFile(target) {
  const p = path.resolve(target);
  if (fs.existsSync(p) && fs.statSync(p).isFile()) return p;
  for (const rel of ['method.json', 'champollion-plugin/method.json', 'model/champollion-plugin/method.json']) {
    const f = path.join(p, rel);
    if (fs.existsSync(f)) return f;
  }
  return null;
}

/**
 * What the model learned from, when it is a model trained here: the
 * forge-model.json beside it (model_dir, relative to the method.json).
 * Returns {localOnly, why} — unrecorded counts as local-only, as forge's
 * own rule (nmt_forge.privacy.output_local_only).
 */
export function trainedOnTerms(read) {
  const m = read.data || {};
  if (m.kind !== 'nmt-checkpoint') return { localOnly: false, why: null };
  const dir = path.resolve(read.dir, m.model_dir || '.');
  let fm;
  try {
    fm = JSON.parse(fs.readFileSync(path.join(dir, 'forge-model.json'), 'utf-8'));
  } catch {
    return { localOnly: true, why: 'what it learned from is not recorded (no forge-model.json beside it)' };
  }
  const t = fm.trained_on;
  if (!t || typeof t !== 'object' || !t.terms || typeof t.terms !== 'object') {
    return { localOnly: true, why: 'what it learned from is not recorded' };
  }
  if (t.terms.transmission === 'local-only') {
    return { localOnly: true, why: 'it learned from sentences marked local-only' };
  }
  return { localOnly: false, why: null };
}

/** The service's /health answer ({} when it answers with no JSON), or null when nothing answers. */
async function readHealth(endpoint) {
  try {
    const url = new URL(endpoint);
    url.pathname = url.pathname.replace(/\/translate\/?$/, '') + '/health';
    const r = await fetch(url, { signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS) });
    if (!r.ok) return null;
    const body = await r.json().catch(() => ({}));
    return body && typeof body === 'object' ? body : {};
  } catch {
    return null;
  }
}

async function run(args, cwd) {
  const target = args._[1];
  if (!target || args._.length > 2) {
    return refuse('Usage: champollion connect <model folder or method.json> [--app <folder>] '
      + '[--holders-agreed-by "<who>"]');
  }
  const file = findMethodFile(path.resolve(cwd, target));
  if (!file) {
    return refuse(`${target}: no method.json there (looked in it, champollion-plugin/ and model/champollion-plugin/) `
      + '— point at a forge export\'s model/ folder or at the method.json');
  }
  const read = readMethod(file);
  const got = pluginFromMethod(read);
  if (got.error) return refuse(`${path.relative(cwd, file) || file}: ${got.error}`);
  const plugin = got.plugin;

  const app = path.resolve(cwd, args.app || '.');
  const cfgPath = path.join(app, APP_CONFIG);
  if (!fs.existsSync(cfgPath)) {
    return refuse(`${app} has no ${APP_CONFIG} — it is not an app project yet. Set one up there first: `
      + 'champollion init');
  }
  let config;
  try {
    config = JSON.parse(fs.readFileSync(cfgPath, 'utf-8'));
  } catch (e) {
    return refuse(`${APP_CONFIG} is not valid JSON (${e.message}) — fix it first`);
  }
  const input = config.inputLocale || 'en';
  const sources = [...new Set((read.data.pairs || []).map((p) => p.source).filter(Boolean))];
  // card codes and app locales name one language two ways (eng / en-US):
  // compared through the cards' one resolver
  const canon = (c) => resolveCode(String(c || '').replace('_', '-')) || String(c || '').toLowerCase();
  if (sources.length && !sources.some((s) => canon(s) === canon(input))) {
    return refuse(`the method translates from ${sources.join(', ')}, and this app's source language `
      + `(inputLocale) is ${input}`);
  }

  // the guardrail: a local-only model's output is published with the app —
  // known from what it was trained on, or from what its service says
  const endpoint = plugin.endpoint || null;
  const health = endpoint ? await readHealth(endpoint) : null;
  let terms = trainedOnTerms(read);
  // a model trained here carries its own record (forge-model.json), which
  // decides; a service that is not one has only its /health to say it
  const recorded = read.data?.kind === 'nmt-checkpoint';
  if (!terms.localOnly && endpoint && recorded && health?.output_local_only === true) {
    terms = { localOnly: true, why: `its service says what it writes is local-only (${
      health.output_local_only_why || 'it gives no reason'})` };
  } else if (!terms.localOnly && endpoint && !recorded) {
    // service-api/1: only an explicit false means nothing it learned from is
    // marked local-only; null is "not known", and no answer says nothing — both
    // are treated as local-only, never guessed (the MCP try tool's rule too;
    // Gemini 4 Argon, release-candidate code review 2026-10-18)
    if (health?.output_local_only === true) {
      terms = { localOnly: true, why: `its service says what it writes is local-only (${
        health.output_local_only_why || 'it gives no reason'})` };
    } else if (!health) {
      terms = { localOnly: true, why: `its service at ${endpoint} did not answer, so nothing says whether what it `
        + 'writes is local-only — start it and connect again, or' };
    } else if (health.output_local_only !== false) {
      terms = { localOnly: true, why: 'its service does not know whether what it writes is local-only '
        + (health.output_local_only === null ? '(its /health says output_local_only: null)'
          : '(its /health does not say: no output_local_only)') };
    }
  }
  const agreedBy = typeof args['holders-agreed-by'] === 'string' ? args['holders-agreed-by'].trim() : '';
  if (terms.localOnly && !agreedBy) {
    return refuse(`${plugin.name}: ${terms.why}. A small model repeats what it learned, so what it writes `
      + `into this app's locale files can carry those sentences — and those files are published with the `
      + 'app. Only the data\'s holders can decide that is all right. Ask them; if they agree, run again with '
      + '--holders-agreed-by "<who agreed>" (it is written beside the pair).');
  }

  const installed = installPluginFromLocal(path.dirname(file), app);
  if (!installed.success) return refuse(installed.error);
  config.pairs = config.pairs && typeof config.pairs === 'object' ? config.pairs : {};
  const keys = plugin.locales.map((t) => `${input}:${t}`);
  for (const key of keys) {
    const prior = config.pairs[key] && typeof config.pairs[key] === 'object' ? config.pairs[key] : {};
    // the plugin decides how it runs: a method/endpoint left on the pair
    // would name another translator for the same pair
    const { method: _m, endpoint: _e, ...keep } = prior;
    config.pairs[key] = { ...keep, methodPlugin: installed.name,
      ...(terms.localOnly ? { holdersAgreed: { by: agreedBy, date: new Date().toISOString().slice(0, 10),
        method: installed.name,
        what: `translations from ${installed.name} (${terms.why}) may be written into this app's locale files` } }
        : {}) };
  }
  fs.writeFileSync(cfgPath, JSON.stringify(config, null, 2) + '\n', 'utf-8');
  const live = endpoint ? health !== null : null;
  // what it says about its output is read from /health: a document that does
  // not follow the contract is said to, never quietly read as "may leave"
  const healthProblems = health ? checkServiceBody(health, 'health') : [];

  if (args.json) {
    output.raw(JSON.stringify({ method: installed.name, kind: read.data.kind, pairs: keys, endpoint,
      answering: live, health_problems: healthProblems, holders_agreed_by: terms.localOnly ? agreedBy : null },
    null, 2));
    return 0;
  }
  output.raw(`\n  connected ${installed.name} (${read.data.kind}) to ${path.relative(cwd, app) || '.'}: `
    + `${keys.join(', ')} now translate with it`);
  output.raw(`  installed into .champollion/methods/${installed.name}/ · ${APP_CONFIG} pairs point at it`);
  if (terms.localOnly) output.raw(`  recorded beside each pair: the data's holders agreed (${agreedBy})`);
  if (endpoint && !live) {
    const dir = read.data.model_dir ? path.resolve(read.dir, read.data.model_dir) : null;
    output.raw(`  ⚠ nothing answers at ${endpoint} — sync needs it running`
      + (dir ? `: nmt-forge serve ${dir} --detach` : '')
      + (terms.localOnly ? '' : '. If it says its output is local-only, sync writes nothing from it until '
        + 'the data\'s holders agree.'));
  } else if (healthProblems.length) {
    output.raw(`  ⚠ its /health does not follow service-api/1 (${healthProblems.slice(0, 2).join('; ')}) — `
      + 'whether what it writes may leave this machine is not known from it; sync still holds back any '
      + 'answer that says it is local-only');
  } else if (health && health.output_local_only === null) {
    output.raw(`  whether what it writes may leave this machine: ${health.output_local_only_why || 'not known'}`);
  }
  output.raw('  sync checks every value before it writes it; a fluent speaker decides what is fit to publish.');
  output.raw('  Next: champollion sync --dry-run, then champollion sync\n');
  return 0;
}

export { run };
