---
sidebar_position: 5
title: "Datos de Coaching"
related:
  - label: "Build a Translation Plugin"
    to: /docs/tutorials/build-a-plugin
    kind: tutorial
    note: "Develop and ship coaching data end-to-end"
  - label: "Plugin Specification"
    to: /docs/reference/plugin-spec
    kind: reference
  - label: "Cookbook: Coached LLM Prompting"
    to: /docs/network/tutorials/coached-llm-prompting
    kind: arena
    note: "The eval-side cookbook for coached methods"
  - label: "Quality Gate"
    to: /docs/concepts/quality-gate
    kind: concept
---

# Datos de Coaching

Los datos de coaching son el mecanismo de champollion para enseñar a los LLMs sobre idiomas en los que no fueron entrenados. Al proporcionar reglas gramaticales, diccionarios y notas de estilo junto con cada solicitud de traducción, usted transforma un LLM de propósito general en un traductor consciente del contexto para cualquier idioma — incluyendo idiomas sin soporte de MT existente.

## Cómo funciona

Cuando usted establece el método de un par en `llm-coached`, champollion carga un archivo de coaching desde `.champollion/coaching/<locale>.json` e inyecta su contenido en cada solicitud al LLM como parte del mensaje del sistema. El LLM ve sus reglas lingüísticas junto con la solicitud de traducción, produciendo resultados que siguen su gramática y terminología en lugar de adivinar.

```
┌──────────────────────────────────────────────────────┐
│ System Message (cached across batches)               │
│ ┌──────────────────────────────────────────────────┐ │
│ │ Base translation rules                           │ │
│ │ + Register instructions                          │ │
│ │ + Coaching guidance (from coachingFile, if set)   │ │
│ │ + Grammar rules (from coaching data)             │ │
│ │ + Dictionary entries (from coaching data)         │ │
│ │ + Style notes (from coaching data)               │ │
│ └──────────────────────────────────────────────────┘ │
├──────────────────────────────────────────────────────┤
│ User Message (per batch)                             │
│ ┌──────────────────────────────────────────────────┐ │
│ │ Keys to translate (JSON)                         │ │
│ └──────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────┘
```

Hay dos tipos de contenido de coaching:

1. **Datos de coaching estructurados** (método `llm-coached`) — Reglas gramaticales, diccionarios y notas de estilo en formato JSON. Cargados desde `.champollion/coaching/<locale>.json` o desde el directorio `coaching/` de un plugin.
2. **Solicitud de coaching de texto libre** (campo de configuración `coachingFile`) — Un archivo de texto plano con orientación adicional inyectada en el mensaje del sistema. Funciona con cualquier método de LLM, no solo `llm-coached`. Se establece mediante `coachingFile` en su configuración o `--coaching-file` en la CLI.

Ambos pueden usarse juntos. El arnés de evaluación utiliza la misma estructura de solicitud exacta — por lo que sus puntuaciones de referencia reflejan sus solicitudes reales de producción.

Debido a que los datos de coaching son parte del mensaje del sistema, se benefician del **almacenamiento en caché de solicitudes** — proveedores como Anthropic y Google almacenan en caché los prefijos del sistema repetidos, por lo que usted solo paga por el contexto de coaching una vez por sesión, no una vez por lote.

## Formato del archivo de coaching

Cree un archivo JSON por configuración regional en `.champollion/coaching/`:

```json title=".champollion/coaching/crk.json"
{
  "grammar_rules": [
    "Plains Cree is polysynthetic — a single word can express what English needs a full sentence for",
    "Animate/inanimate noun distinction affects verb conjugation",
    "Use SRO (Standard Roman Orthography) unless script converter handles conversion",
    "Verb stems are modified by prefixes and suffixes to indicate person, number, tense, and evidentiality"
  ],
  "dictionary": {
    "home": "kīwēwin",
    "settings": "isi-nākatohkēwin",
    "search": "nānātawāpahtam",
    "welcome": "tānisi",
    "submit": "ispīhci",
    "cancel": "pōni"
  },
  "style_notes": "Use formal register. Preserve English technical terms in parentheses when no Cree equivalent exists. Avoid loanwords when a descriptive Cree expression exists."
}
```

