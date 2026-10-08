---
sidebar_position: 1
slug: /intro
title: "Introducción"
related:
  - label: "Quick Start"
    to: /docs/getting-started/quick-start
    kind: guide
    note: "Install, configure, and run your first sync"
  - label: "How It Works"
    to: /docs/how-it-works
    kind: doc
    note: "The pipeline behind every translation"
  - label: "Translation Methods"
    to: /docs/guides/translation-methods
    kind: guide
    note: "LLM, Google Translate, coached, plugin — when to use which"
  - label: "The Language Atlas"
    to: /languages
    kind: atlas
    note: "Every language Champollion knows, on the map"
  - label: "Live Leaderboard"
    to: /leaderboard
    kind: leaderboard
    note: "Translation methods, benchmarked in the open"
---

# champollion

Un marco de internacionalización completamente personalizable. Un comando traduce sus archivos de configuración regional. Una configuración controla cada método, modelo y par de idiomas. Y si los métodos integrados no son suficientes — construya el suyo, pruebe que funciona e impleméntelo.

```bash
npx champollion sync
```

champollion detecta automáticamente sus archivos de configuración regional, el formato y los idiomas de destino. Traduce lo que falta, omite lo que ya está hecho, verifica cada resultado en busca de salidas defectuosas y escribe una salida limpia. Ese es el punto de partida.

:::info[Parte de algo más grande]

Esta CLI es el extremo de despliegue de **Champollion**: una infraestructura que
mide la traducción automática para idiomas que nadie más mide y
publica lo que descubre. La parte de medición crea conjuntos de pruebas de evaluación y
un mapa público de quién puede traducir qué, qué tan bien y en qué tipos de texto;
la CLI es donde un método comprobado se convierte en algo que usted realmente puede ejecutar.

Una regla lo define todo: los datos lingüísticos se tratan como datos biológicos, por lo que las
personas que proporcionan un corpus tienen el control sobre él y sobre cualquier cosa que se mida
con respecto a él. El panorama completo —qué existe, cuáles son las reglas, dónde encaja
usted— se encuentra en [Qué es Champollion](/docs/what-is-champollion), y la
parte de medición reside en [la Red](/docs/network/).

:::

---

## ¿Por Qué No Simplemente Escribir un Script Usted Mismo?

Podría escribir un bucle rápido que llame a Google Translate en cada clave. La mayoría de los desarrolladores lo hacen — toma alrededor de 30 líneas. Aquí es donde se rompe:

- **Sin detección de cambios.** Actualice una cadena en inglés: la traducción quedará desactualizada para siempre. champollion rastrea cada valor de origen con hashes SHA-256 y vuelve a traducir únicamente lo que cambió.
- **Sin procesamiento por lotes.** Una llamada a la API por clave significa 200 claves = 200 viajes de ida y vuelta. champollion agrupa en lotes de manera inteligente (configurable, por defecto 80 claves/lote para LLM, 128 para Google).
- **Sin almacenamiento en caché.** Cada sincronización vuelve a traducir todo. La memoria de traducción de champollion almacena en caché las traducciones por texto de origen + configuración regional + método; volver a ejecutar la sincronización después de cambiar una clave solo traduce esa clave, no el archivo completo.
- **Sin control de calidad.** La traducción automática alucina, repite la fuente como un eco o genera resultados en el sistema de escritura incorrecto. champollion verifica cada traducción antes de escribirla: salidas vacías, ecos de la fuente, bucles de repetición, inflación de longitud, contenido eliminado y escritura incorrecta se detectan y rechazan. El control detecta salidas defectuosas, no significados erróneos.
- **Sin reconocimiento de formatos.** ¿Codificado de forma fija para JSON? champollion maneja JSON, TOML, YAML y Hugo Markdown (frontmatter + cuerpo) con detección automática.
- **Sin control de métodos.** Cada par recibe el mismo método. champollion le permite usar Google Translate para francés, un LLM para japonés y un pipeline personalizado alojado por la comunidad para cree, todo en el mismo archivo de configuración.

champollion es la versión de producción de ese script.

---

## Lo Que Lo Hace Diferente

### Cada método es un complemento

El método de traducción es **configurable por par de idiomas**. Mezcle Google Translate, LLM, indicaciones entrenadas y API personalizadas en el mismo proyecto:

```json title="champollion.config.json"
{
  "version": 3,
  "pairs": {
    "en:fr": { "method": "google-translate" },
    "en:ja": { "method": "llm", "model": "google/gemini-3.1-pro-preview" },
    "en:crk": { "method": "llm-coached" }
  }
}
```

El francés obtiene Google Translate (rápido, económico). El japonés obtiene un LLM de primer nivel (con matices). El cree de las llanuras obtiene un LLM entrenado con las reglas gramaticales y el diccionario que usted proporcione. El mismo comando `sync`. El mismo control de calidad. La misma CLI.

### Vea qué funciona

¿Cree que su método puede traducir inglés a español? ¿Turco a azerbaiyano? ¿Inglés a Cree?

**Constrúyalo y pruébelo.** El [arnés de evaluación](/docs/network/specifications/harness) complementario evalúa cualquier método de traducción con puntuación reproducible y con huella digital. El [marcador](/leaderboard) registra cada ejecución publicada, para que todos puedan ver qué funciona.

El arnés de evaluación y la CLI de producción comparten la misma interfaz de complemento. Un método que obtiene una buena puntuación en el arnés puede usarse en producción — si la comunidad cuyo idioma sirve da su consentimiento. Para idiomas indígenas y de recursos limitados, ese consentimiento importa. Vea [Data Sovereignty](/docs/network/sovereignty/data-sovereignty).

