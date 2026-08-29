---
sidebar_position: 6
title: "Espesipikasyon ng Benchmark"
slug: '/network/specifications/benchmark'
related:
  - label: "Corpus Design Framework"
    to: /docs/network/specifications/corpus-design
    kind: spec
  - label: "Evaluation Datasets"
    to: /docs/network/leaderboard/datasets
    kind: doc
    note: "The corpora currently in play"
  - label: "Scoring Specification"
    to: /docs/network/specifications/scoring
    kind: spec
  - label: "Speaker Validation Protocol"
    to: /docs/network/specifications/speaker-validation
    kind: spec
---

# Espesipikasyon ng Benchmark

> **Buod ng Ehekutibo.** Tinutukoy ng dokumentong ito ang protocol ng pagsusuri para sa ecosystem ng pagsusuri ng Champollion MT: format ng corpus (§2), schema ng run card (§3), protocol ng benchmark (§6), mga kinakailangan sa balidasyon ng tao (§7), mga mekanismo ng soberanya (§8), leaderboard at modelo ng pagsusumite (§9), balangkas ng gastos (§10), at kakayahang mapalawak sa mga bagong wika (§11). Para sa mga kahulugan ng sukatan, mga timbang ng pinagsama-samang pagmamarka, mga threshold ng antas ng kalidad, at mga formula ng sukatan ng gastos/bilis, tingnan ang `SCORING_SPEC.md` — ang nag-iisang pinagmumulan ng katotohanan para sa lahat ng lohika ng pagmamarka. Ang dokumentong ito ay tumutukoy sa SCORING_SPEC para sa mga detalyeng iyon sa halip na kopyahin ang mga ito.


---

## 1. Mga Prinsipyo

### 1.1 Ang mga Wika ay Biodata

Ang isang wika ay hindi neutral na materyal sa pagsubok. Tulad ng genetic o health data, ang language data ay **biodata**: dala nito ang identidad, pagkakamag-anak, at mga relasyon ng mga taong nagsasalita nito, at hindi ito maaaring gawing anonymous sa makabuluhang paraan — alisin man ang metadata, naka-encode pa rin sa wika kung sino ang mga tao nito. Ang kahihinatnan para sa espesipikasyong ito ay kongkreto: ang mga taong nagbibigay ng corpus ang may hawak ng mga susi dito, at ng anumang sinusukat laban dito. Samakatuwid, ang sovereignty (§8) ay hindi dagdag lamang sa protocol; ito ay precondition nito, at ang bawat iba pang prinsipyo sa ibaba ay umiiral sa loob nito.

### 1.2 Ang Automated Metrics ay Mga Proxy

Bawat metric na tinukoy sa dokumentong ito ay machine-computed. chrF++, FST acceptance, morphological accuracy, semantic similarity — lahat ng ito ay automated proxies para sa kalidad ng pagsasalin. Kapaki-pakinabang ang mga ito para sa mabilis na iteration, sistematikong paghahambing, at pagtukoy ng regressions. **Hindi sila kapalit ng human judgment**.

Ang evaluation hierarchy:

```
Automated metrics (run cards, benchmarks)
    ↓ proxy for
Human review (bilingual speakers validate output)
    ↓ proxy for
Actual utility (does this help a language community?)
```

Walang automated score, gaano man kataas, ang maaaring pumalit sa isang fluent speaker na nagbabasa ng output at nagkukumpirmang ito ay tama, natural, at culturally appropriate. Ang mga quality tier na tinukoy sa §5 ay heuristic labels sa automated composite scores — kapaki-pakinabang para sa pagsubaybay ng progreso, ngunit kailanman ay hindi sapat nang mag-isa.

### 1.3 Mga Pamamaraan, Hindi Mga Model

Nagbe-benchmark tayo ng **mga pamamaraan**, hindi ng mga model. Ang model ay isang component. Ang pamamaraan ay ang buong recipe: pagpili ng model, disenyo ng prompt, paggamit ng tool, pre/post-processing, coaching data, retry strategies, lahat. Dalawang team na gumagamit ng parehong model ngunit magkaibang pamamaraan ay magkakaroon ng magkaibang score. Iyon ang punto.

### 1.4 Reproducibility

Bawat benchmark result ay dapat reproducible. Kinukuha ng run card (§3) ang kumpletong configuration ng isang experiment. Tinutukoy ng fingerprint (§3.5) ang experimental setup. Bine-verify ng run card hash (§3.6) ang integrity ng result. Sinumang may parehong method, corpus, at configuration ay dapat makamit ang scores sa loob ng ±2% (isinasaalang-alang ang LLM sampling non-determinism sa temperature > 0).

### 1.5 Walang Synthetic Evaluation Data

**Ang proyektong ito ay hindi bumubuo, gumagamit, o nag-eendorso ng synthetic evaluation data.** Lahat ng corpora ay dapat manggaling sa tunay na human-authored text — published translations, textbooks, bilingual documents, o elicited translations mula sa fluent speakers.

Maaaring tumulong ang LLMs sa:
- Sentence alignment (paghahanap ng parallel passages sa umiiral na bilingual texts)
- Format conversion (pag-convert ng published materials sa corpus schema)
- Metadata enrichment (pagmumungkahi ng difficulty tiers, register labels)
- Pagmumungkahi ng source sentences para sa human translation (§11.3 — ang translation step ay palaging human)

Hindi kailanman dapat **bumuo** ang LLMs ng reference translations o evaluation pairs.

**Development-neutral kami sa training data.** Kung ang isang method developer ay gumagamit ng synthetic training data, backtranslation, o data augmentation sa kanilang method, iyon ay kanilang pagpili — sinusuri namin ang output, hindi ang training process. Gumagamit ang Meta's OMT-1600 ng humigit-kumulang 270 milyong synthetic parallel sentences na binuo sa pamamagitan ng backtranslation. Wala kaming pagtutol sa mga method na sinanay sa ganitong paraan. Nagsusuri kami gamit lamang ang human curation.

> **Bakit hindi Bible text para sa evaluation?** Sinusuri ng OMT-1600 ang 1,560 sa 1,600 wika sa Bible-domain text (Meta AI, *Omnilingual MT*, arXiv:2603.16309, 2026). Ang mga salin ng Bible ay may archaic register, liturgical vocabulary, at formulaic sentence structure. Ang aming evaluation corpora ay nagmumula sa community-curated, domain-diverse text — health, legal, educational, governmental, conversational, at technical domains (tingnan ang §2.7). Ito ay sinadyang design choice. Kailangan ng mga community ang translation para sa mga domain kung saan sila aktwal na namumuhay at nagtatrabaho, hindi isang religious register lamang. Ang method na mataas ang score sa Genesis 1:1 ay halos walang sinasabi tungkol sa performance nito sa isang band council agenda o clinic intake form.

---

## 2. Corpus Schema

Ang corpus ay isang curated set ng parallel text pairs na may structured metadata. Ito ang ground truth kung saan sinusukat ang lahat ng method.

### 2.1 Dataset Envelope

Ang top-level structure ng isang corpus file:

