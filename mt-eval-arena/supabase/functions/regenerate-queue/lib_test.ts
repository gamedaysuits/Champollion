// lib_test.ts — deno test suite for the regenerate-queue streaming refresh.
//
// Mirrors the Python parity pins (arena/tests/test_queue_refresh.py +
// test_queue_remedies.py) on the TS side and adds the streaming-scanner
// coverage the Python side has no equivalent for (chunk boundaries, escapes,
// multibyte UTF-8, byte-verbatim reassembly). Run:
//
//   deno test lib_test.ts
//
// Dependency-free on purpose: the repo's gates run offline, so no jsr/std
// imports here.

// deno-lint-ignore-file no-explicit-any

import {
  accumulateBudgetTiers,
  assembleQueueBody,
  budgetTierSummaries,
  buildPreviewFromScan,
  newBudgetTierAccs,
  buildTokenPair,
  ByteSink,
  dropCompleted,
  filterQueueStream,
  foldResultsIntoMesh,
  itemIsCovered,
  coveredModelsOf,
  projectRegistryStream,
  type QueueScanResult,
  type ScanSink,
  secretsMatch,
  selectPreviewItems,
  TopLevelObjectScanner,
} from "./lib.ts";

// ---- tiny assert helpers (no deps) -----------------------------------------

function assert(cond: unknown, msg = "assertion failed"): asserts cond {
  if (!cond) throw new Error(msg);
}

function assertEquals(actual: unknown, expected: unknown, msg = ""): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    throw new Error(`${msg}\n  actual:   ${a}\n  expected: ${e}`);
  }
}

function assertThrows(fn: () => unknown, msgPart = ""): void {
  let threw = false;
  try {
    fn();
  } catch (err) {
    threw = true;
    if (msgPart && !String(err).includes(msgPart)) {
      throw new Error(`threw, but "${err}" does not mention "${msgPart}"`);
    }
  }
  if (!threw) throw new Error("expected an exception");
}

const enc = new TextEncoder();
const dec = new TextDecoder();

async function* chunked(
  bytes: Uint8Array,
  size: number,
): AsyncIterable<Uint8Array> {
  for (let i = 0; i < bytes.length; i += size) {
    yield bytes.subarray(i, Math.min(i + size, bytes.length));
  }
  if (bytes.length === 0) yield new Uint8Array(0);
}

function scanDoc(
  doc: string,
  chunkSize: number,
): { elements: string[]; captured: Map<string, string>; order: string[] } {
  const elements: string[] = [];
  const captured = new Map<string, string>();
  const order: string[] = [];
  const scanner = new TopLevelObjectScanner({
    member(key) {
      order.push(key);
      return key === "items" ? "elements" : "capture";
    },
    element(bytes) {
      elements.push(dec.decode(bytes));
    },
    captured(key, raw) {
      captured.set(key, dec.decode(raw));
    },
  });
  const bytes = enc.encode(doc);
  for (let i = 0; i < bytes.length; i += chunkSize) {
    scanner.push(bytes.subarray(i, Math.min(i + chunkSize, bytes.length)));
  }
  scanner.end();
  return { elements, captured, order };
}

function item(corpus: string, model: string, cond: string, extra: any = {}) {
  return {
    id: `${corpus}__${model}__${cond}`,
    language_pair: "eng>ilo",
    corpus_id: corpus,
    model,
    condition: cond,
    est_cost_usd: 0.01,
    ...extra,
  };
}

function queueDoc(items: any[], metadata: any = {}): string {
  return JSON.stringify({ metadata, items }) + "\n";
}

async function filter(doc: string, coverage: Set<string>, chunkSize = 7) {
  return await filterQueueStream(
    chunked(enc.encode(doc), chunkSize),
    coverage,
  );
}

function keptItems(scan: QueueScanResult): any[] {
  const body = dec.decode(assembleQueueBody(scan, "{}"));
  return JSON.parse(body).items;
}

// ---- scanner: structure + chunk boundaries ----------------------------------

