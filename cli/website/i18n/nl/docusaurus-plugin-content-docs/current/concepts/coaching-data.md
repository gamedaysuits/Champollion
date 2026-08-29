---
sidebar_position: 5
title: "Coachinggegevens"
related:
  - label: "Build a Translation Plugin"
    to: /docs/tutorials/build-a-plugin
    kind: tutorial
    note: "Develop and ship coaching data end-to-end"
  - label: "Plugin Specification"
    to: /docs/reference/plugin-spec
    kind: reference
  - label: "Cookbook: Coached LLM Prompting"
    to: /docs/network/tutorials/coached-llm-prompting
    kind: arena
    note: "The eval-side cookbook for coached methods"
  - label: "Quality Gate"
    to: /docs/concepts/quality-gate
    kind: concept
---

# Coachingdata

Coachingdata is het mechanisme van Champollion om LLM's te onderwijzen over talen waarop ze niet zijn getraind. Door grammaticaregels, woordenboeken en stijlnotities mee te sturen bij elk vertaalverzoek, transformeert u een algemeen inzetbare LLM tot een contextbewuste vertaler voor elke taal — inclusief talen waarvoor geen bestaande ondersteuning voor machinale vertaling beschikbaar is.

## Hoe Het Werkt

Wanneer u de methode van een taalpaar instelt op `llm-coached`, laadt Champollion een coachingbestand uit `.champollion/coaching/<locale>.json` en injecteert de inhoud ervan in elk LLM-prompt als onderdeel van het systeembericht. De LLM ziet uw taalkundige regels naast het vertaalverzoek, waardoor uitvoer wordt gegenereerd die uw grammatica en terminologie volgt in plaats van te gokken.

```
┌──────────────────────────────────────────────────────┐
│ System Message (cached across batches)               │
│ ┌──────────────────────────────────────────────────┐ │
│ │ Base translation rules                           │ │
│ │ + Register instructions                          │ │
│ │ + Coaching guidance (from coachingFile, if set)   │ │
│ │ + Grammar rules (from coaching data)             │ │
│ │ + Dictionary entries (from coaching data)         │ │
│ │ + Style notes (from coaching data)               │ │
│ └──────────────────────────────────────────────────┘ │
├──────────────────────────────────────────────────────┤
│ User Message (per batch)                             │
│ ┌──────────────────────────────────────────────────┐ │
│ │ Keys to translate (JSON)                         │ │
│ └──────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────┘
```

Er zijn twee typen coachinginhoud:

1. **Gestructureerde coachingdata** (`llm-coached`-methode) — Grammaticaregels, woordenboeken en stijlnotities in JSON-formaat. Geladen vanuit `.champollion/coaching/<locale>.json` of de `coaching/`-map van een plugin.
2. **Vrije-tekst coachingprompt** (`coachingFile`-configuratieveld) — Een bestand met platte tekst met aanvullende richtlijnen die in het systeemprompt worden geïnjecteerd. Werkt met elke LLM-methode, niet alleen met `llm-coached`. Instelbaar via `coachingFile` in uw configuratie of `--coaching-file` op de CLI.

Beide kunnen samen worden gebruikt. De evaluatieomgeving gebruikt exact dezelfde promptstructuur — zodat uw benchmarkscores uw daadwerkelijke productieprompten weerspiegelen.

Omdat de coachingdata deel uitmaakt van het systeembericht, profiteert het van **promptcaching** — providers zoals Anthropic en Google cachen herhaalde systeemprefixen, zodat u slechts eenmaal per sessie voor de coachingcontext betaalt, niet eenmaal per batch.

## Indeling van het Coachingbestand

Maak één JSON-bestand per locale aan in `.champollion/coaching/`:

```json title=".champollion/coaching/crk.json"
{
  "grammar_rules": [
    "Plains Cree is polysynthetic — a single word can express what English needs a full sentence for",
    "Animate/inanimate noun distinction affects verb conjugation",
    "Use SRO (Standard Roman Orthography) unless script converter handles conversion",
    "Verb stems are modified by prefixes and suffixes to indicate person, number, tense, and evidentiality"
  ],
  "dictionary": {
    "home": "kīwēwin",
    "settings": "isi-nākatohkēwin",
    "search": "nānātawāpahtam",
    "welcome": "tānisi",
    "submit": "ispīhci",
    "cancel": "pōni"
  },
  "style_notes": "Use formal register. Preserve English technical terms in parentheses when no Cree equivalent exists. Avoid loanwords when a descriptive Cree expression exists."
}
```

