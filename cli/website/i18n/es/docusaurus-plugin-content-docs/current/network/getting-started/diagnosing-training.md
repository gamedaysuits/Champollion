---
sidebar_position: 4
title: "Diagnóstico de una ejecución de entrenamiento"
description: "Solución de problemas basada en síntomas para entrenamiento de MT con recursos limitados — comience por lo que está observando, identifique la causa probable y encuentre la palanca de configuración que lo soluciona."
related:
  - label: "Train Your First Model (with your agent)"
    to: /docs/network/getting-started/train-your-first-model
    kind: guide
  - label: "Train a Model Honestly"
    to: /docs/network/getting-started/training-honestly
    kind: guide
  - label: "forge Command Reference"
    to: /docs/network/getting-started/forge-command-reference
    kind: reference
---

# Diagnóstico de una ejecución de entrenamiento

Su modelo se entrenó. Los números no son lo que esperaba. Esta página comienza desde
**lo que está viendo** y lo guía hacia la causa probable y la herramienta forge que
lo soluciona. La mayoría de estos son automatizados — `nmt-forge evaluate` añade una
sección de **Diagnóstico y Recomendaciones** que nombra el hallazgo y la palanca;
esta guía es la versión en lenguaje simple, más las pocas cosas que forge solo puede
*advertir* (marcadas con ⚠ **tenga cuidado con esto**).

Indíquele a su agente: *"Ejecute `nmt-forge lint <battery-manifest.json> --json` y actúe sobre
el hallazgo de mayor severidad."* Luego compare lo que reporta con las secciones
a continuación.

---

## "Excelente en mis ejemplos de libro de texto, terrible en oraciones reales"

**La trampa más común en recursos bajos.** Sus datos sintéticos/basados en plantillas
obtienen puntuaciones hermosas; el texto real se desmorona.

**Lo que está sucediendo:** una **meseta de transferencia**. Durante el entrenamiento, la pérdida en su
conjunto de desarrollo real se estancó temprano y luego aumentó mientras la pérdida de entrenamiento continuó
cayendo — el modelo estaba dominando la *masa* sintética, no aprendiendo a
traducir. Más datos sintéticos **no** ayudarán.

**Hallazgo de forge:** `R7-transfer-plateau` (del relato de cronograma del manifiesto de ejecución).
**Palanca: REAL-DATA.**

**Solución:** agregue texto real. Retrotraduza datos monolingües en idioma de destino
(`nmt_forge.training.backtranslation`), o adquiera oraciones paralelas reales.
El volumen de datos sintéticos no es la palanca — la variedad de datos *reales* lo es.

⚠ **tenga cuidado con esto:** si su mezcla es ~99% sintética contra un pequeño conjunto de desarrollo real,
está en riesgo de esto *antes* de verlo en las puntuaciones. Aún no hay un lint previo al vuelo
para una proporción patológica — verifique los recuentos de oro/sintéticos en su manifiesto de mezcla.

---

## "Un registro es mucho peor que los otros"

Mire la tabla por registro. Un único registro (digamos, gobierno o legal) está
muy por debajo del resto.

**Dos causas diferentes — el diagnóstico las distingue observando *cobertura*
y si los resultados están *incompletos*:**

- **Al modelo le faltan las palabras** (`R1-vocabulary-gap`: cobertura baja **y** tasa alta
  de incompletitud). **Palanca: VOCABULARY.** Amplíe el léxico (diccionario /
  recolección de atestiguación), luego ejecute `nmt-forge` contabilidad de embudo para confirmar que las nuevas
  entradas realmente llegan al corpus — una discrepancia de ortografía de un carácter ha
  eliminado silenciosamente miles de palabras antes.
- **El modelo tiene las palabras pero no las formas de oración** (`R2-structure-gap`:
  cobertura OK, aún incompleto). **Palanca: STRUCTURE.** Ejecute el mapa de cobertura
  contra su lista de verificación de gramática y agregue las construcciones faltantes
  (imperativos, preguntas con wh-, posesión, inverso — lo que sus plantillas nunca
  pidieron).

---

## "Los resultados mezclan ortografías dentro de una oración"

El modelo escribe el mismo sonido de dos formas, a veces en una oración.

**Lo que está sucediendo:** sus objetivos de entrenamiento le enseñaron que las convenciones
son intercambiables — el corpus contenía el mismo contenido en múltiples
ortografías.

**Hallazgo de forge:** `R3-mixed-convention`. **Palanca: ORTHOGRAPHY.**

