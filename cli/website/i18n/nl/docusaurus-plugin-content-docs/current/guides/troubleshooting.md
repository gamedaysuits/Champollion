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

1. **Verlaag de batchgrootte** in uw configuratie:
   ```json
   { "batchSize": 15 }
   ```
2. **Gebruik een model met hogere snelheidslimieten** (`google/gemini-3.8-flash` heeft bijvoorbeeld ruime limieten)
3. **Gebruik een goedkopere/snellere methode** voor taalparen met een hoog volume — Google Translate heeft geen snelheidslimieten:
   ```json
   { "pairs": { "en:it": { "method": "google-translate" } } }
   ```

### Model niet gevonden / 404-fouten

Directe LLM-providers (`openai`, `anthropic`, `gemini`) ontvangen hun eigen namen voor modellen. Een id in OpenRouter-formaat van hun eigen leverancier wordt voor u gemapt (`google/gemini-3.8-flash` → `gemini-3.8-flash` op `gemini`). Als de uitvoering stopt met:

**"is an OpenRouter model id … which has no model by that name"** — U gebruikt een model in OpenRouter-formaat van een andere leverancier (`google/gemini-3.8-flash` met `openai`). Er is niets verzonden. Geef een model van die provider op, gebruik de methode die over het model beschikt, of schakel over naar de `llm`-methode om OpenRouter te gebruiken — het bericht vermeldt ze allemaal, inclusief waar het model is ingesteld:

```diff
- { "method": "openai", "model": "google/gemini-3.8-flash" }
+ { "method": "openai", "model": "gpt-4o" }
```
```json
{ "method": "llm", "model": "google/gemini-3.8-flash" }
```

Ze controleren uw modelnaam ook bij het eerste gebruik. Als u een waarschuwing ziet:

**"is an Anthropic/OpenAI/Gemini model"** — U stuurt een model naar de verkeerde provider:

```diff
- { "method": "gemini", "model": "claude-sonnet-4-6" }
+ { "method": "anthropic", "model": "claude-sonnet-4-6" }
```

**"not found in available models"** — Het model is mogelijk verouderd of verkeerd gespeld. Champollion haalt de actuele modellijst van de provider op en stelt alternatieven voor. Raadpleeg de documentatie van de provider voor actuele modelnamen.

:::tip[Modelafschrijving komt voor]
Providers trekken modelnamen regelmatig terug. Als vertalingen plotseling mislukken na een providerupdate, controleer dan de `[WARN]`-uitvoer — deze toont u actuele alternatieven.
:::

### `local`: "could not reach …"

De `local`-methode verzendt verzoeken naar een OpenAI-compatibele server op uw machine (Ollama, vLLM, LM Studio, llama.cpp). Wanneer er geen verbinding kan worden gemaakt, vermeldt de foutmelding het geprobeerde adres en de instelling waardoor dit is gekozen:

```text
[ERR] Local (OpenAI-compatible) Batch 1 failed: fetch failed (ECONNREFUSED) — could not reach http://localhost:8000/v1 (from LOCAL_API_BASE in .env)
```

Het adres is afkomstig van de eerste hiervan die is ingesteld, in de omgeving of in `.env.local` / `.env`: `LOCAL_API_BASE`, daarna `OPENAI_API_BASE`, en vervolgens `OPENAI_BASE_URL`. Als er geen is ingesteld, is het de standaardwaarde van Ollama, `http://localhost:11434/v1`. Start de server of corrigeer de instelling die in het bericht wordt genoemd.

## Vertaalkwaliteit

### Vertalingen herhalen de brontaal

De kwaliteitspoort onderschept dit. Als een vertaling identiek is aan de Engelstalige bron, wordt deze afgewezen en opnieuw geprobeerd. Als het probleem aanhoudt:

1. **Controleer het model** — Sommige modellen presteren matig voor specifieke taalparen
2. **Voeg registerinstructies toe** — Vertel het model welke taal het moet produceren:
   ```json
   {
     "languages": {
       "ja": { "name": "Japanese", "register": "Polite/formal Japanese" }
     }
   }
   ```
3. **Probeer een ander model** — Schakel over van `gpt-4o-mini` naar `gpt-4o` of `google/gemini-3.1-pro-preview`

### Verkeerde scriptuitvoer (bijv. Latijnse tekst voor Japans)

De scriptconformiteitscontrole van de kwaliteitspoort onderschept de meeste gevallen. Als het probleem aanhoudt:

- Controleer of de landinstellingscode correct is (`ja`, niet `jp`)
- Voeg expliciete scriptinstructies toe in het veld `register`:
  ```json
  { "register": "Japanese using hiragana, katakana, and kanji" }
  ```

### Namen slagen niet voor verificatie (bijv. "Curtis Forbes" in het Japans)

Namen kloppen in het Latijnse schrift, dus vertel Champollion wat uw namen zijn:

