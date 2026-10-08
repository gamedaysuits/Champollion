/**
 * content-review.js — keep the edits a person makes to translated Markdown.
 *
 * THE BUG THIS CLOSES (persona finding, 2026-10-03): a reviewer corrects a
 * sentence in newsletters/2026-10.crk.md; the author then edits a DIFFERENT
 * paragraph of newsletters/2026-10.md; the next sync re-translates the file
 * and the Translation Memory serves the OLD machine translation for every
 * unchanged paragraph, so the reviewer's correction was overwritten with
 * nothing said but "source updated, re-translating". The content lock held
 * only the SOURCE hash, so nothing could tell a reviewed file from the file
 * sync wrote.
 *
 * THE RECORD. Whenever the content lane writes (or adopts) a translated file
 * it also records what it left on disk, in the same .champollion-content.lock,
 * under "written:<relPath>:<locale>":
 *
 *   {
 *     "file":   16 hex of SHA-256 over the whole file as sync left it,
 *     "blocks": "s:t s:t:r …"  one entry per translatable body block, in
 *               order. s = 8 hex of the SOURCE block it translates, t = 8 hex
 *               of the block as written, ":r" = a person's text (kept on
 *               every later sync). null when the written body does not split
 *               into as many blocks as the source (no safe positional map).
 *     "fields": { "<name>": "s:t[:r]" }  translatable front-matter fields.
 *     "owned":  true  the whole file is a person's (hand-translated, or
 *               brought up to date by hand) and has no block map.
 *     "held":   16 hex of the file when a sync last left it as is because
 *               its edits could not be merged with a source change.
 *   }
 *
 * The block unit is exactly the TM's (segment.js via translatableBlockSources:
 * protect → split → restore, translatable segments only), and the record is
 * computed by re-splitting the file AS WRITTEN — the same function the next
 * sync runs on the file on disk — so "differs from the record" can only mean
 * that a person changed it.
 *
 * WHAT A SYNC DOES WITH EDITS (lib/content-sync.js):
 *   - source unchanged → the file is not touched (as before);
 *   - source changed → edited paragraphs whose source paragraph is unchanged
 *     are kept word for word, everything else is updated; an edited paragraph
 *     whose source paragraph itself changed is re-translated and the run
 *     prints the edited wording so it can be re-applied;
 *   - edits that cannot be matched paragraph by paragraph (paragraphs added,
 *     removed or merged; 'page' segmentation) → the file is left as is and
 *     the run says so every time until the file is brought up to date by hand
 *     (the next sync then takes it as current) or re-translated by name.
 */

import crypto from 'node:crypto';
import { parseContentFile } from './content.js';
import { translatableBlockSources } from './content-estimate.js';

const WRITTEN_PREFIX = 'written:';

function sha256(text) {
  return crypto.createHash('sha256').update(text, 'utf-8').digest('hex');
}

/** 8-hex fingerprint of one block or field value (collisions only matter within one file). */
function blockHash(text) {
  return sha256(text).slice(0, 8);
}

/** 16-hex fingerprint of a whole translated file. */
function fileHash(text) {
  return sha256(text).slice(0, 16);
}

/** The lock key of the written-record for a content manifest key ("relPath:locale"). */
function writtenRecordKey(manifestKey) {
  return `${WRITTEN_PREFIX}${manifestKey}`;
}

function encodePair(s, t, owned) {
  return `${s}:${t}${owned ? ':r' : ''}`;
}

function decodePair(enc) {
  if (typeof enc !== 'string') return null;
  const [s, t, flag, extra] = enc.split(':');
  if (!/^[0-9a-f]{8}$/.test(s || '') || !/^[0-9a-f]{8}$/.test(t || '')) return null;
  if (extra !== undefined || (flag !== undefined && flag !== 'r')) return null;
  return { s, t, owned: flag === 'r' };
}

/**
 * Parse a stored written-record. Returns null when there is none; throws
 * (with a plain message) when one is present but malformed — the caller
 * must say so rather than silently treat the file as unedited.
 *
 * @param {*} value - The lock value under writtenRecordKey(...)
 * @returns {{ file: string, blocks: Array<{s:string,t:string,owned:boolean}>|null,
 *   fields: Object<string,{s:string,t:string,owned:boolean}>, owned: boolean,
 *   held: string|null }|null}
 */