// A document whose strings contain every character class that could confuse
// a depth scanner: braces/brackets inside strings, escaped quotes, escaped
// backslashes (also just before a closing quote), unicode escapes, and raw
// multibyte UTF-8 (2-, 3-, and 4-byte sequences).
const TRICKY_DOC = `{
  "metadata": { "note": "a }]} \\" tricky \\\\", "n": [1, 2, {"x": "]"}] },
  "items": [
    {"id": "a", "s": "nêhiyawêwin — ᓀᐦᐃᔭᐍᐏᐣ 𝄞", "v": 1e3},
    {"id": "b \\\\", "t": "say \\"hi\\" ok"},
    123,
    "bare ] string",
    true,
    null,
    [1, {"deep": ["]"]}]
  ],
  "after": "kept , verbatim"
}`;

Deno.test("scanner: same result at every chunk size (1..64)", () => {
  const ref = scanDoc(TRICKY_DOC, TRICKY_DOC.length);
  assertEquals(ref.order, ["metadata", "items", "after"]);
  assertEquals(ref.elements.length, 7);
  // Each element's raw text must parse to the same value the whole-doc
  // parse produces.
  const whole = JSON.parse(TRICKY_DOC);
  ref.elements.forEach((raw, i) => {
    assertEquals(JSON.parse(raw), whole.items[i], `element ${i}`);
  });
  assertEquals(JSON.parse(ref.captured.get("metadata")!), whole.metadata);
  assertEquals(JSON.parse(ref.captured.get("after")!), whole.after);
  for (let size = 1; size <= 64; size++) {
    const got = scanDoc(TRICKY_DOC, size);
    assertEquals(got.order, ref.order, `order @ chunk size ${size}`);
    assertEquals(got.elements, ref.elements, `elements @ chunk size ${size}`);
    assertEquals(
      [...got.captured.entries()],
      [...ref.captured.entries()],
      `captured @ chunk size ${size}`,
    );
  }
});

Deno.test("scanner: compact doc, primitive members, empty array", () => {
  const doc = '{"a":1,"b":null,"c":true,"items":[],"d":"x"}';
  for (const size of [1, 3, 1024]) {
    const got = scanDoc(doc, size);
    assertEquals(got.elements, []);
    assertEquals(got.captured.get("a"), "1");
    assertEquals(got.captured.get("b"), "null");
    assertEquals(got.captured.get("c"), "true");
    assertEquals(got.captured.get("d"), '"x"');
  }
});

Deno.test("scanner: escaped-key members and ws-separated primitives", () => {
  const doc = '{ "we\\"ird" : 42 , "items" : [ 1 , 2 ] , "z" : -3.5e-2 }';
  for (const size of [1, 5, 1024]) {
    const got = scanDoc(doc, size);
    assertEquals(got.order, ['we"ird', "items", "z"]);
    assertEquals(got.captured.get('we"ird'), "42");
    assertEquals(got.elements, ["1", "2"]);
    assertEquals(got.captured.get("z"), "-3.5e-2");
  }
});

Deno.test("scanner: malformed input fails loud", () => {
  assertThrows(() => scanDoc("[1,2,3]", 1024), "not a JSON object");
  assertThrows(() => scanDoc('{"a":1', 1024), "truncated");
  assertThrows(() => scanDoc('{"a":1}}', 1024), "trailing garbage");
  assertThrows(() => scanDoc('{"a" 1}', 1024), "expected ':'");
});

Deno.test("scanner: skip mode discards without accumulating", () => {
  const kept: string[] = [];
  const sink: ScanSink = {
    member: (k) => (k === "want" ? "capture" : "skip"),
    element: () => {},
    captured: (k, raw) => kept.push(`${k}=${dec.decode(raw)}`),
  };
  const doc = '{"big":{"a":[1,2,"}"],"b":"x"},"want":7,"tail":"y"}';
  const bytes = enc.encode(doc);
  for (const size of [1, 4, 1024]) {
    kept.length = 0;
    const sc = new TopLevelObjectScanner(sink);
    for (let i = 0; i < bytes.length; i += size) {
      sc.push(bytes.subarray(i, Math.min(i + size, bytes.length)));
    }
    sc.end();
    assertEquals(kept, ["want=7"]);
  }
});

