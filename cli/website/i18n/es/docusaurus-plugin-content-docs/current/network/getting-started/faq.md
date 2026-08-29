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

El arnés calcula cinco métricas. Tres son agnósticas del idioma y funcionan para cualquier par de idiomas; dos actualmente dependen de complementos específicos de CRK y se generalizarán a medida que nos expandamos a más idiomas. Los corpus de referencia ejecutables hoy son conjuntos públicos con licencia abierta — Global Voices, Tatoeba, TICO-19, IN22, SMOL, y más (véase [Datasets](/docs/network/leaderboard/datasets)) — y el leaderboard está abierto para envíos en todos los pares registrados. Plains Cree es simplemente donde las dos métricas específicas del idioma (respaldadas por FST) se implementaron primero.

| Métrica | Escala | Qué Mide | Estado |
|--------|--------|---------|--------|
| **chrF++** | 0–100 | Superposición de n-gramas de caracteres entre traducciones predichas y de referencia. Mejor métrica de superficie para idiomas morfológicamente ricos. Utiliza la puntuación nativa de sacrebleu. | ✅ Todos los idiomas |
| **Coincidencia exacta** | 0.0–1.0 | Proporción de entradas donde la predicción coincide exactamente con la referencia después de la normalización. | ✅ Todos los idiomas |
| **Aceptación FST** | 0.0–1.0 | Proporción de palabras de salida aceptadas por un transductor de estados finitos (analizador morfológico). Solo se calcula cuando se proporciona un binario FST. | ✅ Todos los idiomas con FST |
| **Coincidencia equivalente** | 0.0–1.0 | Fracción de entradas que coinciden con la referencia o una variante aceptable — considerando orden de palabras, convención ortográfica y diferencias dialectales. | ⚡ CRK (generalizando) |
| **Puntuación semántica** | 0.0–1.0 | Puntuación de preservación de significado — ¿qué tan bien captura la traducción el significado previsto independientemente de la forma de superficie? | ⚡ CRK (generalizando) |

