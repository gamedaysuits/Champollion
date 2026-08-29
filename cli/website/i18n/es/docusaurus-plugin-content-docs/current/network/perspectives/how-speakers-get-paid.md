---
sidebar_position: 2
title: "Cómo se paga a las personas traductoras"
slug: '/network/perspectives/how-speakers-get-paid'
description: "Qué compensación reciben las personas validadoras comunitarias y traductoras por trabajo de referencia, por qué pagar a quienes traducen es innegociable, y cómo escala la compensación conforme crece la Red. Todos los números provienen de las especificaciones publicadas."
related:
  - label: "Speaker Validation Protocol"
    to: /docs/network/specifications/speaker-validation
    kind: spec
    note: "The work validators are paid for"
  - label: "Prize Specification"
    to: /docs/network/specifications/prizes
    kind: spec
    note: "Where prize money goes, and why"
  - label: "The Economic Model"
    to: /docs/network/sovereignty/economic-model
    kind: doc
  - label: "Reporting Errors and Owning Corrections"
    to: /docs/network/perspectives/reporting-errors-and-owning-corrections
    kind: position
---

# Cómo se paga a los hablantes

> **Nota de transparencia.** Cada número en esta página ya aparece en una especificación publicada — la [Especificación de Referencia §10](/docs/network/specifications/benchmark#10-cost-framework), el [Protocolo de Validación de Hablantes](/docs/network/specifications/speaker-validation), y la [Especificación de Premios](/docs/network/specifications/prizes). Esta página los reúne en un solo lugar, en lenguaje claro, para que nadie tenga que leer una especificación para averiguar cuánto vale el tiempo de un hablante aquí. No hace compromisos más allá de lo que esos documentos ya establecen.

Un hablante bilingüe que pueda juzgar si una oración producida por máquina es real, fluida y significa lo correcto es el participante más escaso y valioso en todo este sistema. Todo lo demás — arneses, métricas, clasificaciones — existe para hacer que una pequeña cantidad del tiempo de esa persona rinda mucho.

Así que la primera regla es simple: **los hablantes se pagan por su tiempo, a tasas profesionales, independientemente de lo que muestren los resultados.**

---

## Por qué pagar a los hablantes es innegociable

La investigación en tecnología del lenguaje tiene una larga costumbre de tratar a los hablantes fluidos como un recurso gratuito — "participación comunitaria" que produce conjuntos de datos, artículos y carreras para todos excepto para los hablantes. Consideramos ese patrón extractivo, y las personas más calificadas para hacer este trabajo son precisamente aquellas cuyo tiempo ya está reclamado por el trabajo urgente de enseñar, traducir y criar hijos en la lengua.

Tres consecuencias de diseño se derivan de esto:

1. **Sin canal de voluntarios.** No pedimos a los hablantes que donen trabajo de evaluación como un favor a la investigación. La participación es un compromiso pagado, y rechazarlo no le cuesta nada a un hablante.
2. **El pago es incondicional.** Los hablantes se pagan independientemente de si sus calificaciones se utilizan, y el pago no está condicionado a los resultados. El protocolo publicado se compromete al pago dentro de dos semanas de completar cada bloque de tareas.
3. **La compensación no es todo el trato.** Los hablantes que contribuyen calificaciones también reciben crédito (nombrado o anónimo, su elección), coautoría opcional en publicaciones que usen sus calificaciones, el derecho de retirar sus contribuciones en cualquier momento, y poder de veto sobre la publicación de resultados que encuentren problemáticos. Esos términos están en el [Protocolo de Validación de Hablantes §5–6](/docs/network/specifications/speaker-validation), no en una carta adicional.

## Las tasas publicadas

El marco de costos de referencia establece la compensación de hablantes bilingües en **$50–65 CAD por hora** para trabajo de corpus y validación. Lo que eso significa por rol:

### Construir un corpus de referencia

Crear las traducciones de referencia contra las que se califica cada método es la tarea fundamental del hablante. El presupuesto de establecimiento publicado por idioma:

| Trabajo | Rango publicado | Base |
|---------|-----------------|------|
| Curación de corpus (50–150 entradas) | $2,500–6,000 | $50–65/hr, tiempo de hablante bilingüe |
| Revisión de salida de métodos | $500–1,500 | Mismas tasas horarias |

Un corpus completo tradicionalmente toma a un hablante aproximadamente 80 horas; el flujo de trabajo asistido por agentes planeado (redacción y formato de oraciones manejados por herramientas, traducción siempre por un humano) está diseñado para llevar eso hacia 30–40 horas — menos horas de trabajo repetitivo, la misma tarifa horaria, con el hablante haciendo solo las partes que genuinamente requieren un humano.

### Validar las métricas

Antes de que las puntuaciones automatizadas signifiquen algo, los hablantes tienen que verificarlas contra el juicio humano. El [Protocolo de Validación de Hablantes](/docs/network/specifications/speaker-validation) publica las tareas exactas, horas y pago:

| Tarea | Tiempo | Pago por hablante |
|-------|--------|-------------------|
| A — Calificar 200 traducciones automáticas por adecuación y fluidez | ~8 horas | $400–520 CAD |
| B — Revisar 50 pares de traducciones "equivalentes" | ~2 horas | $100–130 CAD |
| C — Revisar 100 palabras que el analizador morfológico rechazó | ~1.5 horas | $75–100 CAD |

Un hablante que hace las tres tareas se compromete aproximadamente 11.5 horas durante dos a cuatro semanas por **$575–750 CAD**. La ronda completa de validación de tres hablantes cuesta al proyecto $1,475–1,920 — que es el punto: la validación de hablantes es un pequeño rubro para el proyecto y nunca debería ser donde se "ahorren" costos.

### Revisar reclamaciones de premios

Ningún premio se paga solo en puntuaciones automatizadas. El [Premio del Fundador](/docs/network/specifications/prizes) ($10,000 CAD, inglés→Plains Cree) requiere que al menos dos hablantes bilingües revisen independientemente una muestra estratificada de al menos 30 salidas, y que el 70% o más se califique como "aceptable" o "excelente". Esa revisión es trabajo de hablante pagado bajo las mismas tasas — y también es una puerta: los hablantes pueden hundir una reclamación de premio, y eso es por diseño.

## Cómo escala con concursos

El modelo está construido para que la compensación de hablantes crezca con la plataforma en lugar de ser diluida por ella:

- **Cada nuevo idioma comienza con un compromiso de corpus pagado.** El costo de establecimiento publicado por idioma ($3,350–8,500 todo incluido) es principalmente compensación de hablantes — el componente individual más grande, deliberadamente.
- **Cada nuevo fondo de premios trae su propia revisión pagada.** Cada concurso patrocinado que sigue la [plantilla de premios](/docs/network/specifications/prizes#4-future-prize-pools) lleva el mismo requisito de validación comunitaria, lo que significa que cada concurso financia trabajo de revisión de hablantes para ese idioma.
- **Los métodos de propiedad comunitaria permanecen como activos financiados por la comunidad.** Un método transferido pertenece a la organización de gobernanza completamente — cualquier cosa que gane al implementarlo es enteramente de la comunidad ([Cómo se financia el trabajo](/docs/network/sovereignty/economic-model)), disponible para revisión continua, crecimiento de corpus y programas de idioma según lo considere conveniente. Esa asignación es decisión de la comunidad, no la nuestra.

## Lo que *no* hemos prometido

La honestidad requiere marcar los bordes:

- Las tasas anteriores son las tasas publicadas para el trabajo actual de Plains Cree. Las tasas para idiomas futuros se establecerán con la comunidad asociada y se publicarán de la misma manera — en las especificaciones, antes de que comience el trabajo.
- Champollion es no comercial, no genera ingresos propios, y actualmente está **autofinanciado por su fundador** — la financiación de subvenciones y patrocinadores es lo que estamos buscando, no lo que tenemos. [Cómo se financia el trabajo](/docs/network/sovereignty/economic-model) describe el mecanismo, no una garantía.
- "Pagado justamente" es necesario pero no suficiente. El pago por sí solo no hace que un proyecto sea no extractivo — la propiedad y el control lo hacen, por eso la compensación se encuentra dentro del [modelo de administración](/docs/network/sovereignty/data-sovereignty) en lugar de reemplazarlo.

---

## Lo que esto significa para usted

:::info[Si usted es miembro de la comunidad]
Si es bilingüe en un idioma insuficientemente atendido e inglés, su criterio es la aportación más valiosa en este sistema, y los términos publicados son: $50–65 CAD/hora, horarios flexibles, pago dentro de dos semanas, crédito en sus términos, y el derecho de retirar sus contribuciones. No se requiere programación. Comience con [Para comunidades lingüísticas](/docs/network/community/for-language-communities) o el [Protocolo de Validación de Hablantes §7](/docs/network/specifications/speaker-validation#7-how-to-get-started).
:::

:::info[Si usted es investigador]
Presupueste la compensación de hablantes como un costo de investigación de primera categoría — las cifras publicadas ($1,475–1,920 para una ronda de validación de métricas; $2,500–6,000 para curación de corpus) son pequeñas según los estándares de subvenciones y son lo que hace que las puntuaciones automatizadas sean defendibles. La [Estrategia de Asociación de Corpus](/docs/network/specifications/corpus-partnership) muestra cómo un departamento académico se integra en esto con trabajo de hablantes financiado incluido.
:::

:::info[Si usted es desarrollador]
Se beneficia del trabajo de hablantes pagados incluso si nunca lo financia: las métricas validadas son lo que hace que su puntuación en la tabla de clasificación sea significativa, y la revisión comunitaria pagada es lo que se interpone entre su método y un premio. Si gana, espere que se haya pagado a los hablantes para escrutar su resultado — y espere que la [propiedad de su método se transfiera](/docs/network/sovereignty/ownership-transfer) a la comunidad cuyo idioma sirve.
:::

## Véase también

- [La traducción no es revitalización](/docs/network/perspectives/translation-is-not-revitalization) — por qué la autoridad del hablante enmarca todo lo demás
- [Reportar errores y asumir correcciones](/docs/network/perspectives/reporting-errors-and-owning-corrections) — autoridad del hablante después del punto de referencia, también
- [Especificación de Referencia §10](/docs/network/specifications/benchmark#10-cost-framework) — el marco de costos completo del que provienen estos números
