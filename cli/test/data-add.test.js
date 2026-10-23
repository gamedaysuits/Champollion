/**
 * data-add.test.js — `champollion data add` reads the files communities keep
 * (csv, tsv, xlsx, ods, docx tables), never guesses a column, never prints a
 * sentence, and writes the one format every tool reads.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { run as runNew } from '../lib/commands/new.js';
import { run as runData, markedSidecar, rowsToPairs } from '../lib/commands/data.js';
import { readTable, readToolbox, readLift, decodeText, ImportError } from '../lib/community-import.js';
import { nextStep } from '../lib/framework/journey.js';
import { checkProject } from '../lib/framework/index.js';
import { output } from '../lib/output.js';

async function quiet(fn) {
  const raw = output.raw;
  const error = output.error;
  const lines = [];
  output.raw = (s) => lines.push(String(s));
  output.error = (s) => lines.push(String(s));
  try {
    return { code: await fn(), text: lines.join('\n') };
  } finally {
    output.raw = raw;
    output.error = error;
  }
}

async function project() {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'data-add-'));
  await quiet(() => runNew({ _: ['new', 'p'], from: 'English', to: 'qaa', 'target-name': 'Our language' }, cwd));
  return path.join(cwd, 'p');
}

/** A zip with deflated entries, as office suites write them. */
function zip(entries) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const [name, text] of Object.entries(entries)) {
    const data = Buffer.from(text, 'utf-8');
    const comp = zlib.deflateRawSync(data);
    const nameBuf = Buffer.from(name, 'utf-8');
    const crc = zlib.crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(8, 8);
    local.writeUInt32LE(crc, 14); local.writeUInt32LE(comp.length, 18); local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6);
    central.writeUInt16LE(8, 10); central.writeUInt32LE(crc, 16); central.writeUInt32LE(comp.length, 20);
    central.writeUInt32LE(data.length, 24); central.writeUInt16LE(nameBuf.length, 28); central.writeUInt32LE(offset, 42);
    locals.push(local, nameBuf, comp);
    centrals.push(central, nameBuf);
    offset += 30 + nameBuf.length + comp.length;
  }
  const cd = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(Object.keys(entries).length, 8);
  eocd.writeUInt16LE(Object.keys(entries).length, 10); eocd.writeUInt32LE(cd.length, 12); eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, eocd]);
}

const XLSX = {
  'xl/workbook.xml': '<workbook xmlns:r="r"><sheets><sheet name="Words" sheetId="1" r:id="rId1"/></sheets></workbook>',
  'xl/_rels/workbook.xml.rels': '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>',
  'xl/sharedStrings.xml': '<sst><si><t>English</t></si><si><t>Our language</t></si><si><r><t>Good </t></r><r><t>morning.</t></r></si><si><t>zub &amp; kef</t></si></sst>',
  'xl/worksheets/sheet1.xml': '<worksheet><sheetData>'
    + '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row>'
    + '<row r="2"><c r="A2" t="s"><v>2</v></c><c r="B2" t="s"><v>3</v></c></row>'
    + '<row r="3"><c r="A3" t="inlineStr"><is><t>Thank you.</t></is></c><c r="C3" t="inlineStr"><is><t>stray</t></is></c></row>'
    + '<row r="4"><c r="A4" t="inlineStr"><is><t>Good night.</t></is></c><c r="B4" t="inlineStr"><is><t>zub nor</t></is></c></row>'
    + '</sheetData></worksheet>',
};

const ODS = {
  'content.xml': '<office:document-content><office:body><office:spreadsheet>'
    + '<table:table table:name="Sheet1">'
    + '<table:table-row><table:table-cell><text:p>English</text:p></table:table-cell><table:table-cell><text:p>Our language</text:p></table:table-cell><table:table-cell table:number-columns-repeated="1020"/></table:table-row>'
    + '<table:table-row><table:table-cell><text:p>Good</text:p><text:p>morning.</text:p></table:table-cell><table:table-cell><text:p>zub<text:s/>kef</text:p></table:table-cell></table:table-row>'
    + '<table:table-row table:number-rows-repeated="1000"><table:table-cell table:number-columns-repeated="3"/></table:table-row>'
    + '</table:table></office:spreadsheet></office:body></office:document-content>',
};

const DOCX = {
  'word/document.xml': '<w:document><w:body><w:p><w:r><w:t>Grandpa\'s words</w:t></w:r></w:p>'
    + '<w:tbl><w:tr><w:tc><w:p><w:r><w:t>English</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>Our language</w:t></w:r></w:p></w:tc></w:tr>'
    + '<w:tr><w:tc><w:p><w:r><w:t xml:space="preserve">Good </w:t></w:r><w:r><w:t>morning.</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>zub kef</w:t></w:r></w:p></w:tc></w:tr>'
    + '</w:tbl></w:body></w:document>',
};

describe('readers', () => {
  it('xlsx: shared strings, rich runs, inline strings, gaps by cell reference', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ci-'));
    const f = path.join(dir, 'w.xlsx');
    fs.writeFileSync(f, zip(XLSX));
    const t = readTable(f);
    assert.equal(t.sheets[0].name, 'Words');
    assert.deepEqual(t.sheets[0].rows[1], ['Good morning.', 'zub & kef']);
    assert.deepEqual(t.sheets[0].rows[2], ['Thank you.', '', 'stray']);
  });

  it('ods: repeated empty cells and rows are not expanded into data; paragraphs join', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ci-'));
    const f = path.join(dir, 'w.ods');
    fs.writeFileSync(f, zip(ODS));
    const rows = readTable(f).sheets[0].rows;
    assert.equal(rows.length, 2);
    assert.deepEqual(rows[1], ['Good\nmorning.', 'zub kef']);
  });

  it('docx: the table, not the paragraphs around it', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ci-'));
    const f = path.join(dir, 'w.docx');
    fs.writeFileSync(f, zip(DOCX));
    assert.deepEqual(readTable(f).sheets[0].rows, [['English', 'Our language'], ['Good morning.', 'zub kef']]);
  });

  it('semicolon CSV keeps quoted commas and semicolons', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ci-'));
    const f = path.join(dir, 'w.csv');
    fs.writeFileSync(f, 'English;Our language\n"Yes, please; now.";zub\n');
    const t = readTable(f);
    assert.equal(t.format, 'csv (semicolon)');
    assert.deepEqual(t.sheets[0].rows[1], ['Yes, please; now.', 'zub']);
  });

  it('UTF-16 with a BOM is read; other bytes are refused, never guessed', () => {
    assert.equal(decodeText(Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from('a\tb', 'utf16le')])), 'a\tb');
    assert.throws(() => decodeText(Buffer.from([0x61, 0xe9, 0x62]), 'x.txt'), (e) => e instanceof ImportError && /not UTF-8/.test(e.message));
  });

  it('an unknown format is refused with what to do', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ci-'));
    const f = path.join(dir, 'w.pdf');
    fs.writeFileSync(f, '%PDF');
    assert.throws(() => readTable(f), /does not read '\.pdf'.*\n  fix: save it as/s);
  });
});

