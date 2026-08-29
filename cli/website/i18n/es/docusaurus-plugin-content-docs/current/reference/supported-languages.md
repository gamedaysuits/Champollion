---
sidebar_position: 4
title: "Idiomas Compatibles"
related:
  - label: "The Language Atlas"
    to: /languages
    kind: atlas
    note: "Browse the same coverage on the map"
  - label: "Trading Cards"
    to: /trading-cards
    kind: card
    note: "Every language as a collectible stat card"
  - label: "Language Card Specification"
    to: /docs/reference/language-card-spec
    kind: reference
  - label: "Endonym"
    to: /glossary#term-endonym
    kind: glossary
    note: "Why we write languages in their own names"
---

# Idiomas Compatibles

champollion incluye **Tarjetas de Idioma** — archivos de configuración estructurados para 50 idiomas. Cada tarjeta contiene presets de registro, metadatos del sistema de formalidad, banderas de soporte de métodos, reglas tipográficas e información de escritura. Cualquier idioma que su LLM conozca puede agregarse con una sola línea de configuración — estos son los que tienen registros curados y listos para producción.

---

## Métodos de Traducción

Cada idioma puede usar uno o más de estos métodos de traducción:

| Ícono | Método | Cómo funciona | Costo |
|------|--------|-------------|------|
| 🟢 | **Google Translate** | Traducción automática neuronal de referencia. 194 idiomas. Solo cadenas clave-valor — no puede traducir contenido Markdown de forma segura. | ~$20/1M de caracteres |
| 🔵 | **LLM (OpenRouter)** | Cualquier idioma que el modelo conozca. Prompts guiados por registro. Maneja contenido clave-valor + Markdown. | Varía según el modelo |
| 🟣 | **LLM-Coached** | LLM + diccionarios de gramática + datos de instrucción inyectados en los prompts. Ideal para idiomas morfológicamente complejos. | Varía según el modelo |
| 🟠 | **API (Plugin)** | Pipelines de traducción alojados por la comunidad y servidos a través de HTTP. [Aspirante a la soberanía](/docs/network/community/low-resource-languages). | Varía según el proveedor |

Configure `GOOGLE_TRANSLATE_API_KEY` para Google Translate, o `OPENROUTER_API_KEY` para métodos LLM. Consulte [Métodos de Traducción](/docs/guides/translation-methods) para obtener detalles completos.

---

## Idiomas Prioritarios

Estas son las configuraciones regionales más solicitadas para aplicaciones web y móviles, listadas en el orden recomendado de accesibilidad primero de champollion.

| Bandera | Idioma | Código | Google | LLM | Coached | Escritura | Notas |
|---------|--------|--------|:------:|:---:|:-------:|-----------|-------|
| 🇸🇦 | Árabe | `ar` | ✅ | ✅ | ✅ | — | RTL. Árabe Estándar Moderno (فصحى). |
| 🇵🇭 | Filipino (Taglish) | `tl` / `fil` | ✅ | ✅ | ✅ | — | Use `fil` en configuraciones de Docusaurus. champollion resuelve ambos. |
| 🇫🇷 | Francés | `fr` | ✅ | ✅ | ✅ | — | Forma vous. Inclusivo de género (Connecté·e). |
| 🇪🇸 | Español | `es` | ✅ | ✅ | ✅ | — | Neutral latinoamericano. |
| 🇩🇪 | Alemán | `de` | ✅ | ✅ | ✅ | — | Forma Sie. Inclusivo de género (Benutzer:innen). |
| 🇯🇵 | Japonés | `ja` | ✅ | ✅ | ✅ | — | です/ます para texto de cuerpo, する para etiquetas de UI. |
| 🇨🇳 | Chino (Simplificado) | `zh` | ✅ | ✅ | ✅ | — | 简体中文. |
| 🇮🇹 | Italiano | `it` | ✅ | ✅ | ✅ | — | Forma Lei. |
| 🇧🇷 | Portugués (BR) | `pt` | ✅ | ✅ | ✅ | — | Portugués brasileño. |
| 🇰🇷 | Coreano | `ko` | ✅ | ✅ | ✅ | — | Registro cortés 해요체. |

## Idiomas Principales del Mundo