```json
{ "protectedTerms": ["Curtis Forbes", "Game Day Suits"] }
```

Het model krijgt de instructie om ze te behouden zoals ze zijn geschreven, en een waarde die uitsluitend uit deze namen bestaat, wordt nooit gerapporteerd als onvertaald of met een onjuist schrift. Zonder deze lijst krijgt een korte waarde in Latijns schrift in een niet-Latijnse taal één nieuwe poging waarin wordt gevraagd of het een naam of een label is. Als het model de waarde behoudt, wordt deze geaccepteerd als een naam en gecachet, waardoor deze nooit opnieuw in rekening wordt gebracht. U heeft `--no-verify` niet nodig.

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

`.champollion.lock` legt vast op basis van welke Engelse tekst elke vertaling is
gemaakt. Los een merge-conflict hierin op zoals bij elk ander gegenereerd bestand: behoud
een van beide kanten, voer `npx champollion sync` uit en commit het resultaat.

:::warning[Het verwijderen van de lock vertaalt niets opnieuw]
Zonder de lock kan sync niet bepalen welke Engelse strings zijn gewijzigd sinds
de bestaande vertalingen zijn gemaakt. Het vertaalt alleen sleutels die **ontbreken**
in een doelbestand en legt het huidige Engels vast als de nieuwe baseline. Een
Engelse string die is bewerkt voordat de lock werd verwijderd, behoudt stilletjes
de oude vertaling. Gebruik `--force` om een locale doelbewust opnieuw op te bouwen (beperk de scope met
`--pair`); gecachete vertalingen worden hergebruikt, dus alleen tekst die de cache nog nooit
heeft gezien, wordt in rekening gebracht.
:::

### Specifieke sleutels opnieuw vertalen

Als afzonderlijke vertalingen onjuist zijn en u deze geforceerd opnieuw wilt laten vertalen zonder het vergrendelingsbestand te verwijderen:

```bash
# Re-translate a single key
npx champollion sync --force-keys "hero.title"

# Re-translate multiple keys
npx champollion sync --force-keys "nav.home,nav.about,footer.copyright"
```

De vlag `--force-keys` overschrijft de hashcontrole van het lockbestand voor die specifieke sleutels, waardoor hervertaling wordt geforceerd zonder andere sleutels te beïnvloeden. `--redo keys:hero.title` is hetzelfde onder zijn nieuwere naam. Beide worden vanuit het Translation Memory geleverd wanneer dit de tekst bevat; voeg `--fresh` toe om in plaats daarvan voor een nieuwe vertaling te betalen. Een sleutel met een komma erin (een gettext-msgid is een hele zin) wordt geschreven met `\,`, en het argument wordt geplaatst tussen aanhalingstekens voor de shell: `--redo 'keys:Welcome back\, %(name)s!'`.

### `verify` meldt een placeholder-mismatch (of een andere beschadigde waarde)

`champollion verify` (en de controle die na elke synchronisatie wordt uitgevoerd) meldt waarden die beschadigd zijn: een placeholder die verloren is gegaan of hernoemd, een defecte ICU-meervoudsvorm, een waarde waarvan de letters zijn verwijderd. Een gewone `champollion sync` repareert ze **niet**. De waarde staat al op schijf en de vermelding in de lock geeft aan dat deze up-to-date is, dus sync laat deze ongemoeid.

Elke bevinding vermeldt de opdracht waarmee precies die sleutels worden hersteld, bijvoorbeeld:

```text
[ERR] [VERIFY] fr: 1 i18next {{…}} placeholder mismatch(es): greeting (placeholder {{name}} was changed to {{nom}}) — fix: `champollion sync --pair en:fr --redo keys:greeting`
```

Voer die opdracht uit. Wanneer een locale meerdere bestanden beslaat, worden de sleutels geschreven als `<file>::<key>` (bijvoorbeeld `common::nav.home`), wat de sleutel van dat specifieke bestand opnieuw vertaalt en geen andere.

U heeft `--fresh` niet nodig. Als de beschadigde waarde afkomstig was uit het Translation Memory, heeft `verify` deze al uit de cache verwijderd, en dat wordt ook gemeld: `[TM] Evicted 1 cached translation(s) that produced damaged values`. De herhaling vertaalt de tekst vervolgens opnieuw (of levert de eigen, afwijkende vertaling van de cache) in plaats van de beschadigde waarde opnieuw te leveren. Een waarde die handmatig is bewerkt, wordt nooit gecachet; er wordt er dus niets voor verwijderd en de herhaling werkt op dezelfde manier.

Gebruik voor Markdown/MDX-inhoudsbestanden in plaats daarvan `--retranslate` met een pad of glob (bijv. `--retranslate docs/intro.md`). Dit vertaalt die bestanden opnieuw, zelfs als ze up-to-date zijn of handmatig zijn vertaald. Gebruik `--files` om een uitvoering te beperken tot bepaalde inhoudsbestanden zonder ze te forceren.

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