```json
{
  "dataset": {
    "id": "edtekla-dev-v1",
    "version": "1.0",
    "language_pair": "EN→CRK",
    "source_language": "en",
    "target_language": "crk",
    "created": "2026-05-01",
    "license": "LicenseRef-EdTeKLA-Modified-CC-BY-NC-SA-4.0",
    "provenance": ["gold_standard", "textbook"]
  },
  "entries": [ ... ]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | ✅ | Natatanging dataset identifier, ginagamit sa run cards at leaderboard |
| `version` | string | ✅ | Semantic version. Ang incrementing ay nag-i-invalidate ng mga naunang run card comparisons |
| `language_pair` | string | ✅ | Display label (hal., `EN→CRK`) |
| `source_language` | string | ✅ | BCP 47 source language code |
| `target_language` | string | ✅ | BCP 47 target language code |
| `created` | string | ✅ | ISO 8601 creation date |
| `license` | string | ✅ | SPDX license identifier |
| `provenance` | string[] | ✅ | Listahan ng provenance tags na ginagamit sa mga entry |

### 2.2 Entry Schema

Bawat entry sa corpus ay kumakatawan sa isang translation challenge:

```json
{
  "id": 42,
  "source": "I see the dog",
  "reference": "niwâpamâw atim",
  "segment": "gold_standard",
  "difficulty": 2,
  "provenance": "gold_standard",
  "register": "conversational",
  "context": "declaration",
  "morphological_analysis": "ni-wâpam-âw atim | 1sg-see.TA-3sg.DIR dog.AN",
  "notes": "Animate noun (atim); direct form because speaker is proximate",
  "variant_class": "simple-ta-direct"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | integer | ✅ | Natatanging identifier sa loob ng corpus |
| `source` | string | ✅ | Source text sa source language |
| `reference` | string | ✅ | Gold-standard reference translation sa target language |
| `segment` | string | 📎 | Corpus partition: `gold_standard`, `held_out`, `development`, o `diagnostic` |
| `difficulty` | integer | 📎 | Difficulty rating 1–5 (tingnan ang §2.4) |
| `provenance` | string | 📎 | Pinagmulan ng entry na ito (tingnan ang §2.5) |
| `register` | string | 📎 | Antas ng register/formality (tingnan ang §2.6) |
| `context` | string | 📎 | Communicative function (tingnan ang §2.6) |
| `domain` | string | 📎 | Use-case domain mula sa 16-code taxonomy (tingnan ang §2.7). Dapat isa sa: `conv`, `ecommerce`, `edu`, `financial`, `gov`, `legal`, `literary`, `marketing`, `medical`, `news`, `religious`, `scientific`, `subtitles`, `support`, `tech`, `ui`. Validated sa construction time. |

> **📎 = RECOMMENDED.** Maayos na hinahandle ng harness ang nawawalang optional fields sa pamamagitan ng defaults. Kailangan lamang magbigay ng third-party corpora ng `id`, `source`, at `reference` sa bawat entry.
| `morphological_analysis` | string | ❌ | Gold-standard morphological breakdown |
| `notes` | string | ❌ | Translator notes, dialectal variants, ambiguity flags |
| `variant_class` | string | ❌ | Class label na naggugrupo ng katanggap-tanggap na translation variants |


### 2.3 Corpus Segments

Hinahati ang corpus sa mga segment na may magkakaibang access levels:

| Segment | Purpose | Access | Minimum Size |
|---------|---------|--------|-------------|
| `development` | Method development at iteration. Malayang ginagamit ito ng developers. | **Public** | 30 entries |
| `diagnostic` | Targeted tests para sa tiyak na linguistic phenomena. | **Public** | 10 entries |
| `gold_standard` | Official benchmark evaluation. Dito nagmumula ang leaderboard scores. | **Secret** — hawak ng governance org | 50 entries |
| `held_out` | Nakareserba para sa future evaluation. Hindi kailanman ginagamit hanggang ma-activate. | **Secret** — hawak ng governance org | 10 entries |

> **Current state:** Tanging ang `development` segment ang umiiral sa shipped datasets. Ang `diagnostic`, `gold_standard`, at `held_out` segments ay tinukoy para sa future use habang lumalaki ang corpora.

Ang `gold_standard` at `held_out` segments ay ganap na secret. Parehong hawak sa governance-controlled infrastructure ang source sentences at reference translations. Hindi kailanman nakikita ng method developers ang mga tanong o ang mga sagot. Tingnan ang §8 para sa sovereignty mechanism.

### 2.4 Difficulty Tiers

| Tier | Description | Examples |
|------|-------------|----------|
| 1 — Basic vocabulary | Mga solong salita, karaniwang pagbati, mga numero | "kumusta" → "tânisi", "aso" → "atim" |
| 2 — Simple sentences | Subject-verb o SVO, present tense | "Nakikita ko ang aso" → "niwâpamâw atim" |
| 3 — Moderate complexity | Past/future tense, possessives, animacy | "Nakita ko ang kanyang aso kahapon" |
| 4 — Complex morphology | Obviation, passive voice, conjunct order, relative clauses | "ang babaeng ang anak na lalaki ay pumunta sa tindahan" |
| 5 — Advanced | Multi-clause, formal register, ceremonial, idiomatic | Buong talata na may register-appropriate tone |

Ang maayos na binuong corpus ay dapat magsama ng entries sa lahat ng limang difficulty tiers, na mas nakatuon sa tiers 2–4 kung saan matatagpuan ang karamihan ng real-world translation challenges.

### 2.5 Provenance Tags

Bawat entry ay dapat magpahiwatig ng pinagmulan nito:

| Tag | Meaning |
|-----|---------|
| `gold_standard` | Na-verify ng fluent speakers |
| `textbook` | Mula sa published educational materials |
| `elicited` | Ginawa sa pamamagitan ng structured elicitation sessions |
| `corpus` | Kinuha mula sa parallel corpus |

> **Note:** Sa practice, ang provenance values ay free-form strings. Ang tags sa itaas ay conventions, hindi validated enum — maaaring gumamit ang datasets ng iba pang descriptive provenance strings.

### 2.6 Register at Context

Inilalarawan ng **Register** ang formality at social context:

| Register | Description |
|----------|-------------|
| `conversational` | Pang-araw-araw na pananalita sa pagitan ng magkakapantay |
| `formal` | Official o institutional language |
| `technical` | Domain-specific vocabulary |
| `ceremonial` | Traditional o sacred language use |
| `educational` | Language teaching materials |

Inilalarawan ng **Context** ang communicative function:

> 🔲 **Planned.** Ang `context` field ay tinukoy sa schema ngunit hindi pa populated sa kasalukuyang datasets. Nakareserba ito para sa future corpus enrichment.

| Context | Description |
|---------|-------------|
| `greeting` | Social greeting o pagpapaalam |
| `declaration` | Pahayag ng katotohanan |
| `question` | Interrogative |
| `instruction` | Utos o directive |
| `narrative` | Storytelling o paglalarawan |
| `label` | UI label, button text, o heading |
| `error` | Error message o warning |

### 2.7 Domain {#27-domain}

Inilalarawan ng **Domain** ang real-world use case — ang uri ng content na isinasalin. Orthogonal ito sa register at context:

- Sinasagot ng **Register**: *Gaano ito ka-formal?*
- Sinasagot ng **Context**: *Ano ang ginagawa ng sentence na ito?*
- Sinasagot ng **Domain**: *Para saang industry/use case ito?*

Ang legal contract (domain: `legal`) ay maaaring formal (register: `formal`) at maglaman ng declaration (context: `declaration`). Ang legal chatbot transcript (domain: `legal`) ay maaaring conversational (register: `conversational`) at maglaman ng mga tanong (context: `question`). Parehong domain, magkaibang register at context.

| Domain Code | Description | Typical Consumers |
|-------------|-------------|-------------------|
| `ui` | Software interface strings | App developers, localization teams |
| `legal` | Contracts, statutes, court filings, immigration documents | Law firms, courts, compliance teams, IP lawyers |
| `medical` | Clinical notes, drug labels, patient communications, trial protocols | Hospitals, pharma, clinical trials, patient portals |
| `financial` | Banking, insurance, regulatory filings, audit reports | Banks, insurers, regulators, auditors |
| `edu` | Textbooks, curricula, lesson plans, academic materials | Schools, universities, textbook publishers |
| `ecommerce` | Product descriptions, reviews, marketplace listings | Online retailers, marketplace sellers |
| `marketing` | Ad copy, brand messaging, campaigns, slogans | Ad agencies, brand teams |
| `gov` | Policy documents, regulations, public notices, legislation | Government agencies, compliance teams |
| `scientific` | Research papers, abstracts, methodology, grant proposals | Researchers, journals, grant agencies |
| `religious` | Scripture, liturgical texts, theological commentary | Faith communities, liturgical publishers |
| `support` | FAQs, error messages, troubleshooting guides, chatbot scripts | SaaS companies, help desks |
| `subtitles` | Film, TV, streaming, at gaming dialogue | Streaming platforms, studios, gaming companies |
| `news` | Journalism, wire reports, editorial, press releases | Media organizations, wire services |
| `literary` | Fiction, poetry, narrative, cultural texts | Publishers, cultural preservation orgs |
| `conv` | Informal conversation, social media, messaging | Consumer apps, social platforms |
| `tech` | API docs, manuals, engineering specifications, technical guides | Documentation teams, engineering orgs |

> **Domain-specific benchmarks.** Sinusuri ng general benchmark ang isang method sa lahat ng domain. Ngunit sinusuportahan din ng Network ang **domain-filtered benchmarks** — kung saan kinukuwenta ang scores sa entries lamang na naka-tag sa isang partikular na domain. Hinahayaan nitong masagot ng users: "Aling method ang pinakamahusay para sa pagsasalin ng legal documents sa French?" kumpara sa "Aling method ang may pinakamahusay na overall French score?"
>
> Pinahihintulutan ng domain-filtered leaderboard rankings ang users na ihambing ang methods sa loob ng iisang use case. Iba-iba ang performance ng methods sa iba't ibang domain — ang method na fine-tuned sa legal terminology ay maaaring magkaroon ng mas mataas na score sa legal text kaysa sa conversational text. Tinutulungan ng Network ang users na mahanap ang method na pinakaangkop sa kanilang partikular na use case.

> **Future: Network assistant.** Isang conversational assistant na tumutulong sa users na ilarawan ang kanilang MT use case (domain, language pair, quality requirements) at nagpapakita ng kaugnay na community-validated methods mula sa leaderboard — halimbawa, "aling method ang may pinakamataas na score sa medical-domain EN→JA benchmarks?" — ay isang navigability aid na isinasaalang-alang namin, na nakadepende sa sapat na domain-tagged evaluation data at method diversity.

---

## 3. Run Card Schema {#3-run-card-schema}

Ang run card ang atomic unit ng evaluation. Isa itong self-contained JSON document na nagtatala ng kumpletong configuration at results ng isang evaluation run: isang method, isang model, isang configuration, isang dataset.

Bawat run card ay kumukuha ng tatlong dimension:
- **Quality** — gaano kahusay ang translations?
- **Cost** — magkano ang gastos sa paggawa ng mga ito?
- **Speed** — gaano katagal ito inabot?

### 3.1 Top-Level Fields

| Field | Type | Description |
|-------|------|-------------|
| `run_id` | string | UUID v4 na binuo sa simula ng run |
| `harness_version` | string | Semantic version ng harness (hal., `2.0`) |
| `timestamp` | string | ISO 8601 UTC timestamp kung kailan nagsimula ang run |
| `elapsed_seconds` | number | Wall-clock duration ng buong run |

### 3.2 Method Configuration

Tinutukoy ng mga field na ito ang experimental setup — ano ang sinubok at paano.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `model_slug` | string | ✅ | Model identifier (hal., `google/gemini-2.5-flash`) |
| `model_id` | string | ❌ | Resolved model identifier na ibinalik ng API |
| `condition` | string | ✅ | Experiment label (hal., `baseline`, `coached-v3`, `few-shot`) |
| `temperature` | number | ✅ | Sampling temperature |
| `system_prompt_sha256` | string | ✅ | SHA-256 hash ng buong system prompt |
| `system_prompt_used` | string | ✅ | Ang buong system prompt text |
| `coaching_data_sha256` | string | ❌ | SHA-256 hash ng coaching data file, kung ginamit |
| `fst_version` | string | ❌ | Version ng FST analyzer, kung ginamit |
| `tools_enabled` | string[] | ❌ | Listahan ng tools na available sa method |
| `batch_size` | number | ❌ | Entries bawat concurrent API batch |
| `max_retries` | number | ❌ | Maximum retries para sa FST rejection, kung applicable |

:::info[Kasama sa mga Nai-publish na Run Card ang method_config]
Kapag nai-publish ang isang run card sa leaderboard (sa pamamagitan ng `mt-eval publish`), kasama rin dito ang isang `method_config` block na naglalaman ng canonical na 8-field MethodConfig (`model`, `temperature`, `batchSize`, `register`, `coachingFile`, `coachingPrompt`, `promptContext`, `qualityTier` — lahat ay camelCase). Pinapagana nito ang zero-reconstruction import: direktang binabasa ng `champollion leaderboard --install` ang `method_config` at isinusulat ito bilang plugin manifest. Itinatala ng mga telemetry field sa itaas (§3.2) kung ano ang naobserbahan ng harness; itinatala ng `method_config` kung ano ang nilayon ng developer.
:::

### 3.3 Dataset Reference

| Field | Type | Description |
|-------|------|-------------|
| `dataset.id` | string | Dataset identifier |
| `dataset.version` | string | Dataset version |
| `dataset.language_pair` | string | Display label |
| `dataset.sha256` | string | SHA-256 hash ng dataset file contents |
| `dataset.entry_count` | number | Bilang ng entries na na-evaluate |

Ini-pin ng dataset SHA-256 ang result sa isang partikular na version ng data. Kung magbabago ang dataset, hindi comparable ang mga lumang run card.

### 3.4 Scores (Quality)

Aggregate metrics para sa buong run. Lahat ng quality metrics ay **automated** — tingnan ang §1.2.

| Field | Type | Description |
|-------|------|-------------|
| `scores.total` | number | Kabuuang entries na na-evaluate |
| `scores.exact_matches` | number | Entries kung saan eksaktong tumugma ang output sa reference |
| `scores.exact_match_rate` | number | 0.0–1.0 |
| `scores.equivalent_matches` | number | Entries na tumutugma sa acceptable variant |
| `scores.equivalent_match_rate` | number | 0.0–1.0 |
| `scores.fst_accepted` | number | Entries na tinanggap ng FST analyzer |
| `scores.fst_acceptance_rate` | number | 0.0–1.0, `null` kung walang FST na configured |
| `scores.morphological_accuracy` | number | 0.0–1.0, FST-derived (lemma-matched), `null` kung walang FST / walang lemma-matched words. Advisory hanggang ma-activate — tingnan ang Scoring Spec §2.2 |
| `scores.morph_coverage` | number | 0.0–1.0, fraction ng analyzable predicted words na lemma-matched sa reference (ipinapakita kung gaano ka-sparse ang `morphological_accuracy`) |
| `scores.chrf_plus_plus` | number | Corpus-level chrF++ score (0–100) |
| `scores.semantic_score` | number | Embedding-based semantic similarity (0.0–1.0) |
| `scores.ter` | number | Translation Edit Rate (0–∞, mas mababa ay mas mabuti) |
| `scores.length_ratio` | number | avg(len(predicted)/len(reference)), ideal = 1.0 |
| `scores.code_switching_rate` | number | 0.0–1.0, fraction ng entries na may source-language leakage |
| `scores.hallucination_rate` | number | 0.0–1.0, fraction ng entries na may hallucinated content |
| `scores.terminology_adherence` | number | 0.0–1.0, adherence sa glossary terms (`null` kung walang glossary) |
| `scores.tokens_per_second` | number | total_tokens / elapsed_seconds |
| `scores.entries_per_minute` | number | entries na naisalin kada minuto |
| `scores.composite` | number | Weighted composite score (0.0–1.0). Tingnan ang SCORING_SPEC §4 |
| `scores.errors` | number | Entries na nabigo (API error, timeout, atbp.) |
| `scores.by_difficulty` | object | Scores na hinati ayon sa difficulty tier |
| `scores.by_provenance` | object | Scores na hinati ayon sa provenance tag |
| `scores.by_domain` | object | ✅ Implemented — Scores na hinati ayon sa domain (§2.7). Pinapagana ang domain-filtered leaderboard ranking. Kinukuwenta ng tester.py at ipinapasa sa publish.py. |

### 3.5 Totals (Cost)

| Field | Type | Description |
|-------|------|-------------|
| `totals.prompt_tokens` | number | Kabuuang input tokens sa lahat ng API calls |
| `totals.completion_tokens` | number | Kabuuang output tokens |
| `totals.reasoning_tokens` | number | Tokens na ginamit para sa chain-of-thought (0 para sa karamihan ng models) |
| `totals.cached_tokens` | number | Tokens na na-serve mula sa prompt cache ng provider |
| `totals.total_cost_usd` | number | Kabuuang gastos sa USD |
| `totals.cost_per_entry_usd` | number | `total_cost_usd / entry_count` |
| `totals.cost_per_source_char` | number | USD bawat source character — comparable sa iba't ibang wika |

### 3.6 Timing (Speed)

| Field | Type | Description |
|-------|------|-------------|
| `elapsed_seconds` | number | Wall-clock duration ng buong run (top-level) |
| `scores.avg_latency_seconds` | number | Mean response time bawat entry |
| `scores.median_latency_seconds` | number | Median response time bawat entry |
| `scores.p95_latency_seconds` | number | 95th percentile response time bawat entry |

### 3.7 Per-Entry Results

Bawat entry sa `results[]` array ay nagtatala ng isang translation. Ang per-entry data ay persisted sa `run_card_entries` table (migration 005) na may denormalized LYSS verdicts (migration 006).

| Field | Type | Description |
|-------|------|-------------|
| `entry_id` | string | Tumutugma sa `entries[].id` sa corpus |
| `source` | string | Source text na isinalin |
| `expected` | string | Gold-standard reference translation |
| `raw_predicted` | string \| null | Raw model output bago ang post-processing |
| `predicted` | string | Aktuwal na output ng method (post-processed) |
| `segment` | string | Segment identifier (hal., sentence index) |
| `difficulty` | string \| null | Difficulty tier mula sa corpus |
| `domain` | string | Domain tag mula sa corpus (§2.7) |
| `exact_match` | boolean | Kung eksaktong tumugma ang output sa reference |
| `chrf_score` | number \| null | Sentence-level chrF++ (0–100) |
| `bleu_score` | number \| null | Sentence-level BLEU (0–100) |
| `latency_s` | number \| null | Response time sa seconds |
| `cost_usd` | number \| null | Gastos sa USD para sa entry na ito |
| `tool_call_count` | integer | Bilang ng tool calls na ginamit (0 kung wala) |
| `error` | string \| null | Error message kung nabigo ang entry na ito |
| `plugin_metrics` | object | Buong per-entry plugin output (JSONB) |
| `fst_valid` | boolean \| null | Tinanggap ng GiellaLT FST ang prediction (denormalized LYSS-fst) |
| `equivalent_match` | boolean \| null | Kinumpirma ng CRK linter ang structural equivalence (denormalized LYSS-eq) |
| `semantic_verdict` | string \| null | LYSS-sem verdict: `VALID`, `MISMATCH`, `UNKNOWN`, `ERROR` |
| `code_switching_detected` | boolean \| null | Source-language tokens na natukoy sa output |
| `hallucination_detected` | boolean \| null | Fabricated content na natukoy sa output |



### 3.8 Fingerprint

Isang reproducibility identifier. Gumamit ng parehong experimental setup ang dalawang run na may magkaparehong fingerprint.

Ang fingerprint ay ang SHA-256 hash ng sorted concatenation ng:
- `dataset.sha256`
- `model_slug`
- `condition`
- `system_prompt_sha256`
- `temperature`
- `harness_version`
- `batch_size`
- `tools_enabled`

> **Bakit 8 components?** Material na nakaaapekto sa output quality ang batch size at tool-calling at dapat isama sa identity. Dalawang run na may magkaibang batch size o magkaibang tools na enabled ay magkaibang experimental setups, kahit tugma ang lahat ng ibang parameters.

Dalawang run na may identical fingerprints ay dapat mag-produce ng comparable results. Ang differences ay dahil sa API non-determinism (temperature > 0) o provider-side model updates.

### 3.9 Run Card Hash

Ang SHA-256 hash ng buong run card JSON (na ang `run_card_hash` field mismo ay nakatakda sa `""` habang nagha-hash). Ito ang tamper-detection seal. Kung magbago ang anumang field, masisira ang hash.

---

## 4. Automated Metrics

Lahat ng metrics sa seksyong ito ay machine-computed. Tingnan ang §1.2.

### 4.1 Metric Definitions

| Metric | Status | What It Measures | Range |
|--------|--------|-----------------|-------|
| **chrF++** | ✅ Implemented | Character n-gram F-score. Gumagana sa character level, kaya mas robust ito kaysa word-level metrics (BLEU) para sa morphologically rich languages kung saan mahahaba at highly inflected ang mga salita. Kinukuwenta ng sacrebleu. | 0–100 (native scale). Hinahati sa 100 kapag ginamit sa composite. |
| **FST acceptance rate** | ✅ Implemented | Fraction ng predicted words na tinatanggap ng morphological analyzer (GiellaLT HFST) bilang valid forms sa target language. Ang salitang tinatanggap ng FST ay tunay at structurally valid na salita — hindi hallucination. | 0.0–1.0 |
| **Exact match** | ✅ Implemented | Fraction ng predictions na eksaktong tumutugma sa reference pagkatapos ng Unicode normalization. Strict ngunit unambiguous — kapaki-pakinabang bilang ceiling check. | 0.0–1.0 |
| **Morphological accuracy** | 🔲 Planned | Para sa entries na may gold-standard morphological analysis: fraction ng morphemes na tama ang pagkakagawa. Mas granular kaysa FST acceptance — maaaring FST-valid ang salita ngunit mali ang morpheme structure (tamang root, maling tense). | 0.0–1.0 |
| **Equivalent match** | ⚡ Partial | Fraction na tumutugma sa acceptable variant ng reference — isinasaalang-alang ang word order, dialectal differences, at orthographic conventions. Kasalukuyang implemented para sa CRK sa pamamagitan ng `CrkLinterMetric` ng CRK eval standard (sa `eval_standards/crk/`); awtomatikong nilo-load sa pamamagitan ng `evalMetrics` declaration ng CRK language card. Nangangailangan ang generic implementation ng per-entry `variants[]` sa corpus. | 0.0–1.0 |
| **Semantic score** | ⚡ Partial | Pagpapanatili ng meaning kahit ano pa ang surface form. Kasalukuyang implemented para sa CRK sa pamamagitan ng `CrkSemanticMetric` ng CRK eval standard (sa `eval_standards/crk/`, verdict-weighted proxy). Planned ang universal embedding-based cosine similarity — tingnan ang SCORING_SPEC §2.3. | 0.0–1.0 |

### 4.2 Composite Score

Ang composite score ay weighted average ng lahat ng *available* metrics:

```
composite = Σ (weight_i × metric_i)   for all available metrics
             ─────────────────────
             Σ weight_i              (renormalized to sum to 1.0)
```

Kapag unavailable ang isang metric (walang FST na configured, walang variant classes na tinukoy, walang embedding model), ang weight nito ay nire-redistribute nang proportional sa natitirang metrics. Ibig sabihin, palaging comparable ang composite sa loob ng isang wika — ginagamit nito ang anumang metrics na available para sa wikang iyon at nino-normalize nang naaayon.

**Ang weight tables, input normalization rules, at buong metric inventory ay tinukoy sa `SCORING_SPEC.md` §4.** Ang dokumentong iyon ang SSOT para sa:
- Profile A weights (mga wikang may FST coverage — 9 metrics, structural metrics carry 40%)
- Profile B weights (mga wikang walang FST coverage — 8 metrics)
- Normalization rules (chrF++ ÷ 100, code-switching at hallucination rate inversion)
- Metrics na excluded sa composite (BLEU, COMET, TER, length ratio, consistency) at kung bakit

Sinasalamin ng harness code ang mga table na ito sa `mt_eval_harness/scoring.py`. Kapag nagbago ang SCORING_SPEC, ina-update ang `scoring.py` upang tumugma at vine-validate ng `test_scoring_ssot.py` ang alignment.

> **Bakit hindi BLEU?** Gumagana ang BLEU sa word level at pinaparusahan ang morphological variation. Para sa polysynthetic languages, ang isang salita ay maaaring maging buong clause — ituturing ng BLEU ang maliliit na inflectional differences bilang ganap na miss. Mas mahusay itong hinahandle ng chrF++ sa pamamagitan ng paggana sa character level. Excluded ang BLEU sa parehong weight tables. Tingnan ang SCORING_SPEC Appendix A para sa buong rationale.


### 4.3 Cost-Adjusted Score

Para sa methods na gumagamit ng paid APIs, nagre-report din kami ng secondary ranking. Ang cost-adjusted formula ay tinukoy sa `SCORING_SPEC.md` §6.3.

---

## 5. Quality Tiers {#5-quality-tiers}

Ang quality tiers ay heuristic labels sa automated composite scores. Inilalarawan nila kung ano ang karaniwang ibig sabihin ng scores sa practice, batay sa human review ng outputs sa bawat level. **Hindi sila validated quality judgments** — human review (§6) lamang ang makakapagkumpirma ng actual usability.

**Ang tier thresholds at descriptions ay tinukoy sa `SCORING_SPEC.md` §5.** Ang tiers ay: Baseline (0.00–0.30), Emerging (0.30–0.50), Functional (0.50–0.70), Deployable (0.70–0.85), at Fluent (0.85–1.00).

> [!IMPORTANT]
> **Provisional ang automated tiers.** Ang labels na ito ay nominations para sa review, hindi quality declarations. Ang method na umaabot sa "Deployable" sa automated metrics ay candidate para sa community evaluation — hindi product na dapat i-ship. Human review (§7) lamang ang makakapagkumpirma ng actual usability. Maaaring magkaiba ang tier boundaries sa iba't ibang wika.

Provisional ang tiers na ito. Ire-recalibrate ang mga ito habang naiipon ang human validation data at natututuhan namin kung saan talaga matatagpuan ang threshold na "napapakinabangan ito ng speaker" para sa bawat wika. Maaaring magkaiba ang tier boundaries sa iba't ibang wika.

Walang method ang maaaring mag-claim ng **Deployable** o mas mataas nang walang community review na nagkukumpirmang sang-ayon ang bilingual speakers na usable ang output.

---

## 6. Benchmark Protocol

Ang **benchmark** ay sistematikong production ng run cards sa isang declared parameter space sa isang ibinigay na dataset. Hindi ito isang run lamang — ito ay structured exploration kung paano nagpe-perform ang iba't ibang configurations.

### 6.1 What a Benchmark Produces

Gumagawa ang benchmark ng **matrix of run cards** — isa para sa bawat combination ng parameter values. Pinapagana ng matrix ang multifaceted comparison sa:

- **Quality** — composite score, individual metric breakdowns
- **Cost** — total at per-entry cost para sa bawat configuration
- **Speed** — wall-clock time at per-entry latency

Walang iisang "benchmark score." Ang benchmark ay ang buong matrix. Iba-iba ang papahalagahan ng iba't ibang stakeholders: ang researcher ay nag-o-optimize para sa composite score, ang deployment engineer ay nag-o-optimize para sa cost-per-entry, ang community ay nagre-review ng quality.

### 6.2 Parameter Space

Idinedeklara ng benchmark kung aling parameters ang pinu-permute:

| Axis | Typical Values | Purpose |
|------|---------------|---------|
| `model` | 4–12 models (frontier + mid-tier + budget) | Gaano kahalaga ang model capability? |
| `temperature` | 0.0, 0.3, 0.7 | Nakakatulong ba o nakakasama ang sampling randomness? |
| `prompt_version` | 2–3 prompt strategies | Gaano ka-sensitive ang method sa prompt design? |
| `coaching_config` | with/without coaching data | Pinapabuti ba ng pag-inject ng linguistic knowledge ang output? |
| `tool_config` | with/without FST, with/without dictionary | Pinapabuti ba ng linguistic tools ang output? |

Ang full permutation space:
```
runs = |models| × |temperatures| × |prompts| × |coaching| × |tools|
```

Isang karaniwang initial benchmark: 12 models × 3 temperatures × 2 prompts × 2 coaching = 144 runs.

### 6.3 Baseline vs. Method Evaluation

May dalawang magkaibang layunin ang benchmark:

**Baselining** — pagmamapa ng landscape gamit ang naive approaches. "Ano ang kayang gawin ng existing models para sa wikang ito nang walang anumang language-specific engineering?" Itinatakda nito ang bar. Sinasabi sa inyo ng baseline matrix: aling models ang pinakamababang mag-hallucinate, aling temperatures ang nagbibigay ng pinakaconsistent na output, kung nakakatulong ba talaga ang coaching data, kung saan pare-parehong nabibigo ang lahat ng models (na nagpapakita ng mahihirap na linguistic problems).

**Method evaluation** — pagsubok sa isang partikular na engineered method. "Nahihigitan ba ng aking FST-gated coached pipeline ang baselines?" Inihahambing ang run card ng method laban sa baseline matrix. Interesting ang isang method kapag nahihigitan nito ang pinakamahusay na baseline — kapag nagdaragdag ng value ang engineering kumpara sa naive model calls.

Parehong gumagawa ang dalawang activity ng run cards na may parehong schema. Ang pagkakaiba ay nasa intent at parameter space: nagpe-permute ang baselines sa models at configs; sinusubok ng method evaluation ang isang method laban sa pinakamahusay na configurations.

### 6.4 Dev vs. Gold-Standard Evaluation

Malayang nag-i-iterate ang method developers laban sa `development` at `diagnostic` corpus segments. Informal ito — walang limits, walang submissions, walang governance involvement. Natututuhan ng developer kung ano ang gumagana.

Ang official leaderboard scores ay nagmumula lamang sa `gold_standard` evaluation. Formal ito:
1. Isusumite ng developer ang kanilang kumpleto at runnable na method (code + config + coaching data)
2. Tatakbuhin ito ng governance org sa sandboxed harness laban sa secret test set
3. Scores lamang ang ibabalik

Tingnan ang §8 para sa buong sovereignty mechanism.

---

## 7. Human Validation {#7-human-validation}

Ang automated metrics ay proxies. Ang human validation ang ground truth.

### 7.1 What Human Review Catches That Metrics Miss

- **Morphologically valid ngunit semantically wrong** — tinatanggap ng FST ang salita, mataas ang chrF++, ngunit iba ang ibig sabihin ng translation
- **Culturally inappropriate** — technically correct ang translation ngunit gumagamit ng register o framing na tatanggihan ng community
- **Hallucinated plausibility** — mukhang target language ang output sa non-speaker ngunit gibberish ito para sa fluent speaker
- **Acceptable ngunit unmarked variation** — tama ang output ngunit minamarkahan itong mali ng automated metrics dahil gumagamit ito ng dialectal variant na wala sa reference

### 7.2 The Validation Gate

Walang method ang maaaring umusad mula **Functional** patungong **Deployable** tier nang walang human validation na nagkukumpirmang sang-ayon ang bilingual speakers na usable ang output. Hindi ito formality — ito ang punto. Umiiral ang automated metrics upang bawasan ang dami ng output na kailangang i-human review. Hindi nila ito maaaring palitan.

### 7.3 Community Review Protocol

> 🔲 **Planned**: Hindi pa live ang community review interface. Inilalarawan ng seksyong ito ang intended process.

1. Umaabot ang isang method sa Deployable threshold sa automated metrics
2. Isang sample ng outputs (stratified by difficulty tier) ang ipinapakita sa bilingual speakers
3. Ire-rate ng speakers ang bawat translation sa scale: **reject**, **gist** (malinaw ang meaning ngunit mali ang phrasing), **acceptable** (tama na may minor issues), **excellent** (hindi maihihiwalay sa human translation)
4. Ire-review ng governance org ang aggregate ratings
5. Kung tinatanggap ng community ang method, nagpapatuloy ito sa ownership transfer at deployment

May minimum na istruktura ang review bago nito maigawad ang **Community Validated**
tier (§9.4): saklaw ng stratified sample ang **hindi bababa sa 30 entry**,
**hindi bababa sa 2 reviewer** — kapwa kuwalipikado sa ilalim ng sariling protocol
ng komunidad — at **hindi bababa sa 70%** ng mga entry ang dapat makatugon sa
pamantayan ng pagtanggap ng komunidad. Iginagawad lamang ang tier sa pamamagitan
ng testing na mismong pinapatakbo ng komunidad, ayon sa pasya nito, at simetriko
ang demotion: inaalis ng parehong protocol na pinatakbo bilang spot-audit ang
tier nang kasing-publiko ng pagkakagawad nito.

---

## 8. Sovereignty

Ang evaluation datasets ay naglalaman ng curated linguistic knowledge na pag-aari ng language community. Tinutukoy ng seksyong ito ang technical at legal framework para sa pagprotekta sa data na iyon.

### 8.1 The Problem

Karaniwang inilalathala nang bukas ng conventional benchmarks ang test sets. Kapag nailathala na, hindi na maaaring bawiin ang pagkakalathala ng data. Para sa Indigenous at minority language communities, lumilikha ito ng extractive dynamic — ginagamit ang linguistic data nang walang patuloy na consent. Alinsunod sa pragmatic view ni Dhein sa biodata sovereignty, tinatrato namin ang linguistic data bilang "mercurial resource with unknowable potential" na nangangailangan ng dynamic, relational governance.

### 8.2 Sandboxed Execution

Ang pangunahing enforcement mechanism: ibinibigay ng developer ang kanilang method module, pinapatakbo ito ng governance org laban sa fully secret test set sa kanilang sariling infrastructure, at scores lamang ang ibinabalik. Hindi kailanman nakikita ng developer ang source sentences o reference translations.

```mermaid
graph TD
    A["Developer builds method\nusing public development corpus"] --> B["Developer submits\nmethod module\n(code + config + coaching)"]
    B --> C["Governance org runs method\nin sandboxed harness\nagainst secret test set"]
    C --> D["Scores returned\nto developer"]
    D --> E{"Meets Deployable\nthreshold?"}
    E -->|Yes| F["Ownership transfer\n+ community review"]
    E -->|No| G["Developer iterates"]
    G --> A
```

Ang flow:
1. **Public ang development corpus.** Walang restrictions sa `development` at `diagnostic` segments.
2. **Fully secret ang gold-standard test set.** Parehong nasa governance-controlled infrastructure ang source sentences at reference translations.
3. **Para makakuha ng official score, ibibigay ninyo ang inyong method.** Pinapatakbo ito ng governance org sa sandbox. Scores lamang ang ibabalik.
4. **Nasa governance org na ang method.** Ang submission AY ang method code. Kung umabot ito sa Deployable threshold, kasalukuyan nang umuusad ang ownership transfer.
5. **Nangangailangan ang submission ng pagsang-ayon sa terms.** Kasama ang ownership transfer clause (§8.3).
6. **Ganap na kontrolado ng governance org ang access.** Maaari nilang tanggihan o bawiin ang evaluation anumang oras. Dynamic consent.
7. **Ang encryption at rest ay defense-in-depth.** Architectural ang primary enforcement.

### 8.3 Ownership Transfer

Ang methods na nakakamit ang composite score na nasa o lampas sa Deployable threshold (0.70) laban sa gold-standard evaluation, **at** pumapasa sa human validation (§7), ay saklaw ng ownership transfer.

**Pinananatili ng developer ang:**
- Attribution at credit (nananatili ang pangalan sa leaderboard)
- Karapatang maglathala tungkol sa method
- Karapatang gamitin ang method para sa ibang language pairs

**Nakukuha ng governance org ang:**
- Karapatang gamitin, baguhin, i-distribute, at i-monetize ang method para sa kanilang wika
- Karapatang mag-sublicense
- Physical possession ng method code (hawak na mula sa evaluation submission)

### 8.4 Governance Organization Requirements

Upang magsilbi bilang key custodian para sa isang language benchmark:

1. **Kumatawan sa language community** — demonstrable relationship sa speakers at cultural authorities
2. **Capacity for key management** — technical ability na mag-manage ng cryptographic keys
3. **Mag-commit sa evaluation availability** — dapat manatiling evaluable ang benchmark
4. **Mag-publish ng terms of participation** — malinaw na documentation ng sinasang-ayunan ng developers
5. **Mag-operate sa ilalim ng recognized na mga prinsipyo ng data sovereignty** — pagmamay-ari at kontrol ng komunidad sa data ng wika, CARE, o equivalent

### 8.5 Paglilingkod sa mga Prinsipyo ng Data Sovereignty at CARE

| Prinsipyo | Pagpapatupad |
|-----------|---------------|
| **Pagmamay-ari** | Ang linguistic data ay pagmamay-ari ng komunidad. Kinokontrol ng organisasyon ng pamamahala ang imprastraktura ng pagsusuri. |
| **Kontrol** | Kinokontrol ng organisasyon ng pamamahala ang pagsusuri sa pamamagitan ng sandboxed execution. Sila ang nagpapasya kung sino ang magsusumite at sa anong mga tuntunin. |
| **Pag-access** | May walang limitasyong pag-access ang komunidad sa kanilang sariling data, mga resulta, at mga pamamaraang binuo gamit ito. |
| **Paghawak** | Ang test set ay hindi kailanman umaalis sa imprastraktura ng pamamahala. Encryption at rest bilang backup. |
| **Sama-samang Pakinabang** (CARE) | Tinitiyak ng paglipat ng pagmamay-ari na ang mga pamamaraan ay mapapakinabangan ng komunidad, na nagpapanatili sa pamamaraan at sa lahat ng kinikita nito — walang kinukuhang bahagi ang platform. |
| **Awtoridad na Kumontrol** (CARE) | Ang sandboxed execution ay ang teknikal na pagpapatupad. |
| **Responsibilidad** (CARE) | Tinatanggap ng mga developer ang responsibilidad sa pamamagitan ng mga tuntunin ng pakikilahok. |
| **Etika** (CARE) | Mga karapatan ng komunidad kaysa sa kaginhawaan ng mananaliksik. |

### 8.6 Dependency Classes at ang Sandbox Network Policy

Parehong nakadepende ang sandboxed execution (§8.2) at ownership transfer (§8.3) sa eksaktong pagkaalam kung ano ang kailangan ng method sa runtime. Tinutukoy ng [Method Interface spec](/docs/network/specifications/methods#method-validity-and-dependency-classes) ang limang **dependency classes** — S (self-contained), O (open external), A1 (substitutable LLM inference), A2 (non-substitutable external API), X (closed) — at ang dependency manifest na dapat ideklara ng bawat method. Itinatala ng subsection na ito kung paano ipinapatupad ng sandbox network policy ang mga ito.

**Default-deny egress.** Kinakailangan ng sandbox specification na walang network access ang method containers by default. Hindi ito firewall rule — inaalis ng specification ang network mula sa execution environment, kaya ang undeclared network dependency ay nabibigo sa architecture layer, hindi sa policy layer. Ang Class S at O methods ay tumatakbo nang ganap mula sa artifacts na naka-vendor sa submission (ang Class O artifacts ay naka-pin at naka-mirror sa submission time).

**The LLM gateway (🔲 planned).** Karamihan ng methods ay tumatawag sa LLMs, kaya tumutukoy ang sandbox specification ng eksaktong isang egress exception: isang **LLM gateway** na pinapatakbo ng evaluation infrastructure. Ang gateway ay:

- nagpa-proxy ng mga inference request sa isang **tahasang allowlist ng mga naka-pin na modelo** — ang mga identifier ng modelo na naitala sa manifest at run card ng pamamaraan;
- **nagtatala ng bawat request at response** sa append-only, hash-chained na audit log, upang masuri ang trapiko ng gateway para sa mga pagtatangkang mag-exfiltrate ng data bago ilabas ang mga marka;
- ay ang *tanging* network path — walang pangkalahatang egress, walang DNS, walang ibang mga endpoint.

Ito ang nagpapahintulot na ma-evaluate ang Class A1 methods nang hindi tinatalikuran ang verifiability guarantees ng §8.2 — ngunit tunay itong trade-off, at malinaw itong pinapangalanan ng specification: ang pagsasalin ng secret source sentence sa pamamagitan ng external model ay **nagdi-disclose ng source sentence na iyon sa model provider**. Hindi kailanman umaalis ang reference translations (hawak sila ng harness, sa labas ng container; tingnan ang §8.2), at hindi pa rin makakapag-exfiltrate ang method ng anumang higit sa nilalaman ng logged, allowlisted inference calls. Kung katanggap-tanggap ang bounded disclosure na iyon para sa isang partikular na corpus ay desisyon ng steward: ang pag-authorize ng Class A1 evaluation ay nangangahulugang sinasadyang ina-authorize ito, bawat run, tulad ng bawat ibang paggamit ng data.

**Katayuan.** Ang network-isolated method-execution **sandbox ay ipinatupad na** para sa mga patimpalak na pinapatakbo ng organizer (inilabas noong 2026-07-08; tingnan ang [Tapat na mga Limitasyon](/docs/network/honest-limitations) para sa kung ano eksakto ang binuo at hindi binuo). Ang **LLM gateway ay tinukoy na ngunit hindi pa nabubuo.** Hanggang sa maging operational ang gateway, tanging ang mga pamamaraan ng Class S at O lamang ang makakagawa ng mga gold-standard na marka; ang mga pamamaraan ng Class A1 ay nananatiling karapat-dapat sa premyo sa prinsipyo (tingnan ang [Pagtutukoy ng Premyo §1.6](/docs/network/specifications/prizes)) ngunit hindi pa maaaring masuri laban sa mga lihim na segment. Ang mga dependency ng Class A2 ay hindi maaaring pumasok sa sandbox hangga't hindi nagbibigay ng pahintulot ang may hawak ng mga karapatan — ang artifact ay kailangang payagang *umiral* sa sandbox bago lumitaw ang anumang isyu sa network.

---

## 9. Leaderboard & Submission

### 9.1 Submission Requirements

Ang valid leaderboard submission ay dapat magsama ng:

1. Kumpletong run card (§3) na may lahat ng required fields
2. Method code — fully runnable, may installation instructions
3. Lahat ng dependencies — coaching data, dictionaries, FST binaries, prompts
4. Cost report
5. README na naglalarawan ng approach at limitations ng method

### 9.2 Legitimacy Criteria

1. **Walang training sa evaluation data.** Hindi dapat na-expose ang methods sa `gold_standard` o `held_out` entries. (Architecturally enforced — hindi kayo makakapag-train sa data na hindi pa ninyo nakita.)
2. **Ideklara ang development data usage.** Pinapayagan ang paggamit ng `development` entries para sa few-shot prompting ngunit dapat ideklara.
3. **Reproducibility.** Dapat kayang i-re-run ng governance org at makamit ang scores sa loob ng ±2%.
4. **Generalization.** Dapat gumana ang methods sa unseen entries, hindi lamang sa memorized examples.

### 9.3 Anti-Gaming

1. **Variant-class linting** — fina-flag ang kahina-hinalang perfect performance sa entries na may known variants
2. **Corpus rotation** — maaaring mag-rotate ang governance org ng entries sa pagitan ng segments nang walang notice
3. **Community review** — nahuhuli ng human validation gate (§7) ang methods na nagga-game ng metrics ngunit gumagawa ng masamang output

### 9.4 Verification Tiers

Inilalarawan ng verification tiers kung **sino ang nag-validate ng result** — orthogonal sa quality tiers (§5), na naglalarawan kung ano ang ibig sabihin ng automated score.

| Antas | Kahulugan | Paano Nakamit |
|------|---------|--------------|
| **Self-benchmarked** | Pinatakbo ng developer ang harness at isinumite ang run card | PR o `--publish` flag laban sa `development` segment |
| **Champollion Verified** | Malayang ginawa muli ng mga maintainer ang resulta | Isumite ang pamamaraan bilang mai-install na plugin; muling papatakbuhin ng mga maintainer |
| **Community Validated** | Ang mga bilingual na tagapagsalita ng target na wika, na kwalipikado sa ilalim ng sariling protocol ng komunidad, ay sumuri sa isang stratified sample ng output (≥30 entry, ≥2 tagasuri) at ≥70% ang nakapasa sa pamantayan ng komunidad. Iginagawad lamang sa pamamagitan ng sariling pagsubok ng komunidad; ang pagbaba ng antas sa pamamagitan ng spot-audit ay simetriko | Isumite ang code ng pamamaraan sa organisasyon ng pamamahala (§8.2); papatakbuhin nila ito laban sa `gold_standard` at ang output ay papasa sa balidasyon ng tao (§7) |

Maaaring maging Self-benchmarked ang isang method sa Functional quality tier. Ang quality tier at verification tier ay independent axes sa leaderboard.

### 9.5 Layered Submission Model

Nakadepende ang submission mechanism sa kung aling corpus segment ang ine-evaluate ninyo:

| Segment | Paraan ng Pagsusumite | Beripikasyon | Kinakailangan ba ang Code ng Pamamaraan? |
|---------|----------------|-------------|----------------------|
| `development` | Self-serve: patakbuhin ang harness, isumite ang run card sa pamamagitan ng PR o API | Self-benchmarked | Hindi — pananatilihin mo ang iyong code |
| `development` | Muling pagpapatakbo ng maintainer: isumite ang pamamaraan bilang plugin | Champollion Verified | Oo — dapat mai-install ang pamamaraan |
| `gold_standard` | Isumite ang pamamaraan sa organisasyon ng pamamahala; papatakbuhin nila ito sa sandbox | Community Validated | Oo — isusumite at hahawakan ang pamamaraan |

Walang restrictions ang self-serve path (development segment). Nangangailangan ang sovereign path (gold-standard segment) ng full method submission dahil (a) hindi kailanman nakikita ng developer ang test set, at (b) ang methods na umaabot sa Deployable ay saklaw ng ownership transfer (§8.3).

### 9.6 Method Classes

Inuuri ang methods ayon sa type. Ang canonical enum ay tinukoy sa harness codebase (`VALID_METHOD_CLASSES` sa `config.py`):

| Class | Description |
|-------|-------------|
| `raw-llm` | Direct LLM call na walang language-specific engineering |
| `coached-llm` | LLM na may coaching data (examples, grammar notes, dictionary entries) |
| `pipeline` | Multi-step pipeline (hal., translate → FST validate → retry) |
| `custom-plugin` | Custom `TranslationMethod` plugin |
| `api` | External translation API (Google Translate, DeepL, atbp.) |
| `human` | Human translator baseline |

### 9.7 Leaderboard Fields

| Field | Description |
|-------|-------------|
| Rank | Posisyon ayon sa composite score |
| Method name | Identifier na pinili ng developer |
| Composite score | Weighted average ng available metrics (§4.2) |
| chrF++ | Character n-gram score (0–100) |
| FST acceptance | Morphological validity rate (0.0–1.0) |
| Exact match | Strict match rate (0.0–1.0) |
| Semantic score | Meaning preservation (0.0–1.0) — 🔲 kapag available |
| Cost per entry | USD bawat corpus entry |
| Speed | Avg latency bawat entry (seconds) |
| Cost-adjusted score | Secondary ranking (§4.3) |
| Method class | Mula sa §9.6 enum |
| Model | LLM/engine na ginamit |
| Quality tier | Automated composite range (§5) |
| Verification tier | Sino ang nag-validate (§9.4) |
| Date | Kailan na-evaluate |

> [!NOTE]
> **Lahat ng scores na ipinapakita sa leaderboard ay automated proxy measurements.** Ipinapahiwatig nila ang relative method performance sa ilalim ng controlled conditions ngunit hindi bumubuo ng quality guarantees. Hiwalay na minamarkahan ang community-validated methods sa pamamagitan ng Verification tier column. Para sa methodology details, tingnan ang [SCORING_SPEC.md](/docs/network/specifications/scoring).

---

## 10. Cost Framework {#10-cost-framework}

### 10.1 Per-Run Cost

```
run_cost = entries × api_calls_per_entry × cost_per_api_call
```

Karaniwang per-run costs para sa 150-entry corpus:

| Method | Model | Estimated Cost |
|--------|-------|---------------|
| Naive LLM | Gemini 2.5 Flash | $0.15–0.30 |
| Coached LLM | Gemini 2.5 Flash | $0.30–0.60 |
| FST-gated (3 retries) | Gemini 2.5 Flash | $0.45–1.20 |
| Naive LLM | Claude Sonnet 4 | $0.45–0.90 |
| Coached LLM | GPT-4.1 | $0.60–1.50 |

### 10.2 Benchmark (Sweep) Cost

```
sweep_cost = Σ run_cost(i)   for each parameter combination i
```

Karaniwang sweep: 12 models × 3 temps × 2 prompts × 2 coaching = 144 runs sa ~$0.50 avg = **~$72 bawat sweep**.

### 10.3 Per-Language Establishment

| Component | Cost Range | Notes |
|-----------|-----------|-------|
| Speaker compensation (corpus) | $2,500–6,000 | 50–150 entries sa $50–65/hr |
| Speaker compensation (review) | $500–1,500 | Pag-review ng method output |
| Compute (benchmark sweeps) | $100–500 | Multiple sweeps habang development |
| Compute (ongoing leaderboard) | $50–200/year | Pagpapatakbo ng submitted methods |
| Infrastructure (sandbox) | $200–500/year | Eval infra ng governance org |
| **Total establishment** | **$3,350–8,500** | |

### 10.4 Program Scale

| Scale | Annual Cost | Notes |
|-------|------------|-------|
| 1 language (maintenance) | $1,000–3,000 | Pagkatapos ng establishment |
| 5 languages (establishment + maintenance) | $25,000–65,000 | Unang taon |
| 10 languages (steady state) | $15,000–40,000 | Bawat taon pagkatapos ng establishment |

---

## 11. Extending to New Languages {#11-extending-to-new-languages}

### 11.1 Minimum Requirements

1. **50+ entries** sa `gold_standard` segment
2. **30+ entries** sa `development` segment
3. **10+ entries** sa `diagnostic` segment na nagta-target ng specific linguistic phenomena
4. **Provenance** para sa bawat entry
5. **Difficulty distribution** — hindi bababa sa 3 sa 5 tiers
6. **Register distribution** — hindi bababa sa 2 registers
7. **Community consent** — documented agreement mula sa language community

### 11.2 Optional but Valuable

- **FST morphological analyzer** — pinapagana ang pinakamakapangyarihang metric para sa polysynthetic languages
- **Bilingual dictionary** — pinapagana ang dictionary-based methods, binabawasan ang hallucination
- **Gold-standard morphological analysis** — pinapagana ang morphological accuracy metric
- **Variant classes** — pinapagana ang equivalent match metric at anti-gaming linting
- **Governance organization** — pinapagana ang cryptographic sovereignty at ownership transfer

### 11.3 The Agent-Assisted Path

> 🔲 **Planned**: Ang agent-assisted corpus creation ay future capability.

Para sa mga wikang walang malawak na existing resources:

1. Bumubuo ang agent ng candidate source sentences sa iba't ibang difficulty tiers at registers
2. Isinasalin ito ng bilingual speaker (ang step na ito ay palaging human)
3. Nagmumungkahi ang agent ng morphological analysis (validated ng FST kung available, kung hindi ay ng speaker)
4. Ifo-format ng agent ang lahat sa corpus schema
5. Ire-review ng linguist o speaker ang final corpus

Binabawasan nito ang speaker time mula ~80 hours patungong ~30–40 hours bawat wika.

---

*Ang spec na ito ay living document. Habang nagtatatag kami ng benchmarks para sa mas maraming wika, matututuhan namin kung ano ang gumagana at magre-refine kami nang naaayon. Ang goal ay sapat na rigorous upang maging credible, sapat na flexible upang maging useful, at sapat na open upang makalahok ang sinuman — ayon sa terms ng community.*

