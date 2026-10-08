---
sidebar_position: 8
title: "Protocolo de Validación de Hablante"
slug: '/network/specifications/speaker-validation'
---

# Protocolo de Validación por Hablantes

> **Propósito.** Este documento define con exactitud qué necesitamos de hablantes bilingües de cree e inglés para validar las métricas de evaluación de LYSS. Sin esta validación, nuestros puntajes automatizados son estimaciones de ingeniería, no mediciones de calidad comprobadas. Esta es la brecha más importante del proyecto.
>
> **Audiencia.** Socios comunitarios, colaboradores potenciales, evaluadores de subvenciones y el equipo del proyecto.


---

## 1. Por qué necesitamos hablantes

El marco de evaluación LYSS (Linguistically-informed Yield & Structural Scoring) calcula puntuaciones de calidad automatizadas para traducciones de inglés → cree de las llanuras. Utiliza tres señales principales:

- **LYSS-fst**: ¿Contiene la salida palabras válidas en cree? (verificado por el transductor de estados finitos de GiellaLT)
- **LYSS-eq**: ¿Es la salida una variante aceptable de la traducción de referencia? (verificado por las clases de equivalencia del linter)
- **LYSS-sem**: ¿Preserva la salida el significado de la fuente? (verificado por el validador semántico)

Estas métricas producen números. **No sabemos si esos números significan algo.** El FST puede rechazar palabras válidas que no reconoce (préstamos, neologismos, nombres propios). El linter puede perder equivalencias válidas o aceptar inválidas. El validador semántico puede juzgar mal el significado. Hasta que hablantes bilingües nos digan si nuestras puntuaciones automatizadas coinciden con su juicio humano de la calidad de la traducción, estamos adivinando.

Cada métrica importante de evaluación de MT (BLEU, COMET, chrF++) fue validada comparando puntuaciones automatizadas contra miles de evaluaciones de calidad humana. Necesitamos lo mismo — a una escala menor, porque nuestros recursos son limitados, pero con el mismo rigor.

---

## 2. Qué necesitamos: Tres tareas

### Tarea A: Calificación de calidad de traducción (Principal — ~8 horas en total)

**Qué:** Calificar 200 traducciones de inglés → cree generadas por máquina en dos escalas.

**Quién:** 3 o más hablantes bilingües de cree de las llanuras e inglés con fluidez de lectura en SRO (Ortografía Romana Estándar).

**Cómo funciona:**

1. Proporcionamos una hoja de cálculo o formulario web con 200 filas. Cada fila tiene:
   - La oración fuente en inglés
   - Una traducción al cree generada por máquina
   - (Opcionalmente) una traducción de referencia al cree para comparación

2. Para cada traducción, el hablante califica dos cosas:

   **Adecuación** (¿dice lo correcto?):
   | Puntaje | Etiqueta | Significado |
   |-------|-------|---------|
   | 1 | Ninguna | La traducción no tiene nada que ver con el original |
   | 2 | Poca | Coinciden algunas palabras, pero el sentido general es incorrecto |
   | 3 | Bastante | El sentido principal está presente, pero faltan partes importantes o son incorrectas |
   | 4 | Casi toda | Casi todo es correcto, con pequeñas lagunas de significado |
   | 5 | Total | La traducción transmite plenamente el significado del original |

   **Fluidez** (¿suena a cree auténtico?):
   | Puntaje | Etiqueta | Significado |
   |-------|-------|---------|
   | 1 | Incomprensible | Esto no es cree |
   | 2 | Entrecortada | Las palabras individuales podrían ser cree, pero la oración no tiene sentido |
   | 3 | No nativa | Comprensible, pero claramente no es como lo diría un hablante de cree |
   | 4 | Buena | Suena natural, con pequeñas faltas de naturalidad |
   | 5 | Impecable | Un hablante de cree podría haber escrito esto |

3. Opcionalmente, el hablante puede agregar una nota de texto libre explicando su calificación (p. ej., "acuerdo animado/inanimado incorrecto en el verbo," "este es dialecto th pero califico basado en dialecto y").

**Estimación de tiempo:** ~2.5 minutos por traducción × 200 traducciones = ~8 horas. Puede dividirse en múltiples sesiones (p. ej., 4 × sesiones de 2 horas durante 2 semanas).

**Compensación:** $50–65 CAD/hora (coincidiendo con las tasas de compensación de hablantes de BENCHMARK_SPEC §10.3). Total por hablante: $400–520 CAD. Para 3 hablantes: **$1,200–1,560 CAD**.

