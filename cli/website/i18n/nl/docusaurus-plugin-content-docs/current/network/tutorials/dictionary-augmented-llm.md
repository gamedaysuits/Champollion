---
sidebar_position: 4
title: "Kookboek: Woordenboek-aangevulde LLM"
---

# Woordenboek-Aangevulde LLM

> **Het idee:** Dwing bekende, geverifieerde vertalingen af voor specifieke termen uit een tweetalig woordenboek, en laat de LLM de zinsstructuur en onbekende woordenschat afhandelen. Het woordenboek biedt ankerpunten van correctheid; de LLM zorgt voor vloeiendheid.

:::info[Dit is een kookboek, geen kant-en-klare implementatie]
Deze handleiding schetst de aanpak. De specifieke woordenboekovereenkomst en injectiestrategie zijn afhankelijk van uw taalpaar en beschikbare lexicale bronnen.
:::

## Wanneer gebruikt u dit

- Er **bestaat een tweetalig woordenboek** voor uw taalpaar (zelfs een klein exemplaar)
- De LLM **hallucineert consequent sleuteltermen** — hij verzint woorden die niet bestaan
- U hebt **terminologische consistentie** nodig over vertalingen heen (hetzelfde woord overal op dezelfde manier vertaald)
- U vertaalt **domeinspecifieke inhoud** waarbij standaard LLM-vertalingen onjuist zijn (juridisch, medisch, educatief)

## Hoe Het Werkt

1. **Laad een tweetalig woordenboek** — sleutel-waardeparen die brontermen koppelen aan geverifieerde doelvertalingen
2. **Vergelijk brontekst met het woordenboek** — identificeer termen in de invoer waarvoor bekende vertalingen bestaan
3. **Injecteer overeenkomsten in de prompt** — vertel de LLM "deze termen MOETEN als volgt worden vertaald"
4. **LLM genereert de vertaling** — met woordenboekbeperkingen als harde vereisten
5. **Naverwerking** — verifieer dat woordenboektermen in de uitvoer voorkomen; probeer opnieuw als dat niet het geval is

## Woordenboekformaat

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

## Promptstructuur

```
Translate the following English to Plains Cree (SRO).

REQUIRED TERMINOLOGY — use these exact translations:
- "school" → "kiskinwahamâtowikamik"
- "teacher" → "okiskinwahamâkêw"

Source: "The teacher went to the school"
```

## Belangrijke ontwerpbeslissingen

**Matchingstrategie:** Exacte overeenkomst is het eenvoudigst. Gelemmatiseerde matching ("teachers" komt overeen met "teacher") vangt meer op, maar vereist een lemmatiseerder voor de brontaal. Fuzzy matching brengt het risico van valse positieven met zich mee.

**Verbuigingsafhandeling:** In polysynthetische talen moet de woordenboekvorm mogelijk worden verbogen om in de zin te passen. U kunt de stam opgeven en de LLM laten verbuigen, of meerdere verbogen vormen opgeven. Een [FST](./fst-gated-pipeline) kan het resultaat valideren.

**Conflictoplossing:** Wat als de LLM een woordenboekterm negeert? Opties: (a) opnieuw proberen met een sterkere instructie, (b) naverwerken via stringvervanging, (c) accepteren en markeren voor beoordeling.

## Voor- en nadelen

| | |
|---|---|
| ✅ Elimineert hallucinatie voor bekende termen | ❌ Woordenboekdekking is altijd onvolledig |
| ✅ Garandeert consistentie voor sleutelwoordenschat | ❌ Verbuiging/vervoeging sluit mogelijk niet aan bij de zinscontext |
| ✅ Eenvoudig te controleren en bij te werken | ❌ Overmatige beperking kan onnatuurlijke uitvoer opleveren |
| ✅ Het woordenboek is een herbruikbaar hulpmiddel | ❌ Vereist dat er een woordenboek bestaat |

## Waar Woordenboeken Te Vinden

- **[itwêwina](https://itwewina.altlab.app/)** — Plains Cree–Engels (FST-aangedreven; het morphodict-platform is open source — de inhoud van het woordenboek zelf heeft geen open licentie)
- **[Wolvengrey, *nêhiyawêwin: itwêwina / Cree: Words*](https://uofrpress.ca/Books/C/Cree-Words)** — uitgebreid naslagwerk voor het Plains Cree (University of Regina Press)
- **[Apertium](https://www.apertium.org/)** — tweetalige woordenboeken voor tientallen talenparen
- **[Giellatekno](https://giellalt.github.io/)** — woordenboeken voor Samische, Oeraalse en andere minderheidstalen
- Door de gemeenschap gecreëerde glossaria, educatief materiaal, terminologielijsten

## Combineert goed met

- **[Coached LLM Prompting](./coached-llm-prompting)** — woordenboekitems zijn een vorm van coachingdata
- **[FST-Gated Pipeline](./fst-gated-pipeline)** — FST valideert dat woordenboektermen correct zijn verbogen
- **[Rule-Based + LLM Hybrid](./rule-based-hybrid)** — deterministische woordenboekopzoeking als één regellaag

## Zie ook

- [Ondersteuning van een Taal met Weinig Bronnen](/docs/network/community/low-resource-languages) — de volledige context
- [Methode-Interface](/docs/network/specifications/methods) — hoe methoden zijn gestructureerd
