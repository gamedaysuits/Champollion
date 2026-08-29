---
sidebar_position: 3
title: "Midiendo lo Inmensurable"
---

# Midiendo lo Inmensurable: El Problema de la Evaluación en Traducción Automática

**Una revisión de cómo el campo mide la calidad de la traducción, dónde falla, y qué ofrece LYSS (Linguistically-informed Yield & Structural Scoring) como alternativa**

---

> *"Las métricas automáticas son una mentira conveniente. Nos dan un número, y el número nos permite escribir un artículo, y el artículo nos permite reclamar progreso. Si el progreso realmente ocurrió es una pregunta separada."*
> — Adaptado de un sentimiento recurrente en los Shared Tasks de Métricas de WMT

---

## Introducción

La traducción automática tiene un problema de medición.

El campo ha pasado dos décadas construyendo sistemas cada vez más sofisticados — desde tablas de frases hasta mecanismos de atención hasta modelos de lenguaje con parámetros en la escala de billones — y durante todo ese arco, ha lidiado con una pregunta engañosamente simple: *¿cómo sabe si una traducción es buena?*

Esta pregunta no es académica. La métrica que elija determina qué sistema "gana". Determina qué se financia, qué se publica, qué se implementa, y — para los idiomas que más necesitan TA — si las traducciones de una comunidad se juzgan como fracasos cuando, de hecho, son correctas.

La historia de la evaluación de TA es, en miniatura, una historia de los valores del campo. El dominio de BLEU durante casi dos décadas revela una preferencia por la medición barata, rápida e independiente del idioma sobre la evaluación informada lingüísticamente. El auge de métricas neurales como COMET refleja la sofisticación creciente del campo — y su dependencia continua de datos de entrenamiento centrados en inglés. La ausencia casi total de evaluación consciente de la morfología refleja un campo que, hasta hace poco, fue construido por y para hablantes de idiomas europeos analíticos.

Este documento traza la evolución de la evaluación de TA desde BLEU hasta el presente, identifica dónde los enfoques existentes fallan sistemáticamente para idiomas morfológicamente complejos y de recursos limitados, y examina qué podría parecer una alternativa fundamentada lingüísticamente. Es un complemento a otros documentos de contexto del proyecto — [*From Pāṇini to Transformers*](./history-of-language-and-computation.md) (que traza la historia intelectual del lenguaje y la computación) y el [*Field Briefing*](./mt-field-briefing.md) (que revisa el panorama actual de TA). Donde esos documentos preguntan "¿cómo llegamos aquí?" y "¿qué existe?", este pregunta: "¿cómo sabemos si algo de esto funciona?"

---

## Parte 1: La Era de Coincidencia de Cadenas (2002–2015)

### BLEU y el Nacimiento de la Evaluación Automática

La era moderna de la evaluación de TA comienza con un único artículo: "BLEU: a Method for Automatic Evaluation of Machine Translation" de Kishore Papineni, Salim Roukos, Todd Ward y Wei-Jing Zhu, publicado en ACL 2002. BLEU (Bilingual Evaluation Understudy) mide cuánto se superponen las secuencias de palabras (n-gramas) de una traducción automática con una o más traducciones de referencia humana. Incluye una penalización por brevedad para evitar que los sistemas manipulen la puntuación con salidas cortas, y calcula una media geométrica de precisiones de n-gramas en órdenes 1 a 4.

BLEU se convirtió en la moneda del campo por una razón simple: era rápido, barato, reproducible e independiente del idioma. Antes de BLEU, evaluar un sistema de TA requería evaluación humana cara y lenta. BLEU ofrecía un número que podía calcularse en milisegundos, compararse entre artículos y usarse para clasificar sistemas en tareas compartidas. En pocos años, era esencialmente obligatorio — un artículo sin puntuaciones BLEU era impublicable.

Pero BLEU tiene defectos profundos y bien documentados que el campo ha pasado dos décadas intentando resolver:

**Sin comprensión semántica.** BLEU es pura coincidencia de superficie. "The cat sat on the mat" obtiene cero contra una referencia de "the feline rested on the rug." Cada palabra es un sinónimo correcto; el significado es idéntico; la puntuación es cero.

**Ceguera morfológica.** Para idiomas aglutinantes y polisintéticos, la coincidencia estricta a nivel de palabra falla catastróficamente. Un verbo Cree conjugado correctamente que difiere por un morfema de la referencia obtiene cero — incluso si la diferencia es una partícula gramaticalmente opcional o un orden de palabras igualmente válido.

**Pobre discriminación a nivel de oración.** BLEU fue diseñado como una métrica a nivel de corpus. A nivel de oración, es ruidosa e poco confiable — sin embargo, se aplica rutinariamente a oraciones individuales.

**Sesgo de referencia única.** BLEU asume que hay *una* traducción correcta (o un pequeño conjunto de referencias). Para idiomas con orden de palabras libre, vocabularios ricos en sinónimos, o ambigüedades sistemáticas (como el "nosotros" inclusivo/exclusivo de Cree), puede haber docenas de traducciones igualmente correctas, y BLEU penaliza todas excepto la que coincide con la referencia.

**Correlación débil con el juicio humano.** Meta-análisis — notablemente Reiter (2018, *Computational Linguistics*) — han mostrado que la correlación de BLEU con evaluaciones de calidad humana es a menudo débil, particularmente para sistemas de alta calidad y para idiomas distantes del inglés.

Estos defectos eran conocidos casi desde el principio. Sin embargo, BLEU persistió porque las alternativas eran peores — no en precisión, sino en conveniencia. El campo optimizó para la métrica que podía calcular, no la métrica que necesitaba.

### NIST (Doddington, 2002)

La métrica NIST, publicada el mismo año que BLEU por George Doddington en HLT 2002, modificó la fórmula BLEU de dos maneras. Primero, ponderó n-gramas por su **contenido de información** — los n-gramas raros recibieron mayor peso que los comunes, con la intuición de que traducir correctamente una frase inusual es más informativo que traducir correctamente "of the." Segundo, utilizó una **media aritmética** en lugar de la media geométrica de BLEU, produciendo puntuaciones más estables que no colapsaban a cero cuando algún orden de n-grama no tenía coincidencias. NIST se utilizó extensamente en los programas de evaluación DARPA TIDES y NIST OpenMT pero nunca logró el dominio de BLEU en la comunidad de investigación más amplia. A pesar de sus mejoras, compartía la limitación fundamental de BLEU: coincidencia de cadenas a nivel de superficie sin concepto de significado.

### METEOR (Banerjee & Lavie, 2005)

METEOR (Metric for Evaluation of Translation with Explicit ORdering) fue un intento temprano de abordar la rigidez de BLEU. Donde BLEU realiza coincidencia exacta de palabras, METEOR introdujo tres innovaciones:

1. **Lematización**: Las palabras se reducen a sus raíces antes de la comparación, dando crédito parcial por variantes morfológicas (p. ej., "running" coincide con "ran" después de la lematización).
2. **Coincidencia de sinónimos**: Usando WordNet, METEOR reconoce que "car" y "automobile" son el mismo concepto.
3. **Alineación de palabras**: En lugar de contar superposiciones de n-gramas, METEOR alinea explícitamente palabras entre la hipótesis y la referencia, luego calcula precisión y recuperación con una penalización de fragmentación.

METEOR mostró consistentemente mayor correlación con juicios humanos que BLEU. Pero requería recursos específicos del idioma (lematizadores, bases de datos de sinónimos) que limitaban su aplicabilidad, y era más lento de calcular. Para inglés, era mejor. Para idiomas de recursos limitados, los lematizadores y bases de datos de sinónimos simplemente no existían.

### TER (Snover et al., 2006)

Translation Edit Rate mide el número mínimo de ediciones (inserciones, eliminaciones, sustituciones y *cambios de frases*) necesarias para transformar la hipótesis en la referencia, normalizado por la longitud de la referencia. La operación de cambio de frases — mover una secuencia contigua de palabras a una posición diferente — fue un reconocimiento directo de que el orden de palabras no es fijo entre idiomas. El enfoque de distancia de edición de TER es intuitivo (mide "cuánto trabajo necesitaría un editor humano?") pero hereda la misma limitación fundamental: compara contra una única referencia y no tiene concepto de significado.

### chrF y chrF++ (Popović, 2015; 2017)

La innovación de métrica más importante entre BLEU y la era neural provino de Maja Popović. **chrF** (character F-score) mide la superposición a nivel de *carácter* en lugar de a nivel de palabra, calculando precisión y recuperación de n-gramas de caracteres. **chrF++** agrega unigramas y bigramas a nivel de palabra nuevamente.

Por qué esto importa para idiomas morfológicamente ricos: la coincidencia a nivel de carácter da *crédito parcial* por morfemas compartidos. Las palabras Cree *nikî-nipâw* ("dormí") y *kikî-nipâw* ("dormiste") comparten la mayoría de sus n-gramas de caracteres a pesar de ser palabras diferentes. chrF daría crédito sustancial parcial; BLEU daría cero.

chrF++ se ha convertido en una métrica secundaria estándar en tareas compartidas de WMT, implementada en **sacreBLEU** (Post, 2018), y es ampliamente reconocida como superior a BLEU para idiomas morfológicamente ricos. Pero sigue siendo una métrica de coincidencia de cadenas — mejor que BLEU, pero fundamentalmente limitada por la misma suposición de que la calidad de la traducción puede medirse por superposición de formas de superficie.

