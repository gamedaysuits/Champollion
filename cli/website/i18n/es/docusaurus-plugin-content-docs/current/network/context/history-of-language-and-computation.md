---
sidebar_position: 1
title: "De Pāṇini a Transformers"
---

# De Pāṇini a los Transformers: Lenguaje, Computación, y la Obra Inconclusa de la Traducción

**Una Historia de las Ideas Detrás de champollion**

---

> *"Cuando miro un artículo en ruso, digo: 'Esto realmente está escrito en inglés, pero ha sido codificado en algunos símbolos extraños. Procederé ahora a decodificarlo.'"*
> — Warren Weaver, 1949

---

## Introducción

El sueño de una máquina que pudiera traducir entre lenguajes humanos es más antiguo que la computadora misma. Es, en cierto sentido, *el* problema original de la inteligencia artificial—más antiguo que los programas que juegan ajedrez, más antiguo que los sistemas expertos, más antiguo que las redes neuronales. Este deseo a menudo se enmarca a través de parábolas europeas como la Torre de Babel, que posiciona la diversidad lingüística como un castigo o un problema a resolver, pasando por alto la realidad de que las sociedades indígenas precontacto han navegado durante mucho tiempo una diversidad lingüística asombrosa a través de sofisticadas lenguas comerciales (como el Chinook Jargon) y sistemas de signos (como la Lengua de Signos de las Llanuras Indias) sin buscar una homogeneización universal.

Pero la historia que conduce a este momento—a un mundo donde los grandes modelos de lenguaje pueden traducir francés pasable pero alucinar sinsentidos en cree—no es una línea recta. Es una trenza de al menos cuatro hilos distintos: el estudio formal del lenguaje, la teoría matemática de la computación, la revolución estadística en el aprendizaje automático, y una historia más oscura que explica *por qué* los lenguajes que más necesitan tecnología son precisamente aquellos para los cuales no existe. Ese cuarto hilo es la historia de la supresión lingüística colonial y el genocidio cultural—la destrucción deliberada y sistemática de lenguajes indígenas en cada continente donde las potencias europeas establecieron dominio. Sin entender esa historia, el problema técnico parece un accidente de escasez de datos. No es un accidente.

Este documento traza los cuatro hilos desde sus orígenes hasta su convergencia en el presente. Es, admitidamente, algo whiggista—cuenta la historia como si siempre hubiera estado conduciendo aquí. La historia, por supuesto, no sabía hacia dónde iba. Pero los hilos son reales, las conexiones son genuinas, y entenderlas es esencial para comprender por qué existen proyectos como champollion, por qué se construyen de la manera en que se construyen, y por qué importan ahora.

---

## I. La Gramática de Todo: De Pāṇini a Chomsky

### La Primera Gramática Formal (c. siglo IV a.C.)

La historia comienza no en una universidad europea sino en la India antigua, con un erudito llamado Pāṇini. Alrededor del siglo IV a.C., Pāṇini compuso el *Aṣṭādhyāyī*—una gramática del sánscrito que comprende aproximadamente 4.000 reglas. Esta no era una gramática en el sentido pedagógico laxo. Era una gramática *generativa*: un conjunto finito de reglas capaz, en principio, de producir cada enunciado válido en el lenguaje.

El sistema de Pāṇini utilizaba lo que ahora reconoceríamos como reglas de reescritura formales, con variables, recursión, y aplicación ordenada. El lingüista Paul Kiparsky ha argumentado que el *Aṣṭādhyāyī* es "la gramática generativa más completa de cualquier lenguaje jamás escrita" (Kiparsky, 1993). El informático Gerard Huet ha demostrado que las reglas de Pāṇini pueden modelarse como un transductor de estados finitos—el mismo formalismo computacional que, veinticinco siglos después, se convertiría en central para el análisis morfológico de lenguajes polisintéticos.

Pāṇini no sabía que estaba haciendo ciencia de la computación. Pero lo estaba haciendo.

### La Piedra de Rosetta y el Nacimiento de la Lingüística Comparativa (1799)

Durante la mayor parte de la historia registrada, el estudio del lenguaje fue principalmente el estudio de *un* lenguaje—o, como mucho, el estudio de un lenguaje sagrado o clásico para propósitos litúrgicos. La revolución intelectual que creó la lingüística moderna comenzó con una piedra.

La Piedra de Rosetta, descubierta por los soldados de Napoleón en 1799, llevaba el mismo decreto en tres escrituras: jeroglíficos egipcios, escritura demótica, y griego antiguo. El desciframiento de los jeroglíficos por Jean-François Champollion en 1822 fue más que un triunfo arqueológico. Demostró un principio que se convertiría en fundamental: que los lenguajes podían entenderse *a través de uno al otro*. La traducción no era meramente una habilidad práctica; era un método de investigación científica.

### William Jones y la Hipótesis Indoeuropea (1786)

Incluso antes de Champollion, el filólogo británico Sir William Jones había pronunciado su famosa conferencia ante la Sociedad Asiática de Bengala en 1786, observando que el sánscrito tenía con el griego y el latín "una afinidad más fuerte, tanto en las raíces de los verbos como en las formas de la gramática, de la que podría haber sido producida por accidente." Jones propuso que los tres descendían de un antepasado común "que, quizás, ya no existe."

Este fue el nacimiento de la lingüística histórica y comparativa. Estableció que los lenguajes no eran entidades aisladas y estáticas sino miembros de familias—relacionados por descendencia, moldeados por el tiempo, sujetos a leyes regulares de cambio. Fue, en cierto sentido, una teoría evolutiva décadas antes de Darwin.

### Los Árboles de Lenguaje de August Schleicher (1861)

Fue August Schleicher, un lingüista alemán, quien hizo la conexión darwiniana explícita. En 1861—solo dos años después de *El Origen de las Especies*—Schleicher publicó su modelo *Stammbaum* (árbol genealógico) de los lenguajes indoeuropeos. Sus diagramas se ven casi indistinguibles de los árboles filogenéticos en biología. Los lenguajes, como las especies, se ramificaban, divergían, y ocasionalmente se extinguían.

Los árboles de Schleicher fueron una simplificación (los lenguajes también *convergen* a través del contacto, el préstamo, y la criollización), pero el modelo resultó enormemente productivo. Estableció el principio de que la diversidad lingüística no era ruido aleatorio sino datos estructurados, amenables al análisis sistemático. Y planteó, implícitamente, una pregunta que sigue siendo central para nuestro proyecto: ¿qué sucede con las ramas que se están muriendo?

### Ferdinand de Saussure y la Arquitectura del Lenguaje (1916)

La siguiente revolución vino de Ferdinand de Saussure, cuyo *Cours de linguistique générale* (publicado póstumamente en 1916 a partir de notas de estudiantes) estableció la lingüística estructural. Saussure trazó una distinción aguda entre *langue* (el sistema abstracto de un lenguaje) y *parole* (el habla real). Argumentó que los signos lingüísticos eran *arbitrarios*—la palabra "árbol" no tiene conexión inherente con los árboles—y que el significado surgía de *diferencias* dentro de un sistema, no de ningún contenido positivo.

El diagrama clave de Saussure—el óvalo dividido entre *signifié* (significado, el concepto) y *signifiant* (significante, la imagen sonora), vinculados por flechas mostrando su relación inseparable—se convirtió en una de las imágenes más reproducidas en las humanidades. Estableció el principio de que un lenguaje es un *sistema de sistemas*, donde cada elemento deriva su valor de sus relaciones con todos los demás.

Esto tuvo implicaciones profundas para la traducción. Si el significado es relacional y sistémico, entonces la traducción no es un asunto de intercambiar palabras. Requiere entender toda la arquitectura de un lenguaje. Dos lenguajes pueden dividir el mundo de formas fundamentalmente diferentes—una perspectiva que sería desarrollada posteriormente (y a veces exagerada) por Edward Sapir y Benjamin Lee Whorf.

### Sapir, Bloomfield, y el Estudio de Lenguajes Indígenas

En América del Norte, el siglo XX temprano trajo una tradición diferente de trabajo de campo lingüístico. Edward Sapir y Leonard Bloomfield trabajaron extensamente con lenguajes indígenas—Sapir con navajo, nootka, y muchos otros; Bloomfield con menomini y otros lenguajes algonquinos. Encontraron estructuras lingüísticas radicalmente diferentes de cualquier cosa en la familia indoeuropea.

