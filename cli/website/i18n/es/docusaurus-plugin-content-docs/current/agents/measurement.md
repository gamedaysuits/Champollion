---
title: "Reglas de medición"
slug: /agents/measurement
description: "Cómo mide Champollion a un traductor y cómo lo reporta un agente: el estándar de puntuación (chrF++ de corpus con un intervalo bootstrap del 95 %), puntuaciones con umbral, dev frente a test, predicciones, copias casi exactas, el piso del diccionario, la regla del veredicto emparejado y el piso de 50 oraciones debajo de ella, qué guía la lista de deseos, las calificaciones de la persona hablante, la comparación a ciegas entre dos modelos, el veredicto de la persona hablante, filas que se muestran de nuevo (concordancia, error aleatorio, deriva) y cómo expresar un número."
---

# Reglas de medición

Los rieles prometen que la comunidad **sabrá** qué tan bueno es un modelo con sus
propias oraciones, no que sea bueno. Esa promesa se basa en unas pocas reglas, la
mayoría de ellas obligatorias. Esta página las expone con exactitud y termina
explicando cómo comunicar un número.

## El estándar de puntuación (standard/1)

Cada nueva ejecución se puntúa de la misma manera (`arena/mt_eval_harness/scoring.py`):

- **El resultado principal:** **chrF++** a nivel de corpus (sacreBLEU chrF con
  orden de palabras 2), de 0 a 100 (un valor más alto significa más cercano a las
  traducciones de referencia), con su **intervalo de bootstrap del 95 %** y su
  firma de sacreBLEU. Escrito `chrF++ 47.5 [45.9, 49.0]`.
- **Qué segmentos cuentan:** una sola regla para el resultado principal, su
  intervalo y cada comparación. Un segmento cuya traducción falló cuenta como una
  salida vacía: nunca se descarta, nunca se califica como marcador de posición; un
  segmento sin referencia se excluye en todas partes.
- **El intervalo:** el propio del resultado principal: bootstrap percentil sobre
  esos segmentos, 1,000 remuestreos, semilla 12345, α 0.05. Por debajo de 30
  segmentos, las herramientas advierten que el intervalo puede tener una cobertura
  deficiente; con menos de 2 no hay ninguno.
- **A su lado, nunca mezcladas:** BLEU, spBLEU, TER y COMET cuando se haya
  calculado, cada una con su firma o identificador de modelo.
- **Diagnósticos, por separado:** coincidencia exacta, coincidencia equivalente,
  aceptación por FST, precisión morfológica, validador semántico, alternancia de
  código, alucinación, adherencia terminológica, estilo de redacción. Nunca forman
  parte del resultado principal y nunca establecen una clasificación.
- **"Mejor" es una prueba de significancia pareada** en chrF++, nunca dos
  números comparados a simple vista.
- **Sin etiquetas de calidad.** Solo la evaluación humana certifica la calidad.

**En desuso:** la puntuación compuesta ponderada y las etiquetas de niveles de
calidad. Una tarjeta de ejecución standard/1 incluye `composite: null` y `quality_tier: null`.
**Nota.** Nunca presente, calcule ni cite una puntuación compuesta o un nivel,
ni siquiera de una tarjeta antigua.

Las **advertencias de puntuación** son diagnósticos que se escriben junto a una
puntuación, nunca una modificación a ella: `source_copy` (la mitad o más de las
salidas copian el origen), `length_inflation` y `length_deflation` (salidas de más del
doble o menos de la mitad de la longitud de referencia, en promedio, o en una
cuarta parte o más de los segmentos), `near_constant_output` (una salida repetida a través
de muchos orígenes) y `train_test_near_twin` (filas de prueba con una gemela en
entrenamiento; grave cuando la mitad o más la tienen). **Nota.** Transmita cada
advertencia junto con la puntuación, palabra por palabra.

## Medición con compuertas

