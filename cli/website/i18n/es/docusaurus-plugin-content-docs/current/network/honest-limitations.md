---
title: "Límites técnicos"
description: "Lo que Champollion (aún) no afirma, expuesto con precisión: los límites de la validación morfológica, los niveles de confianza autodeclarados, la validación por parte de hablantes, la custodia de pruebas selladas y por qué no se proporciona un nivel de confianza por oración."
---

# Límites técnicos

> **¿Es nuevo aquí?** [Lo que aún no puede hacer](/docs/what-it-cant-do-yet) explica las
> mismas cosas con palabras sencillas. Esta página es la versión precisa, para
> desarrolladores, investigadores y agentes.

Estas son las afirmaciones que **no** sobrepasaremos. Si cualquier otra parte de este
sitio insinúa más de lo que está escrito aquí, considérelo un error y
[avísenos](/docs/network/perspectives/reporting-errors-and-owning-corrections).

La infraestructura de evaluación solo gana confianza siendo honesta sobre sus
límites. Estos son los nuestros, expresados con claridad suficiente para
verificarlos.

## 1. La validación morfológica profunda depende de un FST *y* de un conjunto de prueba clasificable

La validación morfológica basada en FST —verificar que cada palabra de salida sea una
palabra bien formada en el idioma de destino— necesita dos cosas para un par
de idiomas: un FST fijado por el harness y un conjunto de evaluación para el par que
pueda clasificar. El `GiellaLTFSTMetric` en sí es **genérico**: puntúa cualquier
idioma con un FST de GiellaLT fijado (cree de las llanuras, las lenguas sami,
finés, noruego bokmål, inuktitut y otros). Varios de esos idiomas
tienen conjuntos de evaluación abiertos (Tatoeba, WMT, WMT24++) —la
[página de conjuntos de datos](/docs/network/leaderboard/datasets) enumera el catálogo,
`mt-eval corpora --source eng --target <code>` enumera lo que se puede ejecutar para un par,
y `mt-eval corpora --with-fst` enumera únicamente los pares cuyo destino tiene un
FST fijado, indicando si está instalado en su computadora.
El cree de las llanuras, el idioma con el que comenzó el trabajo de FST, es la excepción: sus
dos conjuntos de evaluación (EdTeKLA) están catalogados como etiquetas en cuarentena y la
base de datos rechaza cualquier puntuación registrada contra ellos.

