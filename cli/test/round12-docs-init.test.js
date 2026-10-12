/**
 * Round 12 synthetic users — three onboarding gaps in the docs and init.
 *
 *   4 (Next.js persona): the quick start's own-machine option named only
 *     Ollama's default address, never LOCAL_API_BASE, the variable the local
 *     method reads to reach another server.
 *   7 (i18next persona): the CI guide's "dev dependency" alternative had no
 *     install step (npx then fetches the latest version) and inherited
 *     `git add --all`, which commits the node_modules/ that install writes
 *     when .gitignore lists only .champollion/.
 *  10 (Django persona): nothing said a locale/ beside manage.py is loaded at
 *     runtime only when LOCALE_PATHS names it, and that LANGUAGES lists the
 *     languages offered — CI compiled and committed catalogs the site never
 *     showed. init now says so for a Django project with a root locale/.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LocalMethod } from '../lib/methods/local.js';

const CLI = fileURLToPath(new URL('../bin/cli.js', import.meta.url));
const doc = (rel) => fs.readFileSync(new URL(`../website/docs/${rel}`, import.meta.url), 'utf8');
const ENV = { ...process.env, CI: '', GITHUB_ACTIONS: '', CHAMPOLLION_OFFLINE: '1', LOCAL_API_BASE: '' };

const DJANGO_LINE = /Django reads locale\/ only when LOCALE_PATHS in your settings names it, and offers only the languages LANGUAGES lists \(its default: every language Django ships with\): https:\/\/champollion\.dev\/docs\/integrations\/frameworks#django-locale-paths/;

function tmp(name) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `r12-${name}-`));
}
function write(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
}
const EN_PO = [
  'msgid ""', 'msgstr ""', '"Content-Type: text/plain; charset=UTF-8\\n"', '"Language: en\\n"', '',
  'msgid "Welcome"', 'msgstr ""', '',
].join('\n');

const init = (cwd, ...flags) => spawnSync(process.execPath,
  [CLI, 'init', '--yes', '--method', 'local', '--model', 'stub-1', ...flags],
  { cwd, encoding: 'utf-8', env: ENV });

describe('Round 12 — 10: init names LOCALE_PATHS and LANGUAGES for a Django project with a root locale/', () => {
  it('a Django project (manage.py) with locale/ at its root gets the line', () => {
    const d = tmp('django');
    try {
      write(path.join(d, 'manage.py'), '');
      write(path.join(d, 'locale/en/LC_MESSAGES/django.po'), EN_PO);
      const r = init(d, '--langs', 'fr,ru');
      assert.equal(r.status, 0, r.stdout + r.stderr);
      assert.match(r.stdout, DJANGO_LINE);
      assert.equal(r.stdout.match(/LOCALE_PATHS/g).length, 1, 'said once');
    } finally {
      fs.rmSync(d, { recursive: true, force: true });
    }
  });

  it('a Django project whose locale files are not in a root locale/ does not', () => {
    const d = tmp('django-json');
    try {
      write(path.join(d, 'manage.py'), '');
      write(path.join(d, 'locales/en.json'), JSON.stringify({ welcome: 'Welcome' }));
      const r = init(d, '--langs', 'fr');
      assert.equal(r.status, 0, r.stdout + r.stderr);
      assert.doesNotMatch(r.stdout + r.stderr, /LOCALE_PATHS/);
    } finally {
      fs.rmSync(d, { recursive: true, force: true });
    }
  });

  it('a gettext project with locale/ but no manage.py (not Django) does not', () => {
    const d = tmp('gettext');
    try {
      write(path.join(d, 'locale/en/LC_MESSAGES/messages.po'), EN_PO);
      const r = init(d, '--langs', 'fr');
      assert.equal(r.status, 0, r.stdout + r.stderr);
      assert.match(r.stdout, /locale\/\{lang\}\/LC_MESSAGES\/\{ns\}\.po/, 'the catalogs were found');
      assert.doesNotMatch(r.stdout + r.stderr, /LOCALE_PATHS/);
    } finally {
      fs.rmSync(d, { recursive: true, force: true });
    }
  });

  it('the page the line links to has that anchor, the two settings, and why', () => {
    const page = doc('integrations/frameworks.md');
    const django = page.slice(page.indexOf('## Django and gettext (.po)'));
    const at = django.indexOf('### Settings: LOCALE_PATHS and LANGUAGES {#django-locale-paths}');
    assert.ok(at > 0, 'the section exists, under the Django heading');
    const sec = django.slice(at, django.indexOf('### Setup'));
    assert.ok(sec.length > 0 && at < django.indexOf('### Setup'));
    assert.match(sec, /```python title="settings\.py"\nLOCALE_PATHS = \[BASE_DIR \/ "locale"\]/);
    assert.match(sec, /\nLANGUAGES = \[\("en", "English"\), \("fr", "Français"\), \("ru", "Русский"\)\]\n/);
    assert.match(sec.replace(/\s+/g, ' '), /A `locale\/` beside `manage\.py` belongs to no app, so until `LOCALE_PATHS` names it, `compilemessages` still builds its `\.mo` files but the site keeps showing the untranslated text/);
  });
});

describe('Round 12 — 4: the quick start says how to reach a model server elsewhere', () => {
  it('Option C names LOCAL_API_BASE — the variable the local method reads first — and the files it is read from', () => {
    const q = doc('getting-started/quick-start.md');
    const optionC = q.slice(q.indexOf('# Option C:'), q.indexOf('```', q.indexOf('# Option C:')));
    assert.match(optionC, /http:\/\/localhost:11434\/v1/);
    assert.match(optionC, /#   another server: export LOCAL_API_BASE=http:\/\/localhost:8000\/v1 \(its address; or put that line in \.env\.local or \.env\)/);
    // The documented name is the one the code reads first, and the default is Ollama's.
    const m = new LocalMethod();
    assert.equal(m._getApiBaseEnvVars()[0], 'LOCAL_API_BASE');
    assert.equal(m._getDefaultApiBase(), 'http://localhost:11434/v1');
  });

  it('a .env.local line is read, as the quick start says', () => {
    const d = tmp('envlocal');
    try {
      write(path.join(d, '.env.local'), 'export LOCAL_API_BASE=http://localhost:8000/v1\n');
      const saved = process.env.LOCAL_API_BASE;
      delete process.env.LOCAL_API_BASE;
      try {
        assert.deepEqual(new LocalMethod()._resolveApiBaseSource({ cwd: d }).base, 'http://localhost:8000/v1');
      } finally {
        if (saved !== undefined) process.env.LOCAL_API_BASE = saved;
      }
    } finally {
      fs.rmSync(d, { recursive: true, force: true });
    }
  });

  it('init --method local points at the same variable', () => {
    const d = tmp('next');
    try {
      write(path.join(d, 'messages/en.json'), JSON.stringify({ hi: 'Hello there' }));
      write(path.join(d, 'package.json'), JSON.stringify({ dependencies: { 'next-intl': '3.0.0' } }));
      const r = init(d, '--langs', 'fr');
      assert.equal(r.status, 0, r.stdout + r.stderr);
      assert.match(r.stdout, /export LOCAL_API_BASE=/);
    } finally {
      fs.rmSync(d, { recursive: true, force: true });
    }
  });
});

describe('Round 12 — 7: the CI guide\'s dev-dependency variant installs the pinned CLI and stages by name', () => {
  const guide = doc('guides/ci-cd.md');
  const at = guide.indexOf('```yaml title=".github/workflows/i18n-sync.yml (dev dependency)"');
  const block = guide.slice(at, guide.indexOf('```', at + 10));

  it('installs with npm ci before the sync, runs the installed CLI, and never stages with --all', () => {
    assert.ok(at > 0, 'the variant exists');
    assert.ok(block.indexOf('- run: npm ci') > 0);
    assert.ok(block.indexOf('- run: npm ci') < block.indexOf('npx champollion sync'));
    // Round 13: the job's flags live in one SYNC_FLAGS line, read by the sync and the dry-run check.
    assert.match(block, /#   npx champollion sync \$SYNC_FLAGS .*\n#   npx champollion verify --strict\n/);
    assert.doesNotMatch(block, /git add --all/);
    assert.doesNotMatch(block, /champollion@0\.5/);
    // The by-name staging is the Django workflow's pattern, with the locale folder for the catalogs.
    const djangoAdd = /git add -- '\*\.po' \.champollion\.lock\n\s+# A replaced hand edit is recorded here — the only copy of that wording\.\n\s+if \[ -f \.champollion-replaced-edits\.jsonl \]; then git add -- \.champollion-replaced-edits\.jsonl; fi/;
    assert.match(guide, djangoAdd);
    assert.match(block, /git add -- locales \.champollion\.lock\n\s+# A replaced hand edit is recorded here — the only copy of that wording\.\n\s+if \[ -f \.champollion-replaced-edits\.jsonl \]; then git add -- \.champollion-replaced-edits\.jsonl; fi\n/);
    assert.match(block, /git pull --rebase origin "\$GITHUB_REF_NAME"\n\s+git push origin "HEAD:\$GITHUB_REF_NAME"/);
  });

  it('the staging lines, run as written in a repository with node_modules/, stage the locale files and the lock only', () => {
    const lines = block.split('\n').map(l => l.trim()).filter(l => l.startsWith('git add --') || l.startsWith('if [ -f .champollion-replaced-edits'));
    assert.equal(lines.length, 2, block);
    const repo = tmp('git');
    try {
      // A hook's GIT_DIR / GIT_INDEX_FILE must not point these commands at another repository.
      const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('GIT_')));
      const git = (...args) => spawnSync('git', args, { cwd: repo, encoding: 'utf8', env });
      git('init', '-q');
      write(path.join(repo, '.gitignore'), '# champollion: per-machine translation cache (commit the .champollion*.lock files)\n.champollion/\n');
      write(path.join(repo, 'locales/en.json'), '{"hi":"Hello"}');
      git('add', '.');
      git('-c', 'user.email=t@example.com', '-c', 'user.name=t', 'commit', '-qm', 'init');
      // What a sync job leaves behind: a new translation, the lock, the cache, and npm ci's node_modules/.
      write(path.join(repo, 'locales/fr.json'), '{"hi":"Bonjour"}');
      write(path.join(repo, '.champollion.lock'), '{}');
      write(path.join(repo, '.champollion/tm.json'), '{}');
      write(path.join(repo, 'node_modules/champollion/package.json'), '{}');
      const r = spawnSync('sh', ['-c', lines.join('\n')], { cwd: repo, encoding: 'utf8', env });
      assert.equal(r.status, 0, r.stderr);
      const staged = git('diff', '--staged', '--name-only').stdout.trim().split('\n').sort();
      assert.deepEqual(staged, ['.champollion.lock', 'locales/fr.json']);
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });
});
