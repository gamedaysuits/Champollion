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
  - label: "Troubleshooting"
    to: /docs/guides/troubleshooting
    kind: guide
---

# Démarrage rapide

Traduisez votre premier fichier de langue en 60 secondes.

La CLI est gratuite pour un usage non commercial sous la
[PolyForm Noncommercial License 1.0.0](https://github.com/gamedaysuits/Champollion/blob/main/cli/LICENSE) ; l'utilisation commerciale n'est pas couverte
par cette licence. Une école, un hôpital public ou un dispensaire, une association caritative ou un projet personnel sont couverts ; la vitrine d'une boutique
ne l'est pas. La page [Qui peut utiliser cet outil](/docs/getting-started/who-may-use-this) l'expose en détail.

## 1. Configurez vos fichiers de langue

Créez un fichier de langue source. Champollion prend en charge JSON, TOML, YAML et bien d'autres formats — consultez la [référence de la CLI](/docs/reference/cli) pour obtenir la liste complète :

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

## 2. Définissez votre clé d'API

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

Obtenez une clé Gemini gratuite sur [aistudio.google.com/apikey](https://aistudio.google.com/apikey). Obtenez une clé OpenRouter sur [openrouter.ai](https://openrouter.ai). Pour l'option C, spécifiez votre modèle lors de la configuration du projet : `npx champollion init --yes --langs fr,de --method local --model llama3.1` (ou exécutez `sync --method local --model llama3.1`).

## 3. Lancez la synchronisation

```bash
npx champollion sync
```

:::note[Saisie par vous ou exécutée par un script ?]
Les commandes figurant sur cette page sont celles que vous saisissez vous-même : `npx champollion` exécute la copie installée par votre projet, ou bien celle que npx récupère — la version la plus récente la première fois, puis cette copie mise en cache. Une commande qu'un script exécute pour vous — CI, un script `package.json`, un hook git — devrait spécifier sa version, `npx --yes champollion@0.6 sync`, afin qu'une nouvelle version ne modifie jamais ce que le build exécute (et `--yes` évite que npx ne s'interrompe pour demander confirmation). Le [guide CI](/docs/guides/ci-cd) et les [pages sur les frameworks](/docs/integrations/frameworks) la verrouillent de cette façon.
:::

:::tip[Vous utilisez Gemini ?]
Si vous avez choisi l'Option B (Gemini), ajoutez `--method gemini` :
```bash
npx champollion sync --method gemini
```
:::

Champollion va :
1. Détecter automatiquement `locales/en.json` comme source
2. Détecter (ou vous inviter à saisir) les langues cibles
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

Lorsque vous modifiez une chaîne source, Champollion détecte le changement par suivi d'empreinte SHA-256 et ne retraduit que cette clé lors de la synchronisation suivante :

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

La clé inchangée (`hero.subtitle`) est **ignorée** : sa traduction figure déjà dans `locales/fr.json`, elle n'est donc envoyée nulle part et n'est même pas recherchée — aucun appel, aucun coût, et elle n'est pas comptabilisée dans le chiffre « servi depuis le cache » de l'exécution.

La **mémoire de traduction** (`.champollion/tm.json`, générée automatiquement lors de chaque synchronisation) est destinée au texte qui *est* mis en file d'attente : une chaîne que vous rétablissez, la même phrase dans un autre fichier, une réexécution complète pour une langue (`sync --redo all`). Celles-ci sont servies gratuitement depuis le cache, et la ligne d'exécution indique leur nombre (`… 0 key(s) sent to the model, 12 served from the cache (free)`). Le cache est conservé par méthode, registre et coaching — pour la paire et pour son repli respectivement. Après avoir changé de méthode (par exemple `local` → `llm`), ou modifié le texte d'un fichier de coaching (sur la paire, sa langue ou son repli), rien n'est réutilisé et l'exécution en explique la raison ; un simple changement de modèle réutilise quant à lui les traductions antérieures. Une modification ne retraduit rien à elle seule : `sync` indique la réexécution et son coût.

## Facultatif : Créer un fichier de configuration

Pour un contrôle accru, générez un fichier de configuration :

```bash
npx champollion init                         # guided wizard
npx champollion init --yes --langs fr,de,ja  # quick setup with specific targets
npx champollion init --yes --langs fr,de --method local --model llama3.1   # a model on this machine
```

`--method` et `--model` sélectionnent la méthode de traduction et le modèle (`npx champollion init --help` liste les méthodes) ; init affiche ceux que la configuration utilise.

L'assistant guidé vous accompagne à travers les **préréglages de registre** de chaque langue — des instructions prédéfinies de ton et de formalité adaptées à son système linguistique. Le français dispose de préréglages T-V (vouvoiement vs tutoiement), le coréen de niveaux de langue (해요체 vs 합쇼체 vs 해체), le japonais d'options de keigo (です/ます vs 丁寧語).

Ou créez manuellement une configuration avec des clés de préréglage :

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

Exécutez `npx champollion init` pour parcourir les préréglages disponibles pour chaque langue.

## Facultatif : Mode surveillance

Traduisez automatiquement dès que votre fichier source est modifié :

```bash
npx champollion watch
```

## Étapes suivantes

- **[Configuration](/docs/getting-started/configuration)** — Référence complète de la configuration
- **[Méthodes de traduction](/docs/guides/translation-methods)** — Choisir la bonne méthode par paire
- **[Mémoire de traduction](/docs/concepts/translation-memory)** — Comment la mise en cache vous fait économiser lors des réexécutions
- **[Travailler avec des traducteurs professionnels](/docs/guides/professional-translators)** — Exporter en XLIFF pour révision humaine
- **[Intégration de frameworks](/docs/integrations/frameworks)** — Hugo, next-intl, react-i18next
- **[CI/CD](/docs/guides/ci-cd)** — Automatiser les traductions dans votre pipeline
- **[Dépannage](/docs/guides/troubleshooting)** — Problèmes fréquents et solutions
