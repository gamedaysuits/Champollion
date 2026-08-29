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

> **Buod ng Tagapagpaganap.** Inilalarawan ng pahinang ito ang mga evaluation dataset na magagamit para sa benchmarking, kabilang ang corpus entry schema, mga antas ng kahirapan (1–5), at mga kinakailangan sa pinagmulan (provenance). Ang katalogo ay may **~4,700 na fetch-from-source evaluation dataset sa 19 na pamilya ng corpus** (TICO-19, IN22, Tatoeba, GlobalVoices, SMOL, ALT, Turkic-x-WMT, WMT24++, ang WMT newstest/General blind sets 2014–2025, MAFAND-MT, NusaX, NusaTranslation, LoResMT, AmericasNLP 2021, NICT-SAP, BSD, MENYO-20k, Gamayun, EdTeKLA) kasama ang FLORES+ — ang *nilalaman* ng corpus ay hindi kailanman naka-host dito; ang bawat dataset ay isang sha-pinned metadata card na deterministikong binubuo muli mula sa naka-pin nitong upstream archive. Ang isang **non-commercial / research-only lane** (Gamayun, EdTeKLA, MAFAND-MT, NusaTranslation, LoResMT, AmericasNLP, NICT-SAP, BSD, MENYO-20k, at ang mga WMT research-use set) ay hindi kasama sa anumang commercial / prize / API path; sa loob nito, ang mga corpus na nasa ilalim ng binago (modified), pasadya (bespoke), o hindi nakasaad na mga pahintulot ay karagdagang **consent-gated** — tatanggi ang remote model-API evaluation maliban kung ang mismong teksto ng lisensya ay nagbibigay ng pahintulot sa paggamit para sa evaluation (naitala bilang isang tahasang desisyon sa bawat dataset, tulad ng sa mga WMT research-use set) o ang pahintulot ng may hawak ng karapatan ay naitala sa dataset entry. Ang dalawang human-curated reference dataset — EDTeKLA Dev v1 (Plains Cree) at FLORES+ Devtest (870 na nakatalang pares ng wika, 1,012 pangungusap bawat isa) — ay nakadetalye sa ibaba; ang buong breakdown ng bilang ng entry ng EdTeKLA ay nakasaad nang isang beses, sa [seksyon nito](#edtekla-development-set-v1).

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

Ang katalogo ay may **~4,700 na fetch-from-source evaluation dataset sa 19 na pamilya ng
corpus**, kasama ang dalawang human-curated reference dataset (EDTeKLA + FLORES)
na nakadetalye sa ibaba — isang kabuuang registry na **5,602 dataset** simula noong 2026-07-12. Ang bawat
corpus ay isang **sha-pinned metadata card** — ang nilalaman ng corpus ay hindi kailanman naka-host dito;
ito ay deterministikong binubuo muli mula sa naka-pin nitong upstream archive sa oras ng
evaluation. Ang lahat ng dataset ay may dalang `do_not_train`. Ang isang source card ay nahahati sa maraming
per-pair dataset, kaya ang kabuuan ng registry ay lumampas sa ~1,417 na source card; ang
mga open-lane dataset ay direktang nagpapakain sa sweep queue; ang research-only lane ay tumatakbo
on demand kung saan malinaw na pinahihintulutan ito ng lisensya nito (ang mga binago/pasadya/hindi nakasaad na
pahintulot ay consent-gated para sa remote model-API evaluation).

| Pamilya | Mga Dataset | Tagabuo / pinagmulan | Lisensya | Lane |
|--------|---------:|------------------|---------|------|
| **TICO-19** | 1,260 | TICO-19 Consortium (CMU, JHU, GMU, Amazon, Appen, Facebook, Google, Microsoft, Translated, TWB) | CC0-1.0 | open |
| **IN22** (Conv + Gen) | 1,012 | AI4Bharat / IIT Madras | CC-BY-4.0 | open (HF-gated download) |
| **Tatoeba** | 874 | [Tatoeba community](https://tatoeba.org), sa pamamagitan ng Tatoeba Challenge | CC-BY-2.0 | open |
| **GlobalVoices** | 493 | Global Voices / OPUS | CC-BY-3.0 | open |
| **SMOL** (doc + sent) | 490 | Google (SMOL) | CC-BY-4.0 | open |
| **WMT newstest / General** (2014–2025 blind sets) | 178 | WMT (Conference on Machine Translation), sa pamamagitan ng sacreBLEU | `LicenseRef-WMT-Research-Use` | **research use** |
| **ALT** | 156 | NICT / ALT Project | CC-BY-4.0 | open |
| **Turkic-x-WMT** | 90 | Turkic Interlingua (til-mt) | MIT | open |
| **WMT24++** | 55 | Google / Unbabel | Apache-2.0 | open |
| **MAFAND-MT** | 40 | Masakhane NLP | CC-BY-NC-4.0 | **non-commercial / research-only** |
| **NusaX** | 22 | IndoNLP | CC-BY-SA-4.0 | open (share-alike) |
| **NusaTranslation** | 20 | IndoNLP | `LicenseRef-NusaWrites-Unstated-Data-License` | **research-only** |
| **LoResMT** (2020 + 2021) | 10 | LoResMT Workshop (mga organizer ng shared-task) | CC-BY-NC-SA-4.0 | **non-commercial / research-only** |
| **AmericasNLP 2021** | 9 | AmericasNLP Shared Task (mga organizer) | `LicenseRef-AmericasNLP-Mixed-ResearchUse` | **research-only** |
| **Gamayun** | 8 | CLEAR Global (dating Translators without Borders) | `LicenseRef-TWB-Gamayun` | **non-commercial / research-only** |
| **NICT-SAP** | 8 | SAP SE | CC-BY-NC-4.0 | **non-commercial / research-only** |
| **EDTeKLA / prize** | 3 | EdTeKLA Research Group, University of Alberta | LicenseRef-EdTeKLA-Modified-CC-BY-NC-SA-4.0 | **non-commercial / research-only (quarantined)** |
| **BSD** | 2 | Tsuruoka Lab, University of Tokyo | CC-BY-NC-SA-4.0 | **non-commercial / research-only** |
| **MENYO-20k** | 2 | Masakhane / Saarland University (uds-lsv) | CC-BY-NC-4.0 | **non-commercial / research-only** |

*(FLORES+ devtest — 870 catalogued pair, CC-BY-SA-4.0 — ang reference
dataset na nakadetalye sa ibaba, na nagdadala sa kabuuang registry sa 5,602.)*

:::info[Ang non-commercial research-only lane]
Karamihan sa katalogo ay may maluwag na lisensya (CC0, CC-BY-2.0/3.0/4.0, MIT,
Apache-2.0) at magagamit sa bawat lane. Ang isang maliit na set — **Gamayun** (pasadyang
lisensya ng TWB) at **EDTeKLA** (isang binago at sovereignty-scoped na CC BY-NC-SA) — ay **non-commercial**: ito ay
inihiwalay mula sa anumang commercial, prize, o API path. Para sa mga corpus na nasa ilalim ng
binago, pasadya, o hindi nakasaad na mga pahintulot, ang remote model-API evaluation ay
karagdagang **consent-gated**: tatanggi ang harness na ipadala ang kanilang teksto sa
mga third-party model API maliban kung ang mismong teksto ng lisensya ay nagbibigay ng pahintulot sa paggamit para sa evaluation
(naitala bilang isang tahasang desisyon sa bawat dataset — ang mga WMT research-use set
ay mayroon nito) o ang tahasang pahintulot ng may hawak ng karapatan ay naitala sa
dataset entry (posible pa rin ang lokal na evaluation). Ang pagiging karapat-dapat ay **use-based**: ang commercial lane ay mahigpit,
ang research lane ay maluwag, at ang quarantine ay palaging nananaig (kaya ang mga hindi wastong EdTeKLA
slice ay hindi kailanman makakapag-rank). Tingnan ang
[Pagpaparehistro ng mga Corpus at Exposure Lane](/docs/network/sovereignty/registering-corpora) para sa
kung paano pinipili ng isang corpus ang lane nito.
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
|----------|-------|
| **ID** | `edtekla-dev-v1` |
| **Bersyon** | `1.0` |
| **Pares ng wika** | EN → CRK (Plains Cree, SRO orthography) |
| **Bilang ng entry** | 436-entry dev split (`textbook_dev.json`). Chain: 589 raw aligned lines upstream → 486 unique valid pairs pagkatapos ng normalization/dedup (isang bilang na nagmula sa Champollion) → 436 dev + 50 held-out (deterministikong seed-42 split ng Champollion — inilalathala ng EdTeKLA ang mga raw file, hindi ang split). Ang isang hiwalay na 62-entry gold-standard set (hand-curated, research-only, **hindi** materyal ng EdTeKLA) ay nagdadala sa pinagsamang koleksyon ng Plains Cree eval ng proyekto sa 548. |
| **Distribusyon ng kahirapan** | Madali, Katamtaman, Mahirap |
| **Pinagmulan** | `gold_standard` (na-verify ng mga tagapagsalita), `textbook` (mga inilathalang materyal na pang-edukasyon) |
| **Lisensya** | [Binagong CC BY-NC-SA ng EdTeKLA](https://github.com/EdTeKLA/IndigenousLanguages_Corpora) (`LicenseRef-EdTeKLA-Modified-CC-BY-NC-SA-4.0` — sovereignty-scoped; ang root textbook ay CC BY-NC-ND 4.0) — **inihiwalay mula sa leaderboard, prize, at commercial/API lanes** (non-commercial) |

> **Ito ang kanonikal na pahayag ng mga bilang ng Plains Cree eval-set.** Ang ibang
> mga pahina ay nagli-link dito sa halip na ulitin ang mga ito. Ang mga bilang na 486/436/50 ay
> nagmula sa Champollion mula sa mga raw aligned file ng EdTeKLA (ang EdTeKLA mismo ay walang inilalathalang
> mga bilang o split); ang 62-entry gold-standard set ay may hiwalay at hindi EdTeKLA na
> pinagmulan. Ang bilang sa itaas ay palaging ipinapares sa lane nito: Ang EdTeKLA ay may dalang binago,
> sovereignty-scoped na CC BY-NC-SA at **inihiwalay mula sa leaderboard, mga premyo, at ang
> commercial/API path**.

**Ano ang sinusubok nito:**

- Mga pangunahing pagbati at karaniwang parirala
- Noun animacy at obviation
- Verb conjugation sa iba’t ibang person at tense
- Locative constructions
- Possessive paradigms
- Complex sentence structures

:::tip[Istruktura ng corpus]
Ang materyal na nagmula sa EdTeKLA ay nahahati sa isang pampublikong dev set at isang held-out set (ang split ng Champollion sa raw textbook alignment ng EdTeKLA — ang mga bilang ay nasa talahanayan sa itaas). Ang hiwalay na 62-entry gold-standard set ay hand-curated mula sa ibang mga source at hindi bahagi ng EdTeKLA corpus. Ang isang mas maliit at mataas na kalidad na dataset na may mga na-verify na gold standard ay mas kapaki-pakinabang kaysa sa isang malaki at maingay na dataset — lalo na para sa isang low-resource na wika kung saan ang mga "close enough" na pagsasalin ay kadalasang hindi wasto sa morpolohiya.
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
