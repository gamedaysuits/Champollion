---
title: "Cómo un tokenizador decide qué idiomas son baratos"
sidebar_label: "Tokenizadores"
description: "Antes de que un modelo de lenguaje lea una palabra, algo la divide en fragmentos. Ese paso se aprende a partir de los datos, optimiza la compresión en lugar del significado, y decide silenciosamente qué idiomas son caros de usar. Una introducción para quienes empiezan desde cero."
---

# Cómo un tokenizer decide qué idiomas son baratos

:::info[Para quién es esto]
Para cualquier persona. Esta página no asume conocimientos previos en machine learning ni en lingüística.
Si usted sabe qué es un modelo de lenguaje —software que recibe texto y
produce texto—, eso es suficiente.
:::

Todo modelo de lenguaje tiene un primer paso invisible. Antes de leer una palabra, un
programa de software corta esa palabra en fragmentos. Los fragmentos son lo que el
modelo realmente ve.

Ese paso se llama **tokenization**, y casi nadie le presta atención. Vale la pena
analizarlo, porque es el punto donde algunos idiomas se vuelven varias veces
más caros de usar que otros —y la decisión se toma antes de que alguien
piense en absoluto en la calidad, la equidad o la cobertura.

---

## 1. Un modelo no puede leer

Una red neuronal hace aritmética con números. No tiene noción de letras ni de
palabras. Por lo tanto, el texto tiene que convertirse primero en números.

Un **tokenizer** es el software que realiza esa conversión, y la revierte
al final. Convierte una cadena de texto en una lista de números enteros, donde cada entero apunta
a una fila en una gran tabla de búsqueda.

Toma dos decisiones:

**El vocabulario** — el inventario fijo de piezas que al modelo se le permite ver.
No palabras: *piezas*. Las más comunes son palabras enteras, pero el material más raro se descompone.
El inventario tiene un tamaño fijo, elegido de antemano —a menudo decenas de
miles de entradas.

**La segmentación** — para cualquier cadena real, qué piezas y en qué orden. La
palabra *unbelievable* podría convertirse en `un` + `believ` + `able`, o en una sola pieza, o
en once letras individuales. El resultado que usted obtenga depende completamente de lo que haya en el
vocabulario.

> **Ejemplo práctico.** Si `believ` está en el vocabulario, *unbelievable* cuesta
> tres piezas. Si no lo está, el tokenizer recurre a fragmentos cada vez más
> pequeños hasta que puede cubrir la palabra —posiblemente una pieza por letra. La misma
> palabra, el mismo significado, el triple de piezas u once veces más piezas,
> dependiendo de una decisión tomada mucho antes de que usted la escribiera.

---

## 2. El vocabulario es *aprendido*, y optimiza lo equivocado

Aquí está la parte que sorprende a la gente.

El vocabulario no es diseñado por un lingüista. Es **aprendido de un montón de
texto**, por un algoritmo cuyo objetivo es la **compresión** —cubrir este texto en la
menor cantidad de piezas posible.

El significado no juega ningún papel. El algoritmo no tiene idea de qué es una palabra, qué es un prefijo,
o que existe un idioma. Cuenta lo que aparece junto con frecuencia, y le da a las
secuencias frecuentes su propia entrada porque eso hace que el texto sea más corto.

La consecuencia se deriva mecánicamente. Las piezas se asignan a un idioma aproximadamente
en proporción a **cuánto de ese idioma había en el montón**. Un idioma que
representaba una gran parte obtiene muchas piezas dedicadas, y sus palabras salen enteras
o casi enteras. Un idioma que casi no tenía presencia no obtiene casi ninguna pieza
propia, y sus palabras son cubiertas por cualquier fragmento genérico que encaje.

Un idioma que no estaba en absoluto en el montón obtiene **cero** piezas dedicadas. Aún
así funciona —el tokenizer siempre encontrará *alguna* manera de representar el texto,
porque puede recurrir a caracteres individuales o bytes sin procesar. Simplemente cuesta
muchísimo más decir cualquier cosa.

