---
title: "Manejar los rieles mediante MCP"
slug: /agents/mcp
description: "Conecte un cliente MCP al perfil de rieles de Champollion y recorra un proyecto lingüístico con seis herramientas: configuración por cliente, cada argumento y retorno, el ciclo, los modos de paso, los rechazos y los temas de explicación."
---

# Conducir los rieles sobre MCP

El perfil predeterminado del servidor MCP son los rieles: seis herramientas que guían un
proyecto de idioma desde una carpeta vacía hasta un modelo evaluado en la
propia computadora de la persona. Cada herramienta ejecuta la CLI de `champollion` como un proceso
independiente y delimitado: los mismos comandos que escribe una persona. El servidor también le entrega a su cliente
instrucciones operativas breves (`instructions-rails.md`) al momento de la conexión.

## Conectar

El servidor se comunica por MCP a través de stdio y necesita Node.js 20.11 o posterior. La
configuración que admite todo cliente configurado mediante archivos:

```json
{
  "mcpServers": {
    "champollion": { "command": "npx", "args": ["-y", "champollion-mcp-server"] }
  }
}
```

| Cliente | Dónde va |
|---|---|
| Claude desktop | Settings → Developer → Edit Config. Añada la entrada, guarde y reinicie la aplicación |
| Claude Code | `claude mcp add champollion -- npx -y champollion-mcp-server` |
| Cursor | `mcp.json` en la carpeta `.cursor` del proyecto, o en `.cursor` en la carpeta de inicio |

Otros clientes que pueden iniciar un servidor stdio local admiten el mismo comando; esta
página solo describe los tres anteriores.

**Rutas de las herramientas.** El servidor encuentra por sí mismo la CLI de la que depende. Encuentra
`nmt-forge` en `PATH`, luego en `UV_TOOL_BIN_DIR` (por defecto `~/.local/bin`,
donde lo ubica `uv tool install`); un cliente iniciado desde una aplicación de escritorio a menudo
tiene un `PATH` más corto que una terminal. Modificaciones, como variables de entorno en
el `env` de la entrada del servidor:

| Variable | Efecto |
|---|---|
| `CHAMPOLLION_MCP_PROFILE` | `rails` (por defecto) o `full` |
| `CHAMPOLLION_CLI_BIN` | el punto de entrada de la CLI de `champollion` que se ejecutará en lugar del integrado |
| `NMT_FORGE_BIN` | el ejecutable de `nmt-forge` (el trayecto de la CLI respeta la misma variable) |
| `UV_TOOL_BIN_DIR` | dónde buscar `nmt-forge` y `uv` después de `PATH` |

## Perfiles

| Perfil | Selección | Qué es |
|---|---|---|
| rails | el predeterminado | Seis herramientas e instrucciones breves; un proyecto de idioma, de principio a fin |
| full | `--profile full` en `args`, o `CHAMPOLLION_MCP_PROFILE=full` | Todas las herramientas: fichas de idioma, corpus, evaluaciones de referencia, la cola, contiendas, entrenamiento de forge y publicación |

Cualquier otro valor detiene el servidor: `unknown MCP profile "<value>" (rails or
full)`. El conjunto completo está catalogado en
[la página del servidor MCP](/docs/network/getting-started/mcp-server). Para un
proyecto de idioma, permanezca en el perfil rails: es aquel en el que cada paso
se lee a partir de los archivos del proyecto.

## El ciclo

1. Todavía no hay proyecto → `start_project`. Su primera llamada no crea nada: comuníquele su
   `ask_first` a la persona, y luego realice la llamada que proporcione para la respuesta recibida.
2. `project_status` → lea `step.mode`, `step.say`, `step.why`.
3. Haga lo que indique el modo, usando `step.call`: la llamada exacta que realiza el
   paso.
4. Regrese al punto 2. Después de cualquier cambio que usted o la persona hayan hecho a mano, llame a
   `project_status` de nuevo: el siguiente paso siempre se lee a partir de los archivos.
5. `step: null` → los rieles terminaron. Dígale a la persona lo que indica `finished`.

