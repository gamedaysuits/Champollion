/**
 * project.mjs — the CLDF atlas → language cards.
 *
 * Cards are the READ MODEL. CLDF is an interchange format, not a UI format, so
 * the atlas stays flat and standard while the card is nested and convenient.
 * The card is derived; it is never authored. Hand-editing one means losing the
 * edit on the next build.
 *
 * THE FOUR RULES, AND WHY THEY ARE THE ONLY FOUR
 *   direct      one source speaks. The value, plus where it came from.
 *   list        one source speaks several times (scripts, countries).
 *   attributed  more than one body may speak, and they may disagree. ALL values
 *               are kept with their sources and the disagreement is described.
 *               There is no rule that picks a winner, because picking one would
 *               destroy the evidence that there was a question.
 *   derived     computed by us. Carries champollion-derived, never an upstream's
 *               name, and names what it was derived from.
 *
 * ABSENCE NEVER REACHES A CARD
 *   The atlas records `not_attested` — a source covered this language and its
 *   documentation did not answer. That is worth storing and worth querying, and
 *   it is what tells us a card is thin for a reason rather than by neglect.
 *   But it must not become a card field: an empty row on a web page asserts
 *   that there is nothing to know, when it means we were not told. So absence
 *   rows are counted into `coverage` and otherwise OMITTED.
 *
 * DISAGREEMENT VOCABULARY
 *   single                one source, one value
 *   unanimous             several sources, same value
 *   multiple-assessments  ONE source recording more than one value. ELCat does
 *                         this constantly — 2,497 language/parameter pairs, and
 *                         every one of them is ELCat differing from itself
 *                         across assessments, not two bodies disagreeing. An
 *                         earlier draft called these "conflicting", which read
 *                         as a dispute between authorities and there were zero
 *                         of those in the data.
 *   conflicting           DIFFERENT sources, different values, same scale — a
 *                         real dispute between authorities, which the reader
 *                         should see rather than have resolved for them.
 *   incommensurable       different sources on DIFFERENT scales. ELCat's
 *                         "awakening" and Glottolog AES's "moribund" are not a
 *                         disagreement; they are two vocabularies, and saying
 *                         otherwise would invent a dispute. This is what
 *                         Source_Scale exists to detect.
 *   multiple-variants     values describing DIFFERENT SUBJECTS under one
 *                         parameter. `methodSupport` with google=service and
 *                         nllb=open is two methods; an endonym in Latin and the
 *                         same endonym in Arabic script is one name written two
 *                         ways. Neither is a dispute, and an earlier version
 *                         labelled 202 method cards and 376 endonym cards
 *                         "conflicting" for want of this distinction.
 *
 * WHAT ALL FIVE HAVE IN COMMON
 *   None of them resolve anything. Every value survives with its source, and
 *   the label only describes the SHAPE of the disagreement so a reader knows
 *   whether they are looking at a dispute, a vocabulary difference, or two
 *   things that were never the same question.
 */

import { createHash } from 'node:crypto';

/** Set a dotted path on an object, creating intermediate objects. */
function setPath(obj, dotted, value) {
  const keys = dotted.split('.');
  let node = obj;
  for (const k of keys.slice(0, -1)) {
    node[k] ??= {};
    node = node[k];
  }
  node[keys.at(-1)] = value;
}

/**
 * How much anyone actually checked, strongest first. A vendor's documented
 * language list and one line of unreviewed YAML on a fine-tune are both
 * "coverage", and a card that showed them identically would flatten the only
 * difference that matters.
 */
const TIER_STRENGTH = [
  'fetched', 'verified', 'confirmed', 'partially-confirmed',
  'publisher-count-only', 'derived', 'model-card-declared', 'unverified',
];

/** How many entries a tiered field names before it says "and more". */
const TIERED_NAMED_LIMIT = 25;

/** Deterministic: same atlas in, same bytes out. */
const bySource = (a, b) => String(a.Variant_ID ?? '').localeCompare(String(b.Variant_ID ?? ''))
  || String(a.Source).localeCompare(String(b.Source))
  || String(a.Value).localeCompare(String(b.Value));

/**
 * Cast a stored value to the type its parameter declares.
 *
 * The store keeps everything as text because that is what CSV is, but a card is
 * read by code. `"hasCoreCase": "0"` is truthy in JavaScript, so a consumer
 * asking `if (card.typologicalProfile.hasCoreCase)` gets the WRONG ANSWER on
 * every language where the feature is absent — which is most of them.
 *
 * Anything that does not cast cleanly is left as the source's own text rather
 * than coerced to null: a value we cannot type is still a value the source
 * asserted, and silently dropping it would be worse than showing it.
 */
