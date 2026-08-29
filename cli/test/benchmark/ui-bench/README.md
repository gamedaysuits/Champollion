# champollion-bench: UI String Translation Benchmark

A benchmark dataset of **2,665 professionally-translated UI strings** extracted from [Signal Desktop](https://github.com/signalapp/Signal-Desktop), designed to evaluate whether register-steered LLM translation (as implemented in champollion) outperforms naive prompting for real-world UI localization.

## Why This Exists

We ran a [FLORES+](https://github.com/facebookresearch/flores) benchmark across 6 frontier LLMs and found **zero hallucinations and near-identical quality** — the data is contaminated training data. This dataset tests what actually matters: translating real UI strings with placeholders, formal registers, and concise label conventions.

## Dataset Structure

```
ui-bench/
├── source/en.json           # 2,665 English source strings
├── reference/               # Professional human translations
│   ├── fr.json              # French
│   ├── de.json              # German
│   ├── ja.json              # Japanese
│   ├── es.json              # Spanish
│   ├── ko.json              # Korean
│   └── zh.json              # Chinese (Simplified)
├── metadata.json            # Per-string annotations
├── run-ui-bench.js          # Benchmark runner
├── scripts/
│   ├── extract_ui_strings.js  # Dataset extraction script
│   └── score_ui_bench.py      # Evaluation pipeline
└── results/                 # Benchmark outputs (gitignored)
```

## Target Languages

Selected for maximum register differentiation:

| Lang | Why |
|------|-----|
| `fr` | vous/tu, gender-inclusive forms |
| `de` | Sie/du, Benutzer:innen gender-inclusive |
| `ja` | です/ます vs plain — most dramatic register split |
| `es` | usted/tú, regional variation |
| `ko` | 합쇼체 formality levels |
| `zh` | Conciseness norms, character density |

## Experimental Conditions

| Condition | Description |
|-----------|-------------|
| `naive` | "Translate to {lang}, return JSON." No instructions. |
| `register` | Full champollion prompt: register, rules, placeholder preservation |
| `domain` | Register + domain-specific context (messaging app instructions) |

## Metrics

- **chrF++** — Character n-gram F-score. Better than BLEU for short strings.
- **Placeholder preservation** — Did `{count}`, `{name}` survive untouched?
- **Untranslated rate** — Strings returned identical to source.
- **Instruction leakage** — Translation contains meta-text ("Here is the translation").
- **Length ratio by type** — Button translations concise? Descriptions natural?

## Running the Benchmark

```bash
# Extract dataset (already done)
node test/benchmark/ui-bench/scripts/extract_ui_strings.js

# Run benchmark (requires OPENROUTER_API_KEY)
node test/benchmark/ui-bench/run-ui-bench.js --models gpt-4o-mini --resume

# Score results (requires sacrebleu: pip install sacrebleu)
python3 test/benchmark/ui-bench/scripts/score_ui_bench.py
```

## Provenance

- **Source**: Signal Desktop `_locales/{lang}/messages.json`
- **License**: Signal Desktop is GPLv3 — translations are derivative works
- **Extraction date**: See `metadata.json` timestamp
- **Commit**: Latest `main` branch at extraction time

## Citation

If you use this dataset, please cite:

```
@dataset{champollion-bench,
  title={champollion-bench: UI String Translation Benchmark},
  author={Curtis Forbes},
  year={2026},
  url={https://github.com/gamedaysuits/champollion}
}
```