**Qué hacemos con esto:** Calculamos la correlación entre nuestras puntuaciones LYSS automatizadas y las calificaciones de los hablantes. Si LYSS-fst se correlaciona con calificaciones de fluidez y LYSS-sem se correlaciona con calificaciones de adecuación, las métricas están validadas. Si no, sabemos dónde arreglarlas.

---

### Tarea B: Validación de equivalencia del linter (~2 horas)

**Qué:** Revisar 50 pares de traducciones al cree que nuestro linter clasifica como "equivalentes" y decirnos si realmente significan lo mismo.

**Quién:** 1–2 hablantes bilingües (pueden ser los mismos hablantes de la Tarea A).

**Cómo funciona:**

1. Proporcionamos 50 pares. Cada par tiene:
   - La fuente en inglés
   - Traducción A (la referencia)
   - Traducción B (una variante que nuestro linter dice que es equivalente)
   - La razón de equivalencia (p. ej., "permutación de orden de palabras," "variante ortográfica," "partícula opcional eliminada")

2. Para cada par, el hablante responde:
   - **¿Mismo significado?** Sí / No / Depende del contexto
   - **¿Ambas naturales?** Sí / A es mejor / B es mejor / Ninguna es natural
   - **Notas** (texto libre opcional)

**Estimación de tiempo:** ~2 minutos por par × 50 pares = ~2 horas.

**Compensación:** $50–65 CAD/hora × 2 horas = **$100–130 CAD por hablante**.

**Qué hacemos con esto:** Calculamos la precisión de cada clase de equivalencia. Si los hablantes dicen que el 90% de las equivalencias de "orden de palabras" son genuinamente equivalentes, esa clase está validada. Si dicen que el 40% de las equivalencias de "sinónimo de lema" son incorrectas, sabemos que debemos arreglar o eliminar esa clase.

---

### Tarea C: Revisión de rechazos falsos del FST (~1.5 horas)

**Qué:** Revisar 100 palabras en cree que el analizador FST rechaza (dice que no son palabras válidas en cree) y decirnos si realmente son válidas.

**Quién:** 1 hablante bilingüe con fuerte conocimiento de vocabulario en cree.

**Cómo funciona:**

1. Ejecutamos el analizador FST en nuestro corpus de desarrollo EdTeKLA de 436 entradas (`textbook_dev.json`) y recopilamos cada palabra que rechaza.
2. Presentamos hasta 100 palabras rechazadas al hablante junto con el contexto de su oración.
3. Para cada palabra, el hablante responde:
   - **¿Es esta una palabra válida en cree?** Sí / No / No estoy seguro(a)
   - **Si la respuesta es sí, ¿de qué tipo?** Palabra establecida / Préstamo lingüístico / Nombre / Forma dialectal / Neologismo / Otro
   - **Notas** (opcional)

**Estimación de tiempo:** ~1 minuto por palabra × 100 palabras = ~1.5 horas.

**Compensación:** $50–65 CAD/hora × 1.5 horas = **$75–100 CAD**.

**Qué hacemos con esto:** Calculamos la tasa de rechazo falso del FST. Si el FST rechaza 50 palabras y los hablantes dicen que 30 de ellas son válidas, la tasa de rechazo falso es del 60% — inaceptablemente alta, requiriendo una lista de excepciones/préstamos. Si los hablantes dicen que solo 5 son válidas, la tasa de rechazo falso es del 10% — la métrica es confiable.

---

## 3. Compromiso total del hablante

| Tarea | Hablantes necesarios | Horas por hablante | Costo por hablante | Costo total |
|------|-------------------|-------------------|-----------------|------------|
| A: Calificación de calidad | 3 | ~8 horas | $400–520 | $1,200–1,560 |
| B: Validación del linter | 2 | ~2 horas | $100–130 | $200–260 |
| C: Revisión del FST | 1 | ~1.5 horas | $75–100 | $75–100 |
| **Total** | **3 hablantes** | **~11.5 horas (máximo por hablante)** | **$575–750 (máximo)** | **$1,475–1,920** |

Si los mismos 3 hablantes hacen todas las tareas: **~11.5 horas cada uno durante 2–4 semanas, $575–750 cada uno**.

Un solo hablante haciendo solo la Tarea A se comprometería a **~8 horas durante 2 semanas por $400–520**.

---

## 4. Calificaciones del hablante

**Requerido:**
- Bilingüe en cree de las llanuras e inglés
- Fluidez de lectura en SRO (Ortografía Romana Estándar)
- Cómodo calificando traducciones en una escala estructurada

