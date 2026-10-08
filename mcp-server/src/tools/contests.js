/**
 * Contest tools — READ-ONLY views of Champollion contests (list_contests,
 * get_contest).
 *
 * A contest is sovereign hosting (founder ruling 2026-09-06): an entry is a
 * method handed to the organizer's air-gapped node and run there on a sealed
 * set. Entering, submitting and ranking are human-authorized flows in the
 * `mt-eval contest …` CLI — never an MCP tool. These tools only READ what an
 * anonymous visitor may read, through the same public anon key and RLS the
 * website uses:
 *
 *   contests            public + private rows (team contests are hidden)
 *   contest_phases      public schedule (074)
 *   contest_submissions entries of PUBLIC contests — but its `submitted_by`
 *                       column is the entrant's sign-in email, so it is never
 *                       selected; only the display label is
 *   shared_tasks        public editions (047)
 *   contest_deferred_results  NO anon policy — withheld results are
 *                       invisible here by design, and the answer says so
 *
 * Every read is bounded (per-request timeout + an overall deadline), the
 * pattern the queue tools adopted after 0.1.0's timeouts. An empty answer
 * from RLS is reported as "nothing visible to an anonymous reader", never as
 * "nothing exists".
 */

import { createHash } from 'node:crypto';
import { count } from './plural.js';

const SUPABASE_URL =
  process.env.CHAMPOLLION_SUPABASE_URL || 'https://sjdomynysdljkbemupqa.supabase.co';
const SUPABASE_ANON_KEY =
  process.env.CHAMPOLLION_SUPABASE_ANON_KEY || 'sb_publishable_bV6CFNFnzxhQI0wlBx2J0A_5Vm5gFBp';

const REQUEST_TIMEOUT_MS = 15_000;
const DEADLINE_MS = 40_000;
const LIST_CAP = 200;

/**
 * Contest metadata keys that are PROMISES to participants, frozen by the
 * database once a contest has entries. MIRROR of
 * arena/mt_eval_harness/contest_policy.py FROZEN_PROMISE_KEYS (the Python
 * SSOT, itself parity-tested against migrations 074/076); test/contests.test.js
 * parses that file and fails if the two drift.
 */
export const FROZEN_PROMISE_KEYS = Object.freeze([
  'tie_test', 'alpha', 'n_resamples', 'seed', 'require_description',
  'prize_terms', 'test_suites', 'anonymize_until_close', 'results_visibility',
  'allowed_tracks', 'open_weight_only', 'sealed_holdout_set_id',
  'metric_signature', 'harness_version', 'declared_power',
]);

/** Contest columns an agent may see. `created_by` (an email) is never read. */
const CONTEST_SELECT = [
  'id', 'name', 'description', 'corpus_id', 'language_pair', 'visibility',
  'status', 'use_context', 'lane', 'metadata', 'created_at', 'shared_task_id',
  'intake_open',
].join(',');

/** Entry columns. `submitted_by` (the entrant's sign-in email) is never read. */
const ENTRY_SELECT = [
  'run_card_id', 'team', 'submitter_label', 'submitted_at', 'is_primary',
  'track', 'phase', 'method_release_url',
].join(',');

/** run_cards columns behind a contest's primary metric (aggregates only). */
const METRIC_COLUMN = {
  chrf_plus_plus: 'chrf_plus_plus',
  bleu: 'corpus_bleu',
  comet_score: 'comet_score',
  // A contest created before scoring standard/1 may still rank on it; it is
  // shown under its retired name, never as a quality verdict.
  composite: 'composite_score',
  ter: 'ter',
};

/**
 * Scoring standard/1: a contest's primary_metric defaults to chrF++, and a
 * contest ranking is shown under its metric's display name.
 */
export const DEFAULT_PRIMARY_METRIC = 'chrf_plus_plus';
export const METRIC_LABEL = {
  chrf_plus_plus: 'chrF++',
  bleu: 'BLEU',
  comet_score: 'COMET',
  ter: 'TER (lower is better)',
  composite: 'legacy composite (retired)',
};
const metricLabel = (m) => METRIC_LABEL[m] ?? m;

function headers() {
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    Accept: 'application/json',
  };
}

