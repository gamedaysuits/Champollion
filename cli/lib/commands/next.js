/**
 * Command: next
 *
 *   champollion next [project-folder] [--json] [--write]
 *
 * The one question the rails answer: what do we do now? Reads the project's
 * files (never a data file's text), walks its journey (shared/journeys/), and
 * prints THE next step — what to tell the person, why it matters, the exact
 * command when there is one, and how the step must be taken:
 *
 *   auto        an agent may run the command
 *   confirm     run it only after the person says yes (installs, spends, trains)
 *   ask_user    ask the person who holds the data; never answer for them
 *   wait        something is running; ask again later
 *   human_only  only a person can do this (gather sentences, choose a model)
 *
 * Read-only: it runs nothing but nmt-forge's own status check (bounded), and
 * writes nothing unless --write is given (then it rewrites NEXT.md).
 */

import fs from 'node:fs';
import path from 'node:path';
import { nextStep, renderNextMd } from '../framework/journey.js';
import { PROJECT_FILE } from '../framework/index.js';
import { output } from '../output.js';

const MODE_WORDS = {
  auto: 'run it',
  confirm: 'ask first, then run it',
  ask_user: 'ask the person who holds the data — never answer for them',
  wait: 'wait, then ask again',
  human_only: 'a person does this',
};

function projectRoot(start) {
  let dir = start;
  for (;;) {
    if (fs.existsSync(path.join(dir, PROJECT_FILE))) return dir;
    const up = path.dirname(dir);
    if (up === dir) return null;
    dir = up;
  }
}

async function run(args, cwd) {
  if (args._.length > 2) {
    output.error('Usage: champollion next [project-folder] [--json] [--write]');
    return 2;
  }
  const start = path.resolve(cwd, args._[1] || '.');
  if (!fs.existsSync(start)) {
    output.error(`${start} does not exist. Start a project: champollion new <folder> --from <language> --to <language>`);
    return 2;
  }
  const root = projectRoot(start) || start;
  const result = nextStep(root);
  let name = '';
  try {
    name = JSON.parse(fs.readFileSync(path.join(root, PROJECT_FILE), 'utf-8')).name;
  } catch { /* no project file: the first step says so */ }
  if (args.write) fs.writeFileSync(path.join(root, 'NEXT.md'), renderNextMd(result, name), 'utf-8');
  if (args.json) {
    output.raw(JSON.stringify(result, null, 2));
    return result.error && !result.step ? 1 : 0;
  }
  const lines = [''];
  if (result.error && !result.step) {
    lines.push(`  ${result.error}`, '');
    output.raw(lines.join('\n'));
    return 1;
  }
  if (!result.step) {
    lines.push('  Every step on the rails is done.', '');
    if (result.finished) lines.push(`  ${result.finished}`, '');
    for (const w of result.forge?.warnings || []) lines.push(`  ⚠ ${w}`);
    if (result.forge?.warnings?.length) lines.push('');
    output.raw(lines.join('\n'));
    return 0;
  }
  const { stage, step } = result;
  lines.push(`  ${name || path.basename(root)} — stage ${stage.n} of ${stage.of}: ${stage.title}`, '');
  if (step.question) lines.push(`  Ask: ${step.question}`, '');
  lines.push(`  ${step.say}`, '');
  if (step.command) lines.push(`    ${step.command}`, '');
  lines.push(`  How: ${MODE_WORDS[step.mode] || step.mode}`);
  if (step.why) lines.push(`  Why: ${step.why}`);
  for (const b of result.forge?.blockers || []) lines.push(`  ✗ ${b}`);
  for (const w of result.forge?.warnings || []) lines.push(`  ⚠ ${w}`);
  lines.push('');
  output.raw(lines.join('\n'));
  return 0;
}

export { run };
