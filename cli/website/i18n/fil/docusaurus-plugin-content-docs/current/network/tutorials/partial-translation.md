---
sidebar_position: 10
title: "Cookbook: Bahagyang Pagsasalin (Tao + Makina)"
---

# Bahagyang Pagsasalin (Tao + Makina)

> **Ang ideya:** Manu-manong magsalin ng kinatawang sample, patunayan na tumutugma ang inyong pamamaraang pangmakina sa estilo ng tao sa sample na iyon, pagkatapos ay awtomatikong isalin ang natitirang malaking bahagi. Pinagsasama nito ang kalidad ng tao at saklaw ng makina — ang tao ang nagtatakda ng pamantayan, at sinusundan ito ng makina.

:::info[Ito ay isang cookbook, hindi isang tapos na implementasyon]
Binabalangkas ng gabay na ito ang hybrid na daloy ng trabaho ng tao at makina. Lalo itong may kaugnayan para sa mga ahensiya ng pagsasalin, mga manggagawa sa wika ng komunidad, at mga kontekstong pang-edukasyon.
:::

## Kailan Ito Gagamitin

- Mayroon kayong **access sa matatas na mga tagapagsalita** ngunit limitado ang kanilang oras
- Kailangan ninyong magsalin ng **malaking volume** ngunit maliit na bahagi lamang ang kailangang maging perpekto
- Nais ninyong **magtatag ng batayang kalidad** sa pamamagitan ng pagsasalin ng tao, pagkatapos ay palawakin ito gamit ang MT
- Gumagawa kayo sa isang **kontekstong pang-edukasyon o pangkomunidad** kung saan posible ang human review ng isang subset

## Paano Ito Gumagana

```
[Full corpus: 1,000 entries]
        │
        ├── [100 entries] ──→ Human translator ──→ Gold translations
        │                                              │
        │                                              ▼
        │                                    Train / prompt machine
        │                                    method to match style
        │                                              │
        └── [900 entries] ──→ Machine method ──→ Auto translations
                                                       │
                                                       ▼
                                              [Optional: human review
                                               of flagged entries]
```

1. **Pumili ng kinatawang sample** — saklawin ang iba't ibang uri ng pangungusap, haba, at paksa
2. **Ipasalin sa tao ang sample** — itatag ang gold standard para sa estilo, register, at terminolohiya
3. **I-configure ang inyong pamamaraang pangmakina** — gamitin ang mga pagsasaling ginawa ng tao bilang coaching data, few-shot examples, o fine-tuning data
4. **I-score ang makina sa human sample** — tumutugma ba ang makina sa estilo ng tao?
5. **Awtomatikong isalin ang natitira** — kung katanggap-tanggap ang kalidad ng makina sa sample
6. **Opsyonal na human review** — i-flag ang mga output na mababa ang confidence para marepaso ng tagapagsalita

## Quality Assurance: Ang Style Match Test

```bash
# Translate the human-translated sample with your machine method
mt-eval run \
  --corpus data/human-sample.json \
  --name coached-v3

# Compare: does the machine match the human translator's choices?
# Look at: chrF++ (similarity), FST acceptance (validity),
# and qualitative patterns (register, formality, terminology)
```

## Pagpili ng Sample

**Saklawin ang distribution.** Dapat kasama sa inyong 100 entries ang:
- Maiikling parirala (1–3 salita) at buong pangungusap
- Karaniwang bokabularyo at mga terminong partikular sa domain
- Mga simpleng structure at mga kumplikado
- Maraming grammatical features (mga tanong, imperatives, conditionals)

**Huwag pumili lamang ng madadali.** Kailangang kasama sa sample ang mga entry na malamang mahirapan ang inyong pamamaraan — doon pinakamahalaga ang kalidad ng tao.

## Ang Community Review Workflow

Para sa mga pamayanan ng wikang Katutubo, iginagalang ng pamamaraang ito ang oras ng mga tagapagsalita:

1. **Isinasalin ng tagapagsalita ang 50–100 entries** (2–4 na oras ng nakapokus na trabaho)
2. **Isinasalin ng makina ang natitirang 900** gamit ang gawa ng tagapagsalita bilang coaching data
3. **Nirerepaso ng tagapagsalita ang mga na-flag na entry** — ang mga entry lamang na pinakamababa ang confidence ng makina (karagdagang 1–2 oras)
4. **Resulta:** 1,000 pagsasalin na malapit sa kalidad ng tao, gamit ang ~5 oras ng tagapagsalita sa halip na ~50

## Mga Kalamangan at Kahinaan

| | |
|---|---|
| ✅ Pinagsasama ang kalidad ng tao at saklaw ng makina | ❌ Nangangailangan ng paunang investment mula sa tao |
| ✅ Iginagalang ang limitadong availability ng tagapagsalita | ❌ Maaaring hindi makuha ng makina ang lahat ng stylistic nuances |
| ✅ Natural na workflow para sa quality assurance | ❌ Naaapektuhan ng pagpili ng sample ang kabuuang kalidad |
| ✅ Mahusay para sa mga kontekstong pangkomunidad/pang-edukasyon | ❌ Nagiging bottleneck ang human review para sa mga na-flag na entry |

## Mahusay na Naipapares Sa

- **[Coached LLM Prompting](./coached-llm-prompting)** — nagbibigay-impormasyon ang mga pagsasalin ng tao sa coaching data
- **[Few-Shot Prompting](./few-shot-prompting)** — mga pagsasalin ng tao bilang in-context examples
- **[Paglikha ng Corpus](./corpus-creation)** — ang human sample AY corpus creation

## Tingnan Din

- [Para sa mga Pamayanang Pangwika](/docs/network/community/for-language-communities) — modelo ng community engagement
- [Data Sovereignty](/docs/network/sovereignty/data-sovereignty) — pagmamay-ari ng translation data
- [Suportahan ang isang Low-Resource Language](/docs/network/community/low-resource-languages)
