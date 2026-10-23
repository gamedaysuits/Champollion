/**
 * json-repair.test.js — unescaped-quote repair for model JSON output.
 *
 * Regression suite for the parse-bomb bug: models translating strings that
 * contain typographic quotes (e.g. `never “not a language.”`) often emit
 * unescaped ASCII quotes inside the JSON string value:
 *
 *   "homepage.rosetta.quote.text": "尚未服务 — 但绝不是"非语言"。",
 *
 * JSON.parse dies at the inner quote. At temperature 0 the retry cascade
 * re-sends the same prompt and receives byte-identical output, so the whole
 * batch — including keys that translated fine — exhausts its retry budget
 * and is dropped. repairUnescapedQuotes() recovers the response instead.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { repairUnescapedQuotes, extractByExpectedKeys } from '../lib/methods/openrouter-client.js';

test('repairUnescapedQuotes: repairs the observed zh parse-bomb response', () => {
  // Byte-for-byte shape of the response captured from claude-haiku-4.5
  // translating the homepage quote batch (2026-07-05 repro).
  const raw = `{
  "homepage.rosetta.glossary.more": "127 个术语，用简洁的语言 →",
  "homepage.rosetta.quote.text": "尚未服务 — 但绝不是"非语言"。",
  "homepage.rosetta.quote.link": "这里如何定义语言？"
}`;
  assert.throws(() => JSON.parse(raw)); // the bug: unparseable as-is

  const parsed = JSON.parse(repairUnescapedQuotes(raw));
  assert.equal(parsed['homepage.rosetta.quote.text'], '尚未服务 — 但绝不是"非语言"。');
  assert.equal(parsed['homepage.rosetta.quote.link'], '这里如何定义语言？');
});

test('repairUnescapedQuotes: leaves already-escaped quotes untouched', () => {
  const raw = '{"k": "he said \\"yes\\" loudly"}';
  const parsed = JSON.parse(repairUnescapedQuotes(raw));
  assert.equal(parsed.k, 'he said "yes" loudly');
});

test('repairUnescapedQuotes: leaves valid JSON semantics intact', () => {
  const raw = '{"a": "plain", "b": "with — dash", "c": "curly “quotes” fine"}';
  const parsed = JSON.parse(repairUnescapedQuotes(raw));
  assert.deepEqual(parsed, { a: 'plain', b: 'with — dash', c: 'curly “quotes” fine' });
});

test('repairUnescapedQuotes: repairs multiple inner quotes in one value', () => {
  const raw = '{"k": "the "first" and "second" words"}';
  const parsed = JSON.parse(repairUnescapedQuotes(raw));
  assert.equal(parsed.k, 'the "first" and "second" words');
});

test('repairUnescapedQuotes: known limit — inner quote directly before a comma still fails', () => {
  // The heuristic reads `"` + `,` as a string terminator, so this stays
  // broken and the caller falls back to the retry cascade — documented
  // trade-off, never worse than pre-repair behaviour.
  const raw = '{"k": "he said "yes", loudly", "j": "x"}';
  assert.throws(() => JSON.parse(repairUnescapedQuotes(raw)));
});

// -----------------------------------------------------------------
// extractByExpectedKeys — key-anchored recovery (last tier)
// -----------------------------------------------------------------

test('extractByExpectedKeys: recovers the inner-quote-before-comma case the repair heuristic cannot', () => {
  // Shape observed in the nl batch (2026-07-05): quote damage where the
  // stray quote sits directly before a comma, so repairUnescapedQuotes
  // reads it as a string terminator.
  const raw = '{"k": "hij zei "geen taal", nooit", "j": "prima"}';
  assert.throws(() => JSON.parse(raw));
  assert.throws(() => JSON.parse(repairUnescapedQuotes(raw)));

  const recovered = extractByExpectedKeys(raw, new Set(['k', 'j']));
  assert.deepEqual(recovered, { k: 'hij zei "geen taal", nooit', j: 'prima' });
});

test('extractByExpectedKeys: recovers the observed zh parse-bomb response', () => {
  const raw = `{
  "homepage.rosetta.quote.text": "尚未服务 — 但绝不是"非语言"。",
  "homepage.rosetta.quote.link": "这里如何定义语言？"
}`;
  const recovered = extractByExpectedKeys(
    raw,
    new Set(['homepage.rosetta.quote.text', 'homepage.rosetta.quote.link'])
  );
  assert.equal(recovered['homepage.rosetta.quote.text'], '尚未服务 — 但绝不是"非语言"。');
  assert.equal(recovered['homepage.rosetta.quote.link'], '这里如何定义语言？');
});

test('extractByExpectedKeys: decodes escape sequences and already-escaped quotes', () => {
  const raw = '{"k": "line one\\nhe said \\"yes\\" — done"}';
  const recovered = extractByExpectedKeys(raw, new Set(['k']));
  assert.equal(recovered.k, 'line one\nhe said "yes" — done');
});

test('extractByExpectedKeys: returns null when no expected key anchors in the text', () => {
  assert.equal(extractByExpectedKeys('total garbage', new Set(['k'])), null);
  assert.equal(extractByExpectedKeys('{"other": "x"}', new Set(['k'])), null);
  assert.equal(extractByExpectedKeys('{"k": "x"}', new Set()), null);
});

test('extractByExpectedKeys: skips non-string values without dying', () => {
  const raw = '{"k": 42, "j": "fine"}';
  const recovered = extractByExpectedKeys(raw, new Set(['k', 'j']));
  assert.deepEqual(recovered, { j: 'fine' });
});
