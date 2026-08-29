/**
 * Command: tm
 *
 * Manages the Translation Memory cache (.champollion/tm.json).
 *
 * Subcommands:
 *   stats   Show entry count, file size, locale breakdown, and timestamps.
 *   clear   Delete the TM cache (with --yes to skip confirmation, --locale to target one locale).
 *   seed    Back-fill the TM from EXISTING translated content files so a
 *           lost/clobbered .champollion-content.lock doesn't re-bill files
 *           whose translations already sit on disk (--dry-run, --locale).
 *   prune   Remove dead weight: legacy entries missing l/m metadata, entries
 *           whose cached translation matches --matching <regex> (policy
 *           eviction for banned/renamed wording), and (with --older-than
 *           <days>) entries older than N days. Dry report by default; --yes
 *           actually deletes.
 *
 * stats, seed, and prune support --json (single JSON document on stdout).
 *
 * WHY THIS EXISTS:
 *   TM is the primary cost-saving mechanism in champollion — it prevents
 *   re-translating keys whose source text hasn't changed. But users
 *   need visibility into the cache (how big is it? what's cached?)
 *   and a way to reset it (switching providers, fixing a bad batch).
 */

import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { loadTM, saveTM, tmSize, pruneTM, TM_DIR, TM_FILENAME } from '../tm.js';
import { resolveConfig } from '../config.js';
import { resolveRuntime } from '../sync.js';
import { seedTMFromExisting } from '../tm-seed.js';
import { output } from '../output.js';

/**
 * @param {import('../types.js').CLIArgs} args - Parsed CLI arguments
 * @param {string} cwd - Working directory
 * @returns {Promise<number>} Exit code (0 = success, 1 = error)
 */
async function run(args, cwd) {
  const sub = args._[1];

  if (!sub || sub === 'help') {
    printUsage();
    return 0;
  }

  if (sub === 'stats') {
    return runStats(args, cwd);
  }

  if (sub === 'clear') {
    return runClear(args, cwd);
  }

  if (sub === 'seed') {
    return runSeed(args, cwd);
  }

  if (sub === 'prune') {
    return runPrune(args, cwd);
  }

  output.error(`Unknown subcommand: "${sub}". Run "champollion tm --help" for usage.`);
  return 1;
}

// -----------------------------------------------------------------
// tm seed
// -----------------------------------------------------------------

/**
 * Seed the TM from existing translated content files.
 *
 * The block-level TM only fills as files are re-translated, so a project
 * that upgraded with translations already on disk is one lost lock file
 * away from re-billing everything. This walks the existing translations
 * (gated on an up-to-date lock entry) and back-fills field, block, and
 * whole-body entries — see lib/tm-seed.js for the safety rules.
 *
 * Uses the SAME config + pair resolution as sync (resolveRuntime), so
 * entries land under the exact tmMethodKey a future sync will look up.
 * No API key is needed: preflight is skipped, nothing is translated.
 */
