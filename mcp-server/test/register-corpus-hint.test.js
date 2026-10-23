/**
 * The register-corpus command this server suggests must be one the CLI
 * accepts as printed. Round 7: the private-test-set guardrail suggested
 * `champollion network register-corpus --tier local-only --data <file>
 * --name … --pair … --license …`, which the CLI refuses ("A domain is
 * required (--domain)"), and without --yes a terminal user gets the
 * interactive wizard, which ignores the flags.
 *
 * This runs the exact command through the monorepo's real CLI (skipped
 * outside the monorepo), in a temp folder, on a two-line file.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { registerLocalOnlyCommand } from '../src/tools/register-corpus-hint.js';
import { trainingGuardrails, formatTrainingGuardrails } from '../src/tools/training.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const CLI = resolve(__dirname, '../../cli/bin/cli.js');

/** Split a printed command into argv the way a POSIX shell would (double quotes only). */
function argvOf(cmd) {
  const out = [];
  for (const m of cmd.matchAll(/"([^"]*)"|(\S+)/g)) out.push(m[1] ?? m[2]);
  return out;
}

describe('the register-corpus command the MCP suggests', () => {
  it('runs as printed through the real CLI and writes the local-only sidecar', (t) => {
    if (!existsSync(CLI)) { t.skip('the champollion CLI is not in this tree'); return; }
    const dir = mkdtempSync(join(tmpdir(), 'mcp-register-'));
    try {
      const file = join(dir, 'clinic test.tsv');
      writeFileSync(file, 'Where does it hurt?\tTânite ê-wîsakêyihtaman?\nThank you\tkinanâskomitin\n');
      const cmd = registerLocalOnlyCommand({
        file, name: 'Clinic phrases', pair: 'eng-crk', license: 'cc-by-4.0', domain: 'medical',
      });
      const argv = argvOf(cmd);
      assert.deepEqual(argv.slice(0, 3), ['champollion', 'network', 'register-corpus']);
      assert.ok(argv.includes(file), 'a path with a space stays one argument');
      const r = spawnSync(process.execPath, [CLI, ...argv.slice(1)], {
        cwd: dir, encoding: 'utf8', input: '', timeout: 60_000,
      });
      assert.equal(r.status, 0, `the CLI refused the suggested command:\n${r.stdout}\n${r.stderr}`);
      const sidecar = JSON.parse(readFileSync(`${file}.champollion.json`, 'utf8'));
      assert.equal(sidecar.transmission, 'local-only');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('is the command the private-test-set guardrail prints (one source, no drift)', () => {
    const text = formatTrainingGuardrails(trainingGuardrails('private-test-set'));
    assert.ok(text.includes(registerLocalOnlyCommand()), text);
    assert.match(registerLocalOnlyCommand(), /--yes .*--domain /);
  });
});
