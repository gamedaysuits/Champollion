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
    note: "How runs are scored, and why no score is a quality label"
  - label: "Translation Is Not Revitalization"
    to: /docs/network/perspectives/translation-is-not-revitalization
    kind: position
---

# Del Benchmark al Uso Diario: La Ruta de la Posedición

> **La versión corta.** Una puntuación en la tabla de clasificación no es un producto. El camino desde "este método obtiene una puntuación chrF++ de 47.5" hasta "la oficina de la banda publica documentos en el idioma todas las semanas" pasa exactamente por un flujo de trabajo: la máquina genera un borrador, un hablante fluido lo corrige y solo se publica el texto corregido. Cada umbral de calidad en nuestras especificaciones está calibrado para ese flujo de trabajo, no para resultados automáticos sin supervisión, los cuales no respaldamos para ningún idioma en esta plataforma.

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

## Qué puede y qué no puede decirle una puntuación de la tabla de clasificación

La tabla de clasificación clasifica los métodos de la misma forma que el campo de la traducción automática: mediante **chrF++** a nivel de corpus (0–100) con su intervalo de confianza del 95 % y su firma sacreBLEU, junto con BLEU, spBLEU, TER y COMET a su lado, y diagnósticos como la aceptación de FST reportados por separado ([Especificación de puntuación](/docs/network/specifications/scoring#how-runs-are-scored)). El hecho de que un método sea mejor que otro en el mismo conjunto de evaluación se decide mediante una prueba de significancia pareada, no comparando dos números a simple vista ([Pruebas de significancia](/docs/network/specifications/significance)).

Lo que esto le dice a una comunidad: qué métodos producen resultados más cercanos a traducciones de referencia confiables y si la brecha entre dos métodos es real. Lo que no puede decirle: si un borrador merece el tiempo de un hablante. El mismo valor de chrF++ significa cosas distintas para diferentes idiomas y conjuntos de evaluación, por lo que ninguna puntuación automática aquí lleva una etiqueta de calidad. La Red solía asignar un compuesto ponderado a niveles con nombre ("funcional", "desplegable", …); esas etiquetas se retiraron, en parte porque un sistema que repetía una única oración válida para cada entrada fue clasificado como "funcional" ([por qué se retiró el compuesto](/docs/network/specifications/scoring#why-the-composite-was-retired)).

De esto se desprenden dos reglas de honestidad estructural, provenientes de la [Especificación del benchmark §7](/docs/network/specifications/benchmark#7-human-validation):

- **Una puntuación es una nominación para revisión humana, no un veredicto.** Un chrF++ alto hace que valga la pena poner a prueba un método con hablantes; no significa que esté listo.
- **Solo la revisión de la comunidad determina si un método está listo para un flujo de trabajo de posedición.** Una muestra estratificada de sus resultados se envía a hablantes bilingües, quienes califican cada traducción como *rechazar / idea general / aceptable / excelente*. La organización de gobernanza —no la tabla de clasificación— decide si el método avanza.

A modo de comparación, las condiciones del [Premio del Fundador](/docs/network/specifications/prizes) (un piso de chrF++, un filtro de ≥99 % de palabras morfológicamente válidas y un ≥70 % calificado como aceptable o superior por hablantes) describen un método cuyos errores restantes son *errores de lenguaje real*: flexión incorrecta, no palabras inventadas. Así es como se ve en números "un borrador que vale el tiempo de un hablante", y el veredicto de los hablantes es la condición definitiva.

## De un método ganador a una oficina funcional

Supongamos que un método cruza esas puertas. Los pasos restantes son organizacionales, y están especificados en lugar de improvisados:

1. **La propiedad se transfiere.** El código del método se convierte en propiedad de la organización de gobernanza de la comunidad — el desarrollador mantiene derechos de atribución y publicación ([Ownership Transfer](/docs/network/sovereignty/ownership-transfer)).
2. **El método se convierte en un servicio — el servicio de la comunidad.** Se empaqueta como un plugin que la organización de gobernanza puede ejecutar en su propia infraestructura, controlando acceso y usos permitidos ([Deploy to Production](/docs/network/getting-started/deploy-to-production)). Si la comunidad elige ofrecerlo comercialmente, ese es su negocio en todos los sentidos — Champollion no toma participación ([How the Work Is Funded](/docs/network/sovereignty/economic-model)).
3. **Los traductores lo conectan a su día.** Una oficina de traducción apunta su flujo de trabajo de documentos existente a la API del método: texto fuente adentro, borrador afuera, posedición, publicación. El texto publicado lleva el nombre y autoridad del traductor — la máquina es una herramienta en su escritorio, como un diccionario.

## Dónde está esto hoy

En pocas palabras: el camino completo está especificado de extremo a extremo y parcialmente construido. El entorno de evaluación, las métricas, las fichas de ejecución (*run cards*) y la tabla de clasificación pública existen; el *sandbox* de evaluación está construido, pero solo se ha probado con un método de juguete; existe un corpus de desarrollo de cree de las llanuras en el repositorio original (*upstream*); se ha propuesto un premio, pero ninguno está abierto; la plataforma de despliegue existe. La interfaz de revisión comunitaria y el bucle de retroalimentación de texto corregido están especificados, pero aún no están operativos; las especificaciones los marcan como planificados, y nosotros también. Ningún método ha completado aún todo el recorrido desde el benchmark hasta el uso diario en la comunidad. Ese recorrido es la definición de éxito del proyecto, y es exactamente por eso que no lo daremos por alcanzado antes de tiempo.

---

## Lo que esto significa para usted

:::info[Si usted es miembro de una comunidad]
Una puntuación alta en la tabla de clasificación nunca significa que una máquina publicará en su idioma sin supervisión: significa que un generador de borradores podría estar listo para *audicionar* ante sus traductores, bajo sus propios términos y con sus hablantes como jueces (remunerados; consulte [Cómo se les paga a los hablantes](/docs/network/perspectives/how-speakers-get-paid)). Si su comunidad administra una oficina de traducción, la pregunta pertinente que debe plantearnos es: "¿cómo sería una prueba piloto y quién revisa los resultados?".
:::

:::info[Si usted es investigador]
El enfoque de la posedición cambia lo que vale la pena medir: el tiempo necesario para obtener un texto aceptable con un hablante en el proceso (*speaker in the loop*), no solo el chrF++. Las métricas de la Red son indicadores indirectos de eso ([Especificación de puntuación §1](/docs/network/specifications/scoring)), y los estudios de posedición por idioma para lenguas morfológicamente complejas constituyen una brecha de investigación abierta que esta infraestructura está diseñada para respaldar.
:::

:::info[Si usted es desarrollador]
Optimice para el editor, no para la métrica. Un método que produce palabras reales con inflexiones ocasionalmente incorrectas es corregible en segundos por un hablante; un método que alucina formas plausibles envenena todo el flujo de trabajo — por eso la validez morfológica está tan restringida aquí. Comience en [Submit a Method](/docs/network/getting-started/submit-a-method), y lea [Method Interface](/docs/network/specifications/methods) para ver qué entregará eventualmente si gana.
:::

## Véase también

- [Translation Is Not Revitalization](/docs/network/perspectives/translation-is-not-revitalization) — por qué la puerta humana es el punto, no una limitación
- [Reporting Errors and Owning Corrections](/docs/network/perspectives/reporting-errors-and-owning-corrections) — qué sucede cuando el texto publicado es incorrecto de todas formas
- [Benchmark Specification §7](/docs/network/specifications/benchmark#7-human-validation) — la puerta de validación humana, formalmente