### Campos

| Campo | Tipo | Requerido | Descripción |
|-------|------|----------|-------------|
| `grammar_rules` | `string[]` | No | Matriz de reglas gramaticales inyectadas en el mensaje del sistema. Cada regla debe ser una instrucción concisa y accionable que el LLM pueda seguir. |
| `dictionary` | `object` | No | Mapa de clave-valor de término en inglés → término en idioma de destino. Se utiliza para vocabulario específico del dominio que el LLM no conocería. |
| `style_notes` | `string` | No | Instrucciones de estilo de forma libre (registro, tono, convenciones de formalidad). |

Todos los campos son opcionales — usted puede comenzar con solo un diccionario y agregar reglas gramaticales a medida que refina.

## Comportamiento de respaldo

Si un par está configurado para `llm-coached` pero no existe un archivo de coaching para esa configuración regional, champollion **recurre al método estándar `llm`** con una advertencia en la consola:

```
[INFO] No coaching data for "crk" at .champollion/coaching/crk.json
       Falling back to standard LLM method. Create coaching data for better results.
```

Esto significa que usted puede establecer `"defaultMethod": "llm-coached"` de forma global — los idiomas con datos de coaching los utilizarán, y el resto obtendrá traducción estándar de LLM sin errores.

## Cuándo usar coaching

| Escenario | Método recomendado |
|----------|-------------------|
| Idiomas de nivel 1 (francés, español, alemán) | `llm` o `google-translate` — Los LLMs ya conocen bien estos idiomas |
| Idiomas de nivel 2 (coreano, turco, tailandés) | `llm` con un registro — Los LLMs manejan estos adecuadamente con orientación de estilo |
| Idiomas de nivel 3 (Plains Cree, yoruba, quechua) | `llm-coached` — Los LLMs necesitan reglas gramaticales y diccionarios |
| Conlangs (klingon, sindarin, kryptoniano) | `llm-coached` — Los LLMs tienen algunos datos de entrenamiento pero necesitan correcciones |

## Construcción de buenos datos de coaching

### Reglas gramaticales

Escriba las reglas como **instrucciones**, no como descripciones. El LLM sigue instrucciones mejor que interpreta teoría lingüística.

```json
// ❌ Descriptive (the LLM learns nothing actionable)
"Plains Cree has animate and inanimate noun classes"

// ✅ Instructive (the LLM knows what to do)
"When translating nouns, check whether the Cree equivalent is animate (NA) or inanimate (NI) — this affects which verb conjugation to use"
```

### Diccionarios

Enfóquese en **términos específicos del dominio** que el LLM interpretaría mal o inventaría. No se moleste con palabras comunes que el LLM ya maneja — enfóquese en los términos específicos de la interfaz de usuario de su aplicación.

### Notas de estilo

Sea específico sobre registro, formalidad y convenciones:

```json
"style_notes": "Use formal register (vous-form in French). Preserve brand names untranslated. UI labels should be imperative mood ('Save', not 'Saves'). Maximum 40 characters for button text."
```

## Prueba de traducciones con coaching

Utilice el [Arnés de evaluación de MT](https://github.com/gamedaysuits/Champollion) para comparar sus traducciones con coaching contra un corpus de referencia:

```bash
# Install the harness
pip install mt-eval-harness

# Run coached translations against your test corpus
mt-eval run --corpus data/crk-corpus.json --model google/gemini-2.5-pro

# Score the results
mt-eval test eval/logs/run_*.json
```

Esto le proporciona puntuaciones de chrF++, BLEU y coincidencia exacta. Cree múltiples versiones de archivos de coaching y compare — las métricas objetivas superan la revisión subjetiva.

---

## Véase también

- [Métodos de traducción](/docs/guides/translation-methods) — el método llm-coached
- [Soporte para un idioma de recursos limitados](/docs/network/community/low-resource-languages) — coaching en la práctica
- [Especificación de plugins](/docs/reference/plugin-spec) — empaquetamiento de datos de coaching en un plugin
- [Puerta de calidad](/docs/concepts/quality-gate) — cómo se validan las traducciones con coaching
- [Configuración](/docs/getting-started/configuration) — configuración de coaching por par
