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
  "localesPattern": null,
  "localesLayout": null,
  "contentDir": null,
  "translatableFields": null,
  "format": "auto",
  "model": "google/gemini-3.8-flash",
  "temperature": 0.3,
  "defaultMethod": "llm",
  "batchSize": 80,
  "coachingFile": null,
  "promptContext": null,
  "genderGuidance": null,
  "protectedTerms": [],
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
|-------|------|----------------|-------------|
| `version` | `number` | `3` | Versión del esquema de configuración. Siempre `3`. |
| `inputLocale` | `string` | `"en"` | Código de idioma de origen (BCP 47). |
| `localesDir` | `string` | `"./locales"` | Ruta a los archivos de configuración regional. Contiene un archivo por idioma (`fr.json`) o una carpeta por idioma (`fr/common.json`). Consulte [Estructuras de archivos de configuración regional](#locale-layouts). |
| `localesPattern` | `string` | `null` | Dónde residen los archivos de cada idioma cuando ninguna de las dos formas encaja, con `{lang}` y un `{ns}` opcional: `"public/locales/{lang}/{ns}.json"`, `"src/strings/app_{lang}.json"`. Relativo a la raíz del proyecto. Reemplaza a `localesDir`. Consulte [Estructuras de archivos de configuración regional](#locale-layouts). |
| `localesLayout` | `string` | `null` | Invalida la detección de la estructura: `"flat"` (un archivo por idioma) o `"dir"` (una carpeta por idioma). Solo es necesario cuando existen tanto `en.json` como `en/`. |
| `defaultNamespace` | `string` | `null` | En un proyecto con una carpeta por idioma y varios archivos, el archivo al que `champollion wrap` agrega nuevas claves (p. ej., `"common"`). |
| `contentDir` | `string` | `null` | Una carpeta de Markdown/MDX para traducir: una carpeta `content/` de Hugo o cualquier otra carpeta, como `./newsletters` en una aplicación Next.js. Cada traducción se escribe junto a su origen como `<name>.<locale>.md`, por ejemplo `2026-10.md` → `2026-10.crk.md`. Los archivos ya nombrados `<name>.<code>.md` se tratan como traducciones, no como orígenes. Consulte [Traducción de contenido](/docs/guides/content-translation). |
| `translatableFields` | `string[]` | `null` | Invalida los campos de frontmatter traducibles predeterminados para la traducción de contenido. `null` utiliza los valores predeterminados integrados (`title`, `description`, `summary`). |
| `format` | `string` | `"auto"` | Formato de archivo: `json`, `toml`, `yaml`, `po` ([gettext](#gettext)), `arb` ([Flutter](#arb)) o `auto` (detectar a partir de la extensión del archivo de origen; `.yml` cuenta como YAML y los destinos conservan `.yml`). Cualquier otro valor se detiene con un error. |
| `model` | `string` | `"google/gemini-3.8-flash"` | Modelo predeterminado para los métodos de LLM. Un slug exacto de modelo: el slug completo de OpenRouter (`provider/model`). Se rechazan los alias cortos (`gemini-flash`) y los identificadores flotantes (`~vendor/…`, `…-latest`), indicando el slug que se debe escribir. Los proveedores directos usan nombres simples (p. ej., `gpt-4o`); un slug de OpenRouter de su propio proveedor se mapea a este (`openai/gpt-4o` → `gpt-4o`), y uno para el que no tienen modelo detiene la ejecución antes de enviar nada ([Nombres de modelos](/docs/guides/translation-methods#model-names)). |
| `temperature` | `number` | `0.3` | Temperatura del LLM (0.0–2.0). Menor = más determinista. |
| `defaultMethod` | `string` | `"llm"` | Método de traducción predeterminado: `llm`, `llm-coached`, `openai`, `anthropic`, `gemini`, `local`, `google-translate`, `deepl`, `microsoft-translator`, `libretranslate`, `apertium`, `tilde`, `translated`, `api`. `local` es un servidor compatible con OpenAI en su máquina (Ollama por defecto). Sobrescrito por el flag de CLI `--method`. |
| `batchSize` | `number` | `80` | Claves por lote de traducción. Mayor = menos llamadas a la API, pero prompts más grandes. |
| `coachingFile` | `string` | `null` | Ruta a un archivo de prompt de orientación en texto libre (relativa a la raíz del proyecto). El contenido se lee al inicio y se inyecta en el prompt del sistema como un bloque `Coaching guidance:`. |
| `promptContext` | `string` | `null` | Cadena de contexto de la aplicación inyectada en el prompt del sistema (p. ej., "E-commerce product descriptions"). Ayuda al modelo a adaptar las traducciones a su dominio. |
| `genderGuidance` | `string` \| `false` | `null` | Cómo manejan el género gramatical los prompts de LLM. `null` mantiene el valor predeterminado de cada idioma del catálogo de Champollion: para el francés, *écriture inclusive* con el punto medio (`Connecté·e`, `Utilisateur·rice·s`); para el alemán, la forma con dos puntos (`Benutzer:innen`). `false` no envía ninguna instrucción de género; una cadena envía la suya propia (p. ej., `"Use the masculine generic."`). También configurable por idioma y por par. Consulte [Orientación sobre género](#gender-guidance). |
| `protectedTerms` | `string[]` | `[]` | Nombres que deben mantenerse exactamente como están escritos en cada idioma: personas, empresas, productos (p. ej., `["Curtis Forbes", "Game Day Suits"]`). Se le indica al modelo que los conserve, y un valor compuesto únicamente por estos nombres nunca se marca como no traducido o con un sistema de escritura incorrecto. Esto es diferente de `noTranslate`, que omite **claves** completas. |
| `jsonConcurrency` | `number` | `200` | Máximo de traducciones de configuración regional en paralelo para la sincronización de claves JSON. Sobrescrito por el flag de CLI `--json-concurrency`. |
| `contentConcurrency` | `number` | `48` | Máximo de llamadas a la API en paralelo para la traducción de contenido (Markdown/MDX). Sobrescrito por el flag de CLI `--content-concurrency`. |
| `fallbackPrefix` | `string` | `"[EN] "` | Prefijo de marcador utilizado por `audit` y `verify` para detectar valores heredados sin traducir de ejecuciones anteriores. Champollion no escribe este prefijo; solo lo lee para la detección. |
| `apiKeyEnvVar` | `string` | `"OPENROUTER_API_KEY"` | Nombre de la variable de entorno para la clave de API. Invalídelo para usar nombres personalizados de variables de entorno. |
| `minContentRetention` | `number` | `0.35` | Fracción de letras/dígitos del origen que una salida debe retener antes de que la [verificación de eliminación de contenido](/docs/concepts/quality-gate) consulte su segunda señal. También configurable por par y por idioma. |
| `noTranslate` | `string[]` | `[]` | Claves con notación de punto y patrones glob cuyo valor se copia textualmente a cada configuración regional. Consulte [Claves no traducibles](#no-translate). También se acepta como `skipKeys`. |
| `noTranslateUrls` | `boolean` | `true` | Trata los valores de origen que sean exclusivamente una URL `scheme://` como no traducibles. Establezca `false` para enviar claves con valores de URL al backend de traducción. |
| `baseUrl` | `string` | `""` | URL base para la generación de artefactos SEO (hreflang, sitemaps, JSON-LD). |
| `pairs` | `object` | `{}` | Anulaciones de método, modelo y calidad por par. Consulte [Configuración de pares](#pair-configuration). |
| `languages` | `object` | `{}` | Anulaciones por idioma. Consulte [Configuración de idiomas](#language-configuration). |
| `lint.srcDir` | `string` | `null` | Directorio de origen para el escaneo de lint. `null` = detección automática según el framework. |
| `lint.ignore` | `string[]` | `["node_modules", ...]` | Patrones glob que se excluirán del lint. |
| `lint.minLength` | `number` | `2` | Longitud mínima de cadena para marcarla como hardcoded. |
| `seo.urlPattern` | `string` | `"/:locale/:path"` | Plantilla de patrón de URL para la generación de etiquetas hreflang. |
| `seo.pages` | `string[]` | `null` | Lista explícita de páginas para SEO. `null` = detección automática a partir de las claves de configuración regional. |
| `typegen.output` | `string` | `null` | Ruta de salida para los tipos de TypeScript generados. `null` = desactivado. |
| `typegen.autoGenerate` | `boolean` | `false` | Regenerar automáticamente los tipos después de cada sincronización. |

## Diseños de archivos de localización {#locale-layouts}

Champollion lee sus archivos de localización donde su framework ya los guarda. Hay tres estructuras.

**Un archivo por idioma** (`flat`). next-intl, vue-i18n, Hugo, la mayoría de las configuraciones personalizadas:

```text
messages/
  en.json      ← source
  fr.json
  de.json
```

```json title="champollion.config.json"
{ "localesDir": "./messages" }
```

**Una carpeta por idioma** (`dir`). i18next y react-i18next, donde cada archivo es un *espacio de nombres*:

```text
public/locales/
  en/
    common.json      ← source namespaces
    admin/users.json
  fr/
    common.json
    admin/users.json
```

```json title="champollion.config.json"
{ "localesDir": "./public/locales" }
```

Champollion selecciona `dir` cuando `<localesDir>/<inputLocale>/` es una carpeta de archivos de localización. Cada archivo de origen se sincroniza con la misma ruta bajo la carpeta de cada idioma, y se crean los archivos y carpetas que falten. Un espacio de nombres puede ser una ruta anidada (`admin/users`).

**Cualquier otra estructura** (`localesPattern`). Indique la ruta con `{lang}` y, si un idioma tiene varios archivos, `{ns}`:

```json title="champollion.config.json"
{ "localesPattern": "src/translations/{ns}/{lang}.json" }
```

`{lang}` puede repetirse, como en `"{lang}/app_{lang}.json"`. `{ns}` puede aparecer una vez y puede abarcar carpetas. El formato proviene de la extensión a menos que se defina `format`.

`champollion init` encuentra estos diseños por usted. Primero busca una aplicación Flutter (`pubspec.yaml`, con `l10n.yaml` si está presente) y catálogos gettext (`locale/<lang>/LC_MESSAGES/`, `translations/`, GNU `po/`), y escribe un `localesPattern` para ellos. Luego comprueba la carpeta habitual de su framework (`messages/` para next-intl, `public/locales/` y luego `locales/` para i18next, `src/locales/` para vue-i18n, `i18n/` para Hugo), luego `locales`, `messages`, `i18n`, `lang`, `translations`, `public/locales`, `src/locales` y `src/i18n`. Solo usa una carpeta que contenga el archivo de su idioma de origen y muestra lo que encontró. `init --langs fr,de` también crea los archivos de destino vacíos en ese diseño.

:::note[Cómo se sincroniza un idioma con múltiples archivos]
Cada archivo se compara, traduce y escribe por separado. `.champollion.lock` registra las claves como `<namespace>::<key>` (`common::nav.home`), y también lo hacen `--force-keys`, los ID de unidad de `xliff` y `sync --dry --json`. Una clave simple en `--force-keys` coincide con esa clave en cada archivo. Los proyectos de un solo archivo por idioma conservan claves simples, por lo que su archivo de bloqueo no cambia.

La memoria de traducción está indexada por texto de origen, no por archivo. Una cadena que aparece en dos espacios de nombres se traduce una vez por idioma. El segundo archivo la obtiene de la caché sin costo alguno.
:::

Si existen tanto `en.json` como una carpeta `en/` con contenido, Champollion se detiene y le pide que configure `"localesLayout": "flat"` o `"dir"` en lugar de adivinar.

### Claves de plural de i18next {#i18next-plurals}

i18next almacena los plurales como claves hermanas con un sufijo CLDR: `item_one`, `item_other`. Los idiomas tienen diferentes formas de plural. El francés y el español también usan `_many`, el árabe usa seis formas y el japonés solo `_other`. Cuando un archivo fuente JSON tiene estas claves, cada destino obtiene exactamente las formas de su propio idioma, leídas de CLDR a través de la API `Intl.PluralRules` de JavaScript:

```json title="en.json"
{ "item_one": "{{count}} item", "item_other": "{{count}} items" }
```

Después de una sincronización, `fr.json` tiene `item_one`, `item_many` y `item_other`, y `ja.json` solo tiene `item_other`. Sync indica, para sus propios idiomas, qué formas agrega o elimina cada uno.

Las nuevas formas se traducen a partir del texto `_other` de origen, `_one` a partir de `_one`. Un `_zero` en el origen se conserva en todos los idiomas, ya que i18next lo busca para una cuenta de 0 en todos los idiomas. Si una sincronización anterior escribió una forma que el idioma no utiliza, como `item_one` en japonés, sync la elimina únicamente cuando la memoria de traducción muestra que sync produjo ese valor. Se conserva un valor escrito a mano. Una clave para una forma que el idioma no tiene y para la cual el origen tampoco tiene clave (`item_two` en español) nunca se elimina por sí sola: `verify` la señala y `sync --prune plural-extras` elimina exactamente esas claves, listando cada una (con `--dry`, indica lo que eliminaría). Para un idioma para el cual CLDR no tiene reglas de plural, las formas del origen se copian una a una, y sync lo informa.

### Mensajes ICU {#icu}

Los valores escritos en ICU MessageFormat (next-intl, react-intl, vue-i18n, Flutter) mezclan código con texto:

```json
{ "items": "{count, plural, =0 {No events} one {# event} other {# events}}" }
```

Solo se traduce el texto dentro de las ramas. El [control de calidad](/docs/concepts/quality-gate) rechaza una traducción que modifique cualquier otra cosa:

- nombres de variables (`count`, `{name}`), que nunca se renombran ni se eliminan;
- las palabras `plural`, `select` y `selectordinal`, y el tipo de `{price, number}`;
- selectores (`=0`, `one`, `other`, `male`). Un `select` conserva exactamente sus opciones. Un `plural` conserva los selectores de origen y puede agregar las categorías que usa el idioma de destino, provenientes de CLDR: el francés agrega `many`, el polaco `few` y `many`. Una categoría que el idioma no utiliza puede omitirse, del mismo modo que el japonés solo conserva `other`;
- `#` en cada rama plural que lo tenga, excepto `zero`, `one`, `two` y `=N`, donde un idioma puede escribir el número como una palabra;
- `offset:N`, argumentos anidados y conversiones printf como `%s`, `%d` y `%(name)s`.

Se le indica al modelo qué categorías utiliza el idioma de destino. Una traducción rechazada se vuelve a intentar una vez con el motivo, por ejemplo `ICU keyword 'other' was translated to 'óthér'`. Un apóstrofo antes de un marcador de posición (`d'{name}`) es válido. `verify` y `integrity` ejecutan la misma comprobación en archivos ya escritos. Un `sync` simple conserva un valor que ya está en el disco, por lo que cada hallazgo indica el comando que lo repara, `champollion sync --pair <pair> --redo keys:<key>`. Cuando el valor dañado provino de la memoria de traducción, lo eliminan de la caché, de modo que ese comando traduce la clave nuevamente en lugar de servir el mismo texto; no se necesita `--fresh`.

### Catálogos gettext (.po) {#gettext}

Apunte `localesPattern` (o `localesDir`) a sus catálogos:

```json title="Django"
{ "localesPattern": "locale/{lang}/LC_MESSAGES/{ns}.po" }
```

```json title="GNU (po/fr.po, po/de.po, po/hello.pot)"
{ "localesDir": "./po", "format": "po" }
```

**El origen** es el catálogo del idioma de origen, por ejemplo `locale/en/LC_MESSAGES/django.po` de `django-admin makemessages -l en`. Su `msgid` es el texto que se traducirá cuando `msgstr` esté vacío. Cuando ese catálogo no existe, el origen es una plantilla `.pot`:

- Con `localesDir`: el único `.pot` en esa carpeta.
- Con `localesPattern`: `<name>.pot` en la carpeta anterior al primer marcador de posición o en la carpeta superior. `<name>` es el espacio de nombres (`{ns}`, una plantilla por dominio como `django.pot`), o el nombre de archivo del patrón sin `{lang}` (`messages.po` → `messages.pot`).
- Con `localesLayout: "dir"`: no se busca ninguna plantilla. Conserve el catálogo de origen en `<localesDir>/<source>/`.

Dos plantillas donde se espera una detienen la ejecución. Champollion no adivina cuál es la de origen.

**Claves.** Cada `msgid` es una clave. Una entrada con un `msgctxt` tiene la clave `msgctxt` + U+0004 + `msgid`, la propia codificación de gettext. "Open" como verbo y "Open" como adjetivo son claves independientes y entradas de caché independientes. Los informes imprimen el separador como `␄` (`verb␄Open`), y `--force-keys "verb␄Open"` lo acepta. Si no puede escribir `␄`, escriba `\x04` (`--force-keys 'verb\x04Open'`): ambas grafías funcionan. `--force-keys` (y `--redo keys:`) divide por comas; escriba una coma dentro de un msgid como `\,` y encierre el argumento entre comillas: `--redo 'keys:Welcome back\, %(name)s!'`. Las entradas sin cambios provienen de la caché sin costo alguno.

**Qué se traduce.** Una entrada con un `msgstr` vacío, o una marcada como `fuzzy`, no está traducida. Sync la traduce y elimina `fuzzy` junto con las líneas de msgid previo `#|`. Se conservan los comentarios del traductor (`# …`). Las referencias (`#:`), los comentarios extraídos (`#.`) y las etiquetas (flags) provienen del origen. Los comentarios `#.` y `msgctxt` se envían al modelo como contexto. Las entradas que sync no modificó se vuelven a escribir byte por byte. Las entradas que el origen ya no contiene, y las entradas obsoletas `#~`, se conservan al final.

Un catálogo creado por Champollion (`init --langs`, o sync para una configuración regional sin catálogo aún) recibe el encabezado completo que escribe `msginit --no-translator`, el cual `msgfmt -c` acepta: `Project-Id-Version`, `Report-Msgid-Bugs-To` y `POT-Creation-Date` copiados de la plantilla (`PACKAGE VERSION` se reemplaza por el nombre de la carpeta del proyecto, y no hay `POT-Creation-Date` sin una fecha de plantilla), `PO-Revision-Date` (cuándo se creó el archivo), `Last-Translator: Automatically generated`, `Language-Team: none`, `Language`, `MIME-Version: 1.0`, `Content-Type: text/plain; charset=UTF-8`, `Content-Transfer-Encoding: 8bit` y `Plural-Forms`. El encabezado de un catálogo existente nunca se reescribe; solo se completa un marcador de posición `Plural-Forms` o `charset=CHARSET` que contenga.

**Plurales.** Una entrada con `msgid_plural` se traduce como un único mensaje plural ICU (`{n, plural, one {One file} other {%(count)d files}}`), de modo que el modelo escribe todas las formas a la vez. Luego se escribe en `msgstr[0]`…`msgstr[n]` a través del encabezado `Plural-Forms` del destino. Cada índice toma la categoría CLDR de los números que lo seleccionan. El `nplurals=3` ruso es `one`, `few`, `many`. Si el destino no tiene encabezado `Plural-Forms`, o solo tiene el marcador de posición de la plantilla, recibe el encabezado que escribe `msginit` para su idioma, de modo que las ranuras `msgstr[]` del catálogo sean las que gettext y Django seleccionan: francés `nplurals=2; plural=(n > 1);`, alemán `nplurals=2; plural=(n != 1);`, ruso `nplurals=3; …`. Un idioma para el que `msginit` no tiene entrada recibe un encabezado derivado de CLDR, verificado contra `Intl.PluralRules` para cada número hasta 3,000 y para números grandes. Si las reglas de un idioma no se pueden escribir como una expresión gettext, sync se detiene e indica el comando que escribe el encabezado: `msginit --locale=<lang> --input=<template>.pot`. Una forma para la que el catálogo no tiene ranura (el francés `many`, para 1 000 000, en un catálogo de dos formas) no se vuelve a solicitar, ni se marca ni se informa como faltante; un catálogo que tiene su propio encabezado lo conserva, y sus ranuras son las que se verifican.

**Límites.** Los catálogos deben estar en UTF-8. Convierta otros con `msgconv --to-code=UTF-8`. Un msgid plural cuyas llaves no estén balanceadas no se puede escribir como un mensaje ICU, por lo que se informa y se deja para que usted lo traduzca. Aun así, ejecute `msgfmt --check-format` (Django: `compilemessages`) antes de lanzar a producción. Solo comprueba entradas marcadas como `#, python-format` (o `c-format`, …): `makemessages` agrega la etiqueta a las entradas que extrae con un marcador de posición `%`, pero un catálogo hecho a mano puede carecer de ella y esas entradas quedan sin revisar. `champollion verify` compara los marcadores de posición printf de cada entrada (nombre y letra de tipo) cualesquiera que sean sus etiquetas, y sync conserva las etiquetas de la entrada de origen en cada entrada que traduce.

### Archivos ARB de Flutter (.arb) {#arb}

```json title="champollion.config.json"
{ "localesPattern": "lib/l10n/app_{lang}.arb" }
```

Utilice el `arb-dir` y el `template-arb-file` de su `l10n.yaml` si difieren (`assets/i18n/intl_{lang}.arb`). Solo se traducen los mensajes. Al escribir:

- `@@locale` se establece en el destino en el formato de Flutter, coincidiendo con el nombre del archivo (`app_pt_BR.arb` → `"pt_BR"`). `gen-l10n` rechaza un archivo cuyo `@@locale` no coincida con su nombre.
- Cada objeto de metadatos `@key` (marcadores de posición, sus tipos, descripciones) se copia del origen. Una clave para la que el origen no tiene metadatos conserva los del destino.
- Las claves siguen el orden del origen. Los mensajes sin traducir se omiten, por lo que Flutter recurre a la plantilla.

Los `description` del mensaje se envían al modelo como contexto. Los marcadores de posición `{name}` y los plurales de ICU están protegidos por la [comprobación de ICU](#icu). `verify` y `integrity` también informan un `@@locale` incorrecto y metadatos de marcadores de posición que difieran del origen. Cualquier sincronización que reescriba el archivo repara ambos: `champollion sync --pair en:fr --force` sirve cada mensaje sin cambios desde la caché.

## Claves que no se traducen {#no-translate}

Algunos valores tienen exactamente una representación correcta en todos los idiomas: una URL, una ruta de repositorio, el nombre de un paquete, el identificador de un producto. Una traducción correcta de `https://example.org/paper` es `https://example.org/paper`.

El [control de calidad](/docs/concepts/quality-gate) de Champollion rechaza el eco del origen (source-echo) —una traducción idéntica a su origen— porque normalmente se trata de un modelo que se rehúsa a hacer el trabajo. Para estas claves, eso hace que la respuesta correcta sea la rechazada, y no hay ninguna salida que el modelo pueda producir que pase la validación. Los modelos más débiles aprenden a burlar el control alterando el valor lo suficiente (un `#fragment` inventado, una barra inclinada final sobrante, un espacio invisible de ancho cero), lo que entrega enlaces rotos. Los modelos más fuertes devuelven el valor sin cambios y fallan el control, por lo que `sync` sale con un código distinto de cero en cada ejecución.

Declare esas claves en su lugar:

```json title="champollion.config.json"
{
  "noTranslate": ["**.url", "pages.software.*.repo", "meta.appId"]
}
```

Una clave coincidente se **copia textualmente de la configuración regional de origen**; nunca se envía a un backend de traducción, nunca pasa por el control de calidad, nunca se cuenta como un fallo y nunca se factura. Queda excluida de la estimación de costos previa a la ejecución por la misma razón.

### Sintaxis de patrones

Los patrones son rutas con puntos sobre el espacio de claves aplanado, con dos comodines:

| Patrón | Coincide con | No coincide con |
|---------|---------|----------------|
| `nav.brand` | `nav.brand` (ruta exacta) | `nav.brandName` |
| `**.url` | `url`, `pages.a.b.url` (una hoja `url` a cualquier profundidad) | `pages.urlLabel`, `pages.url.caption` |
| `pages.software.*.repo` | `pages.software.portal.repo` | `pages.software.a.b.repo` |
| `meta.og*` | `meta.ogImage`, `meta.ogTitle` | `meta.twitterImage`, `meta.og.image` |

`*` coincide dentro de un solo segmento; `**` coincide con cero o más segmentos completos.
Un patrón sin comodines es una ruta de clave exacta.

### Las URL se gestionan de forma predeterminada

Dado que una clave con valor de URL no tiene un resultado correcto según el control de calidad, `noTranslateUrls` es `true` de fábrica: cualquier valor de origen que no sea más que una URL `scheme://` absoluta se trata como no traducible sin necesidad de configuración.

La detección es deliberadamente estricta: todo el valor recortado (trimmed) debe ser la URL. El texto en prosa que simplemente contiene un enlace (`"Read the paper at https://…"`) se sigue traduciendo normalmente.

Desactívelo con `"noTranslateUrls": false` si sus URL realmente son específicas de la configuración regional (servidores de documentación por idioma, por ejemplo); luego declare las que no lo son con `noTranslate`.

### Reparación y cumplimiento

Para una clave que no se traduce, existe exactamente un valor de destino correcto, por lo que cualquier diferencia es un defecto. Champollion impone esto en ambas direcciones:

- **`sync` la repara.** Una clave que no se traduce cuyo destino falta, tiene el prefijo `[EN] ` o está alterada se reescribe a partir del origen. Esto no cuesta ninguna llamada a la API y es idempotente: una vez que los valores coinciden, las sincronizaciones posteriores omiten la clave por completo.
- **`verify` y `integrity` fallan ante ella.** Una clave no traducible que haya divergido se reporta como `NO-TRANSLATE DRIFT` con los valores esperado y real —los caracteres invisibles se escapan como `\uXXXX`, ya que de otro modo sería imposible ver esa clase de corrupción en un diff. `champollion integrity` termina con código `1`, por lo que una compilación vinculada a él detecta una URL corrupta antes de desplegarla.

Si `integrity` falla de esta manera en un proyecto que acaba de configurar, está reportando daños que ya estaban en sus archivos de localización. Ejecute `champollion sync` una vez para repararlo.

## Conversión de escritura {#script-conversion}

Algunos idiomas que Champollion traduce se pueden *escribir* de más de una forma. El modelo siempre trabaja en la **escritura de trabajo** del idioma (romanización latina: SRO para cree de las llanuras, romanización de Okrand para klingon), y un convertidor determinista puede luego reescribir la salida en una escritura de visualización. Si debe hacerlo o no es una decisión que toma la configuración —**nunca un valor predeterminado**:

| Configuración regional | Escritura de trabajo | Convertible a | Tipo |
|--------|---------------|----------------|------|
| `crk` (cree de las llanuras) | `Latn` (SRO) | `Cans` (silábico) | Unicode real — **se requiere elección** |
| `sr` / `srp` (serbio) | `Latn` | `Cyrl` (cirílico) | Unicode real — **se requiere elección** |
| `tlh` (klingon) | `Latn` (romanización) | `Piqd` (pIqaD) | PUA — opcional |
| `x-elvish-s` (sindarin) | `Latn` | `Teng` (tengwar) | PUA — opcional |
| `x-kryptonian` | `Latn` | Kryptoniano | PUA — opcional mediante `"script": "x-kryptonian"` |

**Los pares con Unicode real (crk, sr) requieren la elección.** El silabario cree y el cirílico son Unicode ordinario —se renderizan en todas partes— y ambas ortografías se usan en la vida real. Champollion no elegirá el sistema de escritura de una comunidad en nombre de un proyecto: `init` pregunta cuando usted selecciona el idioma, y `sync` se niega a ejecutarse hasta que la configuración indique cuál:

```json
{
  "languages": {
    "crk": { "script": "Cans" }
  }
}
```

**Las escrituras PUA (tlh, x-elvish-s, x-kryptonian) usan la romanización por defecto.** pIqaD, tengwar y kryptoniano *no están en Unicode*; los convertidores emiten puntos de código de área de uso privado (PUA) que no se renderizan como nada a menos que incluya una fuente asignada a esos puntos de código. La romanización es la única salida que se renderiza en todas partes, por lo que es la opción predeterminada. Para emitir la escritura de visualización en su lugar:

```json
{
  "languages": {
    "tlh": { "script": "Piqd" }
  }
}
```

…y ejecute `champollion fonts install` para que su sitio tenga una fuente que pueda dibujarla. Si sus fuentes están asignadas a la transliteración latina (muchas fuentes de conlangs lo están), mantenga el valor predeterminado.

`script` toma un código ISO 15924, sin importar mayúsculas o minúsculas (`"cans"`, `"Cans"` y `"CANS"` son iguales). También se puede establecer por par, lo cual tiene prioridad sobre el nivel de idioma. Un valor no válido, o una escritura que la configuración regional no puede producir, falla al inicio, antes de cualquier llamada a la API.

### Letras sin asignar y `scriptFallback` {#script-fallback}

Los convertidores traducen lo que define su ortografía y nada más. La romanización del klingon no tiene `d`, `c`, `f`, `g`, `i`, `k`, `s`, `x` ni `z`; por lo tanto, la salida del modelo que contenga un nombre propio como "GitHub" no se puede convertir por completo. Champollion **nunca escribe un valor parcialmente convertido**: si alguna letra no se puede asignar, todo el valor permanece en la escritura de trabajo, y la advertencia nombra las letras además de la línea de configuración que las asignaría.

Esas asignaciones le corresponde a usted declararlas:

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

Cada regla reemplaza una secuencia en la escritura de trabajo con una que el convertidor *sí* puede asignar, antes de que se ejecute la conversión. Las reglas se validan al inicio: se rechaza cualquier reemplazo que a su vez no se pueda asignar.

Champollion no incluye **reglas de reserva (fallback) propias**: inventar adaptaciones ortográficas, especialmente para el sistema de escritura de un idioma real, no le corresponde a una herramienta. Las comunidades y los fandoms tienen convenciones; adóptelas deliberadamente, por proyecto.

### Reparación de conversiones no deseadas {#repair-script}

Antes de la versión 0.3.0, la conversión era incondicional: los proyectos dirigidos a configuraciones regionales PUA obtenían salidas no renderizables, quisieran o no. Dos herramientas cierran el ciclo:

- **`champollion repair-script`** escanea las configuraciones regionales cuya configuración indica que la conversión está *desactivada* en busca de puntos de código PUA y restaura la romanización mediante la tabla inversa del propio convertidor (`--dry` para obtener una vista previa). La reversión de pIqaD es exacta; las reversiones de tengwar y kryptoniano pierden las mayúsculas y así lo indican.
- **`champollion integrity`** falla (código de salida 1) ante cualquier PUA que encuentre donde la conversión esté desactivada, de modo que un control de compilación detecte texto no renderizable antes de que se despliegue, y el informe indica la reparación.

La memoria de traducción nunca necesita reparación: almacena valores previos a la conversión, por lo que activar o desactivar `script:` posteriormente no requiere ningún trabajo en la caché.

La conversión de escritura se aplica a las cadenas de interfaz de usuario (archivos clave-valor y JSON de Docusaurus). El cuerpo de los archivos Markdown nunca se convierte: un convertidor de caracteres estricto no tiene forma segura de pasar por fragmentos de código, URL y frontmatter.

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
      "model": "google/gemini-3.1-pro-preview"
    },
    "en:crk": {
      "method": "llm-coached"
    }
  }
}
```

### Campos de pares

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `method` | `string` | Método de traducción: `llm`, `llm-coached`, `openai`, `anthropic`, `gemini`, `local`, `google-translate`, `deepl`, `microsoft-translator`, `libretranslate`, `apertium`, `tilde`, `translated`, `api` |
| `methodPlugin` | `string` | Nombre de un complemento instalado (desde `.champollion/methods/`) |
| `model` | `string` | Invalida el modelo predeterminado para este par |
| `temperature` | `number` | Invalida la temperatura predeterminada para este par |
| `batchSize` | `number` | Invalida el tamaño de lote predeterminado para este par |
| `register` | `string` | Invalidación de registro/tono (clave preestablecida o texto libre) |
| `endpoint` | `string` | URL del endpoint de API remota. Obligatorio cuando `method` es `api`. |
| `coachingFile` | `string` | Ruta a un archivo de prompt de entrenamiento para este par, leída en relación con el proyecto; reemplaza cualquier entrenamiento menos específico, y un archivo que no se pueda leer detiene la ejecución |
| `promptContext` | `string` | Contexto de la aplicación para este par |
| `genderGuidance` | `string` \| `false` | Instrucción de género para los prompts de este par: su propio texto, o `false` para ninguno. Consulte [Orientación sobre género](#gender-guidance). |
| `qualityTier` | `string` | Una etiqueta que le da a la salida del par: `standard`, `high`, `research`, `verified`. No se mide, y sync traduce lo mismo independientemente de lo que diga; `status` la muestra (solo cuando está configurada) y `serve` la anuncia |
| `fallback` | `object` | Un segundo método para lo que el método de este par no pueda traducir de forma segura. Consulte [Método de reserva (fallback)](#fallback). `null` elimina una reserva configurada en el idioma. |

### Método de reserva (fallback) {#fallback}

Un par puede nombrar un segundo método. El método propio del par traduce primero. Lo que no pueda traducir de forma segura pasa al método de reserva una vez:

- **Archivos clave-valor:** claves que el [control de calidad](/docs/concepts/quality-gate) rechazó (un `{name}` omitido, un plural roto, una etiqueta de dos palabras convertida en un párrafo) y claves para las que el método no devolvió nada.
- **Markdown (contenido de Hugo y documentos de Docusaurus):** campos de frontmatter que omitió o vació de sus palabras, y bloques del cuerpo que omitió de su respuesta, dañó (perdió un elemento protegido: código, una etiqueta HTML, un shortcode) o vació. En la segmentación `page`, la página completa.

```json
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

Cuando ningún texto pueda salir de sus máquinas (un hospital, una escuela, una comunidad que conserva los datos de su idioma en el sitio), configure como alternativa un modelo que ejecute usted mismo. El método `local` envía las solicitudes a un servidor compatible con OpenAI en esta máquina (Ollama, llama.cpp, vLLM, LM Studio; `LOCAL_API_BASE` establece la dirección, consulte [`local`](/docs/guides/translation-methods#local--your-own-model-ollama-vllm-lm-studio-a-trained-model)):

```json
{
  "pairs": {
    "en:crk": {
      "method": "api",
      "endpoint": "http://127.0.0.1:8378/translate",
      "fallback": { "method": "local", "model": "<your local model>" }
    }
  }
}
```

Cuál usar:

- **Un modelo alojado** (`llm-coached` con un modelo Gemini, u otro método de API) suele ser la segunda opinión más sólida para un idioma con pocos recursos y se factura por solicitud. Utilícelo cuando el texto se pueda enviar a ese proveedor.
- **`local`** mantiene cada clave en esta máquina y la estimación lo muestra como `$0 API cost (runs on this machine)`. Utilícelo cuando nada deba salir de la máquina, incluso si el modelo que puede ejecutar allí es más pequeño.

La salida del método de reserva pasa por el mismo control de calidad. Lo que traduce se almacena bajo su propio método en la memoria de traducción, por lo que la caché registra qué método produjo cada valor. Las sincronizaciones posteriores lo reutilizan en lugar de consultar nuevamente al primer método; `--fresh` o `--retranslate` vuelve a consultar. Lo que ninguno de los métodos traduzca permanece tal como quedaría sin un método de reserva. Una clave se deja sin traducir y conserva su entrada de bloqueo anterior, por lo que la siguiente sincronización la vuelve a intentar y `champollion verify` la lista. Un bloque de Markdown se escribe como origen con el prefijo `[EN] `, no se almacena en caché y el archivo se procesa nuevamente en la siguiente sincronización. Un bloque o campo de frontmatter que el control de calidad rechazó de ambos métodos se retiene, sin enviarse a ellos nuevamente hasta que `--redo files:<page>` nombre la página ([Bloques de Markdown y campos de frontmatter rechazados](/docs/concepts/quality-gate#refused-markdown-blocks-and-front-matter-fields)). Un campo de frontmatter que ambos métodos vacíen, o una página que ninguno traduzca, hace que el archivo falle, al igual que sin método de reserva.

Un fallback acepta los mismos campos que un par: `method` (obligatorio), `model`, `provider`, `endpoint`, `methodPlugin`, `coachingFile`, `coachingPrompt`, `promptContext`, `register`, `temperature`, `batchSize`, `maxRetries`, `qualityTier`, `contentSegmentation`, `name`. Se resuelve como un par. Los campos que no establezca (registro, coaching, contexto del prompt, …) provienen de su par. Su propio `coachingFile` llega a su prompt y a su clave de caché, y `champollion status` lo muestra. El sistema de escritura pertenece al par, por lo que `script` y `scriptFallback` se rechazan en un fallback, al igual que el propio `fallback` de un fallback. Un método desconocido, o un fallback idéntico a su par, detiene la sincronización con un error que nombra al par. El fallback debe estar listo para ejecutarse antes de que comience la sincronización, al igual que el propio método del par (por ejemplo, su clave de API debe estar configurada).

- **`--method` y `--model` cambian solo el método propio del par.** El fallback conserva lo que indique el archivo de configuración.
- **Costo.** La estimación previa a la ejecución cubre únicamente el método propio del par: nadie sabe de antemano qué fallará. Cada lote del fallback se cotiza justo antes de ejecutarse, con el mismo estimador. Con `--max-cost`, un lote que llevaría la ejecución más allá del límite (la estimación más cada lote de fallback hasta el momento) se omite, con una advertencia que nombra las claves. Lo mismo ocurre con un fallback cuyo costo no se pueda estimar (desconocido no significa gratis). Esas claves permanecen fallidas y la sincronización finaliza con un código distinto de cero como cualquier fallo parcial.
- **Informes.** `sync` imprime una línea por par, p. ej. `[FALLBACK] en:crk — 6 key(s) the primary (api) could not translate safely → translated by llm-coached (4 accepted, 2 still failing)`. El resumen de `--json` indica por par qué hizo el fallback (`method`, `attempted`, `accepted`, `failed`, `cached`): en cada entrada de `locales` para archivos clave-valor, en `fallback` para JSON de Docusaurus y en `content.fallback` para Markdown. `champollion status` muestra el fallback bajo su par. `--dry` no puede saber qué fallará, por lo que no informa nada sobre el fallback.
- **Cuando el fallback escribió la mayor parte.** Cuando más de la mitad de las traducciones nuevas de una ejecución para un par (las respuestas aceptadas del método del par más las del fallback) provinieron del fallback, `sync` agrega una advertencia: cuántas de cuántas, mediante qué método y modelo, por qué no se usaron las respuestas del método del par (cada motivo contabilizado: una oración memorizada repetida para diferentes cadenas de origen, aumento desmedido de longitud, …) y qué considerar: puede que el método del par no sea adecuado para estas cadenas; compruebe lo que se escribió (`verify` comprueba la estructura, un hablante comprueba el significado); un fallback más potente. Las entradas de `--json` llevan `primaryAccepted` y `primaryReasons` junto a `accepted`. `champollion status` proporciona la misma proporción para los archivos ("del fallback: 8 valor(es) en los archivos (…) — 8 de los 8 que escribió sync (100%)"), e indica cuándo se trata de la mayor parte del texto de la configuración regional.
- `champollion serve` también utiliza el fallback, dentro de sus límites `--max-cost-per-request` / `--max-session-cost`.

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
      "model": "google/gemini-3.1-pro-preview",
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
| `register` | `string` | Instrucciones de estilo/tono. Puede ser una **clave preestablecida** (por ejemplo, `casual-tu`, `formal-hapsyo`) o texto personalizado. Consulte [Fichas de idiomas](/docs/reference/supported-languages#language-cards). |
| `name` | `string` | Nombre legible del idioma (para visualización del estado) |
| `model` | `string` | Invalida el modelo predeterminado |
| `temperature` | `number` | Invalida la temperatura predeterminada |
| `batchSize` | `number` | Invalida el tamaño de lote predeterminado |
| `coachingFile` | `string` | Ruta a un archivo de prompt de entrenamiento para este idioma, leída en relación con el proyecto; reemplaza el entrenamiento de nivel superior, y un archivo que no se pueda leer detiene la ejecución |
| `promptContext` | `string` | Contexto de la aplicación para este idioma |
| `genderGuidance` | `string` \| `false` | Instrucción de género para los prompts de este idioma: su propio texto, o `false` para ninguno. Consulte [Orientación sobre género](#gender-guidance). |
| `maxRetries` | `number` | Presupuesto máximo de reintentos para lotes fallidos (predeterminado: 3) |
| `script` | `string` | Código ISO 15924 de la ortografía que Champollion escribe (por ejemplo, `"Cans"`, `"Piqd"`). Consulte [Conversión de escritura](#script-conversion). |
| `scriptFallback` | `object` | Reglas de transliteración para letras que el convertidor de escritura no puede asignar. Consulte [Conversión de escritura](#script-conversion). |
| `endpoint` | `string` | URL del endpoint de API remota, para `"method": "api"` |
| `fallback` | `object` | Un segundo método para lo que el método de este idioma no pueda traducir de forma segura. Consulte [Método de reserva (fallback)](#fallback). |

:::info[Cadena de herencia]
La configuración se resuelve en este orden (el primero gana):

**nivel de par** → **nivel de idioma** → **configuración global** → **valores predeterminados**

Por ejemplo, si `pairs["en:fr"]` establece `model`, anula tanto el nivel de idioma como los valores globales de `model`.
:::

### Orientación sobre género {#gender-guidance}

Los prompts de LLM incluyen una instrucción sobre el género gramatical para los idiomas que lo tienen. Proviene del catálogo de Champollion: el francés solicita *écriture inclusive* con el punto medio cuando se desconoce el género del lector (`Connecté·e`, no `Connecté(e)` ni `Connectée`; `Utilisateur·rice·s` en plural), el alemán la forma con dos puntos (`Benutzer:innen`), el japonés el neutro `私`. `champollion init` la muestra junto al registro de cada idioma y `champollion status` la muestra por par, junto con su procedencia.

Elija otro estilo con `genderGuidance`, para todos los idiomas o para uno solo:

```json
{
  "languages": {
    "fr": { "register": "formal-vous", "genderGuidance": "Use the masculine generic (Connecté), as the Académie française recommends." },
    "de": { "register": "formal-Sie", "genderGuidance": false }
  }
}
```

`false` no envía ninguna instrucción de género; una cadena reemplaza la del catálogo. La configuración se aplica a los métodos que aceptan instrucciones (los métodos LLM); a los motores de traducción automática (DeepL, Google, …) no se les indica. Una instrucción de género modificada constituye un prompt diferente, por lo que tiene sus propias entradas en la caché: lo que ya está traducido permanece como está hasta que lo vuelva a traducir (`champollion sync --redo all`, lo cual sync sugiere cuando los archivos contienen el estilo anterior).

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

Champollion crea `.champollion.lock` para rastrear los hashes SHA-256 de los valores de origen traducidos. **Haga commit de este archivo** para que todos los desarrolladores compartan la misma línea base de traducción. En un proyecto con una carpeta por idioma, las claves se registran como `<namespace>::<key>`.

Por cada configuración regional de destino, el archivo de bloqueo también registra una huella digital de cada valor que sync escribió y del texto de origen que tradujo (de modo que se reconozca un valor que una persona editó y se informe una traducción desactualizada), las claves que un redo no pudo terminar (**pending**) y las claves que el control de calidad rechazó (**held back** del mismo modelo). Con cualquiera de estos datos para registrar, el archivo adopta su formato de versión 2, `{"version": 2, "source": {…}, "locales": {…}}`; un archivo de bloqueo de versión 1 (un mapa plano clave → hash) se lee como antes. Una edición manual reemplazada se conserva en `.champollion-replaced-edits.jsonl` junto a él; haga commit de ambos. Consulte [Control de calidad](/docs/concepts/quality-gate#refused-keys-are-held-back) y [Edición de traducciones](/docs/guides/professional-translators#editing-key-value-files).

Cuando cambia un valor de origen, el hash ya no coincide, y champollion retraduce esa clave en la siguiente sincronización.

## `.champollionignore`

Cree `.champollionignore` en la raíz de su proyecto para excluir archivos del escaneo de `lint`. Utiliza patrones glob, como `.gitignore`:

```text title=".champollionignore"
src/components/legacy/**
src/utils/constants.js
**/*.test.js
```

## Directorio `.champollion/`

Champollion crea un directorio `.champollion/` en la raíz de su proyecto para el estado interno. Manténgalo fuera del control de versiones: es una caché por máquina, no código fuente del proyecto. `champollion init` agrega esta línea a `.gitignore`, creando el archivo si no existe ninguno (también en una carpeta que aún no sea un repositorio git, para que un `git init` y `git add --all` posteriores no hagan commit de la caché):

```gitignore
.champollion/
```

Haga commit de los archivos de bloqueo situados junto a él (`.champollion.lock`, `.champollion-content.lock`): registran a partir de qué texto de origen se realizó cada traducción.

| Archivo | Propósito | ¿Hacer commit? |
|------|---------|--------|
| `tm.json` | Caché de la memoria de traducción: almacena traducciones anteriores indexadas por texto de origen + configuración regional + método | No (caché local) |
| `xliff/*.xliff` | Archivos de exportación XLIFF para revisión por traductores profesionales | No (transitorio) |
| `methods/` | Manifiestos de complementos de métodos instalados | Ignorado por la línea `.champollion/`. Para compartir complementos instalados, reemplace esa línea por `.champollion/*` y `!.champollion/methods/` |
| `backups/` | Copias de seguridad previas al ajuste de línea (creadas por `wrap --undo`) | No (red de seguridad) |

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
| `DirectLLMMethod` | Clase base para proveedores directos de LLM (OpenAI, Anthropic, Gemini) |
| `OpenAIMethod`, `AnthropicMethod`, `GeminiMethod` | Clases de proveedores directos de LLM |
| `DeepLMethod`, `MicrosoftTranslatorMethod`, `LibreTranslateMethod`, `TildeMethod`, `TranslatedMethod` | Clases de TA tradicional |
| `GoogleTranslateMethod` | Google Cloud Translation |
| `LLMCoachedMethod` | LLM entrenado (OpenRouter + datos de entrenamiento) |
| `APIMethod` | Cliente de API remota |
| `runSync`, `runContentSync` | Canalización de sincronización completa |
| `translateWithFallback`, `translateAndValidate` | Canalización de un par para un lote de claves, tal como la ejecuta `sync`: caché, método, control de calidad, caché, y luego el fallback del par. Pase un par desde `resolvePairs`, `tm` desde `loadTM`, y `cwd`, el directorio del proyecto: el método lee allí su clave, endpoint, entrenamiento y glosario, no desde `process.cwd()` |
| `createFallbackBudget` | La protección de `--max-cost` para lotes de fallback (`{ maxCost, committed, cwd }`) |
| `discoverLocaleLayout`, `resolveLocaleFiles` | Los archivos que componen cada configuración regional (plano, carpeta por configuración regional o `localesPattern`) |
| `resolveConfig`, `resolvePairs` | Resolución de configuración |
| `validateTranslations` | Control de calidad |
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
