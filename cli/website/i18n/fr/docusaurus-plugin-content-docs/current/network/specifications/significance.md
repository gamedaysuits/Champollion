---
sidebar_position: 7
title: "Tests de Signification Statistique"
slug: '/network/specifications/significance'
related:
  - label: "Scoring Specification"
    to: /docs/network/specifications/scoring
    kind: spec
    note: "The scores these tests protect"
  - label: "MT Evaluation Rules"
    to: /docs/network/leaderboard/rules
    kind: doc
  - label: "Benchmark Specification"
    to: /docs/network/specifications/benchmark
    kind: spec
  - label: "Live Leaderboard"
    to: https://champollion.dev/leaderboard
    kind: leaderboard
    note: "Where significance gates what ranks"
---

# Tests de Signification Statistique

> **Statut** : ✅ Livré. Les tests de signification par bootstrap appairé et les intervalles de confiance par bootstrap sont implémentés dans `mt_eval_harness/significance.py` et `mt_eval_harness/confidence.py`, exportés du package, exposés sur la CLI, et couverts par les suites de tests de signification / confiance / scoring.
> **Base de code** : `arena` — intégré dans `tester.py` (intervalles de confiance par exécution) et `compare.py` (signification entre exécutions).
> **Objectif** : Permettre aux chercheurs de déterminer si la différence entre deux exécutions d'évaluation est statistiquement significative ou simplement du bruit.

Cette page documente le **comportement livré** — elle est descriptive, non une liste de tâches.

---

## Pourquoi Cela Importe

Lors de la comparaison de deux exécutions (à titre illustratif : Système A chrF++ 42,96 vs Système B chrF++ 41,80 sur 92 entrées), une différence de point brut ne dit rien en soi sur le fait qu'elle soit réelle ou du bruit. Avec seulement ~92 entrées de test, la variation aléatoire peut facilement produire des variations de 1–2 points. Les experts demandent des tests de signification — le harnais les calcule donc.

---

## Algorithme : Rééchantillonnage Bootstrap Appairé

C'est la méthode standard utilisée par SacreBLEU, MT-Lens et les tâches partagées WMT. Elle est bien comprise par les chercheurs en TA et produit des résultats en lesquels ils ont confiance.

### Fonctionnement

Étant donné deux systèmes A et B évalués sur les mêmes N entrées de test :

1. Calculer la différence métrique réelle : `Δ = metric(A) - metric(B)`
2. Répéter `n_bootstrap` fois (par défaut 1000) :
   a. Échantillonner N entrées **avec remplacement** à partir de l'ensemble de test partagé
   b. Calculer la métrique pour A et B sur cet échantillon bootstrap
   c. Calculer la différence bootstrap : `Δ_boot = metric(A_boot) - metric(B_boot)`
3. La p-valeur = fraction des échantillons bootstrap où `Δ_boot` a le signe opposé à `Δ`
4. Si p-valeur < α (par défaut 0,05), la différence est statistiquement significative

### Propriétés Clés

- **Appairé** : Les deux systèmes sont évalués sur le même échantillon bootstrap, préservant la corrélation au niveau des entrées
- **Non-paramétrique** : Aucune hypothèse sur la distribution des scores
- **Standard** : C'est exactement ce que `sacrebleu --paired-bs` fait en interne

---

## sacrebleu est une Dépendance Obligatoire

sacrebleu est une dépendance obligatoire. Un harnais d'évaluation TA qui ne peut pas calculer chrF++ ou BLEU n'est pas un harnais d'évaluation TA, donc :

1. `sacrebleu>=2.3` est déclaré sous `[project.dependencies]` dans `pyproject.toml` (non `[project.optional-dependencies]`).
2. Il est importé directement dans `tester.py` — `from sacrebleu.metrics import CHRF, BLEU, TER` — sans garde `try/except`.
3. Il est importé directement dans `significance.py`.

Il n'y a aucun chemin conditionnel `HAS_SACREBLEU` nulle part : fonctionner sans sacrebleu n'est pas une configuration supportée.

---

## Implémentation

### 1. sacrebleu comme dépendance obligatoire

`pyproject.toml` déclare `sacrebleu>=2.3` sous `[project.dependencies]`, et `tester.py` l'importe directement :

```python
from sacrebleu.metrics import CHRF, BLEU, TER
```

Il n'y a aucune garde `if HAS_SACREBLEU:` dans `tester.py` — les chemins d'importation conditionnelle ont été supprimés.

---

### 2. Module : `mt_eval_harness/significance.py`

L'implémentation bootstrap appairé de base. Sa surface publique :

