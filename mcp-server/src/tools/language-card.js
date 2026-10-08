/**
 * get_language — the full, cited language card for one language.
 *
 * search_languages answers "which language is this?"; this answers "what does
 * the index KNOW about it, and who says so?". It resolves the card exactly the
 * way the `champollion` CLI resolves it — through the installed package's own
 * registry (getLanguageCard / prefetchLanguageCards), never a private reader:
 *
 *   monorepo checkout  → the full card corpus on disk (repo mode)
 *   npm install        → the bundled core card, else the per-user cache
 *                        (~/.champollion/cards), else a fetch from the
 *                        published card tables (read-only anon key), cached
 *
 * The fetch is the CLI's own async prefetch, so a long-tail lookup never
 * blocks the server on the CLI's synchronous child-process fetch.
 *
 * Honesty contract (the language-card boundary invariant):
 *   - every value is shown WITH its source; where sources disagree, every
 *     claim is listed and none is elected;
 *   - an absent field is reported as absent, with what absence means for the
 *     tier the card came from (the published projection carries fewer fields
 *     than the on-disk atlas card — so "not in this projection" ≠ "nobody
 *     knows");
 *   - nothing here is a measured score — run results live on the leaderboard
 *     (get_results), never on a card.
 */

import { loadChampollion } from './translate.js';
import {
  findLanguages, glottologRecordUrl, publishedCarriesFieldSources, uncitedReason,
} from './languages.js';

/** Codes the CLI accepts: letters/digits with - or _ separators (cards/env.js). */
const CODE_SHAPE = /^[A-Za-z]{2,3}(?:[-_][A-Za-z0-9]+){0,4}$|^[a-z]{4}\d{4}$/;

/** Service engines a card can say yes/no about (the CLI's flattened view). */
const SERVICE_LABELS = {
  googleTranslate: 'Google Translate',
  deepl: 'DeepL',
  microsoftTranslator: 'Microsoft Translator',
  libreTranslate: 'LibreTranslate',
  apertium: 'Apertium',
};

const LIST_CAP = 8;

// ---------------------------------------------------------------------------
// Shape helpers — every card tier, one vocabulary
// ---------------------------------------------------------------------------

function isEnvelope(v) {
  return Boolean(v) && typeof v === 'object' && !Array.isArray(v)
    && Array.isArray(v.values) && typeof v.agreement === 'string';
}

/** Every claim of a field as [{value, source, note?}] — envelope or flat. */
function claims(value, fallbackSources = []) {
  if (value === null || value === undefined || value === '') return [];
  if (isEnvelope(value)) {
    return value.values.map((c) => ({
      value: c?.value, source: c?.source ?? null, ...(c?.note ? { note: c.note } : {}),
    }));
  }
  if (Array.isArray(value)) {
    return value.map((v) => ({ value: v, source: fallbackSources.join(', ') || null }));
  }
  if (typeof value === 'object') return [];
  return [{ value, source: fallbackSources.join(', ') || null }];
}

function fieldSources(card, path) {
  const fs = card?._fieldSources;
  if (!fs || typeof fs !== 'object') return [];
  const v = fs[path];
  if (typeof v === 'string') return [v];
  return Array.isArray(v) ? v.filter((s) => typeof s === 'string') : [];
}

function scalar(card, key) {
  const v = card?.[key];
  if (v === null || v === undefined || v === '') return null;
  if (isEnvelope(v)) return { claims: claims(v), agreement: v.agreement };
  return { claims: [{ value: v, source: fieldSources(card, key).join(', ') || null }] };
}

function listOf(v) {
  return Array.isArray(v) ? v.filter((x) => x && typeof x === 'object') : [];
}

// ---------------------------------------------------------------------------
// Summary — the structured, cited view of one card
// ---------------------------------------------------------------------------

/**
 * Build the structured summary of a (normalized) card. Pure.
 *
 * @param {object} card        normalized card (getLanguageCard view, cloned)
 * @param {object} [opts]
 * @param {object|null} [opts.rawCard]  the on-disk atlas card, when readable
 *   (repo mode) — used for name/endonym attributions the view flattened
 * @param {string} [opts.tier]  repo | bundled | cache | remote
 */
