---
sidebar_position: 3
title: "Del Benchmark al Uso Diario: La Ruta de Posedición"
slug: '/network/perspectives/from-benchmark-to-daily-use'
description: "Cómo un método de traducción evaluado en benchmark se convierte en un flujo de trabajo de traducción comunitaria: borrador automático, posedición por hablante fluido, texto publicado — con umbrales de calidad honestos en cada paso."
related:
  - label: "Deploy to Production"
    to: /docs/network/getting-started/deploy-to-production
    kind: guide
    note: "From proven method to live translation"
  - label: "Cookbook: Partial Translation (Human + Machine)"
    to: /docs/network/tutorials/partial-translation
    kind: cookbook
  - label: "Scoring Specification"
    to: /docs/network/specifications/scoring
    kind: spec
    note: "The quality thresholds behind the path"
  - label: "Translation Is Not Revitalization"
    to: /docs/network/perspectives/translation-is-not-revitalization
    kind: position
---

# Del Benchmark al Uso Diario: La Ruta de la Posedición

> **La versión corta.** Una puntuación en la tabla de clasificación no es un producto. La ruta desde "este método obtiene 0.78" hasta "la oficina de la banda publica documentos en la lengua cada semana" pasa por exactamente un flujo de trabajo: la máquina produce un borrador, un hablante fluido lo corrige, y solo el texto corregido se publica. Cada umbral de calidad en nuestras especificaciones está calibrado para ese flujo de trabajo — no para la salida de máquina sin supervisión, que no respaldamos para ninguna lengua en esta plataforma.

A veces la gente pregunta cuándo un método de traducción será "lo suficientemente bueno para simplemente usarlo". Para las lenguas que esta Red sirve, esa pregunta tiene una trampa. La respuesta honesta es que el estándar que vale la pena perseguir no es "lo suficientemente bueno para publicar sin revisar" — es **"lo suficientemente bueno que revisar un borrador supera traducir desde cero."** Ese estándar es mucho más bajo, es medible, y cruzarlo cambia lo que una oficina de traducción comunitaria puede producir en una semana.

---

## El flujo de trabajo, de principio a fin

```
 English source document
        │
        ▼
 Machine draft  ←  a benchmarked, community-owned method
        │
        ▼
 Fluent-speaker post-edit  ←  the human gate; nothing skips it
        │
        ▼
 Published text  ←  carries human approval, not a machine score
        │
        ▼
 (Optional, community-controlled) corrections become
 data that improves the next version of the method
```

Tres cosas a notar:

1. **La máquina nunca publica.** La unidad de salida es un borrador. El paso de corrección del hablante no es aseguramiento de calidad añadido al final — es el flujo de trabajo.
2. **El tiempo del hablante es el recurso que se optimiza.** Un método es mejor que otro método exactamente en la medida en que deja menos para que el hablante corrija. La investigación sobre posedición para lenguas bien dotadas de recursos encuentra consistentemente que es más rápido que traducir desde cero con calidad moderada de TA (Plitt & Masselot 2010; Green, Heer & Manning 2013, ambos citados con enlaces en [Translation Is Not Revitalization](/docs/network/perspectives/translation-is-not-revitalization)). Si eso se sostiene para lenguas polisintéticas es precisamente lo que el benchmark existe para descubrir — lo tratamos como una hipótesis a verificar por lengua, no como una suposición.
3. **El ciclo de retroalimentación es propiedad de la comunidad.** Cada documento corregido es potencial dato de entrenamiento y coaching — y pertenece a la comunidad, para retroalimentar (o no) en sus términos bajo las reglas de [data sovereignty](/docs/network/sovereignty/data-sovereignty). El mecanismo de retroalimentación es un objetivo de diseño de la plataforma, aún no una característica construida; véase [Reporting Errors and Owning Corrections](/docs/network/perspectives/reporting-errors-and-owning-corrections) para cómo se supone que funcionan las correcciones y la procedencia.

## Qué significan los niveles de calidad para el uso real

La tabla de clasificación califica métodos en una composición de métricas automatizadas ([Scoring Specification](/docs/network/specifications/scoring)), y las puntuaciones se asignan a niveles nombrados. Aquí está la traducción honesta de esos niveles a términos de uso diario:

| Nivel (compuesto) | Qué significa para la ruta de posedición |
|---|---|
| **Baseline** (0.00–0.30) | No utilizable para nada. La salida no es en gran medida la lengua objetivo. Útil solo como piso de investigación. |
| **Emerging** (0.30–0.50) | Aún no es una herramienta de borrador. Aparecen fragmentos correctos, pero un hablante gastaría más tiempo corrigiendo que escribiendo de nuevo. |
| **Functional** (0.50–0.70) | El primer nivel donde la posedición *podría* superar la traducción desde cero para textos fáciles — vale la pena pilotear con un hablante, no vale la pena depender de ello. Permanecen errores morfológicos frecuentes. |
| **Deployable** (0.70–0.85) | El nivel objetivo para el flujo de trabajo anterior: borradores donde la mayoría de la morfología es correcta y un hablante fluido puede corregir significativamente más rápido que retraducir. **"Deployable" significa deployable *en un flujo de trabajo de posedición* — nunca "publicar sin revisar."** |
| **Fluent** (0.85–1.00) | Aproximándose a traducción humana competente; errores raros y menores. El paso de revisión permanece — solo se vuelve más rápido. |

