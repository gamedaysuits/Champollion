/**
 * Dynamic language card loader utility.
 * Fetches the pre-resolved card dataset at runtime from /data/languages.json.
 *
 * Architecture (v7):
 *   shared/language-cards/*.json        — Per-language runtime cards
 *   shared/language-cards/genera/*.json — Genus/family abstract cards (curated)
 *
 * The cards used to be bundled at build time via webpack require.context,
 * which inlined ~8,000 JSON files (~200 MB of JS) into every locale build.
 * Resolution of `extends` inheritance chains now happens once at build time
 * (plugins/shared-data/generateLanguagesJson.js), and the resolved dataset is
 * fetched from the locale-independent absolute path /data/languages.json
 * (data is shared across locales, so the path must NOT be locale-prefixed).
 */

// Build-time SSOT derivation (scripts/build-hub-names.mjs): display names +
// scope for codes with NO tc-index row — macrolanguage hubs, ISO 639-5
// collectives, retired codes. Small and build-frozen, so a static import.
import hubNames from '../data/hub-names.json';

// Module-level cache — the dataset is immutable for the lifetime of the page.
let _languagesPromise = null;

/**
 * Load all resolved language cards.
 * @returns {Promise<Array>} resolved cards, sorted by English name.
 *          Resolves to [] on failure (matching the old sync fallback).
 */
export function loadLanguages() {
  if (_languagesPromise) return _languagesPromise;

  _languagesPromise = (async () => {
    try {
      // Absolute path on purpose: the dataset is emitted once at the build
      // root and shared by every locale build.
      const response = await fetch('/data/languages.json');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const cards = await response.json();
      // Drop non-card entries defensively: the generated dataset has
      // contained reference data without a `code` (e.g. the Glottolog
      // language-tree file), which crashes consumers that dereference
      // card fields. The generator now filters these too; this guard
      // keeps stale/mid-regeneration datasets from breaking pages.
      return (Array.isArray(cards) ? cards : []).filter(
        (card) => card && typeof card.code === 'string' && card.code,
      );
    } catch (err) {
      console.error('[languageLoader] Failed to load languages:', err);
      _languagesPromise = null; // allow a retry on the next call
      return [];
    }
  })();

  return _languagesPromise;
}

// ---------------------------------------------------------------------------
// /languages SPLIT LOADERS (mobile fix)
//
// The /languages page used to call loadLanguages() above — fetching the full
// ~56 MB languages.json AND rendering every card at once. It now fetches a
// compact grid index (~2 MB) and lazy-loads each full card only when its
// detail modal opens. Both artifacts are distilled from languages.json at
// build time (plugins/shared-data/generateLangIndex.js).
//
// Unlike loadLanguages(), these THROW on failure rather than resolving to an
// empty result, so the page can show a loud error state instead of a blank
// grid that looks like "no languages exist".
// ---------------------------------------------------------------------------

let _langIndexPromise = null;
const _langCardCache = {};

/**
 * Load the compact /languages grid index (code, name, nativeName, dir, script,
 * optional encyclopedic.family, and verbatim methodSupport).
 * @returns {Promise<Array>} index entries.
 * @throws on a hard fetch failure (caller shows a loud error state).
 */
export function loadLangIndex() {
  if (_langIndexPromise) return _langIndexPromise;

  _langIndexPromise = (async () => {
    const response = await fetch('/data/lang-index.json');
    if (!response.ok) {
      throw new Error(`lang-index.json: HTTP ${response.status}`);
    }
    const entries = await response.json();
    return (Array.isArray(entries) ? entries : []).filter(
      (e) => e && typeof e.code === 'string' && e.code,
    );
  })();

  // Don't cache a rejected promise — allow a retry on the next call.
  _langIndexPromise.catch(() => { _langIndexPromise = null; });
  return _langIndexPromise;
}

/**
 * Load one full resolved language card for the detail modal.
 * @param {string} code — language code (matches lang-cards/{code}.json)
 * @returns {Promise<Object>} the full card.
 * @throws on a hard fetch failure (modal shows a loud error state).
 */
