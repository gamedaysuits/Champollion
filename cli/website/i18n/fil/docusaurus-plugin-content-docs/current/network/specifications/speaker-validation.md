---
sidebar_position: 8
title: "Protokol sa Pagpapatunay ng Tagapagsalita"
slug: '/network/specifications/speaker-validation'
---

# Protocol sa Pagpapatunay ng Tagapagsalita

> **Layunin.** Tinutukoy ng dokumentong ito kung ano mismo ang kailangan namin mula sa mga bilingguwal na tagapagsalita ng Cree–English upang mapatunayan ang mga sukatan ng pagsusuri ng LYSS. Kung wala ang pagpapatunay na ito, ang aming mga automated na marka ay mga pagtatantya lamang sa inhinyeriya, hindi mga napatunayang sukat ng kalidad. Ito ang nag-iisang pinakamahalagang puwang sa proyekto.
>
> **Mambabasa.** Mga kasosyo sa komunidad, mga potensyal na katuwang, mga tagasuri ng gawad, at ang koponan ng proyekto.


---

## 1. Bakit Kailangan Namin ang mga Tagapagsalita

Ang balangkas ng pagsusuri na LYSS (Linguistically-informed Yield & Structural Scoring) ay kumukuwenta ng mga automated quality score para sa mga saling English → Plains Cree. Gumagamit ito ng tatlong pangunahing signal:

- **LYSS-fst**: Mayroon bang valid Cree words ang output? (sinusuri ng GiellaLT finite-state transducer)
- **LYSS-eq**: Ang output ba ay katanggap-tanggap na variant ng reference translation? (sinusuri ng equivalence classes ng linter)
- **LYSS-sem**: Napananatili ba ng output ang kahulugan ng source? (sinusuri ng semantic validator)

Nagbibigay ng mga numero ang mga metric na ito. **Hindi namin alam kung may kabuluhan ang mga numerong iyon.** Maaaring tanggihan ng FST ang mga valid word na hindi nito nakikilala (loanwords, neologisms, proper nouns). Maaaring hindi makita ng linter ang mga valid equivalence o maaaring tumanggap ito ng mga invalid. Maaaring magkamali ang semantic validator sa paghusga ng kahulugan. Hangga't hindi sinasabi sa amin ng mga bilingual na tagapagsalita kung tumutugma ang aming mga automated score sa kanilang human judgment sa kalidad ng salin, nangangapa lamang kami.

Ang bawat pangunahing MT evaluation metric (BLEU, COMET, chrF++) ay napatunayan sa pamamagitan ng paghahambing ng mga automated score laban sa libo-libong human quality assessment. Kailangan din namin iyon — sa mas maliit na saklaw, dahil limitado ang aming mga resource, ngunit may parehong higpit.

---

## 2. Ang Kailangan Namin: Tatlong Gawain

### Gawain A: Pag-rate ng Kalidad ng Salin (Pangunahin — ~8 oras sa kabuuan)

**Ano:** I-rate ang 200 machine-generated English → Cree translations sa dalawang scale.

**Sino:** 3+ bilingual na tagapagsalita ng Plains Cree–English na may reading fluency sa SRO (Standard Roman Orthography).

**Paano ito gumagana:**

1. Magbibigay kami ng spreadsheet o web form na may 200 row. Bawat row ay may:
   - Ang English source sentence
   - Isang machine-generated Cree translation
   - (Opsyonal) isang reference Cree translation para sa paghahambing

