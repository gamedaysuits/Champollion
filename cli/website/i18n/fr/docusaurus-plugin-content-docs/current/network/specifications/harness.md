---
sidebar_position: 2
title: "Eval Harness v2.0"
related:
  - label: "Scoring Specification"
    to: /docs/network/specifications/scoring
    kind: spec
    note: "What the harness metrics feed into"
  - label: "Statistical Significance Testing"
    to: /docs/network/specifications/significance
    kind: spec
  - label: "Method Interface"
    to: /docs/network/specifications/methods
    kind: spec
  - label: "Run Card Specification"
    to: /docs/network/specifications/run-card
    kind: spec
  - label: "Cookbook: Translate 30 Languages"
    to: https://champollion.dev/docs/tutorials/translate-30-languages
    kind: champollion
    note: "Use the harness to audit registers in production"
---

# Eval Harness v2.0

> **Résumé exécutif.** Cette page couvre l'installation, la configuration et l'utilisation du harnais d'évaluation MT — l'outil qui évalue les méthodes de traduction par rapport à des corpus standardisés et produit des cartes de résultats notées. Pour les définitions canoniques des métriques, des schémas et du protocole d'évaluation, consultez la [Spécification de référence](/docs/network/specifications/benchmark).

Le harnais exécute des expériences de traduction et produit des cartes de résultats. Il gère la construction des invites, les appels API, la notation et la sérialisation des résultats — vous fournissez l'ensemble de données et le modèle.

## Installation

**Prérequis :** Python 3.10+

```bash
pip install mt-eval-harness
```

Cela installe la commande `mt-eval`.

## Utilisation

```bash
mt-eval run --corpus path/to/dataset.json
```

Cela exécute chaque entrée du corpus via le modèle configuré (ou le plugin de méthode), note les résultats et écrit un fichier JSON de carte de résultats dans le répertoire de sortie.

## Drapeaux CLI

### `mt-eval run`

