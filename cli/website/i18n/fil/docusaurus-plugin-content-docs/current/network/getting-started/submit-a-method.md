---
sidebar_position: 1
title: "Magsumite ng Paraan"
related:
  - label: "Method Interface"
    to: /docs/network/specifications/methods
    kind: spec
    note: "The contract your method implements"
  - label: "Run Card Specification"
    to: /docs/network/specifications/run-card
    kind: spec
    note: "What every published run must disclose"
  - label: "MT Evaluation Rules"
    to: /docs/network/leaderboard/rules
    kind: doc
  - label: "Cookbook: Few-Shot Prompting"
    to: /docs/network/tutorials/few-shot-prompting
    kind: cookbook
    note: "The fastest first method to submit"
  - label: "Agent Guide: Building & Benchmarking on the Network"
    to: /docs/network/getting-started/agent-guide
    kind: guide
---

# Magsumite ng Method

> **Pangkalahatang Buod.** Isang step-by-step quickstart para sa pagsusumite ng inyong unang benchmark run sa leaderboard. I-install ang harness, patakbuhin ito laban sa isang dataset, suriin ang inyong run card, at i-publish. Tumatagal ng 10 minuto kung mayroon kayong API key.

Gagabayan kayo ng gabay na ito sa pagsusumite ng inyong unang benchmark run sa Network leaderboard.

---

## Mga Prerequisite

- **Python 3.11+**
- **Isang OpenRouter API key** (o katumbas nito para sa inyong model provider)
- **Isang paraan ng pagsasalin** — anumang gumagawa ng mga salin mula sa pinagmulang teksto

```bash
# Install the eval harness (provides the `mt-eval` command)
python3 -m pip install mt-eval-harness
```

---

## Hakbang 1: Patakbuhin ang Harness

Ini-score ng harness ang inyong method laban sa isang standardized dataset:

```bash
mt-eval run \
  --corpus eval-amh-fra-globalvoices-test-v1 \
  --model google/gemini-3.1-pro-preview \
  --name your-method-name \
  --temperature 0.2
```

| Flag | Ang Ginagawa Nito |
|---|---|
| `--corpus` | Path ng corpus file o nakarehistrong corpus id (`.json`, `.jsonl`, `.tsv`) |
| `--model` | Eksaktong slug ng modelo — ang buong OpenRouter id (hal. `google/gemini-3.1-pro-preview`); ang mga maiikling alias at floating id (`…-latest`) ay tatanggihan. Gamit ang `--method <plugin dir>`, ang modelong ipinasa sa inyong plugin bilang `config.method_model` (anumang pagpapangalan na ginagamit ng inyong plugin) |
| `-n, --name` | Nababasang label para sa inyong run (lumalabas sa leaderboard) |
| `--temperature` | Temperatura ng sampling (mas mababa = mas deterministic) |
| `--fst-retries` | Opsyonal: bilang ng mga pagtatangkang muling subukan ng FST |
| `--publish` | I-publish ang run card sa leaderboard kapag natapos na ang run |

Gumagawa ang harness ng **run card** — isang self-contained na JSON file na naglalaman ng inyong mga score, dataset hash, model slug, at cryptographic fingerprint na nag-uugnay sa mga resulta sa eksaktong configuration ng eksperimento.

---

## Hakbang 2: Suriin ang Inyong Run Card

Ang bawat run ay nagsusulat ng dalawang file sa `eval/logs/harness/`: ang run log na `<run-id>.json`
at ang na-score na ulat na `<run-id>_report.json`. Ang ulat ang inyong ipa-publish.
Suriin muna ito:

```bash
python -m json.tool eval/logs/harness/<run-id>_report.json | less
```

Mga pangunahing field sa `overall` block ng ulat:
- `corpus_chrf` — antas-corpus na chrF++ (0–100), ang pangunahin at pansukat
  sa pagraranggo. Ang 95% bootstrap CI nito ay `confidence_intervals.corpus_chrf` at ang
  sacreBLEU signature nito ay `sacrebleu_signatures.chrf`
- `scoring_standard` (`"standard/1"`) at `primary_metric`
  (`"chrf_plus_plus"`) — ang pamantayan kung saan na-score ang ulat
