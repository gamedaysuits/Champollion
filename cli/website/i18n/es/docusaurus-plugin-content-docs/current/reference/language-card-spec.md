---
sidebar_position: 4
title: "Especificación de Tarjeta de Idioma"
description: "Esquema canónico para las tarjetas de configuración por idioma de Champollion."
# This page renders its canonical example from the live corpus via an MDX
# component; `mdx.format` opts this one .md file into the MDX processor.
mdx:
  format: mdx
related:
  - label: "Language Card Citation Procedure"
    to: /docs/reference/language-card-citation-procedure
    kind: reference
    note: "How every card fact gets its source"
  - label: "Trading Cards"
    to: /trading-cards
    kind: card
    note: "The cards rendered from this schema"
  - label: "Supported Languages"
    to: /docs/reference/supported-languages
    kind: reference
  - label: "Morphology"
    to: /glossary#term-morphology
    kind: glossary
---

import CardSpecExample from '@site/src/components/CardSpecExample';

# Especificación de Tarjeta de Idioma

> **Única fuente de verdad.** Este documento define la estructura canónica de
> cada ficha de idioma. Una ficha solo afirma lo que afirma una fuente citada: un
> campo que ninguna fuente afirma se **omite, no es null**; un campo faltante significa
> "ninguna fuente se pronunció", nunca "no hay nada que saber". El esquema
> verificable por máquina se distribuye como `shared/schemas/language-card.schema.json` en el
> paquete npm, y el [ejemplo canónico a continuación](#canonical-template) se
> genera a partir del corpus activo en cada compilación del sitio, por lo que esta página no puede
> desfasarse de las fichas que describe.

## La reconstrucción del atlas de 2026-08: qué cambió en este esquema

El corpus de fichas ahora es **resultado de la compilación**: cada ficha se proyecta a partir de un almacén
de instantáneas upstream fijadas, y se reconstruye (nunca se edita) cuando un dato
cambia. Cuatro aspectos de la estructura cambiaron con esa reconstrucción:

1. **Los campos en disputa llevan una envoltura de atribución.** Donde las fuentes citadas
   genuinamente discrepan, el campo no es un valor plano sino
   `{"agreement": "...", "consensus": <value?>, "values": [{"value": ...,
   "source": "..."}]}`. This applies to `name`, `classification.family`,
   `speakerEstimates`, `endangerment` y cualquier campo que una nueva fuente vuelva
   disputado. Los consumidores deben leer las fichas a través del adaptador publicado
   (`normalizeCard()` en el paquete npm) en lugar de asumir valores planos;
   `display()` resuelve una envoltura a su valor acordado y deliberadamente
   no devuelve nada ante una disputa genuina en vez de elegir un ganador.

2. **Campos renombrados.** `endonym` reemplazó a `nativeName` · `codeAliases`
   reemplazó a `aliases` · `scripts[]` (todos los sistemas de escritura atestiguados) reemplazó al valor plano
   `script`, con el sistema de escritura principal derivado de la etiqueta BCP 47 máxima de la ficha · `endangerment` (la evaluación de cada fuente, en la propia
   escala de esa fuente) reemplazó al objeto individual `vitality` · `isoLanguageType` y
   `isoScope` ahora contienen las propias palabras de ISO 639-3 ("Living", "Macrolanguage")
   en lugar de iniciales. Nuevos campos: `modality` ("spoken"/"signed", derivado
   de la ascendencia de Glottolog), `glottologBucket` (clasificaciones no genealógicas de Glottolog,
   mantenidas fuera del espacio de familia), `locale`/`localeScoped`.

3. **Los campos no afirmados se omiten, no son null.** Un campo que ninguna fuente afirma está
   ausente de la ficha. La regla anterior ("cada ficha DEBE contener cada
   campo de nivel superior, incluso si es null") se retiró: un valor vacío en una
   superficie pública se interpreta como una afirmación de que no hay nada que saber, lo cual no es
   lo mismo que no haber buscado.

4. **Existen fichas de locale.** Junto a las fichas de idioma, las proyecciones de locale
   (`fra-CA`, `cmn-Hant`) contienen los datos de su idioma resueltos para un
   territorio o sistema de escritura, identificados por un bloque `locale: {language, region, script}`.
   Un locale no es un idioma: excluya los locales de los recuentos de idiomas mediante
   dicho bloque.

## Principios de Diseño

1. **Fundamentar todo con fuentes.** Cada afirmación fáctica se remonta a una fuente primaria
   nombrada y con versión. Las afirmaciones sin fuente son afirmaciones inverificables. El
   mapa `_fieldSources` (y las anotaciones `source` por campo en los subobjetos)
   hacen explícita la procedencia.

2. **Preservar las discrepancias.** Cuando las autoridades discrepan (una fuente dice
   50,000 hablantes, otra dice 20,000), la ficha almacena *ambas* con atribución
   de fuente: la estructura de envoltura anterior. No promediamos, no resolvemos ni
   tomamos partido. Los usuarios pueden explorar los matices.

3. **Ausente significa no afirmado.** Un campo faltante significa que ninguna fuente afirma un
   valor. Cuando una propiedad genuinamente no aplica (por ejemplo, el género gramatical
   en un idioma que carece de él), el valor citado lo indica explícitamente en lugar
   de estar en blanco.

4. **Reconstruidas, nunca parchadas.** Las fichas se proyectan a partir de fuentes fijadas mediante una
   compilación determinista. Un defecto en un dato se corrige en su controlador de origen y el
   corpus se reconstruye; sin ediciones in situ ni capas de enriquecimiento solo por combinación.

---

## Arquitectura de Tres Capas

| Capa | Ubicación | Propósito |
|-------|----------|---------|
| **Tarjetas de idioma** | `shared/language-cards/<code>.json` | Configuración por idioma: identidad, clasificación, recursos, todo |
| **Tarjetas de género** | `shared/language-cards/genera/<genus>.json` | Propiedades de tiempo de ejecución compartidas para idiomas relacionados (curadas, no generadas automáticamente) |
| **Árbol de idiomas** | `shared/language-cards/language-tree.json` | Jerarquía completa de Glottolog — datos de referencia para Lab UI y descubrimiento de idiomas |

---

## Modelo de Herencia

> **En gran medida histórico desde la reconstrucción del atlas.** Ya ninguna ficha de idioma en disco
> contiene `extends`: cada ficha es completamente materializada por la compilación,
> porque la prosa heredada no se podía citar (una afirmación a nivel de familia llevaba una
> dirección a nivel de idioma). El mecanismo en sí sobrevive en un lugar: el
> paquete sin conexión de npm distribuye las fichas de locale como deltas compactos `extends`
> respecto a su idioma, resueltos mediante la misma fusión descrita aquí.

Cuando una tarjeta establece `"extends": "family-dravidian"`, el tiempo de ejecución fusiona la tarjeta padre
en la tarjeta hijo usando `_deepMerge()` (en `lib/registers.js`). Esto permite que las tarjetas de género definan registros compartidos, sistemas de formalidad y orientación de género que
fluyen hacia todos los idiomas miembros — sin duplicar datos en cientos de
tarjetas individuales.

### Semántica de Fusión

| Valor del hijo | Comportamiento | Por qué |
|-------------|----------|-----|
| `null` | Heredar del padre | `null` significa "no defino esto" — el valor del padre fluye |
| No nulo | Anular padre | Los datos del hijo son más específicos — tienen prioridad |
| Objeto anidado | Fusión recursiva | Los campos del hijo anulan, los campos del padre se preservan |
| Arreglo | Reemplazar completamente | Los arreglos no se fusionan elemento por elemento — el arreglo del hijo gana |

### Campos de Identidad (Nunca Heredados)

Algunos campos pertenecen a la tarjeta misma y NUNCA deben heredarse de un padre:

```
code, extends, _migration, aliases, iso639_1, iso639_3
```

Incluso si una tarjeta padre define `aliases: ["macro-code"]`, una tarjeta hijo NO
heredará esos alias. Estos campos son siempre los valores propios del hijo (incluyendo
`null` si no está establecido).

**Por qué:** Sin esta regla, cada idioma Cree heredaría `aliases: ["cre"]`
del padre de macroidioma, haciendo que cada variedad sea un alias del macro.

### Ejemplo: Cómo se Resuelve una Tarjeta Cree

```
┌───────────────────────┐
│  family-algic.json    │  formality: null, registers: null
│  (no registers)       │
└──────────┬────────────┘
           │ extends
┌──────────┴────────────┐
│  genus-cree.json      │  formality: { system: "obviative-animate", ... }
│  (sourced registers)  │  registers: { formal: {...}, informal: {...} }
└──────────┬────────────┘
           │ extends
┌──────────┴────────────┐
│  crk.json             │  code: "crk", extends: "genus-cree"
│  (Plains Cree)        │  formality: null → inherits from genus-cree
│                       │  registers: null → inherits from genus-cree
│                       │  script: "Cans"  → own value, no inheritance
│                       │  code: "crk"     → identity field, never inherited
└───────────────────────┘
```

En tiempo de ejecución, `getLanguageCard("crk")` devuelve un objeto fusionado con registros de genus-cree + propiedades de family-algic (si las hay) + identidad y metadatos propios de crk.

### Plantilla de Tarjeta de Género

Las tarjetas de género viven en `shared/language-cards/genera/` y definen propiedades compartidas
para un grupo de idiomas. Siguen el mismo esquema que las tarjetas regulares pero con
convenciones diferentes:

```jsonc
{
  // Identity — genus cards use a prefixed code, NOT an ISO 639-3 code
  "code": "genus-cree",           // "genus-", "family-", or "macrolanguage-" prefix
  "name": "Cree Languages",      // Human-readable group name
  "extends": "family-algic",     // Genus cards can extend family cards (chaining)

  // Formality — shared across the group, sourced from typological databases
  "formality": {
    "system": "obviative-animate",
    "description": "Cree languages use an obviative/proximate system...",
    "default": "formal",
    "source": "WALS 37A, 38A + Wolfart 1973"
  },

  // Registers — shared presets, if the group shares a formality system
  "registers": {
    "formal": {
      "label": "Formal (Proximate)",
      "description": "...",
      "prompt": "...",
      "isDefault": true
    },
    "informal": {
      "label": "Informal",
      "description": "...",
      "prompt": "..."
    }
  },

  // Gender — shared grammatical gender behavior
  "gender": {
    "grammatical": false,       // Cree doesn't have grammatical gender
    "inclusiveGuidance": null   //   so no inclusive guidance needed
  },

  // Everything else is null — individual cards provide their own
  // classification, geography, resources, etc.
  "classification": null,
  "methodSupport": null,
  // ...
}
```

**Regla clave:** Las tarjetas de género SOLO deben contener datos que sean genuinamente compartidos en todo
el grupo y obtenidos de referencias autorizadas. Si un sistema de formalidad
varía entre miembros, pertenece a las tarjetas individuales, no al género.

## Ejemplo canónico \{#canonical-template}

> **Generado, no escrito.** Todo en esta sección se deriva del
> corpus activo en el momento de la compilación: la ficha completa de `crk` (cree de las llanuras), byte por byte,
> más un extracto del locale `fra-CA`. Cuando se reconstruye el corpus, la siguiente compilación
> del sitio vuelve a derivar esta página. Ya no queda ninguna plantilla mantenida a mano que
> pueda quedar desactualizada; la anterior quedó una generación entera de esquema
> detrás de las fichas y se retiró el 16-08-2026.

El ejemplo muestra la **estructura en disco**: lo que obtiene si abre el archivo.
Los consumidores aún deben leer las fichas a través del adaptador publicado
(`normalizeCard()` en el paquete npm): resuelve las envolturas, concilia los
nombres previos a la transición y deriva los valores exclusivos de visualización (sistema de escritura principal,
nivel de vitalidad) que la ficha sin procesar deliberadamente no contiene.

Aspectos a tener en cuenta al leer:

1. **Envolturas de atribución.** `name`, `classification.family`,
   `endangerment`, `speakerEstimates`, `endonym`, `bcp47FullTag` y
   `politenessDistinction` llevan cada uno `{agreement, consensus?, values:
   [{value, source}]}`, every value attributed to its source. `endangerment`
   tiene `"agreement": "incommensurable"`: sus fuentes evalúan en diferentes
   escalas, por lo que cada valor nombra su `scale` en lugar de convertirse a la
   de un ganador.

2. **Omitido significa no afirmado.** La ficha no tiene `iso639_1` (el cree de las llanuras no
   tiene código ISO 639-1) ni `phonologicalInventory` (ninguna fuente ingerida
   afirma uno); esos campos simplemente están ausentes, nunca son `null` ni `[]`.

3. **La procedencia es una capa de primer nivel.** `_fieldSources` asigna cada campo a
   la(s) fuente(s) que lo afirmaron, con `champollion-derived-v1` marcando los
   valores que Champollion calculó. `_card` estampa el tipo, ID y revisión de la ficha,
   y qué campos puede modificar la vía de corrección; `_atlas` estampa la versión de lanzamiento
   del corpus.

4. **Sin resultados de ejecución.** Nada en la ficha es una puntuación medida de la salida
   de un método: chrF, tasas de aceptación de FST y similares son resultados de ejecución indexados
   por (método, conjunto de datos, métrica) y residen en la tabla de clasificación. La ficha solo
   afirma que los recursos *existen* (`resources`, `lexicalResources`,
   `methodSupport`).

<CardSpecExample variant="language" />

### Una ficha de locale es una proyección, no un idioma \{#locale-card-example}

Junto a las fichas de idioma se encuentran las fichas de locale (`fra-CA`, `cmn-Hant`): los
datos de un idioma **resueltos para un territorio o sistema de escritura**, identificados por su
bloque `locale` (nunca por la forma del código). Una ficha de locale hereda los datos
de su idioma, resuelve aquellos con alcance de sistema de escritura y territorio (`script`,
`localeScoped`) y **no es un idioma**: excluya las fichas de locale de cada
recuento de idiomas y listado por idioma mediante dicho bloque `locale`.

<CardSpecExample variant="locale" />

---

## Referencia de campos \{#field-reference}

Se aplican dos convenciones a cada tabla a continuación:

- **"envelope"** significa una envoltura de atribución: `{agreement, consensus?,
  values: [{value, source, note?, scale?}]}`, que contiene la afirmación de *cada*
  fuente. Un campo listado como `envelope` puede aparecer como un valor plano en fichas
  donde solo se pronuncia una fuente (por ejemplo, los languoides exclusivos de Glottolog llevan un
  `name` plano); los consumidores deben manejar ambos casos, que es lo que hace el adaptador
  publicado.
- Ningún campo es obligatorio más allá de `code` y `name`; todo lo demás se
  **omite cuando ninguna fuente lo afirma**. La(s) fuente(s) que afirman cada campo
  se registran por ficha en `_fieldSources`, por lo que las tablas describen el
  *tipo* de fuente en lugar de fijar versiones que quedarían desactualizadas.

### § 1. Campos de Identidad

| Campo | Estructura | Notas |
|-------|-------|-------|
| `code` | `string` | **Obligatorio.** El ID de la ficha y nombre de archivo. ISO 639-3 para fichas de idioma (`crk`); los languoides exclusivos de Glottolog llevan su glottocode; las fichas de locale llevan un código de locale (`fra-CA`). |
| `name` | envelope | **Obligatorio.** Nombre de referencia en inglés (registro ISO 639-3, LinguaMeta, Glottolog). |
| `endonym` | envelope | Reemplazó a `nativeName`. Cómo llaman los hablantes al idioma, en el propio idioma (LinguaMeta, Wikidata). Ausente cuando ninguna fuente afirma uno; nosotros nunca inventamos ni transliteramos un endónimo. |
| `alternateNames` | `string[]` | Otros nombres atestiguados en inglés. |
| `iso639_1` | `string` | Presente solo cuando existe un código ISO 639-1 de dos letras (`fra` → `"fr"`). |
| `isoScope` | `string` | Las propias palabras de ISO 639-3: `"Individual"`, `"Macrolanguage"`, `"Special"` (reemplazó las iniciales `"I"`/`"M"`/`"S"`). |
| `isoLanguageType` | `string` | Reemplazó a `isoType`. Las propias palabras de ISO 639-3: `"Living"`, `"Extinct"`, `"Ancient"`, `"Historical"`, `"Constructed"`. |
| `macrolanguage` | `string` | La macrolengua a la que pertenece este idioma (`crk` → `"cre"`). Asignaciones de macrolenguas de ISO 639-3. |
| `macrolanguageMembers` | `string[]` | En fichas concentradoras de macrolenguas: los códigos de los miembros individuales (`nor` → `["nno", "nob"]`). |
| `canonicalisedMembers` | envelope | En fichas de macrolenguas: miembros cuyas etiquetas los registros BCP 47 incorporan a la etiqueta de esta macrolengua (tabla de alias de CLDR + langtags de SIL, cada uno atribuido). |
| `supersededCodes` | `string[]` | Códigos ISO 639-3 retirados que SIL ahora dirige a este idioma; registrados en el sucesor para que los corpus publicados bajo un código antiguo sigan resolviéndose. |
| `codeAliases` | `string[]` | Reemplazó a `aliases`. Identificadores a nivel de código que resuelven a esta ficha. |
| `bcp47` | `string` | La etiqueta BCP 47 del idioma según lo afirmado (LinguaMeta). |
| `bcp47Tag` | envelope | Derivada de Champollion: la etiqueta RFC 5646 (gana el código ISO 639 más corto). |
| `bcp47FullTag` | envelope | La forma máxima idioma–sistema de escritura–región (likelySubtags de CLDR + langtags de SIL). El adaptador deriva el **sistema de escritura principal** a partir de esta etiqueta. |
| `modality` | `string` | `"spoken"` o `"signed"`, derivado de la ascendencia de Glottolog. La escritura es un atributo ortográfico, no una modalidad: un idioma no escrito sigue siendo plenamente hablado o señado. |
| `locale` | `object` | **Solo fichas de locale.** `{language, region, script, publishedTag, source, note}`: LA identidad del locale. Excluya las fichas de locale de los recuentos de idiomas mediante este bloque, nunca por la forma del código. |
| `localeScoped` | `object` | Solo fichas de locale: valores resueltos para el territorio/sistema de escritura del locale (p. ej., `scriptName`, `cldrOfficialStatus`). |

### § 2. Campos de Clasificación

| Campo | Estructura | Notas |
|-------|-------|-------|
| `glottocode` | `string` | El identificador de Glottolog para este languoide (`crk` → `"plai1258"`). Los languoides exclusivos de Glottolog (idiomas que Glottolog registra pero que ISO 639-3 no) utilizan el glottocode como su `code` de ficha. |
| `classification` | `object` | Contenedor para los campos de ubicación a continuación. Cada uno tiene fuentes independientes y se omite de forma independiente: una lengua aislada o un idioma clasificado en un contenedor de Glottolog legítimamente solo lleva parte de este objeto. |
| `classification.family` | envelope | La familia de nivel superior que afirma cada autoridad de clasificación. Glottolog y WALS son taxonomías separadas que no siempre coinciden, por lo que ambas se conservan y se les atribuye la procedencia. La regla de lint R5 compara el valor de Glottolog dentro de la envoltura con el propio árbol de Glottolog: WALS puede discrepar de Glottolog, pero Glottolog no puede citarse incorrectamente. Las lenguas aisladas no llevan ninguna familia. |
| `classification.familyGlottocode` | `string` | Glottocode de esa familia de nivel superior (`crk` → `"algi1248"`). |
| `classification.genus` | `string` | El nodo de clasificación intermedio de WALS (`crk` → `"Algonquian"`). Un concepto de WALS, **no** de Glottolog (Glottolog publica un árbol de profundidad arbitraria sin nivel de género), por lo que solo está presente donde WALS codifica el idioma. |
| `classification.ancestry` | `string[]` | La ruta de ascendencia de Glottolog como glottocodes de ancestros, comenzando por la raíz (`["algi1248", …, "plai1264"]`). El orden **es** la afirmación: se trata de una ruta, nunca de un conjunto ordenado alfabéticamente. |
| `classification.glottologBucket` | `string` | Clasificaciones no genealógicas de Glottolog: `"Artificial Language"`, `"Pidgin"`, `"Mixed Language"`, `"Speech Register"`, `"Unclassifiable"`, `"Unattested"`. Mantenidas fuera del espacio de familia porque una categoría clasifica por tipo, no por descendencia: una ficha con una de estas categorías no tiene familia, y ese es el resultado honesto. |
| `isIsolate` | `boolean` | Si Glottolog clasifica este idioma como una lengua aislada. |

La ficha previa a la transición también contenía un `genusGlottocode`. Se retiró junto
con el error de categoría que lo produjo: el género es un concepto de WALS, y
vestirlo con un identificador de Glottolog afirmaba un nodo de árbol que Glottolog no
tiene. La jerarquía de Glottolog se incluye en `ancestry` en su lugar.

### § 3. Campos de Geografía

| Campo | Estructura | Notas |
|-------|-------|-------|
| `macroarea` | `string` | Macroárea de Glottolog: `"Africa"`, `"Australia"`, `"Eurasia"`, `"North America"`, `"Papunesia"` o `"South America"`. |
| `coordinates` | `object` | `{lat, lng}`: punto representativo de Glottolog. Un punto, no un territorio: ubica el idioma en un mapa y no afirma nada sobre extensión o fronteras. |
| `countries` | `string[]` | Códigos ISO 3166-1 alfa-2 de los países que Glottolog asocia con el idioma (`["CA", "US"]`). |
| `cldrOfficialStatus` | `string` | Un estatus oficial que algún territorio otorga al idioma, según lo registra CLDR (transmitido a través de LinguaMeta): `"Official"`, `"Regional official"`. En una ficha de locale, el estatus resuelto para el territorio de *ese locale* se encuentra en `localeScoped.cldrOfficialStatus`. |

El arreglo `regions` previo a la transición (desgloses de hablantes por país con códigos
administrativos) y `arealContext` (pertenencia a un Sprachbund) se retiraron: ninguna fuente
ingerida los afirma, y la curaduría sin fuentes no sobrevive a una reconstrucción.
Las afirmaciones sobre hablantes a nivel regional podrán regresar el día en que una fuente citable llegue al
pipeline; hasta entonces, la ausencia es el estado honesto.

### § 4. Campos de Sistema de Escritura

| Campo | Estructura | Notas |
|-------|-------|-------|
| `scripts` | `string[]` | Reemplazó al `script` plano. **Todos** los códigos ISO 15924 atestiguados (`crk` → `["Cans", "Latn"]`), sin ordenar; nunca interprete `scripts[0]` como "el" sistema de escritura. El sistema de escritura principal lo deriva el adaptador a partir de la etiqueta máxima de `bcp47FullTag`. |
| `scriptNames` | `string[]` | Nombres para mostrar derivados de Champollion para `scripts[]` (`"Unified Canadian Aboriginal Syllabics"`). |
| `textDirection` | `string` | Reemplazó a `dir`. Las propias palabras de la fuente: `"left-to-right"` / `"right-to-left"` (antes `"ltr"`/`"rtl"`). |
| `suppressScript` | `string` | Suppress-Script de CLDR: el sistema de escritura tan canónico para el idioma que las etiquetas BCP 47 lo omiten (`fra` → `"Latn"`). |
| `script` | `string` | **Solo fichas de locale**: el sistema de escritura resuelto para el locale (`fra-CA` → `"Latn"`, `cmn-Hant` → `"Hant"`). Las fichas de idioma no llevan ningún campo de sistema de escritura plano. |

Un idioma sin escritura atestiguada simplemente **no tiene campo `scripts`**:
la ausencia significa que ninguna fuente afirmó un sistema de escritura, no una afirmación de que el idioma sea
"no escrito". (Las lenguas de señas son el grupo más grande de este tipo: ningún sistema de notación
cuenta con adopción comunitaria estándar para la lectoescritura cotidiana).

### § 5. Campos de Demografía y Vitalidad

| Campo | Estructura | Notas |
|-------|-------|-------|
| `speakerEstimates` | envelope | La estimación de cada fuente, atribuida. Los valores pueden ser recuentos exactos o las cadenas de rango propias de la fuente (`"10000-99999"`), con las salvedades de la fuente incluidas textualmente en `note`. `"agreement": "conflicting"` es común: mostrar el conflicto *es* el producto; nada se promedia ni se elige. |
| `endangerment` | envelope | Reemplazó al objeto individual `vitality`. La evaluación de cada fuente **en la propia escala de esa fuente**: cada valor lleva un campo `scale`, y `"agreement": "incommensurable"` es la norma porque los vocabularios de ELCat, Glottolog AES y LinguaMeta no son traducciones entre sí. El adaptador deriva un *nivel de vitalidad* para visualización a partir de una única fuente nombrada según el orden de autoridad declarado; ese nivel es solo para visualización: el conjunto completo atribuido permanece en la ficha. |

Un recuento de hablantes *mostrado* en cualquier parte de Champollion debe coincidir con una de las
entradas citadas en `speakerEstimates` o llevar procedencia explícita de
`champollion-derived`, lo cual es aplicado por las reglas de integridad de fichas.

### § 5.5 Campos de Documentación y Presencia Digital

| Campo | Estructura | Notas |
|-------|-------|-------|
| `documentation` | `object` | Reemplazó a `documentationDepth`. Registro de Glottolog sobre qué tan bien descrito está el idioma, en los propios términos de Glottolog. |
| `documentation.medLevel` | `string` | Nivel de descripción más extensa de Glottolog, textual: `"long grammar"`, `"grammar"`, `"grammar sketch"`, `"phonology"`, `"wordlist"`. |
| `documentation.medSourceId` | `string` | La clave bibliográfica de esa descripción más extensa en el catálogo de referencias de Glottolog. |
| `documentation.firstDocumented` | `number` | La columna propia de primer año de documentación de Glottolog, textual: movida aquí desde el campo de nivel superior previo a la transición. Presente solo en unos pocos cientos de idiomas, y la escasez misma es algo que vale la pena conocer. |
| `documentation.lastDocumented` | `number` | La columna propia de último año de documentación de Glottolog, textual: presente en aproximadamente mil idiomas. |
| `wikipediaEdition` | `object` | Reemplazó a `digitalPresence`. `{site, url, name}`: existe una edición abierta de Wikipedia en este idioma (`afr` → `af.wikipedia.org`). Solo existencia, deliberadamente **sin recuentos de artículos**: varias ediciones son en gran parte generadas por bots, y una edición enorme no está "mejor documentada" que una pequeña en ningún sentido que un traductor pueda aprovechar. |
| `dialectCount` | `number` | La columna propia `child_dialect_count` de Glottolog, textual: únicamente dialectos hijos directos, no todo el subárbol. Esta es la afirmación de Glottolog, no nuestra aritmética: una regla anterior la marcaba como `champollion-derived` e hizo que miles de fichas se atribuyeran el recuento de Glottolog. |

El resto del bloque `digitalPresence` previo a la transición (horas de Common Voice,
recuentos de oraciones de Tatoeba) se retiró hasta que esas fuentes se incorporen al pipeline;
el propio corpus de Tatoeba ya aparece donde corresponde, como un corpus paralelo
bajo `resources.corpora` (§ 9).

### § 6. Campos de Formalidad, Registro y Género

El corpus proyectado contiene exactamente un campo aquí: el dato citado:

| Campo | Estructura | Notas |
|-------|-------|-------|
| `politenessDistinction` | envelope | Si el idioma gramaticaliza la cortesía en las formas de segunda persona. Atribuido entre Grambank GB415 (binario: ausente/presente) y WALS 45A (cuatro niveles: sin distinción / binario / múltiple / se evitan los pronombres). Son escalas diferentes, por lo que cada valor nombra su `scale` y la envoltura los reporta como **inconmensurables** en lugar de como una discrepancia. |

**El sistema de registros es configuración, no un dato de la ficha.** El corpus
previo a la transición almacenaba texto de `formality` y prompts de `registers` en casi mil
ochocientas fichas cada uno, casi todo generado a partir de las mismas dos fuentes
anteriores y luego conservado como si fuera configuración curada a mano. El atlas
conserva el dato; las superficies de configuración —`formality`, `registers`,
`gender`, `codeSwitching`— siguen formando parte del **esquema curado del
paquete npm** (`language-card.schema.json`), residen en las fichas concentradoras
curadas de género/familia y llegan a la CLI a través de la fusión `extends` del sistema
de registros descrita en el [Modelo de herencia](#inheritance-model). No son
campos proyectados del atlas: ninguna ficha en el corpus proyectado los contiene y la
compilación del atlas nunca los escribirá. La guía en
[Cómo escribir buenos ajustes preestablecidos de registro](#writing-good-register-presets) se aplica a
esa vía curada.

### § 7. Campos de Perfil Lingüístico

| Campo | Estructura | Notas |
|-------|-------|-------|
| `typologicalProfile` | `object` | Una clave por característica tipológica ingerida, siendo cada valor la codificación propia de la fuente, y cada clave estando presente solo donde la fuente codifica este idioma. Los booleanos provienen de características de Grambank, las cadenas de categorías de capítulos de WALS; el registro de decisiones nombra el parámetro upstream exacto para cada clave. |
| `phonologicalInventory` | `object` | `{consonants, vowels, tones, totalPhonemes, hasTone}`: recuentos calculados por Champollion sobre un inventario citado de PHOIBLE (PHOIBLE publica una fila por segmento y no afirma recuentos), por lo que cada valor lleva procedencia `champollion-derived`. **PHOIBLE es la única autoridad de tono** (lint R1): Grambank no tiene característica de tono y nada más en la ficha puede afirmar tonalidad. |
| `numeralSystem` | `object` | `{base}`: la base numeral, textual de *Numeral Systems of the World's Languages* de Chan (`"decimal"`, `"quinary-vigesimal"`, `"body tally"`; cerca de cien valores distintos). Ausente cuando la propia columna de base de Chan está vacía (aproximadamente la mitad de los idiomas encuestados), debido a que un generador anterior llenó el espacio en blanco con `"decimal"` e inventó valores para dos mil idiomas. |
| `pluralCategories` | `string[]` | Las categorías de plural cardinal que CLDR establece para este idioma: el árabe distingue `["zero", "one", "two", "few", "many", "other"]`, el francés tres de ellas, el chino una. Leídas a partir de las claves del propio conjunto de reglas de CLDR, por lo que es la afirmación de CLDR, no nuestra derivación. Reemplazó a `rules.plurals.categories` previo a la transición; un pipeline de i18n lo necesita para saber cuántas formas plurales debe proporcionar un mensaje. |

Las claves de `typologicalProfile` proyectadas actualmente, con sus parámetros
upstream:

- **Capítulos de WALS** (cadenas de categoría, etiquetas de valor propias de WALS): `fusion`
  (20A), `verbSynthesis` (22A), `affixPreference` (26A), `reduplication`
  (27A), `genderCount` (30A), `caseCount` (49A), `wordOrder` (81A),
  `subjectVerbOrder` (82A), `verbalAlignment` (100A), `negationOrder` (143A)
- **Características de Grambank** (booleanos): `hasGenderInPronouns` (GB030),
  `hasSexBasedGender` (GB051), `hasNumeralClassifiers` (GB057), `hasCoreCase`
  (GB070), `hasObliqueCase` (GB072), `marksPastTense` (GB083),
  `marksPresentTense` (GB082)

Los bloques `linguisticChallenges` y `contactInfluences` previos a la transición no se
proyectan: el texto investigado sin una fuente ingerida permanece en el
esquema curado del paquete npm, al igual que las superficies de registro en el § 6 (las
tablas de [Tipos de influencia por contacto](#contact-influence-types) a continuación sirven a
esa vía). El bloque `rules` se retiró: lo que era citable en él sobrevive como
`pluralCategories` aquí y en los campos de sistemas de escritura en el § 4.

### § 8. Campos Enciclopédicos

Retirado de las fichas. Los bloques `encyclopedic` (ensayos de historia y dialectos,
enlaces institucionales), `culturalAphorism` y `varieties` previos a la transición eran
texto curado a mano al nivel de detalle de la ficha, el cual la reconstrucción elimina por diseño. Los
datos de membresía a los que `varieties` hacía referencia ahora son campos de identidad
citados (§ 1 `macrolanguageMembers` y `canonicalisedMembers`), y la cobertura de herramientas por
variedad se responde en la propia ficha de cada miembro (`methodSupport`,
`resources`). Un dicho representativo podrá regresar a través de una vía de
contribución comunitaria con consentimiento y cita; no regresará como un
campo de ficha no citado.

### § 9. Campos de Recursos Digitales

Todo en esta sección afirma **existencia y capacidad, nunca
calidad**: que un recurso está publicado y quién lo publica, nunca que sea
bueno, completo o utilizable, y jamás una puntuación medida. Cualquier puntuación medida
de la salida de un método es un resultado de ejecución indexado por (método, conjunto de datos, métrica), reside
en la tabla de clasificación y está prohibido en las fichas (lint R3).

| Campo | Estructura | Notas |
|-------|-------|-------|
| `resources` | `object` | Contenedor: cada subcampo a continuación es una lista con fuentes independientes, omitida cuando ninguna fuente la afirma. |
| `resources.fsts` | `object[]` | Analizadores morfológicos de estados finitos publicados: `{name, url, publisher, license, licenceEstablished, archived}`. La licencia acompaña a cada entrada en lugar de asumirse uniforme en todo un catálogo: los límites de las licencias requieren los términos reales. Para un idioma polisintético, un FST suele ser la única comprobación estructural que existe. |
| `resources.corpora` | `object[]` | Corpus paralelos que atestiguan este idioma: `{corpus, corpusId, pairCount, topPartners, alignmentPairsTotal, …}`. Indicados mediante **pares**, porque un corpus paralelo atestigua un idioma solo a través de un par: decir que "cubre suajili" sin especificar contra qué responde a una pregunta que nadie hizo. Existencia y tamaño, nunca calidad. |
| `resources.monolingualCorpora` | `object[]` | Corpus monolingües: se mantienen separados de `corpora` para que "tiene un corpus" nunca signifique dos cosas incomparables. |
| `resources.speech` | `object[]` | Recursos de voz publicados. Solo existencia. |
| `resources.keyboards` | `object[]` | Distribuciones de teclado publicadas. Simples pero fundamentales: para una ortografía que necesita caracteres que ninguna distribución estándar produce, una distribución es la diferencia entre que el idioma se pueda escribir en teclado o no. |
| `resources.typology` | `object[]` | Conjuntos de datos tipológicos que *codifican* este idioma, con alcance: `{dataset, featuresCoded, datasetFeatureTotal}`. Existencia y alcance, nunca contenido: lo que dice una característica queda fuera de la ficha hasta que una persona escribe el mapa de parámetros que la acepta (las aceptadas aparecen en `typologicalProfile` del § 7). Los recuentos de características son nuestra aritmética, por lo que llevan procedencia `champollion-derived`. |
| `lexicalResources` | `object` | Contenedor para datos de existencia léxica. |
| `lexicalResources.datasets` | `object[]` | Listas de palabras publicadas con su cobertura: `{dataset, forms, concepts, release}`. |
| `lexicalResources.dictionaries` | `object[]` | Diccionarios publicados: existencia, nunca calidad, y **con dirección** donde el editor los dirija: un diccionario en un sentido es un recurso diferente de uno en el otro. Las entradas no tienen una estructura uniforme (un conjunto de datos CLDF conoce su recuento de entradas; un repositorio conoce su par y dirección); cada una nombra su propia fuente, y la licencia y el estado archivado van por entrada. |
| `lexicalResources.colexificationConcepts` / `colexifyingForms` | `number` | Recuentos calculados por Champollion sobre CLICS³: conceptos atestiguados para este idioma y formas que se asignan a dos o más conceptos distintos. `champollion-derived`. |
| `methodSupport` | `object` | Qué métodos de traducción cubren este idioma: capacidad, nunca una puntuación. Estructura: `{total, byTier, named, truncated}`. El inglés contiene miles de conexiones de métodos y el idioma promedio un par de docenas, por lo que la ficha contiene la *forma* de la evidencia: `total` más recuentos de `byTier` por nivel de confianza (`fetched`, `partially-confirmed`, `model-card-declared`), y nombra solo las entradas más sólidas (cada `{value, variant, source, confidence}`), con límite. Los **servicios** del registro siempre se nombran completos, por encima del límite, de modo que la ausencia de un servicio en `named` es una respuesta real; la ausencia de una entrada de ficha de modelo solo significa "no está entre las más sólidas", y cada conexión sigue siendo consultable en el almacén del atlas. |
| `metricModelSupport` | envelope | Modelos de métricas de evaluación que publican cobertura de este idioma, con el identificador de modelo que carga un harness (`masakhane/africomet-mtl`). Impulsa el comportamiento real (selección del modelo COMET) y sigue siendo capacidad, nunca una puntuación. |

**Integrados en los campos anteriores:** los elementos previos a la transición `keyboardSupport` (→
`resources.keyboards`), `corpusAvailability` (→ `resources.corpora` /
`resources.monolingualCorpora`) y `databaseCoverage` (→
`resources.typology` más `lexicalResources`: una entrada de base de datos es ahora un
dato de cobertura citado con alcance, no un booleano).

**Retirados de las fichas:** `omt1600`, `evalDatasets`, `pipelineReadiness` y
`metricPlugins`; ninguno es afirmado por una fuente ingerida, y un nivel de
preparación es un juicio, no una cita.

**Curadas, no proyectadas:** las superficies de declaración de estándares de evaluación
(`evalStandard`, `evalMetrics`, `evalPack`) permanecen en el esquema curado del
paquete npm. Le indican al harness de evaluación qué paquete árbitro externo
califica un idioma (árbitros, no competidores: el núcleo del harness no distribuye código
de puntuación específico de ningún idioma); el harness las lee de una ficha cuando
están presentes, pero ninguna ficha en el corpus proyectado las contiene actualmente y la
compilación del atlas no las escribe. Lo mismo aplica para el bloque `install` que el
instalador FST del harness lee de las entradas `resources.fsts[]`
(`get_fst_install_info()` en `language_cards.py`): las entradas proyectadas
solo contienen datos de existencia.

### § 10. Campos de Procedencia

| Campo | Estructura | Notas |
|-------|-------|-------|
| `_fieldSources` | `object` | En cada ficha. Mapea cada ruta de campo en la ficha (`"classification.family"`, `"coordinates.lat"`) a los ID de fuente ordenados que lo afirmaron (`["glottolog-v5.3", "wals-v2020.5"]`). Los valores calculados por Champollion llevan `champollion-derived-v1`. Los ID de fuente tienen versión (`grambank-v1.0.3`, `iso639-3-20260715`), por lo que cada afirmación se remonta al lanzamiento exacto que la originó. |
| `coverage` | `object` | En cada ficha, y **calculado por el proyector, no afirmado por ninguna fuente**: `{sourceCount, componentsPresent, componentsTotal, notAttested}`: cuántas fuentes distintas hablan sobre este idioma, cuántos componentes de la ficha contienen un valor respecto a cuántos existen para completarse, y cuántos valores registró una fuente positivamente como *ausentes* (buscó y dijo que no, un dato diferente de nunca haber buscado). Esto es lo que permite a una ficha reducida indicar **por qué** es reducida en lugar de parecer descuidada. |
| `_card` | `object` | Los propios metadatos de la ficha: `{type, id, revision, correctableFields}`. `type` es `"language"` o `"locale"` (las fichas de método y corpus utilizan el mismo proyector); `revision` es un hash de contenido, por lo que cualquier cambio en el contenido de la ficha lo modifica; `correctableFields` enumera las rutas de campo que contienen valores: los campos que la vía de corrección puede modificar. |
| `_atlas` | `object` | `{version}`: la marca de versión del corpus (`"unreleased"` entre lanzamientos). Deliberadamente un ID de versión, **no** una marca de tiempo de compilación: una marca de tiempo haría que dos compilaciones a partir de fijaciones idénticas difirieran por el calendario, destruyendo la propiedad que permite a cualquiera verificar el atlas: las mismas fijaciones de entrada producen los mismos bytes de salida. |

El bloque de procedencia previo a la transición se retiró por completo: `dataSources`
(reemplazado por el mapa `_fieldSources` por campo), `supportTier` (un juicio
calculado, sustituido por los recuentos neutrales de `coverage`), `_generated` (todo
el corpus es generado; la marca es `_card.revision` más
`_atlas.version`), `humanReviewed` y `notes` (curaduría que corresponde a
vías con sus propios registros), y los elementos de nivel superior
`firstDocumented`/`lastDocumented` (movidos a `documentation` en el § 5.5,
donde su fuente realmente los afirma).

---

## Política de Códigos de Idioma

Champollion usa **ISO 639-3** como identificador canónico. Otros códigos estándar
se registran como alias y se resuelven al código ISO 639-3 en tiempo de ejecución.

| Prioridad | Estándar | Ejemplo | Campo | Uso |
|----------|----------|---------|-------|-----|
| 1 (canónico) | ISO 639-3 | `crk` | `code` | Nombre de archivo de la ficha, claves de config, parámetros de API |
| 2 (alias) | ISO 639-1 | `iu` | `codeAliases[]` | Aceptado en la CLI, resuelto a ISO 639-3 |
| 3 (alias) | BCP 47 | `fil` | `codeAliases[]` | Aceptado en la CLI, resuelto a ISO 639-3 |
| Referencia | Glottocode | `plai1258` | `glottocode` | Solo clasificación, no para tiempo de ejecución |

**Orden de resolución:** Cuando un usuario proporciona un código:
1. Coincidencia directa en `card.code` → encontrado
2. Coincidencia en `card.codeAliases[]` → encontrado, devuelve la ficha canónica
3. Coincidencia en `card.iso639_1` → encontrado (alternativa)
4. No encontrado → error

### Historial de Migración: ISO 639-1 → ISO 639-3

Antes de v8, los nombres de archivo de tarjeta usaban códigos ISO 639-1 cuando estaban disponibles (`fr.json`,
`de.json`, `ja.json`). En la migración 639-3, todas las tarjetas fueron renombradas a sus
equivalentes ISO 639-3:

| Antes | Después | Por qué |
|--------|--------|--------|
| `fr.json` | `fra.json` | 639-3 es canónico |
| `de.json` | `deu.json` | 639-3 es canónico |
| `zh.json` | `cmn.json` | Macroidioma → individual por defecto |
| `ar.json` | `arb.json` | Macroidioma → Árabe Estándar Moderno |
| `ms.json` | `zsm.json` | Macroidioma → Malayo Estándar |

**¿Qué pasó con los códigos antiguos?**
- El código 639-1 antiguo está en `card.iso639_1`
- El código 639-1 antiguo está en `card.codeAliases[]` (`fra` → `["fr"]`)
- `resolveCode("fr")` devuelve `"fra"` en tiempo de ejecución (compatible con versiones anteriores)
- Los usuarios aún pueden escribir `"fr"` en su configuración: se resuelve de forma transparente

**Qué cambió arquitectónicamente:**
- `_deepMerge()` ahora omite valores `null` (hereda del padre)
- `_deepMerge()` ahora tiene un campo de identidad establecido (código, extiende, alias nunca heredados)
- `formality.default` ahora se deriva de banderas de registro `isDefault: true`
- 205 tarjetas derivadas de Grambank obtuvieron corrección estructural `formality.default`
- 38 tarjetas de género/familia/macroidioma proporcionan objetivos de herencia

---

## Casos Especiales

### Lenguas de señas
Las lenguas de señas (p. ej., ASE: lengua de señas americana) son idiomas legítimos
con códigos ISO 639-3. Tienen geografía y recuentos de hablantes, pero:
- `modality` es `"signed"`: la afirmación positiva de la ficha sobre lo que el
  idioma *es*; la ausencia de un sistema de escritura es un dato independiente
- `scripts` suele estar ausente (ningún sistema de notación cuenta con adopción
  comunitaria estándar), aunque `"Sgnw"` (SignWriting) aparece donde una fuente lo afirma
- `textDirection` está ausente
- `linguisticChallenges` debe abordar la gramática espacial, clasificadores, etc.

### Idiomas antiguos e históricos
Idiomas como el latín (`lat`, isoLanguageType `"Historical"`) y el sánscrito
(`san`) todavía se utilizan en contextos específicos (litúrgicos, académicos), pero no
tienen hablantes nativos:
- `isoLanguageType` contiene la propia palabra de estado de ISO (`"Ancient"`,
  `"Historical"`, `"Extinct"`); la ficha nunca la atenúa ni la invalida
- `endangerment` y `speakerEstimates` reportan lo que las fuentes citadas
  realmente evalúan, con las salvedades textuales (los recuentos de comunidades L2 permanecen etiquetados
  como los etiquetan sus fuentes)
- `firstDocumented` / `lastDocumented` los ubican en el tiempo

### Lenguas construidas
Esperanto (`epo`, isoLanguageType `"Constructed"`), lojban, etc.:
- `classification` puede estar ausente: Glottolog clasifica las conlangs en una
  categoría no genealógica, y dicha categoría nunca se muestra como una familia
- `contactInfluences` refleja el material de origen (p. ej., el esperanto se basa en lenguas romances, germánicas y eslavas)
- `endangerment` es inusual: una comunidad de hablantes en crecimiento pero sin una patria nativa

### Macrolenguas
El árabe (`ara`), el chino (`zho`), el cree (`cre`) y el quechua (`que`) son macrolenguas
que abarcan múltiples idiomas individuales:
- `isoScope: "Macrolanguage"`: un centro de navegación, nunca un objetivo de referencia (benchmark)
- `macrolanguageMembers` enumera los códigos de los miembros individuales;
  `canonicalisedMembers` registra qué miembros incorporan los registros BCP 47
  a la etiqueta de la macrolengua (cada registro atribuido)
- `methodSupport` refleja lo que admite la *ficha de macrolengua* (normalmente la variedad estandarizada)
- Los miembros individuales tienen sus propias fichas, que llevan `macrolanguage` de vuelta al centro

### Idiomas sin ortografía estandarizada
Muchos idiomas (especialmente los de tradición oral) no tienen un sistema de
escritura estandarizado o tienen ortografías en competencia:
- `scripts`, `scriptNames` y `textDirection` están ausentes: ninguna fuente
  afirmó un sistema de escritura, lo cual no es la misma afirmación que "no escrito"
- `notes` debe explicar la situación ortográfica
- `linguisticChallenges` debe señalar cómo afecta esto a la TA (p. ej., falta de datos de entrenamiento)

### Diglosia
Idiomas como Árabe (MSA vs. dialectos) o Guaraní (Jopará vs. Guaraní puro):
- `codeSwitching` captura la situación de variedad mixta
- `registers` puede ofrecer presets para diferentes niveles
- `varieties` puede listar el par diglósico

---

## Tipos de Influencia de Contacto

| Tipo | Significado | Ejemplo |
|------|-----------|---------|
| `superstrate` | Idioma dominante impuesto en una comunidad | Francés → Inglés (post-1066) |
| `substrate` | Idioma nativo influyendo un idioma impuesto | Celta → Inglés |
| `adstrate` | Idioma vecino con influencia mutua | Nórdico → Inglés |
| `learned_borrowing` | Préstamos a través de educación/erudición | Latín → Inglés |
| `lexical_borrowing` | Préstamos de vocabulario directo a través de contacto | Español → Filipino |
| `relexification` | Reemplazo de vocabulario completo | Portugués → Papiamentu |

## Profundidades de Influencia de Contacto

| Profundidad | Significado |
|-------|-----------|
| `light` | Algunas palabras prestadas, impacto estructural mínimo |
| `moderate` | Vocabulario significativo en dominios específicos |
| `heavy` | Vocabulario generalizado y algunas características estructurales |
| `structural` | Gramática, sintaxis y fonología afectadas |
| `defining` | Identidad central moldeada por contacto (criollos, idiomas mixtos) |

---

## Escribir Buenos Presets de Registro

**Buenos prompts de preset:**
- Nombrar explícitamente la característica de formalidad (p. ej., "해요체", "forma vous", "forma siz")
- Explicar el pronombre o forma verbal específica a usar
- Dar contexto para cuándo este registro es apropiado
- Mencionar consideraciones de script si aplica

**No** ponga orientación de género inclusivo en el prompt de preset. La orientación de género
pertenece a `card.gender.inclusiveGuidance` — se inyecta por separado.

```
❌ Bad:  "Standard Thai. Professional register."
✔ Good: "Professional Thai. Use คุณ (khun) for second person, เรา (rao)
         for first person when needed. Clear, concise phrasing
         appropriate for digital interfaces."
```

### Convención de Nombres de Preset

Las claves de preset deben ser descriptivas y en minúsculas con guiones:
- Idiomas T-V: `formal-vous`, `informal-tu`, `formal-Sie`, `casual-du`
- Niveles de habla: `polite-haeyo`, `formal-hapsyo`, `casual-hae`
- Neutral: `professional`, `neutral-professional`
- Code-switching: `taglish-professional`, `pure-filipino`

---

## Cómo se actualizan los datos de las fichas

Las fichas son **resultado de la compilación**: una proyección determinista a partir de
instantáneas upstream fijadas. Ya no existe un procedimiento de enriquecimiento por ficha: la vía del
script `enrich-*` ejecutado a mano se retiró, y cualquier edición realizada directamente en el archivo de una ficha
es eliminada en la siguiente compilación. Para cambiar un dato:

1. **Registre la decisión.** Cada campo es una fila en el registro de decisiones
   de la compilación: qué parámetro upstream lo alimenta, cómo se proyecta y qué
   significa un valor ausente.
2. **Corrija la capa de ingesta.** Un valor incorrecto es un defecto en el controlador de origen
   (o una fijación upstream desactualizada), nunca algo que deba parcharse en la ficha.
3. **Reconstruya y realice la transición.** La compilación vuelve a proyectar cada ficha a partir de las
   instantáneas fijadas; los controles de calidad (gates) rechazan compilaciones parciales, valores nulos/vacíos y fichas que
   no cumplan las reglas de integridad.

### Manejo de Conflictos

Cuando las fuentes discrepen:
1. **Almacene todas ellas** con atribución de fuente: para eso sirve la
   envoltura de atribución
2. **NO promedie** ni tome partido: `consensus` solo aparece cuando las
   fuentes realmente coinciden
3. **Incluya las salvedades de cada fuente** textualmente en el campo `note` de ese valor
4. El adaptador **deriva** un único valor para visualización o cálculo
   a partir del orden de autoridad declarado; la propia ficha conserva la gama completa

---

## Validación

Ejecute el linter después de cualquier reconstrucción:

```bash
node scripts/lint-language-cards.mjs              # all cards
node scripts/lint-language-cards.mjs --lang crk    # single card
```

### Lista de Verificación de PR

Al enviar un cambio que afecte a las fichas (recuerde: modifique la compilación,
no la ficha):

- [ ] La corrección se encuentra en un controlador de ingesta o en el registro de decisiones (ningún archivo
      de ficha se edita a mano)
- [ ] Los campos solo contienen valores afirmados por fuentes: nada se rellena con `null` o
      `[]` para "completar" una ficha
- [ ] `classification` proviene de Glottolog (no construido a mano)
- [ ] La procedencia de cada campo modificado queda registrada en `_fieldSources`, y los valores calculados
      por Champollion llevan procedencia `champollion-derived`
- [ ] No aparece ninguna puntuación medida de la salida de un método en ninguna parte de una ficha
- [ ] El linter y el control de integridad de fichas pasan sin errores

---

## Referencias Profesionales

| Estándar | Mantenido Por | Nuestro Uso |
|----------|---------------|---------|
| [ISO 639-3](https://iso639-3.sil.org) | SIL International | Códigos de idioma canónicos, relaciones de macroidioma |
| [Glottolog](https://glottolog.org) | Max Planck Institute | Clasificación, coordenadas, peligro AES |
| [WALS](https://wals.info) | Max Planck Institute | Definiciones de género, características tipológicas |
| [ISO 15924](https://unicode.org/iso15924/) | Unicode/ISO | Códigos de script |
| [CLDR](https://cldr.unicode.org) | Unicode Consortium | Datos de locale, reglas de plural, tipografía |
| [Wikidata](https://www.wikidata.org) | Wikimedia Foundation | Conteos de hablantes, endónimos, datos de script |
| [Ethnologue](https://www.ethnologue.com) | SIL International | EGIDS, estimaciones de hablantes, DLS |
| [UNESCO Atlas](http://www.unesco.org/languages-atlas/) | UNESCO | Clasificación de peligro |
| [Katig Collective](https://linguistics.upd.edu.ph/the-katig-collective/) | UP Diliman | Cápsulas de idiomas filipinos |

Ver también: [Procedimiento de Citación de Tarjeta de Idioma](/docs/reference/language-card-citation-procedure)
para orientación detallada fuente por fuente.
