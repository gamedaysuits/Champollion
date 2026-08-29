---
sidebar_position: 5
title: "Especificación de Puntuación"
slug: '/network/specifications/scoring'
related:
  - label: "Statistical Significance Testing"
    to: /docs/network/specifications/significance
    kind: spec
    note: "When a score difference actually means something"
  - label: "Benchmark Specification"
    to: /docs/network/specifications/benchmark
    kind: spec
  - label: "Eval Harness v2.0"
    to: /docs/network/specifications/harness
    kind: spec
    note: "The tool that computes these metrics"
  - label: "MT Evaluation Rules"
    to: /docs/network/leaderboard/rules
    kind: doc
  - label: "Live Leaderboard"
    to: https://champollion.dev/leaderboard
    kind: leaderboard
    note: "These scores, live"
---

# Especificación de Puntuación

> **Resumen ejecutivo.** Esta es la única fuente de la verdad para todas las métricas de evaluación, la puntuación compuesta, los niveles de calidad y el análisis de costos en el ecosistema de evaluación de MT de Champollion. Las métricas de evaluación específicas del idioma —validez morfológica FST, clases de equivalencia del linter y validación semántica determinista— se denominan colectivamente **LYSS** (Linguistically-informed Yield & Structural Scoring). Cada métrica calculada por el entorno de pruebas, cada peso en la fórmula compuesta y cada umbral de nivel se define aquí, y solo aquí. El código, la documentación y los esquemas de la base de datos se derivan de este documento. En caso de conflicto, este documento prevalece.
>
> **Alcance.** Este documento define *qué* medimos y *cómo lo puntuamos*. No define el esquema de la tarjeta de ejecución (consulte BENCHMARK_SPEC §3), el protocolo de evaluación comparativa (BENCHMARK_SPEC §6) ni las reglas de la tabla de clasificación (consulte la documentación de la arena). Esos documentos hacen referencia a este para las definiciones de métricas y la lógica de puntuación.

---

## 1. Filosofía de Puntuación

### 1.1 Filosofía de Microeval

> *"Si solo nos enfocamos en lo que se generaliza, inevitablemente olvidaremos dónde no lo hace — y perderemos estos idiomas y todo su conocimiento y sabiduría."*

Este proyecto practica **desarrollo de microeval**: construir métricas de evaluación adaptadas a idiomas específicos utilizando las mejores herramientas lingüísticas disponibles — transductores de estado finito, diccionarios bilingües, analizadores morfológicos, reglas de equivalencia curadas por lingüistas. Esto es lo opuesto al paradigma dominante en evaluación de MT, que busca métricas universales que funcionen en todos los idiomas. Las métricas universales son valiosas, pero son más débiles precisamente donde más se necesitan: para idiomas con morfología compleja, datos de entrenamiento limitados y sin representación en conjuntos de entrenamiento de métricas neuronales.

No estamos haciendo progreso en traducción automática para muchos idiomas del mundo no solo porque nos falten corpus, sino porque **ni siquiera sabemos qué aspecto tiene el progreso** — nos faltan las herramientas de evaluación automatizadas para medir si un sistema de traducción está mejorando. LYSS es nuestro intento de construir esas herramientas, idioma por idioma, utilizando los recursos lingüísticos que existan.

### 1.2 Las Métricas Automatizadas Son Aproximaciones

Cada métrica definida aquí se calcula por máquina. Son útiles para iteración rápida, comparación sistemática y detección de regresiones. **No son sustitutos del juicio humano**. Los niveles de calidad en §5 son etiquetas heurísticas — solo la revisión humana puede confirmar la usabilidad real.

### 1.3 Diseño Multi-Señal

Ninguna métrica única captura la calidad de la traducción. Una traducción puede tener una superposición chrF++ perfecta pero fallar la validación morfológica. Puede pasar las verificaciones FST pero llevar el significado incorrecto. Puede ser semánticamente precisa pero estilísticamente ajena al idioma de destino. La puntuación compuesta en §4 agrega múltiples señales independientes, cada una capturando una dimensión diferente de la calidad.

### 1.4 Extensibilidad

Este inventario de métricas no está cerrado. Los nuevos idiomas traen nuevos requisitos: precisión de tonos para idiomas tonales, precisión diacrítica para escrituras semíticas, corrección de silabario para Cree. La arquitectura (protocolo MetricPlugin, compuesto ponderado con renormalización) está diseñada para que las métricas se agreguen sin romper las puntuaciones existentes. Las métricas específicas del idioma (p. ej., el linter y validador semántico de CRK) se declaran en tarjetas de idioma bajo `evalMetrics` y se cargan desde `eval_standards/` — el harness se envía solo con métricas de comportamiento genérico (cambio de código, alucinación, terminología).

### 1.5 Tres Dimensiones de Evaluación

Cada tarjeta de ejecución mide tres dimensiones independientes:

```
Quality   — How good is the translation?   (composite score, §4)
Cost      — How much does it cost?          (cost metrics, §6)
Speed     — How fast does it run?           (speed metrics, §7)
```

Estos son ejes independientes. Un método puede ser de alta calidad pero costoso, rápido pero inexacto, o cualquier combinación. La tabla de clasificación permite ordenar por cualquier dimensión. La puntuación ajustada por costo (§6.3) es la única métrica que combina dimensiones.

### 1.6 Estado de Validación

Cada métrica en esta especificación tiene un **estado de validación** distinto de su estado de implementación (§3). El estado de implementación rastrea si existe código. El estado de validación rastrea si se ha demostrado que la métrica se correlaciona con juicios de calidad humana.

| Nivel de Validación | Significado | Métricas Actuales |
|------------------|---------|----------------|
| **✅ Validado externamente** | Existen estudios de correlación humana publicados (WMT, artículos académicos) | `chrf_plus_plus`, `bleu`, `comet_score` *(solo pares de alto recurso)* |
| **⚡ Validado por proxy** | Validado para idiomas de alto recurso; no validado para nuestros LRL de destino | `comet_score` *(para LRL: validado en pares de alto recurso/UE, extrapolado a p. ej. CRK — directamente útil pero sin calibrar)* |

> **Por qué `comet_score` aparece en dos filas.** Esta es una división por nivel de recurso, no una contradicción. COMET es *validado externamente* donde existen estudios de correlación humana de WMT — pares de alto recurso, principalmente europeos. Para nuestros idiomas de bajo recurso de destino no hay tales estudios, por lo que la misma métrica es solo *validada por proxy*: el modelo extrapola de idiomas con sistemas morfológicos diferentes. Esta es también la razón por la que COMET se reporta en un carril neural separado y nunca se pliega en el compuesto (§4.3).
| **🔶 Heurística de ingeniería** | Diseñado a partir de principios lingüísticos o modos de fallo observados; sin datos de correlación humana | `fst_acceptance_rate`, `morphological_accuracy` (derivado de FST, coincidencia de lema; **activo** en el compuesto fst-coverage, re-derivado por verificador), `equivalent_match_rate`, `semantic_score`, `code_switching_rate`, `hallucination_rate`, `terminology_adherence` |
| **🔲 No validado** | Aún no probado en ningún dato | `orthographic_accuracy`, `consistency_score` |

> **Qué significa esto en la práctica.** La puntuación compuesta (§4) agrega métricas en todos los niveles de validación. Esta es una opción de diseño explícita: creemos que una heurística de ingeniería estructuralmente fundamentada (aceptación FST) es más informativa para idiomas polisintéticos que una métrica neuronal validada solo en pares europeos (COMET). Pero no lo hemos probado. La puntuación compuesta debe tratarse como una **estimación de ingeniería**, no una medición de calidad validada, hasta que se completen estudios de correlación humana para cada idioma de destino.
>
> **Experimentos de validación requeridos** (ver `mt-evaluation-landscape.md` §6 y `speaker-validation.md`):
> 1. Estudio de correlación de juicio humano: 200+ pares de oraciones calificados por 3+ hablantes bilingües
> 2. Medición de tasa de rechazo falso FST en un corpus representativo
> 3. Puerto de segundo idioma (Sámi del Norte) para probar generalización
> 4. Comparación directa con COMET en los mismos datos

---

## 2. Inventario de Métricas {#2-metric-inventory}

Las métricas se organizan en seis categorías (superficie, estructural, semántica, comportamiento, cumplimiento y comparadores reportados). Cada métrica tiene un estado de implementación, escala y nivel (por entrada, nivel de corpus, o ambos).

### 2.1 Métricas de Superficie

Las métricas de superficie comparan la traducción predicha con la traducción de referencia a nivel de cadena. No requieren herramientas lingüísticas — solo comparación de cadenas.