2. Para sa bawat salin, magra-rate ang tagapagsalita ng dalawang bagay:

   **Adequacy** (sinasabi ba nito ang tamang bagay?):
   | Score | Label | Kahulugan |
   |-------|-------|---------|
   | 1 | Wala | Walang kinalaman ang salin sa source |
   | 2 | Kaunti | May ilang salitang tumutugma ngunit mali ang kabuuang kahulugan |
   | 3 | Malaki | Naroon ang pangunahing kahulugan ngunit may mahahalagang bahaging nawawala o mali |
   | 4 | Karamihan | Halos lahat ay tama, may maliliit na puwang sa kahulugan |
   | 5 | Lahat | Ganap na naipapahayag ng salin ang kahulugan ng source |

   **Fluency** (parang tunay na Cree ba ito?):
   | Score | Label | Kahulugan |
   |-------|-------|---------|
   | 1 | Hindi maunawaan | Hindi ito Cree |
   | 2 | Hindi matatas | Maaaring Cree ang mga indibidwal na salita ngunit sira ang pangungusap |
   | 3 | Hindi katutubo | Nauunawaan ngunit malinaw na hindi ganito sasabihin ng isang tagapagsalita ng Cree |
   | 4 | Maganda | Natural pakinggan na may bahagyang pagkaasiwa |
   | 5 | Walang kapintasan | Maaaring isang tagapagsalita ng Cree ang sumulat nito |

3. Opsyonal, maaaring magdagdag ang tagapagsalita ng free-text note na nagpapaliwanag ng kanilang rating (hal., "maling animate/inanimate agreement sa pandiwa," "ito ay th-dialect ngunit nagra-rate ako batay sa y-dialect").

**Tinatayang oras:** ~2.5 minuto bawat salin × 200 salin = ~8 oras. Maaaring hatiin sa maraming session (hal., 4 × 2-oras na session sa loob ng 2 linggo).

**Kompensasyon:** $50–65 CAD/oras (tugma sa BENCHMARK_SPEC §10.3 speaker compensation rates). Kabuuan bawat tagapagsalita: $400–520 CAD. Para sa 3 tagapagsalita: **$1,200–1,560 CAD**.

**Ano ang gagawin namin dito:** Kukuwentahin namin ang korelasyon sa pagitan ng aming mga automated LYSS score at ng mga rating ng tagapagsalita. Kung ang LYSS-fst ay may korelasyon sa mga fluency rating at ang LYSS-sem ay may korelasyon sa mga adequacy rating, napatunayan ang mga metric. Kung hindi, malalaman namin kung saan sila aayusin.

---

### Gawain B: Pagpapatunay ng Linter Equivalence (~2 oras)

**Ano:** Suriin ang 50 pares ng Cree translations na inuuri ng aming linter bilang "equivalent" at sabihin sa amin kung talagang pareho ang kahulugan ng mga ito.

**Sino:** 1–2 bilingual na tagapagsalita (maaaring ang parehong mga tagapagsalita sa Gawain A).

**Paano ito gumagana:**

1. Magbibigay kami ng 50 pares. Bawat pares ay may:
   - Ang English source
   - Translation A (ang reference)
   - Translation B (isang variant na sinasabi ng aming linter na equivalent)
   - Ang dahilan ng equivalence (hal., "word order permutation," "orthographic variant," "optional particle removed")

2. Para sa bawat pares, sasagot ang tagapagsalita:
   - **Pareho ba ang kahulugan?** Oo / Hindi / Depende sa konteksto
   - **Pareho bang natural?** Oo / Mas maganda ang A / Mas maganda ang B / Wala sa dalawa ang natural
   - **Mga tala** (opsyonal na free text)

**Tinatayang oras:** ~2 minuto bawat pares × 50 pares = ~2 oras.

**Kompensasyon:** $50–65 CAD/oras × 2 oras = **$100–130 CAD bawat tagapagsalita**.

**Ano ang gagawin namin dito:** Kukuwentahin namin ang precision ng bawat equivalence class. Kung sabihin ng mga tagapagsalita na 90% ng "word order" equivalences ay tunay na equivalent, napatunayan ang class na iyon. Kung sabihin nilang mali ang 40% ng "lemma synonym" equivalences, malalaman naming kailangang ayusin o alisin ang class na iyon.

---

### Gawain C: Pagsusuri ng FST False Rejection (~1.5 oras)

**Ano:** Suriin ang 100 Cree words na tinatanggihan ng FST analyzer (sinasabing hindi valid Cree words) at sabihin sa amin kung talagang valid ang mga ito.

**Sino:** 1 bilingual na tagapagsalita na may matibay na kaalaman sa bokabularyong Cree.

**Paano ito gumagana:**

