/**
 * reference-cli-parity.test.js — every champollion command is in the CLI
 * reference.
 *
 * cli/website/docs/reference/cli.md is hand-written. It fell behind the CLI
 * once already: every rails command (new, next, data, improve, validate,
 * upgrade, connect) and doctor were missing from it, and it gave the default
 * temperature as 0.3 when the one default is 0. This test holds it to the two
 * lists the CLI itself routes and documents:
 *
 *   - every top-level command routed in cli/bin/cli.js (`const commands`), and
 *   - every COMMAND_HELP key (cli/lib/command-help.js — `champollion <cmd> --help`)
 *
 * must appear in the reference as a heading (`## new`, `### data add`) or as an
 * inline code span naming it (`serve`, `champollion network recommend`).
 * Fenced code blocks do not count: a command listed only in the overview
 * block has no entry of its own.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { COMMAND_HELP } from '../lib/command-help.js';
import { DEFAULT_TEMPERATURE } from '../lib/config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI_JS = path.resolve(__dirname, '..', 'bin', 'cli.js');
const REFERENCE = path.resolve(__dirname, '..', 'website', 'docs', 'reference', 'cli.md');

/** The command names cli.js routes (the keys of `const commands = { … }`). */
function routedCommands() {
  const src = fs.readFileSync(CLI_JS, 'utf8');
  const start = src.indexOf('const commands = {');
  assert.ok(start >= 0, 'cli.js has no `const commands = {` routing map');
  const block = src.slice(start + 'const commands = {'.length, src.indexOf('};', start));
  return [...block.matchAll(/^\s*'?([a-z][\w-]*)'?\s*:/gm)].map((m) => m[1]);
}

/** Headings and inline code spans of the reference, fenced blocks left out. */
function referenceNames() {
  const md = fs.readFileSync(REFERENCE, 'utf8').replace(/^(```|~~~)[\s\S]*?^\1\s*$/gm, '');
  const headings = [...md.matchAll(/^#{2,6} (.+)$/gm)]
    .map((m) => m[1].replace(/\{#[^}]*\}/, '').replace(/`/g, '').trim());
  const spans = [...md.matchAll(/`([^`\n]+)`/g)].map((m) => m[1].trim());
  // "champollion network card <code>" → "card <code>"; "npx champollion sync" → "sync"
  const norm = (s) => s.replace(/^(npx )?champollion /, '').replace(/^network (?=\S)/, '');
  return { headings: headings.map(norm), spans: spans.map(norm) };
}

const names = (s) => new RegExp(`^${s.replace(/[-]/g, '\\-')}(\\s|$)`);

describe('reference/cli.md names every champollion command', () => {
  const routed = routedCommands();
  const { headings, spans } = referenceNames();

  it('the routing map is read (sanity: it has the commands we know)', () => {
    for (const c of ['sync', 'init', 'new', 'next', 'data', 'improve', 'validate', 'upgrade', 'connect', 'doctor']) {
      assert.ok(routed.includes(c), `cli.js routes ${c}`);
    }
  });

  it('every routed command and every COMMAND_HELP key appears as a heading or a code span', () => {
    const all = [...new Set([...routed, ...Object.keys(COMMAND_HELP)])];
    const missing = all.filter((c) => !headings.some((h) => names(c).test(h)) && !spans.some((s) => names(c).test(s)));
    assert.deepEqual(missing, [], `missing from reference/cli.md: ${missing.join(', ')}`);
  });

  it('every rails command and doctor has a section of its own', () => {
    for (const c of ['new', 'next', 'data', 'data add', 'data mark', 'data combine', 'improve', 'validate',
      'upgrade', 'connect', 'doctor']) {
      assert.ok(headings.includes(c), `no heading for ${c}`);
    }
  });

  it('every improve subcommand the command accepts is documented', async () => {
    const src = fs.readFileSync(path.resolve(__dirname, '..', 'lib', 'commands', 'improve.js'), 'utf8');
    const subs = /const cmds = \{([^}]*)\}/.exec(src)[1].split(',').map((s) => s.trim()).filter(Boolean);
    assert.ok(subs.length >= 7, `improve.js routes ${subs.join(', ')}`);
    const md = fs.readFileSync(REFERENCE, 'utf8');
    const help = COMMAND_HELP.improve.subcommands.map(([n]) => n);
    for (const s of subs) {
      assert.ok(md.includes(`| \`${s}\` |`), `reference: improve ${s}`);
      assert.ok(help.includes(s), `COMMAND_HELP.improve: ${s}`);
    }
  });

  it('states the real default temperature', () => {
    const md = fs.readFileSync(REFERENCE, 'utf8');
    const line = md.split('\n').find((l) => l.startsWith('--temperature'));
    assert.ok(line, 'the --temperature option is listed');
    assert.match(line, new RegExp(`default: ${DEFAULT_TEMPERATURE}\\b`));
    assert.doesNotMatch(md, /temperature[^\n]*default: 0\.3/);
  });
});
