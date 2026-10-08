---
sidebar_position: 1
slug: /intro
title: "Inleiding"
related:
  - label: "Quick Start"
    to: /docs/getting-started/quick-start
    kind: guide
    note: "Install, configure, and run your first sync"
  - label: "How It Works"
    to: /docs/how-it-works
    kind: doc
    note: "The pipeline behind every translation"
  - label: "Translation Methods"
    to: /docs/guides/translation-methods
    kind: guide
    note: "LLM, Google Translate, coached, plugin — when to use which"
  - label: "The Language Atlas"
    to: /languages
    kind: atlas
    note: "Every language Champollion knows, on the map"
  - label: "Live Leaderboard"
    to: /leaderboard
    kind: leaderboard
    note: "Translation methods, benchmarked in the open"
---

# champollion

Een volledig aanpasbaar internationalisatieframework. Eén opdracht vertaalt uw localebestanden. Eén configuratie beheert elke methode, elk model en elk taalpaar. En als de ingebouwde methoden niet volstaan — bouw uw eigen, test of het werkt, en implementeer het.

```bash
npx champollion sync
```

champollion detecteert automatisch uw locale-bestanden, indeling en doeltalen. Het vertaalt wat er ontbreekt, slaat over wat al klaar is, controleert elk resultaat op beschadigde uitvoer en schrijft zuivere uitvoer weg. Dat is het vertrekpunt.

:::info[Onderdeel van iets groters]

Deze CLI vormt het implementatiegedeelte van **Champollion** — infrastructuur die
machinale vertaling meet voor talen die door niemand anders worden gemeten, en
publiceert wat zij ontdekt. De meetzijde bouwt evaluatietestsets en
een openbare kaart van wie wat kan vertalen, hoe goed en op welke soorten tekst;
via de CLI wordt een bewezen methode iets wat u daadwerkelijk kunt uitvoeren.

Eén regel bepaalt alles: taalgegevens worden behandeld als biodata, dus de
mensen die een corpus aanleveren, hebben de sleutel in handen tot het corpus en tot alles wat daaraan
wordt afgemeten. Het volledige plaatje — wat er bestaat, wat de regels zijn, waar u
in het geheel past — vindt u in [Wat Champollion is](/docs/what-is-champollion), en het
meetgedeelte bevindt zich onder [het Netwerk](/docs/network/).

:::

---

## Waarom Niet Gewoon Zelf Scripten?

U kunt een snelle lus schrijven die Google Translate aanroept voor elke sleutel. De meeste ontwikkelaars doen dat — het kost ongeveer 30 regels. Hier loopt het mis:

- **Geen wijzigingsdetectie.** Werkt u een Engelse string bij — dan blijft de vertaling voor altijd verouderd. champollion volgt elke bronwaarde met SHA-256-hashes en vertaalt alleen opnieuw wat gewijzigd is.
- **Geen batchverwerking.** Eén API-aanroep per sleutel betekent 200 sleutels = 200 roundtrips. champollion batcht op intelligente wijze (configureerbaar, standaard 80 sleutels/batch voor LLM, 128 voor Google).
- **Geen caching.** Elke synchronisatie vertaalt alles opnieuw. champollions Translation Memory cachet vertalingen op basis van brontekst + locale + methode — het opnieuw uitvoeren van de synchronisatie na één sleutelwijziging vertaalt alleen die ene sleutel, niet het hele bestand.
- **Geen quality gate.** Machinale vertaling hallucineert, echoot de brontekst terug of levert uitvoer in het verkeerde schrift. champollion controleert elke vertaling voordat deze wordt weggeschreven — lege uitvoer, bronecho's, herhalingslussen, lengte-inflatie, verwijderde inhoud en het verkeerde schrift worden opgevangen en afgewezen. De gate onderschept defecte uitvoer, geen verkeerde betekenis.
- **Geen formaatherkenning.** Hardcoded voor JSON? champollion verwerkt JSON, TOML, YAML en Hugo Markdown (frontmatter + hoofdtekst) met automatische detectie.
- **Geen controle over methoden.** Elk talenpaar krijgt dezelfde methode. Met champollion kunt u Google Translate gebruiken voor Frans, een LLM voor Japans en een aangepaste, door de community gehoste pipeline voor Cree — in hetzelfde configuratiebestand.

