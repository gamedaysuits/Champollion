---
title: "Lo que significa la soberanía de datos cuando se integra en el software"
sidebar_label: "Soberanía de datos"
description: "La soberanía de los datos indígenas trata sobre la propiedad y el control comunitario de los datos. Así es como se ven esos principios cuando alguien intenta integrarlos en software funcional — y lo que ese intento no puede atribuirse."
---

# Qué significa la soberanía de datos cuando se escribe en software

:::info[Para quién es esto]
Para cualquier persona. No se asume ningún conocimiento previo en derecho, aprendizaje automático o gobernanza indígena.
Si alguna vez se ha preguntado qué se necesitaría realmente para que una comunidad
mantenga el control de los datos de su propio idioma una vez que las computadoras se involucran, esta página
es la respuesta larga.
:::

La mayor parte de las conversaciones sobre datos y consentimiento se detienen en el permiso: si alguien dijo que sí.
La soberanía de los datos plantea una pregunta más difícil: ¿a quién le **pertenece** esto y quién **decide**
qué ocurre con ello —no una sola vez, sino durante todo el tiempo que exista?

Esa pregunta no surgió de la nada. Fueron los pueblos indígenas quienes la articularon primero y
con mayor fuerza.

---

## 1. Las preguntas, y quién las planteó primero

Las Primeras Naciones de Canadá articularon los principios de soberanía de los datos —la propiedad
y el control comunitario de su propia información— como una afirmación de
jurisdicción, nacida de una historia documentada de investigaciones realizadas *sobre*
las comunidades en lugar de *con* ellas, y de datos resultantes que nunca
regresaron.

Ese origen no es un detalle menor. No se trata de una lista de verificación ética de uso general
que cualquiera pueda tomar; son afirmaciones de jurisdicción, hechas por
pueblos específicos en entornos legales y culturales específicos, y pertenecen a las
comunidades que las crearon. Esta página no reformula los principios de ningún
marco en nombre de sus autores: léalos tal como sus autores los expresan.

En términos sencillos, una comunidad es dueña colectiva de su conocimiento cultural y de sus datos,
del mismo modo en que una persona es dueña de su propia información personal, y decide cada etapa
de cualquier cosa que los involucre: qué se recopila, cómo, quién lo hace, para qué y qué se
hace con ello después.

Existen distintos marcos y no son intercambiables entre sí:
**CARE** (Beneficio Colectivo, Autoridad para Controlar, Responsabilidad, Ética)
para la gobernanza de datos indígenas en términos generales, y **Te Mana Raraunga** para la
soberanía de datos maorí, entre otros. Cada uno surgió en su propio contexto
legal y cultural. Usar el nombre de un marco para los principios de otro es en sí mismo
una forma de borrado.

---

## 2. Por qué el software hace que esto sea crítico

Un principio puede sobrevivir en el papel como una buena intención. El software obliga a plantear la
pregunta, porque una computadora no actúa basándose en intenciones: actúa sobre lo que se
construyó.

Considere la forma habitual en que se evalúa un sistema de traducción. Para saber
si un sistema traduce bien su idioma, alguien necesita un **conjunto de pruebas**:
oraciones en su idioma, emparejadas con su significado. Casi todas las plataformas de evaluación
le piden que **suba** ese conjunto de pruebas para poder evaluarlo.

Lea eso nuevamente teniendo en cuenta la propiedad y el control. Subir información entrega
la custodia: ahora existe una copia en la computadora de alguien más. Por lo general, también entrega
el control práctico: su capacidad de decir "basta" se convierte en una petición, no en una
facultad. La propiedad sobrevive en el papel y deja de significar mucho.

Para una comunidad cuyos datos lingüísticos fueron extraídos anteriormente, "súbalo y confíe en
nosotros" no es una petición neutral. Tiene la misma forma que lo que ya
sucedió.

---

## 3. Cuáles son realmente los mecanismos

La postura de este proyecto es que, si la soberanía es real, tiene que ser una propiedad
del software, no un párrafo en una política. Así es como se ve esto
concretamente. Se describen para que usted pueda evaluarlos y debatirlos.

**Registro sin entrega.** Un conjunto de prueba se registra describiendo
*dónde reside* y fijando un hash criptográfico de su contenido exacto, no
subiendo las oraciones. Al momento de la evaluación, el sistema obtiene los datos de la fuente,
verifica que el hash coincida y calcula la puntuación. No se almacena nada. Si quien lo custodia desconecta
la fuente, el corpus simplemente deja de poder evaluarse. El control permanece donde
comenzó, porque los datos nunca se movieron.

**Cifrado antes del envío, para el nivel más estricto.** En los casos en que un corpus deba ser
utilizable sin ser nunca legible, se cifra **en el propio dispositivo
del titular**, y el texto cifrado permanece en manos del titular. Lo que este proyecto recibe
es una descripción que no contiene ningún contenido.

