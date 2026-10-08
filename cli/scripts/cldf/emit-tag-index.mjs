/**
 * emit-tag-index.mjs — the tag-resolution index, projected from the atlas.
 *
 * WHY AN INDEX RATHER THAN A DATABASE QUERY
 *   The CLI, the MCP server and the harness all need to answer "what language
 *   is this code?" on every invocation, and none of them should carry a SQLite
 *   dependency or a 90 MB store to do it. So resolution is projected once, at
 *   build time, into one small JSON artifact that ships with the package.
 *
 *   It is BUILD OUTPUT. Nothing edits it, and its provenance is the atlas
 *   release that produced it — stamped in the file, so a resolver can refuse an
 *   index from a different build rather than resolve against a stale one.
 *
 * WHAT PREDOMINANCE MEANS HERE, AND WHY IT IS COMPUTED AND NOT STORED
 *   The atlas stores the raw relation: which individual languages the BCP 47
 *   world folds into a macrolanguage tag, per registry. Predominance is a
 *   conclusion drawn from it, and it only follows under two conditions:
 *
 *     1. exactly ONE member folds in, and
 *     2. the registries that spoke do not disagree.
 *
 *   Chinese passes: only `cmn` folds into `zh`, and both registries say so.
 *   Akan fails on (1) — CLDR folds `fat` AND `twi` into `ak`, collapsing a
 *   cluster rather than crowning a member. Konkani fails on (2) — CLDR folds
 *   `gom`, langtags folds `knn`. Sanskrit and Zapotec fail on (1).
 *
 *   Those four are not defects to resolve. They are macrolanguages that
 *   genuinely have no single dominant member, and the index says so with the
 *   reason attached, so a caller can report it instead of guessing.
 */

/**
 * @param {import('better-sqlite3').Database} db
 * @param {{version: string, builtAt: string}} release
 */
