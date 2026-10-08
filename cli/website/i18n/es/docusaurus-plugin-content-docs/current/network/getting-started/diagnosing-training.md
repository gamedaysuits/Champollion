---
sidebar_position: 4
title: "Diagnóstico de una ejecución de entrenamiento"
description: "Solución de problemas basada en síntomas para entrenamiento de MT con recursos limitados — comience por lo que está observando, identifique la causa probable y encuentre la palanca de configuración que lo soluciona."
related:
  - label: "Build MT for Your Language"
    to: /docs/build-mt-for-your-language
    kind: guide
  - label: "Train Your First Model (with your agent)"
    to: /docs/network/getting-started/train-your-first-model
    kind: guide
  - label: "Train a Model Honestly"
    to: /docs/network/getting-started/training-honestly
    kind: guide
  - label: "forge Command Reference"
    to: /docs/network/getting-started/forge-command-reference
    kind: reference
---

# Diagnóstico de una ejecución de entrenamiento

Su modelo se entrenó. Los números no son lo que esperaba. Esta página parte de
**lo que usted está viendo** y le guía hacia la causa probable y la herramienta de forge que
lo soluciona. La mayoría de estos procesos son automáticos: `nmt-forge export` (y su mitad
exclusiva de puntuación, `nmt-forge evaluate`) añade una sección de **Diagnóstico y recomendaciones**
que nombra el hallazgo y la palanca de acción; esta guía es la versión en lenguaje sencillo,
además de las pocas cosas sobre las que forge solo puede *advertir* (marcadas con ⚠ **preste atención a esto**).

Dígale a su agente: *"Ejecute `nmt-forge lint <battery-manifest.json> --json` y actúe según
el hallazgo de mayor gravedad"*. Después de una exportación, el manifiesto de la batería es
`export/evaluation/battery-hyps-battery.json`. Luego, compare lo que reporta con las
secciones siguientes.

---

## "La puntuación del modelo predeterminado es baja"

Usted entrenó con el ajuste predeterminado `cpu-tiny` y la puntuación de prueba está en algún punto
entre 5 y 30 chrF++.

**Qué está pasando:** eso es lo que hace este ajuste predeterminado. Es un transformer pequeño
entrenado desde cero únicamente con sus pares, por lo que con 1 o 2 mil pares aprende
las frases y los patrones de oraciones de sus datos, no el idioma en general; el
extremo superior de ese rango solo aparece cuando los datos tienen muchas plantillas. Su función es
hacer real todo el ciclo (conjunto de dev delimitado, datos auditados, prueba prerregistrada, un modelo
al que la CLI pueda llamar), no ser el modelo que usted lance a producción.

**Solución:** cambie una sola cosa y mídala en el conjunto de dev, en orden aproximado de
beneficio:

1. **Más pares reales.** Con este tamaño, los datos superan a cualquier configuración.
2. **Un punto de partida preentrenado.** `nmt-forge init <code> --model cpu-finetune --base
   <hf-id>` ajusta finamente un modelo pequeño Marian/opus-mt preentrenado en una CPU; elija
   uno para un par de idiomas *relacionado* y compárelo con `cpu-tiny` en dev
   en lugar de asumir que ganará. `--model nllb-600m` es el punto de partida más sólido
   y requiere una GPU.
3. **Más datos a partir de lo que ya tiene**: retrotraducción (backtranslation) de texto monolingüe o
   síntesis verificada si su idioma cuenta con un analizador (consulte
   [Así que quiere entrenar su propio modelo](/docs/network/tutorials/train-your-own-model)).