---

## Parte 2: La Revolución de Métricas Neurales (2018–Presente)

### La Idea: Aprender a Calificar

Las métricas de coincidencia de cadenas de la Parte 1 comparten una elección de diseño fundamental: son fórmulas diseñadas a mano. Alguien decidió que la precisión de n-gramas, la superposición de caracteres o la distancia de edición era un buen proxy para la calidad de la traducción, y luego todos usaron esa fórmula durante una década.

La revolución de métricas neurales comenzó con una pregunta diferente: *¿y si entrenáramos un modelo para predecir la calidad de la traducción, de la misma manera que entrenamos modelos para traducir?*

### BERTScore (Zhang et al., 2020)

BERTScore, publicado en ICLR 2020 por Tianyi Zhang y colegas de Cornell y MIT, fue la primera métrica ampliamente adoptada en pasar de la coincidencia exacta de cadenas a la similitud semántica. El mecanismo es elegante: codificar tanto la hipótesis como la referencia a través de un modelo Transformer pre-entrenado (BERT, RoBERTa o DeBERTa), calcular la similitud de coseno entre cada par de incrustaciones de tokens, y luego usar coincidencia codiciosa para calcular precisión (la mejor coincidencia de cada token de hipótesis en la referencia), recuperación (la mejor coincidencia de cada token de referencia en la hipótesis) y F1.

BERTScore maneja sinónimos, paráfrasis y variaciones de orden de palabras naturalmente — "the feline rested on the rug" obtiene alta similitud con "the cat sat on the mat" porque las incrustaciones contextuales capturan equivalencia semántica. Con BERT multilingüe, se extiende a cualquier idioma que el modelo cubra.

Pero BERTScore no está *entrenado* en juicios de calidad humana. Utiliza incrustaciones pre-entrenadas tal como están, lo que significa que captura similitud semántica general en lugar de aprender específicamente qué hace que una *traducción* sea buena. Esta distinción importa: una oración puede ser semánticamente similar a una referencia mientras es una mala traducción (registro incorrecto, negación omitida, calificador alucinado). BERTScore también hereda cualquier sesgo de idioma que exista en el modelo subyacente — para idiomas subrepresentados en los datos de entrenamiento de BERT, las incrustaciones pueden no capturar distinciones significativas.

### BLEURT (Sellam et al., 2020)

BLEURT (Bilingual Evaluation Understudy with Representations from Transformers), publicado en ACL 2020 por Thibault Sellam, Dipanjan Das y Ankur Parikh en Google, introdujo una innovación clave: **pre-entrenamiento en perturbaciones sintéticas** antes del ajuste fino en juicios humanos. La idea era que el ajuste fino de un modelo de lenguaje directamente en los pequeños conjuntos de datos de juicio humano de WMT producía una métrica que era frágil — sobreajustaba a los patrones específicos en los datos de entrenamiento y fallaba en entradas fuera de distribución.

La solución de BLEURT fue una receta de entrenamiento de dos fases. En la fase uno, se generaron millones de pares de oraciones sintéticas a través de eliminaciones de palabras aleatorias, inserciones, sustituciones y retrotraducción. El modelo fue entrenado para predecir puntuaciones de métricas automáticas existentes (BLEU, ROUGE, BERTScore, implicación) para estos pares — aprendiendo nociones generales de similitud textual. En la fase dos, el modelo pre-entrenado fue ajustado finamente en calificaciones de Direct Assessment de WMT. Este "calentamiento" mejoró dramáticamente la robustez.

BLEURT-20 extendió el enfoque a evaluación multilingüe usando el codificador RemBERT de Google. Pero BLEURT sigue siendo solo de referencia — no utiliza el texto fuente, lo que significa que no puede detectar alucinaciones que resulten ser fluidas, y depende completamente de la calidad de la referencia.

### COMET (Rei et al., 2020)

COMET (Crosslingual Optimized Metric for Evaluation of Translation) representa el estado actual del arte en evaluación automática de TA. Desarrollado por Ricardo Rei y colegas en **Unbabel**, COMET utiliza un codificador multilingüe (XLM-RoBERTa) para incrustar tres entradas — la oración fuente, la hipótesis de TA y la traducción de referencia — y predice una puntuación de calidad entrenada en juicios de Direct Assessment humano.

COMET ganó o se clasificó primero en Shared Tasks de Métricas de WMT desde 2020 en adelante. Su correlación con el juicio humano es sustancialmente mayor que cualquier métrica de coincidencia de cadenas. Reconoce paráfrasis, captura preservación de significado y maneja variación de sinónimos que BLEU pierde completamente.

Pero COMET tiene una limitación crítica para nuestros propósitos: está entrenado en juicios humanos de WMT, que son abrumadoramente en idiomas europeos. Su codificador multilingüe (XLM-R) fue entrenado en datos de CommonCrawl donde Plains Cree, North Sámi y la mayoría de idiomas indígenas están esencialmente ausentes. Para estos idiomas, las representaciones internas de COMET son poco confiables — puede producir puntuaciones, pero esas puntuaciones no están fundamentadas en ninguna comprensión real de la estructura del idioma.

### xCOMET (Guerreiro et al., 2024)

xCOMET, publicado en TACL 2024 por Nuno Guerreiro, Ricardo Rei y colegas en Unbabel e Instituto Superior Técnico, extendió COMET de un calificador de caja negra a una **herramienta de diagnóstico**. La innovación clave es el aprendizaje multitarea: junto con la puntuación de calidad a nivel de oración, xCOMET realiza **etiquetado de secuencia a nivel de subpalabra** para identificar tramos de error específicos en la traducción y clasificarlos como menores, mayores o críticos.

Esto cierra la brecha entre calificación automática y análisis de errores de estilo MQM. En lugar de solo reportar "esta traducción obtiene 0.73," xCOMET puede señalar las palabras específicas que están mal e indicar cuán severamente. El entrenamiento utiliza un enfoque de aprendizaje curricular: primero entrenar en datos de Direct Assessment para regresión a nivel de oración, luego agregar datos anotados con MQM con etiquetas de tramo de error para entrenamiento conjunto.

xCOMET logró rendimiento de última generación en evaluación a nivel de oración, a nivel de sistema y a nivel de tramo simultáneamente. Funciona en modos basados en referencia y sin referencia. Pero requiere datos anotados con MQM — que son costosos de crear y existen abrumadoramente para pares de idiomas europeos.

### AfriCOMET (Wang & Adelani, NAACL 2024)

AfriCOMET, publicado en NAACL 2024 por Jiayi Wang, David Ifeoluwa Adelani y colegas en la comunidad Masakhane, es la prueba más importante de que las métricas neurales *deben* adaptarse para idiomas desatendidos — no se generalizan de inmediato.

El artículo primero demostró el problema: COMET estándar, entrenado en datos de WMT de idiomas europeos, mostró correlación significativamente más débil con juicios humanos cuando se aplicó a 13 idiomas africanos (incluyendo amárico, hausa, igbo, suajili, yoruba y zulú). La solución requería dos cambios. Primero, reemplazar XLM-R con **AfroXLM-R**, un codificador multilingüe específicamente entrenado para representar mejor idiomas africanos. Segundo, crear **AfriMTE**, un nuevo conjunto de datos de evaluación humana con directrices MQM simplificadas diseñadas para anotadores no expertos — porque encontrar traductores bilingües profesionales para estos idiomas es difícil.

AfriCOMET probó el concepto: una métrica neural específica de familia de idiomas puede superar dramáticamente la versión genérica. Pero también probó el costo: alguien tuvo que construir AfroXLM-R, recopilar datos de juicio humano para 13 idiomas y entrenar un nuevo modelo. Para Plains Cree, no existe codificador equivalente, conjunto de datos de juicio humano o métrica adaptada. El camino de AfriCOMET requeriría crear todos estos desde cero — un esfuerzo de varios años que implica evaluación humana basada en la comunidad y probablemente un codificador dedicado de la familia Algonquina.

### GEMBA: LLM-as-Evaluator (Kocmi & Federmann, 2023)

GEMBA (GPT Estimation Metric Based Assessment), publicado en EAMT 2023 por Tom Kocmi y Christian Federmann en Microsoft, hizo una pregunta radical: ¿y si simplemente *preguntara* a GPT-4 si una traducción era buena?

El enfoque es desarmantemente simple. **GEMBA-DA** solicita al LLM con la fuente e hipótesis y pide una calificación de calidad en una escala de 0–100. **GEMBA-MQM** proporciona tres ejemplos anotados y pide al LLM que identifique tramos de error específicos, los clasifique por tipo y severidad, y produzca una puntuación de estilo MQM. No se requiere entrenamiento específico de métrica.

Los resultados fueron sorprendentes: a nivel de sistema, GEMBA logró correlación competitiva o de última generación con juicios humanos. Las anotaciones de error de GEMBA-MQM, aunque no tan confiables como anotadores humanos, proporcionaron información de diagnóstico interpretable sin ningún entrenamiento especializado.

