---
sidebar_position: 5
title: "Traducción de Contenido"
---

# Traducción de contenido Markdown de Hugo

Champollion traduce archivos Markdown de Hugo — tanto campos de front matter como contenido del cuerpo — con protección completa de bloques de código, shortcodes y elementos estructurados.

## Configuración

Configure `contentDir` en su configuración para habilitar la traducción de contenido Markdown:

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

## Qué se traduce

### Front Matter

Se admiten delimitadores YAML (`---`) y TOML (`+++`). Por defecto, estos campos se traducen:

- `title`
- `description`
- `summary`
- `subtitle`
- `caption`
- `linkTitle`

Todos los demás campos (`date`, `draft`, `tags`, `weight`, `slug`, etc.) se preservan tal como están. Personalice con `translatableFields` en su configuración.

### Contenido del cuerpo

El cuerpo completo de Markdown se traduce con protección de bloques — los elementos estructurados se protegen mediante marcadores centinela Unicode antes de la traducción y se restauran después.

## Protección de bloques

Estos elementos pasan a través de la traducción sin cambios:

| Elemento | Ejemplo | Protección |
|---------|---------|-----------|
| Bloques de código | ``````` ```js ... ``` ``````` | Bloque completamente protegido |
| Código en línea | `` `variable` `` | Protegido |
| Shortcodes de Hugo | `{{< figure >}}`, `{{% note %}}` | Bloque completamente protegido |
| HTML sin procesar | `<div>`, `<table>` | Protegido |
| Enlaces (URLs) | `[text](https://...)` | URL preservada, texto traducido |
| Interpolación | `{{ .Count }}` | Protegido |

## Convención de nombres de archivo

Sigue el patrón de traducción por nombre de archivo de Hugo:

```
my-post.md      → my-post.fr.md
my-post.en.md   → my-post.fr.md  (strips source suffix)
```

## Comportamiento de omisión

Los archivos traducidos existentes **nunca se sobrescriben**. Si `my-post.fr.md` ya existe, se omite. Elimine el archivo de destino para forzar una nueva traducción.

## Métodos solo para Markdown

:::warning[Google Translate y Markdown]
Google Translate **no tiene conciencia** de bloques de código, shortcodes o variables de interpolación. Corromperá el contenido Markdown estructurado. Utilice métodos LLM (`llm` o `llm-coached`) para la traducción de contenido — protegen explícitamente los elementos estructurados.
:::

Cuando la traducción de contenido retrocede desde Google Translate a un método LLM, champollion registra una advertencia explicando por qué.
