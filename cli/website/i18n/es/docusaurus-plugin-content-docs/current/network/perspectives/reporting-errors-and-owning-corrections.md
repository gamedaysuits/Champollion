---
sidebar_position: 4
title: "Reportar Errores y Responsabilidad de Correcciones"
slug: '/network/perspectives/reporting-errors-and-owning-corrections'
description: "Cómo una persona hablante reporta un hecho incorrecto o una traducción deficiente, quién decide qué sucede después, cómo las correcciones llevan trazabilidad, y por qué las comunidades tienen poder de veto sobre sus datos lingüísticos."
related:
  - label: "Data Sovereignty"
    to: /docs/network/sovereignty/data-sovereignty
    kind: doc
    note: "Who holds veto power over language data"
  - label: "Ownership Transfer"
    to: /docs/network/sovereignty/ownership-transfer
    kind: doc
  - label: "Speaker Validation Protocol"
    to: /docs/network/specifications/speaker-validation
    kind: spec
  - label: "How Speakers Get Paid"
    to: /docs/network/perspectives/how-speakers-get-paid
    kind: position
---

# Reportar Errores y Asumir Correcciones

> **Posición.** Equivocarse es inevitable para una plataforma que publica hechos y evaluaciones sobre miles de idiomas. Lo que *no* es inevitable es quién recibe crédito cuando se reporta un error, y quién es responsable de la corrección. Nuestra respuesta: el reporte de un hablante fluido supera nuestra automatización, cada corrección lleva procedencia indicando quién cambió qué y por qué, y una comunidad puede retirar o vetar el uso de sus datos de idioma — no como cortesía, sino como una propiedad reforzada de la arquitectura.

La mayoría de plataformas de datos tratan los reportes de errores como tickets de soporte: un usuario se queja, un mantenedor decide, el registro cambia silenciosamente. Para datos de idiomas indígenas ese modelo está invertido. La persona que reporta el error generalmente es más autorizada que la plataforma — un hablante diciéndonos que una palabra es incorrecta no es un "usuario", es la verdad fundamental corrigiendo un proxy. El diseño a continuación surge de tomar esto en serio.

---

## Dos tipos de error, un principio

La plataforma publica dos tipos de afirmaciones que pueden ser incorrectas:

1. **Hechos sobre un idioma** — las tarjetas de idioma que impulsan la evaluación: datos de clasificación, ortografía, características lingüísticas, qué métricas aplican. Una tarjeta podría afirmar una estimación de hablantes incorrecta, una relación dialectal incorrecta, un estado de sistema de escritura incorrecto.
2. **Juicios sobre traducciones** — una traducción de referencia en un corpus que un hablante considera incorrecta o poco natural; una métrica automatizada que rechaza una palabra válida o acepta una inválida; una insignia "Deployable" en salida que los hablantes no aceptarían.

