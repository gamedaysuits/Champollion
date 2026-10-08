---
sidebar_position: 3
title: "Control de Calidad"
related:
  - label: "Coaching Data"
    to: /docs/concepts/coaching-data
    kind: concept
  - label: "Script Converters"
    to: /docs/concepts/script-converters
    kind: concept
  - label: "Scoring Specification"
    to: /docs/network/specifications/scoring
    kind: arena
    note: "How quality is scored on the public benchmark"
  - label: "Cookbook: Translate 30 Languages"
    to: /docs/tutorials/translate-30-languages
    kind: cookbook
    note: "Audit quality across 30 locales"
---

# Puerta de Calidad

Cada traducción pasa por una puerta de validación determinística antes de escribirse en disco. La puerta de calidad detecta modos de fallo comunes en traducción automática — sin fallbacks silenciosos, sin basura escrita en sus archivos de locale.

## Controles de Validación

| Verificación | Qué detecta | Etiqueta del gate |
|--------------|-------------|-------------------|
| **Vacío/en blanco** | El modelo devolvió una cadena vacía o espacios en blanco | `[GATE] empty` |
| **Eco del origen** | El modelo devolvió la entrada original en inglés, tal como estaba o disfrazada (acentos, mayúsculas/minúsculas, caracteres de ancho completo), en todo el valor o en una forma plural | `[GATE] source-echo` |
| **Estructura de ICU / marcadores de posición** | Una variable traducida, una palabra clave o selector de plural, o un `#` o `%s` perdido | `[GATE] icu` |
| **Marcado** | Una etiqueta abierta, cerrada o anidada de forma diferente a la del origen | `[GATE] markup` |
| **Salto de oración junto a un marcador de posición** | Un final de oración que la traducción coloca justo antes o después de un marcador de posición donde el origen no tiene ninguno: `Take this medicine at {time}.` → `… sina. {time}.` | `sentence break beside a placeholder` |
| **Bucle de alucinación** | Patrones de trigramas repetidos (p. ej., `"Qo' Qo' Qo'"`) | `[GATE] hallucination` |
| **Inflación de longitud** | La salida es significativamente más larga que el origen | `[GATE] length` |
| **Eliminación de contenido** | La salida es el origen sin sus letras | `[GATE] content` |
| **Cumplimiento del sistema de escritura** | Sistema de escritura incorrecto para la configuración regional de destino | `[GATE] script` |
| **Misma salida, diferentes entradas** | Un mismo texto devuelto para varias cadenas de origen diferentes (una oración memorizada) | `[GATE] shared-output` |
| **Categorías de plural de ICU** | Formas de plural requeridas faltantes para la configuración regional | `[GATE] icu-plural` |

