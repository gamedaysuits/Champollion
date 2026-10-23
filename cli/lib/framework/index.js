/**
 * The framework's documents, read the same way in every tool (on rails).
 *
 * A project on the rails is a folder of plain files every tool reads natively
 * — no bridge code between tools. This module is the CLI's ONE reader for
 * them; the harness's twin is arena/mt_eval_harness/framework/__init__.py.
 * Both validate against shared/schemas/framework/ (bundled here by
 * `npm run sync:shared`) with validators that give identical messages, held
 * to shared/test-fixtures/framework/ — so the CLI and the harness can never
 * judge one document differently.
 *
 * Two document types so far, each added when a command first needs it:
 *   - project/1 — champollion.project.json at a project's root: decisions
 *     only (kind, name, pair, purpose, defaults).
 *   - set/1 — <file>.champollion.json beside any data file: role, kind, terms
 *     (training allowed or not, owner, consent record) and where the text may
 *     go. A sidecar written before set/1 has no $schema and is read as set/0:
 *     its fields are checked, and a key set/1 would not know is a WARNING (old
 *     sidecars must keep working), never a silent pass.
 *
 * Every message is content-free: it names keys and values of the document,
 * never a sentence from a data file.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validate } from '../mini-schema.mjs';
import { readMethod } from './method.js';

export const PROJECT_FILE = 'champollion.project.json';
export const SIDECAR_SUFFIX = '.champollion.json';

export const SCHEMA_IDS = Object.freeze({
  project: 'https://champollion.dev/schemas/project/1.json',
  set: 'https://champollion.dev/schemas/set/1.json',
  'gate-chain': 'https://champollion.dev/schemas/gate-chain/1.json',
  deployment: 'https://champollion.dev/schemas/deployment/1.json',
});
const SCHEMA_FILES = Object.freeze({
  project: 'project.v1.schema.json',
  set: 'set.v1.schema.json',
  'gate-chain': 'gate-chain.v1.schema.json',
  deployment: 'deployment.v1.schema.json',
});
/** the folders a project keeps these in, one document per .json file */
const FOLDER_TYPES = Object.freeze([['gates', 'gate-chain'], ['deploy', 'deployment']]);
/** project kinds that translate a pair, so must name it */
const PAIRED_KINDS = ['language', 'task', 'service'];

/** Folders never searched for sidecars (mirrors lib/local-only-marks.js). */
const SKIP_DIRS = new Set([
  'node_modules', '.git', '.hg', '.svn', '.champollion', '.venv', 'venv',
  '__pycache__', '.next', '.nuxt', '.svelte-kit', '.turbo', '.cache',
  '.pytest_cache', '.mypy_cache', '.tox',
]);

const SCHEMA_DIR = fileURLToPath(new URL('../../shared/schemas/framework/', import.meta.url));
const schemaCache = new Map();

/** The parsed schema for a document type ('project', 'set'). */
export function schemaFor(typeName) {
  if (!(typeName in SCHEMA_FILES)) {
    throw new Error(`unknown framework document type '${typeName}' `
      + `(known: ${Object.keys(SCHEMA_FILES).sort().join(', ')})`);
  }
  if (!schemaCache.has(typeName)) {
    const file = path.join(SCHEMA_DIR, SCHEMA_FILES[typeName]);
    let text;
    try {
      text = fs.readFileSync(file, 'utf-8');
    } catch (e) {
      throw new Error(`${file} is missing (${e.code || e.message}); `
        + 'reinstall champollion from a tagged release.');
    }
    schemaCache.set(typeName, JSON.parse(text));
  }
  return schemaCache.get(typeName);
}

/**
 * Validate one parsed document.
 * @returns {{type: string, version: number|null, errors: string[], warnings: string[]}}
 *   version 1 for a document carrying the project/1 or set/1 $schema, 0 for a
 *   sidecar written before set/1. errors = not valid; warnings = valid, but
 *   something should change.
 */
