/**
 * ingest-iso15924.mjs — script CODES already on the cards → script NAMES.
 *
 * WHAT THIS IS AND IS NOT
 *   LinguaMeta tells us a language is written in `Cans` and `Latn`. Those are
 *   correct and unreadable. The ISO 15924 registry says `Cans` is "Unified
 *   Canadian Aboriginal Syllabics", which is what a person needs.
 *
 *   This is a JOIN, not an assertion: it adds no language to the atlas and
 *   claims nothing new about any of them. It only makes an existing claim
 *   legible.
 *
 * WHY IT IS champollion-derived AND NOT UNICODE'S CLAIM
 *   Unicode says what `Cans` means. It says nothing about which languages use
 *   it. The statement "this language is written in Unified Canadian Aboriginal
 *   Syllabics" is a composite of LinguaMeta's claim and Unicode's registry, and
 *   belongs to neither — so it carries champollion-derived with Derived_From
 *   naming the ISO 15924 release it was resolved against.
 *
 *   The alternative — writing it under `linguameta` — would put words in
 *   LinguaMeta's mouth it never said, which is the same defect as recording
 *   PHOIBLE inventory counts as PHOIBLE's own.
 *
 * AN UNKNOWN CODE IS REPORTED, NEVER GUESSED
 *   A script code the registry does not contain is either a typo upstream or a
 *   registry we have not refreshed. Both need a human. Emitting the raw code as
 *   though it were a name would hide the question and look like coverage.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { verify } from '../fetchers/lib/fetch-lib.mjs';
import { registerSource } from './ingest-structure.mjs';
import { valueWriter, VARIANT } from './values.mjs';
import { registerDerivation } from './ingest-aggregate.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(__dirname, '..', '..', 'data');

/**
 * @param {import('better-sqlite3').Database} db
 * @param {{source?: string, license?: string}} spec
 */
export function ingestIso15924(db, spec = {}) {
  const { source = 'iso15924', license: declaredLicense = null } = spec;

  const v = verify(source);
  if (!v.ok) {
    throw new Error(`${source} does not match its SNAPSHOT (${v.problems?.[0]?.why ?? 'drifted'}).`);
  }
  const upstream = registerSource(db, source, declaredLicense);
  const derivedSource = registerDerivation(db);

  const names = new Map();
  for (const line of fs.readFileSync(path.join(DATA, source, 'iso15924.txt'), 'utf-8').split('\n')) {
    if (!line || line.startsWith('#')) continue;
    const [code, , name] = line.split(';');
    if (code && /^[A-Z][a-z]{3}$/.test(code) && name) names.set(code, name.trim());
  }

  const write = valueWriter(db, {
    sourceId: derivedSource, createdBy: 'cldf/ingest-iso15924.mjs',
  });

  // Only codes the atlas already carries. This resolves what is there; it never
  // introduces a script for a language no source associated with one.
  const scripts = db.prepare(
    "SELECT DISTINCT Subject_ID, Value FROM cldf_values WHERE Parameter_ID = 'script'",
  ).all();

  const stats = {
    source, languages: 0, offSpine: 0, asserted: 0, absence: 0,
    registryEntries: names.size, outOfVocabulary: [],
  };
  const seen = new Set();

  db.transaction(() => {
    for (const r of scripts) {
      const name = names.get(r.Value);
      if (!name) {
        stats.outOfVocabulary.push({
          language: r.Subject_ID, parameter: 'scriptName', value: r.Value,
        });
        continue;
      }
      // The script CODE is the discriminator, so a language written in three
      // scripts gets three names and each stays tied to the code it resolves.
      write(r.Subject_ID, 'scriptName', name, {
        variantType: VARIANT.SCRIPT,
        variantId: r.Value,
        confidence: 'derived',
        derivedFrom: upstream.id,
      });
      seen.add(r.Subject_ID);
      stats.asserted++;
    }
  })();

  stats.languages = seen.size;
  return stats;
}
