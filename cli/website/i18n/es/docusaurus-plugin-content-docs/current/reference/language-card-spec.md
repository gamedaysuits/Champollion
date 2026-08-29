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

> **Única fuente de verdad.** Este documento define la forma canónica de cada tarjeta de idioma. Una tarjeta afirma únicamente lo que afirma una fuente citada: un campo que ninguna fuente afirma se **omite, no es nulo**; un campo faltante significa "ninguna fuente se pronunció", nunca "no hay nada que saber". El esquema verificable por máquina se incluye como `shared/schemas/language-card.schema.json` en el paquete npm, y el [ejemplo canónico a continuación](#canonical-template) se genera a partir del corpus en vivo en cada compilación del sitio, por lo que esta página no puede desviarse de las tarjetas que describe.

## La reconstrucción del atlas de 2026-08: qué cambió en este esquema

El corpus de tarjetas es ahora un **resultado de compilación**: cada tarjeta se proyecta desde un almacén de instantáneas fijadas de origen, y se reconstruye (nunca se edita) cuando cambia un hecho. Cuatro aspectos de la forma cambiaron con esa reconstrucción:

1. **Los campos en disputa llevan un sobre de atribución.** Cuando las fuentes citadas realmente no están de acuerdo, el campo no es un valor plano sino `{"agreement": "...", "consensus": <value?>, "values": [{"value": ..., "source": "..."}]}`. This applies to `name`, `classification.family`, `speakerEstimates`, `endangerment`, y cualquier campo que una nueva fuente vuelva objeto de disputa. Los consumidores deben leer las tarjetas a través del adaptador publicado (`normalizeCard()` en el paquete npm) en lugar de asumir valores planos: `display()` resuelve un sobre a su valor acordado y deliberadamente no devuelve nada en caso de una disputa genuina en lugar de elegir un ganador.

2. **Campos renombrados.** `endonym` reemplazó a `nativeName` · `codeAliases` reemplazó a `aliases` · `scripts[]` (todos los sistemas de escritura atestiguados) reemplazó al campo plano `script`, derivando el sistema de escritura principal de la etiqueta BCP 47 máxima de la tarjeta · `endangerment` (la evaluación de cada fuente, en la propia escala de esa fuente) reemplazó al objeto único `vitality` · `isoLanguageType` y `isoScope` ahora llevan las propias palabras de ISO 639-3 ("Living", "Macrolanguage") en lugar de iniciales. Nuevos campos: `modality` ("spoken"/"signed", derivado de la ascendencia de Glottolog), `glottologBucket` (las agrupaciones no genealógicas de Glottolog, mantenidas fuera del espacio de familia), `locale`/`localeScoped`.

3. **Los campos no afirmados se omiten, no son nulos.** Un campo que ninguna fuente afirma está ausente de la tarjeta. La regla anterior ("cada tarjeta DEBE contener cada campo de nivel superior, incluso cuando sea nulo") se ha retirado: un valor vacío en una superficie pública se interpreta como una afirmación de que no hay nada que saber, lo cual no es lo mismo que no haber buscado.

4. **Existen tarjetas de configuración regional (locale).** Junto a las tarjetas de idioma, las proyecciones de configuración regional (`fra-CA`, `cmn-Hant`) llevan los hechos de su idioma resueltos para un territorio o sistema de escritura, identificados por un bloque `locale: {language, region, script}`. Una configuración regional no es un idioma: excluya las configuraciones regionales de los recuentos de idiomas mediante ese bloque.

## Principios de Diseño

1. **Documente todas las fuentes.** Cada afirmación fáctica se remonta a una fuente primaria nombrada y versionada. Las afirmaciones sin fuentes son afirmaciones no verificables. El mapa `_fieldSources` (y las anotaciones `source` por campo en los subobjetos) hacen explícita la procedencia.

2. **Conserve los desacuerdos.** Cuando las autoridades no están de acuerdo (una fuente dice 50,000 hablantes, otra dice 20,000), la tarjeta almacena *ambas* con la atribución de la fuente (la forma de sobre mencionada anteriormente). No promediamos, resolvemos ni tomamos partido. Los usuarios pueden navegar por los matices.

3. **Ausente significa no afirmado.** Un campo faltante significa que ninguna fuente afirma un valor. Cuando una propiedad genuinamente no aplica (por ejemplo, el género gramatical para un idioma que no lo tiene), el valor citado lo dice explícitamente en lugar de estar en blanco.

4. **Reconstruidas, nunca parcheadas.** Las tarjetas se proyectan desde fuentes fijadas mediante una compilación determinista. Un defecto en un hecho se corrige en su manejador de origen y el corpus se reconstruye: sin ediciones en el lugar, sin capa de enriquecimiento de solo fusión.

---

## Arquitectura de Tres Capas

| Capa | Ubicación | Propósito |
|-------|----------|---------|
| **Tarjetas de idioma** | `shared/language-cards/<code>.json` | Configuración por idioma: identidad, clasificación, recursos, todo |
| **Tarjetas de género** | `shared/language-cards/genera/<genus>.json` | Propiedades de tiempo de ejecución compartidas para idiomas relacionados (curadas, no generadas automáticamente) |
| **Árbol de idiomas** | `shared/language-cards/language-tree.json` | Jerarquía completa de Glottolog — datos de referencia para Lab UI y descubrimiento de idiomas |

---

## Modelo de Herencia

> **En gran parte histórico desde la reconstrucción del atlas.** Ninguna tarjeta de idioma en el disco lleva `extends` ya: cada tarjeta es materializada completamente por la compilación, porque la prosa heredada no se podía citar (una afirmación a nivel de familia llevaba una dirección a nivel de idioma). El mecanismo en sí sobrevive en un solo lugar: el paquete sin conexión del paquete npm incluye tarjetas de configuración regional como deltas `extends` compactos frente a su idioma, resueltos por la misma fusión descrita aquí.

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

> **Generado, no escrito.** Todo en esta sección se deriva del corpus en vivo en el momento de la compilación: la tarjeta completa `crk` (Plains Cree), byte por byte, más un extracto de configuración regional `fra-CA`. Cuando se reconstruye el corpus, la siguiente compilación del sitio vuelve a derivar esta página. No queda ninguna plantilla mantenida a mano que pueda quedar desactualizada: la anterior se desvió toda una generación de esquemas por detrás de las tarjetas y fue retirada el 2026-08-16.

El ejemplo muestra la **forma en el disco**: lo que usted obtiene si abre el archivo. Los consumidores aún deben leer las tarjetas a través del adaptador publicado (`normalizeCard()` en el paquete npm): este resuelve los sobres, une los nombres previos a la transición y deriva los valores de solo visualización (sistema de escritura principal, nivel de vitalidad) que la tarjeta sin procesar deliberadamente no lleva.

Qué notar al leer:

1. **Sobres de atribución.** `name`, `classification.family`, `endangerment`, `speakerEstimates`, `endonym`, `bcp47FullTag` y `politenessDistinction` llevan cada uno `{agreement, consensus?, values: [{value, source}]}`, every value attributed to its source. `endangerment` tiene `"agreement": "incommensurable"`: sus fuentes evalúan en diferentes escalas, por lo que cada valor nombra su `scale` en lugar de convertirse a la de un ganador.

2. **Omitido significa no afirmado.** La tarjeta no tiene `iso639_1` (Plains Cree no tiene código ISO 639-1) y no tiene `phonologicalInventory` (ninguna fuente ingerida afirma uno); esos campos simplemente están ausentes, nunca `null` o `[]`.

3. **La procedencia es una capa de primera clase.** `_fieldSources` mapea cada campo a la(s) fuente(s) que lo afirmó, con `champollion-derived-v1` marcando los valores que Champollion calculó. `_card` sella el tipo, id, revisión de la tarjeta y qué campos puede tocar el carril de corrección; `_atlas` sella la versión del corpus.

4. **Sin resultados de ejecución.** Nada en la tarjeta es una puntuación medida de la salida de un método: chrF, las tasas de aceptación de FST y sus similares son resultados de ejecución clasificados por (método, conjunto de datos, métrica) y viven en la tabla de clasificación. La tarjeta solo afirma que los recursos *existen* (`resources`, `lexicalResources`, `methodSupport`).

<CardSpecExample variant="language" />

### Una tarjeta de configuración regional es una proyección, no un idioma \{#locale-card-example}

Junto a las tarjetas de idioma se encuentran las tarjetas de configuración regional (`fra-CA`, `cmn-Hant`): los hechos de un idioma **resueltos para un territorio o sistema de escritura**, identificados por su bloque `locale`, nunca por la forma del código. Una tarjeta de configuración regional hereda los hechos de su idioma, resuelve los que tienen alcance de sistema de escritura y territorio (`script`, `localeScoped`), y **no es un idioma**: excluya las tarjetas de configuración regional de cada recuento de idiomas y listado por idioma mediante ese bloque `locale`.

<CardSpecExample variant="locale" />

---

## Referencia de campos \{#field-reference}

Dos convenciones se aplican a cada tabla a continuación:

- **"sobre"** ("envelope") significa un sobre de atribución — `{agreement, consensus?, values: [{value, source, note?, scale?}]}` — que lleva la afirmación de *cada* fuente. Un campo listado como `envelope` puede aparecer como un valor plano en tarjetas donde solo habla una fuente (por ejemplo, los languoides exclusivos de Glottolog llevan un `name` plano); los consumidores deben manejar ambos, que es lo que hace el adaptador publicado.
- Ningún campo es obligatorio más allá de `code` y `name`; todo lo demás se **omite cuando ninguna fuente lo afirma**. La(s) fuente(s) que afirma(n) cada campo se registran por tarjeta en `_fieldSources`, por lo que las tablas describen el *tipo* de fuente en lugar de fijar versiones que se desviarían.

### § 1. Campos de Identidad

| Field | Shape | Notes |
|-------|-------|-------|
| `code` | `string` | **Obligatorio.** El ID de la tarjeta y el nombre del archivo. ISO 639-3 para tarjetas de idioma (`crk`); los languoides exclusivos de Glottolog llevan su glottocode; las tarjetas de configuración regional llevan un código de configuración regional (`fra-CA`). |
| `name` | envelope | **Obligatorio.** Nombre de referencia en inglés (registro ISO 639-3, LinguaMeta, Glottolog). |
| `endonym` | envelope | Reemplazó a `nativeName`. Cómo llaman los hablantes al idioma, en el idioma (LinguaMeta, Wikidata). Ausente cuando ninguna fuente afirma uno: nunca inventamos ni transliteramos un endónimo. |
| `alternateNames` | `string[]` | Otros nombres atestiguados en inglés. |
| `iso639_1` | `string` | Presente solo cuando existe un código ISO 639-1 de dos letras (`fra` → `"fr"`). |
| `isoScope` | `string` | Las propias palabras de ISO 639-3: `"Individual"`, `"Macrolanguage"`, `"Special"` (reemplazó las iniciales `"I"`/`"M"`/`"S"`). |
| `isoLanguageType` | `string` | Reemplazó a `isoType`. Las propias palabras de ISO 639-3: `"Living"`, `"Extinct"`, `"Ancient"`, `"Historical"`, `"Constructed"`. |
| `macrolanguage` | `string` | El macrolenguaje al que pertenece este idioma (`crk` → `"cre"`). Mapeos de macrolenguajes de ISO 639-3. |
| `macrolanguageMembers` | `string[]` | En tarjetas concentradoras de macrolenguajes: los códigos de los miembros individuales (`nor` → `["nno", "nob"]`). |
| `canonicalisedMembers` | envelope | En tarjetas de macrolenguajes: miembros cuyas etiquetas los registros BCP 47 pliegan en la etiqueta de este macrolenguaje (tabla de alias de CLDR + langtags de SIL, cada uno atribuido). |
| `supersededCodes` | `string[]` | Códigos ISO 639-3 retirados que SIL ahora dirige a este idioma: registrados en el sucesor para que los corpus publicados bajo un código antiguo aún se resuelvan. |
| `codeAliases` | `string[]` | Reemplazó a `aliases`. Identificadores a nivel de código que se resuelven en esta tarjeta. |
| `bcp47` | `string` | La etiqueta BCP 47 del idioma tal como se afirma (LinguaMeta). |
| `bcp47Tag` | envelope | Derivado de Champollion: la etiqueta RFC 5646 (gana el código ISO 639 más corto). |
| `bcp47FullTag` | envelope | La forma máxima de idioma-sistema de escritura-región (likelySubtags de CLDR + langtags de SIL). El adaptador deriva el **sistema de escritura principal** de esta etiqueta. |
| `modality` | `string` | `"spoken"` o `"signed"`, derivado de la ascendencia de Glottolog. La escritura es un atributo de ortografía, no una modalidad: un idioma no escrito sigue siendo completamente hablado o de señas. |
| `locale` | `object` | **Solo tarjetas de configuración regional.** `{language, region, script, publishedTag, source, note}`: LA identidad de la configuración regional. Excluya las tarjetas de configuración regional de los recuentos de idiomas mediante este bloque, nunca por la forma del código. |
| `localeScoped` | `object` | Solo tarjetas de configuración regional: valores resueltos para el territorio/sistema de escritura de la configuración regional (por ejemplo, `scriptName`, `cldrOfficialStatus`). |

### § 2. Campos de Clasificación

| Field | Shape | Notes |
|-------|-------|-------|
| `glottocode` | `string` | El identificador de Glottolog para este languoide (`crk` → `"plai1258"`). Los languoides exclusivos de Glottolog (idiomas que Glottolog registra y que ISO 639-3 no) usan el glottocode como su `code` de tarjeta. |
| `classification` | `object` | Contenedor para los campos de ubicación a continuación. Cada uno tiene una fuente independiente y se omite de forma independiente: un idioma aislado, o un idioma archivado en una agrupación de Glottolog, legítimamente lleva solo una parte de este objeto. |
| `classification.family` | envelope | La familia de nivel superior que afirma cada autoridad de clasificación. Glottolog y WALS son taxonomías separadas que no siempre están de acuerdo, por lo que ambas se mantienen y se atribuyen. La regla de lint R5 verifica el valor de Glottolog dentro del sobre contra el propio árbol de Glottolog: WALS puede no estar de acuerdo con Glottolog, pero Glottolog no puede ser citado incorrectamente. Los idiomas aislados no llevan ninguna familia. |
| `classification.familyGlottocode` | `string` | Glottocode de esa familia de nivel superior (`crk` → `"algi1248"`). |
| `classification.genus` | `string` | El nodo de clasificación intermedio de WALS (`crk` → `"Algonquian"`). Un concepto de WALS, **no** de Glottolog (Glottolog publica un árbol de profundidad arbitraria sin nivel de género), por lo que está presente solo donde WALS codifica el idioma. |
| `classification.ancestry` | `string[]` | La ruta de descendencia de Glottolog como glottocodes ancestrales, la raíz primero (`["algi1248", …, "plai1264"]`). El orden **es** la afirmación: esta es una ruta, nunca un conjunto alfabetizado. |
| `classification.glottologBucket` | `string` | Las agrupaciones no genealógicas de Glottolog: `"Artificial Language"`, `"Pidgin"`, `"Mixed Language"`, `"Speech Register"`, `"Unclassifiable"`, `"Unattested"`. Se mantienen fuera del espacio de familia porque una agrupación clasifica por tipo, no por descendencia: una tarjeta con una agrupación no tiene familia, y ese es el resultado honesto. |
| `isIsolate` | `boolean` | Si Glottolog clasifica este idioma como aislado. |

La tarjeta previa a la transición también llevaba un `genusGlottocode`. Se retira junto con el error de categoría que lo produjo: el género es un concepto de WALS, y vestirlo con un identificador de Glottolog afirmaba un nodo de árbol que Glottolog no tiene. La jerarquía de Glottolog es llevada por `ancestry` en su lugar.

### § 3. Campos de Geografía

| Field | Shape | Notes |
|-------|-------|-------|
| `macroarea` | `string` | La macroárea de Glottolog: `"Africa"`, `"Australia"`, `"Eurasia"`, `"North America"`, `"Papunesia"` o `"South America"`. |
| `coordinates` | `object` | `{lat, lng}`: el punto representativo de Glottolog. Un punto, no un territorio: ubica el idioma en un mapa y no afirma nada sobre el alcance o los límites. |
| `countries` | `string[]` | Códigos ISO 3166-1 alfa-2 de los países que Glottolog asocia con el idioma (`["CA", "US"]`). |
| `cldrOfficialStatus` | `string` | Un estatus oficial que algún territorio otorga al idioma, tal como lo registra CLDR (llevado a través de LinguaMeta): `"Official"`, `"Regional official"`. En una tarjeta de configuración regional, el estatus resuelto para el territorio de *esa configuración regional* se encuentra en `localeScoped.cldrOfficialStatus`. |

El arreglo `regions` previo a la transición (desgloses de hablantes por país con códigos administrativos) y `arealContext` (membresía en Sprachbund) se retiran: ninguna fuente ingerida los afirma, y la curación sin fuentes no sobrevive a una reconstrucción. Las afirmaciones de hablantes a nivel de región pueden regresar el día en que una fuente citable aterrice en la canalización; hasta entonces, la ausencia es el estado honesto.

### § 4. Campos de Sistema de Escritura

| Field | Shape | Notes |
|-------|-------|-------|
| `scripts` | `string[]` | Reemplazó al campo plano `script`. **Todos** los códigos ISO 15924 atestiguados (`crk` → `["Cans", "Latn"]`), sin ordenar: nunca lea `scripts[0]` como "el" sistema de escritura. El sistema de escritura principal es derivado por el adaptador a partir de la etiqueta máxima de `bcp47FullTag`. |
| `scriptNames` | `string[]` | Nombres de visualización derivados de Champollion para `scripts[]` (`"Unified Canadian Aboriginal Syllabics"`). |
| `textDirection` | `string` | Reemplazó a `dir`. Las propias palabras de la fuente: `"left-to-right"` / `"right-to-left"` (antes era `"ltr"`/`"rtl"`). |
| `suppressScript` | `string` | Suppress-Script de CLDR: el sistema de escritura tan canónico para el idioma que las etiquetas BCP 47 lo omiten (`fra` → `"Latn"`). |
| `script` | `string` | **Solo tarjetas de configuración regional**: el sistema de escritura resuelto por la configuración regional (`fra-CA` → `"Latn"`, `cmn-Hant` → `"Hant"`). Las tarjetas de idioma no llevan un campo de sistema de escritura plano. |

Un idioma sin escritura atestiguada simplemente **no tiene el campo `scripts`**: la ausencia significa que ninguna fuente afirmó un sistema de escritura, no una afirmación de que el idioma "no está escrito". (Los lenguajes de señas son el grupo más grande de este tipo: ningún sistema de notación tiene una adopción estándar en la comunidad para la alfabetización diaria).

### § 5. Campos de Demografía y Vitalidad

| Field | Shape | Notes |
|-------|-------|-------|
| `speakerEstimates` | envelope | La estimación de cada fuente, atribuida. Los valores pueden ser recuentos exactos o las propias cadenas de rango de la fuente (`"10000-99999"`), con las advertencias de la fuente llevadas textualmente en `note`. `"agreement": "conflicting"` es común: mostrar el conflicto *es* el producto; nada se promedia ni se elige. |
| `endangerment` | envelope | Reemplazó al objeto único `vitality`. La evaluación de cada fuente **en la propia escala de esa fuente**: cada valor lleva un campo `scale`, y `"agreement": "incommensurable"` es la norma porque los vocabularios de ELCat, Glottolog AES y LinguaMeta no son traducciones entre sí. El adaptador deriva un *nivel de vitalidad* de visualización a partir de una única fuente nombrada según el orden de autoridad declarado; ese nivel es solo para visualización: el conjunto atribuido completo permanece en la tarjeta. |

Un recuento de hablantes *mostrado* en cualquier lugar de Champollion debe coincidir con una de las entradas `speakerEstimates` citadas o llevar una procedencia `champollion-derived` explícita, lo cual es impuesto por las reglas de integridad de la tarjeta.

### § 5.5 Campos de Documentación y Presencia Digital

| Field | Shape | Notes |
|-------|-------|-------|
| `documentation` | `object` | Reemplazó a `documentationDepth`. El registro de Glottolog de qué tan bien descrito está el idioma, en los propios términos de Glottolog. |
| `documentation.medLevel` | `string` | El nivel de Descripción Más Extensa de Glottolog, textualmente: `"long grammar"`, `"grammar"`, `"grammar sketch"`, `"phonology"`, `"wordlist"`. |
| `documentation.medSourceId` | `string` | La clave bibliográfica de esa descripción más extensa en el catálogo de referencias de Glottolog. |
| `documentation.firstDocumented` | `number` | La propia columna del primer año de documentación de Glottolog, textualmente: movida aquí desde el campo de nivel superior previo a la transición. Presente en solo unos pocos cientos de idiomas, y la escasez en sí misma vale la pena conocerla. |
| `documentation.lastDocumented` | `number` | La columna del último año de documentación de Glottolog, textualmente: presente en aproximadamente mil idiomas. |
| `wikipediaEdition` | `object` | Reemplazó a `digitalPresence`. `{site, url, name}`: existe una edición abierta de Wikipedia en este idioma (`afr` → `af.wikipedia.org`). Solo existencia, deliberadamente **sin recuentos de artículos**: varias ediciones son generadas en gran parte por bots, y una edición enorme no está "mejor documentada" que una pequeña en ningún sentido que un traductor pueda usar. |
| `dialectCount` | `number` | La propia columna `child_dialect_count` de Glottolog, textualmente: solo dialectos hijos directos, no todo el subárbol. Esta es la afirmación de Glottolog, no nuestra aritmética: una regla anterior lo sellaba como `champollion-derived` e hizo que miles de tarjetas se atribuyeran el mérito del recuento de Glottolog. |

El resto del bloque `digitalPresence` previo a la transición (horas de Common Voice, recuentos de oraciones de Tatoeba) se retira hasta que esas fuentes aterricen en la canalización: el propio corpus de Tatoeba ya aparece donde pertenece, como un corpus paralelo bajo `resources.corpora` (§ 9).

### § 6. Campos de Formalidad, Registro y Género

El corpus proyectado lleva exactamente un campo aquí: el hecho citado:

| Field | Shape | Notes |
|-------|-------|-------|
| `politenessDistinction` | envelope | Si el idioma gramaticaliza la cortesía en las formas de segunda persona. Atribuido a través de Grambank GB415 (binario: ausente/presente) y WALS 45A (cuatro niveles: sin distinción / binario / múltiple / pronombres evitados). Esas son escalas diferentes, por lo que cada valor nombra su `scale` y el sobre los reporta como **inconmensurables** en lugar de como un desacuerdo. |

**El sistema de registro es configuración, no un hecho de la tarjeta.** El corpus previo a la transición almacenaba prosa `formality` y prompts `registers` en casi mil ochocientas tarjetas cada uno: casi todo generado a partir de las mismas dos fuentes anteriores, y luego llevado como si fuera una configuración curada a mano. El atlas mantiene el hecho; las superficies de configuración (`formality`, `registers`, `gender`, `codeSwitching`) siguen siendo parte del **esquema curado del paquete npm** (`language-card.schema.json`), viven en las tarjetas concentradoras curadas de género/familia, y llegan a la CLI a través de la fusión `extends` del sistema de registro descrita en el [Modelo de herencia](#inheritance-model). No son campos proyectados del atlas: ninguna tarjeta en el corpus proyectado los lleva, y la compilación del atlas nunca los escribirá. La guía en [Cómo escribir buenos preajustes de registro](#writing-good-register-presets) se aplica a ese carril curado.

### § 7. Campos de Perfil Lingüístico

| Field | Shape | Notes |
|-------|-------|-------|
| `typologicalProfile` | `object` | Una clave por característica tipológica ingerida, cada valor es la propia codificación de la fuente, cada clave está presente solo donde la fuente codifica este idioma. Los booleanos provienen de las características de Grambank, las cadenas de categorías de los capítulos de WALS; el registro de decisiones nombra el parámetro exacto de origen para cada clave. |
| `phonologicalInventory` | `object` | `{consonants, vowels, tones, totalPhonemes, hasTone}`: recuentos calculados por Champollion sobre un inventario PHOIBLE citado (PHOIBLE publica una fila por segmento y no afirma recuentos), por lo que cada valor lleva la procedencia `champollion-derived`. **PHOIBLE es la única autoridad de tono** (lint R1): Grambank no tiene una característica de tono, y nada más en la tarjeta puede afirmar tonalidad. |
| `numeralSystem` | `object` | `{base}`: la base numeral, textualmente de *Numeral Systems of the World's Languages* de Chan (`"decimal"`, `"quinary-vigesimal"`, `"body tally"`; casi cien valores distintos). Ausente cuando la propia columna base de Chan está vacía (aproximadamente la mitad de los idiomas encuestados) porque un generador anterior llenó el espacio en blanco con `"decimal"` e inventó valores para dos mil idiomas. |
| `pluralCategories` | `string[]` | Las categorías de plural cardinal que CLDR establece para este idioma: el árabe distingue `["zero", "one", "two", "few", "many", "other"]`, el francés tres de ellas, el chino una. Leído de las claves del propio conjunto de reglas de CLDR, por lo que es la afirmación de CLDR, no nuestra derivación. Reemplazó a `rules.plurals.categories` previo a la transición; una canalización de i18n lo necesita para saber cuántas formas plurales debe proporcionar un mensaje. |

Las claves `typologicalProfile` actualmente proyectadas, con sus parámetros de origen:

- **Capítulos de WALS** (cadenas de categorías, las propias etiquetas de valor de WALS): `fusion` (20A), `verbSynthesis` (22A), `affixPreference` (26A), `reduplication` (27A), `genderCount` (30A), `caseCount` (49A), `wordOrder` (81A), `subjectVerbOrder` (82A), `verbalAlignment` (100A), `negationOrder` (143A)
- **Características de Grambank** (booleanos): `hasGenderInPronouns` (GB030), `hasSexBasedGender` (GB051), `hasNumeralClassifiers` (GB057), `hasCoreCase` (GB070), `hasObliqueCase` (GB071), `marksPastTense` (GB083), `marksPresentTense` (GB084)

Los bloques `linguisticChallenges` y `contactInfluences` previos a la transición no se proyectan: la prosa investigada sin fuente ingerida permanece en el esquema curado del paquete npm, al igual que las superficies de registro en el § 6 (las tablas de [Tipos de influencia de contacto](#contact-influence-types) a continuación sirven a ese carril). El bloque `rules` se retira: lo que era citable en él sobrevive como `pluralCategories` aquí y los campos de sistema de escritura en el § 4.

### § 8. Campos Enciclopédicos

Retirado de las tarjetas. Los bloques `encyclopedic` (ensayos de historia y dialectos, enlaces institucionales), `culturalAphorism` y `varieties` previos a la transición eran prosa curada a mano a nivel de tarjeta, que la reconstrucción elimina por diseño. Los hechos de membresía a los que `varieties` hacía referencia ahora son campos de identidad citados (§ 1 `macrolanguageMembers` y `canonicalisedMembers`), y la cobertura de herramientas por variedad se responde en la propia tarjeta de cada miembro (`methodSupport`, `resources`). Un dicho representativo puede regresar a través de un carril de contribución de la comunidad con consentimiento y cita; no regresará como un campo de tarjeta sin citar.

### § 9. Campos de Recursos Digitales

Todo en esta sección afirma **existencia y capacidad, nunca calidad**: que un recurso está publicado y quién lo publica, nunca que sea bueno, completo o utilizable, y nunca una puntuación medida. Cualquier puntuación medida de la salida de un método es un resultado de ejecución clasificado por (método, conjunto de datos, métrica), vive en la tabla de clasificación y está prohibido en las tarjetas (lint R3).

| Field | Shape | Notes |
|-------|-------|-------|
| `resources` | `object` | Contenedor: cada subcampo a continuación es una lista con fuentes independientes, omitida cuando ninguna fuente lo afirma. |
| `resources.fsts` | `object[]` | Analizadores morfológicos de estado finito publicados: `{name, url, publisher, license, licenceEstablished, archived}`. La licencia viaja con cada entrada en lugar de asumirse uniforme en todo un catálogo: los límites de la licencia necesitan los términos reales. Para un idioma polisintético, un FST es frecuentemente la única verificación estructural que existe. |
| `resources.corpora` | `object[]` | Corpus paralelos que atestiguan este idioma: `{corpus, corpusId, pairCount, topPartners, alignmentPairsTotal, …}`. Declarado a través de **pares**, porque un corpus paralelo atestigua un idioma solo a través de un par: "cubre suajili" sin decir contra qué responde a una pregunta que nadie hizo. Existencia y tamaño, nunca calidad. |
| `resources.monolingualCorpora` | `object[]` | Corpus monolingües: se mantienen separados de `corpora` para que "tiene un corpus" nunca signifique dos cosas incomparables. |
| `resources.speech` | `object[]` | Recursos de voz publicados. Solo existencia. |
| `resources.keyboards` | `object[]` | Distribuciones de teclado publicadas. Simples pero fundamentales: para una ortografía que necesita caracteres que ninguna distribución estándar produce, una distribución es la diferencia entre que el idioma se pueda escribir o no. |
| `resources.typology` | `object[]` | Conjuntos de datos tipológicos que *codifican* este idioma, con su extensión: `{dataset, featuresCoded, datasetFeatureTotal}`. Existencia y extensión, nunca contenido: lo que dice una característica se mantiene fuera de la tarjeta hasta que una persona escribe el mapa de parámetros que la acepta (las aceptadas aparecen en `typologicalProfile` del § 7). Los recuentos de características son nuestra aritmética, por lo que llevan la procedencia `champollion-derived`. |
| `lexicalResources` | `object` | Contenedor para hechos de existencia léxica. |
| `lexicalResources.datasets` | `object[]` | Listas de palabras publicadas con su cobertura: `{dataset, forms, concepts, release}`. |
| `lexicalResources.dictionaries` | `object[]` | Diccionarios publicados: existencia, nunca calidad, y **dirigidos** hacia donde el editor los dirige: un diccionario que va en una dirección es un recurso diferente de uno que va en la otra. Las entradas no tienen una forma uniforme (un conjunto de datos CLDF conoce su recuento de entradas; un repositorio conoce su par y dirección); cada uno nombra su propia fuente, y la licencia y el estado archivado viajan por entrada. |
| `lexicalResources.colexificationConcepts` / `colexifyingForms` | `number` | Recuentos calculados por Champollion sobre CLICS³: conceptos atestiguados para este idioma y formas que se mapean a dos o más conceptos distintos. `champollion-derived`. |
| `methodSupport` | `object` | Qué métodos de traducción cubren este idioma: capacidad, nunca una puntuación. Forma: `{total, byTier, named, truncated}`. El inglés lleva miles de bordes de métodos y el idioma mediano un par de docenas, por lo que la tarjeta contiene la *forma* de la evidencia (`total` más recuentos `byTier` por nivel de confianza (`fetched`, `partially-confirmed`, `model-card-declared`)) y nombra solo las entradas más fuertes (cada `{value, variant, source, confidence}`), con un límite. Los **servicios** de registro siempre se nombran en su totalidad, por encima del límite, por lo que la ausencia de un servicio en `named` es una respuesta real; la ausencia de una entrada de tarjeta de modelo solo significa "no está entre los más fuertes", y cada borde sigue siendo consultable en el almacén del atlas. |
| `metricModelSupport` | envelope | Modelos de métricas de evaluación que publican la cobertura de este idioma, con el identificador del modelo que carga un arnés (`masakhane/africomet-mtl`). Impulsa el comportamiento real (selección del modelo COMET) y sigue siendo capacidad, nunca una puntuación. |

**Plegados en los campos anteriores:** los campos previos a la transición `keyboardSupport` (→ `resources.keyboards`), `corpusAvailability` (→ `resources.corpora` / `resources.monolingualCorpora`) y `databaseCoverage` (→ `resources.typology` más `lexicalResources`: una entrada de base de datos ahora es un hecho de cobertura citado con extensión, no un booleano).

**Retirados de las tarjetas:** `omt1600`, `evalDatasets`, `pipelineReadiness` y `metricPlugins`: ninguno es afirmado por una fuente ingerida, y un nivel de preparación es un juicio, no una cita.

**Curados, no proyectados:** las superficies de declaración de estándar de evaluación (`evalStandard`, `evalMetrics`, `evalPack`) permanecen en el esquema curado del paquete npm. Le dicen al arnés de evaluación qué paquete de árbitro externo califica un idioma (árbitros, no concursantes: el núcleo del arnés no incluye código de calificador específico del idioma); el arnés los lee de una tarjeta cuando están presentes, pero ninguna tarjeta en el corpus proyectado los lleva actualmente, y la compilación del atlas no los escribe. Lo mismo ocurre con el bloque `install` que el instalador FST del arnés lee de las entradas `resources.fsts[]` (`get_fst_install_info()` en `language_cards.py`): las entradas proyectadas solo llevan hechos de existencia.

### § 10. Campos de Procedencia

| Field | Shape | Notes |
|-------|-------|-------|
| `_fieldSources` | `object` | En cada tarjeta. Mapea cada ruta de campo en la tarjeta (`"classification.family"`, `"coordinates.lat"`) a los identificadores de fuente ordenados que lo afirmaron (`["glottolog-v5.3", "wals-v2020.5"]`). Los valores que calculó Champollion llevan `champollion-derived-v1`. Los identificadores de fuente están versionados (`grambank-v1.0.3`, `iso639-3-20260715`), por lo que cada afirmación se remonta a la versión exacta que la hizo. |
| `coverage` | `object` | En cada tarjeta, y **calculado por el proyector, no afirmado por ninguna fuente**: `{sourceCount, componentsPresent, componentsTotal, notAttested}`: cuántas fuentes distintas hablan sobre este idioma, cuántos componentes de la tarjeta llevan un valor de cuántos existen para ser llenados, y cuántos valores una fuente registró positivamente como *ausentes* (buscó y dijo que no, un hecho diferente a nunca haber buscado). Esto es lo que permite que una tarjeta delgada diga **por qué** es delgada en lugar de parecer descuidada. |
| `_card` | `object` | Los propios metadatos de la tarjeta: `{type, id, revision, correctableFields}`. `type` es `"language"` o `"locale"` (las tarjetas de método y corpus viajan en el mismo proyector); `revision` es un hash de contenido, por lo que cualquier cambio en el contenido de la tarjeta lo cambia; `correctableFields` enumera las rutas de campo que llevan valores: los campos que el carril de corrección puede tocar. |
| `_atlas` | `object` | `{version}`: el sello de la versión del corpus (`"unreleased"` entre versiones). Deliberadamente un identificador de versión, **no** una marca de tiempo de compilación: una marca de tiempo haría que dos compilaciones de pines idénticos difirieran por el calendario, destruyendo la propiedad que permite a cualquiera verificar el atlas: mismos pines de entrada, mismos bytes de salida. |

El bloque de procedencia previo a la transición se retira por completo: `dataSources` (reemplazado por el mapa `_fieldSources` por campo), `supportTier` (un juicio calculado, reemplazado por los recuentos neutrales `coverage`), `_generated` (todo el corpus se genera; el sello es `_card.revision` más `_atlas.version`), `humanReviewed` y `notes` (curación que pertenece a carriles con sus propios registros), y el nivel superior `firstDocumented`/`lastDocumented` (movido a `documentation` en el § 5.5, donde su fuente realmente los afirma).

---

## Política de Códigos de Idioma

Champollion usa **ISO 639-3** como identificador canónico. Otros códigos estándar
se registran como alias y se resuelven al código ISO 639-3 en tiempo de ejecución.

| Priority | Standard | Example | Field | Use |
|----------|----------|---------|-------|-----|
| 1 (canónico) | ISO 639-3 | `crk` | `code` | Nombre de archivo de la tarjeta, claves de configuración, parámetros de API |
| 2 (alias) | ISO 639-1 | `iu` | `codeAliases[]` | Aceptado en la CLI, resuelto a ISO 639-3 |
| 3 (alias) | BCP 47 | `fil` | `codeAliases[]` | Aceptado en la CLI, resuelto a ISO 639-3 |
| Referencia | Glottocode | `plai1258` | `glottocode` | Solo clasificación, no para tiempo de ejecución |

**Orden de resolución:** Cuando un usuario proporciona un código:
1. Coincidencia directa en `card.code` → encontrado
2. Coincidencia en `card.codeAliases[]` → encontrado, devuelve la tarjeta canónica
3. Coincidencia en `card.iso639_1` → encontrado (respaldo)
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
- El antiguo código 639-1 está en `card.iso639_1`
- El antiguo código 639-1 está en `card.codeAliases[]` (`fra` → `["fr"]`)
- `resolveCode("fr")` devuelve `"fra"` en tiempo de ejecución: compatible con versiones anteriores
- Los usuarios aún pueden escribir `"fr"` en su configuración: se resuelve de forma transparente

**Qué cambió arquitectónicamente:**
- `_deepMerge()` ahora omite valores `null` (hereda del padre)
- `_deepMerge()` ahora tiene un campo de identidad establecido (código, extiende, alias nunca heredados)
- `formality.default` ahora se deriva de banderas de registro `isDefault: true`
- 205 tarjetas derivadas de Grambank obtuvieron corrección estructural `formality.default`
- 38 tarjetas de género/familia/macroidioma proporcionan objetivos de herencia

---

## Casos Especiales

### Lenguajes de señas
Los lenguajes de señas (por ejemplo, ASE: lenguaje de señas estadounidense) son idiomas legítimos con códigos ISO 639-3. Tienen geografía y recuentos de hablantes, pero:
- `modality` es `"signed"`: la afirmación positiva de la tarjeta de lo que *es* el idioma; la ausencia de un sistema de escritura es un hecho separado
- `scripts` suele estar ausente (ningún sistema de notación tiene una adopción estándar en la comunidad), aunque `"Sgnw"` (SignWriting) aparece donde una fuente lo afirma
- `textDirection` está ausente
- `linguisticChallenges` debe abordar la gramática espacial, los clasificadores, etc.

### Idiomas antiguos e históricos
Idiomas como el latín (`lat`, isoLanguageType `"Historical"`) y el sánscrito (`san`) todavía se usan en contextos específicos (litúrgicos, académicos) pero no tienen hablantes nativos:
- `isoLanguageType` lleva la propia palabra de estatus de ISO (`"Ancient"`, `"Historical"`, `"Extinct"`): la tarjeta nunca la suaviza ni la anula
- `endangerment` y `speakerEstimates` reportan lo que las fuentes citadas realmente evalúan, con las advertencias textuales (los recuentos de la comunidad L2 permanecen etiquetados como los etiquetan sus fuentes)
- `firstDocumented` / `lastDocumented` los ubican en el tiempo

### Idiomas construidos
Esperanto (`epo`, isoLanguageType `"Constructed"`), Lojban, etc.:
- `classification` puede estar ausente: Glottolog archiva los idiomas construidos (conlangs) bajo una agrupación no genealógica, y la agrupación nunca se muestra como una familia
- `contactInfluences` refleja el material de origen (por ejemplo, el esperanto se basa en lenguas romances, germánicas y eslavas)
- `endangerment` es inusual: comunidad de hablantes en crecimiento pero sin patria nativa

### Macrolenguajes
El árabe (`ara`), el chino (`zho`), el cree (`cre`) y el quechua (`que`) son macrolenguajes que abarcan múltiples idiomas individuales:
- `isoScope: "Macrolanguage"`: un concentrador de navegación, nunca un objetivo de referencia (benchmark)
- `macrolanguageMembers` enumera los códigos de los miembros individuales; `canonicalisedMembers` registra qué miembros pliegan los registros BCP 47 en la etiqueta del macrolenguaje (cada registro atribuido)
- `methodSupport` refleja lo que admite la *tarjeta del macrolenguaje* (generalmente la variedad estandarizada)
- Los miembros individuales tienen sus propias tarjetas, llevando `macrolanguage` de vuelta al concentrador

### Idiomas sin ortografía estandarizada
Muchos idiomas (especialmente los de tradición oral) no tienen un sistema de escritura estandarizado o tienen ortografías en competencia:
- `scripts`, `scriptNames` y `textDirection` están ausentes: ninguna fuente afirmó un sistema de escritura, lo cual no es la misma afirmación que "no escrito"
- `notes` debe explicar la situación ortográfica
- `linguisticChallenges` debe notar cómo esto afecta a la traducción automática (MT) (por ejemplo, sin datos de entrenamiento)

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

## Cómo se actualizan los hechos de la tarjeta

Las tarjetas son un **resultado de compilación**: una proyección determinista a partir de instantáneas fijadas de origen. Ya no hay un procedimiento de enriquecimiento por tarjeta: el carril de script `enrich-*` ejecutado a mano se retira, y una edición realizada directamente en un archivo de tarjeta es eliminada por la siguiente compilación. Para cambiar un hecho:

1. **Registre la decisión.** Cada campo es una fila en el registro de decisiones de la compilación: qué parámetro de origen lo alimenta, cómo se proyecta y qué significa un valor ausente.
2. **Corrija la capa de ingesta.** Un valor incorrecto es un defecto en el manejador de origen (o un pin de origen obsoleto), nunca algo que deba parchearse en la tarjeta.
3. **Reconstruya y haga la transición.** La compilación vuelve a proyectar cada tarjeta a partir de las instantáneas fijadas; las puertas (gates) rechazan compilaciones parciales, valores nulos/vacíos y tarjetas que no cumplen con las reglas de integridad.

### Manejo de Conflictos

Cuando las fuentes no están de acuerdo:
1. **Almacene todas** con la atribución de la fuente: para eso es el sobre de atribución
2. **NO promedie** ni tome partido: `consensus` aparece solo cuando las fuentes realmente están de acuerdo
3. **Lleve las advertencias de cada fuente** textualmente en el `note` de ese valor
4. Un valor único para visualización o cálculo es **derivado por el adaptador** a partir del orden de autoridad declarado: la tarjeta en sí mantiene la distribución completa

---

## Validación

Ejecute el linter después de cualquier reconstrucción:

```bash
node scripts/lint-language-cards.mjs              # all cards
node scripts/lint-language-cards.mjs --lang crk    # single card
```

### Lista de Verificación de PR

Al enviar un cambio que toque las tarjetas (recuerde: cambie la compilación, no la tarjeta):

- [ ] La corrección vive en un manejador de ingesta o en el registro de decisiones: ningún archivo de tarjeta se edita a mano
- [ ] Los campos llevan solo valores afirmados por la fuente: nada rellenado con `null` o `[]` para "completar" una tarjeta
- [ ] `classification` proviene de Glottolog (no construido a mano)
- [ ] La procedencia de cada campo tocado aterriza en `_fieldSources`, con los valores calculados por Champollion llevando la procedencia `champollion-derived`
- [ ] Ninguna puntuación medida de la salida de un método aparece en ninguna parte de una tarjeta
- [ ] El linter y la puerta de integridad de la tarjeta pasan sin errores

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
