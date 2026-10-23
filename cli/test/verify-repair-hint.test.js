/**
 * verify names the command that repairs a damaged value.
 *
 * THE FINDING (synthetic Django and i18next developers, 2026-10): `verify`
 * reported "1 placeholder mismatch(es): greeting" and stopped there. A plain
 * `champollion sync` does not repair it — the value is on disk and its lock
 * hash reads as settled — so the user had no way forward from the report.
 * Every damage finding now carries the exact `sync --redo keys:` command
 * (pair-scoped; `<ns>::<key>` in a namespaced layout; `\,` for a comma in a
 * key), and the run says whether `--fresh` is needed (it is not: verify has
 * evicted every cached copy of the damaged value).
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { METHOD_REGISTRY } from '../lib/translate.js';
import { TranslationMethod } from '../lib/methods/base.js';
import { loadTM, saveTM, storeTM, lookupTM, tmMethodKey } from '../lib/tm.js';
import { runSync } from '../lib/sync.js';
import { resolveConfig } from '../lib/config.js';
import { resolvePairs } from '../lib/pairs.js';
import { verifyLocales, redoCommand } from '../lib/verify.js';
import { applyRedo, splitKeyList } from '../lib/redo.js';
import { keysForNamespace } from '../lib/locale-layout.js';
import { output } from '../lib/output.js';

const GOOD = { greeting: 'Bonjour {{name}}', bye: 'Au revoir' };
const DAMAGED = 'Bonjour {{nom}}';

class ScriptedRepair extends TranslationMethod {
  constructor() { super('test-verify-repair'); }
  async translate(keys, sourceFlat, pairConfig) {
    ScriptedRepair.calls.push([...keys]);
    return Object.fromEntries(keys.map((k) => [k, ScriptedRepair.answers[k]]));
  }
}
ScriptedRepair.calls = [];
ScriptedRepair.answers = { ...GOOD };
METHOD_REGISTRY['test-verify-repair'] = ScriptedRepair;

describe('verify: every damage finding names the repair, and whether --fresh is needed', () => {
  let dir;
  let lines;
  const saved = {};

  const readFr = () => JSON.parse(fs.readFileSync(path.join(dir, 'locales', 'fr.json'), 'utf-8'));
  const writeFr = (data) => fs.writeFileSync(path.join(dir, 'locales', 'fr.json'), JSON.stringify(data, null, 2));
  const pairKey = () => tmMethodKey(resolvePairs(resolveConfig({}, dir)).get('en:fr'));

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'verify-repair-'));
    fs.mkdirSync(path.join(dir, 'locales'));
    fs.writeFileSync(path.join(dir, 'locales', 'en.json'), JSON.stringify({ greeting: 'Hello {{name}}', bye: 'Goodbye' }));
    fs.writeFileSync(path.join(dir, 'champollion.config.json'), JSON.stringify({
      inputLocale: 'en', localesDir: './locales', defaultMethod: 'test-verify-repair', languages: ['fr'],
    }));
    ScriptedRepair.calls = [];
    ScriptedRepair.answers = { ...GOOD };
    lines = [];
    saved.log = console.log;
    saved.error = console.error;
    saved.write = process.stdout.write.bind(process.stdout);
    console.log = (...a) => lines.push(a.join(' '));
    console.error = (...a) => lines.push(a.join(' '));
    process.stdout.write = () => true;
    output.setMode('default');
  });

  afterEach(() => {
    console.log = saved.log;
    console.error = saved.error;
    process.stdout.write = saved.write;
    fs.rmSync(dir, { recursive: true, force: true });
  });

  /** An earlier run wrote AND cached a value that lost its placeholder. */
  async function seedCachedDamage() {
    await runSync({ cwd: dir, cliArgs: {} });
    writeFr({ ...readFr(), greeting: DAMAGED });
    const tm = loadTM(dir);
    storeTM(tm, 'Hello {{name}}', 'fr', pairKey(), DAMAGED);
    saveTM(dir, tm);
    lines.length = 0;
  }

  it('a placeholder mismatch names `sync --pair en:fr --redo keys:greeting`; the cached copy is evicted, no --fresh', async () => {
    await seedCachedDamage();
    const v = await verifyLocales(resolveConfig({}, dir), dir);
    assert.ok(v.errors >= 1);
    assert.equal(v.tmEvicted, 1);
    const finding = lines.find((l) => /placeholder mismatch/.test(l));
    assert.ok(finding, lines.join('\n'));
    // Named by its syntax since Round 12 (i18next {{…}}), with what changed.
    assert.match(finding, /1 i18next \{\{…\}\} placeholder mismatch\(es\): greeting \(placeholder \{\{name\}\} was changed to \{\{nom\}\}\) — fix: `champollion sync --pair en:fr --redo keys:greeting`/);
    assert.ok(lines.some((l) => /no `--fresh` needed, the cache can no longer serve the damaged text/.test(l)), lines.join('\n'));
    assert.equal(lookupTM(loadTM(dir), 'Hello {{name}}', 'fr', pairKey()), null, 'the damaged copy left the cache');
  });

  it('a plain sync keeps the damage; the named command repairs it without --fresh', async () => {
    await seedCachedDamage();
    await verifyLocales(resolveConfig({}, dir), dir);

    await runSync({ cwd: dir, cliArgs: {} });
    assert.equal(readFr().greeting, DAMAGED, 'a plain sync leaves a value already on disk alone');

    ScriptedRepair.calls = [];
    const args = { redo: 'keys:greeting', pair: 'en:fr' };
    assert.equal(applyRedo(args), null);
    assert.equal(args['no-tm'], undefined, 'no --fresh in the named command');
    const r = await runSync({ cwd: dir, cliArgs: args });
    assert.equal(r.verifyErrors, 0);
    assert.deepEqual(ScriptedRepair.calls, [['greeting']], 'the method is asked again — the damage is not re-served');
    assert.equal(readFr().greeting, GOOD.greeting);
  });

  it('a hand-edited damaged value: the same command, and the run says the cache never held it', async () => {
    await runSync({ cwd: dir, cliArgs: {} });
    writeFr({ ...readFr(), greeting: DAMAGED });
    lines.length = 0;
    const v = await verifyLocales(resolveConfig({}, dir), dir);
    assert.equal(v.tmEvicted, undefined);
    assert.ok(lines.some((l) => /fix: `champollion sync --pair en:fr --redo keys:greeting`/.test(l)), lines.join('\n'));
    assert.ok(lines.some((l) => /No `--fresh` needed — none of the damaged values is in this project's translation cache/.test(l)),
      lines.join('\n'));
    // The cache's own (good) translation of the text is what the redo serves.
    const args = { redo: 'keys:greeting', pair: 'en:fr' };
    applyRedo(args);
    ScriptedRepair.calls = [];
    await runSync({ cwd: dir, cliArgs: args });
    assert.equal(readFr().greeting, GOOD.greeting);
    assert.deepEqual(ScriptedRepair.calls, [], 'served from the cache for free');
  });

  it('a healthy locale prints no repair advice', async () => {
    await runSync({ cwd: dir, cliArgs: {} });
    lines.length = 0;
    await verifyLocales(resolveConfig({}, dir), dir);
    assert.ok(!lines.some((l) => /--redo|--fresh/.test(l)), lines.join('\n'));
  });
});