champollion is de productieversie van dat script.

---

## Wat Het Onderscheidt

### Elke methode is een plugin

De vertaalmethode is **configureerbaar per taalpaar**. Combineer Google Translate, LLM's, coached prompts en aangepaste API's in hetzelfde project:

```json title="champollion.config.json"
{
  "version": 3,
  "pairs": {
    "en:fr": { "method": "google-translate" },
    "en:ja": { "method": "llm", "model": "google/gemini-3.1-pro-preview" },
    "en:crk": { "method": "llm-coached" }
  }
}
```

Frans krijgt Google Translate (snel, goedkoop). Japans krijgt een premium LLM (genuanceerd). Plains Cree krijgt een LLM dat wordt aangestuurd met de grammaticaregels en het woordenboek dat u aanlevert. Hetzelfde `sync`-commando. Dezelfde quality gate. Dezelfde CLI.

### Zie wat werkt

Denkt u dat uw methode Engels naar Spaans kan vertalen? Turks naar Azerbeidzjaans? Engels naar Cree?

**Bouw het en test het.** De bijbehorende [eval harness](/docs/network/specifications/harness) benchmarkt elke vertaalmethode met reproduceerbare, gefingerprintte scores. Het [leaderboard](/leaderboard) registreert elke gepubliceerde run, zodat iedereen kan zien wat werkt.

De eval harness en de productie-CLI delen dezelfde plugin-interface. Een methode die goed scoort in de harness kan in productie worden gebruikt — als de gemeenschap wier taal ermee gediend wordt, toestemming geeft. Voor inheemse talen en talen met weinig middelen is die toestemming van wezenlijk belang. Zie [Datasoevereiniteit](/docs/network/sovereignty/data-sovereignty).

```bash
# Benchmark a method against a real, non-bundled eval corpus
# (GlobalVoices amh->fra, 945 sentences, fetched from source on first run)
python3 -m pip install mt-eval-harness
export OPENROUTER_API_KEY=sk-or-...   # any OpenRouter-proxied model works
mt-eval run --corpus eval-amh-fra-globalvoices-test-v1 --model google/gemini-3.1-pro-preview --yes

# Use it locally
npx champollion sync
```

Dezelfde plugin. Aansluiten en testen.

### De volledige toolkit

champollion is niet alleen `sync`. Het is een complete i18n-pipeline:

| Opdracht | Wat Het Doet |
|---------|-------------|
| `sync` | Vertaal ontbrekende en verouderde sleutels (met verificatie na synchronisatie) |
| `watch` | Automatisch synchroniseren wanneer uw bronbestand wijzigt |
| `lint` | Broncode scannen op hardgecodeerde strings |
| `wrap` | Hardgecodeerde strings automatisch inpakken in `t()` aanroepen |
| `audit` | Alle `[EN]` fallback-markeringen uit eerdere runs weergeven |
| `verify` | Verifieer of vertalingen aanwezig en correct zijn (CI-gate) |
| `integrity` | Detecteer placeholder-corruptie, coderingsproblemen en ICU-meervoudsvolledigheid |
| `seo` | Genereer hreflang-tags, sitemaps en JSON-LD-schema |
| `status` | Toon paarconfiguratie, plugins en benchmarkscores |
| `provenance` | Controleer licenties van vertaalresources |
| `plugin` | Installeer, verwijder en beheer methode-plugins |
| `fonts` | Download weblettertypen voor PUA-schriftconverters |
| `tm` | Beheer de Translation Memory-cache (statistieken, wissen, per locale) |
| `xliff` | Exporteer/importeer XLIFF 1.2 voor beoordeling door professionele vertalers |

