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
    "en:ja": { "method": "llm", "model": "google/gemini-3.1-pro-preview" },
    "en:de": { "method": "google-translate" },
    "en:ko": { "method": "llm", "register": "polite-haeyo" },
    "en:es": { "method": "api", "endpoint": "https://review.your-lsp.example/mtpe" },
    "en:crk": { "method": "llm-coached" }
  }
}
```

Frans krijgt DeepL (uw team geeft de voorkeur aan de Europese vloeiendheid ervan). Japans krijgt een frontier-LLM. Duits krijgt Google Translate (snel, goedkoop, goed genoeg). Koreaans krijgt een LLM met een formeel register. Spaans wordt via de `api`-methode naar een professionele menselijke / MTPE-dienst geleid — menselijke vertaling is hier een volwaardige methode, geen bijzaak. Plains Cree krijgt de gecoachte LLM-methode, met grammaticanotities en een woordenboek dat u aanlevert.

**Hetzelfde commando. Dezelfde CI-pipeline. Verschillende methoden per taalpaar — mens of machine. Één configuratiebestand.**

:::note[Methoden voor gemeenschapstalen zijn soeverein]
Het bovenstaande Plains Cree-taalpaar is niet zomaar een taalpaar. Methoden voor inheemse en andere gemeenschapstalen zijn **eigendom van en worden beheerd door de gemeenschap**: de gemeenschap beheert de sleutels tot de achterliggende data, stelt de gebruiksvoorwaarden vast, en elk niet-commercieel (NC) corpus of methode is standaard uitgesloten van commerciële trajecten. Als uw gebruik commercieel is, controleer dan de licentie van de methode voordat u uitrolt. Zie [Datasoevereiniteit](/docs/network/sovereignty/data-sovereignty).
:::

## De Leaderboard → Implementeer-workflow

:::tip[`champollion network leaderboard` wordt meegeleverd met de CLI]
De onderstaande workflow draait op het `champollion network leaderboard`-commando — blader vanuit uw terminal door het klassement van het [Network](/arena) en installeer rechtstreeks een methode-plugin. Raadpleeg de [CLI-referentie](/docs/reference/cli#leaderboard) voor alle opties.
:::

In het [Network](/arena) worden vertaalmethoden gebenchmarkt met reproduceerbare scores voorzien van een fingerprint. Runs worden gerangschikt zoals dat in het MT-vakgebied gebruikelijk is: op basis van chrF++ op corpusniveau met het bijbehorende 95%-betrouwbaarheidsinterval. BLEU, TER en COMET worden ernaast weergegeven, en diagnostische gegevens zoals exacte overeenkomst en FST-acceptatie worden afzonderlijk gerapporteerd, nooit vermengd met het hoofdresultaat. Of de ene methode werkelijk beter is dan de andere, wordt bepaald door een gepaarde significantietoets, niet door het verschil tussen twee getallen. Het klassement houdt elke inzending bij.

De workflow:

```bash
# Browse the leaderboard from your terminal
npx champollion network leaderboard --pair "eng>fra"

# Output (abridged):
#   #   Model         chrF++ [95% CI]      BLEU   …   EM     FST
#   1   gemini-3.5    72.3 [70.8, 73.7]    48.1   …   0.31   —
#   2   deepl         70.9 [69.2, 72.4]    46.0   …   0.29   —
#   3   claude-4      68.4 [66.9, 70.0]    43.7   …   0.27   —
#   Headline: chrF++ with its 95% bootstrap CI; rows whose intervals overlap are not distinguishable.

# Install the method that fits as a plugin (by its rank)
npx champollion network leaderboard --install 1

# Use it
npx champollion sync
```

*Uitsluitend ter illustratie — de bovenstaande rijen in het klassement zijn een voorbeeldweergave. In dit voorbeeld overlappen de intervallen van de eerste twee rijen elkaar, waardoor het bord niet aangeeft dat de ene beter is dan de andere. Het bord staat momenteel open voor inzendingen en bevat nog geen gepubliceerde runs.*

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
# In your CI pipeline — pinned to the 0.5 line, so a new release never
# changes what the pipeline runs (the CI guide has the complete workflow)
npx --yes champollion@0.5 lint        # Catch hardcoded strings
npx --yes champollion@0.5 sync        # Translate what changed
npx --yes champollion@0.5 audit       # Fail if any locale is incomplete
npx --yes champollion@0.5 integrity   # Validate placeholder consistency
```

