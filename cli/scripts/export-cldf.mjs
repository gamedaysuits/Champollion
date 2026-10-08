#!/usr/bin/env node

/**
 * export-cldf.mjs — RETIRED (2026-08-18, champollion.db retirement B7).
 *
 * This script exported a CLDF StructureDataset from the LEGACY facts store
 * (cli/data/champollion.db). That store is retired: the atlas
 * (cli/data/atlas.db) IS CLDF-shaped, and the atlas build already emits a
 * validated StructureDataset — including the per-fact license gating this
 * script used to do at export time (values-join + license gating at emit).
 *
 * Replacement:
 *
 *     node cli/scripts/cldf/build-atlas.mjs
 *     → build/atlas/cldf/champollion-atlas/StructureDataset-metadata.json
 *       (+ languages.csv / parameters.csv / values.csv / codes.csv / sources.bib)
 *
 * Ledger entry: shared/cldf/deprecations.json. The pure table builders this
 * script used (cli/lib/cldf-export.mjs) remain unit-tested in
 * cli/test/cldf-export.test.js.
 */

console.error(
  'export-cldf.mjs is RETIRED — it exported from the retired legacy facts store.\n' +
  'The atlas build emits the canonical CLDF StructureDataset instead:\n\n' +
  '    node cli/scripts/cldf/build-atlas.mjs\n' +
  '    → build/atlas/cldf/champollion-atlas/\n\n' +
  'See shared/cldf/deprecations.json.'
);
process.exit(2);
