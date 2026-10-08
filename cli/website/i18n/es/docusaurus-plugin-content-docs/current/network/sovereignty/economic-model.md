---
sidebar_position: 3
title: "Cómo se financia el trabajo"
---

# Cómo se financia el trabajo

> **Resumen ejecutivo.** Champollion es un proyecto de investigación no comercial —
> con código disponible y gratuito para uso no comercial, con su entorno de evaluación y
> registros de código abierto— y hoy está **totalmente autofinanciado por su
> fundador**. Sin subvenciones,
> sin patrocinadores ni instituciones detrás; al menos por ahora: actualmente [invitamos
> activamente a patrocinadores](/get-involved#sponsors). Cualquier patrocinio sería
> **100 % de transferencia directa**: financiaría la creación de corpus, herramientas y
> trabajo comunitario a tarifas publicadas y con rendición de cuentas pública; nada de ello
> para Champollion. No se ha recibido ninguno y hoy no se retiene ningún fondo.
> Nada aquí está monetizado: no hay API de pago, ni medición por uso, ni reparto
> de ingresos, ni reclamos de la plataforma sobre nada que pertenezca a una comunidad. Esta página explica
> con claridad de dónde proviene el dinero ahora, qué se financiaría con los fondos y cómo
> contactarnos si usted desea cambiar la primera parte.

Champollion es un conjunto de herramientas de investigación y desarrollo para traducción
automática, con código disponible y gratuito para uso no comercial. La CLI, el servidor MCP
y la suite de entrenamiento de modelos (nmt-forge) tienen licencia PolyForm Noncommercial 1.0.0;
el entorno de evaluación es de código abierto AGPL-3.0-or-later; los registros
de datos son de código abierto Apache-2.0. [Quién puede usar esto](/docs/getting-started/who-may-use-this)
explica qué cubre cada licencia, en palabras sencillas. No hay ningún producto
comercial detrás de ellos, y por ahora tampoco hay financiamiento.

## De dónde viene el dinero hoy

**Una persona.** Todo lo construido hasta ahora — el arnés, la CLI, el índice de idiomas, las especificaciones de referencia, el sitio — ha sido autofinanciado por el fundador del proyecto. Decimos esto claramente por dos razones:

1. **Honestidad sobre la escala.** Un proyecto autofinanciado aún no puede pagar la construcción de corpus y validación de hablantes que cuestan las especificaciones. Las tasas publicadas son compromisos sobre *cómo* se mueve el dinero cuando existe, no evidencia de que ya se esté moviendo.
2. **Es una invitación abierta.** La infraestructura está construida y los costos unitarios están publicados. Lo que falta es la financiación para ejecutarla. Si usted financia tecnología de idiomas — como agencia de subvenciones, fundación, departamento, o individuo — **queremos escuchar de usted**: abra un problema en [GitHub](https://github.com/gamedaysuits/Champollion) o comuníquese a través de [champollion.dev](https://champollion.dev).

## Qué compra la financiación

Los costos ya están especificados, así que un financiador puede comprar cosas concretas y acotadas:

- **Un compromiso de corpus para un idioma** — $2,500–6,000 en compensación de hablantes ($50–65 CAD/hora, tasas publicadas) construye un corpus de referencia que permanece como propiedad del constructor. Vea [Cómo se paga a los hablantes](/docs/network/perspectives/how-speakers-get-paid).
- **Una ronda de validación de métricas** — $1,475–1,920 paga a tres hablantes bilingües para verificar las métricas automatizadas contra el juicio humano.
- **Un premio patrocinado** — financie una barra específica (por ejemplo, inglés → Plains Cree confiable). Los fondos del premio se mantienen y se otorgan mediante un fideicomiso gobernado por la comunidad, en los términos de la comunidad — no por Champollion. Vea la [Especificación de premios](/docs/network/specifications/prizes).
- **Créditos de computación y API** — agrupados para ejecutar la cola de referencia pública.

En la práctica, esto convierte la Red en un mecanismo de distribución de financiación para trabajo de datos de idiomas: dinero entra, trabajo pagado para las personas que construyen corpus sale — y ellas conservan lo que construyen.

## A dónde va el dinero

Una vez que lo haya —hoy no se retiene ningún fondo—:

- **A constructores y validadores de corpus, a tasas publicadas.** El pago no transfiere propiedad: un constructor es pagado por el trabajo *y* sigue siendo el administrador del corpus.
- **A ganadores de premios, a través de fideicomisos comunitarios.** Cuando se reclama un premio patrocinado, el fideicomiso paga al desarrollador; el método se transfiere a la comunidad bajo los términos de ese premio (vea [Propiedad y términos](/docs/network/sovereignty/ownership-transfer)).
- **A infraestructura** — alojamiento, ejecuciones de evaluación, y mantenimiento.
- **Contabilizado públicamente.** Los compromisos patrocinados se registran abiertamente — qué se financió, a qué tasa publicada, y qué se entregó — para que un patrocinador (y todos los demás) puedan auditar que la promesa de transferencia directa se cumplió.

## Lo que Champollion toma

**Nada.** No hay división de ingresos, no hay porcentaje de infraestructura, y no hay reclamación sobre activos comunitarios. Si una comunidad despliega un método que posee — en sus propios servidores, a través de sus propios canales, comercialmente o no — todo lo que gana es suyo. Los corpus registrados con la Red permanecen como propiedad del administrador completamente, antes, durante, y después de cualquier evaluación.

Si alguna vez surgen oportunidades comerciales alrededor de este trabajo, estamos abiertos a esa conversación — pero cualquier arreglo de este tipo se negociaría en ese momento, con los administradores cuyos datos o métodos estén involucrados, en sus términos. Nada está precomprometido en estos documentos, y ningún documento aquí debe leerse como reservando una parte de nada para la plataforma.

## Para financiadores

La pregunta de sostenibilidad para la tecnología de idiomas es generalmente "¿qué sucede cuando termina la subvención?" Para un proyecto sin fines comerciales, la respuesta honesta es: los *activos* sobreviven a la financiación, porque son propiedad de las personas que pueden mantenerlos.

| Modelo tradicional | Modelo de administración |
|---|---|
| La subvención financia investigación | La subvención financia investigación |
| Artículo publicado | Corpus construido, métodos medidos |
| La subvención termina, herramienta abandonada | La comunidad posee el corpus y cualquier método transferido completamente |
| La comunidad no recibe nada | Los hablantes fueron pagados por cada hora; los activos permanecen en casa |

Resultados medibles para un financiador:

- Corpus construidos y registrados, bajo control del administrador
- Horas de hablantes pagadas entregadas a comunidades de idiomas
- Métodos medidos, y (donde los términos de un premio lo digan) transferidos a propiedad comunitaria
- Pares de idiomas cubiertos por referencias públicas confiables

Vea la [Especificación de referencia](/docs/network/specifications/benchmark), §10 para modelos de costos detallados.

## Consulte también

- [Propiedad y términos](/docs/network/sovereignty/ownership-transfer) — términos por idioma y plantilla de transferencia
- [Administración de datos](/docs/network/sovereignty/data-sovereignty) — la posición que implementa este modelo
- [Cómo se paga a los hablantes](/docs/network/perspectives/how-speakers-get-paid) — tasas publicadas
