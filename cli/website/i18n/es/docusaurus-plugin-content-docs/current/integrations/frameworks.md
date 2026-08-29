# Guías de Integración

Configuración paso a paso de champollion con frameworks populares.

---

## Configuración de Clave API

Antes de integrar con cualquier framework, necesita una clave de API de traducción. Champollion admite dos proveedores:

### Opción A: OpenRouter (recomendado)

[OpenRouter](https://openrouter.ai) proporciona una API unificada para 200+ modelos LLM. Nivel gratuito disponible.

```bash
# Sign up at https://openrouter.ai, then:
export OPENROUTER_API_KEY=sk-or-v1-...

# Or add to .env.local:
OPENROUTER_API_KEY=sk-or-v1-your-key-here
```

Mejor para: proyectos con mucho contenido, traducción de Markdown, y proyectos que necesitan protección consciente del contenido (bloques de código, shortcodes, variables de interpolación).

### Opción B: Google Translate

```bash
export GOOGLE_TRANSLATE_API_KEY=...
```

Ideal para: pares de cadenas clave-valor de alto volumen (194 idiomas). **No recomendado** para contenido en Markdown — Google Translate no reconoce bloques de código, shortcodes ni variables de interpolación.

Para usar Google Translate explícitamente:

```bash
champollion sync --method google-translate
```

> **Consejo**: Si solo `GOOGLE_TRANSLATE_API_KEY` está configurado (sin clave de OpenRouter), champollion cambia automáticamente a Google Translate.

---

## Hugo (TOML / YAML / Markdown)

### Estructura del proyecto

Hugo usa `i18n/` para traducciones de cadenas y `content/` para contenido de página:

```
my-hugo-site/
├── i18n/
│   ├── en.toml             ← source of truth
│   ├── fr.toml
│   └── ja.toml
├── content/
│   ├── posts/
│   │   ├── hello.md        ← source (English)
│   │   ├── hello.fr.md
│   │   └── hello.ja.md
│   └── about.md
└── .env.local
```

### Configuración

```bash
npm install --save-dev champollion
```

```bash
# .env.local
OPENROUTER_API_KEY=sk-or-v1-your-key-here
```

Cree `champollion.config.json`:

```json
{
  "version": 3,
  "inputLocale": "en",
  "localesDir": "./i18n",
  "contentDir": "./content",
  "format": "auto",
  "languages": ["fr", "de", "ja", "es", "ko", "zh"]
}
```

```bash
champollion sync           # sync i18n string files + content files
champollion sync --dry     # preview changes without writing
```

### Detalles de traducción de contenido

**Front matter**: Admite delimitadores YAML (`---`) y TOML (`+++`). Traduce `title`, `description`, `summary`, `subtitle`, `caption`, y `linkTitle` por defecto. Todos los demás campos (date, draft, tags, weight, slug, etc.) se preservan. Personalice con `translatableFields` en su configuración.

**Protección de bloques**: Los bloques de código, shortcodes de Hugo (`{{< >}}`, `{{% %}}`), código en línea, y HTML sin procesar se protegen automáticamente usando marcadores centinela Unicode. Pasan sin cambios.

**Convención de nombres de archivo**: Sigue el patrón de traducción por nombre de archivo de Hugo:
- `my-post.md` → `my-post.fr.md`
- `my-post.en.md` → `my-post.fr.md` (elimina sufijo de origen)

**Omitir existentes**: Los archivos traducidos existentes nunca se sobrescriben. Elimine un archivo de destino para forzar una re-traducción.

### Formas plurales

Las configuraciones regionales TOML y YAML admiten formas plurales CLDR:

```toml
[items]
one = "{{ .Count }} item"
other = "{{ .Count }} items"
```

Representadas internamente como `items.one` y `items.other` para comparación, luego re-serializadas al formato seccionado correcto al escribir.

---

## next-intl (JSON)

### Estructura del proyecto

```
my-app/
├── messages/
│   └── en.json        ← source of truth
├── src/
│   ├── i18n/
│   │   ├── routing.ts
│   │   └── request.ts
│   └── middleware.ts
└── .env.local
```

### Configuración

```bash
npm install --save-dev champollion
```

Cree `champollion.config.json`:

```json
{
  "version": 3,
  "inputLocale": "en",
  "localesDir": "./messages",
  "languages": ["fr", "de", "ja", "es", "ko", "zh", "pt", "ar"]
}
```

```bash
npx champollion sync
```

Crea `messages/fr.json`, `messages/ja.json`, etc. — completamente traducidos, preservando su estructura de claves anidadas. next-intl los detecta automáticamente.

### Flujo de trabajo de desarrollo

```json
{
  "scripts": {
    "dev": "champollion watch & next dev",
    "i18n:sync": "champollion sync",
    "i18n:audit": "champollion audit"
  }
}
```

---

## react-i18next (JSON)

### Estructura de archivo plano (recomendado)

```
locales/
├── en.json
├── fr.json
└── ja.json
```

```json
{
  "version": 3,
  "inputLocale": "en",
  "localesDir": "./locales",
  "languages": ["fr", "de", "ja"]
}
```

### Estructura de directorio anidado

Si utiliza la estructura `{locale}/{namespace}.json`, cree un script de sincronización para aplanar → traducir → desaplanar. Consulte la [documentación de react-i18next](https://react.i18next.com/) para más detalles.
