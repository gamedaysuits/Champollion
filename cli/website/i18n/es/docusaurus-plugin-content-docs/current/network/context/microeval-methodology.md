---
sidebar_position: 4
title: "Microeval: Evaluación Específica del Idioma para Traducción Automática"
slug: '/network/context/microeval-methodology'
---

# Microeval: Métricas de Evaluación Específicas del Idioma para Traducción Automática

***Una metodología para construir métricas de evaluación adaptadas a idiomas individuales usando FSTs, diccionarios y reglas de equivalencia curadas por lingüistas — y por qué el campo las necesita***

---

> *"Los límites de mi lenguaje significan los límites de mi mundo."*
> — Ludwig Wittgenstein, *Tractatus Logico-Philosophicus* (1921)

---

## Introducción

La comunidad de evaluación de traducción automática ha pasado dos décadas buscando métricas universales — medidas de calidad de traducción que funcionen en todos los idiomas, todos los dominios, todas las tipologías. Esta búsqueda ha producido herramientas notables: BLEU (Papineni et al., 2002), chrF++ (Popović, 2017), COMET (Rei et al., 2020), MetricX (Juraska et al., 2023). Para los ~20 idiomas que dominan las tareas compartidas de WMT, estas herramientas funcionan.

Para los otros ~7,000 idiomas, no funcionan.

Este documento argumenta que **la búsqueda de métricas universales, cuando se aplica a idiomas de bajo recurso y morfológicamente complejos, no es solo incompleta — es el paradigma equivocado**. Proponemos **microeval**: una metodología para construir métricas de evaluación adaptadas a idiomas individuales usando las mejores herramientas lingüísticas disponibles — transductores de estado finito, diccionarios bilingües, analizadores morfológicos y reglas de equivalencia curadas por lingüistas.

Microeval no es una métrica. Es una *práctica* — un proceso sistemático para construir infraestructura de evaluación que codifique conocimiento específico del idioma. La práctica produce métricas, que recopilamos bajo el nombre de marco **LYSS** (Linguistically-informed Yield & Structural Scoring). Pero la contribución es la metodología, no ninguna métrica particular que produzca.

Este documento es un complemento a:
- [Measuring the Immeasurable](/docs/network/context/mt-evaluation-landscape) — la encuesta del panorama de evaluación, que posiciona LYSS entre las métricas existentes
- [The Scoring Specification](/docs/network/specifications/scoring) — la especificación técnica para definiciones de métricas, pesos y puntuación compuesta
- [The Corpus Partnership Strategy](/docs/network/specifications/corpus-partnership) — el flujo de trabajo práctico para establecer corpus de evaluación

Esos documentos describen *qué* es LYSS y *dónde* encaja. Este aborda las preguntas más profundas: *¿Por qué* es necesaria la evaluación específica del idioma? *¿Cómo* se construye para un nuevo idioma? Y *¿quién* decide qué cuenta como "correcto"?

---

## Parte 1: Por qué las métricas universales fallan en idiomas de bajo recurso

### 1.1 El supuesto de universalidad

Cada métrica de evaluación de TA importante desde BLEU se basa en un supuesto implícito: que los *mecanismos* de calidad de traducción son independientes del idioma, aunque los *parámetros* difieran. BLEU cuenta superposición de n-gramas. chrF++ cuenta superposición de n-gramas de caracteres. COMET entrena un modelo de regresión en juicios humanos. Todos asumen que la estructura de la señal — qué hace que una traducción sea "buena" — puede ser capturada por un algoritmo agnóstico del idioma, posiblemente ajustado en datos específicos del idioma.

Para pares de idiomas europeos de alto recurso, este supuesto se mantiene lo suficientemente bien. Las tareas compartidas de métricas de WMT demuestran alta correlación humana para English↔German, English↔Czech, English↔Chinese. Las métricas discrepan en casos límite, pero están de acuerdo en la distribución de calidad.

Para idiomas polisintéticos como Plains Cree (nêhiyawêwin), el supuesto se desmorona en múltiples niveles:

**Opacidad morfológica.** Un único verbo Cree puede contener tanta información como una cláusula completa en inglés. La palabra *nikî-wîcihâw* ("I helped him/her") codifica persona, número, animacidad, dirección y tiempo en una única forma flexionada. Una métrica de n-gramas ve un token; un analizador morfológico ve seis morfemas. Las métricas de superficie no pueden distinguir entre un verbo correctamente flexionado y una alucinación plausible que viola el acuerdo de animacidad — ambas son tokens únicos de longitud de carácter similar.