Dos reglas de honestidad estructural se sitúan encima de esta tabla, directamente de la [Benchmark Specification §5 y §7](/docs/network/specifications/benchmark#5-quality-tiers):

- **Los niveles automatizados son etiquetas provisionales, no veredictos.** Son nominaciones para revisión humana. Los umbrales serán recalibrados conforme se acumulan datos de validación de hablantes, y pueden ubicarse diferentemente para diferentes lenguas.
- **Ningún método puede reclamar Deployable o superior sin revisión comunitaria.** Una muestra estratificada de su salida va a hablantes bilingües, quienes califican cada traducción como *rechazar / gist / aceptable / excelente*. La organización de gobernanza — no la tabla de clasificación — decide si el método avanza.

Para comparación, el umbral del [Founder's Prize](/docs/network/specifications/prizes) (compuesto ≥ 0.80, ≥99% palabras morfológicamente válidas, ≥70% hablantes califican aceptable-o-mejor) describe un método cuyos errores restantes son *errores de lengua real* — inflexión incorrecta, no palabras fabricadas. Eso es lo que "un borrador que vale la pena del tiempo de un hablante" se ve en números.

## De un método ganador a una oficina funcional

Supongamos que un método cruza esas puertas. Los pasos restantes son organizacionales, y están especificados en lugar de improvisados:

1. **La propiedad se transfiere.** El código del método se convierte en propiedad de la organización de gobernanza de la comunidad — el desarrollador mantiene derechos de atribución y publicación ([Ownership Transfer](/docs/network/sovereignty/ownership-transfer)).
2. **El método se convierte en un servicio — el servicio de la comunidad.** Se empaqueta como un plugin que la organización de gobernanza puede ejecutar en su propia infraestructura, controlando acceso y usos permitidos ([Deploy to Production](/docs/network/getting-started/deploy-to-production)). Si la comunidad elige ofrecerlo comercialmente, ese es su negocio en todos los sentidos — Champollion no toma participación ([How the Work Is Funded](/docs/network/sovereignty/economic-model)).
3. **Los traductores lo conectan a su día.** Una oficina de traducción apunta su flujo de trabajo de documentos existente a la API del método: texto fuente adentro, borrador afuera, posedición, publicación. El texto publicado lleva el nombre y autoridad del traductor — la máquina es una herramienta en su escritorio, como un diccionario.

## Dónde está esto hoy

Claramente: la ruta completa está especificada de principio a fin, y parcialmente construida. El arnés de evaluación, métricas, tarjetas de ejecución, y tabla de clasificación pública existen; el corpus de desarrollo de Plains Cree y un premio activo existen; la plataforma de despliegue existe. La interfaz de revisión comunitaria, la caja de arena de evaluación, y el ciclo de retroalimentación de texto corregido están especificados pero aún no operacionales — las especificaciones los marcan como planeados, y nosotros también. Ningún método ha completado aún el viaje completo desde benchmark hasta uso diario comunitario. Ese viaje es la definición de éxito del proyecto, que es exactamente por qué no lo reclamaremos temprano.

---

## Lo que esto significa para usted

:::info[Si usted es miembro de la comunidad]
Una insignia "Deployable" en un leaderboard nunca significa que una máquina publicará en su idioma sin supervisión — significa que un generador de borradores puede estar listo para *audicionarse* ante sus traductores, en sus términos, con sus hablantes como jueces (pagados — véase [How Speakers Get Paid](/docs/network/perspectives/how-speakers-get-paid)). Si su comunidad opera una oficina de traducción, la pregunta relevante a plantearnos es: "¿cómo se vería un piloto, y quién revisa el resultado?"
:::

:::info[Si usted es investigador]
El enfoque de post-edición cambia qué vale la pena medir: tiempo hasta texto aceptable con un hablante en el ciclo, no solo puntuación compuesta. Las métricas de la Red son aproximaciones para eso ([Scoring Specification §1](/docs/network/specifications/scoring)), y estudios de post-edición por idioma para lenguas morfológicamente complejas son una brecha de investigación abierta que esta infraestructura está diseñada para apoyar.
:::

:::info[Si usted es desarrollador]
Optimice para el editor, no para la métrica. Un método que produce palabras reales con inflexiones ocasionalmente incorrectas es corregible en segundos por un hablante; un método que alucina formas plausibles envenena todo el flujo de trabajo — por eso la validez morfológica está tan restringida aquí. Comience en [Submit a Method](/docs/network/getting-started/submit-a-method), y lea [Method Interface](/docs/network/specifications/methods) para ver qué entregará eventualmente si gana.
:::

## Véase también

- [Translation Is Not Revitalization](/docs/network/perspectives/translation-is-not-revitalization) — por qué la puerta humana es el punto, no una limitación
- [Reporting Errors and Owning Corrections](/docs/network/perspectives/reporting-errors-and-owning-corrections) — qué sucede cuando el texto publicado es incorrecto de todas formas
- [Benchmark Specification §7](/docs/network/specifications/benchmark#7-human-validation) — la puerta de validación humana, formalmente
