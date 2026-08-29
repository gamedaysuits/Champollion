/**
 * sharedTaskLoader.js
 * ─────────────────────────────────────────────────────────────────
 * Distills shared-task EDITIONS for the /shared-tasks page: a
 * multi-pair shared task (e.g. AmericasNLP: Spanish → many
 * Indigenous languages) is one `shared_tasks` row grouping N
 * per-pair `contests` rows via contests.shared_task_id, so one
 * edition renders as ONE page instead of N disconnected contests.
 *
 * Two fetches (both read-only anon key, graceful degradation like
 * contestLoader.js — the page renders an honest empty state when
 * the tables are unreachable or not yet migrated):
 *
 *   shared_tasks — migration 047 (mt-eval-arena/supabase/migrations/):
 *     shared_task_id, name, organizer, year, description, status,
 *     default_authorization_model, default_intake_daily_limit
 *   contests     — migrations 008/043/047:
 *     id, name, description, language_pair, status, created_at,
 *     shared_task_id (only rows attached to an edition)
 *
 * The grouping itself is the pure function groupContestsByEdition
 * (exported for tests); loadSharedTaskEditions() is the fetch+group
 * wrapper the page calls.
 * ─────────────────────────────────────────────────────────────────
 */

const SUPABASE_URL = 'https://sjdomynysdljkbemupqa.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_bV6CFNFnzxhQI0wlBx2J0A_5Vm5gFBp';

const HEADERS = {
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
};

async function fetchRows(table, searchParams) {
  const url = new URL(`${SUPABASE_URL}/rest/v1/${table}`);
  for (const [k, v] of Object.entries(searchParams)) url.searchParams.set(k, v);
  const response = await fetch(url.toString(), { headers: HEADERS });
  if (!response.ok) {
    console.warn(`[sharedTaskLoader] ${table}: Supabase returned ${response.status}`);
    return [];
  }
  const rows = await response.json();
  return Array.isArray(rows) ? rows : [];
}

/**
 * Pure grouping: shared_tasks rows + contests rows → edition objects,
 * newest cycle first, each carrying its per-pair contests (open first,
 * then by language pair). Contests whose shared_task_id matches no
 * fetched edition are dropped (their umbrella isn't visible to us);
 * editions with zero contests still render — an announced edition is
 * real before its first pair is registered.
 *
 * @param {Array} sharedTasks - raw shared_tasks rows
 * @param {Array} contests - raw contests rows (attached ones)
 * @returns {Array} editions: { sharedTaskId, name, organizer, year,
 *   description, status, defaultAuthorizationModel,
 *   defaultIntakeDailyLimit, contests: [...] }
 */
export function groupContestsByEdition(sharedTasks, contests) {
  const byId = new Map();
  for (const st of sharedTasks || []) {
    if (!st || !st.shared_task_id) continue;
    byId.set(st.shared_task_id, {
      sharedTaskId: st.shared_task_id,
      name: st.name || st.shared_task_id,
      organizer: st.organizer || '',
      year: st.year ?? null,
      description: st.description || '',
      status: st.status || 'active',
      defaultAuthorizationModel: st.default_authorization_model || null,
      defaultIntakeDailyLimit: st.default_intake_daily_limit ?? null,
      contests: [],
    });
  }

  for (const contest of contests || []) {
    const edition = contest && byId.get(contest.shared_task_id);
    if (!edition) continue;
    edition.contests.push({
      id: contest.id,
      name: contest.name,
      description: contest.description || '',
      languagePair: contest.language_pair || '',
      status: contest.status,
    });
  }

  const editions = [...byId.values()];
  for (const edition of editions) {
    edition.contests.sort((a, b) => {
      if (a.status === 'open' && b.status !== 'open') return -1;
      if (a.status !== 'open' && b.status === 'open') return 1;
      return a.languagePair.localeCompare(b.languagePair);
    });
  }
  editions.sort(
    (a, b) => (b.year ?? 0) - (a.year ?? 0) || a.name.localeCompare(b.name),
  );
  return editions;
}

/**
 * Fetch + distill every visible shared-task edition.
 * Falls back to [] on any error — the page shows its empty state.
 *
 * @returns {Promise<Array>} editions (see groupContestsByEdition)
 */
export async function loadSharedTaskEditions() {
  try {
    const [sharedTasks, contests] = await Promise.all([
      fetchRows('shared_tasks', {
        select:
          'shared_task_id,name,organizer,year,description,status,' +
          'default_authorization_model,default_intake_daily_limit',
        order: 'year.desc',
      }),
      fetchRows('contests', {
        select: 'id,name,description,language_pair,status,shared_task_id',
        shared_task_id: 'not.is.null',
        visibility: 'eq.public',
        order: 'language_pair.asc',
      }),
    ]);
    const editions = groupContestsByEdition(sharedTasks, contests);
    console.log(
      `[sharedTaskLoader] Loaded ${editions.length} shared-task editions ` +
        `(${editions.reduce((n, e) => n + e.contests.length, 0)} per-pair contests)`,
    );
    return editions;
  } catch (err) {
    console.warn('[sharedTaskLoader] Failed to fetch shared tasks:', err.message);
    return [];
  }
}

/** Display helper: "es>agr" → "ES → AGR" (same convention as arena.js). */
export function formatPair(pair) {
  return (pair || '?').replace('>', ' → ').toUpperCase();
}
