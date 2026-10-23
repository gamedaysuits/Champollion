---
title: "Alojar una prueba sellada y unirse a un proyecto"
slug: /agents/hosting-and-joining
description: "Dos formas de participar más allá de construir: alojar una prueba sellada con mt-eval contest y mt-eval node (funciona, todavía no está sobre rieles y las personas custodias elegidas por quien organiza conservan las partes de la clave), y unirse a un proyecto registrado con mt-eval project — cada comando, qué envía a dónde y qué nunca muestra."
---

# Alojar una prueba sellada y unirse a un proyecto

Dos vías junto a los rieles de compilación. Ambas son comandos simples de `mt-eval`; ninguna
es un paso que `champollion next` nombre.

## Alojar una prueba sellada

**Estado honesto.**

- Funciona: preparar un conjunto sellado, una ceremonia de claves, ejecutar entradas en un
  nodo aislado de la red, los veredictos y la clasificación son todos comandos con pruebas.
- **Aún no está en los rieles.** `champollion new --kind task` se rechaza;
  el único recorrido disponible es el del idioma. Anticipe un proceso manual más largo y
  siga el [manual de procedimientos del concurso](/docs/network/sovereignty/run-a-sovereign-contest).
- **Las partes de la clave están en manos de custodios designados por el organizador.** Nada en
  el código los nombra ni los evalúa. No se han designado custodios comunitarios de claves
  para ninguna prueba.
- **Champollion no conserva ninguna parte de la clave ni ninguna clave privada.** La ceremonia se ejecuta en
  la computadora del organizador, y el registro solo envía identificadores, resúmenes criptográficos
  y el umbral de clasificación; nunca una clave, una parte ni las oraciones.

**Nota.** Alojar decide qué sucede con las oraciones de las personas y quién puede
desbloquearlas. Cada paso a continuación es decisión del organizador; ejecute cada uno solo
cuando se lo pidan.

### Qué se crea

`mt-eval contest prepare` divide el corpus del organizador:

| Parámetro | Conjunto | Quién lo ve |
|---|---|---|
| `--dev-size` (obligatorio) | El clasificador: origen y referencias | Público, publicado desde `<out>/public/` |
| `--secret-size` | La prueba sellada contra la que se registra el concurso | Nadie: sellada en `<out>/local/` |
| `--sealed-holdout-size` (requiere `--secret-size`) | Una segunda división sellada, evaluada pero retenida hasta el cierre | Nadie |

`--seed`, `--qualifier-threshold` (superior a 0) y `--license` son obligatorios; no
se asume ninguna licencia. `--custodian-group` y `--threshold-pubkey` son obligatorios
(la clave con la que se cifran los conjuntos sellados). El texto sin formato de cada conjunto sellado
se elimina después del sellado; `<out>/local/manifest.json` conserva la receta y
nunca sale de la computadora. El sellado ejecuta `champollion network seal-corpus seal`, por lo que la
CLI de `champollion` debe estar instalada.

### Custodia

**Custodia por umbral (M de N).** En el nodo aislado de la red:

```bash
mt-eval node ceremony init --dir <ceremony> --set <sealed set id> --group <group id> --quorum 3 --shares 5 \
  --custodian <name 1> --custodian <name 2> --custodian <name 3> --custodian <name 4> --custodian <name 5>
mt-eval node ceremony share --dir <ceremony> --custodian <name 1> --dest <their token>
mt-eval node ceremony verify --dir <ceremony> --share <a> --share <b> --share <c>
mt-eval node ceremony share --dir <ceremony> --wipe-originals
```

`init` genera la clave, la divide con el esquema de Shamir y la pone en ceros en una sola
llamada; escribe `ceremony.json` (el registro público) y un archivo de parte por cada
custodio. `--set` debe ser el id del conjunto secreto y `--group` el
`--custodian-group` que usará prepare; prepare no los comprueba, y cualquier
discrepancia solo se detecta cuando se rechaza una ejecución. Entregue a prepare el registro
de la ceremonia: `--threshold-pubkey <ceremony>/ceremony.json`.

**Bloqueo.** Un conjunto sellado solo se descifra mediante `mt-eval node run-method <id>
--offline --share … --share …` con al menos M partes de diferentes
custodios cuyos id coincidan con el conjunto. La custodia por umbral solo funciona en esta
vía sin conexión.

