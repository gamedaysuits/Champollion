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

1. **Datos de coaching estructurados** (método `llm-coached`) — Reglas gramaticales, diccionarios y notas de estilo en formato JSON. Se cargan desde `.champollion/coaching/<locale>.json` o desde el directorio `coaching/` de un complemento. Su `dictionary` es también el glosario del proyecto: a cada método de LLM (`llm`, `openai`, `anthropic`, `gemini`, `local`) se le indican los términos del glosario que contiene cada lote, DeepL lo envía como glosario y sync advierte cuando la salida de cualquier método omite un término. Las reglas gramaticales y las notas de estilo son leídas únicamente por `llm-coached` — en cualquier proveedor (`"provider": "openai"`, `"local"`, …).
2. **Prompt de coaching en texto libre** (campo de configuración `coachingFile`) — Un archivo de texto plano con orientación adicional inyectada en el prompt del sistema. Funciona con cualquier método de LLM, no solo con `llm-coached`. Se configura mediante `coachingFile` en su configuración o con `--coaching-file` en la CLI.

Ambos pueden usarse juntos. El arnés de evaluación utiliza la misma estructura de solicitud exacta — por lo que sus puntuaciones de referencia reflejan sus solicitudes reales de producción.

Debido a que los datos de coaching son parte del mensaje del sistema, se benefician del **almacenamiento en caché de solicitudes** — proveedores como Anthropic y Google almacenan en caché los prefijos del sistema repetidos, por lo que usted solo paga por el contexto de coaching una vez por sesión, no una vez por lote.

## Formato del archivo de coaching

Cree un archivo JSON por cada configuración regional (locale) en `.champollion/coaching/`. El ejemplo
a continuación es para un idioma ficticio bajo `qaa`, un código de uso privado que
ningún idioma real tiene: cada regla y término en él es un marcador de posición, no un dato real sobre ningún
idioma. Escriba el suyo propio, idealmente junto con un hablante del idioma, y tome
los términos del diccionario de una fuente que pueda citar.

```json title=".champollion/coaching/qaa.json"
{
  "grammar_rules": [
    "One word can carry what English says in a whole clause: translate the meaning of the phrase, not word by word",
    "Nouns are animate or inanimate, and the verb ending follows the class: check the noun's class before choosing the verb form",
    "Write the standard Latin orthography; the script converter produces the display script",
    "Put the verb first in a command (button labels, menu items)"
  ],
  "dictionary": {
    "home": "<your term for home>",
    "settings": "<your term for settings>",
    "search": "<your term for search>",
    "welcome": "<your term for welcome>",
    "submit": "<your term for submit>",
    "cancel": "<your term for cancel>"
  },
  "style_notes": "Use the formal register. When the language has no term for an English technical word, write a descriptive phrase and keep the English word in parentheses after it."
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
[INFO] No coaching data for "qaa" at .champollion/coaching/qaa.json
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
"This language has animate and inanimate noun classes"

// ✅ Instructive (the LLM knows what to do)
"When translating a noun, look up whether it is animate (NA) or inanimate (NI) in the dictionary — the class decides the verb ending"
```

### Diccionarios

Enfóquese en **términos específicos del dominio** que el LLM interpretaría mal o inventaría. No se moleste con palabras comunes que el LLM ya maneja — enfóquese en los términos específicos de la interfaz de usuario de su aplicación.

**El diccionario se verifica para cada método.** Sin importar qué método traduzca un
par —un modelo alojado, su propio modelo a través de `local`, DeepL, un endpoint de `api`—,
`champollion sync` verifica cada cadena traducida contra el
diccionario e imprime una advertencia `[TERM]` indicando cualquier término que no se haya utilizado.
Solo `llm-coached` (en el prompt) y `deepl` (como glosario de DeepL) también
lo *aplican* durante la traducción; para los demás, la verificación le indica qué
cadenas debe corregir, por ejemplo con `champollion sync --method llm-coached
--redo keys:<key>`.

### Notas de estilo

Sea específico sobre registro, formalidad y convenciones:

```json
"style_notes": "Use formal register (vous-form in French). Preserve brand names untranslated. UI labels should be imperative mood ('Save', not 'Saves'). Maximum 40 characters for button text."
```

## Prueba de traducciones con coaching

Utilice el [Arnés de evaluación de MT](https://github.com/gamedaysuits/Champollion) para comparar sus traducciones con coaching contra un corpus de referencia:

```bash
# Install the harness
python3 -m pip install mt-eval-harness

# Run coached translations against your test corpus
mt-eval run --corpus data/crk-corpus.json --model google/gemini-3.1-pro-preview

# Score the results
mt-eval test eval/logs/run_*.json
```

Esto le proporciona puntuaciones de chrF++, BLEU y coincidencia exacta. Cree múltiples versiones de archivos de coaching y compare — las métricas objetivas superan la revisión subjetiva.

---

## Consulte también

- [Métodos de traducción](/docs/guides/translation-methods) — el método llm-coached
- [Soporte para un idioma de recursos limitados](/docs/network/community/low-resource-languages) — coaching en la práctica
- [Especificación de plugins](/docs/reference/plugin-spec) — empaquetamiento de datos de coaching en un plugin
- [Puerta de calidad](/docs/concepts/quality-gate) — cómo se validan las traducciones con coaching
- [Configuración](/docs/getting-started/configuration) — configuración de coaching por par
