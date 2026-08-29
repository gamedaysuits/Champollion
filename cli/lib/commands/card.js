/**
 * Command: card
 *
 * Pretty-prints a language card from shared/language-cards/.
 *
 * Usage:
 *   champollion card crk         — Show Plains Cree card
 *   champollion card spa         — Show Spanish card
 *   champollion card crk --json  — Output raw JSON
 *
 * WHY: Language cards are deeply nested JSON files with 50+ fields.
 * Developers and contributors need a quick way to inspect a card's
 * key properties without scrolling through raw JSON. This command
 * formats the card into logical sections with ANSI colors for
 * scannability.
 *
 * Exit codes:
 *   0 — Card displayed successfully
 *   1 — Missing code argument or card not found
 */

import { getLanguageCard, resolveCode } from '../registers.js';

// -----------------------------------------------------------------
// ANSI formatting helpers — built-in, no external deps
//
// We use raw ANSI escape sequences instead of chalk/kleur because
// the project rule is zero external dependencies. These helpers are
// intentionally simple — just enough for readable terminal output.
// -----------------------------------------------------------------

const isTTY = process.stdout.isTTY;

/** Wrap text in an ANSI escape code pair, but only if stdout is a TTY. */
function ansi(code, resetCode, text) {
  if (!isTTY) return text;
  return `\x1b[${code}m${text}\x1b[${resetCode}m`;
}

const fmt = {
  bold:    (t) => ansi('1', '22', t),
  dim:     (t) => ansi('2', '22', t),
  cyan:    (t) => ansi('36', '39', t),
  green:   (t) => ansi('32', '39', t),
  yellow:  (t) => ansi('33', '39', t),
  red:     (t) => ansi('31', '39', t),
  magenta: (t) => ansi('35', '39', t),
  white:   (t) => ansi('37', '39', t),
};

// -----------------------------------------------------------------
// Section renderers — each handles one logical block of the card
// -----------------------------------------------------------------

/**
 * Print a section heading with a decorative underline.
 * @param {string} title - Section title
 */
function heading(title) {
  console.log('');
  console.log(`  ${fmt.bold(fmt.cyan(title))}`);
  console.log(`  ${fmt.dim('─'.repeat(title.length))}`);
}

/**
 * Print a labeled key-value pair, with optional value formatting.
 * @param {string} label - Field label (left-aligned)
 * @param {*} value - Field value (auto-formatted)
 * @param {number} [pad=24] - Label padding width
 */
function field(label, value, pad = 24) {
  if (value === null || value === undefined || value === '') return;
  let v = value;
  // An attribution envelope reaching a human unrendered is a bug a unit test
  // never sees and a user sees instantly — Family printed as raw JSON. Where
  // sources AGREE the consensus speaks; where they DISAGREE the card shows all
  // of them attributed, which is the project's standing rule, in one line.
  if (v && typeof v === 'object' && typeof v.agreement === 'string' && Array.isArray(v.values)) {
    v = 'consensus' in v
      ? v.consensus
      : v.values.map((x) => `${x.value} (${String(x.source).replace(/-v?[\d.].*$/, '')})`).join(' / ');
  }
  const displayValue = typeof v === 'object' ? JSON.stringify(v) : String(v);
  console.log(`    ${fmt.dim(label.padEnd(pad))} ${displayValue}`);
}

/**
 * Print the header section: name, native name, codes, script, vitality.
 */
function renderHeader(card) {
  // Title line — large and bold
  const vitalityBadge = getVitalityBadge(card.vitality?.unescoStatus);
  console.log('');
  console.log(`  ${fmt.bold(card.name)}${card.nativeName ? `  ${fmt.dim('—')}  ${card.nativeName}` : ''}`);
  if (vitalityBadge) {
    console.log(`  ${vitalityBadge}`);
  }

  heading('Identification');
  field('ISO 639-3', card.iso639_3);
  field('ISO 639-1', card.iso639_1);
  field('BCP 47', card.bcp47);
  field('Glottocode', card.glottocode);
  field('Script', card.script ? `${card.script}${card.scriptUnicodeName ? ` (${card.scriptUnicodeName})` : ''}` : null);
  field('Direction', card.dir);
  field('Script converter', card.scriptConverter);
  field('Support tier', formatSupportTier(card.supportTier));
  if (card.macrolanguage) {
    field('Macrolanguage', card.macrolanguage);
  }
  if (card.aliases && card.aliases.length > 0) {
    field('Aliases', card.aliases.join(', '));
  }
}

