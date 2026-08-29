---
sidebar_position: 4
title: "Spécification de la Carte d'Exécution"
---

# Spécification de la Carte d'Exécution

> **Résumé exécutif.** La carte d'exécution est l'unité atomique de l'évaluation comparative — un document JSON enregistrant la configuration complète, les résultats par entrée et les scores agrégés d'une exécution d'évaluation. Cette page documente le schéma, les champs, le mécanisme d'empreinte et la structure des scores. Consultez la [Spécification d'Évaluation Comparative](/docs/network/specifications/benchmark) pour les définitions canoniques.

La carte d'exécution est l'enregistrement complet d'une seule exécution d'évaluation. Elle contient tout ce qui est nécessaire pour comprendre, reproduire et vérifier l'expérience : configuration, scores, résultats individuels, utilisation des jetons et métadonnées d'environnement.

**Version du schéma :** 2.0

:::info[Schéma Faisant Autorité]
La [Spécification Benchmark](/docs/network/specifications/benchmark) est l'unique source de vérité pour le schéma de la carte d'exécution. Pour les définitions de métriques, les poids composites et les niveaux de qualité, consultez la [Spécification de Notation](/docs/network/specifications/scoring). Cette page documente l'implémentation actuelle.
:::

---

## Champs de Niveau Supérieur

| Champ | Type | Description |
|-------|------|-------------|
| `run_id` | `string` | UUID v4 généré au démarrage de l'exécution |
| `harness_version` | `string` | Version sémantique du harnais qui a produit cette carte (p. ex., `2.0`) |
| `model_slug` | `string` | Slug du modèle utilisé pour l'exécution (p. ex., `google/gemini-3.1-pro`) |
| `model_id` | `string` | Identifiant du modèle résolu retourné par l'API (p. ex., `gemini-3.1-pro-001`) |
| `condition` | `string` | Étiquette d'expérience (p. ex., `baseline`, `coached-v3`, `few-shot`) |
| `timestamp` | `string` | Horodatage ISO 8601 UTC du démarrage de l'exécution |
| `elapsed_seconds` | `number` | Durée d'exécution réelle de l'ensemble de l'exécution |

```json
{
  "run_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "harness_version": "2.0",
  "model_slug": "google/gemini-3.1-pro",
  "model_id": "gemini-3.1-pro-001",
  "condition": "baseline",
  "timestamp": "2026-06-01T03:22:41Z",
  "elapsed_seconds": 142.7
}
```

---

## `dataset`

Identifie l'ensemble de données d'évaluation et l'épingle à une version de contenu spécifique via SHA-256.

| Champ | Type | Description |
|-------|------|-------------|
| `id` | `string` | Identifiant de l'ensemble de données (p. ex., `edtekla-dev-v1`) |
| `version` | `string` | Chaîne de version de l'ensemble de données |
| `language_pair` | `string` | Étiquette d'affichage (p. ex., `EN→CRK`) |
| `sha256` | `string` | Hachage SHA-256 du contenu du fichier d'ensemble de données. Garantit les données exactes utilisées |
| `entry_count` | `number` | Nombre d'entrées dans l'ensemble de données |

```json
// Example using textbook_dev.json — the 436-entry textbook dev split
{
  "dataset": {
    "id": "edtekla-dev-v1",
    "version": "1.0",
    "language_pair": "EN→CRK",
    "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "entry_count": 436
  }
}
```

---

## `config`

La configuration de l'API et du traitement par lots utilisée pour cette exécution.

| Champ | Type | Description |
|-------|------|-------------|
| `api_provider` | `string` | Nom du fournisseur d'API (p. ex., `openrouter`) |
| `temperature` | `number` | Température d'échantillonnage |
| `max_tokens` | `number` | Jetons maximaux par complément |
| `batch_size` | `number` | Entrées par lot concurrent |
| `concurrency` | `number` | Requêtes API parallèles maximales |
| `coaching_file` | `string` | Chemin du fichier d'invite de coaching, s'il est utilisé |
| `method_path` | `string` | Chemin du répertoire du plugin de méthode, s'il est utilisé |
| `fst_retries` | `number` | Nombre de tentatives de réessai FST |

```json
{
  "config": {
    "api_provider": "openrouter",
    "temperature": 0.0,
    "max_tokens": 32768,
    "batch_size": 25,
    "concurrency": 8
  }
}
```

:::info[Les Cartes d'Exécution Publiées Incluent `method_config`]
Lorsqu'une carte d'exécution est publiée via `mt-eval publish`, `publish.py` injecte un bloc `method_config` contenant la MethodConfig canonique à 8 champs. Cela permet une installation sans friction du classement — quiconque peut reproduire la méthode directement à partir de la carte publiée.

```json
{
  "method_config": {
    "model": "gemini-pro",
    "temperature": 0.0,
    "batchSize": 25,
    "register": "Formal Plains Cree. Use SRO orthography.",
    "coachingFile": "prompts/crk-coaching-v8.txt",
    "coachingPrompt": null,
    "promptContext": "champollion",
    "qualityTier": "verified"
  }
}
```

Tous les champs utilisent **camelCase** et suivent le schéma MethodConfig canonique (voir [Construire une Méthode](/docs/network/specifications/methods)).
:::

---

## `system_prompt_sha256` / `system_prompt_used`

| Champ | Type | Description |
|-------|------|-------------|
| `system_prompt_sha256` | `string` | Hachage SHA-256 de l'invite système. Inclus dans l'empreinte |
| `system_prompt_used` | `string` | Le texte complet de l'invite système envoyé au modèle |

Le hachage de l'invite fait partie de l'[empreinte](#fingerprint) — deux exécutions avec des invites différentes auront des empreintes différentes même si tous les autres paramètres correspondent.

---

## `fingerprint`

Un identifiant de reproductibilité. Deux exécutions avec des empreintes identiques ont utilisé la même configuration expérimentale.

| Champ | Type | Description |
|-------|------|-------------|
| `hash` | `string` | Hachage SHA-256 des composants triés |
| `components` | `object` | Les valeurs d'entrée qui ont été hachées |

### Composants de l'Empreinte

| Composant | Description |
|-----------|-------------|
| `dataset_sha256` | Hachage du fichier d'ensemble de données |
| `model_slug` | Modèle utilisé |
| `condition` | Étiquette de condition d'expérience |
| `system_prompt_sha256` | Hachage de l'invite système |
| `temperature` | Température d'échantillonnage |
| `harness_version` | Version du harnais |

```json
{
  "fingerprint": {
    "hash": "7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069",
    "components": {
      "dataset_sha256": "e3b0c44298fc1c14...",
      "model_slug": "google/gemini-3.1-pro",
      "condition": "baseline",
      "system_prompt_sha256": "abc123...",
      "temperature": 0.0,
      "harness_version": "2.0"
    }
  }
}
```

:::info[Empreinte ≠ Hachage de Carte d'Exécution]
L'empreinte identifie la *configuration de l'expérience*. Le `run_card_hash` vérifie l'*intégrité du fichier de résultats*. Consultez [Empreinte vs Hachage de Carte d'Exécution](/docs/network/specifications/harness#fingerprint-vs-run-card-hash) pour plus de détails.
:::

---

## `scores`

Métriques agrégées pour l'ensemble de l'exécution.

### Scores de Niveau Supérieur

| Champ | Type | Description |
|-------|------|-------------|
| `total` | `number` | Nombre total d'entrées évaluées |
| `exact_matches` | `number` | Entrées où la sortie correspondait exactement à l'étalon-or |
| `exact_match_rate` | `number` | `exact_matches / total` (0,0–1,0) |
| `fst_accepted` | `number` | Entrées où l'analyseur FST a accepté la sortie |
| `fst_acceptance_rate` | `number` | `fst_accepted / total` (0,0–1,0). `null` si aucun analyseur FST n'a été utilisé |
| `chrf_plus_plus` | `number` | Score chrF++ au niveau du corpus (0–100) |
| `errors` | `number` | Entrées qui ont échoué (erreur API, délai d'attente, etc.) |
| `avg_latency_seconds` | `number` | Temps de réponse moyen sur toutes les entrées |
| `median_latency_seconds` | `number` | Temps de réponse médian |
| `p95_latency_seconds` | `number` | Temps de réponse au 95e percentile |

### `by_difficulty`

Scores ventilés par niveau de difficulté. Chaque clé (entier 1–5) contient les mêmes champs de métriques que les scores de niveau supérieur.

```json
{
  "by_difficulty": {
    "1": {
      "total": 20,
      "exact_matches": 8,
      "exact_match_rate": 0.40,
      "chrf_plus_plus": 68.2,
      "fst_accepted": 18,
      "fst_acceptance_rate": 0.90
    },
    "2": { ... },
    "3": { ... },
    "4": { ... },
    "5": { ... }
  }
}
```

### `by_provenance`

Scores ventilés par provenance d'entrée. Chaque clé (p. ex., `gold_standard`, `textbook`) contient les mêmes champs de métriques.

```json
{
  "by_provenance": {
    "gold_standard": {
      "total": 80,
      "exact_matches": 10,
      "exact_match_rate": 0.125,
      "chrf_plus_plus": 44.8
    },
    "textbook": { ... }
  }
}
```

---

## `totals`

Suivi de l'utilisation des jetons et des coûts pour l'ensemble de l'exécution.

| Champ | Type | Description |
|-------|------|-------------|
| `prompt_tokens` | `number` | Nombre total de jetons d'entrée sur tous les appels API |
| `completion_tokens` | `number` | Nombre total de jetons de sortie |
| `reasoning_tokens` | `number` | Jetons utilisés pour le raisonnement en chaîne de pensée (dépendant du modèle, 0 pour la plupart des modèles) |
| `cached_tokens` | `number` | Jetons servis à partir du cache d'invite du fournisseur |
| `total_cost_usd` | `number` | Coût total en USD (tel que rapporté par l'API) |
| `cost_per_entry_usd` | `number` | `total_cost_usd / entry_count` |
| `reasoning_ratio` | `number` | `reasoning_tokens / completion_tokens` (0,0–1,0) |

```json
{
  "totals": {
    "prompt_tokens": 48200,
    "completion_tokens": 3100,
    "reasoning_tokens": 0,
    "cached_tokens": 12000,
    "total_cost_usd": 0.42,
    "cost_per_entry_usd": 0.0034,
    "reasoning_ratio": 0.0
  }
}
```

---

## `environment`

Métadonnées d'environnement d'exécution pour la reproductibilité.

| Champ | Type | Description |
|-------|------|-------------|
| `harness_version` | `string` | Version du harnais (reflète le `harness_version` de niveau supérieur) |
| `harness_git_commit` | `string` | SHA du commit Git du harnais au moment de l'exécution |
| `python_version` | `string` | Version de l'interpréteur Python |
| `sacrebleu_version` | `string` | Version de la bibliothèque sacrebleu (utilisée pour la notation chrF++) |
| `os` | `string` | Identifiant du système d'exploitation |

```json
{
  "environment": {
    "harness_version": "2.0",
    "harness_git_commit": "a1b2c3d",
    "python_version": "3.11.9",
    "sacrebleu_version": "2.4.0",
    "os": "macOS-14.5-arm64"
  }
}
```

---

## `results[]`

Le tableau des résultats par entrée. Un objet par entrée d'ensemble de données, dans l'ordre des index.

| Champ | Type | Description |
|-------|------|-------------|
| `entry_id` | `integer` | ID de cette entrée dans le corpus (correspond à `entries[].id`) |
| `source` | `string` | Le texte source qui a été traduit |
| `reference` | `string` | La référence étalon-or du corpus |
| `predicted` | `string` | La sortie réelle de la méthode |
| `exact_match` | `boolean` | Si `predicted` correspond exactement à `reference` après normalisation |
| `entry_chrf` | `number` | Score chrF++ au niveau de la phrase pour cette entrée (0–100) |
| `fst_accepted` | `boolean \| null` | Si l'analyseur FST a accepté la sortie. `null` si aucun analyseur n'a été configuré |
| `fst_analysis` | `string[]` | Chaînes d'analyse FST pour la sortie (tableau vide si non analysé ou rejeté) |
| `difficulty` | `integer` | Niveau de difficulté du corpus (1–5) |
| `provenance` | `string` | Étiquette de provenance du corpus |
| `latency_seconds` | `number` | Temps de réponse pour cette entrée individuelle |
| `usage` | `object` | Utilisation des jetons par entrée : `{ prompt_tokens, completion_tokens, reasoning_tokens }` |
| `error` | `string \| null` | Message d'erreur si cette entrée a échoué. `null` en cas de succès |

```json
{
  "results": [
    {
      "entry_id": 1,
      "source": "Hello",
      "reference": "tânisi",
      "predicted": "tânisi",
      "exact_match": true,
      "entry_chrf": 100.0,
      "fst_accepted": true,
      "fst_analysis": ["tânisi+V+AI+Ind+2Sg"],
      "difficulty": 1,
      "provenance": "gold_standard",
      "latency_seconds": 0.82,
      "usage": {
        "prompt_tokens": 385,
        "completion_tokens": 12,
        "reasoning_tokens": 0
      },
      "error": null
    }
  ]
}
```

---

## `run_card_hash`

| Champ | Type | Description |
|-------|------|-------------|
| `run_card_hash` | `string` | Hachage SHA-256 de l'ensemble de la carte d'exécution JSON, avec le champ `run_card_hash` lui-même défini à `""` lors du hachage |

C'est le sceau de détection de falsification. Le classement recalcule ce hachage lors de la soumission et rejette les cartes où il ne correspond pas.

**Calcul du hachage :**

1. Sérialiser la carte d'exécution en JSON avec `run_card_hash` défini à `""`
2. Calculer SHA-256 de la chaîne sérialisée
3. Définir `run_card_hash` au résumé hexadécimal résultant

```python
import hashlib, json

card["run_card_hash"] = ""
card_json = json.dumps(card, sort_keys=True, ensure_ascii=False)
card["run_card_hash"] = hashlib.sha256(card_json.encode()).hexdigest()
```

:::info[Analyse Détaillée par Entrée]
Les cartes d'exécution publiées remplissent également la table Supabase `run_card_entries`, qui stocke les résultats par entrée pour l'analyse détaillée sur le classement. Cette table est remplie automatiquement lors de `mt-eval publish`.
:::

---

## Voir aussi

- [Évaluation de la Traduction Automatique](/docs/network/leaderboard/rules) — aperçu, valeur du classement et conseils sur les bonnes/mauvaises méthodes
- [Harnais d'Évaluation](/docs/network/specifications/harness) — comment exécuter les évaluations et générer des cartes d'exécution
- [Ensembles de Données d'Évaluation](/docs/network/leaderboard/datasets) — format d'ensemble de données, EDTeKLA, FLORES+
- [Construire une Méthode](/docs/network/specifications/methods) — l'interface de méthode et la spécification de carte de méthode
- [Classement des Méthodes](https://champollion.dev/leaderboard) — scores d'évaluation comparative en direct
- [Spécification d'Évaluation Comparative](/docs/network/specifications/benchmark) — protocole d'évaluation, format de corpus, schéma de carte d'exécution
- [Spécification de Notation](/docs/network/specifications/scoring) — SSOT pour les métriques, les poids composites et les niveaux de qualité