```python
"""
Statistical significance testing via paired bootstrap resampling.

Standard method used by WMT shared tasks, SacreBLEU, and MT-Lens.
Compares two runs on the same corpus to determine if the performance
difference is statistically significant.
"""

from __future__ import annotations

import random
from dataclasses import dataclass
from sacrebleu.metrics import CHRF, BLEU


@dataclass
class SignificanceResult:
    """Result of a paired bootstrap significance test."""
    metric_name: str           # e.g., "corpus_chrf", "exact_match_rate"
    system_a_score: float      # Score for system A
    system_b_score: float      # Score for system B
    delta: float               # A - B
    p_value: float             # Two-sided p-value
    n_bootstrap: int           # Number of bootstrap iterations
    confidence_level: float    # 1 - alpha
    significant: bool          # p_value < alpha
    winner: str | None         # "A", "B", or None if not significant
    ci_lower: float            # Lower bound of 95% CI on the delta
    ci_upper: float            # Upper bound of 95% CI on the delta


def paired_bootstrap(
    entries_a: list[dict],
    entries_b: list[dict],
    metric_fn: callable,
    n_bootstrap: int = 1000,
    alpha: float = 0.05,
    seed: int = 12345,
    metric_name: str = "metric",
) -> SignificanceResult:
    """Run paired bootstrap resampling significance test.

    Args:
        entries_a: Per-entry results from system A (from TestReport["entries"])
        entries_b: Per-entry results from system B (must be same length, same IDs)
        metric_fn: Function(list[dict]) -> float that computes the corpus-level
                   metric from a list of entry dicts. Must handle the entry format
                   from TestReport.
        n_bootstrap: Number of bootstrap iterations (1000 is standard)
        alpha: Significance level (0.05 = 95% confidence)
        seed: RNG seed for reproducibility (12345 matches SacreBLEU default)
        metric_name: Human-readable name for the metric being tested

    Returns:
        SignificanceResult with all fields populated.

    Raises:
        ValueError: If entries_a and entries_b have different lengths or IDs.
    """
    ...
```

### 3. Fonctions de métriques intégrées

```python
def exact_match_rate(entries: list[dict]) -> float:
    """Compute exact match rate from a list of entry dicts."""
    non_error = [e for e in entries if not e.get("error")]
    if not non_error:
        return 0.0
    exact = sum(1 for e in non_error if e.get("exact_match"))
    return exact / len(non_error)


def corpus_chrf(entries: list[dict]) -> float:
    """Compute corpus-level chrF++ from a list of entry dicts."""
    chrf = CHRF(word_order=2)
    refs = [e["expected"] for e in entries if e.get("expected", "").strip()]
    hyps = [e["predicted"] if e.get("predicted", "").strip() else "EMPTY"
            for e in entries if e.get("expected", "").strip()]
    if not refs:
        return 0.0
    return chrf.corpus_score(hyps, [refs]).score


def corpus_bleu(entries: list[dict]) -> float:
    """Compute corpus-level BLEU from a list of entry dicts."""
    bleu = BLEU()
    refs = [e["expected"] for e in entries if e.get("expected", "").strip()]
    hyps = [e["predicted"] if e.get("predicted", "").strip() else "EMPTY"
            for e in entries if e.get("expected", "").strip()]
    if not refs:
        return 0.0
    return bleu.corpus_score(hyps, [refs]).score
```

### 4. Intégration dans `compare.py`

`compare.py` effectue une comparaison côte à côte de plusieurs TestReports et exécute des tests de signification entre eux. `significance.py` expédie également `fst_acceptance_rate()` et `composite_score()` (de sorte que les différences FST et composites peuvent être testées pour la signification), `run_significance_tests()` (pilote toutes les métriques sur deux rapports), et `format_significance_table()` (rendu console).

```python
# In compare_reports(), after computing deltas:
if len(reports) == 2:
    sig_results = run_significance_tests(reports[0], reports[1])
    comparison["significance"] = [asdict(r) for r in sig_results]
```

Lorsque plus de 2 rapports sont comparés, les tests de signification par paires s'exécutent pour toutes les paires, indexées par `"(run_a_id, run_b_id)"`.

### 5. Intégration CLI

`mt-eval compare` expose un drapeau `--significance`, avec `--n-bootstrap` pour définir le nombre d'itérations :

```bash
# Compare two runs with significance testing
mt-eval compare report_a.json report_b.json --significance

# Custom bootstrap count
mt-eval compare report_a.json report_b.json --significance --n-bootstrap 5000
```

### 6. Format de sortie

`format_significance_table()` rend la vue console ; les mêmes données sont ajoutées au rapport de comparaison JSON.