// ---- ByteSink ---------------------------------------------------------------

Deno.test("ByteSink: segment rollover preserves bytes", () => {
  const sink = new ByteSink(8); // tiny segments to force rollover
  const parts = ["hello, ", "world", "! ", "0123456789abcdef"];
  for (const p of parts) sink.write(enc.encode(p));
  const segs = sink.finish();
  const total = new Uint8Array(sink.totalLen);
  let o = 0;
  for (const s of segs) {
    total.set(s, o);
    o += s.length;
  }
  assertEquals(dec.decode(total), parts.join(""));
});

// ---- drop rules (mirror test_queue_refresh.py TestDropCompleted) -----------

Deno.test("drop: exact covered combo drops; others stay", async () => {
  const items = [
    item("eval-eng-ilo", "anthropic/claude-haiku-4.5", "naive"),
    item("eval-eng-ilo", "google/gemini-3.5-flash", "naive"),
  ];
  const coverage = new Set(["eval-eng-ilo|claude-haiku-4.5|naive"]);
  // array twin
  const kept = dropCompleted(items, coverage);
  assertEquals(kept.map((it) => it.model), ["google/gemini-3.5-flash"]);
  // streaming twin
  const scan = await filter(queueDoc(items), coverage);
  assertEquals(scan.beforeCount, 2);
  assertEquals(scan.keptCount, 1);
  assertEquals(keptItems(scan).map((it) => it.model), [
    "google/gemini-3.5-flash",
  ]);
});

Deno.test("drop: coached label variants normalize", () => {
  const it = item("eval-eng-ilo", "m/x", "coached-v2");
  const coverage = new Set(["eval-eng-ilo|x|coached"]);
  assert(itemIsCovered(it, coverage, coveredModelsOf(coverage)));
});

Deno.test("drop: item missing keys is kept", () => {
  const coverage = new Set(["a|b|naive"]);
  assert(
    !itemIsCovered({ condition: "naive" }, coverage, coveredModelsOf(coverage)),
  );
});

Deno.test("drop: empty coverage keeps all", async () => {
  const items = [item("c", "m/x", "naive")];
  assertEquals(dropCompleted(items, new Set()), items);
  const scan = await filter(queueDoc(items), new Set());
  assertEquals(keptItems(scan), items);
});

Deno.test("drop: engine item covered by ANY condition", () => {
  const it = item("eval-eng-ilo", "google-translate", "engine");
  const coverage = new Set(["eval-eng-ilo|google-translate|naive"]);
  assert(itemIsCovered(it, coverage, coveredModelsOf(coverage)));
  assertEquals(dropCompleted([it], coverage), []);
});

Deno.test("drop: engine item not covered by other engine", () => {
  const it = item("eval-eng-ilo", "deepl", "engine");
  const coverage = new Set(["eval-eng-ilo|google-translate|naive"]);
  assert(!itemIsCovered(it, coverage, coveredModelsOf(coverage)));
});

Deno.test("drop: LLM item still condition-exact", () => {
  const it = item("eval-eng-ilo", "m/x", "coached");
  const coverage = new Set(["eval-eng-ilo|x|naive"]);
  assert(!itemIsCovered(it, coverage, coveredModelsOf(coverage)));
});

// ---- reassembly -------------------------------------------------------------