**Clave única.** `champollion network seal-corpus keygen --out <dir>` crea un
par de claves; quien posea su archivo de clave puede descifrar por su cuenta. Es lo que utiliza
la vía de nodo conectado.

### El recorrido del organizador (custodia por umbral)

```bash
mt-eval node bundle --out <bundle>                    # on a connected machine: the node's install
mt-eval node bundle --verify <bundle>                 # on the node
mt-eval node keygen --out <keys>
# the ceremony, above
mt-eval contest prepare --corpus master.json --slug <slug> --name "<name>" --pair '<src>><tgt>' \
  --dev-size <n> --secret-size <n> --seed <n> --qualifier-threshold <chrF++> --license <licence> \
  --custodian-group <group id> --threshold-pubkey <ceremony>/ceremony.json --out ./<slug> --no-register
mt-eval contest register --manifest ./<slug>/local/manifest.json
mt-eval node init --from-contest ./<slug>
mt-eval node egress-check
mt-eval node import-bundle <exchange>                 # entries, carried in
mt-eval node run-method <request id> --offline --share <s1> --share <s2> --share <s3>
mt-eval node export-scores <exchange>
mt-eval node verdicts --contest <slug> --out verdicts.json --metric chrf_plus_plus --tie-test ar \
  --alpha <a> --n-resamples <n> --seed <n>
mt-eval contest rank <slug>
mt-eval contest close <slug> --node-verdicts verdicts.json --verify-key <score-signing public key>
```

`node init --from-contest` establece la custodia por umbral cuando el conjunto se selló con
una clave de ceremonia. Los participantes clasifican en el conjunto de desarrollo público (`mt-eval contest
qualify`) and submit methods or models (`mt-eval contest submit-method`,
`mt-eval contest submit-model`, ambos con una ruta `--offline --bundle-out`).
La [guía de nodos](/docs/network/sovereignty/sovereign-eval-node) contiene cada
comando de nodo.

### Qué necesita conexión, y de quién

| Funciona sin conexión | Requiere iniciar sesión | Requiere la clave de servicio de la base de datos |
|---|---|---|
| `contest prepare --no-register`, `contest qualify` (con `--offline-qualifier-id`, `--offline-threshold`), `contest validate`, `submit-* --offline`, cada `node ceremony`, `node seal`, `node keygen`, `node init`, `node import-bundle`, `node run-method --offline`, `node export-scores`, `node verdicts`, `node egress-check` | `contest register`, `contest create`, `submit-*` en línea, `contest open-intake`, `contest close-intake`, `contest close` | `contest prepare` sin `--no-register` o `--self-serve`, `node serve`, `node list`, `node approve`, `node deny`, `node run-method` en línea, `node relay`, y `contest close` cuando los resultados se retuvieron |

La clave de servicio pertenece a quien administra la base de datos. Un organizador externo
ejecuta estos comandos contra una base de datos propia (`MT_EVAL_SUPABASE_URL` y sus
claves), o se mantiene en la vía sin conexión, cuyas puntuaciones son verificables a partir de sus
manifiestos firmados, pero no obtienen una entrada en la tabla pública. **Nota.** Nunca configure
`MT_EVAL_ALLOW_PROD`: elimina la restricción de las herramientas de escribir en la base de datos de
producción predeterminada, y esa no es una decisión que le corresponda tomar a un agente.

## Unirse a un proyecto

Un **proyecto registrado** es un proyecto lingüístico que su propietario listó para que otros
puedan ayudar con archivos: oraciones, listas de palabras o métodos (el tiempo de revisión y
el cómputo aún no se ofrecen). Los comandos de `mt-eval
project` que figuran a continuación se comunican con la base de datos del proyecto
(`MT_EVAL_SUPABASE_URL`). Cada subcomando, excepto `list` (anónimo) y
`review` (del operador), inicia sesión (una sesión en caché,
`MT_EVAL_REFRESH_TOKEN` o un inicio de sesión interactivo con GitHub o Google);
la cuenta corresponde al correo electrónico utilizado al iniciar sesión.

**Las reglas.**

- **Revisado antes de listarse.** Un proyecto nuevo comienza como `pending_review`; solo se
  lista tras su revisión. Un propietario puede cerrar un proyecto y no listarlo nunca.
- **El propietario se nombra como prefiera** (`--owner-name`). La fila del proyecto
  no contiene ningún correo electrónico; la cuenta del propietario se mantiene aparte, legible solo por él.
