/**
 * CLDF term URIs — the single source of truth for Cross-Linguistic Data Format
 * identifiers used across Champollion's CLDF pipeline.
 *
 * These constants name the standard CLDF table types, dataset types, and column
 * property URIs (http://cldf.clld.org/v1.0/terms.rdf#…). They were originally
 * declared inline in `cli/scripts/ingest-cldf.mjs`; they now live here so that
 * BOTH the ingester (CLDF → facts DB) and the exporter (facts DB → CLDF) read
 * the exact same vocabulary. Round-trip framing, see docs/DATA-ARCHITECTURE.md §4:
 *
 *     download-cldf-datasets.mjs → ingest-cldf.mjs → [facts DB] → export-cldf.mjs
 *
 * The ingester imports CLDF_TYPES / CLDF_DATASET_TYPES / CLDF_PROPERTIES and uses
 * a subset of CLDF_PROPERTIES. The exporter uses the full set (including the
 * latitude/longitude/description/codeReference terms it needs to write a valid
 * StructureDataset). Adding terms here is therefore behaviour-preserving for the
 * ingester — it simply ignores the keys it does not reference.
 *
 * @module cldf-terms
 */

// CLDF dc:conformsTo URIs that identify table types
export const CLDF_TYPES = {
  FORM_TABLE:       'http://cldf.clld.org/v1.0/terms.rdf#FormTable',
  VALUE_TABLE:      'http://cldf.clld.org/v1.0/terms.rdf#ValueTable',
  LANGUAGE_TABLE:   'http://cldf.clld.org/v1.0/terms.rdf#LanguageTable',
  PARAMETER_TABLE:  'http://cldf.clld.org/v1.0/terms.rdf#ParameterTable',
  CODE_TABLE:       'http://cldf.clld.org/v1.0/terms.rdf#CodeTable',
  COGNATE_TABLE:    'http://cldf.clld.org/v1.0/terms.rdf#CognateTable',
};

export const CLDF_DATASET_TYPES = {
  WORDLIST:         'http://cldf.clld.org/v1.0/terms.rdf#Wordlist',
  STRUCTURE:        'http://cldf.clld.org/v1.0/terms.rdf#StructureDataset',
  DICTIONARY:       'http://cldf.clld.org/v1.0/terms.rdf#Dictionary',
  PARALLEL_TEXT:    'http://cldf.clld.org/v1.0/terms.rdf#ParallelText',
  GENERIC:          'http://cldf.clld.org/v1.0/terms.rdf#Generic',
};

// CLDF property URIs that identify standard columns.
// The first block is the set the ingester references; the second block adds the
// extra terms the exporter writes (latitude/longitude/description/codeReference).
export const CLDF_PROPERTIES = {
  // --- referenced by ingest-cldf.mjs (do not remove) ---
  ID:               'http://cldf.clld.org/v1.0/terms.rdf#id',
  NAME:             'http://cldf.clld.org/v1.0/terms.rdf#name',
  LANGUAGE_REF:     'http://cldf.clld.org/v1.0/terms.rdf#languageReference',
  PARAMETER_REF:    'http://cldf.clld.org/v1.0/terms.rdf#parameterReference',
  VALUE:            'http://cldf.clld.org/v1.0/terms.rdf#value',
  FORM:             'http://cldf.clld.org/v1.0/terms.rdf#form',
  GLOTTOCODE:       'http://cldf.clld.org/v1.0/terms.rdf#glottocode',
  ISO639P3:         'http://cldf.clld.org/v1.0/terms.rdf#iso639P3code',
  MACROAREA:        'http://cldf.clld.org/v1.0/terms.rdf#macroarea',
  COMMENT:          'http://cldf.clld.org/v1.0/terms.rdf#comment',
  SOURCE:           'http://cldf.clld.org/v1.0/terms.rdf#source',

  // --- additionally used by export-cldf.mjs ---
  CODE_REF:         'http://cldf.clld.org/v1.0/terms.rdf#codeReference',
  DESCRIPTION:      'http://cldf.clld.org/v1.0/terms.rdf#description',
  LATITUDE:         'http://cldf.clld.org/v1.0/terms.rdf#latitude',
  LONGITUDE:        'http://cldf.clld.org/v1.0/terms.rdf#longitude',
};
