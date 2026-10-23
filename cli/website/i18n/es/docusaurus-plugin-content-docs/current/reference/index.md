---
title: "Referencia"
slug: /reference
description: "Cada detalle técnico en un solo mapa: los comandos, los formatos de archivo, las especificaciones, los límites técnicos, el alojamiento de una prueba sellada, la tabla de clasificación, la traducción de aplicaciones y sitios, el Atlas y la infraestructura de red."
---

# Referencia

El registro técnico completo, para desarrolladores, investigadores y agentes de IA.
Las [páginas para personas](/docs/) cuentan la misma historia en palabras sencillas, y
[el manual para agentes](/docs/agents) explica cómo lo maneja un agente; cada página
a continuación lo expone con total precisión.

## Comandos

- [`champollion`](/docs/reference/cli) — cada comando y flag de la herramienta
  de proyectos y del traductor de aplicaciones y sitios.
- [`nmt-forge`](/docs/network/getting-started/forge-command-reference) — cada
  comando de la suite de entrenamiento de modelos, generado a partir de su analizador.
- [`mt-eval`](/docs/reference/mt-eval) — cada comando del entorno de evaluación,
  generado a partir de su analizador.
- [El servidor MCP](/docs/network/getting-started/mcp-server) — ambos perfiles,
  cada herramienta y cada argumento.

## Formatos

- [Formatos del framework](/docs/reference/formats) — project/1, set/1, method/1,
  gate-chain/1, deployment/1 y service-api/1, a partir de sus esquemas.
- [Tarjeta de ejecución](/docs/network/specifications/run-card) — lo que registra
  y publica una ejecución calificada.
- [Datos de orientación](/docs/concepts/coaching-data) — las notas gramaticales y listas
  de palabras que recibe un método de LLM.
- [Especificación de plugins](/docs/reference/plugin-spec) — el manifiesto
  de plugin de método (`method.json`) con el que se distribuye un método de traducción.
- [Ficha de lengua](/docs/reference/language-card-spec) — el esquema de una ficha
  en el Atlas.

## Especificaciones

- [Puntuación](/docs/network/specifications/scoring) — scoring standard/1: el
  chrF++ principal del corpus con su intervalo bootstrap del 95 %, las métricas estándar
  junto a él y los diagnósticos por separado.
- [Significancia](/docs/network/specifications/significance) — pruebas pareadas
  y cuándo una ejecución es mejor que otra.
- [Interfaz de método](/docs/network/specifications/methods) — qué es un método,
  sus clases y dependencias.
- [Confiabilidad de métricas](/docs/network/specifications/metric-reliability) —
  en qué métrica confiar para qué tipo de lengua, a partir de juicios humanos.
- [Benchmark](/docs/network/specifications/benchmark) — el protocolo que sigue
  cada ejecución válida.
- [Entorno de evaluación](/docs/network/specifications/harness) — cómo `mt-eval`
  ejecuta, califica y publica.
- [Validación por hablantes](/docs/network/specifications/speaker-validation) — la
  revisión humana a la que sustituyen las puntuaciones automáticas.

## Límites técnicos

- [Límites técnicos](/docs/network/honest-limitations) — lo que no se afirma:
  niveles de confianza autodeclarados, aún sin revisión por hablantes, custodia de pruebas selladas y sin
  confianza por oración.

## Alojar una prueba sellada

- [Ejecutar un concurso soberano](/docs/network/sovereignty/run-a-sovereign-contest)
  — la guía operativa integral para un conjunto de prueba que nunca sale de la máquina del anfitrión.
- [Nodo de evaluación soberano](/docs/network/sovereignty/sovereign-eval-node) — la
  máquina de puntuación: hardware, aislamiento físico y ceremonia de claves.
- [Registrar corpus](/docs/network/sovereignty/registering-corpora) —
  niveles de exposición y carriles de licencia para un corpus que usted posea.
- [Propiedad y términos](/docs/network/sovereignty/ownership-transfer) y
  [Plantillas de términos](/docs/network/sovereignty/terms-templates) — lo que cede
  una postulación, declarado antes de que alguien participe.
- [Premios](/docs/network/specifications/prizes) — lo que requiere un premio, si un
  patrocinador abre uno.

## Tabla de clasificación y publicación

- [Tabla de clasificación y publicación](/docs/reference/leaderboard) — qué es
  la tabla, los dos tipos de benchmark y qué contiene una ejecución publicada.
- [Reglas de envío](/docs/network/leaderboard/rules) — qué se acepta,
  qué se descalifica y los niveles de verificación.
- [Conjuntos de datos de evaluación](/docs/network/leaderboard/datasets) — los conjuntos
  de datos registrados y sus carriles de licencia.
- [Enviar un método](/docs/network/getting-started/submit-a-method) — ejecute el
  entorno de evaluación y publique una tarjeta de ejecución.
- [Contribuir con cómputo](/docs/network/getting-started/contributing-compute) —
  ejecute elementos de la cola pública con su propia clave.
- [Preguntas frecuentes](/docs/network/getting-started/faq) — métricas, modelos, FST
  y descalificación.

## Traducción de aplicaciones y sitios

- [Traducción de aplicaciones y sitios](/docs/intro) — qué hace `champollion sync` y
  una guía para cada página al respecto: inicio rápido, instalación, configuración,
  frameworks, CI/CD, métodos, contenido, memoria de traducción, control de calidad,
  seguridad, scripts, traductores y solución de problemas.

## El Atlas

- [El Atlas](/docs/atlas) — qué es el índice de lenguas y de dónde provienen
  sus datos.
- [Especificación de fichas de lengua](/docs/reference/language-card-spec) y el
  [procedimiento de citación](/docs/reference/language-card-citation-procedure) —
  cada campo y cómo se cita cada uno.
- [Qué cuenta como una lengua](/docs/network/context/what-counts-as-a-language)
  — las respuestas que ofrece el índice y por qué.
- [Enviar al índice](/docs/network/getting-started/submit-to-the-index) y
  [Reportar errores](/docs/network/perspectives/reporting-errors-and-owning-corrections)
  — proponer una entrada o una corrección.

## Infraestructura de la red

- [Construcción de la cola](/docs/network/specifications/queue-construction) y
  [por qué la cola está construida de esta manera](/docs/network/perspectives/why-the-queue)
  — cómo la cola de trabajo pública prioriza qué medir a continuación.
- [Fuerza de conexión](/docs/network/specifications/connection-strength) —
  lo que dice un arco en el mapa de la red sobre un par y la rampa de fuerza
  que se retiró.
- [Contribuir con cómputo](/docs/network/getting-started/contributing-compute) —
  ejecutar la cola.
