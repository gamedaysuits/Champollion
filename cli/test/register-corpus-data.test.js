/**
 * register-corpus --data: the card and the file it describes are linked, and
 * mt-eval sees the registration through the steward sidecar.
 *
 * Round 0 (2026-10-03): a hospital persona registered its nurse-checked test
 * set, and nothing connected the card to the file — mt-eval never knew the
 * set was restricted, and protection rested on picking a local model by hand.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CLI = fileURLToPath(new URL('../bin/cli.js', import.meta.url));

function workdir() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'regdata-'));
  fs.mkdirSync(path.join(d, 'data'));
  fs.writeFileSync(path.join(d, 'data', 'test.tsv'),
    '# nurse-checked\nWhere does it hurt?\tzub kef\nTake this twice a day.\tmol tav\n');
  return d;
}

function register(cwd, extra) {
  return spawnSync(process.execPath, [CLI, 'register-corpus', '--yes', '--json',
    '--name', 'Ward phrasebook', '--pair', 'eng>qaa', '--license', 'proprietary',
    '--domain', 'medical', '--data', 'data/test.tsv', ...extra],
  { cwd, encoding: 'utf-8' });
}

describe('register-corpus --data', () => {
  it('local-only: checksums the file, counts rows (not comments), marks it local-only', () => {
    const cwd = workdir();
    const r = register(cwd, ['--tier', 'local-only']);
    assert.equal(r.status, 0, r.stderr);
    const out = JSON.parse(r.stdout);
    const bytes = fs.readFileSync(path.join(cwd, 'data', 'test.tsv'));
    const sha = crypto.createHash('sha256').update(bytes).digest('hex');
    assert.equal(out.dataSha256, sha);
    assert.equal(out.rows, 2);
    assert.equal(out.transmission, 'local-only');
    const side = JSON.parse(fs.readFileSync(path.join(cwd, 'data', 'test.tsv.champollion.json'), 'utf-8'));
    assert.equal(side.transmission, 'local-only');
    assert.equal(side.id, out.id);
    assert.equal(side.license, 'LicenseRef-Proprietary');
    assert.equal(side.sha256, sha, 'the sidecar pins which version of the file was registered');
    const card = JSON.parse(fs.readFileSync(out.path, 'utf-8'));
    assert.equal(card.dev.size, 2, '--size defaults to the data rows');
    assert.ok(!JSON.stringify(card).includes('Where does it hurt'), 'no text on the card');
  });

  it('never loosens a sidecar that already says local-only', () => {
    const cwd = workdir();
    fs.writeFileSync(path.join(cwd, 'data', 'test.tsv.champollion.json'),
      JSON.stringify({ transmission: 'local-only' }));
    const r = register(cwd, ['--tier', 'private', '--cards-dir', path.join(cwd, 'cards')]);
    assert.equal(r.status, 0, r.stderr);
    const side = JSON.parse(fs.readFileSync(path.join(cwd, 'data', 'test.tsv.champollion.json'), 'utf-8'));
    assert.equal(side.transmission, 'local-only');
    assert.equal(side.tier, 'private');
  });

  it('a private registration without a prior mark sets no transmission restriction', () => {
    const cwd = workdir();
    const r = register(cwd, ['--tier', 'private', '--cards-dir', path.join(cwd, 'cards')]);
    assert.equal(r.status, 0, r.stderr);
    const side = JSON.parse(fs.readFileSync(path.join(cwd, 'data', 'test.tsv.champollion.json'), 'utf-8'));
    assert.equal(side.transmission, undefined);
    assert.equal(side.license, 'LicenseRef-Proprietary', 'the licence reaches the harness policy');
  });

  it('refuses --data for a public corpus (fetched from source) and a missing file', () => {
    const cwd = workdir();
    const pub = register(cwd, ['--tier', 'public']);
    assert.equal(pub.status, 1);
    assert.match(pub.stderr, /fetched from its source/);
    const missing = spawnSync(process.execPath, [CLI, 'register-corpus', '--yes',
      '--name', 'X', '--pair', 'eng>qaa', '--license', 'cc-by-4.0', '--domain', 'news',
      '--data', 'nope.tsv'], { cwd, encoding: 'utf-8' });
    assert.equal(missing.status, 1);
    assert.match(missing.stderr, /no such file/);
  });
});
