/**
 * Command: recommend
 *
 * Method guidance for a language pair — availability + cited evidence, and
 * the open models whose own model card declares the target (runnable via
 * local-model, no published evidence: a claim to benchmark — the same
 * candidates the MCP language_overview suggests). CLI port of `mt-eval
 * recommend` (arena/mt_eval_harness/recommend.py); the assembly/honesty
 * logic lives in lib/recommend.js.
 *
 * Usage:
 *   champollion network recommend eng yor                    # Human-readable guidance
 *   champollion network recommend eng-yor                    # the same pair, written as one
 *   champollion network recommend "eng>yor"                  # (or --pair "eng>yor")
 *   champollion network recommend eng yor --use commercial   # STRICT commercial lane
 *   champollion network recommend eng yor --json             # Machine-readable payload
 */

import { output } from '../output.js';
import { recommend, renderText } from '../recommend.js';
import { resolveCode } from '../registers.js';
import { parseLanguagePair } from '../language-pair.js';

const USE_CONTEXTS = ['non-commercial', 'commercial'];

function usageError(why) {
  output.error(why);
  output.error('Usage: champollion network recommend <src> <tgt> [--use commercial] [--json]');
  output.error('   or: champollion network recommend eng-yor   (or "eng>yor", or --pair "eng>yor")');
  output.error('Example: champollion network recommend eng yor');
  return 1;
}

/**
 * The pair, from two codes (`recommend eng yor`) or one pair in any spelling
 * lib/language-pair.js reads (`recommend eng-yor`, `recommend "eng>yor"`,
 * `--pair eng-yor`) — Round 10: the other network commands took a pair as
 * one value, and `recommend eng-crk` answered "requires a source and target".
 *
 * @returns {{ok: true, source: string, target: string} | {ok: false, error: string}}
 */
function readPairArgs(args) {
  const words = args._.slice(1);
  if (args.pair !== undefined && args.pair !== false) {
    if (words.length > 0) return { ok: false, error: `Give the pair once: --pair ${args.pair === true ? '' : args.pair} or ${words.join(' ')}, not both.` };
    return parseLanguagePair(args.pair, { label: '--pair' });
  }
  if (words.length >= 2) return { ok: true, source: words[0], target: words[1] };
  if (words.length === 1) return parseLanguagePair(words[0], { label: 'recommend' });
  return { ok: false, error: 'recommend requires a source and target language code.' };
}

/**
 * @param {import('../types.js').CLIArgs} args - Parsed CLI arguments
 * @param {string} cwd - Working directory
 * @returns {Promise<number>} Exit code (0 = success, 1 = error)
 */
async function run(args, cwd) {
  const pairIn = readPairArgs(args);
  if (!pairIn.ok) return usageError(pairIn.error);
  const srcInput = pairIn.source;
  const tgtInput = pairIn.target;

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
