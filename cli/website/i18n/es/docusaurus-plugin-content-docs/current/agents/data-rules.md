---
title: "Reglas de datos y transmisión"
slug: /agents/data-rules
description: "Las reglas que cada herramienta de Champollion aplica a los datos de las personas: el sidecar set/1 campo por campo, local-only y su valor predeterminado provisional, entrenamiento no permitido, hablantes y titulares que aceptaron, lo que cada herramienta imprime y nunca imprime, los cuatro modos de transmisión, los niveles de registro y las salidas del modelo como derivados."
---

# Reglas de datos y transmisión

Las personas custodias de los datos lingüísticos deciden cómo se usan. Los rieles
escriben sus decisiones junto a cada archivo, y cada herramienta obedece lo
escrito —con la propiedad y el control comunitario de los datos lingüísticos como
regla de diseño, no como una configuración. Esta página es el conjunto exacto de
reglas: qué hace cada campo, qué rechazan las herramientas y las partes que solo
usted puede conservar.

## El sidecar (set/1)

Junto a cualquier archivo de datos, `<file>.champollion.json`, `$schema`
`https://champollion.dev/schemas/set/1.json`. Se rechazan las claves desconocidas; las notas
van bajo `x-`. Un sidecar escrito antes de set/1 (sin `$schema`) se lee como set/0
y sigue siendo válido (`champollion upgrade` lo reescribe).

| Campo | Valores | Efecto |
|---|---|---|
| `transmission` | `local-only` (el único valor) | Solo un modelo en esta computadora puede ver el texto; cada herramienta se niega a enviarlo a cualquier parte (`mt-eval project offer` incluido) |
| `role` | `train` · `dev` · `test` · `sealed` · `input` · `resource` | Para qué sirve el archivo. Con `test` y `sealed` nunca se entrena |
| `kind` | `parallel` · `monolingual` · `lexicon` · `grammar` · `glossary` | Qué contiene |
| `pair` | `{source, target}` | La dirección en la que van sus columnas, según los códigos de las fichas |
| `fields` | `{source, target}` | Qué columna o campo JSON contiene qué lado |
| `terms.training` | `allowed` · `not-allowed` | `not-allowed`: ningún modelo puede entrenarse con él |
| `terms.owner` | texto | Quién lo custodia, en las palabras de quien lo custodia |
| `terms.speakers` | texto | De quién son las palabras que contiene, en las palabras de quien lo custodia |
| `terms.speakers_agreed` | `yes` · `not-yet` · `some-said-no` | Si las personas cuyas palabras son estas estuvieron de acuerdo |
| `terms.consent_record` | ruta | La nota de consentimiento, relativa a la carpeta del archivo |
| `holders_agreed` | `{by, date}` | Quién entre quienes lo custodian aceptó que una salida de solo local pueda permanecer donde está (no flexibiliza nada) |
| `derived_from` | ruta | El archivo protegido a partir del cual se creó este; sus marcas se trasladaron aquí |
| `id`, `name`, `license`, `tier`, `segment`, `sha256`, `rows`, `card`, `registeredAt` | | Escrito por `champollion network register-corpus`; un archivo modificado (otro sha256) ya no recibe el id de la ficha |
| `written_by` | texto | El comando que lo escribió |

**Bloqueo.** Un sidecar solo hace que un archivo sea más estricto: nunca flexibiliza lo
que dice el sobre de un corpus o una entrada del registro.

## Solo local y el valor provisional por defecto

`champollion data add` marca el archivo que escribe como de solo local cuando el
`defaults.transmission` del proyecto es `local-only` (lo que escribe `champollion new`), y
siempre para `--into test`. Esa marca es la protección de la herramienta hasta que
quienes custodian los datos respondan, señalada con `"x-transmission-default": true`.

- La primera respuesta de quienes custodian los datos decide. `champollion data mark <file>
  --may-leave` lifts a provisional mark; `--local-only` lo hace suyo (se quita el
  indicador).
- **Nota.** La herramienta no puede saber quién ejecutó el comando. Levante una marca
  provisional solo con la respuesta propia de quienes custodian los datos.
- **Bloqueo.** Una marca de solo local que hayan establecido quienes custodian los datos
  no puede levantarse mediante ningún comando: *"este archivo está marcado como solo local,
  y un sidecar solo se vuelve más estricto. Si puede salir de esta computadora es decisión
  de quienes lo custodian —si están de acuerdo, edite el sidecar a mano."*
