# MT Eval Harness

> Most translation tools evaluate Google Translate and DeepL.
> This harness exists for the languages they leave unverified.

**MT Eval Harness** is an open-source evaluation framework for developing, benchmarking, and deploying novel machine translation methods — especially for low-resource languages where commercial tools either don't exist or claim coverage that hasn't been independently validated.

Anyone who speaks both languages can contribute a translation method. Prove it works, export it, deploy it. **Every method is welcome, human and machine** — we care about getting languages translated, not about which tool wins.

This harness is the proving ground inside **Champollion**: source-available,
singly stewarded infrastructure (this harness itself is open source) to create
and trust translation test sets for as many
language pairs as possible, and to make the whole field navigable — who can
translate what, how good each method is on each kind of text, and where the gaps
are. It stands on four pillars:

- **Solutions-biased pragmatism** — every method is welcome, human and machine; the goal is translated languages, not a winning tool.
- **Languages as biodata** — language data is treated like biodata: precious, personal, and not ours to take.
- **Sovereignty is non-negotiable** — built *with* professionals and communities, never scraped from them; community ownership and control of language data is a hard constraint, not a courtesy.
- **Two tiers of benchmark, the community in control** — *public benchmarks* on open data map and rank every method cheaply and openly; *sovereign benchmarks* are secret test sets that communities create, own, and control, and that we never see — the gold standard. The infrastructure is source-available and singly stewarded (this harness is open source); the test sets and the methods for a community's language belong to that community, which holds the keys and can revoke them.

### Data sovereignty