describe('champollion data add', () => {
  it('a spreadsheet whose header names the languages goes straight in', async () => {
    const root = await project();
    fs.writeFileSync(path.join(root, 'inbox', 'grandpa.xlsx'), zip(XLSX));
    const r = await quiet(() => runData({ _: ['data', 'add', 'inbox/grandpa.xlsx'] }, root));
    assert.equal(r.code, 0, r.text);
    assert.match(r.text, /2 pair\(s\)/);
    assert.match(r.text, /left out 1 row\(s\) with one side empty/);
    assert.ok(!r.text.includes('Good morning') && !r.text.includes('zub'), 'never prints a sentence');
    const tsv = fs.readFileSync(path.join(root, 'data/parallel/grandpa.tsv'), 'utf-8');
    assert.equal(tsv, 'Good morning.\tzub & kef\nGood night.\tzub nor\n');
    const side = JSON.parse(fs.readFileSync(path.join(root, 'data/parallel/grandpa.tsv.champollion.json'), 'utf-8'));
    assert.equal(side.transmission, 'local-only');
    assert.equal(side['x-transmission-default'], true);
    assert.equal(side['x-import'].source_column, 'A');
    assert.equal(checkProject(root).ok, true);
  });

  it('a guessed sheet name is refused with the way in: its one sheet needs no name', async () => {
    // model ladder, 2026-10-11: "Sheet1" was refused with only the list of
    // sheets, never tried again, and the file's pairs were left out
    const root = await project();
    fs.writeFileSync(path.join(root, 'inbox', 'grandpa.xlsx'), zip(XLSX));
    const r = await quiet(() => runData({ _: ['data', 'add', 'inbox/grandpa.xlsx'], sheet: 'Nope' }, root));
    assert.equal(r.code, 1);
    assert.match(r.text, /no sheet "Nope" — its one sheet with data is "[^"]+": add it again without --sheet \(MCP add_data: leave "sheet" out\)/);
  });

  it('ambiguous columns are asked, described without their content', async () => {
    const root = await project();
    fs.writeFileSync(path.join(root, 'inbox', 'list.tsv'), 'Good morning.\tzub kef\nThank you.\tmol tav\n');
    const r = await quiet(() => runData({ _: ['data', 'add', 'inbox/list.tsv'] }, root));
    assert.equal(r.code, 1);
    assert.match(r.text, /which column holds English and which holds Our language/);
    assert.match(r.text, /A: 100% filled/);
    assert.ok(!r.text.includes('Good morning'), 'columns are described, never quoted');
    const ok = await quiet(() => runData({ _: ['data', 'add', 'inbox/list.tsv'], 'source-col': 'A', 'target-col': 'B' }, root));
    assert.equal(ok.code, 0, ok.text);
  });

  it('"a header" said of a sentence pair never puts the pair in the column question', async () => {
    // model ladder round 7: GPT-5 nano said a header-less file had a header,
    // and the "which column" refusal quoted that row — a family sentence,
    // canary and all — as the column labels
    const root = await project();
    fs.writeFileSync(path.join(root, 'inbox', 'notes.txt'), 'Good morning qzx1.\tzub kef qzx1\nThank you.\tmol tav\n');
    const r = await quiet(() => runData({ _: ['data', 'add', 'inbox/notes.txt'], header: true }, root));
    assert.equal(r.code, 1);
    assert.match(r.text, /which column holds English/);
    assert.ok(!r.text.includes('qzx1') && !r.text.includes('Good morning') && !r.text.includes('zub'),
      `never a cell the tool cannot tell is a label: ${r.text}`);
    assert.match(r.text, /A \(a header cell of 18 characters\): /);
    // a header that names the languages is a label, and is shown as one
    fs.writeFileSync(path.join(root, 'inbox', 'named.tsv'), 'English\tnotes\nGood day.\tzub\n');
    const named = await quiet(() => runData({ _: ['data', 'add', 'inbox/named.tsv'], header: true }, root));
    assert.equal(named.code, 1);
    assert.match(named.text, /A "English": /);
    assert.match(named.text, /B \(a header cell of 5 characters\): /);
  });

  it('"no header" said of a file whose first row names the languages says it is a header', async () => {
    // Haiku acceptance run, 2026-10-11: the brief's "no header row" was about
    // another file; the tool asked which column was which instead of saying
    // the first row was a header naming them
    const root = await project();
    fs.writeFileSync(path.join(root, 'inbox', 'checked.tsv'),
      'English\tOur language\nGood morning.\tzub kef\nThank you.\tmol tav\n');
    const r = await quiet(() => runData({ _: ['data', 'add', 'inbox/checked.tsv'], into: 'test', 'no-header': true }, root));
    assert.equal(r.code, 1);
    assert.match(r.text, /its first row names English and Our language, as a header row does/);
    assert.match(r.text, /without --no-header .*champollion data add inbox\/checked\.tsv --into test/);
    assert.ok(!r.text.includes('Good morning'), 'it names the languages, never a sentence');
    // …with the columns named as well: the header row was imported as a
    // sentence pair (GPT-6 Luna acceptance run, 2026-10-11)
    const cols = await quiet(() => runData({ _: ['data', 'add', 'inbox/checked.tsv'], into: 'test',
      'no-header': true, 'source-col': 'A', 'target-col': 'B' }, root));
    assert.equal(cols.code, 1);
    assert.match(cols.text, /as a header row does/);
    const ok = await quiet(() => runData({ _: ['data', 'add', 'inbox/checked.tsv'], into: 'test' }, root));
    assert.equal(ok.code, 0, ok.text);
    const rows = fs.readFileSync(path.join(root, 'data/test/checked.tsv'), 'utf-8').trim().split('\n');
    assert.equal(rows.length, 2, 'two sentence pairs, no header row among them');
  });

  it('a first row naming only one language is asked about, never read as a sentence pair', async () => {
    // wave 1, 2026-10-12: "English | Our language" in a project the family
    // named otherwise (or whose code was picked for them) — the columns were
    // given, the header never mentioned, and 17 of 55 test sets held that row
    const root = await project();
    const pj = path.join(root, 'champollion.project.json');
    const doc = JSON.parse(fs.readFileSync(pj, 'utf-8'));
    doc.pair.target_name = 'Our family language';
    fs.writeFileSync(pj, JSON.stringify(doc, null, 2));
    fs.writeFileSync(path.join(root, 'inbox', 'checked.tsv'),
      'English\tOur language\nGood morning.\tzub kef\nThank you.\tmol tav\n');
    const asked = await quiet(() => runData({ _: ['data', 'add', 'inbox/checked.tsv'], into: 'test',
      'source-col': 'A', 'target-col': 'B' }, root));
    assert.equal(asked.code, 1);
    assert.match(asked.text, /its first row names English in column A, as a header row would — is that row a header\?/);
    assert.match(asked.text, /--header \(a header row, left out\) or --no-header \(a sentence pair, kept\), with the same columns/);
    assert.ok(!asked.text.includes('Our language') && !asked.text.includes('Good morning'),
      'it names the pair\'s language, never a cell it cannot tell is a label');
    const ok = await quiet(() => runData({ _: ['data', 'add', 'inbox/checked.tsv'], into: 'test', header: true,
      'source-col': 'A', 'target-col': 'B' }, root));
    assert.equal(ok.code, 0, ok.text);
    const rows = fs.readFileSync(path.join(root, 'data/test/checked.tsv'), 'utf-8').trim().split('\n');
    assert.equal(rows.length, 2, 'two sentence pairs, the header left out');
    assert.ok(rows[0].startsWith('Good morning.'));
    assert.ok(!ok.text.includes('does not name'), 'a header that names English is not called nameless');
    // a first row that is a sentence pair is never taken for a header
    fs.writeFileSync(path.join(root, 'inbox', 'plain.tsv'), 'English is hard to learn.\tzub kef mol\nThank you.\tmol tav\n');
    const plain = await quiet(() => runData({ _: ['data', 'add', 'inbox/plain.tsv'], 'source-col': 'A', 'target-col': 'B' }, root));
    assert.equal(plain.code, 0, plain.text);
  });

  it('a Word table and an ODS sheet import the same way; multi-line cells are joined and counted', async () => {
    const root = await project();
    fs.writeFileSync(path.join(root, 'inbox', 'notes.docx'), zip(DOCX));
    fs.writeFileSync(path.join(root, 'inbox', 'sheet.ods'), zip(ODS));
    assert.equal((await quiet(() => runData({ _: ['data', 'add', 'inbox/notes.docx'] }, root))).code, 0);
    const ods = await quiet(() => runData({ _: ['data', 'add', 'inbox/sheet.ods'] }, root));
    assert.equal(ods.code, 0, ods.text);
    assert.match(ods.text, /joined 1 cell/);
    assert.equal(fs.readFileSync(path.join(root, 'data/parallel/sheet.tsv'), 'utf-8'), 'Good morning.\tzub kef\n');
  });

  it('never overwrites an earlier import', async () => {
    const root = await project();
    fs.writeFileSync(path.join(root, 'inbox', 'notes.docx'), zip(DOCX));
    await quiet(() => runData({ _: ['data', 'add', 'inbox/notes.docx'] }, root));
    const again = await quiet(() => runData({ _: ['data', 'add', 'inbox/notes.docx'] }, root));
    assert.equal(again.code, 1);
    assert.match(again.text, /already exists/);
    // the same original: --replace is offered; another file of that name is not
    assert.match(again.text, /add --replace/);
    fs.writeFileSync(path.join(root, 'inbox', 'other.tsv'), 'English\tOur language\nOne.\tzub\n');
    fs.mkdirSync(path.join(root, 'inbox', 'sub'));
    fs.writeFileSync(path.join(root, 'inbox', 'sub', 'notes.tsv'), 'English\tOur language\nTwo.\tkef\n');
    const clash = await quiet(() => runData({ _: ['data', 'add', 'inbox/sub/notes.tsv'], replace: true }, root));
    assert.equal(clash.code, 1);
    assert.match(clash.text, /--name <stem>/);
  });

  it('a header said of a row that names neither language is said back; --replace reads it again, answers kept', async () => {
    // model ladder, 2026-10-11: an 8B model said a header-less file had a
    // header, and a sentence pair was dropped as one
    const root = await project();
    fs.writeFileSync(path.join(root, 'inbox', 'old.txt'), 'Good morning.\tzub kef\nThank you.\tmora\n');
    const wrong = await quiet(() => runData({ _: ['data', 'add', 'inbox/old.txt'], header: true,
      'source-col': 'A', 'target-col': 'B' }, root));
    assert.equal(wrong.code, 0, wrong.text);
    assert.match(wrong.text, /first row was left out as a header, as asked — it does not name English or Our language/);
    assert.match(wrong.text, /"header": false, "replace": true/);
    const out = path.join(root, 'data/parallel/old.tsv');
    assert.equal(fs.readFileSync(out, 'utf-8').trim().split('\n').length, 1);
    // the holders answered meanwhile: their answers survive the re-read
    const side = `${out}.champollion.json`;
    const marked = markedSidecar(JSON.parse(fs.readFileSync(side, 'utf-8')),
      { training: 'allowed', owner: 'Grandpa', localOnly: true });
    assert.ok(marked.doc, JSON.stringify(marked));
    fs.writeFileSync(side, JSON.stringify(marked.doc));
    const fixed = await quiet(() => runData({ _: ['data', 'add', 'inbox/old.txt'], 'no-header': true,
      'source-col': 'A', 'target-col': 'B', replace: true }, root));
    assert.equal(fixed.code, 0, fixed.text);
    assert.match(fixed.text, /replaced what data add made from this file before — its holders' answers are kept/);
    assert.doesNotMatch(fixed.text, /left out as a header/);
    assert.equal(fs.readFileSync(out, 'utf-8').trim().split('\n').length, 2);
    const after = JSON.parse(fs.readFileSync(side, 'utf-8'));
    const { 'x-import': _a, written_by: _c, ...answersAfter } = after;
    const { 'x-import': _b, written_by: _d, ...answersBefore } = marked.doc;
    assert.deepEqual(answersAfter, answersBefore);
    assert.equal(after['x-import'].header, false);
  });

  it('--into test makes a protected test set; the rails then ask the holders about the rest', async () => {
    const root = await project();
    fs.writeFileSync(path.join(root, 'inbox', 'notes.docx'), zip(DOCX));
    fs.writeFileSync(path.join(root, 'inbox', 'grandpa.xlsx'), zip(XLSX));
    await quiet(() => runData({ _: ['data', 'add', 'inbox/grandpa.xlsx'] }, root));
    await quiet(() => runData({ _: ['data', 'add', 'inbox/notes.docx'], into: 'test' }, root));
    let r = nextStep(root, { findTool: () => null });
    assert.equal(r.step.mode, 'ask_user', 'the holders decide the terms of the parallel data');
    // the default local-only mark is the tool's, so the holders may lift it
    const lifted = await quiet(() => runData({ _: ['data', 'mark', 'data/parallel/grandpa.tsv'],
      training: 'allowed', 'speakers-agreed': 'yes', 'may-leave': true }, root));
    assert.equal(lifted.code, 0, lifted.text);
    const side = JSON.parse(fs.readFileSync(path.join(root, 'data/parallel/grandpa.tsv.champollion.json'), 'utf-8'));
    assert.equal(side.transmission, undefined);
    assert.equal(side['x-transmission-default'], undefined);
    // …but once the holders said local-only, it only gets stricter
    await quiet(() => runData({ _: ['data', 'mark', 'data/parallel/grandpa.tsv'], 'local-only': true }, root));
    const refused = await quiet(() => runData({ _: ['data', 'mark', 'data/parallel/grandpa.tsv'], 'may-leave': true }, root));
    assert.equal(refused.code, 1);
    // the imported test set is already protected (local-only, never trained on)
    r = nextStep(root, { findTool: () => null });
    assert.equal(r.stage.id, 'tools');
    assert.deepEqual(r.done.slice(-3), ['test-file', 'one-test-file', 'test-marked']);
  });
});

const TOOLBOX = [
  '\\_sh v3.0  400  MDF 4.0', '',
  '\\lx kef', '\\ps n', '\\ge morning; dawn', '\\xv kef zub', '\\xe good', '   morning', '',
  '\\lx mol', '\\lc moli', '\\ge water', '\\se moltav', '\\ge river water',
  '\\xv moli nor', '\\xe water at night', '\\xv tav', '',
].join('\n');

describe('characters a community writes', () => {
  it('keeps every character, and says when a letter was stored in composed form', () => {
    const rows = [['the dog', 'ᐊᑎᒼ'], ['NFD', 'wa\u0302pahtam'], ['zwj', 'ka\u200dna'], ['glottal', 'ʔaha'],
      ['quotes', 'ki’ta ki\'ta'], ['rtl', 'مرحبا']];
    const { pairs, report } = rowsToPairs(rows, 0, 1, { header: false });
    assert.equal(report.nfc_composed_cells, 1, 'only the decomposed accent changed form');
    assert.equal(pairs[1][1], 'wâpahtam'.normalize('NFC'));
    for (const i of [0, 2, 3, 4, 5]) assert.equal(pairs[i][1], rows[i][1], `row ${i} kept byte for byte`);
  });
});

describe('a Toolbox / MDF dictionary', () => {
  it('reads words and examples by their markers, never by the text', () => {
    const t = readToolbox(TOOLBOX);
    assert.deepEqual(t.sheets[0].rows, [['morning', 'kef'], ['dawn', 'kef'], ['water', 'moli'], ['river water', 'moltav']]);
    assert.deepEqual(t.sheets[1].rows, [['good morning', 'kef zub'], ['water at night', 'moli nor']]);
    assert.deepEqual(t.counts, { records: 2, subentries: 1, glosses: 4, examples: 2, examples_without_translation: 1 });
  });

  it('data add: the words become the word list, the examples the pairs — no column to ask about', async () => {
    const root = await project();
    fs.writeFileSync(path.join(root, 'inbox', 'dict.txt'), TOOLBOX);
    const words = await quiet(() => runData({ _: ['data', 'add', 'inbox/dict.txt'], into: 'lexicon' }, root));
    assert.equal(words.code, 0, words.text);
    assert.match(words.text, /4 pair\(s\) from a Toolbox dictionary \(2 record\(s\); English gloss \\ge → headword \\lx\)/);
    assert.match(words.text, /2 example sentence\(s\)/);
    assert.ok(!words.text.includes('morning'), 'counts, never words');
    assert.equal(fs.readFileSync(path.join(root, 'data/lexicon/dict-words.tsv'), 'utf-8').trim().split('\n').length, 4);
    const side = JSON.parse(fs.readFileSync(path.join(root, 'data/lexicon/dict-words.tsv.champollion.json'), 'utf-8'));
    assert.equal(side.kind, 'lexicon');
    assert.deepEqual(side['x-import'].markers, { source: '\\ge', target: '\\lx (\\lc, \\se)' });
    const ex = await quiet(() => runData({ _: ['data', 'add', 'inbox/dict.txt'] }, root));
    assert.equal(ex.code, 0, ex.text);
    assert.equal(fs.readFileSync(path.join(root, 'data/parallel/dict-examples.tsv'), 'utf-8'),
      'good morning\tkef zub\nwater at night\tmoli nor\n');
  });

  it('refuses a dictionary whose glosses are not the project\'s source language, and a file with no records', async () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'data-add-'));
    await quiet(() => runNew({ _: ['new', 'p'], from: 'French', to: 'qaa', 'target-name': 'Our language' }, cwd));
    const root = path.join(cwd, 'p');
    fs.writeFileSync(path.join(root, 'inbox', 'dict.txt'), TOOLBOX);
    const r = await quiet(() => runData({ _: ['data', 'add', 'inbox/dict.txt'], into: 'lexicon' }, root));
    assert.equal(r.code, 1);
    assert.match(r.text, /English by the MDF standard, and this project translates from French/);
    fs.writeFileSync(path.join(root, 'inbox', 'empty.sfm'), 'just notes\n');
    const e = await quiet(() => runData({ _: ['data', 'add', 'inbox/empty.sfm'] }, root));
    assert.equal(e.code, 1);
    assert.match(e.text, /no \\lx record/);
  });
});

