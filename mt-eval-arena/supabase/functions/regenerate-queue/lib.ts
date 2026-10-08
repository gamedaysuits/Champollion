// lib.ts — pure logic for the regenerate-queue edge function (no env, no I/O).
//
// Two layers live here:
//
//   1. The SSOT-mirrored refresh rules (modelShort / normCond / itemIsCovered
//      / dropCompleted / selectPreviewItems / buildTokenPair /
//      foldResultsIntoMesh) — exact twins of generate_sweep_queue.py's pure
//      helpers, semantics unchanged from function v4. Change them together
//      with the Python (arena/tests/test_queue_refresh.py +
//      test_queue_remedies.py pin the contract).
//
//   2. The STREAMING layer (2026-07-12 redesign): the served queue.json is
//      58.5 MB and a whole-document JSON.parse balloons several-fold in V8,
//      exhausting the 256 MB isolate (measured HTTP 546 — see README).
//      TopLevelObjectScanner walks the document bytes with a
//      string-aware bracket-depth state machine and hands over the `items`
//      array ONE ELEMENT AT A TIME; each element is JSON.parsed alone
//      (small, transient, GC-able), tested against the board, and — when
//      kept — its RAW BYTES are appended verbatim to a segment sink. The
//      full document object graph never exists; peak memory is ~2× the
//      kept-items bytes (segments + the assembled upload body), far under
//      the isolate cap. The same scanner projects registry.json (10.9 MB)
//      down to the four per-dataset fields the mesh fold needs.
//
// Byte-level scanning is UTF-8-safe: every JSON structural character is
// ASCII, and multibyte UTF-8 sequences have the high bit set on every byte,
// so they can never be mistaken for structure. Kept items are re-emitted
// byte-for-byte, so the refresh never re-encodes the Python generator's
// output.

// deno-lint-ignore-file no-explicit-any

export type Pair = [string, string];

// ---- refresh rules (mirror generate_sweep_queue.py — unchanged from v4) ---

export function modelShort(slug: string): string {
  return (slug ?? "").split("/").pop()!.trim().toLowerCase();
}

export function normCond(cond: string): string {
  const c = (cond ?? "").trim().toLowerCase();
  return c.includes("coach") ? "coached" : c;
}

export function itemIsCovered(
  item: any,
  coverage: Set<string>,
  coveredModels: Set<string>,
): boolean {
  const cid = (item.corpus_id ?? "").trim().toLowerCase();
  const ms = modelShort(item.model ?? "");
  if (!cid || !ms) return false; // can't match → keep (never wrongly drop)
  const cond = normCond(item.condition ?? "");
  // ENGINE items (condition "engine") have no prompting conditions, and an
  // engine run publishes under its real prompt-condition label ("naive" by
  // default) — so ANY (corpus, engine) row on the board covers the item.
  // Mirrors generate_sweep_queue.py item_is_covered.
  if (cond === "engine") return coveredModels.has(`${cid}|${ms}`);
  return coverage.has(`${cid}|${ms}|${cond}`);
}

export function coveredModelsOf(coverage: Set<string>): Set<string> {
  return new Set<string>(
    [...coverage].map((k) => k.split("|").slice(0, 2).join("|")),
  );
}

export function dropCompleted(items: any[], coverage: Set<string>): any[] {
  const coveredModels = coveredModelsOf(coverage);
  return items.filter((it) => !itemIsCovered(it, coverage, coveredModels));
}

export function buildTokenPair(registry: any): Map<string, Pair> {
  const tp = new Map<string, Pair>();
  for (const ds of registry?.datasets ?? []) {
    const lp = ds.language_pair;
    if (!lp?.source || !lp?.target) continue;
    const pair: Pair = [lp.source, lp.target];
    tp.set(String(ds.id).toLowerCase(), pair);
    if (ds.path) {
      const stem = String(ds.path).split("/").pop()!.replace(/\.[^.]*$/, "");
      tp.set(stem.toLowerCase(), pair);
    }
  }
  return tp;
}

