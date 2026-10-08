---
sidebar_position: 5
title: "Traducción de Contenido"
---

# Traducción de contenido (Markdown)

Champollion traduce archivos Markdown y MDX, tanto los campos del front matter como el cuerpo del texto. Los bloques de código, shortcodes y otros elementos estructurados quedan protegidos de la traducción.

Los archivos residen en un **directorio de contenido** (`contentDir`). Puede ser cualquier carpeta con archivos Markdown: el `content/` de un sitio Hugo o una carpeta de boletines dentro de una aplicación Next.js. Un sitio Docusaurus (uno con `docusaurus.config.js`) es diferente: sus carpetas `docs/` y `blog/` se traducen en carpetas `i18n/<locale>/` sin `contentDir`. Consulte [Integración con frameworks](/docs/guides/framework-integration).

## Configuración

Defina `contentDir` en su configuración o pase `--content-dir` en la línea de comandos:

```json title="champollion.config.json"
{
  "version": 3,
  "inputLocale": "en",
  "localesDir": "./messages",
  "contentDir": "./newsletters"
}
```

```bash
npx champollion sync                              # translates string files and content files
npx champollion sync --content-dir ./newsletters  # same, folder given on the command line
```

Al inicio de una ejecución, sync indica el nombre de la carpeta e informa dónde se guardarán las traducciones:

```
[INFO] Content directory: newsletters — a folder of Markdown/MDX files (no Hugo site found); each translation is written beside its source as <name>.<locale>.md
```

En un sitio Hugo también indica los indicios que encontró, por ejemplo `Detected framework: Hugo (hugo.toml)`. Hugo se considera detectado cuando existe un archivo `hugo.toml`/`.yaml`/`.yml`/`.json`, la carpeta `config/_default/` de Hugo, un `config.toml` o `config.yaml` con una configuración exclusiva de Hugo como `baseURL`, una carpeta `archetypes/` o una carpeta `layouts/` con plantillas de Hugo. Con Hugo o sin él, los archivos se traducen y se nombran de la misma manera.

## Dónde se guardan las traducciones

Cada traducción se escribe **junto a su archivo de origen**, agregando el locale de destino antes de la extensión. Esta es la convención de traducción por nombre de archivo de Hugo:

```
newsletters/2026-10.md      → newsletters/2026-10.crk.md
newsletters/2026-10.md      → newsletters/2026-10.fr.md
posts/launch.mdx            → posts/launch.crk.mdx       (.mdx stays .mdx)
posts/launch.en.md          → posts/launch.crk.md        (the source-language suffix is dropped)
```

Las subcarpetas también se exploran, y cada traducción permanece en la carpeta de su archivo de origen. Su aplicación selecciona el archivo correspondiente a un locale mediante ese nombre. Una página de Next.js, por ejemplo, lee `newsletters/2026-10.crk.md` para cree de las llanuras.

**Qué archivos cuentan como fuentes.** Cada archivo `.md` y `.mdx` en la carpeta es una fuente, a menos que su nombre termine en `.<code>.md` (o `.mdx`) y `<code>` parezca un código de idioma. Un código de idioma aquí consiste en dos o tres letras minúsculas, seguidas opcionalmente por una variante de escritura como `-Hant` y/o una región como `-BR` o `-419`. Esos archivos se consideran traducciones y se omiten. Un sufijo de idioma de origen (`launch.en.md`) sigue contando como fuente. Una trampa común: un archivo fuente llamado, por ejemplo, `guide.faq.md` también termina en un sufijo de dos a tres letras, por lo que se toma como una traducción a "faq" y no se traduce. Cámbiele el nombre, por ejemplo a `guide-faq.md`.

## Qué se traduce

### Front Matter

Se admiten delimitadores YAML (`---`) y TOML (`+++`). Por defecto, estos campos se traducen:

- `title`
- `description`
- `summary`
- `subtitle`
- `caption`
- `linkTitle`
- `sidebar_label`

Todos los demás campos (`date`, `draft`, `tags`, `weight`, `slug`, etc.) se copian del origen tal como están. Puede modificar esta lista mediante `translatableFields` en su configuración.

### Contenido del cuerpo

De forma predeterminada, el cuerpo se divide en párrafos y otros bloques de nivel superior, y cada bloque se traduce por separado. Los elementos estructurados se protegen con marcadores de posición antes de la traducción y se restauran después. Con `contentSegmentation: "page"`, el cuerpo se traduce como una sola pieza.

## Protección de bloques

Estos elementos pasan a través de la traducción sin cambios:

| Elemento | Ejemplo | Protección |
|---------|---------|-----------|
| Bloques de código | ``````` ```js ... ``` ``````` | Bloque completamente protegido |
| Código en línea | `` `variable` `` | Protegido |
| Shortcodes de Hugo | `{{< figure >}}`, `{{% note %}}` | Bloque completamente protegido |
| HTML sin procesar | `<div>`, `<table>` | Protegido |
| Enlaces (URLs) | `[text](https://...)` | URL preservada, texto traducido |
| Interpolación | `{{ .Count }}` | Protegido |

## Cuándo se vuelve a traducir un archivo

Sync registra una huella digital (SHA-256) de cada archivo de origen en `.champollion-content.lock`. Confirme ese archivo en el repositorio junto con sus traducciones.

