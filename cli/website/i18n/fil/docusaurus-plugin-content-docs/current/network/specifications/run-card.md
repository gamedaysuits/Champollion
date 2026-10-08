---
sidebar_position: 4
title: "Espesipikasyon ng Run Card"
---

# Espesipikasyon ng Run Card

> **Executive Summary.** Ang run card ang atomikong yunit ng benchmarking — isang JSON document na nagtatala ng kumpletong configuration, mga resulta kada entry, at aggregate scores ng isang evaluation run. Idinodokumento ng pahinang ito ang schema, mga field, mekanismo ng fingerprinting, at istruktura ng score. Tingnan ang [Espesipikasyon ng Benchmark](/docs/network/specifications/benchmark) para sa mga kanonikal na depinisyon.

Ang run card ang kumpletong talaan ng isang evaluation run. Naglalaman ito ng lahat ng kinakailangan upang maunawaan, ma-reproduce, at ma-verify ang eksperimento: configuration, scores, indibiduwal na resulta, token usage, at environment metadata.

**Bersyon ng schema:** 2.0

:::info[Awtoritatibong Schema]
Ang [Benchmark Specification](/docs/network/specifications/benchmark) ang nag-iisang source of truth para sa schema ng run card. Para sa mga depinisyon ng metric at kung paano binibigyan ng iskor ang mga run (ang headline na chrF++, ang mga karaniwang metric sa tabi nito, ang mga diagnostic), tingnan ang [Scoring Specification](/docs/network/specifications/scoring). Isinasaad ng pahinang ito ang kasalukuyang pagpapatupad.
:::

---

## Mga Top-Level Field

| Field | Uri | Paglalarawan |
|-------|------|-------------|
| `run_id` | `string` | UUID v4 na nabuo sa simula ng run |
| `harness_version` | `string` | Semantic version ng harness na gumawa ng card na ito (hal., `2.0`) |
| `model_slug` | `string` | Slug ng model na ginamit para sa run (hal., `google/gemini-3.1-pro-preview`) |
| `model_id` | `string` | Nalutas na identifier ng model na ibinalik ng API (hal., `gemini-3.1-pro-001`) |
| `condition` | `string` | Label ng eksperimento: ang isinusulat ng harness ay `naive` (ang built-in nitong prompt), `coached` (pinalitan ito ng coaching file) o, para sa isang method plugin, ang method class nito; libreng teksto, kaya ang isang manu-manong ginawang card ay maaaring magsaad ng `coached-v3` o `few-shot`. Hindi isang label ng kalidad (ang mga quality tier ay inalis na; ang `scores.quality_tier` ay null sa bawat bagong card) |
| `timestamp` | `string` | ISO 8601 UTC timestamp kung kailan nagsimula ang run |
| `elapsed_seconds` | `number` | Tagal sa wall-clock ng buong run |

```json
{
  "run_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "harness_version": "2.0",
  "model_slug": "google/gemini-3.1-pro-preview",
  "model_id": "gemini-3.1-pro-001",
  "condition": "naive",
  "timestamp": "2026-06-01T03:22:41Z",
  "elapsed_seconds": 142.7
}
```

---

## `dataset`

Tinutukoy nito ang evaluation dataset at ini-pin ito sa isang partikular na content version sa pamamagitan ng SHA-256.

| Field | Uri | Paglalarawan |
|-------|------|-------------|
| `id` | `string` | Dataset identifier (hal., `edtekla-dev-v1`) |
| `version` | `string` | String ng bersyon ng dataset |
| `language_pair` | `string` | Display label (hal., `EN→CRK`) |
| `sha256` | `string` | SHA-256 hash ng nilalaman ng dataset file. Ginagarantiyahan nito ang eksaktong data na ginamit |
| `entry_count` | `number` | Bilang ng mga entry sa dataset |

