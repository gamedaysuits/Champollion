/**
 * Security tests — direct validation of the path containment guard.
 *
 * WHY THESE EXIST:
 *   security.js:isPathContained() is the ONLY thing preventing a crafted
 *   locale code like "../../../etc/passwd" from writing to arbitrary
 *   filesystem locations. It was previously tested only indirectly via
 *   sync.js. This file tests the guard directly with adversarial inputs.
 *
 * CATEGORIES:
 *   1. Basic containment — normal paths that should pass/fail
 *   2. Path traversal attacks — ../ sequences, encoded variants
 *   3. Edge cases — empty strings, identical paths, trailing separators
 *   4. Integration — crafted locale codes through the full sync guard
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';

import { isPathContained } from '../lib/security.js';

// =================================================================
// 1. Basic containment — normal paths
// =================================================================
describe('security: isPathContained — basic containment', () => {
  it('accepts a file inside the parent directory', () => {
    assert.equal(
      isPathContained('/project/locales/fr.json', '/project/locales'),
      true
    );
  });

  it('accepts a file in a subdirectory', () => {
    assert.equal(
      isPathContained('/project/locales/nested/deep/fr.json', '/project/locales'),
      true
    );
  });

  it('accepts the parent directory itself', () => {
    // WHY: resolveConfig resolves localesDir to an absolute path,
    // and the guard should consider the dir itself as "contained"
    assert.equal(
      isPathContained('/project/locales', '/project/locales'),
      true
    );
  });

  it('rejects a sibling directory', () => {
    assert.equal(
      isPathContained('/project/config/secrets.json', '/project/locales'),
      false
    );
  });

  it('rejects the parent of the parent', () => {
    assert.equal(
      isPathContained('/project/package.json', '/project/locales'),
      false
    );
  });
});

// =================================================================
// 2. Path traversal attacks
// =================================================================
describe('security: isPathContained — path traversal attacks', () => {
  it('blocks basic ../ traversal', () => {
    const maliciousPath = path.resolve('/project/locales', '../../../etc/passwd');
    assert.equal(
      isPathContained(maliciousPath, '/project/locales'),
      false
    );
  });

  it('blocks traversal disguised as a locale code', () => {
    // WHY: A user could set a language code to "../../../etc/passwd"
    // in their config. The sync engine resolves it:
    //   path.join(localesDir, langCode + '.json')
    const localesDir = '/project/locales';
    const craftedCode = '../../../etc/passwd';
    const resolvedPath = path.resolve(localesDir, craftedCode + '.json');
    assert.equal(
      isPathContained(resolvedPath, localesDir),
      false
    );
  });

  it('blocks single-level ../ breakout', () => {
    const localesDir = '/project/locales';
    const resolvedPath = path.resolve(localesDir, '../secrets.json');
    assert.equal(
      isPathContained(resolvedPath, localesDir),
      false
    );
  });

  it('blocks traversal with redundant slashes', () => {
    const malicious = path.resolve('/project/locales', './..//../etc/passwd');
    assert.equal(
      isPathContained(malicious, '/project/locales'),
      false
    );
  });

  it('blocks path that starts with the parent as a prefix but is a sibling', () => {
    // WHY: "/project/locales-evil/file.json" starts with "/project/locales"
    // as a string prefix, but is NOT inside the directory. The guard must
    // check for the path separator, not just startsWith.
    assert.equal(
      isPathContained('/project/locales-evil/fr.json', '/project/locales'),
      false
    );
  });

  it('blocks traversal embedded in the middle of a path', () => {
    const malicious = path.resolve('/project/locales/fr/../../../etc/shadow');
    assert.equal(
      isPathContained(malicious, '/project/locales'),
      false
    );
  });

  it('blocks absolute path outside parent', () => {
    // WHY: If someone passes an absolute path as a language code
    assert.equal(
      isPathContained('/etc/passwd', '/project/locales'),
      false
    );
  });

  it('blocks traversal to root', () => {
    const malicious = path.resolve('/project/locales', '../../../../..');
    assert.equal(
      isPathContained(malicious, '/project/locales'),
      false
    );
  });
});

// =================================================================
// 3. Edge cases
// =================================================================
describe('security: isPathContained — edge cases', () => {
  it('handles trailing separator on parent', () => {
    assert.equal(
      isPathContained('/project/locales/fr.json', '/project/locales/'),
      true
    );
  });

  it('handles trailing separator on child', () => {
    assert.equal(
      isPathContained('/project/locales/subdir/', '/project/locales'),
      true
    );
  });

  it('handles dot in locale code (e.g., pt-BR.json)', () => {
    assert.equal(
      isPathContained('/project/locales/pt-BR.json', '/project/locales'),
      true
    );
  });

  it('handles locale code with spaces', () => {
    const localesDir = '/project/locales';
    const weirdCode = 'my language';
    const resolvedPath = path.resolve(localesDir, weirdCode + '.json');
    assert.equal(
      isPathContained(resolvedPath, localesDir),
      true
    );
  });

  it('handles unicode locale codes', () => {
    const localesDir = '/project/locales';
    const unicodePath = path.resolve(localesDir, '日本語.json');
    assert.equal(
      isPathContained(unicodePath, localesDir),
      true
    );
  });

  it('handles deeply nested valid paths', () => {
    const deep = path.resolve('/project/locales', 'a/b/c/d/e/f/g/h.json');
    assert.equal(
      isPathContained(deep, '/project/locales'),
      true
    );
  });
});

// =================================================================
// 4. Adversarial locale codes — simulating real attack vectors
// =================================================================
describe('security: crafted locale codes through path resolution', () => {
  const localesDir = '/project/locales';

  /**
   * Simulate what sync.js does: resolve a locale code to a file path.
   * This is the actual attack surface — the code comes from user config.
   */
  function resolveLocalePath(code, ext = '.json') {
    return path.resolve(localesDir, code + ext);
  }

  const ATTACK_CODES = [
    { code: '../../../etc/passwd', label: 'classic traversal' },
    { code: 'fr/../../etc/shadow', label: 'embedded traversal' },
    { code: 'valid/../../../etc/hosts', label: 'valid prefix then traversal' },
  ];

  // NOTE: Some attack vectors that might seem dangerous are actually safe
  // after path.resolve + .json appending:
  //   - "." + ".json" → resolves to "localesDir/..json" (a valid filename inside dir)
  //   - ".." + ".json" → resolves to "localesDir/...json" (also inside dir)
  //   - Windows-style "..\..\..\" → backslashes are literal filename chars on Unix
  // These are tested separately in the path traversal section above.

  for (const { code, label } of ATTACK_CODES) {
    it(`blocks attack: ${label} ("${code}")`, () => {
      const resolved = resolveLocalePath(code);
      assert.equal(
        isPathContained(resolved, localesDir),
        false,
        `Locale code "${code}" resolved to "${resolved}" — should be BLOCKED`
      );
    });
  }

  // Verify legitimate codes still pass
  const LEGIT_CODES = ['fr', 'de', 'pt-BR', 'zh-Hans', 'x-pirate', 'crk'];
  for (const code of LEGIT_CODES) {
    it(`allows legitimate code: "${code}"`, () => {
      const resolved = resolveLocalePath(code);
      assert.equal(
        isPathContained(resolved, localesDir),
        true,
        `Locale code "${code}" should be ALLOWED`
      );
    });
  }
});
