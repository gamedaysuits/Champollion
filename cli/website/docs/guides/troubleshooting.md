---
sidebar_position: 6
title: Troubleshooting
---

# Troubleshooting

Common issues and solutions for champollion.

## API & Authentication

### "OPENROUTER_API_KEY not found"

Champollion requires an API key for LLM translation. Set it as an environment variable:

```bash
export OPENROUTER_API_KEY="sk-or-v1-..."
```

Or in a `.env` file (if your project loads `.env` files):

```
OPENROUTER_API_KEY=sk-or-v1-...
```

:::tip
If you only have a Google Translate API key, champollion auto-detects and uses Google Translate as the default method. No config change needed.
:::

### "401 Unauthorized" from OpenRouter

Your API key is invalid or expired. Verify it at [openrouter.ai/keys](https://openrouter.ai/keys).

### "429 Too Many Requests" / Rate Limiting

Champollion handles rate limits internally with exponential backoff. If you consistently hit rate limits:

1. **Reduce batch size** in your config:
   ```json
   { "batchSize": 15 }
   ```
2. **Use a model with higher rate limits** (e.g., `google/gemini-3.8-flash` has generous limits)
3. **Use a cheaper/faster method** for high-volume pairs — Google Translate has no rate limits:
   ```json
   { "pairs": { "en:it": { "method": "google-translate" } } }
   ```

### Model Not Found / 404 Errors

Direct LLM providers (`openai`, `anthropic`, `gemini`) are sent their own names for models. An OpenRouter-format id of their own vendor is mapped for you (`google/gemini-3.8-flash` → `gemini-3.8-flash` on `gemini`). If the run stops with:

**"is an OpenRouter model id … which has no model by that name"** — You're using an OpenRouter-format model from another vendor (`google/gemini-3.8-flash` with `openai`). Nothing was sent. Name a model of that provider, use the method that has the model, or switch to the `llm` method to use OpenRouter — the message names each, and where the model was set:

```diff
- { "method": "openai", "model": "google/gemini-3.8-flash" }
+ { "method": "openai", "model": "gpt-4o" }
```
```json
{ "method": "llm", "model": "google/gemini-3.8-flash" }
```

They also check your model name on first use. If you see a warning:

**"is an Anthropic/OpenAI/Gemini model"** — You're sending a model to the wrong provider:

```diff
- { "method": "gemini", "model": "claude-sonnet-4-6" }
+ { "method": "anthropic", "model": "claude-sonnet-4-6" }
```

**"not found in available models"** — The model may be deprecated or misspelled. Champollion fetches the provider's live model list and suggests alternatives. Check the provider's docs for current model names.

:::tip[Model deprecation happens]
Providers retire model names regularly. If translations suddenly fail after a provider update, check the `[WARN]` output — it will show you current alternatives.
:::

### `local`: "could not reach …"

The `local` method sends requests to an OpenAI-compatible server on your machine (Ollama, vLLM, LM Studio, llama.cpp). When it cannot connect, the error names the address it tried and the setting that chose it:

```text
[ERR] Local (OpenAI-compatible) Batch 1 failed: fetch failed (ECONNREFUSED) — could not reach http://localhost:8000/v1 (from LOCAL_API_BASE in .env)
```

The address comes from the first of these that is set, in the environment or in `.env.local` / `.env`: `LOCAL_API_BASE`, then `OPENAI_API_BASE`, then `OPENAI_BASE_URL`. With none set it is Ollama's default, `http://localhost:11434/v1`. Start the server, or fix the setting the message names.

## Translation Quality

### Translations echo the source language

The quality gate catches this. If a translation is identical to the English source, it's rejected and retried. If it persists:

1. **Check the model** — Some models perform poorly for specific language pairs
2. **Add register instructions** — Tell the model what language to produce:
   ```json
   {
     "languages": {
       "ja": { "name": "Japanese", "register": "Polite/formal Japanese" }
     }
   }
   ```
3. **Try a different model** — Switch from `gpt-4o-mini` to `gpt-4o` or `google/gemini-3.1-pro-preview`

### Wrong script output (e.g., Latin text for Japanese)

The quality gate's script compliance check catches most cases. If it persists:

- Verify the locale code is correct (`ja`, not `jp`)
- Add explicit script instructions in the `register` field:
  ```json
  { "register": "Japanese using hiragana, katakana, and kanji" }
  ```

### Names fail verification (e.g. "Curtis Forbes" in Japanese)

Names are correct in Latin script, so tell champollion what your names are:

```json
{ "protectedTerms": ["Curtis Forbes", "Game Day Suits"] }
```

The model is told to keep them as written, and a value made only of these names is never reported as untranslated or wrong-script. Without the list, a short Latin-script value in a non-Latin language gets one retry asking whether it is a name or a label. If the model keeps it, it is accepted as a name and cached, so it is never re-billed. You do not need `--no-verify`.

### Hallucination patterns in output

Repeated trigram patterns (e.g., "hello hello hello") are caught by the hallucination loop detector. If output is garbled but passes the detector:

1. **Reduce batch size** — Smaller batches produce more focused output
2. **Use a stronger model** — Larger models hallucinate less on non-Latin scripts
3. **Add coaching data** — Dictionary terms anchor the translation

## File & Format Issues

### "No locale files found"

Champollion auto-detects locale files. If it can't find them:

1. **Check `localesDir`** — Must point to the directory containing locale files:
   ```json
   { "localesDir": "./locales" }
   ```
2. **Check file naming** — Files must be named by locale code: `en.json`, `fr.json`, etc.
3. **Check format** — Supported formats: JSON, nested JSON, YAML, TOML

### Lock file conflicts

`.champollion.lock` records which English text each translation was made
from. Resolve a merge conflict in it like any generated file: keep either
side, run `npx champollion sync`, and commit the result.

:::warning[Deleting the lock does not re-translate anything]
Without the lock, sync cannot tell which English strings changed since the
existing translations were made. It translates only keys that are **missing**
from a target file, and records the current English as the new baseline. An
English string edited before the lock was deleted keeps its old translation,
silently. To rebuild a locale on purpose, use `--force` (scope it with
`--pair`); cached translations are reused, so only text the cache has never
seen is billed.
:::

### Retranslating specific keys

If individual translations are wrong and you want to force them to be re-translated without deleting the lock file:

```bash
# Re-translate a single key
npx champollion sync --force-keys "hero.title"

# Re-translate multiple keys
npx champollion sync --force-keys "nav.home,nav.about,footer.copyright"
```

The `--force-keys` flag overrides the lock file hash check for those specific keys, forcing re-translation without affecting any other keys. `--redo keys:hero.title` is the same thing under its newer name. Both are served from the Translation Memory when it holds the text; add `--fresh` to pay for a new translation instead. A key with a comma in it (a gettext msgid is a whole sentence) is written with `\,`, and the argument quoted for the shell: `--redo 'keys:Welcome back\, %(name)s!'`.

### `verify` reports a placeholder mismatch (or another damaged value)

`champollion verify` (and the check that runs after every sync) reports values that are damaged: a placeholder that was lost or renamed, a broken ICU plural, a value with its letters deleted. A plain `champollion sync` does **not** repair them. The value is already on disk and its lock entry says it is up to date, so sync leaves it alone.

Each finding names the command that repairs exactly those keys, for example:

```text
[ERR] [VERIFY] fr: 1 i18next {{…}} placeholder mismatch(es): greeting (placeholder {{name}} was changed to {{nom}}) — fix: `champollion sync --pair en:fr --redo keys:greeting`
```

Run that command. When a locale spans several files the keys are written `<file>::<key>` (for example `common::nav.home`), which re-translates that one file's key and no other.

You do not need `--fresh`. If the damaged value came from the Translation Memory, `verify` has already removed it from the cache, and it says so: `[TM] Evicted 1 cached translation(s) that produced damaged values`. The redo then translates the text again (or serves the cache's own, different translation of it) instead of serving the damage back. A value someone edited by hand is never cached, so nothing is removed for it, and the redo works the same way.

For Markdown/MDX content files, use `--retranslate` with a path or glob instead (e.g. `--retranslate docs/intro.md`). It translates those files fresh even if they are up to date or were translated by hand. Use `--files` to limit a run to some content files without forcing them.

### Content translation corrupts code blocks

This shouldn't happen — code blocks are shielded before translation. If it does:

1. Verify the code block uses standard fencing (triple backticks)
2. Check for unclosed code blocks in the source Markdown
3. File an issue — this is a bug in the sentinel shielding system

## CLI Issues

### `--watch` doesn't detect changes

File watching uses Node.js native `fs.watch`. Known issues:

- **Network drives** — `fs.watch` doesn't work reliably on NFS/SMB mounts
- **Docker volumes** — Use polling mode or run champollion inside the container
- **Large directories** — The watcher monitors `localesDir` recursively; very deep trees may exceed OS limits

### `npx` runs an old version

```bash
# Clear the npx cache
npx --yes champollion@latest sync
```

Or install globally:

```bash
npm install -g champollion
champollion sync
```

## Performance

### Sync is slow for many languages

Champollion translates all locales in parallel by default. If sync is still slow:

1. **Use Google Translate for high-volume pairs** — It's 10–50× faster than LLM translation
2. **Increase batch size** (default is 80):
   ```json
   { "batchSize": 120 }
   ```
3. **Tune concurrency** — JSON locale parallelism defaults to 200 and content to 48. If your API provider supports higher rate limits:
   ```bash
   npx champollion sync --json-concurrency 80 --content-concurrency 20
   ```
4. **Use a fast model** — `gpt-4o-mini` is significantly faster than `gpt-4o`

### High API costs

- **Check batch sizes** — Larger batches = fewer API calls = lower cost
- **Use Translation Memory** — TM is on by default. Run `champollion tm stats` to verify it's working. If you see 0 entries after multiple syncs, something may be wrong with your `.champollion/` directory permissions
- **Use prompt caching** — Champollion splits system/user messages for cache hits on Anthropic and Google models
- **Use Google Translate for Tier 2 languages** — See the [Translate 30 Languages](/docs/tutorials/translate-30-languages) cookbook

### Translations after switching model or provider

Switching method (e.g., `llm` to `deepl`), register or coaching gives fresh translations for what is translated again, because the cache key includes them — but a plain sync re-translates nothing that is already done: `champollion sync --redo all` does. Switching **model** within the same method reuses what the previous model translated, at no cost; sync tells you so before the estimate. If you want the new model's own translations:

```bash
# Have the new model translate what an earlier model wrote
# (what the new model already translated still comes from the cache)
champollion sync --redo all --fresh-on-model-change

# Re-translate specific content files from scratch
champollion sync --retranslate "docs/guides/**"
```

`--fresh-on-model-change` on its own changes only the keys a run translates anyway (new or changed ones): after a switch of model alone, a plain `sync --fresh-on-model-change` sends nothing.

See [Translation Memory](/docs/concepts/translation-memory) for details on cache key design.

## Recovering From a Bad Version {#recover-old-damage}

Values written by an older pipeline **never self-heal**: their manifest hashes match the current source, so `sync` considers them settled and no gate ever sees them again. If you're upgrading a project that ran pre-0.3.0 versions, assume damage may be sitting in your locale files and audit first:

```bash
champollion integrity
```

The audit detects the known damage signatures and names the fix for each:

| Finding | What it is | Fix |
|---------|-----------|-----|
| `UNEXPECTED PUA` | Script conversion output (pIqaD/Tengwar/Kryptonian) written when conversion wasn't wanted — renders blank | `champollion repair-script` (offline, exact for pIqaD) |
| `HOLLOWED VALUES` | The source with its letters deleted — output from before the content-preservation gate | Re-translate (see below) |
| `NO-TRANSLATE DRIFT` | A URL or other verbatim key that was "translated" | `champollion sync` (repaired free, automatically) |

For hollowed values — or any locale you simply no longer trust — rebuild it:

```bash
champollion sync --pair en:tlh --force
```

`--force` re-queues every source key for the scoped pair(s). Translation Memory hits are still served, but every served hit is **validated against the current gates first** — a cached value the gate now rejects is evicted and re-billed, so a poisoned cache heals itself rather than feeding the rebuild. Add `--no-tm` if you want a fully fresh re-bill regardless, and `--max-cost` to cap the spend either way.

Post-sync verification also reports these signatures, so a damaged locale fails `sync` loudly (with the fix named) instead of shipping quietly.

### A one-time requeue after `--no-tm` cleanups {#one-time-requeue}

If your recovery used `--no-tm`, expect the **next** sync to queue a batch of source-echo keys you thought were settled. `--no-tm` writes values without stamping them into the Translation Memory, and an *unstamped* value identical to its source is indistinguishable from an untranslated one — so it re-queues once, comes back (often identical), gets stamped, and settles permanently. This is a one-time cost, not a loop. Preview exactly which keys with:

```bash
champollion sync --dry --list-keys
```

## Still Stuck?

- **[GitHub Issues](https://github.com/gamedaysuits/champollion/issues)** — Search existing issues or file a new one
- **[Architecture Docs](/docs/concepts/architecture)** — Understand the system design
- **[Quality Gate](/docs/concepts/quality-gate)** — How validation works under the hood