export const edgeKey = (a: string, b: string) => [a, b].sort().join("\x00");

export function foldResultsIntoMesh(
  mesh: any,
  results: any[],
  tokenPair: Map<string, Pair>,
  registry: any | null,
): any {
  // Recompute every edge's run history from the FULL board (idempotent — a
  // re-fold of the same board is a no-op, never a double-count).
  const edgeRuns = new Map<string, Array<[string, number]>>();
  for (const r of results) {
    const pair = tokenPair.get(r.token);
    if (!pair || !r.submitted_at) continue;
    const k = edgeKey(pair[0], pair[1]);
    if (!edgeRuns.has(k)) edgeRuns.set(k, []);
    edgeRuns.get(k)!.push([r.submitted_at, Math.round(r.strength * 100 * 100) / 100]);
  }
  for (const runs of edgeRuns.values()) runs.sort();

  mesh.edges ??= [];
  const index = new Map<string, any>();
  for (const e of mesh.edges) index.set(edgeKey(e.a, e.b), e);

  const ensureEdge = (k: string, size = 0): any => {
    let edge = index.get(k);
    if (!edge) {
      const [a, b] = k.split("\x00").sort();
      edge = {
        a, b, size, status: "registered", best_chrf: null,
        reliability: null, tier: "registered", runs: [],
      };
      mesh.edges.push(edge);
      index.set(k, edge);
    }
    return edge;
  };

  for (const [k, runs] of edgeRuns) {
    const edge = ensureEdge(k);
    edge.runs = runs.map(([t, c]) => [t, c]);
    edge.status = runs.length ? "measured" : (edge.status ?? "registered");
    edge.best_chrf = runs.length
      ? Math.max(...runs.map(([, c]) => c))
      : edge.best_chrf;
  }

  if (registry) {
    for (const ds of registry.datasets ?? []) {
      const lp = ds.language_pair ?? {};
      const s = lp.source, t = lp.target;
      if (!s || !t || s === t) continue;
      const edge = ensureEdge(edgeKey(s, t), ds.size ?? 0);
      edge.size = Math.max(edge.size ?? 0, ds.size ?? 0);
    }
  }

  mesh.refreshed_at = new Date().toISOString();
  mesh.measured_edges = mesh.edges.filter((e: any) => e.status === "measured").length;
  return mesh;
}

// ---- preview selection (policy-as-data contract — unchanged from v4) ------

// Incremental form of select_preview_items (generate_sweep_queue.py) — the
// streaming pipeline offers kept items one at a time and stops pulling once
// the selection is full. Semantics are IDENTICAL to the v4 array form (kept
// below as selectPreviewItems for the parity tests): the policy block from
// queue.metadata.preview_policy is consumed VERBATIM (source-hub cap +
// constructed-language exclusion, PRESENTATION ONLY); no policy → the
// pre-policy plain top-N slice. A malformed cap fails OPEN (no cap) —
// Number(null) is 0, which would silently empty the preview instead.
export class PreviewSelector {
  picked: any[] = [];
  private readonly plain: boolean;
  private readonly cap: number;
  private readonly conlangs: Set<string>;
  private readonly excludeConlangs: boolean;
  private readonly perSource = new Map<string, number>();

  constructor(policy: any, private readonly topN: number) {
    this.plain = !policy || typeof policy !== "object";
    this.cap = !this.plain && typeof policy.source_cap === "number" &&
        Number.isFinite(policy.source_cap)
      ? policy.source_cap
      : Infinity;
    this.conlangs = new Set<string>(
      (!this.plain && Array.isArray(policy.constructed_language_codes)
        ? policy.constructed_language_codes
        : []).map((c: any) => String(c).trim().toLowerCase()),
    );
    this.excludeConlangs = !this.plain &&
      policy.exclude_constructed === true && this.conlangs.size > 0;
  }

