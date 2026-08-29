---
sidebar_position: 4
title: "Interfaz de Método"
related:
  - label: "Submit a Method"
    to: /docs/network/getting-started/submit-a-method
    kind: guide
    note: "Put this interface on the leaderboard"
  - label: "Eval Harness v2.0"
    to: /docs/network/specifications/harness
    kind: spec
  - label: "Run Card Specification"
    to: /docs/network/specifications/run-card
    kind: spec
  - label: "Cookbook: FST-Gated Translation Pipeline"
    to: /docs/network/tutorials/fst-gated-pipeline
    kind: cookbook
    note: "A full method, built end-to-end"
---

# Interfaz de Método Compartida

> **Resumen Ejecutivo.** Esta página especifica el protocolo `TranslationMethod` que todos los métodos de Network deben implementar, las seis clases de método (`raw-llm`, `coached-llm`, `pipeline`, `custom-plugin`, `api`, `human`), el eje **paradigma** ortogonal (`rule-based`, `statistical`, `neural-nmt`, `llm`, `hybrid`, …) que hace que *cómo un método traduce* sea comparable entre sistemas, el formato de complemento de método, y las **clases de dependencia** (S/O/A1/A2/X) que determinan si un método puede ejecutarse en la caja de arena de evaluación y calificar para premios. Estos son tres ejes independientes. Cualquier enfoque que implemente este protocolo puede ser evaluado; lo que depende determina dónde puede competir.

El arnés de evaluación y champollion comparten un concepto común de **método de traducción**. Un método es cualquier procedimiento que toma texto fuente y produce texto traducido — ya sea una llamada directa a LLM, una canalización de múltiples etapas, una API de terceros, o un traductor humano.

## Arquitectura

```
Method Plugin (v2 Spec)
├── method.json           ← Manifest (name, class, entry_point, dependencies, metadata)
├── method_card.json      ← Leaderboard description (what, not how)
├── pipeline.py           ← Python module implementing TranslationMethod
└── (optional helpers)    ← Additional Python modules
```

Se carga a través de `--method path/to/dir`. El arnés no descubre nada automáticamente.

## Dos Sistemas, Una Interfaz

| | Arnés de Evaluación | champollion |
|---|---|---|
| **Lenguaje** | Python | Node.js |
| **Punto de entrada** | `translate.py` | `translate.js` |
| **Interfaz** | protocolo `TranslationMethod` | configuración `methodPlugin` |
| **Propósito** | Evaluación por lotes con puntuación | Localización en vivo en dev/CI |
| **Salida** | Tarjeta de ejecución con métricas | Archivos de configuración regional traducidos |

Un método que admite ambos sistemas proporciona dos puntos de entrada — uno para cada tiempo de ejecución de lenguaje. La **tarjeta de método** es el puente: describe el método en un formato que ambos sistemas entienden.

## Tarjeta de Método {#method-card}

Una tarjeta de método describe *qué* es un método de traducción sin revelar detalles propietarios como el indicador del sistema completo. Responde:

- ¿Qué clase de método es este? (LLM sin procesar, LLM entrenado, canalización, API, etc.)
- ¿Qué **paradigma** utiliza? (basado en reglas, estadístico, neural-nmt, llm, híbrido)
- ¿Qué herramientas utiliza? (analizador FST, diccionario, etc.)
- ¿Es la implementación de código abierto?
- ¿Qué pares de idiomas admite?

