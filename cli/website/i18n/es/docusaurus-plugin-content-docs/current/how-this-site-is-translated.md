---
id: how-this-site-is-translated
title: "Cómo se traduce este sitio"
description: "Cada locale en este sitio es traducido automáticamente por el propio Champollion — la misma CLI que describe esta documentación. Usamos nuestra propia herramienta."
---

# Cómo se traduce este sitio

Este sitio está disponible en 13 idiomas. Cada configuración regional, excepto el inglés, es
**traducida automáticamente por el propio Champollion**, la misma CLI que esta documentación
describe (`npx champollion sync`). Usamos nuestra propia herramienta.

En este momento, cada par de idiomas utiliza un único modelo:
**`google/gemini-3.1-pro-preview`**, que traduce con el registro
y la guía de terminología por idioma que se describen a continuación. Elegimos un modelo
deliberadamente como un valor predeterminado honesto mientras reconstruimos nuestra selección de modelos
basada en benchmarks (véase más abajo); por lo tanto, esta es una elección simple y documentada, no un
resultado que estemos disfrazando de algo que no es.

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
|--------|----------|--------|-------|----------|-------------|
| fr | Français | llm | `google/gemini-3.1-pro-preview` | *vous* formal | 2026-07-18 |
| de | Deutsch | llm | `google/gemini-3.1-pro-preview` | Sie-Form | 2026-07-18 |
| nl | Nederlands | llm | `google/gemini-3.1-pro-preview` | u-vorm | 2026-07-18 |
| fil | Filipino | llm | `google/gemini-3.1-pro-preview` | formal | 2026-07-18 |
| es | Español | llm | `google/gemini-3.1-pro-preview` | latinoamericano neutral | 2026-07-18 |
| zh | 简体中文 | llm | `google/gemini-3.1-pro-preview` | técnico profesional | 2026-07-18 |
| ja | 日本語 | llm | `google/gemini-3.1-pro-preview` | です/ます (cortés) | 2026-07-18 |
| ko | 한국어 | llm | `google/gemini-3.1-pro-preview` | 해요체 (cortés) | 2026-07-18 |
| pt | Português | llm | `google/gemini-3.1-pro-preview` | profesional | 2026-07-18 |
| th | ไทย | llm | `google/gemini-3.1-pro-preview` | profesional neutral | 2026-07-18 |
| vi | Tiếng Việt | llm | `google/gemini-3.1-pro-preview` | forma *bạn* neutral | 2026-07-18 |
| ar | العربية | llm | `google/gemini-3.1-pro-preview` | MSA, profesional | 2026-07-18 |

## La selección de benchmark que estamos reconstruiendo

El método previsto, y cómo está estructurada la configuración para funcionar, es
la selección de modelos por par impulsada por nuestra propia evaluación: calificar a cada
modelo candidato en el corpus de desarrollo del par, tomar la puntuación
compuesta más alta y romper los empates estadísticos por costo. El ciclo completo está
documentado para cualquiera que desee reproducirlo.

**No** estamos publicando puntuaciones compuestas ni un "ganador del benchmark" por
idioma en esta página hoy, porque el barrido de selección que respaldaría
esos números se está volviendo a ejecutar primero a través de la puerta de integridad del entorno de pruebas.
Cuando esté listo, las ejecuciones estarán en la tabla de clasificación pública, esta tabla
mostrará el modelo ganador de cada par con su ejecución citada, y la configuración del sitio
volverá a fijar a los ganadores por par. Hasta entonces: un valor predeterminado honesto.

La *puntuación compuesta* es la métrica de calidad combinada de la Red (chrF++, coincidencia
exacta y complementos de métricas cargados, verificados por bootstrap-CI). Las puntuaciones solo son
comparables **dentro de un par de idiomas**, nunca entre pares; las diferencias de escritura y
corpus hacen que la comparación entre pares carezca de sentido.

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
