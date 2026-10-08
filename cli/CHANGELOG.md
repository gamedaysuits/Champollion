# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.5.3] - 2026-10-07

### Changed — one file for every default model

- **Every default model is written once, in `shared/model-defaults.json`**
  (bundled as `shared/model-defaults.json`): the CLI's default, the
  `openai` / `gemini` / `anthropic` methods' defaults, the harness's, forge's
  example and the site docent's. They used to be ten hand-written ids in
  seven files, and drifted. A default is an exact id, fixed in the file —
  never resolved at run time (the cache is keyed by model; a default that
  moved by itself would re-bill every cached string).
- **`champollion models check`** reads OpenRouter's and each provider's live
  list (free — list endpoints are not billed) and says, per role, whether the
  default is still listed, and the newest model its rule matches today. Exit
  1 when a default is gone.

### Changed — release gates (no model calls)

- `npm test` (run before every publish) now re-judges the ~72,000 blocks and
  ~18,000 UI strings of champollion.dev's translations with the quality gate
  (`scripts/gate-audit.mjs`): a hard refusal of a current page, or more than
  0.2% keep-as-written refusals, fails the release. With the 0.5.1 gate it
  fails on exactly the six blocks that sync left in English.
- A test pins the cost model: an unchanged re-sync sends nothing; editing one
  paragraph sends that paragraph alone, once per language; editing one UI
  string sends that string alone (Docusaurus and Markdown-folder projects).
- A refused block's second ask is one block per request, with its reason.

## [0.5.2] - 2026-10-07

Found by syncing all 12 locales of champollion.dev with 0.5.1: seven blocks
were left in English, and re-asking the model showed every one was the
gate's mistake, not the model's.

### Fixed — false refusals

- **Inline code is not prose.** A paragraph quoting an ICU message in
  backticks (`{n, plural, one {One file} other {…}}`) was judged by that
  sample's English branches alone, and a correct Japanese, Chinese, Korean,
  Arabic and Thai translation was refused as "ASCII-only" — twice, since the
  misreading is deterministic. The text around an ICU message in a value
  counts as prose too.
- **A phrase said twice is not a loop.** "Từ đáng tin cậy nhất đến ít đáng tin
  cậy nhất:" (Vietnamese repeats what English elides) was refused as a
  repetition hallucination. A loop now also needs a span or word repeated
  three times, a duplicated line, or the source echoed beside a translation.
- **"Keep it as written", said twice, is accepted give or take a full stop.**
- Reference entries numbered `1a.` are recognised.
- Holds made by gate 2 lift by themselves (gate 3): the next sync asks again.

### Changed — a run that leaves anything untranslated says so last

- The run's closing word is an `[ERR] Not finished` list of every part left
  in the source language — page, language, paragraph and reason — with the
  command that asks again. The `Created …` line is a warning, not `[OK]`,
  when anything is left. (A 1,082-page sync ended on `[OK]` with seven
  untranslated blocks named only in warnings mid-stream.)
- Every refused answer is kept in `.champollion/refused.jsonl` — the source,
  what the model answered and why the gate refused it — so a refusal can be
  read, not paid for again.

## [0.5.1] - 2026-10-06

### Changed — default models

- **The default model is `google/gemini-3.8-flash`** (was
  `google/gemini-3.5-flash`): newer, and half the price ($0.75 / $3.75 per
  1M tokens against $1.50 / $9). A config that names a model is unchanged.
- **Direct-provider defaults are exact ids.** `openai`: `gpt-5.4-mini-2026-03-17`
  (was `gpt-4o`, a name OpenAI repoints — a run could not say which model
  translated); `gemini`: `gemini-3.8-flash` (was `gemini-2.5-flash`).
  `anthropic` keeps `claude-sonnet-4-6`, already an exact id.
- Model lists stay live: `champollion models` and `init`'s picker read the
  providers' and OpenRouter's current lists; only the default is fixed.

### Fixed

- The docs' CI workflows, git hooks and framework guides pinned
  `champollion@0.4`, so a project following them never ran 0.5. They pin
  `champollion@0.5` now.

## [0.5.0] - 2026-10-05

Found by syncing champollion.dev with the published 0.4.0.

### Changed — nothing marked untranslated is ever written

- **No `[EN] ` marker reaches a page or a locale file.** A Markdown block the
  quality gate refused was written as `[EN] ` + its source, which broke tables
  and headings on the published page. Now the block keeps its source text,
  unmarked; the page's lock entry reads `pending:<hash>` (so the next sync
  processes it again — cache-free — and the page is never taken for a
  person's file), and `status` and `verify` list it. `wrap` no longer writes
  `[EN] ` placeholders into target files: the next sync translates the new
  keys. Old files that still carry `[EN] ` markers are detected and repaired,
  as before.
- **A refused front-matter field no longer fails its page.** It keeps its
  source text and the rest of the page is written (the FAQ page's `title: FAQ`
  → "Preguntas frecuentes" used to stop the whole page).

### Fixed — false refusals

- **A refused block or field is asked once more, with the reason.** The model
  is told what was wrong and that text correct as written may come back
  unchanged. A source echo, or Latin kept in a non-Latin language, answered
  the same way twice is accepted as deliberate (a name heading, a citation, a
  table of codes, a gloss); every other fault must pass outright. An endpoint
  declaring `"acceptsInstructions": false` is not asked again.
- Measured on 40,352 accepted blocks of champollion.dev in 12 languages, the
  gate refused 0.5% of correct output; the remaining refusals are real
  defects (a heading returned twice, a paragraph cut short).
- Kept as written without a retry: a short name measured without its inline
  code, quotes, parentheses (ASCII or fullwidth) and `{#anchor}`; a
  reference-list entry; fullwidth letters the source itself shows.
- A table is measured by its cells, not its pipes and delimiter row (a
  re-padded `|---|` read as a repetition hallucination).
- The length ratio counts only once a value is 20+ characters longer than
  its source.
- An HTML comment is never sent or billed.
- A reference list in one block (numbered or bulleted entries) is kept as
  written, as a single entry is.
- `verify` does not re-judge what sync accepted: a block on disk that is
  exactly what sync cached for its source (a name kept as written after the
  second ask) is not a warning.
