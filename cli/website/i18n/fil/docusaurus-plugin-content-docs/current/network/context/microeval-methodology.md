---
sidebar_position: 4
title: "Microeval: Ebalwasyong Partikular sa Wika para sa Machine Translation"
slug: '/network/context/microeval-methodology'
---

# Microeval: Mga Sukatan ng Pagsusuring Partikular sa Wika para sa Machine Translation

***Isang metodolohiya para sa pagbuo ng mga sukatan ng pagsusuri na iniangkop sa indibiduwal na mga wika gamit ang FSTs, dictionaries, at equivalence rules na kinurador ng linguist — at kung bakit kailangan ito ng larangan***

---

> *"Ang mga hangganan ng aking wika ay nangangahulugan ng mga hangganan ng aking mundo."*
> — Ludwig Wittgenstein, *Tractatus Logico-Philosophicus* (1921)

---

## Panimula

Dalawang dekada nang naghahanap ang komunidad ng pagsusuri ng machine translation ng mga universal metrics — mga panukat ng kalidad ng salin na gumagana sa lahat ng wika, lahat ng domain, lahat ng tipolohiya. Nakalikha ang paghahanap na ito ng kahanga-hangang mga tool: BLEU (Papineni et al., 2002), chrF++ (Popović, 2017), COMET (Rei et al., 2020), MetricX (Juraska et al., 2023). Para sa ~20 wikang nangingibabaw sa WMT shared tasks, gumagana ang mga tool na ito.

Para sa iba pang ~7,000 wika, hindi.

Iginigiit ng papel na ito na **ang paghahanap ng universal metrics, kapag inilapat sa low-resource at morphologically complex na mga wika, ay hindi lamang hindi kumpleto — ito ay maling paradigma**. Iminumungkahi namin ang **microeval**: isang metodolohiya para sa pagbuo ng mga sukatan ng pagsusuri na iniangkop sa indibiduwal na mga wika gamit ang pinakamahusay na available na mga linguistic tool — finite-state transducers, bilingual dictionaries, morphological analyzers, at equivalence rules na kinurador ng linguist.

Ang Microeval ay hindi isang metric. Isa itong *praktika* — isang sistematikong proseso para sa pagbuo ng evaluation infrastructure na nag-e-encode ng language-specific knowledge. Ang praktika ay lumilikha ng mga metric, na tinitipon namin sa ilalim ng framework name na **LYSS** (Linguistically-informed Yield & Structural Scoring). Ngunit ang kontribusyon ay ang metodolohiya, hindi ang anumang partikular na metric na nalilikha nito.

Ang dokumentong ito ay katuwang ng:
- [Pagsukat sa Hindi Masusukat](/docs/network/context/mt-evaluation-landscape) — ang survey ng evaluation landscape, na nagpoposisyon sa LYSS sa hanay ng umiiral na mga metric
- [Ang Scoring Specification](/docs/network/specifications/scoring) — ang technical spec para sa metric definitions, weights, at composite scoring
- [Ang Corpus Partnership Strategy](/docs/network/specifications/corpus-partnership) — ang praktikal na workflow para sa pagtatatag ng evaluation corpora

Inilalarawan ng mga dokumentong iyon kung *ano* ang LYSS at *saan* ito nababagay. Tinutugunan naman ng dokumentong ito ang mas malalalim na tanong: *Bakit* kinakailangan ang language-specific evaluation? *Paano* ninyo ito binubuo para sa isang bagong wika? At *sino* ang nagpapasya kung ano ang ituturing na "tama"?

---

## Bahagi 1: Bakit Nabibigo ang Universal Metrics sa Low-Resource Languages

### 1.1 Ang Universality Assumption

Bawat pangunahing MT evaluation metric mula noong BLEU ay nakasalalay sa isang implicit assumption: na ang mga *mekanismo* ng kalidad ng salin ay language-independent, kahit na magkakaiba ang mga *parameter*. Binibilang ng BLEU ang n-gram overlap. Binibilang ng chrF++ ang character n-gram overlap. Nagsasanay ang COMET ng regression model sa human judgments. Ipinapalagay ng lahat na ang signal structure — kung ano ang nagpapaganda sa isang salin — ay maaaring makuha ng isang language-agnostic algorithm, na maaari ring fine-tuned sa language-specific data.

Para sa high-resource European language pairs, sapat na gumagana ang assumption na ito. Ipinapakita ng WMT metrics shared tasks ang mataas na human correlation para sa English↔German, English↔Czech, English↔Chinese. Nagkakaiba ang mga metric sa edge cases, ngunit nagkakasundo sila sa distribution of quality.

Para sa polysynthetic languages tulad ng Plains Cree (nêhiyawêwin), gumuho ang assumption sa maraming antas:

