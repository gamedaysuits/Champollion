---
sidebar_position: 9
title: "Estratehiya sa Pakikipagsosyo para sa Corpus"
slug: '/network/specifications/corpus-partnership'
---

# Estratehiya sa Corpus Partnership: Pagtatatag ng Evaluation Corpora sa Pamamagitan ng Academic Linguistics Departments

Ang pagbuo po ng isang *training* corpus para sa isang low-resource language ay nangangailangan ng daan-daang libong pares ng pangungusap — masyadong marami para suriin, kaya ang kalidad ay nag-iiba sa mga paraang walang nakakakita hanggang sa bumagsak ang isang model na sinanay gamit ang mga ito. Ang isang *evaluation* corpus po ay nangangailangan lamang ng ilang daang pares, na ang bawat isa ay sinusuri ng isang taong nakakaalam ng wika, at hindi po ito naluluma: bawat bagong model o method na lumalabas ay sinusukat laban dito. Ang dokumentong ito po ay ang workflow para sa pagbuo ng ikalawang iyon, na higit na mas murang bagay — ang kaisa-isang deliverable kung saan ang kadalubhasaan ng isang departamento ay umaabot sa bawat isang pangungusap — at para sa kung ano ang mangyayari pagkatapos: kapag mayroon na pong nakalatag na evaluation standard, ang isang [posted prize](/docs/network/specifications/prizes) ay ginagawang isang target ang inyong wika na maaaring asintahin ng sinumang method builder sa mundo, at sinusukat ng public leaderboard ang bawat pagtatangka.

> **Layunin.** Ang kumpletong workflow para sa pagtatatag ng isang machine translation evaluation corpus sa pamamagitan ng pakikipagsosyo sa isang linguistics department: kung ano ang ibinibigay ng departamento, kung ano ang dapat na hitsura ng corpus, kung paano ito cryptographically sealed, kung paano gumagana ang sandbox evaluation, at kung ano ang nakukuha ng departamento bilang kapalit. Ito po ang dokumentong dadalhin ninyo sa isang pulong kasama ang isang potensyal na academic partner.
>
> **Audience.** Mga department head, principal investigator, research coordinator, at mga direktor ng Indigenous language program sa mga unibersidad na may aktibong language documentation o mga NLP program.
>
> **Mga kasamang dokumento:**
> - [Corpus Design Framework](/docs/network/specifications/corpus-design) — ang metodolohiya sa likod ng wasto at maaasahang mga evaluation corpora
> - [Prize Specification](/docs/network/specifications/prizes) — ang kalahati ng insentibo: pag-post ng premyo laban sa inyong sealed set
> - [Registering Corpora](/docs/network/sovereignty/registering-corpora) — kung paano sumasali ang isang corpus sa Network nang hindi umaalis sa inyong mga kamay
> - [Speaker Validation Protocol](/docs/network/specifications/speaker-validation) — ang hiling para sa mga bilingual speaker na *markahan* ang mga umiiral na pagsasalin (quality rating, linter validation, FST review)
> - [Benchmark Specification](/docs/network/specifications/benchmark) — ang buong technical spec para sa mga corpora, run card, at mga evaluation protocol
> - [Data Sovereignty](/docs/network/sovereignty/data-sovereignty) — Mga prinsipyo ng Indigenous data sovereignty, CARE, at kung bakit mahalaga ang paglipat ng pagmamay-ari

---

## 1. Ano ang Nalilikha ng Partnership na Ito

Isang **sealed evaluation corpus**: isang curated set ng parallel text pairs (source language → target language) na nagiging ground truth para sa pagsukat ng kalidad ng machine translation. Sinusubok ang mga method laban sa corpus na ito sa isang sandbox — hindi kailanman nakikita ng developers ang test data.

Lumilikha ang partnership ng tatlong artifact:

| Artifact | Ano Ito | Sino ang Kumokontrol Dito |
|----------|-----------|-----------------|
| **Development corpus** | 100–200+ public parallel text pairs para sa method development | Inilalathala nang bukas (CC BY-NC-SA 4.0 o katumbas) |
| **Gold-standard test set** | 50–150 secret parallel text pairs para sa official evaluation | Community governance org (cryptographically sealed) |
| **Diagnostic test suite** | 10–50 targeted contrastive pairs na sumusubok sa partikular na linguistic phenomena | Inilalathala nang bukas |

