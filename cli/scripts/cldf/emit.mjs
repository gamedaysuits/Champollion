/**
 * emit.mjs — the atlas store → a real CLDF StructureDataset on disk.
 *
 * WHY EMIT AT ALL, WHEN THE STORE IS ALREADY CLDF-SHAPED
 *   Because a shape is a claim until a validator agrees. `cldf validate` checks
 *   referential integrity, datatypes and required columns against the published
 *   ontology — the discipline's own tool, applied to our data. Until this pass
 *   it had never been run here at all: pycldf was not installed.
 *
 *   The emitted dataset is also the publishable artefact. `pycldf` reads it,
 *   `cldf createdb` loads it, and a Zenodo deposit of it is citable. That is
 *   what makes the atlas a contribution to the field rather than a private file
 *   format that happens to be about languages.
 *
 * THE DESCRIPTOR IS WHERE HONESTY LIVES
 *   Standard columns get their standard propertyUrl, so a CLDF consumer reads
 *   them without translation. Our extension columns get OURS, under a
 *   champollion.dev term namespace, and are listed in `dc:description`. A
 *   reader can therefore tell at a glance which parts of this dataset are the
 *   standard and which parts are us — rather than us quietly redefining a
 *   standard term to mean something it does not.
 */

import fs from 'node:fs';
import path from 'node:path';
import { serializeCSV } from '../lib/csv.mjs';

const CLDF = 'http://cldf.clld.org/v1.0/terms.rdf#';
/** Our own term namespace. Extensions are ours and say so. */
const CHAMP = 'https://champollion.dev/terms#';

const col = (name, propertyUrl = null, datatype = null) => ({
  name,
  ...(propertyUrl ? { propertyUrl } : {}),
  ...(datatype ? { datatype } : {}),
});

const LANGUAGE_COLUMNS = [
  col('ID', `${CLDF}id`),
  col('Name', `${CLDF}name`),
  col('Glottocode', `${CLDF}glottocode`),
  col('ISO639P3code', `${CLDF}iso639P3code`),
  col('Macroarea', `${CLDF}macroarea`),
  col('Latitude', `${CLDF}latitude`, 'decimal'),
  col('Longitude', `${CLDF}longitude`, 'decimal'),
];

const PARAMETER_COLUMNS = [
  col('ID', `${CLDF}id`),
  col('Name', `${CLDF}name`),
  col('Description', `${CLDF}description`),
  // Extensions: what the standard has no term for.
  col('Datatype', `${CHAMP}datatype`),
  col('Upstream_Parameter_ID', `${CHAMP}upstreamParameterId`),
  col('Card_Field', `${CHAMP}cardField`),
  col('Projection_Rule', `${CHAMP}projectionRule`),
  col('Absence_Policy', `${CHAMP}absencePolicy`),
  col('Disposition', `${CHAMP}disposition`),
  col('Authority', `${CHAMP}authority`),
  col('Sources', `${CHAMP}sources`),
];

const CODE_COLUMNS = [
  col('ID', `${CLDF}id`),
  col('Parameter_ID', `${CLDF}parameterReference`),
  col('Name', `${CLDF}name`),
  col('Description', `${CLDF}description`),
  col('Source_Scale', `${CHAMP}sourceScale`),
];

const VALUE_COLUMNS = [
  col('ID', `${CLDF}id`),
  col('Language_ID', `${CLDF}languageReference`),
  col('Parameter_ID', `${CLDF}parameterReference`),
  col('Value', `${CLDF}value`),
  col('Code_ID', `${CLDF}codeReference`),
  col('Comment', `${CLDF}comment`),
  // CLDF's source term is multivalued by definition — one value may rest on
  // several bibliographic references, optionally with page ranges
  // (`smith2020[45-47];jones2019`). Declaring it scalar validates with a
  // warning and quietly narrows what the column can ever express, so the
  // separator is declared even though we currently write one key per value.
  { name: 'Source', propertyUrl: `${CLDF}source`, separator: ';' },
  col('Variant_Type', `${CHAMP}variantType`),
  col('Variant_ID', `${CHAMP}variantId`),
  col('Sequence', `${CHAMP}sequence`, 'integer'),
  col('Value_Year', `${CHAMP}valueYear`, 'integer'),
  col('Status', `${CHAMP}status`),
  col('Confidence', `${CHAMP}confidence`),
  col('Derived_From', `${CHAMP}derivedFrom`),
  col('Sovereignty_Status', `${CHAMP}sovereigntyStatus`),
  col('Transmission_Consent', `${CHAMP}transmissionConsent`),
  col('Created_By', `${CHAMP}createdBy`),
];

