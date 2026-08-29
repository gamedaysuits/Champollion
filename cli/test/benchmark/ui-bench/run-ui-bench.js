#!/usr/bin/env node
/**
 * run-ui-bench.js — UI String Translation Benchmark Runner
 *
 * Runs LLMs against the champollion-bench dataset with 3 experimental
 * conditions to measure whether register-steered prompting improves
 * real-world UI string translation quality.
 *
 * Experimental conditions:
 *   naive    — "Translate to {lang}, return JSON." (no instructions)
 *   register — Full champollion prompt (register, key-type hints, rules)
 *   domain   — Register + domain-specific instructions (future feature test)
 *
 * Usage:
 *   node test/benchmark/ui-bench/run-ui-bench.js [options]
 *
 * Options:
 *   --models          Comma-separated model slugs (default: gpt-4o-mini)
 *   --langs           Comma-separated lang codes (default: all 6)
 *   --condition       "register" | "naive" | "domain" | "all" (default: all)
 *   --config          Path to champollion.config.json — reads promptContext + register overrides
 *   --prompt-context  Global context string injected into register prompts
 *   --register        Preset key or JSON map for register overrides
 *   --concurrency     Max concurrent languages per model (default: 3)
 *   --dry-run         Print plan without calling APIs
 *   --resume          Skip combos that already have results
 *
 * Environment:
 *   OPENROUTER_API_KEY — Required
 *
 * Output:
 *   test/benchmark/ui-bench/results/raw/{model}/{condition}/{lang}.json
 *   test/benchmark/ui-bench/results/costs.json
 *
 * Token budget strategy:
 *   Signal strings average ~8 words, but some contain long descriptions
 *   or ICU plural templates. With BATCH_SIZE=30, worst-case input is
 *   ~2K tokens. We set BATCH_SIZE=25 to leave headroom for the prompt
 *   instructions + JSON formatting overhead. If a batch still exceeds
 *   token limits (HTTP 400 from the API), we split it in half and retry.
 */

import fs from 'node:fs';
import path from 'node:path';
import { DEFAULT_REGISTERS, getLanguageCard, getRegister, getGenderGuidance, resolveCode } from '../../../lib/registers.js';
// Import the production prompt builder so the harness sends identical prompts.
// This is the single source of truth — no local copy to drift out of sync.
import { buildSystemMessage } from '../../../lib/methods/llm.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const UI_BENCH_DIR = path.resolve(import.meta.dirname);
const SOURCE_DIR = path.join(UI_BENCH_DIR, 'source');
const RESULTS_DIR = path.join(UI_BENCH_DIR, 'results');
const COSTS_FILE = path.join(RESULTS_DIR, 'costs.json');

/**
 * Models under test — starting with the cheapest for pipeline validation.
 * More models can be added after confirming the pipeline works correctly.
 */
const MODELS = {
  'gpt-4o-mini': {
    slug: 'openai/gpt-4o-mini',
    inputPer1M: 0.15,
    outputPer1M: 0.60,
  },
  'mistral-large-3': {
    slug: 'mistralai/mistral-large-2512',
    inputPer1M: 0.50,
    outputPer1M: 1.50,
  },
  'deepseek-v4-pro': {
    slug: 'deepseek/deepseek-v4-pro',
    inputPer1M: 0.435,
    outputPer1M: 0.87,
  },
};

/** Target languages — must have reference translations in reference/ */
const ALL_LANGS = ['fr', 'de', 'ja', 'es', 'ko', 'zh'];

/**
 * Batch size — slightly smaller than FLORES runner's 30 to account for
 * Signal's ICU message format strings which can contain long plural
 * templates like "{count, plural, one {# message} other {# messages}}".
 *
 * WHY 25 not 30: These real UI strings have more structural overhead
 * (placeholders, ICU syntax) than FLORES+ plain sentences. 25 keeps
 * us well within token limits while maintaining batching efficiency.
 */
const BATCH_SIZE = 25;

/** API request timeout — 90s for complex JSON responses */
const REQUEST_TIMEOUT_MS = 90000;

/** Retry configuration */
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1500;

/**
 * Domain-specific register enhancements — used in the 'domain' condition.
 * These augment the base language register with domain-specific instructions.
 *
 * WHY: This tests whether adding domain context to the prompt measurably
 * improves translation quality for specific application types. If it does,
 * champollion could offer per-project domain configuration.
 */
