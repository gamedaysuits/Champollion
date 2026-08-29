/**
 * tm-seed.js — seed the Translation Memory from EXISTING translations.
 *
 * WHY THIS EXISTS:
 *   Block-level TM only gains entries as files are (re-)translated. A
 *   project that upgraded with a full set of already-translated content
 *   files has an empty TM for all of them — so a lost or clobbered
 *   .champollion-content.lock re-bills every file through the API even
 *   though perfectly good translations sit on disk. `champollion tm seed`
 *   walks those existing translations and back-fills the TM: front-matter
 *   fields (aligned by field NAME), body blocks (aligned 1:1 by POSITION
 *   via segment.js splitBlocks), and the whole body — each keyed with
 *   tmMethodKey(pairConfig), exactly as a live sync would store them.
 *
 * SAFETY RULES (never guess alignment):
 *   - A (file × locale) is seeded ONLY when the lock manifest entry says
 *     the target is up to date (stored hash === SHA-256 of the current
 *     source). A stale or missing entry means the target may correspond
 *     to an older source — skip.
 *   - Body blocks are seeded ONLY when source and target contain the SAME
 *     number of translatable blocks. Any mismatch skips the entire file
 *     with a warning; a positional guess would poison the TM.
 *   - Targets containing the legacy '[EN] ' fallback marker are never
 *     seeded — they are untranslated English, not translations.
 *
 *   Seeding is additive and idempotent: entries whose cached value already
 *   matches the on-disk translation are left untouched; disk is treated as
 *   truth when they differ (a hand-polished file wins over an old cache).
 *
 * CACHE-UNIT PARITY (must mirror the sync engines exactly):
 *   Block keys/values replicate content-sync/docusaurus-sync block mode —
 *   segment the PROTECTED body (protectBlocks → splitBlocks), keep only
 *   'translatable' segments (separators/passthrough are copied verbatim by
 *   sync, never cached), and key each on its RESTORED source text with the
 *   RESTORED target text as the value. Placeholder numbering is positional
 *   per file, so only restored text is stable across files and edits.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { loadTM, saveTM, lookupTM, storeTM, isTMDirty, tmSize, tmMethodKey } from './tm.js';
import { readContentManifest } from './content-sync.js';
import { splitBlocks } from './segment.js';
import { isPathContained } from './security.js';
import { output } from './output.js';
import {
  discoverContentFiles,
  getTargetContentPath,
  discoverDocusaurusContentFiles,
  getDocusaurusTargetPath,
  parseContentFile,
  protectBlocks,
  restoreBlocks,
  DEFAULT_TRANSLATABLE_FIELDS,
} from './content.js';

/**
 * Extract the restored source texts of a body's translatable blocks —
 * the exact TM key unit the sync engines use in block mode.
 *
 * @param {string} body - Raw markdown body (front matter stripped)
 * @returns {string[]} Restored translatable block texts, in document order
 */
function translatableBlockTexts(body) {
  const { protectedBody, blocks } = protectBlocks(body);
  return splitBlocks(protectedBody)
    .filter(seg => seg.type === 'translatable')
    .map(seg => restoreBlocks(seg.text, blocks));
}

