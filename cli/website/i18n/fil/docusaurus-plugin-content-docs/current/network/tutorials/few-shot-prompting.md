---
sidebar_position: 3
title: "Cookbook: Few-Shot Prompting"
---

# Few-Shot Prompting

> **Ang ideya:** Isama ang napatunayan at mataas-ang-kalidad na mga pares ng salin bilang in-context examples upang matutuhan ng LLM ang mga pattern, estilo, at kombensiyon ng target language sa pamamagitan ng demonstrasyon sa halip na instruksiyon.

:::info[Ito ay isang cookbook, hindi pa tapos na implementasyon]
Binabalangkas ng gabay na ito ang approach at ang mahahalagang design decisions nito. Iangkop po ito sa inyong language pair at mga available resource.
:::

## Kailan Ito Gagamitin

- Mayroon kayong **maliit na set ng napatunayang mga salin** (kahit 5–10 gold pairs ay nakatutulong)
- Nais ninyong maitugma ng LLM ang **partikular na estilo o register** sa pamamagitan ng halimbawa sa halip na tuntunin
- Ang inyong target language ay may mga pattern na **mas madaling ipakita kaysa ilarawan** (ayos ng salita, mga pattern ng affixation, mga marker ng pormalidad)

## Paano Ito Gumagana

1. **Mag-curate ng example pairs** — pumili ng mataas-ang-kalidad na source→target translations na nagpapakita ng mahahalagang pattern
2. **I-format bilang in-context examples** — isama ang mga ito sa system o user prompt bago ang aktuwal na kahilingan sa pagsasalin
3. **Patakbuhin ang harness** — sukatin kung napapahusay ng mga halimbawa ang metrics kumpara sa zero-shot
4. **Mag-iterate sa pagpili ng halimbawa** — palitan ang mga halimbawa upang masaklaw ang iba't ibang failure modes

## Halimbawang Istruktura ng Prompt

```
You are translating English to Plains Cree (SRO orthography).

Examples of correct translations:
- "Hello" → "tânisi"
- "Thank you" → "kinanâskomitin"  
- "I am going home" → "nikîwân"
- "The children are playing" → "awâsisak mêtawêwak"

Now translate the following:
- "Welcome to the school"
```

## Kritikal na Tuntunin: Walang Kontaminasyon ng Eval Data

:::danger[HUWAG gumamit ng evaluation data bilang few-shot examples]
Kung ang inyong examples ay nagmula sa evaluation dataset, ang inyong method ay **madidisqualify** mula sa leaderboard. Ang few-shot examples ay dapat magmula sa independent sources — dictionaries, textbooks, community-verified pairs, o hiwalay na development set. Gumagawa ang harness ng fingerprint ng eksakto ninyong prompt; natutukoy ang contamination.
:::

## Mga Pangunahing Desisyon sa Disenyo

**Ilang halimbawa?** 3–8 ang pinakamainam. Kapag mas kaunti, napakaliit ng signal para sa LLM; kapag mas marami, inuubos ang context window para sa lumiliit na dagdag na pakinabang.

**Aling mga halimbawa?** Unahin ang diversity kaysa difficulty. Saklawin ang iba't ibang istruktura ng pangungusap, haba ng salita, at katangiang gramatikal. Huwag ipumpol ang mga halimbawa sa iisang pattern.

**Static vs. dynamic selection?** Mas simple ang static examples. Ang dynamic selection (pagpili ng mga halimbawang kahawig ng kasalukuyang input) ay maaaring magpahusay ng kalidad ngunit nagdaragdag ng complexity — isaalang-alang ang [chained models](./chained-models) para sa retrieval step.

## Mga Kalamangan at Kahinaan

| | |
|---|---|
| ✅ Makapangyarihan para sa pagtutugma ng estilo | ❌ Nililimitahan ng maliit na context window ang bilang ng halimbawa |
| ✅ Walang kinakailangang training | ❌ Ang pagpili ng halimbawa ay isang sining, hindi agham |
| ✅ Gumagana sa anumang LLM | ❌ Panganib ng kontaminasyon ng eval data (diskuwalipikasyon) |
| ✅ Madaling mag-A/B test ng iba't ibang example sets | ❌ Maaaring hindi mag-generalize ang mga halimbawa sa lahat ng uri ng input |

## Mahusay na Naipapares Sa

- **[Coached LLM Prompting](./coached-llm-prompting)** — mas mahusay ang rules + examples na magkasama kaysa alinman nang mag-isa
- **[Dictionary-Augmented LLM](./dictionary-augmented-llm)** — forced terms + style examples
- **[FST-Gated Pipeline](./fst-gated-pipeline)** — mga halimbawa para sa estilo, FST para sa katumpakang morpolohikal

## Tingnan Din

- [Mga Tuntunin sa MT Evaluation](/docs/network/leaderboard/rules) — kung ano ang madidiskuwalipika
- [Evaluation Datasets](/docs/network/leaderboard/datasets) — alamin kung ano ang HINDI ninyo maaaring gamitin bilang mga halimbawa
- [Sumuporta sa Low-Resource Language](/docs/network/community/low-resource-languages)
