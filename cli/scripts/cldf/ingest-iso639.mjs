/**
 * ingest-iso639.mjs — the SIL ISO 639-3 tables → registry values.
 *
 * WHY THE SPINE IS NOT ENOUGH
 *   `spine.mjs` already reads these tables to build LanguageTable, but a spine
 *   entry is an IDENTITY, not a claim. ISO 639-3 also asserts things ABOUT each
 *   language — its reference name, its scope, its language type, whether the
 *   code has been retired and in favour of what — and those are values, with a
 *   source and a release, like anything else.
 *
 *   Without this, `name` looked like a single-source field carrying only
 *   LinguaMeta's English name, when in fact three registries name every
 *   language and they do not always agree.
 *
 * LICENCE — READ THE HEADER OF THE FETCHER TOO
 *   These tables are LicenseRef-SIL-ISO639-3-Terms, a bespoke grant. SIL
 *   permits incorporating the code set and forbids a product that "provide[s] a
 *   means to redistribute" it. So these values are INGESTED and built on, and
 *   the release is flagged not-redistributable so the publication gate can
 *   withhold them. Ingesting is permitted; republishing is the open question.
 *
 * RETIRED CODES ARE KEPT, DELIBERATELY
 *   A retired code is not a mistake to erase. Corpora, papers and model configs
 *   in the wild still use them, and a practitioner arriving with `mol` needs to
 *   be told it now points at `ron` — not to be told nothing. So retirement is
 *   recorded as a fact with the successor code beside it.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { verify } from '../fetchers/lib/fetch-lib.mjs';
import { spineResolver } from './spine.mjs';
import { registerSource } from './ingest-structure.mjs';
import { registerDerivation } from './ingest-aggregate.mjs';
import { shortestSubtag } from './tag-registry.mjs';
import { valueWriter } from './values.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(__dirname, '..', '..', 'data');

/** SIL ships tab-separated tables with a header and no quoting. */
function readTab(file) {
  if (!fs.existsSync(file)) return [];
  const lines = fs.readFileSync(file, 'utf-8').split('\n').filter(Boolean);
  const header = lines[0].split('\t');
  return lines.slice(1).map((line) => {
    const cells = line.split('\t');
    return Object.fromEntries(header.map((h, i) => [h, (cells[i] ?? '').trim()]));
  });
}

/** ISO 639-3's own single-letter codes, spelled out. Their vocabulary, expanded. */
const SCOPE = { I: 'Individual', M: 'Macrolanguage', S: 'Special' };
const TYPE = {
  L: 'Living', E: 'Extinct', A: 'Ancient', H: 'Historical', C: 'Constructed', S: 'Special',
};

/**
 * @param {import('better-sqlite3').Database} db
 * @param {{source?: string, license?: string}} spec
 */
