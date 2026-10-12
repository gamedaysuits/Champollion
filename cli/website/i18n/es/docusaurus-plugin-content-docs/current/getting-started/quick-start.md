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

El CLI es gratuito para uso no comercial bajo la
[Licencia No Comercial PolyForm 1.0.0](https://github.com/gamedaysuits/Champollion/blob/main/cli/LICENSE); el uso comercial no está cubierto
por esa licencia. Una escuela, un hospital o clínica pública, una organización benéfica o un proyecto personal están cubiertos; la tienda
de un negocio no lo está. [Quién puede usar esto](/docs/getting-started/who-may-use-this) lo explica en su totalidad.

## 1. Configure Sus Archivos de Locale

Cree un archivo de idioma de origen. Champollion admite JSON, TOML, YAML y más; consulte la [referencia del CLI](/docs/reference/cli) para ver la lista completa:

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

# Option C: a model on your own machine (Ollama, LM Studio, vLLM) — no key
#   nothing to export if it listens on Ollama's default http://localhost:11434/v1
#   another server: export LOCAL_API_BASE=http://localhost:8000/v1 (its address; or put that line in .env.local or .env)
```

Obtenga una clave gratuita de Gemini en [aistudio.google.com/apikey](https://aistudio.google.com/apikey). Obtenga una clave de OpenRouter en [openrouter.ai](https://openrouter.ai). Para la opción C, especifique su modelo al configurar el proyecto: `npx champollion init --yes --langs fr,de --method local --model llama3.1` (o ejecute `sync --method local --model llama3.1`).

## 3. Ejecute Sync

```bash
npx champollion sync
```

:::note[¿Escrito por usted o ejecutado por un script?]
Los comandos de esta página son los que usted escribe: `npx champollion` ejecuta la copia que instaló su proyecto, o bien la que npx descarga —la versión más reciente la primera vez, y luego esa copia en caché—. Un comando que un script ejecuta por usted —CI, un script de `package.json`, un hook de git— debería especificar su versión, `npx --yes champollion@0.5 sync`, para que una nueva versión nunca cambie lo que ejecuta la compilación (y `--yes` evita que npx se detenga a preguntar). La [guía de CI](/docs/guides/ci-cd) y las [páginas de frameworks](/docs/integrations/frameworks) lo fijan de esa manera.
:::

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

La clave sin cambios (`hero.subtitle`) se **omite**: su traducción ya está en `locales/fr.json`, por lo que no se envía a ninguna parte y ni siquiera se busca: sin llamadas, sin costo y sin contabilizarse en la cifra de "servido desde la caché" de la ejecución.

La **Memoria de traducción** (`.champollion/tm.json`, generada automáticamente durante cada sincronización) sirve para el texto que *sí* está en cola: una cadena que vuelve a cambiar a su valor anterior, la misma oración en otro archivo o una retraducción completa del locale (`sync --redo all`). Estos se sirven desde la caché sin costo, y la línea de la ejecución indica cuántos (`… 0 key(s) sent to the model, 12 served from the cache (free)`). La caché se mantiene por método, registro y coaching — individualmente para cada par y para su fallback. Después de cambiar de método (por ejemplo, `local` → `llm`) o de modificar el texto de un archivo de coaching (en el par, en su idioma o en su fallback), nada se reutiliza y la ejecución explica por qué; cambiar únicamente de modelo sí reutiliza las traducciones anteriores. Un cambio no vuelve a traducir nada por sí solo: `sync` especifica la retraducción y su costo.

## Opcional: Cree un Archivo de Configuración

Para mayor control, genere un archivo de configuración:

```bash
npx champollion init                         # guided wizard
npx champollion init --yes --langs fr,de,ja  # quick setup with specific targets
npx champollion init --yes --langs fr,de --method local --model llama3.1   # a model on this machine
```

`--method` y `--model` eligen el método de traducción y el modelo (`npx champollion init --help` enumera los métodos); init muestra cuáles utiliza la configuración.

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
  "model": "google/gemini-3.8-flash"
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