Sa kabuuan, iyan po ay 160–400 na pares — isang corpus na talagang kayang i-curate ng isang research group sa propesyonal na pamantayan, kumpara sa daan-daang libo na kakailanganin ng isang training corpus. Ang development corpus po ay nagbibigay-daan sa sinuman na bumuo ng mga translation method. Tinitiyak ng gold-standard set na ang mga method na iyon ay tapat na nasusubok. Ang diagnostic suite ay nakakahuli ng mga partikular na failure mode (hal., "kaya ba ng system na ito na hawakan ang obviation?").

---

## 2. Ano ang Kailangang Gawin ng Department

### Phase 1: Corpus Design (2–4 na linggo, oras ng researcher)

**Lead:** PI o postdoc na may expertise sa target language.

1. **Pumili ng source material domains.** Pumili ng 4–6 na real-world domains kung saan talagang kailangan ng language community ang translation. Sinusuportahan ng aming taxonomy ang 16 domains (tingnan ang Benchmark Spec §2.7):

   | Priority | Domain | Bakit |
   |----------|--------|-----|
   | 🔴 High | `edu` — Educational | Textbooks, curricula — direktang pangangailangan ng community |
   | 🔴 High | `gov` — Government | Band council documents, policy — praktikal na pang-araw-araw na pangangailangan |
   | 🔴 High | `medical` — Health | Clinic intake forms, health info — safety-critical |
   | 🟡 Medium | `conv` — Conversational | Pang-araw-araw na pananalita — nagtatatag ng baseline fluency |
   | 🟡 Medium | `legal` — Legal | Rights documents, treaties — kahalagahan sa community |
   | 🟢 Lower | `literary` — Literary/Cultural | Stories, oral histories — cultural preservation |

2. **Bumuo ng corpus design document** na nagtatakda ng:
   - Target size bawat segment (development, gold_standard, diagnostic)
   - Difficulty tier distribution (tingnan ang §3.3 sa ibaba)
   - Register at domain coverage
   - Source sentence selection criteria (walang synthetic text, hindi Bible-only)
   - Speaker recruitment plan

3. **Isumite sa amin ang design para sa review.** Iva-validate namin ito laban sa corpus schema (Benchmark Spec §2) at magbabalik ng feedback sa loob ng 1 linggo.

### Phase 2: Source Sentence Creation (4–8 linggo, oras ng speaker)

**Lead:** Research coordinator na nakikipagtulungan sa bilingual speakers.

1. **Gumawa o pumili ng source sentences** sa kabuuan ng mga planadong domain at difficulty tiers. Maaaring manggaling ang sources sa:
   - Kasalukuyang published bilingual materials (textbooks, government documents)
   - Bagong elicited sentences na idinisenyo upang saklawin ang partikular na linguistic phenomena
   - Inangkop mula sa real-world documents (band council agendas, clinic forms, educational materials)

2. **Dapat taglay ng bawat source sentence ang:**
   - Domain tag (mula sa 16-code taxonomy)
   - Register tag (conversational, formal, technical, ceremonial, educational)
   - Context tag (greeting, declaration, question, instruction, narrative, label, error)
   - Tinatayang difficulty tier (1–5, tingnan ang §3.3)
   - Provenance tag (textbook, elicited, corpus, gold_standard)

3. **Isalin ang bawat source sentence** sa target language, na isinasagawa ng bilingual speakers. Mahalaga ang multiple reference translations bawat entry ngunit hindi ito kinakailangan.

4. **Opsyonal, magdagdag ng morphological analysis** para sa bawat reference translation:
   - Interlinear gloss (morpheme-by-morpheme breakdown)
   - FST tag string (kung may FST para sa wika)
   - Translator notes tungkol sa dialectal variants, ambiguity, o cultural context

### Phase 3: Quality Assurance (2–4 na linggo)

**Lead:** Linguist na may target language expertise.

1. **Cross-review.** Dapat suriin ang bawat translation ng hindi bababa sa isang karagdagang bilingual speaker na hindi gumawa ng orihinal na translation. Tinitingnan ng reviewer:
   - Accurate ba ang translation?
   - Natural ba itong pakinggan?
   - Tama ba ang difficulty rating?
   - Mayroon bang katanggap-tanggap na variants na dapat itala?