const EXTENSION_NOTE =
  'Champollion extension columns (namespace https://champollion.dev/terms#) carry what '
  + 'CLDF has no term for: Status distinguishes an asserted value from "the source looked '
  + 'and its documentation does not answer" (not_attested) and "no source covers this" '
  + '(not_surveyed); Variant is a multi-value discriminator so one concept stays one '
  + 'parameter; Value_Year dates estimates that are only comparable when dated; '
  + 'Redistributable, Commercial_Use, Sovereignty_Status and Transmission_Consent carry '
  + 'licence and sovereignty terms with each value, which is the only place they can be '
  + 'enforced rather than remembered. Every other column is standard CLDF.';

/** Values must be emitted as strings; SQLite gives us numbers and nulls. */
const cell = (v) => (v === null || v === undefined ? '' : String(v));

function writeTable(dir, file, columns, rows) {
  const names = columns.map((c) => c.name);
  const out = [names, ...rows.map((r) => names.map((n) => cell(r[n])))];
  fs.writeFileSync(path.join(dir, file), serializeCSV(out));
  return rows.length;
}

/**
 * Escape a BibTeX field value. Braces and backslashes would otherwise change
 * the structure of the entry.
 */
const bib = (s) => String(s ?? '').replace(/[\\{}]/g, ' ').replace(/\s+/g, ' ').trim();

/**
 * Emit the atlas as a CLDF StructureDataset.
 *
 * @param {import('better-sqlite3').Database} db
 * @param {string} outDir
 * @param {{version?: string, builtAt?: string}} [release]
 * @returns {{languages:number, parameters:number, codes:number, values:number, sources:number, dir:string}}
 */