**Morphological opacity.** Maaaring maglaman ang isang Cree verb ng kasingdaming impormasyon ng isang buong English clause. Ang salitang *nikî-wîcihâw* ("tinulungan ko siya") ay nag-e-encode ng person, number, animacy, direction, at tense sa iisang inflected form. Isang token ang nakikita ng n-gram metric; anim na morphemes ang nakikita ng morphological analyzer. Hindi kayang tukuyin ng surface metrics ang pagkakaiba sa pagitan ng isang wastong inflected verb at isang plausible-looking hallucination na lumalabag sa animacy agreement — pareho silang iisang token na may magkatulad na character length.

**Free word order.** May pragmatically free word order ang Cree (Wolfart, 1973, §3.2). Ang mga pangungusap na *atim niwâpamâw* at *niwâpamâw atim* ("nakikita ko ang aso") ay parehong grammatically correct — pragmatic ang pagpili, hindi syntactic. Anumang metric na nagpaparusa sa word-order divergence mula sa isang reference translation ay lilikha ng false negatives sa bawat gayong pares.

**Morphological equivalence.** May maraming valid orthographic representations ang Cree para sa parehong salita (SRO variants, progressive/vowel-length alternations). Ang mga saling *nikî-atoskân* at *nikî-atoskên* ay maaaring dialectally equivalent. Nakikita ng string-match metric ang dalawang magkaibang string; nakikita ng linguist ang parehong salita.

**Training data absence.** Nangangailangan ang neural metrics tulad ng COMET ng training data — human quality judgments sa translation pairs — upang matutunan kung ano ang ibig sabihin ng "maganda." Para sa Cree, hindi umiiral ang data na ito. Maaari pa ring maglabas ng scores ang COMET (bumabalik ito sa multilingual encoder nito), ngunit hindi pa nava-validate ang mga score na iyon laban sa quality judgments ng sinumang Cree-speaking human. Mga extrapolation ang mga ito mula sa European language patterns, na inilalapat sa isang wikang may pundamental na ibang estruktura.

### 1.2 Ang Paradox ng Low-Resource Evaluation

Lumilikha ito ng isang paradox:

> Ang mga wikang pinakanangangailangan ng machine translation ay mismong mga wikang pinakakaunti ang pagiging maaasahan ng pinakamahusay na evaluation tools.

Kung hindi natin masukat ang kalidad ng salin para sa mga wikang ito, hindi natin magagawa ang:
- Layuning paghahambing ng mga translation method
- Pagtukoy kung kailan nagha-hallucinate ang isang model ng plausible-looking nonsense
- Pagsubaybay kung umuunlad ba ang larangan
- Pananagot sa MT system providers para sa quality claims

Ang resulta ay isang **cascading failure**: walang training data → walang encoder coverage → walang validated evaluation → walang measurable progress → walang incentive na mamuhunan → walang training data.

Upang maputol ang siklong ito, kailangan ang mga evaluation method na hindi nakadepende sa mga resource na wala tayo (training data, human judgments at scale, fine-tuned neural encoders). Kailangan nito ng mga method na gumagamit sa mga resource na *mayroon* tayo.

### 1.3 Ano ang Mayroon Tayo

Para sa maraming low-resource languages, nakalikha ang mga dekada ng linguistic fieldwork ng mga tool at resource na higit na hindi napapansin ng MT evaluation community:

| Mapagkukunan | Mga Ibinibigay Nito | Saklaw |
|----------|-----------------|----------|
| **Finite-State Transducers (FSTs)** | Kumpletong pagsusuring morpolohikal — bawat wastong anyo ng salita sa wika | ~100+ na wika sa pamamagitan ng GiellaLT, Apertium, NRC |
| **Mga bilingguwal na diksiyonaryo** | Mga pagmamapa ng lemma-to-gloss | Daan-daang wika (Wolvengrey 2001 para sa Cree: humigit-kumulang 18,000–22,000 na entry depende sa edisyon at paraan ng pagbibilang) |
| **Mga morphological analyzer** | Part-of-speech tagging, lemmatization, pagbuo ng inflectional paradigm | Dose-dosenang wika na may iba't ibang saklaw |
| **Mga deskriptibong gramatika** | Mga panuntunang sumasaklaw sa agreement, ayos ng salita, animacy, obviation | Magagamit para sa karamihan ng mga naidokumentong wika |
| **Kadalubhasaan ng mga lingguwista** | Mga miyembro ng komunidad na nakatutukoy ng wasto laban sa hindi wastong mga pagsasalin | Umiiral ayon sa depinisyon para sa bawat buhay na wika |

Itinayo ang mga resource na ito ng computational linguists, field linguists, at mga language community sa loob ng mga dekada — madalas na walang koneksyon sa MT evaluation community. Ang FST para sa Plains Cree ay itinayo sa University of Alberta nina Antti Arppe at mga kasamahan bilang language documentation tool, hindi bilang evaluation metric. Ang GiellaLT infrastructure sa UiT ay itinayo para sa minority language technology, hindi para sa WMT shared tasks.

