---
sidebar_position: 5
title: "Coachinggegevens"
related:
  - label: "Methods and gates"
    to: /docs/agents/methods
    kind: tutorial
  - label: "Plugin Specification"
    to: /docs/reference/plugin-spec
    kind: reference
  - label: "Quality Gate"
    to: /docs/concepts/quality-gate
    kind: concept
---

# Coachingdata

Coaching-gegevens zijn het mechanisme van Champollion om een LLM mee te geven wat het nog niet weet over een taal. Door bij elk vertaalverzoek grammaticaregels, woordenboeken en stijlaantekeningen mee te sturen, voorziet u een algemeen LLM van de context die het mist — uiterst nuttig voor talen die door geen enkele MT-dienst goed worden ondersteund. Het kan een model geen taal leren die het nog nooit eerder heeft gezien; meet wat een gecoachte methode daadwerkelijk presteert met de [evaluatie-omgeving](/docs/network/specifications/harness) voordat u erop vertrouwt.

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

1. **Gestructureerde coachingdata** (`llm-coached`-methode) — Grammaticaregels, woordenboeken en stijlaantekeningen in JSON-formaat. Geladen vanuit `.champollion/coaching/<locale>.json` of de `coaching/`-directory van een plugin. Het `dictionary` hiervan dient tevens als de woordenlijst van het project: elke LLM-methode (`llm`, `openai`, `anthropic`, `gemini`, `local`) wordt geïnstrueerd over de woordenlijsttermen die elke batch bevat, DeepL verzendt dit als een woordenlijst en sync waarschuwt wanneer de uitvoer van een methode een term overslaat. De grammaticaregels en stijlaantekeningen worden uitsluitend gelezen door `llm-coached` — bij elke provider (`"provider": "openai"`, `"local"`, …).
2. **Vrijetekst-coachingprompt** (configuratieveld `coachingFile`) — Een platte-tekstbestand met aanvullende richtlijnen die in de systeemprompt worden geïnjecteerd. Werkt met elke LLM-methode, niet alleen met `llm-coached`. In te stellen via `coachingFile` in uw configuratie of `--coaching-file` via de CLI.

Beide kunnen samen worden gebruikt. Houd er rekening mee dat de evaluatie-omgeving niet dezelfde prompt opbouwt: deze stuurt een coaching-bestand mee als de volledige systeemprompt, terwijl `champollion sync` dit binnen zijn eigen vertaalprompt plaatst. Een gecoachte score uit de evaluatie-omgeving is daarom een indicatie voor de uitvoer van de CLI, geen directe meting ervan — meet de eigen uitvoer van de CLI op uw testzinnen voordat u erop vertrouwt.

Omdat de coachingdata deel uitmaakt van het systeembericht, profiteert het van **promptcaching** — providers zoals Anthropic en Google cachen herhaalde systeemprefixen, zodat u slechts eenmaal per sessie voor de coachingcontext betaalt, niet eenmaal per batch.

## Indeling van het Coachingbestand

Maak één JSON-bestand per locale in `.champollion/coaching/`. Het onderstaande
voorbeeld is voor een fictieve taal onder `qaa`, een code voor privégebruik
die geen enkele echte taal heeft: elke regel en term erin is een plaatsaanduiding, geen
feit over een echte taal. Schrijf uw eigen regels, bij voorkeur samen met een spreker
van de taal, en haal woordenboektermen uit een bron die u kunt noemen.

```json title=".champollion/coaching/qaa.json"
{
  "grammar_rules": [
    "One word can carry what English says in a whole clause: translate the meaning of the phrase, not word by word",
    "Nouns are animate or inanimate, and the verb ending follows the class: check the noun's class before choosing the verb form",
    "Write the standard Latin orthography; the script converter produces the display script",
    "Put the verb first in a command (button labels, menu items)"
  ],
  "dictionary": {
    "home": "<your term for home>",
    "settings": "<your term for settings>",
    "search": "<your term for search>",
    "welcome": "<your term for welcome>",
    "submit": "<your term for submit>",
    "cancel": "<your term for cancel>"
  },
  "style_notes": "Use the formal register. When the language has no term for an English technical word, write a descriptive phrase and keep the English word in parentheses after it."
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
[INFO] No coaching data for "qaa" at .champollion/coaching/qaa.json
       Falling back to standard LLM method. Create coaching data for better results.
```

