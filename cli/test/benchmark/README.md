# champollion Translation Benchmark

Systematic evaluation of frontier LLMs as UI localization engines.

## Research Goal

Produce the first controlled, apples-to-apples comparison of 2026-generation frontier models on standardized translation quality — specifically through the lens of **UI localization** and champollion's **register-steered prompting**.

### Research Questions

1. **RQ1 — Frontier Landscape**: How do six frontier models compare on translation quality across 39 languages?
2. **RQ2 — Cost–Quality Tradeoff**: What's the Pareto-optimal model when plotting quality against API cost?
3. **RQ3 — Register Effect**: Does champollion's culturally-tuned register system produce measurably better translations than naive prompting?
4. **RQ4 — Script & Structural Integrity**: At what rate do models produce wrong-script or structurally broken output?
5. **RQ5 — UI Domain Specificity**: Do models perform differently on short imperative strings vs longer passages?

## Prior Art

This study builds on established work but fills specific gaps:

| Paper | Contribution | Gap We Fill |
|-------|-------------|-------------|
| Jiao et al. (2023) — *"Is ChatGPT A Good Translator?"* | GPT-3.5/4 on WMT test sets | We test 2026-gen models (GPT-5.5, Opus 4.7, etc.) |
| Robinson et al. (2023) — *"ChatGPT MT"* | 204 languages on FLORES-200 | We test UI localization domain + register effect |
| WMT25 Shared Task (Nov 2025) | Gemini 2.5 Pro won 14/15 pairs | Current frontier (GPT-5.5, Opus 4.7, etc.) untested |

## Dataset

**FLORES+** devtest split — 1,012 sentences per language.

- Source: [openlanguagedata/flores_plus](https://huggingface.co/datasets/openlanguagedata/flores_plus)
- License: CC BY-SA 4.0
- Split: `devtest` (full corpus, no subsampling)

### Language Coverage

39 natural languages matching champollion's registered languages:

| Script Family | Languages |
|--------------|-----------|
| Latin (22) | fr, es, de, it, pt, pt-PT, nl, no, sv, da, fi, pl, cs, sk, ro, hu, tr, id, ms, sw, vi, tl |
| CJK (3) | ja, zh, zh-TW |
| Cyrillic (3) | ru, uk, bg |
| RTL/Arabic (3) | ar, fa, ur |
| Hangul (1) | ko |
| Devanagari (2) | hi, bn |
| Greek (1) | el |
| Hebrew (1) | he |
| Thai (1) | th |
| Regional (2) | es-MX, fr-CA |

Constructed languages (Klingon, Elvish, Pirate, etc.) are out of scope — they require dictionary/grammar-based evaluation frameworks.

## Models Under Test

All accessed via [OpenRouter](https://openrouter.ai/) API:

| Model | Slug | Input $/1M | Output $/1M |
|-------|------|-----------|-------------|
| GPT-5.5 | `openai/gpt-5.5` | $5.00 | $30.00 |
| Claude Opus 4.7 | `anthropic/claude-opus-4.7` | $5.00 | $25.00 |
| Gemini 3.1 Pro Preview | `google/gemini-3.1-pro-preview` | $2.00 | $12.00 |
| DeepSeek V4 Pro | `deepseek/deepseek-v4-pro` | $0.435 | $0.87 |
| Mistral Large 3 | `mistralai/mistral-large-2512` | $0.50 | $1.50 |
| GPT-4o-mini (**control**) | `google/gemini-3.5-flash` | $0.15 | $0.60 |

GPT-4o-mini is the **control** — it's champollion's current recommended default.

## Experimental Design

Each model is tested under **two prompt conditions**:

| Condition | Description |
|-----------|-------------|
| **A: With registers** | Full champollion pipeline: register instructions, UI context hints, key-type annotations |
| **B: Naive baseline** | Minimal: "Translate the following English text to {language}. Return valid JSON." |

This isolates the register system's contribution to quality (RQ3).

## Metrics

| Metric | Type | Tool |
|--------|------|------|
| **chrF++** | Lexical (primary) | sacrebleu |
| **COMET** | Neural (primary) | unbabel-comet (`wmt22-comet-da`) |
| **Structural** | Deterministic | Custom JS (script validation, length ratio, placeholder integrity) |
| **Back-translation** | Semantic | Round-trip via GPT-4o-mini |

## Benchmark Tracks

This benchmark suite has three complementary tracks, each testing a different
aspect of translation quality:

| Track | Dataset | Strings | Languages | Measures |
|-------|---------|---------|-----------|----------|
| **FLORES+** | FLORES+ devtest (general domain) | 1,012 | 39 | Frontier model landscape, cost-quality Pareto |
| **ui-bench** | Signal Desktop (UI strings) | 2,665 | 6 | Register effect on UI localization |
| **content-bench** | Commercial web copy + open-source storefronts | ~1,550 | 6 | Register-steering effectiveness on consumer copy |

- **FLORES+** tests raw translation ability across 39 languages with academic references.
- **ui-bench** tests champollion's register prompts on real UI strings with ICU placeholders.
- **content-bench** tests whether register guidance improves consumer-facing web copy translation,
  with contamination-aware scoring that weights fresh 2026 web scrapes over memorizable open-source data.

See each track's `README.md` for detailed methodology.

## Directory Structure

```
test/benchmark/
├── README.md              ← you are here
├── run-benchmark.js       ← FLORES+ benchmark runner
├── fixtures/              ← FLORES+ reference translations (1,012 × 40 languages)
│   ├── flores-devtest.en.json
│   ├── flores-devtest.{lang}.json
│   └── flores-metadata.json
├── scripts/
│   └── extract_flores.py  ← FLORES+ dataset extraction tool
├── metrics/
│   └── score.py           ← sacrebleu + COMET wrapper
├── ui-bench/              ← UI string benchmark (Signal Desktop)
│   ├── README.md
│   ├── run-ui-bench.js
│   ├── source/en.json
│   └── reference/{lang}.json
├── content-bench/         ← Consumer web copy benchmark
│   ├── README.md
│   ├── scripts/           ← scraping + curation pipeline
│   ├── source/            ← V1 raw data (pre-curation)
│   ├── reference/         ← V1 raw refs (pre-curation)
│   └── dataset/           ← V2 curated corpus (post-curation, pending)
├── results/
│   ├── raw/               ← per-model per-language JSON scorecards
│   ├── analysis/          ← aggregated tables + visualizations
│   └── costs.json         ← per-request cost tracking
└── .venv/                 ← Python virtual environment (gitignored)
```

## Reproduction

```bash
# 1. Create venv and install dependencies
python3 -m venv test/benchmark/.venv
source test/benchmark/.venv/bin/activate
pip install datasets huggingface_hub sacrebleu unbabel-comet

# 2. Authenticate with HuggingFace (must accept FLORES+ terms first)
huggingface-cli login

# 3. Extract FLORES+ fixtures
python test/benchmark/scripts/extract_flores.py

# 4. Run benchmark (requires OPENROUTER_API_KEY)
# node test/benchmark/run-benchmark.js  (TBD)
```

## Budget

Estimated total: **~$92** for 6 models × 2 conditions × 39 languages × 1,012 sentences.

## Target Venue

**WMT26** (co-located with EMNLP 2026, Budapest) — paper deadline August 1, 2026.

## License

Benchmark code: MIT (same as champollion).
FLORES+ data: CC BY-SA 4.0 (per OLDI terms).
