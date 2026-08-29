---
sidebar_position: 0
title: "Así que deseas entrenar tu propio modelo"
description: "Un recorrido integral orientado a agentes para entrenar un modelo de traducción de bajo recurso con nmt-forge — tú diriges un agente de codificación, y los guardrails capturan automáticamente los errores de principiante."
related:
  - label: "MT Training in Plain Language"
    to: /docs/network/context/mt-training-concepts
    kind: doc
    note: "Read this first if any word below is unfamiliar"
  - label: "Train a Model Honestly (nmt-forge)"
    to: /docs/network/getting-started/training-honestly
    kind: guide
    note: "The guardrail catalogue, one page"
  - label: "Submit a Method"
    to: /docs/network/getting-started/submit-a-method
    kind: guide
    note: "Where a finished model goes"
  - label: "Metric Reliability"
    to: /docs/network/specifications/metric-reliability
    kind: spec
    note: "Know which score to trust before you optimize"
  - label: "Statistical Significance Testing"
    to: /docs/network/specifications/significance
    kind: spec
---

# Así que quiere entrenar su propio modelo

Este es un recorrido completo del entrenamiento de un modelo de traducción automática para una
lengua de recursos limitados — desde "hablo esta lengua y apenas hay datos"
hasta un modelo que puede reportar honestamente y enviar a la [Red](/docs/network/).
Está escrito para principiantes, y asume la forma moderna de hacer este trabajo:
**usted dirige un agente de codificación** (Claude Code, OpenAI Codex, Cursor, OpenCode,
Google Antigravity, o similar), y el agente ejecuta las herramientas.

Así que cada paso a continuación tiene la misma forma:

- 🗣️ **Indíquele a su agente** — qué solicitar, en lenguaje natural.
- 🛠️ **Lo que hace la herramienta** — lo que [nmt-forge](/docs/network/getting-started/training-honestly)
  ejecuta en su nombre, y la **barrera de seguridad** que atrapa el error clásico
  antes de que pueda costarle.
- 👀 **Cómo leer el resultado** — qué se ve "bien" y qué debe preocuparle.

:::info[Primero, el vocabulario]
Si términos como *dev set*, *decoding*, *chrF++*, *leakage*, o *round-trip
verification* no son segunda naturaleza aún, lea
[**MT Training in Plain Language**](/docs/network/context/mt-training-concepts)
primero — define cada palabra usada aquí con un ejemplo trabajado. Esta página se
apoyará en todas ellas.
:::

:::note[La honestidad es la característica, no la fricción]
La herramienta es opinada a propósito. Sus barreras de seguridad mecanizan errores reales y medidos
que un proyecto real cometió — así que el camino honesto es el predeterminado, y los
atajos deshonestos **se niegan con un mensaje que nombra la solución**. Donde vea
un rechazo en esta guía, eso es la herramienta haciendo su trabajo. Usted lo quiere.
:::

---

## Lo que necesita antes de comenzar

- **Un agente de codificación** con acceso a terminal y sistema de archivos. Ese es el conductor.
- **Algunas oraciones realmente traducidas** para su par de lenguas — incluso unos pocos
  cientos de pares hechos por humanos es un comienzo viable. Libros de texto bilingües, archivos comunitarios, registros públicos traducidos, material educativo. Calidad sobre
  cantidad.
- **Opcional pero poderoso:** texto monolingüe en su lengua de destino, un
  diccionario bilingüe, una gramática de referencia publicada, y un
  analizador morfológico (FST). Usted **no** necesita todos estos para comenzar — la herramienta le dice
  exactamente cuáles están presentes y cuáles desbloquean qué capacidades.
- **Computadora:** las barreras de seguridad, división, síntesis, auditoría y puntuación se ejecutan
  en una computadora portátil. Solo el paso real de entrenamiento del modelo quiere una GPU (y un modelo
  pequeño con LoRA cabe en hardware modesto).

> 🗣️ **Indíquele a su agente:** *"Instale nmt-forge del paquete `forge/` del monorepo de Champollion
> y confirme que el comando `nmt-forge` se ejecuta. Vamos a
> entrenar un modelo de traducción English → <your language\>, honestamente."*

Su agente puede llamar a la herramienta `get_training_guardrails` del servidor MCP de Champollion
para cargar el conjunto completo de reglas — las diez barreras de seguridad y el error que cada una elimina —
en su propio contexto antes de escribir cualquier comando. Si está dirigiendo un agente,
pídale que haga eso primero.

---

