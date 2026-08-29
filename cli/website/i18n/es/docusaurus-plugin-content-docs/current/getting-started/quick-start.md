---
sidebar_position: 2
title: "Inicio Rápido"
related:
  - label: "Installation"
    to: /docs/getting-started/installation
    kind: guide
  - label: "Configuration"
    to: /docs/getting-started/configuration
    kind: reference
    note: "Every config field, explained"
  - label: "Cookbook: Translate 30 Languages"
    to: /docs/tutorials/translate-30-languages
    kind: cookbook
    note: "Scale from three locales to thirty"
  - label: "Troubleshooting"
    to: /docs/guides/troubleshooting
    kind: guide
---

# Inicio Rápido

Traduzca su primer archivo de locale en 60 segundos.

## 1. Configure Sus Archivos de Locale

Cree un archivo de localización de origen. Champollion admite JSON, TOML, YAML y más — consulte la [referencia de la CLI](/docs/reference/cli) para ver la lista completa:

```json title="locales/en.json"
{
  "hero": {
    "title": "Welcome to our platform",
    "subtitle": "Build something amazing"
  },
  "nav": {
    "home": "Home",
    "about": "About",
    "contact": "Contact"
  }
}
```

## 2. Establezca Su Clave de API

Elija un proveedor y establezca la clave:

```bash
# Option A: OpenRouter (200+ models, recommended)
export OPENROUTER_API_KEY=sk-or-v1-...

# Option B: Gemini (free tier — zero cost to start)
export GEMINI_API_KEY=AI...
```

Obtenga una clave Gemini gratuita en [aistudio.google.com/apikey](https://aistudio.google.com/apikey). Obtenga una clave OpenRouter en [openrouter.ai](https://openrouter.ai).

## 3. Ejecute Sync

```bash
npx champollion sync
```

:::tip[¿Usando Gemini?]
Si eligió la Opción B (Gemini), agregue `--method gemini`:
```bash
npx champollion sync --method gemini
```
:::

Champollion hará lo siguiente:
1. Detectar automáticamente `locales/en.json` como el origen
2. Encontrar (o solicitar) idiomas de destino
3. Traducir todas las claves
4. Escribir `locales/fr.json`, `locales/ja.json`, etc.
5. Crear `.champollion.lock` para rastrear lo que se ha traducido

## 4. Verifique los Resultados

```bash
cat locales/fr.json
```

```json
{
  "hero": {
    "title": "Bienvenue sur notre plateforme",
    "subtitle": "Construisez quelque chose d'incroyable"
  },
  "nav": {
    "home": "Accueil",
    "about": "À propos",
    "contact": "Contact"
  }
}
```

## ¿Qué Sucede Después?

Cuando cambia una cadena de origen, champollion detecta el cambio mediante el rastreo de hash SHA-256 y retraduce solo esa clave en la siguiente sincronización:

```json title="locales/en.json (updated)"
{
  "hero": {
    "title": "Welcome to Acme Platform",  // ← changed
    "subtitle": "Build something amazing"  // ← unchanged, skipped
  }
}
```

```bash
npx champollion sync
# Only "hero.title" is re-translated across all locales
```

La clave sin cambios (`hero.subtitle`) se sirve desde la caché de **Translation Memory** de champollion — sin llamada a API, sin costo. La caché se construye automáticamente durante cada sincronización y se almacena en `.champollion/tm.json`.

## Opcional: Cree un Archivo de Configuración

Para mayor control, genere un archivo de configuración:

```bash
npx champollion init                         # guided wizard
npx champollion init --yes --langs fr,de,ja  # quick setup with specific targets
```

El asistente guiado lo acompaña a través de los **presets de registro** de cada idioma — instrucciones de tono y formalidad preconfiguradas ajustadas al sistema lingüístico de cada idioma. El francés tiene presets T-V (vouvoiement vs tutoiement), el coreano tiene niveles de habla (해요체 vs 합쇼체 vs 해체), el japonés tiene opciones de keigo (です/ます vs 丁寧語).

O cree una configuración manualmente con claves de preset:

```json title="champollion.config.json"
{
  "version": 3,
  "inputLocale": "en",
  "localesDir": "./locales",
  "languages": {
    "fr": "casual-tu",
    "ko": "polite-haeyo",
    "ja": "polite"
  },
  "model": "google/gemini-2.5-flash"
}
```

Ejecute `npx champollion init` para explorar los presets disponibles para cada idioma.

## Opcional: Modo Watch

Traduzca automáticamente cuando su archivo de origen cambie:

```bash
npx champollion watch
```

## Próximos pasos

- **[Configuración](/docs/getting-started/configuration)** — Referencia de configuración completa
- **[Métodos de Traducción](/docs/guides/translation-methods)** — Elija el método correcto por par
- **[Translation Memory](/docs/concepts/translation-memory)** — Cómo el almacenamiento en caché le ahorra dinero en re-ejecuciones
- **[Trabajar con Traductores Profesionales](/docs/guides/professional-translators)** — Exporte XLIFF para revisión humana
- **[Integración con Frameworks](/docs/guides/framework-integration)** — Hugo, next-intl, react-i18next
- **[CI/CD](/docs/guides/ci-cd)** — Automatice traducciones en su pipeline
- **[Solución de Problemas](/docs/guides/troubleshooting)** — Problemas comunes y soluciones