**Orden de palabras libre.** Cree tiene orden de palabras pragmáticamente libre (Wolfart, 1973, §3.2). Las oraciones *atim niwâpamâw* y *niwâpamâw atim* ("I see the dog") son ambas gramaticalmente correctas — la elección es pragmática, no sintáctica. Cualquier métrica que penalice la divergencia del orden de palabras de una traducción de referencia generará falsos negativos en cada par de este tipo.

**Equivalencia morfológica.** Cree tiene múltiples representaciones ortográficas válidas de la misma palabra (variantes SRO, alternaciones progresivas/longitud de vocal). Las traducciones *nikî-atoskân* y *nikî-atoskên* pueden ser dialectalmente equivalentes. Una métrica de coincidencia de cadenas ve dos cadenas diferentes; un lingüista ve la misma palabra.

**Ausencia de datos de entrenamiento.** Las métricas neurales como COMET requieren datos de entrenamiento — juicios de calidad humana en pares de traducción — para aprender qué significa "bueno". Para Cree, estos datos no existen. COMET aún puede producir puntuaciones (recurre a su codificador multilingüe), pero esas puntuaciones no han sido validadas contra los juicios de calidad de ningún hablante de Cree. Son extrapolaciones de patrones de idiomas europeos, aplicadas a un idioma con estructura fundamentalmente diferente.

### 1.2 La paradoja de la evaluación de bajo recurso

Esto crea una paradoja:

> Los idiomas que más urgentemente necesitan traducción automática son precisamente los idiomas donde las mejores herramientas de evaluación son menos confiables.

Si no podemos medir la calidad de traducción para estos idiomas, no podemos:
- Comparar métodos de traducción objetivamente
- Detectar cuándo un modelo alucina sin sentido plausible
- Rastrear si el campo está haciendo progreso
- Responsabilizar a los proveedores de sistemas de TA por afirmaciones de calidad

El resultado es un **fallo en cascada**: sin datos de entrenamiento → sin cobertura de codificador → sin evaluación validada → sin progreso medible → sin incentivo para invertir → sin datos de entrenamiento.

Romper este ciclo requiere métodos de evaluación que no dependan de los recursos que no tenemos (datos de entrenamiento, juicios humanos a escala, codificadores neurales ajustados). Requiere métodos que aprovechen los recursos que *sí* tenemos.

### 1.3 Lo que sí tenemos

Para muchos idiomas de bajo recurso, décadas de trabajo de campo lingüístico han producido herramientas y recursos que la comunidad de evaluación de TA ha ignorado en gran medida:

| Recurso | Qué proporciona | Cobertura |
|----------|-----------------|----------|
| **Transductores de estados finitos (FSTs)** | Análisis morfológico completo — cada forma de palabra válida en el idioma | ~100+ idiomas a través de GiellaLT, Apertium, NRC |
| **Diccionarios bilingües** | Mapeos de lema a glosa | Cientos de idiomas (Wolvengrey 2001 para Cree: aproximadamente 18,000–22,000 entradas dependiendo de la edición y el método de conteo) |
| **Analizadores morfológicos** | Etiquetado gramatical, lematización, generación de paradigmas flexivos | Docenas de idiomas con cobertura variable |
| **Gramáticas descriptivas** | Reglas que rigen la concordancia, el orden de las palabras, la animacidad, la obviación | Disponibles para la mayoría de los idiomas documentados |
| **Experiencia de lingüistas** | Miembros de la comunidad que pueden identificar traducciones correctas frente a incorrectas | Existe por definición para cada idioma vivo |

Estos recursos fueron construidos por lingüistas computacionales, lingüistas de campo y comunidades de idiomas durante décadas — a menudo sin conexión con la comunidad de evaluación de TA. El FST para Plains Cree fue construido en la Universidad de Alberta por Antti Arppe y colegas como una herramienta de documentación de idiomas, no como una métrica de evaluación. La infraestructura GiellaLT en UiT fue construida para tecnología de idiomas minoritarios, no para tareas compartidas de WMT.

**Microeval es la práctica de convertir estos recursos existentes en métricas de evaluación.**

---

## Parte 2: La metodología de microeval

### 2.1 Definición

**Microeval** es una metodología sistemática para construir métricas de evaluación de traducción automática adaptadas a un idioma específico, usando herramientas y recursos lingüísticos específicos del idioma. Una suite de microeval:

1. **Codifica conocimiento específico del idioma** que no puede ser capturado por métricas agnósticas del idioma
2. **Usa infraestructura lingüística existente** (FSTs, diccionarios, gramáticas) en lugar de requerir nuevos datos de entrenamiento
3. **Produce puntuaciones deterministas e interpretables** — cada puntuación puede ser rastreada a un juicio lingüístico específico
4. **Es diseñada por lingüistas**, no solo ingenieros — las clases de variantes, reglas de equivalencia y lógica de validación reflejan experiencia lingüística
5. **Complementa en lugar de reemplazar** métricas universales — microeval llena los vacíos, no todo el espacio

### 2.2 La arquitectura de tres capas

Una suite de microeval completa opera en tres niveles de análisis, de superficie a semántica:

| Capa | Pregunta respondida | Herramienta utilizada | Componente LYSS |
|------|-------------------|----------------------|-----------------|
| **Validez morfológica** | "¿Es cada palabra una forma válida en este idioma?" | Transductor de estado finito (FST) | LYSS-fst |
| **Equivalencia lingüística** | "¿Es esta traducción una variante aceptable de la referencia?" | Linter determinista con clases de variantes curadas por lingüistas | LYSS-eq |
| **Fidelidad semántica** | "¿Preserva esta traducción el significado de la fuente?" | Lematización FST + glosarios de diccionario + superposición de palabras de contenido | LYSS-sem |

Estas capas son **acumulativas, no alternativas**. Una traducción debe pasar todas para ser considerada completamente correcta. Una palabra alucinada falla en la capa 1. Una variante dialectal que es correcta pero difiere de la referencia es capturada en la capa 2. Una traducción que usa palabras válidas en un orden válido pero significa algo diferente es capturada en la capa 3.

### 2.3 Cómo construir una suite de microeval para un nuevo idioma

Esta sección describe el proceso paso a paso. Usamos Plains Cree (CRK) como el ejemplo trabajado y generalizamos donde sea posible.

#### Paso 1: Evaluar recursos disponibles

Antes de construir nada, inventaríe lo que existe:

| Recurso | Requerido para | Cómo encontrarlo | Calidad mínima |
|---------|---------------|-----------------|----------------|
| FST | Capa 1 (LYSS-fst) | Verifique catálogos de GiellaLT, Apertium, NRC | Debe aceptar >90% de formas de palabras válidas en un corpus de prueba |
| Diccionario bilingüe | Capa 3 (LYSS-sem) | Verifique proyectos de documentación de idiomas, Wiktionary, recursos comunitarios | >5,000 entradas con mapeos de lema a glosa |
| Gramática descriptiva | Capa 2 (LYSS-eq) | Gramáticas publicadas, tesis, referencias redactadas por la comunidad | Debe documentar paradigmas morfológicos centrales |
| Hablantes bilingües | Todas las capas (validación) | Contactos comunitarios, programas de idiomas universitarios | Mínimo 3 hablantes para experimentos de validación |

**Si no existe FST:** Omita la capa 1. La suite opera solo en las capas 2–3, o recurre a métricas universales (Perfil B en puntuación LYSS). Esto no es ideal, pero es mejor que nada.

**Si no existe diccionario:** Omita la capa 3 o use una versión reducida con el vocabulario disponible. Un diccionario de 500 entradas es menos útil que uno de 18,000, pero aún proporciona señal.

#### Paso 2: Configurar la puerta de validez morfológica (LYSS-fst)

Si un FST está disponible:

1. **Instale el FST** usando el binario del analizador del idioma (formato `.hfstol` HFST para GiellaLT)
2. **Ejecute una prueba de cobertura** en un corpus representativo: ¿qué porcentaje de tokens reconoce el FST?
3. **Construya una lista de permitidos** para brechas esperadas del FST: palabras prestadas, nombres propios, neologismos, abreviaturas
4. **Calcule la tasa de rechazo falso de línea base** — el porcentaje de palabras válidas que el FST rechaza incorrectamente
5. **Establezca el umbral de puntuación** — por debajo de qué tasa de aceptación del FST marcamos una traducción como morfológicamente sospechosa?

La métrica clave es `fst_acceptance_rate`: la fracción de palabras de salida que el FST reconoce. Una tasa de 0.85 significa que el 85% de las palabras son morfología Cree válida; el 15% son palabras prestadas, inválidas o brechas de cobertura del FST.