**Ang Microeval ay ang praktika ng pagbabagong-anyo ng mga umiiral na resource na ito tungo sa evaluation metrics.**

---

## Bahagi 2: Ang Microeval Methodology

### 2.1 Depinisyon

Ang **Microeval** ay isang sistematikong metodolohiya para sa pagbuo ng machine translation evaluation metrics na iniangkop sa isang partikular na wika, gamit ang language-specific linguistic tools at resources. Ang isang microeval suite ay:

1. **Nag-e-encode ng language-specific knowledge** na hindi kayang makuha ng language-agnostic metrics
2. **Gumagamit ng umiiral na linguistic infrastructure** (FSTs, dictionaries, grammars) sa halip na mangailangan ng bagong training data
3. **Lumilikha ng deterministic, interpretable scores** — bawat score ay maaaring masubaybayan pabalik sa isang partikular na linguistic judgment
4. **Idinisenyo ng linguists**, hindi lamang ng engineers — ang variant classes, equivalence rules, at validation logic ay sumasalamin sa linguistic expertise
5. **Sumusupplement sa halip na pumalit sa** universal metrics — pinupunan ng microeval ang mga puwang, hindi ang buong espasyo

### 2.2 Ang Three-Layer Architecture

Gumagana ang isang kumpletong microeval suite sa tatlong antas ng analysis, mula surface hanggang semantics:

| Layer | Tanong na Sinasagot | Tool na Ginagamit | LYSS Component |
|-------|------------------|-----------|----------------|
| **Morphological validity** | "Valid form ba sa wikang ito ang bawat salita?" | Finite-state transducer (FST) | LYSS-fst |
| **Linguistic equivalence** | "Katanggap-tanggap bang variant ng reference ang saling ito?" | Deterministic linter na may linguist-curated variant classes | LYSS-eq |
| **Semantic fidelity** | "Napapanatili ba ng saling ito ang kahulugan ng source?" | FST lemmatization + dictionary glosses + content-word overlap | LYSS-sem |

Ang mga layer na ito ay **cumulative, hindi alternative**. Kailangang pumasa ang isang salin sa lahat ng tatlo upang maituring na ganap na tama. Nabibigo ang isang hallucinated word sa Layer 1. Nahuhuli sa Layer 2 ang isang dialectal variant na tama ngunit naiiba sa reference. Nahuhuli sa Layer 3 ang isang salin na gumagamit ng valid words sa valid order ngunit iba ang kahulugan.

### 2.3 Paano Bumuo ng Microeval Suite para sa Bagong Wika

Inilalarawan ng seksyong ito ang step-by-step na proseso. Ginagamit namin ang Plains Cree (CRK) bilang worked example at nagge-generalize kung maaari.

#### Hakbang 1: Suriin ang Available Resources

Bago bumuo ng anuman, i-inventory kung ano ang umiiral:

| Resource | Kinakailangan para sa | Paano Ito Hanapin | Minimum Quality |
|----------|-------------|----------------|-----------------|
| FST | Layer 1 (LYSS-fst) | Tingnan ang GiellaLT, Apertium, NRC catalogs | Dapat tumanggap ng >90% ng valid word forms sa isang test corpus |
| Bilingual dictionary | Layer 3 (LYSS-sem) | Tingnan ang language documentation projects, Wiktionary, community resources | >5,000 entries na may lemma-to-gloss mappings |
| Descriptive grammar | Layer 2 (LYSS-eq) | Published grammars, theses, community-authored references | Dapat idokumento ang core morphological paradigms |
| Bilingual speakers | Lahat ng layer (validation) | Community contacts, university language programs | Minimum na 3 speaker para sa validation experiments |

**Kung walang FST:** Laktawan ang Layer 1. Gumagana ang suite sa Layers 2–3 lamang, o bumabalik sa universal metrics (Profile B sa LYSS scoring). Hindi ito ideal, ngunit mas mabuti kaysa wala.

**Kung walang dictionary:** Laktawan ang Layer 3 o gumamit ng reduced version gamit ang anumang vocabulary na available. Hindi kasing-kapaki-pakinabang ng 18,000-entry dictionary ang 500-entry dictionary, ngunit nagbibigay pa rin ito ng signal.

#### Hakbang 2: I-configure ang Morphological Validity Gate (LYSS-fst)

Kung available ang FST:

1. **I-install ang FST** gamit ang analyzer binary ng wika (HFST `.hfstol` format para sa GiellaLT)
2. **Magpatakbo ng coverage test** sa isang representative corpus: anong porsiyento ng tokens ang nakikilala ng FST?
3. **Bumuo ng allowlist** para sa inaasahang FST gaps: loanwords, proper nouns, neologisms, abbreviations
4. **Kuwentahin ang baseline false rejection rate** — ang porsiyento ng valid words na maling nire-reject ng FST
5. **Itakda ang scoring threshold** — sa ibaba ng anong FST acceptance rate natin ifa-flag ang isang salin bilang morphologically suspect?

