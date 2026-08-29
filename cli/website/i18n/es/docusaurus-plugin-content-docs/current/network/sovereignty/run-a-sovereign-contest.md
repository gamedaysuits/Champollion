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

- ✅ **Activo:** registro de corpus (tarjetas de metadatos, fijación de hashes, carriles de exposición), el registro de conjuntos sellados (resumen + grupo de custodios + calificador, sin contenido), la maquinaria del concurso con el carril sellado, la capa de datos de solicitud/concesión/auditoría de autorización (pendiente → decisión M de N → concesión de un solo uso con límite de tiempo, registro de auditoría encadenado por hash de solo adición), y emisión de solo puntuaciones aplicada en la capa de la base de datos.
- ✅ **Activo: el nodo de puntuación del organizador + carril de hipótesis.** Un
  comando divide su corpus en un conjunto de desarrollo público (el calificador), un conjunto de prueba ciego (fuente publicada, referencias selladas en reposo en SU computadora), y opcionalmente un conjunto completamente secreto (`mt-eval contest prepare`). El registro del conjunto o conjuntos sellados, el calificador y el concurso es **de autoservicio desde su propio inicio de sesión** — `contest prepare --self-serve`, o `mt-eval contest register
  --manifest` para un concurso que preparó anteriormente — con cada fila
  vinculada a la identidad en la capa de la base de datos; sin curador en el proceso y sin
  clave privilegiada (consulte el Paso 4 para las limitaciones honestas). Los participantes
  envían sus traducciones con `mt-eval contest submit-hypotheses` (la CLI
  autocalifica el conjunto de desarrollo localmente y rechaza las subidas por debajo de su umbral);
  SU nodo autoalojado (`mt-eval node serve`) vuelve a calificar la evidencia de desarrollo
  por sí mismo, controla el acceso según el calificador, autoriza según el modelo de su concurso
  (`per-submission` — un custodio aprueba cada puntuación — o `blanket` /
  `open`), califica el conjunto ciego contra referencias que nunca salen de su
  computadora, y publica tarjetas de ejecución de **solo agregados**. Lo que este carril
  NO prueba: que el método nombrado produjo las hipótesis (la identidad del método es
  afirmada por el participante y etiquetada como tal en cada tarjeta de ejecución), y no puede
  evitar que un adversario decidido extraiga la señal de referencia a través de muchas sumisiones distintas
  — los límites de velocidad, la deduplicación idéntica a nivel de bytes y la cadena de auditoría ralentizan esto;
  el carril de ejecución de métodos a continuación es la verdadera respuesta.
- ✅ **Activo: dos carriles de métodos de conjunto secreto.** Los participantes con un registro
  publicado en el carril de hipótesis pueden proponer su método contra su conjunto secreto. El
  nodo elige el carril a partir de la sumisión:
  - **Carril A — modelo declarativo (preferido).** Un modelo neuronal estándar es
    DATOS: `mt-eval contest submit-model` envía pesos de safetensors + un
    tokenizador declarativo + una configuración — **sin código, sin Dockerfile.** Su nodo
    valida que está libre de código (safetensors no pickle; sin
    `trust_remote_code`/`auto_map`; archivos de solo datos) y ejecuta los pesos en su
    PROPIO motor de confianza (`transformers`, `trust_remote_code=False`, fuera de línea).
    La arquitectura es permisiva por defecto (cualquiera que su motor cargue de forma nativa); un
    anfitrión cuidadoso puede fijar una lista de permitidos. No se ejecuta nada que no sea de confianza, por lo que
    no hay nada que aislar (sandbox). Publicado `declarative-model`, identidad del método
    **libre de código por construcción**.
  - **Carril B — paquete ejecutable (alternativa de sandbox).** Para los métodos que SÍ son código:
    `mt-eval contest submit-method` envía un Dockerfile + punto de entrada (entrypoint). Después de que su
    custodio lo apruebe, SU nodo lo ejecuta dentro de un contenedor aislado de la red
    (`--network=none` — la pila de red no existe en su interior;
    raíz de solo lectura, capacidades eliminadas, entorno saneado), con
    comprobaciones estáticas automatizadas primero y referencias que nunca entran al contenedor.
    Publicado `method-execution` con identidad **verificada por ejecución**.
  En cualquier carril: el hash del paquete se congela en la solicitud de autorización (lo que
  se ejecuta es demostrablemente lo que se propuso), y las puntuaciones se publican a través de la misma
  ruta de solo agregados. Para un aislamiento máximo, la máquina de puntuación puede ser un verdadero
  espacio de aire (airgap): las solicitudes autorizadas y los paquetes de solo puntuaciones firmados con Ed25519 cruzan
  mediante medios extraíbles (`mt-eval node relay` / `import-bundle` / `export-scores`) —
  el texto secreto nunca llega ni siquiera a la computadora conectada. Lo que estos carriles
  NO incluyen todavía: atestación de hardware del nodo (la identidad es autodeclarada),
  maquinaria formal de disputas y — para el Carril B específicamente — un endurecimiento más profundo del contenedor
  más allá de la pila de red eliminada (perfiles seccomp, microVMs; esta es una razón para
  preferir el Carril A). Consulte
  [Limitaciones honestas](/docs/network/honest-limitations).
