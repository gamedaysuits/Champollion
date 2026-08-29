---
sidebar_position: 2
title: "Kookboek: Coached LLM Prompting"
related:
  - label: "Cookbook: Few-Shot Prompting"
    to: /docs/network/tutorials/few-shot-prompting
    kind: cookbook
  - label: "Cookbook: Fine-Tuned Model"
    to: /docs/network/tutorials/fine-tuned-model
    kind: cookbook
  - label: "Coaching Data"
    to: https://champollion.dev/docs/concepts/coaching-data
    kind: champollion
    note: "How coaching data ships to production"
  - label: "Submit a Method"
    to: /docs/network/getting-started/submit-a-method
    kind: guide
---

# Begeleide LLM-prompting

> **Het idee:** Injecteer grammaticaregels, tweetalige woordenboeken en stijlnotities rechtstreeks in de systeemprompt van de LLM. Geen training, geen fine-tuning — alleen gestructureerde taalkundige kennis die de uitvoer stuurt naar geldige vertalingen.

:::info[Dit is een kookboek, geen kant-en-klare implementatie]
Deze handleiding schetst de aanpak en de belangrijkste ontwerpbeslissingen. Pas deze aan op uw taalpaar, beschikbare middelen en evaluatiedoelstellingen.
:::

## Wanneer gebruikt u dit

- U beschikt over **taalkundige kennis** over de doeltaal (grammaticaregels, woordenboekitems, stijlvoorkeuren), maar niet over voldoende parallelle data voor fine-tuning
- U wilt **snel itereren** — promptwijzigingen zijn binnen seconden uitgerold, zonder hertraining
- De doeltaal heeft **bekende patronen** die een LLM verkeerd aanpakt (geslachtsovereenkomst, schriftconventies, formaliteitsniveaus)
- U wilt begeleide prompting benchmarken ten opzichte van een basislijn en itereren op wat werkt

## Hoe het werkt

1. **Stel coachingdata samen** — grammaticaregels, een tweetalig woordenboek en stijlnotities in een gestructureerd JSON-bestand
2. **Configureer het register** — een systeempromptprefix die de taal, het schrift en de toon instelt
3. **Voer de harness uit** — de coachingdata wordt in elke LLM-prompt geïnjecteerd
4. **Bekijk de fouten** — kijk naar wat de kwaliteitspoort afwijst en voeg regels toe om patronen aan te pakken
5. **Itereer** — elke revisie van het coachingbestand is een nieuw experiment; de harness houdt ze allemaal bij

## Structuur van coachingdata

```json title="coaching/<locale>.json"
{
  "grammar_rules": [
    "Adjectives agree in gender and number with the noun they modify",
    "Use formal register (vous) for all UI text",
    "Preserve interpolation variables exactly: {{name}}, {count}"
  ],
  "dictionary": {
    "dashboard": "tableau de bord",
    "settings": "paramètres",
    "deploy": "déployer"
  },
  "style_notes": "Prefer active voice. Avoid anglicisms where a native term exists. Keep sentences concise for UI readability."
}
```

## Belangrijke ontwerpbeslissingen

**Regelspecificiteit versus contextvenster:** Meer regels geven de LLM meer sturing, maar verbruiken ruimte in het contextvenster dat beschikbaar is voor de eigenlijke vertaling. Begin met 5–10 regels met grote impact en voeg er meer toe alleen wanneer u specifieke faalpatronen ziet.

**Woordenboekdekking:** U hebt geen volledig woordenboek nodig — focus op termen die de LLM consequent fout vertaalt. Zelfs 20–30 afgedwongen termen kunnen de consistentie aanzienlijk verbeteren.

**Volgorde van regels is belangrijk:** Zet de belangrijkste regels eerst. LLM's hechten meer gewicht aan vroege instructies.

## Een experiment uitvoeren

```bash
mt-eval run \
  --corpus eval-amh-fra-globalvoices-test-v1 \
  --model google/gemini-2.5-pro \
  --name coached-v1 \
  --coaching-file coaching/crk.json
```

## Voor- en nadelen

| | |
|---|---|
| ✅ Geen trainingskosten | ❌ Kwaliteitsplafond beperkt door basiskennis van de LLM |
| ✅ Directe iteratie (prompt wijzigen → opnieuw uitvoeren) | ❌ Contextvenster beperkt hoeveel coaching er past |
| ✅ Werkt met elke LLM-provider | ❌ Regels kunnen conflicteren — het debuggen van promptinteracties is een kunst |
| ✅ Transparant — u kunt exact lezen wat de LLM ziet | ❌ Creëert geen nieuwe kennis, stuurt alleen bestaande kennis |

## Combineert goed met

- **[FST-Gated Pipeline](./fst-gated-pipeline)** — coaching gecombineerd met morfologische validatie vangt op wat coaching alleen mist
- **[Dictionary-Augmented LLM](./dictionary-augmented-llm)** — afgedwongen terminologie is een vorm van coaching
- **[Few-Shot Prompting](./few-shot-prompting)** — voorbeelden en regels samen zijn krachtiger dan elk afzonderlijk

## Zie ook

- [Method Interface](/docs/network/specifications/methods) — indeling van coachingdata en het TranslationMethod-protocol
- [Support a Low-Resource Language](/docs/network/community/low-resource-languages) — de volledige context
- [Eval Harness](/docs/network/specifications/harness) — hoe u experimenten uitvoert
