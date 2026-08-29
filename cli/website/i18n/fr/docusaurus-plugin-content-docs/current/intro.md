---
sidebar_position: 1
slug: /intro
title: "Introduction"
related:
  - label: "Quick Start"
    to: /docs/getting-started/quick-start
    kind: guide
    note: "Install, configure, and run your first sync"
  - label: "How It Works"
    to: /docs/how-it-works
    kind: doc
    note: "The pipeline behind every translation"
  - label: "Translation Methods"
    to: /docs/guides/translation-methods
    kind: guide
    note: "LLM, Google Translate, coached, plugin — when to use which"
  - label: "The Language Atlas"
    to: /languages
    kind: atlas
    note: "Every language Champollion knows, on the map"
  - label: "Live Leaderboard"
    to: /leaderboard
    kind: leaderboard
    note: "Translation methods, benchmarked in the open"
---

# champollion

Un cadre d'internationalisation entièrement personnalisable. Une seule commande traduit vos fichiers de locale. Une seule configuration contrôle chaque méthode, modèle et paire de langues. Et si les méthodes intégrées ne suffisent pas — construisez la vôtre, testez-la, et déployez-la.

```bash
npx champollion sync
```

champollion détecte automatiquement vos fichiers de locale, leur format et vos langues cibles. Il traduit ce qui manque, ignore ce qui est fait, valide chaque résultat et produit une sortie propre. C'est le point de départ.

