---
sidebar_position: 7
title: "Voor Enterprise"
description: "Hoe organisaties vertalingen kunnen standaardiseren met bewezen methoden uit de leaderboard, aangepaste plugins en implementatie met één opdracht."
---

# champollion voor Ondernemingen

Uw team vertaalt regelmatig content. U heeft een stapel locale-bestanden, een CI-pipeline en een proces waarbij waarschijnlijk iemand handmatig Google Translate gebruikt, resultaten in JSON kopieert en hoopt dat het goed gaat. Of u betaalt voor een TMS-platform waarbij u vastzit aan de vertaalengine van één leverancier.

champollion biedt u een rustiger alternatief: kies de juiste methode voor elke taal — machine of mens — en voer ze allemaal uit via één commando.

## Waarom teams champollion gebruiken

1. **Kies de juiste methode voor elke taal** — machine of mens, niet wat uw leverancier standaard biedt
2. **Implementeer met één commando** — `npx champollion sync` vertaalt elke locale, elk formaat, elke keer
3. **Wissel van methode zonder code te wijzigen** — een configuratiewijziging, geen migratie
4. **Beheers uw eigen pipeline** — geen leveranciersafhankelijkheid, geen maandelijkse dashboards, geen accounts

```json title="champollion.config.json"
{
  "version": 3,
  "pairs": {
    "en:fr": { "method": "deepl" },
    "en:ja": { "method": "llm", "model": "google/gemini-2.5-pro" },
    "en:de": { "method": "google-translate" },
    "en:ko": { "method": "llm", "register": "polite-haeyo" },
    "en:es": { "method": "api", "endpoint": "https://review.your-lsp.example/mtpe" },
    "en:crk": { "methodPlugin": "crk-coached-v3" }
  }
}
```

Frans krijgt DeepL (uw team geeft de voorkeur aan de Europese vloeiendheid). Japans krijgt een frontier-LLM. Duits krijgt Google Translate (snel, goedkoop, goed genoeg). Koreaans krijgt een LLM met een formeel register. Spaans wordt doorgestuurd naar een professionele menselijke vertaal-/MTPE-dienst via de `api`-methode — menselijke vertaling is hier een volwaardige methode, geen aanvulling achteraf. Plains Cree krijgt een door de gemeenschap gebouwde en beheerde coached plugin.

**Hetzelfde commando. Dezelfde CI-pipeline. Verschillende methoden per taalpaar — mens of machine. Één configuratiebestand.**

:::note[Methoden voor gemeenschapstalen zijn soeverein]
De bovenstaande Plains Cree-plugin is niet zomaar "een andere methode." Methoden voor Inheemse en andere gemeenschapstalen zijn **eigendom van en worden beheerd door de gemeenschap**: de gemeenschap beheert de sleutels tot de onderliggende gegevens, stelt de gebruiksvoorwaarden vast, en elk niet-commercieel (NC) corpus of elke niet-commerciële methode is standaard uitgesloten van commerciële toepassingen. Als uw gebruik commercieel van aard is, controleer dan de licentie van de methode voordat u deze in productie neemt. Zie [Gegevenssoevereiniteit](/docs/network/sovereignty/data-sovereignty).
:::

## De Leaderboard → Implementeer-workflow

