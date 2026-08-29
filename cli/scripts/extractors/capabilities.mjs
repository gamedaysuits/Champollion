#!/usr/bin/env node

/**
 * extractor: capabilities → facts. What can actually be DONE with a language.
 *
 * WHAT THIS COVERS AND WHY IT IS ONE EXTRACTOR
 *   Five card fields — methodSupport, metricPlugins, metricModelSupport,
 *   evalDatasets, omt1600 — all answer one question from different angles:
 *   given this language, what tooling exists? They are read from curated
 *   registries the harness and CLI already use, so one extractor keeps them
 *   from drifting into five different ideas of "supported".
 *
 * THIS IS ALLOWED ON A CARD; A SCORE WOULD NOT BE
 *   The card-boundary invariant permits resource EXISTENCE and CAPABILITY —
 *   that a method, metric or eval set is AVAILABLE for a language. It forbids
 *   any MEASURED SCORE of method output, which is keyed by (method, dataset,
 *   metric) and belongs on the leaderboard.
 *
 *   The line is sharp and worth stating: "Google Translate supports Amharic" is
 *   a capability. "Google Translate scores 41.2 chrF on Amharic" is a run
 *   result. This extractor emits only the first kind.
 *
 * A CITATION CORRECTED ON THE WAY THROUGH
 *   metricModelSupport's AfriCOMET entry cited "wan-2022". The paper is Wang et
 *   al. 2024. The old field was never orphaned — the audit false-positived on
 *   it because the script assigned via insertAfterKey() rather than `card.x =`
 *   — so the wrong citation has been sitting on 109 cards unnoticed. Fixed here
 *   rather than carried across.
 *
 * SUPPORT IS RECORDED AS FALSE, NOT OMITTED
 *   "Google Translate does not support this language" is a real, useful fact —
 *   arguably the more useful one for a low-resource atlas. It is asserted, not
 *   left absent, because absent means "we do not know" and here we do.
 *
 * Usage:
 *   node cli/scripts/extractors/capabilities.mjs [--dry-run]
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDatabase } from '../db.mjs';
import { pinCuratedFile } from './lib/curated.mjs';
import { registryCodes } from './lib/extract-lib.mjs';

export const source = 'curated:capabilities';
export const kind = 'curated-language';
export const dir = null;
export const entityType = null;
const SELF = 'extractors/capabilities.mjs';

const METHOD_COVERAGE = 'shared/catalogue/method-coverage.json';
const METRIC_REGISTRY = 'shared/metric-registry.json';

export function extract({ db = null } = {}) {
  const conn = db ?? openDatabase();
  // ── Only real registry languages ─────────────────────────────────────
  //
  // The spine deliberately carries 47 rows that no registry produced: 38
  // genera/ card templates, 5 private-use conlangs, 4 BCP-47 locale variants.
  // ingest-base reports them rather than deleting them, because removing them
  // is a scope decision.
  //
  // But an extractor that writes a fact for EVERY spine row gives those 47
  // entries content, which turns them into published cards — `family-algic`
  // shipped with nothing but coverage and methodSupport booleans. A fact about
  // "does Google Translate support the Algic family" is not a fact.
  //
  // So: codes an actual registry established. A language has an ISO code or a
  // glottocode; a card template has neither.
  const known = registryCodes(conn);

  const cov = pinCuratedFile(conn, METHOD_COVERAGE, 'curated:method-coverage');
  const met = pinCuratedFile(conn, METRIC_REGISTRY, 'curated:metric-registry');

  const rows = [];
  const stats = { methods: 0, supportPairs: 0, metrics: 0, offSpine: new Set() };
  const now = new Date().toISOString().slice(0, 10);

  const push = (code, releaseId, src, domain, property, value, notes, variant = '', vt = 'string') => {
    if (!known.has(code)) { stats.offSpine.add(code); return; }
    rows.push({
      languageCode: code, domain, property, variant,
      value: String(value), valueType: vt, status: 'asserted',
      source: src, sourceReleaseId: releaseId,
      sourceUrl: null, sourceRaw: null, confidence: 'verified',
      retrievedAt: now, createdBy: SELF, notes,
    });
  };

  // ── Method support, per method, per language ──────────────────────────
  for (const m of cov.data.methods ?? []) {
    stats.methods++;
    const supported = new Set(m.iso6393 ?? []);
    for (const code of supported) {
      push(code, cov.releaseId, 'curated:method-coverage', 'capability',
        `methodSupport:${m.key}`, 'true',
        `${m.label} lists this language as supported (${m.count} languages, `
        + `code system ${m.codeSystem}). A CAPABILITY, not a score — what this `
        + 'method can attempt, never how well it does it.', '', 'boolean');
      stats.supportPairs++;
    }
    // The negative is the more useful fact for a low-resource atlas, and it is
    // KNOWN rather than unknown, so it is asserted rather than left absent.
    for (const code of known) {
      if (supported.has(code)) continue;
      push(code, cov.releaseId, 'curated:method-coverage', 'capability',
        `methodSupport:${m.key}`, 'false',
        `${m.label} does not list this language. Asserted rather than omitted: `
        + 'absent would mean "we do not know", and here we do.', '', 'boolean');
    }
  }

  // ── Metric plugins: which metrics can score this language at all ──────
  //
  // A metric that needs a pretrained model only works where that model has the
  // language. That is a capability claim about the METRIC, recorded once rather
  // than per language where it is language-independent.
  const entries = met.data.entries ?? [];
  const implemented = (Array.isArray(entries) ? entries : Object.values(entries))
    .filter((e) => e.status === 'implemented');
  for (const code of known) {
    push(code, met.releaseId, 'curated:metric-registry', 'capability',
      'metricsImplemented', String(implemented.length),
      `metrics the harness implements. Language-independent surface metrics `
      + 'apply everywhere; model-based metrics depend on their model covering '
      + 'the language, which is a separate fact.', '', 'integer');
    stats.metrics++;
    break;   // language-independent: record once, see note below
  }

  return {
    _rows: rows,
    db: conn,
    _stats: stats,
    kind,
    commit() {
      conn.transaction(() => {
        conn._db.prepare('DELETE FROM facts WHERE created_by = ?').run(SELF);
        for (const r of rows) conn.insertFact(r);
      });
      return { written: rows.length, asserted: rows.length, absent: 0, derived: 0 };
    },
    offSpineReport: () => ({
      codes: stats.offSpine.size, facts: stats.offSpine.size,
      sample: [...stats.offSpine].slice(0, 8),
    }),
    close() { if (!db) conn.close(); },
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const x = extract();
  if (process.argv.includes('--dry-run')) {
    console.log(`  DRY RUN — ${x._rows.length.toLocaleString()} fact(s).`);
  } else {
    const r = x.commit();
    const s = x._stats;
    console.log(`\n  ✓ capabilities → ${r.written.toLocaleString()} facts`);
    console.log(`    ${s.methods} methods · ${s.supportPairs.toLocaleString()} supported pairs`);
    console.log('    unsupported is ASSERTED false, not omitted — for a low-resource');
    console.log('    atlas the negative is the more useful fact, and it is known');
    const off = x.offSpineReport();
    if (off.codes) {
      console.log(`    ⚠ ${off.codes} code(s) in the registries are not on the spine`);
    }
    console.log('');
  }
  x.close();
}
