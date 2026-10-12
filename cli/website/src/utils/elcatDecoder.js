/**
 * elcatDecoder.js
 *
 * Decoder for ELCat (Catalogue of Endangered Languages) coded fields.
 * ELCat uses numeric scales for several endangerment metrics.
 * These codes come from the ELCat Level of Endangerment Index (LEI).
 *
 * Source: https://endangeredlanguages.com/
 */

/**
 * Speaker number scale (ELCat endangerment assessment).
 * Maps a 0-5 numeric code to a human-readable label describing
 * the approximate number of speakers.
 */
const SPEAKER_NUMBER_SCALE = {
  0: 'No data available',
  1: 'Critically low (< 100 speakers)',
  2: 'Severely limited (100–999 speakers)',
  3: 'Limited (1,000–9,999 speakers)',
  4: 'Moderate (10,000–99,999 speakers)',
  5: 'Strong (100,000+ speakers)',
};

/**
 * Intergenerational transmission scale.
 * Whether the language is being passed from parents to children.
 */
const TRANSMISSION_SCALE = {
  0: 'No data available',
  1: 'Active transmission to children',
  2: 'Uneven transmission — some children learn it',
  3: 'Only adults and older children speak it',
  4: 'Only adults speak it',
  5: 'Only elderly speakers remain',
};

/**
 * Speaker number trends scale.
 * Whether the number of speakers is growing, stable, or shrinking.
 */
const SPEAKER_TRENDS_SCALE = {
  0: 'No data available',
  1: 'Growing — speaker population is increasing',
  2: 'Stable — speaker population is not changing significantly',
  3: 'Decreasing — some decline in speaker numbers',
  4: 'Rapidly decreasing — significant loss of speakers',
  5: 'Nearly extinct — only a handful of speakers remain',
};

/**
 * Domains of use scale.
 * In how many social contexts the language is still used.
 */
const DOMAINS_OF_USE_SCALE = {
  0: 'No data available',
  1: 'Universal — used in all domains (home, school, government, media)',
  2: 'Multilingual parity — used alongside other languages',
  3: 'Declining domains — excluded from education or government',
  4: 'Limited domains — mainly used at home and in community',
  5: 'Highly limited — used only in specific ceremonies or by elders',
};

/**
 * Decode an ELCat property value to a human-readable label.
 *
 * @param {string} property — the ELCat property name
 * @param {string|number} value — the raw value (numeric code or string)
 * @returns {string} decoded human-readable label, or the raw value if unknown
 */
export function decodeElcatValue(property, value) {
  const numVal = parseInt(value, 10);

  switch (property) {
    case 'speaker_number':
      return SPEAKER_NUMBER_SCALE[numVal] || `Code ${value}`;
    case 'transmission':
      return TRANSMISSION_SCALE[numVal] || `Code ${value}`;
    case 'speaker_number_trends':
      return SPEAKER_TRENDS_SCALE[numVal] || `Code ${value}`;
    case 'domains_of_use':
      return DOMAINS_OF_USE_SCALE[numVal] || `Code ${value}`;
    case 'LEI':
      // LEI is already a readable string like "Severely Endangered (20 percent certain...)"
      return String(value);
    case 'bib':
      return 'See source database';
    default:
      return null; // Not a coded field — return null to signal no decoding happened
  }
}

/**
 * Get a human-readable display name for ELCat properties.
 */
export function getElcatPropertyName(property) {
  const NAMES = {
    'LEI': 'Endangerment Level (LEI)',
    'speaker_number': 'Speaker Population Scale',
    'speaker_number_trends': 'Speaker Population Trend',
    'transmission': 'Intergenerational Transmission',
    'domains_of_use': 'Domains of Active Use',
    'location': 'Geographic Location',
    'speakers': 'Speaker Demographics',
    'context': 'Sociolinguistic Context',
    'vitality': 'Vitality Assessment',
    'bib': 'Bibliography',
  };
  return NAMES[property] || property;
}

/**
 * Map nearest-language relationship codes to explanations.
 */
export const RELATIONSHIP_EXPLANATIONS = {
  same_genus: {
    label: 'Closest relatives',
    description: 'Shares the deepest (lowest) branch of the family tree — the same genus. Like Spanish and Portuguese, or German and Dutch: a recent common ancestor and often heavy overlap in vocabulary and grammar.',
    mtRelevance: 'The strongest transfer candidates: closely related vocabulary and structure make shared or adapted training data, tokenizers, and models most likely to help.',
  },
  same_subfamily: {
    label: 'Same sub-family',
    description: 'One level up from the closest relatives — the same sub-family. Like the Romance branch as a whole: a shared ancestor a bit further back, so related but noticeably more divergent than sister languages.',
    mtRelevance: 'Good transfer potential: many roots and grammatical patterns are still shared, so related data and pretrained models often carry over with adaptation.',
  },
  same_family: {
    label: 'Same language family',
    description: 'Part of the same top-level language family, but a different branch. Like English and Russian (both Indo-European): a distant common ancestor and substantial divergence.',
    mtRelevance: 'Some structural patterns may transfer, but vocabulary and grammar differences are large, so gains from related data are modest.',
  },
  same_macrofamily: {
    label: 'Same macro-family',
    description: 'Connected only through a broad macro-family or proposed deep grouping, sharing just the topmost node of a deep family tree. The relationship is ancient and, for many such groupings, still debated.',
    mtRelevance: 'Little direct transfer: any inherited similarity is remote, so shared data rarely helps beyond incidental overlap.',
  },
  geographic_only: {
    label: 'Spoken nearby',
    description: 'Not known to be genetically related, but spoken in the same area. Neighboring languages in prolonged contact often borrow words and share grammatical (areal) features.',
    mtRelevance: 'No inherited vocabulary to transfer, but shared loanwords and areal features from contact can still create limited, contact-based overlap.',
  },
};

/**
 * Explain what "shared depth" means for genealogical classification.
 *
 * @param {number} depth — the shared depth value from nearest language data
 * @returns {string} human-readable explanation of the relationship closeness
 */
export function explainSharedDepth(depth) {
  if (depth == null) return '';
  if (depth >= 7) return `Very closely related (shared depth ${depth}) — like dialects of the same language.`;
  if (depth >= 5) return `Closely related (shared depth ${depth}) — like siblings in the same sub-family.`;
  if (depth >= 3) return `Moderately related (shared depth ${depth}) — like cousins in a larger family.`;
  if (depth >= 1) return `Distantly related (shared depth ${depth}) — same family but different branches.`;
  return `Shared depth: ${depth}`;
}
