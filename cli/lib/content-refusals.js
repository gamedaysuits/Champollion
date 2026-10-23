/**
 * content-refusals.js — Markdown blocks and front-matter fields the quality
 * gate refused, remembered so a plain sync does not send them to the same
 * model again. The key-value rule (lib/locale-state.js, Round 4) for the two
 * content lanes (lib/content-sync.js, lib/docusaurus-sync.js).
 *
 * WHY: a block the gate refused (lib/validate.js contentGateFault) was
 * written as the '[EN] ' last resort, never cached, and its file's lock was
 * not advanced — so EVERY sync sent it to the same paid model again, which
 * answered the same way and was refused again. A refused front-matter field
 * failed its page, and every sync re-sent the page's fields. With a paid
 * model and no fallback that repeated the charge on each run, unlike keys,
 * which are held back.
 *
 * THE RECORD — in .champollion-content.lock (committed, beside the lane's
 * own entries), one entry per (page × locale) that has refusals:
 *
 *   "refused:<manifestKey>": {
 *     "block:<hash12>": { "source": "<hash12>", "methods": ["<method key>"], "on": "2026-10-04", "gate": 2 },
 *     "field:title":    { "source": "<hash12>", "methods": ["<method key>"], "on": "2026-10-04" },
 *     "page":           { "source": "<hash12>", "methods": ["<method key>"], "on": "2026-10-04" }
 *   }
 *
 * <manifestKey> is the lane's own key for the translation ("posts/a.md:fr",
 * "docusaurus:docs/intro.md:fr"). A block is named by the hash of its source
 * text, so an edited paragraph is a new block (the hold lifts); `source` is
 * the 12-hex SHA-256 the key-value record uses, `methods` the TM method keys
 * (method|model|register|coaching) whose answers the gate refused.
 *
 * "page" is the whole body of a page translated in one prompt
 * (contentSegmentation: "page"): refused when the answer damages a protected
 * placeholder or hollows the page (the whole-body checks), its `source` the
 * hash of the body text. Editing the body — or switching to block
 * segmentation — lifts it. A held page is not written, as a held field's
 * page is not: there is no '[EN] ' text for a page translated whole.
 *
 * PRECEDENCE — the key-value rule, unit by unit:
 *   1. Named for a redo — `--redo files:<page>`, `--redo content`
 *      (= --force-content), `--retranslate`, or anything under `--fresh`:
 *      always sent.
 *   2. Refused before by the pair's method, for the unit's current source
 *      text: held back — not sent to that method again. A fallback method
 *      that has not refused it still gets it. A held block keeps its
 *      '[EN] ' text until it is filled; a page whose front-matter field is
 *      held is not written (the field gate fails a page whole, as it always
 *      did) — and nothing of it is sent.
 *   3. A model or method change lifts the hold (the refusal was that method
 *      key's), as does a new source text.
 *   The cache is always consulted first (free): holding back only stops a
 *   paid call. A unit filled any other way — a fallback, the cache, a
 *   paragraph written by hand — drops its record.
 */

import fs from 'node:fs';
import path from 'node:path';
import { output } from './output.js';
import { tmMethodKey, lookupTM } from './tm.js';
import { GATE_VERSION } from './validate.js';
import { holdState, shortSourceHash } from './locale-state.js';
import { contentRedoCommand } from './verify.js';
import { translatableBlockSources } from './content-estimate.js';

/**
 * The lock value of a page written with something left in the source language
 * (a block or front-matter field the gate refused): `pending:<source hash>`.
 * It differs from the source hash, so the next sync processes the page again
 * (the cache makes that free; a held unit is not re-sent), and it says the
 * page is the tool's — a page with no lock entry is taken for a person's
 * work and preserved. Before 2026-10-05 a visible '[EN] ' marker in the page
 * did that job; no marker is written any more.
 */
export const PENDING_LOCK_PREFIX = 'pending:';
export const pendingLockValue = (sourceHash) => `${PENDING_LOCK_PREFIX}${sourceHash}`;
export const isPendingLock = (value) => typeof value === 'string' && value.startsWith(PENDING_LOCK_PREFIX);

/** The content-lock key of one page × locale's refusals. */
export function refusalRecordKey(manifestKey) {
  return `refused:${manifestKey}`;
}

/** A block's unit id: the hash of its (restored) source text. */
export const blockUnit = (source) => `block:${shortSourceHash(source)}`;

