---
sidebar_position: 7
title: "Pagsusuri ng Estadistikal na Kabuluhan"
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

# Pagsubok sa Estadistikal na Kabuluhan

> **Katayuan**: ✅ Nailabas. Ang paired bootstrap significance testing at bootstrap confidence intervals ay ipinatupad sa `mt_eval_harness/significance.py` at `mt_eval_harness/confidence.py`, ini-export mula sa package, inilalantad sa CLI, at sakop ng significance / confidence / scoring test suites.
> **Codebase**: `arena` — nakakabit sa `tester.py` (per-run confidence intervals) at `compare.py` (between-run significance).
> **Layunin**: Bigyan ang mga mananaliksik ng paraan upang matukoy kung ang pagkakaiba sa pagitan ng dalawang evaluation run ay estadistikal na makabuluhan o ingay lamang.

Idinodokumento ng pahinang ito ang **nailabas na pag-uugali** — ito ay paglalarawan, hindi listahan ng gagawin.

---

## Bakit Ito Mahalaga

Kapag naghahambing ng dalawang run (halimbawa: System A chrF++ 42.96 vs System B chrF++ 41.80 sa 92 entry), ang raw point difference ay walang sinasabi sa sarili nito kung ito ba ay tunay o ingay lamang. Sa ~92 test entry lamang, madaling makalikha ang random variation ng 1–2 point na pagbabago. Humihiling ang mga eksperto ng significance tests — kaya kinakalkula ito ng harness.

---

## Algorithm: Paired Bootstrap Resampling

Ito ang karaniwang pamamaraang ginagamit ng SacreBLEU, MT-Lens, at WMT shared tasks. Kilala ito ng mga MT researcher at naglalabas ito ng mga resultang pinagkakatiwalaan nila.

### Paano Ito Gumagana

Kung may dalawang system na A at B na sinusuri sa parehong N test entry:

1. Kalkulahin ang aktuwal na metric difference: `Δ = metric(A) - metric(B)`
2. Ulitin nang `n_bootstrap` beses (default 1000):
   a. Mag-sample ng N entry **with replacement** mula sa shared test set
   b. Kalkulahin ang metric para sa parehong A at B sa bootstrap sample na ito
   c. Kalkulahin ang bootstrap difference: `Δ_boot = metric(A_boot) - metric(B_boot)`
3. Ang p-value = bahagi ng mga bootstrap sample kung saan ang `Δ_boot` ay may kabaligtarang sign mula sa `Δ`
4. Kung ang p-value < α (default 0.05), estadistikal na makabuluhan ang pagkakaiba

### Mahahalagang Katangian

- **Paired**: Sinusuri ang parehong system sa parehong bootstrap sample, kaya napapanatili ang entry-level correlation
- **Non-parametric**: Walang palagay tungkol sa distribusyon ng mga score
- **Standard**: Ito mismo ang ginagawa ng `sacrebleu --paired-bs` sa ilalim

---

## Ang sacrebleu ay Hard Dependency

Ang sacrebleu ay hard dependency. Ang MT eval harness na hindi makakakalkula ng chrF++ o BLEU ay hindi MT eval harness, kaya:

1. Idinedeklara ang `sacrebleu>=2.3` sa ilalim ng `[project.dependencies]` sa `pyproject.toml` (hindi `[project.optional-dependencies]`).
2. Direkta itong ini-import sa `tester.py` — `from sacrebleu.metrics import CHRF, BLEU, TER` — nang walang `try/except` guard.
3. Direkta itong ini-import sa `significance.py`.

Walang anumang `HAS_SACREBLEU` conditional path saanman: hindi suportadong configuration ang pagpapatakbo nang walang sacrebleu.

---

## Implementasyon

### 1. sacrebleu bilang hard dependency

Idinedeklara ng `pyproject.toml` ang `sacrebleu>=2.3` sa ilalim ng `[project.dependencies]`, at direkta itong ini-import ng `tester.py`:

```python
from sacrebleu.metrics import CHRF, BLEU, TER
```

Walang mga `if HAS_SACREBLEU:` guard sa `tester.py` — inalis na ang mga conditional import path.

---

### 2. Module: `mt_eval_harness/significance.py`

Ang core paired-bootstrap implementation. Ang public surface nito:

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

### 3. Mga built-in metric function

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

### 4. Integrasyon sa `compare.py`

Gumagawa ang `compare.py` ng side-by-side comparison ng maraming TestReport at nagpapatakbo ng significance testing sa pagitan ng mga ito. Naglalaman din ang `significance.py` ng `fst_acceptance_rate()` at `composite_score()` (upang ma-significance-test ang FST at composite differences), `run_significance_tests()` (nagpapatakbo ng lahat ng metric sa dalawang report), at `format_significance_table()` (console rendering).

```python
# In compare_reports(), after computing deltas:
if len(reports) == 2:
    sig_results = run_significance_tests(reports[0], reports[1])
    comparison["significance"] = [asdict(r) for r in sig_results]
```