Sapir, en particular, desarrolló un marco tipológico que clasificaba lenguajes a lo largo de varios ejes, incluyendo la distinción crítica entre lenguajes *analíticos* (como el inglés, donde las palabras tienden a ser cortas y el significado es llevado por el orden de palabras) y lenguajes *polisintéticos* (como el cree, donde una sola palabra puede codificar lo que el inglés expresaría como una oración completa). Una sola forma verbal en cree podría incorporar el sujeto, objeto, tiempo, aspecto, evidencialidad, y varios elementos modificadores en una sola palabra morfológicamente compleja.

Este trabajo estableció dos hechos que siguen siendo centrales para nuestro proyecto. Primero: los lenguajes del mundo son mucho más diversos estructuralmente de lo que cualquier modelo eurocéntrico sugeriría. Segundo: muchos de estos lenguajes ya estaban en peligro. Sin embargo, mientras que los lingüistas estructurales tempranos documentaban esta complejidad, a menudo participaban en "antropología de salvamento"—un modelo académico extractivo que trataba a los pueblos indígenas meramente como "informantes" para construir carreras académicas occidentales. Este enfoque separó los lenguajes de sus raíces epistemológicas, allanando el camino para tratar el lenguaje como datos desencarnados y extractibles en lugar de sistemas vivos y relacionales.

### La Revolución de Chomsky (1957)

En 1957, un lingüista del MIT de 28 años llamado Noam Chomsky publicó *Syntactic Structures*, un libro delgado que detonó como una bomba en el campo. Chomsky argumentó que el objetivo de la lingüística debería ser descubrir la *gramática generativa* de un lenguaje—un conjunto finito de reglas que pudiera producir todas y solo las oraciones gramaticales de ese lenguaje.

Más provocativamente, Chomsky propuso la *jerarquía de Chomsky*: una clasificación de gramáticas formales por su poder computacional. La jerarquía tiene cuatro niveles:

- **Tipo 3 (Regular)**: Reconocido por autómatas finitos. Patrones simples.
- **Tipo 2 (Libre de Contexto)**: Reconocido por autómatas de pila. Estructuras recursivas como paréntesis anidados.
- **Tipo 1 (Sensible al Contexto)**: Reconocido por autómatas linealmente acotados. Dependencias más complejas.
- **Tipo 0 (Recursivamente Enumerable)**: Reconocido por máquinas de Turing. Cualquier cosa computable.

Chomsky argumentó que los lenguajes naturales requerían al menos gramáticas libres de contexto, y posiblemente más. Este fue un puente directo entre la lingüística y la teoría matemática de la computación. Las mismas herramientas formales que Alan Turing había desarrollado para razonar sobre los límites de la computación ahora podían aplicarse al lenguaje humano.

Chomsky también propuso la idea de *Gramática Universal*—que la capacidad para el lenguaje es innata, que todos los lenguajes humanos comparten propiedades estructurales profundas, y que la diversidad de formas superficiales enmascara una unidad subyacente. Esto sigue siendo controvertido (muchos tipólogos y funcionalistas no están de acuerdo), pero las herramientas formales que Chomsky introdujo—reglas de estructura de frases, gramáticas transformacionales, la jerarquía misma—se convirtieron en la fundación de la lingüística computacional.

---

## II. El Sueño de la Traducción Universal

### La Máquina Pensante de Ramon Llull (1305)

El sueño de mecanizar el pensamiento—y con él, el sueño de la traducción mecánica—es notablemente antiguo. Ramon Llull, un místico catalán del siglo XIII, diseñó el *Ars Magna*: un sistema de discos concéntricos giratorios inscritos con conceptos fundamentales, cuyas combinaciones estaban destinadas a generar todas las verdades posibles. Las ruedas de Llull fueron, en cierto sentido, la primera máquina de lógica combinatoria. Leibniz citaría posteriormente a Llull como inspiración.

### Athanasius Kircher y la Polygraphia Nova (1663)

Athanasius Kircher, el gran polímata jesuita, publicó *Polygraphia Nova et Universalis* en 1663—un sistema de "escritura universal" destinado a permitir la comunicación a través de barreras lingüísticas. El sistema de Kircher asignaba números a conceptos, que luego podían decodificarse en cualquier lenguaje con la tabla apropiada. Era, en esencia, una interlingua—una representación de significado independiente del lenguaje.

El sistema no funcionó muy bien. Pero la *idea* persistió: que entre dos lenguajes cualesquiera existe un espacio conceptual común, y que la traducción es un asunto de mapeo a través de él. Esta hipótesis de interlingua no era solo un experimento científico fallido; era una extensión epistemológica del control colonial, incapaz de mapear ontologías divergentes. El filósofo W.V.O. Quine formalizaría posteriormente este fracaso con su concepto de la *indeterminación de la traducción* (1960), argumentando que la traducción radical es inherentemente indeterminada. El mapeo universal e independiente del contexto entre sistemas lingüísticos fundamentalmente divergentes es una imposibilidad filosófica, no meramente un obstáculo de ingeniería.

### John Wilkins y el Lenguaje Filosófico (1668)

Solo cinco años después de Kircher, el filósofo natural inglés John Wilkins publicó *An Essay towards a Real Character, and a Philosophical Language*—un intento de crear un lenguaje cuya estructura *reflejara perfectamente la estructura de la realidad*. Cada concepto sería clasificado en una gran taxonomía, y su nombre codificaría su posición en esa taxonomía.

El proyecto de Wilkins fracasó (la realidad resultó resistente a la clasificación ordenada), pero anticipó algo importante: la idea de que el lenguaje podría ser *ingenierizado*, que la relación entre palabras y significados podría hacerse sistemática y explícita. Esto es, en un sentido profundo, lo que hacen los lingüistas computacionales cuando construyen ontologías y gráficos de conocimiento.

### Leibniz y la Characteristica Universalis

Gottfried Wilhelm Leibniz, quien inventó independientemente el cálculo y diseñó una calculadora mecánica, soñaba con una *characteristica universalis*—un lenguaje formal universal en el cual todo el conocimiento humano podría expresarse—y un *calculus ratiocinator*—una máquina que pudiera razonar en ese lenguaje. "Si surgieran controversias," escribió Leibniz, "no habría más necesidad de disputa entre dos filósofos que entre dos contadores. Pues bastaría tomar sus lápices en sus manos, sentarse a sus pizarras, y decirse uno al otro: Calculemos."

Leibniz también inventó la aritmética binaria—el sistema numérico que, siglos después, se convertiría en el lenguaje de las computadoras digitales. Su artículo de 1703 *Explication de l'Arithmétique Binaire* mostró que cualquier número podría representarse usando solo 0 y 1. Vio esto como un reflejo de la creación divina (algo de la nada), pero resultaría ser la fundación de toda computación digital.

### El Memorándum de Warren Weaver (1949)

La era moderna de la traducción automática comienza con un memorándum. En julio de 1949, el matemático estadounidense y administrador científico Warren Weaver escribió a Norbert Wiener, proponiendo que las nuevas computadoras electrónicas pudieran aplicarse al problema de la traducción. Su memorándum contenía el pasaje notable citado al comienzo de este documento: la idea de que un texto ruso es "realmente escrito en inglés, pero... codificado en algunos símbolos extraños."

La metáfora de Weaver fue extraída del análisis criptográfico de tiempos de guerra—la idea de que la traducción era fundamentalmente un problema de *decodificación*. Esto no era meramente una analogía. Las mismas herramientas estadísticas e informáticas que habían sido desarrolladas para romper cifras enemigos podrían, sugería Weaver, ser aplicables al problema de la traducción.

El memorándum fue salvajemente optimista, pero lanzó un programa de investigación. Dentro de cinco años, la primera demostración de traducción automática tendría lugar.

---

## III. La Maquinaria del Pensamiento: Computación e Información

### George Boole y el Álgebra de la Lógica (1854)

