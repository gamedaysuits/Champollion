---
sidebar_position: 9
title: "Nodo de evaluación soberano — Hardware y operaciones air-gap"
description: "Hardware de referencia, disciplina air-gap y operaciones de custodia de claves para operar un nodo de evaluación controlado por la comunidad: el conjunto de pruebas secreto nunca sale de su equipo; los métodos vienen a los datos."
related:
  - label: "Run a Sovereign Contest"
    to: /docs/network/sovereignty/run-a-sovereign-contest
    kind: doc
    note: "The organizer workflow this node runs"
  - label: "The Derived-Artifacts Commitment"
    to: /docs/network/sovereignty/derived-artifacts
    kind: doc
    note: "Who owns what comes out: you"
  - label: "Benchmark Specification §8 (sandbox)"
    to: /docs/network/specifications/benchmark
    kind: doc
    note: "The isolation model the executor implements"
---

# Nodo de evaluación soberano — Hardware y operaciones en entorno aislado (air-gap)

Un nodo de evaluación soberano es una máquina que **usted** controla, la cual contiene un conjunto
de pruebas secreto y evalúa métodos de traducción contra él. Los métodos viajan hacia los
datos; los datos nunca viajan en absoluto. Las puntuaciones —y solo las puntuaciones— son lo único que sale.

Esta página es la especificación práctica: qué hardware comprar (o reutilizar), cómo
configurarlo y la disciplina operativa que hace que "el conjunto de pruebas nunca salió de
la máquina" sea un hecho que usted pueda defender en lugar de una promesa en la que deba confiar.

:::info[Lo que se incluye hoy frente a lo catalogado en progreso]
El software del nodo organizador **se incluye hoy** en `mt-eval`; consulte la
[guía de concursos soberanos](/docs/network/sovereignty/run-a-sovereign-contest):
preparación y sellado de concursos, el filtro de clasificador público **reejecutado
por el propio nodo en cada postulación antes de solicitar la aprobación de
cualquier custodio**, puntuación condicionada por umbrales y el ejecutor de métodos
aislado de la red con su análisis de importaciones. Lo que acepta un nodo es un
**modelo o un método**: un artefacto que puede ejecutar. La subida de traducciones
de un conjunto ciego con origen público se retiró como vía de postulación a concursos
el 2026-09-06 y se eliminó el comando correspondiente; una ronda de origen público
sobrevive únicamente como un diagnóstico opcional para el organizador, y las puntuaciones
autoreportadas pertenecen a la tabla de clasificación abierta, que es un tablero público
indexado por corpus y dirección de par en lugar de un concurso.
La **ceremonia de claves de umbral y el flujo de trabajo sellado en reposo del §4 también
se incluyen hoy**: `mt-eval node ceremony init|share|verify|restore`, `mt-eval node
seal`, partes del cuórum presentadas en tiempo de ejecución
(`node run-method --offline --share …`), un libro de autorización local encadenado por hash
(`node ledger verify|head`), manifiestos de puntuación firmados
(`node sign-manifest` / `node verify-manifest`) y las herramientas de aislamiento físico
(*air-gap*) de los §2–§3 (`node bundle`, `node manifest`, `node egress-check`). Los paquetes
de puntuaciones se firman **en el nodo, en Python** —el paquete fuera de línea no
necesita el entorno de ejecución de Node.js— y el mismo formato de firma independiente
se verifica con cualquiera de las dos implementaciones. La **preparación de solicitudes
del lado del organizador también se incluye**:
`mt-eval node stage-request` escribe la solicitud de intercambio exacta que
escribiría un retransmisor en línea, a partir de un archivo de paquete y sin ninguna
base de datos (para un ensayo o un despliegue que nunca se conecta), prevalidada
tal como la validaría la importación y vinculada al id del nodo; las puntuaciones
resultantes son verificables mediante manifiesto, pero no se publican vía
retransmisor, ya que no existe ningún registro de autorización contra el cual publicarlas.
El sustituto de par de claves único se mantiene únicamente para concursos en los que el
organizador posee las referencias en su totalidad; cada interfaz indica claramente
qué carril está en uso. Dicho con claridad, lo que la v1 **no** incluye: no se reivindica
la atestación remota por hardware (TEE) (§5), y la *firma* por umbral del lado de la
plataforma (aprobaciones de custodios desde el celular contra infraestructura alojada)
es trabajo a futuro; en un nodo soberano, la custodia se ejerce presentando físicamente
M de N partes en la máquina (§4). Y para ser precisos sobre la criptografía: se trata
del esquema de compartición de secretos M de N de Shamir con la clave **reconstruida
en la memoria bloqueada del nodo durante una ejecución autorizada** (luego puesta a ceros);
*no* es computación multipartita, y la clave sí existe brevemente ensamblada en su
máquina fuera de línea. Por último, hasta que se abra el filtro de consentimiento
comunitario, el carril se ejecuta **únicamente con datos sintéticos**; los corpus
reales quedan a la espera de dicho consentimiento.
:::

