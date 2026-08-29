---
sidebar_position: 3
title: "Sitio Multilingüe Hugo"
description: "Receta: configurar un sitio Hugo multilingüe completo con champollion manejando tanto la traducción de archivos de cadenas como contenido Markdown."
related:
  - label: "Content Translation"
    to: /docs/guides/content-translation
    kind: guide
    note: "Markdown and long-form content, not just strings"
  - label: "Framework Integration"
    to: /docs/guides/framework-integration
    kind: guide
  - label: "CI/CD"
    to: /docs/guides/ci-cd
    kind: guide
  - label: "Cookbook: Translate 30 Languages"
    to: /docs/tutorials/translate-30-languages
    kind: cookbook
    note: "Scale the same setup to thirty locales"
---

# Libro de recetas: Sitio multilingüe con Hugo

Configure el sistema multilingüe de Hugo con champollion manejando tanto archivos de cadenas JSON como traducción de contenido Markdown. Esto cubre el flujo de trabajo completo desde la configuración del proyecto hasta el despliegue en producción.

**Lo que construirá:** Un sitio Hugo con inglés, francés y japonés — traducciones de cadenas mediante archivos de configuración regional, traducciones de contenido mediante procesamiento Markdown.

---

## Estructura del Proyecto

Champollion utiliza el modo de traducción **basado en nombres de archivo** de Hugo. Los archivos traducidos se colocan en el mismo directorio que el archivo de origen, con un sufijo de idioma agregado al nombre del archivo (p. ej. `about.fr.md`):

```
my-hugo-site/
├── content/
│   └── en/
│       ├── _index.md
│       ├── _index.fr.md           ← champollion generates
│       ├── _index.ja.md           ← champollion generates
│       ├── about.md
│       ├── about.fr.md            ← champollion generates
│       ├── about.ja.md            ← champollion generates
│       └── blog/
│           ├── first-post.md
│           ├── first-post.fr.md   ← champollion generates
│           └── first-post.ja.md   ← champollion generates
├── i18n/
│   ├── en.json
│   ├── fr.json                    ← champollion generates
│   └── ja.json                    ← champollion generates
└── hugo.toml
```

:::note[Modos i18n de Hugo]
Hugo admite dos estrategias de traducción: **basada en nombres de archivo** (`about.fr.md` junto a `about.md`) y **basada en directorios** (árboles `content/fr/about.md` separados). Champollion utiliza traducción basada en nombres de archivo porque su función `getTargetContentPath()` genera rutas de destino añadiendo un sufijo de idioma al nombre de archivo de origen. Asegúrese de que su `hugo.toml` esté configurado para traducción basada en nombres de archivo cuando utilice champollion.
:::

## Paso 1: Configurar Hugo

```toml title="hugo.toml"
defaultContentLanguage = 'en'

[languages]
  [languages.en]
    languageName = 'English'
    weight = 1
  [languages.fr]
    languageName = 'Français'
    weight = 2
  [languages.ja]
    languageName = '日本語'
    weight = 3
```

## Paso 2: Configurar Champollion

Champollion necesita dos cosas configuradas: la ruta del archivo de configuración regional (para cadenas JSON) y el directorio de contenido (para Markdown).

```json title="champollion.config.json"
{
  "version": 3,
  "inputLocale": "en",
  "localesDir": "./i18n",
  "contentDir": "./content",
  "model": "google/gemini-3.5-flash",
  "pairs": {
    "en:fr": { "method": "llm" },
    "en:ja": { "method": "llm", "model": "openai/gpt-4o" }
  },
  "languages": {
    "fr": { "name": "French", "register": "Formal (vous-form)" },
    "ja": { "name": "Japanese", "register": "Polite/formal" }
  }
}
```

## Paso 3: Crear Contenido de Origen

### Traducciones de Cadenas (i18n/)

```json title="i18n/en.json"
{
  "nav": {
    "home": "Home",
    "about": "About",
    "blog": "Blog",
    "contact": "Contact"
  },
  "footer": {
    "copyright": "© 2026 My Company. All rights reserved.",
    "privacy": "Privacy Policy"
  }
}
```

### Contenido Markdown (content/en/)

```markdown title="content/en/about.md"
---
title: "About Us"
description: "Learn more about our team and mission"
date: 2026-01-15
---

We build software that helps businesses communicate across languages.

Our platform supports **real-time translation** for over 30 languages,
with specialized support for low-resource languages.

## Our Mission

Language should never be a barrier to understanding.

## The Team

{{< team-grid >}}
```

## Paso 4: Ejecutar la Sincronización

```bash
npx champollion sync
```

Champollion procesa ambos tipos:

1. **Archivos de cadenas** (`i18n/en.json` → `i18n/fr.json`, `i18n/ja.json`)
2. **Archivos de contenido** (`content/en/about.md` → `content/en/about.fr.md`, `content/en/about.ja.md`)

### Detalles de Traducción de Contenido

Al traducir Markdown, champollion automáticamente:

- **Protege** bloques de código, shortcodes (`{{< ... >}}`), código en línea e HTML
- **Traduce** campos del front matter (`title`, `description`, `summary`)
- **Preserva** todos los demás campos del front matter (`date`, `draft`, `weight`, `tags`)
- **Restaura** bloques protegidos después de la traducción

El shortcode de Hugo `{{< team-grid >}}` se pasa sin traducir.

## Paso 5: Verificar

```bash
# Preview the site
hugo server

# Check translation status
npx champollion status
```

Navegue a `localhost:1313/fr/` y `localhost:1313/ja/` para revisar el contenido traducido.

## Paso 6: Selector de Idioma de Hugo

Agregue un selector de idioma a su diseño de Hugo:

```html title="layouts/partials/language-switcher.html"
<nav class="language-switcher">
  {{ range $.Site.Home.AllTranslations }}
    <a href="{{ .Permalink }}"
       {{ if eq .Lang $.Site.Language.Lang }}class="active"{{ end }}>
      {{ .Language.LanguageName }}
    </a>
  {{ end }}
</nav>
```

## Mantener el Contenido Sincronizado

Cuando actualice contenido en inglés, ejecute la sincronización nuevamente. Champollion solo retraduce archivos que han cambiado:

```bash
# Edit content/en/about.md, then:
npx champollion sync
```

El archivo de bloqueo rastrea hashes de contenido por archivo, por lo que las páginas estables no se retraduce.

## Véase También

- **[Guía de Traducción de Contenido](/docs/guides/content-translation)** — Análisis profundo de protección, front matter y casos especiales
- **[Integración de Marcos](/docs/guides/framework-integration)** — Configuraciones de Next.js y React
- **[Guía de CI/CD](/docs/guides/ci-cd)** — Automatice sincronizaciones en push a `content/en/`
- **[Métodos de Traducción](/docs/guides/translation-methods)** — Compare estrategias de traducción LLM, TM e híbridas
- **[Idiomas Admitidos](/docs/reference/supported-languages)** — Lista completa de configuraciones regionales y códigos de idioma admitidos