| Bandera | Idioma | Código | Google | LLM | Coached | Escritura | Notas |
|---------|--------|--------|:------:|:---:|:-------:|-----------|-------|
| 🇧🇩 | Bengalí | `bn` | ✅ | ✅ | ✅ | — | Preferencia de শুদ্ধ ভাষা. |
| 🇧🇬 | Búlgaro | `bg` | ✅ | ✅ | ✅ | — | |
| 🇨🇿 | Checo | `cs` | ✅ | ✅ | ✅ | — | Vykání (forma vy). |
| 🇩🇰 | Danés | `da` | ✅ | ✅ | ✅ | — | |
| 🇬🇷 | Griego | `el` | ✅ | ✅ | ✅ | — | Δημοτική moderna. |
| 🇮🇷 | Persa | `fa` | ✅ | ✅ | ✅ | — | RTL. |
| 🇫🇮 | Finlandés | `fi` | ✅ | ✅ | ✅ | — | Sin género gramatical. |
| 🇮🇱 | Hebreo | `he` | ✅ | ✅ | ✅ | — | RTL. |
| 🇮🇳 | Hindi | `hi` | ✅ | ✅ | ✅ | — | शुद्ध हिन्दी. Mínimos préstamos del inglés. |
| 🇭🇺 | Húngaro | `hu` | ✅ | ✅ | ✅ | — | Forma Ön. |
| 🇮🇩 | Indonesio | `id` | ✅ | ✅ | ✅ | — | |
| 🇲🇾 | Malayo | `ms` | ✅ | ✅ | ✅ | — | |
| 🇳🇱 | Holandés | `nl` | ✅ | ✅ | ✅ | — | Forma U. |
| 🇳🇴 | Noruego | `nb` | ✅ | ✅ | ✅ | — | Bokmål. |
| 🇵🇱 | Polaco | `pl` | ✅ | ✅ | ✅ | — | Forma Pan/Pani. |
| 🇵🇹 | Portugués (EU) | `pt-PT` | ✅ | ✅ | ✅ | — | Portugués europeo. |
| 🇷🇴 | Rumano | `ro` | ✅ | ✅ | ✅ | — | |
| 🇷🇺 | Ruso | `ru` | ✅ | ✅ | ✅ | — | Forma Вы. |
| 🇸🇰 | Eslovaco | `sk` | ✅ | ✅ | ✅ | — | Vykanie (forma vy). |
| 🇷🇸 | Serbio | `sr` | ✅ | ✅ | ✅ | 🔤 Latín→Cirílico | Convertidor de escritura determinista. |
| 🇸🇪 | Sueco | `sv` | ✅ | ✅ | ✅ | — | |
| 🇰🇪 | Suajili | `sw` | ✅ | ✅ | ✅ | — | |
| 🇹🇭 | Tailandés | `th` | ✅ | ✅ | ✅ | — | Partículas de cortesía ครับ/ค่ะ. |
| 🇹🇷 | Turco | `tr` | ✅ | ✅ | ✅ | — | Forma Siz. |
| 🇺🇦 | Ucraniano | `uk` | ✅ | ✅ | ✅ | — | Forma Ви. |
| 🇵🇰 | Urdu | `ur` | ✅ | ✅ | ✅ | — | RTL. Forma آپ. |
| 🇻🇳 | Vietnamita | `vi` | ✅ | ✅ | ✅ | — | |
| 🇹🇼 | Chino (Tradicional) | `zh-TW` | ✅ | ✅ | ✅ | — | 繁體中文. |
| 🇬🇪 | Georgiano | `ka` | ✅ | ✅ | — | — | ქართული. Familia Kartveliana. |
| 🇳🇬 | Yoruba | `yo` | ✅ | ✅ | — | — | Èdè Yorùbá. Tonal (3 tonos). |

## Variantes Regionales

| Bandera | Idioma | Código | Google | LLM | Coached | Escritura | Notas |
|---------|--------|--------|:------:|:---:|:-------:|-----------|-------|
| 🇲🇽 | Español Mexicano | `es-MX` | ✅ | ✅ | ✅ | — | Forma tú. Registro cálido. |
| 🇨🇦 | Francés Canadiense | `fr-CA` | ✅ | ✅ | ✅ | — | Modismos quebequenses. |

---

## Idiomas Indígenas y de Recursos Limitados

Estos idiomas no son compatibles con los servicios comerciales de traducción automática. champollion proporciona las herramientas para que las comunidades lingüísticas construyan sus propios métodos bajo los [principios comunitarios de soberanía de datos](/docs/network/community/low-resource-languages).

