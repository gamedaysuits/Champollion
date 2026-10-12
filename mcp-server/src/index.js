/**
 * Champollion MCP Server — core implementation.
 *
 * Exposes Champollion to AI agents via the Model Context Protocol, built
 * around one north-star flow: "let's build a <language> model for our
 * school / clinic — how do we start?"
 *
 *   discover   search_languages, get_language, language_overview,
 *              list_corpora, get_results, get_run_card, get_metric_reliability
 *   protect    (guidance in language_overview — your data never leaves your
 *              machine unless you choose; steward local-only marks are obeyed);
 *              if a model may be trained: forge_register_eval, forge_leak_audit,
 *              forge_prereg_template, forge_prereg — BEFORE any benchmark
 *   baseline   run_benchmark (queue items OR any corpus, any model — including
 *              one on this machine), get_run_status, preview_publish (read-only),
 *              publish_report
 *   build      get_training_guardrails, forge_* (nmt-forge)
 *   prove      forge_export (score once + package), forge_evaluate,
 *              forge_compare, forge_prereg_verdict, list_contests, get_contest
 *   deploy     `nmt-forge serve <export>/model` (a terminal step), translate
 *   contribute list_queue, get_queue_item, estimate_cost, get_project_info
 *
 * The tool list is enumerated, and checked against README.md and
 * instructions.md, by test/server-surface.test.js — never hand-count it here.
 *
 * Resources: champollion://contributing-guide, champollion://queue-schema,
 * champollion://network-data. Prompts: start_language_project,
 * explore_language, contribute_compute, compete_for_prize.
 *
 * The server is stateless between tool calls apart from in-memory caches
 * (queue 5 min, corpus registry 5 min) and its on-disk state under
 * ~/.champollion-mcp (CHAMPOLLION_MCP_HOME): the benchmark job history, which
 * survives a server restart, and the translate tool's own Translation Memory.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  fetchQueueMeta, selectFromQueue, lookupQueueItem, estimateCost,
} from './tools/queue.js';
import {
  findLanguages, loadLanguageIndex, materializeLean, formatSearchAnswer,
} from './tools/languages.js';
import { languageAlias, resolveLanguageArg, argError } from './tools/args.js';
import { count } from './tools/plural.js';
import { runBenchmark, getRunStatus, RUN_PROVIDERS, languageNameFor } from './tools/harness.js';
import { previewReport, publishReport } from './tools/publish-report.js';
import { getLanguage, formatLanguage } from './tools/language-card.js';
import { languageOverview, formatOverview } from './tools/overview.js';
import { listContests, getContest, formatContestList, formatContest } from './tools/contests.js';
import { fetchResults, formatResults, fetchRunCard, formatRunCard } from './tools/results.js';
import { selectCorpora, formatCorpora, MAX_LIMIT as CORPORA_MAX_LIMIT } from './tools/corpora.js';
import { metricReliability, formatReliability, cardFamilyClaims } from './tools/reliability.js';
import { translateTexts, formatTranslateResult, translateResultIsError, TRANSLATE_METHODS } from './tools/translate.js';
import { trainingGuardrails, formatTrainingGuardrails } from './tools/training.js';
import {
  forgeTool, forgeToolsIn, FORGE_SCORING_TIMEOUT_MS, lintNextHint, lintSeverityCounts,
  compareSummary, compareNextHint, discoverCardCrossCheck, preflightNextHint,
  splitNearTwinSummary, splitNextHint, initNextHint, initializedStatusHint,
  statusNextHint, exportSummary, exportNextHint, registerEvalPathError,
  statusTools, statusExportCaveats, lintSummary,
} from './tools/forge.js';

/**
 * Read the agent behavioral guide from disk.
 *
 * @param {string} path  Absolute path to instructions.md.
 * @returns {Promise<string|null>}  Trimmed contents, or null if unreadable.
 */
async function loadInstructions(path) {
  try {
    const text = await readFile(path, 'utf-8');
    return text.trim() || null;
  } catch {
    return null;
  }
}

/**
 * Create and configure the MCP server with all tool registrations.
 *
 * @returns {{ start: () => Promise<void> }}  Server object with a start method.
 */
