# Integrationsleitfäden

Schritt-für-Schritt-Einrichtung von champollion mit gängigen Frameworks.

---

## Einrichtung des API-Schlüssels

Bevor Sie eine Integration mit einem Framework vornehmen, benötigen Sie einen Übersetzungs-API-Schlüssel. Champollion unterstützt zwei Anbieter:

### Option A: OpenRouter (empfohlen)

[OpenRouter](https://openrouter.ai) bietet eine einheitliche API für mehr als 200 LLM-Modelle. Eine kostenlose Variante ist verfügbar.

```bash
# Sign up at https://openrouter.ai, then:
export OPENROUTER_API_KEY=sk-or-v1-...

# Or add to .env.local:
OPENROUTER_API_KEY=sk-or-v1-your-key-here
```

Am besten geeignet für: inhaltslastige Projekte, Markdown-Übersetzung und Projekte, die eine inhaltsbewusste Abschirmung (Codeblöcke, Shortcodes, Interpolationsvariablen) benötigen.

### Option B: Google Translate

```bash
export GOOGLE_TRANSLATE_API_KEY=...
```

Ideal für: große Mengen an Schlüssel-Wert-Paaren (194 Sprachen). **Nicht empfohlen** für Markdown-Inhalte — Google Translate berücksichtigt keine Codeblöcke, Shortcodes oder Interpolationsvariablen.

Um Google Translate explizit zu verwenden:

```bash
champollion sync --method google-translate
```

> **Tipp**: Wenn nur `GOOGLE_TRANSLATE_API_KEY` gesetzt ist (kein OpenRouter-Schlüssel), wechselt champollion automatisch zu Google Translate.

---

## Hugo (TOML / YAML / Markdown)

### Projektstruktur

Hugo verwendet `i18n/` für Zeichenketten-Übersetzungen und `content/` für Seiteninhalte:

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

### Einrichtung

```bash
npm install --save-dev champollion
```

```bash
# .env.local
OPENROUTER_API_KEY=sk-or-v1-your-key-here
```

Erstellen Sie `champollion.config.json`:

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

### Details zur Inhaltsübersetzung

**Front Matter**: Unterstützt sowohl YAML- (`---`) als auch TOML-Trennzeichen (`+++`). Übersetzt standardmäßig `title`, `description`, `summary`, `subtitle`, `caption` und `linkTitle`. Alle anderen Felder (date, draft, tags, weight, slug usw.) bleiben erhalten. Passen Sie dies mit `translatableFields` in Ihrer Konfiguration an.

**Blockschutz**: Codeblöcke, Hugo-Shortcodes (`{{< >}}`, `{{% %}}`), Inline-Code und rohes HTML werden automatisch mithilfe von Unicode-Sentinel-Platzhaltern abgeschirmt. Sie werden unverändert durchgereicht.

**Dateinamenskonvention**: Folgt dem Muster der Übersetzung nach Dateiname von Hugo:
- `my-post.md` → `my-post.fr.md`
- `my-post.en.md` → `my-post.fr.md` (entfernt das Quellsuffix)

**Vorhandene überspringen**: Vorhandene übersetzte Dateien werden niemals überschrieben. Löschen Sie eine Zieldatei, um eine erneute Übersetzung zu erzwingen.

### Pluralformen

TOML- und YAML-Locales unterstützen CLDR-Pluralformen:

```toml
[items]
one = "{{ .Count }} item"
other = "{{ .Count }} items"
```

Intern als `items.one` und `items.other` für das Diffing dargestellt und beim Schreiben wieder in das korrekte sektionierte Format serialisiert.

---

## next-intl (JSON)

### Projektstruktur

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

### Einrichtung

```bash
npm install --save-dev champollion
```

Erstellen Sie `champollion.config.json`:

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

Erstellt `messages/fr.json`, `messages/ja.json` usw. — vollständig übersetzt, wobei Ihre verschachtelte Schlüsselstruktur erhalten bleibt. next-intl erkennt sie automatisch.

### Entwicklungsworkflow

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

### Flache Dateistruktur (empfohlen)

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

### Verschachtelte Verzeichnisstruktur

Wenn Sie die `{locale}/{namespace}.json`-Struktur verwenden, erstellen Sie ein Sync-Skript zum Abflachen → Übersetzen → Entflachen. Weitere Einzelheiten finden Sie in der [react-i18next-Dokumentation](https://react.i18next.com/).
