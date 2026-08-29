---
sidebar_position: 6
title: "Especificación de Confiabilidad de Métricas"
slug: '/network/specifications/metric-reliability'
related:
  - label: "Scoring Specification"
    to: /docs/network/specifications/scoring
    kind: spec
    note: "What each metric measures and how the harness computes it"
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
---

# Especificación de Confiabilidad de Métricas

> **Resumen Ejecutivo.** Una puntuación de referencia es tan significativa como la métrica detrás de ella — y las métricas automáticas no concuerdan con el juicio humano por igual en todos los idiomas. Este documento especifica cómo Champollion mide la **confiabilidad de métricas**: para cada familia lingüística, qué tan fuertemente cada métrica automática (BLEU, spBLEU, chrF, chrF++, COMET, MetricX) se correlaciona con juicios de calidad humana, calculados a partir de los archivos de la tarea compartida de Métricas de WMT (2019–2025). El resultado es un artefacto de evidencia publicado y legible por máquina que el arnés, la CLI y el servidor MCP consultan antes de presentar cualquier puntuación como confiable. Hasta donde sabemos, ninguna otra infraestructura de evaluación publica esta evidencia por idioma; es lo que convierte "ejecutamos una métrica" en "aquí está cuánto creerle".
>
> **Alcance.** Este documento define *qué es la evidencia de confiabilidad, de dónde viene, exactamente cómo se calcula, y qué deliberadamente excluye*. Las definiciones de métricas en sí viven en la [Especificación de Puntuación](/docs/network/specifications/scoring); las pruebas estadísticas de diferencias de puntuación viven en [Significancia](/docs/network/specifications/significance). El importador que regenera el artefacto es `arena/scripts/import_wmt_metaeval.py` en el repositorio del arnés — el código es la palabra final sobre detalles de implementación, y está abierto para revisión.

---

## 1. El problema que resuelve

La calidad de la traducción automática es, en última instancia, un juicio humano. Las métricas automáticas existen porque la evaluación humana es lenta y costosa; cada puntuación automática es un *proxy* de lo que diría un bilingüe competente. El atajo de todo el campo — "el Sistema A supera al Sistema B por 2 BLEU" — asume silenciosamente que el proxy es fiel.

Esa suposición ha sido probada durante años por la tarea compartida de Métricas de WMT, pero casi siempre *en agregado*: las métricas se clasifican por correlación promedio con juicio humano en los pares de idiomas que la campaña de ese año cubrió — principalmente pares europeos de alto recurso más chino y japonés. El detalle por idioma existe en los datos sin procesar y en los documentos de hallazgos por año, pero no se publica en ningún lugar como una capa de evidencia consultable por familia de idiomas que una tubería de evaluación pueda consultar.

El detalle importa enormemente para idiomas de bajo recurso y morfológicamente ricos. Dos hallazgos de nuestra propia importación ilustran las apuestas (§7 tiene la tabla completa):

- **English→Inuktitut (wmt20).** La correlación a nivel de sistema de BLEU con juicio humano es **+0.16** — esencialmente no informativo. chrF logra +0.35. COMET alcanza +0.86. Un marcador clasificado por BLEU para este par estaría clasificando ruido; el mismo marcador clasificado por COMET lleva señal.
- **English→Maasai (wmt25).** El fracaso inverso: la correlación de MetricX-25 es **−0.09** — una métrica *aprendida* de última generación puntuando un idioma ausente de su entrenamiento da números no correlacionados con juicio humano, mientras que chrF++ calculado (una métrica de cadena "tonta" sin datos de entrenamiento que le falten) logra +0.50.

Ningún modo de fallo es visible en un promedio global, y apuntan en direcciones opuestas: para un idioma la métrica aprendida es la única utilizable; para otro es la única *inutilizable*. Cualquier infraestructura que puntúe cientos de pares de idiomas con un conjunto de métricas fijo — como lo hace Champollion — le debe esta evidencia a sus usuarios.

## 2. Definiciones

Las definiciones a continuación son el mínimo necesario para leer el resto del documento con precisión. Los lectores familiarizados con evaluación de MT pueden pasar rápidamente a §3.

