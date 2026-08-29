---
sidebar_position: 5
title: "Cookbook: Fine-Tuned na Modelo"
---

# Fine-Tuned na Model

> **Ang ideya:** I-fine-tune ang isang open-weight model (Llama, Mistral, Gemma) gamit ang parallel text para sa inyong target na pares ng wika. Posibleng ito ang may pinakamataas na antas ng kalidad, ngunit nangangailangan ito ng parallel data na maaaring kakaunti — at mahigpit ang mga panuntunan sa kontaminasyon ng eval data.

:::info[Ito ay cookbook, hindi isang tapos na implementasyon]
Binabalangkas ng gabay na ito ang approach, mga kinakailangan sa data, at mga pitfall. Ang aktuwal na imprastraktura para sa training ay wala sa saklaw ng harness.
:::

## Kailan Ito Gagamitin

- Mayroon kayong access sa isang **parallel corpus** (daan-daan hanggang libo-libong pares ng pangungusap) na **ganap na independiyente** sa evaluation dataset
- Mayroon kayong **GPU access** para sa training (lokal na hardware, cloud, o compute cluster ng unibersidad)
- Nais ninyo ang **pinakamataas na antas ng kalidad** para sa isang partikular na pares ng wika at handa kayong mamuhunan sa training
- Umabot na sa quality plateau ang ibang mga lapit (coached prompting, few-shot)

## Paano Ito Gumagana

1. **Bumuo ng parallel data** — mga pares ng pangungusap na source-target mula sa mga independiyenteng source (mga aklat-aralin, community archive, tala ng Hansard, tekstong panrelihiyon, materyales na pang-edukasyon)
2. **Ihanda ang training format** — instruction-tuning format (system prompt + input + inaasahang output)
3. **Mag-fine-tune** — LoRA/QLoRA sa isang base model (ginagawang posible ito ng 4-bit quantization sa mga consumer GPU)
4. **Suriin gamit ang harness** — patakbuhin ang fine-tuned na model sa pamamagitan ng eval harness
5. **Mag-iterate** — ayusin ang training data, hyperparameters, at pagpili ng base model

## Mga Kinakailangan sa Data

| Laki ng Corpus | Ano ang Aasahan |
|-------------|----------------|
| 50–200 pares | Bahagyang pagpapabuti kumpara sa zero-shot; maaaring mag-overfit |
| 200–1,000 pares | Kapansin-pansing pagpapabuti sa estilo at terminolohiya |
| 1,000–5,000 pares | Makabuluhang pagtaas ng kalidad para sa partikular na pares ng wika |
| 5,000+ pares | Papalapit sa pinakamataas na antas ng kalidad para sa base model |

:::danger[Kontaminasyon ng eval data = diskuwalipikasyon]
Ang inyong training data ay HINDI DAPAT mag-overlap sa evaluation dataset. Hindi ang mga pangungusap, hindi ang listahan ng vocabulary, at hindi ang mga paraphrase ng parehong content. Nagfi-fingerprint ang harness ng inyong mga output; natutukoy ang statistical overlap. Kung hindi kayo sigurado kung independent ang isang data source, piliin ang pagbubukod nito. Tingnan ang [Mga Panuntunan ng Leaderboard](/docs/network/leaderboard/rules).
:::

## Skeleton: LoRA Fine-Tuning

```python
# Conceptual skeleton — adapt to your framework (HuggingFace, Axolotl, etc.)

# 1. Format your parallel data as instruction pairs
training_data = [
    {"instruction": "Translate to Plains Cree (SRO)", 
     "input": "The children are playing",
     "output": "awâsisak mêtawêwak"},
    # ... hundreds more
]

# 2. Fine-tune with LoRA (4-bit for consumer GPUs)
# Base model: meta-llama/Llama-3.1-8B, google/gemma-2-9b, etc.
# Rank: 16–64, Alpha: 32–128, Epochs: 3–5

# 3. Export and serve via the harness TranslationMethod protocol
```

## Saan Makakahanap ng Parallel Data

- **Community archives** — mga materyales na pang-edukasyon, dokumento ng pamahalaan, bilingual na publikasyon
- **Nunavut Hansard** — 1.3M na naka-align na pares ng English-Inuktitut (NRC Canada)
- **Mga salin ng Bibliya** — available para sa maraming low-resource language, ngunit domain-specific
- **Mga aklat-araling pang-edukasyon** — kadalasang bilingual para sa mga konteksto ng pag-aaral ng wika
- **Gumawa ng sarili ninyo** — tingnan ang [Gabay sa Paglikha ng Corpus](./corpus-creation)

## Mga Kalamangan at Kahinaan

| | |
|---|---|
| ✅ Pinakamataas na antas ng kalidad | ❌ Nangangailangan ng parallel data (kakaunti para sa mga LRL) |
| ✅ Natututuhan ng model ang mga pattern na partikular sa wika | ❌ Gastos sa GPU (bagama’t nakatutulong ang LoRA) |
| ✅ Maaaring higitan ang mga prompted approach | ❌ Panganib ng overfitting sa maliliit na dataset |
| ✅ Isang beses na gastos sa training, pagkatapos ay murang inference | ❌ Mahihigpit na panuntunan sa kontaminasyon ng eval |

## Mahusay na Naipapares Sa

- **[Paglikha ng Corpus](./corpus-creation)** — buuin ang training data na kailangan ninyo
- **[Back-Translation](./back-translation)** — palawakin nang sintetiko ang inyong parallel corpus
- **[FST-Gated Pipeline](./fst-gated-pipeline)** — fine-tuned na model + morphological validation
- **[Coached LLM Prompting](./coached-llm-prompting)** — coaching sa ibabaw ng isang fine-tuned na base

## Tingnan Din

- [Mga Evaluation Dataset](/docs/network/leaderboard/datasets) — alamin kung ano ang HINDI ninyo maaaring gamitin sa training
- [Mga Panuntunan ng Leaderboard](/docs/network/leaderboard/rules) — patakaran sa kontaminasyon
- [Suportahan ang isang Low-Resource Language](/docs/network/community/low-resource-languages)