Kapag higit sa 2 report ang inihahambing, tumatakbo ang pairwise significance tests para sa lahat ng pares, na naka-key ayon sa `"(run_a_id, run_b_id)"`.

### 5. Integrasyon sa CLI

Inilalantad ng `mt-eval compare` ang `--significance` flag, kasama ang `--n-bootstrap` upang itakda ang bilang ng iteration:

```bash
# Compare two runs with significance testing
mt-eval compare report_a.json report_b.json --significance

# Custom bootstrap count
mt-eval compare report_a.json report_b.json --significance --n-bootstrap 5000
```

### 6. Format ng output

Nire-render ng `format_significance_table()` ang console view; idinaragdag din ang parehong data sa comparison JSON.

**Console output:**
```
  Significance Tests (paired bootstrap, n=1000, α=0.05):

  Metric              A         B       Δ      p-value  Sig?
  ─────────────────── ──────── ──────── ─────── ──────── ────
  corpus_chrf         42.96    41.80    +1.16   0.142    No
  exact_match_rate     0.198    0.185   +0.013  0.381    No
  corpus_bleu          6.80     3.81    +2.99   0.018    Yes *
```

**JSON output** (idinagdag sa comparison report):
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

### 7. Integrasyon sa dashboard (opsyonal na enhancement)

Kapag may significance data sa comparison JSON, maaari itong ipakita ng dashboard — isang row sa comparison-table na may significance indicators (`*` para sa p < 0.05, `**` para sa p < 0.01). Isa itong presentation layer sa ibabaw ng nailabas na computation, hindi bahagi ng core feature.

---

## Mga Edge Case at Validation

1. **Hindi magkatugmang mga entry**: Dapat may parehong entry ID ang dalawang TestReport. Kung wala (hal., tumakbo ang isa sa subset), subukan lamang ang significance sa intersection. Magbigay ng babala tungkol sa mga entry na hindi isinama.

2. **Masyadong kaunting entry**: Kung N < 10, magbigay ng babala na hindi maaasahan ang significance tests sa napakakaunting entry. Patakbuhin pa rin ang mga ito, ngunit i-print ang babala.

3. **Magkakaparehong score**: Kung parehong identical per-entry results ang ginagawa ng dalawang system, dapat 1.0 ang p_value (walang anumang pagkakaiba).

4. **Plugin metrics**: Dapat ding subukan ng significance module ang anumang plugin metrics na lumilitaw sa PAREHONG report. Gumamit ng generic na approach: kung parehong may `plugin_metrics.crk_fst_validity.avg_fst_validity` ang mga report, subukan ito.

5. **Reproducibility**: Dapat i-log sa output ang RNG seed upang eksaktong ma-reproduce ang mga resulta. Gamitin ang default na 12345 (tugma sa convention ng SacreBLEU).

---

## Ano ang HINDI Dapat Buuin