export function emitAtlas(db, outDir, release = {}) {
  fs.mkdirSync(outDir, { recursive: true });

  // Only parameters we actually build. A DROPped parameter in the emitted
  // dataset would advertise a field the atlas does not carry.
  const parameters = db.prepare(
    "SELECT * FROM cldf_parameters WHERE Disposition IN ('DONE','PARTIAL') ORDER BY ID",
  ).all();
  const languages = db.prepare('SELECT * FROM cldf_languages ORDER BY ID').all();
  const codes = db.prepare('SELECT * FROM cldf_codes ORDER BY ID').all();
  // The ATLAS is a StructureDataset, and CLDF's ValueTable is defined around
  // `languageReference` — so only language-subject values belong in it, and the
  // store's Subject_ID becomes the standard's Language_ID on the way out.
  // Corpus and method values are the same rows in the same table internally, and
  // are emitted separately into the Generic resources dataset.
  // Restricted to the parameters emitted above: a value whose parameter the
  // export does not carry would be a dangling parameterReference. Today every
  // value's parameter is DONE/PARTIAL, so this excludes nothing — it exists
  // for STORE-disposition parameters (the typology feature catalog), whose
  // values stay in the store for the catalogue build and are not part of the
  // published card-fact dataset.
  const values = db.prepare(
    "SELECT v.*, v.Subject_ID AS Language_ID FROM cldf_values v "
    + "JOIN cldf_parameters p ON p.ID = v.Parameter_ID "
    + "WHERE v.Subject_Type = 'language' AND p.Disposition IN ('DONE','PARTIAL') "
    + 'ORDER BY v.ID',
  ).all();
  const sources = db.prepare('SELECT * FROM cldf_sources ORDER BY ID').all();

  const counts = {
    languages: writeTable(outDir, 'languages.csv', LANGUAGE_COLUMNS, languages),
    parameters: writeTable(outDir, 'parameters.csv', PARAMETER_COLUMNS, parameters),
    codes: writeTable(outDir, 'codes.csv', CODE_COLUMNS, codes),
    values: writeTable(outDir, 'values.csv', VALUE_COLUMNS, values),
    sources: sources.length,
    dir: outDir,
  };

  // ── sources.bib ───────────────────────────────────────────────────────────
  // One entry per pinned RELEASE. The licence is recorded in the entry itself
  // so a downstream user of the emitted dataset can see the terms without
  // consulting us.
  const entries = sources.map((s) => {
    const fields = [
      ['title', s.Title],
      ['year', s.Year],
      ['doi', s.DOI],
      ['url', s.URL],
      ['version', s.Version],
      ['license', s.License],
      ['sha256', s.sha256],
      ['urldate', s.Retrieved_At],
      ['note', `CLDF module: ${s.CLDF_Module ?? 'unknown'}; `
        + `redistributable: ${s.Redistributable ? 'yes' : 'no'}; `
        + `commercial use: ${s.Commercial_Use ? 'yes' : 'no'}`],
    ].filter(([, v]) => v !== null && v !== undefined && v !== '');
    return `@${s.BibTeX_Type}{${s.ID},\n`
      + fields.map(([k, v]) => `  ${k} = {${bib(v)}}`).join(',\n')
      + '\n}';
  });
  fs.writeFileSync(path.join(outDir, 'sources.bib'), `${entries.join('\n\n')}\n`);

  // ── The CSVW descriptor ───────────────────────────────────────────────────
  const metadata = {
    '@context': ['http://www.w3.org/ns/csvw', { '@language': 'en' }],
    'dc:conformsTo': `${CLDF}StructureDataset`,
    'dc:title': 'Champollion Atlas',
    'dc:description':
      'Language properties and resource availability for machine translation, projected '
      + 'from pinned releases of published datasets. Every value names the release it came '
      + 'from. Where sources disagree, all values are kept and attributed rather than one '
      + `being chosen. ${EXTENSION_NOTE}`,
    'dc:license': 'CC-BY-4.0',
    'dc:bibliographicCitation': release.version
      ? `Champollion Atlas ${release.version}` : 'Champollion Atlas (unreleased build)',
    'rdf:ID': 'champollion-atlas',
    'rdf:type': 'http://www.w3.org/ns/dcat#Distribution',
    ...(release.version ? { 'prov:wasGeneratedBy': [{ 'dc:title': 'champollion atlas build', 'dc:description': release.version }] } : {}),
    tables: [
      { url: 'languages.csv', 'dc:conformsTo': `${CLDF}LanguageTable`, tableSchema: { columns: LANGUAGE_COLUMNS, primaryKey: ['ID'] } },
      { url: 'parameters.csv', 'dc:conformsTo': `${CLDF}ParameterTable`, tableSchema: { columns: PARAMETER_COLUMNS, primaryKey: ['ID'] } },
      {
        url: 'codes.csv',
        'dc:conformsTo': `${CLDF}CodeTable`,
        tableSchema: {
          columns: CODE_COLUMNS,
          primaryKey: ['ID'],
          foreignKeys: [{ columnReference: ['Parameter_ID'], reference: { resource: 'parameters.csv', columnReference: ['ID'] } }],
        },
      },
      {
        url: 'values.csv',
        'dc:conformsTo': `${CLDF}ValueTable`,
        tableSchema: {
          columns: VALUE_COLUMNS,
          primaryKey: ['ID'],
          foreignKeys: [
            { columnReference: ['Language_ID'], reference: { resource: 'languages.csv', columnReference: ['ID'] } },
            { columnReference: ['Parameter_ID'], reference: { resource: 'parameters.csv', columnReference: ['ID'] } },
          ],
        },
      },
    ],
  };
  fs.writeFileSync(
    path.join(outDir, 'StructureDataset-metadata.json'),
    `${JSON.stringify(metadata, null, 2)}\n`,
  );

  return counts;
}
