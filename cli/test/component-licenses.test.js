/**
 * component-licenses test suite — the declaration gate must be able to fail.
 *
 * WHY: `forge/` is AGPL-3.0-or-later, 86 tracked files, approved for the public
 * squash, and it was declared in NONE of the three tables that claim to
 * enumerate this repo's licensing. The tables are hand-maintained; they fall
 * behind the tree and never say so.
 *
 * cli/scripts/check-component-licenses.mjs closes that by DISCOVERING
 * components from git instead of reading a list. These tests pin the two
 * properties that make it worth having:
 *
 *   1. Discovery is complete — it finds components licensed by a manifest AND
 *      components licensed by a LICENSE file alone (`shared/` is the latter,
 *      and a manifest-only pass silently missed it).
 *   2. The gate can actually fail — a mutation test. A gate nobody has seen go
 *      red is an assumption, not a guarantee (the standard set by
 *      docs/GATE_TEST_META_AUDIT_2026-07-18.md).
 *
 * @see cli/scripts/check-component-licenses.mjs
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const CHECKER = path.join(ROOT, 'cli', 'scripts', 'check-component-licenses.mjs');

function runChecker(cwd = ROOT) {
  return spawnSync(process.execPath, [CHECKER], {
    cwd, encoding: 'utf8', timeout: 300_000,
  });
}

describe('component-license declarations', () => {
  it('the repo currently passes', () => {
    const r = runChecker();
    assert.equal(r.status, 0,
      `component-license gate is red:\n${r.stdout}\n${r.stderr}`);
  });

  it('discovers every licensed component, including LICENSE-only ones', () => {
    const r = runChecker();
    const out = r.stdout + r.stderr;
    const m = /(\d+) component\(s\) declared/.exec(out);
    assert.ok(m, `checker did not report a component count:\n${out}`);
    const found = Number(m[1]);

    // Every directory with a tracked LICENSE (bar the root pointer table) is a
    // component, so discovery must find at least that many. If this number
    // drops, discovery has narrowed and something stopped being checked.
    const licenseDirs = execFileSync('git', ['ls-files'], {
      cwd: ROOT, encoding: 'utf8', maxBuffer: 64 << 20,
    })
      .split('\n')
      .filter((p) => /(^|\/)LICENSE$/.test(p) && p !== 'LICENSE')
      // cli/data/*/LICENSE are UPSTREAM datasets' own grants, tracked as
      // licence evidence. They are third-party licences, not components we
      // publish, so the component tables must not be expected to list them.
      .filter((p) => !p.startsWith('cli/data/'))
      .map((p) => path.posix.dirname(p));

    assert.ok(found >= licenseDirs.length,
      `discovery found ${found} components but ${licenseDirs.length} directories `
      + `carry a tracked LICENSE (${licenseDirs.join(', ')}) — discovery narrowed`);
  });

  it('declares forge/ specifically — the component this gate exists for', () => {
    for (const rel of ['docs/LICENSING.md', 'LICENSE', 'docs/DATA_BOUNDARIES.md']) {
      const text = fs.readFileSync(path.join(ROOT, rel), 'utf8');
      assert.ok(text.includes('forge/'),
        `${rel} does not declare forge/ (AGPL-3.0-or-later)`);
      const i = text.indexOf('forge/');
      assert.match(text.slice(i, i + 900), /AGPL/i,
        `${rel} mentions forge/ without stating it is AGPL`);
    }
  });

  it('FAILS when a declaration is removed (mutation test)', () => {
    // Copy the three tables aside, strip forge/ from one, and confirm the gate
    // goes red. Without this, "the gate passes" proves only that it runs.
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'champ-complic-'));
    const target = path.join(ROOT, 'docs', 'LICENSING.md');
    const backup = path.join(tmp, 'LICENSING.md');
    fs.copyFileSync(target, backup);
    try {
      const text = fs.readFileSync(target, 'utf8');
      const stripped = text
        .split('\n')
        .filter((line) => !(line.startsWith('| `forge/`')))
        .join('\n');
      assert.notEqual(stripped, text, 'the forge/ row was not found to strip');
      fs.writeFileSync(target, stripped);

      const r = runChecker();
      assert.equal(r.status, 3,
        'removing the forge/ declaration did NOT red the gate — it cannot fail, '
        + `so it guarantees nothing.\n${r.stdout}\n${r.stderr}`);
      assert.match(r.stderr + r.stdout, /forge/,
        'the failure did not name the undeclared component');
    } finally {
      fs.copyFileSync(backup, target);
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('corpora-builder is declared PROPRIETARY, not open-source', () => {
    // This test used to assert the checker SURFACED a packaging conflict:
    // corpora-builder declared Apache-2.0 in its own pyproject while setuptools
    // packed it into the AGPL mt-eval wheel. The founder resolved that on
    // 2026-08-01 — it is proprietary internal tooling and ships with nothing —
    // so the conflict, and the checker's note about it, are correctly gone.
    // What must hold now is the resolution itself.
    for (const rel of ['docs/LICENSING.md', 'LICENSE', 'docs/DATA_BOUNDARIES.md']) {
      const text = fs.readFileSync(path.join(ROOT, rel), 'utf8');
      const i = text.indexOf('corpora-builder');
      assert.notEqual(i, -1, `${rel} does not declare corpora-builder`);
      assert.match(text.slice(i - 200, i + 900), /PROPRIETARY|Champollion-Proprietary|All Rights Reserved/i,
        `${rel} does not record corpora-builder as proprietary`);
    }
    // And the gate must still be green with it declared that way.
    assert.equal(runChecker().status, 0);
  });
});
