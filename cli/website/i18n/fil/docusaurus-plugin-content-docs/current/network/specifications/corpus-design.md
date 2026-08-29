---
sidebar_position: 7
title: "Balangkas para sa Disenyo ng Corpus"
---

# Balangkas sa Disenyo ng Corpus para sa Pagsusuri

Kapag sinusuri po ninyo ang isang frontier model sa FLORES+ at nakakuha ito ng iskor na 85 chrF++, hindi po ninyo matutukoy ang pagkakaiba ng "magaling magsalin ang model" sa "isinaulo ng model ang mga partikular na pares ng pangungusap na ito." Ang nag-iisang kalabuan na iyon ang dahilan kung bakit umiiral ang framework na ito: may halaga lamang pong buuin ang isang evaluation corpus kung ang mga iskor nito ay nangangahulugan ng kung ano ang sinasabi ng mga ito, at nangangailangan po iyon ng sinadyang disenyo — mga bagong pares, nasusubaybayang pinagmulan, pinag-uri-uring mga domain, at nakahanay na antas ng kahirapan. Ang pahinang ito po ang source of truth kung paano dinidisenyo, binubuo, at pinapanatili ang mga evaluation dataset ng Champollion.

> **Bersyon:** 1.0 · **Katayuan:** Draft · Kasama: isinasagawa po ng workflow ng [Corpus Partnership](/docs/network/specifications/corpus-partnership) ang metodolohiyang ito kasama ang isang research department.

---

## 1. Mga Prinsipyo ng Disenyo

### 1.1 — Bakit Hindi Mga Pampublikong Benchmark?

Available ang mga pampublikong parallel corpus (FLORES+, Tatoeba, WMT test sets, OPUS) para sa development at debugging ngunit **hindi isinasama sa opisyal na pagsusuri ng leaderboard**. Payak ang dahilan:

