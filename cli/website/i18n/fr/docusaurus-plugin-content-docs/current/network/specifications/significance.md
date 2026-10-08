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

> **Statut** : ✅ Déployé. Les tests de significativité appariés (randomisation approximative par défaut ; bootstrap apparié sur demande) et les intervalles de confiance par bootstrap sont implémentés dans `mt_eval_harness/significance.py` et `mt_eval_harness/confidence.py`, exportés depuis le paquet, exposés sur la CLI et couverts par les suites de tests de significativité / confiance / scoring.
> **Base de code** : `arena` — intégré dans `tester.py` (intervalles de confiance par exécution) et `compare.py` (significativité entre exécutions).
> **Objectif** : Permettre aux chercheurs de déterminer si la différence entre deux exécutions d'évaluation est statistiquement significative ou s'il s'agit simplement de bruit.

Cette page documente le **comportement livré** — elle est descriptive, non une liste de tâches.

---

## Pourquoi Cela Importe

Lors de la comparaison de deux exécutions (à titre illustratif : Système A chrF++ 42,96 vs Système B chrF++ 41,80 sur 92 entrées), une différence de point brut ne dit rien en soi sur le fait qu'elle soit réelle ou du bruit. Avec seulement ~92 entrées de test, la variation aléatoire peut facilement produire des variations de 1–2 points. Les experts demandent des tests de signification — le harnais les calcule donc.

**Selon la norme de scoring (`standard/1`), le test apparié sur chrF++ est ce qui détermine si une exécution est meilleure qu'une autre.** chrF++ est la métrique principale pré-déclarée ([Spécification de scoring](/docs/network/specifications/scoring#how-runs-are-scored)). BLEU, spBLEU, TER et COMET (lorsque les deux exécutions comportent des scores COMET par segment issus du même modèle) sont testés et affichés comme métriques standards secondaires, et la correspondance exacte ainsi que les taux des plugins comme diagnostics ; aucun d'entre eux ne décide. Cela suit Kocmi et al. (2021, « To Ship or Not to Ship »), qui ont constaté à travers des milliers de jugements humains qu'une différence de métrique associée à sa significativité est ce qui prédit la préférence humaine.

---

## Algorithme : randomisation approximative appariée (par défaut)

`mt-eval compare --significance` utilise le test de **randomisation approximative
appariée (AR)** de Riezler & Maxwell (2005). C'est également le choix par défaut de SacreBLEU pour
comparer des systèmes.

### Fonctionnement

Étant donné deux systèmes A et B évalués sur les mêmes N entrées de test :

1. Calculer la différence observée au niveau du corpus : `Δ = metric(A) - metric(B)`.
2. Répéter `n_trials` fois (1000 par défaut) :
   a. Pour chaque entrée, échanger les sorties de A et B avec une probabilité de ½.
   b. Recalculer la métrique sur le corpus pour les deux piles mélangées.
   c. Enregistrer si `|Δ_shuffled| ≥ |Δ|`.
3. La p-valeur est le niveau de significativité atteint bilatéral :
   `p = (#{|Δ_shuffled| ≥ |Δ|} + 1) / (n_trials + 1)`. Le +1 compte
   l'assignation observée comme un tirage valide, ainsi p n'est jamais exactement égal à 0.
4. Si p < α (0,05 par défaut), la différence est signalée comme significative.

L'intervalle de confiance sur Δ est un intervalle bootstrap par centiles (l'AR produit une
p-valeur, pas un intervalle). Il est calculé sur un flux aléatoire distinct afin de
ne pas perturber les tirages AR.

### Propriétés Clés

- **Un véritable test d'hypothèse :** les permutations sont tirées sous l'hypothèse nulle
  selon laquelle le système ayant produit une entrée donnée n'a aucune importance.
- **Apparié :** les deux systèmes sont comparés entrée par entrée, ce qui préserve
  la corrélation au niveau de l'entrée.
- **Non paramétrique :** il ne fait aucune hypothèse sur la façon dont les scores sont distribués.

### Le bootstrap apparié (disponible, non défini par défaut)