Cuando una ejecución tiene una cadena de compuertas ([métodos y compuertas](/docs/agents/methods#gate-chains)),
**lo que se mide es lo que se entrega**:

- el chrF++ principal puntúa la salida con compuertas;
- el chrF++ sin compuertas, con su intervalo, se ubica a su lado
  (`overall.gates.ungated`);
- la **tasa de rechazo** (segmentos rechazados por las compuertas ÷ segmentos
  evaluados) es un número independiente, con recuentos por compuerta y por lo que
  se entregó (`shipped_from`: método, origen, respaldo, nada);
- la **huella digital** de la cadena (sha256 de su JSON canónico) acompaña al
  informe y a cualquier ejecución publicada.

**Bloqueo.** Sin respaldo en la medición: `mt-eval run` y `mt-eval test`
rechazan una cadena cuyas compuertas entreguen segmentos rechazados a un
respaldo, antes de que se traduzca o se gaste nada.

**Nota.** Comunique una puntuación con compuertas junto con su puntuación sin
compuertas y la tasa de rechazo. Una puntuación con compuertas por sí sola oculta
lo que las compuertas descartaron.

## Conjuntos y para qué sirve cada uno

| Rol | Para qué se usa | Lectura |
|---|---|---|
| `train` | Aprendizaje | Nunca se evalúa como resultado |
| `dev` (práctica) | Elegir el punto de control; evaluar rondas de mejora (a partir de 50 oraciones); el umbral mínimo del diccionario | Libremente |
| `test` | Hitos: probar un modelo frente a la predicción de la comunidad | Cada lectura para evaluación requiere un prerregistro (forge); cada lectura se registra |
| `sealed` | Una prueba que nadie fuera de sus custodios ve | Una sola vez |

**En nmt-forge** (el registro, `.forge/eval-registry.json`; el libro contable):

- **Bloqueo.** Cada lectura de un conjunto registrado se escribe en el libro
  contable encadenado por hash con su propósito (`score`, `dev-selection`, `audit`, `inspect`).
- **Bloqueo.** Puntuar un conjunto de prueba requiere un prerregistro válido para
  su contenido actual.
- **Bloqueo.** Un conjunto sellado se puntúa una sola vez. Una segunda puntuación
  se rechaza (`sealed set '<name>' has already been spent`); a single `mt-eval`
  del archivo sellado también lo consume. `--override-respend '<reason>'` (en `nmt-forge score`
  y `nmt-forge compare`) se escribe en el libro contable. `export` se rehúsa a
  volver a consumirlo y nombra a `--no-eval`.
- **Bloqueo.** El límite de dev: el entrenamiento necesita un conjunto `dev`
  registrado; las filas de dev no pueden compartir un origen o destino exacto con
  un conjunto de prueba o sellado; ninguna fila de entrenamiento puede ser una fila
  de dev.

**En mt-eval:**

- **Nota.** `mt-eval run` y `mt-eval compare` puntúan un archivo de prueba o
  sellado sin ningún prerregistro y nunca lo rechazan por cantidad de lecturas.
  `mt-eval run` solo añade una línea al registro de lecturas del archivo
  (`<file>.reads.jsonl`) cuando forge creó uno; `compare` y `test` no
  registran nada. Nunca puntúe el conjunto de prueba con mt-eval antes de que la
  predicción de la comunidad esté escrita.

## Predicciones

```bash
nmt-forge prereg new first-model --eval-set project-test --expect "<their words>" --rationale "<their reason>"
nmt-forge prereg new round-2 --eval-set project-test --predictions predictions.json
nmt-forge prereg template --out predictions.json
```

- `--expect` y `--rationale`: una predicción en texto libre sobre chrF++, en
  las propias palabras de la comunidad. El veredicto es de la comunidad:
  `nmt-forge prereg verdict <id> --prediction <n> --held` (or `--missed`) `--by "<who>"`.
- `--predictions <file>`: un arreglo JSON; cada predicción nombra un `metric` y
  un `rationale`, y ya sea un `direction` (`increase`, `decrease`,
  `no_change`) con un `baseline_score` (y un `margin` opcional) —evaluado
  por las herramientas— o un `expect` en texto libre.
- **Bloqueo.** Se rechaza una predicción escrita después de cualquier lectura de
  puntuación del conjunto (por forge o por `mt-eval run`): *"eval set '…' was already read for scoring
  (N time(s): …) before this preregistration"*. `--allow-after-reads` permite que pase, y
  cada informe, exportación y estado lo indica.
- **Nota.** La predicción le pertenece a la comunidad, se escribe antes de que
  exista cualquier puntuación y usted nunca debe reformularla ni restringirla. La
  pregunta de los rieles no sugiere ningún número (*"No number is suggested here, so the guess stays theirs"*);
  tampoco proponga uno usted.

## Copias cercanas

`nmt-forge leak-audit` compara cada par de entrenamiento con cada conjunto registrado de
dev, prueba y sellado:

| Encontrado | Regla | Qué sucede |
|---|---|---|
| Mismo archivo | sha256 | Se descarta |
| Copia exacta | Mismo origen o mismo destino después de la normalización | Se descarta |
| Copia cercana | Los conjuntos de palabras de destino se superponen en ≥ 0.6 (Jaccard) donde uno contiene al otro, o en ≥ 0.9 | Se descarta |
| Hermano de plantilla | Misma estructura de oración, diferente respuesta | Se **conserva** para aprender de ella y se contabiliza, de modo que la puntuación se pueda leer con y sin esas filas de prueba |
| Coincidencia solo de origen | Misma consigna, diferente respuesta | Se conserva, se reporta |

Las oraciones cortas se comparan mediante trigramas de caracteres; las muy
cortas, únicamente por coincidencia exacta. Una fila de prueba es una **casi
gemela** cuando una fila de entrenamiento es idéntica o se superpone con ella
en ≥ 0.6 en cualquiera de los dos lados; cuando la mitad o más de las filas de
prueba tienen gemelas, la puntuación es principalmente memorización, no
traducción, y la advertencia es grave. `--clean-to` escribe el archivo
filtrado; `--drop-test-twins` también descarta las filas de entrenamiento que son
gemelas de una fila de prueba, para obtener una puntuación libre de gemelas.

La primera división de dev de los rieles aplica el mismo umbral: `--near-dupe 0.6`
en `nmt-forge split` conserva las filas cuyas palabras se superponen en ≥ 0.6 en un
solo lado de la línea entre dev y entrenamiento, de modo que la primera
puntuación de dev no guarde memoria de copias cercanas que el filtrado de una
ronda posterior descartaría. `--max-group` limita un grupo de copias cercanas a
la mitad del tamaño de dev más uno, para que un archivo redactado a partir de
plantillas aun así se divida.

**Nota.** Diga "la auditoría de filtraciones encontró..." solo a partir de
`true_now` o del propio resultado de la auditoría; nunca diga por su cuenta
"el conjunto de prueba está limpio".

## El piso del diccionario

`nmt-forge floor <word lists>` traduce el conjunto de dev palabra por palabra con el
diccionario (la frase más larga primero) y lo puntúa con el mismo código que la
puntuación de dev de una ejecución: chrF++ con su intervalo del 95 %. Se ejecuta
en esta computadora, nunca lee el conjunto de prueba y solo registra los nombres
de los diccionarios, los hashes y la cantidad de entradas, a cuántas palabras de
origen llegaron y las puntuaciones. Una ejecución **supera el piso** solo cuando
el extremo inferior de su intervalo de dev está por encima del extremo superior
del intervalo del piso; `nmt-forge status` advierte sobre una ejecución que no lo
hace.

## Comparar dos modelos

**Una ronda de mejora** (`nmt-forge compare-runs <in-use> <new>`): las traducciones de ambos modelos de
las **mismas oraciones de dev**, emparejadas fila por fila; una prueba pareada
de aleatorización aproximada (1,000 ensayos) y un intervalo de bootstrap del
95 % sobre la diferencia.

| Veredicto | Regla |
|---|---|
| **too-few** | menos de 50 oraciones de desarrollo, sin importar las puntuaciones — el modelo en uso se mantiene y deciden las calificaciones a ciegas del hablante (abajo) |
| **better** | 50 o más, p < 0.05 **y** el extremo inferior del intervalo por encima de 0 — el nuevo modelo se ofrece para su uso; se pone en uso solo con el sí de la gente |
| **worse** | 50 o más, p < 0.05 y el extremo superior del intervalo por debajo de 0 |
| **no-change** | cualquier otro caso — el modelo en uso se mantiene |

**Por qué 50.** Medido en las salidas de ByT5-small para el idioma inventado de prueba, con 100 conjuntos de práctica aleatorios por tamaño, según esta regla: con 23 oraciones dev calificó a dos modelos casi iguales (con una diferencia de 0.7 chrF++ en 500 oraciones) como distintos 9 de cada 100 veces, y calificó una ganancia real de +5.9 chrF++ como **better** solo 21 de cada 100 veces; con 50 oraciones, 4 y 96 de cada 100 veces. La diferencia más pequeña observada 8 de cada 10 veces fue de 8.1 puntos chrF++ con 23 oraciones, 5.8 con 50, 4.0 con 100 y 2.8 con 200. Por eso, la primera división de los rieles reserva al menos 50 oraciones dev cuando hay 200 pares o más (uno de cada diez pares filtrados, como máximo 500; con menos de 200 pares, una cuarta parte de ellos, lo que resulta en menos de 50), y las hojas de revisión van ampliando el conjunto con filas de práctica: una de cada dos filas mientras sea menor que 50, y una de cada cuatro hasta llegar a 200.

Cada veredicto también indica la diferencia más pequeña que su conjunto de dev
muestra de manera confiable (8 de cada 10 veces): el ancho del intervalo ×
(1.96 + 0.84) ÷ (2 × 1.96). Cuando eso supera los 3 puntos de chrF++,
"no-change" es el límite del conjunto de dev, no una prueba de que la ronda no
haya servido de nada. El conjunto de dev también eligió el punto de control de la
nueva ejecución, lo que favorece ligeramente al nuevo modelo; **infórmelo**
cuando transmita un veredicto.

Una preferencia a ciegas de la persona hablante por el modelo más reciente (más abajo) hace que forge lo proponga para su uso solo después de un veredicto **too-few** o **no-change** —nunca después de **worse**—, y la comunidad da el sí primero (`improve-promote`, modo `confirm`). Una preferencia a ciegas por el modelo al que reemplazó una promoción nunca lo restituye: la acción del informe de ronda le consulta a la comunidad.

**Dos ejecuciones cualesquiera** (`mt-eval compare <report> <report> --significance`): aleatorización aproximada por
defecto (`--method paired_bootstrap` para la otra), 1,000 ensayos (`--n-bootstrap`), α 0.05,
semilla 12345, sobre las entradas que los informes comparten por id (una
advertencia con menos de 10). chrF++ primero, luego las métricas secundarias. Se
evalúa cada par de ejecuciones; no hay corrección por pruebas múltiples, y la
salida así lo indica.

## En qué se orienta la lista de deseos

`nmt-forge analyze` desglosa el chrF++ de dev de una ejecución por tipo de oración
(con al menos 5 oraciones de dev de ese tipo). Un tipo es el **más débil** —y da
peso a la lista de deseos— solo cuando el intervalo del 95 % sobre cuánto se
puntúan sus oraciones por debajo del resto queda completamente por encima de
cero (intervalo de Welch sobre el chrF++ a nivel de oración). Una puntuación más
baja que podría deberse al azar se reporta como tal (*"… could be chance — the wishlist does not steer by it"*)
y nunca pondera la hoja.

Su sección "Palabras que nunca ha visto" solicita dos o tres oraciones con cada
palabra, cada una diciendo algo diferente, no solo una: en el idioma de prueba
inventado, una palabra vista una vez en el entrenamiento salió bien el 27–29 % de
las veces y una palabra vista 2–4 veces el 63–95 %; y con 3,200 oraciones de
entrenamiento, ByT5-small entrenado con oraciones elegidas por tener la mayor
cantidad de palabras nuevas obtuvo un 39.4 % de 500 oraciones reservadas con el
significado correcto, frente al 53.4 % para oraciones cotidianas, requiriendo un
poco más de tiempo del hablante (alrededor de 57 horas frente a 54).

## Las calificaciones del hablante

En cada ronda de mejora, el hablante marca los borradores de oraciones nuevas del modelo como
`Y`, `N` o `?`. La proporción correcta es `Y ÷ (Y + N)` (omitiendo `?`, las no marcadas, las
filas de práctica y las filas mostradas de nuevo), con un intervalo de Wilson del 95%. Un aumento entre rondas cuenta como
**progreso** solo cuando el intervalo de la última ronda queda completamente por encima del de la
primera, se puso en uso el modelo de una ronda en el ínterin —elegido por las personas
(los registros `export` y `choose` de forge), ya sea tras un veredicto **better**,
según las marcas a ciegas del hablante o por su propia elección; un veredicto **better**
por sí solo no cuenta— **y** las revisiones a ciegas del hablante de cada promoción
(abajo), combinadas a lo largo de las rondas intermedias, marcaron a los nuevos modelos como correctos
claramente con más frecuencia que a aquellos que reemplazaron (|z| > 1.96).
Estas son oraciones que ningún modelo había visto: la métrica que más importa y
con la que conviene abrir ([acompañamiento](/docs/agents/coaching)).

**Dos modelos, a ciegas.** `champollion improve sheet` hace que un segundo modelo redacte una
mitad aleatoria con semilla de las filas redactadas (`nmt-forge draft-newer`), sin marcar:
el modelo entrenado más reciente cuando no es el que está en uso —como después de una ronda
cuyo veredicto fue too-few, no-change o worse— o, en la visita posterior a una
promoción, el modelo al que reemplazó el que está en uso. A qué modelo corresponde cada fila se guarda
junto a la planilla en `improve/round-<k>/sheet-key.json` (`in_use`, `other`,
`relation` `newer` o `replaced`, los pares de entrenamiento de cada modelo `in_use_pairs`
y `other_pairs`, `other_rows`, y `repeat_rows`, a continuación).
`champollion improve marks` luego contabiliza los dos modelos por separado, dejando fuera
de todo esto las filas mostradas de nuevo:

- la proporción correcta mencionada arriba —la medida de avance— cuenta únicamente las filas del modelo en uso;
- cada borrador marcado como correcto y cada corrección se convierte en un par de entrenamiento, sin importar qué modelo lo redactó;
- una prueba de dos proporciones (combinada, bilateral al 5%: |z| > 1.96) indica a qué modelo marcó correcto más a menudo la persona hablante, si a alguno: `clear` es `newer` o `replaced` (el otro modelo), `in-use` o `neither`, registrado en `marks.json` (`blind`) con ambos conteos (`in_use_right`, `in_use_judged`, `other_right`, `other_judged`, `in_use_share`, `other_share`), `other`, `relation` y ambos conteos de pares de entrenamiento; una comparación con un modelo más reciente también conserva `newer`, `newer_right`, `newer_judged` y `newer_share`. Cuando cualquiera de los dos modelos no tiene ninguna fila marcada como `Y` o `N`, `clear` es `null` y el texto indica *"se evaluaron muy pocas filas de un modelo para comparar"*;
- frente a un modelo más reciente, habiéndose evaluado al menos un borrador de cada uno, los conteos pasan a forge (`nmt-forge speaker-verdict`), que ejecuta la misma prueba y registra `clear` (`newer`, `in-use` o `neither`) en su libro contable (`improve-speaker`). Tras un veredicto **too-few** o **no-change** en esa ejecución, `clear: newer` hace que forge proponga el modelo más reciente para su uso; `champollion improve marks` muestra entonces *"forge lo registró: propone poner en uso el modelo más reciente (la comunidad da el sí primero)"* ([entrenamiento](/docs/agents/training#the-improve-rounds)).

Las filas se asignaron al azar, en una sola hoja, evaluadas por el mismo
hablante, en las nuevas oraciones propias de la familia; de modo que una
diferencia clara dice algo que el conjunto de dev puede ser demasiado pequeño
para mostrar, y un cambio en qué tan benevolente sea la calificación del
hablante afecta a ambos modelos por igual. **Nota.** Nunca le diga al hablante
qué filas provienen de cuál modelo antes de que se lean sus calificaciones.

**Filas mostradas de nuevo.** A partir de la ronda 2, `champollion improve sheet` vuelve a incluir una
fila por cada 10 oraciones nuevas en la planilla (`REPEAT_EVERY`; redondeado hacia abajo,
y menos cuando menos cumplen los requisitos): un borrador que el hablante marcó como `Y` o `N` en una
planilla anterior, con su borrador previo, sin marcar, en una posición aleatoria con semilla—
nunca una fila de práctica, una fila que ya fuera una repetición, una ya mostrada
de nuevo o una oración presente en esta planilla. La primera línea de la planilla, sobre el
encabezado, dice: *"Algunas filas a continuación vuelven de planillas anteriores a propósito.
Por favor márquelas desde cero, como si fueran nuevas: la frecuencia con la que coinciden las marcas indica hasta qué punto
se puede confiar en ellas"*. Nunca dice cuáles; `sheet-key.json` las guarda como
`repeat_rows` (`row`, `from_round`, `from_row` y `mark`, la marca
anterior). Le toman al hablante unos 10 segundos por fila.

`improve marks` evalúa cada una únicamente frente a la marca anterior del propio hablante: una
repetición nunca se cuenta en la proporción de la ronda, nunca vuelve a ser un par de entrenamiento
ni se incluye en la comparación a ciegas. `marks.json` incorpora `repeats`: `shown`,
`judged` (marcada como `Y` o `N` esta vez; `?` o en blanco se muestra, no se evalúa),
`agreed`, `agreement` (coincidentes ÷ evaluadas), `wrong_to_right`,
`right_to_wrong`, `wrong_before` (filas evaluadas marcadas en su momento como `N`) y
`rounds_apart_wrong_before`. Muestra en pantalla *"Filas mostradas de nuevo: el hablante
marcó A de J de la misma manera que antes (P%) — W antes incorrectas ahora correctas, R antes
correctas ahora incorrectas. No se cuentan en la proporción de esta ronda ni se vuelve a entrenar
con ellas"*.

Combinadas a lo largo de las rondas, una vez evaluadas 10 o más (`MIN_REPEATS`), el
informe de la ronda extrae dos cosas de ellas:

- **Error aleatorio** `e`, a partir de los cambios de calificación que ocurren en ambos sentidos por igual. Dos marcas de
  un mismo borrador discrepan por azar 2e(1 − e) de las veces, la mitad en cada sentido; con
  d = 2 × min(`wrong_to_right`, `right_to_wrong`) ÷ `judged`,
  e = (1 − √(1 − 2d)) ÷ 2. El error atrae cada proporción hacia el 50%: un borrador que en verdad
  es correcto una proporción p de las veces se marca como correcto e + p(1 − 2e) de las veces, por lo que
  con e = 10% "verdaderamente 80% correcto" se lee aproximadamente como 74%.
- **Desviación**: cambios en un sentido que van más allá de los equilibrados. El informe advierte que la
  calificación podría estarse volviendo más benévola cuando los cambios de antes-incorrecto-ahora-correcto superan
  claramente al sentido contrario: 6 cambios o más y una prueba de signos,
  (`wrong_to_right` − flips ÷ 2) ÷ √(flips ÷ 4) > 1.96.

Su línea de verificación: *"El hablante marcó A de J filas mostradas de nuevo de la misma manera que
antes (P%): cerca del E% de las marcas van en sentido contrario por azar, lo que atrae cada
proporción marcada como correcta hacia el 50%; la proyección lo toma en cuenta"*. — y sobre la
desviación, *"Y W borradores marcados antes como incorrectos ahora están marcados como correctos, frente a R en
sentido contrario: la calificación podría estarse volviendo más benévola, algo que un aumento en la proporción
no mostraría"*. Con menos de 10 evaluadas: *"N filas mostradas de nuevo evaluadas hasta ahora; el
error de calificación propio del hablante se estima a partir de 10"*.

**Hacia dónde apuntan las rondas.** La proyección del informe de la ronda se calcula únicamente a partir
del progreso real (arriba) mientras la proporción correcta sea inferior al 80%. Las curvas de aprendizaje
aumentan en pasos aproximadamente uniformes en log-odds por cada duplicación de los datos de entrenamiento, por lo
que toma el paso de las mismas revisiones a ciegas tras las promociones: la suma de
`logit(in_use_share) − logit(other_share)` sobre la suma de
`log2(in_use_pairs ÷ other_pairs)` (proporciones acotadas al 1–99%), con un rango del
95% a partir de la varianza de cada proporción, alrededor de 1 ÷ (n·p·(1 − p)) para n borradores
evaluados. A partir de los pares de entrenamiento del modelo en uso, indica cuántos más se necesitan para alcanzar el
80% marcado como correcto —la estimación— y las horas de dedicación del hablante a 70 segundos por
oración. El rango abarca el intervalo del paso (sin límite superior más allá de seis duplicaciones
adicionales) y, una vez evaluadas 10 filas mostradas de nuevo, dónde podría situarse "verdaderamente correcto al
80%" según las marcas de este hablante: e + 0.8(1 − 2e) + 0.2 × K, como máximo
97%, donde K es la desviación por ronda (cambios más allá de los equilibrados, sobre cuántas
rondas de distancia separaban las dos marcas de las filas antes incorrectas) multiplicada por las rondas
entre la primera y la última marca, con un tope de ±30%. El mínimo es el menor de los dos objetivos en el límite
superior del paso, y el máximo es el mayor en su límite inferior; un mínimo de 0 se lee como
"ninguno". Luego, el texto añade *"La propia calificación del hablante: marcó A de J
filas mostradas de nuevo de la misma manera que antes (P%), por lo que cerca del E% de las marcas van en
sentido contrario por azar … los borradores verdaderamente correctos al 80% podrían marcarse como correctos alrededor del T%
de las veces en sus marcas; el rango toma esto en cuenta"* (indicando, cuando K es
1% o más en cualquier sentido, con qué frecuencia mayor o menor los borradores marcados antes como incorrectos
ahora se marcan como correctos); antes de eso, *"(Aún no se contempla el error de calificación propio del hablante:
se han evaluado muy pocas filas mostradas de nuevo)"*. `report.json`
registra las cifras como `projection_numbers` (`more_sentences`, `range`,
`speaker_hours`).

En simulación —un hablante con ruido, la propia partición dev de las guías y estas reglas
de veredicto, 200 ensayos por escenario en dos conjuntos de semillas— la estimación quedó
dentro de un factor de 2 respecto al recuento real entre el 69 y el 78% de las veces con 400 oraciones
nuevas por ronda y entre el 53 y el 56% con 800, y el recuento real cayó dentro del
rango entre el 89 y el 94% y entre el 76 y el 80% de las veces (sin repeticiones, 91–93% y 51–54%).
Ajustar la estimación en sí a las marcas del hablante ayudó con 800 por ronda y
perjudicó con 400 (dentro de un factor de 2: 64% y 19%), por lo que se mantiene en el
80% simple. Se probó y descartó una nota que señalaba que el modelo "podría ya estar funcionando":
se equivocaba 2 o 3 veces por cada vez que acertaba. Una estimación aproximada, declarada como tal.

## Lo que los números no dicen

- Una puntuación es para el sistema en ese conjunto, no para una oración
  individual: no existe una confianza por oración.
- chrF++ mide la superposición con una referencia. Una buena traducción
  redactada de forma distinta puede obtener una puntuación baja; una traducción
  fluida pero incorrecta puede obtener una puntuación bastante alta.
- La aceptación por FST dice que las palabras existen, no que una oración
  signifique lo correcto.
- Las filas de la tabla de clasificación publicadas se basan en autoinformes
  por defecto; el verificador vuelve a puntuar las salidas enviadas contra el
  corpus fijado por hash (dentro de 1.0 chrF++), y no vuelve a ejecutar los
  métodos.

## Cómo comunicar un número

Cada número lleva **su unidad, lo que mide y el conjunto sobre el que se
midió**, con el tamaño del conjunto y el rango cuando lo haya.

| Diga | Nunca diga |
|---|---|
| "chrF++ 24.1 de 100 en las 50 oraciones de práctica (dev), rango 20.6–27.6" | "24.1" · "24% de precisión" |
| "la persona hablante marcó 9 de 24 borradores nuevos como correctos — 38% (21%–57%)" | "38% de precisión" |
| "sin cambio medible: en 50 oraciones dev solo se aprecia una diferencia de unos 5.8 puntos" | "mejoró ligeramente" |
| "muy pocas oraciones de práctica para saberlo aún: con menos de 50, ninguna comparación decide; las marcas a ciegas de la persona hablante lo harán" | "sin cambio" para un veredicto **too-few** |
| "en las 50 oraciones de prueba bloqueadas, una sola vez, contra la predicción que usted escribió: '…'" (sus palabras, leídas de vuelta) | una puntuación de prueba sin conjunto ni predicción |
| "a ciegas, en oraciones nuevas, la persona hablante marcó el modelo más reciente como correcto en 7 de 12 y el modelo en uso en 5 de 12 — sin diferencia clara en 24 oraciones" | "el nuevo modelo es mejor" basándose solo en las marcas |
| "chrF++ 31.0 con compuertas (lo que se entrega), 33.5 sin compuertas, 12% rechazado por las compuertas" | la puntuación con compuertas sola |

- Un rango refleja qué tan seguras están las herramientas, no dos resultados.
- Dos puntuaciones en conjuntos diferentes no son comparables. Dos puntuaciones
  en el mismo conjunto difieren solo cuando la prueba pareada así lo indica.
- Cite las advertencias y avisos palabra por palabra.
- Nunca califique una puntuación de buena o mala; nunca le adjunte una palabra
  sobre calidad. Un hablante fluido decide qué es apto para su uso.

## Para profundizar

- [La especificación de puntuación](/docs/network/specifications/scoring) y
  [la significancia](/docs/network/specifications/significance).
- [La tarjeta de ejecución](/docs/network/specifications/run-card) — lo que
  registra una ejecución puntuada.
- [Confiabilidad de las métricas](/docs/network/specifications/metric-reliability) —
  qué métrica se ha verificado contra juicios humanos para cuáles idiomas.
- [Los límites técnicos](/docs/network/honest-limitations).
- [Las barreras de protección](/docs/guardrails) — la versión para la comunidad.