**Métrica automática.** Una función de (salida del sistema, traducción de referencia, y a veces la fuente) a un número. *Métricas de cadena* — BLEU, spBLEU, chrF, chrF++ — comparan superposición de superficie entre salida y referencia. *Métricas aprendidas* — COMET, MetricX, BLEURT — son modelos neuronales entrenados en juicios humanos pasados para predecir calidad. Los identificadores canónicos para todas las métricas en este documento provienen del registro de métricas de Champollion (`shared/metric-registry.json`): `bleu`, `spbleu`, `chrf_plain`, `chrf_plus_plus`, `comet_score`, `metricx_score`.

**Protocolos de juicio humano.** Las campañas de WMT recopilaron puntuaciones de calidad humana bajo varios protocolos, que este artefacto mantiene distintos:

- **DA (Evaluación Directa)** — trabajadores de multitudes o investigadores califican una traducción 0–100. *DA normalizada por z* (escrita `wmt-z`) estandariza las puntuaciones de cada calificador a media 0, varianza 1, eliminando efectos de generosidad del calificador.
- **DA+SQM** (`da-sqm`, `wmt`) — DA recopilada en escala 0–100 anotada con descripciones de anclaje de métrica de calidad escalar; utilizada desde WMT22.
- **MQM (Métricas de Calidad Multidimensionales)** (`mqm`) — anotadores profesionales marcan y clasifican tramos de error individuales con severidades; el recuento de errores ponderado se convierte en una puntuación de segmento. Lento, costoso, y la señal más confiable disponible; recopilado solo para algunos pares de alto recurso por año (las anotaciones se originan en los lanzamientos `wmt-mqm-human-evaluation` de Google).
- **ESA (Anotación de Tramo de Error)** (`esa`, `esa-merged`) — protocolo de WMT24 y WMT25 que combina marcado de tramo de error con una calificación escalar; más barato que MQM, más informativo que DA.

**Meta-evaluación.** Evaluando a los evaluadores: midiendo qué tan bien las puntuaciones de cada métrica automática concuerdan con las puntuaciones humanas sobre las mismas traducciones. El acuerdo se mide en dos niveles:

- **Nivel de sistema** (`sys`): cada sistema de MT obtiene una puntuación humana agregada y una puntuación de métrica agregada para un conjunto de prueba; el acuerdo se calcula entre sistemas. Esto pregunta: *¿la métrica clasifica sistemas completos como lo hacen los humanos?* — la pregunta que le importa a un marcador.
- **Nivel de segmento** (`seg`): acuerdo entre pares individuales (sistema, oración). Esto pregunta: *¿puede la métrica distinguir una oración buena de una mala?* — la pregunta que la estimación de calidad y el filtrado de datos les importa. Es mucho más difícil, y las correlaciones son sistemáticamente más bajas.

**Estadísticas de correlación.** Cuatro estadísticas estándar, definidas aquí exactamente como se calculan:

- **r de Pearson** — correlación lineal entre los dos vectores de puntuación.
- **ρ de Spearman** — r de Pearson calculado en rangos promedio; mide acuerdo monótono, insensible a escala.
- **τ-b de Kendall** — entre todos los pares de elementos, el exceso (ajustado por empates) de pares ordenados concordantemente sobre pares ordenados discordantemente. Usamos la formulación estándar τ-b ajustada por empates (equivalente a `scipy.stats.kendalltau`; nuestra implementación es libre de dependencias y se verifica cruzada contra una referencia de fuerza bruta en el conjunto de pruebas).
- **Precisión de clasificación por pares** (solo nivel de sistema) — de todos los pares de sistemas que los humanos ordenan *estrictamente*, la fracción que la métrica ordena de la misma manera, con un empate de métrica contado como un fracaso en reproducir el orden. Esta es la estadística de precisión de Kocmi et al. (2021), que las campañas recientes de WMT usan como su número de titular a nivel de sistema.

**Familia lingüística.** La agrupación genealógica del *idioma de destino* (el idioma que se está traduciendo), como se registra en la base de datos de idiomas de Champollion (`languages.family`, derivada de Glottolog). §5 discute por qué el lado de destino, y qué puede y no puede representar una familia.

## 3. Datos

### 3.1 Fuentes, fijadas

