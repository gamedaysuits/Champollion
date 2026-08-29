---
sidebar_position: 7
title: "Kookboek: Regelgebaseerde + LLM Hybride"
---

# Regelgebaseerd + LLM-hybride

> **Het idee:** Gebruik deterministische taalkundige regels voor patronen waarvan u zeker weet dat ze correct zijn (morfologische affigering, getalopmaak, bekende frasesstructuren), en laat het LLM creatieve vertalingen verzorgen voor al het overige. Regels overschrijven het LLM waar ze van toepassing zijn; het LLM vult de lacunes op.

:::info[Dit is een kookboek, geen kant-en-klare implementatie]
Deze handleiding schetst de hybride architectuur. De specifieke regels zijn volledig afhankelijk van de grammatica van uw doeltaal en de beschikbare taalkundige bronnen.
:::

## Wanneer gebruikt u dit

- U beschikt over **diepgaande taalkundige expertise** in de doeltaal (of heeft toegang tot een taalkundige)
- Sommige vertaalpatronen zijn **deterministisch** — u kent de correcte uitvoer met zekerheid
- Het LLM **faalt consequent** bij specifieke patronen (getalopmaak, aanspreekvormen, agglutinatie)
- U wilt **correctheid garanderen** voor hoogrisicopatronen, terwijl u de vloeiendheid voor de rest behoudt

## Hoe het werkt

```
Input ──→ [Rule Engine] ──→ [LLM] ──→ [Merge] ──→ Output
              │                │           │
              │ Known patterns │ Unknown    │ Rules override
              │ handled here   │ parts      │ LLM where both
              ▼                ▼            ▼ produced output
         Deterministic     Creative     Final translation
         fragments         translation
```

1. **Regels definiëren** — regex-patronen, FST-opzoekingen, opzoektabellen voor bekende vertalingen
2. **Voorverwerking** — regelovereenkomende segmenten identificeren en extraheren uit de bron
3. **LLM vertaalt** — de resterende tekst, met regeluitvoer als beperkingen
4. **Samenvoegen** — de vertaling opnieuw samenstellen, waarbij regeluitvoer de voorkeur krijgt waar beschikbaar
5. **Valideren** — optionele FST/regelcontrole op het samengevoegde resultaat

## Voorbeeld: regels voor getallen en datums

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

## Belangrijke ontwerpbeslissingen

**Regelprioriteit:** Wanneer zowel een regel als het LLM uitvoer produceren voor hetzelfde segment, welke heeft dan voorrang? Regels dienen voorrang te krijgen bij **correctheidskritieke** patronen. Het LLM dient voorrang te krijgen bij **vloeiendsheidskritieke** patronen.

**Granulariteit:** Regels op woordniveau (woordenboekopzoekingen) versus regels op fraseniveau (idioomkoppeling) versus structurele regels (zinsvolgorde). Begin met woordniveau; voeg fraseniveau toe naarmate u patronen identificeert.

**Regelonderhoud:** Elke regel is een onderhoudsplicht. Geef de voorkeur aan een kleine set regels met hoge betrouwbaarheid boven een grote set benaderende regels. Als u niet zeker weet of een regel correct is, laat het dan aan het LLM over.

## Voor- en nadelen

| | |
|---|---|
| ✅ Gegarandeerde correctheid waar regels van toepassing zijn | ❌ Vereist diepgaande taalkundige expertise |
| ✅ Transparant — regels zijn leesbaar en controleerbaar | ❌ De naad tussen regel en LLM kan onnatuurlijke uitvoer produceren |
| ✅ Regels zijn snel (geen API-kosten) | ❌ Onderhoudsbelasting groeit met het aantal regels |
| ✅ Progressief — voeg regels toe naarmate u leert | ❌ Moeilijk om verbuiging aan regelgrenzen te verwerken |

## Combineert goed met

- **[FST-gestuurde pipeline](./fst-gated-pipeline)** — FST als een specifiek soort regelmotor
- **[Woordenboekversterkt LLM](./dictionary-augmented-llm)** — woordenboekopzoekingen zijn een eenvoudige regel
- **[Gecoacht LLM-prompting](./coached-llm-prompting)** — coaching verwerkt zachte voorkeuren, regels verwerken harde vereisten

## Zie ook

- [GiellaLT](https://giellalt.github.io/) — open-source FST-infrastructuur voor 100+ talen
- [Apertium](https://www.apertium.org/) — regelgebaseerd MT-platform met tweetalige woordenboeken
- [Ondersteuning voor een taal met weinig middelen](/docs/network/community/low-resource-languages)
