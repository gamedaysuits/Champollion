---
sidebar_position: 7
title: "Intensidad de la conexión"
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

Cuando el mapa de la red traza un arco entre dos idiomas, su color responde
a una sola pregunta: **¿se ha medido realmente este par?**

Eso es deliberadamente menos de lo que el mapa solía afirmar. Hasta el 2026-09-04, un arco
se coloreaba mediante una escala de solidez de cinco niveles: qué tan *buena*
era la mejor traducción, en una escala corregida por azar. Dicha escala ha sido retirada. Esta página
explica el número que estaba detrás de ella, por qué eliminarla fue la decisión honesta
y qué indica el mapa ahora.

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

Este problema es real, y es la razón por la cual el mapa **no** clasifica la solidez entre
diferentes idiomas. No es un problema que hayamos resuelto.

## La corrección que desarrollamos y por qué ya no colorea el mapa

**chrF++ corregido por azar (cchrF++)** reescala una puntuación para que 0 signifique "no
mejor que el azar" *en ese idioma* y 1 signifique perfecto:

```
cchrF++ = (chrF++ − floor) / (100 − floor)
```

Los pisos se miden, no se asumen: para cada idioma ejecutamos una estimación
de Montecarlo —miles de líneas base aleatorias con la misma ortografía evaluadas frente a referencias
reales—, utilizando únicamente texto monolingüe disponible públicamente (FLORES-200 dev,
obtenido desde el origen, nunca redistribuido). La tabla de pisos cubre 196
idiomas y es un artefacto derivado de Champollion.

**Lo que esta corrección establece genuinamente.** El piso de azar existe, varía
aproximadamente nueve veces entre sistemas de escritura y puede estimarse a partir de texto monolingüe
sin ninguna etiqueta de calidad humana. Restarlo elimina demostrablemente
el componente de azar de las líneas base triviales: una trampa de copiar la fuente que
obtiene más de 15 puntos brutos en finés cae a cerca de 2.5, y en la mayoría de los idiomas a exactamente
cero. El "azar" que se elimina corresponde a estadísticas superficiales, no a significado residual.

**Lo que no establece.** Hace que **0** signifique lo mismo en cada
idioma. No hace que **40** signifique lo mismo. Por encima del piso, la
corrección es un reescalado directo, y la evidencia de que una *calidad* igual
dé lugar a puntuaciones corregidas iguales entre idiomas solo se demuestra en la
parte inferior del rango. Frente a conjuntos de juicios humanos, ayuda donde los
pisos difieren genuinamente, no hace nada donde no lo hacen, y en un conjunto con
pisos uniformemente bajos desplazó la concordancia con los evaluadores humanos en la dirección *incorrecta* —un
resultado que no hemos resuelto.

Colorear un mapa público con una escala de solidez de cinco niveles afirmaba más de lo que
respaldan esas evidencias, exactamente en los idiomas de bajos recursos donde equivocarse
es más perjudicial. Por lo tanto, la escala se retira hasta que estudios posteriores resuelvan la cuestión.

Tenga en cuenta que colorear según el chrF++ **sin procesar** nunca fue una opción: las puntuaciones
brutas no son comparables entre idiomas en absoluto, razón por la cual se
desarrolló la corrección. Una codificación binaria es la alternativa honesta, no una
degradación hacia algo más débil.

## Dónde se ubica la medición en la jerarquía

De mayor a menor confiabilidad:

1. **Verificación humana** — hablantes fluidos que juzgan los resultados ([validación de hablantes](/docs/network/specifications/speaker-validation)). Nada
   automático la supera.
2. **Anotación de expertos al estilo MQM** ([Multidimensional Quality
   Metrics](https://aclanthology.org/2014.tc-1.6/), Lommel et al.) — el
   protocolo que utiliza WMT para sus evaluaciones de referencia (gold judgments); costoso, poco común y muy bueno.
3. **Puntuaciones automáticas: solo dentro de un mismo par de idiomas.** chrF++ sin procesar, BLEU,
   COMET y los demás son útiles para comparar sistemas en el *mismo* par;
   consulte [Confiabilidad de las métricas](/docs/network/specifications/metric-reliability)
   para ver qué tan deficientemente puede seguir cada una el juicio humano en su par.
4. **Solidez entre idiomas.** No publicamos una clasificación. Consulte más arriba.

A medida que entran resultados verificados por humanos y de grado MQM al
tablero, tienen precedencia sobre puntuaciones automáticas para el mismo par.

## Cómo lo dibuja el mapa

Cada canal visual lleva exactamente un significado:

| Canal | Significado |
|---------|---------|
| **Color** | medido. Un solo color, sin gradiente — el arco indica que una ejecución ha evaluado este par, y no dice nada sobre qué tan bien |
| **Discontinuo + atenuado** | provisional: el conjunto de prueba está por debajo del [piso de significancia](/docs/network/specifications/significance) (n &lt; 100), donde las diferencias de puntuación dentro de ~5 chrF++ son ruido. Esta es una propiedad del tamaño de la muestra, independiente de cualquier métrica |
| **Grosor** | constante. No queda nada más por codificar |

Solo los pares **medidos** trazan un arco medido. Los pares registrados —en cola
para ser medidos pero aún sin puntuar— aparecen como líneas finas de color
plano y tenue cuyo color indica únicamente *cómo es accesible el par hoy en día*
(API comercial · modelo de código abierto · frontera, sin proveedor), nunca qué
tan bien traduce nada. Los dos vocabularios son deliberadamente disjuntos:
hilos planos atenuados = accesibilidad; el único color medido = medido.
La puntuación subyacente de un arco corresponde a la mejor ejecución medida para ese par en la
tabla pública, actualizada automáticamente a medida que llegan nuevas ejecuciones, y se muestra como un
número dentro del par al abrir el arco, nunca como una clasificación entre idiomas.

## La letra pequeña

- Los pisos de azar son propiedades de métrica × ortografía estimadas únicamente
  a partir de texto monolingüe; no se involucra ni se almacena contenido de corpus paralelos.
- El atlas de pisos y la corrección siguen siendo investigaciones publicadas, y el código
  permanece en el repositorio bajo pruebas. No están conectados a ninguna superficie pública.
- **Corrige el piso, no el techo.** La puntuación máxima que puede alcanzar una traducción genuinamente
  buena sigue variando según el idioma, y la corrección no hace nada al respecto.
- **No es una defensa contra la copia con escritura compartida.** Un resultado que simplemente
  copia la fuente aún puede puntuar por encima del azar cuando la fuente y el destino comparten
  un mismo sistema de escritura.
- **No puede reordenar sistemas dentro de un mismo par de idiomas.** Por encima del piso, la
  corrección es un reescalado directo, por lo que las clasificaciones dentro del par son idénticas
  antes y después; su único valor posible era entre pares.
- Un arco medido le indica que un par ha sido evaluado. **No** valida
  el significado, el registro ni la adecuación cultural. Esos siguen siendo juicios humanos ([limitaciones
  honestas](/docs/network/honest-limitations)).
- La metodología de pisos de azar es una investigación de Champollion, publicada aquí
  precisamente para que pueda verificarse y cuestionarse.