| ID | Métrica | Estado | Escala | Nivel | Implementación |
|----|--------|--------|-------|-------|---------------|
| `exact_match_rate` | Coincidencia Exacta | ✅ Implementado | 0.0–1.0 | Ambos | Binario: ¿predicho == referencia? Tasa de corpus = coincidencias / total. |
| `equivalent_match_rate` | Coincidencia Equivalente | ⚡ Parcial | 0.0–1.0 | Ambos | ¿La salida predicha coincide con alguna variante aceptada? Para CRK: implementado a través del estándar de evaluación de CRK `CrkLinterMetric` (en `eval_standards/crk/`) utilizando reglas de clase de variante determinista (orden de palabras, ortográfico, partícula opcional, sinónimo de lema, ambigüedad progresiva). Cargado automáticamente a través de la declaración `evalMetrics` de la tarjeta de idioma CRK. La implementación genérica entre idiomas requiere `variants[]` por entrada en corpus. |
| `chrf_plus_plus` | chrF++ | ✅ Implementado | 0–100 | Ambos | Puntuación F de n-gramas de caracteres (sacrebleu). Robusto a variación morfológica. La métrica de superficie principal para idiomas aglutinantes/polisintéticos. Por entrada usa `sentence_chrf`; corpus usa `corpus_chrf`. |
| `bleu` | BLEU | ✅ Implementado | 0–100 | Corpus | Precisión de n-gramas a nivel de palabra (sacrebleu). **Excluido del compuesto** — la puntuación a nivel de palabra penaliza la variación morfológica injustamente. Calculado y reportado para compatibilidad con literatura de MT. |
| `ter` | Tasa de Edición de Traducción | ✅ Implementado | 0–∞ (menor es mejor) | Ambos | Distancia de edición mínima entre predicho y referencia, normalizada por longitud de referencia (sacrebleu `corpus_ter`). Calculado junto con chrF++ y BLEU. Excluido del compuesto — se correlaciona con chrF++ por lo que incluir ambos contaría doble la similitud de superficie. |
| `length_ratio` | Relación de Longitud | ✅ Implementado | 0–∞ (1.0 es ideal) | Ambos | `len(predicted) / len(reference)` en caracteres. Detecta truncamiento (<0.5) e inflación/alucinación (>2.0). Promediado en entradas a nivel de corpus. |

### 2.2 Métricas Estructurales

Las métricas estructurales validan la buena formación lingüística de la traducción. Requieren herramientas específicas del idioma (analizadores FST, analizadores morfológicos) y son las señales más fuertes para idiomas morfológicamente ricos.

| ID | Métrica | Estado | Escala | Nivel | Implementación |
|----|--------|--------|-------|-------|---------------|
| `fst_acceptance_rate` | Aceptación FST | ✅ Implementado | 0.0–1.0 | Ambos | Proporción de palabras de salida aceptadas por un transductor de estado finito (GiellaLT). Una palabra es "válida" si el FST devuelve al menos un análisis morfológico. Disponible para cualquier idioma con un analizador `.hfstol` de GiellaLT. |
| `morphological_accuracy` | Precisión Morfológica | ✅ Activo (perfil fst-coverage; re-derivado por verificador) | 0.0–1.0 | Ambos | Una palabra puede ser válida en FST pero tener la inflexión incorrecta (raíz correcta, sufijo incorrecto). **Calculado** por `plugins/giellalt_fst.py`: para cada palabra predicha analizable, encuentre una palabra de referencia que comparta su **lema** (raíz) y verifique si la **inflexión** predicha (etiquetas de características FST) coincide. Coincidencia por lema — no por posición — evita la alineación de palabras: una opción de palabra diferente o un par mal alineado simplemente no está *cubierto* (nunca se puntúa falsamente). **No se necesitan anotaciones de oro** — el análisis FST de la referencia *es* la verdad fundamental. Las palabras que el FST no puede analizar, o cuya raíz no está en la referencia, están fuera de cobertura; `morph_coverage` (la fracción coincidida por lema) se divulga, y la métrica solo entra en el compuesto cuando la cobertura ≥ `MORPH_COVERAGE_FLOOR` (0.25) — por debajo del piso permanece como asesor. Es **indulgente bajo ambigüedad FST** (una palabra predicha con varios análisis es "correcta" si *cualquiera* coincide → un límite superior, divulgado). Lleva un **peso de 0.15** en el perfil fst-coverage y es **re-derivado por el verificador** contra el corpus canónico (`verifier.recompute_corpus_morph`, que re-ejecuta el FST fijado en la tarjeta — falla cerrada si el FST está ausente, mismo contrato que COMET). Activado 2026-06-16 (migración 029 aplicada a dev + prod). |
| `orthographic_accuracy` | Precisión Ortográfica | 🔲 Planeado | 0.0–1.0 | Ambos | Valida la corrección específica del script: uso de macron/circunflejo SRO para Cree, marcas diacríticas para Inuktitut, marcadores de longitud de vocal para Ojibwe. Conjuntos de reglas por idioma. |

> **Por qué las métricas estructurales importan.** El OMT-1600 de Meta — el sistema de MT más grande jamás publicado (1.600 idiomas; Meta AI, *Omnilingual MT*, arXiv:2603.16309, 2026) — evalúa con ChrF++, xCOMET, MetricX y BLASER 3. Ninguno de estos valida la corrección morfológica. ChrF++ mide la superposición de n-gramas de caracteres: recompensa cadenas que *parecen* el idioma de destino. Para idiomas polisintéticos, esto significa que una palabra morfológicamente inválida que comparte muchos caracteres con la referencia obtiene una puntuación alta. Nuestra métrica de aceptación FST es una prueba estructural binaria: la palabra es una forma válida en el idioma, o no lo es. Ningún otro marco de evaluación de MT proporciona esto a escala. ChrF++ también tiene un **piso de probabilidad distinto de cero** que difiere según la ortografía — el texto aleatorio del mismo sistema de escritura obtiene una puntuación mediblemente superior a cero, más en algunos sistemas de escritura que en otros — por lo que el chrF++ sin procesar no es comparable entre idiomas; el mapa de red lo corrige con [chrF++ corregido por probabilidad (cchrF++)](/docs/network/specifications/connection-strength).

### 2.3 Métricas Semánticas

Las métricas semánticas miden la preservación del significado utilizando incrustaciones o modelos aprendidos. Capturan traducciones que son superficialmente diferentes pero semánticamente equivalentes, e indican traducciones que son superficialmente similares pero semánticamente incorrectas.

| ID | Métrica | Estado | Escala | Nivel | Implementación |
|----|--------|--------|-------|-------|---------------|
| `semantic_score` | Similitud Semántica | ⚡ Parcial | 0.0–1.0 | Ambos | CRK: puntuación ponderada por veredicto del estándar de evaluación de CRK `CrkSemanticMetric` (en `eval_standards/crk/`, proxy). Universal: similitud de coseno de incrustaciones de oraciones (fuente + predicho vs fuente + referencia). Modelo TBD — debe soportar idiomas de bajo recurso, lo que descarta la mayoría de modelos de incrustación centrados en inglés. |
| `comet_score` | COMET | ✅ Implementado | ~0.0–1.0 | Ambos | Métrica de evaluación de MT aprendida (Unbabel). **Calculada y reportada POR SEPARADO — nunca en ningún compuesto** (el compuesto es determinista; §4.3). Re-derivada por el verificador, por lo que un valor reportado debe reproducirse. Marcada con una advertencia de calibración de bajo recurso para idiomas como Plains Cree. Calculada cuando `unbabel-comet` está instalado. Para 35 idiomas africanos, el harness selecciona automáticamente AfriCOMET (`masakhane/africomet-mtl`) a través de `resolve_comet_model()`, que tiene mejor correlación de juicio humano para esos idiomas. |

> **Por qué COMET se reporta por separado, no compuesto.** COMET se entrena en datos de evaluación humana de WMT, abrumadoramente pares europeos de alto recurso. Aplicado a Plains Cree u otros LRL el modelo extrapola de idiomas con sistemas morfológicos diferentes — directamente útil pero no calibrado. En lugar de plegar una señal dependiente del modelo, unevenly-validada en la puntuación titular, el compuesto se mantiene **determinista** (solo métricas reproducibles por verificador) y COMET/AfriCOMET se reportan en un **carril neural separado** (§4.3), re-derivado por el verificador. Un compuesto neuronal puede agregarse más tarde, una vez validado.
>
> **COMET de alto recurso se reporta, no se compone (por diseño).** Para pares genuinamente de alto recurso (alemán, francés, …) el `Unbabel/wmt22-comet-da` predeterminado está bien validado por WMT, y `resolve_comet_model()` lo selecciona. Pero COMET **no** se pliega en ningún compuesto — se calcula y se muestra en el carril neural separado como todas las otras métricas neuronales, y se re-deriva por el verificador. Mantener el compuesto determinista evita hacer una métrica dependiente del modelo de 2.3 GB obligatoria para los ~100+ idiomas que llevan `metricModelSupport.xlmr.tier: "high"`, y mantiene la puntuación titular reproducible desde el corpus solo.

