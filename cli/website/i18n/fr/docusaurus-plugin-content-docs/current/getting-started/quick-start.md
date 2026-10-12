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

Le CLI est gratuit pour un usage non commercial sous la
[licence PolyForm Noncommercial 1.0.0](https://github.com/gamedaysuits/Champollion/blob/main/cli/LICENSE) ; l'utilisation commerciale n'est pas couverte
par cette licence. Une école, un hôpital ou une clinique publique, une organisation caritative ou un projet personnel sont couverts ; la vitrine d'une boutique
ne l'est pas. La page [Qui peut l'utiliser](/docs/getting-started/who-may-use-this) l'explique en détail.

## 1. Configurez vos fichiers de locale

Créez un fichier de locale source. Champollion prend en charge les formats JSON, TOML, YAML et bien d'autres — consultez la [référence du CLI](/docs/reference/cli) pour obtenir la liste complète :

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

# Option C: a model on your own machine (Ollama, LM Studio, vLLM) — no key
#   nothing to export if it listens on Ollama's default http://localhost:11434/v1
#   another server: export LOCAL_API_BASE=http://localhost:8000/v1 (its address; or put that line in .env.local or .env)
```

Obtenez une clé Gemini gratuite sur [aistudio.google.com/apikey](https://aistudio.google.com/apikey). Obtenez une clé OpenRouter sur [openrouter.ai](https://openrouter.ai). Pour l'option C, indiquez votre modèle lors de la configuration du projet : `npx champollion init --yes --langs fr,de --method local --model llama3.1` (ou exécutez `sync --method local --model llama3.1`).

## 3. Exécutez Sync

```bash
npx champollion sync
```

:::note[Saisie manuelle ou exécution par un script ?]
Les commandes figurant sur cette page sont destinées à être saisies par vous : `npx champollion` exécute la copie installée par votre projet, ou bien celle récupérée par npx — la dernière version la première fois, puis cette copie mise en cache. Une commande qu'un script exécute pour vous — dans un environnement de CI, un script `package.json`, un hook Git — devrait spécifier sa version, `npx --yes champollion@0.5 sync`, afin qu'une nouvelle version ne modifie jamais ce que le build exécute (et `--yes` évite que npx ne s'interrompe pour poser la question). Le [guide CI](/docs/guides/ci-cd) et les [pages consacrées aux frameworks](/docs/integrations/frameworks) la verrouillent de cette façon.
:::

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

La clé inchangée (`hero.subtitle`) est **ignorée** : sa traduction se trouve déjà dans `locales/fr.json`, elle n'est donc envoyée nulle part et n'est même pas recherchée — aucun appel, aucun coût, et elle n'est pas comptabilisée dans le chiffre « servi depuis le cache » de l'exécution.

La **mémoire de traduction** (`.champollion/tm.json`, construite automatiquement lors de chaque synchronisation) est destinée au texte qui *est* mis en file d'attente : une chaîne que vous rétablissez, la même phrase dans un autre fichier, une réexécution complète pour une locale (`sync --redo all`). Celles-ci sont servies gratuitement depuis le cache, et la ligne d'exécution indique leur nombre (`… 0 key(s) sent to the model, 12 served from the cache (free)`). Le cache est conservé par méthode, registre et coaching — pour la paire comme pour son repli respectif. Après avoir changé de méthode (par exemple `local` → `llm`), ou modifié le texte d'un fichier de coaching (sur la paire, sa langue ou son repli), rien n'est réutilisé et l'exécution en indique la raison ; un simple changement de modèle réutilise les traductions antérieures. Une modification ne retraduit rien à elle seule : `sync` indique la réexécution et son coût.

## Optionnel : Créez un fichier de configuration

Pour plus de contrôle, générez un fichier de configuration :

```bash
npx champollion init                         # guided wizard
npx champollion init --yes --langs fr,de,ja  # quick setup with specific targets
npx champollion init --yes --langs fr,de --method local --model llama3.1   # a model on this machine
```

`--method` et `--model` sélectionnent la méthode de traduction et le modèle (`npx champollion init --help` répertorie les méthodes) ; init affiche ceux que la configuration utilise.

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
  "model": "google/gemini-3.8-flash"
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