const LIFT = `<?xml version="1.0" encoding="UTF-8"?>
<lift version="0.13">
  <entry id="kef">
    <lexical-unit><form lang="qaa"><text>kef</text></form></lexical-unit>
    <sense>
      <gloss lang="en"><text>morning; dawn</text></gloss>
      <gloss lang="fr"><text>matin</text></gloss>
      <example>
        <form lang="qaa"><text>kef <span>zub</span></text></form>
        <translation type="Free translation"><form lang="en"><text>good morning</text></form></translation>
      </example>
    </sense>
  </entry>
  <entry id="mol">
    <lexical-unit><form lang="qaa"><text>mol</text></form></lexical-unit>
    <citation><form lang="qaa"><text>moli</text></form></citation>
    <sense>
      <gloss lang="en"><text>water</text></gloss>
      <subsense><gloss lang="en"><text>river water</text></gloss></subsense>
    </sense>
    <sense><gloss lang="en"><text>rain</text></gloss></sense>
  </entry>
</lift>
`;

describe('a LIFT dictionary (FieldWorks / FLEx)', () => {
  it('reads headwords, glosses and examples by their elements and languages', () => {
    const l = readLift(LIFT);
    assert.deepEqual(l.counts, { entries: 2, senses: 4, examples: 1 });
    assert.deepEqual(l.langs, { headword: ['qaa'], gloss: ['en', 'fr'], example: ['qaa'], translation: ['en'] });
    // the citation form wins; a subsense is a sense of its own; a <span> is joined in
    assert.equal(l.entries[1].citation.qaa, 'moli');
    assert.deepEqual(l.entries[1].senses.map((s) => s.gloss.en), [['water'], ['river water'], ['rain']]);
    assert.equal(l.entries[0].senses[0].examples[0].form.qaa, 'kef zub');
  });

  it('data add: the pair is matched through the cards; words and examples by their languages', async () => {
    const root = await project();
    fs.writeFileSync(path.join(root, 'inbox', 'dict.lift'), LIFT);
    const words = await quiet(() => runData({ _: ['data', 'add', 'inbox/dict.lift'], into: 'lexicon' }, root));
    assert.equal(words.code, 0, words.text);
    assert.match(words.text, /5 pair\(s\) from a LIFT dictionary \(2 entries; gloss \[en\] → headword \[qaa\]\)/);
    assert.match(words.text, /1 example sentence\(s\)/);
    assert.ok(!words.text.includes('morning'), 'counts, never words');
    assert.equal(fs.readFileSync(path.join(root, 'data/lexicon/dict-words.tsv'), 'utf-8'),
      'morning\tkef\ndawn\tkef\nwater\tmoli\nriver water\tmoli\nrain\tmoli\n');
    const side = JSON.parse(fs.readFileSync(path.join(root, 'data/lexicon/dict-words.tsv.champollion.json'), 'utf-8'));
    assert.deepEqual(side['x-import'].lift_languages, { source: 'en', target: 'qaa' });
    const ex = await quiet(() => runData({ _: ['data', 'add', 'inbox/dict.lift'] }, root));
    assert.equal(ex.code, 0, ex.text);
    assert.equal(fs.readFileSync(path.join(root, 'data/parallel/dict-examples.tsv'), 'utf-8'), 'good morning\tkef zub\n');
  });

  it('asks which language is which when the file cannot say; refuses an .xml that is not LIFT', async () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'data-add-'));
    await quiet(() => runNew({ _: ['new', 'p'], from: 'German', to: 'qaa', 'target-name': 'Our language' }, cwd));
    const root = path.join(cwd, 'p');
    fs.writeFileSync(path.join(root, 'inbox', 'dict.lift'), LIFT);
    const r = await quiet(() => runData({ _: ['data', 'add', 'inbox/dict.lift'], into: 'lexicon' }, root));
    assert.equal(r.code, 1);
    assert.match(r.text, /glosses and translations in en, fr — and which is German/);
    // naming another known language is refused: the sidecar would say German
    const named = await quiet(() => runData({ _: ['data', 'add', 'inbox/dict.lift'], into: 'lexicon',
      'source-col': 'fr', 'target-col': 'qaa' }, root));
    assert.equal(named.code, 1);
    assert.match(named.text, /fr is French, and this project's source is German/);
    fs.writeFileSync(path.join(root, 'inbox', 'notes.xml'), '<notes><n>hi</n></notes>');
    const x = await quiet(() => runData({ _: ['data', 'add', 'inbox/notes.xml'] }, root));
    assert.equal(x.code, 1);
    assert.match(x.text, /read only as a LIFT dictionary/);
  });
});