**Decisión de diseño crítica:** El problema de rechazo falso. Un FST entrenado en lenguaje literario formal rechazará formas coloquiales válidas. Un FST con cobertura de paradigma incompleta rechazará inflexiones válidas pero raras. La lista de permitidos mitiga esto, pero no puede eliminarlo. *Por eso LYSS-fst solo no es suficiente* — debe combinarse con las capas 2 y 3.

#### Paso 3: Diseñar las clases de variantes (LYSS-eq)

Este es el paso más lingüísticamente exigente, y no puede ser automatizado. Un lingüista con experiencia en el idioma objetivo debe identificar:

**¿Qué tipos de diferencias entre una traducción candidata y una traducción de referencia deben considerarse "aceptables"?**

Para Plains Cree, identificamos seis clases de variantes:

| Clase de variante | Base lingüística | Ejemplo |
|------------------|-----------------|---------|
| `WORD_ORDER` | Orden de palabras pragmáticamente libre (Wolfart 1973 §3.2) | *atim niwâpamâw* ≡ *niwâpamâw atim* |
| `ORTHOGRAPHIC` | Variantes de ortografía SRO, alternancia de longitud de vocal | *nikî-atoskân* ≡ *nikî-atoskên* |
| `OPTIONAL_PARTICLE` | Partículas de discurso gramaticalmente opcionales | *êkwa nikî-atoskân* ≡ *nikî-atoskân* |
| `LEMMA_SYNONYM` | Sinónimos atestiguados en diccionario | *wâpamêw* ≡ *kanawâpamêw* (para "sees") |
| `PROGRESSIVE_AMBIGUITY` | Múltiples formas progresivas válidas | *ê-atoskêt* ≡ *atoskêw* |
| `INCLUSIVE_EXCLUSIVE` | Distinción de primera persona plural no en inglés | *ki-wîcihânaw* ≡ *ni-wîcihânân* |

**Estas clases son específicas del idioma.** Otro idioma tendría clases diferentes — el turco podría tener clases para variantes de armonía vocálica, el japonés para alternancia de registro honorífico, el inuktitut para variación de sufijo dialectal.

**El proceso de diseño:**
1. Recopile 100+ pares de traducción (fuente + referencia + candidata)
2. Identifique todos los casos donde la candidata es diferente de la referencia pero un hablante bilingüe la consideraría correcta
3. Categorice las diferencias — busque patrones que se repitan en múltiples pares
4. Formalice cada patrón como una regla determinista (regex, operación de conjunto, o transducción FST)
5. Valide con 3+ hablantes bilingües: para cada clase de variante, ¿están de acuerdo en que es aceptable?
6. Itere: algunas clases necesitarán refinamiento, otras necesitarán ser divididas o fusionadas

#### Paso 4: Construir el validador semántico (LYSS-sem)

El validador semántico responde: "¿Significa esta traducción lo mismo que la referencia?" Opera en cuatro etapas:

1. **Lematice ambas traducciones** usando el FST (extraiga formas raíz, elimine flexión)
2. **Mapee lemas a glosarios** usando el diccionario bilingüe (lema Cree → glosa inglesa)
3. **Compare los conjuntos de glosarios** — ¿los glosarios de la candidata se superponen con los glosarios de la referencia?
4. **Verifique restricciones estructurales** — ¿la candidata viola reglas de gramática conocidas (acuerdo de animacidad, forma de verbo, marcación de persona)?

El validador produce veredictos: `EXACT_MATCH`, `VALID`, `GRAMMAR_ISSUES`, `PARTIAL`, `INCOMPLETE`, `WRONG`, `NO_OUTPUT`. Cada veredicto es determinista y rastreable — puede explicar *por qué* una traducción recibió un veredicto dado examinando qué etapa lo marcó.

**Versión mínima viable:** Si tiene un FST y un diccionario, puede construir un validador semántico simplificado que solo haga superposición de lema-glosa (etapas 1–3). La etapa 4 (verificación de gramática) requiere más ingeniería lingüística pero agrega valor significativo para idiomas morfológicamente complejos.

#### Paso 5: Integrar con el arnés de evaluación

La suite de microeval se empaqueta como un conjunto de complementos de métrica que se conectan al arnés de evaluación:

1. Cada métrica implementa el protocolo `MetricPlugin`: `compute(entry) → dict`, `aggregate(results) → dict`
2. El sistema de descubrimiento de complementos detecta automáticamente complementos específicos del idioma basándose en el código de idioma objetivo
3. Las puntuaciones se alimentan a la función de puntuación compuesta, que combina métricas de microeval con métricas universales usando perfiles de peso específicos del idioma

### 2.4 Microeval mínimo viable

No todos los idiomas necesitan las tres capas inmediatamente. Aquí está la configuración mínima útil en cada nivel:

| Configuración | Lo que necesita | Lo que obtiene | Tiempo para construir |
|--------------|-----------------|----------------|----------------------|
| **Solo LYSS-fst** | FST + lista de permitidos | Puerta de validez morfológica — captura formas de palabras alucinadas | 1–2 semanas |
| **LYSS-fst + LYSS-eq** | FST + 3–6 clases de variantes + tiempo de lingüista | Puerta de validez + detección de equivalencia — reduce falsos negativos | 4–8 semanas |
| **LYSS completo** | FST + clases de variantes + diccionario + validador semántico | Evaluación completa específica del idioma | 8–16 semanas |

La recomendación es comenzar con LYSS-fst (rápido, alto impacto, requiere solo un FST que probablemente ya existe) y agregar capas incrementalmente.

---

## Parte 3: El problema del rechazo falso

### 3.1 Qué es

Cada métrica de microeval tiene una tasa de rechazo falso: la probabilidad de que una traducción correcta sea puntuada como incorrecta.

Para LYSS-fst, el rechazo falso ocurre cuando:
- El FST no cubre una forma de palabra válida (tablas de paradigma incompletas)
- La traducción contiene una palabra prestada que el FST no reconoce
- La traducción usa un neologismo o marca registrada
- La traducción usa una forma dialectal no en el léxico del FST
- La traducción contiene un nombre propio no en la lista de permitidos

Para LYSS-eq, el rechazo falso ocurre cuando:
- La traducción usa una variante aceptable no cubierta por ninguna clase de variante
- Se necesita una nueva clase de variante pero aún no ha sido identificada

Para LYSS-sem, el rechazo falso ocurre cuando:
- Un lema no está en el diccionario
- Una traducción válida usa una estrategia de paráfrasis que no se mapea al conjunto de lemas de la referencia

### 3.2 Por qué importa más que la aceptación falsa

En evaluación, el rechazo falso es peor que la aceptación falsa. Un rechazo falso significa que una traducción *correcta* es puntuada como *incorrecta* — esto desalienta a los constructores que están haciendo buen trabajo, y socava la confianza en la métrica. Una aceptación falsa significa que una traducción *incorrecta* es puntuada como *correcta* — esto es malo, pero es capturado por otras métricas en la composición.

El rechazo falso se compone: si LYSS-fst tiene una tasa de rechazo falso del 10% por palabra, y una oración tiene 5 palabras, la probabilidad de que al menos una palabra sea falsamente rechazada es ~41%. Esto significa que casi la mitad de todas las oraciones tendrán su tasa de aceptación del FST reducida por al menos una palabra — no porque la traducción sea incorrecta, sino porque el FST es incompleto.

### 3.3 Estrategias de mitigación

| Estrategia | Mecanismo | Efectividad |
|-----------|----------|------------|
| **Listas de permitidos** | Incluya en la lista blanca palabras prestadas conocidas, nombres propios, abreviaturas | Alta para brechas conocidas, cero para brechas desconocidas |
| **Coincidencia difusa** | Acepte palabras dentro de distancia de edición 1 de una forma conocida | Captura errores tipográficos y variantes ortográficas menores |
| **Puntuación de confianza** | Pese resultados del FST por completitud de paradigma | Requiere metadatos de cobertura de paradigma |
| **Umbrales específicos de categoría** | Diferentes umbrales para diferentes dominios (médico puede tener más palabras prestadas) | Requiere corpus etiquetados por dominio |
| **Listas de permitidos mantenidas por la comunidad** | Los hablantes envían palabras que el FST debe aceptar | Más sostenible a largo plazo; requiere infraestructura de participación comunitaria |

### 3.4 Medir la tasa

La tasa de rechazo falso debe medirse empíricamente, en un corpus representativo:

1. Tome un corpus de 500+ oraciones Cree válidas conocidas (libros de texto, traducciones revisadas)
2. Ejecute cada palabra a través del FST
3. Para cada palabra que el FST rechaza, haga que un hablante bilingüe la clasifique: palabra válida que el FST perdió, o genuinamente inválida?
4. `false_rejection_rate = valid_but_rejected / total_valid_words`