## 1. Hardware de referencia

El ejecutor ejecuta métodos autónomos: decodificación NMT local, validación
FST/morfológica y cálculo de métricas. No se realizan llamadas a la nube dentro del entorno
aislado (los métodos LLM-API son exactamente la clase que un nodo en entorno aislado rechaza; consulte
las clases de métodos de la [especificación del benchmark](/docs/network/specifications/benchmark)).

| Nivel | Especificación | Capacidad | Costo aproximado (2026) |
|---|---|---|---|
| **Mínimo** (funciona) | 4 núcleos x86_64 o Apple/ARM, 16 GB RAM, 500 GB SSD | Evaluación de métricas + FST, decodificación por CPU de modelos NMT pequeños (lento pero correcto) | US$0 (una computadora portátil de repuesto) – $400 usada |
| **Recomendado** | 8 núcleos, 32 GB RAM, 1 TB NVMe, GPU NVIDIA ≥ 12 GB VRAM (ej. clase RTX 4070) | Decodificación NMT cómoda para baterías de pruebas completas; evaluación de métodos en paralelo | ~US$900–1,600 (estación de trabajo de formato pequeño) |
| **Institucional** | 16 núcleos, 64–128 GB RAM, 2 TB NVMe, 24 GB+ VRAM | Concursos de muchos métodos, baterías grandes, almacenamiento de texto cifrado archivado | ~US$2,500–4,000 |

Requisitos estrictos en todos los niveles:

- **Sin radios, o radios que pueda demostrar que están apagadas.** Lo mejor: una computadora de escritorio sin
  tarjeta Wi-Fi/Bluetooth. Aceptable: una computadora portátil cuya tarjeta inalámbrica esté
  físicamente extraída o deshabilitada en el firmware. El "modo avión" no es un
  entorno aislado (air-gap).
- **Una tarjeta de red (NIC) cableada que pueda dejar desconectada.** La ausencia del cable es el control
  de red más auditable que existe.
- **Dos unidades USB dedicadas** (etiquetadas como IN y OUT; consulte la §3) e, idealmente,
  una máquina cuyos otros puertos usted deshabilite en el firmware.
- **Cifrado de disco completo** (LUKS en Linux) para que un nodo robado sea inservible, y
  un UPS (sistema de alimentación ininterrumpida) si su suministro eléctrico no es confiable; una evaluación interrumpida a mitad de la batería
  es recuperable, pero para qué arriesgarse a averiguarlo.

## 2. Configuración de software (una vez, ~una hora)

1. Instale una versión actual de Linux LTS (Ubuntu/Debian) desde un instalador USB **con
   el cable de red desconectado**; habilite el cifrado de disco completo durante la instalación.
