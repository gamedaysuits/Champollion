/**
 * sharedTaskLoader.js
 * ─────────────────────────────────────────────────────────────────
 * Distills shared-task EDITIONS for the /shared-tasks page: a
 * multi-pair shared task (e.g. AmericasNLP: Spanish → many
 * Indigenous languages) is one `shared_tasks` row grouping N
 * per-pair `contests` rows via contests.shared_task_id, so one
 * edition renders as ONE page instead of N disconnected contests.
 *
 * Read-only anon-key fetches with graceful degradation (the same
 * pattern as contestLoader.js — the page renders an honest empty
 * state when the tables are unreachable):
 *
 *   shared_tasks — shared_task_id, name, organizer, year,
 *     description, status, default_authorization_model,
 *     default_intake_daily_limit
 *   shared_tasks (second request) — report_url,
 *     report_generated_at: the published edition report. These two
 *     columns are OPTIONAL: a database that has not been migrated
 *     yet does not have them, and PostgREST answers the whole
 *     request with an error rather than a null. They are therefore
 *     fetched SEPARATELY, so a missing column costs the report link
 *     and nothing else — never the edition list. A failure is logged
 *     with the database's own reason and no link is rendered; the
 *     page never invents a URL.
 *   contests — id, name, description, language_pair, status,
 *     shared_task_id, and the close stamp `metadata->>closed_at`,
 *     which is what "final ranking frozen <date>" reads. If the JSON
 *     selector is refused, the fetch retries with the plain columns
 *     and the freeze date is simply absent.
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

/** Columns every deployment has. */
const EDITION_SELECT =
  'shared_task_id,name,organizer,year,description,status,' +
  'default_authorization_model,default_intake_daily_limit';

/** Optional columns — absent until the edition-report migration is applied. */
const REPORT_SELECT = 'shared_task_id,report_url,report_generated_at';

const CONTEST_SELECT = 'id,name,description,language_pair,status,shared_task_id';

/** The close stamp lives inside contests.metadata, so it is read by path
 *  rather than by pulling the whole (potentially huge) metadata column —
 *  a frozen ranking snapshot lives in there too. */
const CONTEST_CLOSED_AT = 'closed_at:metadata->>closed_at';

/**
 * One PostgREST GET. Returns `{ rows, error }` — `error` carries the
 * database's own words so a caller can decide whether the failure is fatal
 * (the edition list) or merely costs a feature (the report link).
 */
async function fetchRowsDetailed(table, searchParams) {
  const url = new URL(`${SUPABASE_URL}/rest/v1/${table}`);
  for (const [k, v] of Object.entries(searchParams)) url.searchParams.set(k, v);
  try {
    const response = await fetch(url.toString(), { headers: HEADERS });
    if (!response.ok) {
      let detail = '';
      try {
        detail = (await response.text()).slice(0, 300);
      } catch {
        detail = '';
      }
      const error = `Supabase returned ${response.status}${detail ? `: ${detail}` : ''}`;
      console.warn(`[sharedTaskLoader] ${table}: ${error}`);
      return { rows: [], error };
    }
    const rows = await response.json();
    return { rows: Array.isArray(rows) ? rows : [], error: null };
  } catch (err) {
    const error = err && err.message ? err.message : String(err);
    console.warn(`[sharedTaskLoader] ${table}: ${error}`);
    return { rows: [], error };
  }
}

async function fetchRows(table, searchParams) {
  const { rows } = await fetchRowsDetailed(table, searchParams);
  return rows;
}

/**
 * Fold the optional report columns onto the edition rows by id.
 *
 * Pure and exported so the D4 tolerance is testable without a network: an
 * empty `reportRows` (the pre-migration case) leaves every edition exactly as
 * it was, with no report link — never a placeholder or a guessed URL.
 *
 * @param {Array} sharedTasks - raw shared_tasks rows (base columns)
 * @param {Array} reportRows - rows of { shared_task_id, report_url,
 *   report_generated_at }, or [] when the columns do not exist
 * @returns {Array} edition rows with the report columns merged in
 */
export function mergeReportLinks(sharedTasks, reportRows) {
  const byId = new Map();
  for (const row of reportRows || []) {
    if (row && row.shared_task_id) byId.set(row.shared_task_id, row);
  }
  return (sharedTasks || []).map((st) => {
    if (!st || !st.shared_task_id) return st;
    const report = byId.get(st.shared_task_id);
    if (!report) return st;
    return {
      ...st,
      report_url: report.report_url ?? null,
      report_generated_at: report.report_generated_at ?? null,
    };
  });
}

/**
 * Pure grouping: shared_tasks rows + contests rows → edition objects,
 * newest cycle first, each carrying its per-pair contests (open first,
 * then by language pair). Contests whose shared_task_id matches no
 * fetched edition are dropped (their umbrella isn't visible to us);
 * editions with zero contests still render — an announced edition is
 * real before its first pair is registered.
 *
 * `reportUrl` / `reportGeneratedAt` are null unless the row actually
 * carried them, and `closedAt` is null unless the contest recorded a close
 * stamp — the page renders neither when they are missing.
 *
 * @param {Array} sharedTasks - raw shared_tasks rows
 * @param {Array} contests - raw contests rows (attached ones)
 * @returns {Array} editions: { sharedTaskId, name, organizer, year,
 *   description, status, defaultAuthorizationModel,
 *   defaultIntakeDailyLimit, reportUrl, reportGeneratedAt, contests: [...] }
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
      reportUrl: st.report_url || null,
      reportGeneratedAt: st.report_generated_at || null,
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
      closedAt: contest.closed_at || null,
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
    const [sharedTasks, reports, contests] = await Promise.all([
      fetchRows('shared_tasks', {
        select: EDITION_SELECT,
        order: 'year.desc',
      }),
      // Optional columns, isolated on purpose (see the header note).
      fetchRowsDetailed('shared_tasks', { select: REPORT_SELECT }).then(
        ({ rows, error }) => {
          if (error) {
            console.warn(
              '[sharedTaskLoader] edition report links unavailable — no link ' +
                `will be shown. Reason: ${error}`,
            );
            return [];
          }
          return rows;
        },
      ),
      fetchRowsDetailed('contests', {
        select: `${CONTEST_SELECT},${CONTEST_CLOSED_AT}`,
        shared_task_id: 'not.is.null',
        visibility: 'eq.public',
        order: 'language_pair.asc',
      }).then(({ rows, error }) => {
        if (!error) return rows;
        console.warn(
          '[sharedTaskLoader] contests: the close-stamp selector was ' +
            `refused, retrying without it (no freeze date will be shown). ` +
            `Reason: ${error}`,
        );
        return fetchRows('contests', {
          select: CONTEST_SELECT,
          shared_task_id: 'not.is.null',
          visibility: 'eq.public',
          order: 'language_pair.asc',
        });
      }),
    ]);
    const editions = groupContestsByEdition(
      mergeReportLinks(sharedTasks, reports),
      contests,
    );
    console.log(
      `[sharedTaskLoader] Loaded ${editions.length} shared-task editions ` +
        `(${editions.reduce((n, e) => n + e.contests.length, 0)} per-pair contests, ` +
        `${editions.filter((e) => e.reportUrl).length} with a published report)`,
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

/**
 * Calendar date of a timestamp, or null when there isn't one / it doesn't
 * parse. Null means "say nothing" — never a fabricated or epoch date.
 */
export function formatStamp(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}
