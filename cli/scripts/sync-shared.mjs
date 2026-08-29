#!/usr/bin/env node
/**
 * sync:shared — bundle the monorepo-root SSOT files into cli/shared/ so the
 * published npm package carries them.
 *
 * WHY THIS IS A FILE: it used to be a ~1,500-character `node -e` one-liner
 * inside package.json. Nobody could read it, nothing could test it, and its
 * failure mode was the worst kind — every copy was wrapped in
 * `if (fs.existsSync(src))`, so a source file that had been renamed, moved, or
 * never added to the list was indistinguishable from "not in a monorepo
 * checkout". It logged a count and exited 0 either way. `prepack` runs this,
 * so a silent skip publishes a package with a stale bundled SSOT.
 *
 * THE DISTINCTION THAT MATTERS:
 *   • root shared/ ABSENT      → standalone checkout of the published package.
 *                                Nothing to sync. Exit 0, quietly. Legitimate.
 *   • root shared/ PRESENT but a declared file is missing
 *                              → a real bug (renamed/moved/deleted upstream).
 *                                FAIL, name the file, exit non-zero.
 *
 * Run: node cli/scripts/sync-shared.mjs   (from cli/, or anywhere)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CLI_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ROOT_SHARED = path.join(CLI_DIR, '..', 'shared');
const CLI_SHARED = path.join(CLI_DIR, 'shared');

/**
 * Files copied from <root>/shared/<src> to cli/shared/<src>.
 *
 * Every entry here is REQUIRED once the root shared/ directory exists — a
 * missing one fails the run rather than being skipped.
 */
const BUNDLED = [
  // Cross-runtime SSOT read by CLI code at runtime.
  'model-aliases.json',
  'method-registry.json',
  'metric-registry.json',
  'human-services.json',
  'licenses.json',
  'license-corrections.json',
  // The upstream licence evidence chain. It OUTRANKS both files above at
  // runtime (cli/lib/license-gate.mjs::loadLicenseRegister), so an unsynced
  // bundle would silently serve the older, pattern-matched verdicts —
  // including grollemundbantu as CC-BY when it is CC-BY-NC, and nts without
  // its NoDerivatives clause.
  'license-evidence.json',
  // The closed 17-code domain taxonomy. Read by build-seam-runs.mjs and the
  // website's seam surfaces; was missing from the old list entirely.
  'domain-taxonomy.json',

  'catalogue/external-results.json',
  'catalogue/method-coverage.json',
  // Pivot sets + QE checkpoints behind the metricModelSupport flattening
  // (registers.js). Unsynced, a published install would treat AfriCOMET's
  // pass-through pivots (eng/fra) as covered targets — the exact
  // recommend-africomet-for-French mistake the register exists to prevent.
  'catalogue/metric-coverage.json',
  // Which metric to BELIEVE for a target language (recommend.js tier 4).
  // Was missing from the old list, so `champollion recommend` silently lost
  // its metric-reliability tier in the published package.
  'catalogue/metric-reliability.json',
  // The register/formality PROMPT CONFIG — what we call each politeness
  // system ("T-V", "keigo") and the text we send an LLM to ask for a register.
  // Third time this class of bug has appeared in this list: without it, a
  // published install loads no presets at all, so every language silently
  // loses its formality system and register prompts, and the CLI translates
  // German with no notion of Sie/du. registers.js swallowed the missing file
  // by design ("absent in a packaged install"), which is exactly why nobody
  // saw it.
  'catalogue/register-presets.json',
  // Product configuration the runtime cannot work without: script converters,
  // the private-use conlang locales the CLI ships, alias routing, and the
  // per-language eval config.
  'catalogue/card-config.json',
  // Inclusive-language guidance per family/language, applied by registers.js to
  // card.gender.inclusiveGuidance. Unsynced, a published install silently
  // dropped it and every gendered-language translation lost its guidance.
  'catalogue/gender-guidance.json',
  // The endangerment-scale decision (authority order + per-scale vocab) — the
  // reader's vitality bridge in BOTH runtimes resolves this file and silently
  // skips the bridge when it is absent, which is exactly what a published
  // install did: every card's vitality tier quietly vanished outside the
  // monorepo. Fourth instance of this list's signature bug class.
  'catalogue/vitality-scales.json',

  'schemas/external-results.schema.json',
  'schemas/metric-registry.schema.json',
  'schemas/model-aliases.schema.json',
  'schemas/licenses.schema.json',
  'schemas/domain-taxonomy.schema.json',
  'schemas/metric-reliability.schema.json',
  'schemas/human-services.schema.json',
  'schemas/method-registry.schema.json',
];