const DOMAIN_REGISTERS = {
  messaging: `This is a messaging/communication application (Signal). UI strings include:
- Chat interface labels (concise, action-oriented)
- Privacy/security-related text (precise, unambiguous)
- Settings and preferences (clear, descriptive)
- Error/recovery messages (supportive, actionable)
- Group management (formal, inclusive)
Keep messaging-specific terms consistent. Status messages should be natural.`,
  developer_tools: `This is a developer IDE/editor (VS Code). UI strings include:
- Command palette labels (concise, standardized)
- Settings descriptions (technical but clear)
- Error diagnostics (precise, actionable)
- Editor chrome (minimal, professional)
Technical terms (git, debug, lint, compile) should remain in English.`,
};

// ---------------------------------------------------------------------------
// Prompt builders — three experimental conditions
// ---------------------------------------------------------------------------

/**
 * Condition A: Naive baseline — minimal prompting.
 * No register, no key-type hints, no UI-specific rules.
 * Just: "translate these and return JSON."
 */
function buildNaivePrompt(batch, langName) {
  const toTranslate = {};
  for (const [key, text] of batch) {
    toTranslate[key] = text;
  }

  return `Translate the following English text to ${langName}. Return valid JSON with the same keys and translated values. No explanation, no markdown fences.

${JSON.stringify(toTranslate, null, 2)}`;
}

/**
 * Condition B: Register prompt — full champollion pipeline.
 * Delegates to the production buildSystemMessage from lib/methods/llm.js
 * so the harness sends the exact same system message as deployment.
 *
 * WHY import instead of copy: The production prompt includes
 * promptContext, genderGuidance, registerPreset resolution, and will
 * continue to evolve. A local copy drifts immediately.
 */
function buildRegisterPrompt(batch, langConfig) {
  // Build the system message using the production function
  const systemMessage = buildSystemMessage(langConfig);

  // Build the user message (UI string payload)
  const toTranslate = {};
  for (const [key, text] of batch) {
    toTranslate[key] = text;
  }

  // Combine system + user into a single prompt for the OpenRouter call.
  return `${systemMessage}\n\n${JSON.stringify(toTranslate, null, 2)}`;
}

/**
 * Condition C: Domain-enhanced register prompt.
 * Adds domain-specific context on top of the production register prompt.
 * Tests whether application-level context improves translations.
 */
function buildDomainPrompt(batch, langConfig, domainKey) {
  // Start with the production system message
  const systemMessage = buildSystemMessage(langConfig);

  const domainContext = DOMAIN_REGISTERS[domainKey] || '';

  const toTranslate = {};
  for (const [key, text] of batch) {
    toTranslate[key] = text;
  }

  // Inject domain context between the system message and the payload
  return `${systemMessage}\n\nApplication context:\n${domainContext}\n\n${JSON.stringify(toTranslate, null, 2)}`;
}

// ---------------------------------------------------------------------------
// API call with retry + adaptive batch splitting
// ---------------------------------------------------------------------------

/**
 * Call the OpenRouter API with retry logic and token-limit handling.
 *
 * Token limit strategy:
 *   If we get a 400 error that mentions "token" or "length", it means the
 *   batch is too large for the model's context window. Rather than failing,
 *   we return a special signal so the caller can split the batch and retry
 *   with smaller chunks.
 *
 * WHY not pre-estimate tokens: Token estimation is unreliable across models
 * (different tokenizers). It's more robust to let the API tell us when
 * we've exceeded limits and react accordingly.
 */
