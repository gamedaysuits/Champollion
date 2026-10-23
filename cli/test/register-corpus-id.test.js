/**
 * register-corpus card ids: named after the corpus, never a role the author
 * did not state.
 *
 * Round 0 persona (2026-10-03): a hospital registered its nurse-checked
 * held-out TEST set with
 *
 *   --name "Hospital nurse-checked test" --publisher "Hospital clinical informatics"
 *
 * and got eval-eng-abc-hospital-clinical-informatics-dev-v1 — named after the
 * publisher, and stamped `dev` although nobody said dev. The id is what every
 * later command and run card shows, so it told every reader the wrong thing.
 *
 * The id scheme does not require a role (the corpora-card schema pattern is
 * ^(ref|eval)-[a-z0-9][a-z0-9-]*$ and tracked cards exist without one), so
 * --role is optional and the id carries a role only when it is given.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  CORPUS_ROLES,
  CARD_ID_PATTERN,
  normalizeRole,
  deriveIdSlug,
  deriveCardId,
  buildCorpusCard,
  resolveLicense,
  resolveTier,
  validateRegistration,
} from '../lib/corpus-registration.mjs';
import { COMMAND_HELP } from '../lib/command-help.js';

const CLI = fileURLToPath(new URL('../bin/cli.js', import.meta.url));
const SCHEMA = fileURLToPath(new URL('../shared/schemas/corpora-card.schema.json', import.meta.url));

function workdir() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'regid-'));
  fs.mkdirSync(path.join(d, 'data'));
  fs.writeFileSync(path.join(d, 'data', 'test.tsv'),
    'Where does it hurt?\tzub kef\nTake this twice a day.\tmol tav\n');
  return d;
}

/** The persona's own command, plus whatever a test adds. */
function register(cwd, extra = []) {
  return spawnSync(process.execPath, [CLI, 'register-corpus', '--yes', '--json',
    '--name', 'Hospital nurse-checked test', '--pair', 'eng>abc',
    '--publisher', 'Hospital clinical informatics', '--tier', 'local-only',
    '--license', 'proprietary', '--domain', 'medical', ...extra],
  { cwd, encoding: 'utf-8' });
}

function cardsIn(dir) {
  return fs.existsSync(dir)
    ? fs.readdirSync(dir).filter((f) => f.startsWith('eval-') && f.endsWith('.json'))
    : [];
}

describe('id slug comes from the name', () => {
  it('uses --name even when a publisher is given', () => {
    assert.equal(deriveIdSlug({ name: 'Hospital nurse-checked test', publisher: 'Hospital clinical informatics' }),
      'hospital-nurse-checked-test');
  });

  it('falls back to the publisher only when the name has no a-z/0-9 letters, then to custom', () => {
    assert.equal(deriveIdSlug({ name: 'ᓀᐦᐃᔭᐍᐏᐣ', publisher: 'Ward 4 team' }), 'ward-4-team');
    assert.equal(deriveIdSlug({ name: 'ᓀᐦᐃᔭᐍᐏᐣ' }), 'custom');
  });
});

