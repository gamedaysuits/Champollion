---
sidebar_position: 4
title: "Spécification de la Carte d'Exécution"
---

# Spécification de la Carte d'Exécution

> **Résumé exécutif.** La carte d'exécution est l'unité atomique de l'évaluation comparative — un document JSON enregistrant la configuration complète, les résultats par entrée et les scores agrégés d'une exécution d'évaluation. Cette page documente le schéma, les champs, le mécanisme d'empreinte et la structure des scores. Consultez la [Spécification d'Évaluation Comparative](/docs/network/specifications/benchmark) pour les définitions canoniques.

La carte d'exécution est l'enregistrement complet d'une seule exécution d'évaluation. Elle contient tout ce qui est nécessaire pour comprendre, reproduire et vérifier l'expérience : configuration, scores, résultats individuels, utilisation des jetons et métadonnées d'environnement.

**Version du schéma :** 2.0

:::info[Schéma faisant autorité]
La [spécification du benchmark](/docs/network/specifications/benchmark) constitue l'unique source de vérité pour le schéma de fiche d'exécution (run card). Pour la définition des métriques et le calcul des scores d'exécution (la métrique principale chrF++, les métriques standard associées, les diagnostics), consultez la [spécification d'évaluation](/docs/network/specifications/scoring). Cette page documente l'implémentation actuelle.
:::

---

## Champs de Niveau Supérieur

