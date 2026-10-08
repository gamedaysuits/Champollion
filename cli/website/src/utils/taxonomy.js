/**
 * Taxonomy display helpers — modality, ISO 639-3 type/scope, macrolanguage hubs.
 *
 * Data contract (docs/LANGUAGE_TAXONOMY.md, "R4. Wall / UI badging"):
 *   - tc-index rows and tc-lang detail records carry:
 *       modality       'spoken' | 'signed' | null
 *       isoType        'L' | 'E' | 'A' | 'H' | 'C' | 'S' | null
 *       isoScope       'I' | 'M' | 'S' | null
 *       macrolanguage  3-letter hub code | null   (member cards link UP)
 *   - tc-lang detail records additionally carry:
 *       members[]      member ISO codes            (hub cards link DOWN)
 *       taxonomyNotes  curated dispute prose | null
 *
 * House rules encoded here, not scattered across components:
 *   1. ISO letters are ALWAYS spelled out in the UI — never bare "E"/"C".
 *   2. Sign languages are natural languages; the platform's text-MT scope
 *      is framed as "not yet served" — never "not a language".
 *   3. Macrolanguage hubs (isoScope 'M') are a navigation layer, never
 *      benchmark targets — hub cards must not show pipeline-readiness UI.
 */

/**
 * ISO 639-3 Language_Type, spelled out for display.
 * 'L' (Living) deliberately maps to null: living is the unmarked default
 * and gets no chip — chips exist to flag the exceptional cases.
 */
export const ISO_TYPE_LABELS = {
  E: 'Extinct',
  A: 'Ancient',
  H: 'Historical',
  C: 'Constructed',
  S: 'Special',
};

/**
 * Hover text for the type chip. It says what ISO 639-3 records — a type code —
 * and nothing more. The old "Extinct" text added "no known L1 or L2 speakers
 * remain", our own words, and showed them on Wampanoag, whose card cites ELCat
 * "awakening". Where sources assess a language differently, the panel lists
 * each one (see the endangerment sources in DetailPanel).
 */
const ISO_TYPES_URL = 'iso639-3.sil.org/about/types';
export const ISO_TYPE_DESCRIPTIONS = {
  E: `ISO 639-3 language type: Extinct. ISO's definitions: ${ISO_TYPES_URL}. Other sources may assess the language differently.`,
  A: `ISO 639-3 language type: Ancient. ISO's definitions: ${ISO_TYPES_URL}.`,
  H: `ISO 639-3 language type: Historical. ISO's definitions: ${ISO_TYPES_URL}.`,
  C: `ISO 639-3 language type: Constructed. ISO's definitions: ${ISO_TYPES_URL}.`,
  S: `ISO 639-3 language type: Special. ISO's definitions: ${ISO_TYPES_URL}.`,
};

/**
 * Spelled-out label for a card's ISO type, or null when no chip should
 * render (living languages and unknown/missing types).
 */
export function getIsoTypeLabel(isoType) {
  if (!isoType) return null;
  return ISO_TYPE_LABELS[isoType] || null;
}

/** True when the card is a signed-modality natural language. */
export function isSignedLanguage(cardOrDetail) {
  return cardOrDetail?.modality === 'signed';
}

/**
 * True when the card is a macrolanguage hub (ISO 639-3 scope 'M').
 * Hubs are typed navigation cards linking member languages; they are
 * never benchmark targets and must not show pipeline-readiness UI.
 */
export function isMacrolanguageHub(cardOrDetail) {
  return cardOrDetail?.isoScope === 'M';
}

/**
 * Signed-language hero copy for the detail modal.
 *
 * The middle sentence is VERBATIM from docs/LANGUAGE_TAXONOMY.md Position 1
 * (the project's ratified position on sign languages) — keep it in sync
 * with that document, and keep the framing "not yet served", never
 * "not a language". Leads with "natural language" per the Position 1
 * sensitivity note.
 */
export const SIGNED_LANGUAGE_HERO_COPY =
  'A natural language in the signed modality. The platform’s current ' +
  'benchmarking is text-based machine translation; signed-language MT ' +
  '(video/gloss/avatar pipelines) is a different technical problem we do ' +
  'not yet serve. The framing is always “not yet served” — ' +
  'never “not a language.”';

/**
 * Replacement copy for the methods/API table on signed-language cards.
 * An all-✗ table would present our instrument's scope as the language's
 * failure — render this information instead.
 */
export const SIGNED_LANGUAGE_METHODS_COPY =
  'Commercial text-MT APIs are not listed for this card: they measure ' +
  'text pipelines, which do not yet serve signed languages. An empty ' +
  'methods table here would describe the limits of our instrument, not ' +
  'of the language.';

/** Hub explainer shown above the members grid in the detail modal. */
export const HUB_MEMBERS_INTRO =
  'A macrolanguage is one identity in some domains (libraries, ' +
  'legislation) and several closely related individual languages in ' +
  'others (corpora, FSTs, benchmarks). This hub is a navigation layer ' +
  '— benchmarks bind to the individual member languages below, ' +
  'never to the hub.';

/** Short label used on hub grid tiles in place of pipeline-readiness UI. */
export const HUB_TILE_NOTE =
  'Language group — a navigation hub linking its member languages. ' +
  'Not a benchmark target.';
