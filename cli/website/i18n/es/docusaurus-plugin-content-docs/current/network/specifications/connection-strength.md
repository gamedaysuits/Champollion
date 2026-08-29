---
sidebar_position: 7
title: "Fortaleza de Conexión (cchrF++)"
slug: '/network/specifications/connection-strength'
related:
  - label: "Scoring Specification"
    to: /docs/network/specifications/scoring
    kind: spec
    note: "How individual runs are scored"
  - label: "Metric Reliability"
    to: /docs/network/specifications/metric-reliability
    kind: spec
    note: "How well each metric tracks human judgment, per language pair"
  - label: "Statistical Significance Testing"
    to: /docs/network/specifications/significance
    kind: spec
---

# Fortaleza de la conexión

Cuando el mapa de red traza un arco entre dos idiomas, su color responde
una pregunta: **¿qué tan buena es la mejor traducción medida entre ellos —
honestamente?**

La parte honesta es más difícil de lo que parece. Esta página explica, en
lenguaje claro, el número detrás del color.

## El problema: las puntuaciones brutas no son cero en cero

La mayoría de nuestras puntuaciones son **chrF++** (puntuación F de n-gramas
de caracteres, [Popović 2017](https://aclanthology.org/W17-4770/)) — mide
cuánto se superponen los caracteres y palabras de una traducción con una
traducción de referencia, de 0 a 100.

Pero *el texto aleatorio no es cero*. Cada sistema de escritura proporciona
cierta superposición "de forma gratuita": una ortografía con pocos caracteres
distintos, o palabras largas predecibles, obtiene puntuaciones mediblemente
superiores a cero incluso cuando la "traducción" es sin sentido. Esa
superposición gratuita — el **piso de probabilidad** — difiere según el
idioma. En nuestras mediciones oscila entre aproximadamente 1,6 (escritura
china) y más de 13 (algunos idiomas con escritura latina y árabe). Un chrF++
bruto de 14 es ruido casi aleatorio en un idioma y una señal real en otro —
por lo que chrF++ bruto **no es comparable entre idiomas**, y un mapa coloreado
por él favorecería silenciosamente algunos sistemas de escritura.

## La solución: restar el piso

**chrF++ corregido por probabilidad (cchrF++)** reescala la puntuación para
que 0 signifique "no mejor que el azar" *en ese idioma* y 1 signifique
perfecto:

```
cchrF++ = (chrF++ − floor) / (100 − floor)
```

Los pisos se miden, no se asumen: para cada idioma ejecutamos una estimación
de Monte-Carlo — miles de líneas de base aleatorias de la misma ortografía
puntuadas contra referencias reales — utilizando solo texto monolingüe
disponible públicamente (FLORES-200 dev, obtenido de la fuente, nunca
redistribuido). La tabla de pisos actualmente cubre 196 idiomas y es un
artefacto derivado de Champollion
(`champollion-derived` procedencia; regenerado por
`cli/website/scripts/build-cchrf-floors.mjs`).

Dos reglas conservadoras mantienen la corrección honesta:

- **Un par se corrige solo cuando AMBOS lados tienen un piso medido.** Si
  falta alguno, el arco se muestra en pizarra neutral — *medido, piso
  desconocido* — y nunca recorre la rampa de color.
- **El par utiliza el MAYOR de los dos pisos.** La corrección puede
  subestimar la fortaleza, nunca inflarla.

## Dónde se sitúa cchrF++ en la jerarquía

cchrF++ es nuestra mejor medida de fortaleza *automática* — no es la cúspide
de la jerarquía. De más a menos confiable:

1. **Verificación humana** — hablantes fluidos juzgando el resultado
   ([validación de hablantes](/docs/network/specifications/speaker-validation)).
   Nada automático la supera.
2. **Anotación de expertos al estilo MQM** ([Métricas de Calidad
   Multidimensional](https://aclanthology.org/2014.tc-1.6/), Lommel et al.)
   — el protocolo que WMT utiliza para sus juicios de oro; costoso, raro,
   muy bueno.
3. **cchrF++** — corregido por probabilidad, comparable entre idiomas,
   económico de calcular en todas partes.
4. **chrF++ bruto / BLEU / métricas neuronales** — útiles dentro de un
   conjunto de datos; consulte [Confiabilidad de métricas](/docs/network/specifications/metric-reliability)
   para ver qué tan mal puede cada una rastrear el juicio humano en su par.

A medida que entran resultados verificados por humanos y de grado MQM al
tablero, tienen precedencia sobre puntuaciones automáticas para el mismo par.

## Cómo lo dibuja el mapa

Cada canal visual lleva exactamente un significado:

| Canal | Significado |
|---------|---------|
| **Color** | banda cchrF++ — cinco pasos, rojo a verde suave: *cerca del piso* (&lt; 0,15), *débil* (0,15–0,35), *en desarrollo* (0,35–0,55), *utilizable* (0,55–0,75), *fuerte* (≥ 0,75) |
| **Pizarra neutral** | medido, pero el piso de probabilidad es desconocido para al menos un lado — nunca colocado en la rampa de color |
| **Punteado + atenuado** | provisional: el conjunto de prueba está por debajo del [piso de significancia](/docs/network/specifications/significance) (n &lt; 100), donde las brechas de puntuación dentro de ~5 chrF++ son ruido |
| **Ancho** | repite la banda de color (redundancia de accesibilidad, no una segunda variable) |

Solo los pares **medidos** recorren la rampa de fortaleza. Los pares
registrados — en cola para medición pero aún no puntuados — aparecen como
hilos planos de color tenue cuyo color solo dice *cómo el par es alcanzable
hoy* (API comercial · modelo de código abierto · frontera, sin proveedor),
nunca qué tan bien traduce algo. Los dos vocabularios son deliberadamente
disjuntos: hilos planos silenciados = alcanzabilidad, la rampa rojo→verde =
fortaleza medida. La puntuación subyacente de un arco es la mejor ejecución
medida para ese par en el tablero público, actualizada automáticamente a
medida que llegan nuevas ejecuciones.

## La letra pequeña

- Los pisos son propiedades de métrica × ortografía estimadas solo a partir
  de texto monolingüe; no se involucra ni se almacena contenido de corpus
  paralelo.
- cchrF++ le dice que una traducción supera el azar y por cuánto — **no**
  valida significado, registro o adecuación cultural. Esos siguen siendo
  juicios humanos ([limitaciones honestas](/docs/network/honest-limitations)).
- La metodología del piso de probabilidad es investigación de Champollion;
  el atlas de pisos y la corrección se publican aquí precisamente para que
  puedan ser verificados y cuestionados.
