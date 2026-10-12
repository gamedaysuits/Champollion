/**
 * Package-manifest leak guard — the CLI's primary "nothing proprietary ships"
 * invariant, enforced as a test.
 *
 * WHY THIS EXISTS:
 *   The published npm tarball must NEVER contain the bulk language-card or
 *   corpora-card directories (thousands of cards, EdTeKLA/Wolvengrey
 *   attribution among them), the facts DB, secrets, the research vault, or any
 *   dictionary harvest. Today that guarantee rests entirely on the `files`
 *   allowlist + its `!shared/language-cards/` / `!shared/corpora-cards/`
 *   negations in package.json. A single typo (dropping a `!`) or a glob change
 *   would silently re-include every card with no failure anywhere. This test
 *   runs the real `npm pack --dry-run` manifest and fails if any forbidden
 *   path appears — so the no-leak invariant is checked on every `npm test`
 *   (and therefore in CI), not just trusted by inspection.
 *
 *   Companion guards: scripts/quarantine_gate.sh (git tree), lyss's
 *   test_packaging_ip_guard.py (the PyPI wheel).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cliRoot = path.resolve(__dirname, '..');

/** Patterns that must NEVER appear in the published tarball manifest. */
const FORBIDDEN = [
  { name: 'bulk language-cards directory', re: /(^|\/)shared\/language-cards\// },
  { name: 'bulk corpora-cards directory', re: /(^|\/)shared\/corpora-cards\// },
  { name: 'facts database', re: /\.db$/ },
  { name: 'environment / secrets file', re: /(^|\/)\.env/ },
  { name: 'research vault', re: /(^|\/)\.vault\// },
  { name: 'internal planning docs', re: /(^|\/)docs\// },
  { name: 'dictionary harvest / lemmas', re: /(lemmas\.json|raw_harvest|itwewina|wolvengrey)/i },
  { name: 'FST binary', re: /\.(hfstol|fomabin|fst|foma)$/ },
];

function packedFiles() {
  // --ignore-scripts: don't run prepack (build steps) — we only need the
  // manifest, which is derived from the `files` field + .npmignore.
  const out = execFileSync(
    'npm',
    ['pack', '--dry-run', '--json', '--ignore-scripts'],
    { cwd: cliRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
  );
  const parsed = JSON.parse(out);
  return parsed[0].files.map((f) => f.path);
}

describe('pack-manifest: no proprietary or bulk-card content ships', () => {
  const files = packedFiles();

  it('produces a non-empty manifest', () => {
    assert.ok(files.length > 0, 'npm pack --dry-run returned no files');
  });

  for (const { name, re } of FORBIDDEN) {
    it(`excludes ${name}`, () => {
      const hits = files.filter((f) => re.test(f));
      assert.deepEqual(
        hits,
        [],
        `Forbidden path(s) would be published (${name}): ${hits.join(', ')}`,
      );
    });
  }

  it('ships the offline cards-fallback bundle (sanity: allowlist not over-pruned)', () => {
    assert.ok(
      files.some((f) => f.endsWith('shared/cards-fallback.json')),
      'cards-fallback.json missing — the offline fallback must ship',
    );
  });
});