El principio que cubre ambas, ya vinculante en la [Especificación de Puntuación](/docs/network/specifications/scoring) y [Especificación de Benchmark §7](/docs/network/specifications/benchmark#7-human-validation): **las salidas automatizadas son proxies; los hablantes son la verdad fundamental.** El compromiso publicado en el [Protocolo de Validación de Hablantes §6](/docs/network/specifications/speaker-validation#6-what-speakers-get) lo dice claramente: si un hablante dice que el linter está equivocado sobre algo, arreglamos el linter.

## Cómo viaja un reporte

Aquí está el camino que toma un reporte, con marcadores de estado honestos — parte de esto funciona hoy, parte está especificado y aún no construido.

**Reportar una traducción incorrecta o un juicio de métrica (funcionando hoy, por canal directo).** Un hablante que ve una traducción de referencia incorrecta, una palabra falsamente rechazada, o un "equivalente" inaceptable puede reportarlo a través del rastreador de problemas del repositorio público del proyecto o contactando el proyecto directamente. La versión estructurada de esto — pantallas de calificación con opciones *rechazar / esencia / aceptable / excelente* y notas de texto libre — es la interfaz de revisión comunitaria, que está especificada en la [Especificación de Benchmark §7.3](/docs/network/specifications/benchmark#7-human-validation) pero aún no está activa. Hasta que lo esté, los reportes se manejan persona a persona, y las tareas de validación en sí (pagadas, revisión de hablantes estructurada — ver [Cómo los Hablantes Reciben Pago](/docs/network/perspectives/how-speakers-get-paid)) son el principal conducto de corrección.

**Reportar un hecho incorrecto en una tarjeta de idioma (funcionando hoy, mismos canales).** Las correcciones de tarjetas siguen el mismo camino: reporte, revisión, cambio versionado. Porque las tarjetas impulsan el comportamiento de evaluación — qué métricas se cargan, qué modelos se recomiendan — una corrección de tarjeta puede cambiar puntuaciones, así que las correcciones se aplican como cambios de datos registrados, nunca ediciones silenciosas.

**Qué sucede después — quién decide:**

- **Los juicios lingüísticos pertenecen a los hablantes de ese idioma.** Si una forma es válida, si dos frases son equivalentes, si un registro es apropiado — la plataforma implementa la respuesta; no la suministra. Donde los hablantes no están de acuerdo (dialectos, convenciones ortográficas), la respuesta se registra como variación, no adjudicada por nosotros — los esquemas de corpus y linter soportan etiquetar variantes dialectales como alternativas aceptables en lugar de forzar un ganador.
- **Las decisiones sobre los datos de una comunidad pertenecen a su organización de gobernanza.** Para idiomas con una organización de gobernanza, los cambios a corpus de evaluación, la aceptación de correcciones en conjuntos de prueba sellados, y las consecuencias de despliegue se ejecutan a través de ellos — eso es el control comunitario de los datos lingüísticos — véase [Soberanía de Datos](/docs/network/sovereignty/data-sovereignty) — implementado como proceso, no como póster.
- **Los errores mecánicos simplemente se arreglan.** Una falta de ortografía, un enlace roto, un campo mal analizado — reportado, corregido, registrado. No todo necesita un consejo.

## Las correcciones llevan procedencia

Una corrección que no puedes rastrear es solo una opinión más nueva. Tres reglas de procedencia aplican a cada hecho y cada corrección:

1. **Cada hecho nombra su fuente.** Las tarjetas de idioma y entradas de corpus registran de dónde vino cada valor — un conjunto de datos publicado, una contribución comunitaria, la revisión de un hablante.
2. **Los valores derivados se etiquetan como nuestros, no del upstream.** Cuando la plataforma calcula algo — un agregado, una recodificación, un compuesto — se registra como una derivación de plataforma *del* origen upstream, nunca escrito bajo el nombre del upstream. Un conjunto de datos upstream nunca debe ser culpado por, o acreditado con, un número que no publicó.
3. **Las correcciones se convierten en parte del registro.** La corrección de un hablante se registra como una nueva aseveración atribuida (nombrada o anónima, a elección del hablante — los mismos términos que el trabajo de validación) que supera el valor anterior; el historial de qué cambió permanece auditable. Las versiones de corpus están manifestadas por hash ([Asociación de Corpus §4.4](/docs/network/specifications/corpus-partnership)), así que un corpus corregido es una versión visiblemente nueva, y cada tarjeta de ejecución registra exactamente qué versión se puntuó contra — las puntuaciones antiguas permanecen interpretables, las nuevas puntuaciones reflejan la corrección.

## El veto, concretamente

"Control comunitario" es fácil de afirmar. Aquí está lo que se traduce en la arquitectura publicada:

- **Los hablantes pueden retirar sus contribuciones.** Un hablante puede retirar sus calificaciones en cualquier momento, y la retirada las elimina de todos los análisis ([Validación de Hablantes §5](/docs/network/specifications/speaker-validation#5-data-governance)). Los hablantes también tienen poder de veto sobre la publicación de resultados que encuentran problemáticos.
- **Las comunidades pueden detener la evaluación completamente.** Los conjuntos de prueba sellados están encriptados, con claves mantenidas de modo que la plataforma nunca pueda reconstruirlos; una comunidad puede revocar el acceso de evaluación declinando participar en la reconstrucción de claves ([Asociación de Corpus §4.3](/docs/network/specifications/corpus-partnership#4-cryptographic-sealing-and-sandbox-testing)). "¿Y si queremos parar?" tiene una respuesta especificada: los datos sellados nunca se exponen, y la evaluación termina.
- **Ninguna puntuación anula una decisión comunitaria.** Un método que encabeza la tabla de clasificación aún se despliega solo si la organización de gobernanza lo dice ([Transferencia de Propiedad](/docs/network/sovereignty/ownership-transfer)) — y una comunidad que decide que MT no debe desplegarse para su idioma en absoluto está ejerciendo el sistema como está diseñado, no rompiéndolo (ver [La Traducción No Es Revitalización](/docs/network/perspectives/translation-is-not-revitalization)).

## Lo que aún no hemos construido

En el espíritu del resto de este estante: la interfaz de revisión comunitaria está planeada, no activa. Las organizaciones de gobernanza no están establecidas para ninguno de los idiomas actuales — la custodia comunitaria para el benchmark de Plains Cree está en confirmación, y no nombramos custodios públicamente antes de que hayan consentido. Hasta que esas piezas existan, las correcciones se ejecutan a través de canales directos y atribuibles, y las especificaciones publicadas — no esta página — permanecen como la descripción vinculante del proceso. Donde esta página y una especificación no están de acuerdo, la especificación gana, y consideraríamos el desacuerdo un bug que vale la pena reportar también.

---

## Lo que esto significa para usted

:::info[Si usted es miembro de la comunidad]
Si algo sobre su idioma en esta plataforma es incorrecto — un hecho, una traducción, una etiqueta — su reporte es testimonio de la verdad sobre el terreno, no una queja para ser clasificada. Usted decide si su corrección se acredita por nombre; su contribución puede retirarse más adelante; y su comunidad puede detener el uso de sus datos completamente. Comience en [Para comunidades de idiomas](/docs/network/community/for-language-communities), o simplemente abra un problema en el repositorio público.
:::

:::info[Si usted es investigador]
Las correcciones aquí son datos con procedencia, no ediciones silenciosas: las versiones del corpus están hasheadas, las tarjetas de ejecución fijan la versión exacta contra la que fueron puntuadas, y los valores derivados están etiquetados como derivaciones. Si construye sobre puntuaciones de Network o corpus, cite la versión — y trate una ola de correcciones impulsada por hablantes como un hallazgo sobre la validez de la métrica, porque eso es lo que es.
:::

:::info[Si usted es desarrollador]
La puntuación de su método puede cambiar legítimamente sin que su código cambie — una palabra rechazada falsamente se incluye en la lista de permitidos, una traducción de referencia se corrige, una clase de variante se arregla. Diseñe para eso: fije versiones de corpus en sus tarjetas de ejecución ([especificación de Run Card](/docs/network/specifications/run-card)), observe los registros de cambios del conjunto de datos, y trate las correcciones de hablantes como la señal de error más confiable que obtendrá de forma gratuita.
:::

## Véase también

- [Cómo los Hablantes Reciben Pago](/docs/network/perspectives/how-speakers-get-paid) — la misma autoridad de hablante, en la etapa de benchmark
- [Del Benchmark al Uso Diario](/docs/network/perspectives/from-benchmark-to-daily-use) — donde las correcciones se encuentran con el flujo de trabajo de publicación
- [Soberanía de Datos](/docs/network/sovereignty/data-sovereignty) — los principios indígenas de soberanía de datos, CARE y Te Mana Raraunga, los principios detrás de este diseño
