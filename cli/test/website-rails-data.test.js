/**
 * website-rails-data.test.js — the facts the rails pages show that live in
 * the tools (project folders, journey stages, the holders' choices, the
 * registration tiers, each package's licence) are generated into
 * website/src/data/rails-demo/site-data.json by
 * website/scripts/build-rails-data.mjs. This fails when the tools changed and
 * the committed file did not — so a page can never show yesterday's folders
 * or a licence a package no longer has. (The site's prebuild runs the same
 * check: `npm run check-rails-data`.)
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SITE = path.join(HERE, '..', 'website');

describe('the rails pages\' generated facts', () => {
  it('site-data.json matches what the tools say today', () => {
    const r = spawnSync(process.execPath, [path.join(SITE, 'scripts', 'build-rails-data.mjs'), '--check'], { encoding: 'utf-8' });
    assert.equal(r.status, 0, r.stderr || r.stdout);
  });

  it('names a licence for every package, and calls none of the PolyForm ones open source', () => {
    const data = JSON.parse(fs.readFileSync(path.join(SITE, 'src', 'data', 'rails-demo', 'site-data.json'), 'utf-8'));
    assert.ok(data.licences.length >= 4);
    for (const l of data.licences) assert.ok(l.license, l.name);
    const footer = fs.readFileSync(path.join(SITE, 'src', 'theme', 'Footer', 'index.js'), 'utf-8');
    assert.match(footer, /startsWith\('PolyForm'\) \? ' \(source-available\)'/);
  });

  it('release.json: says whether the rails are out, and names every version once they are', () => {
    const rel = JSON.parse(fs.readFileSync(path.join(SITE, 'src', 'data', 'rails-demo', 'release.json'), 'utf-8'));
    assert.equal(typeof rel.railsReleased, 'boolean');
    const pkgs = ['champollion', 'champollion-mcp-server', 'nmt-forge', 'mt-eval-harness'];
    for (const p of pkgs) assert.ok(rel.published[p], `published ${p} recorded`);
    if (rel.railsReleased) for (const p of pkgs) assert.ok(rel.railsVersions[p], `released: ${p} needs its rails version`);
    for (const pf of rel.preReleaseFiles) {
      const text = fs.readFileSync(path.join(SITE, pf.path), 'utf-8');
      assert.equal(text.includes(pf.marker), !rel.railsReleased, `${pf.path}: the pre-release marker must be there exactly while unreleased`);
    }
  });

  it('once released, the rails require the nmt-forge that has the released commands', () => {
    // nmt-forge 0.2.3 (published 2026-10-11) has no `floor`, which the rails
    // run; a min_version that admits it would fail mid-walk after the release.
    const rel = JSON.parse(fs.readFileSync(path.join(SITE, 'src', 'data', 'rails-demo', 'release.json'), 'utf-8'));
    const journey = JSON.parse(fs.readFileSync(path.join(SITE, '..', '..', 'shared', 'journeys', 'language.json'), 'utf-8'));
    const forgeStep = JSON.stringify(journey).match(/"tool":"nmt-forge","min_version":"([^"]+)"/);
    assert.ok(forgeStep, 'the journey checks nmt-forge by version');
    if (rel.railsReleased) assert.equal(forgeStep[1], rel.railsVersions['nmt-forge']);
  });

  it('every registration tier keeps the text off the network', () => {
    const data = JSON.parse(fs.readFileSync(path.join(SITE, 'src', 'data', 'rails-demo', 'site-data.json'), 'utf-8'));
    // the pages say "none of them uploads your text" only while this holds
    // (sections.js reads the same flag); if a tier ever uploads, the sentence
    // switches — this test makes the change visible.
    assert.ok(data.tiers.every((t) => t.uploadsContent === false));
  });
});
