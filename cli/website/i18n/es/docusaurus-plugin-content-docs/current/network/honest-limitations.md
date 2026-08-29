---
title: "Limitaciones Honestas"
description: "Lo que Champollion aún no afirma hacer. Los límites verificables en nuestra evaluación, niveles de confianza, validación comunitaria e infraestructura reservada."
---

# Limitaciones Honestas

> Estos son los compromisos que **no** excederemos. Si algo más en este sitio
> implica más de lo que está escrito aquí, trátelo como un error y
> [cuéntenos](/docs/network/perspectives/reporting-errors-and-owning-corrections).

La infraestructura de evaluación solo gana confianza siendo honesta sobre sus
límites. Estos son los nuestros, expresados con claridad suficiente para
verificarlos.

## 1. La validación morfológica profunda actualmente cubre un solo par

La validación morfológica basada en FST — verificar que cada palabra de salida
sea una palabra bien formada en el idioma de destino — en la práctica está
configurada para **inglés → Plains Cree solamente**. El `GiellaLTFSTMetric` en sí es
**genérico**: califica cualquier idioma con un analizador GiellaLT `.hfstol`
publicado (Plains Cree, los idiomas sámi, finlandés, noruego bokmål, inuktitut
y otros), así que la capacidad es amplia. Pero **los corpus de evaluación existen
solo para Plains Cree** hoy, así que crk es el único par que se califica con FST
en la práctica. Todos los demás pares en la tabla de clasificación se califican
con métricas de superficie (chrF++, BLEU) y verificaciones de comportamiento.
Estas son señales útiles, pero **no** garantizan validez morfológica. No
reclamamos validación morfológica para ningún idioma sin tanto un FST como un
corpus de evaluación.

## 2. Los niveles de confianza se autoinforman al lanzamiento

La mayoría de las puntuaciones se calculan mediante colaboradores que ejecutan
el harness ellos mismos y publican el resultado. La **verificación** del lado del
servidor — recalificar un envío contra el corpus canónico fijado por SHA — existe
y se está expandiendo, pero "verificado" aún no es universal. Lea la insignia de
confianza en cada fila: **"autoinformado significa exactamente eso"**, y es el
valor predeterminado.

## 3. La validación de hablantes de la comunidad aún no ha ocurrido

Nuestro premio requiere **≥ 70% de aceptación de hablantes bilingües**. Esa
puerta está especificada, y la herramienta para ejecutarla está en construcción
— pero **no se ha realizado ninguna revisión de hablantes de la comunidad**, y
**ninguna puntuación en este sitio ha pasado la puerta de hablantes**. Los
números compuestos y chrF++ son señales de máquina, no un veredicto de la
comunidad.

## 4. El sandbox de evaluación existe; su ceremonia de custodia aún no

Obtenemos los corpus desde su origen y los fijamos con SHA, y las particiones de reserva quedan selladas. Cuando una comunidad posee un conjunto de pruebas secreto, se puede evaluar un método contra él sin que el conjunto salga de sus manos — y esa evaluación ahora cuenta con **dos vías**. La vía preferida, para los modelos neuronales estándar, es **declarativa**: el participante envía únicamente datos — pesos safetensors + un tokenizador declarativo + una configuración — y el organizador lo ejecuta en su propio motor de inferencia de confianza (`trust_remote_code=False`, fuera de línea; permisivo respecto a la arquitectura porque la seguridad radica en el formato sin código, no en el nombre de la arquitectura). No se ejecuta ningún código del participante, por lo que no hay nada que aislar en un sandbox; la comprobación de seguridad es una validación de formato decidible (¿es esto safetensors y no un pickle? ¿no hay `trust_remote_code`?), no un intento de demostrar que un código arbitrario es seguro. Para los métodos que genuinamente son código (pipelines, híbridos asistidos por LLM), la alternativa es el **sandbox** aislado de la red (comprobaciones estáticas, contenedores `--network=none`, salida exclusiva de puntuaciones, un transporte de archivos opcional con aislamiento físico real [true-airgap]). El sandbox contiene código no confiable en lugar de rechazar su ejecución, por lo que es, honestamente, la vía más débil — su garantía fundamental es `--network=none` (un escaneo estático heurístico no puede evaluar un modelo binario), y el fortalecimiento más profundo (seccomp, microVMs) queda postergado. Consulte [ejecutar un concurso soberano](/docs/network/sovereignty/run-a-sovereign-contest) para saber exactamente qué está activo y qué no. Lo que **no** está desarrollado en ninguno de los dos casos: la parte custodiada por las claves de la comunidad — firmas de umbral, ceremonias de claves y certificación de nodos. La autorización actual es un proceso registrado (custodios únicos, claves únicas, etiquetado honesto), por lo que la evaluación de **premios** de referencia (gold-standard) permanece cerrada hasta que el trabajo de custodia y el consentimiento de la comunidad se pongan al día.

## 5. La custodia de claves está decidida; los custodios de la comunidad están en confirmación

El *mecanismo* de custodia está decidido: un esquema de umbral/multifirma en el
cual **Champollion no tiene participaciones de claves**. Los custodios mismos
son elegidos por las comunidades, y esas conversaciones están en curso — así que
decimos **"custodios de claves de la comunidad (en confirmación)."** La custodia
no es consentimiento: el proceso relacional de consentimiento comunitario es su propio camino, más lento
y más importante.

---

Estos límites se moverán conforme el trabajo avance. Cuando uno de ellos cambie,
esta página cambia con él — y el cambio debe ser visible en el historial de la
página, no desaparecer silenciosamente.

