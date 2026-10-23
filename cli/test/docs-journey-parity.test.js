/**
 * The people's docs tell the journey in plain words, but its stages are data:
 * shared/journeys/language.json is what `champollion next` walks. "How it
 * works" lists the stages by hand (so the docs sync can translate them), and
 * this test keeps that list in step with the data — same stages, same order —
 * so the page can never describe a journey the rails do not walk.
 *
 * The people's pages say "translator" where the rails say "model", and "test"
 * where they say "prove" (a test score is not a proof); those two words are
 * the only differences allowed.
 */
const PLAIN = [[/\bmodel\b/, 'translator'], [/\bprove\b/, 'test']];
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const journey = JSON.parse(fs.readFileSync(path.join(REPO, 'shared/journeys/language.json'), 'utf8'));
const page = fs.readFileSync(path.join(REPO, 'cli/website/docs/how-it-works.md'), 'utf8');

describe('docs: How it works lists the journey the rails walk', () => {
  it('names every stage of shared/journeys/language.json, in order', () => {
    // the numbered list: "1. **Start the project** — …"
    const listed = [...page.matchAll(/^\d+\. \*\*([^*]+)\*\*/gm)].map((m) => m[1].trim());
    const expected = journey.stages.map((s) => PLAIN.reduce((t, [re, w]) => t.replace(re, w), s.title));
    assert.deepEqual(listed, expected);
  });
});