/** A front-matter field's unit id. */
export const fieldUnit = (field) => `field:${field}`;

/** The unit id of a page body translated whole (contentSegmentation: "page"). */
export const PAGE_UNIT = 'page';

/** How a held page body is named in messages and summaries. */
export const PAGE_NAME = 'the whole page body';

/**
 * One page × locale's refusal record (entries that do not parse are dropped).
 *
 * @param {object} manifest - The content lock
 * @param {string} manifestKey
 * @returns {Record<string, { source: string, methods: string[], on?: string }>}
 */
export function readRefusals(manifest, manifestKey) {
  const rec = manifest?.[refusalRecordKey(manifestKey)];
  if (!rec || typeof rec !== 'object' || Array.isArray(rec)) return {};
  const out = {};
  for (const [id, r] of Object.entries(rec)) {
    // A refusal by an earlier gate lifts by itself (validate.js GATE_VERSION):
    // what an over-strict check refused is asked again once it is fixed.
    if (r && typeof r === 'object' && typeof r.source === 'string' && Array.isArray(r.methods)
      && r.gate === GATE_VERSION) out[id] = r;
  }
  return out;
}

/**
 * What a run may do with each unit of one page: 'send' (ask the pair's
 * method), 'fallback-only' (the pair's method refused it; its fallback has
 * not), 'held' (not sent at all).
 *
 * @param {object} units - readRefusals()
 * @param {object} pairConfig
 * @param {{ redo?: boolean }} [opts] - redo: the page was named for a redo (always sent)
 * @returns {{ block: (source: string) => 'send'|'fallback-only'|'held',
 *   field: (field: string, source: string) => 'send'|'fallback-only'|'held',
 *   page: (body: string) => 'send'|'fallback-only'|'held' }}
 */
export function contentHolds(units, pairConfig, { redo = false } = {}) {
  // The key-value rule (lib/locale-state.js holdState), unit by unit.
  const stateOf = (id, source) => (redo ? 'send' : holdState(units[id], source, pairConfig));
  return {
    block: (source) => stateOf(blockUnit(source), source),
    field: (field, source) => stateOf(fieldUnit(field), source),
    page: (body) => stateOf(PAGE_UNIT, body),
  };
}

/**
 * One page's record after a run processed it: earlier refusals that still
 * apply (same source text, not filled this run), plus this run's.
 *
 * @param {object} prior - readRefusals()
 * @param {object} p
 * @param {string[]} p.blockSources - The page's current translatable block sources ([] in page mode)
 * @param {string|null} [p.pageSource] - Its body, in page mode (null in block mode)
 * @param {Record<string, string>} p.fields - Its current translatable front-matter fields
 * @param {Array<{ unit: string, source: string, methods: string[] }>} p.refused - Refused this run, left unfilled
 * @param {Set<string>} p.filled - Units filled this run (any method, the cache, a person)
 * @returns {object|null} The record, or null when nothing is left to hold
 */
export function nextRefusals(prior, { blockSources = [], pageSource = null, fields = {}, refused = [], filled = new Set() }) {
  const live = new Map();
  for (const s of blockSources) live.set(blockUnit(s), shortSourceHash(s));
  if (typeof pageSource === 'string' && pageSource.trim()) live.set(PAGE_UNIT, shortSourceHash(pageSource));
  for (const [f, v] of Object.entries(fields)) if (typeof v === 'string') live.set(fieldUnit(f), shortSourceHash(v));
  const out = {};
  for (const [id, r] of Object.entries(prior)) {
    if (filled.has(id) || live.get(id) !== r.source) continue;
    out[id] = r;
  }
  const on = new Date().toISOString().slice(0, 10);
  for (const { unit, source, methods } of refused) {
    if (!methods || methods.length === 0 || filled.has(unit)) continue;
    const src = shortSourceHash(source);
    const known = out[unit] && out[unit].source === src ? out[unit].methods : [];
    out[unit] = { source: src, methods: [...new Set([...known, ...methods])], on, gate: GATE_VERSION };
  }
  return Object.keys(out).length > 0 ? out : null;
}

/** Write (or remove) one page's record in the content lock object. */
export function storeRefusals(manifest, manifestKey, record) {
  const key = refusalRecordKey(manifestKey);
  if (record) manifest[key] = record;
  else delete manifest[key];
}