2. En una máquina separada y en línea con el arnés instalado
   (`python3 -m pip install mt-eval-harness`, 0.2.0 o posterior), compile el paquete fuera de línea.
   `mt-eval node bundle --out <dir>` realiza cuatro cosas:
   - empaqueta en wheels el arnés instalado y sus dependencias (o un wheel específico,
     con `--wheel <file>`);
   - descarga las bibliotecas criptográficas cotejándolas con la lista de hashes fijados
     incluida dentro del arnés;
   - copia cualquier artefacto `--include`;
   - escribe un manifiesto sha256 para cada archivo.

   Incluya las **fichas de idioma** (*language cards*) para cada idioma que el nodo evaluará
   (`--include <cards-dir>`): el nodo determina el par de idiomas de una ejecución a partir de un
   índice local de fichas y nunca descarga ninguna. Ninguno de los paquetes instalados incluye
   un directorio de fichas por idioma, así que créelo aquí con la CLI de `champollion`,
   un `<code>.json` por idioma (`champollion network card eng --json >
   node-cards/eng.json`, y luego lo mismo para su otro idioma), y pase
   `--include node-cards`. En el nodo se ubica en
   `<dir>/artifacts/node-cards`; apunte `cards_dir` allí. Todo lo que el nodo necesita cruza
   en la unidad IN una sola vez. Compile en la misma versión de Python que ejecuta el nodo
   (3.11 o 3.12); la lista fijada rechazará cualquier otra.
3. Transfiera el paquete en la unidad IN; verifique el sha256 de cada artefacto
   contra el manifiesto **en el nodo** antes de instalar
   (`mt-eval node bundle --verify <dir>`). Luego instale únicamente desde los
   wheels incluidos en el paquete:
   `python3 -m pip install --no-index --find-links <dir>/wheels 'mt-eval-harness[node]'`.
   El extra `[node]` es la biblioteca `cryptography` que `mt-eval node
   keygen` and the custody ceremony need; a plain `mt-eval-harness` no incluye en su instalación.
