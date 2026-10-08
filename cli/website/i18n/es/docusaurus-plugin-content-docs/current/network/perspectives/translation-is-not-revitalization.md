---
sidebar_position: 1
title: "La traducción no es revitalización"
slug: '/network/perspectives/translation-is-not-revitalization'
description: "Qué puede y qué no puede hacer la traducción automática por las lenguas en peligro de extinción — dicho claramente. La TA es infraestructura para comunidades lingüísticas. Nunca sustituye la comunicación entre personas."
related:
  - label: "How Speakers Get Paid"
    to: /docs/network/perspectives/how-speakers-get-paid
    kind: position
  - label: "From Benchmark to Daily Use"
    to: /docs/network/perspectives/from-benchmark-to-daily-use
    kind: position
    note: "The post-editing path from draft to published text"
  - label: "Data Sovereignty"
    to: /docs/network/sovereignty/data-sovereignty
    kind: doc
    note: "Data-sovereignty principles, CARE, and consent before deployment"
  - label: "For Language Communities"
    to: /docs/network/community/for-language-communities
    kind: doc
---

# La traducción no es revitalización

> **Posición.** La traducción automática convierte texto entre idiomas. La revitalización crea nuevos hablantes. Estas son actividades diferentes con criterios de éxito diferentes, y ninguna puntuación en un ranking cambia eso. Construimos MT como infraestructura que sirve los objetivos de una comunidad — nunca como sustituto de la transmisión intergeneracional. Los niños aprenden idioma de personas, no de máquinas.

En 2026 es fácil creer que el software puede arreglarlo todo, incluyendo un idioma que está perdiendo hablantes. Queremos ser precisos sobre por qué esa creencia es incorrecta — y sobre qué puede la tecnología de traducción *honestamente* contribuir.

Este texto existe porque un lingüista que invitamos a criticar este proyecto argumentó con fuerza: un sistema de traducción perfecto English→Cree no resolvería el problema de transmisión (niños que no aprenden el idioma en casa), el problema de prestigio (el inglés como idioma del poder económico), o el problema pedagógico (no hay suficientes escuelas de inmersión y maestros capacitados). Podría incluso empeorar las cosas, creando la ilusión de que "la computadora puede hablar Cree" y suavizando la urgencia de la transmisión humana. Aceptamos la mayor parte de esa crítica, y publicamos nuestra respuesta aquí en lugar de ocultarla.

---

## Lo que la revitalización realmente requiere

La literatura de investigación sobre revitalización de idiomas es consistente en un punto: los idiomas sobreviven cuando se transmiten entre generaciones — cuando padres, abuelos y comunidades los hablan a los niños, y los niños crecen hablándolos de vuelta (Fishman 1991; Hinton & Hale 2001). Todo lo demás — escuelas, medios, diccionarios, aplicaciones — apoya esa transmisión o no apoya nada.

Ningún sistema de traducción participa en ese intercambio. Un modelo que convierte un documento en inglés a Plains Cree no crea un hablante. No equipa un aula de inmersión, no capacita a un maestro, ni se sienta con un niño en una mesa de cocina. Si nuestro trabajo alguna vez se describe como "salvar idiomas," esa descripción es incorrecta y lo diremos.

## Lo que MT no puede hacer

Dicho claramente, para que no haya ambigüedad después:

- **No puede reemplazar hablantes.** El resultado que ningún hablante fluido ha revisado es un borrador, no un texto. Nuestras propias [reglas de puntuación](/docs/network/specifications/scoring) tratan cada puntuación automatizada como un proxy; solo la revisión humana confirma la usabilidad.
- **No puede enseñar un idioma materno.** Los niños adquieren idioma a través de la relación e inmersión, no a través de documentos traducidos.
- **Puede crear una ilusión dañina.** Una demostración que "habla" un idioma puede sugerir que el idioma es seguro cuando no lo es. Este riesgo de prestigio es real, y lo tratamos como una pregunta abierta a ser examinada *con* las comunidades, no como un punto de conversación a ser manejado.
- **No puede decidir nada.** Si un sistema de traducción debe existir para un idioma, y dónde puede ser usado, es la decisión de la comunidad — incluyendo la decisión de no implementarlo en absoluto. Ese control está integrado en la arquitectura de [transferencia de propiedad](/docs/network/sovereignty/ownership-transfer) y [soberanía de datos](/docs/network/sovereignty/data-sovereignty), e incluye contextos: una comunidad podría aceptar MT para documentos oficiales y rechazarlo para materiales de aula.