export async function loadLangCard(code) {
  if (!code) throw new Error('loadLangCard: no code');
  if (_langCardCache[code]) return _langCardCache[code];

  const response = await fetch(`/data/lang-cards/${encodeURIComponent(code)}.json`);
  if (!response.ok) {
    throw new Error(`lang-cards/${code}.json: HTTP ${response.status}`);
  }
  const card = await response.json();
  _langCardCache[code] = card;
  return card;
}

// ---------------------------------------------------------------------------
// TRADING CARD LOADERS (v3 — Supabase-backed, async, two-tier)
//
// Trading card data is managed in Supabase as the source of truth.
// The build pipeline (build-trading-card-data.mjs → upload-trading-cards.mjs)
// promotes data from the local SQLite ingestion layer to Supabase.
//
// Two tables:
//   trading_card_index  — compact row per language, for the card grid
//   trading_card_detail — full JSONB facts record, loaded on-demand
//
// Other pages (index.js, languages.js, leaderboard.js) still use
// loadLanguages() above. Only trading-cards.js uses these loaders.
// ---------------------------------------------------------------------------

const SUPABASE_URL = 'https://sjdomynysdljkbemupqa.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_bV6CFNFnzxhQI0wlBx2J0A_5Vm5gFBp';

/**
 * Build standard Supabase REST headers.
 * Anon key is read-only and safe for frontend use.
 */
function supabaseHeaders() {
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  };
}

// In-memory cache — avoids re-fetching on each render cycle
let _indexCache = null;
const _detailCache = {};

// PostgREST silently caps every response at 1000 rows (its default max-rows),
// so the full ~8,000-row index must be fetched in pages. Range headers are
// ignored by this RPC endpoint — only limit/offset query params work.
const SUPABASE_PAGE_SIZE = 1000;

/**
 * Dev/test escape hatch: force the static /data fallback instead of Supabase.
 * Useful for verifying freshly regenerated tc-index/tc-lang data locally
 * before it has been uploaded to Supabase.
 *
 * Enable in the browser console:  sessionStorage.setItem('tcForceStatic', '1')
 * Disable:                        sessionStorage.removeItem('tcForceStatic')
 */
function forceStaticData() {
  try {
    return typeof sessionStorage !== 'undefined' &&
      sessionStorage.getItem('tcForceStatic') === '1';
  } catch {
    return false;
  }
}

/**
 * Load the compact trading card index from Supabase.
 * Calls the get_trading_card_index() RPC function which returns only
 * the grid-display columns (no heavy JSONB blobs like stats).
 *
 * Returns ~8,000 rows with pre-computed stats, rarity, abilities, and
 * card front display data. All computation was done at upload time.
 *
 * @returns {Promise<Array>} Array of index entry objects
 */
/**
 * @param {function} [onProgress] streaming callback: called with the rows
 *   loaded SO FAR (already transformed) after the first page and after
 *   each subsequent batch — the Atlas renders its first grid page from
 *   page one instead of waiting ~8 round-trips for the full catalog.
 */