> **AfriCOMET para idiomas africanos.** Cada tarjeta de idioma tiene un campo `metricModelSupport` (ver especificación de tarjeta de idioma §9) que declara qué modelos COMET especializados se entrenan para ese idioma. Para 35 idiomas africanos (yor, hau, ibo, amh, swa, etc.), la tarjeta declara AfriCOMET (`masakhane/africomet-mtl`) — un modelo COMET ajustado en juicios de MT de idiomas africanos por la comunidad Masakhane. El harness selecciona automáticamente el modelo recomendado a través de `resolve_comet_model()` leyendo desde tarjetas de idioma, pero esto puede anularse con `--comet-model`. Agregar nuevas asignaciones de idioma→modelo se realiza enriqueciendo la tarjeta de idioma (no editando código Python).

### 2.4 Métricas de Comportamiento

Las métricas de comportamiento detectan modos de fallo específicos en la salida de traducción. No miden la calidad directamente — detectan problemas.

| ID | Métrica | Estado | Escala | Nivel | Implementación |
|----|--------|--------|-------|-------|---------------|
| `code_switching_rate` | Tasa de Cambio de Código | ✅ Implementado | 0.0–1.0 (menor es mejor) | Ambos | Proporción de palabras de salida que están en el idioma de origen (típicamente inglés). Detectado a través de análisis de script Unicode y/o una lista de palabras del idioma de origen. Modo de fallo muy común de LLM: el modelo inserta palabras en inglés cuando no conoce el equivalente en el idioma de destino. |
| `hallucination_rate` | Tasa de Alucinación | ✅ Implementado | 0.0–1.0 (menor es mejor) | Ambos | Proporción de contenido de salida que no tiene contenido de origen correspondiente. Detectado a través de alineación de palabras o superposición de incrustaciones multilingües. Captura el modelo generando traducciones plausibles pero fabricadas. |
| `terminology_adherence` | Adherencia a Terminología | ✅ Implementado | 0.0–1.0 | Ambos | Para métodos entrenados: proporción de términos de terminología prescrita que aparecen en la salida. Requiere datos de diccionario de entrenamiento. Mide si el modelo respeta el vocabulario proporcionado por expertos. |
| `consistency_score` | Consistencia Entre Entradas | 🔲 Planeado | 0.0–1.0 | Solo Corpus | ¿Traduce el modelo el mismo término de origen de la misma manera en todas las entradas? La baja consistencia sugiere que el modelo está adivinando en lugar de aplicar patrones aprendidos. Requiere términos repetidos en entradas de corpus. |

### 2.5 Métricas de Cumplimiento

Las métricas de cumplimiento validan que las traducciones preserven la integridad estructural — marcadores de posición, formato y convenciones tipográficas. Son verificaciones de puerta de calidad, no puntuaciones de calidad.

| ID | Métrica | Estado | Escala | Nivel | Implementación |
|----|--------|--------|-------|-------|---------------|
| `compliance_index` | Cumplimiento de Doble Paso | ✅ Implementado | 0.0–1.0 | Ambos | Compuesto ponderado: 60% integridad de variables (¿se preservan las variables `{placeholder}`?) + 20% cumplimiento de comillas (caracteres de comilla correctos por tarjeta de idioma) + 20% cumplimiento de mayúsculas (sin fuga de letras latinas para idiomas sin mayúsculas). Calculado en salida cruda y post-procesada. A través de `DoublePassCompliancePlugin`. |
| `repair_effectiveness` | Efectividad de Reparación | ✅ Implementado | 0.0–1.0 | Corpus | Proporción de violaciones de cumplimiento que fueron reparadas automáticamente por ganchos post-traducción. Mide cuánto la puerta de calidad mejoró la salida cruda. |

> **Por qué el cumplimiento no está en el compuesto.** Las métricas de cumplimiento miden preservación estructural (marcadores de posición, comillas), no calidad de traducción. Una traducción puede ser perfecta lingüísticamente pero fallar el cumplimiento porque dejó caer una variable `{name}`. Estas son puertas de calidad — bloquean salida mala de envío, pero no clasifican la calidad de traducción.

### 2.6 Comparadores reportados (NUNCA en el compuesto)

Estos se reportan solo para contexto/comparación y nunca entran en ningún perfil compuesto:

| ID | Métrica | Estado | Notas |
|----|--------|--------|-------|
| `spbleu` | spBLEU (tokenizador FLORES-200) | ✅ Implementado | BLEU en la tokenización SentencePiece de FLORES-200 — comparable en scripts/segmentación (la lingua-franca de NLLB/FLORES). Necesita `sentencepiece` (dependencia central). |
| `chrf_plain` | chrF plano (`word_order=0`) | ✅ Implementado | La figura chrF que las tablas FLORES/WMT reportan, junto con nuestro chrF++ (`word_order=2`). |
| `fuse_score` | Comparador estilo FUSE | ⚡ Opt-in (`--fuse`) | Una **reimplementación SIN ENTRENAR** del enfoque FUSE de AmericasNLP-2025 (Raja & Vats): LaBSE semántico + F1 de token léxico + Soundex fonético + difflib difuso, mezclado como una *media sin ponderar* (no tenemos datos de entrenamiento de juicio humano para ajustar el Ridge/GBM original, y lo decimos). LaBSE/Soundex son el `fuse` extra opcional; sin LaBSE, `compute_fuse` devuelve `None` (divulgado) en lugar de fingir una puntuación. Cada componente que se ejecutó se enumera en `fuse_components`; el resultado se marca `fuse_untrained=true`. Permite que la tabla de clasificación muestre puntuación estructurada/gated FST contra una línea de base estilo FUSE. |

### 2.7 Espacios de Nombres de Métricas {#2-7-metric-namespaces}

Una sola métrica lleva hasta cuatro nombres coordinados en la pila: el
**id canónico** (la clave `scores` en una tarjeta de ejecución, p. ej. `equivalent_match_rate`),
el **nombre del plugin** Python que la calcula (p. ej. `crk_linter`), la **clave `evalMetrics`** de la tarjeta de idioma
que la declara (p. ej. `lyss-eq`), y la **columna `run_cards`** desnormalizada
en la tabla de clasificación (p. ej. `equivalent_match_rate`). Estos son deliberadamente distintos — el nombre del plugin indica la
*herramienta*, el id de métrica indica la *medición* — pero deben mantenerse sincronizados.

La única fuente de verdad para esa asignación es `shared/metric-registry.json`, cargado
por `mt_eval_harness.metric_manifest`. Cada entrada registra los cuatro nombres más `scale`,
`direction` (mayor/menor/neutral), `level` (entrada/corpus/ambos), `in_composite`, y
`verifier_reproducible`. La prueba de paridad `arena/tests/test_metric_registry_ssot.py`
falla si las tablas de peso de `scoring.py` o las claves `scores` de tarjeta de ejecución acuñadas por
`publish.py` se desvían del registro, por lo que una nueva métrica no puede enviarse medio conectada.

Dos campos de tarjeta de ejecución relacionados hacen explícita la procedencia de la métrica:

- **`scores.metric_availability`** — un bloque `{metric: reason}` que desambigua una
  puntuación `null`: `not_applicable` (el idioma/ejecución no la usa), `unavailable`
  (faltaba una dependencia opcional), `below_coverage_floor` (presente pero demasiado
  disperso para entrar en el compuesto), `not_run` (opt-in y no solicitado), o
  `not_implemented` (planeado). Una métrica ausente del bloque fue calculada normalmente.
- **`fst_version`** / **`fst_provenance`** — la versión del transductor GiellaLT instalado
  y la versión `pyhfst` detrás de cualquier métrica derivada de FST, capturada de la misma manera
  que las firmas de sacreBLEU para que una puntuación estructural pueda rastrearse a una compilación exacta de
  analizador.

---

## 3. Niveles de Estado de Métrica

Cada métrica en §2 cae en uno de cuatro niveles de implementación:

| Nivel | Significado | Comportamiento de Tarjeta de Ejecución |
|------|-----------|-------------------|
| **✅ Implementado** | Existe código, probado, produciendo valores en tarjetas de ejecución hoy | Valor numérico en tarjeta de ejecución |
| **⚡ Parcial** | Existe proxy específico del idioma (p. ej., CRK) pero la implementación universal está pendiente | Valor numérico cuando se aplica proxy, `null` en caso contrario |
| **🔲 Planeado** | Especificado pero aún no implementado | `null` en tarjeta de ejecución (campo presente, valor ausente) |
| **💡 Propuesto** | Bajo discusión, aún no especificado | No en tarjeta de ejecución |

Una métrica se mueve de Planeado → Parcial cuando:
1. Se fusiona e implementa una implementación específica del idioma
2. Produce valores para al menos un par de idiomas
3. La implementación universal permanece pendiente (documentada en esta especificación)

Una métrica se mueve de Parcial → Implementado cuando:
1. Se fusiona e implementa una implementación agnóstica del idioma
2. Produce valores para cualquier par de idiomas sin plugins específicos del idioma
3. Este documento se actualiza para reflejar el estado ✅

Una métrica se mueve de Planeado → Implementado cuando:
1. La implementación se fusiona e implementa
2. Ha sido validada en al menos una ejecución de evaluación real
3. Este documento se actualiza con sus detalles de implementación

Una métrica se mueve de Propuesto → Planeado cuando:
1. Su definición, escala y método de cálculo se acuerdan
2. Se agrega a este documento con un estado `🔲 Planned`
3. Se agrega un marcador de posición nulo al esquema de tarjeta de ejecución

---

## 4. Puntuación Compuesta {#4-composite-score}

> [!CAUTION]
> **El compuesto es EXPERIMENTAL y NO VALIDADO.** Es un agregado ponderado de métricas que *significan cosas diferentes para idiomas diferentes*, con pesos que son **juicio de ingeniería, no ajustados empíricamente a juicios de calidad humana**. Ningún estudio de correlación humana respalda la ponderación para ningún idioma de destino. Trátelo como una clave de ordenamiento de conveniencia aproximada, **nunca** como una medición de calidad o una afirmación de que un sistema es "mejor". La señal real es el **perfil por métrica** — cada métrica mostrada con su valor y nivel de validación (§1.6). El compuesto se etiqueta como "experimental — no validado" dondequiera que aparezca (tabla de clasificación incluida), y nunca es el criterio para ningún premio o distinción. (Por diseño.)

### 4.1 Fórmula

La puntuación compuesta es un promedio ponderado de todas las métricas *disponibles*, renormalizado para que los pesos de las métricas disponibles sumen 1.0:

```
composite = Σ (weight_i × value_i)    for all available metrics
             ─────────────────────
             Σ weight_i               (re-normalization denominator)
```

Una métrica está "disponible" si su valor en la tarjeta de ejecución es un número (no `null`). Cuando una métrica no está disponible — porque el idioma no tiene FST, o porque una métrica aún no está implementada — su peso se redistribuye proporcionalmente entre las métricas restantes.

**Esto significa que el compuesto siempre es comparable dentro de una ejecución:** utiliza las métricas disponibles y normaliza en consecuencia. La comparación entre ejecuciones es válida cuando las ejecuciones utilizan el mismo conjunto de métricas disponibles.

> [!WARNING]
> **Comparabilidad entre ejecuciones.** Al comparar ejecuciones con diferente disponibilidad de métricas (por ejemplo, una ejecución tiene puntuaciones FST y otra no), las puntuaciones compuestas **no son directamente comparables**. Un compuesto de 0.72 calculado a partir de 5 métricas contiene más información que un compuesto de 0.72 calculado a partir de 2 métricas. El conjunto exacto de métricas de cada ejecución es auditable: la tarjeta de ejecución registra `scores.scoring_profile` y `scores.metric_availability` (§2.7), y una métrica no medida se muestra como "—" en la tabla de clasificación, nunca como 0. Para una comparación rigurosa, utilice pruebas de significación bootstrap emparejadas (§8.2) únicamente en las métricas compartidas.

### 4.2 Normalización de Entrada

Antes de entrar en la fórmula compuesta, todas las métricas deben estar en una **escala 0.0–1.0** donde 1.0 = perfecto:

| Métrica | Escala Nativa | Normalización |
|--------|-------------|---------------|
| `exact_match_rate` | 0.0–1.0 | Ninguna (ya normalizada) |
| `equivalent_match_rate` | 0.0–1.0 | Ninguna |
| `fst_acceptance_rate` | 0.0–1.0 | Ninguna |
| `morphological_accuracy` | 0.0–1.0 | Ninguna |
| `chrf_plus_plus` | 0–100 | **Dividir por 100** |
| `semantic_score` | 0.0–1.0 | Ninguna |
| `code_switching_rate` | 0.0–1.0 (menor es mejor) | **`1.0 - value`** (invertir: 0% cambio de código = 1.0) |
| `hallucination_rate` | 0.0–1.0 (menor es mejor) | **`1.0 - value`** (invertir) |
| `terminology_adherence` | 0.0–1.0 | Ninguna |

Las métricas no en ningún perfil compuesto (`bleu`, `ter`, `length_ratio`, `consistency_score`, y el neural `comet_score`/`qe_score`) no se normalizan para este propósito. (Las métricas neuronales se reportan por separado y nunca entran en un compuesto — §4.3.)

### 4.3 Tablas de Peso {#43-weight-tables}

**Registro de perfil nombrado (impulsado por tarjeta).** El compuesto ya no se elige por un booleano `has_fst` único. Cada idioma se resuelve a un **perfil nombrado** a través de `language_cards.resolve_scoring_profile()`; el perfil nombra una tabla de peso, reflejada en `scoring.py`'s `PROFILE_REGISTRY`. Una tarjeta puede declarar `scoringProfile.basis` para anular; cuando está ausente, el predeterminado reproduce el comportamiento heredado (`fst-coverage` cuando un FST puntuó la ejecución, si no `surface-only`). El perfil que produjo cada compuesto se registra en la tarjeta de ejecución como `scores.scoring_profile`, por lo que la ponderación es auditable por fila de tabla de clasificación.

**Métricas inactivas (reservadas).** Algunas métricas llevan un peso *declarado* a continuación pero aún no están activas, por lo que se enumeran en `scoring.INACTIVE_METRICS` y **se excluyen del compuesto** hasta que se calculen por entrada y sean re-puntuables por el verificador (la puerta de confianza). Excluir una métrica ausente no cambia ninguna puntuación — solo hace "aún no puntuando" explícito en lugar de silencioso. Actualmente inactivo:

- `orthographic_accuracy` — necesita reglas ortográficas por idioma (no construidas).

(`morphological_accuracy` estuvo inactivo a través de P5; **activado 2026-06-16** bajo el perfil `fst-coverage` — se calcula (coincidencia de lema; §2.2), entra en el compuesto cuando `morph_coverage ≥ 0.25` (asesor por debajo del piso), y se re-deriva por el verificador. **Las métricas neuronales (`comet_score`, `qe_score`) se excluyen de cada compuesto** — se calculan y reportan por separado; ver "Métricas neuronales" a continuación.)

#### `fst-coverage` (Perfil A): Idiomas CON Cobertura FST

Para idiomas que tienen un transductor de estado finito GiellaLT disponible. Las métricas estructurales llevan el 40% del compuesto (FST 0.25 + precisión morfológica 0.15), reflejando la primacía de la corrección morfológica para idiomas polisintéticos/aglutinantes.

| Métrica | Peso Objetivo | Justificación |
|--------|--------------|-----------|
| `fst_acceptance_rate` | **0.25** | Peso más alto. Si el FST rechaza una palabra, no es una forma válida en el idioma — independientemente de lo que digan otras métricas. Binario, estructuralmente fundamentado. |
| `morphological_accuracy` | **0.15** | Una palabra puede ser válida en FST pero morfológicamente incorrecta (raíz correcta, inflexión incorrecta). Junto con FST, las métricas estructurales llevan el 40%. |
| `chrf_plus_plus` | **0.15** | Superposición de n-gramas de caracteres: el mejor proxy de nivel de superficie para idiomas polisintéticos. Maneja mejor la morfología aglutinante que las métricas a nivel de palabra. |
| `semantic_score` | **0.15** | Preservación de significado cuando la forma de superficie diverge. Captura traducciones semánticamente incorrectas que pasan verificaciones estructurales. |
| `equivalent_match_rate` | **0.10** | Recompensa variantes aceptables, no solo la traducción de referencia única. Importante para idiomas con orden de palabras flexible. |
| `code_switching_rate` | **0.05** | Penaliza fuga de idioma de origen. Invertido: 0% cambio de código = 1.0. |
| `terminology_adherence` | **0.05** | Recompensa métodos entrenados que respetan vocabulario prescrito. Solo activo cuando hay datos de entrenamiento. |
| `hallucination_rate` | **0.05** | Penaliza contenido fabricado. Invertido: 0% alucinación = 1.0. |
| `exact_match_rate` | **0.05** | Peso más bajo. Demasiado estricto para idiomas polisintéticos — existen múltiples traducciones correctas. Mantenido como verificación de techo. |