```json
// Example using textbook_dev.json — the 436-entry textbook dev split
{
  "dataset": {
    "id": "edtekla-dev-v1",
    "version": "1.0",
    "language_pair": "EN→CRK",
    "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "entry_count": 436
  }
}
```

---

## `config`

Ang API at batching configuration na ginamit para sa run na ito.

| Field | Uri | Paglalarawan |
|-------|------|-------------|
| `api_provider` | `string` | Ang nagdala ng teksto: ang API provider para sa sariling LLM path ng harness (`openrouter`, `openai`, `anthropic`, `gemini`, `local`); ang engine id para sa isang MT engine (hal. `google-translate`); para sa isang method plugin, `local` kapag pinatunayan ng operator nito ang isang ganap na lokal na transport (`--attest-local-transport`), kung hindi ay `method-plugin` |
| `temperature` | `number` | Sampling temperature |
| `max_tokens` | `number` | Pinakamataas na bilang ng mga token bawat completion |
| `batch_size` | `number` | Mga entry bawat sabay-sabay na batch |
| `concurrency` | `number` | Pinakamataas na magkakasabay na kahilingan sa API |
| `coaching_file` | `string` | Path papunta sa coaching prompt file, kung ginamit (ang sariling tala ng run log; pinapangalanan ng isang nai-publish na card ang coaching ayon sa pangalan ng file, o `inline coaching` para sa `--coaching` na teksto — hinding-hindi isang lokal na path) |
| `method_path` | `string` | Path papunta sa direktoryo ng method plugin, kung ginamit |
| `fst_retries` | `number` | Bilang ng mga muling pagsubok ng FST |

```json
{
  "config": {
    "api_provider": "openrouter",
    "temperature": 0.0,
    "max_tokens": 32768,
    "batch_size": 25,
    "concurrency": 8
  }
}
```

:::info[Kasama sa mga Na-publish na Run Card ang `method_config`]
Kapag na-publish ang isang run card sa pamamagitan ng `mt-eval publish`, ini-inject ng `publish.py` ang isang `method_config` block na naglalaman ng canonical 8-field MethodConfig. Pinapagana nito ang zero-friction leaderboard install — maaaring i-reproduce ng sinuman ang method nang direkta mula sa na-publish na card.

```json
{
  "method_config": {
    "model": "google/gemini-3.1-pro-preview",
    "temperature": 0.0,
    "batchSize": 25,
    "register": "Formal Plains Cree. Use SRO orthography.",
    "coachingFile": "prompts/crk-coaching-v8.txt",
    "coachingPrompt": null,
    "promptContext": "champollion",
    "qualityTier": null
  }
}
```

Ang `qualityTier` ay palaging `null` sa isang bagong card: ang mga quality tier ay inalis na. Ginagamit ng lahat ng field ang **camelCase** at sumusunod sa canonical na schema ng MethodConfig (tingnan ang [Pagbuo ng Method](/docs/network/specifications/methods)).
:::

---

## `system_prompt_sha256` / `system_prompt_used`

| Field | Uri | Paglalarawan |
|-------|------|-------------|
| `system_prompt_sha256` | `string` | SHA-256 hash ng system prompt. Kasama sa fingerprint |
| `system_prompt_used` | `string` | Ang buong system prompt text na ipinadala sa model |