En 1854, George Boole publicó *An Investigation of the Laws of Thought*—una obra que redujo el razonamiento lógico a operaciones algebraicas. Boole mostró que las proposiciones de la lógica podían manipularse usando las mismas reglas que el álgebra, con AND correspondiendo a multiplicación, OR a suma, y NOT a complemento.

El álgebra booleana parecía una curiosidad matemática en ese momento. Se convertiría en el principio operativo de cada circuito digital jamás construido.

### Charles Babbage y Ada Lovelace (1837–1843)

Charles Babbage diseñó (pero nunca completó) la Máquina Analítica—una computadora mecánica, impulsada por vapor, de propósito general. A diferencia de su anterior Máquina de Diferencias (una calculadora especializada), la Máquina Analítica tenía una memoria ("la Tienda"), una unidad de procesamiento ("el Molino"), ramificación condicional, y bucles. Era, en principio, Turing-completa.

Ada Lovelace, trabajando a partir de una descripción de la Máquina, escribió un conjunto de notas detalladas que incluían lo que es ampliamente considerado el primer programa de computadora publicado: un algoritmo para calcular números de Bernoulli (Nota G, 1843). Pero la contribución más profunda de Lovelace fue conceptual. Vio que la Máquina podía manipular *símbolos*, no solo números. "La Máquina Analítica teje patrones algebraicos," escribió, "así como el telar de Jacquard teje flores y hojas." La implicación—que la computación podría aplicarse a cualquier dominio con una estructura formal, incluyendo el lenguaje—fue premonitoria.

### Alan Turing y la Máquina Universal (1936)

En 1936, Alan Turing publicó "On Computable Numbers, with an Application to the Entscheidungsproblem"—un artículo que simultáneamente definió la computación, probó sus límites, e inventó la computadora moderna (en forma abstracta).

La perspectiva clave de Turing fue la *máquina universal*: una sola máquina que, dadas las instrucciones correctas codificadas en su cinta, podría simular *cualquier otra* máquina. Esto estableció que no había diferencia esencial entre hardware y software, entre la máquina y el programa. Un solo dispositivo, programado apropiadamente, podría computar cualquier cosa que fuera computable.

El trabajo de Turing también estableció los límites de la computación (el problema de la parada) y sentó las bases para su posterior exploración de la inteligencia de máquinas. Su artículo de 1950 "Computing Machinery and Intelligence," que propuso la famosa Prueba de Turing, enmarcó la cuestión de la inteligencia de máquinas explícitamente en términos de *lenguaje*: una máquina es inteligente si, a través de la conversación, no puede distinguirse de un humano.

### Claude Shannon y la Teoría de la Información (1948)

En 1948, Claude Shannon publicó "A Mathematical Theory of Communication" en el *Bell System Technical Journal*—un artículo que fundó el campo de la teoría de la información. Shannon mostró que la comunicación podía modelarse como un sistema: una *fuente de información* genera un *mensaje*, que un *transmisor* codifica en una *señal*, que pasa a través de un *canal* (sujeto a *ruido*), que un *receptor* decodifica de vuelta a un mensaje para un *destino*.

La contribución clave de Shannon fue el concepto de *entropía*—una medida de la incertidumbre o contenido de información de un mensaje. Probó que para cualquier canal con un nivel de ruido dado, existe una tasa máxima a la cual la información puede transmitirse confiablemente (la capacidad del canal), y que esta tasa puede alcanzarse con codificación suficientemente inteligente.

La conexión con la traducción es profunda. El mismo Shannon, en un artículo de 1951, utilizó la teoría de la información para analizar la estructura estadística del inglés. Mostró que el texto en inglés es altamente redundante—que un hablante nativo, dada una secuencia de letras, puede predecir la siguiente letra con alta precisión. Esta redundancia es lo que hace que la comunicación sea robusta contra el ruido, pero también significa que el *contenido de información* del lenguaje es mucho menor de lo que el recuento de símbolos brutos sugeriría.

Warren Weaver inmediatamente vio la conexión: si la traducción es decodificación, y si la estructura estadística del lenguaje puede modelarse, entonces la traducción es un problema informático. Esta perspectiva tomaría décadas para dar fruto, pero cuando lo hizo, transformó el campo.

### Von Neumann y la Computadora de Programa Almacenado (1945)

El informe de 1945 de John von Neumann sobre la EDVAC (Computadora Automática Variable Discreta Electrónica) describió lo que ahora llamamos la *arquitectura de von Neumann*: una computadora con un único almacén de memoria para datos e instrucciones, una unidad central de procesamiento, y mecanismos de entrada/salida. Esta arquitectura—datos y programas compartiendo la misma memoria, procesados secuencialmente por una CPU—sigue siendo el diseño fundamental de casi todas las computadoras en uso hoy.

La arquitectura de von Neumann hizo el software práctico. Los programas podían almacenarse, modificarse, e incluso ser generados por otros programas. Esta fue la precondición tecnológica para todo lo que siguió: compiladores, sistemas operativos, y eventualmente los marcos de redes neuronales que potencian la traducción automática moderna.

---

## IV. Traducción Automática: El Primer Problema de IA

### El Experimento Georgetown-IBM y la Guerra Fría (1954)

El 7 de enero de 1954, investigadores de la Universidad de Georgetown e IBM demostraron el primer sistema público de traducción automática. El sistema tradujo 60 oraciones rusas al inglés usando un vocabulario de 250 palabras y seis reglas gramaticales. Las oraciones fueron cuidadosamente seleccionadas para estar dentro de las capacidades del sistema, pero la demostración generó un entusiasmo enorme.

El *New York Times* reportó que el experimento presagiaba un futuro donde "un traductor electrónico de botón" haría toda la literatura científica del mundo instantáneamente accesible. Sin embargo, este optimismo público enmascaraba la realidad material de la financiación del proyecto y su propósito. El experimento Georgetown-IBM—y el campo de la traducción automática temprana en general—no fue impulsado por un deseo utópico de comunicación universal. Fue financiado por el aparato militar e inteligencia estadounidense (incluyendo la CIA y DARPA) como un imperativo urgente de la Guerra Fría para vigilar e interceptar textos científicos y militares soviéticos.

La visión del lenguaje como un "código a ser descifrado" (como lo expresó Weaver) estaba intrínsecamente vinculada a la vigilancia militarizada. Los investigadores predijeron que la traducción automática sería un problema resuelto dentro de cinco años. Se equivocaron por más de medio siglo.

### El Informe ALPAC y el Primer Invierno de IA (1966)

En 1966, el Comité Asesor de Procesamiento Automático de Lenguaje (ALPAC), convocado por el gobierno estadounidense, emitió un informe devastador. Después de revisar una década de investigación en TA, ALPAC concluyó que la traducción automática era más lenta, menos precisa, y más cara que la traducción humana, y recomendó que la financiación fuera redirigida a la investigación básica en lingüística computacional.

El informe ALPAC efectivamente mató la financiación de investigación en TA en los Estados Unidos durante más de una década. Fue el primer "invierno de IA"—un patrón que se repetiría: promesas extravagantes, resultados modestos, desilusión, colapso de financiación.

Pero el informe también contenía una perspectiva más profunda. La traducción automática había fracasado, en parte, porque el lenguaje era más difícil de lo que nadie había esperado. El enfoque basado en reglas—escribir reglas gramaticales explícitas para analizar y generar oraciones—funcionaba para casos simples pero se desmoronaba catastróficamente en texto real. El lenguaje era demasiado ambiguo, demasiado dependiente del contexto, demasiado *vivo* para que reglas rígidas lo capturaran.

### TA Basada en Reglas y Transferencia (1970s–1980s)

La investigación continuó, más silenciosamente, a través de los años 70 y 80. Sistemas como SYSTRAN (que potenciaba los servicios de traducción tempranos de la Comisión Europea) utilizaban diccionarios grandes hechos a mano y reglas de transferencia para mapear entre pares de lenguajes. Estos sistemas podían producir traducciones útiles aproximadas para dominios restringidos, pero requerían un esfuerzo de ingeniería enorme para cada par de lenguajes, y rara vez manejaban texto sin restricciones con elegancia.

