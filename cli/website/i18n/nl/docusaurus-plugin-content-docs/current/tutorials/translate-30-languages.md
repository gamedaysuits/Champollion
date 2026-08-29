---
sidebar_position: 2
title: "30 Talen Vertalen"
description: "Kookboek: schaal een project op van 3 naar 30 talen met behulp van per-taalpaar-methodemixing, batching en CI-integratie."
related:
  - label: "Writing-style & register metrics"
    to: /docs/network/specifications/harness#writing-style-and-register-metrics-informational
    kind: arena
    note: "Measure register adherence with the eval harness"
  - label: "Register"
    to: /glossary#term-register
    kind: glossary
    note: "What a register is, in plain language"
  - label: "Translation Methods"
    to: /docs/guides/translation-methods
    kind: guide
    note: "When to mix LLM, Google Translate, and coached pairs"
  - label: "Quality Gate"
    to: /docs/concepts/quality-gate
    kind: concept
    note: "How every translation is validated before it lands"
  - label: "CI/CD"
    to: /docs/guides/ci-cd
    kind: guide
    note: "Keep 30 locales current on every push"
---

# Kookboek: 30 Talen Vertalen

Schaal een project op van een handvol talen naar wereldwijde dekking. Dit kookboek behandelt methodeselectie, kostenoptimalisatie en CI-integratie voor een echte meertalige implementatie.

**Scenario:** U heeft een SaaS-applicatie met `en`, `fr`, `es`. U moet 27 extra talen toevoegen, verdeeld over drie niveaus van kwaliteitsvereisten.

---

## Stap 1: Categoriseer Uw Talen

Niet alle 30 talen vereisen dezelfde aanpak. Groepeer ze op basis van de beschikbare methodekwaliteit:

| Niveau | Talen | Methode | Waarom |
|--------|-------|---------|--------|
| **Niveau 1 — Premium** | `ja`, `ko`, `zh`, `de`, `pt` | `llm` (GPT-4o) | Hoogwaardige markten, genuanceerde grammatica |
| **Niveau 2 — Standaard** | `it`, `nl`, `pl`, `sv`, `da`, `fi`, `no`, `cs`, `ro`, `hu`, `el`, `tr`, `id`, `ms`, `th`, `vi`, `uk`, `bg` | `google-translate` | Groot volume, goed ondersteund door Google |
| **Niveau 3 — Begeleid** | `crk`, `oj`, `mi`, `haw` | `llm-coached` + plugins | Weinig bronmateriaal, vereisen terminologiehandhaving |

## Stap 2: Configureer Per Taalpaar

```json title="champollion.config.json"
{
  "version": 3,
  "inputLocale": "en",
  "localesDir": "./locales",
  "defaultMethod": "google-translate",
  "model": "google/gemini-3.5-flash",
  "languages": {
    "ja": { "name": "Japanese", "register": "Polite/formal" },
    "ko": { "name": "Korean", "register": "Formal" },
    "zh": { "name": "Simplified Chinese", "register": "Neutral" },
    "de": { "name": "German", "register": "Formal (Sie)" },
    "pt": { "name": "Brazilian Portuguese", "register": "Informal" },
    "crk": { "name": "Plains Cree (SRO)", "register": "Neutral" }
  },
  "pairs": {
    "en:ja": { "method": "llm", "model": "openai/gpt-4o" },
    "en:ko": { "method": "llm", "model": "openai/gpt-4o" },
    "en:zh": { "method": "llm", "model": "openai/gpt-4o" },
    "en:de": { "method": "llm", "model": "openai/gpt-4o" },
    "en:pt": { "method": "llm", "model": "openai/gpt-4o" },
    "en:crk": { "methodPlugin": "crk-coached-v1" }
  }
}
```

**Opmerking:** Talen die niet zijn opgenomen in `pairs` erven `defaultMethod: "google-translate"`. U hoeft niet alle 30 talen op te sommen.

:::info
Ondersteuning voor `crk` is in ontwikkeling — zie [Een taal met weinig bronmateriaal ondersteunen](/docs/network/community/low-resource-languages) voor de status en bijdragerichtlijnen.
:::

## Stap 3: Stel API-sleutels In

Voor deze configuratie heeft u beide API-sleutels nodig:

```bash
export OPENROUTER_API_KEY="sk-or-v1-..."
export GOOGLE_TRANSLATE_API_KEY="AIza..."
```

## Stap 4: Voer Eerst een Proefrun Uit

Bekijk altijd een voorbeeld voordat u 30 talen vertaalt:

```bash
npx champollion sync --dry
```

Bekijk de uitvoer. Deze toont:
- Welke taalparen welke methode gebruiken
- Hoeveel sleutels nieuw of gewijzigd zijn per taal
- Geschatte API-aanroepen per niveau

## Stap 5: Voer de Synchronisatie Uit

```bash
npx champollion sync
```

Champollion verwerkt elk taalpaar afzonderlijk. De Niveau 2-paren die Google Translate gebruiken, verlopen snel. Niveau 1 LLM-paren zijn trager maar van hogere kwaliteit. Niveau 3 begeleide paren maken gebruik van de coachinggegevens van de plugin.