:::tip[`champollion leaderboard` wordt meegeleverd met de CLI]
De onderstaande workflow wordt uitgevoerd met het `champollion leaderboard` commando — blader door het [Network](/arena) leaderboard vanuit uw terminal en installeer direct een method-plugin. Zie de [CLI-referentie](/docs/reference/cli#leaderboard) voor alle opties.
:::

Het [Network](/arena) is waar vertaalmethoden worden gebenchmarkt met reproduceerbare, gefingerprintte scores. Elke methode krijgt een samengestelde score over meerdere meetwaarden (chrF++, exacte overeenkomst, FST-acceptatie, semantische scoring). Het leaderboard registreert elke inzending.

De workflow:

```bash
# Browse the leaderboard from your terminal
npx champollion leaderboard --pair en:crk

# Output:
# ┌──────┬───────────────────────┬────────────┬──────────┬───────────┐
# │ Rank │ Method                │ Model      │ chrF++   │ Composite │
# ├──────┼───────────────────────┼────────────┼──────────┼───────────┤
# │  1   │ crk-coached-v3        │ gemini-2.5 │ 43.2     │ 0.67      │
# │  2   │ fst-gated-pipeline    │ gpt-4o     │ 41.8     │ 0.63      │
# │  3   │ prompt-baseline       │ claude-4   │ 38.1     │ 0.55      │
# └──────┴───────────────────────┴────────────┴──────────┴───────────┘

# Install the method that fits as a plugin
npx champollion leaderboard --install crk-coached-v3

# Use it
npx champollion sync
```

*Uitsluitend ter illustratie — de leaderboard-rijen hierboven zijn een voorbeeldindeling. Het leaderboard staat momenteel open voor inzendingen en heeft nog geen gepubliceerde runs.*

**U bouwt de methode niet. U traint het model niet. U kiest de methode die past bij uw domein, budget en licentie — mens of machine — en implementeert deze.** Als er volgende maand een beter passende methode verschijnt, wisselt u deze uit met één commando.

## Wat vandaag beschikbaar is

De brug tussen leaderboard en CLI is in ontwikkeling. Dit werkt op dit moment:

### Ingebouwde methoden (geen plugins vereist)

| Methode | Het meest geschikt voor | Kosten |
|--------|----------|------|
| `llm` (standaard) | Kwaliteitsgericht, elke taal | Per token via OpenRouter |
| `gemini` | Kwaliteit + gratis tier | Gratis (beperkt), daarna per token |
| `google-translate` | Snelheid + volume | $20/M tekens |
| `deepl` | Europese talen | $25/M tekens |
| `llm-coached` | Talen met coaching-data | Per token via OpenRouter |
| `api` | Aangepaste/community-gehoste methoden | Zelf gehost |

### Plugin-methoden (apart installeren)

Aangepaste plugins kunnen elke vertaallogica omhullen — een fijnafgestemd model, een FST-gestuurde pipeline, een community-API of alles wat JSON produceert. Zie [Bouw een Plugin](/docs/tutorials/build-a-plugin).

## Ondernemingsworkflow

### 1. Evalueer uw huidige kwaliteit

```bash
# See what you're getting today
npx champollion status

# Output shows: method per pair, cache hit rate, quality gate stats
```

### 2. Voer de eval-harness uit op kandidaten

De [eval-harness](/docs/network/specifications/harness) stelt u in staat meerdere methoden te benchmarken tegen dezelfde dataset. Voer een sweep uit, vergelijk scores en kies winnaars:

```bash
# In the eval harness repo
python -m mt_eval_harness.run \
  --methods coached-v3 baseline prompt-tuned \
  --dataset data/your-corpus.json
```

### 3. Configureer winnaars per taalpaar

Werk uw configuratie bij om de beste methode per taalpaar te gebruiken. Verschillende talen hebben verschillende beste methoden — dat is het punt.

### 4. Integreer in CI/CD

```bash
# In your CI pipeline
npx champollion lint        # Catch hardcoded strings
npx champollion sync        # Translate what changed
npx champollion audit       # Fail if any locale is incomplete
npx champollion integrity   # Validate placeholder consistency
```

Drie commando's. Nul handmatige vertalingen. De pipeline detecteert hardgecodeerde strings, vertaalt ze met uw gekozen methoden en laat de build mislukken als er iets ontbreekt of beschadigd is.

### 5. Professionele beoordeling (optioneel)

Voor inhoud met hoge inzet exporteert u naar XLIFF voor menselijke beoordeling:

```bash
npx champollion xliff export --locale ja --output translations.xliff
# → Send to your translation agency
# → Import corrections back:
npx champollion xliff import translations.xliff
```

Vertaal het grootste deel machinaal. Laat mensen de kritieke paden beoordelen. Betaal voor menselijke tijd alleen waar het er toe doet.

## Kostenmodel

champollion heeft **geen abonnement en geen kosten per gebruiker**. De broncode van de CLI is beschikbaar onder PolyForm Noncommercial 1.0.0 — gratis voor niet-commercieel gebruik (onderzoek, onderwijs, gemeenschapswerk); voor commercieel gebruik is toestemming vereist, dus [neem eerst contact met ons op](/get-involved). Verder betaalt u alleen voor de API-aanroepen voor vertalingen:

| Volume | Google Translate | LLM (Gemini Flash) | LLM (GPT-4o) |
|--------|-----------------|---------------------|---------------|
| 1.000 sleutels × 5 locales | ~$0,50 | ~$0,30 (gratis tier) | ~$2,00 |
| 10.000 sleutels × 15 locales | ~$15 | ~$8 | ~$60 |
| 50.000 sleutels × 30 locales | ~$75 | ~$40 | ~$300 |

Vertaalgeheugen betekent dat u alleen betaalt voor **gewijzigde sleutels** bij volgende synchronisaties. Als u 10 strings van de 10.000 bijwerkt, betaalt u voor 10 vertalingen, niet voor 10.000.

## vs. TMS-platforms

| | champollion | Crowdin / Phrase / Locize |
|---|---|---|
| **Prijzen** | Gratis voor niet-commercieel gebruik (commercieel met toestemming) + API-kosten | $50–$500/maand + per gebruiker |
| **Vendor lock-in** | Geen — wissel van provider in de configuratie | Hoog — data in hun cloud |
| **Methodekeuze** | Elke provider, elk model, per talenpaar | Wat zij aanbieden |
| **CI/CD** | Eersteklas (`lint → sync → audit`) | Plugin/webhook |
| **Aangepaste methoden** | Plugin-systeem, community-plugins | Niet ondersteund |
| **Kwaliteitscontrole** | Ingebouwd (verkeerd script, echo, lengte) | Varieert |
| **Zelf gehost** | Ja (LibreTranslate, aangepaste API) | Nee |

Zie de [volledige vergelijking](/docs/guides/comparison) voor details.

## Verder lezen

- **[Snelstart](/docs/getting-started/quick-start)** — voer uw eerste synchronisatie uit in 60 seconden
- **[Vertaalmethoden](/docs/guides/translation-methods)** — het volledige methode-overzicht met beslisboom
- **[CI/CD-integratie](/docs/guides/ci-cd)** — automatiseer in uw pipeline
- **[Werken met professionele vertalers](/docs/guides/professional-translators)** — XLIFF exporteren/importeren
- **[het Network](/arena)** — benchmark en leaderboard
- **[Configuratiereferentie](/docs/getting-started/configuration)** — elke configuratieoptie
