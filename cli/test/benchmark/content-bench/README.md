# content-bench: Register-Steering Effectiveness Test

A benchmark dataset of consumer-facing web copy, designed to measure whether
champollion's **register-steered prompting** produces measurably better
translations than naive prompting.

## Research Question

> Does injecting per-language register instructions (vous-form, です/ます,
> gender-inclusive forms, etc.) into the translation prompt improve output
> quality — and if so, by how much and for which content types?

This is not an absolute MT quality benchmark. We measure the **delta**
between experimental conditions (naive vs register-steered) on the same
source text, using the same model. This isolates the register system's
contribution regardless of training-data contamination.

## Research Design Evolution

This dataset went through several design iterations:

1. **V1 (Original Plan)**: Scrape 100 commercial websites, align EN↔locale
   blocks by DOM position, score against human references. Failed quality
   audit — position-based alignment only produced 56.3% plausible pairs.
   See `quality_audit.md` for the full post-mortem.

2. **V2 (Current)**: Hybrid approach. Curate the surviving clean web-scraped
   pairs (low contamination risk) AND augment with key-aligned open-source
   locale files (deterministic alignment, higher contamination risk). Refocused
   from absolute quality measurement to register-steering effectiveness.

### Why Position-Based Alignment Failed

Commercial websites are **localized**, not **translated**. Apple France
shows different promos than Apple US at the same DOM position. McDonald's
Japan has news updates where McDonald's US has loyalty info. Without CMS-level
keys, there's no reliable way to map EN block #7 to FR block #7.

### Contamination Awareness

Open-source locale files (WooCommerce, Shopify, etc.) are on GitHub and likely
in every frontier model's training data. The model may have memorized
"Add to cart" → "Ajouter au panier". This makes absolute scoring unreliable,
but the **delta between conditions** remains valid because contamination
affects all conditions equally.

Web-scraped 2026 content is the least contaminated source (sites update
seasonally), so it receives 3× weight in aggregate scoring.

## Dataset Tracks

| Track | Source | Alignment | Contamination | Register |
|-------|--------|-----------|---------------|----------|
| `web-copy` | 2026 commercial site scrapes | Position-based, filtered | **Low** | Consumer marketing |
| `storefront` | WooCommerce + PrestaShop + Shopify Dawn | Key-based (PO/JSON) | High | E-commerce UI |
| `editorial` | GlobalVoices via OPUS | Sentence-aligned | High | Accessible journalism |

## Experimental Conditions

| # | Condition | Prompt | Purpose |
|---|-----------|--------|---------|
| 1 | `naive` | "Translate to {lang}. Return JSON." | Baseline |
| 2 | `register` | Full champollion prompt (register, UI rules, gender) | Feature under test |
| 3 | `wrong-register` | Register instructions for wrong domain | Negative control |

**Run order**: naive → register → wrong-register (third pass).

## Models Under Test

All 6 frontier models from the FLORES benchmark, accessed via OpenRouter:

| Model | Slug | Input $/1M | Output $/1M |
|-------|------|-----------|-------------|
| GPT-4o-mini (**control**) | `google/gemini-3.5-flash` | $0.15 | $0.60 |
| GPT-5.5 | `openai/gpt-5.5` | $5.00 | $30.00 |
| Claude Opus 4.7 | `anthropic/claude-opus-4.7` | $5.00 | $25.00 |
| Gemini 3.1 Pro | `google/gemini-3.1-pro-preview` | $2.00 | $12.00 |
| DeepSeek V4 Pro | `deepseek/deepseek-v4-pro` | $0.435 | $0.87 |
| Mistral Large 3 | `mistralai/mistral-large-2512` | $0.50 | $1.50 |

Pipeline validation uses GPT-4o-mini (cheapest). Full runs use all 6.

## Target Languages

Selected for maximum register differentiation:

| Lang | Key Register Feature |
|------|---------------------|
| `fr` | vous/tu distinction, gender-inclusive (Connecté·e) |
| `de` | Sie/du distinction, gender-inclusive (Benutzer:innen) |
| `ja` | です/ます vs plain form — most dramatic register split |
| `es` | usted/tú, Latin American neutral register |
| `ko` | 합쇼체 formality levels |
| `zh` | Conciseness norms, character density |

