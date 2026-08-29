---
sidebar_position: 1
title: "Reglas de envío"
related:
  - label: "Scoring Specification"
    to: /docs/network/specifications/scoring
    kind: spec
    note: "How the composite score is computed"
  - label: "Statistical Significance Testing"
    to: /docs/network/specifications/significance
    kind: spec
  - label: "Evaluation Datasets"
    to: /docs/network/leaderboard/datasets
    kind: doc
  - label: "Live Leaderboard"
    to: https://champollion.dev/leaderboard
    kind: leaderboard
    note: "The rules, applied"
---

# Evaluación de MT

> **Resumen ejecutivo.** Esta página define los criterios de envío al ranking, las métricas de puntuación (chrF++, aceptación FST, coincidencia exacta, coincidencia equivalente, puntuación semántica), políticas anti-manipulación, niveles de verificación y el flujo de envío. Los métodos que han sido expuestos a datos de evaluación serán descalificados.

champollion incluye un marco de evaluación de traducción automática diseñado para **benchmarking reproducible** de métodos de traducción — especialmente para idiomas de bajo recurso e indígenas donde los benchmarks estándar de MT no existen y las afirmaciones de calidad son difíciles de verificar.

---

## El Ranking

La pieza central es la **[Tabla de clasificación de métodos](https://champollion.dev/leaderboard)** — un marcador público, en vivo y **abierto para envíos**, donde los investigadores y miembros de la comunidad envían y comparan métodos de traducción con una evaluación reproducible y con huella digital.

Cada envío incluye:

- **Pipeline con huella digital** — vinculado a un commit de Git específico y a un hash de configuración, de modo que los resultados se remontan al código exacto que los produjo
- **Conjunto de datos versionado** — con hash de contenido y versionado; las puntuaciones solo son comparables dentro de la misma versión del conjunto de datos
- **Métricas estandarizadas** — todas las puntuaciones son calculadas por el entorno de evaluación compartido, eliminando las diferencias de implementación
- **Niveles de confianza** — autoevaluado, Champollion Verified o Validado por la comunidad
- **Seguimiento de costos** — costo de API por envío, para que las compensaciones entre costo y calidad sean transparentes

El ranking califica cinco métricas. Tres funcionan para cualquier idioma; dos están disponibles para Plains Cree y se generalizarán a medida que expandamos:

| Métrica | Tipo | Qué mide |
|---------|------|----------|
| **chrF++** | F-score de n-gramas de caracteres | Métrica de calidad principal — correlaciona bien con el juicio humano, especialmente para idiomas morfológicamente ricos |
| **Coincidencia Exacta** | Proporción de coincidencias perfectas | Precisión estricta — ¿con qué frecuencia la traducción es exactamente el estándar de oro? |
| **Aceptación FST** | Tasa de paso de puerta morfológica | Para métodos con verificación de transductor de estados finitos — ¿qué proporción de salidas son morfológicamente válidas? |
| **Coincidencia Equivalente** | Tasa de variante aceptable | Fracción que coincide con la referencia o una variante aceptable (orden de palabras, convención ortográfica). Actualmente CRK; generalizando. |
| **Puntuación Semántica** | Fidelidad semántica | Preservación de significado — ¿la traducción captura el significado previsto independientemente de la forma superficial? Actualmente CRK; generalizando. |

:::info[Suite Completa de Métricas]
La [Especificación de Puntuación](/docs/network/specifications/scoring) define el inventario completo de métricas (seis categorías: superficie, estructural, semántica, conductual, cumplimiento y comparadores reportados), la fórmula de puntuación compuesta, tablas de ponderación y umbrales de nivel de calidad.
:::

**[→ Ver el ranking](https://champollion.dev/leaderboard)**

---

## Datasets Disponibles

### Conjunto de Desarrollo EDTeKLA v1

El primer dataset de evaluación, construido para traducción de inglés a Plains Cree (SRO). Creado por el [grupo de investigación EdTeKLA](https://spaces.facsci.ualberta.ca/edtekla/) de la Universidad de Alberta.

| Propiedad | Valor |
|----------|-------|
| **ID** | `edtekla-dev-v1` |
| **Par de idiomas** | EN → CRK (Plains Cree, ortografía SRO) |
| **Cantidad de entradas** | División de desarrollo de 436 entradas (`textbook_dev.json`); el desglose completo se indica una vez en la [página de Conjuntos de datos de evaluación](/docs/network/leaderboard/datasets#edtekla-development-set-v1) |
| **Licencia** | [CC BY-NC-SA modificada de EdTeKLA](https://github.com/EdTeKLA/IndigenousLanguages_Corpora) (`LicenseRef-EdTeKLA-Modified-CC-BY-NC-SA-4.0`, con alcance de soberanía) — no comercial; excluida de la tabla de clasificación, los premios y las vías comerciales/de API |
| **Procedencia** | `gold_standard` (verificado por hablantes), `textbook` (materiales educativos publicados) |

### FLORES+ Devtest — Solo para Desarrollo

> [!WARNING]
> **FLORES+ está disponible para desarrollo y depuración pero NO se utiliza para evaluación oficial del ranking.** FLORES+ (originalmente Meta FLORES-200) es un dataset de benchmark ampliamente público que casi con certeza los LLM fronterizos han sido entrenados con él. Las puntuaciones contra FLORES+ no reflejan de manera confiable la calidad de traducción en el mundo real para métodos basados en LLM. Los métodos no-LLM (FST, basados en reglas, NMT ajustado) se ven menos afectados pero las puntuaciones de FLORES+ aún no se publican en el ranking.

Los fixtures de FLORES+ permanecen disponibles en `test/benchmark/fixtures/` para pruebas de humo del pipeline, validación entre idiomas y uso en desarrollo. La evaluación oficial utiliza corpus personalizados construidos a partir de texto escrito por humanos no disponible públicamente en forma paralela.

Consulte [Datasets de Evaluación](/docs/network/leaderboard/datasets) para el esquema completo del dataset, niveles de dificultad y cómo crear el suyo.

:::danger[NO ENTRENE con datos de evaluación]

**Estos datasets son solo para evaluación.** Los métodos entrenados, ajustados, con prompts de pocos ejemplos, o de otra manera expuestos a datos de evaluación producirán puntuaciones artificialmente infladas y serán **descalificados del ranking.**

Esto no es una sugerencia — es la regla más importante de la integridad de la evaluación. Utilice corpus separados para entrenamiento. Los conjuntos de evaluación deben permanecer invisibles para su modelo durante el desarrollo.

Si está utilizando datos de coaching o ejemplos de pocos disparos, estos deben provenir de **fuentes completamente separadas**. Si tiene dudas, no los incluya.
:::

:::warning[No determinismo de LLM]

Las salidas de LLM no son deterministas. Las puntuaciones representan mediciones en un momento específico bajo versiones de modelo específicas y configuraciones de API. Los proveedores de modelos pueden actualizar pesos, estrategias de decodificación o filtros de seguridad en cualquier momento, lo que puede causar desviación de puntuación entre ejecuciones. El ranking registra el slug exacto del modelo y la marca de tiempo para cada envío.
:::

---

## Qué Hace un Buen Método

No todos los métodos son iguales. Aquí está lo que separa el trabajo riguroso de las puntuaciones infladas.

### Características de un método sólido

- **Separación limpia de datos de entrenamiento y evaluación** — su método nunca ha visto el conjunto de evaluación durante el desarrollo, ajuste, ingeniería de prompts o selección de ejemplos de pocos disparos
- **Reproducible** — alguien más puede clonar su repositorio, ejecutar el arnés y obtener las mismas puntuaciones (dentro de los límites de no determinismo de LLM)
- **Documentado** — su [tarjeta de método](/docs/network/specifications/methods) describe qué hace su método, qué herramientas utiliza y cuáles son sus limitaciones
- **Honesto sobre el alcance** — si su método solo funciona para un par de idiomas, dígalo; si se degrada en ciertos patrones morfológicos, documente eso
- **Consciente de la comunidad** — para idiomas indígenas, su método respeta la soberanía de datos. Ha consultado con comunidades de idiomas o utilizado solo datos con licencia abierta

### Señales de alerta (qué se descalifica)

| Señal de Alerta | Por Qué Es un Problema |
|-----------------|------------------------|
| Entrenamiento con datos de evaluación | Anula completamente el propósito de la evaluación. Las puntuaciones infladas engañan a todos. |
| Selección de resultados | Ejecutar 10 veces y enviar la mejor ejecución sin divulgar las otras |
| Post-procesamiento no divulgado | Corregir manualmente las salidas antes de la puntuación |
| Datos de coaching contaminados | Usar ejemplos del conjunto de evaluación como prompts de pocos disparos o entradas de diccionario |
| Afirmar preparación comercial sin procedencia | Si su método utiliza datos CC BY-NC-SA, no está listo comercialmente |

### Niveles de verificación

Los niveles de verificación describen **quién validó el resultado** — separado de los niveles de calidad (Baseline → Fluent) definidos en la [Especificación de Puntuación, §5](/docs/network/specifications/scoring#5-quality-tiers), que describen qué significa la puntuación compuesta automatizada.

| Nivel | Significado | Cómo obtenerlo |
|------|---------|--------------|
| **Autoevaluado** | Usted mismo ejecutó el entorno y envió los resultados | Publique su tarjeta de ejecución con `mt-eval publish` |
| **Champollion Verified** | El servidor volvió a puntuar de forma independiente sus resultados enviados frente al corpus de referencia fijado por SHA y reprodujo su puntuación | Automático — cada envío se vuelve a puntuar (ver a continuación) |
| **Validado por la comunidad** | Hablantes bilingües del idioma de destino, calificados bajo el propio protocolo de la comunidad, revisaron una muestra estratificada de los resultados (≥30 entradas, ≥2 revisores) y ≥70% cumplió con el estándar de la comunidad. Conferido únicamente por las propias pruebas de la comunidad; la degradación por auditoría aleatoria es simétrica | Envíe el código del método a la organización de gobernanza — ellos lo ejecutan frente al conjunto de referencia (gold-standard) y someten los resultados a la revisión de la comunidad |

### Cómo escala la verificación: auditoría ponderada por reputación

**No afirmamos la procedencia.** Una fila de la tabla de clasificación es producida por un colaborador
que ejecuta el entorno de *código abierto* en su *propia* computadora. "Esta ejecución realmente provino
del entorno" no es algo que un servidor pueda verificar para el cómputo
autoalojado — la clave de firma del entorno está en manos del colaborador, por lo que una
firma autentica una *máquina, no la honestidad*. En lugar de fingir
lo contrario, **la validez aquí se gana y se autocorrige**: una fila es confiable
porque su puntuación es **reproducible** y porque el colaborador detrás de ella ha
**puesto en juego una reputación que una falsificación descubierta destruiría.** La verificación se
ejecuta en cuatro capas, por lo que es exhaustiva donde debe serlo y económica donde puede serlo
— el proyecto nunca tiene que volver a ejecutar el trabajo de todos.

- **L0 — volver a puntuar todo (gratuito, 100%).** El servidor vuelve a derivar su puntuación
  a partir de *sus propios resultados enviados* frente al **corpus de referencia fijado por SHA**
  (no su copia almacenada del mismo), con la misma métrica que utiliza el entorno. Si la
  puntuación no se reproduce a partir de los resultados, o si se alteró una referencia almacenada,
  la ejecución es **descalificada** — esto por sí solo elimina una puntuación ingresada manualmente o editada. Una
  ejecución que se reproduce es promovida a **Champollion Verified**, el único nivel que
  clasifica la tabla. Esto se ejecuta en cada envío y toma milisegundos.
- **L1 — una escala de reputación de colaboradores.** Cada colaborador (identificado por su
  inicio de sesión) gana reputación *solo* al sobrevivir a las comprobaciones más profundas a continuación — nunca
  solo por volumen, por lo que crear nuevas identidades no sirve de nada. La reputación es
  **pública**, y decide con qué frecuencia se activa la comprobación costosa.
- **L2 — volver a ejecutar una *muestra* (la comprobación costosa).** Para un conjunto de
  desarrollo *público*, L0 no puede atrapar a un colaborador que simplemente copia la referencia como su
  "traducción". Atrapar eso requiere volver a ejecutar realmente el modelo — cómputo real —
  por lo que lo hacemos en una **muestra**, no en todos. Una ejecución es muestreada para una
  reejecución L2 con una probabilidad que aumenta con **lo que está en juego** (una ejecución que crea el
  primer puente hacia toda una familia de idiomas *siempre* se vuelve a ejecutar), aumenta con
  la **anomalía** (un salto demasiado bueno para ser verdad sobre el mejor anterior *siempre*
  se vuelve a ejecutar), y disminuye con la **reputación** (un colaborador que ha pasado muchas
  auditorías es revisado aleatoriamente rara vez; un recién llegado o un remitente anónimo es revisado en
  cada ejecución hasta que se haya ganado la confianza). Pasar una auditoría L2 aumenta la reputación.
- **L3 — corroboración (verificación gratuita).** Cuando dos colaboradores *independientes*
  ejecutan el mismo modelo en el mismo corpus y sus resultados vueltos a puntuar **coinciden**,
  ese acuerdo *es* la verificación — y aumenta la reputación de ambos. Un
  **desacuerdo** genuino marca ambas ejecuciones para una auditoría L2. La replicación es
  recompensada en lugar de ser tratada como redundante.

**Una falsificación descubierta es catastrófica — como una retractación.** Una falsificación
probada reduce a cero la reputación del colaborador, **vuelve a auditar todo su
historial verificado** (cada una de sus ejecuciones verificadas se envía de vuelta a través de
la verificación), y se registra **públicamente** en el registro de auditoría. Eso es lo que hace
que el muestreo ligero sea seguro: hacer trampa en un conjunto de desarrollo público podría pasar desapercibido en una ejecución, pero
el costo esperado — perder toda la confianza ganada y que todo su registro sea
sometido a un nuevo escrutinio — lo convierte en una mala apuesta. Estas reglas se aplican simétricamente
a las propias ejecuciones de los mantenedores.

**Por qué sigue valiendo la pena contribuir.** Usted siempre paga la parte costosa
(ejecutar su método); el proyecto paga solo la repuntuación L0 gratuita para todos
más una reejecución L2 en una *muestra decreciente* — alta para los recién llegados y las ejecuciones
de alto riesgo, baja para los colaboradores probados. El costo de verificación se *amortiza por la reputación
y se comparte por la corroboración*, no se vuelve a pagar en su totalidad cada vez.

---

## Cómo Enviar

1. **Construya su método** — consulte [Construcción de un método](/docs/network/specifications/methods) para conocer la interfaz del método
2. **Ejecute el entorno** — consulte [Entorno de evaluación](/docs/network/specifications/harness) para la configuración y el uso
3. **Genere una tarjeta de ejecución** — el entorno produce una tarjeta de ejecución en JSON con sus puntuaciones, huella digital y metadatos
4. **Publique** — `mt-eval publish eval/logs/harness/<your-run-card>.json` sube la tarjeta de ejecución a la tabla de clasificación
5. **Aparezca en la tabla de clasificación** — su ejecución se presenta como *autoevaluada (no verificada)*, luego el servidor vuelve a puntuar automáticamente sus resultados frente al corpus fijado por SHA (L0); cuando se reproduce, la ejecución se promueve a *Champollion Verified* — el único nivel que clasifica la [Tabla de clasificación de métodos](https://champollion.dev/leaderboard). La auditoría más profunda ponderada por reputación sigue los niveles de confianza anteriores

---

## Política de integridad: Retractaciones, Reejecuciones, Retiradas de la lista, Disputas

Escritas por adelantado para que su aplicación sea un procedimiento, no un drama. Estas reglas
se aplican a todos de manera simétrica — incluyendo las propias ejecuciones de los mantenedores.

**Sin retractaciones.** Una ejecución publicada es un registro permanente. No existe
ningún mecanismo — para nadie — para eliminar una puntuación porque sea vergonzosa.
Cada fila de ejecución lleva una marca de tiempo `submitted_at` sellada por el servidor y un
rastro de auditoría inmutable; las propias acciones de moderación quedan registradas.

**Las reejecuciones se añaden, nunca reemplazan.** Si mejora su método, publique una nueva
ejecución. La ejecución antigua permanece. La divulgación selectiva — probar en privado muchas
variantes y publicar solo la ganadora — es lo que hizo que otras tablas de clasificación
fueran manipulables; un registro de solo adición es la respuesta estructural. La deduplicación
de huellas digitales detiene el spam de reenvíos idénticos a nivel de bytes; nunca reescribe
la historia.

**La retirada de la lista es la ejecución de una regla, con la regla nombrada.** Una ejecución se retira de la lista
(marcada como `disqualified`, de forma visible — no eliminada silenciosamente) solo por las causas
enumeradas: un conjunto de datos en cuarentena o un subconjunto inadecuado (aplicado por un disparador
de base de datos debajo de cada cliente), discrepancia en la suma de comprobación del corpus, puntuaciones falsificadas o
fuera de rango, violaciones de la protección de contenido, o la retirada del registro de los datos
subyacentes por parte de un custodio. La retirada de la lista nombra la regla y la
evidencia. Las nuevas causas se agregan aquí mediante una edición fechada antes de que se
apliquen, nunca se inventan retroactivamente para un caso.

**Los niveles de confianza son etiquetas, no ediciones.** Las filas `self-benchmarked` son afirmaciones;
las filas `Champollion Verified` han sido vueltas a puntuar de forma independiente a partir de los
resultados del remitente frente al corpus fijado por SHA; `Community Validated` se
confiere únicamente por las propias pruebas de la comunidad. La verificación cambia el nivel
de una fila — nunca cambia las puntuaciones de la fila.

**La reputación es pública y se autocorrige.** La reputación del colaborador, y el
registro de auditoría que documenta cada repuntuación, reejecución muestreada, corroboración y
pérdida de reputación por falsificación, son públicos. La reputación no es un multiplicador de puntuación y nunca
toca los números de una ejecución — solo establece con qué frecuencia las ejecuciones de un colaborador son
vueltas a auditar (consulte *auditoría ponderada por reputación* arriba). Una falsificación probada se
registra tan públicamente como una retractación y vuelve a auditar todo el historial verificado
del colaborador; las mismas reglas se aplican a las propias ejecuciones de los mantenedores.

**Disputas.** Abra una incidencia con el ID de la ejecución y el reclamo específico (puntuación
incorrecta, conjunto de datos incorrecto, regla mal aplicada). Los mantenedores vuelven a ejecutar las
comprobaciones deterministas en público; el resultado y su evidencia se publican en la
incidencia. Si la disputa es sobre los datos o la validación de una comunidad, la
propia autoridad de la comunidad decide y la tabla implementa su decisión.
Para los concursos con premios, se aplican las mismas reglas más los pasos de auditoría y
clasificación prepublicados del concurso — los ganadores son auditados **antes** del pago, y una
descalificación cita la regla exactamente igual que cualquier otra retirada de la lista.

## Direcciones Futuras

- **Ejecuciones de comparación de modelos integral** — evaluación sistemática de modelos fronterizos (GPT-4o, Claude, Gemini, etc.) en idiomas de champollion utilizando corpus de evaluación personalizados (no benchmarks públicos)
- **Más pares de idiomas** — Quechua, Inuktitut y otros idiomas de bajo recurso a medida que datasets verificados por la comunidad estén disponibles
- **Importación de datasets** — herramientas para convertir datasets de evaluación externos (WMT, Tatoeba, etc.) al formato de evaluación de champollion
- **Re-ejecuciones automatizadas** — detectar cambios de versión de modelo y re-ejecutar benchmarks para rastrear desviación de puntuación

---

## Consulte también

- **[Ranking de Métodos](https://champollion.dev/leaderboard)** — puntuaciones en vivo y envíos
- **[Arnés de Evaluación](/docs/network/specifications/harness)** — cómo ejecutar evaluaciones
- **[Datasets de Evaluación](/docs/network/leaderboard/datasets)** — formato de dataset y datasets disponibles
- **[Construir un Método](/docs/network/specifications/methods)** — especificación de interfaz del método
- **[Especificación de Tarjeta de Ejecución](/docs/network/specifications/run-card)** — esquema JSON de tarjeta de ejecución
- **[Especificación de Benchmark](/docs/network/specifications/benchmark)** — protocolo de evaluación, formato de corpus, soberanía
- **[Especificación de Puntuación](/docs/network/specifications/scoring)** — SSOT para métricas, pesos compuestos y niveles de calidad
