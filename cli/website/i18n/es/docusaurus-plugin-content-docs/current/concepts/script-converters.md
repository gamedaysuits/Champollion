---
sidebar_position: 6
title: "Convertidores de Escritura"
---

# Convertidores de Escritura

Los convertidores de escritura son ganchos de post-traducción determinísticos y sin LLM que convierten texto de un sistema de escritura a otro. Permiten un flujo de trabajo "traducir una vez, renderizar en múltiples escrituras" — usted traduce a una escritura funcional (típicamente latina), luego convierte a la escritura de visualización automáticamente.

## ¿Por qué Convertidores de Escritura?

Algunos idiomas utilizan múltiples escrituras para el mismo idioma hablado:

- **Plains Cree**: SRO (Latin) para edición → Syllabics (ᓀᐦᐃᔭᐍᐏᐣ) para visualización
- **Serbian**: Latin para uso internacional → Cyrillic para uso doméstico
- **Klingon**: Romanización para escritura → pIqaD (  ) para visualización

Traducir directamente a escrituras no latinas crea problemas: los LLM alucinen caracteres, los archivos JSON se vuelven difíciles de controlar versiones, y las herramientas de diff no pueden comparar cambios. Los convertidores de escritura resuelven esto manteniendo traducciones en una escritura amigable con el control de versiones y convirtiendo determinísticamente en el momento de la sincronización.

## Convertidores Disponibles

Champollion incluye cinco convertidores de escritura integrados:

| Locale | De | A | Tipo | ¿Se requiere fuente? |
|--------|------|----|------|----------------|
| `crk` | SRO (Standard Roman Orthography) | Cree Syllabics | Determinístico | No — Unicode nativo |
| `sr` | Latin | Cyrillic | Determinístico | No — Unicode nativo |
| `tlh` | Romanización | pIqaD | Determinístico | Sí — PUA U+F8D0–F8FF |
| `x-elvish-s` | Latin | Tengwar (Mode of Beleriand) | Determinístico | Sí — PUA U+E000–E07F |
| `x-kryptonian` | Latin | Kryptonian | Cifrado basado en fuente | Sí — PUA U+E100–E119 |

### Determinístico vs. Basado en Fuente

- **Convertidores determinísticos** (Cree, Serbian, Klingon, Tengwar) realizan mapeo real de carácter a carácter utilizando reglas lingüísticas. La salida contiene caracteres Unicode reales.
- **Convertidores basados en fuente** (Kryptonian) son cifrados de sustitución 1:1 donde la salida son caracteres Unicode PUA que solo se renderizan correctamente con una fuente específica cargada.

## Cómo Funcionan

Los convertidores de escritura se ejecutan **después** de la traducción como un paso de post-procesamiento. El pipeline es:

```
Source (English) → LLM Translation → Working Script → Script Converter → Display Script
```

Por ejemplo, para el cree de las llanuras (Plains Cree):
```
"Welcome" → LLM → <its translation, in SRO> → Converter → <the same text, in Syllabics>
```

El convertidor mapea grafías, no palabras: las sílabas `pâ tê ki` (un ejemplo ortográfico, no una palabra) se convierten en `ᐹ ᑌ ᑭ`.

### Coincidencia Greedy de Izquierda a Derecha

Todos los convertidores utilizan el mismo algoritmo: en cada posición de carácter, intente primero la coincidencia más larga posible, luego coincidencias progresivamente más cortas. Los caracteres que no coinciden con ningún patrón (espacios, puntuación, números) pasan sin cambios.

Esto maneja correctamente dígrafos y trígrafos:
- Klingon: `tlh` → carácter pIqaD único (no `t` + `l` + `h`)
- Serbian: `nj` → `њ` (no `н` + `ј`)
- Cree: `twê` → sílaba única (no `t` + `w` + `ê`)

## Uso de Convertidores de Escritura

La conversión es una **decisión de configuración, nunca automática** (desde la versión 0.3.0; las versiones anteriores realizaban la conversión de forma incondicional, lo que generaba texto en PUA imposible de renderizar en proyectos cuyas fuentes esperaban transliteración latina):

- **crk y sr tienen dos ortografías reales** (SRO/silábico, latino/cirílico). No hay un valor predeterminado: `champollion init` pregunta cuál escribir, y `sync` se niega a ejecutarse hasta que la configuración lo especifique. Champollion no elige el sistema de escritura de una comunidad.
- **tlh, x-elvish-s y x-kryptonian usan la romanización de forma predeterminada**; sus escrituras de visualización pertenecen al Área de Uso Privado (PUA), imposible de renderizar sin una fuente especial. Debe habilitarlas explícitamente.

```json title="champollion.config.json"
{
  "languages": {
    "crk": { "script": "Cans" },
    "tlh": { "script": "Piqd" }
  }
}
```