- **Walang hiwalay na COMET significance**: Kinakalkula at iniuulat ang COMET sa isang **hiwalay na neural lane** — **hindi ito kailanman isinasama sa anumang composite** (deterministic ang composite; tingnan ang [scoring.md §4.3](/docs/network/specifications/scoring#43-weight-tables) at §2). *Maaaring* kalkulahin ang Bootstrap CIs mula sa cached per-entry scores nito, ngunit hindi nagpapatakbo ang harness ng built-in paired significance test para sa COMET. Para sa pairwise COMET significance sa pagitan ng dalawang system, gamitin ang `comet-compare` mula sa Unbabel.
- **Walang Bayesian analysis**: Manatili sa frequentist bootstrap. Ito ang inaasahan at nauunawaan ng MT community.
- **Walang multi-test correction**: Kapag sumusubok ng maraming metric, huwag mag-apply ng Bonferroni o katulad na corrections. Ang convention sa MT evaluation ay iulat ang raw p-values bawat metric at hayaan ang mambabasa na mag-interpret.

---

## Module Map

Kung saan matatagpuan ang nailabas na feature:

| File | Papel |
|---|---|
| `pyproject.toml` | Idineklara ang `sacrebleu>=2.3` bilang hard dependency |
| `mt_eval_harness/tester.py` | Direktang sacrebleu import (walang `HAS_SACREBLEU` guard); kinakalkula ang per-run CIs |
| `mt_eval_harness/significance.py` | Paired-bootstrap core: `paired_bootstrap`, `SignificanceResult`, built-in metric fns, `run_significance_tests`, `format_significance_table` |
| `mt_eval_harness/confidence.py` | Bootstrap confidence intervals: `bootstrap_ci`, `compute_all_cis`, `compute_per_tier_cis`, `ConfidenceInterval` |
| `mt_eval_harness/__init__.py` | Nag-e-export ng `SignificanceResult`, `paired_bootstrap`, `ConfidenceInterval`, `bootstrap_ci`, `compute_all_cis` |
| `mt_eval_harness/compare.py` | Significance tests na nakakabit sa report comparison |
| `mt_eval_harness/cli.py` | `--significance` / `--n-bootstrap` (compare) at `--no-ci` / `--n-bootstrap-ci` (test) flags |
| `mt_eval_harness/dashboard.py` | Ipinapakita ang significance sa comparison table (opsyonal na enhancement) |
| `tests/test_significance.py`, `tests/test_confidence.py` | Unit tests (bahagi ng pumapasang suite) |

---

## Saklaw ng Test

Pumapasa ang significance / confidence / scoring suites. Sinasaklaw ng mga ito ang:

1. **Deterministic sa seed**: parehong inputs + parehong seed → parehong p-value, sa bawat pagkakataon
2. **Known-answer test**: dalawang identical result set → p_value = 1.0
3. **Known-significant test**: dalawang result set kung saan malinaw na mas mahusay ang isa (hal., lahat exact matches vs lahat misses) → p_value ≈ 0.0
4. **Hindi magkatugmang IDs**: nagra-raise ng `ValueError`, o nagbababala at kumakalkula sa intersection
5. **Empty inputs**: maayos na hinahandle (p_value = 1.0 o raise)

---

## Confidence Intervals (Kasamang Feature)

> **Katayuan**: ✅ IPINATUPAD sa `confidence.py`

Ang confidence intervals (CIs) ay sumasagot sa ibang tanong kaysa significance testing:

- **Significance testing** (`significance.py`): "Totoo ba ang pagkakaiba sa pagitan ng system A at system B?"
- **Confidence intervals** (`confidence.py`): "Gaano kalaki ang uncertainty sa score ng system na ito sa sarili nito?"

### Implementation: `confidence.py`

Gumagamit ng parehong percentile bootstrap resampling method gaya ng significance testing:

| Parameter | Halaga | Katwiran |
|---|---|---|
| `n_bootstrap` | 1000 | SacreBLEU default, WMT 2024 convention |
| `seed` | 12345 | SacreBLEU default seed para sa reproducibility |
| `alpha` | 0.05 | Standard na 95% confidence level |
| Paraan | Percentile bootstrap | Koehn (2004), Efron (1979) |

### Ano ang Nilalagyan ng CIs

Ang deterministic corpus-level metrics na kinakalkula ng harness:
- `corpus_chrf` (chrF++ score)
- `corpus_bleu` (BLEU score)
- `exact_match_rate` (0.0–1.0)
- `fst_acceptance_rate` (kapag may FST data)
- `composite` (kapag available ang chrF++ at exact match)

Kinakalkula **rin** ang CIs para sa neural `comet_score`, na bino-bootstrap mula sa cached per-entry scores nito (walang redundant neural inference). Ang pagkakaroon ng CI ay hindi ginagawang composite metric ang COMET: iniuulat ito sa isang **hiwalay na neural lane** at hindi kailanman isinasama sa composite (tingnan ang [scoring.md §4.3](/docs/network/specifications/scoring#43-weight-tables)).

### Mga CLI Flag

```bash
# Default: CIs are computed automatically
mt-eval test run_log.json

# Skip CI computation (faster, for quick iteration)
mt-eval test run_log.json --no-ci

# More bootstrap iterations (more precise, slower)
mt-eval test run_log.json --n-bootstrap-ci 2000
```

### Babala sa Maliit na Sample

Kapag N < 30 entry, naglalabas ang module ng babala na maaaring mahina ang coverage ng CIs. Hindi makakalikha ang bootstrap ng impormasyong wala sa sample — sa napakakaunting entry, magiging malalapad ang intervals, na wastong sumasalamin sa mataas na uncertainty.

### COMET (iniulat nang hiwalay, hindi kailanman kino-composite)

Ang COMET ay isang **neural metric na inuulat sa sarili nitong hanay** — **hindi po ito kailanman isinasama sa anumang composite** (pinapanatiling deterministic ang composite; tingnan po ang [scoring.md §4.3](/docs/network/specifications/scoring#43-weight-tables) at §2). *Kinakalkula* po ang mga Bootstrap CI sa mga naka-cache na per-entry score nito, ngunit hindi po ito isang "first-class" na composite metric:
- Modelo: `Unbabel/wmt22-comet-da` (WMT 2022 reference-based model); awtomatikong pinipili ang AfriCOMET para sa mga sinusuportahang wika sa Africa
- Kinakalkula kapag naka-install ang `unbabel-comet`
- Nakaimbak ang mga per-entry score sa mga TestReport entry; ang corpus value ay may kasamang low-resource calibration caveat
- Muling kinukuha ng verifier — dapat ma-reproduce ang iniulat na COMET value
- Opsyonal na dependency: `pip install mt-eval-harness[comet]`

### Mga column ng Supabase

Taglay ng `run_cards` table ang kaukulang nullable columns (tingnan ang [scoring.md §9.1](/docs/network/specifications/scoring)):
- `comet_score` (`real`) — ang hiwalay na iniulat na neural score, hindi kailanman kino-composite
- `corpus_bleu` (`real`)

Iniimbak ang confidence-interval bounds sa loob ng run-card `scores` JSON sa ilalim ng `confidence_intervals` (ayon sa run-card schema sa scoring.md §9), hindi bilang denormalized top-level columns.
