---
sidebar_position: 5
title: "Desplegar a Producción"
description: "Toma un método probado de la Red e impleméntalo mediante champollion."
---

# Desplegar a Producción

Lo probó en la Red. Ahora despliéguelo.

La Red es para I+D — construir, comparar y evaluar métodos de traducción. **El despliegue a producción** ocurre a través de [champollion](https://champollion.dev), la CLI de traducción orientada a desarrolladores. Se conectan a través de un formato de complemento compartido.

```mermaid
graph LR
    A["Network\n(benchmark)"] -->|"method.json\n+ coaching data"| B["champollion\n(production)"]
    B -->|"Speaker feedback\nimproves the method"| A
```

---

## La Ruta de Despliegue

### 1. Exporte Su Método como un Complemento

Cree un manifiesto `method.json` que empaquete sus resultados de evaluación:

```json
{
  "name": "crk-coached-v3",
  "type": "llm-coached",
  "version": "3.0.0",
  "description": "Coached LLM translation for Plains Cree",
  "locales": ["crk"],
  "config": {
    "model": "google/gemini-2.5-flash",
    "temperature": 0.3
  },
  "benchmarks": {
    "crk": {
      "composite_score": 0.67,
      "fst_acceptance": 0.82,
      "corpus_size": 150
    }
  }
}
```

Incluya cualquier dato de entrenamiento (reglas gramaticales, diccionarios) junto con el manifiesto.

### 2. Instale en Champollion

```bash
champollion plugin install ./my-method-plugin/
```

### 3. Configure Su Par

```json title="champollion.config.json"
{
  "pairs": {
    "en-crk": { "method": "plugin", "plugin": "crk-coached-v3" }
  }
}
```

### 4. Traduzca Contenido Real

```bash
npx champollion sync
```

Su método evaluado ahora está produciendo traducciones reales en producción.

---

## Para Lenguas Indígenas

Los métodos destinados a las comunidades de lenguas indígenas requieren **el consentimiento de la comunidad** antes de su despliegue en producción. Los principios indígenas de soberanía de datos — la propiedad y el control comunitarios de los datos lingüísticos — rigen cómo se desarrollan, evalúan y despliegan los métodos de traducción.

Un método que alcanza el nivel Desplegable (0.70+) no se despliega automáticamente — se despliega **si y cuando** el órgano de gobernanza de la comunidad de lengua da su consentimiento.

Consulte [Soberanía de Datos](/docs/network/sovereignty/data-sovereignty) y [Transferencia de Propiedad](/docs/network/sovereignty/ownership-transfer) para el marco de gobernanza completo.

---

## Consulte también

- [El Puente del Arnés de Evaluación](https://champollion.dev/docs/guides/bridge) — recorrido detallado de la canalización Red→champollion
- [Especificación de Complementos](https://champollion.dev/docs/reference/plugin-spec) — el formato del manifiesto method.json
- [Guía del Agente champollion](https://champollion.dev/docs/guides/agent-guide) — cómo usar champollion para traducción

