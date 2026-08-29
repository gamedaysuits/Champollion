---
sidebar_position: 7
title: "Comparación"
---

# Cómo se Compara Champollion

champollion ocupa una categoría diferente a la mayoría de las herramientas de localización. Aquí hay una comparación honesta.

## El Panorama

La mayoría de las herramientas de localización se dividen en una de tres categorías:

| Categoría | Ejemplos | Modelo |
|----------|----------|-------|
| **Plataformas TMS en la Nube** | Crowdin, Phrase, Locize, Tolgee | Panel SaaS + traductores humanos + suscripción mensual |
| **Herramientas de Extracción de Claves** | i18next-scanner, FormatJS CLI | Escanear código fuente en busca de llamadas a funciones de traducción |
| **Motores de Traducción CLI** | **champollion** | Ejecutar en su proyecto, traducir archivos directamente, sin cuenta en la nube |

Champollion es un **motor de traducción CLI** — traduce sus archivos de configuración regional directamente usando backends configurables (LLMs, Google Translate, plugins personalizados). Sin panel en la nube, sin flujo de trabajo de traductores humanos, sin cuota mensual.

---

## Comparación de Características

| Característica | champollion | Crowdin | Phrase | Locize |
|---------|:------------:|:-------:|:------:|:------:|
| **Se ejecuta localmente (sin cuenta en la nube)** | ✅ | ❌ | ❌ | ❌ |
| **Dependencias mínimas** | ✅ | ❌ | ❌ | ❌ |
| **Configuración de método por par** | ✅ | ❌ | ❌ | ❌ |
| **Registros de idioma personalizados** | ✅ | ❌ | ❌ | ❌ |
| **Consciente del contenido (protege bloques de código)** | ✅ | ❌ | ❌ | ❌ |
| **Conversión de lenguas construidas y sistemas de escritura** | ✅ | ❌ | ❌ | ❌ |
| **Arquitectura de plugins** | ✅ | ❌ | ❌ | ❌ |
| **Traducción de Markdown / contenido** | ✅ | ✅ | ✅ | ❌ |
| **Memoria de traducción** | ✅ | ✅ | ✅ | ✅ |
| **Exportación/importación de XLIFF** | ✅ | ✅ | ✅ | ❌ |
| **Validación de plurales ICU** | ✅ | ✅ | ✅ | ❌ |
| **Control terminológico** | ✅ | ✅ | ✅ | ❌ |
| **Flujo de trabajo para traductores humanos** | Basado en XLIFF | ✅ | ✅ | ✅ |
| **Edición en contexto (visual)** | ❌ | ✅ | ✅ | ✅ |
| **Colaboración en equipo** | ❌ | ✅ | ✅ | ✅ |
| **Soporte de formatos de archivo** | JSON, TOML, YAML, MD, XLIFF | 50+ | 40+ | JSON |
| **Precios** | Gratis para uso no comercial (paga su propio LLM) | Desde $0/mes | Desde $0/mes | Desde $0/mes |

---

## Cuándo Usar Champollion

**Champollion es una buena opción cuando:**

- Desea traducción automática integrada en su pipeline de compilación — no un flujo de trabajo separado
- Necesita control de método por idioma (LLM para algunos, Google Translate para otros, plugins personalizados para el resto)
- Está traduciendo a idiomas sin cobertura de API (indígenas, en peligro de extinción, construidos)
- Desea salida de script determinista (Cree Syllabics, Klingon pIqaD, Tengwar)
- Desea cero bloqueo de proveedor y cero dependencias en la nube
- Es un desarrollador individual o un equipo pequeño que no necesita un panel TMS completo
- Desea entrega basada en XLIFF a traductores profesionales sin una suscripción en la nube

**Un TMS en la nube es una mejor opción cuando:**

- Tiene traductores humanos profesionales revisando cada cadena (el flujo de trabajo XLIFF de champollion es más simple que un TMS completo)
- Necesita memoria de traducción y gestión de glosario entre proyectos
- Necesita edición visual en contexto (vista previa de traducciones dentro de su interfaz de usuario)
- Tiene un equipo grande con necesidades de control de acceso basado en roles
- Necesita compatibilidad con 50+ formatos de archivo

---

## Lo Que Champollion Hace Que Nadie Más Hace

### 1. Registros Personalizados

Cada par de idiomas obtiene instrucciones de tono culturalmente apropiadas para el LLM:

```json
{
  "de": {
    "register": "Standard professional register. Use Sie-form for formal address."
  },
  "tl": {
    "register": "Educated Manila Taglish. Use Tagalog as the primary language but keep technical terms in English."
  },
  "tlh": {
    "register": "Warrior's honor. OVS grammar. Use Marc Okrand vocabulary."
  }
}
```

Ninguna otra herramienta incluye 47 registros de idioma preconfigurados, ni le permite definir personalizados por proyecto.

### 2. Convertidores de Script Deterministas

Champollion incluye cinco convertidores de script integrados que se ejecutan como hooks posteriores a la traducción — sin necesidad de LLM:

| Configuración Regional | Conversión | Ejemplo |
|--------|-----------|---------|
| `crk` | SRO → Cree Syllabics | `nêhiyawêwin` → `ᓀᐦᐃᔭᐍᐏᐣ` |
| `sr` | Latín → Cirílico | `Beograd` → `Београд` |
| `tlh` | Romanización → pIqaD | `tlhIngan Hol` → (glifos pIqaD) |
| `x-elvish-s` | Latín → Tengwar | Sindarin → Tengwar (Modo de Beleriand) |
| `x-kryptonian` | Latín → Kryptoniano | Sustitución de cifra (requiere fuente) |

Estos son convertidores de tabla de búsqueda pura — deterministas, auditables, cero riesgo de alucinación de LLM.

### 3. Protección Consciente del Contenido

Al traducir Markdown o contenido enriquecido, Champollion protege:

- Bloques de código delimitados (` ``` `)
- Código en línea (`` ` ` ``)
- Shortcodes de Hugo (`{{</* */>}}`, `{{%/* */%}}`)
- Variables de interpolación (`{{ .Count }}`, `{name}`, `{{t('key')}}`)
- Bloques HTML sin procesar

Estos se reemplazan con tokens centinela Unicode antes de la traducción y se restauran después. El LLM nunca ve su código, sus shortcodes o sus variables.

### 4. Plugins de Método Entrenado

Para idiomas sin cobertura de API, puede crear un método de traducción entrenado:

1. Escriba datos de entrenamiento lingüístico (reglas gramaticales, vocabulario, ejemplos)
2. Empaquételo como un plugin
3. Evalúelo contra traducciones de referencia usando el [arnés de evaluación](https://github.com/gamedaysuits/Champollion)
4. Instálelo en su proyecto con `champollion plugin install`

Así es como champollion maneja Plains Cree — y cómo puede manejar cualquier idioma, incluidos los que aún no existen.

---

## La Conclusión

Champollion no es un reemplazo para Crowdin. Es una herramienta diferente para un flujo de trabajo diferente. Si necesita traductores humanos, use un TMS. Si necesita una CLI que traduzca sus archivos con un comando y le dé control por idioma sobre métodos, modelos y registros — use champollion.