/**
 * Format UNESCO vitality status as a colored badge.
 */
function getVitalityBadge(status) {
  if (!status) return null;
  const badges = {
    'safe':                   fmt.green('● safe'),
    'vulnerable':             fmt.yellow('● vulnerable'),
    'definitely-endangered':  fmt.yellow('● definitely endangered'),
    'severely-endangered':    fmt.red('● severely endangered'),
    'critically-endangered':  fmt.red('● critically endangered'),
    'extinct':                fmt.dim('○ extinct'),
  };
  return badges[status] || fmt.dim(`● ${status}`);
}

/**
 * Format support tier with color.
 */
function formatSupportTier(tier) {
  if (!tier) return null;
  const tiers = {
    'supported':    fmt.green(tier),
    'experimental': fmt.yellow(tier),
    'developing':   fmt.yellow(tier),
    'cataloged':    fmt.dim(tier),
    'community':    fmt.cyan(tier),
  };
  return tiers[tier] || tier;
}

/**
 * Print classification section: family, genus, macroarea.
 */
function renderClassification(card) {
  if (!card.classification && !card.macroarea) return;

  heading('Classification');
  if (card.classification) {
    field('Family', card.classification.family);
    field('Genus', card.classification.genus);
    if (card.classification.ancestry) {
      field('Ancestry', card.classification.ancestry.join(' → '));
    }
  }
  field('Macroarea', card.macroarea);
  if (card.isIsolate) {
    field('Language isolate', fmt.yellow('yes'));
  }
  if (card.countries && card.countries.length > 0) {
    field('Countries', card.countries.join(', '));
  }
}

/**
 * Print speaker estimates section.
 */
function renderSpeakers(card) {
  const estimates = card.speakerEstimates;
  const vitalityCount = card.vitality?.speakerCount;

  if ((!estimates || estimates.length === 0) && !vitalityCount) return;

  heading('Speaker Estimates');

  if (vitalityCount) {
    field('Total (vitality)', typeof vitalityCount === 'number' ? vitalityCount.toLocaleString() : vitalityCount);
  }
  if (estimates) {
    for (const est of estimates) {
      const label = `${est.source}${est.date ? ` (${est.date})` : ''}`;
      field(label, typeof est.count === 'number' ? est.count.toLocaleString() : est.count);
    }
  }
  if (card.vitality?.trend) {
    field('Trend', card.vitality.trend);
  }
}

/**
 * Print typological profile section.
 */
function renderTypology(card) {
  // Pull from encyclopedic.typology (richer) or typologicalProfile
  const typ = card.encyclopedic?.typology;
  const profile = card.typologicalProfile;

  if (!typ && !profile) return;

  heading('Typological Profile');

  if (typ) {
    field('Word order', typ.wordOrder);
    field('Adpositions', typ.adpositionType);
    field('Affixation', typ.affixType);
    field('Verb synthesis', typ.verbSynthesis);
    field('Morphological fusion', typ.morphologicalFusion);
    field('Consonants', typ.consonantInventory);
    field('Vowels', typ.vowelInventory);
    field('Tone', typ.tone);
    field('Cases', typ.cases);
    field('Genders', typ.genders);
  } else if (profile) {
    // PRINT WHAT THE CARD CARRIES, not a list of field names typed in once.
    //
    // This used to name ten fixed keys — wordOrderDominant, hasGenderSystem,
    // hasCaseMorphology and so on. The atlas emits the Grambank/WALS feature
    // names instead (subjectVerbOrder, hasCoreCase, affixPreference,
    // marksPastTense …), so every one of those lookups returned undefined and
    // the section printed its heading over nothing while the card held twenty
    // populated features.
    //
    // Enumerating the object cannot go stale that way: a feature the atlas
    // starts publishing shows up without an edit here, and one it stops
    // publishing disappears rather than printing blank.
    const label = (key) => {
      const spaced = key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase();
      return spaced.charAt(0).toUpperCase() + spaced.slice(1);
    };
    for (const [key, value] of Object.entries(profile)) {
      if (key === 'source' || key.startsWith('_')) continue;
      if (value === null || value === undefined || value === '') continue;
      field(label(key), typeof value === 'boolean' ? (value ? 'yes' : 'no') : value);
    }
  }

  if (profile?.source) {
    field('Source', fmt.dim(profile.source));
  }
}

