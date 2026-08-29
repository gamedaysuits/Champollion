---
sidebar_position: 1
title: "Referencia de CLI"
related:
  - label: "Quick Start"
    to: /docs/getting-started/quick-start
    kind: guide
  - label: "Configuration"
    to: /docs/getting-started/configuration
    kind: reference
  - label: "CI/CD"
    to: /docs/guides/ci-cd
    kind: guide
  - label: "Troubleshooting"
    to: /docs/guides/troubleshooting
    kind: guide
---

# Referencia de CLI

## Comandos

```
champollion init              Interactive setup wizard (--yes for quick defaults)
champollion sync              Translate & sync all locale files
champollion watch             Auto-sync when the source file changes
champollion audit             List all untranslated [EN] fallback values
champollion lint              Scan source code for hardcoded strings
champollion wrap              Auto-wrap hardcoded strings in t() calls (with undo)
champollion seo <sub>         Generate hreflang, sitemap.xml, or JSON-LD schema
champollion integrity         Audit locale files for format/encoding issues
champollion repair-script     Restore romanization where script conversion was unwanted
champollion verify            Verify translations are present and correct (CI gate)
champollion status            Show pair configuration, plugins, and quality tiers
champollion provenance        Audit translation resource licensing
champollion plugin <sub>      Manage method plugins (install, remove, list)
champollion fonts <sub>       Download web fonts for PUA script converters
champollion leaderboard       Browse and install methods from the Network leaderboard
champollion tm <sub>          Manage Translation Memory cache (stats, clear, seed, prune)
champollion xliff <sub>       Export/import XLIFF 1.2 for professional review
champollion card <code>       Pretty-print a language card (--json for raw output)
champollion models            List available models from a provider (--method <provider>)
champollion doctor            System health check (cards, config, FSTs, API keys, methods)
champollion recommend         Method guidance for a pair — availability + cited evidence
champollion register-corpus   Register a corpus: pick a license + exposure tier (local-only/private/public/sealed)
champollion submit            Propose an index entry (review-gated): prints a pre-filled GitHub issue
champollion seal-corpus <sub> Sealed-tier crypto verbs: keygen / seal / open (organizer-node bridge)
```

Ejecute `champollion <command> --help` para obtener ayuda detallada sobre cualquier comando.

## Opciones globales

```
--help, -h              Show help (global or per-command)
--version, -v           Print version and exit
--yes, -y               Skip interactive prompts, use defaults
--config <path>         Custom config file path
--dir <path>            Override locales directory
--content-dir <path>    Hugo/Docusaurus content directory for Markdown translation
--source <code>         Override source locale (default: en)
--model <model>         Override translation model (full slug or alias from shared/model-aliases.json)
--method <method>       Translation method: llm, google-translate (default: from config)
--temperature <n>       LLM temperature (0.0–2.0, default: 0.3)
--coaching-file <path>  Path to free-text coaching prompt file (injected into system prompt)
--format <fmt>          Locale file format: json, toml, yaml, or auto
--dry, --dry-run        Preview changes without writing files
--list-keys             With --dry: name every queued key per reason
--concurrency <n>       Max parallel API calls (sets both JSON and content, default: 48)
--json-concurrency <n>  Max parallel locale translations for JSON keys (default: 200)
--content-concurrency <n> Max parallel API calls for content translation (default: 48)
--force                 Re-queue every source key (whole-locale rebuild; scope with --pair)
--force-content         Re-translate all content files (clears content lock)
--force-keys <keys>     Comma-separated dot-notation keys to force re-translate
--no-tm                 Skip Translation Memory cache for this sync run
--no-verify             Skip post-sync verification pass
--locale <code>         Target locale (xliff export, tm clear)
--quiet                 Errors and warnings only — suppress banner, progress bar, and info lines
--json                  Machine-readable NDJSON output — one JSON object per event
```

---

## init

Asistente de configuración interactivo que crea `champollion.config.json`. Guía a través de la configuración de locale de origen, idiomas de destino, formato de archivo y modelo de traducción.

```bash
champollion init                          # interactive wizard
champollion init --yes                    # skip wizard, use defaults
champollion init --yes --langs fr,de,ja   # quick setup with specific languages
champollion init --source en --dir ./i18n # overrides with defaults
```

