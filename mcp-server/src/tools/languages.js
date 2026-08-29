/**
 * Language tools — search and browse Champollion language cards.
 *
 * Card data comes from ONE of three sources, tried in order:
 *   1. CHAMPOLLION_CARDS_DIR — explicit override (same variable the CLI and
 *      the Python harness honor). Set-but-unusable is an immediate error:
 *      the user pointed somewhere specific, and silently reading a different
 *      corpus would be worse than failing.
 *   2. The monorepo checkout's cli/shared/language-cards/ (full corpus).
 *   3. The champollion package's bundled shared/cards-fallback.json — the
 *      same bundle the published CLI runs on: 1,157 full cards plus a
 *      manifest of every concrete code → name/aliases, so the FULL catalogue
 *      is searchable by name offline, with rich fields on the core set and
 *      honest absences elsewhere.
 *
 * NOTHING is hardcoded and nothing degrades silently. This file used to
 * carry a hand-written 40-language FALLBACK_INDEX served with only a stderr
 * note — an agent outside the repo was told "No languages found" for ~7,887
 * real languages, indistinguishable from an authoritative answer (and the
 * published install crashed before even reaching it, because the adapter
 * import was a static repo-relative path). When no source resolves, the
 * server now REFUSES TO START, listing every path tried and the fix — the
 * same posture as translate.js's "refusing to start with an empty or
 * hand-guessed method surface". With `champollion` a real dependency, a
 * missing card surface always means a broken install, never a legitimate
 * degraded mode.
 */

import { readdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const require = createRequire(import.meta.url);

// Monorepo layout: mcp-server/src/tools/ → repo root is three up.
const REPO_CLI = resolve(__dirname, '../../../cli');

/**
 * Resolve the ONE card adapter (cli/lib/cards/reader.js), monorepo checkout
 * first so development never resolves a stale registry install, then the
 * `champollion` dependency for published installs. A ninth private reader is
 * how this server came to serve "[object Object]" — the adapter is not
 * optional, so failing to find it is a startup error, not a fallback.
 *
 * @returns {Promise<{reader: object, packageRoot: string, source: string}>}
 */
async function resolveAdapter() {
  const attempts = [];

  const repoReader = resolve(REPO_CLI, 'lib/cards/reader.js');
  if (existsSync(repoReader)) {
    const reader = await import(pathToFileURL(repoReader).href);
    return { reader, packageRoot: REPO_CLI, source: 'monorepo checkout' };
  }
  attempts.push(`${repoReader} (monorepo checkout — not present)`);

  try {
    const entry = require.resolve('champollion');
    const reader = await import('champollion');
    return {
      reader,
      packageRoot: dirname(entry),
      source: 'champollion package',
    };
  } catch (err) {
    attempts.push(`champollion package (${err.code ?? err.message})`);
  }

  throw new Error(
    'Cannot resolve the champollion card adapter — refusing to start with no '
    + 'card surface. Tried:\n'
    + attempts.map((a) => `  - ${a}`).join('\n')
    + '\nFix: run inside the Champollion monorepo, or `npm install` in the '
    + 'MCP server directory so the `champollion` dependency is present.',
  );
}

/** One index entry from a full (normalized) card. */
function entryFromCard(card, { display, isDisputed }) {
  // Speaker estimates: ONE claim answers as itself; several claims answer as
  // the DISAGREEMENT, every value shown. Taking estimates[0] silently elected
  // ELCat's British-Columbia-only count as Plains Cree's total — 'speakers:
  // 10-99' on the flagship card, which is exactly the pick-a-winner move the
  // card boundary forbids.
  const claims = Array.isArray(card.speakerEstimates) ? card.speakerEstimates : [];
  const counts = [...new Set(claims.map((e) => e?.count).filter((c) => c != null && c !== ''))];
  const speakers = card.vitality?.speakerCount
    || (counts.length === 1 ? counts[0]
      : counts.length > 1 ? `${counts.join(' / ')} (sources differ)` : '');
  const fam = card.classification?.family;
  return {
    code: card.code || card.iso639_3 || card.bcp47 || '',
    name: card.name || '',
    endonym: card.nativeName || card.endonym || '',
    // display() yields the agreed value and nothing on a real dispute —
    // but 'disputed' and 'unknown' are different claims, so a genuine
    // disagreement says so instead of reading as ignorance.
    family: display(fam) || (isDisputed?.(fam) ? 'disputed' : ''),
    speakers,
    script: card.script || (Array.isArray(card.scripts) ? card.scripts[0] : '') || '',
    region: card.macroarea || '',
    typology: card.typologicalProfile?.verbSynthesis
      || card.typologicalProfile?.morphologicalSynthesis || '',
    // Documented alternate names so a language is findable by ANY of its
    // names — the same alias set the Atlas searches.
    aliases: [
      ...(Array.isArray(card.alternateNames) ? card.alternateNames : []),
      ...(Array.isArray(card.aliases) ? card.aliases : []),
    ],
    // Keep the full card for detailed lookups
    _raw: card,
  };
}

/** Build the index from a language-cards directory (full corpus). */
async function indexFromDir(dir, ctx) {
  const { normalizeCard } = ctx;
  const files = await readdir(dir);
  const jsonFiles = files.filter((f) => f.endsWith('.json') && !f.startsWith('.'));

  const index = [];
  const cards = await Promise.allSettled(
    jsonFiles.map(async (f) => {
      const raw = await readFile(join(dir, f), 'utf-8');
      // THROUGH THE ONE ADAPTER, like every other consumer.
      return normalizeCard(JSON.parse(raw));
    }),
  );

  for (const result of cards) {
    if (result.status !== 'fulfilled') continue;
    const card = result.value;
    // The cards dir also holds generated reference files (language-tree.json)
    // that are not cards — a card always carries a code and a name.
    if (!(card.code || card.iso639_3 || card.bcp47) || !card.name) continue;
    // A LOCALE IS NOT A LANGUAGE: fra-CA carries French's name and facts;
    // indexing the 8,675 locale cards would return one language a dozen
    // times for one query.
    if (card.locale?.language) continue;
    index.push(entryFromCard(card, ctx));
  }
  return index;
}

/**
 * Build the index from the CLI's bundled cards-fallback.json: full entries
 * for the ~1,157 bundled core cards, lean name/alias entries for every other
 * concrete language in the manifest. Lean entries answer "does Champollion
 * know this language, and by what name" honestly — with empty strings, never
 * invented facts — and the full card remains fetchable through the CLI.
 */
async function indexFromFallbackFile(file, ctx) {
  const { normalizeCard } = ctx;
  const bundle = JSON.parse(await readFile(file, 'utf-8'));
  const index = [];
  const seen = new Set();

  for (const raw of Object.values(bundle.cards ?? {})) {
    const card = normalizeCard(raw);
    if (!(card.code || card.iso639_3 || card.bcp47) || !card.name) continue;
    // The bundle deliberately carries locale-variant cards (fra-CA,
    // cmn-Hant) for the CLI's resolution needs; a language index excludes
    // them by locale block AND by dashed code — some variant cards predate
    // the locale block.
    if (card.locale?.language) continue;
    const entry = entryFromCard(card, ctx);
    if (entry.code.includes('-')) continue;
    index.push(entry);
    seen.add(entry.code);
  }
  const parents = new Set(Object.keys(bundle.parents ?? {}));
  for (const [code, m] of Object.entries(bundle.manifest ?? {})) {
    if (seen.has(code) || parents.has(code)) continue;
    // Dashed codes are locale projections (fra-CA) — not languages. (This
    // also skips the x-* constructed-script variants; their base cards are
    // in the bundled core set.)
    if (code.includes('-')) continue;
    if (!m?.n) continue;
    index.push({
      code,
      name: m.n,
      endonym: '',
      family: '',
      speakers: '',
      script: '',
      region: '',
      typology: '',
      aliases: Array.isArray(m.a) ? m.a : [],
    });
  }
  return index;
}

/**
 * Load the language index. Resolution ladder in the module docstring; every
 * miss is recorded and a total miss THROWS with the full list — startup is
 * the right place to fail, because index.js awaits this before the MCP
 * handshake and a server that starts without languages would answer
 * "No languages found" as if it were a fact about the world.
 *
 * @param {object} [opts]  Test injection: `cardsDir` (strict, same semantics
 *   as CHAMPOLLION_CARDS_DIR), `fallbackFile`, `repoDir` (override the
 *   monorepo candidate).
 * @returns {Promise<object[]>}  Language index array
 */
export async function loadLanguageIndex(opts = {}) {
  const { reader, packageRoot, source } = await resolveAdapter();
  const { normalizeCard, display, isDisputed } = reader;
  const adapterCtx = { normalizeCard, display, isDisputed };
  const attempts = [];

  // Tier 1 — explicit override: obey it or fail, never fall past it.
  const explicit = opts.cardsDir ?? process.env.CHAMPOLLION_CARDS_DIR;
  if (explicit) {
    const label = opts.cardsDir ? 'cardsDir option' : 'CHAMPOLLION_CARDS_DIR';
    let index;
    try {
      index = await indexFromDir(explicit, adapterCtx);
    } catch (err) {
      throw new Error(
        `${label} points at ${explicit}, which is not a readable card `
        + `directory (${err.code ?? err.message}). The override names a `
        + 'specific corpus; silently reading a different one would be worse '
        + 'than failing.',
      );
    }
    if (index.length === 0) {
      throw new Error(
        `${label} points at ${explicit}, which contains no language cards — `
        + 'a broken corpus, not a missing one.',
      );
    }
    process.stderr.write(`Loaded ${index.length} language cards from ${explicit} (${label})\n`);
    return index;
  }

  // Tier 2 — the monorepo's full corpus.
  const repoDir = opts.repoDir ?? resolve(REPO_CLI, 'shared/language-cards');
  if (existsSync(repoDir)) {
    const index = await indexFromDir(repoDir, adapterCtx);
    if (index.length === 0) {
      throw new Error(
        `${repoDir} exists but contains no language cards — a broken corpus `
        + '(a half-applied cutover?), not a missing one. Rebuild the cards or '
        + 'set CHAMPOLLION_CARDS_DIR.',
      );
    }
    process.stderr.write(`Loaded ${index.length} language cards from ${repoDir}\n`);
    return index;
  }
  attempts.push(`${repoDir} (monorepo corpus — not present)`);

  // Tier 3 — the champollion package's bundled fallback.
  const fallbackFile = opts.fallbackFile
    ?? process.env.CHAMPOLLION_CARDS_FALLBACK
    ?? join(packageRoot, 'shared', 'cards-fallback.json');
  if (existsSync(fallbackFile)) {
    const index = await indexFromFallbackFile(fallbackFile, adapterCtx);
    if (index.length === 0) {
      throw new Error(
        `${fallbackFile} parsed but yielded no language entries — a broken `
        + 'bundle, not a missing one.',
      );
    }
    process.stderr.write(
      `Loaded ${index.length} languages from the bundled fallback ${fallbackFile}\n`,
    );
    return index;
  }
  attempts.push(`${fallbackFile} (bundled cards-fallback.json — not present)`);

  throw new Error(
    'No language-card source resolved — refusing to start with an empty or '
    + `hand-guessed language surface (adapter came from the ${source}). Tried:\n`
    + attempts.map((a) => `  - ${a}`).join('\n')
    + '\nFix: set CHAMPOLLION_CARDS_DIR to a language-cards directory, run '
    + 'inside the Champollion monorepo, or reinstall so the champollion '
    + "dependency's bundled cards ship intact.",
  );
}

/**
 * Search the language index for matches against a query string.
 *
 * Matches against: code, name, endonym, family, region.
 * Case-insensitive substring match, ranked: exact code match first, then
 * exact name/endonym, then name-prefix, then everything else in file order.
 *
 * @param {object[]} index   Language index from loadLanguageIndex()
 * @param {string}   query   Search term
 * @param {number}   limit   Max results
 * @returns {object[]}       Matching languages
 */
export function searchLanguages(index, query, limit = 10) {
  const q = query.toLowerCase();
  const tiers = [[], [], [], []];

  for (const lang of index) {
    const aliases = Array.isArray(lang.aliases) ? lang.aliases : [];
    const searchable = [
      lang.code, lang.name, lang.endonym, lang.family,
      lang.region, lang.typology, ...aliases,
    ].filter(Boolean).join(' ').toLowerCase();

    if (!searchable.includes(q)) continue;

    if (lang.code && lang.code.toLowerCase() === q) {
      tiers[0].push(lang);
    } else if (
      (lang.name && lang.name.toLowerCase() === q) ||
      (lang.endonym && lang.endonym.toLowerCase() === q) ||
      aliases.some((a) => a.toLowerCase() === q)
    ) {
      tiers[1].push(lang);
    } else if (lang.name && lang.name.toLowerCase().startsWith(q)) {
      tiers[2].push(lang);
    } else {
      tiers[3].push(lang);
    }

    // Enough candidates to fill the limit from the best tiers alone.
    if (tiers[0].length >= limit) break;
  }

  return tiers.flat().slice(0, limit);
}
