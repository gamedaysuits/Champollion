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
2. **Use un modelo con límites de tasa más altos** (p. ej., `google/gemini-3.8-flash` tiene límites generosos)
3. **Use un método más económico/rápido** para pares de alto volumen — Google Translate no tiene límites de tasa:
   ```json
   { "pairs": { "en:it": { "method": "google-translate" } } }
   ```

### Modelo no encontrado / Errores 404

A los proveedores directos de LLM (`openai`, `anthropic`, `gemini`) se les envían sus propios nombres para los modelos. Se mapea automáticamente un id en formato de OpenRouter de su propio proveedor (`google/gemini-3.8-flash` → `gemini-3.8-flash` en `gemini`). Si la ejecución se detiene con:

**"is an OpenRouter model id … which has no model by that name"** — Está usando un modelo con formato de OpenRouter de otro proveedor (`google/gemini-3.8-flash` con `openai`). No se envió nada. Indique un modelo de ese proveedor, use el método que contenga el modelo o cambie al método `llm` para usar OpenRouter; el mensaje especifica cada uno y dónde se configuró el modelo:

```diff
- { "method": "openai", "model": "google/gemini-3.8-flash" }
+ { "method": "openai", "model": "gpt-4o" }
```
```json
{ "method": "llm", "model": "google/gemini-3.8-flash" }
```

También verifican el nombre de su modelo en el primer uso. Si ve una advertencia:

**"is an Anthropic/OpenAI/Gemini model"** — Está enviando un modelo al proveedor incorrecto:

```diff
- { "method": "gemini", "model": "claude-sonnet-4-6" }
+ { "method": "anthropic", "model": "claude-sonnet-4-6" }
```

**"not found in available models"** — El modelo puede estar deprecado o mal escrito. Champollion obtiene la lista de modelos en vivo del proveedor y sugiere alternativas. Consulte la documentación del proveedor para nombres de modelos actuales.

:::tip[La deprecación de modelos ocurre]
Los proveedores retiran nombres de modelos regularmente. Si las traducciones fallan repentinamente después de una actualización del proveedor, verifique la salida de `[WARN]` — le mostrará las alternativas actuales.
:::

### `local`: "no se pudo conectar con …"

El método `local` envía solicitudes a un servidor compatible con OpenAI en su máquina (Ollama, vLLM, LM Studio, llama.cpp). Cuando no puede conectarse, el error indica la dirección que intentó y la configuración que la eligió:

```text
[ERR] Local (OpenAI-compatible) Batch 1 failed: fetch failed (ECONNREFUSED) — could not reach http://localhost:8000/v1 (from LOCAL_API_BASE in .env)
```

La dirección proviene de la primera de estas opciones que esté definida, ya sea en el entorno o en `.env.local` / `.env`: `LOCAL_API_BASE`, luego `OPENAI_API_BASE` y después `OPENAI_BASE_URL`. Si no se define ninguna, se usa el valor predeterminado de Ollama, `http://localhost:11434/v1`. Inicie el servidor o corrija la configuración indicada en el mensaje.

## Calidad de traducción

### Las traducciones repiten el idioma de origen

La puerta de calidad lo detecta. Si una traducción es idéntica a la fuente en inglés, se rechaza y se reintenta. Si persiste:

1. **Verifique el modelo** — Algunos modelos tienen un rendimiento bajo para pares de idiomas específicos
2. **Agregue instrucciones de registro** — Indique al modelo qué idioma producir:
   ```json
   {
     "languages": {
       "ja": { "name": "Japanese", "register": "Polite/formal Japanese" }
     }
   }
   ```
3. **Pruebe un modelo diferente** — Cambie de `gpt-4o-mini` a `gpt-4o` o `google/gemini-3.1-pro-preview`

### Salida de script incorrecta (p. ej., texto latino para japonés)

La verificación de cumplimiento de script de la puerta de calidad detecta la mayoría de los casos. Si persiste:

- Verifique que el código de locale sea correcto (`ja`, no `jp`)
- Agregue instrucciones explícitas de script en el campo `register`:
  ```json
  { "register": "Japanese using hiragana, katakana, and kanji" }
  ```

### Los nombres no pasan la verificación (p. ej., "Curtis Forbes" en japonés)

Los nombres son correctos en alfabeto latino, así que indíquele a champollion cuáles son sus nombres:

```json
{ "protectedTerms": ["Curtis Forbes", "Game Day Suits"] }
```

Se le indica al modelo que los mantenga tal como están escritos, y un valor compuesto únicamente por estos nombres nunca se reporta como sin traducir o en un sistema de escritura incorrecto. Sin la lista, un valor corto en alfabeto latino dentro de un idioma que no utiliza alfabeto latino recibe un reintento que pregunta si se trata de un nombre o de una etiqueta. Si el modelo lo conserva, se acepta como un nombre y se almacena en caché, por lo que nunca se vuelve a facturar. No necesita `--no-verify`.

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

`.champollion.lock` registra a partir de qué texto en inglés se generó cada
traducción. Resuelva un conflicto de fusión en él como en cualquier archivo generado: conserve
cualquiera de los dos lados, ejecute `npx champollion sync` y haga commit del resultado.

:::warning[Eliminar el archivo lock no vuelve a traducir nada]
Sin el archivo lock, sync no puede determinar qué cadenas en inglés cambiaron desde que
se crearon las traducciones existentes. Solo traduce las claves que **faltan**
en un archivo de destino y registra el inglés actual como la nueva base de referencia. Una
cadena en inglés editada antes de eliminar el lock conserva su traducción anterior,
de forma silenciosa. Para reconstruir una configuración regional a propósito, use `--force` (delimítela con
`--pair`); las traducciones en caché se reutilizan, por lo que solo se factura
el texto que la caché nunca ha visto.
:::

### Retraduce claves específicas

Si traducciones individuales son incorrectas y desea forzar que se retraduzcan sin eliminar el archivo de bloqueo:

```bash
# Re-translate a single key
npx champollion sync --force-keys "hero.title"

# Re-translate multiple keys
npx champollion sync --force-keys "nav.home,nav.about,footer.copyright"
```

La bandera `--force-keys` anula la verificación de hash del archivo lock para esas claves específicas, forzando la retraducción sin afectar a ninguna otra clave. `--redo keys:hero.title` es lo mismo con su nombre más reciente. Ambas se obtienen de la memoria de traducción cuando esta contiene el texto; agregue `--fresh` para pagar por una nueva traducción en su lugar. Una clave que contenga una coma (un msgid de gettext es una oración completa) se escribe con `\,` y el argumento entrecomillado para la shell: `--redo 'keys:Welcome back\, %(name)s!'`.

### `verify` reporta una discrepancia de marcadores de posición (o algún otro valor dañado)

`champollion verify` (y la comprobación que se ejecuta después de cada sincronización) reporta valores que están dañados: un marcador de posición que se perdió o se renombró, un plural de ICU roto o un valor al que se le eliminaron letras. Un simple `champollion sync` **no** los repara. El valor ya está en el disco y la entrada de su lock indica que está actualizado, por lo que sync no lo modifica.

Cada hallazgo indica el comando que repara exactamente esas claves, por ejemplo:

```text
[ERR] [VERIFY] fr: 1 i18next {{…}} placeholder mismatch(es): greeting (placeholder {{name}} was changed to {{nom}}) — fix: `champollion sync --pair en:fr --redo keys:greeting`
```

Ejecute ese comando. Cuando una configuración regional abarca varios archivos, las claves se escriben como `<file>::<key>` (por ejemplo, `common::nav.home`), lo que retraduce la clave de ese archivo en particular y ninguna otra.

No necesita `--fresh`. Si el valor dañado provino de la memoria de traducción, `verify` ya lo eliminó de la caché, y así lo indica: `[TM] Evicted 1 cached translation(s) that produced damaged values`. La repetición traduce entonces el texto de nuevo (o entrega la traducción diferente que la propia caché tiene de él) en lugar de devolver el valor dañado. Un valor que alguien editó a mano nunca se almacena en caché, por lo que no se elimina nada para él, y la repetición funciona de la misma manera.

Para archivos de contenido Markdown/MDX, use `--retranslate` con una ruta o un glob (p. ej., `--retranslate docs/intro.md`). Esto traduce esos archivos desde cero, incluso si están actualizados o se tradujeron a mano. Use `--files` para limitar una ejecución a algunos archivos de contenido sin forzarlos.

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

### Traducciones después de cambiar de modelo o proveedor

