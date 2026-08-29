# Traducción Automática: Un Informe de Campo (2013–2026)

*Una historia narrativa para cualquiera que ingrese al panorama de la TA*

---

## Tabla de Contenidos

- [Parte 1: La Revolución Neural (2013–2017)](#parte-1-la-revolución-neural-20132017)
- [Parte 2: El Giro Multilingüe (2018–2022)](#parte-2-el-giro-multilingüe-20182022)
- [Parte 3: La Era de los LLM (2022–2026)](#parte-3-la-era-de-los-llm-20222026)
- [Parte 4: El Problema de los Recursos Limitados](#parte-4-el-problema-de-los-recursos-limitados)
- [Parte 5: Transductores de Estados Finitos y Sistemas Basados en Reglas](#parte-5-transductores-de-estados-finitos-y-sistemas-basados-en-reglas)
- [Parte 6: Medición de Calidad — El Problema de la Evaluación](#parte-6-medición-de-calidad--el-problema-de-la-evaluación)
- [Parte 7: El Panorama Institucional](#parte-7-el-panorama-institucional)
- [Parte 8: Fronteras Abiertas](#parte-8-fronteras-abiertas)
- [Apéndice A: Artículos Clave](#apéndice-a-artículos-clave)
- [Apéndice B: Conferencias y Comunidades](#apéndice-b-conferencias-y-comunidades)
- [Apéndice C: Herramientas, Conjuntos de Datos y Recursos Prácticos](#apéndice-c-herramientas-conjuntos-de-datos-y-recursos-prácticos)
- [Apéndice D: Glosario](#apéndice-d-glosario)

---

## Parte 1: La Revolución Neural (2013–2017)

### El Régimen Anterior: Traducción Automática Estadística

Para entender la revolución que reformó la traducción automática a mediados de los años 2010, primero debe entender qué vino antes — y por qué se rompió.

Desde aproximadamente 2003 hasta 2015, el paradigma dominante en TA fue la **Traducción Automática Estadística (TAE)**, específicamente la **TAE basada en frases**. La idea central era engañosamente simple: en lugar de escribir reglas sobre cómo funciona el lenguaje, se reúnen enormes cantidades de texto paralelo — documentos traducidos por humanos en dos idiomas — y se dejan que algoritmos estadísticos aprendan las correspondencias. El sistema descompondría una oración fuente en frases superpuestas (no frases lingüísticas, sino fragmentos arbitrarios de n-gramas), encontraría traducciones estadísticamente probables para cada fragmento, y luego ensamblaría una oración destino usando un **modelo de lenguaje** que asegurara que la salida fuera fluida.

La herramienta de trabajo de esta era fue **Moses**, un conjunto de herramientas TAE de código abierto desarrollado principalmente en la Universidad de Edimburgo bajo Philipp Koehn, lanzado en 2006. Moses se convirtió en el Linux de la investigación en TA — prácticamente todos los laboratorios de TA académicos del mundo lo utilizaban. Su complemento, **cdec** (desarrollado por Chris Dyer en Carnegie Mellon), ofrecía capacidades similares con un formalismo diferente. Juntas, estas herramientas definieron una década de investigación en TA.

La TAE basada en frases funcionó sorprendentemente bien para pares de idiomas con datos paralelos abundantes y orden de palabras similar — inglés–francés, inglés–español, inglés–alemán. Pero tenía limitaciones estructurales profundas. El sistema no tenía concepto de significado. Era coincidencia de patrones sobre cadenas de superficie, ensamblando traducciones a partir de fragmentos memorizados. Tenía dificultades con dependencias de largo alcance (un pronombre que se refiere a un sustantivo varios párrafos atrás), con reordenamiento entre idiomas tipológicamente diferentes (inglés–japonés, por ejemplo, donde los verbos aparecen en posiciones opuestas), y con cualquier fenómeno que requiriera abstracción genuina sobre la estructura del lenguaje. Cada mejora exigía ingeniería cada vez más compleja: reglas de reordenamiento hechas a mano, características dispersas, modelos de lenguaje masivos. La arquitectura se estaba acercando a su límite.

### El Avance: Secuencia a Secuencia con Atención

La primera grieta en el paradigma de TAE no vino de la comunidad de TA, sino de investigadores de aprendizaje profundo que trabajaban en problemas de modelado de secuencias.

En septiembre de 2014, **Dzmitry Bahdanau, Kyunghyun Cho y Yoshua Bengio** en la Université de Montréal publicaron un artículo que resultaría transformador: ["Neural Machine Translation by Jointly Learning to Align and Translate"](https://arxiv.org/abs/1409.0473) (presentado en ICLR 2015). La innovación clave fue el **mecanismo de atención**.

Para entender por qué esto importaba, necesita el contexto previo. Solo meses antes, Ilya Sutskever, Oriol Vinyals y Quoc V. Le en Google habían publicado ["Sequence to Sequence Learning with Neural Networks"](https://arxiv.org/abs/1409.3215) (NIPS 2014), demostrando que una red neuronal con una arquitectura **codificador–decodificador** podía traducir oraciones. El codificador lee la oración fuente palabra por palabra y la comprime en un único vector de longitud fija — un resumen numérico de toda la entrada. El decodificador luego genera la oración destino palabra por palabra a partir de ese vector.

Esto era elegante pero tenía un defecto crítico: el vector único era un **cuello de botella**. Toda la información en una oración fuente de treinta palabras tenía que ser comprimida en un vector de, digamos, 1.000 números. Las oraciones cortas se traducían razonablemente bien; las oraciones largas se degradaban mal, porque el modelo olvidaba palabras anteriores para cuando terminaba de codificar las posteriores.

El mecanismo de atención de Bahdanau resolvió esto. En lugar de comprimir toda la fuente en un vector, el decodificador podía **mirar hacia atrás** a todos los estados ocultos del codificador — las representaciones intermedias en cada posición fuente — y ponderar dinámicamente qué posiciones eran más relevantes para generar cada palabra destino. Al producir la palabra inglesa "cat", el modelo podía prestar más atención a la palabra francesa "chat" en la fuente, incluso si estaban lejos en la oración. El modelo aprendía a *alinear* palabras fuente y destino como parte del proceso de traducción, en lugar de depender de un único resumen comprimido.

Esta fue la innovación fundamental. La atención no solo mejoró la TA; se convirtió en el mecanismo central de prácticamente todo el progreso posterior en procesamiento del lenguaje natural.

### Google Se Vuelve Neural

Los resultados académicos de 2014–2015 eran impresionantes pero aún no estaban listos para producción. Eso cambió a finales de 2016.

En septiembre de 2016, un gran equipo en Google liderado por **Yonghui Wu** publicó ["Google's Neural Machine Translation System: Bridging the Gap Between Human and Machine Translation"](https://arxiv.org/abs/1609.08144). El sistema, conocido como **GNMT** (Google Neural Machine Translation), era una arquitectura codificador–decodificador a escala industrial con atención, entrenada en los vastos recursos de datos paralelos de Google. El artículo hizo una afirmación sorprendente: en ciertos pares de idiomas, GNMT redujo errores de traducción en 55–85% en comparación con el sistema TAE basado en frases existente de Google.

En noviembre de 2016, Google comenzó a cambiar silenciosamente Google Translate de TAE basada en frases a GNMT para pares de idiomas principales. La transición fue esencialmente completa para pares de alto recurso en 2017. Para los usuarios, el cambio fue dramático. Las traducciones que anteriormente se leían como rígidas, fragmentadas y ocasionalmente sin sentido se volvieron sustancialmente más fluidas — a veces sorprendentemente. La era de "Google Translate gibberish" como chiste estaba terminando.

La respuesta competitiva fue rápida. En agosto de 2017, **DeepL**, fundada por **Gereon Frahling** en Colonia, Alemania, lanzó su servicio de traducción. DeepL había surgido del proyecto de concordancia bilingüe Linguee y se diferenció por la calidad percibida de sus traducciones, particularmente para pares de idiomas europeos, donde rápidamente desarrolló una reputación entre los traductores profesionales por producir resultados más naturales e idiomáticos que Google. El modelo de negocio de DeepL (freemium con una API de pago) y su enfoque en la calidad por encima de la amplitud definirían su posición en el mercado en el futuro. DeepL es compatible con aproximadamente 33 idiomas (muchos menos que los 194 de la lista de Cloud Translation de Google), pero con un posicionamiento que prioriza la calidad.

### El Transformer

Si el mecanismo de atención de Bahdanau fue la fundación, entonces el **Transformer** fue el edificio construido sobre ella — y el edificio era un rascacielos.

En junio de 2017, un equipo de ocho investigadores en Google — **Ashish Vaswani, Noam Shazeer, Niki Parmar, Jakob Uszkoreit, Llion Jones, Aidan N. Gomez, Łukasz Kaiser e Illia Polosukhin** — publicaron ["Attention Is All You Need"](https://arxiv.org/abs/1706.03762) en NIPS 2017. El título no era hipérbole; era una afirmación arquitectónica precisa. Donde los modelos anteriores usaban redes neuronales recurrentes (RNN) como su columna vertebral — procesando palabras secuencialmente, una a la vez, como leer una oración de izquierda a derecha — el Transformer prescindió de la recurrencia por completo y se basó únicamente en atención.

Las innovaciones clave fueron:

1. **Auto-atención**: Cada palabra en una oración atiende a todas las otras palabras en la misma oración, computando relaciones en paralelo en lugar de secuencialmente. Esto captura dependencias de largo alcance sin el cuello de botella de información de las RNN, y — crucialmente — se paraleliza en hardware moderno (GPU y TPU), haciendo el entrenamiento dramáticamente más rápido.

2. **Atención multi-cabeza**: En lugar de computar un único patrón de atención, el modelo computa múltiples patrones de atención simultáneamente ("cabezas"), cada uno potencialmente capturando diferentes tipos de relaciones lingüísticas — sintácticas, semánticas, posicionales.

3. **Codificación posicional**: Dado que la auto-atención procesa todas las palabras simultáneamente (a diferencia de las RNN, que procesan secuencialmente), el modelo no tiene noción inherente del orden de palabras. Las codificaciones posicionales — funciones matemáticas inyectadas en la entrada — proporcionan esta información.

El Transformer no solo superó a los modelos basados en RNN en puntos de referencia de traducción. Entrenó **órdenes de magnitud más rápido** debido a su paralelismo. Esto fue quizás tan importante como la mejora de calidad: los investigadores ahora podían iterar más rápido, entrenar con más datos, y escalar a modelos más grandes. El ciclo virtuoso de escala había comenzado.

Dentro de dos años, la arquitectura Transformer se había convertido en el sustrato para esencialmente todo el trabajo de vanguardia en NLP — no solo TA, sino modelado de lenguaje, clasificación de texto, respuesta a preguntas, resumen, y eventualmente los grandes modelos de lenguaje (GPT, BERT, LLaMA) que reformarían el panorama más amplio de IA. Cada sistema discutido en el resto de este informe se construye sobre el Transformer.

### El Punto de Inflexión de WMT 2016

La **Conferencia sobre Traducción Automática** (WMT), celebrada anualmente como un taller coubicado con conferencias principales de NLP, ejecuta **tareas compartidas** competitivas donde equipos de investigación envían sistemas de TA y se clasifican entre sí en conjuntos de prueba estandarizados. WMT es lo más cercano que tiene el campo de TA a una tabla de clasificación pública.

En **WMT 2016**, los sistemas de TA neural superaron decisivamente a los sistemas de TAE basada en frases en prácticamente todos los pares de idiomas en la tarea compartida. Este fue el momento en que el centro de gravedad del campo se desplazó. Los investigadores que habían pasado carreras construyendo sistemas basados en frases comenzaron a retoolarse para el paradigma neural. Dentro de dos años, las nuevas publicaciones usando TAE basada en frases para algo que no fuera comparación histórica habían cesado esencialmente. Moses, la herramienta que había definido una década, fue funcionalmente retirada.

La transición fue notablemente rápida según los estándares de cambios de paradigma académicos — quizás tres a cuatro años desde el artículo de Bahdanau en 2014 hasta la dominancia casi completa de TA neural en 2018. Para un investigador que ingresa al campo hoy, la TAE basada en frases es contexto histórico, no una dirección de investigación activa. Pero es contexto esencial, porque los supuestos, puntos de referencia y hábitos de evaluación de la era de TAE aún resuenan a través del campo.

---

## Parte 2: El Giro Multilingüe (2018–2022)

### Un Modelo, Muchos Idiomas

La primera generación de sistemas de TA neural fueron **bilingües**: un modelo por par de idiomas. Inglés–francés requería un modelo; francés–inglés requería uno separado. Escalar este enfoque a N idiomas teóricamente requería N×(N−1) modelos — un cuello de botella de ingeniería y datos que efectivamente limitaba la TA neural a un puñado de pares bien dotados de recursos.

La pregunta que definió 2018–2022 fue: *¿puede un único modelo neural aprender a traducir entre muchos idiomas a la vez?* La respuesta resultó ser sí, con consecuencias profundas y complicadas.

### Representaciones Multilingües: mBERT y XLM-R

Antes de que llegaran los modelos de traducción multilingüe, un descubrimiento inesperado en modelos de *comprensión* de lenguaje preparó el escenario.

A finales de 2018, Google lanzó **Multilingual BERT (mBERT)** — un único modelo Transformer entrenado en texto de Wikipedia de 104 idiomas. BERT (Bidirectional Encoder Representations from Transformers) no era un modelo de traducción; era un codificador de propósito general de lenguaje, entrenado para predecir palabras enmascaradas en texto. Lo que sorprendió a los investigadores fue una propiedad emergente: mBERT desarrolló **representaciones multilingües** sin ser explícitamente enseñado que los idiomas estaban relacionados. Si ajustaba mBERT en una tarea de clasificación de sentimientos en inglés y luego lo aplicaba a texto en francés — sin datos de entrenamiento en francés en absoluto — funcionaba notablemente bien. Este fenómeno, llamado **transferencia multilingüe de cero disparos**, sugería que los modelos multilingües estaban aprendiendo algún tipo de espacio representacional compartido entre idiomas.

En 2020, **Alexis Conneau** y colegas en Facebook AI Research (ahora Meta) llevaron esto más lejos con **XLM-R** (Cross-lingual Language Model – RoBERTa). Entrenado en 2,5 terabytes de datos filtrados de CommonCrawl en 100 idiomas, XLM-R superó significativamente a mBERT en puntos de referencia multilingües. Demostró que con suficientes datos y capacidad de modelo, un único codificador podía construir representaciones multilingües robustas.

Estos modelos no eran traductores en sí mismos, pero proporcionaban la fundación conceptual y técnica para TA multilingüe. Si un modelo podía aprender representaciones compartidas en 100 idiomas, entonces un modelo de traducción debería poder traducir entre ellos — al menos en principio.

### Traducción Muchos-a-Muchos: M2M-100

Los sistemas de TA multilingüe tradicionales tenían un secreto sucio: enrutaban la mayoría de traducciones **a través del inglés**. Traducir de portugués a japonés significaba primero traducir portugués a inglés, luego inglés a japonés. Este enfoque "centrado en inglés" era pragmático — la mayoría de datos paralelos involucran inglés en un lado — pero introducía errores compuestos e imponía estructura de idioma inglés en cada traducción.

En octubre de 2020, Facebook AI publicó **M2M-100** (Fan et al., ["Beyond English-Centric Multilingual Machine Translation"](https://arxiv.org/abs/2010.11125), JMLR 2021): un modelo de traducción muchos-a-muchos cubriendo **100 idiomas y 2.200 direcciones de traducción** sin enrutamiento a través del inglés. Este fue un avance conceptual. El modelo podía traducir directamente entre, digamos, bengalí y suajili, usando datos paralelos extraídos de la web para pares sin inglés.

M2M-100 probó que el pivoteo en inglés no era una restricción necesaria de la TA multilingüe. Pero también reveló los límites del enfoque: la calidad era altamente desigual entre pares de idiomas, con algunas direcciones apenas utilizables. La brecha entre "este modelo *cubre* 2.200 direcciones" y "este modelo *funciona bien* en 2.200 direcciones" se convertiría en un tema central.

### NLLB-200: Ningún Idioma Dejado Atrás

El esfuerzo de TA multilingüe más ambicioso de Meta llegó en julio de 2022 con **NLLB-200** (["No Language Left Behind: Scaling Human-Centered Machine Translation"](https://arxiv.org/abs/2207.04672), publicado como un artículo de investigación de Meta AI con más de 200 coautores). El objetivo era explícito en el nombre: construir un único modelo que admita 200 idiomas, con un enfoque particular en idiomas de bajo recurso previamente ignorados por la TA comercial.

Las contribuciones técnicas de NLLB-200 fueron sustanciales:

- **Arquitectura**: Un Transformer denso y una variante de **Mezcla de Expertos (MoE)**, donde diferentes subconjuntos de los parámetros del modelo se activan para diferentes pares de idiomas. La variante más grande, NLLB-200-MoE-54B, tenía 54 mil millones de parámetros. Una versión destilada de 600M parámetros hizo la implementación factible.

- **Extracción de datos**: El equipo desarrolló herramientas automatizadas para extraer oraciones paralelas de rastreos web, incluyendo un modelo de identificación de idioma (cubriendo 200+ idiomas) y un filtro de oraciones paralelas. Este pipeline fue crítico para reunir datos de entrenamiento para idiomas con presencia web mínima.

- **FLORES-200**: Un punto de referencia de evaluación estandarizado cubriendo los 200 idiomas con oraciones traducidas profesionalmente. FLORES-200 se convirtió en una herramienta esencial para el campo — previamente, no existía punto de referencia para la mayoría de estos idiomas.

- **Lanzamiento abierto**: Tanto el modelo como FLORES-200 fueron lanzados abiertamente, permitiendo a investigadores en todo el mundo construir sobre el trabajo.

NLLB-200 fue un hito, pero sus limitaciones son igualmente importantes de entender. La calidad varió enormemente entre idiomas. Para pares bien dotados de recursos (inglés–francés, inglés–chino), el modelo era competente pero no de vanguardia en comparación con sistemas especializados. Para idiomas de bajo recurso, la calidad de salida varió de útil a esencialmente no funcional, dependiendo de cuántos datos de entrenamiento hubieran sido extraídos. El modelo también exhibió la **maldición de la multilingüidad**: agregar más idiomas a un modelo de capacidad fija diluye la calidad de representación para cada idioma. Los idiomas de bajo recurso se benefician del aprendizaje de transferencia (estructura compartida con idiomas relacionados), pero los idiomas de alto recurso pueden realmente *empeorar* a medida que el modelo intenta servir a demasiados maestros. Esto no es meramente un problema de escala — refleja una tensión fundamental en el diseño de modelos multilingües.

### La Suite Seamless

Meta continuó presionando en TA multilingüe con la familia de modelos **Seamless** en 2023–2024. **SeamlessM4T** ("Massively Multilingual and Multimodal Machine Translation", agosto de 2023) fue un único modelo que maneja **traducción de voz a voz, voz a texto, texto a voz y texto a texto** en aproximadamente 100 idiomas (con cobertura variable entre modalidades). Esto representó una convergencia de hilos de investigación previamente separados — reconocimiento automático de voz (ASR), traducción de texto y síntesis de texto a voz (TTS) — en un único sistema multilingüe.

La suite **Seamless Communication** posterior agregó capacidades de transmisión (traducción casi en tiempo real) y traducción de voz expresiva (preservando características vocales como emoción y estilo de habla entre idiomas). Estos sistemas siguen siendo prototipos de investigación en lugar de herramientas listas para producción, pero señalan la dirección del campo: multimodal, multilingüe y en tiempo real.

### Qué Significa "Masivamente Multilingüe" en la Práctica

Para un investigador que ingresa a este campo, es crucial distinguir entre la **cobertura de idiomas** de un modelo y su **calidad de idioma**. Un modelo que "admite 200 idiomas" puede proporcionar excelentes traducciones para 20 de ellos, salida serviceable para 50, y esencialmente texto aleatorio para el resto. El número de titular es engañoso sin evaluación de calidad por idioma.

La **maldición de la multilingüidad** es el término técnico para el problema de dilución de capacidad: un modelo con parámetros finitos no puede representar todos los idiomas igualmente bien. Agregar más idiomas beneficia a los idiomas de más bajo recurso (a través de transferencia multilingüe de idiomas relacionados) pero daña a los de más alto recurso (al consumir capacidad que podría haberse dedicado a ellos). Esto crea una tensión de diseño: ¿construye un modelo universal, o muchos especializados? El campo no ha resuelto esta pregunta.

---

## Parte 3: La Era de los LLM (2022–2026)

### Cuando la IA de Propósito General Aprendió a Traducir

La llegada de grandes modelos de lenguaje (LLM) — GPT-3.5/4, Gemini, Claude, LLaMA — creó una situación extraña en el campo de TA. Estos modelos no fueron entrenados específicamente para traducción. Fueron entrenados para predecir el siguiente token en vastos corpus de texto, principalmente inglés pero cada vez más multilingüe. Sin embargo, cuando se les indicaba con instrucciones como "Traduce la siguiente oración francesa al inglés", producían traducciones que eran, para pares de idiomas de alto recurso, sorprendentemente buenas.

Esto presentó al campo con una pregunta de identidad: si la IA de propósito general puede traducir tan bien como sistemas de traducción construidos específicamente, ¿sigue siendo la "traducción automática" un área de investigación distinta? La respuesta, a partir de 2026, es un sí calificado — pero la relación entre investigación de TA y desarrollo de LLM de propósito general se ha vuelto profundamente entrelazada.

### Los Primeros Puntos de Referencia: LLM vs. TA Dedicada

La evaluación sistemática de LLM para traducción comenzó a principios de 2023, poco después del lanzamiento de ChatGPT (noviembre de 2022) y GPT-4 (marzo de 2023).

**Jiao et al. (2023)**, en ["Is ChatGPT A Good Translator? Yes With GPT-4 As The Engine"](https://arxiv.org/abs/2301.08745), proporcionó una evaluación temprana. Sus hallazgos establecieron un patrón que se ha mantenido notablemente estable: los LLM son **altamente competitivos para pares de idiomas europeos de alto recurso** (inglés–alemán, inglés–francés, inglés–chino) y **significativamente más débiles para pares de bajo recurso y tipológicamente distantes**. También introdujeron **indicación de pivote** — instruir al modelo a traducir a través de un idioma intermedio — que mejoró el desempeño en pares difíciles.

**Hendy et al. (2023)** en Microsoft ([arXiv:2302.09210](https://arxiv.org/abs/2302.09210)) realizaron una evaluación más completa en 18 direcciones de traducción. Su conclusión: los modelos GPT rivalizaban con la TA comercial de vanguardia para pares de alto recurso pero tenían "capacidad limitada" en idiomas de bajo recurso.

Para 2024–2025, la imagen se había afilado. Para **pares de alto recurso**, los mejores LLM (GPT-4o, Gemini 2.5 Pro, Claude 3.5 Sonnet) igualaban o superaban sistemas de TA dedicados, particularmente para tareas que requieren comprensión contextual, expresión idiomática y coherencia a nivel de documento — áreas donde la TA neural tradicional, que procesa oraciones de forma aislada, siempre ha tenido dificultades. Para **pares de bajo recurso**, modelos multilingües dedicados como NLLB-200 y los sistemas de propósito construido de Google Translate aún superan a los LLM, a menudo significativamente.

### BLOOM: El Momento Multilingüe Abierto

En julio de 2022, la colaboración **BigScience** — un esfuerzo de un año de voluntarios coordinados por Hugging Face que involucra a cientos de investigadores globalmente — lanzó **BLOOM**: un modelo de lenguaje multilingüe de código abierto de 176 mil millones de parámetros cubriendo **46 idiomas naturales y 13 lenguajes de programación**. Entrenado en el corpus ROOTS usando la supercomputadora Jean Zay en Francia, BLOOM fue el primer LLM multilingüe masivo de acceso abierto verdadero.

BLOOM no fue un traductor dedicado, pero su significancia para TA fue considerable. Demostró que los modelos de código abierto podían admitir docenas de idiomas a escala, proporcionando una fundación para investigación multilingüe fuera de laboratorios corporativos. Su variante ajustada por instrucciones, **BLOOMZ**, mostró capacidades de generalización multilingüe — ajustada en tareas en un idioma, podía realizarlas en otros.

### LLaMA y la Explosión de Ajuste Fino

La serie **LLaMA** (Large Language Model Meta AI) de Meta, comenzando en febrero de 2023, tomó un camino diferente. LLaMA 1 fue principalmente centrado en inglés, con capacidad multilingüe limitada. LLaMA 2 (julio de 2023) mejoró marginalmente pero aún clasificó el uso no inglés como "fuera de alcance". El punto de inflexión vino con **LLaMA 3** (abril de 2024), que expandió los datos de entrenamiento siete veces e introdujo un vocabulario de 128.000 tokens — mejorando dramáticamente la codificación de texto no inglés. LLaMA 3 oficialmente admitía ocho idiomas (inglés, alemán, francés, italiano, portugués, hindi, español, tailandés) con calidad variable para muchos otros.

La importancia de LLaMA para TA radica menos en su capacidad de traducción directa y más en su papel como **modelo de fundación para ajuste fino**. Ambos LLM de traducción especializados discutidos a continuación — Tower y ALMA — se construyen sobre LLaMA. Los pesos abiertos crearon un ecosistema próspero de derivados especializados.

### LLM de Traducción Construidos a Propósito: Tower y ALMA

El desarrollo más significativo de 2023–2024 fue la emergencia de LLM específicamente ajustados para traducción — sistemas híbridos que heredan la sofisticación contextual de LLM de propósito general pero están optimizados para calidad de traducción.

**ALMA** (Advanced Language Model-based trAnslator), desarrollado por **Haoran Xu** y colegas en la Universidad Johns Hopkins, demostró una idea clave: no necesita corpus paralelos masivos para construir un excelente traductor. ALMA utilizó un enfoque de **ajuste fino en dos etapas** en LLaMA-2: primero, entrenamiento previo continuado en datos monolingües no ingleses para expandir conocimiento multilingüe; luego, ajuste fino en un pequeño conjunto de datos paralelos de alta calidad. El seguimiento, **ALMA-R** (enero de 2024), introdujo **Optimización de Preferencia Contrastiva (CPO)** — entrenar el modelo en datos de preferencia (traducciones mejores vs. peores) en lugar de solo texto paralelo. El resultado: modelos de 7B y 13B parámetros que igualaban o superaban GPT-4 en puntos de referencia de traducción. El artículo fue publicado en ICLR 2024 ([arXiv:2309.11674](https://arxiv.org/abs/2309.11674)). Una versión posterior, **X-ALMA**, expandió la cobertura a 50 idiomas usando módulos adaptadores específicos de idioma enchufables.

**Tower**, desarrollado por **Unbabel** (una empresa portuguesa de IA de traducción) en colaboración con SARDINE Lab y MICS Lab, tomó una vista más amplia. En lugar de optimizar solo para traducción, Tower cubrió el **pipeline de traducción completo**: corrección de fuente, reconocimiento de entidades nombradas, post-edición, clasificación de traducción y detección de errores. Los modelos Tower iniciales (7B y 13B, basados en LLaMA-2) superaron NLLB-200-54B. **Tower v2** (70B, presentado en WMT 2024) superó GPT-4o, Claude 3.5 Sonnet y DeepL. El más reciente **Tower+** (2025) expandió a 22–27 idiomas y abordó el "olvido catastrófico" — la tendencia de los modelos ajustados a perder capacidades generales — a través de optimización de preferencia y aprendizaje por refuerzo.

### Indicación vs. Ajuste Fino: El Debate Continuo

Una pregunta persistente en el espacio LLM-TA es si es mejor **indicar** un LLM de propósito general para traducción (cero disparos o pocos disparos) o **ajustar fino** un modelo específicamente para traducción. La evidencia sugiere que la respuesta depende de la tarea:

- **Indicación** preserva las capacidades generales del LLM — dirección de formalidad, control de estilo, coherencia a nivel de documento — y no requiere entrenamiento adicional. Es ideal para iteración rápida y traducción creativa o contextual.
- **Ajuste fino** produce mayor precisión en pares de idiomas y dominios específicos pero riesga degradar otras capacidades ("olvido catastrófico"). Requiere datos paralelos y computación.
- **Enfoques híbridos** son cada vez más dominantes en la práctica: modelos ajustados para traducción inicial, con pasos de post-edición o auto-refinamiento basados en LLM.

### El Estado Actual del Arte (2025–2026)

La respuesta honesta a "¿cuál es el mejor sistema de TA?" es: **depende**.

| Caso de Uso | Mejor Enfoque | Por Qué |
|---|---|---|
| Alto recurso, alto volumen | TA Neural comercial (Google, DeepL) | Velocidad, costo, consistencia |
| Alto recurso, alta calidad | LLM (GPT-4o, Gemini 2.5 Pro) o Tower+ | Comprensión contextual, manejo de idiomas |
| Bajo recurso, cobertura amplia | Meta OMT, NLLB-200, Google Translate | Cobertura multilingüe construida a propósito |
| Bajo recurso, par específico | NLLB o LLM ajustado fino en datos de dominio | Mejora de calidad dirigida |
| Investigación de código abierto | Tower+, ALMA-R, X-ALMA | Pesos abiertos, reproducible, competitivo |

En marzo de 2026, Meta lanzó **OMT (Omnilingual Machine Translation)** — el sucesor de NLLB-200, extendiendo la cobertura de 200 a **1.600+ idiomas**. OMT aborda lo que Meta llama el "cuello de botella de generación": los grandes modelos de lenguaje pueden entender muchos idiomas pero tienen dificultades para generar texto fluido en ellos. OMT viene en dos arquitecturas — OMT-LLaMA (solo decodificador, 1B–8B parámetros) y OMT-NLLB (codificador-decodificador) — e introduce nuevas herramientas de evaluación incluyendo BOUQuET y BLASER 3 (una métrica de estimación de calidad sin referencia). Los reportes tempranos indican que los modelos de 1B–8B parámetros igualan o superan líneas base de LLM de 70B en tareas de traducción. Si OMT eventualmente incluirá Plains Cree u otros idiomas algonquinos sigue siendo por verse.

El artículo de hallazgos de la tarea compartida de WMT 2024 fue apropiadamente titulado **"The LLM Era Is Here but MT Is Not Solved Yet."** Los LLM han elevado el techo para traducción de alto recurso pero no han resuelto los desafíos fundamentales de TA de bajo recurso, adecuación de evaluación, o complejidad morfológica.

---

## Parte 4: El Problema de los Recursos Limitados

### Por Qué la Mayoría de Idiomas Se Quedan Atrás

De los aproximadamente 7000 idiomas vivos del mundo, los servicios comerciales de traducción automática (MT, por sus siglas en inglés) implementados cubren aproximadamente 200, y todas las formas de traducción automática combinadas alcanzan solo alrededor de 550 ([cómo contamos](/docs/network/context/coverage-counting)). La gran mayoría de los idiomas **no tienen traducción automática en absoluto**. Entender por qué requiere comprender qué necesitan los sistemas de MT y de qué carecen la mayoría de los idiomas.

La TA neural requiere **datos paralelos**: grandes colecciones de oraciones traducidas entre dos idiomas por humanos. Para inglés–francés, estos datos existen en abundancia — procedimientos parlamentarios de la UE (Europarl), documentos de la ONU, archivos de noticias y memorias de traducción comerciales proporcionan cientos de millones de oraciones paralelas. Para un idioma como Plains Cree (*nêhiyawêwin*), hablado por aproximadamente 20.000 personas principalmente en el oeste de Canadá, tales datos esencialmente no existen. No hay procedimientos de la ONU en Plains Cree. No hay corpus de noticias bilingües. El texto paralelo total disponible podría medirse en miles de oraciones en lugar de millones.

El campo utiliza niveles de recurso aproximados para categorizar idiomas:

| Nivel | Datos Paralelos Disponibles | Ejemplos |
|---|---|---|
| Alto recurso | >10 millones de pares de oraciones | Inglés, francés, alemán, chino, español |
| Recurso medio | 1–10 millones de pares | Turco, vietnamita, suajili |
| Bajo recurso | 100K–1 millón de pares | Yoruba, guaraní, maltés |
| Recurso extremadamente bajo | <100K pares | Plains Cree, quechua, la mayoría de idiomas indígenas |
| Esencialmente cero | <10K pares | Miles de idiomas en todo el mundo |

### El Problema del Tokenizador

Antes de que un modelo neural pueda procesar texto, debe convertir caracteres en tokens numéricos — un proceso llamado **tokenización**. El algoritmo de tokenización dominante es **Byte Pair Encoding (BPE)**, popularizado por Sennrich et al. (2016) e implementado en herramientas como **SentencePiece** (Kudo & Richardson, 2018). BPE funciona aprendiendo las secuencias de caracteres más comunes en un corpus de entrenamiento y construyendo un vocabulario de unidades de subpalabra. En inglés, palabras comunes como "the" se convierten en tokens únicos; palabras raras se dividen en piezas de subpalabra ("unforgivable" → "un" + "forgiv" + "able").

El problema es que los vocabularios de BPE se entrenan principalmente en idiomas de alto recurso, con inglés típicamente dominando. Para idiomas de bajo recurso, especialmente aquellos con morfología compleja o escrituras no latinas, las consecuencias son severas:

- **Sobre-segmentación**: Una única palabra en un idioma polisintético como Plains Cree podría codificar una cláusula completa. La palabra *nikî-nipâw* ("dormí") se dividiría en numerosos fragmentos — potencialmente bytes individuales — porque el algoritmo de BPE nunca ha visto estas secuencias de caracteres antes. Lo que es una unidad significativa para un hablante se convierte en una docena de fragmentos sin sentido para el modelo.

- **El problema de la fertilidad**: Una única palabra en un idioma morfológicamente complejo podría requerir 5–15 tokens, mientras que su traducción al inglés usa 1–3. Esto crea una asimetría masiva en longitud de secuencia que degrada la alineación de atención y la calidad de traducción.

- **Penalizaciones de escritura**: Los idiomas que usan escrituras no latinas (silabarios Cree, Etíope, Devanagari) se tokenizaban aún menos eficientemente, a veces cayendo de vuelta a bytes individuales. Esto significa que la ventana de contexto efectiva del modelo es dramáticamente más pequeña para estos idiomas.

Esto no es meramente una inconveniencia técnica. El vocabulario del tokenizador efectivamente codifica un sesgo hacia idiomas bien dotados de recursos en el nivel más fundamental del sistema. Un modelo que gasta 15 tokens codificando una única palabra Cree tiene mucha menos capacidad restante para entender el resto de la oración en comparación con un modelo procesando inglés, donde la misma información podría ocupar 3 tokens.

### El Problema de la Calidad de Datos

Los datos paralelos limitados que existen para idiomas de bajo recurso a menudo provienen de **dominios estrechos**. Las dos fuentes más grandes de texto paralelo multilingüe para idiomas insuficientemente dotados de recursos son:

1. **Traducciones bíblicas**: La Biblia ha sido traducida a más de 700 idiomas, y porciones a más de 3.000. Esto hace que el texto religioso sea el recurso paralelo más disponible para muchos idiomas — pero un modelo entrenado principalmente en texto bíblico aprende un registro específico, vocabulario y dominio. Puede producir "no deberás" pero no puede traducir "por favor reserva un vuelo".

2. **JW300**: Un conjunto de datos extraído de publicaciones de Testigos de Jehová, cubriendo aproximadamente 300 idiomas. Aunque grande y multilingüe, JW300 plantea tanto problemas de sesgo de dominio (contenido religioso) como preocupaciones éticas respecto a la procedencia y consentimiento de las traducciones subyacentes.

**Contaminación de punto de referencia** es otra preocupación seria. Cuando los datos paralelos son escasos, el mismo texto puede terminar en conjuntos de entrenamiento y evaluación — una fuga de datos que infla métricas de calidad. Cuanto más pequeño es el conjunto de datos, más difícil es prevenir y detectar esto.

### Aumento de Datos: Haciendo Más con Menos

Los investigadores han desarrollado técnicas para estirar datos limitados:

- **Retrotraducción** (Sennrich et al., 2016): Entrenar un modelo inicial en datos paralelos disponibles, luego usarlo para traducir **texto monolingüe** de idioma destino de vuelta al idioma fuente. Esto crea datos paralelos sintéticos que son ruidosos pero pueden mejorar significativamente la calidad del modelo. La retrotraducción se ha convertido en una técnica estándar en todo el espectro de recursos.

- **Datos sintéticos generados por LLM**: Usar grandes modelos de lenguaje para generar datos de entrenamiento para pares de bajo recurso. Esto es prometedor pero introduce riesgos — el texto generado puede exhibir "translatés" (patrones anormalmente literales o influenciados por la fuente) y puede amplificar cualquier sesgo que exista en el LLM.

- **Transferencia multilingüe**: Entrenar en datos paralelos de un idioma relacionado de más alto recurso (p. ej., usando datos español–inglés para iniciar TA guaraní–inglés) y esperar que las características estructurales compartidas se transfieran. Esto funciona mejor para idiomas estrechamente relacionados que para aquellos tipológicamente distantes.

- **Segmentación morfológica**: Pre-procesar texto para dividir palabras en morfemas (unidades significativas más pequeñas) antes de alimentarlas al modelo. Para idiomas aglutinantes y polisintéticos, esto puede mejorar dramáticamente la eficiencia de tokenización y la calidad de traducción. Este enfoque se conecta directamente con las herramientas basadas en reglas discutidas en la siguiente sección.

---

## Parte 5: Transductores de Estados Finitos y Sistemas Basados en Reglas

### Por Qué las Reglas Aún Importan

La narrativa hasta ahora ha sido una de dominancia neural: sistemas estadísticos reemplazados por redes neuronales, redes neuronales reemplazadas por Transformers, Transformers escalados en LLM. Pero hay una tradición paralela en lingüística computacional que nunca desapareció — y para ciertos idiomas, sigue siendo indispensable.

Los **sistemas basados en reglas** codifican conocimiento lingüístico explícito: reglas morfológicas, léxicos, patrones de transferencia sintáctica. No aprenden de datos; son construidos por lingüistas que entienden los idiomas involucrados. Para idiomas bien dotados de recursos, este enfoque fue hace mucho tiempo superado por métodos impulsados por datos. Pero para idiomas con morfología compleja y datos mínimos, los sistemas basados en reglas a menudo proporcionan el único análisis confiable disponible.

### Transductores de Estados Finitos: Una Introducción

Un **Transductor de Estados Finitos (FST)** es un dispositivo computacional que mapea entre dos niveles de representación — típicamente entre una forma de superficie (lo que ves en texto) y un análisis subyacente (lo que significa lingüísticamente). Piénsalo como una máquina con estados y transiciones: lee símbolos de entrada, se mueve entre estados, y produce símbolos de salida.

Para un ejemplo concreto, considera la palabra Plains Cree *nikî-nipâw*. Un analizador morfológico basado en FST puede tomar esta forma de superficie y producir:

> nipâw + Verbo + AI + Independiente + Pasado + 1ª Persona Singular

Esto te dice que la palabra es el verbo *nipâw* ("dormir") en orden independiente, tiempo pasado, primera persona singular — "dormí". El transductor codifica las reglas de morfología Cree: qué prefijos indican persona, cuáles marcan tiempo, qué formas verbales toman qué patrones inflexionales. Crucialmente, esto funciona **bidireccionalemente**: dado un análisis, el FST puede generar la forma de superficie correcta.

La infraestructura técnica para construir FST incluye:

- **HFST** (Helsinki Finite-State Transducer Technology): Un conjunto de herramientas de código abierto mantenido en la Universidad de Helsinki, proporcionando el marco computacional para construir y ejecutar transductores. HFST implementa los formalismos originalmente desarrollados por Xerox (lexc, twolc, xfst) y es compatible con **foma**, otro conjunto de herramientas FST de código abierto.

- **lexc**: Un formalismo para especificar el **léxico** — el inventario de morfemas (raíces, prefijos, sufijos) y los patrones de formación de palabras que los combinan.

- **twolc**: Un formalismo para especificar **reglas morfofonológicas** — los cambios de sonido que ocurren cuando los morfemas se combinan (p. ej., armonía vocálica, mutación consonántica).

### GiellaLT: Infraestructura Ártica

**GiellaLT** (de la palabra del sami septentrional *giella*, "idioma") es una infraestructura de tecnología de lenguaje basada en **UiT — The Arctic University of Norway** en Tromsø. Representa el esfuerzo más extenso en todo el mundo para construir herramientas basadas en FST para idiomas indígenas y minoritarios.

Originalmente conocido como **Giellatekno** (investigación) y **Divvun** (herramientas lingüísticas), el proyecto, dirigido por los lingüistas **Trond Trosterud** y **Sjur Nørstebø Moshagen**, ha desarrollado analizadores morfológicos, correctores ortográficos y otras herramientas lingüísticas para más de **100 idiomas**, con un enfoque en las lenguas sami (sami septentrional, sami de Lule, sami meridional y otras), lenguas urálicas y otras lenguas árticas e indígenas.

GiellaLT utiliza HFST como su backend computacional y ha desarrollado una infraestructura compartida sofisticada: un sistema de construcción común, marcos de prueba compartidos, y componentes lingüísticos reutilizables. Todo el código es de código abierto, alojado en [GitHub](https://github.com/giellalt), con cientos de repositorios incluyendo infraestructura central y repositorios específicos de idioma (p. ej., `lang-sme` para sami septentrional, `lang-crk` para Plains Cree). La documentación del proyecto vive en [giellalt.github.io](https://giellalt.github.io/). El portal de acceso público, **[Borealium.org](https://borealium.org)** — financiado por el Consejo Nórdico de Ministros — proporciona acceso gratuito a herramientas de corrección, teclados, diccionarios, herramientas de aprendizaje de idiomas (Oahpa) y síntesis de voz para idiomas sami, Kven, feroés, groenlandés, y otros.

La relación entre GiellaLT y la política de idiomas nacionales es notable. Gran parte de la financiación del proyecto proviene del **Parlamento Sami Noruego** y programas de idiomas del gobierno nórdico, reflejando un compromiso político con la tecnología de idiomas indígenas que es inusual en escala y duración.

### Apertium: TA de Código Abierto Basada en Reglas

**[Apertium](https://www.apertium.org/)** es una plataforma de traducción automática basada en reglas de código abierto, originalmente desarrollada en la Universitat d'Alacant (España) con financiamiento de los gobiernos español y catalán. Comenzó en 2004 con enfoque en pares de idiomas relacionados (español–catalán, español–portugués) donde reglas de transferencia superficial — traducir palabra por palabra con ajustes morfológicos — producen resultados sorprendentemente buenos. Los contribuyentes clave incluyen **Francis M. Tyers**, quien ha sido central tanto para el desarrollo de Apertium como para su adopción para idiomas insuficientemente dotados de recursos.

La arquitectura de Apertium es un **pipeline** clásico:

1. **Análisis morfológico** (basado en FST): Identificar el lema y características morfológicas de cada palabra
2. **Desambiguación de parte del discurso**: Elegir el análisis correcto cuando las palabras son ambiguas
3. **Transferencia léxica**: Mapear lemas de idioma fuente a lemas de idioma destino
4. **Transferencia estructural**: Aplicar reglas para manejar cambios de orden de palabras, concordancia, y otras diferencias sintácticas
5. **Generación morfológica** (basada en FST): Producir la forma de superficie de idioma destino correctamente inflexionada

A partir de 2025, Apertium admite cientos de pares de idiomas en niveles de calidad variables, todos alojados en [GitHub](https://github.com/apertium). Sigue siendo activamente desarrollado por una comunidad internacional y es particularmente útil para pares de idiomas estrechamente relacionados donde su enfoque basado en reglas puede lograr calidad razonable sin datos de entrenamiento.

### Enfoques Híbridos: FST + Neural

La frontera más prometedora para TA de bajo recurso puede ser **arquitecturas híbridas** que combinan análisis morfológico basado en reglas con traducción neural. La idea es directa: usar un FST para segmentar palabras en morfemas (resolviendo el problema de tokenización descrito en la Parte 4), luego alimentar el texto segmentado a un sistema de TA neural.

Para un idioma polisintético como Plains Cree, esto significa que el modelo neural recibe una secuencia de unidades significativas en lugar de fragmentos arbitrarios de bytes. El **Alberta Language Technology Lab (ALT Lab)** en la Universidad de Alberta, liderado por **Antti Arppe**, ha construido analizadores morfológicos basados en FST comprensivos y herramientas de diccionario de acceso comunitario para Plains Cree usando la infraestructura GiellaLT. Su trabajo publicado más reciente (Arppe 2025, AmericasNLP) demuestra mapeo basado en FST entre formas de palabras Cree inflexionadas y frases en inglés — esencialmente "traducción restringida" mediante métodos de estados finitos, operando a nivel de palabra/frase en lugar de oraciones completas. Notablemente, ALT Lab **no** ha publicado un sistema de TA híbrido FST+neural; su trabajo es lingüísticamente fundamentado, basado en reglas, y prioriza confiabilidad y utilidad comunitaria sobre enfoques neurales experimentales. Mientras tanto, Nguyen, Hammerly, y Silfverberg (2025, AmericasNLP) demostraron un pipeline híbrido LLM+FST para verbos Ojibwe en UBC, logrando resultados fuertes (chrF 0.82) — el análogo publicado más cercano a un enfoque híbrido para un idioma algonquino.

Esta estrategia híbrida representa una convergencia de las dos tradiciones que han corrido a través de la historia de TA: el conocimiento explícito del lingüista y el aprendizaje estadístico del ingeniero. Para los idiomas que más necesitan TA, ninguna tradición por sí sola es suficiente.

---

## Parte 6: Medición de Calidad — El Problema de la Evaluación

### ¿Cómo Sabe Si Una Traducción Es Buena?

Esta pregunta suena simple. Es, de hecho, uno de los problemas más difíciles sin resolver en el campo, y cómo la responda determina qué sistemas parecen "funcionar" y cuáles no.

### BLEU: El Estándar Imperfecto

Durante más de dos décadas, la métrica automática dominante en TA ha sido **BLEU** (Bilingual Evaluation Understudy), introducida por Papineni et al. en IBM en 2002. BLEU mide cuánto las secuencias de palabras (n-gramas) de la traducción automática se superponen con una o más traducciones de referencia humana. Incluye una penalización de brevedad para prevenir que los sistemas jueguen el puntaje con salidas cortas.

BLEU se convirtió en la moneda del campo porque es rápido, barato, independiente del idioma, y reproducible. Prácticamente cada artículo de TA publicado entre 2002 y 2020 reportó puntuaciones BLEU. Las tareas compartidas de WMT lo usaron como métrica primaria durante años.

Pero BLEU tiene defectos profundos que se han vuelto cada vez más aparentes:

- **Sin comprensión semántica**: BLEU es pura coincidencia de superficie. Si una traducción usa un sinónimo perfecto que no aparece en la referencia, BLEU la penaliza. La oración "the cat sat on the mat" obtiene cero puntos contra una referencia de "the feline rested on the rug".
- **Pobre discriminación a nivel de oración**: BLEU fue diseñado como métrica a nivel de corpus. A nivel de oración, es poco confiable y ruidoso.
- **Ceguera morfológica**: Para idiomas aglutinantes (turco, finlandés, suajili), donde un único lema puede tener docenas de formas inflexionadas, la coincidencia estricta a nivel de palabra falla catastróficamente. Un verbo correctamente inflexionado que difiere por un sufijo de la referencia obtiene cero puntos.
- **Débil correlación con juicio humano**: Meta-análisis, notablemente Reiter (2018), han mostrado que la correlación de BLEU con evaluaciones de calidad humana es a menudo débil, particularmente para sistemas de alta calidad e idiomas distantes del inglés.

### chrF y chrF++

**chrF** (character F-score), introducido por Maja Popović en 2015, aborda la ceguera morfológica de BLEU midiendo superposición a nivel de **carácter** en lugar de palabra. Esto da crédito parcial por raíces y radicales compartidos incluso cuando las inflexiones difieren — crucial para idiomas morfológicamente ricos. **chrF++** (Popović, 2017) agrega n-gramas a nivel de palabra de vuelta, logrando mejor correlación con juicio humano que métrica solo de caracteres o solo de palabras. Ambas se implementan en **sacreBLEU**, el conjunto de herramientas de evaluación estándar, y se han convertido en métricas secundarias estándar en tareas compartidas de WMT.

### COMET y xCOMET: Evaluación Neural

El avance más significativo en evaluación de TA ha sido el movimiento hacia **métricas neurales** — modelos de evaluación que son ellos mismos Transformers, entrenados para predecir juicios de calidad humana.

**COMET** (Crosslingual Optimized Metric for Evaluation of Translation), desarrollado por Ricardo Rei y colegas en **Unbabel** (2020), usa un codificador multilingüe (XLM-RoBERTa) para incrustar la oración fuente, la traducción, y la referencia, luego predice una puntuación de calidad. A diferencia de BLEU, COMET opera en espacio semántico — reconoce paráfrasis, captura preservación de significado, y ha mostrado consistentemente correlación mucho más alta con juicio humano que métricas a nivel de superficie. COMET ganó o se clasificó primero en Tareas Compartidas de Métricas de WMT desde 2020 en adelante.

**xCOMET** (Guerreiro et al., 2024, publicado en TACL) va más lejos: además de una puntuación de calidad, produce **detección de tramo de error de grano fino** — identificando errores específicos en la traducción, clasificándolos por tipo (precisión, fluidez, terminología) y severidad (menor, mayor, crítico). Esto cierra la brecha entre puntuación automática y análisis lingüístico humano.

### AfriCOMET: Evaluación para los Insuficientemente Atendidos

COMET estándar, entrenado principalmente en juicios humanos de idiomas europeos, puede no generalizarse bien a idiomas tipológicamente diferentes. **AfriCOMET** (Wang, Adelani et al., NAACL 2024) aborda esto ajustando fino en datos de evaluación humana de **13 idiomas africanos** y usando **AfroXLM-R** — un codificador multilingüe específicamente entrenado para representar mejor idiomas africanos. Este trabajo, producido por la comunidad Masakhane (ver Parte 7), demuestra que las métricas de evaluación en sí mismas deben adaptarse para diversidad lingüística.

### Evaluación Humana: MQM y Evaluación Directa

Las métricas automáticas son proxies. La verdad fundamental sigue siendo **evaluación humana**, que toma dos formas primarias:

**Evaluación Directa (ED)** pide a evaluadores humanos que califiquen traducciones en una escala de 0–100. Es relativamente rápido y barato (se pueden usar evaluadores de multitud) y fue el método de evaluación humana primario en WMT de 2017 a 2020. Su debilidad: a medida que la calidad de TA mejoró, los evaluadores no expertos ya no pudieron distinguir entre sistemas que producen salida casi profesional. ED se volvió poco confiable en la parte superior del espectro de calidad.

**Métricas de Calidad Multidimensional (MQM)** reemplazó ED como método de evaluación humana primario de WMT desde 2021 en adelante. MQM usa **traductores profesionales** que marcan tramos de error específicos en la traducción, clasifican errores por tipo (error de traducción, omisión, gramática, terminología) y severidad (menor = 1 punto, mayor = 5 puntos, crítico = 25 puntos). Esto produce tanto una puntuación de calidad como información de diagnóstico procesable — sabes no solo *qué tan malo* es una traducción, sino *qué específicamente salió mal*.

| Característica | ED | MQM |
|---|---|---|
| Evaluadores | Trabajadores de multitud | Traductores profesionales |
| Método | Puntuación holística 0–100 | Anotación de tramo de error |
| Diagnósticos | Ninguno | Categorización de error detallada |
| Costo | Menor | Mayor |
| Confiabilidad | Más débil para TA de alta calidad | Estándar de oro |
| Uso primario en WMT | 2017–2020 | 2021–presente |

### La Crisis de Evaluación para Idiomas de Bajo Recurso

Para idiomas de bajo recurso, el problema de evaluación se agrava por varios factores:

- **Sin evaluadores calificados**: MQM requiere traductores profesionales bilingües. Para muchos idiomas de bajo recurso, encontrar tales evaluadores es extremadamente difícil.
- **Sin traducciones de referencia**: COMET y BLEU ambos requieren traducciones de referencia para comparación. Para muchos dominios e idiomas, estas no existen.
- **Sesgo de métrica**: Tanto métricas de superficie como métricas neurales fueron desarrolladas y validadas en datos de idiomas europeos. Su comportamiento en idiomas tipológicamente distantes es incierto.
- **Riesgo de alucinación**: En configuraciones de bajo recurso, los modelos de TA pueden producir salida fluida que está completamente desconectada de la fuente — un fenómeno llamado **alucinación**. Las métricas de superficie pueden asignar puntuaciones distintas de cero a salida alucinada si accidentalmente comparte n-gramas con la referencia.

Construir **conjuntos de evaluación personalizados** — incluso pequeños de 200–500 pares de oraciones cuidadosamente seleccionados en el dominio destino — es esencial para cualquier esfuerzo serio de TA de bajo recurso. Depender únicamente de puntuaciones FLORES-200 o BLEU sin evaluación específica de dominio es una receta para confianza falsa.

---

## Parte 7: El Panorama Institucional

### Actores Corporativos

El campo de TA está moldeado por un puñado de actores corporativos principales, cada uno con estrategias distintas:

**Google Translate** sigue siendo el sistema de MT más utilizado a nivel mundial; su Cloud Translation API enumera **194 idiomas** ([lista publicada por Google](https://docs.cloud.google.com/translate/docs/languages): el producto para consumidores anuncia más, pero Google no publica una lista estática oficial para él). La **1000 Languages Initiative** de Google (anunciada en 2022) tiene como objetivo crear modelos de IA que cubran los 1000 idiomas más hablados del mundo. La Cloud Translation API ofrece dos niveles: Basic (NMT heredado) y Advanced (modelos más recientes). Google ha integrado cada vez más las capacidades de su LLM Gemini en Translate, con funciones de traducción idiomática y consciente del contexto que aparecerán en 2025.

**Meta** se ha posicionado como el impulsor principal de TA multilingüe de código abierto a través de NLLB-200, M2M-100, FLORES-200, y la suite Seamless. La filosofía de Meta de lanzamiento de modelo abierto ha sido transformadora para investigación académica, proporcionando líneas base y herramientas que de otro modo requerirían recursos de computación prohibitivos.

**DeepL** ocupa un nicho enfocado en calidad, admitiendo aproximadamente **33 idiomas** — todos relativamente bien dotados de recursos — con una reputación de salida natural e idiomática preferida por traductores profesionales. El modelo de negocio de DeepL (consumidor freemium + API de pago para empresa) y su parámetro de formalidad (controlando registro formal vs. informal) reflejan un enfoque en flujos de trabajo de traducción profesional en lugar de cobertura de idiomas amplia.

**Microsoft Translator** (parte de Azure AI Services) ofrece traducción en **135 idiomas** con integración empresarial a través de Microsoft 365 y Teams. Su función Custom Translator permite a las organizaciones ajustar los modelos con datos específicos del dominio.

**Unbabel** combina TA con post-edición humana en un flujo de trabajo "humano en el bucle", junto con sus contribuciones de investigación (COMET, xCOMET, Tower). Representa la aplicación comercial del paradigma "TA + revisión humana".

**LibreTranslate**, construido en el motor **Argos Translate**, proporciona una alternativa de TA completamente de código abierto y auto-hospedable sin dependencia corporativa — importante para organizaciones con requisitos de soberanía de datos.

### Comunidades de Base

Algunos de los trabajos más importantes en TA — particularmente para idiomas insuficientemente atendidos — ocurren en organizaciones de investigación impulsadas por comunidades:

**[Masakhane](https://www.masakhane.io/)** (del isiZulu para "construimos juntos") es una comunidad de investigación de base enfocada en NLP para idiomas africanos, fundada en 2019. Con cientos de miembros en todo el continente y diáspora, Masakhane ha producido conjuntos de datos fundamentales (MasakhaNER, MAFAND-MT, MENYO-20k, AfriQA), métricas de evaluación (AfriCOMET), e investigación que ha avanzado significativamente NLP de idiomas africanos. Las figuras clave incluyen **David Ifeoluwa Adelani** (Mila / UCL). El código y datos se alojan en [GitHub](https://github.com/masakhane-io); el centro de comunicación principal es su espacio de trabajo Slack (únete vía masakhane.io), con reuniones comunitarias semanales. Masakhane opera sobre principios de propiedad africana de tecnología de idiomas africanos — un contrapeso deliberado a patrones de investigación extractivos donde instituciones externas recopilan datos de comunidades de idiomas sin colaboración significativa. Explícitamente desalientan "investigación de paracaidistas" donde forasteros extraen datos lingüísticos sin asociación significativa con la comunidad.

**AmericasNLP** es una serie de talleres (coubicada con NAACL) enfocada en NLP para idiomas indígenas de las Américas. Organizada por investigadores incluyendo **Manuel Mager**, **Arturo Oncevay**, y **Luis Chiruzzo**, ejecuta tareas compartidas en TA para idiomas como quechua, guaraní, aymara, náhuatl, rarámuri, y otros. El taller expone desafíos de investigación únicos a las Américas — morfología polisintética, sistemas tonales, escasez de datos extrema, y las dimensiones políticas de la tecnología de lenguaje para pueblos colonizados.

**[ALT Lab](https://altlab.ualberta.ca)** (Alberta Language Technology Lab) en la Universidad de Alberta, liderado por **Antti Arppe**, se enfoca específicamente en herramientas computacionales para Plains Cree y otros idiomas indígenas del oeste de Canadá. ALT Lab construye analizadores morfológicos basados en FST y herramientas de lenguaje de acceso comunitario (usando la infraestructura GiellaLT), y trabaja en estrecha colaboración con comunidades que hablan Cree — un modelo para desarrollo de tecnología de lenguaje centrado en comunidades. Su proyecto de acceso público **[21st Century Tools for Indigenous Languages](https://21c.tools)** proporciona diccionarios en línea y herramientas morfológicas construidas sobre esta infraestructura.

**[NRC Indigenous Languages Technology](https://nrc.canada.ca)** (National Research Council Canada), liderado por **Patrick Littell**, mantiene un programa activo apoyando 25+ idiomas indígenas en Canadá, incluyendo múltiples dialectos Cree, Algonquino, Innu, y Michif. NRC ILT ha publicado investigación de TA para inglés–inuktitut (usando el corpus Nunavut Hansard) y desarrolla herramientas de código abierto incluyendo **kiyânaw Transcribe** (transcripción Cree y Ojibwe), analizadores morfológicos, y **ReadAlong Studio** (alineación de audio-texto). Todo el código es de código abierto y NRC explícitamente no reclama derechos de autor sobre datos lingüísticos comunitarios.

**[Aya](https://cohere.com/research/aya)** (Cohere For AI) es una iniciativa de LLM multilingüe de ciencia abierta con 3.000+ contribuyentes de 119+ países. Aunque no es un sistema de TA dedicado, los modelos Aya (Aya-101 cubriendo 101 idiomas, Aya 23 cubriendo 23 idiomas de alto impacto, Tiny Aya cubriendo 70 idiomas en 3.35B parámetros) son altamente efectivos para tareas de traducción. La **Colección Aya** — 513M instancias de estilo de instrucción — es el conjunto de datos de instrucción multilingüe abierto más grande. El modelo de gobernanza comunitaria vale la pena estudiar.

**[GhanaNLP / Khaya](https://ghananlp.org)** es una iniciativa de NLP impulsada por comunidades que produjo la plataforma de traducción **Khaya** — uno de los pocos sistemas de TA gobernados por comunidades realmente implementados para uso diario. Khaya proporciona traducción automática neural, ASR, y TTS para ~12 idiomas ghaneses (Twi, Ewe, Ga, Fante, Kusaal, y otros) vía web, aplicaciones móviles, y API de desarrollador. Su enfoque — 40.000+ pares de oraciones paralelas construidas a través de colaboración de lingüistas y retroalimentación comunitaria — demuestra que TA gobernada por comunidades puede ser operacional, no solo aspiracional.

### Financiamiento y Política

La investigación de TA para idiomas de bajo recurso depende de flujos de financiamiento bastante diferentes de los que sustentan TA comercial:

- **Lacuna Fund**: Un fondo de datos colaborativo apoyado por la Fundación Rockefeller, Google.org, IDRC de Canadá, y GIZ de Alemania. Lacuna específicamente financia la creación de **conjuntos de datos etiquetados** para idiomas insuficientemente representados — llenando la brecha de datos que es la causa raíz de brechas de calidad de TA.

- **AI4D** (Artificial Intelligence for Development): Un programa apoyando becas de investigación de IA para tecnología de idiomas africanos, operado a través de IDRC y la Agencia Sueca de Cooperación Internacional para el Desarrollo.

- **Década Internacional de Idiomas Indígenas de la UNESCO (2022–2032)**: Un marco político que ha elevado el perfil de la tecnología de idiomas indígenas globalmente, aunque la financiación de investigación concreta ha sido modesta.

- **Banco Interamericano de Desarrollo**: Financió el proyecto **GuaranIA** para TA guaraní–español en Paraguay, un ejemplo de financiamiento de desarrollo apoyando tecnología de lenguaje.

- **Consejos de investigación nacionales**: Gran parte del trabajo de TA de bajo recurso se financia a través de canales académicos estándar (NSF, NSERC, programas Horizon de la UE), a menudo como componentes de subvenciones de IA o lingüística más amplias.

---

## Parte 8: Fronteras Abiertas

### Qué Sigue Sin Resolver

El campo de TA en 2026 es simultáneamente más capaz y más honesto sobre sus limitaciones que en cualquier punto anterior. Varios problemas de frontera definen el panorama de investigación actual:

**Traducción a nivel de documento** sigue siendo en gran medida sin resolver. La mayoría de sistemas de TA — incluyendo muchos LLM — traducen oración por oración, perdiendo coherencia de discurso, resolución de pronombres entre límites de oración, y consistencia estilística. Un traductor humano lee el documento completo antes de traducir; la mayoría de sistemas de TA procesan oraciones de forma aislada. La investigación en TA a nivel de documento es activa pero aún no ha producido sistemas que mantengan confiablemente coherencia en textos largos.

**Discurso y pragmática** — la brecha entre significado literal e intención comunicativa — continúa desafiando TA. La ironía, la subestimación, las alusiones culturales, y la sensibilidad de registro (formal vs. informal, respetuoso vs. casual) son parcialmente capturadas por los mejores LLM pero inconsistentemente. Un traductor trabajando entre japonés e inglés debe navegar un sistema honorífico elaborado; los sistemas de TA actuales manejan esto desigualmente en el mejor de los casos.

**Traducción multimodal** — traducir en contexto con imágenes, video, o audio — es un área de investigación emergente. Un artículo de menú descrito como "huevas de pez volador" tiene perfecto sentido con una imagen acompañante; sin ella, TA podría producir algo extraño. La suite Seamless y LLM multimodales (Gemini, GPT-4o) han comenzado a abordar esto, pero TA multimodal robusto sigue siendo una frontera.

**Traducción de voz a voz en tiempo real** con latencia natural (retraso sub-3-segundo), preservación de identidad del hablante, y transferencia de tono emocional está acercándose a disponibilidad de producción para pares de alto recurso. Google, Meta, y varios startups demostraron sistemas prototipo en 2025. Para idiomas de bajo recurso, la traducción de voz en tiempo real sigue siendo distante.

**El "último kilómetro" para idiomas de bajo recurso** es quizás el problema más importante sin resolver del campo. La brecha entre una puntuación de punto de referencia FLORES-200 y utilidad real para una comunidad de idiomas es vasta. Un modelo que obtiene 15 BLEU en traducción Plains Cree–inglés no es útil para ningún propósito práctico. Cerrar esta brecha requiere no solo mejores modelos sino mejores datos, mejor evaluación, mejor tokenización, y — crucialmente — colaboración genuina con comunidades de idiomas en lugar de extracción de recursos lingüísticos para publicaciones académicas.

**Post-edición y colaboración humano-IA** se está convirtiendo en el paradigma dominante para traducción profesional. En lugar de reemplazar traductores humanos, TA se está posicionando cada vez más como generador de primer borrador que traductores humanos luego refinan. Entender la ciencia cognitiva de la post-edición, medir el esfuerzo de post-edición, y diseñar interfaces que apoyen colaboración humano-IA son áreas de investigación activa con implicaciones comerciales directas.

### Las Dimensiones Políticas

TA no es políticamente neutral. La elección de qué idiomas admitir, qué datos recopilar, quién controla los modelos, y qué estándares de calidad se aplican son todas decisiones con consecuencias significativas para comunidades de idiomas.

La dominancia del inglés como idioma pivote codifica una vista particular de la traducción como algo que fluye a través del inglés. El uso de textos bíblicos y misioneros como datos de entrenamiento para idiomas indígenas plantea preguntas sobre consentimiento e idoneidad cultural. La concentración de capacidad de TA en un puñado de empresas de Silicon Valley crea relaciones de dependencia que algunas comunidades de idiomas explícitamente resisten.

La **soberanía de los datos** es una preocupación central. En Canadá, los principios de soberanía de datos de las Primeras Naciones afirman que las comunidades indígenas son dueñas de sus datos, controlan cómo se recopilan y utilizan, tienen acceso a ellos y los poseen físicamente. Para la MT, esto significa que los datos de entrenamiento derivados de textos en lenguas indígenas, los corpus de evaluación construidos a partir del conocimiento de la comunidad y los modelos de traducción entrenados con recursos de la comunidad están bajo la gobernanza de la comunidad, no bajo la gobernanza de cualquier institución de investigación o empresa tecnológica que haya construido el modelo.

Esto tiene implicaciones técnicas directas. Un sistema de MT construido con datos de la comunidad no puede simplemente ser de código abierto en el sentido convencional si la comunidad no ha dado su consentimiento para ello. Los puntos de referencia de evaluación no se pueden publicar si los datos de prueba incluyen material culturalmente sensible. Un "modelo propiedad de la comunidad" no es una contradicción: es un requisito de diseño. Cualquier esfuerzo serio en la MT de bajos recursos para lenguas indígenas debe ser aspirante a la soberanía por defecto — diseñado para la propiedad y el control comunitarios de los datos lingüísticos, no como una idea de último momento.

Estos no son meramente apéndices éticos — moldean prioridades de investigación, decisiones de financiamiento, y arquitecturas técnicas. "Construir mejor TA" es inseparable de preguntas sobre quién se beneficia, quién decide, y cuyo conocimiento lingüístico es valorado.

---

## Apéndice A: Artículos Clave

Una lista de lectura cronológica de los artículos que definieron la trayectoria del campo. Cada entrada incluye una breve nota sobre por qué importa.

| Año | Artículo | Autores | Significancia |
|---|---|---|---|
| 2002 | [BLEU: a Method for Automatic Evaluation of MT](https://aclanthology.org/P02-1040/) | Papineni et al. (IBM) | Estableció la métrica de evaluación de TA dominante durante dos décadas |
| 2014 | [Sequence to Sequence Learning with Neural Networks](https://arxiv.org/abs/1409.3215) | Sutskever, Vinyals, Le (Google) | Demostró traducción de codificador-decodificador neural |
| 2014 | [Neural MT by Jointly Learning to Align and Translate](https://arxiv.org/abs/1409.0473) | Bahdanau, Cho, Bengio | Introdujo el mecanismo de atención |
| 2016 | [Google's Neural MT System](https://arxiv.org/abs/1609.08144) | Wu et al. (Google) | Llevó TA neural a escala de producción |
| 2016 | [Neural MT of Rare Words with Subword Units](https://aclanthology.org/P16-1162/) | Sennrich, Haddow, Birch | Introdujo tokenización BPE para TA |
| 2016 | [Improving NMT Models with Monolingual Data](https://aclanthology.org/P16-1009/) | Sennrich, Haddow, Birch | Introdujo retrotraducción para aumento de datos |
| 2017 | [Attention Is All You Need](https://arxiv.org/abs/1706.03762) | Vaswani et al. (Google) | Introdujo la arquitectura Transformer |
| 2020 | [Unsupervised Cross-lingual Representation Learning at Scale](https://arxiv.org/abs/1911.02116) | Conneau et al. (Facebook) | XLM-R: representaciones multilingües para 100 idiomas |
| 2020 | [Beyond English-Centric Multilingual MT](https://arxiv.org/abs/2010.11125) | Fan et al. (Facebook) | M2M-100: muchos-a-muchos sin pivoteo en inglés |
| 2020 | [COMET: A Neural Framework for MT Evaluation](https://arxiv.org/abs/2009.09025) | Rei et al. (Unbabel) | Métrica de evaluación neural con alta correlación humana |
| 2022 | [No Language Left Behind](https://arxiv.org/abs/2207.04672) | Equipo NLLB (Meta) | Modelo de TA de 200 idiomas + punto de referencia FLORES-200 |
| 2023 | [ALMA: A Paradigm Shift in MT](https://arxiv.org/abs/2309.11674) | Xu et al. (JHU) | Ajuste fino de LLM para TA de vanguardia con datos pequeños |
| 2024 | [Tower: Open Multilingual LLM for Translation](https://arxiv.org/abs/2402.17733) | Alves et al. (Unbabel) | Pipeline de traducción completo en un único LLM |
| 2024 | [xCOMET: Transparent MT Evaluation](https://aclanthology.org/2024.tacl-1.54) | Guerreiro et al. | Detección de error de grano fino en evaluación de TA |
| 2024 | [AfriMTE and AfriCOMET](https://aclanthology.org/2024.naacl-long.334/) | Wang, Adelani et al. | Evaluación de TA adaptada para idiomas africanos |

---

## Apéndice B: Conferencias y Comunidades

### Conferencias Principales

El ecosistema de conferencias de NLP/MT sigue un ritmo anual. La siguiente tabla enumera los eventos principales, seguidos de las fechas de las ediciones recientes.

| Conferencia | Nombre Completo | Frecuencia | Notas |
|---|---|---|---|
| **[WMT](https://statmt.org/wmt25/)** | Conference on Machine Translation | Anual | El principal lugar competitivo del campo; las tareas compartidas definen puntos de referencia |
| **[ACL](https://www.aclweb.org/)** | Association for Computational Linguistics | Anual | La conferencia insignia de NLP |
| **EMNLP** | Empirical Methods in NLP | Anual | Conferencia de segundo nivel; típicamente aloja WMT |
| **NAACL** | North American Chapter of the ACL | Anual (rota con ACL) | Conferencia regional principal |
| **EACL** | European Chapter of the ACL | Bienal | Conferencia regional europea |
| **COLING** | Intl. Conf. on Computational Linguistics | Bienal | Se fusionó con LREC para 2024; ahora separado de nuevo |
| **LREC** | Language Resources & Evaluation Conference | Bienal | Enfoque en datos, recursos, y evaluación |
| **[IWSLT](https://iwslt.org/)** | Intl. Workshop on Spoken Language Translation | Anual | Enfoque en traducción de voz |

#### Ediciones recientes

*Solo fechas, deliberadamente. Una columna de "estado" que diga **Próximamente** es incorrecta el
día que comienza el evento, y esta página no puede saber la fecha de hoy. Compare usted mismo las fechas
a continuación con el calendario; las actas de cualquier evento ya celebrado se encuentran
en la [ACL Anthology](https://aclanthology.org).*

| Evento | Fechas | Ubicación |
|---|---|---|
| **COLING 2025** | 19–24 de ene. de 2025 | Abu Dabi, EAU |
| **EACL 2026** | 24–29 de mar. de 2026 | Rabat, Marruecos |
| **LREC 2026** | 11–16 de may. de 2026 | Palma de Mallorca, España |
| **ACL 2026** | 2–7 de jul. de 2026 | San Diego, EE. UU. |
| **AmericasNLP 2026** | 3–4 de jul. de 2026 (celebrado junto con ACL) | San Diego, EE. UU. |

*ACL 2025 (Viena), EMNLP 2025 (Suzhou), WMT 2025 (Suzhou), IWSLT 2025 (Viena), y PACLIC 39 (Hanoi) todos ocurrieron en 2025. Sus actas están disponibles en la [ACL Anthology](https://aclanthology.org).*

#### Tareas Compartidas de WMT 2025

Las tareas compartidas de WMT son lo más cercano que tiene el campo de TA a una competencia pública. La edición de 2025 incluye:

- **General Machine Translation** — la tarea insignia
- **Automated Translation Evaluation Systems** — métricas unificadas y estimación de calidad
- **Low-Resource Indic Language Translation**
- **Creole Language Translation**
- **Terminology Shared Task**
- **Model Compression** — hacer modelos de TA más pequeños y rápidos
- **Open Language Data** — mejorar datos de entrenamiento abiertos
- **Multilingual Instruction Shared Task (MIST)**
- **Limited Resources Slavic LLMs**

### Talleres Especializados

| Taller | Enfoque | Edición más reciente conocida | Celebrado junto con |
|---|---|---|---|
| **[AmericasNLP](https://americasnlp.org/)** | Lenguas indígenas de las Américas | 3–4 de jul. de 2026 (ACL 2026, San Diego) | ACL |
| **AfricaNLP** | NLP de lenguas africanas | 31 de jul. de 2025 (ACL 2025, Viena) | ACL / ICLR |
| **LoResMT** | MT de bajos recursos | Generalmente anual en conferencias *ACL | Varios |
| **SIGTYP** | SIG de ACL sobre tipología lingüística | Taller anual | ACL |

### Recursos Clave de Comunidad

- **[machinetranslate.org](https://machinetranslate.org)** — Base de conocimiento de código abierto impulsada por comunidades sobre tecnología de TA. Ejecutada por la Machine Translate Foundation (sin fines de lucro, Zug, Suiza, fundada 2021). Cubre enfoques, API, modelos, soporte de idiomas, y noticias de la industria. Licenciada CC BY-SA 4.0. Un excelente punto de partida para cualquier tema en este informe.

- **[ACL Anthology](https://aclanthology.org)** — El archivo de acceso abierto definitivo de artículos de investigación de NLP/CL. Cada artículo en ACL, EMNLP, NAACL, EACL, WMT, y talleres relacionados está libremente disponible aquí.

---

## Apéndice C: Herramientas, Conjuntos de Datos y Recursos Prácticos

Este apéndice cubre las herramientas concretas y fuentes de datos que importan en trabajo de TA hoy. Está escrito para personas que saben cómo navegar una terminal pero pueden no conocer el ecosistema de TA.

### Marcos de Entrenamiento

Estos son los paquetes de software utilizados para *entrenar* modelos de TA neural desde cero (o ajustar fino los existentes). Los usarías si estuvieras construyendo tu propio modelo de traducción en lugar de usar uno existente vía API.

| Marco | Desarrollador | Lenguaje | Notas |
|---|---|---|---|
| **[Marian NMT](https://marian-nmt.github.io/)** | Microsoft / U. Edimburgo | C++ | El entrenador de TA neural de código abierto más rápido — puede entrenar un modelo 3–5× más rápido que alternativas basadas en PyTorch. Escrito en C++ puro con dependencias mínimas. Potencia Microsoft Translator. Cada modelo OpusMT (ver abajo) fue entrenado con él. Nombrado en honor a Marian Rejewski, la matemática polaca que ayudó a descifrar Enigma. |
| **[fairseq](https://github.com/facebookresearch/fairseq)** | Meta AI | Python (PyTorch) | El conjunto de herramientas de investigación de trabajo de Meta — usado para construir M2M-100, NLLB-200, y la mayoría del trabajo de TA publicado de Meta. Altamente modular: puedes intercambiar arquitecturas, funciones de pérdida, y procesamiento de datos. La opción estándar para investigadores reproduciendo o extendiendo trabajo de Meta. |
| **[OpenNMT](https://opennmt.net/)** | Harvard NLP / SYSTRAN | Python (PyTorch, TF) | El punto de entrada más accesible para entrenar modelos de TA personalizados. Originado como proyecto de investigación de Harvard, ahora mantenido por SYSTRAN (una empresa de TA comercial). Incluye CTranslate2 para implementación (ver abajo). Buena documentación para principiantes. |

**¿Cuándo usarías estos?** Si tienes datos paralelos (incluso unos pocos miles de pares de oraciones) y quieres entrenar o ajustar fino un modelo de traducción dedicado para un par de idiomas específico. **NO** usarías estos para traducción basada en LLM (indicación de GPT/Claude/Gemini), que no requiere entrenamiento — solo llamadas a API.

### Inferencia e Implementación

Estas herramientas ejecutan *modelos ya entrenados* para producir traducciones. Piensa en los marcos de entrenamiento arriba como "el taller donde se construye el auto" y estos como "la llave de encendido que inicia el auto".

| Herramienta | Qué Hace | Cuándo Usarla |
|---|---|---|
| **[CTranslate2](https://github.com/OpenNMT/CTranslate2)** | Un motor C++ que ejecuta modelos Transformer a alta velocidad con baja memoria. Admite cuantización INT8/INT4 (reduciendo modelos a 1/4 de su tamaño con pérdida de calidad mínima). Se ejecuta en CPU o GPU sin necesidad de PyTorch instalado. Admite NLLB, M2M-100, OpusMT, LLaMA, Whisper. | Cuando quieres auto-hospedar un modelo de traducción en un servidor o portátil sin un clúster de GPU. La opción preferida para implementación de producción de modelos de TA de código abierto. |
| **[Hugging Face Transformers](https://huggingface.co/models?pipeline_tag=translation)** | Biblioteca Python que carga y ejecuta modelos con pocas líneas de código: `pipe = pipeline('translation', model='Helsinki-NLP/opus-mt-en-fr'); pipe('Hello world')`. Proporciona ~1.500 modelos OpusMT pre-entrenados bilingües más NLLB-200, mBART, mT5, y M2M-100. | Cuando quieres el camino más rápido desde "quiero traducir algo" a código funcional. Dos líneas de Python y estás traduciendo. Menor rendimiento que CTranslate2 pero mucho más fácil de configurar. |

### Familias de Modelos Pre-Entrenados

Estos son modelos de traducción *ya entrenados* que puedes descargar y usar inmediatamente. No se requiere entrenamiento — solo carga y traduce.

| Familia de Modelos | Idiomas | Desarrollador | Qué Es | Dónde Encontrar |
|---|---|---|---|---|
| **[OpusMT / Helsinki-NLP](https://huggingface.co/Helsinki-NLP)** | 1.000+ pares | Universidad de Helsinki (Jörg Tiedemann) | La colección más grande de modelos de traducción bilingües de código abierto. Cada modelo maneja un par de idiomas (p. ej., `opus-mt-en-fr` para inglés→francés). Entrenados en datos OPUS usando Marian NMT, convertidos a formato PyTorch para Hugging Face. La calidad varía — excelente para pares bien dotados de recursos, marginal para bajo recurso. | Hugging Face (`Helsinki-NLP/opus-mt-*`) |
| **NLLB-200** | 200 idiomas | Meta | Un único modelo multilingüe que traduce entre cualquiera de 200 idiomas. Disponible en variantes de 600M, 1.3B, y 3.3B parámetros. La versión de 600M se ejecuta en una portátil; la versión de 3.3B necesita una GPU decente. La calidad varía enormemente — fuerte para recurso medio, a menudo pobre para verdadero bajo recurso. | Hugging Face (`facebook/nllb-200-*`) |
| **M2M-100** | 100 idiomas | Meta | El predecesor de NLLB-200 — primer modelo en traducir directamente entre pares sin inglés (p. ej., bengalí↔suajili) sin enrutamiento a través del inglés. Históricamente importante; en gran medida superado por NLLB-200. | Hugging Face (`facebook/m2m100_*`) |
| **Tower / Tower+** | 22–27 idiomas | Unbabel | No solo un traductor — maneja el pipeline de traducción completo (corrección, NER, post-edición, estimación de calidad) en un único LLM. Ajustado fino de LLaMA. A partir de 2025, Tower v2 (70B) supera GPT-4o y DeepL en varios puntos de referencia. | Hugging Face |
| **ALMA / X-ALMA** | 50 idiomas | Universidad Johns Hopkins | Modelos basados en LLaMA ajustados fino específicamente para traducción usando optimización de preferencia (enseñando al modelo qué traducciones prefieren los humanos). Las versiones de 7B y 13B igualan calidad de GPT-4 en pares de alto recurso. X-ALMA extiende a 50 idiomas con módulos adaptadores específicos de idioma. | Hugging Face |

### Fuentes de Datos Paralelos

Los datos paralelos son el combustible para entrenar modelos de TA: colecciones de oraciones en dos idiomas que son traducciones entre sí, alineadas línea por línea. Sin datos paralelos, no puedes entrenar un modelo de TA convencional. (La traducción basada en LLM evita esto — puedes indicar a GPT que traduzca sin datos paralelos — pero los modelos dedicados aún lo necesitan.)

| Conjunto de Datos | Escala | Qué Es | URL |
|---|---|---|---|
| **[OPUS](https://opus.nlpl.eu)** | 100B+ pares de oraciones, 1.000+ idiomas | El recurso más importante para datos de TA. Una meta-colección que agrega docenas de sub-corpus (ver abajo) en un portal buscable. Creado y mantenido por Jörg Tiedemann en la Universidad de Helsinki. Si buscas datos paralelos en cualquier idioma, OPUS es donde comienzas. Accesible vía portal web, paquete Python `opustools`, y Hugging Face. | [opus.nlpl.eu](https://opus.nlpl.eu) |
| **[Europarl](http://www.statmt.org/europarl/)** | ~60M palabras/idioma, 21 idiomas de la UE | Procedimientos del Parlamento Europeo — discursos de políticos traducidos a todos los idiomas oficiales de la UE. Creado por Philipp Koehn. Históricamente fundamental (el conjunto de datos que hizo posible la investigación de TAE), pero limitado a idiomas de la UE y registro parlamentario. | [statmt.org/europarl](http://www.statmt.org/europarl/) |
| **[ParaCrawl](https://paracrawl.eu)** | Miles de millones de pares, 29+ pares de idiomas | Proyecto financiado por la UE que rastrea la web para encontrar texto paralelo que ocurre naturalmente (sitios web bilingües, páginas traducidas). Mucho más ruidoso que corpus curados pero vastamente más grande. Lanzó el pipeline de rastreo **Bitextor** de código abierto, que cualquiera puede usar para extraer sus propios datos paralelos de la web. | [paracrawl.eu](https://paracrawl.eu) |
| **[CCAligned](http://www.statmt.org/cc-aligned/)** | 392M pares de URL, 137 direcciones emparejadas con inglés | Documentos paralelos extraídos de la web de Common Crawl (Meta/JHU). Especialmente útil para idiomas de bajo a medio recurso que no aparecen en corpus curados. La calidad es menor que Europarl pero la cobertura es mucho más amplia. | [statmt.org/cc-aligned](http://www.statmt.org/cc-aligned/) |
| **[WikiMatrix](https://github.com/facebookresearch/LASER)** | 135M oraciones paralelas, 1.620 pares | Oraciones paralelas extraídas automáticamente de Wikipedia usando incrustaciones multilingües LASER (Meta). Útil porque Wikipedia existe en muchos idiomas — pero la alineación es automática (no verificada por humanos), así que algunos pares son ruidosos o incorrectos. | GitHub (repositorio LASER) |
| **[Tatoeba](https://tatoeba.org)** | 500+ idiomas | Una colección mantenida por comunidades de oraciones de ejemplo y sus traducciones, contribuidas por voluntarios en todo el mundo. Oraciones individuales, no documentos. El **[Tatoeba Translation Challenge](https://github.com/Helsinki-NLP/Tatoeba-Challenge)** asociado (Helsinki-NLP) proporciona divisiones limpias de entrenamiento/prueba para miles de pares de idiomas — usado para entrenar los modelos OpusMT. | [tatoeba.org](https://tatoeba.org) |
| **FLORES-200** | 200 idiomas | Un punto de referencia de evaluación estandarizado (NO datos de entrenamiento). Oraciones traducidas profesionalmente usadas para comparar sistemas en igualdad de condiciones. Creado por Meta junto con NLLB-200. Si quieres comparar tu sistema contra líneas base publicadas, este es el conjunto de prueba a usar. | Hugging Face |

### Sub-Corpus Clave dentro de OPUS

OPUS agrega muchos corpus paralelos independientes. Cuando buscas datos en un idioma específico, estas sub-colecciones vale la pena verificar:

- **OpenSubtitles** — Subtítulos de películas y TV. Volumen masivo pero ruidoso — los subtítulos a menudo se simplifican, son informales, y pueden contener errores de transcripción.
- **JW300** — Publicaciones de Testigos de Jehová, cubriendo ~300 idiomas. La cobertura de idiomas más amplia de cualquier corpus único, pero fuertemente sesgado en dominio hacia contenido religioso y éticamente controvertido (ver Parte 4).
- **Bible** — Traducciones bíblicas en 700+ idiomas. Dominio más estrecho de todos (texto religioso antiguo), pero para muchos idiomas, el único texto paralelo que existe en absoluto.
- **Tanzil** — Traducciones del Corán. Útil para datos emparejados con árabe.
- **GNOME / KDE** — Cadenas de localización de software ("Archivo → Guardar", "¿Estás seguro de que quieres eliminar?"). Útil para dominio técnico/UI pero muy formulaico.
- **EMEA** — Documentos de la Agencia Europea de Medicamentos. Útil para traducción de dominio biomédico.

---

## Apéndice D: Glosario

**Mecanismo de atención**: Un componente de red neuronal que permite al modelo enfocarse dinámicamente en diferentes partes de la entrada al producir cada parte de la salida. Introducido por Bahdanau et al. (2014) para TA; generalizado en el Transformer (2017).

**Retrotraducción**: Una técnica de aumento de datos donde texto monolingüe de idioma destino es traducido de vuelta al idioma fuente por un sistema de TA preliminar, creando datos paralelos sintéticos para entrenamiento.

**BLEU**: Bilingual Evaluation Understudy. Una métrica de evaluación de TA automática basada en superposición de precisión de n-gramas con traducciones de referencia.

**BPE (Byte Pair Encoding)**: Un algoritmo de tokenización de subpalabra que iterativamente fusiona los pares de caracteres más frecuentes para construir un vocabulario. Usado en prácticamente todos los sistemas de TA neural y LLM modernos.

**COMET**: Una métrica de evaluación de TA neural que usa incrustaciones multilingües para predecir juicios de calidad humana, operando en fuente + hipótesis + referencia.

**Maldición de la multilingüidad**: El fenómeno donde agregar más idiomas a un modelo multilingüe diluye la calidad por idioma debido a capacidad de modelo fija.

**Codificador–decodificador**: Una arquitectura neuronal donde un codificador procesa la secuencia de entrada en representaciones, y un decodificador genera la secuencia de salida a partir de esas representaciones.

**FLORES-200**: Un punto de referencia de evaluación de TA estandarizado cubriendo 200 idiomas, creado por Meta junto con NLLB-200.

**FST (Transductor de Estados Finitos)**: Un dispositivo computacional que mapea entre secuencias de símbolos de entrada y salida usando estados y transiciones. Usado en morfología computacional para analizar y generar formas de palabras.

**Alucinación**: En TA, la producción de salida fluida que no está relacionada con o es infiel al texto fuente. Particularmente común en configuraciones de bajo recurso.

**Idioma de alto recurso**: Un idioma con abundante texto digital y datos de traducción paralela (típicamente >10M pares de oraciones con inglés). Ejemplos: francés, alemán, chino, español.

**LLM (Modelo de Lenguaje Grande)**: Un modelo de lenguaje neuronal con miles de millones de parámetros, entrenado en vastos corpus de texto para predecir el siguiente token. Ejemplos: GPT-4, Gemini, LLaMA, Claude.

**Idioma de bajo recurso (IBR)**: Un idioma con texto digital limitado y datos paralelos (<1M pares de oraciones). La gran mayoría de los idiomas del mundo caen en esta categoría.

**MQM (Métricas de Calidad Multidimensional)**: Un marco de evaluación humana donde traductores profesionales anotan tramos de error específicos en traducciones, clasificados por tipo y severidad.

**TA Neural (TAN)**: TA usando redes neuronales, a diferencia de enfoques estadísticos (TAE) o basados en reglas (TABR).

**Datos paralelos / corpus paralelo**: Una colección de textos en dos idiomas que son traducciones entre sí, alineados a nivel de oración. El recurso de entrenamiento primario para sistemas de TA.

**Idioma polisintético**: Un idioma en el cual las palabras se componen de muchos morfemas, a menudo codificando información que requeriría una cláusula completa en idiomas analíticos como el inglés. Ejemplos: Plains Cree, Mohawk, Inuktitut.

**SentencePiece**: Un tokenizador de subpalabra independiente del idioma y destokenizador que implementa BPE y segmentación de modelo de lenguaje unigrama. Ampliamente usado en NLP multilingüe.

**Transformer**: La arquitectura neuronal dominante para NLP desde 2017, basada enteramente en mecanismos de auto-atención. Introducida en "Attention Is All You Need" (Vaswani et al., 2017).

**Transferencia multilingüe de cero disparos**: Aplicar un modelo entrenado en un idioma (típicamente inglés) a otro idioma sin datos de entrenamiento de idioma destino, confiando en representaciones multilingües compartidas.

---

*Este informe fue compilado en junio de 2026. El campo de TA se mueve rápidamente; las capacidades específicas de modelos y resultados de puntos de referencia deben verificarse contra fuentes actuales. Para los últimos desarrollos, consulta [machinetranslate.org](https://machinetranslate.org), la [ACL Anthology](https://aclanthology.org), y actas de la tarea compartida de WMT más reciente.*

---

## A dónde conduce esto en este sitio

La brecha que describe este informe (cientos de idiomas sin ninguna traducción
medida en absoluto) es lo que el resto de este sitio está diseñado para cerrar. El
argumento de cómo hacerlo ([Qué es Champollion](/docs/what-is-champollion)), la
economía de construir un conjunto de evaluación en lugar de un corpus de entrenamiento
([Quién se beneficia: investigadores](/docs/network/who-benefits#researchers)) y
el estado de lo que realmente se ha medido hasta ahora
([Limitaciones honestas](/docs/network/honest-limitations)) son las tres
siguientes lecturas naturales.