/**
 * Seed the TM from existing translated content files.
 *
 * Walks the same (source file × pair) space as the two content sync
 * engines, using the same manifest keys, so what gets seeded is exactly
 * what a future sync would look up:
 *   - Hugo lane (contentDir):    "relPath:code"
 *   - Docusaurus lane:           "docusaurus:dirName/relPath:code"
 *
 * @param {object} options
 * @param {string} options.cwd - Project root (lock file + TM location)
 * @param {Map<string, object>} options.pairs - Resolved pair graph (pairKey → pairConfig)
 * @param {string} options.sourceLocale - Source language code
 * @param {string[]|null} [options.translatableFields] - Hugo-lane front matter
 *   fields (null → DEFAULT_TRANSLATABLE_FIELDS). The Docusaurus lane always
 *   uses the defaults, mirroring runDocusaurusSync.
 * @param {string|null} [options.contentDir] - Hugo content directory (null = lane off)
 * @param {{ localesDir: string, docsDir: string, blogDir: string }|null} [options.docusaurus]
 *   Docusaurus lane directories (null = lane off)
 * @param {boolean} [options.dryRun] - Report what would be seeded, write nothing
 * @param {string|null} [options.localeFilter] - Only seed one target locale
 * @returns {{
 *   files: Array<{ label: string, code: string, status: 'seeded'|'skipped',
 *     reason?: string, fields: number, blocks: number, body: boolean,
 *     added: number, existing: number }>,
 *   seededFiles: number, skippedFiles: number,
 *   entriesAdded: number, entriesExisting: number,
 *   tmSizeBefore: number, tmSizeAfter: number,
 *   dryRun: boolean, saved: boolean,
 * }}
 */
