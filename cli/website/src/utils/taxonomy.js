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

/** Hover/long-form explanations for the type chip. */
export const ISO_TYPE_DESCRIPTIONS = {
  E: 'Extinct per ISO 639-3 — no known L1 or L2 speakers remain.',
  A: 'Ancient per ISO 639-3 — went extinct in ancient times (roughly pre-1000 CE).',
  H: 'Historical per ISO 639-3 — a distinct historical stage of a modern language (e.g. Latin, Old English).',
  C: 'Constructed per ISO 639-3 — a designed language with a literature and a community of users (e.g. Esperanto). Programming languages are categorically excluded.',
  S: 'Special per ISO 639-3 — a special-purpose code, not an individual language.',
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