Ang pangunahing metric ay `fst_acceptance_rate`: ang fraction ng output words na nakikilala ng FST. Ang rate na 0.85 ay nangangahulugang 85% ng mga salita ay valid Cree morphology; 15% ay invalid, loanwords, o FST coverage gaps.

**Kritikal na design decision:** Ang false rejection problem. Ire-reject ng FST na sinanay sa formal literary language ang valid colloquial forms. Ire-reject ng FST na may incomplete paradigm coverage ang valid ngunit rare inflections. Pinapagaan ito ng allowlist, ngunit hindi nito maaalis. *Ito ang dahilan kung bakit hindi sapat ang LYSS-fst lamang* — kailangang pagsamahin ito sa Layers 2 at 3.

#### Hakbang 3: Idisenyo ang Variant Classes (LYSS-eq)

Ito ang pinakanangangailangan ng linguistic expertise na hakbang, at hindi ito maaaring i-automate. Kailangang tukuyin ng isang linguist na may expertise sa target language:

**Anong uri ng mga pagkakaiba sa pagitan ng candidate translation at reference translation ang dapat ituring na "katanggap-tanggap"?**

Para sa Plains Cree, tinukoy namin ang anim na variant classes:

| Variant Class | Linguistic Basis | Halimbawa |
|--------------|-----------------|---------|
| `WORD_ORDER` | Pragmatically free word order (Wolfart 1973 §3.2) | *atim niwâpamâw* ≡ *niwâpamâw atim* |
| `ORTHOGRAPHIC` | SRO spelling variants, vowel-length alternation | *nikî-atoskân* ≡ *nikî-atoskên* |
| `OPTIONAL_PARTICLE` | Grammatically optional discourse particles | *êkwa nikî-atoskân* ≡ *nikî-atoskân* |
| `LEMMA_SYNONYM` | Dictionary-attested synonyms | *wâpamêw* ≡ *kanawâpamêw* (para sa "nakikita") |
| `PROGRESSIVE_AMBIGUITY` | Multiple valid progressive forms | *ê-atoskêt* ≡ *atoskêw* |
| `INCLUSIVE_EXCLUSIVE` | First-person plural distinction na wala sa English | *ki-wîcihânaw* ≡ *ni-wîcihânân* |

**Language-specific ang mga class na ito.** Magkakaroon ng ibang classes ang ibang wika — maaaring may classes ang Turkish para sa vowel harmony variants, ang Japanese para sa honorific register alternation, ang Inuktitut para sa dialectal suffix variation.

**Ang design process:**
1. Mangolekta ng 100+ translation pairs (source + reference + candidate)
2. Tukuyin ang lahat ng kaso kung saan naiiba ang candidate sa reference ngunit ituturing itong tama ng bilingual speaker
3. Ikategorya ang mga pagkakaiba — maghanap ng patterns na nauulit sa maraming pairs
4. I-formalize ang bawat pattern bilang deterministic rule (regex, set operation, o FST transduction)
5. I-validate sa 3+ bilingual speakers: para sa bawat variant class, sumasang-ayon ba silang katanggap-tanggap ito?
6. Mag-iterate: kakailanganin ng refinement ang ilang classes, ang iba naman ay kailangang hatiin o pagsamahin

#### Hakbang 4: Buuin ang Semantic Validator (LYSS-sem)

Sinasagot ng semantic validator ang: "Pareho ba ang kahulugan ng saling ito sa reference?" Gumagana ito sa apat na stage:

1. **I-lemmatize ang parehong salin** gamit ang FST (i-extract ang root forms, alisin ang inflection)
2. **I-map ang lemmas sa glosses** gamit ang bilingual dictionary (Cree lemma → English gloss)
3. **Ihambing ang gloss sets** — nag-o-overlap ba ang glosses ng candidate sa glosses ng reference?
4. **Suriin ang structural constraints** — lumalabag ba ang candidate sa kilalang grammar rules (animacy agreement, verb form, person marking)?

Lumilikha ang validator ng verdicts: `EXACT_MATCH`, `VALID`, `GRAMMAR_ISSUES`, `PARTIAL`, `INCOMPLETE`, `WRONG`, `NO_OUTPUT`. Deterministic at traceable ang bawat verdict — maipapaliwanag ninyo kung *bakit* nakatanggap ng isang partikular na verdict ang isang salin sa pamamagitan ng pagsusuri kung aling stage ang nag-flag dito.

**Minimum viable version:** Kung mayroon kayong FST at dictionary, maaari kayong bumuo ng simplified semantic validator na gumagawa lamang ng lemma-gloss overlap (stages 1–3). Nangangailangan ang Stage 4 (grammar checking) ng mas maraming linguistic engineering ngunit nagdaragdag ng malaking halaga para sa morphologically complex languages.

#### Hakbang 5: I-integrate sa Evaluation Harness

