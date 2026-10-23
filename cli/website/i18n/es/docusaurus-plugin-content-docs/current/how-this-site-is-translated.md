---
id: how-this-site-is-translated
title: "Cómo se traduce este sitio"
description: "Cada locale en este sitio es traducido automáticamente por el propio Champollion — la misma CLI que describe esta documentación. Usamos nuestra propia herramienta."
---

# Cómo se traduce este sitio

Cada configuración regional de este sitio, excepto el inglés —las que figuran en la tabla a continuación—, está
**traducida automáticamente por el propio Champollion** —el mismo CLI que describe esta
documentación (`npx champollion sync`)—. Usamos nuestra propia herramienta.

En este momento, cada par de idiomas utiliza un solo modelo:
**`google/gemini-3.8-flash`** —el valor predeterminado del propio CLI— con temperatura 0,
traduciendo con la guía de registro y terminología de cada idioma que se describe
más abajo. (Hasta el 2026-10-06, el sitio utilizaba
`google/gemini-3.1-pro-preview`). Elegimos un solo modelo de manera deliberada como un
valor predeterminado honesto mientras reconstruimos nuestra selección de modelos basada en evaluaciones comparativas (consulte
más abajo); así que esta es una elección sencilla y documentada, no un resultado que intentemos maquillar
como algo que no es.

Dos cosas que debe saber como lector:

1. **Estas páginas son traducciones automáticas.** Se producen con el
   registro y la guía de terminología que se describen a continuación, pero ningún humano revisó
   cada oración. Si algo se lee mal, la versión en inglés es
   la autoritativa, y nos encantaría recibir una corrección.
2. **El modelo es un valor predeterminado hoy, elegido por benchmark mañana.**
   El diseño de Champollion consiste en elegir el modelo de traducción *para cada par
   de idiomas* mediante un benchmark: calificar a cada candidato en un corpus de desarrollo y
   traducir esa configuración regional con el método de mayor puntuación (los empates estadísticos
   se rompen por costo). Estamos volviendo a ejecutar esa selección a través de nuestra propia
   puerta de integridad antes de fijar a los ganadores por par aquí. **Hasta que esas ejecuciones
   se publiquen en la [tabla de clasificación de la Red](/leaderboard), esta página no
   afirmará una procedencia de benchmark que no pueda mostrarle.**

## Procedencia por configuración regional

| Configuración regional | Idioma | Método | Modelo | Registro | Última sincronización |
|------------------------|--------|--------|--------|----------|-----------------------|
| fr | Français | llm | `google/gemini-3.8-flash` | *vous* formal | 2026-10-12 |
| de | Deutsch | llm | `google/gemini-3.8-flash` | forma *Sie* | 2026-10-12 |
| nl | Nederlands | llm | `google/gemini-3.8-flash` | forma *u* | 2026-10-12 |
| fil | Filipino | llm | `google/gemini-3.8-flash` | formal | 2026-10-12 |
| es | Español | llm | `google/gemini-3.8-flash` | latinoamericano neutro | 2026-10-12 |
| zh | 简体中文 | llm | `google/gemini-3.8-flash` | técnico profesional | 2026-10-12 |
| ja | 日本語 | llm | `google/gemini-3.8-flash` | です/ます (cortés) | 2026-10-12 |
| ko | 한국어 | llm | `google/gemini-3.8-flash` | 해요체 (cortés) | 2026-10-12 |
| pt | Português | llm | `google/gemini-3.8-flash` | profesional | 2026-10-12 |
| th | ไทย | llm | `google/gemini-3.8-flash` | profesional neutro | 2026-10-12 |
| vi | Tiếng Việt | llm | `google/gemini-3.8-flash` | forma *bạn* neutra | 2026-10-12 |
| ar | العربية | llm | `google/gemini-3.8-flash` | MSA, profesional | 2026-10-12 |

## La selección de benchmark que estamos reconstruiendo

El método previsto —y la forma en que está estructurada la configuración para funcionar— es
la selección de modelos por par basada en nuestra propia evaluación: calificar cada
modelo candidato en el corpus de desarrollo del par, tomar el modelo con el
chrF++ más alto y, cuando una prueba de significancia pareada no pueda separar a dos
candidatos, tomar el más económico. El ciclo completo está
documentado para cualquiera que desee reproducirlo.

Hoy **no** publicamos puntuaciones ni un "ganador de benchmark" por
idioma en esta página, ya que el barrido de selección que respaldaría
esos números se está ejecutando nuevamente a través del filtro de integridad del harness primero.
Cuando esté listo, las ejecuciones estarán en la tabla de clasificación pública, esta tabla
mostrará el modelo ganador de cada par con su ejecución citada, y la configuración del sitio
volverá a fijar los ganadores por par. Hasta entonces: un único valor predeterminado honesto.

Network califica las ejecuciones de la forma estándar: chrF++ a nivel de corpus con su
intervalo de confianza bootstrap del 95 % y firma de sacreBLEU, otras métricas
estándar junto a este y diagnósticos reportados por separado
([Cómo se califican las ejecuciones](/docs/network/specifications/scoring#how-runs-are-scored)).
Las puntuaciones solo son comparables **dentro de un par de idiomas y conjunto de evaluación**,
nunca entre pares; las diferencias de sistema de escritura y de corpus hacen que la comparación
entre pares carezca de sentido.

## Registro y tono

Cada idioma se traduce con un registro explícito elegido de
las tarjetas de idioma de Champollion, por lo que la formalidad es consistente en todo el sitio:

- **Français** — vouvoiement (*vous* formal)
- **Deutsch** — Sie-Form
- **Nederlands** — u-vorm
- **Filipino** — formal, con términos técnicos estándar
- **Español** — español latinoamericano neutral
- **简体中文** — registro técnico profesional
- **日本語** — です/ます (forma cortés)
- **한국어** — 해요체 (cortés)
- **Português** — registro profesional
- **ไทย** — profesional neutral
- **Tiếng Việt** — forma *bạn* neutral
- **العربية** — árabe estándar moderno, registro profesional

## Qué no se traduce automáticamente

Los bloques de código, los comandos de la CLI, las claves de configuración, los nombres de paquetes, las URL y
los nombres propios están protegidos durante la traducción y permanecen en inglés por
diseño.

## ¿Encontró un error de traducción?

Abra un issue o un PR: la fuente de cada página traducida es el original
en inglés. Las correcciones a una página traducida se conservan en futuras sincronizaciones siempre
que la fuente en inglés de esa página no cambie (la sincronización vuelve a traducir una
página solo cuando cambia su fuente en inglés).

*Esta página en sí está traducida automáticamente por el método descrito anteriormente;
describe su propia traducción.*
