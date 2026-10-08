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

Un premio es la parte del incentivo en el pacto de evaluación primero. Una comunidad o
grupo de investigación cura un conjunto de evaluación pequeño y sellado —unos pocos
cientos de pares, cada uno verificado ([Asociación de corpus](/docs/network/specifications/corpus-partnership)
es ese flujo de trabajo). Un patrocinador publica un premio contra una puntuación objetivo en ese
conjunto. A partir de ese momento, el idioma se convierte en un desafío permanente: cualquier desarrollador
de métodos en el mundo puede aspirar a él, la tabla de clasificación mide cada intento
en público y el estándar lo define la propia clave de respuestas de la comunidad en lugar
de quien grite más fuerte. Este documento especifica cómo funciona dicho premio
—condiciones de umbral, proceso de reclamo, clases de dependencia y reglas—
para que el estándar sea inequívoco e independiente del método cuando se abra uno.

Los premios son **financiados y custodiados por el patrocinador**: el dinero permanece con la
organización patrocinadora, o con un fideicomiso comunitario que el patrocinador designe —
**Champollion nunca retiene, custodia en plica ni canaliza fondos de premios.** Cualquier comunidad
u organización puede organizar uno mediante la vía de autoservicio en
[Organizar un concurso soberano](/docs/network/sovereignty/run-a-sovereign-contest),
conservando su propio corpus y su propio dinero.

