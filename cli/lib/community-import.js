/**
 * community-import.js — read the files communities actually keep their
 * language data in, with no dependency: spreadsheets (.xlsx, .ods, .csv),
 * tab-separated or plain text (.tsv, .tab, .txt), and tables in Word
 * documents (.docx), ELAN annotation files (.eaf: two linked tiers),
 * LIFT dictionaries (FieldWorks / FLEx: forms keyed by language),
 * Toolbox / MDF dictionaries (SIL Standard Format:
 * \lx headwords with \ge glosses, \xv examples with \xe translations —
 * read by their markers), and USFM scripture (Paratext: one book per file,
 * paired with a second text verse by verse — only on request, see
 * `data add --usfm-source`). Used by `champollion data add` to turn them into the
 * one format every tool reads (source TAB target, plus a set/1 sidecar).
 *
 * Reading rules (the rails never guess silently):
 *   - Text must be UTF-8 or UTF-16 with a BOM (Excel's "Unicode Text"). Any
 *     other bytes are REFUSED with the fix, never decoded by guesswork.
 *   - Cells are NFC-normalized and trimmed; nothing else is changed.
 *   - A file the reader does not know is refused with what to do instead.
 *
 * Content-free: nothing here prints a cell. Profiles describe columns by
 * letter, fill rate, script mix and length — never by what they say.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { parseCSV } from './csv.mjs';

export class ImportError extends Error {
  constructor(message, fix) {
    super(fix ? `${message}\n  fix: ${fix}` : message);
    this.fix = fix || null;
  }
}

export const SUPPORTED = ['.csv', '.tsv', '.tab', '.txt', '.xlsx', '.ods', '.docx', '.sfm', '.db', '.lex', '.lift', '.xml', '.eaf', '.usfm'];

/** A Toolbox / MDF field line: `\marker value`. */
const SFM_FIELD = /^\\([A-Za-z_][A-Za-z0-9_]*)(?:[ \t]+(.*))?$/;

/** Does this text read as a Toolbox (SIL Standard Format) dictionary? */
export function looksLikeToolbox(text) {
  return /^\\lx[ \t]/m.test(text);
}

/**
 * A Toolbox / MDF dictionary (SIL Standard Format Markers) as two tables —
 * `words` ([English gloss, headword]) and `examples` ([English translation,
 * example sentence]) — by the MDF meanings of the markers, never by reading
 * the text: a record starts at \lx (the headword; \lc, its citation form,
 * wins when present; a \se subentry is its own headword), each \ge gloss
 * (several split on ";") is one word-list row, and each \xv example with the
 * \xe after it is one pair. A line without a marker continues the field
 * before it. Content-free counts come back with the tables.
 */
export function readToolbox(text) {
  const fields = [];
  let cur = null;
  for (const raw of text.split(/\r?\n/)) {
    const m = SFM_FIELD.exec(raw);
    if (m) {
      cur = [m[1], (m[2] || '').trim()];
      fields.push(cur);
    } else if (cur && raw.trim()) {
      cur[1] = `${cur[1]} ${raw.trim()}`.trim();
    }
  }
  const words = [];
  const examples = [];
  const counts = { records: 0, subentries: 0, glosses: 0, examples: 0, examples_without_translation: 0 };
  let form = null;
  let glosses = [];
  let pendingX = null;
  const flush = () => {
    for (const g of glosses) {
      for (const part of g.split(';').map((p) => p.trim()).filter(Boolean)) {
        if (form) { words.push([part, form]); counts.glosses++; }
      }
    }
    glosses = [];
  };
  for (const [marker, value] of fields) {
    if (marker === 'lx') {
      flush();
      if (pendingX !== null) counts.examples_without_translation++;
      pendingX = null;
      form = value || null;
      counts.records++;
    } else if (marker === 'lc') {
      if (value) form = value;
    } else if (marker === 'se') {
      flush();
      form = value || null;
      counts.subentries++;
    } else if (marker === 'ge') {
      if (value) glosses.push(value);
    } else if (marker === 'xv') {
      if (pendingX !== null) counts.examples_without_translation++;
      pendingX = value || null;
    } else if (marker === 'xe') {
      if (pendingX && value) {
        examples.push([value, pendingX]);
        counts.examples++;
      }
      pendingX = null;
    }
  }
  flush();
  if (pendingX !== null) counts.examples_without_translation++;
  return { sheets: [{ name: 'words', rows: words }, { name: 'examples', rows: examples }], counts };
}

// ── text decoding ────────────────────────────────────────────────────────