2. **Patakbuhin sa aming schema validator.** Magbibigay kami ng script na nagva-validate ng corpus laban sa entry schema (Benchmark Spec §2.2). Tinitingnan nito:
   - Naroon ang required fields
   - Valid ang domain codes
   - Ang difficulty tiers ay integers 1–5
   - Walang duplicate IDs
   - Character encoding (UTF-8 NFC normalization)

3. **Kung may FST para sa wika,** patakbuhin dito ang reference translations. Dapat FST-valid ang bawat salita sa reference. Ang mga salitang hindi valid (loanwords, neologisms, proper nouns) ay dapat idokumento sa isang allowlist.

### Phase 4: Segmentation and Sealing (1 linggo, aming engineering)

**Lead:** Champollion team, may review ng department.

1. **Stratified split.** Hinahati namin ang corpus sa mga segment gamit ang deterministic random sampling (nakadokumento ang seed, reproducible):

   | Segment | Target Size | Access |
   |---------|------------|--------|
   | `development` | 60% ng entries (min 100) | Public |
   | `gold_standard` | 30% ng entries (min 50) | Secret, sealed |
   | `held_out` | 10% ng entries (min 10) | Secret, sealed, hindi kailanman gagamitin hanggang ma-activate |

   Pinananatili ng split ang difficulty tier distribution (stratified sampling) upang ang bawat segment ay may proportional representation sa lahat ng tiers.

2. **Cryptographic sealing** ng gold_standard at held_out segments:

   ```
   1. SHA-256 hash of each entry (source + reference + metadata)
   2. SHA-256 hash of the complete segment file
   3. Segment file encrypted with AES-256-GCM
   4. Encryption key split using Shamir Secret Sharing (2-of-3 threshold)
   5. Key shares distributed to:
        - Share 1: Community governance organization
        - Share 2: Academic department partner
        - Share 3: Champollion project (escrow)
   6. Hash manifest published to a public commit (proves the corpus existed
      at a specific time without revealing its contents)
   ```

3. **Ang development segment** ay kino-commit sa public repository at inilalathala nang may buong licensing.

4. **Ang diagnostic segment** ay public din — sinusubok nito ang partikular na linguistic phenomena (tingnan ang §3.4).

### Phase 5: Integration and Launch (1–2 linggo, aming engineering)

1. **Harness configuration.** Idinadagdag namin ang wika sa evaluation harness:
   - Language card ginawa o na-verify
   - Corpus nairehistro sa dataset registry
   - LYSS metrics na-configure (LYSS-fst kung may FST, LYSS-eq kung may linter rules)
   - Default scoring profile napili (Profile A kung may FST, Profile B kung wala)

2. **Baseline benchmark.** Nagpapatakbo kami ng 12-model sweep laban sa development segment upang mapunan ang leaderboard ng initial scores.

3. **Public announcement.** Lumilitaw ang wika sa Network leaderboard na may live development-segment benchmark. Kinikilala ang department bilang corpus partner.

---

## 3. Ano ang Dapat na Anyo ng Corpus

### 3.1 Format

Ang bawat corpus file ay isang JSON document na sumusunod sa schema sa Benchmark Spec §2.1–§2.2:

```json
{
  "dataset": {
    "id": "crk-ualberta-v1",
    "version": "1.0",
    "language_pair": "EN→CRK",
    "source_language": "en",
    "target_language": "crk",
    "created": "2026-09-15",
    "license": "CC-BY-NC-SA-4.0",
    "provenance": ["textbook", "elicited", "gold_standard"]
  },
  "entries": [
    {
      "id": 1,
      "source": "I see the dog",
      "reference": "niwâpamâw atim",
      "segment": "development",
      "difficulty": 2,
      "provenance": "textbook",
      "register": "conversational",
      "context": "declaration",
      "domain": "edu",
      "morphological_analysis": "ni-wâpam-âw atim | 1sg-see.TA-3sg.DIR dog.AN",
      "notes": "Animate noun (atim); direct form because speaker is proximate"
    }
  ]
}
```

### 3.2 Minimum Size Requirements

