# Guides d'intégration

Configuration étape par étape de champollion avec les frameworks populaires.

---

## Configuration de la clé API

Avant d'intégrer avec n'importe quel framework, vous avez besoin d'une clé API de traduction. Champollion prend en charge deux fournisseurs :

### Option A : OpenRouter (recommandé)

[OpenRouter](https://openrouter.ai) fournit une API unifiée pour 200+ modèles LLM. Niveau gratuit disponible.

```bash
# Sign up at https://openrouter.ai, then:
export OPENROUTER_API_KEY=sk-or-v1-...

# Or add to .env.local:
OPENROUTER_API_KEY=sk-or-v1-your-key-here
```

Idéal pour : les projets riches en contenu, la traduction Markdown, et les projets nécessitant une protection du contenu consciente (blocs de code, shortcodes, variables d'interpolation).

### Option B : Google Translate

```bash
export GOOGLE_TRANSLATE_API_KEY=...
```

Idéal pour : les paires de chaînes clé-valeur à fort volume (194 langues). **Non recommandé** pour le contenu Markdown — Google Translate ne reconnaît pas les blocs de code, les shortcodes ou les variables d'interpolation.

Pour utiliser Google Translate explicitement :

```bash
champollion sync --method google-translate
```

> **Conseil** : Si seul `GOOGLE_TRANSLATE_API_KEY` est défini (pas de clé OpenRouter), champollion bascule automatiquement vers Google Translate.

---

## Hugo (TOML / YAML / Markdown)

### Structure du projet

Hugo utilise `i18n/` pour les traductions de chaînes et `content/` pour le contenu des pages :

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

### Configuration

```bash
npm install --save-dev champollion
```

```bash
# .env.local
OPENROUTER_API_KEY=sk-or-v1-your-key-here
```

Créez `champollion.config.json` :

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

### Détails de la traduction du contenu

**Front matter** : Prend en charge les délimiteurs YAML (`---`) et TOML (`+++`). Traduit `title`, `description`, `summary`, `subtitle`, `caption`, et `linkTitle` par défaut. Tous les autres champs (date, draft, tags, weight, slug, etc.) sont préservés. Personnalisez avec `translatableFields` dans votre configuration.

**Protection des blocs** : Les blocs de code, les shortcodes Hugo (`{{< >}}`, `{{% %}}`), le code en ligne, et le HTML brut sont automatiquement protégés à l'aide de marqueurs sentinelles Unicode. Ils passent sans modification.

**Convention de nommage** : Suit le modèle de traduction par nom de fichier de Hugo :
- `my-post.md` → `my-post.fr.md`
- `my-post.en.md` → `my-post.fr.md` (supprime le suffixe source)

**Ignorer les fichiers existants** : Les fichiers traduits existants ne sont jamais écrasés. Supprimez un fichier cible pour forcer une re-traduction.

### Formes plurielles

Les locales TOML et YAML prennent en charge les formes plurielles CLDR :

```toml
[items]
one = "{{ .Count }} item"
other = "{{ .Count }} items"
```

Représentées en interne sous la forme `items.one` et `items.other` pour la comparaison, puis re-sérialisées au format sectionné correct lors de l'écriture.

---

## next-intl (JSON)

### Structure du projet

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

### Configuration

```bash
npm install --save-dev champollion
```

Créez `champollion.config.json` :

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

Crée `messages/fr.json`, `messages/ja.json`, etc. — entièrement traduits, en préservant votre structure de clés imbriquées. next-intl les récupère automatiquement.

### Flux de travail de développement

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

### Structure de fichier plat (recommandé)

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

### Structure de répertoire imbriquée

Si vous utilisez la structure `{locale}/{namespace}.json`, créez un script de synchronisation pour aplatir → traduire → dépla­tir. Consultez la [documentation react-i18next](https://react.i18next.com/) pour plus de détails.
