---
sidebar_position: 6
title: "Conteos de cobertura: cómo los calculamos"
description: "Cómo Champollion cuenta los «idiomas con traducción automática»: los dos niveles (cualquier motor vs. servicio desplegado), la SSOT de la que se lee cada número mostrado y la disciplina de actualización. Las correcciones son bienvenidas."
---

# Conteos de cobertura: Cómo los calculamos

> **Resumen ejecutivo.** Cuando el sitio dice que **552 idiomas vivos tienen alguna traducción
> automática** y **196 son atendidos por un servicio implementado**, se trata de dos conteos diferentes
> y deliberadamente separados. Esta página define ambos niveles, nombra la única fuente
> de verdad de la que se lee cada número en el tiempo de compilación y describe cómo se
> actualizan las listas. La cobertura es una *afirmación de existencia*, nunca una afirmación de calidad.

## Los dos niveles

**Nivel 1 — cualquier motor de traducción automática dedicado ("cubierto").** Un idioma vivo cuenta como cubierto
si aparece en la lista publicada de idiomas compatibles de *cualquier* motor de traducción automática (MT)
dedicado que se rastree: servicios de API/consumidor implementados (Google Translate, Microsoft Translator,
DeepL, LibreTranslate, …) **o** modelos de investigación abiertos (NLLB-200, OPUS-MT, M2M-100,
MADLAD-400, …). Esta es la unión que enciende un punto verde en el mapa de la red.

**Nivel 2 — servicio implementado ("atendido").** El corte más estricto: el idioma está en la
lista de un motor que cualquier persona puede *usar hoy* realmente como consumidor o servicio de API. Un
checkpoint de investigación abierto que usted tendría que descargar, alojar y servir por su cuenta
no cuenta aquí. Este es el número que responde a la pregunta "¿podría un hablante traducir una página web
en este momento, sin trabajo de ingeniería?"

Los dos niveles existen porque responden a preguntas diferentes, y combinarlos
exagera la cobertura mundial. Ambos se cuentan únicamente sobre **idiomas vivos individuales
ISO 639-3** (`isoType: 'L'`).

## De dónde provienen los números (nada escrito a mano)

Cada conteo mostrado es una **lectura en tiempo de compilación** de las únicas fuentes de verdad (SSOT) de la máquina;
ninguna cifra en el sitio se escribe en la prosa y se deja que se desactualice:

1. **Las listas por motor** se encuentran en `cli/shared/catalogue/method-coverage.json`:
   una entrada por motor, importada *solo como cita* de la propia lista publicada de
   idiomas compatibles de ese proveedor, con su `source_url` y una fecha de `asOf`. Champollion
   no audita ni reproduce estas listas; son las propias afirmaciones de los proveedores.
2. **La compilación cruza** esas listas con el índice de idiomas vivos y emite los
   conteos de nivel en las estadísticas de compilación del sitio (`stats.coverage.dedicatedLiving` para
   el nivel 1, `stats.coverage.serviceLiving` para el nivel 2, sobre `stats.livingTotal`
   idiomas vivos).
3. **Las páginas renderizan las estadísticas**, y un control de paridad previo al push (pre-push) hace fallar la compilación si la prosa
   y las estadísticas alguna vez difieren.

## "194 idiomas" y "187 idiomas" pueden ser ambos ciertos

La lista de un proveedor y un conteo de *idiomas* no son el mismo objeto, por lo que cada
entrada en la SSOT declara cuál de los dos es su número:

- **`publisher-list-rows`** — la longitud de la propia lista publicada por el proveedor,
  exactamente como la publican. La página de Cloud Translation de Google enumera **194** filas
  para su modelo NMT; esa es la cifra que este sitio atribuye a Google por su nombre.
- **`champollion-derived-enumeration`** — *nuestra* consolidación de esa lista a idiomas
  base ISO 639-3 distintos. Esas mismas 194 filas de Google son **187** idiomas,
  porque `zh-CN` y `zh-TW` son un idioma en dos escrituras, al igual que `pt-PT`
  y `pt-BR`, y así sucesivamente. Este número es nuestro, nunca del proveedor.
