---
sidebar_position: 1
slug: /intro
title: "App- en sitevertaling"
description: "De referentie voor het vertalen van de eigen bestanden van een app of website met `champollion sync`: wat het doet, wanneer u het gebruikt en een gids voor elke pagina erover."
related:
  - label: "Quick Start"
    to: /docs/getting-started/quick-start
    kind: guide
    note: "Install, configure, and run your first sync"
  - label: "How Sync Works"
    to: /docs/concepts/how-sync-works
    kind: doc
    note: "The pipeline behind every translation"
  - label: "Translation Methods"
    to: /docs/guides/translation-methods
    kind: guide
    note: "LLM, machine-translation APIs, your own model — when to use which"
  - label: "Translate an app or website"
    to: /docs/translate-an-app-or-website
    kind: guide
    note: "The same lane, in plain words"
---

# App- en sitevertaling

`champollion sync` houdt de vertalingen van een app of een website synchroon met de
brontaal. Het leest uw locale-bestanden (of uw Markdown-pagina's), detecteert
wat er ontbreekt of verouderd is, vertaalt uitsluitend dat, controleert elk resultaat
en schrijft het terug in het eigen formaat van het bestand.

```bash
npx champollion sync
```

Deze sectie is de referentie voor dat traject. Als u eerst de versie in
eenvoudige taal wilt lezen, raadpleeg dan [Een app of website vertalen](/docs/translate-an-app-or-website).

## Wat `sync` doet

1. **Vindt uw bestanden.** Het detecteert de locale-map en het formaat (JSON, TOML,
   YAML, gettext PO, Flutter ARB), of een map met Markdown/MDX-pagina's (Hugo,
   Docusaurus of elke map die u opgeeft met `--content-dir`).
2. **Bepaalt wat er is gewijzigd.** Elke bronwaarde wordt vastgelegd aan de hand van de SHA-256-hash
   in `.champollion.lock`. Sleutels die ontbreken, leeg zijn of waarvan de brontekst
   is gewijzigd, worden in de wachtrij geplaatst; al het overige blijft onaangeroerd.
3. **Vertaalt met de methode die u voor elk paar hebt gekozen.** Eén configuratiebestand kan
   het ene paar naar een LLM sturen, een ander naar een API voor machinevertaling en een derde
   naar een model dat u zelf hebt getraind en host. LLM-methoden vertalen standaard
   op temperatuur 0 (de enige standaardwaarde in `shared/model-defaults.json`);
   een gehost model kan tussen uitvoeringen nog steeds enigszins variëren, wat een van de redenen
   is waarom het vertaalgeheugen bewaart wat het al heeft ontvangen.
4. **Hergebruikt waar al voor is betaald.** Het vertaalgeheugen buffert elke
   vertaling op basis van brontekst, locale en methode: tekst die terugkeert (een
   string die is teruggedraaid, dezelfde zin in een ander bestand, een herhaling) is gratis.
5. **Controleert elk resultaat voor het schrijven.** De kwaliteitscontrole weigert lege
   uitvoer, een exacte kopie van de bron, herhalingslussen, uitvoer in het verkeerde schrift,
   beschadigde placeholders en vergelijkbare fouten, met één herpoging met feedback. Het
   onderschept defecte uitvoer, geen foutieve betekenis.
6. **Verifieert na het schrijven.** Een controle na de synchronisatie leest de geschreven bestanden opnieuw
   en controleert sleutelovereenstemming, lege waarden, schrift en placeholders;
   `champollion verify` en `champollion audit` voeren dezelfde soort controles uit als
   CI-gates.

Er wordt niets stilletjes weggeschreven. Een sleutel die na de herpoging nog steeds
door de kwaliteitscontrole wordt geweigerd, blijft onvertaald en wordt gerapporteerd,
en de synchronisatie sluit af met `2`. De weigering wordt onthouden,
zodat een volgende reguliere synchronisatie niet hetzelfde model betaalt voor hetzelfde
antwoord: u vraagt het opnieuw aan met `--redo`, voegt een `fallback`-methode toe aan het paar,
of voert de waarde handmatig in.