| | Idioma | Código | Google | LLM | Coached | Escritura | Estado |
|---|--------|--------|:------:|:---:|:-------:|-----------|--------|
| 🪶 | Cree de las Llanuras | `crk` | ❌ | ✅ | ✅ | 🔤 SRO→Silábica | 🚧 En desarrollo |
| 🌄 | Quechua | `qu` | ✅ | ✅ | — | — | Runasimi. Sufijos evidenciales. |

:::info[El cree de las llanuras está en desarrollo activo]
El registro, la infraestructura de instrucción, el convertidor de escritura y el entorno de evaluación para el cree de las llanuras son funcionales, pero el pipeline de traducción **aún no se ha lanzado**. Estamos trabajando con las comunidades lingüísticas bajo los [principios comunitarios de soberanía de datos](/docs/network/community/low-resource-languages) para garantizar la calidad antes del lanzamiento. Consulte [Apoyar a un idioma de bajos recursos](/docs/network/community/low-resource-languages) para conocer la historia completa — y cómo puede contribuir.
:::

:::tip[Agregar más idiomas de recursos limitados]
El sistema de complementos de métodos de champollion está diseñado para esto. Una comunidad de lenguas puede crear un método de traducción personalizado, alojarlo bajo su propio control, y servirlo a través del [método API](/docs/guides/serving-a-method). El [Tablero de métodos](/leaderboard) rastrea puntuaciones para cualquier par de idiomas — cree un método, ejecute el arnés, y reclame la puntuación más alta.
:::

---

## Idiomas Construidos

Los conlangs son compatibles a través de registros LLM y convertidores de escritura opcionales. Utilizan la misma infraestructura que los idiomas reales — la puerta de calidad, el sistema de coaching y la tubería de conversión de escritura funcionan de forma idéntica.

| | Idioma | Código | Google | LLM | Escritura | Notas |
|---|--------|--------|:------:|:---:|-----------|-------|
| 🖖 | Klingon | `tlh` | ❌ | ✅ | 🔤 Romanización→pIqaD | Se requiere fuente PUA. Vocabulario de Marc Okrand. |
| 🧝 | Sindarin (Élfico de Tolkien) | `x-elvish-s` | ❌ | ✅ | 🔤 Latín→Tengwar | Se requiere fuente PUA CSUR. |
| 🏴‍☠️ | Inglés Pirata | `x-pirate` | ❌ | ✅ | — | Solo registro. Metáforas náuticas. |
| 🦸 | Kryptoniano | `x-kryptonian` | ❌ | ✅ | 🔤 Latín→Kryptoniano | Se requiere fuente PUA. |
| 🎭 | Inglés Shakespeariano | `x-shakespeare` | ❌ | ✅ | — | Solo registro. Formas thee/thou, -eth/-est. |
| 🐸 | Habla de Yoda | `x-yoda` | ❌ | ✅ | — | Solo registro. Orden de palabras OSV. |

Consulte [Conlangs, Escrituras y Ortografía](/docs/guides/conlangs-scripts-orthography) para requisitos de fuentes PUA, limitaciones de Unicode y cómo agregar la suya.

---

## Presets de Idioma

El asistente `init` admite nombres de presets para configuración rápida. Puede mezclar presets con códigos individuales.

| Preset | Se Expande A |
|--------|-------------|
| `european` | fr, de, es, it, pt, nl |
| `asian` | ja, zh, ko |
| `global` | fr, es, de, ja, zh, ko, pt, ar |
| `nordic` | da, fi, nb, sv |

```bash
# Mix presets with individual codes
champollion init
# → Target languages: european, ja
# → Resolves to: fr, de, es, it, pt, nl, ja
```

---

## Agregar Cualquier Idioma

champollion puede traducir a **cualquier idioma que su LLM conozca** — la tabla anterior solo lista idiomas con presets de registro integrados. Para agregar un idioma no listado, incluya su código BCP-47 en su configuración:

```json
{
  "languages": {
    "sw": {},
    "am": {
      "register": "Formal Amharic. Professional register with Geʽez script."
    }
  }
}
```

El LLM traducirá usando su conocimiento de entrenamiento del idioma. Configurar un `register` le da control sobre el tono, formalidad y convenciones ortográficas. Consulte [Configuración](/docs/getting-started/configuration) para obtener detalles.

---

## Tarjetas de Idioma {#language-cards}