- **`publisher-stated-headline`** — un total que el proveedor afirma sin ninguna lista
  publicada que lo respalde. No se puede derivar nada de él.

La brecha entre los dos primeros es aritmética, no un desacuerdo, y se presenta
en todos los proveedores: Microsoft 135 filas → 128 idiomas, LibreTranslate 49 →
47, las 200 variantes FLORES de NLLB-200 → 196. El mapa y los conteos de nivel leen la
*lista enumerada*, nunca el titular. Un control pre-push hace fallar la compilación si la
base declarada de una entrada y su lista se contradicen en algún momento.

Tenga en cuenta también que un proveedor puede publicar varias listas. La página de Google incluye una
tabla separada para su nivel Translation LLM (127 filas al 2026-08-16) y
no indica ningún total combinado en absoluto; por lo tanto, "¿cuántos idiomas admite Google?"
no tiene una única respuesta publicada, y este sitio no inventa una.

## La cobertura afirmada no es calidad, y no siempre es implementable

Un idioma en la lista de un proveedor significa que el proveedor *afirma tener soporte*, nada más.
Dos notas de honestidad que el sitio aplica en todos los lugares donde aparecen estos conteos:

- **Cobertura ≠ calidad.** Si las traducciones son buenas es una cuestión separada
  y medida; ese es el propósito principal de la red de evaluación comparativa (benchmark). Las afirmaciones
  de calidad se encuentran en la tabla de clasificación, ordenadas por (método, conjunto de datos, métrica); las afirmaciones
  de cobertura se encuentran aquí.
- **Afirmado ≠ implementable.** Los modelos de amplitud de investigación pueden afirmar conteos de idiomas
  muy grandes, mientras que su propia documentación informa una calidad utilizable para un subconjunto
  mucho menor. Cuando un proveedor publica una autoevaluación de este tipo, el sitio muestra el
  conteo afirmado *y* la propia cifra de calidad/implementabilidad del proveedor, cada una citada con
  los materiales del proveedor.

## La disciplina de actualización

Las listas de los proveedores cambian; los conteos deben seguirlas, mecánicamente:

- Cada entrada en `method-coverage.json` lleva su propia fecha de `asOf`, y el archivo
  lleva un `asOf` de nivel superior: la fecha del último barrido. Las superficies que muestran
  conteos de cobertura muestran o enlazan esta fecha.
- Un **barrido SOTA** (volver a comprobar la lista publicada de cada proveedor, añadiendo motores
  recién rastreados) es una tarea de mantenimiento periódico; el barrido actualiza la SSOT, y
  cada conteo en el sitio se actualiza en la siguiente compilación. No es necesario "recordar"
  nada en el texto de la página.
- Entre barridos, los conteos son exactamente tan recientes como sus fechas de `asOf`, que es
  la razón por la que esas fechas son parte de los datos, no una convención de notas al pie.

## Correcciones y debates bienvenidos

Si la lista de un proveedor ha cambiado, un idioma está mal clasificado o usted cree que el límite
de un nivel está mal trazado, avísenos: abra un *issue* en
[github.com/gamedaysuits/Champollion/issues](https://github.com/gamedaysuits/Champollion/issues)
o envíe un correo electrónico a [info@champollion.dev](mailto:info@champollion.dev).

---

## Fuentes

- **Listas por motor** — `cli/shared/catalogue/method-coverage.json`: la propia lista publicada de
  idiomas compatibles de cada motor (solo como cita; `source_url` + `asOf` por entrada).
- **Conjunto de idiomas vivos** — idiomas vivos individuales ISO 639-3 (`isoType: 'L'`)
  en el índice de idiomas construido a partir de las tarjetas de idiomas citadas.
- **Conteos de nivel** — `stats.coverage.dedicatedLiving` (nivel 1),
  `stats.coverage.serviceLiving` (nivel 2), `stats.livingTotal` emitidos por la compilación. Derivados de Champollion.
- **La estimación de población basada en estos conteos** — consulte
  [La brecha de cobertura: Cómo la estimamos](/docs/network/context/coverage-gap-estimate).