Dit betekent dat u `"defaultMethod": "llm-coached"` veilig globaal kunt instellen — talen met coachingdata zullen er gebruik van maken, en de overige talen krijgen standaard LLM-vertaling zonder fouten.

## Wanneer Coaching te Gebruiken

| Scenario | Aanbevolen methode |
|----------|-------------------|
| Talen met veel beschikbare bronnen (Frans, Spaans, Duits) | `llm` of `google-translate` — LLM's beheersen deze al goed |
| Talen met een gemiddeld aantal bronnen (Koreaans, Turks, Thais) | `llm` met een register — LLM's kunnen deze met stijlsturing adequaat verwerken |
| Talen met weinig beschikbare bronnen (Plains Cree, Yoruba, Quechua) | `llm-coached` — LLM's hebben grammaticaregels en woordenboeken nodig |
| Kunsttalen (Klingon, Sindarijns, Kryptonees) | `llm-coached` — LLM's beschikken over enige trainingsdata, maar hebben correcties nodig |

## Goede Coachingdata Opbouwen

### Grammaticaregels

Schrijf regels als **instructies**, niet als beschrijvingen. De LLM volgt instructies beter op dan dat hij taalkundige theorie interpreteert.

```json
// ❌ Descriptive (the LLM learns nothing actionable)
"This language has animate and inanimate noun classes"

// ✅ Instructive (the LLM knows what to do)
"When translating a noun, look up whether it is animate (NA) or inanimate (NI) in the dictionary — the class decides the verb ending"
```

### Woordenboeken

Richt u op **domeinspecifieke termen** die de LLM fout zou weergeven of zou verzinnen. Besteed geen aandacht aan gangbare woorden die de LLM al correct verwerkt — focus op de termen die specifiek zijn voor de gebruikersinterface van uw applicatie.

**Het woordenboek wordt voor elke methode gecontroleerd.** Ongeacht welke methode een
paar vertaalt — een gehost model, uw eigen model via `local`, DeepL, een `api`-
eindpunt — `champollion sync` controleert elke vertaalde string aan de hand van het
woordenboek en toont een `[TERM]`-waarschuwing waarin elke term wordt genoemd die niet is gebruikt.
Alleen `llm-coached` (in de prompt) en `deepl` (als een DeepL-woordenlijst)
*passen* dit ook toe tijdens het vertalen; bij de overige methoden geeft de controle aan welke
strings u moet corrigeren, bijvoorbeeld met `champollion sync --method llm-coached
--redo keys:<key>`.

### Stijlnotities

Wees specifiek over register, formaliteit en conventies:

```json
"style_notes": "Use formal register (vous-form in French). Preserve brand names untranslated. UI labels should be imperative mood ('Save', not 'Saves'). Maximum 40 characters for button text."
```

## Gecoachte Vertalingen Testen

Gebruik de [MT Eval Harness](https://github.com/gamedaysuits/Champollion) om uw gecoachte vertalingen te benchmarken aan de hand van een referentiecorpus:

```bash
# Install the harness
python3 -m pip install mt-eval-harness

# Run coached translations against your test corpus
mt-eval run --corpus data/crk-corpus.json --model google/gemini-3.1-pro-preview

# Score the results
mt-eval test eval/logs/run_*.json
```

Dit geeft u chrF++-, BLEU- en exacte-overeenkomstscores. Maak meerdere versies van het coachingbestand aan en vergelijk ze — objectieve meetwaarden zijn betrouwbaarder dan subjectieve beoordeling.

---

## Zie ook

- [Vertaalmethoden](/docs/guides/translation-methods) — de llm-coached-methode
- [Wat dit is](/docs/what-is-champollion) — coaching in de praktijk
- [Plug-inspecificatie](/docs/reference/plugin-spec) — coaching-gegevens verpakken in een plug-in
- [Kwaliteitspoort](/docs/concepts/quality-gate) — hoe gecoachte vertalingen worden gevalideerd
- [Configuratie](/docs/getting-started/configuration) — coaching-configuratie per taalpaar
