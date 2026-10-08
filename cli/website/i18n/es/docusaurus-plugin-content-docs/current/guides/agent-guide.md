---
sidebar_position: 9
title: "Guía para agentes: Usar champollion"
description: "Cómo los agentes de IA pueden instalar, configurar y ejecutar champollion para traducir archivos de configuración regional."
related:
  - label: "Agent Guide: Building & Benchmarking on the Network"
    to: /docs/network/getting-started/agent-guide
    kind: arena
    note: "The eval-side guide for the same agents"
  - label: "Serving a Custom Method as an API"
    to: /docs/guides/serving-a-method
    kind: guide
  - label: "Build a Translation Plugin"
    to: /docs/tutorials/build-a-plugin
    kind: tutorial
  - label: "CLI Reference"
    to: /docs/reference/cli
    kind: reference
---

# Guía de Agentes: Usando champollion

champollion es una herramienta CLI que traduce los archivos de configuración regional de su aplicación con un solo comando. Esta guía es para agentes de IA (o desarrolladores que trabajan con agentes de IA) que desean pasar de cero a archivos de configuración regional traducidos rápidamente.

:::tip[¿Ya está familiarizado?]
Si solo necesita comandos, vaya a la [Referencia CLI](/docs/reference/cli). Si desea construir y comparar un método de traducción, consulte la [Guía del Agente de Red](/docs/network/getting-started/agent-guide).
:::

---

## Configuración del entorno

```bash
# No global install needed — npx runs it directly
npx champollion sync
```

**Requisitos:**
- Node.js 20.11+ (ESM nativo)
- Una clave de API para su proveedor de traducción

**Configuración de clave API** — champollion necesita al menos una clave dependiendo de qué métodos utilice:

```bash
# Option 1: export (session only)
export OPENROUTER_API_KEY="sk-or-..."        # for llm / llm-coached methods
export GOOGLE_TRANSLATE_API_KEY="AIza..."    # for google-translate method

# Option 2: .env file in your project root (persistent, gitignored)
echo 'OPENROUTER_API_KEY=sk-or-...' > .env
```

