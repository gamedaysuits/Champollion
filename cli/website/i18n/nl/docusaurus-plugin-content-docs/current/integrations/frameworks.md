# Integratiegidsen

Stapsgewijze installatie voor champollion met populaire frameworks.

---

## API-sleutel instellen

Voordat u met een framework integreert, hebt u een vertaal-API-sleutel nodig. Champollion ondersteunt twee providers:

### Optie A: OpenRouter (aanbevolen)

[OpenRouter](https://openrouter.ai) biedt een uniforme API voor 200+ LLM-modellen. Gratis laag beschikbaar.

```bash
# Sign up at https://openrouter.ai, then:
export OPENROUTER_API_KEY=sk-or-v1-...

# Or add to .env.local:
OPENROUTER_API_KEY=sk-or-v1-your-key-here
```

Het meest geschikt voor: inhoudsrijke projecten, Markdown-vertaling en projecten die inhoudsbewuste afscherming nodig hebben (codeblokken, shortcodes, interpolatievariabelen).

### Optie B: Google Translate

```bash
export GOOGLE_TRANSLATE_API_KEY=...
```

Beste voor: grote volumes key-value stringparen (194 talen). **Niet aanbevolen** voor Markdown-content — Google Translate herkent geen codeblokken, shortcodes of interpolatievariabelen.

Om Google Translate expliciet te gebruiken:

```bash
champollion sync --method google-translate
```

> **Tip**: Als alleen `GOOGLE_TRANSLATE_API_KEY` is ingesteld (geen OpenRouter-sleutel), schakelt champollion automatisch over naar Google Translate.

---

## Hugo (TOML / YAML / Markdown)

### Projectstructuur

Hugo gebruikt `i18n/` voor tekenreeksvertalingen en `content/` voor pagina-inhoud:

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

### Installatie

```bash
npm install --save-dev champollion
```

```bash
# .env.local
OPENROUTER_API_KEY=sk-or-v1-your-key-here
```

Maak `champollion.config.json` aan:

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

### Details van inhoudsvertaling

**Voorblad**: Ondersteunt zowel YAML- (`---`) als TOML- (`+++`) scheidingstekens. Vertaalt standaard `title`, `description`, `summary`, `subtitle`, `caption` en `linkTitle`. Alle andere velden (datum, concept, tags, gewicht, slug, enz.) worden bewaard. Pas aan met `translatableFields` in uw configuratie.

**Blokbeveiliging**: Codeblokken, Hugo-shortcodes (`{{< >}}`, `{{% %}}`), inline code en ruwe HTML worden automatisch afgeschermd met behulp van Unicode-schildwachtplaceholders. Ze worden ongewijzigd doorgegeven.

**Bestandsnaamconventie**: Volgt het vertaalpatroon op bestandsnaam van Hugo:
- `my-post.md` → `my-post.fr.md`
- `my-post.en.md` → `my-post.fr.md` (verwijdert bronachtervoegsel)

**Bestaande bestanden overslaan**: Bestaande vertaalde bestanden worden nooit overschreven. Verwijder een doelbestand om hervertaling te forceren.

### Meervoudsvormen

TOML- en YAML-landinstellingen ondersteunen CLDR-meervoudsvormen:

```toml
[items]
one = "{{ .Count }} item"
other = "{{ .Count }} items"
```

Intern weergegeven als `items.one` en `items.other` voor vergelijking, vervolgens opnieuw geserialiseerd naar de juiste gesectioneerde indeling bij het schrijven.

---

## next-intl (JSON)

### Projectstructuur

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

### Installatie

```bash
npm install --save-dev champollion
```

Maak `champollion.config.json` aan:

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

Maakt `messages/fr.json`, `messages/ja.json`, enz. aan — volledig vertaald, met behoud van uw geneste sleutelstructuur. next-intl neemt ze automatisch over.

### Ontwikkelworkflow

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

### Platte bestandsstructuur (aanbevolen)

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

### Geneste mapstructuur

Als u de `{locale}/{namespace}.json`-structuur gebruikt, maak dan een synchronisatiescript om te pletten → vertalen → ontvouwen. Zie de [react-i18next-documentatie](https://react.i18next.com/) voor meer informatie.