export function checkDocument(doc, typeName) {
  const schema = schemaFor(typeName);
  if (doc === null || typeof doc !== 'object' || Array.isArray(doc)) {
    return { type: typeName, version: null,
      errors: validate(doc, { type: 'object' }).errors, warnings: [] };
  }
  const declared = doc.$schema;
  const version = declared === SCHEMA_IDS[typeName] ? 1
    : (declared === undefined && typeName === 'set' ? 0 : null);
  const errors = [];
  const warnings = [];
  const prefix = "$: unexpected property '";
  for (const err of validate(doc, schema).errors) {
    if (version === 0 && err.startsWith(prefix)) {
      const key = err.slice(prefix.length, -1);
      warnings.push(`$: unknown key '${key}' — kept (this sidecar predates set/1), `
        + `but set/1 refuses it: rename it 'x-${key}' or remove it`);
    } else {
      errors.push(err);
    }
  }
  if (typeName === 'project' && PAIRED_KINDS.includes(doc.kind) && !('pair' in doc)) {
    errors.push(`$: a ${doc.kind} project must name its pair (pair.source and pair.target)`);
  }
  if (typeName === 'gate-chain' && errors.length === 0) errors.push(...gateChainRules(doc));
  return { type: typeName, version, errors, warnings };
}

/** What gate-chain/1's schema cannot say (the Python twin says it the same). */
function gateChainRules(doc) {
  const errors = [];
  const ids = doc.gates.map((g) => g.id);
  doc.gates.forEach((gate, i) => {
    if (!('min' in gate) && !('max' in gate)) {
      errors.push(`$.gates[${i}]: a metric-threshold gate needs min and/or max`);
    }
    if (ids.filter((id) => id === gate.id).length > 1) {
      errors.push(`$.gates[${i}]: gate id '${gate.id}' appears twice`);
    }
    if (gate.on_refuse === 'fallback' && !doc.fallback) {
      errors.push(`$.gates[${i}]: on_refuse fallback needs the chain's fallback `
        + '("fallback": {"method": "lexicon", "model": "<dictionary>"})');
    }
  });
  return errors;
}

/**
 * A sidecar as set/1, losing nothing: `$schema` added, every value kept, a
 * key set/1 does not know moved under `x-<key>` (never dropped). What every
 * writer of a sidecar uses, and `champollion upgrade`.
 * @returns {{doc: object, renamed: string[], errors: string[]}}
 */
export function upgradeSet(existing) {
  const doc = { ...(existing || {}), $schema: SCHEMA_IDS.set };
  const renamed = [];
  const prefix = "$: unexpected property '";
  let checked = checkDocument(doc, 'set');
  for (const err of checked.errors) {
    if (err.startsWith(prefix)) {
      const key = err.slice(prefix.length, -1);
      let to = `x-${key}`;
      while (to in doc) to = `${to}-0`;   // an x- key of that name exists: keep both
      doc[to] = doc[key];
      delete doc[key];
      renamed.push(key);
    }
  }
  if (renamed.length) checked = checkDocument(doc, 'set');
  return { doc, renamed, errors: checked.errors };
}

/**
 * The set sidecar beside `dataPath`, read and checked. An unreadable sidecar
 * is an ERROR, never skipped: a steward wrote it to restrict the data, and a
 * typo must not make the data unrestricted.
 */
export function readSet(dataPath) {
  const side = dataPath + SIDECAR_SUFFIX;
  const out = { path: side, exists: fs.existsSync(side), version: null,
    data: null, errors: [], warnings: [] };
  if (!out.exists) return out;
  let data;
  try {
    data = JSON.parse(fs.readFileSync(side, 'utf-8'));
  } catch (e) {
    const kind = e instanceof SyntaxError ? 'JSONDecodeError' : 'OSError';
    out.errors.push(`$: not readable as JSON (${kind}) — fix the file; it states how this data may be used`);
    return out;
  }
  const checked = checkDocument(data, 'set');
  return { ...out, version: checked.version, data, errors: checked.errors,
    warnings: checked.warnings };
}

export function* sidecars(root, dir = root) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (!SKIP_DIRS.has(ent.name)) yield* sidecars(root, full);
    } else if (ent.isFile() && ent.name.endsWith(SIDECAR_SUFFIX) && ent.name !== PROJECT_FILE) {
      yield full;
    }
  }
}