:::note[Esto no es un error]
Nada ha funcionado mal. El algoritmo de compresión hizo exactamente lo que se le
pidió. El problema es que "hacer que el texto de entrenamiento sea corto" se aceptó como un
sustituto de "representar bien el idioma", y para los idiomas ausentes en ese texto, el
sustituto falla por completo.
:::

---

## 3. Fertilidad: el número que nombra el daño

La **fertilidad** es el número promedio de tokens que cuesta una palabra.

Para un idioma en el que el tokenizer fue entrenado intensamente, la fertilidad es cercana a 1 —
la mayoría de las palabras son una sola pieza. Para un idioma que nunca vio, la misma medida puede
ser muchas veces mayor, porque cada palabra tiene que ser ensamblada a partir de fragmentos.

Ese único número desencadena en cuatro impuestos separados:

| Impuesto | Qué significa |
|---|---|
| **Costo** | La mayoría de los modelos comerciales cobran por token. Más tokens por palabra significa que la misma oración cuesta más dinero de traducir, resumir o generar. |
| **Contexto** | Los modelos tienen una ventana fija. Una alta fertilidad significa que cabe menos de su documento real. |
| **Cómputo** | Las secuencias más largas son más lentas, en todas partes, para siempre. |
| **Aprendizaje** | El más difícil. El significado ahora está esparcido a través de muchos fragmentos de baja información, por lo que el modelo tiene un problema más difícil de resolver —incluso con datos idénticos. |

Los tres primeros son injustos. El cuarto es el que daña la calidad.

**Esto está medido, no es una suposición.** Petrov, La Malfa, Torr y Bibi descubrieron que
el mismo texto, traducido a diferentes idiomas, puede diferir en su longitud tokenizada
en **hasta 15 veces**, y que la disparidad persiste en tokenizers
construidos deliberadamente para uso multilingüe.

Su hallazgo complica la solución obvia: los modelos character-level y byte-level
—la respuesta intuitiva, "simplemente use letras, entonces todos los idiomas son iguales"—
aún mostraron **más de 4 veces** la diferencia para algunos pares de idiomas. Recurrir
a unidades más pequeñas reduce la brecha. No la cierra.

