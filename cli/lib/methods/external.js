/**
 * External Method — bridge to Python TranslationMethod modules.
 *
 * This is the core Champollion deployment pipeline for custom methods:
 *
 *   1. pip install crk-translate (or quechua-translate, or any module)
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

class ExternalMethod extends TranslationMethod {
  constructor(options = {}) {
    super('external', options);
    this._methodPath = options.methodPath || null;
    this._process = null;
    this._rl = null;
    this._methodName = null;
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

    const methodPath = this._methodPath
      ? resolve(cwd || '.', this._methodPath)
      : null;

    const args = [BRIDGE_SCRIPT];
    if (methodPath) args.push('--method', methodPath);

    // Try python3 first (macOS/Linux convention), then python (Windows)
    let pythonCmd = 'python3';
    try {
      this._process = spawn(pythonCmd, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: cwd || process.cwd(),
      });
    } catch {
      pythonCmd = 'python';
      this._process = spawn(pythonCmd, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: cwd || process.cwd(),
      });
    }

    // Handle spawn failure (Python not installed)
    this._process.on('error', (err) => {
      if (err.code === 'ENOENT') {
        throw new Error(
          'Python is required for external method modules but was not found.\n' +
          '  Install Python 3.10+ from https://python.org'
        );
      }
      throw err;
    });

    // Python logging → CLI info channel (stderr is for logs, not errors)
    const stderrRl = createInterface({ input: this._process.stderr });
    stderrRl.on('line', (line) => output.info(`  [method] ${line}`));

    // stdout → JSON-lines protocol
    this._rl = createInterface({ input: this._process.stdout });

    // Wait for the ready signal (first line of output)
    const ready = await this._readResponse();
    if (!ready.ok) {
      throw new Error(ready.error);
    }
    this._methodName = ready.name || 'External Method';
    output.info(`  ✓ Method bridge: ${this._methodName}`);
  }

  /**
   * Send a JSON request line and read the response line.
   */
  async _request(obj) {
    return new Promise((resolve, reject) => {
      const line = JSON.stringify(obj) + '\n';
      this._process.stdin.write(line, 'utf-8', (err) => {
        if (err) return reject(err);
        this._readResponse().then(resolve).catch(reject);
      });
    });
  }

  /**
   * Read one JSON-lines response from the bridge subprocess.
   */
  _readResponse() {
    return new Promise((resolve, reject) => {
      const onLine = (line) => {
        try {
          resolve(JSON.parse(line));
        } catch (e) {
          reject(new Error(`Invalid response from method bridge: ${line}`));
        }
        this._rl.removeListener('line', onLine);
        this._process.removeListener('exit', onExit);
      };

      const onExit = (code) => {
        this._rl.removeListener('line', onLine);
        reject(new Error(
          `Method bridge exited unexpectedly (code ${code}).\n` +
          '  Check that the method module is installed correctly.\n' +
          '  Verify the method module is pip-installed (e.g., pip install <package-name>).'
        ));
      };

      this._rl.on('line', onLine);
      this._process.once('exit', onExit);
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
    return new Promise((resolve) => {
      let proc;
      try {
        proc = spawn('python3', [BRIDGE_SCRIPT, '--discover'], {
          stdio: ['pipe', 'pipe', 'pipe'],
          cwd: cwd || process.cwd(),
        });
      } catch {
        try {
          proc = spawn('python', [BRIDGE_SCRIPT, '--discover'], {
            stdio: ['pipe', 'pipe', 'pipe'],
            cwd: cwd || process.cwd(),
          });
        } catch {
          // Python not available — no method modules discoverable
          resolve([]);
          return;
        }
      }

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
      '  1. Install a method module (e.g., pip install <module-name>)',
      '  2. Run: champollion init',
      '  3. The wizard will detect and configure it automatically.',
    ];
  }

  /**
   * Clean up: send shutdown command and kill the subprocess.
   */
  async shutdown() {
    if (this._process) {
      try {
        await this._request({ action: 'shutdown' });
      } catch {
        // Process may already be dead — that's fine
      }
      this._process.kill();
      this._process = null;
    }
  }
}

export { ExternalMethod };