  get done(): boolean {
    return this.picked.length >= this.topN;
  }

  offer(it: any): void {
    if (this.done) return;
    if (this.plain) {
      this.picked.push(it);
      return;
    }
    const lp = String(it?.language_pair ?? "").trim().toLowerCase();
    // Python str.partition(">") semantics: no separator → src = whole string.
    const gt = lp.indexOf(">");
    const src = gt >= 0 ? lp.slice(0, gt) : lp;
    const tgt = gt >= 0 ? lp.slice(gt + 1) : "";
    // Conlang exclusion (remedy #4) — only for well-formed pairs.
    if (
      gt >= 0 && this.excludeConlangs &&
      (this.conlangs.has(src) || this.conlangs.has(tgt))
    ) {
      return;
    }
    // Per-source-hub diversity cap (remedy #3).
    if (src && (this.perSource.get(src) ?? 0) >= this.cap) return;
    if (src) this.perSource.set(src, (this.perSource.get(src) ?? 0) + 1);
    this.picked.push(it);
  }
}

// v4 array form — the exact twin of select_preview_items in
// generate_sweep_queue.py; kept as the unit-testable parity surface.
export function selectPreviewItems(items: any[], policy: any, topN: number): any[] {
  const sel = new PreviewSelector(policy, topN);
  for (const it of items) {
    if (sel.done) break;
    sel.offer(it);
  }
  return sel.picked;
}

// ---- streaming JSON scanner ------------------------------------------------

export type MemberMode = "elements" | "capture" | "skip";

export interface ScanSink {
  /** Called once per top-level member, with its decoded key. Return
   * "elements" to stream the member's array elements one at a time (falls
   * back to "capture" if the value turns out not to be an array),
   * "capture" to buffer the member's raw value bytes, or "skip" to scan
   * past the value without keeping it. */
  member(key: string): MemberMode;
  /** One complete array element (raw bytes, whitespace-trimmed) of an
   * "elements" member. */
  element(bytes: Uint8Array): void;
  /** A captured member's complete raw value bytes. */
  captured(key: string, raw: Uint8Array): void;
}

// scanner states
const S_BEFORE_DOC = 0;
const S_BEFORE_KEY = 1;
const S_IN_KEY = 2;
const S_AFTER_KEY = 3;
const S_BEFORE_VALUE = 4;
const S_VALUE = 5; // capture/skip a member value
const S_AFTER_VALUE = 6;
const S_ARRAY_BEFORE_ELEM = 7;
const S_ELEMENT = 8;
const S_ARRAY_AFTER_ELEM = 9;
const S_DOC_END = 10;

// value kinds within S_VALUE / S_ELEMENT
const K_CONTAINER = 1;
const K_STRING = 2;
const K_PRIMITIVE = 3;

const isWs = (b: number) => b === 0x20 || b === 0x09 || b === 0x0a || b === 0x0d;

/**
 * Incremental push-parser for a JSON document whose top level is an object.
 * Feed it chunks with push(), then call end(). It never builds the document
 * tree — member values are surfaced as raw byte ranges via the sink, and the
 * caller decides what (if anything) to JSON.parse. Malformed or truncated
 * input throws (fail loud; the caller uploads nothing).
 */
export class TopLevelObjectScanner {
  private state = S_BEFORE_DOC;
  private kind = 0;
  private depth = 0;
  private inString = false;
  private escape = false;
  private mode: MemberMode = "capture";
  private key = "";
  // current token accumulation: parts from previous chunks + open span start
  // in the current chunk (-1 = no open token)
  private parts: Uint8Array[] = [];
  private partsLen = 0;
  private spanStart = -1;
  private readonly dec = new TextDecoder();

  constructor(private readonly sink: ScanSink) {}

