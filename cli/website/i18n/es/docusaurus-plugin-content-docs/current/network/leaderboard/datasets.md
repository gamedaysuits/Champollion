---
sidebar_position: 3
title: "Conjuntos de Datos de Evaluación"
related:
  - label: "Corpus Design Framework"
    to: /docs/network/specifications/corpus-design
    kind: spec
    note: "How evaluation corpora are constructed"
  - label: "Cookbook: Corpus Creation"
    to: /docs/network/tutorials/corpus-creation
    kind: cookbook
    note: "Build a corpus for your language"
  - label: "Benchmark Specification"
    to: /docs/network/specifications/benchmark
    kind: spec
  - label: "What Counts as a Language Here?"
    to: /docs/network/context/what-counts-as-a-language
    kind: doc
---

# Conjuntos de Datos de Evaluación

> **Resumen ejecutivo.** Esta página describe los conjuntos de datos de evaluación disponibles para la evaluación comparativa, incluyendo el esquema de entrada del corpus, los niveles de dificultad (1–5) y los requisitos de procedencia. El catálogo consta de **~4,700 conjuntos de datos de evaluación obtenidos desde la fuente en 19 familias de corpus** (TICO-19, IN22, Tatoeba, GlobalVoices, SMOL, ALT, Turkic-x-WMT, WMT24++, los conjuntos ciegos WMT newstest/General 2014–2025, MAFAND-MT, NusaX, NusaTranslation, LoResMT, AmericasNLP 2021, NICT-SAP, BSD, MENYO-20k, Gamayun, EdTeKLA) más FLORES+ — el *contenido* del corpus nunca se aloja aquí; cada conjunto de datos es una tarjeta de metadatos con SHA fijado, reconstruida de forma determinista a partir de su archivo fuente fijado. Una **vía no comercial / solo para investigación** (Gamayun, EdTeKLA, MAFAND-MT, NusaTranslation, LoResMT, AmericasNLP, NICT-SAP, BSD, MENYO-20k y los conjuntos de uso para investigación de WMT) está excluida de cualquier ruta comercial / de premios / de API; dentro de ella, los corpus bajo concesiones modificadas, a medida o no declaradas están adicionalmente **restringidos por consentimiento** — la evaluación remota mediante API de modelos se rechaza a menos que el propio texto de la licencia otorgue el uso para evaluación (registrado como una decisión explícita por conjunto de datos, como ocurre con los conjuntos de uso para investigación de WMT) o que el permiso del titular de los derechos esté registrado en la entrada del conjunto de datos. Los dos conjuntos de datos de referencia curados por humanos — EDTeKLA Dev v1 (Cree de las llanuras) y FLORES+ Devtest (870 pares de idiomas catalogados, 1,012 oraciones cada uno) — se detallan a continuación; el desglose completo del recuento de entradas de EdTeKLA se indica una vez, en [su sección](#edtekla-development-set-v1).

Los conjuntos de datos son los objetivos fijos contra los que se ejecuta el arnés. Cada conjunto de datos es un archivo JSON que contiene pares origen→destino con referencias de estándar de oro. El arnés califica los resultados del modelo contra estas referencias — nunca las modifica.

:::danger[NO ENTRENE con datos de evaluación]

⚠️ **Estos conjuntos de datos son solo para evaluación.** Los métodos entrenados, ajustados, con few-shot-prompt o de otra forma expuestos a datos de evaluación producirán puntuaciones artificialmente infladas y serán **descalificados de la tabla de clasificación.**

Utilice corpus separados para entrenamiento. Los conjuntos de evaluación deben permanecer sin ser vistos por su modelo durante el desarrollo.
:::

---

## Formato del Conjunto de Datos {#dataset-format}

Cada conjunto de datos sigue el mismo esquema JSON:

```json
{
  "dataset": {
    "id": "dataset-slug",
    "version": "1.0",
    "language_pair": "EN→CRK",
    "description": "Human-readable description of the dataset",
    "source_language": "en",
    "target_language": "crk",
    "created": "2025-05-01",
    "license": "CC-BY-NC-4.0",
    "provenance": ["gold_standard", "textbook"]
  },
  "entries": [
    {
      "id": 1,
      "source": "Hello",
      "reference": "tânisi",
      "difficulty": 1,
      "provenance": "gold_standard",
      "register": "conversational",
      "context": "greeting",
      "notes": "Common greeting, SRO orthography"
    }
  ]
}
```

:::info[Esquema canónico]
La [Especificación de evaluación comparativa](/docs/network/specifications/benchmark) define el corpus canónico y el esquema de entrada. Esta página documenta los conjuntos de datos disponibles y cómo crear otros nuevos.
:::

### Bloque `dataset` de Nivel Superior

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | `string` | Identificador único del conjunto de datos (utilizado en tarjetas de ejecución y tabla de clasificación) |
| `version` | `string` | Versión semántica. Incrementar esto invalida comparaciones previas de tarjetas de ejecución |
| `language_pair` | `string` | Etiqueta de visualización (p. ej., `EN→CRK`) |
| `description` | `string` | Opcional. Resumen legible por humanos |
| `source_language` | `string` | Código de idioma de origen BCP 47 |
| `target_language` | `string` | Código de idioma de destino BCP 47 |
| `created` | `string` | Fecha de creación ISO 8601 |
| `license` | `string` | Identificador de licencia SPDX |
| `provenance` | `string[]` | Lista de etiquetas de procedencia utilizadas en todas las entradas |

### Campos de Entrada

| Campo | Tipo | Requerido | Descripción |
|-------|------|----------|-------------|
| `id` | `integer` | ✅ | Identificador único de entrada dentro del corpus |
| `source` | `string` | ✅ | El texto de origen a traducir |
| `reference` | `string` | ✅ | La traducción de referencia de estándar de oro |
| `difficulty` | `integer` | ✅ | Nivel de dificultad 1–5 (ver abajo) |
| `provenance` | `string` | ✅ | Origen de esta entrada (p. ej., `gold_standard`, `textbook`, `elicited`) |
| `register` | `string` | ✅ | Nivel de registro/formalidad (p. ej., `conversational`, `formal`, `ceremonial`) |
| `context` | `string` | ✅ | Función comunicativa (p. ej., `greeting`, `declaration`, `instruction`) |
| `notes` | `string` | ❌ | Contexto opcional para revisores humanos |
| `morphological_analysis` | `string` | ❌ | Desglose morfológico de estándar de oro |
| `variant_class` | `string` | ❌ | Etiqueta de clase que agrupa variantes de traducción aceptables |

---

## Datasets Disponibles

El catálogo consta de **~4,700 conjuntos de datos de evaluación obtenidos desde la fuente en 19 familias
de corpus**, más los dos conjuntos de datos de referencia curados por humanos (EDTeKLA + FLORES)
detallados a continuación — un total en el registro de **5,602 conjuntos de datos** al 2026-07-12. Cada
corpus es una **tarjeta de metadatos con SHA fijado** — el contenido del corpus nunca se aloja aquí;
se reconstruye de forma determinista a partir de su archivo fuente fijado en el momento de la
evaluación. Todos los conjuntos de datos llevan `do_not_train`. Una tarjeta fuente se despliega en muchos
conjuntos de datos por par, por lo que el total del registro supera las ~1,417 tarjetas fuente; los
conjuntos de datos de vía abierta alimentan la cola de barrido directamente; la vía de solo investigación se ejecuta
bajo demanda donde su licencia lo permite claramente (las concesiones modificadas/a medida/no declaradas
están restringidas por consentimiento para la evaluación remota mediante API de modelos).

| Familia | Conjuntos de datos | Creador / fuente | Licencia | Vía |
|--------|---------:|------------------|---------|------|
| **TICO-19** | 1,260 | Consorcio TICO-19 (CMU, JHU, GMU, Amazon, Appen, Facebook, Google, Microsoft, Translated, TWB) | CC0-1.0 | abierta |
| **IN22** (Conv + Gen) | 1,012 | AI4Bharat / IIT Madras | CC-BY-4.0 | abierta (descarga restringida en HF) |
| **Tatoeba** | 874 | [Comunidad Tatoeba](https://tatoeba.org), a través del Tatoeba Challenge | CC-BY-2.0 | abierta |
| **GlobalVoices** | 493 | Global Voices / OPUS | CC-BY-3.0 | abierta |
| **SMOL** (doc + sent) | 490 | Google (SMOL) | CC-BY-4.0 | abierta |
| **WMT newstest / General** (conjuntos ciegos 2014–2025) | 178 | WMT (Conference on Machine Translation), a través de sacreBLEU | `LicenseRef-WMT-Research-Use` | **uso para investigación** |
| **ALT** | 156 | NICT / Proyecto ALT | CC-BY-4.0 | abierta |
| **Turkic-x-WMT** | 90 | Turkic Interlingua (til-mt) | MIT | abierta |
| **WMT24++** | 55 | Google / Unbabel | Apache-2.0 | abierta |
| **MAFAND-MT** | 40 | Masakhane NLP | CC-BY-NC-4.0 | **no comercial / solo para investigación** |
| **NusaX** | 22 | IndoNLP | CC-BY-SA-4.0 | abierta (compartir igual) |
| **NusaTranslation** | 20 | IndoNLP | `LicenseRef-NusaWrites-Unstated-Data-License` | **solo para investigación** |
| **LoResMT** (2020 + 2021) | 10 | Taller LoResMT (organizadores de la tarea compartida) | CC-BY-NC-SA-4.0 | **no comercial / solo para investigación** |
| **AmericasNLP 2021** | 9 | Tarea compartida AmericasNLP (organizadores) | `LicenseRef-AmericasNLP-Mixed-ResearchUse` | **solo para investigación** |
| **Gamayun** | 8 | CLEAR Global (anteriormente Translators without Borders) | `LicenseRef-TWB-Gamayun` | **no comercial / solo para investigación** |
| **NICT-SAP** | 8 | SAP SE | CC-BY-NC-4.0 | **no comercial / solo para investigación** |
| **EDTeKLA / prize** | 3 | Grupo de Investigación EdTeKLA, Universidad de Alberta | LicenseRef-EdTeKLA-Modified-CC-BY-NC-SA-4.0 | **no comercial / solo para investigación (en cuarentena)** |
| **BSD** | 2 | Laboratorio Tsuruoka, Universidad de Tokio | CC-BY-NC-SA-4.0 | **no comercial / solo para investigación** |
| **MENYO-20k** | 2 | Masakhane / Universidad del Sarre (uds-lsv) | CC-BY-NC-4.0 | **no comercial / solo para investigación** |

*(FLORES+ devtest — 870 pares catalogados, CC-BY-SA-4.0 — es el conjunto de datos de referencia detallado a continuación, llevando el total del registro a 5,602.)*

:::info[La vía no comercial de solo investigación]
La mayor parte del catálogo tiene licencias permisivas (CC0, CC-BY-2.0/3.0/4.0, MIT,
Apache-2.0) y es utilizable en todas las vías. Un pequeño conjunto — **Gamayun** (licencia
a medida de TWB) y **EDTeKLA** (una CC BY-NC-SA modificada con alcance de soberanía) — es **no comercial**: está
excluido de cualquier ruta comercial, de premios o de API. Para los corpus bajo
concesiones modificadas, a medida o no declaradas, la evaluación remota mediante API de modelos está
adicionalmente **restringida por consentimiento**: el entorno de evaluación rechaza enviar su texto a
API de modelos de terceros a menos que el propio texto de la licencia otorgue el uso para evaluación
(registrado como una decisión explícita por conjunto de datos — los conjuntos de uso para investigación de WMT
llevan una) o que el permiso explícito del titular de los derechos esté registrado en la
entrada del conjunto de datos (la evaluación local sigue siendo posible). La elegibilidad se **basa en el uso**: la vía comercial es estricta,
la vía de investigación es indulgente y la cuarentena siempre prevalece (por lo que las porciones inadecuadas de EdTeKLA
nunca pueden clasificar). Consulte
[Registro de corpus y vías de exposición](/docs/network/sovereignty/registering-corpora) para
saber cómo un corpus elige su vía.
:::

Los conjuntos de datos de referencia se detallan a continuación; los corpus de familia siguen el mismo esquema JSON y se enumeran en el registro de conjuntos de datos.

:::note[Un catálogo no es un tablero poblado]
Un catálogo de corpus grande es lo que los métodos *pueden* ser evaluados — no es un tablero de clasificación lleno de resultados. El tablero en sí está en fase de inicialización; consulte las [reglas del tablero de clasificación](/docs/network/leaderboard/rules) y [Limitaciones honestas](/docs/network/honest-limitations).
:::

### Conjunto de Desarrollo EDTeKLA v1 {#edtekla-development-set-v1}

El primer dataset de evaluación, construido para traducción de inglés a Plains Cree (SRO). Creado por el [grupo de investigación EdTeKLA](https://spaces.facsci.ualberta.ca/edtekla/) de la Universidad de Alberta.

| Propiedad | Valor |
|----------|-------|
| **ID** | `edtekla-dev-v1` |
| **Versión** | `1.0` |
| **Par de idiomas** | EN → CRK (Cree de las llanuras, ortografía SRO) |
| **Recuento de entradas** | División de desarrollo de 436 entradas (`textbook_dev.json`). Cadena: 589 líneas alineadas sin procesar en la fuente → 486 pares válidos únicos después de la normalización/desduplicación (un recuento derivado de Champollion) → 436 de desarrollo + 50 de reserva (división determinista con semilla 42 de Champollion — EdTeKLA publica los archivos sin procesar, no una división). Un conjunto estándar de oro separado de 62 entradas (curado a mano, solo para investigación, **no** es material de EdTeKLA) eleva la colección combinada de evaluación en Cree de las llanuras del proyecto a 548. |
| **Distribución de dificultad** | Fácil, Medio, Difícil |
| **Procedencia** | `gold_standard` (verificado por hablantes), `textbook` (materiales educativos publicados) |
| **Licencia** | [CC BY-NC-SA modificada de EdTeKLA](https://github.com/EdTeKLA/IndigenousLanguages_Corpora) (`LicenseRef-EdTeKLA-Modified-CC-BY-NC-SA-4.0` — con alcance de soberanía; el libro de texto base es CC BY-NC-ND 4.0) — **excluida de las vías de la tabla de clasificación, de premios y comercial/de API** (no comercial) |

> **Esta es la declaración canónica de los recuentos del conjunto de evaluación en Cree de las llanuras.** Otras
> páginas enlazan aquí en lugar de reiterarlos. Las cifras 486/436/50 son
> derivadas por Champollion a partir de los archivos alineados sin procesar de EdTeKLA (EdTeKLA en sí no publica
> recuentos ni divisiones); el conjunto estándar de oro de 62 entradas tiene una procedencia
> separada, ajena a EdTeKLA. El recuento anterior siempre se empareja con su vía: EdTeKLA lleva una CC BY-NC-SA modificada
> con alcance de soberanía y está **excluida de la tabla de clasificación, los premios y la
> ruta comercial/de API**.

**Lo que prueba:**

- Saludos básicos y frases comunes
- Animacidad nominal y obviación
- Conjugación verbal en personas y tiempos
- Construcciones locativas
- Paradigmas posesivos
- Estructuras de oraciones complejas

:::tip[Estructura del corpus]
El material derivado de EdTeKLA se divide en un conjunto público de desarrollo y un conjunto de reserva (la división de Champollion de la alineación del libro de texto sin procesar de EdTeKLA — recuentos en la tabla anterior). El conjunto estándar de oro separado de 62 entradas está curado a mano a partir de otras fuentes y no forma parte del corpus de EdTeKLA. Un conjunto de datos más pequeño y de alta calidad con estándares de oro verificados es más útil que uno grande y ruidoso — especialmente para un idioma de bajos recursos donde las traducciones "suficientemente buenas" a menudo son morfológicamente inválidas.
:::

---

## Creando un Nuevo Conjunto de Datos

Para crear un conjunto de datos para un nuevo par de idiomas o dominio:

### 1. Estructurar el JSON

Siga el esquema [Formato del Conjunto de Datos](#dataset-format). Cada entrada debe tener `source`, `reference`, `difficulty`, `provenance`, `register` y `context`.

### 2. Asignar un ID único

Utilice un slug descriptivo: `{project}-{split}-v{version}` (p. ej., `edtekla-dev-v1`, `quechua-test-v1`).

### 3. Verificar estándares de oro

Cada valor `reference` debe ser verificado por un hablante fluido o extraído de un recurso publicado y revisado por pares. Las referencias generadas por máquina anulan el propósito de la evaluación.

### 4. Establecer niveles de dificultad

Asigne a cada entrada un nivel de dificultad entero:

| Nivel | Descripción | Ejemplos |
|------|-------------|----------|
| 1 — Vocabulario básico | Palabras individuales, saludos comunes, números | "hello" → "tânisi" |
| 2 — Oraciones simples | Sujeto-verbo o SVO, tiempo presente | "I see the dog" |
| 3 — Complejidad moderada | Tiempo pasado/futuro, posesivos, animacidad | "I saw his dog yesterday" |
| 4 — Morfología compleja | Obviación, voz pasiva, orden conjuntivo | "the woman whose son went to the store" |
| 5 — Avanzado | Multi-cláusula, registro formal, ceremonial, idiomático | Párrafo completo con tono apropiado al registro |

### 5. Etiquetar procedencia

Cada entrada debe indicar de dónde proviene. Etiquetas comunes:

- `gold_standard` — Verificado por hablantes fluidos
- `textbook` — De materiales educativos publicados
- `elicited` — Producido a través de sesiones de elicitación estructurada
- `corpus` — Extraído de un corpus paralelo

### 6. Validar el archivo

Ejecute el arnés contra su conjunto de datos con cualquier modelo para verificar que el JSON esté bien formado y todos los campos requeridos estén presentes:

```bash
mt-eval run --corpus path/to/your-dataset.json --dry-run
```

El arnés generará un error en campos faltantes, índices duplicados o violaciones de esquema.

### 7. Enviar para inclusión

Abra una solicitud de extracción contra el [repositorio del arnés de evaluación](https://github.com/gamedaysuits/Champollion) que agregue una **tarjeta de metadatos fetch-from-source** — una entrada de registro que apunte el arnés a la fuente ascendente (cargador/URL, fijación SHA, licencia y procedencia). **Nunca confirme el contenido del corpus en sí.** Champollion no aloja ni rastrea texto de corpus de terceros; el arnés obtiene referencias de la fuente ascendente en tiempo de ejecución y califica contra los datos recién obtenidos. Valide localmente primero (paso 6), luego envíe solo la tarjeta. Incluya documentación de su metodología de verificación y fuentes de procedencia.

---

## FLORES+ Devtest

Un benchmark multilingüe de cobertura amplia mantenido por la [Iniciativa de Datos de Idiomas Abiertos (OLDI)](https://huggingface.co/datasets/openlanguagedata/flores_plus). Utilizado para comparaciones de frontera multi-modelo de champollion.

| Propiedad | Valor |
|----------|-------|
| **ID** | Una tarjeta por par: `eval-flores-devtest-v1-<src>-<tgt>` (p. ej. `eval-flores-devtest-v1-amh-fra`) |
| **Pares de idiomas** | 870 pares catalogados y ejecutables (812 de ellos entre dos idiomas que no son inglés) |
| **Recuento de entradas** | 1,012 oraciones por par |
| **Licencia** | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) |
| **Fuente** | Meta FLORES-200, ahora mantenido por OLDI — obtenido de la fuente, fijado por SHA por par (el contenido del corpus nunca se rastrea aquí) |
| **Contaminación** | **ALTA** — solo relativa, solo prueba / ilustración (ver nota) |

:::warning[ALTA contaminación — solo relativa, nunca un punto de referencia absoluto]
FLORES+ es datos públicos obtenidos por rastreo web que los modelos fronterizos muy probablemente ya han visto. Champollion lo ejecuta en un **carril solo relativo**: utilizable para comparar métodos cara a cara, pero **nunca reportado como una puntuación de calidad absoluta**, y **nunca utilizado como un borde de cadena** en el [mapa de traducción](https://champollion.dev).
Es para **pruebas e ilustración solamente**.
:::

:::danger[Solo evaluación]
FLORES+ está destinado únicamente a evaluación. Los curadores solicitan explícitamente que **no se utilice como datos de entrenamiento**. Asegúrese de que su contenido esté excluido de cualquier corpus de entrenamiento.
:::

---

## Consulte también

- [Evaluación de MT](/docs/network/leaderboard/rules) — descripción general del marco de evaluación y tabla de clasificación
- [Arnés de Evaluación](/docs/network/specifications/harness) — cómo ejecutar evaluaciones contra estos conjuntos de datos
- [Especificación de Tarjeta de Ejecución](/docs/network/specifications/run-card) — el esquema JSON para registrar resultados
- [Tabla de Clasificación de Métodos](https://champollion.dev/leaderboard) — puntuaciones de benchmark en vivo
- [Proyecto EdTeKLA](https://spaces.facsci.ualberta.ca/edtekla/) — el grupo de investigación de la Universidad de Alberta detrás del conjunto de datos Cree
