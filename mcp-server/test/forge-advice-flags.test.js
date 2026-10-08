/**
 * forge's advice is followable over MCP: every `nmt-forge <command> --flag`
 * that forge's own text names (refusal fixes, next commands, advice) is an
 * argument of the forge_* tool that runs that command.
 *
 * Round 9: forge refused an ambiguous export and advised pinning each
 * preregistration with `nmt-forge prereg new … --config-hash`, but the MCP
 * forge_prereg tool had no such argument — an MCP-only agent could not apply
 * forge's own fix. The flags are read from forge's source by
 * forge/scripts/advice_flags.py (string literals via the Python AST, so a
 * flag split across concatenated literals is still seen); commands with no
 * tool (run, serve, monitor, score, …) are terminal steps and are skipped;
 * a few flags are never tool arguments on purpose (FORGE_FLAGS_NEVER_TOOLS —
 * e.g. --show-text, which prints a withheld corpus for a person).
 *
 * Needs the monorepo's forge/ beside this package and a python3; skipped
 * (saying why) otherwise.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

import { createServer } from '../src/index.js';
import { FORGE_COMMAND_TOOLS, FORGE_FLAGS_NEVER_TOOLS, forgeFlagArg } from '../src/tools/forge.js';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const SCRIPT = resolve(HERE, '../../forge/scripts/advice_flags.py');

function adviceFlags() {
  if (!existsSync(SCRIPT)) return { skip: 'forge/ is not beside this package (not a monorepo checkout)' };
  try {
    const out = execFileSync(process.env.PYTHON_BIN || 'python3', [SCRIPT],
      { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 60_000 });
    return { flags: JSON.parse(out) };
  } catch (err) {
    return { skip: `python3 could not run ${SCRIPT}: ${err.message.split('\n')[0]}` };
  }
}

let client;
let STATE;
let tools;

before(async () => {
  STATE = mkdtempSync(join(tmpdir(), 'mcp-advice-flags-'));
  process.env.CHAMPOLLION_MCP_HOME = STATE;
  const server = await createServer();
  const [clientT, serverT] = InMemoryTransport.createLinkedPair();
  await server.connect(serverT);
  client = new Client({ name: 'advice-flags-test', version: '0.0.0' });
  await client.connect(clientT);
  tools = (await client.listTools()).tools;
});

after(async () => {
  await client?.close();
  delete process.env.CHAMPOLLION_MCP_HOME;
  rmSync(STATE, { recursive: true, force: true });
});

describe('forge advice flags vs the forge_* tool schemas', () => {
  it('every tool the command map names exists', () => {
    const names = new Set(tools.map((t) => t.name));
    for (const [cmd, tool] of FORGE_COMMAND_TOOLS) {
      if (tool) assert.ok(names.has(tool), `${cmd} → ${tool}: no such tool`);
    }
  });

  it('every flag forge\'s advice names on a command with a tool is an argument of that tool', (t) => {
    const { flags, skip } = adviceFlags();
    if (skip) { t.skip(skip); return; }
    const byName = new Map(tools.map((x) => [x.name, x]));
    const commands = new Map(FORGE_COMMAND_TOOLS);
    const missing = [];
    let checked = 0;
    for (const [cmd, seen] of Object.entries(flags)) {
      const tool = commands.get(cmd);
      if (!tool) continue;                     // a terminal step
      const props = byName.get(tool)?.inputSchema?.properties ?? {};
      for (const [flag, where] of Object.entries(seen)) {
        if (Object.hasOwn(FORGE_FLAGS_NEVER_TOOLS, flag)) continue;
        checked += 1;
        if (!Object.hasOwn(props, forgeFlagArg(flag))) {
          missing.push(`nmt-forge ${cmd} ${flag} → ${tool} has no \`${forgeFlagArg(flag)}\` `
            + `(named at ${where.slice(0, 3).join(', ')})`);
        }
      }
    }
    assert.ok(checked > 10, `only ${checked} advice flags found — is the extractor still reading forge?`);
    assert.deepEqual(missing, [], `forge advises flags its MCP tool cannot pass:\n${missing.join('\n')}`);
  });

  it('the flag the Round 9 refusal names is among those checked', (t) => {
    const { flags, skip } = adviceFlags();
    if (skip) { t.skip(skip); return; }
    assert.ok(flags['prereg new']?.['--config-hash'], 'the extractor no longer sees prereg new --config-hash');
    const prereg = tools.find((x) => x.name === 'forge_prereg');
    assert.ok(prereg.inputSchema.properties.config_hash, 'forge_prereg lost config_hash');
  });
});