### Vertalingen na het wisselen van model of provider

Het wisselen van methode (bijv. `llm` naar `deepl`), register of coaching levert nieuwe vertalingen op voor wat opnieuw wordt vertaald, omdat de cachesleutel deze bevat — maar een gewone synchronisatie vertaalt niets opnieuw dat al klaar is: `champollion sync --redo all` doet dat wel. Het wisselen van **model** binnen dezelfde methode hergebruikt kosteloos wat het vorige model heeft vertaald; sync meldt dit vóór de schatting. Als u de eigen vertalingen van het nieuwe model wilt:

```bash
# Have the new model translate what an earlier model wrote
# (what the new model already translated still comes from the cache)
champollion sync --redo all --fresh-on-model-change

# Re-translate specific content files from scratch
champollion sync --retranslate "docs/guides/**"
```

`--fresh-on-model-change` op zichzelf wijzigt alleen de sleutels die een run toch al vertaalt (nieuwe of gewijzigde): na uitsluitend een modelwissel verzendt een gewone `sync --fresh-on-model-change` niets.

Zie [Vertaalgeheugen](/docs/concepts/translation-memory) voor details over het ontwerp van cachesleutels.

## Herstellen van een beschadigde versie {#recover-old-damage}

Waarden die zijn geschreven door een oudere pipeline **herstellen zichzelf nooit**: hun manifest-hashes komen overeen met de huidige bron, waardoor `sync` ze als afgehandeld beschouwt en geen enkele controlepoort ze ooit nog ziet. Als u een project upgradet dat versies van vóór 0.3.0 gebruikte, ga er dan van uit dat er mogelijk beschadigingen in uw locale-bestanden zitten en voer eerst een audit uit:

```bash
champollion integrity
```

De audit detecteert de bekende schadepatronen en noemt voor elk de oplossing:

| Finding | What it is | Fix |
|---------|-----------|-----|
| `UNEXPECTED PUA` | Uitvoer van schriftconversie (pIqaD/Tengwar/Kryptonian) weggeschreven toen conversie niet gewenst was — toont leeg | `champollion repair-script` (offline, exact voor pIqaD) |
| `HOLLOWED VALUES` | De bron waarvan de letters zijn verwijderd — uitvoer van vóór de poort voor inhoudsbehoud | Opnieuw vertalen (zie hieronder) |
| `NO-TRANSLATE DRIFT` | Een URL of andere letterlijke sleutel die is "vertaald" | `champollion sync` (gratis en automatisch hersteld) |

Voor uitgeholde waarden — of elke locale die u simpelweg niet meer vertrouwt — herbouwt u deze:

```bash
champollion sync --pair en:tlh --force
```

`--force` plaatst elke bronsleutel voor de geselecteerde paren opnieuw in de wachtrij. Overeenkomsten uit het Translation Memory worden nog steeds geleverd, maar elke geleverde treffer wordt **eerst gevalideerd aan de hand van de huidige controlepoorten** — een gecachete waarde die de poort nu afwijst, wordt verwijderd en opnieuw in rekening gebracht, zodat een vervuilde cache zichzelf herstelt in plaats van de herbouw te voeden. Voeg `--no-tm` toe als u hoe dan ook een volledig nieuwe facturering wilt, en `--max-cost` om in beide gevallen de uitgaven te maximeren.

Verificatie na de synchronisatie meldt deze patronen ook, zodat een beschadigde locale duidelijk faalt bij `sync` (met vermelding van de oplossing) in plaats van geruisloos in productie te gaan.

### Een eenmalige herplaatsing in de wachtrij na `--no-tm`-opschoningen {#one-time-requeue}

Als uw herstel gebruikmaakte van `--no-tm`, kunt u verwachten dat de **volgende** synchronisatie een batch sleutels in de wachtrij plaatst die gelijk zijn aan de bron en waarvan u dacht dat ze al waren afgehandeld. `--no-tm` schrijft waarden weg zonder ze in het Translation Memory te stempelen, en een *ongestempelde* waarde die identiek is aan de bron is niet te onderscheiden van een onvertaalde waarde — deze wordt dus eenmalig opnieuw in de wachtrij geplaatst, komt terug (vaak identiek), wordt gestempeld en blijft permanent behouden. Dit zijn eenmalige kosten, geen lus. Bekijk vooraf precies welke sleutels het betreft met:

```bash
champollion sync --dry --list-keys
```

## Nog steeds vastgelopen?

- **[GitHub Issues](https://github.com/gamedaysuits/champollion/issues)** — Zoek in bestaande meldingen of dien een nieuwe in
- **[Architectuurdocumentatie](/docs/concepts/architecture)** — Begrijp het systeemontwerp
- **[Kwaliteitspoort](/docs/concepts/quality-gate)** — Hoe validatie intern werkt