### Velden

| Veld | Type | Verplicht | Beschrijving |
|-------|------|----------|-------------|
| `grammar_rules` | `string[]` | Nee | Array van grammaticaregels die in het systeemprompt worden geïnjecteerd. Elke regel dient een beknopte, uitvoerbare instructie te zijn die de LLM kan opvolgen. |
| `dictionary` | `object` | Nee | Sleutel-waardekoppeling van Engelse term → doeltaalterm. Gebruikt voor domeinspecifieke woordenschat die de LLM niet zou kennen. |
| `style_notes` | `string` | Nee | Vrije stijlinstructies (register, toon, formaliteitsconventies). |

Alle velden zijn optioneel — u kunt beginnen met alleen een woordenboek en grammaticaregels toevoegen naarmate u verfijnt.

## Terugvalgedrag

Als een taalpaar is geconfigureerd voor `llm-coached` maar er bestaat geen coachingbestand voor die locale, valt Champollion **terug op de standaard `llm`-methode** met een consolewaarschuwing:

```
[INFO] No coaching data for "crk" at .champollion/coaching/crk.json
       Falling back to standard LLM method. Create coaching data for better results.
```

Dit betekent dat u `"defaultMethod": "llm-coached"` veilig globaal kunt instellen — talen met coachingdata zullen er gebruik van maken, en de overige talen krijgen standaard LLM-vertaling zonder fouten.

## Wanneer Coaching te Gebruiken

| Scenario | Aanbevolen Methode |
|----------|-------------------|
| Tier 1-talen (Frans, Spaans, Duits) | `llm` of `google-translate` — LLM's beheersen deze talen al goed |
| Tier 2-talen (Koreaans, Turks, Thais) | `llm` met een register — LLM's verwerken deze talen adequaat met stijlrichtlijnen |
| Tier 3-talen (Plains Cree, Yoruba, Quechua) | `llm-coached` — LLM's hebben grammaticaregels en woordenboeken nodig |
| Kunsttalen (Klingon, Sindarin, Kryptonian) | `llm-coached` — LLM's beschikken over enige trainingsdata maar hebben correcties nodig |

## Goede Coachingdata Opbouwen

### Grammaticaregels

Schrijf regels als **instructies**, niet als beschrijvingen. De LLM volgt instructies beter op dan dat hij taalkundige theorie interpreteert.

```json
// ❌ Descriptive (the LLM learns nothing actionable)
"Plains Cree has animate and inanimate noun classes"

// ✅ Instructive (the LLM knows what to do)
"When translating nouns, check whether the Cree equivalent is animate (NA) or inanimate (NI) — this affects which verb conjugation to use"
```

### Woordenboeken

Richt u op **domeinspecifieke termen** die de LLM fout zou weergeven of zou verzinnen. Besteed geen aandacht aan gangbare woorden die de LLM al correct verwerkt — focus op de termen die specifiek zijn voor de gebruikersinterface van uw applicatie.

### Stijlnotities

Wees specifiek over register, formaliteit en conventies:

```json
"style_notes": "Use formal register (vous-form in French). Preserve brand names untranslated. UI labels should be imperative mood ('Save', not 'Saves'). Maximum 40 characters for button text."
```

## Gecoachte Vertalingen Testen

Gebruik de [MT Eval Harness](https://github.com/gamedaysuits/Champollion) om uw gecoachte vertalingen te benchmarken aan de hand van een referentiecorpus:

```bash
# Install the harness
pip install mt-eval-harness

# Run coached translations against your test corpus
mt-eval run --corpus data/crk-corpus.json --model google/gemini-2.5-pro

# Score the results
mt-eval test eval/logs/run_*.json
```

Dit geeft u chrF++-, BLEU- en exacte-overeenkomstscores. Maak meerdere versies van het coachingbestand aan en vergelijk ze — objectieve meetwaarden zijn betrouwbaarder dan subjectieve beoordeling.

---

## Zie Ook

- [Vertaalmethoden](/docs/guides/translation-methods) — de llm-coached-methode
- [Een taal met weinig middelen ondersteunen](/docs/network/community/low-resource-languages) — coaching in de praktijk
- [Pluginspecificatie](/docs/reference/plugin-spec) — coachingdata verpakken in een plugin
- [Kwaliteitspoort](/docs/concepts/quality-gate) — hoe gecoachte vertalingen worden gevalideerd
- [Configuratie](/docs/getting-started/configuration) — coachingconfiguratie per taalpaar
