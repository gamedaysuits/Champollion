/**
 * Unit tests for leaderboard data utilities.
 *
 * Run with: node --experimental-vm-modules src/utils/leaderboardUtils.test.mjs
 * (Uses Node's built-in test runner — no dependencies required.)
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Since we're ESM and the util file is also ESM, direct import works.
import {
  buildListingUrl,
  mapRow,
  formatPair,
  formatMetric,
  formatCost,
  formatDate,
  sanitizeSearch,
  DB_TRUST_TO_DISPLAY,
  SORT_KEY_TO_COLUMN,
  PAGE_SIZE,
} from "./leaderboardUtils.js";

// ---------------------------------------------------------------------------
// buildListingUrl
// ---------------------------------------------------------------------------

describe("buildListingUrl", () => {
  const base = {
    supabaseUrl: "https://example.supabase.co",
    listingSelect: "id,model_slug",
    srcFilter: "any",
    tgtFilter: "any",
    modelFilter: "any",
    tierFilter: "any",
    trustFilter: "any",
    searchQuery: "",
    activeCondition: "all",
    sortKey: "composite",
    sortDir: "desc",
    conditionGroups: [],
  };

  it("includes trust!=disqualified by default", () => {
    const url = buildListingUrl(base);
    assert.ok(url.includes("trust=neq.disqualified"), "should exclude disqualified");
  });

  it("applies source language filter", () => {
    const url = buildListingUrl({ ...base, srcFilter: "eng" });
    assert.ok(url.includes("language_pair=like.eng%3E%25"), "should filter source");
  });

  it("applies target language filter", () => {
    const url = buildListingUrl({ ...base, tgtFilter: "zul" });
    assert.ok(url.includes("language_pair=like.%25%3Ezul"), "should filter target");
  });

  it("applies exact pair when both src and tgt set", () => {
    const url = buildListingUrl({ ...base, srcFilter: "eng", tgtFilter: "zul" });
    assert.ok(url.includes("language_pair=eq.eng%3Ezul"), "should exact match pair");
  });

  it("applies model filter", () => {
    const url = buildListingUrl({ ...base, modelFilter: "gpt-4o" });
    assert.ok(url.includes("model_slug=eq.gpt-4o"), "should filter model");
  });

  it("applies tier filter", () => {
    const url = buildListingUrl({ ...base, tierFilter: "Fluent" });
    assert.ok(url.includes("quality_tier=eq.Fluent"), "should filter tier");
  });

  it("applies method class filter", () => {
    const url = buildListingUrl({ ...base, methodClassFilter: "pipeline" });
    assert.ok(url.includes("method_class=eq.pipeline"), "should filter method_class");
  });

  it("skips method class filter for 'any' / undefined", () => {
    assert.ok(!buildListingUrl({ ...base, methodClassFilter: "any" }).includes("method_class=eq"));
    assert.ok(!buildListingUrl(base).includes("method_class=eq"));
  });

  it("applies paradigm filter when the column is available", () => {
    const url = buildListingUrl({ ...base, paradigmFilter: "rule-based", paradigmAvailable: true });
    assert.ok(url.includes("paradigm=eq.rule-based"), "should filter paradigm");
  });

  it("omits paradigm filter when the column is unavailable (pre-030 DB)", () => {
    const url = buildListingUrl({ ...base, paradigmFilter: "rule-based", paradigmAvailable: false });
    assert.ok(!url.includes("paradigm=eq"), "must not 400 a DB without the column");
  });

  it("adds paradigm to the search columns only when available", () => {
    const withParadigm = buildListingUrl({ ...base, searchQuery: "apertium", paradigmAvailable: true });
    assert.ok(withParadigm.includes("paradigm.ilike"), "should search paradigm when available");
    const without = buildListingUrl({ ...base, searchQuery: "apertium", paradigmAvailable: false });
    assert.ok(!without.includes("paradigm.ilike"), "must not reference a missing column in search");
    // method_class is always searchable.
    assert.ok(without.includes("method_class.ilike"), "method_class always searchable");
  });

  it("overwrites trust guard when specific trust selected", () => {
    const url = buildListingUrl({ ...base, trustFilter: "verified" });
    // URLSearchParams.set overwrites, so neq.disqualified should be gone
    assert.ok(url.includes("trust=eq.verified"), "should set exact trust");
    assert.ok(!url.includes("neq.disqualified"), "should NOT have neq.disqualified");
  });

  it("maps trust display name back to DB value", () => {
    const url = buildListingUrl({ ...base, trustFilter: "gds-verified" });
    assert.ok(url.includes("trust=eq.verified"), "should map display name to DB value");
  });

  it("applies condition filter", () => {
    const url = buildListingUrl({ ...base, activeCondition: "naive" });
    assert.ok(url.includes("condition=eq.naive"), "should filter condition");
  });

  it("applies prefix condition filter", () => {
    const groups = [{ key: "fst", isPrefix: true }];
    const url = buildListingUrl({ ...base, activeCondition: "fst", conditionGroups: groups });
    assert.ok(url.includes("condition=like.fst%25"), "should use LIKE for prefix");
  });

  it("skips condition filter for 'all'", () => {
    const url = buildListingUrl({ ...base, activeCondition: "all" });
    assert.ok(!url.includes("condition="), "should not filter condition on 'all'");
  });

  it("skips condition filter for 'best'", () => {
    const url = buildListingUrl({ ...base, activeCondition: "best" });
    assert.ok(!url.includes("condition="), "should not filter condition on 'best'");
  });

  it("sanitizes search query", () => {
    const url = buildListingUrl({ ...base, searchQuery: "gpt%4(o)" });
    // %, (, ) should be stripped
    assert.ok(url.includes("ilike.*gpt4o*"), "should strip special chars from search");
  });

  it("skips search when sanitized query is empty", () => {
    const url = buildListingUrl({ ...base, searchQuery: "%()" });
    assert.ok(!url.includes("or="), "should skip empty sanitized search");
  });

  it("applies correct sort column and direction", () => {
    const url = buildListingUrl({ ...base, sortKey: "bleu", sortDir: "asc" });
    assert.ok(url.includes("order=corpus_bleu.asc.nullslast"), "should sort by BLEU asc");
  });

  it("defaults to composite_score for unknown sort key", () => {
    const url = buildListingUrl({ ...base, sortKey: "nonexistent" });
    assert.ok(url.includes("order=composite_score.desc.nullslast"), "should default sort");
  });
});

// ---------------------------------------------------------------------------
// mapRow
// ---------------------------------------------------------------------------

describe("mapRow", () => {
  const sampleRow = {
    id: "test-123",
    submitter: "alice",
    model_slug: "gpt-4o",
    condition: "naive",
    dataset_id: "tatoeba-eng-zul",
    language_pair: "eng>zul",
    composite_score: 0.72,
    quality_tier: "Functional",
    trust: "self_benchmarked",
    chrf_plus_plus: 0.65,
    exact_match_rate: 0.3,
    fst_acceptance_rate: null,
    equivalent_match_rate: 0.45,
    semantic_score: 0.8,
    corpus_bleu: 0.42,
    comet_score: 0.78,
    ter: 0.55,
    total_cost_usd: 1.23,
    cost_per_entry_usd: 0.01,
    tokens_per_second: 50,
    entries_per_minute: 120,
    harness_version: "0.4.0",
    run_timestamp: "2026-06-14T10:00:00Z",
    submitted_at: "2026-06-14T10:05:00Z",
    avg_latency_seconds: 0.5,
    elapsed_seconds: 60,
    corpus_size: 123,
    method_class: "prompt",
    paradigm: "neural-nmt",
  };

  it("maps id correctly", () => {
    const entry = mapRow(sampleRow);
    assert.equal(entry.id, "test-123");
  });

  it("splits language pair into src and tgt", () => {
    const entry = mapRow(sampleRow);
    assert.equal(entry.src, "eng");
    assert.equal(entry.tgt, "zul");
    assert.equal(entry.pair, "eng>zul");
  });

  it("maps trust display name", () => {
    const entry = mapRow(sampleRow);
    assert.equal(entry.trust, "self-benchmarked");
  });

  it("maps metrics correctly", () => {
    const entry = mapRow(sampleRow);
    assert.equal(entry.metrics.composite, 0.72);
    assert.equal(entry.metrics.chrF, 0.65);
    assert.equal(entry.metrics.bleu, 0.42);
    assert.equal(entry.metrics.fstAcceptance, null);
  });

  it("sets run_card fields to null (lazy-loaded)", () => {
    const entry = mapRow(sampleRow);
    assert.equal(entry._runCard, null);
    assert.equal(entry.methodCard, null);
    assert.equal(entry.cost_adjusted_score, null);
  });

  it("extracts date from run_timestamp", () => {
    const entry = mapRow(sampleRow);
    assert.equal(entry.date, "2026-06-14");
  });

  it("falls back to submitted_at date", () => {
    const entry = mapRow({ ...sampleRow, run_timestamp: null });
    assert.equal(entry.date, "2026-06-14");
  });

  it("maps method name for naive condition", () => {
    const entry = mapRow(sampleRow);
    assert.equal(entry.method, "prompt-naive");
  });

  it("maps method name for FST condition", () => {
    const entry = mapRow({ ...sampleRow, condition: "coached+fst" });
    assert.equal(entry.method, "fst-gate-coached+fst");
  });

  it("handles missing language pair gracefully", () => {
    const entry = mapRow({ ...sampleRow, language_pair: null });
    assert.equal(entry.pair, "?");
    assert.equal(entry.src, "?");
  });

  it("maps the paradigm column", () => {
    assert.equal(mapRow(sampleRow).paradigm, "neural-nmt");
  });

  it("defaults a missing paradigm to null (pre-030 rows)", () => {
    const { paradigm, ...noParadigm } = sampleRow;
    assert.equal(mapRow(noParadigm).paradigm, null);
  });

  it("maps the run_card contamination grade (run_card->>contamination)", () => {
    // The listing query aliases the JSONB field to `contamination`.
    assert.equal(mapRow({ ...sampleRow, contamination: "HIGH" }).runCardContamination, "HIGH");
  });

  it("defaults a missing run_card contamination grade to null", () => {
    assert.equal(mapRow(sampleRow).runCardContamination, null);
  });
});

// ---------------------------------------------------------------------------
// formatPair
// ---------------------------------------------------------------------------

describe("formatPair", () => {
  const langMap = new Map([["eng", "English"], ["zul", "Zulu"]]);

  it("formats known pair with display names", () => {
    assert.equal(formatPair("eng>zul", langMap), "English → Zulu");
  });

  it("falls back to uppercase for unknown codes", () => {
    assert.equal(formatPair("eng>xxx", langMap), "English → XXX");
  });

  it("returns dash for null/missing pair", () => {
    assert.equal(formatPair(null, langMap), "—");
    assert.equal(formatPair("?", langMap), "—");
  });

  it("handles pair without target", () => {
    const result = formatPair("eng", langMap);
    assert.equal(result, "English");
  });
});

// ---------------------------------------------------------------------------
// formatMetric
// ---------------------------------------------------------------------------

describe("formatMetric", () => {
  it("formats percentage", () => {
    assert.equal(formatMetric(0.456, "%"), "45.6%");
  });

  it("formats decimal", () => {
    assert.equal(formatMetric(0.72345), "0.723");
  });

  it("returns dash for null", () => {
    assert.equal(formatMetric(null), "—");
  });
});

// ---------------------------------------------------------------------------
// formatCost
// ---------------------------------------------------------------------------

describe("formatCost", () => {
  it("formats normal cost", () => {
    assert.equal(formatCost(1.5), "$1.50");
  });

  it("returns <$0.01 for tiny cost", () => {
    assert.equal(formatCost(0.001), "<$0.01");
  });

  it("returns dash for null", () => {
    assert.equal(formatCost(null), "—");
  });
});

// ---------------------------------------------------------------------------
// sanitizeSearch
// ---------------------------------------------------------------------------

describe("sanitizeSearch", () => {
  it("strips LIKE wildcards", () => {
    assert.equal(sanitizeSearch("hello%world_test"), "helloworldtest");
  });

  it("strips commas and parens", () => {
    assert.equal(sanitizeSearch("gpt(4,o)"), "gpt4o");
  });

  it("strips dots", () => {
    assert.equal(sanitizeSearch("gpt.4o"), "gpt4o");
  });

  it("leaves normal text alone", () => {
    assert.equal(sanitizeSearch("claude-3-5-sonnet"), "claude-3-5-sonnet");
  });
});

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

describe("constants", () => {
  it("PAGE_SIZE is 100", () => {
    assert.equal(PAGE_SIZE, 100);
  });

  it("SORT_KEY_TO_COLUMN maps all expected keys", () => {
    const expected = ["composite", "chrF", "exactMatch", "bleu", "comet", "ter", "model", "author", "date", "pair"];
    for (const key of expected) {
      assert.ok(SORT_KEY_TO_COLUMN[key], `Missing sort mapping for ${key}`);
    }
  });

  it("DB_TRUST_TO_DISPLAY maps the DB trust vocabulary", () => {
    // DB enforces unverified | verified | disqualified (migration 021).
    assert.equal(DB_TRUST_TO_DISPLAY.unverified, "self-benchmarked");
    assert.equal(DB_TRUST_TO_DISPLAY.verified, "gds-verified");
    assert.equal(DB_TRUST_TO_DISPLAY.disqualified, "disqualified");
    // self-reported must never be silently presented as verified
    assert.notEqual(DB_TRUST_TO_DISPLAY.unverified, "gds-verified");
  });
});

// ---------------------------------------------------------------------------
// Trust mapping via mapRow — honest labeling (no silent "verified")
// ---------------------------------------------------------------------------

describe("mapRow trust labeling", () => {
  const row = (trust) => ({ id: "x", language_pair: "eng>zul", trust });

  it("maps unverified -> self-benchmarked", () => {
    assert.equal(mapRow(row("unverified")).trust, "self-benchmarked");
  });

  it("maps verified -> gds-verified", () => {
    assert.equal(mapRow(row("verified")).trust, "gds-verified");
  });

  it("maps disqualified -> disqualified (not mislabeled self-benchmarked)", () => {
    assert.equal(mapRow(row("disqualified")).trust, "disqualified");
  });

  it("defaults unknown/missing trust to self-benchmarked, never verified", () => {
    assert.equal(mapRow(row(undefined)).trust, "self-benchmarked");
    assert.equal(mapRow(row("bogus")).trust, "self-benchmarked");
  });
});