Deno.test("assembly: kept item bytes verbatim, member order preserved", async () => {
  // Deliberately odd but valid item encodings: spacing, number forms, key
  // order. The refresh must pass them through byte-for-byte.
  const doc = '{"metadata":{"open_items":3},' +
    '"items":[{ "model" : "m/keep1" ,"corpus_id":"c1","condition":"naive","n":1e3},' +
    '{"corpus_id":"c2","model":"m/drop","condition":"naive"},' +
    '{"corpus_id":"c3","condition":"naive","model":"m/keep2","x":0.50}],' +
    '"trailer":{"z":[1,2]}}\n';
  const scan = await filter(doc, new Set(["c2|drop|naive"]), 5);
  const body = dec.decode(assembleQueueBody(scan, '{"open_items":2}'));
  // Byte-verbatim survivors, including the odd spacing:
  assert(
    body.includes(
      '{ "model" : "m/keep1" ,"corpus_id":"c1","condition":"naive","n":1e3}',
    ),
    "kept item 1 must be byte-verbatim",
  );
  assert(
    body.includes(
      '{"corpus_id":"c3","condition":"naive","model":"m/keep2","x":0.50}',
    ),
    "kept item 2 must be byte-verbatim",
  );
  assert(!body.includes("m/drop"), "covered item must be gone");
  assert(body.endsWith("}\n"), "trailing newline");
  const parsed = JSON.parse(body);
  assertEquals(Object.keys(parsed), ["metadata", "items", "trailer"]);
  assertEquals(parsed.metadata, { open_items: 2 });
  assertEquals(parsed.trailer, { z: [1, 2] });
  assertEquals(parsed.items.length, 2);
});

Deno.test("assembly: items:null treated as empty; missing items appended", async () => {
  const scanNull = await filter('{"metadata":{},"items":null}', new Set());
  assertEquals(scanNull.beforeCount, 0);
  assertEquals(JSON.parse(dec.decode(assembleQueueBody(scanNull, "{}"))), {
    metadata: {},
    items: [],
  });
  const scanMissing = await filter('{"metadata":{}}', new Set());
  assertEquals(JSON.parse(dec.decode(assembleQueueBody(scanMissing, "{}"))), {
    metadata: {},
    items: [],
  });
});

Deno.test("assembly: non-array items fails loud", async () => {
  let threw = false;
  try {
    await filter('{"metadata":{},"items":42}', new Set());
  } catch (err) {
    threw = true;
    assert(String(err).includes("not an array"), String(err));
  }
  assert(threw, "expected non-array items to throw");
});

// ---- preview policy (mirror test_queue_remedies.py) --------------------------

function pairItem(i: number, pair: string) {
  return {
    priority: i + 1,
    id: `it-${String(i).padStart(3, "0")}`,
    language_pair: pair,
    corpus_id: `c${i}`,
    model: "m/x",
    condition: "naive",
    est_cost_usd: 0.01 * (i + 1),
  };
}

const CAP6 = {
  source_cap: 6,
  exclude_constructed: true,
  constructed_language_codes: [] as string[],
};

async function previewOf(items: any[], metadata: any, topN = 25) {
  const scan = await filter(queueDoc(items, metadata), new Set());
  const metaRaw = scan.capturedRaw.get("metadata");
  const meta = metaRaw ? JSON.parse(dec.decode(metaRaw)) : {};
  return buildPreviewFromScan(scan, meta, 1000, topN);
}

Deno.test("preview: hub capped at six, back-filled from other hubs", async () => {
  const jpn = Array.from({ length: 20 }, (_, i) => pairItem(i, `jpn>xa${i}`));
  const other = Array.from(
    { length: 10 },
    (_, i) => pairItem(100 + i, `s${String(i).padStart(2, "0")}>xb${i}`),
  );
  const preview = await previewOf(jpn.concat(other), { preview_policy: CAP6 });
  const srcs = preview.items.map((it: any) => it.language_pair.split(">")[0]);
  assertEquals(srcs.filter((s: string) => s === "jpn").length, 6);
  assertEquals(preview.preview_count, 16);
  const shownJpn = preview.items
    .filter((it: any) => it.language_pair.startsWith("jpn>"))
    .map((it: any) => it.id);
  assertEquals(shownJpn, [
    "it-000",
    "it-001",
    "it-002",
    "it-003",
    "it-004",
    "it-005",
  ]);
});

