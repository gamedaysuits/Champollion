---
sidebar_position: 9
title: "Ejecutar un Concurso Soberano"
slug: /network/sovereignty/run-a-sovereign-contest
description: "La ruta de autoservicio de extremo a extremo para que una comunidad u organización ejecute un concurso de MT contra su propio corpus sellado y reservado, sin que Champollion tenga acceso a los datos ni al dinero del premio."
related:
  - label: "Registering Corpora & Exposure Lanes"
    to: /docs/network/sovereignty/registering-corpora
    kind: doc
    note: "The registration lane this path builds on"
  - label: "Data Stewardship"
    to: /docs/network/sovereignty/data-sovereignty
    kind: doc
  - label: "Terms Templates"
    to: /docs/network/sovereignty/terms-templates
    kind: doc
    note: "Adaptable terms ideas, including trojan-horse risks"
  - label: "Prize Specification"
    to: /docs/network/specifications/prizes
    kind: spec
---

# Ejecutar un Concurso Soberano

> **Resumen Ejecutivo.** Una comunidad u organización puede ejecutar un concurso
> de evaluación — incluyendo un premio patrocinado — contra un corpus de prueba
> retenido que **nunca abandona su propia infraestructura**. Usted construye el
> corpus, lo encripta, lo aloja y retiene las claves; la Red registra solo una
> tarjeta de metadatos sin contenido y un resumen de texto cifrado. Los métodos
> califican primero en corpus públicos; cada ejecución contra su conjunto
> sellado requiere la autorización de sus custodios; solo las **puntuaciones**
> salen. Los fondos del premio están **bajo custodia del patrocinador** — por su
> organización o un fideicomiso que designe — y **Champollion nunca toca el
> dinero ni los datos.** Esta página es la guía de inicio a fin, de autoservicio.

:::warning[Qué está disponible hoy vs. en desarrollo]
Tenga claridad antes de comenzar — este es un proyecto de investigación en evolución y no comercial, y preferimos que nos verifique a que nos confíe:

- ✅ **En producción:** registro de corpus (fichas de metadatos, fijación de hashes,
  carriles de exposición), el registro de conjuntos sellados (resumen + grupo de custodios + calificador, sin
  contenido), la maquinaria del concurso con el carril sellado, la capa de datos de solicitud/concesión/auditoría
  de autorización (pendiente → decisión M-de-N → concesión de un solo uso
  acotada en el tiempo, registro de auditoría encadenado por hash de solo adición) y la emisión exclusiva
  de puntuaciones aplicada a nivel de base de datos.
- ✅ **En producción: el nodo de puntuación del organizador.** Un solo comando divide su corpus
  en un conjunto de desarrollo público (el calificador sobre el cual los participantes se autoevalúan) y un conjunto
  secreto sellado contra el cual su nodo ejecuta las entradas, y sella la mitad secreta
  en reposo en SU máquina (`mt-eval contest prepare`). El registro del conjunto o conjuntos sellados,
  el calificador y el concurso es **autoservicio desde su propio inicio de sesión** —
  `contest prepare --self-serve`, o `mt-eval contest register --manifest`
  para un concurso preparado previamente — con cada fila vinculada a una identidad a nivel de
  base de datos; sin intermediación de curadores ni claves privilegiadas (consulte el Paso 4
  para conocer las limitaciones honestas).
- ✅ **En producción: las entradas son MÉTODOS, no traducciones.** Para participar en un concurso
  se entrega al nodo algo que este pueda EJECUTAR. Un participante se autoevalúa en el conjunto
  público de desarrollo (`mt-eval contest qualify`) para obtener un comprobante y luego envía un modelo
  o un método; su nodo vuelve a ejecutar la puntuación de ese comprobante en su propia copia del
  conjunto de desarrollo antes de que se solicite la aprobación de cualquier custodio, y deniega
  la solicitud si hay discrepancias. El nodo selecciona el carril a partir del envío:
  - **Carril A — modelo declarativo (preferido).** Un modelo neuronal estándar son
    DATOS: `mt-eval contest submit-model` envía pesos safetensors + un
    tokenizador declarativo + una configuración — **sin código, sin Dockerfile.** Su nodo
    valida que esté libre de código (safetensors en lugar de pickle; sin
    `trust_remote_code`/`auto_map`; archivos exclusivamente de datos) y ejecuta los pesos en
    su PROPIO motor de confianza (`transformers`, `trust_remote_code=False`, sin conexión).
    La arquitectura es permisiva por defecto (cualquiera que su motor cargue de forma nativa); un
    anfitrión riguroso puede fijar una lista de permitidos. No se ejecuta nada que no sea de confianza,
    por lo que no hay nada que aislar en un sandbox. Publicado como `declarative-model`, identidad del método
    **libre de código por diseño**.
  - **Carril B — paquete ejecutable (alternativa con sandbox).** Para métodos que SÍ son código:
    `mt-eval contest submit-method` envía un Dockerfile + punto de entrada. Después de que su
    custodio lo apruebe, SU nodo lo ejecuta dentro de un contenedor aislado de la red
    (`--network=none` — la pila de red no existe en su interior;
    raíz de solo lectura, privilegios revocados, entorno saneado), realizando primero comprobaciones
    estáticas automatizadas y sin que las referencias ingresen jamás al contenedor.
    Publicado como `method-execution` con identidad **verificada por ejecución**.
  En cualquiera de los carriles: el hash del paquete queda congelado en la solicitud de autorización (lo que
  se ejecuta es demostrablemente lo que se propuso), y las puntuaciones se publican a través de la misma
  vía exclusiva de agregados. Para un aislamiento máximo, la máquina de puntuación puede ser un verdadero
  sistema aislado de la red (air gap): las solicitudes autorizadas y los paquetes de solo puntuaciones firmados
  con Ed25519 se transfieren mediante medios extraíbles (`mt-eval node relay` / `import-bundle` / `export-scores`) —
  el texto secreto nunca llega siquiera a la máquina conectada. Lo que estos carriles NO
  incluyen aún: atestación de hardware del nodo (la identidad se autoreporta),
  mecanismos formales de disputa y —específicamente para el Carril B— un endurecimiento
  más profundo del contenedor más allá de remover la pila de red (perfiles seccomp, microVMs; este
  es un motivo para preferir el Carril A). Consulte
  [Limitaciones honestas](/docs/network/honest-limitations).
- ✅ **La capa de compromisos está en producción (2026-09-07).** Las declaraciones de entrada
  (primaria/contrastiva, pistas), las fases de envío, los resultados retenidos
  (`hidden_until_close`) y el bloqueo que hace que los compromisos declarados
  no puedan editarse una vez que existen entradas se aplican en la base de datos en el
  extremo alojado en la red. Un anfitrión federado obtiene las mismas reglas aplicando la
  migración que se incluye con el entorno de pruebas; frente a un extremo más antiguo, el entorno
  recurre al conjunto base y lo notifica (`declarations_available: false`)
  en lugar de simular compatibilidad. Cuando un paso a continuación indique que *la base de datos congela /
  retiene*, así es literalmente.
- 🔲 **En desarrollo: firma de umbral.** Para un conjunto sellado con
  `champollion seal-corpus`, la aprobación de custodios M-de-N queda *registrada* en las
  tablas de autorización y auditoría, y la clave de sellado es un sustituto
  etiquetado de un solo par de claves (`champollion seal-corpus keygen`). Un conjunto sellado en
  el nodo sin conexión (`mt-eval node seal`) utiliza la **ceremonia de claves** integrada
  del nodo (`mt-eval node ceremony`): la clave del conjunto se divide en M-de-N y
  se reconstruye únicamente en memoria durante una ejecución autorizada por cuórum. Esa ceremonia
  nunca se ha utilizado con un custodio real, y sus partes son archivos de texto sin formato
  en la v1. Ninguna de las vías cuenta con *firma* de umbral: la firma del paquete de puntuaciones
  en aislamiento de red corresponde a una sola clave del nodo (`seal-corpus sign-keygen`).
- ❌ **Inexistente por diseño:** Champollion alojando su corpus, conservando sus
  claves o reteniendo fondos de premios. El paquete de un participante (su propio modelo o código)
  transita por nuestro almacenamiento en camino a su nodo; el contenido de su corpus nunca lo hace.
- ❌ **Eliminado en lugar de dejarse como trampa.** `contest submit-hypotheses` (retirado el 2026-09-06) subía
  traducciones de un conjunto ciego con origen público; `contest submit` (retirado el 2026-09-06) enlazaba una puntuación
  que usted mismo publicaba. Ninguno de los dos
  es ya una vía de participación en concursos. Una ronda ciega con origen público sobrevive únicamente
  como diagnóstico opcional para el organizador, y las puntuaciones autoinformadas siguen perteneciendo
  a la tabla de clasificación abierta —la cual es un panel público indexado por corpus y dirección
  del par, no un concurso.

Si un paso a continuación depende de algo en la lista 🔲, el paso lo dice.
:::

---

## La forma del acuerdo

| Quién | Retiene | Nunca retiene |
|-------|---------|---------------|
| **Usted (comunidad/org)** | El corpus, las claves de encriptación (a través de sus custodios), los fondos del premio, la decisión de otorgamiento | — |
| **Champollion / la Red** | Una tarjeta de metadatos, un resumen de texto cifrado, el registro de autorización + auditoría, las puntuaciones publicadas | Su contenido de corpus, sus claves, su dinero |
| **Desarrolladores de métodos** | Su método | Sus datos de prueba — ven puntuaciones, nunca oraciones |

Todo lo siguiente es la expansión mecánica de esa tabla.

---

## Requisitos previos del organizador

Antes del Paso 1, sepa qué requiere realmente ejecutar el lado del nodo:

- **El entorno de pruebas con su extra de nodo:**
  `python3 -m pip install 'mt-eval-harness[node]'` (0.2.0 o posterior; utilice
  `python3 -m pip`, que funciona en cualquier entorno en el que se ejecute el entorno de pruebas —
  un simple `pip` no está en el `PATH` de todos los entornos virtuales). El extra `[node]`
  agrega la biblioteca `cryptography` que utilizan `mt-eval node keygen`, la ceremonia
  de custodios y la firma de manifiestos de puntuación. Una instalación simple de
  `python3 -m pip install mt-eval-harness` carece de ella, y dichos comandos se detendrán indicando
  esta instalación requerida.
- **docker o podman** — necesario para el carril de ejecución de métodos. El nodo
  detecta automáticamente docker y luego podman (`sandbox.runtime` en `node.json` es `null`
  por defecto; especifique uno allí para exigirlo). Si ninguno de los dos está en el `PATH`,
  `mt-eval node run-method` se rehúsa con una sola línea mencionando a ambos antes de ejecutar
  cualquier cosa, y la solicitud se mantiene tal como estaba para que pueda ejecutarla una vez instalado
  un entorno de ejecución. No existe **ninguna alternativa secundaria**. El aislamiento en contenedores con
  `--network=none` es la garantía fundamental, por lo que nada se ejecuta sin un
  entorno de ejecución de contenedores.
