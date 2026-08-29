---
sidebar_position: 3
title: "Lenguas construidas, Escrituras y Ortografía"
---

# Lenguajes Construidos, Escrituras y Ortografía

champollion tiene soporte de primera clase para lenguajes construidos mediante registros LLM y convertidores de escritura determinísticos. Esta guía cubre cómo funciona el soporte para conlangs, qué fuentes necesita, y cómo agregar las suyas.

:::tip[Por qué los conlangs importan]
Los conlangs no son solo una novedad — ejercitan la misma infraestructura exacta utilizada para idiomas reales desatendidos. La puerta de calidad, el sistema de coaching y la canalización de conversión de scripts funcionan de manera idéntica para Klingon y Plains Cree. Si su canalización de conlang funciona, su canalización de idioma de bajo recurso también lo hará.
:::

---

## Lenguajes Construidos Soportados

| Lenguaje | Código | Convertidor de Escritura | Fuente Requerida |
|----------|--------|:------------------------:|:----------------:|
| Klingon | `tlh` | ✅ Romanización → pIqaD | Fuente PUA (p. ej., pIqaD qolqoS) |
| Sindarin (Élfico Tolkien) | `x-elvish-s` | ✅ Latin → Tengwar | Fuente PUA CSUR |
| Kryptoniano | `x-kryptonian` | ✅ Latin → Kryptoniano | Fuente PUA |
| Inglés Pirata | `x-pirate` | ❌ solo registro | Ninguna |
| Inglés Shakespeariano | `x-shakespeare` | ❌ solo registro | Ninguna |
| Habla Yoda | `x-yoda` | ❌ solo registro | Ninguna |

