# Claims Ledger

Every factual claim on the redesigned hub/spoke pages, mapped to its in-repo
source. If you change a number on a page, update it here (and vice versa).
Last audited: 2026-06-19, leaderboard-honesty + corpus-count reconciliation
pass. **Third-wave recount (2026-07-12):** `arena/datasets/registry.json` now
holds **5,602 datasets across 19 corpus families + FLORES+** (the 2026-06-19
second wave added TICO-19/IN22/SMOL/ALT/Turkic/WMT24++; the 2026-07-07 batches
added the WMT 2014–2025 blind sets, MAFAND-MT, NusaX, NusaTranslation, LoResMT,
AmericasNLP 2021, NICT-SAP, BSD, MENYO-20k), from ~1,417 source cards (see the
/research corpus-count row). **SSOT mechanization (2026-07-19):** `/research`'s
corpora sentence and the who-benefits counts now render BUILD-TIME reads of the
machine SSOTs (`docusaurus.config.js` `customFields` + the `SSOTCount` MDX
component) — the stale first-wave `1,323` figure is gone, and by construction no
"copy refresh" can be pending again; irreducible prose figures are gated by
`cli/scripts/check-prose-counts-parity.mjs`. EdTeKLA entry-count phrasing unified across pages;
empty-board behavior — no static leaderboard fallback rows — confirmed against
`src/pages/index.js`). Prior audit: 2026-06-12, field-chip pass (design decision: each
Translation Field chip now shows the RUN's corpus-level composite score for
that model × language pair — labeled "corpus composite", scoring spec §4 —
instead of per-entry chrF++, reconciling the hero with the
composite-foregrounded rule in the design spec; sentences, model
outputs, and references unchanged; see §"The Translation Field" under
Homepage. Same-day earlier audit, Landing v3: the homepage background became
a continuous full-bleed visualization of real corpus sentences becoming real
model outputs. The Morph stage was retired from the homepage in the v3 pass
— its components remain in the repo (src/components/MorphStage.js,
MorphParticles.js) and its particle engine was cannibalized for the field,
but no Morph claims are currently rendered. Previous audits: 2026-06-12
Morph hero pass, 2026-06-11 wave-2 design pass).

**Provenance tips:** numbers on the homepage tiles (stats, leaderboard,
featured card, glossary) and the /arena contrast module carry a
`ProvenanceTip` (ⓘ) whose tooltip text restates the source + verification
date recorded in this ledger. If a row here changes, update the matching
tooltip in the page source.

## Homepage (`src/pages/index.js`)

Wave-2 redesign (2026-06-11): the hero headline IS the cycling endonym
("Can your language talk to AI?" retired per the design kill list); below
the hero the page is a bento grid of real-data tiles. Claims by surface:

| Claim | Where it appears | Source |
|---|---|---|
| Headline — the word "language" cycling across scripts | Hero H1 (`aria-label`: "The word 'language', written across many languages and scripts") | Each entry is that language's ordinary word for "language/speech": language (en), ᓀᐦᐃᔭᐍᐏᐣ *nêhiyawêwin* (crk — the language's own name for itself, `crk.json → nativeName`), 语言 *yǔyán* (zh), لغة *lugha* (ar), भाषा *bhāṣā* (hi), te reo (mi), язык *yazyk* (ru), γλώσσα *glóssa* (el), ภาษา *phasa* (th), lugha (sw), 언어 *eoneo* (ko). No counts or comparative claims are encoded; list defined in `src/pages/index.js` (`DECIPHER_WORDS`). |
| "7,927 languages." | Hero scoreline + SEO title | `data/tc-index.json` — 7,927 entries (verified by script, 2026-06-11). |
| "One open scoreboard." | Hero scoreline + SEO title | The public leaderboard: `src/pages/leaderboard.js` reading the public `run_cards` table (Supabase, anon read-only key); scoring/benchmark specs published at champollion.dev/arena (`cli/website/docs/network/specifications/`). "Open" = public read access + published specs, no superlative encoded. |
| "7,927 languages. One open scoreboard." (og:image hero line) | Social cards: `static/img/champollion-social-card.png` (SVG source alongside; regenerate via `scripts/generate-social-cards.mjs`) — one unified social card after the Arena-site merge | Same sources as the two hero-scoreline rows above. The SVG's "N languages" figure is parity-gated against the language-card SSOT by `cli/scripts/check-prose-counts-parity.mjs` (pre-push) — count drift blocks the push until the SVG + PNG are regenerated. |
| "About 200 have machine translation today. The rest are why we're here" | Hero subline | NLLB-200 covers 200 languages — `docs/VISION.md` ("Competitive Landscape": "NLLB-200 (Meta, 2024): 200 languages"). Google's Cloud Translation lists 194 (`shared/catalogue/method-coverage.json` `google-translate` entry, cited to Google's published list — see §"Per-provider coverage counts in docs prose" below). "About 200" is the ceiling of broad MT coverage. |
| Endonym wall: names, native scripts, vitality colors | Wall tile | Generated from `cli/shared/language-cards/*.json` via `plugins/shared-data/generateWallJson.js` → `data/wall.json` (entry count varies with card-data regeneration — 1,073 as of the 2026-06-11 build; the wall tile samples 48 and tolerates any size). Vitality tiers from each card's `vitality.unescoStatus` (source: linguameta/UNESCO, per-card `_fieldSources.vitality`). |
| Wall chip hover label (vitality tier; speaker count only if the dataset carries an `s` field) | Wall chips, on hover/focus | Same `data/wall.json` tier (`v`) as the chip color. Speaker counts are rendered **only** when a numeric `s` field exists in the wall entry — the UI never invents one (2026-06 wall.json has no `s` field, so no counts are shown). |
| Leaderboard tile: top-5 rows by chrF++, "LIVE FROM THE LEADERBOARD" | Leaderboard tile (live state; skeleton placeholder rows shown while loading make no claims) | Live fetch of public `run_cards` (Supabase, `trust=neq.disqualified`, `order=chrf_plus_plus.desc.nullslast`, `limit=5`) — same query family as `src/pages/leaderboard.js` and the /arena "Current standings" embed (also top-5). |
| Leaderboard tile empty state: "a fresh board" + link to /contribute — **NO static fallback rows** | Leaderboard tile (rendered when the live query returns no rows) | `src/pages/index.js` (the `No static fallback rows` block, ~L77–82): there are no static proof rows. When the live board is empty the tile says so honestly and routes visitors to the contribution queue instead of quoting retired runs; archived figures are never republished without the harness integrity gate (see "Empty-board policy" below). |
| "7,927 language cards" (count-up) | Stats tile | `data/tc-index.json` — 7,927 entries (verified by script, 2026-06-11). Count-up lands on the exact figure; SSR/no-JS/reduced-motion render the final number statically. |
| Licensed-source count ("cited sources") | Proof strip | Read at BUILD TIME from `shared/licenses.json` `_generated.counts.total` via `docusaurus.config.js` `customFields` (root SSOT first, `cli/shared/` bundled fallback; the build FAILS if the register is missing/malformed — no hardcoded copy can drift). The ProvenanceTip date is `_generated.generatedAt`. Rollup documented in `docs/LICENSING.md` §"Card-Data Sources Rollup". |
| "N runs on the board" (count-up) | Stats tile (rendered ONLY when the live query succeeds) | Total row count of public `run_cards` via `Prefer: count=exact` (Content-Range header) on the same live query, disqualified excluded. Never shown from a static fallback — the UI omits the stat rather than invent a count. |
| Glossary tile: rotating term + plain-language definition | Glossary tile | `/data/explainers/glossary.json` (emitted from `cli/shared/explainers/` by `plugins/shared-data`) — hand-written terms, each citing its standard reference. Fallback (fetch failure only): the `morpheme` entry, verbatim from the same file. "127 terms" in the onward link: `glossary.json` term count (verified 2026-06-11). |
| Pull quote: "Not yet served — never 'not a language.'" + "the 160+ sign languages in the catalog" | Quote tile | `cli/website/docs/network/context/what-counts-as-a-language.md` (published at champollion.dev/docs/network/context/what-counts-as-a-language): "Sign-language entries in our catalog say exactly that: **not yet served — never "not a language."**" and "Our catalog includes more than 160 of them, tagged `modality: signed`." |
| "Data sovereignty: the answer is always the community" | Quote tile onward link | `cli/website/docs/network/sovereignty/data-sovereignty.md` (published at champollion.dev/docs/network/sovereignty/data-sovereignty): "**The answer is always the community.**" |
| Plains Cree endonym "ᓀᐦᐃᔭᐍᐏᐣ / nêhiyawêwin" | Featured card tile | `cli/shared/language-cards/crk.json` → `nativeName` (source: wikidata-P1705). |
| "severely endangered" (crk) | Featured card tile | `crk.json` → `vitality.unescoStatus: "severely-endangered"`. |
| "Algonquian (Algic)" | Featured card tile | `crk.json` → `classification.family: "Algic"`, `classification.ancestry` includes "Algonquian". |
| "polysynthetic" (crk) | Featured card tile | `crk.json` → `linguisticChallenges.polysynthesis` ("Cree is highly polysynthetic…"). |
| "~34,000 speakers" (crk) | Featured card tile | `crk.json` → `vitality.speakerCount: 34000` (cited to Wikidata) and `regions[0].speakerEstimate: "~20,000"`. (LinguaMeta estimates 4,100; both shown in speakerEstimates — the displayed figure cites Wikidata, no invented midpoint.) |
| "FST analyzer ✓ (ALTLab / GiellaLT)" (crk) | Featured card tile | `crk.json` → `resources.fsts[0]` (Plains Cree FST — built by ALTLab, distributed via GiellaLT; lang-crk). |
| "91.5% FST-valid output (452/494 entries)" (crk pipeline) | Featured card tile, leaderboard fallback | `champollion-crk-translate` results-record — FST acceptance 91.5% = 452/494 entries (494-entry sweep, Claude Sonnet 4.6; repo extracted from this monorepo 2026-06-23). |
| "35 cited sources · 7 contacts" (crk) | Featured card tile footer | `cli/website/data/tc-lang/crk.json` → `provenance.sources` has 35 entries; `experts` has 7 entries (verified by script, 2026-06-11). |
| "ten methods" | Translator path card | `cli/website/docs/guides/translation-methods.md`: "Champollion supports ten translation methods." |
| "30+ languages" | Translator path card | `cli/website/docs/tutorials/translate-30-languages.md` (existing tutorial; same claim as previous homepage). |
| "atlas of 7,927 language cards — every fact cited" | Explorer path card | `data/tc-index.json` count + per-field `_fieldSources` provenance (see /languages section below). |
| `npm i -g champollion` | Install tile + footer | `cli/package.json` (published package name `champollion`). |
| `pipx install mt-eval-harness` | Install tile + footer | PyPI package `mt-eval` (`arena/pyproject.toml`; renamed from `mt-eval-harness` 2026-07-12). The served `champollion.dev/harness` script was retired; harness install is now a direct PyPI install. |
| "Have API credits? Run a benchmark, push the map forward." | Run-queue tile ("RUN THE QUEUE") | Descriptive invitation, no metric encoded. The mechanism it points to is real: the public sweep queue + contribution flow on `/contribute` (`src/pages/contribute.js`, claims in its own section below). |
| `curl champollion.dev/run_queue \| bash -s -- --budget N` | Run-queue tile + /contribute | `cli/website/static/run_queue` (this repo) — the one-command queue runner: installs the harness (PyPI) and runs the queue to the budget. The separate `/harness`, `/queue`, and `/cli` scripts were retired; the live queue is `queue.json`. |