| Drapeau | Requis | Par défaut | Description |
|--------|--------|-----------|-------------|
| `--corpus` | ✅ | — | Chemin d'accès au fichier corpus (`.json`, `.jsonl`, `.tsv`) |
| `--source-file` / `--reference-file` | — | — | Fichiers de texte parallèles (FLORES+, format WMT) |
| `-m, --model` | — | `gemini-pro` | Slug du modèle (nom court ou ID OpenRouter complet). Résolu via `shared/model-aliases.json`. Séparé par des virgules pour les exécutions multi-modèles |
| `-d, --dataset` | — | `all` | Filtre d'ensemble de données : `all`, nom de segment ou plage d'ID |
| `--ids` | — | — | ID d'entrée séparés par des virgules à évaluer |
| `--source-lang` | — | `English` | Nom de la langue source |
| `--target-lang` | — | — | Nom de la langue cible |
| `-p, --prompt` | — | `naive` | Version de l'invite (`naive`, `custom`, `champollion`) |
| `--coaching-file` | — | — | Chemin d'accès au fichier texte d'invite de coaching |
| `--coaching` | — | — | Texte de coaching en ligne (chaîne entre guillemets) |
| `--method` | — | — | Chemin d'accès au répertoire du plugin de méthode (contient `method.json` + module Python) |
| `--method-card` | — | — | Chemin d'accès au JSON de la carte de méthode pour les métadonnées du classement |
| `--fst-retries` | — | `0` | Nombre de tentatives de relance FST (méthode LLM par défaut uniquement) |
| `--skip-fst` | — | `false` | Ignorer complètement la porte de qualité FST |
| `--tools` | — | `false` | Activer le mode d'appel d'outils |
| `--tools-list` | — | — | Noms d'outils séparés par des virgules |
| `--max-tool-rounds` | — | `8` | Nombre maximal de tours d'appel d'outils par entrée |
| `--hooks` | — | — | Noms de hooks post-traduction |
| `--style-profile` | — | — | Chemin d'accès à un profil de style JSON. Active les métriques de cohérence du style d'écriture (informatif — jamais partie du score composite ; voir [§ Métriques de style d'écriture et de registre](#writing-style-and-register-metrics-informational)) |
| `-b, --batch-size` | — | `25` | Entrées par appel API |
| `-c, --concurrency` | — | `8` | Appels API parallèles |
| `--max-tokens` | — | `32768` | Jetons max par appel API |
| `--temperature` | — | `0.0` | Température d'échantillonnage (0.0 = déterministe) |
| `--no-cache` | — | `false` | Désactiver la mise en cache des réponses |
| `--cache-dir` | — | `eval/cache/harness` | Chemin d'accès au répertoire de cache |
| `-o, --output-dir` | — | `eval/logs/harness` | Répertoire de sortie pour les cartes de résultats et les journaux |
| `-n, --name` | — | — | Nom de l'exécution lisible par l'homme |
| `--dry-run` | — | `false` | Valider la configuration sans effectuer d'appels API |
| `--champollion-config` | — | — | Chemin d'accès à `champollion.config.json` |
| `--champollion-cards-dir` | — | — | Répertoire des cartes de langue |
| `--target-lang-code` | — | — | Code de langue BCP-47 |

### Toutes les sous-commandes

Les dix-huit sous-commandes de premier niveau, générées à partir de `mt_eval_harness/cli.py`
le 2026-08-01. Jusqu'à cette date, cette section en listait sept, et six —
y compris `node`, le nœud de notation souverain de l'organisateur — n'étaient documentées
**ni ici ni dans le guide du harness**.

**Exécution et notation**

| Sous-commande | Ce qu'elle fait |
|---|---|
| `mt-eval run` | Exécuter une traduction (options ci-dessus) |
| `mt-eval test <log>` | Analyser un journal d'exécution terminé |
| `mt-eval compare <logs…>` | Comparer plusieurs journaux d'exécution |
| `mt-eval dashboard <logs…>` | Générer un tableau de bord HTML interactif |
| `mt-eval card <run-card>` | Formater une fiche d'exécution lisible par l'humain |

**S'orienter vers une méthode**

| Sous-commande | Ce qu'elle fait |
|---|---|
| `mt-eval recommend <src> <tgt>` | Conseils de méthode pour une paire de langues — disponibilité et **preuves citées**, pas un simple classement |
| `mt-eval corpora --source X --target Y` | Lister les corpus d'évaluation disponibles pour une paire |
| `mt-eval list models\|prompts\|datasets` | Lister les ressources disponibles |

**Contribuer**

| Sous-commande | Ce qu'elle fait |
|---|---|
| `mt-eval publish <report>` | Soumettre un TestReport au classement |
| `mt-eval queue` | Exécuter le haut de la file d'attente de calcul communautaire avec votre propre clé — voir [Contribuer au calcul](/docs/network/getting-started/contributing-compute) |
| `mt-eval export` | Empaqueter un TestReport en tant que plugin de méthode Champollion |
| `mt-eval generate-plugin` | Alias pour `export` |
| `mt-eval export-config` | Générer un extrait `champollion.config.json` à partir d'un TestReport |

**Concours, et en organiser un vous-même**

| Sous-commande | Ce qu'elle fait |
|---|---|
| `mt-eval contest` | Gérer les concours d'évaluation — `prepare`, `register`, `create`, `submit`, `submit-hypotheses`, `status`, `list` |
| `mt-eval shared-task` | Regroupement d'éditions de tâches partagées multi-paires : une ligne regroupe les N concours par paire d'une édition de style AmericasNLP et porte ses politiques par défaut. **Regroupement et valeurs par défaut uniquement — chaque barrière reste par concours** |
| `mt-eval node` | **Le nœud de notation de l'organisateur.** Interroger les admissions, filtrer sur le qualificatif public, autoriser selon la politique du concours, noter par rapport aux **références secrètes détenues par l'organisateur**, publier uniquement les scores. C'est la commande derrière [Organiser un concours souverain](/docs/network/sovereignty/run-a-sovereign-contest) et le [Nœud d'évaluation souverain](/docs/network/sovereignty/sovereign-eval-node) — le corpus ne quitte jamais la machine de l'organisateur |

`mt-eval node` possède dix-sept sous-commandes qui lui sont propres, y compris la voie airgap
(`import-bundle`, `export-scores`, `relay`, `egress-check`, `manifest`) et la
cérémonie de garde M-sur-N (`ceremony`, `seal`, `keygen`, `sign-manifest`,
`verify-manifest`, `ledger`). Exécutez `mt-eval node --help` ; les mécanismes
de souveraineté sont décrits sur les deux pages liées ci-dessus.

**Configuration**

| Sous-commande | Ce qu'elle fait |
|---|---|
| `mt-eval setup` | Installer les dépendances optionnelles (métrique neuronale COMET, runtime FST) |
| `mt-eval logout` | Supprimer les identifiants d'authentification stockés |

### Exemples

```bash
# Run with defaults (gemini-pro alias → google/gemini-3.1-pro-preview, naive prompt)
mt-eval run --corpus eval-amh-fra-globalvoices-test-v1

# Coached experiment with coaching file
mt-eval run \
  --corpus eval-amh-fra-globalvoices-test-v1 \
  --model google/gemini-3.1-pro \
  --coaching-file prompts/crk-coaching-v8.txt \
  --temperature 0.0

# Run a custom method plugin with FST retries
mt-eval run \
  --corpus eval-amh-fra-globalvoices-test-v1 \
  --method ./methods/fst-gated-pipeline \
  --fst-retries 3
```

---

## Schéma de la carte de résultats

Chaque expérience produit une **carte de résultats** — un document JSON autonome. La structure de niveau supérieur :

```json
{
  "run_id": "uuid-v4",
  "harness_version": "2.0",
  "model_slug": "google/gemini-3.1-pro",
  "model_id": "gemini-3.1-pro-001",
  "condition": "baseline",
  "timestamp": "2026-06-01T03:22:41Z",
  "elapsed_seconds": 142.7,
  "dataset": { ... },
  "config": { ... },
  "method_card": { ... },
  "system_prompt_sha256": "abc123...",
  "system_prompt_used": "You are a translator...",
  "fingerprint": { ... },
  "scores": { ... },
  "totals": { ... },
  "environment": { ... },
  "results": [ ... ],
  "run_card_hash": "sha256-of-entire-card"
}
```

Consultez la [Spécification de la carte de résultats](/docs/network/specifications/run-card) pour le schéma complet avec chaque champ documenté.

:::info[Schéma faisant autorité]
La [Spécification de référence](/docs/network/specifications/benchmark) est l'unique source de vérité pour le schéma de la carte d'exécution. Pour les définitions de métriques, les poids composites et les niveaux de qualité, consultez la [Spécification de notation](/docs/network/specifications/scoring). Cette page documente l'utilisation du harness ; les spécifications définissent ce que signifient les résultats.
:::

### Blocs clés

**`dataset`** — Identifie quel ensemble de données a été utilisé, y compris son hachage de contenu pour que les résultats soient liés à une version spécifique :

```json
// Example using textbook_dev.json — the 436-entry textbook dev split
{
  "id": "edtekla-dev-v1",
  "version": "1.0",
  "language_pair": "EN→CRK",
  "sha256": "...",
  "entry_count": 436
}
```

**`scores`** — Métriques agrégées pour l'exécution :

```json
// Counts reflect the dataset used (here: textbook_dev.json, 436 entries)
{
  "total": 436,
  "exact_matches": 12,
  "exact_match_rate": 0.0968,
  "fst_accepted": 87,
  "fst_acceptance_rate": 0.7016,
  "chrf_plus_plus": 42.31,
  "errors": 0,
  "avg_latency_seconds": 1.15,
  "median_latency_seconds": 1.02,
  "p95_latency_seconds": 2.34,
  "by_difficulty": { ... },
  "by_provenance": { ... }
}
```

**`totals`** — Suivi de l'utilisation des jetons et des coûts :

```json
{
  "prompt_tokens": 48200,
  "completion_tokens": 3100,
  "reasoning_tokens": 0,
  "cached_tokens": 12000,
  "total_cost_usd": 0.42,
  "cost_per_entry_usd": 0.0034,
  "reasoning_ratio": 0.0
}
```

---

## Métriques de style d'écriture et de registre (informatif) {#writing-style-and-register-metrics-informational}

Le harnais peut évaluer si les traductions correspondent à un **registre** et un **style d'écriture** cibles, via le plugin de métrique `WritingStyleConsistency` (`mt_eval_harness/plugins/writing_style.py`). Une traduction peut être linguistiquement correcte mais dans le mauvais registre — formulation informelle dans un document juridique, passe-partout formel dans une copie marketing — et les métriques de chaîne ne le remarqueront pas. Ces métriques le font.

**Ce qui est mesuré (par entrée) :**

| Métrique | Échelle | Signification |
|----------|--------|-------------|
| `style_register_match` | booléen | La sortie correspond-elle au registre attendu ? La cible provient du champ `register` de l'entrée du corpus (voir [Spécification de référence §2.6](/docs/network/specifications/benchmark)) ou d'un profil de style |
| `style_sentence_length_ratio` | flottant | Longueur moyenne de phrase prédite par rapport à la référence (1.0 = correspondance ; divergence = dérive de style) |
| `style_formality_score` | 0.0–1.0 | Présence de marqueurs formels/informels (pronoms T–V, contractions, …) en utilisant des ressources de marqueurs par langue |

**Agrégat :** `style_consistency_rate` — la fraction d'entrées sans décalage de registre détecté.

Activez une cible personnalisée avec `--style-profile path/to/profile.json` (par exemple, un profil de voix de marque) ; sans elle, le plugin revient aux métadonnées `register` de chaque entrée du corpus le cas échéant.

:::caution[Délimitation honnête]
Ces métriques sont **à titre informatif uniquement** — elles ne font jamais partie du score composite, et la détection de formalité est basée sur des marqueurs (une heuristique), non sur un jugement appris. Traitez-les comme un détecteur de dérive pour le respect du registre, non comme un verdict sur la qualité du style.
:::

---

## Empreinte digitale par rapport au hachage de la carte de résultats {#fingerprint-vs-run-card-hash}

Le harnais produit deux hachages distincts. Ils servent des objectifs différents :

### Empreinte digitale

L'**empreinte digitale** répond à : *« Cette exécution pourrait-elle être reproduite ? »*

Elle hache la combinaison d'entrées qui définissent la configuration de l'expérience — pas les résultats :

- SHA-256 de l'ensemble de données
- Slug du modèle
- Étiquette de condition
- SHA-256 de l'invite système
- Température
- Version du harnais

Deux exécutions avec des empreintes digitales identiques ont utilisé la même configuration. Leurs résultats doivent être comparables (modulo le non-déterminisme de l'API).

### Hachage de la carte de résultats

Le **hachage de la carte de résultats** répond à : *« Ce fichier de résultat spécifique a-t-il été falsifié ? »*

C'est le SHA-256 de l'ensemble du JSON de la carte de résultats (à l'exclusion du champ `run_card_hash` lui-même). Si un champ change — un score, un horodatage, une seule sortie — le hachage se casse.

:::info[Quand utiliser lequel]
Utilisez l'**empreinte** pour regrouper les exécutions comparables (même expérience, exécutions différentes). Utilisez le **hash de la carte d'exécution** pour vérifier l'intégrité d'un fichier de résultat spécifique.
:::

---

## Publication sur le classement

Après avoir terminé une exécution, utilisez `mt-eval publish` pour soumettre la carte de résultats :

```bash
mt-eval publish eval/logs/harness/your-run-card.json
```

Si aucun `--method-card` n'a été fourni lors de l'exécution, `mt-eval publish` lance un assistant interactif (`method_card_wizard.py`) qui vous guide dans la description de votre méthode (nom, classe, outils utilisés, etc.). La sortie de l'assistant est intégrée dans la carte de résultats avant la soumission.

### Inspection manuelle

Les cartes d'exécution sont enregistrées sous forme de fichiers JSON dans le répertoire de sortie (`eval/logs/harness/` par défaut) — inspectez-les là avant de les publier. `mt-eval publish` est le chemin de soumission ; il n'y a pas d'ingestion de carte d'exécution basée sur les PR.

:::note[L'API de soumission et le téléchargement web ne sont pas encore en direct]
Un point de terminaison `POST https://champollion.dev/api/leaderboard/submit` et une interface utilisateur de téléchargement du Leaderboard sont prévus mais **pas encore implémentés**. Jusqu'à leur déploiement, le seul chemin de soumission fonctionnant est `mt-eval publish`.
:::

:::warning[Validation du Leaderboard]
Le leaderboard valide les cartes d'exécution soumises par rapport au registre des ensembles de données. Les soumissions référençant des ensembles de données inconnus, ou avec un `run_card_hash` cassé, sont rejetées.
:::

:::danger[NE PAS ENTRAÎNER sur les données d'évaluation]
Si votre méthode a vu l'ensemble de données d'évaluation au cours du développement — comme données d'entraînement, exemples few-shot, entrées de dictionnaire ou matériel d'ingénierie de prompt — votre soumission sera **disqualifiée**. Consultez [Évaluation MT](/docs/network/leaderboard/rules) pour savoir ce qui constitue une bonne méthode par rapport à une mauvaise.
:::

---

## Voir aussi

- [Évaluation MT](/docs/network/leaderboard/rules) — aperçu, proposition de valeur du classement et conseils sur les bonnes/mauvaises méthodes
- [Ensembles de données d'évaluation](/docs/network/leaderboard/datasets) — format d'ensemble de données, EDTeKLA, FLORES+
- [Spécification de la carte de résultats](/docs/network/specifications/run-card) — le schéma JSON complet
- [Création d'une méthode](/docs/network/specifications/methods) — l'interface de méthode pour créer des méthodes évaluables
- [Classement des méthodes](https://champollion.dev/leaderboard) — scores de référence en direct
- [Spécification de référence](/docs/network/specifications/benchmark) — protocole d'évaluation, format de corpus, schéma de carte de résultats
- [Spécification de notation](/docs/network/specifications/scoring) — SSOT pour les métriques, les poids composites et les niveaux de qualité
