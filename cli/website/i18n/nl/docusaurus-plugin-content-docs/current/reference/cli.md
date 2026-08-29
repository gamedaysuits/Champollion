---
sidebar_position: 1
title: "CLI-referentie"
related:
  - label: "Quick Start"
    to: /docs/getting-started/quick-start
    kind: guide
  - label: "Configuration"
    to: /docs/getting-started/configuration
    kind: reference
  - label: "CI/CD"
    to: /docs/guides/ci-cd
    kind: guide
  - label: "Troubleshooting"
    to: /docs/guides/troubleshooting
    kind: guide
---

# CLI-referentie

## Opdrachten

```
champollion init              Interactive setup wizard (--yes for quick defaults)
champollion sync              Translate & sync all locale files
champollion watch             Auto-sync when the source file changes
champollion audit             List all untranslated [EN] fallback values
champollion lint              Scan source code for hardcoded strings
champollion wrap              Auto-wrap hardcoded strings in t() calls (with undo)
champollion seo <sub>         Generate hreflang, sitemap.xml, or JSON-LD schema
champollion integrity         Audit locale files for format/encoding issues
champollion repair-script     Restore romanization where script conversion was unwanted
champollion verify            Verify translations are present and correct (CI gate)
champollion status            Show pair configuration, plugins, and quality tiers
champollion provenance        Audit translation resource licensing
champollion plugin <sub>      Manage method plugins (install, remove, list)
champollion fonts <sub>       Download web fonts for PUA script converters
champollion leaderboard       Browse and install methods from the Network leaderboard
champollion tm <sub>          Manage Translation Memory cache (stats, clear, seed, prune)
champollion xliff <sub>       Export/import XLIFF 1.2 for professional review
champollion card <code>       Pretty-print a language card (--json for raw output)
champollion models            List available models from a provider (--method <provider>)
champollion doctor            System health check (cards, config, FSTs, API keys, methods)
champollion recommend         Method guidance for a pair — availability + cited evidence
champollion register-corpus   Register a corpus: pick a license + exposure tier (local-only/private/public/sealed)
champollion submit            Propose an index entry (review-gated): prints a pre-filled GitHub issue
champollion seal-corpus <sub> Sealed-tier crypto verbs: keygen / seal / open (organizer-node bridge)
```

Voer `champollion <command> --help` uit voor gedetailleerde hulp bij een opdracht.

## Globale opties

```
--help, -h              Show help (global or per-command)
--version, -v           Print version and exit
--yes, -y               Skip interactive prompts, use defaults
--config <path>         Custom config file path
--dir <path>            Override locales directory
--content-dir <path>    Hugo/Docusaurus content directory for Markdown translation
--source <code>         Override source locale (default: en)
--model <model>         Override translation model (full slug or alias from shared/model-aliases.json)
--method <method>       Translation method: llm, google-translate (default: from config)
--temperature <n>       LLM temperature (0.0–2.0, default: 0.3)
--coaching-file <path>  Path to free-text coaching prompt file (injected into system prompt)
--format <fmt>          Locale file format: json, toml, yaml, or auto
--dry, --dry-run        Preview changes without writing files
--list-keys             With --dry: name every queued key per reason
--concurrency <n>       Max parallel API calls (sets both JSON and content, default: 48)
--json-concurrency <n>  Max parallel locale translations for JSON keys (default: 200)
--content-concurrency <n> Max parallel API calls for content translation (default: 48)
--force                 Re-queue every source key (whole-locale rebuild; scope with --pair)
--force-content         Re-translate all content files (clears content lock)
--force-keys <keys>     Comma-separated dot-notation keys to force re-translate
--no-tm                 Skip Translation Memory cache for this sync run
--no-verify             Skip post-sync verification pass
--locale <code>         Target locale (xliff export, tm clear)
--quiet                 Errors and warnings only — suppress banner, progress bar, and info lines
--json                  Machine-readable NDJSON output — one JSON object per event
```

---

## init

Interactieve installatiewizard die `champollion.config.json` aanmaakt. Begeleidt u door de bronlocale, doeltalen, bestandsindeling en vertaalmodel.

```bash
champollion init                          # interactive wizard
champollion init --yes                    # skip wizard, use defaults
champollion init --yes --langs fr,de,ja   # quick setup with specific languages
champollion init --source en --dir ./i18n # overrides with defaults
```

**`--langs` optie**: Door komma's gescheiden lijst van doeltaalcodes. Slaat de taalprompt over en past standaard registerinstellingen toe voor elke taal. Combineer met `--yes` voor volledig niet-interactieve installatie.