function cast(value, datatype) {
  if (value === null || value === undefined) return value;
  switch (datatype) {
    case 'boolean': {
      if (value === '1' || value === 'true') return true;
      if (value === '0' || value === 'false') return false;
      return value;
    }
    case 'integer': {
      return /^-?\d+$/.test(value) ? Number(value) : value;
    }
    case 'float': {
      return /^-?\d+(\.\d+)?$/.test(value) ? Number(value) : value;
    }
    case 'json': {
      // Stored as text because that is what CSV is. Left as text if it does not
      // parse, rather than dropped: unreadable is better than invisible.
      try { return JSON.parse(value); } catch { return value; }
    }
    default:
      return value;
  }
}

/**
 * Describe an attributed field: every value, with its source, plus a statement
 * about whether the sources actually disagree.
 */
function attribute(rows, scaleOf, datatype) {
  const sorted = [...rows].sort(bySource);
  const values = sorted.map((r) => ({
    value: cast(r.Value, datatype),
    source: r.Source,
    // Exposed, because it is what tells a reader that two values describe
    // different subjects (method, script, dataset) rather than disagreeing.
    ...(r.Variant_ID ? { variant: r.Variant_ID, variantType: r.Variant_Type } : {}),
    ...(r.Value_Year ? { year: r.Value_Year } : {}),
    ...(r.Comment ? { note: r.Comment } : {}),
    ...(scaleOf.get(`${r.Parameter_ID}|${r.Source}`)
      ? { scale: scaleOf.get(`${r.Parameter_ID}|${r.Source}`) } : {}),
  }));

  const distinctValues = new Set(values.map((v) => v.value));
  const distinctSources = new Set(values.map((v) => v.source));
  const scales = new Set(values.map((v) => v.scale).filter(Boolean));

  // A VARIANT names a different subject, not a competing claim about the same
  // one. `methodSupport` with google=service and nllb=open is two methods, not
  // a disagreement; an endonym in Latin and the same endonym in Arabic script
  // is one name written two ways. Calling either "conflicting" invents a
  // dispute — 202 method cards and 376 endonym cards were labelled that way.
  //
  // Empty variants are excluded: LinguaMeta records an endonym with no script
  // tag and Wikidata records one with `ha`. Treating the absence of a tag as a
  // distinct variant would split two sources that actually agree.
  const distinctVariants = new Set(values.map((v) => v.variant).filter(Boolean));

  let agreement;
  if (values.length === 1) agreement = 'single';
  else if (distinctValues.size === 1) agreement = 'unanimous';
  else if (distinctVariants.size > 1) agreement = 'multiple-variants';
  // One body saying several things is not two bodies disagreeing. Checked
  // before scale, because a single source is on a single scale by definition.
  else if (distinctSources.size === 1) agreement = 'multiple-assessments';
  else if (scales.size > 1) agreement = 'incommensurable';
  else agreement = 'conflicting';

  return {
    agreement,
    ...(agreement === 'single' || agreement === 'unanimous'
      ? { consensus: values[0].value } : {}),
    values,
  };
}

/**
 * Project every language that has at least one asserted value.
 *
 * A language with no asserted value gets NO CARD. Publishing an empty card
 * would assert that the language is documented when what we have is a code in
 * a registry — which is exactly the class of claim this pass exists to remove.
 *
 * @param {import('better-sqlite3').Database} db
 * @param {{version?: string, builtAt?: string}} release
 * @returns {{cards: Map<string, object>, stats: object}}
 */