/** Decode bytes as text: UTF-8 (BOM optional) or UTF-16 with a BOM; else refuse. */
export function decodeText(buf, label = 'file') {
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) return buf.subarray(2).toString('utf16le');
  if (buf.length >= 2 && buf[0] === 0xfe && buf[1] === 0xff) {
    const swapped = Buffer.from(buf.subarray(2));
    swapped.swap16();
    return swapped.toString('utf16le');
  }
  const body = (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) ? buf.subarray(3) : buf;
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(body);
  } catch {
    throw new ImportError(`${label} is not UTF-8 text`,
      'save it again as UTF-8 (a spreadsheet: Save As → CSV UTF-8, or keep it as .xlsx; '
      + 'a text editor: Encoding → UTF-8) and add that file');
  }
}

// ── zip (xlsx, ods, docx are zip files) ──────────────────────────────────

/** The entries of a zip file: Map(name → Buffer). Stored and deflated entries only. */
export function unzip(buf, label = 'file') {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new ImportError(`${label} is not a readable zip-based document`, 'open it and save it again');
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const out = new Map();
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new ImportError(`${label}: damaged zip directory`, 'open it and save it again');
    const method = buf.readUInt16LE(p + 10);
    const csize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.subarray(p + 46, p + 46 + nameLen).toString('utf-8');
    if (csize === 0xffffffff || local === 0xffffffff) {
      throw new ImportError(`${label} is too large to read here (zip64)`, 'save the sheet as .csv (UTF-8) and add that');
    }
    const lNameLen = buf.readUInt16LE(local + 26);
    const lExtraLen = buf.readUInt16LE(local + 28);
    const start = local + 30 + lNameLen + lExtraLen;
    const data = buf.subarray(start, start + csize);
    if (method === 0) out.set(name, Buffer.from(data));
    else if (method === 8) out.set(name, zlib.inflateRawSync(data));
    p += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

// ── a minimal XML event scanner (enough for the three office formats) ────

const ENTITY = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" };

export function decodeEntities(s) {
  return s.replace(/&(#x[0-9a-fA-F]+|#\d+|lt|gt|amp|quot|apos);/g, (m, e) => {
    if (e[0] === '#') return String.fromCodePoint(e[1] === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
    return ENTITY[e];
  });
}

function attrs(s) {
  const out = {};
  for (const m of s.matchAll(/([\w:.-]+)\s*=\s*("([^"]*)"|'([^']*)')/g)) {
    out[m[1]] = decodeEntities(m[3] ?? m[4] ?? '');
  }
  return out;
}

/** Yield {type:'open'|'close'|'text', name?, attrs?, self?, text?} in order. */
function* xmlEvents(xml) {
  const re = /<!\[CDATA\[([\s\S]*?)\]\]>|<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<(\/?)([\w:.-]+)([^>]*?)(\/?)>|([^<]+)/g;
  let m;
  while ((m = re.exec(xml))) {
    if (m[1] !== undefined) yield { type: 'text', text: m[1] };
    else if (m[3] !== undefined) {
      if (m[2] === '/') yield { type: 'close', name: m[3] };
      else {
        yield { type: 'open', name: m[3], attrs: attrs(m[4]), self: m[5] === '/' };
        if (m[5] === '/') yield { type: 'close', name: m[3] };
      }
    } else if (m[6] !== undefined) yield { type: 'text', text: decodeEntities(m[6]) };
  }
}

// ── LIFT (the XML dictionaries FieldWorks / FLEx export) ──────────────────

/**
 * A LIFT dictionary, by its elements — never by guessing: each entry's
 * headword (its citation form when it has one, else its lexical unit), each
 * sense's glosses, and each example with its translations, every text
 * keyed by the language its <form lang="…"> or <gloss lang="…"> names.
 * Subsenses count as senses; a text split by inline <span>s is joined.
 * Returns {entries, counts, langs} — langs: the languages each part is
 * written in (content-free).
 */
export function readLift(xml) {
  const entries = [];
  const langs = { headword: new Set(), gloss: new Set(), example: new Set(), translation: new Set() };
  const counts = { entries: 0, senses: 0, examples: 0 };
  let entry = null;
  let sense = null;
  const senses = [];         // open sense / subsense, innermost last
  let example = null;
  const stack = [];          // element names, innermost last
  let formLang = null;       // the lang of the <form>/<gloss> being read
  let textBuf = null;        // inside <text>
  const within = (name) => stack.includes(name);
  for (const ev of xmlEvents(xml)) {
    if (ev.type === 'open') {
      stack.push(ev.name);
      if (ev.name === 'entry') {
        entry = { lu: {}, citation: {}, senses: [] };
        counts.entries++;
      } else if (entry && (ev.name === 'sense' || ev.name === 'subsense')) {
        sense = { gloss: {}, examples: [] };
        entry.senses.push(sense);
        senses.push(sense);
        counts.senses++;
      } else if (sense && ev.name === 'example') {
        example = { form: {}, tr: {} };
        sense.examples.push(example);
        counts.examples++;
      } else if (ev.name === 'form' || ev.name === 'gloss') {
        formLang = ev.attrs.lang || null;
      } else if (ev.name === 'text') {
        textBuf = '';
      }
      if (ev.self) stack.pop();
    } else if (ev.type === 'text') {
      if (textBuf !== null) textBuf += ev.text;
    } else if (ev.type === 'close') {
      if (ev.name === 'text' && textBuf !== null && formLang && entry) {
        const t = textBuf.replace(/\s+/g, ' ').trim();
        if (t) {
          if (within('example') && example) {
            if (within('translation')) { example.tr[formLang] = t; langs.translation.add(formLang); }
            else { example.form[formLang] = t; langs.example.add(formLang); }
          } else if (within('gloss') && sense) {
            (sense.gloss[formLang] ||= []).push(t);
            langs.gloss.add(formLang);
          } else if (within('citation')) {
            entry.citation[formLang] = t;
            langs.headword.add(formLang);
          } else if (within('lexical-unit')) {
            entry.lu[formLang] = t;
            langs.headword.add(formLang);
          }
        }
        textBuf = null;
      } else if (ev.name === 'form' || ev.name === 'gloss') {
        formLang = null;
      } else if (ev.name === 'example') {
        example = null;
      } else if (ev.name === 'sense' || ev.name === 'subsense') {
        senses.pop();
        sense = senses[senses.length - 1] || null;   // back to the parent sense
      } else if (ev.name === 'entry') {
        if (entry) entries.push(entry);
        entry = null;
        sense = null;
        senses.length = 0;
      }
      const i = stack.lastIndexOf(ev.name);
      if (i >= 0) stack.splice(i, 1);
    }
  }
  return { entries, counts,
    langs: Object.fromEntries(Object.entries(langs).map(([k, v]) => [k, [...v].sort()])) };
}

/**
 * A read LIFT dictionary as the two tables `data add` writes, for one pair
 * of its languages: `words` ([gloss in `src`, headword in `tgt`] — glosses
 * split on ";") and `examples` ([translation in `src`, example in `tgt`]).
 */
export function liftTables(lift, src, tgt) {
  const words = [];
  const examples = [];
  for (const e of lift.entries) {
    const head = e.citation[tgt] || e.lu[tgt];
    for (const s of e.senses) {
      if (head) {
        for (const g of s.gloss[src] || []) {
          for (const part of g.split(';').map((p) => p.trim()).filter(Boolean)) words.push([part, head]);
        }
      }
      for (const x of s.examples) {
        if (x.form[tgt] && x.tr[src]) examples.push([x.tr[src], x.form[tgt]]);
      }
    }
  }
  return [{ name: 'words', rows: words }, { name: 'examples', rows: examples }];
}

// ── ELAN (.eaf: transcribed recordings with translation tiers) ────────────

/**
 * An ELAN annotation file, by its tiers: each tier's id, parent, language
 * (LANG_REF, ELAN 5+) and annotations — a time-aligned one keeps its two
 * time slots, a reference annotation the annotation it refers to. Returns
 * {tiers: Map(id → {id, parent, lang, annots: Map(annId → {value, ts1, ts2,
 * ref})}), counts}. Content stays in memory: profiles describe tiers by id,
 * language and count only.
 */
export function readEaf(xml) {
  const tiers = new Map();
  let tier = null;
  let ann = null;
  let inValue = false;
  for (const ev of xmlEvents(xml)) {
    if (ev.type === 'open') {
      if (ev.name === 'TIER') {
        tier = { id: ev.attrs.TIER_ID, parent: ev.attrs.PARENT_REF || null,
          lang: ev.attrs.LANG_REF || null, annots: new Map() };
        tiers.set(tier.id, tier);
      } else if (tier && (ev.name === 'ALIGNABLE_ANNOTATION' || ev.name === 'REF_ANNOTATION')) {
        ann = { value: '', ts1: ev.attrs.TIME_SLOT_REF1 || null, ts2: ev.attrs.TIME_SLOT_REF2 || null,
          ref: ev.attrs.ANNOTATION_REF || null };
        tier.annots.set(ev.attrs.ANNOTATION_ID, ann);
      } else if (ann && ev.name === 'ANNOTATION_VALUE') {
        inValue = true;
      }
    } else if (ev.type === 'text') {
      if (inValue && ann) ann.value += ev.text;
    } else if (ev.type === 'close') {
      if (ev.name === 'ANNOTATION_VALUE') inValue = false;
      else if (ev.name === 'ALIGNABLE_ANNOTATION' || ev.name === 'REF_ANNOTATION') {
        if (ann) ann.value = ann.value.replace(/\s+/g, ' ').trim();
        ann = null;
      } else if (ev.name === 'TIER') tier = null;
    }
  }
  return { tiers, counts: { tiers: tiers.size,
    annotations: [...tiers.values()].reduce((n, t) => n + t.annots.size, 0) } };
}

/** The tiers, content-free: id, language, parent, how many annotations. */
export function eafTierProfile(eaf) {
  return [...eaf.tiers.values()].map((t) => ({ id: t.id, lang: t.lang, parent: t.parent,
    annotations: [...t.annots.values()].filter((a) => a.value).length }));
}

/**
 * Pairs [source text, target text] from two tiers: one refers to the other
 * (a translation tier under its transcription), or both are time-aligned on
 * the same time slots. Returns {rows, linked} — linked false when the two
 * tiers have no such link (then nothing is paired by guesswork).
 */
export function eafPairs(eaf, srcId, tgtId) {
  const S = eaf.tiers.get(srcId);
  const T = eaf.tiers.get(tgtId);
  if (!S || !T) return { rows: [], linked: false };
  const rows = [];
  const viaRef = (child, parent, childIsTarget) => {
    for (const a of child.annots.values()) {
      const p = a.ref ? parent.annots.get(a.ref) : null;
      if (p && p.value && a.value) rows.push(childIsTarget ? [p.value, a.value] : [a.value, p.value]);
    }
  };
  if (T.parent === S.id) viaRef(T, S, true);
  else if (S.parent === T.id) viaRef(S, T, false);
  else {
    const bySlots = new Map();
    for (const a of T.annots.values()) if (a.ts1 && a.ts2) bySlots.set(`${a.ts1}|${a.ts2}`, a);
    let linked = false;
    for (const a of S.annots.values()) {
      const b = a.ts1 && a.ts2 ? bySlots.get(`${a.ts1}|${a.ts2}`) : null;
      if (b) { linked = true; if (a.value && b.value) rows.push([a.value, b.value]); }
    }
    return { rows, linked };
  }
  return { rows, linked: true };
}

// ── readers ───────────────────────────────────────────────────────────────

function colIndex(ref) {
  const letters = /^([A-Z]+)/.exec(ref || '')?.[1];
  if (!letters) return null;
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

function readXlsx(entries, label) {
  const text = (name) => (entries.has(name) ? entries.get(name).toString('utf-8') : null);
  const shared = [];
  const ss = text('xl/sharedStrings.xml');
  if (ss) {
    let cur = null;
    let depthPh = 0;
    let inT = false;
    for (const ev of xmlEvents(ss)) {
      if (ev.type === 'open' && ev.name === 'si') cur = '';
      else if (ev.type === 'close' && ev.name === 'si') { shared.push(cur); cur = null; }
      else if (ev.type === 'open' && ev.name === 'rPh') depthPh++;
      else if (ev.type === 'close' && ev.name === 'rPh') depthPh--;
      else if (ev.type === 'open' && ev.name === 't') inT = true;
      else if (ev.type === 'close' && ev.name === 't') inT = false;
      else if (ev.type === 'text' && inT && cur !== null && depthPh === 0) cur += ev.text;
    }
  }
  const wb = text('xl/workbook.xml');
  const rels = text('xl/_rels/workbook.xml.rels') || '';
  if (!wb) throw new ImportError(`${label} is not an Excel workbook (.xlsx)`, 'open it and save it again as .xlsx');
  const relTarget = {};
  for (const ev of xmlEvents(rels)) {
    if (ev.type === 'open' && ev.name === 'Relationship') relTarget[ev.attrs.Id] = ev.attrs.Target;
  }
  const sheets = [];
  for (const ev of xmlEvents(wb)) {
    if (ev.type === 'open' && ev.name === 'sheet') {
      const target = relTarget[ev.attrs['r:id']] || '';
      const file = target.startsWith('/') ? target.slice(1) : `xl/${target.replace(/^\.\//, '')}`;
      sheets.push({ name: ev.attrs.name, file });
    }
  }
  return sheets.map(({ name, file }) => {
    const xml = text(file);
    if (!xml) throw new ImportError(`${label}: sheet "${name}" is missing from the workbook`, 'open it and save it again');
    const rows = [];
    let row = null;
    let cell = null;
    let inV = false;
    let inIs = false;
    let inT = false;
    for (const ev of xmlEvents(xml)) {
      if (ev.type === 'open' && ev.name === 'row') row = [];
      else if (ev.type === 'close' && ev.name === 'row') {
        rows.push(row);
        row = null;
      } else if (ev.type === 'open' && ev.name === 'c') {
        cell = { col: colIndex(ev.attrs.r) ?? (row ? row.length : 0), t: ev.attrs.t || 'n', v: '', is: '' };
      } else if (ev.type === 'close' && ev.name === 'c' && row && cell) {
        let value = cell.v;
        if (cell.t === 's') value = shared[Number(cell.v)] ?? '';
        else if (cell.t === 'inlineStr') value = cell.is;
        else if (cell.t === 'b') value = cell.v === '1' ? 'TRUE' : 'FALSE';
        while (row.length < cell.col) row.push('');
        row[cell.col] = value;
        cell = null;
      } else if (ev.type === 'open' && ev.name === 'v') inV = true;
      else if (ev.type === 'close' && ev.name === 'v') inV = false;
      else if (ev.type === 'open' && ev.name === 'is') inIs = true;
      else if (ev.type === 'close' && ev.name === 'is') inIs = false;
      else if (ev.type === 'open' && ev.name === 't') inT = true;
      else if (ev.type === 'close' && ev.name === 't') inT = false;
      else if (ev.type === 'text' && cell) {
        if (inV) cell.v += ev.text;
        else if (inIs && inT) cell.is += ev.text;
      }
    }
    return { name, rows };
  });
}

function readOds(entries, label) {
  const xml = entries.get('content.xml')?.toString('utf-8');
  if (!xml) throw new ImportError(`${label} is not an OpenDocument spreadsheet (.ods)`, 'open it and save it again as .ods');
  const sheets = [];
  let sheet = null;
  let row = null;
  let cell = null;
  let rowRepeat = 1;
  let colRepeat = 1;
  let pCount = 0;
  for (const ev of xmlEvents(xml)) {
    if (ev.type === 'open' && ev.name === 'table:table') sheet = { name: ev.attrs['table:name'], rows: [] };
    else if (ev.type === 'close' && ev.name === 'table:table' && sheet) { sheets.push(sheet); sheet = null; }
    else if (ev.type === 'open' && ev.name === 'table:table-row' && sheet) {
      row = [];
      rowRepeat = Math.min(Number(ev.attrs['table:number-rows-repeated'] || 1), 10000);
    } else if (ev.type === 'close' && ev.name === 'table:table-row' && sheet && row) {
      while (row.length && row[row.length - 1] === '') row.pop();
      if (row.length) for (let i = 0; i < rowRepeat; i++) sheet.rows.push([...row]);
      row = null;
    } else if (ev.type === 'open' && (ev.name === 'table:table-cell' || ev.name === 'table:covered-table-cell') && row) {
      cell = '';
      pCount = 0;
      colRepeat = Math.min(Number(ev.attrs['table:number-columns-repeated'] || 1), 1000);
      if (ev.self) { for (let i = 0; i < colRepeat; i++) row.push(''); cell = null; }
    } else if (ev.type === 'close' && (ev.name === 'table:table-cell' || ev.name === 'table:covered-table-cell') && row && cell !== null) {
      for (let i = 0; i < colRepeat; i++) row.push(cell);
      cell = null;
    } else if (ev.type === 'open' && ev.name === 'text:p' && cell !== null) {
      if (pCount++ > 0) cell += '\n';
    } else if (ev.type === 'open' && ev.name === 'text:s' && cell !== null) {
      cell += ' '.repeat(Number(ev.attrs['text:c'] || 1));
    } else if (ev.type === 'open' && ev.name === 'text:tab' && cell !== null) cell += '\t';
    else if (ev.type === 'open' && ev.name === 'text:line-break' && cell !== null) cell += '\n';
    else if (ev.type === 'text' && cell !== null) cell += ev.text;
  }
  return sheets;
}

function readDocx(entries, label) {
  const xml = entries.get('word/document.xml')?.toString('utf-8');
  if (!xml) throw new ImportError(`${label} is not a Word document (.docx)`, 'open it and save it again as .docx');
  const tables = [];
  const stack = [];
  let inT = false;
  for (const ev of xmlEvents(xml)) {
    if (ev.type === 'open' && ev.name === 'w:tbl') stack.push({ rows: [], row: null, cell: null, paras: 0 });
    const t = stack[stack.length - 1];
    if (ev.type === 'close' && ev.name === 'w:tbl') {
      const done = stack.pop();
      if (stack.length === 0) tables.push({ name: `table ${tables.length + 1}`, rows: done.rows });
      continue;
    }
    if (!t || stack.length > 1) continue; // nested tables: their text is part of the outer cell
    if (ev.type === 'open' && ev.name === 'w:tr') t.row = [];
    else if (ev.type === 'close' && ev.name === 'w:tr' && t.row) { t.rows.push(t.row); t.row = null; }
    else if (ev.type === 'open' && ev.name === 'w:tc' && t.row) { t.cell = ''; t.paras = 0; }
    else if (ev.type === 'close' && ev.name === 'w:tc' && t.row && t.cell !== null) { t.row.push(t.cell); t.cell = null; }
    else if (ev.type === 'open' && ev.name === 'w:p' && t.cell !== null) { if (t.paras++ > 0) t.cell += '\n'; }
    else if (ev.type === 'open' && ev.name === 'w:tab' && t.cell !== null) t.cell += '\t';
    else if (ev.type === 'open' && (ev.name === 'w:br' || ev.name === 'w:cr') && t.cell !== null) t.cell += '\n';
    else if (ev.type === 'open' && ev.name === 'w:t') inT = true;
    else if (ev.type === 'close' && ev.name === 'w:t') inT = false;
    else if (ev.type === 'text' && inT && t.cell !== null) t.cell += ev.text;
  }
  if (!tables.length) {
    throw new ImportError(`${label} has no table`, 'put the pairs in a two-column table in Word '
      + '(Insert → Table), or save them as a .txt with a TAB between each sentence and its translation');
  }
  return tables;
}

function sniffDelimiter(text) {
  const first = text.split(/\r?\n/).find((l) => l.trim()) || '';
  const outside = first.replace(/"[^"]*"/g, '');
  const semis = (outside.match(/;/g) || []).length;
  const commas = (outside.match(/,/g) || []).length;
  return semis > commas ? ';' : ',';
}

/**
 * Read a data file into sheets of rows.
 * @returns {{ format: string, sheets: Array<{ name: string, rows: string[][] }> }}
 */
// ── USFM scripture (one book per file) ────────────────────────────────────

/** Does this text read as USFM scripture (an \id book, chapters, verses)? */
export function looksLikeUsfm(text) {
  return /(^|\n)\s*\\id\s+[A-Z0-9]{3}\b/.test(text) && /\\c\s+\d/.test(text) && /\\v\s+\d/.test(text);
}

// spans whose text is never verse text: footnotes, cross-references, figures,
// inline quotation references, alternate/published numbers — and USFM 3
// milestones (\qt-s … \*)
const USFM_SPANS = /\\(f|fe|ef|x|ex|fig|rq|ca|va|vp)\s[\s\S]*?\\\1\*|\\[a-z]+\d*-[se]\b[^\\]*\\\*/g;
// markers whose line is not verse text: identification, titles, headings,
// introductions, remarks, labels
const USFM_NOT_VERSE = new RegExp('^(id|ide|h\\d?|toc\\d*|toca\\d*|mt\\d*|mte\\d*|ms\\d*|mr|s\\d*|sr|r|d|sp|sd\\d*|'
  + 'cl|cp|rem|sts|restore|periph|usfm|imt\\d*|is\\d*|ip|ipi|im|imi|ipq|imq|ipr|iq\\d*|ib|ili\\d*|iot|io\\d*|'
  + 'iex|imte\\d*|ie)$');

/**
 * Read one USFM book: {book, verses: Map("BOOK C:V" → text), counts}. A
 * verse's text runs from its \v to the next \v or \c, across paragraph and
 * poetry markers; footnotes, cross-references, headings, titles and
 * introductions are left out; character markers keep their words (\w
 * word|lemma\w* → word). A verse bridge (\v 1-2) keeps its range as written,
 * so it pairs only with the same bridge.
 */
export function readUsfm(text) {
  const clean = text.replace(USFM_SPANS, ' ');
  const verses = new Map();
  const counts = { chapters: 0, verses: 0 };
  let book = null;
  let chapter = null;
  let verse = null;
  const append = (s) => { if (verse) verses.set(verse, verses.get(verse) + s); };
  for (const seg of clean.split(/(?=\\\+?[A-Za-z]+\d*\*?)/)) {
    const m = /^\\\+?([A-Za-z]+\d*)(\*?)/.exec(seg);
    if (!m) { append(seg); continue; }
    const name = m[1].toLowerCase();
    let rest = seg.slice(m[0].length);
    if (m[2]) { append(rest); continue; }           // a closing marker: the text after it runs on
    rest = rest.replace(/^ /, '');                  // the space after a marker belongs to it
    if (name === 'id') {
      // a book code is three letters or digits (GEN, 1JN); anything else on
      // an \id line is the file's own text, never printed as a code
      const code = (rest.trim().split(/\s+/)[0] || '').toUpperCase();
      if (!/^[A-Z0-9]{3}$/.test(code)) {
        throw new ImportError('an \\id line here does not start with a three-character book code',
          'begin each book with \\id and its code (\\id GEN), as Paratext writes it');
      }
      book = code;
      chapter = null;
      verse = null;
    } else if (name === 'c') {
      chapter = Number.parseInt(rest, 10);
      verse = null;
      counts.chapters++;
    } else if (name === 'v') {
      const vm = /^\s*(\d+[a-z]?(?:[-–]\d+[a-z]?)?)\s?([\s\S]*)$/.exec(rest);
      verse = vm && book && Number.isInteger(chapter) ? `${book} ${chapter}:${vm[1].replace('–', '-')}` : null;
      if (verse && !verses.has(verse)) { verses.set(verse, ''); counts.verses++; }
      if (vm) append(vm[2]);
    } else if (USFM_NOT_VERSE.test(name)) {
      // its line is a heading, title or note — not verse text
    } else {
      append(name === 'w' ? rest.replace(/\|[\s\S]*$/, '') : rest);
    }
  }
  for (const [k, v] of verses) verses.set(k, v.replace(/\s+/g, ' ').trim().normalize('NFC'));
  return { book, verses, counts };
}

/**
 * A USFM text — one book's file, or a folder of them — as one verse map:
 * {verses, books: [codes], counts, sha256}. Refuses a file that is not USFM
 * and a book that appears twice; never pairs by guesswork.
 */
export function readUsfmInput(target) {
  const label = path.basename(target);
  const stat = fs.existsSync(target) ? fs.statSync(target) : null;
  if (!stat) throw new ImportError(`${label}: no such file or folder`);
  const files = stat.isDirectory()
    ? fs.readdirSync(target).filter((n) => /\.(usfm|sfm|txt)$/i.test(n) && !n.startsWith('.')).sort()
      .map((n) => path.join(target, n))
    : [target];
  const verses = new Map();
  const books = [];
  const counts = { books: 0, chapters: 0, verses: 0 };
  const hash = crypto.createHash('sha256');
  for (const f of files) {
    const buf = fs.readFileSync(f);
    const text = decodeText(buf, path.basename(f));
    if (!looksLikeUsfm(text)) {
      if (stat.isDirectory()) continue;             // a folder may hold other files
      throw new ImportError(`${path.basename(f)}: not USFM scripture (no \\id book with \\c chapters and \\v verses)`,
        'export the text as USFM (one book per file, as Paratext writes it)');
    }
    const one = readUsfm(text);
    if (books.includes(one.book)) {
      throw new ImportError(`${label}: book ${one.book} appears twice`, 'keep one file per book');
    }
    books.push(one.book);
    for (const [k, v] of one.verses) verses.set(k, v);
    counts.books++;
    counts.chapters += one.counts.chapters;
    counts.verses += one.counts.verses;
    hash.update(`${path.basename(f)}\0`).update(buf);
  }
  if (!counts.books) {
    throw new ImportError(`${label}: no USFM book in it`, 'point at a .usfm file, or a folder of them (one book per file)');
  }
  return { verses, books, counts, sha256: hash.digest('hex') };
}

/**
 * Pairs of the verses numbered the same in both texts, in the source's order:
 * {rows: [[source, target]], counts}. A verse only one text has (another
 * versification, a bridge in one and not the other) is left out and counted.
 */
export function usfmPairs(src, tgt) {
  const rows = [];
  let onlySource = 0;
  let emptySide = 0;
  for (const [ref, s] of src.verses) {
    if (!tgt.verses.has(ref)) { onlySource++; continue; }
    const t = tgt.verses.get(ref);
    if (!s || !t) { emptySide++; continue; }
    rows.push([s, t]);
  }
  const onlyTarget = [...tgt.verses.keys()].filter((r) => !src.verses.has(r)).length;
  return { rows, counts: { paired: rows.length, only_source: onlySource, only_target: onlyTarget,
    one_side_empty: emptySide } };
}

export function readTable(file) {
  const label = path.basename(file);
  const ext = path.extname(file).toLowerCase();
  if (!SUPPORTED.includes(ext)) {
    throw new ImportError(`${label}: champollion data add does not read '${ext || 'no extension'}' files`,
      `save it as .xlsx, .ods, .csv or .tsv (UTF-8), or put the pairs in a table in a .docx (readable: ${SUPPORTED.join(' ')})`);
  }
  const buf = fs.readFileSync(file);
  if (ext === '.xlsx') return { format: 'xlsx', sheets: readXlsx(unzip(buf, label), label) };
  if (ext === '.ods') return { format: 'ods', sheets: readOds(unzip(buf, label), label) };
  if (ext === '.docx') return { format: 'docx', sheets: readDocx(unzip(buf, label), label) };
  const text = decodeText(buf, label);
  // a LIFT dictionary (FieldWorks / FLEx): read by its elements and languages
  if (ext === '.lift' || /^\s*(<\?xml[^>]*>\s*)?<lift[\s>]/.test(text)) {
    const lift = readLift(text);
    if (!lift.counts.entries) {
      throw new ImportError(`${label}: no <entry> in it — not a LIFT dictionary this reader knows`,
        'export it from FieldWorks as LIFT (File → Export → LIFT)');
    }
    return { format: 'lift', lift, sheets: [], counts: lift.counts };
  }
  // an ELAN annotation file: pairs come from two linked tiers
  if (ext === '.eaf' || /<ANNOTATION_DOCUMENT[\s>]/.test(text.slice(0, 2000))) {
    const eaf = readEaf(text);
    if (!eaf.counts.tiers) {
      throw new ImportError(`${label}: no <TIER> in it — not an ELAN file this reader knows`,
        'save it from ELAN as .eaf (File → Save)');
    }
    return { format: 'elan', eaf, sheets: [], counts: eaf.counts };
  }
  if (ext === '.xml') {
    throw new ImportError(`${label}: an .xml file is read only as a LIFT dictionary, and this is not one`,
      'save the pairs as .xlsx, .ods, .csv or .tsv, or export a FieldWorks dictionary as LIFT');
  }
  // USFM scripture pairs with a SECOND text, verse by verse — only on request
  if (ext === '.usfm' || looksLikeUsfm(text)) {
    throw new ImportError(`${label}: USFM scripture — it pairs with a text in the other language, verse by verse, `
      + 'and only when asked',
      `champollion data add ${label} --usfm-source <the other language's text: a .usfm file or a folder of them>`);
  }
  // a Toolbox / MDF dictionary, whatever its extension (.txt, .db, .sfm, .lex)
  if (looksLikeToolbox(text)) {
    const { sheets, counts } = readToolbox(text);
    return { format: 'toolbox', sheets, counts };
  }
  if (['.sfm', '.db', '.lex'].includes(ext)) {
    throw new ImportError(`${label}: no \\lx record in it — not a Toolbox dictionary this reader knows`,
      'export it from Toolbox as Standard Format (MDF markers: \\lx, \\ge, \\xv, \\xe), UTF-8');
  }
  if (ext === '.csv') {
    const delimiter = sniffDelimiter(text);
    return { format: delimiter === ';' ? 'csv (semicolon)' : 'csv',
      sheets: [{ name: label, rows: parseCSV(text, { file: label, delimiter }) }] };
  }
  const rows = text.split(/\r?\n/).filter((l) => !/^#(\s|$)/.test(l)).map((l) => l.split('\t'));
  return { format: 'tsv', sheets: [{ name: label, rows }] };
}

// ── profiling (content-free) ──────────────────────────────────────────────

const LATIN = /\p{Script=Latin}/u;
const LETTER = /\p{L}/u;

export function columnLetter(i) {
  let s = '';
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

/** Per column: letter, non-empty share, mean length, share of letters in Latin script. */
export function profileColumns(rows) {
  const width = Math.max(0, ...rows.map((r) => r.length));
  const out = [];
  for (let c = 0; c < width; c++) {
    let filled = 0;
    let chars = 0;
    let letters = 0;
    let latin = 0;
    for (const r of rows) {
      const v = (r[c] ?? '').trim();
      if (!v) continue;
      filled++;
      chars += [...v].length;
      for (const ch of v) {
        if (LETTER.test(ch)) {
          letters++;
          if (LATIN.test(ch)) latin++;
        }
      }
    }
    out.push({
      column: columnLetter(c), index: c,
      filled: rows.length ? Math.round((filled / rows.length) * 100) / 100 : 0,
      mean_length: filled ? Math.round(chars / filled) : 0,
      latin_share: letters ? Math.round((latin / letters) * 100) / 100 : null,
    });
  }
  return out;
}