export function summarizeCard(card, { rawCard = null, tier = 'repo' } = {}) {
  const cls = card.classification && typeof card.classification === 'object'
    ? card.classification : {};
  // Family: atlas envelope, or the published projection's flat value plus its
  // familyAttributions list.
  let family = claims(cls.family, fieldSources(card, 'classification.family'));
  if (!isEnvelope(cls.family) && Array.isArray(cls.familyAttributions) && cls.familyAttributions.length) {
    family = cls.familyAttributions.map((c) => ({ value: c.value, source: c.source ?? null }));
  }
  const ancestry = Array.isArray(cls.ancestry) ? cls.ancestry : [];

  const nameClaims = rawCard && isEnvelope(rawCard.name) ? claims(rawCard.name) : [];
  const endonymClaims = rawCard && isEnvelope(rawCard.endonym)
    ? claims(rawCard.endonym)
    : claims(card.endonym ?? card.nativeName ?? null, fieldSources(card, 'endonym'));

  const speakers = listOf(card.speakerEstimates).map((e) => ({
    value: e.count, source: e.source ?? null,
    ...(e.date ? { date: e.date } : {}), ...(e.note ? { note: e.note } : {}),
  }));

  const endangerment = claims(card.endangerment);
  const vitality = card.vitality && typeof card.vitality === 'object' && card.vitality.unescoStatus
    ? { tier: card.vitality.unescoStatus, assessedBy: card.vitality.assessedBy ?? null }
    : null;

  // Scripts: atlas strings, or the published index row's {name, source}.
  const scriptNames = Array.isArray(card.scriptNames) ? card.scriptNames : [];
  const scripts = (Array.isArray(card.scripts) ? card.scripts : []).map((s) => (
    typeof s === 'string'
      ? { code: s, source: fieldSources(card, 'scripts').join(', ') || null }
      : { code: s?.name ?? s?.code ?? null, source: s?.source ?? null }
  )).filter((s) => s.code);

  const res = card.resources && typeof card.resources === 'object' ? card.resources : {};
  const lex = card.lexicalResources && typeof card.lexicalResources === 'object' ? card.lexicalResources : {};
  const tool = (r) => ({
    name: r.name ?? null, url: r.url ?? null, publisher: r.publisher ?? null,
    license: r.license ?? null, licenceEstablished: r.licenceEstablished ?? null,
    ...(r.archived ? { archived: true } : {}),
  });
  const resources = {
    dictionaries: listOf(lex.dictionaries).map((d) => ({ ...tool(d),
      ...(d.pairedWith ? { pairedWith: d.pairedWith } : {}) })),
    fsts: listOf(res.fsts).map(tool),
    keyboards: listOf(res.keyboards).map(tool),
    parallelCorpora: listOf(res.corpora).map((c) => ({
      corpus: c.corpus ?? c.corpusId ?? null,
      alignmentPairs: c.alignmentPairsTotal ?? null,
      topPartners: listOf(c.topPartners).slice(0, 3).map((p) => `${p.code}:${p.alignmentPairs}`),
    })),
    lexicalDatasets: listOf(lex.datasets).map((d) => ({
      dataset: d.dataset ?? null, forms: d.forms ?? null, release: d.release ?? null,
    })),
    typologyDatasets: listOf(res.typology).map((t) => t.dataset).filter(Boolean),
    documentation: card.documentation?.medLevel
      ? { level: card.documentation.medLevel, source: fieldSources(card, 'documentation.medLevel').join(', ') || 'glottolog MED' }
      : null,
  };

  // Method support: the CLI flattens service listings to a yes/no map and
  // keeps the evidence (model-card claims) as methodSupportEvidence.
  const ms = card.methodSupport && typeof card.methodSupport === 'object' ? card.methodSupport : null;
  const services = {};
  if (ms) {
    for (const [key, label] of Object.entries(SERVICE_LABELS)) {
      if (ms[key] && typeof ms[key] === 'object' && 'supported' in ms[key]) {
        services[label] = ms[key].supported === true;
      }
    }
  }
  const evidence = card.methodSupportEvidence && typeof card.methodSupportEvidence === 'object'
    ? card.methodSupportEvidence : null;
  const declaredModels = listOf(evidence?.named)
    .filter((n) => n.value !== 'service')
    .map((n) => ({ id: n.variant ?? null, tier: n.confidence ?? n.value ?? null, source: n.source ?? null }));
  const methods = {
    services,
    serviceListingKnown: Object.keys(services).length > 0,
    declaredModels,
    declaredTotal: evidence?.total ?? declaredModels.length,
    llm: ms?.llm?.supported === true,
  };

  const mms = card.metricModelSupport && typeof card.metricModelSupport === 'object'
    ? Object.entries(card.metricModelSupport)
      .filter(([, v]) => v && typeof v === 'object')
      .map(([k, v]) => ({ metric: k, supported: v.supported !== false, pivot: v.pivot === true, model: v.model ?? null, tier: v.tier ?? null }))
    : [];

  const evalWiring = {
    datasets: Array.isArray(card.evalDatasets) ? card.evalDatasets : [],
    standard: card.evalStandard && typeof card.evalStandard === 'object'
      ? { package: card.evalStandard.package ?? null, pip: card.evalStandard.pip ?? null } : null,
  };

  const summary = {
    code: card.code,
    locale: card.locale && typeof card.locale === 'object' && card.locale.language
      ? { language: card.locale.language, region: card.locale.region ?? null, script: card.locale.script ?? null }
      : null,
    name: typeof card.name === 'string' ? card.name : String(card.name ?? card.code),
    nameClaims: nameClaims.length > 1 && new Set(nameClaims.map((c) => c.value)).size > 1 ? nameClaims : [],
    endonym: endonymClaims,
    identity: {
      iso639_3: card.iso639_3 ?? null,
      iso639_1: card.iso639_1 ?? null,
      glottocode: card.glottocode ?? null,
      bcp47: typeof card.bcp47 === 'string' ? card.bcp47 : null,
      isoType: card.isoLanguageType ?? card.isoType ?? null,
      isoScope: card.isoScope ?? null,
      macrolanguage: card.macrolanguage ?? null,
      modality: card.modality ?? null,
    },
    family,
    isolate: card.isIsolate === true,
    ancestry,
    genus: cls.genus ?? null,
    macroarea: card.macroarea ?? null,
    countries: Array.isArray(card.countries) ? card.countries : [],
    // the sources the card stamps on each location fact — none in the
    // published projection (Round 10: an uncited location is not displayed)
    whereSources: {
      macroarea: fieldSources(card, 'macroarea'),
      countries: fieldSources(card, 'countries'),
    },
    speakers,
    endangerment,
    vitality,
    scripts,
    scriptNames,
    direction: card.dir ?? null,
    orthographicStatus: card.orthographicStatus ?? null,
    dialectCount: card.dialectCount ?? null,
    resources,
    methods,
    metricModels: mms,
    evalWiring,
    provenance: {
      tier,
      atlasVersion: card._atlas?.version ?? null,
      publishedAt: card._remote?.updatedAt ?? null,
      // Whether a published row carries the atlas card's per-field citations
      // (rows uploaded before 2026-10-04 do not; null off the published tier).
      fieldSourcesCarried: tier === 'cache' || tier === 'remote' ? publishedCarriesFieldSources(card) : null,
      // The published projection carries no per-field stamps, so a count
      // assembled from its _fieldSources would understate the card.
      sourceCount: (tier === 'repo' || tier === 'bundled') && Array.isArray(card.dataSources)
        ? card.dataSources.length : null,
      coverage: card.coverage && typeof card.coverage === 'object'
        ? { sources: card.coverage.sourceCount ?? null, present: card.coverage.componentsPresent ?? null, total: card.coverage.componentsTotal ?? null }
        : null,
    },
  };
  summary.absent = absentFields(summary);
  return summary;
}

