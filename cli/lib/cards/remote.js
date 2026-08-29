/**
 * Remote card source — read-only access to the production Supabase
 * trading-card tables, and reconstruction of language cards from them.
 *
 * TABLES (mt-eval-arena/supabase/migrations/012_create_trading_cards.sql):
 *   trading_card_index  — one compact row per language (grid fields),
 *                         per-language updated_at
 *   trading_card_detail — { code, detail JSONB, updated_at }; detail is
 *                         the pre-resolved (extends already merged)
 *                         card projection built by
 *                         mt-eval-arena/scripts/build-trading-card-data.mjs
 *
 * Access is anon-key, SELECT-only (enforced by RLS). This module never
 * writes to Supabase.
 *
 * RECONSTRUCTION FIDELITY: the detail blob carries most reference
 * fields under their card names (classification, vitality, formality,
 * methodSupport, …) but NOT the runtime-only fields `registers`,
 * `rules`, `gender`, or `aliases`:
 *   - registers are re-derived from `formality` with the same templates
 *     the card build uses (scripts/derive-registers-from-formality.mjs)
 *   - rules/gender stay null — all consumers treat them as optional
 *     (lib/types.js documents rules as object|null)
 *   - aliases come from the bundled manifest (shared/cards-fallback.json)
 * Languages with hand-curated registers ship in the bundled fallback
 * set, so reconstruction only ever serves the long tail.
 *
 * Shared by the CLI's lazy card loader (lib/registers.js) and the
 * website data build (cli/website/scripts/build-data-from-supabase.mjs).
 * Zero dependencies — global fetch (Node >= 20.11).
 */

import { SUPABASE_URL, SUPABASE_ANON_KEY, isValidCardCode } from './env.js';

const REST_BASE = `${SUPABASE_URL}/rest/v1`;

/** PostgREST caps responses at 1000 rows per request on Supabase. */
const MAX_PAGE = 1000;

function headers(extra = {}) {
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    ...extra,
  };
}

/**
 * GET a REST URL and parse JSON, with bounded retries on network
 * errors and 5xx. 4xx responses throw immediately (they won't heal).
 */
export async function fetchJson(url, { timeoutMs = 15000, retries = 2, accept } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: headers(accept ? { Accept: accept } : {}),
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (res.ok) return await res.json();
      const body = await res.text().catch(() => '');
      const err = new Error(`Supabase request failed: HTTP ${res.status} ${body.slice(0, 200)}`);
      err.status = res.status;
      if (res.status >= 400 && res.status < 500) throw err;
      lastErr = err;
    } catch (err) {
      if (err.status >= 400 && err.status < 500) throw err;
      lastErr = err;
    }
    if (attempt < retries) {
      await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
    }
  }
  throw lastErr;
}

/**
 * Fetch rows from trading_card_index, paginating until exhausted.
 *
 * @param {object} [opts]
 * @param {string} [opts.select] - PostgREST select list (default: all columns)
 * @param {string} [opts.since]  - ISO timestamp; only rows with updated_at > since
 * @param {number} [opts.pageSize]
 * @param {number} [opts.timeoutMs]
 * @returns {Promise<object[]>} snake_case rows
 */
export async function fetchIndexRows({ select = '*', since, pageSize = MAX_PAGE, timeoutMs = 30000 } = {}) {
  const rows = [];
  const size = Math.min(pageSize, MAX_PAGE);
  for (let offset = 0; ; offset += size) {
    const params = new URLSearchParams({
      select,
      order: 'code.asc',
      limit: String(size),
      offset: String(offset),
    });
    if (since) params.set('updated_at', `gt.${since}`);
    const page = await fetchJson(`${REST_BASE}/trading_card_index?${params}`, { timeoutMs });
    rows.push(...page);
    if (page.length < size) break;
  }
  return rows;
}

/** Fetch one index row by code, or null if the language isn't in prod. */
export async function fetchIndexRow(code, { timeoutMs = 10000 } = {}) {
  if (!isValidCardCode(code)) return null;
  const params = new URLSearchParams({ select: '*', code: `eq.${code}`, limit: '1' });
  const rows = await fetchJson(`${REST_BASE}/trading_card_index?${params}`, { timeoutMs });
  return rows[0] || null;
}

/** Fetch one detail row ({ code, detail, updated_at }) by code, or null. */
export async function fetchDetailRow(code, { timeoutMs = 10000 } = {}) {
  if (!isValidCardCode(code)) return null;
  const params = new URLSearchParams({
    select: 'code,detail,updated_at',
    code: `eq.${code}`,
    limit: '1',
  });
  const rows = await fetchJson(`${REST_BASE}/trading_card_detail?${params}`, { timeoutMs });
  return rows[0] || null;
}