1. Pinapatakbo namin ang FST analyzer sa aming 436-entri na EdTeKLA dev corpus (`textbook_dev.json`) at kinokolekta ang bawat salitang tinatanggihan nito.
2. Nagpapakita kami ng hanggang 100 tinanggihang salita sa tagapagsalita kasama ang konteksto ng pangungusap ng mga ito.
3. Para sa bawat salita, sinasagot ng tagapagsalita ang:
   - **Wasto ba itong salitang Cree?** Oo / Hindi / Hindi sigurado
   - **Kung oo, anong uri?** Naitatag na salita / Hiram na salita / Pangalan / Dialectal na anyo / Neolohismo / Iba pa
   - **Mga Tala** (opsyonal)

**Tinatayang oras:** ~1 minuto bawat salita × 100 salita = ~1.5 oras.

**Kompensasyon:** $50–65 CAD/oras × 1.5 oras = **$75–100 CAD**.

**Ano ang gagawin namin dito:** Kukuwentahin namin ang false rejection rate ng FST. Kung tumanggi ang FST sa 50 salita at sabihin ng mga tagapagsalita na valid ang 30 sa mga ito, ang false rejection rate ay 60% — hindi katanggap-tanggap na mataas, at nangangailangan ng loanword/exception allowlist. Kung sabihin ng mga tagapagsalita na 5 lamang ang valid, ang false rejection rate ay 10% — maaasahan ang metric.

---

## 3. Kabuuang Commitment ng Tagapagsalita

| Gawain | Kailangan na Tagapagsalita | Oras bawat Tagapagsalita | Gastos bawat Tagapagsalita | Kabuuang Gastos |
|------|----------------|-------------------|-----------------|------------|
| A: Quality Rating | 3 | ~8 oras | $400–520 | $1,200–1,560 |
| B: Linter Validation | 2 | ~2 oras | $100–130 | $200–260 |
| C: FST Review | 1 | ~1.5 oras | $75–100 | $75–100 |
| **Kabuuan** | **3 tagapagsalita** | **~11.5 oras (max bawat tagapagsalita)** | **$575–750 (max)** | **$1,475–1,920** |

Kung ang parehong 3 tagapagsalita ang gagawa ng lahat ng gawain: **~11.5 oras bawat isa sa loob ng 2–4 linggo, $575–750 bawat isa**.

Ang isang tagapagsalita na gagawa lamang ng Gawain A ay magkakaroon ng commitment na **~8 oras sa loob ng 2 linggo para sa $400–520**.

---

## 4. Kwalipikasyon ng Tagapagsalita

**Kailangan:**
- Bilingual sa Plains Cree at English
- Reading fluency sa SRO (Standard Roman Orthography)
- Komportable sa pag-rate ng mga salin gamit ang structured scale

**Mas ninanais:**
- Karanasan sa y-dialect (ang dialect na ginagamit sa aming reference corpus mula sa EDTeKLA)
- Karanasan sa pagtuturo o pagsasalin (nagbibigay ng calibrated quality judgment)
- Pamilyaridad sa iba't ibang register (formal, educational, conversational)

**Hindi kailangan:**
- Teknikal o NLP knowledge (ibibigay namin ang lahat ng tool at konteksto)
- Computational skills (ang rating interface ay magiging simpleng spreadsheet o web form)
- Naunang pakikilahok sa Champollion project

---

## 5. Data Governance {#5-data-governance}

Ang lahat ng kontribusyon ng tagapagsalita ay pinamamahalaan ng mga patakaran sa data ng proyekto na naghahangad ng soberanya:

- **Pagmamay-ari:** Ang mga rating ng kalidad ng mga tagapagsalita ay mananatiling kanilang intelektwal na kontribusyon. Kikilalanin sila sa pangalan (o nang hindi nagpapakilala, ayon sa kanilang nais) sa anumang publikasyon.
- **Kontrol:** Maaaring bawiin ng mga tagapagsalita ang kanilang mga rating anumang oras. Aalisin ng pagbawi ang kanilang data mula sa lahat ng pagsusuri.
- **Access:** Ang data ng rating ay nakaimbak sa imprastraktura na kinokontrol ng organisasyon sa pamamahala ng komunidad (kapag naitatag na) o sa gustong platform ng tagapagsalita.
- **Panghahawak:** Ang raw na data ng rating ay hindi kailanman ilalathala. Tanging mga pinagsama-samang estadistika (mga korelasyon, inter-annotator agreement) ang lalabas sa mga publikasyon.
- **Kompensasyon:** Babayaran ang mga tagapagsalita para sa kanilang oras kahit gamitin man o hindi ang kanilang mga rating, kapag napondohan na ang gawaing ito (walang pondong hawak sa kasalukuyan). Ang kabayaran ay hindi nakadepende sa mga resulta.

