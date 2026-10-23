/**
 * method/1 — one translation method, as every tool reads it (on rails).
 *
 * Before method/1, three unrelated documents were all called method.json:
 * the CLI's plugin manifest (`type`, `locales`, `config`), the harness's
 * plugin manifest (`entry_point` and card fields) and forge's export (a CLI
 * manifest pointing at its server). This module reads all of them as one
 * shape: a method/1 document as it is, an older one as method/0 — converted
 * to the method/1 view with a warning, keeping the original under `x-v0` so
 * nothing is lost. The conversion is DATA (shared/schemas/framework/
 * method.v0-map.json); the harness's twin is
 * arena/mt_eval_harness/framework/method.py, and both are held to
 * shared/test-fixtures/framework/method-vectors.json — one document, one
 * reading, in both runtimes.
 *
 * Kind-specific settings (engine, model, model_dir, dictionary, entry_point,
 * service.endpoint) are required here, not in the schema: an error in a
 * method/1 document, a warning in an old one (old documents keep working).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validate } from '../mini-schema.mjs';

export const METHOD_SCHEMA_ID = 'https://champollion.dev/schemas/method/1.json';
export const METHOD_FILE = 'method.json';

const DIR = fileURLToPath(new URL('../../shared/schemas/framework/', import.meta.url));
let loaded = null;

function load() {
  if (!loaded) {
    const read = (name) => {
      try {
        return JSON.parse(fs.readFileSync(path.join(DIR, name), 'utf-8'));
      } catch (e) {
        throw new Error(`${path.join(DIR, name)} is missing or unreadable (${e.code || e.message}); `
          + 'reinstall champollion from a tagged release.');
      }
    };
    loaded = { schema: read('method.v1.schema.json'), map: read('method.v0-map.json') };
  }
  return loaded;
}

const ID_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const CODE = '[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*';
const CODE_RE = new RegExp(`^${CODE}$`);
const PAIR_RE = new RegExp(`^(${CODE})>(${CODE})$`);
const SEMVER_RE = /^[0-9]+\.[0-9]+\.[0-9]+([-+][0-9A-Za-z.-]+)?$/;

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
/** own keys only: "constructor" or "__proto__" must not read Object.prototype */
const own = (o, k) => typeof k === 'string' && Object.prototype.hasOwnProperty.call(o, k);
const isStr = (v) => typeof v === 'string' && v.trim() !== '';