**Taalvoorinstellingen**: Wanneer u wordt gevraagd naar doeltalen, kunt u namen van voorinstellingen typen:
- `european` → fr, de, es, it, pt, nl
- `asian` → ja, zh, ko
- `global` → fr, es, de, ja, zh, ko, pt, ar
- `nordic` → da, fi, nb, sv

Combineer voorinstellingen en afzonderlijke codes: `european, ja` → fr, de, es, it, pt, nl, ja

---

## sync

Vertaalt ontbrekende en verouderde sleutels in alle localebestanden. Voert standaard na afloop een verificatie uit.

```bash
champollion sync                                   # translate everything
champollion sync --dry-run                         # preview only
champollion sync --dry --list-keys                 # preview AND name every queued key
champollion sync --force-keys "hero.title"         # force re-translate
champollion sync --force-keys "a.title,a.subtitle" # multiple keys
champollion sync --pair en:tlh --force             # rebuild one whole locale
champollion sync --pair en:tlh --force --no-tm     # ...bypassing a suspect cache
champollion sync --force-content                   # re-translate all Markdown/MDX
champollion sync --content-dir ./content           # include Hugo Markdown
champollion sync --method google-translate          # force Google Translate
champollion sync --concurrency 20                  # 20 parallel API calls (both phases)
champollion sync --json-concurrency 30              # 30 parallel locale translations (JSON)
champollion sync --content-concurrency 8            # 8 parallel content translations
champollion sync --no-verify                        # skip post-sync verification
champollion sync --no-tm                            # skip cache, fresh API calls
```

**Vertaalgeheugen**: Standaard laadt `sync` het bestand `.champollion/tm.json` en levert gecachede vertalingen voor ongewijzigde bronwaarden. Gebruik `--no-tm` om de cache te omzeilen (nuttig bij het wisselen van vertaalproviders of bij het debuggen van kwaliteit). Zie [Vertaalgeheugen](/docs/concepts/translation-memory).

**Wijzigingsdetectie**: champollion slaat SHA-256-hashes op in `.champollion.lock`. Wanneer bronwaarden wijzigen, worden die sleutels bij de volgende synchronisatie automatisch opnieuw vertaald. Commit het vergrendelingsbestand zodat alle ontwikkelaars dezelfde basislijn delen.

**Parallellisme**: Zowel de vertaling van JSON-sleutels als de inhoudsvertaling worden parallel uitgevoerd. JSON-locales worden gelijktijdig vertaald (standaard: 200 gelijktijdige locales), waarbij batches binnen elke locale ook geparallelliseerd worden (4 gelijktijdige batches). Inhoudsvertaling (Markdown, MDX, blogberichten) wordt uitgevoerd in een platte werkitempool (standaard: 48 gelijktijdige API-aanroepen). Overschrijf met `--json-concurrency`, `--content-concurrency` of `--concurrency` (stelt beide in).

**Uitvoer**: Sync toont een versiebanner, detectie van indeling/framework, kostenraming en voortgangsbalken per locale:

```
champollion v0.1.0

[INFO] Detected format: json (auto)
[INFO] Source: en.json (2,847 keys)
[INFO] Pairs: es-MX:llm, fr:deepl

[INFO] es-MX.json — 2,847 missing
     ████████████████████████████████ 2,847/2,847 keys
[INFO] fr.json — 2,847 missing
     ████████████████████████████████ 2,847/2,847 keys
[OK] Synced 5,694 keys total.
```

Voortgangsbalken worden na elke batch (~80 sleutels) ter plekke bijgewerkt. Gebruik `--quiet` voor alleen fouten/waarschuwingen, of `--json` voor machineleesbare NDJSON-uitvoer. Beide onderdrukken de voortgangsbalk en banner.

---

## watch

Synchroniseert automatisch wanneer het bronlocalebestand wijzigt. Wordt uitgevoerd totdat het wordt onderbroken met `Ctrl+C`.

```bash
champollion watch
```

---

## audit

Geeft een overzicht van alle niet-vertaalde terugvalwaarden met het voorvoegsel `[EN]` uit eerdere uitvoeringen. Sluit af met code 1 als er worden gevonden — gebruik dit als CI-gate om builds met onvolledige vertalingen te laten mislukken.

```bash
champollion audit
```

---

## verify

Leest alle localebestanden opnieuw van schijf en controleert of vertalingen daadwerkelijk aanwezig en correct zijn. Dit is dezelfde verificatie die automatisch wordt uitgevoerd aan het einde van elke `sync` (tenzij `--no-verify` wordt meegegeven).

