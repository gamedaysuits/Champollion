---
sidebar_position: 1
title: "Métodos de Traducción"
related:
  - label: "Comparison"
    to: /docs/guides/comparison
    kind: guide
  - label: "Serving a Custom Method as an API"
    to: /docs/guides/serving-a-method
    kind: guide
    note: "Wrap a pipeline as an HTTP method"
  - label: "Quality Gate"
    to: /docs/concepts/quality-gate
    kind: concept
  - label: "Live Leaderboard"
    to: /leaderboard
    kind: leaderboard
    note: "How the methods score in the open"
  - label: "Method Interface"
    to: /docs/network/specifications/methods
    kind: arena
    note: "The spec a benchmarked method implements"
---

# Métodos de Traducción

Champollion admite múltiples métodos de traducción. Cada par de idiomas puede utilizar un método diferente; no está limitado a un único enfoque para todo su proyecto.

## Comparación de Métodos

### Proveedores LLM

Enfocados en calidad, conscientes de Markdown, compatibles con coaching. Ideal para proyectos con mucho contenido.

| Método | Clave | Qué hace |
|--------|-------|----------|
| `llm` (predeterminado) | `OPENROUTER_API_KEY` | LLM a través de OpenRouter: más de 200 modelos, enrutamiento automático |
| `llm-coached` | `OPENROUTER_API_KEY` | LLM + reglas gramaticales, diccionarios, notas de estilo |
| `openai` | `OPENAI_API_KEY` | API directa de OpenAI (gpt-4o, gpt-4o-mini) |
| `anthropic` | `ANTHROPIC_API_KEY` | API directa de Anthropic (Claude Sonnet, Haiku, Opus) |
| `gemini` | `GEMINI_API_KEY` | API directa de Google Gemini (Flash, Pro): nivel gratuito |
| `local` | *(ninguno)* | Un modelo en su propia máquina o servidor: Ollama, vLLM, LM Studio, llama.cpp o un modelo que haya entrenado con `nmt-forge`. El texto nunca sale de su infraestructura |

### Traducción Automática Tradicional

Enfocada en velocidad y costo. Ideal para pares clave-valor de alto volumen.

| Método | Clave | Qué hace |
|--------|-------|----------|
| `google-translate` | `GOOGLE_TRANSLATE_API_KEY` | Google Cloud Translation API v2 (194 idiomas) |
| `deepl` | `DEEPL_API_KEY` | API de DeepL con soporte para glosarios (33 idiomas) |
| `microsoft-translator` | `MICROSOFT_TRANSLATOR_API_KEY` | Azure Cognitive Services Translator (135 idiomas) |
| `libretranslate` | *(autohospedado)* | LibreTranslate autohospedado (AGPL, gratuito) |
| `tilde` | `TILDE_API_KEY` | Tilde MT: motores desarrollados en la UE, sólidos en idiomas bálticos y europeos |
| `translated` | `LARA_ACCESS_KEY_ID` + `LARA_ACCESS_KEY_SECRET` | Lara de Translated: traducción automática adaptativa profesional (200 idiomas) |

### Infraestructura

| Método | Clave | Qué Hace |
|--------|-------|---------|
| `api` | *(por proveedor)* | Cliente HTTP delgado para cualquier punto final de traducción REST |

## Árbol de Decisión

```mermaid
flowchart TD
    A["What are you translating?"] --> B{"Markdown content?"}
    B -->|Yes| C["Use llm, openai, anthropic, or gemini"]
    B -->|No| D{"Need cost control?"}
    D -->|Budget matters| E{"Self-hosted option?"}
    D -->|Quality matters| F{"Need coaching data?"}
    E -->|Yes| G["Use libretranslate"]
    E -->|No| H["Use deepl or google-translate"]
    F -->|Yes| I["Use llm-coached"]
    F -->|No| C
```

---

## `llm` — Traducción LLM (Predeterminada)