:::info[Partie d'un ensemble plus vaste]

Cette CLI est la composante de déploiement de **Champollion** — une infrastructure qui
évalue la traduction automatique pour des langues que personne d'autre n'évalue, et
qui publie ses résultats. Le volet évaluation construit des ensembles de tests d'évaluation et
une cartographie publique indiquant qui peut traduire quoi, avec quelle qualité, sur quels types de textes ;
la CLI est l'endroit où une méthode éprouvée devient un outil que vous pouvez concrètement exécuter.

Une règle façonne l'ensemble : les données linguistiques sont traitées comme des données biologiques, ainsi les
personnes qui fournissent un corpus en détiennent les clés, tout comme pour tout ce qui est évalué
par rapport à celui-ci. La vue d'ensemble — ce qui existe, quelles sont les règles, où vous
vous situez — se trouve dans [Ce qu'est Champollion](/docs/what-is-champollion), et le
volet évaluation se trouve sous [le Réseau](/docs/network/).

:::

---

## Pourquoi ne pas simplement l'écrire vous-même ?

Vous pourriez écrire une boucle rapide qui appelle Google Translate sur chaque clé. La plupart des développeurs le font — cela prend environ 30 lignes. Voici où cela s'effondre :

- **Pas de détection de changement.** Mettez à jour une chaîne anglaise — la traduction reste obsolète à jamais. champollion suit chaque valeur source avec des hachages SHA-256 et ne retraduit que ce qui a changé.
- **Pas de regroupement par lot.** Un appel API par clé signifie 200 clés = 200 allers-retours. champollion regroupe intelligemment (configurable, par défaut 80 clés/lot pour LLM, 128 pour Google).
- **Pas de mise en cache.** Chaque synchronisation retraduit tout. La Mémoire de Traduction de champollion met en cache les traductions par texte source + locale + méthode — réexécuter la synchronisation après un changement d'une seule clé ne traduit que cette clé, pas le fichier entier.
- **Pas de contrôle de qualité.** La traduction automatique hallucine, répète la source ou produit un script incorrect. champollion valide chaque traduction avant de l'écrire — les scripts incorrects, l'inflation de longueur et les échos de source sont détectés et rejetés.
- **Pas de sensibilité au format.** Codé en dur pour JSON ? champollion gère JSON, TOML, YAML et Markdown Hugo (frontmatter + corps) avec détection automatique.
- **Pas de contrôle de méthode.** Chaque paire obtient la même méthode. champollion vous permet d'utiliser Google Translate pour le français, un LLM pour le japonais et un pipeline personnalisé hébergé par la communauté pour le Cree — dans le même fichier de configuration.

champollion est la version de production de ce script.

---

## Ce qui le rend différent

### Chaque méthode est un plugin

La méthode de traduction est **configurable par paire de langues**. Mélangez Google Translate, les LLM, les invites entraînées et les API personnalisées dans le même projet :

```json title="champollion.config.json"
{
  "version": 3,
  "pairs": {
    "en:fr": { "method": "google-translate" },
    "en:ja": { "method": "llm", "model": "google/gemini-2.5-pro" },
    "en:crk": { "methodPlugin": "crk-coached-v1" }
  }
}
```

Le français obtient Google Translate (rapide, bon marché). Le japonais obtient un LLM premium (nuancé). Le Cree des Plaines obtient un plugin entraîné avec des règles de grammaire, des dictionnaires et une validation morphologique. Même commande `sync`. Même contrôle de qualité. Même CLI.

### Voyez ce qui fonctionne

Pensez que votre méthode peut traduire l'anglais vers l'espagnol ? Le turc vers l'azéri ? L'anglais vers le Cree ?

**Construisez-la et testez-la.** Le [harnais d'évaluation](/docs/network/specifications/harness) compagnon évalue n'importe quelle méthode de traduction avec un scoring reproductible et empreinte numérique. Le [classement](/leaderboard) enregistre chaque exécution publiée, afin que tout le monde puisse voir ce qui fonctionne.

Le harnais d'évaluation et le CLI de production partagent la même interface de plugin. Une méthode qui obtient un bon score dans le harnais peut être utilisée en production — si la communauté dont elle sert la langue donne son consentement. Pour les langues autochtones et peu dotées en ressources, ce consentement est important. Voir [Souveraineté des Données](/docs/network/sovereignty/data-sovereignty).

```bash
# Benchmark a method against a real, non-bundled eval corpus
# (GlobalVoices amh->fra, 945 sentences, fetched from source on first run)
pip install mt-eval-harness
export OPENROUTER_API_KEY=sk-or-...   # any OpenRouter-proxied model works
mt-eval run --corpus eval-amh-fra-globalvoices-test-v1 --model gemini-pro --yes

# Use it locally
npx champollion sync
```

Même plugin. Branchez et testez.

### L'ensemble complet des outils

champollion n'est pas seulement `sync`. C'est un pipeline i18n complet :

| Commande | Ce qu'elle fait |
|---------|-------------|
| `sync` | Traduire les clés manquantes et obsolètes (avec vérification post-synchronisation) |
| `watch` | Synchronisation automatique lorsque votre fichier source change |
| `lint` | Analyser le code source pour les chaînes codées en dur |
| `wrap` | Envelopper automatiquement les chaînes codées en dur dans les appels `t()` |
| `audit` | Lister tous les marqueurs de secours `[EN]` des exécutions précédentes |
| `verify` | Vérifier que les traductions sont présentes et correctes (porte CI) |
| `integrity` | Détecter la corruption des espaces réservés, les problèmes d'encodage et l'exhaustivité des pluriels ICU |
| `seo` | Générer les balises hreflang, les sitemaps et le schéma JSON-LD |
| `status` | Afficher la configuration de paire, les plugins et les scores de benchmark |
| `provenance` | Auditer les licences des ressources de traduction |
| `plugin` | Installer, supprimer et lister les plugins de méthode |
| `fonts` | Télécharger les polices web pour les convertisseurs de script PUA |
| `tm` | Gérer le cache de la Mémoire de Traduction (statistiques, effacer, par locale) |
| `xliff` | Exporter/importer XLIFF 1.2 pour examen par traducteur professionnel |

Quatre d'entre elles — `lint`, `sync`, `verify`, `audit` — forment un pipeline CI qui détecte les chaînes codées en dur, les traduit, vérifie l'exactitude et fait échouer la construction si une locale est incomplète.

---

## Le Réseau

Le [Classement des méthodes](/leaderboard) est le tableau des scores — en direct, public et ouvert aux soumissions. Chaque soumission est associée à l'empreinte d'un commit Git, versionnée selon un jeu de données spécifique, et évaluée par le même banc d'essai. Tout le monde peut faire une soumission.

**Que pouvez-vous construire ?** Le harnais prend du JSON. Les plugins prennent du JSON. N'importe quelle méthode qui produit du JSON peut être testée :

| Approche | Exemple |
|----------|---------|
| **LLM entraîné** | Injecter des règles de grammaire et des dictionnaires dans l'invite d'un modèle de pointe |
| **Modèle affiné** | Entraîner un modèle ouvert sur du texte parallèle — simplement pas sur les données d'évaluation |
| **Pipeline contrôlé par FST** | LLM génère → transducteur à états finis valide la morphologie → réessayer |
| **Modèles chaînés** | Le modèle A brouille → Le modèle B post-édite → Le modèle C note |
| **Dictionnaire + LLM** | Forcer les termes connus d'un dictionnaire, laisser le LLM gérer le reste |
| **Évolutionnaire** | Générer des candidats, les noter, muter les meilleurs, répéter |
| **Traduction partielle** | Traduire un échantillon à la main, prouver que votre LLM correspond, auto-traduire le reste |

Affinez les modèles. Déployez des algorithmes évolutionnaires. Testez les réponses des étudiants aux examens de langue. Construisez des tables de recherche. Chaînez trois modèles ensemble. Tant que votre méthode produit du JSON, le harnais la note et le cadre l'exécute.

:::danger[La seule règle]
**Ne pas entraîner sur les données d'évaluation.** Les méthodes exposées à l'ensemble de données de benchmark seront disqualifiées. Affinez sur ce que vous voulez. Simplement pas sur l'ensemble de test.
:::

C'est une invitation ouverte. Si vous travaillez avec une langue peu dotée en ressources — en tant que chercheur, membre de la communauté, étudiant ou simplement quelqu'un qui s'en soucie — construisez une méthode, exécutez le harnais et renforcez le réseau pour tous. Le problème n'est pas résolu. L'infrastructure est là, et elle est ouverte.

**[→ Voir le classement](/leaderboard)**

---

## Prochaines étapes

**Premiers pas :**
- [Installation](/docs/getting-started/installation) — Configurer en 2 minutes
- [Démarrage rapide](/docs/getting-started/quick-start) — Exécuter votre première synchronisation
- [Langues prises en charge](/docs/reference/supported-languages) — Ce qui est disponible prêt à l'emploi

**Personnaliser votre configuration :**
- [Méthodes de traduction](/docs/guides/translation-methods) — Choisir la bonne méthode par paire
- [Mémoire de traduction](/docs/concepts/translation-memory) — Comment la mise en cache vous fait économiser de l'argent
- [Configuration](/docs/getting-started/configuration) — Référence de configuration complète
- [Site multilingue Hugo](/docs/tutorials/hugo-multilingual-site) — Traduction de contenu Markdown

**Pour aller plus loin :**
- [Travailler avec des traducteurs professionnels](/docs/guides/professional-translators) — Flux de travail d'exportation/importation XLIFF
- [Souveraineté des données](/docs/network/sovereignty/data-sovereignty) — Principes autochtones de souveraineté des données : propriété et contrôle communautaires des données linguistiques
- [Soutenir une langue peu dotée](/docs/network/community/low-resource-languages) — Le défi à l'origine de tout
- [Livre de recettes : Pipeline contrôlé par FST](/docs/network/tutorials/fst-gated-pipeline) — Construire un pipeline de décomposition
- [Évaluation de la TA](/docs/network/leaderboard/rules) — Fonctionnement du banc d'essai et du classement
- [Classement des méthodes](/leaderboard) — Scores en direct et soumissions