**Opción `--langs`**: Lista separada por comas de códigos de idioma de destino. Omite la solicitud de idioma y aplica presets de registro predeterminados para cada idioma. Combine con `--yes` para una configuración completamente no interactiva.

**Presets de idioma**: Cuando se le solicite idiomas de destino, puede escribir nombres de presets:
- `european` → fr, de, es, it, pt, nl
- `asian` → ja, zh, ko
- `global` → fr, es, de, ja, zh, ko, pt, ar
- `nordic` → da, fi, nb, sv

Mezcle presets y códigos individuales: `european, ja` → fr, de, es, it, pt, nl, ja

---

## sync

Traduce claves faltantes y obsoletas en todos los archivos de locale. Ejecuta verificación post-sync de forma predeterminada.

```bash
champollion sync                                   # translate everything
champollion sync --dry-run                         # preview only
champollion sync --dry --list-keys                 # preview AND name every queued key
champollion sync --force-keys "hero.title"         # force re-translate
champollion sync --force-keys "a.title,a.subtitle" # multiple keys
champollion sync --pair en:tlh --force             # rebuild one whole locale
champollion sync --pair en:tlh --force --no-tm     # ...bypassing a suspect cache
champollion sync --force-content                   # re-translate all Markdown/MDX
champollion sync --content-dir ./content           # include Hugo Markdown
champollion sync --method google-translate          # force Google Translate
champollion sync --concurrency 20                  # 20 parallel API calls (both phases)
champollion sync --json-concurrency 30              # 30 parallel locale translations (JSON)
champollion sync --content-concurrency 8            # 8 parallel content translations
champollion sync --no-verify                        # skip post-sync verification
champollion sync --no-tm                            # skip cache, fresh API calls
```

**Memoria de traducción**: De forma predeterminada, `sync` carga `.champollion/tm.json` y sirve traducciones en caché para valores de origen sin cambios. Use `--no-tm` para omitir la caché (útil al cambiar proveedores de traducción o depurar calidad). Consulte [Memoria de traducción](/docs/concepts/translation-memory).

**Detección de cambios**: champollion almacena hashes SHA-256 en `.champollion.lock`. Cuando los valores de origen cambian, la siguiente sincronización vuelve a traducir automáticamente esas claves. Confirme el archivo de bloqueo para que todos los desarrolladores compartan la línea base.

**Paralelismo**: Tanto la traducción de claves JSON como la traducción de contenido se ejecutan en paralelo. Los locales JSON se traducen simultáneamente (predeterminado: 200 locales concurrentes), con lotes dentro de cada locale también paralelizados (4 lotes concurrentes). La traducción de contenido (Markdown, MDX, publicaciones de blog) se ejecuta en un grupo de elementos de trabajo plano (predeterminado: 48 llamadas API concurrentes). Anule con `--json-concurrency`, `--content-concurrency`, o `--concurrency` (establece ambos).

**Salida**: Sync muestra un banner de versión, detección de formato/framework, estimación de costo y barras de progreso por locale:

```
champollion v0.1.0

[INFO] Detected format: json (auto)
[INFO] Source: en.json (2,847 keys)
[INFO] Pairs: es-MX:llm, fr:deepl

[INFO] es-MX.json — 2,847 missing
     ████████████████████████████████ 2,847/2,847 keys
[INFO] fr.json — 2,847 missing
     ████████████████████████████████ 2,847/2,847 keys
[OK] Synced 5,694 keys total.
```

Las barras de progreso se actualizan en su lugar después de cada lote (~80 claves). Use `--quiet` solo para errores/advertencias, o `--json` para salida NDJSON legible por máquina. Ambas suprimen la barra de progreso y el banner.

---

## watch

Sincronización automática cuando cambia el archivo de locale de origen. Se ejecuta hasta que se interrumpe con `Ctrl+C`.

```bash
champollion watch
```

---

## audit

Enumera todos los valores de fallback con prefijo `[EN]` sin traducir de ejecuciones anteriores. Sale con código 1 si se encuentran — úselo como puerta de CI para fallar compilaciones con traducciones incompletas.

```bash
champollion audit
```

---

## verify

