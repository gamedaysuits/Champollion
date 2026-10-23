/**
 * harness-fst — asking the installed harness which FSTs it can use.
 *
 * Pinned: the interpreter comes from the `mt-eval` launcher run_benchmark
 * spawns; no harness / no answer is "cannot tell", never "no pin"; local paths
 * never reach the agent; the card fact and the harness capability stay apart.
 * Unit tests inject everything; one test asks this checkout's real harness
 * (local cards, no network) and checks it against the real pins file.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  interpreterFromLauncher, probeHarnessFst, formatFstLines, AUTO_INSTALL_FORMATS,
} from '../src/tools/harness-fst.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ARENA = resolve(HERE, '../../arena');
const PINS_FILE = resolve(ARENA, 'mt_eval_harness/data/fst-pins.json');

const SENTINEL = 'CHAMPOLLION_FST_PROBE ';
const answer = (doc) => ({ code: 0, stdout: `harness chatter\n${SENTINEL}${JSON.stringify(doc)}\n`, stderr: '' });

describe('interpreterFromLauncher', () => {
  it('reads an absolute python shebang, keeping its flags', () => {
    assert.deepEqual(interpreterFromLauncher('#!/opt/homebrew/opt/python@3.14/bin/python3.14\nimport sys\n'),
      { cmd: '/opt/homebrew/opt/python@3.14/bin/python3.14', args: [] });
    assert.deepEqual(interpreterFromLauncher('#!/venv/bin/python -I\n'), { cmd: '/venv/bin/python', args: ['-I'] });
  });
  it('follows /usr/bin/env', () => {
    assert.deepEqual(interpreterFromLauncher('#!/usr/bin/env python3\n'), { cmd: 'python3', args: [] });
    assert.deepEqual(interpreterFromLauncher('#!/usr/bin/env -S python3.12\n'), { cmd: 'python3.12', args: [] });
  });
  it("reads pip's /bin/sh launcher (interpreter path with spaces)", () => {
    const head = "#!/bin/sh\n'''exec' \"/Users/x/my venv/bin/python\" \"$0\" \"$@\"\n' '''\n";
    assert.deepEqual(interpreterFromLauncher(head), { cmd: '/Users/x/my venv/bin/python', args: [] });
    assert.deepEqual(interpreterFromLauncher("#!/bin/sh\n'''exec' '/a b/python' \"$0\" \"$@\"\n"), { cmd: '/a b/python', args: [] });
  });
  it('cannot tell from a binary launcher or a non-python script', () => {
    assert.equal(interpreterFromLauncher('MZ\u0090\u0000binary'), null);
    assert.equal(interpreterFromLauncher('#!/usr/bin/perl\n'), null);
    assert.equal(interpreterFromLauncher(''), null);
  });
});

describe('probeHarnessFst', () => {
  const noRun = async () => { throw new Error('must not spawn'); };

  it('no `mt-eval` on PATH → not-installed, nothing spawned', async () => {
    const r = await probeHarnessFst(['kal'], { env: {}, which: () => null, run: noRun });
    assert.equal(r.status, 'not-installed');
  });

  it('runs the launcher\'s Python with the codes after the script, same env, bounded', async () => {
    let call;
    const env = { PATH: '/x', PYTHONPATH: '/repo/arena', MT_EVAL_FST_PINS: '' };
    const r = await probeHarnessFst(['kal', 'crk'], {
      env,
      which: (cmd) => (cmd === 'mt-eval' ? '/venv/bin/mt-eval' : null),
      readLauncher: () => '#!/venv/bin/python3\nfrom mt_eval_harness.cli import main\n',
      run: async (cmd, args, opts) => {
        call = { cmd, args, opts };
        return answer({ version: '0.2.0', pinsShipped: true, pinsOverride: false, pyhfst: false,
          langs: { kal: { pin: null, installed: false, stale: false, evalPackFst: false } } });
      },
      timeoutMs: 1234,
    });
    assert.equal(call.cmd, '/venv/bin/python3');
    assert.equal(call.args[0], '-c');
    assert.deepEqual(call.args.slice(2), ['kal', 'crk']);
    assert.equal(call.opts.env, env);
    assert.equal(call.opts.timeout, 1234);
    assert.equal(r.status, 'ok');
    assert.equal(r.version, '0.2.0');
    assert.equal(r.pyhfst, false);
    assert.equal(r.langs.kal.pin, null);
    assert.match(r.how, /`mt-eval` on PATH/);
    assert.doesNotMatch(r.how, /\/venv/, 'no local path in what the agent sees');
  });

  it('drops anything that is not a language code before it reaches argv', async () => {
    let argv;
    await probeHarnessFst(['kal', '--evil', 'a b', 'fra-CA'], {
      python: { cmd: 'python3', args: [] },
      run: async (cmd, args) => { argv = args; return answer({ langs: {} }); },
    });
    assert.deepEqual(argv.slice(2), ['kal', 'fra-CA']);
  });

  it('an unreadable launcher with no PYTHON_BIN is an error, not a guess', async () => {
    const r = await probeHarnessFst(['kal'], {
      env: {}, which: () => 'C:/py/Scripts/mt-eval.exe', readLauncher: () => 'MZ\u0090', run: noRun,
    });
    assert.equal(r.status, 'error');
    assert.match(r.error, /could not tell which Python `mt-eval` runs/);
  });

  it('timeouts, crashes and harness-reported errors come back as errors, local paths stripped', async () => {
    const base = { python: { cmd: 'python3', args: [] }, timeoutMs: 5000 };
    const slow = await probeHarnessFst(['kal'], { ...base, run: async () => ({ code: null, stdout: '', stderr: '', timedOut: true }) });
    assert.match(slow.error, /did not answer within 5s/);
    const crash = await probeHarnessFst(['kal'], { ...base,
      run: async () => ({ code: 1, stdout: '', stderr: 'Traceback\n  File "/Users/jane/venv/lib/x.py"\nImportError: no module at /Users/jane/venv/lib/site' }) });
    assert.equal(crash.status, 'error');
    assert.doesNotMatch(crash.error, /\/Users\/jane/);
    const said = await probeHarnessFst(['kal'], { ...base,
      run: async () => answer({ error: 'the harness could not read its FST pins: Cannot read the FST pins at /Users/jane/pins.json' }) });
    assert.equal(said.status, 'error');
    assert.match(said.error, /could not read its FST pins/);
    assert.doesNotMatch(said.error, /\/Users\/jane/);
    const missing = await probeHarnessFst(['kal'], { ...base, run: async () => ({ code: null, stdout: '', stderr: '', spawnError: 'spawn python3 ENOENT' }) });
    assert.match(missing.error, /could not start the harness's Python/);
  });

  // The real harness of this checkout, through the real interpreter, local
  // cards only. Skips when the checkout or its Python deps are not here.
  it('this checkout\'s harness: kal has no pin, crk has the pinned giellalt build', async (t) => {
    if (!existsSync(PINS_FILE)) { t.skip('no arena/ checkout beside the MCP server'); return; }
    const pins = JSON.parse(readFileSync(PINS_FILE, 'utf8')).pins;
    assert.ok(pins.crk && !pins.kal, 'precondition: the real pins file pins crk and not kal');
    const env = { ...process.env, PYTHONPATH: ARENA };
    delete env.MT_EVAL_FST_PINS;
    const r = await probeHarnessFst(['kal', 'crk'], { env, python: { cmd: env.PYTHON_BIN || 'python3', args: [] } });
    if (r.status !== 'ok') { t.skip(`the harness is not importable here (${r.error || r.status})`); return; }
    assert.equal(r.pinsShipped, true);
    assert.equal(r.langs.kal.pin, null);
    assert.equal(r.langs.crk.pin.repo, pins.crk.install.repo);
    assert.equal(r.langs.crk.pin.format, pins.crk.install.format);
    assert.equal(r.langs.crk.pin.langCommit, pins.crk.install.langCommit);
    assert.ok(AUTO_INSTALL_FORMATS.has(r.langs.crk.pin.format), 'the crk pin downloads by itself');
  });
});

describe('formatFstLines', () => {
  const KAL_FST = [{ name: 'lang-kal', url: 'https://github.com/giellalt/lang-kal', publisher: 'giellalt' }];
  const ok = (langs, extra = {}) => ({ ok: true, value: {
    status: 'ok', how: 'x', version: '0.2.0', pinsShipped: true, pinsOverride: false, pyhfst: true, langs, ...extra } });

  it('no FST on the card and no pin → nothing to add', () => {
    assert.deepEqual(formatFstLines('eng', [], ok({ eng: { pin: null } })), []);
    assert.deepEqual(formatFstLines('eng', [], { ok: true, value: { status: 'not-installed', how: 'x' } }), []);
  });

  it('a pin the card does not list is still reported, as the harness\'s', () => {
    const [line] = formatFstLines('fin', [], ok({ fin: { pin: { repo: 'giellalt/lang-fin', format: 'giellalt-nightly-apt' }, installed: false, evalPackFst: false } }));
    assert.match(line, /the card lists none, but the harness here \(mt-eval-harness 0\.2\.0\) pins one for fin — the harness pins this build \(giellalt\/lang-fin\); not installed here — nothing downloads by itself: `mt-eval setup --lang fin` installs it/);
  });

  it('a pinned build the card lists under another repo gets its own harness line', () => {
    const lines = formatFstLines('xyz', KAL_FST, ok({ xyz: { pin: { repo: 'other/lang-xyz', format: 'legacy-zip' }, installed: false } }));
    assert.match(lines[1], /recorded on the card; not the build the harness pins for xyz \(other\/lang-xyz\)/);
    assert.match(lines[2], /harness pin for xyz, not among the card's entries: the harness pins this build \(other\/lang-xyz\)/);
  });

  it('a pin in a format the harness cannot download says so; missing pyhfst names the runtime command', () => {
    const fst = [{ name: 'lang-nob', url: 'https://github.com/giellalt/lang-nob', publisher: 'giellalt' }];
    const [, line] = formatFstLines('nob', fst, ok({ nob: { pin: { repo: 'giellalt/lang-nob', format: 'divvun' }, installed: false, evalPackFst: false } }, { pyhfst: false }));
    assert.match(line, /the harness pins it \(giellalt\/lang-nob\), but its "divvun" format cannot be downloaded automatically — until it is installed by hand, FST metrics will not run/);
    assert.match(line, /The FST runtime \(pyhfst\) is not installed: `mt-eval setup --fst`\./);
  });

  it('an old harness without shipped pins is told how to get them', () => {
    const [, line] = formatFstLines('kal', KAL_FST, ok({ kal: { pin: null } }, { version: '0.1.0', pinsShipped: false }));
    assert.match(line, /has no pin for kal yet — it cannot download or load it, so FST metrics will not run for this language\. \(This harness predates the FST pins that ship inside it — `python3 -m pip install -U mt-eval-harness`, then re-check\.\)/);
  });

  it('MT_EVAL_FST_PINS in effect is named', () => {
    const [head] = formatFstLines('kal', KAL_FST, ok({ kal: { pin: null } }, { pinsOverride: true }));
    assert.match(head, /mt-eval-harness 0\.2\.0, pins from MT_EVAL_FST_PINS/);
  });
});
