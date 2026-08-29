---
sidebar_position: 8
title: "Cookbook: Augmentasyon gamit ang Back-Translation"
---

# Augmentation sa Pamamagitan ng Back-Translation

> **Ang ideya:** Bumuo ng sintetikong parallel data sa pamamagitan ng pagsasalin ng umiiral na tekstong nasa wikang target pabalik sa wikang pinagmulan, pagkatapos ay gamitin ang mga sintetikong pares na ito upang magsanay o mag-prompt ng forward model. Pinapalawak nito ang inyong parallel corpus nang mura — ngunit may mga babala tungkol sa kalidad.

:::info[Ito ay isang cookbook, hindi isang tapos na implementasyon]
Binabalangkas ng gabay na ito ang estratehiya at ang mahahalagang panganib nito. Makapangyarihan ang back-translation ngunit maaari nitong palakihin ang mga error kung hindi ito gagawin nang maingat.
:::

## Kailan Ito Gagamitin

- Mayroon kayong **monolingual na teksto sa wikang target** ngunit limitado ang parallel data
- Nais ninyong **palawakin ang training corpus** para sa [fine-tuning](./fine-tuned-model) nang walang manual na pagsasalin
- Kailangan ninyo ng **mas maraming few-shot examples** ngunit hindi makakuha ng human translations nang sapat na mabilis
- Handa kayong **mahigpit na mag-quality-filter** ng sintetikong data

## Paano Ito Gumagana

```
[Target-language text]          "awâsisak mêtawêwak"
        │
        ▼
[Back-translate to source]      "The children are playing"  (via LLM or MT API)
        │
        ▼
[Create synthetic pair]         ("The children are playing", "awâsisak mêtawêwak")
        │
        ▼
[Quality filter]                Keep only high-confidence pairs
        │
        ▼
[Use for training/prompting]    Expand your parallel corpus
```

1. **Mangolekta ng monolingual na teksto** — mga aklat, artikulo, transcript, at social media sa wikang target
2. **Mag-back-translate** — gumamit ng LLM o MT API upang isalin ang bawat pangungusap sa wikang pinagmulan
3. **Mag-quality filter** — round-trip (isalin muli pabalik) at ihambing; panatilihin ang mga pares kung saan ang round-trip ≈ orihinal
4. **Gamitin ang sintetikong corpus** — para sa fine-tuning, few-shot examples, o coaching data

## Pag-filter ng Kalidad: Ang Round-Trip Test

```python
# Pseudo-code for round-trip quality filtering
for target_text in monolingual_corpus:
    # Back-translate: target → source
    synthetic_source = translate(target_text, "crk", "en")
    
    # Forward-translate: source → target
    round_trip = translate(synthetic_source, "en", "crk")
    
    # Compare round-trip to original
    chrf_score = compute_chrf(target_text, round_trip)
    
    if chrf_score > 0.70:  # High similarity = high-quality pair
        parallel_corpus.append((synthetic_source, target_text))
```

## Kritikal na Pitfall: Pagpapalaki ng Error

:::warning[Pinapalaki ng back-translation ang umiiral na mga bias ng model]
Kung ang inyong back-translation model ay palaging gumagawa ng parehong mga error, ie-encode ng inyong synthetic corpus ang mga error na iyon bilang "tama." Lumilikha ito ng feedback loop: mag-train sa masamang data → gumawa ng mas malalang mga translation → bumuo ng mas malalang synthetic data. **Palaging mag-quality-filter nang mahigpit** at ihalo ang synthetic data sa mga beripikadong human translation.
:::

## Saan Makakahanap ng Monolingual na Teksto

- Mga newsletter, pahayagan, at publikasyon ng komunidad
- Mga dokumento ng pamahalaan sa wikang target (hal., Nunavut Hansard para sa Inuktitut)
- Mga materyales pang-edukasyon at textbook
- Mga tekstong panrelihiyon (malawak na magagamit para sa maraming wika)
- Social media (may naaangkop na pahintulot at pag-filter ng kalidad)
- Na-transcribe na audio/video mula sa mga programa sa wika

## Mga Kalamangan at Kahinaan

| | |
|---|---|
| ✅ Murang napapalawak ang training data | ❌ Pinapalaki ang mga error ng modelo kung hindi na-filter |
| ✅ Gumagamit ng masaganang monolingual na teksto | ❌ Limitado ang quality ceiling ng back-translation model |
| ✅ Madaling bumuo nang maramihan | ❌ Compute-intensive ang round-trip filtering |
| ✅ Kahalili at karagdagan sa iba pang approach | ❌ Hindi kailanman kasinghusay ng human translation ang sintetikong data |

## Mahusay na Naipapares Sa

- **[Fine-Tuned Model](./fine-tuned-model)** — lumilikha ang back-translation ng training data para sa fine-tuning
- **[Corpus Creation](./corpus-creation)** — dinaragdagan ng sintetikong data ang mga corpus na nilikha ng tao
- **[Coached LLM Prompting](./coached-llm-prompting)** — maaaring makatulong ang synthetic examples sa coaching dictionaries

## Tingnan Din

- [Evaluation Datasets](/docs/network/leaderboard/datasets) — hindi dapat mag-overlap ang sintetikong data sa eval data
- [Leaderboard Rules](/docs/network/leaderboard/rules) — patakaran sa contamination
- [Suportahan ang Low-Resource Language](/docs/network/community/low-resource-languages)