export async function loadTradingCardIndex(onProgress) {
  if (_indexCache) return _indexCache;

  if (forceStaticData()) {
    return await _loadIndexFromStaticFiles();
  }

  const emit = (rows) => {
    if (typeof onProgress === 'function') {
      try {
        onProgress(rows);
      } catch {
        /* a progress-UI bug must never kill the load */
      }
    }
  };

  try {
    // The RPC returns an optimized column set; PostgREST caps at 1000 rows
    // so the catalog is paged — page 0 alone first (fastest first paint +
    // clean RPC-missing detection), then the REST OF THE CATALOG IN ONE
    // PARALLEL BURST. The old sequential await-per-page loop was the
    // Atlas's >10s load.
    const fetchPage = async (offset) => {
      const url = new URL(`${SUPABASE_URL}/rest/v1/rpc/get_trading_card_index`);
      url.searchParams.set('limit', String(SUPABASE_PAGE_SIZE));
      url.searchParams.set('offset', String(offset));
      // Deterministic order so consecutive pages never overlap or skip rows
      url.searchParams.set('order', 'code.asc');
      const response = await fetch(url.toString(), {
        method: 'POST',
        headers: {
          ...supabaseHeaders(),
          'Content-Type': 'application/json',
        },
        body: '{}',
      });
      if (!response.ok) {
        throw new Error(`RPC page at offset ${offset} returned ${response.status}`);
      }
      return (await response.json()) || [];
    };

    let firstPage;
    try {
      firstPage = await fetchPage(0);
    } catch (err) {
      // Fallback to direct table query if RPC doesn't exist yet
      console.warn(`[languageLoader] RPC failed (${err.message}), falling back to direct query`);
      return await _loadIndexFallback();
    }
    // Transform snake_case Supabase columns back to camelCase
    // to match the format the trading card components expect
    let rows = firstPage.map(transformIndexRow);
    if (rows.length) emit(rows);

    if (firstPage.length === SUPABASE_PAGE_SIZE) {
      // ~8,000 rows = 8 pages: one burst usually finishes the catalog. A
      // mid-burst failure rejects the whole load → static-files fallback
      // below (never cache a truncated index).
      const BURST = 7;
      const pages = await Promise.all(
        Array.from({length: BURST}, (_, i) =>
          fetchPage((i + 1) * SUPABASE_PAGE_SIZE),
        ),
      );
      for (const page of pages) rows = rows.concat(page.map(transformIndexRow));
      emit(rows);
      // If the burst's last page came back full the catalog outgrew the
      // burst — keep paging sequentially until a short page.
      let last = pages[pages.length - 1];
      for (
        let offset = (BURST + 1) * SUPABASE_PAGE_SIZE;
        last.length === SUPABASE_PAGE_SIZE;
        offset += SUPABASE_PAGE_SIZE
      ) {
        last = await fetchPage(offset);
        rows = rows.concat(last.map(transformIndexRow));
        emit(rows);
      }
    }

    // If Supabase returned empty, fall back to static files
    if (rows.length === 0) {
      console.warn('[languageLoader] Supabase returned 0 rows, falling back to static files');
      return await _loadIndexFromStaticFiles();
    }

    _indexCache = rows;
    return _indexCache;
  } catch (err) {
    // Network error or Supabase unreachable — fall back to static files
    console.warn('[languageLoader] Supabase unreachable, falling back to static files:', err.message);
    return await _loadIndexFromStaticFiles();
  }
}

/**
 * Fallback: query the trading_card_index table directly if the RPC
 * function hasn't been deployed yet.
 */
async function _loadIndexFallback() {
  const url = new URL(`${SUPABASE_URL}/rest/v1/trading_card_index`);
  url.searchParams.set(
    'select',
    'code,name,native_name,family,genus,macroarea,is_isolate,' +
    'speakers,speaker_count,script,scripts,dir,' +
    'vitality_badge,rarity,rarity_order,challenge_rating,digital_toolkit,' +
    'abilities,pipeline_label,pipeline_emoji,' +
    'fact_count,source_count,' +
    'has_vocabulary,has_typology,has_phonology,has_nearest,has_natural_pair,has_cultural,has_conflicts,' +
    'dialect_count,script_name,regions,ancestry,glottocode,cultural_aphorism'
  );
  // code is unique, so it breaks ties between identical names and keeps
  // the page boundaries deterministic
  url.searchParams.set('order', 'name.asc,code.asc');

  try {
    const rows = [];
    for (let offset = 0; ; offset += SUPABASE_PAGE_SIZE) {
      url.searchParams.set('limit', String(SUPABASE_PAGE_SIZE));
      url.searchParams.set('offset', String(offset));
      const response = await fetch(url.toString(), {
        headers: supabaseHeaders(),
      });

      if (!response.ok) {
        console.warn(`[languageLoader] Direct query returned ${response.status}, falling back to static files`);
        return await _loadIndexFromStaticFiles();
      }

      const page = await response.json();
      rows.push(...(page || []));
      if (!page || page.length < SUPABASE_PAGE_SIZE) break;
    }

    if (rows.length === 0) {
      return await _loadIndexFromStaticFiles();
    }
    _indexCache = rows.map(transformIndexRow);
    return _indexCache;
  } catch (err) {
    console.warn('[languageLoader] Direct query failed, falling back to static files:', err.message);
    return await _loadIndexFromStaticFiles();
  }
}