| `step.mode` | Qué hacer | `step.call` |
|---|---|---|
| `auto` | Ejecútelo | `run_next_step` con `project_dir`, `step_id` |
| `confirm` | Explique a la persona lo que hace (instalaciones, entrenamiento); pregunte sí o no; ejecútelo solo si responde que sí. Ante "ahora no", regístrelo: nada se ejecuta | `run_next_step` con `confirmed: true` añadido tras el sí; `declined: true` ante "ahora no" |
| `ask_user` | Pregunte `step.question` con palabras sencillas; pase sus respuestas según las claves en `step.answers`. Ante "ahora no": cuando `not-now` sea uno de los valores propios de `enum` para una casilla, es una respuesta; pásela; de lo contrario, regístrelo: nada se ejecuta | `run_next_step` con `answers` — cada casilla escrita como `<…>`, que se reemplazará por las palabras de la persona; `declined: true` ante un "ahora no" que no sea una de las respuestas |
| `wait` | Hay algo ejecutándose | `project_status` con `wait_seconds: 120`; repita mientras el modo siga siendo `wait` |
| `use_tool` | Hágalo usted ahora con `step.tool`; no lo devuelva | p. ej., `add_data` con `path: "<each file the person named, where it is>"` |
| `human_only` | Lo hace una persona: dígale `step.say` | ninguno |

`step.command` es lo que ejecutan los rieles; nunca el nombre de una herramienta. Un `<…>` en una llamada es
una casilla para la respuesta o el archivo de la persona; si se devuelve una casilla tal como está, se
rechaza.

## Las seis herramientas

### `start_project`

| Argumento | Tipo | Significado |
|---|---|---|
| `folder` | cadena, obligatorio | Nueva carpeta para el proyecto, relativa a `parent_dir` |
| `from` | cadena, obligatorio | El idioma que la gente ingresa: un código o un nombre |
| `to` | cadena, obligatorio | El idioma que se obtiene: un código o un nombre |
| `target_name`, `source_name` | cadena | El nombre del idioma tal como lo llama su comunidad; obligatorio para un código de uso privado (`qaa`–`qtz`) |
| `purpose` | cadena | Para qué son las traducciones, en palabras de la persona |
| `parent_dir` | cadena | Dónde crear la carpeta (por defecto: el directorio de trabajo del servidor) |
| `confirmed` | booleano | `true` solo después de que la persona haya aceptado la dirección |

Sin `confirmed: true` ejecuta `champollion new --dry` y devuelve
`made: false`, `ask_first` (una frase para decir: *«Este traductor toma X y
devuelve Y: usted ingresa X y sale Y. ¿Es ese el sentido que
desea?»*), `if_yes` y `if_the_other_way` (cada una una llamada completa) y
`languages`: a qué se resolvió cada nombre, con `matchedAs` cuando la palabra
de la persona es otro nombre registrado en una ficha, y `alsoNamed` cuando la misma palabra nombra
otros idiomas. Comunique ambos. Con `confirmed: true` crea el proyecto
y devuelve `project`, `languages` y `next` (el primer paso).

Si ninguna ficha contiene el nombre ni uno similar: el rechazo añade
`if_it_has_no_code`, la misma llamada con `to: "qaa"` y su nombre como
`target_name`. Úselo únicamente para el nombre que proporcionó la persona.

### `project_status`

Argumentos: `project_dir` (obligatorio); `wait_seconds` (0–120). Con
`wait_seconds`, vuelve a leer cada 5 segundos mientras el paso sea `wait`, y
retorna cuando el paso cambia o el tiempo se agota.

Devuelve `project`, `stage` (`"2/6 Gather your data"`), `step` (`id`, `mode`,
`say`, `why`, `call`, y cuando correspondan `question`, `answers`, `command`,
`tool`, `for_the_person`), y los siguientes cuando correspondan:

| Campo | Qué es | Qué hacer |
|---|---|---|
| `true_now` | El propio registro de Forge, en forma de oraciones: modelos entrenados y su mejor chrF++ de dev, el veredicto de la auditoría de filtraciones por conjunto de prueba, puntajes en el conjunto de prueba, si el entrenamiento se está ejecutando, si se está sirviendo un modelo y dónde | Describa lo que se ha hecho únicamente a partir de estas líneas, nunca más |
| `waiting_for_agreement` | Archivos cuyos hablantes aún no han dado su consentimiento (`speakers_agreed: not-yet`): cada uno con `file`, `question`, `say` y su propio `call` | Haga cada pregunta una vez por sesión, con amabilidad; realice su llamada solo cuando la persona confirme que todos estuvieron de acuerdo |
| `files_not_added` | Archivos rechazados por `add_data` en esta sesión que aún no están en el proyecto, cada uno con su motivo de rechazo | Incorpore cada uno (su rechazo explica cómo), o informe a la persona cuál quedó fuera y por qué |
| `model_in_use` | Una vez que se sirve un modelo, junto a los pasos de las rondas de mejora: `say` (su página de prueba y cómo se usa) y `for_the_person` (el comando `champollion connect` que lo integra en su aplicación o sitio web) | Infórmeselo a la persona una vez; ella ejecuta connect cuando lo desee |
| `blockers`, `warnings` | Los de Forge, textuales | Transmítalos palabra por palabra |
| `finished` | Cuando no queden más pasos: lo que la comunidad puede hacer ahora (probar el modelo en su página; una aplicación) | Infórmeselo a la persona |
| `error` | Por qué no se pudo determinar un paso | Transmítalo |

Una carpeta de proyecto que no existe o no tiene `champollion.project.json`
se rechaza indicando los proyectos encontrados en las proximidades.

### `run_next_step`

| Argumento | Tipo | Significado |
|---|---|---|
| `project_dir` | cadena, obligatorio | La carpeta del proyecto |
| `step_id` | cadena, obligatorio | El `step.id` (o el id de una entrada de `waiting_for_agreement`) recién devuelto |
| `answers` | objeto de cadenas | `ask_user`: las respuestas de la persona según las claves en `step.answers` |
| `confirmed` | booleano | `confirm`: `true` solo después de que la persona haya dicho que sí. También: un paso que falló dos veces, solo cuando la persona indique intentar de nuevo tal como está |
| `declined` | booleano | `true` cuando la persona dijo "ahora no" ante un paso `confirm`, o ante una pregunta sin respuesta `not-now` propia: nada se ejecuta y no se vuelve a preguntar en esta sesión. Cuando `not-now` sea una de las respuestas, pásela en `answers` |

Vuelve a leer el siguiente paso antes de ejecutar cualquier cosa. **Bloqueos:**

- Se rechaza un id diferente: `the project changed since that step was named
  — call project_status again`, with `current`.
- Se rechaza `human_only` (`a person does this step: …`); un paso `human_only`
  que un agente realiza con una herramienta se rechaza indicando la herramienta que se debe usar.
- Se rechaza `wait`; `confirm` sin `confirmed: true` se rechaza (`ask the
  person first, then call again with confirmed: true`).
- `ask_user`: cada respuesta es obligatoria (`missing the answer "<key>" — ask the
  person who holds the data; never answer for them`); a `<…>` como marcador de posición se
  rechaza; se rechaza una respuesta que esté fuera de `enum`.