| Fuente | Lo que proporciona | Fijación |
|---|---|---|
| `google-research/mt-metrics-eval` (archivo de datos v2) | Puntuaciones humanas, puntuaciones de métricas, salidas del sistema, fuentes y referencias para cada conjunto de prueba de tarea de Métricas de WMT, wmt19–wmt25 | commit de código `68a481ae…`; tarball de datos `mt-metrics-eval-v2.tgz` de `data.statmt.org`, fijado **sha256 `6708eec9aaa8a9deca5e370bdd0e23db4881aeca129f29d5281575eaa66c7e10`**, ETag `36579a46-64ff8bb1d3080`, Last-Modified 2026-04-21, 911,710,790 bytes |
| `google/wmt-mqm-human-evaluation` | El origen ascendente de las anotaciones de expertos MQM que mt-metrics-eval redistribuye en forma fusionada; Apache-2.0 | commit `7fadea28…` |

Dos hechos de integridad de datos dan forma a la disciplina de fijación. Primero, **el tarball de datos no es inmutable** — se republica en su lugar a medida que se agregan campañas — por lo que el artefacto registra la suma de verificación, ETag y marca de tiempo de la copia exacta de la que se calcularon los números, y el importador se niega a ejecutarse sin una suma de verificación. Segundo, la concesión Apache-2.0 del conjunto de herramientas cubre su *código*; **los datos de juicio humano y conjunto de prueba incluidos no llevan declaración de licencia explícita**. Las consecuencias de eso están en §8.

El contenido del archivo (≈4.2 GB sin comprimir: juicios humanos, referencias y salidas completas del sistema para cada campaña) **nunca se almacenan en este repositorio o se redistribuyen por Champollion**. Se obtienen de la fuente en un caché local; solo se publican números de correlación derivados. Esta es la misma postura de obtención de fuente que sigue cada referencia de Champollion.

### 3.2 Lo que cada campaña contribuye

| Conjunto de prueba | Pares con juicios humanos | Protocolo(s) humano(s) usado(s) aquí |
|---|---|---|
| wmt19 | 18 | DA-z |
| wmt20 | 18 (incl. en→iu, en→ta, km→en, ps→en) | DA-z; MQM (en→de, zh→en) |
| wmt21.news | 16 (incl. en→ha, en→is) | DA-z; MQM (en→de, zh→en, en→ru) |
| wmt21.tedtalks | 3 | MQM |
| wmt21.flores | 4 (bn↔hi, xh↔zu) | DA-z |
| wmt22 | 17 (incl. en→liv, sah→ru, cs↔uk) | DA-SQM; MQM (en→de, zh→en, en→ru) |
| wmt23 | 9 (incl. he→en) | DA-SQM; MQM |
| wmt23.sent | 1 | MQM |
| wmt24 | 11 (incl. en→is, en→hi) | ESA; MQM |
| wmt25 | 16 (incl. en→bho, en→mas, en→ar) | ESA-merged; MQM |

**Excluido: wmt24pp.** El lanzamiento WMT24++ extiende la cobertura a 55 pares de idiomas pero envía *referencias y salidas del sistema solamente* — sin juicios humanos — por lo que no se puede calcular correlación de él. Se enumera en el libro mayor de exclusiones del artefacto en lugar de ser descartado silenciosamente.

## 4. Método

El importador recorre cada (conjunto de prueba, par de idiomas) y calcula una **celda** por (carril de juicio humano, nivel, métrica):

1. **Descubrir carriles humanos.** Todos los archivos de puntuación humana disponibles para el par se cotejan contra una lista de permitidos explícita (§4.1). Los archivos a nivel de calificador, archivos de tramo de error sin procesar y puntuaciones a nivel de documento/dominio están fuera del alcance.
2. **Excluir "sistemas" humanos.** Los archivos de puntuación de WMT incluyen las traducciones de referencia en sí como sistemas puntuados (`refA`, `refb`, `HUMAN.0`…). Correlacionar una métrica contra su propia referencia es sin sentido, por lo que cualquier sistema que coincida con el conjunto de referencias del par o los prefijos `ref`/`human`/`synthetic` se excluye en todas partes.
3. **Alinear.** Nivel de sistema: la intersección de sistemas que tienen tanto una puntuación humana como una de métrica (los valores faltantes se descartan, nunca se coercionan a cero). Nivel de segmento: cada (sistema, segmento) con ambas puntuaciones, agrupadas entre sistemas sin agrupar — este es el aplanamiento "sin promediación" de mt-metrics-eval. Los archivos irregulares (recuentos de segmento no coincidentes) fallan la celda en lugar de alinearse aproximadamente.
4. **Calcular.** Pearson, Spearman y Kendall τ-b en ambos niveles; precisión de clasificación por pares a nivel de sistema. Las celdas con menos de 3 sistemas alineados (sys) o menos de 10 puntos alineados en al menos 2 sistemas (seg), o con varianza cero en cualquier lado, se registran en el libro mayor de exclusiones como degeneradas (20 celdas en la compilación actual).
5. **Resumir.** Por familia de idioma de destino, por métrica, por nivel: la media ponderada por n de cada estadística en las celdas *preferidas* (§4.1), con la lista de (conjunto de prueba, par) contribuyente retenida para que cualquier agregado pueda descomponerse de nuevo a sus entradas.