### The Translation Field (hero background, `src/components/TranslationField.js` + `FieldEngine.js`)

The homepage hero's full-bleed background is a continuous visualization
of the machine working: a real corpus sentence drifts in, dissolves
through a particle transition state, and crystallizes as the REAL model
output recorded for that exact entry — with the RUN's corpus-level
composite score attaching as the chip (labeled `corpus composite N.NN`):
the model × pair whole-corpus score, identical on every flow drawn from
that run and never a per-sentence claim (by design: composite foregrounded / raw chrF++ off the hero per
the design spec — chrF++ belongs in the methodology
drill-down). Hard rule (also in the component and generator headers):
**nothing in the field is invented** — the renderer (`FieldEngine.js`)
draws only what `data/field.json` hands it (no `composite` on a run →
no chip, never an invented one), and the generator only copies entries
and scores out of published runs on the Arena scoreboard (Supabase
`run_cards` / `run_card_entries`). Verified 2026-06-16.

| Claim | Where it appears | Source |
|---|---|---|
| Every field flow: source sentence, target text, "MODEL OUTPUT" label, `corpus composite N.NN` chip | The hero background canvas (and the per-flow source/target data + per-run score behind it) | **Bulk row.** `data/field.json`, generated at build time by `plugins/shared-data/generateFieldJson.js` from the Arena scoreboard (Supabase `run_cards` + `run_card_entries`, public anon read-only) — the system of record, never local logs. Featured selection: one run per language pair (prefer the naive condition, then most recent), newest pairs first. Per flow: `s` = the corpus `source`, `t` = the run's `predicted` (model output, always labeled "MODEL OUTPUT" on crystallization), `e` = the corpus reference. The chip is per RUN, not per flow: `runs[].composite` = that run's `run_cards.composite_score` (the run-level composite point estimate, scoring spec §4, 0–1 — the same metric the leaderboard ranks by) rounded to 2 dp; every flow drawn from a run carries the same chip, and the renderer omits the chip rather than invent one. `c` = that entry's per-entry `chrf_score`, retained in the file as selection-audit data only — NOT displayed (by design: composite foregrounded per the design spec). LICENSE/SOVEREIGNTY GATE: a run is shown only if its `datasets` row is plain CC-BY, not a `held_out`/`gold_standard` segment, and not quarantined — fail-closed (a run whose dataset row is hidden by RLS is dropped), which keeps NC (EdTeKLA) and held-out reference text off the public homepage. Pre-launch the scoreboard is empty, so `field.json` is written empty and the hero is sparse; it self-populates as runs publish. Selection is deterministic (sorted by entry id, bucketed 2 high / 2 mid / 1 low per pair by per-entry chrF++ — an honest spread of sentences, not a highlight reel; the displayed run-level score is unaffected by selection). |
| Source meta line "`ENG → CEB` · TATOEBA" (pair varies) | Under each drifting source sentence | `field.json` `runs[].pair` (derived from the corpus id) + the registry `attribution` ("Tatoeba (CC-BY-2.0), via Tatoeba Challenge 2023-09-26"). |
| Target meta line "`gemini-3.1-pro-preview` · MODEL OUTPUT" (model varies) | Under each crystallized target | `field.json` `runs[].model` = `run_cards.model_slug`. The label is the design system's honesty rule: model text is never presented as human translation. |
| The frozen flow (static composition / reduced-motion / no-JS / screen readers): "ENG → CYM · TATOEBA · CC-BY — She wants water." → "claude-sonnet-4.6 · MODEL OUTPUT — Mae eisiau dŵr arni. · corpus composite 0.57 · reference: Mae hi eisiau dŵr." | `STATIC_FLOW` in `TranslationField.js`, SSR'd into the hero | Entry `tatoeba_11472433` of `eng-cym-dev-v1` (Tatoeba, CC-BY-2.0) as translated in `arena/eval/logs/harness/run_20260611_114322_anthropic_claudesonnet46_naive_all_b25_report.json` — `predicted` "Mae eisiau dŵr arni.", `expected` "Mae hi eisiau dŵr."; chip = that run's `overall.confidence_intervals.composite_score.score` 0.5703 → 0.57 (same value as GraphHero's `FROZEN`). `STATIC_FLOW`/`FROZEN` are fixed illustrative fallbacks (real historical run data) shown when JS is off; the live `data/field.json` is rebuilt from the DB and may feature different pairs. |
| Legend: "Real corpus sentences · real model outputs · each chip: that run's whole-corpus composite score" + ⓘ | Always-visible pill at the field's base | Restates this section; the ProvenanceTip names `data/field.json` and this ledger and spells out that the chip is the run's corpus-level composite (scoring spec §4, 0–1) for that model × language pair, not a score for the single sentence shown. Date shown: 2026-06-11 (the run wave). i18n note: the two reworded strings (`homepage.field.legend`, `homepage.field.frozenLabel`) were pruned from all 12 non-en locale `code.json` files (stale "per-entry chrF++" translations would have contradicted the chip) — they fall back to English until the next `champollion sync` re-translates them. |
| Transition states (sand, mist, petals, embers, water, murmuration) — **purely visual, no claim** | The dissolution between source and target | Aesthetic, meaning-inspired choreography under the Morph v2 guardrail (the design log): a mode is suggested by the sentence's MEANING where a build-time keyword pass found one (`m` in field.json, e.g. "She wants water." → water), otherwise flows rotate modes aesthetically. Modes are never fixed to a language or culture, encode no data, and assert nothing. Decorative canvas only (aria-hidden); absent under reduced motion. |

**Retired surface:** the Morph stage (three glossed decomposition
sequences — Cree nikî-wâpamâw, Spanish habló, Arabic k-t-b) no longer
renders on the homepage as of Landing v3. Its truthfulness contract
lives on in the component headers (`src/components/MorphStage.js`); if
the Morph returns to any page, restore its claims table from git history
(this file, 2026-06-12 Morph-pass revision) before shipping.

### Audience doors + evolving note (2026-07-07)

| Claim | Where it appears | Source |
|---|---|---|
| Audience doors row ("Or start from who you are:" — six links) | Funnels section, under the intent cards (`DOORS` in `src/pages/index.js`) | Descriptive navigation only, no metric encoded. Each door lands on the matching section of `docs/network/who-benefits.md` (anchors `#speakers #communities #vendors #researchers #funders #press`; the audience funnel pages were merged into it 2026-07-17) or on `docs/network/community/for-language-communities.md`, which keeps its own full page. |
| "This is an evolving research project… critique is as welcome here as enthusiasm." | `EvolvingNote` band (after the proof strip) | Honest framing, no metric encoded. Links: public repo issues (`github.com/gamedaysuits/Champollion/issues`), `info@champollion.dev` (same contact as `/human-services`), and `docs/network/honest-limitations.md`. |

## Docs: Who Benefits page (`docs/network/who-benefits.mdx` — the 2026-07-07 audience funnel pages, merged into one page 2026-07-17; converted `.md` → `.mdx` 2026-07-19 so counts render from the SSOTs)

| Claim | Where it appears | Source |
|---|---|---|
| Catalogue-size count (language cards) | `who-benefits.mdx` (registries paragraph, `#press` key-facts table, boilerplate) | `<SSOTCount field="catalogLanguageCount" />` — build-time count of `cli/shared/language-cards/` (one card per language) via `docusaurus.config.js` `customFields`; no hand-typed copy exists. |
| Evaluation-dataset count | `who-benefits.mdx` (`#vendors` intro, registries paragraph, `#press` key-facts table, boilerplate) | `<SSOTCount field="registryDatasetCount" />` — build-time `arena/datasets/registry.json` `datasets.length` (prebuild copy `static/registry.json` as fallback for cli-website-only deploys); no hand-typed copy exists. |
| Licensed-upstream-sources count | `who-benefits.mdx` (registries paragraph, `#press` key-facts table) | `<SSOTCount field="licensedSourceCount" />` — same `shared/licenses.json` `_generated.counts.total` mechanism as the homepage proof strip. |
| "160+ sign languages catalogued" | `who-benefits.mdx#press` | `docs/network/context/what-counts-as-a-language.md` (same as homepage quote tile). Floor verified against the card SSOT by `cli/scripts/check-prose-counts-parity.mjs` (163 `modality: signed` cards as of 2026-07-19; a false floor blocks the push). |
| "metrics ride on sacreBLEU (chrF++, BLEU, TER) and COMET/AfriCOMET… separate neural lane" | `who-benefits.md` (`#press`, `#researchers`, `#vendors`) | `docs/network/specifications/scoring.md` (metric table: sacrebleu-backed chrF++/BLEU/TER; COMET/AfriCOMET reported separately, never composited). |
| Speaker pay figures ($50–65 CAD/hr; task-block ranges; payment within two weeks) | `who-benefits.md` (`#speakers`, `#funders`) | `docs/network/perspectives/how-speakers-get-paid.md` + `docs/network/specifications/speaker-validation.md` (restated, no new numbers). |
| Corpus/validation/prize unit costs in the funders section | `who-benefits.md#funders` | `docs/network/sovereignty/economic-model.md` + `docs/network/specifications/benchmark-spec.md` §10 + `docs/network/specifications/prize-spec.md` (escrow held by community trust; PROPOSED status restated, no prize open). |
| "no community validation round has run yet"; "the leaderboard is seeding" | `who-benefits.md` (`#speakers`, `#press`, `#vendors`, `#funders`) | `docs/network/honest-limitations.md` §3 + empty-board policy (this file). |
| BibTeX `@software` citation block ("There is no Champollion paper yet") | `who-benefits.md#researchers` | Deliberate ceiling — repo citation only; no paper is claimed. |
| "Fewer than 600 of 7,082 living languages have machine translation; more than half are at risk" | `who-benefits.mdx` intro | Coverage/at-risk framing, champollion-derived (Glottolog AES aggregate) — same framing as the homepage/`/growth` reachability copy. The "fewer than N of M living" figures are checked against `graph-poster.json` `stats.coverage.dedicatedLiving`/`livingTotal` by `cli/scripts/check-prose-counts-parity.mjs`. |
| "100% pass-through, publicly accounted, none of it to Champollion" | `who-benefits.md#funders` | Restates the old funders-page "Champollion takes no cut … money goes to speakers, corpus builders, and prize winners" + `docs/network/sovereignty/economic-model.md`; same NC framing as `/get-involved`. |

## Site chrome (glass navbar skin, `src/theme/Footer/`)

| Claim | Where it appears | Source |
|---|---|---|
| "open translation infrastructure for low-resource languages" | Footer tagline | Project mission statement — `docs/VISION.md`; same framing as the monorepo README. Descriptive, no superlatives ("open" = published specs + public leaderboard + open harness). |
| Footer link rows (Documentation / Learn / More) | Footer | Rendered directly from `docusaurus.config.js` `themeConfig.footer.links` — the swizzled footer adds no claims of its own. |
| Install one-liners | Footer | Same sources as the install tile (above). |

**Softened claims:** the design brief suggested "EN→Cebuano gemini-3.5-flash chrF++
50.1 · $0.12" as a fallback proof row, and earlier waves rendered it.
**Retired (2026-06-13 board reset):** the homepage leaderboard tile no longer
carries any static fallback rows (`src/pages/index.js`, the `No static fallback
rows` block) — it renders an honest empty state and links to /contribute rather
than quoting retired runs. The underlying result still exists in the archived
logs (`run_20260611_094523_geminiflash_naive_all_b25_report.json` — 132 entries,
chrF++ 50.1, $0.119) but is no longer surfaced on the homepage, and archived
runs must not be republished without the harness integrity gate (see "Board
reset (2026-06-13)" below). The brief's "naive frontier LLM 49.4 chrF++" figure
comes from `docs/LAUNCH_PLAN_ACL_2026.md` as a *planned* rerun talking point,
not a recorded result.

## /languages (`src/pages/languages.js`)

| Claim | Source |
|---|---|
| "7,927 language cards" | `data/tc-index.json` row count. |
| "332 licensed sources" | `docs/LICENSING.md` / `shared/licenses.json` (see above). |
| "every fact cited" | Per-field provenance on cards: `_fieldSources` in `cli/shared/language-cards/*.json`; procedure: `cli/website/docs/reference/language-card-citation-procedure.md`. |
| Card-fan endonyms/vitality | `data/wall.json` (see homepage wall entry). |

## /arena (`src/pages/arena.js`)

| Claim | Source |
|---|---|
| "chrF++ 47.6 / morphology unverified" (naive frontier LLM, en→crk) | Live leaderboard `run_cards` top row (gemini-3.1-pro, naive, chrF++ 47.56, `fst_acceptance_rate: null`), fetched 2026-06-11. |
| "chrF++ 43.2 / 91.5% of output sentences fully FST-valid (452/494)" (FST-gated, illustrative contrast) | `champollion-crk-translate` results-record + full-sweep table (repo extracted 2026-06-23). |
| Plugin interface `translate(entries, config)` | `docs/VISION.md` §"Layer 1: The Eval Harness". |
| Top-5 leaderboard rows | Live fetch from Supabase `run_cards` (`trust=neq.disqualified`), same query family as `src/pages/leaderboard.js`. |
| Spec links (how-it-works, scoring, benchmark-spec, prize-spec) | `cli/website/docs/network/how-it-works.md`, `cli/website/docs/network/specifications/{scoring,benchmark-spec,prize-spec}.md`, published at champollion.dev/docs/network/…. |
| Harness install (python3 + pipx, public repo) | `cli/website/static/run_queue`; repo URL from `arena/pyproject.toml` (`Repository = …/Champollion`). |

## /contribute (`src/pages/contribute.js`)

| Claim | Source |
|---|---|
| Open-item count, top-5 queue items, per-item `est_cost_usd`, "no claim-locking" | Live fetch of `/queue.json` (`cli/website/static/queue.json`, generated by `arena/scripts/generate_sweep_queue.py` — registry × sweep-manifest lineup × naive/coached, minus public `run_cards` coverage). If the fetch fails, the page shows the terminal viewer command instead of inventing rows. |
| Tier 1 effort/cost: "most items under $0.55, median ≈ $0.09" | `queue.json` `est_cost_usd` distribution over naive items: min $0.0034, max $0.5128, median $0.089 (computed 2026-06-12). Estimates are observed costs or extrapolations from `arena/eval/logs/sweep_manifest.json` (457 successful runs, $61.51 total) — the basis is stated per item (`est_basis`) and in the ProvenanceTip. |
| "Coached prompts: `--coaching-file`, full text recorded in the run card" | `arena/mt_eval_harness/cli.py` (`--coaching-file`, `--coaching`), `runner.py` (`load_system_prompt` coaching precedence), `pipeline.py` (`provenance.coaching_prompt` + sha256). |
| "The harness makes its calls through OpenRouter … does not yet accept direct provider keys" | `arena/mt_eval_harness/api.py` — `load_api_key()` reads `OPENROUTER_API_KEY` only; all calls go to `openrouter.ai/api/v1/*`. The `api_provider` run-card column (`arena/migrations/002_add_metric_columns.sql`) defaults to `'openrouter'` and `publish.py` hardcodes it. |
| "Community submissions publish at the self-benchmarked tier" | `arena/mt_eval_harness/publish.py` (CLI submissions insert `trust: 'unverified'`); `src/pages/leaderboard.js` `DB_TRUST_TO_DISPLAY` maps `unverified` → "self-benchmarked"; tiers documented in `cli/website/docs/network/leaderboard/rules.md`. |
| Fingerprint dedupe (SHA-256 over dataset hash + model + condition + system prompt) | `arena/mt_eval_harness/publish.py` (fingerprint components per BENCHMARK_SPEC §3.8; deterministic UUID upsert). |
| "Every queued corpus is marked `do_not_train`, CC-BY family; NC corpora excluded" | `arena/datasets/registry.json` (`do_not_train`, `license` per dataset); the generator's eligibility filter (`queue_corpora()` in `generate_sweep_queue.py`) drops NC/quarantined/non-local entries. |
| "Attribution is the reward" (submitter name on the leaderboard row; no other rewards promised) | `run_cards.submitter` column (`arena/DATABASE_SCHEMA.md`); deliberate ceiling per DESIGN.md voice rule 5 — no programs promised that don't exist. |
| Agent prompt / install one-liners | `cli/website/static/run_queue` (this repo; the separate `/harness` and `/queue` scripts were retired — see the Install script section below). |

## /my-language (`src/pages/my-language.js`)

| Claim | Source |
|---|---|
| Sovereignty-aspirant framing (Indigenous data-sovereignty principles, CARE, Māori Data Sovereignty named side by side) | `cli/website/docs/network/sovereignty/data-sovereignty.md` (published at champollion.dev/arena); page copy is design-shaped ("built to First Nations data-sovereignty principles"), never an achievement claim. |
| do-not-train flags on corpora | `arena/datasets/registry.json` → `do_not_train` field per dataset. |
| Ownership transfer plan | `cli/website/docs/network/sovereignty/ownership-transfer.md`. |
| "Contests and community programs are in development" | Deliberate ceiling — contest infrastructure exists in code (`mt-eval contest` subcommands; contest loaders in `src/utils/contestLoader.js`) but no live community program is promised. |
| Every fact cited / correctable | `_fieldSources` per card (see /languages). |

## /translate (`src/pages/translate.js`)

| Claim | Source |
|---|---|
| Quickstart steps (init → key → sync) | `cli/website/docs/getting-started/quick-start.md`; `champollion init` exists (`cli/lib/commands/init.js`). |
| "Ten methods" | `cli/website/docs/guides/translation-methods.md`. |
| "OpenRouter reaches 200+ models" | `cli/website/docs/getting-started/quick-start.md` ("OpenRouter (200+ models, recommended)"). |
| "Runs anywhere Node 20+ does" | `cli/package.json` → `engines.node: ">=20.11.0"`. (The previous homepage's "zero dependencies" claim was dropped — `package.json` now lists production deps `better-sqlite3` and `cldr-localenames-full`.) |
| JSON/TOML/YAML/Markdown support | `cli/website/docs/getting-started/quick-start.md` and CLI docs. |

## /for-agents (`src/pages/for-agents.md` → derived `static/for-agents.md`, 2026-08-17)

The agent front door (Wolfram-style `for-agents.md` convention). The page
source is the SSOT; `scripts/build-for-agents-md.mjs` derives the raw-markdown
artifact served at `/for-agents.md` (drift hard-blocked by
`scripts/champollion_sync_gate.sh`, same contract as llms-full). The page is
deliberately count-light: no tool counts, no provider counts — those live on
the pages that carry them under a parity gate.

| Claim | Source |
|---|---|
| "cited index of 7,900+ languages" | Deliberate FLOOR, same rot-proofing as the middleware gate page (actual card count: `cli/shared/language-cards/`, 8,685 at time of writing — never write the exact number here). |
| "most of the world's ~7,000 languages" | Same approximate figure as `static/llms.txt`'s header paragraph; conventional Ethnologue-order magnitude, stated as an approximation. |
| MCP install / register lines | `docs/network/getting-started/mcp-server.md` (the SSOT for the full tool table; this page links rather than repeats the tool count). |
| Machine-readable endpoints table | Mirrors the table in `docs/network/getting-started/mcp-server.md` §"Machine-readable endpoints" + `/for-agents.md` itself; endpoints exempted from the pre-launch gate in `middleware.js` `MACHINE_EXEMPT`. |
| License/consent rules ("do_not_train", consent-first transmission) | `docs/DATA_BOUNDARIES.md` §"Transmission to model APIs" (internal rule text); public statement: `docs/network/leaderboard/datasets.md`. |
| "prize pools, when active" | Conditional phrasing per house rule; `docs/network/specifications/prize-spec.md`. |

## /research (`src/pages/research.js`)

| Claim | Source |
|---|---|
| Evaluation-dataset count (corpora sentence) | Rendered at BUILD TIME from `arena/datasets/registry.json` `datasets.length` via `docusaurus.config.js` `customFields.registryDatasetCount` (`static/registry.json` prebuild copy as fallback; the build FAILS if neither resolves) — no hand-typed figure exists in the page source, so it cannot go stale. History: the page hand-typed **1,323** (the first-wave Tatoeba+GlobalVoices subset) until 2026-07-19, an undercount from the moment the second-wave corpora landed; earlier "1,378 datasets" and "48 development corpora" figures were likewise stale snapshots — all superseded by the mechanism. Per-family breakdown lives in `docs/network/leaderboard/datasets.md`, itself parity-gated against the registry by `cli/scripts/check-datasets-doc-parity.mjs`. One source card fans out to many per-pair datasets, so the registry total exceeds the ~1,417 source cards in `cli/shared/corpora-cards/`. |
| Versioned, content-hashed corpora; sealed test sets | `cli/website/docs/network/specifications/corpus-design.md`; registry `sha256`/`version` fields. |
| Data integrity state published | `arena/datasets/DATA_INTEGRITY.md` (certified current state; full forensic audit is internal: `docs/CONTAMINATION_REPORT.md`). |
| Registered-upstream-sources count | Read at BUILD TIME from `shared/licenses.json` `_generated.counts.total` via `docusaurus.config.js` `customFields` (same mechanism as the homepage proof strip — no hardcoded copy in the page source). Rollup: `docs/LICENSING.md`. |
| Per-field provenance (`_fieldSources`) | Card schema: `cli/website/docs/reference/language-card-spec.md`. |
| Fingerprinted runs (git commit) | `cli/website/docs/network/specifications/benchmark-spec.md`; run cards carry `provenance.commit` (see leaderboard detail panel). |

## Docs: Cookbook register/style cross-reference (`docs/tutorials/translate-30-languages.md`)

| Claim | Source |
|---|---|
| "The harness can measure register and style adherence" | `arena/mt_eval_harness/plugins/writing_style.py` (WritingStyleConsistency MetricPlugin: `style_register_match`, `style_formality_score`, `style_sentence_length_ratio`, aggregate `style_consistency_rate`). |
| `--style-profile` flag exists | `arena/mt_eval_harness/cli.py` (run subparser, "--style-profile"); `config.py` `style_profile` field. |
| "informational — never enter the composite score" | `writing_style.py` docstring ("NOT part of the composite score"); now documented publicly at `cli/website/docs/network/specifications/harness.md` §"Writing-style and register metrics (informational)". |
| "formality detection is marker-based" | `writing_style.py` `_load_formality_markers()` — per-language formal/informal marker resources, regex-based. |
| Harness install one-liner in the cookbook | Same as install strip (`static/run_queue`). |

## Link corrections (2026-06-11)

`/arena` and `/research` previously linked to
`champollion.dev/docs/network/specifications/benchmark-spec` and `…/prize-spec`;
the published slugs are `/specifications/benchmark` and
`/specifications/prizes` (frontmatter `slug:` in
`cli/website/docs/network/specifications/{benchmark-spec,prize-spec}.md`).
Fixed in `src/pages/arena.js` and `src/pages/research.js`.

## Install script (`static/run_queue`)

| Claim | Source |
|---|---|
| Harness installs from `git+https://github.com/gamedaysuits/Champollion.git#subdirectory=arena` | `arena/pyproject.toml` Homepage/Repository URLs (public repo); harness lives in the `arena/` subtree. |
| `mt-eval setup` / `mt-eval run` next steps | `arena/mt_eval_harness/cli.py` subparsers (`setup`, `run`). |
| Node ≥ 20 requirement | `cli/package.json` engines; previous homepage ("Works anywhere Node 20+ runs"). |

## Homepage hero — Landing v4, "The Living Index" (2026-06-12)

The homepage hero is now the **Translation Network** (`GraphHero`) with the
**endonym channel** rail (`EndonymChannel`) floating over it — promoted from
the `/hero-lab-v2` lab composition after design review.
All factual surfaces in the hero inherit their existing claims:

- The network nodes/routes/lit-counter claims: see §"The Translation
  Network" (graph.json is generated only from in-repo run reports + the
  public queue; the LIVE counter only promotes nodes confirmed by the
  public `run_cards` query and only ever counts up).
- The endonym rail claims: see §"Endonym channel" (channel.json carries
  only vetted, renderable endonyms — `nativeNameVerdict ∈ {verified,
  plausible}` — with honest English-name fallback; speaker counts come
  from curated card data and are omitted when unknown).
- The inscription register shows run-level composite chips and per-entry
  text from the same in-repo run reports as the Translation Field (same
  honesty contract; the FROZEN reduced-motion entry is a real eng→cym
  entry from run_20260611_114322, composite 0.57).

The Translation Field hero (Landing v3) is retired from the homepage but its
component, data, and claims remain in-repo and binding wherever it is shown.
The headline "Every language, into every language." is the project mission
(aspiration, not a coverage claim); the adjacent live counter states actual
benchmarked coverage.

## Homepage hero + seam — the 2026-07-17 truth pass (v10 data)

The hero was rebuilt around ONE qualified coverage claim; the old three-stat
strip ("7,077 · 439 reachable · 279 benchmarked") is SUPERSEDED — the raw 439
union includes 44 historical/constructed codes (Latin, Esperanto…) and 12
unresolvable codes, so juxtaposing it against the 7,077 LIVING languages
overstated living coverage. The GraphHero live `run_cards` promote fetch was
removed with it (node brightness is strictly method coverage now; benchmark
counts live on the leaderboard). All derived values below are
champollion-derived and regenerate at build (`generateGraphJson.js`,
GENERATOR_VERSION 15 — the rows state MECHANISMS; any literal figures carry
their as-of date and shift whenever the provider lists or the catalog
change).

| Claim | Where shown | Source |
|---|---|---|
| "N of M living languages have machine translation today" (counter) | Hero big-stat (`GraphHero.js` counter) | `graph-poster.json stats.coverage.dedicatedLiving` / `stats.livingTotal`: union of the tracked provider ISO-639-3 lists (`shared/catalogue/method-coverage.json`, each entry cited + asOf) ∩ catalog rows with `isoType === 'L'` (`data/tc-index.json`). Champollion-derived; rendered from build stats, never hardcoded (552 / 7,077 as of 2026-07-19). |
| "Open machine translation support for at risk, endangered, and underserved languages." (hero subline, founder wording 2026-07-19) | `index.js` hero subline | "At risk, endangered" = the Glottolog-AES at-risk aggregate (`stats.atRisk`: shifting/endangered/critical/dormant, champollion-derived); "underserved" = living languages no tracked provider covers (`stats.coverage.uncoveredLiving`) plus the low-coverage tail. Mission framing over the binary map; exact figures in the stat tooltip + endangerment explorer. |
| Three-tier hero frame + legend "Bright green: a deployed service · Dim green: open research model only · Red: no machine translation" (v17, founder 2026-07-19 "the map must be true") | Ambient hero (engine `displayMode:'binary'` + `PosterSvg`) + `.legend` line | Tier from each node's own coverage mask via `pairReachability.coverageTier` (the SSOT `COMMERCIAL_MASK`/`OPEN_MASK`): **bright green + white core** = a DEPLOYED service lists it (Google/Microsoft/DeepL/LibreTranslate); **dim green, no core** = only an OPEN research model lists it (NLLB/OPUS/M2M-100/MADLAD-400 — a code in a model card, not a deployed service); **red** = no tracked method lists it. Recomputed client-side from `cols.m` (the union of the cited `method-coverage.json` lists). LIVING languages only (`cols.liv`, `isoType === 'L'`). The join is EXACT-CODE — a provider's macrolanguage entry (e.g. Google's `que`) lights only that node, never its member varieties (`cli/test/coverage-tier.test.js` pins this). Coverage is a published-list claim, never a quality claim. |
| Moving packets on the hero | Ambient hero fx layer (`GraphEngine.spawnBinaryPacket` / `buildBinaryRoutes`) | ILLUSTRATIVE traffic on the DEPLOYED-SERVICE network only: routes are sampled `graph.json methodEdges` filtered to pairs a commercial service covers both ends of (`mask ∩ mask ∩ COMMERCIAL_MASK`), single teal-white hue — motion only, never a data claim. Open-model-only nodes carry no packets (matching their dim/static rendering). Disclosed in the hero ProvenanceTip and `lineTaxonomy.mjs` (`packet-trail`); the explore-mode map flies no packets. |
| Poster aria-label (living field: bright-green service w/ core, dim-green open-model-only, red uncovered) | `GraphHero.js` PosterSvg `aria-label` | Built from `poster.stats.coverage.serviceLiving` + `.openOnlyLiving` + `stats.livingTotal` at render — the three-tier breakdown the counter's ProvenanceTip also reads; never hardcoded. |
| Stat tooltip tier split (commercial-service vs open-models-only vs covered non-living vs at risk) | Hero ProvenanceTip | `stats.coverage.{serviceLiving,openOnlyLiving,coveredNonLiving}` + `stats.atRisk`. Service = COMMERCIAL_MASK union; open = OPEN_MASK union (`pairReachability.js` — includes M2M-100 · MADLAD-400 since v13). |
| Hub sub-labels "service" / "open models"; OPUS-MT & Tilde packets shuttle hub↔language (never a pair claim) | The LIVE MAP (engine mesh mode — explore only since v15) | `method-coverage.json` per-method `tier`/`anyToAny` (OPUS-MT count is enumerated from the Tatoeba-Challenge PAIR table — per-pair Marian models, NOT any-to-any; note in that file). methodEdges: sampled covered pairs for any-to-any methods only. |
| Warm ember ramp = at-risk levels (live map + endangerment explorer) | Engine mesh-mode dim-field pass + the explore-mode Endangerment panel | Per-node Glottolog-AES LEVEL packed in `graph.json cols.p` (v 0–5, `src/utils/vitalityScale.js` — the cross-runtime SSOT; generator fails loud on unknown vocabulary); champollion-derived aggregates — each language card still shows the full per-source vitality spread (card-boundary invariant respected: no run results, badge = displayed AES value). Explore mode only since v15 (the binary hero shows the flat red uncovered story). |
| Registered-pairs layer default OFF ("Registered · N" chip) | Map view chips | mesh.json `registered` edges are queue registrations awaiting measurement, not method connections — founder truth requirement: no non-method lines in the default frame. |
| Seam Beat 1: "Google, Microsoft, NLLB, DeepL — every major service and model combined covers 383 of the 7,082 living languages." + "6,694 living languages · covered by none" legend + "EVERY MAJOR TRANSLATOR combined" badge | `ZipperSeam.js` beat 1 (centralized-MT scene, v12 — generalized from the NLLB-only v10 scene: the centralized-model critique holds for Google and most MT alike, founder 2026-07-17) | `poster.monolith` v2 (`generateGraphJson.js` v12): covered = LIVING languages with ANY dedicated-engine bit (`stats.coverage.dedicatedLiving` = 383); uncovered = 6,694; per-method counts + sources shipped in `monolith.methods` and listed verbatim in the on-page Tip. Dots are REAL layout positions: all 383 covered living + a 380-language seeded sample of the uncovered mass. "Every major" = the seven tracked providers in `method-coverage.json` (each cited, asOf 2026-06-28). |
| Seam slide 0: "Champollion is open infrastructure to support communities building machine translation for their own languages." | `ZipperSeam.js` opening slide | Project self-description (founder wording 2026-07-17) — no metric encoded; the NC/economics twin lives in `docs/network/sovereignty/economic-model.md`. |
| Seam Beat 2 chain highlight: "…and separate pairs chain into a pathway: Føroysk → Dansk → Español → Runasimi" | `ZipperSeam.js` beat 2 tail (amber rows) | The same illustrative showcase chain as Beats 3–4 (disclaimed there as an illustration of routing/coaching); the zipper rows carry the same pairs so the visitor can connect the dots. No score claimed here. |
| "Champollion-tested" layer (measured arcs + endpoint glow + strength ramp legend) | Explore mode only (v15): the Services panel's `champollion-tested` group toggle | mesh.json edges with `status='measured'` + `best_chrf` (recomputed from the FULL public result set by `arena/scripts/generate_sweep_queue.py`, fold_results_into_mesh); arc colour = cchrF++ strength ramp (`arcStrength.mjs`); endpoint glow renders only while the toggle is on and is the same claim as the arc — a scored run on the public board. Presented as an overlay like any provider layer; never drawn on the binary hero. Hover copy for such nodes reads "measured on the public board", never "coverage". |
| Seam colour semantics: ember `#e0503a` = "no model covers it"; coral `#f08a93` stays "wrong translation" (Beat 4); amber reserved for the frontier lane | `ZipperSeam.module.css` token block | Documented in the token comment; matches the hero map's ember family. |
| Seam mission stat "7,082 living languages" (Beat 6) | `ZipperSeam.js` `buildPlatformStats` | `poster.stats.livingTotal` (previously unrecorded here — back-filled). |
| Seam V2 (home-preview) "There are more than 7,000 living spoken languages today" | `home-preview.js` beat 1 (via `seamStory.mjs`) | Floor phrasing over `poster.stats.livingTotal` read at build through `src/utils/seamFacts.mjs` (fail-loud: the build breaks if the stat no longer supports "more than 7,000"). Guarded by `seamFacts.test.mjs` + `seamStory.test.mjs` (no hand-typed numeric tokens). |
| Seam V2 "Only N* have any machine translation" / "Just M* are served by a deployed service" (two-tier reveal, founder 2026-07-22) | `home-preview.js` beats 2a/2b (via `seamStory.mjs`) | N = `stats.coverage.dedicatedLiving`, M = `stats.coverage.serviceLiving`, template-joined from `seamFacts.mjs` at build — never typed (552 / 196 as of 2026-07-19). Asterisks → `/docs/network/context/coverage-counting` (tier definitions + refresh discipline). Same SSOT chain as the hero counter (row above). |
| Seam V2 "An estimated more than a billion* people … cannot translate … into their first language" | `home-preview.js` beat 3 (via `seamStory.mjs`) | The established conservative floor over `stats.coverageGap.uncoveredSpeakerSumRaw` (≈2.97B raw, L1/L2-blended); method + judgment calls: `/docs/network/context/coverage-gap-estimate` (the asterisk's target). `seamFacts.mjs` fails the build if the raw sum drops below 1B. |
| Seam V2 omnimodel hub timeline (model/service names · release years · claimed language counts) + the Omnilingual shortfall line "~1,200 of 1,600 below their own quality bar" | `home-preview.js` beat 5 (`HubColumn` ← `src/data/seam-hubs.json`) | GENERATED by `cli/scripts/build-seam-hubs.mjs` from `shared/catalogue/method-coverage.json`: cited-only (entries without `source_url`+`asOf` are dropped), counts are each provider's OWN claimed list ("claimed coverage", never quality), `releaseDate`/`deployable` pass through only when cited in the SSOT. The shortfall line is champollion-derived arithmetic on Meta's own §1 self-report (`count − deployable.count`, computed at render — never typed); the beat-6 return-pulse split (~24% decent / rest below-bar) illustrates the same cited ratio. Parity: `check-prose-counts-parity.mjs` asserts seam-hubs.json ≡ method-coverage.json. |
| Seam V2 R1 run-card ("MEASURING <pair> · method <m> · benchmark <b>" + rolling metric table; "RE-MEASURING · COMMUNITY CORPUS" on the improve beat) | `home-preview.js` tape beats (`RunCard` ← `seamStory.RUNCARD`) | Metric names = registry-implemented metrics via `metricPops.mjs`; method names ⊆ method-coverage labels ∪ model-aliases keys ∪ method-registry keys; benchmark names appear on real language cards — all guard-tested (`seamStory.test.mjs`). Scores are illustrative under the card's STANDING footer ("illustrative demo · live scores on the leaderboard") — R1 consolidated the scattered caption sublines into this one on-surface disclosure. |
| Seam V2 measured/illustrative traffic — R2 grammar: packets travel between LANGUAGE PAIRS only (covered-pairs working traffic from real `buildBinaryRoutes` pairs; failing traffic on non-major pairs in beat 6; hop-trains for the route search / improved-route payoff / Ayta aim; climbing spa→quz transmission test; scored-pair lock pulses). Instruments (hub cards, tape head, run-card) never emit or receive packets; the only persistent lines are locked measured spectrum edges. | `home-preview.js` traffic/tape/route/transmit/improve/anywhere beats | ILLUSTRATIVE + ASPIRATIONAL by founder grant (2026-07-22), disclosed on-surface via the run-card's standing footer. Colours ride `qualityColors.qualitySpectrum` (anchored on the tier SSOT); metric names shown are real `metric-registry.json` implemented metrics via `metricPops.mjs`; the route winner is computed by the real `meshChains.bestMeasuredChain` loss-router over the disclosed demo graph — never hardcoded (loser trains fizzle at their computed weakest hop). The beat-6 failing traffic and the Ayta-cluster teal aim make no named-pair quality claim. |
| ~~Seam V2 R1 endonym flurry (beat 14)~~ **RETIRED 2026-08-07 (R8)** | — | The background endonym labels were removed from the `endInView` beat at founder direction. Nothing replaced them as a claim: that beat's image is now the exploding lattice + the packet flood, both of which are already covered by their own rows below. |
| Seam rights beat (R4 wording): "Communities set the standard for their own language" + the seal note "the sealed set is the strongest AUTOMATED benchmark — but speakers themselves review and rank what serves their language" | `home-preview.js` rights beat + `.sealCommunityNote` (via `seamStory.mjs`) | The documented Community Validated verification tier (`docs/network/leaderboard/rules.md` §Verification tiers; `benchmark-spec.md`) phrased as the RULE — communities author their own sealed sets and standards, and human community ranking outranks any automated score. No claim that a specific score has cleared a speaker gate (none has). |
| Seam V2 beat-6 pull-quote: "specialization, not scale, is perhaps a more reliable path to high-quality multilingual translation" — attributed to the Omnilingual MT paper | `home-preview.js` beat 6 quote chip | VERBATIM from Omnilingual MT (The Omnilingual MT Team, FAIR at Meta), arXiv:2603.16309 §1 (verified against `references/Research Papers/OMT-1600 paper.pdf`, 2026-07-22). Context honesty: the paper's contrast is specialized 1–8B MT models vs a 70B general LLM — quoted for exactly that (small/specialized over scale), never paraphrased into claims the paper doesn't make. Meta's coverage self-report on the hub row (">400 of 1,600 understood 'sufficiently well'", §1) is likewise their own wording, cited on `method-coverage.json omt1600.deployable`. |

### Seam R3 (2026-07-22d) — the chain panel, the living route, honest per-pair metrics, the Earth map

| Claim on the page | Where | Why it's true (the SSOT chain) |
|---|---|---|
| Seam R3 chain panel: a sentence travels Føroyskt → Dansk → Español → Runasimi through glass hop-cards, with per-hop BRIDGE cards naming the corpus, licence and metrics of that hop, and the rough→fixed Quechua correction + chrF++ 24 → 71 swap | `home-preview.js` route/improve beats (`ChainPanel` ← `seamRuns.mjs` + `metricPops.CARD_HERO`) | The travelling SENTENCE + its per-language renderings are the SAME illustration as the live `/` homepage's Beat-4 chain (disclosed as "an illustration of how routing & coaching work" — `metricPops.CARD_CAVEAT`, shown on the panel). The BRIDGE cards are NOT illustrative prose: corpus display name + SPDX licence + the pair's VALID metric names all come from `src/data/seam-runs.json` (generated by `cli/scripts/build-seam-runs.mjs`). The 24 → 71 numbers are `metricPops.CARD_HERO` (from the quz card context). |
| Seam R3 per-pair metric validity: COMET / AfriCOMET appear on a run ONLY where the metric is reliable for BOTH languages; the corpus a pair is measured on is named (or honestly "no held-out benchmark yet") | `RunCard`, `ChainPanel` bridges, and the transmit pop chips — all read `seamRuns.mjs` | `build-seam-runs.mjs` gates COMET on `metricModelSupport.xlmr` and AfriCOMET on `metricModelSupport.africomet.supported` present on BOTH language cards (`LANGUAGE-CARD-FIELDS.md` §7.4); every emitted metric name resolves to a `status:implemented` `metric-registry.json` entry. The benchmark is a real eval set BOTH languages sit on (intersection of their `evalDatasets` — since the atlas cutover, eval wiring from `card-config.json` `evalConfig` attached to the composed card view, derived from the corpora cards by `sync-eval-datasets.mjs` → `corpora-cards/<id>.json` name + `license.spdx`); spa↔quz / quy↔quz share none (quz has no eval sets) → "no held-out benchmark yet". Guard-tested (`cli/test/website-seam-runs.test.js`, explicit fixtures: dan↔spa ✓COMET, spa↔quz ✗COMET, fra↔bam ✗both, swh↔lug ✗both — AfriCOMET's publisher-verified list (`metric-coverage.json`, asOf 2026-08-05) covers Swahili only as macro `swa` and not Luganda at all, so the pre-atlas ✓AfriCOMET there was an over-claim the faithful mapping removed 2026-08-17). Fixes the R2 wrong (COMET-22 popped at quz); `build-metric-pops.mjs` improve-card concur is likewise now gated (spBLEU, not COMET, at quz). |
| Seam living-route reroute (CONDENSE, founder 2026-07-24): four measured improvements ripple along the chain, then a new eng↔quz measurement CONDENSES the route — fao→dan→spa→quz becomes fao→eng→quz, the Danish + Spanish relays eliminated for a single high-resource English pivot (a 2→1 interlingua reduction) | `home-preview.js` reroute beat + `ChainPanel.reroute` (route graph in `seamStory.mjs`, winner via `meshChains.bestMeasuredChain`) | The reroute winner is COMPUTED by the real loss-router on the grown demo edge-graph — never hardcoded. Guard-tested (`seamRoute.test.mjs`): the router genuinely flips (base → fao→dan→spa→quz, 2 interlingua; reroute → fao→eng→quz, 1 interlingua) and the flip is by LOSS, not hop count (the condensed 2-hop path has lower total loss than the 3-hop base). Edge values are illustrative (disclosed by the same standing run-card footer). The inserted pivot (English) is shown as "routing pivot" — identity + role, NEVER a fabricated translation; the sentence's target text is unchanged — only the PATH gets shorter and better. |
| Seam R3 Earth-shaped map: `/home-preview` places dots by a rough world-map projection ("linking humanity") | `generateGraphJson.js` `geoLayout()` → `graph.json cols.gx/gy` → `GraphEngine` (`layout:'geo'` via `GraphHero`) | Positions are an equirectangular projection of Glottolog 5.3 `coordinates.{lat,lng}` (from the language cards, 96%+ node coverage; missing → family centroid) into the WORLD square, then a per-cell de-clump — a champollion-derived PROJECTION of cited coordinates, not an assertion by Glottolog. ADDITIVE + version-pinned: `cols.x/y` (family blobs) are byte-unchanged, so the live `/` homepage and the SSR poster are byte-identical (`graph-poster.json` unchanged); only `/home-preview` opts into geo. |
| Seam R3 sovereign seal: the five-part mechanism (a method → comes to the data → the sealed community vault → only a score returns → chrF++ 81 · FST validation · Morphological equivalence) | `home-preview.js` rights beat (adapts the `/` Beat-5; `SEAL_MAIN`/`SEAL_NAMES`/`SEAL_CAVEAT` ← `metricPops.mjs`) | Same claims as the prior trimmed seal, richer render: the returned-score card's number + metric NAMES are the Plains Cree (crk) sovereign set's OWN LYSS validators (`crk.evalMetrics` via `build-metric-pops.mjs`), illustrative under `SEAL_CAVEAT` ("sealed · community-run · illustrative"). No sealed-set run has published; the score is disclosed as illustration. |

**R4 refinements (2026-07-24)** to the seam rows above: (1) the chain-panel BRIDGES and the tape run-card now show illustrative metric VALUES (not just names) — all derived by `seamMetrics.lensTarget(name, q)` from one per-pair quality `q`, in the SAME lens set `seamRuns` gates per language (COMET only where XLM-R supports it — dan↔spa yes, spa↔quz no), disclosed by the run-card's standing footer. The chain, the zipper, and the map are driven off ONE `tapeState`, so a pair's colour + rolling values lock in step. (2) The quz correction chips now carry the pair's FULL valid-lens line (`chrF++ · spBLEU · TER`, never COMET). (3) The seal's returned-score is a full mini run-card (`SEALED RUN · eng↔crk · EdTeKLA`, the LYSS validators shown as PASS ✓ — they are validators, not numeric scores, so no numbers are invented for them). (4) The pop-up chrF++ chips (`MetricPop`) were REMOVED — the chain + tape carry every reading now. (5) Copy: the ambiguous "omnimodels" → "one model that tries to speak hundreds — or thousands — of languages"; a new caption states specialization + Champollion's coordinating role as "a global community effort" (ties to the verbatim Meta specialization-over-scale quote already cited above). No hand-typed numerals in any of this (guard: `seamStory.test.mjs`, `cli/test/website-seam-runs.test.js`, `seamMetrics.test.mjs`, `seamRoute.test.mjs`). |

**R6 revisions (2026-07-25b) — told without words; the instruments share one clock.**

| Claim | Where | Source / basis |
|---|---|---|
| The map beat draws hundreds of REAL pairs, which then light up as they are measured | `home-preview.js` (the network lattice) | Edges are the engine's own `buildBinaryRoutes()` (real `methodEdges` from `graph.json`; 771 available, ≤320 desktop / ≤120 mobile sampled deterministically). **R6 supersedes the R5 framing below:** the "most of this network is a claim" beat was deleted, and with it the claims-vs-measured reading. An edge now starts SLATE (unmeasured — slate is never a quality colour) and interpolates toward a quality colour as the tape's row count passes it. Its per-edge quality is illustrative under the standing run-card footer. |
| The zipper and the map are the same event, not two animations | `seamStory.mjs` `TAPE_RATE`/`tapeRowsAt` + `home-preview.js` lattice ignition | The tape's advance is a piecewise rate profile integrated to a cumulative row count (pure in `p`, monotone, lands exactly on ROWS at the belt end — guard-tested). It runs ~3.4× faster across the measure beats, and **the lattice ignition is driven by that same `scoredCount`**, so a tape burst *is* a map flood. Verified live: the lattice lights ~3.5× faster through the burst than through the tail. |
| The zipper's queue is real, and prioritises marginal languages | `seamStory.mjs` `STORY_PAIRS` (64 rows) | Filler rows are taken in priority order from the real queue artifact `static/queue-preview.json` (`pairs[]`, 406 entries, generated by `arena/scripts/generate_sweep_queue.py`), filtered to codes that have BOTH a language card and a map node (Santali, Sakha, Ho, Venda, Brahui, N'Ko, Chechen, Fon, …). The narrative rows (teaching chain, community re-measure, reroute) are unchanged. Per-row `q` is illustrative under the standing footer. |
| ~~The Answer Card demonstrates a request being answered~~ **RETIRED 2026-08-07 (R8)** | — | The `askIt` beat and `AnswerCard.js` were DELETED at founder direction ("out of context and just adding too much"). No surface now makes this claim. See the R5 row below, likewise retired. |
| "One command, and anyone can contribute compute to map the network" — shown as the REAL command, not asserted in prose | `CommandCard.js` (+ `seamStory.mjs` `RUN_QUEUE`, `LOOP_LAPS`) | **Changed in R8 (2026-08-07):** the `mt-eval run` ring (`MethodLoop.js`) was deleted — the founder called it "a weird MT EVAL RUN graphic". The claim is now made LITERALLY: the card shows the queue-runner command verbatim with a button that copies it. The command is `RUN_QUEUE.cmd`, guard-tested character-for-character against `cli/website/static/run_queue`'s own usage header, and all four key names it offers are guard-tested as supported by that script; `--budget` is shown because the script requires a spend cap. The three run rows keep `LOOP_LAPS` unchanged (real `RUNCARD.methods`; each `qNew` must exceed its row's `q`, guard-tested) and remain illustrative under the standing footer. `/run_queue` is exempt from the review gate (`middleware.js`) so the command is not a dead link. **Open, founder-owned:** `mt-eval` is not yet on PyPI and the public repo is private, so the script's install step cannot yet succeed for a stranger. |

**R5 additions (2026-07-25) — the network lattice, the Answer Card, the end-in-view.**

| Claim | Where | Source / basis |
|---|---|---|
| The map's "whole network" beat draws HUNDREDS of edges — the pairs a deployed service CLAIMS to cover — in a dim neutral colour, with the handful of MEASURED pairs igniting in spectrum colour on top | `home-preview.js` `mapWhole` beat (the CLAIMED lattice) | The lattice edges are the engine's own `buildBinaryRoutes()` — real `methodEdges` from `graph.json`, filtered to pairs where a commercial service's coverage mask covers BOTH ends (771 available; a deterministic stride sample of ≤320 desktop / ≤120 mobile is drawn, halved again if `__GRAPH_STATS.avgFrameMs > 24`). **These are COVERAGE CLAIMS, never quality**, so they are drawn in a fixed neutral slate (`LATTICE_RGB`) and are structurally incapable of carrying a `qualitySpectrum` colour — the same rule as the provider counts ("claimed coverage, never quality"). The visual contrast IS the site's existing claim (beat 7: "Coverage is a claim. Quality is a measurement.") shown rather than asserted. |
| ~~The Answer Card's candidate METHODS, domain, metric names and benchmark are real~~ **RETIRED 2026-08-07 (R8)** | — | The card was deleted with the `askIt` beat. `SEAM_ANSWER` in `seamRuns.mjs` and its generator branch in `build-seam-runs.mjs` are now dead and are scheduled for pruning; the payload is no longer rendered anywhere. |
| ~~"One command, and anyone can run it" — per-pair configurable methods, plugins as JSON manifests~~ **SUPERSEDED 2026-08-07 (R8)** | — | The Act VI build panel this described was already gone; the beat now carries the command card (row above). The build lane is claimed only by the `shareIt` caption ("…or build, test, and publish your own method"), which links to `/docs/network/getting-started/submit-a-method`. |
| The closing image fills the map TEAL, and the network EXPANDS into it | `home-preview.js` `endInView` beat | Teal is the seam's established AIM colour — "teal = aim vs spectrum = measured". The fill runs `setPulseWave({mode:'uncovered', color: TEAL})`, i.e. it lights exactly the population that swept RED in beat 3, so the closing image answers the opening gap as an ASPIRATION and never asserts coverage. The caption "We can build a UNIVERSAL TRANSLATOR — but only by working together" is teal for the same reason: it is a stated aim, conditional on collaboration, never a measured claim. **Changed in R8 (2026-08-07):** the lattice now GROWS into this beat (320 → 520 real pairs from `buildBinaryRoutes()`, live-degraded on slow frames) instead of fading to nothing, and the beat carries the densest packet flood in the seam — every packet is either a tape row the story actually locked, in that row's own measured colour, or a real deployed-service mesh route. Density is accumulated evidence, not a knob. The endonym flurry that used to bloom here was removed. |

**R8 additions (2026-08-07) — the founder's correction pass on the live seam.**

| Claim | Where | Source / basis |
|---|---|---|
| The close card lists **every** public tool, not a selection | `seamStory.mjs` `CLOSE_TOOLS` → `home-preview.js` close beat | Founder direction: "make sure all the tools are listed, not just the CLI, harness, and Atlas". Seven entries, each a name the docs themselves use and a route guard-tested to resolve to a real page: the CLI, the harness (mt-eval), nmt-forge, the Language Atlas, the Sovereign Eval Node, LYSS metrics, the benchmark queue. The kicker reads "ALL SOURCE-AVAILABLE" (2026-08-17 licensing split — see §"Licensing language" below): every listed tool's source is public, but "open source" is no longer a project-wide claim. |
| "Communities **set the standard** for their own language" | `seamStory.mjs` `rights` beat | Unchanged in substance from R7's "the most reliable methods are the ones speakers maintain" — the founder removed the rhetorical "On whose terms?" opener because the sovereign seal beneath it already answers the question. Amber, the seam's sovereign-lane colour. Footnote links to the data-sovereignty doc. |
| Six re-measurements land on the chain, each by a method that pair had not been measured with | `seamStory.mjs` `STORY_PAIRS` rows 35–40 → `ChainPanel.js` | Founder: the improve stage "doesn't really show it improving … I want at least 6 measurements reflected in the lower cards … through multiple new methods dropping". Each hop of the teaching chain is re-measured twice. Method names are the guard-tested `RUNCARD.methods` vocabulary and each is guard-tested to DIFFER from the reading it replaces; each `q` must exceed that pair's previous reading; all six must lock inside `WIN.improve`, ≥14vh apart. The last is `spa↔quz` at exactly `IMPROVE_EDGE.best_chrf`, so the chain's green and the router's decision are the same fact. Values remain illustrative under the standing footer. |

**R7 additions (2026-07-25) — the truth fix, the Meta quote, and the communities beat.**

| Claim | Where | Source / basis |
|---|---|---|
| "omnimodels that **claim to cover** a thousand languages at once" | `seamStory.mjs` `omni` beat | The verb is doing load-bearing work: coverage is a published CLAIM, not a measured result. "a thousand" is a FLOOR checked at build time against the largest count on the hub timeline (`seamFacts.HUB_CLAIM_FLOOR_LABEL`; Omnilingual MT's own 1,600 — `seam-hubs.json`, sourced from `shared/catalogue/method-coverage.json`). If that top claim ever drops below 1,000 the build fails rather than shipping stale copy. |
| "Their own numbers say most of that coverage is **low quality at the margins**" | `seamStory.mjs` `notWorking` beat | **This REPLACES the R6 line "Most speakers of those languages can tell you: this isn't working", which the founder correctly called false** — it asserted MT is a blanket failure, and our own cited data shows chrF 0.67–0.72 on well-resourced pairs. The replacement claim is narrower, sharper, and is the provider's own: Meta's Omnilingual MT report states the models "understand sufficiently well" just over 400 of the 1,600 languages (§1), with "non-trivial performance" translating into ~1,200. HubColumn renders that arithmetic (~1,200 of 1,600 below their own quality bar) from the SSOT beside this caption. A build-time check in `seamFacts.mjs` fails if the top hub stops self-reporting a majority shortfall. |
| The Meta quote holds the screen alone | `seamStory.mjs` `metaQuote` beat | VERBATIM from Omnilingual MT §1 — "specialization, not scale, is perhaps a more reliable path to high-quality multilingual translation" — attributed on screen and linked to [arXiv:2603.16309](https://arxiv.org/abs/2603.16309). We quote it and stop: the page never characterises what it means for them or for us. Rendered in the caption's own serif at the same weights as every other beat (bigger and wider only), so it is emphasis, not a new voice. |
| Speaker communities and linguists are **already building** for these languages — with 14 named, linked projects | `seamStory.mjs` `communities`/`communityWork` beats + `communityProjects.mjs` | Every entry links to the project's OWN site, repo or paper — never to us (guard-tested: `communityProjects.test.mjs` rejects a champollion.dev or gamedaysuits URL). Roster and citations: [AmericasNLP](https://turing.iimas.unam.mx/americasnlp/) · [Masakhane](https://www.masakhane.io/) (MAFAND-MT, AfriCOMET) · [GiellaLT/Divvun/Giellatekno](https://github.com/giellalt) · [Apertium](https://www.apertium.org/) · [Gamayun / CLEAR Global](https://huggingface.co/datasets/CLEAR-Global/Gamayun-kits) · [AI4Bharat](https://ai4bharat.iitm.ac.in/) · [IndoNLP NusaX](https://github.com/IndoNLP/nusax) · [MENYO-20k](https://github.com/uds-lsv/menyo-20k_MT) · [LoResMT](https://github.com/loresmt) · [FLORES+ / OLDI](https://github.com/openlanguagedata/flores) · [OPUS/Tatoeba](https://opus.nlpl.eu/) · [EdTeKLA](https://github.com/EdTeKLA/IndigenousLanguages_Corpora) · [ChoCo/Masheli](https://lt4all.elra.info/media/papers/P6/109.pdf) · [Government of Nunavut](https://www.gov.nu.ca/en/culture-language-heritage-and-art/language-preservation-and-promotion-through-technology-ms). The `kind` spread is deliberate per founder direction — dictionaries, FSTs, metrics, corpora and shared tasks count, not only deployed MT. |
| **NO ENDORSEMENT.** Naming these projects claims no partnership, endorsement, affiliation or use | `communityProjects.mjs` header rules 2–3; `home-preview.js` project overlay | These are published, self-organised efforts that we CITE. No Champollion branding sits adjacent to any project name, and no copy states or implies that any of them use, endorse or are associated with Champollion. Rule 3 additionally bars naming private individuals — credit goes to the work, not to people who never agreed to appear on our homepage; institutional actors (a government department, a university lab) may be named. Guard-tested (`communityProjects.test.mjs` → "no project entry names a private individual"). |
| The ChoCo entry says corpus + dialogue system + morphology generator — **never "Choctaw MT"** | `communityProjects.mjs` `choco` | Verified against the paper itself (Brixey & Traum, *ChoCo: A Multimodal Corpus for the Choctaw Language*, LT4All): 30 videos (105 min), 257 min audio, 62,259 Oklahoma + 32,046 Mississippi word tokens; Masheli is response SELECTION over bilingual stories (NPCEditor backend); stated current/future work is OCR correction, audio processing and a morphology generator. **The paper does not mention machine translation at all.** A popular-press essay gives a far larger word count — we cite the paper. Guard-tested: the entry's description may not contain "translat". |
| The Government of Nunavut entry is labelled a **vendor deployment**, and never implies the deployed system is open | `communityProjects.mjs` `inuktut` (`kind: 'deployed (vendor)'`) | Verified against the GN's own newsroom: the Department of Culture and Heritage leads the *Preservation and Promotion of Inuktut Through Technology* project, Microsoft supplies the models and infrastructure, and the neural voices were trained on recorded audio from proficient speakers who "donated their knowledge and expertise". Timeline: Microsoft Translator 2021 → Inuinnaqtun + romanized Inuktitut 2022 → Azure text-to-speech Dec 2024. It belongs in this beat because coverage FOLLOWED community effort; it is the one roster entry whose deployed system is closed and commercial, and is labelled as such. |
| "The most reliable methods are **the ones speakers maintain**" | `seamStory.mjs` `rights` beat | A claim about reliability, not about ownership or custodianship of any named community's data — consistent with `CLAUDE.md`'s rule that no nation or organisation is named publicly as a key custodian before consent. The asterisk links to the existing `/docs/network/sovereignty/data-sovereignty` page. Te Hiku Media's *Kaitiakitanga* principle is cited on that page, not adjacent to Champollion branding, and nothing implies they use or endorse Champollion. |
| The `expanse` beat's abundance is real, not a density knob | `home-preview.js` (the expanse) | Every packet in the beat is a tape row that has actually LOCKED by that progress, drawn in that row's own measured colour, with a mild bias toward higher-scoring pairs. It reads as a fuller network because by that point in the story more of the network has genuinely been measured. Illustrative per-row `q` rides the standing run-card footer as everywhere else. |
| Beat windows and the tape gearbox are one ruler | `seamStory.mjs` `LAYOUT_VH` / `BELT_VH` / `TAPE_RATE_VH` | Every window, the belt, and the rate profile are declared in scroll distance (vh) and divided by the runway, so re-proportioning cannot silently drift a beat off the mechanism that causes it. `rowLockAt` inverts the gearbox analytically, so anything keyed to "row *i* has been measured" fires on the same clock as the tape head — guard-tested (`seamStory.test.mjs`). |

## Per-provider coverage counts in docs prose (2026-07-22 sweep)

Every per-provider "N languages" figure in the published docs comes from
`shared/catalogue/method-coverage.json` — the cited, per-method coverage SSOT
(each entry imported cite-only from the provider's own published list, with
`source_url` + `asOf`). The 2026-07-22 sweep replaced the stale "~130 /
130+ languages" Google figure (and the understated Microsoft/DeepL/Lara
floors) everywhere in `cli/website/docs/` with the SSOT counts, and every
literal is now registered in `cli/scripts/check-prose-counts-parity.mjs`
(§6, `PROVIDER_COUNT_SITES`) — count drift or a de-anchored rewording
hard-blocks the push, and the retired "~130 / 130+" phrasings are banned
from reappearing in any docs page.

| Provider figure in prose | SSOT entry | Basis |
|---|---|---|
| Google — 194 languages | `google-translate` (count 194) | Google Cloud Translation's published NMT language list (`docs.cloud.google.com/translate/docs/languages`), asOf 2026-06-28; page re-verified unchanged 2026-07-22 (page states "Last updated 2026-07-17"). The consumer Google Translate product is widely reported around 249 languages, but that count has no first-party static citation (it is Wikipedia's tally of Google's own list) — docs prose deliberately uses the tracked Cloud NMT list instead. |
| Microsoft — 135 languages | `microsoft-translator` (count 135) | Azure AI Translator language-support page. |
| DeepL — 33 languages | `deepl` (count 33) | DeepL supported-languages developer page. |
| NLLB-200 — 200 languages | `nllb` (count 200) | FLORES-200 README / model card. |
| Translated Lara — 200 languages | `translated` (count 200) | Provider's published list (was "200+", a false strict floor at exactly 200). |

Registered surfaces: `network/intro.md`, `network/how-it-works.md`,
`network/getting-started/agent-guide.md`,
`network/community/low-resource-languages.md`,
`network/context/mt-field-briefing.md` (also drops the uncited "Google's
240+" consumer comparison), `getting-started/installation.mdx`,
`integrations/frameworks.md`, `guides/translation-methods.md`
(the Microsoft "including many that Google doesn't cover" claim softened to
"including some" — the SSOT ISO 639-3 set difference is 19 languages, e.g.
Tibetan, Faroese, Inuktitut), `reference/supported-languages.md`.
`static/llms-full.txt` is GENERATED from these pages
(`cli/website/scripts/build-llms-full.mjs`) and inherits the fix on rebuild.

## Empty-board policy

The production leaderboard starts empty and populates only as runs publish
through the harness integrity gate. Consequences for claims on this site:

- The homepage leaderboard tile carries NO static fallback rows; with an
  empty board it says so honestly and links to /contribute.
- "Languages benchmarked" counters regenerate from current data at build
  time and read 0/low until verified runs publish.
- The featured-card tile cycles through sampled catalog languages; the crk
  variant's pipeline stats (91.5% FST acceptance, 494-entry full sweep)
  come from that method's published results record.
- Archived or retired run figures are never republished without passing
  the harness integrity gate.

## Licensing language (2026-08-17 — the PolyForm split)

Founder decision 2026-08-17; the root `LICENSE` overview is authoritative.
The product lanes — CLI, nmt-forge, MCP server — are **PolyForm Noncommercial
1.0.0** (source-available, free for noncommercial use; commercial use by
permission). The protocol-and-verifiability lanes — the eval harness
(AGPL-3.0-or-later + §7 eval-plugin exception) and the `shared/` +
`mt-eval-arena/` registries (Apache-2.0) — stay open source. The site
therefore never claims the whole project is "open source"; the truthful
formulation is variants of *"source-available and free for noncommercial use;
the evaluation harness and shared registries are open source."* Where a page
refers specifically to the harness/registries or to third-party software,
"open source" stands.

| Claim | Where | Source |
|---|---|---|
| pledge "non-commercial · source-available · communities hold the keys" | `home-preview.js` GraphHero pledge (×2) | Root `LICENSE` split; "source-available" is true of every component, including permission-gated LYSS. |
| "100% source-available" stat tile; "Source-Available / PolyForm NC + AGPL · GitHub" values badge | `ZipperSeam.js` | Same; the badge names the license families of the published packages (npm PolyForm NC, PyPI AGPL). |
| "THE TOOLS · ALL SOURCE-AVAILABLE" | `home-preview.js` close beat | Every `CLOSE_TOOLS` entry's source is public; licenses differ per component (root `LICENSE`), so the stronger "ALL OPEN SOURCE" was retired 2026-08-17. |
| "Built on source-available technology that protects community data." | `seamStory.mjs` `openSource` beat | Same split; the contrast with closed, for-profit models is preserved without overclaiming. |
| Tagline + meta description "Source-available infrastructure … free for noncommercial use" | `docusaurus.config.js` | Root `LICENSE`. |
| Key-facts row "CLI PolyForm Noncommercial 1.0.0 (source-available, free for noncommercial use), eval harness AGPL-3.0 (open source)"; press paragraph + boilerplate "source-available and free for noncommercial use, with an open-source evaluation harness and shared registries" | `docs/network/who-benefits.mdx` (#press) | `cli/LICENSE`, `arena/LICENSE` + `arena/LICENSE-EXCEPTION.md`. |
| "Everything here is source-available and free for noncommercial use — the evaluation harness and shared registries are open source" | `src/pages/for-agents.md` (→ derived `static/for-agents.md`) | Root `LICENSE`. |
| CLI pricing: "no subscription and no per-seat pricing … free for noncommercial use; commercial use requires permission" | `docs/guides/enterprise.md` | `cli/LICENSE` (PolyForm Noncommercial 1.0.0 §"Noncommercial Purposes"); replaces the retired "no license fee / open-source" claim. |
| Remaining "open source" wording site-wide is harness-specific or third-party (LibreTranslate AGPL, GiellaLT, Apertium, OpusMT, morphodict, "the eval harness is open source", the leaderboard's per-method Open/Closed Source flag) | guides, context briefings, `leaderboard.js` | Unchanged by design — those statements describe the AGPL harness or third parties, which are open source. |
