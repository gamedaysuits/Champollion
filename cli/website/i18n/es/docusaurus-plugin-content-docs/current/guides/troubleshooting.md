---
sidebar_position: 6
title: "Solución de problemas"
---

# Solución de problemas

Problemas comunes y soluciones para champollion.

## API y autenticación

### "OPENROUTER_API_KEY not found"

Champollion requiere una clave de API para traducción con LLM. Configúrela como variable de entorno:

```bash
export OPENROUTER_API_KEY="sk-or-v1-..."
```

O en un archivo `.env` (si su proyecto carga archivos `.env`):

```
OPENROUTER_API_KEY=sk-or-v1-...
```

:::tip
Si solo tiene una clave de API de Google Translate, champollion detecta automáticamente y utiliza Google Translate como método predeterminado. No se requiere cambio de configuración.
:::

### "401 Unauthorized" desde OpenRouter

Su clave de API es inválida o ha expirado. Verifíquela en [openrouter.ai/keys](https://openrouter.ai/keys).

### "429 Too Many Requests" / Limitación de velocidad

Champollion maneja internamente los límites de velocidad con retroceso exponencial. Si constantemente alcanza límites de velocidad:

1. **Reduzca el tamaño del lote** en su configuración:
   ```json
   { "batchSize": 15 }
   ```
2. **Use un modelo con límites de velocidad más altos** (p. ej., `google/gemini-3.5-flash` tiene límites generosos)
3. **Use un método más económico/rápido** para pares de alto volumen — Google Translate no tiene límites de velocidad:
   ```json
   { "pairs": { "en:it": { "method": "google-translate" } } }
   ```

### Modelo no encontrado / Errores 404

Los proveedores de LLM directos (`openai`, `anthropic`, `gemini`) validan su cadena de modelo en el primer uso. Si ve una advertencia:

**"looks like an OpenRouter path"** — Está utilizando un modelo en formato OpenRouter (`google/gemini-3.5-flash`) con un proveedor directo. Los proveedores directos utilizan nombres de modelo simples:

```diff
- { "method": "gemini", "model": "google/gemini-3.5-flash" }
+ { "method": "gemini", "model": "gemini-2.5-flash" }
```

O cambie al método `llm` para usar OpenRouter:
```json
{ "method": "llm", "model": "google/gemini-3.5-flash" }
```

**"is an Anthropic/OpenAI/Gemini model"** — Está enviando un modelo al proveedor incorrecto:

```diff
- { "method": "gemini", "model": "claude-sonnet-4-6" }
+ { "method": "anthropic", "model": "claude-sonnet-4-6" }
```

**"not found in available models"** — El modelo puede estar deprecado o mal escrito. Champollion obtiene la lista de modelos en vivo del proveedor y sugiere alternativas. Consulte la documentación del proveedor para nombres de modelos actuales.

:::tip[La deprecación de modelos ocurre]
Los proveedores retiran nombres de modelos regularmente. Si las traducciones fallan repentinamente después de una actualización del proveedor, verifique la salida de `[WARN]` — le mostrará las alternativas actuales.
:::

## Calidad de traducción

### Las traducciones repiten el idioma de origen

La puerta de calidad lo detecta. Si una traducción es idéntica a la fuente en inglés, se rechaza y se reintenta. Si persiste:

1. **Verifique el modelo** — Algunos modelos funcionan mal para pares de idiomas específicos
2. **Agregue instrucciones de registro** — Indique al modelo qué idioma producir:
   ```json
   {
     "languages": {
       "ja": { "name": "Japanese", "register": "Polite/formal Japanese" }
     }
   }
   ```
3. **Intente un modelo diferente** — Cambie de `gpt-4o-mini` a `gpt-4o` o `google/gemini-2.5-pro`

### Salida de script incorrecta (p. ej., texto latino para japonés)

La verificación de cumplimiento de script de la puerta de calidad detecta la mayoría de los casos. Si persiste:

- Verifique que el código de locale sea correcto (`ja`, no `jp`)
- Agregue instrucciones explícitas de script en el campo `register`:
  ```json
  { "register": "Japanese using hiragana, katakana, and kanji" }
  ```

### Patrones de alucinación en la salida

Los patrones de trigrama repetidos (p. ej., "hello hello hello") son detectados por el detector de bucle de alucinación. Si la salida está corrupta pero pasa el detector:

1. **Reduzca el tamaño del lote** — Los lotes más pequeños producen salida más enfocada
2. **Use un modelo más fuerte** — Los modelos más grandes alucina menos en scripts no latinos
3. **Agregue datos de coaching** — Los términos del diccionario anclan la traducción

## Problemas de archivo y formato

### "No locale files found"

Champollion detecta automáticamente archivos de locale. Si no puede encontrarlos:

1. **Verifique `localesDir`** — Debe apuntar al directorio que contiene archivos de locale:
   ```json
   { "localesDir": "./locales" }
   ```
2. **Verifique la nomenclatura de archivos** — Los archivos deben nombrarse por código de locale: `en.json`, `fr.json`, etc.
3. **Verifique el formato** — Formatos soportados: JSON, JSON anidado, YAML, TOML

### Conflictos de archivo de bloqueo

Si `.champollion.lock` entra en un estado incorrecto:

```bash
# Reset the lock file (next sync will retranslate everything)
rm .champollion.lock
npx champollion sync
```

:::warning
Eliminar el archivo de bloqueo significa que la siguiente sincronización retraduce todas las claves, no solo las modificadas. Esto tiene implicaciones de costo de API para proyectos grandes.
:::

### Retraduce claves específicas

Si traducciones individuales son incorrectas y desea forzar que se retraduzcan sin eliminar el archivo de bloqueo:

```bash
# Re-translate a single key
npx champollion sync --force-keys "hero.title"

# Re-translate multiple keys
npx champollion sync --force-keys "nav.home,nav.about,footer.copyright"
```

La bandera `--force-keys` anula la verificación de hash del archivo de bloqueo para esas claves específicas, forzando la retranslación sin afectar ninguna otra clave.

### La traducción de contenido corrompe bloques de código

Esto no debería suceder — los bloques de código están protegidos antes de la traducción. Si sucede:

1. Verifique que el bloque de código use cercas estándar (triple backtick)
2. Busque bloques de código sin cerrar en el Markdown de origen
3. Reporte un problema — esto es un error en el sistema de protección de centinela

## Problemas de CLI

### `--watch` no detecta cambios

La observación de archivos utiliza `fs.watch` nativo de Node.js. Problemas conocidos:

- **Unidades de red** — `fs.watch` no funciona de manera confiable en montajes NFS/SMB
- **Volúmenes de Docker** — Use modo de sondeo o ejecute champollion dentro del contenedor
- **Directorios grandes** — El observador monitorea `localesDir` recursivamente; los árboles muy profundos pueden exceder los límites del SO

### `npx` ejecuta una versión antigua

```bash
# Clear the npx cache
npx --yes champollion@latest sync
```

O instale globalmente:

```bash
npm install -g champollion
champollion sync
```

## Rendimiento

### La sincronización es lenta para muchos idiomas

Champollion traduce todos los locales en paralelo de forma predeterminada. Si la sincronización sigue siendo lenta:

1. **Use Google Translate para pares de alto volumen** — Es 10–50× más rápido que la traducción con LLM
2. **Aumente el tamaño del lote** (el predeterminado es 80):
   ```json
   { "batchSize": 120 }
   ```
3. **Ajuste la concurrencia** — El paralelismo de locale JSON es predeterminado a 200 y el contenido a 48. Si su proveedor de API admite límites de velocidad más altos:
   ```bash
   npx champollion sync --json-concurrency 80 --content-concurrency 20
   ```
4. **Use un modelo rápido** — `gpt-4o-mini` es significativamente más rápido que `gpt-4o`

### Costos de API altos

- **Verifique tamaños de lote** — Lotes más grandes = menos llamadas de API = costo menor
- **Use Translation Memory** — TM está habilitado de forma predeterminada. Ejecute `champollion tm stats` para verificar que funciona. Si ve 0 entradas después de múltiples sincronizaciones, algo puede estar mal con los permisos de su directorio `.champollion/`
- **Use almacenamiento en caché de indicaciones** — Champollion divide mensajes de sistema/usuario para aciertos de caché en modelos de Anthropic y Google
- **Use Google Translate para idiomas de Tier 2** — Consulte el libro de recetas [Translate 30 Languages](/docs/tutorials/translate-30-languages)

### Traducciones obsoletas después de cambiar proveedores

Si cambia de un método de traducción a otro (p. ej., `llm` a `deepl`), el caché de TM aún puede servir traducciones antiguas del método anterior para claves cuyo texto de origen no ha cambiado. La clave de caché incluye el nombre del método, por lo que la mayoría de los casos se manejan automáticamente. Pero si cambió `model` dentro del mismo método:

```bash
# Force fresh translations for all keys
champollion sync --no-tm

# Or clear the cache entirely and re-sync
champollion tm clear --yes
champollion sync
```

Consulte [Translation Memory](/docs/concepts/translation-memory) para obtener detalles sobre el diseño de la clave de caché.

## Recuperación de una versión defectuosa {#recover-old-damage}

Los valores escritos por un pipeline anterior **nunca se autorreparan**: los hashes de su manifiesto coinciden con el origen actual, por lo que `sync` los considera establecidos y ninguna compuerta vuelve a verlos. Si está actualizando un proyecto que ejecutó versiones anteriores a la 0.3.0, asuma que puede haber daños en sus archivos locale y realice una auditoría primero:

```bash
champollion integrity
```

La auditoría detecta las firmas de daño conocidas y nombra la solución para cada una:

| Hallazgo | Qué es | Solución |
|---------|-----------|-----|
| `UNEXPECTED PUA` | Salida de conversión de sistema de escritura (pIqaD/Tengwar/Kryptonian) escrita cuando no se deseaba la conversión — se muestra en blanco | `champollion repair-script` (sin conexión, exacto para pIqaD) |
| `HOLLOWED VALUES` | El origen con sus letras eliminadas — salida de antes de la compuerta de preservación de contenido | Volver a traducir (ver a continuación) |
| `NO-TRANSLATE DRIFT` | Una URL u otra clave literal que fue "traducida" | `champollion sync` (reparado gratis, automáticamente) |

Para los valores vaciados — o cualquier archivo locale en el que simplemente ya no confíe — reconstrúyalo:

```bash
champollion sync --pair en:tlh --force
```

`--force` vuelve a poner en cola cada clave de origen para el par o pares dentro del alcance. Las coincidencias de la memoria de traducción se siguen sirviendo, pero cada coincidencia servida se **valida primero contra las compuertas actuales** — un valor en caché que la compuerta ahora rechaza es expulsado y se vuelve a facturar, por lo que una caché envenenada se autorrepara en lugar de alimentar la reconstrucción. Agregue `--no-tm` si desea una refacturación completamente nueva de todos modos, y `--max-cost` para limitar el gasto en cualquier caso.

La verificación posterior a la sincronización también reporta estas firmas, por lo que un archivo locale dañado hace que `sync` falle de forma evidente (nombrando la solución) en lugar de publicarse silenciosamente.

### Una puesta en cola única después de las limpiezas de `--no-tm` {#one-time-requeue}

Si su recuperación utilizó `--no-tm`, espere que la **siguiente** sincronización ponga en cola un lote de claves de eco del origen que usted pensaba que estaban establecidas. `--no-tm` escribe valores sin sellarlos en la memoria de traducción, y un valor *sin sellar* idéntico a su origen es indistinguible de uno no traducido — por lo que se vuelve a poner en cola una vez, regresa (a menudo idéntico), se sella y se establece permanentemente. Este es un costo único, no un bucle. Previsualice exactamente qué claves con:

```bash
champollion sync --dry --list-keys
```

## ¿Aún atascado?

- **[GitHub Issues](https://github.com/gamedaysuits/champollion/issues)** — Busque problemas existentes o reporte uno nuevo
- **[Architecture Docs](/docs/concepts/architecture)** — Comprenda el diseño del sistema
- **[Quality Gate](/docs/concepts/quality-gate)** — Cómo funciona la validación bajo el capó