async function callOpenRouter(prompt, modelSlug, apiKey) {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://github.com/gamedaysuits/champollion',
          'X-Title': 'champollion-bench-ui',
        },
        body: JSON.stringify({
          model: modelSlug,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.3,
          // Request max output to avoid truncated JSON responses
          max_tokens: 4096,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Token limit exceeded — signal the caller to split the batch
      if (response.status === 400) {
        const body = await response.text();
        if (/token|length|too long|context/i.test(body)) {
          return { error: 'TOKEN_LIMIT_EXCEEDED', usage: null, shouldSplit: true };
        }
        return { error: `HTTP 400: ${body.slice(0, 200)}`, usage: null };
      }

      // Rate limit or server error — retryable
      if (response.status === 429 || response.status >= 500) {
        if (attempt < MAX_RETRIES) {
          const delay = BASE_DELAY_MS * Math.pow(2, attempt) + Math.random() * 500;
          process.stderr.write(`\n    ⏳ ${response.status} — retry in ${Math.round(delay / 1000)}s...`);
          await sleep(delay);
          continue;
        }
        return { error: `HTTP ${response.status} after ${MAX_RETRIES + 1} attempts`, usage: null };
      }

      if (!response.ok) {
        return { error: `HTTP ${response.status}`, usage: null };
      }

      const data = await response.json();

      // Check for OpenRouter-level errors in the response body
      if (data.error) {
        const errMsg = typeof data.error === 'string' ? data.error : data.error.message || JSON.stringify(data.error);
        if (/token|length|context/i.test(errMsg)) {
          return { error: 'TOKEN_LIMIT_EXCEEDED', usage: null, shouldSplit: true };
        }
        if (attempt < MAX_RETRIES) {
          const delay = BASE_DELAY_MS * Math.pow(2, attempt) + Math.random() * 500;
          process.stderr.write(`\n    ⏳ API error — retry in ${Math.round(delay / 1000)}s...`);
          await sleep(delay);
          continue;
        }
        return { error: errMsg, usage: null };
      }

      const content = data.choices?.[0]?.message?.content?.trim();
      const usage = data.usage || null;

      if (!content) {
        return { error: 'Empty response', usage };
      }

      // Strip markdown fences if present
      const cleaned = content
        .replace(/^```json?\n?/i, '')
        .replace(/\n?```$/i, '')
        .trim();

      try {
        const parsed = JSON.parse(cleaned);
        return { result: parsed, usage, error: null };
      } catch {
        // Truncated JSON — likely token limit on output side
        if (cleaned.length > 100 && !cleaned.endsWith('}')) {
          return { error: 'TRUNCATED_JSON', usage, shouldSplit: true };
        }
        return { error: 'JSON parse failed', rawContent: cleaned.slice(0, 300), usage };
      }

    } catch (err) {
      if (attempt < MAX_RETRIES) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt) + Math.random() * 500;
        process.stderr.write(`\n    ⏳ ${err.name === 'AbortError' ? 'timeout' : err.message} — retry...`);
        await sleep(delay);
        continue;
      }
      return { error: err.message, usage: null };
    }
  }
  return { error: 'Max retries exceeded', usage: null };
}

// ---------------------------------------------------------------------------
// Core benchmark logic — single model × condition × language
// ---------------------------------------------------------------------------

/**
 * Translate a batch of strings, with adaptive splitting if token limits hit.
 *
 * If the API returns TOKEN_LIMIT_EXCEEDED or TRUNCATED_JSON, we split the
 * batch in half and retry each half separately. This recursion bottoms out
 * at single-string batches (which should always fit in any model's context).
 *
 * WHY recursive splitting: Different models have different context windows,
 * and string lengths vary wildly (1 word to 50+ words). Rather than trying
 * to estimate token counts per-model, we let the API tell us when we've
 * hit the limit and adapt. This is more robust than pre-estimation.
 */
async function translateBatch(batch, condition, langConfig, domainKey, modelSlug, apiKey, depth = 0) {
  // Build prompt based on condition
  let prompt;
  switch (condition) {
    case 'naive':
      prompt = buildNaivePrompt(batch, langConfig.name);
      break;
    case 'register':
      prompt = buildRegisterPrompt(batch, langConfig);
      break;
    case 'domain':
      prompt = buildDomainPrompt(batch, langConfig, domainKey);
      break;
    default:
      throw new Error(`Unknown condition: ${condition}`);
  }

  const result = await callOpenRouter(prompt, modelSlug, apiKey);

  // If token limit hit and batch is splittable, divide and conquer
  if (result.shouldSplit && batch.length > 1) {
    const depthLabel = '  '.repeat(depth + 1);
    process.stderr.write(`\n${depthLabel}[WARN] Batch too large (${batch.length} strings) — splitting...`);

    const mid = Math.ceil(batch.length / 2);
    const firstHalf = batch.slice(0, mid);
    const secondHalf = batch.slice(mid);

    const [r1, r2] = await Promise.all([
      translateBatch(firstHalf, condition, langConfig, domainKey, modelSlug, apiKey, depth + 1),
      translateBatch(secondHalf, condition, langConfig, domainKey, modelSlug, apiKey, depth + 1),
    ]);

    // Merge results
    return {
      translations: { ...r1.translations, ...r2.translations },
      inputTokens: r1.inputTokens + r2.inputTokens,
      outputTokens: r1.outputTokens + r2.outputTokens,
      errors: r1.errors + r2.errors,
    };
  }

  // Process result
  const translations = {};
  let errors = 0;

  if (result.error) {
    errors = batch.length; // count all strings in failed batch as errors
  } else if (result.result) {
    for (const [key, text] of Object.entries(result.result)) {
      translations[key] = text;
    }
  }

  return {
    translations,
    inputTokens: result.usage?.prompt_tokens || 0,
    outputTokens: result.usage?.completion_tokens || 0,
    errors,
  };
}