- Solo se ejecutan los programas propios de los rieles: `champollion`, `nmt-forge` y `uv tool
  install … nmt-forge`. A command using `|`, `;`, `<`, `>`, `` ` ``, `$` o un
  `&` aislado se rechaza; `&&` une las partes, que se ejecutan en orden y se detienen ante el primer
  fallo.
- Cada parte está delimitada a 10 minutos (la instalación de `uv` a 15).
- Se rechaza `declined: true` en un paso que no es ni `confirm` ni `ask_user`: `this step does not wait on the person's yes (<mode>) — there is
  nothing to decline`.
- Se rechaza `declined: true` en un paso cuyas `answers` incluyan `not-now` (actualmente, el
  `try_it` de la propuesta de modelo más potente), y el rechazo incluye el
  `answers` del paso: `"not now" is one of this step's own answers — pass it in
  answers (try_it: "not-now"): it is recorded, and this comes back only after
  more rounds; declined would ask again next session`.

Devuelve `ran` —por parte: `command`, `exit_code`, `timed_out` cuando ocurrió, y
las últimas 40 líneas de `output`— y `next`, el siguiente paso con
la estructura de `project_status`.

#### "Ahora no"

Hay dos formas de registrarlo, y el paso decide cuál:

| El paso | "Ahora no" es | Qué registra | Cuándo vuelve a aparecer |
|---|---|---|---|
| Un paso `ask_user` cuyas `answers` incluyan `not-now` (la oferta de modelo más potente: `try_it`, `yes` o `not-now`) | Una respuesta: `answers: {"try_it": "not-now"}` | El registro de Forge (`model-change`, `answer: "not-now"`); nada más cambia | Después de dos rondas más evaluadas por el conjunto dev como **no-change** o **worse**, a través de las sesiones |
| Un paso `confirm` (entrenamiento, una instalación, poner en uso un modelo) o una pregunta que la persona aún no puede responder | `declined: true` | Solo la memoria de este servidor | Cuando el servidor se reinicia (la siguiente sesión) |

`declined: true` no ejecuta nada y devuelve `declined` (el id del paso), `ran: []`,
`say` (*"No se ejecutó nada. No se vuelve a preguntar en esta sesión; si lo mencionan
y dicen que sí, tómelo en ese momento."*) y `next`. El rechazo se mantiene durante la
vida del servidor: una sesión; un servidor reiniciado lo habrá olvidado. Mientras esté
vigente, ese paso regresa de `project_status` y `run_next_step` con
`declined_this_session` (cuándo, como hora ISO) y su `say` comenzando con *"Dijeron
ahora no (HH:MM UTC) a esto: …"* y terminando con *"No vuelva a preguntar en esta
sesión: nada que requiera su sí se ejecuta. Si lo mencionan por su cuenta
y dicen que sí, tómelo con confirmed: true (o con sus respuestas)."*. Un `confirmed: true`
posterior, o respuestas, toma el paso y borra el rechazo.
**Nota.** No vuelva a preguntar en esta sesión y no eluda el paso; si
la persona lo menciona y dice que sí, tómelo en ese momento.

#### Cuando un paso falla

**Bloqueo.** Un paso que falló dos veces seguidas (salida distinta de cero o tiempo de espera agotado, contabilizado
durante la vida del servidor) se rechaza una tercera vez a menos que `confirmed: true`,
con su `last_output`. **Nota.** Esa bandera le corresponde a usted configurarla: dígale a la persona
lo que indicó el mensaje, y o bien lo soluciona (un comando corregido ejecutado en una terminal está
bien; luego llame a `project_status`), o bien dice que se intente de nuevo tal como está.

### `add_data`

| Argumento | Tipo | Significado |
|---|---|---|
| `project_dir` | cadena, obligatorio | La carpeta del proyecto |
| `path` | cadena, obligatorio | El archivo donde se encuentra: absoluto, o relativo a la carpeta del proyecto o al lugar donde se inició el servidor |
| `into` | `parallel` (por defecto) · `test` · `lexicon` | Pares para aprender; las oraciones de prueba verificadas; una lista de palabras |
| `source_col`, `target_col` | cadena | Una columna como letra (`A`), un número o su encabezado; para ELAN, el número de capa que indica el rechazo (o un id exacto de capa que la persona haya escrito); para LIFT, un código de idioma |
| `sheet` | cadena | Qué hoja o tabla, cuando hay varias |
| `header` | booleano | `true`: la primera fila es un encabezado; `false`: son datos |
| `usfm_source` | cadena | Solo para escrituras en USFM: el texto del otro idioma (un archivo o carpeta `.usfm`) |
| `replace` | booleano | Volver a leer un archivo ya añadido (otro encabezado o columnas); se conservan las respuestas de sus titulares |

Ejecuta `champollion data add`. Llámelo primero solo con la ruta: un encabezado
que nombre los idiomas del par determina las columnas; de lo contrario, pregunta, y usted
le pregunta a la persona; nunca decida a partir del contenido. Lee hojas de cálculo
(`.xlsx`, `.ods`, `.csv`), `.tsv` y `.txt`, tablas en Word `.docx`, diccionarios
Toolbox y LIFT, archivos ELAN `.eaf` y USFM.

Devuelve `result` (el informe de la CLI: recuentos, columnas, capas de ELAN por número y
los números de fila que señala su verificación de filas: copias, repeticiones, longitudes anómalas,
filas intercambiadas o desplazadas, sin eliminar nada; nunca oraciones), `read_from` cuando
el archivo se encontró desde la carpeta de inicio del servidor, y `also` cuando el
archivo contiene más (las oraciones de ejemplo de un diccionario como pares, o sus glosas como
una lista de palabras); cada entrada es una llamada completa a `add_data`. Realícela a menos que las
condiciones de la persona para ese archivo lo excluyan. Transmita la verificación de filas tal como está: la
persona revisa esas filas en su propio archivo
([reglas sobre los datos](/docs/agents/data-rules#what-tools-print-and-never-print)).
Nunca le pida a la persona que mueva un archivo; `inbox/` es solo un lugar donde puede colocar
uno.

### `try_translation`

Argumentos: `project_dir`; `text`: hasta 10 líneas, como máximo 2000 caracteres,
una oración por línea, palabras que la persona le proporcionó.

Encuentra el modelo que sirve este proyecto (el trabajo de `serve` en buen estado más reciente en
`nmt-forge jobs --json`), únicamente en esta computadora, y lee su `/health`.

- **Bloqueo.** Si `output_local_only` no es `false` (verdadero, o desconocido), no
  devuelve ninguna traducción: `shown_to_person_only: true`, `open` (la propia página
  del modelo) y `say`. Envíe a la persona allí; no le pida que le pegue de vuelta sus
  traducciones.
- Un servidor que solicite un token se rechaza: los tokens nunca se entregan a un
  agente.
- De lo contrario, devuelve `model`, `pair`, `translations` (`source`,
  `translation` por línea), `errors` si corresponde, y `say`: transmítalos tal como
  están; el servidor no verifica nada de lo que devuelve.

### `explain`

Argumento: `topic`. Textos en palabras sencillas para transmitir:

| `topic` | Qué abarca |
|---|---|
| `rails` | La carpeta del proyecto y el orden de los pasos |
| `privacy` | Qué significa el sidecar; por qué nunca debe abrir los archivos |
| `quality` | Qué promete y qué no promete un puntaje |
| `modes` | Cómo realizar cada tipo de paso |
| `improve` | Las rondas posteriores a que un modelo esté en uso: aproximadamente una de cada diez filas de revisión *"vuelve de una hoja anterior a propósito (la hoja así lo indica…)"*; se ofrece un modelo mejor para su uso y la gente dice que sí (*"un veredicto por sí solo no cambia nada"*); el veredicto de cantidad insuficiente; la oferta de un modelo más potente después de *"dos rondas consecutivas que el conjunto dev pudo evaluar sin mostrar mejoras (contadas desde el último modelo puesto en uso)"* |
| `off_rails` | Salirse de los rieles: ejecute un comando experto, luego llame a `project_status` |

## Notas para toda la sesión

- **Nota.** Todo lo que usted lee va a parar a su proveedor de modelos. `add_data`,
  `project_status` y `run_next_step` informan recuentos, columnas y estados, nunca
  oraciones; manténgalo así. No abra los archivos usted mismo.
- **Nota.** Las respuestas de `ask_user`, `confirmed: true` y el
  sí de `waiting_for_agreement` le corresponden a la persona. Las herramientas comprueban que una respuesta
  esté presente y bien formada; solo usted puede asegurarse de que sea suya.
- **Nota.** Transmita `blockers`, `warnings` y cada advertencia palabra por palabra, y
  cada número con su unidad y el conjunto en el que se midió
  ([orientación](/docs/agents/coaching)).

## Para profundizar

- [El contrato operativo](/docs/agents/contract) — bloqueos y notas.
- [El modelo de rieles](/docs/agents/rails-model) — el trayecto, los modos y los
  id de paso que leen estas herramientas.
- [Conducir los rieles desde el shell](/docs/agents/shell) — los mismos pasos en forma de
  comandos.
- [El servidor MCP](/docs/network/getting-started/mcp-server) — ambos perfiles
  y el catálogo completo de herramientas.