Deno.test("preview: cap binds every hub, not just the biggest", async () => {
  const jpn = Array.from({ length: 20 }, (_, i) => pairItem(i, `jpn>xa${i}`));
  const eng = Array.from(
    { length: 10 },
    (_, i) => pairItem(100 + i, `eng>xb${i}`),
  );
  const preview = await previewOf(jpn.concat(eng), { preview_policy: CAP6 });
  const srcs = preview.items.map((it: any) => it.language_pair.split(">")[0]);
  assertEquals(srcs.filter((s: string) => s === "jpn").length, 6);
  assertEquals(srcs.filter((s: string) => s === "eng").length, 6);
  assertEquals(preview.preview_count, 12);
});

Deno.test("preview: over-cap items stay in the full queue", async () => {
  const jpn = Array.from({ length: 8 }, (_, i) => pairItem(i, `jpn>xa${i}`));
  const scan = await filter(
    queueDoc(jpn, { preview_policy: CAP6 }),
    new Set(),
  );
  const meta = JSON.parse(dec.decode(scan.capturedRaw.get("metadata")!));
  const preview = buildPreviewFromScan(scan, meta, 1, 25);
  assertEquals(preview.preview_count, 6);
  assertEquals(preview.full_queue.items, 8);
  assertEquals(keptItems(scan).length, 8);
});

Deno.test("preview: stamped policy consumed verbatim (no cards needed)", async () => {
  // Mirrors test_refresh_consumes_stamped_policy_verbatim: 'qqq' has no
  // card, jpn is natural — the stamped codes drive the selection anyway.
  const stamped = {
    source_cap: 1,
    exclude_constructed: true,
    constructed_language_codes: ["qqq", "tlh"],
  };
  const items = [
    pairItem(0, "jpn>tlh"), // excluded: stamped code
    pairItem(1, "qqq>eng"), // excluded: stamped code w/o a card
    pairItem(2, "jpn>kor"), // picked (jpn 1/1)
    pairItem(3, "jpn>deu"), // skipped: stamped cap 1
    pairItem(4, "fra>eng"), // picked
  ];
  const preview = await previewOf(items, { preview_policy: stamped });
  assertEquals(preview.preview_policy, stamped);
  assertEquals(
    preview.items.map((it: any) => it.language_pair),
    ["jpn>kor", "fra>eng"],
  );
});

Deno.test("preview: malformed source_cap fails OPEN (never cap 0)", () => {
  const items = Array.from({ length: 8 }, (_, i) => pairItem(i, `jpn>x${i}`));
  for (const badCap of [null, true, "6", NaN] as any[]) {
    const policy = {
      source_cap: badCap,
      exclude_constructed: true,
      constructed_language_codes: [],
    };
    const picked = selectPreviewItems(items, policy, 25);
    assertEquals(picked.length, 8, `cap ${String(badCap)} must fail open`);
  }
});

Deno.test("preview: no policy block → pre-policy plain top-N (and no echo)", async () => {
  const items = Array.from({ length: 30 }, (_, i) => pairItem(i, `jpn>x${i}`));
  const preview = await previewOf(items, {});
  // plain slice — no cap applied, exactly topN
  assertEquals(preview.preview_count, 25);
  assert(!("preview_policy" in preview), "no policy echo for pre-policy base");
  assertEquals(preview.items[0].id, "it-000");
});

Deno.test("preview: pairs aggregation counts + minCost, desc by count", async () => {
  const items = [
    pairItem(0, "eng>fra"),
    pairItem(1, "eng>fra"),
    pairItem(2, "eng>fra"),
    pairItem(3, "deu>fra"),
    { ...pairItem(4, "deu>fra"), est_cost_usd: null },
    pairItem(5, "no-separator"),
  ];
  const preview = await previewOf(items, { preview_policy: CAP6 });
  assertEquals(preview.pairs, [
    { pair: "eng>fra", src: "eng", tgt: "fra", count: 3, minCost: 0.01 },
    { pair: "deu>fra", src: "deu", tgt: "fra", count: 2, minCost: 0.04 },
  ]);
});