Drie commando's. Nul handmatige vertalingen. De pipeline detecteert hardgecodeerde strings, vertaalt ze met uw gekozen methoden en laat de build mislukken als er iets ontbreekt of beschadigd is.

### 5. Professionele beoordeling (optioneel)

Voor inhoud met hoge inzet exporteert u naar XLIFF voor menselijke beoordeling:

```bash
npx champollion xliff export --locale ja --out translations.xliff
# → Send to your translation agency
# → Import corrections back:
npx champollion xliff import translations.xliff
```

Vertaal het grootste deel machinaal. Laat mensen de kritieke paden beoordelen. Betaal voor menselijke tijd alleen waar het er toe doet.

## Kostenmodel

champollion heeft **geen abonnement en geen prijzen per gebruiker**. De CLI is source-available onder PolyForm Noncommercial 1.0.0 — gratis voor niet-commercieel gebruik: onderzoek, onderwijs, goede doelen, openbare ziekenhuizen en klinieken, overheid, persoonlijke projecten. Gebruik voor een commercieel doel, zoals het product van een bedrijf met winstoogmerk, valt niet onder die licentie. Controleer [wie dit mag gebruiken](/docs/getting-started/who-may-use-this) voordat u het in gebruik neemt. Verder betaalt u uitsluitend voor de vertaal-API-aanroepen:

| Volume | Google Translate | LLM (Gemini Flash) | LLM (GPT-4o) |
|--------|-----------------|---------------------|---------------|
| 1.000 sleutels × 5 locales | ~$0,50 | ~$0,30 (gratis tier) | ~$2,00 |
| 10.000 sleutels × 15 locales | ~$15 | ~$8 | ~$60 |
| 50.000 sleutels × 30 locales | ~$75 | ~$40 | ~$300 |

Vertaalgeheugen betekent dat u alleen betaalt voor **gewijzigde sleutels** bij volgende synchronisaties. Als u 10 strings van de 10.000 bijwerkt, betaalt u voor 10 vertalingen, niet voor 10.000.

## vs. TMS-platforms

| | champollion | Crowdin / Phrase / Locize |
|---|---|---|
| **Tarieven** | Gratis voor niet-commercieel gebruik ([wie dit mag gebruiken](/docs/getting-started/who-may-use-this)) + API-kosten | $ 50–$ 500/maand + per gebruiker |
| **Vendor lock-in** | Geen — wissel van provider in de configuratie | Hoog — data in hun cloud |
| **Methodekeuze** | Elke provider, elk model, per taalpaar | Wat zij aanbieden |
| **CI/CD** | Volwaardig (`lint → sync → audit`) | Plugin/webhook |
| **Aangepaste methoden** | Pluginsysteem, community-plugins | Niet ondersteund |
| **Quality gate** | Ingebouwd (verkeerd schrift, echo, lengte) | Varieert |
| **Zelf gehost** | Ja (LibreTranslate, aangepaste API) | Nee |

Zie de [volledige vergelijking](/docs/guides/comparison) voor details.

## Verder lezen

- **[Snelstart](/docs/getting-started/quick-start)** — voer uw eerste synchronisatie uit in 60 seconden
- **[Vertaalmethoden](/docs/guides/translation-methods)** — het volledige methode-overzicht met beslisboom
- **[CI/CD-integratie](/docs/guides/ci-cd)** — automatiseer in uw pipeline
- **[Werken met professionele vertalers](/docs/guides/professional-translators)** — XLIFF exporteren/importeren
- **[het Network](/arena)** — benchmark en leaderboard
- **[Configuratiereferentie](/docs/getting-started/configuration)** — elke configuratieoptie