**Sortie console :**
```
  Significance Tests (paired bootstrap, n=1000, α=0.05):

  Metric              A         B       Δ      p-value  Sig?
  ─────────────────── ──────── ──────── ─────── ──────── ────
  corpus_chrf         42.96    41.80    +1.16   0.142    No
  exact_match_rate     0.198    0.185   +0.013  0.381    No
  corpus_bleu          6.80     3.81    +2.99   0.018    Yes *
```

**Sortie JSON** (ajoutée au rapport de comparaison) :
```json
{
  "significance": [
    {
      "metric_name": "corpus_chrf",
      "system_a_score": 42.96,
      "system_b_score": 41.80,
      "delta": 1.16,
      "p_value": 0.142,
      "n_bootstrap": 1000,
      "confidence_level": 0.95,
      "significant": false,
      "winner": null,
      "ci_lower": -0.85,
      "ci_upper": 3.12
    }
  ]
}
```

### 7. Intégration du tableau de bord (amélioration optionnelle)

Lorsque les données de signification sont présentes dans le JSON de comparaison, le tableau de bord peut les afficher — une ligne de tableau de comparaison avec des indicateurs de signification (`*` pour p < 0,05, `**` pour p < 0,01). C'est une couche de présentation au-dessus du calcul livré, non une partie de la fonctionnalité de base.

---

## Cas Limites et Validation

1. **Entrées non appariées** : Les deux TestReports doivent avoir les mêmes ID d'entrée. S'ils ne les ont pas (par exemple, l'un s'est exécuté sur un sous-ensemble), testez la signification uniquement sur l'intersection. Avertissez à propos des entrées exclues.

2. **Trop peu d'entrées** : Si N < 10, avertissez que les tests de signification ne sont pas fiables avec si peu d'entrées. Exécutez-les quand même, mais imprimez l'avertissement.

3. **Scores identiques** : Si les deux systèmes produisent des résultats identiques au niveau des entrées, p_value doit être 1,0 (aucune différence du tout).

4. **Métriques de plugin** : Le module de signification doit également tester toute métrique de plugin qui apparaît dans les DEUX rapports. Utilisez une approche générique : si les deux rapports ont `plugin_metrics.crk_fst_validity.avg_fst_validity`, testez-la.

5. **Reproductibilité** : La graine RNG doit être enregistrée dans la sortie pour que les résultats soient exactement reproductibles. Par défaut 12345 (correspondant à la convention SacreBLEU).

---

## Ce qu'il NE FAUT PAS Construire

- **Pas de signification COMET séparée** : COMET est calculé et rapporté dans une **voie neurale séparée** — il n'est **jamais plié dans aucun composite** (le composite est déterministe ; voir [scoring.md §4.3](/docs/network/specifications/scoring#43-weight-tables) et §2). Les IC bootstrap *peuvent* être calculés sur ses scores par entrée mis en cache, mais le harnais n'exécute pas de test de signification appairé intégré pour COMET. Pour la signification COMET par paires entre deux systèmes, utilisez `comet-compare` d'Unbabel.
- **Pas d'analyse bayésienne** : Restez avec le bootstrap fréquentiste. C'est ce que la communauté TA attend et comprend.
- **Pas de correction multi-test** : Lors du test de plusieurs métriques, n'appliquez pas de corrections Bonferroni ou similaires. La convention en évaluation TA est de rapporter les p-valeurs brutes par métrique et de laisser le lecteur interpréter.

---

## Carte des Modules

Où la fonctionnalité livrée réside :

| Fichier | Rôle |
|---|---|
| `pyproject.toml` | `sacrebleu>=2.3` déclaré comme dépendance obligatoire |
| `mt_eval_harness/tester.py` | Importation directe de sacrebleu (pas de garde `HAS_SACREBLEU`) ; calcule les IC par exécution |
| `mt_eval_harness/significance.py` | Noyau bootstrap appairé : `paired_bootstrap`, `SignificanceResult`, fonctions de métriques intégrées, `run_significance_tests`, `format_significance_table` |
| `mt_eval_harness/confidence.py` | Intervalles de confiance bootstrap : `bootstrap_ci`, `compute_all_cis`, `compute_per_tier_cis`, `ConfidenceInterval` |
| `mt_eval_harness/__init__.py` | Exporte `SignificanceResult`, `paired_bootstrap`, `ConfidenceInterval`, `bootstrap_ci`, `compute_all_cis` |
| `mt_eval_harness/compare.py` | Tests de signification intégrés dans la comparaison de rapports |
| `mt_eval_harness/cli.py` | Drapeaux `--significance` / `--n-bootstrap` (comparer) et `--no-ci` / `--n-bootstrap-ci` (tester) |
| `mt_eval_harness/dashboard.py` | Affiche la signification dans le tableau de comparaison (amélioration optionnelle) |
| `tests/test_significance.py`, `tests/test_confidence.py` | Tests unitaires (partie de la suite réussie) |