```bash
champollion verify                    # verify all locale files
champollion verify --warn-only        # non-blocking
champollion verify && echo "All good" # CI gate
```

**Wat er wordt gecontroleerd:**
- Sleutelpariteit — alle bronsleutels aanwezig in elk doel
- `[EN]` terugvalmarkeringen uit eerdere uitvoeringen
- Lege vertalingen
- Scriptconformiteit — niet-Latijnse locales moeten niet-ASCII-vertalingen bevatten
- Plaatshoudersbehoud — ICU-plaatshouders komen overeen met de bron
- Coderingsproblemen — BOM-markeringen, onzichtbare tekens
- Bronecho's — waarden identiek aan de bron (waarschuwing)

---

## lint

Scant broncode op hardgecodeerde gebruikersgerichte teksten die i18n-vertaalaanroepen zouden moeten gebruiken. Detecteert automatisch uw framework (next-intl, react-i18next, vue-i18n, Hugo).

```bash
champollion lint                    # exits 1 if issues found
champollion lint --warn-only        # always exits 0
champollion lint --src ./app        # custom source directory
champollion lint --min-length 4     # minimum string length to flag
```

**Wat er wordt gedetecteerd:**
- Hardgecodeerde teksten in JSX-tekst, `placeholder`, `alt`, `aria-label`, `title`
- Bestanden met gebruikersgerichte inhoud maar zonder i18n-framework-import
- Dode sleutels — localeслeutels waarnaar geen enkel bronbestand verwijst
- Dekkingsscore — percentage teksten dat via i18n wordt verwerkt

**Uitsluitingen**: Maak `.champollionignore` aan in de hoofdmap van uw project (globpatronen, zoals `.gitignore`).

---

## wrap

Omhult automatisch hardgecodeerde teksten die door `lint` zijn gedetecteerd in `t()`-aanroepen. Maakt automatisch back-ups voordat bestanden worden gewijzigd.

```bash
champollion wrap                    # auto-wrap with backup
champollion wrap --dry              # preview wrapping changes
champollion wrap --undo             # restore from .champollion-backup/
```

**Veiligheidscontroles:**
1. Git-schoonheidscontrole (overgeslagen bij dry-run)
2. Automatische back-up naar `.champollion-backup/`
3. Diff-voorbeeld vóór elke bestandsschrijfactie
4. `--undo`-ondersteuning om te herstellen vanuit back-up

---

## seo

Genereer SEO-artefacten voor meertalige sites.

```bash
champollion seo hreflang                                        # print hreflang tags
champollion seo sitemap --base-url https://example.com --out sitemap.xml
champollion seo jsonld --base-url https://example.com           # JSON-LD schema
```

| Subopdracht | Uitvoer |
|-------------|---------|
| `hreflang` | `<link rel="alternate" hreflang>`-tags |
| `sitemap` | Meertalige `sitemap.xml` |
| `jsonld` | JSON-LD WebSite-taalschema |

---

## integrity

Detecteert beschadiging en afwijkingen in vertaalde localebestanden.

```bash
champollion integrity               # exits 1 if issues found
champollion integrity --warn-only   # non-blocking
```

