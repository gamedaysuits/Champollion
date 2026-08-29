Here are guidelines for using the Champollion MCP server effectively:

## Orientation

Start with `get_project_info` to understand what Champollion is and how contributions work. This returns a project overview, current queue statistics, and setup instructions.

## Common Workflows

### "I want to help" / Contributing Compute

1. Call `get_project_info` to understand the project
2. Ask the user about their budget and any language preferences
3. Call `search_languages` if they mention a language by name — this resolves to ISO codes
4. Call `estimate_cost` with their budget to show exactly what they'd fund
5. Present the estimate and **get explicit confirmation** before proceeding
6. Only then call `run_benchmark` with the agreed parameters (and `confirm: true`). This returns **immediately** with a **job id** — the benchmark runs in the background (see "Running is asynchronous" below)
7. Poll `get_run_status` with that job id every ~15-30s until it reports `COMPLETED` or `FAILED`
8. Once it completes, call `get_results` (filtered to the pair/model they ran) so they can see what they scored on the public leaderboard — this closes the loop

#### Running is asynchronous (important)

A real benchmark runs a corpus through a live model and takes **minutes**, which is longer than the default 60-second request timeout most MCP clients (Claude Code, Cursor) enforce. So `run_benchmark` does **not** wait for the run to finish — it launches the run in the background and returns a `job id` right away. Treat that `STARTED` response as success, **not** completion. (A queue-mode `dry_run` is backgrounded the same way — the harness loads the full ranked queue before printing its plan — so poll `get_run_status` for the plan; an `item_id` dry run answers inline.)

- After `run_benchmark` returns, call `get_run_status { "job_id": "run-N" }`. Each poll returns instantly: `RUNNING` (keep polling), `COMPLETED` (output is in the response), `FAILED`, or `ERROR`.
- Do **not** re-call `run_benchmark` because nothing "came back" — that would start a **second** run and spend tokens twice. The first call already started it; poll `get_run_status` instead.
- Jobs live in the server process's memory, so a job id is only pollable from the same session. Call `get_run_status` with no `job_id` to list every job started this session.

The estimate you show in step 4 is what executes: `run_benchmark` runs budget/top items in **deterministic top-of-queue order** (it passes `--no-spread`), so the selection matches the `estimate_cost` / `list_queue` preview item-for-item. (One caveat for honesty: `estimate_cost` samples up to ~500 matching items from a bounded scan of the top of the ranking — its reply says how deep it looked when the bound bites — so for a very large budget or a very narrow filter, treat its count/total as a lower bound.) A live run additionally skips any (corpus, model, condition) combo already on the leaderboard, so the executed set can be a subset of the preview — never a different, unseen set.

To spend tokens for **scoring/validation without writing to the leaderboard**, pass `publish: false` to `run_benchmark` (budget/top mode). A single `item_id` run is always scored locally and is never auto-published — publish it afterward with `mt-eval publish`, or use budget/top mode to auto-publish.

### "What's been scored?" / Seeing results

The public leaderboard is the read side of the loop: it shows scored runs (composite, chrF++, BLEU, COMET) with trust level and attribution.

1. Call `get_results` — filter by `source_language` / `target_language` / `model`, and `sort` by the metric of interest
2. Call `get_run_card` with a result's `id` for the full scores + method/config/provenance metadata
3. An empty result is normal on a fresh board — it means no one has benchmarked that slice yet, which is exactly where contributing compute has the most impact

Results are scored aggregates and run-card metadata only — never raw test sentences (those stay in the license-gated entries table).

### "Which score should I believe?" / Metric trust

Before comparing scores for a low-resource target language, call
`get_metric_reliability` with the target language (code or family name). It
returns how well each metric (BLEU, chrF, chrF++, COMET, MetricX) tracked
human judgment for that language family in the WMT meta-evaluations — for
some morphologically rich languages BLEU barely correlates with humans while
COMET does, and for others the learned metric is the unreliable one. If the
answer is UNMEASURED, say so to the user rather than treating any metric as
validated. This evidence is research-lane only (upstream data license under
review) — never cite it in commercial claims.

