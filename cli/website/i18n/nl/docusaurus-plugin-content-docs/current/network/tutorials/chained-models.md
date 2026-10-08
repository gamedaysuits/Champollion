---
sidebar_position: 6
title: "Kookboek: Geketende Modellen"
---

# Geketende Modellen (Meerfasige Pipeline)

> **Het idee:** Model A genereert een ruwe vertaling → Model B bewerkt deze na → Model C beoordeelt of valideert het resultaat. Elke fase is gespecialiseerd in één taak. De uitvoer van de pipeline is beter dan die van elk afzonderlijk model.

:::info[Dit is een kookboek, geen kant-en-klare implementatie]
Deze handleiding schetst een meertraps pipeline-architectuur. De specifieke modellen en ketenconfiguratie zijn afhankelijk van uw taalpaar en budget.
:::

## Wanneer gebruikt u dit

- Een enkel model produceert **inconsistente kwaliteit** — goed op sommige invoer, slecht op andere
- U wilt **generatie van validatie scheiden** — één model maakt, een ander bekritiseert
- U heeft budget voor **meerdere API-aanroepen per vertaling** (latentie en kosten schalen lineair met het aantal fasen)
- U wilt modellen combineren met **verschillende sterktes** (bijv. een creatieve generator + een nauwkeurige redacteur)

## Hoe het werkt

```
Input ──→ [Stage 1: Generator] ──→ [Stage 2: Editor] ──→ [Stage 3: Validator] ──→ Output
              │                         │                        │
              │ "Translate this"        │ "Fix errors in         │ "Rate 1-5 and
              │                         │  this translation"     │  flag issues"
              ▼                         ▼                        ▼
         Raw translation          Polished translation      Score + accept/reject
```

## Voorbeeld: Drieledige Pipeline

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

## Veelvoorkomende Ketenpatronen

| Patroon | Fasen | Gebruikssituatie |
|---------|-------|-----------------|
| **Genereer → Bewerk** | Snelle LLM → Sterke LLM | Kostenefficiënte kwaliteitsverbetering |
| **Genereer → Valideer → Herhaal** | LLM → FST/regels → LLM (herhaal bij mislukking) | Morfologische correctheid (zie [FST-Gated](./fst-gated-pipeline)) |
| **Genereer → Terugvertaal → Beoordeel** | LLM(en→crk) → LLM(crk→en) → vergelijk | Consistentiecontrole via retourvertaling |
| **Ensemble → Stem** | 3 LLM's onafhankelijk → meerderheidsstemming | Robuustheid door diversiteit |

## Belangrijke ontwerpbeslissingen

**Latentiebudget:** Elke fase vermenigvuldigt de latentie. Een keten van 3 fasen met 2 seconden per fase = 6 seconden per vertaling. Voor batchevaluatie is dit acceptabel; voor realtime toepassingen mogelijk niet.

**Kostenvermenigvuldiger:** 3 fasen = 3× de API-kosten. Gebruik goedkopere modellen voor vroege fasen, duurdere modellen voor kritieke fasen.

**Foutpropagatie:** Een slechte uitvoer van Fase 1 kan Fase 2 op het verkeerde spoor zetten. Neem de originele brontekst op in elke fase, zodat latere modellen zich kunnen herstellen.

## Voor- en nadelen

| | |
|---|---|
| ✅ Kan specialistische sterktes combineren | ❌ Latentie en kosten vermenigvuldigen per fase |
| ✅ Scheiding van verantwoordelijkheden (genereren vs. valideren) | ❌ Complex om te debuggen — welke fase introduceerde de fout? |
| ✅ Eenvoudig afzonderlijke fasen te vervangen | ❌ Foutpropagatie tussen fasen |
| ✅ Retourvertaalvalidatie detecteert hallucinaties | ❌ Afnemende meeropbrengst na 2-3 fasen |

## Combineert goed met

- **[FST-Gated Pipeline](./fst-gated-pipeline)** — FST als validatiefase
- **[Dictionary-Augmented LLM](./dictionary-augmented-llm)** — woordenboekinjectie in de generatiefase
- **[Coached LLM Prompting](./coached-llm-prompting)** — coaching in één of meerdere fasen

## Zie ook

- [Eval Harness](/docs/network/specifications/harness) — de harness meet de end-to-end pipeline-uitvoer
- [Run Card Specification](/docs/network/specifications/run-card) — latentie en kosten worden per invoer geregistreerd
- [Ondersteuning van een Taal met Weinig Middelen](/docs/network/community/low-resource-languages)
