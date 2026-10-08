/**
 * Preloaded into a CLI child (NODE_OPTIONS=--import=<this file>) so a test
 * can stand in for OpenRouter without the network:
 *
 *   - STUB_OPENROUTER_MODELS: a GET of https://openrouter.ai/api/v1/models
 *     (the price list) is answered from this JSON array
 *     ([{ id, pricing: { prompt, completion } }, …]), or with HTTP 503 when
 *     it is "503".
 *   - STUB_OPENROUTER_BASE: every other https://openrouter.ai/… request goes
 *     to this local server instead (same path, method, headers and body) —
 *     e.g. the key check `doctor` makes (GET /api/v1/key).
 *
 * With either set, a request to openrouter.ai never leaves the machine: one
 * neither covers fails loudly instead of reaching the real service. Every
 * other host goes to the real fetch.
 */
const ORIGIN = 'https://openrouter.ai';
const MODELS_URL = `${ORIGIN}/api/v1/models`;
const realFetch = globalThis.fetch;

globalThis.fetch = async function stubbedFetch(input, init) {
  const url = typeof input === 'string' ? input : (input?.url ?? String(input));
  const models = process.env.STUB_OPENROUTER_MODELS;
  const base = process.env.STUB_OPENROUTER_BASE;
  if (url === MODELS_URL && models !== undefined) {
    if (models === '503') return new Response('unavailable', { status: 503 });
    return new Response(JSON.stringify({ data: JSON.parse(models) }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  }
  if (url.startsWith(`${ORIGIN}/`) && (base !== undefined || models !== undefined)) {
    if (!base) throw new Error(`stub-openrouter-models: ${url} is not stubbed (set STUB_OPENROUTER_BASE)`);
    return realFetch(base.replace(/\/$/, '') + url.slice(ORIGIN.length), init);
  }
  return realFetch(input, init);
};