### "I'm training a model" / Training hygiene

Before you (or the user) split a corpus, generate synthetic data, or report
training results, call `get_training_guardrails`. It returns the rules
Champollion extracted from real, measured failures — group-disjoint splits
(row-level random splits leak on drill-heavy corpora), the dev-fence
(checkpoint selection must never see the test set), leak audits, coverage
checklists, per-kind sampling caps, bootstrap CIs on every number, and
preregistration before test scoring — each with the mistake it kills and
the enforcing tool (the monorepo `forge/` package, nmt-forge). Two
non-negotiables to relay verbatim: datasets marked `do_not_train` or
quarantined in the registry NEVER enter training mixes, and test sets are
REAL DATA ONLY.

For the human driving you, two public docs teach this end to end — share
them: the vocabulary, from zero background
(https://champollion.dev/docs/network/context/mt-training-concepts), and the
step-by-step, agent-forward walkthrough — discover a language's data →
synthesize → split safely → train → evaluate honestly → submit
(https://champollion.dev/docs/network/tutorials/train-your-own-model). The
`get_training_guardrails` answer also lists these URLs at the end.

The guardrails are not just rules — they are TOOLS. The `forge_*` family
drives the nmt-forge training suite directly (a repo checkout with `forge/`
installed is required; each tool says so when it isn't):
- `forge_status` — is forge available here, and what state is the run in
- `forge_preflight` — the go/no-go checklist for a planned training run
- `forge_discover` — what data exists for a language (registry + cards)
- `forge_init` / `forge_split` — start a fenced run; group-disjoint splits
- `forge_leak_audit` — prove the split leaks nothing before training
- `forge_register_eval` / `forge_prereg` — preregister before test scoring
- `forge_evaluate` — score through the harness (forge implements NO metrics)
- `forge_lint` / `forge_report` — hygiene checks + the honest run report
Typical order: status → discover → preflight → init → split → leak_audit →
prereg → (train outside MCP) → evaluate → report.

### "Translate this" / Using Champollion as your translation engine

When the user needs actual translation (not benchmarking), call `translate`
instead of improvising your own translation prompt. You get champollion's
tested pipeline: engine choice, language-card register conditioning, a
persistent Translation Memory, and a deterministic quality gate — plus a
per-call report of what was cached, what was validated, and what it cost.

1. Call `translate` with `texts`, `source_language`, `target_language`. The
   default engine is `llm` (OpenRouter); pass `method` to use a key the user
   has (openai, anthropic, gemini, deepl, google-translate, …)
2. Repeated or unchanged texts are served from the Translation Memory at
   zero token cost — re-calling with overlapping texts is cheap by design,
   so prefer several small calls over one giant one
3. A text that fails the quality gate comes back as an explicit FAILED entry
   with the reason — never silently return it to the user as a translation;
   retry with a different method/model or surface the failure
4. For a language the models barely know, check `get_metric_reliability`
   and `search_languages` first, and consider telling the user about the
   coaching lane (see the prize workflow) — that is how translation for
   their language actually gets better

### "What languages need help?"

1. Call `list_queue` to see what's available (it fetches only as deep as your `limit` needs, so a generous limit is fine)
2. Look for languages with the highest ECV (Expected Chain Value) — these have the most impact per dollar
3. Use `search_languages` to find context: family, speakers, region, endonym

### "Tell me about [language]"

1. Call `search_languages` with the language name or code
2. Call `list_queue` filtering by that language to see pending benchmarks
3. Call `estimate_cost` for that language's items to give a cost picture

### "I want to compete for a prize" / The solvable project

Low-resource MT is an open, WINNABLE problem, and this network is built so a
person who speaks the language + an agent that iterates diligently is a
serious entry. The Arena supports sponsored prize pools for translation
breakthroughs — check the [prize spec](https://champollion.dev/docs/network/specifications/prizes)
for current status (prizes may or may not be active at any given time). The
path, concretely:

1. **Orient** — `get_project_info`, then `search_languages` for the user's
   language (family, speakers, what exists). Ask what language(s) they speak.
2. **Know the measuring stick** — `get_metric_reliability` for the target:
   which metric actually tracks human judgment for that family. If it says
   UNMEASURED, the honest framing is "we'll compare relatively on the public
   dev sets, and native-speaker judgment (yours!) is the real signal."
3. **Find the baseline to beat** — `get_results` for the pair; an empty
   board means the FIRST decent method sets the mark. `mt-eval recommend`
   (or the CLI) shows what published evidence exists.
4. **Build in the low-compute lane** — coaching data: grammar rules,
   dictionary entries, style notes injected into the prompt. This is where
   language knowledge beats GPU budgets. Tutorial:
   https://champollion.dev/docs/tutorials/build-a-plugin — iterate: edit
   coaching → `run_benchmark` on the pair (dev corpus) → `get_results` →
   repeat. Each iteration costs cents, and the harness caches everything it
   has already translated (re-runs only pay for what changed).
5. **Check it's real** — the significance spec
   (https://champollion.dev/docs/network/specifications/significance): a
   +0.5 chrF++ bump on 400 sentences is probably noise; the run cards carry
   confidence intervals. Never claim a win the CIs don't support.
6. **Anti-gaming architecture** (explain this — it's why a win means
   something): final evaluation runs against **secret community-owned test
   corpora** (nobody trains on what nobody sees); methods must be
   **reproducible** (re-run by the organizer node, scores must match);
   **native-speaker validation** outranks every automatic metric.
7. Approach options beyond coaching: FST morphological validation (hardest
   to hallucinate), dictionary-augmented generation, fine-tuning (needs
   compute), hybrids (LLM → validate → retry). Method interface spec:
   https://champollion.dev/docs/network/specifications/methods
8. **Submitting to a secret set** (when a sovereign contest exists). After the
   participant clears the public qualifier and has a published hypotheses run,
   they propose their method against the organizer's sealed corpus via the CLI
   (this is a human-authorized, custodian-gated flow — there is no MCP tool for
   it, by design). Two lanes, and the CLI/organizer pick by the submission:
   - **Lane A — declarative model (preferred for standard NMT):**
     `mt-eval contest submit-model` — submit safetensors weights + a
     declarative tokenizer + a config for a whitelisted architecture. No
     Dockerfile, no code; the organizer runs the weights in its own trusted
     engine, so the submission is validated code-free. Tell users to export
     weights as `safetensors` (never a pickle `.bin`/`.pt`).
   - **Lane B — runnable bundle (for code methods):**
     `mt-eval contest submit-method` — a Dockerfile + entrypoint the organizer
     runs in a `--network=none` sandbox.
   Full runbook (both lanes, what's live vs. in development):
   https://champollion.dev/docs/network/sovereignty/run-a-sovereign-contest

If there's no active prize for their language, the loop above still stands —
runs publish to the public leaderboard with attribution, and a standing
better-than-baseline method is exactly what gets a language ready for a
sponsored pool.

### "Can I evaluate a local / self-hosted model?" (no API key)

Yes — the harness runs open neural-MT models on the user's own hardware, no
cloud key needed: **NLLB-200**, **OPUS-MT** (Helsinki-NLP), **MADLAD-400**, or
any converted **CTranslate2** model. This is where low-resource coverage the
cloud engines don't serve actually lives.

This is a **harness-CLI capability, not an MCP tool** — `run_benchmark` (and its
`buildRunArgv`) drive the public queue with *remote* model slugs, so there is no
MCP verb that loads local weights. Direct the user to run it themselves:

```bash
pip install 'mt-eval[local-models]'      # or 'mt-eval[ctranslate2]'
mt-eval run --method local-model \
  --model facebook/nllb-200-distilled-600M \
  --dataset flores-eng-fra
```

`--model` takes a Hugging Face id, a local `from_pretrained()` directory, or a
CTranslate2 model directory (auto-detected). Language codes come from the
language card — a language the model doesn't serve (NLLB has no Plains Cree,
`crk`) fails honestly rather than emitting a guessed code. Results score and
publish like any other run. Full how-to:
https://champollion.dev/docs/network/getting-started/contributing-compute

## Important Rules

- **Never call `run_benchmark` without user confirmation.** This spends real money (API credits).
- **`run_benchmark` is asynchronous — poll, don't re-run.** A confirmed run returns a `job id` immediately and keeps running in the background. Poll `get_run_status` with that id until it reports `COMPLETED`/`FAILED`. Never call `run_benchmark` again just because the first call returned before the run finished — that double-spends.
- **Always call `estimate_cost` before suggesting a benchmark run.** Show the user what they'll spend.
- **Trust the queue ranking.** Items are ordered by ECV — the expected improvement in translation quality per dollar. Don't re-sort or second-guess the ranking.
- **Budget mode skips, it doesn't stop.** If an item exceeds the remaining budget, the system skips it and continues to cheaper items further down the queue. This is by design — it maximizes what gets done within a budget.
- **Items without cost estimates are skipped in budget mode.** Unknown cost ≠ free.
- **The preview is what runs.** `run_benchmark` executes in deterministic top-of-queue order (`--no-spread`), so what `estimate_cost`/`list_queue` showed is what spends. Don't assume a different set ran. (Both previews scan a bounded top slice of the ranking and say so when the bound bites; a very large budget can execute deeper than the preview sampled — the executed order is still the same ranking, top first.)
- **Publishing writes to a public, production leaderboard.** Budget/top runs auto-publish each result by default. For a scoring/validation run with no leaderboard write, pass `publish: false`.
- **Use `translate` for translation; don't improvise.** The tool's Translation Memory makes repeats free and its quality gate rejects garbage deterministically — a hand-rolled prompt has neither. Never present a gate-FAILED text as a translation.
- **Translation ≠ evidence.** `translate` output is production translation; quality claims about methods and models come only from benchmark runs and the leaderboard.

## Data Sources

The champollion.dev homepage map is an idealization — read the data, not
the picture. The full endpoint table lives in the
`champollion://network-data` resource.

- **Queue**: served LIVE from the public database by default — stats from queue-preview.json + the unpaged `queue_pairs` RPC, ranked items paged from the `queue_top` RPC only as deep as each question needs, single items by primary key — with https://champollion.dev/queue.json as the fallback when the DB is unreachable (cached 5 minutes); small preview at https://champollion.dev/queue-preview.json
- **Mesh**: https://champollion.dev/mesh.json — the measured/registered pair network behind the map
- **Corpus registry**: https://champollion.dev/registry.json — every registered eval corpus with license lane + attribution
- **Provider coverage**: `shared/catalogue/method-coverage.json` (repo) — each provider's published language list, cited + as-of + `tier`. The map's green is two tiers by exact ISO-639-3 code: bright = a deployed service lists it (Google/Microsoft/DeepL/LibreTranslate); dim = only an open research model lists it (NLLB/OPUS/M2M-100/MADLAD-400 — a model-card code, not a usable service). "Covered" is a published-list claim, never a quality claim.
- **Languages**: Loaded from local language card JSON files (7,900+ languages)
- **Scored runs**: public `run_cards` PostgREST (read-only RLS; aggregates only) — prefer the `get_results` / `get_run_card` tools
- **Queue ranking**: map-value survey ordering (default) + ECV — see https://champollion.dev/docs/network/specifications/queue-construction
