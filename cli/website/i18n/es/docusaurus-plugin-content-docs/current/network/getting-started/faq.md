---
sidebar_position: 2
title: "Preguntas frecuentes"
related:
  - label: "How It Works"
    to: /docs/network/how-it-works
    kind: doc
  - label: "What Counts as a Language Here?"
    to: /docs/network/context/what-counts-as-a-language
    kind: doc
  - label: "MT Evaluation Rules"
    to: /docs/network/leaderboard/rules
    kind: doc
  - label: "Glossary"
    to: https://champollion.dev/glossary
    kind: glossary
    note: "Plain-language definitions for every technical term"
---

# Preguntas Frecuentes

> **Resumen Ejecutivo.** Respuestas a preguntas comunes sobre la Red Champollion — cómo funciona la puntuación, qué se descalifica, cómo manejar idiomas sin FST, recomendaciones de modelos y parámetros, y el proceso de envío.

---

## Puntuación y Métricas

### ¿Qué métricas calcula el harness?

La métrica principal, y el único número que clasifica una ejecución, es **corpus chrF++** con su intervalo de confianza del 95%. Junto a ella, el harness reporta las otras métricas estándar — **BLEU, spBLEU y TER**, y **COMET** cuando está instalado —, cada una por separado, nunca combinadas. Todo lo demás es un **diagnóstico**: se reporta por separado para explicar una puntuación, nunca como parte de ella. La siguiente tabla cubre chrF++ y los diagnósticos principales; tres son independientes del idioma y dos dependen actualmente de complementos específicos para CRK y se generalizarán a medida que nos expandamos a más idiomas. Los corpus de referencia ejecutables hoy en día son conjuntos públicos con licencia abierta — Global Voices, Tatoeba, TICO-19, IN22, SMOL y más (consulte [Conjuntos de datos](/docs/network/leaderboard/datasets)) — y la tabla de clasificación está abierta para envíos en todos los pares registrados. El cree de las llanuras es simplemente donde se implementaron por primera vez las dos métricas específicas de idioma (respaldadas por FST).

| Métrica | Escala | Qué mide | Estado |
|---------|--------|----------|--------|
| **chrF++** (métrica principal) | 0–100 | Superposición de n-gramas de caracteres entre las traducciones predichas y las de referencia, calculada sobre todo el corpus con sacreBLEU (su firma queda registrada). La métrica superficial estándar para idiomas morfológicamente ricos. | ✅ Todos los idiomas |
| **Exact match** (diagnóstico) | 0.0–1.0 | Proporción de entradas donde la predicción coincide exactamente con la referencia después de la normalización. | ✅ Todos los idiomas |
| **FST acceptance** (diagnóstico) | 0.0–1.0 | Proporción de palabras de salida aceptadas por un transductor de estados finitos (analizador morfológico). Solo se calcula cuando se proporciona un binario FST. | ✅ Todos los idiomas con FST |
| **Equivalent match** (diagnóstico) | 0.0–1.0 | Fracción de entradas que coinciden con la referencia o una variante aceptable, teniendo en cuenta el orden de las palabras, la convención ortográfica y las diferencias dialectales. | ⚡ CRK (en proceso de generalización) |
| **Semantic score** (diagnóstico) | 0.0–1.0 | Puntuación de preservación del significado: ¿qué tan bien captura la traducción el significado previsto independientemente de la forma superficial? | ⚡ CRK (en proceso de generalización) |