function seedTMFromExisting(options) {
  const {
    cwd,
    pairs,
    sourceLocale,
    translatableFields = null,
    contentDir = null,
    docusaurus = null,
    dryRun = false,
    localeFilter = null,
  } = options;

  const manifest = readContentManifest(cwd);
  const tm = loadTM(cwd);
  const tmSizeBefore = tmSize(tm);

  const pairEntries = [...pairs.entries()]
    .filter(([, pairConfig]) => !localeFilter || pairConfig.target === localeFilter)
    .sort(([a], [b]) => a.localeCompare(b));

  // ── Collect candidates from both lanes ─────────────────────────────
  // Each candidate mirrors one (source file × pair) unit of sync work.
  const candidates = [];

  if (contentDir && fs.existsSync(contentDir)) {
    const fieldsList = translatableFields || DEFAULT_TRANSLATABLE_FIELDS;
    for (const sourcePath of discoverContentFiles(contentDir, sourceLocale)) {
      const relPath = path.relative(contentDir, sourcePath);
      for (const [, pairConfig] of pairEntries) {
        const code = pairConfig.target;
        const targetPath = getTargetContentPath(sourcePath, code, sourceLocale);
        if (!isPathContained(targetPath, contentDir)) continue;
        candidates.push({
          sourcePath, targetPath, pairConfig, code, fieldsList,
          label: relPath,
          manifestKey: `${relPath}:${code}`,
        });
      }
    }
  }

  if (docusaurus) {
    const { localesDir, docsDir, blogDir } = docusaurus;
    const contentSources = [];
    if (docsDir && fs.existsSync(docsDir)) {
      contentSources.push({ dir: docsDir, plugin: 'docusaurus-plugin-content-docs' });
    }
    if (blogDir && fs.existsSync(blogDir)) {
      contentSources.push({ dir: blogDir, plugin: 'docusaurus-plugin-content-blog' });
    }
    for (const { dir, plugin } of contentSources) {
      const dirName = path.basename(dir);
      for (const sourcePath of discoverDocusaurusContentFiles(dir)) {
        const relPath = path.relative(dir, sourcePath);
        for (const [, pairConfig] of pairEntries) {
          const code = pairConfig.target;
          const targetPath = getDocusaurusTargetPath(sourcePath, dir, code, localesDir, plugin);
          if (!isPathContained(targetPath, localesDir)) continue;
          candidates.push({
            sourcePath, targetPath, pairConfig, code,
            fieldsList: DEFAULT_TRANSLATABLE_FIELDS,
            label: `${dirName}/${relPath}`,
            manifestKey: `docusaurus:${dirName}/${relPath}:${code}`,
          });
        }
      }
    }
  }

  // ── Seed each candidate behind the safety gates ─────────────────────
  const files = [];
  let seededFiles = 0;
  let skippedFiles = 0;
  let entriesAdded = 0;
  let entriesExisting = 0;

  const sourceCache = new Map(); // sourcePath → { raw, hash }

  for (const cand of candidates) {
    const record = {
      label: cand.label, code: cand.code, status: 'skipped',
      fields: 0, blocks: 0, body: false, added: 0, existing: 0,
    };
    files.push(record);

    if (!fs.existsSync(cand.targetPath)) {
      record.reason = 'no translated file';
      skippedFiles++;
      continue;
    }

    if (!sourceCache.has(cand.sourcePath)) {
      const raw = fs.readFileSync(cand.sourcePath, 'utf-8');
      const hash = crypto.createHash('sha256').update(raw, 'utf-8').digest('hex');
      sourceCache.set(cand.sourcePath, { raw, hash });
    }
    const { raw, hash } = sourceCache.get(cand.sourcePath);

    // Lock-manifest gate: only an entry that matches the CURRENT source
    // hash proves the on-disk translation corresponds to this source.
    const storedHash = cand.manifestKey in manifest ? manifest[cand.manifestKey] : null;
    if (storedHash === null) {
      record.reason = 'no lock entry — cannot prove the translation matches this source';
      skippedFiles++;
      continue;
    }
    if (storedHash !== hash) {
      record.reason = 'lock entry is stale (source changed since last sync)';
      skippedFiles++;
      continue;
    }

    const targetRaw = fs.readFileSync(cand.targetPath, 'utf-8');
    if (targetRaw.includes('[EN] ')) {
      record.reason = 'target is a legacy [EN] fallback, not a translation';
      skippedFiles++;
      continue;
    }

    const src = parseContentFile(raw);
    const tgt = parseContentFile(targetRaw);
    const srcBlocks = translatableBlockTexts(src.body);
    const tgtBlocks = translatableBlockTexts(tgt.body);

    // Positional alignment is only trustworthy when the counts agree —
    // skip the WHOLE file otherwise, never seed a guessed pairing.
    if (srcBlocks.length !== tgtBlocks.length) {
      record.reason = `translatable block count mismatch (source ${srcBlocks.length} vs target ${tgtBlocks.length})`;
      skippedFiles++;
      output.warn(`tm seed: ${cand.label} → ${cand.code} skipped — ${record.reason}`);
      continue;
    }

    const tmKey = tmMethodKey(cand.pairConfig);
    const seedEntry = (source, translation) => {
      if (typeof source !== 'string' || source.trim() === '') return false;
      if (typeof translation !== 'string' || translation.trim() === '') return false;
      if (lookupTM(tm, source, cand.code, tmKey) === translation) {
        record.existing++;
        entriesExisting++;
      } else {
        if (!dryRun) storeTM(tm, source, cand.code, tmKey, translation);
        record.added++;
        entriesAdded++;
      }
      return true;
    };

    // Front-matter fields — aligned by NAME, the same per-field cache unit
    // the sync path looks up via partitionByTM.
    if (src.hasFrontMatter && tgt.hasFrontMatter) {
      for (const field of cand.fieldsList) {
        if (typeof src.frontMatter[field] === 'string' && typeof tgt.frontMatter[field] === 'string') {
          if (seedEntry(src.frontMatter[field], tgt.frontMatter[field])) record.fields++;
        }
      }
    }

    // Body blocks — aligned 1:1 by position (counts verified equal above).
    for (let i = 0; i < srcBlocks.length; i++) {
      if (seedEntry(srcBlocks[i], tgtBlocks[i])) record.blocks++;
    }

    // Whole body — the cache unit the current sync path serves bodies from.
    if (src.body.trim() && tgt.body.trim()) {
      record.body = seedEntry(src.body, tgt.body);
    }

    record.status = 'seeded';
    seededFiles++;
  }

  let saved = false;
  if (!dryRun && isTMDirty(tm)) {
    saveTM(cwd, tm);
    saved = true;
  }

  return {
    files,
    seededFiles,
    skippedFiles,
    entriesAdded,
    entriesExisting,
    tmSizeBefore,
    tmSizeAfter: tmSize(tm),
    dryRun,
    saved,
  };
}

export { seedTMFromExisting };