Traduce a través de cualquier LLM en [OpenRouter](https://openrouter.ai). Este es el método predeterminado y el más versátil.

**Cómo funciona:**
1. Agrupa claves (80 por lote de forma predeterminada) con instrucciones de registro y contexto
2. Envía a OpenRouter como un mensaje estructurado
3. Analiza la respuesta JSON
4. Valida cada traducción a través de la [puerta de calidad](/docs/concepts/quality-gate)
5. Escribe las traducciones aprobadas, reintenta o rechaza los fallos

**Cuándo usarlo:** La mayoría de proyectos. Especialmente sitios con mucho contenido y Markdown, donde los bloques de código y shortcodes necesitan protección.

**Configuración:**

```json
{
  "defaultMethod": "llm",
  "model": "google/gemini-3.8-flash"
}
```

## `llm-coached` — Traducción LLM con Coaching

Igual que `llm`, pero con reglas gramaticales, diccionarios de términos y notas de estilo inyectadas en cada mensaje.

**Cómo funciona:**
1. Carga datos de coaching desde `.champollion/coaching/<locale>.json` o el directorio `coaching/` de un plugin
2. Inyecta reglas gramaticales, términos de diccionario y notas de estilo en el mensaje del sistema
3. Los términos del diccionario que coinciden con claves de origen se incluyen como terminología requerida
4. La traducción procede como con `llm`, con datos de coaching añadiendo precisión

**Cuándo usarlo:** Idiomas de recursos limitados, terminología específica del dominio (legal, médica), registros formales, o cualquier caso donde la salida genérica del LLM no sea lo suficientemente precisa.

**Formato de datos de coaching:**

```json title=".champollion/coaching/fr.json"
{
  "grammar_rules": [
    "French adjectives agree in gender and number with the noun they modify",
    "Use 'vous' for formal contexts, 'tu' for informal"
  ],
  "dictionary": {
    "dashboard": "tableau de bord",
    "deployment": "déploiement",
    "settings": "paramètres"
  },
  "style_notes": "Prefer active voice. Avoid anglicisms where a native French term exists."
}
```

Véase también: [Guía de Idiomas de Recursos Limitados](/docs/network/community/low-resource-languages)

---

## `openai` — API de OpenAI Directo

Traduce directamente a través de la API de Chat Completions de OpenAI. Sin intermediario de OpenRouter — su clave, su cuenta, su panel de control de uso.

**Modelos:** `gpt-5.4-mini-2026-03-17` (predeterminado — una instantánea con fecha), o cualquier id de modelo exacto que liste OpenAI

**Características:**
- ✅ Compatible con Markdown (traducción de contenido)
- ✅ El mismo prompt que `llm`: registro, pautas de género, contexto del prompt, términos protegidos, pautas de `coachingFile` y los términos del glosario de cada lote ([ver más abajo](#one-prompt-every-llm-method))
- ✅ Modo JSON para salida estructurada clave-valor
- ✅ Retroceso exponencial con reintentos

**Configuración:**

```json
{
  "pairs": {
    "en:fr": { "method": "openai", "model": "gpt-4o-mini" }
  }
}
```

```bash
export OPENAI_API_KEY=sk-proj-...
```

Obtenga su clave en [platform.openai.com/api-keys](https://platform.openai.com/api-keys).

## `local` — Su propio modelo (Ollama, vLLM, LM Studio, un modelo entrenado)

Traduce con cualquier modelo detrás de un endpoint **compatible con OpenAI** que
usted ejecute: Ollama, vLLM, LM Studio, el servidor de llama.cpp o un modelo que haya entrenado con
`nmt-forge`. No se necesita clave de API y ningún texto se envía a terceros. Este es
el método indicado para texto confidencial y el que permite desplegar un modelo creado por
usted mismo.

```json
{ "defaultMethod": "local", "model": "llama3.1" }
```

```bash
# Optional: only if your server is not at Ollama's default address
export LOCAL_API_BASE=http://localhost:11434/v1
npx champollion sync --method local
```

El endpoint se lee, en orden, desde: `LOCAL_API_BASE`, `OPENAI_API_BASE`,
`OPENAI_BASE_URL` y luego el valor predeterminado de Ollama, `http://localhost:11434/v1`. Cuando el
endpoint está en esta máquina (`localhost`, `127.0.0.1`, `::1`), el costo se
muestra como **$0 API cost (runs on this machine)** —no hay factura de API; su
propio hardware y consumo de energía no se contabilizan— y `--max-cost` permite que la ejecución
continúe. Cualquier otro endpoint (Groq, Together, un servidor en su red) se
reporta como **unknown**, nunca $0, porque la herramienta no puede saber cuánto
cobra, por lo que `--max-cost` lo rechaza en lugar de adivinar. En `--json`, la
fila de estimación muestra `"estimatedCost": 0, "local": true` para el primer caso
y `"estimatedCost": null` para el segundo. (Un proxy en esta máquina que
reenvíe a una API de pago —LiteLLM, una pasarela— se factura en el origen, lo cual
Champollion no puede detectar: presupuéstelo allí).

Antes de traducir, sync verifica que un servidor responda en el endpoint. Si
ninguno responde, una ejecución que fuera a enviarle datos se detiene antes de enviar nada
(código de salida `1`), indicando la dirección. Una ejecución que no le envía nada —no hay nada en
cola, o cada clave en cola proviene de la caché, como al rehacer texto
ya traducido— advierte que el servidor está caído y continúa. En un ejecutor de CI
(con `CI` o `GITHUB_ACTIONS` configurados), un servidor que no responde detiene cualquier ejecución, incluso una
sin nada en cola, de modo que un flujo de trabajo que todavía usa `local` falle en su primer
push en lugar de fallar cuando cambie una cadena ([guía de CI](/docs/guides/ci-cd)).

El método `openai` acepta la misma invalidación de `OPENAI_API_BASE` / `OPENAI_BASE_URL`
para conectarse a cualquier proveedor compatible con OpenAI (Groq, Together, …) mediante una
clave.

## `anthropic` — API de Anthropic Directo

Traduce directamente a través de la Messages API de Anthropic. Las instrucciones van en el parámetro `system`, lo que habilita el almacenamiento en caché de prompts de Anthropic.

**Modelos:** `claude-sonnet-4-6` (predeterminado), `claude-haiku-4-5`, `claude-opus-4-7`

**Características:**
- ✅ Compatible con Markdown (traducción de contenido)
- ✅ El mismo prompt que `llm`: registro, pautas de género, contexto del prompt, términos protegidos, pautas de `coachingFile` y los términos del glosario de cada lote ([ver más abajo](#one-prompt-every-llm-method))
- ✅ Almacenamiento en caché del prompt del sistema (amortiza las instrucciones entre lotes)
- ✅ Retroceso exponencial con reintentos

**Configuración:**

```json
{
  "pairs": {
    "en:ja": { "method": "anthropic", "model": "claude-haiku-4-5" }
  }
}
```

```bash
export ANTHROPIC_API_KEY=sk-ant-...
```

Obtenga su clave en [console.anthropic.com](https://console.anthropic.com/settings/keys).

## `gemini` — API de Google Gemini Directo

Traduce directamente a través de la API `generateContent` de Google Gemini. **Nivel gratuito disponible** — el mejor punto de partida sin costo.

**Modelos:** `gemini-3.8-flash` (predeterminado), o cualquier id de modelo exacto que liste Google

**Características:**
- ✅ Compatible con Markdown (traducción de contenido)
- ✅ El mismo prompt que `llm`: registro, pautas de género, contexto del prompt, términos protegidos, pautas de `coachingFile` y los términos del glosario de cada lote ([ver más abajo](#one-prompt-every-llm-method))
- ✅ Modo de respuesta JSON mediante `responseMimeType`
- ✅ Nivel gratuito (cuota diaria generosa)
- ✅ Retroceso exponencial con reintentos

**Configuración:**

```json
{
  "pairs": {
    "en:ko": { "method": "gemini", "model": "gemini-2.5-pro" }
  }
}
```

```bash
export GEMINI_API_KEY=AI...
```

Obtenga su clave en [aistudio.google.com/apikey](https://aistudio.google.com/apikey).

### Un solo prompt, todos los métodos LLM {#one-prompt-every-llm-method}

`llm`, `openai`, `anthropic`, `gemini` y `local` envían las mismas instrucciones
para el mismo proyecto; solo varía el destino de la solicitud. El mensaje del sistema
incluye el registro, las pautas de género del idioma, su texto de `promptContext`,
`protectedTerms` y `coachingFile`; el mensaje de cada lote
incluye los términos del glosario que contiene (la sección `dictionary` en
`.champollion/coaching/<locale>.json`), las instrucciones específicas de cada clave (formas
plurales, contexto de gettext, descripciones) y las cadenas. Compruébelo usted mismo; no se
envía nada:

```bash
npx champollion sync --dry --method local --show-prompt
```

Las reglas gramaticales y notas de estilo del archivo de coaching son leídas por `llm-coached`,
en cualquier proveedor: `{ "method": "llm-coached", "provider": "openai" }`.

### Nombres de modelos {#model-names}

A un proveedor directo se le envía su propio nombre para un modelo. Un id al estilo de OpenRouter
se mapea cuando el proveedor tiene ese modelo: `openai/gpt-5.5` → `gpt-5.5` en `openai`,
`anthropic/claude-haiku-4.5` → `claude-haiku-4-5` en `anthropic`,
`google/gemini-3.8-flash` → `gemini-3.8-flash` en `gemini`. Un id para el cual el proveedor
no tenga ningún modelo detiene la ejecución antes de que se envíe nada:

```
[ERR] sync failed: en:fr: model "google/gemini-3.8-flash" (from the top-level "model") is an OpenRouter model id
      — openai calls OpenAI directly, which has no model by that name. Use an OpenAI model (e.g. --model gpt-4o),
      --method gemini (its name for it: "gemini-3.8-flash") or --method llm to run it through OpenRouter.
```

`local`, y `openai` apuntando a otro servidor con `OPENAI_API_BASE`, envían
el nombre tal como lo escribió; ese servidor decide qué significa.

### Solo slugs exactos {#exact-slugs}

Cada modelo se designa por su slug exacto, en cada método: `google/gemini-3.8-flash`
en OpenRouter, el nombre exacto propio de un proveedor directo (`gpt-5.5`) en `openai`. Ningún
nombre corto se resuelve a un modelo, y un id flotante (los id de enrutador `~vendor/…`
de OpenRouter, cualquier nombre `…-latest` o `:latest`) también se rechaza: designa
a cualquier modelo al que el proveedor apunte hoy, por lo que una ejecución no podría indicar qué
modelo tradujo. Cualquiera de los dos detiene la ejecución antes de que se envíe nada:

```
[ERR] sync failed: "gemini-flash" (from --model) is not a model id — Champollion takes exact model slugs only,
      no aliases. Did you mean google/gemini-3.8-flash (what "gemini-flash" used to stand for)? List models:
      https://openrouter.ai/models (OpenRouter slugs), or champollion models --method <gemini|openai|anthropic>
      (a direct provider's own names).
```

### Validación de Modelo {#model-validation}

Los proveedores directos de LLM (`openai`, `anthropic`, `gemini`) también verifican el nombre de su modelo en el primer uso (no cuando se comunican con otro servidor a través de `OPENAI_API_BASE`). Esto detecta dos categorías de errores:

**Proveedor incorrecto** — Usar un modelo de un proveedor completamente diferente:

```
[WARN] Gemini: model "claude-sonnet-4-6" is an Anthropic model.
       This provider (gemini) cannot serve Anthropic models.
       Use --method anthropic or set "method": "anthropic" in config.
```

**Modelo obsoleto o mal escrito** — En la primera llamada a la API, champollion obtiene la lista de modelos en vivo del proveedor y verifica su modelo:

```
[WARN] Gemini: model "gemini-1.5-flash" not found in available models.
       Similar models: gemini-2.0-flash, gemini-2.5-flash, gemini-2.5-pro
       The API call will proceed — the provider will give the final verdict.
```

:::note[Estos son avisos, no errores]
La validación del modelo registra avisos pero no bloquea la llamada a la API. El proveedor de API da el veredicto final — un nombre de modelo futuro podría coincidir con un patrón diferente, y no queremos depender de heurísticas.
:::

---

## `google-translate` — API de Google Cloud Translation

Integración directa con la API de Google Cloud Translation v2. Utiliza la API REST — sin SDK, sin cuenta de servicio. Solo la clave de API.

**Cuándo usarlo:** Pares de cadenas clave-valor de gran volumen donde la velocidad y el costo importan más que los matices. Admite 194 idiomas de forma predeterminada ([lista publicada de Google](https://docs.cloud.google.com/translate/docs/languages)).

**Limitaciones:**
- ⚠️ **Sin conciencia de Markdown.** Corromperá bloques de código, shortcodes y variables de interpolación.
- Sin control de registro/tono
- Sin coaching o aplicación de terminología

```bash
npx champollion sync --method google-translate
```

:::tip[Detección automática]
Si solo `GOOGLE_TRANSLATE_API_KEY` está configurado (sin clave de OpenRouter), champollion cambia automáticamente a Google Translate. No se requiere cambio de configuración.
:::

## `deepl` — API de DeepL

Integración directa con la API de traducción de DeepL. Admite glosarios para terminología consistente.

**Cuándo usarlo:** Idiomas europeos donde DeepL destaca (alemán, francés, español, holandés, polaco, etc.). El soporte de glosario aplica terminología consistente sin datos de coaching.

**Características:**
- ✅ Detección automática de punto final gratuito/pro (sufijo `:fx` en claves gratuitas)
- ✅ Creación y gestión de glosarios
- ✅ Control de nivel de formalidad
- ⚠️ **Sin conciencia de Markdown** — solo pares clave-valor

**Configuración:**

```json
{
  "pairs": {
    "en:de": { "method": "deepl" }
  }
}
```

```bash
export DEEPL_API_KEY=your-key-here
```

Obtenga su clave en [deepl.com/pro-api](https://www.deepl.com/pro-api).

## `microsoft-translator` — Azure Cognitive Services

Integración directa con la API de Translator Text v3 de Microsoft.

**Cuándo usarlo:** Entornos empresariales con infraestructura existente de Azure. Admite 135 idiomas, incluidos algunos que Google Translate no cubre (tibetano, feroés, inuktitut y otros).

**Características:**
- ✅ Hasta 100 segmentos por solicitud (alto rendimiento)
- ✅ Parámetro de región opcional para optimización de latencia
- ⚠️ **Sin conciencia de Markdown** — solo pares clave-valor
- ⚠️ **Sin traducción de contenido** — solo pares clave-valor

**Configuración:**

```json
{
  "pairs": {
    "en:ar": { "method": "microsoft-translator" }
  }
}
```

```bash
export MICROSOFT_TRANSLATOR_API_KEY=your-key
export MICROSOFT_TRANSLATOR_REGION=global  # optional
```

Obtenga su clave del [Portal de Azure](https://portal.azure.com) → Cognitive Services → Translator.

## `libretranslate` — Traducción Autohospedada

Traducción de código abierto autohospedada usando LibreTranslate. Se ejecuta localmente o en su propia infraestructura — cero costos de API, soberanía total de datos.

**Cuándo usarlo:** Proyectos que requieren traducción sin conexión, cumplimiento de privacidad de datos (GDPR), u operación sin costo. Especialmente útil para canalizaciones de CI que no deberían depender de APIs externas.

**Características:**
- ✅ Autohospedado — sin llamadas a API externas
- ✅ Gratuito y de código abierto (AGPL-3.0)
- ✅ Implementación Docker disponible
- ⚠️ **Sin conciencia de Markdown** — solo pares clave-valor
- ⚠️ **Sin traducción de contenido** — solo pares clave-valor
- ⚠️ La calidad varía según el par de idiomas

**Configuración:**

```bash
# Run LibreTranslate locally with Docker
docker run -d -p 5000:5000 libretranslate/libretranslate

# Configure (optional — defaults to localhost:5000)
export LIBRETRANSLATE_API_URL=http://localhost:5000/translate
```

```json
{
  "pairs": {
    "en:es": { "method": "libretranslate" }
  }
}
```

---

## `api` — API de Traducción Remota

Un cliente HTTP delgado para puntos finales de traducción autohospedados en la comunidad o protegidos por IP. Champollion envía claves y recibe traducciones — contiene cero lógica de traducción.

**Cuándo usarlo:** Cuando los métodos de traducción se alojan en el servidor (p. ej., datos de coaching propietarios, modelos ajustados, canalizaciones FST que no se pueden distribuir).

```json
{
  "pairs": {
    "en:crk": {
      "method": "api",
      "endpoint": "https://api.example.com/v1/translate",
      "apiKey": "your-key"
    }
  }
}
```

:::note[Traducción controlada por la comunidad (aspirante a soberanía)]
El método `api` es el puente hacia la **traducción alojada por la comunidad bajo control comunitario (aspirante a soberanía)**. Las comunidades de idiomas indígenas y minoritarios pueden alojar sus propios endpoints de traducción (manteniendo los datos de coaching, los modelos ajustados y la propiedad intelectual lingüística bajo control comunitario), mientras Champollion se conecta a ellos como un cliente ligero.

Véase [Apoyar un Idioma de Recursos Limitados](/docs/network/community/low-resource-languages) para el recorrido completo de autohospedaje comunitario, y [Servir un Método vía API](/docs/guides/serving-a-method) para los requisitos del punto final.
:::

---

## Configuración por Par

El verdadero poder está en mezclar métodos por par de idiomas:

```json title="champollion.config.json"
{
  "version": 3,
  "pairs": {
    "en:fr": { "method": "deepl" },
    "en:ja": { "method": "openai", "model": "gpt-4o" },
    "en:ko": { "method": "gemini" },
    "en:ar": { "method": "microsoft-translator" },
    "en:crk": { "method": "llm-coached" }
  }
}
```

Esto traduce francés a través de DeepL (soporte para glosarios), japonés a través de OpenAI (calidad), coreano a través de Gemini (nivel gratuito), árabe a través de Microsoft Translator (cobertura) y cree de las llanuras a través del método LLM con coaching, con notas gramaticales y un diccionario que usted proporcione.

## Fallback: un segundo método para un par {#fallback}

Rara vez un solo método puede resolverlo todo. Un modelo pequeño que usted mismo haya entrenado puede traducir bien la mayoría de las oraciones y, aun así, omitir marcadores de posición `{name}`, romper los plurales o convertir "Home" en una oración completa. Asígnele al par un `fallback`:

```json title="champollion.config.json"
{
  "pairs": {
    "en:crk": {
      "method": "api",
      "endpoint": "http://127.0.0.1:8378/translate",
      "fallback": { "method": "llm-coached", "model": "google/gemini-3.8-flash" }
    }
  }
}
```

Cuando nada deba salir de sus máquinas, use en su lugar como respaldo un modelo que usted mismo ejecute: `"fallback": { "method": "local", "model": "<your local model>" }` (un servidor compatible con OpenAI en esta máquina; [`local`](#local--your-own-model-ollama-vllm-lm-studio-a-trained-model)). Por lo general, un modelo alojado externamente es una segunda opinión más sólida y se factura por solicitud; `local` mantiene el texto de forma local con un costo de API de $0.

Su modelo traduce primero. Las claves que el control de calidad (quality gate) rechaza y los bloques de Markdown que omite o daña se envían al fallback una vez y pasan por el mismo control. Todo lo que ninguno de los dos métodos pueda traducir permanece sin traducir, tal como ocurriría sin un fallback. `sync` imprime una línea de `[FALLBACK]` por cada par indicando cuántos elementos fueron al fallback y cuántos corrigió. `--method` y `--model` modifican el método propio del par, nunca el fallback. Con `--max-cost`, cada lote del fallback se cotiza antes de ejecutarse y se omite si superara el límite máximo. Detalles: [Método fallback](/docs/getting-started/configuration#fallback).

## Plugins

Los plugins son recetas de traducción preempaquetadas para pares de idiomas específicos. Son manifiestos JSON — no código — que le dicen a champollion qué método usar, con qué configuración y qué calidad se ha evaluado.

:::tip[Del arnés de evaluación a producción en un comando]
Los complementos desarrollados y probados en el [arnés de evaluación](/docs/network/specifications/harness) se pueden instalar directamente — el método que valida allí se implementa aquí con un único comando `plugin install`. Consulte [Evaluación de MT](/docs/network/leaderboard/rules) para el flujo de trabajo de evaluación completo.
:::

```bash
champollion plugin install ./french-formal-v1/
champollion plugin list
champollion plugin remove french-formal-v1
```

Véase la [Especificación de Plugin](/docs/reference/plugin-spec) para el formato de manifiesto completo.

---

## Cambiar Proveedores

¿Se está moviendo entre métodos? El formato del modelo y la variable de entorno cambian — aquí está el mapa:

### OpenRouter → Proveedor Directo

```diff title="champollion.config.json"
 {
   "pairs": {
     "en:fr": {
-      "method": "llm",
-      "model": "openai/gpt-4o"
+      "method": "openai",
+      "model": "gpt-4o"
     }
   }
 }
```

```diff title="Environment variables"
- export OPENROUTER_API_KEY=sk-or-v1-...
+ export OPENAI_API_KEY=sk-proj-...
```

**Diferencias clave:**
- OpenRouter usa formato `provider/model` (p. ej., `openai/gpt-4o`). Los proveedores directos usan nombres de modelo simples (p. ej., `gpt-4o`).
- Cada proveedor directo tiene su propia variable de entorno (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`).
- Si usa el formato de modelo incorrecto, champollion le advertirá — véase [Validación de Modelo](#model-validation).

### Proveedor Directo → OpenRouter

```diff title="champollion.config.json"
 {
   "pairs": {
     "en:ja": {
-      "method": "anthropic",
-      "model": "claude-sonnet-4-6"
+      "method": "llm",
+      "model": "anthropic/claude-sonnet-4.6"
     }
   }
 }
```

:::tip[Cuándo usar OpenRouter vs Directo]
**Use OpenRouter** cuando desee cambiar entre modelos sin modificar variables de entorno, o cuando desee acceso a más de 200 modelos desde una única clave. **Use proveedores directos** cuando desee facturación más simple, latencia más baja (sin intermediario), o acceso a características específicas del proveedor como el almacenamiento en caché de indicaciones de Anthropic.
:::

---

## Comparación de Costos

Costo aproximado por 1.000 claves traducidas (asume ~10 tokens por clave, 80 claves por lote):

| Método | Costo / 1K Claves | Velocidad | Calidad | Ideal Para |
|--------|-------------------|-----------|---------|-----------|
| `gemini` (Flash) | **Gratuito** (dentro del nivel) | Rápido | Bueno | Comenzar, proyectos personales |
| `google-translate` | ~$0.02 | Más rápido | Adecuado | Alto volumen, idiomas europeos |
| `deepl` | ~$0.02 | Rápido | Bueno | Idiomas europeos, terminología |
| `microsoft-translator` | ~$0.01 | Rápido | Adecuado | Tiendas Azure, cobertura amplia de idiomas |
| `libretranslate` | **Gratuito** (autohospedado) | Varía | Justo | Aislado, GDPR, canalizaciones de CI |
| `gemini` (Pro) | ~$0.07 | Medio | Muy bueno | Sensible a calidad, cuota gratuita |
| `openai` (GPT-4o-mini) | ~$0.01 | Rápido | Bueno | LLM presupuestario |
| `openai` (GPT-4o) | ~$0.10 | Medio | Muy bueno | Sensible a calidad |
| `anthropic` (Haiku) | ~$0.01 | Rápido | Bueno | LLM presupuestario |
| `anthropic` (Sonnet) | ~$0.10 | Medio | Muy bueno | Sensible a calidad |
| `anthropic` (Opus) | ~$0.50 | Lento | Excelente | Calidad máxima |
| `llm` (OpenRouter) | Varía según modelo | Varía | Varía | Comparación de modelos, experimentación |

:::note[Estas son estimaciones]
Los costos reales dependen de la longitud del texto de origen, el tamaño del lote y los cambios de precios del proveedor. Consulte la página de precios actual de cada proveedor para obtener tasas exactas.
:::

---

## Consulte también

- [Idiomas Admitidos](/docs/reference/supported-languages)
- [Datos de Coaching](/docs/concepts/coaching-data)
- [Apoyar un Idioma de Recursos Limitados](/docs/network/community/low-resource-languages)
- [Especificación de Plugin](/docs/reference/plugin-spec)
- [Servir un Método vía API](/docs/guides/serving-a-method)
- [Puerta de Calidad](/docs/concepts/quality-gate)
- [Arquitectura](/docs/concepts/architecture)
- [Solución de Problemas](/docs/guides/troubleshooting) — errores de modelo, problemas de API
