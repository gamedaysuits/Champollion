---
sidebar_position: 9
title: "Kookboek: Evolutionair / Zoekgebaseerd"
---

# Evolutionaire / Zoekgebaseerde Vertaling

> **Het idee:** Genereer meerdere kandidaatvertalingen, beoordeel ze aan de hand van een fitnessfunctie (chrF++, FST-acceptatie, round-trip-consistentie), muteer de beste kandidaten en herhaal. Natuurlijke selectie voor vertalingen — de sterkste overleven.

:::info[Dit is een kookboek, geen voltooide implementatie]
Dit is de meest experimentele aanpak in de kookboekreeks. Het is nog niet bewezen voor MT op schaal, maar de architectuur is solide en de testomgeving beoordeelt zonder problemen wat het ook produceert.
:::

## Wanneer gebruikt u dit

- U beschikt over een **goede scoringsfunctie**, maar geen enkel model levert consistente resultaten
- U wilt de **oplossingsruimte** breder verkennen dan een enkele greedy-generatie mogelijk maakt
- U heeft **rekenbudget** voor veel parallelle generaties (tientallen kandidaten per invoer)
- U bent geïnteresseerd in **nieuw onderzoek** — deze aanpak is onderbelicht voor MT met weinig bronmateriaal

## Hoe het werkt

```
[Generation 0]    Generate N candidates (different models, temperatures, prompts)
       │
       ▼
[Score]           Evaluate each candidate: chrF++, FST acceptance, fluency
       │
       ▼
[Select]          Keep top K performers
       │
       ▼
[Mutate]          Prompt an LLM: "improve this translation, fix these issues"
       │
       ▼
[Generation 1]    Score again. Repeat for G generations.
       │
       ▼
[Output]          Best-scoring candidate from final generation
```

## Skelet

```python
async def evolutionary_translate(source, reference=None, generations=3, pop_size=8):
    # Generation 0: diverse candidates
    population = []
    for model in ["gemini-2.5-pro", "gpt-4o", "claude-sonnet-4-6"]:
        for temp in [0.3, 0.7, 1.0]:
            candidate = await translate(source, model=model, temperature=temp)
            population.append(candidate)
    
    for gen in range(generations):
        # Score each candidate
        scored = [(c, score(c, reference)) for c in population]
        scored.sort(key=lambda x: x[1], reverse=True)
        
        # Select top K
        survivors = [c for c, s in scored[:pop_size // 2]]
        
        # Mutate: ask LLM to improve each survivor
        mutants = []
        for survivor in survivors:
            mutant = await improve(source, survivor, feedback=scored[0])
            mutants.append(mutant)
        
        population = survivors + mutants
    
    return max(population, key=lambda c: score(c, reference))
```

## Ontwerp van de Fitnessfunctie

De fitnessfunctie is allesbepalend. Opties:

| Metriek | Wat Het Meet | Geautomatiseerd? |
|--------|-----------------|------------|
| chrF++ ten opzichte van referentie | Overeenkomst op tekenniveau met de gouden standaard | ✅ Ja |
| FST-acceptatiegraad | Morfologische geldigheid | ✅ Ja (indien FST beschikbaar) |
| Round-trip-consistentie | Wordt de bron hersteld bij terugvertaling? | ✅ Ja |
| LLM-as-judge | Een andere LLM beoordeelt vloeiendheid/nauwkeurigheid | ✅ Ja (maar ruis) |
| Aanwezigheid van woordenboektermen | Komen bekende termen correct voor? | ✅ Ja |

:::tip[Combineer meerdere signalen]
Een gewogen combinatie van meetwaarden levert een robuustere fitnessfunctie op dan welke afzonderlijke meetwaarde dan ook. Dit weerspiegelt de eigen [samengestelde score](/docs/network/leaderboard/rules) van de testomgeving.
:::

## Voor- en nadelen

| | |
|---|---|
| ✅ Verkent diverse oplossingen | ❌ Rekenintensief (N × G API-aanroepen) |
| ✅ Kan benaderingen ontdekken die geen enkel model afzonderlijk vindt | ❌ Vereist een goede fitnessfunctie |
| ✅ Paralleliseerbaar | ❌ Traag — meerdere generaties per vertaling |
| ✅ Modelonafhankelijk | ❌ Afnemende meeropbrengst na enkele generaties |

## Combineert goed met

- **[Geketende Modellen](./chained-models)** — de mutatiestap is een vorm van ketening
- **[FST-Gated Pipeline](./fst-gated-pipeline)** — FST-acceptatie als fitnesssignaal
- **[Dictionary-Augmented LLM](./dictionary-augmented-llm)** — aanwezigheid van woordenboektermen als fitnesssignaal

## Zie ook

- [Run Card-specificatie](/docs/network/specifications/run-card) — kosten en latentie worden per invoer geregistreerd
- [Eval Harness](/docs/network/specifications/harness) — de harness beoordeelt uw uiteindelijke uitvoer, niet uw proces
- [Ondersteuning van een taal met weinig bronmateriaal](/docs/network/community/low-resource-languages)