`paired_bootstrap()` implémente le bootstrap apparié de Koehn (2004) : il rééchantillonne
les entrées avec remise et compte combien de fois le signe de Δ s'inverse. Il est
proposé à des fins de comparabilité avec des articles plus anciens, mais il s'agit d'une
heuristique de robustesse de signe, et non d'un niveau de significativité classique au sens des manuels. Sa distribution est centrée sur
le Δ observé et non sur l'hypothèse nulle, de sorte qu'il peut surestimer la significativité par rapport
à l'AR. Sélectionnez-le sur la ligne de commande avec
`mt-eval compare <reports…> --significance --method paired_bootstrap`, ou avec
`method="paired_bootstrap"` dans `run_significance_tests`.

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

L'implémentation de la significativité (randomisation approximative par défaut, bootstrap apparié sur demande). Sa surface publique :

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

`compare.py` effectue une comparaison côte à côte de plusieurs TestReports et exécute des tests de significativité entre eux. `run_significance_tests()` pilote les tests sur deux rapports et `format_significance_table()` les restitue. Chaque résultat porte son `role` : `primary` (chrF++ — l'unique test qui tranche), `secondary` (les autres métriques standards) ou `diagnostic`. Il teste, dans cet ordre :

| Métrique | Rôle | Calculé par rééchantillonnage à partir de |
|---|---|---|
| `corpus_chrf` | principale | statistiques sacreBLEU par segment |
| `corpus_bleu` | secondaire | statistiques sacreBLEU par segment |
| `corpus_spbleu` | secondaire | statistiques sacreBLEU par segment, sur le tokenizer SentencePiece FLORES-200 (spBLEU est le BLEU avec ce tokenizer, le chiffre que rapportent les tableaux FLORES/NLLB). Lorsque le tokenizer est indisponible (aucun `sentencepiece`, ou hors ligne avec le modèle pas encore téléchargé), il est répertorié comme non testé, jamais abandonné silencieusement |
| `corpus_ter` | secondaire | statistiques sacreBLEU par segment. Le TER est un taux d'édition, donc **plus bas est le mieux** : un Δ négatif favorise A |
| `comet_score` | secondaire | les scores COMET par segment que les deux rapports contiennent déjà (leur moyenne est le score système de COMET ; le modèle n'est jamais réexécuté). Répertorié comme non testé, avec le motif, lorsque seule une exécution a été évaluée avec COMET ou que les deux ont utilisé des modèles COMET différents |
| `exact_match_rate` | diagnostic | l'indicateur de correspondance exacte de chaque entrée |
| Taux de plugin dans les deux rapports, ex. `giellalt_fst_validity.avg_fst_validity`, `.corpus_validity_rate`, `.morphological_accuracy`, `code_switching.avg_code_switching_rate`, `hallucination.avg_hallucination_rate` | diagnostic | les résultats propres au plugin par entrée, agrégés de la même façon que le résultat principal |

**Le score composite obsolète n'est pas testé.** Le score composite pondéré et la ligne `segment_composite` qui étaient auparavant testés ici sont retirés par la norme de scoring ([Spécification de scoring §4](/docs/network/specifications/scoring#4-composite-score)). Un JSON de comparaison écrit avant la norme affiche toujours ses lignes `segment_composite` (ou `composite_score`), étiquetées comme composite hérité ne décidant de rien. Lorsqu'un rapport comparé est un rapport hérité, `compare` indique que son composite est retiré et ne le compare pas.

```python
# In compare_reports(), after computing deltas:
if len(reports) == 2:
    sig_results = run_significance_tests(reports[0], reports[1])
    comparison["significance"] = [asdict(r) for r in sig_results]
```

Lorsque plus de 2 rapports sont comparés, des tests de significativité par paires sont exécutés pour toutes les paires : `significance` est alors une liste d'objets `{"pair": [run_a_id, run_b_id], "letters": ["A", "C"], "tests": [...]}`, un par paire, chaque liste `tests` étant structurée comme dans le cas de deux rapports. `letters` sont les lettres des deux exécutions dans le tableau des exécutions, et Δ est la première moins la seconde.

En plus de `significance`, le JSON de comparaison contient `significance_settings` : le `method`, `n_resamples`, `alpha`, `seed`, à quelle exécution correspond chaque lettre (`runs`), ce que sont `ci_lower`/`ci_upper`, `multiple_testing_correction: "none"`, combien de métriques ont été testées par paire et sur combien de paires, la note explicative en langage clair sur les p-valeurs non corrigées (ci-dessous), ainsi que toutes les remarques soulevées par les tests (entrées exclues d'un appariement, métriques non testées).

### 5. Intégration CLI

`mt-eval compare` expose un flag `--significance`, avec `--method` pour choisir le test apparié (`approximate_randomization`, par défaut, ou `paired_bootstrap`) et `--n-bootstrap` pour définir le nombre d'itérations :

```bash
# Compare two runs with significance testing
mt-eval compare report_a.json report_b.json --significance

# The Koehn (2004) paired bootstrap instead of approximate randomization
mt-eval compare report_a.json report_b.json --significance --method paired_bootstrap

# Custom resampling count
mt-eval compare report_a.json report_b.json --significance --n-bootstrap 5000
```

`compare` prend les fichiers `*_report.json` que `mt-eval run` écrit (ou les journaux d'exécution, dont il utilise le rapport associé). Il affiche le tableau des exécutions avec une ligne par métrique et une colonne par exécution, puis le tableau de significativité, et écrit le JSON de comparaison dans un emplacement neutre à moins que `-o` ne spécifie un autre fichier : `comparison-<hash>.json` à côté des rapports lorsqu'ils partagent un dossier, sinon dans `comparisons/` dans leur dossier commun le plus proche (les rapports situés dans le dossier propre à chaque exécution, comme les dossiers `mcp-run-<id>/` de `run_benchmark`, ne reçoivent jamais de comparaison écrite dans l'un d'eux). Le `<hash>` correspond aux dix premiers caractères hexadécimaux d'un sha256 sur les identifiants des exécutions comparées dans l'ordre fourni, de sorte qu'une autre comparaison dans le même dossier n'écrase jamais celle-ci ; comparer à nouveau les mêmes exécutions réécrit leur propre fichier. Nommer un fichier avec `-o` remplace tout ce qui s'y trouve, et la sortie l'indique. Elle affiche le chemin où elle a écrit. Une comparaison d'exécutions sur un corpus local uniquement, scellé ou soumis à consentement cite leurs phrases, elle porte donc la marque de ce corpus dans un fichier annexe (sidecar) `<file>.champollion.json` où qu'elle soit écrite.

La colonne **Avg latency (s/entry)** du tableau des exécutions indique `—` pour une exécution qui n'a pas enregistré de temps, avec une note sous le tableau en expliquant la raison : chaque entrée provenait du cache, les sorties ont été produites en dehors du harnais, ou la méthode n'en a rapporté aucun. Une valeur inférieure à 0,01 s est affichée avec quatre décimales (un petit modèle sur un processeur décode une phrase en quelques millisecondes), et n'est jamais arrondie à 0,00.

### 6. Format de sortie

`format_significance_table()` rend la vue console ; les mêmes données sont ajoutées au rapport de comparaison JSON.

Les rapports sont identifiés par une lettre dans l'ordre fourni : la première est l'exécution **A**, la deuxième **B**, puis **C**, **D** et ainsi de suite, les mêmes lettres que dans le tableau des exécutions ci-dessus. Chaque tableau par paires nomme ses deux exécutions par ces lettres et leurs identifiants d'exécution, par exemple `--- A (baseline) vs C (nllb-ft) ---`, et ses colonnes ainsi que Δ utilisent les mêmes lettres (`Δ (A−C)`). Δ est toujours **première − seconde**. L'explication du tableau et chaque note en dessous sont affichées **une seule fois**, quel que soit le nombre de paires. Chaque ligne affiche également l'**IC à 95 % sur Δ** : l'intervalle bootstrap par centiles dans `ci_lower`/`ci_upper` du JSON, qui indique l'ampleur plausible de la différence, et pas seulement son signe. Chaque métrique est indiquée avec son sens d'optimisation issu du registre des métriques (↑ plus élevé est meilleur, ↓ plus bas est meilleur), et une colonne **Better** nomme l'exécution ayant le meilleur score, en tenant compte du sens, avec `(n.s.)` lorsque la différence n'est pas significative. Ainsi, un taux où « plus bas est meilleur » comme le TER, l'alternance codique ou l'hallucination qui a augmenté affiche un Δ positif avec **B** comme meilleure exécution, et un modèle entraîné passé en second qui dépasse sa référence de 63,5 chrF++ affiche Δ −63,52 avec **B** meilleur. Une métrique dont le registre ne déclare pas le sens est affichée avec `?`. Les scores, Δ et l'intervalle sont affichés avec deux décimales, et avec davantage (jusqu'à six) sur une ligne où cela masquerait une différence réelle : un spBLEU de 0,0684 contre 0,0673 affiche Δ +0,0011 [+0,0001, +0,0021], jamais +0,00 [+0,00, +0,00] à côté de **Yes**, et le tableau indique que ces lignes comportent plus de décimales. Le JSON conserve quatre décimales, et quatre chiffres significatifs pour une valeur non nulle plus petite que cela, de sorte qu'une différence réelle n'est jamais enregistrée comme 0. Des sorties identiques donnent un Δ exactement égal à 0 et p = 1, elles ne sont donc jamais significatives. Si p descend en dessous de α alors que l'intervalle bootstrap sur Δ est exactement [0, 0] (trop peu de segments diffèrent pour estimer la différence), **Sig?** affiche `?†` et **Better** `—†`, avec une note : aucune exécution n'est désignée comme meilleure sur ce point. Pour un taux de plugin où « plus bas est meilleur », la clé JSON `winner` tient également compte du sens (le taux le plus bas l'emporte), comme cela a toujours été le cas pour `corpus_ter` ; un taux de plugin sans sens d'optimisation (neutre, tel que `morph_coverage`, ou non déclaré) a `winner: null`. Chaque résultat porte également son `direction`.

**Sortie console** (chiffres indicatifs) :
```
  Significance Tests (paired approximate randomization, n=1000, α=0.05):
  Each table names its two runs by their letters in the run table above.
  Δ = first run − second run.  ↑ higher is better, ↓ lower is better.
  Better = the run with the better score, by the metric's direction; (n.s.) = not significant.
  95% CI on Δ = bootstrap percentile interval: how large the difference plausibly is.

  --- A (baseline) vs B (coached) ---

  Metric                                          A        B  Δ (A−B)      95% CI on Δ  p-value  Sig?  Better
  ---------------------------------------- -------- -------- -------- ---------------- -------- -----  --------
  ↑ corpus_chrf                               42.96    41.80    +1.16   [-0.85, +3.12]    0.142    No  A (n.s.)
  ↑ corpus_bleu                                6.80     3.81    +2.99   [+0.61, +5.40]    0.018 Yes *  A
  ↑ corpus_spbleu                              9.10     6.42    +2.68   [+0.35, +5.02]    0.027 Yes *  A
  ↓ corpus_ter                                61.20    64.90    -3.70   [-7.05, -0.41]    0.030 Yes *  A
  ↑ exact_match_rate                           0.20     0.19    +0.01   [-0.03, +0.05]    0.381    No  A (n.s.)
  ↓ code_switching.avg_code_switching_rate     0.60     0.08    +0.52   [+0.45, +0.59]    0.001 Yes *  B

  p-values are per metric and uncorrected — no multiple-testing correction is
  applied (deliberately: the MT convention is to report each metric's own
  p-value). 6 metrics were tested, so one "significant" result at p<0.05 can
  turn up by chance alone. And a small Δ can be significant yet not
  meaningful: check the CI on Δ (how large the difference plausibly is) and
  how reliable the metric is for this language before acting on it.
```

Dans cet exemple, le verdict est **aucune différence significative** : chrF++, la métrique principale, ne sépare pas A et B (p = 0,142), donc aucune exécution n'est désignée comme meilleure — même si BLEU, spBLEU et TER favorisent A et que l'alternance codique favorise B. Ces lignes sont affichées, et le lecteur peut vouloir les examiner, mais elles ne tranchent pas. Le tableau liste chrF++ en premier, puis les autres métriques standards, et enfin les diagnostics.

Avec plus de deux exécutions, les tableaux `--- X (run) vs Y (run) ---` se succèdent sous l'en-tête unique, et la note comptabilise chaque test effectué (`6 metrics were tested per pair (36 tests over 6 pairs)`).

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
      "ci_upper": 3.12,
      "method": "approximate_randomization",
      "direction": "higher",
      "role": "primary"
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

4. **Métriques de plugin** : Un taux de plugin qui apparaît dans les DEUX rapports n'est testé qu'à partir des valeurs par segment que le rapport contient réellement. Cela signifie l'agrégation propre au plugin sur ses résultats par entrée (la métrique FST), ou la moyenne de la valeur par entrée qu'un agrégat `avg_<name>` moyenne (les métriques comportementales). Un taux de plugin sans valeurs par segment est répertorié comme non testé, jamais affiché comme 0,00 vs 0,00. Les décomptes tels que `total_words_checked` ne sont pas testés.

5. **Reproductibilité** : La graine RNG doit être enregistrée dans la sortie pour que les résultats soient exactement reproductibles. Par défaut 12345 (correspondant à la convention SacreBLEU).

---

## Ce qu'il NE FAUT PAS Construire

- **Pas de ré-inférence COMET dans le test** : COMET est testé par paires à partir des scores par segment que les deux rapports contiennent déjà ; le modèle n'est jamais réexécuté par rééchantillonnage. Deux exécutions évaluées avec des modèles COMET différents ne sont pas testées l'une contre l'autre.
- **Pas d'analyse bayésienne** : S'en tenir au bootstrap fréquentiste. C'est ce que la communauté de la TA attend et comprend.
- **Pas de correction pour tests multiples** : Lors du test de plusieurs métriques, n'appliquez pas de corrections de type Bonferroni ou similaires. La convention dans l'évaluation de la TA consiste à rapporter les p-valeurs brutes par métrique et à laisser le lecteur interpréter. `mt-eval compare` **le précise** dans sa sortie et dans `comparison.json` (`significance_settings.multiple_testing_correction: "none"` avec une note explicative en clair) : lorsque plusieurs métriques sont testées, un résultat à p < 0,05 peut survenir par simple hasard, et un petit Δ peut être significatif sans avoir d'importance pratique ; lisez donc l'IC sur Δ et la fiabilité de la métrique pour la langue avant d'agir sur un simple statut « significatif ».

---

## Clusters de classement {#ranking-clusters}

> **Statut** : ✅ Déployé, pour les compétitions. Le classement d'une compétition est un ensemble de **clusters**, et non un ordre strict — le test de significativité décide quelles entrées voisines sont réellement distinguables. Cette section décrit ce qui est déployé, y compris lorsque le niveau de preuve est plus faible qu'un test apparié.

### Chaînage adjacent, numérotation de compétition

Les entrées sont d'abord partitionnées par **catégorie** (track) — un système `constrained` n'est jamais classé contre un système `unconstrained`, et chaque catégorie comporte son propre ordonnancement, ses groupes d'ex æquo et ses plages de rangs, de sorte que « rang 1 » signifie toujours le rang 1 *au sein d'une catégorie*.

Au sein d'une catégorie, les entrées sont classées par la métrique principale de la compétition (chrF++, sauf si la compétition en a enregistré une différente), puis par les métriques de surface restantes et enfin par date de soumission la plus ancienne. Chaque paire **adjacente** dans cet ordre est testée. Une paire que le test ne peut pas séparer partage un rang, et les rangs partagés **se chaînent** : si A est ex æquo avec B et B ex æquo avec C, tous trois se retrouvent dans un même groupe d'ex æquo, même si A et C n'ont jamais été comparés directement.

Les rangs utilisent la numérotation de compétition — une égalité à trois en tête est `1, 1, 1` et l'entrée suivante est `4` ; une égalité à deux pour la deuxième place est `1, 2, 2, 4`.

**La limite honnête du chaînage** : la non-significativité n'est pas transitive. Une longue chaîne peut relier deux entrées qu'un test direct *séparerait*. C'est pourquoi un cluster est indiqué sous forme de **plage** et non de point.

### Plages de rangs

Chaque entrée comporte `rank_min` et `rank_max` — la meilleure et la pire position cohérentes avec les données probantes, selon le style utilisé par WMT pour ses plages de rangs. Une entrée seule dans son cluster a `rank_min == rank_max`. Une entrée au sein d'un cluster de quatre couvrant les positions 2 à 5 porte `rank_min: 2, rank_max: 5`, et **aucune entrée à l'intérieur de ce cluster n'est « devant » une autre**. Isoler un rang à valeur unique hors d'un cluster constitue une mauvaise interprétation du résultat.

### L'échelle des niveaux de preuve

Chaque paire ne pouvant pas être testée de la même manière, chaque paire enregistre l'échelon dont le verdict est réellement issu. Le label fait partie intégrante du résultat et n'est jamais omis :

| Échelon | Données probantes | Quand il est disponible | Robustesse |
|---|---|---|---|
| 1 | **Test apparié par segment** — randomisation approximative par défaut, bootstrap apparié sur demande (l'algorithme décrit ci-dessus) | Uniquement lorsque les DEUX entrées disposent d'un ensemble complet et aligné de scores par segment | Le véritable test |
| 2 | **Chevauchement de l'IC bootstrap à 95 %** sur les bornes d'intervalle publiées | Lorsque la métrique principale possède des bornes d'intervalle de confiance pour les deux entrées (c'est le cas de chrF++ ; BLEU et COMET n'ont pas de colonnes d'intervalle) | Une approximation prudente — le chevauchement d'intervalles ne **prouve pas** l'équivalence, et l'absence de chevauchement constitue une barre plus stricte qu'un test apparié |
| 3 | **Égalité ponctuelle** à l'arrondi d'affichage de la métrique | Toujours | L'échelon le plus faible : il indique seulement que les deux nombres affichés sont identiques |

### Compétitions scellées : l'échelon 1 s'exécute sur le nœud

L'échelon 1 nécessite des scores par segment pour les deux systèmes. Dans une compétition scellée, le nœud d'évaluation de l'organisateur détient les références et **n'exporte jamais de sorties par segment**. C'est là tout l'intérêt de la voie scellée, et ce paramètre ne peut pas être assoupli. Le test apparié se déplace donc vers les données.

`mt-eval node verdicts` exécute le test apparié propre à la compétition sur le nœud, sur les références scellées et chaque paire d'entrées qu'il a évaluée, et n'écrit **que les verdicts** : pour chaque paire, la méthode, la p-valeur, la différence de score, son intervalle de confiance et le nombre de segments. Aucun segment, référence ou traduction ne figure dans le fichier. Le nœud le signe avec sa clé score-sign. L'organisateur clôture ensuite avec `mt-eval contest close --node-verdicts <file> --verify-key <node public key>`. Le classement n'utilise les verdicts que si la signature est vérifiée et qu'ils ont été calculés pour cette compétition, son jeu scellé, sa métrique, sa politique d'ex æquo figée et la version promise du harnais. Dans le cas contraire, la clôture est refusée.

Quand aucun verdict n'est fourni, les ex æquo d'une compétition scellée reposent sur le chevauchement des intervalles de confiance là où la métrique en dispose, et sur l'égalité ponctuelle là où elle n'en a pas. Ses clusters sont alors plus larges que ne le seraient ceux d'un test apparié. Le classement lui-même précise quel cas s'applique : `ranking_method.evidence_used` nomme les échelons réellement utilisés, et `ranking_method.node_verdicts` nomme le nœud dont les verdicts ont été utilisés, le cas échéant.

### Ce que le classement ne classe pas

- **Les entrées contrastives** sont rapportées dans leur propre section et ne gagnent jamais.
- **Le temps d'exécution, le matériel et le coût** figurent sur la fiche d'exécution (run card) et sont rapportés, jamais classés. Il n'existe pas de catégorie d'efficacité.
- **Le jugement humain** ne figure pas du tout dans ces classements. Une *sélection* pour évaluation humaine — les systèmes qu'un budget fixe permettrait de couvrir, en retenant des groupes d'ex æquo complets pour ne jamais couper un cluster en deux — peut être enregistrée pour une compétition clôturée, mais aucune notation n'existe ; voir les [Règles d'évaluation de la TA](/docs/network/leaderboard/rules#verification-tiers).

---

## Carte des Modules

Où la fonctionnalité livrée réside :

| Fichier | Rôle |
|---|---|
| `pyproject.toml` | `sacrebleu>=2.3` déclaré comme dépendance stricte |
| `mt_eval_harness/tester.py` | Importation directe de sacrebleu (aucun garde `HAS_SACREBLEU`) ; calcule les IC par exécution |
| `mt_eval_harness/significance.py` | Tests appariés (`paired_approximate_randomization`, par défaut, et `paired_bootstrap`), `SignificanceResult`, fonctions de métriques intégrées (chrF++, BLEU, spBLEU, TER, COMET à partir des scores par segment mis en cache, correspondance exacte ; le composite au niveau du segment retiré n'est conservé que pour lire les anciens fichiers de comparaison), `run_significance_tests`, `format_significance_table` |
| `mt_eval_harness/confidence.py` | Intervalles de confiance bootstrap : `bootstrap_ci`, `compute_all_cis`, `compute_per_tier_cis`, `ConfidenceInterval` |
| `mt_eval_harness/__init__.py` | Exporte `SignificanceResult`, `paired_bootstrap`, `ConfidenceInterval`, `bootstrap_ci`, `compute_all_cis` |
| `mt_eval_harness/compare.py` | Tests de significativité intégrés dans la comparaison de rapports |
| `mt_eval_harness/cli.py` | Flags `--significance` / `--method` / `--n-bootstrap` (comparer) et `--no-ci` / `--n-bootstrap-ci` (tester) |
| `mt_eval_harness/dashboard.py` | Présente la significativité dans le tableau de comparaison (amélioration optionnelle) |

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
- `fst_acceptance_rate` (lorsque des données FST sont présentes)


L'intervalle de chrF++ fait partie du résultat principal publié (`chrF++ 47.5 [45.9, 49.0]`). Les IC sont **également** calculés pour `comet_score`, bootstrappés à partir de ses scores par entrée mis en cache (pas d'inférence neuronale redondante). Aucun IC composite n'est calculé pour les nouvelles exécutions ; l'IC composite stocké d'une fiche héritée n'est recalculé que lorsque cette fiche est vérifiée.

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

### COMET (une métrique standard lorsqu'elle est calculée, aux côtés de chrF++)

COMET est une **métrique neuronale affichée aux côtés du résultat principal chrF++** chaque fois qu'elle a été calculée, avec son identifiant de modèle. Elle n'est jamais combinée avec chrF++, et elle ne constitue pas le résultat principal car elle nécessite un modèle volumineux et n'est pas étalonnée pour la plupart des langues à faibles ressources (voir la [Spécification de scoring §2.3](/docs/network/specifications/scoring#2-metric-inventory)). Les IC bootstrap sont calculés sur ses scores par entrée mis en cache :
- Modèle : `Unbabel/wmt22-comet-da` (modèle basé sur références du WMT 2022) ; AfriCOMET est sélectionné automatiquement pour les langues africaines prises en charge
- Calculé lorsque `unbabel-comet` est installé
- Scores par entrée stockés dans les entrées du TestReport ; la valeur pour le corpus comporte un avertissement sur l'étalonnage pour les langues à faibles ressources
- Recalculé par le vérificateur — une valeur COMET rapportée doit pouvoir être reproduite
- Dépendance optionnelle : `python3 -m pip install 'mt-eval-harness[comet]'` (ou `mt-eval setup --comet`)

### Colonnes Supabase

Le tableau `run_cards` contient les colonnes correspondantes pouvant être nulles (voir [scoring.md §9.1](/docs/network/specifications/scoring)) :
- `chrf_plus_plus`, `chrf_ci_lower`, `chrf_ci_upper` (`real`) — le résultat principal et son intervalle à 95 %
- `comet_score` (`real`) — affiché à côté du résultat principal, jamais combiné
- `corpus_bleu` (`real`)

L'ensemble complet des intervalles de confiance est stocké dans le JSON `scores` de la fiche d'exécution sous `confidence_intervals` (conformément au schéma de fiche d'exécution dans scoring.md §9) ; seules les bornes de chrF++ sont également dénormalisées sous forme de colonnes.