describe('deriveCardId never stamps a role nobody stated', () => {
  it('omits the role segment when no role is given', () => {
    const id = deriveCardId({ source: 'eng', target: 'abc', slug: 'ward-phrases' });
    assert.equal(id, 'eval-eng-abc-ward-phrases-v1');
    assert.doesNotMatch(id, /-(dev|test|train)-v\d+$/);
  });

  it('adds exactly the stated role, once', () => {
    for (const role of CORPUS_ROLES) {
      assert.equal(deriveCardId({ source: 'eng', target: 'abc', slug: 'ward', role }), `eval-eng-abc-ward-${role}-v1`);
    }
    // A name that already ends with the role is not doubled.
    assert.equal(deriveCardId({ source: 'eng', target: 'abc', slug: 'hospital-nurse-checked-test', role: 'test' }),
      'eval-eng-abc-hospital-nurse-checked-test-v1');
  });

  it('refuses a role outside the vocabulary rather than writing it into an id', () => {
    assert.throws(() => deriveCardId({ source: 'eng', target: 'abc', slug: 'x', role: 'holdout' }), /test, dev, train/);
    assert.equal(normalizeRole('  TEST '), 'test');
    assert.equal(normalizeRole(''), null);
    assert.equal(normalizeRole(undefined), null);
  });

  it('every derived id satisfies the corpora-card schema id pattern', () => {
    const schemaPattern = new RegExp(JSON.parse(fs.readFileSync(SCHEMA, 'utf-8')).properties.id.pattern);
    assert.equal(CARD_ID_PATTERN.source, schemaPattern.source, 'CARD_ID_PATTERN mirrors the schema');
    for (const role of [null, ...CORPUS_ROLES]) {
      const id = deriveCardId({ source: 'eng', target: 'abc', slug: deriveIdSlug({ name: 'Ward 4: phrases!' }), role });
      assert.match(id, schemaPattern);
    }
  });

  it('validateRegistration names --role when the role is unknown', () => {
    const v = validateRegistration({
      tier: resolveTier('local-only'), licenseOption: resolveLicense('cc-by-4.0'),
      pair: { source: 'eng', target: 'abc' }, name: 'Set', size: 10, domain: 'medical', role: 'holdout',
    });
    assert.equal(v.ok, false);
    assert.ok(v.errors.some((e) => /--role 'holdout'/.test(e) && /test, dev, train/.test(e)));
  });

  it('a public card names its data file after its id, not after a guessed dev split', () => {
    const card = buildCorpusCard({
      id: 'eval-eng-abc-open-set-v1', name: 'Open set', description: 'd',
      pair: { source: 'eng', target: 'abc' }, publisher: 'P',
      licenseOption: resolveLicense('cc-by-4.0'), tier: resolveTier('public'),
      repoUrl: 'https://example.org/d.tar', builder: 'x', size: 5, domain: 'news', addedAt: '2026-10-03',
    });
    assert.equal(card.dev.dataFile, 'curated/eval-eng-abc-open-set-v1.json');
  });
});

describe('register-corpus command ids (the persona, end to end)', () => {
  it('the persona command yields a name-derived id with no dev stamp', () => {
    const cwd = workdir();
    const r = register(cwd, ['--data', 'data/test.tsv']);
    assert.equal(r.status, 0, r.stderr);
    const out = JSON.parse(r.stdout);
    assert.equal(out.id, 'eval-eng-abc-hospital-nurse-checked-test-v1');
    assert.equal(out.role, null);
    const card = JSON.parse(fs.readFileSync(out.path, 'utf-8'));
    assert.equal(card.id, out.id);
    assert.equal(path.basename(out.path), `${out.id}.json`);
    assert.ok(!out.id.includes('clinical-informatics'), 'not named after the publisher');
    assert.ok(!/-dev-/.test(out.id), 'no role the author never stated');
    assert.equal(card.source.publisher, 'Hospital clinical informatics', 'the publisher is still recorded');
  });

  it('--role puts the stated role in the id and the JSON report', () => {
    const cwd = workdir();
    const r = spawnSync(process.execPath, [CLI, 'register-corpus', '--yes', '--json',
      '--name', 'Ward phrases', '--pair', 'eng>abc', '--tier', 'local-only', '--license', 'proprietary',
      '--domain', 'medical', '--size', '40', '--role', 'test', '--out', cwd], { cwd, encoding: 'utf-8' });
    assert.equal(r.status, 0, r.stderr);
    const out = JSON.parse(r.stdout);
    assert.equal(out.id, 'eval-eng-abc-ward-phrases-test-v1');
    assert.equal(out.role, 'test');
  });

  it('an unknown --role exits 1 and writes nothing', () => {
    const cwd = workdir();
    const r = register(cwd, ['--data', 'data/test.tsv', '--role', 'holdout']);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /Unknown --role 'holdout'/);
    assert.deepEqual(cardsIn(path.join(cwd, 'data')), []);
    assert.ok(!fs.existsSync(path.join(cwd, 'data', 'test.tsv.champollion.json')));
  });

  it('a bare --role (no value) says it needs one', () => {
    const cwd = workdir();
    const r = register(cwd, ['--size', '2', '--out', cwd, '--role']);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /--role needs a value: test, dev, train/);
    assert.deepEqual(cardsIn(cwd), []);
  });

  it('a full --id is used as given; a contradicting --role or a malformed id is refused', () => {
    const cwd = workdir();
    const mismatch = register(cwd, ['--size', '2', '--out', cwd, '--id', 'eval-eng-abc-ward-dev-v1', '--role', 'test']);
    assert.equal(mismatch.status, 1);
    assert.match(mismatch.stderr, /does not name that role/);
    const bad = register(cwd, ['--size', '2', '--out', cwd, '--id', 'eval-Eng Ward']);
    assert.equal(bad.status, 1);
    assert.match(bad.stderr, /not a valid card id/);
    assert.deepEqual(cardsIn(cwd), []);
    const ok = register(cwd, ['--size', '2', '--out', cwd, '--id', 'eval-eng-abc-ward-test-v1', '--role', 'test']);
    assert.equal(ok.status, 0, ok.stderr);
    assert.equal(JSON.parse(ok.stdout).id, 'eval-eng-abc-ward-test-v1');
  });
});