- **Bloqueo.** `data mark` en un archivo que aún no es de solo local necesita `--local-only` o
  `--may-leave`: *"si el texto de este archivo puede enviarse alguna vez a un servicio externo
  de IA es decisión de quienes lo custodian, por lo que nunca se da por sentado"*.

Lo que significa solo local en cada herramienta:

| Dónde | Qué sucede |
|---|---|
| Cualquier evaluación (`mt-eval run`, puntuación de forge) | La política se resuelve a `sealed` (nivel `local-only`): solo un endpoint de loopback, el adaptador en proceso propio del arnés (`local-model`) o un método externo ejecutado con `--attest-local-transport` pueden ver el texto |
| Salida de terminal y de `--json` | Sus oraciones se retienen; en su lugar se imprimen números de línea, identificadores, recuentos y puntuaciones, con una línea que explica el motivo |
| Archivos extraídos de él | Las divisiones, copias limpias, hipótesis y registros de ejecución conservan el texto (están en las carpetas de la persona) y llevan la marca en un sidecar propio |
| Un modelo entrenado con él | Su salida también es de solo local (`forge-model.json` `trained_on.terms`; lo no registrado cuenta como solo local): `try_translation` devuelve solo la página del modelo, `champollion connect`, `mt-eval serve` fuera de loopback y `mt-eval translate` fuera del proyecto necesitan `--holders-agreed-by`, y `sync` retiene sus respuestas, tanto a través del método `api` como de `local` ([puesta en servicio](/docs/agents/serving)) |
| Un archivo de coaching o diccionario | Un archivo de coaching con sidecar traslada su política al prompt; las salidas de una ejecución de léxico se retienen cuando su diccionario es de solo local |

**Nota.** `--attest-local-transport` declara local el endpoint de un método. Páselo
solo cuando haya verificado que el endpoint está en esta máquina: una dirección de
loopback puede ser un proxy que reenvía a cualquier parte.

## Entrenamiento

- **Bloqueo.** nmt-forge se niega a entrenar con un archivo cuyo sidecar dice
  `terms.training: not-allowed`; un sidecar ilegible cuenta como una
  restricción, nunca como ninguna.
