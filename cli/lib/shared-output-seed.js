/**
 * shared-output-seed.js — what a locale's shared-output index starts a sync
 * with: the translations already on disk that this run leaves alone.
 *
 * WHY: `verify` checks one locale's whole state for a model repeating one
 * memorized sentence (lib/verify.js sharedOutputErrors): every key value of
 * every file AND every Markdown page, counted together. Sync's gate
 * (lib/validate.js SharedOutputIndex) saw less — only what this run accepted,
 * plus, per key-value file, what that file kept, added when the file was
 * reached. So a new answer repeating a sentence that sat in an untouched
 * newsletter page, in a key-value file with nothing to translate (it returns
 * before it seeds), or in a namespace file processed later, was written —
 * and `verify` then flagged it (Round 10, school persona). Seeding the index
 * with what the run leaves alone, before anything is checked, gives the gate
 * the same scope `verify` reads.
 *
 * "Left alone" is what the run will not re-translate:
 *   - a key value Champollion recorded writing for the CURRENT source text
 *     (the lock's written record matches the source and the value), or one
 *     with no record whose source did not change — never an '[EN] '
 *     placeholder, a pending key, a key named for a redo, or any key under a
 *     bulk `--redo all`;
 *   - a Markdown page whose content lock says it was made from the current
 *     source, when no --redo files:/content, --force-content or --retranslate
 *     scope reaches it.
 * Values the run replaces are left out, so their old text never counts
 * against the new one. Read-only.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { expectedForTarget, readLocaleFlat, lockKey, discoverLocaleLayout, loadSourceUnits } from './locale-layout.js';
import { originKey } from './plurals.js';
import { decodeWritten, shortSourceHash, valueHash, LockState } from './locale-state.js';
import { SharedOutputIndex, sharedOutputItems } from './validate.js';
import { readLock } from './hash.js';
import { discoverContentFiles, getTargetContentPath } from './content.js';
import { contentItemsFor } from './verify.js';
import { readContentManifest } from './content-sync.js';

/**
 * Items (lib/validate.js sharedOutputItems shape) for the translations of
 * `code` on disk that this run leaves alone.
 *
 * @param {object} p
 * @param {object} p.config - Resolved config (inputLocale, contentDir, format, fallbackPrefix, …)
 * @param {object} p.layout - Locale layout (lib/locale-layout.js)
 * @param {Array<object>} p.units - Source units (loadSourceUnits)
 * @param {string} p.code - Target locale
 * @param {{ written: object, pending: object }} p.localeState - LockState.peek(code)
 * @param {string[]} [p.namedKeys] - Keys named for a redo (source key space, namespaced)
 * @param {boolean} [p.bulk] - `--redo all`: every key is re-translated
 * @param {object|null} [p.fileScope] - lib/file-scope.js (--redo files: / --files / --retranslate)
 * @param {boolean} [p.forceContent] - --force-content / --redo content
 * @param {string} p.cwd - Project directory
 * @returns {Array<{ key: string, source: string, value: string }>}
 */