Esta medición es uno de los experimentos de validación requeridos (Especificación de puntuación §1.6).

---

## Parte 4: ¿Quién decide qué es "correcto"?

### 4.1 La dimensión política de la evaluación

Las métricas de evaluación no son instrumentos neutrales. Cada métrica incorpora una teoría de qué significa "traducción correcta", y esa teoría tiene consecuencias:

- Un FST construido a partir de Cree literario penalizará Cree coloquial. Esta es una elección *política* sobre qué registro del idioma es valorado.
- Una clase de variante que acepta una forma dialectal pero no otra implícitamente estandariza el idioma. La estandarización es un acto político con una larga historia colonial.
- Un validador semántico que requiere superposición exacta de lema penaliza la paráfrasis creativa — una estrategia de traducción importante que los traductores hábiles usan deliberadamente.

Microeval hace estas elecciones *explícitas*. Cada clase de variante, cada entrada de lista de permitidos, cada regla de equivalencia semántica es una decisión discreta, documentada, revisable. Esta es una característica, no un defecto: significa que la comunidad puede inspeccionar, desafiar y modificar las reglas que rigen cómo se evalúa su idioma.

### 4.2 Gobernanza comunitaria de reglas de evaluación

Para idiomas indígenas específicamente, las decisiones de evaluación deben ser gobernadas por la comunidad de idiomas, no por investigadores o ingenieros externos. Esto no es solo un principio ético (aunque lo es) — es un requisito de corrección. Solo los hablantes fluidos pueden determinar si una variante es aceptable.

El modelo de gobernanza:

1. **Los investigadores proponen** clases de variantes, entradas de lista de permitidos y reglas semánticas basadas en análisis lingüístico
2. **Los hablantes revisan** cada propuesta y la aprueban, rechazan o modifican
3. **Las reglas aprobadas** se comprometen con el código base con atribución del hablante
4. **Las reglas disputadas** se marcan para discusión comunitaria — se excluyen de la puntuación hasta que se resuelvan
5. **La comunidad puede revocar** cualquier regla en cualquier momento eliminándola del conjunto aprobado

Este modelo requiere infraestructura (el arnés de evaluación, control de versiones, el protocolo de validación del hablante) y relaciones (confianza entre investigadores y miembros de la comunidad). Construir esta infraestructura es parte de la metodología de microeval.

### 4.3 Variación dialectal

La pregunta de gobernanza más difícil: cuando dos dialectos de un idioma discrepan sobre una forma, ¿cuál es "correcta"?

La respuesta de microeval: **ambas son correctas.** Las variantes dialectales se representan como clases de variantes adicionales con etiquetas de dialecto. La puntuación compuesta puede calcularse por dialecto o entre dialectos, dependiendo de lo que la evaluación intente medir.

Esto requiere que el corpus esté etiquetado por dialecto y que las clases de variantes sean conscientes del dialecto. También requiere que hablantes de múltiples dialectos participen en la validación. El documento de Estrategia de Asociación de Corpus aborda estos requisitos.

---

## Parte 5: Relación con trabajos anteriores

### 5.1 Lo que microeval NO es

| Afirmación que NO estamos haciendo | Por qué no |
|-----------------------------------|-----------|
| "Las métricas universales son inútiles" | Proporcionan líneas base esenciales y comparabilidad entre idiomas. Microeval complementa, no reemplaza. |
| "Las métricas neurales no pueden funcionar para LRL" | Pueden — con ajuste fino en datos específicos del idioma. Pero esos datos rara vez existen. Microeval funciona *ahora*. |
| "La evaluación basada en FST es novedosa" | Los FSTs se han usado en PNL durante décadas. La novedad está en desplegarlos sistemáticamente como métricas de evaluación de TA. |
| "LYSS es mejor que COMET" | No sabemos — no hemos hecho el estudio de correlación humana. Creemos que LYSS es más *informativo* para idiomas polisintéticos, pero no podemos afirmar que es más *preciso* hasta que tengamos evidencia. |

### 5.2 Trabajos anteriores más cercanos