Cambiar de método (p. ej., de `llm` a `deepl`), de registro o de coaching proporciona traducciones nuevas para lo que se vuelva a traducir, ya que la clave de caché los incluye; pero un sync normal no vuelve a traducir nada que ya esté hecho: `champollion sync --redo all` sí lo hace. Cambiar de **modelo** dentro del mismo método reutiliza lo que el modelo anterior tradujo, sin costo alguno; sync se lo informará antes de la estimación. Si desea las traducciones propias del nuevo modelo:

```bash
# Have the new model translate what an earlier model wrote
# (what the new model already translated still comes from the cache)
champollion sync --redo all --fresh-on-model-change

# Re-translate specific content files from scratch
champollion sync --retranslate "docs/guides/**"
```

`--fresh-on-model-change` por sí solo cambia únicamente las claves que una ejecución traduciría de todos modos (las nuevas o modificadas): tras cambiar solo de modelo, un simple `sync --fresh-on-model-change` no envía nada.

Consulte [Translation Memory](/docs/concepts/translation-memory) para obtener detalles sobre el diseño de la clave de caché.

## Cómo recuperarse de una versión defectuosa {#recover-old-damage}

Los valores escritos por una versión anterior del pipeline **nunca se reparan solos**: los hashes de su manifiesto coinciden con la fuente actual, por lo que `sync` los considera resueltos y ningún filtro de validación vuelve a verlos. Si está actualizando un proyecto que ejecutó versiones anteriores a la 0.3.0, asuma que podría haber daños en sus archivos de configuración regional y realice una auditoría primero:

```bash
champollion integrity
```

La auditoría detecta las firmas de daño conocidas e indica la solución para cada una:

| Hallazgo | Qué es | Solución |
|---------|-----------|-----|
| `UNEXPECTED PUA` | Salida de conversión de escritura (pIqaD/Tengwar/Kryptoniano) escrita cuando no se deseaba la conversión — se muestra en blanco | `champollion repair-script` (sin conexión, exacta para pIqaD) |
| `HOLLOWED VALUES` | La fuente con sus letras eliminadas — resultado previo al filtro de preservación de contenido | Volver a traducir (ver más abajo) |
| `NO-TRANSLATE DRIFT` | Una URL u otra clave textual que fue "traducida" | `champollion sync` (reparada gratis, automáticamente) |

Para los valores vaciados —o cualquier configuración regional en la que simplemente ya no confíe—, vuelva a construirla:

```bash
champollion sync --pair en:tlh --force
```

`--force` vuelve a poner en cola cada clave de origen para el par o los pares delimitados. Las coincidencias de la memoria de traducción se siguen entregando, pero cada coincidencia servida se **valida primero con los filtros de validación actuales**: un valor en caché que el filtro ahora rechaza se desaloja y se vuelve a facturar, de modo que una caché dañada se repara a sí misma en lugar de alimentar la reconstrucción. Agregue `--no-tm` si desea una refacturación completamente nueva de todos modos, y `--max-cost` para limitar el gasto en cualquiera de los casos.

La verificación posterior a la sincronización también reporta estas firmas, por lo que una configuración regional dañada hace que `sync` falle de forma visible (indicando la solución) en lugar de implementarse silenciosamente.

### Una nueva puesta en cola por única vez tras las limpiezas de `--no-tm` {#one-time-requeue}

Si su recuperación utilizó `--no-tm`, espere que la **próxima** sincronización ponga en cola un lote de claves que repiten el origen y que consideraba resueltas. `--no-tm` escribe valores sin registrarlos en la memoria de traducción, y un valor *sin registrar* que sea idéntico a su origen no se puede distinguir de uno sin traducir; por lo tanto, se vuelve a poner en cola una vez, regresa (a menudo idéntico), se registra y queda resuelto de forma permanente. Este es un costo por única vez, no un ciclo infinito. Obtenga una vista previa exacta de qué claves se verán afectadas con:

```bash
champollion sync --dry --list-keys
```

## ¿Aún atascado?

- **[GitHub Issues](https://github.com/gamedaysuits/champollion/issues)** — Busque problemas existentes o reporte uno nuevo
- **[Architecture Docs](/docs/concepts/architecture)** — Comprenda el diseño del sistema
- **[Quality Gate](/docs/concepts/quality-gate)** — Cómo funciona la validación bajo el capó