## Paso 1 — Elija una lengua y vea qué realmente existe

Cada proyecto comienza preguntando al índice qué tiene la lengua, honestamente.

> 🗣️ **Indíquele a su agente:** *"Ejecute `nmt-forge discover` para el código ISO 639-3 de mi lengua de destino
> y resuma qué datos existen y qué falta."*

```bash
nmt-forge discover nav        # Navajo, as an example
```

🛠️ **Lo que hace la herramienta.** Lee la **tarjeta** de Champollion de la lengua — la
fuente única de verdad sobre lo que se sabe de esa lengua — e informa los
scripts, analizadores morfológicos, diccionarios, corpus, y conjuntos de evaluación que
registra, luego coloca la lengua en la **escalera de activos**:

```
THE ASSET LADDER — what this language can do TODAY:
  ✓ rung 1: parallel text → train with every guard (no pack needed)
  ? rung 2: monolingual text → the tagged backtranslation lane
  ? rung 3: dictionary (+ grammar) → a cited template pack is worth building
  ? rung 4: morphological analyzer → round-trip-VERIFIED synthesis
  ? rung 5: LYSS referee → the language's own metric in selection
```

👀 **Cómo leer el resultado.** Las marcas `✓` son lo que puede hacer ahora; las marcas `?`
son peldaños esperando un activo. Crucialmente, **la ausencia en una tarjeta significa
*desconocido*, nunca "esta lengua no tiene nada."** Una tarjeta escasa es una invitación
a agregar lo que sabe, no un callejón sin salida — e incluso una tarjeta vacía le da el
bucle de entrenamiento completamente protegido en el peldaño 1. Una tarjeta rica (como Plains Cree) conecta los
peldaños superiores automáticamente: sus conjuntos de evaluación llegan marcados **NUNCA ENTRENAR CON ESTO**, y
su árbitro específico de la lengua viene listo para conectar.

Luego andamie un proyecto:

> 🗣️ **Indíquele a su agente:** *"Andamie un proyecto con `nmt-forge init` para este
> par de lenguas y léame el `NEXT_STEPS.md` que genera."*

```bash
nmt-forge init nav --dir my-nav-mt --pair eng-nav
```

🛠️ Esto crea un espacio de trabajo (un directorio `.forge/` que cada barrera de seguridad
consulta), una **configuración inicial**, y un resumen `NEXT_STEPS.md` escrito para *usted
y su agente* — el orden de comandos, la escalera de activos para su lengua, y
los no negociables. Es el mapa para todo lo que sigue.

---

## Paso 2 — Apunte a un analizador y diccionario (si los tiene)

