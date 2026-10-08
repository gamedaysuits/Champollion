---
sidebar_position: 5
title: "La brecha de cobertura: cómo la estimamos"
description: "Cómo Champollion justifica la cifra de «más de mil millones de personas»: el método, las dos decisiones de criterio que la respaldan y por qué el sitio reporta deliberadamente un límite inferior conservador. Las correcciones y el debate son bienvenidos."
---

# La brecha de cobertura: cómo la estimamos

> **Resumen ejecutivo.** La página de inicio de Champollion dice que *más de mil millones* de personas vivas en la actualidad no pueden obtener traducción automática en su primera lengua. Esta página muestra la aritmética detrás de esa frase, nombra las dos decisiones de criterio que modifican el número y explica por qué publicamos un límite inferior conservador en lugar del total bruto más grande. Champollion es un índice, no una autoridad: cada cifra aquí se puede derivar de la compilación pública, y las correcciones son bienvenidas.

## La pregunta que realmente nos estamos haciendo

No "cuántos idiomas carecen de traducción automática", sino **cuántas personas no pueden obtener traducción automática en su primera lengua.** La primera lengua (L1) de una persona es aquella en la que piensa y en la que más desearía leer las noticias. El bilingüismo no excluye a nadie de este recuento: una persona bilingüe quechua-español cuya primera lengua es el quechua sigue sin poder leer una página web *en quechua*. Por lo tanto, la población objetivo es: todas las personas cuya L1 sea una de las lenguas vivas que ningún motor de traducción automática dedicado atiende.

## Cómo se calcula este número

Dos ingredientes, ambos en el repositorio:

1. **Qué lenguas vivas tienen traducción automática.** La compilación interseca la unión de las listas de idiomas de nueve motores rastreados (Google, Microsoft, DeepL, LibreTranslate, NLLB-200, OPUS-MT, M2M-100, MADLAD-400, Tilde — `shared/catalogue/method-coverage.json`, cada lista citada y fechada) con las lenguas *vivas individuales* de la norma ISO 639-3 (`isoType: 'L'`) en `data/tc-index.json`. Resultado: **552 lenguas vivas cubiertas, 6.525 no cubiertas**, de un total de **7.077** lenguas vivas (`stats.coverage.dedicatedLiving` / `uncoveredLiving`).
2. **Cuántas personas hablan las no cubiertas.** Para cada lengua viva no cubierta tomamos su `speakerCount` (extraído de las estimaciones citadas en la tarjeta del idioma) y lo sumamos. La compilación emite esto como `stats.coverageGap`. La suma bruta de las 6.525 lenguas no cubiertas es de aproximadamente **2.900 millones** (`uncoveredSpeakerSumRaw` ≈ 2.974.871.273).

Esos 2.900 millones son una cifra **más bien alta**, y lo decimos claramente.

### Por qué la suma bruta no es exacta

`speakerCount` mezcla hablantes de primera lengua (L1) y totales (L1+L2) dependiendo de lo que informe cada fuente, y una persona multilingüe puede ser contada en más de un idioma. El indicio: sumar `speakerCount` en *todas* las 7.082 lenguas vivas da aproximadamente **10.800 millones**, más de los ~8.100 millones de personas vivas (Perspectivas de la Población Mundial de la ONU). Un censo L1 exacto no puede exceder la población mundial; este lo hace, lo que demuestra que el campo no es puramente L1.

## Dos decisiones de criterio (cada una modifica el número)

**(a) Recuentos solo de L1 frente a totales.** Restringirse a los hablantes de primera lengua reduciría la estimación: los hablantes de L2 son, por definición, personas que *tienen* otro idioma. Pero las cifras de L1 por idioma no están disponibles de manera uniforme en las fuentes que citamos, por lo que no podemos aplicar una regla de solo L1 en todas partes sin inventar números. El uso del recuento mixto empuja la estimación *hacia arriba*.

**(b) Las 777 lenguas no cubiertas sin recuento reportado.** De las 6.525 lenguas vivas no cubiertas, **5.748 tienen una cifra de hablantes y 777 no** (`uncoveredWithCount` / `uncoveredNoCount`). Dejar de lado las 777 (que es lo que hace la suma bruta) *subestima* el recuento, porque se trata de lenguas reales con hablantes reales (no medidos), la mayoría de ellas pequeñas y en peligro de extinción.

Por lo tanto, los dos errores apuntan en direcciones opuestas: la mezcla L1/L2 infla la cifra, y la cola de 777 lenguas la desinfla.

## Por qué reportamos un límite inferior de "más de mil millones"

El rango plausible va desde un límite inferior cercano a los **1.000 millones** hasta los **~2.900 millones** brutos. Incluso después de descontar fuertemente el doble recuento de L2 *y* dejar de lado toda la cola no medida de 777 lenguas, la población de primera lengua de los idiomas no cubiertos se mantiene cómodamente por encima de los mil millones. En lugar de destacar el número más grande y desordenado, el sitio reporta el extremo conservador. "Más de mil millones" es la afirmación que estamos más seguros de que sobrevive al escrutinio.

## Qué podría cambiarlo

Una estimación más precisa necesita **cifras de hablantes de L1 por idioma, cada una con una cita**, para que podamos sumar L1 directamente en lugar de la mezcla L1/L2, y podamos poner una estimación defendible a las 777 lenguas actualmente no contadas. A medida que los motores agregan idiomas, el 552 aumenta y la brecha se reduce; a medida que las tarjetas obtienen recuentos con mejores fuentes, la suma se ajusta. Esta es una **estimación continua**, recalculada en cada compilación, no un hecho fijo.

## Correcciones y debates bienvenidos

Si usted tiene mejores datos, cree que una decisión aquí es incorrecta o puede documentar las 777 faltantes, avísenos. Ese es el objetivo. Abra un *issue* en [github.com/gamedaysuits/Champollion/issues](https://github.com/gamedaysuits/Champollion/issues) o envíe un correo electrónico a [info@champollion.dev](mailto:info@champollion.dev).

---

## Fuentes

- **Cobertura** — `cli/shared/catalogue/method-coverage.json` (nueve motores, cada lista citada y fechada) ∩ lenguas vivas individuales de la norma ISO 639-3 en `cli/website/data/tc-index.json`; expuesto como `stats.coverage.dedicatedLiving` / `uncoveredLiving`. Derivado de Champollion.
- **Sumas de hablantes** — `speakerCount` en las filas de `tc-index.json` (de las `speakerEstimates` citadas en la tarjeta de cada idioma), sumadas por la compilación en `stats.coverageGap` (`uncoveredSpeakerSumRaw`, `uncoveredWithCount`, `uncoveredNoCount`). Derivado de Champollion; mezcla L1/L2 por fuente.
- **Población mundial** — aproximadamente 8.100 millones (Naciones Unidas, *Perspectivas de la Población Mundial*), utilizado solo como un límite de sentido común para las sumas de hablantes.

## A dónde conduce esto en este sitio

Estos números representan el tamaño del problema. La respuesta del sitio a esto comienza
en [Qué es Champollion](/docs/what-is-champollion); la metodología detrás
de la división entre cubiertos/no cubiertos se encuentra en
[cómo se cuenta la cobertura](/docs/network/context/coverage-counting), y los
idiomas en el lado equivocado de la línea (clasificados por quién podría
construir de manera más plausible un conjunto de evaluación a continuación) se publican en la
[lista de deseos de corpus](https://champollion.dev/corpus-wishlist.json).
