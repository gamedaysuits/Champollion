---
sidebar_position: 2
title: "Inicio rápido"
related:
  - label: "Installation"
    to: /docs/getting-started/installation
    kind: guide
  - label: "Configuration"
    to: /docs/getting-started/configuration
    kind: reference
    note: "Every config field, explained"
  - label: "Troubleshooting"
    to: /docs/guides/troubleshooting
    kind: guide
---

# Inicio rápido

Traduzca su primer archivo de idioma en 60 segundos.

La CLI es gratuita para uso no comercial bajo la
[PolyForm Noncommercial License 1.0.0](https://github.com/gamedaysuits/Champollion/blob/main/cli/LICENSE); el uso comercial no está cubierto
por esa licencia. Una escuela, un hospital o clínica pública, una organización benéfica o un proyecto personal están cubiertos; la tienda de un negocio
no lo está. [Quién puede usar esto](/docs/getting-started/who-may-use-this) lo explica en detalle.

## 1. Prepare sus archivos de idioma

Cree un archivo de idioma de origen. Champollion admite JSON, TOML, YAML y más; consulte la [referencia de la CLI](/docs/reference/cli) para ver la lista completa:

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

## 2. Configure su clave de API

Elija un proveedor y configure la clave:

```bash
# Option A: OpenRouter (200+ models, recommended)
export OPENROUTER_API_KEY=sk-or-v1-...

# Option B: Gemini (free tier — zero cost to start)
export GEMINI_API_KEY=AI...

# Option C: a model on your own machine (Ollama, LM Studio, vLLM) — no key
#   nothing to export if it listens on Ollama's default http://localhost:11434/v1
#   another server: export LOCAL_API_BASE=http://localhost:8000/v1 (its address; or put that line in .env.local or .env)
```

Obtenga una clave gratuita de Gemini en [aistudio.google.com/apikey](https://aistudio.google.com/apikey). Obtenga una clave de OpenRouter en [openrouter.ai](https://openrouter.ai). Para la opción C, indique el nombre de su modelo al configurar el proyecto: `npx champollion init --yes --langs fr,de --method local --model llama3.1` (o ejecute `sync --method local --model llama3.1`).

## 3. Ejecute la sincronización

```bash
npx champollion sync
```

:::note[¿Escrito por usted o ejecutado mediante un script?]
Los comandos de esta página son de los que usted escribe: `npx champollion` ejecuta la copia que instaló su proyecto, o bien la que obtiene npx (la versión más reciente la primera vez, y luego esa copia en caché). Un comando que un script ejecute por usted —como en CI, un script de `package.json` o un hook de git— debe especificar su versión, `npx --yes champollion@0.6 sync`, para que una nueva versión nunca altere lo que ejecuta la compilación (y `--yes` evita que npx se detenga a preguntar). La [guía de CI](/docs/guides/ci-cd) y las [páginas de frameworks](/docs/integrations/frameworks) lo fijan de esa manera.
:::

:::tip[¿Usa Gemini?]
Si eligió la Opción B (Gemini), agregue `--method gemini`:
```bash
npx champollion sync --method gemini
```
:::

Champollion hará lo siguiente:
1. Detectará automáticamente `locales/en.json` como el origen
2. Encontrará (o le pedirá) los idiomas de destino
3. Traducirá todas las claves
4. Escribirá `locales/fr.json`, `locales/ja.json`, etc.
5. Creará `.champollion.lock` para registrar lo que ya se tradujo

## 4. Revise los resultados

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

## ¿Qué sucede después?

Cuando usted modifica una cadena de origen, Champollion detecta el cambio mediante el seguimiento de hashes SHA-256 y vuelve a traducir solo esa clave en la siguiente sincronización:

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

La clave que no cambió (`hero.subtitle`) se **omite**: su traducción ya está en `locales/fr.json`, por lo que no se envía a ningún lado ni se consulta: no hay llamadas, no hay costo y no se contabiliza en la cifra de "servido desde la caché" de la ejecución.

La **Memoria de traducción** (`.champollion/tm.json`, creada automáticamente durante cada sincronización) es para el texto que *sí* está en cola: una cadena que vuelve a dejar como estaba, la misma oración en otro archivo o rehacer un idioma por completo (`sync --redo all`). Esas se entregan desde la caché sin costo, y la línea de la ejecución indica cuántas fueron (`… 0 key(s) sent to the model, 12 served from the cache (free)`). La caché se mantiene por método, registro y coaching: para el par y para su fallback individualmente. Tras cambiar de método (por ejemplo, `local` → `llm`) o modificar el texto de un archivo de coaching (en el par, en su idioma o en su fallback), nada se reutiliza y la ejecución explica por qué; un cambio de modelo por sí solo sí reutiliza las traducciones anteriores. Un cambio no vuelve a traducir nada por sí solo: `sync` especifica lo que se va a rehacer y su precio.

## Opcional: Cree un archivo de configuración

Para tener mayor control, genere un archivo de configuración:

```bash
npx champollion init                         # guided wizard
npx champollion init --yes --langs fr,de,ja  # quick setup with specific targets
npx champollion init --yes --langs fr,de --method local --model llama3.1   # a model on this machine
```

`--method` y `--model` eligen el método de traducción y el modelo (`npx champollion init --help` enumera los métodos); init muestra cuáles utiliza la configuración.

El asistente guiado le orienta a través de los **preajustes de registro** de cada idioma: instrucciones predefinidas de tono y formalidad adaptadas a su sistema lingüístico. El francés cuenta con preajustes T-V (vouvoiement frente a tutoiement), el coreano tiene niveles de habla (해요체 frente a 합쇼체 frente a 해체) y el japonés ofrece opciones de keigo (です/ます frente a 丁寧語).

O cree una configuración manualmente con claves de preajustes:

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

Ejecute `npx champollion init` para explorar los preajustes disponibles para cada idioma.

## Opcional: Modo de observación

Traduzca automáticamente cuando su archivo de origen cambie:

```bash
npx champollion watch
```

## Próximos pasos

- **[Configuración](/docs/getting-started/configuration)** — Referencia completa de configuración
- **[Métodos de traducción](/docs/guides/translation-methods)** — Elija el método adecuado para cada par
- **[Memoria de traducción](/docs/concepts/translation-memory)** — Cómo el almacenamiento en caché le ahorra dinero en las reejecuciones
- **[Trabajo con traductores profesionales](/docs/guides/professional-translators)** — Exporte XLIFF para revisión humana
- **[Integración con frameworks](/docs/integrations/frameworks)** — Hugo, next-intl, react-i18next
- **[CI/CD](/docs/guides/ci-cd)** — Automatice las traducciones en su pipeline
- **[Resolución de problemas](/docs/guides/troubleshooting)** — Problemas comunes y soluciones