**Solución:** `convention-lint` el corpus, normalice a **una** convención
canónica en el límite de datos, y reentrenar. Mantenga una tasa de convención mixta en su batería
para que pueda verla disminuir.

---

## "El modelo B supera al modelo A — pero solo por poco"

Comparó dos modelos y uno está adelante por una fracción de punto.

**Lo que está sucediendo:** la diferencia puede ser menor que el ruido. En 80
oraciones, una brecha de 0.4 chrF++ es un lanzamiento de moneda.

**Hallazgo de forge:** `R5-low-power` (el intervalo de confianza es más amplio que el
delta). **Palanca: MEASUREMENT.**

**Solución:** no actúe sobre deltas más pequeños que el IC. Amplíe el conjunto de evaluación para ese
registro, o use `nmt-forge compare` que reporta una prueba de significancia
*pareada* en lugar de dos intervalos superpuestos. forge nunca renderiza una puntuación simple — el
intervalo siempre está ahí precisamente para que pueda ver esto.

⚠ **tenga cuidado con esto:** un resultado de una **única semilla** no lleva
banda de varianza entre semillas. Una ganancia que no sobrevive a la re-siembra no es real.
Si una decisión importa, re-ejecute con 2–3 semillas.

---

## "La puntuación se ve demasiado bien"

Sospechosamente alta, especialmente temprano o con pocos datos. Confíe en la sospecha.

**Verifique, en orden:**

1. **Fuga.** `nmt-forge leak-audit <corpus>` — ¿una respuesta de prueba terminó en
   entrenamiento? Los aciertos del lado del objetivo son fatales por una razón.
2. **Selección de punto de control.** ¿Fue el punto de control elegido en un **conjunto de desarrollo cercado**,
   no el conjunto de prueba? forge se niega a entrenar sin un conjunto de desarrollo precisamente para prevenir
   esto, pero un pipeline hecho a mano no lo hará.
3. **Optimismo de casi gemelos.** `R4-optimism-bound`: si la puntuación de batería "completa"
   está varios puntos por encima de la "estricta" (casi duplicados excluidos), la brecha es
   optimismo de hermano de ejercicio. **Cite el número estricto** para cualquier afirmación
   de generalización.

---

## "El entrenamiento se detuvo casi inmediatamente"

La ejecución terminó después de unos pocos cientos de pasos; el modelo apenas vio sus datos.

**Lo que está sucediendo:** la detención temprana confundió el tambaleo esperado del conjunto de desarrollo
pesado en sintético con convergencia.

**Comportamiento de forge:** esto se *previene* por defecto — `nmt-forge run` deriva un
**piso** de detención de su mezcla y suprime detenciones tempranas por debajo de él, registrando la
razón en las líneas `[schedule-sanity]`. Si ve una detención que no esperaba,
lea esas líneas; el manifiesto de ejecución registra exactamente qué sucedió y por qué.

---

## "Una métrica que quería simplemente… falta en el informe"

El informe es honesto pero en blanco en un eje (COMET, una verificación de validez de FST).

**Hallazgo de forge:** `R6-referee-unavailable` — el carril se nombra como no disponible
con la razón. **Palanca: REFEREE.**

**Solución:** instale/configure el árbitro nombrado y re-puntúe. Las puntuaciones que tiene
siguen siendo honestas — simplemente están ciegas en ese eje hasta que el árbitro esté
presente.

---

## "El modelo emite `<unk>` o caracteres garrapateados"

Especialmente en un script silábico o latino extendido.

⚠ **tenga cuidado con esto — aún no automatizado.** El tokenizador del modelo base **puede no
representar su script de destino**. forge aún no audita la cobertura del tokenizador antes
del entrenamiento (es el elemento principal en nuestra lista de brechas). Verifique el tokenizador de su modelo base
contra muestras de su script de destino; prefiera una base cuyo vocabulario cubra el
script (muchos idiomas de recursos bajos están cubiertos por bases de la familia NLLB) o extienda
el tokenizador antes del entrenamiento.

---

## Cuando forge se negó y usted no entiende por qué

Un rechazo siempre establece **qué** sucedió, **por qué** corrompe los resultados, y la
**solución**. Si aún no está claro:

- `nmt-forge status` — dónde está y el único comando siguiente.
- `nmt-forge preflight <command>` — cada puerta que ese comando golpeará, ✓/✗, con
  la solución para cada ✗, para que resuelva todas a la vez en lugar de una por una.

Un rechazo no es un error en su configuración — es la herramienta atrapando un error antes
de que llegue a sus resultados. Ese es todo el diseño.
