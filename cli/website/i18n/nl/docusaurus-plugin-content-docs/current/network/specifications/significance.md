---
sidebar_position: 7
title: "Statistische significantietoetsing"
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

# Statistische Significantietesting

> **Status**: ✅ Geïmplementeerd. Paired bootstrap-significantietesting en bootstrap-betrouwbaarheidsintervallen zijn geïmplementeerd in `mt_eval_harness/significance.py` en `mt_eval_harness/confidence.py`, geëxporteerd vanuit het pakket, beschikbaar via de CLI, en gedekt door de testsuites voor significantie / betrouwbaarheid / scoring.
> **Codebase**: `arena` — gekoppeld aan `tester.py` (betrouwbaarheidsintervallen per run) en `compare.py` (significantie tussen runs).
> **Doel**: Onderzoekers in staat stellen te bepalen of het verschil tussen twee evaluatieruns statistisch significant is of slechts ruis.

Deze pagina documenteert het **geïmplementeerde gedrag** — het is beschrijvend, geen takenlijst.

---

## Waarom Dit Belangrijk Is

Bij het vergelijken van twee runs (illustratief: Systeem A chrF++ 42,96 vs. Systeem B chrF++ 41,80 op 92 invoeren) zegt een enkel puntsverschil op zichzelf niets over of het reëel is of ruis. Met slechts ~92 testinvoeren kan willekeurige variatie gemakkelijk schommelingen van 1–2 punten veroorzaken. Experts vragen om significantietests — daarom berekent het harnas deze.

---

## Algoritme: Paired Bootstrap Resampling

Dit is de standaardmethode die wordt gebruikt door SacreBLEU, MT-Lens en WMT shared tasks. Ze is goed begrepen door MT-onderzoekers en levert resultaten op die zij vertrouwen.

### Hoe Het Werkt

Gegeven twee systemen A en B geëvalueerd op dezelfde N testinvoeren:

1. Bereken het werkelijke metriekverschil: `Δ = metric(A) - metric(B)`
2. Herhaal `n_bootstrap` keer (standaard 1000):
   a. Sample N invoeren **met teruglegging** uit de gedeelde testset
   b. Bereken de metriek voor zowel A als B op dit bootstrap-sample
   c. Bereken het bootstrap-verschil: `Δ_boot = metric(A_boot) - metric(B_boot)`
3. De p-waarde = het aandeel bootstrap-samples waarbij `Δ_boot` het tegengestelde teken heeft van `Δ`
4. Als p-waarde < α (standaard 0,05), is het verschil statistisch significant

### Belangrijkste Eigenschappen

- **Paired**: Beide systemen worden geëvalueerd op hetzelfde bootstrap-sample, waardoor de correlatie op invoerniveau behouden blijft
- **Niet-parametrisch**: Geen aanname over de verdeling van scores
- **Standaard**: Dit is precies wat `sacrebleu --paired-bs` intern doet

---

## sacrebleu Is een Harde Afhankelijkheid

sacrebleu is een harde afhankelijkheid. Een MT-evaluatieharnas dat geen chrF++ of BLEU kan berekenen, is geen MT-evaluatieharnas, dus:

1. `sacrebleu>=2.3` is gedeclareerd onder `[project.dependencies]` in `pyproject.toml` (niet `[project.optional-dependencies]`).
2. Het wordt direct geïmporteerd in `tester.py` — `from sacrebleu.metrics import CHRF, BLEU, TER` — zonder `try/except`-beveiliging.
3. Het wordt direct geïmporteerd in `significance.py`.

Er zijn nergens `HAS_SACREBLEU`-conditionele paden: uitvoeren zonder sacrebleu is geen ondersteunde configuratie.

---

## Implementatie

### 1. sacrebleu als harde afhankelijkheid

`pyproject.toml` declareert `sacrebleu>=2.3` onder `[project.dependencies]`, en `tester.py` importeert het direct:

```python
from sacrebleu.metrics import CHRF, BLEU, TER
```

Er zijn geen `if HAS_SACREBLEU:`-beveiligingen in `tester.py` — de conditionele importpaden zijn verwijderd.

---

### 2. Module: `mt_eval_harness/significance.py`

De kern van de paired-bootstrap-implementatie. Het publieke oppervlak:

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

### 3. Ingebouwde metriekfuncties

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

### 4. Integratie in `compare.py`

`compare.py` voert een zij-aan-zij-vergelijking uit van meerdere TestReports en voert significantietesting tussen hen uit. `significance.py` levert ook `fst_acceptance_rate()` en `composite_score()` (zodat FST- en samengestelde verschillen op significantie getest kunnen worden), `run_significance_tests()` (stuurt alle metrieken aan over twee rapporten), en `format_significance_table()` (consoleweergave).

```python
# In compare_reports(), after computing deltas:
if len(reports) == 2:
    sig_results = run_significance_tests(reports[0], reports[1])
    comparison["significance"] = [asdict(r) for r in sig_results]
```

Wanneer meer dan 2 rapporten worden vergeleken, worden paarsgewijze significantietests uitgevoerd voor alle paren, geïndexeerd op `"(run_a_id, run_b_id)"`.

### 5. CLI-integratie

`mt-eval compare` biedt een `--significance`-vlag, met `--n-bootstrap` om het aantal iteraties in te stellen:

```bash
# Compare two runs with significance testing
mt-eval compare report_a.json report_b.json --significance

# Custom bootstrap count
mt-eval compare report_a.json report_b.json --significance --n-bootstrap 5000
```

### 6. Uitvoerformaat

`format_significance_table()` geeft de consoleweergave weer; dezelfde gegevens worden toegevoegd aan de vergelijkings-JSON.

**Console-uitvoer:**
```
  Significance Tests (paired bootstrap, n=1000, α=0.05):

  Metric              A         B       Δ      p-value  Sig?
  ─────────────────── ──────── ──────── ─────── ──────── ────
  corpus_chrf         42.96    41.80    +1.16   0.142    No
  exact_match_rate     0.198    0.185   +0.013  0.381    No
  corpus_bleu          6.80     3.81    +2.99   0.018    Yes *
```

**JSON-uitvoer** (toegevoegd aan het vergelijkingsrapport):
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

### 7. Dashboard-integratie (optionele uitbreiding)

Wanneer significantiegegevens aanwezig zijn in de vergelijkings-JSON, kan het dashboard deze tonen — een vergelijkingstabelrij met significantie-indicatoren (`*` voor p < 0,05, `**` voor p < 0,01). Dit is een presentatielaag bovenop de geïmplementeerde berekening en maakt geen deel uit van de kernfunctionaliteit.

---

## Randgevallen en Validatie

1. **Niet-overeenkomende invoeren**: De twee TestReports moeten dezelfde invoer-ID's hebben. Als dat niet het geval is (bijv. één is uitgevoerd op een subset), voer de significantietest dan alleen uit op de doorsnede. Waarschuw over uitgesloten invoeren.

2. **Te weinig invoeren**: Als N < 10, waarschuw dan dat significantietests onbetrouwbaar zijn met zo weinig invoeren. Voer ze toch uit, maar toon de waarschuwing.

3. **Identieke scores**: Als beide systemen identieke resultaten per invoer produceren, moet p_value 1,0 zijn (helemaal geen verschil).

4. **Plugin-metrieken**: De significantiemodule moet ook plugin-metrieken testen die in BEIDE rapporten voorkomen. Gebruik een generieke aanpak: als beide rapporten `plugin_metrics.crk_fst_validity.avg_fst_validity` bevatten, test dit dan.

5. **Reproduceerbaarheid**: De RNG-seed moet worden gelogd in de uitvoer zodat resultaten exact reproduceerbaar zijn. Standaard 12345 (overeenkomstig de SacreBLEU-conventie).