  private take(chunk: Uint8Array, end: number): Uint8Array {
    // materialize the current token: previous parts + chunk[spanStart, end)
    const span = chunk.subarray(this.spanStart, end);
    this.spanStart = -1;
    if (this.parts.length === 0) {
      const out = span.slice(); // copy — chunk buffers may be reused
      return out;
    }
    const out = new Uint8Array(this.partsLen + span.length);
    let o = 0;
    for (const p of this.parts) {
      out.set(p, o);
      o += p.length;
    }
    out.set(span, o);
    this.parts = [];
    this.partsLen = 0;
    return out;
  }

  private drop(): void {
    this.parts = [];
    this.partsLen = 0;
    this.spanStart = -1;
  }

  push(chunk: Uint8Array): void {
    const n = chunk.length;
    if (this.spanStart === -2) this.spanStart = 0; // token continues here
    let i = 0;
    while (i < n) {
      const b = chunk[i];
      switch (this.state) {
        case S_BEFORE_DOC:
          if (isWs(b)) break;
          if (b !== 0x7b /* { */) {
            throw new Error("queue artifact is not a JSON object document");
          }
          this.state = S_BEFORE_KEY;
          break;

        case S_BEFORE_KEY:
          if (isWs(b)) break;
          if (b === 0x7d /* } */) {
            this.state = S_DOC_END;
            break;
          }
          if (b !== 0x22 /* " */) throw new Error("expected member key");
          this.spanStart = i;
          this.inString = true;
          this.escape = false;
          this.state = S_IN_KEY;
          break;

        case S_IN_KEY:
          if (this.escape) {
            this.escape = false;
          } else if (b === 0x5c /* \ */) {
            this.escape = true;
          } else if (b === 0x22 /* " */) {
            this.inString = false;
            this.key = JSON.parse(this.dec.decode(this.take(chunk, i + 1)));
            this.state = S_AFTER_KEY;
          }
          break;

        case S_AFTER_KEY:
          if (isWs(b)) break;
          if (b !== 0x3a /* : */) throw new Error("expected ':' after key");
          this.state = S_BEFORE_VALUE;
          break;

        case S_BEFORE_VALUE: {
          if (isWs(b)) break;
          this.mode = this.sink.member(this.key);
          if (this.mode === "elements" && b === 0x5b /* [ */) {
            this.state = S_ARRAY_BEFORE_ELEM;
            break;
          }
          if (this.mode === "elements") this.mode = "capture"; // not an array
          this.beginValue(b, i);
          this.state = S_VALUE;
          break;
        }

        case S_VALUE:
        case S_ELEMENT: {
          const inElem = this.state === S_ELEMENT;
          if (this.inString) {
            i = this.scanString(chunk, i, n);
            if (i >= n) {
              i = n;
              break;
            }
            // closing quote at i
            this.inString = false;
            if (this.kind === K_STRING) this.finishToken(chunk, i + 1, inElem);
            break;
          }
          if (this.kind === K_CONTAINER) {
            if (b === 0x22) this.inString = true;
            else if (b === 0x7b || b === 0x5b) this.depth++;
            else if (b === 0x7d || b === 0x5d) {
              this.depth--;
              if (this.depth === 0) this.finishToken(chunk, i + 1, inElem);
            }
          } else {
            // K_PRIMITIVE: ends at ws or a delimiter (delimiter not consumed
            // by the token)
            if (isWs(b)) {
              this.finishToken(chunk, i, inElem);
            } else if (inElem && (b === 0x2c /* , */ || b === 0x5d /* ] */)) {
              this.finishToken(chunk, i, inElem);
              this.state = b === 0x2c ? S_ARRAY_BEFORE_ELEM : S_AFTER_VALUE;
            } else if (!inElem && (b === 0x2c || b === 0x7d /* } */)) {
              this.finishToken(chunk, i, inElem);
              this.state = b === 0x2c ? S_BEFORE_KEY : S_DOC_END;
            }
          }
          break;
        }

        case S_AFTER_VALUE:
          if (isWs(b)) break;
          if (b === 0x2c /* , */) this.state = S_BEFORE_KEY;
          else if (b === 0x7d /* } */) this.state = S_DOC_END;
          else throw new Error("expected ',' or '}' after member value");
          break;

        case S_ARRAY_BEFORE_ELEM:
          if (isWs(b)) break;
          if (b === 0x5d /* ] */) {
            this.state = S_AFTER_VALUE;
            break;
          }
          this.beginValue(b, i);
          this.state = S_ELEMENT;
          break;

        case S_ARRAY_AFTER_ELEM:
          if (isWs(b)) break;
          if (b === 0x2c /* , */) this.state = S_ARRAY_BEFORE_ELEM;
          else if (b === 0x5d /* ] */) this.state = S_AFTER_VALUE;
          else throw new Error("expected ',' or ']' after array element");
          break;

        case S_DOC_END:
          if (!isWs(b)) throw new Error("trailing garbage after document");
          break;
      }
      i++;
    }
    // chunk exhausted with a token open → stash the span for the next chunk
    if (this.spanStart >= 0) {
      if (this.mode !== "skip" || this.state === S_IN_KEY) {
        const part = chunk.subarray(this.spanStart).slice();
        this.parts.push(part);
        this.partsLen += part.length;
      }
      this.spanStart = -2; // reopen at offset 0 of the next chunk
    }
  }

