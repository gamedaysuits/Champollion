/**
 * project-locales.mjs — locale cards, ENUMERATED from a registry.
 *
 * WHY THIS EXISTS
 *   The spine is one row per ISO 639-3 language, which is right for a language
 *   atlas and wrong for a translation tool: `fra-CA`, `por-PT`, `spa-MX` and
 *   `cmn-Hant` are targets people actually select, and the cutover dropped all
 *   four because a locale is not a language.
 *
 * NOT A CURATED LIST — THAT WAS THE WHOLE POINT
 *   A hand-written list of "locales we support" would be the same failure as
 *   the hand-typed method coverage this rebuild spent weeks retiring: it would
 *   be somebody's memory of which locales matter, stale the day after it was
 *   written. So the inventory comes from SIL langtags — already fetched,
 *   already pinned, already verified — which enumerates 379 language-region
 *   tags. A locale card exists because a REGISTRY publishes that tag, and
 *   `fra-CA` comes back because SIL says so, not because anyone listed it.
 *
 * A LOCALE CARD IS A PROJECTION, NOT A NEW SUBJECT
 *   Its facts are its language's facts, with the territory- and
 *   script-scoped values resolved for THIS territory and script — the two axes
 *   the value layer already carries (415 territory values, 6,943 script). So a
 *   locale asserts nothing new: `fra-CA` is French as French is cited, plus
 *   CLDR's claims that happen to be scoped to CA. Nothing is invented for a
 *   locale that is not true of its language.
 *
 * WHAT IT REFUSES
 *   A tag whose language is not on the spine produces no card — a locale of a
 *   language we do not hold would be a card about nothing. And the parent's
 *   attribution envelopes are carried through untouched: a locale inherits the
 *   disagreement, it does not resolve it.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(__dirname, '..', '..', 'data');

/** `fr-CA`, `zh-Hant-TW` — a language, an optional script, a region. */
const LOCALE_TAG = /^([a-z]{2,3})(?:-([A-Z][a-z]{3}))?-([A-Z]{2})$/;

/**
 * Every locale tag SIL langtags publishes, with the pieces parsed out.
 * @returns {Array<{tag: string, lang: string, script: string|null, region: string}>}
 */
export function publishedLocales() {
  const file = path.join(DATA, 'sil-langtags', 'langtags.json');
  const raw = JSON.parse(fs.readFileSync(file, 'utf-8'));
  const out = new Map();
  for (const e of raw) {
    for (const tag of [e?.tag, ...(e?.tags ?? [])]) {
      const m = typeof tag === 'string' && LOCALE_TAG.exec(tag);
      if (!m) continue;
      // `full` is langtags' own maximal form, so the script comes from the
      // registry even when the short tag omits it (fr-CA → fr-Latn-CA).
      const full = typeof e.full === 'string' ? e.full : '';
      // TWO DIFFERENT SCRIPTS, deliberately.
      //
      // `tagScript` is the script SIL actually WROTE in this tag; `script` is
      // the one its maximal form implies. Only the written one may shape the
      // card's id: SIL publishes `fr-CA` and maximises it to `fr-Latn-CA`, so
      // folding the implied script into the id produced `fra-Latn-CA` and the
      // CLI's `fra-CA` target resolved to nothing.
      //
      // The implied script is still true and still useful, so it rides along
      // as data for script-scoped value resolution.
      const tagScript = m[2] ?? null;
      const script = tagScript ?? (/^[a-z]{2,3}-([A-Z][a-z]{3})-/.exec(full)?.[1] ?? null);
      if (!out.has(tag)) out.set(tag, { tag, lang: m[1], tagScript, script, region: m[3] });
    }
  }
  return [...out.values()].sort((a, b) => a.tag.localeCompare(b.tag));
}

/**
 * Build locale cards from already-projected language cards.
 *
 * @param {Map<string, object>} cards  projected language cards, keyed by code
 * @param {(code: string) => string|null} resolveLang  tag subtag → spine code
 * @param {import('better-sqlite3').Database} db
 */