/**
 * Ultimate fallback: load from static JSON files built by
 * build-trading-card-data.mjs. These are always available
 * during local development.
 */
async function _loadIndexFromStaticFiles() {
  try {
    const response = await fetch('/data/tc-index.json');
    if (!response.ok) {
      console.error('[languageLoader] Static fallback also failed:', response.status);
      return [];
    }
    const rows = await response.json();
    // Same defaulted-vitality guard as the Supabase lane (mapRowToCard):
    // 'source: default' badges are unassessed, not 'Not endangered'.
    _indexCache = rows.map((c) => (
      c?.vitalityBadge?.source === 'default' ? { ...c, vitalityBadge: null } : c
    ));
    console.info(`[languageLoader] Loaded ${_indexCache.length} cards from static files`);
    return _indexCache;
  } catch (err) {
    console.error('[languageLoader] All data sources exhausted:', err.message);
    return [];
  }
}

// Module cache for the lightweight code→name map.
let _nameMapPromise = null;

/**
 * Load a lightweight Map<code, English name> for rendering language-pair labels
 * (e.g. the leaderboard's "eng → fra"). Fetches ONLY code+name from the
 * Supabase trading_card_index (~a few hundred KB) — NOT the 56 MB
 * languages.json, which used to be pulled just for these labels and made the
 * leaderboard unusable on mobile.
 *
 * Throws on a hard failure so the caller can decide how to degrade (e.g. show
 * bare codes); it does not silently cache an empty map.
 */
export async function loadLanguageNameMap() {
  if (_nameMapPromise) return _nameMapPromise;
  _nameMapPromise = (async () => {
    const map = new Map();
    for (let offset = 0; ; offset += SUPABASE_PAGE_SIZE) {
      const url = new URL(`${SUPABASE_URL}/rest/v1/trading_card_index`);
      url.searchParams.set('select', 'code,name');
      url.searchParams.set('order', 'code.asc');
      url.searchParams.set('limit', String(SUPABASE_PAGE_SIZE));
      url.searchParams.set('offset', String(offset));
      const response = await fetch(url.toString(), { headers: supabaseHeaders() });
      if (!response.ok) {
        throw new Error(`trading_card_index name map: HTTP ${response.status}`);
      }
      const page = await response.json();
      for (const row of page || []) {
        if (row.code && row.name) map.set(row.code, row.name);
      }
      if (!page || page.length < SUPABASE_PAGE_SIZE) break;
    }
    if (!map.has('en')) map.set('en', 'English');
    // Codes with no tc-index row — macrolanguage hubs (deliberately purged
    // from tc_index), ISO 639-5 collectives, retired codes — still get an
    // honest name from the build-time SSOT derivation (build-hub-names.mjs)
    // instead of rendering as a bare uppercased code.
    for (const [code, entry] of Object.entries(hubNames)) {
      if (entry && entry.name && !map.has(code)) map.set(code, entry.name);
    }
    return map;
  })();
  // Don't cache a rejected promise — allow a later retry.
  _nameMapPromise.catch(() => { _nameMapPromise = null; });
  return _nameMapPromise;
}

/**
 * Transform a Supabase snake_case index row to the camelCase format
 * expected by the trading card React components.
 *
 * Why: The build script outputs camelCase, Supabase stores snake_case,
 * and the React components were written to consume camelCase. This
 * transform keeps the frontend code unchanged.
 */