async function runSeed(args, cwd) {
  const json = !!args.json;
  // In --json mode stdout carries exactly one JSON document. Quiet mode
  // suppresses the human raws/infos; warnings/errors still reach stderr.
  if (json) output.setMode('quiet');
  const dryRun = !!args.dry;
  const localeFilter = args.locale || null;

  let config;
  try {
    config = resolveConfig(args, cwd);
  } catch (err) {
    output.error(`tm seed: ${err.message}`);
    return 1;
  }

  // dryRun: true skips the preflight readiness check — seeding never
  // calls a translation engine, so it must not demand an API key.
  const { resolvedPairs } = await resolveRuntime(config, cwd, { ...args, dryRun: true });
  if (resolvedPairs.size === 0) {
    if (json) {
      console.log(JSON.stringify({ command: 'tm', action: 'seed', dryRun, seeded: 0, skipped: 0, files: [], note: 'No target languages configured.' }, null, 2));
      return 0;
    }
    output.info('No target languages configured. Add pairs to champollion.config.json.');
    return 0;
  }

  const docusaurus = config.format === 'docusaurus'
    ? {
      localesDir: config.localesDir,
      docsDir: path.join(cwd, 'docs'),
      blogDir: path.join(cwd, 'blog'),
    }
    : null;

  if (!config.contentDir && !docusaurus) {
    if (json) {
      console.log(JSON.stringify({ command: 'tm', action: 'seed', dryRun, seeded: 0, skipped: 0, files: [], note: 'No content lane configured — nothing to seed.' }, null, 2));
      return 0;
    }
    output.info('No content lane configured (no contentDir, not a Docusaurus project).');
    output.info('Key-value sync diffs against the locale files themselves — nothing to seed.');
    return 0;
  }

  const result = seedTMFromExisting({
    cwd,
    pairs: resolvedPairs,
    sourceLocale: config.inputLocale,
    translatableFields: config.translatableFields,
    contentDir: config.contentDir,
    docusaurus,
    dryRun,
    localeFilter,
  });

  if (json) {
    console.log(JSON.stringify({
      command: 'tm',
      action: 'seed',
      dryRun,
      seeded: result.seededFiles,
      skipped: result.skippedFiles,
      entriesAdded: result.entriesAdded,
      entriesExisting: result.entriesExisting,
      saved: !!result.saved,
      files: result.files,
    }, null, 2));
    return 0;
  }

  const verb = dryRun ? 'Would seed' : 'Seeded';
  output.raw(`\n  Translation Memory seed${dryRun ? ' — DRY RUN' : ''}\n`);

  for (const f of result.files) {
    if (f.status === 'seeded') {
      const parts = [];
      if (f.fields > 0) parts.push(`${f.fields} field(s)`);
      if (f.blocks > 0) parts.push(`${f.blocks} block(s)`);
      if (f.body) parts.push('body');
      const detail = parts.length > 0 ? parts.join(' + ') : 'nothing new';
      const cached = f.existing > 0 ? `, ${f.existing} already cached` : '';
      output.raw(`    [SEED] ${f.label} → ${f.code}  ${detail} (${f.added} new${cached})`);
    } else {
      output.raw(`    [SKIP] ${f.label} → ${f.code}  ${f.reason}`);
    }
  }

  output.raw('');
  output.raw(`  ${verb} ${result.seededFiles} file(s), skipped ${result.skippedFiles}.`);
  output.raw(`  Entries: ${result.entriesAdded} new, ${result.entriesExisting} already cached.`);
  if (result.saved) {
    output.raw(`  TM: ${result.tmSizeBefore} → ${result.tmSizeAfter} entries (${path.join(TM_DIR, TM_FILENAME)})`);
  } else if (dryRun && result.entriesAdded > 0) {
    output.raw('  Nothing written (dry run). Re-run without --dry-run to seed.');
  }
  if (result.seededFiles === 0 && result.skippedFiles > 0) {
    output.warn('Nothing was seeded. Seeding requires up-to-date lock entries — run it right after a clean sync, while .champollion-content.lock is intact.');
  }
  output.raw('');
  return 0;
}

// -----------------------------------------------------------------
// tm stats
// -----------------------------------------------------------------

/**
 * Display TM statistics: entry count, file size, timestamps,
 * and a per-locale breakdown. --json emits a single JSON document.
 */