4. Cree el par de claves de firma del nodo (`mt-eval node keygen`) y registre
   su mitad pública; la publicará para que cualquiera pueda verificar sus
   manifiestos de puntuación (§5).
   El nodo también necesita **Docker** (o Podman), que ejecuta cada método
   enviado en un contenedor sin red; si ninguno de los dos está en el `PATH`,
   `mt-eval node run-method` lo rechazará en una sola línea nombrando a ambos, y la
   solicitud permanecerá ejecutable. También necesita una configuración de nodo en
   `~/.mt-eval/node.json`. Ese archivo define el nombre del nodo, su directorio de fichas
   (`cards_dir` o `MT_EVAL_CARDS_DIR`) y los concursos a los que presta servicio.
   `mt-eval node init` escribe una configuración inicial con cada clave que un nodo de
   puntuación lee, incluyendo el filtro clasificador público (`qualifier` + `dev_corpus`,
   contra el cual el nodo vuelve a ejecutar cada método antes de abrir un conjunto sellado)
   y las ranuras del conjunto retenido (*holdout*) sellado (`holdout_set_id` + `holdout_corpus`;
   elimínelas para un concurso sin conjunto retenido).
   `mt-eval node init --from-contest <out>` completa los valores del concurso a partir del
   manifiesto que escribió `contest prepare` (el mapeo se encuentra en la
   [guía de concursos soberanos](/docs/network/sovereignty/run-a-sovereign-contest#organizer-prerequisites)).
   Su bloque `sandbox` es la política de recursos del nodo (4 GB de RAM, 4 GB de espacio temporal,
   30 minutos por ejecución, sin GPU), y `contest submit-method` declara exactamente
   esos valores de forma predeterminada, así que publique sus límites junto con el concurso
   si los modifica.
   Una configuración de nodo que declare solo la mitad de ese filtro se rechaza al inicio.
   `mt-eval node ledger verify` comprueba el archivo completado: rechaza el
   primer valor sobrante de `<...>` o archivo declarado que no esté en el nodo,
   imprime lo que verificó y luego reproduce la cadena de hashes del libro local. La
   máquina conectada que retransmite solicitudes al nodo también necesita la
   **clave de rol de servicio** de la base de datos (`MT_EVAL_SUPABASE_SERVICE_KEY`). Esa clave
   nunca se necesita en el propio nodo con aislamiento físico.
5. A partir de ese momento, la máquina nunca vuelve a ver una red, y se puede
   realizar una ejecución sellada para demostrarlo primero: `mt-eval node egress-check` (también
   aplicado automáticamente con `assert_airgap` en la configuración del nodo) rechaza
   la operación cuando una ruta, un sondeo o el DNS muestran alguna vía de salida. Las
   actualizaciones del SO son un evento deliberado, empaquetado y verificado por hash,
   no un servicio en segundo plano.

## 3. Disciplina de transferencia (cada concurso, en ambas direcciones)

El entorno aislado (air-gap) es un *procedimiento*, no un producto. El procedimiento:

- La **unidad IN** transporta: los paquetes de métodos o modelos postulados y su
  manifiesto. Antes de que se ejecute nada, el nodo verifica el hash de cada paquete
  contra el manifiesto y se ejecuta el análisis de importaciones (rechaza métodos
  que importen bibliotecas de red; esto se incluye hoy).
- La **unidad OUT** transporta: el manifiesto de puntuaciones firmado —puntuaciones
  agregadas, los hashes de método/configuración a los que pertenecen, la cabecera
  del registro de auditoría— y *nada más*. Las salidas por segmento permanecen en
  el nodo bajo el control del organizador; publicarlas es una decisión comunitaria
  deliberada e independiente.
- Una sola dirección por unidad, siempre. Una unidad que haya estado en contacto
  con el nodo nunca se monta automáticamente en una máquina en línea: móntela como
  `noexec,nodev` y copie el manifiesto a mano.
- `mt-eval node manifest write <drive> --direction in|out` genera el hash de cada
  archivo en la unidad antes de un cruce; `mt-eval node manifest verify`
  en el lado receptor rechaza cualquier elemento agregado, modificado o faltante.
- Registre cada cruce (fecha, unidad, hash del manifiesto) en la bitácora física
  o en el registro interno del nodo. La monotonía es el punto clave: el registro
  es lo que le permite responder a la pregunta «¿salió alguna vez algo más?» con evidencia.

## 4. Custodia de claves (M de N, en manos de la comunidad)

El conjunto de prueba sellado está cifrado en reposo; el descifrado requiere un cuórum
de partes de la clave en poder de custodios que **la comunidad elija**: un consejo
de Ancianos, una autoridad lingüística, un organismo educativo. El diseño otorga a la
plataforma cero partes, por lo que Champollion no podría descifrar un conjunto sellado,
ni tampoco podría hacerlo ningún custodio por sí solo. La ceremonia descrita a
continuación aún no se ha llevado a cabo con custodios reales.

La ceremonia (una sesión sin conexión; las herramientas incluidas la automatizan):
`mt-eval node ceremony init` genera la clave del conjunto en el nodo, la divide
en N fragmentos (cualquier M la reconstruye; menos no revelan nada; el intercambio es
teórico de la información) y pone a cero la clave en el mismo instante; `ceremony
share` emite el fragmento de cada custodio como un archivo para un token más una
copia de seguridad en papel imprimible; `ceremony verify` demuestra que las copias distribuidas
se reconstruyen, sin persistir nada; `ceremony share
--wipe-originals` then destroys the node's own copies. `mt-eval node
seal` cifra el corpus con la clave pública de la ceremonia: el nodo almacena
el texto cifrado y una tarjeta de metadatos sin contenido, nada más. A partir de entonces,
ejecutar una evaluación significa que los custodios presentan físicamente M de N fragmentos
(`node run-method --offline --share …`): la clave se reconstruye **solo en la
memoria bloqueada del ejecutor**, se usa para esa única ejecución vinculada a la concesión, y
se pone a cero; nunca vuelve a tocar el disco. Cada solicitud, voto, concesión y uso
se añade a un libro mayor local encadenado por hash (`node ledger verify`), y un
intento sin cuórum es rechazado *y* registrado.

Una frase honesta sobre el mecanismo: se trata del intercambio de secretos de Shamir
con reconstrucción en la memoria de la máquina sin conexión en manos de la comunidad,
no de computación multiparte. Durante una ejecución autorizada, la clave existe
brevemente, ensamblada, en el hardware que la comunidad controla físicamente; las
propiedades que defiende son *ninguna clave permanente en el disco*, *ninguna ejecución sin un
cuórum presente* y *cada uso encadenado en el libro mayor inspeccionable*.
La firma de umbral del lado de la plataforma, donde la clave nunca se ensambla en ninguna parte,
sigue siendo trabajo futuro y se etiqueta como tal dondequiera que se mencione.

La rotación y el reemplazo de custodios vuelven a ejecutar la ceremonia; la pérdida de más de
N−M fragmentos significa que el conjunto se vuelve a sellar a partir de la copia de origen de la comunidad;
la comunidad siempre conserva su propio original en texto plano, porque
la [posesión](/docs/network/sovereignty/data-sovereignty) nunca fue nuestra para
retenerla.

## 5. Qué significa "atestado" aquí — y qué no significa

Cada evaluación produce un **manifiesto de puntuación firmado**: la firma del nodo
sobre las puntuaciones, los hashes de los paquetes de métodos, la suma de comprobación del corpus y el
encabezado del registro de auditoría de solo adición. Cualquiera que posea la clave pública
publicada del nodo puede verificarlo — `mt-eval node verify-manifest <manifest>
--pubkey <published .pub.json>` — que *este nodo* produjo *estas puntuaciones*
para *estas entradas exactas*, y el registro encadenado por hash hace que las ediciones
silenciosas del historial sean detectables.

Eso es **atestación de software**: demuestra la integridad del registro, y
es lo que ofrece la v1. **No** demuestra qué silicio ejecutó la ejecución:
la atestación remota por hardware (TEE) es trabajo futuro y deliberadamente no
se afirma tenerla. La declaración de seguridad honesta para la v1: la disciplina del organizador
(§3) más los manifiestos firmados más la custodia física de la máquina por parte de la
comunidad es el ancla de confianza, que es exactamente donde un diseño que prioriza
la soberanía quiere que resida la confianza de todos modos.

## 6. El ciclo operativo

1. Anuncie el concurso; publique la clave pública del nodo + el umbral del conjunto de desarrollo.
2. Reciba las postulaciones en línea (máquina ordinaria), arme el manifiesto IN
   (`mt-eval node manifest write <drive> --direction in`).
3. Lleve la unidad IN al nodo; verifique los hashes (`node manifest verify`);
   import-scan (`node import-bundle`); queue methods. An entrant's offline
   la propuesta llega en estado *pending*. El nodo la comprueba primero (`node run-method
   <id> --offline` vuelve a ejecutar la prueba clasificatoria del participante en el conjunto de desarrollo público
   y verifica el entorno de ejecución de contenedores para una postulación de código, no abre nada sellado y
   registra la aprobación en el libro local). Luego, un custodio registra la decisión
   en el nodo (`node approve <id> --offline --actor <custodian>`, rechazado
   hasta que se haya superado esa comprobación, o `node deny … --offline --reason …`: un voto
   + autorización en el libro local y un registro firmado con la clave del nodo;
   `node list --offline` muestra qué está en espera). La ejecución sellada (`node run-method
   --offline` nuevamente) rechaza una propuesta pendiente hasta que dicha aprobación esté
   registrada y se verifique.
4. Los custodios autorizan la ejecución presentando un cuórum de partes (§4 —
   `node run-method <id> --offline --share … --share …`); el conjunto sellado
   se descifra únicamente dentro del ejecutor. Sin cuórum, no hay ejecución, y el intento
   queda registrado en el libro.
5. Ejecución: se calculan las puntuaciones; las salidas por segmento se conservan en el nodo.
6. Desmantelamiento: se borra el texto en claro de trabajo; se añade al registro de auditoría; se firma el manifiesto.
7. Lleve la unidad OUT de vuelta; publique las puntuaciones + el manifiesto; cualquiera puede verificarlos
   (`node verify-manifest`).
8. Registre el cruce; las unidades se mantienen dedicadas; el nodo permanece aislado.