**Kontaminasyon.** Ang mga frontier LLM ay sinanay sa napakalalaking web scrape. Anumang parallel text na umiral na sa publiko — lalo na sa mga na-curate at malawakang binabanggit na benchmark dataset — ay malamang na nasa kanilang training data. Hindi po ito isang teoretikal na alalahanin — [ipinakita ng pananaliksik](https://arxiv.org/abs/2311.04850) ang nasusukat na epekto ng kontaminasyon sa mga MT benchmark. (Tumatakbo pa rin po rito ang mga pampublikong benchmark — ngunit sa isang lane lamang ng *relative-comparison* na maaaring mag-rank ng mga pamamaraan laban sa isa't isa, at hindi kailanman bilang ganap na kalidad.)

Para sa Champollion, lubhang mahalaga po ito dahil:
- Pinaghahambing ng leaderboard ang mga pamamaraan ng LLM, mga klasikong serbisyo ng MT, at mga purpose-built na sistema nang magkakatabi
- Ang aming value proposition ay *tapat at mahigpit na pagsusuri*
- Ang aming mga target na user (mga komunidad ng wika) ay gumagawa ng mga desisyon sa pag-deploy batay sa mga iskor na ito

### 1.2 — Mga Pangunahing Kinakailangan

Dapat matugunan ng bawat evaluation corpus ng Champollion ang mga sumusunod:

| Kinakailangan | Batayan |
|-------------|-----------|
| **Gawa ng tao** | Walang synthetic data. Dapat isinulat ng tao ang lahat ng source text at reference translations. Maaaring tumulong ang mga LLM sa alignment at formatting ngunit hindi kailanman dapat bumuo ng content. |
| **Hindi pampublikong available sa parallel form** | Maaaring pampubliko ang source text; maaaring pampubliko ang reference translations; ngunit ang partikular na *pagkakapares* ay hindi dapat umiiral bilang nada-download na parallel corpus. |
| **May sinusubaybayang provenance** | Dapat may dokumentadong pinagmulan ang bawat entry: source document, translator, license, petsa. |
| **May batayang lingguwistiko** | Dapat ginagabayan ng mga typological feature ang coverage, hindi random sampling. |
| **Naka-stratify ayon sa domain** | Dapat sumaklaw ang mga entry sa mga tinukoy na text domain na may kontroladong representasyon. |
| **Naka-tier ayon sa hirap** | Dapat italaga ang mga entry sa difficulty tiers (1–5) batay sa structural complexity. |
| **Version-controlled** | Content-hashed ang mga bersyon ng corpus. Maihahambing lamang ang mga score sa loob ng parehong bersyon. |
| **Maaaring repasuhin ng komunidad** | Dapat maaaring repasuhin ng mga miyembro ng komunidad ng wika ang reference translations. |

### 1.3 — Neutralidad sa Uri ng Corpus, Haba, at Estilo

Ang Champollion ay isang bukas na translation-evaluation hub na **neutral kung ano ang isang translation unit**. Ang isang corpus entry ay text na may anumang haba — isang maikling pangungusap, isang mahabang pangungusap na may maraming clause, isang talata, o isang buong dokumento — at pare-pareho itong sinusuri ng platform. **Walang limitasyon sa maikli o madaling text.** Walang ipinapataw na length cap ang harness (sadyang nagtatakda ito ng maluwag na output token headroom upang maiwasan ang pagkaputol ng mahahabang salin); ang difficulty tiers (§3) at domains (§2.1) ay *configurable axes*, hindi mga gate na nagbubukod sa mahirap o mahabang materyal.

Neutral at configurable ang hub sa mga sumusunod:

| Axis | Saklaw |
|------|-------|
| **Granularity** | pangungusap · long-form na pangungusap · talata · dokumento (`sizeUnit: entries \| sentences \| segments \| documents`) |
| **Haba at complexity** | maikli → mahaba; simple → lubhang complex (difficulty tiers 1–5) |
| **Estilo at register** | formal, informal, technical, literary, conversational, administrative (domain taxonomy, §2.1) |
| **Pamamaraan** | anumang `TranslationMethod` — LLM, neural NMT, rule-based, hybrid, human |
| **Wika at pares** | anumang directed pair; walang high-resource bias na nakapaloob |

Idinedeklara ng corpus ang sarili nitong uri, granularity, register, at difficulty sa card nito, at sinusunod ng harness ang anumang idinedeklara ng card. Ang default na mga **development** corpus na galing sa Tatoeba ay maiikling pangungusap dahil ganoon ang Tatoeba — katangian iyon ng mga source corpus na iyon, **hindi** limitasyon ng platform. First-class ang document-level at long-form evaluation sets; irehistro ang mga ito sa parehong paraan (at, hal., para sa napakahahabang entry, mag-configure ng mas maliit na request batch).

---

## 2. Pagpili ng Source Text

### 2.1 — Domain Taxonomy

Sinusuri ng Champollion ang pagsasalin para sa **praktikal na deployment contexts**, hindi mga akademikong ehersisyo. Tinatag ang bawat corpus entry ng domain mula sa **canonical 16-code domain taxonomy**, na vina-validate sa panahon ng construction.

Isang beses lamang tinutukoy ang taxonomy — sa [Benchmark Specification §2.7](/docs/network/specifications/benchmark#27-domain), ang pinag-iisang sanggunian — at hindi na inuulit dito upang maiwasan ang drift. Ang mga code ay: `conv`, `ecommerce`, `edu`, `financial`, `gov`, `legal`, `literary`, `marketing`, `medical`, `news`, `religious`, `scientific`, `subtitles`, `support`, `tech`, at `ui`. Tingnan ang §2.7 para sa paglalarawan ng bawat code at karaniwang consumers. Huwag magpakilala ng mga domain code sa labas ng set na iyon.

### 2.2 — Distribusyon ng Domain

Dapat layunin ng isang standard evaluation corpus ang pagkalat sa mga domain na pinaka-kaugnay sa target na komunidad. Nag-iiba ang eksaktong mga code at porsiyento ayon sa pares ng wika; ang talahanayan sa ibaba ay isang *halimbawang* target distribution, gamit ang canonical codes mula sa §2.1:

| Domain | Code | Target % | Batayan |
|--------|------|----------|-----------|
| Software UI | `ui` | 25% | Pangunahing deployment context para sa mga user ng champollion CLI |
| Government / administrative | `gov` | 15% | High-stakes na pagsasalin na may legal na implikasyon |
| Educational | `edu` | 15% | Pangunahing use case para sa pagpapasigla ng wika |
| Literary / narrative | `literary` | 10% | Sinusubok ang kultural na nuance at literary register |
| Conversational | `conv` | 10% | Sinusubok ang informal register at natural na pattern ng pananalita |
| Technical | `tech` | 10% | Sinusubok ang precision at consistency ng terminology |
| Medical / health | `medical` | 10% | High-stakes, sinusubok ang domain-specific vocabulary |
| News / journalistic | `news` | 5% | Sinusubok ang kontemporaryong vocabulary at neutral na register |

### 2.3 — Pamantayan sa Pagpili ng Source

Kapag pumipili ng source texts para sa bagong corpus:

1. **License compatibility.** Dapat nasa ilalim ng license ang source text na nagpapahintulot ng paggamit sa isang evaluation corpus. Mas mainam ang CC BY, CC BY-SA, o public domain. Idokumento ang license.

2. **Recency.** Mas mainam ang mga text na inilathala sa loob ng nakaraang 10 taon. Nagbabago ang wika — lalo na ang vocabulary tungkol sa teknolohiya, pamamahala, at medisina.

3. **Pagkakaiba-iba ng register.** Sa loob ng bawat domain, humanap ng mga text sa iba’t ibang antas ng formality. Ang government press release (formal) at government social media post (informal) ay parehong nasa domain na `admin` ngunit magkaiba ang register.

4. **Kultural na kaugnayan.** Para sa mga Katutubo at minoryang wika, unahin ang mga text na mahalaga sa komunidad — mga dokumento sa land management, educational materials sa wika, mga text para sa cultural preservation — kaysa sa mga text na nagkataong umiiral sa parallel.

5. **Walang machine-translated sources.** Kung ang isang "parallel" document ay nilikha sa pamamagitan ng pagpapatakbo ng orihinal sa Google Translate at pagkatapos ay post-editing, HINDI ito katanggap-tanggap bilang reference translation. Dapat independent na human translation ang reference.

---

## 3. Difficulty Tier System

### 3.1 — Mga Depinisyon ng Tier

Itinatakda ang bawat entry sa difficulty tier (1–5) batay sa structural complexity ng *source text*, hindi sa hirap ng pagsasalin (na nag-iiba ayon sa pamamaraan).

| Tier | Label | Mga Structural Characteristic |
|------|-------|---------------------------|
| 1 | **Elementary** | Simpleng pangungusap. Isang clause. Present tense. Karaniwang vocabulary. Walang idiom. Walang embedded structures. |
| 2 | **Intermediate** | Compound sentences. Dalawang clause na pinag-uugnay ng conjunction. Past/future tense. Ilang domain vocabulary. |
| 3 | **Advanced** | Complex sentences. Subordinate clauses, relative clauses. Mixed tenses. Domain-specific terminology. Passive voice. |
| 4 | **Expert** | Maramihang embedded clauses. Legal/technical register. Conditional structures. Abstract concepts. Cultural references. |
| 5 | **Extreme** | Siksik na prosa na may maraming sabay-sabay na hamon: nested subordination, ambiguous pronoun reference, cultural idioms, mixed register, rare vocabulary. |

### 3.2 — Mga Difficulty Factor na May Batayang Lingguwistiko

Bukod sa structural complexity, naaapektuhan ang difficulty ng **typological distance** sa pagitan ng source at target language. Hinango ang mga factor na ito mula sa WALS typological features at classification data ng language card:

| Factor | Mababang Hirap | Mataas na Hirap |
|--------|---------------|-----------------|
| **Word order** | Parehong basic order (hal., SVO→SVO) | Magkaibang basic order (hal., SVO→SOV) |
| **Morphological type** | Magkatulad na type (hal., analytic→analytic) | Magkaibang type (hal., analytic→polysynthetic) |
| **Grammatical gender** | Parehong system o walang gender | Walang gender ang source, may complex gender ang target |
| **Honorific/register** | Walang register marking | May complex register system ang target (hal., Japanese, Korean) |
| **Script** | Parehong script | Magkaibang script (kailangan ng transliteration) |
| **Animacy** | Walang animacy distinction | May animacy-based agreement ang target (hal., Cree) |
| **Evidentiality** | Walang evidentiality | Gramatikal na minamarkahan ng target ang information source |

### 3.3 — Distribusyon ng Tier

Dapat magkaroon ang isang standard corpus ng humigit-kumulang:

| Tier | Target % | Batayan |
|------|----------|-----------|
| 1 | 15% | Nagtatatag ng baseline — dapat kayanin ito kahit ng mahihinang pamamaraan |
| 2 | 25% | Pang-araw-araw at praktikal na pagsasalin |
| 3 | 30% | Kung saan nakikita ang pagkakaiba ng kalidad ng pamamaraan |
| 4 | 20% | Ibinubukod ang mahuhusay na pamamaraan sa napakahuhusay |
| 5 | 10% | Ceiling test — iilang pamamaraan lamang ang makakahawak nito nang mahusay |

---

## 4. Kalidad ng Reference Translation

### 4.1 — Mga Kinakailangan sa Translator

Dapat gawin ang reference translations ng mga taong:

1. **Matatas na tagapagsalita** ng target language (L1 o katumbas)
2. **Literate** sa parehong source at target language
3. **May kamalayan sa domain** para sa domain ng text (medical translator para sa health texts, atbp.)
4. **Independent** — hindi dapat magkaroon ng access ang translator sa anumang MT output para sa parehong text habang nagsasalin

### 4.2 — Translation Brief

Tumatanggap ang bawat translator ng brief na kinabibilangan ng:

- Ang **register** na gagamitin (formal, conversational, atbp.)
- Ang **target audience** (general public, specialists, children, atbp.)
- Anumang **terminology conventions** na partikular sa komunidad ng wika
- Tahasang tagubilin: "Isalin ang kahulugan, hindi ang mga salita. Mas mahalaga ang natural pakinggang salin kaysa sa literal."

### 4.3 — Quality Assurance

1. **Dual translation.** Pinakamainam na may dalawang independent reference translations ang bawat entry mula sa magkaibang translator. Kung hindi ito posible, unahin ang dual translation para sa Tiers 4–5.

2. **Community review.** Dapat repasuhin ang reference translations ng hindi bababa sa isang karagdagang tagapagsalita na hindi gumawa ng salin.

3. **Acceptable variants.** Para sa bawat reference, idokumento ang mga kilalang acceptable variants (word order, orthographic conventions, dialectal forms). Pinapakain ng mga ito ang metric na `equivalent_match_rate`.

### 4.4 — Ano ang Nagpapasama sa Reference

| Problema | Bakit Pinawawalang-bisa Nito ang Pagsusuri |
|---------|------------------------------|
| Machine-translated pagkatapos ay post-edited | Pinananatili ng post-editing ang MT structure; pinaparusahan ang mga pamamaraang gumagawa ng mas natural na salin |
| Isinalin ng learner, hindi ng matatas na tagapagsalita | Maaaring may mga error ang reference na nagpaparusa sa tamang MT output |
| Masyadong literal | Mababa ang score ng natural na salin laban sa literal na references |
| Iisang valid interpretation para sa ambiguous source | Pinaparusahan ang valid na alternative interpretations |

---

## 5. Pag-iwas sa Kontaminasyon

### 5.1 — Ang Contamination Threat Model

| Banta | Paglalarawan | Mitigation |
|--------|-------------|------------|
| **Training data overlap** | Nasanay ang mga LLM sa parallel corpus | Huwag ilathala sa publiko ang parallel corpus |
| **Few-shot leakage** | Ginagamit ng method author ang eval entries bilang few-shot examples | Fingerprint-check: natutukoy at naf-flag ang mga entry sa prompt |
| **Indirect contamination** | Umiiral ang source text sa LLM training data (monolingual) | Katanggap-tanggap — inaasahan ang monolingual source text. Dapat bago ang *pagkakapares*. |
| **Crowd contamination** | Ibinabahagi ng community reviewers ang mga entry sa publiko | Ipinagbabawal ng license terms ang muling pamamahagi ng parallel corpus |

### 5.2 — Mga Tier ng Corpus Secrecy

| Tier | Visibility | Gamit |
|------|-----------|-----|
| **Public development set** | Ganap na pampubliko | Method development, debugging, regression testing. HINDI inilalathala sa leaderboard ang mga score. |
| **Held-out evaluation set** | Nakikita ang source text, lihim ang references | Opisyal na pagsusuri ng leaderboard. Tumatanggap ang mga pamamaraan ng source text at nagbabalik ng salin; nangyayari ang scoring server-side. Hindi kailanman inilalantad ang references sa pamamaraan. |
| **Gold-standard set** | Ganap na lihim, kontrolado ng komunidad | Community-validated evaluation. Pinamamahalaan ng governance organization. Ginagamit para sa verification tier na "Community Validated". |

### 5.3 — Rotation Policy

Dapat **i-rotate** ang evaluation corpora nang pana-panahon:

1. Pagkatapos gamitin ang isang corpus sa loob ng 12 buwan, simulan ang paggawa ng kapalit
2. I-retire ang lumang corpus sa status na "development set" (public)
3. I-promote ang bagong corpus sa "held-out evaluation set"
4. Pinipigilan nito ang unti-unting kontaminasyon sa pamamagitan ng iterative optimization laban sa fixed target

---

## 6. Workflow sa Pagbuo ng Corpus

### 6.1 — Step-by-Step na Proseso

```
Step 1: Language Pair Selection
    └─ Identify target language, read language card
    └─ Review typological features (WALS), contact influences, scripts
    └─ Identify which difficulty factors apply

Step 2: Source Text Curation
    └─ Identify candidate source documents per domain
    └─ Verify licenses
    └─ Extract candidate sentences/segments
    └─ Classify by domain and preliminary difficulty tier

Step 3: Segment Selection
    └─ Sample segments to match domain distribution (§2.2)
    └─ Sample segments to match difficulty distribution (§3.3)
    └─ Ensure linguistic phenomenon coverage (§6.2)
    └─ Target minimum corpus size (§6.3)

Step 4: Reference Translation
    └─ Assign segments to qualified translators
    └─ Provide translation brief
    └─ Collect translations
    └─ Dual-translate Tier 4–5 entries

Step 5: Quality Assurance
    └─ Community review of references
    └─ Document acceptable variants
    └─ Flag and resolve disagreements

Step 6: Metadata & Packaging
    └─ Assign final difficulty tiers
    └─ Add provenance metadata per entry
    └─ Content-hash the corpus for versioning
    └─ Package as corpus JSON per harness spec

Step 7: Registration
    └─ Register in Supabase datasets table
    └─ Add to ATTRIBUTION.md if new sources used
    └─ Document in arena website
```

### 6.2 — Coverage ng Linguistic Phenomenon

Dapat isama ng bawat corpus ang mga entry na sumusubok sa mga partikular na linguistic phenomenon na kaugnay sa pares ng wika. Hinango ang mga ito mula sa mga field na `linguisticChallenges` at `contactInfluences` ng language card:

**Universal phenomena (lahat ng pares ng wika):**
- Pronoun resolution (ambiguous antecedents)
- Negation (single, double, scope)
- Quantifiers (all, some, none, most)
- Temporal expressions (relative dates, durations)
- Named entities (people, places, organizations)
- Numbers and measurements
- Lists and enumeration

**Pair-specific phenomena (mula sa language card):**
- Para sa polysynthetic targets: complex verb morphology, incorporation
- Para sa gendered targets: gender agreement, neutral/inclusive reference
- Para sa SOV targets: clause-final verbs, postpositions
- Para sa tone languages: tone-dependent meaning distinctions
- Para sa honorific languages: register markers, social context
- Para sa contact languages: code-switching boundaries, loanword integration

### 6.3 — Minimum na Sukat ng Corpus

Nangangailangan ang statistical reliability ng minimum na bilang ng entry. Batay ang mga ito sa paired bootstrap confidence interval requirements (mula sa `significance.py`):

| Layunin | Minimum Entries | Recommended |
|---------|-----------------|-------------|
| Development set | 50 | 100–200 |
| Held-out evaluation set | 100 | 200–500 |
| Gold-standard set | 200 | 500+ |
| Per-domain minimum | 10 | 25+ |
| Per-tier minimum | 10 | 20+ |

**Bakit 100 ang minimum para sa evaluation?** Kapag mas kaunti sa ~100 entries, hindi maaasahang matutukoy ng paired bootstrap significance tests (1,000 resamples) ang mga pagkakaibang mas maliit sa ~5 chrF++ points. Sa 200+ entries, matutukoy natin ang ~2-point differences sa p<0.05.

---

## 7. Corpus JSON Format

Sinusunod ng bawat corpus entry ang harness specification:

```json
{
  "id": "edtekla-dev-v1-042",
  "source": "The school board will meet on Tuesday to discuss the new curriculum.",
  "reference": "ᑭᓯᑭᓄᐦᐊᒫᑐᐏᓐ ᑲ ᐃᔑ ᐱᒥᐸᔨᐦᑕᐦᒃ ᑭᔅᑭᓄᐦᐊᒫᑐᐏᓇ ᐁ ᐃᔑ ᒫᒥᑐᓀᔨᐦᑕᐦᒃ ᐅᔥᑭ ᑭᔅᑭᓄᐦᐊᒫᑫᐏᓂᔭ ᓂᔓ ᑭᔑᑲᐤ",
  "acceptable_variants": [
    "ᑭᔅᑭᓄᐦᐊᒫᑐᐏᓐ ᓂᔓ ᑭᔑᑲᐤ ᑲ ᐃᔑ ᒫᒥᑐᓀᔨᐦᑕᐦᒃ ᐅᔥᑭ ᑭᔅᑭᓄᐦᐊᒫᑫᐏᓂᔭ"
  ],
  "domain": "edu",
  "difficulty": 3,
  "phenomena": ["temporal_expression", "named_entity", "future_tense"],
  "provenance": {
    "source_doc": "EdTeKLA Module 4, Unit 7",
    "source_license": "LicenseRef-EdTeKLA-Modified-CC-BY-NC-SA-4.0",
    "translator": "anonymous-speaker-001",
    "translator_qualification": "L1 Plains Cree, certified translator",
    "translation_date": "2025-11-15",
    "reviewer": "anonymous-speaker-002",
    "review_date": "2025-12-01"
  }
}
```

---

## 8. Mga Anti-Gaming Measure

### 8.1 — Integridad ng Corpus

| Measure | Implementation |
|---------|----------------|
| **Content hashing** | Bersyon ng corpus = SHA-256 ng sorted entry IDs + references. Anumang pagbabago ay gumagawa ng bagong bersyon. |
| **Entry fingerprinting** | May content-derived ID ang bawat entry. Kung may magsumite ng results laban sa binagong corpus, hindi magtutugma ang fingerprint. |
| **Held-out enforcement** | Para sa opisyal na evaluation, source text LAMANG ang natatanggap ng mga pamamaraan. Hindi kailanman inilalantad ang references. Nangyayari ang scoring server-side. |
| **Rotation schedule** | Taunang ini-rotate ang corpora upang maiwasan ang long-term optimization laban sa fixed target. |

### 8.2 — Integridad ng Submission

| Measure | Implementation |
|---------|----------------|
| **Deterministic fingerprint** | Naka-hash ang run config (model, temperature, prompt, corpus version). Ang magkakaparehong config ay gumagawa ng magkakaparehong fingerprint. |
| **Cherry-pick detection** | Dapat ideklara ng submitters ang lahat ng runs, hindi lamang ang pinakamaganda. Naf-flag ang multiple submissions na may parehong fingerprint. |
| **Contamination check** | Kung lumitaw nang verbatim ang eval entries sa prompt o coaching data ng pamamaraan, disqualified ang submission. |

---

## 9. Mga Umiiral na Corpus

### 9.1 — EDTeKLA Development Set v1

| Katangian | Halaga |
|----------|-------|
| **ID** | `edtekla-dev-v1` |
| **Pares** | EN → CRK (Plains Cree, SRO) |
| **Mga Entry** | 436-entry dev split (`textbook_dev.json`). Ang buong breakdown po ay nakasaad nang isang beses sa [pahina ng Evaluation Datasets](/docs/network/leaderboard/datasets#edtekla-development-set-v1). |
| **Mga Domain** | Pang-edukasyon (100%) |
| **Mga Tier** | 1–5 (ang distribusyon ay TBD bawat entry audit) |
| **Lisensya** | Binagong CC BY-NC-SA ng EdTeKLA (`LicenseRef-EdTeKLA-Modified-CC-BY-NC-SA-4.0`, sovereignty-scoped) — **inihiwalay mula sa leaderboard, premyo, at mga commercial/API lane** (non-commercial) |
| **Katayuan** | Development set (pampubliko) |

**Mga limitasyon:** Iisang domain (educational lamang). Walang domain stratification. Maaaring kailangang i-audit ang tier assignments. Nililimitahan ng maliit na sukat ng corpus ang statistical power para sa significance testing.

### 9.2 — Mga Planong Corpus

| Corpus | Pair | Status | Owner |
|--------|------|--------|-------|
| EN → TL (Filipino) na pasadyang corpus | EN → TL | Planned | Project owner |
| EN → CRK held-out set | EN → CRK | Future (kailangan ng community partner) | Community governance org |

---

## 10. Integrasyon ng Language Card

Nag-iintegrate ang corpus framework sa language card system:

1. **Domain selection** ay ginagabayan ng `linguisticChallenges` ng card — kung may natatanging hamon ang isang wika (polysynthesis, tone, animacy), dapat magsama ang corpus ng mga entry na sumusubok sa mga ito.

2. **Difficulty calibration** ay gumagamit ng `classification` ng card — naaapektuhan ng typological distance sa pagitan ng source at target families kung ano ang itinuturing na "mahirap."

3. **Register coverage** ay gumagamit ng `registers` ng card — kung may tinukoy na registers ang isang wika (formal-filipino, taglish-professional, taglish-casual), dapat magsama ang corpus ng mga entry sa bawat register level.

4. **Contact influence testing** ay gumagamit ng `contactInfluences` ng card — para sa mga wikang may mabibigat na borrowing layer (Filipino: Spanish + English + Arabic), magsama ng mga entry na sumusubok kung tama ang paghawak ng mga pamamaraan sa loanwords kumpara sa sobrang pagsasalin sa mga ito.

5. **Script handling** ay gumagamit ng `scripts[]` ng card — para sa multi-script languages (Serbian: Cyrillic + Latin), magsama ng mga entry na sumusubok sa tamang script selection.

---

## References

- **Champollion Scoring Specification** — tumutukoy sa lahat ng metrics, composite weights, quality tiers
- **Champollion Benchmark Specification** — evaluation protocol, corpus format, data sovereignty
- **WALS** (World Atlas of Language Structures) — typological features database
- **Glottolog** — language classification source of truth
- **ISO 639-3** — language identification standard
- **EdTeKLA** — source ng unang evaluation corpus

---

*Ang dokumentong ito ay isang buhay na specification. I-update ito habang may nabubuong bagong corpora at natututuhan ang mga aral.*