- **Sin correo electrónico en los listados.** `project list` es anónimo y muestra nombres y
  conteos; `project offers` muestra a los colaboradores por el nombre que proporcionaron (`--as`).
  La cuenta del propietario aún puede leer el correo de la cuenta del colaborador en el
  registro de la oferta, y la nota de consentimiento registra ambas cuentas.
- **Las ofertas son compartidas por ambos.** Al aceptar, se redacta una nota de consentimiento que nombra a quién
  la envió y a quién la autorizó.
- **No se muestra nada del contenido de un archivo.** Solo nombres, conteos y estados.

### Propietario

```bash
mt-eval project register --project . --name "<project name>" --owner-name "<as they want to be named>" \
  --purpose "<what the translations are for>"
mt-eval project ask <slug> --kind sentences --what "<what would help>" --how-many 200 --terms "<their terms>"
mt-eval project offers <slug>
mt-eval project accept <offer id> --into .
mt-eval project decline <offer id> --why "<reason>"
```

- `register` lee el par desde `champollion.project.json` (y el propósito,
  a menos que `--purpose`); `--slug`, `--domain`, `--register`, `--about` opcionales.
  Como máximo 5 registros por cuenta cada 24 horas.
- `ask` `--kind` es `sentences`, `word-list` o `method`; las solicitudes solo se muestran mientras
  el proyecto esté listado.
- `accept` descarga el archivo, **verifica su sha256** (se rechaza si
  hay discrepancia), escribe `inbox/offer-<offer id>-<file name>` y
  `consent/offer-<offer id>.json` (`offer_id`, `file`, `sha256`,
  `submitted_by`, `authorized_by`, `terms`, `note`, `held_by`), y luego marca la
  oferta como aceptada. El archivo se incorpora entonces como cualquier otro —
  `champollion data add inbox/<file>` — y se solicitan los términos de sus titulares.
- **Nota.** Los `--terms` del colaborador están en la nota de consentimiento. Las respuestas que
  usted registre con `champollion data mark` no deben flexibilizarlos.

### Colaborador

```bash
mt-eval project list
mt-eval project offer <slug> <file> --as "<your name>" --terms "<what it may be used for>" --ask <ask id> --note "<note>"
mt-eval project withdraw <offer id>
```

- `offer` sube un archivo no vacío de 50 MB como máximo al almacenamiento
  privado del proyecto, junto con su sha256, únicamente a un proyecto listado. Como máximo 24
  ofertas por colaborador cada 24 horas.
- Una oferta cambia de estado una sola vez: `offered` → `accepted`, `declined` o `withdrawn`.
- **Nota.** Retirar o rechazar cambia el estado de la oferta; no
  elimina el archivo subido del almacenamiento. Adviértalo antes de que un colaborador ofrezca
  algo que quizás quiera recuperar.
- **Bloqueo.** `offer` lee el archivo adjunto (sidecar) antes de subir cualquier cosa. Rechaza
  un archivo `local-only`, un conjunto `sealed` y un archivo cuya
  `speakers_agreed` sea `not-yet` o `some-said-no`; un sidecar ilegible
  detiene la oferta. No hay forma de omitirlo: la marca corresponde cambiarla a los titulares.
  Se añade un término `training: not-allowed` a los términos de la oferta, de modo que el propietario
  pueda verlo.
- **Nota.** Una oferta envía el archivo fuera de la computadora del colaborador al almacenamiento
  de la base de datos del proyecto. Pregunte al colaborador y nunca ofrezca un archivo en su lugar.

`mt-eval project review` corresponde al operador de la base de datos (utiliza la clave
de servicio). No es un comando para un agente.

## Profundice

- [Alojar una prueba sellada](/docs/host-a-sealed-test) y
  [Unirse a un proyecto](/docs/join-a-project) — las versiones para el público general.
- [Organizar un concurso soberano](/docs/network/sovereignty/run-a-sovereign-contest)
  y [el nodo de evaluación soberano](/docs/network/sovereignty/sovereign-eval-node).
- [Transferencia de propiedad](/docs/network/sovereignty/ownership-transfer) y
  [plantillas de términos](/docs/network/sovereignty/terms-templates).
- [Reglas de datos y transmisión](/docs/agents/data-rules) — conjuntos sellados y
  archivos de uso exclusivamente local.
- [Referencia de `mt-eval`](/docs/reference/mt-eval).
