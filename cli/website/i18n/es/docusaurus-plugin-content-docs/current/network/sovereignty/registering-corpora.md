---
sidebar_position: 8
title: "Registro de Corpus y Carriles de Exposición"
slug: /network/sovereignty/registering-corpora
description: "Registre un corpus de evaluación sin cederlo. Los cuatro niveles de exposición —solo local, privado, público y sellado—, los carriles de licencia que los acompañan y cómo fetch-from-source mantiene el contenido del corpus fuera de nuestras manos."
related:
  - label: "Data Stewardship"
    to: /docs/network/sovereignty/data-sovereignty
    kind: doc
    note: "The position these mechanics implement"
  - label: "Ownership & Terms"
    to: /docs/network/sovereignty/ownership-transfer
    kind: doc
  - label: "Evaluation Datasets"
    to: /docs/network/leaderboard/datasets
    kind: doc
    note: "The catalogue these lanes apply to"
  - label: "Corpus Design Framework"
    to: /docs/network/specifications/corpus-design
    kind: spec
---

# Registro de Corpus y Carriles de Exposición

> **Resumen ejecutivo.** Puede registrar un corpus de evaluación en la Red para que
> los métodos puedan ser evaluados contra él **sin entregarnos los datos**. Cada
> corpus se registra como una *tarjeta de metadatos* fijada por SHA, no como contenido; las
> oraciones reales se obtienen de su fuente en el momento de la evaluación. Al registrarse,
> usted toma dos decisiones independientes: un **nivel de exposición** —cuánto sale de su
> computadora (`local-only`, `private`, `public` o `sealed`, donde el corpus se
> cifra en su dispositivo bajo una clave de custodio M de N)— y un **carril de licencia**,
> que rige para qué se puede usar el corpus (público, solo para investigación
> no comercial, o privado). Este es el mecanismo que permite a una comunidad hacer que
> su idioma sea *medible* sin hacerlo *extraíble*.

La evaluación de traducción automática generalmente exige lo opuesto a la soberanía de datos: "cargue su conjunto de prueba para que podamos calificar contra él". Eso no es viable para corpus de idiomas indígenas y otros corpus comunitarios, donde los datos son propiedad de las personas de las que provienen. La Red está construida para que nunca tenga que hacer ese compromiso.

---

## 1. El registro es metadatos, no contenido {#1-registration-is-metadata-not-content}

Un corpus registrado es una **tarjeta**: un pequeño registro JSON que describe *dónde* vive el corpus y *qué es*, con un hash de contenido para que se puedan verificar los bytes exactos — pero **sin oraciones**. Una tarjeta contiene:

| Campo | Qué es |
|-------|-----------|
| `url` | Dónde se obtiene el corpus (el archivo ascendente que controla) |
| `sha256` | Hash de contenido del archivo fijado — prueba que nadie intercambió los datos |
| `license` | Identificador SPDX (o `LicenseRef-…` para una licencia personalizada) |
| `language_pair` | Origen → destino, p. ej. `eng-crk` |
| `do_not_train` | Siempre establecido — los datos de evaluación nunca deben entrenarse |
| `attribution` | El crédito del constructor/lingüista mostrado en todas partes donde aparece el corpus |

En el momento de la evaluación, el arnés **obtiene de la fuente**, verifica el `sha256`, y califica contra las referencias obtenidas recientemente. La Red nunca almacena, aloja ni redistribuye el contenido del corpus. Si desconecta el archivo ascendente, el corpus simplemente deja de ser ejecutable — el control permanece con usted. Esta es la misma disciplina de obtención de fuente aplicada a todo el catálogo (consulte [Conjuntos de Datos de Evaluación](/docs/network/leaderboard/datasets)).

:::info[Por qué un hash en lugar de una copia]
Un hash de contenido permite que una puntuación autorreportada sea **verificada nuevamente** contra el corpus real e inmodificado sin que nosotros tengamos que poseer ese corpus. Una ejecución cuyos números no se reproducen contra la fuente fijada por hash es rechazada. La verificabilidad y la no posesión no están en tensión aquí — el hash es lo que hace que ambas sean posibles.
:::

---

## 2. Dos decisiones separadas

El registro le hace dos preguntas independientes, y vale la pena mantenerlas
separadas porque protegen cosas diferentes:

1. **Qué sale de su computadora** — el *nivel de exposición*.
2. **Para qué se puede usar su corpus** — el *carril de licencia*.

Un corpus puede estar sellado y ser no comercial, o ser público y estar libre para uso comercial, o
cualquier otra combinación. Una cosa no implica la otra.

### 2a. Niveles de exposición — qué sale de su computadora

Cuatro niveles, definidos en `cli/lib/corpus-registration.mjs`. **El contenido del corpus
en texto plano nunca se sube en ninguno de ellos**; esto no es una configuración de política, es
cierto para todos los niveles. El registro siempre usa por defecto el más privado.

| Nivel | ¿Registrado? | Qué recibimos | Tarjeta rastreada |
|---|:---:|---|:---:|
| **Privado / solo local** | ❌ | Nada. La tarjeta y el texto permanecen en su computadora. **El valor por defecto.** | ❌ |
| **Registrar de forma privada** | ✅ | Solo metadatos: un conjunto retenido secreto al estilo WMT. Usted mantiene la custodia; los resultados se pueden publicar sin exponer los datos. | ✅ |
| **Registrar de forma pública** | ✅ | Metadatos + un puntero de obtención desde la fuente. Su texto se obtiene de la fuente original a pedido, nunca se aloja aquí. Necesita una licencia que permita la redistribución. | ✅ |
| **Sellado** | ✅ | Texto cifrado + una tarjeta sin contenido. Nada más. | ✅ |