export function projectLocales(cards, resolveLang, db) {
  const scoped = db.prepare(`
    SELECT Subject_ID, Parameter_ID, Variant_Type, Variant_ID, Value
    FROM cldf_values
    WHERE Variant_Type IN ('territory', 'script') AND Status = 'asserted'
  `).all();
  const byLang = new Map();
  for (const r of scoped) {
    if (!byLang.has(r.Subject_ID)) byLang.set(r.Subject_ID, []);
    byLang.get(r.Subject_ID).push(r);
  }

  const out = new Map();
  const stats = { published: 0, emitted: 0, offSpine: 0, offSpineTags: [] };

  for (const loc of publishedLocales()) {
    stats.published++;
    const code = resolveLang(loc.lang);
    const parent = code && cards.get(code);
    if (!parent) {
      // A locale of a language the spine does not carry is a card about
      // nothing. Named, not silently skipped.
      stats.offSpine++;
      if (stats.offSpineTags.length < 8) stats.offSpineTags.push(loc.tag);
      continue;
    }

    // KEYED BY THE SPINE CODE, not by SIL's tag.
    //
    // SIL publishes the SHORTEST code a language has, so French locales come
    // back as `fr-CA` while the atlas spine — and every card in it — is keyed
    // by ISO 639-3 `fra`. Emitting `fr-CA` produced 8,510 locale cards none of
    // which the CLI could find, because it asks for `fra-CA`.
    //
    // So the registry still decides WHICH locales exist (nothing is curated
    // here); the spine decides what they are CALLED, so that one lookup
    // convention holds across the whole corpus. The tag SIL actually published
    // is kept on the card, because that is the citation.
    const localeId = [code, loc.tagScript, loc.region].filter(Boolean).join('-');
    const card = { ...parent, code: localeId };

    // A LOCALE INHERITS ITS LANGUAGE'S FACTS, NEVER ITS IDENTITY.
    //
    // Copying the parent wholesale also copied the codes that IDENTIFY the
    // language: `eng-GH` arrived claiming `codeAliases: ["en"]` and
    // `iso639_1: "en"`. Every locale of English then claimed to be what "en"
    // means, and the last one loaded won — so resolving "en" returned
    // `eng-GH`, silently retargeting translations from English to English as
    // spoken in Ghana.
    //
    // `en` means the language. Its locales are reached by their own tags, so
    // these identity fields are dropped rather than duplicated. Everything
    // that is a FACT about the language stays, because it is equally true of
    // the locale.
    delete card.codeAliases;
    delete card.aliases;
    delete card.iso639_1;
    delete card.iso639_3;
    // The macrolanguage relation is ISO's, and ISO relates LANGUAGES: `als` is
    // a member of `sqi`, `als-AL` is not a member of anything. Kept on the
    // parent, dropped here.
    delete card.macrolanguageMembers;
    delete card.supersededCodes;
    card.locale = {
      language: code,
      region: loc.region,
      script: loc.script,
      publishedTag: loc.tag,
      source: 'sil-langtags',
      note: 'This locale exists because SIL langtags publishes the tag. Its facts are '
        + 'its language\'s facts; only territory- and script-scoped values are resolved '
        + 'for this locale, and nothing is asserted here that is not true of the language.',
    };
    if (loc.script) card.script = loc.script;

    // Territory/script-scoped values resolved for THIS locale. This is the
    // only place a locale card differs from its language in substance.
    const resolvedScoped = {};
    for (const r of byLang.get(code) ?? []) {
      const matches = (r.Variant_Type === 'territory' && r.Variant_ID === loc.region)
        || (r.Variant_Type === 'script' && loc.script && r.Variant_ID === loc.script);
      if (matches) resolvedScoped[r.Parameter_ID] = r.Value;
    }
    if (Object.keys(resolvedScoped).length) card.localeScoped = resolvedScoped;

    card._card = { ...(parent._card ?? {}), type: 'locale', id: localeId };
    out.set(localeId, card);
    stats.emitted++;

    // SCRIPT-ONLY VARIANTS.
    //
    // `cmn-Hant` is a real translation target and SIL never publishes it as a
    // bare tag — it only ever appears with a region attached (cmn-Hant-TW,
    // cmn-Hant-HK). A reader asking for "Mandarin in Traditional script"
    // without naming a territory is asking a coherent question, so the
    // script-scoped card is emitted alongside the territory-scoped ones.
    //
    // Still enumerated, not curated: the pair exists because SIL published a
    // tag carrying that script. Written only once per (language, script), and
    // never over a territory card, so a region tag always wins.
    if (loc.tagScript) {
      const scriptId = `${code}-${loc.tagScript}`;
      if (!out.has(scriptId)) {
        const sCard = { ...parent, code: scriptId, script: loc.tagScript };
        sCard.locale = {
          language: code,
          // No region key at all, rather than `region: null`. A script-only
          // locale is not "a locale whose region is nothing" — it is a locale
          // that makes no territorial claim, and the corpus rule is that an
          // unasserted field is OMITTED so nothing can render it as an empty
          // row. The cutover's null/empty gate caught this on 165 cards.
          script: loc.tagScript,
          publishedTag: loc.tag,
          source: 'sil-langtags',
          note: 'Script-scoped projection. SIL publishes this script only in '
            + 'territory-qualified tags; this card answers for the script alone, '
            + 'carrying its language\'s facts with the script-scoped values resolved.',
        };
        const sScoped = {};
        for (const r of byLang.get(code) ?? []) {
          if (r.Variant_Type === 'script' && r.Variant_ID === loc.tagScript) {
            sScoped[r.Parameter_ID] = r.Value;
          }
        }
        if (Object.keys(sScoped).length) sCard.localeScoped = sScoped;
        sCard._card = { ...(parent._card ?? {}), type: 'locale', id: scriptId };
        out.set(scriptId, sCard);
        stats.emitted++;
        stats.scriptOnly = (stats.scriptOnly ?? 0) + 1;
      }
    }
  }

  return { locales: out, stats };
}