function transformIndexRow(row) {
  return {
    code: row.code,
    name: row.name,
    nativeName: row.native_name,
    family: row.family,
    genus: row.genus,
    macroarea: row.macroarea,
    isIsolate: row.is_isolate,
    speakers: row.speakers,
    speakerCount: row.speaker_count,
    script: row.script,
    scripts: row.scripts,
    dir: row.dir,
    // A badge whose source is 'default' is a GUESS the tc build stamped when
    // no source asserted anything — 987 cards, 118 of them historical/ancient,
    // and it rendered as 'Not endangered — actively spoken' on Ancient
    // Macedonian. Silence must not read as reassurance: unassessed shows NO
    // badge. (The build should stop defaulting; this keeps every snapshot
    // honest meanwhile.)
    vitalityBadge: row.vitality_badge?.source === 'default' ? null : row.vitality_badge,
    rarity: row.rarity,
    rarityOrder: row.rarity_order,
    stats: row.challenge_rating,
    digitalToolkit: row.digital_toolkit,
    abilities: row.abilities,
    pipelineLabel: row.pipeline_label,
    pipelineEmoji: row.pipeline_emoji,
    factCount: row.fact_count,
    sourceCount: row.source_count,
    hasVocabulary: row.has_vocabulary,
    hasTypology: row.has_typology,
    hasPhonology: row.has_phonology,
    hasNearest: row.has_nearest,
    hasNaturalPair: row.has_natural_pair,
    hasCultural: row.has_cultural,
    hasConflicts: row.has_conflicts,
    dialectCount: row.dialect_count,
    scriptName: row.script_name,
    regions: row.regions,
    ancestry: row.ancestry,
    glottocode: row.glottocode,
    iso639_1: row.iso639_1 ?? null,
    // Alternate/other names (endonyms + exonyms + spelling variants). Carried
    // in the index's `aliases` column so the Atlas search can match a language
    // by any of its documented names, not just the one we display.
    aliases: Array.isArray(row.aliases) ? row.aliases : [],
    culturalAphorism: row.cultural_aphorism,
    // Taxonomy fields (docs/LANGUAGE_TAXONOMY.md R4) — nullish-safe because
    // Supabase snapshots may predate these columns. The static tc-index.json
    // fallback and the per-language detail records always carry them, and
    // DetailPanel prefers the detail record's values, so badges degrade
    // gracefully (absent, never wrong) on a stale index.
    modality: row.modality ?? null,
    isoType: row.iso_type ?? null,
    isoScope: row.iso_scope ?? null,
    macrolanguage: row.macrolanguage ?? null,
  };
}

/**
 * Load detail data for a specific language from Supabase.
 * Queries the trading_card_detail table for the JSONB detail column.
 *
 * Each row contains the complete factual record for one language:
 * vocabulary, typological features, phonological inventory, colexification,
 * nearest languages, ethnographic data, and full provenance — all with
 * source citations.
 *
 * @param {string} code — ISO 639-3 language code
 * @returns {Promise<Object|null>} Detail object or null if not found
 */
export async function loadTradingCardDetail(code) {
  if (!code) return null;

  // Per-language cache — avoid re-fetching on repeated modal opens
  if (_detailCache[code]) {
    return _detailCache[code];
  }

  if (forceStaticData()) {
    return await _loadDetailFromStaticFiles(code);
  }

  try {
    const url = new URL(`${SUPABASE_URL}/rest/v1/trading_card_detail`);
    url.searchParams.set('select', 'detail');
    url.searchParams.set('code', `eq.${code}`);

    const response = await fetch(url.toString(), {
      headers: {
        ...supabaseHeaders(),
        // Request single object instead of array
        Accept: 'application/vnd.pgrst.object+json',
      },
    });

    if (response.ok) {
      const row = await response.json();
      // The detail column contains the full JSONB record — same structure
      // as the old tc-lang/{code}.json files
      const detail = row.detail;
      if (detail) {
        _detailCache[code] = detail;
        return detail;
      }
    }

    // Supabase didn't return data — fall back to static files
    return await _loadDetailFromStaticFiles(code);
  } catch (err) {
    console.warn(`[languageLoader] Supabase detail failed for ${code}, trying static:`, err.message);
    return await _loadDetailFromStaticFiles(code);
  }
}

