---
sidebar_position: 7
title: "Para Empresas"
description: "Cómo las organizaciones pueden estandarizar la traducción con métodos probados en el panel de control, plugins personalizados e implementación con un solo comando."
---

# champollion para Empresas

Su equipo traduce contenido regularmente. Tiene un conjunto de archivos de configuración regional, una canalización de CI, y un proceso que probablemente implica que alguien ejecute manualmente Google Translate, copie los resultados en JSON y espere lo mejor. O está pagando por una plataforma TMS donde está bloqueado con el motor de traducción de un único proveedor.

champollion le ofrece una opción más tranquila: elija el método correcto para cada idioma — máquina o humano — y ejecute todos a través de un único comando.

## Por qué los equipos usan champollion

1. **Elija el método correcto para cada idioma** — máquina o humano, no lo que su proveedor establece por defecto
2. **Implemente con un comando** — `npx champollion sync` traduce cada configuración regional, cada formato, cada vez
3. **Cambie de método sin cambiar código** — un cambio de configuración, no una migración
4. **Sea dueño de su canalización** — sin bloqueo de proveedor, sin paneles mensuales, sin cuentas

```json title="champollion.config.json"
{
  "version": 3,
  "pairs": {
    "en:fr": { "method": "deepl" },
    "en:ja": { "method": "llm", "model": "google/gemini-2.5-pro" },
    "en:de": { "method": "google-translate" },
    "en:ko": { "method": "llm", "register": "polite-haeyo" },
    "en:es": { "method": "api", "endpoint": "https://review.your-lsp.example/mtpe" },
    "en:crk": { "methodPlugin": "crk-coached-v3" }
  }
}
```

El francés obtiene DeepL (su equipo prefiere su fluidez europea). El japonés obtiene un LLM de frontera. El alemán obtiene Google Translate (rápido, económico, suficientemente bueno). El coreano se enruta a un LLM con registro formal. El español se enruta a un servicio profesional humano / MTPE a través del método `api` — la traducción humana es un método de primera clase aquí, no un complemento. El Plains Cree obtiene un complemento construido y propiedad de la comunidad.

**Mismo comando. Misma canalización de CI. Diferentes métodos por par — humano o máquina. Un archivo de configuración.**

:::note[Los métodos de lenguas comunitarias son soberanos]
El plugin de Plains Cree anterior no es solo "otro método". Los métodos para lenguas indígenas y otras lenguas comunitarias son **propiedad y gobernanza comunitaria**: la comunidad posee las claves de los datos detrás de ellos, establece los términos de uso, y cualquier corpus o método no comercial (NC) se separa de las rutas comerciales por defecto. Si su uso es comercial, verifique la licencia del método antes de implementar. Consulte [Data Sovereignty](/docs/network/sovereignty/data-sovereignty).
:::

## Flujo de Trabajo Leaderboard → Implementación