| Segment | Minimum Entries | Recommended |
|---------|----------------|-------------|
| `development` | 100 | 200–300 |
| `gold_standard` | 50 | 100–150 |
| `diagnostic` | 10 | 30–50 |
| `held_out` | 10 | 20–30 |
| **Total** | **170** | **350–530** |

### 3.3 Difficulty Distribution

Dapat isama ng corpus ang entries sa lahat ng limang difficulty tiers, na mas nakatuon sa tiers 2–4:

| Tier | Description | Target Distribution |
|------|-------------|-------------------|
| 1 — Basic vocabulary | Iisang salita, karaniwang pagbati, mga numero | 10–15% |
| 2 — Simple sentences | SVO, present tense | 25–30% |
| 3 — Moderate complexity | Past/future tense, possessives, animacy | 30–35% |
| 4 — Complex morphology | Obviation, passive, conjunct order, relative clauses | 15–20% |
| 5 — Advanced | Multi-clause, formal register, ceremonial, idiomatic | 5–10% |

### 3.4 Diagnostic Test Suite

Sinusubok ng diagnostic segment ang partikular na linguistic phenomena gamit ang **contrastive pairs**: isang tamang translation at isang minimally-different na maling translation. Kung mas mataas ang score na ibinibigay ng metric ng system sa tamang translation, pumapasa ang test.

Para sa polysynthetic languages, dapat target ng diagnostic suite ang:

| Phenomenon | Example (Cree) | What It Tests |
|-----------|----------------|--------------|
| **Animacy agreement** | atim (AN) vs. maskisin (IN) — magkaibang verb forms | Alam ba ng system kung aling nouns ang animate? |
| **Obviation** | Proximate vs. obviative third person | Nasusubaybayan ba nito ang third-person hierarchy? |
| **Inverse marking** | Direct vs. inverse verb forms | Nahahandle ba nito ang patient-outranks-agent? |
| **Conjunct/Independent** | Main clause vs. subordinate clause verb order | Ginagamit ba nito ang tamang verb paradigm? |
| **Inclusive/Exclusive** | "We (including you)" vs. "We (excluding you)" | Natutukoy ba nito ang pagkakaiba ng first-person plural forms? |

Para sa iba pang language families, tukuyin ang 3–5 pinaka-diagnostic na phenomena na naghihiwalay sa competent mula sa incompetent translation. Mahalaga rito ang linguistic expertise ng department — ito ang mga test na tanging isang specialist ang makaaalam kung paano isulat.

### 3.5 Ang HINDI Namin Gusto

| Anti-Pattern | Bakit |
|-------------|-----|
| **Bible-only text** | Archaic register, liturgical vocabulary, formulaic structure. Sinuri ng OMT-1600 ang 1,560 wika sa ganitong paraan — sinasadya naming iwasan ito. |
| **Synthetic evaluation pairs** | Pinawawalang-saysay ng LLM-generated references ang layunin ng evaluation. Dapat human-authored ang reference. |
| **Single-register corpora** | Puro formal, o puro conversational. Sumasaklaw ang real-world translation sa maraming registers. |
| **Difficulty-1-only** | Hindi translation ang sinusubok ng iisang salita at pagbati — vocabulary lookup ang sinusubok ng mga ito. |
| **Machine-translated references** | Circular ang paggamit ng output ng Google Translate bilang "reference". |
| **Sentences with no context tag** | Kailangan naming malaman ang communicative function para sa diagnostic analysis. |

---

## 4. Cryptographic Sealing at Sandbox Testing {#4-cryptographic-sealing-and-sandbox-testing}

### 4.1 Bakit Sine-seal ang Test Set?

Karaniwang inilalathala nang bukas ng conventional ML benchmarks ang test sets. Kapag nailathala na, kalaunan ay makakapagsanay dito ang frontier LLMs (sinadya man o sa pamamagitan ng web scraping), na ginagawang hindi maaasahan ang scores. Para sa Indigenous language data, may karagdagang pangamba: maaaring gamitin ang published linguistic data nang walang pahintulot ng community.

Tinitiyak ng sealing ang:
- **Test set integrity:** Hindi makapag-o-overfit ang methods sa data na hindi pa nila kailanman nakita
- **Data sovereignty:** Kinokontrol ng community kung sino ang makakapag-evaluate laban sa kanilang data
- **Perpetual freshness:** Hindi kailanman nagiging contaminated ang test set

