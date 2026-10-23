---
sidebar_position: 2
title: "Snelstart"
related:
  - label: "Installation"
    to: /docs/getting-started/installation
    kind: guide
  - label: "Configuration"
    to: /docs/getting-started/configuration
    kind: reference
    note: "Every config field, explained"
  - label: "Troubleshooting"
    to: /docs/guides/troubleshooting
    kind: guide
---

# Snel aan de slag

Vertaal uw eerste locale-bestand in 60 seconden.

De CLI is gratis voor niet-commercieel gebruik onder de
[PolyForm Noncommercial License 1.0.0](https://github.com/gamedaysuits/Champollion/blob/main/cli/LICENSE); commercieel gebruik valt niet
onder die licentie. Een school, een openbaar ziekenhuis of kliniek, een goed doel of een persoonlijk project valt er wel onder; een winkel of webshop
niet. [Wie dit mag gebruiken](/docs/getting-started/who-may-use-this) legt dit volledig uit.

## 1. Richt uw locale-bestanden in

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

# Option C: a model on your own machine (Ollama, LM Studio, vLLM) — no key
#   nothing to export if it listens on Ollama's default http://localhost:11434/v1
#   another server: export LOCAL_API_BASE=http://localhost:8000/v1 (its address; or put that line in .env.local or .env)
```

Vraag een gratis Gemini-sleutel aan op [aistudio.google.com/apikey](https://aistudio.google.com/apikey). Vraag een OpenRouter-sleutel aan op [openrouter.ai](https://openrouter.ai). Geef voor optie C de naam van uw model op wanneer u het project opzet: `npx champollion init --yes --langs fr,de --method local --model llama3.1` (of voer `sync --method local --model llama3.1` uit).

## 3. Voer Sync uit

```bash
npx champollion sync
```

:::note[Zelf getypt of uitgevoerd door een script?]
De opdrachten op deze pagina zijn opdrachten die u zelf typt: `npx champollion` voert het exemplaar uit dat door uw project is geïnstalleerd, of anders het exemplaar dat npx ophaalt — de eerste keer de nieuwste release, daarna die gecachte kopie. Een opdracht die een script voor u uitvoert — CI, een `package.json`-script, een git-hook — dient de versie te vermelden, `npx --yes champollion@0.6 sync`, zodat een nieuwe release nooit verandert wat de build uitvoert (en `--yes` voorkomt dat npx pauzeert om bevestiging te vragen). De [CI-handleiding](/docs/guides/ci-cd) en de [framework-pagina's](/docs/integrations/frameworks) zetten de versie op die manier vast.
:::

:::tip[Gebruikt u Gemini?]
Als u voor Optie B (Gemini) hebt gekozen, voeg dan `--method gemini` toe:
```bash
npx champollion sync --method gemini
```
:::

Champollion zal:
1. Automatisch `locales/en.json` als de bron detecteren
2. Doeltalen vinden (of erom vragen)
3. Alle sleutels vertalen
4. `locales/fr.json`, `locales/ja.json`, etc. wegschrijven
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

Wanneer u een brontekenreeks wijzigt, detecteert Champollion de wijziging via SHA-256-hash-tracking en vertaalt bij de volgende synchronisatie alleen die sleutel opnieuw:

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

De ongewijzigde sleutel (`hero.subtitle`) wordt **overgeslagen**: de vertaling ervan staat al in `locales/fr.json`, dus deze wordt nergens heen gestuurd en zelfs niet opgezocht — geen aanroep, geen kosten, en niet meegeteld in het "served from the cache"-aantal van de uitvoering.

Het **vertaalgeheugen** (`.champollion/tm.json`, automatisch opgebouwd tijdens elke sync) is bedoeld voor tekst die *wel* in de wachtrij staat: een tekenreeks die u weer terugverandert, dezelfde zin in een ander bestand, of een hervertaling van een volledige locale (`sync --redo all`). Die worden gratis vanuit de cache geleverd, en de uitvoerregel geeft aan hoeveel (`… 0 key(s) sent to the model, 12 served from the cache (free)`). De cache wordt bijgehouden per methode, register en coaching — telkens voor het paar en diens fallback. Na het wisselen van methode (bijvoorbeeld `local` → `llm`), of het wijzigen van de tekst van een coaching-bestand (bij het paar, de taal of de fallback), wordt er niets hergebruikt en geeft de uitvoering aan waarom; alleen een wijziging van model hergebruikt wel eerdere vertalingen. Een wijziging vertaalt op zichzelf niets opnieuw: `sync` noemt de hervertaling en de prijs ervan.

## Optioneel: Maak een configuratiebestand aan

Genereer een configuratiebestand voor meer controle:

```bash
npx champollion init                         # guided wizard
npx champollion init --yes --langs fr,de,ja  # quick setup with specific targets
npx champollion init --yes --langs fr,de --method local --model llama3.1   # a model on this machine
```

`--method` en `--model` kiezen de vertaalmethode en het model (`npx champollion init --help` toont de lijst met methoden); init geeft weer welke de configuratie gebruikt.

De begeleide wizard leidt u door de **register-voorinstellingen** van elke taal — kant-en-klare instructies voor toon en formaliteit, afgestemd op het taalsysteem. Frans heeft T-V-voorinstellingen (vouvoiement versus tutoiement), Koreaans kent beleefdheidsvormen (해요체 versus 합쇼체 versus 해체), en Japans heeft keigo-opties (です/ます versus 丁寧語).

Of maak handmatig een configuratie aan met voorinstellingssleutels:

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

## Optioneel: Watch-modus

Vertaal automatisch wanneer uw bronbestand verandert:

```bash
npx champollion watch
```

## Volgende stappen

- **[Configuratie](/docs/getting-started/configuration)** — Volledige configuratiereferentie
- **[Vertaalmethoden](/docs/guides/translation-methods)** — Kies de juiste methode per paar
- **[Vertaalgeheugen](/docs/concepts/translation-memory)** — Hoe caching u geld bespaart bij herhaalde uitvoeringen
- **[Samenwerken met professionele vertalers](/docs/guides/professional-translators)** — Exporteer XLIFF voor menselijke controle
- **[Framework-integratie](/docs/integrations/frameworks)** — Hugo, next-intl, react-i18next
- **[CI/CD](/docs/guides/ci-cd)** — Automatiseer vertalingen in uw pipeline
- **[Probleemoplossing](/docs/guides/troubleshooting)** — Veelvoorkomende problemen en oplossingen