**Preferido:**
- Experiencia con dialecto y (el dialecto utilizado en nuestro corpus de referencia de EDTeKLA)
- Experiencia en enseñanza o traducción (proporciona juicio de calidad calibrado)
- Familiaridad con diferentes registros (formal, educativo, conversacional)

**No requerido:**
- Conocimiento técnico o de PNL (proporcionamos todas las herramientas y contexto)
- Habilidades computacionales (la interfaz de calificación será una hoja de cálculo simple o formulario web)
- Participación previa en el proyecto Champollion

---

## 5. Gobernanza de datos {#5-data-governance}

Todas las contribuciones de los hablantes se rigen por las políticas de datos del proyecto con aspiración de soberanía:

- **Propiedad:** Las calificaciones de calidad de los hablantes siguen siendo su contribución intelectual. Se les da crédito por su nombre (o de forma anónima, a su elección) en cualquier publicación.
- **Control:** Los hablantes pueden retirar sus calificaciones en cualquier momento. El retiro elimina sus datos de todos los análisis.
- **Acceso:** Los datos de las calificaciones se almacenan en infraestructura controlada por la organización de gobernanza comunitaria (cuando se establezca) o en la plataforma de preferencia del hablante.
- **Posesión:** Los datos sin procesar de las calificaciones nunca se publican. En las publicaciones solo aparecen estadísticas agregadas (correlaciones, concordancia entre evaluadores).
- **Compensación:** Se pagará a los hablantes por su tiempo independientemente de si usamos sus calificaciones, una vez que este trabajo cuente con financiamiento (actualmente no se dispone de fondos). El pago no está condicionado a los resultados.

---

## 6. Qué obtienen los hablantes {#6-what-speakers-get}

Más allá de la compensación:

- **Coautoría** en cualquier publicación que use sus calificaciones (si lo desean)
- **Reconocimiento** en toda la documentación del proyecto
- **Acceso anticipado** a las herramientas de evaluación y resultados
- **Aporte** sobre cómo se usan las métricas — si un hablante dice "tu linter está equivocado sobre X," arreglamos el linter
- **Poder de veto** sobre la publicación de resultados que encuentren problemáticos

---

## 7. Cómo comenzar {#7-how-to-get-started}

Aún no hay financiamiento para el trabajo de los hablantes, por lo que nada de lo que sigue puede comenzar hoy, y no le pediremos a nadie que inicie un trabajo no remunerado. Si usted es un hablante bilingüe de cree e inglés interesado en participar una vez que se obtenga financiamiento, o si conoce a alguien que pudiera estarlo:

1. **Contáctenos** en [info@champollion.dev](mailto:info@champollion.dev): no se requiere ningún compromiso, solo es una conversación
2. **Le explicamos las tareas** en un lenguaje sencillo (sin tecnicismos)
3. **Usted elige las tareas** que le interesen (A, B, C o cualquier combinación)
4. **Establecemos un horario** que le convenga (bloques de 2 horas, horarios flexibles)
5. **Usted califica las traducciones** mediante una hoja de cálculo o un formulario web, desde cualquier lugar y a su propio ritmo
6. **Pagamos puntualmente**: en un plazo de 2 semanas tras completar cada bloque de tareas

---

## 8. Qué sucede después

Con datos de validación de hablantes, podemos:

1. **Publicar las correlaciones de métricas** — probando (o refutando) que las puntuaciones LYSS reflejan el juicio humano
2. **Recalibrar las métricas** — ajustando pesos, umbrales y clases de equivalencia basados en retroalimentación de hablantes
3. **Arreglar el linter** — eliminando equivalencias falsas, agregando las faltantes
4. **Arreglar la lista de excepciones del FST** — agregando palabras válidas que el FST rechaza incorrectamente
5. **Enviar a un lugar académico** — con hablantes como coautores, estableciendo LYSS como una métrica validada para evaluación de MT de lenguajes polisintéticos

Sin validación de hablantes, LYSS permanece como una herramienta de ingeniería. Con ella, LYSS se convierte en una métrica de evaluación científicamente fundamentada. Esa es la diferencia entre "construimos algo" y "probamos que funciona."


## A dónde conduce esto en este sitio

La validación por hablantes es una etapa de un proceso más amplio: el flujo de trabajo de
[Alianza de corpus](/docs/network/specifications/corpus-partnership)
es donde encajan estas tareas dentro de la construcción de un corpus de evaluación, y
[Cómo se les paga a los hablantes](/docs/network/perspectives/how-speakers-get-paid)
es la versión en lenguaje sencillo de las tarifas y términos anteriores.