El problema fundamental era claro: el lenguaje no es un cifrado. No puedes traducir buscando palabras en un diccionario y reorganizándolas según reglas gramaticales, porque el significado depende del contexto, del conocimiento del mundo, de la intención del hablante, de toda la historia de una conversación. El enfoque de interlingua—traducir a través de una representación abstracta e independiente del lenguaje—era teóricamente elegante pero prácticamente imposible. Nadie podía definir la interlingua.

### La Revolución Estadística (1990s)

El avance vino no de mejores reglas sino de mejores datos. A finales de los años 80 y principios de los 90, investigadores en IBM (Peter Brown, Stephen Della Pietra, Vincent Della Pietra, y Robert Mercer) desarrollaron una serie de modelos estadísticos para traducción automática—los famosos Modelos IBM 1 a 5.

La perspectiva clave fue la vieja idea de Weaver, finalmente hecha rigurosa: traducción como decodificación. Dado un enunciado extranjero *f*, encuentra el enunciado inglés *e* que maximiza P(e|f). Por el teorema de Bayes, esto es equivalente a maximizar P(f|e) × P(e)—un *modelo de traducción* (¿qué tan probable es este enunciado extranjero dado este inglés?) multiplicado por un *modelo de lenguaje* (¿qué tan probable es este enunciado inglés por sí solo?).

Los modelos IBM aprendieron estas probabilidades de grandes *corpus paralelos*—colecciones de textos que existían en ambos lenguajes (como los Hansards parlamentarios canadienses, que fueron publicados en inglés y francés). No se requerían reglas hechas a mano. El sistema aprendió a traducir observando millones de ejemplos de traducción humana.

La TA estadística funcionó dramáticamente mejor que la TA basada en reglas para lenguajes con datos paralelos abundantes. También introdujo una pieza crítica de infraestructura: la **puntuación BLEU** (Papineni et al., 2002), una métrica para evaluar automáticamente la calidad de la traducción comparando la salida de máquinas con traducciones de referencia humanas. BLEU hizo posible medir el progreso cuantitativamente y ejecutar experimentos a gran escala.

Pero la TA estadística tenía un supuesto fatal incorporado: requería *corpus paralelos*. Para los pares de lenguajes principales del mundo—inglés-francés, inglés-chino, inglés-español—los datos paralelos eran abundantes. Para la gran mayoría de los 7.000 lenguajes del mundo, simplemente no existían.

### La Revolución Neural: Seq2Seq, Atención, Transformers (2014–2017)

La siguiente transformación vino con el aprendizaje profundo. En 2014, Ilya Sutskever, Oriol Vinyals, y Quoc Le demostraron modelos de *secuencia a secuencia* (seq2seq) para TA: redes neuronales que podían leer una oración completa en un lenguaje y generar una traducción en otro, sin ningún alineamiento explícito o tablas de frases.

En 2015, Dzmitry Bahdanau, Kyunghyun Cho, y Yoshua Bengio introdujeron el *mecanismo de atención*—permitiendo al decodificador "mirar hacia atrás" a diferentes partes de la oración fuente mientras generaba cada palabra de la traducción. Esto mejoró dramáticamente el desempeño en oraciones largas.

Y en 2017, Vaswani et al. en Google publicaron "Attention Is All You Need," introduciendo la arquitectura *Transformer*. El Transformer prescindió de la recurrencia completamente, procesando secuencias completas en paralelo usando auto-atención. Era más rápido de entrenar, más fácil de escalar, y producía mejores traducciones que cualquier cosa que hubiera venido antes.

Los Transformers condujeron directamente a los grandes modelos de lenguaje (LLMs) de los años 2020: GPT, BERT, PaLM, LLaMA, y sus descendientes. Estos modelos, entrenados en vastas cantidades de texto de internet, pueden traducir entre cientos de pares de lenguajes con fluidez notable.

Pero "fluidez notable" no es lo mismo que "precisión confiable." Y para los lenguajes de bajo recurso del mundo, la situación es mucho peor de lo que parece.

---

## V. La Otra Historia: Lenguaje, Poder, y Genocidio Cultural

Las cuatro secciones anteriores cuentan la historia de las ideas—de gramáticos, matemáticos, e ingenieros construyendo hacia la traducción automática. Pero hay otra historia, corriendo en paralelo, que explica *por qué* los lenguajes que más necesitan tecnología de traducción son precisamente aquellos para los cuales no existe. Esta no es una historia sobre escasez de datos como un hecho neutral. Es una historia sobre destrucción deliberada.

La razón por la que Plains Cree no tiene soporte de traducción automática no es principalmente porque el cree sea un lenguaje difícil para las computadoras (aunque lo es). Es porque, durante más de un siglo, los gobiernos de Canadá y los Estados Unidos ejecutaron programas sistemáticos para erradicar lenguajes indígenas de las bocas de los niños. La "escasez de datos" que hace que la TA de bajo recurso sea tan difícil es, en gran parte, la *consecuencia descendente del genocidio cultural*. Cualquier cuenta honesta de por qué estos lenguajes necesitan tecnología debe enfrentar por qué fueron llevados al borde de la extinción en primer lugar.

### Antes del Contacto: Un Continente de Lenguajes

La diversidad lingüística de las Américas precontacto era asombrosa. En el momento del contacto europeo, América del Norte sola era hogar de un estimado de 300 a 600 lenguajes distintos, organizados en docenas de familias lingüísticas no relacionadas—más diversidad genética que en toda Europa. América del Sur puede haber tenido 1.500 o más (Campbell, 1997). Australia tenía más de 250 lenguajes. Las Islas del Pacífico, el África subsahariana, y el sudeste asiático continental eran similarmente diversos.

Estos no eran lenguajes "primitivos" o "simples." Muchos de los lenguajes más complejos estructuralmente jamás documentados son indígenas. La morfología polisintética de los lenguajes algonquinos (incluyendo cree, ojibwe, y blackfoot), los sistemas tonales del navajo, el marcado de evidencialidad elaborado del quechua, los consonantes de clic de los lenguajes khoisan—estos representan el rango completo de lo que el lenguaje humano puede ser. Codifican sistemas sofisticados de conocimiento sobre parentesco, ecología, ley, espiritualidad, e historia. Cada lenguaje es una biblioteca—un registro irreemplazable de la forma en que una comunidad entiende y organiza el mundo.

Edward Sapir reconoció esto claramente. Escribiendo en 1921, observó que "cuando se trata de forma lingüística, Platón camina con el porquerizo macedonio, Confucio con el salvaje cazador de cabezas de Assam." Los lenguajes de los pueblos indígenas no eran menores. Eran diferentes—y sus diferencias contenían conocimiento que ningún otro lenguaje poseía.

### La Mecánica de la Muerte del Lenguaje

Los lenguajes no mueren de causas naturales. Mueren cuando las condiciones para su transmisión se interrumpen—cuando los niños dejan de aprenderlos, cuando los hablantes son castigados por usarlos, cuando los incentivos sociales y económicos cambian de modo que hablar el lenguaje dominante se convierte en una condición de supervivencia.

Esta interrupción puede ocurrir gradualmente, a través de presión económica y demográfica. Pero en todo el mundo colonial, fue abrumadoramente *deliberada*. La supresión de lenguajes indígenas no fue un efecto secundario de la colonización. Fue un objetivo de política declarado.

### Canadá: El Sistema de Escuelas Residenciales (1831–1996)

En Canadá, el sistema de Escuelas Residenciales Indias operó durante más de 160 años, con el objetivo explícito de eliminar lenguajes y culturas indígenas. Se estima que 150.000 niños de Primeras Naciones, Métis, e Inuit fueron removidos de sus familias y comunidades y colocados en escuelas internadas financiadas por el gobierno y operadas por iglesias.

La política central fue articulada con claridad escalofriante por Duncan Campbell Scott, el Superintendente General Adjunto de Asuntos Indios, en 1920: "Quiero deshacerme del problema indio... Nuestro objetivo es continuar hasta que no haya un solo indio en Canadá que no haya sido absorbido en el cuerpo político y no haya pregunta india y no haya Departamento Indio."

El mecanismo fue el lenguaje. A los niños se les prohibió hablar sus lenguas maternas. Los castigos por hablar un lenguaje indígena iban desde palizas hasta confinamiento solitario hasta tener agujas empujadas a través de sus lenguas. Los niños llegaban hablando cree, ojibwe, inuktitut, dene, haida, o cualquiera de docenas de otros lenguajes. Eran castigados hasta que dejaban de hacerlo.

