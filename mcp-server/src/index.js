/**
 * Champollion MCP Server — core implementation.
 *
 * Exposes the Champollion benchmark queue, language metadata, and
 * mt-eval harness controls to AI agents via the Model Context Protocol.
 *
 * Tools:
 *   - list_queue        Read-only. Fetch and filter the public queue.
 *   - get_queue_item    Read-only. Get details for a specific queue item.
 *   - estimate_cost     Read-only. Estimate cost for a set of queue items.
 *   - search_languages  Read-only. Search language cards by name/code/family.
 *   - get_project_info  Read-only. Get Champollion project overview.
 *   - get_results       Read-only. Read scored runs from the public leaderboard.
 *   - get_run_card      Read-only. Get one run card (scores + metadata) by id.
 *   - run_benchmark     Action. Start a benchmark via mt-eval (returns a job
 *                       handle immediately; runs in the background).
 *   - get_run_status    Read-only. Poll a benchmark job by id until it settles.
 *
 * Resources (read-only data exposed via URIs):
 *   - champollion://contributing-guide  CONTRIBUTING.md content.
 *   - champollion://queue-schema        Queue item field definitions.
 *
 * Prompts (reusable conversation starters):
 *   - contribute_compute   "I want to help — what would $X buy?"
 *   - compete_for_prize    "I want to win a prize — how do I compete?"
 *   - explore_language     "Tell me about [language] in Champollion."
 *
 * Data sources:
 *   - Queue: fetched from champollion.dev/queue.json (cached 5 min)
 *   - Languages: loaded from the CLI's language-cards directory
 *   - Results: public Supabase leaderboard (run_cards), same anon read path
 *     the champollion.dev leaderboard uses
 *
 * The server is stateless between tool calls. Queue data is cached in
 * memory with a 5-minute TTL to avoid hammering the endpoint.
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
import { searchLanguages, loadLanguageIndex } from './tools/languages.js';
import { runBenchmark, getRunStatus } from './tools/harness.js';
import { fetchResults, formatResults, fetchRunCard } from './tools/results.js';
import { metricReliability, formatReliability } from './tools/reliability.js';
import { translateTexts, formatTranslateResult, METHOD_ENV } from './tools/translate.js';
import { trainingGuardrails, formatTrainingGuardrails } from './tools/training.js';
import { forgeTool } from './tools/forge.js';

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
        '| Language cards | cli/shared/language-cards/ (repo) | 7,900+ per-language JSON cards, every value cited. Prefer the search_languages tool. |',
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
              + 'What metadata does Champollion have for this language? '
              + 'Is it in the benchmark queue? '
              + 'What would it cost to run all its pending benchmarks?',
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
              '1. Are there any active prize pools right now? Check the prize spec for current status.',
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
          `Found ${items.length} items (of ${sel.metadata.open_items} total open).`,
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
    'Search Champollion language cards by name, ISO code, language family, '
    + 'or region. Returns metadata about languages in the project.',
    {
      query: z.string()
        .describe('Search term: language name, ISO 639-3 code, family name, or region. Case-insensitive.'),
      limit: z.number().int().min(1).max(50).default(10)
        .describe('Maximum results to return (default 10).'),
    },
    async ({ query, limit }) => {
      // Guarded like every other handler here. This was the one without a
      // try/catch, so when the card shape changed underneath it and
      // `name.toLowerCase()` began throwing, the TypeError escaped to the SDK
      // instead of becoming a message an agent could read and route around.
      // An agent's first stop into this server should not be able to take the
      // whole call down.
      let results;
      try {
        results = searchLanguages(languageIndex, query, limit);
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
      if (results.length === 0) {
        return {
          content: [{
            type: 'text',
            text: `No languages found matching "${query}". Try a different name, code, or family.`,
          }],
        };
      }
      const lines = results.map(lang =>
        `${lang.code}  ${lang.name}  ${lang.endonym || ''}  `
        + `family: ${lang.family || 'unknown'}  `
        + `speakers: ${lang.speakers || 'unknown'}`
      );
      return {
        content: [{
          type: 'text',
          text: `Found ${results.length} language(s):\n\n${lines.join('\n')}`,
        }],
      };
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
              'Champollion is building an open scoreboard for machine translation',
              'quality across 7,900+ languages. The project maintains:',
              '',
              '- A public **benchmark queue** of untested (language pair, model, condition)',
              '  combinations ranked by expected improvement to the translation mesh',
              '- An **evaluation harness** (mt-eval) that runs standardized benchmarks',
              '  and publishes results to a public leaderboard',
              '- **Language cards** with metadata for thousands of languages',
              '',
              '## Contributing Compute',
              '',
              'The easiest way to help: donate some API tokens to run benchmarks',
              'from the public queue. Anyone with an API key can contribute:',
              '',
              '1. Install the harness: `pipx install mt-eval-harness`',
              '2. Set your API key: `export OPENROUTER_API_KEY=sk-or-...`',
              '3. Run from the queue: `mt-eval queue --budget 5`',
              '   (runs top items up to $5 estimated cost)',
              '4. Results auto-publish to the leaderboard with your attribution',
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
    + 'community) scored. Returns ranked, scored runs (composite, chrF++, '
    + 'BLEU, COMET) with trust level and attribution — never raw test '
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
      sort: z.enum(['composite', 'chrf', 'bleu', 'comet', 'ter', 'cost', 'date']).default('composite')
        .describe('Sort metric. Score metrics sort best-first; ter/cost lowest-first; date newest-first.'),
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
        return { content: [{ type: 'text', text: JSON.stringify(card, null, 2) }] };
      } catch (err) {
        return {
          content: [{ type: 'text', text: `Error fetching run card: ${err.message}` }],
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
      target: z.string()
        .describe('Target language as an ISO 639 code ("iu", "iku", "kk") or '
          + 'a language-family name ("Turkic", "Eskimo-Aleut"). This is the '
          + 'language being TRANSLATED INTO — metric reliability is about '
          + 'scoring output in that language.'),
    },
    async ({ target }) => {
      try {
        const answer = await metricReliability(target);
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
  server.tool(
    'translate',
    'Translate texts through the champollion pipeline — the tested, '
    + 'deterministic alternative to improvising your own translation prompt. '
    + 'You get: engine choice (LLM via OpenRouter, direct '
    + 'OpenAI/Anthropic/Gemini, DeepL, Google Translate, Microsoft, '
    + 'LibreTranslate), language-card register/formality conditioning, a '
    + 'persistent Translation Memory (repeated texts cost ZERO tokens — the '
    + 'response shows the savings), and a deterministic five-check quality '
    + 'gate (empty/source-echo/hallucination-loop/length-inflation/'
    + 'script-compliance) so a bad translation comes back as an explicit '
    + 'failure, never as silent garbage. Spends real API tokens only for '
    + 'texts the Translation Memory has not seen (cost estimate included in '
    + 'the response). This is production translation — benchmark evidence '
    + 'and quality claims still come from run_benchmark/get_results.',
    {
      texts: z.array(z.string()).min(1).max(50)
        .describe('Source texts to translate (max 50 per call; the TM makes repeated calls cheap).'),
      source_language: z.string()
        .describe('Source language code (e.g. "en").'),
      target_language: z.string()
        .describe('Target language code (e.g. "fr", "crk", "zul").'),
      method: z.enum(Object.keys(METHOD_ENV)).default('llm')
        .describe('Translation engine. "llm" (OpenRouter) is the default; each engine needs its API key in the server environment.'),
      model: z.string().optional()
        .describe('Model override for LLM methods (e.g. "anthropic/claude-sonnet-5").'),
      register: z.string().optional()
        .describe('Style/register instruction (e.g. "formal", "casual-tu", or free-text guidance). Defaults to the language card\'s register.'),
      use_tm: z.boolean().default(true)
        .describe('Consult and populate the persistent Translation Memory (default true — identical requests become free).'),
      validate: z.boolean().default(true)
        .describe('Run the deterministic quality gate on fresh translations (default true).'),
    },
    async ({ texts, source_language, target_language, method, model, register, use_tm, validate }) => {
      try {
        const result = await translateTexts({
          texts, source: source_language, target: target_language,
          method, model, register, useTm: use_tm, validate,
        });
        return {
          content: [{ type: 'text', text: formatTranslateResult(result) }],
          isError: result.status !== 'ok',
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
    + 'kills and the enforcing tool in the monorepo forge/ package '
    + '(nmt-forge). Also the non-negotiables: datasets marked do_not_train '
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
  // forge_prereg. Results: forge_evaluate (closes the decode→battery loop),
  // forge_report/forge_lint (read the diagnosis). `nmt-forge run` (the GPU
  // job) is intentionally not a tool — forge_status returns its exact
  // command and watcher guidance.
  // ------------------------------------------------------------------
  const forgeWs = z.string().optional()
    .describe('Workspace directory (default .forge, or '
      + 'CHAMPOLLION_FORGE_WORKSPACE). The project you are driving.');

  server.tool(
    'forge_status',
    'WHERE AM I in an nmt-forge project, and WHAT DO I RUN NEXT? Call this '
    + 'FIRST and after every step — it reads the actual workspace (registered '
    + 'dev/test/sealed sets, preregistrations, completed runs, ledger) and '
    + 'returns a state name, THE single next command with exact args, and any '
    + 'blockers. Deterministic: same state → same advice. This is the driver '
    + 'a weak agent follows mechanically instead of guessing.',
    { workspace: forgeWs },
    async ({ workspace }) => forgeTool(['status', '--json'], {
      workspace,
      nextHint: 'run result.advice.next_command; if it is `nmt-forge run` '
        + '(a GPU job), run it in a terminal and watch the [schedule-sanity] '
        + 'lines, then call forge_evaluate on the run manifest.',
    }),
  );

  server.tool(
    'forge_preflight',
    'WILL THIS COMMAND REFUSE? Renders every gate a forge command will hit '
    + '(✓/✗ with the fix for each ✗), so you stop trial-and-erroring through '
    + 'refusals one at a time. Use it before run/score/split/prereg/'
    + 'leak-audit when forge_status points you at one. Exit-2 semantics are '
    + 'flattened into per-gate ok flags in the JSON.',
    {
      target: z.enum(['run', 'score', 'split', 'prereg', 'leak-audit'])
        .describe('The command to preflight.'),
      workspace: forgeWs,
    },
    async ({ target, workspace }) => forgeTool(['preflight', target, '--json'], {
      workspace, nextHint: 'fix any gate with ok:false using its fix string, '
        + 'then re-run forge_preflight until all gates pass.',
    }),
  );

  server.tool(
    'forge_discover',
    'What does a language HAVE? Reads the SSOT language card and reports '
    + 'scripts, analyzers, dictionaries, corpora, eval datasets (with '
    + 'do_not_train/quarantine flags), LYSS referee plugins, and where the '
    + 'language sits on the asset ladder. Absence means UNKNOWN, never zero. '
    + 'Call this before init to know what training path is possible.',
    {
      code: z.string().describe('ISO 639-3 code (e.g. crk, nav, arb).'),
      workspace: forgeWs,
    },
    async ({ code, workspace }) => forgeTool(['discover', code, '--json'], {
      workspace, nextHint: 'scaffold the project with forge_init, then '
        + 'forge_status.',
    }),
  );

  server.tool(
    'forge_init',
    'Scaffold a forge project from a language card: workspace + starter '
    + 'config + NEXT_STEPS brief. Run after forge_discover. Writes the '
    + 'language block the training loop needs for plugin discovery.',
    {
      code: z.string().describe('ISO 639-3 code of the TARGET language.'),
      dir: z.string().optional().describe('Project directory (default .).'),
      pair: z.string().optional()
        .describe('Language pair SRC-TGT (default eng-<code>).'),
      workspace: forgeWs,
    },
    async ({ code, dir, pair, workspace }) => forgeTool(
      ['init', code, ...(dir ? ['--dir', dir] : []), ...(pair ? ['--pair', pair] : [])],
      { workspace, nextHint: 'call forge_status — it will tell you to split a '
        + 'corpus and register a dev set next.' }),
  );

  server.tool(
    'forge_split',
    'Carve a parallel corpus into GROUP-DISJOINT train/dev/test — pairs '
    + 'sharing a canonical source OR target land on one side, so answer-'
    + 'sharing rows can never straddle the split (the split-guard). Use '
    + '--register to also register the dev/test files in one step.',
    {
      corpus: z.string().describe('Path to the parallel corpus (.jsonl).'),
      test: z.number().int().positive().describe('Test set size (rows).'),
      dev: z.number().int().nonnegative().optional().describe('Dev set size.'),
      seed: z.number().int().describe('Split seed (required, reproducible).'),
      out: z.string().describe('Output directory for the split files.'),
      register: z.string().optional()
        .describe('Prefix: also register <prefix>-test / <prefix>-dev.'),
      workspace: forgeWs,
    },
    async ({ corpus, test, dev, seed, out, register, workspace }) => forgeTool(
      ['split', corpus, '--test', String(test), '--seed', String(seed),
        '--out', out, ...(dev ? ['--dev', String(dev)] : []),
        ...(register ? ['--register', register] : [])],
      { workspace, nextHint: 'forge_status — you now have dev/test; next is '
        + 'usually prereg then run.' }),
  );

  server.tool(
    'forge_leak_audit',
    'Screen a corpus against every registered eval set BEFORE training: '
    + 'target-side exact/near-dupe is fatal (answer leakage); source-only '
    + 'near-dupe is informational (different answer = legitimate minimal '
    + 'contrast, kept). Pass clean_to to write the survivors instead of '
    + 'failing. Runs automatically inside `run` too — use this to pre-clean.',
    {
      corpus: z.string().describe('Corpus to screen (.jsonl).'),
      strict: z.boolean().optional().describe('Hard-fail on test/sealed hits.'),
      clean_to: z.string().optional()
        .describe('Write surviving rows here instead of failing.'),
      workspace: forgeWs,
    },
    async ({ corpus, strict, clean_to, workspace }) => forgeTool(
      ['leak-audit', corpus, ...(strict ? ['--strict'] : []),
        ...(clean_to ? ['--clean-to', clean_to] : [])],
      { workspace, nextHint: 'if rows were removed, train on the --clean-to '
        + 'file; then forge_status.' }),
  );

  server.tool(
    'forge_register_eval',
    'Register an eval file in the workspace with a role: dev (fenced '
    + 'checkpoint selection), test (prereg-gated scoring), or sealed '
    + '(one-shot). Every downstream guard keys off these roles. Test sets '
    + 'must be REAL data (synthetic rows are refused).',
    {
      name: z.string().describe('Registry name for the set.'),
      path: z.string().describe('Path to the eval file (.jsonl).'),
      role: z.enum(['dev', 'test', 'sealed']).describe('The set\'s role.'),
      source_field: z.string().optional().describe('Source field (default source).'),
      target_field: z.string().optional().describe('Target/reference field.'),
      workspace: forgeWs,
    },
    async ({ name, path, role, source_field, target_field, workspace }) => forgeTool(
      ['registry', 'add', name, path, '--role', role,
        ...(source_field ? ['--source-field', source_field] : []),
        ...(target_field ? ['--target-field', target_field] : [])],
      { workspace, nextHint: 'forge_status; a test/sealed set needs a prereg '
        + 'before it can be scored.' }),
  );

  server.tool(
    'forge_prereg',
    'Preregister falsifiable predictions for a test/sealed set BEFORE '
    + 'scoring it. Scoring a test set is refused without a prereg that '
    + 'predates the first scoring read — this is what makes a result honest '
    + 'rather than results-first storytelling. Predictions is a JSON file: a '
    + 'list of {metric, expect, rationale} objects.',
    {
      id: z.string().describe('Preregistration id.'),
      eval_set: z.string().describe('The registered test/sealed set name.'),
      predictions: z.string()
        .describe('Path to a JSON file: list of prediction objects.'),
      author: z.string().optional(),
      workspace: forgeWs,
    },
    async ({ id, eval_set, predictions, author, workspace }) => forgeTool(
      ['prereg', 'new', id, '--eval-set', eval_set, '--predictions', predictions,
        ...(author ? ['--author', author] : [])],
      { workspace, parseJson: false,
        nextHint: 'forge_status — you should now be ready-to-train or '
          + 'ready-to-score.' }),
  );

  server.tool(
    'forge_evaluate',
    'CLOSE THE LOOP after a training run: decode the config\'s battery with '
    + 'the run\'s SELECTED checkpoint, score it (CIs, prereg-gated) and '
    + 'auto-append a plain-language Diagnosis & Recommendations. This is the '
    + 'step that used to require a manual checkpoint symlink + decoder. Call '
    + 'it on the run-manifest.json that `nmt-forge run` wrote.',
    {
      run_manifest: z.string().describe('Path to run-manifest.json.'),
      config: z.string().optional()
        .describe('Config path (defaults to the config embedded in the '
          + 'manifest); must carry an eval block.'),
      out_hyps: z.string().optional().describe('Where to write decoded hyps.'),
      workspace: forgeWs,
    },
    async ({ run_manifest, config, out_hyps, workspace }) => forgeTool(
      ['evaluate', run_manifest, ...(config ? ['--config', config] : []),
        ...(out_hyps ? ['--out-hyps', out_hyps] : [])],
      { workspace, parseJson: false,
        nextHint: 'read the Diagnosis section; call forge_lint on the battery '
          + 'manifest for --json findings and the lever to pull next.' }),
  );

  server.tool(
    'forge_lint',
    'Diagnose a battery manifest: which registers are weak, the likeliest '
    + 'cause given the co-occurring signals, and the exact LEVER to pull next '
    + '(VOCABULARY / STRUCTURE / ORTHOGRAPHY / REAL-DATA / MEASUREMENT / '
    + 'REFEREE). Returns rule-id\'d findings with evidence — recommendations '
    + 'are explainable, not vibes. Pass the run manifest too for transfer-'
    + 'plateau detection.',
    {
      manifest: z.string().describe('Battery manifest JSON path.'),
      run_manifest: z.string().optional()
        .describe('Run manifest for schedule/transfer-plateau signals.'),
      workspace: forgeWs,
    },
    async ({ manifest, run_manifest, workspace }) => forgeTool(
      ['lint', manifest, '--json',
        ...(run_manifest ? ['--run-manifest', run_manifest] : [])],
      { workspace, nextHint: 'act on the highest-severity finding\'s lever; '
        + 're-run and re-evaluate.' }),
  );

  server.tool(
    'forge_report',
    'Re-render the plain-language report (with the Diagnosis section) from a '
    + 'run manifest or a battery manifest. Read-only pretty-printer for a '
    + 'result you already produced.',
    { manifest: z.string().describe('Run or battery manifest path.'), workspace: forgeWs },
    async ({ manifest, workspace }) => forgeTool(['report', manifest],
      { workspace, parseJson: false }),
  );

  // ------------------------------------------------------------------
  // Tool: run_benchmark
  // ------------------------------------------------------------------
  server.tool(
    'run_benchmark',
    'Start one or more benchmark items from the queue using mt-eval. '
    + 'This executes the mt-eval harness on the user\'s machine and SPENDS '
    + 'real API tokens. Requires mt-eval to be installed and an API key set. '
    + 'Spending is gated: you MUST confirm with the user first and then pass '
    + 'confirm:true. Without confirm:true (or with dry_run:true) the tool '
    + 'returns a plan and spends nothing. '
    + 'A confirmed run does NOT block: the benchmark is launched in the '
    + 'background and this tool returns a JOB ID immediately (a real run takes '
    + 'minutes — far longer than a default 60s MCP client timeout). After it '
    + 'returns, poll get_run_status with that job id until the job reports '
    + 'COMPLETED or FAILED, then call get_results. '
    + 'Budget/top runs execute in deterministic top-of-queue order — the same '
    + 'order estimate_cost and list_queue preview — and auto-publish each result '
    + 'to the public leaderboard unless publish:false is passed. '
    + 'SCOPE IS MANDATORY: every real run must name exactly one bound — budget '
    + '(USD ceiling), top (item count), or item_id (one item). A call with none '
    + 'of them is REFUSED rather than run over the whole queue.',
    {
      budget: z.number().positive().optional()
        .describe('Run the top queue items up to this USD budget. One of '
          + 'budget/top/item_id is REQUIRED for a real run.'),
      top: z.number().int().positive().optional()
        .describe('Run the top N items from the queue. One of '
          + 'budget/top/item_id is REQUIRED for a real run.'),
      item_id: z.string().optional()
        .describe('Run a specific queue item by ID. One of '
          + 'budget/top/item_id is REQUIRED for a real run.'),
      dry_run: z.boolean().default(false)
        .describe('If true, show what would be run without executing anything. '
          + 'A queue-mode (budget/top) dry run is backgrounded like a real run '
          + '— it returns a job id; poll get_run_status for the plan. An '
          + 'item_id dry run returns its plan inline.'),
      provider: z.enum(['openrouter', 'openai', 'anthropic', 'gemini']).optional()
        .describe('API provider. Auto-detected from environment if not specified.'),
      confirm: z.boolean().default(false)
        .describe('Must be true to actually spend tokens. Confirm with the '
          + 'user before setting this. Ignored for dry_run.'),
      publish: z.boolean().default(true)
        .describe('Auto-publish each result to the public leaderboard '
          + '(default true). Pass false for a scoring/validation run that '
          + 'spends tokens but makes NO leaderboard write. Applies to '
          + 'budget/top runs; a single item_id run is never auto-published.'),
    },
    async ({ budget, top, item_id, dry_run, provider, confirm, publish }) => {
      try {
        const result = await runBenchmark({
          budget, top, item_id, dry_run, provider, confirm, publish,
        });
        return {
          content: [{ type: 'text', text: result }],
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
    + 'get_results to see the published leaderboard entry. Call with no job_id '
    + 'to list all jobs started in this session.',
    {
      job_id: z.string().optional()
        .describe('The job id returned by run_benchmark (e.g. "run-1"). Omit to list all jobs started this session.'),
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
  // Transport setup
  // ------------------------------------------------------------------
  return {
    /** Start the server on stdio transport. */
    async start() {
      const transport = new StdioServerTransport();
      await server.connect(transport);
      // stderr for diagnostics — stdout is reserved for JSON-RPC
      process.stderr.write('Champollion MCP server running on stdio\n');
    },
  };
}
