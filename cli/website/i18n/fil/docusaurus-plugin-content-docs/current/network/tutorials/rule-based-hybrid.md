---
sidebar_position: 7
title: "Cookbook: Hybrid na Rule-Based + LLM"
---

# Hybrid na Nakabatay sa Panuntunan + LLM

> **Ang ideya:** Gumamit ng mga deterministikong tuntuning lingguwistiko para sa mga pattern na alam ninyong tama (morpolohikal na paglalapi, pag-format ng numero, kilalang mga istruktura ng parirala), at hayaan ang LLM na humawak sa malikhaing pagsasalin para sa iba pa. Nangingibabaw ang mga panuntunan sa LLM kung saan naaangkop ang mga ito; pinupunan ng LLM ang mga puwang.

:::info[Ito ay isang cookbook, hindi isang ganap na implementasyon]
Binabalangkas ng gabay na ito ang hybrid na arkitektura. Ang mga partikular na panuntunan ay ganap na nakadepende sa gramatika ng inyong target na wika at sa mga available na mapagkukunang pangwika.
:::

## Kailan Ito Gagamitin

- Mayroon po kayong **malalim na kadalubhasaang lingguwistiko** sa target language (o access sa isang linguist)
- Ang ilang pattern ng pagsasalin ay **deterministiko** — alam ninyo ang tamang output nang may katiyakan
- Ang LLM ay **palagiang nabibigo** sa mga partikular na pattern (pag-format ng numero, mga honorific, aglutinasyon)
- Nais ninyong **magarantiya ang kawastuhan** para sa mga pattern na kritikal ang epekto habang pinananatili ang katatasan para sa iba pa

## Paano Ito Gumagana

```
Input ──→ [Rule Engine] ──→ [LLM] ──→ [Merge] ──→ Output
              │                │           │
              │ Known patterns │ Unknown    │ Rules override
              │ handled here   │ parts      │ LLM where both
              ▼                ▼            ▼ produced output
         Deterministic     Creative     Final translation
         fragments         translation
```

1. **Tumukoy ng mga panuntunan** — mga regex pattern, FST lookup, lookup table para sa mga kilalang salin
2. **Mag-pre-process** — tukuyin at i-extract ang mga segment mula sa source na tumutugma sa panuntunan
3. **Nagsasalin ang LLM** — ang natitirang teksto, na may mga output ng panuntunan bilang mga constraint
4. **Pagsamahin** — buuing muli ang salin, na inuuna ang output ng panuntunan kung available
5. **I-validate** — opsyonal na FST/pagsusuri ng panuntunan sa pinagsamang resulta

## Halimbawa: Mga Panuntunan sa Numero at Petsa

```python
import re

# Rule: Numbers stay as-is (don't let the LLM hallucinate number translations)
def rule_preserve_numbers(text):
    return re.sub(r'\b\d+\b', lambda m: f'__NUM_{m.group()}__', text)

# Rule: Known greetings have exact translations
GREETING_RULES = {
    "hello": "tânisi",
    "goodbye": "êkosi",
    "thank you": "kinanâskomitin",
}

# Rule: Date format conversion
def rule_date_format(text):
    # "January 15" → "kisê-pîsim 15" (deterministic month mapping)
    ...
```

## Mga Pangunahing Desisyon sa Disenyo

**Priyoridad ng panuntunan:** Kapag parehong gumagawa ng output ang isang panuntunan at ang LLM para sa iisang segment, alin ang mananaig? Dapat manaig ang mga panuntunan para sa mga pattern na **kritikal sa kawastuhan**. Dapat manaig ang LLM para sa mga pattern na **kritikal sa katatasan**.

**Granularity:** Mga panuntunan sa antas-salita (dictionary lookup) kumpara sa mga panuntunan sa antas-parirala (idiom mapping) kumpara sa mga estruktural na panuntunan (muling pag-aayos ng pangungusap). Magsimula sa antas-salita; magdagdag ng antas-parirala habang natutukoy ninyo ang mga pattern.

**Pagpapanatili ng panuntunan:** Ang bawat panuntunan ay isang obligasyon sa pagpapanatili. Mas piliin ang maliit na set ng mga panuntunang mataas ang kumpiyansa kaysa malaking set ng mga tinatayang panuntunan. Kung hindi po kayo sigurado na tama ang isang panuntunan, ipaubaya ito sa LLM.

## Mga Kalamangan at Kahinaan

| | |
|---|---|
| ✅ Garantisadong kawastuhan kung saan naaangkop ang mga panuntunan | ❌ Nangangailangan ng malalim na kadalubhasaang lingguwistiko |
| ✅ Transparent — nababasa at naa-audit ang mga panuntunan | ❌ Maaaring makalikha ang hangganan ng panuntunan/LLM ng hindi natural na output |
| ✅ Mabilis ang mga panuntunan (walang gastos sa API) | ❌ Lumalaki ang pasanin sa pagpapanatili kasabay ng bilang ng mga panuntunan |
| ✅ Progresibo — magdagdag ng mga panuntunan habang natututo kayo | ❌ Mahirap hawakan ang inflection sa mga hangganan ng panuntunan |

## Mahusay na Naipapares Sa

- **[FST-Gated Pipeline](./fst-gated-pipeline)** — FST bilang isang partikular na uri ng rule engine
- **[Dictionary-Augmented LLM](./dictionary-augmented-llm)** — ang dictionary lookup ay isang simpleng panuntunan
- **[Coached LLM Prompting](./coached-llm-prompting)** — hinahawakan ng coaching ang malalambot na kagustuhan, hinahawakan ng mga panuntunan ang mahihigpit na requirement

## Tingnan Din

- [GiellaLT](https://giellalt.github.io/) — open-source na FST infrastructure para sa 100+ wika
- [Apertium](https://www.apertium.org/) — rule-based MT platform na may mga bilingual dictionary
- [Suportahan ang isang Low-Resource Language](/docs/network/community/low-resource-languages)
