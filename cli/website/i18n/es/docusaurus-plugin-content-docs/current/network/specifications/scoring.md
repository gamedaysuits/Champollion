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

> **Resumen ejecutivo.** Esta es la única fuente de verdad sobre cómo se califican las ejecuciones en el ecosistema de evaluación de TA de Champollion: la métrica principal, las demás métricas estándar reportadas junto a ella, los diagnósticos reportados por separado, y el costo y la velocidad. Las ejecuciones se califican de la forma en que lo hace el campo: **chrF++ a nivel de corpus con su firma sacreBLEU y un intervalo de confianza bootstrap del 95%**, BLEU, spBLEU, TER y COMET junto a él, y pruebas de significancia pareadas para decidir si un sistema es mejor que otro. Los diagnósticos específicos de cada idioma (validez morfológica por FST, clases de equivalencia de linter, validación semántica determinista) se denominan colectivamente **LYSS** (Linguistically-informed Yield & Structural Scoring). El compuesto ponderado y las etiquetas de niveles de calidad utilizadas anteriormente están **retirados** (§4, §5); sus tablas permanecen aquí únicamente para que las tarjetas antiguas aún puedan verificarse. El código, la documentación y los esquemas de bases de datos se derivan de este documento. En caso de conflicto, este documento es la autoridad definitiva.
>
> **Alcance.** Este documento define *qué* medimos y *cómo lo calificamos*. No define el esquema de la tarjeta de ejecución (consulte BENCHMARK_SPEC §3), el protocolo de benchmark (BENCHMARK_SPEC §6) ni las reglas de la tabla de clasificación (consulte la documentación de arena). Dichos documentos hacen referencia a este para las definiciones de métricas y la lógica de puntuación.


---

## Cómo se califican las ejecuciones {#how-runs-are-scored}

Cada nueva ejecución se califica bajo el **estándar de puntuación `standard/1`**. La tarjeta de ejecución así lo indica: `scores.scoring_standard` es `"standard/1"` y `scores.primary_metric` es `"chrf_plus_plus"`.

| Rol | Qué | Dónde aparece |
|------|------|------------------|
| **Métrica principal y de clasificación** | **chrF++** a nivel de corpus (sacreBLEU chrF con `word_order=2`), 0–100, con su intervalo de confianza bootstrap del 95% y su firma sacreBLEU | Escrito como `chrF++ 47.5 [45.9, 49.0]`, seguido de la firma. Tarjeta de ejecución: `scores.chrf_plus_plus`, el IC en `scores.confidence_intervals.corpus_chrf`, la firma en `scores.sacrebleu_signatures.chrf`. Base de datos: `chrf_plus_plus`, `chrf_ci_lower`, `chrf_ci_upper`. |
| **Otras métricas estándar** | BLEU, spBLEU (SentencePiece de FLORES-200), TER y COMET cuando fue calculado | Mostradas junto a chrF++, cada una con su firma o id de modelo de COMET. Nunca se combinan con chrF++ ni entre sí. |
| **Diagnósticos** | Coincidencia exacta, aceptación por FST, precisión morfológica, alternancia de código, alucinación, adherencia terminológica, estilo de redacción y cada advertencia de puntuación (§2.8) | Reportados por separado y etiquetados como diagnósticos. Nunca forman parte de una cifra principal y nunca clasifican una ejecución. Las advertencias se mantienen destacadas junto a la métrica principal. |
| **Costo y velocidad** | Tokens, dólares, latencia (§6, §7) | Reportados junto a la puntuación, nunca combinados con ella. |

**Decidir qué es "mejor".** Dos ejecuciones en el mismo conjunto de evaluación se comparan mediante una prueba de significancia pareada sobre chrF++ (aleatorización aproximada por defecto, remuestreo bootstrap pareado como opción; §8.2). Las otras métricas estándar también se evalúan y se muestran. Una diferencia que no sea significativa se reporta como no significativa, independientemente de cuáles sean los dos números.

