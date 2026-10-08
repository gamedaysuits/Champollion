---
title: "Procedimiento de Citación de Tarjeta de Idioma"
sidebar_label: "Citation Procedure"
---

# Procedimiento de Citación de Tarjetas de Idioma

*Cómo Champollion asegura que cada afirmación en una tarjeta de idioma sea rastreable hasta una fuente primaria.*

---

## 1. El Problema

Las tarjetas de idioma contienen afirmaciones factuales — conteos de hablantes, estado de peligro, influencias de contacto, propiedades morfológicas, convenciones tipográficas, soporte de métodos — que **deben ser verificables**. Actualmente:

- El campo `dataSources` es un arreglo plano de cadenas (p. ej., `["cldr-48", "glottolog-5.3"]`)
- No hay granularidad de citación por campo
- Afirmaciones como "~2.8M hablantes" o "vulnerable" no tienen procedencia rastreable
- Un revisor no puede determinar qué fuente respalda qué afirmación

> [!CAUTION]
> **Una afirmación sin fuente es una afirmación inverificable.** Para un proyecto que se posiciona como profesionalmente riguroso, cada aseveración en una tarjeta de idioma debe ser rastreable hasta una fuente primaria específica y versionada.

---

## 2. Fuentes Autorizadas (Clasificadas por Prioridad)

Para cada tipo de afirmación, las siguientes fuentes son autorizadas. **Siempre prefiera la fuente de mayor rango disponible.**

### Clasificación e Identidad

