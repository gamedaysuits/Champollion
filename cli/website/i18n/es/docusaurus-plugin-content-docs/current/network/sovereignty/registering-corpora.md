---
sidebar_position: 8
title: "Registro de Corpus y Carriles de Exposición"
slug: /network/sovereignty/registering-corpora
description: "Registre un corpus de evaluación sin cederlo. Los cuatro niveles de exposición —solo local, privado, público y sellado—, las vías de licenciamiento que los acompañan y cómo fetch-from-source mantiene el contenido del corpus fuera de nuestro alcance."
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
> los métodos puedan ser evaluados comparativamente con él **sin entregarnos los datos**. Cada
> corpus se registra como una *tarjeta de metadatos* vinculada por sha, no contenido; las
> oraciones reales se obtienen de su origen en el momento de la evaluación. Al registrarlo,
> usted toma dos decisiones independientes: un **nivel de exposición** —cuánto sale de su
> máquina (`local-only`, `private`, `public` o `sealed`, donde el corpus se
> cifra en su dispositivo bajo una clave de custodio M-de-N)— y un **carril de licencia**,
> que rige para qué se puede utilizar el corpus (público, solo para investigación
> no comercial, o privado). Este es el mecanismo que le permite a una comunidad hacer que
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

## 2. Dos decisiones independientes

El registro le plantea dos preguntas independientes, y vale la pena mantenerlas
separadas porque protegen cosas distintas:

1. **Qué sale de su máquina** — el *nivel de exposición*.
2. **Para qué se puede utilizar su corpus** — el *carril de licencia*.

Un corpus puede ser sellado y no comercial, o público y comercialmente habilitado, o
cualquier otra combinación. Lo uno no implica lo otro.

### 2a. Niveles de exposición: qué sale de su máquina

Cuatro niveles, definidos en `cli/lib/corpus-registration.mjs`. **El contenido del corpus
en texto plano nunca se sube en ninguno de ellos**; no se trata de una configuración de directiva, es
una realidad en todos los niveles. El registro siempre utiliza de forma predeterminada el nivel más privado.

| Nivel | ¿Registrado? | Lo que recibimos | Tarjeta rastreada |
|---|:---:|---|:---:|
| **Privado / solo local** | ❌ | Nada. La tarjeta y el texto permanecen en su máquina. **El valor predeterminado.** | ❌ |
| **Registrar de forma privada** | ✅ | Solo metadatos: un conjunto reservado secreto al estilo WMT. Usted conserva la custodia; los resultados se pueden publicar sin exponer los datos. | ✅ |
| **Registrar públicamente** | ✅ | Metadatos + un puntero para obtener desde el origen. Su texto se obtiene desde el origen bajo demanda, nunca se aloja aquí. Requiere una licencia autorizada para redistribución. | ✅ |
| **Sellado** | ✅ | Una tarjeta sin contenido. El texto cifrado permanece con usted. | ✅ |

#### Mantener un conjunto de prueba lejos de cualquier servicio de IA externo

No subir su texto es una garantía. No *enviarlo* a la API de un modelo
mientras realiza la evaluación es otra, y es de suma importancia para un conjunto de prueba que
contiene redacción sensible. Marque el archivo como solo local colocando un pequeño archivo
junto a él, nombrado igual que este con `.champollion.json` añadido:

```bash
# data/nurse_checked_test.tsv  →  data/nurse_checked_test.tsv.champollion.json
echo '{"transmission": "local-only"}' > data/nurse_checked_test.tsv.champollion.json
```

Esto funciona para cualquier formato de corpus (TSV, JSONL, pares de texto plano, JSON). A partir
de ese momento, `mt-eval run` trata el corpus como sellado:
- con un proveedor remoto (OpenRouter, OpenAI, Anthropic, Gemini), la ejecución se
  **rechaza antes de enviar cualquier texto**, y antes de solicitar cualquier clave de API;
- con `--provider local` apuntando a un modelo en esta máquina (una dirección de bucle invertido
  como `http://localhost:11434/v1`), la ejecución continúa;
- con `--method local-model -m <model>` (un modelo NLLB, OPUS-MT o MADLAD
  que el arnés carga en su propio proceso; se requiere `-m`), la ejecución continúa:
  ninguna oración sale de la
  máquina, y la descarga de los pesos transfiere archivos del modelo, nunca su texto;
- con un motor de traducción automática o un plugin de método (`--method <plugin dir>`), la ejecución se
  rechaza a menos que usted certifique que su transporte es completamente local
  (`--attest-local-transport`, registrado en el registro de ejecución): el arnés no puede
  ver a dónde envía texto un plugin o un servicio;
- las métricas de evaluación propias del idioma procedentes de su tarjeta de idioma **no
  se cargan**. Provienen de paquetes independientes que pueden buscar palabras en un
  servicio externo, como un diccionario en línea. La ejecución se califica sin
  ellas, y la tarjeta de ejecución indica que fueron retenidas y por qué;