const EAF = (langs = true) => `<?xml version="1.0" encoding="UTF-8"?>
<ANNOTATION_DOCUMENT AUTHOR="" FORMAT="3.0" VERSION="3.0">
  <HEADER MEDIA_FILE="" TIME_UNITS="milliseconds"/>
  <TIME_ORDER>
    <TIME_SLOT TIME_SLOT_ID="ts1" TIME_VALUE="0"/><TIME_SLOT TIME_SLOT_ID="ts2" TIME_VALUE="900"/>
    <TIME_SLOT TIME_SLOT_ID="ts3" TIME_VALUE="1000"/><TIME_SLOT TIME_SLOT_ID="ts4" TIME_VALUE="2000"/>
  </TIME_ORDER>
  <TIER TIER_ID="Transcription" LINGUISTIC_TYPE_REF="default-lt"${langs ? ' LANG_REF="qaa"' : ''}>
    <ANNOTATION><ALIGNABLE_ANNOTATION ANNOTATION_ID="a1" TIME_SLOT_REF1="ts1" TIME_SLOT_REF2="ts2"><ANNOTATION_VALUE>kef zub</ANNOTATION_VALUE></ALIGNABLE_ANNOTATION></ANNOTATION>
    <ANNOTATION><ALIGNABLE_ANNOTATION ANNOTATION_ID="a2" TIME_SLOT_REF1="ts3" TIME_SLOT_REF2="ts4"><ANNOTATION_VALUE>mol tav</ANNOTATION_VALUE></ALIGNABLE_ANNOTATION></ANNOTATION>
  </TIER>
  <TIER TIER_ID="Translation" LINGUISTIC_TYPE_REF="translation" PARENT_REF="Transcription"${langs ? ' LANG_REF="eng"' : ''}>
    <ANNOTATION><REF_ANNOTATION ANNOTATION_ID="a3" ANNOTATION_REF="a1"><ANNOTATION_VALUE>good morning</ANNOTATION_VALUE></REF_ANNOTATION></ANNOTATION>
    <ANNOTATION><REF_ANNOTATION ANNOTATION_ID="a4" ANNOTATION_REF="a2"><ANNOTATION_VALUE>thank you</ANNOTATION_VALUE></REF_ANNOTATION></ANNOTATION>
  </TIER>
  <TIER TIER_ID="Notes" LINGUISTIC_TYPE_REF="default-lt">
    <ANNOTATION><ALIGNABLE_ANNOTATION ANNOTATION_ID="a5" TIME_SLOT_REF1="ts1" TIME_SLOT_REF2="ts4"><ANNOTATION_VALUE>laughs</ANNOTATION_VALUE></ALIGNABLE_ANNOTATION></ANNOTATION>
  </TIER>
</ANNOTATION_DOCUMENT>
`;

