/**
 * locale-presets.js — the quick-pick locale groups `champollion init` expands
 * (`--langs european,ja`), read from shared/catalogue/locale-presets.json.
 *
 * WHY a data file: the groups used to be a constant in init.js, typed a
 * second time into the wizard's hint and a third time into `help init` —
 * three copies of one list, and language sets hardcoded in code (CLAUDE.md:
 * data over code). Now init, its hint and the help text all read this file.
 *
 * Missing file = a broken install: fail loud, never expand nothing silently.
 */

import fs from 'node:fs';
import path from 'node:path';

const DIRS = [
  path.join(import.meta.dirname, '..', 'shared', 'catalogue'),
  path.join(import.meta.dirname, '..', '..', 'shared', 'catalogue'),
];
const FILE = 'locale-presets.json';

let cache = null;

/** @returns {Record<string, string[]>} preset name → locale codes */
export function localePresets() {
  if (cache) return cache;
  for (const dir of DIRS) {
    let text;
    try {
      text = fs.readFileSync(path.join(dir, FILE), 'utf-8');
    } catch {
      continue;
    }
    const data = JSON.parse(text);
    if (!data || typeof data.presets !== 'object') {
      throw new Error(`${path.join(dir, FILE)} has no "presets" object`);
    }
    cache = data.presets;
    return cache;
  }
  throw new Error(`${FILE} is missing from this install (looked in `
    + `${DIRS.join(', ')}); reinstall champollion from a tagged release.`);
}

/** "european (fr,de,es,it,pt,nl) | asian (ja,zh,ko) | …" for hints. */
export function describePresets() {
  return Object.entries(localePresets())
    .map(([name, codes]) => `${name} (${codes.join(',')})`).join(' | ');
}

/** "european, asian, global, nordic" for help text. */
export function presetNames() {
  return Object.keys(localePresets()).join(', ');
}