---

## Couverture de Test

Les suites de signification / confiance / scoring sont au vert. Elles couvrent :

1. **Déterministe avec graine** : mêmes entrées + même graine → même p-valeur, à chaque fois
2. **Test de réponse connue** : deux ensembles de résultats identiques → p_value = 1,0
3. **Test de signification connue** : deux ensembles de résultats où l'un est clairement meilleur (par exemple, tous les correspondances exactes vs tous les ratés) → p_value ≈ 0,0
4. **ID non appariés** : lève `ValueError`, ou avertit et calcule sur l'intersection
5. **Entrées vides** : gérées gracieusement (p_value = 1,0 ou lève)

---

## Intervalles de Confiance (Fonctionnalité Complémentaire)

> **Statut** : ✅ IMPLÉMENTÉ dans `confidence.py`

Les intervalles de confiance (IC) répondent à une question différente des tests de signification :

- **Test de signification** (`significance.py`) : « La différence entre le système A et le système B est-elle réelle ? »
- **Intervalles de confiance** (`confidence.py`) : « Quelle est l'incertitude sur le score de ce système en lui-même ? »

### Implémentation : `confidence.py`

Utilise la même méthode de rééchantillonnage bootstrap par percentile que les tests de signification :

| Paramètre | Valeur | Justification |
|---|---|---|
| `n_bootstrap` | 1000 | Défaut SacreBLEU, convention WMT 2024 |
| `seed` | 12345 | Graine par défaut SacreBLEU pour la reproductibilité |
| `alpha` | 0,05 | Niveau de confiance standard de 95 % |
| Méthode | Bootstrap par percentile | Koehn (2004), Efron (1979) |

### Ce qui Obtient des IC

Les métriques déterministes au niveau du corpus calculées par le harnais :
- `corpus_chrf` (score chrF++)
- `corpus_bleu` (score BLEU)
- `exact_match_rate` (0,0–1,0)
- `fst_acceptance_rate` (lorsque les données FST sont présentes)
- `composite` (lorsque chrF++ et la correspondance exacte sont disponibles)

Les IC sont **également** calculés pour le `comet_score` neuronal, rééchantillonnés à partir de ses scores par entrée mis en cache (pas d'inférence neurale redondante). Avoir un IC ne fait pas de COMET une métrique composite : il est rapporté dans une **voie neurale séparée** et n'est jamais plié dans le composite (voir [scoring.md §4.3](/docs/network/specifications/scoring#43-weight-tables)).

### Drapeaux CLI

```bash
# Default: CIs are computed automatically
mt-eval test run_log.json

# Skip CI computation (faster, for quick iteration)
mt-eval test run_log.json --no-ci

# More bootstrap iterations (more precise, slower)
mt-eval test run_log.json --n-bootstrap-ci 2000
```

### Avertissement pour Petit Échantillon

Lorsque N < 30 entrées, le module émet un avertissement que les IC peuvent avoir une mauvaise couverture. Le bootstrap ne peut pas créer d'information absente de l'échantillon — avec très peu d'entrées, les intervalles seront larges, reflétant correctement l'incertitude élevée.

### COMET (rapporté séparément, jamais composité)

COMET est une **métrique neuronale rapportée de manière indépendante** — elle n'est **jamais intégrée à un composite** (le composite reste déterministe ; voir [scoring.md §4.3](/docs/network/specifications/scoring#43-weight-tables) et §2). Les IC bootstrap *sont* calculés sur ses scores par entrée mis en cache, mais il ne s'agit pas d'une métrique composite « de premier ordre » :
- Modèle : `Unbabel/wmt22-comet-da` (modèle basé sur des références WMT 2022) ; AfriCOMET sélectionné automatiquement pour les langues africaines prises en charge
- Calculée lorsque `unbabel-comet` est installé
- Scores par entrée stockés dans les entrées TestReport ; la valeur du corpus comporte une mise en garde de calibrage pour les langues à faibles ressources
- Recalculée par le vérificateur — une valeur COMET rapportée doit être reproductible
- Dépendance facultative : `pip install mt-eval-harness[comet]`

### Colonnes Supabase

La table `run_cards` porte les colonnes nullables correspondantes (voir [scoring.md §9.1](/docs/network/specifications/scoring)) :
- `comet_score` (`real`) — le score neuronal rapporté séparément, jamais composité
- `corpus_bleu` (`real`)

Les limites des intervalles de confiance sont stockées dans le JSON de la carte d'exécution `scores` sous `confidence_intervals` (selon le schéma de carte d'exécution dans scoring.md §9), non comme colonnes dénormalisées de niveau supérieur.