La Comisión de Verdad y Reconciliación de Canadá (2015) documentó la naturaleza sistemática de este asalto. Su informe final concluyó que el sistema de escuelas residenciales constituía *genocidio cultural*—la destrucción de las estructuras y prácticas que permiten a un grupo continuar como grupo. El lenguaje fue el objetivo principal. Sin lenguaje, la ceremonia se interrumpe, la historia oral se quiebra, los sistemas de parentesco se vuelven ininteligibles, y la transmisión intergeneracional de conocimiento cesa.

La última escuela residencial operada federalmente en Canadá cerró en 1996. Muchos de los Ancianos que son los últimos hablantes fluidos de sus lenguajes hoy son sobrevivientes de escuelas residenciales. Su fluidez no es meramente un recurso lingüístico. Es un acto de resistencia.

### Los Estados Unidos: Escuelas Internadas Indias (1860s–1960s)

Los Estados Unidos operaron un sistema paralelo. El Capitán Richard Henry Pratt, fundador de la Escuela Industrial India de Carlisle en 1879, acuñó la frase que definió la era: "Mata al indio, salva al hombre." Más de 350 escuelas internadas financiadas por el gobierno operaron en los Estados Unidos, con políticas casi idénticas a las de Canadá. A los niños indígenas se les prohibió hablar sus lenguajes, se les obligó a adoptar nombres en inglés, y fueron sometidos a borrado cultural sistemático.

Un informe de 2022 del Departamento del Interior de los EE.UU. identificó más de 400 escuelas internadas indias federales en 37 estados, documentando las muertes de al menos 500 niños en el sistema—un número que el informe reconoció era casi con certeza un recuento significativamente bajo. La investigación encontró que el sistema fue diseñado no meramente para educar sino para "asimilar culturalmente a los niños indios mediante su reubicación forzada de sus familias y comunidades."

Las consecuencias lingüísticas fueron catastróficas. De los aproximadamente 300 lenguajes indígenas hablados en el territorio que se convirtió en los Estados Unidos, más de la mitad ahora están extintos. De aquellos que sobreviven, la mayoría tiene menos de 1.000 hablantes fluidos, y muchos tienen menos de 10. El Proyecto de Lenguajes en Peligro clasifica la mayoría de los lenguajes nativos americanos sobrevivientes como "severamente" o "críticamente" en peligro.

### Australia: Las Generaciones Robadas (1910–1970)

En Australia, las políticas gubernamentales entre 1910 y 1970 removieron forzadamente a niños aborígenes y de las Islas del Estrecho de Torres de sus familias. Estos niños—conocidos como las Generaciones Robadas—fueron colocados en misiones, reservas, y familias blancas de acogida. El objetivo explícito era la asimilación: criar la identidad aborigen dentro de algunas generaciones.

Los lenguajes aborígenes fueron suprimidos en misiones e instituciones gubernamentales. A los niños que hablaban sus lenguajes se les castigaba. El informe Bringing Them Home (1997), producido por la Comisión Australiana de Derechos Humanos, documentó la naturaleza sistemática de estas remociones y sus efectos devastadores en el lenguaje, la cultura, y la familia.

De los estimados 250 lenguajes aborígenes australianos hablados en el momento del contacto europeo, menos de 20 están siendo transmitidos a los niños hoy (Marmion et al., 2014). Más de 100 están completamente extintos. Los lenguajes restantes sobreviven en gran parte a través de los esfuerzos de hablantes ancianos trabajando con lingüistas y organizaciones comunitarias en una carrera contra el tiempo.

### Escandinavia: Los Lenguajes Sámi

La supresión de lenguajes indígenas no se limitó a estados coloniales de asentamiento en el hemisferio sur. En Noruega, Suecia, y Finlandia, los niños sámi fueron sometidos a sistemas de escuelas internadas (*internatskoler*) desde mediados del siglo XIX hasta los años 60. Los lenguajes sámi fueron prohibidos en las escuelas; a los niños se les castigaba por hablarlos. La política de "Norwegianización" (*fornorskingspolitikk*) de Noruega explícitamente apuntaba a eliminar el lenguaje sámi y reemplazarlo con noruego.

De los nueve lenguajes sámi sobrevivientes, varios tienen menos de 500 hablantes. El sámi ume tiene aproximadamente 20. El sámi pite tiene menos de 30. Los lenguajes sobreviven en parte gracias a programas de revitalización que comenzaron en los años 70, incluyendo el establecimiento de escuelas de lenguaje sámi y medios—programas que llegaron justo a tiempo para algunos dialectos y demasiado tarde para otros.

### Aotearoa Nueva Zelanda: Te Reo Māori

El lenguaje māori (te reo māori) fue el lenguaje mayoritario de Aotearoa hasta mediados del siglo XX. Las políticas de educación colonial británica, comenzando en los años 1860, marginalizaron progresivamente te reo en las escuelas. Para los años 70, menos del 20% de los māori eran hablantes fluidos, y el lenguaje estaba en riesgo de extinción dentro de una generación.

La respuesta māori fue uno de los primeros y más exitosos movimientos de revitalización de lenguaje en el mundo. Kōhanga reo (nidos de lenguaje) para niños en edad preescolar, establecidos en 1982, sumergieron a bebés y niños pequeños en te reo desde el nacimiento. Kura kaupapa māori (escuelas de lenguaje māori) siguieron. Estos programas, junto con la Ley de Lenguaje Māori de 1987 (que hizo te reo un lenguaje oficial), han estabilizado el lenguaje—aunque los hablantes fluidos siguen constituyendo una minoría de la población māori.

Nueva Zelanda también produjo uno de los marcos más importantes para la gobernanza de datos indígenas: *Te Mana Raraunga*, la Red de Soberanía de Datos Māori. Este marco afirma que los datos māori—incluyendo datos lingüísticos—es un taonga (tesoro) sujeto a los derechos y responsabilidades de kaitiakitanga (guardianía). Informó directamente el desarrollo de los principios CARE para la gobernanza de datos indígenas y es una referencia fundamental para los mecanismos de soberanía de datos en champollion.

### El Patrón: El Lenguaje como Objetivo del Poder Colonial

Los detalles geográficos y culturales difieren, pero el patrón es notablemente consistente. En Canadá, los Estados Unidos, Australia, Escandinavia, y Nueva Zelanda—y en muchos otros lugares, desde Taiwán hasta Siberia hasta las tierras altas andinas—los estados coloniales y poscoloniales identificaron lenguajes indígenas como obstáculos para la asimilación y los dirigieron para su eliminación. Las herramientas eran similares en todas partes: remover niños de sus familias, prohibir el uso de lenguajes indígenas, castigar transgresiones, y recompensar la adopción del lenguaje colonial.

Esto no fue una nota al pie histórica. La última escuela residencial en Canadá cerró en *1996*. La última escuela internada india en los Estados Unidos cerró en los *años 60*. Muchas de las personas que sobrevivieron estos sistemas todavía están vivas. El trauma es intergeneracional. Y el daño lingüístico es continuo: los lenguajes que perdieron una generación de hablantes en la era de escuelas residenciales ahora están perdiendo sus últimos Ancianos fluidos.

### Del Genocidio Cultural a la "Escasez de Datos"

Esta historia es directamente relevante para el problema técnico de la traducción automática. Cuando los informáticos describen un lenguaje como "de bajo recurso," típicamente significan: hay pocos textos digitales, pocos corpus paralelos, pocos diccionarios, y pocos conjuntos de datos anotados. El encuadre es neutral, como si la escasez de datos fuera un acto de la naturaleza, como un desierto con poca lluvia.

No lo es. La "escasez de datos" de los lenguajes indígenas es la *consecuencia descendente* de políticas de supresión lingüística. Los lenguajes que fueron prohibidos en las escuelas produjeron menos textos escritos. Los lenguajes cuyos hablantes fueron castigados por hablarlos desarrollaron menos usos institucionales. Los lenguajes que perdieron una generación de transmisión produjeron menos hablantes bilingües que pudieran crear corpus paralelos.

La tubería del genocidio cultural a la escasez de datos es directa:

1. **Supresión** → Los niños son castigados por hablar el lenguaje
2. **Transmisión interrumpida** → Menos niños aprenden el lenguaje
3. **Base de hablantes reducida** → Menos adultos lo usan en la vida diaria
4. **Uso institucional reducido** → Menos documentos escritos, menos textos digitales
5. **Escasez de datos** → Los modelos de ML no tienen nada en qué entrenar
6. **Sin soporte de TA** → El lenguaje es invisible para la tecnología
7. **Declive acelerado** → La tecnología refuerza la marginalización que la política comenzó

Esta tubería significa que cualquier proyecto de tecnología que trabaje con lenguajes indígenas hereda un contexto político y moral, lo reconozca o no. Un sistema de traducción automática que trata datos de lenguaje cree como material bruto a ser ingerido por modelos es, sin embargo inadvertidamente, continuando la dinámica extractiva que comenzó con las escuelas residenciales. Los datos fueron escasos por violencia. Los hablantes que crearon los datos que existen lo hicieron contra probabilidades enormes. Cualquier sistema que use esos datos sin el control significativo de la comunidad está agravando el daño original.

### La Complicidad de las Ciencias e Ideología Occidental

Es crítico reconocer que la ciencia y la tecnología no fueron espectadores inocentes del proyecto colonial; fueron participantes activos. La ideología de la "Ilustración" que buscaba categorizar, cuantificar, y estandarizar el mundo a menudo trataba a los pueblos indígenas y sus lenguajes meramente como sujetos de investigación o curiosidades para una "antropología de salvamento." Esta práctica extractiva encerró el conocimiento en universidades occidentales mientras hacía poco para detener la maquinaria política que destruía esas comunidades.

Este proyecto contrasta marcadamente con metodologías como el estudio de sífilis de Tuskegee o la antropología lingüística extractiva, que tratan a personas BIPOC como sujetos experimentales o proveedores pasivos de datos brutos. No estamos aquí para experimentar con pueblos indígenas, extraer su conocimiento, o forzar una ideología occidental culturalmente monolítica sobre ellos. Nuestro objetivo es facilitar sus *propias* formas de conocer y sus *propios* estándares de valor. Proporcionamos la infraestructura; las comunidades lingüísticas construyen los conjuntos de prueba, definen las métricas, y mantienen la participación. Sin su participación, nada de esto funciona.

### Por Qué Esta Historia Forma Nuestro Diseño

Esta es la razón por la que el modelo de gobernanza de champollion no es una característica—es la fundación. Cada decisión de diseño importante en el proyecto es una *respuesta directa* a la historia descrita arriba. El objetivo es la soberanía de datos: apoyar a las comunidades en sostener, revitalizar, y gobernar sus lenguajes vivos enteramente en sus propios términos.

**Por qué los datos de prueba están encriptados y mantenidos por fideicomisos comunitarios.** Porque los datos lingüísticos indígenas han sido extraídos, publicados, y explotados sin consentimiento durante más de un siglo. La lingüística misionera, como los esfuerzos del Instituto Lingüístico de Verano (SIL), históricamente monopolizó corpus paralelos indígenas bajo un marco extractivo y asimilacionista. Además, a diferencia de muchos proyectos modernos de PNL que dependen fuertemente de Biblias traducidas como su corpus paralelo principal para lenguajes de bajo recurso, explícitamente no usamos Biblias traducidas como corpus. El conjunto de prueba encriptado, con claves mantenidas solo por la organización de gobernanza de la comunidad, es un mecanismo técnico que hace *arquitectónicamente imposible* repetir patrones extractivos.

**Por qué usamos ejecución en sandbox en lugar de conjuntos de prueba abiertos.** Porque una vez que los datos lingüísticos se publican abiertamente, la comunidad pierde el control sobre ellos permanentemente. Los puntos de referencia de ML convencionales publican sus conjuntos de prueba—cualquiera puede descargarlos, entrenar con ellos, o usarlos para cualquier propósito. Este raspado de datos de IA moderno representa una nueva forma de "colonialismo de datos" y "cercamiento digital." Para comunidades cuyos lenguajes fueron casi erradicados por la fuerza, perder el control sobre sus recursos lingüísticos restantes no es una inconveniencia menor. Es una continuación directa de la expropiación territorial histórica. La ejecución en sandbox asegura que los datos de la comunidad nunca dejen su infraestructura.

**Por qué la propiedad del método se transfiere a la comunidad.** Porque la historia de "ayudar" a comunidades indígenas es, abrumadoramente, una historia de forasteros construyendo cosas *sobre* pueblos indígenas en lugar de *para* o *con* ellos. Los artículos académicos se publican, las subvenciones se cobran, las carreras avanzan—y la comunidad se queda sin nada. El mecanismo de transferencia de propiedad asegura que cuando un ingeniero de ML construye un método de traducción funcional para Plains Cree, la comunidad Plains Cree *posee ese método*. El ingeniero mantiene crédito y atribución. La comunidad mantiene el activo.

**Por qué cualquier cosa que un método de propiedad comunitaria gane pertenece enteramente a la comunidad.** Porque la revitalización del lenguaje es cara, y las comunidades que hacen el trabajo más difícil—los Ancianos enseñando, los padres enviando niños a escuelas de inmersión, los activistas ejecutando nidos de lenguaje—están crónicamente subfinanciados. Además, la infraestructura de IA que usamos (p. ej., centros de datos, minería de minerales, uso de agua) exige un costo material desproporcionado en tierras indígenas globalmente. Champollion es un proyecto no comercial y no reclama nada sobre él: si un método de traducción cree alguna vez genera valor, ese valor debería financiar programas de lenguaje cree. La tecnología debería ser una herramienta que sirva a las comunidades, no un mecanismo que extraiga valor de ellas.

**Por qué decimos "aspirante a la soberanía" en lugar de afirmar cumplimiento.** Los marcos indígenas de soberanía de datos fueron desarrollados por pueblos específicos para contextos específicos: los principios de soberanía de datos de las Primeras Naciones en Canadá, CARE (Beneficio Colectivo, Autoridad para Controlar, Responsabilidad, Ética), Te Mana Raraunga (Soberanía de Datos Maorí) y los principios FAIR abordan estas preocupaciones desde diferentes posiciones culturales y legales. No afirmamos implementar ninguno de ellos en su totalidad; esa determinación corresponde a las comunidades que los crearon. Decimos que nuestro diseño es *aspirante a la soberanía*: está construido para que las comunidades *puedan* ejercer la propiedad, el control, el acceso y la posesión de sus datos y de las tecnologías derivadas de ellos. La arquitectura avanza hacia la soberanía; si logra la soberanía es algo que deben decidir las comunidades. Tratamos esto como un trabajo inacabado, agradecemos las objeciones y actuaremos en consecuencia.

**Por qué la plataforma compara *métodos*, no *modelos*.** Porque las comunidades de lenguajes indígenas no deberían ser dependientes de ningún modelo de una sola corporación. La arquitectura abierta de un "método" significa que la solución ni siquiera tiene que ser un LLM costoso y pesado en materiales. Podría ser un sistema altamente eficiente basado en reglas alojado en la comunidad ejecutándose en hardware de computación tradicional. Si el mejor método de traducción para cree hoy usa Gemini de Google, la comunidad debería poder cambiar a una alternativa de código abierto o determinista mañana sin reconstruir todo. La comparación a nivel de método asegura que el activo de la comunidad es una *receta*, no una dependencia.

**Por qué la comunidad debe construir esta infraestructura ahora.** La paradoja de aprovechar la IA mientras se critica su extracción de materiales se resuelve por una realidad estratégica dura: si este problema no es resuelto por la comunidad en sus propios términos soberanos, inevitablemente será "resuelto" por otros en términos extractivos. Incluso si una corporación masiva eventualmente construye un modelo de traducción para un lenguaje indígena dado, la comunidad requiere su propia infraestructura de comparación independiente y en sandbox para verificar *cuándo* e *si* realmente han tenido éxito según estándares comunitarios—y para asegurar que la comunidad capture el valor de ese éxito.

Esto no es política pernada a la tecnología. Es tecnología diseñada por personas que entienden la historia.

---