export function projectCards(db, release = {}) {
  const parameters = new Map(
    db.prepare("SELECT * FROM cldf_parameters WHERE Disposition IN ('DONE','PARTIAL')")
      .all().map((p) => [p.ID, p]),
  );

  // Which scale each (parameter, source) speaks, so incommensurability is a
  // fact about the data rather than a guess.
  const scaleOf = new Map();
  for (const c of db.prepare('SELECT DISTINCT Parameter_ID, Source_Scale FROM cldf_codes').all()) {
    scaleOf.set(`${c.Parameter_ID}|${c.Source_Scale}`, c.Source_Scale);
  }

  const languages = new Map(
    db.prepare('SELECT * FROM cldf_languages').all().map((l) => [l.ID, l]),
  );
  // Nodes that are not languages live in their own table, and until this was
  // read every method and corpus card projected NAMELESS — `method:nllb` with
  // no display name at all, because the only node lookup was the language one.
  // Two node tables is what the subject split means; one of them being the only
  // one anyone read is the bug it was always going to produce.
  const contributions = new Map(
    db.prepare('SELECT ID, Name, Description, Citation FROM cldf_contributions')
      .all().map((c) => [c.ID, c]),
  );

  // Which subject each card is about, and how many parameters could apply to
  // it. A method card reporting "2 of 71 components present" counts language
  // parameters a method can never have — the coverage figure exists to say how
  // much we know, and measuring it against the wrong denominator makes every
  // method card look like a stub.
  const subjectOf = new Map(
    db.prepare('SELECT Subject_ID, Subject_Type FROM cldf_values GROUP BY Subject_ID')
      .all().map((r) => [r.Subject_ID, r.Subject_Type]),
  );
  const parametersFor = new Map();
  for (const p of parameters.values()) {
    const subject = p.Subject || 'language';
    parametersFor.set(subject, (parametersFor.get(subject) ?? 0) + 1);
  }

  const values = db.prepare(
    'SELECT * FROM cldf_values ORDER BY Subject_ID, Parameter_ID, Source, Value',
  ).all();

  // Source key → the source name a card should show. The stored key carries the
  // release (grambank-v1.0.3) which is what makes it checkable; the card shows
  // it whole, because a name without a release cannot say which bytes.
  const byLanguage = new Map();
  for (const v of values) {
    if (!parameters.has(v.Parameter_ID)) continue;
    if (!byLanguage.has(v.Subject_ID)) byLanguage.set(v.Subject_ID, []);
    byLanguage.get(v.Subject_ID).push(v);
  }

  const cards = new Map();
  const stats = {
    languagesInSpine: languages.size,
    cardsProjected: 0,
    noAssertedValue: 0,
    fieldInstances: 0,
    absenceRecorded: 0,
    multipleAssessments: 0,
    multipleVariants: 0,
    conflicts: 0,
    incommensurable: 0,
  };

  for (const [code, rows] of byLanguage) {
    const language = languages.get(code);
    const asserted = rows.filter((r) => r.Status === 'asserted');
    const absent = rows.filter((r) => r.Status !== 'asserted');
    stats.absenceRecorded += absent.length;

    if (!asserted.length) { stats.noAssertedValue++; continue; }

    const node = language ?? contributions.get(code);
    const card = { code };
    if (node?.Name) card.name = node.Name;
    // Only contributions carry these. A language's description is a projected
    // field with its own source and citation, and overwriting it from the node
    // table would put an uncited string where a cited one belongs.
    if (!language && node) {
      if (node.Description) card.description = node.Description;
      if (node.Citation) card.citation = node.Citation;
    }

    const sources = new Map();
    const byParameter = new Map();
    for (const r of asserted) {
      if (!byParameter.has(r.Parameter_ID)) byParameter.set(r.Parameter_ID, []);
      byParameter.get(r.Parameter_ID).push(r);
    }

    for (const [parameterId, group] of byParameter) {
      const p = parameters.get(parameterId);
      const field = p.Card_Field;

      switch (p.Projection_Rule) {
        case 'attributed': {
          const described = attribute(group, scaleOf, p.Datatype);
          if (described.agreement === 'multiple-assessments') stats.multipleAssessments++;
          if (described.agreement === 'multiple-variants') stats.multipleVariants++;
          if (described.agreement === 'conflicting') stats.conflicts++;
          if (described.agreement === 'incommensurable') stats.incommensurable++;
          setPath(card, field, described);
          break;
        }
        case 'tiered': {
          // For a parameter where one language can attract thousands of values.
          // English has 5,420 methods; the median language has 17. Listing all
          // of them is not an index, it is a log, and it buries the three
          // fetched vendor entries under five thousand unreviewed model cards.
          //
          // LEGIBILITY IS A PROJECTION CONCERN, NOT AN INGEST FILTER. Every edge
          // stays in the atlas and stays queryable; the card carries the shape
          // of the evidence plus the strongest entries by name. Dropping values
          // at ingest to make a card tidy would be deciding what is true by what
          // renders well.
          const byTier = new Map();
          for (const r of group) {
            const tier = r.Confidence ?? 'unverified';
            if (!byTier.has(tier)) byTier.set(tier, []);
            byTier.get(tier).push(r);
          }
          const named = [];
          // Registry SERVICES are always named in full, above the cap. There
          // are at most six of them per language, and a consumer asking "does
          // DeepL cover Swahili?" reads ABSENCE as the answer — which is only
          // honest if service entries can never fall off the end of a
          // truncated list. Model-card entries stay capped: absence there
          // means "not in the strongest 25", nothing more, and the store keeps
          // every edge queryable either way.
          const service = (group.filter((r) => r.Value === 'service')).sort(bySource);
          for (const r of service) {
            named.push({
              value: cast(r.Value, p.Datatype),
              variant: r.Variant_ID,
              source: r.Source,
              confidence: r.Confidence ?? 'unverified',
            });
          }
          const namedIds = new Set(named.map((n) => n.variant));
          for (const tier of TIER_STRENGTH) {
            for (const r of (byTier.get(tier) ?? []).sort(bySource)) {
              if (named.length >= TIERED_NAMED_LIMIT + service.length) break;
              if (namedIds.has(r.Variant_ID)) continue;
              named.push({
                value: cast(r.Value, p.Datatype),
                variant: r.Variant_ID,
                source: r.Source,
                confidence: tier,
              });
            }
          }
          setPath(card, field, {
            total: group.length,
            byTier: Object.fromEntries(
              [...byTier].sort(
                ([a], [b]) => TIER_STRENGTH.indexOf(a) - TIER_STRENGTH.indexOf(b),
              ).map(([t, rows]) => [t, rows.length]),
            ),
            named,
            truncated: group.length > named.length,
          });
          break;
        }
        case 'list': {
          // A LIST WITH A SEQUENCE IS AN ORDER, NOT A SET.
          //
          // Alphabetical order is the right default: several wordlists for one
          // language are several RESOURCES, not several opinions about one, and
          // sorting the raw text keeps the output stable whatever the values
          // turn out to be.
          //
          // But `ancestry` is a PATH. The ingester walks Glottolog's parent
          // edges and stamps each step with `Sequence`, and sorting that
          // alphabetically destroyed the descent chain while leaving it looking
          // like one: French read `cent2283 → clas1257 → gall1280 → …` where
          // Glottolog's actual root-first chain is `indo1319 → clas1257 →
          // ital1284 → …`. The CLI prints it with arrows, so the card was
          // asserting a lineage that never existed.
          //
          // Determinism holds either way — Sequence is written by the ingester,
          // not observed at build time — so the rule is simply: if the store
          // ordered these values, honour that order; otherwise sort.
          const ordered = group.every((r) => r.Sequence !== null && r.Sequence !== undefined)
            ? [...group].sort((a, b) => a.Sequence - b.Sequence).map((r) => r.Value)
            : [...new Set(group.map((r) => r.Value))].sort();
          // Dedupe AFTER ordering so a repeated value keeps its first position.
          const seen = [...new Set(ordered)].map((v) => cast(v, p.Datatype));
          setPath(card, field, seen);
          break;
        }
        case 'direct':
        case 'derived':
        default: {
          // More than one row on a `direct` field means two releases of the
          // same source disagree, or the spec is wrong about the field. Taking
          // the first would hide it; the sorted pick is deterministic and the
          // count is reported so it cannot pass unnoticed.
          const [first] = [...group].sort(bySource);
          setPath(card, field, cast(first.Value, p.Datatype));
          break;
        }
      }
      sources.set(field, [...new Set(group.map((r) => r.Source))].sort());
      stats.fieldInstances++;
    }

    // Coverage is computed, not asserted: how much of what could be known
    // about this language we actually have. It is what lets the atlas grey out
    // a thin card and say WHY it is thin rather than looking neglected.
    card.coverage = {
      sourceCount: new Set(asserted.map((r) => r.Source)).size,
      componentsPresent: byParameter.size,
      componentsTotal: parametersFor.get(subjectOf.get(code) ?? 'language') ?? parameters.size,
      notAttested: absent.length,
    };

    card._fieldSources = Object.fromEntries([...sources].sort());
    // VERSION ONLY, deliberately no build date. A card must be traceable to the
    // build that made it, and `builtAt` would do that — but it also makes two
    // builds from identical pins differ by the calendar, which destroys the
    // one property that lets anyone check the atlas: same pins in, same bytes
    // out. The version resolves to a date in ATLAS-RELEASE.json, so nothing is
    // lost but the determinism leak.
    card._atlas = { version: release.version ?? 'unreleased' };
    const content = { ...card };
    delete content._atlas;
    card._card = {
      // The card's own subject, not a constant. Method and corpus cards go
      // through this same projector now, and one stamped "language" would be
      // read as one by every consumer that branches on it.
      type: subjectOf.get(code) ?? 'language',
      id: code,
      revision: createHash('sha256').update(JSON.stringify(content)).digest('hex').slice(0, 16),
      correctableFields: [...sources.keys()].sort(),
    };

    cards.set(code, card);
    stats.cardsProjected++;
  }

  stats.noCardAtAll = languages.size - cards.size;
  return { cards, stats };
}
