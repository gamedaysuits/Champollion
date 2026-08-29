---
sidebar_position: 8
title: "El compromiso sobre los artefactos derivados"
description: "A quién pertenecen los modelos, las memorias de traducción y los estándares de evaluación creados a partir de los datos lingüísticos de la comunidad: a nosotros no. Champollion es infraestructura para que las comunidades construyan y sean propietarias de los suyos."
related:
  - label: "Data Stewardship"
    to: /docs/network/sovereignty/data-sovereignty
    kind: doc
    note: "The corpus-side position: data stays with its stewards"
  - label: "Ownership Transfer"
    to: /docs/network/sovereignty/ownership-transfer
    kind: doc
    note: "How infrastructure custody hands over to communities"
  - label: "For Language Communities"
    to: /docs/network/community/for-language-communities
    kind: doc
    note: "The ground rules, in plain language"
---

# El Compromiso de los Artefactos Derivados

La postura sobre la [Administración de Datos](/docs/network/sovereignty/data-sovereignty)
cubre las *entradas*: los corpus permanecen con sus administradores, nunca alojamos ni
redistribuimos datos de la comunidad. Esta página cubre las *salidas* — las cosas que se
**construyen a partir de** los datos lingüísticos: modelos entrenados y sus pesos,
memorias de traducción, ajustes finos (fine-tunes), conjuntos de entrenamiento (coaching sets), estándares de evaluación y artefactos de ejecución.

El compromiso, en una oración:

> **No reclamamos la propiedad de ningún modelo de lenguaje ni artefacto derivado del lenguaje
> construido a partir de los datos de una comunidad — y no tenemos ningún deseo de hacerlo. El
> propósito central de este proyecto es poner el control a nivel de desarrollo y de
> propiedad de estas tecnologías en manos de los hablantes.**

Champollion es **infraestructura**. Una carretera no es dueña de los bienes que transitan
por ella.

## Lo que esto significa concretamente

**Los modelos pertenecen a las personas cuyo idioma hablan.** Si un modelo se
entrena con los datos de una comunidad — con nuestras herramientas o las de cualquier otro — los
pesos, los ajustes finos y cada derivado siguen los términos de la comunidad,
no los nuestros. No hacemos copias, no volvemos a licenciar y no tratamos el hecho de que
"escribimos el script de entrenamiento" como una participación de propiedad en lo que produjo.
La lección es histórica, no hipotética: las comunidades lingüísticas han
visto repetidamente a organizaciones externas grabar, compilar o entrenar en su
idioma y luego retener los resultados — derechos de autor sobre las grabaciones de los ancianos,
modelos entrenados con voz extraída mediante scraping — mientras que los propios hablantes tenían que pedir
permiso para usar sus propias voces. Ese patrón de fracaso es el que este
compromiso busca descartar.

**El trabajo con el cree de las llanuras (nêhiyawêwin) es el caso de prueba, y la respuesta
ya está fijada.** Nada de lo construido para el cree en este proyecto es nuestro — ni
el corpus de entrenamiento (utilizado con el permiso de sus titulares y nunca
redistribuido), ni los pipelines entrenados, ni ningún modelo entrenado. Cualquier modelo
cree producido en este trabajo será entregado **únicamente a una autoridad comunitaria
reconocida** — una autoridad educativa, un consejo de ancianos o
cualquier organismo que la propia comunidad designe — bajo los propios términos de la comunidad, y a nadie más. No existe ninguna versión de esto en la que un modelo cree se lance como un producto. El trabajo de evaluación del cree es igualmente **no comercial en su totalidad**: como máximo, Champollion mantiene la metodología de evaluación *genérica* (el estándar LYSS — la idea de una puntuación intencional, consciente de la morfología y que falla con honestidad). La **instanciación cree** de ese estándar — el conocimiento lingüístico que codifica y contra el cual valida — no es algo que poseamos; su uso comercial está reservado a la espera de consultas con la comunidad lingüística nêhiyaw, y los términos de la comunidad son los que rigen.

**Las puntuaciones viajan; los artefactos no.** La tabla de clasificación publica *mediciones*
— un valor chrF++, una tasa de validación, un intervalo de confianza — con el método
y el corpus identificados. Nunca publica, aloja ni requiere el modelo en sí, el contenido del corpus o las salidas más allá de lo que permiten los términos del administrador. Si una comunidad desea que la fila de su idioma se elimine de la vista pública, las [vías de registro](/docs/network/sovereignty/registering-corpora) existen
precisamente para que la exposición sea su decisión, no la nuestra.

## Infraestructura significa: sus datos, su compilación, sus claves

Tres formas concretas de cómo se ve en la práctica el hecho de que "solo somos infraestructura":