/**
 * Files with a destination OTHER than cli/shared/ — derived copies.
 * Same required-once-root-exists rule.
 */
const DERIVED = [
  {
    src: 'connection-quality.json',
    dest: path.join('website', 'src', 'utils', 'connection-quality.json'),
    why: 'cq-v1 constants, read by the website twin (connectionQuality.mjs)',
  },
];

/**
 * Deliberately NOT bundled. Listed so the omission is a recorded decision
 * rather than something that looks like an oversight in the next audit.
 */
const EXCLUDED = [
  ['catalogue/external-mt-index.json',
   '1.6 MB bulk cited-results index — monorepo-only by design (recommend.js '
   + 'tier 3 degrades to "no bulk evidence" in the npm package; documented in '
   + 'lib/recommend.js).'],
  ['queue-selection-vectors.json', 'harness-side only — no CLI consumer.'],
  ['budget-tier-vectors.json',
   'harness + regenerate-queue edge-function twins only — no CLI consumer.'],
  ['catalogue/sources/', 'provenance snapshots for the catalogue, not runtime data.'],
];

// The glossary lives under cli/shared/ already (not copied from root) and is
// derived into the website build. It has always been a hard failure.
const GLOSSARY_SRC = path.join(CLI_SHARED, 'explainers', 'glossary.json');
const GLOSSARY_DEST = path.join(CLI_DIR, 'website', 'data', 'explainers', 'glossary.json');

function copy(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

function main() {
  const rootPresent = fs.existsSync(ROOT_SHARED);

  if (!rootPresent) {
    // Standalone checkout of the published package: the tracked cli/shared/
    // copies ARE the SSOT here. Nothing to do, and nothing wrong.
    console.log(
      '[sync:shared] monorepo-root shared/ not present — standalone checkout, '
      + 'nothing to sync (the tracked cli/shared/ copies stand).',
    );
  } else {
    const missing = [];
    let copied = 0;

    for (const rel of BUNDLED) {
      const src = path.join(ROOT_SHARED, rel);
      if (!fs.existsSync(src)) { missing.push(`shared/${rel}`); continue; }
      copy(src, path.join(CLI_SHARED, rel));
      copied++;
    }

    for (const { src: rel, dest } of DERIVED) {
      const src = path.join(ROOT_SHARED, rel);
      if (!fs.existsSync(src)) { missing.push(`shared/${rel}`); continue; }
      copy(src, path.join(CLI_DIR, dest));
      copied++;
    }

    if (missing.length) {
      console.error(
        `\n[sync:shared] FAILED — monorepo-root shared/ exists, but `
        + `${missing.length} declared SSOT file(s) are missing:\n`
        + missing.map((m) => `  • ${m}`).join('\n')
        + `\n\nThis is not a standalone checkout, so these are real gaps: the `
        + `file was renamed, moved, or deleted upstream. Refusing to bundle a `
        + `partial SSOT — prepack runs this, and a partial bundle ships a `
        + `stale published package.\n\nFix the path, or remove the entry from `
        + `BUNDLED/DERIVED in cli/scripts/sync-shared.mjs if it is `
        + `intentionally gone.\n`,
      );
      process.exit(1);
    }

    console.log(`[sync:shared] bundled ${copied} SSOT file(s) from shared/ into cli/`);
    for (const [rel, why] of EXCLUDED) {
      console.log(`[sync:shared]   not bundled: ${rel} — ${why}`);
    }
  }

  // Glossary → website. Always required, monorepo or not.
  if (!fs.existsSync(GLOSSARY_SRC)) {
    console.error(
      `[sync:shared] MISSING ${path.relative(CLI_DIR, GLOSSARY_SRC)} — `
      + 'glossary SSOT not found, cannot derive the website copy',
    );
    process.exit(1);
  }
  copy(GLOSSARY_SRC, GLOSSARY_DEST);
  console.log(
    '[sync:shared] derived website/data/explainers/glossary.json from '
    + 'shared/explainers/glossary.json',
  );
}

main();
