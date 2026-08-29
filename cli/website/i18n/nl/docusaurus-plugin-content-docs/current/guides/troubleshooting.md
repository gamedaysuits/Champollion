---
sidebar_position: 6
title: "Probleemoplossing"
---

# Probleemoplossing

Veelvoorkomende problemen en oplossingen voor champollion.

## API & Authenticatie

### "OPENROUTER_API_KEY not found"

Champollion vereist een API-sleutel voor LLM-vertaling. Stel deze in als omgevingsvariabele:

```bash
export OPENROUTER_API_KEY="sk-or-v1-..."
```

Of in een `.env`-bestand (als uw project `.env`-bestanden laadt):

```
OPENROUTER_API_KEY=sk-or-v1-...
```

:::tip
Als u alleen een Google Translate API-sleutel hebt, detecteert champollion dit automatisch en gebruikt Google Translate als standaardmethode. Er is geen configuratiewijziging nodig.
:::

### "401 Unauthorized" van OpenRouter

Uw API-sleutel is ongeldig of verlopen. Controleer deze op [openrouter.ai/keys](https://openrouter.ai/keys).

### "429 Too Many Requests" / Snelheidsbeperking

Champollion verwerkt snelheidsbeperkingen intern met exponentiële terugval. Als u structureel tegen snelheidsbeperkingen aanloopt:

1. **Verklein de batchgrootte** in uw configuratie:
   ```json
   { "batchSize": 15 }
   ```
2. **Gebruik een model met hogere snelheidslimieten** (bijv. `google/gemini-3.5-flash` heeft ruimhartige limieten)
3. **Gebruik een goedkopere/snellere methode** voor paren met hoog volume — Google Translate heeft geen snelheidsbeperkingen:
   ```json
   { "pairs": { "en:it": { "method": "google-translate" } } }
   ```

### Model niet gevonden / 404-fouten

Directe LLM-providers (`openai`, `anthropic`, `gemini`) valideren uw modelreeks bij het eerste gebruik. Als u een waarschuwing ziet:

**"looks like an OpenRouter path"** — U gebruikt een model in OpenRouter-formaat (`google/gemini-3.5-flash`) bij een directe provider. Directe providers gebruiken kale modelnamen:

```diff
- { "method": "gemini", "model": "google/gemini-3.5-flash" }
+ { "method": "gemini", "model": "gemini-2.5-flash" }
```

Of schakel over naar de `llm`-methode om OpenRouter te gebruiken:
```json
{ "method": "llm", "model": "google/gemini-3.5-flash" }
```

**"is an Anthropic/OpenAI/Gemini model"** — U stuurt een model naar de verkeerde provider:

```diff
- { "method": "gemini", "model": "claude-sonnet-4-6" }
+ { "method": "anthropic", "model": "claude-sonnet-4-6" }
```

**"not found in available models"** — Het model is mogelijk verouderd of verkeerd gespeld. Champollion haalt de actuele modellijst van de provider op en stelt alternatieven voor. Raadpleeg de documentatie van de provider voor actuele modelnamen.

:::tip[Modelafschrijving komt voor]
Providers trekken modelnamen regelmatig terug. Als vertalingen plotseling mislukken na een providerupdate, controleer dan de `[WARN]`-uitvoer — deze toont u actuele alternatieven.
:::

## Vertaalkwaliteit

### Vertalingen herhalen de brontaal

De kwaliteitspoort onderschept dit. Als een vertaling identiek is aan de Engelstalige bron, wordt deze afgewezen en opnieuw geprobeerd. Als het probleem aanhoudt:

1. **Controleer het model** — Sommige modellen presteren slecht voor specifieke taalparen
2. **Voeg registerinstructies toe** — Geef het model aan welke taal het moet produceren:
   ```json
   {
     "languages": {
       "ja": { "name": "Japanese", "register": "Polite/formal Japanese" }
     }
   }
   ```
3. **Probeer een ander model** — Schakel over van `gpt-4o-mini` naar `gpt-4o` of `google/gemini-2.5-pro`

### Verkeerde scriptuitvoer (bijv. Latijnse tekst voor Japans)

De scriptconformiteitscontrole van de kwaliteitspoort onderschept de meeste gevallen. Als het probleem aanhoudt:

- Controleer of de landinstellingscode correct is (`ja`, niet `jp`)
- Voeg expliciete scriptinstructies toe in het veld `register`:
  ```json
  { "register": "Japanese using hiragana, katakana, and kanji" }
  ```

### Hallucinatiepatronen in de uitvoer

Herhaalde trigrampatronen (bijv. "hello hello hello") worden onderschept door de hallucinatielus-detector. Als de uitvoer vervormd is maar de detector passeert:

1. **Verklein de batchgrootte** — Kleinere batches produceren meer gerichte uitvoer
2. **Gebruik een sterker model** — Grotere modellen hallucineren minder bij niet-Latijnse scripts
3. **Voeg coachingdata toe** — Woordenboektermen verankeren de vertaling

## Bestands- en formaatproblemen

### "No locale files found"

Champollion detecteert localisatiebestanden automatisch. Als deze niet gevonden worden:

1. **Controleer `localesDir`** — Moet verwijzen naar de map met localisatiebestanden:
   ```json
   { "localesDir": "./locales" }
   ```
2. **Controleer de bestandsnaamgeving** — Bestanden moeten worden benoemd naar landinstellingscode: `en.json`, `fr.json`, enz.
3. **Controleer het formaat** — Ondersteunde formaten: JSON, geneste JSON, YAML, TOML

### Conflicten met vergrendelingsbestanden

Als `.champollion.lock` in een ongeldige toestand terechtkomt:

```bash
# Reset the lock file (next sync will retranslate everything)
rm .champollion.lock
npx champollion sync
```

:::warning
Het verwijderen van het vergrendelingsbestand betekent dat de volgende synchronisatie alle sleutels opnieuw vertaalt, niet alleen de gewijzigde. Dit heeft gevolgen voor de API-kosten bij grote projecten.
:::

### Specifieke sleutels opnieuw vertalen

Als afzonderlijke vertalingen onjuist zijn en u deze geforceerd opnieuw wilt laten vertalen zonder het vergrendelingsbestand te verwijderen:

```bash
# Re-translate a single key
npx champollion sync --force-keys "hero.title"

# Re-translate multiple keys
npx champollion sync --force-keys "nav.home,nav.about,footer.copyright"
```

De vlag `--force-keys` overschrijft de hashcontrole van het vergrendelingsbestand voor die specifieke sleutels, waardoor hervertaling wordt afgedwongen zonder andere sleutels te beïnvloeden.

### Contentvertaling beschadigt codeblokken

Dit zou niet mogen gebeuren — codeblokken worden afgeschermd vóór vertaling. Als het toch optreedt:

1. Controleer of het codeblok standaard afbakening gebruikt (drievoudige backticks)
2. Controleer op niet-afgesloten codeblokken in de Markdown-bron
3. Dien een melding in — dit is een fout in het sentinel-afschermingssysteem

## CLI-problemen

### `--watch` detecteert geen wijzigingen

Bestandsbewaking maakt gebruik van de native Node.js `fs.watch`. Bekende problemen:

- **Netwerkschijven** — `fs.watch` werkt niet betrouwbaar op NFS/SMB-koppelingen
- **Docker-volumes** — Gebruik de peilmodus of voer champollion uit binnen de container
- **Grote mappen** — De bewaker monitort `localesDir` recursief; zeer diepe boomstructuren kunnen de OS-limieten overschrijden

### `npx` voert een oude versie uit

```bash
# Clear the npx cache
npx --yes champollion@latest sync
```

Of installeer globaal:

```bash
npm install -g champollion
champollion sync
```

## Prestaties

### Synchronisatie is traag bij veel talen

Champollion vertaalt standaard alle landinstellingen parallel. Als de synchronisatie nog steeds traag is:

1. **Gebruik Google Translate voor paren met hoog volume** — Het is 10–50× sneller dan LLM-vertaling
2. **Vergroot de batchgrootte** (standaard is 80):
   ```json
   { "batchSize": 120 }
   ```
3. **Stel gelijktijdigheid af** — Parallellisme voor JSON-landinstellingen is standaard 200 en voor content 48. Als uw API-provider hogere snelheidslimieten ondersteunt:
   ```bash
   npx champollion sync --json-concurrency 80 --content-concurrency 20
   ```
4. **Gebruik een snel model** — `gpt-4o-mini` is aanzienlijk sneller dan `gpt-4o`

### Hoge API-kosten

- **Controleer batchgroottes** — Grotere batches = minder API-aanroepen = lagere kosten
- **Gebruik Vertaalgeheugen** — TM is standaard ingeschakeld. Voer `champollion tm stats` uit om te controleren of het werkt. Als u na meerdere synchronisaties 0 vermeldingen ziet, is er mogelijk iets mis met de machtigingen van uw `.champollion/`-map
- **Gebruik promptcaching** — Champollion splitst systeem-/gebruikersberichten voor cache-treffers op Anthropic- en Google-modellen
- **Gebruik Google Translate voor Tier 2-talen** — Zie het kookboek [Vertaal 30 talen](/docs/tutorials/translate-30-languages)

### Verouderde vertalingen na het wisselen van provider

Als u overschakelt van de ene vertaalmethode naar de andere (bijv. `llm` naar `deepl`), kan de TM-cache voor sleutels waarvan de brontekst niet is gewijzigd nog steeds oude vertalingen van de vorige methode leveren. De cachesleutel bevat de methodenaam, zodat de meeste gevallen automatisch worden afgehandeld. Maar als u `model` binnen dezelfde methode hebt gewijzigd:

```bash
# Force fresh translations for all keys
champollion sync --no-tm

# Or clear the cache entirely and re-sync
champollion tm clear --yes
champollion sync
```

Zie [Vertaalgeheugen](/docs/concepts/translation-memory) voor details over het ontwerp van cachesleutels.

## Herstellen van een slechte versie {#recover-old-damage}

Waarden die door een oudere pijplijn zijn geschreven, **herstellen nooit vanzelf**: hun manifest-hashes komen overeen met de huidige bron, dus `sync` beschouwt ze als afgehandeld en geen enkele gate krijgt ze ooit nog te zien. Als u een project upgradet dat versies van vóór 0.3.0 draaide, ga er dan van uit dat er mogelijk schade in uw locale-bestanden zit en voer eerst een audit uit:

```bash
champollion integrity
```

De audit detecteert de bekende schadesignaturen en benoemt de oplossing voor elk daarvan:

| Bevinding | Wat het is | Oplossing |
|---------|-----------|-----|
| `UNEXPECTED PUA` | Scriptconversie-uitvoer (pIqaD/Tengwar/Kryptonian) geschreven terwijl conversie niet gewenst was — wordt leeg weergegeven | `champollion repair-script` (offline, exact voor pIqaD) |
| `HOLLOWED VALUES` | De bron waarvan de letters zijn verwijderd — uitvoer van vóór de content-preservation gate | Opnieuw vertalen (zie hieronder) |
| `NO-TRANSLATE DRIFT` | Een URL of andere verbatim-sleutel die werd "vertaald" | `champollion sync` (gratis en automatisch gerepareerd) |

Voor uitgeholde waarden — of elke locale die u simpelweg niet meer vertrouwt — bouwt u deze opnieuw op:

```bash
champollion sync --pair en:tlh --force
```

`--force` plaatst elke bronsleutel voor de paar/paren binnen de scope opnieuw in de wachtrij. Treffers uit het Translation Memory worden nog steeds geleverd, maar elke geleverde treffer wordt **eerst gevalideerd tegen de huidige gates** — een in de cache opgeslagen waarde die de gate nu afwijst, wordt verwijderd en opnieuw gefactureerd, zodat een vergiftigde cache zichzelf herstelt in plaats van de herbouw te voeden. Voeg `--no-tm` toe als u ongeacht de cache een volledig nieuwe facturering wilt, en `--max-cost` om de kosten in beide gevallen te limiteren.

Post-sync verificatie rapporteert deze signaturen ook, zodat een beschadigde locale met een duidelijke foutmelding faalt bij `sync` (met de oplossing benoemd) in plaats van stilletjes te worden uitgerold.

### Eenmalig opnieuw in de wachtrij plaatsen na `--no-tm`-opschoonacties {#one-time-requeue}

Als uw herstel `--no-tm` gebruikte, verwacht dan dat de **volgende** synchronisatie een batch source-echo-sleutels in de wachtrij plaatst waarvan u dacht dat ze waren afgehandeld. `--no-tm` schrijft waarden zonder ze in het Translation Memory te stempelen, en een *ongestempelde* waarde die identiek is aan de bron, is niet te onderscheiden van een onvertaalde waarde — dus deze wordt eenmalig opnieuw in de wachtrij geplaatst, komt terug (vaak identiek), wordt gestempeld en permanent afgehandeld. Dit is een eenmalige kostenpost, geen lus. Bekijk vooraf precies welke sleutels dit zijn met:

```bash
champollion sync --dry --list-keys
```

## Nog steeds vastgelopen?

- **[GitHub Issues](https://github.com/gamedaysuits/champollion/issues)** — Zoek in bestaande meldingen of dien een nieuwe in
- **[Architectuurdocumentatie](/docs/concepts/architecture)** — Begrijp het systeemontwerp
- **[Kwaliteitspoort](/docs/concepts/quality-gate)** — Hoe validatie intern werkt