1. **Una comunidad construye su propio corpus.** Utilizan la CLI en sus propias
   computadoras; el corpus reside donde ellos lo coloquen. Si deciden registrarlo
   para evaluación comparativa (benchmarking), el registro almacena un *puntero y una suma de comprobación (checksum)* —
   con obtención desde la fuente, bajo su licencia y eliminable de la lista a su solicitud. El
   corpus nunca ingresa a nuestro repositorio ni a nuestro almacenamiento. Esto se hace cumplir
   mediante mecanismos que usted puede inspeccionar: el repositorio público incluye las puertas de cuarentena y los
   disparadores (triggers) de la base de datos que hacen que alojar contenido de la comunidad sea estructuralmente
   imposible, no solo descortés.

2. **Una comunidad entrena su propio modelo.** La suite de entrenamiento
   ([nmt-forge](https://github.com/gamedaysuits/Champollion)) se ejecuta en su
   hardware; los puntos de control (checkpoints) y los pesos existen solo allí. El entorno de evaluación (eval harness)
   lo califica; la tabla registra la puntuación. Nunca poseemos el modelo. Si
   desean que sea privado para siempre, lo será — una fila de puntuación es el único rastro
   público, y solo si deciden publicar una.

3. **Una comunidad ejecuta su propia evaluación comparativa.** Con los
   [concursos soberanos](/docs/network/sovereignty/run-a-sovereign-contest),
   el conjunto de pruebas permanece sellado en una infraestructura controlada por la comunidad; los métodos
   llegan *a* los datos; solo salen las puntuaciones agregadas. La comunidad decide
   quién puede evaluar, bajo qué términos, y puede detenerlo en cualquier momento.

En cada caso, la dirección de viaje es la misma: la capacidad se mueve hacia
la comunidad; los datos y sus derivados no se alejan de ella.

## Los marcos de referencia que admiramos

Estamos **inspirados por, y aspiramos a,** los marcos de gobernanza de datos indígenas que las propias comunidades han construido. No nos corresponde a nosotros considerarnos en cumplimiento con ninguno de ellos — ese juicio pertenece a las comunidades e instituciones que los crearon. Lo que podemos hacer es diseñar en su dirección, nombrarlos como los creadores de estándares y decir claramente que valoraríamos profundamente la oportunidad de escuchar y trabajar con estos expertos para mejorar este sistema en su espíritu:

- **Los principios de soberanía de datos de las Primeras Naciones** — la propiedad, el control,
  el acceso y la posesión de la información propia de una comunidad: precisamente
  las cuatro capacidades que esta página se compromete a mantener en manos de la comunidad.
- **Los Principios CARE para la Gobernanza de Datos Indígenas** (Beneficio Colectivo, Autoridad para Controlar, Responsabilidad, Ética), de la Alianza Global de
  Datos Indígenas — la lente correctiva para los datos puramente "abiertos": la
  apertura no es una virtud cuando despoja a un pueblo de la autoridad sobre su
  propio conocimiento.
- **Te Mana Raraunga**, la carta de la Red de Soberanía de Datos Maorí —
  los datos como un taonga (tesoro) vivo, con derechos y responsabilidades que
  los acompañan.
- **La Licencia Kaitiakitanga** (Te Hiku Media) — hasta donde sabemos, el
  ejemplo práctico más claro de soberanía de artefactos derivados en la tecnología
  lingüística: Te Hiku construyó modelos de voz *a partir de* y *para* el te reo maorí y
  licencia el acceso bajo términos de tutela, de modo que los modelos beneficien a los maoríes
  y permanezcan bajo la gobernanza maorí. Cuando decimos que "los modelos pertenecen a los
  hablantes", Te Hiku es la prueba de existencia de que funciona.
- **El modelo de investigación participativa de Masakhane** — PNL (Procesamiento de Lenguaje Natural) africano construido por
  hablantes-investigadores como coautores y propietarios en lugar de fuentes de datos; la
  demostración de que el *proceso* de construcción de tecnología lingüística puede
  ser en sí mismo la transferencia de capacidad.

Estos son marcos diferentes de pueblos diferentes con posiciones legales
y culturales diferentes — los nombramos uno al lado del otro en lugar de agruparlos
bajo una sola etiqueta. Donde nuestro diseño no alcance su espíritu, eso es un
defecto que debe corregirse, y preferiríamos escucharlo de los expertos que descubrirlo
en un análisis retrospectivo (postmortem). Si usted trabaja en este espacio y está dispuesto a decirnos
en qué nos hemos equivocado: **esa conversación es la contribución más valiosa
que este proyecto puede recibir.** Contáctenos a través de
[Involúcrese](/get-involved).

## Lo que sí poseemos

Para mayor claridad, las cosas que Champollion *sí* reclama: el código de la infraestructura (CLI, entorno de evaluación, suite de entrenamiento — cada uno bajo su licencia publicada), la metodología de evaluación genérica y las *mediciones derivadas* del índice (que llevan la procedencia `champollion-derived` precisamente para que nunca se atribuyan erróneamente a una comunidad o a una fuente original). Esa es la caja de herramientas. Lo que usted construya con ella es suyo.