**Sellado es la garantía más fuerte que ofrece el sistema.** Su corpus se
cifra **en su dispositivo**, bajo la clave de umbral del grupo de custodios, antes
de que salga un solo byte. Champollion recibe texto cifrado y no puede descifrarlo,
y tampoco puede hacerlo ningún custodio individual: se necesitan **M de N** de ellos juntos para
autorizar una ejecución. Los conjuntos sellados se catalogan pero se ponen en cuarentena, y se emparejan con
un corpus *clasificatorio* público que un método debe superar antes de que se pueda
siquiera proponer una ejecución sellada. Consulte [Ejecutar un concurso
soberano](/docs/network/sovereignty/run-a-sovereign-contest) y el [Nodo de
evaluación soberano](/docs/network/sovereignty/sovereign-eval-node).

### 2b. Carriles de licencia — para qué se puede usar el corpus

Por separado, la licencia rige dónde pueden aparecer los resultados.

#### Público

Un corpus con licencia abierta (p. ej. CC0, CC-BY) cuyas referencias pueden aparecer en superficies públicas y cuyas ejecuciones pueden clasificarse en el tablero de clasificación público. El contenido sigue siendo obtención de fuente — "público" rige la *exposición de referencias y clasificaciones*, no el alojamiento. La mayoría del catálogo (Tatoeba, GlobalVoices, TICO-19, IN22, SMOL, ALT, Turkic-x-WMT, WMT24++) está en este carril.

#### Solo para investigación no comercial

Un corpus bajo una licencia no comercial (p. ej. CC BY-NC-SA, o una licencia personalizada comunitaria/ONG como la de los kits Gamayun `LicenseRef-TWB-Gamayun`). Puede ser **comparado para investigación** — los métodos se ejecutan en él, se calculan puntuaciones — pero está **excluido de todas las rutas comerciales, de premios y de API.** La elegibilidad es **basada en el uso**, no en el corpus:

- el **carril comercial es estricto** — cualquier cosa que no tenga una licencia comercial clara se excluye;
- el **carril de investigación es flexible** — los corpus no comerciales son bienvenidos;
- **la cuarentena siempre gana** — un corpus marcado como un subconjunto impropio (o de otra manera prohibido) nunca puede clasificarse en *ningún* carril, independientemente de la licencia.

Así es como una comunidad puede permitir que su corpus impulse el progreso de la investigación mientras lo mantiene fuera del producto de cualquiera.

#### Privado

Un corpus registrado para **sus propias ejecuciones puntuadas**, donde las referencias nunca se publican. Usted mantiene la fuente; ejecuta la evaluación; decide qué, si es algo, se muestra alguna vez. Un corpus privado puede hacerse público o no comercial más tarde — la exposición solo se *flexibiliza* por una decisión explícita impulsada por el propietario, nunca silenciosamente.

| Carril de licencia | Evaluable | Referencias mostradas públicamente | Puede clasificar en la tabla pública | En ruta comercial / de premios / API |
|------|:---:|:---:|:---:|:---:|
| **Público** | ✅ | ✅ | ✅ | ✅ (si la licencia lo permite) |
| **Solo para investigación no comercial** | ✅ | depende de la licencia | solo carril de investigación | ❌ |
| **Privado** | ✅ (sus ejecuciones) | ❌ | ❌ | ❌ |

:::note[La lane comercial es una barrera de seguridad, no un negocio]
Champollion en sí es no comercial — no hay una API de pago ni un producto detrás de nada de esto. La lane comercial/de premio existe como una barrera *hacia adelante*: registra, de manera mecánica, qué corpus podrían alguna vez aparecer legalmente en un contexto de premio o comercial, de modo que ningún uso futuro — por parte de nadie — pueda desviarse más allá de una licencia o los términos de un administrador.
:::

---

## 3. Garantías de soberanía

El registro está diseñado alrededor de la [posición de administración de datos](/docs/network/sovereignty/data-sovereignty). Concretamente:

- **La posesión permanece con la fuente.** Mantenemos un hash y una URL, no los datos.
- **El control es del propietario.** La elección del carril es del propietario, y la exposición solo se flexibiliza por una decisión explícita. Desconectar el archivo ascendente revoca la ejecutabilidad.
- **No comercial significa no comercial.** Los corpus NC se excluyen mecánicamente de los carriles comerciales, de premios y de API — no por promesa, por puerta.
- **Los subconjuntos impropios nunca pueden clasificarse.** La cuarentena anula la licencia, por lo que un corpus prohibido de clasificarse permanece prohibido en todas partes.
- **La atribución es obligatoria.** El crédito del constructor/lingüista viaja con la tarjeta a todas las superficies donde aparece el corpus.

Para saber cómo se establecen los términos por idioma — incluida la transferencia de propiedad del método para premios patrocinados — consulte [Propiedad y Términos](/docs/network/sovereignty/ownership-transfer).

---

## 4. Cómo registrarse

El esquema de tarjeta de corpus y las herramientas de construcción/verificación se documentan en el [Marco de Diseño de Corpus](/docs/network/specifications/corpus-design) y el [Libro de Recetas de Creación de Corpus](/docs/network/tutorials/corpus-creation). En resumen:

1. Aloje el archivo de corpus en algún lugar que controle (permanece allí — nunca se copia en la Red).
2. Escriba una tarjeta: `url`, `sha256`, `license`, `language_pair`, `attribution`, `do_not_train`.
3. Elija el carril de exposición (público / no comercial / privado).
4. Registre la tarjeta. Los métodos ahora pueden compararse contra el corpus obtención de fuente, bajo las reglas del carril.

Nunca carga las oraciones. Puede detenerse en cualquier momento.
