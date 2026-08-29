---
sidebar_position: 2
title: "¿Qué se considera un idioma aquí?"
---

# ¿Qué cuenta como un idioma aquí?

> **Resumen ejecutivo.** La Red cataloga idiomas por ISO 639-3, evalúa idiomas individuales (no macrolenguajes), incluye lenguas de signos como los idiomas naturales que son, incluye lenguas construidas reconocidas por ISO, excluye lenguajes de programación, y muestra disputas taxonómicas sin tomar partido. Esta página explica cada decisión y qué significa para la clasificación.

Cualquier proyecto que evalúe traducción en miles de idiomas debe responder una pregunta antigua y sorprendentemente difícil: ¿qué cuenta como un idioma? Los lingüistas saben desde hace mucho tiempo que la frontera entre "idioma" y "dialecto" es tanto social y política como estructural — la famosa frase que *"un idioma es un dialecto con ejército y marina"* fue popularizada por el lingüista yidis Max Weinreich en 1945 (la atribuyó a un miembro de la audiencia en una de sus conferencias). No podemos evadir la pregunta, así que aquí están nuestras respuestas y nuestro razonamiento.

---

## Las lenguas de signos son idiomas. Punto final.

Las lenguas de signos son idiomas naturales — con gramáticas completas, adquisición nativa por niños, y comunidades de hablantes vivos. Esto ha sido establecido en la lingüística desde la demostración de William Stokoe en 1960 de que la Lengua de Signos Americana tiene el mismo tipo de estructura interna que los idiomas hablados, y sesenta años de investigación desde entonces (Klima & Bellugi 1979; Sandler & Lillo-Martin 2006) solo han profundizado el punto. ISO 639-3 asigna códigos de idioma individuales a las lenguas de signos; Glottolog las cataloga junto con familias habladas. Nuestro catálogo incluye más de 160 de ellas, etiquetadas `modality: signed`.

Algunas son idiomas indígenas en peligro: la Lengua de Signos de las Llanuras Indias (`psd`), históricamente una importante lengua franca intertribal en América del Norte, está críticamente en peligro hoy (Davis 2010, *Hand Talk*). El peligro de extinción de lenguas de signos *es* peligro de extinción de idiomas indígenas, y está dentro de la misión de este proyecto.

**Una nota de alcance honesta.** La Red actualmente evalúa traducción automática *basada en texto*. La traducción automática de lenguas signadas — trabajando con video, gramática espacial, e idiomas que no tienen una forma escrita ampliamente adoptada — es un problema técnico diferente y en gran medida sin resolver (véase Yin et al. 2021, "Including Signed Languages in Natural Language Processing," ACL). Aún no lo servimos. Las entradas de lenguas de signos en nuestro catálogo dicen exactamente eso: **aún no servido — nunca "no es un idioma."**

## Hay dos modalidades. La escritura no es una de ellas.

Los idiomas vienen en dos modalidades primarias: **hablada** y **signada**. La escritura no es una tercera modalidad — es una tecnología superpuesta sobre un idioma, y la mayoría de los idiomas del mundo se arreglan sin una estandarizada. Por eso nuestras tarjetas de idioma rastrean la escritura por separado (qué sistemas de escritura usa un idioma, o si no tiene ortografía estandarizada) y la rastrean honestamente: para una plataforma de traducción automática basada en texto, si un idioma está escrito es información crítica, no una nota al pie — y un idioma no escrito no es un idioma menor.

## Idiomas construidos: sí. Lenguajes de programación: no.

Seguimos la propia línea de ISO 639-3. El estándar admite un idioma construido solo si es un idioma completo, diseñado para comunicación humana, con una literatura y una comunidad que lo ha transmitido a una segunda generación de usuarios — y explícitamente excluye lenguajes de programación de computadora. Esperanto, con sus hablantes nativos, califica; Python no, porque nadie adquiere Python como primer idioma de sus padres. Nuestro catálogo incluye las dos docenas de idiomas construidos que ISO reconoce, tipificados como tales, y ningún lenguaje de programación.

## Evaluamos idiomas individuales, no macrolenguajes

ISO 639-3 distingue *idiomas individuales* de *macrolenguajes* — códigos paraguas como `cre` (Cree), `ara` (Árabe), o `zho` (Chino) que cubren varios idiomas individuales estrechamente relacionados. La unidad de evaluación de la Red es el **idioma individual**, por una razón operacional: los recursos de traducción son específicos de la variedad. Un analizador morfológico construido para Cree de las Llanuras (`crk`) no genera Cree de Moose (`crm`); un corpus de árabe egipcio dice poco sobre la calidad de un método en árabe marroquí. Una puntuación adjunta a un código de macrolenguaje sería una afirmación sobre variedades que nunca fueron realmente evaluadas — así que no lo hacemos.

Los macrolenguajes aún aparecen en el catálogo como **páginas de concentrador**: navegación que vincula una identidad paraguas a sus miembros individuales, reflejando la propia observación de ISO de que ambos niveles de identidad son reales. Debajo del idioma individual, mostramos información de dialecto y linaje del árbol languoid de Glottolog (Hammarström & Forkel 2022), que modela familias, idiomas y dialectos como una jerarquía navegable.