function runStats(args, cwd) {
  const json = !!args.json;
  if (json) output.setMode('quiet');
  const tmPath = path.join(cwd, TM_DIR, TM_FILENAME);

  if (!fs.existsSync(tmPath)) {
    if (json) {
      console.log(JSON.stringify({ command: 'tm', action: 'stats', file: tmPath, exists: false, total: 0 }, null, 2));
      return 0;
    }
    output.raw('\n  Translation Memory — no cache file found');
    output.raw(`  Expected: ${tmPath}`);
    output.raw('  Run "champollion sync" to populate the cache.\n');
    return 0;
  }

  const tm = loadTM(cwd);
  const entryCount = tmSize(tm);

  // File size
  const stat = fs.statSync(tmPath);
  const sizeStr = formatBytes(stat.size);

  // Timestamps from metadata
  const created = tm._meta?.created || 'unknown';
  const createdDate = created !== 'unknown' ? created.split('T')[0] : 'unknown';

  // Find newest entry timestamp
  let newest = null;
  let oldest = null;
  for (const [key, entry] of Object.entries(tm)) {
    if (key === '_meta') continue;
    if (entry.ts) {
      if (!newest || entry.ts > newest) newest = entry.ts;
      if (!oldest || entry.ts < oldest) oldest = entry.ts;
    }
  }
  const newestDate = newest ? newest.split('T')[0] : 'unknown';

  // Per-locale breakdown — only possible for entries that have the l/m fields
  // (added in the TM format enhancement). Old entries show as "unknown".
  const localeStats = {};
  let unknownCount = 0;

  for (const [key, entry] of Object.entries(tm)) {
    if (key === '_meta') continue;

    const locale = entry.l || null;
    const method = entry.m || null;

    if (!locale) {
      unknownCount++;
      continue;
    }

    if (!localeStats[locale]) {
      localeStats[locale] = { total: 0, methods: {} };
    }
    localeStats[locale].total++;

    const methodKey = method || 'unknown';
    localeStats[locale].methods[methodKey] = (localeStats[locale].methods[methodKey] || 0) + 1;
  }

  // Sort locales by entry count (descending)
  const sortedLocales = Object.entries(localeStats)
    .sort((a, b) => b[1].total - a[1].total);

  if (json) {
    const byLocale = {};
    for (const [locale, stats] of sortedLocales) {
      byLocale[locale] = { total: stats.total, byMethod: stats.methods };
    }
    console.log(JSON.stringify({
      command: 'tm',
      action: 'stats',
      file: tmPath,
      exists: true,
      total: entryCount,
      sizeBytes: stat.size,
      created: createdDate,
      lastEntry: newestDate,
      byLocale,
      unknownLocale: unknownCount,
    }, null, 2));
    return 0;
  }

  output.raw('\n  Translation Memory — .champollion/tm.json\n');
  output.raw(`  Entries:      ${entryCount.toLocaleString()}`);
  output.raw(`  File size:    ${sizeStr}`);
  output.raw(`  Created:      ${createdDate}`);
  output.raw(`  Last entry:   ${newestDate}`);

  if (sortedLocales.length > 0 || unknownCount > 0) {
    output.raw('\n  By locale:');

    for (const [locale, stats] of sortedLocales) {
      const methodParts = Object.entries(stats.methods)
        .sort((a, b) => b[1] - a[1])
        .map(([m, count]) => `${m}: ${count}`);
      const methodStr = methodParts.length > 0 ? `  (${methodParts.join(', ')})` : '';
      output.raw(`    ${locale.padEnd(6)} ${String(stats.total).padStart(5)} entries${methodStr}`);
    }

    if (unknownCount > 0) {
      output.raw(`    ${'(old)'.padEnd(6)} ${String(unknownCount).padStart(5)} entries  (pre-v3.4, no locale metadata)`);
    }
  }

  output.raw('');
  return 0;
}

// -----------------------------------------------------------------
// tm clear
// -----------------------------------------------------------------

/**
 * Clear the TM cache. Supports full clear or per-locale clear.
 *
 * --yes skips the confirmation prompt.
 * --locale <code> removes only entries for that locale (requires l field).
 */
async function runClear(args, cwd) {
  const tmPath = path.join(cwd, TM_DIR, TM_FILENAME);
  const locale = args.locale || null;
  const skipConfirm = args.yes || false;

  if (!fs.existsSync(tmPath)) {
    output.raw('\n  No TM cache file found — nothing to clear.\n');
    return 0;
  }

  if (locale) {
    // Per-locale clear — remove entries matching locale, keep the rest
    return clearLocale(cwd, tmPath, locale, skipConfirm);
  }

  // Full clear — delete the file
  if (!skipConfirm) {
    const tm = loadTM(cwd);
    const count = tmSize(tm);
    const confirmed = await confirm(
      `  Delete TM cache? (${count.toLocaleString()} entries will be lost) [y/N] `
    );
    if (!confirmed) {
      output.raw('  Aborted.\n');
      return 0;
    }
  }

  fs.unlinkSync(tmPath);
  output.raw('\n  ✓ TM cache cleared (.champollion/tm.json deleted)');
  output.raw('  Next sync will re-translate all keys.\n');
  return 0;
}

