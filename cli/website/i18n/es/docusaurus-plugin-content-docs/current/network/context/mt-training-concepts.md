---
sidebar_position: 0
title: "Entrenamiento de MT en Lenguaje Accesible"
description: "Un glosario sin requisitos previos del vocabulario que necesita para entrenar un modelo de traducción — cada término definido con un ejemplo práctico, escrito para personas que dirigen un agente de codificación."
related:
  - label: "So You Want to Train Your Own Model"
    to: /docs/network/tutorials/train-your-own-model
    kind: tutorial
    note: "The hands-on walkthrough these words are for"
  - label: "Train a Model Honestly (nmt-forge)"
    to: /docs/network/getting-started/training-honestly
    kind: guide
    note: "The suite that turns every rule here into a guardrail"
  - label: "MT Field Briefing"
    to: /docs/network/context/mt-field-briefing
    kind: doc
    note: "Broader context on where machine translation stands"
  - label: "Statistical Significance Testing"
    to: /docs/network/specifications/significance
    kind: spec
    note: "The math behind error bars — why one number is never enough"
  - label: "Metric Reliability"
    to: /docs/network/specifications/metric-reliability
    kind: spec
    note: "Which score to believe for your language"
---

# Entrenamiento de MT en Lenguaje Llano

Entrenar un modelo de traducción automática (MT) tiene su propio vocabulario, y la mayoría nunca se explica a los recién llegados — se da por sentado. Esta página no da nada por sentado. Cada término a continuación se define en palabras simples y se vincula a un ejemplo concreto, para que cuando lea el [tutorial de entrenamiento](/docs/network/tutorials/train-your-own-model) o vea a su agente de codificación ejecutar un comando, sepa qué significan las palabras y, más importante aún, **cuáles de ellas ocultan los errores que arruinan silenciosamente los resultados.**

:::info[Para quién es esto]
No necesita escribir Python. La forma esperada de hacer este trabajo ahora es **dirigir un agente de codificación** — Claude Code, OpenAI Codex, Cursor, OpenCode, Google Antigravity, o similar — que ejecute las herramientas por usted. Su trabajo es entender los conceptos lo suficientemente bien como para dar buenas instrucciones y leer los resultados honestamente. Eso es exactamente para lo que sirve esta página. Cuando mencionamos una herramienta, nos referimos a [**nmt-forge**](/docs/network/getting-started/training-honestly), el conjunto de entrenamiento en el que se construyen estas ideas; las palabras, sin embargo, son de todo el campo, no solo nuestras.
:::

Un ejemplo en ejecución une la página. Suponga que desea construir un modelo que traduzca **inglés → un idioma de pocos recursos** — llámelo su *idioma de destino* — para el cual casi no existe texto traducido. Todo lo que sigue es una parte de ese proyecto.

---

## 1. Los dos montones: datos de entrenamiento y datos de evaluación

**Datos paralelos** es texto emparejado con su traducción — el mismo significado en dos idiomas, alineados oración por oración.

> `The children are playing.` → `awâsisak mêtawêwak.`

Un modelo aprende estudiando miles de tales pares. Pero debe mantener los pares en **dos montones que nunca se tocan**:

- **Datos de entrenamiento** — los pares que el modelo *está permitido estudiar*. Los lee una y otra vez y se ajusta a sí mismo para reproducirlos.
- **Datos de evaluación** (o **datos de eval**) — pares que el modelo *nunca está permitido ver durante el entrenamiento*. Oculta las traducciones, le pide al modelo que traduzca el lado de origen en frío, y compara su respuesta con la verdad oculta. Esta es la única medida honesta de si aprendió a *traducir* en lugar de *memorizar*.

:::tip[La versión de una oración de todo en esta página]
Una prueba solo significa algo si el modelo nunca ha visto las respuestas. Casi cada error a continuación es una forma diferente en que las respuestas se filtran del montón de eval al montón de entrenamiento sin que nadie lo note.
:::

### Datos paralelos reales versus sintéticos