/**
 * The warning for one page's held units — both lanes say it the same way.
 *
 * @param {object} p
 * @param {string} p.file - The page as sync names it (what `--redo files:` matches)
 * @param {string} p.code
 * @param {string} p.pairKey
 * @param {object} p.pairConfig
 * @param {string[]} p.names - "paragraph 2", 'front matter "title"'
 * @param {boolean} [p.pageHeld] - The page body translated whole (page mode)
 *   is held: the page is not written
 * @param {boolean} [p.handWritten] - The lane keeps a paragraph written by hand (contentDir)
 * @returns {string}
 */
export function describeHeld({ file, code, pairKey, pairConfig, names, pageHeld = false, handWritten = false }) {
  const shown = names.slice(0, 5).join(', ') + (names.length > 5 ? `, +${names.length - 5} more` : '');
  const fb = pairConfig.fallback;
  const who = fb ? `${pairConfig.method}'s and its fallback's (${fb.method})` : `${pairConfig.method}'s`;
  const left = !pageHeld
    ? 'They stay in the source language (unmarked) until they are filled; the rest of the page is written.'
    : 'A page translated whole is not written (and nothing of it is sent) until it is filled.';
  const other = fb
    ? 'another "fallback" method on the pair'
    : `a "fallback" method on the pair (it is asked for what ${pairConfig.method} refused)`;
  const hand = handWritten && !pageHeld ? ', or write those paragraphs by hand (a hand-written paragraph is kept)' : '';
  return `${file} → ${code}: ${names.length} block(s)/field(s) held back (${shown}) — the quality gate refused ${who} translation of their `
    + `current text before; not sent, not billed. ${left} Ask again: \`${contentRedoCommand(file, { pair: pairKey })}\`; `
    + `or fill them another way — ${other}${hand}.`;
}

/**
 * Said with a refusal this run recorded: what the next sync does with it.
 *
 * @param {object} p
 * @param {string} p.file
 * @param {string} p.pairKey
 * @param {object} p.pairConfig
 * @param {number} p.count - Units refused (and left unfilled) this run
 * @param {boolean} [p.fallbackAsked] - Some of them still go to the fallback
 *   (it has not refused them — skipped by --max-cost, or no answer)
 * @returns {string}
 */
export function describeNewHold({ file, pairKey, pairConfig, count, fallbackAsked = false, lead = 'Remembered:' }) {
  const them = count === 1 ? 'it' : `these ${count}`;
  const fb = pairConfig.fallback;
  const where = fb && fallbackAsked
    ? `${pairConfig.method} again (its fallback, ${fb.method}, is asked for what it has not refused)`
    : `${pairConfig.method}${fb ? ` or its fallback (${fb.method})` : ''} again`;
  return `${lead} the next sync does not send ${them} to ${where} — not billed again; `
    + `\`${contentRedoCommand(file, { pair: pairKey })}\` asks again.`;
}

/**
 * The end of a lane's "N block(s) … written as '[EN] '-prefixed source" line:
 * what the next sync does with them — asks again for a block that got no
 * usable answer, holds back one the gate refused.
 *
 * @param {object} p
 * @param {string} p.file
 * @param {string} p.pairKey
 * @param {object} p.pairConfig
 * @param {number} p.fellBack - Blocks written as '[EN] ' this run
 * @param {number[]} p.newlyHeld - Of those (indices into the batch), the ones the gate refused
 * @param {string[][]} [p.refusedBy] - translateBlocksWithFallback().refusedBy
 * @returns {string}
 */
export function describeFallenBack({ file, pairKey, pairConfig, fellBack, newlyHeld, refusedBy = [] }) {
  if (newlyHeld.length === 0) return 'Not cached; the page is recorded as pending: the next sync retries just those block(s).';
  const retry = fellBack - newlyHeld.length;
  const fbKey = pairConfig.fallback ? tmMethodKey(pairConfig.fallback) : null;
  const fallbackAsked = !!fbKey && newlyHeld.some(i => !(refusedBy[i] || []).includes(fbKey));
  const n = newlyHeld.length;
  return 'Not cached; the page is recorded as pending. '
    + (retry > 0 ? `The next sync asks again for the ${retry} that got no usable answer. ` : '')
    + describeNewHold({
      file, pairKey, pairConfig, count: n, fallbackAsked,
      lead: `The ${n === 1 ? 'one' : n} the quality gate refused ${n === 1 ? 'is' : 'are'} remembered:`,
    });
}