Cuando champollion sincroniza `en:crk` con `"script": "Cans"`, las traducciones se generan en SRO (la escritura de trabajo que valida el gate) y luego se convierten al silábico antes de escribirse en `crk.json`. Con `"script": "Latn"` —o para tlh sin ningún `script:` en absoluto— la escritura de trabajo es el resultado final y no se convierte nada.

Las letras que el convertidor no puede mapear (el klingon no tiene `d`, `c`, `f`, `g`, `i`, `k`, `s`, `x`, `z`, por lo que "GitHub" no se puede convertir por completo) mantienen el **valor completo** en la escritura de trabajo en lugar de mezclar escrituras, mostrando una advertencia que nombra las letras. Declare sus propias reglas de transliteración con [`scriptFallback`](/docs/getting-started/configuration#script-fallback).

Para deshacer la conversión que ocurrió cuando era incondicional, ejecute [`champollion repair-script`](/docs/getting-started/configuration#repair-script); `champollion integrity` falla si encuentra caracteres PUA donde la conversión está desactivada.

### Verificación del Estado del Convertidor

```bash
npx champollion status
```

La salida de estado muestra la decisión de escritura resuelta para cada par: qué se escribirá y si hay un convertidor disponible pero no habilitado.

## Requisitos de Fuentes Web

Tres convertidores generan caracteres Unicode de Área de Uso Privado (PUA) que requieren fuentes web personalizadas:

### Klingon (pIqaD)

Instale una fuente pIqaD compatible con CSUR (por ejemplo, "pIqaD qolqoS" o "Klingon pIqaD HaSta"):

```css
@font-face {
  font-family: 'pIqaD';
  src: url('/fonts/pIqaD.woff2') format('woff2');
  unicode-range: U+F8D0-F8FF;
}

:lang(tlh) {
  font-family: 'pIqaD', sans-serif;
}
```

### Tengwar (Sindarin)

Instale una fuente Tengwar compatible con CSUR (por ejemplo, "Tengwar Formal CSUR", "Tengwar Annatar"):

```css
@font-face {
  font-family: 'Tengwar';
  src: url('/fonts/tengwar-formal-csur.woff2') format('woff2');
  unicode-range: U+E000-E07F;
}

:lang(x-elvish-s) {
  font-family: 'Tengwar', serif;
}
```

### Kryptonian

Instale una fuente Kryptonian asignada a puntos de código PUA U+E100–E119:

```css
@font-face {
  font-family: 'Kryptonian';
  src: url('/fonts/kryptonian.woff2') format('woff2');
  unicode-range: U+E100-E119;
}

:lang(x-kryptonian) {
  font-family: 'Kryptonian', sans-serif;
}
```

:::tip[Enfoque alternativo para Kryptonian]
Dado que Kryptonian es un cifrado puro de A-Z, puede omitir el convertidor de script por completo y aplicar la fuente al texto latino mediante CSS. Esto suele ser más simple para implementaciones web: simplemente sirva la fuente Kryptonian y establezca `font-family` en los elementos relevantes.
:::

## Agregar un Convertidor Personalizado

Para agregar un convertidor para un nuevo idioma, edite `lib/scripts.js`:

1. **Cree el mapa de conversión**: una matriz ordenada de pares `[from, to]`, con las secuencias más largas primero
2. **Cree la función del convertidor**: un analizador voraz (greedy) de izquierda a derecha (use `latinToCyrillicSr` como plantilla). Cuando exista un convertidor mantenido por la comunidad, utilícelo en lugar de una tabla propia: el cree de las llanuras delega en `cree-sro-syllabics`, el convertidor que utiliza itwêwina de ALTLab
3. **Regístrelo** en el objeto `SCRIPT_CONVERTERS` utilizando el código de locale como clave
4. **Agregue el campo `script`** a la entrada de registro del idioma en `registers.js`

```javascript
// Example: adding a converter for Cherokee (chr)
const LATIN_TO_CHEROKEE_MAP = [
  ['ga', 'Ꭶ'], ['ka', 'Ꭷ'], ['ge', 'Ꭸ'], // ...
];

function latinToCherokee(text) {
  // Same greedy left-to-right pattern as other converters
}

SCRIPT_CONVERTERS['chr'] = {
  from: 'Latin',
  to: 'Cherokee Syllabary',
  type: 'deterministic',
  converter: latinToCherokee,
};
```

---

## Consulte también

- [Conlangs, Scripts & Orthography](/docs/guides/conlangs-scripts-orthography) — fuentes PUA, Unicode, agregar nuevos convertidores
- [Quality Gate](/docs/concepts/quality-gate) — validación que se ejecuta antes de la conversión de escritura
- [Supported Languages](/docs/reference/supported-languages) — qué idiomas tienen convertidores de escritura
- [Support a Low-Resource Language](/docs/network/community/low-resource-languages) — SRO→Syllabics en contexto
- [Cookbook: FST-Gated Pipeline](/docs/network/tutorials/fst-gated-pipeline) — conversión de escritura en un pipeline de múltiples etapas
