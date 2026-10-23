---
title: "Acompañar a las personas"
slug: /agents/coaching
description: "Cómo un agente de IA comparte el reporte de ronda de Champollion y conversa con las personas que construyen un traductor: el progreso primero, cada número con su unidad y conjunto, ánimos solo ante mejoras medidas, pedir tiempo sin presiones y sin prometer nada sobre la calidad."
---

# Orientar a las personas

Los rieles miden. Usted transmite. La mayor parte de lo que las personas
escuchan sobre su traductor llega a través de usted, por lo que la forma en que
lo dice es parte del trabajo. Esta página explica cómo decirlo: qué contiene el
informe de la ronda, cómo transmitirlo, cómo pedir tiempo y qué palabras usar.

Las reglas subyacentes están en [el contrato](/docs/agents/contract) §5: diga
solo lo que sea verdad, transmita cada advertencia palabra por palabra, prometa
proceso y nunca calidad, dé a cada número su unidad y el conjunto en el que se
midió.

## El informe de la ronda

Cada ronda de mejora termina con `champollion improve report` (el paso
`improve-report` del recorrido, modo `auto`). Escribe
`improve/round-<k>/report.json` e imprime cuatro partes; `--json` imprime el
mismo objeto:

| Campo | Qué contiene |
|---|---|
| `round` | La ronda en curso: una más allá de las rondas que forge ha juzgado |
| `progress` | Líneas, en orden: la tendencia en las calificaciones del hablante, luego las calificaciones de cada ronda (cada una seguida, en una ronda cuya hoja mezcló borradores de otro modelo, por la comparación a ciegas), luego el veredicto de cada ronda sobre el conjunto de desarrollo |
| `checks` | Advertencias sobre lo que los números pueden y no pueden mostrar |
| `projection` | Una estimación aproximada de cuántas oraciones de entrenamiento más se necesitan para llegar a "funcional", contadas por duplicación de las mismas, con un rango —o por qué no hay ninguna— o `null` antes de dos rondas de calificaciones |
| `projection_numbers` | La misma estimación en números: `more_sentences`, `range` (`[fewest, most]` oraciones de entrenamiento; `most` es `null` cuando las comprobaciones no pueden acotarlo) y `speaker_hours` —o `null` cuando no hay proyección |
| `actions` | De una a cuatro cosas para hacer a continuación |

Lee únicamente los registros que conservan las rondas —el `marks.json` del
hablante por ronda y los veredictos `improve-compare` de forge— e imprime
recuentos y porcentajes, nunca una oración.

### Qué significa cada línea

**Las calificaciones del hablante: la medida que importa.** En cada ronda, el
modelo en uso redacta las oraciones que escribió la familia, y el hablante marca
cada borrador como `Y` (correcto), `N` (incorrecto, indicando cómo se dice) o `?` (con dudas). La
proporción de aciertos se cuenta sobre los borradores marcados como `Y` o `N`, con un intervalo de Wilson del 95%:

> Ronda 1: el hablante marcó como correctos 9 de 24 borradores de oraciones
> nuevas — 38% (rango del 95%: 21%–57%).

Estas son oraciones nuevas —redactadas antes de que cualquier modelo las aprendiera—, de modo que esta es
la medida fuera de muestra. En una ronda cuya planilla mezcló borradores de otro
modelo, estos recuentos corresponden únicamente a las filas del modelo en uso. Las filas mostradas de nuevo
(a continuación) nunca se incluyen en ellos.