- 🔲 **En desarrollo: firma de umbral.** La aprobación del custodio M de N se
  *registra* en las tablas de autorización y auditoría hoy en día; las herramientas criptográficas
  de clave de umbral que hacen que una concesión no se pueda acuñar sin M partes aún
  no están construidas — la clave de sellado actual es un sustituto etiquetado de un solo par de claves
  (`champollion seal-corpus keygen`), y la firma del paquete de puntuaciones en el espacio de aire (airgap)
  es una clave de un solo nodo (`seal-corpus sign-keygen`), no una ceremonia de administradores.
- ❌ **No es una opción, por diseño:** Champollion alojando su corpus, guardando sus
  claves o reteniendo los fondos de los premios. Las hipótesis de los participantes (sus propias traducciones)
  transitan por nuestro almacenamiento; el contenido de su corpus nunca lo hace.

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

- **docker o podman** — requerido para el carril de ejecución de métodos. El nodo detecta automáticamente docker, luego podman; si ninguno está presente, se rehúsa ruidosamente. No hay **alternativa** — el aislamiento de contenedores con `--network=none` es la garantía fundamental, por lo que nada se ejecuta sin un tiempo de ejecución de contenedores.
- **Node.js 20.11+ y la CLI npm `champollion`** — el arnés no reimplementa el cifrado de sellado. `champollion seal-corpus` (verbos: `keygen`, `seal`, `open`, `sign-keygen`, `sign`, `verify`) es la única implementación de cifrado (X25519-ECDH → HKDF-SHA256 → AES-256-GCM), y el nodo organizador lo invoca.
- **Una configuración de nodo en `~/.mt-eval/node.json`.** Todo comando `mt-eval node` se rehúsa a iniciarse sin una — ejecute cualquiera de ellos una vez y el mensaje de error nombra la ruta de configuración y dónde vive la plantilla (se incluye en la fuente del arnés, en `mt_eval_harness/contest_node.py`). La configuración lleva su `node_id` autorreportado (vinculado en cada huella digital de solicitud) y un mapa `contests` que apunta a sus referencias de desarrollo y artefactos sellados.
- **Un inicio de sesión.** No hay un paso de creación de cuenta separado: el primer comando que necesita una identidad (p. ej. `mt-eval contest prepare --self-serve` o `mt-eval publish`) abre un inicio de sesión OAuth en el navegador a través de **GitHub o Google** (Supabase Auth). El correo electrónico de esa cuenta es la identidad a la que se vincula cada fila del registro — use uno que su organización controle.
- **El acelerador de ingesta.** Los envíos de participantes tienen límite de velocidad por remitente a **5 por 24 horas por defecto** (anti-sondeo; se establece por concurso con `--intake-daily-limit` en tiempo de preparación, o como predeterminado de edición de tarea compartida). Presupueste su cronograma de concurso alrededor de esto.

