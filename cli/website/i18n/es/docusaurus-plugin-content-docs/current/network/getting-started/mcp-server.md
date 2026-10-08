---
title: "Servidor MCP — la puerta de acceso para el agente"
sidebar_label: "Servidor MCP"
description: "Conecte un agente de IA a Champollion a través del Model Context Protocol: 34 herramientas para consultar idiomas, explorar la cola de benchmarks y el registro de corpus, ejecutar evaluaciones, entrenar y exportar modelos, y traducir —además de detallar con exactitud cuáles requieren más que un npx install."
---

# Servidor MCP — la puerta de entrada para agentes

`champollion-mcp-server` expone Champollion a agentes de IA a través del [Model
Context Protocol](https://modelcontextprotocol.io). Si usted es un agente, o está
configurando uno, esta es la puerta: **34 herramientas, 3 recursos y 4 prompts**
a través de stdio.

Todo lo que se encuentra aquí también es accesible como HTTP simple — consulte [Endpoints legibles por máquina](#machine-readable-endpoints) —, pero el servidor MCP es la única superficie que permite a un agente *actuar* (traducir, ejecutar un benchmark, entrenar un modelo) en lugar de solo leer.

## Instalación

```bash
npx -y champollion-mcp-server
```

Luego, regístrelo en su cliente. Para Claude Code:

```bash
claude mcp add champollion -- npx -y champollion-mcp-server
```

Para clientes configurados mediante archivo (Claude Desktop, Cursor, Antigravity), agregue:

```json
{
  "mcpServers": {
    "champollion": {
      "command": "npx",
      "args": ["-y", "champollion-mcp-server"]
    }
  }
}
```

## Lea esto antes de depender de él

**Catorce de las 34 herramientas funcionan a partir de una instalación básica de `npx`, y `translate` funciona
una vez que tiene un motor. Las otras diecinueve necesitan paquetes de Python que el paquete npm
no incluye ni puede incluir.** No fallan silenciosamente; cada una devuelve un
error accionable indicando qué falta, pero conviene que conozca el panorama antes
de planificar en torno a él.

| Herramientas | ¿Funcionan después de `npx`? | Qué más necesitan |
|---|---|---|
| `search_languages`, `get_language`, `language_overview`, `list_corpora`, `get_results`, `get_run_card`, `get_metric_reliability`, `list_contests`, `get_contest`, `get_project_info`, `list_queue`, `get_queue_item`, `estimate_cost`, `get_training_guardrails` | **Sí**: de solo lectura, provistas desde endpoints públicos | nada |
| `translate` | **Sí**, con un motor | una clave de API para el motor que elija, o ninguna, con el método `local` y un servidor de modelos en su propia máquina |
| `run_benchmark`, `get_run_status`, `preview_publish`, `publish_report` | No | el entorno de evaluación: `pipx install mt-eval-harness` |
| las quince herramientas `forge_*` | No | NMT Forge 0.2.0 o posterior: `python3 -m pip install nmt-forge` (agregue `'nmt-forge[hf]'` para entrenar y servir). Incluye el entorno de evaluación y encuentra las fichas de idiomas por sí mismo; no se necesita clonar |

No se necesita clonar el repositorio para nada de esto.

## Qué hacen las herramientas

**Explorar y calcular el costo del trabajo.** `list_queue` y `get_queue_item` recorren la cola de benchmarks abiertos — la lista clasificada de mediciones que más mejorarían el mapa. `estimate_cost` calcula el precio de un conjunto de ejecuciones antes de que usted gaste algo.

**Consulte información.** `search_languages` busca en las fichas de idiomas por nombre,
código, familia o región, y tolera errores tipográficos. Cada resultado también indica dónde
se habla el idioma (países, un punto en el mapa, macroárea) y sus otros
nombres: únicamente los datos para los cuales su ficha cita una fuente, cada uno con dicha fuente, para
que los idiomas con nombres similares puedan distinguirse. Una ubicación sin fuente
nunca se muestra; la línea lo indica y, en su lugar, enlaza al registro de Glottolog del
idioma. Las fichas completadas a partir de las tablas de fichas publicadas de champollion.dev (en una
instalación de npm, cada idioma fuera del conjunto básico incluido) aún no incluyen
fuentes por campo —estas llegarán con la próxima actualización de las tablas—, por lo que esas
líneas incluyen el enlace a Glottolog en lugar de una ubicación. `language_overview` es el
punto de partida de una sola página para desarrollar para un idioma: qué existe, qué puede
ejecutarse y los pasos siguientes. `get_language` devuelve la ficha completa con citas.
`list_corpora` enumera los corpus de evaluación
registrados para un par de idiomas o familia de pruebas comparativas: solo metadatos (tamaño,
licencia, grado de contaminación y si el entorno de evaluación puede obtenerlo, necesita un
token de acceso o lo mantiene en cuarentena); el contenido del corpus nunca se devuelve,
y un par cuyos corpus están todos en cuarentena lo indica en lugar de parecer
no compatible. `get_results` y `get_run_card` leen ejecuciones puntuadas de
la tabla de clasificación pública. `get_metric_reliability` responde a la pregunta en la que la mayoría de los
agentes se equivoca —*en qué métrica debo confiar para este idioma de destino*—
a partir de correlaciones con evaluaciones humanas por familia lingüística. `list_contests`
y `get_contest` muestran los concursos y sus términos declarados; inscribirse en uno es un
paso de la CLI autorizado por un humano, nunca una herramienta.

**Actúe.** `translate` pasa texto a través de la canalización probada, con Memoria
de Traducción (las repeticiones no cuestan nada) y un filtro de calidad determinista. Cada respuesta
indica el motor que realmente se ejecutó, con su modelo y endpoint en caso de tenerlos.
`run_benchmark` inicia una evaluación y devuelve un **id de trabajo de inmediato**,
porque las ejecuciones reales superan cualquier tiempo de espera del cliente; usted sondea `get_run_status` con
ese id. Un trabajo sobrevive al reinicio del servidor: la ejecución continúa y
sondear el mismo id después aún devuelve su estado y resultados. No
se publica nada a menos que pase `publish: true`; el plan entonces indica qué se haría
público —cada fila con el texto de su oración, o solo las puntuaciones; el prompt, o solo
su hash; y dónde—, y una publicación real necesita `publish_ack` con las palabras exactas
que proporciona el plan, para que el usuario las haya visto primero. Una ejecución realizada sin este parámetro
puede publicarse más tarde, tras la misma validación. `preview_publish` es de solo lectura:
muestra la propia vista previa de publicación del entorno de evaluación, las palabras exactas y la llamada exacta
a `publish_report` que la publicaría, y no puede publicar.
Lleva la anotación de MCP `readOnlyHint: true`, por lo que un host de agentes que consulte
antes de cada escritura puede permitirlo por sí mismo. `publish_report` realiza la escritura
(con las anotaciones `destructiveHint` y `openWorldHint`), y `scores_only`
omite el texto de la oración. Cada plan también comienza con el
estado de `EVAL PACK:` del idioma de destino —`missing` (con el comando que
lo instala), `ready` o `none needed`— y menciona la licencia del corpus y su
término `do_not_train`, porque la ejecución pasa `--yes`. La ausencia de un FST (el
analizador o su entorno de ejecución pyhfst) nunca detiene la ejecución: esta continúa, y la ficha
de la ejecución marca la aceptación del FST como no calculada. Cualquier otra pieza faltante detiene la ejecución
antes de traducir. `skip_fst` y `skip_eval_standard` puntúan sin esas
piezas, y la ficha de la ejecución indica qué se omitió. El plan también señala si
se calculará COMET (el entorno de evaluación lo calcula siempre que `unbabel-comet` esté
instalado; `comet: true` hace que la ejecución lo requiera), y `metricx` y `fuse`
solicitan MetricX-24 opcional del entorno de evaluación y el comparador de estilo FUSE. Para cada
uno, el plan indica, a partir del entorno de evaluación, si está instalado, qué instalar
y qué descarga. Una ejecución confirmada que solicita una métrica que el entorno de evaluación
no puede calcular se rechaza en lugar de ejecutarse sin ella. Las líneas `Results:`
y `Cache:` del plan indican dónde se guardan el registro de la ejecución, el informe y la caché de traducción.
Un archivo de prueba dentro de una carpeta que `mt-eval contest prepare` marca como publicable
(el `public/` de un concurso) se ejecuta en la carpeta `runs/` del concurso en su lugar, de modo que
nada de lo que escribe una ejecución se publique junto con él. Un modelo en su propia
máquina (un servidor local o `method: "local-model"`, que el entorno de evaluación ejecuta
en el proceso y no necesita atestación) se reporta como `$0 API cost (runs on
this machine)`.

**Entrene sin engañarse.** `get_training_guardrails` devuelve las reglas
extraídas de fallos reales medidos. Las quince herramientas de `forge_*` ejecutan
[NMT Forge](/docs/network/getting-started/training-honestly) un paso controlado
a la vez: `forge_status` primero y después de cada paso (indica el siguiente
comando y la herramienta que lo ejecuta), `forge_preflight` para ver con qué barreras
chocará un comando antes de rechazar la acción, `forge_prereg_template` y `forge_prereg`
para registrar las predicciones antes de que exista cualquier puntuación de prueba (y antes de cualquier
prueba comparativa en el conjunto de prueba: una lectura de puntuación bloquea un prerregistro posterior),
`forge_export` para puntuar el conjunto de prueba una sola vez y empaquetar el modelo entrenado,
`forge_compare` para comparar mediante pruebas A/B dos modelos con la advertencia de casi duplicado de cada uno junto
al ganador, y
`forge_prereg_verdict` para registrar el veredicto del propio usuario sobre una predicción que Forge
no puede juzgar (un rango de texto libre), mostrado como un veredicto humano, nunca como uno
calculado. `forge_status` enumera cada ejecución entrenada con su puntuación de desarrollo e
indica cuándo un conjunto de desarrollo está saturado (una puntuación de desarrollo perfecta sin nada entre lo cual
la selección de puntos de control pueda elegir). Cuando el entorno de evaluación incluye una advertencia
en una puntuación de prueba (por ejemplo, una salida casi constante: un puñado de salidas
generadas para cada oración de origen), `forge_export`, `forge_status`,
`forge_compare` y `forge_lint` la incluyen con las palabras textuales del entorno de evaluación, y una
advertencia importante aparece en primer lugar en el siguiente paso: la puntuación nunca se cita sin
ella. Un rechazo devuelve
qué salió mal, por qué es importante y la solución. Dos pasos superan la duración de cualquier llamada
a una herramienta y se ejecutan en una terminal en su lugar: el entrenamiento (`nmt-forge run`) y el servicio del
modelo exportado (`nmt-forge serve`, que lo coloca detrás de un endpoint local que
`translate` y la CLI pueden usar).

### Argumentos

`name` es obligatorio y `name?` es opcional. Cada herramienta que toma un
idioma también lo acepta como `language`: "`code` o `language`" significa que cualquiera de los
dos nombres funciona y usted pasa uno. Los nombres originales siguen funcionando.

| Herramienta | Argumentos |
|---|---|
| `search_languages` | `query` o `language`, `limit?` |
| `language_overview` | `code` o `language`, `source?` |
| `get_language` | `code` o `language`, `format?` |
| `list_corpora` | `source_language?`, `target_language?`, `family?` (al menos uno de estos tres), `include_quarantined?`, `limit?` |
| `get_results` | `source_language?`, `target_language?`, `model?`, `sort?`, `limit?` |
| `get_run_card` | `id` |
| `get_metric_reliability` | `target` o `language` |
| `list_contests` | `status?`, `language?`, `limit?` |
| `get_contest` | `id` |
| `get_project_info` | ninguno |
| `list_queue` | `language?`, `source_language?`, `model?`, `budget?`, `condition?`, `limit?` |
| `get_queue_item` | `id?` o `priority?` (uno de ellos) |
| `estimate_cost` | `budget?`, `language?`, `source_language?`, `model?`, `condition?` |
| `get_training_guardrails` | `topic?` |
| `translate` | `texts`, `source_language`, `target_language`, `method?`, `model?`, `base_url?`, `endpoint?`, `register?`, `project_dir?`, `context?` (un msgctxt de gettext: uno para cada texto, o uno por texto), `script?`, `use_tm?`, `validate?` |
| `run_benchmark` | un modo: `budget?` o `top?` (cola), `item_id?`, o `corpus?` con `model?` (con `method_dir`, el modelo que carga el plugin), `method?` o `method_dir?` (un directorio de plugin de método; `local-model` necesita `model` — no tiene valor predeterminado), `allow_model_pair_mismatch?` (`local-model`: ejecuta un modelo de par OPUS-MT que nombra a otro par, como una línea base de idioma relacionado), `attest_local_transport?` (un motor de traducción automática o un plugin; nunca es necesario para `local-model`), `provider?`, `base_url?`, `target_language?`, `script?` (ejecuciones de LLM: la escritura ISO 15924 en la que debe redactarse la salida, como `Cans` o `Latn`; el plan indica cuándo la ficha del destino enumera más de una), `source_language?`, `source_field?`, `target_field?`, `max_cost?`, `coaching_file?`, `glossary?`, `attest_no_training?`, `accept_nc_terms?`, `skip_fst?` y `skip_eval_standard?` (ejecuciones de elementos y corpus: puntúan sin el FST o sin las métricas estándar de evaluación, marcadas como no calculadas), `comet?` (requiere COMET: la ejecución se rechaza mientras no esté instalado), `metricx?` con `metricx_model?`, y `fuse?` (ejecuciones de elementos y corpus: MetricX-24 opcional del entorno de evaluación y el comparador de estilo FUSE, rechazados mientras no estén instalados); luego `dry_run?`, `confirm?`, `publish?`, `publish_ack?` (con una publicación real: las palabras exactas que imprime el plan), `anonymous?` |
| `get_run_status` | `job_id?` |
| `preview_publish` | `report` (el `*_report.json` de una ejecución finalizada), `scores_only?`, `redact_coaching?`, `anonymous?` (solo lectura: sin `confirm`, no puede publicar) |
| `publish_report` | `report` (el `*_report.json` de una ejecución finalizada), `scores_only?`, `redact_coaching?`, `anonymous?`, `confirm?`, `publish_ack?` (las palabras exactas que imprime la vista previa) |
| `forge_status` | `workspace?`, `project_dir?` |
| `forge_preflight` | `target` (el comando a verificar), `config?`, `workspace?`, `project_dir?` |
| `forge_discover` | `code` o `language`, `cards_dir?`, `workspace?`, `project_dir?` |
| `forge_init` | `code` o `language`, `dir?`, `pair?`, `model?`, `base?`, `no_card?`, `name?`, `cards_dir?` |
| `forge_split` | `corpus`, `test`, `seed`, `out?` (por defecto `data/split`, la ruta que lee el config.json de `forge_init`), `dev?`, `register?` (un prefijo de nombre, o `true` para `project`), `allow_rotate?`, `near_dupe?` (un umbral de Jaccard como 0.6, cuando Forge recomienda la partición de casi duplicados), `max_group?` (con `near_dupe`: el grupo de casi duplicados más grande), `workspace?`, `project_dir?` |
| `forge_leak_audit` | `corpus`, `strict?`, `clean_to?`, `drop_test_twins?` (con su propio `clean_to`, p. ej., `corpus.notwins.jsonl` — nunca el archivo con todos los datos), `companion_config?` (con `drop_test_twins`: adónde va la configuración del modelo sin duplicados; por defecto `config-notwins.json`), `overwrite?` (reemplaza un archivo `clean_to` que usa una configuración, una ejecución, una división u otra auditoría — rechazado sin él), `full_indices?` (cada lista de números de fila completa; por defecto las listas largas se devuelven como `{count, first}`), `workspace?`, `project_dir?` |
| `forge_register_eval` | `name`, `path`, `role`, `source_field?`, `target_field?`, `allow_rotate?`, `workspace?`, `project_dir?` |
| `forge_prereg_template` | `out?`, `force?`, `project_dir?` |
| `forge_prereg` | `id`, `eval_set`, `predictions`, `author?`, `config_hash?` (fíjela a una ejecución), `allow_after_reads?` (solo para predicciones escritas antes de las lecturas puntuadas del conjunto), `workspace?`, `project_dir?` |
| `forge_prereg_verdict` | `id`, `prediction` (su número o su propio id), `verdict` (`held` o `missed`), `by` (quién evaluó), `note?`, `revise?`, `workspace?`, `project_dir?` |
| `forge_export` | `run_manifest`, `out`, `config?`, `no_eval?`, `no_model?`, `glossary?`, `endpoint?`, `port?`, `name?`, `force?`, `prereg?`, `workspace?`, `project_dir?` |
| `forge_evaluate` | `run_manifest`, `config?`, `out_hyps?`, `harness_out?`, `glossary?`, `prereg?`, `workspace?`, `project_dir?` |
| `forge_lint` | `manifest`, `run_manifest?`, `workspace?`, `project_dir?` |
| `forge_report` | `manifest`, `workspace?`, `project_dir?` |
| `forge_compare` | `eval_set`, `hyps_a`, `hyps_b`, `label_a?`, `label_b?`, `run_a?`, `run_b?` (el manifiesto de ejecución de cada modelo: sus datos de entrenamiento se verifican en busca de casi duplicados), `metric?`, `target_lang?`, `config_hash?`, `prereg?`, `override_respend?`, `workspace?`, `project_dir?` |

Por ejemplo, `get_metric_reliability { "language": "crk" }` y
`get_metric_reliability { "target": "crk" }` hacen la misma pregunta.

### Traducir con un modelo que haya implementado

`nmt-forge serve` imprime dos direcciones para el modelo que sirve. Apunte
`translate` a cualquiera de ellas:

| Argumento | Úselo con | Ejemplo |
|---|---|---|
| `base_url` | `method: "local"`: un servidor compatible con OpenAI (también `"openai"`) | `http://127.0.0.1:8378/v1` |
| `endpoint` | `method: "api"`: el contrato de API de Champollion | `http://127.0.0.1:8378/translate` |
| `model` | Solo motores de LLM; rechazado para API de traducción automática, que no tienen ninguno | `llama3.1` |
| `project_dir` | Cualquier método: usa la Memoria de Traducción de ese proyecto | `~/my-app` |

Un servidor en su propia máquina no necesita clave. Un endpoint remoto de `api` lee su
clave de `CHAMPOLLION_API_KEY` en el entorno del servidor. La herramienta rechaza
por su nombre un argumento que no conoce, en lugar de ignorarlo, para que un argumento
mal escrito no envíe discretamente su texto a un modelo diferente.

### Dónde guarda su estado el servidor

Todo reside en `~/.champollion-mcp/` (defina `CHAMPOLLION_MCP_HOME` para moverlo):

- **La Memoria de Traducción de `translate`** es su propio archivo,
  `.champollion/tm.json` en esa carpeta. Es independiente del `.champollion/tm.json` de
  cualquier proyecto. Pase `project_dir` para usar en su lugar el archivo de un proyecto,
  el que `champollion sync` usa allí.
- **Los trabajos de `run_benchmark`** se registran en `jobs.json`, que conserva los
  50 más recientes. Cada trabajo tiene una carpeta en `jobs/` con su salida y, para un
  elemento de la cola o un corpus registrado, los resultados del entorno de evaluación. Una ejecución sobre un archivo de
  prueba que usted posea escribe sus resultados y caché junto a ese archivo, en
  `results/` —excepto un archivo en una carpeta que `mt-eval contest prepare`
  marca como publicable, cuya ejecución escribe en la carpeta `runs/` del concurso.
  Las ejecuciones en cola escriben sus informes en `eval/logs/harness/queue/` bajo la
  carpeta de trabajo del servidor, como siempre lo hace el entorno de evaluación.

:::note[El gasto está limitado por diseño]
`run_benchmark` **rechaza una ejecución de cola sin límites.** Usted debe pasar exactamente un límite — `budget`, `top`, o un `item_id` específico. No hay una llamada para "simplemente ejecutar la cola", porque un agente que malinterprete la cola podría, de lo contrario, gastar sin límite.
:::

## Versión del protocolo

El transporte es **solo stdio** — un proceso de servidor por agente.

La [revisión del 2026-07-28](https://blog.modelcontextprotocol.io/posts/2026-07-28/) de MCP hizo que el protocolo fuera sin estado por defecto, retirando el handshake `initialize` y el encabezado `Mcp-Session-Id`. Este servidor no se ve afectado en su diseño: no utiliza ninguna de las capacidades obsoletas (Roots, Sampling, Logging), nunca utilizó el transporte heredado HTTP+SSE, y ya sigue las nuevas directrices para el estado entre llamadas — `run_benchmark` crea un identificador de trabajo explícito que el modelo devuelve, en lugar de depender de una sesión de transporte.

**No** se ha actualizado a la nueva revisión, porque ningún SDK de TypeScript publicado la soporta todavía. Consulte el [README del servidor](https://github.com/gamedaysuits/Champollion/tree/main/mcp-server) para conocer la postura completa.

## Endpoints legibles por máquina

No se necesita un cliente MCP para estos:

| Endpoint | Qué es |
|---|---|
| [`/for-agents.md`](https://champollion.dev/for-agents.md) | La [puerta de entrada para agentes](/for-agents), como markdown sin procesar |
| [`/llms.txt`](https://champollion.dev/llms.txt) | El índice curado de este sitio |
| [`/llms-full.txt`](https://champollion.dev/llms-full.txt) | Todas las páginas indexadas, integradas |
| [`/queue.json`](https://champollion.dev/queue.json) | La cola completa de benchmarks |
| [`/queue-preview.json`](https://champollion.dev/queue-preview.json) | Los elementos principales de la cola |
| [`/registry.json`](https://champollion.dev/registry.json) | El registro del corpus |
| [`/mesh.json`](https://champollion.dev/mesh.json) | El grafo de idiomas medidos |

## Siguiente

- [Guía para agentes — construcción y benchmarking](/docs/network/getting-started/agent-guide)
- [Guía para agentes — traducción con la CLI](/docs/guides/agent-guide)
- [Enviar un método](/docs/network/getting-started/submit-a-method)