Ipinapakete ang microeval suite bilang set ng metric plugins na kumokonekta sa evaluation harness:

1. Ipinapatupad ng bawat metric ang `MetricPlugin` protocol: `compute(entry) → dict`, `aggregate(results) → dict`
2. Awtomatikong dine-detect ng plugin discovery system ang language-specific plugins batay sa target language code
3. Ipinapasa ang scores sa composite scoring function, na pinagsasama ang microeval metrics at universal metrics gamit ang language-specific weight profiles

### 2.4 Minimum Viable Microeval

Hindi kailangang magkaroon agad ang bawat wika ng lahat ng tatlong layer. Narito ang minimum useful configuration sa bawat antas:

| Configuration | Kailangan Ninyo | Makukuha Ninyo | Oras ng Pagbuo |
|--------------|--------------|-------------|---------------|
| **LYSS-fst only** | FST + allowlist | Morphological validity gate — nahuhuli ang hallucinated word forms | 1–2 linggo |
| **LYSS-fst + LYSS-eq** | FST + 3–6 variant classes + oras ng linguist | Validity gate + equivalence detection — binabawasan ang false negatives | 4–8 linggo |
| **Full LYSS** | FST + variant classes + dictionary + semantic validator | Kumpletong language-specific evaluation | 8–16 linggo |

Ang rekomendasyon ay magsimula sa LYSS-fst (mabilis, mataas ang impact, nangangailangan lamang ng FST na malamang ay umiiral na) at magdagdag ng layers nang paunti-unti.

---

## Bahagi 3: Ang False Rejection Problem

### 3.1 Ano Ito

May false rejection rate ang bawat microeval metric: ang probability na ang isang tamang salin ay ma-score bilang mali.

Para sa LYSS-fst, nangyayari ang false rejection kapag:
- Hindi saklaw ng FST ang isang valid word form (incomplete paradigm tables)
- Naglalaman ang salin ng loanword na hindi nakikilala ng FST
- Gumagamit ang salin ng neologism o brand name
- Gumagamit ang salin ng dialectal form na wala sa lexicon ng FST
- Naglalaman ang salin ng proper noun na wala sa allowlist

Para sa LYSS-eq, nangyayari ang false rejection kapag:
- Gumagamit ang salin ng acceptable variant na hindi saklaw ng anumang variant class
- Kailangan ng bagong variant class ngunit hindi pa ito natutukoy

Para sa LYSS-sem, nangyayari ang false rejection kapag:
- Wala sa dictionary ang isang lemma
- Gumagamit ang valid translation ng paraphrase strategy na hindi nagma-map sa lemma set ng reference

### 3.2 Bakit Mas Mahalaga Ito Kaysa False Acceptance

Sa evaluation, mas masama ang false rejection kaysa false acceptance. Ang false rejection ay nangangahulugang ang isang *tamang* salin ay na-score bilang *mali* — pinanghihinaan nito ang builders na gumagawa ng mahusay na trabaho, at sinisira nito ang tiwala sa metric. Ang false acceptance ay nangangahulugang ang isang *maling* salin ay na-score bilang *tama* — masama ito, ngunit nahuhuli ito ng iba pang metrics sa composite.

Nagko-compound ang false rejection: kung may 10% false rejection rate per word ang LYSS-fst, at may 5 salita ang isang pangungusap, ang probability na kahit isang salita ay falsely rejected ay ~41%. Nangangahulugan ito na halos kalahati ng lahat ng pangungusap ay mababawasan ang FST acceptance rate ng kahit isang salita — hindi dahil mali ang salin, kundi dahil incomplete ang FST.

### 3.3 Mitigation Strategies

| Strategy | Mekanismo | Effectiveness |
|----------|----------|---------------|
| **Allowlists** | I-whitelist ang kilalang loanwords, proper nouns, abbreviations | Mataas para sa known gaps, zero para sa unknown gaps |
| **Fuzzy matching** | Tanggapin ang mga salitang nasa loob ng edit distance 1 mula sa isang kilalang form | Nahuhuli ang typos at minor orthographic variants |
| **Confidence scoring** | Timbangin ang FST results batay sa paradigm completeness | Nangangailangan ng paradigm coverage metadata |
| **Category-specific thresholds** | Iba't ibang thresholds para sa iba't ibang domains (maaaring mas maraming loanwords ang medical) | Nangangailangan ng domain-tagged corpora |
| **Community-maintained allowlists** | Nagsusumite ang speakers ng mga salitang dapat tanggapin ng FST | Pinaka-sustainable sa long-term; nangangailangan ng community engagement infrastructure |

### 3.4 Pagsukat sa Rate

Kailangang sukatin nang empirikal ang false rejection rate, sa isang representative corpus:

1. Kumuha ng corpus ng 500+ known-valid Cree sentences (textbooks, reviewed translations)
2. Patakbuhin ang bawat salita sa FST
3. Para sa bawat salitang nire-reject ng FST, ipauri ito sa bilingual speaker: valid word na hindi nakuha ng FST, o tunay na invalid?
4. `false_rejection_rate = valid_but_rejected / total_valid_words`

Ang sukat na ito ay isa sa mga kinakailangang validation experiments (Scoring Spec §1.6).

---

## Bahagi 4: Sino ang Nagpapasya Kung Ano ang "Tama"?

### 4.1 Ang Political Dimension ng Evaluation

Hindi neutral instruments ang evaluation metrics. Bawat metric ay naglalaman ng teorya kung ano ang ibig sabihin ng "correct translation," at may mga kahihinatnan ang teoryang iyon:

- Paparusahan ng FST na itinayo mula sa literary Cree ang colloquial Cree. Isa itong *political* choice tungkol sa kung aling register ng wika ang pinahahalagahan.
- Ang variant class na tumatanggap ng isang dialectal form ngunit hindi ng iba ay implicit na nag-i-standardize sa wika. Ang standardization ay isang political act na may mahabang colonial history.
- Ang semantic validator na nangangailangan ng eksaktong lemma overlap ay nagpaparusa sa creative paraphrase — isang mahalagang translation strategy na sadyang ginagamit ng mahuhusay na translator.

Ginagawang *explicit* ng Microeval ang mga pagpiling ito. Bawat variant class, bawat allowlist entry, bawat semantic equivalence rule ay isang discrete, documented, reviewable decision. Feature ito, hindi bug: nangangahulugan itong maaaring siyasatin, hamunin, at baguhin ng community ang mga rule na namamahala kung paano sinusuri ang kanilang wika.

### 4.2 Community Governance ng Evaluation Rules

Para sa Indigenous languages partikular, ang evaluation decisions ay dapat pamahalaan ng language community, hindi ng external researchers o engineers. Hindi lamang ito ethical principle (bagaman ganoon nga) — isa itong correctness requirement. Tanging fluent speakers ang makapagtutukoy kung katanggap-tanggap ang isang variant.

Ang governance model:

1. **Nagmumungkahi ang researchers** ng variant classes, allowlist entries, at semantic rules batay sa linguistic analysis
2. **Nire-review ng speakers** ang bawat proposal at inaaprubahan, nire-reject, o binabago ito
3. **Ang approved rules** ay kino-commit sa codebase na may speaker attribution
4. **Ang disputed rules** ay fina-flag para sa community discussion — hindi isinasama ang mga ito sa scoring hanggang maresolba
5. **Maaaring bawiin ng community** ang anumang rule anumang oras sa pamamagitan ng pag-alis nito sa approved set

Nangangailangan ang modelong ito ng infrastructure (ang evaluation harness, version control, ang speaker validation protocol) at relationships (tiwala sa pagitan ng researchers at community members). Bahagi ng microeval methodology ang pagbuo ng infrastructure na ito.

### 4.3 Dialectal Variation

Ang pinakamahirap na governance question: kapag hindi nagkakasundo ang dalawang dialect ng isang wika tungkol sa isang form, alin ang "tama"?

Ang sagot ng Microeval: **pareho silang tama.** Kinakatawan ang dialectal variants bilang karagdagang variant classes na may dialect tags. Maaaring kuwentahin ang composite score per-dialect o across dialects, depende sa kung ano ang sinusukat ng evaluation.

Nangangailangan ito na dialect-tagged ang corpus at dialect-aware ang variant classes. Nangangailangan din ito na lumahok sa validation ang speakers mula sa maraming dialect. Tinutugunan ng dokumentong Corpus Partnership Strategy ang mga requirement na ito.

---

## Bahagi 5: Kaugnayan sa Prior Art

### 5.1 Ano ang HINDI Microeval

| Claim na HINDI Namin Ginagawa | Bakit Hindi |
|------------------------|---------|
| "Walang silbi ang universal metrics" | Nagbibigay ang mga ito ng mahahalagang baselines at cross-language comparability. Nagsusupplement ang Microeval, hindi pumapalit. |
| "Hindi maaaring gumana ang neural metrics para sa LRL" | Maaari — sa pamamagitan ng fine-tuning sa language-specific data. Ngunit bihirang umiiral ang data na iyon. Gumagana ang Microeval *ngayon*. |
| "Novel ang FST-based evaluation" | Ginamit na ang FSTs sa NLP sa loob ng mga dekada. Ang novelty ay nasa sistematikong deployment ng mga ito bilang MT evaluation metrics. |
| "Mas mahusay ang LYSS kaysa COMET" | Hindi namin alam — hindi pa namin nagagawa ang human correlation study. Naniniwala kaming mas *informative* ang LYSS para sa polysynthetic languages, ngunit hindi namin maaaring sabihing mas *accurate* ito hangga't wala kaming ebidensya. |

### 5.2 Pinakamalapit na Prior Art

