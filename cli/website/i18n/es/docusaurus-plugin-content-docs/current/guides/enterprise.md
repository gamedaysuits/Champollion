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
    "en:ja": { "method": "llm", "model": "google/gemini-3.1-pro-preview" },
    "en:de": { "method": "google-translate" },
    "en:ko": { "method": "llm", "register": "polite-haeyo" },
    "en:es": { "method": "api", "endpoint": "https://review.your-lsp.example/mtpe" },
    "en:crk": { "method": "llm-coached" }
  }
}
```

El francés utiliza DeepL (su equipo prefiere su fluidez europea). El japonés utiliza un LLM de frontera. El alemán utiliza Google Translate (rápido, económico, suficientemente bueno). El coreano utiliza un LLM con registro formal. El español se enruta a un servicio profesional humano / MTPE a través del método `api`; la traducción humana es un método de primer nivel aquí, no un añadido secundario. El cree de las llanuras utiliza el método de LLM guiado, con notas gramaticales y un diccionario que usted proporciona.

**Mismo comando. Misma canalización de CI. Diferentes métodos por par — humano o máquina. Un archivo de configuración.**

:::note[Los métodos para lenguas comunitarias son soberanos]
El par para cree de las llanuras mencionado anteriormente no es solo un par más. Los métodos para lenguas indígenas y otras lenguas comunitarias son **propiedad y están bajo la gobernanza de la comunidad**: la comunidad posee las claves de los datos que los respaldan, establece los términos de uso y cualquier corpus o método no comercial (NC) queda excluido de las rutas comerciales de manera predeterminada. Si su uso es comercial, verifique la licencia del método antes de realizar el despliegue. Consulte [Soberanía de datos](/docs/network/sovereignty/data-sovereignty).
:::

## Flujo de Trabajo Leaderboard → Implementación

:::tip[`champollion network leaderboard` se incluye con la CLI]
El flujo de trabajo a continuación se ejecuta con el comando `champollion network leaderboard`: explore la tabla de clasificación de la [Red](/arena) desde su terminal e instale un plugin de método directamente desde ella. Consulte la [referencia de la CLI](/docs/reference/cli#leaderboard) para conocer todas las opciones.
:::

En la [Red](/arena) es donde se evalúan comparativamente los métodos de traducción con puntuaciones reproducibles y con huellas digitales. Las ejecuciones se clasifican de la forma en que lo hace el campo de la traducción automática (MT): mediante chrF++ a nivel de corpus con su intervalo de confianza del 95 %. BLEU, TER y COMET se muestran a su lado, y diagnósticos como la coincidencia exacta y la aceptación por FST se reportan por separado, nunca combinados en la métrica principal. Determinar si un método es genuinamente mejor que otro es cuestión de una prueba de significancia pareada, no de una diferencia entre dos números. La tabla de clasificación registra cada envío.

El flujo de trabajo:

```bash
# Browse the leaderboard from your terminal
npx champollion network leaderboard --pair "eng>fra"

# Output (abridged):
#   #   Model         chrF++ [95% CI]      BLEU   …   EM     FST
#   1   gemini-3.5    72.3 [70.8, 73.7]    48.1   …   0.31   —
#   2   deepl         70.9 [69.2, 72.4]    46.0   …   0.29   —
#   3   claude-4      68.4 [66.9, 70.0]    43.7   …   0.27   —
#   Headline: chrF++ with its 95% bootstrap CI; rows whose intervals overlap are not distinguishable.

# Install the method that fits as a plugin (by its rank)
npx champollion network leaderboard --install 1

