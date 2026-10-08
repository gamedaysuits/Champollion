---
sidebar_position: 5
title: "Por qué la Cola está Construida de Esta Manera"
slug: '/network/perspectives/why-the-queue'
description: "La filosofía detrás de la cola de cómputo comunitario: los tokens donados son un presupuesto, la malla es la misión, y una lista de prioridades es un conjunto de creencias que debe estar documentado, ser criticable y falsable."
related:
  - label: "Queue Construction Specification"
    to: /docs/network/specifications/queue-construction
    kind: spec
    note: "The formula this philosophy commits us to"
  - label: "Contributing Compute"
    to: /docs/network/getting-started/contributing-compute
    kind: guide
  - label: "Corpus Design Framework"
    to: /docs/network/specifications/corpus-design
    kind: spec
---

# Por qué la Cola está Construida de Esta Manera

La cola es el artefacto editorial más importante que publicamos.
Cada elemento en ella dice: *si está dispuesto a gastar algunos centavos de
crédito de API en traducción automática de bajo recurso, este es el mejor lugar
que conocemos para gastarlo.* Esa oración conlleva obligaciones. Esta página trata
sobre cuáles son y cómo la
[fórmula de construcción de la cola](/docs/network/specifications/queue-construction)
las cumple.

## Una lista de prioridades es un conjunto de creencias

Cualquier ordenamiento del trabajo codifica respuestas a tres preguntas, ya sea que
alguien las haya escrito o no:

1. **¿Qué valoramos?** ¿Cuál es el valor real de una ejecución completada?
2. **¿Qué creemos?** ¿Qué esperamos que suceda cuando se ejecute una ejecución
   que aún no hemos probado?
3. **¿Qué admitimos que no sabemos?** ¿Dónde debería la curiosidad
   superar la predicción?

La mayoría de las colas de referencia responden estas preguntas implícitamente — "mayor brecha primero,"
"modelo más nuevo primero," la hoja de cálculo de alguien. Creemos que un proyecto que pide
a extraños que gasten dinero merece respuestas explícitas, en una fórmula
que cualquiera pueda recomputar, con cada entrada publicada. No porque las fórmulas
sean neutrales — no lo son, la nuestra codifica nuestra misión y nuestras intuiciones —
sino porque **un sesgo escrito puede ser cuestionado, y uno no escrito no puede.**

## Lo que valoramos: cadenas, no casillas de verificación

Nuestra misión es *cada idioma hacia cada idioma mediante cadenas de pares medidas
individualmente*. La infraestructura de traducción mundial es
céntrica en inglés; la nuestra comenzó así también — una estrella de
puntos de referencia eng→X. Pero una estrella solo mide una cosa: distancia desde
el inglés. Los idiomas del mundo merecen una *malla*: cuando no existe
un punto de referencia directo entre dos idiomas, una cadena de pares medidos
debería existir — y su calidad debería ser algo que podamos estimar a partir de
mediciones en lugar de afirmar.

Entonces el valor de una ejecución completada no es "una fila más en la tabla de clasificación." Es
**cuánto más fuerte se vuelve toda la malla**: la ganancia en nuestro
objetivo de capacidad de cadena ponderada por calidad Φ, que pregunta, para cada
par ordenado de idiomas en la Tierra que rastreamos, *¿cuál es la mejor cadena entre ellos ahora?* Una ejecución que conecta un idioma aislado
vale cientos de ejecuciones que pulen una esquina ya brillante — y la
fórmula dice exactamente cuántos cientos, en lugar de dejarlo a intuiciones. Este es el mismo instinto que llevó a M2M-100 a
extraer "idiomas puente" entre familias en lugar de más
datos emparejados con inglés (Fan et al. 2021) — hecho continuo, y dirigido
a la evaluación en lugar del entrenamiento.

Dos consecuencias que aceptamos a propósito:

- **Una ejecución pequeña barata en un par no medido generalmente supera una ejecución
  cara en uno medido.** El cómputo contribuido es un presupuesto; clasificamos por
  ganancia de malla *por dólar* (la regla codiciosa clásica para cubrir
  la mayoría bajo un presupuesto — Khuller, Moss & Naor 1999). Iluminar el
  centésimo borde hace más por la misión que pulir el
  primer borde.
- **Las cadenas estimadas valen menos que los bordes medidos.** Nuestro modelo de cadena
  multiplica las calidades de borde y cobra un descuento de fidelidad por
  cada unión de pivote, porque cuarenta años de resultados de traducción por pivote
  dicen que enrutar a través de un idioma intermedio pierde más de lo que
  la composición ingenua sugiere (Utiyama & Isahara 2007; Wu & Wang 2007). El
  descuento es el incentivo permanente de la fórmula para *medir el
  par directo* en lugar de confiar en una cadena plausible.

## Lo que creemos: predicciones lo suficientemente simples para auditar