### 4.2 Paano Gumagana ang Sandbox Testing

```
Developer workflow:
  1. Developer builds a translation method using the PUBLIC development corpus
  2. Developer tests locally against the development segment (unlimited, self-serve)
  3. When ready, developer submits their complete method (code + config + coaching data)
  4. Governance org installs the method in the evaluation sandbox
  5. Sandbox runs the method against the SEALED gold-standard test set
  6. Only scores are returned to the developer
  7. Developer never sees the source sentences or reference translations

The sandbox:
  - Runs on governance-controlled infrastructure
  - Has selective network access (LLM APIs only, no exfiltration)
  - Produces a tamper-proof run card (SHA-256 hash of all inputs and outputs)
  - Logs all execution for audit purposes
  - Can be inspected by the governance org at any time
```

### 4.3 Key Management

Hinahati ang encryption key para sa sealed test set gamit ang Shamir Secret Sharing na may 2-of-3 threshold:

| Share Holder | Role | Revocation Power |
|-------------|------|-----------------|
| **Community governance org** | Primary custodian | Maaaring mag-revoke ng evaluation access nang unilateral |
| **Academic department partner** | Co-custodian | Maaaring lumahok sa key reconstruction |
| **Champollion project** | Escrow | Hindi kayang i-access ang data nang mag-isa; tinitiyak ang continuity kung maging unavailable ang ibang parties |

Anumang 2 sa 3 shares ay makakapag-reconstruct ng key. Ibig sabihin nito:
- Maa-access ng community + department ang data nang walang Champollion
- Maa-access ng community + Champollion ang data nang wala ang department
- HINDI KAILANMAN maa-access ng Champollion lamang ang data

### 4.4 Hash Manifests

Kapag na-seal ang corpus, isang **hash manifest** ang inilalathala sa isang public Git commit:

```json
{
  "corpus_id": "crk-ualberta-v1",
  "seal_date": "2026-09-15T00:00:00Z",
  "segments": {
    "development": {
      "entry_count": 200,
      "sha256": "a3f7c...",
      "access": "public"
    },
    "gold_standard": {
      "entry_count": 100,
      "sha256": "b8d2e...",
      "access": "sealed",
      "key_scheme": "shamir-2-of-3"
    },
    "held_out": {
      "entry_count": 20,
      "sha256": "c9e4f...",
      "access": "sealed",
      "key_scheme": "shamir-2-of-3"
    },
    "diagnostic": {
      "entry_count": 30,
      "sha256": "d1a3b...",
      "access": "public"
    }
  },
  "total_entries": 350,
  "manifest_sha256": "e2b5c..."
}
```

Pinatutunayan nito na:
- Umiiral ang corpus sa isang partikular na petsa
- May kilalang size at structure ito
- Anumang modification sa sealed segments ay sisira sa hash chain
- Mave-verify ng community na hindi napakialaman ang kanilang data

---

## 5. Ano ang Matatanggap ng Department

### 5.1 Research Infrastructure

| Asset | Description |
|-------|------------|
| **Evaluation harness** | Isang gumagana at tested na evaluation framework para sa kanilang wika — nakakatipid ng maraming buwan ng tool-building |
| **LYSS metrics** | Language-specific evaluation metrics (LYSS-fst, LYSS-eq, LYSS-sem) na naka-configure para sa kanilang wika — kung may FST at dictionary resources |
| **Leaderboard** | Isang public, live leaderboard na nagpapakita ng state of the art para sa kanilang language pair |
| **Baseline benchmark** | 12-model sweep na nagbibigay ng agarang, publishable baselines |
| **Diagnostic test suite** | Targeted tests para sa partikular na linguistic phenomena — reusable para sa ibang evaluations |

### 5.2 Publications

Sinusuportahan ng corpus construction at evaluation results ang maraming publications:

| Paper | Venue | Department Role |
|-------|-------|-----------------|
| Corpus construction methodology | LREC, ComputEL | Lead o co-author |
| Baseline evaluation results | ACL, EMNLP | Co-author |
| LYSS metric validation | WMT Metrics Shared Task | Co-author |
| Diagnostic test suite design | SIGMORPHON, NAACL | Lead o co-author |
| Language-specific NLP resources | Language-specific venues | Lead author |

