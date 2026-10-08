---
title: "Pamamaraan sa Pagsipi ng Language Card"
sidebar_label: "Citation Procedure"
---

# Pamamaraan ng Pagsipi para sa Language Card

*Kung paano tinitiyak ng Champollion na ang bawat pahayag sa isang language card ay masusubaybayan sa isang pangunahing sanggunian.*

---

## 1. Ang Problema

Naglalaman ang mga language card ng mga paktuwal na pahayag — bilang ng nagsasalita, kalagayan ng pagiging nanganganib, mga impluwensiya ng contact, mga katangiang morpolohikal, mga kumbensiyong tipograpiko, suporta sa pamamaraan — na **dapat mapatunayan**. Sa kasalukuyan:

- Ang field na `dataSources` ay isang flat array ng mga string (hal., `["cldr-48", "glottolog-5.3"]`)
- Walang granularity ng pagsipi sa bawat field
- Ang mga pahayag tulad ng "~2.8M speakers" o "vulnerable" ay walang masusubaybayang pinagmulan
- Hindi matutukoy ng reviewer kung aling sanggunian ang sumusuporta sa aling pahayag

> [!CAUTION]
> **Ang pahayag na walang sanggunian ay pahayag na hindi mapapatunayan.** Para sa isang proyektong inilalagay ang sarili bilang propesyonal at masusing-masusi, ang bawat assertion sa isang language card ay dapat masusubaybayan sa isang partikular at may-bersyong pangunahing sanggunian.

---

## 2. Mga Awtoritatibong Sanggunian (Naka-ranggo ayon sa Prayoridad)

Para sa bawat uri ng pahayag, ang mga sumusunod na sanggunian ang awtoritatibo. **Palaging mas piliin ang pinakamataas na ranggong sangguniang available.**

### Klasipikasyon at Identidad