Pero GEMBA plantea preocupaciones serias. Depende de modelos de código cerrado propietarios cuyo comportamiento cambia entre versiones de API. Los resultados no son reproducibles en sentido estricto. Es costoso a escala (costos de API para evaluar un conjunto de prueba completo de WMT). Y — críticamente para nuestros propósitos — el conocimiento del LLM de idiomas de recursos limitados es incierto. GPT-4 puede o no entender la morfología de Plains Cree lo suficientemente bien para evaluar traducciones; no hay forma de saberlo sin probar, y no hay garantía de que el comportamiento sea consistente entre actualizaciones de modelo. Kocmi y Federmann mismos aconsejaron contra usar GEMBA para reclamar mejoras en artículos académicos debido a la naturaleza de caja negra de la evaluación.

### MetricX y la Shared Task de Métricas de WMT 2024

**MetricX-24**, desarrollado por Juraj Juraska, Daniel Deutsch, Mara Finkelstein y Markus Freitag en Google, ganó la Shared Task de Métricas de WMT 2024. Construido en **mT5** (Multilingual T5, un modelo codificador-decodificador en lugar del codificador único XLM-R utilizado por COMET), MetricX toma un camino arquitectónico diferente. Utiliza ajuste fino de dos etapas — primero en datos de Direct Assessment, luego en puntuaciones MQM — con **aumento de datos sintéticos** extenso dirigido a modos de falla de métrica conocidos (subtraducciones, traducciones fluidas pero incorrectas, alucinaciones).

El documento de hallazgos de WMT 2024, titulado **"Are LLMs Breaking MT Metrics?"**, preguntó si las traducciones generadas por LLM habían roto el ecosistema de métricas. La respuesta fue un no calificado: las métricas neurales ajustadas finamente (MetricX-24, variantes de COMET) permanecieron efectivas, aunque las métricas basadas en LLM (variantes de GEMBA) mostraron una fortaleza sorprendente a nivel de sistema. Hallazgos clave:

- Las **métricas conscientes de la fuente** (usando fuente + referencia + hipótesis) consistentemente superaron las métricas solo de referencia
- Los **modelos híbridos** que operan en modos basados en referencia y sin referencia desde una única arquitectura son la dirección emergente
- La **brecha de recursos limitados** persiste: todas las métricas funcionan peor en idiomas subrepresentados, y la brecha no se está cerrando
- Las **métricas entrenadas con MQM** (usando anotaciones de error de grano fino) consistentemente superan las métricas entrenadas con DA (usando puntuaciones escalares)

Las implicaciones para evaluación de recursos limitados son claras: el campo está convergiendo en métricas neurales grandes, entrenadas y conscientes de la fuente como el estándar de oro. Estas métricas requieren datos de entrenamiento sustanciales, computación y — críticamente — datos de evaluación humana en el idioma objetivo. Para idiomas sin ninguno de estos recursos, la canalización de métrica de última generación simplemente no se aplica.

### El Problema del Sesgo: Métricas Neurales e Idiomas de Recursos Limitados

La revolución de métricas neurales ha sido, abrumadoramente, un fenómeno de recursos altos. Cada métrica entrenada en las secciones anteriores fue entrenada en datos de juicio humano de WMT, que cubre aproximadamente 20 pares de idiomas — todos ellos involucrando idiomas europeos, chino o japonés. Los codificadores subyacentes (XLM-R, mT5, InfoXLM) fueron entrenados en datos de CommonCrawl donde la representación es proporcional a la presencia web: el inglés domina, los idiomas europeos están bien cubiertos, y la gran mayoría de los 7,000+ idiomas del mundo están efectivamente ausentes.

Para un idioma como Plains Cree, esto crea un fallo en cascada:

1. **Sin datos de entrenamiento**: No hay juicios humanos de WMT para traducciones de Cree, por lo que ninguna métrica ha sido entrenada para evaluarlas.
2. **Sin cobertura de codificador**: El vocabulario de XLM-R fue construido en CommonCrawl, donde el texto de Cree es vanishingly raro. El tokenizador sobre-segmenta palabras de Cree en fragmentos de bytes arbitrarios, y las incrustaciones contextuales para esos fragmentos están mal entrenadas.
3. **Sin validación**: Nadie ha medido si COMET, BLEURT o MetricX produce puntuaciones significativas para Cree. Pueden producir *números*, pero no hay evidencia de que esos números se correlacionen con la calidad real de la traducción.
4. **Sin camino a la mejora**: El enfoque de AfriCOMET — construir un codificador específico de familia de idiomas, recopilar datos de evaluación humana, entrenar una nueva métrica — es un esfuerzo de varios años, multi-institución. Para una comunidad de idiomas de 20,000 hablantes, la infraestructura de investigación para apoyar esto no existe actualmente.

El resultado es una paradoja: los idiomas que más urgentemente necesitan evaluación de TA (porque sus sistemas de TA son más débiles y necesitan la evaluación más cuidadosa) son precisamente los idiomas donde las mejores herramientas de evaluación son menos confiables. La respuesta del campo ha sido recomendar chrF++ como una alternativa "lo suficientemente buena" — y es mejor que BLEU — pero chrF++ sigue siendo una métrica de coincidencia de cadenas que no puede detectar equivalencia, no puede manejar orden de palabras libre y no tiene concepto de validez morfológica.

---

## Parte 3: Más Allá de la Calificación — Evaluación Diagnóstica y Lingüística

### La División Adecuación/Fluidez

Antes de que existieran métricas automáticas, la evaluación humana de TA utilizaba un marco con dos dimensiones: **adecuación** (¿la traducción transmite el significado de la fuente?) y **fluidez** (¿es la traducción gramatical y natural en el idioma objetivo?). Esta distinción, codificada en evaluaciones tempranas de DARPA MT y posteriormente en NIST, reconoció algo que las métricas automáticas pasarían dos décadas intentando recapturar: la calidad de la traducción no es unidimensional.

El marco de adecuación/fluidez cayó en desuso cuando Direct Assessment (una puntuación escalar única) lo reemplazó en WMT. Pero la idea subyacente sigue siendo crítica: una traducción puede ser fluida pero incorrecta (alucinación), o desfluida pero correcta (variante morfológica). Ninguna puntuación única captura ambas.

### MQM: El Estándar de Oro (Lommel et al., 2014; Freitag et al., 2021)

**Multidimensional Quality Metrics (MQM)** reemplazó Direct Assessment como la evaluación humana primaria de WMT desde 2021 en adelante. MQM utiliza traductores profesionales que marcan tramos de error específicos, los clasifican por tipo (error de traducción, omisión, adición, gramática, terminología) y severidad (menor = 1 punto, mayor = 5 puntos, crítico = 25 puntos). Esto produce tanto una puntuación de calidad como información de diagnóstico procesable.

MQM es lo más cercano a una metodología de evaluación "correcta" — te dice no solo *qué tan malo* es una traducción, sino *qué específicamente salió mal*. Pero requiere traductores profesionales bilingües, que para la mayoría de idiomas de recursos limitados no existen en números suficientes para evaluación estadísticamente confiable.

### MorphEval: Evaluación Morfológica Contrastiva (Burlot & Yvon, 2017)

MorphEval es el arte previo más directo para evaluación de TA consciente de morfología. Introducido por Franck Burlot y François Yvon en WMT 2017 y extendido en 2018, MorphEval evalúa *competencia* morfológica usando **conjuntos de prueba contrastivos**.

**Cómo funciona:** El conjunto de prueba consiste en pares de oraciones en el idioma fuente que difieren exactamente en un contraste morfológico — por ejemplo, singular vs. plural, presente vs. pasado, masculino vs. femenino. El sistema de TA traduce ambas oraciones. Si el sistema transmite correctamente el contraste en sus traducciones (p. ej., produciendo un objetivo plural cuando la fuente es plural y un objetivo singular cuando la fuente es singular), el contraste se califica como correcto.

**Idiomas cubiertos:** English→Czech, English→Latvian (v1, WMT 2017); extendido a English→French, English→German, English→Finnish, Turkish→English (v2, WMT 2018).

**Hallazgos clave:** MorphEval reveló que incluso los sistemas de TA neural de mejor desempeño tenían fallos morfológicos sistemáticos — podían producir salida fluida mientras obtenían tiempo, número o caso incorrectos. Estos errores eran invisibles para BLEU e incluso parcialmente invisibles para COMET.