/** Which headline fields no source on this card asserts. */
function absentFields(s) {
  const out = [];
  if (!s.endonym.length) out.push('endonym');
  if (!s.family.length && !s.isolate) out.push('family');
  if (!s.speakers.length) out.push('speaker estimates');
  if (!s.endangerment.length && !s.vitality) out.push('endangerment');
  if (!s.scripts.length) out.push('scripts');
  if (!s.resources.dictionaries.length) out.push('dictionaries');
  if (!s.resources.fsts.length) out.push('FSTs / morphological analyzers');
  if (!s.resources.keyboards.length) out.push('keyboards');
  if (!s.resources.parallelCorpora.length) out.push('parallel corpora (OPUS)');
  if (!s.resources.documentation) out.push('grammar/documentation level');
  if (!s.methods.serviceListingKnown && !s.methods.declaredModels.length) out.push('MT service / model listings');
  return out;
}

// ---------------------------------------------------------------------------
// Resolution — through the installed champollion package
// ---------------------------------------------------------------------------

const TIER_NOTE = {
  repo: 'the full atlas card corpus in this monorepo checkout',
  bundled: "the core card bundled inside the installed champollion package",
  cache: 'the per-user card cache (~/.champollion/cards), fetched earlier from champollion.dev\'s published card tables',
  remote: 'fetched just now from champollion.dev\'s published card tables (read-only) and cached in ~/.champollion/cards',
};