| Prayoridad | Sanggunian | Sinasaklaw | Lisensya | Paano Sipiin |
|---|---|---|---|---|
| 1 | [Glottolog](https://glottolog.org) (Max Planck) | Pamilya, ancestry, glottocode | CC-BY 4.0 | `glottolog-5.x` |
| 2 | [ISO 639-3](https://iso639-3.sil.org) (SIL) | Mga ISO code, macrolanguages | Libre | `iso639-3-{date}` |
| 3 | [WALS](https://wals.info) (Max Planck) | Mga depinisyon ng genus, mga katangiang typological | CC-BY 4.0 | `wals-2024` |
| 4 | [CLDR](https://cldr.unicode.org) (Unicode) | Mga locale code, script code, plural rule | Unicode ToS | `cldr-{version}` |

### Demograpiya ng mga Nagsasalita at Vitality

| Prayoridad | Sanggunian | Sinasaklaw | Lisensya | Paano Sipiin |
|---|---|---|---|---|
| 1 | National census data | Opisyal na bilang ng mga nagsasalita | Nag-iiba (karaniwang pampubliko) | `census-{country}-{year}` |
| 2 | [Ethnologue](https://www.ethnologue.com) | Mga pagtatantiya ng nagsasalita, EGIDS | Proprietary (subscription) | `ethnologue-{edition}` |
| 3 | [UNESCO Atlas](http://www.unesco.org/languages-atlas/) | Kalagayan ng pagiging nanganganib | Libre | `unesco-atlas-{year}` |
| 4 | Mga nailathalang akademikong papel | Mga panrehiyong survey ng nagsasalita | Lisensya ayon sa papel | `{author}-{year}` |
| 5 | [Katig Collective](https://linguistics.upd.edu.ph/the-katig-collective/) | Mga wika sa Pilipinas | Akademiko | `katig-{year}` |

> [!WARNING]
> **Huwag kailanman gumamit ng Wikipedia, tekstong nabuo ng LLM, o sariling kaalaman bilang pangunahing sanggunian para sa mga pahayag na demograpiko.** Ang mga ito ay mga sekundaryo/tersiyaryong sanggunian sa pinakamahusay na kaso. Palaging subaybayan pabalik sa pangunahing datos.

### Suporta sa Pamamaraan (Saklaw ng Translation API)

| Pamamaraan | Sanggunian sa Pag-verify | Paano I-verify | Paano Sipiin |
|---|---|---|---|
| Google Translate | [Listahan ng wika](https://cloud.google.com/translate/docs/languages) | API call o pahina ng docs | `google-translate-{date}` |
| DeepL | [Listahan ng wika](https://www.deepl.com/docs-api/translate-text/) | API call | `deepl-api-{date}` |
| Microsoft Translator | [Listahan ng wika](https://learn.microsoft.com/en-us/azure/ai-services/translator/language-support) | Pahina ng docs | `ms-translator-{date}` |
| LibreTranslate | [Listahan ng wika](https://libretranslate.com/languages) | API call | `libretranslate-{date}` |
| NLLB | [FLORES README](https://github.com/openlanguagedata/flores) | README + model card | `nllb-200-{date}` |
| LLM | Palaging `true` | N/A (nag-iiba ang kalidad) | `llm-assumed` |

### DLS (Digital Language Support)

| Prayoridad | Sanggunian | Sinasaklaw | Paano Sipiin |
|---|---|---|---|
| 1 | [Simons et al. 2022](https://aclanthology.org/2022.coling-1.379/) | Mga DLS score (orihinal na 143 tool) | `simons-2022` |
| 2 | Ethnologue ika-27+ ed. | Mga DLS score (pinalawak na 211 tool) | `ethnologue-{edition}-dls` |

### Tipograpiya, Plural, Script

| Prayoridad | Sanggunian | Sinasaklaw | Paano Sipiin |
|---|---|---|---|
| 1 | [CLDR](https://cldr.unicode.org) | Mga plural rule, panipi, format ng numero | `cldr-{version}` |
| 2 | [Unicode CSUR](https://unicode.org/iso15924/) | Mga script code | `iso15924-{date}` |
| 3 | Mga nailathalang grammar | Mga panuntunang partikular sa wika | `{author}-{year}` |

### Mga Impluwensiya ng Contact

| Prayoridad | Sanggunian | Sinasaklaw | Paano Sipiin |
|---|---|---|---|
| 1 | Mga nailathalang papel sa historical linguistics | Mga pag-aaral ng loanword, kasaysayan ng contact | `{author}-{year}` |
| 2 | Mga reference grammar | Mga paglalarawan ng istruktural na impluwensiya | `{grammar-title}-{year}` |
| 3 | [WALS](https://wals.info) | Mga paghahambing na typological | `wals-{feature}-{year}` |

> [!IMPORTANT]
> **Ang mga pahayag tungkol sa impluwensiya ng contact ang pinakamahirap hanapan ng sanggunian.** Ang mga pahayag tulad ng "Spanish superstrate, deep, 1571–1898" ay nangangailangan ng kadalubhasaan sa historical linguistics. Kung hindi makahanap ng nailathalang sanggunian, markahan ang pahayag gamit ang `"citation_needed": true` sa halip na manghula.

---

## 3. Pamamaraan ng Pagsipi (Hakbang-hakbang)

### Kapag Gumagawa ng Bagong Language Card

1. **Magsimula sa mga auto-populated field:**
   - Patakbuhin ang `node scripts/build-language-tree.mjs --enrich` → pinupunan ang `classification` mula sa Glottolog
   - Itala ang `"glottolog-{version}"` sa `dataSources`

2. **Magdagdag ng datos mula sa CLDR:**
   - Hanapin ang plural rules, panipi, script code mula sa CLDR
   - Itala ang `"cldr-{version}"` sa `dataSources`

3. **Magsaliksik ng demograpiya ng nagsasalita:**
   - Suriin MUNA ang national census data
   - I-cross-reference sa Ethnologue (kung available)
   - I-cross-reference sa UNESCO Atlas
   - Itala ang LAHAT ng sangguniang kinonsulta sa `dataSources`

4. **I-verify ang suporta sa pamamaraan:**
   - Suriin ang listahan ng wika ng BAWAT API (hindi mula sa memorya, hindi mula sa mga palagay)
   - Itala ang petsa ng pag-verify

5. **Magsaliksik ng mga impluwensiya ng contact:**
   - Maghanap ng mga nailathalang papel sa historical linguistics
   - Idokumento ang panahon, uri, at lalim gamit ang mga pagsipi
   - Kung walang nailathalang sanggunian, magdagdag ng `"citation_needed": true` sa influence entry

6. **Magsaliksik ng vitality:**
   - Suriin ang Ethnologue para sa EGIDS
   - Suriin ang UNESCO Atlas para sa kalagayan ng pagiging nanganganib
   - Itala ang anumang pagkakaiba sa pagitan ng mga sanggunian

7. **Punan ang `dataSources`:**
   - Ilista ang BAWAT sangguniang kinonsulta (hindi lamang ang mga nagbigay ng datos)
   - Gamitin ang format ng pagsipi mula sa mga talahanayan sa itaas

### Kapag Nag-a-update ng Umiiral na Card

1. **Huwag kailanman baguhin ang isang paktuwal na pahayag nang hindi ina-update ang `dataSources`**
2. **Kung ina-update ninyo ang bilang ng nagsasalita**, alisin ang lumang sanggunian at idagdag ang bago
3. **Kung nagdaragdag kayo ng suporta sa pamamaraan**, i-verify laban sa API at itala ang petsa
4. **Lagyan ng date stamp ang lahat ng pagsusuri sa suporta sa pamamaraan** — madalas magbago ang saklaw ng API

---

## 4. Iminungkahing Pagpapahusay sa Schema: Mga Pagsipi sa Bawat Field

### Kasalukuyang Schema (Flat `dataSources`)

```json
"dataSources": ["cldr-48", "glottolog-5.3"]
```

**Problema:** Aling mga field ang galing sa CLDR? Alin ang mula sa Glottolog? Alin ang walang pagsipi?

### Iminungkahing Pagpapahusay: Nakabalangkas na `dataSources`

```json
"dataSources": {
  "classification": ["glottolog-5.3"],
  "vitality.unescoStatus": ["unesco-atlas-2024"],
  "vitality.egids": ["ethnologue-27"],
  "vitality.speakerCount": ["census-ph-2020", "ethnologue-27"],
  "rules.plurals": ["cldr-48"],
  "rules.typography": ["cldr-48"],
  "contactInfluences": ["blust-2013", "llamzon-1969"],
  "methodSupport.googleTranslate": ["google-translate-2024-07"],
  "methodSupport.nllb": ["nllb-200-2024-03"],
  "dls": ["simons-2022", "ethnologue-27-dls"],
  "pipelineReadiness": ["manual-assessment-2025-06"]
}
```

### Migration Path

Ito ay isang **backwards-compatible** na pagbabago:
1. Panatilihin ng mga kasalukuyang card ang flat array (balido pa rin)
2. Gagamitin ng mga bagong card ang nakabalangkas na format
3. Tinatanggap ng schema validation ang parehong format
4. I-migrate ang mga kasalukuyang card nang paunti-unti habang nire-review ang mga ito

> [!TIP]
> **Mag-validate gamit ang script.** Magdagdag ng script na `validate-citations.mjs` na:
> - Tinitiyak na bawat card ay may hindi bababa sa mga sangguniang `classification` at `vitality`
> - Nagfa-flag ng mga card na may flat na `dataSources` array para sa upgrade
> - Nagbibigay-babala sa mga entry na `methodSupport` na walang date-stamped verification

---

## 5. Checklist ng Kalidad

Bago i-merge ang anumang pagbabago sa language card, i-verify:

- [ ] Bawat bilang ng nagsasalita ay may sanggunian (census o Ethnologue, hindi Wikipedia)
- [ ] Bawat kalagayang UNESCO/EGIDS ay may sanggunian
- [ ] Bawat method support flag ay na-verify laban sa aktuwal na API (hindi ipinagpalagay)
- [ ] Bawat impluwensiya ng contact ay may nailathalang akademikong sanggunian O minarkahang `citation_needed`
- [ ] Ang klasipikasyon ay auto-populated mula sa Glottolog (hindi manu-manong binuo)
- [ ] Inililista ng `dataSources` ang LAHAT ng sangguniang kinonsulta
- [ ] Walang pahayag na umaasa lamang sa kaalamang nabuo ng LLM
- [ ] Nakatakda ang `humanReviewed` sa identifier at petsa ng reviewer kung nag-review ang isang native speaker

---

## 6. Field na `humanReviewed`

Kasama sa schema ng language card ang field na `humanReviewed` na kasalukuyang `null` sa lahat ng card. Dapat punan ang field na ito kapag nire-review ng isang native speaker o kwalipikadong linguist ang card:

```json
"humanReviewed": {
  "reviewer": "Prof. Kenneth Jamandre",
  "affiliation": "University of the Philippines",
  "date": "2026-06-08",
  "scope": "full",
  "notes": "Verified speaker count, vitality assessment, and contact influences."
}
```

> [!IMPORTANT]
> **Ang community review ang gold standard.** Nagbibigay ng pundasyon ang automated data at mga akademikong papel, ngunit ang review ng isang native speaker ang panghuling validation. Lalo itong kritikal para sa:
> - Mga pahayag tungkol sa impluwensiya ng contact (alam ng mga miyembro ng komunidad kung aling mga hiniram na salita ang aktuwal na ginagamit)
> - Mga pagtatasa ng vitality (alam ng mga miyembro ng komunidad kung nagsasalita ng wika ang mga bata)
> - Mga sistema ng pormalidad (maaaring hindi makita ng mga akademikong paglalarawan ang mga pattern ng pang-araw-araw na paggamit)

---

## 7. Mga Sanggunian para sa Pamamaraang Ito

1. Glottolog: https://glottolog.org — CC-BY 4.0
2. ISO 639-3: https://iso639-3.sil.org — Libre
3. WALS: https://wals.info — CC-BY 4.0
4. CLDR: https://cldr.unicode.org — Unicode Terms of Use
5. Ethnologue: https://www.ethnologue.com — Proprietary (subscription)
6. UNESCO Atlas: http://www.unesco.org/languages-atlas/ — Libre
7. Simons et al. (2022): https://aclanthology.org/2022.coling-1.379/
8. Champollion Language Card Spec: `cli/website/docs/reference/language-card-spec.md`