**Una advertencia honesta sobre el registro de autoservicio.** En el **punto de conexión alojado en la red predeterminado**, el registro de autoservicio (`contest prepare --self-serve` / `contest register`) actualmente se detiene en una protección de punto de conexión de producción: la CLI se rehúsa con un mensaje explícito en lugar de escribir en el proyecto de producción, pendiente una decisión de política sobre abrir esa puerta. Los hosts federados (su propio proyecto Supabase) no se ven afectados. Si encuentra la protección en el host predeterminado, ese es el estado actual del mundo, no una configuración errónea de su parte — [abra un problema](https://github.com/gamedaysuits) y le guiaremos el registro.

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

El manifiesto permanece en su máquina — el registro envía solo los ids, resúmenes
y umbrales sin contenido. Cada fila del registro está **vinculada por identidad**:
la base de datos registra la cuenta con sesión iniciada que la registró y congela
esa vinculación contra ediciones posteriores, y un calificador solo puede cerrar
un conjunto sellado que la **misma** identidad registró. Los conjuntos sellados
nacen en cuarentena (nunca pueden respaldar un concurso ordinario o clasificarse
en la tabla de clasificación pública), los calificadores nacen en un estado seguro,
y el registro tiene límite de velocidad — todo aplicado por disparadores de base
de datos bajo cada cliente, incluyendo el nuestro. El registro en sí es
públicamente legible, por lo que puede verificar que su entrada dice exactamente
lo que selló — y nada más.

**Límites honestos.** La puerta de autoservicio es solo registro (solo inserción
en la capa de base de datos). **La rotación de calificador y la jubilación de
conjunto sellado siguen siendo mediadas por curador** — abra un problema o
contacte al proyecto a través de [GitHub](https://github.com/gamedaysuits). Y
ejecutar el nodo de puntuación del organizador en los pasos posteriores (avances
de ciclo de vida, concesiones de autorización, operaciones de auditoría) es un
carril separado con credenciales de servicio en su propio nodo — el autoservicio
se detiene en el registro público.

## Paso 5 — Elija custodios y la regla M-de-N

Elija las personas o instituciones que deben aprobar conjuntamente cada
evaluación contra su corpus, y el umbral (p. ej. **3 de 5**). Los custodios
deben ser responsables ante su comunidad, no ante Champollion — vea
[Administración de Datos](/docs/network/sovereignty/data-sovereignty) y
[Propiedad y Términos](/docs/network/sovereignty/ownership-transfer) para cómo
se establecen términos por comunidad.

**Caja de honor:** la herramienta de criptografía de umbral (comparticiones de
clave tales que una concesión literalmente no puede ser acuñada sin M firmas)
está **en desarrollo**. Hoy, la regla M-de-N se aplica como proceso registrado:
cada solicitud de acceso entra en una cola **pendiente**, las decisiones de
custodio se registran, una concesión se acuña solo para una solicitud autorizada,
cada concesión es **de uso único, con límite de tiempo, y vinculada a un
fingerprint específico (método, versión de corpus, nodo de evaluación)**, y cada
evento — incluyendo intentos bloqueados — llega a un registro de auditoría
**de solo anexión, encadenado por hash, públicamente legible**. La base de datos
rechaza transiciones de estado ilegales bajo cada cliente y clave. Lo que no
puede rechazar aún es un compromiso del operador de plataforma en sí — eso es lo
que cierra la firma de umbral, y hasta que se lance debe tratar "Champollion
retiene cero comparticiones de clave" como el objetivo de diseño siendo
construido, no una propiedad que pueda verificar hoy.

## Paso 6 — Establezca el premio

Decida, y publique con el concurso:

- **Cantidad y moneda.**
- **Patrocinador** — quién está poniendo el dinero.
- **Dónde se sientan los fondos** — la cuenta de su organización, o un
  fideicomiso comunitario que designe. **Champollion nunca retiene, custodia, o
  encamina fondos de premio.** Publicar la identidad del tenedor por adelantado
  es lo que hace el premio creíble; vea la [nota de riesgo de caballo de Troya](/docs/network/sovereignty/terms-templates#trojan-horse-risks)
  en las plantillas de términos.
- **Condiciones de umbral** — la barra de puntuación que un método debe superar,
  escrita según la [Especificación de Premio](/docs/network/specifications/prizes):
  umbrales de métrica, requisitos de validación de hablantes, reproducibilidad.
  Haga que las condiciones de otorgamiento sean verificables desde las
  puntuaciones publicadas, para que nadie tenga que tomar su palabra (o la
  nuestra) sobre si la barra fue superada.

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
  --description "Community-custodied held-out set; scores-only; prize held by <your org/trust>."
```

*(El valor `--corpus` es su `sealed_set_id` registrado. El carril sellado se
selecciona **automáticamente** del registro de conjunto sellado — sin bandera
extra; un conjunto sellado nunca puede respaldar un concurso ordinario, y un
conjunto en cuarentena ordinario nunca puede respaldar ningún concurso. Ambas
reglas se aplican en la base de datos, bajo cada cliente. Si registró en el
Paso 4 con `contest register` o `prepare --self-serve`, la fila de concurso **ya existe** —
omita este paso; `contest create` a mano es solo para ensamblar un concurso desde
un conjunto sellado ya registrado.)*

## Paso 8 — Los métodos califican primero en público

Los desarrolladores construyen y califican sus métodos en corpus **públicos**
para su par de idiomas — la ruta normal [enviar-un-método](/docs/network/getting-started/submit-a-method).
El `current_qualifier_id` de su conjunto sellado nombra la ronda pública que un método
debe superar antes de que incluso se pueda solicitar una ejecución sellada. Esto
mantiene la presión de sondeo fuera de su corpus: nadie obtiene apuntar al
conjunto sellado hasta que hayan mostrado desempeño real en lo abierto.

:::note[Participantes: ¿en qué punto de conexión vive su concurso?]
Un concurso **alojado en la red** no requiere configuración — el punto de conexión predeterminado que incluye el arnés lleva la maquinaria del concurso (ingesta de hipótesis, la puerta calificadora, propuestas de métodos), y `mt-eval contest submit-hypotheses` / `submit-method` funcionan de inmediato.

Un concurso **federado** — el organizador ejecuta la maquinaria en su propio proyecto de Supabase, por lo que los envíos nunca transitan el nuestro — publica su punto final con los materiales del concurso. Expórtelo antes de enviar:

```bash
export MT_EVAL_SUPABASE_URL=https://<contest-host>.supabase.co
export MT_EVAL_SUPABASE_ANON_KEY=<contest-anon-key>
```

Si el arnés apunta a un punto final que no tiene la maquinaria de concurso (digamos, un host federado sin una migración), el comando se detiene con *"el carril de concurso aún no está disponible en este punto final de Supabase"* y le dice a qué punto final estaba hablando. (Organizadores federados: publiquen estos dos valores junto con su lanzamiento de corpus, `--node-id`, y `--corpus-version`.)
:::

## Paso 9 — Ejecuciones selladas: solicitar, autorizar, ejecutar, puntuaciones fuera

Para cada método calificador:

1. Una **solicitud** se presenta contra su conjunto sellado — entra en
   `pending` y lleva un fingerprint inmutable de (hash de tarball de
   método, id de corpus, versión de corpus, `scores-only`, medición de nodo
   de evaluación).
2. Sus **custodios deciden** (M-de-N). La aprobación acuña una **concesión**:
   de uso único, que expira, válida solo para ese fingerprint exacto.
3. La evaluación se ejecuta en el sandbox aislado de red en **su** nodo
   (`mt-eval node run-method`): verificaciones estáticas automatizadas, un contenedor sin
   pila de red, referencias mantenidas fuera de él — o, para máximo aislamiento,
   en una máquina de verdadero airgap con paquetes de solo puntuaciones firmados
   cruzando por medios removibles (vea la caja de estado arriba para qué está y
   qué no está cubierto).
4. **Solo puntuaciones salen.** La regla de emisión `scores-only` está fijada
   en la capa de base de datos; el texto por entrada de su corpus nunca se
   publica.
5. Cada paso — solicitud, votos, concesión, uso, y cualquier intento bloqueado
   — se anexa al registro de auditoría público, encadenado por hash que usted
   (y cualquiera) puede reproducir.

## Envío de un método (para participantes) — dos carriles

La mayoría de las entradas de NMT no son exóticas: un transformador estándar ajustado (fine-tuned) y sus
pesos. Para esos, hay un **carril preferido, libre de código** — y una alternativa de sandbox
para los métodos que genuinamente son código.

### Carril A — modelo declarativo (preferido para NMT estándar)

Si su método es un modelo neuronal estándar, usted lo envía como **datos** — los
pesos, el tokenizador y la configuración — y el organizador lo ejecuta en su propio motor de
inferencia de confianza. **Sin Dockerfile, sin código, sin sandbox.** Debido a que nada de lo que
envía se ejecuta, la comprobación de seguridad del organizador es una validación de formato decidible
en lugar de intentar probar que el código arbitrario es seguro — una garantía estrictamente más
fuerte para usted y para el corpus.

```bash
mt-eval contest submit-model <contest-slug> \
  --model-dir ./my-model \          # config.json + model.safetensors + tokenizer.* at the ROOT
  --name "My NMT" --version 2.0 \
  --architecture MarianMTModel \    # must be on the organizer's trusted whitelist
  --method-class pipeline --paradigm neural-nmt \
  --developer "Your Name" --node-id <organizer-advertised-node-id> --agree
```

Las reglas que su paquete debe cumplir (validadas localmente antes de la subida, y nuevamente
por el nodo del organizador):

- **Los pesos son `safetensors`, nunca pickle.** Un `.bin`/`.pt`/`.ckpt`
  de PyTorch es un pickle — código arbitrario al cargar — y es rechazado. Exporte a
  `model.safetensors` (`safetensors` / `transformers` hacen esto de forma nativa).
- **Una arquitectura que el motor del organizador carga de forma nativa.** El `architectures` de
  `config.json` puede ser cualquier arquitectura que el `transformers` del anfitrión implemente
  (Marian, NLLB/M2M100, mBART, T5, Pegasus, y muchas más) — los anfitriones son
  **permisivos por defecto**, porque con `trust_remote_code=False` la seguridad
  proviene del formato libre de código, no del nombre de la arquitectura (una arquitectura no
  compatible simplemente falla al cargar, sin ejecutar nada). Un anfitrión cuidadoso puede
  publicar una lista de permitidos (allowlist). Sin `auto_map`, sin `trust_remote_code` — esos introducen
  código personalizado de contrabando y siempre son rechazados.
- **Un tokenizador declarativo** (`tokenizer.json` o un `.model` de `sentencepiece` +
  vocabulario), y **solo archivos de datos** — sin `.py`/scripts/binarios en el paquete.

El organizador lo ejecuta con `trust_remote_code=False`, fuera de línea, y solo salen las
puntuaciones — publicadas como `declarative-model`, identidad del método **libre de código por
construcción**. (Pesos de múltiples GB: use `--bundle-out` para el carril de sneakernet,
igual que a continuación).

### Carril B — paquete ejecutable (el sandbox, para métodos de código)

Si su método es genuinamente código — una canalización (pipeline), un híbrido entrenado por LLM, un decodificador
personalizado — no se puede ejecutar de forma declarativa, por lo que pasa por el sandbox aislado de la red
en su lugar. Este es el carril honestamente más débil (contiene código que no es de confianza
en lugar de negarse a ejecutarlo), así que use el Carril A siempre que su método sea un
modelo estándar.

**El contrato del paquete ejecutable es stdin/stdout.** Su paquete declara un punto de entrada (p. ej. `method/translate.py`). Dentro del contenedor, el nodo del organizador ejecuta exactamente:

```
cat /eval/source.txt | <your entrypoint> > /output/translations.txt
```

Las oraciones de origen llegan una por línea en stdin; usted escribe una traducción por línea en stdout. Todo lo que pasó como `--method-dir` se empaqueta bajo `method/` en el paquete y se monta **de solo lectura en `/method`** en tiempo de ejecución — pesos incluidos, sin necesidad de copiar en la imagen. El contenedor no tiene pila de red (`--network=none`), una raíz de solo lectura, y un `/tmp` escribible.

**Un envoltorio mínimo de transformadores de Hugging Face:**

```python title="method/translate.py"
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
RUN pip install --no-index --find-links=/wheels torch transformers sentencepiece
# Weights are NOT copied — /method is mounted read-only at run time.
```

Envíelo con:

```bash
mt-eval contest submit-method <contest-slug> \
  --method-dir ./my-method --dockerfile ./Dockerfile \
  --name "My NMT" --version 1.0 \
  --entrypoint method/translate.py \
  --method-class pipeline --paradigm neural-nmt \
  --developer "Your Name" --node-id <organizer-advertised-node-id> \
  --agree
```

(Necesita un registro de carril de hipótesis publicado para el concurso primero — la puerta T1 del Paso 9 — y `--agree` reconoce los términos de envío de método.)

**Pesos de varios GB: use el carril de sneakernet.** La ruta de ingesta alojada carga su tarball como un **único POST** al almacenamiento del host del concurso, por lo que está limitado por el límite de carga de almacenamiento de ese host — bien para código y modelos pequeños, no para puntos de control de varios GB. El contrato del paquete en sí permite artefactos mucho más grandes (tarballs hasta 100 GB, imágenes compiladas hasta 150 GB). Para pesos grandes, omita la carga alojada:

```bash
# Package + write an exchange directory, no upload:
mt-eval contest submit-method … --offline --bundle-out ./exchange \
  --secret-set <sealed-set-id> --pair eng>crk --developer-email you@example.org
```

El directorio de intercambio viaja al organizador por medios removibles (o cualquier canal en el que ambos confíen); lo ingieren con `mt-eval node import-bundle`. El SHA-256 del paquete se congela en la solicitud de autorización de cualquier forma, por lo que lo que se ejecuta es demostrablemente lo que propuso.

**Organizadores: precargue imágenes base en máquinas sin aire.** Porque la compilación de imagen se ejecuta con `--network=none`, la imagen base `FROM` del Dockerfile ya debe estar en el almacén de imágenes local de la máquina. En una máquina conectada, `docker pull python:3.11-slim && docker save -o base.tar python:3.11-slim`; lleve `base.tar` con el paquete; en la máquina sin aire, `docker load -i base.tar` antes de ejecutar `mt-eval node run-method`. Acuerde sobre la(s) imagen(s) base con los participantes en sus materiales de concurso publicados.

## Paso 10 — Publique puntuaciones, otorgue según su umbral publicado

Los resultados de solo puntuaciones se publican en la [tabla de clasificación](/docs/network/leaderboard/rules)
como cualquier otra ejecución, marcados como evaluaciones de conjunto sellado.
Si un método supera las condiciones de umbral que publicó en el Paso 6 —
incluyendo [validación de hablantes](/docs/network/specifications/speaker-validation),
que es la puerta de su comunidad, no una automatizada — **usted** (o su
fideicomiso) otorga el premio, según sus propios términos publicados. El papel
de Champollion termina en la medición.

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