/** One bounded anon GET; throws a readable error (never a raw TypeError). */
async function getJson(fetchImpl, path, deadline) {
  const remaining = deadline - Date.now();
  if (remaining <= 0) throw new Error('contest read deadline exceeded');
  let resp;
  try {
    resp = await fetchImpl(`${SUPABASE_URL}/rest/v1/${path}`, {
      headers: headers(),
      signal: AbortSignal.timeout(Math.min(REQUEST_TIMEOUT_MS, remaining)),
    });
  } catch (err) {
    throw new Error(`could not reach the public contest tables (${err.name === 'TimeoutError' ? 'timed out' : err.message})`);
  }
  const text = await resp.text();
  if (!resp.ok) throw new Error(`HTTP ${resp.status} reading ${path.split('?')[0]}: ${text.slice(0, 160)}`);
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`${path.split('?')[0]} did not return JSON`);
  }
  if (!Array.isArray(data)) throw new Error(`${path.split('?')[0]} did not return a row list`);
  return data;
}

/** Keep only filter-safe characters in a user-supplied value (ids and slugs
 *  use letters, digits, `_ . : -`; pairs use `>`). Commas and parentheses —
 *  PostgREST list/grouping syntax — never survive. */
function clean(v) {
  return String(v ?? '').replace(/[^\w.:>-]/g, '').trim();
}

/** Does a contest's "src>tgt" pair involve `code` on either side? */
function pairInvolves(pair, code) {
  if (!code) return true;
  const sides = String(pair || '').toLowerCase().split('>').map((s) => s.trim());
  return sides.includes(code.toLowerCase());
}

/** A canonical-JSON SHA-256 of the contest's declared promises. */
export function promisesDigest(promises) {
  const canon = (v) => {
    if (Array.isArray(v)) return `[${v.map(canon).join(',')}]`;
    if (v && typeof v === 'object') {
      return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canon(v[k])}`).join(',')}}`;
    }
    return JSON.stringify(v);
  };
  return createHash('sha256').update(canon(promises)).digest('hex');
}

/** The promise block of a contest's metadata (+ its primary metric). */
export function extractPromises(metadata) {
  const md = metadata && typeof metadata === 'object' ? metadata : {};
  const declared = {};
  if (md.primary_metric !== undefined) declared.primary_metric = md.primary_metric;
  for (const k of FROZEN_PROMISE_KEYS) if (md[k] !== undefined) declared[k] = md[k];
  return declared;
}

/**
 * List contests visible to an anonymous reader.
 *
 * @param {object} [opts]
 * @param {'open'|'closed'|'archived'|'all'} [opts.status='all']
 * @param {string} [opts.language]  ISO 639-3 code on either side of the pair
 * @param {number} [opts.limit=20]
 * @param {Function} [opts.fetchImpl]
 */
export async function listContests({ status = 'all', language, limit = 20, fetchImpl = fetch } = {}) {
  const deadline = Date.now() + DEADLINE_MS;
  const q = new URLSearchParams({
    select: CONTEST_SELECT,
    order: 'created_at.desc',
    limit: String(LIST_CAP),
  });
  if (status && status !== 'all') q.set('status', `eq.${clean(status)}`);
  const [rows, tasks] = await Promise.all([
    getJson(fetchImpl, `contests?${q}`, deadline),
    getJson(fetchImpl, 'shared_tasks?select=shared_task_id,name,organizer,year,status,report_url&order=year.desc&limit=50', deadline)
      .catch((err) => ({ error: err.message })),
  ]);
  const code = language ? clean(language).toLowerCase() : null;
  const matching = rows.filter((r) => pairInvolves(r.language_pair, code));
  return {
    contests: matching.slice(0, limit).map((r) => ({
      id: r.id,
      name: r.name,
      pair: r.language_pair,
      status: r.status,
      lane: r.lane,
      useContext: r.use_context,
      visibility: r.visibility,
      intakeOpen: r.intake_open ?? null,
      // Undeclared ⇒ the default (chrF++), and the answer says it is the default.
      primaryMetric: r.metadata?.primary_metric ?? DEFAULT_PRIMARY_METRIC,
      primaryMetricDeclared: r.metadata?.primary_metric != null,
      resultsVisibility: r.metadata?.results_visibility ?? null,
      sharedTask: r.shared_task_id ?? null,
      createdAt: r.created_at ?? null,
    })),
    total: matching.length,
    scannedCap: rows.length >= LIST_CAP ? LIST_CAP : null,
    sharedTasks: Array.isArray(tasks) ? tasks : [],
    sharedTasksError: Array.isArray(tasks) ? null : tasks.error,
    filters: { status, language: code },
  };
}

/**
 * One contest: phases, declared promises (+ digest), visibility rules, and
 * the public ranking when the contest has made one visible.
 */
