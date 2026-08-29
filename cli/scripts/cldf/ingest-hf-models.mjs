/**
 * ingest-hf-models.mjs — the HuggingFace sweep → method nodes + coverage edges.
 *
 * SCALE IS THE DESIGN PROBLEM
 *   17,730 models, 10,608 of which declare a language. Every other method source
 *   in this pipeline contributes single or double digits. This one can attach
 *   thousands of methods to English, and a language card listing three thousand
 *   models is not an index — it is a log.
 *
 *   So the EDGES all go into the atlas, where they belong and can be queried,
 *   and legibility is a projection concern rather than an ingest filter. Nothing
 *   is dropped from the store to make a card look tidy; that would be deciding
 *   what is true by what is convenient to render.
 *
 * LANGUAGES COME FROM THE CARD, NOT THE TAGS
 *   `jax` is also Jambi Malay, `mms` is also Southern Mam, `pt` is also
 *   Portuguese. The declared `cardData.language` field is what the author
 *   actually said. Its spelling varies because model-card frontmatter is
 *   user-authored YAML, so the accepted variants are declared in the inclusion
 *   policy rather than guessed at here.
 *
 * DERIVATION IS RECORDED WHERE DECLARED AND NEVER INFERRED
 *   5,391 models cite a `base_model`. Many more are plainly derivative and do
 *   not say so: WindstormLabs publishes 3,139 models named
 *   `origin-Helsinki-NLP-opus-mt-*` and manancode 1,361 ctranslate2 conversions.
 *   Reading derivation off a repository NAME would be manufacturing — a name is
 *   not a citation — so those stay unmarked, and any count that matters must say
 *   whether it counts uploads or independent methods.
 *
 * COLLECTION CODES ARE NOT EXPANDED
 *   `mul`, `aav` and the literal string `multilingual` cover many languages.
 *   Expanding one into its members would assert coverage of each on the strength
 *   of a label — the same propagation error the macrolanguage rule exists to
 *   prevent. They fail to resolve, and are counted and named.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { verify } from '../fetchers/lib/fetch-lib.mjs';
import { registerSource } from './ingest-structure.mjs';
import { registerDerivation } from './ingest-aggregate.mjs';
import { tagResolver } from './tag-registry.mjs';
import { valueWriter, VARIANT, SUBJECT } from './values.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(__dirname, '..', '..', 'data');
const REPO = path.join(__dirname, '..', '..', '..');
const POLICY = path.join(REPO, 'shared', 'catalogue', 'hf-inclusion-policy.json');

/**
 * @param {import('better-sqlite3').Database} db
 * @param {{source?: string, license?: string}} spec
 */
