/**
 * Command: serve
 *
 * Stands the owner's OWN configured translation stack up as an HTTP
 * service speaking the api-method contract (see lib/serve.js), so any
 * consumer project can point `method: "api"` at it. The hosted
 * Champollion Translate API was shelved (founder, 2026-07-19) — this
 * self-hosted path replaces it: "serve through Champollion" is one
 * command on each side.
 *
 * Two modes:
 *   champollion serve                  — run the server (blocks until SIGINT/SIGTERM)
 *   champollion serve --emit-manifest  — write the method.json a consumer installs
 */

import fs from 'node:fs';
import path from 'node:path';

import {
  SERVE_DEFAULTS,
  createServeRuntime,
  deriveMethodName,
  resolveManifestEndpoint,
  buildServeManifest,
  startServeServer,
} from '../serve.js';
import { parseMaxCost } from '../cost-report.js';
import { getEnvOrFileVar } from '../api-key.js';
import { output } from '../output.js';

/**
 * Parse a required-integer flag with bounds. Malformed values fail loud —
 * a silently-ignored bad value would defeat the safety knob it configures.
 */
function parseIntFlag(raw, flagName, { min, max, fallback }) {
  if (raw === undefined || raw === null || raw === false || raw === '') return fallback;
  const val = Number.parseInt(String(raw), 10);
  if (!Number.isInteger(val) || val < min || val > max) {
    throw new Error(`${flagName} must be an integer between ${min} and ${max} (got "${raw}").`);
  }
  return val;
}

/**
 * Resolve where --emit-manifest writes. A path ending in .json is the file
 * itself; anything else is a directory that gets method.json inside it
 * (the shape `champollion plugin install <dir>` expects).
 */
function resolveManifestOutPath(rawOut, methodName, cwd) {
  if (rawOut) {
    const resolved = path.resolve(cwd, String(rawOut));
    return resolved.endsWith('.json') ? resolved : path.join(resolved, 'method.json');
  }
  return path.join(cwd, methodName, 'method.json');
}

/**
 * @param {import('../types.js').CLIArgs} args - Parsed CLI arguments
 * @param {string} cwd - Working directory (the owner project)
 * @returns {Promise<number>} Exit code
 */
async function run(args, cwd) {
  if (args.quiet) output.setMode('quiet');

  const port = parseIntFlag(args.port, '--port', { min: 0, max: 65535, fallback: SERVE_DEFAULTS.port });
  const methodName = args.name ? String(args.name) : deriveMethodName(cwd);

  // ── Manifest emission — no server, no API calls, no preflight ─────────
  if (args['emit-manifest']) {
    const runtime = await createServeRuntime({ cwd, cliArgs: args, preflight: false });
    const endpointUrl = resolveManifestEndpoint(args.endpoint || null, port);
    const manifest = buildServeManifest(runtime, { name: methodName, endpointUrl });

    const outPath = resolveManifestOutPath(args.out, methodName, cwd);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, JSON.stringify(manifest, null, 2) + '\n', 'utf-8');

    output.ok(`Wrote ${outPath}`);
    output.info(`Served method: ${methodName} (type api, quality tier "${manifest.config.qualityTier}")`);
    output.info(`Endpoint: ${endpointUrl}`);
    if (!args.endpoint) {
      output.warn('Endpoint defaults to loopback — pass --endpoint <public-url> when consumers are not on this machine.');
    }
    output.raw('');
    output.raw('  Consumer setup:');
    output.raw(`    champollion plugin install ${path.dirname(outPath)}`);
    output.raw(`    # champollion.config.json: { "pairs": { "<src>:<tgt>": { "methodPlugin": "${methodName}" } } }`);
    output.raw('    CHAMPOLLION_API_KEY=<this server\'s bearer token> champollion sync');
    output.summary({ command: 'serve', emitted: outPath, name: methodName, endpoint: endpointUrl });
    return 0;
  }

  // ── Server mode ───────────────────────────────────────────────────────
  const bind = args.bind ? String(args.bind) : SERVE_DEFAULTS.bind;
  const token = args.token ? String(args.token) : getEnvOrFileVar('CHAMPOLLION_SERVE_TOKEN', cwd);
  const noAuth = !!args['no-auth'];
  const rateLimitPerMin = parseIntFlag(args['rate-limit'], '--rate-limit', { min: 0, max: 1_000_000, fallback: SERVE_DEFAULTS.rateLimitPerMin });
  const maxBodyBytes = parseIntFlag(args['max-body-bytes'], '--max-body-bytes', { min: 1024, max: 1_000_000_000, fallback: SERVE_DEFAULTS.maxBodyBytes });
  // parseMaxCost is the same validator `sync --max-cost` uses (loud on junk).
  const maxCostPerRequest = parseMaxCost(args['max-cost-per-request']);
  const maxSessionCost = parseMaxCost(args['max-session-cost']);

  const handle = await startServeServer({
    cwd,
    cliArgs: args,
    bind,
    port,
    token,
    noAuth,
    rateLimitPerMin,
    maxBodyBytes,
    maxCostPerRequest,
    maxSessionCost,
    methodName,
  });

  const pairList = [...handle.runtime.resolvedPairs.keys()].sort().join(', ');
  output.ok(`champollion serve listening on http://${bind}:${handle.port}/translate`);
  output.info(`Serving method "${handle.methodName}" — pairs: ${pairList}`);
  output.info(noAuth
    ? 'Auth: DISABLED (--no-auth, loopback only)'
    : 'Auth: bearer token required (Authorization: Bearer <token>)');
  output.info(`Limits: ${rateLimitPerMin === 0 ? 'no rate limit' : `${rateLimitPerMin} req/min/IP`}, body ≤ ${maxBodyBytes} bytes`
    + (maxCostPerRequest !== null ? `, ≤ $${maxCostPerRequest}/request` : '')
    + (maxSessionCost !== null ? `, session ceiling $${maxSessionCost}` : ''));
  if (bind === SERVE_DEFAULTS.bind) {
    output.info('Bound to 127.0.0.1 (this machine only). Use --bind 0.0.0.0 to expose it — with a strong token.');
  }
  output.info(`Consumer manifest: champollion serve --emit-manifest${args.endpoint ? '' : ' --endpoint <public-url>'}`);
  output.info('Press Ctrl+C to stop.');

  // Block until a shutdown signal; the dispatcher exits with our return code.
  return new Promise((resolve) => {
    let closing = false;
    const shutdown = async (signal) => {
      if (closing) return;
      closing = true;
      output.info(`\n[serve] ${signal} received — shutting down (served ${handle.session.requests} request(s)).`);
      await handle.close();
      resolve(0);
    };
    process.once('SIGINT', () => shutdown('SIGINT'));
    process.once('SIGTERM', () => shutdown('SIGTERM'));
  });
}

export { run };