  end(): void {
    if (this.state !== S_DOC_END) {
      throw new Error("truncated JSON document (stream ended mid-value)");
    }
  }

  private beginValue(b: number, i: number): void {
    this.spanStart = i;
    this.depth = 0;
    this.inString = false;
    this.escape = false;
    if (b === 0x7b /* { */ || b === 0x5b /* [ */) {
      this.kind = K_CONTAINER;
      this.depth = 1;
    } else if (b === 0x22 /* " */) {
      this.kind = K_STRING;
      this.inString = true;
    } else {
      this.kind = K_PRIMITIVE;
    }
  }

  /** Fast-forward through a string's interior: jump to the next quote or
   * backslash via native indexOf instead of walking byte-by-byte. Returns
   * the index of the CLOSING quote, or a value >= n when the string
   * continues into the next chunk. */
  private scanString(chunk: Uint8Array, i: number, n: number): number {
    while (i < n) {
      if (this.escape) {
        this.escape = false;
        i++;
        continue;
      }
      const q = chunk.indexOf(0x22, i);
      // Only look for a backslash BEFORE the quote (bounded subarray view)
      // — an unbounded indexOf would rescan the chunk tail once per string
      // and go quadratic on string-dense input.
      const bound = q === -1 ? n : q;
      const s = chunk.subarray(i, bound).indexOf(0x5c);
      if (s !== -1) {
        this.escape = true;
        i = i + s + 1;
        continue;
      }
      if (q === -1) return n;
      return q;
    }
    return n;
  }

  private finishToken(chunk: Uint8Array, end: number, inElem: boolean): void {
    if (this.mode === "skip" && !inElem) {
      this.drop();
      this.state = S_AFTER_VALUE;
      return;
    }
    const bytes = this.take(chunk, end);
    if (inElem) {
      this.sink.element(bytes);
      this.state = S_ARRAY_AFTER_ELEM;
    } else {
      this.sink.captured(this.key, bytes);
      this.state = S_AFTER_VALUE;
    }
  }
}

// ---- kept-bytes segment sink ------------------------------------------------

/** Accumulates the kept items' raw bytes (comma-separated) in fixed-size
 * segments — the filtered `items` array body without its brackets. Bounded,
 * append-only; never re-encodes the items. */
export class ByteSink {
  readonly segments: Uint8Array[] = [];
  private cur: Uint8Array;
  private off = 0;
  totalLen = 0;

  constructor(private readonly segSize = 1 << 20) {
    this.cur = new Uint8Array(this.segSize);
  }