Para valorar un experimento no ejecutado debe predecir su resultado. Hay un
espectro aquí, desde "no asumir nada" hasta "entrenar un modelo para adivinar." Deliberadamente
nos detenemos temprano en ese espectro: nuestra predicción es una suma que un
contribuidor puede verificar en una servilleta — *¿cómo generalmente puntúa este par de idiomas,
cómo generalmente se desvía este modelo, ¿existe evidencia de entrenamiento para este idioma exacto* — y nada más. Sin pesos aprendidos, sin incrustaciones, sin
un modelo cuyos propios sesgos necesitarían auditoría.

Esto nos cuesta precisión. Un predictor potenciado por gradiente sobre características de idioma
adivinaría mejor. Intercambiamos esa precisión por una propiedad que
valoramos más: **cada rango en la cola es re-derivable a mano a partir de
números impresos en el elemento mismo.** Cuando alguien pregunta "¿por qué esta
ejecución de Feroés es #1?", la respuesta es cuatro números publicados y una
oración, no "el modelo lo dijo." La investigación de aprendizaje activo ha equilibrado durante mucho tiempo
la sofisticación de selección contra la confianza e inspeccionalidad
(Haffari, Roy & Sarkar 2009 trajeron exactamente este equilibrio a la traducción automática);
un punto de referencia financiado por voluntarios pertenece al extremo inspeccional.

## Lo que no sabemos: curiosidad con presupuesto

Una cola impulsada puramente por predicciones tiene un modo de falla: confía
en que todo lo que predice mal se muera de hambre, y nunca
descubre que estaba equivocado. La respuesta clásica de la literatura de bandidos
es *optimismo ante la incertidumbre*: dar a cada opción no probada un
bonificación que se reduce a medida que se acumula evidencia (Auer, Cesa-Bianchi &
Fischer 2002). Nuestra cola lleva exactamente ese bonificación — escalada, no
coincidentemente, al piso de ruido de nuestros instrumentos: el optimismo nunca
excede los ~5 puntos de chrF++ que los corpus de desarrollo pequeños no pueden distinguir
de todas formas ([Corpus Design §6.3](/docs/network/specifications/corpus-design)).

La misma humildad aparece en dos asimetrías que vale la pena nombrar:

- **Todo lo publicado es evidencia; solo los corpus abiertos son acciones.**
  Los resultados en corpus con licencia restringida informan el conocimiento de la malla,
  pero la cola solo pide a los contribuidores que ejecuten lo que cualquiera puede
  ejecutar libremente.
- **La evidencia de entrenamiento no viaja.** Donde las ejecuciones entrenadas superan las
  ingenuas, eso es un hecho medido para ese idioma — y silencio sobre
  todos los demás. La cola mantiene el ordenamiento de línea base primero donde
  el entrenamiento no se mide, en lugar de asumir que las ganancias de un idioma
  se generalizan.

## Lo que nos negamos a hacer

- **Sin optimización de participación.** Los elementos nunca se ordenan para maximizar
  clics, rachas o satisfacción de finalización. El objetivo de malla es
  el único objetivo.
- **Sin pulgar editorial oculto.** Si alguna vez necesitamos impulsar un par (una
  asociación comunitaria, una fecha límite), aparecerá como un término
  nombrado y versionado en la especificación — no como una re-clasificación silenciosa.
- **Sin bloqueo de reclamaciones.** Cualquiera puede ejecutar cualquier elemento en cualquier momento; las ejecuciones idénticas
  se desduplican por huella digital y las replicaciones independientes son
  evidencia bienvenida. Una posición en la cola es un consejo, no un permiso.
- **Sin teatro de capacidad.** Φ y cada puntuación que la alimenta son
  números de conjunto de desarrollo con advertencias conocidas (límites superiores de contaminación,
  diferencias de escala entre idiomas). Dirigen el gasto; nunca se citan como lo que un modelo
  "puede hacer."

## Construido para estar equivocado en público

La fórmula está versionada (`ecv-v2`), sus parámetros se repiten en
cada cola publicada, y su suposición de modelado central — que
la calidad de la cadena se compone multiplicativamente con un descuento por unión —
ahora es *comprobable con nuestros propios datos*: la malla contiene
triángulos medidos (deu→fra directo junto con deu→eng y eng→fra), así que podemos
puntuar traducciones encadenadas reales contra las predicciones del modelo y
ajustar el descuento empíricamente en lugar de elegirlo. Cuando eso
suceda, v3 lo dirá, y esta página explicará qué cambió y por qué. Ese es el
estándar al que queremos ser sostenidos: no una cola que siempre tenga razón,
sino una cuyo razonamiento siempre está en el registro.

*Las matemáticas, valores predeterminados, ejemplo trabajado y citas completas viven en la
[Especificación de Construcción de Cola](/docs/network/specifications/queue-construction).*