**Disponibilidad:** Código abierto en GitHub ([franckbrl/morpheval](https://github.com/franckbrl/morpheval), [franckbrl/morpheval_v2](https://github.com/franckbrl/morpheval_v2)).

**Limitaciones:** MorphEval requiere conjuntos de prueba contrastivos diseñados por idioma objetivo, diseñados por lingüistas que entienden los contrastes morfológicos de ese idioma. No existen conjuntos de prueba para ningún idioma polisintético. La metodología prueba *competencia* (¿puede el sistema manejar este contraste?) en lugar de *validez* (¿produjo el sistema palabras reales?) o *equivalencia* (¿son estas dos traducciones diferentes ambas correctas?).

### CheckList: Pruebas de Comportamiento para NLP (Ribeiro et al., ACL 2020)

**CheckList**, publicado en ACL 2020 por Marco Tulio Ribeiro y colegas (ganando Mejor Artículo), importó una idea de la ingeniería de software a la evaluación de NLP: **pruebas unitarias**. En lugar de evaluar el rendimiento agregado de un modelo en un punto de referencia, CheckList define una matriz de **capacidades** (vocabulario, negación, entidades nombradas, razonamiento temporal, correferencia) cruzadas con **tipos de prueba**:

- **Pruebas de Funcionalidad Mínima (MFT)**: Casos de prueba simples y dirigidos que cualquier modelo competente debería pasar.
- **Pruebas de Invariancia (INV)**: Perturbaciones a la entrada que *no* deberían cambiar la salida (p. ej., cambiar un nombre no debería cambiar el sentimiento).
- **Pruebas de Expectativa Direccional (DIR)**: Perturbaciones que *deberían* cambiar la salida de una manera predecible.

Checklist fue originalmente diseñado para análisis de sentimiento e NLI, pero el paradigma es directamente aplicable a TA. Se podría crear MFTs para fenómenos morfológicos ("¿produce el sistema la forma plural correcta?"), pruebas INV para orden de palabras libre ("¿cambiar el orden de las palabras de Cree cambia la traducción al inglés?"), y pruebas DIR para características morfológicas ("¿cambiar la fuente de pasado a presente cambia el tiempo objetivo?").

El paradigma de CheckList es particularmente relevante porque formaliza lo que MorphEval hace intuitivamente: probar capacidades específicas en lugar de medir puntuaciones agregadas. Las clases de variante de nuestro linter (WORD_ORDER, ORTHOGRAPHIC, OPTIONAL_PARTICLE, etc.) son, en efecto, reglas de invariancia — definen perturbaciones que no deberían cambiar el veredicto de evaluación.

### Conjuntos de Desafío y Evaluación Dirigida

El paradigma más amplio de **conjuntos de desafío** — conjuntos de prueba diseñados dirigidos a fenómenos lingüísticos específicos — se ha convertido en una metodología de evaluación complementaria establecida en WMT desde aproximadamente 2017.

**Isabelle, Cherry & Foster (2017)**, en NRC Canada, pioneros del enfoque para TA con conjuntos de prueba diseñados a mano aislando divergencias estructurales entre idiomas — casos donde la traducción literal es probable que sea incorrecta. Su trabajo de seguimiento (Isabelle & Kuhn, 2018) construyó 506 oraciones francesas dirigidas a desafíos de traducción específicos, proporcionando imágenes de grano fino de capacidades del sistema.

**LingEval97** (Sennrich, EACL 2017) creó 97,000 pares de traducción contrastivos English→German probando si los modelos NMT asignan mayor probabilidad a traducciones correctas versus pares con errores morfosintácticos introducidos. Un hallazgo clave: los modelos a nivel de carácter excelieron en transliteración pero funcionaron peor en acuerdo morfosintáctico de larga distancia.

**ACES** (Amrhein, Moghe & Guillou, 2022–2023) escaló el enfoque de conjunto de desafío dramáticamente: 36,476 ejemplos abarcando 146 pares de idiomas probando 68 fenómenos lingüísticos distintos. ACES fue utilizado para meta-evaluar métricas presentadas a la tarea compartida de métricas de WMT — probando si *métricas* podían detectar los contrastes, no solo si *sistemas* podían producirlos. Extendido a **SPAN-ACES** con anotaciones de tramo de error.

**MT-GenEval** (Currey et al., EMNLP 2022) y **WinoMT** (Stanovsky, Smith & Zettlemoyer, ACL 2019) se dirigen a precisión de género específicamente. WinoMT es notable porque explícitamente utiliza **análisis morfológico** en el idioma objetivo para verificar el género de ocupaciones traducidas — uno de los pocos casos donde un analizador morfológico se utiliza como parte de una herramienta de evaluación de TA.

**Hjerson** (Popović & Ney, 2011) es una herramienta de código abierto para clasificación automática de errores de TA que utiliza **lemas y etiquetas POS** para categorizar errores en cinco tipos: morfológicos, reordenamiento, palabras faltantes, palabras extra y errores léxicos. Este es quizás el arte previo más cercano a nuestro linter en espíritu — utiliza análisis lingüístico para proporcionar categorías de error de diagnóstico en lugar de una puntuación única.

El hilo común: el campo ha reconocido, repetidamente, que las puntuaciones agregadas son insuficientes. La evaluación de diagnóstico proporciona la granularidad necesaria para entender *por qué* un sistema falla. Pero los enfoques de diagnóstico requieren experiencia lingüística por idioma, y esa experiencia está concentrada en idiomas europeos.

### AmericasNLP: Evaluación en las Trincheras

La serie de talleres AmericasNLP (co-ubicada con NAACL), enfocada en NLP para idiomas indígenas de las Américas, proporciona el punto de comparación más directo para nuestros desafíos de evaluación.

De 2021 a 2023, la tarea compartida utilizó **chrF** como su métrica de evaluación primaria — elegida por su robustez en configuraciones de recursos limitados y su coincidencia a nivel de carácter, que proporciona crédito parcial por superposición morfológica. Los organizadores reconocieron las limitaciones de chrF pero no tenían mejor alternativa que funcionara en las tipologías diversas representadas (Quechua, Guaraní, Aymara, Nahuatl, Rarámuri y otros).

En 2025, AmericasNLP introdujo una **Shared Task 3** dedicada específicamente al desarrollo de métricas de evaluación de TA para idiomas indígenas — la primera vez que el campo explícitamente reconoció que las métricas existentes son inadecuadas para estos idiomas. La presentación ganadora, **FUSE** (Feature-Union Scorer), combinó incrustaciones de oraciones multilingües (LaBSE ajustado finamente), similitud léxica, similitud fonética y coincidencia de tokens difusa vía regresión Ridge y Gradient Boosting. FUSE no utiliza analizadores morfológicos — la ingeniería de características es agnóstica del idioma.

Esta es la brecha que nuestro trabajo ocupa. AmericasNLP ha identificado el problema (las métricas estándar fallan para idiomas indígenas) y comenzado a desarrollar alternativas (FUSE). Pero ninguna de las alternativas utiliza el conocimiento morfológico que los FSTs proporcionan. La comunidad de AmericasNLP utiliza chrF++ porque es la mejor opción genérica disponible, mientras que la comunidad de GiellaLT construye herramientas morfológicas sofisticadas que nunca se conectan a la evaluación de TA. Las dos comunidades no han convergido.

---

## Parte 4: Evaluación Sin Referencia y Estimación de Calidad

Algunas de las señales de evaluación más importantes en nuestro arnés no requieren traducciones de referencia en absoluto. La verificación de validez del FST ("¿es esta una palabra real?") necesita solo la salida de TA. El detector de alucinación necesita la fuente e hipótesis. El detector de cambio de código necesita solo la hipótesis y conocimiento del script del idioma objetivo. Entender dónde encajan estos en el panorama más amplio de evaluación sin referencia es esencial para posicionarlos correctamente.

### El Paradigma de Estimación de Calidad

**Quality Estimation (QE)** es el subcampo de evaluación de TA preocupado por predecir la calidad de la traducción *sin* traducciones de referencia. Ha sido una tarea compartida dedicada en WMT desde 2012, motivada por la necesidad práctica de evaluar la calidad de TA en tiempo de implementación — cuando está traduciendo texto nuevo y no tiene referencia humana para comparar.

La tarea de QE ha evolucionado a través de tres generaciones. **QE basado en características** (2012–2016) extrajo características diseñadas a mano de la fuente e hipótesis — perplejidad del modelo de lenguaje, frecuencia de palabras, superposición de n-gramas con datos monolingües — y entrenó clasificadores para predecir calidad. **QE neural** (2017–2021) reemplazó características diseñadas a mano con representaciones aprendidas, típicamente usando codificadores bilingües. **QE actual** (2022–presente) está dominado por enfoques basados en COMET, particularmente **CometKiwi**.

### CometKiwi y COMET Sin Referencia

**CometKiwi** (Rei et al., WMT 2022), la variante sin referencia de COMET, utiliza InfoXLM para codificar la oración fuente e hipótesis de TA (sin referencia) y predice una puntuación de calidad. Logró resultados de última generación en las tareas compartidas de QE de WMT 2022 y 2023.

El hallazgo notable: CometKiwi sin referencia se aproxima a la correlación con juicio humano lograda por COMET basado en referencia. Esto sugiere que, para idiomas bien dotados de recursos, el texto fuente contiene casi tanta señal de evaluación como la traducción de referencia. Pero la misma advertencia se aplica: el codificador de CometKiwi tiene representación mínima para idiomas de recursos limitados, por lo que sus predicciones sin referencia para Cree o Sámi son poco confiables.

Aquí es donde nuestras métricas basadas en FST ofrecen algo genuinamente diferente. La verificación de validez del FST es una **señal de calidad determinística y sin referencia** que no requiere modelo entrenado ni datos de juicio humano. Si el FST dice que una palabra no es una palabra válida de Cree, esa palabra no es una palabra válida de Cree — con la salvedad de rechazos falsos para palabras prestadas, neologismos y nombres propios. Este tipo de señal de calidad dura y basada en reglas no tiene equivalente en el ecosistema de QE neural.

### Detección de Alucinación en TA

Alucinación en TA — salida fluida que está completamente desconectada de la fuente — es un modo de fallo serio, particularmente en configuraciones de recursos limitados donde los modelos tienen datos de entrenamiento insuficientes para aprender correspondencias confiables fuente-objetivo.

El estado del arte académico en detección de alucinación utiliza varios enfoques:

- **Detección basada en incrustación**: Comparar incrustaciones de fuente e hipótesis en un espacio compartido (LASER, LaBSE) e indicar casos donde la similitud está por debajo de un umbral.
- **Detección basada en probabilidad**: Usar las propias puntuaciones de confianza del modelo de TA — las alucinaciones tienden a tener alta probabilidad de salida pero baja probabilidad condicionada a la fuente.
- **Perturbación contrastiva**: Comparar la salida de TA para la fuente real contra la salida para una fuente perturbada o no relacionada; si las salidas son sospechosamente similares, el modelo está ignorando la fuente.
- **LLM-as-judge**: Solicitar a un LLM que evalúe si la traducción es fiel a la fuente.

Nuestro arnés utiliza un **complemento de detección heurística** que combina cuatro señales: inflación de longitud (hipótesis mucho más larga de lo esperado), repetición (frases repetidas), desajuste de entidad (entidades nombradas en la fuente faltantes de la hipótesis) y eco de fuente (hipótesis demasiado similar al texto fuente, sugiriendo copia sin traducir). Esto es nivel de línea de base comparado con SOTA académico — atrapa alucinaciones brutas pero perderá las sutiles. Su valor es como una **pantalla barata, rápida e interpretable** que puede indicar los peores fallos sin requerir una GPU o una llamada a API.

### Detección de Cambio de Código

Cambio de código en salida de TA — donde el sistema produce palabras en el idioma fuente en lugar de traducirlas — es un modo de fallo distinto de la alucinación. Típicamente ocurre cuando el modelo encuentra una palabra que no puede traducir y recurre a copiar la fuente.

Nuestro complemento de detección de cambio de código utiliza **análisis de bloque Unicode** (detectando caracteres del script del idioma fuente en lo que debería ser salida del idioma objetivo) y **listas de palabras comunes** (identificando palabras de alta frecuencia del idioma fuente que aparecen sin traducir). Para Cree, que utiliza tanto SRO (basado en latín) como silabarios, esto requiere cierto cuidado — inglés y SRO comparten el script latino, por lo que el análisis de bloque Unicode solo es insuficiente.

La literatura académica sobre detección de cambio de código en TA es escasa comparada con detección de alucinación. La mayoría del trabajo se enfoca en cambio de código en texto de *entrada* (hablantes bilingües mezclando idiomas) en lugar de en texto de *salida* (sistemas de TA fallando en traducir). Nuestro enfoque heurístico es, según nuestro conocimiento, no significativamente detrás de ningún estado del arte publicado para este problema específico.

---

## Parte 5: La Brecha Morfológica

### Lo Que las Métricas Existentes No Pueden Ver

Este es el argumento central de este documento, y requiere una demostración concreta.

Considere el par de oraciones de Plains Cree:

| | Texto |
|--|------|
| **Fuente (Inglés)** | "I saw the man" |
| **Referencia (Cree)** | *nikî-wâpamâw nâpêw* |
| **Hipótesis A** | *nâpêw nikî-wâpamâw* |
| **Hipótesis B** | *nikî-wâpamikow nâpêsis* |

**Hipótesis A** es una traducción perfecta — tiene las mismas palabras en un orden diferente, que es gramatical en Cree (orden de palabras libre). **Hipótesis B** dice "el niño fue visto por mí" — dirección de acción incorrecta (*-ikow* es inverso), referente incorrecto (*nâpêsis* = "niño", no "hombre").

| Métrica | Hipótesis A (correcta) | Hipótesis B (incorrecta) | ¿Puede distinguirlas? |
|--------|----------------------|---------------------|------------------------|
| BLEU | ~30% | ~20% | Apenas |
| chrF++ | ~65% | ~55% | Algo |
| COMET | Desconocido (sin datos de entrenamiento de Cree) | Desconocido | Poco confiable |
| **Aceptación FST** | 100% | 100% | No (ambas son Cree válido) |
| **Linter** | EQUIVALENTE (WORD_ORDER) | MISS | **Sí** |
| **Validador semántico** | VÁLIDO | INCORRECTO | **Sí** |

El linter y validador semántico tienen éxito donde BLEU, chrF++ y COMET fallan — no porque sean "mejores métricas" en algún sentido universal, sino porque tienen acceso a *conocimiento lingüístico* que las métricas de coincidencia de cadenas y neurales no tienen. Saben que Cree tiene orden de palabras libre. Saben que *wâpamêw* y *wâpamikow* son lemas diferentes con estructuras de argumentos diferentes. Saben que *nâpêw* y *nâpêsis* son palabras diferentes.

Este conocimiento proviene del FST (que codifica la gramática morfológica), el diccionario bilingüe (que proporciona glosas en inglés para cada lema) y las clases de variante definidas manualmente (que codifican reglas de equivalencia fundamentadas lingüísticamente). Ninguno de este conocimiento está disponible para una métrica que trata la traducción como una cadena.

### Por Qué el Campo No Ha Abordado Esto

La brecha morfológica en evaluación de TA no es un misterio. El campo sabe que existe. Las razones por las que persiste son estructurales:

1. **Sesgo de escala.** La comunidad de evaluación de TA optimiza para métricas que funcionan en todos los pares de idiomas de WMT. Las métricas basadas en FST funcionan para ~30 idiomas. COMET funciona para 100+. chrF++ funciona para todos los idiomas con un sistema de escritura. La comunidad recompensa la universalidad sobre la precisión.

2. **Silos comunitarios.** Las personas que construyen FSTs (lingüistas computacionales en UiT Tromsø, NRC Canada, Universidad de Alberta) y las personas que construyen métricas de evaluación (investigadores de ML en Google, Unbabel, WMT) asisten a conferencias diferentes, publican en lugares diferentes y operan bajo estructuras de incentivos diferentes. La polinización cruzada que sería requerida para construir métricas de evaluación basadas en FST no ha ocurrido — no porque fue intentada y falló, sino porque las comunidades nunca convergieron.

3. **Ansiedad de cobertura.** Los FSTs tienen problemas de rechazo falso conocidos: palabras prestadas, neologismos y nombres propios pueden ser rechazados como inválidos incluso cuando son perfectamente aceptables. Esto hace que los investigadores sean nerviosos sobre usar FSTs como métricas — un rechazo falso infla la tasa de error. La preocupación es válida pero cuantificable: medir la tasa de rechazo falso en texto conocido-bueno es directo.

4. **Demanda insuficiente.** Muy pocas personas están construyendo TA para idiomas polisintéticos, y las que lo hacen (ALT Lab, NRC, participantes de AmericasNLP) típicamente están usando chrF++ porque eso es lo que existe. No ha habido un empuje concertado de la comunidad de TA de recursos limitados por evaluación consciente de morfología, en parte porque la comunidad es pequeña y en parte porque construir tales métricas requiere experiencia tanto en ingeniería de NLP como en la morfología del idioma objetivo específico.

5. **La suposición de métrica neural.** La suposición prevaleciente desde 2020 ha sido que las métricas neurales eventualmente resolverán el problema morfológico a través de representaciones aprendidas. Si entrena COMET en suficientes datos de idiomas morfológicamente ricos, el argumento va, aprenderá a manejar variación morfológica implícitamente. Esto puede ser verdadero para idiomas morfológicamente ricos de recursos altos (finlandés, turco, checo). Es improbable que sea verdadero para idiomas con representación efectivamente cero en los datos de entrenamiento.

---

## Parte 6: LYSS — Una Alternativa Fundamentada Lingüísticamente

### Lo Que champollion Construyó: LYSS (Linguistically-informed Yield & Structural Scoring)

El arnés de evaluación del proyecto champollion implementa un marco de calificación compuesto llamado **LYSS** que combina métricas estándar (chrF++, coincidencia exacta) con cuatro categorías de métricas fundamentadas lingüísticamente. El nombre refleja el enfoque del marco: medir el *rendimiento* (cuánto significado sobrevive el proceso de traducción) a través de *calificación estructural* (verificaciones determinísticas fundamentadas lingüísticamente en lugar de incrustaciones aprendidas).

#### 1. Puerta de Validez Morfológica (Métrica FST de GiellaLT)

La métrica más simple y ampliamente aplicable: alimentar cada palabra de la salida de TA a través del analizador morfológico de estado finito de GiellaLT para el idioma objetivo. Si el FST puede analizar una palabra (devuelve al menos un análisis), la palabra es morfológicamente válida. Si no, la palabra no existe en el idioma objetivo — es una palabra alucinada, un error morfológico, un error ortográfico o una palabra prestada no en el léxico.

**Salida:** `fst_validity_rate` (0.0–1.0, mayor = mejor). Promedio macro (media de tasas por entrada) y promedio micro (palabras válidas totales / palabras totales).

**Dependencias:** `pyhfst` (enlaces de Python de Helsinki Finite-State Technology), un archivo analizador `.hfstol` compilado para el idioma objetivo.

**Extensibilidad:** Funciona para cualquier idioma con un analizador FST de GiellaLT — actualmente ~30+ idiomas, principalmente Sámi, Uralic e idiomas indígenas árticos.

**Relación con arte previo:** MorphEval prueba si un sistema puede manejar contrastes específicos. La métrica FST prueba si la salida del sistema consiste en palabras reales. Estos son complementarios: MorphEval prueba competencia, la métrica FST prueba validez.

#### 2. Clases de Equivalencia Lingüística (Linter de CRK)

El linter aborda lo que puede ser el modo de fallo más insidioso de la evaluación basada en referencia: **penalizar traducciones correctas que difieren de la referencia**.

El linter de Plains Cree (844 líneas) implementa seis **clases de variante**, cada una codificando una regla de equivalencia fundamentada lingüísticamente:

- **WORD_ORDER**: Cree tiene orden de palabras pragmáticamente libre (Wolfart, 1973 §3.2). *nikî-wâpamâw nâpêw* y *nâpêw nikî-wâpamâw* significan lo mismo. El linter genera todas las permutaciones y verifica si la hipótesis coincide con alguna.
- **ORTHOGRAPHIC**: La Ortografía Romana Estándar tiene puntos de variación conocidos — circunflejo vs. macrón (*â* vs. *ā*), guionización de preverbs (*nikî-nipâw* vs. *nikî nipâw* vs. *nikînipâw*). El linter normaliza estos.
- **OPTIONAL_PARTICLE**: Ciertas partículas de discurso (*mâka*, *êkwa*, *êwako*) pueden estar presentes o ausentes sin cambiar la proposición central. El linter verifica si la hipótesis coincide con la referencia después de la eliminación de partículas.
- **LEMMA_SYNONYM**: Algunos lemas de Cree son intercambiables en contextos específicos. Esto utiliza una lista de sinónimos curada (p. ej., variantes dialectales) y, cuando el FST está disponible, verifica si la hipótesis y referencia comparten análisis morfológicos.
- **PROGRESSIVE_AMBIGUITY**: Las formas progresivas en inglés ("is walking") pueden traducirse al Cree usando diferentes construcciones. El linter reconoce estos como equivalentes.
- **INCLUSIVE_EXCLUSIVE**: Cree distingue "nosotros" inclusivo (*ki-* prefijo) de "nosotros" exclusivo (*ni-* prefijo) — una distinción que el inglés colapsa en un único pronombre. El linter reconoce que cualquiera de las formas puede ser correcta cuando la fuente en inglés es ambigua.

El linter produce tres veredictos: **EXACT** (hipótesis coincide con referencia), **EQUIVALENT** (hipótesis difiere pero se clasifica como una variante válida), o **MISS** (no se encontró coincidencia). A nivel agregado, calcula un `equivalent_match_rate` — la proporción de traducciones que son exactas o equivalentes.

**Relación con arte previo:** El paralelo más cercano es **HyTER** (Dreyer & Marcu, NAACL-HLT 2012), que codifica exponencialmente muchas traducciones válidas como redes de paráfrasis y mide distancia de edición a la forma válida más cercana. Nuestro linter es conceptualmente similar — define un conjunto de traducciones válidas para cada referencia — pero utiliza reglas de transformación definidas lingüísticamente en lugar de bases de datos de paráfrasis. HyTER fue diseñado para inglés; nadie ha construido redes de paráfrasis para Cree. Nuestras reglas de variante son, en efecto, una aproximación compacta basada en reglas de lo que HyTER hace con gráficos.

En el marco de CheckList, nuestras reglas de variante funcionan como **pruebas de invariancia**: transformaciones que no deberían cambiar el veredicto de evaluación. La diferencia es que las pruebas de CheckList típicamente se aplican al *modelo*; nuestras reglas de variante se aplican a la *métrica*.

#### 3. Validación Semántica Determinística (Métrica Semántica de CRK)

El validador semántico (792 líneas) intenta algo más ambicioso: **comparación de significado determinística** sin incrustaciones neurales. Opera en cuatro etapas:

1. **Análisis morfológico**: Tanto la hipótesis como la referencia se pasan por el analizador CRK FST, que devuelve el lema y las características morfológicas de cada palabra.
2. **Resolución de glosas**: Cada lema se busca mediante la API del diccionario itwêwina —que sirve a Wolvengrey (2001) junto con los diccionarios de Maskwacîs y Alberta Elders'— para obtener glosas en inglés.
3. **Extracción de palabras de contenido**: Usando el pipeline en inglés de spaCy (`en_core_web_md`), se filtran las palabras funcionales tanto de las glosas en inglés como del texto de origen.
4. **Puntuación de superposición**: La superposición de palabras de contenido entre las glosas de la hipótesis y las glosas de la referencia determina el veredicto semántico.

El validador produce veredictos categóricos: **EXACT_MATCH**, **VALID** (palabras diferentes pero mismo significado), **GRAMMAR_ISSUES** (lemas correctos pero problemas de gramática a nivel de oración — acuerdo, animacidad, forma de verbo), **PARTIAL** (algo de significado preservado), **INCOMPLETE** (significado parcialmente faltante), **WRONG** (significado diferente), o **NO_OUTPUT**.

**Relación con arte previo:** Esto es, en efecto, una **aproximación determinística de la computación de similitud semántica de COMET**. Donde COMET utiliza incrustaciones multilingües aprendidas para evaluar si dos oraciones significan lo mismo, nuestro validador utiliza una cadena de búsquedas determinísticas: FST → diccionario → spaCy. La ventaja es transparencia (cada paso es inspectable y determinístico) e independencia de datos de entrenamiento. La desventaja es fragilidad: la calidad de la evaluación depende completamente de la cobertura del FST y la completitud del diccionario.

El enfoque está conceptualmente relacionado con **MEANT** (Lo & Wu, 2011; Lo, 2017), que utilizó etiquetado de rol semántico para evaluar si la estructura "quién hizo qué a quién" fue preservada en la traducción. Nuestro enfoque es más de grano grueso (superposición de palabras de contenido en lugar de roles semánticos) pero opera en un idioma donde no existen herramientas de SRL.

#### 4. Complementos de Detección de Comportamiento (Alucinación, Cambio de Código, Terminología)

Tres complementos adicionales proporcionan **señales de calidad de comportamiento** que complementan las métricas morfológicas:

- **Detección de alucinación** (259 líneas): Cuatro señales heurísticas ponderadas y combinadas — inflación de longitud (40%), repetición (30%), desajuste de entidad (20%), eco de fuente (10%). Estas son pantallas baratas y sin referencia que atrapan fabricación bruta.
- **Detección de cambio de código** (~280 líneas): Análisis de bloque Unicode más listas de palabras comunes para detectar tokens del idioma fuente sin traducir. Produce un `code_switching_rate` (0.0–1.0).
- **Adherencia de terminología** (199 líneas): Verifica si los términos de glosario especificados se traducen consistentemente. Devuelve `terminology_adherence` (0.0–1.0) o None si no se configura glosario.

Estos complementos se posicionan honestamente como **detectores heurísticos de línea de base**, no SOTA de última generación. Su valor está en proporcionar señales baratas, rápidas e interpretables que pueden calcularse junto con las métricas morfológicas más sofisticadas. En el marco de calificación compuesto, llevan pesos bajos (0.05 cada uno).

### Limitaciones Honestas

Este enfoque tiene limitaciones significativas que deben reconocerse antes de cualquier reclamación de novedad o utilidad:

1. **Tasa de rechazo falso del FST.** El FST rechazará palabras válidas que no están en su léxico — palabras prestadas, neologismos, nombres propios, términos de código mixto. Esto infla la tasa de error morfológico. La tasa de rechazo falso no ha sido formalmente medida en un corpus representativo de texto de Cree. Sin esta medición, la precisión de la métrica de validez del FST es desconocida.

2. **Cobertura del diccionario.** La calidad del validador semántico depende completamente de la cobertura del diccionario de Wolvengrey. Las palabras en cree que no están en el diccionario no producen glosas, lo cual el validador trata como un vacío de significado. El diccionario contiene aproximadamente entre 18,000 y 22,000 entradas (los recuentos varían según la edición y el método de conteo) — sustancial, pero no exhaustivo.

3. **Completitud de clase de variante.** Las seis clases de variante del linter fueron diseñadas basadas en literatura lingüística y observación de patrones de salida de TA. Puede haber clases de equivalencia adicionales no capturadas — variaciones dialectales, diferencias de registro, sinónimos a nivel de discurso. Ningún proceso formal asegura completitud.

4. **Sin estudio de correlación humana.** La brecha más crítica: nadie ha medido si los veredictos del linter (EXACT/EQUIVALENT/MISS) o los veredictos del validador semántico se correlacionan con juicios humanos de calidad de traducción. Las métricas neurales pasan años estableciendo correlación con evaluación humana (tareas compartidas de WMT). Nuestras métricas no tienen tal validación.

5. **Especificidad del idioma.** Las clases de variante, listas de sinónimos y reglas de partículas opcionales son específicas para Plains Cree. Portarlas a North Sámi, Inuktitut o cualquier otro idioma requiere lingüistas que entiendan la morfología, flexibilidad de orden de palabras y variación ortográfica de ese idioma. El *marco* es portable; las *reglas* no.

6. **Brechas de cableado de métrica.** A partir de este escrito, cuatro de las nueve métricas en el perfil de calificación compuesto (semantic_score, morphological_accuracy, equivalent_match_rate, orthographic_accuracy) tienen cableado de complemento incompleto o poco claro en el arnés de arena. La puntuación compuesta se calcula efectivamente de aproximadamente cinco métricas con pesos redistribuidos.

### Lo Que Sería Requerido para Validar Este Enfoque

Para hacer que esto sea publicable — en cualquier lugar, en cualquier nivel de seriedad académica — los siguientes experimentos serían requeridos:

1. **Estudio de correlación de juicio humano.** Recopilar evaluaciones de calidad humana para un conjunto de traducciones English→Cree (idealmente 200+ pares de oraciones evaluados por 3+ hablantes bilingües). Calcular correlaciones entre puntuaciones humanas y cada una de nuestras métricas. Esta es la validación más importante. Sin ella, las métricas son artefactos de ingeniería, no herramientas de evaluación.

2. **Medición de tasa de rechazo falso del FST.** Ejecutar el analizador FST en un corpus de texto de Cree conocido-bueno (p. ej., textos de Cree publicados, corpus paralelos validados) y medir qué porcentaje de palabras válidas son rechazadas. Esto cuantifica la precisión de la métrica de validez del FST.

3. **Validación de segundo idioma.** Portar la métrica de validez del FST a un segundo idioma de GiellaLT (más probablemente North Sámi, que tiene el analizador FST más maduro en el ecosistema de GiellaLT). Demostrar que la métrica produce resultados sensatos en salida de TA de Sámi. Esto valida la reclamación de extensibilidad.

4. **Comparación con COMET.** Ejecutar COMET en los mismos datos de Cree y comparar sus puntuaciones con nuestras métricas y con juicios humanos. Si COMET produce puntuaciones significativas para Cree (que dudamos, pero no hemos probado), nuestras métricas necesitan superarlo para ser útiles. Si COMET produce ruido (que esperamos), esto valida la necesidad de nuestro enfoque.

5. **Complemento de diagnóstico de MorphEval.** Construir un pequeño (50–100 contrastes) conjunto de prueba de estilo MorphEval para Plains Cree dirigido a las características morfológicas más distintivas del idioma (obviativo, inverso, conjuntivo/independiente, inclusivo/exclusivo). Ejecutar sistemas de TA contra él y mostrar que la información de diagnóstico es procesable.

6. **Auditoría de cableado e integración.** Arreglar las brechas de cableado del perfil de calificación identificadas en el inventario de código. Asegurar que las nueve métricas compuestas produzcan valores y que la puntuación agregada se calcule correctamente.

---

## Parte 7: Posicionamiento y Trabajo Futuro

### Dónde LYSS Se Sienta en el Panorama de Evaluación

Una taxonomía de enfoques de evaluación de TA, posicionada honestamente:

| Dimensión | Métricas de cadena (BLEU, chrF++) | Métricas neurales (COMET, MetricX) | LLM-as-judge (GEMBA) | Diagnóstico (MorphEval, CheckList) | **LYSS** |
|-----------|-------------------------------|---|----|-------|--------|
| Tipo de señal | Superposición de superficie | Similitud semántica aprendida | Juicio de extremo abierto | Sondas de capacidad dirigida | Validez morfológica + equivalencia basada en reglas |
| Datos de entrenamiento necesarios | Ninguno | Juicios humanos (miles) | LLM pre-entrenado | Conjuntos de prueba diseñados por lingüista | FST + diccionario + reglas de variante |
| Aplicabilidad de LRL | Universal pero débil | Limitado por cobertura de codificador | Limitado por cobertura de LLM | Limitado por creación de conjunto de prueba | Limitado por disponibilidad de FST (~30 idiomas) |
| ¿Referencia necesaria? | Sí | Sí (o QE solo de fuente) | Opcional | Sí (contrastivo) | Sí (LYSS-eq/LYSS-sem) / No (LYSS-fst) |
| Interpretabilidad | Baja (un número) | Baja (un número) | Alta (ratificación de texto) | Alta (aprobación/fallo por fenómeno) | Alta (veredictos + clases de variante) |

**LYSS no es**: un reemplazo para COMET en idiomas bien dotados de recursos, una métrica universal, o la primera evaluación consciente de morfología.

**LYSS es**: un marco integrado que combina validación morfológica basada en FST con métricas estándar para el caso específico de idiomas donde las métricas neurales carecen de cobertura y existen herramientas basadas en reglas (FSTs, diccionarios). Tiene tres componentes principales:
- **LYSS-fst** — Validez morfológica vía FST (`fst_acceptance_rate`)
- **LYSS-eq** — Equivalencia lingüística vía el linter (`equivalent_match_rate`)
- **LYSS-sem** — Validación semántica determinística (`semantic_score`)

**LYSS extiende**: La idea central de MorphEval (usar herramientas morfológicas para evaluación) de pruebas de competencia de diagnóstico a calificación de calidad continua.

**LYSS complementa**: chrF++ (que da crédito parcial por morfemas compartidos pero no puede detectar equivalencia), COMET (que opera en espacio semántico pero carece de datos de entrenamiento para LRL), y FUSE (que utiliza ingeniería de características pero no analizadores morfológicos).

**El arte previo más cercano es**: Hjerson (clasificación de error lingüístico) + HyTER (clases de equivalencia vía redes de paráfrasis) + métrica de cobertura ingenua de Apertium (verificación de validez basada en FST). La contribución de LYSS no es ninguna técnica única sino la integración de estas ideas — particularmente validez basada en FST y equivalencia basada en reglas — en un arnés de evaluación funcional para un idioma polisintético.

### Integración de MorphEval

La metodología de conjunto de prueba contrastivo de MorphEval y nuestro enfoque de calificación continua son complementarios:

- **MorphEval** responde: "¿Puede este sistema manejar marcado de tiempo? ¿Acuerdo de número? ¿Asignación de caso?"
- **Nuestra métrica FST** responde: "¿Produjo este sistema palabras reales?"
- **Nuestro linter** responde: "¿Es esta traducción equivalente a la referencia a pesar de diferencias de superficie?"
- **Nuestro validador semántico** responde: "¿Significa esta traducción la cosa correcta?"

MorphEval es código abierto. Crear un conjunto de prueba de Plains Cree requeriría que un lingüista diseñe pares contrastivos cubriendo contrastes morfológicos específicos de Cree (obviación, marcado inverso, orden conjuntivo/independiente, "nosotros" inclusivo/exclusivo, cadenas de preverb). Esto es sustancial pero trabajo acotado — semanas, no meses — y proporcionaría capacidad de diagnóstico que ninguna otra herramienta de evaluación ofrece para Cree.

### La Pregunta de Extensibilidad

¿Qué otros idiomas podrían adoptar este enfoque? La restricción primaria es disponibilidad de FST. La infraestructura de GiellaLT proporciona analizadores morfológicos para 30+ idiomas, principalmente en tres familias:

- **Idiomas Sámi** (North Sámi, Lule Sámi, South Sámi, Skolt Sámi, Inari Sámi): FSTs maduros con cobertura amplia. North Sámi es el objetivo más inmediatamente portable.
- **Idiomas Uralic** (finlandés, estonio, Komi, Erzya, Moksha): Analizadores bien desarrollados, aunque finlandés y estonio pueden no necesitar evaluación basada en FST tan urgentemente (tienen más cobertura de métrica neural).
- **Idiomas indígenas árticos** (Inuktitut vía Uqailaut, Groenlandés): Existen analizadores pero la cobertura varía.
- **Otros idiomas de GiellaLT**: Feroés, irlandés, córnico, livonio y otros con niveles de madurez de FST variados.

Más allá de GiellaLT, la plataforma **Apertium** proporciona analizadores morfológicos para aproximadamente 40+ pares de idiomas. El ecosistema **HFST** (Helsinki Finite-State Technology) es la infraestructura compartida que tanto GiellaLT como Apertium utilizan, lo que significa que cualquier analizador de Apertium podría en principio ser conectado a la misma métrica de validez del FST.

La restricción práctica no es disponibilidad de FST sino **curación de clase de variante**. Las reglas de equivalencia del linter requieren experiencia lingüística por idioma objetivo. Para North Sámi, esto requeriría entender flexibilidad de orden de palabras de Sámi, convenciones ortográficas y variación dialectal. Para Inuktitut, requeriría entender morfología polisintética a un nivel comparable a lo que fue hecho para Cree. La métrica de validez del FST, sin embargo, puede ser implementada inmediatamente para cualquier idioma con un analizador de GiellaLT — sin trabajo lingüístico adicional requerido.

### Hacia un Artículo

Una publicación basada en este trabajo se dirigiría más naturalmente a uno de estos lugares:

- **Shared Task de Métricas de WMT** (co-ubicada con EMNLP): El lugar más directo. Requeriría implementar las métricas como una presentación de tarea compartida y evaluar en conjuntos de prueba de WMT — que actualmente no incluyen ningún idioma polisintético. Podría presentarse como un artículo de "hallazgos" o participar en la subtarea de conjuntos de desafío.
- **LREC-COLING** (Language Resources and Evaluation Conference): Ajuste natural para un artículo de recurso/herramienta describiendo el marco de evaluación y los recursos lingüísticos que utiliza (FSTs, diccionarios, reglas de variante).
- **ACL o NAACL** (conferencia principal): Requeriría el estudio de correlación humana y al menos un idioma adicional para cumplir con la barra para un artículo de conferencia principal.
- **Taller AmericasNLP**: La audiencia más receptiva para evaluación de TA de idiomas indígenas. Barra de publicación más baja, pero alto impacto dentro de la comunidad objetivo.
- **ComputEL** (Computational Approaches to Endangered Languages): Lugar enfocado para exactamente este tipo de trabajo.

Cualquier publicación requeriría co-autores con experiencia en lingüística de Cree (para validar las clases de variante e interpretar resultados) e idealmente hablantes bilingües de Cree (para proporcionar las evaluaciones de calidad humana para el estudio de correlación). Esto no es opcional — un artículo sobre evaluación de TA de Cree escrito enteramente por no-hablantes de Cree sería, en el mejor de los casos, incompleto, y en el peor, una continuación de la dinámica de investigación extractiva que el campo está intentando dejar atrás.

---

## Apéndice A: Matriz de Requisitos de Métrica

| Métrica | ¿Referencia necesaria? | ¿Fuente necesaria? | ¿Modelo entrenado? | ¿Recursos específicos del idioma? | ¿Funciona para LRL? |
|--------|-------------------|---------------|----------------|------------------------------|----------------|
| BLEU | Sí | No | No | No | Pobremente |
| chrF++ | Sí | No | No | No | Mejor que BLEU |
| METEOR | Sí | No | No | Lematizador + WordNet | Solo si existen recursos |
| TER | Sí | No | No | No | Igual que BLEU |
| BERTScore | Sí | No | Sí (mBERT) | No | Depende de cobertura del modelo |
| BLEURT | Sí | No | Sí (entrenado) | No | Depende de datos de entrenamiento |
| COMET | Sí | Sí | Sí (XLM-R) | No | Depende de cobertura de XLM-R |
| CometKiwi | No | Sí | Sí (XLM-R) | No | Depende de cobertura de XLM-R |
| GEMBA | Opcional | Sí | Sí (LLM) | No | Depende de cobertura de LLM |
| **Aceptación FST** | **No** | **No** | **No** | **Sí (analizador FST)** | **Sí, si existe FST** |
| **Linter de CRK** | **Sí** | **No** | **No** | **Sí (FST + reglas de variante)** | **Sí, si existen recursos** |
| **Semántica de CRK** | **Sí** | **Opcional** | **No** | **Sí (FST + diccionario + spaCy)** | **Sí, si existen recursos** |
| Detección de alucinación | No | Sí | No | No | Sí |
| Detección de cambio de código | Opcional | Sí | No | Mínimo | Sí |
| MorphEval | Sí (contrastivo) | Sí | No | Sí (conjunto de prueba + analizador) | Solo si existe conjunto de prueba |

## Apéndice B: Artículos Clave

| Cita | Lugar | Relevancia |
|----------|-------|-----------|
| Papineni et al. (2002). BLEU: a Method for Automatic Evaluation of Machine Translation | ACL 2002 | La métrica que definió el campo |
| Doddington (2002). Automatic Evaluation of Machine Translation Quality Using N-gram Co-Occurrence Statistics | HLT 2002 | Coincidencia de n-gramas ponderada por información |
| Banerjee & Lavie (2005). METEOR: An Automatic Metric for MT Evaluation | ACL 2005 Workshop | Lematización, sinónimos, alineación de palabras |
| Snover et al. (2006). A Study of Translation Edit Rate | AMTA 2006 | Distancia de edición con cambios de frases |
| Popović & Ney (2011). Morphemes and POS tags for n-gram based evaluation metrics | WMT 2011 | Clasificación de error de Hjerson |
| Dreyer & Marcu (2012). HyTER: Meaning-Equivalent Semantics for Translation Evaluation | NAACL-HLT 2012 | Clases de equivalencia vía redes de paráfrasis |
| Lommel et al. (2014). Multidimensional Quality Metrics | — | Tipología de error MQM |
| Popović (2015). chrF: character n-gram F-score for automatic MT evaluation | WMT 2015 | Evaluación a nivel de carácter |
| Popović (2017). chrF++: words helping character n-grams | WMT 2017 | Evaluación de n-gramas de carácter + palabra |
| Burlot & Yvon (2017). Evaluating the Morphological Competence of Machine Translation Systems | WMT 2017 | Conjuntos de prueba morfológicos contrastivos |
| Sennrich (2017). How Grammatical is Character-level Neural Machine Translation? | EACL 2017 | Pares contrastivos de LingEval97 |
| Isabelle, Cherry & Foster (2017). A Challenge Set Approach to Evaluating Machine Translation | EMNLP 2017 | Prueba de divergencia estructural dirigida |
| Post (2018). A Call for Clarity in Reporting BLEU Scores | WMT 2018 | Estandarización de sacreBLEU |
| Reiter (2018). A Structured Review of the Validity of BLEU | Computational Linguistics | Meta-análisis de correlación de BLEU con juicio humano |
| Stanovsky, Smith & Zettlemoyer (2019). Evaluating Gender Bias in Machine Translation | ACL 2019 | Evaluación de género de WinoMT |
| Ribeiro et al. (2020). Beyond Accuracy: Behavioral Testing of NLP Models with CheckList | ACL 2020 (Mejor Artículo) | Pruebas unitarias basadas en capacidad para NLP |
| Zhang et al. (2020). BERTScore: Evaluating Text Generation with BERT | ICLR 2020 | Similitud semántica basada en incrustación |
| Sellam et al. (2020). BLEURT: Learning Robust Metrics for Text Generation | ACL 2020 | Métrica pre-entrenada + ajustada finamente |
| Rei et al. (2020). COMET: A Neural Framework for MT Evaluation | EMNLP 2020 | Evaluación trilingüe multilingüe |
| Freitag et al. (2021). Results of the WMT 2021 Metrics Shared Task | WMT 2021 | Meta-evaluación basada en MQM |
| Thompson & Post (2020). PRISM: Automatic MT Evaluation via Zero-Shot Paraphrasing | EMNLP 2020 | NMT multilingüe como calificador de paráfrasis |
| Currey et al. (2022). MT-GenEval | EMNLP 2022 | Precisión de género contrafáctico |
| Amrhein et al. (2022). ACES: Translation Accuracy Challenge Sets | WMT 2022 | 68 fenómenos, 146 pares de idiomas |
| Kocmi & Federmann (2023). GEMBA: Large Language Models Are State-of-the-Art Evaluators | EAMT 2023 | LLM-as-evaluator |
| Guerreiro et al. (2024). xCOMET: Transparent MT Evaluation through Fine-grained Error Detection | TACL 2024 | Detección de error de tramo |
| Wang & Adelani (2024). AfriMTE and AfriCOMET | NAACL 2024 | Métricas neurales para idiomas africanos |
| Juraska et al. (2024). MetricX-24 | WMT 2024 | Métrica ganadora basada en mT5 |

## Apéndice C: Glosario de Términos de Evaluación

| Término | Definición |
|--------|-----------|
| **Adecuación** | Si una traducción transmite el significado de la fuente. |
| **Fluidez** | Si una traducción es gramatical y natural en el idioma objetivo. |
| **Direct Assessment (DA)** | Método de evaluación humana donde anotadores califican traducciones en una escala de 0–100. |
| **MQM** | Multidimensional Quality Metrics — evaluación humana basada en tramo de error con severidades tipificadas. |
| **Quality Estimation (QE)** | Predicción de calidad de traducción sin una traducción de referencia. |
| **FST** | Finite-State Transducer — un dispositivo computacional que codifica las reglas morfológicas de un idioma. |
| **GiellaLT** | Infraestructura para tecnología de lenguaje basada en reglas, principalmente para idiomas Sámi y otros árticos. |
| **HFST** | Helsinki Finite-State Technology — el marco de software subyacente a GiellaLT y Apertium. |
| **SRO** | Standard Roman Orthography — el sistema de escritura basado en latín para Plains Cree. |
| **Silabarios** | Canadian Aboriginal Syllabics — un sistema de escritura abugida utilizado para Cree y otros idiomas Algonquinos. |
| **Polisintético** | Un tipo de idioma donde una sola palabra puede codificar el equivalente de una oración completa en inglés a través de afijación extensa. |
| **Obviación** | Una categoría gramatical en idiomas Algonquinos que distingue entre dos referentes de tercera persona. |
| **Inverso** | Una categoría similar a voz en idiomas Algonquinos que marca que el paciente supera al agente en la jerarquía de animacidad. |
| **WMT** | Conference on Machine Translation — el lugar principal para tareas compartidas de TA y evaluación. |
| **Evaluación contrastiva** | Prueba de si un sistema puede distinguir entradas mínimamente diferentes que requieren salidas diferentes. |
| **Conjunto de desafío** | Un conjunto de prueba diseñado dirigido a fenómenos lingüísticos específicos. |
| **Clase de equivalencia** | Un conjunto de formas de superficie diferentes que representan el mismo significado y deberían recibir la misma puntuación de evaluación. |

## A dónde conduce esto en este sitio

Las respuestas del propio Champollion a los problemas catalogados aquí son la
[Especificación de puntuación](/docs/network/specifications/scoring) (qué métrica
cuenta y cuándo), la [Confiabilidad de la métrica](/docs/network/specifications/metric-reliability)
(en qué métrica confiar según el idioma de destino) y el
[Marco de diseño del corpus](/docs/network/specifications/corpus-design)
(cómo un conjunto de pruebas se gana el derecho a ser creído).
