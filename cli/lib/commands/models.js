/**
 * Command: models
 *
 * Lists available models for a translation provider by querying
 * the provider's real API. Read-only — shows what models the user's
 * API key has access to, without modifying any config.
 *
 * WHY THIS EXISTS:
 *   When providers release new models, users need to discover the exact
 *   slug to put in their config. This command bridges that gap —
 *   instead of guessing or checking provider docs, run
 *   `champollion models --method gemini` and see the real list.
 *
 * USAGE:
 *   champollion models --method gemini      # List Gemini models
 *   champollion models --method openai      # List OpenAI models
 *   champollion models --method anthropic   # List Anthropic models
 */

import { resolveConfig } from '../config.js';
import { fetchAvailableModels, resolveProviderApiKey, getProviderLabel, getProviderEnvVar, isListableProvider, getListableProviders } from '../models.js';
import { missingKeyAdvice } from '../missing-key.js';
import { output } from '../output.js';
import { checkModelDefaults } from '../model-defaults.js';
import { fetchModelPricing } from '../methods/openrouter-pricing.js';

/**
 * @param {import('../types.js').CLIArgs} args - Parsed CLI arguments
 * @param {string} cwd - Working directory
 * @returns {Promise<number>} Exit code (0 = success, 1 = error)
 */
async function run(args, cwd) {
  // --json: stdout carries exactly one JSON document. Quiet mode keeps the
  // human listing off stdout; warnings still reach stderr.
  const json = !!args.json;
  if (json) output.setMode('quiet');

  if (args.help) {
    showHelp();
    return 0;
  }

  if (args._[1] === 'check') return runCheck(args, cwd, json);

  const method = args.method;
  if (!method) {
    if (json) {
      console.log(JSON.stringify({
        command: 'models',
        providers: getListableProviders().map(p => ({ method: p, label: getProviderLabel(p) })),
        note: 'Pass --method <provider> to list its models.',
      }, null, 2));
      return 0;
    }
    output.raw('\n  Usage: champollion models --method <provider>\n');
    output.raw('  Available providers with model listing:');
    for (const provider of getListableProviders()) {
      output.raw(`    - ${provider} (${getProviderLabel(provider)})`);
    }
    output.raw('');
    output.raw('  Example: champollion models --method gemini\n');
    return 0;
  }

  if (!isListableProvider(method)) {
    if (json) {
      console.log(JSON.stringify({
        command: 'models',
        method,
        error: `Provider "${method}" does not support model listing.`,
        providers: getListableProviders().map(p => ({ method: p, label: getProviderLabel(p) })),
      }, null, 2));
      return 1;
    }
    output.warn(`Provider "${method}" does not support model listing.`);
    output.raw('');
    output.raw('  Providers with model listing support:');
    for (const provider of getListableProviders()) {
      output.raw(`    - ${provider} (${getProviderLabel(provider)})`);
    }
    output.raw('');
    return 1;
  }

  // Resolve API key from environment or .env files
  const apiKey = resolveProviderApiKey(method, cwd);
  if (!apiKey) {
    const label = getProviderLabel(method);
    if (json) {
      console.log(JSON.stringify({
        command: 'models',
        method,
        error: `No API key found for ${label}.`,
      }, null, 2));
      return 1;
    }
    output.warn(`No API key found for ${label}.`);
    output.raw('');
    // On a CI runner: the repository secret, not the shell advice (lib/missing-key.js).
    const envVar = getProviderEnvVar(method);
    for (const line of missingKeyAdvice({
      reasons: [envVar ? `No API key (${envVar})` : ''],
      setupHelp: [`  Set ${envVar || 'the environment variable'} in the environment or add it to .env.local.`],
      step: 'the step that runs it',
    })) output.raw(line);
    output.raw(`  Then re-run: champollion models --method ${method}`);
    output.raw('');
    return 1;
  }

  // Fetch available models from the provider's real API
  output.raw(`\n  Fetching models from ${getProviderLabel(method)}...\n`);
  const models = await fetchAvailableModels(method, apiKey);

  if (!models || models.length === 0) {
    if (json) {
      console.log(JSON.stringify({
        command: 'models',
        method,
        error: 'Could not fetch model list. Check your API key and network connection.',
      }, null, 2));
      return 1;
    }
    output.warn('Could not fetch model list. Check your API key and network connection.');
    return 1;
  }

  // Current config model, if a config exists (informational in both modes)
  let currentModel = null;
  try {
    const config = resolveConfig(args, cwd);
    if (config.model) currentModel = config.model;
  } catch {
    // No config file — that's fine, just don't show current model
  }

  if (json) {
    console.log(JSON.stringify({
      command: 'models',
      method,
      provider: getProviderLabel(method),
      models,
      count: models.length,
      currentConfigModel: currentModel,
    }, null, 2));
    return 0;
  }

  // Display models as a numbered list
  output.raw(`  Available models (${models.length}):\n`);
  for (let i = 0; i < models.length; i++) {
    output.raw(`    ${String(i + 1).padStart(3)}.  ${models[i]}`);
  }

  if (currentModel) {
    output.raw('');
    output.raw(`  Current config model: ${currentModel}`);
  }

  output.raw('');
  output.raw('  To use a model, set "model" in your champollion.config.json');
  output.raw('  or pass --model <id> to sync.\n');

  return 0;
}