# Use it
npx champollion sync
```

*Solo con fines ilustrativos: las filas de la tabla de clasificación anteriores son un diseño de ejemplo. En este ejemplo, los intervalos de las dos primeras filas se superponen, por lo que la tabla no indica que uno sea mejor que el otro. La tabla está abierta actualmente para envíos y aún no cuenta con ejecuciones publicadas.*

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
# In your CI pipeline — pinned to the 0.5 line, so a new release never
# changes what the pipeline runs (the CI guide has the complete workflow)
npx --yes champollion@0.5 lint        # Catch hardcoded strings
npx --yes champollion@0.5 sync        # Translate what changed
npx --yes champollion@0.5 audit       # Fail if any locale is incomplete
npx --yes champollion@0.5 integrity   # Validate placeholder consistency
```

Tres comandos. Cero traducción manual. La canalización detecta cadenas codificadas, las traduce con sus métodos elegidos, y falla la compilación si algo falta o está corrupto.

### 5. Revisión profesional (opcional)

Para contenido de alto riesgo, exporte a XLIFF para revisión humana:

```bash
npx champollion xliff export --locale ja --out translations.xliff
# → Send to your translation agency
# → Import corrections back:
npx champollion xliff import translations.xliff
```

Traduzca automáticamente el grueso. Revise humanamente las rutas críticas. Pague por tiempo humano solo donde importa.

## Modelo de Costo

champollion **no tiene suscripciones ni precios por usuario**. La CLI está disponible bajo el modelo source-available con la licencia PolyForm Noncommercial 1.0.0: gratuita para uso no comercial: investigación, educación, organizaciones benéficas, hospitales y clínicas públicas, gobierno y proyectos personales. Su uso con fines comerciales, como el producto de una empresa con fines de lucro, no está cubierto por dicha licencia. Consulte [quién puede usar esto](/docs/getting-started/who-may-use-this) antes de adoptarla. Aparte de eso, usted solo paga por las llamadas a las API de traducción:

| Volumen | Google Translate | LLM (Gemini Flash) | LLM (GPT-4o) |
|--------|-----------------|---------------------|---------------|
| 1.000 claves × 5 configuraciones regionales | ~$0,50 | ~$0,30 (nivel gratuito) | ~$2,00 |
| 10.000 claves × 15 configuraciones regionales | ~$15 | ~$8 | ~$60 |
| 50.000 claves × 30 configuraciones regionales | ~$75 | ~$40 | ~$300 |

Translation Memory significa que solo paga por **claves cambiadas** en sincronizaciones posteriores. Si actualiza 10 cadenas de 10.000, paga por 10 traducciones, no 10.000.

## vs. Plataformas TMS

| | champollion | Crowdin / Phrase / Locize |
|---|---|---|
| **Precios** | Gratuito para uso no comercial ([quién puede usar esto](/docs/getting-started/who-may-use-this)) + costos de API | $50–$500/mes + por usuario |
| **Dependencia del proveedor (vendor lock-in)** | Ninguna: cambie de proveedor en la configuración | Alta: datos en su nube |
| **Elección del método** | Cualquier proveedor, cualquier modelo, por par | Lo que ellos ofrezcan |
| **CI/CD** | De primer nivel (`lint → sync → audit`) | Plugin/webhook |
| **Métodos personalizados** | Sistema de plugins, plugins de la comunidad | No admitido |
| **Control de calidad (Quality gate)** | Integrado (wrong-script, eco, longitud) | Varía |
| **Autohospedado** | Sí (LibreTranslate, API personalizada) | No |

Consulte la [comparación completa](/docs/guides/comparison) para detalles.

## Lecturas Adicionales

- **[Inicio Rápido](/docs/getting-started/quick-start)** — ejecute su primera sincronización en 60 segundos
- **[Métodos de Traducción](/docs/guides/translation-methods)** — el menú completo de métodos con árbol de decisión
- **[Integración CI/CD](/docs/guides/ci-cd)** — automatice en su canalización
- **[Trabajar con Traductores Profesionales](/docs/guides/professional-translators)** — exportación/importación XLIFF
- **[la Network](/arena)** — comparación y leaderboard
- **[Referencia de Configuración](/docs/getting-started/configuration)** — cada opción de configuración