- `mt-eval publish` retiene las oraciones y, de forma predeterminada, reemplaza un
  prompt personalizado o de entrenamiento con su sha256, de modo que los ejemplos de prompt tomados de
  sus propias oraciones también permanezcan en esta máquina. Algunos metadatos sobre el corpus
  sí se hacen públicos con la puntuación: su id, versión, par de idiomas, tamaño, el
  sha256 del archivo, su licencia y atribución, su grado de contaminación, el hecho de que
  esté marcado como solo local, y sus nombres de segmento. Para un id que no sea un
  conjunto de datos registrado, la publicación también crea una fila pública en `datasets` con
  el mismo id, par, tamaño y sha256, además de su dominio, nombres de segmento y
  rango de dificultad. La vista previa de `--dry-run` enumera estos datos para su ejecución, junto a
  lo que permanece aquí: cada oración, el archivo y su ruta. Otros verán entonces una
  puntuación en un conjunto de prueba que no pueden abrir. Está evaluado internamente, nadie más
  puede volver a ejecutarlo, y el sha256 permite únicamente a quien posea el mismo archivo
  confirmar que se trata de ese archivo;
- lo que imprimen las herramientas omite las oraciones, ya que un agente de IA que lea
  la terminal pasa lo que lee a su proveedor de modelos. `mt-eval compare`
  muestra los id de entrada y las puntuaciones en lugar de las oraciones, y un mensaje de error
  que cite alguna se imprime omitiéndola. `--show-text` las imprime, para
  una persona frente a la terminal. Los archivos escritos en su carpeta de resultados conservan el
  texto, y cada uno lleva la marca del corpus: cada registro de ejecución, reporte,
  archivo de comparación y panel que el arnés escribe a partir del corpus recibe su
  propio `.champollion.json` con los mismos términos más `derived_from`. La siguiente
  herramienta, o una ejecución posterior sobre ese archivo, lo tratará entonces también como protegido. La
  terminal indica el nombre de cada archivo que contiene el texto;
- la caché de traducción mantiene separadas las entradas de este corpus: bajo
  `<cache-dir>/protected/<namespace>/` (de forma predeterminada
  `eval/cache/harness/protected/…`), en un espacio de nombres indexado por la configuración
  de la ejecución, el sha256 del corpus y sus términos, de modo que una entrada solo se
  devuelva a una ejecución en este mismo corpus; nunca a una ejecución en otro corpus o en uno
  no marcado. Cada archivo de caché allí lleva la misma marca
  `.champollion.json`. (Las entradas almacenadas en caché antes de que existiera esta protección residen en la
  caché ordinaria sin marcar; elimine `eval/cache/harness/` una vez para borrarlas).

La marca solo puede hacer que un corpus sea más estricto. Ninguna licencia ni ningún
indicador `--allow-data-collection` pueden flexibilizarlo. Si el archivo de marca no se
puede leer, la ejecución se detiene en lugar de ignorarlo.

**Sellado es la garantía más sólida que ofrece el sistema.** Su corpus se
cifra **en su dispositivo**, con la clave del grupo de custodios, y el texto cifrado
permanece en su máquina o en su nodo de evaluación. Champollion solo recibe la
tarjeta sin contenido. En el nodo desconectado, la clave se divide de modo que se requieran
**M de N** custodios juntos para autorizar una ejecución; esa ceremonia está construida pero
aún no se ha utilizado con custodios reales. Los conjuntos sellados se catalogan pero se mantienen en cuarentena, y se emparejan con
un corpus *clasificatorio* público que un método debe superar antes de que siquiera se pueda
proponer una ejecución sellada. Consulte [Ejecutar una competencia soberana](/docs/network/sovereignty/run-a-sovereign-contest) y el [Nodo de evaluación
soberano](/docs/network/sovereignty/sovereign-eval-node).

### 2b. Carriles de licencia: para qué se puede utilizar el corpus

De forma independiente, la licencia rige dónde pueden aparecer los resultados.

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

| Carril de licencia | Evaluable comparativamente | Referencias mostradas públicamente | Puede clasificarse en tabla pública | En ruta comercial / de premios / API |
|------|:---:|:---:|:---:|:---:|
| **Público** | ✅ | ✅ | ✅ | ✅ (si la licencia lo permite) |
| **Solo para investigación no comercial** | ✅ | depende de la licencia | solo en carril de investigación | ❌ |
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

### El id de la tarjeta

`champollion register-corpus` escribe la tarjeta por usted y le asigna un id con
el formato `eval-<source>-<target>-<name>[-<role>]-v1`:

- **name** proviene de `--name`: "Ward phrases" se convierte en `ward-phrases`. El
  publicador solo se utiliza cuando el nombre no contiene caracteres a–z o 0–9, por
  ejemplo, un nombre escrito únicamente en caracteres silábicos.
- **role** indica para qué sirve el conjunto: `--role test`, `--role dev` o
  `--role train`. Aparece en el id solo cuando usted lo proporciona. La herramienta nunca
  adivina un rol, por lo que un conjunto de prueba reservado solo se denomina conjunto de prueba si usted
  lo especifica.

```bash
champollion register-corpus --yes --name "Ward phrases" --pair "eng>xyz" \
  --license proprietary --tier private --role test --size 120 --domain medical
```

