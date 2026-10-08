/**
 * ingest-giellalt-resources.mjs — the GiellaLT/ALTLab catalogue → resource existence.
 *
 * FACTS ABOUT LANGUAGES, NOT METHODS
 *   None of these is a translation method — you cannot ask an analyser, a
 *   keyboard layout or a dictionary for a translation. They are resources that
 *   exist for a language, which is why they belong on the language rather than
 *   as method nodes with coverage edges.
 *
 * FIVE KINDS, FIVE PARAMETERS, ONE PATHWAY
 *   The catalogue publishes analysers, dictionaries, corpora, keyboards and
 *   speech resources under five naming conventions. Each becomes its own
 *   parameter because they answer different questions — "can I check this
 *   word is well-formed" and "can I type this language at all" are not the
 *   same question, and one `hasResource` flag holding both would answer
 *   neither.
 *
 *   Dictionaries are the exception that proves it: they share `dictionaryResource`
 *   with the CLDF dictionary datasets, because those ARE the same fact from a
 *   different upstream. Same fact, one parameter; different fact, different
 *   parameter.
 *
 * DICTIONARIES ARE BILINGUAL, SO THEY WRITE TWO EDGES
 *   `dict-crk-eng` is a fact about Plains Cree AND about English, and it is
 *   directed — the entry records which side this language is on. A dictionary
 *   recorded only against its source language would be invisible from the side
 *   most people look it up from.
 *
 * EXISTENCE, NEVER CAPABILITY
 *   That a repository exists, who publishes it, its licence, whether it is
 *   archived. Never that it compiles, covers the grammar, or is accurate.
 *   Those are measured claims about output and belong to a run — the
 *   card-boundary rule permits resource existence and forbids performance, and
 *   an entry implying an untested analyser works would be the more damaging
 *   error.
 *
 * THE LICENCE IS PART OF THE FACT
 *   The catalogue is not uniform, and this project's own boundary forbids
 *   bundling GPL/AGPL code into proprietary CLI paths. So a consumer deciding
 *   whether they may USE a resource must not have to go and look the terms up;
 *   they travel with each entry.
 *
 * THE UNESTABLISHED ONES ARE THE ONES WE CARE MOST ABOUT
 *   Most Indigenous North American entries in the catalogue carry terms GitHub
 *   reports as NOASSERTION. Recording that a public repository exists is fine.
 *   Inferring permission for anything past that is not, and the value says
 *   which state it is in rather than leaving a reader to assume.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { verify } from '../fetchers/lib/fetch-lib.mjs';
import { registerSource } from './ingest-structure.mjs';
import { tagResolver } from './tag-registry.mjs';
import { valueWriter, VARIANT } from './values.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(__dirname, '..', '..', 'data');

/** GitHub says NOASSERTION when it cannot identify a licence file. */
const UNESTABLISHED = new Set([null, undefined, '', 'NOASSERTION', 'NONE']);

/**
 * Which parameter each kind writes to. Declared here rather than derived from
 * the kind string, so adding a convention upstream cannot silently invent a
 * parameter that the decision layer has never heard of.
 */
const PARAMETER = {
  analyser: 'fstResource',
  dictionary: 'dictionaryResource',
  corpus: 'monolingualCorpusResource',
  keyboard: 'keyboardResource',
  speech: 'speechResource',
};

/**
 * @param {import('better-sqlite3').Database} db
 * @param {{source?: string, license?: string}} spec
 */