export async function getContest(id, { fetchImpl = fetch, now = Date.now() } = {}) {
  const deadline = Date.now() + DEADLINE_MS;
  const cid = clean(id);
  if (!cid) return { status: 'bad-request', note: 'Pass a contest id (from list_contests).' };

  const rows = await getJson(fetchImpl,
    `contests?select=${CONTEST_SELECT}&id=eq.${encodeURIComponent(cid)}&limit=1`, deadline);
  if (rows.length === 0) {
    return {
      status: 'not-visible',
      note: `No contest "${cid}" is visible to an anonymous reader. Either it `
        + 'does not exist, or it is a TEAM contest (team contests are not '
        + 'anon-readable — sign in with `mt-eval auth login` and use '
        + '`mt-eval contest list` to see contests you belong to). Use '
        + 'list_contests to see every public contest.',
    };
  }
  const c = rows[0];
  const md = c.metadata && typeof c.metadata === 'object' ? c.metadata : {};

  const enc = encodeURIComponent(cid);
  const [phases, entries, task] = await Promise.all([
    getJson(fetchImpl,
      `contest_phases?select=name,starts_at,ends_at,max_submissions,max_submissions_per_day&contest_id=eq.${enc}&order=starts_at.asc`,
      deadline).catch((err) => ({ error: err.message })),
    getJson(fetchImpl,
      `contest_submissions?select=${ENTRY_SELECT}&contest_id=eq.${enc}&order=submitted_at.asc&limit=500`,
      deadline).catch((err) => ({ error: err.message })),
    c.shared_task_id
      ? getJson(fetchImpl,
        `shared_tasks?select=shared_task_id,name,organizer,year,status,report_url,report_generated_at&shared_task_id=eq.${encodeURIComponent(c.shared_task_id)}&limit=1`,
        deadline).then((r) => r[0] ?? null).catch(() => null)
      : Promise.resolve(null),
  ]);

  const promises = extractPromises(md);
  const resultsVisibility = md.results_visibility ?? null;
  const closed = c.status === 'closed' || c.status === 'archived';
  const anonymize = md.anonymize_until_close === true && !closed;

  // Phases: which window covers `now` (computed here from the public schedule;
  // the database's contest_active_phase() is the authority at submission time).
  const phaseList = Array.isArray(phases) ? phases.map((p) => {
    const s = Date.parse(p.starts_at);
    const e = Date.parse(p.ends_at);
    return {
      name: p.name, startsAt: p.starts_at, endsAt: p.ends_at,
      maxSubmissions: p.max_submissions ?? null,
      maxPerDay: p.max_submissions_per_day ?? null,
      active: Number.isFinite(s) && Number.isFinite(e) && now >= s && now < e,
    };
  }) : [];

  const entryList = Array.isArray(entries) ? entries : [];
  let ranking = null;
  let rankingNote;
  if (closed && md.final_ranking && typeof md.final_ranking === 'object') {
    const fr = md.final_ranking;
    ranking = {
      kind: 'final',
      metric: fr.metric ?? md.primary_metric ?? null,
      method: fr.ranking_method ?? null,
      entries: (Array.isArray(fr.entries) ? fr.entries : []).map((e) => ({
        rank: e.rank ?? null,
        tieGroup: e.tie_group ?? null,
        // contest_rank's entry shape: submitter_label (never an email),
        // else the per-contest pseudonym, else the team.
        label: e.submitter_label ?? e.pseudonym ?? e.team ?? null,
        model: e.model_slug ?? null,
        score: e.primary?.value ?? null,
        ci: e.primary && (e.primary.ci_lower != null || e.primary.ci_upper != null)
          ? [e.primary.ci_lower ?? null, e.primary.ci_upper ?? null] : null,
        runCardId: e.run_card_id ?? null,
        primary: e.is_primary ?? null,
        track: e.track ?? null,
      })),
    };
    rankingNote = 'The FINAL ranking, frozen by the database at close (tie groups come from the declared significance test).';
  } else if (closed) {
    rankingNote = 'The contest is closed but carries no final_ranking — nothing official to show.';
  } else if (resultsVisibility === 'hidden_until_close') {
    rankingNote = 'Results are HIDDEN until close (results_visibility = hidden_until_close). '
      + 'Scored entries wait in contest_deferred_results, which has no anonymous read '
      + 'policy — nobody outside the organizer sees a score before the contest closes.';
  } else if (entryList.length) {
    // Interim view: the entries' published aggregate scores. NOT a ranking —
    // no tie test, no trust policy; the official ranking is frozen at close.
    const metric = md.primary_metric ?? DEFAULT_PRIMARY_METRIC;
    const col = METRIC_COLUMN[metric];
    // chrF++ travels with its 95% CI (scoring standard/1).
    const ciCols = col === 'chrf_plus_plus' ? ',chrf_ci_lower,chrf_ci_upper' : '';
    const ids = entryList.map((e) => clean(e.run_card_id)).filter(Boolean);
    let cards = [];
    if (col && ids.length) {
      try {
        cards = await getJson(fetchImpl,
          `run_cards?select=id,model_slug,trust,${col}${ciCols}&id=in.(${ids.map(encodeURIComponent).join(',')})&trust=neq.disqualified`,
          deadline);
      } catch (err) {
        rankingNote = `Interim scores unavailable (${err.message}).`;
      }
    }
    const byId = new Map(cards.map((r) => [r.id, r]));
    ranking = {
      kind: 'interim',
      metric,
      entries: entryList.map((e) => {
        const card = byId.get(e.run_card_id);
        return {
          rank: null,
          label: anonymize ? null : (e.submitter_label ?? e.team ?? null),
          model: card?.model_slug ?? null,
          score: col && card ? (card[col] ?? null) : null,
          ci: ciCols && card && card.chrf_ci_lower != null && card.chrf_ci_upper != null
            ? [card.chrf_ci_lower, card.chrf_ci_upper] : null,
          runCardId: e.run_card_id,
          primary: e.is_primary ?? null,
          track: e.track ?? null,
          trust: card?.trust ?? null,
        };
      }),
    };
    rankingNote = rankingNote ?? ('INTERIM scores of the published entries — not a ranking (no tie test, '
      + 'no trust policy applied). The official ranking is computed and frozen at close by '
      + '`mt-eval contest close`.'
      + (col ? '' : ` The primary metric "${metric}" is not a run_cards column, so scores are omitted.`)
      + (anonymize ? ' Entrant labels are hidden until close (anonymize_until_close).' : ''));
  } else {
    rankingNote = 'No entries are visible yet.';
  }

  return {
    status: 'ok',
    contest: {
      id: c.id,
      name: c.name,
      description: c.description || '',
      pair: c.language_pair,
      corpusId: c.corpus_id,
      status: c.status,
      lane: c.lane,
      useContext: c.use_context,
      visibility: c.visibility,
      intakeOpen: c.intake_open ?? null,
      createdAt: c.created_at,
      closedAt: md.closed_at ?? null,
    },
    sharedTask: task,
    phases: phaseList,
    phasesError: Array.isArray(phases) ? null : phases.error,
    promises,
    promisesDigest: Object.keys(promises).length ? promisesDigest(promises) : null,
    resultsVisibility,
    entryCount: entryList.length,
    entriesError: Array.isArray(entries) ? null : entries.error,
    ranking,
    rankingNote,
  };
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

const ENTRY_DOCS = 'https://champollion.dev/docs/network/sovereignty/run-a-sovereign-contest';

/** Text for a listContests() answer. */
export function formatContestList(r) {
  const scope = [r.filters.status !== 'all' && `status ${r.filters.status}`, r.filters.language && `language ${r.filters.language}`]
    .filter(Boolean).join(', ');
  const out = [];
  if (r.total === 0) {
    out.push(`No contests${scope ? ` (${scope})` : ''} are visible to an anonymous reader.`);
    out.push('That covers public and private contests; team contests are never anon-readable. '
      + 'An empty list is the honest state of the public network, not an error.');
  } else {
    out.push(`${count(r.total, 'contest')}${scope ? ` for ${scope}` : ''} visible to an anonymous reader`
      + `${r.scannedCap ? ` (first ${r.scannedCap} scanned)` : ''}:`);
    for (const c of r.contests) {
      out.push(`  ${c.id} — ${c.name}  [${c.pair}] status ${c.status}, ${c.lane} lane, ${c.useContext}`
        + `, ranks on ${metricLabel(c.primaryMetric)}${c.primaryMetricDeclared ? '' : ' (the default; none declared)'}`
        + `${c.resultsVisibility === 'hidden_until_close' ? ', results hidden until close' : ''}`
        + `${c.intakeOpen === true ? ', intake OPEN' : c.intakeOpen === false ? ', intake closed' : ''}`);
    }
    if (r.total > r.contests.length) out.push(`  … showing ${r.contests.length} of ${r.total} (raise limit)`);
  }
  if (r.sharedTasks.length) {
    out.push('');
    out.push('Shared-task editions:');
    for (const t of r.sharedTasks) {
      out.push(`  ${t.shared_task_id} — ${t.name} (${t.organizer}, ${t.year}) ${t.status}${t.report_url ? ` · report ${t.report_url}` : ''}`);
    }
  } else if (r.sharedTasksError) {
    out.push(`(shared-task editions unavailable: ${r.sharedTasksError})`);
  }
  out.push('');
  out.push('Next: get_contest { "id": "<id>" } for phases, declared terms and results. '
    + `Entering is a human-authorized CLI flow (\`mt-eval contest qualify\`, then submit-model / submit-method) — ${ENTRY_DOCS}`);
  return out.join('\n');
}

/** Text for a getContest() answer. */
export function formatContest(r) {
  if (r.status !== 'ok') return r.note;
  const c = r.contest;
  const out = [];
  out.push(`# ${c.name} (${c.id})`);
  out.push(`Pair ${c.pair} · corpus ${c.corpusId} · status ${c.status} · ${c.lane} lane · ${c.useContext} · ${c.visibility}`
    + `${c.intakeOpen === true ? ' · intake OPEN' : c.intakeOpen === false ? ' · intake closed' : ''}`);
  if (c.description) out.push(c.description.slice(0, 600));
  if (r.sharedTask) {
    out.push(`Shared task: ${r.sharedTask.name} (${r.sharedTask.organizer}, ${r.sharedTask.year})`
      + `${r.sharedTask.report_url ? ` — report ${r.sharedTask.report_url}` : ''}`);
  }
  out.push('');
  if (r.phases.length) {
    out.push('Phases (the deadline is enforced by the database at the method door):');
    for (const p of r.phases) {
      const caps = [p.maxSubmissions != null && `max ${p.maxSubmissions}`, p.maxPerDay != null && `${p.maxPerDay}/day`]
        .filter(Boolean).join(', ');
      out.push(`  ${p.active ? '▶' : ' '} ${p.name}: ${p.startsAt} → ${p.endsAt}${caps ? ` (${caps})` : ''}`);
    }
  } else if (r.phasesError) {
    out.push(`Phases: unavailable (${r.phasesError})`);
  } else {
    out.push('Phases: none declared (an un-phased contest uses the sealed set\'s daily request limit).');
  }
  out.push('');
  const keys = Object.keys(r.promises);
  if (keys.length) {
    out.push('Declared terms (PROMISES — frozen by the database once the contest has entries):');
    for (const k of keys) {
      const v = r.promises[k];
      out.push(`  ${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`.slice(0, 400));
    }
    out.push(`  terms digest: sha256 ${r.promisesDigest} — computed here over the canonical JSON of the keys above (not a value stored by the database); re-read and compare to detect a change.`);
  } else {
    out.push('Declared terms: none recorded on this contest.');
  }
  out.push(`Results visibility: ${r.resultsVisibility ?? 'not declared — read as "immediate" (a contest that recorded no value promised no withholding)'}`);
  out.push('');
  out.push(`Entries visible to an anonymous reader: ${r.entryCount}${r.entriesError ? ` (could not read entries: ${r.entriesError})` : ''}`);
  out.push(r.rankingNote);
  if (r.ranking && r.ranking.entries.length) {
    for (const e of r.ranking.entries.slice(0, 50)) {
      const bits = [
        r.ranking.kind === 'final' ? `#${e.rank ?? '?'}${e.tieGroup != null ? ` (tie group ${e.tieGroup})` : ''}` : '•',
        e.label ?? (r.ranking.kind === 'interim' ? '(label hidden or unset)' : '(no label)'),
        e.model,
        // "chrF++ 47.5 [45.9, 49.0]" — the metric by name, the CI beside it.
        e.score != null ? `${metricLabel(r.ranking.metric)} ${e.score}${e.ci ? ` [${e.ci[0] ?? '?'}, ${e.ci[1] ?? '?'}]` : ''}` : null,
        e.primary === false ? 'contrastive' : null,
        e.track,
        e.trust ? `trust ${e.trust}` : null,
        e.runCardId ? `run ${e.runCardId}` : null,
      ].filter(Boolean);
      out.push(`  ${bits.join('  ')}`);
    }
  }
  out.push('');
  out.push(`Entering: human-authorized CLI only (\`mt-eval contest qualify\` → submit-model / submit-method). ${ENTRY_DOCS}`);
  return out.join('\n');
}
