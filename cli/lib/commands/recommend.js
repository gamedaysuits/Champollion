/**
 * Command: recommend
 *
 * Method guidance for a language pair — availability + cited evidence.
 * CLI port of `mt-eval recommend` (arena/mt_eval_harness/recommend.py); the
 * assembly/honesty logic lives in lib/recommend.js.
 *
 * Usage:
 *   champollion recommend eng yor                    # Human-readable guidance
 *   champollion recommend eng yor --use commercial   # STRICT commercial lane
 *   champollion recommend eng yor --json             # Machine-readable payload
 */

import { output } from '../output.js';
import { recommend, renderText } from '../recommend.js';
import { resolveCode } from '../registers.js';

const USE_CONTEXTS = ['non-commercial', 'commercial'];

/**
 * @param {import('../types.js').CLIArgs} args - Parsed CLI arguments
 * @param {string} cwd - Working directory
 * @returns {Promise<number>} Exit code (0 = success, 1 = error)
 */
async function run(args, cwd) {
  const srcInput = args._[1];
  const tgtInput = args._[2];
  if (!srcInput || !tgtInput) {
    output.error('recommend requires a source and target language code.');
    output.error('Usage: champollion recommend <src> <tgt> [--use commercial] [--json]');
    output.error('Example: champollion recommend eng yor');
    return 1;
  }

  // The evidence indexes are keyed by ISO 639-3; accept the 2-letter codes a
  // champollion.config.json uses (en → eng, zh → cmn) via the language-card
  // alias bridge, and surface the resolution rather than silently relabelling.
  const src = resolveCode(srcInput);
  const tgt = resolveCode(tgtInput);

  // --use is a string flag; a bare `--use` parses as boolean true — treat it
  // as invalid rather than silently defaulting.
  const useContext = (args.use == null || args.use === false)
    ? 'non-commercial'
    : String(args.use);
  if (!USE_CONTEXTS.includes(useContext)) {
    output.error(`Invalid --use value "${useContext}". Valid lanes: ${USE_CONTEXTS.join(', ')}.`);
    return 1;
  }

  const payload = recommend(src, tgt, { useContext, cwd });
  if (src !== srcInput) payload.pair.source_input = srcInput;
  if (tgt !== tgtInput) payload.pair.target_input = tgtInput;

  if (args.json) {
    // Single JSON document on stdout (mirrors `mt-eval recommend --json`) —
    // keep stdout pure for piping into jq.
    console.log(JSON.stringify(payload, null, 2));
    return 0;
  }

  output.raw('');
  if (src !== srcInput || tgt !== tgtInput) {
    const resolved = [];
    if (src !== srcInput) resolved.push(`${srcInput} → ${src}`);
    if (tgt !== tgtInput) resolved.push(`${tgtInput} → ${tgt}`);
    output.raw(`(codes resolved to ISO 639-3: ${resolved.join(', ')})`);
    output.raw('');
  }
  output.raw(renderText(payload));
  output.raw('');
  return 0;
}

export { run };
