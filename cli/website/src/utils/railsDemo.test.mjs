/**
 * railsDemo.test.mjs — the rails pages show only what the recording holds.
 * Run: node --test cli/website/src/utils/railsDemo.test.mjs (part of
 * `cd cli && npm test` through scripts/test-site-utils.mjs).
 */
import {describe, it} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {facts, chapters, transcript, shellQuote, resolveRef, overlaps, filesAt, ranCommands} from './railsDemo.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(HERE, '..', 'data', 'rails-demo');
const rec = JSON.parse(fs.readFileSync(path.join(DATA, 'recording.json'), 'utf-8'));
const script = JSON.parse(fs.readFileSync(path.join(DATA, 'script.json'), 'utf-8'));
const CLI = fs.readFileSync(path.join(HERE, '..', '..', '..', 'bin', 'cli.js'), 'utf-8');

describe('facts: every number is parsed from what the tools printed', () => {
  const f = facts(rec);

  it('reads each figure the pages quote, and each one appears verbatim in the recording', () => {
    const text = JSON.stringify(rec);
    for (const s of [f.floor, f.devModel, f.testModel]) {
      assert.ok(text.includes(`${s.score.toFixed(2)} [${s.lo.toFixed(2)}, ${s.hi.toFixed(2)}]`), JSON.stringify(s));
    }
    assert.ok(text.includes(`${f.twins.n} of ${f.twins.of} test rows (${f.twins.pct}%)`));
    assert.ok(text.includes(f.prediction.expect));
    assert.ok(text.includes(f.expect));
  });

  it('knows the recorded model is a test double (the page must say so)', () => {
    assert.equal(f.testDouble, true);
  });

  it('carries the warnings the tools printed about the dev set, not just its scores', () => {
    // the count is carried whatever it is — since the dev split grew (plan A1)
    // the recorded walk's dev set has none ("dev: no dev row has a near-twin")
    assert.ok(f.devTwins.n >= 0 && f.devTwins.n <= f.devTwins.of && f.devTwins.of === f.floor.devSentences,
      JSON.stringify(f.devTwins));
    assert.ok(f.smallSample.n < f.smallSample.below, 'the small-sample warning applies');
  });

  it('never ranks two scores whose intervals overlap', () => {
    assert.equal(overlaps({lo: 1, hi: 3}, {lo: 2, hi: 4}), true);
    assert.equal(overlaps({lo: 1, hi: 2}, {lo: 3, hi: 4}), false);
  });

  it('throws — never shows a stale figure — when the recording changes shape', () => {
    const broken = JSON.parse(JSON.stringify(rec));
    for (const s of broken.steps) for (const r of s.ran || []) r.output = r.output.replace(/chrF\+\+ \d/g, 'chrF++ x');
    assert.throws(() => facts(broken), /recording changed shape/);
    assert.throws(() => facts({steps: [], _comment: 'written by hand'}), /not a rails recording/);
  });
});

describe('chapters: commands appear only by reference into the recording', () => {
  const ch = chapters(rec, script);

  it('every chapter resolves, in recording order, and shows something recorded', () => {
    assert.equal(ch.length, script.chapters.length);
    let last = -1;
    for (const c of ch) {
      assert.ok(c.at >= last, c.id);
      last = c.at;
      assert.ok(c.terminal.length > 0, `${c.id} shows nothing recorded`);
    }
  });

  it('the chapter that trains shows the recorded edit that swapped in the stand-in model', () => {
    const train = ch.find((c) => c.id === 'train');
    assert.ok(train.terminal.some((l) => l.kind === 'did' && /backend = dummy/.test(l.text)), 'the stand-in is disclosed where the scores begin');
  });

  it('a matcher that finds nothing throws', () => {
    assert.throws(() => resolveRef(rec, {ran: 'champollion teleport'}), /no step matches/);
    assert.throws(() => chapters(rec, {chapters: [{id: 'x', refs: [{tool: 'nope'}], lines: []}]}), /no step matches/);
  });

  it('every shown command is in the recording, and every champollion command is one the CLI has', () => {
    const recorded = new Set(ranCommands(rec).map((r) => shellQuote(r.command)));
    for (const c of ch) {
      for (const l of c.terminal.filter((x) => x.kind === 'cmd')) {
        assert.ok(recorded.has(l.text), l.text);
        const m = /^champollion ([a-z-]+)/.exec(l.text);
        if (m) assert.match(CLI, new RegExp(`\\b${m[1]}:\\s+\\(\\) => import\\(`), l.text);
      }
    }
  });

  it('the people\'s answers come from the recording, not from the script', () => {
    const byId = Object.fromEntries(ch.map((c) => [c.id, c]));
    assert.equal(byId.protect.answers.transmission, 'local-only');
    assert.equal(byId.predict.answers.expect, facts(rec).prediction.expect);
    assert.equal(byId.judge.answers.by, 'Grandpa');
    for (const c of script.chapters) {
      for (const l of c.lines) {
        assert.doesNotMatch(l.text, /\d+\.\d+|chrF/, `written line ${l.id} carries a number or a score — those come from the recording`);
        assert.ok(l.id.startsWith('rails.demo.'), l.id);
        assert.ok(['person', 'agent'].includes(l.who), l.id);
      }
    }
  });

  it('a file is locked from the moment it arrives (the project default), and marked when its holders decide', () => {
    const gather = ch.find((c) => c.id === 'gather');
    assert.ok(gather.files.every((f) => f.lock === 'default'));
    const decided = ch.find((c) => c.id === 'protect');
    assert.ok(decided.files.every((f) => f.lock === 'decided'));
    assert.ok(filesAt(rec, rec.steps.length - 1).find((f) => f.path === 'data/test/checked.tsv').counted);
  });
});

describe('shellQuote: a shown command can be pasted', () => {
  it('quotes a flag value of several words', () => {
    assert.equal(shellQuote('champollion data mark a.tsv --owner the family --training allowed --local-only'),
      'champollion data mark a.tsv --owner "the family" --training allowed --local-only');
  });
  it('leaves one-word values and positionals alone, and escapes what a shell would expand', () => {
    assert.equal(shellQuote('nmt-forge run config.json --detach'), 'nmt-forge run config.json --detach');
    assert.equal(shellQuote('x --expect a $b'), 'x --expect "a \\$b"');
  });
});

describe('transcript: the no-JS reader gets every step in full', () => {
  it('has one entry per recorded step and never clips an output', () => {
    const t = transcript(rec);
    assert.equal(t.length, rec.steps.length);
    for (const e of t) assert.doesNotMatch(e.text, /more line\(s\) in the transcript/);
  });
});
