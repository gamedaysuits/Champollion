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

:::info[Qué se incluye hoy vs. qué está etiquetado como en progreso]
El software del nodo organizador (preparación del concurso, recepción de hipótesis,
puntuación controlada por umbral, el ejecutor de métodos aislado de la red con su
import scan) **ships today** in `mt-eval` — see the
[guía de concurso soberano](/docs/network/sovereignty/run-a-sovereign-contest).
La **ceremonia de claves de umbral y el flujo de trabajo de sellado en reposo de la §4 también se incluyen
hoy**: `mt-eval node ceremony init|share|verify|restore`, `mt-eval node
seal`, fragmentos de cuórum presentados en tiempo de ejecución
(`node run-method --offline --share …`), un libro mayor de autorización
local encadenado por hash (`node ledger verify|head`), manifiestos de puntuación firmados
(`node sign-manifest` / `node verify-manifest`) y las herramientas de entorno aislado (air-gap)
de las §2–§3 (`node bundle`, `node manifest`, `node egress-check`). El
sustituto de par de claves único se mantiene solo para concursos donde el organizador
posee las referencias directamente; cada superficie etiqueta qué vía está en
uso. Dicho claramente, lo que la v1 **no** incluye: no se afirma tener atestación
remota por hardware (TEE) (§5), y la *firma* de umbral del lado de la plataforma
(aprobaciones telefónicas de los custodios contra la infraestructura alojada) es
trabajo futuro; en un nodo soberano, la custodia se ejerce presentando físicamente
M de N fragmentos en la máquina (§4). Y para ser precisos sobre la
criptografía: se trata del esquema de intercambio de secretos de Shamir M de N con la clave
**reconstruida en la memoria bloqueada del nodo durante una ejecución autorizada**
(y luego puesta a cero); *no* es computación multiparte, y la clave sí
existe brevemente ensamblada en su máquina sin conexión. Finalmente, hasta que se
abra la puerta de consentimiento de la comunidad, la vía se ejecuta **solo contra datos
sintéticos**; los corpus reales esperan ese consentimiento.
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

1. Instale un Linux LTS actual (Ubuntu/Debian) desde un instalador USB **con
   el cable de red desconectado**; habilite el cifrado de disco completo durante la instalación.
2. En una máquina separada y con conexión, compile el paquete sin conexión:
   `mt-eval node bundle --out <dir>` crea los wheels de `mt-eval[node]` y sus
   dependencias, copia cualquier artefacto `--include` y escribe un manifiesto
   sha256 sobre cada archivo. Todo lo que el nodo necesita cruza en la unidad
   IN una sola vez.
3. Transfiera el paquete en la unidad IN; verifique el sha256 de cada artefacto
   contra el manifiesto **en el nodo** antes de instalar
   (`mt-eval node bundle --verify <dir>`).
4. Cree el par de claves de firma del nodo (`mt-eval node keygen`) y registre
   su mitad pública; la publicará para que cualquiera pueda verificar sus manifiestos
   de puntuación (§5).
5. A partir de entonces, la máquina nunca ve una red, y se puede realizar una
   ejecución sellada para demostrarlo primero: `mt-eval node egress-check` (también aplicado
   automáticamente con `assert_airgap` en la configuración del nodo) se rechaza cuando una
   ruta, un sondeo o el DNS muestran alguna salida. Las actualizaciones del sistema operativo son un evento deliberado,
   empaquetado y verificado por hash, no un servicio en segundo plano.

## 3. Disciplina de transferencia (cada concurso, en ambas direcciones)

El entorno aislado (air-gap) es un *procedimiento*, no un producto. El procedimiento:

- **La unidad IN** transporta: paquetes de métodos enviados, archivos de hipótesis y
  su manifiesto. Antes de que se ejecute nada, el nodo verifica el hash de cada paquete
  contra el manifiesto y se ejecuta el escaneo de importación (rechaza los métodos
  que importan bibliotecas de red; esto se incluye hoy).
- **La unidad OUT** transporta: el manifiesto de puntuación firmado (puntuaciones agregadas, los
  hashes de métodos/configuraciones a los que pertenecen, el encabezado del registro de auditoría) y *nada
  más*. Las salidas por segmento permanecen en el nodo bajo el control del
  organizador; publicarlas es una decisión comunitaria separada y deliberada.
- Una dirección por unidad, siempre. Una unidad que ha tocado el nodo nunca
  se monta automáticamente en una máquina con conexión; móntela `noexec,nodev` y copie el
  manifiesto manualmente.
- `mt-eval node manifest write <drive> --direction in|out` calcula el hash de cada
  archivo en la unidad antes de un cruce; `mt-eval node manifest verify`
  en el lado receptor rechaza cualquier cosa añadida, modificada o faltante.
- Registre cada cruce (fecha, unidad, hash del manifiesto) en el registro en papel o
  en el nodo. Que sea aburrido es el objetivo: el registro es lo que le permite responder "¿salió
  alguna otra cosa alguna vez?" con evidencia.

## 4. Custodia de claves (M de N, en manos de la comunidad)

El conjunto de pruebas sellado está cifrado en reposo; el descifrado requiere un cuórum de
fragmentos de clave en poder de custodios que **la comunidad elige**: un consejo
de ancianos, una autoridad lingüística, un organismo educativo. La plataforma no posee ningún
fragmento; Champollion no puede descifrar un conjunto sellado, y tampoco puede hacerlo ningún
custodio por sí solo.

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

1. Anuncie el concurso; publique la clave pública del nodo + el umbral del conjunto de desarrollo (dev-set).
2. Reciba los envíos en línea (máquina ordinaria), ensamble el manifiesto IN
   (`mt-eval node manifest write <drive> --direction in`).
3. Lleve la unidad IN al nodo; verifique los hashes (`node manifest verify`);
   import-scan (`node import-bundle`); queue methods.
4. Los custodios autorizan la ejecución presentando un cuórum de fragmentos (§4 —
   `node run-method <id> --offline --share … --share …`); el conjunto sellado
   se descifra únicamente en el ejecutor. Sin cuórum, no hay ejecución, y el intento
   queda en el libro mayor.
5. Ejecute; se calculan las puntuaciones; las salidas por segmento se retienen en el lado del nodo.
6. Desmontaje: se borra el texto plano de trabajo; se añade al registro de auditoría; se firma el manifiesto.
7. Lleve la unidad OUT de vuelta; publique las puntuaciones + el manifiesto; cualquiera lo verifica
   (`node verify-manifest`).
8. Registre el cruce; las unidades se mantienen dedicadas; el nodo permanece desconectado.