This project is built **with** professionals and communities, **never scraped from
them**. We treat language data as **biodata**: the people who provide a corpus hold
the keys to it — and to anything measured against it. Sovereignty is
non-negotiable, not a courtesy. Corpus content is fetched from source with metadata
cards only, never re-hosted by us; non-commercial and community-property datasets
stay out of any prize, API, or commercial path; and a community can revoke access on
its own timeline. The harness itself ships no community-owned data — it fetches the
relevant language-validation standard on demand (see
[champollion-LYSS](https://github.com/gamedaysuits/champollion-LYSS)).

Learn more about the wider network at
[champollion.dev/docs/network](https://champollion.dev/docs/network/).

---

## Why This Exists

There are ~7,000 living languages. Meta's OMT-1600 claims translation coverage for 1,600 of them — but for the ~1,200 in its long tail (our arithmetic: 1,600 minus the 400+ its authors report the models "understand sufficiently well"), quality is below usable thresholds and the model weights are not currently available. For the remaining ~5,400, translation technology doesn't exist at all. Independent evaluation infrastructure is the missing piece.

This harness provides the infrastructure to **crowdsource** that work:

1. **Develop** a translation method — an LLM prompt, a coached pipeline, a deterministic process, or any combination
2. **Benchmark** it against a reference corpus with standardized metrics (chrF++, exact match, code-switching detection, hallucination detection, terminology adherence, FST acceptance for morphologically-rich languages)
3. **Export** validated methods as [champollion](https://github.com/gamedaysuits/champollion) plugins
4. **Deploy** to production websites via champollion's translation CLI

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Develop   │───▶│  Benchmark  │───▶│   Export     │───▶│   Deploy    │
│  method.py  │    │ mt-eval run │    │ mt-eval      │    │ champollion│
│             │    │ mt-eval test│    │   export     │    │   translate │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
```

> [!IMPORTANT]
> **Scope.** This harness evaluates **formal written text translation** — documents, educational materials, UI strings, official communications. It is not a chatbot, real-time interpreter, or unrestricted-domain conversational system. The competitive leaderboard benchmarks translation methods against curated parallel corpora in specific text domains. See the [Benchmark Specification](https://champollion.dev/docs/network/specifications/benchmark) for corpus domains and the [Scoring Specification](https://champollion.dev/docs/network/specifications/scoring) for quality tier definitions.

## Quick Start

> **PyPI package name:** the harness installs as [`mt-eval`](https://pypi.org/project/mt-eval/) — not to be confused with the unrelated `mteval` package on PyPI.

```bash
# Install
pip install mt-eval-harness

# Set your API key (supports OpenRouter — any model)
export OPENROUTER_API_KEY=sk-or-...

# Or use a direct provider API key
export OPENAI_API_KEY=sk-...        # for --provider openai
export ANTHROPIC_API_KEY=sk-ant-... # for --provider anthropic
export GEMINI_API_KEY=AIza-...      # for --provider gemini

# ── Zero setup: no corpus files needed ───────────────────────────────
# The harness ships a dataset registry and downloads corpora on demand.

# 1. See what's available (hundreds of language pairs)
mt-eval list datasets

# 2. Run by dataset id — the corpus is fetched from its upstream source,
#    rebuilt + cached locally, and licence-gated (--yes accepts the terms).
#    A run scores and writes a report; publishing is a SEPARATE step. Add
#    --publish to score and publish in one command, or publish later with
#    `mt-eval publish <report>` (see QUICKSTART.md §5).
mt-eval run --corpus eval-amh-fra-globalvoices-test-v1 --model gemini-pro --yes
mt-eval run --corpus eval-amh-fra-globalvoices-test-v1 --model gemini-pro --yes --publish

# 3. Contribute compute on the highest-value pairs. `queue` reads the live
#    queue (champollion.dev/queue.json, ranked by expected chain value),
#    fetching each corpus automatically. Spend only what you choose:
mt-eval queue --budget 2.00        # run from the top until ~$2 of spend
mt-eval queue --top 5 --dry-run    # preview the 5 best open items

# ── Or bring your own corpus file ────────────────────────────────────
# Run a translation experiment with optimal defaults
# (batch_size=25, max_tokens=32768, concurrency=8, cache=on)
mt-eval run --corpus data/corpus.json --model gemini-pro

# Multi-model parallel run — all models execute simultaneously
mt-eval run --corpus data/corpus.json \
  -m gemini-pro,claude-opus-4.7,gpt-5.5,deepseek-v4-pro

# Direct provider (skip OpenRouter proxy)
mt-eval run --corpus data/corpus.json \
  --model openai/gpt-5.5 --provider openai

# Use a standard parallel text corpus (FLORES+, WMT, NTREX)
mt-eval run \
  --source-file flores200/dev/eng_Latn.dev \
  --reference-file flores200/dev/fra_Latn.dev \
  --target-lang French

# Create a contest — public or private
mt-eval contest create --name "EN→CRK Open" \
  --corpus edtekla-v1.json --language-pair "en>crk" \
  --visibility public

# Use your champollion.config.json for production-identical prompts
mt-eval run --corpus data/corpus.json \
  --champollion-config champollion.config.json \
  --target-lang-code fr

# Analyze the results
mt-eval test eval/logs/harness/run_*.json

# Generate a comparison dashboard
mt-eval dashboard eval/logs/harness/*_report.json
```

## Performance Defaults

> **The harness is "fast by default, safe by design."**
> Do NOT lower these values unless you have a specific reason.

All defaults are defined as `HARNESS_DEFAULTS` constants in [`config.py`](https://github.com/gamedaysuits/Champollion/blob/main/arena/mt_eval_harness/config.py). Change them in **one place** and they propagate everywhere.

| Setting | Default | Why |
|---|---|---|
| `batch_size` | **25** | Groups entries into numbered-list prompts. 25× fewer API calls. Proven reliable across all frontier models. Tool-calling auto-overrides to 1. |
| `max_tokens` | **32768** | Generous headroom eliminates truncation risk. Translation outputs are short (1-30 words), so unused tokens cost nothing. |
| `concurrency` | **8** | Parallel batch calls within a single model. Bounded by `asyncio.Semaphore` for rate limit safety. |
| `cache_enabled` | **True** | File-backed cache prevents redundant API calls. Keyed on model + prompt + temperature + language pair. Almost never a reason to disable. |
| `temperature` | **0.0** | Deterministic output for reproducibility. |

### Multi-Model Parallelism

For benchmarks, use `execute_multi_run()` — **not** a for-loop over `execute_run()`:

```python
from mt_eval_harness.runner import execute_multi_run
from mt_eval_harness.config import RunConfig

configs = [
    RunConfig(model="google/gemini-3.1-pro-preview", corpus_path="data.json", ...),
    RunConfig(model="anthropic/claude-opus-4.7", corpus_path="data.json", ...),
    RunConfig(model="openai/gpt-5.5", corpus_path="data.json", ...),
]

# All models run in parallel — wall-clock = slowest single model
results = await execute_multi_run(configs)
```

Each model gets its own aiohttp session and semaphore. A 14-model benchmark runs in **~15 minutes parallel** vs ~3.5 hours sequential.

## What Makes This Different

| Feature | MT Eval Harness | Other MT Eval Tools |
|---|---|---|
| **Language-agnostic** | Any pair, any script — metrics resolved per language card | Hardcoded for major languages |
| **Plugin architecture** | Bring your own methods, metrics, tools | Fixed evaluation pipeline |
| **Export to production** | Direct champollion plugin export | Evaluation only |
| **Crowdsource-ready** | Prove your method is better, share it | Researcher-only |
| **Model-agnostic** | Any OpenRouter model (100+), or direct OpenAI/Anthropic/Gemini | Single-vendor |
| **Fast by default** | batch=25, cache=on, parallel multi-model | Manual optimization |
| **COMET with bootstrap CIs** | Cached per-entry bootstrap — no redundant neural inference | CIs rarely computed |
| **AfriCOMET auto-selection** | Auto-selects `masakhane/africomet-mtl` for 35 African languages | One model fits all |
| **Per-difficulty-tier analysis** | Metrics + CIs per translation difficulty level (Tier 1–5) | Corpus-level only |
| **Contest infrastructure** | Public, private, or team contests with blind evaluation | No contest support |
| **Writing style benchmarking** | Custom style metrics + brand voice prompt tuning | Quality metrics only |

## Core Architecture

```
mt_eval_harness/
├── runner.py              # Orchestrator — strategy-based execution
├── corpus_loader.py       # Multi-format dataset loading (JSON/JSONL/TSV/parallel text)
├── champollion_config.py      # champollion config reader + prompt builder
├── pipeline.py            # Shared: cache, hooks, enrichment, logging
├── strategies/            # Execution backends
│   ├── single.py          # One entry per API call
│   ├── batch.py           # Multiple entries per call
│   ├── tool_call.py       # Multi-round tool-calling
│   └── method_strategy.py # Custom TranslationMethod plugins
├── providers/             # Multi-provider LLM abstraction
│   ├── base.py            # LLMProvider ABC — uniform interface
│   ├── registry.py        # get_provider() factory
│   ├── openrouter.py      # OpenRouter (default — proxies any model)
│   ├── openai_provider.py # Direct OpenAI API
│   ├── anthropic_provider.py  # Direct Anthropic Messages API
│   └── gemini_provider.py # Direct Google Gemini API
├── tester.py              # Offline metric computation
├── exporter.py            # champollion plugin packaging
├── api.py                 # OpenRouter HTTP client (used by openrouter provider)
├── cache.py               # Deterministic result caching
├── config.py              # Typed configuration + protocols
├── language_cards.py      # Language card loader + validation
├── cli.py                 # Command-line interface
├── dashboard.py           # Interactive HTML report generator
│   # NOTE: language-specific eval standards (e.g. the Plains Cree LYSS linter +
│   #  semantic validator) are NOT bundled here. They live in the separate
│   #  champollion-lyss package and are fetched on demand per the language card's
│   #  evalStandard — the core wheel ships no language-specific scorer code.
└── plugins/               # Extension protocols
    ├── prompts.py          # PromptProvider
    ├── champollion_prompts.py  # ChampollionPromptProvider (built-in champollion interop)
    ├── metrics.py          # MetricPlugin
    ├── hooks.py            # PostTranslationHook
    ├── tools.py            # ToolProvider
    ├── giellalt_fst.py     # GiellaLT FST morphological validity
    ├── code_switching.py   # Code-switching detection
    ├── hallucination.py    # Hallucination detection
    ├── terminology.py      # Terminology adherence
    ├── double_pass_compliance.py  # Language card compliance
    ├── writing_style.py    # Writing style consistency
    └── fst_installer.py    # FST binary installer
```

## Extending the Harness

The harness exposes four plugin protocols. If your class has the right method signatures, it works — no inheritance required.

`TranslationMethod` has **three required members** — a `name` attribute and a `method_card()` method alongside `translate` (the runner reads both for run IDs, logs, and provenance):

```python
from mt_eval_harness.config import TranslationMethod

class MyTranslationPipeline:
    """Custom pipeline — implements TranslationMethod protocol."""

    name = "My Translation Pipeline"  # required — run IDs and logs

    def method_card(self) -> dict | None:
        # required — provenance metadata (or None for no card)
        return {"method_id": "my-pipeline-v1", "name": self.name,
                "class": "pipeline"}

    async def translate(self, entries: list[dict], config) -> list[dict]:
        # Your translation logic here
        return [{"id": e["id"], "predicted": "..."} for e in entries]
```

See [GUIDE.md](https://github.com/gamedaysuits/Champollion/blob/main/arena/GUIDE.md) for full plugin documentation.

## Installation

```bash
# Install the harness (PyPI dist: mt-eval — not the unrelated `mteval` package)
pip install mt-eval-harness

# Interactive setup — installs optional deps with explanations
mt-eval setup

# Or install everything at once, no prompts
mt-eval setup --all

# Check what's installed
mt-eval setup --status
```

**Requirements:** Python 3.11+ · At least one API key:

| Provider | Env Var | Flag |
|----------|---------|------|
| OpenRouter (default) | `OPENROUTER_API_KEY` | `--provider openrouter` |
| OpenAI (direct) | `OPENAI_API_KEY` | `--provider openai` |
| Anthropic (direct) | `ANTHROPIC_API_KEY` | `--provider anthropic` |
| Gemini (direct) | `GEMINI_API_KEY` or `GOOGLE_API_KEY` | `--provider gemini` |

> **Ship lean, install on consent.** The harness core has minimal dependencies. Optional capabilities (COMET neural metric, FST morphological validation) install interactively via `mt-eval setup` — or on-the-fly when the harness detects they'd improve your eval. You never need to know specific pip commands.

<details>
<summary>Manual pip install (if you prefer)</summary>

```bash
pip install mt-eval-harness[comet]   # COMET neural metric + AfriCOMET
pip install mt-eval-harness[fst]     # FST morphological validation
pip install -e ".[dev]"              # Development
```
</details>

## Documentation

- **[GUIDE.md](https://github.com/gamedaysuits/Champollion/blob/main/arena/GUIDE.md)** — Full user guide and API reference
- **[CHANGELOG.md](https://github.com/gamedaysuits/Champollion/blob/main/arena/CHANGELOG.md)** — Versioned change log
- **[CONTRIBUTING.md](https://github.com/gamedaysuits/Champollion/blob/main/arena/CONTRIBUTING.md)** — Development standards and contribution workflow
- **[Plugin Specification](https://champollion.dev/docs/network/specifications/benchmark#9-champollion-plugin-export)** — champollion plugin export format (§9 of benchmark spec)
- **[Scoring Specification](https://champollion.dev/docs/network/specifications/scoring)** — SSOT for metrics, composite weights, quality tiers

## Contests & Leaderboards

The Arena supports structured evaluation contests — from open research bounties to private team benchmarks:

```bash
# Create a public contest with a prize
mt-eval contest create --name "EN→CRK Open" \
  --corpus edtekla-v1.json --language-pair "en>crk" \
  --visibility public

# Create a private contest for blind team evaluation
mt-eval contest create --name "Q3 DE Compliance" \
  --corpus de_compliance.json --language-pair "en>de" \
  --visibility private \
  --teams "berlin,vienna,zurich,munich"

# Submit a run to a contest (use the contest slug)
mt-eval contest submit --contest en-crk-open \
  --run eval/logs/run_fst-nmt-v3.json

# List active contests
mt-eval contest list
```

Visibility modes: `public` (anyone), `private` (invite-only, blind), `team` (org-scoped). See [GUIDE.md § 14](https://github.com/gamedaysuits/Champollion/blob/main/arena/GUIDE.md#14-contests--leaderboards) for full contest documentation.

## Currently In Development

We're actively using this harness to develop and evaluate Plains Cree (crk) translation methods — including our own FST-gated pipeline and external systems like Meta's OMT-1600 (which includes CRK at R1 tier). The harness provides independent evaluation with morphological validation that standard metrics cannot.

## License

AGPL-3.0-or-later (see `LICENSE`).

**Eval-Standard Plugin exception:** as an additional permission under AGPL-3.0 §7,
the Harness may be combined with separately-licensed *eval-standard plugins* (e.g.
`champollion-lyss`) that interoperate only through its public plugin interface
(the `champollion.eval_standards` entry point, the `MetricPlugin` protocol, the
language-card eval-metric loader, and the documented FST-installer helpers). Such
plugins may use licenses incompatible with the AGPL, including noncommercial ones —
the Harness itself stays AGPL. Full terms: [`LICENSE-EXCEPTION.md`](LICENSE-EXCEPTION.md).
