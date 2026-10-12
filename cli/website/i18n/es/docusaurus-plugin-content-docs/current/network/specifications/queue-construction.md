---
sidebar_position: 8
title: "Especificación de Construcción de Cola"
slug: '/network/specifications/queue-construction'
description: "La fórmula transparente detrás de la cola de computación comunitaria: clasificación por valor de cadena esperado, cada componente publicado, cada rango re-derivable manualmente."
related:
  - label: "Why the Queue Is Built This Way"
    to: /docs/network/perspectives/why-the-queue
    kind: position
    note: "The philosophy behind this formula"
  - label: "Contributing Compute"
    to: /docs/network/getting-started/contributing-compute
    kind: guide
    note: "How to actually run queue items"
  - label: "Scoring Specification"
    to: /docs/network/specifications/scoring
    kind: spec
  - label: "Corpus Design Framework"
    to: /docs/network/specifications/corpus-design
    kind: spec
    note: "Small-corpus floors and noise thresholds the formula inherits"
---

# Especificación de Construcción de Cola

**Versión de fórmula: `ecv-v3` (valor de cadena esperado con confiabilidad de puente).** Este documento es la definición normativa de cómo se ordena [champollion.dev/queue.json](https://champollion.dev/queue.json). La implementación (`arena/scripts/generate_sweep_queue.py` en el repositorio de arnés público) refleja esta página sección por sección; los metadatos de la cola repiten los valores exactos de parámetros utilizados en el momento de la generación, y **cada elemento lleva su desglose completo de fórmula**, de modo que cualquier rango puede derivarse nuevamente a mano únicamente del JSON publicado. Si esta página y la cola alguna vez no coinciden, eso es un error — por favor repórtelo.

**La cola actual, en un párrafo.** La cola pública contiene tanto elementos de LLM (condiciones de *prompting* ingenuas y guiadas) como elementos de motores de servicios de traducción automática (MT) en un solo tablero, clasificados por el orden de la encuesta (`map`, §2.2): primera luz a través de pares, idiomas y familias por dólar, con un impulso de primera lectura para los idiomas que nunca han sido medidos (§2.2), niveles de presupuesto publicados en la vista previa (§2.1.1) y la clasificación completa servida desde la base de datos (el archivo estático contiene la porción superior cuando la clasificación completa supera su límite de tamaño, y así lo indica). Las secciones a continuación son la definición normativa, conservadas con su historial de decisiones fechado; los metadatos en cualquier cola servida nombran los parámetros exactos que la clasificaron.

> **v3 (2026-06-13).** Cada arista es ahora un *puente* con dos números — calidad y confiabilidad — y la matriz de cadena se ejecuta en su producto (§1.5). 62 elementos de vocabulario de una sola palabra ejecutados una vez ya no pueden parecer una ruta; las replicaciones, corpus más grandes, corpus más ricos e intervalos de confianza más ajustados llevan valor con precio. Las colas v2 (solo calidad) siguen siendo interpretables a través de sus propios metadatos.

## 1. El objetivo: una malla ponderada por calidad

La misión es *cada idioma hacia cada idioma mediante cadenas de pares individuales medidas*. Una traducción entre dos idiomas sin punto de referencia directo se sirve mediante **encadenamiento** de pares evaluados (X→pivote→Y), de modo que lo que vale el punto de referencia no es su número de corpus sino la **capacidad de cadena de su gráfico**.

**Definiciones.** Sea el *gráfico de referencia* con un nodo por idioma y, para cada par de idiomas con al menos una ejecución publicada y no descalificada, una **fortaleza de arista**

```
s(e) = (best published corpus-level chrF++ on that pair) / 100   ∈ [0, 1]
```

El chrF++ a nivel de corpus es el número publicado canónico (véase la [Especificación de Puntuación](/docs/network/specifications/scoring)); *mejor* porque una cadena se enrutaría a través del mejor sistema demostrado por salto. Los pares sin ejecuciones publicadas tienen s(e) = 0.

La **fortaleza de cadena estimada** de una ruta P entre dos idiomas es

```
strength(P) = λ^(|P|−1) · Π_{e ∈ P} s(e)
```

— las calidades de arista se componen multiplicativamente, y cada *unión* (cada pivote intermedio) cuesta un factor de fidelidad adicional **λ < 1**. Ambas opciones están fundamentadas en la literatura de traducción por pivote: la traducción a través de un pivote pierde confiablemente calidad en relación con la traducción directa, más allá de lo que sugiere la composición ingenua (Utiyama & Isahara 2007; Wu & Wang 2007), el tamaño de la pérdida depende del pivote elegido (Paul et al. 2009), y construir pares *directos* no centrados en inglés supera mediblemente el pivoteo en inglés a escala — por ~10 BLEU en la configuración de muchos a muchos de M2M-100 (Fan et al. 2021). λ es el recordatorio permanente de la fórmula de que una cadena estimada no es una medición: solo una ejecución directa elimina el descuento.

La **matriz de mejor cadena** y el **objetivo de malla** son entonces

```
Q(u,v) = max over paths P from u to v of strength(P)      (1 if u = v, 0 if disconnected)

Φ = mean over ordered language pairs (u ≠ v) of Q(u,v)    ∈ [0, 1]
```

Q se calcula exactamente como un problema de ruta más corta bajo la transformación logarítmica estándar (peso de arista −ln(λ·s(e)) ≥ 0, Dijkstra, luego Q = exp(−d)/λ). Φ es la construcción de *eficiencia global* de [Latora & Marchiori (2001)](https://arxiv.org/abs/cond-mat/0101396) con el núcleo de kernel 1/distancia reemplazado por fidelidad de cadena multiplicativa — el núcleo natural cuando las aristas llevan retención de calidad por salto en lugar de longitudes unitarias. (La cola v1 se clasificó por ganancia de eficiencia global sin pesar — el caso especial de esta familia donde todo lo que sabe sobre una arista es si existe.)

### 1.5 Confiabilidad: un puente es (q, r)

Una puntuación llamativa en un corpus diminuto, delgado y nunca replicado no es un puente. v3 por lo tanto divide cada arista medida en:

```
quality      q(e)   = best published corpus-level chrF++ / 100
reliability  r(e)   = f_size · f_rich · f_conf · f_repl        ∈ [0, 1]
effective    s_eff(e) = q(e) · r(e)        ← what chains compose over
```

| Factor | Definición | Crédito completo en | Anclaje |
|---|---|---|---|
| `f_size` | min(1, n/100), n = entradas evaluadas de la mejor ejecución | 100 entradas | el piso de significancia de [diseño de corpus](/docs/network/specifications/corpus-design); Koehn (2004) valida pruebas de arranque en conjuntos de ~300 oraciones — incluso 300 es "pequeño", por lo que el tamaño descuenta confiabilidad en lugar de simplemente limitar la visualización |
| `f_rich` | min(1, L̄/5), L̄ = longitud de fuente *efectiva* media | 5 palabras efectivas | AmericasNLP (Mager et al. 2021) adoptó chrF porque las unidades a nivel de palabra se rompen en morfología rica; Mager et al. (2022) documentan tokens de espacio en blanco como la unidad incorrecta |
| `f_conf` | min(1, 5/h), h = el ancho medio del IC del 95% de chrF de la mejor ejecución (proxy `50/√n` cuando no se publica) | IC ≤ ±5 chrF | el piso de ruido por debajo del cual los deltas son indistinguibles en corpus pequeños; Kocmi et al. (2021) muestran que los deltas dentro del IC frecuentemente contradicen la preferencia humana |
| `f_repl` | min(1, ejecuciones/2) | 2 ejecuciones publicadas | Marie, Fujita & Rubino (2021), meta-evaluando 769 artículos: las comparaciones únicas sin replicar son el fracaso de credibilidad documentado del campo |

La **longitud efectiva** se mide en unidades de contenido, no palabras de espacio en blanco: `L̄ = mean source chars / c(L)`, donde la *economía de caracteres* `c(L)` es la mediana de caracteres en el lado del idioma L por palabra en inglés en el lado alineado, medida desde los corpus paralelos propios de este proyecto (7.400+ entradas alineadas en el momento del envío de v3: cmn 1.6, jpn 2.3, kor 2.6; línea base eng 5.0; deu 6.0; crk 4.7 — palabras polisintéticas valoradas por el contenido que llevan). Sin tablas de búsqueda de tipología; la estimación se afina a medida que los corpus crecen; los idiomas sin datos emparejados con eng utilizan la economía predeterminada. Marcado por corpus en el registro (bloque `richness`).

**Niveles de puente** (vocabulario de visualización): **establecido** — n ≥ 100, L̄ ≥ 5, h ≤ 5, ejecuciones ≥ 2; **provisional** — medido pero fallando cualquiera; **registrado** — sin ejecuciones publicadas. Una afirmación de cadena ("puede ir de X a Y") es solo tan fuerte como el nivel de su salto más débil, y la visualización de malla muestra confiabilidad como opacidad de arista.

**Verificaciones trabajadas** (del script de verificación registrado, ejecutado antes del envío de v3): *62 elementos de vocabulario de una sola palabra, una ejecución* → r ≈ **0.04** (no es una ruta); *200 oraciones, ±3 IC, 3 ejecuciones* → r = **1.00**; un corpus japonés de 101 entradas cuyo recuento de palabras ingenuo es 1.0 (artefacto de script) se rehabilita a 6.5 palabras efectivas y `f_rich` completo. Los límites y la monotonicidad por factor se prueban por propiedad.

**Valor de una ejecución bajo v3.** Una ejecución puede mejorar un puente de dos formas, y ΔΦ toma la mejor de: **(a)** se convierte en la mejor ejecución de la arista — `ŝ_eff = calidad predicha × r(n del corpus, riqueza, proxy de IC, ejecuciones+1)`; o **(b)** simplemente replica — la mejor actual se mantiene, `f_repl` sube. La replicación en una arista de una sola ejecución es por lo tanto valor real con precio, y un corpus más grande o más rico en un par medido supera una re-ejecución del pequeño. Los elementos exponen `edge_quality`, `edge_reliability`, `edge_tier`, `effective_strength`, `post_run_reliability`, y `predicted_effective` junto con los campos de predicción v2.

**Lo que Φ no es.** Φ es la moneda de priorización interna de la cola, no una afirmación de capacidad. Sus entradas son puntuaciones de conjunto de desarrollo con todas las advertencias del [Marco de Diseño de Corpus](/docs/network/specifications/corpus-design): la posible contaminación de datos de entrenamiento hace que cada puntuación sea un límite superior, los valores de chrF++ no son estrictamente comparables entre idiomas, y los corpus pequeños llevan intervalos de confianza amplios. La fórmula solo necesita que Φ *ordene ejecuciones por utilidad*; nunca se publica como una garantía de calidad.

## 2. El problema de decisión

Los elementos abiertos de la cola son cada combinación de (corpus, modelo, condición) que sea elegible (división de desarrollo, licencia redistribuible, no en cuarentena, elegible para transmisión y **resoluble para evaluación comparativa** — consulte la puerta de identidad de idioma en §2.2) y que aún no esté en la tabla de clasificación. Se excluyen las reejecuciones idénticas de combinaciones cubiertas (las huellas digitales de las tarjetas de ejecución las deduplican al publicarlas), pero los nuevos modelos o condiciones en un par ya medido siguen siendo elementos abiertos.

El cómputo contribuido es un presupuesto. Elegir qué elemento abierto ejecutar a continuación para que la malla mejore más rápido es una maximización de estilo de cobertura presupuestada, y el enfoque canónico es selección codiciosa por **valor marginal por unidad de costo**: para objetivos submodulares monótonos la regla codiciosa lleva la garantía clásica (1 − 1/e) (Nemhauser, Wolsey & Fisher 1978), y su forma de relación beneficio/costo es el algoritmo estándar bajo presupuestos (Khuller, Moss & Naor 1999). Usamos la regla de relación como nuestro principio de clasificación. (Nota de honestidad: nuestro objetivo tiene rendimientos decrecientes de estilo de cobertura en su núcleo determinista, pero la capa de predicción estocástica significa que citamos la garantía codiciosa como *motivación*, no como un teorema sobre este sistema exacto.)

```
ECV(item) = ΔΦ(item) / max(est_cost_usd, COST_FLOOR)
```

Los elementos se clasifican por ECV descendente. Los empates se rompen: ingenuo antes que entrenado, más barato primero, luego id de elemento.

### 2.1 Remedios de clasificación — 2026-07-12

Cuatro ajustes superpuestos en la regla ECV codicioso, cada uno reflejado en los metadatos de la cola (`priority_parameters.contamination_ecv_factors`,
`priority_parameters.frontier_interleave`, `metadata.preview_policy`):

1. **Multiplicador de contaminación.** El ECV de cada elemento se multiplica por un factor del grado de contaminación de su corpus: **LOW 1.0 / MEDIUM 0.4 / HIGH 0.1**, siendo un grado desconocido o faltante tratado como MEDIUM (nunca asumir limpieza). Justificación: el gráfico de cadena limpia solo admite aristas de contaminación LOW, por lo que una ejecución no-LOW no puede entrar en él y no debe superar el trabajo de malla limpia a costo igual. Los elementos no-LOW permanecen en cola — las comparaciones de carril relativo tienen valor real — simplemente se clasifican detrás del trabajo limpio.
2. **Intercalado de frontera.** Después de la clasificación codicioso, cada 5.ª ranura de prioridad lleva el elemento de mayor rango aún no colocado del conjunto del modelo de frontera (mantenido como datos en el generador y reflejado en los metadatos), de modo que la evidencia de frontera alcance los priors de predicción temprano en lugar de solo después de que se saturen los niveles baratos. Reordenamiento puro: nada se descarta ni se duplica, un elemento de frontera que ganó una ranura natural la conserva, y las prioridades se numeran desde el orden tejido — la clasificación publicada es la verdad.
3. **Límite de centro de fuente de vista previa.** La vista previa pública de los 25 principales muestra como máximo **6** elementos que comparten un idioma de origen, de modo que un centro bien dotado de recursos no puede monopolizar el escaparate. Los elementos que superan el límite mantienen su prioridad real en la cola completa; la vista previa simplemente extrae el siguiente elemento elegible en orden de clasificación.
4. **Exclusión de lenguaje construido en vista previa.** Los elementos cuyo origen o destino es un lenguaje construido se omiten en la vista previa. La determinación se basa en la familia de tarjetas (el depósito de Lenguaje Artificial de Glottolog, leído de las tarjetas de idioma — nunca un conjunto de idiomas codificado), y la lista de códigos derivada se publica en `metadata.preview_policy` para que las actualizaciones del lado del servidor apliquen la misma selección.

(3) y (4) son **política de presentación únicamente**: la `queue.json` completa, su clasificación y sus prioridades no se ven afectadas.

### 2.1.1 Niveles de presupuesto: "¿qué se compra con $X?" (2026-08-24)

`queue-preview.json` contiene un arreglo `budget_tiers` que resume, para presupuestos de **$1 / $10 / $100 / $1000**, el prefijo asequible codicioso de la clasificación publicada: recorre los elementos en orden de prioridad, toma cada elemento cuyo costo estimado aún se ajuste al presupuesto, omite los que no lo hacen y continúa llenando con elementos posteriores más baratos. Cada nivel informa cuántos elementos compra, su costo estimado total, cuántos pares de idiomas y modelos distintos tocan, y qué tan profundo en la clasificación llega el presupuesto (`max_priority`).

Debido a que la clasificación ya es de valor marginal por costo (§2), el prefijo asequible codicioso **es** la asignación que este modelo recomienda para ese gasto: un contribuyente pequeño y uno grande leen cada uno una respuesta concreta y óptima de la misma clasificación publicada, en lugar de una lista dimensionada implícitamente para nadie. Los niveles son solo resúmenes: la asignación en sí es simplemente la clasificación, recorrida en orden frente a su propio presupuesto. Las actualizaciones del lado del servidor recalculan los niveles sobre los elementos sobrevivientes con el mismo recorrido (el generador y la función de actualización lo implementan como gemelos, probados en ambos lados).

### 2.2 Carriles y modos de clasificación — 2026-07-19

La cola servida declara, en sus propios metadatos, qué **carril** (*lane*) contiene y qué **modo de clasificación** (*ranking mode*) la ordenó. Los metadatos son la autoridad; esta sección define el vocabulario.

**Carriles** (`metadata.lane`, `metadata.lane_policy`). Desde el 2026-08-27, la cola pública contiene el carril **both** (ambos): elementos de LLM (modelo × condición de *prompting*) **y** elementos de servicios de traducción automática (condición `engine` — DeepL, Google Translate, Microsoft Translator, LibreTranslate, Tilde; cada uno se encola solo para pares dentro de su propia lista de cobertura publicada). El carril **llm** del 2026-07-19 (solo elementos de LLM, restringido a pares donde al menos un lado está fuera de la cobertura publicada de todos los servicios de traducción automática) reservaba la evaluación comparativa de servicios para campañas dirigidas por los organizadores que nunca se ejecutaron, lo que estancó la mayor parte del catálogo; medir los servicios *es* la columna vertebral del mapa de cobertura, por lo que ambos tipos de trabajo ahora se encuentran en un solo tablero. La unión de cobertura (con alias de macrolenguaje a través de las tarjetas de idioma) todavía se refleja como `service_coverage_methods` y `service_covered_languages`, y una cola del carril llm todavía informa sus pares excluidos como `pairs_dropped_fully_covered`.

**Límite de tamaño del blob** (2026-08-27). El `queue.json` servido es un archivo estático con un límite estricto de alojamiento, por lo que cuando la clasificación completa lo supera, el archivo contiene la **porción superior** de la clasificación y lo indica en `metadata.blob_truncated {kept, total}` (nunca es un límite silencioso). La cola de la base de datos (`queue_top()` / `queue_pairs()`) siempre sirve la clasificación **completa** y es la lista de trabajo autoritativa; la agregación de pares de la vista previa y los niveles de presupuesto describen el artefacto con el que se envían.

**Puerta de identidad de idioma** (2026-07-19). Los elementos de la cola apuntan solo a **códigos ISO 639-3 individuales activos**: una puntuación contra un macrolenguaje ("Árabe") o un código de familia colectivo ("Lenguas bereberes") sería una afirmación no falsable sobre variedades nunca evaluadas (el mismo razonamiento que siguen FLORES-200/NLLB al codificar datos como `arb`/`quy`/`zsm`). Las etiquetas de corpus ascendentes se *resuelven*, nunca se obedecen ni se descartan: las etiquetas de escritura se eliminan mecánicamente (un corpus `eng→cmn-Hans` se encola para `eng→cmn`, la escritura se mantiene como metadatos de visualización del elemento `source_script`/ `target_script`); los códigos retirados limpiamente siguen a su sucesor oficial de ISO; y un corpus con macroetiquetas se encola solo bajo una **resolución de variedad** registrada y citada en su entrada de registro (por ejemplo, FLORES+ documenta su quechua como `quy`). Los corpus que no se resuelven en ninguna de las dos vías se excluyen con razones legibles por máquina publicadas en `metadata.doctrine_exclusions` (total, recuentos por razón, razones por corpus) y se cuentan en el libro mayor del desierto (`service_landscape.invisible_reasons.corpus_excluded_by_doctrine`): exclusiones visibles, nunca omisiones silenciosas. Los resultados históricos en corpus con etiquetas paraguas mantienen su propio nodo de malla nombrado honestamente (nodo `scope`: `macrolanguage` / `collective` / `retired`), nunca fusionados en una variedad miembro. Todas las entradas de resolución están publicadas: los sellos `language_resolution` por entrada del registro contienen los códigos resueltos, los alcances y las citas fijadas.

**Modos de clasificación** (`metadata.rank_mode`, descritos en `metadata.priority_model`). Dos ordenamientos de los mismos elementos:

- **ecv** — la regla codiciosa del valor esperado de la cadena de §2–§3: mejora de la malla por dólar estimado. El ordenamiento de explotación; correcto cuando el tablero es lo suficientemente denso para que las predicciones y ΔΦ transmitan señal.
- **map** (map-value v2) — el ordenamiento de la encuesta: `MapValue = novelty × uncertainty × promise × connectivity × corpus-quality × contamination ÷ cost`, ensamblado mediante un rastro codicioso exacto. La *novedad* (*novelty*) es el crédito posicional de primera luz que decae a medida que los elementos ya colocados ocupan el mismo par dirigido (1/(1+n)), idioma de destino, familia de destino, celda de método × familia de destino y celda de destino × dominio (cada uno 1/√(1+n); familias de las tarjetas de idioma, dominios de la taxonomía del registro de corpus: la cobertura temprana de un destino debe extenderse a través de los registros, no repetir el primer dominio medido). La *incertidumbre* (*uncertainty*) es la profundidad de retroceso de la predicción de §3.1 (par 0.25 · idioma de destino 0.55 · idioma de origen 0.75 · global 1.0) × 1/(1+ejecuciones publicadas en el borde). La *promesa* (*promise*) es la fuerza predicha de §3.1 con un piso de 0.25: las incógnitas que probablemente funcionen lideran, y mapear un desierto probable aún tiene valor. La *conectividad* (*connectivity*) clasifica más alto a los pares que **vinculan la red medida con un idioma al que aún no puede llegar**: un punto final se considera *establecido* cuando se encuentra en un borde de malla medido (`mesh.json`, estado `measured`) o dentro de la lista de cobertura publicada de cualquier servicio de traducción automática (con alias de macrolenguaje, el mismo alias que la puerta de carril anterior); los **puentes** (exactamente un punto final establecido) y las **islas** (ninguno) obtienen una puntuación de 1.0 — desde el 2026-08-27, la primera luz de un desierto desconectado cuenta por completo (las islas puntuaban 0.5 bajo el dimensionamiento de crecimiento fuera de la red del 2026-07-19, que degradaba estructuralmente la cola más profunda) — mientras que la densificación **interior** (ambos establecidos) puntúa 0.5: el fortalecimiento entre puntos conocidos es el trabajo del modo ecv. Un **impulso de primera lectura** (×2.0) multiplica adicionalmente el valor de la encuesta de cualquier elemento cuyo idioma de origen o destino tenga CERO mediciones publicadas en cualquier lugar — el noveno principio, expresado claramente: **la primera lectura de un idioma supera al refinamiento**. El factor de incertidumbre por sí solo no puede expresar esto (puntúa un par no medido entre dos idiomas bien medidos de manera idéntica a un idioma nunca medido); el impulso hace que la primera luz de la larga cola sea un objetivo declarado en lugar de un accidente emergente. Ambos factores se basan en `metadata.map_value_parameters` y se aplican de manera idéntica dentro del componente de encuesta de edv (§2.3).

  La otra mitad del noveno principio vive FUERA de la clasificación: ningún ordenamiento de elementos existentes puede llegar a un idioma que no tenga ningún corpus (aproximadamente 7,500 idiomas vivos con código individual en la actualidad). La **lista de deseos de corpus** (`/corpus-wishlist.json`, regenerada junto a la cola) publica esa frontera de adquisición: cada idioma vivo, con código individual y sin corpus, clasificado por su mejor recuento de hablantes citado (el recuento de hablantes como indicador de viabilidad para una comunidad que realmente podría construir un corpus), cada recuento atribuido a su fuente y nunca arbitrado.
  La *calidad del corpus* (*corpus-quality*) es el potencial de confiabilidad intrínseca del corpus `f_size × f_rich` de §1.5: la encuesta debe recaer en corpus que puedan soportar peso, por lo que una lista de vocabulario de una sola palabra de 62 entradas ya no encabeza la lista solo porque es barata; una medición de riqueza faltante se mantiene neutral (la ausencia de medición no es evidencia de pobreza). La disciplina de costo y contaminación son idénticas a ecv. El entrelazado de fronteras y los desempates (§2.1) se aplican sin cambios. Correcto para la fase de encuesta: maximiza lo que el *mapa aprende* por dólar (primeras mediciones a través de pares, idiomas, familias, celdas de método y dominios, creciendo a partir de la red medida en lugar de dispersarse) al precio deliberado de un crecimiento más lento de la fuerza de la malla.

> **map-value v2 (2026-07-19).** Dos adiciones dirigidas por los fundadores al ordenamiento de la encuesta: los pares que *sirven de puente hacia la red medida* ahora se clasifican por delante de las sondas desconectadas y la densificación interior, y la calidad del corpus (piso de tamaño × riqueza efectiva, §1.5) más la dispersión de dominio por destino ponderan la clasificación: el cómputo de los contribuyentes debe vincular las rutas establecidas con las nuevas, en corpus lo suficientemente buenos como para soportar el peso. La licencia sigue siendo una **puerta, no un peso**: las reglas de licencia y del canal de transmisión deciden qué se puede encolar en absoluto (§2, y el `transmission_note` de la cola); entre los corpus elegibles, la clasificación es ciega a las licencias, por lo que los conjuntos de investigación restringidos pero fijados (a menudo el único corpus de un par) nunca se ven sistemáticamente privados. Las colas v1 (solo novedad × incertidumbre × promesa) siguen siendo interpretables a través de sus propios metadatos.

Los valores exactos de los factores utilizados en la generación se envían en `metadata.map_value_parameters`; las entradas de conectividad y calidad se pueden volver a derivar del `mesh.json` publicado (bordes medidos), la unión de cobertura de servicios reflejada en los metadatos y `registry.json` (recuentos de entradas + riqueza). Cada elemento retiene adicionalmente los campos de diagnóstico completos de ecv-v3 independientemente del modo, por lo que cualquier ordenamiento se puede volver a derivar de los mismos artefactos.

### 2.3 Modo de clasificación `edv` — valor de decisión esperado (2026-08-27)

*Estado: implementado, desactivado por defecto a la espera de la comparación medida en §2.3.6. El valor predeterminado publicado sigue siendo `map` hasta entonces.*

La cola compra exactamente dos productos: el **mapa de capacidades** (qué método es bueno en qué, con incertidumbre honesta) y la **malla de enrutamiento** (pares medidos que se encadenan en rutas). `edv` valora cada elemento candidato según cuánto avanza en ambos, como un portafolio ponderado:

```
EDV(item) = [ w_judge·Ĵ + w_mesh·M̂ + w_survey·Ŝ ] × contamination ÷ max(cost, COST_FLOOR)
```

con valores predeterminados `w_judge = 0.35, w_mesh = 0.25, w_survey = 0.40` (ajustables por los fundadores; cada generación refleja los pesos realmente utilizados en `metadata.edv_parameters`). El factor de contaminación (remedio 1 de §2.1) se aplica exactamente una vez, como el multiplicador externo. Las licencias y la transmisión siguen siendo **puertas, no pesos**: la elegibilidad se decide antes de calcular cualquier valor, y la clasificación es ciega a las licencias entre los corpus elegibles.

#### 2.3.1 Ĵ — valor de juicio de método

Valora cuánto avanza la ejecución en **resolver comparaciones de métodos en el mismo corpus**: la única afirmación entre métodos que autoriza la propia investigación de medición de este proyecto. (El estudio de transferencia de dificultad W2 rechazó la vinculación de habilidades entre idiomas; su resultado positivo autorizado, el ajuste aditivo de método × corpus dentro del idioma, es exactamente lo que utiliza este componente. Las puntuaciones se utilizan solo para ordenamiento y separación, nunca se convierten en probabilidades de aceptabilidad, según el piloto de calibración).

Para un candidato (corpus C, método M, condición): los **socios de contraste** son los métodos M′ que ya tienen una ejecución publicada en (C, misma condición). Para cada socio, siendo `sep` la separación de puntuación en puntos chrF sobre las semiamplitudes de los intervalos de confianza (IC) agrupados (IC registrados; proxy `50/√n` cuando no están publicados), y `sep_pred` lo mismo calculado frente a la puntuación predicha de §3.1:

| estado de contraste de {M, M′} en el par | crédito |
|---|---|
| **no cumplido** (*unmet*) — aún no hay corpus compartido | `JUDGE_FIRST = 1.0` |
| **disputado** (*contested*) — existen corpus compartidos, todos `sep < Z_DEC` | `JUDGE_CONTESTED = 0.8 × clip(sep_pred / Z_DEC, 0, 1)` |
| **decidido** (*decided*) — algunos `sep ≥ Z_DEC`, n_dec corpus lo deciden | `JUDGE_DECIDED = 0.25 / (1 + n_dec)` |

cada uno multiplicado por `w_top = 1/√(rank(M)·rank(M′))`: decidir el primer lugar contra el segundo vale más que el séptimo contra el octavo. La clasificación de métodos por par utiliza el ajuste aditivo autorizado de método × corpus (mínimos cuadrados alternos sobre celdas observadas) cuando el par tiene ≥2 métodos × ≥2 corpus medidos, de lo contrario, la mejor puntuación por método; el ajuste es **estrictamente por par, nunca agrupado entre idiomas**. `Z_DEC = 1.96`.

Un contraste guiado frente a ingenuo en el mismo (C, M) suma `JUDGE_COND = 0.5 / (1 + n_cond)`. Los contrastes de un elemento se suman con rendimientos decrecientes (`JUDGE_GAMMA = 0.7` por contraste adicional, ordenados de forma descendente), más un **término semilla** `JUDGE_SEED = 0.25 × min(1, m_C/3) × corpus-quality` (m_C = otros métodos de la alineación con un elemento de cola en C) para que un tablero vacío siga prefiriendo corpus donde se puedan juzgar futuras comparaciones: valor de sede, nunca una puntuación prestada. Durante el ensamblaje, el componente de juez decae `1/(1 + items already placed on the same pair and condition lane)`.

#### 2.3.2 M̂ y Ŝ

`M̂` es la ganancia de malla esperada (ΔΦ) de §3, sin cambios, con la matriz de cadena congelada en el momento de la generación. `Ŝ` es el núcleo de map-value v2 de §2.2 (`uncertainty × promise × connectivity × corpus-quality` con la decadencia de novedad posicional), sin cambios. El *nivel* de puntuación predicha (promesa) vive solo en Ŝ; Ĵ utiliza solo *separaciones* de puntuación: los dos componentes no pueden contar dos veces el mismo optimismo.

#### 2.3.3 Normalización

Los tres componentes viven en escalas inconmensurables, por lo que cada componente estático se divide por su percentil 95 sobre el conjunto de candidatos (con un límite de `EDV_NORM_CAP = 4.0`); los tres normalizadores se envían en `metadata.edv_parameters.normalizers`, lo que hace que cada valor EDV publicado se pueda volver a derivar de sus propios artefactos.

#### 2.3.4 Ensamblaje

El ordenamiento es exactamente el mismo rastro codicioso perezoso (*lazy-greedy*) que el modo map: cada multiplicador dependiente del orden (novedad de la encuesta, decadencia de la ubicación del juez) es monótono no creciente a medida que se colocan los elementos, por lo que una entrada de montículo (*heap*) obsoleta solo puede sobreestimar: el invariante codicioso perezoso se mantiene y el rastro es igual al codicioso de fuerza bruta. El entrelazado de fronteras, la política de vista previa y los niveles de presupuesto se aplican sin cambios.

#### 2.3.5 Explicabilidad

Cada elemento retiene, en sus diagnósticos: la lista de contrastes por la que se le acreditó (socio, estado, separación predicha, peso de rango), los términos de semilla y decadencia, todos los campos de §2.2 y §3, los pesos y normalizadores: el valor EDV publicado es exactamente recomputable a partir de la fila. "¿Cómo obtuvo este elemento este rango?" es respondible sin ningún estado externo.

#### 2.3.6 Criterio de adopción

`edv` se convierte en el valor predeterminado publicado solo después de una comparación medida contra `map` y `ecv` en el mismo tablero: dentro del 10% de map en cada métrica de la encuesta (percentiles de profundidad de primera luz, pares/idiomas/familias distintos en profundidad, tasa marginal de nuevos pares), estrictamente mejor en ambas métricas de juez (contrastes disputados resueltos por cada $1k simulado; recuperación de la clasificación de métodos con gasto fijo), y un crecimiento de malla por dólar no peor que map. El informe de comparación se publica junto con el cambio.

## 3. El valor de una ejecución

### 3.1 Predicción de la puntuación antes de ejecutar

La puntuación esperada de un (par, modelo, condición) no ejecutado es una suma deliberadamente simple y completamente inspectable — una predicción de efectos principales bidireccionales más optimismo estructurado, cada término publicado en el elemento:

```
ŝ = clip( pair_prior + model_offset + condition_offset + exploration_bonus,  0, S_CAP )
```

- **`pair_prior`** — retroceso jerárquico sobre fortalezas publicadas: media en este par → media en este idioma de destino → media en este idioma de origen → media global → `S0_FALLBACK`. El nivel utilizado se publica como `prior_basis`.
- **`model_offset`** — cómo se desempeña este modelo en relación con los *otros* modelos en el mismo par, promediado sobre todos los pares donde existe una comparación. Cero para modelos nunca vistos.
- **`condition_offset`** — el delta observado entrenado-menos-ingenuo en el mismo par (retrocediendo al mismo idioma de destino), y **cero de otra manera**: las ganancias de entrenamiento son reales donde se miden pero no se asume que se transfieran entre idiomas, por lo que en pares sin evidencia la convención de línea de base primero se mantiene.
- **`exploration_bonus`** — optimismo ante la incertidumbre, con el cronograma UCB1 (Auer, Cesa-Bianchi & Fischer 2002): `κ·sqrt(2·ln(1+N)/(1+n))`, donde N es el número total de ejecuciones puntuadas publicadas y n el número en este (par, modelo). Las celdas nunca intentadas obtienen el bonificación más grande; las celdas bien medidas decaen hacia cero. Tomamos prestado el cronograma — la forma que hace que los brazos poco explorados resurjan a la tasa correcta — no el teorema de arrepentimiento, que asume un bandido estacionario que este sistema no es.

### 3.2 La ganancia de malla, en forma cerrada

Una ejecución solo puede mejorar la malla elevando la arista de su par a `s' = max(s(e), ŝ)`. Para un cambio de arista única, la nueva mejor cadena entre dos idiomas cualesquiera ignora la nueva arista o la usa exactamente una vez, por lo que la matriz mejorada — y por lo tanto ΔΦ — tiene una forma exacta de una línea (sin resolver el gráfico completo):

```
Q'(u,v) = max( Q(u,v),  E(u,a)·s'·E(b,v),  E(u,b)·s'·E(a,v) )

E(x,y) = λ·Q(x,y) for x ≠ y;  E(x,x) = 1        (edge e = {a, b})

ΔΦ = mean over ordered pairs of (Q'(u,v) − Q(u,v))
```

E es "la mejor cadena al punto final de la nueva arista, pagando la unión para empalmarla"; los dos términos son las dos direcciones de cruzar la arista. Esto se prueba en el conjunto de arnés contra recompilación de fuerza bruta de Φ.

Una predicción que no puede superar la fortaleza de arista actual produce ΔΦ = 0: la fórmula gasta el dinero de los donantes confirmando lo desconocido, no re-midiendo lo demostrado. (El bonificación de exploración evita que las celdas débiles o submuestreadas se desnutran para siempre.)

### 3.3 Qué cuenta como evidencia vs. qué puede ser encolado

Dos puertas diferentes, deliberadamente asimétricas:

- **Evidencia** proviene de *cada* ejecución publicada y no descalificada — incluyendo ejecuciones en corpus que no pueden ser encolados públicamente (p. ej. conjuntos con licencia no comercial). Una medición publicada de un par es conocimiento independientemente de si podría re-ejecutarlo.
- **Acciones** (elementos de cola) provienen solo de corpus abiertamente ejecutables: división de desarrollo, licencia de familia CC-BY, recuperable por cualquiera.

Los idiomas alcanzables solo a través de corpus no encolables aún se sientan en el gráfico: mejorar aristas *alrededor* de ellos cambia sus valores de cadena, y la fórmula lo contabiliza.

## 4. Parámetros

| Parámetro | Predeterminado | Significado y justificación |
|---|---|---|
| `λ` (`lambda_junction_discount`) | **0.9** | Retención de fidelidad por unión de una cadena *estimada*. Codifica "la medición directa supera el encadenamiento de producto igual" (Utiyama & Isahara 2007; Wu & Wang 2007; Fan et al. 2021). El corte de ~10% es una opción de calibración, revisada a medida que se acumulan triángulos de cadena medidos (§6). |
| `κ` (`kappa_exploration_scale`) | **0.05** | Escala de bonificación de exploración, en unidades de fortaleza. 0.05 ≡ 5 puntos de chrF++ — el piso de ruido por debajo del cual las diferencias de puntuación son indistinguibles en corpus de menos de 100 entradas ([Diseño de Corpus §6.3](/docs/network/specifications/corpus-design)). El optimismo se limita a la resolución del instrumento. |
| `S_CAP` | **0.95** | Techo de predicción — ninguna arista estimada puede reclamar fidelidad casi perfecta que no haya demostrado. |
| `S0_FALLBACK` | **0.5** | Prior de par de último recurso, utilizado solo cuando no hay resultados publicados en absoluto (la media global observada — ≈ 0.54 sobre las primeras 429 ejecuciones — se prefiere siempre que exista algún resultado). |
| `COST_FLOOR` | **$0.01** | Piso para el denominador de ECV, de modo que las ejecuciones casi gratuitas no puedan reclamar valor ilimitado por dólar. |
| `N_FULL` | **100** | Entradas evaluadas para crédito de tamaño completo (§1.5). |
| `L_HEALTHY` | **5.0** | Palabras efectivas para crédito de riqueza completa (§1.5). |
| `H_NOISE` | **±5 chrF** | Ancho medio de IC para crédito de confianza completo; los IC faltantes se aproximan como 50/√n (anclados a ±5 en n=100). |
| `RUNS_FULL` | **2** | Ejecuciones publicadas para crédito de replicación completo. |

**Versionado.** Los cambios de parámetro o fórmula aumentan `formula_version` (metadatos) y la línea de versión de esta página. La cola siempre repite los valores exactos utilizados bajo `metadata.priority_parameters`, incluyendo el Φ actual, de modo que las colas históricas permanecen interpretables. Las ejecuciones de sensibilidad están a una bandera de distancia: `generate_sweep_queue.py --lam 0.8 --kappa 0.1`.

## 5. Ejemplo trabajado (valores en vivo, 2026-06-12)

Generación contra 424 ejecuciones puntuadas, 59 aristas medidas, 60 idiomas; **Φ = 0.272**. El elemento superior:

```
eng>fao · claude-haiku-4.5 · naive
  edge_strength        0.0      (no published eng→fao runs)
  pair_prior           0.613    basis: target-language (Faroese runs exist via dan→fao)
  model_offset        −0.114    (haiku trails other models on shared pairs)
  condition_offset     0.0      (no coaching evidence for fao)
  exploration_bonus   +0.174    (never-run cell: κ·√(2·ln 425 / 1))
  predicted_strength   0.673
  expected_mesh_gain   0.0181   (eng→fao is a near-component join)
  est_cost_usd         0.0101
  ecv_per_usd          1.79     ← rank #1
```

Léalo de vuelta: El feroés está conectado a la malla solo a través del danés, por lo que una arista eng→fao medida ataja una familia enorme de cadenas (el ΔΦ grande); el modelo se predice a mitad de tabla en un par como este (prior + desplazamiento), nadie ha intentado nunca esta celda (bonificación grande), y la ejecución cuesta un centavo. Nada más en la cola compra más malla por dólar. La misma aritmética, con cada entrada publicada, produce cada otro rango.

## 6. Limitaciones conocidas (y qué las arreglaría)

1. **chrF++ no es comparable entre idiomas.** La morfología mueve la escala; una arista 0.5 hacia el vasco no es el mismo logro que hacia el holandés. Mitigación: las prioridades están dominadas por *estructura* (transiciones s = 0 → s > 0) donde los efectos de escala son de segundo orden. Solución: normalización de puntuación por idioma, o métricas con mejor calibración entre idiomas a medida que estén disponibles para estos idiomas.
2. **El modelo de cadena producto-λ es un prior, no una medición.** Está direccionalmente respaldado por la literatura de pivote pero sin calibrar para traducción LLM. Solución (planeada): la malla ahora contiene triángulos medidos (p. ej. deu→fra directo junto con deu→eng→fra), de modo que la salida encadenada puede puntuarse directamente y λ ajustarse a datos en lugar de elegirse.
3. **Contaminación y estado de conjunto de desarrollo.** Las fortalezas de arista heredan cada advertencia de conjuntos de desarrollo públicos — trate Φ como una señal de planificación de límite superior, nunca una afirmación de capacidad ([Diseño de Corpus](/docs/network/specifications/corpus-design)).
4. **Ceguera de dominio.** Una arista medida en texto conversacional se trata como un número; las cadenas que cruzan dominios se degradarán más de lo que λ predice.
5. **Direccionalidad.** Las aristas actualmente son no dirigidas (evidencia X→Y ilumina X↔Y). Cuando la composición de cadena se vuelve sensible a la dirección en la práctica, las fortalezas se dividen por dirección — la fórmula no cambia, el gráfico simplemente se duplica.

## 7. Referencias

- Latora, V. & Marchiori, M. (2001). *Efficient Behavior of Small-World Networks.* Physical Review Letters 87, 198701. [arXiv:cond-mat/0101396](https://arxiv.org/abs/cond-mat/0101396)
- Auer, P., Cesa-Bianchi, N. & Fischer, P. (2002). *Finite-time Analysis of the Multiarmed Bandit Problem.* Machine Learning 47, 235–256. [doi:10.1023/A:1013689704352](https://link.springer.com/article/10.1023/A:1013689704352)
- Nemhauser, G., Wolsey, L. & Fisher, M. (1978). *An Analysis of Approximations for Maximizing Submodular Set Functions—I.* Mathematical Programming 14, 265–294. [doi:10.1007/BF01588971](https://link.springer.com/article/10.1007/BF01588971)
- Khuller, S., Moss, A. & Naor, J. (1999). *The Budgeted Maximum Coverage Problem.* Information Processing Letters 70(1), 39–45. [doi:10.1016/S0020-0190(99)00031-9](https://dl.acm.org/doi/10.1016/S0020-0190(99)00031-9)
- Utiyama, M. & Isahara, H. (2007). *A Comparison of Pivot Methods for Phrase-Based Statistical Machine Translation.* HLT-NAACL 2007, 484–491. [ACL Anthology N07-1061](https://aclanthology.org/N07-1061/)
- Wu, H. & Wang, H. (2007). *Pivot Language Approach for Phrase-Based Statistical Machine Translation.* ACL 2007; journal version Machine Translation 21(3), 165–181. [doi:10.1007/s10590-008-9041-6](https://link.springer.com/article/10.1007/s10590-008-9041-6)
- Paul, M., Yamamoto, H., Sumita, E. & Nakamura, S. (2009). *On the Importance of Pivot Language Selection for Statistical Machine Translation.* NAACL-HLT 2009 Short Papers, 221–224. [ACL Anthology N09-2056](https://aclanthology.org/N09-2056/)
- Haffari, G., Roy, M. & Sarkar, A. (2009). *Active Learning for Statistical Phrase-Based Machine Translation.* NAACL-HLT 2009, 415–423. [ACL Anthology N09-1047](https://aclanthology.org/N09-1047/)
- Fan, A. et al. (2021). *Beyond English-Centric Multilingual Machine Translation.* Journal of Machine Learning Research 22(107), 1–48. [arXiv:2010.11125](https://arxiv.org/abs/2010.11125)
