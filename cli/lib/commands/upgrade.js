/**
 * Command: upgrade
 *
 *   champollion upgrade [folder] [--dry] [--json]
 *
 * Rewrites a project's older framework files in the format every tool now
 * shares, losing nothing:
 *   - a data sidecar written before set/1 (<file>.champollion.json with no
 *     $schema) becomes set/1 — every value kept, a key set/1 does not know
 *     moved under x-<key> (upgradeSet, the conversion every writer uses);
 *   - an invalid sidecar is NOT touched — it states how its data may be
 *     used, and a person fixes it (champollion validate says what is wrong);
 *   - a method.json written before method/1 is listed and left as it is: its
 *     old shape still carries settings the tools read from it (a CLI
 *     plugin's register and quality tier; a harness plugin's metric plugins)
 *     that method/1 has no place for yet. Every tool reads it as method/0.
 * Nothing is deleted. --dry says what would change and writes nothing.
 */

import fs from 'node:fs';
import path from 'node:path';
import { methodFiles, readSet, sidecars, SIDECAR_SUFFIX, upgradeSet } from '../framework/index.js';
import { readMethod } from '../framework/method.js';
import { output } from '../output.js';

/** Why an old method.json is left as it is, by its shape. */
const METHOD_KEPT = {
  'cli-plugin': 'a CLI plugin manifest: its register, quality tier and prompt context have no place in method/1 yet',
  'harness-plugin': 'a harness plugin manifest: the metric plugins and model it names are read from the old shape',
};

/**
 * What upgrading `root` would do (or does, unless dry).
 * @returns {{sets: object[], methods: object[]}}
 */
export function upgradeProject(root, { dry = false } = {}) {
  const rel = (p) => path.relative(root, p).split(path.sep).join('/') || p;
  const sets = [];
  for (const side of sidecars(root)) {
    const read = readSet(side.slice(0, -SIDECAR_SUFFIX.length));
    if (read.errors.length) {
      sets.push({ file: rel(side), action: 'left — invalid, fix it by hand', errors: read.errors });
      continue;
    }
    if (read.version !== 0) continue;
    const up = upgradeSet(read.data);
    if (up.errors.length) {
      sets.push({ file: rel(side), action: 'left — would not be valid set/1', errors: up.errors });
      continue;
    }
    if (!dry) fs.writeFileSync(side, JSON.stringify(up.doc, null, 2) + '\n', 'utf-8');
    sets.push({ file: rel(side), action: dry ? 'would become set/1' : 'set/0 → set/1', renamed: up.renamed });
  }
  const methods = [];
  for (const f of methodFiles(root)) {
    const read = readMethod(f);
    if (read.version === 0) {
      methods.push({ file: rel(f), action: 'kept as method/0', why: METHOD_KEPT[read.shape] || 'an older shape' });
    }
  }
  return { sets, methods };
}

async function run(args, cwd) {
  if (args._.length > 2) {
    output.error('Usage: champollion upgrade [folder] [--dry]');
    return 2;
  }
  const root = path.resolve(cwd, args._[1] || '.');
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
    output.error(`${root} is not a folder`);
    return 2;
  }
  const dry = args.dry === true || args['dry-run'] === true;
  const report = upgradeProject(root, { dry });
  if (args.json) {
    output.raw(JSON.stringify({ root, dry, ...report }, null, 2));
    return 0;
  }
  const lines = ['', `  champollion upgrade${dry ? ' --dry' : ''} — ${root}`, ''];
  if (!report.sets.length && !report.methods.length) lines.push('  nothing older than the current formats here');
  for (const s of report.sets) {
    lines.push(`  ${s.file}  ${s.action}`
      + (s.renamed?.length ? ` (kept under x-: ${s.renamed.join(', ')})` : ''));
    for (const e of s.errors || []) lines.push(`      ✗ ${e}`);
  }
  for (const m of report.methods) lines.push(`  ${m.file}  ${m.action} — ${m.why}`);
  lines.push('');
  if (dry && report.sets.some((s) => s.action === 'would become set/1')) {
    lines.push('  nothing was written; run without --dry to upgrade');
  } else {
    lines.push('  nothing was deleted. champollion validate checks the result.');
  }
  lines.push('');
  output.raw(lines.join('\n'));
  return 0;
}

export { run };