---

## 6. Ano ang Makukuha ng mga Tagapagsalita {#6-what-speakers-get}

Bukod sa kompensasyon:

- **Co-authorship** sa anumang publikasyong gumagamit ng kanilang mga rating (kung nais)
- **Acknowledgment** sa lahat ng dokumentasyon ng proyekto
- **Early access** sa mga evaluation tool at resulta
- **Input** kung paano ginagamit ang mga metric — kung sabihin ng isang tagapagsalita na "mali ang inyong linter tungkol sa X," aayusin namin ang linter
- **Veto power** sa paglalathala ng mga resultang itinuturing nilang problematiko

---

## 7. Paano Magsimula {#7-how-to-get-started}

Wala pang pondo para sa gawain ng tagapagsalita, kaya walang anumang bagay sa ibaba ang maaaring masimulan ngayon, at hindi kami hihiling kaninuman na magsimula ng gawaing walang bayad. Kung kayo ay isang bilingguwal na tagapagsalita ng Cree–English na interesadong lumahok kapag napondohan na ito, o kung may kakilala kayong maaaring interesado:

1. **Makipag-ugnayan sa amin** sa [info@champollion.dev](mailto:info@champollion.dev) — walang kinakailangang pangako, simpleng pag-uusap lamang
2. **Ipapaliwanag namin ang mga gawain** sa payak na wika (walang jargon)
3. **Pipili kayo kung aling mga gawain** ang interesado kayo (A, B, C, o anumang kombinasyon)
4. **Magtatakda tayo ng iskedyul** na angkop para sa inyo (2 oras na block, nababagong oras)
5. **Ire-rate ninyo ang mga salin** sa pamamagitan ng spreadsheet o web form — mula saanman, sa sarili ninyong oras
6. **Agad kaming magbabayad** — sa loob ng 2 linggo pagkatapos makumpleto ang bawat block ng gawain

---

## 8. Ano ang Mangyayari Pagkatapos

Sa pamamagitan ng speaker validation data, maaari naming:

1. **Ilathala ang mga metric correlation** — upang patunayan (o pabulaanan) na sumasalamin ang mga LYSS score sa human judgment
2. **I-recalibrate ang mga metric** — iaangkop ang weights, thresholds, at equivalence classes batay sa feedback ng tagapagsalita
3. **Ayusin ang linter** — aalisin ang false equivalences, idaragdag ang mga nawawala
4. **Ayusin ang FST allowlist** — idaragdag ang mga valid word na maling tinatanggihan ng FST
5. **Magsumite sa isang academic venue** — kasama ang mga tagapagsalita bilang co-author, upang itatag ang LYSS bilang validated metric para sa polysynthetic language MT evaluation

Kung walang speaker validation, mananatiling engineering tool ang LYSS. Sa pamamagitan nito, nagiging scientifically grounded evaluation metric ang LYSS. Iyon ang pagkakaiba sa pagitan ng "may binuo kami" at "napatunayan naming gumagana ito."


## Saan ito patungo sa site na ito

Ang pagpapatunay ng tagapagsalita ay isang yugto ng isang mas malaking pipeline: ang
workflow ng [Pakikipagtulungan sa Corpus](/docs/network/specifications/corpus-partnership)
ang kinalalagyan ng mga gawaing ito sa pagbuo ng isang evaluation corpus, at ang
[Paano Binabayaran ang mga Tagapagsalita](/docs/network/perspectives/how-speakers-get-paid)
ang payak na bersyon ng mga rate at tuntunin sa itaas.