| Trabajo | Relación con microeval |
|--------|----------------------|
| **MorphEval** (Sánchez-Cartagena & Toral, 2024) | Pruebas contrastivas para fenómenos morfológicos — complementario. MorphEval prueba si los sistemas *pueden* producir morfología; LYSS prueba si *lo hicieron*. |
| **CheckList** (Ribeiro et al., 2020) | Metodología de prueba de comportamiento para PNL — paradigma análogo. CheckList es una metodología; microeval también es una metodología, aplicada a evaluación en lugar de pruebas. |
| **HyTER** (Dreyer & Marcu, 2012) | Redes de equivalencia de significado — paralelo conceptual más cercano a LYSS-eq. HyTER enumera paráfrasis; LYSS-eq enumera variantes morfológicas. HyTER requiere construcción manual de red por oración; LYSS-eq las reglas se aplican en todo el corpus. |
| **Cobertura de Apertium** | Usa cobertura del FST como proxy para calidad de salida de TA — anticipa directamente LYSS-fst. No se formaliza como métrica ni se integra en un marco de puntuación. |
| **FUSE** (AmericasNLP 2025) | Evaluación basada en características para idiomas indígenas americanos — más similar en espíritu. FUSE propone características lingüísticas como dimensiones de evaluación; LYSS implementa características específicas para idiomas específicos. Se necesita comparación directa. |
| **AfriCOMET** (Wang & Adelani, 2024) | COMET ajustado fino para idiomas africanos — demuestra que las métricas neurales *pueden* ser adaptadas. Microeval es el complemento basado en reglas para idiomas donde no existen datos de ajuste fino. |

### 5.3 La distinción clave

Todo trabajo anterior en evaluación consciente de morfología ya sea:
1. **Propone un marco general** sin implementarlo para idiomas específicos (FUSE, CheckList)
2. **Implementa para idiomas de alto recurso** donde existen datos de entrenamiento (MorphEval se enfoca en pares europeos)
3. **Ajusta métricas neurales** lo que requiere los datos que no tenemos (AfriCOMET)

Microeval está específicamente diseñado para el caso donde:
- Existen herramientas lingüísticas (FSTs, diccionarios)
- No existen datos de entrenamiento para ajuste fino de métrica neural
- La complejidad morfológica del idioma derrota métricas de superficie
- La evaluación debe ser operacional *ahora*, no después de una campaña de recopilación de datos

---

## Parte 6: Preguntas abiertas y limitaciones honestas

### 6.1 Preguntas sin resolver

1. **¿Las métricas LYSS se correlacionan con juicios de calidad humana?** No sabemos. El estudio de correlación humana requerido (200+ pares de oraciones, 3+ hablantes bilingües) no ha sido realizado. Hasta que lo sea, las puntuaciones LYSS son estimaciones de ingeniería, no mediciones de calidad validadas.

2. **¿Cómo se comportan las métricas LYSS a medida que los idiomas cambian?** Los idiomas vivos evolucionan — nuevas palabras prestadas, dialectos cambiantes, neologismos emergentes. Los FSTs y las clases de variantes deben mantenerse. ¿Cuál es la carga de mantenimiento? No sabemos.

3. **¿Cuál es la calidad mínima del FST para LYSS-fst útil?** Si un FST cubre solo el 60% del léxico, ¿LYSS-fst sigue siendo útil, o el ruido abruma la señal? Necesitamos evidencia empírica.

4. **¿Puede microeval funcionar para desafíos no morfológicos?** Los idiomas con distinciones tonales, consonantes de clic o escritura logográfica presentan desafíos de evaluación que los FSTs no abordan. Microeval puede no aplicarse — o puede requerir herramientas diferentes.

5. **¿Cómo manejamos el problema del arranque en frío?** Construir una suite de microeval requiere experiencia lingüística. Para idiomas sin comunidad de lingüística computacional activa, ¿quién hace el trabajo?

### 6.2 Limitaciones honestas de LYSS

| Limitación | Severidad | Mitigación |
|-----------|----------|-----------|
| Sin datos de correlación humana | 🔴 Crítica | Experimento de validación requerido #1 |
| Tasa de rechazo falso del FST no medida | 🔴 Crítica | Experimento de validación requerido #2 |
| Solo implementado para un idioma (CRK) | 🟡 Significativa | Puerto de segundo idioma (North Sámi) planeado |
| Las clases de variantes pueden estar incompletas | 🟡 Significativa | Revisión comunitaria + adición continua |
| El validador semántico requiere spaCy | 🟡 Significativa | Dependencia opcional; degradación elegante |
| La cobertura del diccionario afecta la calidad de LYSS-sem | 🟡 Significativa | Requisitos de tamaño mínimo de diccionario documentados |
| No puede detectar fluidez o naturalidad | 🟡 Significativa | Requiere evaluación humana o métricas neurales |
| Requiere experiencia lingüística para extender | 🟡 Significativa | Documentación de metodología (este documento) reduce la barrera |

