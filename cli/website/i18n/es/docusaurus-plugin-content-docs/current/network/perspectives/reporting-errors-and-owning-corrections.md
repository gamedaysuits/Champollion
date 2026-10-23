---
sidebar_position: 4
title: "Reportar Errores y Responsabilidad de Correcciones"
slug: '/network/perspectives/reporting-errors-and-owning-corrections'
description: "Cómo una persona hablante reporta un hecho incorrecto o una traducción deficiente, quién decide qué sucede después, cómo las correcciones llevan trazabilidad, y por qué las comunidades tienen poder de veto sobre sus datos lingüísticos."
related:
  - label: "Data Sovereignty"
    to: /docs/your-words-your-rules
    kind: doc
    note: "Who holds veto power over language data"
  - label: "Ownership Transfer"
    to: /docs/network/sovereignty/ownership-transfer
    kind: doc
  - label: "Speaker Validation Protocol"
    to: /docs/network/specifications/speaker-validation
    kind: spec
  - label: "Working with speakers"
    to: /docs/working-with-speakers
    kind: position
---

# Reportar Errores y Asumir Correcciones

> **Postura.** Equivocarse es inevitable para una plataforma que publica hechos y evaluaciones sobre muchos idiomas. Lo que *no* es inevitable es a quién se le cree cuando se reporta un error y quién es dueño de la corrección. Nuestra respuesta: el reporte de un hablante fluido prevalece sobre nuestra automatización, cada corrección lleva una procedencia que indica quién cambió qué y por qué, y una comunidad puede retirar o vetar el uso de sus datos lingüísticos; no como una cortesía, sino como una propiedad obligatoria de la arquitectura.

La mayoría de plataformas de datos tratan los reportes de errores como tickets de soporte: un usuario se queja, un mantenedor decide, el registro cambia silenciosamente. Para datos de idiomas indígenas ese modelo está invertido. La persona que reporta el error generalmente es más autorizada que la plataforma — un hablante diciéndonos que una palabra es incorrecta no es un "usuario", es la verdad fundamental corrigiendo un proxy. El diseño a continuación surge de tomar esto en serio.

---

## Dos tipos de error, un principio

La plataforma publica dos tipos de afirmaciones que pueden ser incorrectas:

1. **Hechos sobre un idioma**: las fichas de idioma que rigen la evaluación: datos de clasificación, ortografía, características lingüísticas y qué métricas aplican. Una ficha podría indicar una estimación incorrecta de hablantes, una relación dialectal errónea o un estado incorrecto del sistema de escritura.
2. **Juicios sobre las traducciones**: una traducción de referencia en un corpus que un hablante considera incorrecta o poco natural; una métrica automatizada que rechaza una palabra válida o acepta una inválida; una puntuación automática alta en un resultado que los hablantes no aceptarían.