Bahagi ng [fingerprint](#fingerprint) ang prompt hash — magkakaroon ng magkaibang fingerprint ang dalawang run na may magkaibang prompt kahit magkatugma ang lahat ng iba pang setting.

---

## `fingerprint`

Isang reproducibility identifier. Gumamit ng parehong experimental setup ang dalawang run na may magkaparehong fingerprint.

| Field | Uri | Paglalarawan |
|-------|------|-------------|
| `hash` | `string` | SHA-256 hash ng mga nakaayos na component |
| `components` | `object` | Ang mga input value na na-hash |

### Mga Component ng Fingerprint

Ang canonical na listahan ay ang [Benchmark Specification §3.8](/docs/network/specifications/benchmark#38-fingerprint). Sa madaling salita:

| Bahagi | Paglalarawan |
|-----------|-------------|
| `dataset_sha256` | Hash ng dataset file |
| `model_slug` | Model na ginamit (para sa isang MT engine o isang method plugin, ang engine o method id) |
| `condition` | Label ng kondisyon ng eksperimento |
| `system_prompt_sha256` | Hash ng system prompt |
| `temperature` | Sampling temperature |
| `batch_size`, `tools_enabled` | Pag-batch at paggamit ng tool |
| `harness_version` | Bersyon ng harness |
| `api_provider`, `endpoint_host_sha256`, `max_tokens`, `method_version`, `method_sha256` | Bersyon 2 (harness 0.2.0 at mas bago): ang channel, ang endpoint host (naka-hash), ang limitasyon sa token, at ang bersyon at code hash ng method |
| `method_model`, `method_dependencies_sha256` | Bersyon 2, mga run lamang ng method plugin: ang model na ibinigay sa plugin (`-m`) at ang hash ng idineklara nitong `dependencies` |
| `method_model`, `method_model_sha256` | Bersyon 2, mga run lamang ng `--method local-model`: ang model na na-load (Hugging Face id o pangalan ng direktoryo) at ang content hash nito (isang direktoryo) o rebisyon (isang Hugging Face id) |

Isinasaad ng `fingerprint.version` kung saang listahan na-hash ang isang card.

### `engine_model`

Ang isang run ng MT engine na nagpapatakbo ng model na ibinigay rito (`--method local-model -m <model>`) ay naglalaman ng model na na-load:

| Field | Paglalarawan |
|-------|-------------|
| `given` | Ang sinabi ng `-m` |
| `kind` | `directory` o `hub` (isang Hugging Face id) |
| `id` | Ang Hugging Face id, o ang pangalan ng direktoryo (hinding-hindi ang lokal na path nito) |
| `sha256` | Direktoryo lamang: SHA-256 sa isang estilong-`sha256sum` na listahan ng mga file nito |
| `revision` | Hugging Face id lamang: ang rebisyong na-load |
| `family`, `backend` | `opus`, `nllb` o `madlad`; `transformers` o `ctranslate2` |
| `decode` | Kung gaano kahaba maaaring maging ang mga output: ang habang idineklara ng model, o ang panuntunan ng harness (`max(64, 4 × source tokens)` na mga bagong token, nalimitahan sa mga posisyon ng decoder) |
| `pair_mismatch` | Naroroon lamang kapag ang isang OPUS-MT pair model para sa isa pang pares ay sadyang pinatakbo (`--allow-model-pair-mismatch`) |

Pinapangalanan ng `method_config.model` ang parehong model (`<id>@<revision>`, o `<directory name>@sha256:<hash>`). Ang isang run log ng `local-model` na walang naitalang model ay walang ipa-publish: sinasabi ng card ang `engine_model_unrecorded` at tinatanggihan ito ng `mt-eval publish`.

### `method_plugin`

Ang run ng method plugin (`--method <plugin dir>`) ay naglalaman din ng nagpapakilala sa plugin, ayon sa naitala ng runner:

| Field | Paglalarawan |
|-------|-------------|
| `version` | Ang bersyong idineklara ng `method.json` (`null` kapag wala itong idineklara) |
| `code_sha256` | SHA-256 sa mga file ng plugin (`method.json` at ang mga `.py` file nito, isang estilong-`sha256sum` na manifest) |
| `model_given` | Ang model na ibinigay sa plugin gamit ang `-m/--model`, o `null` |
| `models_called`, `models_basis` | Ang (mga) model na iniulat ng plugin na tinawag, at kung iyon ba ay naobserbahan sa mga resulta nito o idineklara |
| `dependency_class` | Ang dependency class na idineklara ng `method.json` |
| `dependencies` | Ang listahan ng `dependencies` na idineklara ng `method.json`, nang wala ang libreng tekstong `notes` |
| `dependencies_sha256` | SHA-256 ng buong idineklarang listahan (ang fingerprint component) |

```json
{
  "fingerprint": {
    "hash": "7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069",
    "components": {
      "dataset_sha256": "e3b0c44298fc1c14...",
      "model_slug": "google/gemini-3.1-pro-preview",
      "condition": "naive",
      "system_prompt_sha256": "abc123...",
      "temperature": 0.0,
      "harness_version": "2.0"
    }
  }
}
```

:::info[Fingerprint ≠ Run Card Hash]
Tinutukoy ng fingerprint ang *configuration ng eksperimento*. Vine-verify ng `run_card_hash` ang *integridad ng result file*. Tingnan ang [Fingerprint vs Run Card Hash](/docs/network/specifications/harness#fingerprint-vs-run-card-hash) para sa mga detalye.
:::

---

## `scores`

Aggregate metrics para sa buong run.

### Mga Top-Level Score

| Field | Uri | Paglalarawan |
|-------|------|-------------|
| `total` | `number` | Kabuuang mga entry na sinuri |
| `exact_matches` | `number` | Mga entry kung saan ang output ay eksaktong tumugma sa gold standard |
| `exact_match_rate` | `number` | `exact_matches / total` (0.0–1.0) |
| `fst_accepted` | `number` | Mga **salita** ng output na tinanggap ng FST analyzer, pinagsama-sama sa lahat ng entry (hindi bilang ng mga entry). `null` kung walang ginamit na FST analyzer |
| `fst_acceptance_rate` | `number` | Mean ng mga per-entry acceptance rate (mga tinanggap na salita ng bawat entry ÷ mga salita nito; ang walang lamang output ay binibilang bilang 0), 0.0–1.0. Ito ay **hindi** `fst_accepted` ÷ lahat ng salita — ang pinagsamang rate ng salita na iyon ay ang `corpus_validity_rate` ng ulat, na ipinapakita sa run card bilang "Words accepted". `null` kung walang ginamit na FST analyzer |
| `chrf_plus_plus` | `number` | **Ang headline at ranking metric:** chrF++ sa antas ng corpus (sacreBLEU chrF, `word_order=2`), 0–100. Ang 95% bootstrap CI nito ay `confidence_intervals.corpus_chrf` at ang lagda nito ay `sacrebleu_signatures.chrf` |
| `scoring_standard` | `string` | `"standard/1"` sa bawat bagong card. Ang card na wala nito ay binigyan ng iskor sa ilalim ng composite na inalis na (`legacy-composite`) at bineberipika sa ganoong paraan |
| `primary_metric` | `string` | `"chrf_plus_plus"` |
| `spbleu`, `ter` | `number` | Karaniwang mga metric na ipinapakita sa tabi ng chrF++, hindi kailanman pinagsasama (ang BLEU ang pinakamataas na antas na `corpus_bleu` ng card; ang COMET ay `comet_score` na may `comet_model`, kapag kinakalkula) |
| `sacrebleu_signatures` | `object` | Ang sacreBLEU signature ng bawat kinakalkulang sacreBLEU metric: `chrf` (ang headline), `chrf_plain`, `bleu`, `spbleu`, `ter` |
| `confidence_intervals` | `object` | 95% bootstrap intervals; ang `corpus_chrf` ay para sa headline |
| `composite`, `quality_tier`, `cost_adjusted` | `null` | **Inalis na.** Palaging `null` sa isang bagong card. Pinapanatili ng isang legacy card ang mga naka-store na value nito; ang surface na nagpapakita pa rin ng composite nito ay may label na "legacy composite (retired)" |
| `errors` | `number` | Mga entry na nabigo (error sa API, timeout, atbp.) |
| `avg_latency_seconds` | `number` | Mean response time sa lahat ng entry |
| `median_latency_seconds` | `number` | Median response time |
| `p95_latency_seconds` | `number` | Ika-95 percentile na response time |

### `by_difficulty`

Mga iskor na hinati-hati ayon sa difficulty tier, naka-key ayon sa tier (`"1"`–`"5"`, `"0"` para sa walang rating). Ang mga field ay **hindi** ang mga nasa pinakamataas na antas: ang `avg_chrf` at `avg_bleu` ang **mean ng bawat pangungusap** para sa chrF++ at BLEU sa mga entry ng tier, habang ang pinakamataas na antas na `chrf_plus_plus` at BLEU ay nasa **antas ng corpus** (kinakalkula sa lahat ng segment nang sabay-sabay). Magkaibang estadistika ang dalawa: ang corpus BLEU sa partikular ay karaniwang mas mababa kaysa sa mean ng sentence BLEU, kaya ang headline na 0.5 sa tabi ng 10.2 na halaga ng tier ay hindi isang kontradiksyon. Paghambingin ang mga tier sa isa't isa, huwag kailanman sa headline.

```json
{
  "by_difficulty": {
    "1": {
      "name": "difficulty_1",
      "count": 20,
      "exact_match_count": 8,
      "miss_count": 12,
      "error_count": 0,
      "avg_chrf": 68.2,
      "avg_bleu": 31.5,
      "avg_latency_s": 0.84,
      "total_cost_usd": 0.0021,
      "plugin_aggregates": {}
    },
    "2": { ... },
    "3": { ... },
    "4": { ... },
    "5": { ... }
  }
}
```

### `by_provenance`

Mga score na hinati ayon sa entry provenance. Ang bawat key (hal., `gold_standard`, `textbook`) ay naglalaman ng parehong metric fields.

```json
{
  "by_provenance": {
    "gold_standard": {
      "total": 80,
      "exact_matches": 10,
      "exact_match_rate": 0.125,
      "chrf_plus_plus": 44.8
    },
    "textbook": { ... }
  }
}
```

---

## `score_caveats`

Naroroon lamang kapag may naglilimita sa kahulugan ng mga iskor. Maaaring makalkula nang tama ang isang iskor at hindi pa rin masusukat ang sinasabi ng label nito, kaya ang kwalipikasyon ay kasabay ng numero: inililimbag ito ng `mt-eval test`, `mt-eval card`, `mt-eval compare`, ng dashboard at ng preview ng `mt-eval publish` sa tabi ng headline, at iniimbak ito ng `publish` dito upang ipakita ng leaderboard.
Hindi nito binabago ang isang iskor kailanman: kinakalkula ang headline na chrF++ gaya ng dati, at sinasabi ng caveat kung ano ang naglilimita rito o sa isang diagnostic sa tabi nito.

| Field | Uri | Paglalarawan |
|-------|------|-------------|
| `kind` | `string` | `train_test_near_twin`, `length_inflation`, `length_deflation`, `source_copy` o `near_constant_output` |
| `source` | `string` | Kung sino ang sumukat nito: `nmt-forge` o `mt-eval-harness` |
| `severity` | `string` | `major` (basahin ang headline sa pamamagitan nito) o `minor` |
| `message` | `string` | Isang pangungusap, hindi hihigit sa 480 character |

**`train_test_near_twin`**, isinulat ng nmt-forge. Kapag binibigyan ng iskor ng `nmt-forge export` (o `evaluate`) ang isang model, sinusuri nito ang bawat test row para sa halos magkaparehong twin sa data ng pagsasanay (training data) at itinatala ang resulta sa mga mt-eval file na isinusulat nito.
Kinokopya ng harness ang pagbasang iyon sa card: `near_twin_rows` sa `n` na mga test row ay may twin (`near_twin_share`), at `strict_n` na mga row ang walang twin. Kapag may sapat sa mga iyon, ibinibigay ng `strict_corpus_chrf` at `strict_corpus_chrf_ci` ang chrF++ sa mga iyon lamang, na siyang generalization number.
Ang `recall_not_translation` ay `true` kapag hindi bababa sa kalahati ng mga row ay may twin.
Kung gayon, kahit ang chrF++ na 100 ay sumusukat kung gaano kahusay naaalala ng model ang mga parirala sa pagsasanay, hindi kung gaano ito kahusay magsalin. Kung hindi tumakbo ang pagsusuri ng forge, ang caveat ay `minor` at nagsasaad nito. Ang pagsusuring walang nakitang twin ay hindi nagdaragdag ng caveat.

**`length_inflation`**, sinukat ng harness. Idinaragdag ito kapag ang average ng mga output ay higit sa 2× ng haba ng kanilang reference (ang inflation bound ng [`length_ratio`](/docs/network/specifications/scoring)), o kapag hindi bababa sa sangkapat ng mga binigyan ng iskor na entry ang ganoon. Ang mga na-leak na few-shot example, tala o paulit-ulit na teksto ay nagpapalaki sa mga output, at sinusukat iyon ng mga iskor na nakabatay sa reference.
Ang mga field ay `mean_length_ratio`, `inflated_entries` ng `scored_entries`, `ratio_bound` at `share_bound`.

**`length_deflation`**, sinukat ng harness. Ito ang kabaligtaran ng `length_inflation`: mga output na higit na **mas maikli** kaysa sa kanilang mga reference, kaya may mga salitang naiwan. Idinaragdag ito kapag ang average ng mga output ay mas mababa sa 0.5× ng haba ng kanilang reference (ang truncation bound ng [`length_ratio`](/docs/network/specifications/scoring)), o kapag hindi bababa sa sangkapat ng mga binigyan ng iskor na entry ang ganoon. Hinahatulan lamang ng ilang diagnostic ang mga salitang nilalaman ng isang output: pagtanggap ng FST (FST acceptance) at code-switching. Pinalalaki ang mga ito ng isang sistemang nag-aalis ng hindi nito kayang isalin. Kapag naglalaman ang run ng isa sa mga ito, ang caveat ay `major` at nagsasabing huwag basahin ang mga ito bilang kalidad katabi ng mga run na nagsasalin ng lahat. Binibigyang-timbang ng headline na chrF++ ang recall, kaya binibilang nito ang mga nawawalang salita. Kung wala ang alinman sa dalawang metric (chrF++ at exact match lamang), ito ay isang tala na `minor`. Ang mga field ay `mean_length_ratio`, `short_entries` ng `scored_entries`, `ratio_bound`, `share_bound` at `emitted_only_metrics`.

**`source_copy`**, sinukat ng harness. Idinaragdag ito kapag hindi bababa sa kalahati ng mga binigyan ng iskor na output ay mga kopya ng kanilang source (hindi isinasaalang-alang ang case, mga accent, at bantas). Ang mga linyang ang reference ay ang source mismo, tulad ng mga pangalan, ay hindi isinasama. Ang mga metric na hindi naghahambing laban sa reference ay maaari pa ring magbigay ng kredito sa mga kinopyang salita. Ang mga field ay `copies` ng `considered_entries`, `copy_share` at `share_bound`.

**`near_constant_output`**, sinukat ng harness. Isang output ang ibinigay para sa maraming *magkakaibang* input. Pinaghahambing ang mga output at source nang hindi isinasaalang-alang ang case, bantas, at spacing; binibilang ang mga diacritic, dahil sa pagitan ng dalawang output ay pinag-iiba ng mga ito ang mga salita. Ang isang output ay cross-source repeat kapag hindi bababa sa 3 magkakaibang source ang nakatanggap nito (5 kapag ito ay isa o dalawang salita ang haba, dahil natural na umuulit ang maiikling sagot). Ang output na katumbas ng sarili nitong reference ay isang tamang sagot at hindi binibilang. Idinaragdag ang caveat kapag sumasaklaw ang mga pag-uulit sa hindi bababa sa sangkapat ng mga natatanging source, at hindi bababa sa 5 sa mga ito. Ito ay palaging `major`. Kapag naglalaman ang run ng metric na humahatol sa isang output nang wala ang reference nito (pagtanggap ng FST, code-switching), pinapangalanan ito ng mensahe: nagbibigay ng kredito ang gayong metric sa isang wastong pangungusap sa bawat oras na lumitaw ito. Ang mga field ay `repeated_sources` ng `considered_sources`, `repeat_share`, `repeated_outputs`, `top_output_sources` at `top_output_words` (ang pinakamadalas na naulit na output: gaano karaming source ang nakatanggap nito, at ang haba nito), `share_bound`, `min_repeats`, `min_sources`, `min_sources_short` at `emitted_only_metrics`.
Mga bilang lamang ang mga ito: hinding-hindi naglalaman ang caveat ng teksto ng output.

```json
"score_caveats": [
  {
    "kind": "train_test_near_twin",
    "source": "nmt-forge",
    "severity": "major",
    "checked": true,
    "recall_not_translation": true,
    "near_twin_rows": 150,
    "n": 150,
    "near_twin_share": 1.0,
    "strict_n": 0,
    "message": "all 150 test rows have a near-identical twin in the training data — there is no clean subset to score: this score measures recall of training phrases, not translation"
  }
]
```

Nasa loob ng naka-store na run card JSON ang field, kaya hindi nito kailangan ng column sa database. Hindi ito bahagi ng [fingerprint](#fingerprint): inilalarawan nito ang resulta, hindi ang eksperimento.

---

## `totals`

Token usage at cost tracking para sa buong run.

| Field | Uri | Paglalarawan |
|-------|------|-------------|
| `prompt_tokens` | `number` | Kabuuang input tokens sa lahat ng API call |
| `completion_tokens` | `number` | Kabuuang output tokens |
| `reasoning_tokens` | `number` | Mga token na ginamit para sa chain-of-thought reasoning (nakadepende sa model, 0 para sa karamihan ng mga model) |
| `cached_tokens` | `number` | Mga token na inihain mula sa prompt cache ng provider |
| `total_cost_usd` | `number` | Kabuuang gastos sa USD (ayon sa iniulat ng API) |
| `cost_per_entry_usd` | `number` | `total_cost_usd / entry_count` |
| `reasoning_ratio` | `number` | `reasoning_tokens / completion_tokens` (0.0–1.0) |

```json
{
  "totals": {
    "prompt_tokens": 48200,
    "completion_tokens": 3100,
    "reasoning_tokens": 0,
    "cached_tokens": 12000,
    "total_cost_usd": 0.42,
    "cost_per_entry_usd": 0.0034,
    "reasoning_ratio": 0.0
  }
}
```

---

## `environment`

Runtime environment metadata para sa reproducibility.

| Field | Uri | Paglalarawan |
|-------|------|-------------|
| `harness_version` | `string` | Bersyon ng harness (sumasalamin sa top-level `harness_version`) |
| `harness_git_commit` | `string` | Git commit SHA ng harness sa oras ng run |
| `python_version` | `string` | Bersyon ng Python interpreter |
| `sacrebleu_version` | `string` | Bersyon ng sacrebleu library (ginamit para sa chrF++ scoring) |
| `os` | `string` | Identifier ng operating system |

```json
{
  "environment": {
    "harness_version": "2.0",
    "harness_git_commit": "a1b2c3d",
    "python_version": "3.11.9",
    "sacrebleu_version": "2.4.0",
    "os": "macOS-14.5-arm64"
  }
}
```

---

## `results[]`

Ang array ng mga resulta kada entry. Isang object kada dataset entry, ayon sa pagkakasunod-sunod ng index.

| Field | Uri | Paglalarawan |
|-------|------|-------------|
| `entry_id` | `integer` | ID ng entry na ito sa corpus (tumutugma sa `entries[].id`) |
| `source` | `string` | Ang source text na isinalin |
| `reference` | `string` | Ang gold-standard reference mula sa corpus |
| `predicted` | `string` | Ang aktuwal na output ng method |
| `exact_match` | `boolean` | Kung ang `predicted` ay eksaktong tumutugma sa `reference` pagkatapos ng normalization |
| `entry_chrf` | `number` | Sentence-level chrF++ score para sa entry na ito (0–100) |
| `fst_accepted` | `boolean \| null` | Kung tinanggap ng FST analyzer ang output. `null` kung walang analyzer na na-configure |
| `fst_analysis` | `string[]` | Mga FST analysis string para sa output (empty array kung hindi na-analyze o tinanggihan) |
| `difficulty` | `integer` | Difficulty tier mula sa corpus (1–5) |
| `provenance` | `string` | Provenance tag mula sa corpus |
| `latency_seconds` | `number` | Response time para sa indibiduwal na entry na ito |
| `usage` | `object` | Token usage kada entry: `{ prompt_tokens, completion_tokens, reasoning_tokens }` |
| `error` | `string \| null` | Error message kung nabigo ang entry na ito. `null` kapag matagumpay |

```json
{
  "results": [
    {
      "entry_id": 1,
      "source": "Hello",
      "reference": "tânisi",
      "predicted": "tânisi",
      "exact_match": true,
      "entry_chrf": 100.0,
      "fst_accepted": true,
      "fst_analysis": ["tânisi+V+AI+Ind+2Sg"],
      "difficulty": 1,
      "provenance": "gold_standard",
      "latency_seconds": 0.82,
      "usage": {
        "prompt_tokens": 385,
        "completion_tokens": 12,
        "reasoning_tokens": 0
      },
      "error": null
    }
  ]
}
```

---

## `run_card_hash`

| Field | Uri | Paglalarawan |
|-------|------|-------------|
| `run_card_hash` | `string` | SHA-256 hash ng buong run card JSON, kung saan ang mismong field na `run_card_hash` ay nakatakda sa `""` habang nagha-hash |

Ito ang tamper-detection seal. Muling kinukuwenta ng leaderboard ang hash na ito sa submission at tinatanggihan ang mga card kung saan hindi ito tumutugma.

**Pagkuwenta ng hash:**

1. I-serialize ang run card sa JSON na may `run_card_hash` na nakatakda sa `""`
2. Kuwentahin ang SHA-256 ng serialized string
3. Itakda ang `run_card_hash` sa nagresultang hex digest

```python
import hashlib, json

card["run_card_hash"] = ""
card_json = json.dumps(card, sort_keys=True, ensure_ascii=False)
card["run_card_hash"] = hashlib.sha256(card_json.encode()).hexdigest()
```

:::info[Drill-Down Bawat Entry]
Pinupunan din ng mga na-publish na run card ang `run_card_entries` Supabase table, na nag-iimbak ng mga resulta bawat entry para sa drill-down analysis sa leaderboard. Awtomatikong pinupunan ang table na ito sa panahon ng `mt-eval publish`.
:::

---

## Tingnan Din

- [Ebalwasyon ng MT](/docs/network/leaderboard/rules) — pangkalahatang-ideya, halaga ng leaderboard, at gabay sa mabuti/masamang method
- [Eval Harness](/docs/network/specifications/harness) — kung paano magpatakbo ng mga ebalwasyon at bumuo ng mga run card
- [Mga Dataset ng Ebalwasyon](/docs/network/leaderboard/datasets) — format ng dataset, EDTeKLA, FLORES+
- [Pagbuo ng Method](/docs/network/specifications/methods) — ang interface ng method at spec ng method card
- [Leaderboard ng Method](https://champollion.dev/leaderboard) — mga live na benchmark score
- [Benchmark Specification](/docs/network/specifications/benchmark) — protocol ng ebalwasyon, format ng corpus, schema ng run card
- [Scoring Specification](/docs/network/specifications/scoring) — SSOT para sa mga metric at kung paano binibigyan ng iskor ang mga run
