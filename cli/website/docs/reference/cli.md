---
sidebar_position: 1
title: CLI Reference
related:
  - label: "Quick Start"
    to: /docs/getting-started/quick-start
    kind: guide
  - label: "Configuration"
    to: /docs/getting-started/configuration
    kind: reference
  - label: "CI/CD"
    to: /docs/guides/ci-cd
    kind: guide
  - label: "Troubleshooting"
    to: /docs/guides/troubleshooting
    kind: guide
---

# CLI Reference

## Commands

```
champollion init              Interactive setup wizard (--yes for quick defaults)
champollion sync              Translate & sync all locale files
champollion watch             Auto-sync when the source file changes
champollion audit             List untranslated and out-of-date translations (CI completeness gate)
champollion lint              Scan source code for hardcoded strings
champollion wrap              Auto-wrap hardcoded strings in t() calls (with undo)
champollion seo <sub>         Generate hreflang, sitemap.xml, or JSON-LD schema
champollion integrity         Audit locale files for format/encoding issues
champollion repair-script     Restore romanization where script conversion was unwanted
champollion verify            Verify translations are present and correct (CI gate)
champollion status            Show pair configuration, plugins, and benchmark scores
champollion provenance        Audit translation resource licensing
champollion plugin <sub>      Manage method plugins (install, remove, list)
champollion fonts <sub>       Download web fonts for PUA script converters
champollion tm <sub>          Manage Translation Memory cache (stats, clear, seed, prune)
champollion xliff <sub>       Export/import XLIFF 1.2 for professional review
champollion models            List available models from a provider (--method <provider>)
champollion models check      Check every default model against the providers' live lists (free)
champollion doctor            System health check (cards, config, FSTs, API keys, methods)
```

The commands that work with the shared index and leaderboard, rather than your
project, are grouped under `champollion network`. Each also works without the
prefix:

```
champollion network card <code>        What the index knows about a language (--json for raw output)
champollion network recommend <s> <t>  Methods you can run for a pair, with the evidence for each, and open models that declare the target (or one pair: eng-crk)
champollion network leaderboard        Published results; install a proven method (--install, --apply)
champollion network register-corpus    Register a test set without handing it over (local-only/private/public/sealed)
champollion network seal-corpus <sub>  Sealed-tier crypto verbs: keygen / seal / open (organizer-node bridge)
champollion network submit             Propose an index entry (review-gated): prints a pre-filled GitHub issue
```

Run `champollion <command> --help` for detailed help on any command
(`champollion network` lists the network commands).

## Global Options

```
--help, -h              Show help (global or per-command)
--version, -v           Print version and exit
--yes, -y               Skip interactive prompts, use defaults
--config <path>         Custom config file path
--dir <path>            Override locales directory
--content-dir <path>    Folder of Markdown/MDX to translate (a Hugo content/ or any folder); each translation is written beside its source as <name>.<locale>.md
--source <code>         Override source locale (default: en)
--model <model>         Translation model for this run only (an exact model slug; aliases and floating "-latest" ids are refused); the config is not changed — to switch for good, edit "model" in champollion.config.json
--method <method>       Translation method for this run only: llm, llm-coached, local, openai, anthropic, gemini, google-translate, deepl, … Overrides the config, including a pair's own method (sync says which); scope with --pair. To switch for good, edit "defaultMethod" (or the pair's "method")
--temperature <n>       LLM temperature (0.0–2.0, default: 0.3)
--coaching-file <path>  Path to free-text coaching prompt file (injected into system prompt)
--format <fmt>          Locale file format: json, toml, yaml, po, arb, or auto
--dry, --dry-run        Preview changes without writing files
--list-keys             With --dry: name every queued key per reason
--concurrency <n>       Max parallel API calls (sets both JSON and content, default: 48)
--json-concurrency <n>  Max parallel locale translations for JSON keys (default: 200)
--content-concurrency <n> Max parallel API calls for content translation (default: 48)
--redo <scope>          Translate again: all | keys:<k1,k2> | content | files:<glob> (repeatable). Cached text is still served, so a redo is cheap. gaps: every plural message on disk without a form its language uses for ordinary counts — asked from the model, not the cache
--prune plural-extras   sync: remove i18next plural keys for a form the language does not have (Spanish count_two) — only those, each one listed; never without this flag
--fresh                 Don't use the cache for what is queued — it is billed again
--files <glob>          Only these content files this run (repeatable; e.g. docs/intro.md, "posts/**")
--force                 Same as --redo all (whole-locale rebuild; scope with --pair)
--force-keys <keys>     Same as --redo keys:<keys> (namespace::key for one file of a multi-file language; \, for a comma inside a key; ctx\x04msgid — or ctx␄msgid — for a gettext entry with a context)
--force-content         Same as --redo content
--retranslate <glob>    Same as --redo files:<glob> --fresh (bypasses the lock and the cache — billed — and replaces paragraphs a person edited in the named files)
--no-tm                 Same as --fresh
--fresh-on-model-change Don't reuse the previous model's cached translations for what this run translates; with --redo all, the new model translates what an earlier model wrote
--pair <src:tgt>        Only these pairs this run, comma-separated (e.g. en:fr,en:de; en>fr and en-fr work too); unknown pairs fail loud (sync, verify, serve)
--max-cost <usd>        sync: stop before any API call if the estimated cost is over this USD cap, or unknown (exit 2, nothing spent)
--no-verify             Skip post-sync verification pass
--strict                verify: warnings fail the check too (exit 1)
--script <choice>       init: writing system of a language with two real orthographies, e.g. crk=Cans
--name <code=name>      init: display name of a language with no card (a private-use code), e.g. qaa="Ayta (variety not yet confirmed)"
--locale <code>         Target locale (xliff export, tm clear)
--quiet                 Errors and warnings only — suppress banner, progress bar, and info lines
--json                  Machine-readable NDJSON output — one JSON object per event
```

