---
sidebar_position: 2
title: "Eval Harness v2.0"
related:
  - label: "Scoring Specification"
    to: /docs/network/specifications/scoring
    kind: spec
    note: "What the harness metrics feed into"
  - label: "Statistical Significance Testing"
    to: /docs/network/specifications/significance
    kind: spec
  - label: "Method Interface"
    to: /docs/network/specifications/methods
    kind: spec
  - label: "Run Card Specification"
    to: /docs/network/specifications/run-card
    kind: spec
  - label: "Cookbook: Translate 30 Languages"
    to: https://champollion.dev/docs/tutorials/translate-30-languages
    kind: champollion
    note: "Use the harness to audit registers in production"
---

# Eval Harness v2.0

> **Buod para sa Ehekutibo.** Saklaw ng pahinang ito ang installation, configuration, at paggamit ng MT evaluation harness — ang tool na nagbe-benchmark ng mga paraan ng pagsasalin laban sa standardized corpora at gumagawa ng mga run card na may score. Para sa canonical na mga depinisyon ng metrics, schemas, at evaluation protocol, tingnan ang [Benchmark Specification](/docs/network/specifications/benchmark).

Nagpapatakbo ang harness ng mga eksperimento sa pagsasalin at gumagawa ng mga run card. Pinangangasiwaan nito ang prompt construction, API calls, scoring, at result serialization — kayo ang magbibigay ng dataset at model.

## Installation

**Mga requirement:** Python 3.10+

```bash
pip install mt-eval-harness
```

Ini-install nito ang `mt-eval` command.

## Paggamit

```bash
mt-eval run --corpus path/to/dataset.json
```

Pinatatakbo nito ang bawat entry sa corpus sa configured model (o method plugin), sinusuri ang score ng outputs, at nagsusulat ng run card JSON file sa output directory.

## CLI Flags

### `mt-eval run`

