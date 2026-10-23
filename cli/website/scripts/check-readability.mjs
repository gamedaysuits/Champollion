#!/usr/bin/env node
/**
 * check-readability.mjs — how hard the people's docs are to read.
 *
 * The people's pages are written for two speakers with no technical or
 * linguistics background (docs redraft, founder 2026-10-12). This reports,
 * for every page in `peopleSidebar`, the reading grade of its TOP LAYER — the
 * page minus frontmatter, code, and its "Go deeper" section (the deliberately
 * technical layer for experts) — and every term of art used there.
 *
 * Grade: Flesch–Kincaid grade level, 0.39·(words/sentences) +
 * 11.8·(syllables/words) − 15.59, with a heuristic English syllable count.
 * It is a rough instrument (it cannot tell a plain long word from jargon),
 * so it is read beside the term list and the speaker-reader review, never
 * alone. Target: grade 8 or below.
 *
 * Terms: words a newcomer would not know. A term is fine once the page has
 * shown it in action — so each is reported with its line, for a person to
 * judge; the script does not decide.
 *
 *   node scripts/check-readability.mjs            # report
 *   node scripts/check-readability.mjs --json     # machine-readable
 *   node scripts/check-readability.mjs --max 8    # exit 1 if any page is above grade 8
 *
 * Reports; it is not a push gate.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sidebars from '../sidebars.js';

const SITE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DOCS = path.join(SITE, 'docs');

/** Terms of art a speaker reader would not know (lower-case match, word-bounded). */
export const TERMS = [
  'MT', 'NMT', 'LLM', 'MCP', 'CLI', 'API', 'JSON', 'chrF', 'chrF++', 'BLEU', 'COMET',
  'corpus', 'corpora', 'tokenizer', 'tokenizers', 'FST', 'fine-tune', 'fine-tuned',
  'held-out', 'near-twin', 'near-twins', 'dev set', 'pipeline', 'sidecar', 'schema',
  'checkpoint', 'epoch', 'epochs', 'inference', 'benchmark', 'baseline', 'metric',
  'metrics', 'preregistration', 'leak-audit', 'parallel text', 'orthography',
  'morphology', 'lexicon', 'model', 'models', 'dataset', 'datasets',
];

function idsOf(items) {
  const out = [];
  for (const it of items) {
    if (typeof it === 'string') out.push(it);
    else if (it.type === 'doc') out.push(it.id);
    else if (it.type === 'category') {
      if (it.link?.type === 'doc') out.push(it.link.id);
      out.push(...idsOf(it.items || []));
    }
  }
  return out;
}

function fileFor(id) {
  for (const ext of ['.md', '.mdx']) {
    const p = path.join(DOCS, id + ext);
    if (fs.existsSync(p)) return p;
  }
  throw new Error(`no doc file for sidebar id ${id}`);
}

/** The page's top layer as plain prose: no frontmatter, code, tags, links' targets, or "Go deeper". */
export function topLayer(src) {
  let s = src.replace(/^---\n[\s\S]*?\n---\n/, '');
  const deeper = s.search(/^##\s+Go deeper\b/m);
  if (deeper !== -1) s = s.slice(0, deeper);
  s = s
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' code ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^\s*\|?\s*-{3,}.*$/gm, ' ')
    .replace(/[|*_>#]/g, ' ');
  return s;
}

export function syllables(word) {
  const w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!w) return 0;
  if (w.length <= 3) return 1;
  const trimmed = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, '');
  const groups = trimmed.match(/[aeiouy]{1,2}/g);
  return Math.max(1, groups ? groups.length : 1);
}

export function grade(text) {
  // a list item or table row with no full stop is still one unit of reading
  const units = text.split(/(?<=[.!?])\s+|\n\s*\n|\n\s*(?=-|\d+\.)/).map((u) => u.trim()).filter((u) => /[A-Za-z]/.test(u));
  const words = text.match(/[A-Za-z][A-Za-z'’-]*/g) || [];
  if (!units.length || !words.length) return { grade: 0, words: 0, sentences: 0 };
  const syl = words.reduce((n, w) => n + syllables(w), 0);
  const g = 0.39 * (words.length / units.length) + 11.8 * (syl / words.length) - 15.59;
  return { grade: Math.round(g * 10) / 10, words: words.length, sentences: units.length };
}

export function termsIn(text) {
  const found = [];
  const lines = text.split('\n');
  for (const term of TERMS) {
    const re = new RegExp(`(^|[^A-Za-z])${term.replace(/[+]/g, '\\+')}(?![A-Za-z])`, term === term.toUpperCase() ? '' : 'i');
    lines.forEach((line, i) => { if (re.test(line)) found.push({ term, line: i + 1, text: line.trim().slice(0, 110) }); });
  }
  return found;
}

function main() {
  const args = process.argv.slice(2);
  const json = args.includes('--json');
  const maxAt = args.indexOf('--max');
  const max = maxAt !== -1 ? Number(args[maxAt + 1]) : null;
  const ids = idsOf(sidebars.peopleSidebar || []);
  const rows = ids.map((id) => {
    const src = fs.readFileSync(fileFor(id), 'utf8');
    const top = topLayer(src);
    return { id, ...grade(top), terms: termsIn(top) };
  });
  if (json) {
    process.stdout.write(JSON.stringify(rows, null, 2) + '\n');
  } else {
    for (const r of rows) {
      console.log(`${r.grade.toFixed(1).padStart(5)}  ${r.id}  (${r.words} words, ${r.sentences} sentences)`);
      for (const t of r.terms) console.log(`         term "${t.term}" — ${t.text}`);
    }
  }
  if (max !== null && rows.some((r) => r.grade > max)) process.exitCode = 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
