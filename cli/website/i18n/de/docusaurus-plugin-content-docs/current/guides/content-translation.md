---
sidebar_position: 5
title: "Inhaltsübersetzung"
---

# Inhaltsübersetzung (Hugo Markdown)

Champollion übersetzt Hugo-Markdown-Dateien — sowohl Front-Matter-Felder als auch Textinhalte — mit vollständigem Schutz von Code-Blöcken, Shortcodes und strukturierten Elementen.

## Einrichtung

Setzen Sie `contentDir` in Ihrer Konfiguration, um die Übersetzung von Markdown-Inhalten zu aktivieren:

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

## Was übersetzt wird

### Front Matter

Sowohl YAML- (`---`) als auch TOML-Trennzeichen (`+++`) werden unterstützt. Standardmäßig werden diese Felder übersetzt:

- `title`
- `description`
- `summary`
- `subtitle`
- `caption`
- `linkTitle`

Alle anderen Felder (`date`, `draft`, `tags`, `weight`, `slug` usw.) werden unverändert beibehalten. Passen Sie dies mit `translatableFields` in Ihrer Konfiguration an.

### Textinhalt

Der vollständige Markdown-Text wird mit Blockschutz übersetzt — strukturierte Elemente werden vor der Übersetzung mithilfe von Unicode-Sentinel-Platzhaltern abgeschirmt und danach wiederhergestellt.

## Blockschutz

Diese Elemente werden unverändert durch die Übersetzung geleitet:

| Element | Beispiel | Schutz |
|---------|---------|-----------|
| Code-Blöcke | ``````` ```js ... ``` ``````` | Vollständiger Block abgeschirmt |
| Inline-Code | `` `variable` `` | Abgeschirmt |
| Hugo-Shortcodes | `{{< figure >}}`, `{{% note %}}` | Vollständiger Block abgeschirmt |
| Rohes HTML | `<div>`, `<table>` | Abgeschirmt |
| Links (URLs) | `[text](https://...)` | URL beibehalten, Text übersetzt |
| Interpolation | `{{ .Count }}` | Abgeschirmt |

## Dateinamenskonvention

Folgt Hugos Muster der Übersetzung anhand des Dateinamens:

```
my-post.md      → my-post.fr.md
my-post.en.md   → my-post.fr.md  (strips source suffix)
```

## Überspringen-Verhalten

Bereits übersetzte Dateien werden **niemals überschrieben**. Falls `my-post.fr.md` bereits existiert, wird die Datei übersprungen. Löschen Sie die Zieldatei, um eine erneute Übersetzung zu erzwingen.

## Methoden nur für Markdown

:::warning[Google Translate und Markdown]
Google Translate hat **kein Verständnis** für Codeblöcke, Shortcodes oder Interpolationsvariablen. Es beschädigt strukturierte Markdown-Inhalte. Verwenden Sie LLM-Methoden (`llm` oder `llm-coached`) für die Inhaltsübersetzung — diese schützen strukturierte Elemente explizit.
:::

Wenn die Inhaltsübersetzung von Google Translate auf eine LLM-Methode zurückfällt, protokolliert champollion eine Warnung mit einer Erklärung der Ursache.
