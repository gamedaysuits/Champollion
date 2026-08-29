---
sidebar_position: 7
title: "Test auf statistische Signifikanz"
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

# Statistische Signifikanzprüfung

> **Status**: ✅ Ausgeliefert. Gepaarte Bootstrap-Signifikanzprüfung und Bootstrap-Konfidenzintervalle sind in `mt_eval_harness/significance.py` und `mt_eval_harness/confidence.py` implementiert, aus dem Paket exportiert, über die CLI verfügbar gemacht und durch die Signifikanz-/Konfidenz-/Scoring-Testsuiten abgedeckt.
> **Codebasis**: `arena` — eingebunden in `tester.py` (Konfidenzintervalle pro Lauf) und `compare.py` (Signifikanz zwischen Läufen).
> **Zweck**: Ermöglicht es Forschenden, festzustellen, ob der Unterschied zwischen zwei Evaluierungsläufen statistisch signifikant oder lediglich Rauschen ist.

Diese Seite dokumentiert das **ausgelieferte Verhalten** — sie ist beschreibend, keine To-do-Liste.

---

## Warum dies wichtig ist

Beim Vergleich zweier Läufe (illustrativ: System A chrF++ 42,96 gegenüber System B chrF++ 41,80 bei 92 Einträgen) sagt eine reine Punktdifferenz für sich genommen nichts darüber aus, ob sie real ist oder Rauschen. Bei nur ~92 Testeinträgen kann zufällige Variation leicht Schwankungen von 1–2 Punkten erzeugen. Fachleute verlangen Signifikanztests — daher berechnet sie das Harness.

---

## Algorithmus: Gepaartes Bootstrap-Resampling

Dies ist die Standardmethode, die von SacreBLEU, MT-Lens und WMT Shared Tasks verwendet wird. Sie ist unter MT-Forschenden gut verstanden und liefert Ergebnisse, denen sie vertrauen.

### Funktionsweise

Gegeben seien zwei Systeme A und B, die auf denselben N Testeinträgen evaluiert wurden:

1. Berechnen Sie die tatsächliche Metrikdifferenz: `Δ = metric(A) - metric(B)`
2. Wiederholen Sie `n_bootstrap` Mal (Standard 1000):
   a. Ziehen Sie N Einträge **mit Zurücklegen** aus dem gemeinsamen Testset
   b. Berechnen Sie die Metrik sowohl für A als auch für B auf dieser Bootstrap-Stichprobe
   c. Berechnen Sie die Bootstrap-Differenz: `Δ_boot = metric(A_boot) - metric(B_boot)`
3. Der p-Wert = Anteil der Bootstrap-Stichproben, bei denen `Δ_boot` das entgegengesetzte Vorzeichen von `Δ` hat
4. Wenn der p-Wert < α (Standard 0,05) ist, ist die Differenz statistisch signifikant

### Zentrale Eigenschaften

- **Gepaart**: Beide Systeme werden auf derselben Bootstrap-Stichprobe evaluiert, wodurch die Korrelation auf Eintragsebene erhalten bleibt
- **Nichtparametrisch**: Keine Annahme über die Verteilung der Scores
- **Standard**: Genau dies macht `sacrebleu --paired-bs` intern

---

## sacrebleu ist eine harte Abhängigkeit

sacrebleu ist eine harte Abhängigkeit. Ein MT-Eval-Harness, das chrF++ oder BLEU nicht berechnen kann, ist kein MT-Eval-Harness, daher:

1. `sacrebleu>=2.3` ist unter `[project.dependencies]` in `pyproject.toml` deklariert (nicht `[project.optional-dependencies]`).
2. Es wird direkt in `tester.py` importiert — `from sacrebleu.metrics import CHRF, BLEU, TER` — ohne `try/except`-Schutz.
3. Es wird direkt in `significance.py` importiert.

Es gibt nirgendwo `HAS_SACREBLEU`-Bedingungspfade: Der Betrieb ohne sacrebleu ist keine unterstützte Konfiguration.

---

## Implementierung

### 1. sacrebleu als harte Abhängigkeit

