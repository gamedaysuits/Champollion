---
sidebar_position: 2
title: "Snel starten"
related:
  - label: "Installation"
    to: /docs/getting-started/installation
    kind: guide
  - label: "Configuration"
    to: /docs/getting-started/configuration
    kind: reference
    note: "Every config field, explained"
  - label: "Cookbook: Translate 30 Languages"
    to: /docs/tutorials/translate-30-languages
    kind: cookbook
    note: "Scale from three locales to thirty"
  - label: "Troubleshooting"
    to: /docs/guides/troubleshooting
    kind: guide
---

# Snel aan de slag

Vertaal uw eerste localisatiebestand in 60 seconden.

## 1. Stel uw localisatiebestanden in

Maak een bron-locale-bestand aan. Champollion ondersteunt JSON, TOML, YAML en meer — zie de [CLI-referentie](/docs/reference/cli) voor de volledige lijst:

```json title="locales/en.json"
{
  "hero": {
    "title": "Welcome to our platform",
    "subtitle": "Build something amazing"
  },
  "nav": {
    "home": "Home",
    "about": "About",
    "contact": "Contact"
  }
}
```

## 2. Stel uw API-sleutel in

Kies een provider en stel de sleutel in:

```bash
# Option A: OpenRouter (200+ models, recommended)
export OPENROUTER_API_KEY=sk-or-v1-...

# Option B: Gemini (free tier — zero cost to start)
export GEMINI_API_KEY=AI...
```

Ontvang een gratis Gemini-sleutel via [aistudio.google.com/apikey](https://aistudio.google.com/apikey). Ontvang een OpenRouter-sleutel via [openrouter.ai](https://openrouter.ai).

## 3. Voer synchronisatie uit

```bash
npx champollion sync
```

:::tip[Gebruikt u Gemini?]
Als u voor Optie B (Gemini) heeft gekozen, voeg dan `--method gemini` toe:
```bash
npx champollion sync --method gemini
```
:::

Champollion zal:
1. `locales/en.json` automatisch detecteren als bron
2. Doeltalen zoeken (of hierom vragen)
3. Alle sleutels vertalen
4. `locales/fr.json`, `locales/ja.json`, enz. schrijven
5. `.champollion.lock` aanmaken om bij te houden wat er vertaald is

## 4. Controleer de resultaten

```bash
cat locales/fr.json
```

```json
{
  "hero": {
    "title": "Bienvenue sur notre plateforme",
    "subtitle": "Construisez quelque chose d'incroyable"
  },
  "nav": {
    "home": "Accueil",
    "about": "À propos",
    "contact": "Contact"
  }
}
```

## Wat gebeurt er daarna?

Wanneer u een bronstring wijzigt, detecteert Champollion de wijziging via SHA-256 hash-tracking en vertaalt alleen die sleutel opnieuw bij de volgende synchronisatie:

```json title="locales/en.json (updated)"
{
  "hero": {
    "title": "Welcome to Acme Platform",  // ← changed
    "subtitle": "Build something amazing"  // ← unchanged, skipped
  }
}
```

```bash
npx champollion sync
# Only "hero.title" is re-translated across all locales
```

De ongewijzigde sleutel (`hero.subtitle`) wordt geleverd vanuit Champollions **Vertaalgeheugen**-cache — geen API-aanroep, geen kosten. De cache wordt automatisch opgebouwd tijdens elke synchronisatie en opgeslagen in `.champollion/tm.json`.

## Optioneel: maak een configuratiebestand aan

Voor meer controle kunt u een configuratiebestand genereren:

```bash
npx champollion init                         # guided wizard
npx champollion init --yes --langs fr,de,ja  # quick setup with specific targets
```

De begeleide wizard leidt u door de **registervoorinstellingen** van elke taal — vooraf gebouwde toon- en formaliteitsinstructies afgestemd op het linguïstische systeem ervan. Frans heeft T-V-voorinstellingen (vouvoiement vs. tutoiement), Koreaans heeft spraakregisters (해요체 vs. 합쇼체 vs. 해체), Japans heeft keigo-opties (です/ます vs. 丁寧語).

Of maak handmatig een configuratiebestand aan met voorinstellingssleutels:

```json title="champollion.config.json"
{
  "version": 3,
  "inputLocale": "en",
  "localesDir": "./locales",
  "languages": {
    "fr": "casual-tu",
    "ko": "polite-haeyo",
    "ja": "polite"
  },
  "model": "google/gemini-2.5-flash"
}
```

Voer `npx champollion init` uit om de beschikbare voorinstellingen per taal te bekijken.

## Optioneel: bewakingsmodus

Automatisch vertalen wanneer uw bronbestand wijzigt:

```bash
npx champollion watch
```

## Volgende Stappen

- **[Configuratie](/docs/getting-started/configuration)** — Volledige configuratiereferentie
- **[Vertaalmethoden](/docs/guides/translation-methods)** — Kies de juiste methode per taalpaar
- **[Vertaalgeheugen](/docs/concepts/translation-memory)** — Hoe caching u geld bespaart bij herhaalde uitvoeringen
- **[Werken met professionele vertalers](/docs/guides/professional-translators)** — Exporteer XLIFF voor menselijke beoordeling
- **[Framework-integratie](/docs/guides/framework-integration)** — Hugo, next-intl, react-i18next
- **[CI/CD](/docs/guides/ci-cd)** — Automatiseer vertalingen in uw pipeline
- **[Probleemoplossing](/docs/guides/troubleshooting)** — Veelvoorkomende problemen en oplossingen
