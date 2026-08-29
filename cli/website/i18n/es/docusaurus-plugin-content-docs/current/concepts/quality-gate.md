---
sidebar_position: 3
title: "Control de Calidad"
related:
  - label: "Coaching Data"
    to: /docs/concepts/coaching-data
    kind: concept
  - label: "Script Converters"
    to: /docs/concepts/script-converters
    kind: concept
  - label: "Scoring Specification"
    to: /docs/network/specifications/scoring
    kind: arena
    note: "How quality is scored on the public benchmark"
  - label: "Cookbook: Translate 30 Languages"
    to: /docs/tutorials/translate-30-languages
    kind: cookbook
    note: "Audit quality across 30 locales"
---

# Puerta de Calidad

Cada traducción pasa por una puerta de validación determinística antes de escribirse en disco. La puerta de calidad detecta modos de fallo comunes en traducción automática — sin fallbacks silenciosos, sin basura escrita en sus archivos de locale.

## Controles de Validación

| Comprobación | Qué detecta | Etiqueta de la puerta |
|-------|----------------|-----------|
| **Vacío/en blanco** | El modelo devolvió una cadena vacía o espacios en blanco | `[GATE] empty` |
| **Eco del origen** | El modelo devolvió la entrada original en inglés | `[GATE] source-echo` |
| **Bucle de alucinación** | Patrones de trigramas repetidos (p. ej., `"Qo' Qo' Qo'"`) | `[GATE] hallucination` |
| **Inflación de longitud** | La salida es significativamente más larga que el origen | `[GATE] length` |
| **Eliminación de contenido** | La salida es el origen sin sus letras | `[GATE] content` |
| **Cumplimiento de escritura** | Sistema de escritura incorrecto para la configuración regional de destino | `[GATE] script` |
| **Categorías de plurales de ICU** | Faltan las formas plurales requeridas para la configuración regional | `[GATE] icu-plural` |

