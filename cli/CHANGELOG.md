# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
