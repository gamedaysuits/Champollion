---
sidebar_position: 5
title: "Inhoudsvertaling"
---

# Contentvertaling (Markdown)

Champollion vertaalt Markdown- en MDX-bestanden, zowel de frontmatter-velden als de hoofdtekst. Codeblokken, shortcodes en andere gestructureerde elementen worden beschermd tegen vertaling.

De bestanden bevinden zich in een **contentdirectory** (`contentDir`). Dat kan elke map met Markdown zijn: de `content/` van een Hugo-site of een map met nieuwsbrieven binnen een Next.js-app. Een Docusaurus-site (een site met een `docusaurus.config.js`) werkt anders: de `docs/` en `blog/` worden vertaald naar `i18n/<locale>/`-mappen zonder een `contentDir`. Zie [Framework-integratie](/docs/guides/framework-integration).

## Instelling

Stel `contentDir` in uw configuratie in, of geef `--content-dir` mee via de opdrachtregel:

```json title="champollion.config.json"
{
  "version": 3,
  "inputLocale": "en",
  "localesDir": "./messages",
  "contentDir": "./newsletters"
}
```

```bash
npx champollion sync                              # translates string files and content files
npx champollion sync --content-dir ./newsletters  # same, folder given on the command line
```

Aan het begin van een uitvoerbeurt noemt sync de map en geeft aan waar de vertalingen worden geplaatst:

```
[INFO] Content directory: newsletters — a folder of Markdown/MDX files (no Hugo site found); each translation is written beside its source as <name>.<locale>.md
```

Bij een Hugo-site vermeldt het ook het gevonden bewijs, bijvoorbeeld `Detected framework: Hugo (hugo.toml)`. Hugo wordt als gevonden beschouwd wanneer er een `hugo.toml`/`.yaml`/`.yml`/`.json`-bestand aanwezig is, Hugo's `config/_default/`-map, een `config.toml` of `config.yaml` met een instelling die alleen voor Hugo geldt zoals `baseURL`, een `archetypes/`-map, of een `layouts/`-map met Hugo-templates. Of het nu Hugo is of niet, de bestanden worden op dezelfde manier vertaald en benoemd.

## Waar vertalingen worden geplaatst

Elke vertaling wordt **naast de bron** weggeschreven, waarbij de doellocale vóór de extensie wordt toegevoegd. Dit is de translation-by-filename-conventie van Hugo:

```
newsletters/2026-10.md      → newsletters/2026-10.crk.md
newsletters/2026-10.md      → newsletters/2026-10.fr.md
posts/launch.mdx            → posts/launch.crk.mdx       (.mdx stays .mdx)
posts/launch.en.md          → posts/launch.crk.md        (the source-language suffix is dropped)
```

Submappen worden ook doorzocht en elke vertaling blijft in de map van het bronbestand. Uw app kiest het bestand voor een locale op basis van die naam. Een Next.js-pagina leest bijvoorbeeld `newsletters/2026-10.crk.md` voor Plains Cree.

**Welke bestanden als bron tellen.** Elk `.md`- en `.mdx`-bestand in de map is een bronbestand, tenzij de naam eindigt op `.<code>.md` (of `.mdx`) en `<code>` lijkt op een taalcode. Een taalcode bestaat hier uit twee of drie kleine letters, optioneel gevolgd door een schrift zoals `-Hant` en/of een regio zoals `-BR` of `-419`. Die bestanden worden beschouwd als vertalingen en overgeslagen. Een achtervoegsel voor de brontaal (`launch.en.md`) telt nog steeds als bron. Een valkuil: een bronbestand met een naam als `guide.faq.md` eindigt ook op een achtervoegsel van twee of drie letters, waardoor het wordt aangezien voor een vertaling naar "faq" en niet wordt vertaald. Hernoem het, bijvoorbeeld naar `guide-faq.md`.

## Wat er vertaald wordt

### Front Matter

Zowel YAML- (`---`) als TOML- (`+++`) scheidingstekens worden ondersteund. Standaard worden de volgende velden vertaald:

- `title`
- `description`
- `summary`
- `subtitle`
- `caption`
- `linkTitle`
- `sidebar_label`

