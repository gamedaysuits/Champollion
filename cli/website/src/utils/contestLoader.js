/**
 * contestLoader.js
 * ─────────────────────────────────────────────────────────────────
 * Fetches contest data from the Supabase REST API for display on
 * language trading cards.
 *
 * Returns a map of target language code → array of contests,
 * parsed from the contest's `language_pair` field (e.g., "en>crk" → "crk").
 *
 * The fetch is fire-and-forget: if Supabase is unreachable or the
 * contests table doesn't exist yet, the trading cards page works
 * fine without contest data (returns empty map).
 *
 * Only reads fields that actually exist in the contests table
 * (schema: mt-eval-arena/supabase/migrations/008_create_contests.sql):
 *   id, name, description, language_pair, status, visibility, created_at
 *
 * Supabase public config (anon key is read-only, safe for frontend):
 *   URL:  https://sjdomynysdljkbemupqa.supabase.co
 *   Key:  sb_publishable_bV6CFNFnzxhQI0wlBx2J0A_5Vm5gFBp
 * ─────────────────────────────────────────────────────────────────
 */

const SUPABASE_URL = 'https://sjdomynysdljkbemupqa.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_bV6CFNFnzxhQI0wlBx2J0A_5Vm5gFBp';

/**
 * Fetch all public contests (open and closed) from Supabase.
 * Falls back gracefully on any error (404, network, etc).
 *
 * @returns {Promise<Object>} Map of { langCode: [contest, ...] }
 */
export async function loadContests() {
  try {
    const url = new URL(`${SUPABASE_URL}/rest/v1/contests`);
    url.searchParams.set(
      'select',
      'id,name,description,language_pair,status,visibility,created_at'
    );
    url.searchParams.set('visibility', 'eq.public');
    url.searchParams.set('status', 'in.(open,closed)');
    url.searchParams.set('order', 'created_at.desc');

    const response = await fetch(url.toString(), {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    });

    if (!response.ok) {
      console.warn(`[contestLoader] Supabase returned ${response.status}`);
      return {};
    }

    const contests = await response.json();

    // Build language code → contests map
    // language_pair format: "en>crk" → target is "crk"
    const contestMap = {};
    for (const contest of contests) {
      const targetLang = parseTargetLanguage(contest.language_pair);
      if (!targetLang) continue;

      const enriched = {
        id: contest.id,
        name: contest.name,
        description: contest.description || '',
        languagePair: contest.language_pair,
        status: contest.status,
      };

      if (!contestMap[targetLang]) contestMap[targetLang] = [];
      contestMap[targetLang].push(enriched);
    }

    // Sort each language's contests: open first, then by creation date
    for (const langContests of Object.values(contestMap)) {
      langContests.sort((a, b) => {
        if (a.status === 'open' && b.status !== 'open') return -1;
        if (a.status !== 'open' && b.status === 'open') return 1;
        return 0;
      });
    }

    const openCount = Object.values(contestMap)
      .flat()
      .filter((c) => c.status === 'open').length;
    console.log(
      `[contestLoader] Loaded ${contests.length} contests across ${Object.keys(contestMap).length} languages (${openCount} open)`
    );

    return contestMap;
  } catch (err) {
    // Graceful degradation — page works fine without contests
    console.warn('[contestLoader] Failed to fetch contests:', err.message);
    return {};
  }
}

/**
 * Parse the target language code from a language pair string.
 * Handles formats: "en>crk", "en→crk", "en-crk", "en_crk"
 */
function parseTargetLanguage(pair) {
  if (!pair) return null;
  const parts = pair.split(/[>→\-_]/);
  return parts.length >= 2 ? parts[parts.length - 1].trim().toLowerCase() : null;
}

/**
 * Get contest display info for a card.
 *
 * @param {string} langCode - The card's ISO 639-3 code
 * @param {Object} contestMap - The map from loadContests()
 * @returns {{ hasOpenContest, hasClosedContest, hasAnyContest, openContests, closedContests, totalContests }}
 */
export function getContestInfo(langCode, contestMap) {
  const contests = contestMap[langCode] || [];
  const openContests = contests.filter((c) => c.status === 'open');
  const closedContests = contests.filter((c) => c.status === 'closed');

  return {
    hasOpenContest: openContests.length > 0,
    hasClosedContest: closedContests.length > 0,
    hasAnyContest: contests.length > 0,
    openContests,
    closedContests,
    totalContests: contests.length,
  };
}