Se aplican dos límites adicionales. Cuando el FST fijado es solo un **aceptor** de
corrección ortográfica (sami septentrional, amárico, euskera), indica si una palabra existe,
pero no si está flexionada correctamente, por lo que `morphological_accuracy` no se
calcula —y un aceptor acepta algunas palabras en inglés y en mayúsculas, por lo que
la aceptación por FST puede dar crédito a salidas no traducidas (la tarjeta de ejecución muestra entonces una
advertencia de copia de origen; consulte [advertencias de puntuación](/docs/network/specifications/scoring#2-8-score-caveats)). La aceptación por FST es un diagnóstico: nunca entra en el titular de chrF++ ni clasifica una ejecución.
También da crédito a una oración válida repetida para cada entrada; la tarjeta de ejecución
muestra entonces una advertencia de salida casi constante.
Y cada par sin un FST se puntúa con métricas superficiales (chrF++, BLEU)
y comprobaciones de comportamiento. Esas son señales útiles, pero **no**
garantizan la validez morfológica. No afirmamos tener validación morfológica
para ningún idioma sin contar tanto con un FST como con un conjunto de evaluación que pueda clasificar.

## 2. Niveles de confianza: hoy cada fila es autoreportada {#2-trust-tiers-are-self-reported-at-launch}

La mayoría de las puntuaciones las calculan los propios colaboradores ejecutando el entorno de evaluación y
publicando el resultado. La **verificación** —volver a puntuar un envío a partir de sus
propias salidas frente al corpus canónico fijado por SHA— está construida, pero es un
comando de los mantenedores que se ejecuta manualmente: nada lo ejecuta al momento del envío y nada
lo programa, por lo que hoy cada fila llega, y permanece, autoevaluada
([Reglas de envío](/docs/network/leaderboard/rules#verification-tiers)). Lea
la insignia de confianza en cada fila: **"autoreportado" significa exactamente eso**, y es
el valor predeterminado.

## 3. La validación de hablantes de la comunidad aún no ha ocurrido

El premio propuesto requiere una **aceptación de ≥ 70% por parte de hablantes bilingües** (no hay ningún premio abierto). Ese filtro está
especificado y las herramientas para ejecutarlo están en construcción; pero **no se ha realizado ninguna
revisión por parte de hablantes de la comunidad** y **ninguna puntuación en este sitio ha superado el
filtro de hablantes**. chrF++ y cualquier otro número automático son señales de máquinas,
no un veredicto comunitario, razón por la cual ninguna puntuación aquí lleva una etiqueta de calidad.

## 4. El sandbox de evaluación y la ceremonia de claves existen; ningún custodio los ha utilizado

Obtenemos los corpus desde su origen y los fijamos mediante SHA, y las divisiones reservadas están
selladas. Cuando una comunidad posee un conjunto de prueba secreto, se puede evaluar un método
contra él sin que el conjunto salga jamás de sus manos; y esa evaluación
ahora tiene **dos vías**. La
preferida, para modelos neuronales estándar, es la **declarativa**: el participante
envía únicamente datos —pesos en safetensors + un tokenizador declarativo + una configuración—
y el organizador lo ejecuta en su propio motor de inferencia de confianza
(`trust_remote_code=False`, sin conexión; permisivo respecto a la arquitectura porque
la seguridad radica en el formato libre de código, no en el nombre de la arquitectura). No se ejecuta código del participante
en absoluto, por lo que no hay nada que aislar en un sandbox; la verificación de seguridad es una validación
de formato decidible (¿es esto safetensors y no un pickle? ¿sin `trust_remote_code`?), no
un intento de demostrar que un código arbitrario es seguro. Para los métodos que genuinamente son código
(flujos de trabajo, híbridos guiados por LLM), la alternativa es el **sandbox**
aislado de la red (verificaciones estáticas, contenedores `--network=none`, salida exclusiva de puntuaciones, un
transporte de archivos opcional con aislamiento físico real). Dado que el sandbox no tiene red, un
método solo se ejecuta allí si incluye dentro de su paquete cada modelo al que llama: un
híbrido guiado por LLM debe incluir su LLM como pesos abiertos, ya que no se
puede acceder a una API de LLM alojada. El sandbox contiene código no confiable en
lugar de negarse a ejecutarlo, por lo que es la vía sinceramente más débil; su garantía
fundamental es `--network=none` (un análisis estático heurístico no puede evaluar un modelo
binario), y un endurecimiento más profundo (seccomp, microVMs) queda postergado. Consulte
[ejecutar un concurso soberano](/docs/network/sovereignty/run-a-sovereign-contest)
para ver con exactitud qué está activo y qué no. La **ceremonia de claves** del nodo sin conexión
**está construida** —la clave del conjunto se divide en M-de-N y se vuelve a ensamblar únicamente en memoria durante una
ejecución autorizada por cuórum—, pero nunca se ha utilizado con un custodio real, y
las partes son archivos planos en esta primera versión. Lo que **no** está construido: firma
por umbral (una puntuación la firma una sola clave de nodo) y atestación de hardware (los manifiestos
de puntuación se firman únicamente por software). No se ha designado a ningún custodio comunitario de claves,
por lo que la evaluación de **premios** de referencia permanece cerrada hasta que
los custodios y el consentimiento de la comunidad estén establecidos.

## 5. Hoy las claves están en manos del organizador; no se han designado custodios comunitarios {#5-key-custody-is-designed-no-custodians-are-appointed-yet}

**Hoy, las claves de un conjunto sellado están en manos de su organizador** —quienquiera que lo haya sellado,
en su propia computadora. **Champollion no posee partes de las claves.** El *mecanismo*
de custodia para más de un titular está construido: la ceremonia de claves M-de-N del nodo
sin conexión divide la clave de un conjunto entre custodios. Todavía no se ha ejecutado con
custodios reales. Los custodios los eligen las propias comunidades, y no se ha designado
a ninguno: **custodios comunitarios de claves — ninguno designado aún.** La custodia no es
consentimiento: el proceso relacional de consentimiento comunitario sigue su propio camino, más lento
y más importante.

## 6. Medimos métodos en pruebas de rendimiento; no puntuamos traducciones individuales {#system-vs-output}

Se denominan "traducción automática confiable" a dos cosas distintas. Nosotros hacemos una de
ellas.

**A nivel de sistema — lo que hacemos.** Dado un par de idiomas, un conjunto de prueba y un método:
¿cómo puntúa ese método, bajo qué métrica, en qué dominio, en qué
vía de contaminación, en qué nivel de confianza? Esa es una afirmación sobre un *método en una
prueba de rendimiento*, más una afirmación sobre quién estableció el estándar. Las reglas de puntuación están
publicadas, los corpus están fijados y, para una prueba de rendimiento soberana, la comunidad
propietaria del conjunto de prueba decide qué se aprueba. La tabla de clasificación, el mapa, las tarjetas de ejecución
y `mt-eval` son todo esto, y únicamente esto.

**A nivel de salida — lo que no hacemos.** Dada una oración de origen y una
traducción de ella: ¿qué tan probable es que *esa* traducción sea correcta? En traducción automática (MT) y PLN (NLP),
eso es la estimación de calidad y la cuantificación de incertidumbre, y es un campo de investigación
propio. No publicamos **ningún nivel de confianza por segmento en ninguna traducción**,
y nada de lo que hay aquí es una probabilidad calibrada de que una salida determinada sea correcta. Una
fila con puntuación alta no es una garantía sobre la siguiente oración que produzca un método.

El caso inverso es el error más fácil de cometer, y también nos condiciona. Cuando una superficie aquí indica
que ningún método en un par puntúa lo suficientemente bien como para implementarlo —como
hace [servicios de traducción humana](/human-services)—, esa es una declaración sobre
métodos medidos en conjuntos de prueba medidos. Es una buena razón para no distribuir salidas
automáticas para ese par. No es un veredicto sobre ninguna oración en particular.

**La estimación de calidad es un espacio abierto, no una brecha oculta.** El harness ya
calcula una puntuación neuronal sin referencia, AfriCOMET-QE (`qe_score`), como
señal de adecuación para ejecuciones sin referencia de referencia. Se reporta como un
número **a nivel de corpus** en la vía neuronal separada, es recalculado por el
verificador y nunca entra en el titular de chrF++
([Especificación de puntuación](/docs/network/specifications/scoring#how-runs-are-scored)). Las métricas son
complementos ([Especificación de complementos](/docs/reference/plugin-spec)), por lo que una
métrica de QE a nivel de segmento es algo que este harness puede admitir. Hasta que no se integre,
publique y metaevalúe una por idioma de la misma manera que las métricas basadas en referencias
([Confiabilidad de las métricas](/docs/network/specifications/metric-reliability)), no
afirmamos nada sobre salidas individuales.

---

Estos límites se moverán conforme el trabajo avance. Cuando uno de ellos cambie,
esta página cambia con él — y el cambio debe ser visible en el historial de la
página, no desaparecer silenciosamente.
