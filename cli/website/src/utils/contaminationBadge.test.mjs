/**
 * Unit tests for the contamination lane policy — the scientific-integrity
 * boundary that keeps HIGH-contamination corpora (and ungraded ones) out of the
 * absolute-quality ranking.
 *
 * Run with: node --test src/utils/contaminationBadge.test.mjs
 * (Node's built-in test runner — no dependencies.)
 *
 * The headline cases guard against the "fails open" regression: a corpus
 * present in the registry but MISSING from the prod datasets table used to
 * resolve to a null grade and slide into the ABSOLUTE lane, ranking a
 * contaminated corpus as trustworthy absolute quality.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  normalizeContamination,
  isRelativeOnly,
  resolveContaminationGrade,
  isRelativeOnlyLane,
} from "./contaminationBadge.js";

// ---------------------------------------------------------------------------
// normalizeContamination
// ---------------------------------------------------------------------------

describe("normalizeContamination", () => {
  it("upper-cases and trims a grade", () => {
    assert.equal(normalizeContamination(" high "), "HIGH");
    assert.equal(normalizeContamination("low"), "LOW");
  });
  it("maps empty / NONE / null to null", () => {
    assert.equal(normalizeContamination(null), null);
    assert.equal(normalizeContamination(undefined), null);
    assert.equal(normalizeContamination(""), null);
    assert.equal(normalizeContamination("NONE"), null);
    assert.equal(normalizeContamination("  "), null);
  });
});

// ---------------------------------------------------------------------------
// resolveContaminationGrade — datasets grade preferred, run-card fallback
// ---------------------------------------------------------------------------

describe("resolveContaminationGrade", () => {
  it("prefers the datasets-table grade when present", () => {
    assert.equal(resolveContaminationGrade("LOW", "HIGH"), "LOW");
  });
  it("falls back to the run-card grade when the dataset grade is absent", () => {
    assert.equal(resolveContaminationGrade(null, "HIGH"), "HIGH");
    assert.equal(resolveContaminationGrade(undefined, "high"), "HIGH");
  });
  it("returns null only when BOTH sources are empty", () => {
    assert.equal(resolveContaminationGrade(null, null), null);
    assert.equal(resolveContaminationGrade(undefined, "NONE"), null);
  });
});

// ---------------------------------------------------------------------------
// isRelativeOnlyLane — the fail-safe lane gate (the bug under test)
// ---------------------------------------------------------------------------

describe("isRelativeOnlyLane (fail safe)", () => {
  // (a) datasets row missing + run_card grade HIGH → relative-only.
  // This is the exact "fails open" scenario: no prod datasets row, but the run
  // card carries the real HIGH grade. It MUST land in the relative-only lane.
  it("(a) dataset row missing + run_card HIGH → relative-only", () => {
    assert.equal(isRelativeOnlyLane(null, "HIGH"), true);
    assert.equal(isRelativeOnlyLane(undefined, "HIGH"), true);
  });

  // (b) both sources null → relative-only (fail safe). Unknown contamination
  // must never be ranked as absolute quality.
  it("(b) both grades unknown → relative-only (fail safe)", () => {
    assert.equal(isRelativeOnlyLane(null, null), true);
    assert.equal(isRelativeOnlyLane(undefined, undefined), true);
    assert.equal(isRelativeOnlyLane("NONE", ""), true);
  });

  // (c) known LOW (from the datasets table) → absolute lane.
  it("(c) datasets LOW → absolute (not relative-only)", () => {
    assert.equal(isRelativeOnlyLane("LOW", null), false);
    assert.equal(isRelativeOnlyLane("low", "HIGH"), false); // dataset grade wins
  });

  // (d) known HIGH (from the datasets table) → relative-only.
  it("(d) datasets HIGH → relative-only", () => {
    assert.equal(isRelativeOnlyLane("HIGH", null), true);
  });

  it("MEDIUM is rankable on absolute quality (not relative-only)", () => {
    assert.equal(isRelativeOnlyLane("MEDIUM", null), false);
  });
});

// ---------------------------------------------------------------------------
// isRelativeOnly — descriptive badge helper keeps its null-is-absolute policy
// (distinct from the fail-safe lane gate above)
// ---------------------------------------------------------------------------

describe("isRelativeOnly (badge policy, unchanged)", () => {
  it("only HIGH is relative-only", () => {
    assert.equal(isRelativeOnly("HIGH"), true);
    assert.equal(isRelativeOnly("LOW"), false);
    assert.equal(isRelativeOnly("MEDIUM"), false);
  });
  it("an unknown grade yields NO badge (null → false) — descriptive, not a gate", () => {
    assert.equal(isRelativeOnly(null), false);
    assert.equal(isRelativeOnly(undefined), false);
  });
});
