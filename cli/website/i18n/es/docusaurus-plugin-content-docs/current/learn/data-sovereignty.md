---
title: "Lo que significa la soberanía de datos cuando se integra en el software"
sidebar_label: "Soberanía de datos"
description: "La soberanía de datos indígenas es un conjunto de principios sobre quién tiene la propiedad, el control, el acceso y la posesión de los datos. Así es como se ven esos principios cuando alguien intenta integrarlos en un software funcional — y lo que ese intento no puede pretender."
---

# Qué significa la soberanía de datos cuando se escribe en software

:::info[Para quién es esto]
Para cualquier persona. No se asume ningún conocimiento previo en derecho, aprendizaje automático o gobernanza indígena.
Si alguna vez se ha preguntado qué se necesitaría realmente para que una comunidad
mantenga el control de los datos de su propio idioma una vez que las computadoras se involucran, esta página
es la respuesta larga.
:::

La mayor parte de la discusión sobre datos y consentimiento se detiene en el permiso: si alguien dijo que sí.
La soberanía de datos plantea un conjunto de preguntas más difíciles. ¿A quién le **pertenece** esto? ¿Quién decide
qué sucede con ello? ¿Quién puede acceder a ello? ¿Dónde reside físicamente?

Esas preguntas no surgieron de la nada. Fueron articuladas primero, y con mayor
fuerza, por los pueblos indígenas.

---

## 1. Las preguntas — y quiénes las plantearon primero

Las Primeras Naciones en Canadá articularon principios de soberanía de datos de
**propiedad, control, acceso y posesión** como una afirmación de jurisdicción
sobre su propia información — que surge de una historia documentada de
investigaciones realizadas *sobre* las comunidades en lugar de *con* ellas, y
de que los datos resultantes nunca regresaban.

Ese origen no es un dato trivial. Estos principios no son una lista de verificación ética de propósito
general que cualquiera pueda adoptar; son afirmaciones de jurisdicción, hechas por pueblos
específicos en contextos legales y culturales específicos, y pertenecen a las
comunidades que las hicieron.

Las cuatro preguntas, brevemente:

| | La pregunta que responde |
|---|---|
| **Ownership** (Propiedad) | ¿A quién le pertenece esta información? Una comunidad es dueña de su conocimiento cultural y sus datos de manera colectiva, de la misma forma en que una persona es dueña de su propia información personal. |
| **Control** (Control) | ¿Quién decide qué sucede con ella? Las comunidades controlan cada etapa de cualquier cosa que les afecte: qué se recopila, cómo, por quién, para qué y qué se hace con ello después. |
| **Access** (Acceso) | ¿Quién puede acceder a ella? Las comunidades deben poder acceder a la información sobre sí mismas, dondequiera que se guarde y quienquiera que la tenga. |
| **Possession** (Posesión) | ¿Dónde reside físicamente? No es lo mismo que la propiedad: la posesión es el hecho concreto de la custodia, y es el mecanismo que hace que los otros tres sean exigibles en lugar de solo promesas. |

Existen marcos de trabajo distintos y no son intercambiables entre
sí: **CARE** (Beneficio Colectivo, Autoridad para Controlar, Responsabilidad,
Ética, por sus siglas en inglés) para la gobernanza de datos indígenas en general, y **Te Mana Raraunga** para
la soberanía de datos maorí. Cada uno surgió en su propio entorno legal y cultural. Usar
el nombre de un marco para los principios de otro es su propio tipo de borrado cultural.

---

## 2. Por qué el software hace que esto sea crítico

Un principio puede sobrevivir en el papel como una buena intención. El software obliga a plantear la
pregunta, porque una computadora no actúa basándose en intenciones: actúa sobre lo que se
construyó.

Considere la forma habitual en que se evalúa un sistema de traducción. Para saber
si un sistema traduce bien su idioma, alguien necesita un **conjunto de pruebas**:
oraciones en su idioma, emparejadas con su significado. Casi todas las plataformas de evaluación
le piden que **suba** ese conjunto de pruebas para poder evaluarlo.

Lea eso de nuevo con las cuatro preguntas en mente. Subir archivos transfiere la
posesión. Por lo general, transfiere el control práctico: una vez que existe una copia en
la máquina de otra persona, su capacidad para decir "basta" es una solicitud, no una
capacidad. El acceso se convierte en algo que se le otorga en lugar de algo que usted
tiene. La propiedad sobrevive en el papel y deja de significar mucho.

Para una comunidad cuyos datos lingüísticos fueron extraídos anteriormente, "súbalo y confíe en
nosotros" no es una petición neutral. Tiene la misma forma que lo que ya
sucedió.

---

## 3. Cuáles son realmente los mecanismos

La postura de este proyecto es que, si la soberanía es real, tiene que ser una propiedad
del software, no un párrafo en una política. Así es como se ve esto
concretamente. Se describen para que usted pueda evaluarlos y debatirlos.

**Registro sin renuncia.** Un conjunto de pruebas se registra describiendo
*dónde reside* y fijando un hash criptográfico de su contenido exacto, no
subiendo las oraciones. En el momento de la evaluación, el sistema obtiene los datos de la fuente,
verifica que el hash coincida y califica. No se almacena nada. Si el titular desconecta la
fuente, el corpus simplemente deja de ser evaluable. El control permanece donde
comenzó, porque la posesión nunca se movió.

**Cifrado antes de la salida, para el nivel más estricto.** Cuando un corpus debe ser
utilizable sin ser nunca legible, se cifra **en el propio dispositivo del
titular** antes de que salga cualquier cosa. Lo que recibe este proyecto es texto cifrado y una
descripción que no contiene contenido.

