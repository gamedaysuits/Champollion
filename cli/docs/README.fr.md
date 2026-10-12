# Champollion

[![Version npm](https://img.shields.io/npm/v/champollion.svg)](https://www.npmjs.com/package/champollion)
[![Licence : PolyForm Noncommercial 1.0.0](https://img.shields.io/badge/license-PolyForm--Noncommercial--1.0.0-blue.svg)](#license)


Traduisez vos fichiers de localisation en une seule commande :

```bash
npx champollion sync
```

Champollion détecte automatiquement vos fichiers de localisation, leur format et les langues cibles. Il traduit les clés manquantes, ignore ce qui est déjà fait et écrit les résultats. C'est tout.

**Licence :** code source accessible (source-available) sous la [Licence PolyForm Noncommercial 1.0.0](../LICENSE) — gratuit à utiliser, modifier et partager à des fins non commerciales (projets personnels, recherche, enseignement, et utilisation par des associations caritatives, des écoles et des organismes publics). Son utilisation à des fins commerciales n'est pas couverte par cette licence. Le harnais d'évaluation est open source (AGPL-3.0-or-later). [Qui peut l'utiliser](https://champollion.dev/docs/getting-started/who-may-use-this) · [Détails](#license).

> **Fait partie de Champollion** — infrastructure pour l'évaluation fiable de la traduction
> automatique dans toutes les langues, à code source accessible et gratuite pour un usage
> non commercial (le harnais d'évaluation et les registres partagés sont open source). Cette CLI est l'extrémité
> de déploiement d'un projet plus
> vaste qui construit les ensembles de tests et la carte montrant qui peut traduire quoi,
> la qualité de chaque méthode sur chaque type de texte, et où se situent encore les lacunes. Elle
> s'exécute sur deux types de bancs d'essai : les bancs d'essai publics sur des données ouvertes (larges, peu coûteux,
> toutes les méthodes sont les bienvenues) et les bancs d'essai souverains — des ensembles de tests secrets que
> les communautés créent, possèdent et contrôlent, et que nous ne voyons jamais. L'infrastructure
> est à code source accessible et gérée de manière unique ; les ensembles de tests et les méthodes pour la
> langue d'une communauté appartiennent à cette communauté. Conçu pour travailler avec les communautés,
> sans jamais héberger leurs corpus — la conception remet les clés entre leurs mains. Toutes les méthodes sont les bienvenues, humaines et
> automatiques. Explorez le réseau sur
> [champollion.dev/docs/network](https://champollion.dev/docs/network/).

## Pourquoi ne pas simplement créer un script vous-même ?

Vous pourriez écrire un script rapide qui parcourt vos clés en anglais et fait appel à Google Translate. La plupart des développeurs le font — cela prend environ 30 lignes. Voici pourquoi cela finit par échouer :

- **Aucune détection des modifications.** Lorsque vous mettez à jour une chaîne en anglais, la traduction reste obsolète pour toujours. Champollion suit chaque valeur source avec des hachages SHA-256 et ne retraduit que ce qui a changé.
- **Aucun traitement par lots (batching).** Un appel d'API par clé signifie 200 clés = 200 allers-retours. Champollion regroupe intelligemment (configurable, par défaut 80 clés/lot pour les LLM, 128 pour Google).
- **Aucun contrôle de qualité.** La traduction automatique hallucine, renvoie la source à l'identique ou produit un résultat dans le mauvais système d'écriture. Champollion vérifie chaque traduction avant de l'écrire — les sorties vides, les répétitions de la source, les boucles de répétition, l'inflation de la longueur, le contenu supprimé et les mauvais systèmes d'écriture sont détectés et rejetés. Le contrôle détecte les sorties corrompues, pas les erreurs de sens.
- **Aucune reconnaissance du format.** Codé en dur pour JSON ? Champollion gère JSON, TOML, YAML et Hugo Markdown (frontmatter + corps) avec détection automatique.
- **Aucune sécurité.** Champollion protège contre la pollution de prototype, la traversée de chemin via des codes de paramètres régionaux manipulés, et la corruption des blocs de code pendant la traduction Markdown.

Champollion est la version de production de ce script.

> [!NOTE]
> **Ce que Champollion traduit.** Champollion cible **les fichiers de localisation et le contenu structuré** — paires clé-valeur JSON, configuration TOML/YAML, pages Hugo Markdown, documents d'échange XLIFF. Il est optimisé pour le texte écrit formel : chaînes d'interface utilisateur, documentation, communications officielles, matériel éducatif. Ce n'est pas un chatbot, un traducteur vocal en temps réel ou une IA conversationnelle à usage général. Pour chaque paire de langues, la méthode de traduction est configurable — des API commerciales (Google Translate, DeepL) aux plugins développés par la communauté et évalués via la [MT Eval Arena](https://champollion.dev/arena).

## Démarrage rapide

```bash
npm install --save-dev champollion
```

### Obtenir une clé d'API

Champollion nécessite un moteur de traduction (backend). Choisissez-en un :

| Fournisseur | Clé | Idéal pour |
|----------|-----|----------|
| **OpenRouter** (recommandé) | `OPENROUTER_API_KEY` | Projets riches en contenu, Markdown, plus de 200 modèles |
| **OpenAI** | `OPENAI_API_KEY` | Accès direct à GPT-4o |
| **Anthropic** | `ANTHROPIC_API_KEY` | Accès direct à Claude |
| **Gemini** | `GEMINI_API_KEY` | Niveau gratuit disponible |
| **DeepL** | `DEEPL_API_KEY` | Langues européennes, prise en charge de glossaires |
| **Google Translate** | `GOOGLE_TRANSLATE_API_KEY` | Plus de 130 langues, volume élevé |

**Démarrage le plus rapide** (gratuit) : Inscrivez-vous sur [aistudio.google.com](https://aistudio.google.com/apikey) pour obtenir une clé Gemini gratuite :

```bash
export GEMINI_API_KEY=AI...
npx champollion sync --method gemini
```

**OpenRouter** (plus de 200 modèles) : Inscrivez-vous sur [openrouter.ai](https://openrouter.ai), puis :

```bash
export OPENROUTER_API_KEY=sk-or-v1-...
npx champollion sync
```

Alternative **Google Translate** (paires clé-valeur uniquement — aucune prise en charge de Markdown) :

```bash
export GOOGLE_TRANSLATE_API_KEY=...
npx champollion sync --method google-translate
```

> **Remarque** : Si seule `GOOGLE_TRANSLATE_API_KEY` est définie, champollion bascule automatiquement sur Google Translate. Aucune modification de configuration n'est nécessaire. Utilise l'API REST directement — aucun SDK, aucun compte de service, aucun `pip install`. Juste la clé.

C'est tout. Pour plus de contrôle, créez un fichier de configuration :

```bash
npx champollion init                        # guided wizard — walks you through registers, methods, and content
npx champollion init --yes --langs fr,de,ja  # quick setup with specific languages and default registers
```

Chaque langue est fournie avec des **préréglages de registre** — des instructions de ton/formalité prédéfinies et adaptées à son système linguistique (vouvoiement pour le français, Siezen pour l'allemand, です/ます pour le japonais, 해요체 pour le coréen). L'assistant d'initialisation vous permet de parcourir et de choisir des préréglages, ou de passer `--yes` pour accepter les valeurs par défaut.

### Source non anglophone

Si votre langue source n'est pas l'anglais :

```bash
champollion sync --source fr                      # CLI flag
```

Ou définissez-la de manière permanente dans votre configuration :

```json
{ "inputLocale": "fr" }
```

## Ce qu'il fait

Vous gérez le framework d'internationalisation (i18n) (next-intl, i18next, Hugo). Champollion gère les fichiers de traduction.

- **Multi-format** — JSON, TOML, YAML, Hugo Markdown (front matter + corps), et XLIFF 1.2
- **Incrémentiel** — Ne traduit que ce qui a changé (suivi par hachage SHA-256)
- **Mise en cache** — La mémoire de traduction stocke les résultats précédents ; relancer la synchronisation ne coûte rien pour les clés inchangées
- **Contrôle de qualité** — Vérifie chaque traduction pour détecter les sorties corrompues : boucles de répétition, sortie dans le mauvais système d'écriture, répétitions de la source, inflation de la longueur et contenu supprimé (ne vérifie pas le sens)
- **Sensible au contenu** — Les méthodes LLM protègent les blocs de code, les shortcodes, les liens et les variables d'interpolation pendant la traduction Markdown
- **Outils de pipeline** — `lint`, `audit`, `integrity`, `seo` pour les contrôles CI
- **Interopérabilité XLIFF** — Exportez les traductions pour une révision professionnelle dans des outils de TAO (memoQ, SDL Trados, Phrase), puis réimportez-les
- **Dépendances minimales** — deux dépendances d'exécution : `@translated/lara` (le SDK du fournisseur Lara) et `cree-sro-syllabics` (le convertisseur SRO ⇄ syllabaire pour le cri des plaines d'ALTLab/CNRC). Nécessite Node 20+

## Au-delà de Google Translate

Le démarrage rapide vous permet de fonctionner avec un LLM ou Google Translate. Mais Google Translate prend en charge environ 130 langues. Il y en a plus de 7 000.

**L'idée centrale de Champollion : la méthode de traduction est configurable par paire de langues.** Utilisez Google Translate pour le français, un LLM entraîné avec vos propres notes de grammaire et votre dictionnaire pour le cri des plaines, et une API que vous hébergez pour une langue qu'aucun service ne couvre — le tout dans le même projet, le tout avec la même CLI.

```json
{
  "version": 3,
  "pairs": {
    "en:fr": { "method": "google-translate" },
    "en:ja": { "method": "llm" },
    "en:crk": { "method": "llm-coached" }
  }
}
```

Si vous parvenez à trouver comment traduire une paire de langues — via l'ingénierie de prompt, des dictionnaires communautaires, des pipelines FST ou des modèles affinés (fine-tuned) — champollion vous permet d'empaqueter cette méthode sous forme de plugin et de la déployer aux côtés de tout le reste.

> Né de la traduction d'un site web de production en cri des plaines, pour lequel aucune API prête à l'emploi n'existe. L'architecture par paire n'est pas théorique — elle existe parce qu'un projet avait besoin de Google Translate pour le français et d'un pipeline FST encadré pour une langue autochtone, fonctionnant côte à côte dans la même commande de synchronisation.

L'outil d'accompagnement [MT Eval Harness](https://github.com/gamedaysuits/Champollion) vous permet d'évaluer et de comparer les approches de traduction, puis d'exporter les méthodes fonctionnelles sous forme de plugins champollion. Toute personne parlant les deux langues peut développer, tester et partager une méthode de traduction — aucune plateforme propriétaire n'est requise.

### Choisissez votre méthode

Champollion prend en charge 10 méthodes de traduction. Chaque paire de langues peut utiliser une méthode différente.

**Fournisseurs de LLM** — idéal pour la qualité, la prise en charge de Markdown et la compatibilité avec l'encadrement (coaching) :

| Méthode | Clé | Ce qu'elle fait |
|--------|-----|-------------|
| `llm` (par défaut) | `OPENROUTER_API_KEY` | LLM via OpenRouter — plus de 200 modèles, routage automatique |
| `llm-coached` | `OPENROUTER_API_KEY` | LLM + règles de grammaire, dictionnaires, notes de style |
| `openai` | `OPENAI_API_KEY` | API OpenAI directe (gpt-4o, gpt-4o-mini) |
| `anthropic` | `ANTHROPIC_API_KEY` | API Anthropic directe (Claude Sonnet, Haiku, Opus) |
| `gemini` | `GEMINI_API_KEY` | API Google Gemini directe (Flash, Pro) — niveau gratuit disponible |
| `local` | *(aucune)* | Votre propre modèle derrière un point de terminaison compatible OpenAI (Ollama, vLLM, LM Studio, un modèle entraîné avec `nmt-forge`). Définissez `LOCAL_API_BASE` s'il ne se trouve pas à l'emplacement par défaut d'Ollama. Le texte ne quitte jamais votre infrastructure |

**Traduction automatique (MT) traditionnelle** — idéal pour la vitesse, le coût et les paires clé-valeur à volume élevé :

| Méthode | Clé | Ce qu'elle fait |
|--------|-----|-------------|
| `google-translate` | `GOOGLE_TRANSLATE_API_KEY` | API Google Cloud Translation v2 (plus de 130 langues) |
| `deepl` | `DEEPL_API_KEY` | API DeepL avec prise en charge de glossaires (plus de 30 langues) |
| `microsoft-translator` | `MICROSOFT_TRANSLATOR_API_KEY` | Azure Cognitive Services Translator (plus de 100 langues) |
| `libretranslate` | *(auto-hébergé)* | LibreTranslate auto-hébergé (AGPL, gratuit) |

**Infrastructure** — pour les points de terminaison (endpoints) personnalisés ou hébergés par la communauté :

| Méthode | Clé | Ce qu'elle fait |
|--------|-----|-------------|
| `api` | *(par fournisseur)* | Client HTTP léger pour tout point de terminaison REST |

```bash
# Force a specific method for one run
champollion sync --method deepl

# Or configure per pair
```

```json
{
  "pairs": {
    "en:fr": { "method": "deepl" },
    "en:ja": { "method": "openai", "model": "gpt-4o" },
    "en:crk": { "method": "llm-coached" }
  }
}
```

> **Remarque** : Les méthodes de traduction automatique traditionnelles (Google Translate, DeepL, Microsoft Translator, LibreTranslate) gèrent bien les paires clé-valeur mais ne peuvent pas traduire le contenu Markdown en toute sécurité. Pour les projets riches en contenu, les méthodes LLM sont recommandées — elles protègent explicitement les blocs de code, les shortcodes et les variables d'interpolation.

## Plugins

Les plugins sont des recettes de traduction pré-empaquetées pour des paires de langues spécifiques. Ce sont des manifestes JSON — et non du code — qui indiquent à champollion quelle méthode utiliser, avec quels paramètres, et quelle qualité a été évaluée.

```bash
champollion plugin install ./french-formal-v1/    # install from directory
champollion plugin list                           # see installed plugins
champollion plugin remove french-formal-v1        # uninstall
champollion status                                # shows each pair's method, model + plugin benchmarks
```

Consultez [la documentation de référence](https://champollion.dev/docs/reference/plugin-spec) pour le format du manifeste.

## Commandes

| Commande | Objectif |
|---------|---------|
| `init` | Assistant de configuration interactif (ou `--yes` pour les valeurs par défaut rapides) |
| `sync` | Traduire et synchroniser tous les fichiers de paramètres régionaux |
| `serve` | Servir la pile de traduction de ce projet via HTTP (contrat api-method) |
| `watch` | Synchronisation automatique lors de la modification des fichiers |
| `audit` | Signaler les paramètres régionaux incomplets (contrôle CI) |
| `lint` | Trouver les chaînes codées en dur dans le code source |
| `status` | Afficher la configuration des paires, les méthodes, les registres et les bancs d'essai des plugins |
| `provenance` | Auditer les licences des ressources de traduction |
| `wrap` | Envelopper automatiquement les chaînes codées en dur dans des appels `t()` (avec annulation) |
| `seo` | Générer hreflang, sitemap.xml ou le schéma JSON-LD |
| `integrity` | Vérifier la corruption des espaces réservés, l'encodage et l'exhaustivité des pluriels ICU |
| `plugin` | Installer, supprimer ou lister les plugins de méthode |
| `fonts` | Télécharger les polices web pour les convertisseurs de systèmes d'écriture PUA |
| `tm` | Gérer le cache de la mémoire de traduction (statistiques, effacer, initialiser, élaguer) |
| `xliff` | Exporter/importer XLIFF 1.2 pour une révision par des traducteurs professionnels |
| `models` | Lister les modèles disponibles pour un fournisseur (`--method gemini`) |
| `verify` | Relire les fichiers de paramètres régionaux écrits et confirmer que les traductions sont présentes et correctes (contrôle CI) |
| `doctor` | Bilan de santé du système : cartes, configuration, méthodes et convertisseurs |

Les commandes qui fonctionnent avec l'index partagé et le classement, plutôt qu'avec votre
projet, sont regroupées sous `champollion network` (chacune fonctionne également sans le
préfixe) :

| Commande | Objectif |
|---------|---------|
| `network card` | Formater l'affichage d'une carte de langue (`network card <code>`, `--json` pour le format brut) |
| `network recommend` | Conseils de méthode pour une paire — disponibilité + preuves citées (`network recommend eng fra`, `--use`, `--json`) |
| `network leaderboard` | Afficher le classement de la traduction automatique (`--pair`, `--sort`, `--install N`) |
| `network register-corpus` | Enregistrer un corpus d'évaluation : choisir une licence + un niveau d'exposition (local uniquement/privé/public/scellé) |
| `network seal-corpus` | Verbes cryptographiques de niveau scellé : `keygen` / `seal` / `open` (pont organisateur-nœud) |
| `network submit` | Proposer une entrée d'index (soumise à révision) — affiche un ticket GitHub pré-rempli |

Exécutez `champollion <command> --help` pour obtenir une aide détaillée sur n'importe quelle commande.

Référence complète : [la documentation de référence](https://champollion.dev/docs/reference/cli)

### Barrière de pré-commit (Pre-commit gate)

`champollion lint` est conçu pour être une barrière de commit : il se termine avec `1` lorsqu'il trouve des chaînes codées en dur destinées aux utilisateurs et avec `0` lorsqu'il n'y en a pas (`--warn-only` signale sans bloquer). Intégrez-le dans un répertoire de hooks suivi dans votre projet :

```bash
mkdir -p .githooks
printf '#!/bin/sh\nnpx --yes champollion@0.5 lint\n' > .githooks/pre-commit   # pinned: a new release never changes what the hook runs
chmod +x .githooks/pre-commit
git config core.hooksPath .githooks   # once per clone
```

Ou déclenchez-le depuis [lint-staged](https://github.com/lint-staged/lint-staged) pour qu'il ne s'exécute que lorsque les fichiers sources sont indexés (staged) :

```json
{
  "lint-staged": {
    "src/**/*.{js,jsx,ts,tsx}": "champollion lint"
  }
}
```

Gardez `champollion sync` en dehors du pre-commit — il effectue des appels d'API réseau, il est donc au mieux lent et au pire bloque les commits hors ligne. Exécutez-le plutôt dans l'intégration continue (CI) ou dans un hook pre-push, avec `champollion audit` / `champollion verify` comme barrière.

## Configuration

Créez `champollion.config.json` ou exécutez `champollion init` :

```json
{
  "version": 3,
  "inputLocale": "en",
  "localesDir": "./locales",
  "model": "google/gemini-3.8-flash",
  "pairs": {
    "en:fr": { "qualityTier": "high" },
    "en:ja": { "method": "google-translate" }
  }
}
```

| Option | Par défaut | Description |
|--------|---------|-------------|
| `inputLocale` | `"en"` | Code de la langue source |
| `localesDir` | `"./locales"` | Chemin vers les fichiers de paramètres régionaux : un fichier par langue (`fr.json`) ou un dossier par langue (`fr/common.json`, i18next) |
| `localesPattern` | `null` | Toute autre disposition, par ex. `"src/i18n/{ns}/{lang}.json"` (remplace `localesDir`) |
| `contentDir` | `null` | Dossier de Markdown/MDX à traduire (un `content/` Hugo ou n'importe quel dossier) ; chaque traduction est écrite à côté de sa source sous la forme `<name>.<locale>.md` |
| `format` | `"auto"` | Format de fichier : `json`, `toml`, `yaml`, ou `auto` |
| `model` | `"google/gemini-3.8-flash"` | Modèle par défaut (identifiant OpenRouter). Les fournisseurs directs résolvent leur propre valeur par défaut à l'exécution. Exécutez `champollion models --method gemini` pour découvrir les modèles disponibles. |
| `defaultMethod` | `"llm"` | Méthode de traduction par défaut (remplacée par l'indicateur `--method`) |
| `batchSize` | `80` | Clés par lot de traduction |
| `pairs` | `{}` | Remplacements de méthode, de modèle et de qualité par paire |

**Remplacements par langue** : Chaque langue possède une [Carte de langue](https://champollion.dev/docs/reference/language-card-spec) — l'une des 50 cartes sélectionnées contenant des préréglages de registre, des systèmes de formalité, des règles de typographie et des indicateurs de prise en charge des méthodes. Les cartes utilisent une [architecture à deux niveaux](https://champollion.dev/docs/concepts/architecture) (exécution + référence) pour des performances à grande échelle. Générez une nouvelle carte avec `node scripts/generate-language-card.mjs <code>`. Utilisez les clés prédéfinies comme raccourcis, ou écrivez un texte de registre personnalisé :

```json
{
  "languages": {
    "fr": "casual-tu",
    "ko": "formal-hapsyo",
    "crk": {
      "name": "Plains Cree",
      "register": "SRO syllabics with grammatical precision.",
      "model": "google/gemini-3.1-pro-preview",
      "batchSize": 5,
      "maxRetries": 5,
      "script": "Cans"
    }
  }
}
```

**Mode sans configuration (Zero-config)** : Pas de fichier de configuration ? Champollion détecte automatiquement les fichiers de localisation, le format et les langues cibles à partir de votre projet.

Les valeurs de langue peuvent être une clé de préréglage (par ex., `"casual-tu"`), un texte de registre personnalisé ou un objet (contrôle total). Les remplacements au niveau de la paire dans `pairs` sont prioritaires sur les paramètres au niveau de la langue. Exécutez `npx champollion init` pour parcourir les préréglages disponibles pour chaque langue.

Consultez la [Référence de la CLI](https://champollion.dev/docs/reference/cli) pour les détails de configuration spécifiques au framework.

## Sortie de la CLI

Lorsque vous exécutez `sync`, champollion affiche exactement ce qui se passe :

```
champollion v0.4.0

[INFO] Detected format: json (auto)
[INFO] Detected framework: Hugo
[INFO] Source: en.json (2847 keys)
[INFO] Pairs: es-MX:llm, fr:deepl, it:llm
Estimated translation cost:

  Pair      Method    Keys  TM hits   Est. Cost
  ────────  ──────  ──────  ───────  ──────────
  en:es-MX  llm       2847        0    ~$0.3843
  en:fr     deepl     2847        0    ~$1.7794
  en:it     llm       2847        0    ~$0.3843

  Total: ~$2.5480
  Rates: google/gemini-3.8-flash $0.30 input / $2.50 output per 1M tokens — OpenRouter's price list, read 2026-10-04 14:02 UTC; deepl $25.00 per 1M characters — the provider's published price, as checked 2026-06-08. An estimate: ~200 input + ~30 output tokens or ~25 characters per key assumed — the bill depends on the real lengths (--json has the detail).

[INFO] Translating 3 locale(s) with concurrency 50
[INFO] es-MX.json — 2847 missing
     ████████████████████████████████ 2,847/2,847 keys
[INFO] fr.json — 2847 missing
     ████████████████████████████████ 2,847/2,847 keys
[INFO] it.json — 2847 missing
     ████████████████████████████████ 2,847/2,847 keys
[OK] Synced 8541 keys total — 8541 key(s) sent to the model, 0 served from the cache (free).
```

La dernière ligne de l'estimation indique le taux auquel chaque chiffre a été évalué, d'où il provient et quand (`--json` contient les détails). « Translating … » n'est affiché que lorsque quelque chose sera envoyé : une exécution à blanc, ou une exécution sans rien à envoyer, indique plutôt qu'elle vérifie les paramètres régionaux. La barre de progression se met à jour sur place à mesure que chaque lot se termine (~80 clés par mise à jour). Lorsque `contentDir` est défini, la synchronisation nomme le dossier et l'endroit où vont ses traductions ; elle affiche `Detected framework: Hugo` uniquement lorsqu'elle trouve un véritable site Hugo (`hugo.toml`, un `config.toml` avec des paramètres Hugo, `archetypes/`, …). La détection de format distingue `(auto)` de `(config)` pour clarifier la façon dont le format a été résolu.

**Modes de sortie** : `--quiet` supprime la sortie informative (erreurs et avertissements uniquement). `--json` émet du NDJSON lisible par machine pour les pipelines CI/CD.

## Renforcement (Hardening)

- **Retrait exponentiel (Exponential backoff)** — 3 tentatives avec gigue (jitter) sur les erreurs 429/5xx
- **Délai d'attente de requête de 30s** — AbortController empêche les blocages
- **Validation de la réponse** — n'accepte que les clés qui ont été envoyées pour traduction
- **Contrôle qualité** — détecte les boucles d'hallucination, les sorties dans le mauvais système d'écriture, l'inflation de la longueur et les répétitions de la source
- **Cascade de tentatives** — en cas d'échec de l'analyse JSON, réessaie par lot → demi-lot → clés individuelles (budget plafonné via `maxRetries`)
- **Mémoire de traduction** — `.champollion/tm.json` met en cache les traductions indexées par texte source + paramètres régionaux + méthode ; les clés inchangées sont servies depuis le cache lors des synchronisations ultérieures, éliminant les appels d'API redondants
- **Mise en cache des prompts** — la séparation des messages système/utilisateur permet la mise en cache au niveau du fournisseur, réduisant le coût en jetons (tokens) sur l'ensemble des lots
- **Application de la terminologie** — les traductions encadrées sont vérifiées par rapport aux termes du dictionnaire après la réponse du LLM
- **Protection contre la pollution de prototype** — bloque `__proto__`, `constructor`, `prototype`
- **Confinement des chemins** — les écritures de fichiers sont validées pour rester dans les répertoires configurés
- **Protection des blocs** — les blocs de code, les shortcodes et le HTML sont protégés lors de la traduction du contenu
- **Architecture à échec explicite (Fail-loud)** — les échecs de traduction lèvent toujours des messages d'erreur exploitables, et n'écrivent jamais silencieusement des données corrompues
- **Vérification post-synchronisation** — la commande `verify` relit les fichiers écrits et confirme que les traductions sont présentes, dans le bon système d'écriture et que les espaces réservés sont intacts
- **Succès partiel** — l'échec d'un lot ne bloque pas le reste

## Tests

```bash
npm test      # all tests
npm run test:unit                # core sync pipeline
npm run test:redteam             # adversarial edge cases
npm run test:format              # TOML/YAML adapters
npm run test:content             # Markdown content parser
npm run test:hugo                # full Hugo E2E
npm run test:lint                # hardcoded string detection
npm run test:pairs               # pair graph resolution
npm run test:methods             # translation method suite
```

**Dépendances minimales** — voir ci-dessus.

## Licence

PolyForm Noncommercial 1.0.0. La CLI Champollion est à code source accessible — gratuite à installer, utiliser et modifier à des fins non commerciales (recherche, éducation, travail communautaire) sous la [Licence PolyForm Noncommercial 1.0.0](../LICENSE) ; son utilisation à des fins commerciales n'est pas couverte par cette licence. En termes simples, avec des exemples — une école, un hôpital ou une clinique publique, une association caritative, un projet personnel ou de recherche sont couverts ; le produit d'une entreprise à but lucratif, comme la vitrine d'un magasin, ne l'est pas : [Qui peut l'utiliser](https://champollion.dev/docs/getting-started/who-may-use-this) (un résumé, pas un avis juridique ; le texte de la licence fait foi). Le paquet npm `champollion` publié est sous PolyForm-Noncommercial-1.0.0 ; `cli/LICENSE` est la licence faisant autorité pour le paquet distribué. Le harnais d'évaluation MT et les spécifications qui l'accompagnent sont open source, sous licence AGPL-3.0-or-later — avec une exception §7 eval-standard-plugin — sur le [dépôt public du harnais](https://github.com/gamedaysuits/Champollion).