Se planean métricas adicionales: **precisión morfológica**, **detección de code-switching**, **adherencia a terminología**, y **detección de alucinaciones**. Consulte [Especificación de Puntuación §2](/docs/network/specifications/scoring#2-metric-inventory) para el inventario completo de métricas (seis categorías).

### ¿Cómo se calcula la puntuación compuesta?

La compuesta es un promedio ponderado de métricas disponibles, normalizado a una escala 0.0–1.0. Los pesos se definen en dos perfiles:

- **Perfil A** (idiomas con FST): 9 métricas, las métricas estructurales (FST + precisión morfológica) llevan el 40% del peso compuesto
- **Perfil B** (idiomas sin FST): 8 métricas, semántica y chrF++ llevan peso superior igual

Cuando una métrica no está disponible, su peso se redistribuye proporcionalmente entre las métricas restantes. Esto significa que los benchmarks en etapa temprana (con solo chrF++ y coincidencia exacta disponibles) aún producen compuestas válidas — los pesos efectivos simplemente reflejan lo que está disponible.

**Las tablas de peso completas, reglas de normalización y justificación de exclusión están en [Especificación de Puntuación §4](/docs/network/specifications/scoring#4-composite-score).** El código del harness refleja estas tablas en `mt_eval_harness/scoring.py`. chrF++ se normaliza dividiendo por 100 antes de ponderarse; las tasas de code-switching y alucinación se invierten (menor = mejor).

### ¿Qué son los niveles de calidad?

Los niveles de calidad son etiquetas heurísticas asignadas a rangos de puntuación compuesta. Ayudan a comunicar qué significa una puntuación *prácticamente*:

| Nivel | Rango Compuesto | Interpretación |
|------|-----------------|----------------|
| **Línea Base** | 0.00 – 0.30 | Por debajo de calidad útil. El método necesita mejora significativa. |
| **Emergente** | 0.30 – 0.50 | Muestra promesa. Algunas traducciones son correctas pero inconsistentes. |
| **Funcional** | 0.50 – 0.70 | Utilizable como referencia con revisión humana. No apto para despliegue sin revisar. |
| **Desplegable** | 0.70 – 0.85 | Listo para uso en producción con revisión periódica. Activa elegibilidad de transferencia de propiedad. |
| **Fluido** | 0.85 – 1.00 | Calidad casi nativa. Apto para despliegue sin supervisión. |

### ¿Cuál es la diferencia entre niveles de calidad y niveles de verificación?

**Los niveles de calidad** describen *qué significa la puntuación automatizada* (Línea Base → Fluido). **Los niveles de verificación** describen *quién validó el resultado*:

| Nivel de verificación | Qué significa |
|-----------------------|---------------|
| **Autoevaluado** | El remitente ejecutó el entorno de pruebas por sí mismo. Las puntuaciones son plausibles pero no están verificadas. |
| **Verificado por Champollion** | Un mantenedor reprodujo el resultado utilizando la configuración del método enviada. |
| **Validado por la comunidad** | Hablantes bilingües del idioma de destino, calificados bajo el propio protocolo de la comunidad, revisaron una muestra estratificada de los resultados (≥30 entradas, ≥2 revisores) y ≥70% cumplió con el estándar de la comunidad. Otorgado únicamente mediante las propias pruebas de la comunidad; la degradación por auditoría aleatoria es simétrica e igualmente pública. |

Un método puede ser de calidad "Desplegable" pero solo "Auto-evaluado" en verificación — lo que significa que la puntuación se ve excelente pero nadie la ha confirmado independientemente.

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

1. **Autoevaluado (automático):** Todos los envíos comienzan aquí.
2. **Verificado por Champollion (automático):** El servidor vuelve a puntuar los resultados enviados frente al corpus de referencia fijado por SHA con la métrica del entorno de pruebas. Cuando su puntuación se reproduce, la ejecución asciende a Verificado por Champollion, el único nivel que clasifica la tabla de clasificación. Si no se reproduce, o si se alteró una referencia almacenada, la ejecución es descalificada.
3. **Validado por la comunidad:** Hablantes bilingües del idioma de destino, calificados bajo el propio protocolo de la comunidad, revisan una muestra estratificada de los resultados de su método (al menos 30 entradas, al menos 2 revisores) y al menos el 70% debe cumplir con el estándar de la comunidad. El nivel se otorga únicamente mediante las pruebas que la comunidad ejecuta por sí misma, a su discreción, y puede revocarse de la misma manera: una auditoría aleatoria fallida degrada el método de forma igualmente pública. Esto no se puede automatizar; requiere la participación de la comunidad.

### ¿Por qué no vuelven a ejecutar el método de todos para verificarlo?

Porque no podemos permitírnoslo y no lo necesitamos. El servidor vuelve a puntuar los resultados enviados de *todos* de forma gratuita (eso detecta puntuaciones ingresadas manualmente o editadas). Volver a ejecutar un modelo en realidad cuesta capacidad de cómputo real, por lo que lo hacemos en una **muestra** elegida mediante **auditoría ponderada por reputación**: una ejecución siempre se vuelve a ejecutar si es de alto impacto (crea el primer puente hacia toda una familia de idiomas) o anómala (un salto demasiado bueno para ser verdad sobre el mejor anterior), y de los contribuyentes comprobados se audita aleatoriamente en raras ocasiones. La reputación se gana únicamente al aprobar estas auditorías (o si un contribuyente independiente corrobora su resultado), nunca por volumen, por lo que las identidades nuevas y desechables no ganan nada. Una falsificación detectada reduce a cero la reputación de un contribuyente, vuelve a auditar todo su historial verificado y se registra públicamente, como una retractación. **No** afirmamos que su ejecución "pasó por el entorno de pruebas" (para el cómputo autoalojado que no es verificable por el servidor), por lo que la validez se basa en la *reproducibilidad + riesgo de reputación + corroboración*, no en la certificación. Consulte las [reglas de evaluación de MT](/docs/network/leaderboard/rules#how-verification-scales-reputation-weighted-auditing) para ver el modelo completo.

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

Muchos idiomas no tienen un transductor de estados finitos. Está bien — el harness funciona sin uno. La puntuación compuesta utiliza pesos del Perfil B (consulte [Especificación de Puntuación §4.3](/docs/network/specifications/scoring#43-weight-tables)) que desplazan el peso a métricas semánticas y de superficie. La aceptación FST se marca como `null` en la tarjeta de ejecución.

Los registros principales para FST existentes:

| Registro | Cobertura | URL |
|----------|-----------|-----|
| **GiellaLT** | Más de 100 idiomas: los idiomas Sámi, Cree, Inuktitut y muchos otros idiomas urálicos y minoritarios | [giellalt.uit.no](https://giellalt.uit.no/) |
| **ALTLab** | Plains Cree, Tsuut'ina, Odawa | [altlab.ualberta.ca](https://altlab.ualberta.ca/) |
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

Para idiomas indígenas, los métodos que alcanzan el nivel Desplegable (compuesto ≥ 0.70) Y pasan la validación comunitaria activan el proceso de [transferencia de propiedad](/docs/network/sovereignty/ownership-transfer). La propiedad del código se transfiere del investigador a la organización de gobernanza de la comunidad de idiomas.

El investigador retiene:
- Derechos de publicación (artículos académicos sobre el método)
- Crédito en el leaderboard
- El derecho de aplicar las mismas *técnicas* a otros idiomas

La organización de gobernanza gana:
- Propiedad completa del código del método y datos de coaching
- Control sobre el despliegue (cuándo, dónde, cómo) — y todo lo que un despliegue genera. Champollion es no comercial y no toma ninguna parte

### ¿Puedo usar champollion para idiomas no indígenas sin preocupaciones de soberanía?

Sí. Para idiomas estándar (Francés, Japonés, Español, etc.), no hay consideraciones de soberanía. Use champollion normalmente — traduzca, sincronice, publique como desee. El marco de soberanía se aplica específicamente a idiomas indígenas y gobernados por la comunidad donde los principios de gobernanza de datos — la propiedad y el control comunitarios de los datos lingüísticos, CARE, Te Mana Raraunga — requieren consideración especial.

---

## Consulte también

- **[Cómo Funciona](https://champollion.dev/how-it-works)** — el explicador de solución completa
- **[Especificación de Puntuación](/docs/network/specifications/scoring)** — la SSOT para toda la lógica de puntuación (métricas, pesos, niveles)
- **[Especificación de Benchmark](/docs/network/specifications/benchmark)** — protocolo de evaluación, formato de corpus, soberanía
- **[Enviar un Método](/docs/network/getting-started/submit-a-method)** — guía de inicio rápido paso a paso
- **[Reglas del Leaderboard](/docs/network/leaderboard/rules)** — criterios de envío
- **[Administración de Datos](/docs/network/sovereignty/data-sovereignty)** — los corpus permanecen con sus administradores; cada licencia respetada