/**
 * Fetch every detail row, paginating in modest pages (rows average
 * ~9 KB; large pages risk statement timeouts). Used by website data
 * builds, not by the CLI hot path.
 *
 * @param {object} [opts]
 * @param {number} [opts.pageSize]
 * @param {(rows: object[], offset: number) => void} [opts.onPage] - streaming hook
 */
export async function fetchAllDetailRows({ pageSize = 200, timeoutMs = 60000, onPage } = {}) {
  const all = [];
  for (let offset = 0; ; offset += pageSize) {
    const params = new URLSearchParams({
      select: 'code,detail,updated_at',
      order: 'code.asc',
      limit: String(pageSize),
      offset: String(offset),
    });
    const page = await fetchJson(`${REST_BASE}/trading_card_detail?${params}`, { timeoutMs });
    if (onPage) onPage(page, offset);
    else all.push(...page);
    if (page.length < pageSize) break;
  }
  return all;
}

// -----------------------------------------------------------------
// Registers derivation — ported verbatim from
// scripts/derive-registers-from-formality.mjs so cards reconstructed
// from Supabase carry the same derived presets as their on-disk
// counterparts. Keep the two in sync if templates ever change.
// -----------------------------------------------------------------

const REGISTER_TEMPLATES = {
  'T-V': {
    formal: {
      label: 'Formal (V-form)',
      description: 'Polite/formal address using V-form pronouns (e.g., vous, Sie, usted, вы). Default for software UI, official communication, and addressing strangers.',
      prompt: 'Use formal/polite address forms (V-form pronouns). Write in a professional, respectful tone appropriate for software UI and official communication.',
      isDefault: true,
    },
    informal: {
      label: 'Informal (T-form)',
      description: 'Familiar/informal address using T-form pronouns (e.g., tu, du, tú, ты). Used with close friends, family, children, and peers of similar age.',
      prompt: 'Use informal/familiar address forms (T-form pronouns). Write in a casual, friendly tone appropriate for peer-to-peer communication.',
      isDefault: false,
    },
  },
  'speech-levels': {
    formal: {
      label: 'Formal/Honorific',
      description: 'Highest politeness level with dedicated verb morphology and honorific vocabulary. Used in formal contexts, with elders, officials, and strangers.',
      prompt: 'Use the highest politeness level with honorific verb forms and respectful vocabulary. Address the reader with maximum deference.',
      isDefault: false,
    },
    polite: {
      label: 'Polite/Standard',
      description: 'Standard polite register. Appropriate for most software UI, everyday formal interactions, and default translation output.',
      prompt: 'Use standard polite register. Professional and respectful without excessive formality. Appropriate for software UI and general communication.',
      isDefault: true,
    },
    informal: {
      label: 'Informal/Casual',
      description: 'Casual register used among close friends, peers, and in informal settings. Not appropriate for software UI or official content.',
      prompt: 'Use casual/informal register. Relaxed tone appropriate for friends and peers. Avoid honorifics and formal verb endings.',
      isDefault: false,
    },
  },
  'avoidance': {
    respectful: {
      label: 'Respectful/Indirect',
      description: 'Address through indirect reference, titles, kinship terms, or circumlocution. Primary mode for respectful communication.',
      prompt: 'Use indirect address strategies: titles, kinship terms, or circumlocution rather than direct pronouns. Maintain respectful distance.',
      isDefault: true,
    },
    neutral: {
      label: 'Neutral/Direct',
      description: 'Direct address without avoidance strategies. Used in informal or intimate contexts where indirectness is unnecessary.',
      prompt: 'Use direct address without avoidance strategies. Straightforward and clear communication.',
      isDefault: false,
    },
  },
  'none': {
    standard: {
      label: 'Standard',
      description: 'No grammaticalized politeness distinctions. A single register serves all social contexts, though lexical choices may vary by formality.',
      prompt: 'Use standard register. This language does not grammaticalize politeness distinctions. Write clearly and naturally.',
      isDefault: true,
    },
  },
  'politeness-present': {
    formal: {
      label: 'Formal/Polite',
      description: 'Polite register using politeness-marked pronoun forms. Default for software UI and formal contexts.',
      prompt: 'Use polite/formal pronoun forms and politeness markers. Professional tone appropriate for software UI and formal contexts.',
      isDefault: true,
    },
    informal: {
      label: 'Informal/Familiar',
      description: 'Informal register using unmarked/familiar pronoun forms. Used with close relations.',
      prompt: 'Use unmarked/familiar pronoun forms. Casual tone appropriate for friends and family.',
      isDefault: false,
    },
  },
};

/**
 * Derive a registers block from a formality field, mirroring the
 * build-time enrichment. Returns { registers, defaultKey } or null
 * when the formality system is unknown.
 */
export function deriveRegistersFromFormality(formality) {
  if (!formality || !formality.system) return null;
  const template = REGISTER_TEMPLATES[formality.system];
  if (!template) return null;

  const registers = {};
  let defaultKey = null;
  for (const [key, val] of Object.entries(template)) {
    registers[key] = {
      ...val,
      source: `derived-from-formality (${formality.source || 'unknown'})`,
    };
    if (val.isDefault) defaultKey = key;
  }
  return { registers, defaultKey };
}