  write(bytes: Uint8Array): void {
    let src = 0;
    while (src < bytes.length) {
      const room = this.segSize - this.off;
      const take = Math.min(room, bytes.length - src);
      this.cur.set(bytes.subarray(src, src + take), this.off);
      this.off += take;
      src += take;
      if (this.off === this.segSize) {
        this.segments.push(this.cur);
        this.cur = new Uint8Array(this.segSize);
        this.off = 0;
      }
    }
    this.totalLen += bytes.length;
  }

  /** Seal the sink: flush the partial tail segment. Call once, after the
   * last write. */
  finish(): Uint8Array[] {
    if (this.off > 0) {
      this.segments.push(this.cur.subarray(0, this.off));
      this.off = 0;
      this.cur = new Uint8Array(0);
    }
    return this.segments;
  }
}

// ---- queue filter pipeline ---------------------------------------------------

export interface PairAgg {
  pair: string;
  src: string;
  tgt: string;
  count: number;
  minCost: number | null;
}

/** Budget tiers summarized in queue-preview.json — twin of
 * BUDGET_TIERS_USD / build_budget_tiers in generate_sweep_queue.py.
 * Keep values, field names, order, and rounding equal to the Python side. */
export const BUDGET_TIERS_USD = [1, 10, 100, 1000];

export interface BudgetTierAcc {
  budget_usd: number;
  spent: number;
  items: number;
  pairs: Set<string>;
  models: Set<string>;
  maxPriority: number | null;
}

export function newBudgetTierAccs(): BudgetTierAcc[] {
  return BUDGET_TIERS_USD.map((b) => ({
    budget_usd: b,
    spent: 0,
    items: 0,
    pairs: new Set<string>(),
    models: new Set<string>(),
    maxPriority: null,
  }));
}

/** Greedy tier accumulation over one KEPT item, in ranking (stream) order —
 * the exact walk build_budget_tiers does over the published items. */
export function accumulateBudgetTiers(accs: BudgetTierAcc[], it: any): void {
  const cost = it.est_cost_usd;
  if (typeof cost !== "number" || !isFinite(cost) || cost < 0) return;
  const lp = (it.language_pair ?? "").trim().toLowerCase();
  const model = it.model;
  const pr = it.priority;
  for (const acc of accs) {
    if (acc.spent + cost > acc.budget_usd) continue;
    acc.spent += cost;
    acc.items += 1;
    if (lp) acc.pairs.add(lp);
    if (model) acc.models.add(model);
    if (Number.isInteger(pr)) {
      acc.maxPriority = acc.maxPriority == null ? pr : Math.max(acc.maxPriority, pr);
    }
  }
}

export function budgetTierSummaries(accs: BudgetTierAcc[]): any[] {
  return accs.map((a) => ({
    budget_usd: a.budget_usd,
    items: a.items,
    total_cost_usd: Math.round(a.spent * 10000) / 10000,
    pairs: a.pairs.size,
    models: a.models.size,
    max_priority: a.maxPriority,
  }));
}

export interface QueueScanResult {
  /** Top-level member keys in original document order. */
  memberOrder: string[];
  /** Raw value bytes of every non-items member (metadata included). */
  capturedRaw: Map<string, Uint8Array>;
  itemsSeen: boolean;
  beforeCount: number;
  keptCount: number;
  /** Comma-separated kept item bytes (the filtered array body). */
  keptSegments: Uint8Array[];
  keptBytesLen: number;
  /** Per-language-pair aggregation over KEPT items (v4 buildQueuePreview). */
  byPair: Map<string, PairAgg>;
  /** Budget-tier accumulation over KEPT items in stream (ranking) order. */
  budgetTiers: BudgetTierAcc[];
}

const COMMA = new Uint8Array([0x2c]);

/** Stream the base queue.json, drop board-covered items, and accumulate the
 * survivors' raw bytes + the preview's per-pair aggregation — the streaming
 * equivalent of v4's `dropCompleted` + the aggregation half of
 * `buildQueuePreview`, without ever holding the parsed items array. */