**Sin etiquetas de calidad.** Una puntuación automática no es un veredicto de calidad. Las tarjetas nuevas no llevan ningún nivel ni etiqueta como "funcional" o "desplegable"; únicamente la evaluación humana realizada por hablantes certifica la calidad ([BENCHMARK_SPEC §7](/docs/network/specifications/benchmark#7-human-validation)).

**Qué se retira.** Las tarjetas nuevas publican `composite: null`, `quality_tier: null` y `cost_adjusted: null` (la puntuación ajustada por costo era el compuesto dividido por un factor de costo; el costo en sí se sigue reportando). Ninguna salida nueva imprime un compuesto o un nivel. Las tarjetas publicadas antes del estándar conservan su compuesto almacenado y siguen siendo verificables: el verificador vuelve a calcular una tarjeta sin `scoring_standard` mediante el cálculo heredado (§4), y una tarjeta `standard/1` recalculando chrF++. En cualquier lugar donde todavía se muestre el compuesto de una tarjeta antigua, se etiqueta como **compuesto heredado (retirado)**.

**Por qué este es el estándar.** Es la forma en que el campo reporta la evaluación de TA:

- **WMT** clasifica los sistemas de sus tareas compartidas mediante evaluación humana y reporta métricas automáticas junto a ella con firmas sacreBLEU para que los números puedan reproducirse (Post 2018; Kocmi et al. 2024).
- **FLORES-200** (NLLB Team 2022) reporta chrF++ y spBLEU para 200 idiomas, la mayoría de ellos de bajos recursos.
- Las tareas compartidas de **AmericasNLP** sobre traducción a lenguas indígenas de las Américas clasifican los sistemas mediante chrF (Mager et al. 2021; Ebrahimi et al. 2023), porque los n-gramas de caracteres gestionan la morfología rica mejor que BLEU a nivel de palabra (Popović 2015, 2017).
- Kocmi et al. (2021), al comparar métricas automáticas con miles de juicios humanos, descubrieron que la magnitud de la diferencia de una métrica y si esta es estadísticamente significativa son lo que predice la preferencia humana, razón por la cual las comparaciones aquí son pruebas de significancia pareadas (Koehn 2004; Riezler & Maxwell 2005), no dos números colocados lado a lado.

**Concursos.** El clasificador de un concurso es únicamente chrF++, en una escala de 0–100, y el `primary_metric` de un concurso toma por defecto `chrf_plus_plus`. Un nuevo concurso que solicite `composite` como métrica es rechazado con una explicación; los concursos creados antes del estándar siguen funcionando. Un organizador aún puede establecer filtros diagnósticos en los términos del premio (por ejemplo, una aceptación mínima por FST), como filtros que una entrega debe superar, nunca como la puntuación ([Especificación de premios](/docs/network/specifications/prizes)).

**Cambiar el estándar.** La métrica principal cambia únicamente con una nueva versión del estándar (`standard/2`). Cada tarjeta indica el estándar bajo el cual fue calificada y se verifica según dicho estándar.

---

## 1. Filosofía de Puntuación

### 1.1 Filosofía de Microeval

> *"Si solo nos enfocamos en lo que se generaliza, inevitablemente olvidaremos dónde no lo hace — y perderemos estos idiomas y todo su conocimiento y sabiduría."*

Este proyecto practica **desarrollo de microeval**: construir métricas de evaluación adaptadas a idiomas específicos utilizando las mejores herramientas lingüísticas disponibles — transductores de estado finito, diccionarios bilingües, analizadores morfológicos, reglas de equivalencia curadas por lingüistas. Esto es lo opuesto al paradigma dominante en evaluación de MT, que busca métricas universales que funcionen en todos los idiomas. Las métricas universales son valiosas, pero son más débiles precisamente donde más se necesitan: para idiomas con morfología compleja, datos de entrenamiento limitados y sin representación en conjuntos de entrenamiento de métricas neuronales.

No estamos haciendo progreso en traducción automática para muchos idiomas del mundo no solo porque nos falten corpus, sino porque **ni siquiera sabemos qué aspecto tiene el progreso** — nos faltan las herramientas de evaluación automatizadas para medir si un sistema de traducción está mejorando. LYSS es nuestro intento de construir esas herramientas, idioma por idioma, utilizando los recursos lingüísticos que existan.

### 1.2 Las Métricas Automatizadas Son Aproximaciones

Todas las métricas definidas aquí son calculadas automáticamente por máquina. Son útiles para la iteración rápida, la comparación sistemática y la detección de regresiones. **No sustituyen el juicio humano**, razón por la cual ninguna puntuación automática lleva una etiqueta de calidad: únicamente la revisión humana puede confirmar la usabilidad real.

### 1.3 Una cifra principal, múltiples señales

Ninguna métrica por sí sola captura la calidad de una traducción. Una traducción puede tener una alta superposición de chrF++ pero fallar en la validación morfológica. Puede superar las comprobaciones por FST pero transmitir el significado incorrecto. Puede ser semánticamente precisa pero estilísticamente ajena a la lengua de llegada. Por lo tanto, cada ejecución reporta múltiples señales; sin embargo, solo una de ellas, chrF++, es la métrica principal y de clasificación, y las demás se muestran a su lado, sin combinarse nunca con ella. Una combinación de señales que significan cosas distintas para diferentes idiomas puede ser manipulada por un sistema que rinda bien en las señales fáciles de obtener (§4 registra cómo era el compuesto retirado), y un lector no puede saber a partir de un número combinado qué señal varió.

### 1.4 Extensibilidad

Este inventario de métricas no es cerrado. Nuevos idiomas conllevan nuevos requisitos: precisión tonal para lenguas tonales, precisión diacrítica para alfabetos semíticos, corrección de silabarios para el cree. La arquitectura (protocolo MetricPlugin) permite agregar diagnósticos sin modificar ninguna puntuación principal. Las métricas específicas de un idioma (p. ej., el linter y el validador semántico de CRK) se declaran en las tarjetas de idioma bajo `evalMetrics` y se cargan desde `eval_standards/`; el arnés se distribuye únicamente con métricas de comportamiento genéricas (alternancia de código, alucinación, terminología).

### 1.5 Tres Dimensiones de Evaluación

Cada tarjeta de ejecución mide tres dimensiones independientes:

```
Quality   — How close is the translation to the reference?   (chrF++ headline + standard metrics + diagnostics)
Cost      — How much does it cost?                           (cost metrics, §6)
Speed     — How fast does it run?                            (speed metrics, §7)
```

Estos son ejes independientes. Un método puede obtener una buena puntuación pero ser costoso, ser rápido pero impreciso, o cualquier combinación de estas. La tabla de clasificación permite ordenar por cualquier dimensión. Ninguna cifra publicada las combina (la puntuación ajustada por costo que lo hacía, §6.3, está retirada).

### 1.6 Estado de Validación

Cada métrica en esta especificación tiene un **estado de validación** distinto de su estado de implementación (§3). El estado de implementación rastrea si existe código. El estado de validación rastrea si se ha demostrado que la métrica se correlaciona con juicios de calidad humana.

| Nivel de Validación | Significado | Métricas Actuales |
|------------------|---------|----------------|
| **✅ Validado externamente** | Existen estudios de correlación humana publicados (WMT, artículos académicos) | `chrf_plus_plus`, `bleu`, `comet_score` *(solo pares de alto recurso)* |
| **⚡ Validado por proxy** | Validado para idiomas de alto recurso; no validado para nuestros LRL de destino | `comet_score` *(para LRL: validado en pares de alto recurso/UE, extrapolado a p. ej. CRK — directamente útil pero sin calibrar)* |

| **🔶 Heurística de ingeniería** | Diseñada a partir de principios lingüísticos o modos de falla observados; sin datos de correlación humana | `fst_acceptance_rate`, `morphological_accuracy` (derivado de FST, coincidencia por lema, recalculado por el verificador), `equivalent_match_rate`, `semantic_score`, `code_switching_rate`, `hallucination_rate`, `terminology_adherence` |
| **🔲 No validada** | Aún no probada en ningún dato | `orthographic_accuracy`, `consistency_score` |

> **Por qué `comet_score` aparece en dos filas.** Esta es una división por nivel de recursos, no una contradicción. COMET está *validado externamente* donde existen estudios de correlación humana de WMT: pares de altos recursos, en su mayoría europeos. Para nuestros idiomas de bajos recursos objetivo no existen tales estudios, por lo que la misma métrica está únicamente *validada por aproximación*: el modelo extrapola a partir de idiomas con sistemas morfológicos distintos. Se muestra junto a chrF++ con su id de modelo y una advertencia de calibración, sin combinarse nunca.

> **Qué significa esto en la práctica.** La métrica principal (chrF++) es una métrica validada externamente, utilizada de la forma en que lo hace el campo. Cada heurística de ingeniería anterior es un **diagnóstico**: puede explicar *por qué* una ejecución obtuvo esa puntuación (las palabras no son formas válidas, la salida cambió al inglés), pero nunca es una puntuación y nunca clasifica una ejecución. El compuesto retirado (§4) incluía heurísticas en todos los niveles de validación dentro de la métrica principal, y un sistema podía obtener la mayor parte de ella sin traducir (§4).
>
> **Experimentos de validación requeridos** (consulte `mt-evaluation-landscape.md` §6 y `speaker-validation.md`):
> 1. Estudio de correlación con juicios humanos: más de 200 pares de oraciones evaluados por 3 o más hablantes bilingües
> 2. Medición de la tasa de rechazo falso por FST en un corpus representativo
> 3. Adaptación a un segundo idioma (sami septentrional) para evaluar la generalización
> 4. Comparación directa con COMET sobre los mismos datos


---

## 2. Inventario de Métricas {#2-metric-inventory}

Las métricas se organizan en seis categorías (superficiales, estructurales, semánticas, de comportamiento, de conformidad y comparadores reportados). Cada métrica tiene un estado de implementación, escala y nivel (por entrada, a nivel de corpus o ambos), y una de tres funciones bajo el estándar: **principal** (únicamente chrF++), **estándar** (BLEU, spBLEU, TER, COMET; mostradas junto a la principal) o **diagnóstico** (todas las demás; reportadas por separado).

### 2.1 Métricas de Superficie

Las métricas de superficie comparan la traducción predicha con la traducción de referencia a nivel de cadena. No requieren herramientas lingüísticas — solo comparación de cadenas.

| ID | Métrica | Estado | Escala | Nivel | Implementación |
|----|--------|--------|-------|-------|---------------|
| `exact_match_rate` | Coincidencia exacta | ✅ Implementada | 0.0–1.0 | Ambos | **Diagnóstico.** Binario: ¿predicho == referencia? Tasa de corpus = coincidencias / total. |
| `equivalent_match_rate` | Coincidencia equivalente | ⚡ Parcial | 0.0–1.0 | Ambos | **Diagnóstico.** ¿Coincide la salida predicha con alguna variante aceptada? Para CRK: implementado mediante `CrkLinterMetric` del estándar de evaluación de CRK (en `eval_standards/crk/`) utilizando reglas deterministas de clases de variantes (orden de palabras, ortográfica, partícula opcional, sinónimo de lema, ambigüedad progresiva). Cargado automáticamente a través de la declaración `evalMetrics` de la tarjeta de idioma de CRK. La implementación genérica entre idiomas requiere `variants[]` por entrada en el corpus. |
| `chrf_plus_plus` | chrF++ | ✅ Implementada | 0–100 | Ambos | **Métrica principal y de clasificación.** F-score de n-gramas de caracteres con unigramas y bigramas de palabras (sacreBLEU chrF, `word_order=2`; Popović 2017). Robusto a la variación morfológica. El valor publicado es a nivel de corpus (`corpus_chrf`), con un IC bootstrap del 95% y su firma sacreBLEU; los valores por entrada (`sentence_chrf`) alimentan las pruebas de significancia. |
| `bleu` | BLEU | ✅ Implementada | 0–100 | Corpus | **Métrica estándar, mostrada junto a chrF++** (tarjeta de ejecución y base de datos `corpus_bleu`, con su firma sacreBLEU). Precisión de n-gramas a nivel de palabra (Papineni et al. 2002). No es la principal porque la coincidencia a nivel de palabra cuenta una palabra correcta con un sufijo diferente como un fallo total, lo que penaliza a los idiomas morfológicamente ricos. |
| `ter` | Tasa de edición de traducción (TER) | ✅ Implementada | 0–∞ (menor es mejor) | Ambos | **Métrica estándar, mostrada junto a chrF++** (`scores.ter`, con su firma sacreBLEU). Distancia de edición mínima entre la predicción y la referencia, normalizada por la longitud de la referencia (sacreBLEU `corpus_ter`; Snover et al. 2006). |
| `length_ratio` | Relación de longitud | ✅ Implementada | 0–∞ (1.0 es ideal) | Ambos | **Diagnóstico.** `len(predicted) / len(reference)` en caracteres. Detecta truncamiento (<0.5) e inflación/alucinación (>2.0). Promediado entre entradas a nivel de corpus. |

### 2.2 Métricas Estructurales

Las métricas estructurales validan la buena formación lingüística de la traducción. Requieren herramientas específicas del idioma (analizadores FST, analizadores morfológicos) y son las señales más fuertes para idiomas morfológicamente ricos.

| ID | Métrica | Estado | Escala | Nivel | Implementación |
|----|--------|--------|-------|-------|---------------|
| `fst_acceptance_rate` | Aceptación por FST | ✅ Implementada | 0.0–1.0 | Ambos | **Diagnóstico.** Aceptación de palabras de la salida por un transductor de estados finitos (GiellaLT). Una palabra es "válida" si el FST devuelve al menos un análisis morfológico. **Agregación:** el valor de corpus publicado es la **media de las tasas por entrada**: las palabras aceptadas de cada entrada ÷ sus palabras, promediado sobre las entradas analizadas por el FST, donde una salida vacía cuenta como 0 (`avg_fst_validity` del plugin). La tasa combinada de palabras (todas las palabras aceptadas ÷ todas las palabras, `corpus_validity_rate`) se reporta a su lado en el informe de ejecución y en la tarjeta de ejecución, pero no es el valor publicado; ambas difieren cuando las entradas difieren en longitud. Disponible para cualquier idioma con un analizador GiellaLT `.hfstol`. **Mayúsculas/minúsculas:** una palabra se busca tal como está escrita; si el FST la rechaza y comienza con mayúscula, se busca nuevamente con su primera letra en minúscula (`Mun` → `mun`), y una palabra en MAYÚSCULAS como Tipo Título y luego en minúsculas (`OSLO` → `Oslo`, `GIITU` → `giitu`). Nunca a la inversa: un nombre propio escrito en minúsculas (`oslo`) sigue rechazado. Los aceptadores de corrección ortográfica de GiellaLT (sami septentrional, amárico, euskera) y el analizador estricto de cree de las llanuras de ALTLab listan la mayoría de las palabras solo en minúsculas y dejan la gestión de mayúsculas al programa envolvente, por lo que sin esto una mayúscula inicial correcta de oración contaba como palabra inválida. Esta es la versión de cómputo `case-fallback/1`, nombrada en el informe (`fst_acceptance_method`, con `total_case_folded_words` y el `fst_case_folded_words` de cada entrada) y en la tarjeta de ejecución (`fst_provenance.acceptance_method`). Un informe que carezca de ella se calificó distinguiendo mayúsculas y minúsculas y muestra un puntaje menor en texto capitalizado; `mt-eval compare` lo indica cuando compara ambos, y `mt-eval test <run log>` vuelve a calificar una ejecución antigua. El verificador recalcula los números derivados de FST de una tarjeta publicada con el método que dicha tarjeta indique, y en una tarjeta sin él lo hace distinguiendo mayúsculas/minúsculas, de modo que cada tarjeta se verifica contra el cálculo con el que fue publicada. |
| `morphological_accuracy` | Precisión morfológica | ✅ Implementada (recalculada por el verificador) | 0.0–1.0 | Ambos | **Diagnóstico.** Una palabra puede ser válida para el FST pero tener una flexión incorrecta (raíz correcta, sufijo incorrecto). **Calculado** por `plugins/giellalt_fst.py`: para cada palabra predicha analizable, busca una palabra de referencia que comparta su **lema** (raíz) y verifica si la **flexión** predicha (etiquetas de características del FST) coincide. La coincidencia por lema —no por posición— evita el alineamiento de palabras: una elección de palabra diferente o un par desalineado simplemente no está *cubierto* (nunca se califica erróneamente). **No se necesitan anotaciones gold**: el análisis FST de la referencia *es* la verdad fundamental. Las palabras que el FST no puede analizar, o cuya raíz no está en la referencia, quedan fuera de cobertura; se divulga `morph_coverage` (la fracción coincidente por lema), y por debajo de `MORPH_COVERAGE_FLOOR` (0.25) el valor se marca como orientativo. Es **indulgente ante la ambigüedad del FST** (una palabra predicha con varios análisis es "correcta" si *alguno* coincide → un límite superior, divulgado). Requiere un **analizador**: un FST que es solo un **aceptador** de corrección ortográfica (los paquetes de corrección de Divvun instalados para sami septentrional, amárico y euskera) indica si una palabra existe pero no proporciona lema ni etiquetas. Para esos casos, `morphological_accuracy` y `morph_coverage` son nulos y `metric_availability` indica el motivo; la aceptación por FST se sigue reportando. El anclaje de FST declara esto (`kind: "acceptor"`), y la métrica también detecta un transductor que nunca devuelve una etiqueta. El verificador la **recalcula** frente al corpus canónico (`verifier.recompute_corpus_morph`, que vuelve a ejecutar el FST anclado en la tarjeta; falla de forma cerrada si el FST no está presente, el mismo contrato que COMET). Bajo el compuesto retirado tenía un peso de 0.15 en el perfil fst-coverage (§4.3). |
| `orthographic_accuracy` | Precisión ortográfica | 🔲 Planificada | 0.0–1.0 | Ambos | **Diagnóstico (planificado).** Valida la corrección específica de la escritura: uso de macrón/circunflejo en SRO para cree, marcas diacríticas para inuktitut, marcadores de longitud vocálica para ojibwe. Conjuntos de reglas por idioma. |

> **Qué aportan las métricas estructurales y por qué son diagnósticos.** OMT-1600 de Meta —el sistema de TA más grande jamás publicado (1600 idiomas; Meta AI, *Omnilingual MT*, arXiv:2603.16309, 2026)— evalúa con ChrF++, xCOMET, MetricX y BLASER 3. Ninguno de estos valida la corrección morfológica: chrF++ mide la superposición de n-gramas de caracteres y premia cadenas que *se parecen* a la referencia, por lo que una palabra morfológicamente inválida que comparte muchos caracteres con la referencia sigue recibiendo crédito. La aceptación por FST responde a una pregunta distinta: ¿es cada palabra una forma válida en el idioma? Eso la convierte en un diagnóstico útil para lenguas polisintéticas. No es una puntuación de traducción: nunca examina la fuente ni la referencia, por lo que un sistema que imprima una sola oración válida para cada entrada la aprueba por completo (§4 muestra el caso medido). chrF++ también tiene un **piso por azar no nulo** que varía según la ortografía —el texto aleatorio en el mismo sistema de escritura puntúa apreciablemente por encima de cero, más en unos sistemas de escritura que en otros—, por lo que chrF++ en bruto no es comparable entre idiomas; solo clasifica sistemas en el mismo conjunto de evaluación. Por lo tanto, el mapa de red **no** clasifica en absoluto la solidez entre idiomas: un arco significa que el par ha sido medido, nada más. La corrección de piso por azar que construimos para esto (cchrF++) es una investigación publicada y no está conectada a ninguna interfaz pública; [Solidez de conexión](/docs/network/specifications/connection-strength) explica qué establece y qué no.

### 2.3 Métricas Semánticas

Las métricas semánticas miden la preservación del significado utilizando incrustaciones o modelos aprendidos. Capturan traducciones que son superficialmente diferentes pero semánticamente equivalentes, e indican traducciones que son superficialmente similares pero semánticamente incorrectas.

| ID | Métrica | Estado | Escala | Nivel | Implementación |
|----|--------|--------|-------|-------|---------------|
| `semantic_score` | Similitud semántica | ⚡ Parcial | 0.0–1.0 | Ambos | **Diagnóstico.** CRK: puntuación ponderada por veredicto a partir de `CrkSemanticMetric` del estándar de evaluación de CRK (en `eval_standards/crk/`, aproximación). Universal: similitud del coseno de incrustaciones de oraciones (fuente + predicho vs. fuente + referencia). Modelo por definir: debe admitir idiomas de bajos recursos, lo que descarta la mayoría de los modelos de incrustaciones centrados en el inglés. |
| `comet_score` | COMET | ✅ Implementada | ~0.0–1.0 | Ambos | **Métrica estándar cuando se calcula, mostrada junto a chrF++ con su id de modelo** (`comet_model`). Métrica aprendida de evaluación de TA (Rei et al. 2020). Nunca se combina con chrF++. Recalculada por el verificador, por lo que un valor reportado debe reproducirse. Marcada con una advertencia de calibración de bajos recursos para idiomas como el cree de las llanuras. Se calcula cuando `unbabel-comet` está instalado. Para 35 idiomas africanos, el arnés selecciona automáticamente AfriCOMET (`masakhane/africomet-mtl`) mediante `resolve_comet_model()`, el cual presenta una mejor correlación con juicios humanos para esos idiomas. |

> **Por qué COMET se ubica junto a la métrica principal y no como métrica principal.** COMET está entrenado con datos de evaluación humana de WMT, en su inmensa mayoría pares europeos de altos recursos. Para pares genuinamente de altos recursos (alemán, francés, …), el valor predeterminado `Unbabel/wmt22-comet-da` está bien validado por WMT, y `resolve_comet_model()` lo selecciona. Aplicado al cree de las llanuras o a otras lenguas de bajos recursos, el modelo extrapola a partir de idiomas con sistemas morfológicos distintos: resulta útil de forma orientativa pero no está calibrado, y la tarjeta así lo indica. Además, requiere un modelo de 2.3 GB, por lo que no se calcula para cada ejecución. chrF++ es reproducible únicamente a partir del corpus para cada idioma, razón por la cual es la métrica principal y COMET se reporta junto a él siempre que haya sido calculado.

> **AfriCOMET para idiomas africanos.** Cada tarjeta de idioma tiene un campo `metricModelSupport` (ver especificación de tarjeta de idioma §9) que declara qué modelos COMET especializados se entrenan para ese idioma. Para 35 idiomas africanos (yor, hau, ibo, amh, swa, etc.), la tarjeta declara AfriCOMET (`masakhane/africomet-mtl`) — un modelo COMET ajustado en juicios de MT de idiomas africanos por la comunidad Masakhane. El harness selecciona automáticamente el modelo recomendado a través de `resolve_comet_model()` leyendo desde tarjetas de idioma, pero esto puede anularse con `--comet-model`. Agregar nuevas asignaciones de idioma→modelo se realiza enriqueciendo la tarjeta de idioma (no editando código Python).

### 2.4 Métricas de Comportamiento

Las métricas de comportamiento detectan modos de falla específicos en la salida de traducción. No miden la calidad directamente: detectan problemas. Todas ellas son **diagnósticos**.

| ID | Métrica | Estado | Escala | Nivel | Implementación |
|----|--------|--------|-------|-------|---------------|
| `code_switching_rate` | Tasa de alternancia de código | ✅ Implementada | 0.0–1.0 (menor es mejor) | Ambos | Proporción de palabras de la salida que están en el idioma de origen (típicamente inglés). Se detecta mediante análisis de escritura Unicode y/o una lista de palabras del idioma de origen. Modo de falla muy común de los LLM: el modelo inserta palabras en inglés cuando desconoce el equivalente en el idioma de destino. |
| `hallucination_rate` | Tasa de alucinación | ✅ Implementada | 0.0–1.0 (menor es mejor) | Ambos | Proporción del contenido de salida que no tiene contenido correspondiente en el origen. Se detecta mediante alineación de palabras o superposición de incrustaciones multilingües. Detecta cuando el modelo genera traducciones de sonido verosímil pero inventadas. |
| `terminology_adherence` | Adherencia terminológica | ✅ Implementada | 0.0–1.0 | Ambos | Para métodos orientados (coached): proporción de términos terminológicos prescritos que aparecen en la salida. Requiere un glosario (`{"source term": "translation"}`, o una lista de traducciones aceptadas por término). La fuente es `--glossary <file.json>`, una entrada de evaluación que nunca se envía al modelo y se proporciona a cada ejecución comparada. De lo contrario, es el objeto `dictionary` de un JSON `--coaching-file`: la ejecución se califica entonces frente a su propia orientación, y la salida de la ejecución así lo indica. Sin ninguno de los dos, la métrica permanece inactiva (null). Mide si el modelo respeta el vocabulario proporcionado por expertos. |
| `consistency_score` | Consistencia entre entradas | 🔲 Planificada | 0.0–1.0 | Solo corpus | ¿Traduce el modelo el mismo término de origen de la misma manera a lo largo de las entradas? Una baja consistencia sugiere que el modelo está adivinando en lugar de aplicar patrones aprendidos. Requiere términos repetidos a lo largo de las entradas del corpus. |

### 2.5 Métricas de Cumplimiento

Las métricas de conformidad validan que las traducciones preserven la integridad estructural: marcadores de posición, formato y convenciones tipográficas. Son comprobaciones de control de calidad, no puntuaciones de calidad, y funcionan como diagnósticos bajo el estándar.

| ID | Métrica | Estado | Escala | Nivel | Implementación |
|----|--------|--------|-------|-------|---------------|
| `compliance_index` | Conformidad de doble pasada | 🔲 Planificada | 0.0–1.0 | Ambos | Compuesto ponderado: 60% de integridad de variables (¿se conservan las variables `{placeholder}`?) + 20% de conformidad de comillas (los caracteres de comillas del idioma de destino) + 20% de conformidad de mayúsculas y minúsculas (sin filtración de letras latinas para idiomas sin distinción de mayúsculas). Se calcula tanto en la salida sin procesar como en la posprocesada. Existe una clase `DoublePassCompliancePlugin`, pero ninguna ejecución de evaluación la carga, y aún no existe una fuente citada para las convenciones de comillas y mayúsculas/minúsculas por idioma. Las tarjetas de idioma no las incluyen. Sin esa fuente, solo el término de integridad de variables mide algo. |
| `repair_effectiveness` | Efectividad de reparación | 🔲 Planificada | 0.0–1.0 | Corpus | Proporción de violaciones de conformidad que fueron reparadas automáticamente mediante hooks de postraducción. Mide cuánto mejoró el control de calidad la salida sin procesar. Planificada por la misma razón que `compliance_index`. |

> **Por qué la conformidad es un filtro y no una puntuación.** Las métricas de conformidad miden la preservación estructural (marcadores de posición, comillas), no la calidad de la traducción. Una traducción puede ser lingüísticamente perfecta pero no superar la conformidad debido a que omitió una variable `{name}`. Están diseñadas como filtros de calidad, para evitar que se envíe una salida defectuosa, no para clasificar la calidad de la traducción.

### 2.6 Comparadores reportados

spBLEU es una de las métricas estándar que se muestran junto a chrF++; chrF simple y el comparador de estilo FUSE se reportan para comparación con otras tablas publicadas. Ninguno de ellos se combina con nada:

| ID | Métrica | Estado | Notas |
|----|--------|--------|-------|
| `spbleu` | spBLEU (tokenizador FLORES-200) | ✅ Implementada | **Métrica estándar, mostrada junto a chrF++** (`scores.spbleu`, con su firma sacreBLEU). BLEU sobre la tokenización SentencePiece de FLORES-200 (Goyal et al. 2022); comparable entre sistemas de escritura y segmentaciones (la lengua franca de NLLB/FLORES). Requiere `sentencepiece` (dependencia principal). |
| `chrf_plain` | chrF simple (`word_order=0`) | ✅ Implementada | La cifra de chrF que reportan AmericasNLP y muchas tablas de WMT, junto a nuestra métrica principal chrF++ (`word_order=2`). Su firma es `sacrebleu_signatures.chrf_plain`. |
| `fuse_score` | Comparador de estilo FUSE | ⚡ Opcional (`--fuse`) | Una **reimplementación NO ENTRENADA** del enfoque FUSE de AmericasNLP-2025 (Raja & Vats): semántica con LaBSE + F1 léxico de tokens + Soundex fonético + difflib difuso, combinados como una *media no ponderada* (no disponemos de datos de entrenamiento con juicios humanos para ajustar el Ridge/GBM original, y así lo indicamos). LaBSE/Soundex son el extra opcional `fuse`; sin LaBSE, `compute_fuse` devuelve `None` (divulgado) en lugar de simular una puntuación. Cada componente ejecutado se enumera en `fuse_components`; el resultado se marca con `fuse_untrained=true`. Exclusivamente un comparador de diagnóstico. |

### 2.7 Espacios de Nombres de Métricas {#2-7-metric-namespaces}

Una sola métrica lleva hasta cuatro nombres coordinados en la pila: el
**id canónico** (la clave `scores` en una tarjeta de ejecución, p. ej. `equivalent_match_rate`),
el **nombre del plugin** Python que la calcula (p. ej. `crk_linter`), la **clave `evalMetrics`** de la tarjeta de idioma
que la declara (p. ej. `lyss-eq`), y la **columna `run_cards`** desnormalizada
en la tabla de clasificación (p. ej. `equivalent_match_rate`). Estos son deliberadamente distintos — el nombre del plugin indica la
*herramienta*, el id de métrica indica la *medición* — pero deben mantenerse sincronizados.

La única fuente de verdad para esa asignación es `shared/metric-registry.json`, cargado
por `mt_eval_harness.metric_manifest`. Cada entrada registra los cuatro nombres más `scale`,
`direction` (mayor/menor/neutral), `level` (entrada/corpus/ambos), `in_composite`
(si formaba parte del compuesto retirado; conservado para verificar tarjetas antiguas) y
`verifier_reproducible`. Una prueba de paridad falla si las tablas de `scoring.py` o las
claves `scores` de la tarjeta de ejecución acuñadas por `publish.py` discrepan del registro, de modo que una nueva
métrica no pueda lanzarse a medio conectar.

Dos campos de tarjeta de ejecución relacionados hacen explícita la procedencia de la métrica:

- **`scores.metric_availability`** — un bloque `{metric: reason}` que desambigua una
  puntuación de `null`: `not_applicable` (el idioma/ejecución no lo utiliza), `unavailable`
  (faltaba una dependencia opcional), `below_coverage_floor` (presente pero demasiado
  escaso para ser más que orientativo), `not_run` (opcional y no solicitado) o
  `not_implemented` (planificado). Una métrica ausente del bloque se calculó normalmente.
- **`fst_version`** / **`fst_provenance`** — el lanzamiento del transductor GiellaLT instalado
  y la versión de `pyhfst` detrás de cualquier métrica derivada de FST, capturados de la misma manera
  que las firmas de sacreBLEU para que una puntuación estructural pueda rastrearse hasta una compilación
  exacta del analizador. `fst_provenance.acceptance_method` indica cómo se calculó
  la aceptación a partir de las respuestas del transductor (`case-fallback/1`, §1); una tarjeta que carezca
  de esto se calificó distinguiendo mayúsculas y minúsculas.
- **`scores.sacrebleu_signatures`** — la firma sacreBLEU de cada
  métrica de sacreBLEU que la ejecución calculó: `chrf` (la cifra principal chrF++,
  `word_order=2`), `chrf_plain`, `bleu`, `spbleu`, `ter`. Dos números de chrF++ son
  comparables únicamente cuando sus firmas coinciden (Post 2018).

### 2.8 Advertencias de puntuación {#2-8-score-caveats}

Una puntuación puede haberse calculado correctamente y aun así no reflejar lo que indica su etiqueta. El
arnés examina cada ejecución en busca de las formas conocidas en que esto ocurre y, cuando alguna se activa,
la imprime junto a la métrica principal en el resumen de prueba, `mt-eval compare`, la
vista previa de publicación y el panel de control, y la tarjeta publicada la incluye como
`score_caveats` para que la tabla de clasificación también la muestre. Una advertencia nunca altera una puntuación;
indica qué la limita. Cada una es un diagnóstico con un `severity` (`major` o
`minor`) y un mensaje de una sola oración que especifica recuentos, nunca las salidas
en sí mismas.

| Advertencia | Se activa cuando |
|--------|-----------|
| `source_copy` | Al menos la mitad de las salidas evaluadas son iguales a su fuente (ignorando mayúsculas, acentos y puntuación). Se omite una entrada cuya referencia sea idéntica a la fuente (un nombre, un número). |
| `length_deflation` | Las salidas promedian menos de 0.5× la longitud de la referencia, o una cuarta parte o más de ellas lo hacen: se omitieron palabras. La aceptación por FST y la alternancia de código juzgan únicamente las palabras presentes, por lo que descartar palabras eleva sus valores. |
| `length_inflation` | Las salidas promedian más de 2× la longitud de la referencia, o una cuarta parte o más de ellas lo hacen (por ejemplo, ejemplos de pocas muestras filtrándose en cada salida). |
| `near_constant_output` | Se genera una misma salida para muchas entradas distintas: las repeticiones cubren al menos una cuarta parte de las fuentes distintas, y al menos 5 de ellas. Una salida cuenta como repetición cuando 3 fuentes la obtuvieron (una salida de tres o más palabras) o 5 (una salida de una o dos palabras, ya que respuestas cortas como "Sí." se repiten legítimamente); una salida idéntica a su propia referencia es una respuesta correcta, no una repetición. Antes de elegir estos límites, la regla se probó sobre 2161 salidas de sistemas reales y referencias de las tareas de métricas de WMT 2019–2025; las cinco que marca son todas salidas defectuosas. |
| `train_test_near_twin` | Escrita por nmt-forge: cada fila de prueba (o casi cada una) tiene una contraparte casi idéntica en los datos de entrenamiento, por lo que la puntuación mide la recuperación de frases de entrenamiento, no la traducción. |

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

## 4. Retirado: el Compuesto (heredado) {#4-composite-score}

> [!CAUTION]
> **Ninguna nueva ejecución se califica con el compuesto.** Fue retirado por el estándar de puntuación `standard/1` ([Cómo se califican las ejecuciones](#how-runs-are-scored)). Las tarjetas nuevas publican `composite: null`. Esta sección se conserva **únicamente** para que las tarjetas publicadas antes del estándar puedan seguir leyéndose y verificándose: el verificador recalcula el compuesto almacenado de cualquier tarjeta que no incluya `scores.scoring_standard`, con exactamente la fórmula y las tablas que se indican a continuación. En cualquier lugar donde todavía se muestre el compuesto de una tarjeta antigua, se etiqueta como **compuesto heredado (retirado)**, y nunca se compara con chrF++ ni con una tarjeta nueva.

### Por qué se retiró {#why-the-composite-was-retired}

El compuesto era una combinación ponderada de chrF++/100, coincidencia exacta, aceptación por FST (peso 0.25), precisión morfológica, la puntuación semántica, alternancia de código, alucinación y terminología, con pesos establecidos según el criterio de ingeniería y nunca ajustados a juicios humanos. Debido a que varias de sus entradas nunca comparan la salida con la fuente ni con la referencia, un sistema podía obtener la mayor parte de su valor sin traducir:

- **Una oración para cada entrada.** Un modelo no entrenado de inglés→sami septentrional que repetía una misma oración válida en sami septentrional para cada entrada obtuvo un compuesto de **0.6244** —etiquetado como "funcional"— con un **chrF++ de 5.5**. Las palabras repetidas son sami válido, por lo que la aceptación por FST fue del 100%, y para un idioma cuyo FST es un aceptador de corrección ortográfica, la aceptación por FST representaba cerca del 45% del compuesto una vez que las métricas ausentes se redistribuían mediante reponderación.
- **Omitir lo que no puede traducir.** Un glosario de juguete que descarta cada palabra que desconoce obtuvo **0.6612**, porque la aceptación por FST y la alternancia de código juzgan únicamente las palabras que contiene una salida.
- **Copiar la fuente.** El inglés copiado tal cual sin cambios como salida en "sami septentrional" aun así obtuvo crédito de FST, dado que un corrector ortográfico acepta palabras capitalizadas y algunas palabras en inglés.

Ninguna evaluación estándar clasificaría estos sistemas por encima de una traducción real, y chrF++ no lo hace: compara cada salida con su referencia. Las advertencias del arnés (§2.8) también detectan estos patrones y se mantienen visibles junto a la métrica principal chrF++.

### 4.1 Fórmula (heredada)

La puntuación compuesta era un promedio ponderado de todas las métricas *disponibles*, renormalizado para que los pesos de las métricas disponibles sumaran 1.0:

```
composite = Σ (weight_i × value_i)    for all available metrics
             ─────────────────────
             Σ weight_i               (re-normalization denominator)
```

Una métrica está "disponible" si su valor en la tarjeta de ejecución es un número (no `null`). Cuando una métrica no estaba disponible —porque el idioma carece de FST, o porque una métrica aún no está implementada—, su peso se redistribuía proporcionalmente entre las métricas restantes. Los compuestos calculados a partir de diferentes conjuntos de métricas nunca fueron comparables; cada tarjeta heredada registra su `scores.scoring_profile` y `scores.metric_availability` (§2.7), para que el verificador sepa qué conjunto utilizar.

### 4.2 Normalización de entrada (heredada)

Antes de ingresar en la fórmula compuesta, cada métrica se ajustaba a una **escala de 0.0–1.0** donde 1.0 = perfecto:

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

### 4.3 Tablas de pesos (heredadas) {#43-weight-tables}

Cada idioma correspondía a un **perfil con nombre** mediante `language_cards.resolve_scoring_profile()` (`fst-coverage` cuando un FST calificaba la ejecución; de lo contrario, `surface-only`, a menos que la tarjeta de idioma declarara `scoringProfile.basis`); el perfil se refleja en `PROFILE_REGISTRY` de `scoring.py` y se registra en cada tarjeta heredada como `scores.scoring_profile`. `orthographic_accuracy` se enumera en `scoring.INACTIVE_METRICS` y nunca se calculó, por lo que su peso siempre se redistribuyó. `morphological_accuracy` entraba únicamente cuando `morph_coverage ≥ 0.25`. Las métricas neuronales (`comet_score`, `qe_score`; `scoring.NEURAL_METRICS`) nunca formaron parte de ningún compuesto.

#### `fst-coverage` (Perfil A): Idiomas CON Cobertura FST

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

> **Total: 1.00.** Al estar `morphological_accuracy` ausente (sin analizador FST, un FST solo aceptador o cobertura inferior a 0.25), las 8 métricas restantes (total 0.85) se escalaban cada una por 1/0.85 ≈ 1.176. Para un idioma con FST solo aceptador (sami septentrional, amárico, euskera) sin estándar de evaluación ni glosario, solo quedaban la aceptación por FST de 0.25, chrF++ de 0.15, alternancia de código, alucinación y coincidencia exacta (0.05 cada una) —total 0.55—, por lo que la aceptación por FST representaba **0.25/0.55 ≈ 45%** del compuesto. Esa es la ponderación que aprovecharon los ejemplos anteriores.

#### `surface-only` (Perfil B): Idiomas SIN Cobertura FST

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

> **Total: 1.00.** `orthographic_accuracy` nunca se calculó, por lo que las 7 métricas restantes (total 0.95) se escalaban por 1/0.95 ≈ 1.053.

#### `no-reference`: ejecuciones sin referencia de oro

| Métrica | Peso Objetivo | Justificación |
|--------|--------------|-----------|
| `fst_acceptance_rate` | **0.40** | La validez morfológica no necesita referencia; la señal determinista más fuerte cuando existe un FST. |
| `code_switching_rate` | **0.25** | Fuga de idioma de origen (invertida). |
| `hallucination_rate` | **0.20** | Contenido fabricado (invertido). |
| `terminology_adherence` | **0.15** | Cumplimiento de vocabulario entrenado. |

> **Total: 1.00.** Para ejecuciones cuyo corpus no contenía referencias gold. Cuando dicha ejecución no tenía FST, el compuesto se renormalizaba únicamente sobre las comprobaciones de comportamiento.

### 4.4 Agregar una nueva métrica

Una nueva métrica se agrega como un **diagnóstico**; nunca altera la métrica principal:

1. **Defínala** en el §2 con el estado `🔲 Planned`, incluyendo escala, nivel, dirección y método de cómputo.
2. **Impleméntela** como un MetricPlugin (o en `tester.py` para métricas principales).
3. **Regístrela** en `shared/metric-registry.json` y agregue un marcador de posición nulo en el bloque de puntuaciones de la tarjeta de ejecución.
4. **Actualice BENCHMARK_SPEC.md** §3 si cambia el esquema de la tarjeta de ejecución.
5. **Ejecute un benchmark de validación** para confirmar que la métrica produzca valores razonables en datos reales.
6. **Actualice este documento** para cambiar el estado de `🔲` a `✅`.

Modificar la métrica principal o de clasificación no es "agregar una métrica": requiere una nueva versión del estándar de puntuación ([Cómo se califican las ejecuciones](#how-runs-are-scored)).

---

## 5. Retirado: Niveles de calidad (heredado) {#5-quality-tiers}

> [!CAUTION]
> **Ninguna tarjeta nueva lleva un nivel de calidad.** Las tarjetas nuevas publican `quality_tier: null`, y ninguna salida nueva imprime un nivel o una etiqueta como "funcional" o "desplegable". Una puntuación automática no es un veredicto de calidad: el mismo número significa cosas distintas para diferentes idiomas y conjuntos de evaluación, y los niveles retirados etiquetaban como "funcional" a un sistema que repetía una misma oración para cada entrada (§4). Únicamente la evaluación humana realizada por hablantes certifica la calidad ([BENCHMARK_SPEC §7](/docs/network/specifications/benchmark#7-human-validation)).

Los niveles eran etiquetas deducidas a partir del compuesto heredado. Las tarjetas heredadas todavía los almacenan; se conservan aquí únicamente para que se pueda leer una tarjeta antigua y no constituyen afirmaciones de calidad.

| Nivel heredado | Rango de compuesto heredado |
|------|----------------|
| Línea base | 0.00–0.30 |
| Emergente | 0.30–0.50 |
| Funcional | 0.50–0.70 |
| Desplegable | 0.70–0.85 |
| Fluido | 0.85–1.00 |

### 5.1 Umbrales de niveles (legibles por máquina, heredado)

Los umbrales heredados (evaluados de arriba hacia abajo, la primera coincidencia gana):

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

Las métricas de costo miden la eficiencia financiera de un método de traducción. Se reportan junto a la puntuación y nunca se combinan con ella.

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

### 6.3 Puntuación ajustada por costo (retirada)

Las tarjetas heredadas incluyen una puntuación ajustada por costo, calculada a partir del compuesto retirado:

```
cost_adjusted = composite / log2(1 + cost_per_entry_usd × 1000)
```

Queda retirada junto con el compuesto: las tarjetas nuevas publican `cost_adjusted: null`. Para ponderar el costo frente a la calidad, consulte chrF++ (con su IC) y `cost_per_entry_usd` lado a lado; la tabla de clasificación puede ordenar por cualquiera de los dos.

---

## 7. Métricas de Velocidad

Las métricas de velocidad miden la latencia y el rendimiento de un método de traducción. Al igual que el costo, la velocidad se reporta junto a la puntuación y nunca se combina con ella.

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

Los intervalos de confianza son intervalos bootstrap de percentiles sobre los segmentos del conjunto de evaluación (n=1000 remuestreos, α=0.05; Koehn 2004). El intervalo de chrF++ forma parte de la cifra principal: `chrF++ 47.5 [45.9, 49.0]`. Con un conjunto de evaluación pequeño el intervalo es amplio, y el arnés advierte cuando un subconjunto es demasiado pequeño para obtener un intervalo significativo.

| Métrica | IC reportado |
|--------|------------|
| `chrf_plus_plus` (cifra principal) | ✅ tarjeta de ejecución `confidence_intervals.corpus_chrf`; base de datos `chrf_ci_lower`, `chrf_ci_upper` |
| `exact_match_rate` | ✅ `exact_match_ci_lower`, `exact_match_ci_upper` |
| `fst_acceptance_rate` | ✅ `fst_ci_lower`, `fst_ci_upper` (solo se calcula cuando existen datos de FST) |
| `comet_score` | ✅ `comet_ci_lower`, `comet_ci_upper` (obtenido mediante bootstrap a partir de puntuaciones cacheadas por entrada; sin inferencia neuronal redundante) |
| `composite` | Solo tarjetas heredadas (`composite_ci_lower`, `composite_ci_upper`); no se calcula para nuevas ejecuciones |
| IC por nivel | ✅ `confidence_intervals_by_tier` — IC de chrF++ y exact_match por nivel de dificultad (Nivel 1-5) |

### 8.2 Pruebas de significancia pareadas {#82-paired-significance-tests}

Si una ejecución es mejor que otra se decide mediante una prueba de significancia pareada sobre chrF++ en los segmentos traducidos por ambas ejecuciones, nunca comparando dos números. `mt-eval compare --significance` ejecuta:

- **Aleatorización aproximada** (la opción predeterminada; Riezler & Maxwell 2005, también la predeterminada de sacreBLEU): las salidas de los dos sistemas se intercambian segmento por segmento al azar, 1000 veces, para ver con qué frecuencia surge por azar una diferencia al menos igual de grande.
- **Remuestreo bootstrap pareado** (`--method paired_bootstrap`; Koehn 2004): los segmentos se remuestrean con reemplazo y la diferencia se vuelve a calcular en cada muestra. Es una estimación más conservadora, ofrecida para comparación con artículos anteriores.

```
H₀: The two methods perform equally on this evaluation set.
H₁: One method is better.
```

Cada diferencia se acompaña de su intervalo de confianza del 95% y se reporta como significativa cuando p < 0.05. BLEU, spBLEU, TER y los diagnósticos presentes en ambas ejecuciones también se evalúan y se muestran (los valores p son por métrica y no están corregidos para pruebas múltiples), pero el veredicto sobre cuál es "mejor" corresponde a la prueba de chrF++. Dos números de chrF++ son comparables únicamente cuando sus firmas sacreBLEU coinciden. Si uno de los informes comparados es heredado, compare indica que su compuesto está retirado y no lo compara. Método completo: [Pruebas de significancia estadística](/docs/network/specifications/significance).

---

## 9. Esquema de Puntuaciones de Tarjeta de Ejecución

Esta sección define la estructura jerárquica del bloque `scores` en una tarjeta de ejecución. Este esquema se deriva de las métricas definidas en §2–§7 y debe mantenerse sincronizado.

```jsonc
{
  "scores": {
    // The scoring standard
    "scoring_standard":       "standard/1", // absent on legacy cards → "legacy-composite"
    "primary_metric":         "chrf_plus_plus",

    // HEADLINE (§2.1): corpus chrF++, 0–100; CI in confidence_intervals.corpus_chrf,
    // signature in sacrebleu_signatures.chrf
    "chrf_plus_plus":         47.52,

    // Other standard metrics — shown beside chrF++, never blended
    // (BLEU rides at the card's top level as "corpus_bleu"; COMET below)
    "spbleu":                 24.01,        // FLORES-200 SentencePiece BLEU
    "ter":                    61.2,         // 0–∞ (lower=better)
    "chrf_plain":             44.10,        // plain chrF (word_order=0), for comparison with published tables
    "sacrebleu_signatures": {
      "chrf":   "nrefs:1|case:mixed|eff:yes|nc:6|nw:2|space:no|version:2.4.3",
      "bleu":   "nrefs:1|case:mixed|eff:no|tok:13a|smooth:exp|version:2.4.3"
      // also chrf_plain, spbleu, ter
    },

    // Diagnostics (§2) — reported separately, never in a headline
    "exact_match_rate":       0.1613,       // 0.0–1.0
    "exact_matches":          10,           // count
    "equivalent_match_rate":  null,         // ⚡ partial (CRK: eval_standards/crk CrkLinterMetric)
    "equivalent_matches":     null,
    "length_ratio":           1.03,         // ideal=1.0
    "fst_acceptance_rate":    0.92,         // 0.0–1.0
    "fst_accepted":           274,          // count
    "morphological_accuracy": 0.63,         // FST-derived, lemma-matched, verifier-re-derived
    "morph_coverage":         0.41,         // fraction of analyzable predicted words lemma-matched to the reference
    "morph_in_composite":     false,        // legacy key; always false on a standard/1 card
    "orthographic_accuracy":  null,         // 🔲 planned
    "semantic_score":         null,         // ⚡ partial (CRK: eval_standards/crk CrkSemanticMetric)
    "code_switching_rate":    0.03,         // lower=better
    "hallucination_rate":     0.01,         // lower=better
    "terminology_adherence":  null,         // null when no glossary
    "style_consistency_rate": null,         // writing style
    "consistency_score":      null,         // 🔲 planned

    // COMET — a standard metric when computed (model id beside it)
    "comet_score":            0.712,        // null when not computed
    "comet_model":            "Unbabel/wmt22-comet-da",

    // Retired (§4, §5, §6.3) — always null on a standard/1 card
    "composite":              null,
    "quality_tier":           null,
    "cost_adjusted":          null,

    // §7 Speed metrics (merged into scores block)
    "tokens_per_second":      4462.5,       // ✅ total_tokens / elapsed
    "entries_per_minute":     82.30,        // ✅ entry_count / (elapsed/60)
    "avg_latency_seconds":    0.234,
    "median_latency_seconds": 0.190,
    "p95_latency_seconds":    0.415,

    // §8.1 Confidence intervals
    "confidence_intervals": {
      "corpus_chrf":        { "ci_lower": 45.9, "ci_upper": 49.0 },   // the headline's CI
      "exact_match_rate":   { "ci_lower": 0.08, "ci_upper": 0.25 },
      "corpus_comet":       { "ci_lower": 0.69, "ci_upper": 0.73 }
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

Las advertencias de puntuación (§2.8) se ubican en el nivel superior de la tarjeta como `score_caveats`, una lista de objetos `{kind, source, severity, message, …}`; BLEU se ubica allí como `corpus_bleu`.

> **Historial de esquema.** Los borradores de especificación anteriores propusieron bloques `cost`, `speed` y `tokens` separados. Estos se fusionaron en `scores` y `totals` respectivamente por simplicidad. Las métricas de velocidad (`tokens_per_second`, `entries_per_minute`, latencias) viven en `scores`; los conteos de token y cifras de costo viven en `totals`.

### 9.1 Asignación Esquema–Base de Datos

El JSON de tarjeta de ejecución se almacena en su totalidad como una columna `jsonb` en Supabase. Las métricas clave también se desnormalizan en columnas de nivel superior para rendimiento de ordenamiento/filtrado:

| Campo de tarjeta de ejecución | Columna de Supabase | Tipo | Índice |
|---------------|----------------|------|-------|
| `scores.chrf_plus_plus` | `chrf_plus_plus` | `real` | `idx_leaderboard` |
| `scores.confidence_intervals.corpus_chrf` | `chrf_ci_lower`, `chrf_ci_upper` | `real` | — |
| `scores.composite` | `composite_score` | `real` | `idx_composite` — solo tarjetas heredadas; nulo para `standard/1` |
| `scores.quality_tier` | `quality_tier` | `text` | — solo tarjetas heredadas; nulo para `standard/1` |
| `scores.exact_match_rate` | `exact_match_rate` | `real` | — |
| `scores.fst_acceptance_rate` | `fst_acceptance_rate` | `real` | — |
| `corpus_bleu` | `corpus_bleu` | `real` | — |
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

Este documento es la fuente canónica para:
- El estándar de puntuación: la métrica principal, las métricas estándar junto a ella y los diagnósticos ([Cómo se califican las ejecuciones](#how-runs-are-scored))
- Definiciones de métricas (§2) y advertencias de puntuación (§2.8)
- Las tablas de pesos del compuesto heredado (§4.3) y los umbrales de niveles (§5.1), conservados para verificar tarjetas antiguas
- Fórmulas de métricas de costo (§6.2)
- Esquema de puntuaciones de la tarjeta de ejecución (§9)

### 10.2 Espejo de Código

El archivo `arena/mt_eval_harness/scoring.py` es la implementación en código de este documento: los roles de las métricas del estándar (`SCORING_STANDARD`, `PRIMARY_METRIC`, `SECONDARY_METRICS`, `DIAGNOSTIC_METRICS`) y, debajo de ellos, las tablas del compuesto heredado y los umbrales de nivel utilizados únicamente para verificar tarjetas antiguas. Ningún otro módulo los define; las pruebas del arnés fijan ambos. Cuando se actualice este documento, actualice `scoring.py` para que coincida y vuelva a ejecutar las pruebas del arnés.

### 10.3 Documentos Que Hacen Referencia a Esta Especificación

| Documento | A qué hace referencia | Cómo mantener la sincronización |
|----------|-------------------|---------------------|
| [Especificación de benchmark](/docs/network/specifications/benchmark) §4–§5 | La métrica principal, clasificación, compuesto heredado | Hacer referencia cruzada a este documento; no duplicar tablas |
| [Pruebas de significancia estadística](/docs/network/specifications/significance) | Cómo se decide qué es "mejor" | Debe coincidir con §8.2 |
| [Preguntas frecuentes](/docs/network/getting-started/faq) y [Cómo funciona](/docs/network/how-it-works) | Resumen en lenguaje sencillo del estándar | Enlazar de vuelta a este documento |
| `publish.py` a través de `scoring.py` | `standard_score_fields()` y el compuesto heredado | Las pruebas del arnés validan la coincidencia |

---

## Apéndice A: Por qué chrF++ es la métrica principal (y las demás no)

| Métrica | Rol | Por qué |
|--------|------|-----|
| **chrF++** | Métrica principal | Los n-gramas de caracteres otorgan crédito parcial a una palabra con la raíz correcta y un sufijo diferente, por lo que gestionan la morfología rica mejor que las métricas a nivel de palabra (Popović 2015, 2017). Es reproducible solo a partir del corpus para cualquier idioma y sistema de escritura, y es lo que reportan FLORES-200 y las tareas compartidas de AmericasNLP. |
| **BLEU** | Estándar, a su lado | La coincidencia a nivel de palabra cuenta una diferencia flexiva menor como un fallo total, lo que penaliza a los idiomas polisintéticos. Se reporta para comparación con la literatura sobre TA. |
| **spBLEU** | Estándar, a su lado | BLEU en una tokenización compartida de SentencePiece, comparable entre sistemas de escritura; reportado por FLORES-200. |
| **TER** | Estándar, a su lado | Distancia de edición; se correlaciona con chrF++ para la mayoría de los casos de uso. |
| **COMET** | Estándar, a su lado (cuando se calcula) | Entrenado con datos de WMT (pares europeos de altos recursos). Para lenguas de bajos recursos (p. ej., cree), el modelo extrapola y no está calibrado, además de requerir un modelo grande, por lo que no puede ser la cifra única presente en cada ejecución. Recalculado por el verificador. |
| **Relación de longitud** | Diagnóstico | Una relación de 1.02 y una relación de 0.98 son ambas aceptables. Solo los valores extremos indican problemas (§2.8). |
| **Aceptación por FST, precisión morfológica, LYSS** | Diagnóstico | Heurísticas de ingeniería sin datos de correlación humana; la aceptación por FST nunca examina el origen ni la referencia (§4). |
| **Puntuación de consistencia** | Diagnóstico (planificado) | Cierta inconsistencia es legítima (la misma palabra en inglés → diferentes traducciones en el idioma de destino según el contexto). |
| **Índice de conformidad** | Filtro (planificado) | Mide la preservación estructural (marcadores de posición, comillas), no la precisión de la traducción. |

## Apéndice B: LYSS — Implementaciones de Métricas Específicas del Idioma

El marco **LYSS** (Linguistically-informed Yield & Structural Scoring) proporciona métricas específicas del idioma que van más allá de la comparación de cadenas de nivel de superficie. LYSS tiene tres componentes principales:

- **LYSS-fst** — Validez morfológica (`fst_acceptance_rate`): ¿Es cada palabra una forma válida en el idioma de destino?
- **LYSS-eq** — Equivalencia lingüística (`equivalent_match_rate`): ¿Es la salida una variante aceptable de la referencia?
- **LYSS-sem** — Validación semántica (`semantic_score`): ¿Preserva la salida el significado de origen?

Los tres son **diagnósticos** bajo el estándar de puntuación: reportados junto a la métrica principal chrF++, nunca dentro de ella.

> **Estado de validación: 🔶 Heurística de ingeniería.** Las métricas LYSS NO han sido validadas contra juicios de calidad humana. Se diseñan a partir de principios lingüísticos (FST, diccionarios, reglas gramaticales construidas por lingüistas en UAlberta ALTLab), pero la correlación entre puntuaciones LYSS y la calidad real de traducción no ha sido medida. Ver el [Protocolo de Validación de Hablantes](/docs/network/specifications/speaker-validation) para los experimentos de validación requeridos.

| Idioma | Plugin | Ubicación | Componente LYSS | Clave de métrica | Notas |
|----------|--------|----------|----------------|------------|-------|
| CRK (cree de las llanuras) | `CrkLinterMetric` | `eval_standards/crk/metrics.py` | **LYSS-eq** | `equivalent_match_rate` | Reglas deterministas de clases de variantes: orden de palabras, ortográfica, partícula opcional, sinónimo de lema, ambigüedad progresiva, inclusivo/exclusivo. Produce `lint_verdict` por entrada (EXACT/EQUIVALENT/MISS/NO_OUTPUT). |
| CRK | `CrkSemanticMetric` | `eval_standards/crk/metrics.py` | **LYSS-sem** | `semantic_score` | Determinista: extracción de lemas por FST + glosas de diccionario + superposición de palabras de contenido con spaCy. Produce veredictos (EXACT_MATCH/VALID/GRAMMAR_ISSUES/PARTIAL/INCOMPLETE/WRONG/NO_OUTPUT). |
| Idiomas de GiellaLT | `GiellaLTFSTMetric` | `plugins/giellalt_fst.py` | **LYSS-fst** | `fst_acceptance_rate` | Genérico: cualquier idioma con un FST anclado en el arnés (`mt_eval_harness/data/fst-pins.json`). Un FST analizador también produce `morphological_accuracy`; un corrector ortográfico solo aceptador (los paquetes Divvun anclados para sami septentrional, amárico y euskera) reporta únicamente aceptación. Ser calificado por FST en la práctica también requiere un conjunto de evaluación para el par que permita clasificar: los dos conjuntos del cree de las llanuras (EdTeKLA) son etiquetas en cuarentena contra las cuales la base de datos rechaza una puntuación, mientras que varios otros idiomas con FST tienen conjuntos abiertos (Tatoeba, WMT, WMT24++). La [página de conjuntos de datos](/docs/network/leaderboard/datasets) enumera el catálogo, y `mt-eval corpora --source eng --target <code>` lista lo que se puede ejecutar para un par (consulte [Limitaciones honestas](/docs/network/honest-limitations)). |

> **Nota de arquitectura (junio de 2026).** Las métricas LYSS específicas de un idioma ahora se declaran en la tarjeta de idioma bajo `evalMetrics` y se cargan desde `eval_standards/<lang>/` mediante `plugin_discovery.py`. Son **estándares de evaluación** (árbitro), no métricas de plugins de método (competidor). Esto significa que cualquier método de traducción dirigido a CRK es verificado automáticamente por los diagnósticos LYSS, sin necesidad de configuración específica para el método. Se eliminó `CrkFSTMetric`; su funcionalidad está completamente cubierta por el genérico `GiellaLTFSTMetric`.

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

1. Popović, M. (2017). "chrF++: words helping character n-grams." *Proceedings of the Second Conference on Machine Translation (WMT 2017)*, pp. 612–618. Copenhague, Dinamarca.

1a. Popović, M. (2015). "chrF: character n-gram F-score for automatic MT evaluation." *Proceedings of the Tenth Workshop on Statistical Machine Translation (WMT 2015)*. Lisboa, Portugal.

2. Papineni, K., Roukos, S., Ward, T., & Zhu, W.-J. (2002). "BLEU: a method for automatic evaluation of machine translation." *Proceedings of the 40th Annual Meeting of the Association for Computational Linguistics (ACL 2002)*, pp. 311–318. Filadelfia, PA.

3. Post, M. (2018). "A Call for Clarity in Reporting BLEU Scores." *Proceedings of the Third Conference on Machine Translation (WMT 2018)*, pp. 186–191. Bruselas, Bélgica. Implementación de referencia: [sacrebleu](https://github.com/mjpost/sacrebleu).

4. Snover, M., Dorr, B., Schwartz, R., Micciulla, L., & Makhoul, J. (2006). "A Study of Translation Edit Rate with Targeted Human Annotation." *Proceedings of the 7th Conference of the Association for Machine Translation in the Americas (AMTA 2006)*, pp. 223–231. Cambridge, MA.

### Práctica de evaluación y pruebas de significancia

S1. Koehn, P. (2004). "Statistical Significance Tests for Machine Translation Evaluation." *Proceedings of the 2004 Conference on Empirical Methods in Natural Language Processing (EMNLP 2004)*. Barcelona, España.

S2. Riezler, S. & Maxwell, J. T. (2005). "On Some Pitfalls in Automatic Evaluation and Significance Testing for MT." *Proceedings of the ACL Workshop on Intrinsic and Extrinsic Evaluation Measures for Machine Translation and/or Summarization*. Ann Arbor, MI.

S3. Kocmi, T., Federmann, C., Grundkiewicz, R., Junczys-Dowmunt, M., Matsushita, H., & Menezes, A. (2021). "To Ship or Not to Ship: An Extensive Evaluation of Automatic Metrics for Machine Translation." *Proceedings of the Sixth Conference on Machine Translation (WMT 2021)*.

S4. Kocmi, T., et al. (2024). "Findings of the WMT24 General Machine Translation Shared Task." *Proceedings of the Ninth Conference on Machine Translation (WMT 2024)*.

S5. NLLB Team, Costa-jussà, M. R., et al. (2022). "No Language Left Behind: Scaling Human-Centered Machine Translation." arXiv:2207.04672. (FLORES-200; reporta chrF++ y spBLEU.)

S6. Goyal, N., Gao, C., Chaudhary, V., et al. (2022). "The Flores-101 Evaluation Benchmark for Low-Resource and Multilingual Machine Translation." *Transactions of the Association for Computational Linguistics*, vol. 10. (spBLEU.)

S7. Mager, M., Oncevay, A., Ebrahimi, A., et al. (2021). "Findings of the AmericasNLP 2021 Shared Task on Open Machine Translation for Indigenous Languages of the Americas." *Proceedings of the First Workshop on Natural Language Processing for Indigenous Languages of the Americas*.

S8. Ebrahimi, A., Mager, M., Rijhwani, S., et al. (2023). "Findings of the AmericasNLP 2023 Shared Task on Machine Translation into Indigenous Languages." *Proceedings of the Workshop on Natural Language Processing for Indigenous Languages of the Americas (AmericasNLP 2023)*.

### Métricas Neuronales

5. Rei, R., Stewart, C., Farinha, A. C., & Lavie, A. (2020). "COMET: A Neural Framework for MT Evaluation." *Proceedings of the 2020 Conference on Empirical Methods in Natural Language Processing (EMNLP 2020)*, pp. 2685–2702. En línea.

6. Juraska, J., Finkelstein, M., Deutsch, D., Siddhant, A., Mirzazadeh, M., & Freitag, M. (2023). "MetricX-23: The Google Submission to the WMT 2023 Metrics Shared Task." *Proceedings of the Eighth Conference on Machine Translation (WMT 2023)*, Singapur. (ACL Anthology 2023.wmt-1.63)

7. Zhang, T., Kishore, V., Wu, F., Weinberger, K. Q., & Artzi, Y. (2020). "BERTScore: Evaluating Text Generation with BERT." *Proceedings of the Eighth International Conference on Learning Representations (ICLR 2020)*. Adís Abeba, Etiopía.

8. Sellam, T., Das, D., & Parikh, A. (2020). "BLEURT: Learning Robust Metrics for Text Generation." *Proceedings of the 58th Annual Meeting of the Association for Computational Linguistics (ACL 2020)*, pp. 7881–7892. En línea.

### Herramientas Morfológicas y Lingüísticas

9. Lindén, K., Silfverberg, M., Axelson, E., Hardwick, S., & Pirinen, T. (2011). "HFST—Framework for Compiling and Applying Morphologies." *Systems and Frameworks for Computational Morphology (SFCM 2011)*, Communications in Computer and Information Science, vol. 100, pp. 67–85. Springer, Berlin, Heidelberg.

10. Sánchez-Cartagena, V. M., & Toral, A. (2024). "MorphEval: Automatic Evaluation of Morphological Capabilities of Machine Translation Systems." *Machine Translation*, vol. 38, pp. 1–28.

### Clasificación de Errores y Evaluación Diagnóstica

11. Popović, M. (2011). "Hjerson: An Open Source Tool for Automatic Error Classification of Machine Translation Output." *The Prague Bulletin of Mathematical Linguistics*, núm. 96, pp. 59–68.

12. Dreyer, M. & Marcu, D. (2012). "HyTER: Meaning-Equivalent Semantics for Translation Evaluation." *Proceedings of the 2012 Conference of the North American Chapter of the Association for Computational Linguistics: Human Language Technologies (NAACL 2012)*, pp. 162–171. Montréal, Canada.

13. Reiter, E. & Belz, A. (2009). "An Investigation into the Validity of Some Metrics for Automatically Evaluating Natural Language Generation Systems." *Computational Linguistics*, vol. 35, núm. 4, pp. 529–558. (Trabajo relacionado sobre métricas de evaluación basadas en características, incluyendo FUSE.)

### Detección de Alucinación

14. Raunak, V., Menezes, A., & Junczys-Dowmunt, M. (2021). "The Curious Case of Hallucinations in Neural Machine Translation." *Proceedings of the 2021 Conference of the North American Chapter of the Association for Computational Linguistics: Human Language Technologies (NAACL 2021)*, pp. 1172–1183. En línea.

15. Guerreiro, N. M., Voita, E., & Martins, A. F. T. (2023). "Looking for a Needle in a Haystack: A Comprehensive Study of Hallucinations in Neural Machine Translation." *Proceedings of the 17th Conference of the European Chapter of the Association for Computational Linguistics (EACL 2023)*, pp. 1059–1075. Dubrovnik, Croacia.

### Recursos del Idioma Cree

16. Wolfart, H. C. (1973). "Plains Cree: A Grammatical Study." *Transactions of the American Philosophical Society*, vol. 63, núm. 5, pp. 1–90.

17. Wolvengrey, A. (2001). *nêhiyawêwin: itwêwina / Cree: Words.* Canadian Plains Research Center, University of Regina.

### Gobernanza de Datos

18. Global Indigenous Data Alliance. "CARE Principles for Indigenous Data Governance." [https://www.gida-global.org/care](https://www.gida-global.org/care).

19. Carroll, S. R., Garba, I., Figueroa-Rodríguez, O. L., Holbrook, J., Lovett, R., Materechera, S., Parsons, M., Raseroka, K., Rodriguez-Lonebear, D., Rowe, R., Sara, R., Walker, J. D., Anderson, J., & Hudson, M. (2020). "The CARE Principles for Indigenous Data Governance." *Data Science Journal*, vol. 19, núm. 1, p. 43.