⚠ **preste atención a esto:** una puntuación alta de `cpu-tiny` merece sospecha antes
de celebrarse; consulte ["La puntuación parece demasiado buena"](#the-score-looks-too-good).

---

## "Excelente en mis ejemplos de libro de texto, terrible en oraciones reales"

**La trampa más común en recursos bajos.** Sus datos sintéticos/basados en plantillas
obtienen puntuaciones hermosas; el texto real se desmorona.

**Lo que está sucediendo:** una **meseta de transferencia**. Durante el entrenamiento, la pérdida en su
conjunto de desarrollo real se estancó temprano y luego aumentó mientras la pérdida de entrenamiento continuó
cayendo — el modelo estaba dominando la *masa* sintética, no aprendiendo a
traducir. Más datos sintéticos **no** ayudarán.

**Hallazgo de forge:** `R7-transfer-plateau` (del relato de cronograma del manifiesto de ejecución).
**Palanca: REAL-DATA.**

**Solución:** agregue texto real. Retrotraduza datos monolingües en idioma de destino
(`nmt_forge.training.backtranslation`), o adquiera oraciones paralelas reales.
El volumen de datos sintéticos no es la palanca — la variedad de datos *reales* lo es.

⚠ **tenga cuidado con esto:** si su mezcla es ~99% sintética contra un pequeño conjunto de desarrollo real,
está en riesgo de esto *antes* de verlo en las puntuaciones. Aún no hay un lint previo al vuelo
para una proporción patológica — verifique los recuentos de oro/sintéticos en su manifiesto de mezcla.

---

## "Un registro es mucho peor que los otros"

Mire la tabla por registro. Un único registro (digamos, gobierno o legal) está
muy por debajo del resto.

**Dos causas diferentes — el diagnóstico las distingue observando *cobertura*
y si los resultados están *incompletos*:**

- **Al modelo le faltan las palabras** (`R1-vocabulary-gap`: cobertura baja **y** tasa alta
  de incompletitud). **Palanca: VOCABULARY.** Amplíe el léxico (diccionario /
  recolección de atestiguación), luego ejecute `nmt-forge` contabilidad de embudo para confirmar que las nuevas
  entradas realmente llegan al corpus — una discrepancia de ortografía de un carácter ha
  eliminado silenciosamente miles de palabras antes.
- **El modelo tiene las palabras pero no las formas de oración** (`R2-structure-gap`:
  cobertura OK, aún incompleto). **Palanca: STRUCTURE.** Ejecute el mapa de cobertura
  contra su lista de verificación de gramática y agregue las construcciones faltantes
  (imperativos, preguntas con wh-, posesión, inverso — lo que sus plantillas nunca
  pidieron).

---

## "Los resultados mezclan ortografías dentro de una oración"

El modelo escribe el mismo sonido de dos formas, a veces en una oración.

**Lo que está sucediendo:** sus objetivos de entrenamiento le enseñaron que las convenciones
son intercambiables — el corpus contenía el mismo contenido en múltiples
ortografías.

**Hallazgo de forge:** `R3-mixed-convention`. **Palanca: ORTHOGRAPHY.**

**Solución:** `convention-lint` el corpus, normalice a **una** convención
canónica en el límite de datos, y reentrenar. Mantenga una tasa de convención mixta en su batería
para que pueda verla disminuir.

---

## "El modelo B supera al modelo A — pero solo por poco"

Comparó dos modelos y uno está adelante por una fracción de punto.

**Lo que está sucediendo:** la diferencia puede ser menor que el ruido. En 80
oraciones, una brecha de 0.4 chrF++ es un lanzamiento de moneda.

**Hallazgo de forge:** `R5-low-power` (el intervalo de confianza es más amplio que el
delta). **Palanca: MEASUREMENT.**

**Solución:** no actúe sobre deltas más pequeños que el IC. Amplíe el conjunto de evaluación para ese
registro, o use `nmt-forge compare` que reporta una prueba de significancia
*pareada* en lugar de dos intervalos superpuestos. forge nunca renderiza una puntuación simple — el
intervalo siempre está ahí precisamente para que pueda ver esto.

⚠ **tenga cuidado con esto:** un resultado de una **única semilla** no lleva
banda de varianza entre semillas. Una ganancia que no sobrevive a la re-siembra no es real.
Si una decisión importa, re-ejecute con 2–3 semillas.

---

## "La puntuación se ve demasiado bien"

Sospechosamente alta, especialmente temprano o con pocos datos. Confíe en la sospecha.

**Verifique, en orden:**

1. **Filtración (leakage).** `nmt-forge leak-audit <corpus>`: ¿terminó una oración de prueba en el
   entrenamiento? Descarta filas cuyo prompt sea idéntico a un prompt de prueba (incluso con
   una traducción diferente), filas cuya respuesta sea idéntica a una respuesta de prueba,
   y filas que contengan, sean un fragmento de, o sean ≥90% idénticas a una respuesta de
   prueba. `nmt-forge run` rechaza filas de entrenamiento que se filtren en un conjunto de
   prueba registrado o sellado, por lo que esto importa principalmente para datos o un pipeline fuera
   de forge, o un conjunto de prueba que nunca registró.
2. **Selección del punto de control (checkpoint).** ¿Se eligió el punto de control en un **conjunto de dev delimitado**,
   y no en el conjunto de prueba? forge se rehúsa a entrenar sin un conjunto de dev precisamente para evitar
   esto, pero un pipeline artesanal no lo hará.
3. **Optimismo por casi gemelos.** `R4-optimism-bound`: si la puntuación de la batería "full"
   está varios puntos por encima de la puntuación "strict", la diferencia se debe al optimismo
   por hermanos de plantilla (drill-siblings). `leak-audit` *conserva* hermanos de plantilla a propósito (*"I see the
   dog"* en entrenamiento, *"I see the cat"* en el conjunto de prueba) y lista las filas de prueba
   que tienen uno; con `eval.near_dupe_corpus` configurado en su archivo de entrenamiento (la
   configuración inicial hace esto), el informe califica por separado las filas de prueba *sin* un
   hermano, marcadas como "(strict)". **Cite el número estricto** para cualquier
   afirmación sobre generalización. Si *cada* fila de prueba tiene un hermano (`R4-recall-not-translation`:
   el subconjunto estricto está vacío, por lo que la puntuación mide la memorización de frases
   de entrenamiento), y el conjunto de prueba es fijo, escriba un corpus libre de gemelos en su propio
   archivo con `nmt-forge leak-audit <train> --clean-to <train>.notwins.jsonl
   --drop-test-twins` y entrene un segundo modelo libre de gemelos en él (leak-audit
   no sobreescribirá el archivo en el que entrena el primer modelo), o consiga oraciones de prueba
   escritas independientemente de las plantillas de entrenamiento.
4. **Las salidas no siguen a las entradas.** `R9-harness-score-caveat`: el
   informe de mt-eval indica que la puntuación tiene reservas; la mayoría de las veces una **salida casi constante**:
   muchas oraciones de prueba diferentes obtuvieron las mismas pocas salidas (un
   modelo de hospital respondió 150 oraciones diferentes con 9 salidas; aun así
   obtuvo una puntuación chrF++ de 48, porque una frase común comparte muchos caracteres con
   muchas referencias). El modelo libre de gemelos suele ser el sospechoso habitual: al haber eliminado
   sus plantillas de entrenamiento, un modelo pequeño puede recurrir a sus oraciones más
   frecuentes. forge transmite esta salvedad en las palabras del harness:
   en el resumen de exportación, `DEPLOY.md`, `status`, `report`, `compare` y
   `lint`, y nunca considera dicha puntuación como "el número a citar" sin ella.
   Lea algunas de las salidas (`<export>/evaluation/battery-hyps.jsonl`, en
   la máquina que contiene el conjunto de prueba) antes de reportar la puntuación como
   calidad de traducción; contar con más pares de entrenamiento reales y variados es la palanca de acción.

---

## "El entrenamiento se detuvo casi inmediatamente"

La ejecución terminó después de unos pocos cientos de pasos; el modelo apenas vio sus datos.

**Lo que está sucediendo:** la detención temprana confundió el tambaleo esperado del conjunto de desarrollo
pesado en sintético con convergencia.

**Comportamiento de forge:** esto se *previene* de forma predeterminada: `nmt-forge run` deriva un
**límite inferior (floor)** de detención a partir de su mezcla y suprime las detenciones tempranas por debajo de este, registrando la
razón en las líneas de `[schedule-sanity]`. La frecuencia con la que se evalúa el conjunto de dev también se
deriva del tamaño de la ejecución, de modo que una ejecución pequeña no se quede sin evaluar. Si
observa una detención que no esperaba, lea esas líneas; el manifiesto de la ejecución registra
exactamente qué ocurrió y por qué. (Una ejecución que simplemente alcanzó su último paso planificado
se reporta como finalizada, no como una detención temprana).

---

## "La ejecución se rechazó antes de comenzar realmente"

**Qué está pasando:** se activó un filtro de control (gate), lo cual cuesta menos que una ejecución que falla
tras varias horas de trabajo. Los más comunes:

- **Falta el extra de entrenamiento**: `nmt-forge preflight run --config
  config.json` shows `✗ backend-installed` con la solución,
  `python3 -m pip install 'nmt-forge[hf]'`.
- **No hay conjunto de dev, o es el incorrecto**: el dev-fence rechaza una ejecución cuyo
  `data.dev` no sea un conjunto registrado con el rol `dev`. Separe uno con
  `nmt-forge split … --register project`.
- **Filtración (leakage)**: un archivo de entrenamiento comparte prompts o respuestas con un conjunto de
  prueba registrado o sellado. Límpielo con `nmt-forge leak-audit <file> --clean-to
  <file.clean.jsonl>` y apunte la configuración al archivo limpio.
- **Tiempo de reloj (wall-clock)**: en los primeros minutos, forge mide la velocidad de entrenamiento y
  rechaza una ejecución cuya proyección supere `model.time_budget_hours`. En una CPU, esto
  suele significar que el ajuste predeterminado necesita una GPU (`nllb-600m`), o que la mezcla es mucho más grande
  de lo previsto. El mensaje nombra las palancas de acción: una mezcla más pequeña, secuencias
  más cortas o un presupuesto de tiempo mayor si realmente acepta la espera.

**Solución:** ejecute `nmt-forge preflight run --config config.json` antes de cada ejecución;
muestra cada filtro de control (gate), ✓/✗, con la solución para cada ✗.

---

## "Una métrica que quería simplemente… falta en el informe"

El informe es honesto pero en blanco en un eje (COMET, una verificación de validez de FST).

**Hallazgo de forge:** `R6-referee-unavailable` — el carril se nombra como no disponible
con la razón. **Palanca: REFEREE.**

**Solución:** instale/configure el referee indicado y vuelva a puntuar. Cuando la ficha
de idioma declara el referee, el mensaje de forge indica el comando de instalación
(`mt-eval setup --lang <code>`). Las puntuaciones que tiene siguen siendo válidas; simplemente
son ciegas en ese eje en particular hasta que el referee esté presente.

---

## "El modelo emite `<unk>` o caracteres garrapateados"

Especialmente en un script silábico o latino extendido.

**Depende del ajuste predeterminado.**

- **`cpu-tiny`** aprende su propio vocabulario a partir de sus filas de entrenamiento, por lo que cada
  carácter que aparece en el entrenamiento está cubierto. `<unk>` aquí significa que la entrada
  contiene un carácter que nunca apareció en el entrenamiento: una letra o
  diacrítico poco común, o una forma Unicode diferente de este (el texto se normaliza a NFC, por lo que
  los acentos compuestos y descompuestos cuentan como el mismo). Verifique que sus datos de entrenamiento
  y de prueba utilicen la misma ortografía.
- **`cpu-finetune` y `nllb-600m`** utilizan el tokenizador del modelo base preentrenado.

⚠ **preste atención a esto (aún no automatizado para bases preentrenadas).** Es posible que el
**tokenizador del modelo base no represente la escritura de destino**. forge todavía no audita
la cobertura del tokenizador antes del entrenamiento. Verifique el tokenizador de su modelo base frente a
muestras del sistema de escritura de destino; prefiera una base cuyo vocabulario cubra la escritura
(muchos idiomas de bajos recursos están cubiertos por bases de la familia NLLB) o amplíe el
tokenizador antes de entrenar.

---

## Cuando forge se negó y usted no entiende por qué

Un rechazo siempre establece **qué** sucedió, **por qué** corrompe los resultados, y la
**solución**. Si aún no está claro:

- `nmt-forge status`: dónde se encuentra y el siguiente comando específico.
- `nmt-forge preflight <command>`: cada filtro de control (gate) con el que se topará ese comando, ✓/✗, con
  la solución para cada ✗, de modo que pueda resolverlos todos a la vez en lugar de uno por uno
  (para `run`, `evaluate` y `export`, agregue `--config config.json`).
- Agregue `--json` a cualquier comando cuando un agente esté leyendo el resultado: un rechazo
  llegará entonces como un único objeto JSON — `{"error": {"type", "guard", "message",
  "why", "fix", …}}` — con código de salida 2.

Un rechazo no es un error en su configuración — es la herramienta atrapando un error antes
de que llegue a sus resultados. Ese es todo el diseño.