### 5.3 Grant Positioning

Nagbibigay ang partnership ng konkretong outputs para sa grant proposals:

- "Open-source evaluation infrastructure for [language] MT" — demonstrable deliverable
- "Cryptographic data sovereignty for Indigenous linguistic data" — inaangkop ang established na mga framework ng Indigenous data sovereignty (CARE, Kaitiakitanga, TK Labels) sa MT evaluation; publishable
- "Community-governed benchmark with live leaderboard" — ongoing impact metric
- "Independent evaluation of OMT-1600 / Google Translate for [language]" — napapanahon, high-visibility

### 5.4 Community Impact

- Nagkakaroon ang language community ng **independent evaluation capability** — masusuri nila kung talagang gumagana para sa kanilang wika ang anumang MT system (Google, Meta, o custom)
- **Kinokontrol ng community ang test data** sa pamamagitan ng cryptographic key custody
- Anumang methods na napatunayan sa pamamagitan ng benchmark ay **naglilipat ng ownership** sa community (tingnan ang Benchmark Spec §8.3), na nagpapanatili ng lahat ng kikitain kailanman ng deployment — non-commercial ang Champollion at walang kinukuhang share

### 5.5 Ano ang Gastos para sa Department

| Component | Estimated Cost | Who Pays |
|-----------|---------------|----------|
| PI/postdoc time (design, oversight) | ~40 oras | Department (o grant-funded) |
| Speaker compensation (translation) | $2,500–6,000 | Grant-funded o Champollion-funded |
| Speaker compensation (review) | $500–1,500 | Grant-funded o Champollion-funded |
| Research coordinator time | ~20 oras | Department |
| **Engineering, infrastructure, harness** | **$0** | **Champollion project** |

Ibinibigay namin ang lahat ng engineering, harness configuration, LYSS metric setup, leaderboard integration, at ongoing infrastructure nang walang gastos sa department. Ang kontribusyon ng department ay linguistic expertise at access sa speakers.

---

## 6. Timeline

| Phase | Duration | Key Milestone |
|-------|----------|--------------|
| 1: Corpus Design | 2–4 na linggo | Design document approved |
| 2: Source Sentences + Translation | 4–8 linggo | Raw corpus completed |
| 3: Quality Assurance | 2–4 na linggo | Cross-reviewed, schema-validated |
| 4: Sealing | 1 linggo | Gold-standard sealed, hash manifest published |
| 5: Integration | 1–2 linggo | Language live sa leaderboard na may baselines |
| **Total** | **10–19 linggo** | **Live leaderboard na may sealed evaluation** |

---

## 7. Paano Magsimula {#7-how-to-get-started}

1. **Makipag-ugnayan sa amin** — [project email/contact]. Magse-schedule kami ng 30-minutong call upang talakayin ang inyong wika, available resources, at partnership logistics.

2. **Ibibigay namin ang:**
   - Dokumentong ito
   - Corpus schema at validation tools
   - Mga halimbawa mula sa aming kasalukuyang Cree (CRK) corpus
   - Isang draft corpus design template

3. **Ibibigay po ninyo:**
   - Isang PI o postdoc upang manguna sa gawaing linggwistiko
   - Access sa mga bilingual speaker (o isang plano upang i-recruit sila)
   - Impormasyon tungkol sa mga available na resource (FST, diksyunaryo, mga umiiral na corpora)
   - Pag-apruba ng institusyon para sa data governance (naaayon sa mga prinsipyo ng data sovereignty ng First Nations, o sa sariling framework ng komunidad)

4. **Magco-co-design tayo ng corpus** — domain selection, difficulty distribution, diagnostic tests, timeline, at budget.

5. **Magsisimula ang trabaho.** Magche-check in kami linggu-linggo. May buong autonomy ang department sa linguistic decisions; kami ang bahala sa lahat ng engineering.

---

## 8. Frequently Asked Questions

### "Mayroon na kaming parallel corpus. Maaari ba namin itong gamitin?"

