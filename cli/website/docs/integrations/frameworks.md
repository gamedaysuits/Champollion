# Integration Guides

Step-by-step setup for champollion with popular frameworks.

---

## API Key Setup

Before integrating with any framework, you need a translation API key. Champollion supports two providers:

### Option A: OpenRouter (recommended)

[OpenRouter](https://openrouter.ai) provides a unified API for 200+ LLM models. Free tier available.

```bash
# Sign up at https://openrouter.ai, then:
export OPENROUTER_API_KEY=sk-or-v1-...

# Or add to .env.local:
OPENROUTER_API_KEY=sk-or-v1-your-key-here
```

Best for: content-heavy projects, Markdown translation, and projects needing content-aware shielding (code blocks, shortcodes, interpolation variables).

### Option B: Google Translate

```bash
export GOOGLE_TRANSLATE_API_KEY=...
```

Best for: high-volume key-value string pairs (194 languages). **Not recommended** for Markdown content — Google Translate has no awareness of code blocks, shortcodes, or interpolation variables.

To use Google Translate explicitly:

```bash
champollion sync --method google-translate
```

> **Tip**: If only `GOOGLE_TRANSLATE_API_KEY` is set (no OpenRouter key), champollion auto-switches to Google Translate automatically.

---

## Hugo (TOML / YAML / Markdown)

### Project structure

Hugo uses `i18n/` for string translations and `content/` for page content:

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

### Setup

```bash
npm install --save-dev champollion
```

```bash
# .env.local
OPENROUTER_API_KEY=sk-or-v1-your-key-here
```

Create `champollion.config.json`:

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

### Content translation details

**Front matter**: Supports both YAML (`---`) and TOML (`+++`) delimiters. Translates `title`, `description`, `summary`, `subtitle`, `caption`, and `linkTitle` by default. All other fields (date, draft, tags, weight, slug, etc.) are preserved. Customize with `translatableFields` in your config.

**Block protection**: Code blocks, Hugo shortcodes (`{{< >}}`, `{{% %}}`), inline code, and raw HTML are automatically shielded using Unicode sentinel placeholders. They pass through untouched.

**Filename convention**: Follows Hugo's translation-by-filename pattern:
- `my-post.md` → `my-post.fr.md`
- `my-post.en.md` → `my-post.fr.md` (strips source suffix)

**Skip existing**: Existing translated files are never overwritten. Delete a target file to force re-translation.

### Plural forms

TOML and YAML locales support CLDR plural forms:

```toml
[items]
one = "{{ .Count }} item"
other = "{{ .Count }} items"
```

Internally represented as `items.one` and `items.other` for diffing, then re-serialized to the correct sectioned format on write.

---

## next-intl (JSON)

### Project structure

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

### Setup

```bash
npm install --save-dev champollion
```

Create `champollion.config.json`:

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

Creates `messages/fr.json`, `messages/ja.json`, etc. — fully translated, preserving your nested key structure. next-intl picks them up automatically.

### Development workflow

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

### Flat file structure (recommended)

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

### Nested directory structure

If you use the `{locale}/{namespace}.json` structure, create a sync script to flatten → translate → unflatten. See the [react-i18next docs](https://react.i18next.com/) for details.
