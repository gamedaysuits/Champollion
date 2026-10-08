/**
 * Command: card
 *
 * Pretty-prints a language card from shared/language-cards/.
 *
 * Usage:
 *   champollion network card crk         — Show Plains Cree card
 *   champollion network card spa         — Show Spanish card
 *   champollion network card crk --json  — Output raw JSON
 *
 * WHY: Language cards are deeply nested JSON files with 50+ fields.
 * Developers and contributors need a quick way to inspect a card's
 * key properties without scrolling through raw JSON. This command
 * formats the card into logical sections with ANSI colors for
 * scannability.
 *
 * TWO RULES THE OUTPUT KEEPS (the index invariant, made visible):
 *   1. Where sources disagree, every value is printed with its source and
 *      none is elected. A disputed attribution envelope never collapses to
 *      one line — endangerment printed as a single "● vulnerable" once hid
 *      five assessments on three scales for Plains Cree.
 *   2. A section heading is never printed over nothing. Absence on a card
 *      means UNKNOWN, so an empty section says "not recorded on this card"
 *      and, where there is one, names the command that answers the question
 *      for a pair. A bare heading reads as a rendering failure.
 *
 * Exit codes:
 *   0 — Card displayed successfully
 *   1 — Missing code argument or card not found
 */

import { getLanguageCard, resolveCode } from '../registers.js';
import {
  AGREEMENT,
  attributedFields,
  attributions,
  display,
  isAttributed,
  isDisputed,
  readCard,
} from '../cards/reader.js';

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

const PAD = 24;
const NOTE_MAX = 100;
const LIST_CAP = 5;

/** The words for an empty section. Absence is unknown — never "none". */
const NOT_RECORDED = 'not recorded on this card (unknown, not "none")';

/** What a disagreement looks like, in the reader's words, per agreement. */
const AGREEMENT_NOTE = {
  [AGREEMENT.CONFLICTING]: 'sources differ — every value shown, none elected',
  [AGREEMENT.INCOMMENSURABLE]: 'sources use different scales — every value shown, none elected',
  [AGREEMENT.MULTIPLE_ASSESSMENTS]: 'several assessments — every value shown',
  [AGREEMENT.MULTIPLE_VARIANTS]: 'several variants — every value shown',
  [AGREEMENT.UNANIMOUS]: 'sources agree',
};

// -----------------------------------------------------------------
// Output primitives — every renderer appends to ctx.out
// -----------------------------------------------------------------

/**
 * Print a section heading with a decorative underline.
 */
function heading(ctx, title) {
  ctx.out.push('');
  ctx.out.push(`  ${fmt.bold(fmt.cyan(title))}`);
  ctx.out.push(`  ${fmt.dim('─'.repeat(title.length))}`);
}

/**
 * A section whose body is guaranteed to say something.
 *
 * If the body prints nothing, the empty lines are printed instead — so a
 * heading can never stand over a blank, whatever shape the card arrived in
 * (the published projection ships `{}` for fields no source fills).
 *
 * @param {object} ctx
 * @param {string} title
 * @param {() => void} body
 * @param {string[]} [emptyLines]
 */
function section(ctx, title, body, emptyLines = [NOT_RECORDED]) {
  heading(ctx, title);
  const before = ctx.out.length;
  body();
  if (ctx.out.length === before) {
    for (const line of emptyLines) ctx.out.push(`    ${fmt.dim(line)}`);
  }
}

/** True when an envelope has no single value a reader may be shown alone. */
function needsAllValues(env) {
  return isDisputed(env) || display(env) === undefined;
}

/**
 * A claim's note as one short line, or '' when there is none.
 *
 * Notes carry scope ("British Columbia only") and certainty, which is why
 * they are shown at all; some are WALS example HTML, so tags go.
 */
function noteText(note) {
  if (!note) return '';
  const flat = String(note).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  return flat.length > NOTE_MAX ? `${flat.slice(0, NOTE_MAX - 1)}…` : flat;
}

/** One value-with-source, as a printable line fragment. */
function claimText(c) {
  const v = c?.value ?? c?.count;
  const value = v === null || v === undefined || v === ''
    ? '(empty)'
    : typeof v === 'object' ? JSON.stringify(v) : String(v);
  const variant = c?.variant ? ` (${c.variant})` : '';
  const when = c?.year ?? c?.date;
  const date = when ? ` (${when})` : '';
  const src = c?.source ? `[${c.source}]` : '[source not stated]';
  const note = noteText(c?.note);
  return `${value}${variant}${date}  ${fmt.dim(`${src}${note ? ` — ${note}` : ''}`)}`;
}