Las claves declaradas como [`noTranslate`](/docs/getting-started/configuration#no-translate) nunca llegan al gate: se copian textualmente del origen, por lo que no hay nada que validar.

**Las páginas Markdown reciben las mismas verificaciones, bloque por bloque.** En una carpeta de contenido (`contentDir`, documentación de Docusaurus), cada encabezado, párrafo, elemento de lista y celda de tabla se verifica de forma individual, al igual que cada campo de front matter. Las verificaciones son las mencionadas arriba: vacío, eco de origen, bucle de alucinación, inflación de longitud, eliminación de contenido, sistema de escritura y misma salida para entradas diferentes. Un encabezado corto como `## Feast` que se devuelve como una oración completa es rechazado, tal como ocurre con la clave de la aplicación con el mismo texto.

Un bloque rechazado se **solicita una vez más, indicando el motivo**. Se le informa al modelo qué estuvo mal y que el texto que sea correcto tal como está escrito puede devolverse sin cambios. Algunos rechazos no pueden decidirse mediante ninguna regla fija: un encabezado que es un nombre (`### BLEURT (Sellam et al., 2020)`), una entrada de lista de referencias, una tabla de códigos o una glosa pueden ser correctos exactamente como están escritos, o pueden ser una traducción omitida. Si el bloque se devolvió sin cambios, o se mantuvo en alfabeto latino en un idioma que no usa el alfabeto latino, y el modelo da la misma respuesta nuevamente, esa respuesta se acepta como deliberada. Cualquier otro rechazo debe superar el control de calidad directamente en la segunda respuesta. A un endpoint que declare que no sigue instrucciones (`"acceptsInstructions": false`) no se le vuelve a consultar; su primera respuesta se evalúa como una segunda respuesta.

Lo que aún sea rechazado pasa al método `fallback` del par. Sin uno, **el bloque conserva su texto de origen, sin agregar ningún marcador a la página**, nunca se guarda en caché y la entrada de lock de la página indica `pending:<hash>`. `status` y `verify` listan dichas páginas, y la sincronización nombra cada bloque. El rechazo se recuerda: la siguiente sincronización simple no volverá a enviar ese bloque al mismo modelo (consulte [Bloques de Markdown y campos de front matter rechazados](#refused-markdown-blocks-and-front-matter-fields)). El código, los enlaces y el marcado dentro de un bloque se protegen por separado, y nunca se envía un comentario HTML. Cierto texto se conserva tal como está escrito sin consultar al respecto:
- un nombre corto (`## GitHub`), medido sin su código en línea, comillas, paréntesis ni `{#anchor}`;
- una entrada de lista de referencias, o una lista de referencias completa en un solo bloque;
- letras de ancho completo que el propio origen muestra.

Una tabla se evalúa por sus celdas, no por sus plecas ni su fila delimitadora. `verify` verifica los bloques que ya están en el disco de la misma manera, excepto aquel que sea exactamente lo que la sincronización aceptó y almacenó en caché para su origen. Un bloque que falla genera una advertencia, lo que hace fallar a `verify --strict`, y viene acompañado del comando de reparación `champollion sync --pair en:fr --redo files:<page>`. La sincronización imprime el mismo comando para el mismo archivo.

### Vacío/En Blanco

Rechaza traducciones que sean cadenas vacías, solo espacios en blanco, o `null`. Esto detecta modelos que no devuelven nada para claves difíciles.

### Eco de Fuente

Detecta cuando el modelo devuelve el texto de origen en inglés en lugar de traducirlo. Es común con cadenas cortas e instrucciones poco especificadas en el prompt. Se aplican dos reglas, y miden cosas diferentes:

1. **Una copia exacta** (byte por byte idéntica al origen) se rechaza, excepto en el caso de un valor **corto y compuesto principalmente por caracteres ASCII**: 30 caracteres o menos, más del 80 % de ASCII simple. `"Blog"`, `"GitHub"` y `"npm"` permanecen legítimamente en inglés, por lo que en un destino con alfabeto latino dicha copia se acepta (`verify` la lista como eco del origen); en un destino que no use alfabeto latino, se le pregunta al modelo una vez si se trata de un nombre, y la misma respuesta dada dos veces se acepta como tal. **Esta exención se basa en la longitud y solo cubre copias exactas.**
2. **Una copia disfrazada** (el origen en el que solo han cambiado mayúsculas y minúsculas, acentos, espaciado, caracteres invisibles o formas de compatibilidad [letras de ancho completo, ligaduras]) se rechaza cuando el origen tiene **tres o más palabras** con letras (los marcadores de posición como `{count}` o `%s` y las etiquetas de marcado no cuentan), **sin importar lo corto que sea**. `"Book an appointment"` (19 caracteres, 3 palabras) → `"Bóok án appóintment"` se rechaza; `"cafe"` → `"café"` (1 palabra) se acepta, porque una traducción real puede diferir del inglés únicamente por sus acentos. Un nombre más largo que adquiere acentos legítimamente (`"Universite de Montreal"`) se acepta una vez que declare la ortografía acentuada como un término protegido.

Ambas reglas se aplican también **a cada forma de plural**. Un plural `msgstr[n]` de gettext, una rama `{n, plural, …}` de ICU o una clave `_one`/`_other` de i18next están sujetos a las mismas reglas que un valor en singular: un plural en ruso cuya forma `few` se devolvió como el texto en inglés con acentos se rechaza al igual que se rechazaría el singular.

Los valores más largos que también son correctos sin cambios (URL, rutas de repositorios, identificadores de productos) no son un problema del gate y no pueden corregirse ajustándolo: la respuesta correcta *es* el eco, por lo que cualquier salida posible del modelo sería incorrecta. Declare esas claves con [`noTranslate`](/docs/getting-started/configuration#no-translate) y omitirán el pipeline por completo. Las claves con valores de URL se manejan de esa manera de forma predeterminada.

### Bucle de Alucinación

Analiza patrones de trigramas (3 caracteres) en la salida. Si algún trigrama se repite más que un número umbral relativo a la longitud de la salida, la traducción se rechaza. Esto detecta salidas degeneradas como `"Qo' Qo' Qo' Qo' Qo'"`.

### Inflación de Longitud

Rechaza las traducciones cuya longitud de salida supera `maxLengthRatio × source length` (por defecto: 4×); estrictamente más: una traducción de exactamente 4× se aprueba. Esto detecta alucinaciones del modelo que producen muros de texto a partir de una entrada corta.

Configurable mediante `maxLengthRatio` en su configuración.

### Eliminación de contenido

El reflejo inverso de la inflación de longitud. Un modelo sin vocabulario para una cadena puede eliminar cada letra que no puede traducir y dejar intactos los signos de puntuación y el espaciado del origen:

```
"low-resource nmt · tokenizers · nêhiyawêwin"  →  "   ·   · êhiêi"
"the simple-builder approach"                  →  "  "
```

Ningún otro control detecta esto. No está vacío, no es un eco, no es repetitivo y, al tener el 33 % de la *longitud* del origen, supera `minLengthRatio` sin problemas.

La verificación compara los **caracteres de contenido** (letras y dígitos, ignorando puntuación, espacios en blanco y formato invisible) entre el origen y la salida. Sin embargo, la densidad por sí sola no puede ser la regla, porque sistemas de escritura legítimamente densos se ubican exactamente en el mismo rango:

| Origen | Salida | Contenido retenido | Veredicto |
|--------|--------|--------------------|-----------|
| `low-resource nmt · tokenizers · nêhiyawêwin` | `   ·   · êhiêi` | 14% | **rechazado** |
| `Getting started` | `入门` | 14% | aceptado |
| `Frequently asked questions` | `常见问题` | 17% | aceptado |

Cualquier umbral que detecte el primer caso rechaza el chino, el japonés y el coreano por completo. Lo que los distingue no es cuánto sobrevivió, sino *de dónde provino*: la salida vaciada es una **subsecuencia** de su propio origen (se puede producir eliminando caracteres de este), mientras que una traducción real prácticamente no comparte nada con el origen. Una marca requiere **ambas** señales, por lo que la comprobación es necesaria pero no suficiente, de la misma manera que el detector de repeticiones.

Configurable mediante `minContentRetention` (por defecto `0.35`), por par o por idioma. Aumentarlo hace que la verificación sea más estricta; solo se activa junto con la señal de subsecuencia.

:::note[Esta es una señal de vocabulario, no un ajuste de calidad]
Cuando esto se activa repetidamente para un idioma de destino, el modelo no tiene palabras para ese texto; por lo general, se trata de cadenas cortas y cargadas de tecnicismos en un idioma con un léxico cerrado. Relajar el umbral restaura la corrupción silenciosa; no produce una traducción. Corrija el prompt, los datos de coaching o el par.
:::

### Cumplimiento de Script

Para las configuraciones regionales cuya tarjeta de idioma registra una escritura no latina (árabe, CJK, cirílico, …), valida que la salida no sea solo latina. Las letras se clasifican por **escritura Unicode**, no por byte: el latín con acentos (`"Bóók"`) y el latín de ancho completo (`"Ｂｏｏｋ"`) son latinos, por lo que ninguno pasa por ruso. Las letras latinas de ancho completo se rechazan en cualquier destino fuera de la tipografía CJK (donde `"ＯＫ"` es de uso habitual en japonés); son inglés disfrazado. Se mantienen las excepciones habituales: un nombre corto conservado tal como se escribió (la cuestión anterior sobre nombres o etiquetas), los términos protegidos declarados y las claves `noTranslate` (las URL entre ellas) nunca la hacen fallar.

Dos aclaraciones sobre lo que *no* es esta verificación:

- **No depende del campo de configuración `script:`.** Ese campo selecciona la ortografía de salida para la [conversión de sistema de escritura](/docs/getting-started/configuration#script-conversion); la expectativa del gate proviene de las fichas de idioma.
- Siempre valida el **sistema de escritura de trabajo que emite el modelo**, *antes* de cualquier conversión de escritura. Las configuraciones regionales con un conversor de escritura (crk, sr, tlh, …) generan correctamente salidas en sistema de escritura de trabajo latino, por lo que están exentas de esta comprobación; la conversión (si la configuración la habilita) ocurre después del gate.

### Marcado

Las etiquetas son código. Por cada nombre de etiqueta, la traducción debe abrir, cerrar y autocerrar la misma cantidad de etiquetas que el origen, anidándolas de la misma manera (`<b>` dentro de `<a>` permanece dentro de `<a>`); el orden entre hermanas puede cambiar según el orden de las palabras. `"Please <strong>book</strong> now"` → `"Veuillez <strong>réserver maintenant"` se rechaza: la pérdida de una etiqueta de cierre rompe la página. En un mensaje plural, cada forma se compara con la forma de origen que traduce. `verify` ejecuta la misma comprobación en los archivos.

### Salto de oración junto a un marcador de posición

Un marcador de posición se completa en tiempo de ejecución, por lo que un final de oración que la traducción coloque justo al lado cambia lo que ve el lector: `"Take this medicine at {time}."` → `"… sina. {time}."` muestra la hora como una oración independiente. El gate rechaza una traducción que coloque un signo de final de oración (`.`, `!`, `?` u otro signo de puntuación de otro sistema de escritura: `。`, `？`, `।`, `؟`, `።`, `᙮`, …) justo **antes** de un marcador de posición, o justo **después** de uno si continúa más texto, cuando el origen no tiene ninguna marca allí y la traducción tiene más finales de oración que el origen. Un marcador de posición que simplemente se mueve al final de la oración (`"Shipped by {carrier} on {date}."` → `"Expédié le {date} par {carrier}."`) se aprueba. También se aprueban puntos suspensivos, un número decimal o un nombre de archivo (`{host}.com`), y una abreviatura de una sola letra (`"M. {name}"`). Una abreviatura más larga delante de un marcador de posición (`"ca. {count}"`) no se puede distinguir del final de una oración, por lo que también se rechaza, y el fallback del par, o una respuesta reformulada, se hace cargo. `verify` señala los mismos valores en disco, junto con el comando `--redo` para volver a solicitar la traducción. Los mensajes de plural y select de ICU se delegan a la comprobación de ICU.

### Misma salida, diferentes entradas

Un modelo que memorizó una oración de entrenamiento puede devolverla para cadenas que no conoce: una sola oración para el título de la aplicación, "Contact the school", el título de un boletín informativo y su encabezado, donde cada uno supera todas las comprobaciones anteriores por sí solo. Cuando una misma traducción responde a **tres o más cadenas de origen diferentes** durante la ejecución de una configuración regional —y tiene cuatro o más palabras, o cada origen tiene dos o más palabras con poco en común—, esas claves se rechazan (de modo que el reintento, y luego el fallback, se hacen cargo de ellas). **Dos** cadenas de origen diferentes son suficientes cuando la evidencia es contundente: ambas tienen dos o más palabras, comparten menos de la mitad de sus palabras y la traducción compartida tiene cuatro o más palabras (`"Thank you for coming!"` y `"Please bring the forms."` respondidas con una sola oración). Una oración detectada de esta manera se recuerda para esa configuración regional: una sincronización posterior que la reciba nuevamente, incluso para una sola cadena, la rechazará, y las entradas de caché que ya la hayan servido se eliminarán, por lo que una repetición volverá a consultar al modelo en lugar de escribirla desde la caché. Los sinónimos que convergen en una traducción corta (`"OK"`/`"Okay"`/`"Sure"` → `"D'accord"`, `"Close"`/`"Dismiss"` → `"Fermer"`) se aprueban, al igual que un mismo texto de origen utilizado bajo varias claves. Los bloques de Markdown y los campos de front matter de los archivos de contenido de la ejecución también cuentan, al igual que cada rama de un mensaje plural o select de ICU (las ramas de un plural cuentan como un solo origen; un idioma sin flexión numérica escribe el mismo texto en cada una). Las salidas se comparan sin distinguir mayúsculas de minúsculas, puntuación ni marcadores de bloque de Markdown, por lo que `"S?"`, `"S."` y el encabezado `# S` se consideran una misma salida. El recuento incluye lo que la configuración regional ya tiene en disco y lo que serviría la caché (una oración almacenada en caché texto por texto por otra herramienta se rechaza en la caché, no se escribe), por lo que una clave agregada en sincronizaciones individuales también se detecta. `verify` falla ante el mismo patrón en disco, y la herramienta de MCP `translate` lo rechaza dentro de una llamada.

### Una pregunta que perdió su signo

Cuando el origen termina con `?` o `!` y la traducción no termina ni con eso ni con el equivalente que usa su sistema de escritura (`？`, `؟`, el griego `;`, `¿…?`, `！`, …), `sync` y `verify` emiten una advertencia: `"Where does it hurt?"` escrito como una afirmación se lee como tal. Es una advertencia y no un rechazo porque algunos idiomas marcan las preguntas con una palabra o partícula en lugar de un signo de puntuación. La advertencia indica las claves y el comando `--redo keys:<key> --fresh` para volver a solicitar la traducción (`--fresh`, ya que la caché contiene la respuesta).

## Qué Sucede en Caso de Fallo

1. La traducción fallida se registra en stderr con el prefijo `[GATE]`, el nombre de la clave, el motivo y una vista previa del valor
2. La clave **no** se escribe en el archivo de la configuración regional
3. Se activa la cascada de reintentos (ver más abajo)
4. Si aún falla, el rechazo se **recuerda** (consulte [Las claves rechazadas se retienen](#refused-keys-are-held-back))

```
[GATE] hero.title: source-echo — "Welcome to our platform"
[GATE] nav.about: hallucination — "À À À À À À À À"
```

## Reintento con retroalimentación y la cascada de reintentos

Una clave rechazada por el gate recibe **un reintento con retroalimentación**: el motivo del rechazo se inserta en el prompt como contexto específico de la clave (un reintento a ciegas con baja temperatura devolvería una salida idéntica byte por byte). Si el reintento se aprueba, la clave se escribe y la sincronización queda en **verde**: un rechazo del gate que se autorrepara no es un fallo, y esta es la semántica prevista. Las claves que sigan fallando después del reintento se omiten y se notifican (la sincronización finaliza con `2`).

El reintento se ejecuta a través del propio método de traducción del par, sea cual sea: LLM, Google Translate, DeepL o un proveedor directo. Solo los métodos de LLM leen la retroalimentación; la línea de ejecución lo indica (`retrying with feedback` o `asking once more (deepl takes no instructions…)`). Un endpoint de `api` recibe la retroalimentación únicamente cuando declara `"acceptsInstructions": true` (en el par o en el manifiesto de su plugin); uno que declara `false` (un modelo de NMT entrenado como `nmt-forge serve`, que respondería lo mismo) no se vuelve a consultar en absoluto: sus respuestas se juzgan como se juzgaría una segunda respuesta, y lo que rechaza pasa al fallback del par. El reintento también se aplica a las coincidencias de la memoria de traducción: un valor en caché que el gate rechace se expulsa y se vuelve a traducir en la misma ejecución, de modo que una caché contaminada se repara a sí misma.

### Las claves rechazadas se retienen

El rechazo se recuerda en `.champollion.lock`, por clave, para el **texto de origen actual** de la clave y el **método y modelo** que produjeron la respuesta rechazada. Las cadenas de la interfaz de usuario de Docusaurus (`i18n/<locale>/code.json` y los archivos JSON de los plugins) siguen la misma regla, por archivo e id. La siguiente sincronización simple con `sync` no vuelve a enviar esa clave al mismo modelo (facturaría la misma respuesta) e indica cuántas se retuvieron y cómo proceder:

- volver a solicitar: `champollion sync --redo keys:<key>` (o `--redo all`, o `--fresh`); nombrar la clave es un reintento explícito;
- completarla de otra manera: agregue un método `"fallback"` al par (se le consultará por las claves que el método propio del par rechazó), liste la clave en `noTranslate` si se mantiene tal como está escrita o escriba la traducción a mano en el archivo.

Una clave retenida queda sin traducir, por lo que la sincronización finaliza con `2` hasta que se complete. Cambiar el texto de origen, el modelo o el método anula la retención (el rechazo fue para ese texto con ese modelo). La caché aún se consulta para esa clave: la retención detiene las llamadas de pago, no las gratuitas. Una clave que una repetición no pudo finalizar es la única excepción, que se detalla a continuación.

### Bloques de Markdown y campos de front matter rechazados

La misma regla se aplica a los archivos de contenido (`contentDir`, documentación de Docusaurus). Un bloque o campo de front matter que el gate haya rechazado se recuerda en `.champollion-content.lock`, por página, bloque y configuración regional, para el **texto de origen actual** del bloque y el **método y modelo** que produjeron la respuesta rechazada. Un bloque se identifica por su texto de origen, por lo que editar el párrafo anula la retención. La siguiente sincronización simple con `sync` no lo vuelve a enviar al mismo modelo e indica cuántos bloques y campos se retuvieron en qué página:

- un bloque retenido conserva su texto de origen en la página, sin ningún marcador, hasta que se complete; el resto de la página se escribe;
- un campo de front matter retenido conserva su texto de origen de la misma manera, y el resto de la página se escribe;
- una página traducida por completo (`contentSegmentation: "page"`) se rechaza por completo cuando su respuesta daña un bloque protegido o vacía la página. Se recuerda por el texto de su cuerpo y se retiene por completo: no se escribe y no se envía nada de ella hasta que se complete. Editar el cuerpo o cambiar a la segmentación por bloques levanta la retención.

Un rechazo generado por una versión anterior del control de calidad se levanta por sí solo. Cuando se flexibiliza una verificación, lo que esta rechazó se solicita de nuevo en la siguiente sincronización, sin necesidad de rehacer.

La precedencia es la misma que la de las claves:

1. Una página especificada para una repetición siempre se envía: `champollion sync --redo files:<page>`, `--redo content` (todas las páginas), `--retranslate` o cualquier elemento bajo `--fresh`.
2. De lo contrario, un bloque o campo rechazado se retiene. Si el par tiene un método `fallback` que no lo ha rechazado, se le solicita al fallback y no al método propio del par.
3. Un cambio de modelo o método anula la retención, al igual que una modificación en el texto de origen del bloque.

La caché aún se lee primero, por lo que la retención detiene las llamadas de pago, no las gratuitas. Un bloque completado de otra manera elimina su registro: mediante un fallback, mediante la caché o mediante un párrafo que usted mismo escriba en la traducción (una carpeta de contenido conserva los párrafos escritos a mano). Un bloque o campo retenido queda sin traducir, por lo que la sincronización finaliza con `2` hasta que se complete. Lo mismo ocurre con un bloque que el gate haya rechazado durante esta ejecución. Una ejecución de prueba (dry run) lista lo que una ejecución real retendría.

### Una repetición que no pudo completarse

Cuando `--redo all`, `--redo keys:` o un cambio de modelo (`--redo all --fresh-on-model-change`) dejan claves de un archivo clave-valor sin traducir, estas se registran como **pendientes** en `.champollion.lock`, y la siguiente ejecución simple de `sync` vuelve a solicitarlas al modelo; directamente del modelo, no de la caché (el propósito de la repetición era obtener el texto del nuevo modelo). `champollion status` las lista. Si ese reintento también se rechaza, la clave permanece pendiente (el estado lo indica) y se retiene como cualquier clave rechazada. En orden de precedencia: una clave indicada mediante `--redo`/`--fresh` siempre se envía; una clave pendiente recibe ese único reintento; una clave rechazada se retiene. Una cadena de la interfaz de usuario de Docusaurus no tiene reintento pendiente: si se rechaza durante una repetición, la siguiente sincronización simple la retiene, al igual que a un bloque de contenido.

Por separado, cuando un lote completo falla (error de análisis de JSON), champollion reintenta con lotes progresivamente más pequeños:

```
Full batch (80 keys) → parse error
  └→ Half batch (40 keys) → 2 failures
      └→ Individual keys (1 each) → isolates the 2 problem keys
```

El presupuesto de reintentos está limitado por `maxRetries` (predeterminado: 3, configurable por idioma). Esto previene gasto de tokens descontrolado en claves que fallan consistentemente.

Tras agotar los reintentos, las claves problemáticas se registran y se omiten. Una clave que no obtuvo una respuesta utilizable (ausente en la respuesta) se vuelve a solicitar en la siguiente sincronización con `sync`; una clave rechazada por el gate se retiene, como se indicó anteriormente.

## Almacenamiento en Caché de Prompts

El mensaje del sistema (registro, reglas gramaticales, notas de estilo) se separa del mensaje del usuario (las claves a traducir). Esta separación es intencional:

- El mensaje del sistema es **idéntico entre lotes** para un locale dado
- Proveedores como Anthropic y Google almacenan en caché mensajes del sistema repetidos
- Resultado: el primer lote paga el costo total de tokens, los lotes posteriores pagan solo por el mensaje del usuario

Esto puede reducir significativamente los costos de tokens para proyectos con muchos lotes.

## Validación de MessageFormat ICU

El comando `integrity` valida patrones plurales de MessageFormat ICU contra reglas plurales CLDR. Si su archivo fuente usa sintaxis ICU como:

```json
"items": "{count, plural, one {# item} other {# items}}"
```

Champollion verifica que las versiones traducidas incluyan todas las categorías plurales requeridas para el locale de destino. Por ejemplo, árabe requiere seis categorías (`zero`, `one`, `two`, `few`, `many`, `other`) — no solo `one` y `other`.

### Formas de plural no proporcionadas por la traducción

El prompt indica las categorías CLDR del idioma de destino. Cuando un mensaje plural se devuelve sin una de las formas que el idioma utiliza para recuentos comunes (cualquier cantidad de 0 a 1000: en ruso, `few` para 2, 3, 4 y `many` para 0, 5, 6), el gate le consulta al modelo una vez más, indicando las formas faltantes y las cantidades que cubren. Una segunda respuesta sin ellas se acepta, nunca se consulta una tercera vez y la herramienta nunca la completa por sí misma; en ese caso, la sincronización:

- emite una advertencia indicando cada clave y sus formas faltantes, junto con el comando para volver a solicitarla (`sync --redo keys:… --fresh`, donde un `--model` más potente ayuda);
- en un catálogo gettext, donde `msgfmt` necesita cada `msgstr[n]`, escribe las formas faltantes como copias de `other` y marca la entrada con un comentario de traductor `# champollion:` (Poedit y Weblate lo muestran; `verify` lo lee, incluso en CI sin la caché);
- en archivos ICU (next-intl, ARB), escribe el mensaje tal como llegó; la aplicación muestra la forma `other` para esos recuentos.

Dicho mensaje no se considera traducido. Una sincronización posterior que ejecute otro método o modelo (uno que aún no lo haya respondido, como el modelo alojado de CI después de uno local) volverá a solicitarlo directamente al modelo, no a la caché (que almacena la respuesta incompleta); la estimación calcula su costo. `sync --redo gaps` solicita cada uno de estos mensajes, sin importar quién lo haya dejado así. Si la nueva respuesta también carece de las formas, el mensaje permanece tal como estaba (marcado en un catálogo), y `.champollion.lock` registra qué configuraciones respondieron sin ellas, de modo que a ninguna de ellas se le vuelva a consultar para el mismo texto ([guía de CI](/docs/guides/ci-cd#plural-gaps)).

`verify` notifica ambos casos junto con el comando de reparación. Las formas alcanzadas únicamente por encima de 1000 o mediante fracciones (`many` en francés y español, utilizada para 1 000 000) reciben una línea informativa, no una advertencia. A un motor de traducción automática (DeepL, Google, …) no se le puede indicar qué formas escribir, por lo que su respuesta no se reintenta, solo se notifica. Para los archivos de i18next, cada forma que el origen no tiene (`count_many` en francés a partir del inglés) constituye su propia clave, traducida a partir del texto `_other`: a un LLM se le solicita esa forma y la sincronización así lo indica; con un motor de traducción automática, indica que el valor contiene la forma `other`.

Ejecute `champollion integrity` para verificar la completitud plural en todos los locales.

## Cumplimiento de Terminología

Para pares entrenados con un diccionario, champollion ejecuta una verificación de terminología posterior a la traducción. Después de que la puerta de calidad pase, verifica si el LLM realmente utilizó los términos de diccionario requeridos.

```
[TERM] en→fr: 2 term violation(s)
  • hero.title: "dashboard" → expected "tableau de bord" but got "panneau de contrôle"
```

Las violaciones de terminología son **advertencias, no errores bloqueantes**. La traducción aún se escribe en disco. Esto es intencional — el LLM puede tener razones válidas para elegir una alternativa (contexto, gramática), y bloquear en desajustes de términos causaría más daño que bien.

Para corregir violaciones, actualice el diccionario de entrenamiento o edite manualmente el archivo de locale.

---

## Consulte también

- [Cómo Funciona la Sincronización](/docs/concepts/how-sync-works) — dónde encaja la puerta de calidad en el pipeline
- [Métodos de Traducción](/docs/guides/translation-methods) — métodos que alimentan la puerta
- [Convertidores de Script](/docs/concepts/script-converters) — conversión de script posterior a la puerta
- [Datos de Entrenamiento](/docs/concepts/coaching-data) — mejora de la calidad de traducción antes de la puerta
- [Memoria de Traducción](/docs/concepts/translation-memory) — almacenamiento en caché de traducciones validadas
- [Referencia CLI — sync](/docs/reference/cli#sync) — flags de sync incluyendo comportamiento de reintentos
- [Referencia CLI — integrity](/docs/reference/cli#integrity) — auditoría plural ICU