function parseWrittenRecord(value) {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'object' || Array.isArray(value) || typeof value.file !== 'string') {
    throw new Error('not a written-record object');
  }
  let blocks = null;
  if (typeof value.blocks === 'string') {
    blocks = value.blocks === '' ? [] : value.blocks.split(' ').map(decodePair);
    if (blocks.some(b => b === null)) throw new Error('malformed "blocks"');
  } else if (value.blocks !== null && value.blocks !== undefined) {
    throw new Error('malformed "blocks"');
  }
  const fields = {};
  if (value.fields !== undefined) {
    if (typeof value.fields !== 'object' || value.fields === null || Array.isArray(value.fields)) {
      throw new Error('malformed "fields"');
    }
    for (const [name, enc] of Object.entries(value.fields)) {
      const pair = decodePair(enc);
      if (!pair) throw new Error(`malformed field "${name}"`);
      fields[name] = pair;
    }
  }
  return {
    file: value.file,
    blocks,
    fields,
    owned: value.owned === true,
    held: typeof value.held === 'string' ? value.held : null,
  };
}

/**
 * Build the record of a file sync is leaving on disk.
 *
 * @param {object} args
 * @param {string} args.sourceBody - Source Markdown body (front matter stripped)
 * @param {Object<string,string>} args.sourceFields - Translatable source front-matter values
 * @param {string} args.written - The complete target file as written
 * @param {Set<number>} [args.ownedBlocks] - Source block positions holding a person's text
 * @param {Set<string>} [args.ownedFields] - Field names holding a person's text
 * @returns {object} JSON-ready record (see header)
 */
function buildWrittenRecord({ sourceBody, sourceFields, written, ownedBlocks = new Set(), ownedFields = new Set() }) {
  const target = parseContentFile(written);
  const src = translatableBlockSources(sourceBody);
  const out = translatableBlockSources(target.body);
  const record = { file: fileHash(written), blocks: null };
  if (src.length === out.length) {
    record.blocks = src.map((s, j) => encodePair(blockHash(s), blockHash(out[j]), ownedBlocks.has(j))).join(' ');
  } else if (ownedBlocks.size > 0) {
    // A person's paragraphs with no block map: the whole file is theirs.
    record.owned = true;
  }
  const fields = {};
  for (const name of Object.keys(sourceFields).sort()) {
    const value = sourceFields[name];
    const tv = target.frontMatter[name];
    if (typeof value === 'string' && typeof tv === 'string') {
      fields[name] = encodePair(blockHash(value), blockHash(tv), ownedFields.has(name));
    }
  }
  if (Object.keys(fields).length > 0) record.fields = fields;
  return record;
}

/**
 * Record a file a person wrote (hand-translated, or brought up to date by
 * hand after a sync held it): every paragraph and field is theirs.
 */
function buildAdoptedRecord({ sourceBody, sourceFields, written }) {
  const blockCount = translatableBlockSources(sourceBody).length;
  const ownedBlocks = new Set(Array.from({ length: blockCount }, (_, j) => j));
  const record = buildWrittenRecord({
    sourceBody, sourceFields, written, ownedBlocks, ownedFields: new Set(Object.keys(sourceFields)),
  });
  // A hand-written file with no translatable blocks is still a person's file.
  if (record.blocks === null) record.owned = true;
  return record;
}

/**
 * First record of a file this version never recorded (written by an older
 * version, source unchanged since). A block or field is marked as a person's
 * when the TM holds a machine translation for its source and the file does
 * NOT carry it — that is an edit made before the record existed. With no TM
 * entry there is no evidence either way, and the text is taken as written.
 *
 * @param {object} args
 * @param {(sourceText: string) => string[]} args.machineFor - Cached machine
 *   translations of a source text (exact entries; no side effects)
 */
