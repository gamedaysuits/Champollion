---
sidebar_position: 5
title: "Dar soporte a un idioma de bajos recursos"
related:
  - label: "Cookbook: Corpus Creation"
    to: /docs/network/tutorials/corpus-creation
    kind: cookbook
    note: "The first step for an uncovered language"
  - label: "Cookbook: FST-Gated Translation Pipeline"
    to: /docs/network/tutorials/fst-gated-pipeline
    kind: cookbook
  - label: "For Language Communities"
    to: /docs/network/community/for-language-communities
    kind: doc
  - label: "Plains Cree, the trading card"
    to: https://champollion.dev/trading-cards?q=crk
    kind: card
    note: "The proof-of-concept language, as a card"
---

# Soporte para un idioma de bajos recursos

> **Resumen ejecutivo.** Una guía exhaustiva para desarrollar traducción automática para idiomas de bajos recursos y polisintéticos. Cubre por qué estos idiomas son difíciles (complejidad morfológica, escasez de datos, alucinación), los recursos computacionales existentes (ALTLab FST, GiellaLT, Apertium, UniMorph, EdTeKLA), más de 10 estrategias de enfoque, el sistema de entrenamiento (coaching) de champollion y el ciclo de evaluación. Comience aquí si desea contribuir con un método para un idioma desatendido.

:::info[Estado: En desarrollo activo]
El soporte para Plains Cree (nêhiyawêwin) se encuentra actualmente en desarrollo. Las herramientas, el entorno de evaluación (evaluation harness) y la tabla de clasificación (leaderboard) descritos aquí son reales y se pueden usar hoy en día, pero el flujo de traducción para Cree aún no se ha publicado. Cuando lo esté, servirá como modelo para otros idiomas polisintéticos y de bajos recursos con infraestructura FST.
:::

## El problema sin resolver

