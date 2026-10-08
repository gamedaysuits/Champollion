/**
 * sync --files / --retranslate — dogfood 2026-08-28, finding 3.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { compileFileScope } from '../lib/file-scope.js';

test('no flags → no scope (zero cost for the common case)', () => {
  assert.equal(compileFileScope({}), null);
});

test('--files: * stays in one folder, ** crosses folders', () => {
  const scope = compileFileScope({ files: ['docs/*.md', 'blog/**'] });
  assert.ok(scope.includes('docs/intro.md'));
  assert.ok(!scope.includes('docs/network/spec.md'));
  assert.ok(scope.includes('blog/2026/launch.md'));
  assert.ok(!scope.includes('posts/hello.md'));
});

test('--retranslate files are always in the run, and flagged', () => {
  const scope = compileFileScope({ files: ['docs/*.md'], retranslate: ['blog/launch.md'] });
  assert.ok(scope.includes('blog/launch.md'));
  assert.ok(scope.retranslates('blog/launch.md'));
  assert.ok(!scope.retranslates('docs/intro.md'));
});

test('comma lists and ./ prefixes are accepted', () => {
  const scope = compileFileScope({ files: './docs/a.md,docs/b.md' });
  assert.ok(scope.includes('docs/a.md') && scope.includes('docs/b.md'));
});

test('a pattern that matched nothing fails loud', () => {
  const scope = compileFileScope({ files: ['docs/intro.md', 'docs/typo.md'] });
  scope.includes('docs/intro.md');
  assert.throws(() => scope.assertAllMatched(), /No content file matches "docs\/typo\.md"/);
});
