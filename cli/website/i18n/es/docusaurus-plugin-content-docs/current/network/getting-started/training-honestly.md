---
sidebar_position: 2
title: "Entrenar un Modelo con Honestidad (nmt-forge)"
related:
  - label: "MT Training in Plain Language"
    to: /docs/network/context/mt-training-concepts
    kind: doc
    note: "Zero-background glossary — read this if the vocabulary is new"
  - label: "So You Want to Train Your Own Model"
    to: /docs/network/tutorials/train-your-own-model
    kind: tutorial
    note: "The hands-on, agent-forward walkthrough"
  - label: "Submit a Method"
    to: /docs/network/getting-started/submit-a-method
    kind: guide
    note: "Where an honestly-trained model goes next"
  - label: "Statistical Significance Testing"
    to: /docs/network/specifications/significance
    kind: spec
    note: "The math behind the error bars forge insists on"
  - label: "Benchmark Specification"
    to: /docs/network/specifications/benchmark
    kind: spec
  - label: "Metric Reliability Specification"
    to: /docs/network/specifications/metric-reliability
    kind: spec
    note: "Know which metric to believe before you select checkpoints on it"
---

# Entrenar un Modelo Honestamente (nmt-forge)

**La versión de 30 segundos:** la mayoría de las "mejoras" en traducción automática para idiomas con pocos recursos no resisten el reexamen — el conjunto de prueba se filtró hacia el entrenamiento, el conjunto de prueba eligió el punto de control, o la ganancia fue ruido sin intervalos de confianza. **nmt-forge** es una suite de entrenamiento que hace que esos errores sean estructuralmente difíciles de cometer: sus caminos normales hacen lo correcto, y los caminos incorrectos se niegan con un mensaje que dice *qué* sucedió, *por qué* corrompe los resultados, y la *solución* exacta. Entrena; el [arnés de evaluación](/docs/network/specifications/harness) califica. Cada guardia en él mecaniza un error que realmente cometimos, medimos y documentamos mientras construíamos la traducción al Cree de las Llanuras.

```bash
$ nmt-forge score --eval-set textbook-test --hyps decoded.txt

[preregister] no preregistration for eval set 'textbook-test'
  why: results looked at without written-down expectations become
       post-hoc stories
  fix: write one FIRST: nmt-forge prereg new ... — then score
```

Esa es toda la personalidad de la suite en un rechazo.

## La historia de cinco minutos

Aquí está el fallo del que nació la suite. Un libro de texto de Cree mapea muchos ejercicios en inglés a un objetivo: *"Feed him"* y *"Feed her"* se traducen ambos a `asam`. Una división aleatoria estándar puso una copia en entrenamiento y su gemela en el conjunto de prueba — así que el modelo había visto literalmente 17 de 54 respuestas de "prueba", y esas filas puntuaron 83 chrF++ contra 44 para las limpias. Todo lo posterior (el modelo "campeón", los hallazgos construidos sobre él) tuvo que ser descartado.

El divisor de nmt-forge hace eso imposible **por construcción**: los pares que comparten una fuente *o* un objetivo se agrupan, los grupos completos caen en un lado, y una verificación de cero superposición se ejecuta después de cada corte:

```bash
$ nmt-forge split corpus.jsonl --test 150 --dev 42 --seed 42 \
      --out data/split --register textbook
{"verified": "0 shared canonical source/target keys across sides", ...}
```

Cada otra guardia tiene la misma forma — un error real, mecanizado:

| guardia | el error que elimina |
|---|---|
| **split-guard** | respuestas de prueba ocultas en entrenamiento mediante fuentes/objetivos compartidos |
| **dev-fence** | el conjunto de prueba eligiendo su punto de control (el entrenamiento se niega a comenzar sin un conjunto de desarrollo registrado) |
| **leak-audit** | entrenar con texto de evaluación — exacto, reformulado (Jaccard), o el archivo completo |
| **funnel-audit** | atenuación silenciosa de la tubería (un carácter de ortografía una vez eliminó 1.375 verbos de diccionario, invisiblemente, durante semanas) |
| **convention-lint** | entrenar con convenciones de ortografía mixtas (el modelo luego las mezcla a mitad de la oración) |
| **coverage-map** | un millón de pares sintéticos sin imperativos, sin preguntas, sin posesión — volumen ocultando brechas estructurales |
| **sample-strata** | dos tipos de plantilla acaparando la mitad de la señal de entrenamiento |
| **ci-scoring** | puntuaciones sin intervalos de confianza (cada número se representa con su IC de arranque del 95% — no hay salida de puntuación desnuda) |
| **schedule-sanity** | la parada temprana matando una ejecución con mucho sintético en media época: con 97% de datos sintéticos y un conjunto de desarrollo *real* honesto, la pérdida de desarrollo toca fondo temprano y se desvía hacia arriba — eso es el modelo ajustándose a la masa sintética, no convergencia. El piso de parada se deriva de su mezcla automáticamente, y cada intervención se explica a sí misma con la trayectoria de pérdida de desarrollo. Este fue encontrado *por* un protocolo limpio — las configuraciones honestas exponen errores reales |
| **eval-ledger** | uso adaptativo invisible de datos de evaluación (cada lectura se registra; los conjuntos sellados son de un solo uso) |
| **preregister** | predicciones disfrazadas de predicciones (sin preregistro → sin tabla de comparación) |

## Cualquier idioma, cualquier activo — comience desde la tarjeta

nmt-forge es una herramienta para los ~8,700 idiomas en el índice de Champollion, y
comienza preguntándole al índice qué tiene realmente un idioma:

```bash
$ nmt-forge discover nav        # Navajo — a sparse card
  ✓ rung 1: parallel text → train with every guard (no pack needed)
  ? rung 2: monolingual text → the tagged backtranslation lane
  ? rung 4: morphological analyzer → round-trip-VERIFIED synthesis
  note: no analyzer on the card → synthesis is off the menu until one
  exists; every guard and the training loop work regardless
```

Las marcas `?` son la herramienta siendo honesta: la ausencia en una tarjeta significa **desconocido**, nunca "este idioma no tiene nada". Cada idioma sube la misma **escalera de activos** — (1) solo texto paralelo ya obtiene el bucle de entrenamiento completamente protegido; (2) el texto monolingüe agrega retrotraducción; (3) un diccionario más una gramática publicada hace que un paquete de plantilla citado valga la pena construir; (4) un analizador morfológico desbloquea síntesis verificada; (5) un árbitro LYSS pone la métrica propia del idioma en la calificación y selección de puntos de control. Una tarjeta rica (Cree de las Llanuras) conecta los peldaños 4–5 automáticamente — los conjuntos de evaluación llegan marcados `NEVER TRAIN ON THIS`, y los carriles de complemento del árbitro están listos para pegar.

`nmt-forge init <code>` luego estructura un proyecto desde la tarjeta: un espacio de trabajo, una configuración inicial, y un resumen `NEXT_STEPS.md` escrito para usted *y su agente* — terminando en [Enviar un Método](/docs/network/getting-started/submit-a-method) una vez que tenga algo que valga la pena probar.

## Datos sintéticos que puede defender

Para idiomas con analizadores morfológicos (FST), forge fabrica datos de entrenamiento a través de **paquetes de idioma** — e impone una *ley de emisión* de la que ningún paquete puede optar: cada palabra generada debe hacer un viaje de ida y vuelta a través del analizador (generar → analizar → mismo análisis), cada plantilla cita la gramática publicada que transcribe, cada filtro de plausibilidad se nombra y se cuenta, y cada fila se marca `synthetic: true`. Esa marca es crítica: el registro **se niega a filas sintéticas en conjuntos de prueba**. Las pruebas son solo datos reales.

forge en sí no envía paquetes de idioma — es una herramienta de propósito general. Los paquetes viven con sus idiomas y se conectan por ruta de módulo o punto de entrada (el paquete de Cree de las Llanuras vive en el proyecto crk-translate):

```bash
nmt-forge synth nmt_forge_crk.pack:get_pack --out data/synth.jsonl
```

Los analizadores y diccionarios permanecen separados, herramientas obtenidas por el usuario bajo sus propias licencias — nunca agrupadas, nunca redistribuidas.

## El árbitro propio de su idioma, en el bucle

Los estándares de evaluación LYSS (linters por idioma que saben, por ejemplo, que dos ortografías de Cree difieren solo por una convención de vocal larga documentada) se conectan en cada superficie de calificación — y en la selección de puntos de control, así que el modelo que gana es el que *el árbitro del idioma* prefiere, no solo chrF++:

```bash
nmt-forge score --eval-set textbook-test --hyps decoded.txt \
    --plugin champollion_lyss.crk.metrics:CrkLinterMetric

  chrf++                            46.02  [43.11, 48.87] 95% CI
  crk_linter:equivalent_match_rate   0.31  [ 0.24,  0.38] 95% CI
```

Cada número de complemento obtiene un intervalo de confianza; un árbitro cuyos requisitos previos faltan reporta *no disponible* en lugar de una puntuación fabricada.

Lo mismo es cierto para la **pila de métrica completa del arnés** — nmt-forge habla todo lo que el [arnés de evaluación](/docs/network/specifications/harness) habla, incluyendo las métricas neurales (COMET, COMET-QE, MetricX), con inferencia ejecutada una vez e intervalos de confianza arrancados desde puntuaciones por entrada en caché. Antes de seleccionar puntos de control en cualquier métrica automática, `discover` muestra la [confiabilidad medida](/docs/network/specifications/metric-reliability) de cada métrica para su familia de idiomas — para Inuktitut, BLEU apenas rastrea el juicio humano (r=0,16) mientras que COMET lo hace (r=0,86); para la mayoría de familias de bajo recurso la respuesta honesta es *no medida*. La herramienta le dice qué número creer antes de que optimice hacia él.

## Dónde profundizar

- **¿Nuevo en el vocabulario?** [Entrenamiento de TA en Lenguaje Plano](/docs/network/context/mt-training-concepts) define cada término — datos de entrenamiento vs. evaluación, pérdida vs. decodificación, filtración, chrF++, retrotraducción, la meseta — con un ejemplo trabajado, escrito para cero antecedentes.
- **¿Listo para construir?** [Así que Quiere Entrenar Su Propio Modelo](/docs/network/tutorials/train-your-own-model) es el recorrido paso a paso orientado al agente: elija un idioma → recopile datos → sintetice → divida → entrene → evalúe → itere → envíe, con cada barrera de protección mostrada atrapando su error.
- **Entrene, luego envíe:** un modelo entrenado honestamente se convierte en una entrada de Red a través de [Enviar un Método](/docs/network/getting-started/submit-a-method).
- **Los intervalos de confianza:** [Prueba de Significancia Estadística](/docs/network/specifications/significance) es la matemática que forge aplica por defecto.
- **Qué métrica confiar:** consulte [Confiabilidad de Métrica](/docs/network/specifications/metric-reliability) antes de seleccionar puntos de control en cualquier métrica automática.
- **El diseño completo** — la historia medida de cada guardia, la interfaz del paquete, los valores predeterminados del bucle de entrenamiento — vive con el código en el repositorio (`forge/DESIGN.md`).
