---
sidebar_position: 3
title: "Configuración"
related:
  - label: "Translation Methods"
    to: /docs/guides/translation-methods
    kind: guide
    note: "What the method fields actually select"
  - label: "Cookbook: Translate 30 Languages"
    to: /docs/tutorials/translate-30-languages
    kind: cookbook
    note: "Per-pair methods and registers at scale"
  - label: "Register"
    to: /glossary#term-register
    kind: glossary
    note: "The linguistic term behind the register field"
  - label: "Supported Languages"
    to: /docs/reference/supported-languages
    kind: reference
  - label: "CLI Reference"
    to: /docs/reference/cli
    kind: reference
---

# Configuración

Champollion funciona sin configuración — detecta automáticamente archivos de configuración regional, formato e idiomas de destino desde su proyecto. Para mayor control, cree `champollion.config.json` en la raíz de su proyecto, o ejecute:

```bash
npx champollion init
```

## Referencia de configuración completa

```json title="champollion.config.json"
{
  "version": 3,
  "inputLocale": "en",
  "localesDir": "./locales",
  "contentDir": null,
  "translatableFields": null,
  "format": "auto",
  "model": "google/gemini-3.5-flash",
  "temperature": 0.3,
  "defaultMethod": "llm",
  "batchSize": 80,
  "coachingFile": null,
  "promptContext": null,
  "jsonConcurrency": 200,
  "contentConcurrency": 48,
  "fallbackPrefix": "[EN] ",
  "apiKeyEnvVar": "OPENROUTER_API_KEY",
  "noTranslate": [],
  "noTranslateUrls": true,
  "baseUrl": "",
  "pairs": {},
  "languages": {},
  "lint": {
    "srcDir": null,
    "ignore": ["node_modules", ".next", "dist"],
    "minLength": 2
  },
  "seo": {
    "urlPattern": "/:locale/:path",
    "pages": null
  },
  "typegen": {
    "output": null,
    "autoGenerate": false
  }
}
```

:::note[typegen aún no está implementado]
El bloque de configuración `typegen` es reconocido y preservado por el cargador de configuración, pero la generación de tipos TypeScript aún no está implementada. Este es un marcador de posición para una característica planeada. Establecer estos valores no tiene efecto.
:::

### Campos