Oo — kung may malinaw na provenance ang corpus, human-authored ito, at pinahihintulutan ng license ang paggamit sa evaluation. Tutulungan namin kayong i-format ito sa aming schema, magdagdag ng kulang na metadata, at i-integrate ito. Maaaring lubhang mapabilis ng existing corpora ang timeline (laktawan ang Phase 2 o bawasan ito tungo sa isang gap-fill exercise).

### "Wala kaming FST para sa aming wika."

Ayos lang iyon. Nangangailangan ang LYSS-fst (morphological validity) ng FST, ngunit gumagana ang harness kahit wala ito gamit ang Profile B weights (chrF++, BLEU, COMET, behavioral metrics). Kung may GiellaLT FST para sa kaugnay na wika, maaaring ma-adapt namin ito. Kung wala, pinahihintulutan pa rin ng corpus ang mahalagang evaluation — wala lamang morphological validity gate.

### "Gumagamit ang aming speakers ng non-Latin script."

Fully supported. Hinahandle ng corpus schema ang anumang Unicode script. Idinisenyo namin ito para sa SRO (Standard Roman Orthography) at syllabics para sa Cree, ngunit gumagana ang parehong infrastructure para sa Devanagari, Arabic script, CJK, Ethiopic, o anumang iba pang writing system.

### "Paano ang dialect variation?"

I-tag ito. Kasama sa corpus entry schema ang isang `notes` field para sa dialectal information. Kung maraming dialect ang kinakatawan, idokumento ang mga ito. Maaaring i-configure ang equivalence classes ng linter (LYSS-eq) upang tanggapin ang dialectal variants bilang equivalent. Maaaring isama ng diagnostic test suite ang dialect-specific contrasts.

### "Sino ang may-ari ng corpus?"

Ang language community, sa pamamagitan ng governance organization. Kinikilala ang department bilang research partner. Hawak ng Champollion ang isang escrow key share para sa operational continuity ngunit hindi nito maa-access ang sealed data nang mag-isa. Inilalathala ang development segment sa ilalim ng Creative Commons license na tinukoy ng community.

### "Paano kung gusto naming tumigil?"

Maaaring i-revoke ng community ang evaluation access anumang oras sa pamamagitan ng pagtangging i-reconstruct ang encryption key. Hindi kailanman nae-expose ang sealed data. Ang development segment, na nailathala na, ay nananatiling public sa ilalim ng license nito. Ang research outputs ng department (publications, presentations) ay mananatiling sa kanila anuman ang mangyari.

### "Paano kung wala pang governance organization?"

Maaari tayong magsimula sa Phases 1–3 (corpus design, creation, QA) nang walang governance org. Nangangailangan ang sealing (Phase 4) ng pagtukoy ng key custodian. Pansamantala, maaaring magsilbi ang department bilang co-custodian kasama ng Champollion project, na may pag-unawang ililipat ang custody sa community governance org kapag naitatag na ito.

---

## Appendix: Tagging vs. Corpus Construction

Saklaw ng dokumentong ito ang **corpus construction** — paglikha ng parallel text pairs na bumubuo sa evaluation ground truth. Ang tagging (morphological annotation, interlinear glossing, FST tag strings) ay hiwalay na gawain na nagpapayaman sa corpus ngunit hindi kinakailangan para sa basic evaluation.

| Activity | Required? | What It Enables |
|----------|-----------|-----------------|
| **Corpus construction** (dokumentong ito) | ✅ Required | Basic evaluation: chrF++, exact match, COMET, behavioral metrics |
| **FST coverage checking** | 🟡 Optional | LYSS-fst morphological validity metric **at** ang FST-derived `morphological_accuracy` (lemma-matched — walang annotation na kailangan; Scoring Spec §2.2) |
| **Morphological annotation** | 🟡 Optional | Magpapahintulot sa future *gold-validated* upgrade ng `morphological_accuracy`; walang kailangan ang FST-derived version (sa itaas) |
| **Linter equivalence rules** | 🟡 Optional | LYSS-eq equivalent match metric |
| **Semantic validator rules** | 🟡 Optional | LYSS-sem semantic validation metric |
| **Speaker quality ratings** | Separate activity | Metric validation (tingnan ang [Protocol sa Speaker Validation](/docs/network/specifications/speaker-validation)) |

Saklaw ng hiwalay na mga dokumento ang tagging at speaker validation at maaari silang magpatuloy kasabay ng o pagkatapos ng corpus construction.

