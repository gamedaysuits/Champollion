/**
 * External Method — bridge to Python TranslationMethod modules.
 *
 * This is the core Champollion deployment pipeline for custom methods:
 *
 *   1. python3 -m pip install crk-translate (or quechua-translate, or any module)
 *   2. champollion init → wizard detects the module, offers it
 *   3. champollion sync → bridge spawns, translates, done
 *
 * The same module works in the Arena for evaluation:
 *   mt-eval run --method ./my-method/method_plugin
 *
 * HOW IT WORKS:
 *   The CLI spawns a Python subprocess running method_bridge.py (bundled
 *   in this npm package at lib/bridge/method_bridge.py). The bridge loads
 *   the method plugin, converts between CLI key-value format and Arena
 *   entry format, and communicates via JSON-lines on stdin/stdout.
 *
 * WHY SUBPROCESS (not HTTP, not FFI):
 *   - Zero config: no ports, no servers, no firewall issues in CI
 *   - Clean isolation: if the Python side crashes, it crashes with a
 *     traceback the user can read
 *   - Same pattern used by LSP, tree-sitter, and other tool bridges
 *
 * CONFIG:
 *   {
 *     "method": "external",
 *     "methodPath": "./my-method/method_plugin",
 *     "model": "anthropic/claude-sonnet-4.6"  // passed through to module
 *   }
 *
 * MODEL PASSTHROUGH:
 *   The CLI config's "model" field flows through the bridge to the
 *   method plugin. CrkPipelineMethod reads config.model_id to decide
 *   which LLM to use for its translation steps. Users pick their model
 *   in champollion.config.json — the method module honors it.
 */

import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TranslationMethod } from './base.js';
import { output } from '../output.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Path to the bundled bridge script. Ships with the CLI npm package
 * in lib/bridge/method_bridge.py. No Arena dependency needed.
 */
const BRIDGE_SCRIPT = resolve(__dirname, '..', 'bridge', 'method_bridge.py');

/** Interpreter names tried in order (python3 on macOS/Linux, python on Windows). */
const PYTHON_CANDIDATES = ['python3', 'python'];

/**
 * Spawn the first Python interpreter that exists.
 *
 * spawn() reports a missing executable ASYNCHRONOUSLY, as an 'error' event
 * with code ENOENT — a try/catch around spawn() never sees it. So wait for
 * 'spawn' (it started) or 'error' (it didn't), and move to the next name only
 * on ENOENT. Rejects with an actionable message when none exists.
 *
 * @param {string[]} args
 * @param {import('node:child_process').SpawnOptions} options
 * @returns {Promise<import('node:child_process').ChildProcess>}
 */
function spawnPython(args, options) {
  return new Promise((resolvePromise, reject) => {
    const attempt = (i) => {
      const proc = spawn(PYTHON_CANDIDATES[i], args, options);
      const onSpawn = () => {
        proc.removeListener('error', onError);
        resolvePromise(proc);
      };
      const onError = (err) => {
        proc.removeListener('spawn', onSpawn);
        if (err.code !== 'ENOENT') return reject(err);
        if (i + 1 < PYTHON_CANDIDATES.length) return attempt(i + 1);
        reject(new Error(
          `Python is required for external method modules but was not found ` +
          `(tried ${PYTHON_CANDIDATES.join(', ')} on PATH).\n` +
          '  Install Python 3.10+ from https://python.org'
        ));
      };
      proc.once('spawn', onSpawn);
      proc.once('error', onError);
    };
    attempt(0);
  });
}

/**
 * Bridges alive in this process. Killed on exit as a backstop, so no Python
 * child outlives the CLI even on a path that never called shutdown().
 */
const liveBridges = new Set();
process.once('exit', () => {
  for (const proc of liveBridges) proc.kill();
});

class ExternalMethod extends TranslationMethod {
  constructor(options = {}) {
    super('external', options);
    this._methodPath = options.methodPath || null;
    this._process = null;
    this._rl = null;
    this._methodName = null;
    // In-flight bridge start, shared by concurrent callers so they don't each
    // spawn a process.
    this._starting = null;
    // The bridge answers one JSON line per request, in order. Requests are
    // chained so concurrent callers (pairs translating in parallel on one
    // shared instance) can never read each other's response line.
    this._queue = Promise.resolve();
  }