describe('redoCommand — a command a shell and --redo both read back exactly', () => {
  it('namespaced keys, commas inside keys, gettext contexts', () => {
    assert.equal(redoCommand(['nav.home'], { pair: 'en:de', ns: 'common' }), 'champollion sync --pair en:de --redo keys:common::nav.home');
    const cmd = redoCommand(['Welcome back, %(name)s!', 'verb\u0004Open'], { pair: 'en:fr', ns: 'django' });
    // The context separator is written ␄, as reports and the docs show it,
    // and a shell comment names the typeable `\x04` (Round 7: both spellings
    // work — lib/locale-layout.js — and the suggestion says so).
    assert.equal(cmd, "champollion sync --pair en:fr --redo 'keys:django::Welcome back\\, %(name)s!,django::verb␄Open'  # type ␄ as \\x04 if you cannot (both work)");
    // What the shell hands --redo (the comment is not an argument), split as --redo splits it.
    const arg = cmd.slice(cmd.indexOf("'") + 1, cmd.lastIndexOf("'")).slice('keys:'.length);
    assert.deepEqual(splitKeyList(arg), ['django::Welcome back, %(name)s!', 'django::verb␄Open']);
    assert.deepEqual(keysForNamespace({ namespaced: true }, splitKeyList(arg), 'django'), ['Welcome back, %(name)s!', 'verb\u0004Open']);
    assert.equal(redoCommand(["it's"]), "champollion sync --redo 'keys:it'\\''s'");
  });
});