/** Every claim on its own line under a label, with what the agreement means. */
function claimsList(ctx, label, claims, agreementNote) {
  ctx.out.push(`    ${fmt.dim(label.padEnd(PAD))} ${fmt.yellow(agreementNote)}`);
  for (const c of claims) ctx.out.push(`      ${fmt.cyan('•')} ${claimText(c)}`);
}

/**
 * Print a labeled value.
 *
 * An attribution envelope where sources agree prints its consensus on one
 * line. Where they disagree — or where there is no consensus at all — every
 * value is printed with its source, one per line. Electing one, or squashing
 * them into a single line a reader skims as an answer, is the failure this
 * exists to prevent.
 */
function field(ctx, label, value) {
  if (value === null || value === undefined || value === '') return;
  if (isAttributed(value)) {
    // display() throws on an agreement it does not know — loud by design.
    if (needsAllValues(value)) {
      claimsList(ctx, label, attributions(value),
        AGREEMENT_NOTE[value.agreement] ?? 'every value shown');
      return;
    }
    value = display(value);
  }
  const displayValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
  ctx.out.push(`    ${fmt.dim(label.padEnd(PAD))} ${displayValue}`);
}

/** A label followed by several lines, the first beside it, the rest aligned. */
function listField(ctx, label, lines, cap = LIST_CAP) {
  if (!lines.length) return;
  const shown = lines.slice(0, cap);
  if (lines.length > cap) shown.push(fmt.dim(`… +${lines.length - cap} more (--json for all)`));
  shown.forEach((line, i) => {
    ctx.out.push(`    ${fmt.dim((i === 0 ? label : '').padEnd(PAD))} ${line}`);
  });
}

/** Objects only, from something that may not be an array. */
function listOf(v) {
  return Array.isArray(v) ? v.filter((x) => x && typeof x === 'object') : [];
}