// ---- mesh fold (mirror test_queue_refresh.py TestFoldResultsIntoMesh) -------

function baseMesh() {
  return {
    nodes: [{ id: "eng", lat: 0, lng: 0 }, { id: "ilo" }],
    edges: [
      {
        a: "eng",
        b: "ilo",
        size: 50,
        status: "registered",
        best_chrf: null,
        reliability: null,
        tier: "registered",
        runs: [],
      },
    ],
  };
}

Deno.test("fold: result lights up edge; node coords preserved", () => {
  const mesh: any = baseMesh();
  const tp = new Map<string, [string, string]>([["eval-eng-ilo", ["eng", "ilo"]]]);
  const results = [
    { token: "eval-eng-ilo", strength: 0.62, submitted_at: "2026-07-01T00:00:00Z" },
  ];
  foldResultsIntoMesh(mesh, results, tp, null);
  assertEquals(mesh.edges[0].status, "measured");
  assertEquals(mesh.edges[0].best_chrf, 62);
  assertEquals(mesh.edges[0].runs, [["2026-07-01T00:00:00Z", 62]]);
  assertEquals(mesh.measured_edges, 1);
  assertEquals(mesh.nodes[0], { id: "eng", lat: 0, lng: 0 });
});

Deno.test("fold: refold is idempotent, never double-counts", () => {
  const mesh: any = baseMesh();
  const tp = new Map<string, [string, string]>([["eval-eng-ilo", ["eng", "ilo"]]]);
  const results = [
    { token: "eval-eng-ilo", strength: 0.62, submitted_at: "2026-07-01T00:00:00Z" },
  ];
  foldResultsIntoMesh(mesh, results, tp, null);
  foldResultsIntoMesh(mesh, results, tp, null);
  assertEquals(mesh.edges[0].runs.length, 1);
  assertEquals(mesh.measured_edges, 1);
});

Deno.test("fold: registry appends new registered edges, skips self-pairs", () => {
  const mesh: any = baseMesh();
  const registry = {
    datasets: [
      { id: "d1", language_pair: { source: "fra", target: "kor" }, size: 99 },
      { id: "d2", language_pair: { source: "eng", target: "eng" }, size: 10 },
      { id: "d3", language_pair: { source: "eng", target: "ilo" }, size: 80 },
    ],
  };
  foldResultsIntoMesh(mesh, [], buildTokenPair(registry), registry);
  assertEquals(mesh.edges.length, 2);
  const added = mesh.edges[1];
  assertEquals([added.a, added.b, added.size, added.status], [
    "fra",
    "kor",
    99,
    "registered",
  ]);
  // existing edge size refreshed to the max of registry/base
  assertEquals(mesh.edges[0].size, 80);
});

// ---- registry projection ------------------------------------------------------

Deno.test("registry: stream projection keeps only the fold fields", async () => {
  const registry = {
    registry_version: "3.0.0",
    _generated: "big prose } ] \" blob",
    datasets: [
      {
        id: "D1",
        name: "x",
        language_pair: { source: "eng", target: "ilo" },
        size: 5,
        path: "data/corpora/eval-eng-ilo.jsonl",
        license: "CC-BY",
        notes: "irrelevant",
      },
    ],
  };
  const doc = JSON.stringify(registry, null, 2) + "\n"; // pretty-printed, like prod
  const got = await projectRegistryStream(chunked(enc.encode(doc), 3));
  assertEquals(got, {
    datasets: [
      {
        id: "D1",
        path: "data/corpora/eval-eng-ilo.jsonl",
        language_pair: { source: "eng", target: "ilo" },
        size: 5,
      },
    ],
  });
  const tp = buildTokenPair(got);
  assertEquals(tp.get("d1"), ["eng", "ilo"]);
  assertEquals(tp.get("eval-eng-ilo"), ["eng", "ilo"]);
});

// ---- end-to-end: streaming pipeline ≡ v4 whole-parse reference ----------------

