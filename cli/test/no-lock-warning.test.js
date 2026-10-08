/**
 * No lock file, but translations already on disk: sync cannot tell which are
 * out of date. It used to keep them all in silence; it now says so once.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CLI = fileURLToPath(new URL('../bin/cli.js', import.meta.url));

function project({ frContent }) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'nolock-'));
  fs.mkdirSync(path.join(d, 'locales'));
  fs.writeFileSync(path.join(d, 'locales', 'en.json'), JSON.stringify({ a: 'Hello', b: 'Bye' }));
  fs.writeFileSync(path.join(d, 'locales', 'fr.json'), JSON.stringify(frContent));
  fs.writeFileSync(path.join(d, 'champollion.config.json'), JSON.stringify(
    { inputLocale: 'en', localesDir: 'locales', languages: ['fr'] }));
  return d;
}

const dry = (cwd) => spawnSync(process.execPath, [CLI, 'sync', '--dry', '--method', 'local'],
  { cwd, encoding: 'utf-8', env: { ...process.env, LOCAL_API_BASE: 'http://127.0.0.1:9/v1' } });

describe('sync without a lock file', () => {
  it('warns when existing translations cannot be checked for staleness', () => {
    const r = dry(project({ frContent: { a: 'Bonjour' } }));
    const out = r.stdout + r.stderr;
    assert.match(out, /No \.champollion\.lock, but 1 target file\(s\) already hold translations/);
    assert.match(out, /--redo all/);
  });

  it('stays quiet for a fresh project (empty target files, as init creates)', () => {
    const r = dry(project({ frContent: {} }));
    assert.doesNotMatch(r.stdout + r.stderr, /No \.champollion\.lock/);
  });
});

describe('audit — the CI completeness gate', () => {
  const audit = (cwd) => spawnSync(process.execPath, [CLI, 'audit'], { cwd, encoding: 'utf-8' });

  it('fails when a key is missing from an existing target file', () => {
    // Only [EN] fallbacks used to count: this passed with "fully translated".
    const r = audit(project({ frContent: { a: 'Bonjour' } }));
    assert.notEqual(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout + r.stderr, /1 keys still need translation/);
  });

  it('fails on an empty value, passes when complete', () => {
    assert.notEqual(audit(project({ frContent: { a: 'Bonjour', b: '' } })).status, 0);
    assert.equal(audit(project({ frContent: { a: 'Bonjour', b: 'Au revoir' } })).status, 0);
  });
});

describe('init keeps the cache out of git', () => {
  it('adds .champollion/ to .gitignore once, in a git repo', () => {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'initgi-'));
    fs.mkdirSync(path.join(d, '.git'));
    fs.mkdirSync(path.join(d, 'locales'));
    fs.writeFileSync(path.join(d, 'locales', 'en.json'), '{"a":"Hi"}');
    fs.writeFileSync(path.join(d, '.gitignore'), 'node_modules');
    const run = () => spawnSync(process.execPath, [CLI, 'init', '--yes', '--force', '--langs', 'fr'], { cwd: d, encoding: 'utf-8' });
    assert.equal(run().status, 0);
    run();
    const gi = fs.readFileSync(path.join(d, '.gitignore'), 'utf-8');
    assert.equal(gi.match(/^\.champollion\/$/gm).length, 1);
    assert.match(gi, /^node_modules$/m);
  });

  // `git init` AFTER `champollion init` used to commit the cache: the
  // .gitignore was only written when .git or a .gitignore already existed.
  it('creates .gitignore even when the folder is not a git repo yet, and never duplicates', () => {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'initgi-nogit-'));
    fs.mkdirSync(path.join(d, 'locales'));
    fs.writeFileSync(path.join(d, 'locales', 'en.json'), '{"a":"Hi"}');
    const run = () => spawnSync(process.execPath, [CLI, 'init', '--yes', '--force', '--langs', 'fr'], { cwd: d, encoding: 'utf-8' });
    const first = run();
    assert.equal(first.status, 0, first.stdout + first.stderr);
    assert.match(first.stdout, /Created \.gitignore/);
    run();
    const gi = fs.readFileSync(path.join(d, '.gitignore'), 'utf-8');
    assert.equal(gi.match(/^\.champollion\/$/gm).length, 1);
  });

  it('leaves a .gitignore alone when another line already covers the cache', () => {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'initgi-covered-'));
    fs.mkdirSync(path.join(d, 'locales'));
    fs.writeFileSync(path.join(d, 'locales', 'en.json'), '{"a":"Hi"}');
    fs.writeFileSync(path.join(d, '.gitignore'), 'node_modules\n/.champollion/*\n');
    const r = spawnSync(process.execPath, [CLI, 'init', '--yes', '--force', '--langs', 'fr'], { cwd: d, encoding: 'utf-8' });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.equal(fs.readFileSync(path.join(d, '.gitignore'), 'utf-8'), 'node_modules\n/.champollion/*\n');
  });
});
