---
sidebar_position: 3
title: "Kookboek: Few-Shot Prompting"
---

# Few-Shot Prompting

> **Het idee:** Neem geverifieerde, hoogwaardige vertaalparen op als in-context voorbeelden, zodat het LLM de patronen, stijl en conventies van de doeltaal leert via demonstratie in plaats van instructie.

:::info[Dit is een kookboek, geen kant-en-klare implementatie]
Deze handleiding schetst de aanpak en de belangrijkste ontwerpbeslissingen. Pas deze aan uw taalcombinatie en beschikbare middelen aan.
:::

## Wanneer gebruikt u dit

- U beschikt over een **kleine set geverifieerde vertalingen** (zelfs 5–10 gouden paren helpen)
- U wilt dat het LLM een **specifieke stijl of register** nabootst via voorbeelden in plaats van regels
- Uw doeltaal heeft patronen die **gemakkelijker te tonen dan te beschrijven zijn** (woordvolgorde, affixatiepatronen, formaliteitsmarkeringen)

## Hoe het werkt

1. **Voorbeeldparen samenstellen** — selecteer hoogwaardige bron→doelvertalingen die sleutelpatronen demonstreren
2. **Opmaken als in-context voorbeelden** — neem ze op in de systeem- of gebruikersprompt vóór het eigenlijke vertaalverzoek
3. **De harness uitvoeren** — meet of voorbeelden de metrics verbeteren ten opzichte van zero-shot
4. **Voorbeeldselectie verfijnen** — wissel voorbeelden uit om verschillende faalpatronen te dekken

## Voorbeeldpromptstructuur

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

## Kritieke regel: geen contaminatie van evaluatiedata

:::danger[Gebruik GEEN evaluatiedata als few-shot voorbeelden]
Als uw voorbeelden afkomstig zijn uit de evaluatiedataset, wordt uw methode **gediskwalificeerd** van het leaderboard. Few-shot voorbeelden moeten afkomstig zijn uit onafhankelijke bronnen — woordenboeken, leerboeken, door de gemeenschap geverifieerde paren, of een afzonderlijke ontwikkelingsset. De testomgeving maakt een vingerafdruk van uw exacte prompt; contaminatie is detecteerbaar.
:::

## Belangrijke ontwerpbeslissingen

**Hoeveel voorbeelden?** 3–8 is het optimale bereik. Minder geeft het LLM te weinig signaal; meer verbruikt het contextvenster voor afnemende meeropbrengsten.

**Welke voorbeelden?** Geef prioriteit aan diversiteit boven moeilijkheidsgraad. Dek verschillende zinsstructuren, woordlengtes en grammaticale kenmerken. Cluster voorbeelden niet rond één patroon.

**Statische versus dynamische selectie?** Statische voorbeelden zijn eenvoudiger. Dynamische selectie (voorbeelden kiezen die vergelijkbaar zijn met de huidige invoer) kan de kwaliteit verbeteren, maar voegt complexiteit toe — overweeg [geketende modellen](./chained-models) voor de retrievalstap.

## Voor- en nadelen

| | |
|---|---|
| ✅ Krachtig voor stijlnabootsing | ❌ Klein contextvenster beperkt het aantal voorbeelden |
| ✅ Geen training vereist | ❌ Voorbeeldselectie is een kunst, geen wetenschap |
| ✅ Werkt met elk LLM | ❌ Risico op contaminatie van evaluatiedata (diskwalificatie) |
| ✅ Eenvoudig A/B-testen van verschillende voorbeeldsets | ❌ Voorbeelden generaliseren mogelijk niet naar alle invoertypes |

## Combineert goed met

- **[Coached LLM Prompting](./coached-llm-prompting)** — regels en voorbeelden samen presteren beter dan elk afzonderlijk
- **[Dictionary-Augmented LLM](./dictionary-augmented-llm)** — verplichte termen gecombineerd met stijlvoorbeelden
- **[FST-Gated Pipeline](./fst-gated-pipeline)** — voorbeelden voor stijl, FST voor morfologische correctheid

## Zie ook

- [MT Evaluation Rules](/docs/network/leaderboard/rules) — wat leidt tot diskwalificatie
- [Evaluation Datasets](/docs/network/leaderboard/datasets) — weet wat u NIET als voorbeelden mag gebruiken
- [Ondersteuning van een taal met weinig middelen](/docs/network/community/low-resource-languages)