| Prioridad | Fuente | Cubre | Licencia | Cómo Citar |
|---|---|---|---|---|
| 1 | [Glottolog](https://glottolog.org) (Max Planck) | Familia, ascendencia, glottocode | CC-BY 4.0 | `glottolog-5.x` |
| 2 | [ISO 639-3](https://iso639-3.sil.org) (SIL) | Códigos ISO, macroidiomas | Libre | `iso639-3-{date}` |
| 3 | [WALS](https://wals.info) (Max Planck) | Definiciones de género, características tipológicas | CC-BY 4.0 | `wals-2024` |
| 4 | [CLDR](https://cldr.unicode.org) (Unicode) | Códigos de configuración regional, códigos de escritura, reglas de plurales | Términos de Servicio de Unicode | `cldr-{version}` |

### Demografía de Hablantes y Vitalidad

| Prioridad | Fuente | Cubre | Licencia | Cómo Citar |
|---|---|---|---|---|
| 1 | Datos de censo nacional | Conteos oficiales de hablantes | Varía (generalmente público) | `census-{country}-{year}` |
| 2 | [Ethnologue](https://www.ethnologue.com) | Estimaciones de hablantes, EGIDS | Propietario (suscripción) | `ethnologue-{edition}` |
| 3 | [Atlas UNESCO](http://www.unesco.org/languages-atlas/) | Estado de peligro | Libre | `unesco-atlas-{year}` |
| 4 | Artículos académicos publicados | Encuestas regionales de hablantes | Licencia por artículo | `{author}-{year}` |
| 5 | [Katig Collective](https://linguistics.upd.edu.ph/the-katig-collective/) | Idiomas de Filipinas | Académico | `katig-{year}` |

> [!WARNING]
> **Nunca use Wikipedia, texto generado por IA, o conocimiento propio como fuente primaria para afirmaciones demográficas.** Estas son fuentes secundarias/terciarias en el mejor de los casos. Siempre rastree hasta los datos primarios.

### Soporte de Métodos (Cobertura de API de Traducción)

| Método | Fuente de Verificación | Cómo Verificar | Cómo Citar |
|---|---|---|---|
| Google Translate | [Lista de idiomas](https://cloud.google.com/translate/docs/languages) | Llamada a API o página de documentación | `google-translate-{date}` |
| DeepL | [Lista de idiomas](https://www.deepl.com/docs-api/translate-text/) | Llamada a API | `deepl-api-{date}` |
| Microsoft Translator | [Lista de idiomas](https://learn.microsoft.com/en-us/azure/ai-services/translator/language-support) | Página de documentación | `ms-translator-{date}` |
| LibreTranslate | [Lista de idiomas](https://libretranslate.com/languages) | Llamada a API | `libretranslate-{date}` |
| NLLB | [README de FLORES](https://github.com/openlanguagedata/flores) | README + tarjeta de modelo | `nllb-200-{date}` |
| LLM | Siempre `true` | N/A (la calidad varía) | `llm-assumed` |

### DLS (Soporte de Idioma Digital)

| Prioridad | Fuente | Cubre | Cómo Citar |
|---|---|---|---|
| 1 | [Simons et al. 2022](https://aclanthology.org/2022.coling-1.379/) | Puntuaciones DLS (143 herramientas originales) | `simons-2022` |
| 2 | Ethnologue 27ª edición+ | Puntuaciones DLS (211 herramientas expandidas) | `ethnologue-{edition}-dls` |

### Tipografía, Plurales, Escrituras

| Prioridad | Fuente | Cubre | Cómo Citar |
|---|---|---|---|
| 1 | [CLDR](https://cldr.unicode.org) | Reglas de plurales, marcas de comillas, formato de números | `cldr-{version}` |
| 2 | [CSUR de Unicode](https://unicode.org/iso15924/) | Códigos de escritura | `iso15924-{date}` |
| 3 | Gramáticas publicadas | Reglas específicas del idioma | `{author}-{year}` |

### Influencias de Contacto

| Prioridad | Fuente | Cubre | Cómo Citar |
|---|---|---|---|
| 1 | Artículos de lingüística histórica publicados | Estudios de palabras prestadas, historia de contacto | `{author}-{year}` |
| 2 | Gramáticas de referencia | Descripciones de influencia estructural | `{grammar-title}-{year}` |
| 3 | [WALS](https://wals.info) | Comparaciones tipológicas | `wals-{feature}-{year}` |

> [!IMPORTANT]
> **Las afirmaciones de influencia de contacto son las más difíciles de documentar.** Afirmaciones como "sustrato español, profundo, 1571–1898" requieren experiencia en lingüística histórica. Si no se puede encontrar una fuente publicada, marque la afirmación con `"citation_needed": true` en lugar de adivinar.

---

## 3. Procedimiento de Citación (Paso a Paso)

### Al Crear una Nueva Tarjeta de Idioma

1. **Comience con campos auto-poblados:**
   - Ejecute `node scripts/build-language-tree.mjs --enrich` → puebla `classification` desde Glottolog
   - Registre `"glottolog-{version}"` en `dataSources`

2. **Agregue datos de CLDR:**
   - Busque reglas de plurales, marcas de comillas, código de escritura en CLDR
   - Registre `"cldr-{version}"` en `dataSources`

3. **Investigue demografía de hablantes:**
   - Verifique datos de censo nacional PRIMERO
   - Haga referencias cruzadas con Ethnologue (si está disponible)
   - Haga referencias cruzadas con el Atlas UNESCO
   - Registre TODAS las fuentes consultadas en `dataSources`

4. **Verifique soporte de métodos:**
   - Verifique la lista de idiomas de CADA API (no memoria, no suposiciones)
   - Registre la fecha de verificación

5. **Investigue influencias de contacto:**
   - Encuentre artículos de lingüística histórica publicados
   - Documente período, tipo, profundidad con citas
   - Si no existe una fuente publicada, agregue `"citation_needed": true` a la entrada de influencia

6. **Investigue vitalidad:**
   - Verifique Ethnologue para EGIDS
   - Verifique el Atlas UNESCO para estado de peligro
   - Anote cualquier discrepancia entre fuentes

7. **Pueble `dataSources`:**
   - Liste CADA fuente consultada (no solo las que proporcionaron datos)
   - Use el formato de citación de las tablas anteriores

### Al Actualizar una Tarjeta Existente

1. **Nunca cambie una afirmación factuales sin actualizar `dataSources`**
2. **Si actualiza un conteo de hablantes**, elimine la fuente anterior y agregue la nueva
3. **Si agrega soporte de método**, verifique contra la API y registre la fecha
4. **Marque con fecha todas las verificaciones de soporte de método** — la cobertura de API cambia frecuentemente

---

## 4. Mejora de Esquema Propuesta: Citaciones por Campo

### Esquema Actual (`dataSources` Plano)

```json
"dataSources": ["cldr-48", "glottolog-5.3"]
```

**Problema:** ¿Qué campos vinieron de CLDR? ¿Cuáles de Glottolog? ¿Cuáles no tienen cita?

### Mejora Propuesta: `dataSources` Estructurado

```json
"dataSources": {
  "classification": ["glottolog-5.3"],
  "vitality.unescoStatus": ["unesco-atlas-2024"],
  "vitality.egids": ["ethnologue-27"],
  "vitality.speakerCount": ["census-ph-2020", "ethnologue-27"],
  "rules.plurals": ["cldr-48"],
  "rules.typography": ["cldr-48"],
  "contactInfluences": ["blust-2013", "llamzon-1969"],
  "methodSupport.googleTranslate": ["google-translate-2024-07"],
  "methodSupport.nllb": ["nllb-200-2024-03"],
  "dls": ["simons-2022", "ethnologue-27-dls"],
  "pipelineReadiness": ["manual-assessment-2025-06"]
}
```

### Ruta de Migración

Este es un cambio **compatible hacia atrás**:
1. Las tarjetas existentes mantienen el arreglo plano (aún válido)
2. Las tarjetas nuevas usan el formato estructurado
3. La validación de esquema acepta ambos formatos
4. Migre tarjetas existentes incrementalmente conforme se revisen

> [!TIP]
> **Valide con un script.** Agregue un script `validate-citations.mjs` que:
> - Verifique que cada tarjeta tenga al menos fuentes `classification` y `vitality`
> - Marque tarjetas con arreglos `dataSources` planos para actualización
> - Advierta sobre entradas `methodSupport` sin verificación marcada con fecha

---

## 5. Lista de Verificación de Calidad

Antes de fusionar cualquier cambio de tarjeta de idioma, verifique:

- [ ] Cada conteo de hablantes tiene una fuente (censo o Ethnologue, no Wikipedia)
- [ ] Cada estado UNESCO/EGIDS tiene una fuente
- [ ] Cada bandera de soporte de método fue verificada contra la API real (no asumida)
- [ ] Cada influencia de contacto tiene una fuente académica publicada O está marcada `citation_needed`
- [ ] La clasificación fue auto-poblada desde Glottolog (no construida manualmente)
- [ ] `dataSources` lista TODAS las fuentes consultadas
- [ ] Ninguna afirmación se basa únicamente en conocimiento generado por IA
- [ ] `humanReviewed` está establecido al identificador del revisor y fecha si un hablante nativo revisó

---

## 6. Campo `humanReviewed`

El esquema de tarjeta de idioma incluye un campo `humanReviewed` que actualmente está `null` en todas las tarjetas. Este campo debe poblarse cuando un hablante nativo o lingüista calificado revisa la tarjeta:

```json
"humanReviewed": {
  "reviewer": "Prof. Kenneth Jamandre",
  "affiliation": "University of the Philippines",
  "date": "2026-06-08",
  "scope": "full",
  "notes": "Verified speaker count, vitality assessment, and contact influences."
}
```

> [!IMPORTANT]
> **La revisión comunitaria es el estándar de oro.** Los datos automatizados y los artículos académicos proporcionan la base, pero la revisión de un hablante nativo es la validación final. Esto es especialmente crítico para:
> - Afirmaciones de influencia de contacto (los miembros de la comunidad saben qué palabras prestadas se usan realmente)
> - Evaluaciones de vitalidad (los miembros de la comunidad saben si los niños hablan el idioma)
> - Sistemas de formalidad (las descripciones académicas pueden perder patrones de uso cotidiano)

---

## 7. Referencias para Este Procedimiento

1. Glottolog: https://glottolog.org — CC-BY 4.0
2. ISO 639-3: https://iso639-3.sil.org — Libre
3. WALS: https://wals.info — CC-BY 4.0
4. CLDR: https://cldr.unicode.org — Términos de Uso de Unicode
5. Ethnologue: https://www.ethnologue.com — Propietario (suscripción)
6. Atlas UNESCO: http://www.unesco.org/languages-atlas/ — Libre
7. Simons et al. (2022): https://aclanthology.org/2022.coling-1.379/
8. Especificación de Tarjeta de Idioma Champollion: `cli/website/docs/reference/language-card-spec.md`
