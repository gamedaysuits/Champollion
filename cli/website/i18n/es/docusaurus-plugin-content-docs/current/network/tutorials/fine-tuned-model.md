---
sidebar_position: 5
title: "Recetas: Modelo Ajustado"
---

# Modelo Ajustado Fino

> **La idea:** Ajustar fino un modelo de peso abierto (Llama, Mistral, Gemma) en texto paralelo para su par de idiomas objetivo. Potencialmente el techo de calidad más alto, pero requiere datos paralelos que pueden ser escasos — y las reglas de contaminación de datos de evaluación son estrictas.

:::info[Este es un cookbook, no una implementación terminada]
Esta guía describe el enfoque, los requisitos de datos y las trampas potenciales. La infraestructura de entrenamiento real está fuera del alcance del harness.
:::

## Cuándo Usar Esto

- Tiene acceso a un **corpus paralelo** (cientos a miles de pares de oraciones) que es **completamente independiente** del conjunto de datos de evaluación
- Tiene **acceso a GPU** para entrenamiento (hardware local, nube o clúster de cómputo universitario)
- Desea el **techo de calidad más alto** para un par de idiomas específico y está dispuesto a invertir en entrenamiento
- Otros enfoques (indicaciones entrenadas, pocos ejemplos) han alcanzado una meseta de calidad

## Cómo Funciona

1. **Ensamblar datos paralelos** — pares de oraciones origen-objetivo de fuentes independientes (libros de texto, archivos comunitarios, registros de Hansard, textos religiosos, materiales educativos)
2. **Preparar formato de entrenamiento** — formato de ajuste de instrucciones (indicación del sistema + entrada + salida esperada)
3. **Ajustar fino** — LoRA/QLoRA en un modelo base (cuantización de 4 bits hace esto viable en GPU de consumidor)
4. **Evaluar con el arnés** — ejecutar el modelo ajustado fino a través del arnés de evaluación
5. **Iterar** — ajustar datos de entrenamiento, hiperparámetros, selección de modelo base

## Requisitos de Datos

| Tamaño del Corpus | Qué Esperar |
|---|---|
| 50–200 pares | Mejora marginal sobre cero ejemplos; puede sobreajustarse |
| 200–1,000 pares | Mejora notable en estilo y terminología |
| 1,000–5,000 pares | Ganancias de calidad significativas para el par de idiomas específico |
| 5,000+ pares | Aproximándose al techo de calidad del modelo base |

:::danger[Contaminación de datos de evaluación = descalificación]
Sus datos de entrenamiento NO DEBEN superponerse con el conjunto de datos de evaluación. Ni las oraciones, ni la lista de vocabulario, ni paráfrasis del mismo contenido. El harness genera huellas dactilares de sus salidas; la superposición estadística es detectable. Si no está seguro de si una fuente de datos es independiente, opte por la exclusión. Consulte [Reglas del Leaderboard](/docs/network/leaderboard/rules).
:::

## Esqueleto: Ajuste Fino LoRA

```python
# Conceptual skeleton — adapt to your framework (HuggingFace, Axolotl, etc.)

# 1. Format your parallel data as instruction pairs
training_data = [
    {"instruction": "Translate to Plains Cree (SRO)", 
     "input": "The children are playing",
     "output": "awâsisak mêtawêwak"},
    # ... hundreds more
]

# 2. Fine-tune with LoRA (4-bit for consumer GPUs)
# Base model: meta-llama/Llama-3.1-8B, google/gemma-2-9b, etc.
# Rank: 16–64, Alpha: 32–128, Epochs: 3–5

# 3. Export and serve via the harness TranslationMethod protocol
```

## Dónde Encontrar Datos Paralelos

- **Archivos comunitarios** — materiales educativos, documentos gubernamentales, publicaciones bilingües
- **Nunavut Hansard** — 1.3M pares alineados inglés-inuktitut (NRC Canadá)
- **Traducciones de la Biblia** — disponibles para muchos idiomas de recursos bajos, pero específicas del dominio
- **Libros de texto educativos** — a menudo bilingües en contextos de aprendizaje de idiomas
- **Crear el suyo propio** — vea [Guía de Creación de Corpus](./corpus-creation)

## Ventajas y Desventajas

| | |
|---|---|
| ✅ Techo de calidad más alto | ❌ Requiere datos paralelos (escasos para idiomas de recursos bajos) |
| ✅ El modelo aprende patrones específicos del idioma | ❌ Costos de GPU (aunque LoRA ayuda) |
| ✅ Puede superar enfoques indicados | ❌ Riesgo de sobreajuste con conjuntos de datos pequeños |
| ✅ Costo de entrenamiento único, luego inferencia económica | ❌ Reglas estrictas de contaminación de evaluación |

## Se Combina Bien Con

- **[Creación de Corpus](./corpus-creation)** — construya los datos de entrenamiento que necesita
- **[Retrotraducción](./back-translation)** — expanda su corpus paralelo sintéticamente
- **[Tubería Controlada por FST](./fst-gated-pipeline)** — modelo ajustado fino + validación morfológica
- **[Indicaciones LLM Entrenadas](./coached-llm-prompting)** — entrenamiento sobre una base ajustada fina

## Véase También

- [Conjuntos de Datos de Evaluación](/docs/network/leaderboard/datasets) — sepa qué NO PUEDE entrenar
- [Reglas del Tablero de Clasificación](/docs/network/leaderboard/rules) — política de contaminación
- [Apoye un Idioma de Recursos Bajos](/docs/network/community/low-resource-languages)