> Aleksandar Petrov, Emanuele La Malfa, Philip Torr, Adel Bibi.
> *Language Model Tokenizers Introduce Unfairness Between Languages.*
> [NeurIPS 2023](https://proceedings.neurips.cc/paper_files/paper/2023/hash/74bb24dca8334adce292883b4b651eda-Abstract-Conference.html).

---

## 4. Por qué esto afecta a algunos idiomas estructuralmente, no solo estadísticamente

La subrepresentación en el montón de entrenamiento es una causa. Hay una segunda, y
no desaparece agregando datos.

Los idiomas difieren en cuánto trabajo hace una sola palabra.

En inglés, una oración es principalmente palabras separadas en fila: *I saw them*. Tres
palabras, tres conceptos, espacios en blanco entre ellas. Los tokenizers fueron construidos por personas
que trabajan en idiomas que se comportan de esta manera, y lo asumen —la mayoría de ellos
literalmente tratan un espacio como un límite de pieza.

Otros idiomas construyen una cláusula completa en **una sola palabra**, apilando partes
significativas juntas. Los lingüistas llaman a estos idiomas **polisintéticos**, y son
comunes entre los idiomas indígenas de las Américas, y en otros lugares.

> **Ejemplo práctico.** En Plains Cree (nêhiyawêwin), *nikî-wâpamâwak* significa
> aproximadamente "Los vi". Es una sola palabra. En su interior hay varias partes significativas:
> quién está actuando, que la acción es en el pasado, el acto de ver en sí, y quién está
> siendo visto.
>
> Un hablante de inglés obtiene cuatro palabras para eso, y un tokenizer entrenado en
> inglés probablemente gastará cuatro piezas. Un tokenizer que nunca ha visto el Cree
> no tiene entrada para ninguna de esas partes, por lo que tritura la única palabra en
> fragmentos que no respetan ninguno de los límites que conllevan el significado.

Dos cosas se rompen a la vez. La palabra cuesta muchas más piezas de las que debería —
y las piezas **atraviesan las unidades de significado**, por lo que el modelo tiene que
volver a ensamblar una estructura que el tokenizer acaba de destruir.

Agregar más texto en Cree al montón de entrenamiento mejora el primer problema. Solo
ayuda en parte al segundo, porque el algoritmo sigue optimizando la compresión,
y la compresión no sabe que un límite es significativo.

---

## 5. De la tokenization a una respuesta incorrecta

La cadena de "mala segmentación" a "salida incorrecta" es corta.

1. El tokenizer rompe una palabra en límites que no tienen significado.
2. El modelo aprende asociaciones más débiles, porque el mismo concepto aparece bajo
   muchas ortografías de fragmentos diferentes en lugar de una pieza consistente.
3. Al generar, el modelo ensambla la salida fragmento por fragmento.
4. Los fragmentos que son individualmente plausibles pueden combinarse en una palabra que **no
   existe** en el idioma.

Ese último paso es el que hay que tener en cuenta. En un idioma donde las palabras se construyen a partir de
partes, un modelo puede producir algo que parece bien formado para cualquiera que no
lo hable —piezas de aspecto correcto, ensambladas en una palabra que ningún hablante
diría jamás.

La puntuación automática estándar a menudo no lo detectará, porque esas puntuaciones miden principalmente
la superposición con una respuesta de referencia, y una palabra incorrecta hecha de fragmentos
de aspecto correcto aún puede superponerse.

:::danger[Por qué esto importa más allá de las puntuaciones de calidad]
Una salida que es fluida e incorrecta es más peligrosa que una que está obviamente
rota. Un lector que no habla el idioma no tiene forma de saberlo. Esta es una
gran parte de por qué Champollion insiste en la validación por parte de personas que hablan el
idioma, y en comprobaciones estructurales que preguntan "¿es esta una palabra real?" en lugar de
solo "¿se parece esto a la respuesta esperada?"
:::

---

## 6. Quién decide, y por qué ese es el verdadero punto

Todo lo anterior se deriva de una elección: **qué texto entró en el montón del que
aprendió el tokenizer.**

Quien toma esa decisión decide cómo se cortará cada idioma, cuánto
costará usarlo y qué tan duro tendrá que trabajar el modelo para representarlo. Esa
decisión se toma una vez, al principio, generalmente por un grupo pequeño, y es efectivamente
permanente durante la vida de ese modelo —el tokenizer no es algo que usted pueda
ajustar después.

Además, casi nunca se discute. Los debates sobre tecnología lingüística tienden a centrarse
en los datos, el tamaño del modelo y las puntuaciones de calidad. El paso que decide si un
idioma es representable en absoluto se encuentra debajo de todos ellos, y se trata como
plomería.

Es por eso que existe esta página. Si una comunidad quiere un control genuino sobre cómo su
idioma es manejado por las máquinas, controlar los datos no es suficiente. La
pregunta *"¿quién decidió cómo nuestras palabras se cortan en piezas?"* tiene una respuesta, y
para la mayoría de los idiomas del mundo esa respuesta es actualmente: alguien más, como un
efecto secundario de comprimir un montón de texto que apenas contenía el idioma en
absoluto.

---

## Qué leer a continuación

- [Qué es Champollion](/docs/what-is-champollion) — el proyecto al que pertenece esta página, y qué hace al respecto de lo anterior.
- [Cómo se entrenan los modelos](/docs/network/context/mt-training-concepts) — el vocabulario para el paso *después* de la tokenization, con el mismo enfoque de empezar desde cero.
- [Limitaciones honestas](/docs/network/honest-limitations) — lo que este proyecto **no** afirma.
- [Administración de datos](/docs/network/sovereignty/data-sovereignty) — quién tiene las llaves de un corpus, y qué significa eso en la práctica.