/** camelCase key → "Sentence case" label. */
function labelFor(key) {
  const spaced = key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** The code a pair command takes for this card (a locale's is its language). */
function pairCode(card) {
  return card.iso639_3 ?? card.locale?.language ?? card.code;
}

/**
 * Every endangerment assessment the card carries.
 *
 * The atlas card holds an envelope; the published projection writes
 * `{agreement: null, values: []}` when no source assesses the language,
 * which is not an envelope and must read as "none", not as one odd value.
 */
function endangermentClaims(card) {
  const env = card.endangerment;
  if (isAttributed(env)) return attributions(env);
  if (env && typeof env === 'object' && Array.isArray(env.values)) return listOf(env.values);
  return [];
}

// -----------------------------------------------------------------
// Section renderers — each handles one logical block of the card
// -----------------------------------------------------------------

/**
 * Print the header section: name, native name, codes, script, vitality.
 */
function renderHeader(card, ctx) {
  const raw = ctx.rawCard;
  const title = typeof card.name === 'string'
    ? card.name
    : display(card.name, { onDisagreement: 'first' }) ?? card.code;
  const native = typeof card.nativeName === 'string' ? card.nativeName : null;
  ctx.out.push('');
  ctx.out.push(`  ${fmt.bold(title)}${native ? `  ${fmt.dim('—')}  ${native}` : ''}`);

  // The badge is ONE display tier the reader derives from one cited source in
  // a declared authority order. Printed bare, it reads as the index's verdict;
  // so it says where it came from, and that the other assessments exist.
  const vitalityBadge = getVitalityBadge(card.vitality?.unescoStatus);
  if (vitalityBadge) {
    const by = card.vitality?.assessedBy;
    const claims = endangermentClaims(card);
    const differ = new Set(claims.map((c) => String(c.value).toLowerCase())).size > 1;
    let qualifier = by ? `display tier, champollion-derived from ${by}` : 'display tier, champollion-derived';
    if (claims.length > 1) {
      qualifier += differ
        ? ` — ${claims.length} assessments differ, all shown under Endangerment`
        : ` — ${claims.length} assessments under Endangerment`;
    }
    ctx.out.push(`  ${vitalityBadge}  ${fmt.dim(`(${qualifier})`)}`);
  }
  if (card._remote) {
    // A card rebuilt from the published tables carries fewer fields than the
    // atlas card it was projected from, so its blanks are blanker still.
    const when = card._remote.updatedAt ? `, published ${String(card._remote.updatedAt).slice(0, 10)}` : '';
    ctx.out.push(`  ${fmt.dim(`Served from champollion.dev's published card projection${when}: it carries fewer fields than the full atlas card, so anything absent below is unknown, not "none".`)}`);
  }

  section(ctx, 'Identification', () => {
    // The title above is a LABEL: where registries disagree on the name, the
    // reader takes the first value so lists and logs have something to say.
    // The disagreement itself is printed here. Only the on-disk atlas card
    // still holds the name envelope (the registry view flattened it).
    const nameEnv = isAttributed(raw?.name) ? raw.name : isAttributed(card.name) ? card.name : null;
    if (nameEnv && needsAllValues(nameEnv)) {
      field(ctx, 'Name', nameEnv);
      ctx.rendered.add('name');
    }
    const endonymEnv = isAttributed(raw?.endonym) ? raw.endonym
      : isAttributed(card.endonym) ? card.endonym : null;
    if (endonymEnv && needsAllValues(endonymEnv)) {
      field(ctx, 'Endonym', endonymEnv);
      ctx.rendered.add('endonym');
    }
    field(ctx, 'ISO 639-3', card.iso639_3);
    field(ctx, 'ISO 639-1', card.iso639_1);
    field(ctx, 'BCP 47', card.bcp47);
    field(ctx, 'Glottocode', card.glottocode);
    field(ctx, 'Script', card.script ? `${card.script}${card.scriptUnicodeName ? ` (${card.scriptUnicodeName})` : ''}` : null);
    field(ctx, 'Direction', card.dir);
    field(ctx, 'Script converter', card.scriptConverter);
    field(ctx, 'Support tier', formatSupportTier(card.supportTier));
    if (card.macrolanguage) {
      field(ctx, 'Macrolanguage', card.macrolanguage);
    }
    if (card.aliases && card.aliases.length > 0) {
      field(ctx, 'Aliases', card.aliases.join(', '));
    }
  });
  ctx.rendered.add('name');
  ctx.rendered.add('endonym');
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
function renderClassification(card, ctx) {
  if (!card.classification && !card.macroarea) return;

  section(ctx, 'Classification', () => {
    const cls = card.classification;
    if (cls) {
      // The published projection carries family as a label plus the full
      // attribution list; the atlas card carries the envelope itself.
      const famClaims = listOf(cls.familyAttributions);
      if (!isAttributed(cls.family)
          && new Set(famClaims.map((c) => String(c.value))).size > 1) {
        claimsList(ctx, 'Family', famClaims, AGREEMENT_NOTE[AGREEMENT.CONFLICTING]);
      } else {
        field(ctx, 'Family', cls.family);
      }
      field(ctx, 'Genus', cls.genus);
      if (Array.isArray(cls.ancestry) && cls.ancestry.length) {
        field(ctx, 'Ancestry', cls.ancestry.join(' → '));
      }
    }
    field(ctx, 'Macroarea', card.macroarea);
    if (card.isIsolate) {
      field(ctx, 'Language isolate', fmt.yellow('yes'));
    }
    if (card.countries && card.countries.length > 0) {
      field(ctx, 'Countries', card.countries.join(', '));
    }
  });
  ctx.rendered.add('classification.family');
  ctx.rendered.add('classification.genus');
}

/**
 * Print speaker estimates section.
 */
function renderSpeakers(card, ctx) {
  // normalizeCard turns the envelope into a list of {count, source, date,
  // note}; a card that skipped the adapter still carries the envelope.
  const estimates = isAttributed(card.speakerEstimates)
    ? attributions(card.speakerEstimates).map((c) => ({
      count: c.value, source: c.source, date: c.year, note: c.note,
    }))
    : listOf(card.speakerEstimates);
  const vitalityCount = card.vitality?.speakerCount;

  section(ctx, 'Speaker Estimates', () => {
    if (vitalityCount) {
      field(ctx, 'Total (vitality)', typeof vitalityCount === 'number' ? vitalityCount.toLocaleString() : vitalityCount);
    }
    if (estimates.length > 1 && new Set(estimates.map((e) => String(e.count))).size > 1) {
      ctx.out.push(`    ${fmt.yellow('sources differ — every claim shown, none elected')}`);
    }
    for (const est of estimates) {
      const label = `${est.source ?? 'source not stated'}${est.date ? ` (${est.date})` : ''}`;
      const count = typeof est.count === 'number' ? est.count.toLocaleString() : est.count;
      // The note is the claim's scope ("British Columbia only") — dropping it
      // once made a provincial count read as the language's total.
      const note = noteText(est.note);
      field(ctx, label, `${count}${note ? fmt.dim(` — ${note}`) : ''}`);
    }
  }, ['no cited estimate on this card (unknown, not zero)']);
  ctx.rendered.add('speakerEstimates');
}

/**
 * Print every endangerment assessment the card carries, each on its own
 * source's scale, then the one display tier the reader derives from them.
 */
function renderEndangerment(card, ctx) {
  section(ctx, 'Endangerment', () => {
    const claims = endangermentClaims(card);
    if (claims.length === 1) {
      field(ctx, 'Assessment', claimText(claims[0]));
    } else if (claims.length > 1) {
      const agreement = isAttributed(card.endangerment) ? card.endangerment.agreement : null;
      const differ = new Set(claims.map((c) => String(c.value).toLowerCase())).size > 1;
      claimsList(ctx, 'Assessments', claims,
        AGREEMENT_NOTE[agreement] ?? (differ ? AGREEMENT_NOTE[AGREEMENT.CONFLICTING] : 'every value shown'));
    }
    if (card.vitality?.unescoStatus) {
      const by = card.vitality.assessedBy;
      field(ctx, 'Display tier',
        `${card.vitality.unescoStatus} ${fmt.dim(`— champollion-derived from ${by ?? 'one cited assessment'}; a reading of one source, not a consensus`)}`);
      if (!claims.length) {
        ctx.out.push(`    ${fmt.dim('the per-source assessments are not carried by this card')}`);
      }
    }
  }, ['no source on this card assesses it (unknown, never "safe")']);
  ctx.rendered.add('endangerment');
}

/**
 * Print typological profile section.
 */
function renderTypology(card, ctx) {
  // Pull from encyclopedic.typology (richer) or typologicalProfile
  const typ = card.encyclopedic?.typology;
  const profile = card.typologicalProfile;

  if (!typ && !profile) return;

  section(ctx, 'Typological Profile', () => {
    if (typ) {
      field(ctx, 'Word order', typ.wordOrder);
      field(ctx, 'Adpositions', typ.adpositionType);
      field(ctx, 'Affixation', typ.affixType);
      field(ctx, 'Verb synthesis', typ.verbSynthesis);
      field(ctx, 'Morphological fusion', typ.morphologicalFusion);
      field(ctx, 'Consonants', typ.consonantInventory);
      field(ctx, 'Vowels', typ.vowelInventory);
      field(ctx, 'Tone', typ.tone);
      field(ctx, 'Cases', typ.cases);
      field(ctx, 'Genders', typ.genders);
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
      for (const [key, value] of Object.entries(profile)) {
        if (key === 'source' || key.startsWith('_')) continue;
        if (value === null || value === undefined || value === '') continue;
        field(ctx, labelFor(key), typeof value === 'boolean' ? (value ? 'yes' : 'no') : value);
        ctx.rendered.add(`typologicalProfile.${key}`);
      }
    }

    if (profile?.source) {
      field(ctx, 'Source', fmt.dim(profile.source));
    }
  });
}

/**
 * Print corpus availability section.
 *
 * The atlas records corpora where its sources put them — OPUS parallel
 * corpora, monolingual corpora, UD treebanks and speech under `resources`,
 * wordlists under `lexicalResources.datasets`. The legacy `corpusAvailability`
 * block is read too, for old-shape cards; the published projection ships it
 * as `{}`, which once printed this heading over nothing.
 */
function renderCorpus(card, ctx) {
  const code = pairCode(card);
  section(ctx, 'Corpus Availability', () => {
    const res = card.resources && typeof card.resources === 'object' ? card.resources : {};
    const lex = card.lexicalResources && typeof card.lexicalResources === 'object' ? card.lexicalResources : {};

    listField(ctx, 'Parallel (OPUS)', listOf(res.corpora).map((c) => {
      const partners = listOf(c.topPartners).slice(0, 3)
        .map((p) => `${p.code}:${p.alignmentPairs}`).join(', ');
      const pairs = typeof c.alignmentPairsTotal === 'number'
        ? `${c.alignmentPairsTotal.toLocaleString()} aligned pairs` : 'size not published';
      return `${c.corpus ?? c.corpusId ?? '?'} — ${pairs}${partners ? fmt.dim(` (top partners ${partners})`) : ''}`;
    }));
    listField(ctx, 'Monolingual', listOf(res.monolingualCorpora).map(toolLine));
    listField(ctx, 'Treebanks (UD)', listOf(res.treebanks).map((t) => (
      `${t.treebank ?? '?'}${typeof t.sentences === 'number' ? ` — ${t.sentences.toLocaleString()} sentences` : ''}${t.release ? fmt.dim(` (release ${t.release})`) : ''}`
    )));
    listField(ctx, 'Speech', listOf(res.speech).map((s) => (
      `${s.dataset ?? '?'}${s.locale ? ` ${s.locale}` : ''}${typeof s.validatedHours === 'number' ? ` — ${s.validatedHours} validated hours` : ''}${s.release ? fmt.dim(` (${s.release})`) : ''}`
    )));
    listField(ctx, 'Wordlists', listOf(lex.datasets).map((d) => (
      `${d.dataset ?? '?'}${typeof d.forms === 'number' ? ` — ${d.forms.toLocaleString()} forms` : ''}${d.release ? fmt.dim(` (${d.release})`) : ''}`
    )));

    const corpus = card.corpusAvailability && typeof card.corpusAvailability === 'object'
      ? card.corpusAvailability : {};
    if (corpus.opus) {
      const opusInfo = [];
      if (corpus.opus.corpora) opusInfo.push(`${corpus.opus.corpora} corpora`);
      if (corpus.opus.languagePairs) opusInfo.push(`${corpus.opus.languagePairs} lang pairs`);
      if (corpus.opus.totalAlignmentPairs) opusInfo.push(`${corpus.opus.totalAlignmentPairs.toLocaleString()} alignment pairs`);
      field(ctx, 'OPUS', opusInfo.join(', '));
      if (corpus.opus.corpusNames && corpus.opus.corpusNames.length > 0) {
        field(ctx, '  Top corpora', corpus.opus.corpusNames.slice(0, 5).join(', '));
      }
    }
    if (corpus.lexibank) {
      field(ctx, 'Lexibank', `${corpus.lexibank.datasets} datasets, ${corpus.lexibank.totalForms} forms`);
    }
    if (corpus.ud) {
      field(ctx, 'Universal Deps', `${corpus.ud.treebanks} treebanks: ${corpus.ud.treebankNames?.join(', ') || ''}`);
    }
    if (corpus.asjpWordlists) field(ctx, 'ASJP', `${corpus.asjpWordlists} wordlist(s), ${corpus.asjpForms || '?'} forms`);
    if (corpus.huggingFaceDatasets) field(ctx, 'HuggingFace', `${corpus.huggingFaceDatasets} datasets`);
    if (corpus.unimorphParadigms) field(ctx, 'UniMorph', fmt.green('✓'));
    if (corpus.wiktionaryStructuredDump) field(ctx, 'Wiktionary dump', fmt.green('✓'));
    if (corpus.openMultilingualWordnet) field(ctx, 'Open Multilingual WN', fmt.green('✓'));
  }, [
    NOT_RECORDED,
    `registered test sets for a pair: mt-eval corpora --source <src> --target ${code}`,
  ]);
}

/** A named tool or archive: who publishes it, and under what licence. */
function toolLine(t) {
  const lic = t.license
    ? `${t.license}${t.licenceEstablished === false ? ' (licence NOT established)' : ''}`
    : 'licence not stated';
  return `${t.name ?? '?'} — ${t.publisher ?? 'publisher not stated'}, ${lic}${t.archived ? ', archived' : ''}`;
}

/**
 * Print what exists for the language beyond corpora: dictionaries,
 * morphological analyzers, keyboards, and how far it is documented.
 * Existence only — a listing, never a quality claim.
 */
function renderResources(card, ctx) {
  section(ctx, 'Language Resources', () => {
    const res = card.resources && typeof card.resources === 'object' ? card.resources : {};
    const lex = card.lexicalResources && typeof card.lexicalResources === 'object' ? card.lexicalResources : {};
    listField(ctx, 'Dictionaries', listOf(lex.dictionaries).map((d) => (
      `${toolLine(d)}${d.pairedWith ? fmt.dim(` (paired with ${d.pairedWith})`) : ''}`
    )));
    listField(ctx, 'Analyzers (FST)', listOf(res.fsts).map(toolLine));
    listField(ctx, 'Keyboards', listOf(res.keyboards).map(toolLine));
    if (card.documentation?.medLevel) {
      const src = card._fieldSources?.['documentation.medLevel'];
      const cited = Array.isArray(src) ? src.join(', ') : src;
      field(ctx, 'Documentation level', `${card.documentation.medLevel}${cited ? fmt.dim(`  [${cited}]`) : ''}`);
    }
  }, ['no dictionary, analyzer, keyboard or documentation level recorded on this card (unknown, not "none")']);
}

/**
 * Print eval datasets section.
 */
function renderEval(card, ctx) {
  if (!card.evalDatasets || card.evalDatasets.length === 0) return;

  section(ctx, 'Eval Datasets', () => {
    for (const ds of card.evalDatasets) {
      ctx.out.push(`    ${fmt.cyan('•')} ${ds}`);
    }
    if (card.omt1600) {
      // The OMT-1600 paper publishes no per-language tier table, so `tier` is
      // null on most covered languages. Print the clause only when there is a
      // cited tier — never "tier null".
      const tier = card.omt1600.tier ? ` — tier ${card.omt1600.tier}` : '';
      field(ctx, 'OMT-1600', card.omt1600.covered ? `${fmt.green('covered')}${tier}` : fmt.dim('not covered'));
    }
  });
}

/**
 * Print pipeline readiness section.
 */
function renderPipeline(card, ctx) {
  const code = pairCode(card);
  section(ctx, 'Pipeline Readiness', () => {
    const pr = card.pipelineReadiness;
    if (!pr || typeof pr !== 'object') return;

    // Score bar — visual indicator of readiness
    const score = typeof pr.score === 'number' ? pr.score : null;
    if (score !== null) {
      const barWidth = 20;
      const filled = Math.round((score / 100) * barWidth);
      const bar = '█'.repeat(filled) + '░'.repeat(barWidth - filled);
      const colorFn = score >= 70 ? fmt.green : score >= 40 ? fmt.yellow : fmt.red;
      field(ctx, 'Score', `${colorFn(bar)} ${score}/100 (${pr.tier || ''})`);
    } else {
      field(ctx, 'Tier', pr.tier);
    }

    // Component checklist
    if (pr.components && typeof pr.components === 'object' && Object.keys(pr.components).length) {
      const checks = Object.entries(pr.components)
        .map(([key, val]) => `${val ? fmt.green('✓') : fmt.dim('✗')} ${key}`)
        .join('   ');
      ctx.out.push(`    ${checks}`);
    }
  }, [
    NOT_RECORDED,
    `what you can run for a pair today: champollion network recommend <src> ${code}`,
  ]);
}

/**
 * Print method support section.
 */
function renderMethods(card, ctx) {
  const code = pairCode(card);
  const methodNames = {
    googleTranslate:     'Google Translate',
    deepl:               'DeepL',
    microsoftTranslator: 'Microsoft Translator',
    libreTranslate:      'LibreTranslate',
    nllb:                'NLLB-200',
    llm:                 'LLM (OpenRouter)',
    microsoft:           'Microsoft',
  };

  section(ctx, 'Method Support', () => {
    const methods = card.methodSupport;
    if (!methods || typeof methods !== 'object') return;
    for (const [key, info] of Object.entries(methods)) {
      // Only a yes/no listing entry is a method. The atlas's evidence shape
      // ({total, byTier, named}) reaching here unflattened must not print its
      // bookkeeping keys as three "unsupported" engines.
      if (!info || typeof info !== 'object' || !('supported' in info)) continue;
      const label = methodNames[key] || key;
      const badge = info.supported ? fmt.green('✓ supported') : fmt.dim('✗ unsupported');
      let extra = '';
      if (info.formality) extra += ` ${fmt.cyan('(formality)')}`;
      if (info.code) extra += ` ${fmt.dim(`[${info.code}]`)}`;
      if (info.verifiedDate) extra += ` ${fmt.dim(`verified ${info.verifiedDate}`)}`;
      field(ctx, label, `${badge}${extra}`);
    }
  }, [
    NOT_RECORDED,
    `engines you can run for a pair, with the evidence for each: champollion network recommend <src> ${code}`,
  ]);
}

/**
 * Print every disputed attribution envelope no section above printed.
 *
 * The sections name the fields they render; a field the atlas attributes
 * that no section knows (politenessDistinction, bcp47FullTag, …) would
 * otherwise carry its disagreement in silence. Walking the card finds them,
 * including ones added after this file was written.
 */
function renderOtherDisputes(card, ctx) {
  const byPath = new Map();
  for (const source of [ctx.rawCard, card]) {
    if (!source) continue;
    for (const { path, value } of attributedFields(source)) {
      if (!byPath.has(path)) byPath.set(path, value);
    }
  }
  const rest = [...byPath].filter(([path, value]) => isDisputed(value) && !ctx.rendered.has(path));
  if (!rest.length) return;

  section(ctx, 'Other Fields Where Sources Differ', () => {
    for (const [path, value] of rest) {
      const label = path.split('.').map((seg) => labelFor(seg)).join(' › ');
      field(ctx, label, value);
    }
  });
}

/**
 * Print data sources count and cultural aphorism.
 */
function renderFooter(card, ctx) {
  // Data sources count
  if (card.dataSources && card.dataSources.length > 0) {
    section(ctx, 'Data Sources', () => {
      field(ctx, 'Count', `${card.dataSources.length} sources`);
      // Show first few and last few if there are many
      if (card.dataSources.length <= 8) {
        field(ctx, 'Sources', card.dataSources.join(', '));
      } else {
        const preview = [...card.dataSources.slice(0, 5), `… +${card.dataSources.length - 5} more`];
        field(ctx, 'Sources', preview.join(', '));
      }
    });
  }

  // Cultural aphorism — a nice touch at the bottom
  if (card.culturalAphorism?.text) {
    section(ctx, 'Cultural Aphorism', () => {
      ctx.out.push(`    ${fmt.magenta(`"${card.culturalAphorism.text}"`)}`);
      if (card.culturalAphorism.translation) {
        ctx.out.push(`    ${fmt.dim(`— "${card.culturalAphorism.translation}"`)}`);
      }
    });
  }

  // Notes
  if (card.notes) {
    ctx.out.push('');
    ctx.out.push(`  ${fmt.dim('Note:')} ${fmt.dim(card.notes)}`);
  }

  ctx.out.push('');
}

/**
 * Render a card as the terminal text `champollion network card` prints.
 *
 * @param {object} card  the registry's view (getLanguageCard) — normalized
 * @param {object} [opts]
 * @param {object|null} [opts.rawCard]  the on-disk atlas card when readable
 *   (repo mode). The registry view flattens `name` to a label; the raw card
 *   still holds its envelope, so a disputed name can be shown in full.
 * @returns {string}
 */
function renderCard(card, { rawCard = null } = {}) {
  const ctx = { out: [], rendered: new Set(), rawCard };
  renderHeader(card, ctx);
  renderClassification(card, ctx);
  renderSpeakers(card, ctx);
  renderEndangerment(card, ctx);
  renderTypology(card, ctx);
  renderCorpus(card, ctx);
  renderResources(card, ctx);
  renderEval(card, ctx);
  renderPipeline(card, ctx);
  renderMethods(card, ctx);
  renderOtherDisputes(card, ctx);
  renderFooter(card, ctx);
  return ctx.out.join('\n');
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
    console.error('  Usage: champollion network card <code> [--json]');
    console.error('');
    console.error('  Examples:');
    console.error('    champollion network card crk        # Plains Cree');
    console.error('    champollion network card spa        # Spanish');
    console.error('    champollion network card cmn --json # Raw JSON');
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

  // ── Locale fell back to its language: say so ──
  // Packaged installs carry only the 840 bundled locale deltas, and no
  // locale code is ever published as a trading card, so a long-tail
  // locale is served by its base language's card. Print the substitution
  // rather than passing the language off as the locale.
  if (!args.json && code.includes('-') && resolvedCode !== code) {
    console.error(
      `[NOTE] No locale card for "${code}" — showing the base language card "${resolvedCode}".`,
    );
  }

  // ── --json mode: output raw JSON and exit ──
  if (args.json) {
    console.log(JSON.stringify(card, null, 2));
    return 0;
  }

  // ── Pretty-print mode ──
  // The on-disk atlas card (repo mode only; null in an npm install, whose
  // bundled and fetched cards are already the flattened view) supplies the
  // envelopes the registry view flattened, through the reader — never a
  // private JSON.parse.
  const rawCard = readCard(card.code ?? resolvedCode);
  console.log(renderCard(card, { rawCard }));

  return 0;
}

export { run, renderCard };
