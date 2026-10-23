/**
 * values.mjs — the ONE way anything writes a fact into the atlas.
 *
 * WHY THIS EXISTS
 *   Fourteen handlers held seventeen near-identical `INSERT INTO cldf_values`
 *   statements, each spelling out fifteen columns. That is not merely repetitive
 *   — it is how the columns drift apart. Adding `Subject_Type` meant editing
 *   seventeen places correctly, and the seventeenth is the one that gets it
 *   wrong quietly.
 *
 *   One writer means a schema change is made once, the identity of a value is
 *   computed the same way everywhere, and the invariants below are enforced for
 *   every source rather than for the ones whose author remembered.
 *
 * A VALUE IS ABOUT A SUBJECT, NOT ONLY A LANGUAGE
 *   The store used to key every fact to `Language_ID`, so nothing but a language
 *   could carry one — which is why corpus and method cards had to be built by a
 *   second pipeline against a different database. A value now names its subject
 *   type, and languages, corpora and methods travel the same road.
 *
 * VARIANT CARRIED FIVE DIFFERENT THINGS
 *   Counted across the handlers, one `Variant TEXT` column held a method key, a
 *   dataset name, a script code, the language a label is written in, and an
 *   ordinal (`String(i).padStart(2,'0')`) used only to keep `ancestry` in order.
 *   Its meaning depended on which parameter the row belonged to — the functional
 *   dependency that stops the table being properly normalised.
 *
 *   It splits by job. `Variant_Type`/`Variant_ID` DISCRIMINATE (which method,
 *   which script, which label language) so that two rows are two facts rather
 *   than a disagreement. `Sequence` ORDERS, and is null wherever order means
 *   nothing. Conflating "which one" with "where in the list" is what made the
 *   old column unjoinable.
 *
 * ABSENCE IS A VALUE
 *   `not_attested` ("we looked, there is none") and `not_surveyed` ("nobody
 *   looked") are different, and neither is a blank. The schema enforces that a
 *   value exists exactly when the status is `asserted`; this module refuses the
 *   mistake earlier, with a message naming the parameter.
 */

import { createHash } from 'node:crypto';

/** The only legal subjects. A fourth would need a node table to resolve against. */
export const SUBJECT = Object.freeze({
  LANGUAGE: 'language',
  CORPUS: 'corpus',
  METHOD: 'method',
});

const SUBJECTS = new Set(Object.values(SUBJECT));

export const STATUS = Object.freeze({
  ASSERTED: 'asserted',
  NOT_ATTESTED: 'not_attested',
  NOT_SURVEYED: 'not_surveyed',
});

const STATUSES = new Set(Object.values(STATUS));

/**
 * The identity of a value: the columns that make it the same claim.
 *
 * Deterministic and content-derived, so a rebuild from identical pins produces
 * identical ids — which is what makes "same pins in, byte-identical cards out"
 * checkable rather than aspirational.
 */
export function valueId({ source, subjectType, subjectId, parameter, variantType, variantId, value }) {
  // Sequence is deliberately absent: it orders a value, it does not identify
  // one. Including it would make a reordered list look like a set of new facts.
  return createHash('sha256')
    .update([source, subjectType, subjectId, parameter, variantType ?? '', variantId ?? '', value ?? '']
      .join('|'))
    .digest('hex').slice(0, 24);
}

/**
 * Discriminator vocabularies, exported so handlers name them rather than spell
 * them.
 *
 * Six were counted from what the old single `Variant` column actually held:
 * which method covers a language, which corpus attests it, which metric model
 * scores it, which script it is written in, which language a label is written
 * in, and which territory a status applies in. Each says "these two rows are
 * two facts, not a disagreement" — about a different axis.
 *
 * RESOURCE is the seventh, and it is not one of those. A language can have five
 * analysers, three keyboard layouts and a dozen dictionaries, each a separate
 * published artifact; without an axis of its own they collapse onto one key and
 * the projector reads twelve dictionaries as twelve sources disagreeing about
 * one. Reaching for CORPUS because it was nearest would have been the same
 * overloading the split of `Variant` exists to undo.
 */
export const VARIANT = Object.freeze({
  METHOD: 'method',
  CORPUS: 'corpus',
  METRIC: 'metric',
  SCRIPT: 'script',
  LANGUAGE: 'language',
  TERRITORY: 'territory',
  RESOURCE: 'resource',
  // FEATURE is the eighth axis: WHICH typological feature a catalog row
  // describes (WALS 83A, Grambank GB028, an APiCS parameter). One
  // `typologyFeature` parameter carries every feature of every catalog the
  // same way one `lexicalResource` carries 145 wordlists — the alternative
  // was ~900 near-identical parameters, which is the bazillion-fields failure
  // by another road. Two catalogs coding the same feature differently are two
  // attributed facts, not a disagreement.
  FEATURE: 'feature',
});

const VARIANTS = new Set(Object.values(VARIANT));

/**
 * Build a writer bound to one source.
 *
 * @param {import('better-sqlite3').Database} db
 * @param {object} opts
 * @param {string} opts.sourceId       the pinned release these values came from
 * @param {string} opts.createdBy      the handler, for the audit trail
 * @param {string} [opts.subjectType]  default subject; overridable per call
 */
