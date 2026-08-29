/**
 * source-snapshot test suite — the rules that keep a pin from being a guess.
 *
 * A SNAPSHOT.json is a provenance claim: "these exact bytes are release X of
 * source Y, and here is how to check". The failure mode this suite exists to
 * prevent is the one the licence audit already found elsewhere in this
 * codebase — a record that LOOKS checkable, is formatted like evidence, and is
 * grounded in nothing. `toSpdx()` invented licence versions from substring
 * matches for 212 sources; a fetcher that wrote a pin because a filename looked
 * plausible would be the same mistake in a new place.
 *
 * So the rules under test are all refusals:
 *
 *   - a snapshot claiming `verified` with no pin is rejected (verified against
 *     WHAT?)
 *   - a snapshot listing no files is rejected (it describes nothing)
 *   - adopt() marks a file verified ONLY on a checksum match with the
 *     publisher's own checksum — never on presence, size, or name
 *   - verify() recomputes from disk, so it can detect drift rather than
 *     confirming that JSON agrees with itself
 *
 * @see cli/scripts/fetchers/lib/fetch-lib.mjs
 * @see cli/shared/schemas/source-snapshot.schema.json
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  DATA_ROOT, adopt, md5File, parseZenodoChecksum, readSnapshot, sha256File,
  verify, writeSnapshot,
} from '../scripts/fetchers/lib/fetch-lib.mjs';

// A scratch source directory inside DATA_ROOT — the lib resolves everything
// relative to it, and a test that reached outside would not be testing the
// real path resolution.
const DIR = '__snapshot_test__';
const ABS = path.join(DATA_ROOT, DIR);

const CONTENT = 'Id\tRef_Name\naaa\tGhotuo\n';
const SHA = createHash('sha256').update(CONTENT).digest('hex');
const MD5 = createHash('md5').update(CONTENT).digest('hex');

before(() => {
  fs.mkdirSync(ABS, { recursive: true });
  fs.writeFileSync(path.join(ABS, 'table.tab'), CONTENT);
});

after(() => {
  fs.rmSync(ABS, { recursive: true, force: true });
});

describe('checksums', () => {
  it('hashes a file the same way the rest of the world does', () => {
    assert.equal(sha256File(path.join(ABS, 'table.tab')), SHA);
    assert.equal(md5File(path.join(ABS, 'table.tab')), MD5);
  });

  it('parses the publisher\'s algorithm rather than assuming md5', () => {
    assert.deepEqual(parseZenodoChecksum('md5:abc123'), { algo: 'md5', hex: 'abc123' });
    assert.deepEqual(parseZenodoChecksum(`sha256:${SHA}`), { algo: 'sha256', hex: SHA });
    assert.equal(parseZenodoChecksum('not a checksum'), null);
    assert.equal(parseZenodoChecksum(undefined), null);
  });
});

describe('writeSnapshot — refuses a claim it cannot support', () => {
  const base = {
    source: 'test-source', upstream: 'https://example.invalid/x',
    license: 'CC0-1.0',
    // Must name a fetcher MODULE now — the thing that can fetch again — not a
    // test file. The door got stricter on 2026-08-09 and these fixtures are
    // held to the same schema as a real pin.
    fetchedBy: 'test/source-snapshot.test.mjs',
  };

  it('rejects "verified" with no pin', () => {
    assert.throws(
      () => writeSnapshot(DIR, {
        ...base, verified: true, pin: null,
        files: [{ path: 'table.tab', bytes: CONTENT.length, sha256: SHA }],
      }),
      /marked verified but has no pin/,
      'a snapshot verified against no particular release is exactly the shape '
      + 'of a fabricated provenance record',
    );
  });

  it('rejects a snapshot listing no files', () => {
    assert.throws(
      () => writeSnapshot(DIR, { ...base, verified: false, pin: null, files: [] }),
      /lists no files/,
    );
  });

  it('rejects a listed file with no checksum', () => {
    assert.throws(
      () => writeSnapshot(DIR, {
        ...base, verified: false, pin: null,
        files: [{ path: 'table.tab', bytes: CONTENT.length }],
      }),
      /has no sha256/,
    );
  });

  it('writes an UNPINNED snapshot happily — that is a real, honest state', () => {
    const p = writeSnapshot(DIR, {
      ...base, verified: false, pin: null,
      files: [{ path: 'table.tab', bytes: CONTENT.length, sha256: SHA }],
      notes: 'upstream publishes no immutable release',
    });
    assert.ok(fs.existsSync(p));
    const snap = readSnapshot(DIR);
    assert.equal(snap.pin, null);
    assert.equal(snap.verified, false);
    assert.ok(snap.fetchedAt, 'retrieval date is stamped even without a pin');
  });
});

describe('adopt — a match is proof, a plausible filename is not', () => {
  it('marks a file verified when the publisher\'s md5 matches', () => {
    const r = adopt({
      dir: DIR,
      candidates: [{ path: 'table.tab', upstreamChecksum: `md5:${MD5}`, url: 'https://x.invalid' }],
    });
    assert.equal(r.verified, true);
    assert.equal(r.files[0].upstreamVerified, true);
    assert.equal(r.unmatched.length, 0);
  });

  it('accepts a sha256 checksum too, not just md5', () => {
    const r = adopt({
      dir: DIR,
      candidates: [{ path: 'table.tab', upstreamChecksum: `sha256:${SHA}` }],
    });
    assert.equal(r.verified, true);
  });

  it('REFUSES to verify when the publisher offers no checksum', () => {
    const r = adopt({ dir: DIR, candidates: [{ path: 'table.tab', upstreamChecksum: null }] });
    assert.equal(r.verified, false,
      'presence on disk is not provenance — this is the whole point');
    assert.equal(r.files[0].upstreamVerified, false);
    assert.match(r.unmatched[0].why, /no checksum/);
    assert.ok(r.files[0].sha256, 'our own hash is still recorded, just not vouched for');
  });

  it('REFUSES to verify when the checksum disagrees', () => {
    const r = adopt({
      dir: DIR, candidates: [{ path: 'table.tab', upstreamChecksum: `md5:${'0'.repeat(32)}` }],
    });
    assert.equal(r.verified, false);
    assert.match(r.unmatched[0].why, /differs from upstream/);
  });

  it('reports a missing file instead of silently dropping it', () => {
    const r = adopt({
      dir: DIR,
      candidates: [{ path: 'absent.tab', upstreamChecksum: `md5:${MD5}` }],
    });
    assert.equal(r.verified, false);
    assert.equal(r.unmatched[0].why, 'not on disk');
    assert.equal(r.files.length, 0);
  });
});

describe('verify — recomputes, never takes the record\'s word', () => {
  before(() => {
    writeSnapshot(DIR, {
      source: 'test-source', upstream: 'https://example.invalid/x',
      verified: true, pin: { kind: 'release', value: '20260715' },
      files: [{ path: 'table.tab', bytes: CONTENT.length, sha256: SHA }],
      license: 'CC0-1.0',
      fetchedBy: 'test/source-snapshot.test.mjs',
    });
  });

  it('passes when disk matches the record', () => {
    const r = verify(DIR);
    assert.equal(r.ok, true);
    assert.equal(r.checked, 1);
  });

  it('detects drift when the file changes underneath the record', () => {
    const file = path.join(ABS, 'table.tab');
    const original = fs.readFileSync(file);
    try {
      fs.writeFileSync(file, `${CONTENT}aab\tAlumu-Tesu\n`);
      const r = verify(DIR);
      assert.equal(r.ok, false, 'a snapshot that cannot detect drift records nothing useful');
      assert.match(r.problems[0].why, /sha256 drift/);
    } finally {
      fs.writeFileSync(file, original);
    }
  });

  it('detects a file that has gone missing', () => {
    const file = path.join(ABS, 'table.tab');
    const original = fs.readFileSync(file);
    try {
      fs.rmSync(file);
      const r = verify(DIR);
      assert.equal(r.ok, false);
      assert.match(r.problems[0].why, /missing on disk/);
    } finally {
      fs.writeFileSync(file, original);
    }
  });

  it('treats a source with no snapshot as unverifiable, not as passing', () => {
    const r = verify('__no_such_source__');
    assert.equal(r.ok, false);
    assert.equal(r.problems[0].why, 'no SNAPSHOT.json');
  });
});

describe('the shipped snapshots are real', () => {
  // Guards the two sources the language spine is built from. If either drifts,
  // ingest-base.mjs has been reading bytes that no release accounts for.
  for (const dir of ['glottolog', 'iso639-3']) {
    it(`${dir} is pinned and matches disk`, { skip: !fs.existsSync(path.join(DATA_ROOT, dir, 'SNAPSHOT.json')) }, () => {
      const snap = readSnapshot(dir);
      assert.ok(snap.pin?.value, `${dir} has a SNAPSHOT but no pin`);
      assert.equal(snap.verified, true);
      const r = verify(dir);
      assert.equal(r.ok, true, r.problems.map((p) => `${p.path}: ${p.why}`).join('; '));
    });
  }
});

describe('cldf-zenodo — will not invent a DOI', () => {
  it('refuses a source that is not in the Zenodo harvest', async () => {
    const { pinOne } = await import('../scripts/fetchers/cldf-zenodo.mjs');
    await assert.rejects(
      () => pinOne('__not_a_real_dataset__'),
      /not in the Zenodo harvest/,
      'a source with no harvested record has no DOI, and guessing one would '
      + 'attach real-looking provenance to nothing',
    );
  });

  it('only offers to pin datasets that exist on disk AND have a zip', async () => {
    const { pinnable } = await import('../scripts/fetchers/cldf-zenodo.mjs');
    const list = pinnable();
    assert.ok(list.length > 0);
    for (const s of list.slice(0, 20)) {
      assert.ok(s.doi, `${s.key} offered without a DOI`);
      assert.ok(fs.existsSync(path.join(DATA_ROOT, s.key)), `${s.key} is not on disk`);
    }
  });
});