### 4.1 Preferencia de carril humano

Donde un par tiene varios carriles de juicio humano, todos se calculan, pero exactamente uno se marca **preferido** y solo las celdas preferidas entran en el resumen de familia — de lo contrario, un par juzgado bajo MQM y DA contaría dos veces. El orden de preferencia es por calidad de señal:

```
mqm > esa-merged > esa > da-sqm > wmt-z > wmt-appraise-z > wmt-appraise > wmt > wmt-raw
```

La anotación de error de experto (MQM) supera a los protocolos de tramo de error (ESA), que superan la evaluación directa escalar; dentro de DA, los carriles normalizados por z superan los sin procesar. Las celdas no preferidas permanecen en el artefacto para cualquiera que quiera estudiar efectos de protocolo.

### 4.2 Identidad de métrica y versionado

Las métricas aprendidas cambian año a año (COMET-20, COMET-22, MetricX-23/24/25 son modelos diferentes), y tratarlas como una métrica borraría exactamente la distinción que la meta-evaluación existe para dibujar. Cada celda por lo tanto registra el **nombre de puntuación ascendente verbatim** (`COMET-22`, `MetricX-25-Ref`, `metricx_xxl_MQM_2020`…) junto con el id del registro canónico, y el artefacto enumera qué nombres ascendentes alimentaron cada id. Donde una campaña puntuó una métrica contra varias referencias, la secuencia de referencia utilizada también se registra por celda.

Las puntuaciones se usan exactamente como el archivo las distribuye (todos los carriles más alto es mejor; las puntuaciones de error MQM y MetricX se almacenan negadas ascendentemente). No se aplica inversión de signo ni reescalado; las correlaciones son invariantes a la escala y la convención de orientación se verificó empíricamente antes de la importación.

### 4.3 El carril chrF++ calculado

chrF++ — la métrica de cadena principal del arnés — solo se envió a la campaña wmt20, por lo que existen puntuaciones ascendentes para un año. Para cada otro conjunto de prueba el importador calcula chrF++ en sí (sacreBLEU, `word_order=2`) de las salidas del sistema en caché contra la referencia registrada. Estas celdas se marcan `computed: true` y su nombre ascendente dice así: una puntuación calculada por Champollion nunca se presenta como un envío de WMT. Todas las otras celdas de métrica son valores ascendentes verbatim; la única cosa que Champollion les agrega es la aritmética de correlación.

## 5. Decisiones de diseño, alternativas y justificación

Estas son las decisiones que un revisor debe interrogar. Cada una enumera lo que se eligió, lo que no, y por qué.

**Clave por familia de idioma de destino.** *Elegido:* agregar por la familia del idioma que se está traduciendo *en*. *Alternativas:* solo por par (sin agregación); tipología del lado de la fuente o a nivel de par; vectores de características tipológicas en lugar de genealogía. *Justificación:* la confiabilidad de la métrica está dominada por qué tan difícil es el idioma de *salida* de puntuar — la riqueza morfológica infla la falta de coincidencia de superficie para métricas de cadena, y la escasez de datos de entrenamiento degrada métricas aprendidas — ambas propiedades del destino. La familia es una clave cruda pero universalmente disponible (cada idioma en la base de datos de Champollion tiene una); las características tipológicas serían más finas pero faltan o se cuestionan para exactamente los idiomas de bajo recurso para los que existe esto. Las celdas por par se retienen en su totalidad, por lo que re-agregaciones más finas (por género, por tipo morfológico) pueden construirse a partir del artefacto sin re-importar.