## Metrics

- **chrF++** (primary) — character n-gram F-score, robust for CJK
- **BLEU** (secondary) — word-level, Latin-script languages
- **Δ-score** — the actual measurement:
  - `Δ(register−naive)` > 0 → register guidance helps
  - `Δ(wrong−naive)` < 0 → register guidance is directional (can hurt)
- **Paired sign test** — statistical significance per language

### Contamination-Aware Weighting

| Track | Weight | Rationale |
|-------|--------|-----------|
| `web-copy` | 3.0 | Fresh 2026 scrapes, least likely memorized |
| `editorial` | 1.0 | OPUS data, likely in training |
| `storefront` | 1.0 | GitHub data, likely memorized |

## Directory Structure

```
content-bench/
├── README.md                    ← you are here
├── dataset/                     ← final curated corpus (post-curation)
│   ├── source.json              # EN strings with metadata
│   ├── reference/{lang}.json    # Human translations
│   └── metadata.json            # Per-entry track, source, type
├── config/
│   ├── sites.json               # 100-site web-copy registry
│   ├── scrape_report.json       # Raw scrape results
│   ├── sources.json             # Augmentation source configs
│   └── dedup_log.json           # Deduplication audit trail
├── raw/                         # Unfiltered scrape data (gitignored)
├── source/                      # V1 unfiltered EN (pre-curation)
├── reference/                   # V1 unfiltered refs (pre-curation)
├── scripts/
│   ├── scrape_sites.js          # Phase 1 web scraper
│   ├── assemble_dataset.js      # V1 assembler (superseded)
│   ├── curate_web_pairs.js      # V2 filter cascade
│   ├── extract_po.js            # PO/XLIFF parser
│   ├── extract_json_locales.js  # JSON locale extractor
│   ├── extract_globalvoices.js  # OPUS downloader
│   ├── deduplicate.js           # Fuzzy dedup engine
│   └── assemble_final.js        # V2 final assembly
├── run-content-bench.js         # Benchmark runner
├── metadata.json                # V1 stats (pre-curation)
└── results/                     # Benchmark outputs (gitignored)
```

## Current Status

**Phase**: Dataset curation (V2 pipeline not yet built).

V1 raw data is complete:
- 98 sites scraped, 282/496 locale pages fetched
- 1,108 EN source strings extracted
- Quality audit completed — 56.3% plausible pair rate
- Decision made to curate + augment (A+B strategy)

V2 scripts needed:
- `curate_web_pairs.js` — filter cascade for web-copy track
- `extract_po.js` — WooCommerce/PrestaShop PO parser
- `extract_json_locales.js` — Shopify Dawn locale extractor
- `extract_globalvoices.js` — OPUS corpus downloader
- `deduplicate.js` — fuzzy dedup across tracks
- `assemble_final.js` — quality-gated final assembly
- `run-content-bench.js` — benchmark runner (3 conditions)

## Quality Audit

See the full audit in the project artifacts. Summary:

| Category | Count | % |
|----------|-------|---|
| Plausible pairs | 1,944 | 56.3% |
| Noisy (CTA contamination, mega blocks) | 724 | 21.0% |
| Misaligned (different content at same position) | 433 | 12.5% |
| Identical (untranslated) | 350 | 10.1% |

## Provenance

- **Web scrapes**: May 2026, 98 commercial sites across 15 industries
- **WooCommerce**: translate.wordpress.org, community translations
- **PrestaShop**: github.com/PrestaShop/TranslationFiles, Crowdin-managed
- **Shopify Dawn**: github.com/Shopify/dawn, official locale files
- **GlobalVoices**: OPUS corpus (opus.nlpl.eu), sentence-aligned journalism
- **License**: Benchmark code is MIT. Source data licenses vary by origin.

## Citation

```
@dataset{champollion-content-bench,
  title={content-bench: Register-Steering Effectiveness Test for LLM Translation},
  author={Curtis Forbes},
  year={2026},
  url={https://github.com/gamedaysuits/champollion}
}
```