### Writing a language pair

A project pair is written the way `champollion.config.json` keys it: `en:fr`. `sync`, `verify` and `serve` also read `en>fr` and `en-fr`, and `en-pt-BR` is matched against the pairs you configured. The network commands (`network register-corpus`, `leaderboard`, `recommend`, `submit`) write a pair `eng>crk`, the form the leaderboard stores and `mt-eval` uses, and read `eng-crk` and `eng:crk` the same way. With hyphens only, a pair is two codes of two or three letters (`eng-crk`). A code with its own hyphen needs `>`: `--pair "eng>pt-BR"`. `eng-pt-BR` is refused, never guessed. Quote the `>` form in a shell: unquoted, `--pair eng>crk` sends the output to a file named `crk`.

---

## init

Interactive setup wizard that creates `champollion.config.json`. Guides through source locale, target languages, file format, and translation model.

```bash
champollion init                          # interactive wizard
champollion init --yes                    # skip wizard, use defaults
champollion init --yes --langs fr,de,ja   # quick setup with specific languages
champollion init --source en --dir ./i18n # overrides with defaults
champollion init --yes --langs crk --content-dir newsletters  # also translate a folder of Markdown
champollion init --yes --langs abc --method api --endpoint http://127.0.0.1:8378/translate --accepts-instructions false
```

**`--content-dir` option**: A folder of Markdown/MDX files to translate as well as your locale files (written as `contentDir`). The folder must exist; `init` stops without writing anything if it does not.

