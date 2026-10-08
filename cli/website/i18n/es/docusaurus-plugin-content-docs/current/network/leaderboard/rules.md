---
sidebar_position: 1
title: "Reglas de envío"
related:
  - label: "Scoring Specification"
    to: /docs/network/specifications/scoring
    kind: spec
    note: "How runs are scored: chrF++ with its CI and signature"
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

> **Resumen ejecutivo.** Esta página define los criterios de envío a la tabla de clasificación, el cálculo de puntuaciones (con chrF++ como métrica principal, acompañada de las métricas estándar y diagnósticos), las políticas contra la manipulación, los niveles de verificación y el flujo de trabajo para envíos. Los métodos que hayan estado expuestos a datos de evaluación quedan descalificados.

champollion incluye un marco de evaluación de traducción automática diseñado para **benchmarking reproducible** de métodos de traducción — especialmente para idiomas de bajo recurso e indígenas donde los benchmarks estándar de MT no existen y las afirmaciones de calidad son difíciles de verificar.

---

## El Ranking

La pieza central es la **[Tabla de clasificación de métodos](https://champollion.dev/leaderboard)**: un tablero de puntuaciones público, en vivo y **abierto para envíos**, donde investigadores y miembros de la comunidad envían y comparan métodos de traducción mediante evaluaciones reproducibles y con huella digital.

Cada envío incluye:

- **Canalización con huella digital** — vinculada a un commit de Git y un hash de configuración específicos, de modo que los resultados se remontan al código exacto que los generó
- **Conjunto de datos versionado** — con hash de contenido y control de versiones; las puntuaciones solo son comparables dentro de la misma versión del conjunto de datos
- **Métricas estandarizadas** — toda la puntuación la calcula el entorno de evaluación compartido, eliminando diferencias de implementación
- **Niveles de confianza** — Self-benchmarked, Champollion Verified o Community Validated
- **Seguimiento de costos** — costo de API por envío, de modo que el balance entre costo y calidad sea transparente

La tabla de clasificación clasifica las ejecuciones de la forma en que WMT, FLORES-200 y las tareas compartidas de AmericasNLP reportan la evaluación de TA: mediante **una métrica estándar, chrF++**, mostrada con su intervalo de confianza del 95 % y su firma de sacreBLEU —por ejemplo `chrF++ 47.5 [45.9, 49.0]`. Todo lo demás se muestra junto a ella, nunca mezclado con ella:

| Métrica | Rol | Qué mide |
|---------|-----|----------|
| **chrF++** | **Métrica principal y de clasificación** | Puntuación F de n-gramas de caracteres contra la referencia (sacreBLEU, `word_order=2`). Maneja morfologías complejas mejor que las métricas a nivel de palabra |
| **BLEU, spBLEU, TER, COMET** | Métricas estándar, junto a la métrica principal | Las otras métricas que reportan los artículos de TA; COMET cuando fue calculada, con su ID de modelo |
| **Exact Match** | Diagnóstico | Con qué frecuencia la traducción coincide exactamente con la referencia |
| **FST Acceptance** | Diagnóstico | Para idiomas con un transductor de estados finitos: qué proporción de palabras de salida son formas válidas. No se compara con la fuente ni con la referencia, por lo que nunca constituye una puntuación |
| **Equivalent Match** | Diagnóstico | Fracción que coincide con la referencia o con una variante aceptable (orden de palabras, convención ortográfica). Actualmente CRK; en proceso de generalización. |
| **Semantic Score** | Diagnóstico | Preservación del significado, mediante un validador determinista. Actualmente CRK; en proceso de generalización. |
| **Advertencias de puntuación** | Se muestran junto a la métrica principal | Cuando las salidas copian su fuente, son mucho más cortas o más largas que las referencias, repiten una misma salida para muchas entradas, o las filas de prueba tienen gemelos en los datos de entrenamiento |

Que una ejecución sea mejor que otra se decide mediante una prueba de significancia emparejada sobre chrF++, no por el orden de dos números; los intervalos superpuestos son una advertencia de que el orden podría ser ruido ([Pruebas de significancia estadística](/docs/network/specifications/significance)); las clasificaciones en concursos utilizan la prueba para formar grupos de clasificación. chrF++ solo clasifica sistemas en el mismo conjunto de datos, nunca entre diferentes idiomas. Ninguna puntuación automática lleva una etiqueta de calidad: solo la revisión humana por parte de hablantes certifica la calidad. El valor compuesto ponderado y los niveles de calidad utilizados anteriormente están retirados; el valor compuesto de una tarjeta antigua se muestra, si acaso, como "legacy composite (retired)".

:::info[Conjunto completo de métricas]
La [Especificación de puntuación](/docs/network/specifications/scoring#how-runs-are-scored) define cómo se puntúan las ejecuciones y el inventario completo de métricas (seis categorías: superficial, estructural, semántica, conductual, de cumplimiento y comparadores reportados).
:::

**[→ Ver el ranking](https://champollion.dev/leaderboard)**

---

## Datasets Disponibles

Las herramientas enumeran los aspectos sobre los que se puede puntuar una ejecución, por lo que esta página no mantiene una lista propia:

```bash
# the runnable corpora for a pair: size, contamination, domain, licence, provider
mt-eval corpora --source eng --target crk

# …and the catalogued ones that can never run, each with its reason
mt-eval corpora --source eng --target crk --include-quarantined
```

La página de [Conjuntos de datos de evaluación](/docs/network/leaderboard/datasets) describe
el catálogo, el formato del corpus, los niveles de dificultad, las vías de licenciamiento
y cómo crear el suyo propio. Tres reglas de ese catálogo deciden qué puede
clasificarse:

- **Un corpus en cuarentena nunca se clasifica.** Está catalogado pero nunca es ejecutable,
  y la base de datos rechaza cualquier puntuación publicada contra él. Los corpus de
  inglés→cree de las llanuras de EdTeKLA (`eval-eng-crk-edtekla-dev-v1` y
  `eval-eng-crk-edtekla-textbook`) están en cuarentena. Cuentan con una licencia CC BY-NC-SA
  modificada y enfocada en la soberanía (`LicenseRef-EdTeKLA-Modified-CC-BY-NC-SA-4.0`) y están excluidos de toda
  tabla de clasificación, premio y vía comercial.
- **Un corpus contaminado se clasifica solo de forma relativa.** FLORES+, y cualquier corpus
  calificado como `HIGH` o `MEDIUM` por contaminación o que no esté calificado en absoluto,
  lleva el sello de solo-comparación-relativa en su tarjeta de ejecución. Compara métodos ejecutados
  en ese corpus y nunca se reporta como calidad absoluta. Solo un corpus
  calificado como `LOW` se clasifica según su calidad absoluta.
- **Las vías de licencia se respetan.** Un corpus no comercial se mantiene fuera de las vías comerciales y
  de premios. Un corpus bajo una concesión modificada, personalizada o no especificada rechaza
  la evaluación remota mediante API de modelos hasta que el permiso del titular de los derechos
  quede registrado en su entrada.

**Los concursos se ejecutan en conjuntos sellados que custodia el anfitrión.** Un concurso no se puntúa en
ninguno de estos corpus públicos. El anfitrión, ya sea una comunidad o una organización, mantiene
un conjunto de prueba sellado y reservado en su propia infraestructura. Los participantes clasifican en
el conjunto de desarrollo público que publica el anfitrión, y luego entregan al nodo del anfitrión un modelo o un
método para ejecutar. Los custodios del anfitrión autorizan cada ejecución, y solo se obtienen
puntuaciones. Consulte [Organizar un concurso soberano](/docs/network/sovereignty/run-a-sovereign-contest).

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

Los niveles de verificación describen **quién validó el resultado**. No son etiquetas de calidad (los antiguos niveles automáticos de calidad están [retirados](/docs/network/specifications/scoring#5-quality-tiers)).

| Nivel | Significado | Cómo obtenerlo |
|-------|-------------|----------------|
| **Self-benchmarked** | Usted mismo ejecutó el entorno y envió los resultados | Publique su tarjeta de ejecución con `mt-eval publish` |
| **Champollion Verified** | El proyecto volvió a puntuar de forma independiente las salidas que envió contra el corpus de referencia fijado por hash SHA y reprodujo su puntuación | La herramienta de repuntuación es una herramienta de los mantenedores, ejecutada manualmente por lotes. Nada la programa, por lo que ningún envío se repuntúa al llegar (consulte más abajo) |
| **Community Validated** | Hablantes bilingües del idioma de destino, calificados bajo el protocolo propio de la comunidad, revisaron una muestra estratificada de la salida (≥30 entradas, ≥2 revisores) y ≥70 % cumplió con los estándares de la comunidad. Se confiere únicamente mediante las pruebas propias de la comunidad; la degradación por auditorías aleatorias es simétrica | Envíe el código del método a la organización de gobernanza; ellos lo ejecutarán contra el conjunto de referencia estándar (gold standard) y someterán la salida a revisión comunitaria |

**El juicio validado por la comunidad es una vía separada, y aún no existen puntuaciones de evaluación humana:** el entorno puede seleccionar qué sistemas cubriría un presupuesto fijo de revisión humana a partir de la clasificación congelada de un concurso cerrado (solo grupos completos de empate; un clúster nunca se divide por la mitad), pero no registra calificaciones, y actualmente nada en la tabla de clasificación lleva un juicio humano.

**Los puestos de clasificación son clústeres, no un orden estricto.** Las entradas contiguas que la prueba de significancia no puede separar comparten un puesto y llevan un *rango* de clasificación; en un concurso sellado, donde las salidas por segmento nunca salen de la máquina del organizador, la prueba emparejada se ejecuta en esa máquina y solo salen sus veredictos firmados; sin ellos, los empates se basan en evidencia de intervalos de confianza o de igualdad puntual. La forma en que esto funciona, y lo débil que es cada peldaño de la escala de evidencia, se detalla en [Pruebas de significancia estadística → Clústeres de clasificación](/docs/network/specifications/significance#ranking-clusters).

### Cómo escala la verificación: auditoría ponderada por reputación

**No garantizamos procedencia.** Una fila de la tabla de clasificación la produce un colaborador
que ejecuta el entorno de *código abierto* en su *propia* máquina. "Esta ejecución realmente provino
del entorno" no es algo que un servidor pueda verificar para recursos de cómputo autoalojados;
la clave de firma del entorno está en manos del colaborador, por lo que una
firma autentica una *máquina, no la honestidad*. En lugar de fingir
lo contrario, **aquí la validez se gana y se autocorrige**: una fila es confiable
porque su puntuación es **reproducible** y porque el colaborador detrás de ella ha
**arriesgado una reputación que cualquier falsificación detectada destruiría.** La verificación se
ejecuta en cuatro capas, por lo que es exhaustiva donde debe serlo y económica donde puede serlo;
el proyecto nunca tiene que volver a ejecutar el trabajo de todos.

- **L0 — repuntuar todo (gratuito, ~100 %).** La herramienta de repuntuación vuelve a calcular su
  puntuación a partir de *sus propias salidas enviadas* contra el **corpus de referencia fijado
  por hash SHA** (no su copia almacenada de este), con la misma métrica que utiliza el entorno.
  Si la puntuación no se reproduce a partir de las salidas, o si se alteró una referencia almacenada, la ejecución queda
  **descalificada**; esto por sí solo descarta cualquier puntuación escrita a mano o editada. Una ejecución que se reproduce es promovida a
  **Champollion Verified**, el nivel que la clasificación de un concurso utiliza de forma predeterminada y el único nivel elegible para un
  premio. Está desarrollado y es de bajo costo, pero es un **comando de los mantenedores que se ejecuta manualmente**:
  nada lo ejecuta al momento del envío y nada lo programa. Hasta que eso cambie, cada fila llega —y permanece—
  como self-benchmarked.
- **L1 — una escala de reputación de colaboradores.** Cada colaborador (identificado por su
  inicio de sesión) gana reputación *únicamente* superando las comprobaciones más profundas que se describen a continuación,
  nunca solo por volumen, por lo que crear identidades nuevas no aporta nada. La reputación es
  **pública** y decide con qué frecuencia se activa la comprobación costosa.
- **L2 — reejecutar una *muestra* (la comprobación costosa; solo política, aún sin ejecutor de repetición).**
  Para un conjunto de desarrollo *público*, L0 no puede detectar a un colaborador que
  simplemente copie la referencia como su "traducción". Detectar eso requiere
  volver a ejecutar el modelo en la práctica (cómputo real), por lo que lo haríamos sobre una
  **muestra**, no sobre todos. La **política de muestreo** está desarrollada y probada: una
  ejecución se selecciona con una probabilidad que aumenta con la **relevancia** (una ejecución que
  tiende el primer puente hacia toda una familia lingüística *siempre* se selecciona),
  aumenta con la **anomalía** (un salto demasiado bueno para ser real respecto al mejor anterior
  *siempre* se selecciona) y disminuye con la **reputación** (un colaborador que ha
  superado muchas auditorías se somete a auditorías aleatorias rara vez; un recién llegado o remitente anónimo
  se comprueba en cada ejecución hasta que se haya ganado la confianza). Superar una auditoría L2
  aumenta la reputación. **El ejecutor de repetición que impulsaría esa política no existe**,
  por lo que nunca se ha activado una auditoría L2: una ejecución seleccionada se registra como *L2-pending*.
- **L3 — corroboración (verificación gratuita).** Cuando dos colaboradores *independientes*
  ejecutan el mismo modelo en el mismo corpus y sus salidas repuntuadas **coinciden**,
  esa coincidencia *es* la verificación, y aumenta la reputación de ambos. Una
  **discrepancia** genuina marca ambas ejecuciones para una auditoría L2. La replicación se
  recompensa en lugar de tratarse como redundante.

**Una falsificación descubierta es catastrófica: como una retractación.** Una
falsificación demostrada restablece a cero la reputación del colaborador, **vuelve a auditar todo su
historial verificado** (cada una de sus ejecuciones verificadas se envía de nuevo a
verificación) y se registra **públicamente** en el registro de auditoría. Eso es lo que hace que
un muestreo ligero sea seguro: engañar en un conjunto de desarrollo público podría pasar inadvertido en una ejecución, pero
el costo esperado —perder toda la confianza ganada y someter todo su historial a un nuevo
escrutinio— hace que sea una mala apuesta. Estas reglas vinculan las propias ejecuciones de los mantenedores
de forma simétrica.

**Por qué sigue valiendo la pena contribuir.** Usted siempre asume la parte costosa
(ejecutar su método); el proyecto solo asume la repuntuación L0 gratuita para todos
más una reejecución L2 sobre una *muestra decreciente* —alta para recién llegados y ejecuciones
de gran relevancia, baja para colaboradores consolidados. El costo de verificación se *amortiza mediante la reputación
y se comparte mediante la corroboración*, en lugar de pagarse por completo cada vez.

---

## Cómo Enviar

1. **Cree su método** — consulte [Creación de un método](/docs/network/specifications/methods) para conocer la interfaz del método
2. **Ejecute el entorno** — consulte [Entorno de evaluación](/docs/network/specifications/harness) para la configuración y el uso
3. **Genere una tarjeta de ejecución** — el entorno genera una tarjeta de ejecución en JSON con sus puntuaciones, huella digital y metadatos
4. **Publique** — `mt-eval publish eval/logs/harness/<run-id>_report.json --prod` sube la tarjeta de ejecución a la tabla de clasificación (obtenga una vista previa con `--dry-run`)
5. **Aparezca en la tabla de clasificación** — su ejecución aparece listada como *self-benchmarked (unverified)*. La [Tabla de clasificación de métodos](https://champollion.dev/leaderboard) lista y clasifica cada fila que no sea `disqualified`, incluidas las autoevaluadas (self-benchmarked) y etiquetadas como tales; filtre por *Champollion Verified* para ver únicamente los resultados repuntuados. La repuntuación L0 que promueve una ejecución a ese nivel es un lote ejecutado por los mantenedores y nada lo programa, por lo que hoy en día cada fila en la tabla es una afirmación autoreportada. Solo verificado (Verified-only) es el valor predeterminado para la clasificación de un **concurso**, y es el único nivel elegible para un premio

---

## Política de integridad: Retractaciones, reejecuciones, bajas de la lista y disputas

Redactada por adelantado para que su aplicación sea un procedimiento y no un conflicto. Estas reglas
vinculan a todos de forma simétrica, incluidas las propias ejecuciones de los mantenedores.

**Sin retractaciones.** Una ejecución publicada es un registro permanente. No existe
ningún mecanismo —para nadie— para eliminar una puntuación porque resulte vergonzosa.
Cada fila de ejecución lleva una marca de tiempo `submitted_at` estampada por el servidor y un
registro de auditoría inmutable; las acciones de moderación en sí mismas también quedan registradas.

**Las reejecuciones se anexan, nunca reemplazan.** Si mejora su método, publique una nueva
ejecución. La ejecución anterior permanece. La divulgación selectiva —probar en privado muchas
variantes y publicar únicamente la ganadora— es lo que hizo manipulables a otras tablas
de clasificación; un registro de solo anexión es la respuesta estructural. La deduplicación por
huella digital detiene el spam de reenvíos idénticos byte a byte; nunca reescribe
el historial.

**La baja de la lista es la ejecución de una regla, citando la regla correspondiente.** Una ejecución se da de baja
(marcada como `disqualified`, de forma visible, sin eliminarse en silencio) únicamente por causas
enumeradas: un conjunto de datos en cuarentena o que constituya un subconjunto inapropiado (impuesto mediante
un trigger de base de datos por debajo de cada cliente), discrepancia en la suma de verificación del corpus, puntuaciones
fabricadas o fuera de rango, violaciones de los filtros de contenido o el retiro del registro de los datos
subyacentes por parte de un custodio. La baja de la lista nombra la regla y la
evidencia. Las nuevas causas se agregan aquí mediante una edición fechada antes de aplicarse
por primera vez, nunca se inventan de forma retroactiva para un caso particular.

### Marcar un resultado

*Añadido el 2026-09-07.*

:::caution[Aún no se aceptan marcas]

La función de reporte de marcas está desarrollada y la base de datos está lista para recibirla desde el 2026-09-07; sin embargo, el
formulario para enviar una marca no se ha vuelto a desplegar con respecto a ella, por lo que *Flag this
result* aún no puede enviarse. Falla en lugar de aceptar una marca silenciosamente.
Envíe un correo electrónico a `info@champollion.dev` mientras tanto. Este aviso se retirará el día
en que se lance el formulario.

:::

**Cualquiera puede marcar un resultado.** Despliegue su fila en la tabla de clasificación y use *Flag
this result*: abrirá un formulario de mensaje ya vinculado al ID de esa ejecución, donde usted
podrá explicar qué cree que está mal y cómo lo sabe: un corpus contaminado, una
métrica que no coincide con su etiqueta, un método atribuido incorrectamente o cualquier otra cosa. Toda
marca debe incluir un motivo. Una marca sin motivo equivale a un voto negativo, y esta tabla no
admite votos negativos.

**Una marca es un mensaje privado, no un voto.** Llega a los mantenedores como un
ticket y a ningún otro lugar. Nunca se muestra un recuento de marcas —ni en la
fila, ni en la tarjeta de ejecución, ni en ningún otro sitio—, ya que un recuento visible sería en sí mismo
susceptible de manipulación, y la posición de un resultado debe basarse en evidencias y no en
cuántas personas se opusieron. El envío de una marca, por sí solo, no cambia nada en la
fila.

**Una marca aceptada se manifiesta de una única forma:** el resultado se marca como
`disqualified`, por una causa ya enumerada en esta página. Al igual que con cualquier otra
baja de la lista, se agrega aquí una nueva causa **mediante una edición fechada antes de aplicarse a
cualquier persona**, de modo que una marca nunca puede generar una regla secreta ni retroactiva. Si una
marca no es aceptada, la fila permanece sin cambios, y si usted dejó una dirección recibirá
una respuesta en cualquiera de los dos casos.

**Los niveles de confianza son etiquetas, no ediciones.** Las filas `self-benchmarked` son afirmaciones;
las filas `Champollion Verified` han sido repuntuadas de forma independiente a partir de las
salidas del remitente contra el corpus fijado por hash SHA; `Community Validated` se
confiere únicamente mediante las pruebas propias de la comunidad. La verificación cambia el nivel
de una fila; nunca cambia las puntuaciones de la fila.

**La reputación es pública y se autocorrige.** La reputación de los colaboradores y el
registro de auditoría que registra cada repuntuación, reejecución por muestreo, corroboración y
penalización por falsificación son públicos. La reputación no es un multiplicador de puntuación y nunca
altera los números de una ejecución; solo determina con qué frecuencia se vuelven a auditar
las ejecuciones de un colaborador (consulte *auditoría ponderada por reputación* más arriba). Una falsificación demostrada se
registra tan públicamente como una retractación y vuelve a auditar todo el historial verificado
del colaborador; las mismas reglas se aplican a las propias ejecuciones de los mantenedores.

**Disputas.** Abra un issue con el ID de la ejecución y el reclamo específico (puntuación
incorrecta, conjunto de datos erróneo, regla mal aplicada). Los mantenedores vuelven a ejecutar las
comprobaciones deterministas en público; el resultado y su evidencia se publican en el
issue. Si la disputa está relacionada con los datos o la validación de una comunidad,
la propia autoridad de la comunidad decide y la tabla implementa su decisión.
Para los concursos con premios, se aplican las mismas reglas junto con los pasos clasificatorios
y de auditoría previamente publicados del concurso: los ganadores son auditados **antes** del pago, y una
descalificación cita la regla exactamente igual que cualquier otra baja de la lista.

## Direcciones Futuras

- **Ejecuciones de comparación de modelos integral** — evaluación sistemática de modelos fronterizos (GPT-4o, Claude, Gemini, etc.) en idiomas de champollion utilizando corpus de evaluación personalizados (no benchmarks públicos)
- **Más pares de idiomas** — Quechua, Inuktitut y otros idiomas de bajo recurso a medida que datasets verificados por la comunidad estén disponibles
- **Importación de datasets** — herramientas para convertir datasets de evaluación externos (WMT, Tatoeba, etc.) al formato de evaluación de champollion
- **Re-ejecuciones automatizadas** — detectar cambios de versión de modelo y re-ejecutar benchmarks para rastrear desviación de puntuación

---

## Consulte también

- **[Tabla de clasificación de métodos](https://champollion.dev/leaderboard)** — puntuaciones y envíos en vivo
- **[Entorno de evaluación](/docs/network/specifications/harness)** — cómo ejecutar evaluaciones
- **[Conjuntos de datos de evaluación](/docs/network/leaderboard/datasets)** — formato y conjuntos de datos disponibles
- **[Creación de un método](/docs/network/specifications/methods)** — especificación de la interfaz del método
- **[Especificación de la tarjeta de ejecución](/docs/network/specifications/run-card)** — esquema JSON de la tarjeta de ejecución
- **[Especificación de benchmark](/docs/network/specifications/benchmark)** — protocolo de evaluación, formato de corpus, soberanía
- **[Especificación de puntuación](/docs/network/specifications/scoring)** — única fuente de verdad (SSOT) para las métricas y cómo se puntúan las ejecuciones
