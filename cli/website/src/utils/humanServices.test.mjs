/**
 * Unit tests for the human-services data layer.
 *
 * Run with: node --test src/utils/humanServices.test.mjs
 * (Node's built-in test runner — no dependencies.)
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  buildRpcUrl,
  rpcHeaders,
  providerBadge,
  formatTurnaround,
  formatRate,
  normalizeService,
  fetchServicesForPair,
} from "./humanServices.js";

describe("buildRpcUrl / rpcHeaders", () => {
  it("targets the get_services_for_pair RPC", () => {
    assert.equal(
      buildRpcUrl("https://x.supabase.co"),
      "https://x.supabase.co/rest/v1/rpc/get_services_for_pair",
    );
  });
  it("sends the anon key as apikey + bearer", () => {
    const h = rpcHeaders("anon-123");
    assert.equal(h.apikey, "anon-123");
    assert.equal(h.Authorization, "Bearer anon-123");
  });
});

describe("formatters + badge", () => {
  it("formats turnaround with singular/plural days", () => {
    assert.equal(formatTurnaround(1), "~1 day");
    assert.equal(formatTurnaround(5), "~5 days");
    assert.equal(formatTurnaround(null), null);
  });
  it("formats rate per word", () => {
    assert.equal(formatRate(0.3), "$0.30/word");
    assert.equal(formatRate(null), null);
  });
  it("flags community providers", () => {
    assert.equal(providerBadge("community_org").kind, "community");
    assert.equal(providerBadge("agency").kind, "agency");
    assert.equal(providerBadge("nonsense"), null);
  });
});

describe("normalizeService", () => {
  it("maps a raw RPC row to the render shape", () => {
    const out = normalizeService({
      service_id: "x",
      display_name: "Community key custodians (in confirmation)",
      provider_type: "community_org",
      variety: "SRO",
      turnaround_days: 3,
      rate_per_word: 0.18,
      domains: ["education"],
      nc_terms: "community terms",
    });
    assert.equal(out.displayName, "Community key custodians (in confirmation)");
    assert.equal(out.badge.kind, "community");
    assert.equal(out.turnaround, "~3 days");
    assert.equal(out.rate, "$0.18/word");
    assert.deepEqual(out.domains, ["education"]);
  });
  it("falls back to service_id when display_name is missing", () => {
    assert.equal(normalizeService({ service_id: "abc" }).displayName, "abc");
  });
});

describe("fetchServicesForPair", () => {
  const base = { supabaseUrl: "https://x.supabase.co", anonKey: "anon", src: "eng", tgt: "crk" };

  it("returns normalized rows on 200", async () => {
    const fetchImpl = async () => ({
      ok: true,
      status: 200,
      json: async () => [
        { service_id: "s1", display_name: "S1", provider_type: "agency", turnaround_days: 2 },
      ],
    });
    const out = await fetchServicesForPair({ ...base, fetchImpl });
    assert.equal(out.length, 1);
    assert.equal(out[0].displayName, "S1");
    assert.equal(out[0].turnaround, "~2 days");
  });

  it("returns an empty array when the RPC returns 0 rows (→ empty state)", async () => {
    const fetchImpl = async () => ({ ok: true, status: 200, json: async () => [] });
    const out = await fetchServicesForPair({ ...base, fetchImpl });
    assert.deepEqual(out, []);
  });

  it("posts the pair as { src, tgt }", async () => {
    let captured;
    const fetchImpl = async (_url, opts) => {
      captured = JSON.parse(opts.body);
      return { ok: true, status: 200, json: async () => [] };
    };
    await fetchServicesForPair({ ...base, fetchImpl });
    assert.deepEqual(captured, { src: "eng", tgt: "crk" });
  });

  it("treats a 404 (RPC not deployed yet) as an empty registry, not an error", async () => {
    // Before migration 034 is applied, PostgREST 404s the missing function.
    // The UI must show the honest empty state, so this resolves to [] not throws.
    const fetchImpl = async () => ({ ok: false, status: 404, json: async () => ({}) });
    const out = await fetchServicesForPair({ ...base, fetchImpl });
    assert.deepEqual(out, []);
  });

  it("throws on a genuine non-OK response (5xx — registry broken)", async () => {
    const fetchImpl = async () => ({ ok: false, status: 503, json: async () => ({}) });
    await assert.rejects(() => fetchServicesForPair({ ...base, fetchImpl }), /503/);
  });

  it("propagates a network-level failure (rejected fetch)", async () => {
    const fetchImpl = async () => {
      throw new Error("network down");
    };
    await assert.rejects(() => fetchServicesForPair({ ...base, fetchImpl }), /network down/);
  });
});