export function itemsLeftAlone({
  config, layout, units, code, localeState, namedKeys = [], bulk = false, fileScope = null, forceContent = false, cwd,
}) {
  const items = [];
  const fallbackPrefix = config.fallbackPrefix || '[EN] ';
  const named = new Set(namedKeys);
  const written = localeState?.written || {};
  const pending = localeState?.pending || {};

  if (!bulk) {
    for (const unit of units || []) {
      const file = layout.fileFor(code, unit.ns);
      if (!fs.existsSync(file.path)) continue;
      let target;
      try { target = readLocaleFlat(file) || {}; } catch { continue; }
      const { flat: expected, expansion } = expectedForTarget(unit, config.inputLocale, code);
      const changed = new Set(unit.changedKeys || []);
      for (const [k, v] of Object.entries(target)) {
        const src = expected[k];
        if (typeof v !== 'string' || typeof src !== 'string' || v.startsWith(fallbackPrefix)) continue;
        const lk = lockKey(layout, unit.ns, k);
        const origin = originKey(k, expansion);
        if (pending[lk] !== undefined || named.has(lk) || named.has(lockKey(layout, unit.ns, origin))) continue;
        const record = decodeWritten(written[lk]);
        if (record) {
          if (record.source !== shortSourceHash(src) || record.value !== valueHash(v)) continue;
        } else if (changed.has(origin)) {
          continue;
        }
        items.push(...sharedOutputItems(lk, src, v));
      }
    }
  }

  if (config.contentDir && config.format !== 'docusaurus') {
    const contentDir = path.resolve(cwd, config.contentDir);
    const manifest = readContentManifest(cwd);
    let sources = [];
    try { sources = fs.existsSync(contentDir) ? discoverContentFiles(contentDir, config.inputLocale) : []; } catch { sources = []; }
    const leftAlone = new Set();
    for (const sourcePath of sources) {
      const relPath = path.relative(contentDir, sourcePath);
      if (!fs.existsSync(getTargetContentPath(sourcePath, code, config.inputLocale))) continue;
      if (fileScope && !fileScope.includes(relPath)) { leftAlone.add(sourcePath); continue; }
      if (forceContent || (fileScope && fileScope.retranslates(relPath))) continue;
      let hash;
      try { hash = crypto.createHash('sha256').update(fs.readFileSync(sourcePath, 'utf-8'), 'utf-8').digest('hex'); } catch { continue; }
      if (manifest[`${relPath}:${code}`] === hash) leftAlone.add(sourcePath);
    }
    if (leftAlone.size > 0) items.push(...contentItemsFor(config, cwd, code, { only: (p) => leftAlone.has(p) }));
  }
  return items;
}

/**
 * The shared-output index a sync of `code` starts with — ONE construction for
 * sync's gate and for anything else that must refuse what sync refuses (the
 * MCP translate tool with a project_dir): the sentences an earlier sync caught
 * a model repeating (the cache's `_meta.memorized`, refused from their first
 * source on), plus every translation of the locale on disk that the run
 * leaves alone (itemsLeftAlone). Round 10, school persona: the translate tool
 * returned the sentence the project already knew to be memorized, because
 * its index held only that call's answers.
 *
 * @param {object} p
 * @param {object} p.config - Resolved config
 * @param {string} p.cwd - Project directory
 * @param {string} p.code - Target locale
 * @param {object|null} [p.tm] - The project's cache (lib/tm.js loadTM)
 * @param {object} [p.layout] - Locale layout (discovered when absent)
 * @param {Array<object>} [p.units] - Source units (loaded when absent)
 * @param {object} [p.localeState] - LockState.peek(code) (read from the lock when absent)
 * @param {string[]} [p.namedKeys] - Keys named for a redo this run
 * @param {boolean} [p.bulk] - `--redo all`
 * @param {object|null} [p.fileScope] - --redo files: / --files / --retranslate
 * @param {boolean} [p.forceContent] - --force-content / --redo content
 * @returns {SharedOutputIndex}
 */
export function projectSharedOutputIndex({
  config, cwd, code, tm = null, layout = null, units = null, localeState = null,
  namedKeys = [], bulk = false, fileScope = null, forceContent = false,
}) {
  const index = new SharedOutputIndex({ protectedTerms: config.protectedTerms || [] });
  index.markMemorized(tm?._meta?.memorized?.[code] || []);
  let lay = layout;
  let us = units;
  let state = localeState;
  // A project whose key-value files cannot be read (a Docusaurus site, a
  // missing locales folder) still has its pages and its memorized sentences.
  if (!lay || !us) {
    try {
      lay = discoverLocaleLayout(config, { cwd });
      us = loadSourceUnits(lay);
    } catch {
      lay = null;
      us = [];
    }
  }
  if (!state) {
    try { state = new LockState(readLock(cwd).locales).peek(code); } catch { state = { written: {}, pending: {} }; }
  }
  index.add(itemsLeftAlone({
    config, layout: lay, units: lay ? us : [], code, localeState: state, namedKeys, bulk, fileScope, forceContent, cwd,
  }));
  return index;
}