export function buildTagIndex(db, release) {
  const langs = db.prepare(
    'SELECT ID, Name, Glottocode, ISO639P3code FROM cldf_languages ORDER BY ID',
  ).all();

  /** Pull one parameter into a Map<languageId, Array<{value, source}>>. */
  const gather = (parameter) => {
    const m = new Map();
    for (const r of db.prepare(
      'SELECT Subject_ID, Value, Source FROM cldf_values '
      + "WHERE Parameter_ID = ? AND Status = 'asserted' ORDER BY Subject_ID, Value",
    ).all(parameter)) {
      if (!m.has(r.Subject_ID)) m.set(r.Subject_ID, []);
      m.get(r.Subject_ID).push({ value: r.Value, source: r.Source });
    }
    return m;
  };

  const scope = gather('isoScope');
  const macro = gather('macrolanguage');
  const members = gather('macrolanguageMember');
  const folds = gather('canonicalisedMember');
  const bcp47 = gather('bcp47Tag');
  const fullTag = gather('bcp47FullTag');
  const aliases = gather('codeAlias');
  const suppress = gather('suppressScript');

  if (!scope.size) {
    throw new Error(
      'no isoScope values in the store, so no language can be told from a macrolanguage. '
      + 'The tag index cannot be built before iso639-3 has been ingested.',
    );
  }

  /** Strip the pin off a release id so the index cites a source, not a build. */
  const sourceName = (id) => id.replace(
    /-(?:[0-9a-f]{12,}|\d{8}|\d{4}-\d{2}-\d{2}|[\d.]+@[\d-]+|\d+\.\d+\.\d+)$/, '',
  );

  const languages = {};
  const stats = {
    languages: 0, macrolanguages: 0, withPredominant: 0,
    noPredominant: [], tags: 0, ambiguous: [],
  };

  // Claims are COLLECTED with their sources and partitioned at the end, rather
  // than resolved as they arrive. Two languages claiming one code has two very
  // different causes and they need different answers:
  //
  //   An IDENTITY collision — two languages holding the same spine ID or
  //   glottocode — is structurally impossible and means we misread something.
  //   Fatal.
  //
  //   An ALIAS collision is often a real disagreement between registries. `drh`
  //   (Darkhat) is the live case: IANA deprecates it in favour of `khk` and ISO
  //   639-3's retirement table agrees, while SIL langtags lists it as an
  //   equivalent of `mn` — so two of three say Halh Mongolian and one says the
  //   Mongolian macrolanguage. Killing the build over that would be treating
  //   the ordinary condition of this whole atlas, sources disagreeing, as a
  //   defect. It is recorded with both readings and resolves as ambiguous.
  /** @type {Map<string, Map<string, Set<string>>>} tag → language → sources */
  const claims = new Map();
  const identity = new Map();

  const claim = (tag, languageId, why, source = null) => {
    if (!tag) return;
    const t = String(tag).toLowerCase();
    if (why === 'identity') {
      const held = identity.get(t);
      if (held && held !== languageId) {
        throw new Error(
          `"${t}" is the identifier of both ${held} and ${languageId}. Two languages `
          + 'cannot share a spine ID or glottocode; this is a misread source, not a '
          + 'disagreement between registries.',
        );
      }
      identity.set(t, languageId);
    }
    if (!claims.has(t)) claims.set(t, new Map());
    const forTag = claims.get(t);
    if (!forTag.has(languageId)) forTag.set(languageId, new Set());
    if (source) forTag.get(languageId).add(sourceName(source));
  };

  for (const l of langs) {
    const id = l.ID;
    const isMacro = (scope.get(id) ?? []).some((v) => v.value === 'Macrolanguage');
    const entry = {
      name: l.Name ?? null,
      scope: isMacro ? 'macrolanguage' : 'individual',
    };

    // Every language answers to its own spine ID.
    claim(id, id, 'identity');
    if (l.Glottocode) claim(l.Glottocode, id, 'identity');

    const canonical = (bcp47.get(id) ?? [])[0]?.value ?? null;
    if (canonical) entry.bcp47 = canonical;

    const full = fullTag.get(id) ?? [];
    if (full.length) {
      // Registries disagree about default script or region for 17 languages.
      // Both readings are carried; nothing here picks one.
      entry.fullTags = full.map((f) => ({ tag: f.value, source: sourceName(f.source) }));
    }

    const sup = (suppress.get(id) ?? [])[0]?.value ?? null;
    if (sup) entry.suppressScript = sup;

    const mac = (macro.get(id) ?? [])[0]?.value ?? null;
    if (mac) entry.macrolanguage = mac;

    if (isMacro) {
      stats.macrolanguages++;
      const mem = [...new Set((members.get(id) ?? []).map((v) => v.value))].sort();
      if (mem.length) entry.members = mem;

      // Group the fold relation BY REGISTRY, because "how many members" and
      // "do the registries agree" are two different questions and both decide
      // the answer.
      const bySource = new Map();
      for (const f of folds.get(id) ?? []) {
        const s = sourceName(f.source);
        if (!bySource.has(s)) bySource.set(s, new Set());
        bySource.get(s).add(f.value);
      }
      if (bySource.size) {
        entry.folds = Object.fromEntries(
          [...bySource].sort(([a], [b]) => a.localeCompare(b))
            .map(([s, set]) => [s, [...set].sort()]),
        );
        const all = new Set([...bySource.values()].flatMap((s) => [...s]));
        const disagree = [...bySource.values()].some(
          (s) => s.size !== all.size || [...all].some((v) => !s.has(v)),
        );
        if (all.size === 1 && !disagree) {
          entry.predominant = {
            language: [...all][0],
            authorities: [...bySource.keys()].sort(),
            agreement: bySource.size > 1 ? 'unanimous' : 'single',
          };
          stats.withPredominant++;
        } else {
          entry.noPredominant = all.size > 1 && !disagree
            ? `${all.size} members fold into this tag (${[...all].sort().join(', ')}), `
              + 'so no single member is designated'
            : `the registries disagree about which member folds in: `
              + [...bySource].map(([s, v]) => `${s} says ${[...v].sort().join('/')}`).join(', ');
          stats.noPredominant.push(id);
        }
      }
    }

    for (const a of aliases.get(id) ?? []) claim(a.value, id, 'alias', a.source);

    languages[id] = entry;
    stats.languages++;
  }

  // ── Partition ─────────────────────────────────────────────────────────────
  // A tag with one candidate resolves. A tag with several does not, and the
  // index says so with every reading attributed, so the resolver can hand the
  // caller the actual disagreement instead of a coin-flip.
  //
  // An identity claim always wins over an alias claim, and that is not a
  // tiebreak: a code that IS a language cannot be an alias for a different one,
  // so an alias pointing at an occupied identifier is the aliasing source
  // overreaching. Recorded rather than dropped.
  const byTag = Object.create(null);
  const ambiguousTags = {};
  for (const [tag, candidates] of [...claims].sort(([a], [b]) => a.localeCompare(b))) {
    const own = identity.get(tag);
    if (own) {
      byTag[tag] = own;
      stats.tags++;
      const overreach = [...candidates.keys()].filter((c) => c !== own);
      if (overreach.length) {
        ambiguousTags[tag] = {
          resolvesTo: own,
          reason: `"${tag}" is ${own}'s own identifier; these sources also claim it as an `
            + 'alias of another language, which is overreach and does not override identity',
          alsoClaimedBy: overreach.map((c) => ({
            language: c, sources: [...(candidates.get(c) ?? [])].sort(),
          })),
        };
      }
      continue;
    }
    if (candidates.size === 1) {
      byTag[tag] = [...candidates.keys()][0];
      stats.tags++;
      continue;
    }
    ambiguousTags[tag] = {
      resolvesTo: null,
      reason: `registries disagree about which language "${tag}" denotes`,
      alsoClaimedBy: [...candidates].sort(([a], [b]) => a.localeCompare(b))
        .map(([c, srcs]) => ({ language: c, sources: [...srcs].sort() })),
    };
    stats.ambiguous.push(tag);
  }

  return {
    index: {
      _doc:
        'Tag resolution index — BUILD OUTPUT, projected from the atlas. Maps every code '
        + 'Champollion can resolve (ISO 639-3, ISO 639-1, glottocode, BCP 47 tag, retired '
        + 'and deprecated codes) onto one spine language, and records what the BCP 47 '
        + 'registries say about macrolanguages. `predominant` is present only where '
        + 'exactly one member folds into the tag AND the registries that spoke agree; '
        + 'where it is absent, `noPredominant` says why. Nothing here propagates coverage: '
        + 'that a tag resolves through a macrolanguage is a route, never a claim that a '
        + 'method supporting the macrolanguage supports the member.',
      atlas: { version: release.version, builtAt: release.builtAt },
      // The pinned releases this index was resolved from, so a reader can cite
      // the index without reaching back into the atlas.
      authorities: db.prepare(
        'SELECT DISTINCT Source FROM cldf_values WHERE Parameter_ID IN '
        + "('isoScope','macrolanguage','macrolanguageMember','canonicalisedMember',"
        + "'bcp47Tag','bcp47FullTag','codeAlias','suppressScript') ORDER BY Source",
      ).all().map((r) => r.Source),
      byTag,
      ambiguousTags,
      languages,
    },
    stats,
  };
}