Las claves declaradas como [`noTranslate`](/docs/getting-started/configuration#no-translate) nunca llegan a la puerta: se copian del origen de forma literal, por lo que no hay nada que validar.

### Vacío/En Blanco

Rechaza traducciones que sean cadenas vacías, solo espacios en blanco, o `null`. Esto detecta modelos que no devuelven nada para claves difíciles.

### Eco de Fuente

Detecta cuando el modelo devuelve el texto fuente en inglés en lugar de traducirlo. Común con cadenas cortas y prompts poco especificados.

Las cadenas cortas compuestas principalmente por caracteres ASCII (≤ 30 caracteres) están exentas: `"Blog"`, `"GitHub"`, `"npm"` se mantienen legítimamente en inglés en todas partes, y rechazarlas causaría un bucle infinito.

Los valores más largos que también son correctos sin cambios (URL, rutas de repositorios, identificadores de productos) no son un problema de la puerta y no se pueden solucionar ajustándola: la respuesta correcta *es* el eco, por lo que cualquier posible salida del modelo es incorrecta. Declare esas claves con [`noTranslate`](/docs/getting-started/configuration#no-translate) y omitirán el proceso por completo. Las claves con valores de URL se manejan de esa manera de forma predeterminada.

### Bucle de Alucinación

Analiza patrones de trigramas (3 caracteres) en la salida. Si algún trigrama se repite más que un número umbral relativo a la longitud de la salida, la traducción se rechaza. Esto detecta salidas degeneradas como `"Qo' Qo' Qo' Qo' Qo'"`.

### Inflación de Longitud

Rechaza traducciones donde la longitud de la salida excede `maxLengthRatio × source length` (predeterminado: 4×). Esto detecta alucinaciones del modelo que producen paredes de texto para una entrada corta.

Configurable mediante `maxLengthRatio` en su configuración.

### Eliminación de contenido

El reflejo de la inflación de longitud. Un modelo sin vocabulario para una cadena puede eliminar cada letra que no puede traducir y dejar intactos la puntuación y el espaciado del origen:

```
"low-resource nmt · tokenizers · nêhiyawêwin"  →  "   ·   · êhiêi"
"the simple-builder approach"                  →  "  "
```

Ninguna otra comprobación detecta esto. No está vacío, no es un eco, no es repetitivo y, con un 33 % de la *longitud* del origen, supera `minLengthRatio` cómodamente.

La comprobación compara los **caracteres de contenido** (letras y dígitos, ignorando la puntuación, los espacios en blanco y el formato invisible) entre el origen y la salida. Pero la densidad por sí sola no puede ser la regla, porque los sistemas de escritura densos legítimos se encuentran exactamente en la misma situación:

| Origen | Salida | Contenido retenido | Veredicto |
|--------|--------|------------------|---------|
| `low-resource nmt · tokenizers · nêhiyawêwin` | `   ·   · êhiêi` | 14% | **rechazado** |
| `Getting started` | `入门` | 14% | aceptado |
| `Frequently asked questions` | `常见问题` | 17% | aceptado |

Cualquier umbral que detecte el primero rechaza el chino, el japonés y el coreano de plano. Lo que los separa no es cuánto sobrevivió, sino *de dónde provino*: la salida vaciada es una **subsecuencia** de su propio origen (que se puede producir eliminando caracteres de este), mientras que una traducción real no comparte prácticamente nada con el origen. Una alerta requiere **ambas** señales, por lo que la comprobación es necesaria pero no suficiente, de la misma manera que lo es el detector de repeticiones.

Configurable a través de `minContentRetention` (valor predeterminado `0.35`), por par o por idioma. Aumentarlo hace que la comprobación sea más estricta; solo se activa junto con la señal de subsecuencia.

:::note[Esta es una señal de vocabulario, no un dial de calidad]
Cuando esto se activa repetidamente para un idioma de destino, el modelo no tiene palabras para ese texto (generalmente cadenas cortas y densas en jerga en un idioma con un léxico cerrado). Relajar el umbral restaura la corrupción silenciosa; no produce una traducción. Corrija el prompt, los datos de entrenamiento o el par.
:::

### Cumplimiento de Script

Para las configuraciones regionales cuya tarjeta de idioma registra un sistema de escritura no latino (árabe, CJK, cirílico, …), valida que la salida realmente contenga caracteres no ASCII: la salida exclusivamente latina para esas configuraciones regionales se rechaza por tener un sistema de escritura incorrecto.

Dos aclaraciones sobre lo que *no* es esta comprobación:

- **No está controlada por el campo de configuración `script:`.** Ese campo selecciona la ortografía de salida para la [conversión de escritura](/docs/getting-started/configuration#script-conversion); la expectativa de la puerta proviene de las tarjetas de idioma.
- Siempre valida el **sistema de escritura de trabajo que emite el modelo**, *antes* de cualquier conversión de escritura. Las configuraciones regionales con un convertidor de escritura (crk, sr, tlh, …) producen correctamente una salida en el sistema de escritura de trabajo latino, por lo que están exentas de esta comprobación; la conversión (si la configuración lo habilita) ocurre después de la puerta.

## Qué Sucede en Caso de Fallo

1. La traducción fallida se registra en stderr con un prefijo `[GATE]`, el nombre de la clave, la razón y una vista previa del valor
2. La clave **no** se escribe en el archivo de locale
3. Se activa la cascada de reintentos (ver abajo)

```
[GATE] hero.title: source-echo — "Welcome to our platform"
[GATE] nav.about: hallucination — "À À À À À À À À"
```

## Reintento con retroalimentación y la cascada de reintentos

Una clave rechazada por la puerta obtiene **un reintento con retroalimentación**: el motivo del rechazo se inyecta en el prompt como contexto por clave (un reintento a ciegas a baja temperatura devolvería una salida idéntica a nivel de bytes). Si el reintento tiene éxito, la clave se escribe y la sincronización se marca en **verde**: un rechazo de la puerta que se autorrepara no es un fallo, y esta es la semántica prevista. Solo las claves que siguen fallando después del reintento se omiten, se notifican (la sincronización finaliza con un valor distinto de cero) y se vuelven a intentar en la siguiente sincronización.

El reintento se ejecuta a través del propio método de traducción del par, sea cual sea: LLM, Google Translate, DeepL o un proveedor directo. También se aplica a las coincidencias de la memoria de traducción: un valor en caché que la puerta rechaza se expulsa y se vuelve a traducir en la misma ejecución, por lo que una caché envenenada se cura a sí misma.

Por separado, cuando falla un lote completo (error de análisis de JSON), champollion vuelve a intentarlo con lotes progresivamente más pequeños:

```
Full batch (80 keys) → parse error
  └→ Half batch (40 keys) → 2 failures
      └→ Individual keys (1 each) → isolates the 2 problem keys
```

El presupuesto de reintentos está limitado por `maxRetries` (predeterminado: 3, configurable por idioma). Esto previene gasto de tokens descontrolado en claves que fallan consistentemente.

Después de agotar los reintentos, las claves problemáticas se registran y se omiten. Se reintentarán en la próxima ejecución de `sync`.

## Almacenamiento en Caché de Prompts

El mensaje del sistema (registro, reglas gramaticales, notas de estilo) se separa del mensaje del usuario (las claves a traducir). Esta separación es intencional:

- El mensaje del sistema es **idéntico entre lotes** para un locale dado
- Proveedores como Anthropic y Google almacenan en caché mensajes del sistema repetidos
- Resultado: el primer lote paga el costo total de tokens, los lotes posteriores pagan solo por el mensaje del usuario

Esto puede reducir significativamente los costos de tokens para proyectos con muchos lotes.

## Validación de MessageFormat ICU

El comando `integrity` valida patrones plurales de MessageFormat ICU contra reglas plurales CLDR. Si su archivo fuente usa sintaxis ICU como:

```json
"items": "{count, plural, one {# item} other {# items}}"
```

Champollion verifica que las versiones traducidas incluyan todas las categorías plurales requeridas para el locale de destino. Por ejemplo, árabe requiere seis categorías (`zero`, `one`, `two`, `few`, `many`, `other`) — no solo `one` y `other`.

Ejecute `champollion integrity` para verificar la completitud plural en todos los locales.

## Cumplimiento de Terminología

Para pares entrenados con un diccionario, champollion ejecuta una verificación de terminología posterior a la traducción. Después de que la puerta de calidad pase, verifica si el LLM realmente utilizó los términos de diccionario requeridos.

```
[TERM] en→fr: 2 term violation(s)
  • hero.title: "dashboard" → expected "tableau de bord" but got "panneau de contrôle"
```

Las violaciones de terminología son **advertencias, no errores bloqueantes**. La traducción aún se escribe en disco. Esto es intencional — el LLM puede tener razones válidas para elegir una alternativa (contexto, gramática), y bloquear en desajustes de términos causaría más daño que bien.

Para corregir violaciones, actualice el diccionario de entrenamiento o edite manualmente el archivo de locale.

---

## Consulte también

- [Cómo Funciona la Sincronización](/docs/concepts/how-sync-works) — dónde encaja la puerta de calidad en el pipeline
- [Métodos de Traducción](/docs/guides/translation-methods) — métodos que alimentan la puerta
- [Convertidores de Script](/docs/concepts/script-converters) — conversión de script posterior a la puerta
- [Datos de Entrenamiento](/docs/concepts/coaching-data) — mejora de la calidad de traducción antes de la puerta
- [Memoria de Traducción](/docs/concepts/translation-memory) — almacenamiento en caché de traducciones validadas
- [Referencia CLI — sync](/docs/reference/cli#sync) — flags de sync incluyendo comportamiento de reintentos
- [Referencia CLI — integrity](/docs/reference/cli#integrity) — auditoría plural ICU
