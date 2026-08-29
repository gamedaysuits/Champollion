---
sidebar_position: 4
title: "Cookbook: LLM na Pinalawig ng Diksyunaryo"
---

# LLM na Pinahusay ng Diksyunaryo

> **Ang ideya:** Ipilit ang kilala at beripikadong mga salin para sa mga partikular na termino mula sa isang bilingguwal na diksyunaryo, at hayaan ang LLM na humawak sa estruktura ng pangungusap at di-kilalang bokabularyo. Nagbibigay ang diksyunaryo ng mga angkla ng kawastuhan; nagbibigay ang LLM ng pagiging natural at madulas ng wika.

:::info[Isa itong cookbook, hindi isang tapos na implementasyon]
Binabalangkas ng gabay na ito ang paraan. Ang partikular na pagtutugma sa dictionary at estratehiya sa injection ay nakadepende sa inyong pares ng wika at sa mga available na lexical resource.
:::

## Kailan Ito Gagamitin

- May **bilingguwal na diksyunaryo** para sa inyong pares ng wika (kahit maliit lamang)
- Ang LLM ay palagiang **nagha-hallucinate ng mahahalagang termino** — nag-iimbento ng mga salitang hindi umiiral
- Kailangan ninyo ng **terminolohikal na konsistensi** sa mga salin (ang parehong salita ay isinasalin sa parehong paraan saanman)
- Nagsasalin kayo ng **nilalamang espesipiko sa domain** kung saan mali ang karaniwang mga salin ng LLM (legal, medikal, edukasyonal)

## Paano Ito Gumagana

1. **Mag-load ng bilingguwal na diksyunaryo** — mga pares na key→value na nagmamapa ng mga terminong pinagmulan sa beripikadong mga salin sa target
2. **Itugma ang source text laban sa diksyunaryo** — tukuyin ang mga termino sa input na may kilalang mga salin
3. **I-inject ang mga tugma sa prompt** — sabihin sa LLM na "ang mga terminong ito ay DAPAT isalin gaya ng sumusunod"
4. **Bubuo ang LLM ng salin** — kasama ang mga constraint ng diksyunaryo bilang mahihigpit na kinakailangan
5. **Mag-post-process** — beripikahing lumilitaw ang mga termino ng diksyunaryo sa output; ulitin kung hindi

## Format ng Diksyunaryo

```json title="dictionaries/crk-terms.json"
{
  "school": "kiskinwahamâtowikamik",
  "teacher": "okiskinwahamâkêw",
  "student": "kiskinwahamâkan",
  "book": "masinahikan",
  "home": "kīwēwin",
  "water": "nipiy"
}
```

## Estruktura ng Prompt

```
Translate the following English to Plains Cree (SRO).

REQUIRED TERMINOLOGY — use these exact translations:
- "school" → "kiskinwahamâtowikamik"
- "teacher" → "okiskinwahamâkêw"

Source: "The teacher went to the school"
```

## Mga Pangunahing Desisyon sa Disenyo

**Estratehiya sa pagtutugma:** Pinakasimple ang eksaktong tugma. Mas maraming nahuhuli ang lemmatized matching ("teachers" ay tumutugma sa "teacher") ngunit nangangailangan ito ng lemmatizer para sa source language. May panganib ng mga false positive ang fuzzy matching.

**Paghawak sa inflection:** Sa mga polysynthetic language, maaaring mangailangan ng inflection ang anyo sa diksyunaryo upang umangkop sa pangungusap. Maaari ninyong ibigay ang ugat at hayaang i-inflect ito ng LLM, o magbigay ng maraming inflected form. Maaaring beripikahin ng isang [FST](./fst-gated-pipeline) ang resulta.

**Resolusyon ng conflict:** Paano kung balewalain ng LLM ang isang termino sa diksyunaryo? Mga opsyon: (a) ulitin gamit ang mas matibay na tagubilin, (b) mag-post-process sa pamamagitan ng string replacement, (c) tanggapin at i-flag para sa pagsusuri.

## Mga Kalamangan at Kahinaan

| | |
|---|---|
| ✅ Inaalis ang hallucination para sa mga kilalang termino | ❌ Palaging hindi kumpleto ang saklaw ng diksyunaryo |
| ✅ Ginagarantiya ang konsistensi para sa mahahalagang bokabularyo | ❌ Maaaring hindi tumugma ang inflection/conjugation sa konteksto ng pangungusap |
| ✅ Madaling i-audit at i-update | ❌ Maaaring makalikha ng di-natural na output ang labis na paglalagay ng constraint |
| ✅ Ang diksyunaryo ay reusable asset | ❌ Nangangailangan munang may umiiral na diksyunaryo |

## Saan Makakahanap ng mga Diksyunaryo

- **[itwêwina](https://itwewina.altlab.app/)** — Plains Cree–English (pinapagana ng FST; ang morphodict platform ay open source — ang mismong nilalaman ng diksiyonaryo ay hindi po nakapailalim sa bukas na lisensya)
- **[Wolvengrey, *nêhiyawêwin: itwêwina / Cree: Words*](https://uofrpress.ca/Books/C/Cree-Words)** — komprehensibong sanggunian para sa Plains Cree (University of Regina Press)
- **[Apertium](https://www.apertium.org/)** — mga bilingguwal na diksiyonaryo para sa dose-dosenang pares ng wika
- **[Giellatekno](https://giellalt.github.io/)** — mga diksiyonaryo para sa Sámi, Uralic, at iba pang minoryang wika
- Mga glossary na ginawa ng komunidad, mga materyal na pang-edukasyon, mga listahan ng termino

## Mahusay na Naipapares Sa

- **[Coached LLM Prompting](./coached-llm-prompting)** — ang mga entry sa diksyunaryo ay isang anyo ng coaching data
- **[FST-Gated Pipeline](./fst-gated-pipeline)** — bineberipika ng FST na wasto ang inflection ng mga termino sa diksyunaryo
- **[Rule-Based + LLM Hybrid](./rule-based-hybrid)** — deterministic na paghahanap sa diksyunaryo bilang isang rule layer

## Tingnan Din

- [Suportahan ang Low-Resource Language](/docs/network/community/low-resource-languages) — ang buong konteksto
- [Interface ng Method](/docs/network/specifications/methods) — kung paano nakaayos ang mga method