export async function filterQueueStream(
  stream: AsyncIterable<Uint8Array>,
  coverage: Set<string>,
): Promise<QueueScanResult> {
  const coveredModels = coveredModelsOf(coverage);
  const dec = new TextDecoder();
  const sink = new ByteSink();
  const byPair = new Map<string, PairAgg>();
  const budgetTiers = newBudgetTierAccs();
  const memberOrder: string[] = [];
  const capturedRaw = new Map<string, Uint8Array>();
  let itemsSeen = false;
  let beforeCount = 0;
  let keptCount = 0;

  const scanner = new TopLevelObjectScanner({
    member(key: string): MemberMode {
      memberOrder.push(key);
      if (key === "items") {
        itemsSeen = true;
        return "elements";
      }
      return "capture";
    },
    element(bytes: Uint8Array): void {
      beforeCount++;
      const it = JSON.parse(dec.decode(bytes));
      if (itemIsCovered(it, coverage, coveredModels)) return;
      if (keptCount > 0) sink.write(COMMA);
      sink.write(bytes);
      keptCount++;
      // budget tiers accumulate over every kept item, before the pair-shape
      // early-return below — build_budget_tiers walks all published items.
      accumulateBudgetTiers(budgetTiers, it);
      // per-pair aggregation over kept items (mirrors buildQueuePreview)
      const lp = (it.language_pair ?? "").trim().toLowerCase();
      if (!lp.includes(">")) return;
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
    },
    captured(key: string, raw: Uint8Array): void {
      capturedRaw.set(key, raw);
    },
  });

  for await (const chunk of stream) scanner.push(chunk);
  scanner.end();

  // An `items` member that wasn't an array lands in capturedRaw. null is
  // treated as empty (v4: queue.items ?? []); anything else is malformed.
  if (itemsSeen && capturedRaw.has("items")) {
    const raw = dec.decode(capturedRaw.get("items")!).trim();
    capturedRaw.delete("items");
    if (raw !== "null") {
      throw new Error("queue.json `items` member is not an array");
    }
  }

  return {
    memberOrder,
    capturedRaw,
    itemsSeen,
    beforeCount,
    keptCount,
    keptSegments: sink.finish(),
    keptBytesLen: sink.totalLen,
    byPair,
    budgetTiers,
  };
}

/** Reassemble the refreshed queue document: original member order, kept item
 * bytes verbatim, metadata replaced by the caller's mutated re-serialization,
 * all other members byte-identical. Trailing newline as the generator writes. */