`pyproject.toml` deklariert `sacrebleu>=2.3` unter `[project.dependencies]`, und `tester.py` importiert es direkt:

```python
from sacrebleu.metrics import CHRF, BLEU, TER
```

Es gibt keine `if HAS_SACREBLEU:`-Schutzmechanismen in `tester.py` — die bedingten Importpfade wurden entfernt.

---

### 2. Modul: `mt_eval_harness/significance.py`

Die zentrale Implementierung des gepaarten Bootstraps. Ihre öffentliche Schnittstelle:

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

### 3. Integrierte Metrikfunktionen

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

### 4. Integration in `compare.py`

`compare.py` führt einen direkten Vergleich mehrerer TestReports durch und führt Signifikanzprüfungen zwischen ihnen aus. `significance.py` liefert außerdem `fst_acceptance_rate()` und `composite_score()` (sodass FST- und zusammengesetzte Differenzen auf Signifikanz geprüft werden können), `run_significance_tests()` (steuert alle Metriken über zwei Reports hinweg) sowie `format_significance_table()` (Konsolendarstellung).

```python
# In compare_reports(), after computing deltas:
if len(reports) == 2:
    sig_results = run_significance_tests(reports[0], reports[1])
    comparison["significance"] = [asdict(r) for r in sig_results]
```

Wenn mehr als 2 Reports verglichen werden, werden paarweise Signifikanzprüfungen für alle Paare ausgeführt, indiziert nach `"(run_a_id, run_b_id)"`.

### 5. CLI-Integration

`mt-eval compare` stellt ein `--significance`-Flag bereit, mit `--n-bootstrap` zum Festlegen der Iterationsanzahl:

```bash
# Compare two runs with significance testing
mt-eval compare report_a.json report_b.json --significance

# Custom bootstrap count
mt-eval compare report_a.json report_b.json --significance --n-bootstrap 5000
```

### 6. Ausgabeformat

`format_significance_table()` rendert die Konsolenansicht; dieselben Daten werden dem Vergleichs-JSON hinzugefügt.

**Konsolenausgabe:**
```
  Significance Tests (paired bootstrap, n=1000, α=0.05):

  Metric              A         B       Δ      p-value  Sig?
  ─────────────────── ──────── ──────── ─────── ──────── ────
  corpus_chrf         42.96    41.80    +1.16   0.142    No
  exact_match_rate     0.198    0.185   +0.013  0.381    No
  corpus_bleu          6.80     3.81    +2.99   0.018    Yes *
```

**JSON-Ausgabe** (dem Vergleichsreport hinzugefügt):
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

### 7. Dashboard-Integration (optionale Erweiterung)

Wenn Signifikanzdaten im Vergleichs-JSON vorhanden sind, kann das Dashboard sie sichtbar machen — eine Vergleichstabellenzeile mit Signifikanzindikatoren (`*` für p < 0,05, `**` für p < 0,01). Dies ist eine Präsentationsschicht über der ausgelieferten Berechnung, nicht Teil der Kernfunktion.

---

## Grenzfälle und Validierung

1. **Nicht übereinstimmende Einträge**: Die beiden TestReports müssen dieselben Eintrags-IDs haben. Ist dies nicht der Fall (z. B. wenn einer auf einer Teilmenge lief), prüfen Sie die Signifikanz nur auf der Schnittmenge. Warnen Sie vor ausgeschlossenen Einträgen.

2. **Zu wenige Einträge**: Wenn N < 10 ist, warnen Sie, dass Signifikanztests bei so wenigen Einträgen unzuverlässig sind. Führen Sie sie dennoch aus, aber geben Sie die Warnung aus.

3. **Identische Scores**: Wenn beide Systeme identische Ergebnisse pro Eintrag erzeugen, sollte p_value 1,0 betragen (überhaupt kein Unterschied).

4. **Plugin-Metriken**: Das Signifikanzmodul sollte auch alle Plugin-Metriken prüfen, die in BEIDEN Reports vorkommen. Verwenden Sie einen generischen Ansatz: Wenn beide Reports `plugin_metrics.crk_fst_validity.avg_fst_validity` haben, prüfen Sie es.