- **Node.js 20.11+ y la CLI de npm `champollion`** — el entorno de pruebas no
  reimplementa el cifrado de sellado. `champollion seal-corpus` (verbos: `keygen`,
  `seal`, `open`, `sign-keygen`, `sign`, `verify`) es la única
  implementación de cifrado (X25519-ECDH → HKDF-SHA256 → AES-256-GCM), y el nodo
  organizador delega en ella mediante subprocesos.
- **Una configuración de nodo en `~/.mt-eval/node.json`.** Todos los comandos `mt-eval node`
  se rehusarán a iniciar sin ella. `mt-eval node init` genera una configuración inicial
  allí (`--print` la muestra en pantalla en su lugar). Contiene su `node_id` autodeclarado
  (vinculado a la huella digital de cada solicitud) y un mapa de `contests` que apunta a su
  conjunto de desarrollo, su conjunto sellado (`secret_set_id` + `secret_artifact`), su conjunto de retención
  sellado si preparó uno (`holdout_set_id` + `holdout_corpus`; elimine
  ambas claves si no lo hizo) y la barrera del calificador público (`qualifier` +
  `dev_corpus`, el umbral en la escala del calificador de 0 a 100). Una vez que haya ejecutado
  `contest prepare` (Paso 1), `mt-eval node init --from-contest ./mytask`
  escribe la configuración inicial con los valores del concurso ya completados a partir de
  `./mytask/local/manifest.json`, y enumera lo que queda pendiente para usted. El mapeo
  que aplica (rellénelo manualmente si lo prefiere):

  | `local/manifest.json` | `node.json` (bajo `contests.<contest-id>`) |
  |---|---|
  | `contest.language_pair` | `language_pair` |
  | `secret.sealed_set_id` | `secret_set_id` |
  | `secret.corpus_sealed_artifact` | `secret_artifact` |
  | `holdout.sealed_set_id` / `holdout.corpus_sealed_artifact` | `holdout_set_id` / `holdout_corpus` (ambos se eliminan cuando no hay conjunto de retención) |
  | `qualifier.corpus_file` | `dev_corpus` |
  | `qualifier.qualifier_id`, `corpus_card_id`, `threshold`, `metric`, `year` | `qualifier.*` (mismos nombres) |
  | `test_suites[].suite_id` / `sha256`, `test_suite_local_copies` | `test_suites[].suite_id` / `corpus_sha256` / `corpus_path`: la copia que leyó `contest prepare` (`--test-suite <id>=<path>`, o una que encontró), cuando se encuentra en esta máquina con los bytes fijados; de lo contrario, configure `corpus_path` |
  | `secret.sealed_block.keyScheme` | `custody`: `single-key` para un conjunto sellado con un único par de claves (luego configure `secret_privkey`), `threshold-quorum` para una ceremonia |
  | `registration.prize_terms` (registrado por `contest prepare` y `contest register`) | `prize_terms_sha256`: el SHA-256 de los términos, el hash que los participantes pasan a `--accept-terms` (se omite cuando el concurso no declara ningún premio) |

  El id del concurso es el `--slug` que proporcionó a `contest prepare` (`mytask` en el
  ejemplo a continuación). Prepare lo registra en el manifiesto, el registro crea
  el concurso bajo dicho id, y es el identificador que los participantes pasan a `contest qualify`
  y `submit-method`, por lo que debe anunciarse junto con el lanzamiento del conjunto de desarrollo; `--contest-id`
  lo anula. (Un manifiesto escrito antes de que se registrara el id conserva el id
  que el registro derivó de su nombre, `"My Task 2026"` → `my-task-2026`,
  porque eso es lo que su concurso, comprobantes y configuraciones de nodo ya utilizan). Ningún
  manifiesto conoce `node_id`, `cards_dir`, `signing_key` ni su archivo de clave privada,
  por lo que permanecen como marcadores de posición `<...>` para que usted los complete.
  `mt-eval node ledger verify` luego lo comprueba y detalla lo que verificó:
  carga la configuración (custodia, toda la barrera del calificador, el par de retención, el
  índice local de fichas), rechaza el primer valor que aún sea un marcador de posición `<...>`
  o un archivo declarado que no esté presente en esta máquina, imprime los conjuntos y archivos de cada
  concurso y, solo entonces, reproduce la cadena de hashes del libro mayor de autorización
  (cero entradas en un nodo nuevo).
- **Un índice local de fichas de idioma incorporado en el nodo.** La puntuación especifica el
  par de idiomas de la ejecución, y el nodo nunca busca un idioma a través de la red.
  Apunte `cards_dir` en `node.json` a un directorio que contenga una ficha para cada
  idioma que su nodo evalúe (o configure `MT_EVAL_CARDS_DIR`); un nodo sin un índice local
  se rehusará a iniciar en lugar de intentar descargarlo. Ninguno de los paquetes instalados
  incluye un directorio de fichas por idioma, así que genere uno en una máquina
  conectada usando la CLI de `champollion`, un archivo `<code>.json` por cada idioma
  de su par:

  ```bash
  mkdir -p node-cards
  champollion network card eng --json > node-cards/eng.json
  champollion network card crk --json > node-cards/crk.json
  ```

  Luego configure `"cards_dir"` con la ruta absoluta de ese directorio. Para un
  nodo con aislamiento físico de red, transfiéralo en el paquete sin conexión
  (`mt-eval node bundle --out <dir> --include node-cards`); se ubicará en
  `<dir>/artifacts/node-cards`, y `cards_dir` apuntará allí en el nodo.
- **Un inicio de sesión.** No existe un paso separado para crear una cuenta: el primer comando
  que requiera una identidad (por ejemplo, `mt-eval contest prepare --self-serve` o
  `mt-eval publish`) abre un inicio de sesión OAuth en el navegador mediante **GitHub o Google**
  (Supabase Auth). El correo electrónico de esa cuenta es la identidad a la que queda vinculada
  cada fila del registro; utilice una cuenta controlada por su organización.
- **Límite de admisión.** Los envíos de los participantes están limitados por
  remitente a un máximo predeterminado de **5 por cada 24 horas** (antisondeo; se configura por concurso
  con `--intake-daily-limit` al momento de preparar, o como valor predeterminado
  de la edición de la tarea compartida). Planifique el cronograma de su concurso considerando esto.

