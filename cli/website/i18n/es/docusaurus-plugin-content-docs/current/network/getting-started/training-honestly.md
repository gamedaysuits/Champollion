---
sidebar_position: 2
title: "Entrenar un Modelo con Honestidad (nmt-forge)"
related:
  - label: "Build MT for Your Language"
    to: /docs/build-mt-for-your-language
    kind: guide
    note: "The whole journey; training is its step 4"
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

**La versión de 30 segundos:** la mayoría de las «mejoras» en TA para idiomas de bajos recursos se desmoronan al reexaminarse: el conjunto de prueba se filtró en el entrenamiento, el conjunto de prueba eligió el checkpoint, o la ganancia no era más que ruido sin barras de error. **nmt-forge** es una suite de entrenamiento que hace que esos errores sean estructuralmente difíciles de cometer: sus rutas normales hacen lo correcto y las incorrectas se rehúsan con un mensaje que indica *qué* ocurrió, *por qué* corrompe los resultados y la *solución* exacta. Se encarga del entrenamiento; el [arnés de evaluación](/docs/network/specifications/harness) puntúa. Cada protección implementada en ella mecaniza un error que efectivamente cometimos, medimos y documentamos al crear la traducción para el cree de las llanuras. Se instala con `python3 -m pip install 'nmt-forge[hf]'` y su modelo predeterminado se entrena en la CPU de una computadora portátil.

```bash
$ nmt-forge score --eval-set textbook-test --hyps decoded.txt

[preregister] no preregistration for eval set 'textbook-test' at its current content hash
  why: results looked at without written-down expectations become
       post-hoc stories; ...
  fix: write one FIRST: ... — then score
```

Esa es toda la personalidad de la suite en un rechazo.

## La historia de cinco minutos

Aquí está el fallo del que nació la suite. Un libro de texto de Cree mapea muchos ejercicios en inglés a un objetivo: *"Feed him"* y *"Feed her"* se traducen ambos a `asam`. Una división aleatoria estándar puso una copia en entrenamiento y su gemela en el conjunto de prueba — así que el modelo había visto literalmente 17 de 54 respuestas de "prueba", y esas filas puntuaron 83 chrF++ contra 44 para las limpias. Todo lo posterior (el modelo "campeón", los hallazgos construidos sobre él) tuvo que ser descartado.

El divisor de nmt-forge hace eso imposible **por construcción**: los pares que comparten una fuente *o* un objetivo se agrupan, los grupos completos caen en un lado, y una verificación de cero superposición se ejecuta después de cada corte:

```bash
$ nmt-forge split corpus.jsonl --test 150 --dev 42 --seed 42 \
      --out data/split --register textbook
split corpus.jsonl: 1240 rows in 1187 share-groups (largest 4)
  train 1048 · dev 42 · test 150  → data/split/
  verified: 0 shared canonical source/target keys across sides
```

(Si su conjunto de prueba ya es un archivo separado y registrado —un conjunto verificado por docentes que usted mantiene privado—, `--test 0` solo extrae train y dev).

Todas las demás protecciones tienen la misma estructura: un error real, eliminado de forma mecanizada. En conjunto, constituyen las **barreras de seguridad del entrenamiento**: léalas antes de dividir (`nmt-forge init` y `nmt-forge status` apuntan aquí en ese paso; los agentes obtienen las mismas reglas, junto con el error medido detrás de cada una, desde la herramienta MCP `get_training_guardrails`).