Esto registra `eval-eng-xyz-ward-phrases-test-v1`. Para elegir el id
usted mismo, pase `--id eval-…`; se utilizará exactamente como se indique.

### Qué id de licencia usar para un conjunto de prueba privado

`--license` registra los términos que las personas propietarias de los datos realmente conceden. No
es un marcador de posición, y la herramienta no elegirá uno por usted. Consúlteles
primero (a las familias, a los médicos, al responsable de datos de la comunidad), y luego elija
el id que exprese lo que dijeron:

| Lo que conceden los propietarios | `--license` |
|---|---|
| Ya publican el texto bajo una licencia estándar | su id de SPDX, por ejemplo `CC-BY-NC-4.0` |
| Usarlo solo para puntuar sistemas: nunca entrenar con él, nunca redistribuirlo, sin puntuación remunerada | `community-eval-grant-nc` (`LicenseRef-Champollion-Eval-Grant-NC`) |
| Lo mismo, pero se permite la puntuación para usuarios de pago | `community-eval-grant` (`LicenseRef-Champollion-Eval-Grant`) |
| Ninguna concesión más allá de su propio uso: todos los derechos reservados | `proprietary` (`LicenseRef-Proprietary`) |
| Términos propios que ninguno de estos contempla | `LicenseRef-<a name for their terms>`, escrito tal cual, con los términos documentados donde el responsable de datos los conserva |

Cada id de `LicenseRef-…` en la tabla (las dos concesiones de evaluación y
`proprietary` incluidas) es una concesión personalizada: Champollion nunca la interpreta en
nombre de los propietarios. La evaluación remota con este se rechaza hasta que el responsable
registre su autorización, por lo que solo se prueban modelos en su propia máquina
con él. Si no está seguro, la opción más conservadora que aún le permite
medir es `community-eval-grant-nc`; anótela como provisional y
solicite al responsable de datos que la confirme o indique la correcta.

La licencia no cambia a dónde van las oraciones. Un conjunto solo local (el
marcador `.champollion.json` o `--tier local-only`) permanece en su máquina
independientemente de lo que diga su licencia: el marcador rechaza todo modelo remoto, y una
licencia nunca puede flexibilizarlo. La licencia rige lo que otros pueden hacer con
el conjunto si alguna vez se comparte, y a qué carriles de evaluación puede ingresar. Una vez que un archivo ha
sido registrado con `--data`, su id se registra en el
archivo `.champollion.json` junto a él y nunca cambia. Registrar ese archivo
de nuevo se detiene y le solicita pasar el id con `--id`.

Para un conjunto de prueba con el que se pueda entrenar un modelo (`--role test`, o un
conjunto privado o solo local sin rol), el comando imprime a continuación los
pasos de nmt-forge que deben realizarse antes de la primera puntuación del conjunto: registrarlo,
examinar su corpus de entrenamiento frente a él y registrar sus predicciones.
La línea base `mt-eval run` va después de ellos. Un benchmark es una lectura de puntuación,
y nmt-forge rechaza las predicciones registradas después de una lectura.

`mt-eval run --corpus <that file>` encuentra la tarjeta a través del mismo
archivo `.champollion.json`. El id de conjunto de datos de la ejecución es el id de la tarjeta, por lo que cada ejecución
en el conjunto lleva el mismo nombre, y el nombre del archivo permanece en la ejecución como su
ruta de corpus. El grado de contaminación de la tarjeta se reporta tal como la tarjeta lo
indica. Ambos aplican solo mientras el archivo sea el que usted registró: si ha
cambiado desde entonces, la ejecución lo indica y no utiliza ninguno de los dos.

Una tarjeta `local-only`, `private` o `sealed` indica que su texto no está publicado
(`Contamination: NONE`), por lo que el registro primero compara el archivo que usted pasa
con `--data` (o `--seal-input`) con los corpus públicos. Una copia local del repositorio
lo compara con las tarjetas de corpus que contiene. Una instalación de npm, que
no incluye tarjetas de corpus, lo compara con el catálogo público de corpus: la CLI
descarga los id y las sumas de verificación de los corpus públicos y los compara en su
máquina, de modo que la suma de verificación de su archivo nunca sale de ella. Cuando el archivo coincide byte por
byte con un corpus público (mismo sha256), el registro se detiene y nombra ese corpus.
Regístrelo como público, use oraciones que sean genuinamente privadas o mantenga el
nivel e indique la exposición con `--contamination` (la tarjeta registrará entonces
que el texto es público). Se rechaza un conjunto sellado de texto público: no
probaría nada.

Cuando no se puede realizar ninguna comparación (usted está desconectado o no se puede
acceder al catálogo), la tarjeta se califica como `Contamination: UNCHECKED`, no como `NONE`, a menos
que usted mismo indique un grado con `--contamination`. Vuelva a registrarlo en línea para
compararlo. `mt-eval` trata un corpus `UNCHECKED` como cualquier corpus que
no esté calificado como `LOW`: sus puntuaciones van al carril exclusivo de comparación relativa. La
comprobación compara archivos completos, por lo que un conjunto público que fue editado o reformateado no
se reconoce; `mt-eval contest prepare` compara filas.