Este paso trata sobre **peldaños 3–4** de la escalera. Si su lengua no tiene
analizador, salte al [Paso 4](#step-4--split-your-real-data-safely) — entrenará
en datos reales (y retrotraducidos) solamente, que es un camino completamente legítimo.

Si un analizador y diccionario *sí* existen, desbloquean la capacidad de
*fabricar* datos de entrenamiento verificados — la palanca más grande para una lengua
con poco texto paralelo.

> 🗣️ **Indíquele a su agente:** *"La tarjeta lista un analizador morfológico y un
> diccionario para esta lengua. Obténgalos según las instrucciones de instalación en la
> tarjeta, apunte el paquete de lengua a ellos mediante las variables de entorno documentadas, y
> confirme que el analizador hace round-trip de algunas palabras conocidas."*

🛠️ **Lo que hace la herramienta — y un límite que no cruzará.** Los analizadores (FSTs)
y diccionarios son **herramientas separadas obtenidas por el usuario bajo sus propias licencias**.
El conjunto **nunca los agrupa ni redistribuye** — le apunta a dónde vienen
y cuál es su licencia, y usted los obtiene. Esto no es burocracia: muchos recursos de lengua
llevan restricciones reales de permiso y soberanía, y la herramienta las respeta por construcción.

El tejido conectivo es un **paquete de lengua**: un pequeño complemento que adapta *su*
analizador, diccionario, reglas de ortografía, y plantillas de oraciones citadas por gramática al
motor. El conjunto **no** envía paquetes en sí — los paquetes viven con sus
lenguas (el paquete de Plains Cree, por ejemplo, vive en su propio proyecto y
se conecta por ruta de módulo).

👀 **Cómo leer el resultado.** Quiere que el analizador haga **round-trip**: deletree una
forma, alimente el deletreo de vuelta, obtenga las mismas etiquetas gramaticales. Si no lo hace, el
**canonicalizador** del paquete — la única función que normaliza la ortografía dondequiera que
dos componentes se encuentren — probablemente necesita una regla. Acertar esto importa: un
solo carácter no reconciliado (`ý` vs `y`) una vez eliminó silenciosamente 1.375 verbos
de un pipeline de generación durante semanas. La **auditoría de embudo** de la herramienta cuenta
sobrevivientes en cada etapa precisamente para que una caída silenciosa como esa no pueda ocultarse.

---

## Paso 3 — Sintetice datos de entrenamiento a partir de reglas gramaticales

Con un analizador + diccionario + un paquete de plantillas citadas por gramática, puede
fabricar cientos de miles de pares verificados.

> 🗣️ **Indíquele a su agente:** *"Genere datos de entrenamiento sintéticos con
> `nmt-forge synth` usando nuestro paquete de lengua, luego muéstreme el informe de cobertura."*

```bash
nmt-forge synth my_pack.module:get_pack --out data/synth.jsonl
```

🛠️ **Lo que hace la herramienta — la ley de emisión.** Cada fila que llega a la salida
debe satisfacer reglas de las que ningún paquete puede optar por no participar:

- **Round-trip verificado** — cada palabra generada pasa *generar → analizar →
  mismo análisis*, o la fila se descarta. Ninguna forma no verificada se emite jamás.
- **Citada por gramática** — cada tipo de plantilla cita la gramática publicada que
  transcribe. Las plantillas no citadas no existen; el código se niega a cargarlas.
- **Cobertura verificada** — las plantillas se cuentan contra una lista de verificación de
  fenómenos gramaticales requeridos (imperativos, preguntas, posesión, formas inversas…). Si un
  fenómeno *requerido* tiene cero ejemplos, la compilación falla. Esta
  es la guardia contra la trampa "un millón de oraciones, todas las mismas pocas formas"
  — volumen que oculta agujeros estructurales.
- **Marcado de procedencia** — cada fila sintética está marcada `synthetic: true`.
  Esa marca es de carga: el registro se **negará** a registrar
  filas sintéticas como un conjunto de prueba. Las pruebas son solo datos reales.

👀 **Cómo leer el resultado.** Mire el informe de cobertura para **elementos requeridos con cobertura cero**
(un fenómeno gramatical que sus plantillas nunca produjeron) y la **distribución de tipos** — si dos
formas de plantilla dominan, el límite por tipo del muestreador (predeterminado 15%) las reequilibrará
para que ningún patrón único se convierta en la mitad de la experiencia del modelo.

:::tip[¿Sin analizador? Use retrotraducción en su lugar]
Si no puede sintetizar a partir de reglas pero tiene texto de destino **monolingüe**,
pídale a su agente que ejecute el carril de **retrotraducción**: `nmt-forge
backtranslate` traduce automáticamente su texto monolingüe *al* inglés y empareja
cada resultado con la oración de destino **real**. El lado de destino permanece auténtico.
La herramienta **audita el texto monolingüe primero para fugas** — porque ese texto puede
ser secretamente *su* dato de evaluación. Vea el
[Libro de recetas de retrotraducción](/docs/network/tutorials/back-translation).
:::

---

## Paso 4 — Divida sus datos reales de forma segura

Ahora tome sus pares **reales** y divídalos en entrenamiento / desarrollo / prueba. Aquí es donde
el error más destructivo de resultados en MT de recursos limitados se oculta, y donde
la barrera de seguridad gana su valor.

> 🗣️ **Indíquele a su agente:** *"Divida el corpus real en un conjunto de prueba y desarrollo con
> `nmt-forge split`, disjunto por grupo, y regístrelos. Use una semilla fija para que
> sea reproducible."*

```bash
nmt-forge split corpus.jsonl --test 150 --dev 42 --seed 42 \
    --out data/split --register textbook
```

🛠️ **Lo que hace la herramienta — la guardia de división.** Hace **división disjunta por grupo**:
cada par que comparte una fuente *o* un destino se vincula en un grupo,
y cada grupo completo cae completamente en un lado. Luego **verifica cero
superposición** y se niega a continuar si existe alguna.

```
{"verified": "0 shared canonical source/target keys across sides", ...}
```

Esto elimina la fuga **"Feed him" / "Feed her"**: un libro de texto mapea ambos
ejercicios de inglés a una palabra de destino (`asam`); una división aleatoria ingenua pone una copia en entrenamiento
y su gemela en prueba, así que el modelo "pasa" por memoria. En un proyecto real 17
de 54 filas de prueba se filtraron de esta manera y puntuaron 83 vs 44 para filas limpias — y cada
hallazgo construido sobre ese número fue nulo. `--register textbook` registra los conjuntos de desarrollo y
prueba (como `textbook-dev` y `textbook-test`) en el espacio de trabajo para que cada
comando posterior sepa que son *conjuntos de evaluación que nunca debe entrenar*.

👀 **Cómo leer el resultado.** Quiere ver la línea **verified: 0 shared**. Si en su lugar
obtiene un `SplitLeakageError`, no elimine filas manualmente — eso solo reshuffles el problema. Vuelva a ejecutar
la división disjunta por grupo; esa es la solución, y el mensaje de error lo dice.

:::danger[Nunca entrene en un benchmark]
Si extrae un conjunto de datos de evaluación del registro compartido (`nmt-forge registry
add-harness`), la herramienta lo marca y lo trata como fuera de los límites para entrenamiento —
**cada** benchmark del registro está marcado *do-not-train*. Ajuste fino en lo que legítimamente pueda;
solo nunca en el conjunto de prueba. Esta es
[la única regla](/docs/network/leaderboard/rules) de toda la Red.
:::

---

## Paso 5 — Entrene

Un archivo de configuración describe la ejecución completa; un comando la ejecuta,
reproduciblemente.

> 🗣️ **Indíquele a su agente:** *"Complete la configuración de entrenamiento — apunte `dev` a nuestro
> conjunto de desarrollo registrado, liste los carriles de datos de oro y sintéticos, elija un modelo base pequeño
> con LoRA — luego ejecute `nmt-forge run` y observe los diagnósticos de programación."*

```jsonc
{
  "run_name": "my-first-run",
  "workspace": ".forge",
  "data": {
    "gold": ["data/train.jsonl"],
    "synthetic": [{"path": "data/synth.jsonl", "tag": "<synth>"}],
    "dev": "textbook-dev"            // registry name, role=dev — the fence
  },
  "mix": {"gold_upweight": 20, "kind_cap": 0.15, "seed": 42},
  "model": {"backend": "hf-seq2seq", "base": "facebook/nllb-200-distilled-600M"},
  "selection": {"metric": "generation:chrf++", "patience": 6},
  "decode": {"max_new_tokens": 256, "headroom_factor": 1.5},
  "regime": "auto"
}
```

```bash
nmt-forge run config.json
```

🛠️ **Lo que hace la herramienta — cuatro barreras de seguridad a la vez.**

- **Auditoría de fuga antes del entrenamiento.** *Cada* carril — oro, sintético, y cualquier
  texto retrotraducido — se examina contra *cada* conjunto de evaluación registrado. Coincidencias exactas,
  coincidencias casi duplicadas (replanteadas), y coincidencias de archivo completo en un conjunto de prueba son
  fatales. Nada entrena hasta que la mezcla esté limpia.
- **Cerca de desarrollo.** El entrenamiento **se niega a comenzar sin un conjunto de desarrollo registrado**, y
  solo seleccionará puntos de control en ese conjunto de desarrollo — nunca el conjunto de prueba.
  (Incluso verifica el contenido de las filas de desarrollo contra los conjuntos de prueba, para atrapar el
  truco `cp test.jsonl dev.jsonl`.) La selección de puntos de control puede usar **pérdida** de desarrollo o
  una métrica de **generación** de desarrollo — decodifique el conjunto de desarrollo y puntúe la salida real,
  la señal más honesta.
- **Cordura de programación.** Si su mezcla es sintética-pesada, la herramienta *deriva* un
  piso de parada del tamaño de su mezcla y mantiene el entrenamiento a través de la
  **meseta** — la fase donde el modelo ha terminado el aprendizaje sintético fácil y
  aún no ha transferido a calidad real. Esto previene la
  "muerte de media época", donde la parada temprana ingenua se detiene en una vigésima del
  plan. Cada intervención imprime la trayectoria de pérdida de desarrollo y la razón, en
  lenguaje natural.
- **Matemática de exposición + sintético etiquetado.** Los datos de oro se ponderan hacia arriba (se repiten) para que
  los pocos datos reales no se ahoguen; el manifiesto anota la **exposición efectiva
  por oración única** para que un A/B sea justo. Las fuentes sintéticas llevan una
  etiqueta; el oro permanece sin etiquetar para que ancle el estilo de salida.

👀 **Cómo leer el resultado.** La ejecución imprime un **informe de desarrollo con intervalos de confianza**
— no hay salida de puntuación desnuda:

```
dev report (95% CIs):
n=42 · set=textbook-dev
  chrf++       44.31  [41.20, 47.15] 95% CI
```

Si ve un mensaje `schedule-sanity` explicando que *mantuvo* el entrenamiento más allá de una parada
prematura, esa es la guardia de meseta funcionando — bien. La ejecución también escribe un
**manifiesto**: hash de configuración, hashes de archivo de datos, semillas, y la programación derivada, para que
la ejecución completa sea reproducible.

---

## Paso 6 — Evalúe honestamente

Tiene un modelo. Antes de puntuarlo en el conjunto de prueba, escribe lo que
espera — *primero*.

> 🗣️ **Indíquele a su agente:** *"Escriba un preregistro para la puntuación del conjunto de prueba —
> nuestra métrica predicha, dirección y margen — luego decodifique el conjunto de prueba y
> puntúelo."*

```bash
# 1. Predict BEFORE you peek
nmt-forge prereg new run1 --eval-set textbook-test --predictions preds.json

# 2. Now score (decode first, then score the actual output)
nmt-forge score --eval-set textbook-test --hyps decoded.txt
```

🛠️ **Lo que hace la herramienta — las guardias anti-narración.**

- **Preregistro.** Puntuar un conjunto de **prueba** registrado requiere un
  preregistro escrito *antes* de la primera mirada. Sin él, la tabla de comparación simplemente
  **se niega a renderizar**:

  ```
  [preregister] no preregistration for eval set 'textbook-test'
    why: results looked at without written-down expectations become
         post-hoc stories
    fix: write one FIRST: nmt-forge prereg new ... — then score
  ```

  Esta es la guardia contra vestir postdicciones ("por supuesto que mejoró en
  historias orales") como predicciones. Escribir las conjeturas que *fallan* es lo que
  hace que las que tienen éxito sean confiables.
- **Intervalos de confianza, siempre.** Cada puntuación se renderiza con su IC de bootstrap del 95%;
  no hay salida sin IC. Un aumento `+0.5` cuyos intervalos se superponen no es una
  victoria.
- **El libro mayor de evaluación.** Cada lectura de cada conjunto de evaluación se registra (solo anexar,
  a prueba de manipulaciones). Pregunte `nmt-forge ledger show --set textbook-test` cuánto "gastado" está un
  conjunto. Los conjuntos **Sellados** son de un solo disparo — puntuados una vez, luego cerrados.

👀 **Cómo leer el resultado.** Lea el número **con su intervalo y por
registro**, y verifique **qué métrica creer** antes de celebrar:

```bash
nmt-forge score --eval-set textbook-test --hyps decoded.txt \
    --metric chrf++ --metric comet --target-lang nav
```

`nmt-forge discover` muestra la **confiabilidad medida** de cada métrica para su
familia de lenguas (de las meta-evaluaciones de WMT). Para algunas familias una métrica como
BLEU apenas rastrea el juicio humano mientras COMET lo hace; para muchas familias de recursos limitados
la respuesta honesta es *no medida* — en cuyo caso el juicio de hablantes nativos, no
ningún número automático, es la señal real. Vea
[Confiabilidad de métrica](/docs/network/specifications/metric-reliability).

:::tip[El árbitro propio de su lengua]
Si su lengua tiene un estándar de evaluación LYSS (un linter que sabe, digamos, que dos
ortografías difieren solo por una convención de vocal larga documentada), conéctelo con
`--plugin` y puntúa junto a chrF++ — e incluso puede *seleccionar* puntos de control,
así que el modelo que gana es el que el árbitro propio de la lengua prefiere. Cada
número de complemento también obtiene un intervalo de confianza.
:::

---

## Paso 7 — Itere

Ahora mejora — y cada mejora se mide de la misma manera honesta.

> 🗣️ **Indíquele a su agente:** *"Cambie una cosa — agregue un tipo de plantilla / más
> datos retrotraducidos / un modelo base diferente — reentrenamiento, y A/B contra la
> ejecución anterior en el conjunto de desarrollo, con significancia."*

```bash
nmt-forge compare --eval-set textbook-dev \
    --hyps-a run1.txt --hyps-b run2.txt --metric chrf++
```

🛠️ **Lo que hace la herramienta.** `compare` ejecuta una **prueba de significancia emparejada**, no
solo una resta, así que "B vence a A" es una afirmación que la estadística respalda — no
ruido. Itere en el conjunto de **desarrollo** (para eso sirve); mantenga el conjunto de **prueba**
para verificaciones infrecuentes y preregistradas; mantenga cualquier conjunto **sellado** para el final.

👀 **Cómo leer el resultado.** Una mejora real despeja su intervalo de confianza
*y* la prueba de significancia. Si no lo hace, aprendió algo de todas formas — que
esa palanca es más débil de lo que esperaba, lo cual vale la pena saber. Las guardias de meseta/cobertura/
fuga significan que los números que está comparando son confiables, así que puede
realmente creer en su propio bucle de iteración.

Palancas comunes siguientes, aproximadamente en orden de retorno para una lengua hambrienta de datos:

1. **Más cobertura** en síntesis — agregue los fenómenos gramaticales faltantes que el
   informe de cobertura marcó.
2. **Retrotraducción** — convierta texto de destino monolingüe en más pares de entrenamiento.
3. **Un modelo base más grande o mejor adaptado**, o ajuste de rango LoRA/hiperparámetro.
4. **Currículo** — preentrenamiento en sintético, luego ajuste fino en los pares reales.

---

## Paso 8 — Llévelo a la Red

Un modelo entrenado honestamente es exactamente lo que la [Red de Champollion](/docs/network/)
está construida para recibir.

> 🗣️ **Indíquele a su agente:** *"Empaquete este modelo como un método y envíelo a la
> tabla de clasificación para nuestro par de lenguas."*

- **[Envíe un método](/docs/network/getting-started/submit-a-method)** convierte
  su modelo en una entrada de Red, puntuada en corpus de referencia públicos y
  atribuida a usted.
- Porque su evaluación fue limpia — disjunta por grupo, cercada de desarrollo, auditada por fugas,
  con IC, preregistrada — su envío sobrevive al escrutinio que hunde la mayoría de
  afirmaciones de MT de recursos limitados. La arquitectura anti-juego (conjuntos de prueba secretos de propiedad comunitaria,
  verificaciones de reproducibilidad, validación de hablantes nativos) no es un
  obstáculo para un modelo construido de esta manera; es un sello de credibilidad.
- Si un **premio** está abierto para su lengua, un método de pie, mejor que la línea base
  construido honestamente es exactamente lo que un fondo patrocinado recompensa. Y cuando un
  método funciona para una lengua indígena, **la propiedad puede transferirse a la
  comunidad** — usted lo construye aquí y ellos lo despliegan, en sus términos. Vea la
  [Especificación de premio](/docs/network/specifications/prizes) y
  [Transferencia de propiedad](/docs/network/sovereignty/ownership-transfer).

---

## El arco completo, en un aliento

1. **Descubra** qué tiene la lengua (`discover`, `init`) — la ausencia es desconocida, no cero.
2. **Apunte a** un analizador + diccionario si existen (peldaños 3–4), respetando sus licencias.
3. **Sintetice** datos de entrenamiento verificados, citados, verificados por cobertura (`synth`) — o **retrotraduza** texto monolingüe.
4. **Divida** datos reales disjuntos por grupo y registre los conjuntos de evaluación (`split`).
5. **Entrene** una configuración, cercada de desarrollo, auditada por fugas, consciente de meseta (`run`).
6. **Evalúe** con predicciones escritas primero, IC siempre, la métrica correcta (`prereg`, `score`).
7. **Itere** con A/Bs probados por significancia (`compare`).
8. **Envíe** a la Red — donde el trabajo honesto es el punto.

Nunca tuvo que memorizar las diez formas en que los resultados de MT de recursos limitados salen mal. La
herramienta hizo que el camino honesto fuera el predeterminado y rechazó los atajos con una
explicación. Esa es la idea completa: **las barreras de seguridad atrapan los errores de aficionado
para que pueda enfocarse en la lengua.**

## Continúe

- [**MT Training in Plain Language**](/docs/network/context/mt-training-concepts) — cada término aquí, definido con un ejemplo.
- [**Train a Model Honestly**](/docs/network/getting-started/training-honestly) — las diez barreras de seguridad en una página, cada una con su historia medida.
- [**Fine-Tuned Model**](/docs/network/tutorials/fine-tuned-model) y [**Back-Translation**](/docs/network/tutorials/back-translation) — libros de recetas más profundos en técnicas específicas.
- [**Corpus Creation**](/docs/network/tutorials/corpus-creation) — construir los datos reales en los que todo lo demás descansa.
