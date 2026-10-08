/**
 * model-defaults.js — the ONE place a default model comes from.
 *
 * WHY: the toolset's defaults were ten hand-written ids in seven files across
 * five components (CLI, its three direct providers, the harness, forge, the
 * MCP server, the site docent). Nothing kept them in step, so they drifted —
 * the docent still named an undated `claude-haiku-4-5` after every other
 * default had been made exact (founder, 2026-10-07: "we're gonna be getting
 * our wires crossed no matter what doing it that way"). Every default now
 * reads shared/model-defaults.json (bundled here as shared/model-defaults.json).
 *
 * A default is an exact id, fixed in that file — never resolved at run time:
 * a run must say which model translated, and the translation memory is keyed
 * by model, so a default that moved by itself would re-bill every cached
 * string. What IS live is the check: `champollion models check` reads each
 * provider's current list, fails when a pinned id is gone, and names the
 * newest model each role's rule matches today.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.join(__dirname, '..', 'shared', 'model-defaults.json');

let _data = null;

/** The parsed file. Missing or malformed is a broken install: fail loud. */
export function modelDefaultsData() {
  if (_data) return _data;
  let raw;
  try {
    raw = fs.readFileSync(FILE, 'utf-8');
  } catch (err) {
    throw new Error(`${FILE} is missing (${err.code || err.message}): it names every default model. Reinstall champollion.`);
  }
  const data = JSON.parse(raw);
  if (!data || typeof data.roles !== 'object') throw new Error(`${FILE} has no "roles" — it is not a model-defaults file.`);
  _data = data;
  return data;
}

/**
 * The exact default model id for a role ("translate", "openai", "gemini",
 * "anthropic", "harness", "docent"). Unknown role: a programming error.
 *
 * @param {string} role
 * @returns {string}
 */
export function defaultModel(role) {
  const r = modelDefaultsData().roles[role];
  if (!r || typeof r.model !== 'string' || !r.model) throw new Error(`model-defaults.json has no "${role}" role.`);
  return r.model;
}

/** Version string → comparable number array ("4-6" / "4.6" → [4, 6]). */
function versionKey(v) {
  return String(v || '0').split(/[.-]/).map((n) => Number(n) || 0);
}

function compareIds(a, b) {
  const [va, vb] = [versionKey(a.v), versionKey(b.v)];
  for (let i = 0; i < Math.max(va.length, vb.length); i++) {
    if ((va[i] || 0) !== (vb[i] || 0)) return (va[i] || 0) - (vb[i] || 0);
  }
  return String(a.date || '').localeCompare(String(b.date || ''));
}

/**
 * The newest id in a provider's live list that a role's rule matches, or null.
 *
 * @param {object} role - A roles[] entry ({ rule: { match } })
 * @param {string[]} ids - The provider's live model ids
 * @returns {string|null}
 */
export function ruleCandidate(role, ids) {
  const re = new RegExp(role.rule.match);
  const hits = [];
  for (const id of ids || []) {
    const m = re.exec(id);
    if (m) hits.push({ id, v: m.groups?.v, date: m.groups?.date });
  }
  if (hits.length === 0) return null;
  hits.sort(compareIds);
  return hits[hits.length - 1].id;
}

/**
 * Check every role against live lists.
 *
 * @param {Record<string, string[]|null>} lists - provider → live ids (null = could not be read)
 * @returns {Array<{ role: string, provider: string, model: string, status: 'ok'|'newer'|'gone'|'unchecked', candidate: string|null, note: string }>}
 */
export function checkModelDefaults(lists) {
  const out = [];
  for (const [name, role] of Object.entries(modelDefaultsData().roles)) {
    const ids = lists[role.provider];
    if (!ids) {
      out.push({ role: name, provider: role.provider, model: role.model, status: 'unchecked', candidate: null, note: `${role.provider}'s model list could not be read` });
      continue;
    }
    const candidate = ruleCandidate(role, ids);
    if (!ids.includes(role.model)) {
      out.push({ role: name, provider: role.provider, model: role.model, status: 'gone', candidate, note: `${role.model} is no longer in ${role.provider}'s list${candidate ? ` — the rule's model today: ${candidate}` : ''}` });
    } else if (candidate && candidate !== role.model) {
      out.push({ role: name, provider: role.provider, model: role.model, status: 'newer', candidate, note: `a newer model matches the rule: ${candidate}` });
    } else {
      out.push({ role: name, provider: role.provider, model: role.model, status: 'ok', candidate, note: 'listed' });
    }
  }
  return out;
}