Alle overige velden (`date`, `draft`, `tags`, `weight`, `slug` enz.) worden ongewijzigd uit de bron gekopieerd. U kunt de lijst aanpassen met `translatableFields` in uw configuratie.

### Bodytekst

Standaard wordt de hoofdtekst opgesplitst in alinea's en andere blokken op het hoogste niveau, en elk blok wordt vertaald. Gestructureerde elementen worden vóór de vertaling afgeschermd door placeholders en daarna hersteld. Met `contentSegmentation: "page"` wordt de hoofdtekst als één geheel vertaald.

## Blokbeveiliging

De volgende elementen passeren de vertaling ongewijzigd:

| Element | Voorbeeld | Beveiliging |
|---------|---------|-----------|
| Codeblokken | ``````` ```js ... ``` ``````` | Volledig blok afgeschermd |
| Inline code | `` `variable` `` | Afgeschermd |
| Hugo shortcodes | `{{< figure >}}`, `{{% note %}}` | Volledig blok afgeschermd |
| Ruwe HTML | `<div>`, `<table>` | Afgeschermd |
| Links (URL's) | `[text](https://...)` | URL bewaard, tekst vertaald |
| Interpolatie | `{{ .Count }}` | Afgeschermd |

## Wanneer een bestand opnieuw wordt vertaald

Sync legt een vingerafdruk (SHA-256) van elk bronbestand vast in `.champollion-content.lock`. Commit dat bestand samen met uw vertalingen.

- **Bron ongewijzigd:** de vertaling blijft onaangeroerd.
- **Bron gewijzigd:** het bestand wordt bijgewerkt. Alinea's waarvan de Engelse tekst ongewijzigd is, komen kosteloos uit het [Vertaalgeheugen](/docs/concepts/translation-memory), waardoor u alleen betaalt voor de alinea's die zijn gewijzigd.
- **Een vertaalbestand zonder lock-vermelding** (een bestand dat u handmatig hebt geschreven) blijft ongewijzigd behouden en wordt geregistreerd als door u geschreven. Een uitzondering is een bestand dat nog `[EN] `-markers bevat die zijn geschreven door een CLI-versie ouder dan 0.5.0; dit wordt opnieuw vertaald.
- **Een blok dat door de kwaliteitscontrole is geweigerd, ook na een nieuwe poging met vermelding van de reden,** behoudt zijn brontekst, zonder markering op de pagina. De lock-vermelding van de pagina luidt `pending:<hash>` en de weigering wordt vastgelegd in `.champollion-content.lock`. Latere synchronisaties sturen dat blok niet opnieuw naar hetzelfde model, waardoor er geen kosten meer voor in rekening worden gebracht. `status` en `verify` vermelden de pagina. Vraag het opnieuw aan met `--redo files:<page>`, voeg een `fallback`-methode toe of schrijf de alinea zelf (deze wordt behouden). Een geweigerd frontmatter-veld behoudt op dezelfde wijze zijn brontekst en de rest van de pagina wordt weggeschreven. Zie [Geweigerde Markdown-blokken en frontmatter-velden](/docs/concepts/quality-gate#refused-markdown-blocks-and-front-matter-fields).

Om een bestand doelbewust opnieuw te vertalen, geeft u de naam op. Het pad is het pad dat sync weergeeft, relatief ten opzichte van de contentdirectory:

```bash
npx champollion sync --redo files:2026-10.md          # rebuild from the cache (free for unchanged text)
npx champollion sync --redo files:2026-10.md --fresh  # translate it again from scratch (paid again)
```

## Vertalingen beoordelen en bewerken {#reviewing-and-editing-translations}

Een beoordelaar kan vertaalde Markdown rechtstreeks in het vertaalde bestand corrigeren. Champollion behoudt die correcties wanneer de bron later wordt gewijzigd.

1. Voer `champollion sync` uit en commit de vertalingen samen met `.champollion-content.lock`.
2. De beoordelaar opent het vertaalde bestand, bijvoorbeeld `newsletters/2026-10.crk.md`, en bewerkt het. De beoordelaar kan elke alinea aanpassen, of een vertaald frontmatter-veld zoals `title` of `description`.
3. De beoordelaar commit het bestand. Er is geen opdracht nodig om de bewerkingen te "accepteren".

Wat er gebeurt met de bewerkingen bij de volgende `champollion sync`:

| Situatie | Wat sync doet |
|---|---|
| De bron is niet gewijzigd | Niets. De vertaling blijft exact zoals de beoordelaar deze heeft achtergelaten. |
| De bron is gewijzigd in **andere** alinea's | De alinea's en velden van de beoordelaar worden **woord voor woord behouden** en de gewijzigde alinea's worden vertaald. De uitvoerbeurt geeft dit aan, bijvoorbeeld `kept the edits made by hand to 1 paragraph(s) of 2026-10.crk.md`. De tekst van de beoordelaar blijft bij elke latere synchronisatie behouden. |
| De bronalinea die de beoordelaar heeft bewerkt, is **ook** gewijzigd | Die alinea wordt opnieuw vertaald, omdat de versie van de beoordelaar een Engelse tekst vertaalt die niet meer bestaat. De uitvoerbeurt toont een waarschuwing met de bewoording van de beoordelaar, zodat deze opnieuw kan worden toegepast als deze nog passend is. |
| De beoordelaar heeft alinea's toegevoegd, verwijderd of samengevoegd, of het paar gebruikt `contentSegmentation: "page"` | De bewerkingen kunnen niet alinea voor alinea worden gekoppeld. Wanneer de bron verandert, blijft het bestand **exact zoals het is** en geeft elke synchronisatie een waarschuwing en vermelding totdat het is opgelost. Werk het handmatig bij (de volgende synchronisatie beschouwt het bewerkte bestand dan als actueel) of vervang het door machinevertaling via `--redo files:<path>`. |

Bewerkingen aan codeblokken, witruimte tussen alinea's en frontmatter-velden die niet worden vertaald (`date`, `tags` enzovoort) worden niet behouden wanneer het bestand opnieuw wordt weggeschreven. Die onderdelen zijn altijd afkomstig uit de bron.

**Bewerkingen bewust overschrijven.** Bewerkingen worden alleen vervangen wanneer u het bestand specifiek opgeeft. `--redo files:2026-10.md` zet de gecachete machinevertaling terug. `--redo files:2026-10.md --fresh` (of `--retranslate 2026-10.md`) vertaalt het geheel opnieuw vanaf het begin. Een uitvoerbeurt die alle content opnieuw verwerkt zonder bestanden specifiek te benoemen (`--redo content`, `--force-content`) behoudt de bewerkingen.

**Hoe bewerkingen worden herkend.** Telkens wanneer sync een vertaling wegschrijft, legt het in `.champollion-content.lock` ook een korte vingerafdruk vast van elke geschreven alinea. Een alinea op schijf die niet langer overeenkomt, is door een persoon gewijzigd. Als het lock-bestand verloren gaat, kunnen bewerkingen niet worden herkend; bewaar het daarom in versiebeheer. Een vertaling die door een oudere versie van Champollion is geschreven, wordt bij de volgende synchronisatie geregistreerd. Als uw bewerkingen daarin afwijken van wat het vertaalgeheugen bevat, worden ze als uw eigen bewerkingen herkend.

De tekst van de beoordelaar wordt nooit als machine-output in het vertaalgeheugen opgeslagen.

:::note[XLIFF heeft alleen betrekking op stringbestanden]
`champollion xliff export` draagt de **stringbestanden** (sleutels en waarden) van uw app over aan de CAT-tool van een vertaler. Zie [Samenwerken met professionele vertalers](/docs/guides/professional-translators). Er is momenteel nog geen XLIFF-export voor Markdown-content, dus vertaalde Markdown wordt in de bestanden zelf beoordeeld, zoals hierboven beschreven.
:::

## Uitsluitend Markdown-methoden

:::warning[Google Translate en Markdown]
Google Translate heeft **geen weet** van codeblokken, shortcodes of interpolatievariabelen. Het zal gestructureerde Markdown-content beschadigen. Gebruik LLM-methoden (`llm` of `llm-coached`) voor contentvertaling, omdat deze gestructureerde elementen expliciet afschermen.
:::

Wanneer inhoudsvertaling terugvalt van Google Translate naar een LLM-methode, registreert champollion een waarschuwing met uitleg over de reden.
