/**
 * forge_* — drive nmt-forge (the monorepo forge/ training suite) from an
 * agent, one guarded step at a time.
 *
 * get_training_guardrails answers "what are the rules?"; these tools answer
 * "where am I and what do I run next?" against a real workspace. Every tool
 * shells out to the forge CLI with `--json` and relays the structured result;
 * forge's refusals (what/why/fix) pass through verbatim, because a refusal is
 * the product — it is the guard doing its job.
 *
 * The long-running GPU job (`nmt-forge run`) is deliberately NOT a tool: it
 * would blow past any MCP client timeout. forge_status hands back the exact
 * `run` command and the watcher guidance instead; forge_evaluate closes the
 * loop after the run completes (decode+score+diagnose — CPU-cheap).
 *
 * Resolution: the forge package is invoked as `python3 -m nmt_forge.cli` with
 * PYTHONPATH pointed at the forge/ directory (monorepo sibling of mcp-server,
 * overridable via CHAMPOLLION_FORGE_DIR). An installed console script can be
 * forced with NMT_FORGE_BIN. The Python interpreter is PYTHON_BIN or python3.
 */

import { spawn } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
// src/tools/forge.js → mcp-server root is two levels up
const MCP_ROOT = resolve(HERE, '../..');

/** Absolute path to the forge/ package directory. */
export function forgeDir() {
  return process.env.CHAMPOLLION_FORGE_DIR || resolve(MCP_ROOT, '../forge');
}

/**
 * Build the argv + env to invoke a forge subcommand — PURE, unit-testable.
 *
 * The global `--workspace` flag precedes the subcommand (argparse layout).
 * Callers pass already-validated positionals/flags in `subArgs`.
 *
 * @param {string[]} subArgs  subcommand + its args, e.g. ['status', '--json']
 * @param {{workspace?: string}} [opts]
 * @returns {{cmd: string, args: string[], env: object, cwd: string}}
 */
export function buildForgeInvocation(subArgs, { workspace } = {}) {
  const ws = workspace || process.env.CHAMPOLLION_FORGE_WORKSPACE || '.forge';
  const globals = ['--workspace', ws];
  const dir = forgeDir();
  if (process.env.NMT_FORGE_BIN) {
    return {
      cmd: process.env.NMT_FORGE_BIN,
      args: [...globals, ...subArgs],
      env: { ...process.env },
      cwd: process.cwd(),
    };
  }
  return {
    cmd: process.env.PYTHON_BIN || 'python3',
    args: ['-m', 'nmt_forge.cli', ...globals, ...subArgs],
    env: {
      ...process.env,
      PYTHONPATH: process.env.PYTHONPATH
        ? `${dir}:${process.env.PYTHONPATH}`
        : dir,
    },
    cwd: process.cwd(),
  };
}

/**
 * Spawn forge, capture output. No shell. stdin ignored (MCP stdio parent's
 * stdin is the JSON-RPC stream — a child must never read it).
 *
 * @param {string[]} subArgs
 * @param {{workspace?: string, timeout?: number}} [opts]
 * @returns {Promise<{code: number, stdout: string, stderr: string}>}
 */
export function runForge(subArgs, { workspace, timeout = 120_000 } = {}) {
  const { cmd, args, env, cwd } = buildForgeInvocation(subArgs, { workspace });
  return new Promise((resolvePromise, reject) => {
    const proc = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], env, cwd, timeout });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (d) => { stdout += d; });
    proc.stderr.on('data', (d) => { stderr += d; });
    proc.on('close', (code) => {
      // The most common cold-start failure is python not finding the forge
      // package at all — translate the raw traceback into the fix.
      if ((code ?? 1) !== 0 && /No module named '?nmt_forge'?/.test(stderr)) {
        stderr += '\n[forge] nmt_forge is not importable. forge is part of the '
          + 'Champollion monorepo (not on PyPI): clone '
          + 'https://github.com/gamedaysuits/Champollion and point '
          + 'CHAMPOLLION_FORGE_DIR at its forge/ directory. Scoring also needs '
          + 'the eval harness: pip install mt-eval-harness';
      }
      resolvePromise({ code: code ?? 1, stdout, stderr });
    });
    proc.on('error', (err) => reject(new Error(
      `could not launch forge (${cmd}): ${err.message}. Is forge/ present `
      + `(set CHAMPOLLION_FORGE_DIR) and python3 available?`)));
  });
}

/**
 * Run a forge subcommand and shape the MCP result. Parses stdout as JSON when
 * the subcommand emits JSON (most do with --json / _print); otherwise relays
 * text. A nonzero exit is surfaced as isError with the guard's message.
 *
 * @param {string[]} subArgs
 * @param {{workspace?: string, parseJson?: boolean, nextHint?: string}} [opts]
 * @returns {Promise<{content: Array, isError: boolean}>}
 */
export async function forgeTool(subArgs, { workspace, parseJson = true, nextHint } = {}) {
  let res;
  try {
    res = await runForge(subArgs, { workspace });
  } catch (err) {
    return { content: [{ type: 'text', text: err.message }], isError: true };
  }
  if (res.code !== 0) {
    // forge writes what/why/fix to stderr on a ForgeError (exit 2)
    const msg = (res.stderr || res.stdout || 'forge exited nonzero').trim();
    return {
      content: [{ type: 'text', text: `forge refused (exit ${res.code}):\n${msg}` }],
      isError: true,
    };
  }
  let payload = res.stdout.trim();
  if (parseJson) {
    try {
      const parsed = JSON.parse(payload);
      const out = { result: parsed };
      if (nextHint) out.next = nextHint;
      payload = JSON.stringify(out, null, 2);
    } catch {
      // not JSON (some commands print human text) — relay as-is
    }
  }
  return { content: [{ type: 'text', text: payload }], isError: false };
}
