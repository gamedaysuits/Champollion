---
sidebar_position: 7
title: "Recetario: Híbrido Basado en Reglas + LLM"
---

# Híbrido Basado en Reglas + LLM

> **La idea:** Utilizar reglas lingüísticas deterministas para patrones que sabe que son correctos (afijación morfológica, formato de números, estructuras de frases conocidas), y dejar que el LLM maneje la traducción creativa para todo lo demás. Las reglas prevalecen sobre el LLM donde aplican; el LLM llena los vacíos.

:::info[Este es un libro de recetas, no una implementación terminada]
Esta guía esboza la arquitectura híbrida. Las reglas específicas dependen completamente de la gramática de su idioma de destino y los recursos lingüísticos disponibles.
:::

## Cuándo Usar Esto

- Tiene **experiencia lingüística profunda** en el idioma de destino (o acceso a un lingüista)
- Algunos patrones de traducción son **deterministas** — conoce la salida correcta con certeza
- El LLM **falla consistentemente** en patrones específicos (formato de números, honoríficos, aglutinación)
- Desea **garantizar corrección** para patrones de alto riesgo mientras mantiene fluidez para el resto

## Cómo Funciona

```
Input ──→ [Rule Engine] ──→ [LLM] ──→ [Merge] ──→ Output
              │                │           │
              │ Known patterns │ Unknown    │ Rules override
              │ handled here   │ parts      │ LLM where both
              ▼                ▼            ▼ produced output
         Deterministic     Creative     Final translation
         fragments         translation
```

1. **Definir reglas** — patrones regex, búsquedas FST, tablas de búsqueda para traducciones conocidas
2. **Preprocesar** — identificar y extraer segmentos coincidentes con reglas de la fuente
3. **LLM traduce** — el texto restante, con salidas de reglas como restricciones
4. **Fusionar** — rearmar la traducción, prefiriendo la salida de reglas donde esté disponible
5. **Validar** — verificación opcional de FST/regla en el resultado fusionado

## Ejemplo: Reglas de Números y Fechas

```python
import re

# Rule: Numbers stay as-is (don't let the LLM hallucinate number translations)
def rule_preserve_numbers(text):
    return re.sub(r'\b\d+\b', lambda m: f'__NUM_{m.group()}__', text)

# Rule: Known greetings have exact translations
GREETING_RULES = {
    "hello": "tânisi",
    "goodbye": "êkosi",
    "thank you": "kinanâskomitin",
}

# Rule: Date format conversion
def rule_date_format(text):
    # "January 15" → "kisê-pîsim 15" (deterministic month mapping)
    ...
```

## Decisiones de Diseño Clave

**Prioridad de reglas:** Cuando una regla y el LLM producen ambos salida para el mismo segmento, ¿cuál gana? Las reglas deben ganar para patrones **críticos para la corrección**. El LLM debe ganar para patrones **críticos para la fluidez**.

**Granularidad:** Reglas a nivel de palabra (búsqueda en diccionario) vs. reglas a nivel de frase (mapeo de modismos) vs. reglas estructurales (reordenamiento de oraciones). Comience con nivel de palabra; agregue nivel de frase conforme identifique patrones.

**Mantenimiento de reglas:** Cada regla es una obligación de mantenimiento. Prefiera un conjunto pequeño de reglas de alta confianza sobre un conjunto grande de reglas aproximadas. Si no está seguro de que una regla es correcta, déjela al LLM.

## Ventajas y Desventajas

| | |
|---|---|
| ✅ Corrección garantizada donde aplican las reglas | ❌ Requiere experiencia lingüística profunda |
| ✅ Transparente — las reglas son legibles y auditables | ❌ La costura entre regla/LLM puede producir salida poco natural |
| ✅ Las reglas son rápidas (sin costo de API) | ❌ La carga de mantenimiento crece con el número de reglas |
| ✅ Progresivo — agregue reglas conforme aprenda | ❌ Difícil de manejar inflexión en límites de reglas |

## Se Combina Bien Con

- **[FST-Gated Pipeline](./fst-gated-pipeline)** — FST como un tipo específico de motor de reglas
- **[Dictionary-Augmented LLM](./dictionary-augmented-llm)** — búsqueda en diccionario es una regla simple
- **[Coached LLM Prompting](./coached-llm-prompting)** — el coaching maneja preferencias suaves, las reglas manejan requisitos duros

## Véase También

- [GiellaLT](https://giellalt.github.io/) — infraestructura FST de código abierto para más de 100 idiomas
- [Apertium](https://www.apertium.org/) — plataforma de TA basada en reglas con diccionarios bilingües
- [Support a Low-Resource Language](/docs/network/community/low-resource-languages)