  /**
   * Start the bridge subprocess and wait for the ready signal.
   *
   * The bridge sends a JSON ready signal on stdout immediately after
   * loading the method plugin. If loading fails, it sends an error
   * object and exits.
   */
  async _ensureBridge(cwd) {
    if (this._process) return;
    if (!this._starting) {
      this._starting = this._startBridge(cwd).finally(() => { this._starting = null; });
    }
    await this._starting;
  }

  async _startBridge(cwd) {
    const methodPath = this._methodPath
      ? resolve(cwd || '.', this._methodPath)
      : null;

    const args = [BRIDGE_SCRIPT];
    if (methodPath) args.push('--method', methodPath);

    const proc = await spawnPython(args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: cwd || process.cwd(),
    });
    this._process = proc;
    liveBridges.add(proc);

    // A later process error (e.g. EPIPE) must not become an uncaught
    // exception; pending reads reject via _readResponse's listeners.
    proc.on('error', (err) => output.warn(`  [method] bridge error: ${err.message}`));
    // A dead bridge is forgotten so the next request starts a fresh one
    // instead of writing into a closed pipe.
    proc.once('exit', () => {
      liveBridges.delete(proc);
      if (this._process === proc) {
        this._process = null;
        this._rl = null;
      }
    });

    // Python logging → CLI info channel (stderr is for logs, not errors)
    const stderrRl = createInterface({ input: proc.stderr });
    stderrRl.on('line', (line) => output.info(`  [method] ${line}`));

    // stdout → JSON-lines protocol
    this._rl = createInterface({ input: proc.stdout });

