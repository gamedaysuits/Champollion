---
title: "Tabla de clasificación y publicación"
slug: /reference/leaderboard
description: "Qué es la tabla de clasificación pública, los dos tipos de pruebas de referencia (públicas y selladas), qué cubre y qué no, y exactamente qué incluye una ejecución publicada."
---

# Tabla de clasificación y publicación

La [tabla de clasificación](/leaderboard) es un registro público de ejecuciones de traducción evaluadas.
Cualquiera puede hacer aportes: usted ejecuta el arnés de evaluación (`mt-eval`) en su propia
máquina, con un conjunto de datos registrado, y publica el resultado como una **tarjeta de
ejecución**. La tabla conserva la tarjeta; no ejecuta su método por usted. Solo
almacena texto oración por oración en conjuntos de datos redistribuibles con licencia abierta;
nunca en aquellos no comerciales, restringidos, sellados, en cuarentena o de uso exclusivamente local,
y nunca cuando usted publica con `--scores-only`.

Es un libro de registro de mediciones, no un veredicto sobre ningún traductor. Una posición en
él indica la puntuación que obtuvo un método en un conjunto de datos según una métrica. No indica
que la traducción sea buena, ni le concede permiso a nadie para usar un método en el idioma de una
comunidad.

## Tres cosas que se mantienen separadas

| | Qué es | Dónde se ejecuta |
|---|---|---|
| **El arnés** ([`mt-eval`](/docs/network/specifications/harness)) | El evaluador. Dado un método y un conjunto de prueba, produce una puntuación y una tarjeta de ejecución | Su máquina |
| **La tabla de clasificación** | La puerta de envío y el registro de tarjetas de ejecución, indexado por conjunto de datos y dirección del par | champollion.dev |
| **El mapa de la red** | A qué equivalen las ejecuciones publicadas: qué pares se han medido y cuáles no | Una vista del registro, no un componente |

Nada entra al mapa excepto a través de la tabla, y nada entra a la tabla
excepto como una ejecución evaluada y con huella digital. Una medición sin procedencia no puede
formar parte de ella.

## Dos tipos de evaluaciones comparativas

**Las evaluaciones comparativas públicas** usan conjuntos de datos abiertos. Cada conjunto de datos está registrado como una
tarjeta de metadatos con un puntero para obtenerlo desde la fuente: el arnés descarga las
referencias desde la fuente original en el momento de la ejecución, las verifica contra un SHA-256 fijado
y calcula la puntuación con base en lo que descargó. Los datos públicos ya podrían estar en los datos
de entrenamiento de un modelo, por lo que los conjuntos de datos llevan una calificación de contaminación. Un conjunto calificado como `HIGH`
o `MEDIUM` (FLORES+ es `HIGH`), o que no tiene calificación alguna, es **solo relativo**:
se puede usar para comparar métodos ejecutados en él, pero nunca se informa como calidad absoluta.
Solo un conjunto calificado como `LOW` clasifica según la calidad absoluta. Un conjunto de datos en cuarentena
nunca clasifica: la base de datos rechaza una puntuación publicada para él.
Los conjuntos de datos registrados y sus carriles de licencia se enumeran en
[Conjuntos de datos de evaluación](/docs/network/leaderboard/datasets).

**Las evaluaciones comparativas selladas** son conjuntos de prueba reservados que el anfitrión conserva en su propia
máquina. Los participantes nunca los ven. Una postulación es un modelo o un método que el
propio nodo de puntuación del anfitrión ejecuta contra el conjunto sellado; solo salen puntuaciones, y
cada ejecución sellada necesita la autorización del anfitrión. Las claves de los conjuntos están hoy en manos
de los organizadores. Custodios comunitarios de claves: aún no se ha designado a ninguno;
Champollion no posee fragmentos de claves. Los premios existen únicamente en competencias selladas, bajo
los términos que el anfitrión declare antes de que alguien participe. Cómo organizar una:
[Organice una competencia soberana](/docs/network/sovereignty/run-a-sovereign-contest).

## Alcance

- **Texto escrito.** La tabla mide la traducción de texto escrito: documentos,
  material educativo y oficial, cadenas de interfaz de usuario. No mide voz,
  interpretación en tiempo real ni conversaciones abiertas.
- **Idiomas basados en texto.** La traducción automática de lenguas de señas es un problema
  distinto; las entradas de lengua de señas en el índice indican "aún no atendido"
  ([Qué cuenta como idioma](/docs/network/context/what-counts-as-a-language)).
- **Un conjunto de datos a la vez.** Una puntuación solo es comparable con puntuaciones de la
  misma versión del conjunto de datos. Las clasificaciones nunca cruzan conjuntos de datos ni idiomas.