## Wanneer u dit gebruikt

- U hebt een app of een website waarvan de tekst zich in locale-bestanden of Markdown bevindt,
  en u wilt dat de overige talen actueel blijven naarmate de brontekst verandert.
- U wilt per taalpaar in één project een verschillende methode gebruiken, waarbij de uitgaven
  begrensd zijn (`--max-cost`) en inzichtelijk zijn voordat er iets in rekening wordt gebracht (`--dry`).
- U hebt een vertaler op de rails gebouwd en wilt dat een app deze gebruikt:
  `champollion connect` plaatst een gehost model in een app-project, en `sync`
  vertaalt er vervolgens mee. Een model dat uitsluitend op lokale gegevens is getraind, wordt
  pas gekoppeld wanneer de houders daarvan hebben ingestemd.

`sync` is niet bedoeld om een vertaler te bouwen voor een taal die door geen enkele dienst
goed wordt ondersteund. Begin daarvoor bij [Een project starten](/docs/start).

## De pagina's in deze sectie

**Aan de slag**

- [Snelstart](/docs/getting-started/quick-start) — een eerste synchronisatie binnen enkele minuten.
- [Installatie](/docs/getting-started/installation) — vereisten, API-sleutels
  en de licentie.
- [Configuratie](/docs/getting-started/configuration) — elk veld in
  `champollion.config.json`, instellingen per paar, locale-indelingen en fallbacks.

**Uw framework en uw pipeline**

- [Framework-integraties](/docs/integrations/frameworks) — Hugo, next-intl,
  react-i18next, Flutter en Django met gettext.
- [CI/CD](/docs/guides/ci-cd) — `lint`, `sync`, `verify` en `audit` als gates.
- [Contentvertaling](/docs/guides/content-translation) — Markdown- en MDX-pagina's,
  frontmatter en wat er behouden blijft.

**Kiezen hoe er wordt vertaald**

- [Vertaalmethoden](/docs/guides/translation-methods) — elke methode,
  de bijbehorende sleutel en wanneer u deze gebruikt.
- [Coaching-gegevens](/docs/concepts/coaching-data) — grammatica-aantekeningen en woordenlijsten
  die bij elk verzoek aan een LLM worden meegegeven.
- [Schriftconverters](/docs/concepts/script-converters) en
  [Kunsttalen, schriften & orthografie](/docs/guides/conlangs-scripts-orthography)
  — schriftsystemen, lettertypen en geconstrueerde talen.

**De interne werking**

- [Hoe synchronisatie werkt](/docs/concepts/how-sync-works) — de pipeline, stap voor stap.
- [Vertaalgeheugen](/docs/concepts/translation-memory) — de cache en waarop
  deze indexeert.
- [Kwaliteitscontrole](/docs/concepts/quality-gate) — elke controle en wat er gebeurt
  met een geweigerde sleutel of een geweigerd blok.
- [Beveiliging](/docs/concepts/security) — gemanipuleerde sleutels en paden, beschermde
  codeblokken en expliciet falen bij fouten.

**Mensen en problemen**

- [Samenwerken met professionele vertalers](/docs/guides/professional-translators)
  — XLIFF-export en -import voor revisie.
- [Probleemoplossing](/docs/guides/troubleshooting) — veelvoorkomende fouten en oplossingen.

Elk commando en elke vlag staat in de [CLI-referentie](/docs/reference/cli), en de
indeling voor methode-plug-ins staat in de [Plug-inspecificatie](/docs/reference/plugin-spec).

## Licentie

De `champollion`-CLI is source-available onder de
[PolyForm Noncommercial License 1.0.0](https://github.com/gamedaysuits/Champollion/blob/main/cli/LICENSE);
[wie het mag gebruiken](/docs/getting-started/who-may-use-this) geeft aan wie hieronder valt.
Ervaart u problemen of wilt u hulp bij uw project? [Neem contact op](/docs/getting-help).
