/**
 * check-readability.mjs reports the reading grade and the terms of art on the
 * people's pages. These pin that its instruments work: a term is found where
 * it is, the technical "Go deeper" layer and code are not graded, and plain
 * text grades lower than dense text.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { topLayer, grade, termsIn, syllables } from '../website/scripts/check-readability.mjs';

describe('docs readability instrument', () => {
  it('finds terms of art, word-bounded, case-aware for acronyms', () => {
    const found = termsIn('The model learns.\nThe MCP server runs.\nA remodel is fine. mcp is lower case.').map((t) => t.term);
    assert.ok(found.includes('model'));
    assert.ok(found.includes('MCP'));
    assert.equal(found.filter((t) => t === 'model').length, 1, 'remodel is not "model"');
    assert.equal(found.filter((t) => t === 'MCP').length, 1, 'acronyms match upper case only');
  });

  it('grades only the top layer: no frontmatter, code or Go deeper', () => {
    const src = '---\ntitle: x\n---\n# Page\n\nPlain words here.\n\n```bash\nnmt-forge leak-audit corpus\n```\n\n## Go deeper\n\nThe chrF++ metric and the corpus.\n';
    const top = topLayer(src);
    assert.doesNotMatch(top, /title: x|leak-audit|chrF|corpus/);
    assert.match(top, /Plain words here/);
  });

  it('plain text grades lower than dense text', () => {
    const plain = grade('We have some words. We want a translator. It runs on our computer.');
    const dense = grade('Contamination-controlled evaluation necessitates preregistered hypotheses regarding generalization characteristics.');
    assert.ok(plain.grade < dense.grade, `${plain.grade} < ${dense.grade}`);
    assert.equal(syllables('cat'), 1);
    assert.ok(syllables('translation') >= 3);
  });
});