export function assembleQueueBody(
  scan: QueueScanResult,
  metadataJson: string,
): Uint8Array<ArrayBuffer> {
  const enc = new TextEncoder();
  const parts: Uint8Array[] = [];
  let started = false;
  const pushStr = (s: string) => parts.push(enc.encode(s));

  pushStr("{");
  const order = scan.memberOrder.filter((k) => k !== "items");
  if (!order.includes("metadata")) order.unshift("metadata");
  // items go where they were; a queue with no items member gets one appended
  const itemsAt = scan.memberOrder.indexOf("items");
  const emitted = new Set<string>();
  const emit = (key: string) => {
    if (emitted.has(key)) return;
    emitted.add(key);
    pushStr((started ? "," : "") + JSON.stringify(key) + ":");
    started = true;
    if (key === "metadata") {
      pushStr(metadataJson);
    } else if (key === "items") {
      pushStr("[");
      for (const seg of scan.keptSegments) parts.push(seg);
      pushStr("]");
    } else {
      parts.push(scan.capturedRaw.get(key)!);
    }
  };
  let seen = 0;
  for (const key of order) {
    if (itemsAt >= 0 && seen === itemsAt) emit("items");
    emit(key);
    seen++;
  }
  emit("items");
  pushStr("}\n");

  let total = 0;
  for (const p of parts) total += p.length;
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

/** Preview top-N selection over the kept-bytes segments: re-scan the
 * filtered array body and JSON.parse items one at a time until the selector
 * is satisfied — typically a few dozen items, never the whole array at once. */
export function selectPreviewFromSegments(
  segments: Uint8Array[],
  policy: any,
  topN: number,
): any[] {
  const sel = new PreviewSelector(policy, topN);
  const dec = new TextDecoder();
  const enc = new TextEncoder();
  const scanner = new TopLevelObjectScanner({
    member: () => "elements",
    element(bytes: Uint8Array): void {
      if (!sel.done) sel.offer(JSON.parse(dec.decode(bytes)));
    },
    captured: () => {},
  });
  scanner.push(enc.encode('{"items":['));
  let complete = true;
  for (const seg of segments) {
    if (sel.done) {
      complete = false;
      break;
    }
    scanner.push(seg);
  }
  if (complete) {
    scanner.push(enc.encode("]}"));
    scanner.end();
  }
  return sel.picked;
}

/** Build queue-preview.json from a completed scan — output identical to
 * v4's buildQueuePreview (same fields, same order, same policy echo). */
export function buildPreviewFromScan(
  scan: QueueScanResult,
  metadata: any,
  fullBytes: number,
  topN: number,
): any {
  const policy = metadata?.preview_policy ?? null;
  const previewItems = selectPreviewFromSegments(scan.keptSegments, policy, topN);
  return {
    metadata: metadata ?? {},
    full_queue: { path: "/queue.json", bytes: fullBytes, items: scan.keptCount },
    preview_count: previewItems.length,
    // Echoed verbatim from the full queue's metadata (parity contract) so
    // the two artifacts can never disagree; omitted for pre-policy queues —
    // without cards the codes cannot be honestly derived here.
    ...(policy ? { preview_policy: policy } : {}),
    items: previewItems,
    pairs: [...scan.byPair.values()].sort((a, b) => b.count - a.count),
    budget_tiers: budgetTierSummaries(scan.budgetTiers),
  };
}

// ---- registry projection ----------------------------------------------------

/** Stream registry.json (10.9 MB served) down to the per-dataset fields the
 * mesh fold consumes — id, path, language_pair, size — without parsing the
 * full document. Everything else is scanned past and discarded. */
export async function projectRegistryStream(
  stream: AsyncIterable<Uint8Array>,
): Promise<{ datasets: any[] }> {
  const dec = new TextDecoder();
  const datasets: any[] = [];
  const scanner = new TopLevelObjectScanner({
    member: (key) => (key === "datasets" ? "elements" : "skip"),
    element(bytes: Uint8Array): void {
      const ds = JSON.parse(dec.decode(bytes));
      datasets.push({
        id: ds.id,
        path: ds.path,
        language_pair: ds.language_pair,
        size: ds.size,
      });
    },
    captured: () => {},
  });
  for await (const chunk of stream) scanner.push(chunk);
  scanner.end();
  return { datasets };
}

// ---- authorization (audit 2026-07-18, M2) -----------------------------------

/** Constant-time comparison of the shared regeneration secret.
 *
 * verify_jwt=true is satisfied by the PUBLIC anon key, so the real gate is
 * this in-handler check of the `x-regen-secret` header against the
 * REGEN_SHARED_SECRET function secret (mirrored in Vault as
 * `regenerate_queue_secret` for the migration-036/055 pg_net trigger).
 * The comparison touches every byte regardless of where a mismatch occurs,
 * so response timing does not leak a prefix; an empty expected secret never
 * matches (fail closed — the handler refuses to run unconfigured). */
export function secretsMatch(provided: string, expected: string): boolean {
  const a = new TextEncoder().encode(provided);
  const b = new TextEncoder().encode(expected);
  let diff = a.length ^ b.length;
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) {
    diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  }
  return diff === 0 && b.length > 0;
}