**Wat het controleert:**
- Corruptie van placeholders (bijv. `{name}` aanwezig in de bron, maar ontbreekt in het doel)
- Coderingsproblemen (mojibake, ongeldige Unicode)
- Onvertaalde kopieën (doelwaarde identiek aan de bron) — [`noTranslate`](/docs/getting-started/configuration#no-translate)-sleutels zijn vrijgesteld, evenals echo's waarvan het Translation Memory bevestigt dat ze door de pijplijn zijn geproduceerd en door de gate zijn goedgekeurd. Wat gemarkeerd blijft, is exact wat `sync` opnieuw in de wachtrij zou plaatsen — de twee tools kunnen niet van mening verschillen over een gezond bestand
- No-translate drift (een `noTranslate`-sleutel die *niet* identiek is aan de bron) — gerapporteerd met verwachte/werkelijke waarden en onzichtbare tekens geëscaped; voer `champollion sync` uit om te repareren
- Onverwachte PUA (Private Use Area-codepunten in een locale waarvan de [scriptconversie](/docs/getting-started/configuration#script-conversion) is uitgeschakeld — wordt leeg weergegeven zonder een speciaal lettertype); voer `champollion repair-script` uit om te repareren
- Uitgeholde waarden (een doel dat de bron is waarvan de letters zijn verwijderd — schade door een pijplijn die ouder is dan de gate voor inhoudsbehoud); vertaal opnieuw met `sync --force-keys <key>` of `sync --pair <pair> --force`
- Verweesde sleutels (sleutels in het doel die niet in de bron bestaan)
- Volledigheid van ICU MessageFormat-meervoudscategorieën (bijv. Arabisch heeft 6 categorieën nodig)

---

## repair-script

Draait scriptconversie terug die nooit had mogen plaatsvinden: PUA-gecodeerde waarden (pIqaD, Tengwar, Kryptonian) in locales waarvan de configuratie aangeeft dat conversie is uitgeschakeld, worden hersteld naar romanisatie via de eigen omgekeerde tabel van de converter.

```bash
champollion repair-script --dry     # preview
champollion repair-script           # repair in place
```

| Optie | Effect |
|--------|--------|
| `--dry` | Bekijk reparaties vooraf zonder te schrijven |
| `--locale <code>` | Repareer slechts één locale |
| `--json` | Machineleesbare JSON-uitvoer |
| `--warn-only` | Exit 0, zelfs als er onomkeerbare PUA overblijft |

pIqaD wordt exact omgekeerd. Omkeringen van Tengwar en Kryptonian kunnen hoofdlettergebruik niet herstellen (gemarkeerd als case-lossy). Het Translation Memory heeft geen reparatie nodig — het slaat waarden van vóór de conversie op. Sluit af met exit 1 wanneer er PUA overblijft die door geen enkele geregistreerde converter kan worden omgekeerd.

---

## tm

Beheer de cache van het vertaalgeheugen (`.champollion/tm.json`). TM slaat eerdere vertalingen op en levert deze bij volgende synchronisaties in plaats van de API aan te roepen.

```bash
champollion tm stats                  # show cache statistics
champollion tm clear                  # clear cache (with confirmation)
champollion tm clear --yes            # clear without confirmation
champollion tm clear --locale fr      # clear only French entries
```

| Subopdracht | Uitvoer |
|-------------|---------|
| `stats` | Aantal vermeldingen, bestandsgrootte, uitsplitsing per locale |
| `clear` | Cachebestand verwijderen (volledig of per locale) |

| Optie | Effect |
|-------|--------|
| `--locale <code>` | Alleen vermeldingen voor één locale wissen |
| `--yes` | Bevestigingsprompt overslaan |

Zie [Vertaalgeheugen](/docs/concepts/translation-memory) voor de werking van TM en wanneer u het moet wissen.

---

## xliff

Exporteer en importeer XLIFF 1.2-bestanden voor beoordeling door professionele vertalers. XLIFF is het universele uitwisselingsformaat dat wordt ondersteund door CAT-tools zoals memoQ, SDL Trados en Phrase.

```bash
champollion xliff export --locale fr                   # export French XLIFF
champollion xliff export --locale ja --out ./review/   # custom output path
champollion xliff import .champollion/xliff/fr.xliff       # import reviewed file
champollion xliff import ./reviewed.xliff --dry        # preview import
```

| Subopdracht | Uitvoer |
|-------------|---------|
| `export` | Genereer `.xliff` vanuit bron- en doellocalebestanden |
| `import` | Beoordeelde `.xliff`-vertalingen samenvoegen in localebestanden |

| Optie | Effect |
|-------|--------|
| `--locale <code>` | Doellocale voor export (verplicht) |
| `--out <path>` | Aangepast uitvoerpad of map |
| `--dry` | Import voorvertonen zonder te schrijven |

Zie [Werken met professionele vertalers](/docs/guides/professional-translators) voor de volledige workflow.

---

## status

Toont paarconfiguratie, geïnstalleerde plugins, kwaliteitsniveaus en benchmarkscores.

```bash
champollion status
```

---

## provenance

Controleert de licenties van vertaalresources voor alle geïnstalleerde plugins.

```bash
champollion provenance
```

---

## plugin

Beheer plugins voor vertaalmethoden. Plugins zijn voorverpakte vertaalrecepten die worden geïnstalleerd in `.champollion/methods/`.

```bash
champollion plugin list                      # show installed plugins
champollion plugin install ./my-method/      # install from local directory
champollion plugin remove crk-coached-v1     # remove a plugin
```

Zie [Plugin-specificatie](/docs/reference/plugin-spec) voor het pluginmanifestformaat.

---

## leaderboard

Blader door, zoek naar en installeer vertaalmethoden vanuit het Network-leaderboard. Methoden die via het leaderboard worden geïnstalleerd, worden geleverd met benchmarkscores en de volledige canonieke MethodConfig — de exacte configuratie die tijdens de evaluatie is gebruikt.

```bash
champollion leaderboard                          # show leaderboard
champollion leaderboard --pair en:fr             # filter by language pair
champollion leaderboard --install crk-coached-v8 # install a method plugin
champollion leaderboard --install crk-coached-v8 --apply  # install + patch config
```

| Optie | Effect |
|-------|--------|
| `--pair <code>` | Leaderboard filteren op taalpaar (bijv. `en:fr`) |
| `--install <name>` | Een methodeplugin installeren vanuit het leaderboard |
| `--apply` | Na installatie automatisch `methodPlugin` toevoegen aan `champollion.config.json` |

**`--apply` workflow:** Wanneer u installeert met `--apply`, schrijft champollion de methodeplugin naar `.champollion/methods/` **en** past uw `champollion.config.json` aan om deze te gebruiken voor het betreffende paar. Dit is de snelste weg van "wat scoort het beste?" naar "ik gebruik het in productie."

---

## fonts

Downloadt en beheert PUA-weblettertypen voor scriptconverters van geconstrueerde talen. Talen die Private Use Area-tekens gebruiken (Klingon, Sindarin, Kryptonian) hebben aangepaste weblettertypen nodig om hun schriften weer te geven. Deze opdracht downloadt ze vanuit geverifieerde open-source-repositories.

```bash
champollion fonts list                           # show needed fonts
champollion fonts install                        # download all needed fonts
champollion fonts install --css                  # also generate CSS snippet
champollion fonts install --dir ./public/fonts   # custom output directory
```

| Subopdracht | Uitvoer |
|-------------|---------|
| `list` | Toont welke PUA-lettertypen nodig zijn en hun installatiestatus |
| `install` | Downloadt lettertypen voor geconfigureerde talen |

| Optie | Effect |
|-------|--------|
| `--dir <path>` | Uitvoermap voor lettertypen overschrijven (automatisch gedetecteerd op basis van projecttype) |
| `--css` | Een `conlang-fonts.css`-fragment genereren naast de lettertypen |
| `--config <path>` | Pad naar configuratiebestand (gebruikt om te detecteren welke talen lettertypen nodig hebben) |

**Automatische detectie:** De uitvoermap wordt afgeleid uit uw projectstructuur:
- **Docusaurus** → `static/fonts/` of `website/static/fonts/`
- **Hugo** → `static/fonts/`
- **Standaard** → `public/fonts/`

**Systeemeigen Unicode-converters** (`crk` → Cree-syllabeschrift, `sr` → Servisch Cyrillisch) vereisen GEEN lettertype-installatie.

Zie [Contalen, schriften & orthografie](/docs/guides/conlangs-scripts-orthography) voor volledige details over PUA-lettertypen.

## Drielaagse pijplijn

Gebruik `lint`, `sync` en `audit` samen voor een waterdichte i18n-aanpak:

```json title="package.json"
{
  "scripts": {
    "i18n:lint": "champollion lint",
    "i18n:sync": "champollion sync",
    "i18n:audit": "champollion audit"
  }
}
```

| Laag | Opdracht | Wanneer | Doel |
|------|----------|---------|------|
| **Lint** | `lint` | Pre-commit | Commits met hardgecodeerde teksten blokkeren |
| **Sync** | `sync` | Na commit / CI | Ontbrekende en gewijzigde sleutels vertalen |
| **Verify** | `verify` | Na sync / CI | Bevestigen dat vertalingen aanwezig en correct zijn |
| **Audit** | `audit` | Bouwstap | Implementatie laten mislukken als een locale `[EN]`-markeringen bevat |

---

## Zie ook

- [Configuratie](/docs/getting-started/configuration) — referentie voor het configuratiebestand
- [Vertaalmethoden](/docs/guides/translation-methods) — methodeselectie per paar
- [Vertaalgeheugen](/docs/concepts/translation-memory) — caching en kostenbesparing
- [Werken met professionele vertalers](/docs/guides/professional-translators) — XLIFF-workflow
- [Plugin-specificatie](/docs/reference/plugin-spec) — pluginmanifestformaat
- [CI/CD-handleiding](/docs/guides/ci-cd) — CLI-opdrachten automatiseren in uw pijplijn
- [Hoe synchronisatie werkt](/docs/concepts/how-sync-works) — de synchronisatiepijplijn begrijpen
- [Kwaliteitsgate](/docs/concepts/quality-gate) — hoe vertalingen worden gevalideerd