export function ingestGiellaltResources(db, spec = {}) {
  const { source = 'giellalt-resources', license: declaredLicense = null } = spec;

  const v = verify(source);
  if (!v.ok) {
    throw new Error(`${source} does not match its SNAPSHOT (${v.problems?.[0]?.why ?? 'drifted'}).`);
  }
  const upstream = registerSource(db, source, declaredLicense);

  const resources = JSON.parse(
    fs.readFileSync(path.join(DATA, source, 'resources.json'), 'utf-8'),
  );
  if (!Array.isArray(resources) || !resources.length) {
    throw new Error(`${source}: the pinned catalogue is empty, which is a fetch fault`);
  }

  const tags = tagResolver(db);
  const write = valueWriter(db, {
    sourceId: upstream.id, createdBy: 'cldf/ingest-giellalt-resources.mjs',
  });

  const stats = {
    source, languages: 0, offSpine: 0, asserted: 0, absence: 0,
    resources: resources.length, byKind: {}, licenceUnestablished: 0, copyleft: [],
    unmatched: [],
    unmatchedNoun: 'resource code',
    unmatchedNote:
      'These catalogues name some repositories for variants they will not claim an ISO '
      + 'code for — lang-est-x-plamk is a BCP 47 private-use construction, which denotes '
      + 'no registered language by design and must not be collapsed onto its base.',
  };
  const covered = new Set();
  const unresolved = new Set();

  db.transaction(() => {
    for (const r of resources) {
      const parameter = PARAMETER[r.kind];
      if (!parameter) {
        throw new Error(
          `${source}: the catalogue carries kind "${r.kind}", which no parameter is `
          + 'declared for. A new convention upstream is a decision to record, not a value '
          + 'to invent a home for.',
        );
      }

      const unestablished = UNESTABLISHED.has(r.license);
      if (unestablished) stats.licenceUnestablished++;
      if (/^A?GPL/.test(r.license ?? '')) stats.copyleft.push(r.name);

      // A dictionary is a fact about BOTH its languages, and directed. Every
      // other kind names one. Iterating the codes is what keeps the second side
      // of `dict-crk-eng` from vanishing.
      for (const [i, code] of r.codes.entries()) {
        const languageId = tags.resolve(code);
        if (!languageId) { unresolved.add(code); continue; }
        covered.add(languageId);
        stats.byKind[r.kind] = (stats.byKind[r.kind] ?? 0) + 1;

        const other = r.codes.length === 2 ? r.codes[1 - i] : null;
        if (write(languageId, parameter, JSON.stringify({
          name: r.name,
          url: r.url,
          // From the fetched record, NOT a constant. Two organisations publish
          // a lang-crk, and hardcoding one publisher made Plains Cree's two
          // independent analysers indistinguishable on the card — the exact
          // collapse recording the publisher exists to prevent.
          publisher: r.publisher,
          // Verbatim, including the unestablished state. A null here would read
          // as "no restrictions" when it means "nobody could tell".
          license: r.license ?? null,
          licenceEstablished: !unestablished,
          archived: r.archived,
          ...(other ? { pairedWith: other, direction: i === 0 ? 'from' : 'to' } : {}),
          ...(r.original ? { originalUnconverted: true } : {}),
        }), {
          // Without a discriminator every resource of a kind collapses onto one
          // key and the projector reads five repositories as five sources
          // disagreeing about one thing. RESOURCE rather than CORPUS: a keyboard
          // layout is not a corpus, and borrowing the nearest existing axis is
          // how one column came to carry five meanings in the first place.
          variantType: VARIANT.RESOURCE,
          variantId: `giellalt:${r.name}:${r.publisher}`,
          comment: unestablished
            ? 'licence not identifiable from the repository — existence is recorded, '
              + 'and no permission beyond pointing at it is inferred'
            : `${r.license}${/^A?GPL/.test(r.license ?? '')
              ? ' — copyleft; must not be bundled into a proprietary CLI path'
              : ''}`,
          confidence: 'fetched',
        })) { stats.asserted++; }
      }
    }
  })();

  stats.languages = covered.size;
  stats.offSpine = unresolved.size;
  if (unresolved.size) {
    const list = [...unresolved].sort();
    stats.unmatched.push(
      `${list.slice(0, 8).join(', ')}${list.length > 8 ? ` … (${list.length})` : ''}`,
    );
  }
  return stats;
}