// ---------------------------------------------------------------------------
// VOCABULARY LOADER (migration 069 — lazy per-language fetch)
//
// Vocabulary was 70–95% of every trading_card_detail blob, so it moved to its
// own table (trading_card_vocabulary) and is fetched only when a language's
// vocabulary is actually rendered. The detail blob keeps a small
// `vocabularySummary` ({totalForms, sources, asjpOnly}) for the header.
// ---------------------------------------------------------------------------

const _vocabCache = {};

/**
 * Load the full vocabulary record for one language.
 * Same two-tier pattern as loadTradingCardDetail: Supabase REST first
 * (single-object response), static /data/tc-vocab/{code}.json fallback.
 *
 * @param {string} code — language code
 * @returns {Promise<{items: Array, totalForms: number, sources: Array,
 *   asjpOnly: boolean}|null>} vocabulary record, or null when the language
 *   has none (no row and no static file is a normal state, not an error).
 */
export async function loadTradingCardVocabulary(code) {
  if (!code) return null;
  if (_vocabCache[code]) return _vocabCache[code];

  if (forceStaticData()) {
    return await _loadVocabularyFromStaticFiles(code);
  }

  try {
    const url = new URL(`${SUPABASE_URL}/rest/v1/trading_card_vocabulary`);
    url.searchParams.set('select', 'items,total_forms,sources,asjp_only');
    url.searchParams.set('code', `eq.${code}`);

    const response = await fetch(url.toString(), {
      headers: {
        ...supabaseHeaders(),
        // Request single object instead of array
        Accept: 'application/vnd.pgrst.object+json',
      },
    });

    if (response.ok) {
      const row = await response.json();
      if (row && Array.isArray(row.items)) {
        const vocab = {
          items: row.items,
          totalForms: row.total_forms ?? row.items.length,
          sources: row.sources || [],
          asjpOnly: !!row.asjp_only,
        };
        _vocabCache[code] = vocab;
        return vocab;
      }
    }

    // No row (404/406 single-object miss) or unexpected shape — try static
    return await _loadVocabularyFromStaticFiles(code);
  } catch (err) {
    console.warn(`[languageLoader] Supabase vocabulary failed for ${code}, trying static:`, err.message);
    return await _loadVocabularyFromStaticFiles(code);
  }
}

/**
 * Fallback: load vocabulary from the static per-language JSON files written
 * by build-trading-card-data.mjs (staging tc-vocab/) or reconstructed by
 * build-data-from-supabase.mjs, served at /data/tc-vocab/{code}.json.
 * The static blob is already camelCase ({items, totalForms, sources,
 * asjpOnly, …}).
 */
async function _loadVocabularyFromStaticFiles(code) {
  try {
    const response = await fetch(`/data/tc-vocab/${encodeURIComponent(code)}.json`);
    if (!response.ok) return null;
    const blob = await response.json();
    if (!blob || !Array.isArray(blob.items)) return null;
    const vocab = {
      items: blob.items,
      totalForms: blob.totalForms ?? blob.items.length,
      sources: blob.sources || [],
      asjpOnly: !!blob.asjpOnly,
    };
    _vocabCache[code] = vocab;
    return vocab;
  } catch {
    return null;
  }
}

/**
 * Fallback: load detail from static per-language JSON files.
 * These are built by build-trading-card-data.mjs and live at
 * /data/tc-lang/{code}.json during local development.
 */
async function _loadDetailFromStaticFiles(code) {
  try {
    const response = await fetch(`/data/tc-lang/${code}.json`);
    if (!response.ok) return null;
    const detail = await response.json();
    _detailCache[code] = detail;
    return detail;
  } catch {
    return null;
  }
}
