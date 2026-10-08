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

Así que la primera regla es simple: **a los hablantes se les paga por su tiempo, a tarifas profesionales, sin importar lo que muestren los resultados**, una vez que este trabajo cuente con financiamiento. Hoy en día no se dispone de fondos, por lo que no hay trabajo de hablantes en curso.

---

## Por qué pagar a los hablantes es innegociable

La investigación en tecnología del lenguaje tiene una larga costumbre de tratar a los hablantes fluidos como un recurso gratuito — "participación comunitaria" que produce conjuntos de datos, artículos y carreras para todos excepto para los hablantes. Consideramos ese patrón extractivo, y las personas más calificadas para hacer este trabajo son precisamente aquellas cuyo tiempo ya está reclamado por el trabajo urgente de enseñar, traducir y criar hijos en la lengua.

Tres consecuencias de diseño se derivan de esto:

1. **Sin esquemas de voluntariado.** No pedimos a los hablantes que donen trabajo de evaluación como un favor a la investigación. La participación es un compromiso remunerado, y rechazarla no le cuesta nada al hablante.
2. **El pago es incondicional.** Se pagará a los hablantes independientemente de si sus calificaciones se utilizan o no, y el pago no está sujeto a los resultados. El protocolo publicado establece el compromiso de pagar dentro de las dos semanas posteriores a la finalización de cada bloque de tareas.
3. **La compensación no lo es todo.** Los hablantes que aportan calificaciones también reciben crédito (con su nombre o de forma anónima, según elijan), la opción de coautoría en publicaciones que utilicen sus calificaciones, el derecho a retirar sus contribuciones en cualquier momento y poder de veto sobre la publicación de resultados que consideren problemáticos. Esos términos se encuentran en el [Protocolo de validación por hablantes §5–6](/docs/network/specifications/speaker-validation), no en un anexo secundario.

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

Ningún premio se paga basándose únicamente en puntuaciones automatizadas. El [Premio del Fundador](/docs/network/specifications/prizes) propuesto ($10,000 CAD, inglés→cree de las llanuras; convocatoria aún no abierta y sin fondos asignados) requeriría que al menos dos hablantes bilingües revisen de forma independiente una muestra estratificada de al menos 30 resultados, y que el 70% o más se califique como "aceptable" o "excelente". Esa revisión es trabajo remunerado para los hablantes bajo las mismas tarifas, y también actúa como un filtro decisivo: los hablantes pueden descartar una reclamación de premio, y eso es intencional.

## Cómo escala con concursos

El modelo está construido para que la compensación de hablantes crezca con la plataforma en lugar de ser diluida por ella:

- **Cada nuevo idioma comienza con un compromiso de corpus pagado.** El costo de establecimiento publicado por idioma ($3,350–8,500 todo incluido) es principalmente compensación de hablantes — el componente individual más grande, deliberadamente.
- **Cada nuevo fondo de premios trae su propia revisión pagada.** Cada concurso patrocinado que sigue la [plantilla de premios](/docs/network/specifications/prizes#4-future-prize-pools) lleva el mismo requisito de validación comunitaria, lo que significa que cada concurso financia trabajo de revisión de hablantes para ese idioma.
- **Los métodos de propiedad comunitaria permanecen como activos financiados por la comunidad.** Un método transferido pertenece a la organización de gobernanza completamente — cualquier cosa que gane al implementarlo es enteramente de la comunidad ([Cómo se financia el trabajo](/docs/network/sovereignty/economic-model)), disponible para revisión continua, crecimiento de corpus y programas de idioma según lo considere conveniente. Esa asignación es decisión de la comunidad, no la nuestra.

## Lo que *no* hemos prometido

La honestidad requiere marcar los bordes:

- Las tarifas anteriores son las que pretendemos pagar por el trabajo en cree de las llanuras una vez que cuente con financiamiento; hoy en día dicho trabajo no está financiado ni en curso. Las tarifas para idiomas futuros se definirán con la comunidad asociada y se publicarán de la misma manera: en las especificaciones, antes de que comience el trabajo.
- Champollion no es comercial, no genera ingresos propios y actualmente está **autofinanciado por su fundador**; los fondos de subvenciones y patrocinadores son lo que estamos buscando, no lo que tenemos. [Cómo se financia el trabajo](/docs/network/sovereignty/economic-model) describe el mecanismo, no una garantía.
- "Pagar justamente" es necesario pero no suficiente. El pago por sí solo no hace que un proyecto deje de ser extractivo; la titularidad y el control sí lo hacen, razón por la cual la compensación forma parte del [modelo de custodia](/docs/network/sovereignty/data-sovereignty) en lugar de reemplazarlo.

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
