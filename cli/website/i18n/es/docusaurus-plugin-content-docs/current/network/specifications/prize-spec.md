---
sidebar_position: 8
title: "Especificación de Premio"
slug: '/network/specifications/prizes'
related:
  - label: "Run a Sovereign Contest"
    to: /docs/network/sovereignty/run-a-sovereign-contest
    kind: guide
    note: "The self-serve path to running your own prize"
  - label: "How Speakers Get Paid"
    to: /docs/network/perspectives/how-speakers-get-paid
    kind: position
    note: "The plain-language version of these numbers"
  - label: "The Economic Model"
    to: /docs/network/sovereignty/economic-model
    kind: doc
  - label: "MT Evaluation Rules"
    to: /docs/network/leaderboard/rules
    kind: doc
  - label: "Submit a Method"
    to: /docs/network/getting-started/submit-a-method
    kind: guide
---

# Especificación de Premios

Un premio es la mitad del incentivo del acuerdo de priorizar la evaluación (eval-first). Una comunidad o grupo de investigación cura un conjunto de evaluación pequeño y sellado: unos pocos cientos de pares, cada uno verificado ([Corpus Partnership](/docs/network/specifications/corpus-partnership) es ese flujo de trabajo). Un patrocinador ofrece un premio por alcanzar un puntaje objetivo en ese conjunto. Desde ese momento, el idioma es un desafío permanente: cualquier creador de métodos en el mundo puede apuntar a él, la tabla de clasificación mide cada intento en público y el estándar lo establece la propia clave de respuestas de la comunidad en lugar de quien grite más fuerte. Este documento especifica cómo funciona dicho premio (condiciones de umbral, proceso de reclamo, clases de dependencia y reglas) para que el estándar sea inequívoco y agnóstico al método cuando se abra uno.

Los premios son **financiados y retenidos por el patrocinador**: el dinero permanece en la organización patrocinadora, o en un fideicomiso comunitario que el patrocinador designe; **Champollion nunca retiene, custodia ni enruta los fondos de los premios.** Cualquier comunidad u organización puede ejecutar uno en la ruta de autoservicio en [Ejecutar un concurso soberano](/docs/network/sovereignty/run-a-sovereign-contest), reteniendo su propio corpus y su propio dinero.

> **Estado: PROPUESTO — no hay ningún premio abierto y nada aquí es reclamable todavía.**
> Lo que condiciona la *apertura* de un premio es el lado de la medición: un corpus de estándar de oro consensuado por la comunidad, el entorno de pruebas (sandbox) de evaluación aislado (especificado, aún no construido) y el filtro de revisión por hablantes. Ningún puntaje en este sitio ha superado el estándar de un premio. Consulte [Limitaciones honestas](/docs/network/honest-limitations). Referencia de métricas: la [Especificación de puntuación](/docs/network/specifications/scoring); protocolo: la [Especificación de benchmark](/docs/network/specifications/benchmark).

---

## ¿Desea ayudar a traer un idioma a la red?

No necesita esperar un premio. Las cosas de mayor impacto que puede hacer hoy:

- **Patrocine un premio de logro en traducción automática.** Financie un estándar específico — por ejemplo, un método confiable de inglés → Plains Cree. Champollion coordina la medición; los fondos permanecen con **usted** (su organización, o un fondo comunitario que designe) y se otorgan según los términos de la comunidad (véase [Soberanía de Datos](/docs/network/sovereignty/data-sovereignty) y el [Modelo Económico](/docs/network/sovereignty/economic-model)). La ruta de autoservicio de extremo a extremo está documentada en [Ejecutar un Concurso Soberano](/docs/network/sovereignty/run-a-sovereign-contest); traer un nuevo par de idiomas comienza con una [asociación de corpus](/docs/network/specifications/corpus-partnership).
- **Coordine una donación de cómputo.** Agrupe créditos de API / tokens para que la cola pública pueda mapear más pares y mostrar dónde la traducción es — y no es — aún confiable.
- **Apoye directamente las iniciativas de código abierto en las que construimos.** Champollion es la tubería que une el trabajo abierto de otras personas; apoyarlos *a ellos* es apoyar este mapa (preferimos señalarle hacia arriba que tomar crédito por su trabajo):
  - [Tatoeba](https://tatoeba.org) — oraciones paralelas contribuidas por la comunidad
  - [Catálogo de Lenguas en Peligro (ELCat)](https://www.endangeredlanguages.com) — datos de peligro de extinción
  - [Glottolog](https://glottolog.org) · [WALS](https://wals.info) · [Grambank](https://grambank.clld.org) · [PHOIBLE](https://phoible.org) — catálogos de idiomas y tipología
  - [GiellaLT](https://giellalt.uit.no) / ALTLab — los transductores morfológicos (FST)
  - [Masakhane](https://www.masakhane.io) — comunidad de traducción automática de idiomas africanos
  - [OPUS](https://opus.nlpl.eu) — corpora paralelos abiertos

> Para patrocinar un premio, organizar una donación de cómputo, o discutir una asociación, contacte al proyecto a través de [GitHub](https://github.com/gamedaysuits). Los custodios de claves comunitarias están en confirmación; ninguna nación u organización se nombra como socio antes de que haya consentido.

---

## 1. Filosofía

> **El acuerdo en una línea: resuelva un idioma, gane, devuélvalo.** Champollion es una operación de evaluación comparativa de ML a propósito — la competencia es cómo se resuelven los pares difíciles. Invitamos a investigadores de ML y a cualquier constructor capaz a construir el mejor método para un par de idiomas específico y difícil, ganar el premio, **y** entregar el método resultante a la organización de soberanía que posee ese idioma (§1.3). La energía competitiva es real, y está dirigida a la misión — obtener cada idioma traducido, bajo términos que su gente establece — no a escalar una tabla de clasificación por su propio bien.

### 1.1 Los Premios Recompensan Avances, No Participación

El dinero del premio se libera solo cuando un método demuestra lograr un umbral de capacidad definido. No hay premios de participación, premios para subcampeones, o pagos de consolación. Si nadie supera el umbral, nadie recibe pago. Esto es por diseño — significa que los patrocinadores solo pagan por resultados que realmente funcionan.

### 1.2 La Validación Comunitaria Es Innegociable

Las métricas automatizadas son aproximaciones (SCORING_SPEC §1.1). Un método puede puntuar bien en chrF++ y aceptación FST mientras produce resultados que ningún hablante aceptaría. **Cada reclamación de premio requiere validación comunitaria** — hablantes bilingües deben confirmar que el resultado es utilizable. Esta es la puerta de validación humana (BENCHMARK_SPEC §7).

### 1.3 La Transferencia de Propiedad Es Parte del Acuerdo

Los métodos que reclaman un premio están sujetos a la cláusula de transferencia de propiedad (BENCHMARK_SPEC §8.3). El desarrollador mantiene derechos de atribución y publicación. La organización de gobernanza obtiene el derecho de usar, modificar, distribuir y monetizar el método para su idioma. Esto no es una penalización — es el punto. El dinero del premio financia la creación de tecnología que pertenece a la comunidad de hablantes del idioma.

### 1.4 Anti-Manipulación

Los umbrales de premio se definen contra **evaluación de estándar de oro** (conjunto de prueba secreto, ejecutado por la organización de gobernanza en caja de arena). Los desarrolladores nunca ven los datos de prueba. Esto se aplica arquitectónicamente — no es una política que dependa del honor. Véase BENCHMARK_SPEC §8.2.

### 1.5 Licencia de Corpus: Los Corpus No Comerciales Se Mantienen Fuera del Carril de Premios

Algunos corpus utilizados durante el desarrollo de métodos tienen licencias no comerciales: por ejemplo, el corpus del libro de texto del idioma cree de EdTeKLA tiene la licencia **CC BY-NC-SA modificada de EdTeKLA** (con alcance de soberanía, no comercial; el libro de texto original es CC BY-NC-ND 4.0). Estos corpus son **solo para la vía de investigación/desarrollo**:

1. **Los corpus de estándar de oro de premios no deben incrustar contenido de corpus con licencia NC.** Los segmentos de prueba de estándar de oro son originales encargados por la comunidad (véase Estrategia de Asociación de Corpus) — creados por humanos para el premio, con derechos aclarados para evaluación e implementación comercial desde el inicio.
2. **Un método que reclama un premio no debe incrustar contenido de corpus con licencia NC** (p. ej., como datos de entrenamiento, ejemplos incrustados, o tablas de búsqueda). El método transferido debe ser implementable por la organización de gobernanza en cualquier término que elija — incluyendo comercialmente, si la comunidad así lo decide (BENCHMARK_SPEC §8.3); el contenido con licencia NC dentro de él envenenaría esa libertad.
3. **Los desarrolladores pueden usar libremente corpus con licencia NC para desarrollar y autoevaluar** — eso es para qué sirve el carril de desarrollo. La restricción se aplica a lo que se envía y lo que se implementa, no a cómo un desarrollador aprende.

### 1.6 Las Clases de Dependencia Limitan la Elegibilidad de Premios

Toda evaluación de premios ocurre en una caja de arena (§1.4), y los métodos ganadores de premios se transfieren a la organización de gobernanza (§1.3). Ambos hechos imponen la misma restricción: **todo de lo que un método depende debe ser algo que el desarrollador tenga derecho a poner en la caja de arena y transmitir a la comunidad.** Cada envío declara una clase de dependencia — definida en la [especificación de Interfaz de Método](/docs/network/specifications/methods#method-validity-and-dependency-classes) — y la elegibilidad sigue la clase:

| Clase de dependencia | ¿Elegible para premio? | Condiciones |
|------------------|----------------|------------|
| **S** — autónomo | ✅ Sí | Ninguna más allá de las condiciones de umbral en §2 |
| **O** — externo abierto (p. ej., FST AGPL reflejado en envío) | ✅ Sí | Artefactos fijados y vendidos en el envío; licencias permiten transferencia comunitaria; términos copyleft preservados (la comunidad recibe los mismos derechos que la licencia otorga a todos) |
| **A1** — inferencia LLM sustituible | ⚠️ Condicional | Modelo declarado, fijado y sustituible (debe ejecutarse contra un modelo de peso abierto alojado por la comunidad); evaluación enrutada a través de la puerta de LLM de caja de arena (🔲 planeado — los métodos A1 no pueden producir puntuaciones de estándar de oro hasta que la puerta esté operativa); la transferencia transmite la receta completa (indicaciones, entrenamiento, código), no el modelo |
| **A2** — API de servicio/datos externo no sustituible | ❌ Aún no | Inelegible hasta que el titular de derechos otorgue permisos de inclusión en caja de arena y transferencia. Permitido en la tabla de clasificación abierta con una bandera visible de "dependencia externa" |
| **X** — contenido agrupado sin derechos | ❌ Nunca | Inadmisible en cada carril |

La clase de un método es la clase más restrictiva entre sus dependencias declaradas. Las dependencias no declaradas de cualquier clase son descalificantes (§5).

---

## 2. Grupos de Premios Propuestos (ninguno abierto aún)

### 2.1 El Premio del Fundador — EN→Plains Cree (nêhiyawêwin)

| Campo | Valor |
|-------|-------|
| **Fondo de premios** | **$10,000 CAD** (propuesto) |
| **Par de idiomas** | Inglés → Plains Cree (EN→CRK) |
| **Patrocinador previsto** | Fundador del proyecto Champollion — un compromiso previsto, **no hay fondos retenidos en ningún lugar aún.** Cuando se comprometan, los fondos permanecerían con el patrocinador o un fondo comunitario designado — nunca con Champollion. |
| **Estado** | **PROPUESTO — no abierto.** No aceptando envíos. |
| **Se abre** | Solo cuando el corpus de estándar de oro, la caja de arena de evaluación, y la puerta de revisión por hablantes existan (ninguno existe aún), y los fondos del patrocinador se retengan verificablemente según §4.2. |
| **Expira** | Sin expiración una vez abierto. |

#### Condiciones de Umbral

Un método reclama el Premio del Fundador cumpliendo **TODAS** las siguientes condiciones simultáneamente:

| # | Condición | Métrica | Umbral | Justificación |
|---|-----------|--------|-----------|-----------|
| 1 | **Puntuación compuesta** | `composite` (SCORING_SPEC §4) | **≥ 0.80** | Entre Implementable (0.70) y Fluido (0.85). Requiere alta calidad en todas las dimensiones de métrica — no solo validez morfológica. |
| 2 | **Aceptación FST** | `fst_acceptance_rate` (SCORING_SPEC §2.2) | **≥ 0.99 (99%+)** | Efectivamente todas las palabras de salida deben ser formas morfológicamente válidas reconocidas por el FST de GiellaLT. La tolerancia del 1% cuenta para casos límite (nombres propios, neologismos, palabras prestadas) que el FST puede legítimamente no cubrir. Esta es la puerta de calidad definitoria para traducción automática polisintética — si el FST rechaza más del 1% de palabras, el método está produciendo formas que no existen en el idioma. Todo el punto de este premio es comprar un sistema que no mutile las cosas. |
| 3 | **chrF++** | `chrf_plus_plus` (SCORING_SPEC §2.1) | **≥ 55.0** | La superposición de n-gramas de caracteres debe exceder 55 en la escala 0–100. Asegura similitud a nivel de superficie con traducciones de referencia, no solo validez morfológica. |
| 4 | **Validación comunitaria** | Revisión humana (BENCHMARK_SPEC §7) | **≥ 70% "aceptable" o "excelente"** | Una muestra estratificada de salidas (≥30 entradas en niveles de dificultad 2–5) es revisada por ≥2 hablantes bilingües de CRK. Al menos el 70% de las entradas revisadas debe recibir una calificación de "aceptable" o "excelente". |
| 5 | **Evaluación de estándar de oro** | Ejecución en caja de arena (BENCHMARK_SPEC §8.2) | **Requerida** | Todas las métricas automatizadas deben calcularse contra el segmento de corpus `gold_standard`, ejecutado por la organización de gobernanza en un entorno aislado. Las puntuaciones del conjunto de desarrollo no cuentan. |
| 6 | **Reproducibilidad** | Coincidencia de huella digital (BENCHMARK_SPEC §3.8) | **±2%** | La organización de gobernanza debe poder re-ejecutar el método y lograr puntuaciones dentro de ±2% de la tarjeta de ejecución enviada. |

> **¿Por qué 99+% FST?** El problema central en traducción automática para idiomas polisintéticos es la alucinación — los LLM producen cadenas que *parecen* el idioma objetivo pero son morfológicamente inválidas. Un método que produce 95% de salida válida aún tiene 5% de palabras fabricadas — ruido inaceptable para cualquier uso en producción. El umbral de 99%+ exige casi cero alucinación mientras permite el caso límite raro (un nombre propio que el FST no conoce, un neologismo legítimo). Si un método no puede lograr aceptación FST de 99%+, no ha resuelto el problema.
>
> **¿Por qué compuesto 0.80?** Esto se sitúa entre Implementable (0.70) y Fluido (0.85). Un método en 0.80 con aceptación FST de 99%+ produce salida donde prácticamente cada palabra es una palabra real de Cree *y* la calidad general de traducción es alta en dimensiones de superficie, estructura y semántica. La puerta de validación comunitaria (condición #4) asegura que esto no sea solo manipulación de métrica — los hablantes deben confirmar que la salida es genuinamente utilizable.

#### Qué Significa Este Umbral en la Práctica

En compuesto ≥ 0.80 con FST ≥ 0.99 y chrF++ ≥ 55, un hablante bilingüe típicamente vería:

- **Prácticamente cada** palabra de salida es una palabra real de Cree (FST valida 99%+ — casi cero formas alucinadas)
- Las categorías gramaticales principales (persona, número, tiempo) son correctas en la mayoría de entradas
- El orden de palabras es generalmente natural
- El significado se preserva confiablemente
- Los errores restantes son errores de idioma real (inflexión incorrecta, obviación incorrecta, desajustes de animacidad) — no palabras fabricadas
- Un hablante fluido podría usar la salida como un borrador de alta calidad y corregirlo significativamente más rápido que traducir desde cero

Este es un sistema que **no mutila el idioma.** Puede no ser perfecto, pero cada palabra que produce es una palabra real. Ese es el umbral mínimo para traducción automática respetuosa de un idioma polisintético.

---

## 3. Proceso de Reclamación de Premio

### 3.1 Envío

1. El desarrollador envía su método completo y ejecutable a la organización de gobernanza:
   - Todo el código fuente
   - Todas las dependencias (datos de entrenamiento, diccionarios, configuraciones FST, indicaciones)
   - Instrucciones de instalación y ejecución
   - Un README describiendo el enfoque del método
   - Una tarjeta de ejecución del conjunto de desarrollo mostrando puntuaciones aproximadas (para preselección)

2. El desarrollador firma los términos de participación, incluyendo:
   - Cláusula de transferencia de propiedad (BENCHMARK_SPEC §8.3)
   - Declaración de no entrenamiento en datos de evaluación
   - Compromiso de reproducibilidad

### 3.2 Evaluación

1. La organización de gobernanza instala y ejecuta el método en un arnés aislado contra el corpus `gold_standard`
2. Las métricas automatizadas se calculan (compuesta, FST, chrF++, etc.)
3. Si se cumplen los umbrales automatizados (condiciones 1–3), la organización de gobernanza procede a revisión comunitaria
4. Si los umbrales automatizados NO se cumplen, el desarrollador recibe puntuaciones y retroalimentación. No se activa revisión comunitaria.

### 3.3 Revisión Comunitaria

1. Una muestra estratificada de salidas (≥30 entradas, cubriendo niveles de dificultad 2–5) se presenta a hablantes bilingües
2. Mínimo 2 revisores independientes califican cada entrada
3. Escala de calificación: **rechazar** / **esencia** / **aceptable** / **excelente**
4. Si ≥70% de las entradas reciben "aceptable" o "excelente" de ambos revisores, la validación comunitaria pasa

### 3.4 Pago

1. Se cumplen las 6 condiciones
2. La organización de gobernanza confirma el resultado
3. El premio se paga dentro de 30 días de la confirmación
4. La propiedad del método se transfiere según BENCHMARK_SPEC §8.3
5. El resultado se publica en la tabla de clasificación con nivel de verificación "Validado por Comunidad"

### 3.5 Envíos Múltiples

- El mismo desarrollador/equipo puede enviar múltiples veces
- Cada envío se evalúa independientemente
- Si un método se mejora y se re-envía, solo la tarjeta de ejecución más reciente cuenta
- El premio se otorga al **primer** método que supera todos los umbrales — no se divide

### 3.6 Envíos de Equipo

- Los equipos y pares de Ancianos-jóvenes son elegibles
- La distribución del premio dentro de un equipo es responsabilidad del equipo
- Todos los miembros del equipo deben firmar los términos de participación
- La atribución en la tabla de clasificación lista todos los miembros del equipo

---

## 4. Grupos de Premios Futuros {#4-future-prize-pools}

El Premio del Fundador es la semilla. Grupos de premios adicionales son financiados por patrocinadores. Cada nuevo grupo de premios se documenta como una nueva subsección de §2 con su propio:

- Cantidad y moneda del premio
- Par de idiomas
- Atribución del patrocinador
- Condiciones de umbral (que pueden diferir del Premio del Fundador)
- Fecha de expiración (si la hay)
- Cualquier condición especial

### 4.1 Plantilla de Premio de Patrocinador

Los patrocinadores financian grupos de premios en cualquier cantidad. Niveles sugeridos:

| Nivel | Cantidad | Umbral Sugerido |
|------|--------|---------------------|
| **Semilla** | $5,000–$15,000 | Implementable (compuesto ≥ 0.70) + validación comunitaria |
| **Avance** | $25,000–$50,000 | Fluido (compuesto ≥ 0.85) + validación comunitaria |
| **Gran Premio** | $100,000+ | Fluido + cobertura de múltiples registros + integración de implementación |

Los patrocinadores también pueden financiar:
- **Recompensas de mejora** — pago fijo por cada mejora de 5 puntos en chrF++ sobre el mejor actual
- **Premios de registro** — premios separados para registros específicos (formal, ceremonial, educativo)
- **Premios de velocidad** — mejor puntuación ajustada por costo (SCORING_SPEC §6.3)

### 4.2 Dónde Se Retienen los Fondos del Premio

Los fondos del premio son **retenidos por patrocinador**: permanecen con la organización patrocinadora, o con un fondo comunitario que el patrocinador designe — **nunca con Champollion**, que coordina la medición y no toca dinero. Un premio creíble publica, antes de abrirse: **quién retiene los fondos**, bajo qué arreglo (cuenta organizacional, fondo, o depósito en garantía de terceros de la elección del patrocinador), y el umbral de premio — de modo que superar el umbral sea verificable a partir de puntuaciones publicadas más el veredicto de validación de hablantes de la comunidad, y un incumplimiento de pago sería visible públicamente como uno. No hay fondos de premios retenidos en ningún lugar hoy. Si un premio expirara sin ser reclamado, los fondos permanecen donde siempre estuvieron — con el patrocinador — para ser redirigidos o retirados a discreción del patrocinador. La mecánica de autoservicio, incluyendo el riesgo de incumplimiento del patrocinador y sus mitigaciones, se documenta en [Ejecutar un Concurso Soberano](/docs/network/sovereignty/run-a-sovereign-contest) y las [Plantillas de Términos](/docs/network/sovereignty/terms-templates).

---

## 5. Descalificación

Un envío se descalifica si:

1. **Entrenamiento en datos de evaluación.** El método fue expuesto a entradas de corpus `gold_standard` o `held_out`. (Arquitectónicamente prevenido por ejecución aislada — pero si se encuentra evidencia de contaminación, el resultado se anula.)
2. **No reproducible.** La organización de gobernanza no puede reproducir puntuaciones dentro de ±2%.
3. **Dependencias no declaradas o inelegibles.** El método requiere acceso en tiempo de ejecución a servicios externos más allá de lo que su manifiesto de dependencia declara, o su clase de dependencia efectiva es A2 o X (§1.6). La inferencia LLM de Clase A1 declarada enrutada a través de la puerta de evaluación es permitida; cualquier otra dependencia de red en tiempo de ejecución — y cualquier dependencia no declarada de cualquier clase — es descalificante.
4. **Términos de participación no firmados.** Todos los miembros del equipo deben acordar la transferencia de propiedad.
5. **Manipulación detectada.** La salida está optimizada para la métrica en lugar de calidad de traducción (detectada por revisión comunitaria y/o verificaciones anti-manipulación según BENCHMARK_SPEC §9.3).

---

## 6. Relación con Otras Especificaciones

| Este Documento | Referencias | Para |
|--------------|-----------|-----|
| §2 condiciones de umbral | SCORING_SPEC §4 (compuesta), §2.1–2.2 (métricas), §5 (niveles) | Definiciones de métrica y escala |
| §2 validación comunitaria | BENCHMARK_SPEC §7 | Protocolo de revisión humana |
| §3 ejecución en caja de arena | BENCHMARK_SPEC §8.2 | Mecanismo de soberanía |
| §3 transferencia de propiedad | BENCHMARK_SPEC §8.3 | Términos de transferencia de IP |
| §1.6 clases de dependencia | Especificación de Interfaz de Método; BENCHMARK_SPEC §8.6 | Definiciones de clase, términos de admisibilidad, política de red de caja de arena |
| §4 premios ajustados por costo | SCORING_SPEC §6.3 | Fórmula ajustada por costo |

---

## 7. Sincronización Código–Especificación

### 7.1 Fuente Canónica

Este documento (`cli/website/docs/network/specifications/prize-spec.md`) es la fuente canónica para:
- Definiciones de grupo de premios (§2)
- Condiciones de umbral (§2.x)
- Proceso de reclamación (§3)
- Reglas de descalificación (§5)

### 7.2 Requisitos de Implementación

Cuando se activa un grupo de premios:
1. La interfaz de usuario de la tabla de clasificación debe mostrar premios activos y sus condiciones de umbral
2. Las tarjetas de ejecución que cumplen umbrales automatizados (condiciones 1–3) deben marcarse para revisión comunitaria
3. El campo `quality_tier` en el esquema de tarjeta de ejecución ya captura el nivel ("implementable", "fluido")
4. No se necesitan cambios de código nuevos en el arnés — la especificación de premio es una capa de política sobre puntuación existente

---

*Las estructuras de premios deben ser compatibles con términos de transferencia de propiedad. El ganador puede reclamar el premio, pero el método se convierte en propiedad de la organización de gobernanza si alcanza el nivel Implementable. Esto es por diseño — el premio financia la creación de tecnología que pertenece a la comunidad de hablantes del idioma.*