- **Fuente sin cambios:** la traducción no se modifica.
- **Fuente con cambios:** el archivo se actualiza. Los párrafos cuyo texto en inglés no haya cambiado provienen de la [Memoria de traducción](/docs/concepts/translation-memory) sin costo alguno, por lo que solo paga por los párrafos que cambiaron.
- **Un archivo de traducción sin entrada de bloqueo** (uno que usted haya escrito a mano) se mantiene tal como está y se registra como suyo. La excepción es un archivo que todavía contenga marcadores `[EN] ` escritos por una versión de la CLI anterior a 0.5.0, el cual se vuelve a traducir.
- **Un bloque rechazado por el control de calidad, incluso tras solicitarse de nuevo con el motivo,** conserva su texto de origen, sin ningún marcador en la página. La entrada de bloqueo de la página muestra `pending:<hash>` y el rechazo se registra en `.champollion-content.lock`. Las sincronizaciones posteriores no vuelven a enviar ese bloque al mismo modelo, por lo que no se vuelve a facturar. `status` y `verify` listan la página. Vuelva a solicitarlo con `--redo files:<page>`, agregue un método `fallback` o escriba el párrafo usted mismo (se conservará). Un campo de front-matter rechazado conserva su texto de origen de la misma manera, y se escribe el resto de la página. Consulte [Bloques de Markdown y campos de front-matter rechazados](/docs/concepts/quality-gate#refused-markdown-blocks-and-front-matter-fields).

Para volver a traducir un archivo deliberadamente, especifique su nombre. La ruta es la que muestra sync, relativa al directorio de contenido:

```bash
npx champollion sync --redo files:2026-10.md          # rebuild from the cache (free for unchanged text)
npx champollion sync --redo files:2026-10.md --fresh  # translate it again from scratch (paid again)
```

## Revisión y edición de traducciones {#reviewing-and-editing-translations}

Un revisor puede corregir el contenido Markdown traducido directamente en el archivo resultante. Champollion conserva esas correcciones cuando el archivo de origen cambia más adelante.

1. Ejecute `champollion sync` y confirme las traducciones junto con `.champollion-content.lock` en el repositorio.
2. El revisor abre el archivo traducido, por ejemplo `newsletters/2026-10.crk.md`, y lo edita. Puede modificar cualquier párrafo o un campo traducido del front matter, como `title` o `description`.
3. El revisor confirma el archivo en el repositorio. No se requiere ningún comando para "aceptar" las ediciones.

Qué sucede con las modificaciones en el siguiente `champollion sync`:

| Situación | Qué hace sync |
|---|---|
| El origen no ha cambiado | Nada. La traducción se deja exactamente como la dejó el revisor. |
| El origen cambió en **otros** párrafos | Los párrafos y campos del revisor se **conservan textualmente** y se traducen los párrafos modificados. La ejecución lo indica, por ejemplo con `kept the edits made by hand to 1 paragraph(s) of 2026-10.crk.md`. El texto del revisor se mantiene en cada sincronización posterior. |
| El párrafo de origen que el revisor editó **también** cambió | Ese párrafo se vuelve a traducir, ya que la versión del revisor traduce un texto en inglés que ya no existe. La ejecución muestra una advertencia con la redacción del revisor para que pueda reaplicarse si aún resulta adecuada. |
| El revisor agregó, eliminó o combinó párrafos, o el par utiliza `contentSegmentation: "page"` | Las ediciones no pueden asociarse párrafo por párrafo. Cuando el origen cambia, el archivo se **deja exactamente como está**, y cada sincronización genera una advertencia y lo incluye en la lista hasta que se resuelva. Actualícelo manualmente (la siguiente sincronización tomará el archivo editado como actual) o reemplácelo con traducción automática usando `--redo files:<path>`. |

Las modificaciones en bloques de código, espacios en blanco entre párrafos y campos del front matter que no se traducen (`date`, `tags`, etc.) no se conservan cuando el archivo se reescribe. Esas partes siempre se toman del origen.

**Reemplazar las ediciones deliberadamente.** Las ediciones solo se reemplazan cuando usted especifica el archivo. `--redo files:2026-10.md` restaura la traducción automática en caché. `--redo files:2026-10.md --fresh` (o `--retranslate 2026-10.md`) lo vuelve a traducir desde cero. Una ejecución que reprocesa todo el contenido sin especificar nombres de archivos (`--redo content`, `--force-content`) conserva las ediciones.

**Cómo se reconocen las ediciones.** Cada vez que sync escribe una traducción, también registra en `.champollion-content.lock` una huella digital corta de cada párrafo escrito. Un párrafo en disco que ya no coincida significa que fue modificado por una persona. Si se pierde el archivo de bloqueo, las ediciones no podrán reconocerse, así que consérvelo en el control de versiones. Una traducción escrita por una versión anterior de Champollion se registra en la siguiente sincronización. Si sus ediciones difieren de lo almacenado en la Memoria de traducción, se reconocerán como propias.

El texto del revisor nunca se almacena en la Memoria de traducción como salida generada por máquina.

:::note[XLIFF solo aplica a archivos de cadenas]
`champollion xliff export` transfiere los **archivos de cadenas** de su aplicación (claves y valores) a la herramienta TAO de un traductor. Consulte [Trabajar con traductores profesionales](/docs/guides/professional-translators). Aún no existe exportación a XLIFF para contenido en Markdown, por lo que el Markdown traducido se revisa directamente en los propios archivos, como se describió anteriormente.
:::

## Métodos solo para Markdown

:::warning[Google Translate y Markdown]
Google Translate **no reconoce** bloques de código, shortcodes ni variables de interpolación. Corromperá el contenido estructurado de Markdown. Utilice métodos basados en LLM (`llm` o `llm-coached`) para la traducción de contenido, ya que estos protegen explícitamente los elementos estructurados.
:::

Cuando la traducción de contenido retrocede desde Google Translate a un método LLM, champollion registra una advertencia explicando por qué.