> **Total: 1.00.** Cuando las métricas no están disponibles, sus pesos se redistribuyen proporcionalmente entre las métricas disponibles. `morphological_accuracy` (peso 0.15) es **activo** — entra en el compuesto cuando `morph_coverage ≥ 0.25` y se re-deriva por verificador; por debajo del piso se redistribuye como cualquier métrica no disponible. Cuando *está* ausente (sin FST, o cobertura sub-piso), las 8 métricas restantes (peso total 0.85) se escalan cada una por 1/0.85 ≈ 1.176. Por ejemplo:
> - FST: 0.25/0.85 = 0.294
> - chrF++: 0.15/0.85 = 0.176
> - semántica: 0.15/0.85 = 0.176

#### `surface-only` (Perfil B): Idiomas SIN Cobertura FST

Para idiomas sin herramientas de validación morfológica. Las métricas semánticas y de superficie llevan peso igual.

| Métrica | Peso Objetivo | Justificación |
|--------|--------------|-----------|
| `semantic_score` | **0.25** | Sin validación estructural, la preservación de significado es la señal disponible más fuerte. |
| `chrf_plus_plus` | **0.25** | Sin FST, la superposición a nivel de caracteres se convierte en la verificación de superficie principal. |
| `equivalent_match_rate` | **0.15** | La coincidencia de variantes proporciona evaluación de calidad estructurada sin requerir herramientas morfológicas. |
| `exact_match_rate` | **0.10** | Sin FST, la coincidencia exacta lleva más peso como el único proxy de validación estructural. |
| `code_switching_rate` | **0.10** | La fuga de idioma de origen importa más cuando no hay FST para capturar salida mala. |
| `terminology_adherence` | **0.05** | Cumplimiento de vocabulario entrenado. |
| `hallucination_rate` | **0.05** | Detección de contenido fabricado. |
| `orthographic_accuracy` | **0.05** | La corrección específica del script llena parte de la brecha dejada por FST ausente. |

> **Total: 1.00.** `orthographic_accuracy` (peso 0.05) está en `INACTIVE_METRICS` (planeado, aún no calculado). Con está ausente, las 7 métricas restantes (peso total 0.95) se escalan por 1/0.95 ≈ 1.053 — un impacto negligible en el compuesto.

#### `no-reference`: ejecuciones sin referencia de oro

Para ejecuciones cuyo corpus **no tiene referencias de oro** (p. ej. idiomas de piso con solo FLORES contaminado que rechazamos puntuación contra). Las métricas basadas en referencia (`chrf_plus_plus`, `bleu`, `exact_match_rate`, `equivalent_match_rate`) no se pueden calcular, por lo que el compuesto determinista se apoya en las señales **sin referencia, reproducibles por verificador**.

| Métrica | Peso Objetivo | Justificación |
|--------|--------------|-----------|
| `fst_acceptance_rate` | **0.40** | La validez morfológica no necesita referencia; la señal determinista más fuerte cuando existe un FST. |
| `code_switching_rate` | **0.25** | Fuga de idioma de origen (invertida). |
| `hallucination_rate` | **0.20** | Contenido fabricado (invertido). |
| `terminology_adherence` | **0.15** | Cumplimiento de vocabulario entrenado. |

> **Total: 1.00.** Los cuatro son deterministas y reproducibles por verificador. Cuando una ejecución sin referencia no tiene FST, el compuesto se renormaliza sobre las verificaciones de comportamiento solo (una señal deliberadamente delgada, honesta); la **puntuación QE neuronal sin referencia (AfriCOMET-QE) se calcula y reporta por separado** — ver "Métricas neuronales" a continuación — como la señal de adecuación para tales ejecuciones.

#### Métricas neuronales — calculadas y reportadas POR SEPARADO (no en ningún compuesto)

El compuesto es **determinista**: cada métrica en él es reproducible por el verificador desde el corpus solo. **Las métricas neuronales se excluyen de cada compuesto** y se muestran por su cuenta (decisión de diseño — "compuesto determinista; neural separado, quizás compuesto por separado más tarde"):

| Métrica | Qué es | Dónde se muestra |
|--------|-----------|----------------|
| `comet_score` | Adecuación neuronal COMET / AfriCOMET (basada en referencia) | Su propia columna de tabla de clasificación + tarjeta de ejecución `neural_metrics`, con una advertencia de calibración de bajo recurso. |
| `qe_score` | QE neuronal AfriCOMET-QE sin referencia (fuente + MT) | Mismo carril neural separado; la señal de adecuación para ejecuciones `no-reference`. |

Ambas aún son **re-derivadas por el verificador** (`verifier.recompute_corpus_comet` / `recompute_corpus_qe`), por lo que una puntuación neuronal reportada que no se reproduce no puede confiarse — pero nunca mueven el compuesto determinista. El conjunto nombrado es `scoring.NEURAL_METRICS`. Un compuesto neuronal puede introducirse más tarde; por ahora las métricas neuronales se mantienen solas.

> **Nota sobre evolución de peso.** Estos pesos son provisionales y se recalibrarán a medida que se acumulen datos de validación humana. El objetivo a largo plazo es derivar pesos empíricamente: ¿qué métricas automatizadas predicen mejor los juicios de calidad humana para cada familia de idiomas?

### 4.4 Agregar una Nueva Métrica al Compuesto

Para agregar una nueva métrica al compuesto:

1. **Defínala** en §2 con estado `🔲 Planned`, incluyendo escala, nivel y método de cálculo.
2. **Implémtela** como un MetricPlugin (o en `tester.py` para métricas centrales).
3. **Agregue un marcador de posición nulo** en el bloque de puntuaciones de tarjeta de ejecución.
4. **Asígnele un peso objetivo** en §4.3 ajustando los pesos existentes hacia abajo. Los pesos deben sumar 1.00.
5. **Actualice BENCHMARK_SPEC.md** §3 si el esquema de tarjeta de ejecución cambia.
6. **Actualice `scoring.py`** tablas de peso (el código debe reflejar este documento).
7. **Ejecute un benchmark de validación** para confirmar que la métrica produce valores sensatos en datos reales.
8. **Actualice este documento** para cambiar estado de `🔲` a `✅`.

---

## 5. Niveles de Calidad {#5-quality-tiers}

Estos niveles son etiquetas heurísticas en puntuaciones compuestas automatizadas. Describen lo que las puntuaciones tienden a significar en la práctica, basado en revisión humana de salidas en cada nivel. **No son juicios de calidad validados** — solo la revisión humana puede confirmar la usabilidad real.