/**
 * Run the benchmark for one model × one condition × one language.
 *
 * Batches the strings into chunks, calls the API with adaptive splitting,
 * collects results and usage stats, and saves to disk.
 */
async function benchmarkOneLang(modelName, modelConfig, condition, langCode, strings, metadata, apiKey, presetOverride, promptContext) {
  const card = getLanguageCard(langCode);
  const langName = card?.name || DEFAULT_REGISTERS[langCode]?.name || langCode;

  // Build the langConfig matching the shape production buildSystemMessage expects:
  // { name, register, genderGuidance?, promptContext? }
  const langConfig = {
    name: langName,
    register: getRegister(langCode, presetOverride),
    genderGuidance: getGenderGuidance(langCode),
    promptContext: promptContext || null,
  };

  if (!card && !DEFAULT_REGISTERS[langCode]) {
    console.error(`  ✗ No register defined for ${langCode}`);
    return null;
  }

  // Determine domain from metadata (use the most common domain in the dataset)
  const domainKey = 'messaging'; // Signal is messaging domain

  // Prepare output directory
  const outDir = path.join(RESULTS_DIR, 'raw', modelName, condition);
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `${langCode}.json`);

  // Convert strings object to array of [key, text] pairs for batching
  const entries = Object.entries(strings);
  const allTranslations = {};
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalErrors = 0;

  // Batch the entries
  const batches = [];
  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    batches.push(entries.slice(i, i + BATCH_SIZE));
  }

  for (let b = 0; b < batches.length; b++) {
    const batch = batches[b];
    const batchLabel = `[${b + 1}/${batches.length}]`;

    const result = await translateBatch(
      batch, condition, langConfig, domainKey, modelConfig.slug, apiKey
    );

    // Merge translations
    Object.assign(allTranslations, result.translations);
    totalInputTokens += result.inputTokens;
    totalOutputTokens += result.outputTokens;
    totalErrors += result.errors;

    // Progress indicator
    const translated = Object.keys(result.translations).length;
    if (result.errors > 0) {
      process.stderr.write(` ✗${batchLabel}`);
    } else {
      process.stderr.write(` ✓${batchLabel}`);
    }

    // Brief delay between batches to respect rate limits
    if (b < batches.length - 1) {
      await sleep(300);
    }
  }

  // Calculate cost from actual token usage
  const inputCost = (totalInputTokens / 1_000_000) * modelConfig.inputPer1M;
  const outputCost = (totalOutputTokens / 1_000_000) * modelConfig.outputPer1M;
  const totalCost = inputCost + outputCost;

  // Save result document
  const resultDoc = {
    model: modelName,
    modelSlug: modelConfig.slug,
    condition,
    language: langCode,
    languageName: langName,
    timestamp: new Date().toISOString(),
    dataset: 'ui-bench',
    datasetVersion: '1.0.0',
    stats: {
      totalStrings: entries.length,
      translatedStrings: Object.keys(allTranslations).length,
      batchErrors: totalErrors,
      batchCount: batches.length,
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      costUSD: Math.round(totalCost * 10000) / 10000,
    },
    translations: allTranslations,
  };

  fs.writeFileSync(outFile, JSON.stringify(resultDoc, null, 2));

  return resultDoc.stats;
}

// ---------------------------------------------------------------------------
// Cost ledger
// ---------------------------------------------------------------------------

class CostLedger {
  constructor() {
    this.entries = [];
    this.totalUSD = 0;
    this._writing = false;
    this._queue = [];

    // Resume from existing ledger if present
    if (fs.existsSync(COSTS_FILE)) {
      try {
        const existing = JSON.parse(fs.readFileSync(COSTS_FILE, 'utf-8'));
        this.entries = existing.entries || [];
        this.totalUSD = existing.totalUSD || 0;
      } catch {
        // Corrupted file — start fresh
        console.warn('  [WARN] Corrupted costs.json — starting fresh');
      }
    }
  }

  append(entry) {
    this.entries.push(entry);
    this.totalUSD = this.entries.reduce((sum, e) => sum + (e.costUSD || 0), 0);
    this.totalUSD = Math.round(this.totalUSD * 10000) / 10000;
    this._scheduleWrite();
  }