## Lo que MT puede honestamente hacer

Contra ese trasfondo, hay cosas concretas y limitadas que la infraestructura de traducción contribuye — cada una sirviendo a personas que ya están haciendo el trabajo real.

**1. Rendimiento para traductores sobrecargados.** Las oficinas de traducción comunitaria enfrentan más documentos que *deberían* existir en el idioma de lo que los traductores humanos pueden producir desde cero. Un borrador de máquina cambia el trabajo de "traducir todo" a "revisar y corregir" — y estudios controlados han encontrado que la posedición es significativamente más rápida que traducir desde cero, con calidad mantenida o mejorada (Plitt & Masselot 2010; Green, Heer & Manning 2013). Describimos este flujo de trabajo en detalle en [From Benchmark to Daily Use](/docs/network/perspectives/from-benchmark-to-daily-use). La salvedad: esos estudios cubrieron pares de idiomas de alto recurso; aún no tenemos evidencia equivalente para idiomas polisintéticos, que es parte de lo que este proyecto está configurado para medir.

**2. Apalancamiento práctico para derechos lingüísticos.** El derecho a servicios gubernamentales en idiomas indígenas existe en la ley en varias jurisdicciones. Lo que a menudo falta es la capacidad práctica de producir traducciones a la velocidad que la burocracia demanda. Una comunidad que puede convertir un documento de política de cincuenta páginas en una traducción revisada en días en lugar de meses está en una posición de negociación más fuerte. La tecnología no crea el derecho; hace que el derecho sea más difícil de ignorar.

**3. Infraestructura lingüística reutilizable.** El analizador morfológico (FST) que usamos para verificar que el resultado de la traducción contiene palabras reales — no alucinadas — codifica *por qué* cada forma de palabra es válida. Esa misma maquinaria es la base para herramientas de aprendizaje: entrenadores de conjugación, ayudas de escritura que corrigen errores, exploradores morfológicos. El motor de verificación y el motor pedagógico son el mismo artefacto. Este es un camino, no una promesa — las herramientas de aprendizaje requieren ser construidas, y si se construyen es una decisión comunitaria.

**4. Apoyo para aprendices de segundo idioma.** La revitalización no es solo niños adquiriendo un idioma materno. También es adultos aprendiendo como segundo idioma — personas que quizás nunca alcancen fluidez a nivel de Anciano pero que pueden leer documentos comunitarios, participar con comprensión, y elevar la presencia pública del idioma usándolo. Para esta población, una ayuda de traducción es una herramienta genuina, como lo es un diccionario.

**5. Una razón para que el trabajo sea financiado y poseído en casa.** En nuestro modelo, los métodos probados [se transfieren a la propiedad comunitaria](/docs/network/sovereignty/ownership-transfer) completamente, y cualquier cosa que una comunidad gane de un activo que posee es enteramente suya ([cómo se financia el trabajo](/docs/network/sovereignty/economic-model)). Los hablantes son [pagados por su experiencia](/docs/network/perspectives/how-speakers-get-paid), no se les pide que lo hagan voluntariamente. Nada de eso es revitalización tampoco — pero dirige recursos hacia las personas que hacen revitalización, en lugar de alejarlos de ellas.

## El marco honesto