/** A method id from a name: lowercase words joined by hyphens. */
export function slugId(name) {
  const s = String(name ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return s || 'method';
}

function lookup(doc, dotted) {
  return dotted.split('.').reduce((o, k) => (isObj(o) ? o[k] : undefined), doc);
}

/** The one setting a kind must name, as a message, or [] when it is there. */
export function kindRequirement(doc) {
  const reqs = load().map.kind_requires;
  const need = isObj(doc) && own(reqs, doc.kind) ? reqs[doc.kind] : null;
  if (!need || isStr(lookup(doc, need))) return [];
  return [`$: kind ${doc.kind} must name its ${need}`];
}

/** Check a method/1 document: the schema, then the kind's one setting. */
export function checkMethod(doc) {
  if (!isObj(doc)) {
    return { version: null, errors: validate(doc, { type: 'object' }).errors, warnings: [] };
  }
  const errors = validate(doc, load().schema).errors;
  return { version: doc.$schema === METHOD_SCHEMA_ID ? 1 : null,
    errors: [...errors, ...kindRequirement(doc)], warnings: [] };
}

/**
 * An old method.json (no $schema) as a method/1 view.
 * @returns {{version: 0|null, data: object|null, shape: string|null, errors: string[], warnings: string[]}}
 */
export function methodFromV0(doc) {
  const { map } = load();
  const hasType = 'type' in doc;
  const hasEntry = 'entry_point' in doc;
  if (hasType && hasEntry) {
    return { version: null, data: null, shape: null, warnings: [], errors: [
      '$: has both type (a CLI plugin manifest) and entry_point (a harness plugin manifest) — keep one'] };
  }
  if (!hasType && !hasEntry) {
    return { version: null, data: null, shape: null, warnings: [], errors: [
      '$: not a method document: no $schema (method/1), no type (a CLI plugin manifest) '
      + 'and no entry_point (a harness plugin manifest)'] };
  }
  const shape = hasType ? 'cli-plugin' : 'harness-plugin';
  const errors = [];
  const warnings = [`$: this method.json predates method/1 (${hasType ? 'a CLI plugin manifest'
    : 'a harness plugin manifest'}) and is read as method/0`];
  const view = { $schema: METHOD_SCHEMA_ID,
    id: isStr(doc.method_id) && ID_RE.test(doc.method_id) ? doc.method_id : slugId(doc.name) };
  if (doc.name !== undefined) view.name = doc.name;
  if (typeof doc.version === 'string') {
    if (SEMVER_RE.test(doc.version)) view.version = doc.version;
    else warnings.push(`$.version: ${JSON.stringify(doc.version)} is not semver — left out`);
  }
  for (const k of ['description', 'author']) if (typeof doc[k] === 'string') view[k] = doc[k];
  const pairs = [];

  if (hasType) {
    const m = own(map.cli_types, doc.type) ? map.cli_types[doc.type] : null;
    if (!m) {
      errors.push(`$.type: ${JSON.stringify(doc.type)} is not a method type `
        + `(known: ${Object.keys(map.cli_types).join(', ')})`);
    } else {
      Object.assign(view, m);
    }
    const cfg = isObj(doc.config) ? doc.config : {};
    if ((view.kind === 'llm' || view.kind === 'llm-coached') && isStr(cfg.model)) view.model = cfg.model;
    if (view.kind === 'llm-coached') {
      const coaching = {};
      if (isStr(cfg.coachingFile)) coaching.file = cfg.coachingFile;
      if (typeof cfg.coachingPrompt === 'string') coaching.prompt = cfg.coachingPrompt;
      // a bundled coaching folder (mt-eval export --coaching-dir)
      if (isObj(doc.coaching) && isStr(doc.coaching.dir)) coaching.dir = doc.coaching.dir;
      if (Object.keys(coaching).length) view.coaching = coaching;
    }
    if (view.kind === 'service') {
      const service = {};
      if (typeof doc.endpoint === 'string') service.endpoint = doc.endpoint;
      if (typeof doc.acceptsInstructions === 'boolean') service.accepts_instructions = doc.acceptsInstructions;
      if (Object.keys(service).length) view.service = service;
    }
    const decode = {};
    if (typeof cfg.temperature === 'number') decode.temperature = cfg.temperature;
    if (Number.isInteger(cfg.batchSize)) decode.batch_size = cfg.batchSize;
    if (Object.keys(decode).length) view.decode = decode;
    for (const loc of Array.isArray(doc.locales) ? doc.locales : []) {
      if (typeof loc === 'string' && CODE_RE.test(loc)) pairs.push({ target: loc });
      else warnings.push(`$.locales: ${JSON.stringify(loc)} is not a language code — left out`);
    }
    if (isObj(doc.provenance)) {
      const prov = {};
      if (Array.isArray(doc.provenance.resources)) prov.resources = doc.provenance.resources;
      if (Array.isArray(doc.provenance.flags)) prov.flags = doc.provenance.flags;
      if (Object.keys(prov).length) view.provenance = prov;
      if (typeof doc.provenance.commercialReady === 'boolean') {
        view.card = { commercial_ready: doc.provenance.commercialReady };
      }
    }
  } else {
    view.kind = 'python';
    if (doc.entry_point !== undefined) view.entry_point = doc.entry_point;
    const card = {};
    for (const f of map.harness_card_fields) if (doc[f] !== undefined) card[f] = doc[f];
    if (Object.keys(card).length) view.card = card;
    for (const p of Array.isArray(doc.supported_pairs) ? doc.supported_pairs : []) {
      const m = typeof p === 'string' ? PAIR_RE.exec(p) : null;
      if (m) pairs.push({ source: m[1], target: m[2] });
      else warnings.push(`$.supported_pairs: ${JSON.stringify(p)} is not 'source>target' — left out`);
    }
    if (doc.dependency_class !== undefined) view.dependency_class = doc.dependency_class;
    if (Array.isArray(doc.dependencies)) view.dependencies = doc.dependencies;
  }
  if (pairs.length) view.pairs = pairs;
  view['x-v0'] = doc;
  errors.push(...validate(view, load().schema).errors);
  warnings.push(...kindRequirement(view));
  return { version: 0, data: view, shape, errors, warnings };
}

/**
 * One parsed method.json, read: method/1 as it is, an older shape as its
 * method/1 view. `data` is what every consumer reads.
 */
export function readMethodDocument(doc) {
  if (isObj(doc) && doc.$schema === undefined) return methodFromV0(doc);
  const checked = checkMethod(doc);
  return { version: checked.version, data: isObj(doc) ? doc : null,
    shape: checked.version === 1 ? 'method/1' : null, errors: checked.errors, warnings: [] };
}

/**
 * A method.json file, read and checked. Relative paths in it (model_dir,
 * dictionary, coaching.file) are relative to `dir`, its folder.
 */
export function readMethod(file) {
  const out = { path: file, dir: path.dirname(file), exists: fs.existsSync(file),
    version: null, data: null, shape: null, errors: [], warnings: [] };
  if (!out.exists) {
    out.errors.push(`${path.basename(file)}: no such file`);
    return out;
  }
  let doc;
  try {
    doc = JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch (e) {
    out.errors.push(`$: not readable as JSON (${e instanceof SyntaxError ? 'JSONDecodeError' : 'OSError'})`);
    return out;
  }
  return { ...out, ...readMethodDocument(doc) };
}