| Champ | Type | Description |
|-------|------|-------------|
| `run_id` | `string` | UUID v4 généré au début de l'exécution |
| `harness_version` | `string` | Version sémantique du harnais ayant produit cette fiche (par ex., `2.0`) |
| `model_slug` | `string` | Slug du modèle utilisé pour l'exécution (par ex., `google/gemini-3.1-pro-preview`) |
| `model_id` | `string` | Identifiant résolu du modèle renvoyé par l'API (par ex., `gemini-3.1-pro-001`) |
| `condition` | `string` | Libellé de l'expérience : ce que le harnais écrit est `naive` (son prompt intégré), `coached` (un fichier de coaching l'a remplacé) ou, pour un plugin de méthode, sa classe de méthode ; texte libre, de sorte qu'une fiche créée manuellement peut indiquer `coached-v3` ou `few-shot`. Il ne s'agit pas d'un libellé de qualité (les niveaux de qualité sont obsolètes ; `scores.quality_tier` est null sur chaque nouvelle fiche) |
| `timestamp` | `string` | Horodatage UTC ISO 8601 du début de l'exécution |
| `elapsed_seconds` | `number` | Durée réelle (temps d'horloge) de l'exécution complète |

```json
{
  "run_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "harness_version": "2.0",
  "model_slug": "google/gemini-3.1-pro-preview",
  "model_id": "gemini-3.1-pro-001",
  "condition": "naive",
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
| `api_provider` | `string` | Ce qui a acheminé le texte : le fournisseur d'API pour le chemin LLM propre au harnais (`openrouter`, `openai`, `anthropic`, `gemini`, `local`) ; l'identifiant du moteur pour un moteur de TA (par ex. `google-translate`) ; pour un plugin de méthode, `local` lorsque son opérateur a certifié un transport entièrement local (`--attest-local-transport`), sinon `method-plugin` |
| `temperature` | `number` | Température d'échantillonnage |
| `max_tokens` | `number` | Nombre maximal de tokens par complétion |
| `batch_size` | `number` | Entrées par lot simultané |
| `concurrency` | `number` | Nombre maximal de requêtes API parallèles |
| `coaching_file` | `string` | Chemin vers le fichier de prompt de coaching, s'il est utilisé (l'enregistrement propre au journal d'exécution ; une fiche publiée nomme le coaching par son nom de fichier, ou `inline coaching` pour du texte `--coaching` — jamais un chemin local) |
| `method_path` | `string` | Chemin vers le répertoire du plugin de méthode, s'il est utilisé |
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
    "model": "google/gemini-3.1-pro-preview",
    "temperature": 0.0,
    "batchSize": 25,
    "register": "Formal Plains Cree. Use SRO orthography.",
    "coachingFile": "prompts/crk-coaching-v8.txt",
    "coachingPrompt": null,
    "promptContext": "champollion",
    "qualityTier": null
  }
}
```

`qualityTier` est toujours `null` sur une nouvelle fiche : les niveaux de qualité sont obsolètes. Tous les champs utilisent le format **camelCase** et respectent le schéma canonique MethodConfig (voir [Créer une méthode](/docs/network/specifications/methods)).
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

La liste canonique se trouve dans la [spécification du benchmark §3.8](/docs/network/specifications/benchmark#38-fingerprint). En résumé :

| Composant | Description |
|-----------|-------------|
| `dataset_sha256` | Hash du fichier de jeu de données |
| `model_slug` | Modèle utilisé (pour un moteur de TA ou un plugin de méthode, l'identifiant du moteur ou de la méthode) |
| `condition` | Libellé de la condition de l'expérience |
| `system_prompt_sha256` | Hash du prompt système |
| `temperature` | Température d'échantillonnage |
| `batch_size`, `tools_enabled` | Traitement par lots et utilisation d'outils |
| `harness_version` | Version du harnais |
| `api_provider`, `endpoint_host_sha256`, `max_tokens`, `method_version`, `method_sha256` | Version 2 (harnais 0.2.0 et ultérieur) : le canal, l'hôte du point de terminaison (haché), la limite de tokens, ainsi que la version de la méthode et le hash de son code |
| `method_model`, `method_dependencies_sha256` | Version 2, exécutions de plugins de méthode uniquement : le modèle transmis au plugin (`-m`) et le hash de son `dependencies` déclaré |
| `method_model`, `method_model_sha256` | Version 2, exécutions `--method local-model` uniquement : le modèle chargé (identifiant Hugging Face ou nom de répertoire) et le hash de son contenu (un répertoire) ou sa révision (un identifiant Hugging Face) |

`fingerprint.version` indique la liste selon laquelle une fiche a été hachée.

### `engine_model`

Une exécution d'un moteur de TA qui exécute un modèle qui lui est fourni (`--method local-model -m <model>`) inclut le modèle chargé :

| Champ | Description |
|-------|-------------|
| `given` | Ce que `-m` a indiqué |
| `kind` | `directory` ou `hub` (un identifiant Hugging Face) |
| `id` | L'identifiant Hugging Face, ou le nom du répertoire (jamais son chemin local) |
| `sha256` | Répertoire uniquement : SHA-256 sur une liste de ses fichiers de type `sha256sum` |
| `revision` | Identifiant Hugging Face uniquement : la révision chargée |
| `family`, `backend` | `opus`, `nllb` ou `madlad` ; `transformers` ou `ctranslate2` |
| `decode` | Longueur maximale possible des sorties : la longueur déclarée par le modèle, ou la règle du harnais (`max(64, 4 × source tokens)` nouveaux tokens, plafonnée aux positions du décodeur) |
| `pair_mismatch` | Présent uniquement lorsqu'un modèle de paire OPUS-MT pour une autre paire a été exécuté intentionnellement (`--allow-model-pair-mismatch`) |

`method_config.model` nomme le même modèle (`<id>@<revision>` ou `<directory name>@sha256:<hash>`). Un journal d'exécution `local-model` n'ayant enregistré aucun modèle ne publie rien : la fiche indique `engine_model_unrecorded` et `mt-eval publish` la refuse.

### `method_plugin`

Une exécution de plugin de méthode (`--method <plugin dir>`) inclut également ce qui identifie le plugin, tel que le lanceur l'a enregistré :

| Champ | Description |
|-------|-------------|
| `version` | La version déclarée par `method.json` (`null` lorsqu'aucune n'est déclarée) |
| `code_sha256` | SHA-256 sur les fichiers du plugin (`method.json` et ses fichiers `.py`, un manifeste de style `sha256sum`) |
| `model_given` | Le modèle transmis au plugin avec `-m/--model`, ou `null` |
| `models_called`, `models_basis` | Le ou les modèles que le plugin a déclaré appeler, et si cela a été observé sur ses résultats ou déclaré |
| `dependency_class` | La classe de dépendance déclarée par `method.json` |
| `dependencies` | La liste `dependencies` déclarée par `method.json`, sans le texte libre `notes` |
| `dependencies_sha256` | SHA-256 de la liste déclarée complète (le composant d'empreinte) |

```json
{
  "fingerprint": {
    "hash": "7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069",
    "components": {
      "dataset_sha256": "e3b0c44298fc1c14...",
      "model_slug": "google/gemini-3.1-pro-preview",
      "condition": "naive",
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
| `total` | `number` | Total des entrées évaluées |
| `exact_matches` | `number` | Entrées dont la sortie correspond exactement à la référence absolue (gold standard) |
| `exact_match_rate` | `number` | `exact_matches / total` (0.0–1.0) |
| `fst_accepted` | `number` | **Mots** de sortie acceptés par l'analyseur FST, additionnés sur toutes les entrées (pas un décompte d'entrées). `null` si aucun analyseur FST n'a été utilisé |
| `fst_acceptance_rate` | `number` | Moyenne des taux d'acceptation par entrée (mots acceptés de chaque entrée ÷ son nombre de mots ; une sortie vide compte pour 0), 0.0–1.0. Ce n'est **pas** `fst_accepted` ÷ tous les mots — ce taux de mots agrégé correspond à `corpus_validity_rate` dans le rapport, affiché sur la fiche d'exécution sous « Mots acceptés ». `null` si aucun analyseur FST n'a été utilisé |
| `chrf_plus_plus` | `number` | **La métrique principale et de classement :** chrF++ au niveau du corpus (sacreBLEU chrF, `word_order=2`), 0–100. Son IC bootstrap à 95 % est `confidence_intervals.corpus_chrf` et sa signature `sacrebleu_signatures.chrf` |
| `scoring_standard` | `string` | `"standard/1"` sur chaque nouvelle fiche. Une fiche qui en est dépourvue a été évaluée selon le score composite obsolète (`legacy-composite`) et est vérifiée selon ce mode |
| `primary_metric` | `string` | `"chrf_plus_plus"` |
| `spbleu`, `ter` | `number` | Métriques standard affichées aux côtés de chrF++, jamais combinées (BLEU correspond à `corpus_bleu` au niveau racine de la fiche ; COMET est `comet_score` avec `comet_model`, lorsqu'il est calculé) |
| `sacrebleu_signatures` | `object` | La signature sacreBLEU de chaque métrique sacreBLEU calculée : `chrf` (la métrique principale), `chrf_plain`, `bleu`, `spbleu`, `ter` |
| `confidence_intervals` | `object` | Intervalles de bootstrap à 95 % ; `corpus_chrf` est celui de la métrique principale |
| `composite`, `quality_tier`, `cost_adjusted` | `null` | **Obsolète.** Toujours `null` sur une nouvelle fiche. Une fiche héritée conserve ses valeurs stockées ; une interface qui affiche encore son score composite l'indique comme « composite hérité (obsolète) » |
| `errors` | `number` | Entrées en échec (erreur d'API, délai d'attente dépassé, etc.) |
| `avg_latency_seconds` | `number` | Temps de réponse moyen sur l'ensemble des entrées |
| `median_latency_seconds` | `number` | Temps de réponse médian |
| `p95_latency_seconds` | `number` | 95e centile du temps de réponse |

### `by_difficulty`

Scores ventilés par niveau de difficulté, indexés par niveau (`"1"`–`"5"`, `"0"` pour les éléments non classés). Les champs ne sont **pas** ceux du niveau supérieur : `avg_chrf` et `avg_bleu` représentent la **moyenne par phrase** de chrF++ et BLEU sur les entrées du niveau, tandis que `chrf_plus_plus` et BLEU au niveau supérieur sont calculés au **niveau du corpus** (sur tous les segments à la fois). Il s'agit de deux statistiques distinctes : le score BLEU au niveau du corpus est notamment bien inférieur à la moyenne du BLEU par phrase ; ainsi, une métrique principale à 0,5 à côté d'une valeur de niveau de 10,2 ne constitue pas une contradiction. Comparez les niveaux entre eux, jamais avec la métrique principale.

```json
{
  "by_difficulty": {
    "1": {
      "name": "difficulty_1",
      "count": 20,
      "exact_match_count": 8,
      "miss_count": 12,
      "error_count": 0,
      "avg_chrf": 68.2,
      "avg_bleu": 31.5,
      "avg_latency_s": 0.84,
      "total_cost_usd": 0.0021,
      "plugin_aggregates": {}
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

## `score_caveats`

Présent uniquement lorsque quelque chose restreint la signification des scores. Un score peut être calculé correctement sans pour autant mesurer ce que son libellé indique ; la réserve accompagne donc le chiffre : `mt-eval test`, `mt-eval card`, `mt-eval compare`, le tableau de bord et l'aperçu `mt-eval publish` l'affichent à côté de la métrique principale, et `publish` la stocke ici pour que le classement puisse l'afficher. Cela ne modifie jamais un score : la métrique principale chrF++ est calculée comme d'habitude, et l'avertissement précise ce qui limite sa portée ou celle d'un diagnostic associé.

| Champ | Type | Description |
|-------|------|-------------|
| `kind` | `string` | `train_test_near_twin`, `length_inflation`, `length_deflation`, `source_copy` ou `near_constant_output` |
| `source` | `string` | Qui l'a mesuré : `nmt-forge` ou `mt-eval-harness` |
| `severity` | `string` | `major` (interpréter la métrique principale à travers cette réserve) ou `minor` |
| `message` | `string` | Une seule phrase, de 480 caractères au maximum |

**`train_test_near_twin`**, écrit par nmt-forge. Lorsque `nmt-forge export` (ou `evaluate`) évalue un modèle, il recherche pour chaque ligne de test un jumeau quasi identique dans les données d'entraînement et enregistre le résultat dans les fichiers mt-eval qu'il génère. Le harnais copie cette mesure sur la fiche : `near_twin_rows` sur `n` lignes de test ont un jumeau (`near_twin_share`), et `strict_n` lignes n'en ont aucun. S'il y en a suffisamment, `strict_corpus_chrf` et `strict_corpus_chrf_ci` donnent le score chrF++ sur celles-ci uniquement, ce qui correspond au chiffre de généralisation. `recall_not_translation` est `true` lorsqu'au moins la moitié des lignes possèdent un jumeau. Dès lors, même un score chrF++ de 100 mesure la capacité du modèle à restituer des phrases d'entraînement, et non sa capacité à traduire. Si la vérification de forge n'a pas été exécutée, l'avertissement est `minor` et le signale. Une vérification n'ayant trouvé aucun jumeau n'ajoute aucun avertissement.

**`length_inflation`**, mesuré par le harnais. Il est ajouté lorsque la longueur des sorties dépasse en moyenne de plus de 2× celle de leur référence (la limite d'inflation de [`length_ratio`](/docs/network/specifications/scoring)), ou lorsqu'au moins un quart des entrées évaluées présente ce dépassement. Des exemples few-shot ayant fuité, des notes ou du texte répété gonflent les sorties, et les scores basés sur la référence mesurent alors ce phénomène. Les champs sont `mean_length_ratio`, `inflated_entries` sur `scored_entries`, `ratio_bound` et `share_bound`.

**`length_deflation`**, mesuré par le harnais. C'est le pendant de `length_inflation` : des sorties bien plus **courtes** que leurs références, ce qui indique que des mots ont été omis. Il est ajouté lorsque la longueur des sorties est en moyenne inférieure à 0,5× celle de leur référence (la limite de troncature de [`length_ratio`](/docs/network/specifications/scoring)), ou lorsqu'au moins un quart des entrées évaluées présente ce cas. Certains diagnostics n'évaluent que les mots contenus dans une sortie : l'acceptation FST et l'alternance codique (code-switching). Un système qui omet ce qu'il ne parvient pas à traduire augmente artificiellement ces scores. Lorsque l'exécution comporte l'une de ces métriques, l'avertissement est `major` et invite à ne pas les interpréter comme un gage de qualité face à des exécutions qui traduisent l'intégralité du texte. La métrique principale chrF++ pondère le rappel, elle pénalise donc les mots manquants. Si aucune de ces deux métriques n'est présente (chrF++ et correspondance exacte uniquement), il s'agit d'une note `minor`. Les champs sont `mean_length_ratio`, `short_entries` sur `scored_entries`, `ratio_bound`, `share_bound` et `emitted_only_metrics`.

**`source_copy`**, mesuré par le harnais. Il est ajouté lorsqu'au moins la moitié des sorties évaluées sont des copies de leur source (la casse, les accents et la ponctuation étant ignorés). Les lignes dont la référence est la source elle-même, telles que les noms, sont exclues. Les métriques qui ne comparent pas avec la référence peuvent néanmoins créditer les mots copiés. Les champs sont `copies` sur `considered_entries`, `copy_share` et `share_bound`.

**`near_constant_output`**, mesuré par le harnais. Une même sortie a été fournie pour plusieurs entrées *différentes*. Les sorties et les sources sont comparées sans tenir compte de la casse, de la ponctuation ni des espaces ; les signes diacritiques comptent, car entre deux sorties, ils distinguent les mots. Une sortie constitue une répétition inter-sources lorsqu'au moins 3 sources distinctes l'ont obtenue (5 lorsqu'elle comporte un ou deux mots, car les réponses courtes se répètent légitimement). Une sortie identique à sa propre référence est une réponse correcte et n'est pas comptabilisée. L'avertissement est ajouté lorsque les répétitions couvrent au moins un quart des sources distinctes, et au moins 5 d'entre elles. Il est toujours `major`. Lorsque l'exécution comporte une métrique évaluant une sortie sans sa référence (acceptation FST, alternance codique), le message la nomme : une telle métrique crédite une phrase valide à chacune de ses apparitions. Les champs sont `repeated_sources` sur `considered_sources`, `repeat_share`, `repeated_outputs`, `top_output_sources` et `top_output_words` (la sortie la plus répétée : combien de sources l'ont obtenue, et sa longueur), `share_bound`, `min_repeats`, `min_sources`, `min_sources_short` et `emitted_only_metrics`. Il s'agit uniquement de décomptes : l'avertissement ne contient jamais le texte d'une sortie.

```json
"score_caveats": [
  {
    "kind": "train_test_near_twin",
    "source": "nmt-forge",
    "severity": "major",
    "checked": true,
    "recall_not_translation": true,
    "near_twin_rows": 150,
    "n": 150,
    "near_twin_share": 1.0,
    "strict_n": 0,
    "message": "all 150 test rows have a near-identical twin in the training data — there is no clean subset to score: this score measures recall of training phrases, not translation"
  }
]
```

Le champ se trouve à l'intérieur du JSON de la fiche d'exécution stockée, il ne nécessite donc aucune colonne de base de données. Il ne fait pas partie de l'[empreinte](#fingerprint) : il décrit le résultat, pas l'expérience.

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

- [Évaluation de TA](/docs/network/leaderboard/rules) — vue d'ensemble, valeur pour le classement et recommandations pour les bonnes/mauvaises méthodes
- [Harnais d'évaluation](/docs/network/specifications/harness) — comment exécuter des évaluations et générer des fiches d'exécution
- [Jeux de données d'évaluation](/docs/network/leaderboard/datasets) — format de jeu de données, EDTeKLA, FLORES+
- [Créer une méthode](/docs/network/specifications/methods) — l'interface de méthode et la spécification de fiche de méthode
- [Classement des méthodes](https://champollion.dev/leaderboard) — scores du benchmark en direct
- [Spécification du benchmark](/docs/network/specifications/benchmark) — protocole d'évaluation, format de corpus, schéma de fiche d'exécution
- [Spécification d'évaluation](/docs/network/specifications/scoring) — SSOT pour les métriques et le calcul des scores d'exécution