---

## Wat NIET te Bouwen

- **Geen afzonderlijke COMET-significantie**: COMET wordt berekend en gerapporteerd in een **afzonderlijke neurale baan** — het wordt **nooit opgenomen in een samengestelde score** (de samengestelde score is deterministisch; zie [scoring.md §4.3](/docs/network/specifications/scoring#43-weight-tables) en §2). Bootstrap-CI's *kunnen* worden berekend over de gecachede scores per invoer, maar het harnas voert geen ingebouwde paired significantietest voor COMET uit. Gebruik voor paarsgewijze COMET-significantie tussen twee systemen `comet-compare` van Unbabel.
- **Geen Bayesiaanse analyse**: Houd het bij frequentistische bootstrap. Dat is wat de MT-gemeenschap verwacht en begrijpt.
- **Geen correctie voor meervoudig testen**: Pas bij het testen van meerdere metrieken geen Bonferroni- of vergelijkbare correcties toe. De conventie in MT-evaluatie is om ruwe p-waarden per metriek te rapporteren en de interpretatie aan de lezer over te laten.

---

## Moduleoverzicht

Waar de geïmplementeerde functionaliteit zich bevindt:

| Bestand | Rol |
|---|---|
| `pyproject.toml` | `sacrebleu>=2.3` gedeclareerd als harde afhankelijkheid |
| `mt_eval_harness/tester.py` | Directe sacrebleu-import (geen `HAS_SACREBLEU`-beveiliging); berekent CI's per run |
| `mt_eval_harness/significance.py` | Paired-bootstrap-kern: `paired_bootstrap`, `SignificanceResult`, ingebouwde metriekfuncties, `run_significance_tests`, `format_significance_table` |
| `mt_eval_harness/confidence.py` | Bootstrap-betrouwbaarheidsintervallen: `bootstrap_ci`, `compute_all_cis`, `compute_per_tier_cis`, `ConfidenceInterval` |
| `mt_eval_harness/__init__.py` | Exporteert `SignificanceResult`, `paired_bootstrap`, `ConfidenceInterval`, `bootstrap_ci`, `compute_all_cis` |
| `mt_eval_harness/compare.py` | Significantietests gekoppeld aan rapportvergelijking |
| `mt_eval_harness/cli.py` | `--significance` / `--n-bootstrap` (vergelijken) en `--no-ci` / `--n-bootstrap-ci` (testen) vlaggen |
| `mt_eval_harness/dashboard.py` | Toont significantie in de vergelijkingstabel (optionele uitbreiding) |
| `tests/test_significance.py`, `tests/test_confidence.py` | Unittests (onderdeel van de geslaagde testsuite) |

---

## Testdekking

De testsuites voor significantie / betrouwbaarheid / scoring zijn groen. Ze dekken:

1. **Deterministisch met seed**: zelfde invoer + zelfde seed → zelfde p-waarde, elke keer
2. **Test met bekend antwoord**: twee identieke resultaatsets → p_value = 1,0
3. **Test met bekende significantie**: twee resultaatsets waarbij één duidelijk beter is (bijv. alle exacte overeenkomsten vs. alle missers) → p_value ≈ 0,0
4. **Niet-overeenkomende ID's**: geeft `ValueError` terug, of waarschuwt en berekent op de doorsnede
5. **Lege invoer**: wordt netjes afgehandeld (p_value = 1,0 of uitzondering)

---

## Betrouwbaarheidsintervallen (Aanvullende Functionaliteit)

> **Status**: ✅ GEÏMPLEMENTEERD in `confidence.py`

Betrouwbaarheidsintervallen (CI's) beantwoorden een andere vraag dan significantietesting:

- **Significantietesting** (`significance.py`): "Is het verschil tussen systeem A en systeem B reëel?"
- **Betrouwbaarheidsintervallen** (`confidence.py`): "Hoe onzeker is de score van dit systeem op zichzelf?"

### Implementatie: `confidence.py`

Maakt gebruik van dezelfde percentiel-bootstrap-resamplingmethode als significantietesting:

| Parameter | Waarde | Onderbouwing |
|---|---|---|
| `n_bootstrap` | 1000 | SacreBLEU-standaard, WMT 2024-conventie |
| `seed` | 12345 | SacreBLEU-standaardseed voor reproduceerbaarheid |
| `alpha` | 0,05 | Standaard betrouwbaarheidsniveau van 95% |
| Methode | Percentiel-bootstrap | Koehn (2004), Efron (1979) |

### Waarvoor CI's Worden Berekend

De deterministische metrieken op corpusniveau berekend door het harnas:
- `corpus_chrf` (chrF++-score)
- `corpus_bleu` (BLEU-score)
- `exact_match_rate` (0,0–1,0)
- `fst_acceptance_rate` (wanneer FST-gegevens aanwezig zijn)
- `composite` (wanneer chrF++ en exacte overeenkomst beschikbaar zijn)

CI's worden **ook** berekend voor de neurale `comet_score`, gebootstrapt vanuit de gecachede scores per invoer (geen redundante neurale inferentie). Het hebben van een CI maakt COMET niet tot een samengestelde metriek: het wordt gerapporteerd in een **afzonderlijke neurale baan** en wordt nooit opgenomen in de samengestelde score (zie [scoring.md §4.3](/docs/network/specifications/scoring#43-weight-tables)).

### CLI-vlaggen

```bash
# Default: CIs are computed automatically
mt-eval test run_log.json

# Skip CI computation (faster, for quick iteration)
mt-eval test run_log.json --no-ci

# More bootstrap iterations (more precise, slower)
mt-eval test run_log.json --n-bootstrap-ci 2000
```

### Waarschuwing bij Kleine Steekproef

Wanneer N < 30 invoeren, geeft de module een waarschuwing dat CI's mogelijk een slechte dekking hebben. De bootstrap kan geen informatie creëren die afwezig is in de steekproef — met zeer weinig invoeren zullen de intervallen breed zijn, wat de hoge onzekerheid correct weerspiegelt.

### COMET (afzonderlijk gerapporteerd, nooit samengesteld)

COMET is een **neurale metriek die afzonderlijk wordt gerapporteerd** — het wordt **nooit in een composiet opgenomen** (de composiet wordt deterministisch gehouden; zie [scoring.md §4.3](/docs/network/specifications/scoring#43-weight-tables) en §2). Bootstrap CI's *worden* berekend over de in de cache opgeslagen scores per item, maar het is geen "first-class" composietmetriek:
- Model: `Unbabel/wmt22-comet-da` (WMT 2022 referentiegebaseerd model); AfriCOMET wordt automatisch geselecteerd voor ondersteunde Afrikaanse talen
- Wordt berekend wanneer `unbabel-comet` is geïnstalleerd
- Scores per item worden opgeslagen in TestReport-items; de corpuswaarde is voorzien van een kalibratievoorbehoud voor low-resource talen
- Opnieuw afgeleid door de verifier — een gerapporteerde COMET-waarde moet reproduceerbaar zijn
- Optionele afhankelijkheid: `pip install mt-eval-harness[comet]`

### Supabase-kolommen

De `run_cards`-tabel bevat de bijbehorende nullable kolommen (zie [scoring.md §9.1](/docs/network/specifications/scoring)):
- `comet_score` (`real`) — de afzonderlijk gerapporteerde neurale score, nooit samengesteld
- `corpus_bleu` (`real`)

Grenzen van betrouwbaarheidsintervallen worden opgeslagen in de run-card `scores` JSON onder `confidence_intervals` (conform het run-card-schema in scoring.md §9), niet als gedenormaliseerde kolommen op het hoogste niveau.