Vuelve a leer todos los archivos de locale del disco y verifica que las traducciones estén realmente presentes y sean correctas. Esta es la misma verificación que se ejecuta automáticamente al final de cada `sync` (a menos que se pase `--no-verify`).

```bash
champollion verify                    # verify all locale files
champollion verify --warn-only        # non-blocking
champollion verify && echo "All good" # CI gate
```

**Lo que verifica:**
- Paridad de claves — todas las claves de origen presentes en cada destino
- Marcadores de fallback `[EN]` de ejecuciones anteriores
- Traducciones vacías
- Cumplimiento de script — los locales no latinos deben tener traducciones no ASCII
- Preservación de placeholders — los placeholders ICU coinciden con el origen
- Problemas de codificación — marcadores BOM, caracteres invisibles
- Ecos de origen — valores idénticos al origen (advertencia)

---

## lint

Escanea el código fuente en busca de cadenas de cara al usuario codificadas que deberían usar llamadas de traducción i18n. Detecta automáticamente su framework (next-intl, react-i18next, vue-i18n, Hugo).

```bash
champollion lint                    # exits 1 if issues found
champollion lint --warn-only        # always exits 0
champollion lint --src ./app        # custom source directory
champollion lint --min-length 4     # minimum string length to flag
```

**Lo que detecta:**
- Cadenas codificadas en texto JSX, `placeholder`, `alt`, `aria-label`, `title`
- Archivos con contenido de cara al usuario pero sin importación de framework i18n
- Claves muertas — claves de locale que ningún archivo de origen referencia
- Puntuación de cobertura — porcentaje de cadenas que pasan por i18n

**Exclusiones**: Cree `.champollionignore` en la raíz de su proyecto (patrones glob, como `.gitignore`).

---

## wrap

Envuelve automáticamente cadenas codificadas detectadas por `lint` en llamadas `t()`. Crea copias de seguridad automáticas antes de modificar archivos.

```bash
champollion wrap                    # auto-wrap with backup
champollion wrap --dry              # preview wrapping changes
champollion wrap --undo             # restore from .champollion-backup/
```

**Puertas de seguridad:**
1. Verificación de limpieza de Git (omitida en ejecución en seco)
2. Copia de seguridad automática a `.champollion-backup/`
3. Vista previa de diferencias antes de cada escritura de archivo
4. Soporte `--undo` para restaurar desde copia de seguridad

---

## seo

Genere artefactos SEO para sitios multilingües.

```bash
champollion seo hreflang                                        # print hreflang tags
champollion seo sitemap --base-url https://example.com --out sitemap.xml
champollion seo jsonld --base-url https://example.com           # JSON-LD schema
```

| Subcomando | Salida |
|------------|--------|
| `hreflang` | Etiquetas `<link rel="alternate" hreflang>` |
| `sitemap` | `sitemap.xml` multilingüe |
| `jsonld` | Esquema JSON-LD WebSite de idioma |

---

## integrity

Detecta corrupción y desviación en archivos de locale traducidos.

```bash
champollion integrity               # exits 1 if issues found
champollion integrity --warn-only   # non-blocking
```