El campo tiene un largo registro de proyectos tecnológicos que llegan con narrativas de rescate y se van con publicaciones (Bird 2020). Intentamos mantener una afirmación más estrecha: **MT es infraestructura.** La infraestructura sirve objetivos establecidos por otras personas. Los caminos no deciden dónde viaja; esta tecnología no decide si un idioma vive. Los hablantes, familias y comunidades lo hacen — y el marco del [Decenio Internacional de las Lenguas Indígenas de la UNESCO](https://idil2022-2032.org/) es correcto al poner a los pueblos indígenas, no a las herramientas, en el centro.

Si una comunidad concluye que la tecnología de traducción ayuda sus objetivos, queremos que sea la versión mejor, más responsable posible — poseída por ellos, validada por sus hablantes, implementada en sus términos. Si una comunidad concluye que no ayuda, esa conclusión es un resultado válido de este proyecto, no un fracaso del mismo. Ambas mitades de esa oración son compromisos.

---

## Lo que esto significa para usted

:::info[Si usted es miembro de una comunidad]
Este proyecto no le dirá que una aplicación puede salvar su lengua — no puede. Lo que ofrece es limitado: traducción de documentos más rápida bajo revisión de hablantes fluidos, infraestructura que su comunidad puede poseer completamente, y compensación por la experiencia de los hablantes. Si y cómo se usa cualquiera de esto es decisión de su comunidad, incluyendo la decisión de no usarlo. Vea [Para comunidades lingüísticas](/docs/network/community/for-language-communities) e [Informar errores y poseer correcciones](/docs/network/perspectives/reporting-errors-and-owning-corrections).
:::

:::info[Si usted es investigador]
Trate "MT para lenguas en peligro" como una afirmación de infraestructura, no una afirmación de revitalización, y su pregunta de evaluación cambia: no "¿es alto el puntaje BLEU?" sino "¿esto reduce mediblemente la carga de trabajo de las personas que hacen el trabajo real, en sus términos?" La [especificación de referencia](/docs/network/specifications/benchmark) y [Cómo funciona §8 (Tensiones y limitaciones)](/docs/network/how-it-works#8-tensions-and-limitations) son donde nos mantenemos a ese estándar.
:::

:::info[Si usted es desarrollador]
Construya para el flujo de trabajo de posedición, no para la demostración. El usuario de su método es un hablante fluido corrigiendo un borrador, y el peor modo de fallo es palabras alucinadas que se ven plausibles para no hablantes — por eso la validación morfológica controla todo aquí. Comience con [Enviar un método](/docs/network/getting-started/submit-a-method) y [De referencia a uso diario](/docs/network/perspectives/from-benchmark-to-daily-use).
:::

---

## Fuentes

- Fishman, J. A. (1991). *Reversing Language Shift: Theoretical and Empirical Foundations of Assistance to Threatened Languages.* Multilingual Matters.
- Hinton, L., & Hale, K. (eds.) (2001). *The Green Book of Language Revitalization in Practice.* Academic Press.
- Plitt, M., & Masselot, F. (2010). "A Productivity Test of Statistical Machine Translation Post-Editing in a Typical Localisation Context." *The Prague Bulletin of Mathematical Linguistics*, 93, 7–16. [PDF](https://ufal.mff.cuni.cz/pbml/93/art-plitt-masselot.pdf)
- Green, S., Heer, J., & Manning, C. D. (2013). "The Efficacy of Human Post-Editing for Language Translation." *Proceedings of CHI 2013.* [Paper](https://idl.uw.edu/papers/post-editing)
- Bird, S. (2020). "Decolonising Speech and Language Technology." *Proceedings of COLING 2020*, 3504–3519. [Paper](https://aclanthology.org/2020.coling-main.42/)
- UNESCO. *International Decade of Indigenous Languages 2022–2032.* [idil2022-2032.org](https://idil2022-2032.org/)

## Véase también

- [How Speakers Get Paid](/docs/network/perspectives/how-speakers-get-paid) — el modelo de compensación, en números
- [From Benchmark to Daily Use](/docs/network/perspectives/from-benchmark-to-daily-use) — el camino de posedición
- [How It Works](/docs/network/how-it-works) — la arquitectura completa de la plataforma, incluyendo §8 sobre tensiones que no hemos resuelto