Otros diagnósticos — **precisión morfológica**, **alternancia de código**, **adherencia terminológica**, **alucinación** y **estilo de redacción** — y el estado de implementación de cada métrica se encuentran en [Especificación de puntuación §2](/docs/network/specifications/scoring#2-metric-inventory), el inventario completo de métricas.

### ¿Cómo se puntúa una ejecución?

Cada nueva ejecución se puntúa según el estándar de puntuación `standard/1`, de la manera en que el campo reporta la evaluación de traducción automática (WMT, FLORES-200, AmericasNLP):

- **Métrica principal:** corpus chrF++, indicado con su IC bootstrap del 95% y la firma de sacreBLEU; por ejemplo, `chrF++ 47.5 [45.9, 49.0]`.
- **Junto a ella:** BLEU, spBLEU, TER y COMET cuando se calculan. Nunca combinadas.
- **Diagnósticos:** exact match, FST acceptance, precisión morfológica, alternancia de código, alucinación, terminología, estilo de redacción. Se reportan por separado; nunca clasifican una ejecución.
- Las **advertencias de puntuación** se muestran justo al lado de la métrica principal cuando el harness detecta un patrón que hace que el número sea engañoso.

Si una ejecución es **mejor** que otra se decide mediante una prueba de significancia pareada sobre chrF++ (`mt-eval compare --significance`), no comparando dos números. Reglas completas: [Cómo se puntúan las ejecuciones](/docs/network/specifications/scoring#how-runs-are-scored) y la [Especificación de significancia](/docs/network/specifications/significance).

### ¿Qué pasó con la puntuación compuesta y los niveles de calidad?

Ambos están **retirados** para nuevas ejecuciones. La puntuación compuesta era una combinación ponderada de chrF++, exact match, FST acceptance y otras señales, y los niveles (Baseline → Fluent) eran etiquetas derivadas de ella. Varias de sus entradas nunca comparan la salida con el origen o la referencia, por lo que un sistema podía obtener la mayor parte del puntaje sin traducir: un modelo sin entrenar de inglés a sami septentrional que repetía una oración válida para cada entrada obtuvo una puntuación de 0.6244 —etiquetado como "funcional"— con un chrF++ de 5.5. Las fichas de nuevas ejecuciones publican `composite: null` y `quality_tier: null`.

Las fichas publicadas antes del estándar conservan su puntuación compuesta almacenada y siguen siendo verificables; dondequiera que se muestre una, se etiqueta como **compuesta heredada (retirada)**. Consulte [por qué se retiró la puntuación compuesta](/docs/network/specifications/scoring#why-the-composite-was-retired).

Una puntuación automática no es un veredicto de calidad. Solo la evaluación humana realizada por hablantes del idioma certifica la calidad.

### ¿Qué son los niveles de verificación?

Los **niveles de verificación** describen *quién validó el resultado*, no qué tan bueno es:

| Nivel de verificación | Qué significa |
|-----------------------|---------------|
| **Self-benchmarked** | El remitente ejecutó el harness por su cuenta. Las puntuaciones son plausibles pero no están verificadas. |
| **Champollion Verified** | Un mantenedor reprodujo el resultado utilizando la configuración del método enviado. |
| **Community Validated** | Hablantes bilingües del idioma de destino, calificados según el protocolo propio de la comunidad, revisaron una muestra estratificada de la salida (≥30 entradas, ≥2 revisores) y ≥70% cumplió con el estándar de la comunidad. Otorgado únicamente mediante las pruebas propias de la comunidad; la degradación por auditorías aleatorias es simétrica e igualmente pública. |

Una ejecución puede tener un chrF++ alto y aún así estar clasificada solo como "Self-benchmarked", lo que significa que nadie ha confirmado de forma independiente la puntuación y ningún hablante ha evaluado la salida.

---

## Envío y Descalificación

### ¿Qué descalifica mi envío?

Su envío será rechazado o marcado si:

1. **Su método fue expuesto a datos de evaluación.** Si entrenó, ajustó, indicó con pocos ejemplos, u de otra manera utilizó cualquier entrada del conjunto de datos de evaluación, sus puntuaciones están artificialmente infladas. Esto incluye usar las traducciones de referencia en su indicación.
2. **Su tarjeta de ejecución falla las verificaciones de integridad.** La huella digital debe coincidir con la configuración. Las tarjetas de ejecución alteradas se rechazan.
3. **Su método no implementa el protocolo TranslationMethod.** El harness espera `translate(entries, config) → results`. Las integraciones personalizadas que evitan el harness no se aceptan.

### ¿Puedo enviar múltiples veces?

Sí. El leaderboard rastrea todos los envíos. Puede iterar — ejecutar docenas de experimentos, enviar solo el mejor. Cada envío registra una huella digital única, por lo que no hay ambigüedad sobre qué ejecución produjo qué puntuación.

### ¿Cómo hago que mi puntuación sea verificada?

1. **Self-benchmarked:** Cada envío comienza aquí, y hoy en día todas las filas de la tabla siguen aquí.
2. **Champollion Verified:** El proyecto vuelve a puntuar las salidas enviadas frente al corpus de referencia fijado por hash SHA con la métrica del harness. Cuando su puntuación se reproduce, la ejecución asciende a Champollion Verified, el nivel que una clasificación de concurso utiliza por defecto y el único nivel elegible para un premio; la tabla pública también lista filas autoevaluadas ("Self-benchmarked"), etiquetadas como tales. Si no se reproduce, o si se alteró una referencia almacenada, la ejecución queda descalificada. La repuntuación es un proceso por lotes que los mantenedores ejecutan manualmente: nada lo ejecuta al enviar ni nada lo programa.
3. **Community Validated:** Hablantes bilingües del idioma de destino, calificados según el protocolo propio de la comunidad, revisan una muestra estratificada de la salida de su método (al menos 30 entradas, al menos 2 revisores) y al menos el 70% debe cumplir con el estándar de la comunidad. El nivel se confiere únicamente mediante pruebas que la propia comunidad ejecuta, a su discreción, y puede revocarse de la misma manera: una auditoría aleatoria fallida degrada el método con la misma publicidad. Esto no se puede automatizar; requiere la participación de la comunidad.

### ¿Por qué no vuelven a ejecutar el método de todos para verificarlo?

Porque no podemos costearlo y no es necesario. Volver a puntuar las salidas enviadas de *todos* es gratis (eso detecta puntuaciones escritas a mano o editadas). Volver a ejecutar un modelo realmente cuesta recursos computacionales reales, por lo que se haría sobre una **muestra** elegida mediante **auditoría ponderada por reputación**: la política de muestreo está construida y probada, pero el ejecutor que impulsaría aún no, por lo que todavía no se ha activado ninguna reejecución de muestra y una ejecución seleccionada se registra como *L2-pending*. Bajo esa política, una ejecución siempre se selecciona si es de alto impacto (tiende el primer puente hacia toda una familia lingüística) o anómala (un salto demasiado bueno para ser verdad sobre el récord anterior), y rara vez se inspecciona aleatoriamente a los colaboradores de trayectoria comprobada. La reputación solo se gana aprobando estas auditorías (o si un colaborador independiente corrobora su resultado), nunca por volumen, por lo que las identidades desechables nuevas no obtienen nada. Una sola falsificación detectada reduce a cero la reputación de un colaborador, vuelve a auditar todo su historial verificado y se registra públicamente, como una retractación. **No** afirmamos que su ejecución "pasó por el harness" —para recursos computacionales autohospedados eso no es verificable por el servidor—, por lo que la validez se basa en la *reproducibilidad + el compromiso de reputación + la corroboración*, no en una atestación. Consulte las [Reglas de evaluación de TA](/docs/network/leaderboard/rules#how-verification-scales-reputation-weighted-auditing) para conocer el modelo completo.

### ¿Está activa la API de envío?

Aún no. El endpoint `https://champollion.dev/api/leaderboard/submit` es aspiracional. La ruta de envío actual es `mt-eval publish` — carga una tarjeta de ejecución del directorio de salida del arnés (`eval/logs/harness/`) directamente al leaderboard como *auto-evaluado (no verificado)*.

---

## Modelos y Parámetros

### ¿Qué modelo debo usar?

No hay un único mejor modelo — depende del par de idiomas, su presupuesto y su enfoque. Orientación general:

| Tipo de Idioma | Punto de Partida Recomendado | Por Qué |
|----------------|------------------------------|--------|
| **Alto recurso** (Francés, Español, Japonés) | `google/gemini-2.5-flash` o `gpt-4o-mini` | Rápido, económico, línea base sólida |
| **Bajo recurso con algo de cobertura LLM** (Quechua, Yoruba) | `google/gemini-2.5-pro` o `anthropic/claude-sonnet-4` | Los modelos más grandes tienen mejor conocimiento latente |
| **Polisintético / muy bajo recurso** (Plains Cree, Inuktitut) | `google/gemini-2.5-pro` con coaching | Los datos de coaching importan más que la elección del modelo. OMT-1600 incluye algunos idiomas polisintéticos (p. ej., CRK en nivel R1) pero con tokenización BPE estándar — evalúelo como línea base en la Red. |

El arnés de evaluación utiliza OpenRouter, por lo que cualquier modelo disponible en OpenRouter puede ser evaluado. Véase [openrouter.ai/models](https://openrouter.ai/models) para la lista de disponibles.

### ¿Qué temperatura debo usar?

Más baja es generalmente mejor para traducción:

| Temperatura | Efecto | Recomendado Para |
|-------------|--------|-----------------|
| **0.0 – 0.2** | Salida altamente determinista y consistente | Métodos de producción, benchmarks finales |
| **0.3 – 0.5** | Algo de variación, ocasionalmente más creativo | Exploración, iteración temprana |
| **0.6+** | Alta variación, impredecible | No recomendado para evaluación de MT |

La temperatura se registra en la tarjeta de ejecución, por lo que diferentes temperaturas producen diferentes huellas digitales — se tratan como experimentos diferentes.

### ¿Ayudan los datos de coaching?

Sí, significativamente — para idiomas de bajo recurso. Los datos de coaching (reglas gramaticales, entradas de diccionario, notas de estilo) se inyectan en el indicador del sistema del LLM. Para Plains Cree, los métodos con coaching superan consistentemente los métodos LLM sin procesar para idiomas polisintéticos porque los LLM de propósito general tienen exposición limitada a polisintéticos y no tienen conciencia morfológica. Incluso OMT-1600, que fue entrenado específicamente para CRK, utiliza tokenización BPE estándar que no puede representar la morfología polisintética estructuralmente. Los datos de coaching proporcionan el contexto lingüístico que le falta al modelo.

Para idiomas de alto recurso (Francés, Español), el coaching tiene menos impacto porque el modelo ya tiene conocimiento de línea base sólido.

Consulte [Datos de Coaching](https://champollion.dev/docs/concepts/coaching-data) para la especificación completa.

---

## FST y Validación Morfológica

### ¿Qué pasa si no hay FST para mi idioma?

Muchos idiomas no cuentan con un transductor de estados finitos. No hay problema: el harness funciona sin él. La métrica principal es chrF++ en cualquier caso, por lo que las ejecuciones con y sin un FST se puntúan de la misma manera; la aceptación por FST (FST acceptance) es un diagnóstico y se marca como `null` en la ficha de ejecución cuando no se utilizó ningún FST.

Los registros principales para FST existentes:

| Registro | Cobertura | URL |
|----------|-----------|-----|
| **GiellaLT** | Más de 100 idiomas: las lenguas sami, cree, inuktitut y muchos otros idiomas urálicos y minoritarios | [giellalt.uit.no](https://giellalt.uit.no/) |
| **ALTLab** | Cree de las llanuras, tsuut'ina, odawa | [altlab.ualberta.ca](https://altlab.ualberta.ca/) |
| **Apertium** | ~60 pares de idiomas, en su mayoría europeos | [apertium.org](https://apertium.org/) |
| **UniMorph** | Paradigmas morfológicos para más de 150 idiomas | [unimorph.github.io](https://unimorph.github.io/) |

### ¿Puedo construir un FST?

Sí, pero no es trivial. Un FST codifica las reglas morfológicas de un idioma — todas las formas de palabras válidas. Construir uno requiere conocimiento lingüístico profundo del idioma. Si tiene acceso a una gramática morfológica (p. ej., de un departamento de lingüística), puede compilarse en un FST utilizando herramientas como [HFST](https://hfst.github.io/) o [Foma](https://fomafst.github.io/).

### ¿Cómo funciona el gating FST en la práctica?

El pipeline gated por FST funciona así:

1. El LLM genera una traducción
2. Cada palabra en la salida se verifica contra el FST
3. Las palabras que el FST rechaza se marcan como morfológicamente inválidas
4. El método puede reintentar con retroalimentación ("la palabra X no es válida, intente de nuevo")
5. Después de reintentos, las palabras inválidas restantes se registran

La tasa de aceptación FST mide cuántas palabras pasan la validación. Consulte el [Tutorial de Pipeline Gated por FST](/docs/network/tutorials/fst-gated-pipeline) para un ejemplo completo trabajado.

---

## Datos y Conjuntos de Datos

### ¿Puedo contribuir un conjunto de datos para un idioma nuevo?

Sí. Requisitos mínimos de [Especificación de Benchmark §11](/docs/network/specifications/benchmark#11-extending-to-new-languages):

- **50 entradas de estándar de oro** (fuente + traducción de referencia verificada)
- **30 entradas de desarrollo** (pueden superponerse con estándar de oro para corpus pequeños)
- **Consentimiento comunitario** (para idiomas indígenas, autorización explícita de un organismo de gobernanza)
- **Documentación de procedencia** (de dónde vinieron los datos, qué licencia se aplica)

Los nuevos conjuntos de datos abren nuevas pistas de leaderboard automáticamente. Consulte [Para Comunidades de Idiomas](/docs/network/community/for-language-communities) para la guía del colaborador.

### ¿En qué formato debe estar mi conjunto de datos?

JSON con los nombres de campo canónicos:

```json
{
  "name": "my-language-dev-v1",
  "language_pair": "en-xxx",
  "segment": "development",
  "version": "1.0",
  "entries": [
    {
      "id": 1,
      "source": "Hello",
      "reference": "[translation in target language]",
      "difficulty": 1,
      "domain": "general"
    }
  ]
}
```

Consulte [Conjuntos de Datos](/docs/network/leaderboard/datasets) para el esquema completo y definiciones de nivel de dificultad.

---

## Soberanía y Propiedad

### ¿Quién es dueño de un método construido para un idioma indígena?

Para los idiomas indígenas, un método que cumple con el estándar de un premio —su umbral automatizado y la validación comunitaria por parte de hablantes— activa el proceso de [transferencia de propiedad](/docs/network/sovereignty/ownership-transfer) bajo la plantilla predeterminada. La propiedad del código se transfiere del investigador a la organización de gobernanza de la comunidad lingüística.

El investigador retiene:
- Derechos de publicación (artículos académicos sobre el método)
- Crédito en el leaderboard
- El derecho de aplicar las mismas *técnicas* a otros idiomas

La organización de gobernanza gana:
- Propiedad completa del código del método y datos de coaching
- Control sobre el despliegue (cuándo, dónde, cómo) — y todo lo que un despliegue genera. Champollion es no comercial y no toma ninguna parte

### ¿Puedo usar champollion para idiomas no indígenas sin preocupaciones de soberanía?

Sí. Para idiomas estándar (francés, japonés, español, etc.), no existen consideraciones de soberanía. Use champollion con normalidad: traduzca, sincronice y publique como desee. El marco de soberanía se aplica específicamente a idiomas indígenas y gobernados por comunidades donde los principios de gobernanza de datos —propiedad comunitaria y control de los datos lingüísticos, CARE, Te Mana Raraunga— requieren una consideración especial.

---

## Consulte también

- **[Cómo Funciona](https://champollion.dev/how-it-works)** — el explicador de solución completa
- **[Especificación de Puntuación](/docs/network/specifications/scoring)** — la SSOT para toda la lógica de puntuación (métricas, pesos, niveles)
- **[Especificación de Benchmark](/docs/network/specifications/benchmark)** — protocolo de evaluación, formato de corpus, soberanía
- **[Enviar un Método](/docs/network/getting-started/submit-a-method)** — guía de inicio rápido paso a paso
- **[Reglas del Leaderboard](/docs/network/leaderboard/rules)** — criterios de envío
- **[Administración de Datos](/docs/network/sovereignty/data-sovereignty)** — los corpus permanecen con sus administradores; cada licencia respetada
