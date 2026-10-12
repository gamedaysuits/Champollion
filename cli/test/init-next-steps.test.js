/**
 * What `init` tells you to do next names YOUR project, not an example.
 *
 * THE FINDINGS (synthetic hospital persona — Flutter ARB app, en→abc — and
 * Cree school persona, 2026-10):
 *   - the hints said `champollion xliff export --locale fr` in a project
 *     whose only target is abc;
 *   - "Next steps:" was followed by two blank lines;
 *   - the evidence hint printed `champollion recommend en abc` while the
 *     guides use the grouped form `champollion network recommend`;
 *   - init had no flag for a folder of Markdown (a newsletter archive), so
 *     `contentDir` had to be added to the config by hand.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CLI = fileURLToPath(new URL('../bin/cli.js', import.meta.url));

function flutterProject() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'init-next-'));
  fs.mkdirSync(path.join(d, 'lib', 'l10n'), { recursive: true });
  fs.mkdirSync(path.join(d, 'newsletters'));
  fs.writeFileSync(path.join(d, 'pubspec.yaml'), 'name: hospital\nflutter:\n  generate: true\n');
  fs.writeFileSync(path.join(d, 'l10n.yaml'), 'arb-dir: lib/l10n\ntemplate-arb-file: app_en.arb\n');
  fs.writeFileSync(path.join(d, 'lib', 'l10n', 'app_en.arb'), '{"@@locale":"en","hello":"Hello"}');
  fs.writeFileSync(path.join(d, 'newsletters', '2026-10.md'), '# Hello\n');
  return d;
}

const init = (cwd, ...flags) => spawnSync(process.execPath, [CLI, 'init', '--yes', ...flags], {
  cwd, encoding: 'utf-8', env: { ...process.env, LOCAL_API_BASE: '' },
});

describe('init next steps', () => {
  it('names the configured target, the grouped recommend command, and no stacked blank lines', () => {
    const d = flutterProject();
    const r = init(d, '--langs', 'abc', '--method', 'local', '--model', 'stub-1');
    assert.equal(r.status, 0, r.stdout + r.stderr);
    const out = r.stdout;
    assert.match(out, /champollion xliff export --locale abc/);
    assert.doesNotMatch(out, /--locale fr\b/);
    assert.match(out, /champollion network recommend en abc/);
    assert.doesNotMatch(out, /^\s*champollion recommend /m);
    const steps = out.slice(out.indexOf('Next steps:'));
    assert.doesNotMatch(steps, /\n[ \t]*\n[ \t]*\n/, 'no two blank lines in a row');
  });

  it('with no target yet, no export or recommend hint invents one', () => {
    const d = flutterProject();
    fs.rmSync(path.join(d, 'l10n.yaml'));
    fs.rmSync(path.join(d, 'pubspec.yaml'));
    fs.mkdirSync(path.join(d, 'locales'));
    fs.writeFileSync(path.join(d, 'locales', 'en.json'), '{"a":"Hi"}');
    const r = init(d);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.doesNotMatch(r.stdout, /xliff export --locale/);
    assert.doesNotMatch(r.stdout, /recommend en /);
  });
});

describe('init --content-dir', () => {
  it('writes contentDir for a folder of Markdown', () => {
    const d = flutterProject();
    const r = init(d, '--langs', 'abc', '--method', 'local', '--content-dir', 'newsletters');
    assert.equal(r.status, 0, r.stdout + r.stderr);
    const config = JSON.parse(fs.readFileSync(path.join(d, 'champollion.config.json'), 'utf-8'));
    assert.equal(config.contentDir, 'newsletters');
  });

  it('refuses a folder that does not exist, and writes nothing', () => {
    const d = flutterProject();
    const r = init(d, '--langs', 'abc', '--content-dir', 'newsleters');
    assert.equal(r.status, 1);
    assert.match(r.stderr, /--content-dir newsleters: no such folder/);
    assert.equal(fs.existsSync(path.join(d, 'champollion.config.json')), false);
  });
});
