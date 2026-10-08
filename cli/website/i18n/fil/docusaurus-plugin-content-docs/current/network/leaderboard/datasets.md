---
sidebar_position: 3
title: "Mga Dataset sa Pagsusuri"
related:
  - label: "Corpus Design Framework"
    to: /docs/network/specifications/corpus-design
    kind: spec
    note: "How evaluation corpora are constructed"
  - label: "Cookbook: Corpus Creation"
    to: /docs/network/tutorials/corpus-creation
    kind: cookbook
    note: "Build a corpus for your language"
  - label: "Benchmark Specification"
    to: /docs/network/specifications/benchmark
    kind: spec
  - label: "What Counts as a Language Here?"
    to: /docs/network/context/what-counts-as-a-language
    kind: doc
---

# Mga Dataset para sa Ebalwasyon

> **Pang-ehekutibong Buod.** Inilalarawan ng pahinang ito ang mga evaluation dataset na magagamit para sa benchmarking, kabilang ang corpus entry schema, mga antas ng kahirapan (1–5), at mga kinakailangan sa provenance. Ang katalogo ay binubuo ng **~4,700 fetch-from-source na evaluation dataset sa 19 na pamilya ng corpus** (TICO-19, IN22, Tatoeba, GlobalVoices, SMOL, ALT, Turkic-x-WMT, WMT24++, ang mga WMT newstest/General blind set 2014–2025, MAFAND-MT, NusaX, NusaTranslation, LoResMT, AmericasNLP 2021, NICT-SAP, BSD, MENYO-20k, Gamayun, EdTeKLA) kasama ang FLORES+ — ang *nilalaman* ng corpus ay hindi kailanman hino-host dito; ang bawat dataset ay isang sha-pinned na metadata card na deterministikong muling binuo mula sa naka-pin na upstream archive nito. Ang isang **non-commercial / research-only na lane** (Gamayun, EdTeKLA, MAFAND-MT, NusaTranslation, LoResMT, AmericasNLP, NICT-SAP, BSD, MENYO-20k, at ang mga WMT research-use set) ay ibinukod mula sa anumang commercial / prize / API path; sa loob nito, ang mga corpus sa ilalim ng mga binago, bespoke, o hindi tinukoy na grant ay karagdagan ding **consent-gated** — tatanggi ang remote model-API evaluation maliban kung ang mismong teksto ng lisensya ay nagbibigay ng pahintulot para sa paggamit sa ebalwasyon (naitala bilang isang tahasang desisyon bawat dataset, tulad ng sa mga WMT research-use set) o kung ang pahintulot ng may-ari ng karapatan ay naitala sa entry ng dataset. Ang dalawang human-curated na reference dataset — EDTeKLA Dev v1 (Plains Cree) at FLORES+ Devtest (870 nakatalang language pair, 1,012 pangungusap bawat isa) — ay detalyado sa ibaba; ang buong breakdown ng bilang ng entry ng EdTeKLA ay nakasaad nang minsan, sa [seksyon nito](#edtekla-development-set-v1).

Ang mga dataset ang mga fixed target na pinapatakbo ng harness. Ang bawat dataset ay isang JSON file na naglalaman ng source→target pairs na may gold-standard references. Isini-score ng harness ang mga output ng model laban sa mga reference na ito — hindi nito kailanman binabago ang mga ito.

:::danger[HUWAG MAG-TRAIN sa datos ng pagsusuri]

⚠️ **Ang mga dataset na ito ay para lamang sa ebalwasyon.** Ang mga method na na-train, fine-tuned, few-shot-prompted, o sa ibang paraan ay na-expose sa evaluation data ay magbubunga ng artipisyal na pinataas na mga score at **madidisqualify mula sa leaderboard.**

Gumamit ng hiwalay na corpora para sa training. Dapat manatiling hindi nakikita ng inyong model ang mga evaluation set habang nasa development.
:::

---

## Format ng Dataset {#dataset-format}

Sinusunod ng bawat dataset ang parehong JSON schema:

```json
{
  "dataset": {
    "id": "dataset-slug",
    "version": "1.0",
    "language_pair": "EN→CRK",
    "description": "Human-readable description of the dataset",
    "source_language": "en",
    "target_language": "crk",
    "created": "2025-05-01",
    "license": "CC-BY-NC-4.0",
    "provenance": ["gold_standard", "textbook"]
  },
  "entries": [
    {
      "id": 1,
      "source": "Hello",
      "reference": "tânisi",
      "difficulty": 1,
      "provenance": "gold_standard",
      "register": "conversational",
      "context": "greeting",
      "notes": "Common greeting, SRO orthography"
    }
  ]
}
```

:::info[Kanonikal na Schema]
Itinatakda ng [Specification ng Benchmark](/docs/network/specifications/benchmark) ang kanonikal na corpus at entry schema. Idinodokumento ng pahinang ito ang mga available na dataset at kung paano gumawa ng mga bago.
:::

### Top-Level na `dataset` Block

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Natatanging dataset identifier (ginagamit sa mga run card at leaderboard) |
| `version` | `string` | Semantic version. Kapag ini-increment ito, nai-invalidate ang mga naunang paghahambing ng run card |
| `language_pair` | `string` | Display label (hal., `EN→CRK`) |
| `description` | `string` | Opsyonal. Buod na nababasa ng tao |
| `source_language` | `string` | BCP 47 source language code |
| `target_language` | `string` | BCP 47 target language code |
| `created` | `string` | ISO 8601 creation date |
| `license` | `string` | SPDX license identifier |
| `provenance` | `string[]` | Listahan ng provenance tags na ginamit sa mga entry |

### Mga Field ng Entry

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `integer` | ✅ | Natatanging entry identifier sa loob ng corpus |
| `source` | `string` | ✅ | Ang source text na isasalin |
| `reference` | `string` | ✅ | Ang gold-standard reference translation |
| `difficulty` | `integer` | ✅ | Difficulty tier 1–5 (tingnan sa ibaba) |
| `provenance` | `string` | ✅ | Pinagmulan ng entry na ito (hal., `gold_standard`, `textbook`, `elicited`) |
| `register` | `string` | ✅ | Antas ng register/formality (hal., `conversational`, `formal`, `ceremonial`) |
| `context` | `string` | ✅ | Communicative function (hal., `greeting`, `declaration`, `instruction`) |
| `notes` | `string` | ❌ | Opsyonal na context para sa human reviewers |
| `morphological_analysis` | `string` | ❌ | Gold-standard morphological breakdown |
| `variant_class` | `string` | ❌ | Class label na nagpapangkat ng katanggap-tanggap na translation variants |

---

## Mga Available na Dataset

Ang katalogo ay binubuo ng **~4,700 fetch-from-source na evaluation dataset sa 19 na pamilya ng corpus**, kasama ang dalawang human-curated na reference dataset (EDTeKLA + FLORES) na detalyado sa ibaba — isang kabuuang **5,601 dataset** sa registry noong 2026-09-06. Ang bawat corpus ay isang **sha-pinned na metadata card** — ang nilalaman ng corpus ay hindi kailanman hino-host dito; deterministiko itong muling binubuo mula sa naka-pin na upstream archive nito sa oras ng ebalwasyon. Ang lahat ng dataset ay may dalang `do_not_train`. Ang isang source card ay nagsasanga sa maraming per-pair na dataset, kaya ang kabuuan sa registry ay lumalagpas sa ~1,417 source card; ang mga open-lane na dataset ay direktang nagpapakain sa sweep queue; ang research-only na lane ay tumatakbo kapag hinihiling (on demand) kung saan malinaw itong pinapayagan ng lisensya nito (ang mga binago/bespoke/hindi tinukoy na grant ay consent-gated para sa remote model-API evaluation).

| Pamilya | Mga Dataset | Tagabuo / pinagmulan | Lisensya | Lane |
|---------|------------:|----------------------|----------|------|
| **TICO-19** | 1,260 | TICO-19 Consortium (CMU, JHU, GMU, Amazon, Appen, Facebook, Google, Microsoft, Translated, TWB) | CC0-1.0 | open |
| **IN22** (Conv + Gen) | 1,012 | AI4Bharat / IIT Madras | CC-BY-4.0 | open (HF-gated na pag-download) |
| **Tatoeba** | 874 | [Komunidad ng Tatoeba](https://tatoeba.org), sa pamamagitan ng Tatoeba Challenge | CC-BY-2.0 | open |
| **GlobalVoices** | 493 | Global Voices / OPUS | CC-BY-3.0 | open |
| **SMOL** (doc + sent) | 490 | Google (SMOL) | CC-BY-4.0 | open |
| **WMT newstest / General** (mga blind set ng 2014–2025) | 178 | WMT (Conference on Machine Translation), sa pamamagitan ng sacreBLEU | `LicenseRef-WMT-Research-Use` | **paggamit sa pananaliksik** |
| **ALT** | 156 | NICT / ALT Project | CC-BY-4.0 | open |
| **Turkic-x-WMT** | 90 | Turkic Interlingua (til-mt) | MIT | open |
| **WMT24++** | 55 | Google / Unbabel | Apache-2.0 | open |
| **MAFAND-MT** | 40 | Masakhane NLP | CC-BY-NC-4.0 | **non-commercial / research-only** |
| **NusaX** | 22 | IndoNLP | CC-BY-SA-4.0 | open (share-alike) |
| **NusaTranslation** | 20 | IndoNLP | `LicenseRef-NusaWrites-Unstated-Data-License` | **research-only** |
| **LoResMT** (2020 + 2021) | 10 | LoResMT Workshop (mga tagapag-organisa ng shared-task) | CC-BY-NC-SA-4.0 | **non-commercial / research-only** |
| **AmericasNLP 2021** | 9 | AmericasNLP Shared Task (mga tagapag-organisa) | `LicenseRef-AmericasNLP-Mixed-ResearchUse` | **research-only** |
| **Gamayun** | 8 | CLEAR Global (dating Translators without Borders) | `LicenseRef-TWB-Gamayun` | **non-commercial / research-only** |
| **NICT-SAP** | 8 | SAP SE | CC-BY-NC-4.0 | **non-commercial / research-only** |
| **EDTeKLA / prize** | 2 | EdTeKLA Research Group, University of Alberta | LicenseRef-EdTeKLA-Modified-CC-BY-NC-SA-4.0 | **naka-quarantine: hindi kailanman maaaring patakbuhin o iranggo** |
| **BSD** | 2 | Tsuruoka Lab, University of Tokyo | CC-BY-NC-SA-4.0 | **non-commercial / research-only** |
| **MENYO-20k** | 2 | Masakhane / Saarland University (uds-lsv) | CC-BY-NC-4.0 | **non-commercial / research-only** |

*(Ang FLORES+ devtest — 870 nakatalang pares, CC-BY-SA-4.0 — ay ang reference na dataset na detalyado sa ibaba, na nagdadala sa kabuuan ng registry sa 5,601.)*

:::info[Ang non-commercial na research-only lane]
Karamihan sa katalogo ay may permisibong lisensya (CC0, CC-BY-2.0/3.0/4.0, MIT,
Apache-2.0) at magagamit sa bawat lane. Ang isang maliit na pangkat — **Gamayun** (bespoke
na lisensya ng TWB) at **EDTeKLA** (isang binago at may saklaw sa soberanya na CC BY-NC-SA) — ay **non-commercial**:
ibinukod ito sa anumang commercial, prize, o API path. Para sa mga corpus sa ilalim ng
mga binago, bespoke, o hindi tinukoy na grant, ang remote model-API evaluation ay
karagdagan ding **consent-gated**: tatanggi ang harness na ipadala ang kanilang teksto sa
mga third-party model API maliban kung ang mismong teksto ng lisensya ay nagbibigay ng pahintulot para sa paggamit sa ebalwasyon
(naitala bilang isang tahasang desisyon bawat dataset — ang mga WMT research-use set
ay mayroong ganito) o ang tahasang pahintulot ng may-ari ng karapatan ay naitala sa
entry ng dataset (nananatiling posible ang lokal na ebalwasyon). Ang pagiging kwalipikado ay **nakabatay sa paggamit**: mahigpit ang commercial lane,
maluwag ang research lane, at palaging nangingibabaw ang quarantine (ang mga corpus ng EdTeKLA ay
direktang naka-quarantine, at tatanggihan ng database ang anumang iskor na ipo-post laban sa mga ito). Tingnan ang
[Pagpaparehistro ng mga Corpus at Exposure Lane](/docs/network/sovereignty/registering-corpora) para sa
kung paano pumipili ng sarili nitong lane ang isang corpus.
:::

Idinetalye sa ibaba ang mga reference dataset; sinusunod ng family corpora ang parehong
JSON schema at nakalista ang mga ito sa dataset registry.

:::note[Ang catalogue ay hindi isang populated board]
Ang malaking corpus catalogue ay kung saan *maaaring* i-benchmark ang mga method — hindi ito
isang leaderboard na puno ng mga resulta. Nagsisimula pa lamang ang seeding ng mismong board; tingnan ang
[mga panuntunan ng leaderboard](/docs/network/leaderboard/rules) at
[Matapat na mga Limitasyon](/docs/network/honest-limitations).
:::

### EDTeKLA Development Set v1 {#edtekla-development-set-v1}

Ang unang evaluation dataset, na binuo para sa English→Plains Cree (SRO) translation. Ginawa ng [EdTeKLA research group](https://spaces.facsci.ualberta.ca/edtekla/) sa University of Alberta.

| Katangian | Halaga |
|-----------|--------|
| **ID** | `eval-eng-crk-edtekla-dev-v1` (at `eval-eng-crk-edtekla-textbook`) |
| **Version** | `1.0` |
| **Pares ng wika** | EN → CRK (Plains Cree, ortograpiyang SRO) |
| **Bilang ng entry** | 436-entry dev split (`textbook_dev.json`). Chain: 589 raw na nakalinyang linya upstream → 486 natatanging wastong pares pagkatapos ng normalisasyon/dedup (isang bilang na hinango ng Champollion) → 436 dev + 50 held-out (deterministikong seed-42 split ng Champollion — inilalathala ng EdTeKLA ang mga raw file, hindi ang isang split). Ang isang hiwalay na 62-entry gold-standard set (hand-curated, research-only, **hindi** materyal ng EdTeKLA) ay nagdadala sa pinagsamang koleksyon ng eval ng Plains Cree ng proyekto sa 548. |
| **Distribusyon ng kahirapan** | Madali, Katamtaman, Mahirap |
| **Pinagmulan** | `gold_standard` (beripikado ng mga tagapagsalita), `textbook` (mga nailathalang materyal na pang-edukasyon) |
| **Lisensya** | [Binagong CC BY-NC-SA ng EdTeKLA](https://github.com/EdTeKLA/IndigenousLanguages_Corpora) (`LicenseRef-EdTeKLA-Modified-CC-BY-NC-SA-4.0` — may saklaw sa soberanya; ang pinagmulang aklat-aralin ay CC BY-NC-ND 4.0) — **naka-quarantine**: nakatala ngunit hindi kailanman maaaring patakbuhin, at tatanggihan ng database ang anumang iskor na ipo-post laban dito; ibinukod sa leaderboard, prize, at mga commercial/API lane (non-commercial) |

> **Ito ang kanonikal na pahayag ng mga bilang ng eval-set ng Plains Cree.** Ang iba pang
> mga pahina ay nagli-link dito sa halip na ulitin ang mga ito. Ang mga bilang na 486/436/50 ay
> hinango ng Champollion mula sa mga raw na nakalinyang file ng EdTeKLA (ang EdTeKLA mismo ay hindi
> naglalathala ng mga bilang o split); ang 62-entry na gold-standard set ay may hiwalay at hindi galing sa EdTeKLA
> na pinagmulan. Ang bilang sa itaas ay palaging ipinapares sa lane nito: ang EdTeKLA ay may dalang binago at
> may saklaw sa soberanya na CC BY-NC-SA at **ibinukod mula sa leaderboard, mga premyo, at sa
> commercial/API path**.

**Ano ang sinusubok nito:**

- Mga pangunahing pagbati at karaniwang parirala
- Noun animacy at obviation
- Verb conjugation sa iba’t ibang person at tense
- Locative constructions
- Possessive paradigms
- Complex sentence structures

:::tip[Istruktura ng corpus]
Ang materyal na hinango mula sa EdTeKLA ay nahahati sa isang pampublikong dev set at isang held-out set (ang split ng Champollion sa raw na pagkakahanay ng aklat-aralin ng EdTeKLA — ang mga bilang ay nasa talahanayan sa itaas). Ang hiwalay na 62-entry na gold-standard set ay manu-manong na-curate mula sa iba pang mga pinagmulan at hindi bahagi ng corpus ng EdTeKLA. Ang isang mas maliit at may mataas na kalidad na dataset na may mga beripikadong gold standard ay mas kapaki-pakinabang kaysa sa isang malaki at maingay (noisy) na dataset — lalo na para sa isang low-resource na wika kung saan ang mga salin na "halos tama" ay kadalasang imbalido ayon sa morpolohiya.
:::

---

## Paggawa ng Bagong Dataset

Upang gumawa ng dataset para sa bagong language pair o domain:

### 1. Istrukturahin ang JSON

Sundin ang schema ng [Format ng Dataset](#dataset-format). Dapat mayroon ang bawat entry ng `source`, `reference`, `difficulty`, `provenance`, `register`, at `context`.

### 2. Magtalaga ng natatanging ID

Gumamit ng descriptive slug: `{project}-{split}-v{version}` (hal., `edtekla-dev-v1`, `quechua-test-v1`).

### 3. I-verify ang gold standards

Dapat ma-verify ang bawat value ng `reference` ng fluent speaker o makuha mula sa published, peer-reviewed resource. Sinasalungat ng machine-generated references ang layunin ng ebalwasyon.

### 4. Itakda ang difficulty tiers

Magtalaga sa bawat entry ng integer difficulty level:

| Tier | Description | Examples |
|------|-------------|----------|
| 1 — Basic vocabulary | Mga iisang salita, karaniwang pagbati, numero | "hello" → "tânisi" |
| 2 — Simple sentences | Subject-verb o SVO, present tense | "I see the dog" |
| 3 — Moderate complexity | Past/future tense, possessives, animacy | "I saw his dog yesterday" |
| 4 — Complex morphology | Obviation, passive voice, conjunct order | "the woman whose son went to the store" |
| 5 — Advanced | Multi-clause, formal register, ceremonial, idiomatic | Buong talata na may tono na angkop sa register |

### 5. Mag-tag ng provenance

Dapat ipahiwatig ng bawat entry kung saan ito nagmula. Mga karaniwang tag:

- `gold_standard` — Beripikado ng fluent speakers
- `textbook` — Mula sa published educational materials
- `elicited` — Ginawa sa pamamagitan ng structured elicitation sessions
- `corpus` — Kinuha mula sa parallel corpus

### 6. I-validate ang file

Patakbuhin ang harness laban sa inyong dataset gamit ang anumang model upang i-verify na maayos ang pagkaka-form ng JSON at naroon ang lahat ng required fields:

```bash
mt-eval run --corpus path/to/your-dataset.json --dry-run
```

Mag-e-error ang harness sa mga nawawalang field, duplicate indices, o schema violations.

### 7. Isumite para sa inclusion

Magbukas ng pull request laban sa [eval harness repository](https://github.com/gamedaysuits/Champollion) na nagdaragdag ng **fetch-from-source metadata card** — isang registry entry na nagtuturo sa harness sa upstream source (loader/URL, SHA pin, license, at provenance). **Huwag kailanman i-commit ang mismong content ng corpus.** Hindi nagho-host o sumusubaybay ang Champollion ng third-party corpus text; kinukuha ng harness ang references mula sa upstream source sa run time at nagsi-score laban sa bagong-kuhang data. Mag-validate muna nang lokal (step 6), pagkatapos ay ang card lamang ang isumite. Isama ang dokumentasyon ng inyong verification methodology at provenance sources.

---

## FLORES+ Devtest

Isang broad-coverage multilingual benchmark na pinananatili ng [Open Language Data Initiative (OLDI)](https://huggingface.co/datasets/openlanguagedata/flores_plus). Ginagamit para sa mga multi-model frontier comparison ng Champollion.

| Property | Value |
|----------|-------|
| **ID** | Isang card bawat pair: `eval-flores-devtest-v1-<src>-<tgt>` (hal. `eval-flores-devtest-v1-amh-fra`) |
| **Language pairs** | 870 nakatala sa catalog at runnable pairs (812 sa mga ito ay nasa pagitan ng dalawang non-English language) |
| **Entry count** | 1,012 pangungusap bawat pair |
| **License** | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) |
| **Source** | Meta FLORES-200, ngayon ay pinananatili ng OLDI — kinukuha mula sa source, SHA-pinned bawat pair (hindi kailanman tina-track dito ang corpus content) |
| **Contamination** | **HIGH** — relative-only, test / illustration only (tingnan ang note) |

:::warning[HIGH-contamination — relative-only, hindi kailanman absolute benchmark]
Ang FLORES+ ay pampubliko at web-crawled na data na malamang ay nakita na ng frontier models.
Pinapatakbo ito ng Champollion sa isang **relative-only** lane: magagamit upang paghambingin
nang head-to-head ang mga method, ngunit **hindi kailanman iniuulat bilang absolute-quality score**, at **hindi kailanman
ginagamit bilang chain edge** sa [translation map](https://champollion.dev).
Ito ay para sa **testing at illustration lamang**.
:::

:::danger[Para lamang sa evaluation]
Ang FLORES+ ay inilaan lamang para sa evaluation. Tahasang hinihiling ng mga curator na **huwag itong gamitin bilang training data**. Tiyaking hindi kasama ang nilalaman nito sa anumang training corpora.
:::

---

## Tingnan Din

- [MT Evaluation](/docs/network/leaderboard/rules) — pangkalahatang-ideya ng evaluation framework at leaderboard
- [Eval Harness](/docs/network/specifications/harness) — kung paano magpatakbo ng mga ebalwasyon laban sa mga dataset na ito
- [Run Card Specification](/docs/network/specifications/run-card) — ang JSON schema para sa pagtatala ng mga resulta
- [Method Leaderboard](https://champollion.dev/leaderboard) — live benchmark scores
- [EdTeKLA Project](https://spaces.facsci.ualberta.ca/edtekla/) — ang research group ng University of Alberta sa likod ng Cree dataset