Champollion lee `.env.local` y `.env` automáticamente (prioridad: `process.env` → `.env.local` → `.env`). Obtenga una clave de OpenRouter en [openrouter.ai/keys](https://openrouter.ai/keys).

---

## Primera Sincronización

Champollion detecta automáticamente sus archivos de configuración regional, su formato (JSON, TOML o YAML) e idiomas de destino:

```bash
npx champollion sync
```

**Lo que sucede:**
1. Carga `champollion.config.json` (o detecta automáticamente la configuración)
2. Escanea su archivo de configuración regional de origen, aplana las claves anidadas
3. Compara contra `.champollion.lock` (hashes SHA-256 de valores previamente traducidos)
4. Verifica `.champollion/tm.json` para traducciones en caché (Memoria de Traducción)
5. Traduce solo **claves cambiadas, faltantes o antiguas** a través del método configurado
6. Ejecuta la puerta de calidad (5 verificaciones) en cada traducción
7. Escribe las traducciones aprobadas en el archivo de configuración regional de destino
8. Actualiza el archivo de bloqueo y la caché de TM

En una re-ejecución típica después de cambiar una clave, el paso 4 sirve 142 claves desde caché y el paso 5 traduce 1 clave. Por eso las sincronizaciones posteriores son rápidas y económicas.

---

## Configuración

Cree `champollion.config.json` en la raíz de su proyecto:

```json
{
  "inputLocale": "en",
  "pairs": {
    "en:fr": { "method": "llm-coached" },
    "en:ja": { "method": "google-translate" },
    "en:crk": { "method": "api", "endpoint": "http://localhost:3000/translate" }
  }
}
```

Las claves de pares usan dos puntos (**:**) (`en:fr`), no un guion — los guiones están reservados para códigos de configuración regional como `es-MX`.

Campos clave:

| Campo | Propósito | Valor predeterminado |
|-------|-----------|----------------------|
| `inputLocale` | Idioma de origen | `en` |
| `languages` | Idiomas de destino (arreglo u objeto) | `[]` |
| `pairs` | Anulaciones por par (claves `"src:tgt"`) con configuración de método | opcional |
| `localesDir` | Dónde se ubican los archivos de localización | `./locales` |
| `model` | Modelo LLM para los métodos `llm`/`llm-coached` | `google/gemini-3.8-flash` |
| `batchSize` | Claves por llamada a la API | 80 (LLM); Google Translate tiene un límite de 128 segmentos/solicitud |
| `jsonConcurrency` | Traducciones de localización en paralelo para claves JSON | 50 |
| `contentConcurrency` | Llamadas a la API en paralelo para la traducción de contenido | 48 (documentos de Docusaurus), 12 (`contentDir`) |

Referencia completa: [Configuración](/docs/getting-started/configuration)

---

## Métodos de Traducción

| Método | Cuándo usar | Costo | Clave API necesaria |
|--------|------------|-------|-------------------|
| **`llm`** | Propósito general, bueno para idiomas bien dotados de recursos | Por token (depende del modelo) | `OPENROUTER_API_KEY` |
| **`llm-coached`** | Cuando tiene reglas gramaticales/diccionario para el idioma de destino | Por token + contexto de coaching | `OPENROUTER_API_KEY` |
| **`google-translate`** | Idiomas de alto recurso donde GT funciona bien | $20/millones de caracteres | `GOOGLE_TRANSLATE_API_KEY` |
| **`api`** | Canalización personalizada alojada detrás de un punto final HTTP | Determinado por servidor | Ninguno (el punto final maneja la autenticación) |
| **`plugin`** | Método preempaquetado instalado localmente | Varía | Varía |

Detalles: [Métodos de Traducción](/docs/guides/translation-methods)

---

## Datos de Coaching

Para pares `llm-coached`, los datos de coaching guían el LLM con conocimiento lingüístico explícito. Cree un archivo de coaching:

```json title="coaching/fr.json"
{
  "grammar_rules": [
    "Use formal register (vous) for all UI text",
    "Adjectives agree in gender and number with the noun"
  ],
  "dictionary": {
    "dashboard": "tableau de bord",
    "settings": "paramètres"
  },
  "style_notes": "Prefer active voice. Avoid anglicisms."
}
```

Haga referencia a él en la configuración de su par:

```json
"en:fr": { "method": "llm-coached", "coachingFile": "coaching/fr.json" }
```

La puerta de calidad verifica que los términos del diccionario realmente aparezcan en la salida — las violaciones se registran como advertencias `[TERM]`.

Detalles: [Datos de Coaching](/docs/concepts/coaching-data)

---

## Puerta de Calidad

Cada traducción pasa por cinco verificaciones automatizadas antes de escribirse en disco:

| Verificación | Qué detecta | Ejemplo |
|--------------|-------------|---------|
| **Vacío/en blanco** | El modelo no devolvió nada | `""` |
| **Eco de origen** | El modelo devolvió la entrada en inglés sin cambios | `"Welcome"` para japonés |
| **Bucle de alucinación** | Trigramas repetidos | `"Qo' Qo' Qo' Qo'"` |
| **Inflación de longitud** | La salida supera 4 veces la longitud del origen (exactamente 4 veces pasa) | origen de 10 caracteres → salida de 50 caracteres |
| **Conformidad con el sistema de escritura** | Sistema de escritura incorrecto para la configuración regional | texto en latino para configuración regional en árabe |

Los fallos se registran con prefijo `[GATE]`. Sin respaldos silenciosos — si una traducción falla, se reporta, no se acepta silenciosamente.

Detalles: [Puerta de Calidad](/docs/concepts/quality-gate)

---

## Memoria de Traducción

Champollion almacena en caché las traducciones en `.champollion/tm.json`, indexadas por texto de origen + configuración regional + método. En sincronizaciones posteriores, las claves sin cambios se sirven desde caché — sin llamada API, sin costo.

```
[TM] 142 key(s) served from cache
Translating 3 key(s) to French (llm)... [OK]
```

Para omitir la caché en una ejecución: `npx champollion sync --no-tm`

Detalles: [Memoria de Traducción](/docs/concepts/translation-memory)

---

## Archivos Generados

Champollion crea varios archivos en su proyecto. Sepa qué son para no eliminar o confirmar accidentalmente los incorrectos:

| Archivo | Propósito | ¿Git? |
|---------|-----------|-------|
| `.champollion.lock` | Hashes SHA-256 de los valores de origen traducidos (detección de cambios), más por configuración regional: lo que escribió sync, claves que un redo dejó pendientes, claves retenidas tras un rechazo | **Sí** — haga commit de esto |
| `.champollion-replaced-edits.jsonl` | Traducciones editadas manualmente que un sync reemplazó, con su redacción (escrito solo cuando eso ocurre) | **Sí** — haga commit de esto |
| `.champollion-content.lock` | Lo mismo, pero para archivos de contenido Markdown/MDX | **Sí** — haga commit de esto |
| `.champollion/` | Directorio de estado interno (caché de `tm.json`, exportaciones XLIFF, copias de seguridad) | **No** — agréguelo a .gitignore; `tm.json` es una caché local (consulte [Configuración](/docs/getting-started/configuration)) |
| Archivos de coaching que usted crea (p. ej., `coaching/fr.json`) | Su conocimiento lingüístico | **Sí** — haga commit de estos |
| `champollion.config.json` | Configuración del proyecto | **Sí** — haga commit de esto |

---

## Patrones Comunes

**Traducir todos los pares configurados:**
```bash
npx champollion sync
```
Champollion traduce todas las configuraciones regionales en paralelo. Con el almacenamiento en caché de TM, solo las claves modificadas consultan la API (los pares sin cambios se sirven desde la caché, por lo que una sincronización completa es económica).

**Traducir solo pares específicos:**
```bash
npx champollion sync --pair en:fr          # one pair
npx champollion sync --pair en:fr,en:de    # comma-separated list
```
`--pair` restringe la ejecución a los pares nombrados; las comprobaciones de preparación y el gasto se aplican únicamente a esos pares. Nombrar un par que no esté en su grafo de pares configurado falla de forma explícita mostrando la lista de pares configurados — nunca una operación no operativa silenciosa.

**Cómo escribir un par.** Un par de proyecto se escribe de la forma en que `champollion.config.json` lo indexa, `en:fr`. `sync`, `verify` y `serve` también leen `en>fr` y `en-fr`, y `en-pt-BR` se compara con los pares que usted configuró. Los comandos de red (`network register-corpus`, `leaderboard`, `recommend`, `submit`) escriben un par como `eng>crk`, el formato que almacena la tabla de clasificación, y leen `eng-crk` y `eng:crk` de la misma manera. Allí, un par con solo guiones debe constar de dos códigos de dos o tres letras (`eng-crk`). Un código que tenga su propio guion requiere `>`: `--pair "eng>pt-BR"`. `eng-pt-BR` también podría significar `eng-pt` y `BR`, por lo que se rechaza y nunca se intenta adivinar. En una shell, coloque entre comillas el formato `>`: `--pair "eng>crk"`. Sin comillas, la shell enviará la salida a un archivo llamado `crk`.

**Modo de contenido (una carpeta de Markdown/MDX: un `content/` de Hugo o cualquier carpeta; los documentos de Docusaurus se encuentran sin este):**
```bash
npx champollion sync --content-dir ./content
```
Traduce documentos, publicaciones de blog y archivos de contenido junto con los JSON de configuración regional. Cada traducción se escribe junto a su origen como `<name>.<locale>.md`; las modificaciones que realice un revisor se conservan cuando el origen cambia en otra parte ([Traducción de contenido](/docs/guides/content-translation#reviewing-and-editing-translations)). La traducción de contenido se ejecuta en paralelo; ajústela con `--content-concurrency`.

**Ejecución en seco (vista previa sin escribir):**
```bash
npx champollion sync --dry-run
```

**Forzar re-traducción de claves específicas:**
```bash
npx champollion sync --force-keys "hero.title,nav.about"
```

**Volver a procesar todos los archivos de contenido (el texto en caché se reutiliza, por lo que el texto sin cambios es gratuito):**
```bash
npx champollion sync --force-content
```

**Traducir archivos de contenido específicos desde cero (facturado), o limitar una ejecución a ciertos archivos:**
```bash
npx champollion sync --retranslate docs/intro.md
npx champollion sync --files "docs/guides/**"
```

**Ejecución legible por máquina:** `--json` escribe un objeto JSON por línea (NDJSON), cada uno con un `level`: en stdout, mensajes de `info` y `ok`, registros de `event` (`"event": "cost"` —la estimación, antes del filtro de `--max-cost`— y un `"event": "file"` por archivo de contenido y configuración regional), y por último el `{"level": "summary", "command": "sync", …}` de cierre; en stderr, líneas de `warn` y `error`, también en JSON. Seleccione el resumen por su nivel, nunca únicamente por la posición de la línea: `npx champollion sync --dry --json 2>/dev/null | jq -c 'select(.level == "summary")'`. El código de salida `2` significa parcial (se completó parte del trabajo, algo falló).

En la estimación (evento `cost`, y `costEstimate` en el resumen), `totalEstimatedCost` es `null` siempre que alguna parte no tenga un precio conocido —nunca una suma parcial, nunca `0` para lo desconocido—; `knownEstimatedCost` contiene la parte con precio, `unknownCost.reason` nombra los pares sin precio y `unknownCost.notes` indica qué carece de él y por qué: `{ subject, pairs, note }`, como un nombre de modelo que la lista de OpenRouter no incluye (un probable error tipográfico, con los nombres listados más cercanos), un modelo listado sin precio por token, o una lista de precios que no se pudo leer. Un modelo en esta máquina (un endpoint de `local` o `api` en `localhost`/`127.0.0.1`/`::1`) tiene un precio de `0` con `"local": true`. El `sentToModel` del resumen cuenta las claves enviadas al método en esta ejecución (`tmHits`: servidas desde la caché). El resumen de un simulacro (dry run) incluye `preflight: { ready, failures }` —`ready: false` significa que la ejecución real se detendría y saldría con `1` (una clave faltante, o un servidor de modelos necesario para la ejecución que no responde), aunque el simulacro en sí sale con `0` ([códigos de salida](/docs/reference/cli#sync-exit-codes)). Con `--max-cost` también incluye `maxCost: { cap, estimatedCost, wouldStop }` —`wouldStop: true` (con `exitCode: 2` y el `reason`) significa que la ejecución real se detendría en el límite antes de cualquier llamada a la API. `realRun: { exitCode, wouldStop, reasons }` es el código de salida con el que terminaría la ejecución real, hasta donde una vista previa puede determinar: la verificación previa y el límite, además de lo que la dejaría parcial —claves retenidas, mensajes plurales en el disco sin una forma que el idioma utilice y que no volvería a solicitar (contados en el `totalPluralGaps` del simulacro)—. Un simulacro no verifica nada (`verify: { "ran": false }`). Ejecute el simulacro con `--method`/`--model` de la ejecución real: sin ellos, comprueba el método que indica la configuración.

**Comprobar el estado de la traducción:**
```bash
npx champollion status
```
Muestra el método, modelo, cobertura e información de plugins de cada par (un `qualityTier` solo cuando la configuración define uno —una etiqueta, no una medición—).

**Auditar respaldos sin traducir:**
```bash
npx champollion audit
```
Enumera todos los valores de respaldo `[EN]` que necesitan traducción.

---

## Solución de problemas

| Problema | Solución |
|----------|----------|
| `OPENROUTER_API_KEY not set` | Exporte la clave o agréguela a `.env` en la raíz de su proyecto |
| `No locale files found` | Establezca `localesDir` en la configuración, o asegúrese de que sus archivos de configuración regional coincidan con la convención de nomenclatura estándar (`en.json`, `fr.json`) |
| `[GATE] Script compliance failed` | Su configuración regional de destino recibió texto en alfabeto latino en lugar del sistema de escritura esperado; intente con un modelo diferente o agregue datos de coaching |
| `[GATE] Source echo` | El modelo devolvió el inglés sin cambios; por lo general, los datos de coaching o un modelo diferente resuelven esto |
| Todas las traducciones en caché | Ejecute con `--no-tm` para omitir la caché, o con `--force-keys` para claves específicas |
| Conflictos en el archivo de bloqueo | `.champollion.lock` contiene hashes; es seguro resolver un conflicto de fusión conservando cualquiera de las versiones y luego volviendo a ejecutar sync. Conservar el registro por configuración regional de la otra parte puede hacer que algunos valores se interpreten como editados a mano (un redo masivo los conserva y los nombra; `--redo keys:` reemplaza uno), nunca lo contrario |
| Claves "retenidas" | El control de calidad rechazó la respuesta de ese modelo anteriormente; un sync normal no la vuelve a enviar (se facturaría por la misma respuesta). `champollion sync --redo keys:<key>` vuelve a solicitarla; o agregue un `fallback`, lístelo en `noTranslate`, o escríbalo a mano |

---

## Próximos Pasos

- [Inicio Rápido](/docs/getting-started/quick-start) — tutorial completo de introducción
- [Referencia CLI](/docs/reference/cli) — cada comando y bandera
- [Cómo Funciona](/docs/how-it-works) — la canalización de sincronización explicada
- [El Puente del Arnés de Evaluación](/docs/guides/bridge) — cómo champollion se conecta a la Red
- **¿Desea construir su propio método de traducción?** Consulte la [Guía de Agentes de Red](/docs/network/getting-started/agent-guide) — construya un método, demuestre que funciona en la tabla de clasificación pública y compita por un premio si/cuando uno esté abierto (los premios son un mecanismo planeado — consulte [Limitaciones Honestas](/docs/network/honest-limitations)).
