# Champollion

[![npm version](https://img.shields.io/npm/v/champollion.svg)](https://www.npmjs.com/package/champollion)
[![License: Apache-2.0](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](#license)


Traduzca sus archivos de localización con un solo comando:

```bash
npx champollion sync
```

Champollion detecta automáticamente sus archivos de localización, su formato y los idiomas de destino. Traduce las claves faltantes, omite lo que ya está hecho y escribe los resultados. Eso es todo.

> **Parte de Champollion** — infraestructura de código abierto para la traducción automática confiable en todos los idiomas. Esta CLI es el extremo de implementación de un proyecto más grande que construye los conjuntos de pruebas y el mapa que muestra quién puede traducir qué, qué tan bueno es cada método en cada tipo de texto y dónde están aún las brechas. Funciona con dos tipos de evaluaciones comparativas (benchmarks): evaluaciones públicas con datos abiertos (amplias, económicas, todos los métodos son bienvenidos) y evaluaciones soberanas — conjuntos de pruebas secretos que las comunidades crean, poseen y controlan, y que nosotros nunca vemos. La infraestructura es de código abierto y de administración única; los conjuntos de pruebas y los métodos para el idioma de una comunidad pertenecen a esa comunidad. Construido con las comunidades, nunca extraído (scraped) de ellas — ellas tienen las claves. Todos los métodos son bienvenidos, humanos y automáticos. Explore la red en [champollion.dev/docs/network](https://champollion.dev/docs/network/).

## ¿Por qué no simplemente escribir un script usted mismo?

Usted podría escribir un script rápido que itere sobre sus claves en inglés y llame a Google Translate. La mayoría de los desarrolladores lo hacen — toma unas 30 líneas. Aquí le explicamos por qué esto falla:

- **Sin detección de cambios.** Cuando usted actualiza una cadena en inglés, la traducción queda desactualizada para siempre. Champollion rastrea cada valor de origen con hashes SHA-256 y vuelve a traducir solo lo que cambió.
- **Sin procesamiento por lotes (batching).** Una llamada a la API por clave significa que 200 claves = 200 viajes de ida y vuelta. Champollion agrupa en lotes de forma inteligente (configurable, por defecto 80 claves/lote para LLM, 128 para Google).
- **Sin control de calidad.** La traducción automática alucina, repite el texto de origen o genera resultados en el sistema de escritura incorrecto. Champollion valida cada traducción antes de escribirla — los errores de sistema de escritura, la inflación de longitud y las repeticiones del origen son detectados y rechazados.
- **Sin reconocimiento de formato.** ¿Codificado de forma rígida (hardcoded) para JSON? Champollion maneja JSON, TOML, YAML y Hugo Markdown (frontmatter + cuerpo) con detección automática.
- **Sin seguridad.** Champollion protege contra la contaminación de prototipos (prototype pollution), el salto de directorios (path traversal) mediante códigos de localización manipulados y la corrupción de bloques de código durante la traducción de Markdown.

Champollion es la versión para producción de ese script.

> [!NOTE]
> **Qué traduce Champollion.** Champollion se enfoca en **archivos de localización y contenido estructurado** — pares clave-valor JSON, configuración TOML/YAML, páginas de Hugo Markdown, documentos de intercambio XLIFF. Está optimizado para texto escrito formal: cadenas de interfaz de usuario (UI), documentación, comunicaciones oficiales, materiales educativos. No es un chatbot, un traductor de voz en tiempo real ni una IA conversacional de propósito general. Para cada par de idiomas, el método de traducción es configurable — desde APIs comerciales (Google Translate, DeepL) hasta plugins desarrollados por la comunidad y evaluados a través del [MT Eval Arena](https://champollion.dev/arena).

## Inicio rápido

```bash
npm install --save-dev champollion
```

### Obtener una clave de API

Champollion necesita un backend de traducción. Elija uno:

| Proveedor | Clave | Mejor para |
|----------|-----|----------|
| **OpenRouter** (recomendado) | `OPENROUTER_API_KEY` | Proyectos con mucho contenido, Markdown, más de 200 modelos |
| **OpenAI** | `OPENAI_API_KEY` | Acceso directo a GPT-4o |
| **Anthropic** | `ANTHROPIC_API_KEY` | Acceso directo a Claude |
| **Gemini** | `GEMINI_API_KEY` | Nivel gratuito disponible |
| **DeepL** | `DEEPL_API_KEY` | Idiomas europeos, soporte para glosarios |
| **Google Translate** | `GOOGLE_TRANSLATE_API_KEY` | Más de 130 idiomas, alto volumen |

**Inicio más rápido** (gratis): Regístrese en [aistudio.google.com](https://aistudio.google.com/apikey) para obtener una clave gratuita de Gemini:

```bash
export GEMINI_API_KEY=AI...
npx champollion sync --method gemini
```

**OpenRouter** (más de 200 modelos): Regístrese en [openrouter.ai](https://openrouter.ai), luego:

```bash
export OPENROUTER_API_KEY=sk-or-v1-...
npx champollion sync
```

Alternativa con **Google Translate** (solo pares clave-valor — sin reconocimiento de Markdown):

```bash
export GOOGLE_TRANSLATE_API_KEY=...
npx champollion sync --method google-translate
```

> **Nota**: Si solo se configura `GOOGLE_TRANSLATE_API_KEY`, champollion cambia automáticamente a Google Translate. No se necesita ningún cambio de configuración. Utiliza la API REST directamente — sin SDK, sin cuenta de servicio, sin `pip install`. Solo la clave.

Eso es todo. Para tener más control, cree un archivo de configuración:

```bash
npx champollion init                        # guided wizard — walks you through registers, methods, and content
npx champollion init --yes --langs fr,de,ja  # quick setup with specific languages and default registers
```

Cada idioma viene con **ajustes preestablecidos de registro (register presets)** — instrucciones predefinidas de tono/formalidad ajustadas a su sistema lingüístico (vouvoiement para francés, Siezen para alemán, です/ます para japonés, 해요체 para coreano). El asistente de inicialización le permite explorar y elegir ajustes preestablecidos, o pasar `--yes` para aceptar los valores por defecto.

### Origen distinto al inglés

Si su idioma de origen no es el inglés:

```bash
champollion sync --source fr                      # CLI flag
```

O configúrelo permanentemente en su archivo de configuración:

```json
{ "inputLocale": "fr" }
```

## Qué hace

Usted maneja el framework de i18n (next-intl, i18next, Hugo). Champollion maneja los archivos de traducción.

- **Multiformato** — JSON, TOML, YAML, Hugo Markdown (front matter + cuerpo) y XLIFF 1.2
- **Incremental** — Solo traduce lo que cambió (seguimiento mediante hash SHA-256)
- **En caché** — La Memoria de Traducción almacena resultados anteriores; volver a ejecutar la sincronización no cuesta nada para las claves sin cambios
- **Control de calidad** — Valida cada traducción: detecta alucinaciones, resultados en el sistema de escritura incorrecto, repeticiones del origen e inflación de longitud
- **Reconocimiento de contenido** — Los métodos LLM protegen bloques de código, shortcodes, enlaces y variables de interpolación durante la traducción de Markdown
- **Herramientas de pipeline** — `lint`, `audit`, `integrity`, `seo` para controles de CI (Integración Continua)
- **Interoperabilidad XLIFF** — Exporte traducciones para revisión profesional en herramientas TAO (memoQ, SDL Trados, Phrase) y vuelva a importarlas
- **Dependencias mínimas** — dos dependencias en tiempo de ejecución (better-sqlite3 para la base de datos de idiomas incluida, nombres de localización CLDR); sin SDKs de proveedores. Requiere Node 20+

## Más allá de Google Translate

El inicio rápido le permite empezar a trabajar con un LLM o Google Translate. Pero Google Translate soporta ~130 idiomas. Existen más de 7,000.

**La idea central de Champollion: el método de traducción es configurable por par de idiomas.** Use Google Translate para francés, un LLM con entrenamiento morfológico para Plains Cree y una API alojada por la comunidad para quechua — todo en el mismo proyecto, todo con la misma CLI.

```json
{
  "version": 3,
  "pairs": {
    "en:fr": { "method": "google-translate" },
    "en:ja": { "method": "llm" },
    "en:crk": { "methodPlugin": "crk-coached-v1" }
  }
}
```

Si usted puede descubrir cómo traducir un par de idiomas — a través de ingeniería de prompts, diccionarios comunitarios, pipelines FST o modelos ajustados (fine-tuned) — champollion le permite empaquetar ese método como un plugin e implementarlo junto con todo lo demás.

> Nacido de la traducción de un sitio web en producción al Plains Cree, donde no existe una API lista para usar. La arquitectura por par no es teórica — existe porque un proyecto necesitaba Google Translate para francés y un pipeline FST entrenado para un idioma indígena, ejecutándose lado a lado en el mismo comando de sincronización.

El [MT Eval Harness](https://github.com/gamedaysuits/Champollion) complementario le permite evaluar y comparar enfoques de traducción, para luego exportar métodos funcionales como plugins de champollion. Cualquier persona que hable ambos idiomas puede desarrollar, probar y compartir un método de traducción — sin requerir una plataforma propietaria.

### Elija su método

Champollion soporta 10 métodos de traducción. Cada par de idiomas puede usar un método diferente.

**Proveedores de LLM** — mejores para calidad, reconocen Markdown, compatibles con entrenamiento (coaching):

| Método | Clave | Qué hace |
|--------|-----|-------------|
| `llm` (por defecto) | `OPENROUTER_API_KEY` | LLM vía OpenRouter — más de 200 modelos, enrutamiento automático |
| `llm-coached` | `OPENROUTER_API_KEY` | LLM + reglas gramaticales, diccionarios, notas de estilo |
| `openai` | `OPENAI_API_KEY` | API directa de OpenAI (gpt-4o, gpt-4o-mini) |
| `anthropic` | `ANTHROPIC_API_KEY` | API directa de Anthropic (Claude Sonnet, Haiku, Opus) |
| `gemini` | `GEMINI_API_KEY` | API directa de Google Gemini (Flash, Pro) — nivel gratuito disponible |

**Traducción Automática (MT) Tradicional** — mejor para velocidad, costo y alto volumen de pares clave-valor:

| Método | Clave | Qué hace |
|--------|-----|-------------|
| `google-translate` | `GOOGLE_TRANSLATE_API_KEY` | Google Cloud Translation API v2 (más de 130 idiomas) |
| `deepl` | `DEEPL_API_KEY` | API de DeepL con soporte para glosarios (más de 30 idiomas) |
| `microsoft-translator` | `MICROSOFT_TRANSLATOR_API_KEY` | Azure Cognitive Services Translator (más de 100 idiomas) |
| `libretranslate` | *(autoalojado)* | LibreTranslate autoalojado (AGPL, gratuito) |

**Infraestructura** — para endpoints personalizados o alojados por la comunidad:

| Método | Clave | Qué hace |
|--------|-----|-------------|
| `api` | *(por proveedor)* | Cliente HTTP ligero para cualquier endpoint REST |

```bash
# Force a specific method for one run
champollion sync --method deepl

# Or configure per pair
```

```json
{
  "pairs": {
    "en:fr": { "method": "deepl" },
    "en:ja": { "method": "openai", "model": "gpt-4o" },
    "en:crk": { "methodPlugin": "crk-coached-v1" }
  }
}
```

> **Nota**: Los métodos de MT tradicional (Google Translate, DeepL, Microsoft Translator, LibreTranslate) manejan bien los pares clave-valor, pero no pueden traducir contenido Markdown de forma segura. Para proyectos con mucho contenido, se recomiendan los métodos LLM — estos protegen explícitamente los bloques de código, shortcodes y variables de interpolación.

## Plugins

Los plugins son recetas de traducción preempaquetadas para pares de idiomas específicos. Son manifiestos JSON — no código — que le indican a champollion qué método usar, con qué configuraciones y qué calidad ha sido evaluada.

```bash
champollion plugin install ./french-formal-v1/    # install from directory
champollion plugin list                           # see installed plugins
champollion plugin remove french-formal-v1        # uninstall
champollion status                                # shows quality tiers + benchmarks
```

Consulte [website/docs/reference/plugin-spec.md](../website/docs/reference/plugin-spec.md) para ver el formato del manifiesto.

## Comandos

| Comando | Propósito |
|---------|---------|
| `init` | Asistente de configuración interactivo (o `--yes` para valores por defecto rápidos) |
| `sync` | Traducir y sincronizar todos los archivos de localización |
| `watch` | Sincronización automática al cambiar archivos |
| `audit` | Marcar localizaciones incompletas (control de CI) |
| `card` | Imprimir con formato una tarjeta de idioma (`card <code>`, `--json` para formato sin procesar) |
| `register-corpus` | Registrar un corpus de evaluación: elegir una licencia + nivel de exposición (solo local/privado/público/sellado) |
| `submit` | Proponer una entrada de índice (sujeta a revisión) — imprime un issue de GitHub prellenado |
| `lint` | Encontrar cadenas codificadas de forma rígida (hardcoded) en el código fuente |
| `status` | Mostrar configuración de pares, métodos, registros y niveles de calidad |
| `provenance` | Auditar las licencias de los recursos de traducción |
| `wrap` | Envolver automáticamente cadenas hardcoded en llamadas `t()` (con opción de deshacer) |
| `seo` | Generar hreflang, sitemap.xml o esquema JSON-LD |
| `integrity` | Comprobar corrupción de marcadores de posición (placeholders), codificación y completitud de plurales ICU |
| `plugin` | Instalar, eliminar o listar plugins de métodos |
| `fonts` | Descargar fuentes web para convertidores de sistemas de escritura PUA |
| `tm` | Administrar la caché de la Memoria de Traducción (estadísticas, limpiar, por localización) |
| `xliff` | Exportar/importar XLIFF 1.2 para revisión por traductores profesionales |
| `models` | Listar modelos disponibles para un proveedor (`--method gemini`) |
| `verify` | Volver a leer los archivos de localización escritos y confirmar que las traducciones estén presentes y sean correctas (control de CI) |
| `leaderboard` | Mostrar la tabla de clasificación de MT (`--pair`, `--sort`, `--install N`) |
| `doctor` | Comprobación del estado del sistema: tarjetas, configuración, métodos y convertidores |

Ejecute `champollion <command> --help` para obtener ayuda detallada sobre cualquier comando.

Referencia completa: [website/docs/reference/cli.md](../website/docs/reference/cli.md)

### Control pre-commit

`champollion lint` está diseñado para ser un control de commits (commit gate): sale con `1` cuando encuentra cadenas orientadas al usuario codificadas de forma rígida y con `0` cuando está limpio (`--warn-only` informa sin bloquear). Intégrelo en un directorio de hooks rastreado en su proyecto:

```bash
mkdir -p .githooks
printf '#!/bin/sh\nnpx champollion lint\n' > .githooks/pre-commit
chmod +x .githooks/pre-commit
git config core.hooksPath .githooks   # once per clone
```

O actívelo desde [lint-staged](https://github.com/lint-staged/lint-staged) para que solo se ejecute cuando los archivos fuente estén en el área de preparación (staged):

```json
{
  "lint-staged": {
    "src/**/*.{js,jsx,ts,tsx}": "champollion lint"
  }
}
```

Mantenga `champollion sync` fuera del pre-commit — realiza llamadas de red a la API, por lo que en el mejor de los casos es lento y en el peor bloquea los commits sin conexión. En su lugar, ejecútelo en CI o en un hook pre-push, con `champollion audit` / `champollion verify` como control.

## Configuración

Cree `champollion.config.json` o ejecute `champollion init`:

```json
{
  "version": 3,
  "inputLocale": "en",
  "localesDir": "./locales",
  "model": "google/gemini-3.5-flash",
  "pairs": {
    "en:fr": { "qualityTier": "high" },
    "en:ja": { "method": "google-translate" }
  }
}
```

| Opción | Por defecto | Descripción |
|--------|---------|-------------|
| `inputLocale` | `"en"` | Código del idioma de origen |
| `localesDir` | `"./locales"` | Ruta a los archivos de localización |
| `contentDir` | `null` | Directorio de contenido de Hugo (habilita la traducción de Markdown) |
| `format` | `"auto"` | Formato de archivo: `json`, `toml`, `yaml` o `auto` |
| `model` | `"google/gemini-3.5-flash"` | Modelo por defecto (slug de OpenRouter). Los proveedores directos resuelven su propio valor por defecto en tiempo de ejecución. Ejecute `champollion models --method gemini` para descubrir los modelos disponibles. |
| `defaultMethod` | `"llm"` | Método de traducción por defecto (anulado por la bandera `--method`) |
| `batchSize` | `80` | Claves por lote de traducción |
| `pairs` | `{}` | Anulaciones de método, modelo y calidad por par |

**Anulaciones por idioma**: Cada idioma tiene una [Tarjeta de Idioma (Language Card)](../website/docs/reference/language-card-spec.md) — una de las 50 tarjetas seleccionadas que contienen ajustes preestablecidos de registro, sistemas de formalidad, reglas tipográficas y banderas de soporte de métodos. Las tarjetas utilizan una [arquitectura de dos niveles](../website/docs/concepts/architecture.md) (tiempo de ejecución + referencia) para un rendimiento a escala. Genere la estructura de una nueva tarjeta con `node scripts/generate-language-card.mjs <code>`. Use las claves preestablecidas como atajo, o escriba texto de registro personalizado:

```json
{
  "languages": {
    "fr": "casual-tu",
    "ko": "formal-hapsyo",
    "crk": {
      "name": "Plains Cree",
      "register": "SRO syllabics with grammatical precision.",
      "model": "google/gemini-2.5-pro",
      "batchSize": 5,
      "maxRetries": 5,
      "script": "cans"
    }
  }
}
```

**Modo sin configuración (Zero-config)**: ¿No tiene archivo de configuración? Champollion detecta automáticamente los archivos de localización, el formato y los idiomas de destino de su proyecto.

Los valores de idioma pueden ser una clave preestablecida (por ejemplo, `"casual-tu"`), texto de registro personalizado o un objeto (control total). Las anulaciones a nivel de par en `pairs` tienen prioridad sobre las configuraciones a nivel de idioma. Ejecute `npx champollion init` para explorar los ajustes preestablecidos disponibles para cada idioma.

Consulte la [Referencia de la CLI](../website/docs/reference/cli.md) para obtener detalles de configuración específicos del framework.

## Salida de la CLI

Cuando usted ejecuta `sync`, champollion muestra exactamente lo que está sucediendo:

```
champollion v0.1.0

[INFO] Detected format: json (auto)
[INFO] Detected framework: Hugo
[INFO] Source: en.json (2,847 keys)
[INFO] Pairs: es-MX:llm, fr:deepl, it:llm
[INFO] Estimated translation cost:

  Pair       Method   Keys  Est. Cost
  ────────   ──────   ────  ─────────
  en:es-MX   llm      2847    ~$0.8400
  en:fr      deepl    2847    ~$0.5694
  en:it      llm      2847    ~$0.8400

  Total: ~$2.2494

[INFO] es-MX.json — 2,847 missing
     ████████████████████████████████ 2,847/2,847 keys
[INFO] fr.json — 2,847 missing
     ████████████████████████████████ 2,847/2,847 keys
[OK] Synced 5,694 keys total.
```

La barra de progreso se actualiza en el mismo lugar a medida que se completa cada lote (~80 claves por actualización). La detección del framework muestra `Hugo` cuando `contentDir` está configurado. La detección de formato distingue `(auto)` de `(config)` para aclarar cómo se resolvió el formato.

**Modos de salida**: `--quiet` suprime la salida informativa (solo errores y advertencias). `--json` emite NDJSON legible por máquina para pipelines de CI/CD.

## Fortalecimiento (Hardening)

- **Retroceso exponencial (Exponential backoff)** — 3 reintentos con fluctuación (jitter) en errores 429/5xx
- **Tiempo de espera de solicitud de 30s** — AbortController evita que se cuelgue
- **Validación de respuesta** — solo acepta las claves que se enviaron para traducción
- **Control de calidad** — detecta bucles de alucinación, resultados en el sistema de escritura incorrecto, inflación de longitud y repeticiones del origen
- **Cascada de reintentos** — en caso de fallo al analizar JSON, reintenta el lote → medio lote → claves individuales (con límite de presupuesto a través de `maxRetries`)
- **Memoria de Traducción** — `.champollion/tm.json` almacena en caché las traducciones indexadas por texto de origen + localización + método; las claves sin cambios se sirven desde la caché en sincronizaciones posteriores, eliminando llamadas redundantes a la API
- **Caché de prompts** — la división de mensajes de sistema/usuario permite el almacenamiento en caché a nivel de proveedor, reduciendo el costo de tokens entre lotes
- **Aplicación de terminología** — las traducciones entrenadas se verifican contra los términos del diccionario después de que el LLM responde
- **Protección contra contaminación de prototipos** — bloquea `__proto__`, `constructor`, `prototype`
- **Contención de rutas** — las escrituras de archivos se validan para que permanezcan dentro de los directorios configurados
- **Protección de bloques** — bloques de código, shortcodes y HTML protegidos durante la traducción de contenido
- **Arquitectura de fallo ruidoso (Fail-loud)** — los fallos de traducción siempre lanzan excepciones con mensajes de error procesables, nunca escriben basura silenciosamente
- **Verificación posterior a la sincronización** — el comando `verify` vuelve a leer los archivos escritos y confirma que las traducciones estén presentes, en el sistema de escritura correcto y con los marcadores de posición intactos
- **Éxito parcial** — un lote fallido no bloquea el resto

## Pruebas

```bash
npm test      # all tests
npm run test:unit                # core sync pipeline
npm run test:redteam             # adversarial edge cases
npm run test:format              # TOML/YAML adapters
npm run test:content             # Markdown content parser
npm run test:hugo                # full Hugo E2E
npm run test:lint                # hardcoded string detection
npm run test:pairs               # pair graph resolution
npm run test:methods             # translation method suite
```

**Dependencias mínimas** — ver arriba.

## Licencia

Apache-2.0. La CLI de Champollion es de código abierto — gratuita para instalar, usar, modificar y redistribuir bajo los términos de la [Licencia Apache, Versión 2.0](../LICENSE). El paquete npm `champollion` publicado es Apache-2.0; `cli/LICENSE` es la licencia autoritativa para el paquete distribuido. El MT Eval Harness complementario y las especificaciones también son de código abierto, con licencia AGPL-3.0-or-later — con una excepción §7 eval-standard-plugin — en el [repositorio público del harness](https://github.com/gamedaysuits/Champollion).
