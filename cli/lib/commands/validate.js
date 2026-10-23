/**
 * Command: validate
 *
 * Checks a project on the rails: its champollion.project.json, every
 * data sidecar (<file>.champollion.json) under it, every method.json
 * (at its root, in methods/*\/ and .champollion/methods/*\/), its gate
 * chains (gates/*.json) and its deployments (deploy/*.json), against the
 * framework schemas every tool shares (lib/framework/). The harness reads the same
 * files with the same verdicts — so "valid here" means valid for mt-eval and
 * nmt-forge too.
 *
 * Read only, content-free: it opens the project file and the sidecars (small
 * JSON files) and never a data file. Exit 0 = no errors (warnings allowed),
 * 1 = at least one document is invalid, 2 = usage error.
 */

import fs from 'node:fs';
import path from 'node:path';
import { checkProject, PROJECT_FILE } from '../framework/index.js';
import { output } from '../output.js';

function rel(root, p) {
  return path.relative(root, p).split(path.sep).join('/') || p;
}

/**
 * @param {import('../types.js').CLIArgs} args
 * @param {string} cwd
 * @returns {Promise<number>}
 */
async function run(args, cwd) {
  const extra = args._.slice(2);
  if (extra.length) {
    output.error(`validate takes one folder; got also: ${extra.join(' ')}`);
    return 2;
  }
  const root = path.resolve(cwd, args._[1] || '.');
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
    output.error(`${root} is not a folder. Usage: champollion validate [project-folder]`);
    return 2;
  }
  const report = checkProject(root);
  if (args.json) {
    output.raw(JSON.stringify(report, null, 2));
    return report.ok ? 0 : 1;
  }

  const lines = ['', `  champollion validate — ${root}`, ''];
  const { project, sets } = report;
  if (project.exists) {
    lines.push(`  ${PROJECT_FILE}  ${project.errors.length ? '✗' : '✓'} project/${project.version ?? '?'}`);
    for (const e of project.errors) lines.push(`      ✗ ${e}`);
    for (const w of project.warnings) lines.push(`      ⚠ ${w}`);
  } else {
    lines.push(`  ${PROJECT_FILE}  not here (a folder of data files is checked all the same)`);
  }
  if (sets.length === 0) {
    lines.push('  no data sidecars (<file>.champollion.json) under this folder');
  }
  for (const s of sets) {
    const mark = s.errors.length ? '✗' : s.warnings.length ? '⚠' : '✓';
    const ver = s.version === null ? '?' : s.version;
    lines.push(`  ${rel(root, s.path)}  ${mark} set/${ver}`);
    for (const e of s.errors) lines.push(`      ✗ ${e}`);
    for (const w of s.warnings) lines.push(`      ⚠ ${w}`);
  }
  const methods = report.methods || [];
  for (const m of methods) {
    const mark = m.errors.length ? '✗' : m.warnings.length ? '⚠' : '✓';
    lines.push(`  ${m.file}  ${mark} method/${m.version === null ? '?' : m.version}`);
    for (const e of m.errors) lines.push(`      ✗ ${e}`);
    for (const w of m.warnings) lines.push(`      ⚠ ${w}`);
  }
  const documents = report.documents || [];
  for (const d of documents) {
    const mark = d.errors.length ? '✗' : d.warnings.length ? '⚠' : '✓';
    lines.push(`  ${d.file}  ${mark} ${d.type}/${d.version === null ? '?' : d.version}`);
    for (const e of d.errors) lines.push(`      ✗ ${e}`);
    for (const w of d.warnings) lines.push(`      ⚠ ${w}`);
  }
  const nErr = (project.errors.length ? 1 : 0) + sets.filter((s) => s.errors.length).length
    + methods.filter((m) => m.errors.length).length
    + documents.filter((d) => d.errors.length).length;
  const nWarn = (project.warnings.length ? 1 : 0) + sets.filter((s) => s.warnings.length).length
    + methods.filter((m) => m.warnings.length).length
    + documents.filter((d) => d.warnings.length).length;
  lines.push('');
  lines.push(report.ok
    ? `  valid${nWarn ? ` — ${nWarn} file(s) with warnings` : ''}. mt-eval and nmt-forge read these files the same way.`
    : `  ${nErr} file(s) invalid${nWarn ? `, ${nWarn} with warnings` : ''}. A sidecar states how its data may be used — fix it rather than delete it.`);
  lines.push('');
  output.raw(lines.join('\n'));
  return report.ok ? 0 : 1;
}

export { run };