Consulte la [Especificación de Tarjeta de Método](/docs/network/specifications/methods#method-card) para el esquema JSON completo.

### Ejemplo

```json
{
  "method_id": "fst-gated-v8",
  "name": "FST-Gated Coached Translation v8",
  "class": "pipeline",
  "paradigm": "hybrid",
  "description": "LLM translation with morphological validation. Failed words are retried with FST feedback.",
  "author": "Curtis Forbes",
  "tools_used": ["HFST morphological analyzer", "Wolvengrey dictionary"],
  "open_source": false,
  "dependency_class": "A2",
  "supported_pairs": ["eng>crk"]
}
```

El campo `dependency_class` resume lo que el método necesita para ejecutarse y transferirse — consulte [Validez de Método y Clases de Dependencia](#method-validity-and-dependency-classes) a continuación. El campo `paradigm` coloca el método en el **eje de paradigma** (aquí `hybrid`: un LLM controlado por un FST basado en reglas) — consulte [Paradigmas](#paradigms) a continuación.

### Clases de Método

| Clase | Descripción |
|-------|-------------|
| `raw-llm` | Llamada directa a LLM con instrucción mínima |
| `coached-llm` | LLM con indicación estructurada, ejemplos, restricciones |
| `pipeline` | Canalización de múltiples etapas con componentes determinísticos |
| `custom-plugin` | Proceso externo que implementa el protocolo `TranslationMethod` |
| `api` | API de traducción de terceros (Google Translate, DeepL, etc.) |
| `human` | Traducción humana (para establecer líneas de base) |

### Paradigmas {#paradigms}

El **paradigma** es un tercer eje independiente: *cómo un método traduce a nivel algorítmico*. Es ortogonal tanto a la clase de método como a la clase de dependencia. La clase de método por sí sola está centrada en LLM — un sistema basado en reglas [Apertium](https://www.apertium.org/) y Google Translate se clasifican en `pipeline`/`api`, por lo que "basado en reglas vs neural" es invisible sin él. El eje de paradigma hace que esa comparación sea de primera clase y filtrable en la tabla de clasificación.

| Paradigma | Descripción | Ejemplos |
|----------|-------------|----------|
| `rule-based` | Transductores de estado finito, gramáticas escritas a mano, transferencia morfológica | Apertium, generación FST de GiellaLT |
| `statistical` | MT basada en frases / estadística (SMT) aprendida de corpus paralelos | Moses clásico |
| `neural-nmt` | Un modelo de MT codificador-decodificador neural dedicado | Google Translate, DeepL, Microsoft Translator, OPUS-MT, LibreTranslate, Tilde MT, Translated (Lara) |
| `llm` | Un modelo de lenguaje grande de propósito general indicado para traducir | una llamada GPT / Claude / Gemini sin procesar o entrenada |
| `hybrid` | Combina dos o más paradigmas en un método | un LLM controlado por un FST basado en reglas (crk-translate); NMT + edición posterior basada en reglas |
| `human` | Traducción humana (línea de base a nivel de paradigma) | línea de base de traductor comunitario |
| `unknown` | No especificado — la tarjeta no declaró paradigma | compatibilidad hacia atrás para tarjetas anteriores al paradigma |

Los ejes son independientes. Algunos ejemplos trabajados:

| Método | `class` | `paradigm` | `dependency_class` |
|--------|---------|-----------|--------------------|
| Google Translate | `api` | `neural-nmt` | A2 |
| Tilde MT / Translated (Lara) | `api` | `neural-nmt` | A2 |
| LibreTranslate (auto-hospedado, OSS) | `api` | `neural-nmt` | O |
| Apertium | `pipeline` | `rule-based` | O |
| crk-translate (FST-controlado, LLM-entrenado) | `pipeline` | `hybrid` | A2 |
| Llamada GPT sin procesar | `raw-llm` | `llm` | A1 |

El paradigma es **opcional** en una tarjeta de método; un paradigma ausente se registra como `unknown` (nunca bloquea la publicación — el eje es aditivo). La enumeración anterior es el vocabulario canónico y admitido, aplicado por el arnés (`config.VALID_PARADIGMS`). Debido a que la aplicación es del lado de la aplicación en lugar de una restricción de base de datos, se pueden agregar nuevos paradigmas más adelante sin una migración; solo renombrar o eliminar un valor una vez que los métodos dependan de él es costoso.

## Validez de Método y Clases de Dependencia {#method-validity-and-dependency-classes}

Un método es tan ejecutable, y tan transferible, como su dependencia menos disponible. Dos mecanismos de Network dependen de saber exactamente qué necesita un método:

1. **Evaluación en caja de arena** ([Especificación de Evaluación §8.2](/docs/network/specifications/benchmark)) — las puntuaciones de oro estándar oficial provienen de una caja de arena cuya política de red es **negación por defecto**. Un método que requiere silenciosamente un servicio externo no puede producir una puntuación oficial.
2. **Transferencia de premios** ([Especificación de Premios](/docs/network/specifications/prizes)) — los métodos ganadores de premios se transfieren a la organización de gobernanza de la comunidad de idiomas. Un método que agrupa contenido que el remitente no tenía derecho a incluir no puede transferirse legalmente. El remitente debe poseer (o se le debe otorgar) los derechos de todo en la caja.

Para hacer ambas verificaciones mecánicas en lugar de ad hoc, cada método declara una **clase de dependencia**, derivada de un **manifiesto de dependencia** en `method.json`.

> **Nota sobre nomenclatura — tres ejes independientes.** *Clase de método* (§arriba: `raw-llm`, `pipeline`, …) describe la *forma* de un método — el contrato de interfaz que presenta. *Paradigma* ([§Paradigmas](#paradigms): `rule-based`, `neural-nmt`, `llm`, …) describe *cómo traduce algorítmicamente*. *Clase de dependencia* (esta sección) describe *qué necesita para ejecutarse y transferirse*. Los tres son ortogonales: un método `pipeline` puede ser `rule-based` o `hybrid`, y puede ser cualquier clase de dependencia. (La clase y el paradigma son intencionalmente separados porque la clase por sí sola está centrada en LLM — no puede distinguir un sistema basado en reglas de uno neural cuando ambos se presentan como `pipeline` o `api`.)

### Las Cinco Clases de Dependencia

| Clase | Nombre | Definición | ¿Ejecutable en caja de arena? | ¿Elegible para premio? |
|-------|------|-----------|-------------------|-----------------|
| **S** | Autónomo | Todo el código, datos, modelos y pesos se envían dentro del directorio del método, bajo licencias que permiten redistribución y transferencia comunitaria. | ✅ Sí, tal cual | ✅ Sí |
| **O** | Externo abierto | Depende de artefactos alojados externamente bajo licencias abiertas que permiten redistribución (incluidas licencias copyleft como AGPL) — por ejemplo, un FST descargado en tiempo de instalación. | ✅ Sí — los artefactos se fijan y se **reflejan en el envío** | ✅ Sí, con condiciones de compatibilidad de licencia: los términos copyleft se preservan a través de la transferencia, y la comunidad recibe los mismos derechos que la licencia otorga a todos |
| **A1** | Dependiente de API, sustituible | Requiere inferencia de LLM en tiempo de ejecución, donde el modelo es **configuración sustituible** — cualquier modelo suficientemente capaz puede insertarse. El valor del método reside en sus indicaciones, datos de entrenamiento y código, no en ningún modelo de un proveedor. | ⚠️ Solo a través de la **puerta de enlace de LLM** que la especificación de caja de arena define (🔲 planeado — ver a continuación) | ⚠️ Condicional — ver a continuación |
| **A2** | Dependiente de API, no sustituible | Requiere llamadas en tiempo de ejecución a una API de datos o servicio externo que no puede reflejarse o sustituirse — típicamente porque el contenido servido es propietario o sin licencia (por ejemplo, una API de diccionario cuyo diccionario subyacente no tiene licencia pública). | ❌ No — la dependencia no puede existir en la caja de arena sin el permiso del titular de derechos | ❌ No hasta que el titular de derechos otorgue permisos de **inclusión en caja de arena** y **transferencia**. Permitido en la tabla de clasificación abierta (segmento de desarrollo) con una bandera **"dependencia externa"** visible |
| **X** | Cerrado | Agrupa contenido que el remitente no tiene derecho a redistribuir — conjuntos de datos sin licencia, contenido propietario raspado, componentes incompatibles con licencia. | ❌ | ❌ Inadmisible en todos los carriles. Agrupar contenido sin derechos es una violación de licencia independientemente de dónde se ejecute el método |

**Clase efectiva.** La clase de dependencia de un método es la clase *más restrictiva* entre todas sus dependencias declaradas, en el orden S < O < A1 < A2 < X. Un diccionario sin licencia hace que una canalización por lo demás autónoma sea Clase A2 (si se accede en tiempo de ejecución) o Clase X (si se agrupa sin derechos).

### La Distinción A1/A2: Sustituibilidad

La mayoría de los métodos llaman a LLM. Network no pretende lo contrario — pero distingue dos tipos muy diferentes de dependencia de API:

- **A1 (sustituible):** La API proporciona inferencia de LLM de mercancía. El identificador del modelo es configuración: el método debe ejecutarse de extremo a extremo contra cualquier punto final compatible, incluido un modelo de peso abierto hospedado por la comunidad. La calidad de salida puede diferir entre modelos — ese es el riesgo del desarrollador, y las puntuaciones oficiales están vinculadas al modelo fijado utilizado en la evaluación. Un método que depende de **estado del lado del proveedor** (un ajuste fino hospedado solo en el proveedor, almacenes de archivos del proveedor, asistentes específicos del proveedor) *no* es sustituible: ese estado no puede extraerse, por lo que la dependencia es A2 a menos que los pesos o datos subyacentes se incluyan en el envío.
- **A2 (no sustituible):** La API sirve algo único — típicamente datos propietarios o sin licencia. Ningún punto final alternativo puede proporcionarlo, y el contenido no puede reflejarse en la caja de arena sin el permiso del titular de derechos. El método funciona en la tabla de clasificación abierta (marcado), pero no puede producir puntuaciones oficiales de caja de arena ni calificar para premios hasta que existan permisos.

**Lo que una transferencia de premio A1 realmente transmite.** La comunidad no recibe el modelo — nadie puede transferir los pesos de Anthropic, Google u OpenAI. La transferencia cubre la receta completa *alrededor* del modelo: todos los indicaciones, datos de entrenamiento, código de canalización, lógica de reintento, configuración y requisitos de modelo documentados. Debido a que el modelo es sustituible por construcción, la comunidad puede apuntar el método transferido a cualquier proveedor que elija — o a un modelo de peso abierto en su propio hardware — sin la participación del desarrollador. La receta es propiedad; el motor se alquila y es reemplazable.

### Manifiesto de Dependencia (`method.json`)

Cada método declara sus dependencias en el manifiesto `method.json`. Cada entrada registra qué es el artefacto, de dónde viene, qué licencia lo cubre y cómo el método lo accede:

```json
{
  "name": "FST-Gated Coached Translation v8",
  "method_id": "fst-gated-v8",
  "class": "pipeline",
  "paradigm": "hybrid",
  "entry_point": "pipeline:PipelineMethod",
  "supported_pairs": ["eng>crk"],
  "dependency_class": "A2",
  "dependencies": [
    {
      "id": "giellalt-lang-crk-fst",
      "kind": "software",
      "license": "AGPL-3.0-or-later",
      "access": "mirrored",
      "source": "https://github.com/giellalt/lang-crk",
      "pin": "sha256:3f1a…",
      "redistributable": true,
      "transferable": true
    },
    {
      "id": "llm-inference",
      "kind": "model",
      "license": "proprietary",
      "access": "gateway",
      "source": "openrouter:google/gemini-2.5-flash",
      "substitutable": true,
      "redistributable": false,
      "transferable": false,
      "notes": "Any compatible chat-completions endpoint works; the model slug is configuration."
    },
    {
      "id": "crk-dictionary-api",
      "kind": "service",
      "license": "none",
      "access": "external-api",
      "source": "https://itwewina.altlab.app/",
      "redistributable": false,
      "transferable": false,
      "notes": "Dictionary content has no public license; runtime lookups only. Class A2 until the rights holders grant permission."
    }
  ]
}
```

| Campo | Requerido | Descripción |
|-------|----------|-------------|
| `id` | ✅ | Identificador estable para la dependencia |
| `kind` | ✅ | `data`, `model`, `software`, o `service` |
| `license` | ✅ | Identificador SPDX, `proprietary`, o `none`. `none` significa que no existe licencia pública — se trata como todos los derechos reservados |
| `access` | ✅ | `bundled` (se envía en el directorio del método), `mirrored` (se obtiene en la instalación, se fija, se incluye en el envío), `gateway` (inferencia de LLM en tiempo de ejecución a través de la puerta de enlace de evaluación), `external-api` (cualquier otra llamada de red en tiempo de ejecución) |
| `source` | ✅ | URL canónica o identificador `provider:slug` |
| `pin` | para `mirrored` | Versión, confirmación o hash de contenido que fija el artefacto exacto |
| `substitutable` | para `gateway`/`external-api` | Si cualquier punto final compatible puede servir esta dependencia |
| `redistributable` | ✅ | Si la licencia permite redistribuir el artefacto |
| `transferable` | ✅ | Si el artefacto (o derechos sobre él) puede transferirse a una comunidad bajo términos de transferencia de premio |
| `notes` | ❌ | Contexto de forma libre |

**Derivación de clase.** Cada dependencia contribuye una clase; el `dependency_class` del método es el más restrictivo:

| Perfil de dependencia | Contribuye |
|--------------------|-------------|
| `bundled` + la licencia permite redistribución y transferencia | S |
| `mirrored` + licencia abierta que permite redistribución (copyleft incluido) | O |
| `gateway` + `substitutable: true` (inferencia de LLM) | A1 |
| `external-api`, o `gateway` con `substitutable: false` | A2 |
| `bundled` + `license: none` o licencia incompatible con redistribución | X |

El `dependency_class` declarado debe coincidir con la clase que el arnés deriva del manifiesto. Una discrepancia es un error de validación.

Un método sin **ninguna** dependencia externa declara `"dependency_class": "S"` y `"dependencies": []`. La matriz vacía es una declaración afirmativa, auditada como cualquier otra.

### Cómo Se Verifica la Validez

Tres capas, de la más barata a la más autorizada:

1. **Auditoría de manifiesto.** El arnés deriva la clase efectiva del manifiesto y rechaza discrepancias. Los revisores verifican cada dependencia declarada contra su licencia y fuente declaradas — una dependencia declarada `redistributable: true` cuya licencia ascendente dice lo contrario falla la revisión.
2. **Análisis estático.** El código enviado se escanea en busca de llamadas de red, descargas dinámicas y acceso al sistema de archivos que el manifiesto no contabiliza. Una dependencia *no declarada* encontrada en la revisión es motivo de rechazo independientemente de qué clase habría sido — el manifiesto debe ser completo, no solo preciso.
3. **Política de red de caja de arena.** La especificación de caja de arena requiere **negación por defecto de salida**: los contenedores de método no obtienen acceso de red a menos que una ruta se permita explícitamente. La única ruta de salida que la especificación define es la **puerta de enlace de LLM** — un proxy de inferencia operado por la infraestructura de evaluación, restringido a una lista de permitidos explícita de modelos fijados, con cada solicitud y respuesta registrada para auditoría posterior a la ejecución. Cualquier cosa que no esté en la lista de permitidos falla en la capa de red, no en la capa de política. Consulte [Especificación de Evaluación §8.6](/docs/network/specifications/benchmark) para la política de red y el diseño de puerta de enlace.

> **Dos espacios aislados diferentes — uno planeado, uno en vivo.** Lea esto con cuidado, porque la palabra "sandbox" cubre dos cosas distintas:
>
> - 🔲 **Planeado: el sandbox de la plataforma y su puerta de enlace LLM.** El entorno operado por la infraestructura de evaluación descrito en esta sección — el cuyo gateway LLM permitiría que los métodos de Clase A1 produzcan puntuaciones estándar de oro oficial — está especificado pero aún no construido. Hasta que lo esté, los métodos de Clase A1 son elegibles para premio *en principio* pero aún no pueden producir puntuaciones estándar de oro oficial.
> - ✅ **En vivo: el carril de ejecución de métodos del nodo organizador.** El nodo de puntuación propio de un organizador de concurso ya ejecuta paquetes de métodos propuestos dentro de un contenedor aislado de red (`mt-eval node run-method`): construido y ejecutado con `--network=none`, raíz de solo lectura, dependencias vendidas — lo que lo restringe a métodos que no necesitan red en tiempo de ejecución (Clase S/O por construcción). Puede ejecutarse en una máquina de verdadero aislamiento de aire con paquetes de solo puntuaciones firmadas cruzando por medios removibles. Consulte [Ejecutar un Concurso Soberano](/docs/network/sovereignty/run-a-sovereign-contest) para la ruta de extremo a extremo.
>
> Esta sección describe lo que la especificación de la plataforma requiere, no lo que actualmente se ejecuta en la plataforma.

### Visualización de Tabla de Clasificación

- La tabla de clasificación muestra la clase de dependencia de cada método junto con su distintivo de clase de método.
- Los métodos de Clase A2 en la tabla de clasificación abierta llevan una bandera **"dependencia externa"** visible: sus puntuaciones dependen de un servicio de terceros que puede cambiar o desaparecer, y actualmente no son elegibles para premios.
- Los métodos de Clase X no se enumeran.

## Arnés de Evaluación: Protocolo TranslationMethod {#eval-harness-translationmethod-protocol}

El arnés de evaluación utiliza tipificación estructural de Python (`Protocol`) para complementos. Cualquier clase con los miembros correctos funciona — no se requiere herencia. El protocolo tiene **tres** miembros requeridos, no solo `translate`:

1. **`name`** (`str`) — nombre de método legible por humanos, utilizado en identificadores de ejecución y registros.
2. **`method_card()`** (`-> dict | None`) — metadatos del método para seguimiento de procedencia, incrustados en el registro de ejecución y tarjeta de ejecución publicada. Devuelva `None` si el método no tiene tarjeta.
3. **`async translate(entries, config)`** (`-> list[dict]`) — la traducción en sí: un lote de entradas, un diccionario de resultado por entrada salida.

Cuando el arnés carga un complemento a través de `--method path/to/dir`, valida que `translate` sea invocable y luego lee `method.name` y llama a `method.method_card()` incondicionalmente — un complemento que carezca de cualquiera de estos se bloqueará al cargar, no fallará elegantemente.

```python
class MyMethod:
    name = "My Pipeline v1"  # required — run IDs and logs

    def method_card(self) -> dict | None:
        # required — provenance metadata (or None for no card)
        return {
            "method_id": "my-pipeline-v1",
            "name": self.name,
            "class": "pipeline",
        }

    async def translate(self, entries: list[dict], config: RunConfig) -> list[dict]:
        results = []
        for entry in entries:
            translation = await self.do_translation(entry["source"])
            results.append({
                "id": entry["id"],
                "predicted": translation,
                "latency_s": 0.5,
                "usage": {"prompt_tokens": 0, "completion_tokens": 0},
                "error": None,
                "tool_calls": [],
                "tool_call_count": 0,
                "metadata": {},
            })
        return results
```

El directorio del complemento necesita un manifiesto `method.json` con al menos `name` y `entry_point` (`"module_name:ClassName"` — el módulo se carga desde el directorio del complemento y la clase se instancia). Si una tarjeta de método devuelta declara un `class` o `paradigm`, debe utilizar el vocabulario canónico anterior — una tarjeta fuera de taxonomía falla la validación al cargar en lugar de desaparecer silenciosamente de los filtros del marcador.

Para un ejemplo completo trabajado — construir, ejecutar y enviar un complemento de extremo a extremo — consulte [Enviar un Método](/docs/network/getting-started/submit-a-method) y el [libro de recetas de Canalización Controlada por FST](/docs/network/tutorials/fst-gated-pipeline).

## champollion: Configuración methodPlugin

En champollion, los métodos se registran por par de idiomas en `champollion.config.json`:

```json
{
  "version": 3,
  "pairs": {
    "en:crk": {
      "methodPlugin": "crk-coached-v1"
    }
  }
}
```

Consulte la [Especificación de Complemento](https://champollion.dev/docs/reference/plugin-spec) para la interfaz del lado de champollion.

## Integración de Tabla de Clasificación

Cuando una tarjeta de método se adjunta a una ejecución (a través de `--method-card`), se incrusta en la tarjeta de ejecución y se muestra en la tabla de clasificación:

```bash
# Run with method card attached
mt-eval run \
  --method path/to/my-method \
  --corpus eval-amh-fra-globalvoices-test-v1 \
  --method-card method_card.json

# Publish to the leaderboard
mt-eval publish eval/logs/harness/your-run-card.json
```

Si no se proporcionó `--method-card`, `mt-eval publish` inicia un asistente interactivo que lo guía a través de la descripción de su método.

La tabla de clasificación muestra:
- **Distintivo de clase** — indicador visual (por ejemplo, "pipeline", "coached-llm")
- **Paradigma** — el paradigma algorítmico (por ejemplo, "rule-based", "neural-nmt", "llm", "hybrid"), una columna filtrable (consulte [Paradigmas](#paradigms))
- **Clase de dependencia** — S/O/A1/A2 (consulte [Validez de Método y Clases de Dependencia](#method-validity-and-dependency-classes)); los métodos A2 llevan una bandera "dependencia externa"
- **Nombre del método** — de la tarjeta de método
- **Herramientas utilizadas** — enumeradas de la tarjeta de método
- **Indicador de código abierto**

Cuando no se adjunta ninguna tarjeta de método, la tabla de clasificación muestra configuración nativa del arnés (modelo, versión de indicación, temperatura, herramientas habilitadas).

:::danger[NO ENTRENE con datos de evaluación]
Los métodos cuyo proceso de desarrollo incluyó exposición al conjunto de datos de evaluación — como datos de entrenamiento, ejemplos de pocos disparos, entradas de diccionario o material de ajuste de indicaciones — serán **descalificados** del marcador. Consulte [Evaluación de MT](/docs/network/leaderboard/rules) para saber qué distingue un buen método de uno malo.
:::

---

## Véase También

- [Evaluación de MT](/docs/network/leaderboard/rules) — descripción general, valor de tabla de clasificación y orientación de método bueno/malo
- [Arnés de Evaluación](/docs/network/specifications/harness) — cómo ejecutar evaluaciones
- [Conjuntos de Datos de Evaluación](/docs/network/leaderboard/datasets) — conjuntos de datos disponibles (EDTeKLA, FLORES+)
- [Especificación de Tarjeta de Ejecución](/docs/network/specifications/run-card) — el esquema JSON de tarjeta de ejecución
- [Especificación de Complemento](https://champollion.dev/docs/reference/plugin-spec) — interfaz de complemento del lado de champollion
- [Tabla de Clasificación de Métodos](https://champollion.dev/leaderboard) — puntuaciones de evaluación en vivo
- [Especificación de Evaluación](/docs/network/specifications/benchmark) — protocolo de evaluación, formato de corpus, esquema de tarjeta de ejecución
- [Especificación de Puntuación](/docs/network/specifications/scoring) — SSOT para métricas, pesos compuestos y niveles de calidad
