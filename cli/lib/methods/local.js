/**
 * LocalMethod — OpenAI-compatible local / self-hosted endpoint.
 *
 * Mirrors the harness LocalProvider: defaults to Ollama
 * (http://localhost:11434/v1), and works with vLLM, LM Studio, llama.cpp
 * servers, and OpenAI-compatible gateways (Groq, Together) via
 * LOCAL_API_BASE / OPENAI_API_BASE. Inherits all OpenAI-format request/response
 * logic from OpenAIMethod — only the endpoint default, key handling, and cost
 * differ.
 *
 * FAIL-HONEST COST: estimateCost() returns null — local/self-hosted token cost
 * is genuinely unknown to the tool and must never be fabricated as $0.
 */

import { OpenAIMethod } from './openai.js';
import { isLoopbackEndpoint, localMachineCost } from './http-utils.js';
import { onCIRunner } from '../missing-key.js';

/** How long the readiness probe waits for a local endpoint to answer. */
const PROBE_TIMEOUT_MS = 3000;
// One probe per endpoint per process: a project with ten local pairs asks once.
const probes = new Map();

/** Does anything answer HTTP at `<base>/models`? (Any status counts.) */
function endpointAnswers(base) {
  if (!probes.has(base)) {
    probes.set(base, (async () => {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), PROBE_TIMEOUT_MS);
      try {
        const res = await fetch(`${base}/models`, { signal: ctl.signal });
        // Drain it: the answer is all that matters, not the body.
        try { await res.arrayBuffer(); } catch { /* the status was enough */ }
        return true;
      } catch {
        return false;
      } finally {
        clearTimeout(timer);
      }
    })());
  }
  return probes.get(base);
}

class LocalMethod extends OpenAIMethod {
  constructor(options = {}) {
    super(options);
    this.name = 'local';
  }

  _getProviderLabel() { return 'Local (OpenAI-compatible)'; }
  _getApiKeyEnvVar()  { return 'OPENAI_API_KEY'; }
  _getDefaultModel()  { return 'llama3.1'; }
  // A local server names its models itself ("llama3.1:8b",
  // "Qwen/Qwen2.5-7B-Instruct"): ids are sent as written, never mapped.
  _getModelVendor()   { return null; }

  // Endpoint precedence: options.baseUrl > LOCAL_API_BASE > OPENAI_API_BASE >
  // OPENAI_BASE_URL (the OpenAI SDK's name) > Ollama default. (Matches the harness LocalProvider resolution order.)
  _getApiBaseEnvVar() { return 'LOCAL_API_BASE'; }
  _getApiBaseEnvVars() { return ['LOCAL_API_BASE', 'OPENAI_API_BASE', 'OPENAI_BASE_URL']; }
  _getDefaultApiBase() { return 'http://localhost:11434/v1'; }
  _getDefaultApiBaseLabel() { return 'the default, Ollama'; }

  // Local servers ignore auth — supply a placeholder when no key is set so
  // translate() doesn't skip the run for a "missing" key.
  _resolveApiKey(options) {
    return super._resolveApiKey(options) || 'not-needed';
  }

  /**
   * A local endpoint needs no key — but it must answer. Checked even when
   * nothing is queued (as hosted methods' keys are): a project whose config
   * says "local", synced in CI with the guide's default line, went green on
   * every push that changed no string and failed only on the first that did
   * (Round 8, i18next persona). Any HTTP answer from `<base>/models` counts
   * (a server that does not list models still answers); refused, unknown
   * host or no answer within a few seconds does not. A dry run reports it
   * as a warning (lib/sync.js preflight).
   *
   * Off a CI runner the answer is `unreachable: true` (with the `endpoint`):
   * sync decides after its plan — a run that sends nothing to the model (a
   * redo served from the cache) goes on with a warning, one that sends
   * something stops as before (Round 11, Django persona). On a runner it
   * still stops at once, for the reason above.
   */
  async checkReadiness({ cwd } = {}) {
    let resolved;
    try { resolved = this._resolveApiBaseSource(cwd ? { cwd } : {}); } catch { resolved = { base: null, from: null }; }
    if (!resolved.base) return { ready: true };
    if (await endpointAnswers(resolved.base)) return { ready: true };
    const where = this._describeEndpoint(cwd ? { cwd } : {}) || resolved.base;
    const inCI = onCIRunner();
    return {
      ready: false,
      unreachable: true,
      endpoint: where,
      reason: `the config uses the "local" method, and no model server answers at ${where}. `
        + (inCI
          ? 'A CI runner has no model server: pass --method llm (with OPENROUTER_API_KEY added as a repository secret and passed to the sync step), '
            + 'or start one in the job and set LOCAL_API_BASE to it'
          : 'Start it (e.g. `ollama serve`), set LOCAL_API_BASE to a server that runs, or pass --method llm to use a hosted model'),
    };
  }

  // No model listing. The inherited OpenAI listing called
  // api.openai.com/v1/models — a request off the machine on every "local"
  // run, the one method people choose to stay on it (found 2026-10-03). A
  // local server's own /models is not a reliable allow-list either (many
  // serve whatever model name is asked), so the model is not pre-validated.
  async _fetchModels(_apiKey) {
    return null;
  }

  // A model served on THIS machine (Ollama's default, LM Studio, a forge
  // model on 127.0.0.1) costs $0 in API fees — said as such, with what is not
  // counted. Any other endpoint (Groq, Together, a LAN box) is genuinely
  // unknown to the tool — never $0.
  estimateCost(_keyCount, pairConfig = {}, { cwd = null } = {}) {
    const base = this._resolveApiBase({
      ...(pairConfig?.baseUrl ? { baseUrl: pairConfig.baseUrl } : {}),
      ...(cwd && { cwd }),
    });
    if (isLoopbackEndpoint(base)) return localMachineCost(base);
    return {
      estimatedCost: null,
      currency: 'USD',
      source: 'local-unknown',
      note: 'Local/self-hosted model — token cost unknown (never priced as $0).',
    };
  }

  getProvenance() {
    return {
      resources: [
        { name: 'Local OpenAI-compatible endpoint', license: 'varies', type: 'local' },
      ],
      commercialReady: false,
      flags: ['local-endpoint'],
    };
  }

  getSetupHelp() {
    // Name the endpoint this run used and the setting that chose it: "fetch
    // failed" alone left people guessing which of four settings was in play.
    const endpoint = this._describeEndpoint();
    return [
      '  Local (OpenAI-compatible) endpoint:',
      ...(endpoint ? [`   • This run sent requests to ${endpoint}.`] : []),
      '   • Ollama: install from https://ollama.com, run `ollama serve`,',
      '     then `ollama pull llama3.1` (default http://localhost:11434/v1).',
      '   • Or point at vLLM / LM Studio / Groq via LOCAL_API_BASE (checked first),',
      '     OPENAI_API_BASE or OPENAI_BASE_URL — in the environment or .env.local / .env —',
      '     and set the model with --model (e.g. qwen2.5, mistral).',
    ];
  }
}

export { LocalMethod };