| Campo | Tipo | Predeterminado | Descripción |
|-------|------|---------|-------------|
| `version` | `number` | `3` | Versión del esquema de configuración. Siempre `3`. |
| `inputLocale` | `string` | `"en"` | Código del idioma de origen (BCP 47). |
| `localesDir` | `string` | `"./locales"` | Ruta a los archivos de configuración regional (locale). Champollion escanea este directorio. |
| `contentDir` | `string` | `null` | Directorio de contenido de Hugo. Habilita la traducción del cuerpo de Markdown. |
| `translatableFields` | `string[]` | `null` | Anula los campos traducibles predeterminados del frontmatter para la traducción de contenido. `null` utiliza los valores predeterminados integrados (`title`, `description`, `summary`). |
| `format` | `string` | `"auto"` | Formato de archivo: `json`, `toml`, `yaml` o `auto` (se detecta por la extensión). |
| `model` | `string` | `"google/gemini-3.5-flash"` | Modelo predeterminado para los métodos LLM. Acepta identificadores (slugs) completos de OpenRouter (`provider/model`) o alias cortos de `shared/model-aliases.json` (por ejemplo, `gemini-flash`). Los proveedores directos usan nombres simples (por ejemplo, `gpt-4o`). |
| `temperature` | `number` | `0.3` | Temperatura del LLM (0.0–2.0). Menor = más determinista. |
| `defaultMethod` | `string` | `"llm"` | Método de traducción predeterminado: `llm`, `llm-coached`, `google-translate`, `deepl`, `microsoft-translator`, `libretranslate`, `openai`, `anthropic`, `gemini`, `api`. Se anula con la bandera de la CLI `--method`. |
| `batchSize` | `number` | `80` | Claves por lote de traducción. Mayor = menos llamadas a la API, pero prompts más grandes. |
| `coachingFile` | `string` | `null` | Ruta a un archivo de prompt de entrenamiento de texto libre (relativa a la raíz del proyecto). El contenido se lee al inicio y se inyecta en el prompt del sistema como un bloque `Coaching guidance:`. |
| `promptContext` | `string` | `null` | Cadena de contexto de la aplicación inyectada en el prompt del sistema (por ejemplo, "Descripciones de productos de comercio electrónico"). Ayuda al modelo a adaptar las traducciones a su dominio. |
| `jsonConcurrency` | `number` | `200` | Máximo de traducciones locales en paralelo para la sincronización de claves JSON. Se anula con la bandera de la CLI `--json-concurrency`. |
| `contentConcurrency` | `number` | `48` | Máximo de llamadas a la API en paralelo para la traducción de contenido (Markdown/MDX). Se anula con la bandera de la CLI `--content-concurrency`. |
| `fallbackPrefix` | `string` | `"[EN] "` | Prefijo marcador utilizado por `audit` y `verify` para detectar valores heredados no traducidos de ejecuciones anteriores. Champollion no escribe este prefijo, solo lo lee para su detección. |
| `apiKeyEnvVar` | `string` | `"OPENROUTER_API_KEY"` | Nombre de la variable de entorno para la clave de la API. Anúlelo para usar nombres de variables de entorno personalizados. |
| `minContentRetention` | `number` | `0.35` | Fracción de letras/dígitos del origen que debe conservar una salida antes de que la [verificación de eliminación de contenido](/docs/concepts/quality-gate) consulte su segunda señal. También se puede configurar por par y por idioma. |
| `noTranslate` | `string[]` | `[]` | Claves de ruta con puntos (dot-path) y patrones glob cuyo valor se copia a cada configuración regional (locale) de forma literal. Consulte [Claves sin traducción](#no-translate). También se acepta como `skipKeys`. |
| `noTranslateUrls` | `boolean` | `true` | Trata los valores de origen que son únicamente una URL `scheme://` como sin traducción. Establezca `false` para enviar las claves con valores de URL al backend de traducción. |
| `baseUrl` | `string` | `""` | URL base para la generación de artefactos SEO (hreflang, sitemaps, JSON-LD). |
| `pairs` | `object` | `{}` | Anulaciones de método, modelo y calidad por par. Consulte [Configuración de pares](#pair-configuration). |
| `languages` | `object` | `{}` | Anulaciones por idioma. Consulte [Configuración de idiomas](#language-configuration). |
| `lint.srcDir` | `string` | `null` | Directorio de origen para el escaneo de lint. `null` = detección automática desde el framework. |
| `lint.ignore` | `string[]` | `["node_modules", ...]` | Patrones glob a excluir del lint. |
| `lint.minLength` | `number` | `2` | Longitud mínima de la cadena para marcarla como codificada (hardcoded). |
| `seo.urlPattern` | `string` | `"/:locale/:path"` | Plantilla de patrón de URL para la generación de etiquetas hreflang. |
| `seo.pages` | `string[]` | `null` | Lista explícita de páginas para SEO. `null` = detección automática desde las claves de configuración regional (locale). |
| `typegen.output` | `string` | `null` | Ruta de salida para los tipos de TypeScript generados. `null` = deshabilitado. |
| `typegen.autoGenerate` | `boolean` | `false` | Regeneración automática de tipos después de cada sincronización. |

## Claves sin traducción {#no-translate}

Algunos valores tienen exactamente una representación correcta en todos los idiomas: una URL, una ruta de repositorio, un nombre de paquete, un identificador de producto. Una traducción correcta de `https://example.org/paper` es `https://example.org/paper`.

La [puerta de calidad](/docs/concepts/quality-gate) de Champollion rechaza el eco del origen (source-echo) —una traducción idéntica a su origen— porque normalmente se trata de un modelo que se niega a hacer el trabajo. Para estas claves, eso hace que la respuesta correcta sea la rechazada, y no hay ninguna salida que el modelo pueda producir que pase la verificación. Los modelos más débiles aprenden a evadir la puerta alterando el valor lo justo (un `#fragment` inventado, una barra diagonal final suelta, un espacio invisible de ancho cero), lo que genera enlaces rotos. Los modelos más fuertes devuelven el valor sin cambios y no pasan la puerta, por lo que `sync` sale con un código distinto de cero en cada ejecución.

En su lugar, declare esas claves:

```json title="champollion.config.json"
{
  "noTranslate": ["**.url", "pages.software.*.repo", "meta.appId"]
}
```

Una clave coincidente se **copia de la configuración regional de origen de forma literal**: nunca se envía a un backend de traducción, nunca pasa por la puerta de calidad, nunca se cuenta como un error y nunca se factura. Se excluye de la estimación de costos previa a la ejecución por la misma razón.

### Sintaxis de patrones

Los patrones son rutas con puntos (dot-paths) sobre el espacio de claves aplanado, con dos comodines:

| Patrón | Coincide con | No coincide con |
|---------|---------|----------------|
| `nav.brand` | `nav.brand` (ruta exacta) | `nav.brandName` |
| `**.url` | `url`, `pages.a.b.url` (una hoja `url` a cualquier profundidad) | `pages.urlLabel`, `pages.url.caption` |
| `pages.software.*.repo` | `pages.software.portal.repo` | `pages.software.a.b.repo` |
| `meta.og*` | `meta.ogImage`, `meta.ogTitle` | `meta.twitterImage`, `meta.og.image` |

`*` coincide dentro de un solo segmento; `**` coincide con cero o más segmentos completos. Un patrón sin comodines es una ruta de clave exacta.

### Las URL se manejan de forma predeterminada

Debido a que una clave con valor de URL no tiene un resultado correcto bajo la puerta de calidad, `noTranslateUrls` es `true` de forma predeterminada: cualquier valor de origen que sea únicamente una URL absoluta `scheme://` se trata como sin traducción sin necesidad de configuración.

La detección es deliberadamente estricta: todo el valor recortado (trimmed) debe ser la URL. La prosa que simplemente contiene un enlace (`"Read the paper at https://…"`) se sigue traduciendo normalmente.

Desactívelo con `"noTranslateUrls": false` si sus URL realmente son específicas de la configuración regional (por ejemplo, hosts de documentación por idioma); luego declare las que no lo son con `noTranslate`.

### Reparación y cumplimiento

Para una clave sin traducción hay exactamente un valor de destino correcto, por lo que cualquier diferencia es un defecto. Champollion hace cumplir esto en ambas direcciones:

- **`sync` lo repara.** Una clave sin traducción cuyo destino falta, tiene el prefijo `[EN] ` o está alterada, se reescribe desde el origen. Esto no cuesta ninguna llamada a la API y es idempotente: una vez que los valores coinciden, las sincronizaciones posteriores omiten la clave por completo.
- **`verify` y `integrity` fallan en ello.** Una clave sin traducción que se ha desviado se reporta como `NO-TRANSLATE DRIFT` con los valores esperado y real (los caracteres invisibles se escapan como `\uXXXX`, ya que esa clase de corrupción es de otra manera imposible de ver en un diff). `champollion integrity` sale con `1`, por lo que una compilación conectada a él detecta una URL corrupta antes de su publicación.

Si `integrity` falla de esta manera en un proyecto que acaba de configurar, está reportando daños que ya estaban en sus archivos locale. Ejecute `champollion sync` una vez para repararlo.

## Conversión de escritura {#script-conversion}

Algunos idiomas que traduce Champollion se pueden *escribir* de más de una manera. El modelo siempre funciona en el **sistema de escritura de trabajo** del idioma (romanización latina: SRO para el cree de las llanuras, romanización de Okrand para el klingon), y un convertidor determinista puede luego reescribir la salida en un sistema de escritura de visualización. Si debe hacerlo o no es una decisión que toma la configuración, **nunca es un valor predeterminado**:

| Configuración regional | Escritura de trabajo | Convertible a | Tipo |
|--------|---------------|----------------|------|
| `crk` (Cree de las llanuras) | `Latn` (SRO) | `Cans` (Silábico) | Unicode real — **elección requerida** |
| `sr` / `srp` (Serbio) | `Latn` | `Cyrl` (Cirílico) | Unicode real — **elección requerida** |
| `tlh` (Klingon) | `Latn` (romanización) | `Piqd` (pIqaD) | PUA — opcional (opt-in) |
| `x-elvish-s` (Sindarin) | `Latn` | `Teng` (Tengwar) | PUA — opcional (opt-in) |
| `x-kryptonian` | `Latn` | Kryptoniano | PUA — opcional (opt-in) vía `"script": "x-kryptonian"` |

**Los pares de Unicode real (crk, sr) requieren la elección.** El silábico cree y el cirílico son Unicode ordinario (se renderizan en todas partes) y ambas ortografías están en uso real. Champollion no elegirá el sistema de escritura de una comunidad en nombre de un proyecto: `init` pregunta cuando usted selecciona el idioma, y `sync` se niega a ejecutarse hasta que la configuración indique cuál:

```json
{
  "languages": {
    "crk": { "script": "Cans" }
  }
}
```

**Los sistemas de escritura PUA (tlh, x-elvish-s, x-kryptonian) tienen como valor predeterminado la romanización.** pIqaD, Tengwar y Kryptoniano *no están en Unicode*: los convertidores emiten puntos de código del Área de Uso Privado (PUA) que no se renderizan a menos que usted incluya una fuente mapeada a esos puntos de código. La romanización es la única salida que se renderiza en todas partes, por lo que es el valor predeterminado. Para emitir el sistema de escritura de visualización en su lugar:

```json
{
  "languages": {
    "tlh": { "script": "Piqd" }
  }
}
```

…y ejecute `champollion fonts install` para que su sitio tenga una fuente que pueda dibujarlo. Si sus fuentes están vinculadas a la transliteración latina (muchas fuentes de lenguas construidas lo están), mantenga el valor predeterminado.

`script` toma un código ISO 15924, sin importar mayúsculas o minúsculas (`"cans"`, `"Cans"` y `"CANS"` son lo mismo). También se puede configurar por par, lo cual prevalece sobre el nivel de idioma. Un valor no válido, o un sistema de escritura que la configuración regional no puede producir, falla al inicio, antes de cualquier llamada a la API.

### Letras no mapeadas y `scriptFallback` {#script-fallback}

Los convertidores traducen lo que define su ortografía y nada más. La romanización del klingon no tiene `d`, `c`, `f`, `g`, `i`, `k`, `s`, `x` ni `z`, por lo que la salida del modelo que contiene un nombre propio como "GitHub" no se puede convertir por completo. Champollion **nunca escribe un valor convertido a medias**: si alguna letra no se puede mapear, todo el valor permanece en el sistema de escritura de trabajo, y la advertencia nombra las letras junto con la línea de configuración que las mapearía.

Esos mapeos debe declararlos usted:

```json
{
  "languages": {
    "tlh": {
      "script": "Piqd",
      "scriptFallback": { "d": "D", "f": "p", "z": "S" }
    }
  }
}
```

Cada regla reemplaza una secuencia del sistema de escritura de trabajo con una que el convertidor *sí puede* mapear, antes de que se ejecute la conversión. Las reglas se validan al inicio: un reemplazo que en sí mismo no se puede mapear es rechazado.

Champollion **no incluye reglas de respaldo (fallback) propias**: inventar adaptaciones ortográficas, especialmente para el sistema de escritura de un idioma real, no es una decisión que deba tomar un índice. Las comunidades y los fandoms tienen convenciones: adóptelas deliberadamente, por proyecto.

### Reparación de conversiones no deseadas {#repair-script}

Antes de la versión 0.3.0, la conversión era incondicional: los proyectos dirigidos a las configuraciones regionales PUA obtenían una salida no renderizable, lo quisieran o no. Dos herramientas cierran el ciclo:

- **`champollion repair-script`** escanea las configuraciones regionales cuya configuración indica que la conversión está *desactivada* para los puntos de código PUA y restaura la romanización utilizando la propia tabla inversa del convertidor (`--dry` para previsualizar). pIqaD se invierte exactamente; las inversiones de Tengwar y Kryptoniano pierden las mayúsculas y lo advierten.
- **`champollion integrity`** falla (salida 1) si se encuentra PUA donde la conversión está desactivada, de modo que una puerta de compilación detecta el texto no renderizable antes de su publicación, y el reporte nombra la reparación.

La memoria de traducción nunca necesita reparación: almacena valores previos a la conversión, por lo que activar o desactivar `script:` más adelante no requiere trabajo de caché.

La conversión de escritura se aplica a las cadenas de la interfaz de usuario (archivos clave-valor y JSON de Docusaurus). Los cuerpos de Markdown nunca se convierten: un convertidor de caracteres codicioso (greedy) no tiene una forma segura de atravesar bloques de código, URL y frontmatter.

## Configuración de pares {#pair-configuration}

Cada par origen→destino puede configurarse de forma independiente:

```json
{
  "pairs": {
    "en:fr": {
      "method": "google-translate",
      "qualityTier": "high"
    },
    "en:ja": {
      "method": "llm",
      "model": "google/gemini-2.5-pro"
    },
    "en:crk": {
      "methodPlugin": "crk-coached-v1"
    }
  }
}
```

### Campos de pares

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `method` | `string` | Método de traducción: `llm`, `llm-coached`, `google-translate`, `deepl`, `microsoft-translator`, `libretranslate`, `openai`, `anthropic`, `gemini`, `api` |
| `methodPlugin` | `string` | Nombre de un complemento instalado (de `.champollion/methods/`) |
| `model` | `string` | Anule el modelo predeterminado para este par |
| `temperature` | `number` | Anule la temperatura predeterminada para este par |
| `batchSize` | `number` | Anule el tamaño de lote predeterminado para este par |
| `register` | `string` | Anulación de registro/tono (clave preestablecida o texto de forma libre) |
| `endpoint` | `string` | URL de punto final de API remota. Requerido cuando `method` es `api`. |
| `coachingFile` | `string` | Ruta a un archivo de indicación de entrenamiento para este par |
| `promptContext` | `string` | Contexto de aplicación para este par |
| `qualityTier` | `string` | Nivel de visualización: `standard`, `high`, `research`, `verified` |

## Configuración de idioma {#language-configuration}

Los idiomas aceptan tres formatos:

### Matriz de códigos (más simple)

```json
{
  "languages": ["fr", "de", "ja"]
}
```

Cada idioma obtiene su registro predeterminado de la tabla de registro integrada. Los idiomas sin un predeterminado obtienen `"Professional register."`.

### Objeto con cadenas de registro

El valor puede ser una **clave preestablecida** de la tarjeta del idioma, o texto de registro personalizado:

```json
{
  "languages": {
    "fr": "casual-tu",
    "ko": "formal-hapsyo",
    "ja": "Custom: Polite Japanese for a gaming app."
  }
}
```

Champollion verifica si la cadena coincide con una clave preestablecida en la tarjeta de idioma. Si es así, se utiliza el indicador de registro completo de la tarjeta. Si no, la cadena se utiliza tal cual. Consulte [Idiomas admitidos](/docs/reference/supported-languages#language-cards) para ver los preestablecidos disponibles.

### Objeto con configuración completa

```json
{
  "languages": {
    "crk": {
      "name": "Plains Cree",
      "register": "SRO syllabics with grammatical precision.",
      "model": "google/gemini-2.5-pro",
      "batchSize": 5,
      "maxRetries": 5,
      "script": "Cans"
    }
  }
}
```

Puede mezclar objetos abreviados y completos en el mismo bloque.

### Campos de idioma

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `register` | `string` | Instrucciones de estilo/tono. Puede ser una **clave preestablecida** (por ejemplo, `casual-tu`, `formal-hapsyo`) o texto personalizado. Consulte [Tarjetas de idioma](/docs/reference/supported-languages#language-cards). |
| `name` | `string` | Nombre del idioma legible por humanos (para la visualización del estado) |
| `model` | `string` | Anula el modelo predeterminado |
| `temperature` | `number` | Anula la temperatura predeterminada |
| `batchSize` | `number` | Anula el tamaño de lote predeterminado |
| `coachingFile` | `string` | Ruta a un archivo de prompt de entrenamiento para este idioma |
| `promptContext` | `string` | Contexto de la aplicación para este idioma |
| `maxRetries` | `number` | Presupuesto máximo de reintentos para lotes fallidos (predeterminado: 3) |
| `script` | `string` | Código ISO 15924 de la ortografía que escribe Champollion (por ejemplo, `"Cans"`, `"Piqd"`). Consulte [Conversión de escritura](#script-conversion). |
| `scriptFallback` | `object` | Reglas de transliteración para las letras que el convertidor de escritura no puede mapear. Consulte [Conversión de escritura](#script-conversion). |

:::info[Cadena de herencia]
La configuración se resuelve en este orden (el primero gana):

**nivel de par** → **nivel de idioma** → **configuración global** → **valores predeterminados**

Por ejemplo, si `pairs["en:fr"]` establece `model`, anula tanto el nivel de idioma como los valores globales de `model`.
:::

## Origen que no es inglés

Si su idioma de origen no es inglés:

```bash
# CLI flag (one-time)
npx champollion sync --source fr
```

```json title="champollion.config.json (permanent)"
{
  "inputLocale": "fr"
}
```

## Archivo de bloqueo

Champollion crea `.champollion.lock` para rastrear hashes SHA-256 de valores de origen traducidos. **Confirme este archivo** para que todos los desarrolladores compartan la misma línea de base de traducción.

Cuando cambia un valor de origen, el hash ya no coincide, y champollion retraduce esa clave en la siguiente sincronización.

## `.champollionignore`

Cree `.champollionignore` en la raíz de su proyecto para excluir archivos del escaneo de `lint`. Utiliza patrones glob, como `.gitignore`:

```text title=".champollionignore"
src/components/legacy/**
src/utils/constants.js
**/*.test.js
```

## Directorio `.champollion/`

Champollion crea un directorio `.champollion/` en la raíz de su proyecto para estado interno. Generalmente debe **agregar esto a `.gitignore`** — es optimización local, no fuente del proyecto:

```gitignore
.champollion/
```

| Archivo | Propósito | ¿Confirmar? |
|------|---------|--------|
| `tm.json` | Caché de Memoria de Traducción — almacena traducciones anteriores indexadas por texto de origen + configuración regional + método | No (caché local) |
| `xliff/*.xliff` | Archivos de exportación XLIFF para revisión de traductor profesional | No (transitorio) |
| `methods/` | Manifiestos de complementos de método instalados | Sí (configuración compartida) |
| `backups/` | Copias de seguridad previas al ajuste (creadas por `wrap --undo`) | No (red de seguridad) |

Consulte [Memoria de Traducción](/docs/concepts/translation-memory) para obtener detalles sobre `tm.json` y cómo ahorra costos de API.

---

## API programática

Para scripts de compilación e integraciones personalizadas, importe directamente desde el paquete:

```javascript
import { GeminiMethod, runSync, resolveConfig } from 'champollion';

// Use a method class directly
const gemini = new GeminiMethod();
const result = await gemini.translate(
  ['greeting', 'farewell'],
  { greeting: 'Hello', farewell: 'Goodbye' },
  { target: 'fr', name: 'French', register: 'formal', model: 'gemini-2.5-flash' },
  { cwd: process.cwd() }
);
// result = { greeting: 'Bonjour', farewell: 'Au revoir' }
```

### Exportaciones disponibles

| Exportación | Qué hace |
|--------|-------------|
| `TranslationMethod` | Clase base para todos los métodos |
| `LLMMethod` | Clase base para métodos LLM (OpenRouter) |
| `DirectLLMMethod` | Clase base para proveedores LLM directos (OpenAI, Anthropic, Gemini) |
| `OpenAIMethod`, `AnthropicMethod`, `GeminiMethod` | Clases de proveedores LLM directos |
| `DeepLMethod`, `MicrosoftTranslatorMethod`, `LibreTranslateMethod`, `TildeMethod`, `TranslatedMethod` | Clases de MT tradicionales |
| `GoogleTranslateMethod` | Traducción de Google Cloud |
| `LLMCoachedMethod` | LLM entrenado (OpenRouter + datos de entrenamiento) |
| `APIMethod` | Cliente de API remota |
| `runSync`, `runContentSync` | Canalización de sincronización completa |
| `resolveConfig`, `resolvePairs` | Resolución de configuración |
| `validateTranslations` | Puerta de calidad |
| `loadCoachingData`, `findDictionaryMatches` | Utilidades de entrenamiento |

### Extensión de proveedor personalizado

Extienda `DirectLLMMethod` para agregar un nuevo proveedor LLM en ~40 líneas:

```javascript
import { DirectLLMMethod } from 'champollion';

class MistralMethod extends DirectLLMMethod {
  constructor(options) {
    super(options);
    this.name = 'mistral';
  }
  _getApiKeyEnvVar()     { return 'MISTRAL_API_KEY'; }
  _getApiKeyOptionsKey() { return 'mistralApiKey'; }
  _getDefaultModel()     { return 'mistral-large-latest'; }
  _getProviderLabel()    { return 'Mistral'; }

  _buildApiRequest({ prompt, systemMessage, apiKey, model, temperature }) {
    return {
      url: 'https://api.mistral.ai/v1/chat/completions',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: {
        model,
        messages: [
          ...(systemMessage ? [{ role: 'system', content: systemMessage }] : []),
          { role: 'user', content: prompt },
        ],
        temperature,
      },
    };
  }

  _extractResponseText(json) {
    return json.choices?.[0]?.message?.content;
  }

  // Optional but recommended: provider-specific setup help when translation fails
  getSetupHelp() {
    if (!process.env.MISTRAL_API_KEY) {
      return [
        '',
        '  ┌─ Missing API Key ─────────────────────────────────────────────┐',
        '  │ Mistral requires an API key from https://console.mistral.ai   │',
        '  │ Run: export MISTRAL_API_KEY=...                               │',
        '  └────────────────────────────────────────────────────────────────┘',
      ];
    }
    return ['        API key is set but translation failed. Check your Mistral dashboard.'];
  }
}
```

Obtiene traducción, entrenamiento, bucles de reintento, validación de modelo, niveles de calidad y ayuda de configuración de forma gratuita. Solo la forma de solicitud HTTP es específica del proveedor. Para adaptadores que no son LLM que utilizan `fetch()` sin procesar, utilice el asistente compartido `fetchWithRetry()` de `lib/methods/fetch-with-retry.js` en lugar de escribir su propio bucle de reintento.

---

## Consulte también

- [Referencia CLI](/docs/reference/cli) — todos los comandos y banderas
- [Métodos de traducción](/docs/guides/translation-methods) — elegir y mezclar métodos
- [Memoria de Traducción](/docs/concepts/translation-memory) — almacenamiento en caché y ahorro de costos
- [Trabajar con traductores profesionales](/docs/guides/professional-translators) — flujo de trabajo XLIFF
- [Especificación de complementos](/docs/reference/plugin-spec) — formato de manifiesto de complemento de método
- [Arquitectura](/docs/concepts/architecture) — cómo se conectan las piezas
- [Idiomas admitidos](/docs/reference/supported-languages) — soporte de idioma integrado
- [Cómo funciona la sincronización](/docs/concepts/how-sync-works) — la canalización de traducción