  _scheduleWrite() {
    this._queue.push(true);
    if (!this._writing) this._flush();
  }

  _flush() {
    if (this._queue.length === 0) {
      this._writing = false;
      return;
    }
    this._writing = true;
    this._queue.length = 0;
    fs.mkdirSync(path.dirname(COSTS_FILE), { recursive: true });
    fs.writeFileSync(COSTS_FILE, JSON.stringify({
      entries: this.entries,
      totalUSD: this.totalUSD,
    }, null, 2));
    if (this._queue.length > 0) {
      this._flush();
    } else {
      this._writing = false;
    }
  }
}

// ---------------------------------------------------------------------------
// Concurrency pool
// ---------------------------------------------------------------------------

async function pooled(tasks, concurrency) {
  const results = new Array(tasks.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < tasks.length) {
      const i = nextIndex++;
      results[i] = await tasks[i]();
    }
  }

  const workers = [];
  for (let w = 0; w < Math.min(concurrency, tasks.length); w++) {
    workers.push(worker());
  }
  await Promise.all(workers);
  return results;
}

// ---------------------------------------------------------------------------
// CLI + main
// ---------------------------------------------------------------------------

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    models: ['gpt-4o-mini'],
    langs: ALL_LANGS,
    conditions: ['naive', 'register', 'domain'],
    dryRun: false,
    resume: false,
    concurrency: 3,
    // Per-language register preset overrides (mirrors FLORES harness)
    registerOverrides: null,
    // Global prompt context from --config or --prompt-context
    promptContext: null,
    configPath: null,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--models':
        opts.models = args[++i].split(',');
        break;
      case '--langs':
        opts.langs = args[++i].split(',');
        break;
      case '--condition':
        const val = args[++i];
        opts.conditions = val === 'all' ? ['naive', 'register', 'domain'] : [val];
        break;
      case '--dry-run':
        opts.dryRun = true;
        break;
      case '--resume':
        opts.resume = true;
        break;
      case '--concurrency':
        opts.concurrency = parseInt(args[++i], 10);
        break;
      case '--prompt-context':
        opts.promptContext = args[++i];
        break;
      case '--register': {
        const regVal = args[++i];
        if (regVal.startsWith('{')) {
          try {
            opts.registerOverrides = JSON.parse(regVal);
          } catch (e) {
            console.error(`[ERR] Invalid JSON for --register: ${e.message}`);
            process.exit(1);
          }
        } else {
          opts.registerOverrides = regVal;
        }
        break;
      }
      case '--config': {
        const configFile = args[++i];
        if (!fs.existsSync(configFile)) {
          console.error(`[ERR] Config file not found: ${configFile}`);
          process.exit(1);
        }
        try {
          const champollionConfig = JSON.parse(fs.readFileSync(configFile, 'utf-8'));
          opts.configPath = configFile;

          if (!opts.promptContext && champollionConfig.promptContext) {
            opts.promptContext = champollionConfig.promptContext;
          }

          if (!opts.registerOverrides && champollionConfig.languages) {
            const langs = champollionConfig.languages;
            if (typeof langs === 'object' && !Array.isArray(langs)) {
              const overrides = {};
              for (const [code, value] of Object.entries(langs)) {
                const canonical = resolveCode(code);
                if (typeof value === 'string') {
                  overrides[canonical] = value;
                } else if (typeof value === 'object' && value.register) {
                  overrides[canonical] = value.register;
                }
              }
              if (Object.keys(overrides).length > 0) {
                opts.registerOverrides = overrides;
              }
            }
          }
        } catch (e) {
          console.error(`[ERR] Failed to parse config: ${e.message}`);
          process.exit(1);
        }
        break;
      }
    }
  }

  return opts;
}

function resultExists(modelName, condition, langCode) {
  const file = path.join(RESULTS_DIR, 'raw', modelName, condition, `${langCode}.json`);
  return fs.existsSync(file);
}