// v4 reference implementation (whole-document JSON.parse — fine at test
// scale) — the pre-streaming logic this redesign must match exactly.
function v4Reference(doc: string, coverage: Set<string>, topN: number) {
  const queue = JSON.parse(doc);
  queue.items = dropCompleted(queue.items ?? [], coverage);
  queue.metadata ??= {};
  queue.metadata.open_items = queue.items.length;
  const items: any[] = queue.items;
  const byPair = new Map<string, any>();
  for (const it of items) {
    const lp = (it.language_pair ?? "").trim().toLowerCase();
    if (!lp.includes(">")) continue;
    const [src, tgt] = lp.split(">");
    let agg = byPair.get(lp);
    if (!agg) {
      agg = { pair: lp, src, tgt, count: 0, minCost: null };
      byPair.set(lp, agg);
    }
    agg.count += 1;
    const cost = it.est_cost_usd;
    if (cost != null) {
      agg.minCost = agg.minCost == null ? cost : Math.min(agg.minCost, cost);
    }
  }
  const policy = queue.metadata?.preview_policy ?? null;
  const previewItems = selectPreviewItems(items, policy, topN);
  return {
    queue,
    preview: {
      metadata: queue.metadata,
      preview_count: previewItems.length,
      ...(policy ? { preview_policy: policy } : {}),
      items: previewItems,
      pairs: [...byPair.values()].sort((a, b) => b.count - a.count),
    },
  };
}

// Deterministic pseudo-random generator (no Math.random in parity fixtures).
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

Deno.test("end-to-end: streamed refresh matches the v4 reference", async () => {
  const rnd = lcg(42);
  const langs = ["eng", "jpn", "fra", "crk", "ilo", "tlh", "épo"];
  const models = ["a/m-1", "b/m-2", "c/m-3"];
  const conds = ["naive", "coached-v2", "engine"];
  const items: any[] = [];
  for (let i = 0; i < 400; i++) {
    const src = langs[Math.floor(rnd() * langs.length)];
    const tgt = langs[Math.floor(rnd() * langs.length)];
    items.push({
      priority: i + 1,
      id: `it-${i}`,
      language_pair: `${src}>${tgt}`,
      corpus_id: `corpus-${Math.floor(rnd() * 60)}`,
      model: models[Math.floor(rnd() * models.length)],
      condition: conds[Math.floor(rnd() * conds.length)],
      est_cost_usd: rnd() < 0.1 ? null : Math.round(rnd() * 500) / 100,
      note: 'prose with "quotes", braces {} and ᓀᐦᐃᔭᐍᐏᐣ',
    });
  }
  const metadata = {
    generated_at: "2026-07-12T00:00:00+00:00",
    open_items: items.length,
    preview_policy: {
      source_cap: 2,
      exclude_constructed: true,
      constructed_language_codes: ["tlh", "épo"],
    },
  };
  const doc = JSON.stringify({ metadata, items }) + "\n";
  const coverage = new Set<string>();
  // Cover a deterministic third of the (corpus, model, condition) space.
  for (const it of items) {
    if (rnd() < 0.33) {
      const cond = it.condition.includes("coach") ? "coached" : it.condition;
      coverage.add(
        `${it.corpus_id}|${it.model.split("/").pop()}|${
          cond === "engine" ? "naive" : cond
        }`,
      );
    }
  }

  const ref = v4Reference(doc, coverage, 25);

  for (const chunkSize of [1, 13, 4096]) {
    const scan = await filter(doc, coverage, chunkSize);
    const metaRaw = scan.capturedRaw.get("metadata")!;
    const meta = JSON.parse(dec.decode(metaRaw));
    meta.open_items = scan.keptCount;
    const body = dec.decode(assembleQueueBody(scan, JSON.stringify(meta)));
    const streamed = JSON.parse(body);
    assertEquals(
      streamed.items,
      ref.queue.items,
      `items @ chunk ${chunkSize}`,
    );
    assertEquals(
      streamed.metadata.open_items,
      ref.queue.metadata.open_items,
    );
    const preview = buildPreviewFromScan(scan, meta, body.length, 25);
    assertEquals(preview.items, ref.preview.items, "preview items");
    assertEquals(preview.pairs, ref.preview.pairs, "preview pairs");
    assertEquals(preview.preview_count, ref.preview.preview_count);
    assertEquals(preview.preview_policy, metadata.preview_policy);
    assertEquals(preview.full_queue.bytes, body.length);
    assertEquals(preview.full_queue.items, scan.keptCount);
  }
});

