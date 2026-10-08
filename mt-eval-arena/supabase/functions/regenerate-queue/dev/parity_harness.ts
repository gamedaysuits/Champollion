// dev/parity_harness.ts — real-size offline replay of the streaming refresh.
//
// Runs the exact lib.ts pipeline the edge function uses (filter → metadata
// mutate → assemble → preview → registry projection → mesh fold) against
// LOCAL copies of the served artifacts, with the board injected from a JSON
// fixture — no network, no env. Used two ways:
//
//   1. MEMORY PROOF: run under a V8 heap cap far below the 256 MB isolate
//      limit to demonstrate the redesign fits prod scale:
//
//        deno run --allow-read --allow-write \
//          --v8-flags=--max-old-space-size=160 \
//          dev/parity_harness.ts --queue queue.json --registry registry.json \
//          --mesh mesh.json --board board.json --outdir out/
//
//   2. PYTHON PARITY: feed the same base artifacts + board fixture to
//      `generate_sweep_queue.py --refresh` (fetch injected) and deep-compare
//      the two output sets (mask refreshed_at timestamps + the 1-byte
//      timestamp-format difference in full_queue.bytes).
//
// The board fixture: {"coverage": ["token|model_short|condition", ...],
//                     "results": [{"token","strength","submitted_at"}, ...]}
//
// NOT deployed: the edge function's import graph (index.ts → lib.ts) never
// reaches this file.

// deno-lint-ignore-file no-explicit-any

import {
  assembleQueueBody,
  buildPreviewFromScan,
  buildTokenPair,
  filterQueueStream,
  foldResultsIntoMesh,
  projectRegistryStream,
} from "../lib.ts";

function arg(name: string): string {
  const i = Deno.args.indexOf(`--${name}`);
  if (i === -1 || i + 1 >= Deno.args.length) {
    console.error(`missing --${name}`);
    Deno.exit(2);
  }
  return Deno.args[i + 1];
}

// heapUsed + external is what the isolate's memory accounting sees (the
// kept-bytes segments and the assembled body are external ArrayBuffers,
// not JS-heap objects); rss includes freed-but-unreturned OS pages and the
// deno runtime itself, so it overstates.
let peakLive = 0;
let peakHeap = 0;
function sample(label: string) {
  const m = Deno.memoryUsage();
  const live = m.heapUsed + m.external;
  peakLive = Math.max(peakLive, live);
  peakHeap = Math.max(peakHeap, m.heapUsed);
  console.error(
    `[mem] ${label.padEnd(18)} heapUsed=${(m.heapUsed / 1e6).toFixed(1)}MB ` +
      `external=${(m.external / 1e6).toFixed(1)}MB ` +
      `live=${(live / 1e6).toFixed(1)}MB rss=${(m.rss / 1e6).toFixed(1)}MB`,
  );
}

const queuePath = arg("queue");
const registryPath = arg("registry");
const meshPath = arg("mesh");
const boardPath = arg("board");
const outDir = arg("outdir");
await Deno.mkdir(outDir, { recursive: true });

const board = JSON.parse(await Deno.readTextFile(boardPath));
const coverage = new Set<string>(board.coverage);
const results: any[] = board.results;
sample("board loaded");

const t0 = performance.now();
const queueFile = await Deno.open(queuePath, { read: true });
const scan = await filterQueueStream(queueFile.readable, coverage);
const t1 = performance.now();
sample("filtered");
console.error(
  `[filter] ${scan.beforeCount} items -> kept ${scan.keptCount} ` +
    `(dropped ${scan.beforeCount - scan.keptCount}) in ${
      ((t1 - t0) / 1000).toFixed(2)
    }s; kept bytes ${(scan.keptBytesLen / 1e6).toFixed(1)}MB`,
);

const metaRaw = scan.capturedRaw.get("metadata");
const metadata = metaRaw ? JSON.parse(new TextDecoder().decode(metaRaw)) : {};
metadata.open_items = scan.keptCount;
metadata.refreshed_at = new Date().toISOString();

const queueBody = assembleQueueBody(scan, JSON.stringify(metadata));
sample("assembled");
const preview = buildPreviewFromScan(scan, metadata, queueBody.length, 25);
scan.keptSegments.length = 0; // released before upload, as in index.ts
sample("preview built");

await Deno.writeFile(`${outDir}/queue.json`, queueBody);
await Deno.writeTextFile(
  `${outDir}/queue-preview.json`,
  JSON.stringify(preview) + "\n",
);
const t2 = performance.now();

const mesh = JSON.parse(await Deno.readTextFile(meshPath));
const registryFile = await Deno.open(registryPath, { read: true });
const registry = await projectRegistryStream(registryFile.readable);
sample("registry projected");
foldResultsIntoMesh(mesh, results, buildTokenPair(registry), registry);
await Deno.writeTextFile(`${outDir}/mesh.json`, JSON.stringify(mesh) + "\n");
const t3 = performance.now();
sample("mesh folded");

console.error(
  `[time] filter+assemble+preview ${((t2 - t0) / 1000).toFixed(2)}s, ` +
    `registry+mesh ${((t3 - t2) / 1000).toFixed(2)}s, ` +
    `total ${((t3 - t0) / 1000).toFixed(2)}s`,
);
console.error(
  `[peak] heapUsed=${(peakHeap / 1e6).toFixed(1)}MB live(heap+external)=${
    (peakLive / 1e6).toFixed(1)
  }MB (sampled per phase)`,
);
console.log(JSON.stringify({
  ok: true,
  dropped: scan.beforeCount - scan.keptCount,
  remaining: scan.keptCount,
  results_on_board: results.length,
  measured_edges: mesh.measured_edges,
  queue_bytes: queueBody.length,
  peak_heap_mb: Math.round(peakHeap / 1e6),
  peak_live_mb: Math.round(peakLive / 1e6),
}));