/**
 * Print corpus availability section.
 */
function renderCorpus(card) {
  const corpus = card.corpusAvailability;
  if (!corpus) return;

  heading('Corpus Availability');

  if (corpus.opus) {
    const opusInfo = [];
    if (corpus.opus.corpora) opusInfo.push(`${corpus.opus.corpora} corpora`);
    if (corpus.opus.languagePairs) opusInfo.push(`${corpus.opus.languagePairs} lang pairs`);
    if (corpus.opus.totalAlignmentPairs) opusInfo.push(`${corpus.opus.totalAlignmentPairs.toLocaleString()} alignment pairs`);
    field('OPUS', opusInfo.join(', '));
    if (corpus.opus.corpusNames && corpus.opus.corpusNames.length > 0) {
      field('  Top corpora', corpus.opus.corpusNames.slice(0, 5).join(', '));
    }
  }
  if (corpus.lexibank) {
    field('Lexibank', `${corpus.lexibank.datasets} datasets, ${corpus.lexibank.totalForms} forms`);
  }
  if (corpus.ud) {
    field('Universal Deps', `${corpus.ud.treebanks} treebanks: ${corpus.ud.treebankNames?.join(', ') || ''}`);
  }
  if (corpus.asjpWordlists) field('ASJP', `${corpus.asjpWordlists} wordlist(s), ${corpus.asjpForms || '?'} forms`);
  if (corpus.huggingFaceDatasets) field('HuggingFace', `${corpus.huggingFaceDatasets} datasets`);
  if (corpus.unimorphParadigms) field('UniMorph', fmt.green('✓'));
  if (corpus.wiktionaryStructuredDump) field('Wiktionary dump', fmt.green('✓'));
  if (corpus.openMultilingualWordnet) field('Open Multilingual WN', fmt.green('✓'));
}

/**
 * Print eval datasets section.
 */
function renderEval(card) {
  if (!card.evalDatasets || card.evalDatasets.length === 0) return;

  heading('Eval Datasets');
  for (const ds of card.evalDatasets) {
    console.log(`    ${fmt.cyan('•')} ${ds}`);
  }
  if (card.omt1600) {
    // The OMT-1600 paper publishes no per-language tier table, so `tier` is
    // null on most covered languages. Print the clause only when there is a
    // cited tier — never "tier null".
    const tier = card.omt1600.tier ? ` — tier ${card.omt1600.tier}` : '';
    field('OMT-1600', card.omt1600.covered ? `${fmt.green('covered')}${tier}` : fmt.dim('not covered'));
  }
}

/**
 * Print pipeline readiness section.
 */
function renderPipeline(card) {
  const pr = card.pipelineReadiness;
  if (!pr) return;

  heading('Pipeline Readiness');

  // Score bar — visual indicator of readiness
  const score = typeof pr.score === 'number' ? pr.score : null;
  if (score !== null) {
    const barWidth = 20;
    const filled = Math.round((score / 100) * barWidth);
    const bar = '█'.repeat(filled) + '░'.repeat(barWidth - filled);
    const colorFn = score >= 70 ? fmt.green : score >= 40 ? fmt.yellow : fmt.red;
    field('Score', `${colorFn(bar)} ${score}/100 (${pr.tier || ''})`);
  } else {
    field('Tier', pr.tier);
  }

  // Component checklist
  if (pr.components) {
    const checks = Object.entries(pr.components)
      .map(([key, val]) => `${val ? fmt.green('✓') : fmt.dim('✗')} ${key}`)
      .join('   ');
    console.log(`    ${checks}`);
  }
}