export function ingestIso639(db, spec) {
  const { source = 'iso639-3', license: declaredLicense = null } = spec;
  const dir = path.join(DATA, source);

  const v = verify(source);
  if (!v.ok) {
    throw new Error(`${source} does not match its SNAPSHOT (${v.problems?.[0]?.why ?? 'drifted'}).`);
  }
  const upstream = registerSource(db, source, declaredLicense);

  const main = readTab(path.join(dir, 'iso-639-3.tab'));
  const macro = readTab(path.join(dir, 'iso-639-3-macrolanguages.tab'));
  const retired = readTab(path.join(dir, 'iso-639-3_Retirements.tab'));
  const names = readTab(path.join(dir, 'iso-639-3_Name_Index.tab'));

  const spine = spineResolver(db);

  const write = valueWriter(db, { sourceId: upstream.id, createdBy: 'cldf/ingest-iso639.mjs' });

  // The BCP 47 primary subtag is OURS, not SIL's. SIL publishes Part1 and
  // Part3; choosing the shorter of the two is RFC 5646's rule and our
  // application of it, so it carries champollion-derived with Derived_From
  // naming the release it was computed over. Writing it under SIL's name would
  // have them asserting something about a standard they do not maintain.
  const derivedSource = registerDerivation(db);
  const writeDerived = valueWriter(db, {
    sourceId: derivedSource, createdBy: 'cldf/ingest-iso639.mjs',
  });

  const stats = {
    source, languages: 0, offSpine: 0, asserted: 0, absence: 0,
    retiredCodes: 0, retiredWithNoSuccessor: 0, bcp47Tags: 0,
  };

  const put = (languageId, parameter, value) => {
    if (write(languageId, parameter, value)) stats.asserted++;
  };

  db.transaction(() => {
    for (const r of main) {
      const languageId = spine.resolve(r.Id, '');
      if (!languageId) { stats.offSpine++; continue; }
      stats.languages++;

      put(languageId, 'name', r.Ref_Name);
      put(languageId, 'iso639_1', r.Part1);
      // The SAME fact, projected as a resolvable alias: a language holding
      // Part1 'fr' is what 'fr' means. Kept as its own parameter because a
      // consumer resolving a code asks a different question from one
      // displaying a registry field, and one of them broke when this was
      // missing.
      if (r.Part1) put(languageId, 'codeAlias', r.Part1);
      // Expanded from SIL's own single letters. A card reading "I" tells a
      // reader nothing; "Individual" is the same claim, legible.
      put(languageId, 'isoScope', SCOPE[r.Scope] ?? r.Scope);
      put(languageId, 'isoLanguageType', TYPE[r.Language_Type] ?? r.Language_Type);

      // RFC 5646 §2.2.1: the primary subtag is the SHORTEST ISO 639 code a
      // language has. Chinese is `zh`, Plains Cree is `crk` because it has no
      // two-letter code. This is the bridge between the two code ecosystems and
      // it is arithmetic, not a lookup.
      const subtag = shortestSubtag(r.Part1 || null, languageId);
      writeDerived(languageId, 'bcp47Tag', subtag, {
        derivedFrom: upstream.id,
        comment: r.Part1
          ? `RFC 5646 takes the shortest ISO 639 code: the ISO 639-1 "${r.Part1}" over `
            + `the ISO 639-3 "${languageId}"`
          : 'RFC 5646 takes the shortest ISO 639 code; this language has no ISO 639-1',
      });
      stats.bcp47Tags++;
    }

    // The Name Index carries the alternate ("inverted" and print) names SIL
    // records. One value per name, deduplicated against the reference name so a
    // card does not list its own title twice.
    const refName = new Map(main.map((r) => [r.Id, r.Ref_Name]));
    for (const r of names) {
      const languageId = spine.resolve(r.Id, '');
      if (!languageId) continue;
      if (!r.Print_Name || r.Print_Name === refName.get(r.Id)) continue;
      put(languageId, 'alternateName', r.Print_Name);
    }

    // ACTIVE MEMBERSHIP ONLY.
    //
    // ISO's macrolanguage table keeps historic rows: `ajp` (South Levantine
    // Arabic) and `bbz` (Babalia Creole Arabic) are retired codes still listed
    // against `ara`. Ingesting them made Arabic claim 30 members where ISO
    // currently recognises 28, and the same overcount hit 757 cards.
    //
    // A retired code is not a member of anything any more — it is a redirect.
    // The relationship is preserved where it belongs, on `supersededCode`
    // below, which records what a dead code became.
    const retiredIds = new Set(retired.map((r) => r.Id));
    for (const r of macro) {
      if (retiredIds.has(r.I_Id)) {
        stats.retiredMacroMembers = (stats.retiredMacroMembers ?? 0) + 1;
        continue;
      }
      // Both directions of the same relation, so a card can answer either
      // question without a second lookup.
      const memberId = spine.resolve(r.I_Id, '');
      if (memberId) put(memberId, 'macrolanguage', r.M_Id);
      const macroId = spine.resolve(r.M_Id, '');
      if (macroId) put(macroId, 'macrolanguageMember', r.I_Id);
    }

    // Recorded on the SUCCESSOR, not on the retired code: a retired code is not
    // a spine entry, so a card keyed on it could never exist. `ron` says it
    // supersedes `mol`, which is the card a lookup can actually reach.
    for (const r of retired) {
      if (!r.Change_To) { stats.retiredWithNoSuccessor++; continue; }
      const successor = spine.resolve(r.Change_To, '');
      if (!successor) continue;
      put(successor, 'supersededCode', r.Id);
      stats.retiredCodes++;
    }
  })();

  return stats;
}
