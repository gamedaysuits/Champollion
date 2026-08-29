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

champollion detecteert automatisch uw localebestanden, indeling en doeltalen. Het vertaalt wat ontbreekt, slaat over wat al gedaan is, valideert elk resultaat en schrijft nette uitvoer. Dat is het startpunt.

:::info[Onderdeel van iets groters]

Deze CLI is de implementatiekant van **Champollion** — infrastructuur die machinevertaling meet voor talen die niemand anders meet, en publiceert wat het vindt. De meetkant bouwt evaluatietestsets en een openbare kaart van wie wat kan vertalen, hoe goed, en voor welke soorten tekst; de CLI is de plek waar een bewezen methode iets wordt dat u daadwerkelijk kunt uitvoeren.

Eén regel is bepalend voor alles: taaldata wordt behandeld als biodata, dus de mensen die een corpus leveren, hebben de sleutels ertoe in handen, evenals tot alles wat daaraan wordt gemeten. Het volledige beeld — wat er bestaat, wat de regels zijn, wat uw rol is — vindt u in [Wat Champollion is](/docs/what-is-champollion), en de meetkant is te vinden onder [het Netwerk](/docs/network/).

:::

---

## Waarom Niet Gewoon Zelf Scripten?

U kunt een snelle lus schrijven die Google Translate aanroept voor elke sleutel. De meeste ontwikkelaars doen dat — het kost ongeveer 30 regels. Hier loopt het mis:

- **Geen wijzigingsdetectie.** Pas een Engelse string aan — de vertaling blijft voor altijd verouderd. champollion houdt elke bronwaarde bij met SHA-256-hashes en hertaalt alleen wat is gewijzigd.
- **Geen batching.** Eén API-aanroep per sleutel betekent 200 sleutels = 200 round trips. champollion batcht intelligent (configureerbaar, standaard 80 sleutels/batch voor LLM, 128 voor Google).
- **Geen caching.** Elke synchronisatie hertaalt alles. De Translation Memory van champollion slaat vertalingen op per brontekst + locale + methode — een herhaalde synchronisatie na één sleutelwijziging vertaalt alleen die ene sleutel, niet het hele bestand.
- **Geen kwaliteitscontrole.** Machinevertaling hallucineert, echoot de bron terug, of produceert uitvoer in het verkeerde schrift. champollion valideert elke vertaling vóór het wegschrijven — verkeerd schrift, lengte-inflatie en bronecho's worden onderschept en afgewezen.
- **Geen formaatbewustzijn.** Hardgecodeerd voor JSON? champollion verwerkt JSON, TOML, YAML en Hugo Markdown (frontmatter + body) met automatische detectie.
- **Geen methodebeheer.** Elk taalpaar krijgt dezelfde methode. champollion laat u Google Translate gebruiken voor Frans, een LLM voor Japans, en een aangepaste community-hosted pipeline voor Cree — in hetzelfde configuratiebestand.

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
    "en:ja": { "method": "llm", "model": "google/gemini-2.5-pro" },
    "en:crk": { "methodPlugin": "crk-coached-v1" }
  }
}
```

Frans krijgt Google Translate (snel, goedkoop). Japans krijgt een premium LLM (genuanceerd). Plains Cree krijgt een coached plugin met grammaticaregels, woordenboeken en morfologische validatie. Dezelfde `sync` opdracht. Dezelfde kwaliteitscontrole. Dezelfde CLI.

### Zie wat werkt

Denkt u dat uw methode Engels naar Spaans kan vertalen? Turks naar Azerbeidzjaans? Engels naar Cree?

**Bouw het en test het.** De bijbehorende [eval harness](/docs/network/specifications/harness) benchmarkt elke vertaalmethode met reproduceerbare, gefingerprintte scores. Het [leaderboard](/leaderboard) registreert elke gepubliceerde run, zodat iedereen kan zien wat werkt.

De eval harness en de productie-CLI delen dezelfde plugin-interface. Een methode die goed scoort in de harness kan in productie worden gebruikt — als de gemeenschap wier taal ermee gediend wordt, toestemming geeft. Voor inheemse talen en talen met weinig middelen is die toestemming van wezenlijk belang. Zie [Datasoevereiniteit](/docs/network/sovereignty/data-sovereignty).

```bash
# Benchmark a method against a real, non-bundled eval corpus
# (GlobalVoices amh->fra, 945 sentences, fetched from source on first run)
pip install mt-eval-harness
export OPENROUTER_API_KEY=sk-or-...   # any OpenRouter-proxied model works
mt-eval run --corpus eval-amh-fra-globalvoices-test-v1 --model gemini-pro --yes

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

Het [Method Leaderboard](/leaderboard) is het scorebord — live, openbaar en open voor inzendingen. Elke inzending wordt via een vingerafdruk gekoppeld aan een Git-commit, geversioneerd naar een specifieke dataset en gescoord door hetzelfde testraamwerk. Iedereen kan een inzending doen.

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

**Verdieping:**
- [Werken met professionele vertalers](/docs/guides/professional-translators) — XLIFF export/import-workflow
- [Datasoevereiniteit](/docs/network/sovereignty/data-sovereignty) — First Nations-, CARE- en Māori-principes voor datasoevereiniteit
- [Een low-resource taal ondersteunen](/docs/network/community/low-resource-languages) — De uitdaging waar het allemaal mee begon
- [Cookbook: FST-Gated Pipeline](/docs/network/tutorials/fst-gated-pipeline) — Een decompositiepijplijn bouwen
- [MT-evaluatie](/docs/network/leaderboard/rules) — Hoe het testraamwerk en het leaderboard werken
- [Method Leaderboard](/leaderboard) — Live scores en inzendingen
