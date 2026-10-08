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

> **Status**: ✅ Ausgeliefert. Gepaarte Signifikanztests (standardmäßig approximative Randomisierung; gepaarter Bootstrap auf Anfrage) und Bootstrap-Konfidenzintervalle sind in `mt_eval_harness/significance.py` und `mt_eval_harness/confidence.py` implementiert, aus dem Paket exportiert, über die CLI verfügbar und durch die Testsuiten für Signifikanz / Konfidenz / Scoring abgedeckt.
> **Codebasis**: `arena` — integriert in `tester.py` (Konfidenzintervalle pro Durchlauf) und `compare.py` (Signifikanz zwischen Durchläufen).
> **Zweck**: Ermöglicht Forschenden zu bestimmen, ob der Unterschied zwischen zwei Evaluierungsdurchläufen statistisch signifikant oder bloßes Rauschen ist.

Diese Seite dokumentiert das **ausgelieferte Verhalten** — sie ist beschreibend, keine To-do-Liste.

---

## Warum dies wichtig ist

Beim Vergleich zweier Läufe (illustrativ: System A chrF++ 42,96 gegenüber System B chrF++ 41,80 bei 92 Einträgen) sagt eine reine Punktdifferenz für sich genommen nichts darüber aus, ob sie real ist oder Rauschen. Bei nur ~92 Testeinträgen kann zufällige Variation leicht Schwankungen von 1–2 Punkten erzeugen. Fachleute verlangen Signifikanztests — daher berechnet sie das Harness.