describe('an ELAN file (.eaf)', () => {
  it('pairs the translation tier with the transcription it refers to — matched by LANG_REF', async () => {
    const root = await project();
    fs.writeFileSync(path.join(root, 'inbox', 'visit.eaf'), EAF());
    const r = await quiet(() => runData({ _: ['data', 'add', 'inbox/visit.eaf'] }, root));
    assert.equal(r.code, 0, r.text);
    assert.match(r.text, /2 pair\(s\) from an ELAN file \(tier 2 → tier 1\)/);
    assert.ok(!r.text.includes('Transcription') && !r.text.includes('Translation'), 'tier names stay in the file');
    assert.ok(!r.text.includes('good morning'), 'counts, never sentences');
    assert.equal(fs.readFileSync(path.join(root, 'data/parallel/visit.tsv'), 'utf-8'),
      'good morning\tkef zub\nthank you\tmol tav\n');
    const side = JSON.parse(fs.readFileSync(path.join(root, 'data/parallel/visit.tsv.champollion.json'), 'utf-8'));
    assert.deepEqual(side['x-import'].elan_tiers, { source: 2, target: 1 });
  });

  it('without languages it asks (tiers by number, language and count only — a tier id can be a person\'s name); unlinked tiers are refused', async () => {
    const root = await project();
    fs.writeFileSync(path.join(root, 'inbox', 'visit.eaf'), EAF(false));
    const asked = await quiet(() => runData({ _: ['data', 'add', 'inbox/visit.eaf'] }, root));
    assert.equal(asked.code, 1);
    assert.match(asked.text, /which tier holds English.*tier 1 \(no language, 2 annotation\(s\)\); tier 2 \(no language, 2 annotation\(s\), under tier 1\); tier 3 \(no language, 1 annotation\(s\)\)/s);
    assert.ok(!asked.text.includes('kef zub'));
    assert.ok(!/Transcription|Translation|Notes/.test(asked.text), 'tier names stay in the file');
    const named = await quiet(() => runData({ _: ['data', 'add', 'inbox/visit.eaf'],
      'source-col': '2', 'target-col': '1' }, root));
    assert.equal(named.code, 0, named.text);
    const byId = await quiet(() => runData({ _: ['data', 'add', 'inbox/visit.eaf'], name: 'by-id',
      'source-col': 'Translation', 'target-col': 'Transcription' }, root));
    assert.equal(byId.code, 0, 'the person may type a tier id they can see in their own file');
    const missing = await quiet(() => runData({ _: ['data', 'add', 'inbox/visit.eaf'], name: 'nine',
      'source-col': '9', 'target-col': '1' }, root));
    assert.match(missing.text, /no such tier — tiers: tier 1/);
    const unlinked = await quiet(() => runData({ _: ['data', 'add', 'inbox/visit.eaf'], name: 'notes',
      'source-col': '3', 'target-col': '1' }, root));
    assert.equal(unlinked.code, 1);
    assert.match(unlinked.text, /not linked .* never paired by guesswork/);
  });
});

const USFM = (verses) => `\\id GEN invented test book
\\h Beginnings
\\mt1 Beginnings
\\c 1
\\s1 A heading, never a verse
\\p
${verses.map(([v, t]) => `\\v ${v} ${t}`).join('\n')}
`;

