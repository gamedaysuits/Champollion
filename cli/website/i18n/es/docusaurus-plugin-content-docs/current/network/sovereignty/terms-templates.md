---
sidebar_position: 10
title: "Plantillas de Términos"
slug: /network/sovereignty/terms-templates
description: "Ideas de términos adaptables y orientadas hacia la confianza cero para una comunidad que ejecuta un concurso soberano — propiedad, licencias solo de puntuaciones, integridad fijada por hash, valores predeterminados de fallo cerrado, y un recorrido honesto de los riesgos de caballo de Troya."
related:
  - label: "Run a Sovereign Contest"
    to: /docs/network/sovereignty/run-a-sovereign-contest
    kind: doc
    note: "The runbook these terms attach to"
  - label: "Ownership & Terms"
    to: /docs/network/sovereignty/ownership-transfer
    kind: doc
  - label: "Data Stewardship"
    to: /docs/network/sovereignty/data-sovereignty
    kind: doc
  - label: "Prize Specification"
    to: /docs/network/specifications/prizes
    kind: spec
---

# Plantillas de Términos

> **Resumen Ejecutivo.** Términos de partida que una comunidad u organización
> puede adaptar al ejecutar un [concurso soberano](/docs/network/sovereignty/run-a-sovereign-contest).
> El sesgo de diseño en todo es **inclinado hacia la desconfianza**: siempre que
> sea posible, un término está respaldado por un mecanismo (un hash, una
> compuerta, un registro de solo adición) en lugar de una promesa. Cada término
> es un párrafo breve más una explicación en lenguaje simple.

:::warning[Esto no es asesoramiento legal]
Estas son *ideas* de redacción de un proyecto de investigación sin fines de lucro, no asesoramiento legal, y no somos abogados. Las leyes varían según la jurisdicción, y los marcos indígenas de gobernanza de datos imponen obligaciones que ninguna plantilla puede cumplir. Haga que su propio asesor legal —y su propio proceso de gobernanza comunitaria— revise cualquier cosa antes de que dependa de ella.
:::

---

## Términos fundamentales

### 1. El corpus es y permanece como propiedad del propietario

*Término.* El corpus de evaluación, todas las entradas en él, y todos los
metadatos derivados permanecen como propiedad exclusiva de la comunidad u
organización registrante. Ningún uso del registro de la Red, maquinaria de
concurso, o evaluación transfiere derecho, título, o interés alguno en el
corpus a la plataforma, a desarrolladores de métodos, o a patrocinador alguno.
La plataforma no retiene copia alguna y no reclama licencia más allá del
resumen del blob cifrado.

*Lenguaje simple:* ejecutar un concurso contra su corpus no le da a nadie una
parte de él. Champollion retiene un hash, no una reclamación.

### 2. La evaluación otorga una licencia de solo puntuaciones — nada más

*Término.* Una ejecución de evaluación autorizada otorga a la plataforma y al
desarrollador del método una licencia para recibir y publicar **solo puntuaciones
numéricas y estadísticas agregadas**. No otorga **derecho alguno** a retener
contenido del corpus después de la ejecución, **derecho alguno** a entrenar,
ajustar, o entrenar cualquier modelo con él, y **derecho alguno** a construir
corpus derivados, ejemplos memorizados, o tablas de búsqueda a partir de él.
Cualquier retención de contenido más allá de la ejecución termina la licencia
e invalida los resultados de la ejecución.

*Lenguaje simple:* lo que sale de una ejecución sellada es un número. Las
oraciones nunca lo hacen — no en una tabla de clasificación, no en un conjunto
de entrenamiento, no en la caché de nadie.

### 3. Integridad fijada por hash: el resumen se publica, el contenido nunca

*Término.* El corpus se identifica exclusivamente por el resumen SHA-256
publicado de su blob cifrado y una etiqueta de versión. Solo los blobs que
coinciden con el resumen cuentan como el corpus; cualquier ejecución contra
bytes que no coincidan es nula. La publicación del resumen no es publicación
del contenido, y nada en estos términos obliga al propietario a divulgar el
contenido a nadie jamás.

*Lenguaje simple:* todos pueden verificar *cuál* corpus se utilizó; nadie
consigue *leerlo*. Si los bytes no coinciden con el hash, la ejecución no cuenta.

### 4. Valores predeterminados de cierre por fallo

*Término.* Toda ambigüedad se resuelve hacia ningún acceso y ninguna
publicación. Una solicitud que no está afirmativamente autorizada por el
umbral de custodio se deniega; una concesión que ha expirado o sido utilizada
está muerta; un resultado cuya procedencia no puede verificarse no se publica;
un corpus cuyo registro caduca deja de ser ejecutable. El silencio nunca
constituye consentimiento.

*Lenguaje simple:* en caso de duda, la respuesta es no. Nada se abre por
defecto.

### 5. La autorización del custodio controla cada ejecución

*Término.* Ninguna evaluación puede ejecutarse contra el corpus sellado sin una
autorización registrada aprobada por umbral y una concesión de un solo uso,
limitada en tiempo, vinculada al método específico, versión del corpus, y
entorno de evaluación. Todos los eventos de autorización, incluidas denegaciones
e intentos bloqueados, se registran en un registro de auditoría de solo adición,
públicamente reproducible.

