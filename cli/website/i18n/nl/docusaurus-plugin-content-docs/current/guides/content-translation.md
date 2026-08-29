---
sidebar_position: 5
title: "Inhoudsvertaling"
---

# Inhoudsvertaling (Hugo Markdown)

Champollion vertaalt Hugo Markdown-bestanden — zowel front matter-velden als bodytekst — met volledige bescherming van codeblokken, shortcodes en gestructureerde elementen.

## Instelling

Stel `contentDir` in uw configuratie in om Markdown-inhoudsvertaling in te schakelen:

```json title="champollion.config.json"
{
  "version": 3,
  "inputLocale": "en",
  "localesDir": "./i18n",
  "contentDir": "./content"
}
```

```bash
npx champollion sync    # translates both string files and content files
```

## Wat er vertaald wordt

### Front Matter

Zowel YAML- (`---`) als TOML- (`+++`) scheidingstekens worden ondersteund. Standaard worden de volgende velden vertaald:

- `title`
- `description`
- `summary`
- `subtitle`
- `caption`
- `linkTitle`

Alle overige velden (`date`, `draft`, `tags`, `weight`, `slug`, enz.) worden ongewijzigd bewaard. Pas dit aan met `translatableFields` in uw configuratie.

### Bodytekst

De volledige Markdown-bodytekst wordt vertaald met blokbeveiliging — gestructureerde elementen worden afgeschermd met behulp van Unicode-schildwachtplaceholders vóór de vertaling en daarna hersteld.

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

## Bestandsnaamconventie

Volgt het vertaalpatroon op basis van bestandsnaam van Hugo:

```
my-post.md      → my-post.fr.md
my-post.en.md   → my-post.fr.md  (strips source suffix)
```

## Overgeslagen bestanden

Bestaande vertaalde bestanden worden **nooit overschreven**. Als `my-post.fr.md` al bestaat, wordt het overgeslagen. Verwijder het doelbestand om een hervertaling te forceren.

## Uitsluitend Markdown-methoden

:::warning[Google Translate en Markdown]
Google Translate heeft **geen bewustzijn** van codeblokken, shortcodes of interpolatievariabelen. Het zal gestructureerde Markdown-inhoud beschadigen. Gebruik LLM-methoden (`llm` of `llm-coached`) voor het vertalen van inhoud — deze beschermen gestructureerde elementen expliciet.
:::

Wanneer inhoudsvertaling terugvalt van Google Translate naar een LLM-methode, registreert champollion een waarschuwing met uitleg over de reden.