describe('USFM scripture (opt-in, never trained on until its holders say)', () => {
  async function texts(root) {
    fs.mkdirSync(path.join(root, 'inbox', 'ours'));
    fs.writeFileSync(path.join(root, 'inbox', 'ours', 'GEN.usfm'),
      USFM([[1, 'zub \\w kef|lemma="k"\\w* mol.\\f + \\fr 1:1 \\ft a note\\f*'], [2, 'tav nor.'], ['3-4', 'lam piv.']]));
    fs.writeFileSync(path.join(root, 'inbox', 'english.usfm'),
      USFM([[1, 'In the morning the house.'], [2, 'The dog runs.'], [3, 'Three.'], [4, 'Four.']]));
  }

  it('an \\id line with no book code is refused without printing what follows it', async () => {
    // the book code is printed (books paired, x-import): only ever a code
    const root = await project();
    await texts(root);
    const ours = path.join(root, 'inbox', 'ours', 'GEN.usfm');
    fs.writeFileSync(ours, `${fs.readFileSync(ours, 'utf-8')}\n\\id morning zub kef\n\\c 2\n\\v 1 tav.\n`);
    const r = await quiet(() => runData({ _: ['data', 'add', 'inbox/ours'], 'usfm-source': 'inbox/english.usfm' }, root));
    assert.equal(r.code, 1);
    assert.match(r.text, /an \\id line here does not start with a three-character book code/);
    assert.ok(!/morning|MORNING|zub/.test(r.text), r.text);
  });

  it('--usfm-source given for a file that is not scripture says to leave it out', async () => {
    // model ladder round 6: Llama 3.1 8B passed "usfm_source": "none" with the
    // family's notes, and was told to export them as USFM
    const root = await project();
    await texts(root);
    fs.writeFileSync(path.join(root, 'inbox', 'notes.txt'), 'Good night.\tzub nor\n');
    const none = await quiet(() => runData({ _: ['data', 'add', 'inbox/notes.txt'], 'usfm-source': 'none' }, root));
    assert.equal(none.code, 1);
    assert.match(none.text, /none: no such file or folder\. --usfm-source is only for scripture/);
    assert.match(none.text, /leave "usfm_source" out\): champollion data add inbox\/notes\.txt/);
    const notUsfm = await quiet(() => runData({ _: ['data', 'add', 'inbox/notes.txt'],
      'usfm-source': 'inbox/english.usfm' }, root));
    assert.equal(notUsfm.code, 1);
    assert.match(notUsfm.text, /notes\.txt: not USFM scripture .*--usfm-source is only for scripture/s);
  });

  it('pairs verses numbered the same; holds training back until the holders answer', async () => {
    const root = await project();
    await texts(root);
    const bare = await quiet(() => runData({ _: ['data', 'add', 'inbox/english.usfm'] }, root));
    assert.equal(bare.code, 1);
    assert.match(bare.text, /USFM scripture .* only when asked.*--usfm-source/s);
    const r = await quiet(() => runData({ _: ['data', 'add', 'inbox/ours'], 'usfm-source': 'inbox/english.usfm' }, root));
    assert.equal(r.code, 0, r.text);
    assert.match(r.text, /2 verse pair\(s\) from USFM scripture \(english\.usfm → ours; book\(s\) GEN; 3 verse\(s\) numbered in one text only, left out\)/);
    assert.match(r.text, /no model may learn from it for now: .*copyright/);
    assert.ok(!r.text.includes('morning'), 'counts, never sentences');
    assert.equal(fs.readFileSync(path.join(root, 'data/parallel/ours.tsv'), 'utf-8'),
      'In the morning the house.\tzub kef mol.\nThe dog runs.\ttav nor.\n');
    const side = JSON.parse(fs.readFileSync(path.join(root, 'data/parallel/ours.tsv.champollion.json'), 'utf-8'));
    assert.deepEqual(side.terms, { training: 'not-allowed' });
    assert.equal(side['x-training-default'], true);
    assert.equal(side['x-import'].usfm.paired, 2);

    // the rails still ask its holders; their first answer may lift the caution
    const r1 = nextStep(root, { findTool: () => '/bin/true' });
    assert.equal(r1.step?.id.split(':')[0], 'terms', JSON.stringify(r1.step));
    const lifted = await quiet(() => runData({ _: ['data', 'mark', 'data/parallel/ours.tsv'], training: 'allowed',
      owner: 'the translation committee', 'local-only': true }, root));
    assert.equal(lifted.code, 0, lifted.text);
    const after = JSON.parse(fs.readFileSync(path.join(root, 'data/parallel/ours.tsv.champollion.json'), 'utf-8'));
    assert.equal(after.terms.training, 'allowed');
    assert.equal(after['x-training-default'], undefined);
    // …and once decided, only stricter
    const back = await quiet(() => runData({ _: ['data', 'mark', 'data/parallel/ours.tsv'], training: 'not-allowed',
      'local-only': true }, root));
    assert.equal(back.code, 0, back.text);
    const loosen = await quiet(() => runData({ _: ['data', 'mark', 'data/parallel/ours.tsv'], training: 'allowed',
      'local-only': true }, root));
    assert.equal(loosen.code, 1);
  });

  it('combine waits for the holders while the caution stands', async () => {
    const root = await project();
    await texts(root);
    await quiet(() => runData({ _: ['data', 'add', 'inbox/ours'], 'usfm-source': 'inbox/english.usfm' }, root));
    fs.writeFileSync(path.join(root, 'inbox', 'a.tsv'), 'English\tOur language\nGood morning.\tzub kef\n');
    await quiet(() => runData({ _: ['data', 'add', 'inbox/a.tsv'] }, root));
    await quiet(() => runData({ _: ['data', 'mark', 'data/parallel/a.tsv'], training: 'allowed', owner: 'x',
      'speakers-agreed': 'yes', 'local-only': true }, root));
    const r = await quiet(() => runData({ _: ['data', 'combine'] }, root));
    assert.equal(r.code, 1);
    assert.match(r.text, /ours\.tsv: its holders have not said yet/);
    assert.ok(fs.existsSync(path.join(root, 'data/parallel/ours.tsv')), 'nothing moved');
  });
});

describe('whose words a file holds (wave 1: a family chat exported without asking anyone)', () => {
  const base = { transmission: 'local-only', terms: {} };
  it('words of people who have not agreed yet, or who said no, are never trained on', () => {
    const notYet = markedSidecar(base, { speakers: 'the family chat', speakersAgreed: 'not-yet', owner: 'Mum', localOnly: true });
    assert.equal(notYet.error, undefined);
    assert.deepEqual(notYet.doc.terms, { training: 'not-allowed', owner: 'Mum', speakers: 'the family chat', speakers_agreed: 'not-yet' });
    assert.match(markedSidecar(base, { speakers: 'the family chat', speakersAgreed: 'not-yet', training: 'allowed', localOnly: true }).error,
      /have not agreed yet, so no model may learn from it: mark it --training not-allowed now/);
    assert.match(markedSidecar(base, { speakers: 'Auntie\'s notebooks', speakersAgreed: 'some-said-no', training: 'allowed', localOnly: true }).error,
      /said no, so no model may learn from it: take their words out into another file/);
    assert.match(markedSidecar(base, { speakersAgreed: 'maybe', localOnly: true }).error, /--speakers-agreed must be one of yes, not-yet, some-said-no/);
  });
  it('the agreement a not-yet waited for lifts it; a no is never lifted by a command', () => {
    const notYet = markedSidecar(base, { speakers: 'the family chat', speakersAgreed: 'not-yet', localOnly: true }).doc;
    const agreed = markedSidecar(notYet, { speakersAgreed: 'yes', training: 'allowed', localOnly: true });
    assert.equal(agreed.error, undefined);
    assert.equal(agreed.doc.terms.training, 'allowed');
    assert.equal(agreed.doc.terms.speakers_agreed, 'yes');
    // a not-allowed the holders chose themselves stays theirs to undo
    const chosen = markedSidecar(base, { speakers: 'our own', speakersAgreed: 'yes', training: 'not-allowed', localOnly: true }).doc;
    assert.match(markedSidecar(chosen, { speakersAgreed: 'yes', training: 'allowed', localOnly: true }).error, /only ever gets stricter/);
    const no = markedSidecar(base, { speakers: 'Auntie', speakersAgreed: 'some-said-no', localOnly: true }).doc;
    assert.match(markedSidecar(no, { speakersAgreed: 'yes', localOnly: true }).error, /said no, and a sidecar only ever gets stricter/);
  });
});

