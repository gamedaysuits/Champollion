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

De CLI is gratis voor niet-commercieel gebruik onder de
[PolyForm Noncommercial License 1.0.0](https://github.com/gamedaysuits/Champollion/blob/main/cli/LICENSE); commercieel gebruik valt niet
onder die licentie. Een school, een openbaar ziekenhuis of kliniek, een goed doel of een persoonlijk project valt hier wel onder; de storefront van een winkel
niet. [Wie dit mag gebruiken](/docs/getting-started/who-may-use-this) licht dit volledig toe.

## 1. Stel uw localisatiebestanden in

Maak een bron-localebestand aan. Champollion ondersteunt JSON, TOML, YAML en meer — zie de [CLI-referentie](/docs/reference/cli) voor de volledige lijst:

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

# Option C: a model on your own machine (Ollama, LM Studio, vLLM) — no key
#   nothing to export if it listens on Ollama's default http://localhost:11434/v1
#   another server: export LOCAL_API_BASE=http://localhost:8000/v1 (its address; or put that line in .env.local or .env)
```

Haal een gratis Gemini-sleutel op via [aistudio.google.com/apikey](https://aistudio.google.com/apikey). Haal een OpenRouter-sleutel op via [openrouter.ai](https://openrouter.ai). Geef voor optie C uw model op wanneer u het project configureert: `npx champollion init --yes --langs fr,de --method local --model llama3.1` (of voer `sync --method local --model llama3.1` uit).

## 3. Voer synchronisatie uit

```bash
npx champollion sync
```

:::note[Zelf getypt of uitgevoerd door een script?]
De commando's op deze pagina zijn commando's die u zelf typt: `npx champollion` voert de versie uit die in uw project is geïnstalleerd, of anders degene die npx ophaalt — de eerste keer de nieuwste release en daarna die gecachte kopie. Een commando dat door een script voor u wordt uitgevoerd — CI, een `package.json`-script, een git-hook — moet de versie specificeren, `npx --yes champollion@0.5 sync`, zodat een nieuwe release nooit verandert wat de build uitvoert (en `--yes` voorkomt dat npx stopt om bevestiging te vragen). De [CI-gids](/docs/guides/ci-cd) en de [framework-pagina's](/docs/integrations/frameworks) pinnen het op die manier vast.
:::

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

De ongewijzigde sleutel (`hero.subtitle`) wordt **overgeslagen**: de vertaling ervan staat al in `locales/fr.json`, dus deze wordt nergens heen gestuurd en zelfs niet opgezocht — geen aanroep, geen kosten, en niet meegeteld in het cijfer "served from the cache" van de run.

Het **vertaalgeheugen** (`.champollion/tm.json`, automatisch opgebouwd tijdens elke synchronisatie) is voor tekst die *wel* in de wachtrij staat: een string die u weer terugzet, dezelfde zin in een ander bestand, een hervertaling van een volledige locale (`sync --redo all`). Die worden gratis vanuit de cache geleverd, en de regel van de run geeft aan hoeveel (`… 0 key(s) sent to the model, 12 served from the cache (free)`). De cache wordt bijgehouden per methode, register en coaching — afzonderlijk voor het paar en voor diens fallback. Na het wisselen van methode (bijvoorbeeld `local` → `llm`) of het wijzigen van de tekst van een coachingbestand (op het paar, de taal of de fallback ervan), wordt er niets hergebruikt en geeft de run aan waarom; alleen een wijziging van het model hergebruikt eerdere vertalingen wel. Een wijziging vertaalt uit zichzelf niets opnieuw: `sync` vermeldt de hervertaling en de prijs ervan.

## Optioneel: maak een configuratiebestand aan

Voor meer controle kunt u een configuratiebestand genereren:

```bash
npx champollion init                         # guided wizard
npx champollion init --yes --langs fr,de,ja  # quick setup with specific targets
npx champollion init --yes --langs fr,de --method local --model llama3.1   # a model on this machine
```

`--method` en `--model` kiezen de vertaalmethode en het model (`npx champollion init --help` toont een overzicht van de methoden); init toont welke door de configuratie worden gebruikt.

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
  "model": "google/gemini-3.8-flash"
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