| protección | el error que elimina |
|---|---|
| **split-guard** | respuestas de prueba ocultas en el entrenamiento mediante fuentes u objetivos compartidos |
| **dev-fence** | que el conjunto de prueba elija su checkpoint (el entrenamiento se rehúsa a iniciar sin un conjunto dev registrado) |
| **leak-audit** | entrenar con texto de evaluación: un prompt idéntico (incluso con una traducción diferente), una respuesta idéntica o casi duplicada, o el archivo completo. También indica qué *conserva* a propósito y por qué: las variantes de plantillas que cambian una sola palabra (*"I see the dog"* / *"I see the cat"*) son práctica, no la respuesta, y se reportan, no se eliminan —a menos que cada fila de prueba tenga una, en cuyo caso `--clean-to … --drop-test-twins` elimina los gemelos de entrenamiento de un conjunto de prueba fijo. Determinista: mismo corpus, mismo resultado |
| **funnel-audit** | desgaste silencioso en el pipeline (en una ocasión, un carácter ortográfico eliminó de forma invisible 1375 verbos del diccionario durante semanas) |
| **convention-lint** | entrenar con convenciones ortográficas mixtas (el modelo luego las mezcla a mitad de la oración) |
| **coverage-map** | un millón de pares sintéticos sin imperativos, sin preguntas, sin posesión: volumen que oculta brechas estructurales |
| **sample-strata** | dos tipos de plantilla acaparando la mitad de la señal de entrenamiento |
| **ci-scoring** | puntuaciones sin barras de error (cada número se muestra con su IC bootstrap del 95 %; no hay salida de puntuación aislada) |
| **schedule-sanity** | que la parada temprana (early stopping) mate una ejecución con abundantes datos sintéticos a mitad de una época: con un 97 % de datos sintéticos y un conjunto dev *real* y honesto, la pérdida en dev toca fondo pronto y comienza a subir; eso es el modelo ajustándose a la masa sintética, no convergencia. El umbral mínimo de parada se deriva de su mezcla automáticamente, y cada intervención se explica a sí misma con la trayectoria de la pérdida en dev. Esto se descubrió *gracias a* un protocolo limpio: las configuraciones honestas sacan a la luz errores reales |
| **eval-ledger** | uso adaptativo invisible de los datos de evaluación (cada lectura se registra; los conjuntos sellados son de un solo uso) |
| **preregister** | posdicciones disfrazadas de predicciones (sin prerregistro → no hay puntuación de prueba ni tabla de comparación; un único formato de predicciones, un arreglo JSON: `nmt-forge prereg template` genera uno para editar) |
| **score caveats** | citar una puntuación con salvedades emitidas por el arnés de evaluación: una *salida casi constante* (una de pocas oraciones devuelta ante muchas entradas distintas: las salidas no corresponden a las entradas), salidas mucho más largas o cortas que las referencias, copias de la fuente. forge no calcula nada de esto; transmite cada advertencia que redactó el arnés, con las palabras del arnés, junto a la puntuación —en el resumen de exportación, `forge-model.json`, `DEPLOY.md`, `status`, `report`, `compare` y `lint`— y nunca ofrece una puntuación con salvedades como "el número a citar" sin su correspondiente advertencia |

## Cualquier idioma, cualquier activo — comience desde la tarjeta

nmt-forge es una herramienta única para los ~8700 idiomas en el índice de Champollion, y comienza consultando al índice qué tiene realmente un idioma:

```bash
$ nmt-forge discover nav        # Navajo — a sparse card
  ✓ rung 1: parallel text → train with every guard (no pack needed)
  ? rung 2: monolingual text → the tagged backtranslation lane
  ? rung 4: morphological analyzer → round-trip-VERIFIED synthesis
  note: no analyzer on the card → synthesis is off the menu until one
  exists; every guard and the training loop work regardless
```

Las marcas `?` son la herramienta siendo honesta: la ausencia en una tarjeta significa **desconocido**, nunca "este idioma no tiene nada". Cada idioma sube la misma **escalera de activos** — (1) solo texto paralelo ya obtiene el bucle de entrenamiento completamente protegido; (2) el texto monolingüe agrega retrotraducción; (3) un diccionario más una gramática publicada hace que un paquete de plantilla citado valga la pena construir; (4) un analizador morfológico desbloquea síntesis verificada; (5) un árbitro LYSS pone la métrica propia del idioma en la calificación y selección de puntos de control. Una tarjeta rica (Cree de las Llanuras) conecta los peldaños 4–5 automáticamente — los conjuntos de evaluación llegan marcados `NEVER TRAIN ON THIS`, y los carriles de complemento del árbitro están listos para pegar.

Luego, `nmt-forge init <code>` genera la estructura de un proyecto a partir de la ficha: un espacio de trabajo, una configuración inicial y un informe `NEXT_STEPS.md` redactado para usted *y su agente* con el orden exacto de los comandos. Funciona a partir de un simple `pip install` —las fichas se leen desde un directorio que usted indique, una copia local o el índice público de fichas (almacenado en caché para uso sin conexión)—, y un idioma que aún no tenga ficha también obtiene un proyecto (`--no-card --name "<name>"`), donde cada dato de la ficha se registra como desconocido en lugar de inventarse.

## Desde una laptop hasta un modelo en servicio

El ciclo honesto no necesita una GPU. `init` escribe uno de los tres ajustes predefinidos de modelo en la configuración, como números explícitos:

| ajuste predefinido | requisitos | qué esperar |
|---|---|---|
| `cpu-tiny` (predeterminado) — un pequeño transformer entrenado desde cero, vocabulario aprendido únicamente de sus filas de entrenamiento | una CPU de laptop, sin descargas | débil por diseño: con 1 a 2 mil pares, chrF++ aproximadamente entre 5 y 30; frases y patrones de sus datos, no traducción general |
| `cpu-finetune --base <hf-id>` — un modelo pequeño preentrenado Marian/opus-mt que usted especifique, para un par relacionado | una CPU, descarga de ~300 MB | habitualmente mejor que `cpu-tiny` cuando existe un par relacionado; compruébelo midiéndolo |
| `nllb-600m` — NLLB-200 distilled 600M con LoRA | una GPU | el punto de partida más sólido |

`cpu-tiny` está allí para hacer que *todo* el ciclo sea real desde el primer día: la barrera, las auditorías, la prueba prerregistrada, un modelo al que el CLI pueda llamar; de modo que más adelante pueda incorporarse un modelo mejor en el mismo proyecto y medirse exactamente de la misma forma. Después del entrenamiento, dos comandos completan el trabajo:

```bash
nmt-forge export .forge/runs/<run>/run-manifest.json --prereg <id> --out export/
nmt-forge serve export/model     # http://127.0.0.1:8378
```

`export` puntúa el conjunto de prueba una sola vez (se requiere prerregistro, intervalos de confianza del 95 %; `--prereg <id>` indica el prerregistro generado para este modelo con `nmt-forge prereg new <id>` —con dos modelos evaluados sobre un mismo conjunto de prueba, cada uno juzgado por el suyo propio, export se rehúsa a adivinar—), escribe el resultado como un informe de mt-eval que `mt-eval compare` puede leer, y empaqueta un modelo autónomo con un manifiesto de plugin de champollion y un `DEPLOY.md`. `serve` implementa el contrato api-method de champollion y un endpoint compatible con OpenAI, de modo que `champollion sync --method local` pueda traducir con él; solo escucha en localhost a menos que usted le proporcione un token. Cada comando acepta `--json` para agentes (un documento JSON en stdout; los rechazos como `{"error": {…, "why", "fix"}}`, salida 2). La guía paso a paso completa es [Entrene su primer modelo](/docs/network/getting-started/train-your-first-model); una vez que tenga algo digno de evaluarse, [Enviar un método](/docs/network/getting-started/submit-a-method) lo transforma en una entrada de la Network.

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

- **¿Es nuevo con el vocabulario?** [Entrenamiento de TA en lenguaje sencillo](/docs/network/context/mt-training-concepts) define cada término —datos de entrenamiento vs. de evaluación, pérdida vs. decodificación, filtración (leakage), chrF++, retrotraducción, la meseta— con un ejemplo práctico desarrollado, redactado sin asumir conocimientos previos.
- **¿Listo para construir?** [Así que desea entrenar su propio modelo](/docs/network/tutorials/train-your-own-model) es la guía paso a paso orientada a agentes: elija un idioma → reúna datos → sintetice → divida → entrene → evalúe → itere → ponga en servicio y envíe, mostrando cómo cada barrera de seguridad detecta su respectivo error. [Crear TA para su idioma](/docs/build-mt-for-your-language) sitúa el entrenamiento en el contexto de todo el recorrido: descubrir qué existe, medir las opciones, implementar.
- **Entrene y luego envíe:** un modelo entrenado de forma honesta se convierte en una entrada de la Network mediante [Enviar un método](/docs/network/getting-started/submit-a-method).
- **Las barras de error:** [Pruebas de significancia estadística](/docs/network/specifications/significance) detalla las matemáticas que forge aplica de manera predeterminada.
- **En qué métrica confiar:** consulte [Confiabilidad de las métricas](/docs/network/specifications/metric-reliability) antes de seleccionar checkpoints basándose en cualquier métrica automática.
- **Cada comando y opción:** la [Referencia de comandos de forge](/docs/network/getting-started/forge-command-reference), generada a partir de la propia herramienta.
- **La taxonomía de fallos** —cada error, un ejemplo concreto y la protección que lo detecta— se incluye con el código fuente de nmt-forge. Los agentes obtienen el mismo conjunto de reglas a partir de la herramienta `get_training_guardrails` del servidor MCP (`topic` opcional), y cada rechazo incluye su correspondiente qué/por qué/solución.
