#!/usr/bin/env node

/**
 * extractor: method-registry → method cards.
 *
 * WHAT A METHOD CARD IS FOR
 *   The atlas answers "can this language be translated, and how". Half that
 *   answer is about the language; the other half is about the METHOD — what it
 *   costs, what licence it ships under, whether it can be used commercially,
 *   what credentials it needs, whether it runs locally or calls out.
 *
 *   Those facts already exist in `shared/method-registry.json`, which the
 *   Python harness and the JS CLI both read. What they did NOT have was a card:
 *   a projected, cited, publishable view the website can render beside a
 *   language card, with the same correction and comment affordances.
 *
 * WHY THIS GOES THROUGH THE SAME MACHINERY
 *   It would have been quicker to read the JSON in the website build. That is
 *   how the language corpus ended up with 93 scripts and no definition of what a
 *   card is. A method card is projected from facts, from a pinned release,
 *   through the same spec — so a correction propagates the same way, absence
 *   behaves the same way, and there is one answer to "where does this value come
 *   from" across all three card types.
 *
 * THE PIN FOR A FILE WE WRITE OURSELVES
 *   No DOI, no upstream commit — we are the upstream. It pins to the file's own
 *   sha256 plus the git commit that last changed it, so a value is traceable to
 *   a diff and an author. A curated file needs MORE provenance than a fetched
 *   one, not less: there is no upstream to check it against.
 *
 * WHAT IS DELIBERATELY NOT ON A METHOD CARD
 *   Any measured score. chrF, BLEU and COMET are run results keyed by
 *   (method, dataset, metric) and belong on the leaderboard. "This method scored
 *   X" is not a property of the method; it is a property of a run.
 *
 * Usage:
 *   node cli/scripts/extractors/methods.mjs [--dry-run]
 */

import { fileURLToPath } from 'node:url';
import { openCurated } from './lib/curated.mjs';

export const source = 'curated:method-registry';
export const entityType = 'method';
const FILE = 'shared/method-registry.json';
const SELF = 'extractors/methods.mjs';

/** Registry keys that are RUNTIME WIRING, not facts about the method. */
const WIRING = new Set([
  'cli_name', 'env', 'credential_env', 'credential_env_all', 'default_base_url',
  'locale_map', 'optional_extra', 'runtimes', 'max_batch',
]);

export function extract({ db = null } = {}) {
  const x = openCurated({
    file: FILE, source, entityType, extractor: SELF, db,
  });

  const entries = x.data.entries ?? {};
  let n = 0;

  for (const [id, m] of Object.entries(entries)) {
    x.entity(id, id);
    n++;
    const A = (domain, property, value, extra = {}) => x.assert({
      id, domain, property, value, url: m.homepage ?? null, ...extra,
    });

    A('identity', 'kind', m.kind);
    A('identity', 'methodClass', m.method_class);
    A('identity', 'paradigm', m.paradigm, {
      notes: 'how the method produces a translation — neural NMT, raw LLM, '
        + 'rule-based, and so on. The single most useful thing to know before '
        + 'reading any score.',
    });
    A('identity', 'homepage', m.homepage);

    // ── Licensing, which is the constraint that actually gates use ────────
    if (m.license) {
      A('licensing', 'license', m.license, { raw: m.license });
    } else {
      x.absent({
        id, domain: 'licensing', property: 'license',
        notes: 'the registry records no licence for this method. Unstated is NOT '
          + 'permissive — a method with no licence recorded cannot be assumed usable.',
      });
    }
    if (m.commercialReady !== undefined) {
      A('licensing', 'commercialReady', String(m.commercialReady), {
        valueType: 'boolean',
        notes: 'whether the method may be used in a commercial lane. Derived from '
          + 'its licence by a human, recorded here so the CLI and the harness '
          + 'apply the same answer.',
      });
    }

    // ── Cost, which the registry states in prose and should not pretend to
    //    state numerically ─────────────────────────────────────────────────
    if (m.cost_note) {
      A('cost', 'costNote', m.cost_note, {
        notes: 'the registry\'s own words. Not parsed into a number: "~$20 / 1M '
          + 'characters" and "per-model token pricing (fetched at runtime)" are '
          + 'not the same kind of claim and flattening them would invent one.',
      });
    } else {
      x.absent({ id, domain: 'cost', property: 'costNote',
        notes: 'no cost recorded for this method' });
    }

    // ── Operational shape ─────────────────────────────────────────────────
    const needsCredential = Boolean(
      (m.env?.length) || m.credential_env || (m.credential_env_all?.length),
    );
    A('operations', 'requiresCredential', String(needsCredential), { valueType: 'boolean' });
    A('operations', 'runsLocally', String(m.kind === 'local' || id === 'local'
      || id === 'local-model'), {
      valueType: 'boolean',
      notes: 'a locally-run method sends no text to a third party, which is what '
        + 'makes it usable for sealed and consent-gated corpora',
    });
    if (m.max_batch) A('operations', 'maxBatch', String(m.max_batch), { valueType: 'integer' });

    // Anything in the registry we have NOT modelled is reported rather than
    // dropped, so a new key added upstream cannot go unnoticed.
    for (const key of Object.keys(m)) {
      if (WIRING.has(key)) continue;
      if (['kind', 'method_class', 'paradigm', 'homepage', 'license',
        'commercialReady', 'cost_note'].includes(key)) continue;
      x.assert({
        id, domain: 'unmodelled', property: key, value: m[key],
        notes: 'present in the registry but not yet given a place on the card',
      });
    }
  }

  x._count = n;
  return x;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const x = extract();
  if (process.argv.includes('--dry-run')) {
    console.log(`  DRY RUN — ${x._pending.length} fact(s) for ${x._count} method(s).`);
  } else {
    const r = x.commit();
    console.log(`\n  ✓ method-registry → ${r.written} facts for ${r.entities} methods`);
    console.log(`    asserted ${r.asserted} · absent ${r.absent}`);
    console.log(`    pinned to sha256 ${x.pin.sha256.slice(0, 12)}…`
      + `${x.pin.commit ? ` @ ${x.pin.commit.slice(0, 8)}` : ' (UNTRACKED)'}\n`);
  }
  if (x._ownsDb) x.db.close();
}