```bash
# Benchmark a method against a real, non-bundled eval corpus
# (GlobalVoices amh->fra, 945 sentences, fetched from source on first run)
python3 -m pip install mt-eval-harness
export OPENROUTER_API_KEY=sk-or-...   # any OpenRouter-proxied model works
mt-eval run --corpus eval-amh-fra-globalvoices-test-v1 --model google/gemini-3.1-pro-preview --yes

# Use it locally
npx champollion sync
```

El mismo complemento. Conecte y pruebe.

### El kit de herramientas completo

champollion no es solo `sync`. Es un pipeline i18n completo:

| Comando | Lo Que Hace |
|---------|-------------|
| `sync` | Traducir claves faltantes y obsoletas (con verificación posterior a la sincronización) |
| `watch` | Sincronización automática cuando cambia su archivo de origen |
| `lint` | Escanear código fuente para cadenas codificadas |
| `wrap` | Envolver automáticamente cadenas codificadas en llamadas `t()` |
| `audit` | Listar todos los marcadores de respaldo `[EN]` de ejecuciones anteriores |
| `verify` | Verificar que las traducciones estén presentes y sean correctas (puerta de CI) |
| `integrity` | Detectar corrupción de marcadores de posición, problemas de codificación e integridad de plurales ICU |
| `seo` | Generar etiquetas hreflang, mapas del sitio y esquema JSON-LD |
| `status` | Mostrar configuración de par, complementos y puntuaciones de evaluación comparativa |
| `provenance` | Auditar licencias de recursos de traducción |
| `plugin` | Instalar, eliminar y listar complementos de método |
| `fonts` | Descargar fuentes web para convertidores de script PUA |
| `tm` | Administrar caché de Memoria de Traducción (estadísticas, limpiar, por configuración regional) |
| `xliff` | Exportar/importar XLIFF 1.2 para revisión de traductor profesional |

Cuatro de estos — `lint`, `sync`, `verify`, `audit` — forman un pipeline de CI que detecta cadenas codificadas, las traduce, verifica la corrección y falla la compilación si alguna configuración regional está incompleta.

---

## La Red

La [Tabla de clasificación de métodos](/leaderboard) es el marcador: en vivo, pública y abierta a envíos. Cada envío se identifica mediante un commit de Git, se vincula a una versión de un conjunto de datos específico y es calificado por el mismo banco de pruebas. Cualquier persona puede realizar envíos.

**¿Qué puede construir?** El arnés toma JSON. Los complementos toman JSON. Cualquier método que produzca JSON puede ser probado:

| Enfoque | Ejemplo |
|----------|---------|
| **LLM entrenado** | Inyecte reglas gramaticales y diccionarios en la indicación de un modelo de frontera |
| **Modelo ajustado** | Entrene un modelo abierto en texto paralelo — solo no en los datos de evaluación |
| **Pipeline con puerta FST** | LLM genera → transductor de estado finito valida morfología → reintentar |
| **Modelos encadenados** | Modelo A redacta → Modelo B post-edita → Modelo C califica |
| **Diccionario + LLM** | Force términos conocidos de un diccionario, deje que el LLM maneje el resto |
| **Evolutivo** | Genere candidatos, califíquelos, mute los mejores, repita |
| **Traducción parcial** | Traduzca una muestra a mano, pruebe que su LLM coincida, traduzca automáticamente el resto |

Ajuste modelos. Implemente algoritmos evolutivos. Pruebe respuestas de estudiantes en exámenes de idiomas. Construya tablas de búsqueda. Encadene tres modelos juntos. Siempre que su método produzca JSON, el arnés lo califica y el marco lo ejecuta.

:::danger[La única regla]
**No entrene en los datos de evaluación.** Los métodos expuestos al conjunto de datos de evaluación comparativa serán descalificados. Ajuste en lo que quiera. Solo no en el conjunto de pruebas.
:::

Esta es una invitación abierta. Si trabaja con un idioma de recursos limitados — como investigador, miembro de la comunidad, estudiante o simplemente alguien que se preocupa — construya un método, ejecute el arnés y fortalezca la red para todos. El problema no está resuelto. La infraestructura está aquí, y es abierta.

**[→ Ver el marcador](/leaderboard)**

---

## Próximos pasos

**Primeros pasos:**
- [Instalación](/docs/getting-started/installation) — Configure en 2 minutos
- [Inicio Rápido](/docs/getting-started/quick-start) — Ejecute su primera sincronización
- [Idiomas Compatibles](/docs/reference/supported-languages) — Lo que está disponible de forma predeterminada

**Personalizar su configuración:**
- [Métodos de Traducción](/docs/guides/translation-methods) — Elija el método correcto por par
- [Memoria de Traducción](/docs/concepts/translation-memory) — Cómo el almacenamiento en caché le ahorra dinero
- [Configuración](/docs/getting-started/configuration) — Referencia de configuración completa
- [Sitio Multilingüe de Hugo](/docs/tutorials/hugo-multilingual-site) — Traducción de contenido Markdown

**Para profundizar:**
- [Trabajar con traductores profesionales](/docs/guides/professional-translators) — Flujo de trabajo de exportación/importación XLIFF
- [Soberanía de datos](/docs/network/sovereignty/data-sovereignty) — Principios de soberanía de datos indígenas: propiedad y control comunitario de los datos lingüísticos
- [Apoyar un idioma de bajos recursos](/docs/network/community/low-resource-languages) — El desafío que lo inició todo
- [Guía práctica: Pipeline con filtro FST](/docs/network/tutorials/fst-gated-pipeline) — Cree un pipeline de descomposición
- [Evaluación de traducción automática](/docs/network/leaderboard/rules) — Cómo funcionan el banco de pruebas y la tabla de clasificación
- [Tabla de clasificación de métodos](/leaderboard) — Puntuaciones en vivo y envíos