> [!IMPORTANT]
> **Los niveles automatizados son provisionales.** Estas etiquetas son nominaciones para revisión, no declaraciones de calidad. Un método que alcanza "Implementable" en métricas automatizadas es un candidato para evaluación comunitaria — no un producto para enviar. Solo la revisión humana por hablantes bilingües puede confirmar la usabilidad real (ver [BENCHMARK_SPEC §7](/docs/network/specifications/benchmark#7-human-validation)). Ningún método puede reclamar Implementable o superior sin revisión comunitaria confirmando que los hablantes acuerdan que la salida es usable. Los límites de nivel pueden diferir entre idiomas a medida que se acumulan datos de validación humana.

| Nivel | Rango Compuesto | Lo Que un Hablante Típicamente Ve |
|------|----------------|-------------------------------|
| **Línea Base** | 0.00–0.30 | Salida LLM cruda sin soporte específico del idioma. La morfología es mayormente alucinada. |
| **Emergente** | 0.30–0.50 | Algunos patrones correctos apareciendo. El entrenamiento está ayudando, pero la salida no es confiable. |
| **Funcional** | 0.50–0.70 | La salida es reconocible para un hablante. Las categorías gramaticales principales generalmente correctas. Errores morfológicos frecuentes. |
| **Implementable** | 0.70–0.85 | Adecuado para traducción de borrador con revisión humana. La mayoría de la morfología es correcta. |
| **Fluido** | 0.85–1.00 | Aproximándose a traducción humana competente. Los errores son raros y menores. |

Estos niveles son provisionales. Se recalibrarán a medida que se acumulen datos de validación humana y aprendamos dónde cae realmente el umbral "un hablante encuentra esto útil" para cada idioma. Ningún método puede reclamar **Implementable** o superior sin revisión comunitaria confirmando que los hablantes bilingües acuerdan que la salida es usable.

### 5.1 Umbrales de Nivel (Legible por Máquina)

Para implementaciones de código, los umbrales son (evaluados de arriba hacia abajo, primera coincidencia gana):

```
composite >= 0.85  →  "fluent"
composite >= 0.70  →  "deployable"
composite >= 0.50  →  "functional"
composite >= 0.30  →  "emerging"
composite >= 0.00  →  "baseline"
composite is null  →  "unscored"
```

---

## 6. Métricas de Costo

Las métricas de costo miden la eficiencia financiera de un método de traducción. Se reportan por separado de la calidad — el costo no influye en la puntuación compuesta (excepto en la clasificación secundaria ajustada por costo).

### 6.1 Métricas de Token

| ID | Métrica | Cálculo |
|----|--------|-------------|
| `prompt_tokens` | Tokens de entrada total | Suma de `usage.prompt_tokens` en todas las llamadas API |
| `completion_tokens` | Tokens de salida total | Suma de `usage.completion_tokens` |
| `reasoning_tokens` | Tokens de cadena de pensamiento | Suma de `usage.completion_tokens_details.reasoning_tokens` (0 para la mayoría de modelos) |
| `cached_tokens` | Tokens en caché del proveedor | Suma de `usage.prompt_tokens_details.cached_tokens` |
| `total_tokens` | Tokens totales consumidos | `prompt_tokens + completion_tokens` |
| `tokens_per_entry` | Promedio de tokens por traducción | ✅ `total_tokens / entry_count` |

### 6.2 Métricas de Costo

| ID | Métrica | Cálculo | Caso de Uso |
|----|--------|-------------|----------|
| `total_cost_usd` | Costo total de ejecución | Precios reportados por proveedor × conteos de token | "¿Cuánto costó este benchmark?" |
| `cost_per_entry_usd` | Costo por entrada de corpus | `total_cost_usd / entry_count` | Comparar métodos en el mismo corpus |
| `cost_per_1k_tokens` | Costo por 1.000 tokens | ✅ `total_cost_usd / total_tokens × 1000` | Eficiencia universal de LLM — comparable entre corpus |
| `cost_per_source_char` | Costo por carácter de origen | `total_cost_usd / total_source_chars` | Comparable entre idiomas con tokenización diferente |

> **¿Por qué múltiples métricas de costo?** Una "entrada" varía en longitud — una frase de 3 palabras cuesta menos que un párrafo. `cost_per_entry_usd` es útil para comparar métodos en el *mismo* corpus (mismas entradas = mismas longitudes = comparación justa). `cost_per_1k_tokens` es la métrica de eficiencia estándar de LLM, comparable *entre* corpus. `cost_per_source_char` normaliza por diferencias de tokenización — la misma oración puede tokenizarse en diferentes números de tokens dependiendo del vocabulario del modelo.

### 6.3 Puntuación Ajustada por Costo

Para métodos que utilizan API pagadas, calculamos una clasificación secundaria:

```
cost_adjusted = composite / log2(1 + cost_per_entry_usd × 1000)
```

Esto recompensa métodos que logran buenas puntuaciones eficientemente. Usa `cost_per_entry_usd` (no por token) porque la puntuación ajustada por costo siempre se calcula dentro de un único benchmark (mismo corpus), haciendo la comparación por entrada justa.

La puntuación ajustada por costo es una **clasificación secundaria** — la tabla de clasificación principal clasifica por puntuación compuesta. Responde una pregunta diferente: "dado un presupuesto, ¿qué método da los mejores resultados?"

---

## 7. Métricas de Velocidad

Las métricas de velocidad miden la latencia y el rendimiento de un método de traducción. Como el costo, la velocidad no influye en la puntuación compuesta.

| ID | Métrica | Cálculo | Nivel |
|----|--------|-------------|-------|
| `elapsed_seconds` | Duración de ejecución de reloj de pared | `time_end - time_start` | Ejecución |
| `avg_latency_seconds` | Latencia media por entrada | `Σ latency_s / n_entries` | Corpus |
| `median_latency_seconds` | Latencia mediana por entrada | Percentil 50 de `latency_s` | Corpus |
| `p95_latency_seconds` | Latencia percentil 95 | Percentil 95 de `latency_s` | Corpus |
| `tokens_per_second` | Rendimiento | `total_tokens / elapsed_seconds` | Ejecución |
| `entries_per_minute` | Tasa de traducción | `entry_count / (elapsed_seconds / 60)` | Ejecución |

---

## 8. Confianza y Significancia

### 8.1 Intervalos de Confianza Bootstrap

Todas las métricas clave soportan intervalos de confianza bootstrap (método de percentil, n=1000 remuestreos, α=0.05):

| Métrica | IC Reportado |
|--------|------------|
| `chrf_plus_plus` | ✅ `chrf_ci_lower`, `chrf_ci_upper` |
| `exact_match_rate` | ✅ `exact_match_ci_lower`, `exact_match_ci_upper` |
| `fst_acceptance_rate` | ✅ `fst_ci_lower`, `fst_ci_upper` (solo calculado cuando existen datos FST) |
| `comet_score` | ✅ `comet_ci_lower`, `comet_ci_upper` (remuestreado desde puntuaciones por entrada en caché — sin inferencia neuronal redundante) |
| `composite` | ✅ `composite_ci_lower`, `composite_ci_upper` (calculado cuando chrF++ y exact_match están disponibles) |
| IC por nivel | ✅ `confidence_intervals_by_tier` — IC de chrF++ y exact_match por nivel de dificultad (Nivel 1-5) |

### 8.2 Pruebas de Significancia Bootstrap Emparejadas

Para comparar dos métodos, el harness calcula pruebas de remuestreo bootstrap emparejadas:

```
H₀: The two methods perform equally on this corpus.
H₁: One method is significantly better.
```

Si el p-valor < 0.05 y el intervalo de confianza de la diferencia excluye cero, la diferencia es estadísticamente significativa al nivel del 95%.

---

## 9. Esquema de Puntuaciones de Tarjeta de Ejecución

Esta sección define la estructura jerárquica del bloque `scores` en una tarjeta de ejecución. Este esquema se deriva de las métricas definidas en §2–§7 y debe mantenerse sincronizado.

```jsonc
{
  "scores": {
    // §2.1 Surface metrics
    "exact_match_rate":       0.6613,       // 0.0–1.0
    "exact_matches":          41,           // count
    "equivalent_match_rate":  0.7258,       // ⚡ partial (CRK: eval_standards/crk CrkLinterMetric)
    "equivalent_matches":     45,           // ⚡ partial (CRK: eval_standards/crk CrkLinterMetric)
    "chrf_plus_plus":         80.65,        // 0–100 (sacrebleu native scale)
    "bleu":                   54.78,        // 0–100, NOT in composite
    "ter":                    42.3,         // ✅ implemented, 0–∞ (lower=better)
    "length_ratio":           1.03,         // ✅ implemented, ideal=1.0

    // §2.2 Structural metrics
    "fst_acceptance_rate":    1.0,          // 0.0–1.0
    "fst_accepted":           74,           // count
    "morphological_accuracy": 0.83,         // ✅ active: FST-derived, lemma-matched, verifier-re-derived (fst-coverage profile — §4.3)
    "morph_coverage":         0.41,         // fraction of analyzable predicted words lemma-matched to the reference
    "morph_in_composite":     true,         // true when active AND coverage ≥ MORPH_COVERAGE_FLOOR (0.25); else advisory
    "orthographic_accuracy":  null,         // 🔲 planned

    // §2.3 Semantic metrics
    "semantic_score":         0.6842,       // ⚡ partial (CRK: eval_standards/crk CrkSemanticMetric)
    "comet_score":            null,         // nullable; NEURAL — reported separately, not in any composite (§4.3)
    "comet_model":            "",           // model ID used for COMET

    // §2.4 Behavioral metrics
    "code_switching_rate":    0.03,         // ✅ implemented (lower=better)
    "hallucination_rate":     0.01,         // ✅ implemented (lower=better)
    "terminology_adherence":  null,         // ✅ implemented (null when no glossary)
    "consistency_score":      null,         // 🔲 planned

    // §4 Composite
    "composite":              0.8988,       // 0.0–1.0
    "quality_tier":           "fluent",     // §5 tier label
    "cost_adjusted":          null,         // §6.3 secondary ranking

    // §7 Speed metrics (merged into scores block)
    "tokens_per_second":      4462.5,       // ✅ total_tokens / elapsed
    "entries_per_minute":     82.30,        // ✅ entry_count / (elapsed/60)
    "avg_latency_seconds":    0.234,
    "median_latency_seconds": 0.190,
    "p95_latency_seconds":    0.415,

    // §8.1 Confidence intervals
    "confidence_intervals": {
      "chrf_plus_plus":     { "ci_lower": 78.2, "ci_upper": 83.1 },
      "exact_match_rate":   { "ci_lower": 0.54, "ci_upper": 0.78 },
      "corpus_comet":       { "ci_lower": 0.71, "ci_upper": 0.76 }
    },
    "confidence_intervals_by_tier": {
      "1": { "corpus_chrf": { "ci_lower": 68.1, "ci_upper": 76.5 } },
      "3": { "corpus_chrf": { "ci_lower": 36.2, "ci_upper": 47.0 } }
    },

    // Breakdowns
    "by_difficulty":          {},           // scores grouped by difficulty tier
    "by_provenance":          {},           // scores grouped by entry provenance

    // Counts
    "total":                  62,
    "evaluated":              62,
    "errors":                 0
  },

  "totals": {
    // §6.1 Token metrics
    "prompt_tokens":          13985,
    "completion_tokens":      187822,
    "reasoning_tokens":       175726,
    "cached_tokens":          0,
    // §6.2 Cost metrics
    "total_cost_usd":         1.7114,
    "cost_per_entry_usd":     0.027603,
    "cost_per_source_char":   null          // 🔲 needs source char counting
  }
}
```

> **Historial de esquema.** Los borradores de especificación anteriores propusieron bloques `cost`, `speed` y `tokens` separados. Estos se fusionaron en `scores` y `totals` respectivamente por simplicidad. Las métricas de velocidad (`tokens_per_second`, `entries_per_minute`, latencias) viven en `scores`; los conteos de token y cifras de costo viven en `totals`.

### 9.1 Asignación Esquema–Base de Datos

El JSON de tarjeta de ejecución se almacena en su totalidad como una columna `jsonb` en Supabase. Las métricas clave también se desnormalizan en columnas de nivel superior para rendimiento de ordenamiento/filtrado:

| Campo de Tarjeta de Ejecución | Columna Supabase | Tipo | Índice |
|---------------|----------------|------|-------|
| `scores.composite` | `composite_score` | `real` | `idx_composite` |
| `scores.quality_tier` | `quality_tier` | `text` | — |
| `scores.chrf_plus_plus` | `chrf_plus_plus` | `real` | `idx_leaderboard` |
| `scores.exact_match_rate` | `exact_match_rate` | `real` | — |
| `scores.fst_acceptance_rate` | `fst_acceptance_rate` | `real` | — |
| `scores.bleu` | `corpus_bleu` | `real` | — |
| `scores.comet_score` | `comet_score` | `real` | — |
| `totals.total_cost_usd` | `total_cost_usd` | `real` | — |
| `totals.cost_per_entry_usd` | `cost_per_entry_usd` | `real` | — |
| `totals.cost_per_source_char` | `cost_per_source_char` | `real` | — |
| `scores.avg_latency_seconds` | `avg_latency_seconds` | `real` | — |
| `model_slug` | `model_slug` | `text` | `idx_model` |
| `condition` | `condition` | `text` | — |
| `dataset.id` | `dataset_id` | `text` | `idx_leaderboard` |
| `dataset.language_pair` | `language_pair` | `text` | — |
| `fingerprint.hash` | `fingerprint_hash` | `text` | `idx_fingerprint` |
| `scores.equivalent_match_rate` | `equivalent_match_rate` | `real` | — |
| `scores.semantic_score` | `semantic_score` | `real` | — |
| `scores.ter` | `ter` | `real` | — |
| `scores.length_ratio` | `length_ratio` | `real` | — |
| `scores.code_switching_rate` | `code_switching_rate` | `real` | — |
| `scores.hallucination_rate` | `hallucination_rate` | `real` | — |
| `scores.terminology_adherence` | `terminology_adherence` | `real` | — |
| `scores.tokens_per_second` | `tokens_per_second` | `real` | — |
| `scores.entries_per_minute` | `entries_per_minute` | `real` | — |
| `elapsed_seconds` | `elapsed_seconds` | `real` | — |
| *(tarjeta completa)* | `run_card` | `jsonb` | — |

Cuando se implementan nuevas métricas, la columna correspondiente debe agregarse a través de una migración numerada en `arena/migrations/`.

---

## 10. Sincronización Código–Especificación

### 10.1 Fuente Canónica

Este documento (`cli/website/docs/network/specifications/scoring.md`) es la fuente canónica para:
- Definiciones de métricas (§2)
- Tablas de peso compuesto (§4.3)
- Umbrales de nivel de calidad (§5.1)
- Fórmulas de métrica de costo (§6.2)
- Esquema de puntuaciones de tarjeta de ejecución (§9)

### 10.2 Espejo de Código

El archivo `arena/mt_eval_harness/scoring.py` refleja las tablas de peso y umbrales de nivel de este documento. Es la **implementación de código** de §4.3 y §5.1. Cuando este documento se actualiza:

1. Actualice `scoring.py` para que coincida
2. Ejecute `pytest tests/test_scoring_ssot.py` para validar alineación
3. Actualice documentos de FAQ y sitio web que resumen los pesos

### 10.3 Documentos Que Hacen Referencia a Esta Especificación

| Documento | Qué Referencia | Cómo Mantener Sincronizado |
|----------|-------------------|---------------------|
| `cli/website/docs/network/specifications/benchmark-spec.md` §4–§5 | Fórmula compuesta, tablas de peso, umbrales de nivel | Referencia cruzada este documento; no duplique tablas |
| `website/docs/getting-started/faq.md` | Resumen de peso simplificado | Debe coincidir con §4.3; enlace de vuelta a este documento |
| `cli/website/docs/network/how-it-works.md` | Umbral implementable | Debe coincidir con §5 |
| `publish.py` a través de `scoring.py` | Dicts de peso + función de nivel | Prueba automatizada valida coincidencia |

---

## Apéndice A: Métricas NO en Compuesto (y Por Qué)

| Métrica | Por Qué Excluida |
|--------|-------------|
| **BLEU** | La puntuación a nivel de palabra penaliza la variación morfológica en idiomas polisintéticos. Una diferencia inflexional menor (significado correcto, sufijo ligeramente diferente) cuenta como un fallo completo. chrF++ maneja esto mejor a nivel de carácter. |
| **COMET** | Entrenado en datos de WMT (pares europeos de alto recurso). Para LRL (p. ej. Cree) el modelo extrapola y no está calibrado. COMET/AfriCOMET se **calculan y reportan en un carril neural separado — nunca en ningún compuesto** (el compuesto es determinista; §4.3) — y se re-derivan por el verificador. |
| **TER** | La distancia de edición se correlaciona con chrF++ para la mayoría de casos de uso. Incluir ambos contaría doble la similitud de superficie. TER se reporta como referencia. |
| **Relación de Longitud** | Un diagnóstico, no una señal de calidad. Una relación de 1.02 y una relación de 0.98 son ambas bien. Solo valores extremos indican problemas. |
| **Puntuación de Consistencia** | Solo a nivel de corpus — sin valor por entrada para agregar. Además, cierta inconsistencia es legítima (misma palabra en inglés → diferentes traducciones al idioma de destino dependiendo del contexto). |
| **Índice de Cumplimiento** | Puerta de calidad, no señal de calidad. Mide preservación estructural (marcadores de posición, comillas), no precisión de traducción. |

## Apéndice B: LYSS — Implementaciones de Métricas Específicas del Idioma

El marco **LYSS** (Linguistically-informed Yield & Structural Scoring) proporciona métricas específicas del idioma que van más allá de la comparación de cadenas de nivel de superficie. LYSS tiene tres componentes principales:

- **LYSS-fst** — Validez morfológica (`fst_acceptance_rate`): ¿Es cada palabra una forma válida en el idioma de destino?
- **LYSS-eq** — Equivalencia lingüística (`equivalent_match_rate`): ¿Es la salida una variante aceptable de la referencia?
- **LYSS-sem** — Validación semántica (`semantic_score`): ¿Preserva la salida el significado de origen?

> **Estado de validación: 🔶 Heurística de ingeniería.** Las métricas LYSS NO han sido validadas contra juicios de calidad humana. Se diseñan a partir de principios lingüísticos (FST, diccionarios, reglas gramaticales construidas por lingüistas en UAlberta ALTLab), pero la correlación entre puntuaciones LYSS y la calidad real de traducción no ha sido medida. Ver el [Protocolo de Validación de Hablantes](/docs/network/specifications/speaker-validation) para los experimentos de validación requeridos.

| Idioma | Plugin | Ubicación | Componente LYSS | Clave de Métrica | Notas |
|----------|--------|----------|----------------|------------|-------|
| CRK (Plains Cree) | `CrkLinterMetric` | `eval_standards/crk/metrics.py` | **LYSS-eq** | `equivalent_match_rate` | Reglas de clase de variante determinista: orden de palabras, ortográfico, partícula opcional, sinónimo de lema, ambigüedad progresiva, inclusivo/exclusivo. Produce `lint_verdict` por entrada (EXACT/EQUIVALENT/MISS/NO_OUTPUT). |
| CRK | `CrkSemanticMetric` | `eval_standards/crk/metrics.py` | **LYSS-sem** | `semantic_score` | Determinista: extracción de lema FST + glosarios de diccionario + superposición de palabra de contenido spaCy. Produce veredictos (EXACT_MATCH/VALID/GRAMMAR_ISSUES/PARTIAL/INCOMPLETE/WRONG/NO_OUTPUT). |
| Idiomas GiellaLT | `GiellaLTFSTMetric` | `plugins/giellalt_fst.py` | **LYSS-fst** | `fst_acceptance_rate` | Genérico: funciona para CRK, SME, SMA, SMJ, SMN, SMS, FIN, NOB, IKU — cualquier idioma con un analizador `.hfstol`. La métrica es genérica, pero **los corpus de evaluación existen solo para Plains Cree (crk)** hoy, por lo que crk es el único idioma puntuado por FST en la práctica (ver [Limitaciones Honestas](/docs/network/honest-limitations)). |

> **Nota de arquitectura (junio de 2026).** Las métricas LYSS específicas del idioma ahora se declaran en la tarjeta de idioma bajo `evalMetrics` y se cargan desde `eval_standards/<lang>/` por `plugin_discovery.py`. Son **estándares de evaluación** (árbitro), no métricas de plugin de método (concursante). Esto significa que cualquier método de traducción dirigido a CRK se puntúa automáticamente por LYSS — sin configuración específica del método necesaria. `CrkFSTMetric` fue removido; su funcionalidad está completamente cubierta por el `GiellaLTFSTMetric` genérico.

## Apéndice C: Métricas Bajo Consideración

Estas son ideas siendo evaluadas pero aún no especificadas lo suficiente para §2:

| Idea | Qué Mediría | Bloqueadores |
|------|----------------------|----------|
| Fluidez (perplejidad LM) | ¿Es la salida prosa bien formada en el idioma de destino? | Requiere un LM de idioma de destino. No existen buenos modelos para la mayoría de LRL. |
| Coincidencia de registro | ¿Coincide la traducción con el nivel de formalidad esperado? | Requiere clasificadores sociolingüísticos. Problema de investigación. |
| Apropiación cultural | ¿Se manejan correctamente las referencias culturales? | No puede ser automatizado — inherentemente requiere revisión humana. |
| Coherencia del discurso | ¿Forman las traducciones consecutivas un pasaje coherente? | Requiere evaluación a nivel de documento, no a nivel de oración. |

---

## Referencias

Artículos académicos, herramientas y recursos lingüísticos citados en toda esta especificación.

### Métricas de Superficie

1. Popović, M. (2017). "chrF++: words helping character n-grams." *Proceedings of the Second Conference on Machine Translation (WMT 2017)*, pp. 612–618. Copenhagen, Denmark.

2. Papineni, K., Roukos, S., Ward, T., & Zhu, W.-J. (2002). "BLEU: a method for automatic evaluation of machine translation." *Proceedings of the 40th Annual Meeting of the Association for Computational Linguistics (ACL 2002)*, pp. 311–318. Philadelphia, PA.

3. Post, M. (2018). "A Call for Clarity in Reporting BLEU Scores." *Proceedings of the Third Conference on Machine Translation (WMT 2018)*, pp. 186–191. Belgium, Brussels. Reference implementation: [sacrebleu](https://github.com/mjpost/sacrebleu).

4. Snover, M., Dorr, B., Schwartz, R., Micciulla, L., & Makhoul, J. (2006). "A Study of Translation Edit Rate with Targeted Human Annotation." *Proceedings of the 7th Conference of the Association for Machine Translation in the Americas (AMTA 2006)*, pp. 223–231. Cambridge, MA.

### Métricas Neuronales

5. Rei, R., Stewart, C., Farinha, A. C., & Lavie, A. (2020). "COMET: A Neural Framework for MT Evaluation." *Proceedings of the 2020 Conference on Empirical Methods in Natural Language Processing (EMNLP 2020)*, pp. 2685–2702. Online.

6. Juraska, J., Finkelstein, M., Deutsch, D., Siddhant, A., Mirzazadeh, M., & Freitag, M. (2023). "MetricX-23: The Google Submission to the WMT 2023 Metrics Shared Task." *Proceedings of the Eighth Conference on Machine Translation (WMT 2023)*, Singapore. (ACL Anthology 2023.wmt-1.63)

7. Zhang, T., Kishore, V., Wu, F., Weinberger, K. Q., & Artzi, Y. (2020). "BERTScore: Evaluating Text Generation with BERT." *Proceedings of the Eighth International Conference on Learning Representations (ICLR 2020)*. Addis Ababa, Ethiopia.

8. Sellam, T., Das, D., & Parikh, A. (2020). "BLEURT: Learning Robust Metrics for Text Generation." *Proceedings of the 58th Annual Meeting of the Association for Computational Linguistics (ACL 2020)*, pp. 7881–7892. Online.

### Herramientas Morfológicas y Lingüísticas

9. Lindén, K., Silfverberg, M., Axelson, E., Hardwick, S., & Pirinen, T. (2011). "HFST—Framework for Compiling and Applying Morphologies." *Systems and Frameworks for Computational Morphology (SFCM 2011)*, Communications in Computer and Information Science, vol. 100, pp. 67–85. Springer, Berlin, Heidelberg.

10. Sánchez-Cartagena, V. M., & Toral, A. (2024). "MorphEval: Automatic Evaluation of Morphological Capabilities of Machine Translation Systems." *Machine Translation*, vol. 38, pp. 1–28.

### Clasificación de Errores y Evaluación Diagnóstica

11. Popović, M. (2011). "Hjerson: An Open Source Tool for Automatic Error Classification of Machine Translation Output." *The Prague Bulletin of Mathematical Linguistics*, no. 96, pp. 59–68.

12. Dreyer, M. & Marcu, D. (2012). "HyTER: Meaning-Equivalent Semantics for Translation Evaluation." *Proceedings of the 2012 Conference of the North American Chapter of the Association for Computational Linguistics: Human Language Technologies (NAACL 2012)*, pp. 162–171. Montréal, Canada.

13. Reiter, E. & Belz, A. (2009). "An Investigation into the Validity of Some Metrics for Automatically Evaluating Natural Language Generation Systems." *Computational Linguistics*, vol. 35, no. 4, pp. 529–558. (Related work on feature-based evaluation metrics, including FUSE.)

### Detección de Alucinación

14. Raunak, V., Menezes, A., & Junczys-Dowmunt, M. (2021). "The Curious Case of Hallucinations in Neural Machine Translation." *Proceedings of the 2021 Conference of the North American Chapter of the Association for Computational Linguistics: Human Language Technologies (NAACL 2021)*, pp. 1172–1183. Online.

15. Guerreiro, N. M., Voita, E., & Martins, A. F. T. (2023). "Looking for a Needle in a Haystack: A Comprehensive Study of Hallucinations in Neural Machine Translation." *Proceedings of the 17th Conference of the European Chapter of the Association for Computational Linguistics (EACL 2023)*, pp. 1059–1075. Dubrovnik, Croatia.

### Recursos del Idioma Cree

16. Wolfart, H. C. (1973). "Plains Cree: A Grammatical Study." *Transactions of the American Philosophical Society*, vol. 63, no. 5, pp. 1–90.

17. Wolvengrey, A. (2001). *nêhiyawêwin: itwêwina / Cree: Words.* Canadian Plains Research Center, University of Regina.

### Gobernanza de Datos

18. Global Indigenous Data Alliance. "CARE Principles for Indigenous Data Governance." [https://www.gida-global.org/care](https://www.gida-global.org/care).

19. Carroll, S. R., Garba, I., Figueroa-Rodríguez, O. L., Holbrook, J., Lovett, R., Materechera, S., Parsons, M., Raseroka, K., Rodriguez-Lonebear, D., Rowe, R., Sara, R., Walker, J. D., Anderson, J., & Hudson, M. (2020). "The CARE Principles for Indigenous Data Governance." *Data Science Journal*, vol. 19, no. 1, p. 43.