| Work | Kaugnayan sa Microeval |
|------|--------------------------|
| **MorphEval** (Sánchez-Cartagena & Toral, 2024) | Contrastive tests para sa morphological phenomena — complementary. Sinusubok ng MorphEval kung *kaya* ng mga system na gumawa ng morphology; sinusubok ng LYSS kung *nagawa* nila ito. |
| **CheckList** (Ribeiro et al., 2020) | Behavioral testing methodology para sa NLP — analogous paradigm. Methodology ang CheckList; methodology rin ang microeval, na inilalapat sa evaluation sa halip na testing. |
| **HyTER** (Dreyer & Marcu, 2012) | Meaning-equivalent lattices — pinakamalapit na conceptual parallel sa LYSS-eq. Nag-e-enumerate ang HyTER ng paraphrases; nag-e-enumerate ang LYSS-eq ng morphological variants. Nangangailangan ang HyTER ng manual lattice construction per sentence; ang LYSS-eq rules ay nalalapat corpus-wide. |
| **Apertium coverage** | Gumagamit ng FST coverage bilang proxy para sa MT output quality — direktang inaasahan ang LYSS-fst. Hindi formalized bilang metric o integrated sa scoring framework. |
| **FUSE** (AmericasNLP 2025) | Feature-based evaluation para sa Indigenous American languages — pinakakatulad sa diwa. Iminumungkahi ng FUSE ang linguistic features bilang evaluation dimensions; nagpapatupad ang LYSS ng specific features para sa specific languages. Kailangan ang head-to-head comparison. |
| **AfriCOMET** (Wang & Adelani, 2024) | Fine-tuned COMET para sa African languages — ipinapakita na *maaaring* i-adapt ang neural metrics. Ang Microeval ang rule-based complement para sa mga wikang walang fine-tuning data. |

### 5.3 Ang Pangunahing Pagkakaiba

Ang lahat ng prior art sa morphology-aware evaluation ay alinman sa:
1. **Nagmumungkahi ng general framework** nang hindi ito ipinapatupad para sa specific languages (FUSE, CheckList)
2. **Nagpapatupad para sa high-resource languages** kung saan umiiral ang training data (nakatuon ang MorphEval sa European pairs)
3. **Nagfa-fine-tune ng neural metrics** na nangangailangan ng data na wala tayo (AfriCOMET)

Partikular na idinisenyo ang Microeval para sa kaso kung saan:
- Umiiral ang linguistic tools (FSTs, dictionaries)
- Hindi umiiral ang training data para sa neural metric fine-tuning
- Nadaig ng morphological complexity ng wika ang surface metrics
- Kailangang operational ang evaluation *ngayon*, hindi matapos ang data collection campaign

---

## Bahagi 6: Bukas na Tanong at Tapat na Limitasyon

### 6.1 Mga Hindi pa Nalulutas na Tanong

1. **Nagko-correlate ba ang LYSS metrics sa human quality judgments?** Hindi namin alam. Hindi pa naisagawa ang kinakailangang human correlation study (200+ sentence pairs, 3+ bilingual speakers). Hangga't hindi ito nagagawa, engineering estimates ang LYSS scores, hindi validated quality measurements.

2. **Paano kumikilos ang LYSS metrics habang nagbabago ang mga wika?** Nag-e-evolve ang living languages — bagong loanwords, nagbabagong dialects, umuusbong na neologisms. Kailangang i-maintain ang FSTs at variant classes. Ano ang maintenance burden? Hindi namin alam.

3. **Ano ang minimum FST quality para maging kapaki-pakinabang ang LYSS-fst?** Kung 60% lamang ng lexicon ang saklaw ng isang FST, kapaki-pakinabang pa ba ang LYSS-fst, o nilulunod ng noise ang signal? Kailangan namin ng empirical evidence.

4. **Maaari bang gumana ang microeval para sa non-morphological challenges?** Ang mga wikang may tonal distinctions, click consonants, o logographic scripts ay may evaluation challenges na hindi tinutugunan ng FSTs. Maaaring hindi mailapat ang Microeval — o maaaring mangailangan ito ng ibang tools.

5. **Paano natin haharapin ang cold-start problem?** Nangangailangan ng linguistic expertise ang pagbuo ng microeval suite. Para sa mga wikang walang aktibong computational linguistics community, sino ang gagawa ng trabaho?

### 6.2 Tapat na Limitasyon ng LYSS

| Limitation | Severity | Mitigation |
|-----------|----------|-----------|
| Walang human correlation data | 🔴 Critical | Required validation experiment #1 |
| Hindi nasusukat ang FST false rejection rate | 🔴 Critical | Required validation experiment #2 |
| Ipinatupad lamang para sa isang wika (CRK) | 🟡 Significant | Nakaplanong second-language port (North Sámi) |
| Maaaring incomplete ang variant classes | 🟡 Significant | Community review + patuloy na pagdaragdag |
| Nangangailangan ng spaCy ang semantic validator | 🟡 Significant | Optional dependency; graceful degradation |
| Nakaaapekto ang dictionary coverage sa kalidad ng LYSS-sem | 🟡 Significant | Nakadokumento ang minimum dictionary size requirements |
| Hindi matukoy ang fluency o naturalness | 🟡 Significant | Nangangailangan ng human evaluation o neural metrics |
| Nangangailangan ng linguistic expertise upang mapalawak | 🟡 Significant | Binabawasan ng methodology documentation (ang papel na ito) ang hadlang |

