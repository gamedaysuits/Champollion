/**
 * Round 12: every command's `--help` heading is a complete sentence.
 *
 * showCommandHelp printed the FIRST LINE of each description as the heading,
 * so nine headings stopped mid-sentence ("champollion serve — Serves this
 * project's OWN configured translation stack (method,"): serve, watch, audit,
 * seal-corpus, lint, wrap, plugin, fonts, recommend. The heading is now the
 * command's `summary`, or the first sentence of its description.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { COMMAND_HELP, showCommandHelp, helpHeading } from '../lib/command-help.js';

const CLI = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'bin', 'cli.js');

/** The heading line showCommandHelp prints for a command. */
function printedHeading(name) {
  const lines = [];
  const log = console.log;
  console.log = (...a) => lines.push(a.join(' '));
  try { showCommandHelp(name); } finally { console.log = log; }
  const line = lines.find((l) => l.startsWith(`  champollion ${name} — `));
  return line ? line.slice(`  champollion ${name} — `.length) : null;
}

/** A complete sentence: a capital first, closed parentheses and quotes, a final . ! or ?. */
function assertSentence(name, heading) {
  assert.ok(heading, `${name}: no heading printed`);
  assert.match(heading, /^[A-Z]/, `${name}: "${heading}" does not start a sentence`);
  assert.match(heading, /[.!?]$/, `${name}: "${heading}" stops mid-sentence`);
  assert.doesNotMatch(heading, /[,:(—–-]\s*[.!?]?$/, `${name}: "${heading}" ends on a lead-in`);
  const opened = (heading.match(/\(/g) || []).length;
  const closed = (heading.match(/\)/g) || []).length;
  assert.equal(opened, closed, `${name}: "${heading}" leaves a parenthesis open`);
  assert.equal((heading.match(/`/g) || []).length % 2, 0, `${name}: "${heading}" leaves a code span open`);
}

describe('Round 12 — 13: every --help heading is a complete sentence', () => {
  for (const name of Object.keys(COMMAND_HELP)) {
    it(`${name}`, () => {
      const heading = printedHeading(name);
      assert.equal(heading, helpHeading(COMMAND_HELP[name]));
      assertSentence(name, heading);
    });
  }

  it('the nine that were cut off say their whole first thought', () => {
    const expected = {
      watch: 'Starts a file watcher that auto-syncs when the source locale file changes.',
      lint: 'Scans source files for hardcoded user-facing strings that should be wrapped in t() calls.',
      wrap: 'Auto-wraps hardcoded strings in t() calls.',
      plugin: 'Manages method plugins — installable translation strategies that bundle model config, coaching data, and benchmarks.',
      fonts: 'Downloads and manages PUA web fonts for constructed language script converters.',
    };
    for (const [name, heading] of Object.entries(expected)) assert.equal(printedHeading(name), heading);
    for (const name of ['serve', 'audit', 'seal-corpus', 'recommend']) {
      assert.equal(printedHeading(name), COMMAND_HELP[name].summary, `${name}: its one-line summary`);
    }
  });

  it('the first sentence: not inside parentheses, not after "e.g.", across the first paragraph only', () => {
    assert.equal(helpHeading({ description: ['Does a thing (it asks: ready?', 'yes) and stops. More text.'] }),
      'Does a thing (it asks: ready? yes) and stops.');
    assert.equal(helpHeading({ description: ['Runs engines, e.g. DeepL and', 'Google. Then more.'] }),
      'Runs engines, e.g. DeepL and Google.');
    assert.equal(helpHeading({ description: ['Manages the cache (.champollion/tm.json).'] }),
      'Manages the cache (.champollion/tm.json).');
    assert.equal(helpHeading({ summary: '  A summary wins.  ', description: ['Ignored first line,'] }), 'A summary wins.');
  });

  it('the real CLI prints it: `champollion serve --help`, `champollion recommend --help`', () => {
    for (const name of ['serve', 'recommend', 'watch']) {
      const out = execFileSync(process.execPath, [CLI, name, '--help'], { encoding: 'utf8', env: { ...process.env, CHAMPOLLION_NO_UPDATE_CHECK: '1' } });
      assert.ok(out.includes(`champollion ${name} — ${helpHeading(COMMAND_HELP[name])}`), out.split('\n').slice(0, 3).join('\n'));
    }
  });
});