**Filas mostradas de nuevo.** A partir de la ronda 2, aproximadamente una de cada diez filas es un borrador que el
hablante ya marcó en una planilla anterior, devuelto sin marcar. La planilla lo indica
en la parte superior —*"Algunas filas más abajo regresan de planillas anteriores a propósito.
Por favor márquelas desde cero, como si fueran nuevas: la frecuencia con la que coincidan las marcas indica cuánto se puede
confiar en ellas".*— y nunca dice cuáles son. `improve marks` imprime *"Filas
mostradas de nuevo: el hablante marcó A de J del mismo modo que antes (P%)"*, con
los cambios en cada sentido. Estas filas nunca se cuentan en la proporción de la ronda y
nunca se vuelve a entrenar con ellas; le toman al hablante unos 10 segundos por fila
([medición](/docs/agents/measurement#the-speakers-marks)).

**La comparación a ciegas.** Un segundo modelo redacta la mitad aleatoria de
los borradores de una hoja, sin marcas, y el hablante juzga ambos sin saber cuál
es cuál ([medición](/docs/agents/measurement#the-speakers-marks)). El segundo
modelo es el más reciente cuando no se puso en uso; en la visita posterior a una
promoción, es el modelo al que reemplazó el nuevo. El informe agrega una línea:

> Ronda 2: A ciegas, sobre oraciones nuevas: el modelo en uso se marcó como
> correcto en 5 de 12 (42%), el modelo más nuevo (no en uso) en 7 de 12 (58%) —
> sin diferencia clara en 24 oraciones.

Después de una promoción dice *"el último modelo puesto en uso se marcó como
correcto en …, el modelo al que reemplazó en …"*. Termina de una de tres maneras
(una prueba de dos proporciones al 5%): para un modelo más nuevo, *el modelo más
nuevo es claramente mejor en las oraciones que la familia necesita* o *el modelo
en uso es claramente mejor*; después de una promoción, *el nuevo modelo es
claramente mejor en las oraciones que la familia necesita* o *el modelo al que
reemplazó era claramente mejor —el nuevo no ha ayudado en las oraciones que la
familia necesita—*; o *sin diferencia clara en N oraciones*. Si hay muy pocas
filas marcadas de un modelo, dice *"se juzgaron muy pocas filas de un modelo
para comparar"*.

**La tendencia.** El informe llama a un aumento *progreso real* solo cuando se
cumplen las tres condiciones:

- el rango de la última ronda queda totalmente por encima del de la primera ronda (su extremo inferior
  por encima del extremo superior de la primera);
- se puso en uso un modelo de una ronda intermedia —elegido por la gente
  (los registros `export` y `choose` de forge): tras un veredicto de **better** y
  su confirmación, según las marcas a ciegas de la persona hablante, o por su propia elección. Un
  veredicto de **better** por sí solo no cuenta; y
- al evaluar a ciegas en las mismas visitas, la persona hablante calificó el nuevo modelo como correcto
  con una frecuencia claramente mayor que aquel al que reemplazó (las revisiones después de cada
  ascenso, combinadas; una prueba de dos proporciones al 5%).

La tercera condición está ahí porque la forma de marcar de un hablante puede variar con el tiempo: alguien que se vuelve
más benévolo en cada ronda eleva todos los porcentajes, pero en una misma visita afecta a ambos modelos
por igual. En una simulación con un hablante que marca incorrectamente el 10% de los borradores y
se vuelve más benévolo en cada ronda, una promoción en la que el conjunto de práctica se equivocó por azar
se interpretó como progreso real en 106 de 1,600 informes donde el modelo no podía
mejorar; con la verificación a ciegas, 3 — y como máximo 3 de 1,600 nuevamente al repetir la prueba
con el límite mínimo de 50 oraciones y el veredicto del hablante, incluidas las ejecuciones cuyo
conjunto de práctica comienza en 30 oraciones.

Un aumento con una promoción pero sin esa comprobación se imprime como *aún no
se cuenta como progreso real: la benevolencia con la que se marcan los
borradores también pudo haber cambiado* —con los recuentos de la comprobación, o
indicando que la siguiente hoja mezcla borradores de ambos modelos—. Un aumento
con el mismo modelo en uso se imprime como *no se cuenta como progreso*:
cambiaron las oraciones o la forma de calificar, no el modelo. Un aumento dentro
de los rangos se imprime como *en alza, aunque todavía dentro del margen de
incertidumbre*.

**El veredicto del conjunto de desarrollo.** Forge compara el nuevo modelo con
el que está en uso sobre las mismas oraciones de desarrollo (práctica), oración
por oración:

> Ronda 1: en las mismas 50 oraciones de práctica (dev), chrF++ (0–100, superposición
> con la traducción revisada) 24.1 para el nuevo modelo frente a 22.0 para el
> modelo en uso — sin cambio medible: no se usa (en 50 oraciones solo una
> diferencia de aproximadamente 5.8 puntos o más se nota de manera confiable).

Cómo termina la línea depende del veredicto y de si la gente eligió
el modelo de la ronda (los registros `export` y `choose` de forge) — un veredicto por sí solo
no pone nada en uso:

| Veredicto | No elegido | Elegido |
|---|---|---|
| **better** | *mensurablemente mejor: no puesto en uso — la gente no lo ha elegido* | *mensurablemente mejor: puesto en uso* |
| **worse** | *mensurablemente peor: no usado* | *mensurablemente peor — puesto en uso …* |
| **no-change** | *sin cambio mensurable: no usado* | *sin cambio mensurable — puesto en uso …* |
| **too-few** | *muy pocas oraciones de práctica para saberlo (menos de 50): deciden las marcas a ciegas de la persona hablante* | *muy pocas oraciones de práctica para saberlo (menos de 50) — puesto en uso …* |

"Puesto en uso …" termina *según las marcas a ciegas de la persona hablante* cuando forge contiene un
veredicto de la persona hablante para ese modelo con `clear: newer` (`improve-speaker`), y
*por elección propia de la gente* en caso contrario. `champollion improve status` usa las
mismas palabras: la línea de cada ronda termina con *"· nuevo modelo en las oraciones de práctica (dev): …"*. La regla del veredicto está en
[medición](/docs/agents/measurement#comparing-two-models).

**Las comprobaciones.**

- *Sobreajuste.* Si el chrF++ de dev del modelo en uso subió 3 puntos o
  más a lo largo de las rondas (el nuevo modelo de la última ronda cuenta solo una vez que
  la comunidad lo eligió) mientras que la proporción correcta del hablante subió 2 puntos o menos,
  el informe indica que la mejora puede pertenecer a las oraciones de práctica y que se debe
  confiar en las marcas.
- *Un conjunto de dev demasiado pequeño para ver una mejora.* Cuando la menor diferencia que el conjunto de dev
  muestra con fiabilidad es de más de 3 puntos de chrF++ (o, si se desconoce, menos de 50
  oraciones), el informe indica que "ningún cambio medible" es el límite del conjunto de dev,
  no una prueba de que la ronda no haya servido de nada.
- *Cuánto se puede confiar en las marcas.* Una vez que se evalúan 10 filas mostradas de nuevo,
  a lo largo de todas las rondas: *"El hablante marcó A de J filas mostradas de nuevo del mismo modo que
  antes (P%): aproximadamente el E% de las marcas cambia al revés al azar, lo que empuja
  cada proporción marcada como correcta hacia el 50%; la proyección lo tiene en cuenta".* Cuando
  los borradores que antes estaban mal y ahora se marcaron como correctos superan claramente a los del sentido inverso (una prueba
  de signos al 5%, 6 cambios o más), añade *"es posible que la calificación se esté volviendo más benévola,
  algo que un aumento en la proporción no reflejaría"*. Antes de 10: *"N filas mostradas
  de nuevo evaluadas hasta ahora; el propio error de calificación del hablante se estima a partir de
  10".*

**La proyección.** Se realiza únicamente cuando el aumento representa un progreso real (los tres puntos
anteriores) y la proporción correcta aún está por debajo del 80% —la palabra que usan los rieles para referirse a que
*funciona* en las oraciones que la familia necesita—. Las curvas de aprendizaje aumentan en pasos aproximadamente
uniformes por cada duplicación de las oraciones de entrenamiento, por lo que toma el paso de
las revisiones a ciegas del hablante de cada nuevo modelo frente al que reemplazó
(se registran los pares de entrenamiento de ambos modelos) e indica cuántas oraciones de entrenamiento
más se necesitan para alcanzar el 80% marcado como correcto, con un intervalo, y las horas del hablante a
razón de unos 70 segundos por oración (un minuto para redactar, diez segundos para marcar). El
intervalo cubre lo que permiten las revisiones (95%) y, una vez que se evalúan 10 filas mostradas de nuevo,
dónde podría situarse el "verdaderamente correcto en el 80%" según las propias marcas de este hablante; el
texto dice entonces *"los borradores verdaderamente correctos en el 80% pueden marcarse como correctos cerca del T% de
las veces según sus marcas; el intervalo tiene eso en cuenta"*. Antes de eso, dice
*"(El propio error de calificación del hablante aún no se ha tenido en cuenta: se han evaluado muy pocas filas
mostradas de nuevo)"*. La estimación en sí se mantiene en el 80%
simple. Los recuentos se redondean a dos cifras. Cuando las revisiones no pueden acotarlo,
indica que *"aún no se puede determinar cuántas más podría tomar"*. De lo contrario, explica
por qué no la hay; por ejemplo, *"la revisión a ciegas del hablante aún no ha mostrado
que el nuevo modelo supere al que reemplazó, por lo que el aumento podría estar en la
calificación y no en el modelo"*. Diga siempre que se trata de una estimación aproximada; el informe lo hace.
En simulación, quedó dentro de un factor de 2 respecto al recuento real entre el 69 y el 78% de las
veces a 400 oraciones por ronda y entre el 53 y el 56% a 800, y el recuento real cayó
dentro del intervalo entre el 89 y el 94% y entre el 76 y el 80% de las veces (a 800 por ronda, 51–54%
antes de que el intervalo considerara las marcas del hablante); la línea recta a la que
reemplazó, 5% a 400. Nunca diga que un modelo "podría ya estar funcionando" a partir del
error de calificación del hablante: el informe no lo hace, porque en simulación esa
nota se equivocó 2 o 3 veces por cada vez que acertó.

**Las acciones.** Por orden de prioridad, como máximo cuatro: marcar la planilla de esta ronda, o escribir
las oraciones que aún faltan (20 por ronda); cuando la comparación a ciegas determinó que el
modelo más nuevo era claramente mejor, que *"la ronda sí ayudó, incluso donde el
conjunto de práctica no pudo mostrarlo"* — continúe, y ampliar el conjunto de práctica
permite que el siguiente veredicto lo note; cuando el hablante marcó el modelo al que reemplazó una
promoción como claramente mejor, preguntarle a la gente si se restablece el modelo anterior,
y hacer que el conjunto de práctica se parezca más a las oraciones que necesitan; ampliar
el conjunto de práctica, cuando sea demasiado pequeño para notar la ganancia de una ronda y tenga menos de 200
oraciones (*"una de cada 2 oraciones en cada planilla no tiene borrador — el hablante
escribe cómo se dice, y se suma al conjunto de práctica (ahora 31; 50 permite
juzgar una ronda, 200 permite que se note una ganancia de unos 3 puntos)"* — "de cada 4"
a partir de 50); qué hacer tras dos rondas sin ganancia (más abajo); que
el tiempo que el hablante dijo que puede dedicar parece demasiado poco; y, una vez que el extremo
inferior de la proporción correcta alcance el 70%, una verificación en el conjunto de prueba bloqueado — con una
predicción escrita de antemano.

**Dos rondas sin mejora** — los dos últimos veredictos son ambos **no-change** o
**worse** (una ronda con **too-few** no dice nada en ningún sentido, y no cuenta),
sin ningún modelo puesto en uso entre ellas; forge cuenta de la misma manera para la
oferta de un modelo más potente. Donde el conjunto de práctica puede ver la mejora habitual de una ronda,
la acción dice *"Dos rondas sin una mejora que este conjunto de práctica pueda ver
(alrededor de X puntos chrF++ o más): puede que las rondas estén aportando menos que eso, o
nada — no es posible saber cuál de las dos cosas. Caminos más rápidos para avanzar: el modelo más potente que
ofrecen los rieles cuando la computadora puede entrenar uno, o más oraciones del tipo
en que se equivoca."* (X es la diferencia más pequeña que muestra el veredicto). Donde
no puede, indica seguir adelante. Nunca diga ni insinúe que más oraciones no
ayudarán: cerca de la parte superior de la curva, una ronda añade cerca de medio punto chrF++, por debajo de
lo que pueden mostrar 200 oraciones de práctica. En rondas simuladas, la frase anterior
"más de lo mismo podría no ayudar" se dijo en 98 de 1200 informes mientras el
modelo realmente estaba mejorando.

### Cómo transmitirlo

1. **El progreso primero.** Empiece por lo que cambió, en las marcas del hablante.
2. **Cada número con su unidad y conjunto.** "9 de las 24 oraciones nuevas que
   el hablante revisó eran correctas — 38%", nunca "38%". "chrF++ 24.1 sobre 100 en
   las 50 oraciones de práctica", nunca "24.1". Un intervalo indica qué tan seguras están las herramientas,
   not dos resultados: "en algún punto entre 21% y 57% — con 24 oraciones, las
   herramientas no pueden tener más certeza que esa".
3. **Las verificaciones, con claridad.** Si el informe advierte algo, diga qué advierte.
4. **Los siguientes pasos como cosas que pueden hacer.** Convierta cada acción en una oración
   dirigida a la gente, con el archivo que menciona.
5. **Transmita cada advertencia palabra por palabra.**

**Celebre lo que se mide.** Un borrador marcado como correcto, un aumento por
encima de los rangos, un nuevo modelo puesto en uso: dígalo con calidez. Vale la
pena celebrar la primera traducción. Nunca celebre un número que el informe no
califique como progreso.

**"Sin cambio medible": con claridad y amabilidad.** No significa que la ronda
se haya desperdiciado. Explique lo que significa: con esta cantidad de oraciones
de práctica, solo se hace evidente una diferencia de aproximadamente este
tamaño; una mejora menor podría estar oculta; el modelo en uso se mantiene en
uso; las oraciones que el hablante corrigió siguen contando. Luego indique el
siguiente paso.

**"Muy pocas oraciones de práctica para determinar" — no "sin cambio".** Con menos de 50
oraciones de práctica ninguna comparación decide, sean cuales sean las dos puntuaciones; no es
un veredicto sobre el nuevo modelo. Explique qué sucede en su lugar: el modelo en uso
se mantiene por ahora; la siguiente planilla mezcla los borradores del modelo más nuevo, sin marcas,
y las marcas del hablante deciden; una de cada dos filas de la planilla no tiene borrador, y esas
oraciones amplían el conjunto de práctica hasta que se pueda juzgar una ronda con él.

**La comparación a ciegas — con ambos recuentos y lo que hace.** Diga
los recuentos de ambos modelos y el final del informe, tal como están escritos. Cuando el modelo más nuevo
sea claramente mejor, dígalo como lo hace el informe —la ronda sí ayudó, incluso donde
el conjunto de práctica no pudo mostrarlo— y que es el propio
criterio del hablante sobre oraciones nuevas. Tras un veredicto **too-few** o **no-change** sobre
ese modelo, una preferencia clara hace que forge lo ofrezca para su uso: `improve marks`
imprime *"forge lo registró: ofrece poner en uso el modelo más nuevo (la gente da el sí primero)"*, y la oferta llega como el paso `improve-promote`
(más abajo) — pregunte antes de ejecutarlo. Tras un veredicto **worse**, no se
ofrece. Tras una promoción, la misma verificación es la que permite que el informe considere un
aumento como progreso real; cuando dice que el modelo al que reemplazó era claramente
mejor, pregúntele a la gente si se restablece el modelo anterior — nunca lo haga
sin su visto bueno. "Sin diferencia clara" en 24 oraciones significa exactamente lo que dice.
**Nota.** Nunca le diga al hablante qué filas provienen de qué modelo antes
de leer sus marcas.

**Filas mostradas de nuevo: para qué sirven.** Mencione la coincidencia con sus recuentos,
tal como lo hace el informe ("el hablante marcó 17 de 20 filas mostradas de nuevo del mismo modo
que antes — 85%"), y para qué sirve: cuánto se puede confiar en las marcas. Se anuncia en la planilla, no es una verificación oculta del hablante.
Mencione el error aleatorio como lo hace el informe: aproximadamente el E% de las marcas cambia al
revés al azar, lo que empuja cada proporción hacia el 50%, y la proyección
lo tiene en cuenta. Cuando el informe dice *"es posible que la calificación se esté volviendo más benévola"*,
dígalo con claridad y sin culpabilizar: un aumento en la proporción puede deberse entonces a la
calificación y no al modelo. **Nota.** Nunca le diga al hablante qué filas
regresan ni qué marcó antes; la planilla solo indica que algunas filas lo hacen.

**Palabras que el modelo nunca vio.** Cuando `sync` advierte que las claves
*"contienen palabras que el modelo nunca vio durante el entrenamiento; es muy
probable que estén mal traducidas, por muy fluidas que parezcan"*, dígalo con
claridad: es muy probable que esas líneas sean incorrectas aunque se lean bien;
un hablante debería revisarlas, o las oraciones de la siguiente ronda pueden
enseñarle esas palabras al modelo. Nombre las claves, tal como lo hace la
advertencia; usted nunca ve las palabras. La persona las ve en la página de
prueba del modelo, debajo de cada línea. La evidencia, en el idioma inventado de
prueba: las oraciones que contenían una palabra que el modelo no había visto
fueron correctas 0 veces de 358 ([servicio](/docs/agents/serving#words-the-model-never-saw)).

**Las palabras de la lista de deseos.** Su sección "Palabras que nunca ha visto"
pide *"dos o tres oraciones con cada palabra que necesite, cada una diciendo algo
diferente"*: menos palabras, cada una en unas pocas oraciones, le enseñan más al
modelo que muchas palabras una sola vez. Transmítalo de esa forma. En el idioma
inventado de prueba, una palabra vista una vez durante el entrenamiento resultó
correcta entre el 27% y el 29% de las veces, y vista entre 2 y 4 veces, entre el
63% y el 95%; y con 3,200 oraciones de entrenamiento, ByT5-small entrenado con
oraciones seleccionadas por tener la mayor cantidad de palabras nuevas tuvo un
39.4% de 500 oraciones retenidas con el significado correcto, frente al 53.4%
para oraciones cotidianas —requiriendo un poco más de tiempo del hablante (unas
57 horas frente a 54)—.

Nunca califique usted mismo una puntuación como buena o mala. Una persona que
hable con fluidez decide qué es apto para su uso.

## Pedir tiempo

El paso `improve-time` (modo `ask_user`) pregunta cuánto tiempo puede
dedicar el hablante: `per_week` y `total`, cada uno **exactamente como lo
dijo** ("tal vez unas 30 oraciones por semana", "unas pocas horas y luego
vemos"). `champollion improve time` lo registra en `improve/time.json`; el
recuento de oraciones de cada ronda se planifica en función de esto, y el informe
compara la proyección con esa cifra.

- **Nota.** Pregunte una sola vez; nunca presione para obtener más. Si no lo
  saben, transmita lo que dijeron: las respuestas imprecisas también son una
  respuesta.
- **Nota.** Cuando el informe señale que la proyección requiere más oraciones
  que las que permite el tiempo que dijeron tener disponible, dígaselo con
  claridad, junto con las opciones que este menciona: más hablantes, personas que
  ayuden en el proyecto o un objetivo más acotado por ahora (una guía de frases
  para las oraciones que más necesitan). Luego, permítales elegir.

## Los ofrecimientos que hacen los rieles

**Ofrecer un mejor modelo para su uso** (estado de forge `improve-promote`, modo
`confirm`). Un nuevo modelo fue mensurablemente mejor en el conjunto dev — o el conjunto
dev no pudo decidir (**too-few** o **no-change**) y la persona hablante, evaluando
a ciegas, lo calificó como correcto con una frecuencia claramente mayor. Entonces el `why` de forge añade los
recuentos de la persona hablante: *"Al evaluar a ciegas en la misma visita, la persona hablante calificó el
modelo más nuevo como correcto en A de B oraciones nuevas (P%) y el modelo en uso en C de
D (Q%) — una diferencia clara: el modelo más nuevo es mejor en las oraciones que la
familia necesita."* Diga cuál fue. Es una oferta: un veredicto por sí solo no cambia
nada. Usarlo cambia lo que responde su página o aplicación, así que pregunte antes
de ejecutar el paso; con "ahora no", `declined: true`. Solo su confirmación —el
`export` y `choose` del paso— lo pone en uso; hasta entonces el informe dirá
*"mensurablemente mejor: no puesto en uso — la gente no lo ha elegido"*, y
ningún aumento contará como progreso a partir de él. Una vez elegido según las marcas de la persona hablante, la
línea de la ronda dirá *"puesto en uso según las marcas a ciegas de la persona hablante"*.

**Un modelo más potente** (estado de forge `improve-stronger-model`, modo `ask_user`).
Después de dos rondas consecutivas que el conjunto dev pudo juzgar y no muestran mejora —ambas
**no-change** o **worse**; una ronda **too-few** no cuenta—,
contadas a partir del último cambio de modelo (un cambio de ajuste predeterminado, o cualquier modelo que
la gente haya puesto en uso con `choose`, incluido un ascenso según las marcas de la persona hablante),
con el modelo diminuto en uso, los rieles ofrecen ByT5-small
— `byt5-small`, o `byt5-small-lowmem` donde la GPU tiene entre 8 y 15 GB de memoria
para entrenar (menos memoria por paso, más lento): una descarga de aproximadamente 1,2 GB y
un entrenamiento más largo, ideal en Apple silicon o una GPU NVIDIA
([entrenamiento](/docs/agents/training#models)). El campo de respuesta es `try_it`:
`yes` o `not-now`. Diga lo que dice el `why` de forge —cuando el conjunto dev es demasiado
pequeño para ver la mejora de una ronda, que las mejoras pequeñas podrían estar ocultas; de lo contrario, que
las dos rondas no aportaron *"ningún cambio que las oraciones de dev puedan ver (alrededor de X puntos
chrF++ o más): puede que las rondas estén aportando menos que eso, o nada"*. El informe
no dice que más oraciones no estén ayudando, y usted tampoco. "Ahora no"
es una de las respuestas de este paso: pase `try_it: "not-now"` (mediante MCP,
`declined: true` se rechaza aquí). Forge lo registra, mantiene el modelo en uso,
y la oferta solo vuelve después de otras dos rondas similares (**no-change** o
**worse**). Cualquiera de las dos respuestas está bien; la decisión es de ellos.

**Evaluar la predicción.** Tras obtener una puntuación en el conjunto de prueba,
las personas indican si la predicción que escribieron se cumplió (`held`
o `missed`) y quién la juzgó. Léales la predicción y la puntuación con su rango;
nunca la juzgue por ellos.

**Hablantes que aún no han dado su acuerdo.** Se pregunta sobre un archivo en
`waiting_for_agreement` una vez por sesión, con delicadeza. Solo una respuesta
afirmativa de la persona —confirmando que todas las personas cuyas palabras
están en él estuvieron de acuerdo— responde a esto.

## Palabras para las personas

| Diga | En lugar de |
|---|---|
| "una puntuación sobre 100 de qué tan cerca quedan las traducciones de las del propio hablante — chrF++" | "chrF++ 24.1" solo |
| "qué tan seguras están las herramientas: en algún punto entre 21% y 57%" | "IC [0.21, 0.57]" |
| "las oraciones de práctica" (el conjunto dev) | "partición dev" |
| "las oraciones de prueba, guardadas bajo llave" | "conjunto de prueba reservado" |
| "el primer modelo pequeño" | el nombre de su carpeta o de su ejecución |
| "sin cambio medible — en 50 oraciones de práctica, solo se nota una diferencia de unos 6 puntos" | "sin mejora" |
| "muy pocas oraciones de práctica para determinar todavía — con menos de 50, las propias marcas del hablante deciden" | "sin cambio" para un veredicto too-few |
| "un libro de frases: bueno con oraciones parecidas a las que aprendió" | "modelo base de NMT de bajos recursos" |
| "el hablante marcó 9 de 24 como correctas" | "exactitud del 38%" |

Explique cada término la primera vez que aparezca, con un ejemplo antes de la palabra.

## Cuándo sugerir ayuda

- **El proyecto está estancado o piden ayuda a personas.** Diga: *"¿Tiene
  dificultades o quiere ayuda con su proyecto? Hablemos."* —
  [info@champollion.dev](mailto:info@champollion.dev). Nunca es obligatorio; sin
  costos.
- **Necesitan más oraciones, hablantes o capacidad de cómputo de la que tienen.**
  Oriéntelos hacia [Unirse a un proyecto](/docs/join-a-project): otras personas
  pueden ofrecer oraciones, listas de palabras o métodos (solo archivos, por
  ahora), y nada de lo suyo saldrá sin su consentimiento ([alojamiento y participación](/docs/agents/hosting-and-joining)).

## Para profundizar

- [Hacerlo mejor, ronda por ronda](/docs/make-it-better) — el ciclo de mejora
  tal como lo leen las personas.
- [Reglas de medición](/docs/agents/measurement) — la regla del veredicto, los
  rangos y los límites del conjunto de desarrollo.
- [Entrenamiento con nmt-forge](/docs/agents/training) — qué es el modelo más
  potente y cuánto cuesta.
- [El contrato operativo](/docs/agents/contract) §5 — diga solo lo que sea verdad.
