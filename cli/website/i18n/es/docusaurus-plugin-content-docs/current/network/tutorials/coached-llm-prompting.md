---
sidebar_position: 2
title: "Recetario: Prompting de LLM con Orientación"
related:
  - label: "Cookbook: Few-Shot Prompting"
    to: /docs/network/tutorials/few-shot-prompting
    kind: cookbook
  - label: "Cookbook: Fine-Tuned Model"
    to: /docs/network/tutorials/fine-tuned-model
    kind: cookbook
  - label: "Coaching Data"
    to: https://champollion.dev/docs/concepts/coaching-data
    kind: champollion
    note: "How coaching data ships to production"
  - label: "Submit a Method"
    to: /docs/network/getting-started/submit-a-method
    kind: guide
---

# Indicaciones Entrenadas para LLM

> **La idea:** Inyectar reglas gramaticales, diccionarios bilingües y notas de estilo directamente en el prompt del sistema del LLM. Sin entrenamiento, sin ajuste fino — solo conocimiento lingüístico estructurado que orienta la salida hacia traducciones válidas.

:::info[Este es un libro de recetas, no una implementación terminada]
Esta guía esboza el enfoque y sus decisiones de diseño clave. Adáptela a su par de idiomas, recursos disponibles y objetivos de evaluación.
:::

## Cuándo Usar Esto

- Usted tiene **conocimiento lingüístico** sobre el idioma de destino (reglas gramaticales, entradas de diccionario, preferencias de estilo) pero no suficientes datos paralelos para ajuste fino
- Desea **iterar rápidamente** — los cambios de prompt se despliegan en segundos, sin reentrenamiento
- El idioma de destino tiene **patrones conocidos** que el LLM interpreta incorrectamente (concordancia de género, convenciones de escritura, niveles de formalidad)
- Desea comparar indicaciones entrenadas contra una línea base e iterar sobre lo que funciona

## Cómo Funciona

1. **Reúna datos de entrenamiento** — reglas gramaticales, un diccionario bilingüe y notas de estilo en un archivo JSON estructurado
2. **Configure el registro** — un prefijo de prompt del sistema que establece el idioma, escritura y tono
3. **Ejecute el arnés** — los datos de entrenamiento se inyectan en cada prompt del LLM
4. **Revise los fallos** — observe qué rechaza la puerta de calidad, agregue reglas para abordar patrones
5. **Itere** — cada revisión del archivo de entrenamiento es un nuevo experimento; el arnés los rastrea todos

## Estructura de Datos de Entrenamiento

```json title="coaching/<locale>.json"
{
  "grammar_rules": [
    "Adjectives agree in gender and number with the noun they modify",
    "Use formal register (vous) for all UI text",
    "Preserve interpolation variables exactly: {{name}}, {count}"
  ],
  "dictionary": {
    "dashboard": "tableau de bord",
    "settings": "paramètres",
    "deploy": "déployer"
  },
  "style_notes": "Prefer active voice. Avoid anglicisms where a native term exists. Keep sentences concise for UI readability."
}
```

## Decisiones de Diseño Clave

**Especificidad de reglas vs. ventana de contexto:** Más reglas dan más orientación al LLM, pero consumen la ventana de contexto disponible para la traducción real. Comience con 5–10 reglas de alto impacto y agregue más solo cuando vea patrones de fallo específicos.

**Cobertura de diccionario:** No necesita un diccionario completo — enfóquese en términos que el LLM interpreta consistentemente de forma incorrecta. Incluso 20–30 términos forzados pueden mejorar dramáticamente la consistencia.

**El orden de las reglas importa:** Coloque las reglas más importantes primero. Los LLM atienden más fuertemente a las instrucciones tempranas.

## Ejecutar un Experimento

```bash
mt-eval run \
  --corpus eval-amh-fra-globalvoices-test-v1 \
  --model google/gemini-2.5-pro \
  --name coached-v1 \
  --coaching-file coaching/crk.json
```

## Ventajas y Desventajas

| | |
|---|---|
| ✅ Costo de entrenamiento cero | ❌ Techo de calidad limitado por el conocimiento base del LLM |
| ✅ Iteración instantánea (cambiar prompt → re-ejecutar) | ❌ Los límites de ventana de contexto restringen cuánto entrenamiento cabe |
| ✅ Funciona con cualquier proveedor de LLM | ❌ Las reglas pueden entrar en conflicto — depurar interacciones de prompt es un arte |
| ✅ Transparente — puede leer exactamente qué ve el LLM | ❌ No crea nuevo conocimiento, solo orienta el conocimiento existente |

## Se Combina Bien Con

- **[FST-Gated Pipeline](./fst-gated-pipeline)** — entrenamiento + validación morfológica captura lo que el entrenamiento solo no puede
- **[Dictionary-Augmented LLM](./dictionary-augmented-llm)** — terminología forzada es una forma de entrenamiento
- **[Few-Shot Prompting](./few-shot-prompting)** — ejemplos + reglas juntos son más poderosos que cualquiera de los dos solos

## Véase También

- [Method Interface](/docs/network/specifications/methods) — formato de datos de entrenamiento y protocolo TranslationMethod
- [Support a Low-Resource Language](/docs/network/community/low-resource-languages) — el contexto completo
- [Eval Harness](/docs/network/specifications/harness) — cómo ejecutar experimentos