- `corpus_bleu`, `corpus_spbleu`, `corpus_ter` — ang iba pang karaniwang sukatan,
  ipinapakita sa tabi ng chrF++ at hindi kailanman inihahalo rito
- `exact_match_rate` — isang diagnostic: ang proporsyon ng mga perpektong salin
- `confidence_intervals` — mga bootstrap interval para sa mga sukatan sa itaas
- `total_cost_usd` — ang naging halaga ng run (`null` kapag walang nai-publish na
  presyo ang modelo, hal. isang lokal na modelo; hindi kailanman inuulat bilang $0)

Itinatala rin ng ulat kung ano ang ibinigay sa modelo, bilang isang pointer
(`instructions`: ang pangalan at SHA-256 ng coaching file, ang SHA-256 ng
system prompt, at kung nasaan ang buong teksto, ang run log sa inyong makina). Ang run
card na napupunta sa leaderboard ay binuo mula sa ulat na ito. Idinadagdag nito ang
method card at ang reproducibility fingerprint, at nangunguna gamit ang parehong
chrF++ at CI; ang `composite` at `quality_tier` nito ay `null`, dahil pareho nang
[hindi ginagamit](/docs/network/specifications/scoring#how-runs-are-scored). (Ang isang ulat
na isinulat bago ang pamantayan ay maaaring maglaman ng `published_composite`; ito ay isang lumang
composite, hindi na ginagamit, at hindi kailanman inihahambing sa chrF++.)
Inililimbag ng `mt-eval publish <report> --dry-run` ang card nang eksakto kung paano ito
ilalathala. Tingnan ang [Espesipikasyon ng Run Card](/docs/network/specifications/run-card)
para sa schema nito.

---

## Hakbang 3: Magsumite

Ang paglalathala ay nagsusulat sa **live** na leaderboard, kaya nangangailangan ito ng tahasang
`--prod` — kung wala ito ay tatanggi ang harness at ipaaalam ito sa inyo. I-preview muna:

```bash
# See exactly what would be uploaded (no sign-in, no network)
mt-eval publish eval/logs/harness/<run-id>_report.json --dry-run

# Publish (opens a browser sign-in the first time; add --anonymous to skip it)
mt-eval publish eval/logs/harness/<run-id>_report.json --prod
```

Upang direktang maglathala mula sa isang run, idagdag ang `--publish --prod` sa `mt-eval run`. Kung
mabigo ang hakbang sa paglalathala, nai-save pa rin ang mga score ng run at ipapakita ng harness ang
eksaktong command para sa muling pagsubok. Ang pagtatakda ng `MT_EVAL_ALLOW_PROD=1` sa environment ay ang
katumbas ng `--prod` para sa mga script.

:::note[Hindi pa live ang submission API at web upload]
Pinaplano ang isang `POST https://champollion.dev/api/leaderboard/submit` endpoint at isang
Leaderboard upload UI ngunit **hindi pa naipapatupad**. Hanggang sa mailabas ang mga ito,
ang tanging gumaganang paraan ng pagsusumite ay `mt-eval publish` (walang
pull-request intake).
:::

---

## Ano ang Susunod na Mangyayari

1. Ibina-validate ang inyong isinumite (hash ng dataset, integridad ng run card)
2. Lalabas ang mga resulta sa leaderboard bilang **Self-benchmarked** (trust tier 1)
3. Upang makuha ang katayuang **Champollion Verified**, isumite ang inyong pamamaraan bilang isang mai-install na plugin upang ma-reproduce ng mga maintainer ang inyong mga resulta
4. Para sa mga pamamaraan sa Katutubong wika: kung maabot ng inyong pamamaraan ang pinakamataas na puwesto, magsisimula ang proseso ng [paglilipat ng pagmamay-ari](/docs/network/sovereignty/ownership-transfer)

---

## Tingnan Din

- [Paggamit ng Harness](/docs/network/specifications/harness) — buong CLI reference
- [Mga Panuntunan ng Leaderboard](/docs/network/leaderboard/rules) — criteria sa pagsusumite at mga anti-gaming policy
- [Pagbuo ng Method](/docs/network/specifications/methods) — ang TranslationMethod protocol
- [Mga Dataset](/docs/network/leaderboard/datasets) — mga available na evaluation dataset