| Flag | Kinakailangan | Default | Paglalarawan |
|------|----------|---------|-------------|
| `--corpus` | ✅ | — | Path papunta sa corpus file (`.json`, `.jsonl`, `.tsv`) |
| `--source-file` / `--reference-file` | — | — | Parallel text files (FLORES+, WMT format) |
| `-m, --model` | — | `gemini-pro` | Model slug (maikling pangalan o buong OpenRouter ID). Nire-resolve sa pamamagitan ng `shared/model-aliases.json`. Pinaghihiwalay ng comma para sa multi-model runs |
| `-d, --dataset` | — | `all` | Dataset filter: `all`, pangalan ng segment, o ID range |
| `--ids` | — | — | Mga entry ID na susuriin, pinaghihiwalay ng comma |
| `--source-lang` | — | `English` | Pangalan ng source language |
| `--target-lang` | — | — | Pangalan ng target language |
| `-p, --prompt` | — | `naive` | Prompt version (`naive`, `custom`, `champollion`) |
| `--coaching-file` | — | — | Path papunta sa coaching prompt text file |
| `--coaching` | — | — | Inline coaching text (quoted string) |
| `--method` | — | — | Path papunta sa method plugin directory (naglalaman ng `method.json` + Python module) |
| `--method-card` | — | — | Path papunta sa method card JSON para sa leaderboard metadata |
| `--fst-retries` | — | `0` | Bilang ng FST retry attempts (default LLM method lamang) |
| `--skip-fst` | — | `false` | Laktawan nang buo ang FST quality gate |
| `--tools` | — | `false` | I-enable ang tool-calling mode |
| `--tools-list` | — | — | Mga pangalan ng tool na pinaghihiwalay ng comma |
| `--max-tool-rounds` | — | `8` | Maximum na tool-calling rounds bawat entry |
| `--hooks` | — | — | Mga pangalan ng post-translation hook |
| `--style-profile` | — | — | Path papunta sa isang style profile JSON. Ine-enable ang writing-style consistency metrics (pang-impormasyon — hindi kailanman bahagi ng composite score; tingnan ang [§ Writing-style at register metrics](#writing-style-and-register-metrics-informational)) |
| `-b, --batch-size` | — | `25` | Mga entry bawat API call |
| `-c, --concurrency` | — | `8` | Parallel API calls |
| `--max-tokens` | — | `32768` | Max tokens bawat API call |
| `--temperature` | — | `0.0` | Sampling temperature (0.0 = deterministic) |
| `--no-cache` | — | `false` | I-disable ang response caching |
| `--cache-dir` | — | `eval/cache/harness` | Path ng cache directory |
| `-o, --output-dir` | — | `eval/logs/harness` | Output directory para sa mga run card at log |
| `-n, --name` | — | — | Human-readable na pangalan ng run |
| `--dry-run` | — | `false` | I-validate ang configuration nang hindi gumagawa ng API calls |
| `--champollion-config` | — | — | Path papunta sa `champollion.config.json` |
| `--champollion-cards-dir` | — | — | Directory ng language cards |
| `--target-lang-code` | — | — | BCP-47 language code |

### Bawat subcommand

Ang lahat ng labingwalong top-level na subcommand, na binuo laban sa `mt_eval_harness/cli.py`
noong 2026-08-01. Hanggang sa panahong iyon, inilista ng seksyong ito ang pito sa mga ito, at ang anim —
kabilang ang `node`, ang sovereign organizer scoring node — ay hindi nakadokumento
**dito o sa gabay ng harness**.

**Patakbuhin at bigyan ng score**

| Subcommand | Ano ang ginagawa nito |
|---|---|
| `mt-eval run` | Magsagawa ng translation run (mga flag sa itaas) |
| `mt-eval test <log>` | Suriin ang isang nakumpletong run log |
| `mt-eval compare <logs…>` | Paghambingin ang maraming run log |
| `mt-eval dashboard <logs…>` | Bumuo ng isang interactive na HTML dashboard |
| `mt-eval card <run-card>` | Mag-pretty-print ng isang human-readable na run card |

**Hanapin ang inyong paraan patungo sa isang method**

| Subcommand | Ano ang ginagawa nito |
|---|---|
| `mt-eval recommend <src> <tgt>` | Gabay sa method para sa isang language pair — availability at **cited evidence**, hindi lamang isang simpleng ranking |
| `mt-eval corpora --source X --target Y` | Ilista ang mga eval corpora na available para sa isang pair |
| `mt-eval list models\|prompts\|datasets` | Ilista ang mga available na resource |

**Mag-ambag**

| Subcommand | Ano ang ginagawa nito |
|---|---|
| `mt-eval publish <report>` | Magsumite ng isang TestReport sa leaderboard |
| `mt-eval queue` | Patakbuhin ang pinakataas ng community compute queue gamit ang inyong sariling key — tingnan ang [Pag-ambag ng Compute](/docs/network/getting-started/contributing-compute) |
| `mt-eval export` | I-package ang isang TestReport bilang isang champollion method plugin |
| `mt-eval generate-plugin` | Alias para sa `export` |
| `mt-eval export-config` | Bumuo ng isang `champollion.config.json` snippet mula sa isang TestReport |

**Mga Contest, at pagpapatakbo nito nang kayo mismo**

| Subcommand | Ano ang ginagawa nito |
|---|---|
| `mt-eval contest` | Pamahalaan ang mga evaluation contest — `prepare`, `register`, `create`, `submit`, `submit-hypotheses`, `status`, `list` |
| `mt-eval shared-task` | Multi-pair shared-task edition umbrella: pinapangkat ng isang row ang N per-pair na mga contest ng isang AmericasNLP-style na edisyon at dinadala ang mga policy default nito. **Pagpapangkat at mga default lamang — nananatiling per-contest ang bawat gate** |
| `mt-eval node` | **Ang organizer scoring node.** Mag-poll ng intake, mag-gate sa public qualifier, mag-authorize ayon sa contest policy, magbigay ng score laban sa **mga organizer-held secret reference**, mag-publish ng mga score lamang. Ito ang command sa likod ng [Magpatakbo ng isang Sovereign Contest](/docs/network/sovereignty/run-a-sovereign-contest) at ng [Sovereign Eval Node](/docs/network/sovereignty/sovereign-eval-node) — hindi kailanman umaalis ang corpus sa makina ng organizer |

Ang `mt-eval node` ay may sariling labimpitong subcommand, kabilang ang airgap lane
(`import-bundle`, `export-scores`, `relay`, `egress-check`, `manifest`) at ang
M-of-N custody ceremony (`ceremony`, `seal`, `keygen`, `sign-manifest`,
`verify-manifest`, `ledger`). Patakbuhin po ang `mt-eval node --help`; ang mga sovereignty
mechanic ay inilalarawan sa dalawang pahina na naka-link sa itaas.

**Pag-setup**

| Subcommand | Ano ang ginagawa nito |
|---|---|
| `mt-eval setup` | I-install ang mga opsyonal na dependency (COMET neural metric, FST runtime) |
| `mt-eval logout` | Alisin ang mga nakaimbak na authentication credential |

### Mga Halimbawa

```bash
# Run with defaults (gemini-pro alias → google/gemini-3.1-pro-preview, naive prompt)
mt-eval run --corpus eval-amh-fra-globalvoices-test-v1

# Coached experiment with coaching file
mt-eval run \
  --corpus eval-amh-fra-globalvoices-test-v1 \
  --model google/gemini-3.1-pro \
  --coaching-file prompts/crk-coaching-v8.txt \
  --temperature 0.0

# Run a custom method plugin with FST retries
mt-eval run \
  --corpus eval-amh-fra-globalvoices-test-v1 \
  --method ./methods/fst-gated-pipeline \
  --fst-retries 3
```

---

## Run Card Schema

Bawat eksperimento ay gumagawa ng **run card** — isang self-contained na JSON document. Ang top-level structure:

```json
{
  "run_id": "uuid-v4",
  "harness_version": "2.0",
  "model_slug": "google/gemini-3.1-pro",
  "model_id": "gemini-3.1-pro-001",
  "condition": "baseline",
  "timestamp": "2026-06-01T03:22:41Z",
  "elapsed_seconds": 142.7,
  "dataset": { ... },
  "config": { ... },
  "method_card": { ... },
  "system_prompt_sha256": "abc123...",
  "system_prompt_used": "You are a translator...",
  "fingerprint": { ... },
  "scores": { ... },
  "totals": { ... },
  "environment": { ... },
  "results": [ ... ],
  "run_card_hash": "sha256-of-entire-card"
}
```

Tingnan ang [Run Card Specification](/docs/network/specifications/run-card) para sa buong schema na may dokumentasyon para sa bawat field.

:::info[Awtoritatibong Schema]
Ang [Espesipikasyon ng Benchmark](/docs/network/specifications/benchmark) ang nag-iisang pinagmumulan ng katotohanan para sa schema ng run card. Para sa mga kahulugan ng metric, composite weights, at quality tiers, tingnan ang [Espesipikasyon sa Scoring](/docs/network/specifications/scoring). Idinodokumento ng pahinang ito kung paano gamitin ang harness; ang mga spec ang tumutukoy kung ano ang ibig sabihin ng mga output.
:::

### Mahahalagang Block

**`dataset`** — Tinutukoy kung aling dataset ang ginamit, kabilang ang content hash nito upang maiugnay ang mga resulta sa isang partikular na version:

```json
// Example using textbook_dev.json — the 436-entry textbook dev split
{
  "id": "edtekla-dev-v1",
  "version": "1.0",
  "language_pair": "EN→CRK",
  "sha256": "...",
  "entry_count": 436
}
```

**`scores`** — Aggregate metrics para sa run:

```json
// Counts reflect the dataset used (here: textbook_dev.json, 436 entries)
{
  "total": 436,
  "exact_matches": 12,
  "exact_match_rate": 0.0968,
  "fst_accepted": 87,
  "fst_acceptance_rate": 0.7016,
  "chrf_plus_plus": 42.31,
  "errors": 0,
  "avg_latency_seconds": 1.15,
  "median_latency_seconds": 1.02,
  "p95_latency_seconds": 2.34,
  "by_difficulty": { ... },
  "by_provenance": { ... }
}
```

**`totals`** — Token usage at cost tracking:

```json
{
  "prompt_tokens": 48200,
  "completion_tokens": 3100,
  "reasoning_tokens": 0,
  "cached_tokens": 12000,
  "total_cost_usd": 0.42,
  "cost_per_entry_usd": 0.0034,
  "reasoning_ratio": 0.0
}
```

---

## Writing-style at register metrics (pang-impormasyon) {#writing-style-and-register-metrics-informational}

Maaaring suriin ng harness kung tumutugma ang mga translation sa target na **register** at **writing style**, sa pamamagitan ng `WritingStyleConsistency` metric plugin (`mt_eval_harness/plugins/writing_style.py`). Maaaring tama sa wika ang isang translation ngunit mali ang register — impormal na phrasing sa legal document, pormal na boilerplate sa marketing copy — at hindi ito mapapansin ng string metrics. Napapansin ito ng mga metric na ito.

**Ano ang sinusukat (bawat entry):**

| Metric | Scale | Kahulugan |
|--------|-------|---------|
| `style_register_match` | boolean | Tumutugma ba ang output sa inaasahang register? Nagmumula ang target sa `register` field ng corpus entry (tingnan ang [Benchmark Spec §2.6](/docs/network/specifications/benchmark)) o mula sa isang style profile |
| `style_sentence_length_ratio` | float | Predicted vs reference average sentence length (1.0 = tugma; divergence = style drift) |
| `style_formality_score` | 0.0–1.0 | Presensya ng formal/informal markers (T–V pronouns, contractions, …) gamit ang per-language marker resources |

**Aggregate:** `style_consistency_rate` — ang fraction ng entries na walang detected register mismatch.

I-enable ang custom target gamit ang `--style-profile path/to/profile.json` (hal. isang brand-voice profile); kung wala nito, babalik ang plugin sa `register` metadata ng bawat corpus entry kung naroon.

:::caution[Matapat na pagtatakda ng saklaw]
Ang mga metric na ito ay **para sa impormasyon lamang** — hindi kailanman bahagi ang mga ito ng composite score, at ang formality detection ay marker-based (isang heuristic), hindi isang natutunang paghatol. Mangyaring ituring ang mga ito bilang drift detector para sa pagsunod sa register, hindi bilang hatol sa kalidad ng estilo.
:::

---

## Fingerprint vs Run Card Hash {#fingerprint-vs-run-card-hash}

Gumagawa ang harness ng dalawang magkaibang hash. Magkaiba ang layunin ng mga ito:

### Fingerprint

Sinasagot ng **fingerprint** ang tanong na: *"Maaari bang ma-reproduce ang run na ito?"*

Iniha-hash nito ang kombinasyon ng inputs na tumutukoy sa experiment configuration — hindi ang outputs:

- Dataset SHA-256
- Model slug
- Condition label
- System prompt SHA-256
- Temperature
- Harness version

Dalawang run na may identical fingerprints ang gumamit ng parehong setup. Dapat maihambing ang kanilang mga resulta (modulo API non-determinism).

### Run Card Hash

Sinasagot ng **run card hash** ang tanong na: *"Napakialaman ba ang partikular na result file na ito?"*

Ito ang SHA-256 ng buong run card JSON (hindi kasama ang mismong `run_card_hash` field). Kung magbabago ang anumang field — score, timestamp, o kahit isang output — masisira ang hash.

:::info[Kailan gagamitin ang alin]
Gamitin ang **fingerprint** upang ipangkat ang magkakahambing na run (parehong experiment, magkakaibang execution). Gamitin ang **run card hash** upang beripikahin ang integridad ng isang partikular na result file.
:::

---

## Pag-publish sa Leaderboard

Pagkatapos makumpleto ang isang run, gamitin ang `mt-eval publish` upang isumite ang run card:

```bash
mt-eval publish eval/logs/harness/your-run-card.json
```

Kung walang `--method-card` na ibinigay habang tumatakbo ang run, maglulunsad ang `mt-eval publish` ng interactive wizard (`method_card_wizard.py`) na gagabay sa inyo sa paglalarawan ng inyong method (pangalan, class, mga tool na ginamit, atbp.). Ang output ng wizard ay ie-embed sa run card bago isumite.

### Manwal na inspeksiyon

Ang mga run card ay sine-save bilang mga JSON file sa output directory (`eval/logs/harness/` bilang default) — siyasatin ang mga ito doon bago i-publish. Ang `mt-eval publish` ang submission path; walang PR-based na pagtanggap ng run card.

:::note[Hindi pa live ang submission API at web upload]
Nakaplano ang isang `POST https://champollion.dev/api/leaderboard/submit` endpoint at Leaderboard upload UI ngunit **hindi pa naipapatupad**. Hangga’t hindi pa nailalabas ang mga ito, ang tanging gumaganang submission path ay `mt-eval publish`.
:::

:::warning[Pag-validate ng Leaderboard]
Vina-validate ng leaderboard ang mga isinumiteng run card laban sa dataset registry. Tinatanggihan ang mga submission na tumutukoy sa hindi kilalang datasets, o may sirang `run_card_hash`.
:::

:::danger[HUWAG MAG-TRAIN sa evaluation data]
Kung nakita na ng inyong method ang evaluation dataset habang nasa development — bilang training data, few-shot examples, dictionary entries, o prompt engineering material — ang inyong submission ay **madidisqualify**. Tingnan ang [MT Evaluation](/docs/network/leaderboard/rules) para malaman kung ano ang bumubuo sa mabuti kumpara sa masamang method.
:::

---

## Tingnan Din

- [MT Evaluation](/docs/network/leaderboard/rules) — overview, leaderboard value proposition, at gabay sa mabuti/masamang method
- [Evaluation Datasets](/docs/network/leaderboard/datasets) — dataset format, EDTeKLA, FLORES+
- [Run Card Specification](/docs/network/specifications/run-card) — ang buong JSON schema
- [Building a Method](/docs/network/specifications/methods) — ang method interface para sa paggawa ng evaluable methods
- [Method Leaderboard](https://champollion.dev/leaderboard) — live benchmark scores
- [Benchmark Specification](/docs/network/specifications/benchmark) — evaluation protocol, corpus format, run card schema
- [Scoring Specification](/docs/network/specifications/scoring) — SSOT para sa metrics, composite weights, at quality tiers
