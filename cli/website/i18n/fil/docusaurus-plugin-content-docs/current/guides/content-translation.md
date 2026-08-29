---
sidebar_position: 5
title: "Pagsasalin ng Nilalaman"
---

# Pagsasalin ng Nilalaman (Hugo Markdown)

Isinasalin ng Champollion ang mga Hugo Markdown file — kapwa ang mga field ng front matter at nilalaman ng body — na may ganap na proteksiyon para sa mga code block, shortcode, at structured element.

## Setup

Itakda ang `contentDir` sa inyong config upang paganahin ang pagsasalin ng nilalamang Markdown:

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

## Ano ang Isinasalin

### Front Matter

Sinusuportahan ang parehong YAML (`---`) at TOML (`+++`) delimiter. Bilang default, isinasalin ang mga field na ito:

- `title`
- `description`
- `summary`
- `subtitle`
- `caption`
- `linkTitle`

Ang lahat ng iba pang field (`date`, `draft`, `tags`, `weight`, `slug`, atbp.) ay pinananatiling hindi binabago. I-customize gamit ang `translatableFields` sa inyong config.

### Nilalaman ng Body

Isinasalin ang buong Markdown body na may proteksiyon sa block — pinoprotektahan ang mga structured element gamit ang mga Unicode sentinel placeholder bago ang pagsasalin at ibinabalik pagkatapos.

## Proteksiyon sa Block

Dumaraan sa pagsasalin ang mga elementong ito nang hindi ginagalaw:

| Element | Halimbawa | Proteksiyon |
|---------|---------|-----------|
| Mga code block | ``````` ```js ... ``` ``````` | Protektado ang buong block |
| Inline code | `` `variable` `` | Protektado |
| Mga Hugo shortcode | `{{< figure >}}`, `{{% note %}}` | Protektado ang buong block |
| Raw HTML | `<div>`, `<table>` | Protektado |
| Mga link (URL) | `[text](https://...)` | Pinananatili ang URL, isinasalin ang text |
| Interpolation | `{{ .Count }}` | Protektado |

## Kombensiyon sa Filename

Sinusunod ang pattern ng Hugo na translation-by-filename:

```
my-post.md      → my-post.fr.md
my-post.en.md   → my-post.fr.md  (strips source suffix)
```

## Gawi Kapag Nilalaktawan

Ang mga umiiral nang isinaling file ay **hindi kailanman pinapalitan**. Kung mayroon na ang `my-post.fr.md`, nilalaktawan ito. Burahin ang target file upang piliting isaling muli.

## Mga Paraang Markdown-Only

:::warning[Google Translate at Markdown]
Ang Google Translate ay **walang kamalayan** sa mga code block, shortcode, o interpolation variable. Masisira nito ang structured Markdown content. Gumamit ng mga paraang LLM (`llm` o `llm-coached`) para sa pagsasalin ng content — tahasan nilang pinoprotektahan ang mga structured element.
:::

Kapag nag-fallback ang pagsasalin ng nilalaman mula sa Google Translate patungo sa isang LLM method, nagla-log ang champollion ng babalang nagpapaliwanag kung bakit.