**Ninguna parte individual puede descifrar.** La clave está diseñada para dividirse entre un grupo
de custodios, de modo que un número determinado de ellos —por ejemplo, tres de cinco— deba actuar
en conjunto para autorizar cualquier cosa. Ningún custodio individual puede actuar por su cuenta, y
tampoco puede hacerlo este proyecto: **Champollion no posee partes de la clave**, por lo que no podría
descifrar con o sin la cooperación de nadie. Una ejecución ocurriría porque un
quórum de custodios decidió que así fuera.

> **El estado real de esto.** Hoy en día, las claves de un conjunto sellado están en manos del organizador:
> quien lo selló las conserva. El mecanismo de custodios está construido y es verificable,
> pero aún no se ha ejecutado con custodios reales. Custodios comunitarios de claves:
> aún no se ha designado a ninguno; su composición corresponde a las comunidades involucradas, y ningún
> grupo ha dado su consentimiento para conservar partes de la clave. Hasta que alguno lo haga, no existe un conjunto activo
> de custodios, y este proyecto no nombrará candidatos públicamente. Así que lea el
> párrafo anterior como un mecanismo funcional que aguarda las relaciones que
> lo pondrían en marcha, no como algo que esté operando hoy.

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
de soberanía de datos indígenas. No se ha realizado ninguna evaluación, no hay ninguna pendiente
y no se insinúa ninguna.**

Lo que existe es un **intento de plasmar la soberanía de datos en código**: tomar
principios articulados por pueblos indígenas y expresarlos como mecanismos
funcionales en lugar de meros compromisos. Ese intento es nuestro. Determinar si tiene éxito
no nos corresponde a nosotros. Las determinaciones de cumplimiento corresponden a las comunidades
involucradas, y un proyecto que afirme su propio cumplimiento estaría reproduciendo en
miniatura exactamente la postura que estos principios buscan corregir: la del forastero
que decide qué cuenta como un tratamiento adecuado de la información de una comunidad.

Tampoco nada de esto es una garantía de imposibilidad. El software tiene defectos. Los operadores
cometen errores. Una parte decidida que ocupe suficientes roles correctos es un
riesgo residual que ninguna arquitectura elimina. La afirmación es más limitada y, creemos,
más útil: **los caminos fáciles están cerrados y los difíciles dejan evidencia.**

También existen brechas entre los principios y los mecanismos, y preferimos
mencionarlas antes de que usted las descubra. La custodia es para lo que estos mecanismos funcionan
mejor: el código es genuinamente bueno para no retener cosas. La propiedad y el control
van más allá de lo que el software puede lograr por sí solo, adentrándose en términos, gobernanza y
relaciones que ninguna cantidad de criptografía resuelve. Y cada
mecanismo anterior da por sentado que la comunidad ya cuenta con la capacidad y
la infraestructura para conservar sus propios datos, lo cual no es una suposición neutral.

---

## 5. Por favor, debata esto

El intento está abierto a la crítica, y la invitación no es un adorno.

Si usted trabaja en gobernanza de datos indígenas, CARE, Te Mana Raraunga o
tecnología para lenguas indígenas —o si es miembro o representante de una
comunidad cuyo idioma se encuentra en este índice—, queremos saber en qué nos equivocamos.
Específicamente:

- dónde un mecanismo no cumple con lo que el principio exige;
- dónde el enfoque tergiversa los principios de una comunidad o se apropia de su autoridad;
- dónde se describe algo como protector que en realidad no le protegería;
- dónde una comunidad necesitaría algo que no hemos construido;
- dónde el vocabulario en sí resulta inadecuado.

Las objeciones y correcciones pueden plantearse a través de la
[vía de contacto y retiro](/docs/your-words-your-rules),
que también abarca la solicitud de eliminación de cualquier elemento sobre una lengua que usted
represente. No hay ningún requisito de ser diplomático al respecto.

El hecho de no haber sido revisado es una realidad de este trabajo, no una defensa del mismo. Un intento que
invita a la revisión es honesto; uno que no lo hace es una afirmación.

> Esta página es la descripción de un intento de avanzar hacia principios cuyos autores son las propias comunidades; consulte esos principios tal como sus autores los exponen; este intento no cuenta con el respaldo de ninguna de las organizaciones que los custodian.

---

## A dónde ir a continuación

- [Sus palabras, sus reglas](/docs/your-words-your-rules) — la postura operativa, con mayor profundidad.
- [Registro de corpus](/docs/network/sovereignty/registering-corpora) — los cuatro niveles de exposición y lo que sale de su computadora en cada uno.
- [Ejecutar una competencia soberana](/docs/network/sovereignty/run-a-sovereign-contest) — la ceremonia de custodios, de principio a fin.
- [Limitaciones honestas](/docs/network/honest-limitations) — lo que este proyecto no afirma.
- [Sus palabras, sus reglas](/docs/your-words-your-rules) — el punto de partida práctico.