### 6.3 El camino a seguir

> *"Si solo nos enfocamos en lo que se generaliza, inevitablemente olvidaremos dónde no lo hace — y perderemos estos idiomas y todo su conocimiento y sabiduría."*

Microeval no es una solución al problema de evaluación. Es una práctica — una disciplina de prestar atención a lo que hace que cada idioma sea diferente, y codificar esa atención en código funcional. La práctica es laboriosa, específica del idioma y nunca termina. Pero produce algo que el paradigma de métrica universal no puede: evaluación que habla el idioma que evalúa.

---

## Apéndice A: Artículos Clave

| Documento | Año | Contribución | Relevancia |
|-----------|-----|-------------|-----------|
| Papineni et al., "BLEU" | 2002 | Métrica de n-gramas fundamental | Métrica universal de línea base |
| Popović, "chrF++" | 2017 | Métrica de n-gramas de caracteres | Mejor métrica de superficie para idiomas morfológicamente ricos |
| Rei et al., "COMET" | 2020 | Marco de evaluación neural | Métrica neural universal |
| Dreyer & Marcu, "HyTER" | 2012 | Semántica de equivalencia de significado | Predecesor conceptual de LYSS-eq |
| Burlot & Yvon, "MorphEval" | 2017 | Evaluación morfológica | Pruebas morfológicas contrastivas |
| Ribeiro et al., "CheckList" | 2020 | Pruebas de comportamiento para PNL | Paradigma metodológico |
| Sánchez-Cartagena & Toral, "MorphEval" | 2024 | Evaluación de capacidades morfológicas | Complemento de diagnóstico más cercano |
| Wang & Adelani, "AfriCOMET" | 2024 | Métrica neural adaptada para idiomas africanos | Demuestra la necesidad de evaluación específica del idioma |
| Lindén et al., "HFST" | 2011 | Marco de morfología de estado finito | Infraestructura para LYSS-fst |
| Wolfart, "Plains Cree" | 1973 | Gramática definitiva de Cree | Autoridad lingüística para microeval de CRK |
| Wolvengrey, "Cree: Words" | 2001 | Diccionario de Plains Cree | Recurso subyacente a LYSS-sem |
| Carroll et al., "CARE Principles" | 2020 | Gobernanza de datos indígenas | Marco de gobernanza para microeval |

## Apéndice B: Resumen de componentes LYSS

| Componente | Nombre de métrica | Lo que mide | Recursos requeridos | Estado de implementación |
|-----------|------------------|-----------|-------------------|------------------------|
| LYSS-fst | `fst_acceptance_rate` | Validez morfológica de palabras de salida | FST de GiellaLT | ✅ Operacional (CRK) |
| LYSS-eq | `equivalent_match_rate` | Detección de variantes aceptables | Clases de variantes curadas por lingüistas | ✅ Operacional (CRK, 6 clases) |
| LYSS-sem | `semantic_score` | Preservación de significado vía superposición de lema-glosa | FST + diccionario bilingüe + spaCy | ✅ Operacional (CRK, requiere spaCy) |

## Apéndice C: Idiomas con cobertura de FST de GiellaLT

Los siguientes idiomas tienen FSTs disponibles a través de GiellaLT y son candidatos para integración de LYSS-fst:

<!-- Esta lista debe ser poblada con datos de cobertura de GiellaLT actual. -->
<!-- Ver: https://github.com/giellalt -->

| Idioma | ISO 639-3 | Madurez del FST | Viabilidad de LYSS-fst |
|--------|-----------|-----------------|----------------------|
| Plains Cree | crk | Producción | ✅ Operacional |
| Northern Sámi | sme | Producción | 🟡 Planeado (primer puerto) |
| Southern Sámi | sma | Producción | 🟡 Candidato |
| Lule Sámi | smj | Producción | 🟡 Candidato |
| Inari Sámi | smn | Producción | 🟡 Candidato |
| Skolt Sámi | sms | Producción | 🟡 Candidato |
| Finnish | fin | Producción | 🟡 Candidato |
| Inuktitut | iku | Beta | 🟡 Necesita evaluación |
| Basque | eus | Beta | 🟡 Necesita evaluación |
| Welsh | cym | Beta | 🟡 Necesita evaluación |