describe('ids already registered are never re-derived', () => {
  const OLD_ID = 'eval-eng-abc-hospital-clinical-informatics-dev-v1';

  function registeredBefore() {
    const cwd = workdir();
    // What the pre-fix CLI wrote next to the file.
    fs.writeFileSync(path.join(cwd, 'data', 'test.tsv.champollion.json'),
      JSON.stringify({ id: OLD_ID, transmission: 'local-only' }, null, 2) + '\n');
    return cwd;
  }

  it('re-registering the same file without --id refuses and names both ids', () => {
    const cwd = registeredBefore();
    const before = fs.readFileSync(path.join(cwd, 'data', 'test.tsv.champollion.json'), 'utf-8');
    const r = register(cwd, ['--data', 'data/test.tsv']);
    assert.equal(r.status, 1);
    assert.match(r.stderr, new RegExp(`already registered as ${OLD_ID}`));
    assert.match(r.stderr, new RegExp(`--id ${OLD_ID}`));
    assert.match(r.stderr, /--id eval-eng-abc-hospital-nurse-checked-test-v1/);
    assert.deepEqual(cardsIn(path.join(cwd, 'data')), [], 'no second card');
    assert.equal(fs.readFileSync(path.join(cwd, 'data', 'test.tsv.champollion.json'), 'utf-8'), before,
      'the sidecar keeps the registered id');
  });

  it('an old-shape id passed with --id is still accepted exactly as given', () => {
    const cwd = registeredBefore();
    const r = register(cwd, ['--data', 'data/test.tsv', '--id', OLD_ID]);
    assert.equal(r.status, 0, r.stderr);
    const out = JSON.parse(r.stdout);
    assert.equal(out.id, OLD_ID);
    const side = JSON.parse(fs.readFileSync(path.join(cwd, 'data', 'test.tsv.champollion.json'), 'utf-8'));
    assert.equal(side.id, OLD_ID);
    assert.equal(side.transmission, 'local-only');
  });
});

describe('help documents --role and the id shape', () => {
  it('command-help lists --role and explains the id', () => {
    const h = COMMAND_HELP['register-corpus'];
    assert.ok(h.options.some(([flag]) => flag.startsWith('--role')));
    const text = h.description.join('\n');
    assert.match(text, /eval-<src>-<tgt>-<name>\[-<role>\]-v1/);
    assert.match(text, /only when you pass --role/);
  });

  it('`register-corpus --help` prints it', () => {
    const r = spawnSync(process.execPath, [CLI, 'register-corpus', '--help'], { encoding: 'utf-8' });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /--role <role>/);
  });
});
