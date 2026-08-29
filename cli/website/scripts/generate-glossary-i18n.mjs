#!/usr/bin/env node
/**
 * generate-glossary-i18n.mjs — flatten the glossary SSOT into the
 * champollion Phase-1 source file.
 *
 *   cli/shared/explainers/glossary.json  →  cli/website/i18n/en/glossary.json
 *
 * The output is a flat Docusaurus {message, description} file, so
 * `champollion sync` (run from cli/website by scripts/champollion_sync_gate.sh
 * on pre-push) discovers it exactly like code.json and translates it into
 * i18n/<locale>/glossary.json through the TM'd pipeline. At build time
 * plugins/shared-data merges those translations back over the SSOT into
 * data/explainers/glossary.<locale>.json (see mergeGlossaryLocale.js for the
 * full pipeline contract and the translated-vs-canonical field split).
 *
 * Deterministic (SSOT order) and idempotent: the file is only rewritten when
 * its content actually changes, so an unchanged SSOT produces no i18n drift.
 *
 * Run directly (`node scripts/generate-glossary-i18n.mjs`) or via
 * `npm run glossary:i18n` in cli/website.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

// The merge module is CJS (it is also required by the Docusaurus plugin).
const require = createRequire(import.meta.url);
const { buildGlossarySource } = require('../plugins/shared-data/mergeGlossaryLocale.js');

const SITE_DIR = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

/**
 * Generate the Phase-1 glossary source file.
 * @param {object} [opts]
 * @param {string} [opts.ssotFile] — path to the English glossary SSOT
 * @param {string} [opts.outFile] — path to the i18n/en output file
 * @returns {{keys: number, wrote: boolean, outFile: string}}
 */
export function generateGlossaryI18nSource({
  ssotFile = path.join(SITE_DIR, '..', 'shared', 'explainers', 'glossary.json'),
  outFile = path.join(SITE_DIR, 'i18n', 'en', 'glossary.json'),
} = {}) {
  const ssot = JSON.parse(fs.readFileSync(ssotFile, 'utf-8'));
  const source = buildGlossarySource(ssot);
  const serialized = JSON.stringify(source, null, 2) + '\n';

  const current = fs.existsSync(outFile) ? fs.readFileSync(outFile, 'utf-8') : null;
  const wrote = current !== serialized;
  if (wrote) {
    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    fs.writeFileSync(outFile, serialized, 'utf-8');
  }
  return { keys: Object.keys(source).length, wrote, outFile };
}

// CLI entrypoint (import-safe for tests).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { keys, wrote, outFile } = generateGlossaryI18nSource();
  const rel = path.relative(process.cwd(), outFile);
  console.log(
    wrote
      ? `[glossary-i18n] wrote ${keys} key(s) → ${rel}`
      : `[glossary-i18n] up to date (${keys} key(s)) — ${rel}`
  );
}