**Correlación de nivel de segmento aplanada.** *Elegido:* Kendall τ-b sobre el vector (sistema, segmento) agrupado. *Alternativas:* precisión de pares agrupada por elemento con calibración de empate (el acc*-eq de hallazgos recientes de WMT); τ por segmento promediado entre segmentos. *Justificación:* la estadística aplanada es la opción más simple defendible, es exactamente reproducible de su definición sin un procedimiento de calibración de empate, y preserva la comparabilidad entre idiomas que este artefacto necesita. *No* es la estadística de titular más nueva de WMT, y §8 enumera eso como una limitación en lugar de pretender equivalencia.

**Los empates de métrica cuentan contra la métrica** en precisión de clasificación por pares. Una métrica que no puede separar dos sistemas que los humanos separan ha fallado en reproducir el ordenamiento humano; dar crédito parcial recompensaría la cuantización de puntuación.

**Medias ponderadas en el resumen.** Los agregados de familia pesan cada celda por su tamaño de muestra (sistemas a nivel sys, puntos a nivel seg), por lo que un par MQM de 17 sistemas cuenta más que un par DA de 6 sistemas. Los valores por celda sin ponderar permanecen disponibles.

**Umbrales.** Las celdas necesitan ≥3 sistemas alineados (una correlación sobre 2 puntos es sin sentido) o ≥10 puntos de segmento alineados sobre ≥2 sistemas. Estos son pisos contra aritmética degenerada, no afirmaciones de significancia — §8.

**Disciplina verbatim-ascendente.** Champollion no recalcula nada que pueda citar (excepto el carril chrF++ marcado), porque métricas aprendidas re-puntuadas introducirían versión y desviación de ambiente que los nombres ascendentes por celda existen para prevenir. El intercambio — brechas de cobertura donde una campaña no ejecutó una métrica — es visible como celdas faltantes en lugar de ser encubierto.

**Exclusiones honestamente fallidas.** Todo lo omitido (un conjunto de prueba sin juicios humanos, un código de idioma irresoluble, una celda degenerada) se escribe en un libro mayor de exclusiones con una razón. Un lector del artefacto puede enumerar lo que *no* está en él — la propiedad que la mayoría de reportes agregados carecen.

## 6. El artefacto publicado

La evidencia se envía como un archivo JSON legible por máquina, rastreado en el monorepo (deliberadamente no incluido en los paquetes npm/PyPI):

```
shared/catalogue/metric-reliability.json    # the artifact (≈0.6 MB)
shared/schemas/metric-reliability.schema.json  # its JSON-Schema contract
```

Compilación actual: **1,810 celdas** (1,052 preferidas) sobre **57 pares de idiomas**, **10 conjuntos de prueba**, **11 familias de destino**, con 21 exclusiones de libro mayor. Bloques de nivel superior: `sources` y `provenance` fijados (cada valor derivado lleva `champollion-derived` procedencia nombrando los ascendentes — las correlaciones son nuestras, los juicios no); `correlation_definitions` (las definiciones exactas de estadística de §2); `metrics` (id de registro ↔ nombres ascendentes); `languages` (código → familia/género); `families` (el resumen); `cells` (cada correlación, completamente atribuida); `excluded` (el libro mayor).

Tres superficies de consumidor lo leen hoy:

- **CLI del Arnés:** `mt-eval recommend SRC TGT` renderiza un bloque "confianza de métrica para el destino" junto con disponibilidad de método y resultados citados.
- **CLI de Champollion:** `champollion recommend SRC TGT` (mismo contrato de carga útil; el artefacto se rastrea en monorepo, por lo que las instalaciones empaquetadas se degradan a una nota explícita "índice no disponible").
- **Servidor MCP:** la herramienta `get_metric_reliability` responde "¿qué métrica debo confiar para el idioma X?" para cualquier agente de IA conectado, incluyendo una respuesta explícita UNMEASURED para idiomas que ninguna campaña de WMT ha juzgado.

## 7. Descripción general de resultados

Correlación de Pearson a nivel de sistema con el carril humano preferido, media ponderada por familia de destino (compilación actual; números a nivel de segmento, Spearman, τ-b y precisión de clasificación por pares están en el artefacto):