**¿Qué sucede con los corpus que llegan etiquetados con un código general?** Muchos datos del mundo real lo hacen: conjuntos de datos publicados como "Quechua", "Persa" o "Chino (Simplificado)". Tratamos la etiqueta de origen como *metadatos por resolver*, no como una verdad que deba obedecerse o descartarse. Los casos mecánicos se resuelven automáticamente a partir de las tablas oficiales de la ISO: se elimina una etiqueta de escritura (`cmn-Hans` es chino mandarín, escrito en han simplificado; la escritura se registra, la identidad del idioma es `cmn`), y un código retirado sigue a su sucesor oficial. Cuando el editor documenta qué variedad son realmente sus datos (FLORES+ codifica su registro de quechua como `quy`, quechua ayacuchano), registramos esa resolución *con la cita* en la entrada de registro del corpus, y el corpus se evalúa bajo el idioma individual real. Y cuando nadie puede decir qué variedad contiene una colección (algunas colecciones de oraciones de la comunidad mantienen una categoría deliberadamente genérica para el "Árabe"), no adivinamos: el corpus permanece catalogado bajo su propia etiqueta, se excluye de la cola de trabajo con un motivo legible por máquina que usted puede ver en los metadatos de la cola, y cualquier puntuación histórica en él permanece adjunta a un nodo general etiquetado con honestidad, nunca acreditada silenciosamente a una variedad que nunca fue evaluada. Cada resolución se puede volver a derivar: las tablas fijadas de la ISO, los sellos de resolución por corpus y las citas se incluyen en el registro público.

## Cuando las autoridades no están de acuerdo, mostramos ambas

ISO 639-3 y Glottolog ocasionalmente dividen o agrupan de manera diferente, y las comunidades a veces no están de acuerdo con ambas. No arbitramos. Las tarjetas de idioma llevan una capacidad de *notas de taxonomía* que muestra el desacuerdo con fuentes, y la nomenclatura sigue a la comunidad dondequiera que la comunidad haya expresado una preferencia. Si una variedad es "un idioma" es, en última instancia, parcialmente una cuestión de identidad — y las preguntas de identidad pertenecen a las comunidades mismas, un principio que adoptamos de los marcos indígenas de gobernanza de datos.

## Una dirección de investigación: evaluaciones como instrumento de medición

Una cosa que una arena como esta produce, casi como un subproducto, es un nuevo tipo de evidencia sobre qué tan cerca están realmente las variedades de idiomas *operacionalmente*. Si un único método de traducción, mantenido fijo, sirve varias variedades relacionadas con calidad desplegable, esas variedades se agrupan en la práctica; si demandan corpus separados y métodos separados, son operacionalmente distintas — sin importar lo que digan las políticas de nomenclatura. Esto se asemeja a tradiciones empíricas más antiguas, desde pruebas de inteligibilidad de texto grabado hasta medidas de distancia léxica automatizadas, con un giro fundamentado en la implementación.

Ofrecemos esto cuidadosamente, como una dirección de investigación en lugar de una afirmación. Los resultados de transferencia de métodos están confundidos por tamaño de corpus, dominio, ortografía y contaminación de datos de entrenamiento, y una agrupación siempre es relativa a un método y un umbral de calidad. Sobre todo: esta señal puede *informar* conversaciones sobre idioma y dialecto, pero nunca anula cómo una comunidad identifica su propio idioma.

---

## Referencias

- Davis, Jeffrey E. (2010). *Hand Talk: Sign Language among American Indian Nations.* Cambridge University Press.
- Dryer, Matthew S. & Martin Haspelmath, eds. (2013). *The World Atlas of Language Structures Online.* https://wals.info
- Hammarström, Harald & Robert Forkel (2022). "Glottocodes: Identifiers Linking Families, Languages and Dialects to Comprehensive Reference Information." *Semantic Web* 13(6).
- Haugen, Einar (1966). "Dialect, Language, Nation." *American Anthropologist* 68(4).
- ISO 639-3 Registration Authority. "Scope of denotation" and "Types of individual languages." https://iso639-3.sil.org/about/scope · https://iso639-3.sil.org/about/types
- Klima, Edward S. & Ursula Bellugi (1979). *The Signs of Language.* Harvard University Press.
- Sandler, Wendy & Diane Lillo-Martin (2006). *Sign Language and Linguistic Universals.* Cambridge University Press.
- Stokoe, William C. (1960). *Sign Language Structure.* Studies in Linguistics, Occasional Papers 8.
- Weinreich, Max (1945). "Der YIVO un di problemen fun undzer tsayt." *YIVO Bleter* 25(1).
- Yin, Kayo, Amit Moryossef, Julie Hochgesang, Yoav Goldberg & Malihe Alikhani (2021). "Including Signed Languages in Natural Language Processing." *Proc. ACL-IJCNLP 2021.* https://aclanthology.org/2021.acl-long.570/

---

## A dónde conduce esto en este sitio

Las reglas de conteo aquí descritas rigen cada número en este sitio: la
[metodología de cobertura](/docs/network/context/coverage-counting) las aplica
a los servicios de MT, y las
[tarjetas de idioma](/docs/reference/language-card-spec) registran, por idioma,
lo que realmente afirma cada fuente.