*Lenguaje simple:* sus custodios aprueban cada ejecución individual, una
ejecución a la vez, y todo el historial es público y a prueba de manipulación.
(La herramienta de firma de umbral criptográfico aún está en desarrollo — vea
la [caja de estado en el manual](/docs/network/sovereignty/run-a-sovereign-contest) —
así que hoy este término se aplica como proceso registrado, no aún como matemática.)

### 6. Los fondos de premios se mantienen por el patrocinador y la regla de adjudicación es pública

*Término.* Los fondos de premios se mantienen por la organización patrocinadora
nombrada o un fideicomiso comunitario designado — nunca por la plataforma. El
umbral de adjudicación se publica antes de que se abra el concurso, es
verificable a partir de puntuaciones publicadas más el veredicto de validación
de hablantes de la comunidad, y la decisión de adjudicación pertenece
exclusivamente al titular de los fondos.

*Lenguaje simple:* el dinero se queda con quien lo aportó, la barra es pública,
y si la barra fue superada es verificable por cualquiera. Champollion no puede
pagar, retener, o redirigir un premio porque Champollion nunca tiene el dinero.

---

## Riesgos de caballo de Troya {#trojan-horse-risks}

Un documento de términos honesto nombra las formas en que el arreglo puede ser
atacado. Incluya estos en el suyo — un patrocinador o comunidad que los ha
leído es más difícil de engañar.

### Envíos de métodos maliciosos que intentan exfiltrar los datos de prueba

Un "método" es código enviado. Uno hostil puede intentar contrabandear oraciones
de prueba — codificándolas en sus salidas, escribiéndolas en registros, o
llamando a casa. **Mitigaciones:** emisión de solo puntuaciones (el texto de
salida por entrada de ejecuciones selladas nunca se publica — aplicado en la
capa de datos hoy); una **sandbox sin salida** para ejecución sellada (🔲 en
desarrollo — hasta que se lance, trate esta mitigación como parcial y pese sus
aprobaciones de custodios en consecuencia); y **presupuestos de consulta/ejecución
por método por ronda** — un método obtiene un número pequeño y fijo de ejecuciones
selladas, por lo que el corpus no puede reconstruirse por sondeo repetido incluso
a través del canal de puntuaciones.

### Corpus enviados envenenados o contaminados

El ataque también puede correr en la otra dirección: alguien ofrece a una
comunidad un corpus de prueba "listo para usar" que es sutilmente incorrecto,
ofensivo, o ya público (por lo que los métodos lo han memorizado y las
puntuaciones carecen de sentido). **Mitigaciones:** requisitos de procedencia
en cada entrada (quién la escribió, cuándo, de qué fuente); [validación de
hablantes](/docs/network/specifications/speaker-validation) del corpus mismo
antes de sellarlo; y detección de contaminación contra datos públicos antes de
que un corpus sea aceptado como calificador o estándar de oro.

### Troyanos de licencia en dependencias

Un método ganador que silenciosamente agrupa contenido o código cuya licencia
prohíbe el uso previsto de la comunidad (despliegue comercial, redistribución)
envenena la transferencia — gana una herramienta que no puede usar legalmente.
**Mitigaciones:** declaraciones de clase de dependencia y una compuerta de
licencia mecánica en envíos (vea la [Especificación de Premios](/docs/network/specifications/prizes)
tabla de clase de dependencia); las dependencias no declaradas son descalificantes.

### Phishing de credenciales

Cualquiera que ejecute un concurso se convierte en un objetivo para ataques
"pegue su token aquí para verificar su registro". **Mitigaciones:** nunca pegue
tokens, claves, o credenciales en páginas de terceros o compártalas en chat;
toda autenticación en este proyecto ocurre a través del flujo OAuth de la CLI,
y **no existen más flujos de token de acceso personal en navegador** — cualquier
página que solicite uno es hostil. Las decisiones de custodio deben ocurrir
sobre canales en los que su comunidad ya confía.

### Incumplimiento de premio del lado del patrocinador

El modo de fallo silencioso: los métodos superan la barra y el patrocinador no
paga. **Mitigaciones:** publique la identidad del titular de fondos y el arreglo
de tenencia (cuenta de org, fideicomiso, agente de depósito en garantía) *antes*
de que se abra el concurso; haga que las condiciones de adjudicación sean
verificables a partir de puntuaciones publicadas para que un incumplimiento sea
públicamente visible como un incumplimiento, no negable como una llamada de
juicio; y prefiera un titular con algo que perder reputacionalmente. Champollion
no puede asumir este riesgo — por diseño nunca retiene los fondos — por lo que
la credibilidad de un premio es exactamente la credibilidad de su titular nombrado.

---

## Usando estos

Copie lo que se ajuste, elimine lo que no, agregue lo que su gobernanza requiera,
y publique el resultado junto a su concurso para que los participantes acepten
*sus* términos, no una vibra. Términos por comunidad — incluida la transferencia
de propiedad del método para premios patrocinados — son la norma aquí, no la
excepción: vea [Propiedad y Términos](/docs/network/sovereignty/ownership-transfer).