:::tip[`champollion leaderboard` viene incluido con la CLI]
El flujo de trabajo a continuación se ejecuta con el comando `champollion leaderboard`: explore la tabla de clasificación de la [Red](/arena) desde su terminal e instale un plugin de método directamente desde allí. Consulte la [referencia de la CLI](/docs/reference/cli#leaderboard) para ver todas las opciones.
:::

[Network](/arena) es donde los métodos de traducción se comparan con puntuación reproducible y con huella digital. Cada método obtiene una puntuación compuesta en múltiples métricas (chrF++, coincidencia exacta, aceptación FST, puntuación semántica). El leaderboard rastrea cada envío.

El flujo de trabajo:

```bash
# Browse the leaderboard from your terminal
npx champollion leaderboard --pair en:crk

# Output:
# ┌──────┬───────────────────────┬────────────┬──────────┬───────────┐
# │ Rank │ Method                │ Model      │ chrF++   │ Composite │
# ├──────┼───────────────────────┼────────────┼──────────┼───────────┤
# │  1   │ crk-coached-v3        │ gemini-2.5 │ 43.2     │ 0.67      │
# │  2   │ fst-gated-pipeline    │ gpt-4o     │ 41.8     │ 0.63      │
# │  3   │ prompt-baseline       │ claude-4   │ 38.1     │ 0.55      │
# └──────┴───────────────────────┴────────────┴──────────┴───────────┘

# Install the method that fits as a plugin
npx champollion leaderboard --install crk-coached-v3

# Use it
npx champollion sync
```

*Solo ilustrativo — las filas del leaderboard anteriores son un ejemplo de diseño. El tablero está actualmente abierto para envíos y no tiene ejecuciones publicadas aún.*

**Usted no construye el método. Usted no entrena el modelo. Usted elige el método que se ajusta a su dominio, presupuesto y licencia — humano o máquina — e implementa.** Si un método más adecuado aparece el próximo mes, lo cambia con un comando.

## Qué Está Disponible Hoy

El puente leaderboard-a-CLI está en desarrollo. Esto es lo que funciona ahora:

### Métodos integrados (sin complementos necesarios)

| Método | Mejor Para | Costo |
|--------|----------|------|
| `llm` (predeterminado) | Enfocado en calidad, cualquier idioma | Por token a través de OpenRouter |
| `gemini` | Calidad + nivel gratuito | Gratuito (limitado), luego por token |
| `google-translate` | Velocidad + volumen | $20/M caracteres |
| `deepl` | Idiomas europeos | $25/M caracteres |
| `llm-coached` | Idiomas con datos de coaching | Por token a través de OpenRouter |
| `api` | Métodos personalizados/alojados en comunidad | Autohospedado |

### Métodos de complemento (instalar por separado)

Los complementos personalizados pueden envolver cualquier lógica de traducción — un modelo ajustado, una canalización con puerta FST, una API comunitaria, o cualquier otra cosa que produzca JSON. Consulte [Construir un Complemento](/docs/tutorials/build-a-plugin).

## Flujo de Trabajo Empresarial

### 1. Evalúe su calidad actual

```bash
# See what you're getting today
npx champollion status

# Output shows: method per pair, cache hit rate, quality gate stats
```

### 2. Ejecute el arnés de evaluación en candidatos

El [arnés de evaluación](/docs/network/specifications/harness) le permite comparar múltiples métodos contra el mismo conjunto de datos. Ejecute un barrido, compare puntuaciones, elija ganadores:

```bash
# In the eval harness repo
python -m mt_eval_harness.run \
  --methods coached-v3 baseline prompt-tuned \
  --dataset data/your-corpus.json
```

### 3. Configure ganadores por par

Actualice su configuración para usar el mejor método por par de idiomas. Diferentes idiomas tienen diferentes mejores métodos — ese es el punto.

### 4. Integre en CI/CD

```bash
# In your CI pipeline
npx champollion lint        # Catch hardcoded strings
npx champollion sync        # Translate what changed
npx champollion audit       # Fail if any locale is incomplete
npx champollion integrity   # Validate placeholder consistency
```

Tres comandos. Cero traducción manual. La canalización detecta cadenas codificadas, las traduce con sus métodos elegidos, y falla la compilación si algo falta o está corrupto.

### 5. Revisión profesional (opcional)

Para contenido de alto riesgo, exporte a XLIFF para revisión humana:

```bash
npx champollion xliff export --locale ja --output translations.xliff
# → Send to your translation agency
# → Import corrections back:
npx champollion xliff import translations.xliff
```

Traduzca automáticamente el grueso. Revise humanamente las rutas críticas. Pague por tiempo humano solo donde importa.

## Modelo de Costo

champollion **no tiene suscripción ni precios por usuario**. El código fuente de la CLI está disponible bajo la licencia PolyForm Noncommercial 1.0.0: es gratuita para uso no comercial (investigación, educación, trabajo comunitario); el uso comercial requiere permiso, así que [hable con nosotros](/get-involved) primero. Más allá de eso, usted solo paga por las llamadas a la API de traducción:

| Volumen | Google Translate | LLM (Gemini Flash) | LLM (GPT-4o) |
|--------|-----------------|---------------------|---------------|
| 1.000 claves × 5 configuraciones regionales | ~$0,50 | ~$0,30 (nivel gratuito) | ~$2,00 |
| 10.000 claves × 15 configuraciones regionales | ~$15 | ~$8 | ~$60 |
| 50.000 claves × 30 configuraciones regionales | ~$75 | ~$40 | ~$300 |

Translation Memory significa que solo paga por **claves cambiadas** en sincronizaciones posteriores. Si actualiza 10 cadenas de 10.000, paga por 10 traducciones, no 10.000.

## vs. Plataformas TMS

| | champollion | Crowdin / Phrase / Locize |
|---|---|---|
| **Precios** | Gratis para uso no comercial (comercial con permiso) + costos de API | $50–$500/mes + por usuario |
| **Dependencia del proveedor** | Ninguna: cambie de proveedor en la configuración | Alta: los datos están en su nube |
| **Elección de método** | Cualquier proveedor, cualquier modelo, por par | Lo que ellos ofrezcan |
| **CI/CD** | De primer nivel (`lint → sync → audit`) | Plugin/webhook |
| **Métodos personalizados** | Sistema de plugins, plugins de la comunidad | No admitido |
| **Control de calidad** | Integrado (script incorrecto, eco, longitud) | Varía |
| **Autohospedado** | Sí (LibreTranslate, API personalizada) | No |

Consulte la [comparación completa](/docs/guides/comparison) para detalles.

## Lecturas Adicionales

- **[Inicio Rápido](/docs/getting-started/quick-start)** — ejecute su primera sincronización en 60 segundos
- **[Métodos de Traducción](/docs/guides/translation-methods)** — el menú completo de métodos con árbol de decisión
- **[Integración CI/CD](/docs/guides/ci-cd)** — automatice en su canalización
- **[Trabajar con Traductores Profesionales](/docs/guides/professional-translators)** — exportación/importación XLIFF
- **[la Network](/arena)** — comparación y leaderboard
- **[Referencia de Configuración](/docs/getting-started/configuration)** — cada opción de configuración