const ABSENCE_NOTE = {
  repo: 'Absent = no source the atlas ingests asserts it (unknown — never zero).',
  bundled: 'Absent = no source the atlas ingests asserts it (unknown — never zero).',
  cache: 'Absent = not in the PUBLISHED card projection, which carries fewer fields than the full atlas card (e.g. lexical datasets) — unknown, not "none".',
  remote: 'Absent = not in the PUBLISHED card projection, which carries fewer fields than the full atlas card (e.g. lexical datasets) — unknown, not "none".',
};

/**
 * Resolve one language (code, code alias, or exact name) to its cited card.
 *
 * @param {string} query
 * @param {object} [deps]
 * @param {object|null} [deps.champollion]  injected package (tests)
 * @param {object[]}    [deps.index]        the language index (name lookups +
 *                                          suggestions); optional
 * @returns {Promise<object>}  { status: 'ok', summary, ... } |
 *   { status: 'not-found'|'ambiguous'|'unavailable'|'fetch-failed', note, suggestions? }
 */
export async function getLanguage(query, deps = {}) {
  const input = String(query ?? '').trim();
  if (!input) return { status: 'bad-request', note: 'Pass a language code (e.g. "crk") or name.' };

  const c = deps.champollion !== undefined ? deps.champollion : await loadChampollion();
  if (!c || typeof c.getLanguageCard !== 'function') {
    return {
      status: 'unavailable',
      note: 'The champollion package (which resolves language cards) is not '
        + 'reachable from this MCP server install. Reinstall the server '
        + '(`npx -y champollion-mcp-server`) or `npm install champollion` '
        + 'next to it — cards are read only through the CLI\'s own resolver.',
    };
  }
  const index = Array.isArray(deps.index) ? deps.index : null;
  const suggest = (q) => (index ? findLanguages(index, q, 6) : { match: 'none', results: [], fuzzy: [] });

  const mode = typeof c.getCardSourceInfo === 'function' ? c.getCardSourceInfo().mode : 'unknown';

  // Code first (the CLI's own alias resolution: fr → fra, cr → cre); a name
  // falls through to the index.
  let code = null;
  let resolvedFrom = null;
  // A capitalised word that is exactly a language's NAME ("Ata", "Ese") is
  // a name, even when it is also code-shaped; lowercase input is a code.
  const nameFirst = /[A-Z]/.test(input) && index
    && findLanguages(index, input, 5).results.some((l) => l.name && l.name.toLowerCase() === input.toLowerCase());
  if (!nameFirst && CODE_SHAPE.test(input)) {
    // ISO codes are lowercase; 'CRK' and 'crk' are the same request.
    const asCode = /^[A-Za-z]{2,3}$/.test(input) ? input.toLowerCase() : input;
    const r = typeof c.resolveCode === 'function' ? c.resolveCode(asCode) : asCode;
    code = r || asCode;
    if (code !== input) resolvedFrom = `code "${input}" → ${code}`;
  }
  if (!code || !isKnownCode(c, code, index, mode)) {
    const found = suggest(input);
    const exact = found.match === 'exact'
      ? found.results.filter((l) => [l.name, l.endonym].some((n) => n && n.toLowerCase() === input.toLowerCase()))
      : [];
    if (exact.length === 1) {
      code = exact[0].code;
      resolvedFrom = `name "${input}" → ${code}`;
    } else if (exact.length > 1) {
      return {
        status: 'ambiguous',
        input,
        note: `"${input}" names ${exact.length} languages — pass a code.`,
        suggestions: exact.map((l) => ({ code: l.code, name: l.name })),
      };
    } else if (!code) {
      return notFound(input, found);
    }
  }

  // Materialize: the CLI's async prefetch (packaged mode) — never the
  // synchronous child-process fetch, which would block the server.
  let tier = null;
  let prefetch = null;
  if (mode === 'packaged' && typeof c.prefetchLanguageCards === 'function') {
    try {
      prefetch = await c.prefetchLanguageCards([code]);
    } catch (err) {
      prefetch = { fetched: [], missing: [], failed: [code], skipped: [], error: err.message };
    }
  }
  const card = c.getLanguageCard(code);
  if (!card) {
    if (prefetch?.failed?.includes(code)) {
      return {
        status: 'fetch-failed',
        input,
        code,
        note: `"${code}" is in the catalogue but its card is not bundled with this `
          + 'install, and fetching it from champollion.dev\'s published card tables '
          + 'failed (offline, or the service is unreachable). Retry in a few minutes; '
          + 'set CHAMPOLLION_OFFLINE=1 only if you mean to stay offline. The CLI '
          + 'backs off for a while after a network failure.',
      };
    }
    const named = index?.find((l) => l.code === code);
    if (named && prefetch?.missing?.includes(code)) {
      return {
        status: 'not-found',
        input,
        code,
        note: `"${code}" (${named.name}) is in the catalogue by name, but champollion.dev `
          + 'publishes no card for it yet — so there are no cited facts to show. '
          + 'language_overview still lists benchmarks, results and next steps for it.',
        suggestions: [],
        nameOnly: { code, name: named.name },
      };
    }
    return notFound(input, suggest(input), code);
  }
  if (mode === 'repo') tier = 'repo';
  else if (prefetch?.fetched?.includes(code)) tier = 'remote';
  else if (card._remote) tier = 'cache';
  else tier = 'bundled';

  // Clone before normalizing: normalizeCard mutates, and the registry caches
  // the composed view this came from.
  const view = typeof structuredClone === 'function' ? structuredClone(card) : JSON.parse(JSON.stringify(card));
  const normalized = typeof c.normalizeCard === 'function' ? c.normalizeCard(view) : view;
  let rawCard = null;
  if (mode === 'repo' && typeof c.readCard === 'function') {
    try { rawCard = c.readCard(code); } catch { rawCard = null; }
  }
  const summary = summarizeCard(normalized, { rawCard, tier });
  return {
    status: 'ok',
    input,
    code,
    resolvedFrom,
    tier,
    tierNote: TIER_NOTE[tier],
    absenceNote: ABSENCE_NOTE[tier],
    summary,
  };
}