function buildBootstrapRecord({ sourceBody, sourceFields, written, machineFor }) {
  const target = parseContentFile(written);
  const src = translatableBlockSources(sourceBody);
  const out = translatableBlockSources(target.body);
  const differs = (sourceText, targetText) => {
    const known = machineFor(sourceText);
    return known.length > 0 && !known.includes(targetText);
  };
  const ownedBlocks = new Set();
  if (src.length === out.length) {
    src.forEach((s, j) => { if (differs(s, out[j])) ownedBlocks.add(j); });
  }
  const ownedFields = new Set();
  for (const [name, value] of Object.entries(sourceFields)) {
    const tv = target.frontMatter[name];
    if (typeof value === 'string' && typeof tv === 'string' && differs(value, tv)) ownedFields.add(name);
  }
  return buildWrittenRecord({ sourceBody, sourceFields, written, ownedBlocks, ownedFields });
}

/**
 * What a person changed in a translated file since sync last recorded it.
 *
 * @param {string} targetRaw - The translated file as it is on disk now
 * @param {ReturnType<typeof parseWrittenRecord>} record
 * @returns {{ state: 'clean' } |
 *   { state: 'unmappable', reason: string } |
 *   { state: 'edited', blocks: Array<{src:string,text:string,owned:boolean}>,
 *     fields: Object<string,{src:string,text:string,owned:boolean}>,
 *     ownedBlocks: number, ownedFields: number }}
 */
function readReviewerEdits(targetRaw, record) {
  const edited = fileHash(targetRaw) !== record.file;
  const anyOwned = record.owned
    || (record.blocks || []).some(b => b.owned)
    || Object.values(record.fields).some(f => f.owned);
  if (!edited && !anyOwned) return { state: 'clean' };

  const target = parseContentFile(targetRaw);
  const fields = {};
  for (const [name, f] of Object.entries(record.fields)) {
    const current = target.frontMatter[name];
    if (typeof current !== 'string') continue; // removed from the file: nothing to keep
    fields[name] = { src: f.s, text: current, owned: f.owned || blockHash(current) !== f.t };
  }
  const ownedFields = Object.values(fields).filter(f => f.owned).length;

  if (record.blocks === null) {
    if (!edited && !record.owned) {
      // Only field flags: the body is as written.
      return ownedFields > 0 ? { state: 'edited', blocks: null, fields, ownedBlocks: 0, ownedFields } : { state: 'clean' };
    }
    return {
      state: 'unmappable',
      reason: record.owned
        ? 'it is maintained by hand'
        : 'its paragraphs did not line up one to one with the source when sync wrote it',
    };
  }

  const current = translatableBlockSources(target.body);
  if (current.length !== record.blocks.length) {
    return {
      state: 'unmappable',
      reason: `it now has ${current.length} paragraph(s) where sync wrote ${record.blocks.length} — paragraphs were added, removed or merged`,
    };
  }
  const blocks = record.blocks.map((b, i) => ({
    src: b.s, text: current[i], owned: b.owned || blockHash(current[i]) !== b.t,
  }));
  const ownedBlocks = blocks.filter(b => b.owned).length;
  // Edits only to separators, passthrough blocks (code) or untranslated
  // front matter: those parts are copied from the source by design.
  if (ownedBlocks === 0 && ownedFields === 0) return { state: 'clean' };
  return { state: 'edited', blocks, fields, ownedBlocks, ownedFields };
}

/**
 * Match a person's paragraphs to the CURRENT source's blocks by the source
 * text they translate. Every previously written block is queued under its
 * source hash, so the k-th copy of a repeated paragraph maps to the k-th copy.
 *
 * @param {Array<{src:string,text:string,owned:boolean}>} editBlocks - From readReviewerEdits
 * @param {string[]} sourceBlocks - Current source's translatable block texts, in order
 * @returns {{ keep: Map<number,string>, superseded: Array<{ paragraph: number, text: string }> }}
 *   keep: source block position → the person's text. superseded: edited
 *   paragraphs (1-based, as they were in the file) whose source paragraph
 *   is gone or changed.
 */