El principio que cubre ambas, ya vinculante en la [Especificación de Puntuación](/docs/network/specifications/scoring) y [Especificación de Benchmark §7](/docs/network/specifications/benchmark#7-human-validation): **las salidas automatizadas son proxies; los hablantes son la verdad fundamental.** El compromiso publicado en el [Protocolo de Validación de Hablantes §6](/docs/network/specifications/speaker-validation#6-what-speakers-get) lo dice claramente: si un hablante dice que el linter está equivocado sobre algo, arreglamos el linter.

## Cómo viaja un reporte

Aquí está el camino que toma un reporte, con marcadores de estado honestos — parte de esto funciona hoy, parte está especificado y aún no construido.

**Cómo reportar una mala traducción o un juicio de métrica (disponible hoy, por canal directo).** Un hablante que detecte una traducción de referencia incorrecta, una palabra rechazada por error o un "equivalente" inaceptable puede reportarlo a través del rastreador de problemas del repositorio público del proyecto o comunicándose directamente con el proyecto. La versión estructurada de esto —pantallas de calificación con opciones de *rechazar / sentido general / aceptable / excelente* y notas en texto libre— es la interfaz de revisión comunitaria, la cual está especificada en la [Especificación del benchmark §7.3](/docs/network/specifications/benchmark#7-human-validation), pero aún no está activa. Hasta que lo esté, los reportes se gestionan de persona a persona, y las tareas de validación en sí (revisión remunerada y estructurada por parte de hablantes; consulte [Trabajar con hablantes](/docs/working-with-speakers)) constituyen el flujo principal de corrección.

**Reportar un hecho incorrecto en una tarjeta de idioma (funcionando hoy, mismos canales).** Las correcciones de tarjetas siguen el mismo camino: reporte, revisión, cambio versionado. Porque las tarjetas impulsan el comportamiento de evaluación — qué métricas se cargan, qué modelos se recomiendan — una corrección de tarjeta puede cambiar puntuaciones, así que las correcciones se aplican como cambios de datos registrados, nunca ediciones silenciosas.

**Qué sucede después — quién decide:**

- **El criterio lingüístico le corresponde a los hablantes de ese idioma.** Ya sea si una forma es válida, si dos redacciones son equivalentes o si un registro es apropiado: la plataforma implementa la respuesta, no la suministra. Donde los hablantes discrepan (dialectos, convenciones ortográficas), la respuesta se registra como variación, no la juzgamos nosotros; los esquemas del corpus y del linter admiten etiquetar variantes dialectales como alternativas aceptables en lugar de imponer una sola ganadora.
- **Las decisiones sobre los datos de una comunidad pertenecen a su organización de gobernanza.** Para los idiomas que cuentan con una organización de gobernanza, los cambios en los corpus de evaluación, la aceptación de correcciones en conjuntos de prueba sellados y las consecuencias para el despliegue pasan por ella; ese es el control comunitario de los datos lingüísticos (consulte [Sus palabras, sus reglas](/docs/your-words-your-rules)), implementado como proceso, no como póster.
- **Los errores mecánicos simplemente se corrigen.** Un error tipográfico, un enlace roto, un campo mal procesado: se reporta, se corrige y se registra. No todo necesita un consejo.

## Las correcciones llevan procedencia

Una corrección que no puedes rastrear es solo una opinión más nueva. Tres reglas de procedencia aplican a cada hecho y cada corrección:

1. **Cada dato indica su fuente.** Las fichas de idioma y las entradas de corpus registran de dónde provino cada valor: un conjunto de datos publicado, una contribución comunitaria, la revisión de un hablante.
2. **Los valores derivados se etiquetan como nuestros, no de la fuente original.** Cuando la plataforma calcula algo (un agregado, una recodificación, un compuesto), se registra como una derivación de la plataforma *a partir de* la fuente original, nunca bajo el nombre de esta. Jamás se debe culpar a un conjunto de datos original por un número que no publicó, ni atribuírselo.
3. **Las correcciones pasan a formar parte del registro.** La corrección de un hablante se registra como una afirmación nueva y atribuida (con nombre o anónima, a elección del hablante; en los mismos términos que el trabajo de validación) que sustituye al valor anterior; el historial de lo que cambió sigue siendo auditable. Las versiones del corpus cuentan con un manifiesto con hash ([Registro de corpus](/docs/network/sovereignty/registering-corpora)), por lo que un corpus corregido es visiblemente una nueva versión, y cada ficha de ejecución registra con precisión con qué versión se evaluó; las puntuaciones antiguas siguen siendo interpretables y las nuevas reflejan la corrección.

## El veto, concretamente

"Control comunitario" es fácil de afirmar. Aquí está lo que se traduce en la arquitectura publicada:

- **Los hablantes pueden retirar sus contribuciones.** Un hablante puede retirar sus calificaciones en cualquier momento, y la retirada las elimina de todos los análisis ([Validación de hablantes §5](/docs/network/specifications/speaker-validation#5-data-governance)). Los hablantes también tienen poder de veto sobre la publicación de resultados que consideren problemáticos.
- **Las comunidades pueden detener la evaluación por completo.** Los conjuntos de prueba sellados están cifrados y Champollion no conserva fragmentos de clave, por lo que la plataforma por sí sola nunca puede reconstruirlos. Hoy en día, las claves de un conjunto sellado están en manos de los organizadores; custodios de claves comunitarios: ninguno designado todavía. Una vez que los custodios nombrados por una comunidad posean fragmentos de la clave de un conjunto, pueden detener la evaluación negándose a participar en la reconstrucción de la clave ([Registro de corpus](/docs/network/sovereignty/registering-corpora)). La pregunta "¿qué pasa si queremos detenernos?" tiene una respuesta especificada: los datos sellados nunca quedan expuestos y la evaluación termina.
- **Ninguna puntuación anula una decisión comunitaria.** Un lugar en la tabla de clasificación no le otorga a nadie permiso para desplegar un método en el idioma de una comunidad ([Transferencia de propiedad](/docs/network/sovereignty/ownership-transfer)); y una comunidad que decida que la traducción automática no debería desplegarse en absoluto para su idioma está ejerciendo el sistema tal como fue diseñado, no rompiéndolo (consulte [La traducción no es revitalización](/docs/network/perspectives/translation-is-not-revitalization)).

## Lo que aún no hemos construido

En consonancia con el espíritu del resto de esta sección: la interfaz de revisión comunitaria está planificada, no activa. Aún no se han establecido organizaciones de gobernanza para ninguno de los idiomas actuales; no se han designado custodios comunitarios para ningún benchmark, incluido Plains Cree, y no nombramos custodios públicamente antes de que hayan dado su consentimiento. Hasta que esas piezas existan, las correcciones se canalizan a través de vías directas y atribuibles, y las especificaciones publicadas —no esta página— siguen siendo la descripción vinculante del proceso. Si esta página y una especificación no coinciden, prevalece la especificación, y consideraríamos que dicha discrepancia es un error que también vale la pena reportar.

---

## Lo que esto significa para usted

:::info[Si usted es miembro de una comunidad]
Si algo sobre su idioma en esta plataforma es incorrecto (un dato, una traducción, una etiqueta), su reporte es testimonio directo de la realidad fundamental, no una queja que deba clasificarse. Usted decide si su corrección se acredita con su nombre; su contribución puede retirarse más adelante; y su comunidad puede detener por completo el uso de sus datos. Comience en [Sus palabras, sus reglas](/docs/your-words-your-rules), o simplemente abra un problema en el repositorio público.
:::

:::info[Si usted es investigador]
Las correcciones aquí son datos con procedencia, no ediciones silenciosas: las versiones del corpus están hasheadas, las tarjetas de ejecución fijan la versión exacta contra la que fueron puntuadas, y los valores derivados están etiquetados como derivaciones. Si construye sobre puntuaciones de Network o corpus, cite la versión — y trate una ola de correcciones impulsada por hablantes como un hallazgo sobre la validez de la métrica, porque eso es lo que es.
:::

:::info[Si usted es desarrollador]
La puntuación de su método puede cambiar legítimamente sin que su código cambie — una palabra rechazada falsamente se incluye en la lista de permitidos, una traducción de referencia se corrige, una clase de variante se arregla. Diseñe para eso: fije versiones de corpus en sus tarjetas de ejecución ([especificación de Run Card](/docs/network/specifications/run-card)), observe los registros de cambios del conjunto de datos, y trate las correcciones de hablantes como la señal de error más confiable que obtendrá de forma gratuita.
:::

## Véase también

- [Trabajar con hablantes](/docs/working-with-speakers) — la misma autoridad de los hablantes, en la etapa de evaluación comparativa
- [Póngalo a trabajar](/docs/put-it-to-work) — donde las correcciones se encuentran con el flujo de trabajo de publicación
- [Sus palabras, sus reglas](/docs/your-words-your-rules) — quién decide qué sucede con los datos lingüísticos, qué hacen cumplir las herramientas y qué no puede detener ninguna herramienta