/**
 * What a real run would hold back for one page — a dry run says so instead
 * of "would create". The cache is consulted as the sync consults it (pure
 * lookups: a preview changes nothing): only what it does not hold is held.
 *
 * @param {object} p
 * @param {object} p.tm
 * @param {string} p.code
 * @param {object} p.pairConfig
 * @param {Record<string, string>} p.fields - Translatable front-matter fields
 * @param {string} p.body
 * @param {'block'|'page'} p.segMode
 * @param {ReturnType<typeof contentHolds>} p.holds
 * @returns {{ names: string[], pageHeld: boolean }}
 */
export function previewHeld({ tm, code, pairConfig, fields, body, segMode, holds }) {
  const keys = [tmMethodKey(pairConfig), ...(pairConfig.fallback ? [tmMethodKey(pairConfig.fallback)] : [])];
  const cached = (text) => keys.some(k => lookupTM(tm, text, code, k) !== null);
  const names = [];
  for (const [field, text] of Object.entries(fields || {})) {
    if (typeof text === 'string' && !cached(text) && holds.field(field, text) === 'held') names.push(`front matter "${field}"`);
  }
  if (names.length > 0) return { names, pageHeld: true };
  if (segMode === 'page' && typeof body === 'string' && body.trim() && !cached(body) && holds.page(body) === 'held') {
    return { names: [PAGE_NAME], pageHeld: true };
  }
  if (segMode === 'block' && typeof body === 'string' && body.trim() && !cached(body)) {
    translatableBlockSources(body).forEach((source, i) => {
      if (!cached(source) && holds.block(source) === 'held') names.push(`paragraph ${i + 1}`);
    });
  }
  return { names, pageHeld: false };
}

// ── What a run left in the source language ───────────────────────────

/** Where refused answers are logged (the per-machine cache folder, never committed). */
export const REFUSAL_LOG = path.join('.champollion', 'refused.jsonl');

/**
 * Append one refused answer to `.champollion/refused.jsonl`: the source, what
 * the model answered, and why the gate refused it. WHY: a refused answer was
 * thrown away, so "why did it refuse that twice?" could only be answered by
 * paying the model again (2026-10-06 — and the answer then showed the gate,
 * not the model, was wrong). Never fails the run.
 *
 * @param {string} cwd
 * @param {object} rec - { pair, method, file, locale, paragraph, reason, source, answer }
 */
export function logRefusal(cwd, rec) {
  try {
    const file = path.join(cwd, REFUSAL_LOG);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.appendFileSync(file, `${JSON.stringify({ at: new Date().toISOString(), ...rec })}\n`, 'utf-8');
  } catch { /* a diagnostic: never fails the run */ }
}

/**
 * The run's closing report when anything was left in the source language —
 * last, as an error, never under an [OK] (2026-10-06: a 1,082-page sync ended
 * on "[OK] Created 1082 content file(s)" with seven untranslated blocks named
 * only in warnings mid-stream).
 *
 * @param {Array<{ file: string, locale: string, pair: string, where: string, reason: string }>} items
 */
export function reportLeftInSource(items) {
  if (!items || items.length === 0) return;
  const pages = new Map();
  for (const it of items) {
    const k = `${it.file}\u0000${it.pair}`;
    if (!pages.has(k)) pages.set(k, { ...it, wheres: [] });
    pages.get(k).wheres.push(`${it.where}: ${it.reason}`);
  }
  output.raw('');
  output.error(`Not finished: ${items.length} part(s) of ${pages.size} page translation(s) are still in the source language — `
    + 'the quality gate refused the model\'s answer, also when asked again with the reason:');
  for (const p of pages.values()) {
    output.raw(`    ${p.file} → ${p.locale}: ${p.wheres.slice(0, 3).join('; ')}${p.wheres.length > 3 ? `; +${p.wheres.length - 3} more` : ''}`);
  }
  const first = [...pages.values()][0];
  output.raw(`  The rest of each page is written. What the model answered is in ${REFUSAL_LOG}. `
    + `Ask again: \`${contentRedoCommand(first.file, { pair: first.pair })}\`${pages.size > 1 ? ' (one per page)' : ''}, `
    + 'or add a "fallback" method to the pair.');
}