| Familia de destino | Pares | BLEU | spBLEU | chrF | chrF++ | COMET | MetricX |
|---|---|---|---|---|---|---|---|
| Afro-Asiático | 2 | +0.88 | +0.95 | +0.85 | +0.87 | +0.67 | **−0.62** |
| Dravídico | 1 | +0.88 | — | +0.94 | +0.93 | +0.94 | — |
| Esquimal-Aleutiano | 1 | **+0.16** | — | +0.35 | +0.33 | **+0.86** | — |
| Indoeuropeo | 42 | +0.75 | +0.76 | +0.79 | +0.76 | +0.81 | +0.84 |
| Japónico | 1 | +0.52 | +0.89 | +0.93 | +0.84 | +0.73 | +0.74 |
| Coreánico | 1 | +0.89 | +0.87 | +0.87 | +0.88 | +0.55 | +0.77 |
| Níger-Congo | 2 | +0.94 | — | +1.00 | +1.00 | +1.00 | — |
| Nilótico | 1 | — | — | — | +0.50 | — | **−0.09** |
| Sino-Tibetano | 2 | +0.49 | +0.68 | +0.68 | +0.62 | +0.72 | +0.82 |
| Túrquico | 1 | +0.85 | — | +0.97 | +0.97 | — | — |
| Urálico | 3 | +0.85 | +0.88 | +0.91 | +0.91 | +0.75 | +0.81 |

Cómo leer esto — y cómo no:

- **El patrón amplio coincide con los hallazgos agregados del campo.** En el volumen indoeuropeo de 42 pares, las métricas aprendidas lideran (MetricX +0.84, COMET +0.81) con chrF detrás y BLEU último — el resultado estándar de WMT, reproducido aquí de datos sin procesar como un ancla de cordura.
- **Las desviaciones por familia son la carga útil.** Para el inuktitut polisintético, las métricas de cadena colapsan y COMET es la única señal utilizable. Para Maasai y para English→Arabic en wmt25, MetricX se correlaciona *negativamente* mientras que las métricas de cadena permanecen serviciales — una métrica aprendida extrapolando más allá de su distribución de entrenamiento falla silenciosamente, con puntuaciones de aspecto confiado. Estos son precisamente los casos que un promedio global borra.
- **Las familias de un solo par son evidencia, no conclusiones.** Ocho de once familias descansan en uno o dos pares de una sola campaña. La lectura honesta de "Esquimal-Aleutiano: BLEU +0.16" es *"en la única campaña donde los humanos juzgaron en→iu, BLEU fue no informativo"* — una medición documentada, una bandera roja, y una razón para recopilar más, no una ley sobre la familia.
- **Una celda negativa no significa que la métrica esté rota en todas partes.** Significa: en ese par, en el grupo de sistemas de esa campaña, la métrica ordenó sistemas contra juicio humano. La restricción de rango (ver §8) puede deprimir cualquier correlación cuando los sistemas se agrupan estrechamente en calidad.

## 8. Limitaciones

Dicho claramente, porque el valor del artefacto es su honestidad:

1. **La familia es un proxy, no un mecanismo.** La familia genealógica se correlaciona con, pero no determina, las propiedades morfológicas que impulsan el comportamiento de la métrica. Las celdas por par (con género registrado por idioma) permiten corte más fino; la clave de familia es un predeterminado consultable, no una afirmación de causalidad tipológica.
2. **La cobertura es lo que WMT juzgó, no lo que el mundo habla.** 57 pares, fuertemente ponderados hacia Europa; cada par xx→English se enrolla en Indoeuropeo; familias macro completas (Algonquiano, Austronesia, Quechua, …) tienen *cobertura de juicio humano nula*. Para esos, las superficies de Champollion responden UNMEASURED en lugar de tomar prestado el número de un vecino. El programa de referencia soberana de Champollion — conjuntos de prueba controlados por la comunidad con validación de hablante nativo — es la solución a largo plazo para exactamente esta brecha.
3. **La transferencia dentro de la familia es una suposición.** Cuando un idioma consultado nunca fue juzgado directamente, la evidencia a nivel de familia viene de *otros* idiomas en la familia, y cada superficie de consumo lo dice explícitamente.
4. **Sin intervalos de confianza aún.** Las celdas llevan tamaños de muestra pero no intervalos de bootstrap; los agregados de familia de un solo par especialmente deben leerse con los anchos que §7 implica. Agregar CIs de bootstrap por celda (el arnés ya tiene la maquinaria para CIs de puntuación) es trabajo planeado.
5. **Restricción de rango.** Las correlaciones se calculan sobre los sistemas enviados de cada campaña. Las campañas recientes agrupan muchos sistemas fuertes estrechamente juntos, lo que deprime correlaciones para todas las métricas — parte de por qué las celdas derivadas de wmt25 (Maasai, Árabe) muestran valores extremos. La atribución por conjunto de prueba en cada celda mantiene esto inspectable.
6. **Opción de estadística a nivel de segmento.** El τ-b aplanado es simple y reproducible pero no es la precisión agrupada calibrada por empate de los documentos de hallazgos más recientes de WMT; los números aquí no deben compararse dígito por dígito contra esas publicaciones.
7. **Licencia de datos.** Los datos de juicio humano ascendentes no llevan declaración de licencia explícita (§3.1). Champollion no redistribuye ninguno de ellos, publica solo estadísticas derivadas con atribución completa, y mantiene este artefacto en un **carril de evidencia no comercial** (`license_lane.commercial_ok: false`) hasta que la postura se resuelva. Los carriles MQM además trazan a los lanzamientos de anotación Apache-2.0 de Google.
8. **El archivo es un objetivo móvil.** Se agregan nuevas campañas a la misma URL de tarball. Los pines identifican nuestra instantánea exactamente; la regeneración contra una instantánea más nueva es una nueva versión de artefacto con nuevos pines, nunca una actualización silenciosa.

## 9. Reproducción

El artefacto es regenerable de la fuente por cualquiera:

```bash
# 1. Fetch the archive (912 MB compressed; NOT immutable — keep the pins)
mkdir -p ~/.mt-eval/mt-metrics-eval && cd ~/.mt-eval/mt-metrics-eval
curl -sSL -D mt-metrics-eval-v2.headers -o mt-metrics-eval-v2.tgz \
     https://data.statmt.org/wmt26/mt-metrics-eval-v2.tgz
shasum -a 256 mt-metrics-eval-v2.tgz > mt-metrics-eval-v2.sha256
tar xzf mt-metrics-eval-v2.tgz

# 2. Regenerate (refuses to run without a checksum pin)
python3 arena/scripts/import_wmt_metaeval.py
```

Tenga en cuenta que el README del archivo en sí apunta a una URL storage.googleapis.com retirada; `data.statmt.org` es el host en vivo. El importador es biblioteca estándar Python pura (sacreBLEU solo para el carril chrF++ calculado); sus implementaciones de correlación se verifican cruzadas contra referencias de fuerza bruta en `arena/tests/test_wmt_metaeval.py`, y el contrato estructural del artefacto se aplica por su esquema JSON más pruebas de integridad en ambos tiempos de ejecución.

## 10. Créditos y citación

Los juicios humanos resumidos aquí son el trabajo de los **organizadores y anotadores de la tarea compartida de Métricas de WMT** — incluyendo Markus Freitag, Nitika Mathur, Tom Kocmi, y muchos colaboradores en las campañas 2019–2025 — y del **programa de anotación MQM de Google** (Freitag et al., *Experts, Errors, and Context*, TACL 2021; `google/wmt-mqm-human-evaluation`). El archivo y conjunto de herramientas se mantienen como `google-research/mt-metrics-eval`. La precisión de clasificación por pares sigue a Kocmi, Federmann et al. (2021), *To Ship or Not to Ship*. La contribución de Champollion es la organización por familia de idioma por idioma, el cálculo de correlación, y el andamiaje de honestidad alrededor de él — cada número en el artefacto lleva `champollion-derived` procedencia nombrando el ascendente del que se deriva, y ninguno de su texto, juicios o puntuaciones se redistribuye.

Al citar números de confiabilidad de este artefacto, cite tanto la(s) campaña(s) de WMT que las celdas atribuyen como la versión del artefacto de Champollion (el bloque `sources` lleva los pines de datos exactos), y respete el carril de evidencia no comercial descrito en §8.