### 6.3 Ang Landas Pasulong

> *"Kung magtutuon lamang tayo sa kung ano ang nag-ge-generalize, tiyak na malilimutan natin ang mga lugar kung saan hindi ito umaangkop — at mawawala sa atin ang mga wikang ito at ang lahat ng kanilang kaalaman at karunungan."*

Hindi solusyon ang Microeval sa evaluation problem. Isa itong praktika — isang disiplina ng pagbibigay-pansin sa kung ano ang nagpapakaiba sa bawat wika, at pag-e-encode ng pansing iyon sa gumaganang code. Matrabrabaho, language-specific, at hindi kailanman tapos ang praktika. Ngunit lumilikha ito ng isang bagay na hindi kayang likhain ng universal-metric paradigm: evaluation na nagsasalita ng wikang sinusuri nito.

---

## Apendise A: Mahahalagang Papel {#appendix-a-key-papers}

| Paper | Taon | Kontribusyon | Relevance |
|-------|------|-------------|-----------|
| Papineni et al., "BLEU" | 2002 | Foundational n-gram metric | Baseline universal metric |
| Popović, "chrF++" | 2017 | Character n-gram metric | Pinakamahusay na surface metric para sa morphologically rich languages |
| Rei et al., "COMET" | 2020 | Neural evaluation framework | Universal neural metric |
| Dreyer & Marcu, "HyTER" | 2012 | Meaning-equivalent semantics | Conceptual predecessor ng LYSS-eq |
| Burlot & Yvon, "MorphEval" | 2017 | Morphological evaluation | Contrastive morphological testing |
| Ribeiro et al., "CheckList" | 2020 | Behavioral testing para sa NLP | Methodological paradigm |
| Sánchez-Cartagena & Toral, "MorphEval" | 2024 | Morphological capabilities evaluation | Pinakamalapit na diagnostic complement |
| Wang & Adelani, "AfriCOMET" | 2024 | Adapted neural metric para sa African languages | Ipinapakita ang pangangailangan para sa language-specific evaluation |
| Lindén et al., "HFST" | 2011 | Finite-state morphology framework | Infrastructure para sa LYSS-fst |
| Wolfart, "Plains Cree" | 1973 | Definitive Cree grammar | Linguistic authority para sa CRK microeval |
| Wolvengrey, "Cree: Words" | 2001 | Plains Cree dictionary | Resource na pinagbabatayan ng LYSS-sem |
| Carroll et al., "CARE Principles" | 2020 | Indigenous data governance | Governance framework para sa microeval |

## Appendix B: Buod ng LYSS Component

| Component | Metric Name | Sinusukat Nito | Required Resources | Implementation Status |
|-----------|------------|------------------|-------------------|-----------------------|
| LYSS-fst | `fst_acceptance_rate` | Morphological validity ng output words | GiellaLT FST | ✅ Operational (CRK) |
| LYSS-eq | `equivalent_match_rate` | Acceptable-variant detection | Linguist-curated variant classes | ✅ Operational (CRK, 6 classes) |
| LYSS-sem | `semantic_score` | Meaning preservation sa pamamagitan ng lemma-gloss overlap | FST + bilingual dictionary + spaCy | ✅ Operational (CRK, requires spaCy) |

## Appendix C: Mga Wikang may GiellaLT FST Coverage

Ang mga sumusunod na wika ay may FSTs na available sa pamamagitan ng GiellaLT at candidates para sa LYSS-fst integration:

<!-- Dapat punuan ang listahang ito ng aktuwal na GiellaLT coverage data. -->
<!-- Tingnan: https://github.com/giellalt -->

| Wika | ISO 639-3 | FST Maturity | LYSS-fst Feasibility |
|----------|-----------|-------------|---------------------|
| Plains Cree | crk | Production | ✅ Operational |
| Northern Sámi | sme | Production | 🟡 Planned (first port) |
| Southern Sámi | sma | Production | 🟡 Candidate |
| Lule Sámi | smj | Production | 🟡 Candidate |
| Inari Sámi | smn | Production | 🟡 Candidate |
| Skolt Sámi | sms | Production | 🟡 Candidate |
| Finnish | fin | Production | 🟡 Candidate |
| Inuktitut | iku | Beta | 🟡 Needs assessment |
| Basque | eus | Beta | 🟡 Needs assessment |
| Welsh | cym | Beta | 🟡 Needs assessment |
