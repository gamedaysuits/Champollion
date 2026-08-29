---
sidebar_position: 6
title: "Cookbook: Mga Pinagdugtong na Modelo"
---

# Mga Naka-chain na Model (Multi-Stage Pipeline)

> **Ang ideya:** Gumagawa ang Model A ng rough translation → ipino-post-edit ito ng Model B → ini-score o vina-validate ng Model C ang resulta. Bawat stage ay espesyalisado sa isang bagay. Mas mahusay ang output ng pipeline kaysa sa alinmang iisang model lamang.

:::info[Ito ay isang cookbook, hindi isang kumpletong implementasyon]
Binabalangkas ng gabay na ito ang arkitektura ng multi-stage pipeline. Nakadepende ang mga partikular na model at configuration ng chain sa inyong language pair at budget.
:::

## Kailan Ito Gagamitin

- Nagbibigay ang isang model ng **hindi konsistent na kalidad** — mahusay sa ilang input, mahina sa iba
- Nais ninyong **ihiwalay ang generation mula sa validation** — isang model ang lumilikha, isa pa ang nagsusuri
- May budget kayo para sa **maramihang API call bawat translation** (ang latency at gastos ay linear na tumataas ayon sa bilang ng stages)
- Nais ninyong pagsamahin ang mga model na may **magkakaibang lakas** (hal., isang creative generator + isang precise editor)

## Paano Ito Gumagana

```
Input ──→ [Stage 1: Generator] ──→ [Stage 2: Editor] ──→ [Stage 3: Validator] ──→ Output
              │                         │                        │
              │ "Translate this"        │ "Fix errors in         │ "Rate 1-5 and
              │                         │  this translation"     │  flag issues"
              ▼                         ▼                        ▼
         Raw translation          Polished translation      Score + accept/reject
```

## Halimbawa: Three-Stage Pipeline

```python
# Stage 1: Fast model generates candidate
raw = await fast_model.translate(source, target_lang="crk")

# Stage 2: Strong model post-edits
edited = await strong_model.complete(
    f"The following {target_lang} translation may contain errors. "
    f"Fix any grammatical or vocabulary mistakes:\n"
    f"Source: {source}\nTranslation: {raw}\nCorrected:"
)

# Stage 3: Validator model scores
score = await validator.complete(
    f"Rate this translation 1-5 for accuracy and fluency:\n"
    f"Source: {source}\nTranslation: {edited}\nScore:"
)

# Accept if score >= 3, otherwise retry Stage 1 with different temperature
```

## Mga Karaniwang Chain Pattern

| Pattern | Mga Stage | Gamit |
|---------|--------|----------|
| **Generate → Edit** | Fast LLM → Strong LLM | Cost-efficient na pagpapahusay ng kalidad |
| **Generate → Validate → Retry** | LLM → FST/rules → LLM (retry kapag nabigo) | Morphological correctness (tingnan ang [FST-Gated](./fst-gated-pipeline)) |
| **Generate → Back-translate → Score** | LLM(en→crk) → LLM(crk→en) → compare | Round-trip consistency check |
| **Ensemble → Vote** | 3 LLM nang independiyente → majority vote | Robustness sa pamamagitan ng diversity |

## Mga Pangunahing Desisyon sa Disenyo

**Latency budget:** Pinararami ng bawat stage ang latency. Isang 3-stage chain na may 2s bawat stage = 6s bawat translation. Para sa batch evaluation, ayos ito; para sa real-time, maaaring hindi.

**Cost multiplier:** 3 stages = 3× ang API cost. Gumamit ng mas murang models para sa mga maagang stage, at mas mahal na models para sa mga critical stage.

**Error propagation:** Maaaring iligaw ng masamang output ng Stage 1 ang Stage 2. Isama ang orihinal na source sa bawat stage upang makabawi ang mga susunod na model.

## Mga Kalamangan at Kahinaan

| | |
|---|---|
| ✅ Maaaring pagsamahin ang lakas ng mga specialist | ❌ Dumodoble o dumarami ang latency at gastos bawat stage |
| ✅ Separation of concerns (generate vs. validate) | ❌ Kumplikadong i-debug — aling stage ang nagpasok ng error? |
| ✅ Madaling palitan ang indibiduwal na stages | ❌ Error propagation sa pagitan ng stages |
| ✅ Nahuhuli ng round-trip validation ang hallucinations | ❌ Diminishing returns lampas sa 2-3 stages |

## Mahusay na Naipapares Sa

- **[FST-Gated Pipeline](./fst-gated-pipeline)** — FST bilang validation stage
- **[Dictionary-Augmented LLM](./dictionary-augmented-llm)** — dictionary injection sa generation stage
- **[Coached LLM Prompting](./coached-llm-prompting)** — coaching sa isa o higit pang stages

## Tingnan Din

- [Eval Harness](/docs/network/specifications/harness) — sinusukat ng harness ang end-to-end pipeline output
- [Run Card Specification](/docs/network/specifications/run-card) — itinatala ang latency at gastos bawat entry
- [Suportahan ang Low-Resource Language](/docs/network/community/low-resource-languages)