function matchEditedBlocks(editBlocks, sourceBlocks) {
  const queues = new Map();
  editBlocks.forEach((b, i) => {
    if (!queues.has(b.src)) queues.set(b.src, []);
    queues.get(b.src).push({ ...b, paragraph: i + 1 });
  });
  const keep = new Map();
  sourceBlocks.forEach((text, j) => {
    const entry = queues.get(blockHash(text))?.shift();
    if (entry && entry.owned) keep.set(j, entry.text);
  });
  const superseded = [...queues.values()].flat()
    .filter(e => e.owned)
    .sort((a, b) => a.paragraph - b.paragraph)
    .map(e => ({ paragraph: e.paragraph, text: e.text }));
  return { keep, superseded };
}

/**
 * Match a person's front-matter values to the current source fields.
 *
 * @returns {{ keep: Object<string,string>, superseded: Array<{ field: string, text: string }> }}
 */
function matchEditedFields(editFields, sourceFields) {
  const keep = {};
  const superseded = [];
  for (const [name, f] of Object.entries(editFields)) {
    if (!f.owned) continue;
    const source = sourceFields[name];
    if (typeof source === 'string' && blockHash(source) === f.src) keep[name] = f.text;
    else superseded.push({ field: name, text: f.text });
  }
  return { keep, superseded };
}

/**
 * Decide what a sync does with an existing translated file before it
 * translates anything. Pure (no I/O): runContentSync and the cost estimator
 * (countPendingContentTranslations) both call it, so the estimate can never
 * count a file the sync would leave as is.
 *
 * @param {object} args
 * @param {string} args.targetRaw - The translated file on disk
 * @param {ReturnType<typeof parseWrittenRecord>} args.record - null = no record (older version)
 * @param {'block'|'page'} args.segMode - The pair's content segmentation
 * @param {boolean} args.replaceEdits - The operator named this file for a redo
 *   (--retranslate, or --redo files: / --files with --force-content)
 * @param {boolean} args.sourceCurrent - The lock says the source is unchanged
 *   (we are here only because of --force-content)
 * @returns {{ action: 'proceed', edits: object|null, replaced?: object } |
 *   { action: 'keep', reason: string } | { action: 'accept' } |
 *   { action: 'hold', reason: string, heldHash: string }}
 *   proceed: translate; `edits` (state 'edited') are the person's paragraphs
 *   and fields to keep. keep: an up-to-date file with edits that cannot be
 *   merged — leave it. accept: a held file was edited since — take it as
 *   current. hold: leave the file as is and say so (lock not advanced).
 */
function assessExistingTarget({ targetRaw, record, segMode, replaceEdits, sourceCurrent }) {
  if (!record) return { action: 'proceed', edits: null };
  const edits = readReviewerEdits(targetRaw, record);
  if (edits.state === 'clean') return { action: 'proceed', edits: null };
  if (replaceEdits) return { action: 'proceed', edits: null, replaced: edits };
  const cannotMerge = edits.state === 'unmappable' || (segMode === 'page' && edits.ownedBlocks > 0);
  if (!cannotMerge) return { action: 'proceed', edits };
  const reason = edits.state === 'unmappable'
    ? edits.reason
    : "its pair uses 'page' segmentation, which translates the body as one piece";
  if (sourceCurrent) return { action: 'keep', reason };
  const current = fileHash(targetRaw);
  if (record.held && record.held !== current) return { action: 'accept' };
  return { action: 'hold', reason, heldHash: current };
}

/** "3 paragraph(s) and the title" — for kept/replaced messages. */
function describeEdits({ paragraphs = 0, fields = [] }) {
  const parts = [];
  if (paragraphs > 0) parts.push(`${paragraphs} paragraph(s)`);
  if (fields.length > 0) parts.push(`front matter ${fields.map(f => `"${f}"`).join(', ')}`);
  return parts.join(' and ') || 'the file';
}

export {
  assessExistingTarget,
  describeEdits,
  WRITTEN_PREFIX,
  blockHash,
  fileHash,
  writtenRecordKey,
  parseWrittenRecord,
  buildWrittenRecord,
  buildAdoptedRecord,
  buildBootstrapRecord,
  readReviewerEdits,
  matchEditedBlocks,
  matchEditedFields,
};