export function ingestHfModels(db, spec = {}) {
  const { source = 'hf-models', license: declaredLicense = null } = spec;

  const v = verify(source);
  if (!v.ok) {
    throw new Error(`${source} does not match its SNAPSHOT (${v.problems?.[0]?.why ?? 'drifted'}).`);
  }
  const upstream = registerSource(db, source, declaredLicense);
  const derivedSource = registerDerivation(db);

  if (!fs.existsSync(POLICY)) {
    throw new Error(
      'shared/catalogue/hf-inclusion-policy.json is missing. What to do with 17,730 '
      + 'models is a decision, and it belongs in the tracked decision layer rather than '
      + 'in this reader.',
    );
  }
  const policy = JSON.parse(fs.readFileSync(POLICY, 'utf-8'));
  const langKeys = policy.languageSource?.variantSpellings ?? ['language'];

  const models = JSON.parse(
    fs.readFileSync(path.join(DATA, source, 'translation-models.json'), 'utf-8'),
  );
  if (!Array.isArray(models) || !models.length) {
    throw new Error(`${source}: the pinned sweep is empty or not an array`);
  }

  const tags = tagResolver(db);
  const onMethod = valueWriter(db, {
    sourceId: derivedSource, createdBy: 'cldf/ingest-hf-models.mjs', subjectType: SUBJECT.METHOD,
  });
  const onLanguage = valueWriter(db, {
    sourceId: upstream.id, createdBy: 'cldf/ingest-hf-models.mjs',
  });
  const addNode = db.prepare(`
    INSERT INTO cldf_contributions (ID, Type, Name, Description, Contributor)
    VALUES (?, 'method', ?, ?, ?) ON CONFLICT(ID) DO NOTHING
  `);

  const stats = {
    source, languages: 0, offSpine: 0, asserted: 0, absence: 0,
    modelsRead: models.length, methods: 0, edges: 0,
    declaredNoLanguage: 0, declaredButUnresolved: 0, gated: 0, withBaseModel: 0,
    unresolvedCodes: new Map(), unmatched: [],
    unmatchedNoun: 'declared code',
    unmatchedNote:
      'Declared on a model card and resolving to no language. Collection codes (mul, '
      + 'aav) and the literal "multilingual" are the bulk of these; expanding one into '
      + 'its members would assert coverage of each, which is the propagation error the '
      + 'macrolanguage rule prevents.',
  };
  const covered = new Set();

  db.transaction(() => {
    for (const m of models) {
      if (!m?.id || m.private) continue;

      // The declared field, under any spelling the policy accepts. Reading only
      // the canonical one silently drops models whose authors did declare.
      let declared = null;
      for (const k of langKeys) {
        const val = m.cardData?.[k];
        if (Array.isArray(val) && val.length) { declared = val; break; }
        if (typeof val === 'string' && val.trim()) { declared = [val]; break; }
      }
      if (!declared) { stats.declaredNoLanguage++; continue; }

      const resolved = new Map();
      const unresolved = [];
      for (const raw of declared) {
        const code = String(raw).toLowerCase().trim();
        if (!code) continue;
        const primary = code.split('-')[0];
        const id = tags.resolve(primary);
        if (id) resolved.set(id, code);
        else {
          unresolved.push(code);
          stats.unresolvedCodes.set(code, (stats.unresolvedCodes.get(code) ?? 0) + 1);
        }
      }
      if (!resolved.size) { stats.declaredButUnresolved++; stats.offSpine += unresolved.length; continue; }

      const methodId = `method:hf:${m.id}`;
      addNode.run(
        methodId,
        m.id,
        'HuggingFace Hub translation model. Coverage is the model card\'s own declared '
        + 'language list, which is a weaker claim than a vendor\'s documented list.',
        m.author ?? null,
      );
      stats.methods++;

      // ── Facts about the METHOD ──────────────────────────────────────────
      onMethod(methodId, 'methodLanguageCount', resolved.size, {
        confidence: 'derived', derivedFrom: upstream.id,
        comment: `${declared.length} code(s) declared, ${resolved.size} resolved`,
      });
      onMethod(methodId, 'methodPairsObserved', '0', {
        confidence: 'derived', derivedFrom: upstream.id,
        comment: 'a model card lists languages, never pairs; any pair claim would be '
          + 'an assumption about the model',
      });
      if (m.gated) stats.gated++;
      // Declared derivation only. A repository NAME that looks derivative is not
      // a citation, and 6,160 of these are plainly re-hosts that say nothing.
      const base = m.cardData?.base_model ?? m.cardData?.basemodel ?? null;
      if (base) {
        stats.withBaseModel++;
        onMethod(methodId, 'methodDerivedFrom', Array.isArray(base) ? base[0] : base, {
          confidence: 'verified', derivedFrom: upstream.id,
          comment: 'declared by the model card; never inferred from the repository name',
        });
      }

      // ── Edges ───────────────────────────────────────────────────────────
      for (const [languageId, code] of resolved) {
        covered.add(languageId);
        if (onLanguage(languageId, 'methodSupport', 'open', {
          variantType: VARIANT.METHOD,
          variantId: `hf:${m.id}`,
          comment: `${m.id} declares "${code}" on its model card`,
          // The weakest tier in the register: one line of unreviewed YAML, not
          // a considered statement about a deployed service.
          confidence: 'model-card-declared',
        })) { stats.asserted++; stats.edges++; }
      }
    }
  })();

  stats.languages = covered.size;
  const worst = [...stats.unresolvedCodes].sort((a, b) => b[1] - a[1]).slice(0, 8);
  if (worst.length) {
    stats.unmatched = worst.map(([c, n]) => `${c} (${n})`);
  }
  stats.unresolvedCodes = stats.unresolvedCodes.size;
  return stats;
}