function showHelp() {
  console.log(`
  champollion models — List available models for a provider

  USAGE
    champollion models --method <provider>

  DESCRIPTION
    Queries the provider's real API to show which models your API key
    has access to. Read-only — does not modify any config files.

  OPTIONS
    --method <provider>   Provider to query: gemini, openai, anthropic

  EXAMPLES
    champollion models --method gemini      # List Gemini models
    champollion models --method openai      # List OpenAI models
    champollion models --method anthropic   # List Anthropic models
  `);
}

export { run };

/**
 * `champollion models check` — every default model (shared/model-defaults.json)
 * against the providers' live lists. Read-only and free: list endpoints are
 * not billed. Exit 1 when a pinned default is no longer listed (a run would
 * fail on it); a newer model matching a role's rule is reported, not a
 * failure — moving a default is a reviewed change, never automatic.
 *
 * @param {object} args
 * @param {string} cwd
 * @param {boolean} json
 * @returns {Promise<number>}
 */
async function runCheck(args, cwd, json) {
  const lists = { openrouter: null, openai: null, gemini: null, anthropic: null };
  try {
    const pricing = await fetchModelPricing();
    if (pricing && pricing.size > 0) lists.openrouter = [...pricing.keys()];
  } catch { /* unchecked */ }
  for (const provider of ['openai', 'gemini', 'anthropic']) {
    const key = resolveProviderApiKey(provider, cwd);
    if (key) lists[provider] = await fetchAvailableModels(provider, key);
  }
  const rows = checkModelDefaults(lists);
  const gone = rows.filter(r => r.status === 'gone');
  if (json) {
    console.log(JSON.stringify({ command: 'models check', ok: gone.length === 0, roles: rows }, null, 2));
    return gone.length > 0 ? 1 : 0;
  }
  output.raw('\n  Default models (shared/model-defaults.json) against the providers\' live lists:\n');
  for (const r of rows) {
    const mark = { ok: '[OK]  ', newer: '[NEW] ', gone: '[GONE]', unchecked: '[--]  ' }[r.status];
    output.raw(`  ${mark} ${r.role.padEnd(10)} ${r.model.padEnd(34)} ${r.note}`);
  }
  const unchecked = rows.filter(r => r.status === 'unchecked').map(r => r.provider);
  if (unchecked.length > 0) {
    output.raw(`\n  Not checked (no key for ${[...new Set(unchecked)].map(p => getProviderEnvVar(p) || p).join(', ')}): set it to check that provider's list.`);
  }
  output.raw('');
  if (gone.length > 0) {
    output.error(`${gone.length} default model(s) are no longer listed by their provider — a run on them would fail. `
      + 'Update shared/model-defaults.json (in the repo: node cli/scripts/check-model-defaults.mjs --update) and release.');
    return 1;
  }
  return 0;
}