## VI. El Momento Actual: 6.800 Lenguajes Dejados Atrás

### La Escala del Problema

De los aproximadamente 7000 idiomas vivos que se hablan en la Tierra hoy en día, solo alrededor de 550 cuentan con traducción automática de algún tipo, y apenas 200 son atendidos por un servicio comercial implementado ([cómo contamos](/docs/network/context/coverage-counting)). El resto son invisibles para la tecnología, no porque sean menos valiosos, sino porque los enfoques estadísticos y neuronales que dominan la MT moderna están fundamentalmente *ávidos de datos*. Requieren millones de oraciones paralelas de las cuales aprender. Para la mayoría de los idiomas del mundo, esas oraciones no existen.

Los lenguajes más afectados son precisamente aquellos más en peligro: lenguajes indígenas, lenguajes minoritarios, tradiciones orales con registros escritos limitados. Son los lenguajes cuyos hablantes a menudo son ancianos, cuyas comunidades son pequeñas, cuyo poder político es mínimo. Son los lenguajes que más necesitan apoyo tecnológico para preservación y revitalización—y son los lenguajes para los cuales la tecnología existente es menos útil.

### El Desafío Polisintético

El problema no es meramente uno de escasez de datos. Muchos de los lenguajes más en peligro del mundo son *polisintéticos*—tienen sistemas morfológicos de complejidad extraordinaria que fundamentalmente rompen los supuestos de la PNL estándar.

Considere Plains Cree (nêhiyawêwin), un lenguaje algonquino hablado en las praderas canadienses. Un solo verbo cree puede codificar información que el inglés esparciría en una cláusula completa: el sujeto, el objeto, el tiempo, el aspecto, la evidencialidad, la modalidad, y varias otras categorías gramaticales, todo empacado en una sola palabra a través de un sistema de prefijos, sufijos, y modificaciones internas.

Esto crea varios problemas para los enfoques de TA estándar:

1. **Fallo de tokenización.** Los tokenizadores de subpalabra como BPE (Codificación de Pares de Bytes), diseñados para lenguajes analíticos como el inglés, destrozan palabras polisintéticas en fragmentos sin sentido. La estructura morfológica se destruye antes de que el modelo la vea. BPE no es neutral; representa una epistemología puramente empirista y de nivel superficial que fundamentalmente choca con las jerarquías morfológicas profundas y basadas en reglas inherentes a los lenguajes polisintéticos. Es un sesgo arquitectónico que activamente desmantel la morfología estructural.

2. **Explosión combinatoria.** Un lenguaje polisintético puede tener millones de formas de palabras posibles para una sola raíz verbal. Ningún corpus de entrenamiento, sin importar cuán grande, puede contener más que una fracción minúscula de ellas. Los modelos neurales no tienen forma de *generalizar* a formas no vistas.

3. **Alucinación.** Los grandes modelos de lenguaje, cuando se les pide traducir a lenguajes polisintéticos, a menudo generan formas morfológicamente inválidas—palabras que ningún hablante nativo jamás produciría. El modelo ha aprendido patrones estadísticos de datos limitados pero no tiene comprensión de las reglas morfológicas del lenguaje.

### Transductores de Estados Finitos: El Puente

Hay, sin embargo, una tecnología que *sí* maneja bien la complejidad morfológica: el **Transductor de Estados Finitos** (FST). Un FST es un dispositivo computacional formal que mapea entre una cadena de entrada y una cadena de salida a través de una serie de transiciones de estado. Para análisis morfológico, un FST puede mapear una forma de palabra superficial a su estructura morfológica subyacente (y viceversa), manejando la complejidad combinatoria completa de la morfología del lenguaje.

Los FSTs son los descendientes directos de las reglas de reescritura de Pāṇini. Son las gramáticas de Tipo 3 (regulares) de Chomsky en forma computacional. Son la encarnación viviente de la conexión entre lingüística formal y computación.

Al emparejar FSTs con LLMs, `champollion` ejecuta una síntesis filosófica crucial: reconcilia la tradición estructural *racionalista* (reglas) con el paradigma estadístico *empirista* (probabilidad) para contrarrestar los sesgos hambrientos de datos y mayoritarios de la IA moderna.

Para lenguajes polisintéticos, los FSTs pueden proporcionar algo que los modelos neurales no pueden: *verificación determinista*. Dada una forma de palabra, un FST puede decir definitivamente si es una forma válida en el lenguaje—no probabilísticamente, no "esto se ve bien," sino *sí* o *no*. Esta es la respuesta a la consulta central que acecha la TA neural para lenguajes de bajo recurso: *¿Cómo verificas que una palabra generada es real sin un humano en el bucle?*

La respuesta técnica es: usas la gramática formal. Usas las mismas herramientas que Pāṇini inventó hace veinticinco siglos, codificadas en el formalismo computacional que Turing y Chomsky hicieron riguroso.

Sin embargo, debemos reconocer que este poder determinista conlleva sus propios riesgos. Imponer una validación "sí" o "no" sobre un lenguaje oral y fluido arriesga imponer una Ideología de Lenguaje Estándar rígida. Cuando un FST dicta qué es "correcto," puede inadvertidamente recapitular la misma normatividadcolonial que fue diseñado para evadir—aplanando variación dialectal, castigando cambio de código, e imponiendo una gramática singular y normalizada sobre una comunidad diversa. Porque los FSTs representan solo una métrica de corrección formal, su empirismo rígido debe ser templado. Esta es precisamente la razón por la que la comunidad debe sostener la pluma. La comunidad establece el estándar, construye las reglas, y define qué acepta la máquina como válido, ingenierizando FSTs que creen espacio para fluidez oral y dialectos regionales. La gramática formal no es una verdad universal entregada por informáticos; es una infraestructura operada por los hablantes mismos.

### champollion: Donde los Hilos Convergen

Aquí es donde el proyecto champollion entra en la historia. Se sienta en el punto exacto de convergencia de todos los hilos que hemos trazado:

- **De Pāṇini**: El principio de que el lenguaje puede ser descrito por reglas formales y generativas.
- **De Schleicher y Sapir**: La comprensión de que los lenguajes del mundo son diversos, estructurados, y a menudo en peligro.
- **De las escuelas residenciales y su secuela**: La comprensión de que la "escasez de datos" no es un hecho técnico neutral sino la consecuencia de supresión lingüística deliberada—y que cualquier tecnología que toque estos lenguajes debe ser construida con soberanía en la fundación.
- **De Chomsky**: La jerarquía formal de gramáticas que conecta la lingüística con la computación.
- **De Shannon**: El marco matemático para entender comunicación, ruido, y señal.
- **De Turing y von Neumann**: Las máquinas universales que pueden ejecutar cualquier función computable.
- **De Weaver y los Modelos IBM**: La perspectiva de que la traducción puede ser tratada como un problema estadístico.
- **De la revolución Transformer**: Los poderosos modelos neurales que pueden traducir—pero solo cuando tienen suficientes datos.
- **De la tradición FST**: Las herramientas formales que pueden manejar complejidad morfológica donde los modelos neurales fallan.
- **De los marcos indígenas de soberanía de datos — CARE, Te Mana Raraunga y sus pares**: Los marcos de gobernanza que aseguran que la tecnología sirva a las comunidades en lugar de extraer de ellas.

champollion es una plataforma diseñada para dirigir la energía competitiva de la comunidad de aprendizaje automático hacia lenguajes que el mercado ha abandonado. Proporciona una infraestructura de comparación donde cualquiera puede enviar un método de traducción—neural, basado en reglas, híbrido, o novedoso—y tenerlo evaluado contra estándares rigurosos. Crucialmente, utiliza validación basada en FST para asegurar que las formas generadas sean morfológicamente válidas, y se basa en la verificación de hablantes nativos como la verdad fundamental última.

La plataforma encarna varios principios que esta historia hace claro:

**Ningún enfoque único es suficiente.** La historia de la TA es una historia de cambios de paradigma—de reglas a estadística a redes neuronales. Cada nuevo paradigma resolvió problemas que el anterior no podía, pero cada uno también tenía puntos ciegos. Para lenguajes polisintéticos de bajo recurso, la respuesta es casi ciertamente *híbrida*: fluidez neural restringida por corrección formal.

