/**
 * joinProjects — what /join reads (data contract from the rails trunk,
 * 2026-10-12: docs/JOIN_A_PROJECT_DESIGN_2026-10-12.md, migration
 * 079_registered_projects.sql).
 *
 * Public, anonymous reads only: listed projects and their open asks. Offers
 * are private to the helper and the owner and are never read here. The page
 * has three honest states and never a mock list:
 *   listed → the projects, as the owners described them
 *   empty  → "No projects are listed yet."
 *   closed → the read failed (until 079 is live the table does not exist):
 *            "Join a project opens with the next release."
 */

export const PROJECT_FIELDS = [
  'id', 'slug', 'display_name', 'owner_display', 'source_code', 'source_name',
  'target_code', 'target_name', 'purpose', 'domain', 'register', 'about', 'listed_at',
];
export const ASK_FIELDS = ['id', 'project_id', 'kind', 'what', 'how_many', 'terms'];
export const ASK_KINDS = ['sentences', 'word-list', 'method'];

export function projectsUrl(base) {
  return `${base}/rest/v1/projects?status=eq.listed&select=${PROJECT_FIELDS.join(',')}&order=listed_at.desc`;
}

export function asksUrl(base) {
  return `${base}/rest/v1/project_asks?status=eq.open&select=${ASK_FIELDS.join(',')}`;
}

/** A language as the people named it: the name they gave a language with no
 * code (qaa–qtz) first, then the site's name for the code, then the code. */
export function languageLabel(code, name, nameMap) {
  if (name) return name;
  if (!code) return '?';
  if (nameMap) {
    const n = typeof nameMap.get === 'function' ? nameMap.get(code) : nameMap[code];
    if (n) return n;
  }
  return code;
}

async function readRows(url, headers, fetchImpl) {
  const resp = await fetchImpl(url, {headers});
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const rows = await resp.json();
  if (!Array.isArray(rows)) throw new Error('not a list');
  return rows;
}

/**
 * Read the listed projects and their open asks. Never throws: a failed project
 * read is the `closed` state. A failed asks read still lists the projects,
 * with `asksUnavailable` set so the page can say so instead of implying the
 * projects ask for nothing.
 */
export async function loadJoin({base, anonKey, fetchImpl = fetch}) {
  const headers = {apikey: anonKey, Authorization: `Bearer ${anonKey}`, Accept: 'application/json'};
  let projects;
  try {
    projects = await readRows(projectsUrl(base), headers, fetchImpl);
  } catch (e) {
    return {state: 'closed', projects: [], asksUnavailable: false};
  }
  if (projects.length === 0) return {state: 'empty', projects: [], asksUnavailable: false};
  let asks = [];
  let asksUnavailable = false;
  try {
    asks = await readRows(asksUrl(base), headers, fetchImpl);
  } catch (e) {
    asksUnavailable = true;
  }
  const byProject = new Map();
  for (const a of asks) {
    if (!ASK_KINDS.includes(a.kind)) continue; // an unknown kind is not shown as if it were one we know
    if (!byProject.has(a.project_id)) byProject.set(a.project_id, []);
    byProject.get(a.project_id).push(a);
  }
  return {
    state: 'listed',
    projects: projects.map((p) => ({...p, asks: byProject.get(p.id) || []})),
    asksUnavailable,
  };
}