**Gemäß dem Scoring-Standard (`standard/1`) entscheidet der gepaarte Test auf chrF++ darüber, ob ein Durchlauf besser ist als ein anderer.** chrF++ ist die vorab festgelegte primäre Metrik ([Scoring-Spezifikation](/docs/network/specifications/scoring#how-runs-are-scored)). BLEU, spBLEU, TER und COMET (sofern beide Durchläufe COMET-Scores pro Segment desselben Modells aufweisen) werden getestet und als sekundäre Standardmetriken angezeigt, exakte Übereinstimmung und Plugin-Raten als Diagnosedaten; keine davon entscheidet. Dies folgt Kocmi et al. (2021, „To Ship or Not to Ship“), die anhand von Tausenden menschlichen Bewertungen feststellten, dass ein Metrikunterschied zusammen mit seiner Signifikanz die menschliche Präferenz vorhersagt.

---

## Algorithmus: Gepaarte approximative Randomisierung (Standard)

`mt-eval compare --significance` verwendet den Test der **gepaarten approximativen Randomisierung
(AR)** nach Riezler & Maxwell (2005). Dies ist auch der Standard von SacreBLEU für
den Systemvergleich.

### Funktionsweise

Gegeben seien zwei Systeme A und B, die auf denselben N Testeinträgen evaluiert wurden:

1. Berechnen der beobachteten Differenz auf Korpusebene: `Δ = metric(A) - metric(B)`.
2. `n_trials`-mal wiederholen (Standard: 1000):
   a. Für jeden Eintrag die Ausgaben von A und B mit einer Wahrscheinlichkeit von ½ vertauschen.
   b. Die Korpusmetrik auf den beiden neu gemischten Gruppen neu berechnen.
   c. Festhalten, ob `|Δ_shuffled| ≥ |Δ|`.
3. Der p-Wert ist das zweiseitig erreichte Signifikanzniveau:
   `p = (#{|Δ_shuffled| ≥ |Δ|} + 1) / (n_trials + 1)`. Das +1 zählt die
   beobachtete Zuweisung als eine gültige Ziehung, sodass p nie exakt 0 ist.
4. Wenn p < α (Standard: 0,05), wird der Unterschied als signifikant ausgewiesen.

Das Konfidenzintervall für Δ ist ein Bootstrap-Perzentilintervall (AR liefert einen
p-Wert, kein Intervall). Es wird auf einem separaten Zufallsdatenstrom berechnet, damit
es die AR-Ziehungen nicht stört.

### Zentrale Eigenschaften

- **Ein echter Hypothesentest:** Die Vertauschungen werden unter der Nullhypothese
  gezogen, dass es keinen Unterschied macht, welches System einen bestimmten Eintrag erzeugt hat.
- **Gepaart:** Beide Systeme werden Eintrag für Eintrag verglichen, wodurch die
  Korrelation auf Eintragsebene erhalten bleibt.
- **Nichtparametrisch:** Es werden keine Annahmen über die Verteilung der Scores getroffen.

### Der gepaarte Bootstrap (verfügbar, nicht standardmäßig)

`paired_bootstrap()` implementiert den gepaarten Bootstrap nach Koehn (2004): Es zieht
Einträge mit Zurücklegen erneut und zählt, wie oft das Vorzeichen von Δ wechselt. Es wird
zur Vergleichbarkeit mit älteren Veröffentlichungen angeboten, ist jedoch eine Heuristik
für die Vorzeichenrobustheit und kein Signifikanzniveau aus dem Lehrbuch. Seine Verteilung ist auf
dem beobachteten Δ zentriert, nicht auf der Nullhypothese, weshalb es die Signifikanz im Vergleich
zu AR überbewerten kann. Wählen Sie es auf der Befehlszeile mit
`mt-eval compare <reports…> --significance --method paired_bootstrap` oder mit
`method="paired_bootstrap"` in `run_significance_tests` aus.

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

Die Signifikanzimplementierung (standardmäßig approximative Randomisierung, gepaarter Bootstrap auf Anfrage). Ihre öffentliche Schnittstelle:

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

`compare.py` führt einen direkten Vergleich mehrerer TestReports durch und führt Signifikanztests zwischen ihnen aus. `run_significance_tests()` steuert die Tests über zwei Berichte hinweg und `format_significance_table()` rendert sie. Jedes Ergebnis enthält seine `role`: `primary` (chrF++ — der eine Test, der entscheidet), `secondary` (die anderen Standardmetriken) oder `diagnostic`. Getestet wird in dieser Reihenfolge:

| Metrik | Rolle | Berechnet pro Resample aus |
|---|---|---|
| `corpus_chrf` | primär | sacreBLEU-Statistiken pro Segment |
| `corpus_bleu` | sekundär | sacreBLEU-Statistiken pro Segment |
| `corpus_spbleu` | sekundär | sacreBLEU-Statistiken pro Segment, auf dem FLORES-200 SentencePiece-Tokenizer (spBLEU ist BLEU mit diesem Tokenizer, der Wert, den FLORES/NLLB-Tabellen angeben). Wenn der Tokenizer nicht verfügbar ist (kein `sentencepiece` oder offline, da das Modell noch nicht heruntergeladen wurde), wird er als nicht getestet aufgeführt und niemals stillschweigend weggelassen |
| `corpus_ter` | sekundär | sacreBLEU-Statistiken pro Segment. TER ist eine Fehlerrate (Edit Rate), daher gilt **niedriger ist besser**: Ein negatives Δ begünstigt A |
| `comet_score` | sekundär | den COMET-Scores pro Segment, die beide Berichte bereits enthalten (ihr Mittelwert ist der COMET-System-Score; das Modell wird nie erneut ausgeführt). Wird mit Grund als nicht getestet aufgeführt, wenn nur ein Durchlauf mit COMET bewertet wurde oder beide unterschiedliche COMET-Modelle verwendeten |
| `exact_match_rate` | diagnostisch | dem Flag für exakte Übereinstimmung jedes Eintrags |
| Plugin-Raten in beiden Berichten, z. B. `giellalt_fst_validity.avg_fst_validity`, `.corpus_validity_rate`, `.morphological_accuracy`, `code_switching.avg_code_switching_rate`, `hallucination.avg_hallucination_rate` | diagnostisch | den eigenen Ergebnissen des Plugins pro Eintrag, aggregiert wie der Hauptwert |

**Der ausgemusterte zusammengesetzte Score wird nicht getestet.** Der gewichtete zusammengesetzte Score und die Zeile `segment_composite`, die früher hier getestet wurden, sind durch den Scoring-Standard ausgemustert ([Scoring-Spezifikation §4](/docs/network/specifications/scoring#4-composite-score)). Ein Vergleichs-JSON, das vor dem Standard geschrieben wurde, zeigt weiterhin seine Zeilen `segment_composite` (oder `composite_score`), gekennzeichnet als veralteter zusammengesetzter Score, der nichts entscheidet. Wenn ein verglichener Bericht ein Altsystem ist, gibt `compare` an, dass sein zusammengesetzter Score ausgemustert ist, und vergleicht ihn nicht.

```python
# In compare_reports(), after computing deltas:
if len(reports) == 2:
    sig_results = run_significance_tests(reports[0], reports[1])
    comparison["significance"] = [asdict(r) for r in sig_results]
```

Werden mehr als 2 Berichte verglichen, werden paarweise Signifikanztests für alle Paare ausgeführt: `significance` ist dann eine Liste von `{"pair": [run_a_id, run_b_id], "letters": ["A", "C"], "tests": [...]}`-Objekten, eines pro Paar, wobei jede `tests`-Liste wie im Fall von zwei Berichten aufgebaut ist. `letters` sind die Buchstaben der beiden Durchläufe in der Durchlauftabelle, und Δ ist der erste minus der zweite.

Neben `significance` enthält das Vergleichs-JSON `significance_settings`: `method`, `n_resamples`, `alpha`, `seed`, welcher Durchlauf welchem Buchstaben entspricht (`runs`), was `ci_lower`/`ci_upper` sind, `multiple_testing_correction: "none"`, wie viele Metriken pro Paar und über wie viele Paare hinweg getestet wurden, den Hinweis in einfachen Worten zu unkorrigierten p-Werten (unten) sowie alle Anmerkungen, die die Tests aufgeworfen haben (von einer Paarung ausgeschlossene Einträge, nicht getestete Metriken).

### 5. CLI-Integration

`mt-eval compare` bietet ein Flag `--significance` mit `--method` zur Auswahl des gepaarten Tests (`approximate_randomization`, Standard, oder `paired_bootstrap`) und `--n-bootstrap` zur Festlegung der Iterationsanzahl:

```bash
# Compare two runs with significance testing
mt-eval compare report_a.json report_b.json --significance

# The Koehn (2004) paired bootstrap instead of approximate randomization
mt-eval compare report_a.json report_b.json --significance --method paired_bootstrap

# Custom resampling count
mt-eval compare report_a.json report_b.json --significance --n-bootstrap 5000
```

`compare` übernimmt die `*_report.json`-Dateien, die `mt-eval run` schreibt (oder die Durchlaufprotokolle, deren Geschwisterbericht verwendet wird). Es gibt die Durchlauftabelle mit einer Zeile pro Metrik und einer Spalte pro Durchlauf aus, dann die Signifikanztabelle, und schreibt das Vergleichs-JSON an einen neutralen Ort, sofern `-o` keine andere Datei benennt: `comparison-<hash>.json` neben den Berichten, wenn sie sich im selben Ordner befinden, andernfalls in `comparisons/` in ihrem nächstgelegenen gemeinsamen Ordner (Berichte im jeweils eigenen Ordner eines Durchlaufs, wie etwa den `mcp-run-<id>/`-Ordnern von `run_benchmark`, erhalten niemals einen in einen von ihnen geschriebenen Vergleich). `<hash>` besteht aus den ersten zehn Hex-Zeichen eines SHA-256-Hashes über die IDs der verglichenen Durchläufe in der angegebenen Reihenfolge, sodass ein weiterer Vergleich im selben Ordner diesen niemals überschreibt; ein erneuter Vergleich derselben Durchläufe überschreibt deren eigene Datei. Die Angabe einer Datei mit `-o` ersetzt alle dort vorhandenen Daten, und die Ausgabe weist darauf hin. Der geschriebene Pfad wird ausgegeben. Ein Vergleich von Durchläufen auf einem rein lokalen, versiegelten oder zustimmungspflichtigen Korpus zitiert deren Sätze, weshalb er die Kennzeichnung dieses Korpus in einer `<file>.champollion.json`-Begleitdatei mitführt, wo immer er geschrieben wird.

In der Spalte **Avg latency (s/entry)** der Durchlauftabelle wird für einen Durchlauf, der keine Zeit aufgezeichnet hat, `—` angezeigt, mit einer Anmerkung unter der Tabelle, die den Grund nennt: Jeder Eintrag stammte aus dem Cache, die Ausgaben wurden außerhalb des Test-Harness erstellt oder die Methode hat keine gemeldet. Ein Wert unter 0,01 s wird mit vier Nachkommastellen angezeigt (ein kleines Modell auf einer CPU dekodiert in wenigen Millisekunden pro Satz) und niemals auf 0,00 gerundet.

### 6. Ausgabeformat

`format_significance_table()` rendert die Konsolenansicht; dieselben Daten werden dem Vergleichs-JSON hinzugefügt.

Die Berichte werden in der angegebenen Reihenfolge mit Buchstaben versehen: Der erste ist Durchlauf **A**, der zweite **B**, dann **C**, **D** usw., dieselben Buchstaben wie in der Durchlauftabelle oben. Jede paarweise Tabelle benennt ihre beiden Durchläufe nach diesen Buchstaben und ihren Durchlauf-IDs, beispielsweise `--- A (baseline) vs C (nllb-ft) ---`, und ihre Spalten sowie Δ verwenden dieselben Buchstaben (`Δ (A−C)`). Δ ist immer **erster − zweiter**. Die Erklärung der Tabelle und jede Anmerkung darunter werden **einmal** ausgegeben, unabhängig davon, wie viele Paare vorhanden sind. Jede Zeile gibt außerdem das 95%-**CI on Δ** aus: das Bootstrap-Perzentilintervall in `ci_lower`/`ci_upper` des JSON, das angibt, wie groß der Unterschied plausiblerweise ist, nicht nur sein Vorzeichen. Jede Metrik ist mit ihrer Richtung aus der Metrik-Registry gekennzeichnet (↑ höher ist besser, ↓ niedriger ist besser), und eine Spalte **Better** benennt den Durchlauf mit dem besseren Ergebnis, richtungsabhängig, mit `(n.s.)`, wenn der Unterschied nicht signifikant ist. Eine Rate, bei der ein niedrigerer Wert besser ist, wie TER, Code-Switching oder Halluzination, die gestiegen ist, gibt also ein positives Δ mit **B** als besserem Durchlauf aus, und ein als zweites übergebenes trainiertes Modell, das seine Baseline um 63,5 chrF++ schlägt, gibt Δ −63,52 mit **B** als besser aus. Eine Metrik, deren Richtung in der Registry nicht deklariert ist, wird mit `?` dargestellt. Scores, Δ und das Intervall werden mit zwei Nachkommastellen ausgegeben, und mit mehr (bis zu sechs) in einer Zeile, in der dies einen echten Unterschied verbergen würde: Ein spBLEU von 0,0684 gegenüber 0,0673 gibt Δ +0,0011 [+0,0001, +0,0021] aus, niemals +0,00 [+0,00, +0,00] neben **Yes**, und die Tabelle weist darauf hin, dass diese Zeilen mehr Nachkommastellen enthalten. Das JSON speichert vier Nachkommastellen und vier signifikante Stellen für einen Wert ungleich null, der kleiner als dieser ist, sodass ein echter Unterschied niemals als 0 gespeichert wird. Identische Ausgaben ergeben ein Δ von exakt 0 und p = 1, sodass sie niemals signifikant sind. Wenn p unter α fällt, während das Bootstrap-Intervall für Δ exakt [0, 0] ist (zu wenige Segmente unterscheiden sich, um die Differenz zu schätzen), zeigt **Sig?** `?†` und **Better** `—†` mit einer Anmerkung: Kein Durchlauf wird hierbei als besser bezeichnet. Bei einer Plugin-Rate, bei der niedriger besser ist, ist das JSON-`winner` ebenfalls richtungsabhängig (die niedrigere Rate gewinnt), wie es bei `corpus_ter` schon immer der Fall war; eine Plugin-Rate ohne Vorzugsrichtung (neutral, wie `morph_coverage`, oder nicht deklariert) hat `winner: null`. Jedes Ergebnis enthält außerdem seine `direction`.

**Konsolenausgabe** (beispielhafte Zahlen):
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

In diesem Beispiel lautet das Urteil **kein signifikanter Unterschied**: chrF++, die primäre Metrik, trennt A und B nicht (p = 0,142), sodass kein Durchlauf als besser eingestuft wird — selbst wenn BLEU, spBLEU und TER A begünstigen und Code-Switching B begünstigt. Diese Zeilen werden angezeigt und Lesende möchten sie sich vielleicht genauer ansehen, aber sie entscheiden nicht. Die Tabelle führt chrF++ zuerst auf, dann die anderen Standardmetriken, dann die Diagnosedaten.

Bei mehr als zwei Durchläufen folgt eine `--- X (run) vs Y (run) ---`-Tabelle auf die andere unter der gemeinsamen Überschrift, und die Anmerkung zählt jeden durchgeführten Test (`6 metrics were tested per pair (36 tests over 6 pairs)`).

**JSON-Ausgabe** (zum Vergleichsbericht hinzugefügt):
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

### 7. Dashboard-Integration (optionale Erweiterung)

Wenn Signifikanzdaten im Vergleichs-JSON vorhanden sind, kann das Dashboard sie sichtbar machen — eine Vergleichstabellenzeile mit Signifikanzindikatoren (`*` für p < 0,05, `**` für p < 0,01). Dies ist eine Präsentationsschicht über der ausgelieferten Berechnung, nicht Teil der Kernfunktion.

---

## Grenzfälle und Validierung

1. **Nicht übereinstimmende Einträge**: Die beiden TestReports müssen dieselben Eintrags-IDs haben. Ist dies nicht der Fall (z. B. wenn einer auf einer Teilmenge lief), prüfen Sie die Signifikanz nur auf der Schnittmenge. Warnen Sie vor ausgeschlossenen Einträgen.

2. **Zu wenige Einträge**: Wenn N < 10 ist, warnen Sie, dass Signifikanztests bei so wenigen Einträgen unzuverlässig sind. Führen Sie sie dennoch aus, aber geben Sie die Warnung aus.

3. **Identische Scores**: Wenn beide Systeme identische Ergebnisse pro Eintrag erzeugen, sollte p_value 1,0 betragen (überhaupt kein Unterschied).

4. **Plugin-Metriken**: Eine Plugin-Rate, die in BEIDEN Berichten vorkommt, wird nur anhand von Werten pro Segment getestet, die der Bericht tatsächlich enthält. Das bedeutet die eigene Aggregation des Plugins über seine Ergebnisse pro Eintrag (die FST-Metrik) oder den Mittelwert des Werts pro Eintrag, den ein `avg_<name>`-Aggregat mittelt (die Verhaltensmetriken). Eine Plugin-Rate ohne Werte pro Segment wird als nicht getestet aufgeführt und niemals als 0,00 vs. 0,00 dargestellt. Anzahlen wie `total_words_checked` werden nicht getestet.

5. **Reproduzierbarkeit**: Der RNG-Seed muss in der Ausgabe protokolliert werden, damit die Ergebnisse exakt reproduzierbar sind. Standardwert ist 12345 (entsprechend der SacreBLEU-Konvention).

---

## Was NICHT gebaut werden soll

- **Keine erneute COMET-Inferenz im Test**: COMET wird anhand der segmentweisen Scores, die beide Berichte bereits enthalten, gepaart getestet; das Modell wird nie pro Resample neu ausgeführt. Zwei Durchläufe, die mit unterschiedlichen COMET-Modellen bewertet wurden, werden nicht gegeneinander getestet.
- **Keine Bayes'sche Analyse**: Es wird am Frequentist-Bootstrap festgehalten. Das ist es, was die MT-Community erwartet und versteht.
- **Keine Korrektur für multiples Testen**: Beim Testen mehrerer Metriken werden keine Bonferroni- oder ähnliche Korrekturen angewendet. Die Konvention bei der MT-Evaluierung besteht darin, rohe p-Werte pro Metrik anzugeben und die Interpretation den Lesenden zu überlassen. `mt-eval compare` **weist darauf hin** in seiner Ausgabe und in `comparison.json` (`significance_settings.multiple_testing_correction: "none"` mit einem Hinweis in einfachen Worten): Wenn mehrere Metriken getestet werden, kann ein einzelnes Ergebnis mit p < 0,05 rein zufällig auftreten, und ein kleines Δ kann signifikant sein, ohne von Bedeutung zu sein; prüfen Sie daher das CI für Δ und die Zuverlässigkeit der Metrik für die Sprache, bevor Sie aufgrund eines einzelnen „signifikant“ handeln.

---

## Rang-Cluster {#ranking-clusters}

> **Status**: ✅ Ausgeliefert, für Wettbewerbe. Ein Wettbewerbs-Ranking ist eine Menge von **Clustern**, keine strikte Reihenfolge — der Signifikanztest entscheidet, welche benachbarten Einträge tatsächlich unterscheidbar sind. Dieser Abschnitt beschreibt, was ausgeliefert wird, einschließlich der Fälle, in denen die Evidenz schwächer ist als bei einem gepaarten Test.

### Benachbarte Verkettung, Sport-Nummerierung

Einträge werden zuerst nach **Track** unterteilt — ein `constrained`-System wird niemals gegen ein `unconstrained`-System gewertet, und jeder Track hat seine eigene Reihenfolge, Gleichstandsgruppen und Rangbereiche, sodass „Rang 1“ immer Rang 1 *innerhalb eines Tracks* bedeutet.

Innerhalb eines Tracks werden die Einträge nach der primären Metrik des Wettbewerbs geordnet (chrF++, sofern für den Wettbewerb keine andere festgelegt wurde), dann nach den verbleibenden Oberflächenmetriken und schließlich nach dem frühesten Einreichungszeitpunkt. Jedes in dieser Reihenfolge **benachbarte** Paar wird getestet. Ein Paar, das der Test nicht trennen kann, teilt sich einen Rang, und geteilte Ränge **verketten sich**: Wenn A mit B gleichzieht und B mit C gleichzieht, landen alle drei in einer Gleichstandsgruppe, selbst wenn A und C nie direkt verglichen wurden.

Ränge verwenden die Wettbewerbsnummerierung (Sport-Nummerierung) — ein dreifacher Gleichstand an der Spitze ergibt `1, 1, 1` und der nächste Eintrag ist `4`; ein zweifacher Gleichstand auf dem zweiten Platz ergibt `1, 2, 2, 4`.

**Die ehrliche Grenze der Verkettung**: Nicht-Signifikanz ist nicht transitiv. Eine lange Kette kann zwei Einträge verbinden, die ein direkter Test trennen *würde*. Aus diesem Grund wird ein Cluster als **Bereich** angegeben, nicht als Punkt.

### Rangbereiche

Jeder Eintrag enthält `rank_min` und `rank_max` — die beste und schlechteste Position, die mit der Evidenz vereinbar ist, im Stil, wie ihn WMT für seine Rangbereiche verwendet. Ein Eintrag, der allein in seinem Cluster steht, hat `rank_min == rank_max`. Ein Eintrag innerhalb eines Vierer-Clusters, der die Positionen 2–5 umfasst, hat `rank_min: 2, rank_max: 5`, und **kein Eintrag innerhalb dieses Clusters liegt „vor“ einem anderen**. Einen einzelnen numerischen Rang aus einem Cluster herauszugreifen, ist eine Fehlinterpretation des Ergebnisses.

### Die Evidenzleiter

Nicht jedes Paar kann auf dieselbe Weise getestet werden, daher zeichnet jedes Paar die Stufe auf, aus der das Urteil tatsächlich stammt. Die Kennzeichnung ist Teil des Ergebnisses und wird nie weggelassen:

| Stufe | Evidenz | Wann verfügbar | Aussagekraft |
|---|---|---|---|
| 1 | **Gepaarter Test pro Segment** — standardmäßig approximative Randomisierung, gepaarter Bootstrap auf Anfrage (der oben beschriebene Algorithmus) | Nur wenn BEIDE Einträge einen vollständigen, aufeinander abgestimmten Satz von Scores pro Segment aufweisen | Der eigentliche Test |
| 2 | **Überlappung des 95%-Bootstrap-CI** auf den veröffentlichten Intervallgrenzen | Wenn die primäre Metrik Konfidenzintervallgrenzen für beide Einträge aufweist (chrF++ hat diese; BLEU und COMET haben keine Intervallspalten) | Eine konservative Näherung — überlappende Intervalle beweisen **keine** Äquivalenz, und eine Nicht-Überlappung ist eine strengere Hürde als ein gepaarter Test |
| 3 | **Punktgleichheit** bei der Anzeigerundung der Metrik | Immer | Die schwächste Stufe: Sie besagt lediglich, dass die beiden ausgegebenen Zahlen identisch sind |

### Versiegelte Wettbewerbe: Stufe 1 läuft auf dem Node

Stufe 1 benötigt Scores pro Segment von beiden Systemen. In einem versiegelten Wettbewerb hält der Evaluierungs-Node des Veranstalters die Referenzen und **exportiert niemals Ausgaben pro Segment**. Das ist der eigentliche Zweck der versiegelten Schiene, und dies ist keine Einstellung, die gelockert werden kann. Daher wandert der gepaarte Test stattdessen zu den Daten.

`mt-eval node verdicts` führt den contest-eigenen gepaarten Test auf dem Node aus, über die versiegelten Referenzen und jedes Paar von Einträgen, das er bewertet hat, und schreibt **nur Urteile**: für jedes Paar die Methode, den p-Wert, die Scoredifferenz, deren Konfidenzintervall und die Segmentanzahl. In der Datei befinden sich weder Segmente noch Referenzen oder Übersetzungen. Der Node signiert sie mit seinem Score-Signaturschlüssel. Die veranstaltende Person schließt den Wettbewerb anschließend mit `mt-eval contest close --node-verdicts <file> --verify-key <node public key>` ab. Das Ranking verwendet die Urteile nur, wenn die Signatur verifiziert werden kann und sie für diesen Wettbewerb, dessen versiegeltes Set, dessen Metrik, dessen festgeschriebene Gleichstandsregelung und dessen zugesagte Harness-Version berechnet wurden. Andernfalls verweigert der Abschluss die Ausführung.

Werden keine Urteile geliefert, beruhen die Gleichstände eines versiegelten Wettbewerbs auf der Überlappung der Konfidenzintervalle, sofern die Metrik Intervalle aufweist, und auf Punktgleichheit, wo dies nicht der Fall ist. Seine Cluster sind dann breiter als bei einem gepaarten Test. Das Ranking selbst gibt an, welcher Fall zutrifft: `ranking_method.evidence_used` nennt die tatsächlich verwendeten Stufen, und `ranking_method.node_verdicts` nennt den Node, dessen Urteile gegebenenfalls verwendet wurden.

### Was das Ranking nicht einstuft

- **Kontrastive Einträge** werden in ihrem eigenen Abschnitt aufgeführt und gewinnen nie.
- **Laufzeit, Hardware und Kosten** werden auf der Run-Card mitgeführt und berichtet, jedoch nie gerankt. Es gibt keinen Effizienz-Track.
- **Menschliche Beurteilung** ist in diesen Rankings überhaupt nicht enthalten. Eine *Auswahl* für die menschliche Evaluierung — welche Systeme ein festes Budget abdecken würde, wobei vollständige Gleichstandsgruppen herangezogen werden, damit ein Cluster niemals geteilt wird — kann für einen geschlossenen Wettbewerb erfasst werden, es liegen jedoch keine Bewertungen vor; siehe die [MT-Evaluierungsregeln](/docs/network/leaderboard/rules#verification-tiers).

---

## Modulübersicht

Wo die ausgelieferte Funktion angesiedelt ist:

| Datei | Rolle |
|---|---|
| `pyproject.toml` | `sacrebleu>=2.3` als feste Abhängigkeit deklariert |
| `mt_eval_harness/tester.py` | Direkter sacrebleu-Import (kein `HAS_SACREBLEU`-Guard); berechnet CIs pro Durchlauf |
| `mt_eval_harness/significance.py` | Gepaarte Tests (`paired_approximate_randomization`, Standard, und `paired_bootstrap`), `SignificanceResult`, integrierte Metrikfunktionen (chrF++, BLEU, spBLEU, TER, COMET aus zwischengespeicherten segmentweisen Scores, exakte Übereinstimmung; der ausgemusterte zusammengesetzte Score auf Segmentebene wird nur zum Lesen alter Vergleichsdateien beibehalten), `run_significance_tests`, `format_significance_table` |
| `mt_eval_harness/confidence.py` | Bootstrap-Konfidenzintervalle: `bootstrap_ci`, `compute_all_cis`, `compute_per_tier_cis`, `ConfidenceInterval` |
| `mt_eval_harness/__init__.py` | Exportiert `SignificanceResult`, `paired_bootstrap`, `ConfidenceInterval`, `bootstrap_ci`, `compute_all_cis` |
| `mt_eval_harness/compare.py` | Signifikanztests in den Berichtvergleich integriert |
| `mt_eval_harness/cli.py` | Flags `--significance` / `--method` / `--n-bootstrap` (Vergleich) und `--no-ci` / `--n-bootstrap-ci` (Test) |
| `mt_eval_harness/dashboard.py` | Zeigt Signifikanz in der Vergleichstabelle an (optionale Erweiterung) |

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

Die vom Harness berechneten deterministischen Metriken auf Korpusebene:
- `corpus_chrf` (chrF++-Score)
- `corpus_bleu` (BLEU-Score)
- `exact_match_rate` (0,0–1,0)
- `fst_acceptance_rate` (wenn FST-Daten vorhanden sind)


Das chrF++-Intervall ist Teil des veröffentlichten Hauptwerts (`chrF++ 47.5 [45.9, 49.0]`). CIs werden **auch** für `comet_score` berechnet, per Bootstrap aus den zwischengespeicherten Scores pro Eintrag ermittelt (keine redundante neuronale Inferenz). Für neue Durchläufe wird kein zusammengesetztes CI berechnet; das gespeicherte zusammengesetzte CI einer Legacy-Karte wird nur dann neu abgeleitet, wenn diese Karte verifiziert wird.

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

### COMET (eine Standardmetrik, sofern berechnet, neben chrF++)

COMET ist eine **neuronale Metrik, die neben dem chrF++-Hauptwert angezeigt wird**, wann immer sie berechnet wurde, zusammen mit ihrer Modell-ID. Sie wird niemals mit chrF++ vermischt und ist nicht der Hauptwert, da sie ein großes Modell erfordert und für die meisten ressourcenarmen Sprachen nicht kalibriert ist (siehe [Scoring-Spezifikation §2.3](/docs/network/specifications/scoring#2-metric-inventory)). Bootstrap-CIs werden über die zwischengespeicherten Scores pro Eintrag berechnet:
- Modell: `Unbabel/wmt22-comet-da` (referenzbasiertes Modell der WMT 2022); AfriCOMET wird für unterstützte afrikanische Sprachen automatisch ausgewählt
- Berechnet, wenn `unbabel-comet` installiert ist
- Scores pro Eintrag werden in den TestReport-Einträgen gespeichert; der Korpuswert enthält einen Kalibrierungshinweis für ressourcenarme Sprachen
- Vom Verifizierer neu abgeleitet — ein gemeldeter COMET-Wert muss reproduzierbar sein
- Optionale Abhängigkeit: `python3 -m pip install 'mt-eval-harness[comet]'` (oder `mt-eval setup --comet`)

### Supabase-Spalten

Die Tabelle `run_cards` enthält die entsprechenden Nullable-Spalten (siehe [scoring.md §9.1](/docs/network/specifications/scoring)):
- `chrf_plus_plus`, `chrf_ci_lower`, `chrf_ci_upper` (`real`) — der Hauptwert und sein 95%-Intervall
- `comet_score` (`real`) — neben dem Hauptwert angezeigt, nie vermischt
- `corpus_bleu` (`real`)

Der vollständige Satz an Konfidenzintervallen wird im Run-Card-JSON `scores` unter `confidence_intervals` gespeichert (gemäß dem Run-Card-Schema in scoring.md §9); lediglich die chrF++-Grenzen sind zusätzlich als Spalten denormalisiert.