**Lo que verifica:**
- Corrupción de marcadores de posición (por ejemplo, `{name}` presente en el origen pero ausente en el destino)
- Problemas de codificación (mojibake, Unicode inválido)
- Copias sin traducir (el valor de destino es idéntico al de origen) — las claves [`noTranslate`](/docs/getting-started/configuration#no-translate) están exentas, al igual que los ecos que la Translation Memory confirma como producidos por el pipeline y aprobados por el control de validación. Lo que permanece marcado es exactamente lo que `sync` volvería a poner en cola — las dos herramientas no pueden estar en desacuerdo sobre un archivo en buen estado
- Desviación de no traducción (una clave `noTranslate` que *no* es idéntica al origen) — se reporta con los valores esperados/reales y los caracteres invisibles escapados; ejecute `champollion sync` para reparar
- PUA inesperado (puntos de código del Área de Uso Privado en una configuración regional cuya [conversión de escritura](/docs/getting-started/configuration#script-conversion) está desactivada — se muestra en blanco sin una fuente especial); ejecute `champollion repair-script` para reparar
- Valores vaciados (un destino que es su origen con las letras eliminadas — daño de un pipeline más antiguo que el control de preservación de contenido); vuelva a traducir con `sync --force-keys <key>` o `sync --pair <pair> --force`
- Claves huérfanas (claves en el destino que no existen en el origen)
- Integridad de las categorías de plurales de ICU MessageFormat (por ejemplo, el árabe necesita 6 categorías)

---

## repair-script

Revierte la conversión de escritura que nunca debió ocurrir: los valores codificados en PUA (pIqaD, Tengwar, Kryptonian) en configuraciones regionales cuya configuración indica que la conversión está desactivada se restauran a la romanización a través de la propia tabla inversa del convertidor.

```bash
champollion repair-script --dry     # preview
champollion repair-script           # repair in place
```

| Opción | Efecto |
|--------|--------|
| `--dry` | Previsualizar las reparaciones sin escribir |
| `--locale <code>` | Reparar solo una configuración regional |
| `--json` | Salida JSON legible por máquina |
| `--warn-only` | Salir con 0 incluso si queda PUA irreversible |

pIqaD se revierte exactamente. Las reversiones de Tengwar y Kryptonian no pueden recuperar las mayúsculas (marcadas como pérdida de capitalización). La Translation Memory no necesita reparación — almacena los valores previos a la conversión. Sale con 1 cuando queda PUA que ningún convertidor registrado puede revertir.

---

## tm

Administre la caché de Memoria de traducción (`.champollion/tm.json`). TM almacena traducciones anteriores y las sirve en sincronizaciones posteriores en lugar de llamar a la API.

```bash
champollion tm stats                  # show cache statistics
champollion tm clear                  # clear cache (with confirmation)
champollion tm clear --yes            # clear without confirmation
champollion tm clear --locale fr      # clear only French entries
```

| Subcomando | Salida |
|------------|--------|
| `stats` | Recuento de entradas, tamaño de archivo, desglose por locale |
| `clear` | Eliminar archivo de caché (completo o por locale) |

| Opción | Efecto |
|--------|--------|
| `--locale <code>` | Borrar solo entradas para un locale |
| `--yes` | Omitir solicitud de confirmación |

Consulte [Memoria de traducción](/docs/concepts/translation-memory) para saber cómo funciona TM y cuándo borrarlo.

---

## xliff

Exporte e importe archivos XLIFF 1.2 para revisión de traductores profesionales. XLIFF es el formato de intercambio universal compatible con herramientas CAT como memoQ, SDL Trados y Phrase.

```bash
champollion xliff export --locale fr                   # export French XLIFF
champollion xliff export --locale ja --out ./review/   # custom output path
champollion xliff import .champollion/xliff/fr.xliff       # import reviewed file
champollion xliff import ./reviewed.xliff --dry        # preview import
```

| Subcomando | Salida |
|------------|--------|
| `export` | Genere `.xliff` desde archivos de locale de origen + destino |
| `import` | Combine traducciones `.xliff` revisadas en archivos de locale |

| Opción | Efecto |
|--------|--------|
| `--locale <code>` | Locale de destino para exportación (requerido) |
| `--out <path>` | Ruta o directorio de salida personalizado |
| `--dry` | Vista previa de importación sin escribir |

Consulte [Trabajar con traductores profesionales](/docs/guides/professional-translators) para el flujo de trabajo completo.

---

## status

Muestre configuración de par, plugins instalados, niveles de calidad y puntuaciones de referencia.

```bash
champollion status
```

---

## provenance

Audite licencias de recursos de traducción para todos los plugins instalados.

```bash
champollion provenance
```

---

## plugin

Administre plugins de método de traducción. Los plugins son recetas de traducción preempaquetadas instaladas en `.champollion/methods/`.

```bash
champollion plugin list                      # show installed plugins
champollion plugin install ./my-method/      # install from local directory
champollion plugin remove crk-coached-v1     # remove a plugin
```

Consulte [Especificación de plugin](/docs/reference/plugin-spec) para el formato de manifiesto del plugin.

---

## leaderboard

Explore, busque e instale métodos de traducción desde el leaderboard de Network. Los métodos instalados desde el leaderboard vienen con puntuaciones de referencia y la MethodConfig canónica completa — la configuración exacta utilizada durante la evaluación.

```bash
champollion leaderboard                          # show leaderboard
champollion leaderboard --pair en:fr             # filter by language pair
champollion leaderboard --install crk-coached-v8 # install a method plugin
champollion leaderboard --install crk-coached-v8 --apply  # install + patch config
```

| Opción | Efecto |
|--------|--------|
| `--pair <code>` | Filtrar leaderboard por par de idiomas (p. ej., `en:fr`) |
| `--install <name>` | Instalar un plugin de método desde el leaderboard |
| `--apply` | Después de instalar, agregue automáticamente `methodPlugin` a `champollion.config.json` |

**Flujo de trabajo `--apply`**: Cuando instala con `--apply`, champollion escribe el plugin de método en `.champollion/methods/` **y** parcha su `champollion.config.json` para usarlo en el par relevante. Este es el camino más rápido desde "¿qué tiene la mejor puntuación?" a "Lo estoy usando en producción."

---

## fonts

Descarga y administra fuentes web PUA para convertidores de scripts de lenguajes construidos. Los idiomas que usan caracteres de Área de Uso Privado (Klingon, Sindarin, Kryptoniano) necesitan fuentes web personalizadas para renderizar sus scripts. Este comando las descarga desde repositorios de código abierto verificados.

```bash
champollion fonts list                           # show needed fonts
champollion fonts install                        # download all needed fonts
champollion fonts install --css                  # also generate CSS snippet
champollion fonts install --dir ./public/fonts   # custom output directory
```

| Subcomando | Salida |
|------------|--------|
| `list` | Muestra qué fuentes PUA se necesitan y su estado de instalación |
| `install` | Descarga fuentes para idiomas configurados |

| Opción | Efecto |
|--------|--------|
| `--dir <path>` | Anule el directorio de salida de fuentes (detectado automáticamente del tipo de proyecto) |
| `--css` | Genere un fragmento `conlang-fonts.css` junto con las fuentes |
| `--config <path>` | Ruta al archivo de configuración (se usa para detectar qué idiomas necesitan fuentes) |

**Detección automática:** El directorio de salida se deduce de su estructura de proyecto:
- **Docusaurus** → `static/fonts/` o `website/static/fonts/`
- **Hugo** → `static/fonts/`
- **Predeterminado** → `public/fonts/`

**Convertidores Unicode nativos** (`crk` → Sílabas Cree, `sr` → Cirílico serbio) NO requieren instalación de fuentes.

Consulte [Conlangs, Scripts y Ortografía](/docs/guides/conlangs-scripts-orthography) para detalles completos de fuentes PUA.

## Canalización de tres capas

Use `lint`, `sync` y `audit` juntos para i18n a prueba de balas:

```json title="package.json"
{
  "scripts": {
    "i18n:lint": "champollion lint",
    "i18n:sync": "champollion sync",
    "i18n:audit": "champollion audit"
  }
}
```

| Capa | Comando | Cuándo | Propósito |
|-------|---------|--------|---------|
| **Lint** | `lint` | Pre-commit | Bloquee commits con cadenas codificadas |
| **Sync** | `sync` | Post-commit / CI | Traduzca claves faltantes y cambiadas |
| **Verify** | `verify` | Post-sync / CI | Confirme que las traducciones estén presentes y sean correctas |
| **Audit** | `audit` | Paso de compilación | Falle la implementación si algún locale tiene marcadores `[EN]` |

---

## Consulte también

- [Configuración](/docs/getting-started/configuration) — referencia de archivo de configuración
- [Métodos de traducción](/docs/guides/translation-methods) — selección de método por par
- [Memoria de traducción](/docs/concepts/translation-memory) — caché y ahorros de costo
- [Trabajar con traductores profesionales](/docs/guides/professional-translators) — flujo de trabajo XLIFF
- [Especificación de plugin](/docs/reference/plugin-spec) — formato de manifiesto del plugin
- [Guía de CI/CD](/docs/guides/ci-cd) — automatización de comandos CLI en su canalización
- [Cómo funciona Sync](/docs/concepts/how-sync-works) — comprensión de la canalización de sincronización
- [Puerta de calidad](/docs/concepts/quality-gate) — cómo se validan las traducciones