- **Datos paralelos reales (u *oro*)** están hechos por humanos: un libro de texto bilingüe, registros gubernamentales traducidos por personas, historias archivadas por la comunidad. Es confiable pero, para la mayoría de los idiomas, escaso de manera dolorosa — a menudo solo unos pocos cientos de pares de oraciones.
- **Datos paralelos sintéticos** son *fabricados* por un programa en lugar de ser escritos por una persona. Cuando tiene solo 400 pares reales, no puede entrenar un modelo utilizable — así que genera cientos de miles de pares adicionales a partir de reglas (más sobre cómo en [§7](#7-manufacturing-data-when-you-dont-have-enough)).

La relación importa enormemente:

> **Ejemplo trabajado.** Un proyecto tiene 435 pares reales inglés→Cree y fabrica ~1,000,000 sintéticos. El modelo se entrena en el gran montón sintético *más* los pocos cientos de pares reales. Los datos sintéticos compran cobertura; los datos reales anclan el modelo a cómo se usa realmente el idioma. Todo el oficio es (a) hacer que el montón sintético cubra la mayor parte del idioma posible, y (b) medir solo en texto real que el modelo nunca tocó.

:::danger[Nunca pruebe en datos sintéticos]
Un conjunto de evaluación debe ser **solo datos reales**. Si prueba en oraciones fabricadas, está midiendo si el modelo coincide con su *generador* — no si puede traducir. Un buen conjunto de entrenamiento se niega a registrar filas sintéticas como un conjunto de prueba en absoluto.
:::

---

## 2. División: entrenamiento, desarrollo y prueba

Comienza con un montón de pares reales y lo **divide** en tres roles.

| División | También llamado | Para qué sirve | ¿El modelo lo ve en el entrenamiento? |
|---|---|---|---|
| **train** | conjunto de entrenamiento | Los pares que el modelo estudia | Sí |
| **dev** | conjunto de validación, retenido | Decidir *cuándo parar* y *cuál versión es mejor* | No (solo *puntuado*, nunca estudiado) |
| **test** | retenido, conjunto de evaluación | La calificación final honesta | **Nunca** |

Dos ideas se esconden en esa tabla:

- **Retenido** simplemente significa "apartado y mantenido alejado del entrenamiento". Un conjunto de prueba se retiene a propósito.
- El **conjunto de dev** es el hijo del medio inteligente. El modelo nunca lo *estudia*, pero usted *echa un vistazo* a qué tan bien lo hace el modelo en él durante el entrenamiento para tomar decisiones — como un examen de práctica que le dice si debe seguir estudiando, sin ser el examen real. Usar el conjunto de dev de esta manera es legítimo; usar el conjunto de *prueba* de esta manera es hacer trampa (ver [§4](#4-contamination-and-leakage-the-mistake-that-eats-results)).

### Conjuntos sellados y re-divisiones

- Un **conjunto sellado** es un conjunto de prueba que puede ser puntuado **exactamente una vez**. En el momento en que ve su puntuación en él, está "gastado" — porque una vez que conoce el número, cada decisión posterior que toma está sutilmente moldeada por él. Los conjuntos sellados son cómo las competiciones y comunidades mantienen una calificación final verdaderamente final.
- Una **re-división** es cuando reconstruye la división entrenamiento/desarrollo/prueba desde cero — generalmente porque descubrió que la división anterior estaba contaminada. No puede arreglar una división con fugas eliminando algunas filas; reagrupa todo y corta de nuevo ([§4](#4-contamination-and-leakage-the-mistake-that-eats-results) explica por qué).

---

## 3. Lo que el "entrenamiento" realmente hace: pérdida y sus dos caras

El entrenamiento es un bucle. El modelo hace una predicción, ve cuán equivocado estuvo, y ajusta ligeramente sus números internos para estar un poco menos equivocado la próxima vez — millones de veces.

**Pérdida** es el número único que mide "cuán equivocado". Más bajo es mejor. Pero hay *dos* pérdidas, y confundirlas es una trampa clásica:

- **Pérdida de entrenamiento** — cuán equivocado está el modelo en los pares que está estudiando activamente. Esto casi siempre sigue bajando, porque el modelo puede, en el límite, simplemente *memorizar* los pares de entrenamiento.
- **Pérdida de dev** (pérdida de validación) — cuán equivocado está el modelo en el conjunto de dev retenido que *no* está estudiando. Esta es la señal honesta. Cuando la pérdida de dev deja de mejorar mientras la pérdida de entrenamiento sigue bajando, el modelo ha dejado de *aprender el idioma* y ha comenzado a *memorizar el conjunto de entrenamiento*.

> **Ejemplo trabajado.** Después de un tiempo ve la pérdida de entrenamiento en 0.8 y bajando, pero la pérdida de dev atascada en 1.9 y subiendo *hacia arriba*. Esa brecha es la pista: el modelo está mejorando en recitar sus pares de entrenamiento y no mejor — incluso peor — en traducir cualquier cosa nueva.

### La pérdida es un proxy. La decodificación es lo real.

Aquí hay una sutileza que confunde a casi todos. La pérdida mide si el modelo asigna alta probabilidad a la palabra siguiente correcta *cuando la respuesta correcta ya está frente a él*. Eso **no** es lo mismo que el modelo realmente produciendo una buena traducción por su cuenta.

- **Decodificación** (también *generación* o *inferencia*) es el modelo **realmente traduciendo**: dado solo la oración de origen, emite una oración de destino palabra por palabra, sin nada en qué apoyarse.
- **Pérdida** es un *proxy* barato calculado durante el entrenamiento. Correlaciona con la calidad, pero imperfectamente.

> **Ejemplo trabajado.** Dos puntos de control tienen casi pérdida de dev idéntica, pero cuando *decodifica* las oraciones de dev y puntúa las traducciones reales, una es claramente más fluida. La pérdida no pudo ver esa diferencia; la decodificación sí. Por eso la selección seria de puntos de control decodifica el conjunto de dev y puntúa la salida real, en lugar de confiar solo en la pérdida.

:::note[¿"¿Rastrea la pérdida de dev la calidad?" es una pregunta abierta, no folclore]
Escuchará afirmaciones confiadas de que "la pérdida de eval miente". Trate eso como **indeterminado**, no probado — mucho de ese folclore provino de experimentos contaminados. La posición honesta: la pérdida de dev es una señal útil y barata; una métrica de **generación de dev** (decodificar, luego puntuar) es una más directa. Prefiera la directa para decisiones finales, y no repita "la pérdida miente" como un hecho.
:::

---

## 4. Contaminación y filtración: el error que devora resultados

**Contaminación** (o **filtración**) significa que las respuestas de eval han terminado secretamente en el montón de entrenamiento. El modelo entonces "aprueba la prueba" por memoria, su puntuación se ve excelente, y el resultado es inútil. Esta es la forma más común en que los resultados de MT de pocos recursos resultan ser falsos — y la cosa más importante que toda esta página le está advirtiendo.

La forma clásica y astuta es un **par mínimo de destino compartido**:

> **Ejemplo trabajado — "Aliméntalo" / "Aliméntala".** Un libro de texto de idioma mapea muchos ejercicios de inglés diferentes a **una** palabra de destino. *"Aliméntalo"* y *"Aliméntala"* ambos se traducen a la misma forma, `asam`. Una división aleatoria ingenua deja caer *"Aliméntalo"* → `asam` en **entrenamiento** y *"Aliméntala"* → `asam` en el **conjunto de prueba**. La respuesta de destino, `asam`, ahora está en ambos montones. El modelo memorizó `asam` del entrenamiento y "lo acierta" en la prueba — pero no aprendió nada. En un proyecto real, 17 de 54 filas de "prueba" se filtraron de esta manera, y esas filas puntuaron **83** en la métrica de calidad versus **44** para filas limpias. Cada hallazgo construido sobre ese número tuvo que ser descartado.

La filtración tiene varias caras, y una **auditoría de fugas** adecuada verifica todas ellas:

- **Superposición exacta** — la misma fuente *o* el mismo destino aparece en ambos lados (el ejemplo anterior).
- **Superposición casi duplicada** — no idéntica, pero una versión *reformulada* de una oración de prueba se sienta en el entrenamiento. Los documentos del mismo dominio comparten paráfrasis; la coincidencia exacta se pierde estas, así que las auditorías también miden similitud de superposición de palabras.
- **Superposición de archivo completo** — alguien entrenó accidentalmente en una copia del archivo de prueba en sí. (Esto realmente sucede: una cosecha de "entrenamiento" resultó ser *el* libro de texto de oro, 489 de 489 líneas coincidentes.)

### División disjunta por grupo — la solución

No puede arreglar la filtración eliminando las filas ofensivas una por una; el patrón simplemente reaparece. La solución es **división disjunta por grupo**: antes de dividir, ate juntos cada par que comparta una fuente *o* un destino en un **grupo**, luego envíe cada *grupo completo* a exactamente un lado. Ahora `asam` y todo lo que lo comparte vive completamente en entrenamiento *o* completamente en prueba — nunca ambos. Después del corte, **verifica cero superposición** y se niega a proceder si queda alguna.

:::tip[Esto es lo que "el guardián de división" hace por usted]
Cuando su agente ejecuta el divisor, hace división disjunta por grupo por defecto y verifica cero superposición automáticamente. No tiene que recordar la trampa "Aliméntalo / Aliméntala" — la herramienta hace que cometerla sea difícil, y si la rodea, se niega con un mensaje nombrando la solución.
:::

---

## 5. Sobreajuste, parada temprana y la meseta

**Sobreajuste** es lo que sucede cuando un modelo sigue estudiando más allá del punto de aprendizaje y comienza a *memorizar*. Su pérdida de entrenamiento se ve maravillosa; su calidad de traducción real empeora. La [brecha de pérdida de §3](#3-what-training-actually-does-loss-and-its-two-faces) es cómo lo detecta.

**Parada temprana** es la defensa: observe la señal de dev, y cuando deja de mejorar durante un número establecido de verificaciones (su **paciencia**), detenga el entrenamiento y mantenga la versión anterior mejor — el mejor **punto de control** (una instantánea guardada del modelo a mitad del entrenamiento). La parada temprana previene el cálculo desperdiciado y el sobreajuste a la vez.

Pero la parada temprana tiene un modo de falla famoso cuando entrena principalmente en datos sintéticos — la **meseta de transferencia sintética→real**:

> **Ejemplo trabajado — la muerte de media época.** Un modelo se entrena en una mezcla que es 97.5% sintética y se juzga en un conjunto de dev *real* de 42 oraciones. Al principio, el modelo rápidamente se vuelve bueno en la masa sintética, así que la pérdida de dev en las oraciones reales baja rápido, toca fondo alrededor del paso 8,000 — luego se desplaza *hacia arriba*. La parada temprana ingenua ve "la pérdida de dev subió 6 verificaciones seguidas" y declara victoria en la época 0.52, una vigésima parte del entrenamiento planeado. Pero el modelo no estaba hecho; simplemente había terminado el aprendizaje sintético *fácil* y aún no había comenzado la lenta **transferencia** a calidad de lenguaje real. Se detuvo en la meseta, antes de la recompensa.

La lección: con una mezcla sintética-pesada, un *temprano* hundimiento y subida en la pérdida de dev es **esperado**, no convergencia. La regla de parada tiene que ser lo suficientemente inteligente para mantener el entrenamiento a través de la meseta — un piso derivado del tamaño de su mezcla, no un número mágico que se supone debe saber.

:::note[Las configuraciones honestas exponen errores reales]
Ese error de meseta fue invisible durante meses — porque las ejecuciones anteriores habían (ilegítimamente) usado el conjunto de *prueba* como su conjunto de dev, lo que lo ocultó. La primera ejecución *limpia* es lo que lo expuso. Este es el tema recurrente: hacerlo honestamente no solo lo mantiene veraz, hace que los problemas reales sean visibles.
:::

---

## 6. Medición de calidad: métricas, baterías, registros

Cuando el modelo *decodifica* una oración de prueba, ¿cómo puntúa su respuesta contra la traducción de referencia?

### Métricas de crédito parcial: chrF++ y BLEU

Una traducción rara vez es exactamente la referencia palabra por palabra, pero puede ser perfectamente buena. Así que MT usa **métricas de crédito parcial** que recompensan la *superposición* en lugar de exigir una coincidencia exacta:

- **chrF++** puntúa la superposición de **secuencias de caracteres** (más algunas secuencias de palabras) entre la salida del modelo y la referencia. Porque funciona a nivel de carácter, da crédito parcial por acertar una palabra *casi* correctamente — la raíz correcta con una terminación incorrecta aún gana algo. Eso la hace bien adecuada para idiomas morfológicamente ricos, donde una raíz toma muchas formas. Más alto es mejor; generalmente se reporta en una escala de 0–100.
- **BLEU** es el estándar más antiguo. Puntúa la superposición de **fragmentos de palabras completas** (n-gramas). Todavía se reporta ampliamente, pero es duro con idiomas donde las palabras tienen muchas formas flexionadas, porque un casi-fallo en una terminación cuenta como un fallo completo.

> **Ejemplo trabajado.** Referencia: `awâsisak mêtawêwak`. Salida del modelo:
> `awâsisak mêtawêw` (raíz correcta, sílaba final incorrecta). BLEU ve la segunda palabra como simplemente incorrecta. chrF++ ve que la mayoría de los caracteres coinciden y otorga crédito parcial. Misma salida, puntuación muy diferente — por eso la métrica que elige cambia la historia.

:::tip[Qué métrica creer es una pregunta medida]
No toda métrica rastrea el juicio humano igualmente para cada idioma. Para algunas familias BLEU apenas correlaciona con lo que piensan los humanos; para otras una métrica neural sofisticada es la poco confiable. Antes de optimizar hacia *cualquier* métrica, verifique la evidencia de [Confiabilidad de Métrica](/docs/network/specifications/metric-reliability) para su familia de idiomas — y si la respuesta honesta es "no medida", dígalo en lugar de confiar en un número.
:::

### Métricas neurales: COMET, MetricX

Más allá de la superposición de caracteres/palabras, **métricas neurales** (COMET, COMET-QE, MetricX) usan un modelo entrenado para *juzgar* traducciones más como lo haría un humano. Pueden ser mucho más confiables — pero solo para idiomas que fueron entrenados para juzgar, lo que excluye la mayoría de los de pocos recursos. También se ejecutan dependientemente de dirección: **MetricX** es **más bajo es mejor**, lo opuesto a chrF++ — un detalle que vale la pena saber antes de comparar números.

### Barras de error: nunca confíe en un número

Una puntuación única sin incertidumbre es una trampa. En conjuntos de prueba pequeños, las diferencias a menudo son solo ruido.

> **Ejemplo trabajado.** "El modelo mejoró de 16.7 a 18.1 en el conjunto de historias orales" suena como progreso — hasta que nota que el conjunto tiene 37 oraciones. Con tan pocos datos, un cambio de ±3 puntos es pura casualidad. El informe honesto es `17.4 [15.1, 19.8] 95% CI`: el número, más el **intervalo de confianza (CI)**
> — el rango en el que el valor verdadero plausiblemente cae. Si los intervalos de dos modelos se superponen mucho, no puede afirmar que uno es mejor.

Las buenas herramientas se niegan a imprimir una puntuación sin su CI, y usan una [prueba de significancia](/docs/network/specifications/significance) antes de declarar una victoria A-vence-a-B.

### Baterías y registros

El lenguaje real no es una cosa plana. Un **registro** (o **dominio**) es un *tipo* de lenguaje: conversación casual, un ejercicio de libro de texto, un artículo de noticias, una historia oral, prosa gubernamental formal. Un modelo puede ser excelente en uno y pobre en otro.

Una **batería** es un conjunto de evaluación deliberadamente dividido en varios registros, puntuado **por separado**, para que un promedio único no pueda ocultar una debilidad.

> **Ejemplo trabajado.** Un modelo puntúa 46 en general — respetable. Pero el desglose de batería muestra 58 en ejercicios de libro de texto y 22 en historias orales. El promedio estaba enmascarando un fracaso casi total en el habla natural. Solo la batería por registro lo reveló.

---

## 7. Fabricación de datos cuando no tiene suficientes

Cuando los pares reales son escasos, fabrica sintéticos. Dos técnicas dominan, y ambas viven o mueren en una palabra: **verificación**.

### FSTs y analizadores morfológicos

Un **analizador morfológico** es una herramienta que conoce la gramática de palabras de un idioma: cómo las raíces se combinan con prefijos y sufijos para hacer palabras válidas. Muchos se construyen como **FSTs** — *transductores de estado finito*, una tecnología precisa basada en reglas (no una red neuronal) que puede ejecutarse en dos direcciones:

- **analizar**: dada una palabra, divídala en raíz + etiquetas gramaticales
  (`nipâw` → "dormir, tercera persona singular").
- **generar**: dada una raíz + etiquetas, deletree la forma de palabra correcta
  (`sleep + 3sg` → `nipâw`).

Para un idioma polisintético — donde una sola palabra puede llevar lo que el inglés necesita una oración completa — un FST es oro: puede deletrear *cualquier* forma válida de *cualquier* raíz conocida, que es exactamente la materia prima para fabricar datos de entrenamiento.

### Verificación de viaje redondo — la regla que hace que los datos sintéticos sean confiables

Fabricar datos es peligroso: un generador puede emitir silenciosamente tonterías. La disciplina que lo previene es la **ley de viaje redondo**: cada palabra fabricada debe sobrevivir *generar → analizar → el mismo análisis con el que comenzó*. Si le pide al FST que deletree una forma y luego alimenta ese deletreo de vuelta y no obtiene sus etiquetas devueltas, la palabra se descarta. Nada que falle el viaje redondo jamás se permite en los datos de entrenamiento.

> **Ejemplo trabajado — la fuga de un carácter.** Un diccionario deletreó un sonido con la letra `ý`; el analizador esperaba `y` simple. Porque nadie reconcilió los dos deletreos en el límite, *1,375 verbos* fueron silenciosamente juzgados "desconocidos" y descartados de la generación — durante semanas, invisiblemente. La solución es un **canonicalizador**: una función que normaliza el deletreo a una convención única *en todas partes* donde dos componentes se encuentran, más una **auditoría de embudo** que cuenta cuántos elementos sobreviven cada etapa de canalización para que una caída silenciosa de 1,375 elementos nunca pueda ocultarse de nuevo.

### Cobertura, no solo volumen

Un millón de oraciones fabricadas suenan comprensivas. No lo son, si son un millón de variaciones de las mismas pocas formas.

> **Ejemplo trabajado.** Un corpus sintético de 1,000,000 pares resultó contener **sin imperativos** ("¡Vota!"), **sin preguntas wh** ("quién/dónde/cuándo"), **sin posesión** ("mi perro"), y **sin formas inversas** ("ella me ve *a mí*" — gramática central en muchos idiomas). El analizador podría generar todos ellos; las plantillas simplemente nunca preguntaron. El volumen ocultó un agujero estructural.

La defensa es una **lista de verificación de cobertura** transcrita de una gramática publicada: los fenómenos gramaticales requeridos, cada uno citado, para que la compilación falle si uno requerido tiene cero ejemplos. Y un **límite por tipo** detiene cualquier forma de plantilla de dominar — en un corpus, dos formas eran 54% de los datos, así que la mitad de la "experiencia" del modelo eran dos patrones de oración.

### Retrotraducción

**Retrotraducción** es la otra gran técnica sintética, y es inteligente. Si tiene texto plano, *sin traducir* en su idioma de destino (un corpus **monolingüe** — mucho más fácil de encontrar que texto paralelo), puede:

1. tomar un modelo *inverso* (destino → inglés),
2. traducir automáticamente su texto de destino monolingüe *al* inglés,
3. emparejar cada oración inglés-máquina con la oración de destino **real** con la que comenzó, y
4. entrenar su modelo directo (inglés → destino) en esos pares.

El lado de destino es lenguaje genuino; solo el lado inglés es sintético — generalmente un buen intercambio.

> **Ejemplo trabajado.** Tiene 50,000 oraciones reales en su idioma de destino pero solo 400 pares paralelos. Retrotraduza los 50,000 al inglés aproximado, y ha convertido texto monolingüe en 50,000 pares de entrenamiento cuyo lado de *destino* es auténtico.

:::danger[Audite su texto monolingüe también para fugas]
La retrotraducción se siente segura porque "es solo texto monolingüe" — pero ese texto puede *ser* sus datos de eval disfrazados. En un proyecto la auditoría de fugas atrapó una cosecha monolingüe que coincidía exactamente con el conjunto de prueba de oro. Audite **cada** entrada contra **cada** conjunto de eval, sintético y monolingüe incluido — no solo su corpus paralelo obvio.
:::

### Etiquetado de datos sintéticos

Una última práctica: **etiquete** fuentes sintéticas con un marcador (como `<synth>` o `<bt>`) y deje datos reales (oro) sin etiquetar. Esto permite que el modelo distinga "material de práctica" de "lo real", para que los datos auténticos anclen su estilo de salida; en tiempo de traducción no agrega la etiqueta, y el modelo se apoya en lo que aprendió del oro. (Vea el [libro de cocina de retrotraducción](/docs/network/tutorials/back-translation) para esta técnica en profundidad.)

---

## 8. Cómo se conectan las piezas

Leyendo de arriba a abajo, este es un flujo de trabajo:

1. Reúna **datos paralelos reales** ([§1](#1-the-two-piles-training-data-and-evaluation-data)) — generalmente muy poco.
2. **Divida** disjuntamente por grupo en entrenamiento / desarrollo / prueba ([§2](#2-splitting-train-dev-and-test), [§4](#4-contamination-and-leakage-the-mistake-that-eats-results)).
3. **Fabrique** datos sintéticos para llenar el vacío — verificados de viaje redondo, verificados de cobertura, auditados de fugas ([§7](#7-manufacturing-data-when-you-dont-have-enough)).
4. **Entrene** en la mezcla, observando **pérdida de dev / generación de dev** para evitar **sobreajuste** y para sobrevivir la **meseta** ([§3](#3-what-training-actually-does-loss-and-its-two-faces), [§5](#5-overfitting-early-stopping-and-the-plateau)).
5. **Decodifique** la **batería de prueba** retenida y puntúela con **métricas de crédito parcial + intervalos de confianza**, por **registro** ([§6](#6-measuring-quality-metrics-batteries-registers)).
6. Haga todo sin permitir nunca que las respuestas de eval toquen el entrenamiento ([§4](#4-contamination-and-leakage-the-mistake-that-eats-results)) — la regla que los otros cinco sirven.

Cada regla aquí corresponde a un error real, medido que un proyecto real cometió y documentó. No tiene que memorizarlos: el conjunto de entrenamiento mecaniza cada uno para que el camino honesto sea el predeterminado y los caminos deshonestos se nieguen con una explicación. Ese es el tema de la próxima página.

## Dirigiendo su agente con este vocabulario

Porque estará trabajando a través de un agente de codificación, el beneficio práctico de esta página es que ahora puede dar — y verificar — instrucciones como estas:

- *"Divida el corpus disjuntamente por grupo y verifique cero superposición antes del entrenamiento."*
- *"Corte un conjunto de dev del lado de entrenamiento; nunca seleccione puntos de control en el conjunto de prueba."*
- *"Audite fugas de cada entrada contra cada conjunto de eval, incluyendo los datos sintéticos y monolingües."*
- *"Reporte chrF++ con intervalos de confianza del 95%, desglosados por registro."*
- *"Verifique la confiabilidad de métrica para esta familia de idiomas antes de optimizar hacia cualquier puntuación."*

Si su agente tiene el servidor MCP de Champollion disponible, puede llamar a
`get_training_guardrails` para extraer estas reglas — y el error que cada una mata — directamente en su contexto antes de escribir un solo comando.

**Siguiente:** póngalo a trabajar en
[**Así que Quiere Entrenar Su Propio Modelo**](/docs/network/tutorials/train-your-own-model),
el tutorial paso a paso — o lea
[**Entrene un Modelo Honestamente**](/docs/network/getting-started/training-honestly)
para cómo el conjunto convierte cada concepto aquí en una barrera automática.

Si términos como *tokenizer* aún le resultan poco claros, la guía básica desde cero es [Tokenizers](/docs/learn/tokenizers) — léala una vez y todo lo anterior será más fácil.
