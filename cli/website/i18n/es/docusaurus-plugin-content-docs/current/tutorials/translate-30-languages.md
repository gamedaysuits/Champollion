---
sidebar_position: 2
title: "Traducir 30 idiomas"
description: "Cookbook: escala un proyecto de 3 idiomas a 30 usando mezcla de métodos por pares, agrupamiento e integración con CI."
related:
  - label: "Writing-style & register metrics"
    to: /docs/network/specifications/harness#writing-style-and-register-metrics-informational
    kind: arena
    note: "Measure register adherence with the eval harness"
  - label: "Register"
    to: /glossary#term-register
    kind: glossary
    note: "What a register is, in plain language"
  - label: "Translation Methods"
    to: /docs/guides/translation-methods
    kind: guide
    note: "When to mix LLM, Google Translate, and coached pairs"
  - label: "Quality Gate"
    to: /docs/concepts/quality-gate
    kind: concept
    note: "How every translation is validated before it lands"
  - label: "CI/CD"
    to: /docs/guides/ci-cd
    kind: guide
    note: "Keep 30 locales current on every push"
---

# Libro de recetas: Traducir 30 idiomas

Escale un proyecto de un puñado de configuraciones regionales a cobertura global. Este libro de recetas lo guía a través de la selección de métodos, optimización de costos e integración de CI para una implementación multilingüe real.

**Escenario:** Tiene una aplicación SaaS con `en`, `fr`, `es`. Necesita agregar 27 idiomas más en tres niveles de requisitos de calidad.

---

## Paso 1: Categorizar sus idiomas

No todos los 30 idiomas necesitan el mismo enfoque. Agrúpelos por calidad de método disponible:

| Nivel | Idiomas | Método | Por qué |
|------|-----------|--------|-----|
| **Nivel 1 — Premium** | `ja`, `ko`, `zh`, `de`, `pt` | `llm` (GPT-4o) | Mercados de alto valor, gramática matizada |
| **Nivel 2 — Estándar** | `it`, `nl`, `pl`, `sv`, `da`, `fi`, `no`, `cs`, `ro`, `hu`, `el`, `tr`, `id`, `ms`, `th`, `vi`, `uk`, `bg` | `google-translate` | Alto volumen, bien soportado por Google |
| **Nivel 3 — Entrenado** | `crk`, `oj`, `mi`, `haw` | `llm-coached` + plugins | Bajo recursos, requieren aplicación de terminología |

## Paso 2: Configurar por par

```json title="champollion.config.json"
{
  "version": 3,
  "inputLocale": "en",
  "localesDir": "./locales",
  "defaultMethod": "google-translate",
  "model": "google/gemini-3.5-flash",
  "languages": {
    "ja": { "name": "Japanese", "register": "Polite/formal" },
    "ko": { "name": "Korean", "register": "Formal" },
    "zh": { "name": "Simplified Chinese", "register": "Neutral" },
    "de": { "name": "German", "register": "Formal (Sie)" },
    "pt": { "name": "Brazilian Portuguese", "register": "Informal" },
    "crk": { "name": "Plains Cree (SRO)", "register": "Neutral" }
  },
  "pairs": {
    "en:ja": { "method": "llm", "model": "openai/gpt-4o" },
    "en:ko": { "method": "llm", "model": "openai/gpt-4o" },
    "en:zh": { "method": "llm", "model": "openai/gpt-4o" },
    "en:de": { "method": "llm", "model": "openai/gpt-4o" },
    "en:pt": { "method": "llm", "model": "openai/gpt-4o" },
    "en:crk": { "methodPlugin": "crk-coached-v1" }
  }
}
```

**Nota:** Los idiomas no listados en `pairs` heredan `defaultMethod: "google-translate"`. No necesita listar los 30.

:::info
El soporte para `crk` está en desarrollo — consulte [Soportar un idioma de bajo recursos](/docs/network/community/low-resource-languages) para el estado y directrices de contribución.
:::

## Paso 3: Configurar claves de API

Necesitará ambas claves de API para esta configuración:

```bash
export OPENROUTER_API_KEY="sk-or-v1-..."
export GOOGLE_TRANSLATE_API_KEY="AIza..."
```

## Paso 4: Hacer una ejecución de prueba primero

Siempre obtenga una vista previa antes de traducir 30 idiomas:

```bash
npx champollion sync --dry
```

Revise el resultado. Mostrará:
- Qué pares usan qué método
- Cuántas claves son nuevas/cambiadas por configuración regional
- Llamadas de API estimadas por nivel

## Paso 5: Ejecutar la sincronización

```bash
npx champollion sync
```

Champollion procesa cada par de forma independiente. Los pares de Nivel 2 que usan Google Translate serán rápidos. Los pares de LLM de Nivel 1 serán más lentos pero de mayor calidad. Los pares entrenados de Nivel 3 usan los datos de entrenamiento del plugin.