/**
 * Remove TM entries matching a specific locale.
 * Entries without the `l` field (old format) are preserved.
 */
async function clearLocale(cwd, tmPath, locale, skipConfirm) {
  const tm = loadTM(cwd);
  let removeCount = 0;

  // Count entries to remove
  for (const [key, entry] of Object.entries(tm)) {
    if (key === '_meta') continue;
    if (entry.l === locale) removeCount++;
  }

  if (removeCount === 0) {
    output.raw(`\n  No TM entries found for locale "${locale}".`);
    output.raw('  (Old entries without locale metadata cannot be filtered.)\n');
    return 0;
  }

  if (!skipConfirm) {
    const confirmed = await confirm(
      `  Remove ${removeCount} TM entries for locale "${locale}"? [y/N] `
    );
    if (!confirmed) {
      output.raw('  Aborted.\n');
      return 0;
    }
  }

  // Remove matching entries
  for (const key of Object.keys(tm)) {
    if (key === '_meta') continue;
    if (tm[key].l === locale) delete tm[key];
  }

  saveTM(cwd, tm);
  const remaining = tmSize(tm);
  output.raw(`\n  ✓ Removed ${removeCount} entries for locale "${locale}" (${remaining} remaining)\n`);
  return 0;
}

// -----------------------------------------------------------------
// tm prune
// -----------------------------------------------------------------

/**
 * Prune dead-weight TM entries.
 *
 * Removes (a) legacy entries missing the l/m metadata fields (pre-v3.4 —
 * unfilterable per-locale, keyed under the pre-tmMethodKey scheme),
 * (b) with --matching <regex>, entries whose cached translation matches the
 * pattern — the policy-eviction lane for wording that was banned or renamed
 * after it was cached (stale entries would otherwise resurrect the old
 * wording if the old source text ever reappears), and
 * (c) with --older-than <days>, entries whose ts is older than N days.
 *
 * Default is a DRY REPORT (counts by category, nothing deleted);
 * --yes actually deletes. --json emits a single JSON document.
 */
async function runPrune(args, cwd) {
  const json = !!args.json;
  if (json) output.setMode('quiet');
  const tmPath = path.join(cwd, TM_DIR, TM_FILENAME);
  const doDelete = !!args.yes;

  let olderThanDays = null;
  const olderRaw = args['older-than'];
  if (olderRaw !== undefined && olderRaw !== null && olderRaw !== false) {
    olderThanDays = Number.parseFloat(String(olderRaw));
    if (!Number.isFinite(olderThanDays) || olderThanDays < 0) {
      output.error(`tm prune: --older-than must be a non-negative number of days (got "${olderRaw}").`);
      return 1;
    }
  }

  let matching = null;
  const matchingRaw = args.matching;
  if (matchingRaw !== undefined && matchingRaw !== null && matchingRaw !== false) {
    if (typeof matchingRaw !== 'string' || matchingRaw.length === 0) {
      output.error('tm prune: --matching requires a non-empty regular expression.');
      return 1;
    }
    try {
      // Case-sensitive, no flags: banned-term patterns are usually
      // case-shaped ("NASA" vs a word that merely contains "nasa").
      // Encode any case-insensitivity in the pattern itself ([Cc]…).
      matching = new RegExp(matchingRaw);
    } catch (err) {
      output.error(`tm prune: --matching is not a valid regular expression: ${err.message}`);
      return 1;
    }
  }

  if (!fs.existsSync(tmPath)) {
    if (json) {
      console.log(JSON.stringify({
        command: 'tm', action: 'prune', file: tmPath, exists: false,
        dryRun: !doDelete, removed: 0, kept: 0,
        byReason: { legacy: 0, matching: 0, stale: 0 }, deleted: false,
      }, null, 2));
      return 0;
    }
    output.raw('\n  No TM cache file found — nothing to prune.\n');
    return 0;
  }

  const tm = loadTM(cwd);
  const before = tmSize(tm);
  // pruneTM mutates the loaded object either way; the dry report simply
  // never persists the mutation (only --yes reaches saveTM).
  const report = pruneTM(tm, { legacy: true, matching, olderThanDays });
  const deleted = doDelete && report.removed > 0;
  if (deleted) {
    saveTM(cwd, tm);
  }

  if (json) {
    console.log(JSON.stringify({
      command: 'tm', action: 'prune', file: tmPath, exists: true,
      dryRun: !doDelete, olderThanDays, matching: matching !== null ? matchingRaw : null,
      total: before, removed: report.removed, kept: report.kept,
      byReason: report.byReason, deleted,
    }, null, 2));
    return 0;
  }

  const verb = doDelete ? 'Removed' : 'Would remove';
  output.raw(`\n  Translation Memory prune${doDelete ? '' : ' — DRY REPORT'}\n`);
  output.raw(`  Entries scanned: ${before}`);
  output.raw(`  ${verb}:         ${report.removed}`);
  output.raw(`    legacy (no locale/method metadata): ${report.byReason.legacy}`);
  if (matching !== null) {
    output.raw(`    matching ${matching}: ${report.byReason.matching}`);
  }
  if (olderThanDays !== null) {
    output.raw(`    stale (older than ${olderThanDays} day(s)):     ${report.byReason.stale}`);
  }
  output.raw(`  Kept:            ${report.kept}`);
  if (!doDelete && report.removed > 0) {
    output.raw('\n  Nothing deleted (dry report). Re-run with --yes to prune.');
  } else if (deleted) {
    output.raw(`\n  TM: ${before} → ${report.kept} entries (${path.join(TM_DIR, TM_FILENAME)})`);
  }
  output.raw('');
  return 0;
}