5. **Reproduzierbarkeit**: Der RNG-Seed muss in der Ausgabe protokolliert werden, damit die Ergebnisse exakt reproduzierbar sind. Standardwert ist 12345 (entsprechend der SacreBLEU-Konvention).

---

## Was NICHT gebaut werden soll

- **Keine separate COMET-Signifikanz**: COMET wird in einer **separaten neuronalen Spur** berechnet und berichtet — es wird **niemals in ein Composite eingebunden** (das Composite ist deterministisch; siehe [scoring.md §4.3](/docs/network/specifications/scoring#43-weight-tables) und §2). Bootstrap-KIs *können* über seine zwischengespeicherten Scores pro Eintrag berechnet werden, aber das Harness führt keinen integrierten gepaarten Signifikanztest für COMET aus. Verwenden Sie für die paarweise COMET-Signifikanz zwischen zwei Systemen `comet-compare` von Unbabel.
- **Keine Bayes'sche Analyse**: Bleiben Sie beim frequentistischen Bootstrap. Das ist es, was die MT-Community erwartet und versteht.
- **Keine Multi-Test-Korrektur**: Wenden Sie beim Prüfen mehrerer Metriken keine Bonferroni- oder ähnliche Korrekturen an. In der MT-Evaluierung ist es üblich, rohe p-Werte pro Metrik zu berichten und die Interpretation den Lesenden zu überlassen.

---

## Modulübersicht

Wo die ausgelieferte Funktion angesiedelt ist:

| Datei | Rolle |
|---|---|
| `pyproject.toml` | `sacrebleu>=2.3` als harte Abhängigkeit deklariert |
| `mt_eval_harness/tester.py` | Direkter sacrebleu-Import (kein `HAS_SACREBLEU`-Schutz); berechnet KIs pro Lauf |
| `mt_eval_harness/significance.py` | Kern des gepaarten Bootstraps: `paired_bootstrap`, `SignificanceResult`, integrierte Metrikfunktionen, `run_significance_tests`, `format_significance_table` |
| `mt_eval_harness/confidence.py` | Bootstrap-Konfidenzintervalle: `bootstrap_ci`, `compute_all_cis`, `compute_per_tier_cis`, `ConfidenceInterval` |
| `mt_eval_harness/__init__.py` | Exportiert `SignificanceResult`, `paired_bootstrap`, `ConfidenceInterval`, `bootstrap_ci`, `compute_all_cis` |
| `mt_eval_harness/compare.py` | Signifikanztests in den Report-Vergleich eingebunden |
| `mt_eval_harness/cli.py` | `--significance` / `--n-bootstrap` (compare) und `--no-ci` / `--n-bootstrap-ci` (test) Flags |
| `mt_eval_harness/dashboard.py` | Macht Signifikanz in der Vergleichstabelle sichtbar (optionale Erweiterung) |
| `tests/test_significance.py`, `tests/test_confidence.py` | Unit-Tests (Teil der bestandenen Suite) |

---

## Testabdeckung

Die Signifikanz-/Konfidenz-/Scoring-Suiten sind grün. Sie decken ab:

1. **Deterministisch mit Seed**: gleiche Eingaben + gleicher Seed → jedes Mal derselbe p-Wert
2. **Test mit bekannter Antwort**: zwei identische Ergebnismengen → p_value = 1,0
3. **Test mit bekannter Signifikanz**: zwei Ergebnismengen, bei denen eine klar besser ist (z. B. alle exakten Treffer gegenüber allen Fehltreffern) → p_value ≈ 0,0
4. **Nicht übereinstimmende IDs**: löst `ValueError` aus oder warnt und berechnet auf der Schnittmenge
5. **Leere Eingaben**: wird problemlos behandelt (p_value = 1,0 oder Auslösen einer Ausnahme)

---

## Konfidenzintervalle (begleitende Funktion)

> **Status**: ✅ IMPLEMENTIERT in `confidence.py`

Konfidenzintervalle (KIs) beantworten eine andere Frage als die Signifikanzprüfung:

- **Signifikanzprüfung** (`significance.py`): „Ist der Unterschied zwischen System A und System B real?“
- **Konfidenzintervalle** (`confidence.py`): „Wie unsicher ist der Score dieses Systems für sich allein genommen?“

### Implementierung: `confidence.py`

Verwendet dieselbe Perzentil-Bootstrap-Resampling-Methode wie die Signifikanzprüfung:

| Parameter | Wert | Begründung |
|---|---|---|
| `n_bootstrap` | 1000 | SacreBLEU-Standard, WMT-2024-Konvention |
| `seed` | 12345 | SacreBLEU-Standard-Seed für Reproduzierbarkeit |
| `alpha` | 0,05 | Standardmäßiges 95%-Konfidenzniveau |
| Methode | Perzentil-Bootstrap | Koehn (2004), Efron (1979) |

### Was KIs erhält

Die deterministischen Metriken auf Korpusebene, die vom Harness berechnet werden:
- `corpus_chrf` (chrF++-Score)
- `corpus_bleu` (BLEU-Score)
- `exact_match_rate` (0,0–1,0)
- `fst_acceptance_rate` (wenn FST-Daten vorhanden sind)
- `composite` (wenn chrF++ und exakter Treffer verfügbar sind)

KIs werden **auch** für den neuronalen `comet_score` berechnet, gebootstrappt aus seinen zwischengespeicherten Scores pro Eintrag (keine redundante neuronale Inferenz). Ein KI macht COMET nicht zu einer zusammengesetzten Metrik: Es wird in einer **separaten neuronalen Spur** berichtet und niemals in das Composite eingebunden (siehe [scoring.md §4.3](/docs/network/specifications/scoring#43-weight-tables)).

### CLI-Flags

```bash
# Default: CIs are computed automatically
mt-eval test run_log.json

# Skip CI computation (faster, for quick iteration)
mt-eval test run_log.json --no-ci

# More bootstrap iterations (more precise, slower)
mt-eval test run_log.json --n-bootstrap-ci 2000
```

### Warnung bei kleiner Stichprobe

Wenn N < 30 Einträge betragen, gibt das Modul eine Warnung aus, dass KIs eine schlechte Abdeckung aufweisen können. Der Bootstrap kann keine Information erzeugen, die in der Stichprobe nicht vorhanden ist — bei sehr wenigen Einträgen sind die Intervalle breit und spiegeln damit korrekt die hohe Unsicherheit wider.

### COMET (separat berichtet, niemals als Composite)

COMET ist eine **neuronale Metrik, die eigenständig ausgewiesen wird** — sie wird **niemals in einen Composite-Wert integriert** (der Composite-Wert wird deterministisch gehalten; siehe [scoring.md §4.3](/docs/network/specifications/scoring#43-weight-tables) und §2). Bootstrap-CIs *werden* über die zwischengespeicherten Scores pro Eintrag berechnet, aber es handelt sich nicht um eine "vollwertige" Composite-Metrik:
- Modell: `Unbabel/wmt22-comet-da` (referenzbasiertes WMT 2022-Modell); AfriCOMET wird für unterstützte afrikanische Sprachen automatisch ausgewählt
- Wird berechnet, wenn `unbabel-comet` installiert ist
- Scores pro Eintrag werden in TestReport-Einträgen gespeichert; der Korpuswert ist mit einem Kalibrierungsvorbehalt für ressourcenarme Sprachen versehen
- Wird vom Verifier nachberechnet — ein ausgewiesener COMET-Wert muss reproduzierbar sein
- Optionale Abhängigkeit: `pip install mt-eval-harness[comet]`

### Supabase-Spalten

Die Tabelle `run_cards` trägt die entsprechenden nullbaren Spalten (siehe [scoring.md §9.1](/docs/network/specifications/scoring)):
- `comet_score` (`real`) — der separat berichtete neuronale Score, niemals als Composite
- `corpus_bleu` (`real`)

Die Grenzen der Konfidenzintervalle werden innerhalb des Run-Card-`scores`-JSON unter `confidence_intervals` gespeichert (gemäß dem Run-Card-Schema in scoring.md §9), nicht als denormalisierte Top-Level-Spalten.