- **Holds made by an earlier gate lift by themselves** (refusal records carry
  the gate's version): what an over-strict check refused is asked again on
  the next sync, without a redo.

### Changed — content cost estimates

- Markdown priced by an LLM method uses one key-unit per 60 source
  characters (was 25). The estimate had run 2.8× to 8× over the bill; it now
  runs at about 1.2× to 3.4×, still above, as `--max-cost` needs.
  Character-billed engines are unchanged.

### Changed — exact model slugs only, no aliasing (2026-10-05)

Founder ruling, 2026-10-05: "slugs should be specific, NOT ALIASES — for all
models, all slugs, no aliasing." A model is named by its exact slug —
`google/gemini-3.5-flash` on OpenRouter, a direct provider's own exact name
(`gpt-5.5`) on `openai` — in `--model`, the config's `model`, a pair's or a
language's `model` and a fallback's `model`.

- **Retired aliases are refused** before anything is sent, naming the slug
  each stood for: `"gemini-flash" (from --model) is not a model id — Champollion
  takes exact model slugs only, no aliases. Did you mean google/gemini-3.5-flash …`.
  `shared/model-aliases.json` is replaced by `shared/retired-model-aliases.json`,
  read only by that refusal.
- **Floating ids are refused** on every method (OpenRouter, direct providers,
  a gateway, local): `~vendor/…` router ids and any `…-latest` / `:latest`
  name. `champollion models` and `init`'s model picker no longer offer them.
- `init --model <alias>` is refused before a config is written.

## [0.4.0] - 2026-10-04

Most of this release comes from translating champollion.dev itself (the
2026-08-28 dogfood run) and from curtisforbes.com running the CLI in
production. The aim throughout: reuse what you already paid for, and say
what will be billed before it is.

### Fixed — release blockers: a local-only project defaults to local, who may use it, one set of corpus terms, a stranded placeholder

- **`init` beside a local-only test set defaults to the `local` method.** A
  project holding a file its steward marked local-only — a
  `<file>.champollion.json` sidecar with `"transmission": "local-only"`, what
  `network register-corpus --data … --tier local-only` writes — was set up
  with OpenRouter by default, `--yes` included (hospital persona, three
  rounds). init now looks for such a mark anywhere in the project (bounded,
  never in `node_modules`, `.git` or virtualenvs; an unreadable sidecar
  counts as a mark) and, when it finds one, defaults to `local` and says,
  in one line naming the marked file, why; how to choose a hosted method
  deliberately (`champollion init --force --method llm --model …`, which
  rewrites only the method); and what local needs (a model server: Ollama's
  default, or `LOCAL_API_BASE`). The wizard's method step offers local as
  its default with the same reason. An explicit `--method` always wins, and
  a hosted method beside a mark is noted under "Where the text goes".
  Without a mark nothing changes.
- **Who may use this, in plain words.** A new page,
  [Who may use this](https://champollion.dev/docs/getting-started/who-may-use-this),
  states each package's license (CLI, MCP server and nmt-forge: PolyForm
  Noncommercial 1.0.0; the harness: AGPL-3.0-or-later; champollion-lyss: its
  own permission-only license), quotes PolyForm's own permitted purposes
  (its "Personal Uses" and "Noncommercial Organizations" clauses), and gives
  examples — a school, a public hospital or clinic, a charity, a personal or
  research project are covered; a for-profit business's product, such as a
  shop's storefront or a for-profit private clinic, is not. It says the
  harness's AGPL allows commercial use on its own terms, network-use
  obligation included, and that it is a summary, not legal advice. init's
  license lines, the installation, quick-start, enterprise, CI and
  framework pages and the package READMEs link to it. The enterprise
  page's "commercial use requires permission, so talk to us first" is gone
  (in all 13 languages), as is every README's "commercial use requires
  permission". The twelve translated CLI READMEs still called the CLI
  Apache-2.0 (stale since the 2026-08-17 relicensing); they now state
  PolyForm Noncommercial and link the page.
- **A registered corpus's card states each term once, and truly.** A
  local-only CC-BY-2.0 test set got a card saying redistribution was both
  allowed (`license.redistribution: true`) and "prohibited"
  (`usageRestrictions.redistribution` — the exposure tier written as a
  license term), training three ways, and "Custom/unconfirmed license" for a
  standard SPDX id; `mt-eval contest prepare` then warned not to release a
  CC-BY-2.0 dev set (researcher persona, Round 14). Now: a standard SPDX id
  outside the picklist is recorded as the standard license it is, with its
  own terms (only an id the license gate does not know, a `LicenseRef-`, or
  the picklist's "Other / custom" is flagged unconfirmed);
  `usageRestrictions.redistribution` comes from the license only;
  `usageRestrictions.commercialUse` is `null` (it defers to
  `license.commercial`); training is `doNotTrain`, with
  `usageRestrictions.training` saying only who set it
  (`prohibited-by-community` for the registrant's term,
  `prohibited-by-license` when the license itself refuses training — never
  "discouraged" beside `doNotTrain: true`); and the local-only mark is its
  own field, `transmission: "local-only"` (new in the corpora-card schema),
  kept on the card when the file was already marked. CC-BY-NC-4.0's
  `redistribution` is now `true` — the license lets anyone share it
  non-commercially; it still never enters the public lane. The summary
  prints one line each for the license, training and transmission.
- **A sentence break that strands a placeholder is refused.**
  "Take this medicine at {time}." came back as "… sina. {time}." — the time
  shown as a sentence of its own — and the gate and verify passed it
  (hospital persona, Round 14). One rule in `lib/placeholders.js`
  (`placeholderSentenceBreaks`): a translation that puts a sentence end
  (`.`, `!`, `?`, or another script's mark — `。`, `।`, `؟`, `።`, `᙮` …)
  right before or after a placeholder so that the placeholder stands alone
  as a sentence, where the source has it inside one, is refused by the gate
  (the retry, then the pair's fallback, takes the key) and flagged by
  `verify` ("sentence break(s) inserted beside a placeholder", with the
  `--redo` command; its cache entry is evicted). Ellipses, decimals, file
  names (`{host}.com`), one-letter and short capitalised abbreviations
  (`M. {name}`, `Nr. {id}`), ICU plural/select messages and placeholders that
  only move within the sentence pass. Measured on this repo's own 13-locale
  website translations and the test fixtures (16,671 translated values,
  1,371 with placeholders): 0 findings. The broader rule — any mark beside a
  placeholder — flagged 20 correct Japanese and Korean strings there, so it
  was narrowed.

### Fixed — the estimate names its rate, scoped checks name their locales, CI checks say why (Round 14)

- **"Translating" only when something is sent.** A dry run, and a run with
  nothing to do, printed "Translating 2 locale(s) with concurrency 50", as if
  model calls were about to happen. A dry run now says "Checking 2 locale(s)
  — a dry run: nothing is sent to a model, nothing is written"; a run whose
  estimate sends nothing says "Checking 2 locale(s) — nothing to send to a
  model this run"; a run that sends to some locales says "Translating 1 of 3
  locale(s) …".
- **The estimate gives its rate, where it came from, and when.** The
  hosted-model figure had no per-token rate, source or date. One line under
  the table now names each rate used — `$0.30 input / $2.50 output per 1M
  tokens — OpenRouter's price list, read 2026-10-04 14:02 UTC`; for a direct
  provider priced offline, the copy kept in champollion and the date it was
  checked; for DeepL, Google and Microsoft, the published per-character price
  and its date — and the tokens (or characters) per key the estimate
  assumes. `--json` carries the detail: each pair's `rate` and the run's
  `rates` (`inputPerMillion`, `outputPerMillion`, `perMillionChars`,
  `tokensPerKey`, `from`, `url`, `fetchedAt` or `verified`).
- **A dry run's cap warning says how to gate CI.** `sync --dry --max-cost`
  exits 0 (a preview, decided in Round 11), so it could not fail a step on
  its own. Its warning now names the `--json` field to read
  (`maxCost.wouldStop`, `preflight.ready` or `realRun.exitCode`) and links
  the CI guide's check step; `realRun.reasons` gives the estimate and the
  cap. The CLI reference says the same.
- **`status` explains its quality tier, or leaves it out.** Every pair said
  "quality: Standard", a default nobody set, with no word on what it meant.
  A tier now shows only when the config sets `qualityTier`, said for what it
  is — a label you chose (standard, high, research, verified), not a
  measurement; sync translates the same whatever it says. `status --json`
  adds `qualityTierSet`.
- **A scoped check names what it checked.** After `sync --pair en:fr`, the
  post-sync check looked at French only and still said "intact in every
  locale" while Spanish had a warning. A scoped check now closes with
  "Verification passed for fr: … intact (only en:fr was synced; `champollion
  verify` checks every locale)" — `verify --pair` says the same of its flag —
  and its `--json` line carries `checked` and `scope`.
- **The CI guide's check step prints why it failed.** It sent stderr to
  `/dev/null` and `jq -e` printed only `false`. The step (under its own
  heading, "Check before the sync") now keeps stderr in the log and, when it
  fails, prints the summary's `realRun.reasons` — "A real sync would exit 1:
  … No OpenRouter API key …", or the cap with its figures — or the summary's
  error when sync could not run at all.
- **Commands a script runs are pinned.** The quick start says once why a
  command in CI, a `package.json` script or a git hook names its version
  (`npx --yes champollion@0.4 …`); the enterprise guide's CI commands, the
  30-languages tutorial's workflow and the README's pre-commit hook now do.
- **The real reason the bot's commit never restarts the job.** The CI guide
  said the lock files are left out of `paths:` because the bot's commit
  changes them, while the Django workflow watched `locale/**`, which every
  bot commit changes. It now says once that a push made with `GITHUB_TOKEN`
  never triggers a workflow run, that a push with a personal access token or
  an app token would — and then the `paths:` filter decides (narrow Django's
  to `locale/en/**`) — and no longer suggests a gate triggered by the bot's
  own commits.
- **MCP `translate`: several contexts are listed, never picked.** For
  "Cancel", which a catalog has as msgctxt "button" and "dialog", the answer
  listed both and then said to pass `context: "button"`. It now asks for the
  one meant; when each text has one context it gives the exact argument — a
  string for one text, an array with one slot per text otherwise (a string
  would apply to every text of the call).

### Fixed — plural gaps asked again, a dry run that predicts its real exit, one redo for all pairs (Round 13)

- **A plural message a model left incomplete is asked for again.** A
  Russian entry whose few/many forms a local model left out (the "other"
  form standing in, marked `# champollion:`) was treated as done by every
  later sync, CI's hosted model included, so CI stayed red until a person
  re-ran with a key or wrote the forms by hand. A marked gap is not a
  translation now: a sync whose setup (method, model, register, coaching)
  has not answered it yet sends it to the model again — not to the cache,
  which holds the incomplete answer — and the estimate prices it. The lock
  records each setup that answered without the forms (`gaps`), so a local
  run and a CI run never take turns paying for the same answer. If the new
  answer lacks the forms too, the entry stays marked. `sync --redo gaps`
  asks for every such message, whoever left it; the CI guide's workflows
  offer it as a `redo_gaps` box under **Run workflow**.
- **A dry run reports the plural gaps on disk and predicts the real exit
  code.** `sync --dry --json` said `totalPluralGaps: 0` and
  `verify.warnings: 0` over files a real sync exits 2 on. Its summary now
  counts the gaps the real run would not ask for again, carries `realRun:
  { exitCode, wouldStop, reasons }` (the preflight, the cap, keys held back,
  plural gaps), says `verify: { "ran": false }` instead of zero counts, and
  its last line says "A real sync would exit 2 (partial): …". The dry run
  itself still exits 0.
- **A model's reused text is named before the estimate, after a completed
  switch too.** A string reverted to a text only the earlier model
  translated was served as a free cache hit, and only the real sync and
  `status` said the text was that model's. The carry-over notice now counts
  what this run serves from an earlier model, wherever it is, before the
  estimate — dry runs included, as the Translation Memory page promises.
- **One redo for every pair after a method change.** A dry run gave one
  `--pair` command per language, each priced on its own. Each language now
  gets its count and price on one line, then one command for all of them
  and the total.
- **`sync --prune plural-extras`.** An i18next key for a plural form the
  language does not have (Spanish `count_two`) was left in place, and
  `verify` said "delete them". `verify` and sync's extra-key warning now
  print the command; the flag removes only those keys (CLDR decides), lists
  each one, sends nothing, and is never implied — a dry run says what it
  would remove.
- **The forms each language gains are said from CLDR.** Sync's "e.g.
  French adds _many" line now names the run's own languages ("es, fr add
  _many; ja keeps only _other"); the frameworks page says Spanish gains
  `_many` too, and states the rule.
- **The CI guide's dry-run check runs the job's flags.** Its `jq` preflight
  had no `--method`/`--model`, so for a project configured with `local` it
  checked the local method and passed on a runner with no key. Both
  workflows now keep their sync flags in one `SYNC_FLAGS` line, read by the
  sync step and by the check; a hosted method is never ready without its
  key, whether or not anything needs translating.
- **MCP `translate` takes a gettext `context`.** It is keyed into the cache
  as sync keys a catalog entry with that msgctxt, and told to the model.
  Without it, a text the project has only with a context is translated
  without reading or writing the project's cache (it wrote a context-free
  entry beside sync's), and the answer names the context to pass. The CLI
  exports `tmSourceText`, `CONTEXT_SEPARATOR` and `sourceTextContexts` for it.
- **No unverified vocabulary in the docs.** The coaching-file example
  showed Plains Cree terms nobody had checked (`"submit": "ispīhci"`). It is
  now a made-up language under the private-use code `qaa`, with
  `<your term for …>` placeholders; the same goes for the coaching example
  on How It Works, the example response in Serving a Method, the
  tokenizer page's worked example, and the script-converter examples, which
  now show spellings the converter produces (`pâ tê ki` → `ᐹ ᑌ ᑭ`) rather
  than words.

### Fixed — every recorded name finds its language, verify names plurals and placeholder syntaxes, one-run flags said once (Round 12)

- **An npm install finds a language by any name its card records.** The
  bundled manifest (`shared/cards-fallback.json`) carried each language's
  displayed name and code aliases only, so the ~7,500 languages without a
  bundled card could not be found by their alternate names (ISO 639-3:
  "Montagnais" for Innu), endonyms or other registries' names — 333, 1,543
  and 411 languages. Manifest entries now carry those names (`s`),
  deduplicated as search compares names, each with the card field and
  source that record it (a top-level `nameRefs` table; format in
  `_meta.searchNames`, reader `lib/cards/search-names.js`). The tarball
  grows by about 31 KB.
- **Model-change notices count translations and say what they are made
  of.** "10 source string(s) whose only cached translation is an earlier
  model's (each counted once, …)" for a five-key `en.json` with two
  languages now reads "10 translations only an earlier model wrote (5
  strings × 2 languages)"; the carry-over notice counts the same way.
- **A one-run `--method` / `--model` is said once, quietly.** A CI job
  running the CI guide's hosted model over a project configured for a
  local one printed, every run and per language, that the files were
  "written by local, not by llm", with a paid `--redo all`. When only this
  run's flags differ from the config, one line says the configured setup's
  text is kept and nothing is redone. A real change of the config keeps the
  full note, and so does a dry run (where a switch is priced).
- **`register-corpus` prints the documented `--target-lang-code`.** Its
  `mt-eval run` hint used `--target-code`, which no doc page uses; in
  `mt-eval run` the two are now one flag (`--target-code` is the alias).
- **`verify` shows the plural forms each locale needs.** Each locale gets a
  line per kind of plural it carries (i18next keys, ICU messages, gettext
  entries), e.g. "Plural forms (CLDR fr): one, many, other ✓". The forms
  come from CLDR, or from the catalog's `Plural-Forms`. `verify --json`
  writes one `verify` record per locale (keys, findings, placeholders by
  syntax, plural coverage) before the closing line, which keeps its level
  and message and adds the error and warning counts.
- **`verify --help` says what verify checks.** The heading was cut off
  mid-sentence. The list now puts each check under the exit code it gives,
  and names i18next `_one`/`_many`/`_other` keys and each placeholder syntax.
- **A placeholder finding is named by its syntax.** A gettext catalog's lost
  `%(name)s` was called an "ICU structure error". Findings now say
  printf/python-format, ICU, i18next `{{…}}`, single-brace `{…}` or tag, and
  what changed. `{{name}}` written as `{name}` (which i18next prints as is)
  is now caught.
- **Sync refuses the placeholder changes verify flags.** The quality gate
  did not check i18next `{{…}}`, so a model's `{{nom}}` for `{{name}}` was
  written and cached, then flagged by the verify after the sync. Gate and
  verify now share one rule (`lib/placeholders.js`): the gate refuses the
  value, and the pair's fallback translates it instead.
- **Every `--help` heading is a whole sentence.** Nine (serve, watch,
  audit, seal-corpus, lint, wrap, plugin, fonts, recommend) stopped
  mid-sentence, because the heading was the description's first line. It is
  now a command's one-line summary, or the first sentence of its
  description.
- **Docs and init.** The quick start says how to point the local method at
  another server (`LOCAL_API_BASE`). The CI guide's dev-dependency variant
  installs with `npm ci` and stages the locale files and lock by name. The
  Django guide names `LOCALE_PATHS` and `LANGUAGES`, and `init` says so in
  one line when a Django project has a root `locale/`.

### Fixed — one count per notice, named prices, and runs that say who wrote them (Round 11)

- **The troubleshooting page gives the redo that works after a model
  switch.** It said `sync --fresh-on-model-change` gets "the new model's own
  translations"; after a change of model alone that sends nothing (it only
  affects keys a run translates anyway). It now says `sync --redo all
  --fresh-on-model-change`, as the CLI's own note and the Translation Memory
  page do. Every other page that names the flag was checked against the CLI.
- **The `--fresh-on-model-change` notice counts one thing.** It said "12
  cached translation(s)" above per-model counts adding up to 30: the total
  summed each locale's first earlier model, the lines listed every model's
  holdings, and a string two models translated counted twice. It now counts
  source strings whose only cached translation is an earlier model's, each
  once, under the model whose translation would be reused — so the total is
  the sum of the lines, and it says what it counts. (A project whose
  Markdown shares the cache counts cache entries, and says so.)
- **A dry run says the `--max-cost` verdict once.** It was printed beside the
  estimate and again at the end (`--quiet` too). It is said once, at the end,
  beside the preflight's verdict — before the `--json` summary, which stays
  the last line.
- **A model with no price is named, and why.** "Total: unknown (no method in
  this run has published pricing)" blamed the method, and a mistyped slug
  read like an unpriced model. The total now names it ("no price for model
  google/gemini-3.5-flsh (en:de, en:fr)"), and the line below says which
  case it is: not in OpenRouter's model list — likely a typo, with the
  closest listed slugs; listed but with no per-token price (a router listed
  at "-1" is no longer priced negative); or the price list could not be read
  (HTTP error, timeout, `CHAMPOLLION_PRICING_OFFLINE=1`, which the OpenRouter
  estimate now honours as the direct providers' did). A method with no
  published price is still named as the method. The `--max-cost` stop names
  the same; `--json` carries `unknownCost.notes`, and an unpriced row carries
  its `model`.
- **The sync exit codes are written down, for real and dry runs.** A dry run
  keeps exit `0` — it is the preview a CI step runs before deciding, and the
  CI guide's gate reads its `--json` summary (`preflight.ready`,
  `maxCost.wouldStop`, `maxCost.exitCode`). The CLI reference has the table,
  and says when a dry run itself exits `1` (a key named for a redo that
  matches nothing, a `--files` pattern that matches no file, an invalid
  config).
- **`init` with a model on this machine says what CI needs.** With `--method
  local` (or an `api` endpoint on this machine) its next steps end with one
  line: a runner has no model server — run a hosted method there, or use a
  runner that can reach one — with the CI guide's address.
- **The CI cache is saved once per change, not once per run.** The
  workflows keyed the cache on the run id, so every run that had a cache
  saved a new full copy, even with nothing to do. The restore step now
  brings back the branch's newest cache (`restore-keys`), and the save step
  keys it on a hash of the cache's own files and is skipped when that is the
  key it restored: a run that translated something (even a partial one, or
  one whose push was rejected) saves; a run that added nothing does not.
  Keying on the lock and source files instead would restore an older copy by
  exact match after a rejected push; the guide says why.
- **The Django workflow makes no header-only commits.** `makemessages`
  (msgmerge) writes a new `POT-Creation-Date` into every catalog on each run;
  the commit step now commits only when something else changed (`git diff
  --staged --quiet -I '^"POT-Creation-Date:'`, git 2.30 or newer).
- **The CI guide says what the dry-run gate checks.** "To check the secret is
  wired" read as "the key works"; a placeholder passed. It now says the dry
  run checks that the variable is set, not that the key works (nothing is
  sent), and that a wrong key shows on a real run's first request.
- **A redo served from the cache no longer needs the model server.** With
  `local` (or LibreTranslate, Apertium) and the server down, the startup
  check stopped every run — a redo that sends nothing included. Off a CI
  runner the check is now decided after the plan: a run that sends the
  method nothing warns that the server does not answer and that this run
  does not need it, and goes on; a run that sends something stops before
  sending, as before (a dry run says it would). On a CI runner the Round 8
  rule stands: a server that does not answer stops every run, so a workflow
  that still names `local` fails on its first push. (The Docusaurus lane
  keeps the startup check.)
- **The Django docs say what the French default asks for.** `formal-vous`
  asks for a "Professional, academic register", and French's gender
  guidance for *écriture inclusive* (`Connecté·e`); `init` printed both, the
  Django section of the frameworks page did not. It now says so, with the
  fields that change them (`languages`, `genderGuidance`). The default is
  unchanged.
- **A run the fallback mostly wrote says so.** When more than half of a
  run's fresh translations for a pair came from its fallback
  (`FALLBACK_MAJORITY_SHARE`), sync adds one warning per lane: how many of
  how many, by which method and model, why the pair's method's answers were
  not used (counted: a memorized sentence repeated for different source
  strings, length inflation, …), and what to consider. `status` shows the
  same share of the files ("from the fallback: 4 value(s) in the files (…)
  — 4 of the 5 sync wrote (80%)") and says when it is most of the
  locale's text; `--json`
  carries `primaryAccepted`/`primaryReasons` beside `accepted`, and status's
  `valuesWritten`/`share`. The quality gate's thresholds are unchanged.
- **Flutter: a locale Flutter's own widgets do not cover is named.** The
  app's messages come from the ARB files, but Material/Cupertino widget text
  comes from `flutter_localizations`, which covers a fixed list of
  languages; an app with `qaa` (or most low-resource codes) in
  `supportedLocales` fails at runtime without a fallback delegate. `init`,
  and a sync that creates a new `.arb` file, now say so for each such target
  — checked against the list in the Flutter SDK on the machine
  (`FLUTTER_ROOT`, or the `flutter` on `PATH`); without an SDK a private-use
  code is reported as uncovered and the rest as not checked. The Flutter
  section of the frameworks page shows the minimal delegate.
- **`doctor` checks the OpenRouter key where a bad key is rejected.** It
  called the model list (`/api/v1/models`), which answers without a key, and
  printed "Connected — N models available" for any value, a placeholder
  included. It now asks OpenRouter's documented key endpoint (`GET
  /api/v1/key`: authenticated, no charge, HTTP 401 for a missing, invalid or
  disabled key). A key OpenRouter rejects (401/403) fails the check (exit 1)
  and says so; one it accepts passes with its credits used and left; any
  other answer, or none, is "not checked" (a warning). The key is never
  printed. The other providers' lines still say only that a key is set.
- **`network recommend` names the open models a language card declares.**
  `recommend eng crk` named no model, while the MCP server's
  `language_overview` suggested trying `MihaiPopa-1/OmniTranslate-1.0`. The
  selection rule now lives in the CLI (`declaredModelCandidates` in
  `lib/recommend.js`, read from the card's `methodSupportEvidence`):
  `recommend` lists the declared models `local-model` can load, labelled
  "RUNNABLE, NO PUBLISHED EVIDENCE" (the publisher's claim, not a
  measurement), with the command to try one and the formats it cannot load
  (adapters, quantized exports). `--json` carries `declared_models`.

### Fixed — advice that is safe to follow; one key, one reason; a gap is never "[OK]" (Round 10)

- **`init --force` over an existing config changes only what the flags
  name.** It used to write a new default config: `init --force --method
  local --model x` — which init itself printed as the way to switch model —
  dropped a custom register (French `casual-tu`), the glossary and the pairs,
  and reset `batchSize` from 40 to 80. Now it starts from the file: `--langs`
  sets the target list (a language already there keeps its entry), `--method`
  the method (and its model, unless `--model` names one), and so on; the
  locale layout is re-detected only when the file no longer finds the source
  files. Every other setting stays. It prints each field it changed and the
  ones it kept, and copies the previous file to `champollion.config.json.bak`
  first (`.bak.2`, `.bak.3` … — an older backup is never overwritten). A file
  that is not valid JSON is backed up and a new one written, with a warning.
  `init --help` and the CLI reference say so.
- **No printed advice re-runs `init` to change one setting.** The method
  line, the no-key hint, the target-language step, the two-orthography
  warning and the `acceptsInstructions` hint now name the field in
  `champollion.config.json` (`"defaultMethod"`/`"model"`, `"languages"`, a
  language's `"script"`, a pair's `"acceptsInstructions"`), and `sync
  --method/--model` for trying one for a single run.
- **`sync --model` / `--method` say they are for one run.** The run prints
  that the config is not changed and which field to edit to switch for good;
  the help and the CLI reference say "for this run only" instead of
  "override". The next plain sync (and `status`) still name the translations
  that run's model wrote, and now offer both ways out: keep them by making
  that model the configured one (nothing is sent), or the priced redo. The
  Translation Memory page says how to switch model.
- **`init` says where the text goes.** With a hosted method (the default
  `llm` sends every string to OpenRouter, which passes it to the model's
  provider), init says so and shows how to keep the text on the machine: a
  model served here (`"defaultMethod": "local"`), or `sync --method local
  --model <name>` for one run. A `local` method or an `api` endpoint on this
  machine prints nothing; a remote endpoint is named.
- **A restored plural form goes back in CLDR order.** `verify`'s repair for
  a missing `count_many` appended it after `count_other` (French and Spanish
  then ordered their plural keys differently). A new plural form is now
  placed beside its siblings — zero, one, two, few, many, other — in nested
  and flat key files, in YAML/TOML maps and on `xliff import`; nothing else in
  the file moves. (ARB and gettext keep a message's forms inside one entry.)
- **One key is counted once, with its reason.** A key named for a redo that
  was also missing was logged "1 missing + 1 forced"; the per-file line, the
  Docusaurus lane, `--list-keys` and the dry run's `--json` lists now put each
  key under its first reason (missing, `[EN]` fallback, untranslated,
  changed, forced).
- **A file left with a marked plural gap is never "[OK]".** The per-file line
  says `[INCOMPLETE: 2 plural form(s) marked "# champollion:"]`, and on a
  re-sync with nothing to translate the file is "nothing to translate, but
  INCOMPLETE" instead of "fully synced". That re-sync's summary keeps
  "Nothing was sent to a model and nothing was billed" and says why the exit
  code is 2, with the repair command.
- **The CI guide's workflows run only when something sync reads changed.**
  The default workflow has an `on.push.paths` filter for the source locale
  files and `champollion.config.json` (not the lock files), so a push with no
  source change starts no job and needs no key. The Django workflow watches
  Python, templates, JavaScript, the catalogs and the config, because
  `makemessages` extracts the strings in the job. Its `DJANGO_SETTINGS_MODULE`
  line is commented out: the `manage.py` that `startproject` writes sets it,
  and a copied value overrides it and breaks `makemessages`.
- **The gettext pages say what `msgfmt --check-format` checks**: only entries
  flagged `#, python-format`, which `makemessages` adds but a hand-made
  catalog may lack. `champollion verify` compares every entry's printf
  placeholders (name and type letter) whatever its flags, and sync keeps the
  source entry's flags on each entry it translates (and adds none).
- **The docs say `python3 -m pip install`** wherever they tell you to install
  a Python package (the harness, a method module, the CI job's
  requirements), and so do the external-method errors — an environment
  without a bare `pip` follows them as written.
- **A fallback's coaching file is used, and is part of its cache key.**
  `"fallback": { "method": "local", "coachingFile": "coaching.json" }` was
  never read: only the top-level `coachingFile` reached a prompt. And the
  plain LLM methods (`llm`, `local`, `openai`, `anthropic`, `gemini`) carried
  coaching in their prompt without it being in the cache key, so `sync --redo
  all` after adding or editing it served the uncoached translations. A
  language's, a pair's or a fallback's own `coachingFile` is now read
  (relative to the project) into the prompt and wins over a less specific
  level's coaching; its text, not its path, is fingerprinted in the cache key
  of every method whose prompt carries it. A file that cannot be read stops
  the run, naming where it is set.
- **A change of the fallback is announced and priced like a change of the
  pair's method.** After changing the fallback's coaching, register or model,
  a plain sync says how many values the fallback wrote as it was set up
  before, the redo that re-translates them (`--redo all`, with
  `--fresh-on-model-change` for a model change alone) and its price; a dry
  run of that redo says what it would send. `status` shows each pair's and
  each fallback's coaching (with the fingerprint the cache key holds), a
  fallback's register when it differs, and `--json` carries `coaching` and the
  fallback's `earlierSetup`.
- **Upgrading reuses what you paid for.** A cache written before coaching was
  keyed is read once; entries made with the coaching a pair has now stay
  served, so the upgrade re-translates and reports nothing.
- **Sync refuses at write time what `verify` flags as a memorized sentence.**
  When a model gave one sentence for three app strings, the three were
  refused — and the same sentence then went into the newsletter's title as if
  it were new; only `verify` caught it. A sentence refused earlier in a run is
  now refused from its first new source on (including a gate retry that
  returns it for one key), and the check starts with what the language's files
  and Markdown pages already hold and the run leaves alone — the scope
  `verify` reads.
- **MCP `translate` with `project_dir` refuses what `champollion sync` there
  refuses.** It starts from the project's index (the cache's memorized
  sentences, and what the files and pages hold); a repeated answer goes to the
  pair's fallback, or fails with the reason.
- **`network register-corpus` puts nmt-forge first for a test set a model may
  be trained against** (`--role test`, or a local-only or private set with no
  role): register the set, screen the training corpus, write down your
  predictions — then the baseline `mt-eval run`. The old "Next: mt-eval run"
  was a scoring read, and nmt-forge refuses predictions written after one.
  The steps use your forge project for the pair if you have one, and never
  name a set, prediction id or file forge would refuse. A dev or train set
  keeps the plain baseline advice.
- **`network register-corpus --help` said Champollion "never reads" your
  corpus.** It now says what happens: a file you name is read on this machine
  only (`--data` to count and checksum it, `--seal-input` to encrypt it), and
  none of it is sent anywhere. The command's second, out-of-date copy of its
  help is gone; `--contamination`'s default is described as it works, and
  `--description` and `--key-scheme` are listed.
- **Pair spellings.** `register-corpus --pair "eng>pt-BR"` registered eng→pt,
  dropping the region; it is kept now, and `eng-pt-BR` (two readings) is
  refused, naming both. `--pair eng:crk` works, and `--pair eng` (what an
  unquoted `>` leaves) says it names one language and why. `leaderboard
  --pair eng-crk` found nothing (the board stores `eng>crk`): any accepted
  spelling now finds the rows, and a 2-letter code is resolved (en → eng).
  `recommend` takes the pair as one value too. `submit` no longer ends every
  error with "The compliance attestation is required".

### Changed — Round 10

- **One way to write a language pair.** The network commands print `eng>crk`
  (the form the leaderboard and mt-eval use) and read `eng-crk` and `eng:crk`
  the same way. With hyphens only, a pair is two codes of two or three letters
  (mt-eval's and nmt-forge's rule), so `crk-Cans` is never read as crk → Cans.
  `submit`'s pair fields share one label, and each pair is written `eng>crk`.
  Project pairs (`sync`, `verify`, `serve --pair`) are unchanged: written
  `en:fr`, and also read as `en>fr` or `en-fr`. The CLI reference says how to
  write each.

### Fixed — a run that is not finished never ends on "[OK]"; prices beside every command (Round 9)

- **A plural message left without a form the language uses for ordinary
  counts keeps every sync at exit `2`**, not only the sync that wrote it — the
  rule held refusals already follow. A re-sync with a marked `# champollion:`
  entry (or an ICU message without its `few`/`many` branch) still on disk names
  the file, the keys and the `--redo keys:… --fresh` command, and its summary
  says why it is incomplete. The post-sync verification line no longer says
  `[OK]` over a run that is incomplete: it says what the run left undone.
  The CI guide and the Django section say so.
- **The CI guide has a pull-request variant** for a branch-protected `main`
  (a bot branch, `gh pr create`, or `peter-evans/create-pull-request`), says
  when to use which, and that a rejected push is not billed again: the cache
  is saved before the commit step, so a re-run or the next push serves those
  translations from the cache.
- **A missing key on a CI runner gets the repository-secret line instead of
  the shell advice** (`export …`, `.env.local`) in every place that says it —
  the sync preflight, a method that returned nothing, the content and
  Docusaurus lanes, `models` — through one helper. The preflight counts
  methods, not pairs: "the llm method is not ready for en:de, en:fr", where it
  said "2 methods are not ready".
- **A dry run's `--max-cost` line agrees with the preflight**: when the real
  run would stop earlier (a missing key, a model server that does not answer),
  it says so — "the estimate is under the cap, but the run would stop earlier
  and exit 1: …" — instead of "a real run would go ahead". `--json` carries
  `maxCost.stopsEarlier` and `exitCode: 1`.
- **The "Changed" line names the keys** when there are five or fewer, and
  otherwise says that `--list-keys` names them.
- **The redo a model-change note names carries its price** ("sends up to 4
  key(s) an earlier model wrote — $0 API cost (runs on this machine)").
- **One cost label** (`costLabel`, exported for the MCP server): a model on
  this machine is "$0 API cost (runs on this machine)" in the redo notes and
  the MCP `translate` answer alike, never "0 USD".
- **A dry run's `--json` counts add up**: each locale's `sentToModel` and
  `tmHits` are the estimate's partition for its pair (they read 0 under a
  total of 4), and the run-wide `tmHits` is the cache's share.
- **`verify` names the repair for missing keys**: a few by name
  (`--redo keys:common::count_many`), many by the pair's sync.
- **The repeat check (one memorized sentence for different source strings)
  compares the translatable text**: placeholders and tags are not words of
  the output ("S. {name}!" and "S." are one output), and a paragraph of
  several sentences is also compared sentence by sentence against what keys
  and other blocks got (a sentence two paragraphs genuinely share is one
  source, never suspect). A school's model answered 'Thank you, {name}!' and a
  newsletter sentence with one memorized sentence, and both passed.
- **`network register-corpus` never grades a comparison it did not make as
  `Contamination: NONE`.** An npm install ships no corpora cards: it now reads
  the public corpus catalogue (the checksums only — the file's own sha256
  never leaves the machine) and refuses NONE for a byte-identical copy of a
  public benchmark. Offline or unreachable, the grade is `UNCHECKED` with the
  reason, unless you state one with `--contamination`. The corpora-card
  schema accepts `UNCHECKED` (relative-comparison-only, like every grade but
  LOW).
- **A registered card says what registration did**: with `--data`, that the
  text was read on this machine only to count and checksum it (it said
  "corpus content was never read"); a set registered with `--role test`
  stores its size under `test`, not `dev` (the registry build and the corpus
  fetcher read either).

### Fixed — one held-refusal rule in every lane, and what each run says matches what it does (Round 8)

- **A Docusaurus UI string the quality gate refused is held back, as a
  key-value key is.** The Docusaurus path never read or wrote the lock's
  refusal records, so a refused string in `i18n/<locale>/code.json` (or a
  plugin's JSON) was sent to the same paid model on every sync. It is now
  recorded in `.champollion.lock` per file, id and locale, with its source hash
  and the method key that refused it. A plain sync does not send it again and
  says which strings it held back and the `--redo keys:` command that asks
  again. `--redo keys:`, `--redo all`, `--fresh`, a fallback that has not
  refused it, a model or method change and an edited source all lift the hold.
  The estimate does not price it, a dry run names it, and a run that holds one
  back exits `2`. It shares the key-value lane's code (`planQueue`,
  `holdState`, the messages).
- **A page translated whole (`contentSegmentation: "page"`) that the gate
  refused is held back.** The block and field records did not cover a page
  refused whole (a damaged placeholder, a hollowed page), so it went to the
  model on every sync. It is recorded by the hash of its body and the method
  key, in both content lanes. A held page is not written, and nothing of it is
  sent (its front matter included). The same redo and lift rules apply.
- **A Docusaurus `--redo keys:` served from the cache says so**, with the
  `--fresh` command and its price, as the key-value path does.
- **A dry `--redo all` after a register or method change** said "Nothing
  would change" and recommended the command being previewed. It now says what
  the redo would send, and to which method, with the price.
- **A dry run with nothing to do** ends with "$0: nothing would be sent or
  billed", as the real run does.
- **A model switch across several pairs** prints one project-wide command
  instead of one per pair.
- **`verify`**: a locale with an extra or missing key no longer prints "[OK]
  9/8 keys present" (it says "8 expected, 9 present (1 extra: …)"), and under
  `--strict` a warning ends in "[FAIL] … --strict treats warnings as
  failures", never an "[OK]" line before exit 1.
- **A plural message left without a form the language uses for ordinary
  counts** (Russian `few`, written with the "other" form and marked
  `# champollion:`) makes the sync exit `2`, and the summary line says why.
- **CI**: a missing key no longer prints an empty `[ERR] sync failed:` line;
  on a CI runner it says to add the repository secret. A `local` config is
  checked against its server even when nothing is queued, so CI fails fast
  ("no model server answers at …") instead of going green until a string
  changes. A dry run only warns. The no-key list no longer reads ".;".
- **Gender guidance is visible and chosen in the config.** The French prompt
  asked for *écriture inclusive* (`Connecté·e`) and nothing said so. `init`
  and `status` now show each language's gender guidance and where it comes
  from; `"genderGuidance"` (global, per language or per pair) replaces it with
  your own words or turns it off with `false`. The default is unchanged. A
  changed setting is a different prompt with its own cache entries.
- **`network register-corpus`**: a `local-only`, `private` or `sealed`
  registration of a file the corpora cards show is public (same sha256 as a
  public corpus) is refused the "Contamination: NONE" grade, naming the public
  corpus; a sealed one is refused. `--list` shows the id `--license` and
  `--tier` take beside each label.
- **`init` accepts a private-use code** (`qaa`–`qtz`) without a spelling
  warning, says it has no card, and takes a display name:
  `--name qaa="Ayta (variety not yet confirmed)"`.
- **What the fallback produced is named**: the `[FALLBACK]` line lists the
  keys (pages, for content), and `status` counts per locale how many values in
  the files came from the fallback.
- `cli/test/docusaurus.test.js` made its temp projects under the repo and
  left 200+ behind; it now uses the OS temp folder and cleans up. Its stdout
  stubs also swallowed the test runner's reports, so 15 of its 35 tests were
  never counted.

### Fixed — refused Markdown is not billed again; Docusaurus redo names must exist (Round 7 follow-ups)

- **A Markdown block or front-matter field the quality gate refused is held
  back, as a refused key is.** It was never cached and its page's lock was not
  advanced, so every sync sent it to the same model again. With a paid model
  and no fallback, each run paid for the same refused answer. The refusal is
  now recorded in `.champollion-content.lock` per page, block and locale, with
  the block's source hash and the method key that refused it. The next plain
  sync does not send it again, and says how many blocks and fields it held
  back on which page and how to proceed. A held block keeps its `[EN] ` text.
  A held front-matter field holds its page back: a refused field fails its
  page, as before, so nothing of that page is sent. `--redo files:<page>`,
  `--redo content`, `--retranslate` and `--fresh` ask again. A fallback method
  that has not refused it is asked instead of the pair's method. A model or
  method change lifts the hold, as does an edited paragraph. The cost estimate
  does not price what will be held, and a dry run names it. The precedence is
  the keys' precedence, and is on the Quality Gate page. A sync that leaves
  content refused or held back exits `2`, as for keys. Both content lanes
  apply this: a Markdown folder and Docusaurus docs.
- **A Docusaurus `--redo keys:` / `--force-keys` name that matches nothing
  fails.** The Docusaurus path handles named keys itself and skipped the rule
  above. A typo re-queued nothing and exited 0. It now exits 1 with the closest
  message ids. When some names match, those are redone and the run then fails
  naming the rest, last and in the `--json` summary (`unmatchedKeys`). Both
  paths share one implementation (`lib/named-keys.js`).

### Fixed — the same answer on every machine, names that match nothing fail, the newsletter goes through the gate (Round 7 personas)

- **"`_many` equals `_other`" is decided from committed files.** Whether a
  borrowed i18next plural form (French `count_many`, translated from the
  English `count_other` text) that holds the same text as `count_other` was
  written that way by the model depended on each machine's own cache. One
  commit passed `verify --strict` on the laptop that translated it and failed
  in CI, which also suggested a `--redo` that would re-bill. When the model is
  asked for a form, sync now records that in `.champollion.lock` (`forms`),
  with a fingerprint of the value its answer left. `verify` reads only that,
  so every clone of a commit gets the same result. A value with no such record
  gets an info line with the command that asks again, never a warning. The
  line says "written before each form had its own cache entry" only when the
  lock shows that the value predates the fix.
- **A key named for a redo that matches nothing fails.**
  `--redo keys:Cancel` (a msgid that exists only with a context) or a typo
  used to print "fully synced … 0 keys" and exit 0, which in CI looks like
  success. It now exits 1 and lists the closest keys, including every context
  variant of the msgid (`button␄Cancel`, `status␄Cancel`) in both spellings.
  When some names match, those are redone and the run then fails naming the
  rest. When none match, nothing runs.
- **A redo served from the cache says so.** `--redo keys:<k>` without
  `--fresh` re-writes what the cache holds. It now says so, and prints the
  `--fresh` command that asks the model again, with its cost.
- **Both spellings of a gettext context are shown.** Repair commands print
  `verb␄Open`, as reports and the docs do, followed by a shell comment saying
  the `␄` can be typed as `\x04`. Both always worked; the docs now say so.
- **Wrong Russian plurals no longer pass `audit`.** A plural message without a
  form the language uses for ordinary counts (a gettext entry marked
  `# champollion:`, an ICU branch left out) is what `verify --strict` fails
  on. `audit` used to call such a catalog "fully translated". It now counts
  those entries as incomplete (`pluralGapCount`), names them with the repair
  command, and exits 1. The Django CI example gates with `verify --strict`,
  runs `apt-get update` before installing gettext, refreshes the `djangojs`
  catalogs, and names the settings variables `makemessages` needs.
- **A short heading turned into a sentence is refused in a newsletter too.**
  In a content folder, `## Feast` came back as a full sentence and was
  accepted, while the same output for an app key was refused (length
  inflation 9.5x). Each Markdown block and front-matter field now goes
  through the key-value gate's checks: empty, echo, repetition, length,
  hollowing, script, and same output for different inputs. That applies to a
  fresh answer and to one served from the cache. A refused block goes to the
  pair's fallback, or else is written as the `[EN] ` fallback (and held
  back from then on, below). `verify` checks blocks already on disk the same
  way (a warning).
- **One repair command for a content finding.** For a memorized sentence in a
  newsletter's front matter, sync and verify suggested different commands.
  Both now print `champollion sync --pair <pair> --redo files:<page>`.
- **`champollion status` shows the content lane and the local endpoint.** It
  lists the content folder, its source pages and, per language, how many
  translations are current, out of date or pending. For `local` (and
  `openai`) it shows the address requests go to and what set it
  (`LOCAL_API_BASE` in the environment or `.env`, or the Ollama default).
  `--json` adds `content` and `requestsGoTo`.
- **Model and method switches are said where they matter.** Translations
  reused from the previous model are named before the cost estimate, which
  the docs had always promised. A plain or dry run after a change of method
  (or register, or coaching) translates nothing on its own. It now says that
  the files keep the other method's text, and prints the redo with the new
  method and its estimate. A run with `--model X` calls X "the model for this
  run (--model X)", not "the configured model". The redo after a switch
  ("re-translate it all") now says what it sends: the keys an earlier model
  wrote. What the current model already translated comes from the cache.
- **`register-corpus` prints a hint you can run as-is.** The `mt-eval run`
  hint printed `<src>`/`<tgt>`. It now fills in the pair from the card it just
  wrote: the language names, the codes and the file, plus the project's local
  model when it has one.
- **Language names resolve to codes** (`resolveLanguageInput`,
  `findLanguagesByName`). With a project's locales, the result is the
  project's own spelling: "French" and "fra" both become the project's "fr".
  The MCP `translate` tool uses this, so names now hit the project's pair,
  model and cache. A name two languages share is refused with the choices,
  and so is one that matches two project locales.
- **Standalone `verify` says "Verification"**, not "Post-Sync Verification".
  No sync ran.
- **Docs.** `build-mt-for-your-language` explains what to do while the
  language variety is unconfirmed: ask the speakers first; if you must start,
  use a private-use code (`qaa`–`qtz`) with a display name. It lists what that
  costs and how to switch to the real code later. The frameworks page's Django
  section and the CI guide carry the licence note.

### Fixed — plural forms in the cache, a memorized-sentence repair that works, which model wrote the files (Round 6 personas)

- **A memorized sentence's repair command works, and the sentence is not
  re-served.** Sync warned that one sentence had been written into a
  newsletter's title and first heading and printed
  `--redo files:2026-10.md --fresh`, which failed "No content file matches"
  (as did `files:newsletter/2026-10.md` and `files:**`); `--force-content`
  then wrote the same sentence again from the cache with no warning. Now:
  `--redo files:` / `--files` / `--retranslate` patterns match the path sync
  prints and the path from the project root, and a `--retranslate` pattern
  (= `--redo files:<glob> --fresh`) is counted as matched (a short-circuit
  left it at zero). The cache entries behind a flagged sentence are removed,
  and the sentence is remembered per locale: when the model answers a repair
  with it again, it is refused from its first string on, said plainly ("can
  only answer this string with that sentence"), and sent to the pair's
  fallback. `verify` names a remembered sentence on disk. The printed repair
  no longer needs `--fresh`.
- **Two clearly different strings answered with one long sentence are the
  pattern.** The shared-output check waited for a third source, so
  'Thank you, {name}!' and 'Please bring the forms.' with one memorized
  sentence went through. Two sources are now enough when both are two or
  more words, share under half their words, and the shared text has four or
  more words; short outputs and synonym-like sources still need three
  ('OK'/'Okay' → "D'accord" passes).
- **French and Spanish `_many` are cached apart from `_other`.** An i18next
  form translated from another category's source text (`count_many` from
  the English `count_other`) shared one Translation Memory entry with it, so
  a model's distinct `_many` answer replaced `_other`'s and `--redo all`
  wrote "2 de recettes". A borrowed form now has its own entry (the text
  plus its form); the form it borrows from keeps the plain one, so existing
  caches stay valid for it. An older shared entry that holds the borrowed
  form's text moves to that form's entry; otherwise the borrowed form is
  sent to the model once, and the run says why. `verify` warns when a
  borrowed form holds exactly the text of the form it borrows from and the
  cache does not show the model wrote it that way. gettext `msgid_plural`
  and ARB/ICU plurals are one message per key and unchanged.
- **The CI guide says which plural findings fail `verify`, per format**
  (i18next: a missing form is a missing key, an error; ICU: a missing
  everyday branch is a warning; gettext: an untranslated or fuzzy entry is an
  error, repeated forms a warning), and its cache-save steps are skipped when
  there is no `.champollion/` folder (no more path warning on a push with
  nothing to translate).
- **`sync --dry --show-prompt <key>` for a translated key** shows the request
  and says why a real run would send nothing (up to date, served from the
  cache, or held back), with the `--redo keys:<key> --fresh` command that
  would send it. It used to print nothing. A name that matches no key, and a
  bare `--show-prompt` with nothing queued, are said too; a gettext msgid
  with a comma can be named whole.
- **A gettext catalog champollion creates gets the Plural-Forms `msginit`
  writes** (French `nplurals=2; plural=(n > 1);`, from
  `shared/gettext-plural-forms.json`, probed from GNU gettext 1.0), not
  CLDR's three French forms, so its `msgstr[]` slots are the ones gettext
  and Django select and no French plural carries a permanent "write them"
  comment. A form a catalog has no slot for is not asked again for, marked
  or reported (Hebrew `two` in a two-form catalog). Existing headers are
  kept; languages msginit does not list still get a CLDR-derived header.
- **A fuzzy entry is called fuzzy**: "1 fuzzy (source changed —
  re-translating)", not "1 missing".
- **`status` names the model that wrote the files.** The lock now records
  which method key produced each value (`locales.<code>.by`, grouped by
  method key): the model that answered, or the one whose cache entry served
  it. After a re-translation with stub-2 and a switch to stub-3, status said
  stub-1 (both cache entries held identical text and the older won). Values
  written before this release are attributed from the cache, and two models
  holding the same text read "model unknown" instead of a guess.
- **A plain sync says when the files were written by another model** — one
  line per language, with the `--redo all --fresh-on-model-change` command —
  unless the model-change notice already said it. It used to say "fully
  synced" and nothing else.
- **The `--fresh-on-model-change` warning matches the estimate**: "sent to
  the model again, at the method's price ($0 API cost for a model on this
  machine)" instead of "the new text is billed" above a "$0 (local)" line.
- **A question that lost its `?` (or an exclamation its `!`) is warned
  about** by `sync` and `verify`, accepting each script's own marks (`？`,
  `؟`, Greek `;`, `¿…?`, `！`). A warning, not a refusal: some languages mark
  a question with a particle.
- **The docs show a local fallback** (`"fallback": { "method": "local",
  "model": "<your local model>" }`) next to the hosted one, and when to use
  which; a test runs one filling a key the primary's gate refused.
- **`translateWithFallback` (with `translateAndValidate`,
  `previewRequests` and `createFallbackBudget`) is exported from the
  package** — one pair's pipeline, as `sync` and `serve` run it — and reads
  the project from `options.cwd`: a method's key and endpoint (`.env`,
  `.env.local`), coaching and glossary, the request URL of an
  OpenAI-compatible server, and a local fallback's price no longer come
  from `process.cwd()` when a project directory is given. Callers that run
  outside the project (the MCP `translate` tool) no longer need to swap
  `process.cwd()` for the call.
- `verify`, run after a sync of a project with Markdown content, works on
  the cache the content step saved (it used the key-value step's copy, so an
  eviction could drop the content step's new entries).

### Fixed — one prompt for every LLM method, model ids per method, cached Markdown checked (Round 6)

- **`openai`, `anthropic`, `gemini` and `local` send exactly the prompt `llm`
  sends.** They built a shorter system message of their own: no protected
  terms, no prompt context, no gender guidance, no `coachingFile` text — so a
  brand name in `protectedTerms` could be translated by a model on your own
  machine and kept by `llm`. Every LLM method now builds its prompt from one
  reader of the pair (register, gender guidance, prompt context, protected
  terms, coaching guidance) and one user message (the glossary terms a batch
  contains, the per-key instructions, the batch); only the transport differs.
  `sync --dry --show-prompt` shows the same messages for all five.
  `llm-coached` (which also dropped the protected terms) sends the same prompt
  plus its coaching.
- **The project glossary reaches every LLM method.** The `dictionary` in
  `.champollion/coaching/<locale>.json` was given to the direct providers
  only, while sync checked every method's output against it; `llm` now gets
  the batch's glossary terms too. The file's grammar rules and style notes
  are coaching — read by `llm-coached` (on any provider) only, as the docs
  said; the direct providers used to add them on their own. A plain method
  in a project that has them says once how to use them
  (`"method": "llm-coached", "provider": "openai"`).
- **A model id is the method's own.** A config `model` of
  `google/gemini-2.5-flash` with `--method openai` was sent to OpenAI as is
  (with a warning) and every request failed. An OpenRouter-style id is now
  mapped to the provider's name where it has the model (`openai/gpt-5.5` →
  `gpt-5.5`, `anthropic/claude-haiku-4.5` → `claude-haiku-4-5`,
  `google/gemini-2.5-flash` → `gemini-2.5-flash` on `gemini`), and refused
  before anything is sent where it has none — naming where the id was set, a
  model that method runs, and the method that can run it. Aliases from
  `shared/model-aliases.json` resolve first; `--model gemini-flash` used to
  reach OpenRouter as `gemini-flash` itself. `local` and an OpenAI-compatible
  gateway (`OPENAI_API_BASE`) get the id as written, and the model-list
  check no longer sends a gateway's key to api.openai.com.
- **Cached Markdown goes through the repeat check.** Front-matter fields,
  blocks and whole bodies served from the cache skipped the "same text for
  different source strings" check that cached keys go through (only `verify`
  caught them on disk). A page's cached content is now checked as one batch
  before any of it is served; a repeat is removed from the cache and
  translated again. The Docusaurus lane checks its Markdown pages too (fresh
  and cached), not only its UI strings.
- **`status` names a default model only when a pair runs it.** An api-only
  project printed the built-in OpenRouter default; it now shows the
  endpoint(s). Pairs whose method runs no model of ours (`api`, DeepL, Google
  Translate…) show no model (they said `model: auto`). `--json`:
  `defaultModel` is `null` when unused, `endpoints` lists the api endpoints,
  each pair carries `endpoint`.

### Fixed — what synthetic Next.js, i18next, Django, hospital and school developers ran into (Round 5)

- **The license is said where you decide to adopt the CLI.** The README's top
  section, the Installation and Quick Start pages, and `init` on a fresh
  project (once, not on a `--force` rerun) now say it plainly: PolyForm
  Noncommercial 1.0.0 — free for noncommercial use; using it for a commercial
  purpose is not covered. It used to appear only at the bottom of the README.
- **`sync --dry --max-cost` says what the cap would do.** A dry run over the
  cap now says the real run would stop there before any API call and exit
  `2` (and says so again at the end, beside the preflight verdict); under the
  cap it says the run would go ahead. `--json` carries
  `maxCost: { cap, estimatedCost, wouldStop, exitCode? }`. The dry run itself
  still exits `0`. Same on the Docusaurus path.
- **A dry run explains 0 cache hits after a method switch**, as the real run
  does ("… have translations in the cache from local · model … — not reused:
  the cache is kept per method"). The note no longer counts the pair's own
  fallback entries, or a text twice.
- **"Model changed: N cached translations … will be reused" is said only when
  the run reuses them** — the keys this run needs that the previous model's
  cache serves. A sync that processes nothing says nothing; `status` carries
  the standing fact.
- **`integrity` follows sync's plural rule.** A missing French `many` (only
  numbers above 1000 or fractions reach it) is a note, worded as sync words
  it; a missing Russian `few`/`many` stays a warning. One rule
  (`pluralGaps`), one wording.
- **`tm stats` prints local time with the zone** ("2026-10-03 20:30 MDT"):
  the bare UTC date read as a day ahead in the evening. `--json` adds the
  stored `createdAt` / `lastEntryAt` ISO timestamps.
- **`init` writes the registers it chose** into `languages`
  (`{ "fr": "formal-vous", "es": "neutral-latam" }`), lists each language's
  other presets and says how to change one; a language with no presets is
  `{}`. Existing list-form configs keep working. (`champollion seo` now reads
  the object form too — it read only the list.)
- **`init --method api --endpoint <url>`** writes the pair entry the model's
  `DEPLOY.md` shows (`{ "method": "api", "endpoint": …,
  "acceptsInstructions": … }`, one per target); `--accepts-instructions
  true|false`, else the value of an installed plugin manifest for that
  endpoint. A key is asked for only for an endpoint off this machine.
- **`sync --dry --show-prompt [key]`** prints the exact request the method
  would be sent — system and user messages, or the `api` request body —
  built by the method's own code at its transport, with keys redacted, and
  sends nothing. With a key (`verb␄Open`), it shows whether a gettext
  `msgctxt` or `#.` comment reaches the model. `--json`: a `request` event.
- **"quality gate rejected N key(s) — retrying" names each key's reason**
  under the line (a key that passes on the retry is never in the final
  `[GATE]` block, so this was the only place it could be said).
- **One memorized sentence for different source strings is refused
  everywhere.** Three different clinical prompts came back as one sentence
  and passed the gate, the fallback and `verify`. Now: cache reads (another
  tool's entries, the fallback's cache) are held to the shared-output rule;
  the locale's values already on disk count (a key added per sync is
  caught); every answer counts, not only those that passed other checks;
  outputs are compared with case, punctuation and a Markdown block marker
  aside (`S?`, `S.`, `# S`); each ICU plural/select branch counts (the
  branches of one plural as one source); the Docusaurus path uses the index
  too. `verify` reports the pattern as an **error** inside the locale's
  block, counting key values, branches and the locale's Markdown pages. The
  MCP `translate` tool refuses it within a call and never caches it.
- **`network recommend` no longer calls a method READY when its coverage of
  the pair is not indexed** (apertium for `abc`): such a method is
  `UNVERIFIED — coverage not indexed, check the service` (`"availability":
  "unverified"` in `--json`), listed after the ready ones. The harness's
  `recommend` twin says the same.
- **Docs.** The CI guide's workflows check sync's exit code right after the
  commit, before `verify`, so the failing step says why (a `--max-cost` stop
  or untranslated keys); the generic workflow carries the hosted-model
  override for a `local` project in the YAML, and the guide says the cache
  is per method (what a `local` dev machine and a hosted CI model share, and
  what CI pays). The `--json` output shape is documented exactly (NDJSON,
  each line's `level`, select the summary with
  `jq 'select(.level == "summary")'`). The README and docs use the canonical
  `champollion network …` forms (the aliases still work), and one example
  model id from `shared/model-aliases.json` (`google/gemini-3.5-flash`).
  The Django section says which method and key to use and how to clear
  `msgfmt -c`'s header warnings on catalogs `makemessages` started.

### Fixed — what synthetic Next.js, i18next, Django and school developers ran into (Round 4)

- **A redo that could not finish is remembered.** After `sync --redo all
  --fresh-on-model-change` the gate refused three keys and the run said they
  "will be retried on the next sync" — but the next sync did nothing (the
  keys exist on disk with an unchanged source), so the model switch never
  completed and `status` said nothing. Keys an explicit redo (`--redo all`,
  `--redo keys:`, a model switch) leaves untranslated are now recorded as
  **pending** in `.champollion.lock`; the next plain sync asks the model for
  exactly those once more (from the model, not the cache), clears them on
  success, and `status` lists them. When the last one is done the switch is
  complete and the "Model changed" notice stops.
- **Refused keys are not re-billed on every sync.** A key the quality gate
  refused used to be re-sent to the same paid model on every run. The
  refusal is now remembered per key, source text and method/model, and a
  plain sync holds the key back — not sent, not billed — saying how many and
  how to proceed: `--redo keys:<key>` asks again, or fill it with a
  `"fallback"` method (asked for keys the pair's own method refused),
  `"noTranslate"`, or by hand. A new source text, model or method lifts the
  hold. Precedence: a key named by `--redo`/`--fresh` is always sent; a
  pending key gets one retry; a refused key is held back (a pending retry
  refused again stays pending and is held). A held-back key is untranslated,
  so sync exits `2` until it is filled; the estimate does not price it.
- **A person's edit in a key-value file survives a bulk redo.** `--redo all`
  (the command the model-change notice recommends) overwrote a hand-fixed
  French string with cached machine text. Sync now records, per locale and
  key, a fingerprint of the value it wrote (and of the source it
  translated); a value that no longer matches was changed by a person.
  `--redo all`, `--force`, a model switch and a pending retry keep it and
  say so (`kept 1 hand-edited value(s) … --redo keys:<k> replaces one`); a
  redo naming the key replaces it; a key whose source changed is
  re-translated — and in both cases the edited wording is printed and
  appended to `.champollion-replaced-edits.jsonl` (tracked, next to the
  lock), so it is never lost. Values with no fingerprint (written before
  this release, or by another tool) count as Champollion's only when the
  cache holds exactly that text; otherwise they are kept. The
  `--retranslate` help no longer implies the other redo paths already
  protected edits.
- **An out-of-date translation is visible.** After a source edit whose
  re-translation failed, the old translation stayed, `verify` and `audit`
  passed and `status` showed nothing. A translation made from an older
  source text than the current one is now listed by `status`, fails `audit`
  (the completeness gate) with the command that re-translates it, and is a
  warning in `verify`.
- `verify --strict`: warnings fail the check (exit `1`) — e.g. Russian plural
  forms the model left out. Documented in the CI guide's gate table.
- A file line never reads `[OK]` when keys in it were not translated
  (`fr.json [WARN] 3 of 5 key(s) not translated (3 refused by the quality
  gate)`), and the failure summary says per key what the next sync does.
- Switching method (`local` → `llm`) explains the empty cache: once per
  locale, sync names what made the cached translations it cannot reuse
  (the cache is kept per method, register and coaching; a model change
  alone is reused).
- `status` also says when ALL the text in a locale's files came from an
  earlier model, with the command that re-translates it.
- A redo served from the cache shows `free (cache)`, and a run that sends
  nothing says so, instead of `~$0.0000`.
- **Gate and verify holes.** The disguised-echo and exact-echo checks now
  apply to every plural form (gettext `msgstr[n]`, ICU branches), with the
  singular's rules. Markup is compared per tag name — opened, closed and
  nested as in the source — in the gate and in `verify` (a lost `</strong>`
  used to pass). Letters are classified by Unicode script, so fullwidth or
  accented Latin in a Russian catalog fails the script check, and fullwidth
  Latin is refused outside CJK typography. ICU plural branches are measured
  separately by the repetition check (a correct Russian plural with added
  forms no longer reads as a loop).
- **Different inputs, same output.** A trained model returned one memorized
  sentence for the app title, "Contact the school", a newsletter title and
  its heading. One translation answering three or more different source
  strings in a locale's run (several words, or clearly different sources) is
  now refused — the retry, then the fallback, takes it — across key-value
  files, Markdown blocks and front-matter fields; `verify` reports the
  pattern on disk. Synonyms collapsing to one short word still pass.
- **`api` endpoints can say whether they follow instructions.**
  `"acceptsInstructions": false` (pair or plugin manifest; e.g. `nmt-forge
  serve`) stops the gate from re-asking an endpoint that would answer the
  same — refused keys go straight to the fallback; `true` sends an
  `instructions` object with the per-key notes; unset, the retry line says
  the endpoint may ignore the feedback.
- `champollion lint` that found no source files exits `1`, naming the
  folders and extensions it looked for.
- `init --yes --langs crk` says that Cree needs a writing-system choice,
  lists the choices and prints the exact command and config line;
  `init --script crk=Cans` records it.
- A gettext key with a context can be typed in `--redo keys:` /
  `--force-keys` as `ctx\x04msgid` (as well as `ctx␄msgid`); repair
  commands print that form.
- **CI guide**: every workflow restores and saves the cache as separate
  steps (`actions/cache/save` with `if: always()`), records sync's exit code
  so a partial run (`2`) still commits what it translated before failing the
  job, and rebases before pushing. Docs: the quality-gate page states both
  echo rules precisely (the 30-character exemption is for exact copies; a
  disguised copy goes by word count), `configuration.md` shows the full
  header of a new `.po` catalog, and the Quick Start no longer says
  unchanged keys are "served from the TM" (they are skipped).
- The lock file gains a version-2 form (`{"version": 2, "source": …,
  "locales": …}`) when there is per-locale state to record; version-1 locks
  read as before, and a project with nothing to record keeps the flat form.

### Fixed — what synthetic Django, Next.js, i18next, hospital and school developers ran into (Round 3)

- **Plural forms a translation left out are never filled in silently.** A
  Russian plural that came back with only `one` and `other` had its `few`
  and `many` written from `other`, and `verify` said all was well. Now the
  quality gate asks the model once more, naming the missing forms and the
  counts they cover (Russian `few`: 2, 3, 4); a second answer without them is
  accepted — the tool never makes a form up — and sync warns, naming each
  key, its missing forms and the command that asks again
  (`sync --pair en:ru --redo keys:… --fresh`). In a gettext catalog the
  repeated forms carry a `# champollion:` translator comment (Poedit and
  Weblate show it); `verify` reports it — in CI too, without the cache —
  until real forms are written, and reports ICU messages (next-intl, ARB)
  with a missing form the same way. Forms used only above 1000 or for
  fractions (French `many`) get an info line, not a warning. A machine
  translation engine, which cannot be told which forms to write, is not
  re-asked.
- i18next forms the source language has no key for (French `count_many`
  from English): sync says each is translated from the `_other` text and
  that the model is asked for that form — or, for DeepL/Google/…, that the
  value holds the `other` form. A coached pair with a dictionary dropped the
  per-key instructions from its prompt entirely (plural forms, ICU
  categories, gettext context); it now sends them like every other LLM pair.
- `verify` flags plural keys for a form the language does not have (French
  `count_two`), and gettext entries with more `msgstr[n]` than `nplurals`.
- `verify` warns when two target locales hold the same text for most keys
  (at least 80 % of at least 4 comparable values; locales of one language,
  like `pt-BR`/`pt-PT`, are not compared) — a model that ignored the target
  language passed every other check.
- `verify` that checked nothing fails. A missing or mistyped `localesDir`,
  a source file that is not there, or no target locale at all used to warn
  and exit 0, so a misconfigured CI gate stayed green; it now exits 1 with
  one line naming the path it looked for and the setting that points there.
- `verify`'s pass line says what it checked: "keys, placeholders, plurals,
  markup and script are intact … the meaning is not checked; have a speaker
  review". "All locales look good" read like a sign-off on a phrasebook
  whose sentences were wrong. The length rule's boundary is documented as
  the code applies it: more than 4× fails, exactly 4× passes.
- Keys with a gettext context print as `ctx␄msgid` everywhere — sync, gate
  reports, audit, gettext warnings, errors — never the invisible U+0004 (or
  `\u0004`), so a key copied from a report pastes into `--redo keys:`.
- The sync summary says what went to the model: `Synced 12 keys total — 2
  key(s) sent to the model, 10 served from the cache (free).` (`sentToModel`
  in `--json`). The cache line says what changed: `[TM] Saved 12 entries — 2
  added, 6 replaced with a new translation, 1 removed`; after a `--fresh`
  redo it used to read `+0 this sync`.
- `sync --dry` checks what the real run checks first: with a missing key it
  warns that the real run would stop and names the variable. It still exits
  0 (a preview never fails); `--json` carries `preflight: { ready, failures }`.
- A model served on this machine (`local`, or an `api` endpoint, at
  `localhost` / `127.0.0.1` / `::1`) is shown as `$0 API cost (runs on this
  machine)` instead of `unknown`, and `--max-cost` lets it run; any other
  endpoint stays unknown. In `--json`, `totalEstimatedCost` is `null`
  whenever part of the estimate is unknown (it said `0`), with
  `knownEstimatedCost` and `unknownCost.reason`; a loopback row carries
  `"local": true`.
- The "Model changed: N cached translations will be reused" notice counts
  only translations of strings the project still has (it counted entries
  for strings since edited or deleted: 12 for a 10-key project).
- `status` says when a locale's files mix two models' text after a switch,
  with the command that unifies them (`modelsInFiles` in `--json`), and
  repeats the "runs a model you choose" licence note, which sync now says
  only on a project's first sync.
- `tm stats` describes what made each locale's entries in words (`local ·
  model stub-1 · register formal-vous`) instead of the raw cache key.
- `init` prints real project-relative paths (`locale/fr/LC_MESSAGES/django.po`),
  says which method and model the config uses and how to choose another
  (`--method local --model llama3.1` for a model on this machine; also in
  `init --help` and the quick start), finds a locale folder one or two
  levels down (`app/messages`, `apps/web/locales`, …), and suggests a folder
  of Markdown for `--content-dir` without switching it on.
- Progress output is line-atomic: with locales translated in parallel, a
  progress line no longer has another locale's message appended mid-line.
  Each bar names its file; on a terminal it is redrawn in place only while
  nothing else has printed.
- CI guide, gettext: a complete Django workflow that stages only `*.po` and
  `.champollion.lock` (not the `.mo` files `compilemessages` writes), runs
  `makemessages --no-wrap` (msgmerge re-wrapped the one-line msgstr values
  champollion writes, so every sync committed whitespace), names a hosted
  method for the runner (`--method llm --model …`), and runs one sync at a
  time (`concurrency:`); every workflow uses Node 24.

### Fixed — what synthetic Django, i18next, Flutter and school developers ran into (Round 2)

- `champollion init` always keeps the cache out of git. It added
  `.champollion/` to `.gitignore` only in a folder that was already a git
  repository, so a project that ran `git init` afterwards committed the
  per-machine cache with its first `git add --all`. It now creates or
  appends `.gitignore` every time, and never adds a second line when one
  already covers the folder (`.champollion/`, `/.champollion/*`, …).
- A gettext catalog champollion creates (`init --langs`, or sync for a
  language with no catalog yet) carries the standard header: the fields and
  values `msginit --no-translator` writes (`Project-Id-Version`,
  `Report-Msgid-Bugs-To`, the template's `POT-Creation-Date`,
  `PO-Revision-Date`, `Last-Translator: Automatically generated`,
  `Language-Team: none`, `Language`, `MIME-Version`, `Content-Type`,
  `Content-Transfer-Encoding`, `Plural-Forms`). `msgfmt -c` used to warn about
  four missing fields; it now accepts the file. xgettext's `PACKAGE VERSION`
  placeholder becomes the project folder's name, as msginit does. An existing
  catalog's header is never rewritten.
- The `local` method names the address it could not reach and the setting
  that chose it: `could not reach http://localhost:8000/v1 (from
  LOCAL_API_BASE in .env)` — or `OPENAI_API_BASE`, `OPENAI_BASE_URL`, or the
  Ollama default — with the connection error (`ECONNREFUSED`). It said only
  "fetch failed". The setup help it prints after a failed run names the same
  address.
- `verify` names the repair with every damaged value it reports — a
  placeholder mismatch, an ICU structure error, a hollowed value:
  `fix: champollion sync --pair en:fr --redo keys:greeting` (`<ns>::<key>`
  when a locale spans several files, `\,` for a comma inside a key, quoted
  for the shell). A plain sync keeps a value already on disk, so the report
  used to leave people stuck. It also says whether `--fresh` is needed (it is
  not: a damaged value the cache produced has just been evicted, and
  `[TM] Evicted …` no longer claims the next plain sync re-translates it).
- `init` names your project in its hints: `xliff export --locale <your
  target>` (it said `fr` in a project whose only target was `abc`), the
  grouped `champollion network recommend <src> <target>` the guides use, and
  no stacked blank lines under "Next steps:". New `init --content-dir <dir>`
  writes `contentDir` for a folder of Markdown/MDX; a folder that does not
  exist stops init before it writes anything.
- Docs: the `defaultMethod` and pair `method` lists name every method,
  `local` included (a test now checks them against the method registry);
  `--force-keys` / `--redo keys:` can name a key with a comma (`\,`), which
  the configuration page said was impossible; the Django guide says a
  `--redo keys:<msgid>` is served from the cache unless you add `--fresh`,
  and uses one pinned form (`npx --yes champollion@0.4 …`) with a
  project-local install as the alternative; the CI guide adds the
  `makemessages` / `compilemessages` steps for gettext, says `flutter
  gen-l10n` is the app's own build step, runs the `audit`/`verify` gate after
  the sync (before it, every PR that adds a string fails), and says that sync
  needs the provider key even when nothing changed and that `--max-cost`
  stops with exit code 2; the CLI reference lists `--pair` and `--max-cost`
  and that exit code 2 also means "stopped by `--max-cost` before spending".
  Troubleshooting covers `verify` findings and an unreachable `local` server.
- `champollion network card`: where sources disagree, every value is printed
  with its source and none is elected. Endangerment has its own section
  listing every assessment (Plains Cree: five, on different scales) instead
  of a lone "● vulnerable"; the badge says it is a champollion-derived
  display tier and names its source. Disputed names, families, typology
  features and speaker counts list every claim, with scope notes such as
  "British Columbia only"; any other disputed field appears under "Other
  Fields Where Sources Differ".
- `champollion network card`: a section heading is never printed over
  nothing. Corpus Availability, Pipeline Readiness, Method Support, Speaker
  Estimates and Endangerment say `not recorded on this card (unknown, not
  "none")` and name the command to try next (`champollion network recommend
  <src> <code>`, `mt-eval corpora --source <src> --target <code>`). In npm
  installs these headings used to print empty. Corpus Availability reads
  where the atlas records corpora (OPUS parallel, monolingual, treebanks,
  speech, wordlists), and a new Language Resources section lists
  dictionaries, morphological analyzers, keyboards and documentation level.
- `recommend` no longer calls a method READY when a recorded publisher list
  says it does not cover the pair. Coverage reads the language card (through
  the card adapter — the verdict `network card` prints) as well as
  method-coverage.json, so Apertium for eng→crk is UNSUPPORTED, not "READY …
  coverage not indexed". Records that disagree are shown as disputed; the
  source language is checked too. JSON: `availability` can be `unsupported`;
  new `key_availability(_detail)` and `source_coverage(_note)`;
  `target_coverage` can be `disputed`.
- `register-corpus` names the card id after `--name` (the publisher only when
  the name has no a–z/0–9 letters) and no longer stamps `dev` on every set. A
  new optional `--role test|dev|train` adds the role only when you say it:
  `eval-<src>-<tgt>-<name>[-<role>]-v1`. It never re-derives an id already
  registered: re-registering a `--data` file whose sidecar records an earlier
  id stops and asks for `--id`, and a full `--id` is checked against the
  card-id pattern. Public-tier cards name their fetched data file after the
  card id (`curated/<id>.json`), so two public sets for one pair no longer
  share a path.
- Edits a reviewer makes to translated Markdown are kept. Correct a sentence
  in `newsletters/2026-10.crk.md`, change a different paragraph of
  `2026-10.md`, sync again: the correction stays and the run says so ("kept
  the edits made by hand to 1 paragraph(s) …"). Before, the Translation
  Memory put the old machine wording back with nothing said. Sync now records
  each paragraph it writes in `.champollion-content.lock`; edited paragraphs
  and front-matter fields whose source is unchanged are kept on every later
  sync, never billed and never cached as machine output. If the edited
  paragraph's own source changes, it is re-translated and the edited wording
  is printed. If paragraphs were added or removed, the file is left as is and
  listed on every run until it is updated by hand or named with `--redo
  files:`. Hand-translated files keep their paragraphs when the source later
  changes elsewhere. A bare `--force-content` / `--redo content` no longer
  overwrites edits; `--redo files:<path>` does. (Hugo/plain-folder content
  lane; the Docusaurus lane is not wired to this yet.)
- `sync` no longer says "Detected framework: Hugo" for any `contentDir`. It
  names Hugo only on real evidence (`hugo.toml`, a `config.toml` with Hugo
  settings, `archetypes/`, …), and for any other folder says it is a folder
  of Markdown/MDX and that each translation is written beside its source as
  `<name>.<locale>.md`. `contentDir` is documented as any folder of Markdown,
  and the `init` wizard no longer calls it a "Hugo content directory".
- A translation named with a script or numeric-region code
  (`post.zh-Hant.md`, `post.es-419.md`) is no longer taken for a source file
  and re-translated into every target on the next sync.

### Fixed — machine-translation engines are sent only your Markdown; `local` stays local

- Google, DeepL, Microsoft, LibreTranslate, Apertium, Tilde and Translated
  read a document body after a `---` separator that the default block-batch
  prompt does not have, so they were sent — and billed for — the whole LLM
  instruction prompt with every block in it. They now receive one Markdown
  block at a time and the reply is reassembled block by block.
- The `local` method no longer asks api.openai.com for a model list on every
  run.

### Added — a fallback method per pair

- A pair (in `pairs`, or a language in the object form of `languages`) can
  name a second method: `"fallback": { "method": "llm-coached", "model": "…" }`
  — any field a pair takes. The pair's own method translates first; the keys
  the quality gate refused from it or that came back empty, and the Markdown
  front-matter fields and body blocks it dropped or damaged, go to the
  fallback once and pass the same gate. Built for a model you trained
  yourself (`nmt-forge serve`, used through `api` or `local`): it handles what
  it can, and a coached model handles the `{name}` placeholders, plurals and
  short labels it breaks — in one sync, with no second config file.
- What the fallback translates is cached under its own method, and later
  syncs reuse it rather than asking the first method again (`--fresh` /
  `--retranslate` ask again). What neither translates stays failed exactly as
  before: the key keeps its lock entry and `verify` lists it; a Markdown block
  is written as `[EN] `-prefixed source.
- The fallback resolves like a pair and is validated up front: an unknown
  method, a fallback identical to its pair, or a `script` on the fallback
  stops the sync naming the pair, and its readiness (API key) is checked
  before anything runs. `--method` / `--model` override the pair's own method
  only, never the fallback.
- Cost: the pre-run estimate cannot know what will fail, so each fallback
  batch is priced just before it runs. Under `--max-cost` a batch that would
  pass the cap — or a fallback with no price — is skipped with a warning
  naming the keys; they stay failed (non-zero exit, as for any partial
  failure).
- Reporting: `sync` prints `[FALLBACK] en:crk — 6 key(s) the primary (api)
  could not translate safely → translated by llm-coached (4 accepted, 2 still
  failing)`; the `--json` summary carries `fallback: { method, attempted,
  accepted, failed, cached }` per locale (and under `content.fallback` for
  Markdown); `champollion status` shows the fallback under its pair; and
  `champollion serve` applies it within its cost caps. Works for key-value
  files, Hugo content and Docusaurus (JSON and Markdown).
- The Hugo content lane's inline progress marker for blocks written as
  `[EN] `-prefixed source was ` [FALLBACK]`; it is now ` [EN]`, so
  `[FALLBACK]` only ever means the fallback method.

### Fixed — the object form of `languages` keeps every field it documents

- `"languages": { "fr": { "method": "api", "endpoint": "…" } }` ran with no
  endpoint: the object form passed on only method, model, provider,
  batchSize, maxRetries, script and scriptFallback. `endpoint`, `temperature`,
  `coachingFile`, `coachingPrompt`, `promptContext` and `contentSegmentation`
  were dropped without a word, though the docs list them. They now reach the
  pair.

### Fixed — the glossary is checked for every method

- The terminology check (`[TERM]` warnings) needed the glossary on the pair
  and nothing put it there, so it never ran. The project glossary
  (`.champollion/coaching/<locale>.json` → `dictionary`) is now checked against
  every method's output; `llm-coached` and `deepl` still also apply it while
  translating.

### Fixed — `--method` and the lock file say what they do

- `sync --method X` overrides a pair's own configured method (and that
  pair's model/provider, which belong to it) for the run, and names the
  pairs it overrode; `--pair` scopes it. It used to set only the default,
  so `sync --method local` — what a forge export's DEPLOY.md says to run —
  silently kept a pair configured for llm.
- Sync warns once when there is no `.champollion.lock` but target files
  already hold translations: it cannot tell which are out of date and keeps
  them all. The unreadable-lock error claimed the opposite (a full-cost
  re-translation); it now says what really happens and offers `--redo all`.

### Added — `--redo` / `--fresh`, and `champollion network`

- `sync --redo all | keys:<k1,k2> | content | files:<glob>` says what to
  translate again (cached text is still served, so it is cheap); `--fresh`
  says to pay for it anew. They replace six overlapping flags, which keep
  working as aliases: `--force` (= `--redo all`), `--force-keys`
  (= `--redo keys:`), `--force-content` (= `--redo content`),
  `--retranslate` (= `--redo files: --fresh`), `--no-tm` (= `--fresh`).
  `\,` writes a comma inside a key (gettext keys are sentences).
- `champollion network card | recommend | leaderboard | register-corpus |
  seal-corpus | submit` groups the commands that work with the shared index
  and leaderboard; each still works without the prefix. The top-level help
  is grouped the same way and lists `po`/`arb`.

### Added — your project's own locale layout
- **i18next folder-per-language projects sync as they are.**
  `public/locales/en/common.json` (one folder per language, one file per
  namespace, nested paths like `admin/users` included) is detected and
  synced file by file into `fr/common.json`, `fr/admin/users.json`, …
  Missing folders and files are created. No flatten/unflatten script.
- **`localesPattern`** describes any other layout with `{lang}` and an
  optional `{ns}`, e.g. `"src/i18n/{ns}/{lang}.json"`. `localesLayout`
  (`"flat"` or `"dir"`) overrides detection. When `en.json` and a populated
  `en/` both exist, sync stops and asks you to choose instead of guessing.
- **`champollion init` finds your locale files.** It checks your framework's
  usual folder (next-intl `messages/`, i18next `public/locales/` then
  `locales/`, vue-i18n `src/locales/`, Hugo `i18n/`), then common ones, and
  says what it found and why. `init --yes` no longer writes a `localesDir`
  that does not exist. Without `--langs` it ends with the next step to take.
  `init --langs fr,de` creates the empty target files in your layout.
- **i18next plural keys get each language's own forms.** `key_one` and
  `key_other` in the source become exactly the target's CLDR categories
  (from `Intl.PluralRules`): French and Spanish gain `_many`, Japanese keeps
  only `_other`. New forms are translated from `_other`, `_one` from `_one`.
  A form an earlier sync wrote that the language does not use is removed
  only when the Translation Memory shows sync wrote it.
- In a multi-file language, `.champollion.lock`, `--force-keys`, `xliff`
  unit ids and `sync --dry --json` use `<namespace>::<key>`. A bare
  `--force-keys` key matches in every file. One-file-per-language projects
  are unchanged: same lock keys, file paths and output.
- A string that appears in several namespace files is translated once per
  language; the other files get it from the Translation Memory. The cost
  estimate counts it once.

### Added — gettext (.po) and Flutter (.arb)
- **Flutter ARB files sync as Flutter needs them.** Set
  `"localesPattern": "lib/l10n/app_{lang}.arb"`. Only messages are
  translated. `@@locale` is set to the target (`pt_BR` for `app_pt_BR.arb`),
  every `@key` metadata object is copied from the source, and keys keep the
  source's order. Before, an `.arb` read as JSON had `@@locale` translated to
  `"én"` and placeholder types `String`/`int` translated, and
  `flutter gen-l10n` refused to build. Message descriptions are sent to the
  model as context.
- **gettext catalogs (`.po`) sync with their structure intact.** Django
  (`locale/{lang}/LC_MESSAGES/{ns}.po`), Babel/Flask and GNU `po/`
  layouts work. The source is the source language's catalog
  (`makemessages -l en`) or a `.pot` template. Each msgid is a key; a
  `msgctxt` makes a separate key and a separate cache entry, so "Open" the
  verb and "Open" the adjective are translated separately. Empty and `fuzzy`
  entries are untranslated; sync translates them and clears `fuzzy`.
  Translator comments are kept, references and flags come from the source,
  and entries sync did not change are written back byte for byte.
- **gettext plurals get each language's number of forms.** A plural entry
  is translated as one ICU plural message and written to `msgstr[0…n]`
  through the target's `Plural-Forms` header. A catalog without one gets a
  header derived from CLDR and checked against `Intl.PluralRules` (Russian:
  3 forms; French: 3, as Babel writes since CLDR 42). If a language's rules
  cannot be derived, sync stops and gives the `msginit` command that writes
  the header.
- **`champollion init` sets up Flutter and gettext projects.** A Flutter app
  (`pubspec.yaml`, plus `l10n.yaml` if present) gets
  `"localesPattern": "lib/l10n/app_{lang}.arb"` and the template's source
  language. A Django project (`manage.py` +
  `locale/<lang>/LC_MESSAGES/*.po`), Babel `translations/` or GNU `po/` gets
  its gettext pattern. `--langs` creates each target, an `.arb` with its
  `@@locale` and a `.po` with a header. When the template or source catalog
  is missing, init says which command creates it.
- **`verify --pair en:fr`** checks only the named pairs.
- **`xliff` round-trips gettext keys.** A key with a context is exported as
  `verb␄Open`, since XML cannot hold the U+0004 separator. A multi-line msgid
  keeps its newlines through a CAT tool. Importing into `.po` or `.arb`
  rebuilds the file from its source, keeping plural entries and metadata.
- `wrap` refuses Flutter and gettext projects before changing any file.
  ARB keys must be Dart identifiers, and in gettext the key is the source
  text, so `t('dotted.key')` calls fit neither. The message gives the
  workflow that does fit.
- `init --help` now lists the `local` method (your own model), which init
  already accepted, and every `--format` value (`po`, `arb`).

### Changed — cost
- **Switching model reuses your cached translations.** Text already
  translated under the previous model (same method, register and coaching)
  is served from the Translation Memory at no cost, and sync says so before
  the estimate. `--fresh-on-model-change` re-translates with the new model
  instead. A method, register or coaching change still re-translates.
- **The cost estimate prices only what the run will bill** in both content
  lanes. Front-matter fields and Markdown blocks already in the Translation
  Memory are $0, so `--max-cost` no longer refuses runs that are mostly
  cached. The table shows what the cache saves.
- **A failed content file costs only itself.** The other files finish, are
  recorded, and keep their cached translations. Before, one failure
  discarded every success's cache entries, and on Hugo it stopped the run.

### Added
- `sync --files <glob>` limits a run to some content files.
  `sync --retranslate <glob>` translates named content files fresh,
  bypassing the lock, the keep-hand-translated rule and the cache. A
  pattern that matches nothing stops the run before anything is spent.
- `champollion lint` understands Docusaurus: `<Translate>` and `translate({ id })`
  count as translated, raw JSX prose is flagged, and files with prose but
  no `@docusaurus/Translate` import are reported. Text in `<code>` is no
  longer flagged in any framework.
- `protectedTerms` config: names kept exactly as written in every language
  (e.g. `["Curtis Forbes", "Game Day Suits"]`).
- `sync --json`: a `cost` event before the `--max-cost` gate, a `file`
  event per content file and locale, and a summary on the Docusaurus path
  too.

### Fixed
- **Translated ICU syntax is rejected.** A value such as
  `{cóúnt, plúrál, óné {# event} óthér {# events}}` used to pass the quality
  gate, be written, locked and cached. The gate now parses ICU MessageFormat
  in the source and the translation. Variable names, `plural`/`select`/
  `selectordinal`, selectors (`one`, `other`, `=0`, `male`), `#`, `offset`,
  `{placeholders}` and printf conversions (`%s`, `%(name)d`) must survive.
  Only the text inside the branches may change. A plural may add the
  categories the target language uses, such as French `many` or Polish
  `few`/`many`. A rejected value gets one retry that names the damage, for
  example "ICU keyword 'other' was translated to 'óthér'". The prompt
  explains the syntax and lists the target language's CLDR categories.
- **`verify` and `integrity` report ICU damage already on disk**, and ARB
  damage outside the messages (a wrong `@@locale`, translated placeholder
  types).
- **A damaged value no longer comes back from the cache.** When `verify`
  (after sync or on its own) or `integrity` finds a damaged value that the
  Translation Memory produced, that entry is removed. `sync --force-keys`
  then re-translates the key instead of serving the same text for free. A
  cached value that fails the gate is removed from whichever model's entry
  served it. Hand-written values are never touched.
- **Post-sync verification checks only the pairs that ran.**
  `sync --pair en:fr` no longer reports errors in Spanish.
- **Names no longer fail verification**, so you no longer need
  `--no-verify`. Post-sync verification rejected any Latin-script value in a
  non-Latin locale, including names the quality gate had accepted. Verify
  and the gate now agree: protected terms and names the gate settled pass.
- **Labels are no longer left in English.** The prompts told models to keep
  "role descriptions" in English, and the gate waved short Latin-script
  values through, so "Translation CLI" reached Arabic and Thai pages
  untranslated. Every prompt now says descriptive labels are not names. A
  short Latin-script value in a non-Latin language gets one retry asking
  "name or label?". A value kept twice is accepted as a name and cached.
- Docusaurus tagged `[FAIL]` on whichever file finished last, not on the one
  that failed. The run now ends with a list of failed files and what each
  was left as.
- A partly failed sync exits `2` (partial), not `1`. The Docusaurus path had
  no summary and exited `0`.
- `--force-content` now works on Hugo projects; it was only wired for
  Docusaurus.
- **`verify` and `integrity` check `en-GB` when the source is `en`.** Target
  files were found by prefix, so every locale starting with the source code
  was skipped.
- **A `.yml` project works.** The source `en.yml` was looked up as `en.yaml`
  and not found. Targets now keep the source's extension.
- An unknown `format` (e.g. `"jsn"`, `"yml"`) stops with the supported list.
  Before, it was read as JSON.
- `wrap` writes extracted keys into TOML and YAML locale files too (it only
  looked for `<locale>.json`, so those keys were lost), and stops before
  rewriting any component when it has nowhere to store the keys.
- `lint --ignore` was rejected by the argument parser.
- In `--json` mode, gate, terminology and unknown-config warnings are JSON
  on stderr too.


### Changed — what gets sent to a provider
- **`provider` in `champollion.config.json` now takes effect.** It is a real
  field (top level, per language, per pair): `openrouter` (default),
  `openai`, `anthropic`, `gemini` or `local`. Before, it did nothing: the
  pair graph dropped it and a top-level `provider` was reported as a
  misspelling of `defaultMethod`, so every coached run — including configs
  written by the harness's `mt-eval export-config` for a run validated on a
  direct provider — **was sent to OpenRouter** with the OpenRouter model.
  Now:
  - an `llm-coached` pair with `provider: "openai"` calls
    `api.openai.com` (and so on), with coaching intact;
  - a plain `llm` pair with a direct provider runs as that provider's method
    (`llm` + `provider: "openai"` → `openai`), which is what an exported
    naive run needs;
  - a top-level `model` written next to a top-level `provider` is sent to
    that provider; with no model written, the provider's own default is used
    — never the OpenRouter default slug;
  - preflight asks for that provider's key (e.g. `OPENAI_API_KEY`) instead
    of `OPENROUTER_API_KEY`, and the cost estimate uses that provider's
    pricing (`local` stays honestly unpriced);
  - an unknown provider, or a `provider` on a method that picks its own
    engine (e.g. `deepl`), fails at config time instead of running.
- **The `local` method sends its own default model (`llama3.1`)** when no
  model is configured. Before, `local` was missing from the list of
  direct-provider methods, so the global OpenRouter slug
  (`google/gemini-3.5-flash`) was sent to Ollama.
- A `pairs` override that changes a pair's method no longer carries the
  previous method's defaulted model over (an OpenRouter slug could reach a
  direct provider that way).

### Fixed
- **`champollion init` warns again when a per-language engine does not cover
  the language** (e.g. DeepL for Swahili, LibreTranslate for Plains Cree).
  The check compared the card's support entry — an object like
  `{ supported: false }` — to `false`, so it never fired, and it looked
  `libretranslate` up under the wrong key.
- **External (Python) method plugins:**
  - With no `temperature` in the config, the plugin now gets the harness
    default (0.0), the same value it gets under `mt-eval`. The bridge used
    to give it 0.3 (or `None`), so one module ran at two temperatures.
  - One bridge process per plugin serves the whole run and is stopped when
    the run ends. Before, every batch, preflight check and content file
    started a new Python process and none were stopped.
  - When `python3` is missing, the bridge now falls back to `python`. The
    fallback never ran before: the spawn failure arrives as an event, and the
    handler threw an uncaught error that crashed the CLI.

## [0.3.4] - 2026-09-27

Integrity release: corrections to bundled data, script conversion, and what
the CLI and README claim.

### Fixed
- **Plains Cree syllabics (`crk` → `Cans`) come from ALTLab's
  `cree-sro-syllabics`** (MIT, new dependency) in both directions. The old
  hand-written map produced wrong syllabics — for example it turned `th` into
  `ᖧ`, which is not Plains Cree.
- **Script converters never touch placeholders.** ICU plural/select syntax,
  `{name}`, `%s`, `{{mustache}}`, HTML tags, URLs and email addresses pass
  through byte for byte; only translatable text is converted. If Latin
  letters are left outside those spans, the value stays in its working
  script and is flagged.
- **Two Grambank-derived card fields read the wrong feature.**
  `hasObliqueCase` now reads GB072 and `marksPresentTense` reads GB082
  (atlas 2026.9.1). The bundled cards are rebuilt from it.
- **Vitality tier.** When a source holds several assessments (ELCat keeps one
  per record), the tier comes from the one it is most certain of, and a
  record with no tier ("at risk") no longer makes the reader skip that
  source. This changes the derived tier on 209 of 8,723 language cards — for
  example Plains Cree reads "vulnerable" from ELCat's 0.8-certainty record,
  not "endangered" from its 0.2-certainty one.
- **`register-corpus --tier sealed` says what actually happens:** the
  ciphertext is written where you choose and stays with you; only a
  content-free card is registered. The CLI, its help and the sealed card's
  own note used to say Champollion receives the ciphertext.
- `register-corpus` prints the real registry rebuild command
  (`python3 arena/scripts/build_registry.py`), not an npm script that does
  not exist.

### Changed
- Card `metricModelSupport` separates a metric publisher's pivot languages
  (listed as pass-through, never targets) from its targets, and records QE
  checkpoints (`shared/catalogue/metric-coverage.json`).
- The Plains Cree IP notice in the bundled card config no longer cites a
  trademarked sovereignty framework by name.
- README: the quality gate is described by what it checks — broken output
  (empty, echoed, looping, over-long, deleted or wrong-script), not meaning —
  and examples use shipped methods (`llm-coached`) instead of a Cree plugin
  that never existed.

## [0.3.3] - 2026-08-17

Pre-beta hardening release.

### Changed
- **License: PolyForm Noncommercial 1.0.0** (from Apache-2.0, decided before
  any npm publication — no release ever shipped under the old license). Free
  for noncommercial use; commercial use requires permission. The eval harness
  (`mt-eval`) and the shared registries remain open source (AGPL-3.0 /
  Apache-2.0) — see the repository's root LICENSE for the shape of the split.
- **Language cards ship from atlas release 2026.8.0** — the corpus now carries
  a named `_atlas.version` on every card (was `unreleased`), so consumers can
  pin a build via `requireAtlas()`. Includes the method-coverage countBasis
  restructure (188 cards' methodSupport evidence re-sourced).

### Added
- **The card reader is public API**: `normalizeCard`, `display`,
  `attributions`, `readCard`, `listCodes`, `atlasVersion`, `requireAtlas` and
  friends re-export from the package root — out-of-repo consumers (the MCP
  server depends on this) read cards through the same one adapter as
  everything else.
- **Eval wiring attaches at read time**: `evalStandard`/`evalMetrics`/
  `evalPack`/`evalDatasets` from the bundled card-config now reach cards in
  the JS runtime (the Python harness always did this) — `champollion card crk`
  shows its eval section again.
- **`vitality-scales.json` is bundled**, so the vitality bridge (endangerment
  → display tier) works in installed packages, not just repo checkouts.
- **`npm run test:pack`**: packs the real tarball, installs it in a scratch
  project, and runs the installed bin — wired into `prepublishOnly`.

### Fixed
- **OMT-1600 tier vocabulary.** `omt1600.tier` shipped values `R1`–`R5`,
  which are not resource tiers — in the Omnilingual MT paper
  ([arXiv:2603.16309](https://arxiv.org/abs/2603.16309)) `R1`/`R2` label
  Met-BOUQuET **annotation rounds**, and `R3`–`R5` do not exist as round
  labels at all. The paper's resource tiers (§3.3, Figure 3.2) are `high`
  (>50M parallel documents), `mid` (>1M), `low` (40K–1M), `very_low` (1K–40K)
  and `zero` (<1K), and it publishes no per-language tier table. The schema
  now enumerates the paper's five tiers plus `null`, and the 87 mislabeled
  values were cleared to `null` rather than remapped — an uncitable value is
  removed, never inferred (`scripts/fix-omt1600-tier-vocabulary.mjs`,
  idempotent).
- `champollion card <lang>` printed `tier null` for every OMT-1600-covered
  language without a cited tier; the tier clause is now omitted unless there
  is one.

## [0.3.2] - 2026-08-10

Visibility-and-agreement release, from the second round of 0.3.1 production
feedback. **Consumers vendoring the tarball must re-point at
`champollion-0.3.2.tgz`.**

### Fixed
- **`integrity` now honors the same echo stamps `sync` does.** Its
  untranslated-copies check never consulted the Translation Memory, so every
  gate-approved, TM-stamped echo read as an issue — 2,946 "problems" on a
  project sync reported as fully synced, failing any build gated on
  integrity. Both `integrity` and `verify` now apply the diff's
  confirmed-echo suppression; what they flag is exactly what sync would
  requeue. (An unstamped echo is still flagged — the suppression is
  TM-evidence-based, never blanket.)
- In `--json` mode the "Estimated translation cost:" header emitted as a
  dataless NDJSON event (info header, raw body). The header now travels with
  the body; the structured estimate rides the end-of-run summary as before.
- `diffLabel` itemizes **forced** keys, so `--force-keys a,b` over a locale
  with requeued echoes no longer prints an unexplained total — the per-locale
  line reads `2 forced + 75 untranslated`.

### Added
- **Dry runs name their work.** `sync --dry --list-keys` prints every queued
  key grouped by reason (missing / [EN] fallback / unstamped echo / changed /
  forced / copy-verbatim), and `sync --dry --json` always carries the same
  lists per locale (`locales[].queuedKeys`) — no more re-implementing the
  diff by hand to see what a sync plans to do.
- Troubleshooting: documented the **one-time echo requeue after `--no-tm`
  cleanups** — values written under `--no-tm` are unstamped, so
  source-equal ones requeue once on the next sync, come back, get stamped,
  and settle. Expected, self-limiting, previewable with `--dry --list-keys`.


## [0.3.1] - 2026-08-09

The upgrade-recovery release, built from the 0.3.0 adoption findings: values
poisoned by old versions never self-healed (their manifest hashes read as
settled, so no gate ever saw them again), and the cache would serve the old
damage back during a manual repair.

**Consumers vendoring the tarball must re-point at `champollion-0.3.1.tgz`.**

### Added
- **`sync --force` — the whole-locale rebuild verb.** Re-queues every source
  key; scope with `--pair` (`champollion sync --pair en:tlh --force`).
  Previously the only route was deleting the locale file by hand. The cost
  estimate prices the full rebuild, so `--max-cost` can cap it, and `--dry`
  previews it. In Docusaurus projects it re-queues the Phase-1 UI strings;
  Markdown keeps its own `--force-content` switch.
- **`integrity` and `verify` detect old hollowed damage** (`HOLLOWED
  VALUES`): a target that is its source with the letters deleted — written by
  a pipeline older than the content-preservation gate — is reported with the
  exact rebuild command, and drives exit 1. Same two-signal rule as the gate
  (retention + subsequence), so terse CJK is never flagged.
- **Troubleshooting guide: "Recovering From a Bad Version"** — the audit →
  repair-script → forced-rebuild recipe for upgraders, in one place.

### Fixed
- **Translation Memory hits are validated against the current gates before
  being served.** The content lanes (Hugo front matter and bodies, Docusaurus
  Phase 2) served cached values with no validation at all, so an entry stored
  by a gateless pipeline was re-served forever — a cache is a time machine.
  A hit that fails today's gate is evicted and re-billed as a miss; every
  future gate improvement now retroactively cleans the cache, with no version
  bookkeeping. (The key-value lane already gate-checked hits at requeue
  time.)
- **The feedback retry now fires for every method.** It was gated on the
  OpenRouter API key, so direct providers (google-translate, deepl, …) never
  got the one corrective round — which also meant an evicted poisoned cache
  entry was only re-billed on the NEXT sync, a two-pass heal nobody asked
  for. The retry runs through the pair's own method and needs no OpenRouter
  key. One consequence worth knowing: gate rejections on direct providers now
  cost one retry call, as they always did on LLM methods.
- Documented the intended gate-failure semantics explicitly (quality-gate
  docs): a rejection whose feedback retry passes is written and the sync is
  green; only keys still failing after the retry drive a non-zero exit.

## [0.3.0] - 2026-08-09

**Behavior change: script conversion is now choose-or-decline, never
automatic.** Until now, any locale with a registered script converter had its
output rewritten unconditionally. For pIqaD, Tengwar and Kryptonian — scripts
that are NOT in Unicode — that meant Private Use Area codepoints, which render
as nothing without a purpose-built font. A downstream project shipping
Latin-transliteration fonts got blank strings: 96 unrenderable keys and 129
mixed-script keys (the converters silently passed through letters they could
not map), with more converted on every sync.

**Consumers vendoring the tarball must re-point at `champollion-0.3.0.tgz`**
(a same-version tarball can be served from npm's cache) and should run
`champollion repair-script` once after upgrading.

### Changed
- **PUA display scripts (tlh → pIqaD, x-elvish-s → Tengwar, x-kryptonian)
  default to romanization** — the only output that renders without a custom
  font. Opt in per language or per pair: `"script": "Piqd"`, `"Teng"`, or
  `"x-kryptonian"` (Kryptonian has no ISO 15924 code, so the converter key is
  the escape hatch, valid only on its own locale).
- **Dual real-orthography locales (crk → Syllabics, sr → Cyrillic) now
  REQUIRE the choice.** Cree Syllabics and Cyrillic are ordinary Unicode and
  both orthographies are in real use — picking one is a decision about a
  community's writing system, and it belongs to the project, never to a
  default. `champollion init` asks when the language is selected; `sync`
  refuses to run until the config sets `"script": "Cans"` / `"Latn"` (crk) or
  `"Cyrl"` / `"Latn"` (sr). Migration for anyone relying on the old automatic
  conversion is that one config line.
- `script:` accepts any casing of a valid ISO 15924 code (`"cans"` → `Cans` —
  the old docs used lowercase). Legacy word values (`"syllabics"`) fail loud
  with the exact replacement named. A script the locale cannot produce fails
  listing what it can. All validation happens at pair-graph build — before
  any API call, in `--dry` runs too.
- `champollion status` shows the resolved script decision per pair instead of
  the converter's registry key; `fonts` only calls a font *needed* when the
  resolution actually emits PUA.

### Added
- **`scriptFallback` — user-declared transliteration rules** for letters a
  converter cannot map (Klingon has no d, c, f, g, i, k, s, x, z, so "GitHub"
  cannot fully convert): `"scriptFallback": { "d": "D", "f": "p" }`, applied
  before conversion and validated at startup (a replacement must itself be
  fully mapped). Champollion ships no fallback rules of its own — inventing
  orthographic adaptations, especially for a real language, is not an index's
  call. The docs list where community conventions exist.
- **Mixed-script output is refused.** When letters remain unmappable after
  fallbacks, the WHOLE value stays in the working script, with a per-key
  warning naming the letters and the `scriptFallback` line that would map
  them. Deliberately not a failure: unmappable proper nouns would fail
  identically on every retry, and a permanently red sync is the trap the
  0.2.0 no-translate lane exists to close. Counted in the run summary as
  `keptWorkingScript`.
- **`champollion repair-script`** — reverses conversion that should never
  have happened. Scans locales whose resolution says conversion is off for
  PUA codepoints and restores romanization via each converter's own reverse
  table (`--dry` to preview, `--locale` to scope). pIqaD reverses exactly;
  Tengwar/Kryptonian reversals are case-lossy and say so. Foreign PUA no
  converter owns is left in place, reported, and exits 1 — the file still
  cannot render. The TM and hash manifest need no repair: the TM stores
  pre-conversion values (verified), and the manifest hashes source values.
- **`champollion integrity` fails on unexpected PUA** (`UNEXPECTED PUA`,
  exit 1): PUA found in a locale whose conversion is off renders blank, and
  the report names `repair-script` as the fix — so a build gate catches
  unrenderable text before it ships.
- Docusaurus Phase-1 JSON strings honour an opted-in `script:` with the same
  rules as the flat lane. Markdown bodies are never converted (a greedy
  character converter has no safe path through code spans, URLs and front
  matter) — now documented.
- `serve` responses carry `meta.script_conversion` (resolved script, whether
  conversion ran, values kept in working script).

### Fixed
- Serbian's converter was unreachable for projects writing the canonical
  `srp` code (the registry is keyed `sr`); converter lookup now resolves
  through the card's `scriptConverter` field.
- `champollion fonts` passed its arguments to the config resolver in the
  wrong order, so `--config` never reached it.
- The quality gate's Script Compliance doc claimed the check was driven by
  the `script:` config field; it is driven by the language cards, runs on the
  pre-conversion working script, and always has. The docs now say so, and
  describe the feedback retry accurately (a gate rejection whose retry passes
  is written and green — not a permanently failing sync).

## [0.2.0] - 2026-08-08

Two gate defects of the same shape: one check that could never be satisfied,
and one that did not exist. Both let corrupted values reach production.

**Consumers vendoring the tarball must re-point at `champollion-0.2.0.tgz`.**
The version bump is deliberate — a same-version tarball can be served from
npm's cache, so the swap would silently do nothing.

### Added
- **A content-preservation gate.** The gate detected length *inflation* but
  nothing for the opposite, so a model with no vocabulary for a string could
  delete every letter it could not translate and leave the source's
  punctuation and spacing standing:

  ```
  "low-resource nmt · tokenizers · nêhiyawêwin"  →  "   ·   · êhiêi"
  "the simple-builder approach"                  →  "  "
  ```

  These passed every existing check — not empty, not an echo, not repetitive,
  and at 33% of source *length* comfortably above `minLengthRatio` — and were
  written to disk with no warning.

  The obvious rule ("reject below X% alphanumeric density") is unshippable:
  the bug retains 14% of its source's letters and `"Getting started"` → `"入门"`
  retains 14% too, so any threshold catching one rejects Chinese, Japanese and
  Korean. What separates them is not how much survived but where it came from
  — the hollowed output is a *subsequence* of its own source, a real
  translation shares essentially nothing with it. A flag therefore requires
  BOTH signals, the same necessary-but-not-sufficient design the repetition
  detector uses. Tuned via `minContentRetention` (default `0.35`), per pair or
  per language. Verified not to disturb correct dense-script or conlang output.

- **The content lane is gated at all.** `content-sync` front matter and
  Markdown bodies (Hugo and Docusaurus Phase 2) went from the API straight to
  disk **and into the Translation Memory** without passing through any
  validation, so a hollowed page title was written silently and then re-served
  from cache forever. Both now run the content-preservation check before
  writing or caching; a failure skips the file and leaves its lock entry
  un-advanced, so the next sync retries it.

### Fixed
- **The empty check missed invisible values.** `String.prototype.trim()` strips
  `White_Space` only, but `U+200B` ZERO WIDTH SPACE, `U+200E` LEFT-TO-RIGHT
  MARK and `U+2060` WORD JOINER are category `Cf` — so a value built entirely
  from them had `trim().length > 0`, passed as a real translation, and
  rendered as a blank string on the page. Format characters are now stripped
  before the emptiness test, reported distinctly as `empty translation (only
  invisible formatting characters)`.

### Added (no-translate lane)
- **`noTranslate` — keys whose correct translation is the source, verbatim.**
  Dot-path keys and globs in `champollion.config.json`
  (`"noTranslate": ["**.url", "pages.software.*.repo"]`, also accepted as
  `skipKeys`). A matching key is copied from the source locale byte-for-byte
  and is never sent to a translation backend, never quality-gated, never
  counted as a failure, and never billed — it is excluded from the pre-run
  cost estimate by the same matcher that excludes it from translation, so the
  two cannot drift.

  This closes a trap with no correct outcome. The quality gate rejects
  source-echo, but a URL's only correct translation IS the URL, so every
  possible model output failed: weaker models learned to defeat the gate by
  bending the value (fabricated `#fragment`s, stray trailing characters, an
  invisible U+200E in Arabic and U+200B in Hindi that broke the links
  outright — 48 such values shipped across 13 locales on one site), while
  stronger models returned it unchanged, failed the gate, and made `sync`
  exit non-zero on every run — which no amount of retrying could satisfy.

- **URL auto-detection, on by default** (`noTranslateUrls`). A source value
  that is nothing but an absolute `scheme://` URL is treated as no-translate
  without configuration. Detection is narrow: prose that merely contains a
  link is still translated. Set `"noTranslateUrls": false` to opt out.

- **`sync` repairs no-translate drift.** A declared key whose target is
  missing, `[EN] `-prefixed, or altered is rewritten from the source at zero
  API cost, and the repair is flushed even when the translation backend fails
  for that locale. Idempotent: once the values match, later syncs skip the key.

- **`xliff export` locks no-translate units.** They ship with XLIFF 1.2's own
  `translate="no"`, `state="final"`, and the source pre-filled, so a CAT tool
  locks them and no human spends time translating a URL that the next sync
  would revert. The unit is still emitted — the file stays a complete key
  inventory.

- **`verify` and `integrity` fail on no-translate drift** (`NO-TRANSLATE
  DRIFT`), reporting expected vs actual with invisible characters escaped as
  `\uXXXX` — the corrupted-URL class is otherwise invisible in a diff.
  `champollion integrity` exits `1`, so a build wired to it catches the damage
  before it ships.

### Fixed (no-translate lane)
- `verify` no longer reports a no-translate key as a source echo, and no
  longer flags an ASCII URL copied into a non-Latin locale as wrong-script —
  both would have made a correct sync fail its own post-sync verification.
- A malformed `noTranslate` / `noTranslateUrls` value now fails loud with a
  field-specific error instead of being reported as a JSON syntax error.

## [0.1.0] - 2026-06-12

First npm release under the `champollion` name, published as a 0.x **beta**
(by design: the fresh name starts a fresh version line and
the whole project is in beta; the previously published `i18n-rosetta` 3.x
line is retired at 3.3.2). This release includes everything accumulated since
the 2026-05-29 monorepo fork (the sections below, through the former
"Unreleased" block) plus the 2026-06-12 work:

### Added (0.1.0 final)
- **Dynamic language cards** — cards now load from the live Champollion
  database: a 198-card offline core ships in the package, the long tail is
  fetched on demand and cached at `~/.champollion/cards` with per-language
  `updated_at` invalidation (24 h TTL). Env knobs: `CHAMPOLLION_OFFLINE`,
  `CHAMPOLLION_CARDS_CACHE_DIR`, `CHAMPOLLION_CARDS_TTL_HOURS`. The npm
  package drops from 72 MB to ~5 MB unpacked.
- **Landing v4 hero** — the homepage opens on the live Translation Network
  (7,959 nodes, real benchmarked routes) with the endonym channel rail.
- **Leaderboard pair search** — source/target selectors with a "completed
  runs only" toggle; unchecked, the open sweep queue joins the search so
  every planned pair is findable with its estimated cost.

### Added
- **Landing rebuild** — full-bleed Translation Field hero (real corpus sentences rendered into real model outputs with per-entry scores, particle dissolution, SSR poster, reduced-motion support); bento grid (live leaderboard, verified endonym wall, glossary teaser); spoke pages (`/languages`, `/arena`, `/my-language`, `/translate`, `/research`, `/contribute`); `/glossary` with 127 cited terms.
- **Explanation layer** — language trading cards gained Sources & Licenses panels, Who to Contact expert listings, feature explainers with WALS author citations, and phoneme label decoding.
- **Taxonomy badges** — signed/type/macrolanguage-hub badges on language cards, backed by canonical ISO scope/type data (163 signed languages, 63 macrolanguage hubs).
- **Design system** — Field Notes tokens, self-hosted Fraunces/Inter, stela mark (light/dark), glass chrome, branded footer, provenance chips on all claims; documented in `DESIGN.md` with a `CLAIMS.md` claims ledger.
- **Contribute page + installers** — `/contribute` with a static queue viewer and one-line installers (`/harness`, `/cli`).

### Fixed
- **Website build dedup** — per-locale card-data duplication eliminated (build size 10 GB → ~850 MB); wall/field/explainer datasets emitted once and shared across locales.
- **Leaderboard** — trust-tier mapping corrected; disqualified runs filtered out; Supabase index pagination fixed.

### Added (accumulated since the 2026-05-29 fork)
- **Batch CLDF Dataset Ingester** (`batch-ingest-zenodo.mjs`) — automated bulk downloader + ingester for CLDF datasets across GitHub orgs (lexibank, cldf-datasets). Auto-discovers metadata files, handles direct CSV fallback, maintains registry of already-ingested datasets. Processed 140 repos, ingested 113 datasets in a single batch run.
- **CLDF Metadata Auto-Discovery** — `ingest-cldf.mjs` now auto-discovers metadata files when `--source` is given (tries `cldf-metadata.json`, `Wordlist-metadata.json`, `StructureDataset-metadata.json`, `Generic-metadata.json`). Falls back to direct CSV mode for repos without metadata. Unblocked batch ingestion of 59 repos that only had raw CSV data.
- **v2 Database: 3,960,404 facts from 769 sources** — two batch runs ingesting 184 new datasets from lexibank/ and cldf-datasets/ GitHub orgs, plus D-PLACE full CLDF (+368K typological facts), Concepticon glosses (+35K), SIL ISO 639-3 tables (+25K identity facts). Top sources: D-PLACE (368K), TLS (85K), Tjuka Body-Object (83K), Trans-New Guinea (87K), Anderson PHOIBLE (77K), Sound Symbolism (69K), ABVD Oceanic (65K), NTS (57K), Glottolog-CLDF (54K), UCLA Phonetics (43K), Semantic Shift (43K), LSI (42K), Polyglotta Africana (40K), Numeral Systems (30K), Madang (30K).
- **Moli-mandala Japonic CLDF** (+139,884 lexical facts) — comparative wordlist across Japanese dialect varieties.
- **Unicode CLDR** (+14,576 facts) — default script and territory mappings for 7,200+ languages, plus pluralization rules for 224 languages. Cross-referenced with ISO 15924 script registry for human-readable script names.
- **ISO 15924 script enrichment** (+7,192 facts) — script names (e.g. "Latin", "Devanagari") linked to every language with a CLDR default script.
- **Metadata quality upgrade**: Replaced shallow boolean flags with rich, actionable metadata across corpus domain — OPUS now stores corpus count + sentence pair count + corpus names per language; Tatoeba stores corpus size + direct download URLs for 420 languages; UD stores treebank count + individual treebank names + GitHub repo links; UniMorph stores repo size + download URLs.
- **PARADISEC OAI-PMH crawl** (+681 facts) — 686 endangered Pacific/regional language recordings indexed via 50-page OAI-PMH harvest from catalog.paradisec.org.au.
- **Tatoeba rich corpus data** (+840 facts) — sentence corpus sizes and direct `.tsv.bz2` download URLs for 420 languages.
- **Dictionaria round 2** (+12,533 headwords) — 4 additional endangered language dictionaries: Kalamang (kgv), Iquito (iqu), Teanu (tkw), Wanukaka (wnk).
- **Non-GitHub data sources**: Wikidata (4K facts — speaker counts, writing systems, endangerment for 6,931 languages), Glottolog resourcemap (7.7K identity facts), HuggingFace survey (129 languages with dataset counts + specific dataset names/links), Wikipedia edition stats (article counts, active users), UniMorph index (188 languages with repo sizes + download URLs), Dictionaria (57K headwords from 16 endangered language dictionaries), OPUS (32 LRL languages with corpus counts + sentence pairs + corpus names), Universal Dependencies (196 languages with 359 treebanks + direct repo links), Flores-200 (197 languages with MT benchmarks), SIL ISO 639-3 (language types, scopes, macrolanguage mappings, alternative names, retirements), IANA Language Subtag Registry (483 script/scope facts), Wiktionary (129 editions indexed), Masakhane (35 African languages), CDDB (78 Chinese dialect varieties), PARADISEC (681 Pacific languages), Tatoeba (420 languages with download links), Unicode CLDR (7,200+ languages), ISO 15924 (226 script codes).
- **Universal CLDF Ingester** (`ingest-cldf.mjs`) — metadata-driven ingester that reads any CLDF dataset (Wordlist or StructureDataset) and writes facts to the v2 SQLite database with full provenance. Supports `--dry-run`, `--lang`, `--limit`, `--source`, `--verbose`. Works with both CLDF metadata files and legacy CSVs.
- **`DATA-ARCHITECTURE.md`** — canonical data architecture document covering CLDF strategy, v2 SQLite schema, complete 35-directory data inventory, universal ingester design, data integrity rules.
- **Decontamination script** (`decontaminate-grambank-fields.mjs`) — one-time cleanup that nulled 8,737 contaminated Grambank fields across 2,322 cards (`hasGenderSystem`, `hasCaseMorphology`, `hasToneSystem`, `hasEvidentiality`).
- CLDF established as a named standard in `DATA-ARCHITECTURE.md`, `AGENTS.md`, and `DATA-ENRICHMENT.md` (previously appeared only as a filename, never as a named format).

### Changed
- Updated `AGENTS.md` with v2 database stats (1,793,337 facts, 32 sources), CLDF ingestion rules, contaminated script warnings (now marked DELETED), safety-audited script table, new scripts in file tree.
- Updated `DATA-ENRICHMENT.md` §1.5 with CLDF as the universal data standard.
- Updated `docs/INDEX.md` with `DATA-ARCHITECTURE.md` as top-priority technical doc.

### Removed
- **Deleted `enrich-grambank-typology.mjs`** — contaminated script with 5 wrong Grambank feature ID mappings.
- **Deleted `enrich-from-typology.mjs`** — contaminated script with 12+ wrong Grambank feature ID mappings and 2 non-existent feature IDs.
- **63 new language cards** (53 → 116 total), covering South/Southeast Asian, African, Slavic/Baltic, Germanic, Romance, Turkic/Uralic, and strategic indigenous languages.
- **8 genus/family templates**: `genus-celtic`, `genus-polynesian`, `genus-philippine`, `genus-bantu`, `genus-eskimo-aleut`, `family-algonquian` (expanded), `family-austronesian`, `genus-cree`.
- **`omt1600` field** on all 116 language cards documenting Meta OMT-1600 coverage tier and evaluation metrics. (The tier values shipped here as `R1`–`R5` were a misreading of the paper and were cleared to `null` in Unreleased — see the entry above.)
- 14 strategic indigenous LRL cards: Irish, Welsh, Basque, Māori, Inuktitut, Ojibwe, Cherokee, Navajo, Aymara, Hausa, Amharic, Hawaiian, Lakota, Inuinnaqtun.
- 12 Philippines cluster cards with genus-philippine inheritance.
- 38 CLDR gap-fill cards for globally significant languages.
- All 116 cards pass schema validation (454 tests, 0 failures, 0 TODOs).
- **Canonical MethodConfig schema** — All config surfaces (champollion.config.json, method.json, plugin schema, leaderboard install) now use the same 8-field shape: `model`, `temperature`, `batchSize`, `register`, `coachingFile`, `coachingPrompt`, `promptContext`, `qualityTier`. Matches the harness exactly.
- **`resolveModel()` with shared aliases** — Short model names (e.g., `gemini-flash`) resolve to full OpenRouter slugs via `shared/model-aliases.json`, shared with the eval harness.
- **`--coaching-file` CLI flag** — Path to a free-text coaching prompt file; contents are read at startup and injected into the system prompt as a `Coaching guidance:` block.
- **Coaching prompt injection in `llm.js`** — `buildSystemMessage()` now inserts coaching guidance between the register block and the Rules block, byte-identical to the Python harness prompt builder.
- **Plugin temperature and coaching merge** — `resolvePluginForPair()` now merges `temperature`, `coachingFile`, `coachingPrompt`, and `promptContext` from method plugins (previously only `model`, `register`, `batchSize`).
- **`leaderboard --apply`** — The `--install` flag now accepts `--apply` to automatically patch `champollion.config.json` with the installed method plugin.
- **`method_config` in leaderboard install** — `_handleInstall()` now reads the canonical `method_config` block from run cards (no field reconstruction needed).
- **Plugin schema updated** — `champollion-plugin.schema.json` now includes all 8 MethodConfig fields with `additionalProperties: true` on the config block.

### Changed
- Expanded `family-algonquian.json` with polysynthesis, animacy, obviation, and direct/inverse voice documentation.
- Deepened `tl.json` (Tagalog) with genus-philippine inheritance, Baybayin script, MTBMLE context, and reduplication challenge.

### Fixed
- **Tatoeba download URL** in `arena/scripts/corpora-builder/corpora_builder/licensing.py`: switched from defunct `per_language` pattern to OPUS Tatoeba Challenge mirror (`object.pouta.csc.fi`). The old URL returned 404.
- `lkt.json` (Lakota): moved gender guidance text out of `registers` prompt into `gender.inclusiveGuidance` to fix schema test failure.

### Removed
- 7 unfilled Cree variant cards (cwd, csw, crj, crl, nsk, moe, atj). Scope narrowed to Plains Cree (crk) only.

## [0.1.0] - 2026-05-29

### Changed
- Fresh version history. Pre-fork changelog preserved in `CHANGELOG.legacy.md`.
- Documentation restructured: business docs consolidated under `docs/business/`, API service docs under `docs/api-service/`.
- All legacy naming scrubbed. As far as this repository is concerned, there has only ever been Champollion.

### Removed
- Deprecated marketing assets.
- Superseded planning documents (`project-plan.md` → see `ROADMAP.md`).
- Duplicate files (root `diagrams/`, duplicate `GRANT_STRATEGY.md`, non-SSOT `SIGNIFICANCE_SPEC.md` copy).