- **Bloqueo.** `champollion data combine` nunca une un archivo no permitido: lo mueve,
  junto con su sidecar, a `data/not-for-training/`. Rechaza un archivo cuyos
  custodios aún no han respondido —sin `terms.training` o sin
  `terms.speakers_agreed` (*"nadie ha dicho aún si todas las personas cuyas palabras
  están en él estuvieron de acuerdo —champollion les preguntará a las personas a continuación; combine después"*)—
  y el archivo combinado lleva los términos más estrictos de los archivos (solo local si
  uno lo es, no permitido si uno lo es, con cada propietario nombrado).
- **Bloqueo.** El paso de términos del recorrido cuenta un archivo en `data/parallel/`,
  `data/lexicon/`, `data/grammar/` o `data/monolingual/` como respondido únicamente cuando
  su sidecar tiene tanto `terms.training` como `terms.speakers_agreed` (y la
  respuesta de entrenamiento es la de quienes lo custodian, no la precaución de la herramienta que figura abajo); hasta entonces
  vuelve a preguntar y los rieles no avanzan más.
- **Nota.** nmt-forge lee `terms.training`, no `speakers_agreed`. Con un solo
  archivo de pares no hay combinación, de modo que solo el paso de términos espera esa
  respuesta: nunca entrene con un archivo al que le falte la respuesta de los hablantes.
- **Bloqueo.** Nunca se entrena con un archivo de `test` o `sealed`: se rechaza `--training
  allowed` para él, y se rechaza asignarle otro rol.
- **Bloqueo.** `not-allowed` no puede convertirse en `allowed` mediante un comando (*"Si quienes lo custodian
  aceptan el entrenamiento, edite el sidecar a mano"*) —con una excepción a continuación.
- Las Escrituras (USFM) entran con `terms.training: not-allowed` marcado por
  precaución de la herramienta (`"x-training-default": true`); la respuesta de quienes lo custodian lo
  reemplaza.

## De quién son las palabras y quién dio su acuerdo

`--speakers` registra de quién son las palabras que contiene el archivo; `--speakers-agreed`, si
estuvieron de acuerdo.

| `speakers_agreed` | Efecto |
|---|---|
| `yes` | Entrenamiento según lo indicado por quienes custodian los datos |
| `not-yet` | El entrenamiento se fuerza a `not-allowed` hasta que todas las personas estén de acuerdo; el archivo aparece en `waiting_for_agreement` |
| `some-said-no` | Ningún modelo puede aprender del archivo, nunca: *"separe sus palabras en otro archivo y marque el resto"* |
| (sin respuesta) | El paso de términos sigue preguntando y `data combine` rechaza el archivo (arriba) |

**La única flexibilización que realiza un comando:** `not-yet` → `yes` junto con
`--training allowed`. Un archivo que `combine` había apartado vuelve entonces a
`data/parallel/` para la siguiente combinación.

**Nota.** Haga la pregunta sobre `waiting_for_agreement` una vez por sesión, con delicadeza, y
respóndala únicamente con el sí de la persona indicando que todos estuvieron de acuerdo.

**`--holders-agreed-by "<who>"`** nombra a una persona entre quienes custodian los datos que
aceptó que una salida de solo local pueda ir a un lugar específico: a los archivos de configuración
regional de una aplicación (`champollion connect`, registrado como `holdersAgreed` del par), a
una dirección a la que llegan otras máquinas (`mt-eval serve`, `nmt-forge serve`, reportado
en `/health`) o a un archivo fuera del proyecto (`mt-eval translate`,
registrado como `holders_agreed` del sidecar). No flexibiliza nada más: la
salida se mantiene como solo local para todas las herramientas. **Nota.** Pase únicamente el nombre que la persona
le dio.

## Lo que las herramientas imprimen y lo que nunca imprimen

| Herramienta | Imprime | Nunca imprime |
|---|---|---|
| `champollion data add` | Recuentos, columnas (letra, tasa de llenado, longitud media, proporción de letras latinas), una celda de encabezado solo cuando nombra uno de los idiomas del par, capas de ELAN por número y los números de fila que señala su verificación de filas | Una oración; cualquier otra celda de encabezado (en su lugar, su longitud); el identificador de una capa de ELAN |
| `champollion data mark`, `combine`, `next`, `validate` | Campos, recuentos, estados | El texto de un archivo de datos —nunca lo abren |
| `champollion improve …` | Recuentos y porcentajes | Las oraciones de las hojas de cálculo |
| `champollion sync` (los métodos `local` y `api`) | Las claves cuyo texto contiene palabras que un modelo de forge nunca vio en el entrenamiento, desde el `meta.unseen_words` del servidor | El texto, o las palabras mismas |
| `nmt-forge`, `mt-eval` | Para un corpus de solo local, sellado o que requiere consentimiento: identificadores, números de línea, recuentos, puntuaciones; `[sentence withheld]` dentro de los mensajes de error | Sus oraciones, ya sea en salida humana o de `--json` |
| Herramientas de rieles MCP | Lo que imprime la CLI, recortado | Oraciones; la salida de un modelo de solo local |

**Nota.** `--show-text` (nmt-forge; `mt-eval compare`) imprime oraciones
retenidas. Es para una persona en su propia terminal, nunca para un agente:
lo que usted lee va a su proveedor de modelos.

**Nota.** Ninguna herramienta puede impedirle abrir un archivo. Nunca abra, imprima,
resuma ni pegue los archivos de datos, oraciones de prueba, listas de palabras u
hojas de cálculo de las personas —tampoco el `input-words.json` de una exportación:
enumera las palabras de sus oraciones de entrenamiento y se queda junto a la carpeta del modelo, nunca dentro de ella
([puesta en servicio](/docs/agents/serving#what-an-export-holds)).

**La verificación de filas.** Al incorporar un archivo (pares, un conjunto de prueba o una lista de palabras),
`data add` verifica sus filas comparando las dos columnas del propio archivo —sin
diccionario, sin quitar nada. Cuenta y señala por número de fila:

- copias: la traducción es nuevamente la oración de origen (un nombre o un préstamo
  lingüístico están bien; de lo contrario, falta la traducción);
- repeticiones de un par anterior;
- traducciones mucho más largas o cortas que la proporción habitual del archivo (cortadas
  o dos oraciones en una sola celda);
- filas que parecen invertidas: el origen se lee como las traducciones del archivo, y
  al revés;
- secuencias de filas que parecen desplazadas una fila: sus traducciones encajan mejor en la fila
  siguiente o anterior —los números, signos de interrogación y longitudes se alinean a una fila
  de distancia, y lo mismo ocurre con las palabras: qué tan bien coinciden las palabras de origen
  de una fila con las palabras de una traducción, según la frecuencia con la que ambas aparecen juntas en el
  resto del mismo archivo (las palabras más raras pesan más; la fila en sí se excluye).
  Esto detecta un desfase en un archivo de oraciones con plantilla, cuyas longitudes son todas
  similares; no aporta nada cuando las palabras del archivo dicen muy poco.

Imprime hasta 12 números de fila por tipo (hasta 6 secuencias para filas desplazadas una posición) —en una
hoja de cálculo, la fila en el propio archivo de la persona, contando el encabezado— y registra
los recuentos en `x-import.quality` del sidecar. Las comprobaciones de longitud, inversión y desplazamiento
necesitan al menos 20 pares; una lista de palabras (`--into lexicon`) recibe solo copias y
repeticiones. **Nota.** Transmita los números de fila: las personas revisan esas filas en
su propio archivo y deciden. Nunca abra el archivo para mirar usted mismo.

**Archivos de ELAN.** Cuando `data add` no puede distinguir qué capa es cuál (un lado no
indicado por ninguna bandera, sin que haya exactamente una capa registrada en su idioma), se niega
y lista las capas por número, en el orden del archivo: `tier <n> (<language or
"no language">, <count> annotation(s))`, with `, under tier <m>` para una capa
que hace referencia a otra. Pase los números como `--source-col` y `--target-col`
(`champollion data add <file> --source-col <number> --target-col <number>`);
el sidecar registra los números (`x-import.elan_tiers`). Un número o identificador que
no designe ninguna capa se rechaza (`no such tier — … Name a tier by its number`), y
al igual que una capa cuyo idioma registrado no sea el de ese lado. Dos capas se emparejan
únicamente cuando una hace referencia a la otra o comparten intervalos de tiempo —nunca por
conjetura. **Nota.** El identificador de una capa es lo que haya escrito quien creó el archivo y es
con frecuencia el nombre de una persona, por lo que `data add` nunca lo imprime. La persona puede escribir ella misma
un identificador exacto; usted pasa el número.
Los archivos LIFT se emparejan por sus códigos de idioma; los archivos Toolbox, por sus marcadores
MDF (`\ge` y `\xe` son inglés según el estándar).

## Modos de transmisión

Cada evaluación resuelve su corpus a un modo antes de enviar nada
(`arena/mt_eval_harness/transmission_policy.py`), y lo registra en el registro de
ejecución:

| Modo | Cuándo | Modelos remotos |
|---|---|---|
| `cleared` | Una licencia autorizada para redistribución | Permitido |
| `no-train` | Una licencia Creative Commons estándar no comercial o sin derivados; o un corpus no registrado que no declara ninguna licencia | Solo a través de canales que no entrenan con las entradas: OpenRouter fijado a `data_collection: deny`, API de proveedores directos o local. Una garantía de no entrenamiento, no de no retención |
| `consent-required` | Una licencia modificada, a medida o no declarada (`LicenseRef-*`) | Se rechaza hasta que la entrada del conjunto de datos registre una concesión de `transmission_consent` (`granted_by`, `date`, `scope`, `evidence`); local sigue funcionando |
| `sealed` | Un segmento reservado o de referencia de oro, un conjunto en cuarentena o una marca de solo local fijada por quien lo custodia | Se rechaza, sin anulación posible |

- **Bloqueo.** El texto de un corpus `consent-required` o `sealed` también se retiene de
  la terminal.
- Se advierte sobre un método externo (un complemento) en un corpus `no-train`, no se
  rechaza: el arnés no puede ver el canal del complemento. En corpus `consent-required`
  y `sealed` se rechaza a menos que se use `--attest-local-transport`.
- **Bloqueo.** El proveedor local cuenta como local únicamente cuando su endpoint es una
  dirección de loopback (`localhost`, `127.0.0.1`, `::1`, un socket de Unix) —nunca
  por su nombre.
- **Nota.** Nunca registre una concesión de `transmission_consent` y nunca interprete una
  licencia en nombre del titular de los derechos. La concesión la registra quien custodia
  el conjunto de datos una vez que el titular de los derechos la otorga.
- **Nota.** `--allow-data-collection` retira la fijación de no entrenamiento solo para un
  corpus no registrado que no declara ninguna licencia; afirma que quien realiza la llamada posee
  los derechos. Páselo solo cuando la persona indique que los posee.

## Niveles de registro

Registrar un corpus es opcional: los rieles nunca lo necesitan. Escribe una
ficha de metadatos para que el corpus pueda ser nombrado, comparado y, si quienes lo custodian lo eligen,
listado. `champollion network register-corpus` es interactivo en la terminal
y automatizable con opciones (`--tier`, `--data`, `--license`, `--name`, …).
**Nota.** El nivel, al igual que cada término, es decisión de quienes lo custodian.

| Nivel | La ficha | El texto | Qué rechaza |
|---|---|---|---|
| `local-only` (por defecto) | Escrita junto al archivo `--data` (o `--out`, o aquí), nunca en la carpeta compartida de fichas | Nunca sale de esta computadora; el sidecar recibe `transmission: local-only` | — |
| `private` | Metadatos con `quarantine: true`; desde una instalación de npm se mantiene local, y listarlo es una solicitud aparte (`champollion network submit --type dataset`) | Nunca se sube; sin marca de transmisión —su licencia decide el modo | — |
| `public` | Metadatos más un puntero para obtener desde el origen (`--repo-url`, `--builder`) | Nunca se aloja: se obtiene desde su origen | Una licencia no comercial, sin obras derivadas, restringida o no confirmada (*"Regístrelo de forma privada o de solo local en su lugar."*); `--data` |
| `sealed` | Metadatos con `quarantine: true` y un bloque sellado (`--seal-input`, `--threshold-pubkey`, `--custodian-group`, `--qualifier-id`) | Solo existe texto cifrado, escrito en `<id>.sealed.json` o `--seal-out` | Un archivo que es una copia exacta en bytes de un corpus público; `--data` |

En cada nivel no se sube nada durante el registro (`--json` dice
`uploadedContent: false`). La única llamada de red, desde una instalación de npm, compara
el sha256 del archivo con el del catálogo público en esta computadora (el hash nunca
sale); con `CHAMPOLLION_OFFLINE=1` la ficha indica que la comparación no se
realizó. Con `--data`, el sidecar registra `id`, `name`, `license`, `tier`,
`sha256`, `rows`, `card` y `registeredAt`. **Bloqueo.** Un identificador registrado
nunca se vuelve a derivar: se rechaza registrar el archivo de nuevo con otro identificador, y
un archivo modificado (otro sha256) ya no recibe el identificador ni la calificación de la ficha.

## Las salidas son derivadas

La salida de un modelo sobre oraciones restringidas es una obra derivada de ellas, y una
evaluación genera tales salidas a gran escala. Las herramientas tratan las salidas del mismo modo
en que tratan sus entradas:

- Para cada corpus que no sea `cleared`, la ejecución registra e imprime un aviso:
  sus predicciones son derivados generados por máquina de oraciones restringidas, y no deben
  distribuirse.
- Donde el texto se retiene (solo local, sellado, requiere consentimiento), cada
  archivo creado a partir de él —registros de ejecución, reportes, comparaciones, entradas de caché,
  salida de `mt-eval translate`, lados divididos de forge, corpus limpios e
  hipótesis— recibe un sidecar set/1 con la marca (`derived_from`,
  `written_by`). Un corpus `no-train` recibe el aviso pero ningún sidecar.
- Un modelo entrenado con texto de solo local produce salidas de solo local (arriba).
- `mt-eval publish` nunca sube las oraciones de un corpus de solo local, incluso con
  `--publish-entries`, y por defecto publica un prompt con coaching solo como su hash
  para dicho corpus. Para otros corpus, el prompt se publica a menos que
  se use `--redact-coaching`.

**Nota.** Publicar es decisión de las personas, tomada en sus propias palabras, con
la vista previa (`--dry-run`) mostrada a ellas primero. Nunca publique, pegue ni envíe
las salidas de una ejecución en su nombre.

## Para profundizar

- [El contrato operativo](/docs/agents/contract) §1 y §3.
- [Sus palabras, sus reglas](/docs/your-words-your-rules) —la versión para las personas.
- [Registrar corpus](/docs/network/sovereignty/registering-corpora) —los
  niveles, con cada opción.
- [Puesta en servicio e implementación](/docs/agents/serving) —la salida de
  solo local en la práctica.
- [Soberanía de datos, en palabras sencillas](/docs/learn/data-sovereignty).