// -----------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------

/**
 * Format bytes into a human-readable string.
 * @param {number} bytes
 * @returns {string} e.g., "1.2 MB"
 */
function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Prompt for confirmation. Returns true if the user types 'y' or 'yes'.
 * Returns false for any other input (including empty / Enter).
 */
function confirm(prompt) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(prompt, (answer) => {
      rl.close();
      resolve(/^y(es)?$/i.test(answer.trim()));
    });
  });
}

function printUsage() {
  output.raw(`
  champollion tm — Translation Memory cache management

  SUBCOMMANDS
    stats    Show entry count, file size, and locale breakdown
    clear    Delete the TM cache (--yes to skip confirmation)
    seed     Back-fill the TM from existing translated content files
             (field + block + whole-body entries; only files whose lock
             entry is up to date and whose block counts align — never
             guessed). Protects against a lost .champollion-content.lock.
    prune    Remove legacy entries missing locale/method metadata, entries
             whose cached translation matches --matching <regex> (evict
             banned/renamed wording so it can never be re-served), and
             optionally entries older than --older-than <days>.
             Dry report by default; --yes actually deletes.

  OPTIONS
    --locale <code>      Clear/seed only entries for a specific locale
    --yes, -y            Skip confirmation prompt (clear); actually delete (prune)
    --dry-run            Show what seed would store without writing (seed)
    --matching <regex>   Also prune entries whose translation matches (prune;
                         case-sensitive — encode [Cc]ase in the pattern)
    --older-than <days>  Also prune entries older than N days (prune)
    --json               Single JSON document output (stats, seed, prune)

  EXAMPLES
    champollion tm stats                  # Show cache statistics
    champollion tm clear                  # Clear entire cache (with confirmation)
    champollion tm clear --yes            # Clear without confirmation
    champollion tm clear --locale fr      # Clear only French entries
    champollion tm seed --dry-run         # Preview what would be seeded
    champollion tm seed                   # Seed TM from existing translations
    champollion tm prune                  # Dry report of prunable entries
    champollion tm prune --yes            # Delete legacy entries
    champollion tm prune --matching 'Old Brand Name' --yes  # Evict banned wording
    champollion tm prune --older-than 90 --yes  # Also delete entries >90 days old
  `);
}

export { run };