/**
 * Check a project folder: its champollion.project.json (if any) and every
 * data sidecar under it.
 * @returns {{root: string, project: object, sets: object[], ok: boolean}}
 */
export function checkProject(root) {
  const pfile = path.join(root, PROJECT_FILE);
  const project = { path: pfile, exists: fs.existsSync(pfile), type: 'project',
    version: null, errors: [], warnings: [] };
  if (project.exists) {
    let doc;
    try {
      doc = JSON.parse(fs.readFileSync(pfile, 'utf-8'));
    } catch (e) {
      const kind = e instanceof SyntaxError ? 'JSONDecodeError' : 'OSError';
      project.errors.push(`$: not readable as JSON (${kind})`);
    }
    if (doc !== undefined) Object.assign(project, checkDocument(doc, 'project'));
  }
  const sets = [];
  for (const side of sidecars(root)) {
    const dataFile = side.slice(0, -SIDECAR_SUFFIX.length);
    const entry = readSet(dataFile);
    delete entry.data; // the report never carries sidecar values
    sets.push({ ...entry, data_file: path.relative(root, dataFile).split(path.sep).join('/') });
  }
  // one order in both runtimes (the Python twin sorts the same way)
  sets.sort((a, b) => (a.data_file < b.data_file ? -1 : a.data_file > b.data_file ? 1 : 0));
  const methods = methodFiles(root).map((f) => {
    const entry = readMethod(f);
    delete entry.data;
    delete entry.dir;
    return { ...entry, file: path.relative(root, f).split(path.sep).join('/') };
  });
  const documents = folderDocuments(root);
  const ok = project.errors.length === 0 && sets.every((s) => s.errors.length === 0)
    && methods.every((m) => m.errors.length === 0)
    && documents.every((d) => d.errors.length === 0);
  return { root, project, sets, methods, documents, ok };
}

/**
 * The gate chains (gates/*.json) and deployments (deploy/*.json) a project
 * holds, each checked: {file, type, version, errors, warnings}, sorted by
 * path (as the Python twin). An unreadable one is an error, never skipped.
 */
export function folderDocuments(root) {
  const out = [];
  for (const [folder, typeName] of FOLDER_TYPES) {
    let entries = [];
    try {
      entries = fs.readdirSync(path.join(root, folder), { withFileTypes: true });
    } catch { /* none */ }
    for (const ent of entries) {
      if (!ent.isFile() || !ent.name.endsWith('.json') || ent.name.endsWith(SIDECAR_SUFFIX)) continue;
      const file = `${folder}/${ent.name}`;
      const entry = { file, type: typeName, version: null, errors: [], warnings: [] };
      let doc;
      try {
        doc = JSON.parse(fs.readFileSync(path.join(root, folder, ent.name), 'utf-8'));
      } catch (e) {
        const kind = e instanceof SyntaxError ? 'JSONDecodeError' : 'OSError';
        entry.errors.push(`$: not readable as JSON (${kind})`);
      }
      out.push(doc === undefined ? entry : { ...entry, ...checkDocument(doc, typeName) });
    }
  }
  return out.sort((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : 0));
}

/**
 * The method.json files a project holds: at its root, under methods/ and
 * under .champollion/methods/ — sorted by their path (as the Python twin).
 */
export function methodFiles(root) {
  const found = [path.join(root, 'method.json')];
  for (const sub of ['methods', path.join('.champollion', 'methods')]) {
    let entries = [];
    try {
      entries = fs.readdirSync(path.join(root, sub), { withFileTypes: true });
    } catch { /* none */ }
    for (const ent of entries) {
      if (ent.isDirectory()) found.push(path.join(root, sub, ent.name, 'method.json'));
    }
  }
  const relOf = (f) => path.relative(root, f).split(path.sep).join('/');
  return found.filter((f) => fs.existsSync(f) && fs.statSync(f).isFile())
    .sort((a, b) => (relOf(a) < relOf(b) ? -1 : relOf(a) > relOf(b) ? 1 : 0));
}