describe('champollion data combine', () => {
  async function twoFiles() {
    const root = await project();
    fs.writeFileSync(path.join(root, 'inbox', 'a.tsv'), 'English\tOur language\nGood morning.\tzub kef\nThank you.\tmol tav\n');
    fs.writeFileSync(path.join(root, 'inbox', 'b.tsv'), 'English\tOur language\nThank you.\tmol tav\nGood night.\tzub nor\n');
    await quiet(() => runData({ _: ['data', 'add', 'inbox/a.tsv'] }, root));
    await quiet(() => runData({ _: ['data', 'add', 'inbox/b.tsv'] }, root));
    return root;
  }

  async function decided(root, f, owner, where) {
    const r = await quiet(() => runData({ _: ['data', 'mark', `data/parallel/${f}.tsv`], training: 'allowed',
      owner, 'speakers-agreed': 'yes', [where]: true }, root));
    assert.equal(r.code, 0, r.text);
  }

  it('waits for the holders: a file nobody has spoken for is not merged', async () => {
    const root = await twoFiles();
    const r = await quiet(() => runData({ _: ['data', 'combine'] }, root));
    assert.equal(r.code, 1);
    assert.match(r.text, /holders have not said yet/);
    assert.ok(fs.existsSync(path.join(root, 'data/parallel/a.tsv')), 'nothing moved');
  });

  it('one file, the strictest terms, exact repeats left out, originals moved', async () => {
    const root = await twoFiles();
    await decided(root, 'a', 'the family', 'may-leave');
    await decided(root, 'b', 'Grandpa', 'local-only');
    const r = await quiet(() => runData({ _: ['data', 'combine'] }, root));
    assert.equal(r.code, 0, r.text);
    assert.match(r.text, /3 pair\(s\) \(1 exact repeat/);
    assert.ok(!r.text.includes('Good morning'), 'counts, never sentences');
    assert.deepEqual(fs.readdirSync(path.join(root, 'data/parallel')).sort(),
      ['combined.tsv', 'combined.tsv.champollion.json']);
    assert.equal(fs.readFileSync(path.join(root, 'data/parallel/combined.tsv'), 'utf-8').trim().split('\n').length, 3);
    const side = JSON.parse(fs.readFileSync(path.join(root, 'data/parallel/combined.tsv.champollion.json'), 'utf-8'));
    assert.equal(side.transmission, 'local-only', 'one local-only file makes the whole local-only');
    assert.deepEqual(side.terms, { training: 'allowed', owner: 'the family; Grandpa', speakers_agreed: 'yes' });
    assert.deepEqual(side['x-combined-from'].map((f) => f.file), ['a.tsv', 'b.tsv']);
    for (const f of ['a.tsv', 'a.tsv.champollion.json', 'b.tsv', 'b.tsv.champollion.json']) {
      assert.ok(fs.existsSync(path.join(root, 'data/combined-from', f)), `${f} kept`);
    }
  });

  it('a file whose speakers have not agreed yet waits aside, and rejoins once they have', async () => {
    // wave 1: four of five late-aunt runs ended at "I'll ask Lea and come back"
    const root = await twoFiles();
    await decided(root, 'a', 'the family', 'local-only');
    const notYet = await quiet(() => runData({ _: ['data', 'mark', 'data/parallel/b.tsv'], owner: 'Lea',
      speakers: 'Aunt Rose', 'speakers-agreed': 'not-yet', 'local-only': true }, root));
    assert.equal(notYet.code, 0, notYet.text);
    assert.match(notYet.text, /words of Aunt Rose \(not agreed yet\)/);
    // the rails go on with the other files, and say what waits
    let next = nextStep(root);
    assert.notEqual(next.step.id.split(':')[0], 'terms');
    assert.deepEqual(next.waiting.map((w) => w.file), ['data/parallel/b.tsv']);
    assert.match(next.waiting[0].question, /\(Aunt Rose\) agreed now/);
    // the holders' training answer is asked with the yes, never written for them
    assert.equal(next.waiting[0].command, 'champollion data mark data/parallel/b.tsv --speakers-agreed yes --training {training}');
    assert.deepEqual(next.waiting[0].answers.training.enum, ['allowed', 'not-allowed']);
    const c = await quiet(() => runData({ _: ['data', 'combine'] }, root));
    assert.equal(c.code, 0, c.text);
    assert.ok(fs.existsSync(path.join(root, 'data/not-for-training/b.tsv')), 'set aside, kept');
    next = nextStep(root);
    assert.deepEqual(next.waiting.map((w) => w.file), ['data/not-for-training/b.tsv']);
    const yes = await quiet(() => runData({ _: ['data', 'mark', 'data/not-for-training/b.tsv'],
      'speakers-agreed': 'yes', training: 'allowed' }, root));
    assert.equal(yes.code, 0, yes.text);
    assert.match(yes.text, /its speakers agreed: it is back in data\/parallel\/b\.tsv, and the next combine joins it/);
    assert.ok(fs.existsSync(path.join(root, 'data/parallel/b.tsv')));
    assert.ok(fs.existsSync(path.join(root, 'data/parallel/b.tsv.champollion.json')));
    assert.equal(nextStep(root).waiting, undefined);
  });

  it('when the speakers agree, the holders may still say no model learns from it', async () => {
    const root = await twoFiles();
    await decided(root, 'a', 'the family', 'local-only');
    await quiet(() => runData({ _: ['data', 'mark', 'data/parallel/b.tsv'], owner: 'Lea',
      speakers: 'Aunt Rose', 'speakers-agreed': 'not-yet', 'local-only': true }, root));
    const no = await quiet(() => runData({ _: ['data', 'mark', 'data/parallel/b.tsv'],
      'speakers-agreed': 'yes', training: 'not-allowed' }, root));
    assert.equal(no.code, 0, no.text);
    const side = JSON.parse(fs.readFileSync(path.join(root, 'data/parallel/b.tsv.champollion.json'), 'utf-8'));
    assert.equal(side.terms.speakers_agreed, 'yes');
    assert.equal(side.terms.training, 'not-allowed', 'their no stands');
  });

  it('a later round joins the new file onto the previous version, which is kept', async () => {
    // wave 1, 2026-10-11: a family that added sentences after its first model
    // was stopped by "combined.tsv already exists" — the improve loop's round 2
    const root = await twoFiles();
    await decided(root, 'a', 'the family', 'local-only');
    await decided(root, 'b', 'Grandpa', 'local-only');
    assert.equal((await quiet(() => runData({ _: ['data', 'combine'] }, root))).code, 0);
    fs.writeFileSync(path.join(root, 'inbox', 'round2.tsv'), 'English\tOur language\nGood evening.\tzub lam\nThank you.\tmol tav\n');
    await quiet(() => runData({ _: ['data', 'add', 'inbox/round2.tsv'] }, root));
    await decided(root, 'round2', 'Grandpa', 'local-only');
    const r = await quiet(() => runData({ _: ['data', 'combine'] }, root));
    assert.equal(r.code, 0, r.text);
    assert.match(r.text, /2 files → .*combined\.tsv: 4 pair\(s\) \(1 exact repeat.*version 2; version 1 kept as data\/combined-from\/combined-v1\.tsv/);
    const rows = fs.readFileSync(path.join(root, 'data/parallel/combined.tsv'), 'utf-8').trim().split('\n');
    assert.equal(rows.length, 4);
    assert.equal(rows[3], 'Good evening.\tzub lam', 'the earlier version first, the new file after');
    const side = JSON.parse(fs.readFileSync(path.join(root, 'data/parallel/combined.tsv.champollion.json'), 'utf-8'));
    assert.equal(side['x-version'], 2);
    assert.deepEqual(side['x-combined-from'].map((f) => f.file), ['combined-v1.tsv', 'round2.tsv']);
    for (const f of ['combined-v1.tsv', 'combined-v1.tsv.champollion.json', 'round2.tsv', 'a.tsv']) {
      assert.ok(fs.existsSync(path.join(root, 'data/combined-from', f)), `${f} kept`);
    }
    assert.ok(!r.text.includes('Good evening'), 'counts, never sentences');
  });

  it('a file its holders said no model may learn from is left out — not made everyone\'s "no"', async () => {
    const root = await twoFiles();
    fs.writeFileSync(path.join(root, 'inbox', 'c.tsv'), 'English\tOur language\nGood evening.\tzub lam\n');
    await quiet(() => runData({ _: ['data', 'add', 'inbox/c.tsv'] }, root));
    await decided(root, 'a', 'the family', 'local-only');
    await decided(root, 'b', 'the family', 'local-only');
    const no = await quiet(() => runData({ _: ['data', 'mark', 'data/parallel/c.tsv'], training: 'not-allowed',
      owner: 'Auntie', 'local-only': true }, root));
    assert.equal(no.code, 0, no.text);
    const r = await quiet(() => runData({ _: ['data', 'combine'] }, root));
    assert.equal(r.code, 0, r.text);
    assert.match(r.text, /2 files → .*combined\.tsv: 3 pair/);
    assert.match(r.text, /left out 1 file\(s\) its holders said no model may learn from \(c\.tsv\).*data\/not-for-training/s);
    const side = JSON.parse(fs.readFileSync(path.join(root, 'data/parallel/combined.tsv.champollion.json'), 'utf-8'));
    assert.equal(side.terms.training, 'allowed', 'the file training reads can be trained on');
    assert.ok(!fs.readFileSync(path.join(root, 'data/parallel/combined.tsv'), 'utf-8').includes('zub lam'));
    for (const f of ['c.tsv', 'c.tsv.champollion.json']) {
      assert.ok(fs.existsSync(path.join(root, 'data/not-for-training', f)), `${f} kept`);
    }
  });

  it('one file a model may learn from is the file training reads; none at all is refused', async () => {
    const root = await twoFiles();
    await decided(root, 'a', 'the family', 'local-only');
    const mark = (f) => quiet(() => runData({ _: ['data', 'mark', `data/parallel/${f}.tsv`], training: 'not-allowed',
      owner: 'Auntie', 'local-only': true }, root));
    assert.equal((await mark('b')).code, 0);
    const r = await quiet(() => runData({ _: ['data', 'combine'] }, root));
    assert.equal(r.code, 0, r.text);
    assert.match(r.text, /a\.tsv is the one file training reads — nothing to combine/);
    assert.deepEqual(fs.readdirSync(path.join(root, 'data/parallel')).sort(), ['a.tsv', 'a.tsv.champollion.json']);
    // every file a "no": nothing to train on, and nothing moves
    const other = await twoFiles();
    for (const f of ['a', 'b']) {
      const m = await quiet(() => runData({ _: ['data', 'mark', `data/parallel/${f}.tsv`], training: 'not-allowed',
        owner: 'Auntie', 'local-only': true }, other));
      assert.equal(m.code, 0, m.text);
    }
    const none = await quiet(() => runData({ _: ['data', 'combine'] }, other));
    assert.equal(none.code, 1);
    assert.match(none.text, /nothing to train on; nothing was moved/);
    assert.ok(fs.existsSync(path.join(other, 'data/parallel/a.tsv')));
  });

  it('the rails run it: the one-corpus step is auto, with the command', async () => {
    const root = await twoFiles();
    await decided(root, 'a', 'the family', 'local-only');
    await decided(root, 'b', 'the family', 'local-only');
    fs.writeFileSync(path.join(root, 'inbox', 'checked.tsv'), 'English\tOur language\nGood evening.\tzub lam\n');
    await quiet(() => runData({ _: ['data', 'add', 'inbox/checked.tsv'], into: 'test' }, root));
    // stand-ins for the tools stage: the workshop exists and knows the test set
    fs.mkdirSync(path.join(root, '.forge'), { recursive: true });
    fs.writeFileSync(path.join(root, '.forge', 'eval-registry.json'),
      JSON.stringify({ sets: { 'project-test': { role: 'test', path: path.join(root, 'data/test/checked.tsv') } } }));
    const r = nextStep(root, { findTool: () => '/bin/true' });
    assert.equal(r.step?.mode, 'auto', JSON.stringify(r.step));
    assert.equal(r.step.command, 'champollion data combine');
  });

  it('a word list comes in with --into lexicon, and the rails measure its floor after the split', async () => {
    const root = await twoFiles();
    fs.writeFileSync(path.join(root, 'inbox', 'words.tsv'), 'English\tOur language\nmorning\tkef\nthank you\tmol tav\n');
    const added = await quiet(() => runData({ _: ['data', 'add', 'inbox/words.tsv'], into: 'lexicon' }, root));
    assert.equal(added.code, 0, added.text);
    const side = JSON.parse(fs.readFileSync(path.join(root, 'data/lexicon/words.tsv.champollion.json'), 'utf-8'));
    assert.equal(side.kind, 'lexicon');
    assert.equal(side.role, 'resource');
    // the stand-ins of everything up to the split: one corpus, terms decided,
    // a protected test set, the workshop, the screen, the prediction, the dev set
    await decided(root, 'a', 'the family', 'local-only');
    await decided(root, 'b', 'the family', 'local-only');
    await quiet(() => runData({ _: ['data', 'combine'] }, root));
    const marked = await quiet(() => runData({ _: ['data', 'mark', 'data/lexicon/words.tsv'], training: 'allowed',
      owner: 'Grandpa', 'speakers-agreed': 'yes', 'local-only': true }, root));
    assert.equal(marked.code, 0, marked.text);
    fs.writeFileSync(path.join(root, 'inbox', 'checked.tsv'), 'English\tOur language\nGood evening.\tzub lam\n');
    await quiet(() => runData({ _: ['data', 'add', 'inbox/checked.tsv'], into: 'test' }, root));
    fs.mkdirSync(path.join(root, '.forge'), { recursive: true });
    fs.writeFileSync(path.join(root, '.forge', 'eval-registry.json'),
      JSON.stringify({ sets: { 'project-test': { role: 'test', path: path.join(root, 'data/test/checked.tsv') }, 'project-dev': { role: 'dev' } } }));
    fs.writeFileSync(path.join(root, '.forge', 'ledger.jsonl'),
      '{"event":"audit-verdict"}\n{"event":"prereg"}\n');
    // the screen left enough to train on (the enough-to-train step)
    fs.mkdirSync(path.join(root, 'data', 'clean'), { recursive: true });
    fs.writeFileSync(path.join(root, 'data/clean/p.clean.jsonl'),
      Array.from({ length: 30 }, (_, i) => JSON.stringify({ i })).join('\n') + '\n');
    let r = nextStep(root, { findTool: () => '/bin/true' });
    assert.equal(r.step?.mode, 'auto', JSON.stringify(r.step));
    assert.equal(r.step.command, 'nmt-forge floor data/lexicon/words.tsv');
    // measured: the rails move on to training (forge's own advice)
    fs.appendFileSync(path.join(root, '.forge', 'ledger.jsonl'), '{"event":"floor"}\n');
    const forge = () => ({ status: 0, stdout: JSON.stringify({ advice: { state: 'ready-to-train',
      next_command: 'nmt-forge run config.json --detach', why: 'train' }, snapshot: {} }) });
    r = nextStep(root, { findTool: () => '/bin/true', spawn: forge });
    assert.equal(r.step.command, 'nmt-forge run config.json --detach');
    // …and with no word list, the floor step never comes up
    fs.rmSync(path.join(root, 'data/lexicon'), { recursive: true });
    fs.writeFileSync(path.join(root, '.forge', 'ledger.jsonl'), '{"event":"audit-verdict"}\n{"event":"prereg"}\n');
    r = nextStep(root, { findTool: () => '/bin/true', spawn: forge });
    assert.equal(r.step.command, 'nmt-forge run config.json --detach');
  });

  it('refuses a file data add did not write', async () => {
    const root = await twoFiles();
    await decided(root, 'a', 'the family', 'local-only');
    await decided(root, 'b', 'the family', 'local-only');
    fs.writeFileSync(path.join(root, 'data/parallel/notes.jsonl'), '{}\n');
    const r = await quiet(() => runData({ _: ['data', 'combine'] }, root));
    assert.equal(r.code, 1);
    assert.match(r.text, /only \.tsv files/);
  });
});