El servicio Cloud Translation de Google enumera 194 idiomas ([lista publicada por Google](https://docs.cloud.google.com/translate/docs/languages)). OMT-1600 de Meta (marzo de 2026) afirma tener cobertura para 1600, el sistema de traducción automática (MT) más grande jamás publicado. Pero para los ~1200 idiomas en su larga cola (nuestra aritmética: los 1600 que cubre menos los más de 400 que sus autores informan que los modelos "entienden lo suficientemente bien"), la calidad está por debajo de los umbrales utilizables, los datos de entrenamiento están dominados por textos bíblicos, los pesos del modelo no están disponibles para descargar y no existe una evaluación independiente ni un marco de gobernanza comunitaria. Para los ~5400 idiomas restantes, ningún modelo preentrenado produce ningún resultado en absoluto.

El panorama ha cambiado significativamente: las grandes empresas tecnológicas (Big Tech) ahora están invirtiendo en la cobertura de idiomas de bajos recursos (LRL). Pero la cobertura no es calidad, y la calidad sin verificación independiente no genera confianza. Los idiomas de bajos recursos necesitan más que un modelo que afirme cubrirlos: necesitan una evaluación independiente con validación morfológica, corpus seleccionados por la comunidad y una gobernanza que respete su soberanía.

**champollion fue creado para cambiar eso.**

La [Tabla de clasificación de métodos](https://champollion.dev/leaderboard) (Method Leaderboard) es un desafío abierto: construya el mejor método de traducción para un idioma desatendido, demuéstrelo con una evaluación reproducible y reclame la puntuación más alta. Cualquier persona en el mundo puede contribuir: lingüistas, investigadores de aprendizaje automático (ML), trabajadores comunitarios de idiomas, estudiantes, aficionados. El problema está sin resolver. La infraestructura está aquí. La tabla de clasificación lo está esperando.

---

## Por qué esto es difícil: Morfología polisintética

La mayoría de los sistemas comerciales de traducción automática (MT) fueron diseñados para idiomas como el inglés, el francés y el chino, idiomas donde las palabras son relativamente cortas y las oraciones se construyen a partir de tokens discretos. Pero muchos idiomas indígenas, incluido el Plains Cree, son **polisintéticos**: una sola palabra puede codificar lo que el inglés expresa como una oración completa.

### El ejemplo del Cree

Considere la palabra en Plains Cree:

> **ê-kî-nitawi-kîskinwahamâkosiyân**
> *"cuando fui a la escuela"*

Esa es **una sola palabra**. Codifica el tiempo (pasado), la dirección (ir a), la raíz (aprender), la voz (pasiva/reflexiva) y la persona (primera del singular). Un LLM entrenado predominantemente en inglés no tiene intuición para este tipo de densidad morfológica.

Los desafíos se multiplican:

| Desafío | Qué significa |
|-----------|--------------|
| **Complejidad morfológica** | Una sola raíz verbal puede generar miles de formas flexionadas válidas a través de la prefijación, sufijación y circunfijación |
| **Distinción animado/inanimado** | Los sustantivos son gramaticalmente animados o inanimados; esto afecta la conjugación de los verbos, los demostrativos y la pluralización. La clasificación no siempre sigue la animacidad biológica (*askiy* "tierra" es animado; *maskisin* "zapato" también es animado) |
| **Obviación** | Las referencias en tercera persona se clasifican por proximidad/relevancia. La distinción entre "próximo" y "obviativo" no tiene equivalente en inglés |
| **Datos de entrenamiento escasos** | Los LLM han visto muy poco texto en Plains Cree. Lo que han visto puede mezclar dialectos (dialecto Y, dialecto TH) u ortografías (SRO frente a silábicos) |
| **Línea base comercial débil** | OMT-1600 incluye CRK en el nivel R1 (Recursos muy bajos) con entrenamiento en el dominio de la Biblia y tokenización BPE estándar. Google Translate no admite Cree. La evaluación independiente con métricas morfológicas es lo que da sentido a estas líneas base. |

La traducción de idiomas polisintéticos sigue siendo un **problema de investigación abierto**: OMT-1600 incluye idiomas polisintéticos pero utiliza una tokenización BPE estándar (vocabulario de 256K) sin conciencia morfológica, lo que significa que desmenuza las palabras composicionales en fragmentos de bytes sin sentido.

---

## Antecedentes: Cómo se ha abordado esto

### El FST de ALTLab

El recurso computacional más significativo para el Plains Cree es el **transductor de estados finitos (FST)** desarrollado por el [Alberta Language Technology Lab (ALTLab)](https://altlab.ualberta.ca/) en la Universidad de Alberta, en colaboración con [Giellatekno](https://giellatekno.uit.no/) en la UiT Universidad Ártica de Noruega.

El FST de ALTLab es un **analizador y generador morfológico**: dada una palabra flexionada en Cree, puede descomponerla en su raíz y etiquetas gramaticales, y dada una raíz más etiquetas, puede generar la forma flexionada correcta. Esto es determinista: sin redes neuronales, sin alucinaciones, sin probabilidad. Si el FST acepta una palabra, esa palabra es morfológicamente válida.

Es por esto que la tabla de clasificación de champollion rastrea la **Tasa de aceptación del FST** (FST Acceptance Rate) como una métrica. Un método de traducción que produce palabras que el FST rechaza está produciendo un Cree morfológicamente inválido, independientemente de lo que diga la puntuación chrF++.

**Recursos clave de ALTLab:**
- [itwêwina](https://itwewina.altlab.app/): un diccionario inteligente de Plains Cree a inglés impulsado por el FST
- [Morphodict](https://github.com/UAlbertaALTLab/morphodict): plataforma de diccionario de código abierto con conciencia morfológica
- [crk-db](https://github.com/UAlbertaALTLab/crk-db): base de datos léxica de Plains Cree
- [21st Century Tools for Indigenous Languages](https://21c.tools/): el contexto más amplio del proyecto

### Registros morfológicos y FST globales

El Plains Cree no es el único idioma con una infraestructura FST de alta calidad. Si desea desarrollar flujos de traducción para otros idiomas de bajos recursos o morfológicamente complejos, puede aprovechar estos centros globales establecidos:

* **[GiellaLT / Giellatekno](https://giellalt.github.io/) (UiT Universidad Ártica de Noruega):** El repositorio más grande de analizadores y generadores morfológicos FST de código abierto, que cubre más de 100 idiomas. Las áreas de enfoque incluyen las lenguas sami (`sme`, `smj`, `sma`, etc.), las lenguas urálicas (komi, erzya, udmurto, etc.) y otras lenguas minoritarias/indígenas. Alojan corpus de texto procesado público (`corpus-xxx`) en su [Organización de GitHub](https://github.com/giellalt/).
* **[The Apertium Project](https://www.apertium.org/):** Una plataforma de traducción automática basada en reglas de código abierto. Apertium mantiene analizadores morfológicos FST altamente optimizados (usando `lttoolbox` y `hfst`) y diccionarios bilingües para docenas de idiomas, incluyendo un gran conjunto de lenguas túrquicas (kazajo, tártaro, kirguís, etc.) y lenguas europeas minoritarias. Todos los recursos son públicos en el [GitHub de Apertium](https://github.com/apertium).
* **[UniMorph (Universal Morphology)](https://unimorph.github.io/):** Un proyecto colaborativo que proporciona paradigmas morfológicos estandarizados para más de 150 idiomas. El conjunto de datos está alojado en Hugging Face en [unimorph/universal_morphologies](https://huggingface.co/datasets/unimorph/universal_morphologies). Si un binario FST compilado no está disponible para un idioma, las tablas de UniMorph se pueden usar como una puerta de búsqueda de base de datos estática.
* **[National Research Council Canada (NRC)](https://nrc-digital-repository.canada.ca/):** Ofrece herramientas para idiomas indígenas canadienses, incluido el analizador morfológico FST de inuktitut **Uqailaut** y el masivo **Nunavut Hansard Parallel Corpus** (1,3 millones de pares de oraciones alineadas en inglés-inuktitut).

### El corpus de EdTeKLA

El [grupo de investigación EdTeKLA](https://spaces.facsci.ualberta.ca/edtekla/) (también en la UAlberta) ha reunido un corpus del idioma Plains Cree a partir de materiales educativos, transcripciones de audio y fuentes comunitarias. El conjunto de datos de evaluación de champollion [EDTeKLA Dev v1](/docs/network/leaderboard/datasets) se deriva de este trabajo, publicado bajo la [licencia CC BY-NC-SA modificada de EdTeKLA](https://github.com/EdTeKLA/IndigenousLanguages_Corpora) (términos no comerciales y con alcance de soberanía).

### Otros enfoques que se han intentado o se podrían intentar

La tabla de clasificación es agnóstica al método. Aquí hay estrategias que se han explorado o propuesto para la traducción automática (MT) de bajos recursos, cualquiera de las cuales podría enviarse:

| Enfoque | Cómo funciona | Pros | Contras |
|----------|-------------|------|------|
| **[Prompting de LLM entrenado (Coached)](/docs/network/tutorials/coached-llm-prompting)** | Inyecta reglas gramaticales, diccionarios y pares de ejemplos en el prompt del sistema | Rápido de iterar, no requiere entrenamiento | Techo de calidad limitado por el conocimiento base del LLM |
| **[Prompting few-shot](/docs/network/tutorials/few-shot-prompting)** | Incluye traducciones verificadas como ejemplos en contexto | Bueno para un estilo consistente | Ventana de contexto pequeña; los ejemplos NO deben provenir de los datos de evaluación |
| **[Flujo controlado por FST](/docs/network/tutorials/fst-gated-pipeline)** | El LLM genera → el FST valida → rechaza y reintenta la morfología inválida | Garantiza la validez morfológica | Requiere infraestructura FST; los bucles de reintento añaden latencia y costo |
| **[Búsqueda en diccionario + LLM](/docs/network/tutorials/dictionary-augmented-llm)** | Fuerza términos conocidos de un diccionario bilingüe, deja que el LLM maneje el resto | Reduce la alucinación para términos conocidos | La cobertura del diccionario siempre es incompleta |
| **[Modelo ajustado (Fine-tuned)](/docs/network/tutorials/fine-tuned-model)** | Ajusta un modelo abierto (Llama, Mistral) en texto paralelo (solo que no en los datos de evaluación) | Potencialmente la más alta calidad | Requiere corpus paralelo (escaso); costoso; riesgo de sobreajuste (overfitting) |
| **[Modelos encadenados](/docs/network/tutorials/chained-models)** | El Modelo A genera una traducción preliminar → el Modelo B posedita → el Modelo C puntúa | Puede combinar las fortalezas de los especialistas | Complejo; lento; costoso |
| **[Híbrido basado en reglas + LLM](/docs/network/tutorials/rule-based-hybrid)** | Usa reglas lingüísticas para patrones conocidos, el LLM para todo lo demás | Preciso donde se aplican las reglas | Requiere profunda experiencia lingüística |
| **[Aumento por retrotraducción (Back-translation)](/docs/network/tutorials/back-translation)** | Genera datos paralelos sintéticos traduciendo de Cree a inglés, luego entrena a la inversa | Expande los datos de entrenamiento de forma económica | Amplifica los errores existentes del modelo |
| **[Enfoque evolutivo](/docs/network/tutorials/evolutionary-approach)** | Genera traducciones candidatas, las puntúa, muta las de mejor rendimiento, repite | Puede descubrir soluciones novedosas; paralelizable | Computacionalmente costoso; necesita una buena función de aptitud (fitness) |
| **[Traducción parcial](/docs/network/tutorials/partial-translation)** | Traduce manualmente una muestra representativa, demuestra que su método coincide con su estilo en ella, luego autotraduce el volumen restante | Combina la calidad humana con la escala de la máquina | Requiere esfuerzo humano inicial |
| **JSON manual / calificación de exámenes** | Crea a mano un archivo JSON de conjunto de datos para probar las respuestas de los estudiantes en un examen de idiomas, o califica un lote de traducciones humanas frente a un estándar de oro | No requiere ML; funciona para educación y control de calidad (QA) | No escala para necesidades de traducción continuas |

### Es solo JSON

El entorno de evaluación (harness) recibe JSON y devuelve puntuaciones en JSON. El [formato del conjunto de datos](/docs/network/leaderboard/datasets) es simple:

```json
{
  "entries": [
    { "id": 1, "source": "Hello", "reference": "tânisi" },
    { "id": 2, "source": "Thank you", "reference": "kinanâskomitin" }
  ]
}
```

Usted puede construir esto a mano. Puede exportarlo desde una hoja de cálculo. Puede generarlo a partir de un corpus. Un profesor de idiomas podría usarlo para calificar las traducciones de los estudiantes. Una agencia de traducción podría usarlo para evaluar a los trabajadores independientes (freelancers). Un laboratorio de investigación podría usarlo para comparar arquitecturas de modelos. Al entorno de evaluación no le importa de dónde provino el JSON: simplemente lo puntúa.

Y debido a que el marco de implementación en producción toma la misma interfaz de plugin, un método que obtiene una buena puntuación en el entorno de evaluación se implementa en su sitio web con un solo cambio de configuración. **Demuéstrelo y úselo.**

Las posibilidades son genuinamente infinitas. **Si tiene una idea, constrúyala, ejecute el entorno de evaluación y envíe sus puntuaciones.**

---

## Cómo encaja champollion

champollion proporciona la capa de infraestructura; usted aporta el método.

### El sistema de entrenamiento (coaching)

El método `llm-coached` de champollion le permite inyectar conocimiento lingüístico directamente en el prompt del LLM:

```json title=".champollion/coaching/crk.json"
{
  "grammar_rules": [
    "Plains Cree is polysynthetic — a single word can express what English needs a full sentence for",
    "Animate/inanimate noun distinction affects verb conjugation, demonstratives, and pluralization",
    "Use SRO (Standard Roman Orthography) as the working script — syllabic conversion is handled by the deterministic converter",
    "Obviation: when two third-person referents appear, the less salient one takes obviative marking (-a suffix on nouns, -iyiwa on verbs)"
  ],
  "dictionary": {
    "home": "kīwēwin",
    "settings": "isi-nākatohkēwin",
    "search": "nānātawāpahtam",
    "welcome": "tānisi",
    "dashboard": "kīskinwahamākēwin-māsinahikan"
  },
  "style_notes": "Use formal register appropriate for educational and community contexts. Preserve English technical terms in parentheses when no Cree equivalent exists or is widely accepted."
}
```

Los datos de entrenamiento se inyectan en cada prompt del LLM para el par `en:crk`, dándole al modelo un contexto lingüístico estructurado que de otro modo no tendría. Consulte [Datos de entrenamiento](https://champollion.dev/docs/concepts/coaching-data) para ver la especificación completa.

### Registros

El registro es parte del prompt del sistema que dirige el tono, la formalidad y las convenciones ortográficas. champollion incluye un registro para Plains Cree:

```
nêhiyawêwin (Plains Cree). Use SRO (Standard Roman Orthography) as the working
script. Output will be converted to Syllabics via deterministic converter.
Professional register appropriate for educational and community contexts.
```

Usted puede anular esto en su configuración para experimentar con diferentes estrategias de prompting:

```json title="champollion.config.json"
{
  "languages": {
    "crk": {
      "register": "Casual Plains Cree (Y-dialect). Use SRO. Prefer everyday vocabulary over formal or archaic terms. Address the reader directly."
    }
  }
}
```

Diferentes registros producen diferentes estilos de traducción, y diferentes puntuaciones en la tabla de clasificación. Cada envío registra el registro exacto y el prompt del sistema utilizado (como un hash SHA-256 en la [tarjeta de ejecución](/docs/network/specifications/run-card)), por lo que los experimentos son reproducibles.

### Conversión de escritura

El Plains Cree se escribe en dos sistemas de escritura: **Ortografía Romana Estándar (SRO)** y **Silábicos Aborígenes Canadienses**. El flujo de trabajo de champollion:

1. El LLM traduce a SRO (basado en el alfabeto latino, que los LLM manejan mejor)
2. La puerta de calidad valida la salida en SRO
3. Un convertidor determinista transforma de SRO → Silábicos
4. El texto convertido se escribe en el disco

El convertidor maneja todos los diacríticos SRO (ê, î, ô, â para vocales largas) y los asigna a los caracteres silábicos correctos. Consulte [Convertidores de escritura](https://champollion.dev/docs/concepts/script-converters) para obtener detalles técnicos.

### El ciclo de evaluación

El [entorno de evaluación](/docs/network/specifications/harness) ejecuta su método contra el conjunto de datos de evaluación y produce una [tarjeta de ejecución](/docs/network/specifications/run-card) puntuada:

```bash
# Install the harness (provides the `mt-eval` command)
pip install mt-eval-harness

# Run a baseline experiment
mt-eval run \
  --corpus eval-amh-fra-globalvoices-test-v1 \
  --model google/gemini-2.5-pro \
  --name coached-v7

# Run with FST validation (the default LLM method gates on the FST)
mt-eval run \
  --corpus eval-amh-fra-globalvoices-test-v1 \
  --fst-retries 3 \
  --name fst-gated-v1
```

La bandera `--name` es una etiqueta que usted elige. Aparece en la tabla de clasificación para que las personas puedan ver qué estrategia de prompt utilizó. El entorno de evaluación registra el prompt completo del sistema en la tarjeta de ejecución, por lo que su enfoque exacto es reproducible.

:::tip[Experimente libremente, envíe lo mejor]
El entorno de evaluación está diseñado para una iteración rápida. Ejecute docenas de experimentos con diferentes modelos, datos de entrenamiento, registros y condiciones. Solo envíe a la tabla de clasificación cuando tenga algo de lo que se sienta orgulloso.
:::

---

## Principios de soberanía de datos {#data-sovereignty-principles}

champollion está diseñado para apoyar la soberanía de los datos indígenas. La propiedad, el control, el acceso y la posesión comunitarios de los datos lingüísticos guían cómo abordamos la tecnología lingüística para las comunidades indígenas:

| Principio | Cómo lo apoya champollion |
|-----------|------------------------|
| **Propiedad (Ownership)** | Las comunidades lingüísticas son dueñas de sus datos lingüísticos. champollion nunca se comunica con el exterior ni transmite datos a nuestros servidores |
| **Control** | El [método API](https://champollion.dev/docs/guides/serving-a-method) permite a las comunidades alojar su propio flujo de traducción: nosotros proporcionamos la interfaz, ellos controlan la implementación |
| **Acceso (Access)** | Las comunidades deciden quién puede usar su método. La API puede estar restringida mediante autenticación |
| **Posesión (Possession)** | Todos los datos de traducción permanecen en el sistema de archivos de su proyecto. El [sistema de procedencia](https://champollion.dev/docs/concepts/security) rastrea de dónde provino cada traducción |

La arquitectura de plugins significa que una comunidad puede construir un método que incorpore conocimiento sagrado o restringido internamente, exponer solo la API de traducción y mantener un control total sobre sus recursos lingüísticos.

---

## La visión: Lo que viene a continuación

El Plains Cree es el primer objetivo. Una vez que el flujo de trabajo esté validado y la comunidad esté satisfecha con la calidad, la misma arquitectura se extenderá a otros idiomas polisintéticos con infraestructura FST:

- **Otras lenguas algonquinas**: Woods Cree, Swampy Cree, Ojibwe, Blackfoot
- **Lenguas inuit**: Inuktitut, Inuinnaqtun (que también usan sistemas de escritura silábicos)
- **Otras familias lingüísticas**: cualquier idioma con un analizador FST puede usar el flujo de trabajo controlado por FST

La tabla de clasificación tiene un alcance por par de idiomas. A medida que las comunidades lingüísticas aportan nuevos conjuntos de datos de evaluación, se abren automáticamente nuevas pistas en la tabla de clasificación.

**Esta es una invitación abierta.** Si usted trabaja con un idioma de bajos recursos (como investigador, miembro de la comunidad, estudiante o simplemente alguien a quien le importa), champollion le brinda las herramientas para construir algo real, medirlo honestamente y compartirlo con el mundo. La [Tabla de clasificación de métodos](https://champollion.dev/leaderboard) está esperando su envío.

---

## Consulte también

- **[Tabla de clasificación de métodos](https://champollion.dev/leaderboard)**: envíe sus puntuaciones y vea cómo se comparan los métodos
- **[Evaluación de MT](/docs/network/leaderboard/rules)**: qué hace que un método sea bueno, qué se descalifica
- **[Entorno de evaluación](/docs/network/specifications/harness)**: cómo ejecutar experimentos
- **[Conjuntos de datos de evaluación](/docs/network/leaderboard/datasets)**: EDTeKLA Dev v1 y FLORES+
- **[Datos de entrenamiento](https://champollion.dev/docs/concepts/coaching-data)**: cómo estructurar el conocimiento lingüístico para el LLM
- **[Convertidores de escritura](https://champollion.dev/docs/concepts/script-converters)**: el flujo de trabajo SRO→Silábicos
- **[Servir un método a través de API](https://champollion.dev/docs/guides/serving-a-method)**: alojamiento de traducción controlada por la comunidad
- **[ALTLab](https://altlab.ualberta.ca/)**: el Alberta Language Technology Lab
- **[EdTeKLA](https://spaces.facsci.ualberta.ca/edtekla/)**: el grupo de investigación Educational Technology, Knowledge & Language
- **[Diccionario itwêwina](https://itwewina.altlab.app/)**: diccionario de Plains Cree a inglés impulsado por FST