> **Estado: PROPUESTO — ningún premio está abierto y nada aquí es reclamable todavía.**
> Lo que condiciona la *apertura* de un premio es la parte de la medición: un
> corpus de referencia validado por la comunidad y el filtro de revisión de hablantes.
> Ninguno de los dos existe todavía. El sandbox de evaluación aislado de la red sí se incluye —consulte la
> [Especificación de benchmark §8.6](/docs/network/specifications/benchmark#86-dependency-classes-and-the-sandbox-network-policy).
> Ninguna puntuación en este sitio ha superado el umbral de un premio. Consulte
> [Limitaciones honestas](/docs/network/honest-limitations). Referencia de métricas:
> la [Especificación de puntuación](/docs/network/specifications/scoring); protocolo:
> la [Especificación de benchmark](/docs/network/specifications/benchmark).

> **La capa de promesas está activa.** El bloqueo que hace que un término de premio declarado
> no sea editable una vez que existen postulaciones, y los resultados retenidos (`hidden_until_close`),
> se aplican en la base de datos en el endpoint alojado en la red a partir del
> 07-09-2026. Un host federado obtiene las mismas reglas aplicando la migración
> que se incluye con el harness; frente a un endpoint más antiguo, el harness recurre
> al conjunto base y lo advierte en lugar de fingir. La regla de egreso
> exclusivo de agregados en el §3.2 siempre se ha aplicado en todas partes.

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

> Para patrocinar un premio, organizar una donación de cómputo o discutir una asociación,
> comuníquese con el proyecto a través de [GitHub](https://github.com/gamedaysuits). Todavía no se han designado
> custodios de claves comunitarias, y no se nombra a ninguna nación u organización
> como socia antes de que haya dado su consentimiento.

---

## 1. Filosofía

> **El trato en una línea: descifre un idioma, gane, según los términos declarados por el anfitrión.**
> Champollion es una operación de benchmarking de ML por diseño —la competencia es la forma en que se resuelven
> los pares difíciles. Invitamos a investigadores de ML y a cualquier desarrollador capaz a crear el
> mejor método para un par de idiomas difícil específico y ganar el premio. Lo que sucede con
> el método después es la elección publicada del **anfitrión**, no la nuestra ni una predeterminada:
> una comunidad que desea que se le entregue el método ganador lo establece en sus
> términos, y una que solo desea medir y eliminar establece eso en su lugar (§1.3).
> La energía competitiva es real y está orientada a la misión —lograr que cada
> idioma se traduzca, bajo los términos que su gente establezca—, no a subir en una tabla de clasificación
> por el simple hecho de hacerlo.

### 1.1 Los Premios Recompensan Avances, No Participación

El dinero del premio se libera solo cuando un método demuestra lograr un umbral de capacidad definido. No hay premios de participación, premios para subcampeones, o pagos de consolación. Si nadie supera el umbral, nadie recibe pago. Esto es por diseño — significa que los patrocinadores solo pagan por resultados que realmente funcionan.

### 1.2 La Validación Comunitaria Es Innegociable

Las métricas automatizadas son aproximaciones (SCORING_SPEC §1.1). Un método puede puntuar bien en chrF++ y aceptación FST mientras produce resultados que ningún hablante aceptaría. **Cada reclamación de premio requiere validación comunitaria** — hablantes bilingües deben confirmar que el resultado es utilizable. Esta es la puerta de validación humana (BENCHMARK_SPEC §7).

### 1.3 Lo que sucede con un método ganador se declara, no se asume {#1-3-declared-terms}

Una cosa es fija, porque es lo que *es* un concurso soberano: la postulación se entrega al propio nodo aislado de la red del anfitrión, el cual la ejecuta contra un conjunto sellado en la máquina del anfitrión. Lo que sucede con ella *después* es la elección declarada del anfitrión, tomada por concurso y publicada con él —y es **una opción entre tres**:

| El término | Lo que significa para usted |
|---|---|
| `pass_to_holders` — *pasar a los titulares* | El método pasa a los titulares del benchmark soberano. Ellos lo evalúan y lo conservan, sin importar quién gane. |
| `retain_ip` — *retener la propiedad intelectual* | Usted conserva la propiedad de su método. El anfitrión lo evalúa y conserva como máximo una copia sellada para auditoría. |
| `release_open` — *publicar en abierto* | Usted conserva la propiedad pero debe publicar el método bajo una licencia abierta. Dicha publicación es la condición del premio. |

Todo lo demás que se deriva de un término —si el artefacto se conserva, si se transfiere algún derecho, para qué puede usarlo el anfitrión, cuándo vence una publicación— se **deriva** de la opción que eligió el anfitrión (§2.1, condición 7), no de una casilla independiente que el anfitrión deba marcar. Un anfitrión elige el término; el detalle se deduce de él.

Dos consecuencias que vale la pena expresar con claridad:

- **Un concurso sin términos de premio declarados no tiene premio.** Ese es el valor predeterminado. No es un concurso menor, y nada de la postulación se transfiere.
- **Nada se da por sentado.** El término declarado se procesa mediante hash, se muestra al participante en lenguaje sencillo y se acepta mediante ese hash; la aceptación viaja dentro de la postulación y está cubierta por su hash de contenido, y el nodo del anfitrión rechaza una postulación que haya aceptado cualquier otra cosa. Luego, el término se congela en el momento en que el concurso recibe su primera postulación, de modo que nadie quede sujeto a términos que no hubiera podido leer.

Cuando un anfitrión elige `pass_to_holders`, el desarrollador aún conserva los derechos de atribución y publicación, y el objetivo del acuerdo es que el dinero del premio financie tecnología que la comunidad lingüística pueda utilizar en la práctica. Esa es una buena razón para que un anfitrión comunitario elija ese término. Es una elección, no una imposición.

### 1.4 Anti-Manipulación

Los umbrales de premio se definen contra **evaluación de estándar de oro** (conjunto de prueba secreto, ejecutado por la organización de gobernanza en caja de arena). Los desarrolladores nunca ven los datos de prueba. Esto se aplica arquitectónicamente — no es una política que dependa del honor. Véase BENCHMARK_SPEC §8.2.

### 1.5 Licencia de Corpus: Los Corpus No Comerciales Se Mantienen Fuera del Carril de Premios

Algunos corpus utilizados durante el desarrollo de métodos tienen licencias no comerciales —por ejemplo, el corpus del libro de texto de idioma cree de EdTeKLA tiene la **licencia modificada CC BY-NC-SA de EdTeKLA** (de alcance soberano, no comercial; el libro de texto original es CC BY-NC-ND 4.0). Estos corpus son **exclusivamente para el carril de investigación/desarrollo**:

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
| **Fondo del premio** | **$10,000 CAD** (propuesto) |
| **Par de idiomas** | Inglés → Cree de las llanuras (EN→CRK) |
| **Patrocinador previsto** | Fundador del proyecto Champollion —un compromiso previsto, **aún no se retienen fondos en ninguna parte.** Cuando se comprometan, los fondos permanecerán con el patrocinador o con un fideicomiso comunitario designado —nunca con Champollion. |
| **Estado** | **PROPUESTO — no abierto.** No se aceptan envíos. |
| **Apertura** | Solo cuando existan el corpus de referencia validado y el filtro de revisión de hablantes (ninguno existe todavía), el sandbox de evaluación se haya probado con modelos reales (hasta ahora solo ha ejecutado un método de prueba) y los fondos del patrocinador estén verificablemente retenidos según el §4.2. |
| **Vencimiento** | Sin vencimiento una vez abierto. |

#### Condiciones de Umbral

Un método reclama el Premio del Fundador cumpliendo **TODAS** las siguientes condiciones simultáneamente:

| # | Condición | Métrica | Umbral | Justificación |
|---|-----------|--------|-----------|-----------|
| 1 | ~~Puntaje compuesto~~ — **retirado** | — | — | Esta condición (compuesto ≥ 0.80) se retiró junto con el puntaje compuesto el 2026-10-04 ([Especificación de puntuación §4](/docs/network/specifications/scoring#4-composite-score)). La condición de puntuación es únicamente chrF++ (condición 3); se conserva el número para que las demás condiciones mantengan su numeración. |
| 2 | **Aceptación por FST** (un control diagnóstico, no la puntuación) | `fst_acceptance_rate` (SCORING_SPEC §2.2) | **≥ 0.99 (99%+)** | Prácticamente todas las palabras de salida deben ser formas morfológicamente válidas reconocidas por el FST de GiellaLT. La tolerancia del 1% contempla casos límite (nombres propios, neologismos, préstamos lingüísticos) que el FST legítimamente podría no cubrir. Este es el control de calidad definitorio para la traducción automática polisintética: si el FST rechaza más del 1% de las palabras, el método está produciendo formas que no existen en el idioma. El objetivo principal de este premio es adquirir un sistema que no estropee las cosas. |
| 3 | **chrF++** (la puntuación) | `chrf_plus_plus` (SCORING_SPEC §2.1), con su firma de sacreBLEU e IC del 95% | **≥ 55.0** | El chrF++ de corpus en el conjunto sellado debe alcanzar 55 en la escala de 0 a 100 —la métrica principal estándar ([Especificación de puntuación](/docs/network/specifications/scoring#how-runs-are-scored)). Compara cada salida con su referencia, por lo que un sistema no puede cumplirla con palabras válidas que no traduzcan la entrada. |
| 4 | **Validación de la comunidad** | Revisión humana (BENCHMARK_SPEC §7) | **≥ 70% "aceptable" o "excelente"** | Una muestra estratificada de salidas (≥30 entradas en los niveles de dificultad 2–5) es revisada por ≥2 hablantes bilingües de CRK. Al menos el 70% de las entradas revisadas debe recibir una calificación de "aceptable" o "excelente". |
| 5 | **Evaluación con estándar de referencia** | Ejecución en sandbox (BENCHMARK_SPEC §8.2) | **Obligatorio** | Todas las métricas automatizadas deben calcularse contra el segmento de corpus `gold_standard`, ejecutado por la organización de gobernanza en un entorno de sandbox. Las puntuaciones del conjunto de desarrollo no cuentan. |
| 6 | **Reproducibilidad** | Coincidencia de huella digital (BENCHMARK_SPEC §3.8) | **±2%** | La organización de gobernanza debe poder volver a ejecutar el método y obtener puntuaciones dentro de un margen de ±2% respecto a la run card enviada. |
| 7 | **Se cumplen los términos declarados del premio del concurso** | Las verificaciones que dicho término requiere (ver más abajo) | **Obligatorio** | Los premios existen únicamente en concursos soberanos, donde su propuesta es ejecutada por el nodo aislado de la red (air-gapped) del anfitrión en un conjunto sellado. Lo que suceda con ella *después* corresponde a una de tres opciones declaradas, publicadas con el concurso antes de que se abran las postulaciones —no una condición única que todos los concursos impongan. |

#### La condición 7 en detalle: el término es una opción entre tres

Cada concurso soberano funciona de la misma manera en el momento de la ejecución: usted entrega su
método (pesos o código) al nodo aislado de la red del anfitrión, y el nodo lo evalúa
en el conjunto sellado. Eso es exactamente lo que significa "el anfitrión lo midió", y no
es ajustable.

Lo que sucede *después* de eso es elección del anfitrión, declarada por concurso, y es
una de tres opciones. El anfitrión la publica antes de que se abran las postulaciones; queda
**congelada** en el momento en que el concurso recibe su primera postulación, de modo que el término que usted lee es
el término al que queda sujeto.

| El término | Lo que significa para usted |
|---|---|
| `pass_to_holders` — *pasar a los titulares* | El método pasa a los titulares del benchmark soberano. Ellos lo evalúan y lo conservan, sin importar quién gane. |
| `retain_ip` — *retener la propiedad intelectual* | Usted conserva la propiedad de su método. El anfitrión lo evalúa y conserva como máximo una copia sellada para auditoría. |
| `release_open` — *publicar en abierto* | Usted conserva la propiedad pero debe publicar el método bajo una licencia abierta. Dicha publicación es la condición del premio. |

**Lo que significa cada opción en detalle.** Estas cuatro dimensiones —más la licencia
que acompaña a una publicación obligatoria— se *derivan* de la opción: un anfitrión
nunca escribe `rights` o `host_use` manualmente, y ningún concurso puede mezclarlas
ni combinarlas:

| Campo | `pass_to_holders` | `retain_ip` | `release_open` |
|---|---|---|---|
| `retention` — ¿el artefacto sobrevive a la evaluación? | `retain` | `retain_sealed_audit` | `retain` |
| `rights` — ¿se transfiere la propiedad? | `assignment_to_host` | `participant_retains_all` | `participant_retains_all` |
| `host_use` — ¿para qué puede usarlo el anfitrión? | `any` | `evaluation_only` | `any` (bajo la licencia abierta que usted publicó) |
| `release` — ¿debe publicarlo **usted**, y cuándo? | `not_required` | `not_required` | `required_before_prize` |
| `release_license` — bajo qué licencia publica | — | — | `any_osi`, o un identificador SPDX específico |

Dos de las opciones permiten al anfitrión restringir un campo, y eso es todo:

- bajo `retain_ip`, el anfitrión puede establecer `retention` en `delete_after_scoring` —su método se destruye una vez que ha sido evaluado;
- bajo `release_open`, el anfitrión puede trasladar la publicación a `required_before_scores` (usted publica antes de que se divulguen sus propias puntuaciones) o a `required_after_prize` (usted publica después del pago), y puede especificar la licencia en lugar de aceptar cualquiera aprobada por la OSI.

Un `community_terms_url` —un enlace `https://` a los propios términos redactados por el anfitrión—
puede acompañar a cualquiera de las tres opciones. En el propio concurso, la opción elegida se
registra como su `disposition`, y ese es el valor único a partir del cual se lee todo lo
anterior.

Cualquier otra cosa se rechaza al momento de crear el concurso: una opción no ofrece
un campo que no contempla, y un campo escrito a mano donde debería ser
derivado se rechaza por su nombre en lugar de aceptarse ciegamente.

**Qué se verifica antes de pagar un premio.** Las verificaciones obligatorias se derivan
del término; ningún anfitrión las configura por separado:

- **Entrega** — siempre. El anfitrión conserva el artefacto exacto que evaluó (el
  resumen criptográfico del método registrado por el nodo). Este punto se mide.
- **Publicación** — bajo `release_open`, cuando la publicación vence antes de las
  puntuaciones o antes del premio. El anfitrión registra la URL de publicación y el SHA-256 del
  artefacto publicado; el registro se verifica y la URL nunca se consulta, de modo que un
  resultado congelado nunca dependa de la disponibilidad del servidor de un tercero. Una publicación exigida
  *después* del premio es una obligación que vence después del desembolso, por lo que no es
  una de las comprobaciones previas al pago.
- **Cesión** — bajo `pass_to_holders`, donde la propiedad se transfiere. Una
  cesión es un instrumento firmado fuera de esta plataforma; el anfitrión la registra
  junto con su fecha, y la plataforma verifica que exista un registro.
  **Nunca realiza verificaciones jurídicas.**

**Un concurso sin términos de premio declarados no tiene premio.** No existe ningún término
predeterminado y no se asume ninguno en nombre de nadie. Participar en un concurso que sí
lo declara implica aceptarlo explícitamente, por su hash, al momento del envío —la
aceptación se empaqueta dentro de su paquete y es parte de lo que el nodo del anfitrión
comprueba.

> **¿Por qué 99+% en FST?** El problema principal en la traducción automática para lenguas polisintéticas es la alucinación: los LLM producen cadenas que *parecen* del idioma de destino pero son morfológicamente inválidas. Un método que produce un 95% de salidas válidas todavía contiene un 5% de palabras inventadas —un ruido inaceptable para cualquier uso en producción. El umbral de 99%+ exige casi cero alucinaciones a la vez que permite casos límite excepcionales (un nombre propio desconocido para el FST, un neologismo legítimo). Si un método no puede alcanzar una aceptación FST del 99%+, no ha resuelto el problema.
>
> **Por qué chrF++ y FST juntos, y por qué ninguno basta por sí solo.** La aceptación FST solo indica que cada palabra existe; un sistema que repita una única oración válida para cada entrada la superaría por completo. chrF++ compara cada salida con su referencia, por lo que detecta esa anomalía. Ninguna cifra automática certifica la calidad: el filtro de validación comunitaria (condición #4) es lo que confirma que los hablantes consideran que la salida es utilizable.

#### Qué Significa Este Umbral en la Práctica

Lo que las condiciones determinan en conjunto:

- **Prácticamente cada** palabra de salida es una palabra cree real (el FST valida el 99%+ —casi cero formas inventadas)
- Las salidas son cercanas a las referencias en el conjunto sellado (chrF++ ≥ 55)
- Hablantes bilingües, bajo el propio protocolo de la comunidad, calificaron al menos el 70% de una muestra estratificada como aceptable o superior —la única condición que da cuenta de la calidad
- Los errores restantes son errores lingüísticos reales (inflexión incorrecta, obviación incorrecta, discordancias de animacidad) —no palabras inventadas

Este es un sistema que **no mutila el idioma.** Puede no ser perfecto, pero cada palabra que produce es una palabra real. Ese es el umbral mínimo para traducción automática respetuosa de un idioma polisintético.

---

## 3. Proceso de Reclamación de Premio

### 3.1 Admisión, luego envío

1. **Clasifique en público.** El desarrollador evalúa el conjunto de desarrollo publicado del concurso con su propio sistema y conserva el comprobante (`mt-eval contest qualify`). El comprobante es autoreportado por diseño —es una declaración, y el anfitrión la verifica en el paso 4.

2. **Entregue la postulación.** Se ingresa a un concurso proporcionando al nodo del anfitrión algo que pueda ejecutar, en uno de dos carriles:
   - un **modelo** —pesos safetensors, un tokenizador declarativo y una configuración, sin código alguno (`mt-eval contest submit-model`); o
   - un **método** —un Dockerfile y un punto de entrada, incorporados de forma local para que se compile y ejecute sin red (`mt-eval contest submit-method`).

   Subir traducciones de un conjunto de prueba publicado y vincular una puntuación que el propio desarrollador publicó fueron **retirados como vías de ingreso al concurso el 06-09-2026** y los comandos fueron eliminados. Las puntuaciones autoreportadas siguen perteneciendo a la tabla de clasificación abierta, que es un panel público indexado por corpus y dirección de par —no un concurso ni un carril de premios.

3. **Declare, en la postulación misma:** la pista (`constrained` —entrenada solo con los datos permitidos por el anfitrión— o `unconstrained`), la cantidad de parámetros, la licencia de los pesos y si son públicos, los datos de entrenamiento a los que se refiere la declaración restringida, si esta es la postulación principal del equipo o una contrastiva y —cuando el concurso lo requiera— una descripción del sistema. El desarrollador también envía `--agree` para los términos de envío de métodos y, cuando el concurso declare términos de premio, `--accept-terms <hash>` para estos últimos.

### 3.2 Evaluación

1. El nodo del anfitrión ejecuta sus **comprobaciones estáticas** en el paquete, rechazando todo lo que requiera red y rechazando cualquier postulación que haya aceptado términos de premio distintos a los que este concurso declara.
2. El nodo **vuelve a ejecutar la prueba de clasificación por sí mismo**, en su propia copia del conjunto de desarrollo público, utilizando el mismo ejecutor de carril y el mismo evaluador. El comprobante del desarrollador era una afirmación; esta es la medición. Cualquier discrepancia se rechaza aquí —antes de solicitar la aprobación de ningún custodio y antes de abrir el conjunto sellado— indicando lo que se declaró, lo que se midió y cuál era el estándar requerido.
3. **Los custodios autorizan** la ejecución sellada (esquema M de N, según el modelo de autorización del concurso). La autorización es de uso único, por tiempo limitado y vinculada a la huella digital exacta (hash del paquete, corpus, versión del corpus, nodo).
4. La postulación se ejecuta contra el corpus sellado `gold_standard` dentro del sandbox aislado de la red en la propia máquina del anfitrión, y se calculan las métricas automatizadas (chrF++ con su IC y firma, las demás métricas estándar y diagnósticos como la aceptación FST). Una reserva sellada declarada y cualquier suite de pruebas de terceros se ejecutan dentro de la **misma** ejecución autorizada.
5. **Solo salen las puntuaciones agregadas** —aplicado en la capa de la base de datos, no por convención. Si el concurso prometió `hidden_until_close`, la ficha se retiene hasta que el cierre la publique.
6. Si se cumplen los umbrales automatizados (condiciones 2–3), el anfitrión procede a la revisión comunitaria. Si no se cumplen, el desarrollador recibe sus puntuaciones y no se activa ninguna revisión comunitaria.

### 3.3 Revisión Comunitaria

1. Una muestra estratificada de salidas (≥30 entradas, cubriendo niveles de dificultad 2–5) se presenta a hablantes bilingües
2. Mínimo 2 revisores independientes califican cada entrada
3. Escala de calificación: **rechazar** / **esencia** / **aceptable** / **excelente**
4. Si ≥70% de las entradas reciben "aceptable" o "excelente" de ambos revisores, la validación comunitaria pasa

### 3.4 Pago

El orden es estricto: **pasos de control declarados verificados → concurso cerrado → premio pagado.** Cuáles pasos sean depende de los términos que *este* concurso declaró (§2.1, condición 7) —pero sean los que fueren, se verifican antes del cierre y no se paga nada a partir de una clasificación que aún esté en movimiento.

Un organizador puede usar `close --force` para omitir un control no superado. El cierre entonces se procesa y la clasificación congelada registra la elegibilidad de premio de esa postulación exactamente como se calculó —no elegible, indicando el paso fallido por su nombre. Un cierre forzado es un concurso cerrado, nunca un control superado.

1. Se cumplen las 7 condiciones
2. **Cada paso de control requerido por los términos de premio declarados del concurso está verificado** —siempre la entrega del artefacto evaluado, más una publicación registrada y/o una cesión registrada cuando dichos términos lo exijan
3. El concurso se **cierra** y su clasificación se congela
4. La organización de gobernanza confirma el resultado contra la clasificación congelada
5. El premio se paga dentro de los 30 días posteriores a la confirmación
6. Todo lo que los términos declarados indiquen sobre la titularidad surte efecto según lo especificado en dichos términos —para un concurso cuyo `rights` sea `participant_retains_all`, no se transfiere absolutamente nada
7. El resultado se publica en la tabla de clasificación con el nivel de verificación "Validado por la comunidad"

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

| Nivel | Monto | Umbral sugerido |
|-------|-------|-----------------|
| **Semilla** | $5,000–$15,000 | Un estándar de chrF++ en el conjunto sellado, publicado antes de que abra el concurso + validación comunitaria |
| **Avance significativo** | $25,000–$50,000 | Un estándar de chrF++ más alto + validación comunitaria |
| **Gran Premio** | $100,000+ | Las condiciones de Avance significativo + cobertura de múltiples registros + integración para despliegue |

El estándar de referencia es siempre chrF++ (con su firma, para que sea reproducible); se pueden agregar filtros de diagnóstico como la aceptación FST en calidad de controles. Una puntuación compuesta o un nivel de calidad no pueden constituir el umbral de un premio.

Los patrocinadores también pueden financiar:
- **Recompensas por mejora** — pago fijo por cada mejora de 5 puntos en chrF++ respecto al mejor resultado actual
- **Premios por registro** — galardones independientes para registros específicos (formal, ceremonial, educativo)
- **Premios por costo** — menor costo por entrada entre los métodos que superen el umbral de chrF++ (el costo se informa junto a la puntuación, nunca combinado con ella)

### 4.2 Dónde Se Retienen los Fondos del Premio

Los fondos del premio son **retenidos por patrocinador**: permanecen con la organización patrocinadora, o con un fondo comunitario que el patrocinador designe — **nunca con Champollion**, que coordina la medición y no toca dinero. Un premio creíble publica, antes de abrirse: **quién retiene los fondos**, bajo qué arreglo (cuenta organizacional, fondo, o depósito en garantía de terceros de la elección del patrocinador), y el umbral de premio — de modo que superar el umbral sea verificable a partir de puntuaciones publicadas más el veredicto de validación de hablantes de la comunidad, y un incumplimiento de pago sería visible públicamente como uno. No hay fondos de premios retenidos en ningún lugar hoy. Si un premio expirara sin ser reclamado, los fondos permanecen donde siempre estuvieron — con el patrocinador — para ser redirigidos o retirados a discreción del patrocinador. La mecánica de autoservicio, incluyendo el riesgo de incumplimiento del patrocinador y sus mitigaciones, se documenta en [Ejecutar un Concurso Soberano](/docs/network/sovereignty/run-a-sovereign-contest) y las [Plantillas de Términos](/docs/network/sovereignty/terms-templates).

---

## 5. Descalificación

Un envío se descalifica si:

1. **Entrenamiento con datos de evaluación.** El método fue expuesto a entradas de corpus `gold_standard` o `held_out`. (Prevenido a nivel de arquitectura mediante la ejecución en sandbox; no obstante, si se detectan indicios de contaminación, el resultado queda anulado).
2. **No reproducible.** La organización de gobernanza no puede reproducir las puntuaciones dentro de un margen de ±2%.
3. **Dependencias no declaradas o no permitidas.** El método requiere acceso en tiempo de ejecución a servicios externos más allá de lo que declara su manifiesto de dependencias, o su clase de dependencia efectiva es A2 o X (§1.6). Se permite la inferencia de LLM declarada de Clase A1 enrutada a través del gateway de evaluación; cualquier otra dependencia de red en tiempo de ejecución —y cualquier dependencia no declarada de cualquier clase— es motivo de descalificación.
4. **Términos de participación no firmados.** Todos los miembros del equipo deben aceptar los términos de envío de métodos y —cuando el concurso declare términos de premio (§1.3)— dichos términos, mediante su hash.
5. **Manipulación detectada.** La salida está optimizada para la métrica en lugar de para la calidad de traducción (detectado mediante revisión comunitaria y/o comprobaciones contra manipulación según BENCHMARK_SPEC §9.3).

---

## 6. Relación con Otras Especificaciones

| Este documento | Referencias | Para |
|----------------|-------------|------|
| §2 condiciones de umbral | SCORING_SPEC "Cómo se puntúan las ejecuciones" y §2.1–2.2 (métricas) | Definiciones de métricas y escala |
| §2 validación comunitaria | BENCHMARK_SPEC §7 | Protocolo de revisión humana |
| §3 ejecución en sandbox | BENCHMARK_SPEC §8.2 | Mecanismo de soberanía |
| §1.3 términos de premio declarados | BENCHMARK_SPEC §8.3 | Qué puede hacer el anfitrión con una postulación posteriormente |
| §1.6 clases de dependencia | Especificación de interfaz de métodos; BENCHMARK_SPEC §8.6 | Definiciones de clases, términos de admisibilidad, política de red en sandbox |
| §4 premios por costo | SCORING_SPEC §6.2 | Fórmulas de métricas de costo |

---

## 7. Sincronización Código–Especificación

### 7.1 Fuente Canónica

Este documento (`cli/website/docs/network/specifications/prize-spec.md`) es la fuente canónica para:
- Definiciones de grupo de premios (§2)
- Condiciones de umbral (§2.x)
- Proceso de reclamación (§3)
- Reglas de descalificación (§5)

### 7.2 Requisitos de Implementación

Cuando se activa un fondo de premios:
1. La interfaz de la tabla de clasificación debe mostrar los premios activos y sus condiciones de umbral
2. Las fichas de ejecución que alcancen los umbrales automatizados (condiciones 2–3) deben marcarse para revisión comunitaria
3. No se utiliza ningún nivel de calidad: el campo `quality_tier` es nulo en cada nueva ficha de ejecución (scoring standard/1)
4. La capa de **términos** del premio ya se incluye (`contest_prize_terms` —declaración, hash, aceptación y el control de pago), y la evaluación en sí permanece sin cambios. Lo que añade un nuevo fondo de premios es la política de umbrales del §2 y la visualización en la tabla de clasificación descrita en los puntos 1 y 2 anteriores

---

*La estructura de un premio debe ser compatible con los términos de premio que declara el mismo concurso (§1.3). Dichos términos son elección del anfitrión en cada dimensión —desde "evalúelo, elimínelo, todos los derechos quedan en manos del participante" hasta "usted lo entrega, nosotros lo evaluamos y lo conservamos sin importar el resultado"— y se publican, procesan por hash y aceptan antes de que nadie participe. Un anfitrión comunitario que desee que un método ganador pase a ser propiedad de la comunidad puede declarar exactamente eso, y el premio financiará entonces la creación de tecnología que pertenezca a la comunidad lingüística. Nada de lo aquí expuesto asume eso en nombre de ningún anfitrión.*