export function valueWriter(db, { sourceId, createdBy, subjectType = SUBJECT.LANGUAGE }) {
  if (!sourceId) throw new Error('valueWriter needs a sourceId — a value with no release is not a fact');
  if (!createdBy) throw new Error('valueWriter needs createdBy so a value can be traced to its handler');
  if (!SUBJECTS.has(subjectType)) throw new Error(`unknown subject type "${subjectType}"`);

  const insert = db.prepare(`
    INSERT INTO cldf_values
      (ID, Subject_Type, Subject_ID, Parameter_ID, Value, Code_ID, Comment, Source,
       Variant_Type, Variant_ID, Sequence, Value_Year, Status, Confidence, Derived_From,
       Sovereignty_Status, Transmission_Consent, Created_By)
    VALUES (@ID,@Subject_Type,@Subject_ID,@Parameter_ID,@Value,@Code_ID,@Comment,@Source,
            @Variant_Type,@Variant_ID,@Sequence,@Value_Year,@Status,@Confidence,@Derived_From,
            @Sovereignty_Status,@Transmission_Consent,@Created_By)
    ON CONFLICT DO NOTHING
  `);

  /**
   * Write one value.
   *
   * @param {string} subjectId
   * @param {string} parameter
   * @param {string|number|null} value  null only with a non-asserted status
   * @param {object} [o]
   * @returns {boolean} whether a row was written
   */
  function write(subjectId, parameter, value, o = {}) {
    const status = o.status ?? STATUS.ASSERTED;
    if (!STATUSES.has(status)) throw new Error(`unknown status "${status}" for ${parameter}`);

    const empty = value === null || value === undefined || value === '';
    if (status === STATUS.ASSERTED && empty) return false;
    if (status !== STATUS.ASSERTED && !empty) {
      // Would violate the schema CHECK, but the schema cannot say WHICH
      // parameter, and a constraint failure ten frames deep is a bad way to
      // learn that a handler mislabelled an absence.
      throw new Error(
        `${parameter}: status "${status}" means there is no value, but one was given `
        + `(${JSON.stringify(value).slice(0, 60)}). An absence that carries a value is `
        + 'neither an absence nor a fact.',
      );
    }

    const st = o.subjectType ?? subjectType;
    if (!SUBJECTS.has(st)) throw new Error(`unknown subject type "${st}" for ${parameter}`);
    if (!subjectId) throw new Error(`${parameter}: no subject id`);

    const v = empty ? null : String(value);
    const variantType = o.variantType ?? null;
    const variantId = o.variantId ?? null;
    if ((variantType === null) !== (variantId === null)) {
      // Half a variant cannot be resolved against anything, which is the state
      // the old single `Variant` column left every consumer in.
      throw new Error(
        `${parameter}: variantType and variantId must be given together `
        + `(got ${JSON.stringify(variantType)} / ${JSON.stringify(variantId)})`,
      );
    }
    if (variantType !== null && !VARIANTS.has(variantType)) {
      throw new Error(
        `${parameter}: unknown variant type "${variantType}". A discriminator must name a `
        + `kind something can be resolved against (${[...VARIANTS].join(', ')}). If the `
        + 'intent was list ORDER, use sequence — that was the old column\'s fifth meaning '
        + 'and the reason it could not be joined.',
      );
    }

    insert.run({
      ID: valueId({
        source: sourceId, subjectType: st, subjectId, parameter, variantType, variantId, value: v,
      }),
      Subject_Type: st,
      Subject_ID: subjectId,
      Parameter_ID: parameter,
      Value: v,
      Code_ID: o.codeId ?? null,
      Comment: o.comment ?? null,
      Source: sourceId,
      Variant_Type: variantType,
      Variant_ID: variantId,
      Sequence: o.sequence ?? null,
      Value_Year: o.valueYear ?? null,
      Status: status,
      Confidence: o.confidence ?? 'verified',
      Derived_From: o.derivedFrom ?? null,
      Sovereignty_Status: o.sovereigntyStatus ?? null,
      Transmission_Consent: o.transmissionConsent ?? null,
      Created_By: createdBy,
    });
    return true;
  }

  /** Record that a source looked and found nothing, or was never asked. */
  write.absent = (subjectId, parameter, status, o = {}) =>
    write(subjectId, parameter, null, { ...o, status });

  return write;
}

/**
 * Every value's subject must exist in the table its type names.
 *
 * SQLite cannot express a foreign key whose target depends on another column,
 * so the constraint the schema cannot hold is asserted here instead — once, at
 * the end of ingest, naming what dangles. Without it a typo'd subject id would
 * simply produce a fact about nothing, which is precisely the class of silent
 * emptiness this pipeline keeps finding in its predecessor.
 *
 * @param {import('better-sqlite3').Database} db
 * @returns {{ok: boolean, dangling: Array<{Subject_Type: string, Subject_ID: string, n: number}>}}
 */
export function assertSubjectIntegrity(db) {
  const dangling = db.prepare(`
    SELECT v.Subject_Type, v.Subject_ID, COUNT(*) AS n
      FROM cldf_values v
      LEFT JOIN cldf_languages l
        ON v.Subject_Type = 'language' AND v.Subject_ID = l.ID
      LEFT JOIN cldf_contributions c
        ON v.Subject_Type IN ('corpus','method') AND v.Subject_ID = c.ID
     WHERE (v.Subject_Type = 'language' AND l.ID IS NULL)
        OR (v.Subject_Type IN ('corpus','method') AND c.ID IS NULL)
     GROUP BY v.Subject_Type, v.Subject_ID
     ORDER BY n DESC
  `).all();
  return { ok: dangling.length === 0, dangling };
}