### Actualizaciones incrementales

Después de la sincronización inicial, las ejecuciones posteriores solo traducen claves **cambiadas o nuevas**:

```bash
# Only keys that changed since last sync
npx champollion sync
```

El archivo de bloqueo (`.champollion.lock`) rastrea lo que se ha traducido, por lo que nunca retraduce contenido estable.

## Paso 6: Auditar la calidad

Verifique el estado de todos los pares de idiomas:

```bash
npx champollion status
```

Esto genera una tabla que muestra el método, modelo, nivel de calidad de cada par, y si hay datos de entrenamiento o puntuaciones de referencia disponibles.

### ¿El resultado respetó sus registros?

En el Paso 2 declaró un [registro](/glossary#term-register) por idioma — `"Polite/formal"` para japonés, `"Formal (Sie)"` para alemán. (¿Nuevo en el término? El glosario lo explica en lenguaje simple.) Esas instrucciones van en el indicador de traducción, pero un indicador es una solicitud, no una garantía.

El [arnés de red](/docs/network/specifications/harness) — la misma herramienta que impulsa la tabla de clasificación pública — puede medir la adherencia de registro y estilo en una muestra de sus traducciones. Sus métricas de estilo de escritura verifican cada resultado contra el registro esperado (marcadores formales/informales, pronombres T–V, contracciones, desviación de longitud de oración) e informan un `style_consistency_rate` en toda la ejecución. También puede señalarlo a un perfil de voz de marca personalizado con `--style-profile`.

```bash
# install the harness, then run your sample corpus through it
pipx install mt-eval-harness
mt-eval run --corpus my-sample.json --style-profile brand-voice.json
```

Dos advertencias honestas: estas métricas son **informativas** (nunca entran en la puntuación compuesta de la tabla de clasificación), y la detección de formalidad se basa en marcadores — un detector de desviación, no un juicio humano. Detalles y definiciones de métricas: [Métricas de estilo de escritura y registro](/docs/network/specifications/harness#writing-style-and-register-metrics-informational).

## Paso 7: Integración de CI

Agregue a su flujo de trabajo de GitHub Actions para que las traducciones se mantengan actuales en cada inserción:

```yaml title=".github/workflows/i18n-sync.yml"
name: Sync Translations
on:
  push:
    paths:
      - 'locales/en/**'

jobs:
  translate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - run: npm ci

      - name: Sync translations
        run: npx champollion sync
        env:
          OPENROUTER_API_KEY: ${{ secrets.OPENROUTER_API_KEY }}
          GOOGLE_TRANSLATE_API_KEY: ${{ secrets.GOOGLE_TRANSLATE_API_KEY }}

      - name: Commit updated translations
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add locales/
          git diff --staged --quiet || git commit -m "chore(i18n): sync translations"
          git push
```

## Estimación de costos

Para un proyecto con 500 claves de origen en 30 idiomas:

| Nivel | Idiomas | Método | Costo aproximado |
|------|-----------|--------|-----------------|
| Nivel 1 (5 idiomas) | ja, ko, zh, de, pt | GPT-4o | ~$2.50/sincronización completa |
| Nivel 2 (18 idiomas) | it, nl, pl, etc. | Google Translate | ~$0.90/sincronización completa |
| Nivel 3 (4 idiomas) | crk, oj, mi, haw | GPT-4o-mini entrenado | ~$0.40/sincronización completa |
| **Total** | **30 idiomas** | **Mixto** | **~$3.80/sincronización completa** |

Las sincronizaciones incrementales (5–20 claves cambiadas) cuestan una fracción de una sincronización completa.

## Consulte también

- [Métodos de traducción](/docs/guides/translation-methods) — Cómo funciona cada método de traducción y cuándo usarlo
- [Especificación de plugin](/docs/reference/plugin-spec) — Crear datos de entrenamiento para cualquiera de sus idiomas de Nivel 3
- [Guía de CI/CD](/docs/guides/ci-cd) — Patrones avanzados de CI incluyendo compilaciones de vista previa de PR
- [Puerta de calidad](/docs/concepts/quality-gate) — Cómo Champollion valida cada traducción antes de escribirla
- [Idiomas soportados](/docs/reference/supported-languages) — Lista completa de códigos de idioma y compatibilidad de métodos
- [Métricas de estilo de escritura y registro](/docs/network/specifications/harness#writing-style-and-register-metrics-informational) — Medir la adherencia de registro/estilo con el arnés de evaluación (métricas informativas)
- [Glosario: registro](/glossary#term-register) — Qué significa "registro", en lenguaje simple
- [Soportar un idioma de bajo recursos](/docs/network/community/low-resource-languages) — Agregar datos de entrenamiento para idiomas sin cobertura amplia de MT
