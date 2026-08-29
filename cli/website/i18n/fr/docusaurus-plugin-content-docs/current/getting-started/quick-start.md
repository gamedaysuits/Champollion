---
sidebar_position: 2
title: "Démarrage rapide"
related:
  - label: "Installation"
    to: /docs/getting-started/installation
    kind: guide
  - label: "Configuration"
    to: /docs/getting-started/configuration
    kind: reference
    note: "Every config field, explained"
  - label: "Cookbook: Translate 30 Languages"
    to: /docs/tutorials/translate-30-languages
    kind: cookbook
    note: "Scale from three locales to thirty"
  - label: "Troubleshooting"
    to: /docs/guides/troubleshooting
    kind: guide
---

# Démarrage rapide

Traduisez votre premier fichier de locale en 60 secondes.

## 1. Configurez vos fichiers de locale

Créez un fichier de locale source. Champollion prend en charge JSON, TOML, YAML et bien d'autres — consultez la [référence de la CLI](/docs/reference/cli) pour obtenir la liste complète :

```json title="locales/en.json"
{
  "hero": {
    "title": "Welcome to our platform",
    "subtitle": "Build something amazing"
  },
  "nav": {
    "home": "Home",
    "about": "About",
    "contact": "Contact"
  }
}
```

## 2. Définissez votre clé API

Choisissez un fournisseur et définissez la clé :

```bash
# Option A: OpenRouter (200+ models, recommended)
export OPENROUTER_API_KEY=sk-or-v1-...

# Option B: Gemini (free tier — zero cost to start)
export GEMINI_API_KEY=AI...
```

Obtenez une clé Gemini gratuite sur [aistudio.google.com/apikey](https://aistudio.google.com/apikey). Obtenez une clé OpenRouter sur [openrouter.ai](https://openrouter.ai).

## 3. Exécutez Sync

```bash
npx champollion sync
```

:::tip[Utiliser Gemini ?]
Si vous avez choisi l'Option B (Gemini), ajoutez `--method gemini`:
```bash
npx champollion sync --method gemini
```
:::

Champollion va :
1. Détecter automatiquement `locales/en.json` comme source
2. Trouver (ou demander) les langues cibles
3. Traduire toutes les clés
4. Écrire `locales/fr.json`, `locales/ja.json`, etc.
5. Créer `.champollion.lock` pour suivre ce qui a été traduit

## 4. Vérifiez les résultats

```bash
cat locales/fr.json
```

```json
{
  "hero": {
    "title": "Bienvenue sur notre plateforme",
    "subtitle": "Construisez quelque chose d'incroyable"
  },
  "nav": {
    "home": "Accueil",
    "about": "À propos",
    "contact": "Contact"
  }
}
```

## Que se passe-t-il ensuite ?

Lorsque vous modifiez une chaîne source, Champollion détecte le changement via le suivi de hachage SHA-256 et retraduit uniquement cette clé lors de la prochaine synchronisation :

```json title="locales/en.json (updated)"
{
  "hero": {
    "title": "Welcome to Acme Platform",  // ← changed
    "subtitle": "Build something amazing"  // ← unchanged, skipped
  }
}
```

```bash
npx champollion sync
# Only "hero.title" is re-translated across all locales
```

La clé inchangée (`hero.subtitle`) est servie à partir du cache de **Mémoire de traduction** de Champollion — aucun appel API, aucun coût. Le cache est construit automatiquement lors de chaque synchronisation et stocké à `.champollion/tm.json`.

## Optionnel : Créez un fichier de configuration

Pour plus de contrôle, générez un fichier de configuration :

```bash
npx champollion init                         # guided wizard
npx champollion init --yes --langs fr,de,ja  # quick setup with specific targets
```

L'assistant guidé vous guide à travers les **présets de registre** de chaque langue — des instructions de ton/formalité pré-construites adaptées à son système linguistique. Le français dispose de présets T-V (vouvoiement vs tutoiement), le coréen dispose de niveaux de discours (해요체 vs 합쇼체 vs 해체), le japonais dispose d'options keigo (です/ます vs 丁寧語).

Ou créez une configuration manuellement avec des clés de preset :

```json title="champollion.config.json"
{
  "version": 3,
  "inputLocale": "en",
  "localesDir": "./locales",
  "languages": {
    "fr": "casual-tu",
    "ko": "polite-haeyo",
    "ja": "polite"
  },
  "model": "google/gemini-2.5-flash"
}
```

Exécutez `npx champollion init` pour parcourir les présets disponibles pour chaque langue.

## Optionnel : Mode surveillance

Traduisez automatiquement lorsque votre fichier source change :

```bash
npx champollion watch
```

## Prochaines étapes

- **[Configuration](/docs/getting-started/configuration)** — Référence de configuration complète
- **[Méthodes de traduction](/docs/guides/translation-methods)** — Choisissez la bonne méthode par paire
- **[Mémoire de traduction](/docs/concepts/translation-memory)** — Comment la mise en cache vous fait économiser de l'argent lors des réexécutions
- **[Travailler avec des traducteurs professionnels](/docs/guides/professional-translators)** — Exportez XLIFF pour examen humain
- **[Intégration de framework](/docs/guides/framework-integration)** — Hugo, next-intl, react-i18next
- **[CI/CD](/docs/guides/ci-cd)** — Automatisez les traductions dans votre pipeline
- **[Dépannage](/docs/guides/troubleshooting)** — Problèmes courants et solutions