Cada idioma integrado tiene una **Tarjeta de Idioma** — un archivo JSON unificado en `shared/language-cards/` que contiene todos los metadatos: registros, formalidad, soporte de métodos, reglas tipográficas, clasificación genealógica, desafíos lingüísticos y recursos de PNL.

### Arquitectura de Tarjeta Unificada

Cada tarjeta se carga con entusiasmo en la importación. No hay un nivel de referencia separado — todos los datos viven en un único archivo por idioma. Las tarjetas se enriquecen de fuentes autorizadas:

| Fuente | Datos |
|--------|-------|
| [Glottolog](https://glottolog.org) | Clasificación de familia, cadena de ancestros, Glottocode |
| [WALS](https://wals.info) | Clasificación de género, características tipológicas |
| [CLDR](https://cldr.unicode.org) | Escritura, dirección, reglas plurales, tipografía |
| [ISO 15924](https://unicode.org/iso15924/) | Códigos de escritura |

### Campos Clave de la Tarjeta

| Campo | Qué Contiene |
|-------|-------------|
| **`nativeName`** | Endónimo — el nombre del idioma para sí mismo, en su propia escritura (p. ej., ქართული, Runasimi) |
| **`classification`** | Ancla genealógica: familia, género, cadena de ancestros completa de Glottolog |
| **`contactInfluences`** | Historial de contacto universal — capas de préstamo, superstratos, substratos |
| **Sistema de formalidad** | Distinción T-V, niveles de habla, keigo, partículas, etc. |
| **Presets de registro** | Presets de prompts LLM nombrados específicos del carácter del idioma |
| **Soporte de método** | Qué APIs de traducción admiten este idioma |
| **Guía de género** | Reglas de género gramatical y consejos de escritura inclusiva |
| **Escritura/dirección** | Código de escritura ISO 15924 y RTL/LTR |
| **Reglas** | Tipografía (comillas, espaciado), capitalización, categorías plurales |
| **`glottocode`** | Identificador canónico de Glottolog para referencias cruzadas |
| **`dataSources`** | Rastreo de procedencia (p. ej., `["glottolog-5.3", "cldr-48"]`) |

### Andamiaje de una Nueva Tarjeta de Idioma

Use el generador para andamiar una tarjeta a partir de fuentes de datos autorizadas (IANA, CLDR, Glottolog):

```bash
# Preview what would be generated
node scripts/generate-language-card.mjs sw --dry-run

# Generate a unified card
node scripts/generate-language-card.mjs sw
```

El generador rellena automáticamente metadatos (códigos, escritura, dirección, plurales, comillas, soporte de métodos, clasificación) y marca campos de juicio lingüístico como TODO para curación humana.

### Uso de Claves de Preset

En lugar de escribir texto de registro completo, puede usar un nombre de clave de preset:

```json
{
  "languages": {
    "fr": "casual-tu",
    "ko": "formal-hapsyo",
    "ja": "polite"
  }
}
```

Champollion resuelve la clave al prompt de registro completo. Ejecute `npx champollion init` para ver presets disponibles para cada idioma.

### Presets de Ejemplo

| Idioma | Presets | Predeterminado |
|--------|---------|---------------|
| Francés | `formal-vous`, `casual-tu` | `formal-vous` |
| Coreano | `polite-haeyo`, `formal-hapsyo`, `casual-hae` | `polite-haeyo` |
| Japonés | `polite`, `formal-keigo`, `casual` | `polite` |
| Alemán | `formal-Sie`, `casual-du` | `formal-Sie` |
| Tailandés | `neutral-professional`, `polite-male`, `polite-female` | `neutral-professional` |
| Español | `neutral-professional`, `formal-usted`, `casual-tuteo` | `neutral-professional` |

Consulte [Contribuir una Tarjeta de Idioma](https://github.com/gamedaysuits/champollion) para la especificación completa, incluyendo validación de campos y lista de verificación de PR.

---

## Consulte también

- [Configuración](/docs/getting-started/configuration) — referencia de configuración completa incluyendo configuración de idioma
- [Métodos de Traducción](/docs/guides/translation-methods) — cómo funciona cada método
- [Convertidores de Escritura](/docs/concepts/script-converters) — tubería de conversión de escritura determinista
- [Conlangs, Escrituras y Ortografía](/docs/guides/conlangs-scripts-orthography) — fuentes PUA, Unicode, agregar conlangs
- [Apoyar un Idioma de Recursos Limitados](/docs/network/community/low-resource-languages) — construir métodos para idiomas desatendidos

