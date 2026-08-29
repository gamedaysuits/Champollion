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

| Campo | Propósito | Predeterminado |
|-------|---------|---------|
| `inputLocale` | Idioma de origen | `en` |
| `languages` | Idiomas de destino (matriz u objeto) | `[]` |
| `pairs` | Anulaciones por par (claves `"src:tgt"`) con configuración de método | opcional |
| `localesDir` | Dónde viven los archivos de configuración regional | `./locales` |
| `model` | Modelo LLM para métodos `llm`/`llm-coached` | `google/gemini-3.5-flash` |
| `batchSize` | Claves por llamada de API | 80 (LLM); Google Translate tiene un límite de 128 segmentos/solicitud |
| `jsonConcurrency` | Traducciones paralelas de configuración regional para claves JSON | 50 |
| `contentConcurrency` | Llamadas de API paralelas para traducción de contenido | 48 (Docusaurus docs), 12 (Hugo `contentDir`) |

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
|--------------|------------|---------|
| **Vacío/en blanco** | El modelo no devolvió nada | `""` |
| **Eco de origen** | El modelo devolvió la entrada en inglés sin cambios | `"Welcome"` para japonés |
| **Bucle de alucinación** | Trigramas repetidos | `"Qo' Qo' Qo' Qo'"` |
| **Inflación de longitud** | La salida es 4 veces o más larga que la fuente | Fuente de 10 caracteres → salida de 50 caracteres |
| **Cumplimiento de script** | Script incorrecto para la configuración regional | Texto latino para configuración regional árabe |

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
|------|---------|------|
| `.champollion.lock` | Hashes SHA-256 de valores de origen traducidos (detección de cambios) | **Sí** — confirme esto |
| `.champollion-content.lock` | Lo mismo, pero para archivos de contenido Markdown/MDX | **Sí** — confirme esto |
| `.champollion/` | Directorio de estado interno (caché `tm.json`, exportaciones XLIFF, copias de seguridad) | **No** — añádalo a .gitignore; `tm.json` es una caché local (consulte [Configuración](/docs/getting-started/configuration)) |
| Archivos de coaching que usted crea (p. ej. `coaching/fr.json`) | Su conocimiento lingüístico | **Sí** — confirme estos |
| `champollion.config.json` | Configuración del proyecto | **Sí** — confirme esto |

---

## Patrones Comunes

**Traduzca todos los pares configurados:**
```bash
npx champollion sync
```
Champollion traduce todos los locales en paralelo. Con la caché de TM, solo las claves modificadas llegan a la API (los pares sin cambios se sirven desde la caché, por lo que una sincronización completa es económica).

**Traduzca solo pares específicos:**
```bash
npx champollion sync --pair en:fr          # one pair
npx champollion sync --pair en:fr,en:de    # comma-separated list
```
`--pair` restringe la ejecución al par o pares nombrados; las comprobaciones de preparación y el gasto se aplican solo a esos pares. Nombrar un par que no está en su grafo de pares configurados genera un error visible con la lista de pares configurados — nunca es un no-op silencioso.

**Modo de contenido (Markdown/MDX para Docosaurus, Hugo, etc.):**
```bash
npx champollion sync --content-dir ./content
```
Traduce documentos, publicaciones de blog y archivos de contenido junto con JSON de configuración regional. La traducción de contenido se ejecuta en paralelo; ajuste con `--content-concurrency`.

**Ejecución en seco (vista previa sin escribir):**
```bash
npx champollion sync --dry-run
```

**Forzar re-traducción de claves específicas:**
```bash
npx champollion sync --force-keys "hero.title,nav.about"
```

**Forzar re-traducción de todos los archivos de contenido:**
```bash
npx champollion sync --force-content
```

**Verificar estado de traducción:**
```bash
npx champollion status
```
Muestra cobertura, niveles de calidad e información de complementos para cada par.

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
| `No locale files found` | Establezca `localesDir` en la configuración, o asegúrese de que sus archivos de configuración regional coincidan con la nomenclatura estándar (`en.json`, `fr.json`) |
| `[GATE] Script compliance failed` | Su configuración regional de destino obtuvo texto latino en lugar del script esperado — intente un modelo diferente o agregue datos de coaching |
| `[GATE] Source echo` | El modelo devolvió inglés sin cambios — los datos de coaching o un modelo diferente generalmente lo arreglan |
| Todas las traducciones en caché | Ejecute con `--no-tm` para omitir la caché, o `--force-keys` para claves específicas |
| Conflictos de archivo de bloqueo | `.champollion.lock` utiliza hashes SHA-256 — los conflictos de fusión son seguros de resolver manteniendo cualquier versión, luego re-ejecutando la sincronización |

---

## Próximos Pasos

- [Inicio Rápido](/docs/getting-started/quick-start) — tutorial completo de introducción
- [Referencia CLI](/docs/reference/cli) — cada comando y bandera
- [Cómo Funciona](/docs/how-it-works) — la canalización de sincronización explicada
- [El Puente del Arnés de Evaluación](/docs/guides/bridge) — cómo champollion se conecta a la Red
- **¿Desea construir su propio método de traducción?** Consulte la [Guía de Agentes de Red](/docs/network/getting-started/agent-guide) — construya un método, demuestre que funciona en la tabla de clasificación pública y compita por un premio si/cuando uno esté abierto (los premios son un mecanismo planeado — consulte [Limitaciones Honestas](/docs/network/honest-limitations)).