**Una advertencia honesta sobre el registro de autoservicio.** En el **extremo predeterminado
alojado en la red**, el registro de autoservicio (`contest prepare
--self-serve` / `contest register`) actualmente se detiene ante una protección del
extremo de producción: la CLI se rehúsa con un mensaje explícito en lugar de escribir en el
proyecto de producción, a la espera de una decisión de política sobre la apertura de ese acceso. Los anfitriones
federados (su propio proyecto de Supabase) no se ven afectados. Si se encuentra con esta protección en
el anfitrión predeterminado, se trata del estado actual del sistema, no de un
error de configuración de su parte — [abra una incidencia](https://github.com/gamedaysuits/Champollion/issues)
y le guiaremos a lo largo del proceso de registro.

---

## Paso 1 — Construya su corpus de prueba retenido

Diseñe el corpus que medirá, y manténgalo retenido desde el primer día: nada en
él debe haber sido nunca publicado, compartido, o compartido con un proveedor
de modelo.

- Siga el [Marco de Diseño de Corpus](/docs/network/specifications/corpus-design)
  para estructura de entrada, niveles de dificultad, y cobertura de registro, y
  el [Libro de recetas de Creación de Corpus](/docs/network/tutorials/corpus-creation)
  para herramientas.
- Haga que las entradas sean verificadas por hablantes fluidos antes de sellar —
  el [Protocolo de Validación de Hablantes](/docs/network/specifications/speaker-validation)
  describe una estructura de revisión que puede reutilizar para QA de corpus, no
  solo revisión de método.
- Decida la etiqueta de **versión** del corpus ahora (p. ej. `v1`).
  Las concesiones de autorización están vinculadas a una versión específica, por
  lo que el versionado es parte del modelo de seguridad, no de la contabilidad.

### Cómo se divide el corpus

Un solo comando toma su corpus maestro y genera cada nivel, de manera determinista
a partir de una semilla que usted elija y registre:

```bash
mt-eval contest prepare --corpus master.json --slug mytask --name "My Task 2026" \
    --pair 'eng>crk' --seed 20260906 --qualifier-threshold 35 \
    --dev-size 400 --secret-size 500 --sealed-holdout-size 250 \
    --test-suite <a public corpus card id> \
    --license <the licence the rights-holder grants> \
    --custodian-group <opaque id> --threshold-pubkey ./contest.pub.json \
    --out ./mytask
```

`--qualifier-threshold` es la puntuación que un método debe alcanzar en el conjunto público de desarrollo
antes de que su nodo lo ejecute en el conjunto sellado y en el conjunto sellado de retención. Se expresa
en la **escala de calificador de 0 a 100**: la puntuación del calificador es el **chrF++ de corpus**
(sacreBLEU chrF, `word_order=2`) de las salidas de desarrollo frente a las referencias de desarrollo
publicadas —la métrica principal del estándar de puntuación, y el mismo número que destaca
una ficha de `mt-eval run` para esas mismas salidas. No se combina con ninguna otra métrica;
la coincidencia exacta se muestra junto a ella con fines de diagnóstico y nunca actúa como filtro. Su
nodo calcula exactamente el mismo número cuando vuelve a ejecutar un método, por lo que el comprobante
del participante y la medición de su nodo son comparables.

Establezca el umbral a partir de puntuaciones chrF++ que haya medido en este conjunto de desarrollo (ejecute
`contest qualify` sobre las salidas de desarrollo de una línea base), no a partir de puntuaciones en otros
conjuntos de evaluación: los niveles de chrF++ varían considerablemente entre idiomas y corpus.
Un calificador registrado antes del
[estándar de puntuación](/docs/network/specifications/scoring#how-runs-are-scored)
con la métrica compuesta retirada aún funciona: su umbral se interpreta en la escala chrF++,
y qualify lo indica en cada ocasión, por lo que debe confirmar el valor o migrar a un nuevo calificador.

`--license` es obligatorio. Especifica la licencia bajo la cual se ofrece el conjunto
de desarrollo publicado, y mt-eval nunca elegirá una por usted. El archivo publicado la incluye como
`dataset.license`, que es lo que leen `mt-eval run`, `contest qualify` y
`publish`, de modo que las ejecuciones de los participantes quedan reguladas por su licencia. Utilice la concesión
del propio titular de los derechos como un id SPDX. Con `CC-BY-4.0`, los participantes pueden evaluar con cualquier servicio de modelos.
Con una licencia no comercial como `CC-BY-NC-4.0`, los modelos remotos se ejecutan exclusivamente
a través de canales sin entrenamiento. Con términos propios (`LicenseRef-<name>`), la evaluación
remota se rechaza hasta que se registre el permiso del titular de los derechos, exigiendo que
los participantes utilicen modelos locales.

Los archivos publicados también indican los demás términos del maestro, leídos de la
propia ficha del maestro (la ficha del corpus que escribió `champollion network register-corpus`,
a través de su archivo adjunto `<file>.champollion.json`) y de su propio contenedor:
`dataset.do_not_train` y, cuando el maestro está marcado como local únicamente,
`dataset.transmission: "local-only"` (los participantes solo podrán ejecutar el conjunto de desarrollo
con un modelo en su propia máquina), con `dataset.terms_from` especificando la procedencia
de cada uno. Si la ficha del maestro no indica un término de entrenamiento, pase
`--do-not-train true` o `false`; este parámetro puede restringir el término del maestro,
pero nunca flexibilizarlo (se rechazará `--do-not-train false` en un maestro `doNotTrain: true`).
prepare muestra estos términos y advierte si la ficha del maestro indica que la redistribución
está prohibida: publicar `public/` constituye una redistribución, por lo que no debe
publicarlo hasta que el titular de los derechos lo autorice.

| División | Quién lo ve | Para qué sirve |
|---|---|---|
| **Conjunto de desarrollo público** (`--dev-size`) | todos — se publican el origen *y* las referencias | el **calificador**: los participantes se autoevalúan en él antes de poder enviar cualquier propuesta (Paso 8) |
| **Conjunto sellado** (`--secret-size`) | nadie excepto su nodo — el origen *y* las referencias permanecen cifrados | aquello sobre lo cual realmente se evalúa una entrada |
| **Conjunto de retención sellado** (`--sealed-holdout-size`, opcional) | nadie excepto su nodo | una **segunda** división sellada, evaluada en la misma ejecución, cuyas puntuaciones se retienen hasta que cierre el concurso |
| *Conjunto ciego* (`--blind-size`, por defecto 0) | origen publicado, referencias retenidas | una ronda de diagnóstico opcional propia. **No** es una vía de participación: se participa en un concurso entregando un método, nunca subiendo traducciones |

Las divisiones son disjuntas y reproducibles: mismo corpus, misma semilla, misma división,
siempre. La receta se conserva en un manifiesto local del organizador que nunca sale de su
máquina.

**Las frases repetidas permanecen en un solo lado.** La división es disjunta por grupos
(`group-disjoint/1`, registrado en el bloque `split` del manifiesto): las filas que comparten
un origen o una referencia, ya sea de forma exacta o tras normalizar mayúsculas/minúsculas, puntuación
y espaciado, forman un único grupo, y dicho grupo se asigna íntegramente a una sola división. De este modo, ninguna
fila sellada repite una fila del conjunto de desarrollo publicado. Los grupos se barajan con su
semilla y se distribuyen en el orden: desarrollo, ciego, secreto y retención; un maestro sin
frases repetidas obtiene exactamente la división resultante de un barajado fila por fila. Si los grupos
completos no alcanzan a cubrir los tamaños solicitados, prepare se rehusará, indicando la cantidad
de filas repetidas y la solución: eliminar las repeticiones (conservar una fila por grupo)
o solicitar un total inferior al tamaño del maestro para que algunos grupos puedan omitirse.

**`public/` se puede publicar; los registros de ejecución van a `runs/`.** prepare escribe un archivo
marcador, `.champollion-releasable.json`, en `public/`. Los registros de ejecución, informes y
cachés de traducción nunca se escriben allí: `mt-eval run` rechaza un
`--output-dir` o `--cache-dir` en su interior e indica `runs/` junto a él
(`<out>/runs/`) en su lugar, y el comando `run_benchmark` del servidor MCP coloca una ejecución sobre
el conjunto de desarrollo publicado (la línea base que ejecuta para fijar el umbral) en `runs/`
de manera independiente y lo notifica. Un concurso preparado antes de que existiera el marcador se
reconoce por su estructura (`public/` junto a `local/manifest.json`).

**Por qué usar un conjunto de retención.** Con un único conjunto sellado es posible realizar optimizaciones indebidas a lo largo de un concurso
extenso: cada envío es un sondeo, y suficientes sondeos siempre filtran información. Una segunda
división que se evalúa en la misma ejecución autorizada pero cuyos números nadie ve
hasta el cierre le ofrece una lectura limpia al final: si la posición de un sistema cambia entre
ambos conjuntos, obtendrá indicios claros sobre qué parte fue optimización forzada y qué parte traducción real. Ambos
conjuntos quedan cubiertos por **una sola** autorización, por lo que no exige ceremonias adicionales a sus
custodios.

**Conjuntos de prueba de terceros.** `--test-suite` especifica un corpus de diagnóstico público —creado
por un tercero, fijado por SHA y descargable públicamente— en el que también se ejecuta
cada entrada. Dichos números se **reportan y nunca se clasifican**: están allí para que
cualquiera pueda comprobar si una puntuación sólida en el conjunto sellado se mantiene también en un conjunto que su
concurso no diseñó. Champollion rechaza cualquier conjunto que esté en cuarentena,
sin fijar, que no corresponda a su par de idiomas o que coincida con una de sus propias divisiones.

**Una fila sellada que ya es pública no está sellada.** `contest prepare`
compara su conjunto sellado y su conjunto de retención sellado con todo el material público: el conjunto
de desarrollo que publica (la división disjunta por grupos explicada arriba mantiene esto en cero), la
publicación del origen ciego si la hay, y cada conjunto de prueba declarado. Compara
de forma exacta y tras normalizar mayúsculas/minúsculas, puntuación y espaciado (la misma
comparación empleada para agrupar en la división); luego muestra cada superposición con su recuento (por
ejemplo, "30 de 30 filas también aparecen en el conjunto de prueba...") y registra las cantidades
en `local/manifest.json`. Para un conjunto de terceros, emite una advertencia en lugar de
rechazar: el conjunto es texto público ajeno, y usted decide si elimina esas filas del maestro o descarta el conjunto, preparando todo nuevamente. Para verificar un conjunto, prepare necesita sus
frases. Utiliza una copia que ya esté presente en su máquina y nunca realiza descargas
durante la preparación. Especifique su copia con `--test-suite <id>=<path>`; su
sha256 debe coincidir con la fijación del registro. Si no se encuentra ninguna copia, la advertencia indicará
que el conjunto **no fue verificado**, nunca que estaba limpio. El manifiesto registra
la ruta de cada copia leída por prepare, de modo que `node init --from-contest` pueda
apuntar su nodo hacia ella.

El conjunto de retención y los conjuntos de prueba declarados se convierten en compromisos: una vez recibida la primera entrada,
el concurso los congela, impidiendo agregar o eliminar conjuntos de prueba a mitad del concurso.

## Paso 2 — Encriptelo y alójelo en SU infraestructura

Encripte el corpus en reposo (cualquier esquema AEAD moderno — p. ej.
`age`/x25519 o AES-256-GCM) y aloje el **texto cifrado** en algún lugar
que controle. Champollion nunca recibe el texto plano *ni* el texto cifrado.

Publique exactamente un artefacto: el **resumen SHA-256 del blob de texto
cifrado**.

```bash
shasum -a 256 sealed-corpus-v1.age
# → 3b5f0c…e91a  sealed-corpus-v1.age
```

El resumen es público; los datos no. Cualquiera puede verificar más tarde que
el blob evaluado es idéntico byte a byte al blob que selló — integridad sin
posesión. Esta es la misma disciplina de hash-en-lugar-de-copia que el
[registro de corpus ordinario](/docs/network/sovereignty/registering-corpora#1-registration-is-metadata-not-content).

## Paso 3 — Registre la tarjeta de metadatos

Registre el corpus a través del carril de registro estándar, de fallo privado
[registration lane](/docs/network/sovereignty/registering-corpora): una tarjeta
con `language_pair`, `license`, `attribution`, y `do_not_train` — **sin
oraciones**. Elija el carril de exposición **privado**; el registro de conjunto
sellado en el siguiente paso es lo que lo hace elegible para concurso.

## Paso 4 — Regístrelo como un conjunto sellado

Un conjunto sellado es una entrada de registro sin contenido que pone tres cosas
en el registro público:

| Campo | A qué lo compromete |
|-------|---------------------|
| `ciphertext_digest` | Los bytes exactos que cuentan como "el corpus" |
| `custodian_group_id` | Un id opaco para el grupo que controla el acceso (nunca un nombre de org/nación público antes del consentimiento) |
| `current_qualifier_id` | La ronda pública que un método debe superar antes de que incluso se pueda proponer una ejecución sellada |

El registro es **autoservicio, desde su propio inicio de sesión** — sin curador
en el proceso y sin clave privilegiada:

```bash
# Register a contest you prepared with `mt-eval contest prepare --no-register`
mt-eval contest register --manifest local/manifest.json

# Or do it in one shot at prepare time
mt-eval contest prepare … --self-serve
```

El manifiesto permanece en su máquina —el registro solo envía los identificadores,
resúmenes y umbrales sin contenido. Puede revisar exactamente qué se envía antes
de transmitir cualquier dato: `contest prepare --no-register` imprime el plan de registro,
cada fila que escribirá `contest register`, en orden —el identificador de cada conjunto sellado y
el SHA-256 de su texto cifrado (junto con la cantidad de filas que permanecen selladas en su máquina),
el grupo de custodios, el identificador y umbral del calificador, la fila del concurso con sus
compromisos registrados, las columnas de directivas y cualquier conjunto de retención, conjunto de pruebas y términos
de premios integrados en los metadatos del concurso. El plan se genera con el mismo código
que envía las filas, garantizando que no pueda describir algo distinto a lo transmitido.
Cada fila del registro está **vinculada a una identidad**: la
base de datos registra la cuenta autenticada que la inscribió y bloquea esa
vinculación contra modificaciones posteriores; además, un calificador solo puede regular un conjunto sellado que la
**misma** identidad haya registrado. Los conjuntos sellados nacen en cuarentena (nunca pueden
respaldar un concurso ordinario ni figurar en la tabla de clasificación pública), los calificadores nacen
en un estado seguro y el registro tiene límites de tasa —todo ello aplicado mediante
disparadores de base de datos por debajo de cualquier cliente, incluido el nuestro. El registro en sí es
de lectura pública, lo que le permite verificar que su entrada indique exactamente lo que selló —y
nada más.

**Límites honestos.** El acceso por autoservicio opera exclusivamente para el registro (solo inserción a
nivel de base de datos). **La rotación de calificadores y el retiro de conjuntos sellados siguen estando
mediados por curadores** — abra una incidencia o póngase en contacto con el proyecto mediante
[GitHub](https://github.com/gamedaysuits/Champollion/issues). Además, la ejecución del nodo de puntuación del organizador
en los pasos posteriores (avances de ciclo de vida, concesiones de autorización, operaciones
de auditoría) constituye una vía independiente con credenciales de servicio en su propio nodo;
el autoservicio concluye en el registro público.

## Paso 5 — Elija custodios y la regla M-de-N

Elija las personas o instituciones que deben aprobar conjuntamente cada
evaluación contra su corpus, y el umbral (p. ej. **3 de 5**). Los custodios
deben ser responsables ante su comunidad, no ante Champollion — vea
[Administración de Datos](/docs/network/sovereignty/data-sovereignty) y
[Propiedad y Términos](/docs/network/sovereignty/ownership-transfer) para cómo
se establecen términos por comunidad.

**Declaración de transparencia:** la *firma* de umbral (una concesión que materialmente no pueda emitirse
sin M firmas) se encuentra **en desarrollo**. La ceremonia de claves del nodo sin conexión
(`mt-eval node ceremony`, Shamir M-de-N) ya está implementada, pero aún no se ha utilizado
con un custodio real. Por lo demás, la regla M-de-N se aplica como un proceso registrado:
toda solicitud de acceso
ingresa a una cola de estado **pendiente**, las decisiones de los custodios quedan asentadas, se emite una concesión
únicamente para solicitudes autorizadas, y cada concesión es **de un solo uso, con vigencia temporal definida y
vinculada a la huella digital específica de (método, versión del corpus, nodo de evaluación)**;
asimismo, cada evento —incluidos los intentos bloqueados— se incorpora a un **registro de auditoría de solo adición,
encadenado por hashes y de lectura pública**. La base de datos impide transiciones de estado no permitidas
por debajo de cualquier cliente y clave. Lo que aún no puede prevenir es un
compromiso de la seguridad del propio operador de la plataforma; esto es precisamente lo que resolverá la firma
de umbral, y hasta su lanzamiento debe considerar que "Champollion conserva cero partes de claves"
es el objetivo de diseño hacia el cual se construye, no una propiedad verificable hoy en día.

## Paso 6 — Definir el premio y declarar sus términos

El premio es opcional. **Un concurso sin términos de premio declarados simplemente no tiene
premio** —ese es el valor por defecto, y no por ello constituye un concurso menor.

Si decide ofrecer uno, defina y publique junto con el concurso lo siguiente:

- **Monto y moneda.**
- **Patrocinador** — quién aporta los fondos.
- **Dónde se custodian los fondos** — la cuenta de su organización o un fideicomiso comunitario
  que usted designe. **Champollion nunca custodia, retiene en custodia de garantía (escrow) ni transfiere fondos de premios.**
  Publicar la identidad del custodio por adelantado es lo que otorga credibilidad al premio;
  consulte la [nota sobre el riesgo de incumplimiento del patrocinador](/docs/network/sovereignty/terms-templates#trojan-horse-risks)
  en las plantillas de términos.
- **Condiciones de umbral** — el nivel de puntuación que un método debe superar, redactado
  conforme a la [Especificación de premios](/docs/network/specifications/prizes): un umbral
  de chrF++, los filtros de diagnóstico deseados (como una aceptación mínima por FST —un
  filtro que la entrada debe aprobar, nunca la puntuación en sí), requisitos de validación por hablantes
  y reproducibilidad. Asegúrese de que las condiciones de adjudicación
  sean verificables a partir de las puntuaciones publicadas, para que nadie deba depender de su
  palabra (ni de la nuestra) sobre si se superó el umbral.
- **Los términos del premio** — qué sucede con la entrada misma.

### El término del premio lo elige usted

La ejecución es fija: en un concurso soberano, el participante le entrega un modelo o un
método y su nodo lo ejecuta. Lo que ocurra con él *después* de eso queda a su elección,
pudiendo optar por una de estas tres alternativas:

| El término | Qué le comunica a los participantes |
|---|---|
| `pass_to_holders` — *transferir a titulares* | El método se transfiere a ustedes, los titulares soberanos del benchmark. Lo evalúan y lo conservan, sin importar quién resulte ganador. |
| `retain_ip` — *conservar propiedad intelectual* | El participante conserva la propiedad. Ustedes evalúan la entrada y conservan a lo sumo una copia sellada para fines de auditoría. |
| `release_open` — *publicar en abierto* | El participante conserva la propiedad pero debe publicar el método bajo una licencia abierta. Dicha publicación constituye la condición para recibir el premio. |

El detalle se deriva del término elegido, por lo que no hay matrices complejas que completar: lo que
conserva (`retention`), si se transfieren derechos (`rights`), para qué puede utilizarlo
(`host_use`) y si el participante debe publicarlo (`release`) se **derivan**
automáticamente de la opción seleccionada. Dos de las opciones le permiten restringir un
campo específico:

- bajo `retain_ip`, `--prize-retention delete_after_scoring` destruye el artefacto una vez puntuado (la opción por defecto conserva una copia sellada para auditoría);
- bajo `release_open`, `--prize-release-timing` traslada la publicación a `required_before_scores` o `required_after_prize` (el valor predeterminado es `required_before_prize`), y `--prize-release-license` especifica la licencia en lugar de aceptar cualquiera aprobada por la OSI (`any_osi`).

La tabla completa de derivaciones y la forma en que se verifica cada opción antes de un desembolso se detallan en
la [Especificación de premios §2.1, condición 7](/docs/network/specifications/prizes#condition-7-in-detail-the-term-is-one-choice-of-three).

```bash
# The term…
mt-eval contest prepare … --prize-disposition retain_ip

# …with the one narrowing that option offers
mt-eval contest prepare … --prize-disposition retain_ip \
  --prize-retention delete_after_scoring

# …or the same declaration from a JSON file
mt-eval contest prepare … --prize-terms my-terms.json
```

Cualquiera sea su elección, el término se le presenta en lenguaje claro acompañado de un
**SHA-256** antes de asentar cualquier cambio. Dicho hash actúa como token de aceptación:
el participante pasa `--accept-terms <hash>`, la aceptación se empaqueta en su
entrega y queda cubierta por su hash de contenido, y su nodo rechazará cualquier paquete que
haya aceptado condiciones distintas. El término se bloquea en cuanto el concurso recibe su primera
entrada, asegurando que nadie quede sujeto a términos que no haya leído.

El aspecto económico queda deliberadamente *excluido* del término: el monto, la moneda y el
patrocinador constituyen información del concurso; una cláusula sobre la titularidad de un método es una
declaración de naturaleza distinta a una estipulación sobre el monto a pagar.

## Paso 7 — Cree el concurso

Los concursos sobre conjuntos sellados usan el **carril sellado** explícito. La
elegibilidad es de fallo cerrado: el concurso es rechazado a menos que su
registro de conjunto sellado exista y esté activo — y crear el concurso no
otorga a **nadie** acceso al corpus.

```bash
mt-eval contest create \
  --name "EN→CRK Community Challenge 2026" \
  --corpus sealed-eng-crk-v1 \
  --language-pair "en>crk" \
  --visibility public \
  --use-context non-commercial \
  --prize-disposition retain_ip \
  --results-visibility hidden_until_close \
  --anonymize-until-close \
  --description "Community-custodied held-out set; scores-only; prize held by <your org/trust>."
```

Dos de estos parámetros quedan fijos o bloqueados por la base de datos sin importar lo que haga
posteriormente, y otros tres constituyen **compromisos**:

- `--use-context` forma parte de la identidad del concurso: queda fijado en el instante en que
  el concurso se registra y nunca puede modificarse (en su lugar, cree un nuevo concurso).
  El valor por defecto es `non-commercial`.
- `--primary-metric` (por defecto `chrf_plus_plus`), la métrica empleada para la clasificación,
  se congela una vez que el concurso recibe su primera entrada. Un concurso nuevo que intente usar el
  obsoleto `composite` será rechazado indicando el motivo; los concursos registrados antes del
  [estándar de puntuación](/docs/network/specifications/scoring#how-runs-are-scored)
  continúan funcionando con normalidad.
- `--visibility` (por defecto `public`), `--description` y el estado de apertura
  de admisión no se congelan.

Los tres compromisos quedan bloqueados en el instante en que su concurso recibe la primera entrada:

- `--prize-disposition` / `--prize-terms` — el término definido en el Paso 6. Si omite ambos,
  el concurso no tendrá premio.
- `--results-visibility hidden_until_close` — cada puntuación que su nodo mida
  permanecerá **retenida** hasta que cierre el concurso, evitando que los participantes optimicen
  contra el conjunto sellado basándose en sus propios resultados. Este es el comportamiento por defecto; el ejemplo
  lo explicita para que el compromiso conste visiblemente en sus notas. Pase
  `--results-visibility immediate` si prefiere una tabla en tiempo real, donde cada
  ficha se publique a medida que el nodo la procese.
- `--anonymize-until-close` — los participantes aparecerán bajo seudónimos estables en su
  clasificación mientras el concurso permanezca abierto. (Esto aplica a su vista de clasificación;
  no anonimiza la ficha una vez publicada en la tabla general abierta).

Los mismos tres parámetros están disponibles en `contest prepare` y `contest register`,
que es donde la mayoría de los organizadores los configurará, ya que estas vías crean el
concurso automáticamente. Con `contest prepare --no-register`, los parámetros de registro
que usted pase (`--results-visibility`, `--anonymize-until-close`,
`--primary-metric`, las opciones de premios, `--visibility`, `--use-context`,
`--closed-intake`) quedan asentados en `local/manifest.json`, y
`contest register --manifest` los aplicará a menos que pase parámetros específicos en él,
notificándole cuando alguno reemplace un valor registrado. Prepare imprime cada uno de
estos términos con su respectivo valor, indicando si fue proporcionado por usted o si es el predeterminado, y
el momento a partir del cual dejará de ser modificable, antes de registrar nada. Su
opción `--help` detalla cada valor por defecto.

*(El valor `--corpus` es su `sealed_set_id` registrado. El carril sellado se
selecciona **automáticamente** del registro de conjunto sellado — sin bandera
extra; un conjunto sellado nunca puede respaldar un concurso ordinario, y un
conjunto en cuarentena ordinario nunca puede respaldar ningún concurso. Ambas
reglas se aplican en la base de datos, bajo cada cliente. Si registró en el
Paso 4 con `contest register` o `prepare --self-serve`, la fila de concurso **ya existe** —
omita este paso; `contest create` a mano es solo para ensamblar un concurso desde
un conjunto sellado ya registrado.)*

## Paso 8 — Los métodos califican primero en público

Los desarrolladores construyen y evalúan sus métodos en el **conjunto público de desarrollo** que usted
publicó en el Paso 1. El campo `current_qualifier_id` de su conjunto sellado indica dicha ronda, y el
método debe alcanzar su umbral antes de poder si quiera solicitar una ejecución sobre el conjunto sellado. Esto
mantiene a su corpus protegido de sondeos continuos: nadie puede apuntar hacia el conjunto sellado
sin haber demostrado un rendimiento real en un entorno abierto.

El participante lo ejecuta de forma autónoma, sin conexión, con un único comando:

```bash
mt-eval contest qualify <contest-id> --dev my-dev-output.txt \
    --dev-corpus <the dev corpus you released> \
    --system "acme-nmt" --method-class pipeline \
    --offline-qualifier-id <qualifier id> --offline-threshold <threshold>
```

El identificador del calificador y el umbral son los dos datos que el proceso de puntuación requiere de
usted; asegúrese de publicar ambos junto con el lanzamiento de desarrollo. Para un concurso creado mediante `contest
prepare`, el id del calificador es el propio id del corpus de desarrollo (su
`dataset.corpus_id`), y prepare añade el umbral en la descripción del corpus de desarrollo.
Sin los dos modificadores `--offline-…`, qualify los leerá directamente de la base de datos
del concurso. Esto funciona únicamente cuando el concurso ya está registrado en
el extremo al que apunta el participante. Si no existe allí o no es posible comunicarse con la base de datos,
qualify se detendrá e imprimirá el comando sin conexión mostrado arriba, completado
con los propios argumentos del participante.

`--dev` recibe las traducciones del conjunto de desarrollo generadas por el participante, una por línea en
el orden del corpus, en formato JSON indexado por id de entrada, o como el registro de ejecución generado por `mt-eval run
--corpus <the dev corpus>` wrote (or its `_report.json`). Un registro de ejecución se lee por
id de entrada y se verifica que corresponda a una ejecución sobre ese mismo corpus de desarrollo; si contiene
entradas con errores se rechazará, ya que cada entrada debe puntuarse obligatoriamente. El resumen indicará
entonces que las salidas fueron producidas por el entorno de pruebas en dicha ejecución y reevaluadas a partir de su archivo
(junto con el costo de esa ejecución), nunca que se generaron fuera del entorno de pruebas; únicamente
un archivo simple de hipótesis se describe de esa forma.

**Aprobar no equivale aún a un envío.** Tras emitir el veredicto, qualify reporta lo
que ya puede anticipar respecto al envío. Si se trata de una ejecución de un complemento de método cuya carpeta
se encuentra en la máquina, efectúa el mismo análisis estático que ejecutan `submit-method` y su nodo
(bibliotecas de red, utilidades de red en la shell, rutas de sistema de archivos no permitidas) y
muestra cualquier elemento que sería rechazado, como un complemento que importe `urllib`
para invocar a un servidor de modelos. Si se trata de una ejecución mediante el flujo LLM propio del entorno de pruebas (un modelo
accedido vía proveedor), advertirá que no hay un método válido para enviar tal como está:
el nodo ejecuta las entradas sin acceso a la red, por lo que el modelo debe viajar dentro de la entrega
(consulte *Incluya en el paquete cada modelo que su método invoque* más adelante). De lo contrario, la línea de aprobación
enumera las validaciones pendientes al momento de enviar. Nada de esto altera
el veredicto ni el comprobante.

Imprime la puntuación del calificador (el criterio de corte) y el umbral lado a lado,
ambos en la escala de calificación chrF++ de 0 a 100, detallando a continuación la naturaleza de la puntuación: chrF++
de corpus con su firma sacreBLEU, las demás métricas estándar junto a ella
(sin combinar jamás), la coincidencia exacta como diagnóstico que nunca actúa como filtro y cualquier
observación sobre el puntaje. Qualify no publica nada. Cualquier sistema cuyas salidas de
desarrollo sean en su mayoría copias del texto fuente será rechazado sin importar su puntuación:
cuando la mitad o más coincida con el origen (ignorando mayúsculas, tildes y puntuación, y omitiendo líneas
cuya referencia sea el propio origen, como nombres propios), se considera que el participante no está traduciendo. La misma regla lo rechazará nuevamente cuando
su nodo vuelva a ejecutarlo. Esto genera un **comprobante de calificación** en su
máquina, sin el cual `submit-model` y `submit-method` se rehusarán a construir
el envío. Los comprobantes se guardan por concurso y por sistema (`--system`),
de modo que quien califique dos sistemas conservará ambos; calificar nuevamente el mismo
sistema mantiene el comprobante anterior de forma paralela. `submit-method` y
`submit-model` utilizan el comprobante correspondiente a `--system` (por defecto: el de `--name`,
o el único comprobante del concurso) y emitirán un error, listando las opciones, en caso de ambigüedad. El comprobante
es autodeclarado por diseño —por lo que no es lo que otorga el acceso definitivo. Antes de
reclamar cualquier concesión, **su nodo vuelve a ejecutar el método enviado sobre el mismo conjunto de desarrollo** y
compara su propia medición contra lo declarado; un comprobante que sobrestime el rendimiento del método
será rechazado allí mismo, indicando en la denegación el valor declarado frente al medido.

**Un comprobante especifica la ejecución de origen.** Cuando `--dev` es un registro de ejecución (o su
`_report.json`), el comprobante registra la corrida y el modelo ejecutado: para
`mt-eval run --method local-model -m <model>`, el identificador y la revisión de Hugging Face,
o el directorio del modelo junto con el SHA-256 de sus archivos. Cualquier registro de ejecución de
`local-model` que no especifique un modelo será rechazado —las versiones iniciales de la 0.2.0
no pasaban `-m` a ese motor, el cual ejecutaba en su lugar un modelo alternativo inglés→español.
`submit-model` valida entonces que los pesos empaquetados figuren
entre los archivos indicados en el comprobante y, si no coinciden, rechaza la operación detallando ambos hashes.
Un comprobante obtenido a partir de un archivo simple de hipótesis no menciona ningún modelo; la
reejecución en el nodo constituye la verificación en ese caso.

**Las discrepancias entre el comprobante y el nodo quedan señaladas.** Ambos valores
se calculan exactamente de la misma manera —el mismo evaluador, el mismo conjunto de desarrollo y, para un modelo,
la misma regla de longitud de decodificación—, por lo que los mismos pesos convergen a una fracción
de punto de diferencia. Cuando la cifra del nodo y la del comprobante difieren en más de **2.0
puntos** en la escala de calificación de 0 a 100, el nodo lo reporta tras su
reejecución; un nodo aislado de la red registra además la discrepancia junto con su validación en el libro contable
local y la muestra nuevamente al custodio en `node approve
--offline`. Se trata de una advertencia, nunca de un rechazo automático:
el valor determinante es la propia medición del nodo. (El límite de 2.0 es una decisión deliberadamente
conservadora orientada a advertir con facilidad; es un valor de política que el organizador
puede ajustar si lo considera necesario).

### Los participantes pueden ensayar todo el proceso antes de enviar

Nadie debería enterarse de que su paquete contenía errores mediante un rechazo recibido días
después. `mt-eval contest validate` ejecuta, en la máquina del participante y sin conexión
a la red, exactamente lo mismo que su nodo valida en primer término:

```bash
# the static checks your node runs on a bundle
mt-eval contest validate ./my-bundle.tar.gz

# …and the qualifier: does my dev output line up, and does it clear the bar?
mt-eval contest validate ./my-bundle.tar.gz --contest <contest-id> \
    --dev my-dev-output.txt --dev-corpus <released dev corpus>
```

Muestra una tabla con los resultados y sale con código de error si detecta cualquier elemento rechazable
(`--json` para integración con herramientas). Recomiende su uso a los participantes en su convocatoria:
les cuesta un solo comando y le evita gestionar denegaciones innecesarias.

`validate` no escribe ningún archivo. Vuelve a evaluar la salida de desarrollo sin generar
un comprobante y luego verifica el comprobante existente:

- **Un paquete listo** (el archivo `.tar.gz` que generó un comando submit) incluye el
  comprobante con el que fue empaquetado, siendo esa la copia que su nodo analizará. Por ello,
  validate realiza el ensayo contrastando dicha copia. También localiza en la máquina del participante
  el comprobante de origen e indica el sistema al que corresponde, sin importar el nombre del método del paquete.
  Genera una advertencia si `--system` apunta a un comprobante distinto, o si el participante volvió a
  calificar ese sistema tras haber empaquetado (el paquete conservará el comprobante anterior). Si no se proporcionan
  los modificadores `--offline-…`, el id del calificador y el umbral se toman también de dicha
  copia, lo que implica que reflejan los valores provistos por el participante a `contest qualify`.
  El reporte lo indica explícitamente.
- **Un directorio fuente** empaquetado para validación con `--manifest`: validate
  utiliza el comprobante que incorporarán `submit-method` y `submit-model`, localizándolo
  con el mismo criterio: `--system`, en su defecto el comprobante nombrado como el
  método del paquete, o el único comprobante del concurso.

Emitirá una advertencia si ese comprobante cubre una salida de desarrollo diferente, otro archivo de desarrollo
u otro calificador. También alertará si no se encuentra ningún comprobante. Los comprobantes se obtienen
exclusivamente mediante `contest qualify`.

Es un ensayo previo, y así lo explicita. Su nodo compilará la imagen sin acceso
a la red, ejecutará el contenedor y repetirá el proceso de calificación por su cuenta. Una validación limpia
significa que no se ha detectado ningún error *evidente de antemano* —no garantiza que la ejecución puntúe exitosamente.

:::note[Participantes: ¿en qué extremo se aloja su concurso?]
Un concurso **alojado en la red** no requiere configuración de extremos —el extremo por defecto con el que
se distribuye el entorno de pruebas contiene toda la infraestructura del concurso (la barrera del calificador,
propuestas de métodos, autorización), y `mt-eval contest submit-model` /
`submit-method` se comunican con él directamente. Requiere la versión **0.2.0 o superior** del entorno de pruebas
(`mt-eval --version`); las versiones anteriores carecen de `qualify`, `validate`, `rank` y
`close`. Los concursos alojados en la red se abren únicamente cuando un organizador se registra
mediante la vía explicada en la advertencia anterior, por lo que la mayoría de los concursos actuales son
**federados**.

Un concurso **federado** — el organizador ejecuta la maquinaria en su propio proyecto de Supabase, por lo que los envíos nunca transitan el nuestro — publica su punto final con los materiales del concurso. Expórtelo antes de enviar:

```bash
export MT_EVAL_SUPABASE_URL=https://<contest-host>.supabase.co
export MT_EVAL_SUPABASE_ANON_KEY=<contest-anon-key>
```

Si el arnés apunta a un punto final que no tiene la maquinaria de concurso (digamos, un host federado sin una migración), el comando se detiene con *"el carril de concurso aún no está disponible en este punto final de Supabase"* y le dice a qué punto final estaba hablando. (Organizadores federados: publiquen estos dos valores junto con su lanzamiento de corpus, `--node-id`, y `--corpus-version`.)
:::

## Paso 9 — Ejecuciones selladas: solicitar, autorizar, ejecutar, puntuaciones fuera

Para cada entrada:

1. Se registra una **solicitud** contra su conjunto sellado —ingresa en estado `pending` y
   contiene una huella digital inmutable de (hash del paquete, id del corpus, versión del
   corpus, `scores-only`, medición del nodo de evaluación).
2. Su nodo realiza sus **propias comprobaciones estáticas** sobre el paquete. Si se trata de una entrada con código
   (Carril B), valida además que pueda ejecutarla: presencia de un entorno de ejecución de contenedores
   y que la memoria RAM, el disco temporal y el tiempo de ejecución declarados se ajusten a los límites de `sandbox`.
   Una incompatibilidad aquí no constituye un juicio sobre el método. La
   denegación detalla cada diferencia ("se solicitaron 8 GB de RAM, este nodo permite 4 GB
   (sandbox.max_ram_gb)"), no se ejecuta ni se rechaza nada, y la solicitud permanece
   intacta. Puede ampliar el límite en `node.json` y volver a ejecutar
   `mt-eval node run-method <id>` sin necesidad de reenviar. Alternativamente, el participante puede
   volver a empaquetar utilizando los modificadores indicados en la denegación (por ejemplo, `--ram-gb 4`);
   al estar los requisitos integrados en el hash del paquete, esto constituirá una nueva solicitud.
   A continuación, el nodo **vuelve a ejecutar el reclamo del calificador del participante** sobre su propia
   copia del conjunto público de desarrollo. Su comprobante es una declaración; esto constituye la
   medición real. Cualquier discrepancia provoca
   el rechazo en esta instancia —antes de solicitar la aprobación de ningún custodio y antes
   de abrir el conjunto sellado—, detallando lo declarado, lo medido y el umbral exigido. Un paquete que haya aceptado términos de premio distintos a los declarados por su concurso será rechazado en este mismo punto.
3. Sus **custodios toman una decisión** (M-de-N). La aprobación genera una **concesión**: de un solo uso,
   con caducidad y válida exclusivamente para esa huella digital exacta.
4. La evaluación se ejecuta dentro del sandbox aislado de la red en **su** nodo
   (`mt-eval node run-method`): un contenedor sin pila de red, con las referencias
   almacenadas fuera de él —o, para un aislamiento absoluto, en un equipo físicamente desconectado
   cuyos paquetes firmados de solo puntuaciones se transfieren mediante medios extraíbles (consulte el cuadro de estado
   anterior para ver el alcance cubierto). Un nodo en la oscuridad no sube nada a la red: usted
   extrae su paquete de puntuaciones firmado y publica la ficha de ejecución desde una máquina conectada
   (`mt-eval node relay`). Su conjunto sellado de retención y cualquier conjunto de pruebas de terceros declarado se ejecutan
   dentro de la **misma** corrida autorizada, evitando trámites adicionales a sus custodios.
5. **Solo se transmiten puntuaciones.** La directiva de emisión de `scores-only` está protegida
   a nivel de base de datos; nunca se publica texto por entrada proveniente de su corpus.
6. Si su concurso se comprometió a usar `hidden_until_close`, la puntuación no se hace pública
   todavía: permanece **retenida** como un resultado diferido visible únicamente para usted, y
   `contest close` publica cada ficha retenida antes de congelar la
   clasificación definitiva. Un resultado retenido jamás se pierde.
7. Cada etapa —solicitud, votaciones, concesión, ejecución y cualquier intento bloqueado— se
   incorpora al registro de auditoría público y encadenado por hash que usted (y cualquiera) puede auditar.

## Envío de métodos (para participantes) — dos carriles

La mayoría de las entradas de traducción automática neuronal (NMT) no son complejas: un transformador estándar ajustado (fine-tuned) y sus
respectivos pesos. Para estas existe un **carril preferido y libre de código**, además de una
alternativa con sandbox para aquellos métodos que requieran ser código de forma estricta.

### Carril A — modelo declarativo (preferido para NMT estándar)

Si su método corresponde a un modelo neuronal estándar, lo envía como **datos** —los
pesos, el tokenizador y la configuración— y el organizador lo procesa en su propio motor
de inferencia de confianza. **Sin Dockerfile, sin código, sin sandbox.** Dado que nada de lo
enviado se ejecuta directamente, la verificación de seguridad del organizador se reduce a una validación de formato comprobable
en lugar de tener que demostrar que un código arbitrario es seguro —lo que constituye una garantía estrictamente
superior tanto para usted como para la integridad del corpus.

```bash
mt-eval contest submit-model <contest-id> \
  --model-dir ./my-model \          # config.json + model.safetensors + tokenizer.* at the ROOT
  --name "My NMT" --version 2.0 \
  --architecture MarianMTModel \    # must be on the organizer's trusted whitelist
  --method-class pipeline --paradigm neural-nmt \
  --track constrained --training-data-file ./training-data.txt \
  --parameter-count 92487 \
  --weights-license Apache-2.0 --weights-public \
  --developer "Your Name" --node-id <organizer-advertised-node-id> --agree
```

**Un modelo entrenado con NMT Forge.** `nmt-forge export` genera la
carpeta desplegable `export/model/`. Además de los pesos, la configuración y el tokenizador,
contiene `forge-model.json` (las puntuaciones de dicho modelo en su conjunto de prueba privado
y rutas locales), `DEPLOY.md` y `champollion-plugin/`, ninguno de los cuales forma
parte de una entrada. `submit-model` empaqueta únicamente los archivos que transformers requiere
(pesos, `config.json`, `generation_config.json` y los archivos del tokenizador) y
detalla todo lo que ha excluido, manteniendo esos tres elementos fuera de forma automática.
La Sección 6 de dicho `DEPLOY.md` enumera los archivos que componen la entrada, la
arquitectura tomada de `config.json` y la cantidad de parámetros leída del
encabezado del archivo de pesos, indicando el comando exacto. Para enviar únicamente los archivos
que usted haya revisado, cópielos en una carpeta independiente y proporciónela mediante
`--model-dir`:

```bash
mkdir -p lane-a
cp export/model/config.json export/model/generation_config.json \
   export/model/model.safetensors export/model/tokenizer.json \
   export/model/tokenizer_config.json lane-a/      # the files DEPLOY.md §6 lists
mt-eval contest submit-model <contest-id> --model-dir lane-a \
  --architecture MarianMTModel --paradigm neural-nmt …
```

**Qué recuento de parámetros considerar.** El Carril A valida `--parameter-count` contrastándolo con el
archivo de pesos. Realiza la sumatoria del tamaño de los tensores en el encabezado de `safetensors` y
rechaza cualquier valor declarado con más del 1% de desviación. Ese es el valor almacenado en el archivo, el cual
puede diferir del cálculo realizado en memoria con torch. Un peso compartido o vinculado se almacena una sola vez. Una
matriz que el modelo reconstruye al cargarse, como las posiciones sinusoidales, podría no
guardarse en absoluto. El mensaje de rechazo mostrará el recuento del archivo; declare exactamente esa cantidad.

Reglas que debe cumplir su paquete (validadas localmente antes de la subida y comprobadas
nuevamente por el nodo del organizador):

- **Los pesos deben estar en formato `safetensors`, nunca pickle.** Un archivo `.bin`/`.pt`/`.ckpt` de PyTorch
  es un pickle —código arbitrario ejecutable al cargarse— y será rechazado. Debe exportar a
  `model.safetensors` (`safetensors` / `transformers` lo hacen de forma nativa).
- **Una arquitectura soportada nativamente por el motor del organizador.** El valor de `config.json` en
  `architectures` puede ser cualquier arquitectura implementada por la biblioteca `transformers` del anfitrión
  (Marian, NLLB/M2M100, mBART, T5, Pegasus, entre muchas otras) —los anfitriones son
  **permisivos por defecto**, ya que con `trust_remote_code=False` la seguridad
  recae en el formato libre de código y no en el nombre de la arquitectura (una arquitectura no
  soportada simplemente fallará al cargar, sin ejecutar nada). Un anfitrión precavido puede
  publicar una lista de permitidos. Quedan totalmente prohibidos `auto_map` y `trust_remote_code`, ya que reintroducen
  código personalizado encubierto y se rechazarán sin excepción.
- **Un tokenizador declarativo** (`tokenizer.json` o una combinación de `sentencepiece` `.model` +
  vocabulario) y **únicamente archivos de datos** —ningún archivo `.py`, script o binario dentro del paquete.

**Qué incluye `submit-model`.** Los archivos de datos situados en la raíz de `--model-dir`
(`.safetensors`, `.json`, `.model`, `.txt`, `.spm`, `.vocab`, `.merges`): los
pesos, la configuración, el tokenizador y la configuración de generación. Cualquier otro elemento —como
`README.md` o `DEPLOY.md`, subcarpetas o puntos de control pickle junto a los
safetensors— queda excluido, y el comando detallará lo omitido. Por lo tanto, la
carpeta `model/` generada por `nmt-forge export` puede enviarse directamente: sus archivos `DEPLOY.md`
y `champollion-plugin/` no se incluirán. `contest validate` empaqueta siguiendo la misma lógica
y notifica los archivos omitidos como un hallazgo de tipo INFO. La verificación en su nodo se mantiene
idéntica: cualquier paquete que contenga un archivo que no sea estrictamente de datos será rechazado allí.

**Longitud máxima de las salidas.** Su nodo decodifica con una longitud explícita en
todo momento: el valor `max_new_tokens` o `max_length` que declare el modelo (su
`generation_config.json`) o, en su defecto, hasta `max(64, 4 × source tokens)` nuevos tokens
por oración, con el tope de las posiciones del decodificador. `mt-eval run --method
local-model` decodifica bajo esta misma regla, garantizando coincidencia entre el comprobante del participante
y la reejecución de su nodo. `submit-model` muestra la longitud que se aplicará
y la asienta en el manifiesto (`model.decodeLength`); el nodo registra la
longitud efectiva empleada en los datos de ejecución de la corrida (`execution.generation`).
Si no se fija una longitud explícita, la biblioteca transformers se detiene alrededor de los 20
tokens, lo que provocaría que todas las entradas se evaluaran sobre salidas incompletas.

El organizador lo ejecuta mediante `trust_remote_code=False`, sin conexión, y solo se emiten
las puntuaciones —publicadas bajo `declarative-model`, con identidad de método **libre de código
por construcción**. (Para pesos de varios gigabytes: recurra al carril sneakernet mediante `--bundle-out`,
tal como se indica más adelante).

### Carril B — paquete ejecutable (sandbox para métodos con código)

Si su método constituye código real —una canalización (pipeline), un híbrido asistido por LLM, un
decodificador personalizado—, no puede procesarse de forma declarativa, por lo que se canaliza a través del
sandbox aislado de la red. Este carril ofrece garantías objetivamente menores (ejecuta código no
confiable en lugar de rechazarlo), por lo que se recomienda usar siempre el Carril A siempre que el método sea
un modelo estándar.

**Incluya en el paquete cada modelo que su método invoque.** El nodo ejecuta su entrada sin ningún
acceso a la red; por lo tanto, cualquier método que realice llamadas a la API de un modelo alojado (como un
híbrido asistido por LLM que consulte un servicio en la nube o un servicio externo de traducción automática) no obtendrá respuesta y no
obtendrá puntuación alguna. Un híbrido asistido por LLM calificará únicamente si incluye su LLM dentro del paquete:
pesos abiertos bajo `/method`, ejecutados en el mismo proceso o mediante un servidor local iniciado por su
punto de entrada. El mismo principio aplica para cualquier diccionario, FST u otro recurso de datos que su
método consulte en tiempo de ejecución. (La [especificación de métodos](/docs/network/specifications/methods#method-validity-and-dependency-classes)
clasifica a los métodos dependientes de LLM alojados en la clase de dependencia A1; la pasarela necesaria
para permitir su ejecución dentro del sandbox aún no ha sido desarrollada).

**El contrato del paquete ejecutable opera sobre stdin/stdout.** Dentro del contenedor,
el nodo del organizador ejecuta exactamente lo siguiente:

```
cat /eval/source.txt | <your entrypoint> > /output/translations.txt
```

Las oraciones de origen se reciben una por línea a través de stdin; usted debe emitir una traducción por
línea hacia stdout. El contenedor carece por completo de pila de red (`--network=none`), cuenta con un
sistema de archivos raíz de solo lectura y un directorio escribible en `/tmp`.

**Ubicación de sus archivos.** La totalidad del contenido de la carpeta provista en `--method-dir`
se empaqueta bajo `method/` dentro del archivo y se monta **en modo solo lectura en `/method`**
durante la ejecución, incluyendo los pesos, por lo que no se requiere copiar nada dentro de la imagen. Organícelo
de la siguiente forma:

```text
my-method/              ← --method-dir ./my-method
  translate.py          ← --entrypoint translate.py   (runs as /method/translate.py)
  weights/              ← read at /method/weights
  wheels/               ← vendored dependencies (see the Dockerfile below)
Dockerfile              ← --dockerfile ./Dockerfile
training-data.txt       ← --training-data-file ./training-data.txt
```

`--entrypoint` corresponde a la ruta del script dentro de `--method-dir`. Su ruta dentro del paquete,
`method/translate.py`, también es válida. Si un nombre pudiera hacer referencia a dos
archivos distintos, el comando se detendrá indicando ambos; si el archivo no existe, reportará
cada una de las rutas exploradas.

**Un envoltorio mínimo de transformadores de Hugging Face:**

```python title="my-method/translate.py"
#!/usr/bin/env python3
import sys
from transformers import AutoModelForSeq2SeqLM, AutoTokenizer

tok = AutoTokenizer.from_pretrained("/method/weights")
model = AutoModelForSeq2SeqLM.from_pretrained("/method/weights")

for line in sys.stdin:
    inputs = tok(line.strip(), return_tensors="pt", truncation=True)
    out = model.generate(**inputs, max_new_tokens=256)
    print(tok.decode(out[0], skip_special_tokens=True), flush=True)
```

**El Dockerfile debe compilarse sin red.** El organizador compila su imagen con `--network=none` — la prueba de compilación sin aire *es* la compilación — por lo que cada dependencia debe estar **incluida en el paquete** (un `pip install` que llega a PyPI falla la compilación, y el escaneo estático previo al vuelo marca llamadas de red antes de que se envíe algo). Incluya ruedas dentro de su directorio de método e instale desde ellas:

```dockerfile title="Dockerfile"
FROM python:3.11-slim
# The build context is the bundle root: Dockerfile + method/
COPY method/wheels/ /wheels/
RUN python3 -m pip install --no-index --find-links=/wheels torch transformers sentencepiece
# Weights are NOT copied — /method is mounted read-only at run time.
```

**Requisitos indispensables para todo envío.** Los siguientes parámetros son obligatorios, y el comando
se detendrá antes de cualquier operación de red si falta alguno de ellos:

- `--method-dir`, `--dockerfile`, `--entrypoint`, `--name`, `--version`,
  `--method-class`, `--developer`, `--node-id` y `--agree`;
- un **comprobante `mt-eval contest qualify` aprobado** para este concurso y este
  sistema (Paso 8; `--system` lo especifica en caso de haber calificado más de uno);
- dos declaraciones, que constarán formalmente como sus reclamos: `--track constrained` o
  `--track unconstrained` (no hay opción predeterminada), y `--parameter-count`;
- para métodos con pesos entrenados (`--parameter-count` mayor a 0): también
  `--weights-license <SPDX id or LicenseRef-…>` y uno entre `--weights-public`
  o `--weights-private`;
- para métodos **sin pesos entrenados** (basados en reglas, diccionarios, FST):
  `--parameter-count 0` y ningún parámetro de pesos. La entrega registrará la licencia
  y apertura de los pesos como no aplicable, evitando requerir la invención
  de una licencia ficticia;
- para métodos que **utilizan prompts hacia un LLM** (no entrenan parámetros propios, únicamente generan
  prompts): el valor corresponderá a la suma de los parámetros de cada modelo ejecutado dentro del paquete,
  incluyendo el LLM, aun cuando usted no lo haya entrenado. Tome dicha cifra de la ficha del modelo LLM
  o del encabezado de sus pesos, y proporcione la licencia del LLM mediante
  `--weights-license` junto con `--weights-public` si sus pesos son de descarga abierta.
  Asignar `--parameter-count 0` falsearía la naturaleza del sistema: 0 indica que el método
  no ejecuta ningún modelo. Un método que invoque un LLM alojado externamente no puede participar
  en un concurso sellado: el nodo carece de red y la pasarela requerida para intermediar dichas
  llamadas aún no está desarrollada (consulte *Incluya en el paquete cada modelo que su método invoque*
  más arriba). `contest qualify` alertará de esto si las salidas
  evaluadas se generaron a través de un proveedor;
- con `--track constrained`: `--training-data-file`, una lista en texto plano con los
  datos empleados en el entrenamiento (un método que no utilizó datos lo indicará explícitamente en el archivo);
- si el concurso estipula términos de premio: `--accept-terms <hash>` (ejecútelo una vez
  sin este parámetro y se mostrarán los términos junto con el hash requerido); si exige
  descripciones: `--description-file`.

**Declaración de recursos del método.** El paquete debe detallar los requisitos de memoria RAM,
disco temporal y tiempo de ejecución (wall-clock) necesarios; el nodo del organizador rechazará cualquier paquete
que exceda los límites fijados en sus opciones de `sandbox`. Los valores por defecto corresponden a los límites de la
plantilla de nodo generada por `mt-eval node init`: `--ram-gb 4`, `--disk-gb 4`,
`--max-runtime-minutes 30`, sin GPU. Por lo tanto, un paquete configurado con los valores por defecto
podrá ejecutarse en cualquier nodo que mantenga los límites estándar de la plantilla. Si su
método demanda mayores capacidades, declárelo mediante dichos modificadores (junto con `--gpu`) y verifique que el
nodo del organizador los admita. Los organizadores que ajusten estos topes deben publicarlos
junto con las bases del concurso. Si el nodo deniega la ejecución, el mensaje detallará cada valor
solicitado frente a lo permitido por el nodo.

Envíelo con:

```bash
mt-eval contest submit-method <contest-id> \
  --method-dir ./my-method --dockerfile ./Dockerfile \
  --name "My NMT" --version 1.0 \
  --entrypoint translate.py \
  --method-class pipeline --paradigm neural-nmt \
  --developer "Your Name" --node-id <organizer-advertised-node-id> \
  --track constrained --parameter-count 78000000 \
  --weights-license Apache-2.0 --weights-public \
  --training-data-file ./training-data.txt \
  --primary \
  --agree
```

El nodo del organizador repite la ejecución de su método sobre su propia copia del conjunto público
de desarrollo antes de someter la corrida a la aprobación de cualquier custodio. `--agree` confirma
la aceptación de los términos para el envío de métodos.

**Pesos de gran tamaño o entornos sin conexión: empleo del carril sneakernet.** El flujo
de admisión en línea transfiere su archivo comprimido mediante una **única petición POST** hacia el
almacenamiento del anfitrión del concurso, quedando condicionado por el límite de carga de dicho servicio —adecuado
para código y modelos reducidos, pero restrictivo para puntos de control de gran volumen. El contrato de empaquetado
soporta artefactos sustancialmente mayores (archivos tarball de hasta 100 GB e imágenes compiladas de hasta
150 GB). `--offline` genera el paquete y produce un directorio de intercambio prescindiendo totalmente
de la red. Al no existir conexión, no hay registro de concurso disponible para consultar,
debiendo suministrar manualmente los valores publicados por el organizador: `--bundle-out`,
`--secret-set`, `--pair`, `--developer-email`, `--offline-qualifier-id` y
`--offline-threshold` (el umbral dentro de la escala de calificación de 0 a 100). Ejemplo de empaquetado fuera de línea
para un método basado en reglas sin pesos:

```bash
mt-eval contest submit-method <contest-id> \
  --method-dir ./my-method --dockerfile ./Dockerfile \
  --name "My Rules" --version 1.0 \
  --entrypoint translate.py \
  --method-class pipeline --paradigm rule-based \
  --developer "Your Name" --developer-email you@example.org \
  --node-id <organizer-advertised-node-id> \
  --track constrained --parameter-count 0 \
  --training-data-file ./training-data.txt \
  --agree \
  --offline --bundle-out ./exchange \
  --secret-set <sealed-set-id> --pair 'eng>crk' \
  --offline-qualifier-id <published-qualifier-id> --offline-threshold 35
```

El directorio de intercambio viaja al organizador por medios removibles (o cualquier canal en el que ambos confíen); lo ingieren con `mt-eval node import-bundle`. El SHA-256 del paquete se congela en la solicitud de autorización de cualquier forma, por lo que lo que se ejecuta es demostrablemente lo que propuso.

**Para organizadores: una propuesta fuera de línea requiere la validación del custodio al igual
que una en línea —y el nodo la verifica primero, siguiendo el orden del Paso 9.** Ingresa con estado
*pendiente*, registrando el nodo desconectado tanto sus verificaciones internas como
la resolución del custodio de forma directa, sin recurrir a bases de datos ni claves de servicio:

```bash
mt-eval node import-bundle ./exchange               # stages it: PENDING custodian approval
mt-eval node run-method <request-id> --offline      # the node's checks: re-runs the entrant's qualifier, checks the container runtime
mt-eval node list --offline                         # what is staged, checked, approved or waiting, and the next command
mt-eval node approve <request-id> --offline --actor <custodian>
#   or: mt-eval node deny <request-id> --offline --actor <custodian> --reason "…"
mt-eval node run-method <request-id> --offline      # the sealed run: refuses until the approval is recorded
mt-eval node export-scores ./exchange               # signed scores, or the signed refusal
```

La ejecución inicial de `node run-method --offline` sobre una propuesta pendiente no desbloquea ningún elemento
sellado. Repite la calificación del participante sobre el conjunto público de desarrollo (definido por
`qualifier` + `dev_corpus` según declare su `node.json`; `node init
--from-contest` autocompleta ambos) y, para entregas con código, constata la existencia de un entorno de ejecución
de contenedores y que la RAM, el disco temporal y el tiempo de ejecución declarados no superen los
límites de `sandbox`. Si la prueba resulta satisfactoria, se registra en el libro contable local
encadenado por hashes del nodo. Cualquier fallo en la calificación genera el rechazo inmediato en esta instancia,
asentándose como denegación propia del nodo y retornando al participante como rechazo firmado: no se eleva consulta
a ningún custodio. Si el nodo no se encuentra en condiciones de ejecutar la entrega (ausencia de entorno de ejecución, topes insuficientes),
deniega la acción catalogándola como incidencia del nodo sin asentar registros, manteniéndose la solicitud en su estado previo.

`node approve --offline` se negará a operar hasta que dicha comprobación aprobatoria figure asentada en el libro mayor
para la huella y el paquete específicos de la solicitud, indicando en su error el comando
que debe ejecutarse previamente. Posteriormente, incorpora el voto y la autorización en el
mismo libro contable (el empleado durante la ceremonia de partición de claves con custodios) junto con un acta de resolución
firmada mediante `signing_key` del nodo, vinculándola a la validación sobre la que se fundamentó. La
segunda ejecución de `node run-method --offline` comprueba estos tres aspectos antes de acceder al material sellado
(verificación de integridad del libro mayor, autorización expresa de la solicitud bajo la
huella importada y correspondencia de la resolución firmada con la solicitud en curso), garantizando que ninguna propuesta pendiente
pueda procesarse bajo la sola voluntad de un operador. Seguidamente, vuelve a comprobar el entorno de ejecución y el calificador
antes de abrir el conjunto sellado. Si se determina una denegación, esta se asienta bajo el mismo mecanismo y se remite al participante
como rechazo firmado; un custodio puede denegar la solicitud en cualquier instancia, con o sin verificación previa.
Aquellas solicitudes que ingresen con autorización previa —sea mediante exportación por retransmisión (autorizadas en la
base de datos del concurso) o vía `node stage-request` (donde el organizador en pruebas actúa como autoridad)—
no demandan una segunda deliberación.

**Organizadores: precargue imágenes base en máquinas sin aire.** Porque la compilación de imagen se ejecuta con `--network=none`, la imagen base `FROM` del Dockerfile ya debe estar en el almacén de imágenes local de la máquina. En una máquina conectada, `docker pull python:3.11-slim && docker save -o base.tar python:3.11-slim`; lleve `base.tar` con el paquete; en la máquina sin aire, `docker load -i base.tar` antes de ejecutar `mt-eval node run-method`. Acuerde sobre la(s) imagen(s) base con los participantes en sus materiales de concurso publicados.

## Paso 10 — Clasificar, cerrar y exportar

Los resultados que contienen únicamente puntuaciones se publican en la [tabla de clasificación](/docs/network/leaderboard/rules)
como cualquier otra ejecución, catalogados formalmente como evaluaciones sobre conjuntos sellados. La clasificación
propia del concurso queda bajo su responsabilidad para compilarla, congelarla y publicarla:

```bash
mt-eval contest open-intake <contest-id>     # entry intake on — submit-model / submit-method admitted (owner only)
mt-eval contest close-intake <contest-id>    # intake off — work already received still scores
mt-eval contest rank <contest-id> --json     # provisional ranking, any time
mt-eval contest close <contest-id>           # one-way: freezes the ranking, shuts intake
mt-eval contest export <contest-id> --format csv --out results.csv
```

Comportamiento de `rank` para conocimiento e inclusión en sus bases: las entradas se ordenan según la
**métrica principal registrada** del concurso (`--primary-metric` establecida en su creación; chrF++
por defecto), aplicando a continuación el criterio chrF++ → BLEU → COMET → fecha de envío más antigua. Filtra
**exclusivamente entradas verificadas por defecto** —aquellas fichas de ejecución emitidas por el nodo— y contabiliza
las fichas autodeclaradas que haya omitido. Cada par contiguo incluye un veredicto formal de empate:
una prueba pareada de significancia estadística por segmento si se dispone de dichos datos,
o bien **superposición de intervalos de confianza al 95 %**, o en su defecto igualdad puntual.
**Un concurso sellado nunca difunde filas individuales por segmento** (difunde únicamente métricas agregadas, por
definición), por lo que la prueba pareada se procesa directamente en su nodo. Con anterioridad al cierre, ejecute
`mt-eval node verdicts --contest <id> --out verdicts.json` en el nodo; este
generará únicamente veredictos firmados (indicando por cada par: p-valor, diferencia de puntuación, intervalo,
recuento de segmentos —sin incluir texto). Concluya el proceso ejecutando el cierre con `--node-verdicts verdicts.json
--verify-key <the node's .pub.json>`. Si no se proveen veredictos, los empates se determinarán mediante superposición
de intervalos de confianza. En ambos casos, el reporte especificará el sustento analítico aplicado, y los sistemas empatados
compartirán el mismo puesto (`1, 1, 3`).

`close` es una operación irreversible. Aplica el ordenamiento según la métrica asentada, rechaza la acción
si aún restan envíos en proceso de evaluación (salvo indicación de forzado), presenta la
tabla resumen para su confirmación y procede a congelar definitivamente la clasificación en el registro del concurso. `export`
retorna dicha información congelada de manera íntegra, en formato JSON o CSV, lista para su publicación en su página de resultados
o informe de hallazgos. Las fichas evaluadas sobre cualquier otro conjunto (como un conjunto T2 íntegramente secreto o una prueba
aislada en el conjunto de desarrollo) se presentan por separado y nunca se intercalan en la tabla principal.

### Planificación de la publicación de resultados

Dos compromisos que usted asume al momento de la creación y que no admiten alteraciones posteriores —la base
de datos bloquea ambos de manera estricta en cuanto el concurso registra su primera entrada:

```bash
mt-eval contest create … \
  --results-visibility hidden_until_close \   # no score is visible while the contest runs
  --anonymize-until-close                     # pseudonyms in YOUR ranking artifacts
```

**`--results-visibility hidden_until_close` es el mecanismo determinante para ocultar una
puntuación.** Bajo esta modalidad, cada ficha procesada por su nodo se mantiene en reserva en lugar de
hacerse pública: el método se ejecutó, la autorización correspondiente fue consumida y la
ficha queda estructurada, validada y resguardada íntegramente —simplemente no figura en la
tabla. `contest close` publica **en primer lugar** todas las fichas en reserva y luego genera y
congela la tabla clasificatoria, garantizando que no se extravíe información y que el consolidado contemple la totalidad
de los envíos procesados. Este comportamiento se sostiene incluso ante un cierre forzado: forzar el cierre aplica
sobre tareas pendientes en curso, nunca suprimiendo puntuaciones legítimamente procesadas. El registro histórico
congelado detalla con precisión qué resultados fueron publicados en el acto de cierre.

La retención constituye un **estado formal registrado, no una corrida perdida**: la ficha en reserva no admite
modificaciones y el puntero que certifica su publicación se asienta de forma permanente y definitiva —ambos principios
garantizados a nivel de base de datos, por debajo de cualquier cliente. Durante la vigencia del concurso, `rank`
informa la cantidad exacta de resultados bajo retención, impidiendo que una clasificación preliminar sea interpretada
erróneamente como definitiva.

**`--anonymize-until-close` opera con un alcance más acotado, y conviene precisar sus
efectos.** Sustituye los nombres reales de los participantes por seudónimos deterministas en *sus*
archivos de clasificación —la tabla `rank`, su salida JSON y el archivo CSV— mientras el certamen se mantenga
abierto, procediendo `close` a revelar las identidades al concluir. **No** anonimiza
la tabla general pública: una ficha que ha sido publicada conserva la autoría originalmente
declarada en el envío. Si su objetivo es evitar que los competidores conozcan el desempeño ajeno antes de
la conclusión del evento, la opción adecuada es `--results-visibility hidden_until_close`; este modificador no cumple dicha
función.

Si un método satisface las condiciones de umbral establecidas por usted en el Paso 6 —incluida
la [validación por hablantes](/docs/network/specifications/speaker-validation),
la cual constituye un control soberano propio de su comunidad y no un proceso automatizado—, **usted** (o su entidad
fiduciaria) otorgará el premio conforme a los términos formalmente publicados. La intervención de Champollion
concluye estrictamente con la medición técnica.

---

## Lo que usted retiene, para siempre

- **El corpus.** Nunca abandonó su infraestructura. Lleve el texto cifrado
  fuera de línea y el conjunto sellado simplemente deja de ser ejecutable.
- **Las claves.** El acceso muere cuando sus custodios dejan de otorgarlo.
- **El dinero.** Nunca estuvo en ningún otro lugar.
- **El registro.** El resumen de cabeza del registro de auditoría es publicable,
  por lo que el historial de quién ejecutó qué contra su corpus no puede ser
  reescrito silenciosamente — por nadie, incluyéndonos a nosotros.

Para lenguaje de términos que puede adaptar — propiedad, licencia de solo
puntuaciones, y un recorrido explícito de las formas en que un concurso puede
ser atacado — vea [Plantillas de Términos](/docs/network/sovereignty/terms-templates).
