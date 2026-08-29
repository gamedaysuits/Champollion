# Mga Gabay sa Integrasyon

Step-by-step na pag-setup para sa champollion gamit ang mga popular na framework.

---

## Pag-setup ng API Key

Bago mag-integrate sa anumang framework, kailangan ninyo ng translation API key. Sinusuportahan ng Champollion ang dalawang provider:

### Opsyon A: OpenRouter (inirerekomenda)

Nagbibigay ang [OpenRouter](https://openrouter.ai) ng unified API para sa 200+ LLM models. May available na free tier.

```bash
# Sign up at https://openrouter.ai, then:
export OPENROUTER_API_KEY=sk-or-v1-...

# Or add to .env.local:
OPENROUTER_API_KEY=sk-or-v1-your-key-here
```

Pinakamainam para sa: mga proyektong content-heavy, Markdown translation, at mga proyektong nangangailangan ng content-aware shielding (code blocks, shortcodes, interpolation variables).

### Opsyon B: Google Translate

```bash
export GOOGLE_TRANSLATE_API_KEY=...
```

Pinakamainam po para sa: mataas na volume ng mga key-value string pair (194 na wika). **Hindi po inirerekomenda** para sa nilalamang Markdown — wala pong kakayahang kumilala ang Google Translate sa mga code block, shortcode, o interpolation variable.

Upang gamitin ang Google Translate nang explicit:

```bash
champollion sync --method google-translate
```

> **Tip**: Kung `GOOGLE_TRANSLATE_API_KEY` lamang ang naka-set (walang OpenRouter key), awtomatikong lilipat ang champollion sa Google Translate.

---

## Hugo (TOML / YAML / Markdown)

### Istruktura ng proyekto

Ginagamit ng Hugo ang `i18n/` para sa string translations at ang `content/` para sa page content:

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

### Pag-setup

```bash
npm install --save-dev champollion
```

```bash
# .env.local
OPENROUTER_API_KEY=sk-or-v1-your-key-here
```

Gumawa ng `champollion.config.json`:

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

### Mga detalye ng content translation

**Front matter**: Sinusuportahan ang parehong YAML (`---`) at TOML (`+++`) delimiters. Bilang default, tina-translate ang `title`, `description`, `summary`, `subtitle`, `caption`, at `linkTitle`. Pinananatili ang lahat ng iba pang fields (date, draft, tags, weight, slug, atbp.). I-customize gamit ang `translatableFields` sa inyong config.

**Block protection**: Awtomatikong sini-shield ang code blocks, Hugo shortcodes (`{{< >}}`, `{{% %}}`), inline code, at raw HTML gamit ang Unicode sentinel placeholders. Dumadaan ang mga ito nang hindi nagagalaw.

**Filename convention**: Sinusunod ang translation-by-filename pattern ng Hugo:
- `my-post.md` → `my-post.fr.md`
- `my-post.en.md` → `my-post.fr.md` (inaalis ang source suffix)

**Skip existing**: Hindi kailanman ino-overwrite ang mga umiiral nang translated files. Mag-delete ng target file upang puwersahin ang re-translation.

### Plural forms

Sinusuportahan ng TOML at YAML locales ang CLDR plural forms:

```toml
[items]
one = "{{ .Count }} item"
other = "{{ .Count }} items"
```

Internal na kinakatawan bilang `items.one` at `items.other` para sa diffing, pagkatapos ay muling sine-serialize sa tamang sectioned format kapag nagsusulat.

---

## next-intl (JSON)

### Istruktura ng proyekto

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

### Pag-setup

```bash
npm install --save-dev champollion
```

Gumawa ng `champollion.config.json`:

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

Gumagawa ng `messages/fr.json`, `messages/ja.json`, atbp. — ganap na translated, habang pinananatili ang inyong nested key structure. Awtomatikong nakukuha ng next-intl ang mga ito.

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

### Flat file structure (inirerekomenda)

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

Kung ginagamit ninyo ang `{locale}/{namespace}.json` structure, gumawa ng sync script para mag-flatten → translate → unflatten. Tingnan ang [react-i18next docs](https://react.i18next.com/) para sa mga detalye.