// ---- secretsMatch (audit 2026-07-18, M2) -------------------------------------

Deno.test("secretsMatch: exact match only, never an empty expected secret", () => {
  assertEquals(secretsMatch("s3cret", "s3cret"), true);
  assertEquals(secretsMatch("s3cret", "S3cret"), false);
  assertEquals(secretsMatch("s3cre", "s3cret"), false);
  assertEquals(secretsMatch("s3cret2", "s3cret"), false);
  assertEquals(secretsMatch("", "s3cret"), false);
  // An unset/empty expected secret matches NOTHING — the handler refuses to
  // run unconfigured rather than comparing against "".
  assertEquals(secretsMatch("", ""), false);
  assertEquals(secretsMatch("anything", ""), false);
});

// ---- budget tiers (2026-08-24) — twin of build_budget_tiers -----------------

Deno.test("budget tiers: greedy prefix with skip, twin semantics", () => {
  const accs = newBudgetTierAccs();
  const items = [
    { est_cost_usd: 0.6, language_pair: "eng>deu", model: "m1", priority: 1 },
    { est_cost_usd: 0.6, language_pair: "eng>fra", model: "m1", priority: 2 }, // skipped at $1
    { est_cost_usd: 0.3, language_pair: "eng>spa", model: "m1", priority: 3 }, // taken
    { est_cost_usd: null, language_pair: "eng>ita", model: "m1", priority: 4 }, // costless: never counted
  ];
  for (const it of items) accumulateBudgetTiers(accs, it);
  const t = budgetTierSummaries(accs)[0];
  if (t.budget_usd !== 1) throw new Error("tier order changed");
  if (t.items !== 2 || t.total_cost_usd !== 0.9) {
    throw new Error(`greedy skip walk broken: ${JSON.stringify(t)}`);
  }
  if (t.pairs !== 2 || t.models !== 1 || t.max_priority !== 3) {
    throw new Error(`tier summary fields broken: ${JSON.stringify(t)}`);
  }
});

Deno.test("budget tiers: shared golden vectors (twin parity fixture)", async () => {
  const fx = JSON.parse(await Deno.readTextFile(
    new URL("../../../../shared/budget-tier-vectors.json", import.meta.url)));
  const accs = fx.tiers_usd.map((b: number) => ({
    budget_usd: b, spent: 0, items: 0,
    pairs: new Set<string>(), models: new Set<string>(),
    maxPriority: null as number | null,
  }));
  for (const it of fx.items) {
    for (const acc of accs) {
      const cost = it.est_cost_usd;
      if (typeof cost !== "number" || !isFinite(cost) || cost < 0) continue;
      if (acc.spent + cost > acc.budget_usd) continue;
      acc.spent += cost;
      acc.items += 1;
      const lp = (it.language_pair ?? "").trim().toLowerCase();
      if (lp) acc.pairs.add(lp);
      if (it.model) acc.models.add(it.model);
      if (Number.isInteger(it.priority)) {
        acc.maxPriority = acc.maxPriority == null
          ? it.priority : Math.max(acc.maxPriority, it.priority);
      }
    }
  }
  const got = budgetTierSummaries(accs);
  const expected = fx.expected.map((e: any) => ({
    budget_usd: e.budget_usd, items: e.items,
    total_cost_usd: e.total_cost_usd, pairs: e.pairs,
    models: e.models, max_priority: e.max_priority,
  }));
  if (JSON.stringify(got) !== JSON.stringify(expected)) {
    throw new Error(`twin drift:\n got ${JSON.stringify(got)}\n exp ${JSON.stringify(expected)}`);
  }
});