**Ninguna parte individual puede descifrar.** La clave se divide entre un grupo de custodios para
que un cierto número de ellos (digamos tres de cinco) deba actuar en conjunto para autorizar
cualquier cosa. Ningún custodio individual puede actuar solo, y tampoco puede hacerlo este proyecto:
el modelo decidido es que **Champollion tiene cero partes**, por lo que no puede
descifrar con o sin la cooperación de nadie. Una ejecución ocurre porque un cuórum de
custodios decidió que así fuera.

> **Cuál es la situación actual.** El mecanismo está construido y se puede probar. Los
> *custodios no están confirmados*: la composición pertenece a las comunidades
> involucradas, y ningún grupo ha dado su consentimiento para tener partes todavía. Hasta que lo hagan,
> no hay un conjunto de custodios activo, y este proyecto no nombrará candidatos
> públicamente. Por lo tanto, lea el párrafo anterior como un mecanismo funcional que espera las
> relaciones que lo harían operar, no como algo que se esté ejecutando hoy.

**Resultados sin exposición.** Lo que regresa de una evaluación sellada son
puntuaciones, no oraciones. Se puede demostrar que un método funciona en un corpus que el
autor del método, y este proyecto, nunca leyeron.

**Consentimiento antes de la transmisión.** Enviar texto a la API de un modelo externo es en sí mismo
una divulgación. Los corpus bajo licencias comunitarias, personalizadas o no declaradas **rechazan**
la evaluación remota hasta que el titular de los derechos haya registrado explícitamente el permiso para
ello. Ese rechazo se aplica en el código, y ningún proceso automatizado puede otorgar el
permiso en nombre de una comunidad.

**Reversibilidad en una sola dirección.** La exposición puede flexibilizarse por una
decisión deliberada del titular. Nunca se flexibiliza por defecto, por accidente o
por conveniencia de otra persona.

---

## 4. Lo que esto no es

**Este proyecto no está validado, certificado ni aprobado conforme a ningún marco
indígena de soberanía de datos. No se ha llevado a cabo
ninguna evaluación, no hay ninguna pendiente y no se insinúa ninguna.**

Lo que existe es un **intento de promulgar la soberanía de datos en código**: tomar principios
articulados por los pueblos indígenas y expresarlos como mecanismos funcionales en lugar de
compromisos. Ese intento es nuestro. Si tiene éxito o no, no nos corresponde a nosotros declararlo.
Las determinaciones de cumplimiento pertenecen a las comunidades involucradas, y un proyecto que afirme su
propio cumplimiento estaría reproduciendo en miniatura la postura exacta que estos principios existen
para corregir: el forastero decidiendo qué cuenta como un tratamiento adecuado de la
información de una comunidad.

Tampoco nada de esto es una garantía de imposibilidad. El software tiene defectos. Los operadores
cometen errores. Una parte decidida que ocupe suficientes roles correctos es un
riesgo residual que ninguna arquitectura elimina. La afirmación es más limitada y, creemos,
más útil: **los caminos fáciles están cerrados y los difíciles dejan evidencia.**

También hay brechas entre los principios y los mecanismos, y preferimos
nombrarlas antes que dejar que usted las encuentre. La posesión es el principio al que mejor
sirven estos mecanismos: el código es genuinamente bueno para no retener cosas.
La Propiedad y el Control llegan más lejos de lo que el software puede ir por sí solo, hacia términos,
gobernanza y relaciones que ninguna cantidad de criptografía resuelve. Y cada
mecanismo anterior asume una comunidad que ya tiene la capacidad y la
infraestructura para mantener sus propios datos, lo cual no es una suposición neutral.

---

## 5. Por favor, debata esto

El intento está abierto a la crítica, y la invitación no es un adorno.

Si usted trabaja en gobernanza de datos indígenas, CARE, Te Mana Raraunga o
tecnología de lenguas indígenas, o si es miembro o representante de una
comunidad cuyo idioma está en este índice, queremos escuchar en qué nos equivocamos.
Específicamente:

- dónde un mecanismo no hace lo que requiere el principio;
- dónde el enfoque tergiversa los principios de una comunidad o se apropia de su autoridad;
- dónde se describe algo como protector que no lo protegería a usted;
- dónde una comunidad necesitaría algo que no hemos construido;
- dónde el vocabulario en sí es inadecuado.

Las objeciones y correcciones se pueden plantear a través de la
[ruta de contacto y eliminación](/docs/network/community/contact-objections-takedown),
que también cubre la solicitud de eliminación de cualquier cosa sobre un idioma que usted
represente. No hay ningún requisito de ser diplomático al respecto.

El hecho de no haber sido revisado es una realidad de este trabajo, no una defensa del mismo. Un intento que
invita a la revisión es honesto; uno que no lo hace es una afirmación.

> Esta página es una descripción de un intento de construir hacia principios cuyos autores son las propias comunidades — busque esos principios tal como los enuncian sus autores; este intento no está respaldado por ninguna de las organizaciones que los custodian.

---

## A dónde ir a continuación

- [Administración de datos](/docs/network/sovereignty/data-sovereignty): la postura operativa, con mayor profundidad.
- [Registro de corpus](/docs/network/sovereignty/registering-corpora): los cuatro niveles de exposición y lo que sale de su máquina en cada uno.
- [Ejecutar un concurso soberano](/docs/network/sovereignty/run-a-sovereign-contest): la ceremonia de custodios, de principio a fin.
- [Limitaciones honestas](/docs/network/honest-limitations): lo que este proyecto no afirma.
- [Para comunidades lingüísticas](/docs/network/community/for-language-communities): el punto de partida práctico.