async function main() {
  const opts = parseArgs();
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey && !opts.dryRun) {
    console.error('[ERR] OPENROUTER_API_KEY not set');
    process.exit(1);
  }

  // Load source strings
  const enPath = path.join(SOURCE_DIR, 'en.json');
  if (!fs.existsSync(enPath)) {
    console.error('[ERR] Source strings not found. Run extract_ui_strings.js first.');
    process.exit(1);
  }
  const strings = JSON.parse(fs.readFileSync(enPath, 'utf-8'));

  // Load metadata
  const metaPath = path.join(UI_BENCH_DIR, 'metadata.json');
  const metadata = fs.existsSync(metaPath) ? JSON.parse(fs.readFileSync(metaPath, 'utf-8')) : {};

  // Validate models
  for (const m of opts.models) {
    if (!MODELS[m]) {
      console.error(`[ERR] Unknown model: ${m}`);
      console.error(`   Available: ${Object.keys(MODELS).join(', ')}`);
      process.exit(1);
    }
  }

  // Build work plan
  const modelPlans = {};
  let totalRuns = 0;
  let skippedRuns = 0;

  for (const modelName of opts.models) {
    modelPlans[modelName] = [];
    for (const condition of opts.conditions) {
      for (const lang of opts.langs) {
        if (opts.resume && resultExists(modelName, condition, lang)) {
          skippedRuns++;
          continue;
        }
        modelPlans[modelName].push({ condition, lang });
        totalRuns++;
      }
    }
  }

  // Report plan
  const stringCount = Object.keys(strings).length;
  const batchesPerRun = Math.ceil(stringCount / BATCH_SIZE);

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  champollion-bench: UI String Benchmark');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`  Dataset:         ui-bench (Signal Desktop)`);
  console.log(`  Strings:         ${stringCount}`);
  console.log(`  Batch size:      ${BATCH_SIZE}`);
  console.log(`  Models:          ${opts.models.join(', ')}`);
  console.log(`  Conditions:      ${opts.conditions.join(', ')}`);
  console.log(`  Languages:       ${opts.langs.join(', ')}`);
  console.log(`  Total runs:      ${totalRuns}${skippedRuns > 0 ? ` (${skippedRuns} skipped)` : ''}`);
  console.log(`  API requests:    ~${totalRuns * batchesPerRun} (before splits)`);
  console.log(`  Resume mode:     ${opts.resume ? 'ON' : 'OFF'}`);
  console.log('═══════════════════════════════════════════════════════\n');

  if (opts.dryRun) {
    console.log('DRY RUN — no API calls will be made.\n');
    for (const [modelName, runs] of Object.entries(modelPlans)) {
      console.log(`  ${modelName}: ${runs.length} runs`);
      for (const { condition, lang } of runs) {
        console.log(`    → ${condition} / ${lang}`);
      }
    }
    return;
  }

  // Execute
  const costLedger = new CostLedger();
  let completed = 0;
  const startTime = Date.now();

  const modelPipelines = Object.entries(modelPlans).map(([modelName, runs]) => {
    if (runs.length === 0) return Promise.resolve();

    const langTasks = runs.map(({ condition, lang }) => {
      return async () => {
        const runStart = Date.now();
        process.stderr.write(`\n  → ${modelName} / ${condition} / ${lang}:`);

        // Resolve register override for this language
        const presetOverride = opts.registerOverrides
          ? (typeof opts.registerOverrides === 'string'
            ? opts.registerOverrides
            : opts.registerOverrides[lang] || undefined)
          : undefined;

        const stats = await benchmarkOneLang(
          modelName, MODELS[modelName], condition, lang, strings, metadata, apiKey,
          presetOverride, opts.promptContext
        );

        if (!stats) return null;

        completed++;
        const elapsed = ((Date.now() - runStart) / 1000).toFixed(0);

        costLedger.append({
          model: modelName,
          condition,
          language: lang,
          timestamp: new Date().toISOString(),
          inputTokens: stats.inputTokens,
          outputTokens: stats.outputTokens,
          costUSD: stats.costUSD,
        });

        console.log(
          `\n  ✓ [${completed}/${totalRuns}] ${modelName} / ${condition} / ${lang}` +
          ` — ${stats.translatedStrings}/${stats.totalStrings} strings` +
          ` — $${stats.costUSD.toFixed(4)}` +
          ` — ${elapsed}s` +
          ` (total: $${costLedger.totalUSD.toFixed(4)})`
        );

        return stats;
      };
    });

    console.log(`[INFO] Starting ${modelName} — ${runs.length} runs`);
    return pooled(langTasks, opts.concurrency);
  });

  await Promise.all(modelPipelines);

  const totalElapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  Benchmark complete.');
  console.log(`  Total cost:    $${costLedger.totalUSD.toFixed(4)}`);
  console.log(`  Total time:    ${totalElapsed} minutes`);
  console.log(`  Results:       ${RESULTS_DIR}/raw/`);
  console.log('═══════════════════════════════════════════════════════\n');
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