### Incrementele Updates

Na de initiële synchronisatie worden bij volgende uitvoeringen alleen **gewijzigde of nieuwe** sleutels vertaald:

```bash
# Only keys that changed since last sync
npx champollion sync
```

Het vergrendelingsbestand (`.champollion.lock`) houdt bij wat er al vertaald is, zodat stabiele inhoud nooit opnieuw wordt vertaald.

## Stap 6: Controleer de Kwaliteit

Controleer de status van alle taalparen:

```bash
npx champollion status
```

Dit geeft een tabel weer met de methode, het model, het kwaliteitsniveau en de beschikbaarheid van coachinggegevens of benchmarkscores voor elk taalpaar.

### Heeft de uitvoer uw registers gerespecteerd?

In Stap 2 heeft u per taal een [register](/glossary#term-register) opgegeven — `"Polite/formal"` voor Japans, `"Formal (Sie)"` voor Duits. (Niet bekend met de term? De woordenlijst legt het in begrijpelijke taal uit.) Deze instructies worden opgenomen in de vertaalprompt, maar een prompt is een verzoek, geen garantie.

Het [Network harness](/docs/network/specifications/harness) — hetzelfde hulpmiddel dat het publieke leaderboard aandrijft — kan register- en stijlnaleving meten op een steekproef van uw vertalingen. De schrijfstijlmeetwaarden controleren elke uitvoer aan de hand van het verwachte register (formele/informele markers, T–V-voornaamwoorden, samentrekkingen, afwijkingen in zinslengte) en rapporteren een `style_consistency_rate` over de gehele uitvoering. U kunt het ook koppelen aan een aangepast merkstemprofiel met `--style-profile`.

```bash
# install the harness, then run your sample corpus through it
pipx install mt-eval-harness
mt-eval run --corpus my-sample.json --style-profile brand-voice.json
```

Twee eerlijke kanttekeningen: deze meetwaarden zijn **informatief** (ze worden nooit opgenomen in de samengestelde score van het leaderboard), en de formaliteitsdetectie is op markers gebaseerd — een afwijkingsdetector, geen menselijk oordeel. Details en definities van meetwaarden: [Schrijfstijl- en registermeetwaarden](/docs/network/specifications/harness#writing-style-and-register-metrics-informational).

## Stap 7: CI-integratie

Voeg het volgende toe aan uw GitHub Actions-workflow zodat vertalingen actueel blijven bij elke push:

```yaml title=".github/workflows/i18n-sync.yml"
name: Sync Translations
on:
  push:
    paths:
      - 'locales/en/**'

jobs:
  translate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - run: npm ci

      - name: Sync translations
        run: npx champollion sync
        env:
          OPENROUTER_API_KEY: ${{ secrets.OPENROUTER_API_KEY }}
          GOOGLE_TRANSLATE_API_KEY: ${{ secrets.GOOGLE_TRANSLATE_API_KEY }}

      - name: Commit updated translations
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add locales/
          git diff --staged --quiet || git commit -m "chore(i18n): sync translations"
          git push
```

## Kostenschatting

Voor een project met 500 bronsleutels verdeeld over 30 talen:

| Niveau | Talen | Methode | Geschatte kosten |
|--------|-------|---------|-----------------|
| Niveau 1 (5 talen) | ja, ko, zh, de, pt | GPT-4o | ~$2,50/volledige synchronisatie |
| Niveau 2 (18 talen) | it, nl, pl, etc. | Google Translate | ~$0,90/volledige synchronisatie |
| Niveau 3 (4 talen) | crk, oj, mi, haw | GPT-4o-mini begeleid | ~$0,40/volledige synchronisatie |
| **Totaal** | **30 talen** | **Gemengd** | **~$3,80/volledige synchronisatie** |

Incrementele synchronisaties (5–20 gewijzigde sleutels) kosten een fractie van een volledige synchronisatie.

## Zie ook

- [Vertaalmethoden](/docs/guides/translation-methods) — Hoe elke vertaalmethode werkt en wanneer u deze gebruikt
- [Plugin-specificatie](/docs/reference/plugin-spec) — Maak coachinggegevens aan voor elk van uw Niveau 3-talen
- [CI/CD-handleiding](/docs/guides/ci-cd) — Geavanceerde CI-patronen, inclusief PR-voorbeeldbuilds
- [Kwaliteitspoort](/docs/concepts/quality-gate) — Hoe Champollion elke vertaling valideert voordat deze wordt weggeschreven
- [Ondersteunde talen](/docs/reference/supported-languages) — Volledige lijst van taalcodes en methodecompatibiliteit
- [Schrijfstijl- en registermeetwaarden](/docs/network/specifications/harness#writing-style-and-register-metrics-informational) — Meet register- en stijlnaleving met het evaluatieharnas (informatieve meetwaarden)
- [Woordenlijst: register](/glossary#term-register) — Wat "register" betekent, in begrijpelijke taal
- [Een taal met weinig bronmateriaal ondersteunen](/docs/network/community/low-resource-languages) — Voeg coachinggegevens toe voor talen zonder brede MT-dekking