/**
 * Print method support section.
 */
function renderMethods(card) {
  const methods = card.methodSupport;
  if (!methods) return;

  heading('Method Support');

  const methodNames = {
    googleTranslate:     'Google Translate',
    deepl:               'DeepL',
    microsoftTranslator: 'Microsoft Translator',
    libreTranslate:      'LibreTranslate',
    nllb:                'NLLB-200',
    llm:                 'LLM (OpenRouter)',
    microsoft:           'Microsoft',
  };

  for (const [key, info] of Object.entries(methods)) {
    const label = methodNames[key] || key;
    const supported = info?.supported;
    const badge = supported ? fmt.green('✓ supported') : fmt.dim('✗ unsupported');
    let extra = '';
    if (info?.formality) extra += ` ${fmt.cyan('(formality)')}`;
    if (info?.code) extra += ` ${fmt.dim(`[${info.code}]`)}`;
    if (info?.verifiedDate) extra += ` ${fmt.dim(`verified ${info.verifiedDate}`)}`;
    field(label, `${badge}${extra}`);
  }
}

/**
 * Print data sources count and cultural aphorism.
 */
function renderFooter(card) {
  // Data sources count
  if (card.dataSources && card.dataSources.length > 0) {
    heading('Data Sources');
    field('Count', `${card.dataSources.length} sources`);
    // Show first few and last few if there are many
    if (card.dataSources.length <= 8) {
      field('Sources', card.dataSources.join(', '));
    } else {
      const preview = [...card.dataSources.slice(0, 5), `… +${card.dataSources.length - 5} more`];
      field('Sources', preview.join(', '));
    }
  }

  // Cultural aphorism — a nice touch at the bottom
  if (card.culturalAphorism) {
    heading('Cultural Aphorism');
    console.log(`    ${fmt.magenta(`"${card.culturalAphorism.text}"`)}`);
    if (card.culturalAphorism.translation) {
      console.log(`    ${fmt.dim(`— "${card.culturalAphorism.translation}"`)}`);
    }
  }

  // Notes
  if (card.notes) {
    console.log('');
    console.log(`  ${fmt.dim('Note:')} ${fmt.dim(card.notes)}`);
  }

  console.log('');
}

// -----------------------------------------------------------------
// Main entry point
// -----------------------------------------------------------------

/**
 * @param {import('../types.js').CLIArgs} args - Parsed CLI arguments
 * @param {string} cwd - Working directory
 * @returns {Promise<number>} Exit code (0 = success, 1 = error)
 */
async function run(args, cwd) {
  const code = args._[1];

  // ── Validate: code argument is required ──
  if (!code) {
    console.error('[ERR] Missing language code argument.');
    console.error('');
    console.error('  Usage: champollion card <code> [--json]');
    console.error('');
    console.error('  Examples:');
    console.error('    champollion card crk        # Plains Cree');
    console.error('    champollion card spa        # Spanish');
    console.error('    champollion card cmn --json # Raw JSON');
    console.error('');
    return 1;
  }

  // ── Resolve the code (follow aliases like 'fr' → 'fra') ──
  const resolvedCode = resolveCode(code);
  const card = getLanguageCard(resolvedCode);

  if (!card) {
    console.error(`[ERR] No language card found for "${code}".`);
    if (code !== resolvedCode) {
      console.error(`      (resolved alias to "${resolvedCode}", but no card exists)`);
    }
    console.error('');
    console.error('      Run "champollion doctor cards" to check card coverage.');
    return 1;
  }

  // ── --json mode: output raw JSON and exit ──
  if (args.json) {
    console.log(JSON.stringify(card, null, 2));
    return 0;
  }

  // ── Pretty-print mode: render each section ──
  renderHeader(card);
  renderClassification(card);
  renderSpeakers(card);
  renderTypology(card);
  renderCorpus(card);
  renderEval(card);
  renderPipeline(card);
  renderMethods(card);
  renderFooter(card);

  return 0;
}

export { run };