// -----------------------------------------------------------------
// Card reconstruction
// -----------------------------------------------------------------

/**
 * Detail-blob fields that map 1:1 onto card fields. Display-only
 * assemblies whose shape differs from the raw cards (vocabulary,
 * typology, phonology, statSources, provenance, …) are deliberately
 * not mapped — fabricating card fields with mismatched shapes would
 * be worse than omitting them.
 */
const DETAIL_PASSTHROUGH = [
  'classification',
  'vitality',
  'speakerEstimates',
  'linguisticChallenges',
  'contactInfluences',
  'formality',
  'methodSupport',
  'resources',
  'evalDatasets',
  'pipelineReadiness',
  'digitalPresence',
  'corpusAvailability',
  'databaseCoverage',
  'omt1600',
  'regions',
  'countries',
  'coordinates',
  'orthographicStatus',
  'notes',
  'encyclopedic',
  'experts',
  'alternateNames',
  'modality',
  'isoType',
  'isoScope',
  'macrolanguage',
  'members',
  'taxonomyNotes',
];

/**
 * Build a language card from remote rows. The result is card-shaped
 * (same field names as shared/language-cards/*.json) and ready for
 * the registry — it has no `extends` because the upload pipeline
 * resolves inheritance before publishing.
 *
 * @param {object} indexRow - snake_case trading_card_index row
 * @param {object|null} detailRow - { detail, updated_at } or null
 * @param {object} [opts]
 * @param {string[]} [opts.aliases] - aliases from the bundled manifest
 * @returns {object} reconstructed card
 */
export function buildCardFromRemote(indexRow, detailRow, { aliases } = {}) {
  const detail = detailRow?.detail || {};
  const code = indexRow.code;

  const card = {
    code,
    name: indexRow.name || code,
    nativeName: indexRow.native_name ?? null,
    iso639_3: /^[a-z]{3}$/.test(code) ? code : null,
    iso639_1: null,
    bcp47: code,
    glottocode: detail.glottocode ?? indexRow.glottocode ?? null,
    isIsolate: indexRow.is_isolate ?? false,
    macroarea: indexRow.macroarea ?? null,
    // Taxonomy badging — carried on the index row since migration 056.
    // The detail blob's values (DETAIL_PASSTHROUGH below) override these
    // when present; rows uploaded before the migration leave them null.
    modality: indexRow.modality ?? null,
    isoType: indexRow.iso_type ?? null,
    isoScope: indexRow.iso_scope ?? null,
    macrolanguage: indexRow.macrolanguage ?? null,
    script: indexRow.script ?? null,
    scripts: indexRow.scripts ?? null,
    dir: indexRow.dir || 'ltr',
    dialectCount: indexRow.dialect_count ?? null,
    culturalAphorism: indexRow.cultural_aphorism ?? null,
    registers: null,
    rules: null,
    gender: null,
  };

  if (Array.isArray(aliases) && aliases.length > 0) card.aliases = aliases;

  for (const field of DETAIL_PASSTHROUGH) {
    if (detail[field] !== undefined && detail[field] !== null) {
      card[field] = detail[field];
    }
  }

  // Re-derive registers the same way the card build does, so
  // getRegister()/getRegisterPresets() behave identically to the
  // on-disk stub cards.
  const derived = deriveRegistersFromFormality(card.formality);
  if (derived) {
    card.registers = derived.registers;
    if (derived.defaultKey && !card.formality.default) {
      card.formality = { ...card.formality, default: derived.defaultKey };
    }
    card._fieldSources = {
      registers: `derived-from-formality (${card.formality.source || 'unknown'})`,
    };
  }

  card._remote = {
    source: 'supabase',
    updatedAt: detailRow?.updated_at || indexRow.updated_at || null,
  };

  return card;
}

/**
 * Fetch and reconstruct one card.
 *
 * @returns {Promise<{card: object, updatedAt: string|null}|{missing: true}>}
 *   missing:true when the language doesn't exist in prod (definitive
 *   404-equivalent — callers may tombstone it). Network/server errors
 *   throw instead.
 */
export async function fetchRemoteCard(code, { aliases, timeoutMs = 10000 } = {}) {
  if (!isValidCardCode(code)) return { missing: true };
  const [indexRow, detailRow] = await Promise.all([
    fetchIndexRow(code, { timeoutMs }),
    fetchDetailRow(code, { timeoutMs }),
  ]);
  if (!indexRow) return { missing: true };
  const card = buildCardFromRemote(indexRow, detailRow, { aliases });
  return { card, updatedAt: card._remote.updatedAt };
}

export { SUPABASE_URL, SUPABASE_ANON_KEY };