Vier hiervan — `lint`, `sync`, `verify`, `audit` — vormen een CI-pipeline die hardgecodeerde strings opspoort, ze vertaalt, de juistheid verifieert en de build laat mislukken als een locale onvolledig is.

---

## Het Netwerk

Het [Methoden-leaderboard](/leaderboard) is het scorebord — live, openbaar en open voor inzendingen. Elke inzending is voorzien van een vingerafdruk die gekoppeld is aan een Git-commit, geversioneerd naar een specifieke dataset en beoordeeld door hetzelfde testharnas. Iedereen kan inzenden.

**Wat kunt u bouwen?** De harness verwerkt JSON. Plugins verwerken JSON. Elke methode die JSON produceert kan worden getest:

| Aanpak | Voorbeeld |
|----------|---------|
| **Coached LLM** | Injecteer grammaticaregels en woordenboeken in de prompt van een frontiermodel |
| **Fijnafgestemd model** | Train een open model op parallelle tekst — maar niet op de evaldata |
| **FST-gated pipeline** | LLM genereert → finite-state transducer valideert morfologie → opnieuw proberen |
| **Geketende modellen** | Model A maakt concept → Model B bewerkt na → Model C scoort |
| **Woordenboek + LLM** | Dwing bekende termen af vanuit een woordenboek, laat de LLM de rest afhandelen |
| **Evolutionair** | Genereer kandidaten, scoor ze, muteer de beste, herhaal |
| **Gedeeltelijke vertaling** | Vertaal een steekproef handmatig, bewijs dat uw LLM overeenkomt, vertaal de rest automatisch |

Stem modellen fijn af. Implementeer evolutionaire algoritmen. Test antwoorden van studenten op taalexamens. Bouw opzoektabellen. Keten drie modellen aan elkaar. Zolang uw methode JSON produceert, scoort de harness het en voert het framework het uit.

:::danger[De ene regel]
**Train niet op de evaluatiedata.** Methoden die zijn blootgesteld aan de benchmarkdataset worden gediskwalificeerd. Stem af op wat u wilt. Maar niet op de testset.
:::

Dit is een open uitnodiging. Als u werkt met een taal met weinig middelen — als onderzoeker, gemeenschapslid, student, of gewoon als iemand die het belangrijk vindt — bouw een methode, voer de harness uit en versterk het netwerk voor iedereen. Het probleem is onopgelost. De infrastructuur is er, en ze is open.

**[→ Bekijk het leaderboard](/leaderboard)**

---

## Volgende Stappen

**Aan de slag:**
- [Installatie](/docs/getting-started/installation) — In 2 minuten opgezet
- [Snelstart](/docs/getting-started/quick-start) — Voer uw eerste synchronisatie uit
- [Ondersteunde talen](/docs/reference/supported-languages) — Wat standaard beschikbaar is

**Uw configuratie aanpassen:**
- [Vertaalmethoden](/docs/guides/translation-methods) — Kies de juiste methode per taalpaar
- [Translation Memory](/docs/concepts/translation-memory) — Hoe caching u geld bespaart
- [Configuratie](/docs/getting-started/configuration) — Volledige configuratiereferentie
- [Hugo meertalige website](/docs/tutorials/hugo-multilingual-site) — Vertaling van Markdown-inhoud

**Meer verdieping:**
- [Samenwerken met professionele vertalers](/docs/guides/professional-translators) — XLIFF export-/import-workflow
- [Datasoevereiniteit](/docs/network/sovereignty/data-sovereignty) — Principes van inheemse datasoevereiniteit: eigenaarschap en zeggenschap over taalgegevens door de gemeenschap
- [Een taal met weinig middelen ondersteunen](/docs/network/community/low-resource-languages) — De uitdaging waarmee het allemaal begon
- [Cookbook: FST-gevalideerde pipeline](/docs/network/tutorials/fst-gated-pipeline) — Bouw een decompositiepipeline
- [MT-evaluatie](/docs/network/leaderboard/rules) — Hoe het testharnas en het leaderboard werken
- [Methoden-leaderboard](/leaderboard) — Live scores en inzendingen