**A project with a local-only file defaults to `local`**: The default method is `llm` (OpenRouter, a hosted service). When a file anywhere in the project is marked local-only — a `<file>.champollion.json` beside it with `"transmission": "local-only"`, as `champollion network register-corpus --data <file> --tier local-only` writes — `init` (with `--yes` too) defaults to the `local` method instead: a model served on this machine (Ollama's default `http://localhost:11434/v1`, or the server `LOCAL_API_BASE` names). It says why, naming the marked file, and how to choose a hosted method deliberately: `champollion init --force --method llm --model <model>`. An explicit `--method` always wins; `init` then notes the marked file beside where the text goes.

**Running `init` again (`--force`)**: Without `--force`, `init` stops when `champollion.config.json` exists. With it, `init` starts from that file and rewrites only what the flags name: `--langs` sets the target list (a language already there keeps its entry — register, script, name), `--method` the default method (and the model with it, unless `--model` names one), `--model`, `--temperature`, `--source`, `--dir`, `--format`, `--content-dir`, `--script`, `--name`, and `--method api` the pairs it names. It re-detects the locale layout only when the file no longer finds your source files (or `--dir` names another folder). Every other setting — `batchSize`, `pairs`, `glossary`, fallbacks, registers you chose — stays as it was. It prints each field it changed and the ones it kept, and copies the previous file to `champollion.config.json.bak` first (when that backup already holds an older file, the next one is `.bak.2`, `.bak.3` …; an older backup is never overwritten). A file that is not valid JSON cannot be kept: it is backed up and a new one written. To change one setting, edit it in the file — `init` never needs to run again for that.

**Finding your locale files**: `init` looks for your source language's file before it writes anything. It checks your framework's usual folder first (next-intl `messages/`, i18next `public/locales/<lang>/` then `locales/<lang>/`, vue-i18n `src/locales/`, Hugo `i18n/`), then `locales`, `messages`, `i18n`, `lang`, `translations`, `public/locales`, `src/locales` and `src/i18n`, and prints what it found. It never writes a `localesDir` that does not exist. See [Locale File Layouts](/docs/getting-started/configuration#locale-layouts).

**`--langs` option**: Comma-separated list of target language codes. Skips the language prompt and applies each language's default register preset — written into the config, so the choice is visible and editable: `"languages": { "fr": "formal-vous", "es": "neutral-latam" }` (change one to another preset, or to your own words describing the tone; a language with no presets is written as `{}`). It also creates the empty target files in your layout (`fr.json`, or `fr/common.json` for each namespace). Combine with `--yes` for fully non-interactive setup.

**`--method api --endpoint <url>`**: A server speaking the champollion API contract — for example a model you trained, served by `nmt-forge serve`. `init` writes one pair per target, the same entry as the `DEPLOY.md` beside the model: `"pairs": { "en:abc": { "method": "api", "endpoint": "http://127.0.0.1:8378/translate", "acceptsInstructions": false } }`. `--accepts-instructions true|false` says whether the endpoint follows per-key instructions (a model trained with nmt-forge does not); without it, `init` takes the value from an installed plugin manifest for the same endpoint (`.champollion/methods/<name>/method.json`), or leaves it unstated. It needs `--langs` (the endpoint is set per pair), and a key only for an endpoint off this machine (`CHAMPOLLION_API_KEY`). Add a `fallback` method to the pair by hand, as `DEPLOY.md` shows.

**`--script` option**: A few languages are written in more than one real orthography — Plains Cree (`crk`: `Latn` = Standard Roman Orthography, `Cans` = Syllabics), Serbian (`sr`: `Latn`, `Cyrl`). Champollion does not choose one for a community: `sync` refuses to translate such a language until the config names one. The wizard asks; with `--yes`, pass `--script crk=Cans` (several: `--script crk=Cans,sr=Latn`; with a single target language `--script Cans` is enough), which writes `"languages": { "crk": { "script": "Cans" } }`. Without it, `init --yes` says which languages need a choice, lists the choices, and prints the `"script"` line to add to that language's entry in the config.

**`--name` option**: A private-use code (`qaa`–`qtz`, for a variety with no confirmed code) has no language card, so `init` says so instead of asking you to check the spelling. `--name qaa="Ayta (variety not yet confirmed)"` gives it the display name prompts and reports use, written as `"languages": { "qaa": { "name": "Ayta (variety not yet confirmed)" } }` (several: `--name "qaa=…;qab=…"`). Next to each register, `init` also prints the gender guidance LLM prompts carry for the language ([Gender guidance](/docs/getting-started/configuration#gender-guidance)).

**Language presets**: When prompted for target languages, you can type preset names:
- `european` → fr, de, es, it, pt, nl
- `asian` → ja, zh, ko
- `global` → fr, es, de, ja, zh, ko, pt, ar
- `nordic` → da, fi, nb, sv

Mix presets and individual codes: `european, ja` → fr, de, es, it, pt, nl, ja

---

## sync

Translates missing and stale keys across all locale files. Runs post-sync verification by default.

```bash
champollion sync                                   # translate everything
champollion sync --dry-run                         # preview only
champollion sync --dry --list-keys                 # preview AND name every queued key
champollion sync --redo keys:hero.title            # translate one key again (cache still serves)
champollion sync --redo "keys:a.title,a.subtitle"   # several keys
champollion sync --redo 'keys:Welcome\, %(name)s'  # a key with a comma in it (gettext)
champollion sync --pair en:tlh --redo all           # rebuild one whole locale
champollion sync --pair en:tlh --redo all --fresh   # ...bypassing a suspect cache (billed)
champollion sync --redo content                     # re-process all Markdown/MDX (cached text is free; reviewers' edits are kept)
champollion sync --files "docs/guides/**"           # only these content files
champollion sync --redo files:docs/intro.md --fresh # translate one file from scratch (billed)
champollion sync --redo gaps                        # ask again for plural forms a model left out
champollion sync --prune plural-extras              # remove plural keys for forms a language does not have
champollion sync --content-dir ./newsletters       # include a folder of Markdown (Hugo content/ or any folder)
champollion sync --method google-translate          # force Google Translate
champollion sync --concurrency 20                  # 20 parallel API calls (both phases)
champollion sync --json-concurrency 30              # 30 parallel locale translations (JSON)
champollion sync --content-concurrency 8            # 8 parallel content translations
champollion sync --no-verify                        # skip post-sync verification
champollion sync --no-tm                            # skip cache, fresh API calls
```

**Translation Memory**: By default, `sync` loads `.champollion/tm.json` and serves cached translations for unchanged source values. Switching model does not throw that away: text already translated under the previous model is reused at no cost, and sync says so before the cost estimate. To have the new model translate them instead: `--redo all --fresh-on-model-change` — it sends the keys an earlier model translated, and what the new model already translated still comes from the cache (on its own, `--fresh-on-model-change` affects only keys the run translates anyway). Use `--no-tm` to bypass the cache entirely (useful when debugging quality). See [Translation Memory](/docs/concepts/translation-memory).

**Cost estimate and `--max-cost`**: The estimate prices only what the run will bill. Keys, front-matter fields and Markdown blocks already in the Translation Memory are priced at $0, and the table shows what the cache saves. A model served on this machine (`local`, or an `api` endpoint, at `localhost`/`127.0.0.1`/`::1`) shows `$0 (local)` — no API bill; your hardware and power are not counted. `--max-cost` compares against that figure. Over the cap, or with no estimate (a method with no published price, such as `local` pointed at another machine), sync stops before any API call and exits `2`; nothing is translated or written. The closing line says how many keys were sent to the model and how many came from the cache.

Under the table, one line gives the rate the figure was priced at and where it came from — for a hosted model, the price per 1M input and output tokens from OpenRouter's public price list, and when it was read (`Rate: google/gemini-3.8-flash $0.30 input / $2.50 output per 1M tokens — OpenRouter's price list, read 2026-10-04 14:02 UTC`); for a direct provider (`openai`, `anthropic`, `gemini`) the same list stands in for the provider's own price, and when the list cannot be read (or has no price for the model) a copy kept in champollion is used, with the date it was last checked and why; DeepL, Google and Microsoft from their published per-character price, with its date. It is an estimate: the line says how many tokens (or characters) per key it assumes, and the bill depends on the real lengths. With `--json`, the estimate carries the detail: each pair's `rate` and the run's `rates` (`inputPerMillion`, `outputPerMillion` or `perMillionChars`, `tokensPerKey`, `from`, `url`, `fetchedAt` or `verified`).

**Seeing the request**: `sync --dry --show-prompt [key]` prints the exact request the pair's method would be sent — the system and user messages (or, for an `api` endpoint, the request body), built by the method's own code, with API keys redacted — and sends nothing. With a key (named as `--redo keys:` names it: `verb␄Open`, `common::nav.home`; a gettext msgid with a comma can be given whole) it shows that key's request whether or not it is queued. When a real run would send nothing for it (it is up to date, served from the cache, or held back), it says so and names the `--redo keys:<key> --fresh` command that would send it. Without a key, it shows the first batch each file would send, or says that nothing would be sent. It is how to check that a gettext `msgctxt`, a `#.` comment or an ARB description reaches the model. Machine-translation engines (DeepL, Google…) are sent the source text alone; the preview says so. With `--json` each request is an `{"level": "event", "event": "request", …}` line.

**Dry runs**: `--dry` translates nothing and writes nothing, but it checks what the real run would check first: when a key the method needs is missing (`OPENROUTER_API_KEY`, `DEEPL_API_KEY`, …), it warns that the real run would stop and names the variable. It checks that the key is set, not that it works: nothing is sent, so a placeholder passes. It still exits `0` — a preview never fails (see [exit codes](#sync-exit-codes)). The same goes for `--max-cost`: a dry run does not stop at the cap, but when the estimate is over it (or unknown) it says, once, at the end, that the real run would stop there and exit `2`. With `--json` every line is one JSON object with a `level` (`info`, `ok`, `event` on stdout; `warn`, `error` on stderr), and the last stdout line is the summary, `{"level": "summary", "command": "sync", …}`, carrying `preflight: { ready, failures }`, with a cap `maxCost: { cap, estimatedCost, wouldStop, exitCode }`, and `realRun: { exitCode, wouldStop, reasons }` — the exit code the real run would end with, as far as a preview can tell (see [exit codes](#sync-exit-codes)). Run it with the flags the real sync uses (`--method`, `--model`): without them it checks the method the config names. A dry run's own exit code never fails a CI step, so its `--max-cost` warning says how to gate one: read `maxCost.wouldStop` (or `realRun.exitCode`) from the `--json` summary — for example `jq -e 'select(.level == "summary") | .preflight.ready and (.maxCost.wouldStop | not)'`. The [CI guide's check step](/docs/guides/ci-cd#check-before-sync) does that and, when it fails, prints why (`realRun.reasons`) instead of a bare `false`. The dry run's `totalPluralGaps` counts the plural messages on disk without a form the language uses that the real run would not ask for again, and `verify` is `{ "ran": false }` (nothing was written, so nothing was verified).

**Translating again**: `--redo` says *what* to translate again and `--fresh` says *whether to pay for it*. Without `--fresh`, anything the cache already holds comes back free (and still passes the quality gate); with it, everything queued is translated anew and billed. The older flags (`--force`, `--force-keys`, `--force-content`, `--retranslate`, `--no-tm`) still work and mean exactly what the table says.

**Scoping to files**: `--files` limits the content step to matching files, and `--redo files:<glob> --fresh` forces fresh translations for matching files (the one deliberate re-spend). Patterns match the paths sync prints (relative to the `contentDir`, `2026-10.md`) and the same path from the project root (`newsletter/2026-10.md`): `*` stays within a folder and `**` crosses folders. Both flags repeat. A pattern that matches no file stops the run before anything is spent. The key-value step is incremental already and runs as usual.

**Failures**: One content file failing does not stop the others. Files that succeeded are recorded and their translations cached, and the run ends with a list of failed files and what each was left as. A file line never reads `[OK]` when keys in it were not translated. The failure summary says, per key, what the next sync does: asks again (no usable answer), asks once more (pending from a redo), or holds it back (refused by the quality gate). Markdown blocks and front-matter fields the gate refused are held back the same way, per page; `--redo files:<page>` or `--redo content` asks again ([Quality Gate](/docs/concepts/quality-gate#refused-markdown-blocks-and-front-matter-fields)). The exit code is `0` (all good), `2` (partial: some work done, something failed, was held back or did not verify, a plural message was written without a form the language uses for ordinary counts — or stopped by `--max-cost` before spending anything) or `1` (nothing succeeded).

**Change detection**: champollion stores SHA-256 hashes in `.champollion.lock`. When source values change, the next sync automatically re-translates those keys. Commit the lock file so all developers share the baseline. The lock also records, per target locale, a fingerprint of each value sync wrote (so a value a person edited is recognised and kept by bulk redos — [Editing translations](/docs/guides/professional-translators#editing-key-value-files)), the keys a redo could not finish (**pending**: the next sync asks for them once more) and the keys the quality gate refused (**held back**: not re-sent to the same model on a plain sync — [Quality Gate](/docs/concepts/quality-gate#refused-keys-are-held-back)).

**Hand edits and redos**: `--redo all`, `--force` and a model switch keep values a person edited, and say which; `--redo keys:<key>` naming a key replaces it; a key whose source changed is translated again. A replaced edit is printed and appended to `.champollion-replaced-edits.jsonl` (tracked — commit it with the lock).

**gettext keys with a context**: a key is `msgctxt` + U+0004 + `msgid`. Reports print the separator as `␄`, which `--redo keys:` and `--force-keys` accept back; to type one, write `\x04`: `--redo 'keys:django::verb\x04Open'` (single quotes keep the backslash). Both spellings work. Repair commands print the `␄` form, followed by a shell comment that names `\x04`.

**A named key that matches nothing**: `--redo keys:` / `--force-keys` with a name no source key has (a typo, or a msgid that exists only with a context) fails with exit 1. The error lists the closest keys, including every context variant of that msgid, in both spellings. When none of the names match, nothing runs. When some match, those are redone, and then the run fails naming the rest.

**A named key served from the cache**: without `--fresh`, a redo serves what the cache holds (re-checked, at no cost) and says so, with the `--fresh` command that asks the model again and its cost.

**Parallelism**: Both JSON key translation and content translation run in parallel. JSON locales are translated simultaneously (default: 200 concurrent locales), with batches within each locale also parallelized (4 concurrent batches). Content translation (Markdown, MDX, blog posts) runs in a flat work-item pool (default: 48 concurrent API calls). Override with `--json-concurrency`, `--content-concurrency`, or `--concurrency` (sets both).

**Output**: Sync displays a version banner, format/framework detection, cost estimate, and per-locale progress bars:

```
champollion v0.1.0

[INFO] Detected format: json (auto)
[INFO] Source: en.json (2,847 keys)
[INFO] Pairs: es-MX:llm, fr:deepl

[INFO] es-MX.json — 2,847 missing
     ████████████████████████████████ 2,847/2,847 keys
[INFO] fr.json — 2,847 missing
     ████████████████████████████████ 2,847/2,847 keys
[OK] Synced 5,694 keys total.
```

Progress bars update in-place after each batch (~80 keys). Use `--quiet` for errors/warnings only, or `--json` for machine-readable NDJSON output. Both suppress the progress bar and banner. With `--json`, a `cost` event arrives before the `--max-cost` gate, a `file` event arrives for each content file and locale, and a `summary` closes every run.

### Exit codes {#sync-exit-codes}

| Code | A real run | A dry run (`--dry`) |
|------|------------|---------------------|
| `0` | Everything queued was translated and verified, or nothing was queued. | It ran — even when it says the real run would stop. |
| `2` | Partial: some work done, but something failed, was held back or did not verify, or a plural message was written without a form the language uses for ordinary counts. Also: `--max-cost` stopped the run before anything was sent. | Never. |
| `1` | Nothing succeeded, or the run could not start: a key the method needs is missing, a model server the run needs does not answer, a key named for a redo matches nothing, a `--files` pattern matches no file, or the config is invalid. | The dry run itself could not run: a key named for a redo matches nothing, a `--files` pattern matches no file, or the config is invalid. |

A dry run exits `0` on purpose: it is the preview you run before deciding, and a CI step that only looks must not fail. What the real run would do is in the dry run's last lines and in its `--json` summary: `preflight.ready: false` means the real run would stop before translating and exit `1` (`preflight.failures` says why); `maxCost.wouldStop: true` means it would stop at the cap and exit `2` (`maxCost.exitCode: 2`); `maxCost.exitCode: 1`, with `maxCost.stopsEarlier`, means the preflight would stop it before the cap is checked. `realRun.exitCode` puts them together, with what would leave the real run partial: keys held back, or plural messages on disk without a form the language uses that it would not ask for again (`2`; `realRun.reasons` names them, and the dry run's last line says so). A refusal by the quality gate or a failed verification, which only the real run can find, can still turn a predicted `0` into a `2`. The [CI guide's check step](/docs/guides/ci-cd#check-before-sync) turns them into a failing CI step that prints the reason.

---

## watch

Auto-sync when the source locale file changes. Runs until interrupted with `Ctrl+C`.

```bash
champollion watch
```

---

## audit

The completeness gate. Lists every key that is not translated — missing, empty, or still an `[EN]` fallback — and every translation that is **out of date**: made from an older source text than the current one (per `.champollion.lock`; a source edit whose re-translation failed leaves exactly this). Each out-of-date list ends with the command that re-translates it. Exits with code 1 if any are found — use as a CI gate to fail builds with incomplete or stale translations.

```bash
champollion audit
champollion audit --json   # summary carries untranslatedKeys and outOfDateKeys per locale
```

---

## verify

Re-reads all locale files from disk and verifies translations are actually present and correct. This is the same verification that runs automatically at the end of every `sync` (unless `--no-verify` is passed).

```bash
champollion verify                    # verify all locale files
champollion verify --warn-only        # non-blocking
champollion verify --strict           # warnings fail too
champollion verify && echo "All good" # CI gate
champollion verify --json             # one "verify" record per locale (NDJSON)
```

**What it checks:**
- Key parity — all source keys present in each target (for i18next plural keys, the keys of the locale's own CLDR plural forms: French needs `count_many` too)
- `[EN]` fallback markers from prior runs
- Empty translations
- Script compliance — a non-Latin locale must not hold Latin-only text; letters are classified by Unicode script, so accented and fullwidth Latin count as Latin. Fullwidth Latin letters are an error in any locale outside CJK typography
- Placeholders, each finding named by the syntax involved — ICU MessageFormat structure (`ICU structure error`: a `{name}` argument, a translated plural/select keyword or selector, a lost `#`), printf conversions (`printf/python-format placeholder mismatch`: `%s`, `%d`, `%(name)s` — a gettext catalog's lost `%(name)s` is named as printf, not ICU), i18next interpolation (`i18next {{…}} placeholder mismatch`: `{{name}}`, including `{{name}}` written as `{name}`, which i18next prints as is), and a single-brace `{name}` outside an ICU message (`{…} placeholder mismatch`)
- Markup — per tag name the same opening, closing and self-closing tags as the source, nested the same way (a lost `</strong>` is an error)
- Encoding issues — BOM markers, invisible characters
- Source echoes — values identical to source (warning)
- Plural forms — a plural message without a form the language uses for ordinary counts (Russian `few`/`many`), a gettext entry whose forms only repeat `other` (sync marks those with a `# champollion:` comment), an i18next key or `msgstr[n]` for a form the language does not have (warnings)
- Identical locales — two target locales with the same text for most keys: one is probably in the other's language (warning)
- Same text, different sources — one text written for several different source strings (a model repeating a memorized sentence): two clearly different multi-word strings answered with the same text of four or more words, or three or more otherwise; a sentence an earlier sync caught the model repeating counts even once. It is counted over key values, each ICU plural/select branch (the branches of one plural count as one source) and the locale's Markdown pages (front-matter fields and blocks; `# ` and end punctuation aside), by the same rule `sync`'s gate refuses it with (error)
- Out of date — a translation made from an older source text than the current one (warning here; `audit` fails on it)
- A dropped question or exclamation mark — the source ends with `?` or `!` and the translation ends with neither that nor the target script's equivalent (`？`, `؟`, Greek `;`, …). A warning: some languages mark a question with a word or particle instead

It checks structure, not meaning: a pass says the keys, placeholders, plurals,
markup and script are intact, not that the text says the right thing — have a
speaker review before relying on it.

**Which locales.** `verify` checks every locale; `verify --pair en:fr` checks
French only. After `sync --pair en:fr` the post-sync check covers the pairs
that ran, no others. A scoped check says so on its closing line — `Verification
passed for fr: … intact (only en:fr was synced; champollion verify checks every
locale)` — and never "in every locale"; with `--json` that line carries
`checked` (the locales checked) and `scope`.

**Plural coverage.** Each locale's block has one line per kind of plural its
files carry — i18next suffixed keys, ICU plural messages, gettext
`msgid_plural` entries — naming the forms the locale is expected to have
(CLDR's plural categories for it; in a gettext catalog, those its
`Plural-Forms` has a slot for) and whether every plural has them:

```text
  ── fr ──────────────────────────────────────
  [OK] 7/7 keys present
  Plural forms (CLDR fr): one, many, other ✓ — 2 i18next plural key group(s), every form present
```

`✗` names the plurals that lack a form. A form only numbers above 1000 or
fractions use (French `many` in an ICU message) is said apart: the `other`
form stands in for it, which is not a finding. The line is a summary — a
missing form is also a finding above it (a missing key, a plural warning).

**`--json`** writes one JSON object per line. Each locale gets a record on
stdout — `{"level": "event", "event": "verify", "locale": "fr", …}` — with
`ok`, `keys` (`expected`, `present`, `missing`, `extra`), its `errors`,
`warnings` and `infos`, `placeholders` (each finding with its `syntax`: `icu`,
`printf`, `i18next`, `brace` or `markup`) and `plurals` (per kind and type:
`categories`, `total`, `complete`, `incomplete`). The findings are also
`error`/`warn` lines on stderr, and the closing line keeps its level and
message (`ok` on stdout when the check passes, `error` on stderr when it does
not) and carries the `errors` and `warnings` counts. After a sync, the same
records come before the sync's own summary. (A Docusaurus project's records
carry no `keys` or `plurals`: its UI strings are checked file by file.)

```bash
npx champollion verify --json 2>/dev/null | jq -c 'select(.event == "verify") | {locale, plurals}'
```

**Exit code:** `1` when it found an error — or when it could check nothing at
all (the source file or the locales folder is not where the config points;
the error line names the path and the setting), `0` otherwise. Warnings do not
fail it unless you pass `--strict`, which exits `1` on any warning (a CI that
must not ship, say, Russian plurals without their `few`/`many` forms) and ends
with a `[FAIL]` line, never an `[OK]` one; `--warn-only` makes errors exit `0`
too. A locale whose key count is off says so instead of `[OK]`:
`8 expected, 9 present (1 extra: count_two)`.

---

## lint

Scans source code for hardcoded user-facing strings that should use i18n translation calls. Auto-detects your framework (next-intl, react-i18next, vue-i18n, Hugo).

```bash
champollion lint                    # exits 1 if issues found (or no source files were found)
champollion lint --warn-only        # always exits 0
champollion lint --src ./app        # custom source directory
champollion lint --min-length 4     # minimum string length to flag
```

**What it detects:**
- Hardcoded strings in JSX text, `placeholder`, `alt`, `aria-label`, `title`
- Files with user-facing content but no i18n framework import
- Dead keys — locale keys that no source file references
- Coverage score — percentage of strings going through i18n

**Exclusions**: Create `.champollionignore` in your project root (glob patterns, like `.gitignore`).

**Nothing to lint is a failure**: when no source file matches (the framework's default folders — `src/`, `app/`, `pages/`, `components/` for web projects — or your `--src`), lint exits `1` and names the folders and extensions it looked for. A lint that checked nothing must not pass a CI gate; point it at your code with `--src <dir>` or `"lint": { "srcDir": "<dir>" }`.

---

## wrap

Auto-wraps hardcoded strings detected by `lint` in `t()` calls. Creates automatic backups before modifying files.

```bash
champollion wrap                    # auto-wrap with backup
champollion wrap --dry              # preview wrapping changes
champollion wrap --undo             # restore from .champollion-backup/
```

**Safety gates:**
1. Git-clean check (skipped in dry-run)
2. Automatic backup to `.champollion-backup/`
3. Diff preview before each file write
4. `--undo` support to restore from backup

---

## seo

Generate SEO artifacts for multilingual sites.

```bash
champollion seo hreflang                                        # print hreflang tags
champollion seo sitemap --base-url https://example.com --out sitemap.xml
champollion seo jsonld --base-url https://example.com           # JSON-LD schema
```

| Subcommand | Output |
|------------|--------|
| `hreflang` | `<link rel="alternate" hreflang>` tags |
| `sitemap` | Multilingual `sitemap.xml` |
| `jsonld` | JSON-LD WebSite language schema |

---

## integrity

Detects corruption and drift in translated locale files.

```bash
champollion integrity               # exits 1 if issues found
champollion integrity --warn-only   # non-blocking
```

**What it checks:**
- Placeholder corruption (e.g., `{name}` present in source but missing in target)
- Encoding issues (mojibake, invalid Unicode)
- Untranslated copies (target value identical to source) — [`noTranslate`](/docs/getting-started/configuration#no-translate) keys are exempt, and so are echoes the Translation Memory confirms as pipeline-produced and gate-approved. What remains flagged is exactly what `sync` would requeue — the two tools cannot disagree about a healthy file
- No-translate drift (a `noTranslate` key that is *not* identical to the source) — reported with expected/actual values and invisible characters escaped; run `champollion sync` to repair
- Unexpected PUA (Private Use Area codepoints in a locale whose [script conversion](/docs/getting-started/configuration#script-conversion) is off — renders blank without a special font); run `champollion repair-script` to repair
- Hollowed values (a target that is its source with the letters deleted — damage from a pipeline older than the content-preservation gate); re-translate with `sync --force-keys <key>` or `sync --pair <pair> --force`
- Orphaned keys (keys in target that don't exist in source)
- ICU MessageFormat plural category completeness (e.g., Arabic needs 6 categories) — by the same rule `sync` and `verify` use: a missing form that ordinary counts reach (Russian `few`/`many`) is a warning; one that only numbers above 1000 or fractions reach (French `many`, used for 1 000 000) is a note, since the `other` form is used there

---

## repair-script

Reverses script conversion that should never have happened: PUA-encoded values (pIqaD, Tengwar, Kryptonian) in locales whose configuration says conversion is off are restored to romanization via the converter's own reverse table.

```bash
champollion repair-script --dry     # preview
champollion repair-script           # repair in place
```

| Option | Effect |
|--------|--------|
| `--dry` | Preview repairs without writing |
| `--locale <code>` | Repair only one locale |
| `--json` | Machine-readable JSON output |
| `--warn-only` | Exit 0 even if unreversible PUA remains |

pIqaD reverses exactly. Tengwar and Kryptonian reversals cannot recover capitalisation (flagged as case-lossy). The Translation Memory needs no repair — it stores pre-conversion values. Exits 1 when PUA remains that no registered converter can reverse.

---

## tm

Manage the Translation Memory cache (`.champollion/tm.json`). TM stores previous translations and serves them on subsequent syncs instead of calling the API.

```bash
champollion tm stats                  # show cache statistics
champollion tm clear                  # clear cache (with confirmation)
champollion tm clear --yes            # clear without confirmation
champollion tm clear --locale fr      # clear only French entries
```

| Subcommand | Output |
|------------|--------|
| `stats` | Entry count, file size, per-locale breakdown |
| `clear` | Delete cache file (full or per-locale) |

| Option | Effect |
|--------|--------|
| `--locale <code>` | Clear only entries for one locale |
| `--yes` | Skip confirmation prompt |

See [Translation Memory](/docs/concepts/translation-memory) for how TM works and when to clear it.

---

## xliff

Export and import XLIFF 1.2 files for professional translator review. XLIFF is the universal exchange format supported by CAT tools like memoQ, SDL Trados, and Phrase.

```bash
champollion xliff export --locale fr                   # export French XLIFF
champollion xliff export --locale ja --out ./review/   # custom output path
champollion xliff import .champollion/xliff/fr.xliff       # import reviewed file
champollion xliff import ./reviewed.xliff --dry        # preview import
```

| Subcommand | Output |
|------------|--------|
| `export` | Generate `.xliff` from source + target locale files |
| `import` | Merge reviewed `.xliff` translations into locale files |

| Option | Effect |
|--------|--------|
| `--locale <code>` | Target locale for export (required) |
| `--out <path>` | Custom output path or directory |
| `--dry` | Preview import without writing |

See [Working with Professional Translators](/docs/guides/professional-translators) for the full workflow.

---

## status

Show pair configuration, installed plugins, and benchmark scores.

A pair whose config sets `qualityTier` (`standard`, `high`, `research` or
`verified`) shows it, said for what it is: a label you chose, not a
measurement — sync translates the same whatever it says, and `serve`
advertises it. A pair that does not set one shows none (`--json` still has
`qualityTier`, with `qualityTierSet: false`).

```bash
champollion status
```

After a model switch it also says when a locale's files mix text from more
than one model (from the Translation Memory: which model produced each value
on disk), with the command that has the current model translate the ones an
earlier model wrote — `sync --pair <pair> --redo all --fresh-on-model-change`.
For a method that runs a model you choose (`local`, `api`, `external`) it
repeats the licence note the first sync printed once. For an OpenAI-compatible
method (`local`, `openai`) it shows the address requests go to and the setting
that chose it: `LOCAL_API_BASE` in the environment or in `.env`, or the default
(Ollama, `http://localhost:11434/v1`). With a `contentDir` it lists the content
folder beside the key-value files, with how many source pages it holds and,
per language, how many translations are current, out of date or pending.
Pending means no translation yet, or parts the quality gate refused left in the source language (the content lock reads `pending:<hash>`).
Under each register it shows the gender guidance LLM prompts carry and where
it comes from (Champollion's default for the language, your config, or off —
see [Gender guidance](/docs/getting-started/configuration#gender-guidance)).
For a pair with a fallback it counts how many values in the files the fallback
wrote, and names the first few.
`--json` carries the same as `requestsGoTo` (on a pair or fallback with such an endpoint), `content`, `genderGuidance` and `fallback.valuesInFiles`.

---

## provenance

Audit translation resource licensing for all installed plugins.

```bash
champollion provenance
```

---

## plugin

Manage translation method plugins. Plugins are pre-packaged translation recipes installed to `.champollion/methods/`.

```bash
champollion plugin list                      # show installed plugins
champollion plugin install ./my-method/      # install from local directory
champollion plugin remove my-method          # remove a plugin
```

See [Plugin Specification](/docs/reference/plugin-spec) for the plugin manifest format.

---

## leaderboard

`champollion network leaderboard` (also works as `champollion leaderboard`). Browse, search, and install translation methods from the Network leaderboard. Methods installed from the leaderboard come with benchmark scores and the full canonical MethodConfig — the exact configuration used during evaluation.

```bash
champollion network leaderboard                       # show leaderboard
champollion network leaderboard --pair "eng>fra"      # filter by language pair (quote the >)
champollion network leaderboard --install 1           # install the method ranked 1 as a plugin
champollion network leaderboard --install 1 --apply   # install + patch config
```

| Option | Effect |
|--------|--------|
| `--pair <pair>` | Filter by language pair, as the board writes it: `"eng>fra"` (ISO 639-3; quote the `>`). `eng-fra` and `eng:fra` work too, and a 2-letter code is resolved (`en` → `eng`) |
| `--install <rank>` | Install the method at that rank (as listed) as a plugin |
| `--apply` | After install, automatically add `methodPlugin` to `champollion.config.json` |

**`--apply` workflow:** When you install with `--apply`, champollion writes the method plugin to `.champollion/methods/` **and** patches your `champollion.config.json` to use it for the relevant pair. This is the fastest path from "what scores best?" to "I'm using it in production."

---

## fonts

Downloads and manages PUA web fonts for constructed language script converters. Languages that use Private Use Area characters (Klingon, Sindarin, Kryptonian) need custom web fonts to render their scripts. This command downloads them from verified open-source repositories.

```bash
champollion fonts list                           # show needed fonts
champollion fonts install                        # download all needed fonts
champollion fonts install --css                  # also generate CSS snippet
champollion fonts install --dir ./public/fonts   # custom output directory
```

| Subcommand | Output |
|------------|--------|
| `list` | Shows which PUA fonts are needed and their install status |
| `install` | Downloads fonts for configured languages |

| Option | Effect |
|--------|--------|
| `--dir <path>` | Override font output directory (auto-detected from project type) |
| `--css` | Generate a `conlang-fonts.css` snippet alongside the fonts |
| `--config <path>` | Path to config file (used to detect which languages need fonts) |

**Auto-detection:** The output directory is inferred from your project structure:
- **Docusaurus** → `static/fonts/` or `website/static/fonts/`
- **Hugo** → `static/fonts/`
- **Default** → `public/fonts/`

**Native Unicode converters** (`crk` → Cree Syllabics, `sr` → Serbian Cyrillic) do NOT require font installation.

See [Conlangs, Scripts & Orthography](/docs/guides/conlangs-scripts-orthography) for full PUA font details.

## Three-Layer Pipeline

Use `lint`, `sync`, and `audit` together for bulletproof i18n:

```json title="package.json"
{
  "scripts": {
    "i18n:lint": "champollion lint",
    "i18n:sync": "champollion sync",
    "i18n:audit": "champollion audit"
  }
}
```

| Layer | Command | When | Purpose |
|-------|---------|------|---------|
| **Lint** | `lint` | Pre-commit | Block commits with hardcoded strings |
| **Sync** | `sync` | Post-commit / CI | Translate missing and changed keys |
| **Verify** | `verify` | Post-sync / CI | Confirm translations are present and correct |
| **Audit** | `audit` | Build step | Fail deployment if any locale has `[EN]` markers |

---

## See Also

- [Configuration](/docs/getting-started/configuration) — config file reference
- [Translation Methods](/docs/guides/translation-methods) — method selection per pair
- [Translation Memory](/docs/concepts/translation-memory) — caching and cost savings
- [Working with Professional Translators](/docs/guides/professional-translators) — XLIFF workflow
- [Plugin Specification](/docs/reference/plugin-spec) — plugin manifest format
- [CI/CD Guide](/docs/guides/ci-cd) — automating CLI commands in your pipeline
- [How Sync Works](/docs/concepts/how-sync-works) — understanding the sync pipeline
- [Quality Gate](/docs/concepts/quality-gate) — how translations are validated