Los códigos de conlang utilizan el prefijo `x-` según la convención de uso privado BCP-47, excepto Klingon (`tlh`) que tiene un código [ISO 639-3](https://iso639-3.sil.org/code/tlh) asignado por SIL International.

---

## Unicode, PUA y Requisitos de Fuentes

### El Área de Uso Privado

Klingon (pIqaD), Sindarin (Tengwar) y Kryptoniano utilizan caracteres **Área de Uso Privado (PUA)** de Unicode. PUA es el rango U+E000–U+F8FF — estos puntos de código **no tienen asignación estándar**. El [Registro Unicode de ConScript (CSUR)](https://www.evertype.com/standards/csur/) mantiene asignaciones acordadas por la comunidad para escrituras ficticias, pero estas no son parte del estándar Unicode.

Lo que esto significa en la práctica:

- El texto PUA se renderiza como **cajas vacías** (□□□) sin la fuente correcta cargada
- Diferentes fuentes pueden asignar glifos diferentes a los mismos puntos de código PUA
- champollion NO incluye fuentes PUA — debe cargarlas usted mismo
- Las fuentes del sistema nunca renderizarán estos caracteres

### Rangos PUA por Escritura

| Escritura | Rango PUA | Referencia CSUR |
|-----------|-----------|-----------------|
| Klingon (pIqaD) | U+F8D0–U+F8FF | [CSUR Klingon](https://www.evertype.com/standards/csur/klingon.html) |
| Tengwar (Élfico) | U+E000–U+E07F | [CSUR Tengwar](https://www.evertype.com/standards/csur/tengwar.html) |
| Kryptoniano | Varía según fuente | Sin estándar CSUR |

### Cargando Fuentes Web PUA

champollion incluye un comando integrado para descargar y gestionar fuentes web PUA:

```bash
# See which fonts are needed for your configured languages
champollion fonts list

# Download all needed fonts (auto-detects project type for output directory)
champollion fonts install

# Also generate a CSS snippet with @font-face declarations
champollion fonts install --css
```

El comando `fonts install` descarga desde repositorios verificados de código abierto:

| Fuente | Escritura | Licencia | Fuente |
|--------|-----------|----------|--------|
| pIqaD qolqoS | Klingon | SIL Open Font License 1.1 | [GitHub](https://github.com/dadap/pIqaD-fonts) |
| FreeMonoTengwar | Tengwar | GNU GPL v3 (con excepción de fuente) | [SourceForge](https://sourceforge.net/projects/freetengwar/) |
| *(proporcionada por usuario)* | Kryptoniano | Varía | Sin fuente PUA de código abierto disponible |

El directorio de salida se detecta automáticamente desde la estructura de su proyecto (Docusaurus → `static/fonts/`, Hugo → `static/fonts/`, predeterminado → `public/fonts/`). Anule con `--dir`.

Si prefiere gestionar fuentes manualmente, agregue reglas `@font-face` en su CSS:

```css
@font-face {
  font-family: 'pIqaD';
  src: url('/fonts/pIqaDqolqoS.ttf') format('truetype');
  font-display: swap;
  unicode-range: U+F8D0-F8FF;
}

/* Apply to Klingon text elements */
[lang="tlh"], [data-script="piqad"] {
  font-family: 'pIqaD', sans-serif;
}
```

:::warning[La compatibilidad con Unicode NO está garantizada]
El Unicode Consortium ha [rechazado explícitamente](https://www.unicode.org/faq/private_use.html) codificar scripts ficticios en el estándar. Las asignaciones de PUA se mantienen por la comunidad y pueden entrar en conflicto entre implementaciones de fuentes. Siempre especifique la fuente exacta que su proyecto utiliza, y pruebe la representación en navegadores.
:::

---

## Convertidores de Escritura

### Cómo Funcionan

la conversión de escritura de champollion es un **hook posterior a la traducción, aplicado solo cuando la configuración lo solicita**:

1. El LLM traduce el texto a una **escritura de trabajo** (generalmente latino o SRO)
2. El [filtro de calidad](/docs/concepts/quality-gate) valida el resultado
3. Si la configuración `script:` del par selecciona la escritura de visualización, el convertidor determinista transforma el texto validado; los valores con letras que el convertidor no puede mapear permanecen intactos en la escritura de trabajo, con una advertencia por clave
4. El resultado se escribe en el disco

Este enfoque de dos pasos funciona porque los LLM producen mejor salida cuando trabajan en escrituras basadas en Latin. El convertidor determinístico garantiza salida de escritura correcta sin depender del conocimiento de escritura del modelo (a menudo poco confiable).

Que el paso 3 se ejecute o no es una decisión por proyecto; consulte [Script Conversion](/docs/getting-started/configuration#script-conversion). Las escrituras de visualización PUA (pIqaD, Tengwar, Kryptonian) están desactivadas de forma predeterminada porque no muestran nada al renderizarse sin una fuente diseñada para ese propósito; crk y sr no tienen ningún valor predeterminado, porque ambas ortografías son reales y la elección corresponde al proyecto.

### Los Cinco Convertidores

champollion se envía con cinco convertidores de escritura integrados:

#### Plains Cree: SRO → Silábicos (`crk`)

Ortografía Romana Estándar a Silábicos Aborígenes Canadienses.

```
Input:  "tawâw"
Output: "ᑕᐚᐤ"
```

Las vocales largas utilizan macron/circunflejo: ê, î, ô, â. El convertidor maneja todos los diacríticos SRO y los asigna a los caracteres silábicos correctos. Vea [Soporte para un Lenguaje de Bajo Recurso](/docs/network/community/low-resource-languages) para la tubería completa de Cree.

#### Serbio: Latin → Cirílico (`sr`)

Conversión determinística de Latin a Cirílico para Serbio.

```
Input:  "zdravo"
Output: "здраво"
```

Esto maneja la asignación completa del alfabeto serbio incluyendo dígrafos (lj → љ, nj → њ, dž → џ).

#### Klingon: Romanización → pIqaD (`tlh`)

Sistema de romanización de Marc Okrand a caracteres PUA pIqaD.

```
Input:  "Qapla'"    (romanized Klingon)
Output: [pIqaD PUA] (requires pIqaD font to render)
```

#### Sindarin: Latin → Tengwar (`x-elvish-s`)

Asignación de modo Sindarin Tengwar de Tolkien.

```
Input:  "elen síla"  (Latin Sindarin)
Output: [Tengwar PUA] (requires Tengwar font to render)
```

#### Kryptoniano: Latin → Kryptoniano (`x-kryptonian`)

Asignación de escritura Kryptoniana de léxico de fans.

```
Input:  "Kal-El"
Output: [Kryptonian PUA] (requires Kryptonian font to render)
```

### Activando un Convertidor

Establezca el campo `script` con el código ISO 15924 de la ortografía que desea que se escriba:

```json
{
  "languages": {
    "sr": { "script": "Cyrl" },
    "crk": { "script": "Cans" },
    "tlh": { "script": "Piqd" }
  }
}
```

Nada se convierte sin esto. Para `crk` y `sr` el campo es **obligatorio**; ambas ortografías son reales y `sync` se niega a elegir una por usted. Para las configuraciones regionales PUA, es una opción de inclusión (opt-in) sobre la romanización predeterminada. Consulte [Script Conversion](/docs/getting-started/configuration#script-conversion).

---

## Lenguajes Multi-Escritura

Algunos lenguajes reales utilizan múltiples escrituras activas:

| Idioma | Escrituras | Enfoque de champollion |
|----------|---------|-----------------|
| Serbio | Latino + Cirílico | Una configuración regional, elección explícita: `"script": "Cyrl"` convierte, `"script": "Latn"` mantiene el latino |
| Cree de las llanuras | SRO (Latino) + Silábico | Una configuración regional, elección explícita: `"script": "Cans"` o `"script": "Latn"` |
| Chino | Simplificado + Tradicional | Códigos de configuración regional separados (`zh` vs `zh-TW`) con registros distintos |

Para los idiomas donde ambas escrituras sirven a la misma audiencia (serbio, cree de las llanuras), una configuración regional más una elección explícita de `script` mantiene un único flujo de traducción. Para los idiomas donde las escrituras sirven a diferentes audiencias (chino simplificado para China continental, tradicional para Taiwán/HK), use códigos de configuración regional separados.

---

## Notas de Ortografía

Los registros no son solo tono — llevan **instrucciones ortográficas** que dirigen el LLM hacia convenciones de escritura correctas.

### Formas de Dirección Formal

Los registros integrados de champollion incluyen la dirección formal culturalmente apropiada para cada lenguaje:

| Lenguaje | Forma Formal | Instrucción de Registro |
|----------|------------|------------------------|
| Alemán | Sie | `Use Sie-form for formal address` |
| Francés | vous | `Use vous-form` |
| Ruso | вы | `Professional register with вы-form` |
| Turco | siz | `Professional register with siz-form` |
| Coreano | 합쇼체 | `Formal Korean (합쇼체)` |
| Japonés | です/ます | `Polite professional register (です/ます form)` |
| Polaco | Pan/Pani | `Professional register with Pan/Pani form` |

### Escritura Inclusiva de Género

Cada tarjeta de lenguaje tiene un campo `gender.inclusiveGuidance` con consejos específicos del lenguaje. Esto se inyecta en el indicador de traducción LLM separadamente del preajuste de registro, por lo que se aplica consistentemente independientemente de qué preajuste de formalidad elija el usuario:

- **Francés**: Écriture inclusive con notación de interpunto (p. ej., "Connecté·e")
- **Alemán**: Notación de dos puntos (p. ej., "Benutzer:innen")
- **Español**: Reestructuración neutral de género preferida; notación de barra (p. ej., "usuario/a") como alternativa

Para lenguajes sin orientación específica en su tarjeta (p. ej., Coreano, conlangs), el sistema recurre a una regla genérica: *"preferir formas neutras de género u la opción más inclusiva disponible."*

### Requisitos de Escritura RTL

Los registros de Árabe, Hebreo, Persa y Urdu todos notan requisitos de derecha a izquierda: `Ensure text reads naturally in RTL layout contexts.`

### Anulando Cualquier Registro

Cada registro es un valor de configuración — anúlelo para que coincida con la voz de su proyecto:

```json
{
  "languages": {
    "fr": {
      "register": "Casual French. Use tu-form. Conversational blog tone. Gender-neutral when possible."
    },
    "de": {
      "register": "Informal German. Use du-form. Tech startup voice."
    }
  }
}
```

Vea [Configuración](/docs/getting-started/configuration) para la referencia de configuración completa.

---

## Agregando un Nuevo Conlang

### Paso a paso

1. **Elija un código de uso privado BCP-47**: Use el prefijo `x-` (p. ej., `x-dothraki`, `x-valyrian`).

2. **Agregue a su configuración**:

```json
{
  "languages": {
    "x-dothraki": {
      "register": "Dothraki language. Use David J. Peterson's vocabulary from the Living Language Dothraki textbook. Harsh, direct tone. No articles, no verb 'to be'."
    }
  }
}
```

3. **(Opcional) Agregue un convertidor de escritura**: Si su conlang utiliza una escritura de visualización no-Latin, agregue un convertidor en `lib/scripts.js` y regístrelo en `SCRIPT_CONVERTERS`.

4. **Pruebe**: Ejecute `champollion sync --dry` para previsualizar traducciones sin escribir archivos.

5. **Verifique la puerta de calidad**: La [puerta de calidad](/docs/concepts/quality-gate) puede necesitar ajuste para su conlang — particularmente la verificación `requireNonLatin` si su conlang utiliza caracteres PUA.

:::note[La calidad del conlang depende del conocimiento del LLM]
El LLM solo puede traducir a un conlang que haya visto en datos de entrenamiento. Los conlangs bien documentados (Klingon, Sindarin, Dothraki) funcionan bien. Los conlangs oscuros o recién inventados pueden producir resultados inconsistentes. Utilice [datos de coaching](/docs/concepts/coaching-data) para mejorar la calidad.
:::

---

## Consulte también

- [Lenguajes Soportados](/docs/reference/supported-languages) — tabla de lenguajes completa con disponibilidad de método
- [Convertidores de Escritura](/docs/concepts/script-converters) — detalles técnicos de la tubería de conversión
- [Métodos de Traducción](/docs/guides/translation-methods) — cómo funciona cada método de traducción
- [Configuración](/docs/getting-started/configuration) — referencia de configuración incluyendo configuración de lenguaje y registro
- [Soporte para un Lenguaje de Bajo Recurso](/docs/network/community/low-resource-languages) — la misma infraestructura aplicada a lenguajes reales desatendidos