- **Métodos, no oraciones.** Una puntuación describe un método en una evaluación comparativa. No
  se publica ningún nivel de confianza por oración para ninguna traducción
  ([Límites técnicos](/docs/network/honest-limitations#system-vs-output)).

## Qué contiene una ejecución publicada

Cada tarjeta nueva se evalúa según el **estándar de puntuación/1**
([Especificación de puntuación](/docs/network/specifications/scoring)):

- **El resultado principal:** chrF++ a nivel de corpus (0–100) con su intervalo de
  confianza bootstrap del 95 % y su firma de sacreBLEU, para que cualquiera pueda volver a calcularlo.
- **A su lado:** BLEU, spBLEU y TER, y COMET cuando se calculó. Se
  muestran, pero nunca se combinan con el resultado principal.
- **Por separado:** diagnósticos como la aceptación por FST y la coincidencia exacta, donde
  existan sus herramientas. Nunca entran en el resultado principal ni clasifican una ejecución.
- **Campos retirados:** `composite`, `quality_tier` y `cost_adjusted` son
  `null` en cada tarjeta nueva. Una tarjeta antigua conserva su puntuación compuesta almacenada, mostrada como
  "compuesta heredada (retirada)". Ninguna puntuación automática lleva una etiqueta de calidad.
- **Procedencia:** el id del conjunto de datos y su SHA-256, el slug exacto del modelo, la
  condición, lo que se le indicó al modelo (el SHA-256 del prompt y su texto,
  a menos que usted lo oculte), el costo, la versión del arnés y una huella digital de
  la configuración. Las ejecuciones idénticas se deduplican al publicarse, y una reproducción
  independiente cuenta como evidencia.
- **Nivel de confianza:** cada fila llega como *autoevaluada*. *Verificado por Champollion*
  significa que la puntuación se volvió a calcular a partir de las salidas que usted envió contra las
  referencias fijadas; ese reevaluador es un comando de los mantenedores que se ejecuta manualmente, por lo que
  hoy en día ninguna fila se promueve al llegar. *Validado por la comunidad* solo se confiere
  mediante la revisión propia de una comunidad ([niveles de verificación](/docs/network/leaderboard/rules#verification-tiers)).

El esquema completo se encuentra en la [Especificación de la tarjeta de ejecución](/docs/network/specifications/run-card).

## Publicación

```bash
# See exactly what would be uploaded (no sign-in, no network)
mt-eval publish eval/logs/harness/<run-id>_report.json --dry-run

# Publish to the live board (a browser sign-in the first time)
mt-eval publish eval/logs/harness/<run-id>_report.json --prod
```

- Se requiere `--prod` (o `MT_EVAL_ALLOW_PROD=1`) para escribir en la tabla
  en vivo; sin esto, el arnés lo rechaza.
- `--anonymous` publica sin iniciar sesión; la tabla muestra "anónimo".
- `--scores-only` publica puntuaciones agregadas y el hash y tamaño del conjunto de datos,
  nunca el texto de origen o de referencia; para su propio corpus o uno privado.
- `--redact-coaching` reemplaza el texto del prompt con un marcador y conserva su
  hash. El prompt guiado de un corpus de uso exclusivamente local se oculta de forma predeterminada.

La guía paso a paso es [Enviar un método](/docs/network/getting-started/submit-a-method).

## Las reglas que se aplican en todas partes

- **Nunca entrene con datos de evaluación.** Un método expuesto a un conjunto de evaluación comparativa —como
  datos de entrenamiento, ejemplos few-shot, entradas de diccionario o material para prompts— queda
  descalificado ([Reglas de envío](/docs/network/leaderboard/rules)).
- **Lo que es mejor se decide mediante una prueba, no mediante dos números.** Si una ejecución supera
  a otra se determina mediante una prueba de significancia pareada sobre chrF++; los vecinos que la prueba no logra
  separar comparten una posición ([Significancia](/docs/network/specifications/significance)).
- **Los corpus no se alojan aquí.** El registro consiste en metadatos; los corpus se
  obtienen de su fuente. Una ejecución publicada de un conjunto con licencia abierta puede
  incluir su texto oración por oración (como se indicó anteriormente).
- **Los carriles de licencia son estructurales.** Los corpus no comerciales quedan fuera de
  todo premio, API y vía comercial. Un corpus bajo una licencia modificada, personalizada o
  no declarada (`LicenseRef-*`) rechaza la evaluación mediante API de modelos remotos hasta
  que el consentimiento del titular de los derechos quede registrado en su tarjeta; las licencias
  no comerciales estándar se envían a modelos remotos únicamente a través de canales sin entrenamiento; los segmentos sellados
  nunca se envían de forma remota. Los conjuntos en cri de las llanuras de EdTeKLA están catalogados como
  etiquetas en cuarentena, y la base de datos rechaza cualquier puntuación publicada para ellos.

## Qué está funcionando hoy

- La tabla está activa, es pública y está abierta a envíos. Su contenido consiste en
  datos en tiempo real, por lo que esta página no los describe; [consulte la tabla](/leaderboard).
- Hoy en día, cada fila es autoevaluada (consulte los niveles de confianza más arriba).
- No hay ningún premio abierto y ninguna puntuación ha superado el umbral para un premio
  ([Especificación de premios](/docs/network/specifications/prizes)).
- No se ha llevado a cabo ninguna revisión por parte de hablantes de la comunidad
  ([Validación por hablantes](/docs/network/specifications/speaker-validation)).
- Ningún método ha pasado a una comunidad bajo los términos de una competencia.

[Límites técnicos](/docs/network/honest-limitations) contiene la lista completa de lo que
no se afirma; si esta página y esa difieren, prevalece aquella.

## Véase también

- [Reglas de envío](/docs/network/leaderboard/rules) — qué se acepta,
  descalificación, verificación y reputación.
- [Conjuntos de datos de evaluación](/docs/network/leaderboard/datasets) — el registro y
  sus carriles de licencia.
- [Enviar un método](/docs/network/getting-started/submit-a-method) y las
  [Preguntas frecuentes](/docs/network/getting-started/faq).
- [Puntuación](/docs/network/specifications/scoring),
  [Significancia](/docs/network/specifications/significance) y la
  [Tarjeta de ejecución](/docs/network/specifications/run-card).
- [Aportar capacidad de cómputo](/docs/network/getting-started/contributing-compute) —
  ejecute elementos de la cola pública con su propia clave.