const _codeSets = new WeakMap();

/**
 * Whether `code` names a catalogued language — WITHOUT fetching anything.
 *
 * The index is built from the same source the CLI reads (the monorepo corpus,
 * or the package's bundle manifest of every catalogued code), so membership
 * there is the cheap, honest test. resolveCode() cannot answer it: it returns
 * its input unchanged for known AND unknown codes. A repo-mode locale card
 * (fra-CA) is not in a language index but is a real card, so repo mode also
 * asks the registry directly (a synchronous in-memory read there).
 */
function isKnownCode(c, code, index, mode) {
  if (index) {
    let set = _codeSets.get(index);
    if (!set) {
      set = new Set(index.map((l) => l.code));
      _codeSets.set(index, set);
    }
    if (set.has(code)) return true;
  }
  if (mode === 'repo') return Boolean(c.getLanguageCard(code));
  return !index;
}

function notFound(input, found, code = null) {
  const pu = String(code ?? input ?? '').trim().toLowerCase();
  if (/^q[a-t][a-z]$/.test(pu)) {
    // A private-use code has no card BY DESIGN (Round 9 hospital persona:
    // "No language card… use search_languages" read as a dead end).
    return {
      status: 'not-found',
      input,
      privateUse: true,
      note: `${pu} is an ISO 639-3 private-use code (qaa–qtz are reserved for local use): no language card `
        + `exists for it, by design. language_overview { "code": "${pu}" } says what still applies — `
        + 'marking your test set local-only, forge_init with no_card and the predictions BEFORE any baseline '
        + '(a benchmark of the test file is a scoring read), then the baseline — and search_languages finds '
        + 'candidate varieties with real codes for the community to consider.',
      suggestions: [],
    };
  }
  const suggestions = (found?.results ?? []).slice(0, 6).map((l) => ({ code: l.code, name: l.name }));
  const lead = code && code !== input
    ? `No language card for "${input}" (resolved to "${code}").`
    : `No language card for "${input}".`;
  return {
    status: 'not-found',
    input,
    note: lead + (suggestions.length
      ? ` ${found.match === 'fuzzy' ? 'Closest names'
        : found.match === 'partial' ? 'Languages matching part of it' : 'Matches'}: `
        + suggestions.map((s) => `${s.code} (${s.name})`).join(', ')
        + ' — call get_language with one of those codes.'
      : ' Use search_languages to find the code (it also matches misspellings).'),
    suggestions,
  };
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

/**
 * Speaker claims as text, with what tells claims from ONE source apart.
 *
 * Plains Cree's card carries two ELCat counts — "10-99" (its note: British
 * Columbia's speakers only) and "10000-99999" (no note) — and the overview
 * printed both with the same source and nothing else, so neither the user
 * nor the agent could tell what separated them (synthetic Cree school,
 * Round 13). Each claim keeps the year and scope note the card's adapter
 * carries (normalizeCard: `date`, `note`); a claim that shares its source
 * with another and carries neither says so, and when no claim of that source
 * carries one, the line says plainly they are records without a
 * distinguishing note on the card. Never one picked, never merged: the card
 * is an index, not an arbiter.
 *
 * @param {Array<{value: *, source: string|null, date?: *, note?: string}>} list
 * @param {{noteLimit?: number}} [opts]
 * @returns {string[]}  one entry per claim, plus one per same-source group nothing distinguishes
 */
export function speakerClaimTexts(list, { noteLimit = 200 } = {}) {
  const claimsOf = Array.isArray(list) ? list : [];
  const groups = new Map();
  for (const c of claimsOf) {
    const k = c.source || 'source not stated';
    groups.set(k, [...(groups.get(k) || []), c]);
  }
  const own = (c) => {
    const parts = [c.date ? `(${c.date})` : null,
      c.note ? `"${String(c.note).length > noteLimit ? `${String(c.note).slice(0, noteLimit - 1)}…` : String(c.note)}"` : null];
    return parts.filter(Boolean).join(' ');
  };
  const out = [];
  for (const c of claimsOf) {
    const src = c.source || 'source not stated';
    const siblings = groups.get(src);
    const mine = own(c);
    let tail = mine ? ` — ${mine}` : '';
    if (!mine && siblings.length > 1 && siblings.some((x) => own(x))) {
      tail = ' — no note on the card says what this record covers';
    }
    out.push(`${c.value} [${src}]${tail}`);
  }
  for (const [src, siblings] of groups) {
    if (siblings.length > 1 && !siblings.some((x) => own(x))) {
      out.push(`${siblings.length === 2 ? 'two' : siblings.length} ${src} records (${siblings.map((x) => x.value).join(', ')}) `
        + 'without a distinguishing note on the card');
    }
  }
  return out;
}

function fmtClaims(list, { withNote = true } = {}) {
  return list.map((c) => {
    const src = c.source ? ` [${c.source}]` : ' [source not stated]';
    const note = withNote && c.note ? ` — ${String(c.note).slice(0, 160)}` : '';
    const date = c.date ? ` (${c.date})` : '';
    return `${c.value}${date}${src}${note}`;
  });
}

function capped(items, render) {
  const shown = items.slice(0, LIST_CAP).map(render);
  if (items.length > LIST_CAP) shown.push(`… +${items.length - LIST_CAP} more`);
  return shown;
}

function toolLine(t) {
  const lic = t.license
    ? `${t.license}${t.licenceEstablished === false ? ' (licence NOT established)' : ''}`
    : 'licence not stated';
  return `${t.name ?? '?'} — ${t.publisher ?? 'publisher ?'}, ${lic}${t.archived ? ', archived' : ''}${t.url ? ` <${t.url}>` : ''}`;
}

/** Agent-readable text for a getLanguage() result. */
export function formatLanguage(r) {
  if (r.status !== 'ok') return r.note;
  const s = r.summary;
  const out = [];
  out.push(`# ${s.name} (${s.code})`);
  out.push(`Card source: ${r.tierNote}.${r.resolvedFrom ? ` Resolved ${r.resolvedFrom}.` : ''}`);
  if (s.locale) {
    out.push(`This is a LOCALE card — ${s.locale.language}'s facts resolved for ${[s.locale.region, s.locale.script].filter(Boolean).join('/') || 'a variant'}, not a separate language.`);
  }
  if (s.nameClaims.length) {
    out.push(`Name — sources differ (all shown, none elected): ${fmtClaims(s.nameClaims).join(' | ')}`);
  }
  out.push('');
  const id = s.identity;
  const idBits = [
    id.iso639_3 && `ISO 639-3 ${id.iso639_3}`, id.iso639_1 && `ISO 639-1 ${id.iso639_1}`,
    id.glottocode && `Glottocode ${id.glottocode}`, id.bcp47 && `BCP 47 ${id.bcp47}`,
    id.isoType && `type ${id.isoType}`, id.isoScope && `scope ${id.isoScope}`,
    id.macrolanguage && `macrolanguage ${id.macrolanguage}`, id.modality && `modality ${id.modality}`,
  ].filter(Boolean);
  out.push(`Identity: ${idBits.join(' · ') || 'no identifiers beyond the code'}`);
  out.push(`Endonym: ${s.endonym.length ? fmtClaims(s.endonym).join(' | ') : 'not asserted by any source on this card'}`);
  if (s.isolate) {
    out.push('Classification: language isolate (no family)');
  } else if (s.family.length) {
    const agree = new Set(s.family.map((f) => f.value)).size === 1;
    out.push(`Family${agree ? '' : ' — taxonomies differ (all shown)'}: ${fmtClaims(s.family).join(' | ')}`);
  } else {
    out.push('Family: not asserted');
  }
  if (s.ancestry.length) out.push(`Ancestry: ${s.ancestry.join(' › ')}`);
  // Every displayed fact cites its source (Round 10 hospital persona: the
  // location lines were the uncited ones). A location the card carries with
  // no stamp — the published projection drops them — is not displayed.
  const ws = s.whereSources ?? {};
  const whereFacts = [
    s.macroarea && { text: `macroarea ${s.macroarea}`, sources: ws.macroarea ?? [] },
    s.countries.length && { text: `countries ${s.countries.join(', ')}`, sources: ws.countries ?? [] },
  ].filter(Boolean);
  const whereCited = whereFacts.filter((f) => f.sources.length);
  if (whereCited.length) {
    out.push(`Where: ${whereCited.map((f) => `${f.text} [${f.sources.join(', ')}]`).join('; ')}`);
  }
  if (whereFacts.length > whereCited.length) {
    // Round 11 (hospital persona): said for the tier the card came from (a
    // published row uploaded before the tables carried per-field sources says
    // so), and pointing at Glottolog's record by the card's glottocode — a
    // pointer to the source, never a claim.
    const published = s.provenance?.tier === 'cache' || s.provenance?.tier === 'remote';
    const url = glottologRecordUrl(id.glottocode);
    out.push(`Where: ${whereFacts.length - whereCited.length === whereFacts.length ? '' : 'other '}location facts not shown — `
      + uncitedReason({ tier: published ? 'published' : s.provenance?.tier,
        publishedStamps: s.provenance?.fieldSourcesCarried === true }, 'them')
      + '; an uncited location is never displayed.'
      + (url ? ` Glottolog's record (glottocode ${id.glottocode}): ${url}` : ''));
  }

  out.push('');
  if (s.speakers.length) {
    const differ = new Set(s.speakers.map((x) => String(x.value))).size > 1;
    out.push(`Speakers${differ ? ' — sources differ (every claim shown, none elected)' : ''}:`);
    for (const line of speakerClaimTexts(s.speakers)) out.push(`  - ${line}`);
  } else {
    out.push('Speakers: no cited estimate');
  }
  if (s.endangerment.length) {
    out.push('Endangerment (each source on its own scale):');
    for (const line of capped(s.endangerment, (c) => fmtClaims([c])[0])) out.push(`  - ${line}`);
  }
  if (s.vitality) {
    const lead = s.endangerment.length ? '  Display tier' : 'Endangerment display tier';
    out.push(`${lead}: ${s.vitality.tier} (champollion-derived from ${s.vitality.assessedBy ?? 'one cited assessment'})`
      + (s.endangerment.length ? '' : ' — the per-source assessments are not carried by this card tier'));
  }
  if (!s.endangerment.length && !s.vitality) out.push('Endangerment: no source assesses it');
  // scripts[] and scriptNames[] are each sorted on their own (codes vs
  // names) — zipping them by index would mislabel Cans as "Latin". They are
  // shown side by side, never paired.
  const scriptLine = s.scripts.map((x) => x.code).join(', ')
    + (s.scriptNames.length ? ` (names: ${s.scriptNames.join(', ')})` : '');
  out.push(`Scripts: ${scriptLine || 'not asserted'}${s.direction ? ` · direction ${s.direction}` : ''}`
    + `${s.orthographicStatus ? ` · ${s.orthographicStatus}` : ''}`);
  if (s.dialectCount != null) out.push(`Dialects (Glottolog's own count): ${s.dialectCount}`);

  out.push('');
  out.push('Resources (existence only — a listing, not a quality claim):');
  const R = s.resources;
  const section = (label, items, render) => {
    if (!items.length) return;
    out.push(`  ${label}:`);
    for (const line of capped(items, render)) out.push(`    - ${line}`);
  };
  section('Dictionaries', R.dictionaries, (d) => toolLine(d) + (d.pairedWith ? ` (paired with ${d.pairedWith})` : ''));
  section('FSTs / morphological analyzers', R.fsts, toolLine);
  section('Keyboards', R.keyboards, toolLine);
  section('Parallel corpora (OPUS)', R.parallelCorpora,
    (p) => `${p.corpus} — ${p.alignmentPairs ?? '?'} aligned pairs${p.topPartners.length ? ` (top partners ${p.topPartners.join(', ')})` : ''}`);
  section('Lexical datasets (wordlists)', R.lexicalDatasets,
    (d) => `${d.dataset}${d.forms != null ? ` — ${d.forms} forms` : ''}${d.release ? ` [${d.release}]` : ''}`);
  if (R.documentation) out.push(`  Most extensive description: ${R.documentation.level} [${R.documentation.source}]`);
  if (R.typologyDatasets.length) out.push(`  Typology datasets coding it: ${R.typologyDatasets.join(', ')}`);

  out.push('');
  out.push('Method support (does a service or model LIST this language — never a quality claim):');
  const M = s.methods;
  if (M.serviceListingKnown) {
    out.push(`  Services: ${Object.entries(M.services).map(([k, v]) => `${k} ${v ? '✓' : '✗'}`).join(' · ')}`);
  } else {
    out.push('  Services: no MT service lists this language on this card');
  }
  if (M.declaredModels.length) {
    out.push(`  Open models whose model card declares it (${M.declaredTotal}):`);
    for (const line of capped(M.declaredModels, (m) => `${m.id} [${m.tier}; ${m.source}]`)) out.push(`    - ${line}`);
  }
  out.push('  LLMs: will attempt any language — whether they do it WELL is a leaderboard question (get_results), unmeasured here.');
  if (s.metricModels.length) {
    out.push(`  Metric models listing it: ${s.metricModels.map((m) => `${m.metric}${m.pivot ? ' (pivot only)' : ''}`).join(', ')}`);
  }
  if (s.evalWiring.datasets.length || s.evalWiring.standard) {
    out.push(`Eval wiring (Champollion config): ${s.evalWiring.datasets.length ? `datasets ${s.evalWiring.datasets.join(', ')}` : ''}`
      + `${s.evalWiring.standard ? `${s.evalWiring.datasets.length ? '; ' : ''}language eval standard ${s.evalWiring.standard.package} (${s.evalWiring.standard.pip ?? 'pip'})` : ''}`);
  }

  out.push('');
  if (s.absent.length) out.push(`Not on this card: ${s.absent.join(', ')}. ${r.absenceNote}`);
  const p = s.provenance;
  out.push(`Provenance: ${[
    p.atlasVersion && `atlas ${p.atlasVersion}`,
    p.publishedAt && `published ${String(p.publishedAt).slice(0, 10)}`,
    p.sourceCount != null && `${p.sourceCount} cited sources`,
    p.coverage && p.coverage.total && `${p.coverage.present}/${p.coverage.total} card components present`,
  ].filter(Boolean).join(' · ') || 'see the card'}. Card spec: https://champollion.dev/docs/network/specifications/language-cards`);
  out.push(`Next: language_overview { "code": "${s.code}" } — benchmarks, results, methods, constraints and the next steps for building a model.`);
  return out.join('\n');
}