export async function createServer() {
  // Resolve paths relative to this file (for reading instructions.md,
  // CONTRIBUTING.md, etc.). Computed before server creation because the
  // server's `instructions` are loaded from disk at construction time.
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const repoRoot = resolve(__dirname, '..', '..');

  // Load the agent behavioral guide and hand it to the SDK as the server's
  // `instructions`. The SDK surfaces these in the MCP `initialize` result so
  // connecting clients can show the model server-level guidance. Falls back to
  // no instructions if the file is missing rather than failing startup.
  const instructions = await loadInstructions(resolve(__dirname, '..', 'instructions.md'));

  // Version from package.json — the SSOT — so the handshake can never claim
  // a stale release (0.1.1 shipped while the handshake still said 0.1.0).
  const { version } = JSON.parse(
    await readFile(resolve(__dirname, '..', 'package.json'), 'utf-8'),
  );

  const server = new McpServer(
    { name: 'champollion', version },
    instructions ? { instructions } : undefined,
  );

  // Pre-load language index (small, fast, stays in memory)
  const languageIndex = await loadLanguageIndex();
  const languageCount = languageIndex.length;

  // ==================================================================
  // Resources — read-only data agents can pull on demand
  //
  // Resources expose public information only. Nothing from docs/AGENTS.md
  // or other internal documents is exposed here.
  // ==================================================================

  // Resource: Contributing guide — how to help with the project
  server.resource(
    'contributing-guide',
    'champollion://contributing-guide',
    { description: 'How to contribute to Champollion — for language speakers, ML researchers, developers, and community organizations.' },
    async () => {
      try {
        const content = await readFile(resolve(repoRoot, 'CONTRIBUTING.md'), 'utf-8');
        return { contents: [{ uri: 'champollion://contributing-guide', mimeType: 'text/markdown', text: content }] };
      } catch {
        return { contents: [{ uri: 'champollion://contributing-guide', mimeType: 'text/plain', text: 'CONTRIBUTING.md not found. See https://champollion.dev/contribute for contribution guidelines.' }] };
      }
    }
  );

  // Resource: Queue item field schema — what each field in queue.json means
  server.resource(
    'queue-schema',
    'champollion://queue-schema',
    { description: 'Field definitions for queue.json items — explains every field an agent will encounter when reading the queue.' },
    async () => {
      const schemaDoc = [
        '# Queue Item Schema',
        '',
        'Each item in champollion.dev/queue.json represents an untested',
        '(language pair, model, condition) combination.',
        '',
        '## Item Fields',
        '',
        '| Field | Type | Description |',
        '|-------|------|-------------|',
        '| `id` | string | Unique identifier: `{pair_id}__{model_slug}__{condition}` |',
        '| `priority` | int | Rank in the queue (1 = highest ECV) |',
        '| `language_pair` | string | `{source}>{target}` ISO 639-3 codes |',
        '| `source_language` | string | Source language name |',
        '| `target_language` | string | Target language name |',
        '| `model` | string | Full OpenRouter model slug |',
        '| `condition` | string | `naive` (zero-shot) or `coached` (with coaching prompt) |',
        '| `est_cost_usd` | float\|null | Estimated API cost. null = unknown |',
        '| `corpus_id` | string | Which evaluation corpus to use |',
        '| `ecv_per_usd` | float | Expected Chain Value per dollar — the ranking metric |',
        '| `predicted_strength` | float | Predicted chrF++ / 100 for this run |',
        '| `exploration_bonus` | float | UCB bonus for under-tested combinations |',
        '| `pair_prior` | float | Baseline expected quality for this language pair |',
        '| `run_command` | string | The exact CLI command to execute this item |',
        '',
        '## Metadata Fields (top-level)',
        '',
        '| Field | Description |',
        '|-------|-------------|',
        '| `metadata.open_items` | Total number of open items |',
        '| `metadata.models` | List of model slugs in the queue |',
        '| `metadata.priority_model` | Prose description of the ranking algorithm |',
        '| `metadata.cost_basis` | How cost estimates were derived |',
        '| `metadata.how_to_run` | Setup and execution instructions |',
      ].join('\n');
      return { contents: [{ uri: 'champollion://queue-schema', mimeType: 'text/markdown', text: schemaDoc }] };
    }
  );

  // Resource: Network data endpoints — the FULL machine-readable picture.
  // The champollion.dev homepage map is an idealization; agents should
  // read these sources, not the picture (founder directive 2026-07-19).
  server.resource(
    'network-data',
    'champollion://network-data',
    { description: 'Every public machine-readable data source behind the Champollion network map — queue, mesh, registry, provider coverage, leaderboard REST, language cards. The map is an idealization; agents should read these.' },
    async () => {
      const doc = [
        '# Network Data Endpoints',
        '',
        'The champollion.dev homepage map is an IDEALIZATION of this data —',
        'read the sources, not the picture.',
        '',
        '| Source | URL | What it is |',
        '|--------|-----|------------|',
        '| Sweep queue | https://champollion.dev/queue.json | Full public benchmark queue (tens of MB): every open item + run command + cost estimate + license/transmission stamps + re-derivable ranking metadata. Cached ~5 min. |',
        '| Queue preview | https://champollion.dev/queue-preview.json | Small top-of-queue slice with the full metadata block — start here. |',
        '| Language mesh | https://champollion.dev/mesh.json | The measured/registered pair network: edges with status, best chrF++, run references. |',
        '| Corpus registry | https://champollion.dev/registry.json | Every registered eval corpus: license lane, attribution, checksum, fetch-from-source notes (~10 MB). |',
        '| Provider coverage | shared/catalogue/method-coverage.json (repo) | Each MT provider’s published language list, cited + as-of + `tier` (service vs open). The map’s green has two tiers by exact ISO-639-3 code: bright = a DEPLOYED service lists it (Google/Microsoft/DeepL/LibreTranslate); dim = only an OPEN research model lists it (NLLB/OPUS/M2M-100/MADLAD-400 — a model-card code, not a usable service). "Covered" is a published-list claim, never a quality claim. |',
        '| Scored runs (REST) | https://sjdomynysdljkbemupqa.supabase.co/rest/v1/run_cards | Public leaderboard as PostgREST, read-only via RLS (anon key sb_publishable_bV6CFNFnzxhQI0wlBx2J0A_5Vm5gFBp — publishable by design). Aggregates only; per-entry test sentences are license-gated and never exposed. Prefer the get_results / get_run_card tools. |',
        `| Language cards | cli/shared/language-cards/ (repo) + champollion.dev published card tables | ${languageCount.toLocaleString()} languages in this install's index, every value cited. Prefer search_languages / get_language. |`,
        '| Queue ranking spec | https://champollion.dev/docs/network/specifications/queue-construction | Normative spec: lanes + map-value survey ordering + ECV. |',
        '',
        'License note: most queued corpora are evaluation sets with',
        'do_not_train stamps — see each queue item’s license/transmission',
        'fields and the registry’s license lanes before any re-use.',
      ].join('\n');
      return { contents: [{ uri: 'champollion://network-data', mimeType: 'text/markdown', text: doc }] };
    }
  );

  // ==================================================================
  // Prompts — reusable conversation starters
  //
  // These give agents (and users) pre-built workflows they can invoke.
  // ==================================================================

  // Prompt: contribute_compute — "I want to help, what would $X buy?"
  server.prompt(
    'contribute_compute',
    'Start a conversation about contributing compute to Champollion benchmarks. '
    + 'Helps the user understand what their budget would fund and which languages '
    + 'benefit most.',
    {
      budget: z.string().optional()
        .describe('Budget in USD (e.g. "10" for $10). If omitted, the agent will ask.'),
      language: z.string().optional()
        .describe('Optional language preference (e.g. "Yoruba", "crk"). If omitted, shows highest-impact items.'),
    },
    async ({ budget, language }) => {
      const parts = ['I want to help with Champollion.'];
      if (budget) parts.push(`I have about $${budget} in API credits to contribute.`);
      if (language) parts.push(`I\'m especially interested in ${language}.`);
      parts.push(
        '',
        'Can you show me what benchmark runs my budget would fund? ',
        'Which languages need the most help right now?'
      );
      return {
        messages: [{
          role: 'user',
          content: { type: 'text', text: parts.join(' ') },
        }],
      };
    }
  );

  // Prompt: start_language_project — the north-star flow
  server.prompt(
    'start_language_project',
    'Start building translation for a language with a community — e.g. "a Cree '
    + 'model for our school" or "an Ayta phrasebook for the clinic". Walks '
    + 'discover → protect your data (and, if a model may be trained, register, screen and predict) → '
    + 'baseline → build → prove → deploy.',
    {
      language: z.string()
        .describe('The language, by name or code (e.g. "Plains Cree", "crk", "Ayta").'),
      purpose: z.string().optional()
        .describe('Who it is for and what it must do (e.g. "school curriculum", "hospital intake phrases").'),
    },
    async ({ language, purpose }) => ({
      messages: [{
        role: 'user',
        content: {
          type: 'text',
          text: [
            `We want to build machine translation for ${language}${purpose ? ` — for ${purpose}` : ''}. How do we get started?`,
            '',
            'Please: find the language (search_languages), show what exists for it (language_overview),',
            'tell us how to keep our own data private, how to measure a baseline before building',
            '(if we may train a model, write our predictions down before any baseline on our test set),',
            'and what building and proving a model would involve. Do not spend money or publish',
            'anything without asking us first.',
          ].join('\n'),
        },
      }],
    }),
  );

  // Prompt: explore_language — "Tell me about [language]"
  server.prompt(
    'explore_language',
    'Look up a language in the Champollion database — metadata, benchmarks, and queue status.',
    {
      language: z.string()
        .describe('Language name, ISO 639-3 code, or endonym (e.g. "Yoruba", "yor", "Èdè Yorùbá").'),
    },
    async ({ language }) => {
      return {
        messages: [{
          role: 'user',
          content: {
            type: 'text',
            text: `Tell me about ${language} in the Champollion project. `
              + 'What does the index know about it (with sources)? Which benchmarks, '
              + 'published results, methods and tools exist? (search_languages, then '
              + 'get_language and language_overview.)',
          },
        }],
      };
    }
  );

  // Prompt: compete_for_prize — "I want to build a competitive method"
  server.prompt(
    'compete_for_prize',
    'Start a conversation about competing in the Champollion Arena. '
    + 'The Arena supports sponsored prize pools — check the prize spec for current status. '
    + 'Also suggests contributing compute as an immediate way to help.',
    {
      language: z.string().optional()
        .describe('Target language to compete for (e.g. "Plains Cree", "crk"). If omitted, discusses the general framework.'),
    },
    async ({ language }) => {
      const lang = language || 'a low-resource language';
      return {
        messages: [{
          role: 'user',
          content: {
            type: 'text',
            text: [
              `I'm interested in building a competitive translation method for ${lang} in the Champollion Arena.`,
              '',
              'Can you help me understand:',
              '1. Are there any active prize pools or contests right now? Check the prize spec and list_contests.',
              '2. What does it take to build a strong method? (approaches, data, tools)',
              '3. How does the anti-gaming architecture work? (secret test sets, etc.)',
              '4. Even if there\'s no active prize, I might contribute compute or benchmark runs — what would that look like?',
            ].join(' '),
          },
        }],
      };
    }
  );

  server.tool(
    'list_queue',
    'List open benchmark items from the Champollion public queue. '
    + 'Items are ranked by expected chain value (ECV) — the expected '
    + 'improvement in translation mesh quality per dollar spent. '
    + 'Filter by language, model, budget, or condition.',
    {
      // All parameters are optional — calling with no args returns the top items
      budget: z.number().positive().optional()
        .describe('Maximum budget in USD. Only items fitting within this budget are returned.'),
      language: z.string().optional()
        .describe('Filter by target language name or ISO 639-3 code (e.g. "Yoruba" or "yor"). Case-insensitive partial match.'),
      source_language: z.string().optional()
        .describe('Filter by source language code (e.g. "eng", "fra"). Exact match on the source side of the pair.'),
      model: z.string().optional()
        .describe('Filter by model name or substring (e.g. "haiku", "gpt-5.5", "gemini"). Case-insensitive.'),
      condition: z.enum(['naive', 'coached']).optional()
        .describe('Filter by run condition. "naive" = zero-shot, "coached" = with coaching prompt.'),
      limit: z.number().int().min(1).max(100).default(20)
        .describe('Maximum number of items to return (default 20, max 100).'),
    },
    async ({ budget, language, source_language, model, condition, limit }) => {
      try {
        const sel = await selectFromQueue({
          budget, language, source_language, model, condition, limit,
        });
        const items = sel.selected;

        // Compute summary statistics for the filtered set
        const totalCost = items.reduce((s, it) => s + (it.est_cost_usd || 0), 0);
        const languages = [...new Set(items.map(it => it.target_language))];

        // Format each item as a concise line for the agent
        const lines = items.map(it =>
          `#${it.priority}  ${it.language_pair.replace('>', ' → ')}  `
          + `${it.target_language}  ${it.model.split('/').pop()}  `
          + `$${(it.est_cost_usd || 0).toFixed(4)}  `
          + `[${it.condition}]`
        );

        // Honest truncation: the DB path only pages as deep as the selection
        // needs (bounded); if the bound hit before `limit` matches were found,
        // say how far the search went instead of implying the queue ran dry.
        const depthNote = (!sel.complete && items.length < limit)
          ? `Searched the top ${sel.scannedRows.toLocaleString()} ranked items — deeper matches may exist. Narrow the filters, or raise CHAMPOLLION_QUEUE_MAX_PAGES to scan deeper.`
          : '';

        const summary = [
          `Found ${count(items.length, 'item')} (of ${sel.metadata.open_items} total open).`,
          `Estimated cost: $${totalCost.toFixed(2)}`,
          `Languages: ${languages.join(', ')}`,
          `Models in queue: ${sel.metadata.models.map(m => m.split('/').pop()).join(', ')}`,
          ...(depthNote ? [depthNote] : []),
          '',
          ...lines,
        ].join('\n');

        return { content: [{ type: 'text', text: summary }] };
      } catch (err) {
        return {
          content: [{ type: 'text', text: `Error fetching queue: ${err.message}` }],
          isError: true,
        };
      }
    }
  );

  // ------------------------------------------------------------------
  // Tool: get_queue_item
  // ------------------------------------------------------------------
  server.tool(
    'get_queue_item',
    'Get full details for a specific queue item by its ID or priority rank.',
    {
      id: z.string().optional()
        .describe('The queue item ID (e.g. "eng-zul-dev-v1__anthropic_claude-haiku-4.5__naive").'),
      priority: z.number().int().positive().optional()
        .describe('The priority rank number (1 = highest priority).'),
    },
    async ({ id, priority }) => {
      if (!id && !priority) {
        return {
          content: [{ type: 'text', text: 'Provide either id or priority to look up a queue item.' }],
          isError: true,
        };
      }
      try {
        // Single-item lookups go straight to the queue_items primary key (or
        // the mode+priority index) — never the ranked paging path.
        const { item, covered, truncatedNote } = await lookupQueueItem({ id, priority });
        if (!item) {
          const note = truncatedNote ? ` ${truncatedNote}` : '';
          return {
            content: [{ type: 'text', text: `No queue item found for ${id ? `id="${id}"` : `priority=${priority}`}.${note}` }],
            isError: true,
          };
        }
        const coveredNote = covered === true
          ? '\n\nNote: this item is already covered by a VERIFIED run — it is no longer an open work item and will not appear in list_queue.'
          : '';
        return {
          content: [{ type: 'text', text: JSON.stringify(item, null, 2) + coveredNote }],
        };
      } catch (err) {
        return {
          content: [{ type: 'text', text: `Error: ${err.message}` }],
          isError: true,
        };
      }
    }
  );

  // ------------------------------------------------------------------
  // Tool: estimate_cost
  // ------------------------------------------------------------------
  server.tool(
    'estimate_cost',
    'Estimate the cost and item count for a hypothetical queue run. '
    + 'Accepts the same filters as list_queue and returns how many items '
    + 'would be selected and total estimated cost.',
    {
      budget: z.number().positive().optional()
        .describe('Maximum budget in USD.'),
      language: z.string().optional()
        .describe('Filter by target language (name or code).'),
      source_language: z.string().optional()
        .describe('Filter by source language code.'),
      model: z.string().optional()
        .describe('Filter by model name.'),
      condition: z.enum(['naive', 'coached']).optional()
        .describe('Filter by condition.'),
    },
    async ({ budget, language, source_language, model, condition }) => {
      try {
        // Deepen the ranked prefix toward the estimate cap (500), then run
        // the same pure aggregation as before over what was scanned.
        const sel = await selectFromQueue({
          budget, language, source_language, model, condition, limit: 500,
        });
        const result = estimateCost(sel.scanned, {
          budget, language, source_language, model, condition,
        });
        const depthNote = (!sel.complete && !result.capped)
          ? `Scanned the top ${sel.scannedRows.toLocaleString()} ranked items — treat count/total as a lower bound; deeper matches may exist.`
          : '';
        return {
          content: [{
            type: 'text',
            text: [
              `Items selected: ${result.count}${result.capped ? '+ (capped at 500 — totals below cover the first 500 matches only)' : ''}`,
              `Estimated total cost: $${result.totalCost.toFixed(2)}`,
              `Cheapest item: $${result.cheapest.toFixed(4)}`,
              `Most expensive item: $${result.mostExpensive.toFixed(4)}`,
              `Languages covered: ${result.languages.join(', ')}`,
              budget ? `Budget remaining: $${(budget - result.totalCost).toFixed(2)}` : '',
              depthNote,
            ].filter(Boolean).join('\n'),
          }],
        };
      } catch (err) {
        return {
          content: [{ type: 'text', text: `Error: ${err.message}` }],
          isError: true,
        };
      }
    }
  );

  // ------------------------------------------------------------------
  // Tool: search_languages
  // ------------------------------------------------------------------
  server.tool(
    'search_languages',
    'Find a language\'s code by name, endonym, alternate name, ISO code, family '
    + 'or region — misspellings included: when nothing matches exactly it returns '
    + 'the closest names by edit distance ("Atya" → the Ayta languages; a query word may begin a longer word of the name: "North Sami" → Northern Sami, said on the line), and a query of several words is matched part by part ("Plains Cree nêhiyawêwin" → crk). Each '
    + 'result also says where the language is spoken (countries, Glottolog\'s '
    + 'point, macroarea) and its other names — only the facts its card cites, each with its source, so '
    + 'same-named languages can be told apart; a location the card cannot cite is not shown, '
    + 'and the line links the language\'s Glottolog record (by glottocode) instead. Cards filled in from '
    + 'champollion.dev\'s published tables (an npm install\'s name-only results) carry no per-field sources '
    + 'until the tables\' next upload, so their lines have that link, not a location. Use this first when the user names '
    + 'a language; then get_language / language_overview with the code.',
    {
      query: z.string().optional()
        .describe('Language name, endonym, ISO 639-3 code, family, or region. Case- and accent-insensitive; '
          + 'tolerates typos. Required unless `language` is given.'),
      language: languageAlias('query'),
      limit: z.number().int().min(1).max(50).default(10)
        .describe('Maximum results to return (default 10).'),
    },
    async ({ query: queryArg, language, limit }) => {
      const q = resolveLanguageArg({ query: queryArg, language }, 'query', 'search_languages');
      if (q.error) return argError(q.error);
      const query = q.value;
      // Guarded: a card-shape change once made this throw a raw TypeError at
      // the SDK. An agent's first stop must never take the call down.
      let found;
      try {
        found = findLanguages(languageIndex, query, limit);
      } catch (err) {
        return {
          content: [{
            type: 'text',
            text: `Language search failed for "${query}": ${err.message}. `
              + 'This is a server-side fault, not a bad query — the language index '
              + 'is loaded from card data and something in it did not have the '
              + 'shape the index expects.',
          }],
          isError: true,
        };
      }
      // Name-only results (an npm install's long tail) are filled in from
      // their published cards, bounded — so "Atya" answers with six Ayta
      // languages AND where each is spoken (cited), or a Glottolog link where
      // the row carries no per-field source — not six bare names. A failure
      // here leaves the names standing and says why on each line.
      let filled = {};
      if (found.match !== 'none') {
        try {
          filled = await materializeLean(found.results);
        } catch (err) {
          const why = `filling in its card failed: ${err.message}`;
          filled = { unresolved: new Map(found.results.filter((l) => l.lean).map((l) => [l.code, why])) };
        }
      }
      return { content: [{ type: 'text', text: formatSearchAnswer(found, query, filled) }] };
    }
  );

  // ------------------------------------------------------------------
  // Tool: get_language
  // ------------------------------------------------------------------
  server.tool(
    'get_language',
    'The full, CITED language card for one language: names and endonym, '
    + 'classification, speaker estimates (every source\'s claim, none elected), '
    + 'endangerment, scripts, resources (dictionaries, grammars, FSTs, corpora, '
    + 'keyboards) and which MT services/models list it. Resolved exactly as the '
    + 'champollion CLI resolves it (bundled card → per-user cache → published card '
    + 'tables). Absent fields are reported as absent, never filled in. Accepts a code '
    + '("crk", "fr") or an exact name; misspelled names return the closest matches.',
    {
      code: z.string().optional()
        .describe('ISO 639-3/639-1 code or exact language name (e.g. "crk", "Plains Cree", "abp"). '
          + 'Required unless `language` is given.'),
      language: languageAlias('code'),
      format: z.enum(['text', 'json']).default('text')
        .describe('"text" (default, agent-readable) or "json" (the structured summary).'),
    },
    async ({ code: codeArg, language, format }) => {
      const lang = resolveLanguageArg({ code: codeArg, language }, 'code', 'get_language');
      if (lang.error) return argError(lang.error);
      const code = lang.value;
      try {
        const r = await getLanguage(code, { index: languageIndex });
        if (format === 'json' && r.status === 'ok') {
          return { content: [{ type: 'text', text: JSON.stringify(r, null, 2) }] };
        }
        return {
          content: [{ type: 'text', text: formatLanguage(r) }],
          isError: r.status !== 'ok',
        };
      } catch (err) {
        return { content: [{ type: 'text', text: `Error resolving the language card: ${err.message}` }], isError: true };
      }
    }
  );

  // ------------------------------------------------------------------
  // Tool: language_overview
  // ------------------------------------------------------------------
  server.tool(
    'language_overview',
    'START HERE for "we want to build a model for <language> — how do we begin?". '
    + 'One honest page: what the index knows, which benchmarks exist, published '
    + 'results, which methods can run (and with what evidence), tooling (FSTs — and whether the '
    + 'installed harness can use each — dictionaries), licence/consent constraints, and numbered NEXT STEPS that each '
    + 'name the exact tool or command, in the guide\'s order — protect your data → (if a model may be '
    + 'trained) register the test set, screen the corpus and write the predictions → baseline → build → '
    + 'prove → deploy. Read-only; spends nothing.',
    {
      code: z.string().optional()
        .describe('ISO 639-3 code or exact language name of the language to build for (e.g. "crk"). '
          + 'Required unless `language` is given.'),
      language: languageAlias('code'),
      source: z.string().default('eng')
        .describe('Source language code for pair-specific evidence (default "eng").'),
    },
    async ({ code: codeArg, language, source }) => {
      const lang = resolveLanguageArg({ code: codeArg, language }, 'code', 'language_overview');
      if (lang.error) return argError(lang.error);
      const code = lang.value;
      try {
        const o = await languageOverview({ code, source }, { index: languageIndex });
        // a private-use code (qaa–qtz) is an answer, not an error
        return { content: [{ type: 'text', text: formatOverview(o) }],
          isError: !['ok', 'private-use'].includes(o.status) };
      } catch (err) {
        return { content: [{ type: 'text', text: `Error building the overview: ${err.message}` }], isError: true };
      }
    }
  );

  // ------------------------------------------------------------------
  // Tool: get_project_info
  // ------------------------------------------------------------------
  server.tool(
    'get_project_info',
    'Get an overview of the Champollion project: what it is, how '
    + 'contributions work, and current queue statistics.',
    {},
    async () => {
      try {
        // Stats only — metadata comes from the preview + one aggregate RPC;
        // this tool never needs a single ranked item.
        const { metadata: meta } = await fetchQueueMeta();
        return {
          content: [{
            type: 'text',
            text: [
              '# Champollion — Open Translation Benchmarks',
              '',
              'Champollion is open infrastructure for measuring — and building —',
              `machine translation for any language (${languageCount.toLocaleString()} languages in this`,
              'install\'s card index). The project maintains:',
              '',
              '- A public **benchmark queue** of untested (language pair, model, condition)',
              '  combinations ranked by expected improvement to the translation mesh',
              '- An **evaluation harness** (mt-eval) that runs standardized benchmarks',
              '  and publishes results to a public leaderboard',
              '- **Language cards** with cited metadata for every catalogued language',
              '- **nmt-forge**, a guarded training suite for building your own model',
              '',
              'Building for a specific language? Call language_overview with its code —',
              'it shows what exists and the exact next steps.',
              '',
              '## Contributing Compute',
              '',
              'The easiest way to help: donate some API tokens to run benchmarks',
              'from the public queue. Anyone with an API key can contribute:',
              '',
              '1. Install the harness: `pipx install mt-eval-harness`',
              '2. Set your API key: `export OPENROUTER_API_KEY=sk-or-...`',
              '3. Run from the queue: run_benchmark { budget: 5 } (or `mt-eval queue --budget 5`)',
              '   (runs top items up to $5 estimated cost)',
              '4. Publishing to the public leaderboard is opt-in: run_benchmark publishes',
              '   only with publish: true (the CLI `mt-eval queue` publishes unless --no-publish)',
              '',
              '## Prizes',
              '',
              'The Arena supports sponsored prize pools for translation breakthroughs.',
              'Prizes are evaluated against secret test corpora (developers never see',
              'the test data) with community validation by bilingual speakers.',
              '',
              'See the prize spec for current status and threshold conditions:',
              'https://champollion.dev/docs/network/specifications/prizes',
              '',
              '## Current Queue Stats',
              '',
              `- Open items: ${meta.open_items.toLocaleString()}${meta.open_items_basis === 'generation' ? ' (as of last queue generation)' : ''}`,
              `- Corpora: ${meta.corpora}`,
              `- Models: ${meta.models.map(m => m.split('/').pop()).join(', ')}`,
              `- Conditions: ${meta.conditions.join(', ')}`,
              `- Generated: ${meta.generated_at.slice(0, 10)}`,
              '',
              'Most items cost under $0.55 (median ~$0.09). A $5 budget typically',
              'funds 50-100 benchmark runs.',
              '',
              'Website: https://champollion.dev',
              'Leaderboard: https://champollion.dev/leaderboard',
              'Contribute: https://champollion.dev/contribute',
              'Prize framework: https://champollion.dev/docs/network/specifications/prizes',
              'Arena: https://champollion.dev/arena',
            ].join('\n'),
          }],
        };
      } catch (err) {
        return {
          content: [{ type: 'text', text: `Error: ${err.message}` }],
          isError: true,
        };
      }
    }
  );

  // ------------------------------------------------------------------
  // Tool: get_results
  // ------------------------------------------------------------------
  server.tool(
    'get_results',
    'Read scored benchmark results from the public Champollion leaderboard. '
    + 'This closes the loop after run_benchmark: see what you (or the '
    + 'community) scored. Returns ranked, scored runs — chrF++ with its 95% CI '
    + 'as the headline (scoring standard/1, as in WMT and FLORES-200), BLEU, '
    + 'spBLEU, TER and COMET beside it, diagnostics apart, no quality labels — '
    + 'with trust level and attribution, never raw test '
    + 'sentences. Filter by language pair or model. Each row carries a '
    + 'contamination score_lane: rows marked "relative-only" (HIGH/MEDIUM '
    + 'contamination, FLORES, or unknown grade) are valid ONLY for comparing '
    + 'methods on that same corpus — never co-rank them against absolute-quality '
    + 'rows as if the scores were comparable.',
    {
      source_language: z.string().optional()
        .describe('Source language ISO 639-3 code (e.g. "eng", "fra"). Matches the source side of the pair.'),
      target_language: z.string().optional()
        .describe('Target language ISO 639-3 code (e.g. "zul", "yor"). Matches the target side of the pair.'),
      model: z.string().optional()
        .describe('Model name or substring (e.g. "haiku", "gpt-5.5"). Case-insensitive.'),
      sort: z.enum(['chrf', 'bleu', 'ter', 'comet', 'cost', 'date', 'composite']).default('chrf')
        .describe('Sort metric (default chrf, the headline). Score metrics sort best-first; ter/cost '
          + 'lowest-first; date newest-first. composite = the retired legacy composite (old cards only; '
          + 'newer cards sort last) — kept for old calls, not a quality ranking.'),
      limit: z.number().int().min(1).max(100).default(20)
        .describe('Maximum number of results to return (default 20, max 100).'),
    },
    async ({ source_language, target_language, model, sort, limit }) => {
      try {
        const rows = await fetchResults({ source_language, target_language, model, sort, limit });
        return { content: [{ type: 'text', text: formatResults(rows, { sort }) }] };
      } catch (err) {
        return {
          content: [{ type: 'text', text: `Error fetching results: ${err.message}` }],
          isError: true,
        };
      }
    }
  );

  // ------------------------------------------------------------------
  // Tool: get_run_card
  // ------------------------------------------------------------------
  server.tool(
    'get_run_card',
    'Get the full run card for one leaderboard result by its run id — scores '
    + 'plus method/config/provenance metadata (the same card the public '
    + 'leaderboard shows on expand). No per-entry test sentences are returned.',
    {
      id: z.string()
        .describe('The run_card id (the `id` field from a get_results row).'),
    },
    async ({ id }) => {
      try {
        const card = await fetchRunCard(id);
        if (!card) {
          return {
            content: [{ type: 'text', text: `No run card found for id="${id}". Use get_results to list valid ids.` }],
            isError: true,
          };
        }
        const costNote = card.total_cost_usd == null
          ? '\n\nNote: total_cost_usd is null — the cost of this run is UNKNOWN (a local '
            + 'model, an MT engine, or an unpriced provider), not $0.'
          : '';
        return { content: [{ type: 'text', text: formatRunCard(card) + costNote }] };
      } catch (err) {
        return {
          content: [{ type: 'text', text: `Error fetching run card: ${err.message}` }],
          isError: true,
        };
      }
    }
  );

  // ------------------------------------------------------------------
  // Tool: list_corpora
  // ------------------------------------------------------------------
  server.tool(
    'list_corpora',
    'List the registered evaluation corpora (benchmarks) for a language pair '
    + 'or benchmark family — the metadata cards behind the queue: size, '
    + 'license, contamination grade, domain, and what the harness can DO with '
    + 'each one (fetch on demand from its pinned upstream / gated behind an '
    + 'access token / quarantined). Corpus content is never hosted or returned. '
    + 'Give at least one of source_language, target_language, family. '
    + 'Quarantined entries are hidden by default but always COUNTED, so an '
    + 'empty pair explains itself instead of looking unsupported.',
    {
      source_language: z.string().optional()
        .describe('Source language ISO 639-3 code (e.g. "eng").'),
      target_language: z.string().optional()
        .describe('Target language ISO 639-3 code (e.g. "yor", "crk").'),
      family: z.string().optional()
        .describe('Benchmark family (the registry\'s registry_source, e.g. "flores", "tatoeba", "wmt24pp", "in22", "smol").'),
      include_quarantined: z.boolean().default(false)
        .describe('Also list quarantined corpora (catalogued, never runnable) with their reasons.'),
      limit: z.number().int().min(1).max(CORPORA_MAX_LIMIT).default(20)
        .describe(`Maximum corpora to return (default 20, max ${CORPORA_MAX_LIMIT}).`),
    },
    async (args) => {
      try {
        const result = await selectCorpora(args);
        return { content: [{ type: 'text', text: formatCorpora(result) }] };
      } catch (err) {
        return {
          content: [{ type: 'text', text: `Error listing corpora: ${err.message}` }],
          isError: true,
        };
      }
    }
  );

  // ------------------------------------------------------------------
  // Tool: get_metric_reliability
  // ------------------------------------------------------------------
  server.tool(
    'get_metric_reliability',
    'Which automatic MT metric can you TRUST for a target language? Returns '
    + 'champollion-derived correlations between metrics (BLEU, spBLEU, chrF, '
    + 'chrF++, COMET, MetricX) and WMT Metrics-task human judgments '
    + '(DA/MQM/ESA, wmt19–wmt25), rolled up per target-language family. Use '
    + 'this BEFORE trusting a benchmark score: for some language families '
    + 'BLEU barely tracks human judgment (Inuktitut: r=0.16) while a learned '
    + 'metric works, and for others the learned metric is the one that fails. '
    + 'Honest by construction: languages no WMT campaign ever judged return '
    + 'an explicit UNMEASURED answer (with what IS covered), and family-level '
    + 'transfer carries a caveat. Research-lane evidence only (upstream data '
    + 'license pending review) — never cite it in commercial claims.',
    {
      target: z.string().optional()
        .describe('Target language as an ISO 639 code ("iu", "iku", "kk") or '
          + 'a language-family name ("Turkic", "Eskimo-Aleut"). This is the '
          + 'language being TRANSLATED INTO — metric reliability is about '
          + 'scoring output in that language. Required unless `language` is given.'),
      language: languageAlias('target'),
    },
    async ({ target: targetArg, language }) => {
      const lang = resolveLanguageArg({ target: targetArg, language }, 'target', 'get_metric_reliability');
      if (lang.error) return argError(lang.error);
      const target = lang.value;
      try {
        // A language WMT never judged is looked up by its card's family.
        const answer = await metricReliability(target, undefined, {
          familyClaims: (code) => cardFamilyClaims(code, { index: languageIndex }),
        });
        return {
          content: [{ type: 'text', text: formatReliability(answer) }],
          isError: answer.status === 'index-unavailable',
        };
      } catch (err) {
        return {
          content: [{ type: 'text', text: `Error reading metric reliability: ${err.message}` }],
          isError: true,
        };
      }
    }
  );

  // ------------------------------------------------------------------
  // Tool: translate
  // ------------------------------------------------------------------
  // STRICT schema: an argument this tool does not know is refused with its
  // name, never stripped. A synthetic user passed an `endpoint` here before
  // the tool had one; zod dropped it silently and the call ran on a different
  // local model than the one they had just deployed.
  server.registerTool(
    'translate',
    {
      description: 'Translate texts through the champollion pipeline — the tested, '
        + 'deterministic alternative to improvising your own translation prompt. '
        + 'You get: engine choice (LLM via OpenRouter, direct '
        + 'OpenAI/Anthropic/Gemini, DeepL, Google Translate, Microsoft, '
        + 'LibreTranslate; method "local" = an OpenAI-compatible server on this '
        + 'machine, no key — point it with base_url; method "api" = a champollion '
        + 'API endpoint — the model you deployed with `nmt-forge serve`), '
        + 'language-card register/formality conditioning, a '
        + 'persistent Translation Memory (repeated texts cost ZERO tokens), and a '
        + 'deterministic five-check quality gate, so a bad translation comes back '
        + 'as an explicit failure, never as silent garbage. The response names the '
        + 'engine that actually ran (with its model and endpoint where it has them) '
        + 'and the Translation Memory file used. Spends real API tokens only for texts the TM has '
        + 'not seen. Production translation — benchmark evidence and quality '
        + 'claims still come from run_benchmark/get_results.',
      inputSchema: z.object({
        texts: z.array(z.string()).min(1).max(50)
          .describe('Source texts to translate (max 50 per call; the TM makes repeated calls cheap).'),
        source_language: z.string()
          .describe('Source language: a code (e.g. "en") or a name (e.g. "English"). With project_dir it is '
            + 'matched to the project\'s own locale code, so a name hits the cache sync filled.'),
        target_language: z.string()
          .describe('Target language: a code (e.g. "fr", "crk", "zul") or a name (e.g. "French"). A name two '
            + 'languages share, or one matching two project locales, is refused with the choices.'),
        method: z.enum(TRANSLATE_METHODS).optional()
          .describe('Translation engine. Default: with project_dir, the method that project\'s '
            + 'config uses for this pair (as `champollion sync` resolves it); otherwise "llm" '
            + '(OpenRouter). "local" = an '
            + 'OpenAI-compatible server on this machine (Ollama unless base_url / LOCAL_API_BASE '
            + 'says otherwise; no key). "api" = a champollion API endpoint (needs endpoint). '
            + 'Other engines need their API key in the server environment.'),
        model: z.string().optional()
          .describe('Model for LLM engines, as an exact slug (e.g. "anthropic/claude-sonnet-5"; for "local", the name '
            + 'the server serves). Short aliases ("gemini-flash") and floating ids ("~…", "…-latest") are refused. '
            + 'Refused for machine-translation APIs, which have no model.'),
        base_url: z.string().optional()
          .describe('Method "local" (or "openai"): the OpenAI-compatible base URL to call — e.g. '
            + '"http://127.0.0.1:8378/v1", the /v1 URL `nmt-forge serve` prints. Overrides LOCAL_API_BASE.'),
        endpoint: z.string().optional()
          .describe('Method "api": the champollion API endpoint — e.g. "http://127.0.0.1:8378/translate" '
            + 'from `nmt-forge serve`. Bearer key from CHAMPOLLION_API_KEY; none needed for a loopback '
            + 'server started without a token.'),
        register: z.string().optional()
          .describe('Style/register instruction (e.g. "formal", "casual-tu", or free-text guidance). Defaults to the language card\'s register.'),
        project_dir: z.string().optional()
          .describe('Use this project\'s Translation Memory (<project_dir>/.champollion/tm.json, shared with '
            + '`champollion sync` there), its coaching/.env files, and its own pair for these languages '
            + '(method, model, register, script, and its "fallback" for texts the method cannot translate safely — as `champollion sync` resolves and runs it there; each text the fallback produced is marked), so '
            + 'strings sync already cached are free here and vice versa. Default: the '
            + 'server\'s own TM at ~/.champollion-mcp/.champollion/tm.json, separate from every project.'),
        context: z.union([z.string(), z.array(z.string().nullable())]).optional()
          .describe('gettext msgctxt: one context for every text, or an array with one per text (null for none). '
            + 'The cache is keyed with it exactly as `champollion sync` keys a catalog entry with that context, and the model is '
            + 'told it — so "Cancel" with context "button" hits the entry sync cached for msgctxt "button" in project_dir. '
            + 'Without it, a text the project has only with a context is translated without reading or writing the project\'s '
            + 'cache, and the answer says which context to pass.'),
        script: z.string().optional()
          .describe('Output writing system (ISO 15924) for a target with more than one real orthography — '
            + 'e.g. crk: "Latn" (Standard Roman Orthography) or "Cans" (Syllabics). Required for such a '
            + 'target unless the project_dir pair sets "script"; the tool refuses rather than pick one, '
            + 'exactly as `champollion sync` does.'),
        use_tm: z.boolean().default(true)
          .describe('Consult and populate the Translation Memory (default true — identical requests become free).'),
        validate: z.boolean().default(true)
          .describe('Run the deterministic quality gate on fresh translations (default true). A project pair\'s fallback always runs through the gate, as in `champollion sync`.'),
      }).strict(),
    },
    async ({
      texts, source_language, target_language, method, model, base_url, endpoint,
      register, project_dir, script, context, use_tm, validate,
    }) => {
      try {
        const result = await translateTexts({
          texts, source: source_language, target: target_language,
          method, model, register, baseUrl: base_url, endpoint, projectDir: project_dir, script, context,
          useTm: use_tm, validate,
        });
        return {
          content: [{ type: 'text', text: formatTranslateResult(result) }],
          // Every text failed (an unreachable engine, say) is an error, not
          // a successful answer of "0 of 2"; a partial result is a normal
          // answer that lists its failures.
          isError: translateResultIsError(result),
        };
      } catch (err) {
        return {
          content: [{ type: 'text', text: `Translation error: ${err.message}` }],
          isError: true,
        };
      }
    }
  );

  // ------------------------------------------------------------------
  // Tool: get_training_guardrails
  // ------------------------------------------------------------------
  server.tool(
    'get_training_guardrails',
    'How to TRAIN an NMT model without fooling yourself — call this BEFORE '
    + 'building a training pipeline, splitting a corpus, generating '
    + 'synthetic data, or reporting training results. Returns the guardrail '
    + 'rules Champollion extracted from real, measured failures (the '
    + '2026-07-12 Plains Cree mistake ledger): group-disjoint splits (never '
    + 'row-level random on drill-heavy corpora), the dev-fence (checkpoint '
    + 'selection must never see the test set), leak audits (exact + '
    + 'near-dupe, both sides), funnel accounting, single-orthography '
    + 'training, coverage vs cited grammar checklists, per-kind sampling '
    + 'caps, bootstrap CIs on every number, the eval-read ledger, and '
    + 'preregistration before test scoring. Each rule names the mistake it '
    + 'kills and the enforcing nmt-forge command (`python3 -m pip install nmt-forge`; the '
    + 'forge_* tools run them). Also the non-negotiables: datasets marked do_not_train '
    + 'or quarantined in the mt-eval registry NEVER enter training mixes, '
    + 'and test sets are REAL DATA ONLY (no synthetic rows).',
    {
      topic: z.string().optional()
        .describe('Optional filter: a guardrail id (split, dev-fence, '
          + 'leak-audit, funnel, conventions, coverage, strata, ci, ledger, '
          + 'prereg, synthesis, training) or a keyword. Omit for all.'),
    },
    async ({ topic }) => {
      try {
        const answer = trainingGuardrails(topic);
        return {
          content: [{ type: 'text', text: formatTrainingGuardrails(answer) }],
          isError: false,
        };
      } catch (err) {
        return {
          content: [{ type: 'text', text: `Error rendering guardrails: ${err.message}` }],
          isError: true,
        };
      }
    }
  );

  // ------------------------------------------------------------------
  // Tools: forge_* — drive nmt-forge one guarded step at a time.
  //
  // get_training_guardrails is the rulebook; these are the hands. The
  // canonical loop an agent follows: forge_status (where am I? THE next
  // command) → forge_preflight (will it refuse? every gate) → the suggested
  // command → repeat. Discovery/scaffolding: forge_discover, forge_init.
  // Data hygiene: forge_split, forge_leak_audit, forge_register_eval,
  // forge_prereg_template + forge_prereg. Results: forge_export (score the
  // test battery once + package the model), forge_evaluate (score only),
  // forge_compare (A/B, with each system's near-twin caveat),
  // forge_report/forge_lint (read the diagnosis). `nmt-forge run` (training)
  // and `nmt-forge serve` (a long-running HTTP server) are intentionally not
  // tools — forge_status returns their exact commands for a terminal.
  //
  // Every tool passes --json (nmt-forge ≥ 0.2.0) and returns
  // {result, summary?, next?}; a refusal comes back as a tool error with
  // forge's what/why/fix (src/tools/forge.js).
  // ------------------------------------------------------------------
  const forgeWs = z.string().optional()
    .describe('Workspace directory (default .forge inside project_dir, or '
      + 'CHAMPOLLION_FORGE_WORKSPACE). The project you are driving.');
  const forgeProject = z.string().optional()
    .describe('Project directory forge runs FROM — its own advice is '
      + '`cd <project> && nmt-forge …`: config.json\'s paths, the default '
      + '.forge workspace and relative path arguments resolve against it. Pass '
      + 'the `project` forge_init returned. Default: this server\'s working '
      + 'directory.');
  const forgeAt = (workspace, project_dir) => ({ workspace, projectDir: project_dir });
  // forge_split's near-twin advice and verdicts (splitNearTwinSummary /
  // splitNextHint) and the step order forge_init and forge_status relay
  // (initNextHint / initializedStatusHint) live in tools/forge.js.
  const FORGE_PREREG_ARG = 'The preregistration this run is judged against (an id from forge_status). '
    + 'Needed when several preregs bind the test set for this run (e.g. a full model and a '
    + 'twin-free model on one test set): forge refuses to guess. Without it: the only valid '
    + 'prereg, else the one this run\'s first test read was bound to, else the one pinned to '
    + 'its config hash.';
  // Round 9: this said to set LOCAL_API_BASE "in this server's environment",
  // while the translate tool takes the URL as an argument.
  const SERVE_IS_A_TERMINAL_STEP = '`nmt-forge serve <export dir>/model` is a long-running '
    + 'HTTP server — run it in a terminal (not a tool). It binds 127.0.0.1 and '
    + 'serves the champollion api method (POST /translate) and an '
    + 'OpenAI-compatible /v1. From the champollion CLI: the `api` method config in '
    + '<export dir>/model/DEPLOY.md, or `LOCAL_API_BASE=<the /v1 URL serve prints> '
    + 'champollion sync --method local`. From this server: the translate tool with '
    + 'method "local" and base_url set to that /v1 URL (or method "api" and endpoint set to '
    + 'its /translate URL) — no environment variable needed. Deploy only model/ — '
    + 'evaluation/ holds the test sentences.';

  server.tool(
    'forge_status',
    'WHERE AM I in an nmt-forge project, and WHAT DO I RUN NEXT? Call this '
    + 'FIRST and after every step (needs nmt-forge ≥ 0.2.0: `python3 -m pip install nmt-forge`). '
    + 'It reads the actual workspace (registered sets, preregistrations, runs, exports, ledger) '
    + 'and returns a state — initialized (split next), empty-workspace, missing-preregistration '
    + '(a registered test set has no predictions: write them BEFORE any run_benchmark on it), '
    + 'no-dev-set, ready-to-train, training (a run holds the lock: wait), ready-to-score, '
    + 'exported, choose-export (several exported models: the USER picks; advice.exports lists '
    + 'each with its scores and caveats), or serving (chosen model answering) '
    + '— THE single next command with exact args, ready items, '
    + 'blockers and warnings (a saturated dev set, a prereg written after scoring reads, a SEVERE '
    + 'leak-audit verdict and the two-model decision, a twin-free model not trained yet, the dev '
    + 'twin verdict); '
    + 'summary.runs lists EVERY run; summary.tools names the forge_* tool for each step of the '
    + 'command ("terminal:" for training and serving). Deterministic: same state → same advice.',
    { workspace: forgeWs, project_dir: forgeProject },
    async ({ workspace, project_dir }) => forgeTool(['status'], {
      ...forgeAt(workspace, project_dir),
      summarize: (r) => ({
        state: r?.advice?.state,
        // get_training_guardrails first in no-dev-set, where forge names it (Round 13)
        tools: statusTools(r),
        ...(Array.isArray(r?.advice?.exports) ? { exports: r.advice.exports.length } : {}),
        // mt-eval's caveats on each export's score, verbatim (Round 13)
        ...(statusExportCaveats(r) ? { export_caveats: statusExportCaveats(r) } : {}),
        // every trained run, not just the newest (Round 6 hospital persona)
        ...(Array.isArray(r?.snapshot?.runs) && r.snapshot.runs.length ? {
          runs: r.snapshot.runs.map((x) => ({
            run: x.run,
            checkpoint: x.selected_checkpoint ?? null,
            dev: x.dev_score ?? null,
            dev_saturated: x.dev_saturated === true,
            exported: (x.exports || []).map((e) => e.model_dir || e.dir),
          })),
        } : {}),
        ...(Array.isArray(r?.advice?.warnings) && r.advice.warnings.length
          ? { warnings: r.advice.warnings } : {}),
      }),
      nextHint: (r) => (r?.advice?.state === 'initialized'
        ? initializedStatusHint(r)
        : r?.advice?.state === 'choose-export'
        ? 'several exported models and no recorded choice: show the user result.advice.exports '
          + '(each with its score, its twin-free score and its caveat) — and beside each export\'s score its '
          + 'advice.exports[].score_caveats, mt-eval\'s caveats in its words (summary.export_caveats; a MAJOR '
          + 'one is never left out) — and ASK which one to deploy — '
          + 'never pick the newest for them. Only the user\'s answer records the choice: '
          + '`nmt-forge choose <model dir>` in a terminal (or `nmt-forge serve <model dir> --choose`). '
          + 'Serving a model to try it records it as SERVED, never as chosen, so this state stays open '
          + 'until then. ' + SERVE_IS_A_TERMINAL_STEP
        : r?.advice?.state === 'exported'
        ? (statusExportCaveats(r)?.major
          ? `First relay summary.export_caveats with the score of ${statusExportCaveats(r).major.join(', ')} — `
            + 'mt-eval qualifies it; never quote it without them. '
          : '')
          + SERVE_IS_A_TERMINAL_STEP
          + (Array.isArray(r?.advice?.exports)
            ? ' Other exports exist (result.advice.exports) — the one named is the user\'s recorded choice '
              + '(`nmt-forge choose`).'
            : '')
        : r?.advice?.state === 'missing-preregistration'
          // Round 9: the guide put baselines before the prereg, and forge
          // refuses a prereg written after any scoring read of the set
          ? 'write the predictions WITH the user now — forge_prereg_template, then forge_prereg — '
            + 'BEFORE any run_benchmark (or mt-eval run) on the registered test file: a benchmark is a '
            + 'scoring read, and forge refuses a preregistration written after one. One prereg per '
            + 'model the user plans to train (the leak-audit verdict says whether that is one or two: '
            + 'all data, and twin-free), named after it. allow_after_reads is ONLY for predictions that '
            + 'were truly written before those reads; forge then says so beside every verdict.'
        : r?.advice?.state === 'training'
          // nmt-forge holds <workspace>/run.lock while a run trains: the only
          // safe move is to wait. Never suggest `nmt-forge run` here.
          ? 'a training run is in progress — WAIT. Never start another run (forge refuses '
            + 'while the run lock is held, and two runs fight for the same CPU/GPU and memory). '
            + 'Call forge_status again once the training process has exited (wait on that '
            + 'process or its log rather than polling on a timer); it will then name the next '
            + 'step. Meanwhile you may write a missing preregistration (see result.advice.blockers).'
          // the step forge named, with only its own terminal steps (Round 12)
          : statusNextHint(r)),
    }),
  );

  server.tool(
    'forge_preflight',
    'WILL THIS COMMAND REFUSE? Every gate a forge command will hit, each with '
    + 'ok and the fix, so you stop trial-and-erroring through refusals one at a '
    + 'time. Targets: run, evaluate, export, serve, score, split, prereg, '
    + 'leak-audit. run/evaluate/export read the run config (`config`, default '
    + 'config.json in project_dir): it must parse, point at this workspace, name '
    + 'a registered dev set and existing data files, and the backend\'s extra '
    + 'must be installed; evaluate/export also check the battery, its '
    + 'preregistration and (sealed) that it is unspent; serve checks the serving '
    + 'extra and a recorded export. A failing gate is an ANSWER, not a tool '
    + 'error: summary.passed is false and summary.failing names the gates.',
    {
      target: z.enum(['run', 'evaluate', 'export', 'serve', 'score', 'split', 'prereg', 'leak-audit'])
        .describe('The command to preflight.'),
      config: z.string().optional()
        .describe('Run config for run/evaluate/export (default config.json in project_dir).'),
      workspace: forgeWs,
      project_dir: forgeProject,
    },
    async ({ target, config, workspace, project_dir }) => forgeTool(
      ['preflight', target, ...(config ? ['--config', config] : [])], {
        ...forgeAt(workspace, project_dir),
        okExitCodes: [0, 2],
        summarize: (gates) => (Array.isArray(gates) ? {
          passed: gates.every((g) => g.ok),
          failing: gates.filter((g) => !g.ok).map((g) => g.gate),
          // a warning passes but must be read first (Round 10)
          ...(gates.some((g) => g.ok && g.warning)
            ? { warnings: gates.filter((g) => g.ok && g.warning).map((g) => g.gate) } : {}),
        } : null),
        nextHint: (gates) => preflightNextHint(target, config, gates),
      }),
  );

  server.tool(
    'forge_discover',
    'What does a language HAVE, as forge sees it? Reads the language card and '
    + 'reports scripts, analyzers, dictionaries, corpora, eval datasets (with '
    + 'do_not_train/quarantine flags), LYSS referee plugins, metric trust and '
    + 'where the language sits on forge\'s asset ladder. Absence means UNKNOWN, '
    + 'never zero. Works from a plain pip install: forge finds the card in '
    + '`cards_dir`, $MT_EVAL_CARDS_DIR / $CHAMPOLLION_CARDS_DIR, a checkout or '
    + 'node_modules/champollion above project_dir, else the public card index '
    + '(cached; reused offline). Call this before forge_init.',
    {
      code: z.string().optional()
        .describe('ISO 639-3 code (e.g. crk, nav, arb). Required unless `language` is given.'),
      language: languageAlias('code'),
      cards_dir: z.string().optional()
        .describe('A directory of <code>.json cards (e.g. from `champollion network card <code> --json`).'),
      workspace: forgeWs,
      project_dir: forgeProject,
    },
    async ({ code: codeArg, language, cards_dir, workspace, project_dir }) => {
      const lang = resolveLanguageArg({ code: codeArg, language }, 'code', 'forge_discover');
      if (lang.error) return argError(lang.error);
      // The CLI's own card, through its adapter — what language_overview
      // lists — so a gap in forge's source is said, attributed (Round 10).
      let cli = null;
      if (!cards_dir) {
        try {
          const g = await getLanguage(lang.value);
          if (g?.status === 'ok') cli = g;
        } catch { /* no CLI card here: forge's answer stands alone */ }
      }
      return forgeTool(
        ['discover', lang.value, ...(cards_dir ? ['--cards-dir', cards_dir] : [])], {
          ...forgeAt(workspace, project_dir),
          summarize: (r) => {
            const x = discoverCardCrossCheck(r, cli);
            return x ? { card_sources_differ: x } : null;
          },
          nextHint: (r) => (discoverCardCrossCheck(r, cli)
            ? 'tell the user the two card sources differ (summary.card_sources_differ — each '
              + 'attributed, nothing invented); then scaffold with forge_init, then forge_status.'
            : 'scaffold the project with forge_init, then forge_status.'),
        });
    },
  );

  server.tool(
    'forge_init',
    'Scaffold a forge project from a language card: <dir>/.forge workspace + a '
    + 'starter config.json (the model preset expanded into explicit numbers, '
    + 'never hidden) + NEXT_STEPS.md. Run after forge_discover. model: cpu-tiny '
    + '(default — a ~6M-parameter model trained from scratch, minutes on a laptop '
    + 'CPU, no download, weak by design), cpu-finetune (fine-tune an opus-mt '
    + '`base` for a RELATED pair, CPU), nllb-600m (GPU). A language the card index '
    + 'does not have yet: no_card + name (every card fact is then unknown). '
    + 'Returns `project` — pass it as project_dir to every later forge_* call.',
    {
      code: z.string().optional()
        .describe('ISO 639-3 code of the TARGET language. Required unless `language` is given.'),
      language: languageAlias('code'),
      dir: z.string().optional()
        .describe('Project directory to create (default .; absolute recommended — a '
          + 'relative path resolves against this server\'s working directory).'),
      pair: z.string().optional()
        .describe('Language pair: eng-crk or eng>crk (both accepted; default eng-<code>). '
          + 'In a printed shell command quote the > form (\'eng>crk\'): an unquoted > is a redirect.'),
      model: z.string().optional()
        .describe('Model preset: cpu-tiny (default), cpu-finetune, nllb-600m. forge '
          + 'refuses an unknown preset and lists the valid ones.'),
      base: z.string().optional()
        .describe('Pretrained model for cpu-finetune (a Hugging Face id or local dir, '
          + 'e.g. an opus-mt model for a related pair); optional override for nllb-600m.'),
      no_card: z.boolean().optional()
        .describe('Scaffold a language the card index does not have yet (pass name too).'),
      name: z.string().optional().describe('The language\'s name (with no_card).'),
      cards_dir: z.string().optional()
        .describe('A directory of <code>.json cards (see forge_discover).'),
    },
    async ({ code: codeArg, language, dir, pair, model, base, no_card, name, cards_dir }) => {
      const lang = resolveLanguageArg({ code: codeArg, language }, 'code', 'forge_init');
      if (lang.error) return argError(lang.error);
      return forgeTool(
        ['init', lang.value, ...(dir ? ['--dir', dir] : []), ...(pair ? ['--pair', pair] : []),
          ...(model ? ['--model', model] : []), ...(base ? ['--base', base] : []),
          ...(no_card ? ['--no-card'] : []), ...(name ? ['--name', name] : []),
          ...(cards_dir ? ['--cards-dir', cards_dir] : [])],
        {
          nextHint: (r) => initNextHint(r, dir),
        });
    },
  );

  server.tool(
    'forge_split',
    'Carve a parallel corpus (.jsonl with source/target fields, or .tsv: '
    + 'source<TAB>target) into GROUP-DISJOINT train/dev/test — pairs sharing a '
    + 'canonical source OR target land on one side, so answer-sharing rows can '
    + 'never straddle the split (the split-guard). `register` also registers '
    + '<prefix>-dev / <prefix>-test in one step. test: 0 carves train/dev only — '
    + 'for a community that keeps its own test set as a separate file (register '
    + 'it with forge_register_eval role test); the fresh sides are then screened '
    + 'against registered test/sealed sets on the spot. Near-twins: when forge\'s advice '
    + 'recommends a near-duplicate carve (`--near-dupe 0.6`), pass near_dupe: 0.6 (with '
    + 'allow_rotate when re-splitting registered sets). When it refuses a split whose sides come '
    + 'out far larger than asked (SplitSizeRefused), take the route it names (--max-group → '
    + 'max_group). When the templates chain, dev_near_twin.verdict.final says no split gives a '
    + 'twin-free dev set: relay it once with its options — re-splitting will not change it.',
    {
      corpus: z.string().describe('Path to the parallel corpus (.jsonl or .tsv).'),
      test: z.number().int().nonnegative()
        .describe('Test rows to carve (0 when your test set is a separate, registered file).'),
      dev: z.number().int().nonnegative().optional()
        .describe('Dev rows to carve (checkpoint selection runs on these; training refuses without a dev set).'),
      seed: z.number().int().describe('Split seed (required, reproducible).'),
      out: z.string().optional()
        .describe('Output directory for the split files (default data/split — the path the '
          + 'config.json forge_init writes reads its train side from; another directory works, and '
          + 'forge then says which config.json lines to change).'),
      register: z.union([z.string(), z.boolean()]).optional()
        .describe('Also register the carved sides: a name prefix (string) registers <prefix>-dev / '
          + '<prefix>-test; true means "project" — project-dev / project-test, the names the '
          + 'config.json forge_init writes expects; false or omitted registers nothing.'),
      allow_rotate: z.boolean().optional()
        .describe('With register: replace <prefix>-dev / <prefix>-test when they are already '
          + 'registered with other content (e.g. re-splitting after forge_leak_audit clean_to). '
          + 'Ledgered with what it replaced and how often that content was read. Without it a '
          + 'conflicting split is refused before any file is written.'),
      near_dupe: z.number().gt(0).max(1).optional()
        .describe('Also keep NEAR-duplicates on one side (`--near-dupe`): a Jaccard threshold in '
          + '(0, 1] — rows whose source or target words overlap at ≥ this are grouped, so '
          + 'sentences built on one template never straddle train and test. 0.6 is the value '
          + 'forge\'s near-twin check uses; pass it when forge\'s advice recommends the carve '
          + '(on a corpus whose templates chain into one group, forge names other routes).'),
      max_group: z.number().int().min(2).optional()
        .describe('With near_dupe (`--max-group`): cap near-duplicate share-groups at this many '
          + 'rows, so templates on a small corpus cannot chain into one giant group. '
          + 'Exact-duplicate groups are never capped; near-duplicate links beyond the cap are '
          + 'left uncut and reported. Needs nmt-forge with --max-group (forge refuses the flag '
          + 'otherwise, by name).'),
      workspace: forgeWs,
      project_dir: forgeProject,
    },
    async ({ corpus, test, dev, seed, out = 'data/split', register: registerArg, allow_rotate,
      near_dupe, max_group, workspace, project_dir }) => {
      // Round 10 (researcher): `register: true` failed schema validation with
      // nothing in the instructions saying it is a prefix. true → "project".
      const register = registerArg === true ? 'project' : (registerArg || null);
      if (typeof register === 'string' && !/^[A-Za-z0-9][\w.-]*$/.test(register)) {
        return argError(`forge_split: register ${JSON.stringify(register)} is not a name prefix — use letters, `
          + 'digits, ".", "_" or "-" (e.g. "project"), or true for "project".');
      }
      // max_group caps NEAR-duplicate groups, which exist only with near_dupe:
      // alone it would be a flag forge accepts and nothing uses.
      if (max_group != null && near_dupe == null) {
        return argError('forge_split: max_group caps near-duplicate groups, which only exist with '
          + 'near_dupe — pass near_dupe too (e.g. near_dupe: 0.6, max_group: 50), or drop max_group.');
      }
      return forgeTool(
        ['split', corpus, '--test', String(test), '--seed', String(seed),
          '--out', out, ...(dev ? ['--dev', String(dev)] : []),
          ...(register ? ['--register', register] : []),
          ...(allow_rotate ? ['--allow-rotate'] : []),
          ...(near_dupe != null ? ['--near-dupe', String(near_dupe)] : []),
          ...(max_group != null ? ['--max-group', String(max_group)] : [])],
        { ...forgeAt(workspace, project_dir),
          summarize: (r) => {
            const sum = splitNearTwinSummary(r);
            const cc = r?.config_check;
            return cc && cc.ok === false ? { ...(sum || {}), config_check: cc } : sum;
          },
          nextHint: splitNextHint });
    },
  );

  server.tool(
    'forge_leak_audit',
    'Screen a corpus (.jsonl or .tsv) against every registered eval set BEFORE '
    + 'training. A row is a LEAK (dropped; refused with strict) when its target '
    + 'is an eval answer, contains one, is a fragment of one, or is ≥0.9 '
    + 'identical (diacritics folded). Template siblings (a pure word substitution: '
    + '"I see the dog" / "I see the cat") and source-only near-dupes are KEPT and '
    + 'reported, with the eval rows that have them. Deterministic and content-free (counts, '
    + 'row numbers — long lists as {count, first}; full_indices for all — never eval text). '
    + 'READ result.verdict FIRST: one sentence (e.g. every test row has a near-twin in '
    + 'training), the key numbers and the fix command. clean_to writes the survivors '
    + 'plus an audit manifest beside them, named with clean_to\'s extension replaced by '
    + '.audit.json (clean.jsonl → clean.audit.json). Audit BEFORE splitting; the twin-free '
    + 'audit (drop_test_twins, its own clean_to: corpus.notwins.jsonl) comes after the split.',
    {
      corpus: z.string().describe('Corpus to screen (.jsonl or .tsv).'),
      strict: z.boolean().optional().describe('Hard-fail on test/sealed hits.'),
      clean_to: z.string().optional()
        .describe('Write surviving rows here (plus an audit manifest next to it).'),
      drop_test_twins: z.boolean().optional()
        .describe('With clean_to: also drop training rows that are near-twins of the '
          + 'registered test/sealed rows — the fix when a FIXED test set\'s rows all have '
          + 'template twins in training (the score would measure recall, not translation). '
          + 'Also writes the twin-free model\'s config (config-notwins.json beside config.json, '
          + 'or companion_config) and names the command that trains it.'),
      companion_config: z.string().optional()
        .describe('With drop_test_twins (`--companion-config`): where to write the twin-free '
          + 'model\'s config — config.json with its own run_name and data.gold / '
          + 'eval.near_dupe_corpus set to clean_to. Default config-notwins.json beside config.json. '
          + 'An existing file is never overwritten.'),
      overwrite: z.boolean().optional()
        .describe('(`--overwrite`) Let clean_to replace a file that is in use — one a project config '
          + 'or a run trains on, the corpus a registered split was carved from, or another audit\'s '
          + 'output (the all-data clean corpus vs the twin-free one). Refused without it: give the '
          + 'twin-free corpus its own file (corpus.notwins.jsonl). Only when the user means to replace it.'),
      full_indices: z.boolean().optional()
        .describe('(`--full-indices`) Return every row-index list in full. By default each list longer '
          + 'than 5 comes back as {count, first}; result.indices.full_lists names the audit file that '
          + 'keeps them all.'),
      workspace: forgeWs,
      project_dir: forgeProject,
    },
    async ({ corpus, strict, clean_to, drop_test_twins, companion_config, overwrite, full_indices,
      workspace, project_dir }) => {
      if (companion_config && !drop_test_twins) {
        return argError('forge_leak_audit: companion_config names the twin-free model\'s config, '
          + 'which only drop_test_twins writes — pass drop_test_twins: true and clean_to, or drop '
          + 'companion_config.');
      }
      return forgeTool(
        ['leak-audit', corpus, ...(strict ? ['--strict'] : []),
          ...(clean_to ? ['--clean-to', clean_to] : []),
          ...(drop_test_twins ? ['--drop-test-twins'] : []),
          ...(companion_config ? ['--companion-config', companion_config] : []),
          ...(overwrite ? ['--overwrite'] : []),
          ...(full_indices ? ['--full-indices'] : [])],
        { ...forgeAt(workspace, project_dir),
          summarize: (r) => (r?.verdict ? {
            severity: r.verdict.severity, verdict: r.verdict.summary,
            ...(r.companion_config ? { companion_config: r.companion_config } : {}),
            ...(Array.isArray(r.preregistration_needed) && r.preregistration_needed.length
              ? { preregistration_needed: r.preregistration_needed } : {}),
          } : null),
          nextHint: (r) => {
            const prereg = Array.isArray(r?.preregistration_needed) && r.preregistration_needed.length
              ? ` Then write the predictions for ${r.preregistration_needed.join(', ')} with the user `
                + '(forge_prereg_template → forge_prereg; one per model) BEFORE any run_benchmark on '
                + 'the test file — this audit\'s reads never block a preregistration, a benchmark\'s do.'
              : '';
            const c = r?.companion_config;
            if (c && c.path) {
              return `relay result.verdict to the user. The twin-free model's config is ${c.path}`
                + (c.written ? ' (written now)' : '') + `: ${c.note}`
                + (c.next ? ` Train it in a terminal: ${c.next}.` : '') + prereg;
            }
            if (r?.verdict?.fix) {
              return `relay result.verdict to the user, then run its fix: ${r.verdict.fix}`
                + (r.verdict.decision ? ' — and show them result.verdict.decision before choosing a model.' : '')
                + prereg;
            }
            return 'train on the clean_to file if one was written (split it first if it is not split yet); '
              + `then forge_status.${prereg}`;
          } });
    },
  );

  server.tool(
    'forge_register_eval',
    'Register an eval file (.jsonl, or .tsv: source<TAB>target) in the '
    + 'workspace with a role: dev (fenced checkpoint selection), test '
    + '(prereg-gated scoring), or sealed (one-shot). Every downstream guard keys '
    + 'off these roles. Test sets must be REAL data (synthetic rows are refused).',
    {
      name: z.string().describe('Registry name for the set.'),
      path: z.string().describe('Path to the eval file (.jsonl or .tsv): absolute, or relative to '
        + 'project_dir — forge runs there, like every forge path (a file in a data/ folder beside the '
        + 'project folder is "../data/test.tsv"). A file not found there but found from this server\'s '
        + 'working directory is refused with the exact path to pass.'),
      role: z.enum(['dev', 'test', 'sealed']).describe('The set\'s role.'),
      source_field: z.string().optional().describe('Source field (default source; .jsonl only).'),
      target_field: z.string().optional().describe('Target/reference field (.jsonl only).'),
      allow_rotate: z.boolean().optional()
        .describe('Replace a set already registered under `name` with other content/role — '
          + 'ledgered with what it replaced and how often that content was read.'),
      workspace: forgeWs,
      project_dir: forgeProject,
    },
    async ({ name, path, role, source_field, target_field, allow_rotate, workspace, project_dir }) => {
      // Round 12: a path written from the agent's directory, read inside
      // project_dir — say the exact path to pass (forge names its own miss)
      const pathError = registerEvalPathError({ path, projectDir: project_dir });
      if (pathError) return argError(pathError);
      return forgeTool(
      ['registry', 'add', name, path, '--role', role,
        ...(source_field ? ['--source-field', source_field] : []),
        ...(target_field ? ['--target-field', target_field] : []),
        ...(allow_rotate ? ['--allow-rotate'] : [])],
      { ...forgeAt(workspace, project_dir),
        nextHint: role === 'dev'
          ? 'forge_status.'
          // Round 9: a benchmark before the prereg makes forge refuse it
          : 'the predictions come NEXT, before any run_benchmark (or mt-eval run) on this file: '
            + 'screen the training corpus first (forge_leak_audit — its reads are audit reads, never '
            + 'scoring ones; its verdict says one model or two), then forge_prereg_template → '
            + 'forge_prereg with the user, one per model. A benchmark is a scoring read, and forge '
            + 'refuses a preregistration written after one. Then forge_status.' });
    },
  );

  server.tool(
    'forge_prereg_template',
    'The ONE valid predictions-file format for forge_prereg, and a template to '
    + 'edit. With `out`, writes the template there (refuses to overwrite '
    + 'without force); without it, only returns the format and template. The '
    + 'template\'s REPLACE placeholders are refused by forge_prereg until they '
    + 'are replaced by real expectations — written with the user BEFORE any test '
    + 'score exists: a structured prediction (metric, direction, baseline_score, '
    + 'margin, rationale — auto-verdicted) or a free-text one (metric, expect, '
    + 'rationale — verdicted by a human).',
    {
      out: z.string().optional().describe('Write the template here (e.g. predictions.json).'),
      force: z.boolean().optional().describe('Overwrite an existing `out`.'),
      project_dir: forgeProject,
    },
    async ({ out, force, project_dir }) => forgeTool(
      ['prereg', 'template', ...(out ? ['--out', out] : []), ...(force ? ['--force'] : [])],
      { projectDir: project_dir,
        nextHint: (r) => `edit ${r?.path ? JSON.stringify(r.path) : 'a copy of result.template'}: `
          + 'replace every REPLACE placeholder with what you and the user expect, then '
          + 'forge_prereg { id, eval_set: <the test set>, predictions: <that file> }.' }),
  );

  server.tool(
    'forge_prereg',
    'Preregister falsifiable predictions for a test/sealed set BEFORE '
    + 'scoring it. Scoring a test set is refused without a prereg that '
    + 'predates the first scoring read — this is what makes a result honest '
    + 'rather than results-first storytelling. predictions: a .json file holding '
    + 'a JSON ARRAY of prediction objects (no Markdown, no wrapper object) — get '
    + 'a valid one to edit from forge_prereg_template; an invalid file is refused '
    + 'with the format and the fix.',
    {
      id: z.string().describe('Preregistration id.'),
      eval_set: z.string().describe('The registered test/sealed set name.'),
      predictions: z.string()
        .describe('Path to the predictions .json (a JSON array of prediction objects).'),
      author: z.string().optional(),
      config_hash: z.string().optional()
        .describe('Pin this prereg to ONE run (`--config-hash`): the full config hash of the run it '
          + 'predicts (a run manifest\'s config_hash). With two models on one test set, a pinned '
          + 'prereg judges only its run, so export needs no `prereg` argument. Any edit to the config '
          + 'changes its hash — unpinned, name the prereg after its model and pass `prereg` to '
          + 'forge_export instead.'),
      allow_after_reads: z.boolean().optional()
        .describe('ONLY for predictions that were truly written down BEFORE the set\'s scored reads '
          + '(e.g. on paper) — forge refuses a preregistration written after a scoring read (a '
          + 'benchmark included). The override is ledgered, and every report, export, DEPLOY.md '
          + 'and forge_status says the predictions came after N reads.'),
      workspace: forgeWs,
      project_dir: forgeProject,
    },
    async ({ id, eval_set, predictions, author, config_hash, allow_after_reads, workspace, project_dir }) => forgeTool(
      ['prereg', 'new', id, '--eval-set', eval_set, '--predictions', predictions,
        ...(author ? ['--author', author] : []),
        ...(config_hash ? ['--config-hash', config_hash] : []),
        ...(allow_after_reads ? ['--allow-after-reads'] : [])],
      { ...forgeAt(workspace, project_dir),
        summarize: (r) => {
          const sum = {
            ...(r?.after_reads ? { after_reads: r.after_reads.text } : {}),
            // Round 10: which model this prediction judges, said when it
            // is written — not after training
            ...(r?.export_with ? { export_with: r.export_with } : {}),
            ...(Array.isArray(r?.binding_preregs) && r.binding_preregs.length > 1
              ? { binding_preregs: r.binding_preregs } : {}),
          };
          return Object.keys(sum).length ? sum : null;
        },
        nextHint: (r) => {
          const model = r?.model_note ? `${r.model_note}. ` : '';
          return r?.after_reads
            ? `recorded under the override: ${r.after_reads.text}. Tell the user — every verdict on it `
              + `will say so. ${model}Then forge_status.`
            : `${model}One preregistration per planned model (all data, and twin-free after a SEVERE `
              + 'leak-audit), each before any benchmark. Then forge_status — next is the baselines '
              + '(run_benchmark on the test file) once every planned model has its prediction, or the '
              + 'split / training.';
        } }),
  );

  server.tool(
    'forge_prereg_verdict',
    'Record a PERSON\'s verdict on a preregistered prediction forge cannot verdict itself (a '
    + 'free-text "expect", or a structured one without baseline_score) — once the test score '
    + 'exists (forge_export judged against that prereg). Ledgered with who (by), when and a note; '
    + '`nmt-forge prereg check`, forge_report, forge_status and DEPLOY.md show it as a HUMAN '
    + 'verdict, never as a computed one. The verdict is the USER\'s: show them the prediction and '
    + 'the observed score (forge_export\'s prereg lines), ask held or missed, and record exactly '
    + 'what they decide — never judge it yourself. Refused for a computed prediction, before any '
    + 'scored result, and (without revise) when one is already recorded.',
    {
      id: z.string().describe('Preregistration id.'),
      prediction: z.union([z.number().int().positive(), z.string()])
        .describe('The prediction\'s number as the prereg verdict lines print it (#1 → 1), or its own "id".'),
      verdict: z.enum(['held', 'missed']).describe('What the USER decided.'),
      by: z.string().min(1).describe('Who judged — the person\'s name or role (recorded).'),
      note: z.string().optional().describe('Why (e.g. "predicted 15-60, observed 100.00").'),
      revise: z.boolean().optional()
        .describe('Replace an earlier verdict on this prediction (both stay in the ledger).'),
      workspace: forgeWs,
      project_dir: forgeProject,
    },
    async ({ id, prediction, verdict, by, note, revise, workspace, project_dir }) => forgeTool(
      ['prereg', 'verdict', id, '--prediction', String(prediction),
        verdict === 'held' ? '--held' : '--missed', '--by', by,
        ...(note ? ['--note', note] : []), ...(revise ? ['--revise'] : [])],
      { ...forgeAt(workspace, project_dir),
        summarize: (r) => (r?.verdict ? {
          prediction: r.prediction, verdict: r.verdict, by: r.by, deploy_updated: r.deploy_updated,
        } : null),
        nextHint: 'tell the user the verdict is recorded as theirs (who, when, note) — DEPLOY.md and '
          + 'forge_report now show it as a human verdict; `nmt-forge prereg check <id>` lists every '
          + 'prediction with its verdict.' }),
  );

  server.tool(
    'forge_evaluate',
    'SCORE ONLY, after a training run: decode the config\'s battery with the '
    + 'run\'s SELECTED checkpoint, score it (CIs, prereg-gated, ledgered) and '
    + 'diagnose. The score-only half of forge_export — prefer forge_export, which '
    + 'scores AND packages; a sealed battery is one-shot, so scoring it here '
    + 'spends it and forge_export then needs no_eval. Call it on the '
    + 'run-manifest.json that `nmt-forge run` wrote. harness_out also writes an '
    + 'mt-eval RunLog + TestReport (they contain the eval set\'s text). Bounded '
    + 'at 10 minutes; past that it names the terminal command.',
    {
      run_manifest: z.string().describe('Path to run-manifest.json.'),
      config: z.string().optional()
        .describe('Config path (defaults to the config embedded in the '
          + 'manifest); must carry an eval block.'),
      out_hyps: z.string().optional().describe('Where to write decoded hyps.'),
      harness_out: z.string().optional()
        .describe('Also write an mt-eval RunLog + TestReport into this directory.'),
      glossary: z.string().optional()
        .describe('Evaluation glossary (JSON) for the terminology score — scoring only.'),
      prereg: z.string().optional()
        .describe(FORGE_PREREG_ARG),
      workspace: forgeWs,
      project_dir: forgeProject,
    },
    async ({ run_manifest, config, out_hyps, harness_out, glossary, prereg, workspace, project_dir }) => forgeTool(
      ['evaluate', run_manifest, ...(config ? ['--config', config] : []),
        ...(out_hyps ? ['--out-hyps', out_hyps] : []),
        ...(harness_out ? ['--harness-out', harness_out] : []),
        ...(glossary ? ['--glossary', glossary] : []),
        ...(prereg ? ['--prereg', prereg] : [])],
      { ...forgeAt(workspace, project_dir),
        timeout: FORGE_SCORING_TIMEOUT_MS,
        nextHint: 'read result.battery (per-group scores with CIs); forge_report on '
          + 'result.paths.manifest renders the Diagnosis, forge_lint on it names the '
          + 'lever to pull next.' }),
  );

  server.tool(
    'forge_export',
    'PROVE AND PACKAGE a trained run in one step: decode the test battery with '
    + 'the dev-selected checkpoint and score it ONCE (prereg-gated, ledgered, '
    + 'CIs), write an mt-eval RunLog + TestReport, and package a self-contained '
    + 'model (no optimizer state, tokenizer included), forge-model.json, a '
    + 'champollion method.json and DEPLOY.md into `out`/model (the only folder to '
    + 'deploy — no test sentence) and the evaluation into `out`/evaluation (never '
    + 'copied with the model). All-or-nothing: a failed '
    + 'export leaves no half-written directory. A sealed set is one-shot — '
    + 'evaluating it here spends it; no_eval packages without scoring. Bounded '
    + 'at 10 minutes. Then serve it: `nmt-forge serve <out>/model` in a TERMINAL (a '
    + 'long-running HTTP server, not a tool), and use it from the champollion '
    + 'CLI or translate.',
    {
      run_manifest: z.string().describe('Path to the run-manifest.json `nmt-forge run` wrote.'),
      out: z.string().describe('Export directory (new or empty).'),
      config: z.string().optional()
        .describe('Run config (defaults to the config embedded in the manifest).'),
      no_eval: z.boolean().optional()
        .describe('Package without scoring the test battery (e.g. a sealed set already spent).'),
      no_model: z.boolean().optional()
        .describe('Write the evaluation + mt-eval report only (no model to serve).'),
      glossary: z.string().optional()
        .describe('Evaluation glossary (JSON {"term": "translation"}) for the terminology '
          + 'score — scoring only, the model never sees it.'),
      endpoint: z.string().optional()
        .describe('URL the champollion method.json points at (default http://127.0.0.1:<port>/translate).'),
      port: z.number().int().positive().optional().describe('Serve port recorded in the export (default 8378).'),
      name: z.string().optional().describe('Plugin/model name, kebab-case (default nmt-forge-<run>).'),
      force: z.boolean().optional().describe('Replace a non-empty `out` directory.'),
      prereg: z.string().optional()
        .describe(FORGE_PREREG_ARG),
      workspace: forgeWs,
      project_dir: forgeProject,
    },
    async ({ run_manifest, out, config, no_eval, no_model, glossary, endpoint, port, name, force,
      prereg, workspace, project_dir }) => forgeTool(
      ['export', run_manifest, '--out', out, ...(config ? ['--config', config] : []),
        ...(no_eval ? ['--no-eval'] : []), ...(no_model ? ['--no-model'] : []),
        ...(glossary ? ['--glossary', glossary] : []),
        ...(endpoint ? ['--endpoint', endpoint] : []), ...(port ? ['--port', String(port)] : []),
        ...(name ? ['--name', name] : []), ...(force ? ['--force'] : []),
        ...(prereg ? ['--prereg', prereg] : [])],
      { ...forgeAt(workspace, project_dir),
        timeout: FORGE_SCORING_TIMEOUT_MS,
        // a summary like every forge tool's (Round 12: it was null here)
        summarize: exportSummary,
        nextHint: (r) => exportNextHint(r, SERVE_IS_A_TERMINAL_STEP) }),
  );

  server.tool(
    'forge_lint',
    'Diagnose a BATTERY manifest (a scored test read): which registers are weak, the '
    + 'likeliest cause given the co-occurring signals, and the exact LEVER to pull next '
    + '(VOCABULARY / STRUCTURE / ORTHOGRAPHY / REAL-DATA / MEASUREMENT / '
    + 'REFEREE). Returns rule-id\'d findings with evidence — recommendations '
    + 'are explainable, not vibes; every caveat mt-eval wrote on the score is an '
    + 'R9 finding beside the headline (corpus chrF++ with its 95% CI). `manifest` is '
    + 'the battery manifest: an export\'s is `<export>/evaluation/battery-hyps-battery.json`, '
    + 'forge_evaluate\'s is result.paths.manifest. A run-manifest.json passed as `manifest` '
    + 'lints the battery of every scored export of that run, and is refused with the exact '
    + '`nmt-forge export` command when the run has none. `run_manifest` is optional and only '
    + 'adds the transfer-plateau signal.',
    {
      manifest: z.string().describe('Battery manifest JSON path '
        + '(<export>/evaluation/battery-hyps-battery.json); a run-manifest.json lints its '
        + 'scored exports.'),
      run_manifest: z.string().optional()
        .describe('Run manifest for schedule/transfer-plateau signals (optional).'),
      workspace: forgeWs,
      project_dir: forgeProject,
    },
    async ({ manifest, run_manifest, workspace, project_dir }) => forgeTool(
      ['lint', manifest, ...(run_manifest ? ['--run-manifest', run_manifest] : [])],
      { ...forgeAt(workspace, project_dir),
        // R9-harness-score-caveat (mt-eval's caveat on the scores) relayed in its words (Round 13)
        summarize: lintSummary,
        nextHint: lintNextHint }),
  );

  server.tool(
    'forge_report',
    'Re-render the plain-language report (with the Diagnosis section) from a '
    + 'run manifest or a battery manifest. Read-only pretty-printer for a '
    + 'result you already produced: result.markdown is the report. For a run manifest it '
    + 'includes a saturated-dev warning and, once the run is exported, its TEST result: score '
    + 'and CI, the twin-free strict subset, the near-twin caveat, the twin-free model to quote, '
    + 'and the prereg verdicts (computed and human apart).',
    {
      manifest: z.string().describe('Run or battery manifest path.'),
      workspace: forgeWs,
      project_dir: forgeProject,
    },
    async ({ manifest, workspace, project_dir }) => forgeTool(['report', manifest],
      forgeAt(workspace, project_dir)),
  );

  server.tool(
    'forge_compare',
    'A/B two systems\' hypotheses on a registered eval set (`nmt-forge compare`): paired '
    + 'approximate randomization per metric — Δ with its CI, p, and the winner only when '
    + 'significant. Prereg-gated and ledgered like every test read (a sealed set is spent by '
    + 'it). result.caveats travel WITH the result: for each system, how many test rows have a '
    + 'near-twin in its training data (from run_a / run_b — that model\'s run manifest — or the '
    + 'export whose evaluation wrote the hypotheses). A winner whose rows are mostly twinned won '
    + 'on recall of training phrases, not translation, and the caveats say so — relay them with '
    + 'the winner, never the winner alone. Hypotheses: a .jsonl with a uniform "predicted" (or '
    + '"hypothesis") field — e.g. <export>/evaluation/battery-hyps.jsonl — or plain text, one '
    + 'line per test row. Bounded at 10 minutes.',
    {
      eval_set: z.string().describe('The registered eval set both systems were decoded on.'),
      hyps_a: z.string().describe('System A\'s hypotheses (one per test row, in the set\'s order).'),
      hyps_b: z.string().describe('System B\'s hypotheses.'),
      label_a: z.string().optional().describe('Name for system A in the result (default "A").'),
      label_b: z.string().optional().describe('Name for system B (default "B").'),
      run_a: z.string().optional()
        .describe('System A\'s run-manifest.json: its training files are checked for near-twins of '
          + 'the eval set (the measure export reports). Not needed for hypotheses an export wrote.'),
      run_b: z.string().optional().describe('System B\'s run-manifest.json (see run_a).'),
      metric: z.array(z.string()).optional()
        .describe('Lanes to compare (default ["chrf++"]): chrf++, bleu, exact_match, comet, '
          + 'comet-qe, metricx.'),
      target_lang: z.string().optional()
        .describe('ISO 639-3 target code — picks the neural metric model and its low-resource warning.'),
      config_hash: z.string().optional()
        .describe('The run config hash the read is recorded under (prereg binding).'),
      prereg: z.string().optional().describe(FORGE_PREREG_ARG),
      override_respend: z.string().optional()
        .describe('Re-spend a SEALED set that was already scored, with the reason (ledgered and '
          + 'visible forever). The USER\'s decision, never yours — a sealed set answers one '
          + 'question once.'),
      workspace: forgeWs,
      project_dir: forgeProject,
    },
    async ({ eval_set, hyps_a, hyps_b, label_a, label_b, run_a, run_b, metric, target_lang,
      config_hash, prereg, override_respend, workspace, project_dir }) => forgeTool(
      ['compare', '--eval-set', eval_set, '--hyps-a', hyps_a, '--hyps-b', hyps_b,
        ...(label_a ? ['--label-a', label_a] : []), ...(label_b ? ['--label-b', label_b] : []),
        ...(run_a ? ['--run-a', run_a] : []), ...(run_b ? ['--run-b', run_b] : []),
        ...(metric || []).flatMap((m) => ['--metric', m]),
        ...(target_lang ? ['--target-lang', target_lang] : []),
        ...(config_hash ? ['--config-hash', config_hash] : []),
        ...(prereg ? ['--prereg', prereg] : []),
        ...(override_respend ? ['--override-respend', override_respend] : [])],
      { ...forgeAt(workspace, project_dir),
        timeout: FORGE_SCORING_TIMEOUT_MS,
        summarize: compareSummary,
        nextHint: compareNextHint }),
  );

  // ------------------------------------------------------------------
  // Tools: list_contests / get_contest — READ-ONLY. Entering a contest is a
  // human-authorized CLI flow (sovereign hosting); there is deliberately no
  // MCP tool that enters, submits, or ranks.
  // ------------------------------------------------------------------
  server.tool(
    'list_contests',
    'List Champollion contests (and shared-task editions) visible to an anonymous '
    + 'reader — status, language pair, lane, ranking metric, whether results are '
    + 'hidden until close. Read-only. Entering a contest is a human-authorized CLI '
    + 'flow (`mt-eval contest qualify` → submit-model/submit-method), never a tool.',
    {
      status: z.enum(['open', 'closed', 'archived', 'all']).default('all')
        .describe('Filter by status (default all).'),
      language: z.string().optional()
        .describe('ISO 639-3 code on either side of the contest\'s pair (e.g. "crk").'),
      limit: z.number().int().min(1).max(100).default(20)
        .describe('Maximum contests to list (default 20).'),
    },
    async ({ status, language, limit }) => {
      try {
        const r = await listContests({ status, language, limit });
        return { content: [{ type: 'text', text: formatContestList(r) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: `Could not list contests: ${err.message}` }], isError: true };
      }
    }
  );

  server.tool(
    'get_contest',
    'One contest in full: phases (with the active window), the DECLARED TERMS the '
    + 'organizer promised (frozen once entries exist) with a digest to detect '
    + 'changes, results visibility, and the public ranking when one is visible — the '
    + 'frozen final ranking after close, or interim published scores when results '
    + 'are immediate. Says plainly what an anonymous reader cannot see. Read-only.',
    {
      id: z.string().describe('Contest id (slug) from list_contests.'),
    },
    async ({ id }) => {
      try {
        const r = await getContest(id);
        return { content: [{ type: 'text', text: formatContest(r) }], isError: r.status !== 'ok' };
      } catch (err) {
        return { content: [{ type: 'text', text: `Could not read contest "${id}": ${err.message}` }], isError: true };
      }
    }
  );

  // ------------------------------------------------------------------
  // Tool: run_benchmark
  // ------------------------------------------------------------------
  // STRICT schema, like translate: an unknown argument (an `endpoint`, an
  // `output_dir`, a misspelled flag) is refused by name — never stripped
  // while the run goes somewhere the agent did not ask for.
  server.registerTool(
    'run_benchmark',
    {
      description: 'Run a benchmark with the mt-eval harness on this machine. One mode: '
        + 'budget/top = top queue items; item_id = one queue item; corpus = ANY corpus (a '
        + 'list_corpora id, or the user\'s own test file) on any model, including '
        + 'one here (provider "local"; method "local-model" + a Hugging Face id, in-process, no '
        + 'attestation) or a plugin directory (method_dir). An MT engine or a '
        + 'plugin is local only on the USER\'s attest_local_transport. Without confirm:true (or '
        + 'with dry_run) it returns the plan — the licence and do_not_train terms the run accepts, '
        + 'the EVAL PACK status (a missing FST never stops it; other missing pieces do), the '
        + 'metrics and where results land — and runs nothing; CONFIRM WITH THE USER FIRST (remote providers '
        + 'spend real tokens). NOTHING IS PUBLISHED unless publish:true: the plan lists what goes '
        + 'public; a real publish needs publish_ack in its exact words (a finished report: '
        + 'preview_publish, then publish_report). A confirmed run returns a JOB ID — poll '
        + 'get_run_status. Refusals (local-only marks, licences) come back as REFUSED '
        + 'with what is allowed: relay them, never route around them.',
      inputSchema: z.object({
        budget: z.number().positive().optional()
          .describe('Queue mode: run the top queue items up to this USD budget.'),
        top: z.number().int().positive().optional()
          .describe('Queue mode: run the top N queue items.'),
        item_id: z.string().optional()
          .describe('Item mode: run one queue item by id.'),
        corpus: z.string().optional()
          .describe('Corpus mode: a registry corpus id (see list_corpora) or the path to a '
            + '.json/.jsonl/.tsv test file the user holds (fields "source"/"reference" by default).'),
        model: z.string().optional()
          .describe('Corpus mode: the model — an OpenRouter slug ("openai/gpt-5.5"), a '
            + 'direct-provider name, a local server\'s model ("llama3.1", "qwen2.5:7b"), '
            + 'with method "local-model" a Hugging Face id or local model directory, or with '
            + 'method_dir the model the PLUGIN loads, in its own naming (passed as -m; recorded on '
            + 'the run card). Required for provider "local" and for method "local-model" (it has no '
            + 'default model: the harness refuses a run without one). Exact slugs only: a short alias '
            + '("gemini-pro") or a floating id ("~…", "…-latest") is refused.'),
        method: z.string().optional()
          .describe('Corpus mode: a self-contained MT method instead of an LLM — '
            + '"local-model" (NLLB/OPUS-MT/MADLAD on this machine) or an MT API name '
            + '(google-translate, deepl, apertium, …) from the method registry. An MT API '
            + 'engine sends the text to its service (apertium: the public apertium.org '
            + 'unless APERTIUM_API_URL points elsewhere).'),
        method_dir: z.string().optional()
          .describe('Corpus mode: an mt-eval method plugin DIRECTORY the user holds (method.json '
            + 'with name + entry_point "module:ClassName", and that Python module), run as '
            + '`mt-eval run --method <dir>` (with model: `-m <model>`, handed to the plugin). Not with '
            + 'method, provider or coaching_file. '
            + '(A champollion plugin manifest, e.g. an nmt-forge export\'s, is not one: use forge_export.)'),
        allow_model_pair_mismatch: z.boolean().optional()
          .describe('With method "local-model" (`--allow-model-pair-mismatch`): run an OPUS-MT pair model '
            + 'whose id names another language pair than the corpus (opus-mt-en-fi on eng>sme, as a '
            + 'related-language baseline). The harness refuses that without it, because a pair model '
            + 'writes its own target language; the run card records the mismatch.'),
        attest_local_transport: z.boolean().default(false)
          .describe('Corpus mode, an MT engine (method) or a method_dir plugin: the USER attests its '
            + 'transport is fully local (nothing leaves this machine) — recorded in the RunLog. '
            + 'Required for an engine or plugin on a local-only corpus. Ask them; never assume. NOT '
            + 'for method "local-model": the harness runs it in this process, so it needs no '
            + 'attestation (passing one is refused). Refused for an engine whose configured '
            + 'endpoint is not this machine.'),
        provider: z.enum(RUN_PROVIDERS).optional()
          .describe('LLM provider: openrouter (default), openai, anthropic, gemini, or '
            + 'local (an OpenAI-compatible server on this machine — Ollama by default; '
            + 'corpus mode only). Not with method / method_dir.'),
        base_url: z.string().optional()
          .describe('Corpus mode, provider local/openai: the endpoint (else LOCAL_API_BASE / '
            + 'OPENAI_API_BASE / the Ollama default). A non-loopback URL is NOT local.'),
        target_language: z.string().optional()
          .describe('Corpus mode: the target language NAME used in the prompt (e.g. "Plains Cree"), or its '
            + 'code: a code ("sme") is named from its language card before it reaches the prompt (passed as '
            + '--target-lang "Northern Sami" --target-lang-code sme; the plan shows the prompt). A code no '
            + 'card names (a private-use "qaa") stays a code, and the plan says so — pass the name then. The '
            + 'target CODE is passed too when the file\'s steward sidecar or corpus card states it.'),
        script: z.string().optional()
          .describe('Corpus mode, LLM runs: the ISO 15924 script the translations must be written in '
            + '(e.g. "Latn", "Cans") — passed as --target-script; the harness\'s prompt asks for it. For a '
            + 'language written in more than one script (Plains Cree: "Cans" syllabics or "Latn" SRO) ASK '
            + 'the user which script the test set\'s references use — the plan says when the card lists '
            + 'several and none was given. Not for method / method_dir (they get no prompt).'),
        source_language: z.string().optional()
          .describe('Corpus mode: the source language NAME (e.g. "English") — for the prompt and the run '
            + 'card. When the file\'s steward sidecar or the corpus card it names states the pair, '
            + 'that source code is passed too and the harness names the language itself (the plan says '
            + 'which); without either, the run card leaves the source language blank.'),
        source_field: z.string().optional()
          .describe('Corpus mode: source field name in your file (default "source").'),
        target_field: z.string().optional()
          .describe('Corpus mode: reference field name in your file (default "reference").'),
        max_cost: z.number().positive().optional()
          .describe('Corpus mode: abort before translating if the estimated cost exceeds this '
            + 'USD cap (an unknown estimate also aborts — omit it for local runs).'),
        coaching_file: z.string().optional()
          .describe('Corpus mode, LLM runs: a coaching file the user holds (Markdown, text or '
            + 'JSON) — its full text is sent to the model as its instructions; the run is '
            + 'labelled "coached". Never a protected test file.'),
        glossary: z.string().optional()
          .describe('Corpus mode: an evaluation glossary (JSON {"term": "translation"}) for the '
            + 'terminology score. Used only for scoring, never sent to the model; give every '
            + 'run you compare the same file.'),
        attest_no_training: z.boolean().default(false)
          .describe('Corpus mode: the USER attests the model was not trained on this corpus. '
            + 'Ask them; never assume.'),
        accept_nc_terms: z.boolean().default(false)
          .describe('Corpus mode: the USER accepts a non-commercial corpus\'s terms. Only '
            + 'after they agree.'),
        skip_fst: z.boolean().default(false)
          .describe('Item/corpus mode: score WITHOUT FST acceptance (`--skip-fst`), even when the target '
            + 'language has an FST — the run card marks it not computed. For when the plan says the '
            + 'FST or its runtime is missing and the user chooses to score without it. Not for queue runs.'),
        skip_eval_standard: z.boolean().default(false)
          .describe('Item/corpus mode: score WITHOUT the language card\'s eval-standard metrics '
            + '(`--skip-eval-standard`; an external package, e.g. the Plains Cree standard) — the run '
            + 'card marks them not computed. Not for queue runs.'),
        comet: z.boolean().default(false)
          .describe('Item/corpus mode: REQUIRE COMET. The harness computes COMET on every run whose Python has '
            + 'unbabel-comet (`mt-eval setup --comet`: about 300 MB, plus about 2.3 GB of model on first use) — '
            + 'there is no run flag. The plan always says whether it will be computed; with comet: true a '
            + 'confirmed run is REFUSED while it is not available, instead of scoring without it. Not for queue runs.'),
        metricx: z.boolean().default(false)
          .describe('Item/corpus mode: also compute MetricX-24 (`--metricx`; lower is better, 0–25, reported beside '
            + 'the chrF++ headline, never blended into it; runs on this machine). Needs `python3 -m pip install \'mt-eval-harness[metricx]\'` plus '
            + 'Google\'s model code (`python3 -m pip install git+https://github.com/google-research/metricx`) in the '
            + 'harness\'s Python, and downloads several GB on first use. The plan says whether it is installed; a '
            + 'confirmed run is REFUSED while it is not. Not for queue runs.'),
        metricx_model: z.string().optional()
          .describe('With metricx: true — another MetricX checkpoint (`--metricx-model`, e.g. an xl/xxl or a '
            + 'google/metricx-25-* one); default google/metricx-24-hybrid-large-v2p6.'),
        fuse: z.boolean().default(false)
          .describe('Item/corpus mode: also compute the FUSE-style comparator (`--fuse`; untrained, reported beside '
            + 'the scores, never blended into the chrF++ headline). Needs `python3 -m pip install \'mt-eval-harness[fuse]\'`; LaBSE '
            + 'downloads about 1.8 GB on first use. Refused at confirm while it is not installed. Not for queue runs.'),
        dry_run: z.boolean().default(false)
          .describe('Preview without running. Item/corpus dry runs answer inline; a queue '
            + 'dry run is a background job (poll get_run_status for the plan).'),
        confirm: z.boolean().default(false)
          .describe('Must be true to actually run. Confirm with the user first.'),
        publish: z.boolean().default(false)
          .describe('Publish results to the leaderboard. DEFAULT FALSE — results stay local. '
            + 'True writes to the target named in the response (normally the PRODUCTION '
            + 'public board) — only with the user\'s explicit consent. The plan (dry_run, or no '
            + 'confirm) lists what goes public: every row WITH its sentence text or scores only, '
            + 'and whether the prompt is published or redacted.'),
        publish_ack: z.string().optional()
          .describe('With publish:true and confirm:true: the user\'s acknowledgement of what goes '
            + 'public, in the EXACT words the plan prints (e.g. "publish to production: scores only, '
            + 'prompt published"). Missing or different → REFUSED, nothing runs. Never write it '
            + 'without showing the user the plan\'s "WHAT GETS PUBLISHED" lines first.'),
        anonymous: z.boolean().default(false)
          .describe('With publish:true: publish without signing in (shown as "anonymous").'),
      }).strict(),
    },
    async (params) => {
      try {
        // A code given as target_language ("sme") is named from the card
        // index before it reaches the prompt (languageNameFor).
        const result = await runBenchmark(params, {
          languageName: (code) => languageNameFor(languageIndex, code),
        });
        const refused = /^(REFUSED|Cannot run|mt-eval is not installed)/.test(result);
        return {
          content: [{ type: 'text', text: result }],
          ...(refused ? { isError: true } : {}),
        };
      } catch (err) {
        return {
          content: [{ type: 'text', text: `Error running benchmark: ${err.message}` }],
          isError: true,
        };
      }
    }
  );

  // ------------------------------------------------------------------
  // Tool: get_run_status
  // ------------------------------------------------------------------
  server.tool(
    'get_run_status',
    'Poll the status of a benchmark launched by run_benchmark. run_benchmark '
    + 'returns immediately with a job id (the run continues in the background, '
    + 'so it never trips the default 60s MCP client request timeout); call this '
    + 'with that job id every ~15-30s until it reports COMPLETED or FAILED. '
    + 'Each poll returns instantly. On completion it returns the run output '
    + '(local score for an item run; per-item lines for a queue run) — then use '
    + 'get_results to see the published leaderboard entry. Jobs are kept on disk '
    + '(the newest 50): a job started before this server restarted is still found — '
    + 'RUNNING, COMPLETED with the results the harness wrote, or INTERRUPTED with its '
    + 'log tail. Call with no job_id to list them.',
    {
      job_id: z.string().optional()
        .describe('The job id returned by run_benchmark (e.g. "run-3f9c2a7b1e04"). Omit to list the job history.'),
    },
    async ({ job_id }) => {
      try {
        return { content: [{ type: 'text', text: getRunStatus(job_id) }] };
      } catch (err) {
        return {
          content: [{ type: 'text', text: `Error reading run status: ${err.message}` }],
          isError: true,
        };
      }
    }
  );

  // ------------------------------------------------------------------
  // Tools: preview_publish (read-only) and publish_report (writes)
  // ------------------------------------------------------------------
  // Two tools, so an agent host can allow the PREVIEW on its own and keep the
  // real publish behind approval (Round 13 researcher: the host refused
  // publish_report's preview as a production deploy, because one tool did
  // both). The MCP tool annotations say which is which.
  // STRICT schemas: on a publishing tool a misspelled `scores_only` must be
  // refused by name — stripped, it would publish the sentence text; on the
  // preview a `confirm` or `publish_ack` is refused, never ignored.
  const reportArgs = {
    report: z.string()
      .describe('Path to the run\'s TestReport (*_report.json) — get_run_status prints it under "Results".'),
    scores_only: z.boolean().default(false)
      .describe('Publish ONLY the aggregate scores + the corpus sha256/size (`--scores-only`) — never the '
        + 'sentence text. For a private or confidential corpus; the preview then says "scores only".'),
    redact_coaching: z.boolean().default(false)
      .describe('Publish the system/coaching prompt as its sha256 only (`--redact-coaching`); its text stays '
        + 'in the local run log.'),
    anonymous: z.boolean().default(false)
      .describe('Publish without signing in (`--anonymous`): shown as "anonymous", rate-limited per IP.'),
  };
  server.registerTool(
    'preview_publish',
    {
      title: 'Preview a publish (read-only)',
      description: 'READ-ONLY — cannot publish. What publishing a FINISHED run\'s report (the *_report.json '
        + 'get_run_status names under "Results") would put on the leaderboard, and the exact publish_report '
        + 'call that would publish it. Runs only the harness\'s own `mt-eval publish <report> --dry-run` (no '
        + 'network, no sign-in, nothing written) and has no confirm or publish_ack, so a host can allow this '
        + 'tool on its own and keep publish_report behind approval. Returns WHAT GETS PUBLISHED — every row '
        + 'WITH its sentence text, or scores only; the prompt, or only its sha256; where (normally the '
        + 'PRODUCTION public board) — and the publish_ack words. scores_only / redact_coaching / anonymous '
        + 'preview those variants; the next call carries the same flags.',
      inputSchema: z.object(reportArgs).strict(),
      annotations: {
        title: 'Preview a publish (read-only)',
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params) => {
      try {
        const r = await previewReport(params);
        return { content: [{ type: 'text', text: r.text }], ...(r.isError ? { isError: true } : {}) };
      } catch (err) {
        return { content: [{ type: 'text', text: `Error previewing the publish: ${err.message}` }], isError: true };
      }
    },
  );

  server.registerTool(
    'publish_report',
    {
      title: 'Publish a report to the leaderboard',
      description: 'WRITES to the public leaderboard: publishes a FINISHED run\'s report (the *_report.json '
        + 'get_run_status names under "Results") — the MCP twin of `mt-eval publish <report>`, for a run made '
        + 'without publish: true. To only SEE what would go public, call preview_publish (read-only; a host can '
        + 'allow it alone). Only confirm: true WITH the exact publish_ack the preview prints publishes (to '
        + 'normally the PRODUCTION board); anything else is refused and nothing is written. Without confirm it '
        + 'returns the same preview and writes nothing (kept for older callers). scores_only withholds the '
        + 'sentence text; redact_coaching publishes only the prompt\'s sha256. Show the user the preview first '
        + 'and publish only with their agreement.',
      inputSchema: z.object({
        ...reportArgs,
        confirm: z.boolean().default(false)
          .describe('Must be true to publish — and only with publish_ack. Without it: the preview, nothing written.'),
        publish_ack: z.string().optional()
          .describe('With confirm: true — the user\'s acknowledgement of what goes public, in the EXACT words the '
            + 'preview prints (e.g. "publish to production: scores only, prompt published"). Missing or '
            + 'different → REFUSED, nothing is written. Never write it before the user has seen the preview.'),
      }).strict(),
      // It writes to a public board (normally production) and a published
      // row cannot be taken back from this tool: hosts should ask first.
      annotations: {
        title: 'Publish a report to the leaderboard',
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        const r = await publishReport(params);
        return { content: [{ type: 'text', text: r.text }], ...(r.isError ? { isError: true } : {}) };
      } catch (err) {
        return { content: [{ type: 'text', text: `Error publishing the report: ${err.message}` }], isError: true };
      }
    },
  );

  // ------------------------------------------------------------------
  // Transport setup
  // ------------------------------------------------------------------
  return {
    /** Connect to any MCP transport (tests use the SDK's in-memory pair). */
    async connect(transport) {
      await server.connect(transport);
    },
    /** Start the server on stdio transport. */
    async start() {
      const transport = new StdioServerTransport();
      await server.connect(transport);
      // stderr for diagnostics — stdout is reserved for JSON-RPC
      process.stderr.write('Champollion MCP server running on stdio\n');
    },
  };
}