**La soberanía de datos no es opcional: es una respuesta estructural al daño histórico.** Como documenta en detalle la Sección V, los idiomas indígenas no tienen simplemente "escasez de datos" por accidente. Se volvieron escasos debido a políticas deliberadas. El diseño aspirante a la soberanía del proyecto —que garantiza que los datos lingüísticos permanezcan bajo el control de las comunidades indígenas, que las claves de descifrado sean custodiadas por fideicomisos comunitarios y que la propiedad de los algoritmos se transfiera a los hablantes— no es una idea de último momento. Es una respuesta directa a siglos de prácticas extractivas, desde la documentación realizada por forasteros en la época de las escuelas residenciales hasta la extracción de conjuntos de datos en la actualidad.

Una versión anterior de este párrafo decía que la arquitectura hace que repetir esos patrones sea *técnicamente imposible*. Esa fue una afirmación exagerada y ha sido retirada. Los mecanismos son reales y específicos —un corpus se cifra en el propio dispositivo del titular antes de que algo salga de él, el descifrado requiere que varios custodios actúen en conjunto en lugar de una sola parte, y el contenido del corpus se obtiene de su fuente en lugar de alojarse aquí—, pero "imposible" no es una propiedad que ninguno de ellos pueda ostentar. El software tiene errores, los operadores cometen equivocaciones y una parte decidida con suficientes roles adecuados es un riesgo residual que ningún diseño elimina. La afirmación honesta es que los caminos fáciles están cerrados y los difíciles dejan evidencia. Lo que este proyecto puede prometer es mecanismo y divulgación, no imposibilidad.

**El juego largo es la revitalización.** La traducción es el *campo de prueba*, pero el verdadero premio es la revitalización del lenguaje a través de la enseñanza. Las gramáticas formales y modelos morfológicos construidos para traducción automática son precisamente las fundaciones técnicas necesarias para el aprendizaje de lenguaje asistido por máquina. Si podemos construir un FST que valide formas verbales cree para un sistema de traducción, también podemos usar ese FST para ayudar a un estudiante a aprender a conjugar verbos cree.

### Por Qué Este Momento

Estamos viviendo en un momento único en la historia de la tecnología de lenguaje. Varios factores han convergido:

1. **Las herramientas de código abierto son maduras.** Los kits de herramientas FST (como HFST y Foma), los marcos de TA neural (como OpenNMT y Fairseq), y la infraestructura de evaluación ahora pueden ser ensamblados por un equipo pequeño a costo mínimo.

2. **La organización comunitaria se está acelerando.** Las comunidades de lenguajes indígenas son cada vez más sofisticadas en su uso de tecnología y su afirmación de soberanía de datos. Organizaciones como la iniciativa First Voices, el Proyecto de Tecnología de Lenguajes Indígenas Canadienses, y numerosos esfuerzos liderados por la comunidad están construyendo la infraestructura humana que la tecnología sola no puede proporcionar.

3. **Las capacidades de IA han alcanzado un umbral.** Los grandes modelos de lenguaje, aunque insuficientes por sí solos para TA de bajo recurso, pueden servir como componentes poderosos en sistemas híbridos—generando traducciones candidatas que luego son verificadas y restringidas por métodos formales.

4. **El costo se ha desplomado.** Lo que habría requerido un laboratorio gubernamental en 1954 o una corporación importante en 2000 ahora puede hacerse con créditos de computación en la nube y software de código abierto. El cuello de botella ya no es la tecnología o el dinero. Es la *voluntad*.

La pregunta no es si la tecnología puede ser construida. Puede. La pregunta es si será construida *correctamente*—con la gobernanza correcta, los incentivos correctos, y el respeto correcto por las comunidades a las que está destinada a servir.

Esa es la pregunta que este proyecto existe para responder.

---

## Referencias

- Bahdanau, D., Cho, K., & Bengio, Y. (2015). Neural Machine Translation by Jointly Learning to Align and Translate. *ICLR*.
- Boole, G. (1854). *An Investigation of the Laws of Thought*. Walton and Maberly.
- Bringing Them Home: Report of the National Inquiry into the Separation of Aboriginal and Torres Strait Islander Children from Their Families. (1997). Australian Human Rights Commission.
- Brown, P., Della Pietra, S., Della Pietra, V., & Mercer, R. (1993). The Mathematics of Statistical Machine Translation. *Computational Linguistics*, 19(2).
- Campbell, L. (1997). *American Indian Languages: The Historical Linguistics of Native America*. Oxford University Press.
- Champollion, J.-F. (1822). *Lettre à M. Dacier relative à l'alphabet des hiéroglyphes phonétiques*.
- Chomsky, N. (1957). *Syntactic Structures*. Mouton.
- Chomsky, N. (1956). Three Models for the Description of Language. *IRE Transactions on Information Theory*, 2(3).
- Huet, G. (2006). Lexicon-directed Segmentation and Tagging of Sanskrit. In *Proceedings of the XIIth World Sanskrit Conference*.
- Jones, W. (1786). The Third Anniversary Discourse. *Asiatick Researches*, 1.
- Kiparsky, P. (1993). Paninian Linguistics. In R. E. Asher (Ed.), *The Encyclopedia of Language and Linguistics*. Pergamon.
- Kircher, A. (1663). *Polygraphia Nova et Universalis*.
- Leibniz, G. W. (1703). Explication de l'Arithmétique Binaire. *Mémoires de l'Académie Royale des Sciences*.
- Llull, R. (c. 1305). *Ars Magna*.
- Lovelace, A. (1843). Notes by the Translator (Note G). In L. F. Menabrea, *Sketch of the Analytical Engine Invented by Charles Babbage*.
- Marmion, D., Obata, K., & Troy, J. (2014). *Community, Identity, Wellbeing: The Report of the Second National Indigenous Languages Survey*. Australian Institute of Aboriginal and Torres Strait Islander Studies.
- National Research Council. (1966). *Language and Machines: Computers in Translation and Linguistics* (ALPAC Report). National Academy of Sciences.
- Papineni, K., Roukos, S., Ward, T., & Zhu, W.-J. (2002). BLEU: A Method for Automatic Evaluation of Machine Translation. *ACL*.
- Saussure, F. de. (1916). *Cours de linguistique générale* (C. Bally & A. Sechehaye, Eds.). Payot.
- Schleicher, A. (1861). *Compendium der vergleichenden Grammatik der indogermanischen Sprachen*.
- Shannon, C. E. (1948). A Mathematical Theory of Communication. *Bell System Technical Journal*, 27(3).
- Shannon, C. E. (1951). Prediction and Entropy of Printed English. *Bell System Technical Journal*, 30(1).
- Sutskever, I., Vinyals, O., & Le, Q. V. (2014). Sequence to Sequence Learning with Neural Networks. *NeurIPS*.
- Truth and Reconciliation Commission of Canada. (2015). *Honouring the Truth, Reconciling for the Future: Summary of the Final Report*. Government of Canada.
- Turing, A. M. (1936). On Computable Numbers, with an Application to the Entscheidungsproblem. *Proceedings of the London Mathematical Society*, 2(42).
- Turing, A. M. (1950). Computing Machinery and Intelligence. *Mind*, 59(236).
- Vaswani, A., et al. (2017). Attention Is All You Need. *NeurIPS*.
- von Neumann, J. (1945). *First Draft of a Report on the EDVAC*. University of Pennsylvania.
- Weaver, W. (1949). Translation. Memorandum, Rockefeller Foundation.
- Wilkins, J. (1668). *An Essay towards a Real Character, and a Philosophical Language*. Royal Society.
- U.S. Department of the Interior. (2022). *Federal Indian Boarding School Initiative Investigative Report*. Bureau of Indian Affairs.

---

*Este documento es parte de la documentación del proyecto champollion. Se publica bajo la misma licencia que el proyecto mismo.*

---

## A dónde conduce esto en este sitio

La historia termina donde comienza este proyecto: la mayoría de los idiomas vivos aún
están fuera de la tecnología. [Qué es Champollion](/docs/what-is-champollion)
expone el plan en cinco minutos, y
[cómo se cuenta la cobertura](/docs/network/context/coverage-counting) muestra
exactamente dónde se sitúa la línea actual.