    // Wait for the ready signal (first line of output)
    let ready;
    try {
      ready = await this._readResponse();
    } catch (err) {
      proc.kill();
      throw err;
    }
    if (!ready.ok) {
      proc.kill();
      throw new Error(ready.error);
    }
    this._methodName = ready.name || 'External Method';
    output.info(`  ✓ Method bridge: ${this._methodName}`);
  }

  /**
   * Send a JSON request line and read the response line.
   */
  async _request(obj) {
    const send = () => new Promise((resolve, reject) => {
      if (!this._process) {
        reject(new Error('Method bridge is not running.'));
        return;
      }
      // Arm the reader before writing so the response line can't slip past.
      const response = this._readResponse();
      response.then(resolve, reject);
      const line = JSON.stringify(obj) + '\n';
      this._process.stdin.write(line, 'utf-8', (err) => {
        if (err) reject(err);
      });
    });
    const result = this._queue.then(send, send);
    this._queue = result.catch(() => {});
    return result;
  }

  /**
   * Read one JSON-lines response from the bridge subprocess.
   */
  _readResponse() {
    const rl = this._rl;
    const proc = this._process;
    return new Promise((resolve, reject) => {
      const cleanup = () => {
        rl.removeListener('line', onLine);
        proc.removeListener('exit', onExit);
        proc.removeListener('error', onError);
      };
      const onLine = (line) => {
        cleanup();
        try {
          resolve(JSON.parse(line));
        } catch (e) {
          reject(new Error(`Invalid response from method bridge: ${line}`));
        }
      };

      const onExit = (code) => {
        cleanup();
        reject(new Error(
          `Method bridge exited unexpectedly (code ${code}).\n` +
          '  Check that the method module is installed correctly.\n' +
          '  Verify the method module is installed (e.g., python3 -m pip install <package-name>).'
        ));
      };

      const onError = (err) => {
        cleanup();
        reject(err);
      };

      rl.on('line', onLine);
      proc.once('exit', onExit);
      proc.once('error', onError);
    });
  }

  /**
   * Discover installed method modules.
   *
   * Spawns the bridge in --discover mode, which scans for pip-installed
   * packages that register champollion.methods entry points.
   *
   * Used by the init wizard and `champollion methods` command.
   *
   * @param {string} [cwd] - Working directory
   * @returns {Promise<Array<{name, method_id, supported_pairs, entry_point, plugin_path}>>}
   */
  static async discoverMethods(cwd) {
    let proc;
    try {
      proc = await spawnPython([BRIDGE_SCRIPT, '--discover'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: cwd || process.cwd(),
      });
    } catch {
      // Python not available — no method modules discoverable
      return [];
    }

    return new Promise((resolve) => {
      let data = '';
      proc.stdout.on('data', (chunk) => { data += chunk; });

      proc.on('close', () => {
        try {
          const result = JSON.parse(data.trim());
          resolve(result.ok ? result.methods : []);
        } catch {
          resolve([]);
        }
      });

      proc.on('error', () => resolve([]));
    });
  }

  /**
   * Preflight check — can we spawn the bridge and load the method?
   *
   * Called by resolveRuntime() BEFORE entering the translation loop.
   * Human-readable error messages tell the user exactly what to do.
   */
  async checkReadiness(context) {
    if (!this._methodPath) {
      return {
        ready: false,
        reason:
          'No method module configured.\n' +
          '  Set "methodPath" in your champollion.config.json,\n' +
          '  or run "champollion init" to set up a method module.',
      };
    }

    try {
      await this._ensureBridge(context.cwd);
      return { ready: true };
    } catch (err) {
      return { ready: false, reason: err.message };
    }
  }

  /**
   * Translate key-value pairs via the bridge.
   *
   * The bridge converts CLI format to Arena format, calls the method's
   * translate(), and converts results back. Model passthrough:
   * pairConfig.model flows through to the method plugin.
   */
  async translate(keys, sourceFlat, pairConfig, options) {
    await this._ensureBridge(options.cwd || pairConfig.cwd);

    // Build key → source value map
    const keysPayload = {};
    for (const key of keys) {
      const value = sourceFlat[key];
      if (value && typeof value === 'string') {
        keysPayload[key] = value;
      }
    }

    if (Object.keys(keysPayload).length === 0) return {};

    const response = await this._request({
      action: 'translate',
      keys: keysPayload,
      source_locale: pairConfig.source || 'en',
      target_locale: pairConfig.target,
      config: {
        model: pairConfig.model || options.model,
        temperature: pairConfig.temperature,
      },
    });

    if (!response.ok) {
      output.error(`  Method error: ${response.error}`);
      return null;
    }

    // Surface per-key errors as warnings (partial success is valid)
    if (response.meta?.errors?.length > 0) {
      for (const err of response.meta.errors) {
        output.warn(`  [method] ${err.key}: ${err.error}`);
      }
    }

    return response.translations || null;
  }

  /**
   * Content translation — not supported by external methods yet.
   *
   * External methods handle key-value i18n translation (the core use case).
   * Freeform Markdown content translation would need a separate protocol
   * action and is deferred to a future version.
   */
  async translateContent(_prompt, _pairConfig, _options) {
    return null;
  }

  /**
   * Cost estimation — determined by the method module, not the CLI.
   */
  estimateCost(keyCount) {
    return {
      estimatedCost: null,
      currency: 'USD',
      source: 'method-determined',
      note: 'Cost is determined by the method module.',
    };
  }

  getSetupHelp() {
    return [
      '  External method module.',
      '  1. Install a method module (e.g., python3 -m pip install <module-name>)',
      '  2. Run: champollion init',
      '  3. The wizard will detect and configure it automatically.',
    ];
  }

  /**
   * Clean up: send shutdown command and kill the subprocess.
   */
  async shutdown() {
    if (this._starting) {
      try { await this._starting; } catch { /* never started — nothing to stop */ }
    }
    const proc = this._process;
    if (!proc) return;
    try {
      await this._request({ action: 'shutdown' });
    } catch {
      // Process may already be dead — that's fine
    }
    proc.kill();
    liveBridges.delete(proc);
    if (this._process === proc) {
      this._process = null;
      this._rl = null;
    }
  }
}

export { ExternalMethod };
