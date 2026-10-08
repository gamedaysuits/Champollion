---
sidebar_position: 5
title: "Bewertungsspezifikation"
slug: '/network/specifications/scoring'
related:
  - label: "Statistical Significance Testing"
    to: /docs/network/specifications/significance
    kind: spec
    note: "When a score difference actually means something"
  - label: "Benchmark Specification"
    to: /docs/network/specifications/benchmark
    kind: spec
  - label: "Eval Harness v2.0"
    to: /docs/network/specifications/harness
    kind: spec
    note: "The tool that computes these metrics"
  - label: "MT Evaluation Rules"
    to: /docs/network/leaderboard/rules
    kind: doc
  - label: "Live Leaderboard"
    to: https://champollion.dev/leaderboard
    kind: leaderboard
    note: "These scores, live"
---

# Bewertungsspezifikation

> **Zusammenfassung.** Dies ist die maßgebliche Referenz (Single Source of Truth) dafür, wie Durchläufe im Champollion-MT-Evaluierungsökosystem bewertet werden: die primäre Kennzahl (Headline-Metrik), die weiteren Standardmetriken, die daneben ausgewiesen werden, die separat erfassten Diagnosen sowie Kosten und Geschwindigkeit. Durchläufe werden so bewertet, wie es im Fachgebiet üblich ist: **chrF++ auf Korpusebene mit seiner sacreBLEU-Signatur und einem 95%-Bootstrap-Konfidenzintervall**, flankiert von BLEU, spBLEU, TER und COMET sowie gepaarten Signifikanztests, um zu entscheiden, ob ein System besser ist als ein anderes. Die sprachspezifischen Diagnosen (morphologische FST-Gültigkeit, Linter-Äquivalenzklassen, deterministische semantische Validierung) werden zusammenfassend als **LYSS** (Linguistically-informed Yield & Structural Scoring) bezeichnet. Der zuvor verwendete gewichtete Gesamtwert (Composite) und die Qualitätsstufen-Bezeichnungen sind **ausgemustert** (§4, §5); ihre Tabellen verbleiben hier nur, damit alte Karten weiterhin verifiziert werden können. Code, Dokumentation und Datenbankschemata leiten sich von diesem Dokument ab. Im Falle von Widersprüchen ist dieses Dokument maßgeblich.
>
> **Geltungsbereich.** Dieses Dokument definiert, *was* wir messen und *wie wir es bewerten*. Es definiert nicht das Schema der Durchlaufkarten (Run Cards; siehe BENCHMARK_SPEC §3), das Benchmark-Protokoll (BENCHMARK_SPEC §6) oder die Leaderboard-Regeln (siehe Arena-Dokumentation). Diese Dokumente verweisen für Metrikdefinitionen und Bewertungslogik auf dieses Dokument.


---

## Wie Durchläufe bewertet werden {#how-runs-are-scored}

Jeder neue Durchlauf wird nach dem **Bewertungsstandard `standard/1`** bewertet. Die Durchlaufkarte weist dies aus: `scores.scoring_standard` ist `"standard/1"` und `scores.primary_metric` ist `"chrf_plus_plus"`.

| Rolle | Gegenstand | Wo es erscheint |
|------|------|------------------|
| **Primäre Kennzahl und Ranking-Metrik** | **chrF++** auf Korpusebene (sacreBLEU-chrF mit `word_order=2`), 0–100, mit seinem 95%-Bootstrap-Konfidenzintervall und seiner sacreBLEU-Signatur | Ausgewiesen als `chrF++ 47.5 [45.9, 49.0]`, gefolgt von der Signatur. Durchlaufkarte: `scores.chrf_plus_plus`, das KI in `scores.confidence_intervals.corpus_chrf`, die Signatur in `scores.sacrebleu_signatures.chrf`. Datenbank: `chrf_plus_plus`, `chrf_ci_lower`, `chrf_ci_upper`. |
| **Weitere Standardmetriken** | BLEU, spBLEU (FLORES-200 SentencePiece), TER und COMET (sofern berechnet) | Neben chrF++ dargestellt, jeweils mit Signatur oder COMET-Modell-ID. Werden niemals mit chrF++ oder untereinander verrechnet. |
| **Diagnosen** | Exakte Übereinstimmung, FST-Akzeptanz, morphologische Genauigkeit, Code-Switching, Halluzination, Terminologietreue, Schreibstil und jeder Bewertungsvorbehalt (§2.8) | Separat ausgewiesen und als Diagnosen gekennzeichnet. Sie fließen niemals in eine primäre Kennzahl ein und bestimmen kein Ranking. Vorbehalte werden gut sichtbar neben der primären Kennzahl platziert. |
| **Kosten und Geschwindigkeit** | Tokens, US-Dollar, Latenz (§6, §7) | Neben der Bewertung ausgewiesen, niemals mit ihr kombiniert. |

**Entscheidung über „Besser“.** Zwei Durchläufe auf demselben Evaluierungsset werden mittels eines gepaarten Signifikanztests auf Basis von chrF++ verglichen (standardmäßig approximative Randomisierung, optional gepaartes Bootstrap-Resampling; §8.2). Die anderen Standardmetriken werden ebenfalls getestet und angezeigt. Ein Unterschied, der statistisch nicht signifikant ist, wird als nicht signifikant ausgewiesen – unabhängig davon, wie die beiden Zahlenwerte lauten.

**Keine Qualitätsstufen.** Eine automatische Bewertung ist kein Qualitätsurteil. Neue Karten tragen weder eine Stufe noch Bezeichnungen wie „funktional“ oder „einsatzbereit“; nur eine menschliche Evaluierung durch Sprecher bestätigt die Qualität ([BENCHMARK_SPEC §7](/docs/network/specifications/benchmark#7-human-validation)).

**Was ausgemustert wurde.** Neue Karten veröffentlichen `composite: null`, `quality_tier: null` und `cost_adjusted: null` (der kostenbereinigte Wert ergab sich aus dem Gesamtwert geteilt durch einen Kostenfaktor; die Kosten selbst werden weiterhin ausgewiesen). Keine neue Ausgabe enthält mehr einen Gesamtwert oder eine Stufe. Vor Einführung des Standards veröffentlichte Karten behalten ihren gespeicherten Gesamtwert und bleiben verifizierbar: Der Prüfer (Verifier) leitet für Karten ohne `scoring_standard` den Wert anhand der alten Berechnungsmethode (§4) ab, und für `standard/1`-Karten durch Neuberechnung von chrF++. Wo der Gesamtwert einer alten Karte noch angezeigt wird, ist er als **Legacy-Gesamtwert (ausgemustert)** gekennzeichnet.

**Warum dies der Standard ist.** So berichtet das Fachgebiet über MT-Evaluierungen:

- **WMT** stuft die Systeme seiner Shared Tasks anhand menschlicher Evaluierungen ein und weist automatische Metriken daneben mit sacreBLEU-Signaturen aus, damit die Zahlen reproduziert werden können (Post 2018; Kocmi et al. 2024).
- **FLORES-200** (NLLB Team 2022) berichtet chrF++ und spBLEU für 200 Sprachen, die meisten davon ressourcenarm (Low-Resource).
- **AmericasNLP**-Shared-Tasks zur Übersetzung in indigene Sprachen Amerikas stufen Systeme nach chrF ein (Mager et al. 2021; Ebrahimi et al. 2023), da Zeichen-N-Gramme mit morphologisch reichen Sprachen besser umgehen können als BLEU auf Wortebene (Popović 2015, 2017).
- Kocmi et al. (2021) stellten beim Vergleich automatischer Metriken mit Tausenden menschlicher Bewertungen fest, dass das Ausmaß eines Metrikunterschieds und dessen statistische Signifikanz die menschliche Präferenz vorhersagen; deshalb basieren Vergleiche hier auf gepaarten Signifikanztests (Koehn 2004; Riezler & Maxwell 2005) und nicht auf dem bloßen Nebeneinanderstellen zweier Zahlen.

**Wettbewerbe.** Als Qualifikationskriterium eines Wettbewerbs dient ausschließlich chrF++ auf einer Skala von 0–100, und das `primary_metric` eines Wettbewerbs ist standardmäßig `chrf_plus_plus`. Ein neuer Wettbewerb, der `composite` als Metrik anfordert, wird mit Begründung abgelehnt; vor dem Standard erstellte Wettbewerbe funktionieren weiterhin. Ein Veranstalter kann in den Preisbedingungen nach wie vor diagnostische Hürden (Gates) festlegen (z. B. eine Mindest-FST-Akzeptanz), die eine Einreichung bestehen muss – jedoch niemals als Bewertungspunktzahl ([Preis-Spezifikation](/docs/network/specifications/prizes)).

**Änderung des Standards.** Die primäre Kennzahl ändert sich nur mit einer neuen Standardversion (`standard/2`). Jede Karte benennt den Standard, nach dem sie bewertet wurde, und wird gemäß diesem Standard verifiziert.

---

## 1. Bewertungsphilosophie

### 1.1 Microeval-Philosophie

> *"Wenn wir uns nur auf das konzentrieren, was verallgemeinerbar ist, werden wir zwangsläufig vergessen, wo es das nicht ist — und diese Sprachen mit all ihrem Wissen und ihrer Weisheit verlieren."*

Dieses Projekt praktiziert **Microeval-Entwicklung**: den Aufbau von Bewertungsmetriken, die mit den besten verfügbaren linguistischen Werkzeugen auf bestimmte Sprachen zugeschnitten sind — endliche Automaten (Finite-State-Transducer), zweisprachige Wörterbücher, morphologische Analysewerkzeuge, von Linguisten kuratierte Äquivalenzregeln. Dies ist das Gegenteil des vorherrschenden Paradigmas in der MT-Bewertung, das universelle Metriken sucht, die sprachübergreifend funktionieren. Universelle Metriken sind wertvoll, aber sie sind gerade dort am schwächsten, wo sie am dringendsten benötigt werden: bei Sprachen mit komplexer Morphologie, begrenzten Trainingsdaten und ohne Vertretung in neuronalen Metrik-Trainingsdatensätzen.

Bei vielen Sprachen der Welt kommen wir in der maschinellen Übersetzung nicht nur deshalb nicht voran, weil uns Korpora fehlen, sondern weil **wir nicht einmal wissen, wie Fortschritt aussieht** — uns fehlen die automatisierten Bewertungswerkzeuge, um zu messen, ob sich ein Übersetzungssystem verbessert. LYSS ist unser Versuch, diese Werkzeuge Sprache für Sprache aufzubauen, unter Verwendung sämtlicher vorhandener linguistischer Ressourcen.

### 1.2 Automatisierte Metriken sind Näherungswerte

Jede hier definierte Metrik wird maschinell berechnet. Sie sind nützlich für schnelle Iterationen, systematische Vergleiche und das Erkennen von Regressionen. Sie sind **kein Ersatz für menschliches Urteilsvermögen**, weshalb keine automatische Bewertung eine Qualitätsstufe erhält – nur eine menschliche Überprüfung kann die tatsächliche Nutzbarkeit bestätigen.

### 1.3 Eine primäre Kennzahl, viele Signale

Keine einzelne Metrik erfasst die Übersetzungsqualität vollständig. Eine Übersetzung kann eine hohe chrF++-Übereinstimmung aufweisen, aber bei der morphologischen Validierung scheitern. Sie kann FST-Prüfungen bestehen, aber die falsche Bedeutung transportieren. Sie kann semantisch präzise sein, aber stilistisch fremd in der Zielsprache wirken. Daher liefert jeder Durchlauf viele Signale – aber nur eines davon, chrF++, ist die primäre Kennzahl und das Ranking-Kriterium; die übrigen werden daneben dargestellt und niemals damit vermischt. Eine Vermischung von Signalen, die für verschiedene Sprachen Unterschiedliches bedeuten, kann von Systemen ausgenutzt werden, die bei leicht zu erfüllenden Signalen gut abschneiden (§4 dokumentiert, wie dies beim ausgemusterten Gesamtwert der Fall war), und Leser können an einem aggregierten Wert nicht erkennen, welches Signal sich verändert hat.

### 1.4 Erweiterbarkeit

Dieser Metrikkatalog ist nicht abgeschlossen. Neue Sprachen bringen neue Anforderungen mit sich: Tongenauigkeit bei Tonsprachen, diakritische Präzision bei semitischen Schriften, Silbenschrift-Korrektheit für Cree. Die Architektur (MetricPlugin-Protokoll) erlaubt das Hinzufügen von Diagnosen, ohne dass sich die primäre Kennzahl ändert. Sprachspezifische Metriken (z. B. der Linter und der semantische Validator für CRK) werden auf Sprachkarten unter `evalMetrics` deklariert und aus `eval_standards/` geladen – die Testumgebung (Harness) wird standardmäßig nur mit generischen Verhaltensmetriken ausgeliefert (Code-Switching, Halluzination, Terminologie).

### 1.5 Drei Bewertungsdimensionen

Jede Run Card misst drei unabhängige Dimensionen:

```
Quality   — How close is the translation to the reference?   (chrF++ headline + standard metrics + diagnostics)
Cost      — How much does it cost?                           (cost metrics, §6)
Speed     — How fast does it run?                            (speed metrics, §7)
```

Dies sind voneinander unabhängige Dimensionen. Eine Methode kann gut bewertet, aber teuer sein; sie kann schnell, aber ungenau sein – oder jede beliebige Kombination davon. Das Leaderboard ermöglicht das Sortieren nach jeder Dimension. Kein veröffentlichter Zahlenwert fasst sie zusammen (der kostenbereinigte Wert, der dies tat, §6.3, ist ausgemustert).

### 1.6 Validierungsstatus

Jede Metrik in dieser Spezifikation hat einen **Validierungsstatus**, der sich von ihrem Implementierungsstatus (§3) unterscheidet. Der Implementierungsstatus verfolgt, ob Code existiert. Der Validierungsstatus verfolgt, ob nachgewiesen wurde, dass die Metrik mit menschlichen Qualitätsurteilen korreliert.

| Validierungsstufe | Bedeutung | Aktuelle Metriken |
|------------------|---------|----------------|
| **✅ Extern validiert** | Veröffentlichte Studien zur Human-Korrelation existieren (WMT, wissenschaftliche Arbeiten) | `chrf_plus_plus`, `bleu`, `comet_score` *(nur ressourcenreiche Sprachpaare)* |
| **⚡ Näherungsvalidiert** | Für ressourcenreiche Sprachen validiert; für unsere Ziel-LRLs nicht validiert | `comet_score` *(für LRLs: validiert an ressourcenreichen/EU-Paaren, extrapoliert z. B. auf CRK — richtungsweisend nützlich, aber nicht kalibriert)* |

| **🔶 Technische Heuristik** | Auf Basis linguistischer Prinzipien oder beobachteter Fehlermuster entworfen; keine Daten zu Korrelationen mit menschlichen Urteilen | `fst_acceptance_rate`, `morphological_accuracy` (FST-basiert, Lemma-abgeglichen, vom Prüfer neu abgeleitet), `equivalent_match_rate`, `semantic_score`, `code_switching_rate`, `hallucination_rate`, `terminology_adherence` |
| **🔲 Nicht validiert** | Noch auf keinen Daten getestet | `orthographic_accuracy`, `consistency_score` |

> **Warum `comet_score` in zwei Zeilen erscheint.** Dies ist eine Unterscheidung nach Ressourcenausstattung, kein Widerspruch. COMET ist dort *extern validiert*, wo WMT-Studien zur Korrelation mit menschlichen Urteilen existieren – also bei ressourcenstarken, meist europäischen Sprachpaaren. Für unsere ressourcenarmen Zielsprachen gibt es keine solchen Studien, daher ist dieselbe Metrik dort nur *proxy-validiert*: Das Modell extrapoliert von Sprachen mit anderen morphologischen Systemen. Sie wird neben chrF++ mit ihrer Modell-ID und einem Kalibrierungsvorbehalt ausgewiesen, niemals damit vermischt.

> **Was das in der Praxis bedeutet.** Die primäre Kennzahl (chrF++) ist eine extern validierte Metrik, die so eingesetzt wird, wie es im Fachgebiet üblich ist. Jede obige technische Heuristik ist eine **Diagnose**: Sie kann erklären, *warum* ein Durchlauf so bewertet wurde, wie er bewertet wurde (die Wörter sind keine gültigen Formen, die Ausgabe wechselte ins Englische), stellt jedoch niemals eine Gesamtpunktzahl dar und bestimmt kein Ranking. Der ausgemusterte Gesamtwert (§4) bezog Heuristiken aller Validierungsstufen in die Hauptbewertung ein, sodass ein System den Großteil der Punkte erzielen konnte, ohne tatsächlich zu übersetzen (§4).
>
> **Erforderliche Validierungsexperimente** (siehe `mt-evaluation-landscape.md` §6 und `speaker-validation.md`):
> 1. Korrelationsstudie mit menschlichen Urteilen: 200+ Satzpaare, bewertet von 3+ zweisprachigen Sprechern
> 2. Messung der FST-Falsch-Rückweisungsrate (False Rejection Rate) auf einem repräsentativen Korpus
> 3. Portierung auf eine Zweitsprache (Nordsamisch) zur Überprüfung der Generalisierbarkeit
> 4. Direkter Vergleich mit COMET auf denselben Daten


---

## 2. Metrikinventar {#2-metric-inventory}

Metriken sind in sechs Kategorien unterteilt (Oberfläche, Struktur, Semantik, Verhalten, Konformität und ausgewiesene Vergleichsmetriken). Jede Metrik besitzt einen Implementierungsstatus, eine Skala und eine Ebene (pro Eintrag, auf Korpusebene oder beides) sowie eine von drei Rollen im Rahmen des Standards: **Primär** (nur chrF++), **Standard** (BLEU, spBLEU, TER, COMET – neben der primären Kennzahl dargestellt) oder **Diagnose** (alles andere – separat ausgewiesen).

### 2.1 Oberflächenmetriken

Oberflächenmetriken vergleichen die vorhergesagte Übersetzung mit der Referenzübersetzung auf Zeichenkettenebene. Sie erfordern keine linguistischen Werkzeuge — nur einen Zeichenkettenvergleich.

| ID | Metrik | Status | Skala | Ebene | Implementierung |
|----|--------|--------|-------|-------|---------------|
| `exact_match_rate` | Exakte Übereinstimmung | ✅ Implementiert | 0,0–1,0 | Beides | **Diagnose.** Binär: Entspricht Vorhersage == Referenz? Korpusrate = Treffer / Gesamt. |
| `equivalent_match_rate` | Äquivalente Übereinstimmung | ⚡ Teilweise | 0,0–1,0 | Beides | **Diagnose.** Entspricht die vorhergesagte Ausgabe einer akzeptierten Variante? Für CRK: implementiert über `CrkLinterMetric` des CRK-Evaluierungsstandards (in `eval_standards/crk/`) unter Verwendung deterministischer Variantenklassenregeln (Wortstellung, Orthografie, optionale Partikel, Lemma-Synonym, progressive Ambiguität). Wird automatisch über die Deklaration `evalMetrics` der CRK-Sprachkarte geladen. Eine generische sprachübergreifende Implementierung erfordert eintragsspezifische `variants[]` im Korpus. |
| `chrf_plus_plus` | chrF++ | ✅ Implementiert | 0–100 | Beides | **Primäre Metrik und Ranking-Kennzahl.** Zeichen-N-Gramm-F-Score mit Wort-Unigrammen und -Bigrammen (sacreBLEU-chrF, `word_order=2`; Popović 2017). Robust gegenüber morphologischer Variation. Der veröffentlichte Wert bezieht sich auf Korpusebene (`corpus_chrf`), mit einem 95%-Bootstrap-KI und seiner sacreBLEU-Signatur; eintragsspezifische Werte (`sentence_chrf`) speisen die Signifikanztests. |
| `bleu` | BLEU | ✅ Implementiert | 0–100 | Korpus | **Standardmetrik, neben chrF++ dargestellt** (Durchlaufkarte und Datenbank `corpus_bleu`, mit sacreBLEU-Signatur). N-Gramm-Präzision auf Wortebene (Papineni et al. 2002). Nicht als primäre Kennzahl verwendet, da der Abgleich auf Wortebene ein korrektes Wort mit abweichendem Suffix als vollständigen Fehlschlag wertet, was morphologisch reiche Sprachen benachteiligt. |
| `ter` | Translation Edit Rate | ✅ Implementiert | 0–∞ (niedriger ist besser) | Beides | **Standardmetrik, neben chrF++ dargestellt** (`scores.ter`, mit sacreBLEU-Signatur). Minimale Editierdistanz zwischen Vorhersage und Referenz, normalisiert anhand der Referenzlänge (sacreBLEU `corpus_ter`; Snover et al. 2006). |
| `length_ratio` | Längenverhältnis | ✅ Implementiert | 0–∞ (1,0 ist ideal) | Beides | **Diagnose.** `len(predicted) / len(reference)` in Zeichen. Erkennt Verkürzungen (<0,5) und Aufblähung/Halluzination (>2,0). Auf Korpusebene über alle Einträge gemittelt. |

### 2.2 Strukturmetriken

Strukturmetriken validieren die linguistische Wohlgeformtheit der Übersetzung. Sie erfordern sprachspezifische Werkzeuge (FST-Analysewerkzeuge, morphologische Parser) und sind die stärksten Signale für morphologisch reiche Sprachen.

| ID | Metrik | Status | Skala | Ebene | Implementierung |
|----|--------|--------|-------|-------|---------------|
| `fst_acceptance_rate` | FST-Akzeptanz | ✅ Implementiert | 0,0–1,0 | Beides | **Diagnose.** Akzeptanz der Ausgabewörter durch einen Finite-State-Transducer (GiellaLT). Ein Wort ist „gültig“, wenn der FST mindestens eine morphologische Analyse liefert. **Aggregation:** Der veröffentlichte Korpuswert ist der **Mittelwert der eintragsbezogenen Raten** – die akzeptierten Wörter jedes Eintrags ÷ dessen Wörter, gemittelt über die vom FST analysierten Einträge, wobei eine leere Ausgabe als 0 zählt (`avg_fst_validity` des Plugins). Die gepoolte Wortrate (alle akzeptierten Wörter ÷ alle Wörter, `corpus_validity_rate`) wird daneben im Durchlaufbericht und auf der Durchlaufkarte ausgewiesen, ist jedoch nicht der veröffentlichte Wert; beide weichen voneinander ab, wenn Einträge unterschiedliche Längen haben. Verfügbar für jede Sprache mit einem GiellaLT-`.hfstol`-Analysator. **Groß-/Kleinschreibung:** Ein Wort wird so nachgeschlagen, wie es geschrieben steht; weist der FST es zurück und beginnt es mit einem Großbuchstaben, wird es erneut mit kleingeschriebenem Anfangsbuchstaben nachgeschlagen (`Mun` → `mun`), und ein durchgehend GROSSGESCHRIEBENES Wort als Titlecase und anschließend in Kleinschreibung (`OSLO` → `Oslo`, `GIITU` → `giitu`). Niemals umgekehrt: Ein kleingeschriebenes Eigennamenwort (`oslo`) bleibt zurückgewiesen. Die Rechtschreibprüfungs-Akzeptoren von GiellaLT (Nordsamisch, Amharisch, Baskisch) und der strikte Plains-Cree-Analysator des ALTLab führen die meisten Wörter nur in Kleinschreibung auf und überlassen die Groß-/Kleinschreibung dem umschließenden Programm; ohne diese Anpassung zählte ein korrekter Satzanfangsbuchstabe daher als ungültiges Wort. Dies entspricht der Berechnungsversion `case-fallback/1`, ausgewiesen im Bericht (`fst_acceptance_method`, mit `total_case_folded_words` und dem `fst_case_folded_words` jedes Eintrags) sowie auf der Durchlaufkarte (`fst_provenance.acceptance_method`). Ein Bericht ohne diese Angabe wurde unter Beachtung der Groß-/Kleinschreibung bewertet und fällt bei großgeschriebenem Text niedriger aus; `mt-eval compare` weist beim Vergleich beider darauf hin, und `mt-eval test <run log>` bewertet einen alten Durchlauf neu. Der Prüfer leitet die FST-basierten Zahlen einer veröffentlichten Karte anhand der von dieser Karte genannten Methode ab, und bei einer Karte ohne Angabe unter Beachtung der Groß-/Kleinschreibung, sodass eine Karte stets anhand der Berechnung geprüft wird, mit der sie veröffentlicht wurde. |
| `morphological_accuracy` | Morphologische Genauigkeit | ✅ Implementiert (vom Prüfer neu abgeleitet) | 0,0–1,0 | Beides | **Diagnose.** Ein Wort kann FST-gültig sein, aber die falsche Flexion aufweisen (richtiger Wortstamm, falsches Suffix). **Berechnet** durch `plugins/giellalt_fst.py`: Für jedes analysierbare vorhergesagte Wort wird ein Referenzwort gesucht, das dasselbe **Lemma** (Stamm) teilt, und geprüft, ob die vorhergesagte **Flexion** (FST-Merkmalstags) übereinstimmt. Der Abgleich nach Lemma – statt nach Position – umgeht das Problem der Wortausrichtung: Eine abweichende Wortwahl oder ein nicht abgeglichenes Paar ist schlicht nicht *abgedeckt* (wird niemals fälschlich bewertet). **Keine Gold-Annotationen erforderlich** – die FST-Analyse der Referenz *ist* die Grundwahrheit. Wörter, die der FST nicht analysieren kann oder deren Stamm nicht in der Referenz enthalten ist, fallen aus der Abdeckung; `morph_coverage` (der Anteil mit Lemma-Übereinstimmung) wird offengelegt, und unterhalb von `MORPH_COVERAGE_FLOOR` (0,25) wird der Wert als rein hinweisend markiert. Die Auswertung ist **tolerant bei FST-Ambiguität** (ein vorhergesagtes Wort mit mehreren Analysen gilt als „korrekt“, wenn *irgendeine* passt → eine Obergrenze, die offengelegt wird). Sie erfordert einen **Analysator**: Ein FST, der lediglich ein Rechtschreibprüfungs-**Akzeptor** ist (die installierten Divvun-Speller-Pakete für Nordsamisch, Amharisch und Baskisch), gibt nur an, ob ein Wort existiert, liefert jedoch weder Lemma noch Tags. Für diese Sprachen sind `morphological_accuracy` und `morph_coverage` null, und `metric_availability` erläutert den Grund; die FST-Akzeptanz wird dennoch ausgewiesen. Der FST-Pin deklariert dies (`kind: "acceptor"`), und die Metrik erkennt zudem Transducer, die niemals ein Tag zurückgeben. Sie wird **vom Prüfer anhand des kanonischen Korpus neu abgeleitet** (`verifier.recompute_corpus_morph`, wodurch der auf der Karte festgelegte FST erneut ausgeführt wird – Fail-Closed bei fehlendem FST, nach demselben Prinzip wie COMET). Unter dem ausgemusterten Gesamtwert floss sie im fst-coverage-Profil mit einer Gewichtung von 0,15 ein (§4.3). |
| `orthographic_accuracy` | Orthografische Genauigkeit | 🔲 Geplant | 0,0–1,0 | Beides | **Diagnose (geplant).** Validiert die schriftspezifische Korrektheit: SRO-Makron-/Zirkumflex-Verwendung für Cree, diakritische Zeichen für Inuktitut, Vokallängenmarkierungen für Ojibwe. Sprachspezifische Regelsätze. |

> **Was strukturelle Metriken beitragen und warum sie Diagnosen sind.** Metas OMT-1600 – das größte je veröffentlichte MT-System (1.600 Sprachen; Meta AI, *Omnilingual MT*, arXiv:2603.16309, 2026) – evaluiert mit ChrF++, xCOMET, MetricX und BLASER 3. Keines davon validiert die morphologische Korrektheit: chrF++ misst die Überlappung von Zeichen-N-Grammen und belohnt Zeichenketten, die der Referenz *ähneln*; ein morphologisch ungültiges Wort, das viele Zeichen mit der Referenz teilt, erhält somit dennoch Punkte. Die FST-Akzeptanz beantwortet eine andere Frage: Ist jedes Wort eine gültige Form in der Sprache? Das macht sie zu einer nützlichen Diagnose für polysynthetische Sprachen. Sie ist jedoch keine Übersetzungsbewertung: Sie prüft weder die Quelle noch die Referenz; ein System, das für jede Eingabe denselben gültigen Satz ausgibt, besteht sie vollständig (§4 führt den gemessenen Fall an). ChrF++ besitzt zudem eine **Zufallsuntergrenze über Null (Nonzero Chance Floor)**, die je nach Orthografie variiert – zufälliger Text im selben Schriftsystem erzielt messbar Werte über null, in manchen Schriftsystemen mehr als in anderen. Daher ist das reine chrF++ nicht sprachübergreifend vergleichbar; es ordnet Systeme nur innerhalb desselben Evaluierungssets ein. Die Netzwerkkarte vergleicht daher die Leistungsstärke zwischen verschiedenen Sprachen **nicht** – ein Verbindungspfad bedeutet lediglich, dass das Paar gemessen wurde, nicht mehr. Die Zufallsuntergrenzen-Korrektur, die wir hierfür entwickelt haben (cchrF++), ist publizierte Forschung und an keine öffentliche Benutzeroberfläche angebunden; [Verbindungsstärke](/docs/network/specifications/connection-strength) erläutert, was sie leistet und was nicht.

### 2.3 Semantische Metriken

Semantische Metriken messen die Bedeutungserhaltung mithilfe von Einbettungen oder gelernten Modellen. Sie erkennen Übersetzungen, die sich in der Oberfläche unterscheiden, aber bedeutungsäquivalent sind, und markieren Übersetzungen, die oberflächlich ähnlich, aber semantisch falsch sind.

| ID | Metrik | Status | Skala | Ebene | Implementierung |
|----|--------|--------|-------|-------|---------------|
| `semantic_score` | Semantische Ähnlichkeit | ⚡ Teilweise | 0,0–1,0 | Beides | **Diagnose.** CRK: urteilswert-gewichteter Score aus `CrkSemanticMetric` des CRK-Evaluierungsstandards (in `eval_standards/crk/`, Proxy). Universell: Kosinus-Ähnlichkeit von Satz-Embeddings (Quelle + Vorhersage vs. Quelle + Referenz). Modell noch offen (TBD) – muss ressourcenarme Sprachen unterstützen, was die meisten englischzentrierten Embedding-Modelle ausschließt. |
| `comet_score` | COMET | ✅ Implementiert | ~0,0–1,0 | Beides | **Standardmetrik, sofern berechnet; neben chrF++ mit Modell-ID dargestellt** (`comet_model`). Gelernte MT-Evaluierungsmetrik (Rei et al. 2020). Wird niemals mit chrF++ verrechnet. Wird vom Prüfer neu abgeleitet, ein ausgewiesener Wert muss also reproduzierbar sein. Für Sprachen wie Plains Cree mit einem Kalibrierungsvorbehalt für ressourcenarme Sprachen versehen. Berechnet, wenn `unbabel-comet` installiert ist. Für 35 afrikanische Sprachen wählt die Testumgebung über `resolve_comet_model()` automatisch AfriCOMET (`masakhane/africomet-mtl`) aus, da dieses für diese Sprachen eine bessere Korrelation mit menschlichen Urteilen aufweist. |

> **Warum COMET neben der primären Kennzahl steht und nicht die primäre Kennzahl ist.** COMET wird auf Basis von WMT-Evaluierungsdaten menschlicher Prüfer trainiert – überwiegend ressourcenstarke europäische Paare. Für tatsächlich ressourcenstarke Paare (Deutsch, Französisch, …) ist das standardmäßige `Unbabel/wmt22-comet-da` durch WMT gut validiert, und `resolve_comet_model()` wählt es aus. Angewendet auf Plains Cree oder andere ressourcenarme Sprachen extrapoliert das Modell von Sprachen mit völlig anderen morphologischen Systemen – richtungsweisend nützlich, aber unkalibriert, worauf die Karte ausdrücklich hinweist. Zudem erfordert es ein 2,3-GB-Modell, weshalb es nicht für jeden Durchlauf berechnet wird. chrF++ ist für jede Sprache und Schrift allein anhand des Korpus reproduzierbar; deshalb ist es die primäre Kennzahl und COMET wird daneben ausgewiesen, wann immer es berechnet wurde.

> **AfriCOMET für afrikanische Sprachen.** Jede Sprachkarte hat ein `metricModelSupport`-Feld (siehe Sprachkarten-Spezifikation §9), das deklariert, welche spezialisierten COMET-Modelle für diese Sprache trainiert sind. Für 35 afrikanische Sprachen (yor, hau, ibo, amh, swa usw.) deklariert die Karte AfriCOMET (`masakhane/africomet-mtl`) — ein COMET-Modell, das von der Masakhane-Community anhand von menschlichen MT-Urteilen für afrikanische Sprachen feinabgestimmt wurde. Die Harness wählt das empfohlene Modell automatisch über `resolve_comet_model()` aus, das aus den Sprachkarten liest, dies kann jedoch mit `--comet-model` überschrieben werden. Das Hinzufügen neuer Sprache→Modell-Zuordnungen erfolgt durch Anreicherung der Sprachkarte (nicht durch Bearbeiten von Python-Code).

### 2.4 Verhaltensmetriken

Verhaltensmetriken erkennen spezifische Fehlermuster in Übersetzungsausgaben. Sie messen Qualität nicht direkt, sondern decken Probleme auf. Alle diese Metriken sind **Diagnosen**.

| ID | Metrik | Status | Skala | Ebene | Implementierung |
|----|--------|--------|-------|-------|---------------|
| `code_switching_rate` | Code-Switching-Rate | ✅ Implementiert | 0,0–1,0 (niedriger ist besser) | Beides | Anteil der Ausgabewörter, die in der Ausgangssprache (typischerweise Englisch) verbleiben. Erkannt über Unicode-Schriftanalyse und/oder eine Wortliste der Ausgangssprache. Sehr häufiges LLM-Fehlermuster: Das Modell fügt englische Wörter ein, wenn es die Entsprechung in der Zielsprache nicht kennt. |
| `hallucination_rate` | Halluzinationsrate | ✅ Implementiert | 0,0–1,0 (niedriger ist besser) | Beides | Anteil des Ausgabeinhalts, für den es keinen entsprechenden Ausgangsinhalt gibt. Erkannt über Wortausrichtung oder sprachübergreifende Embedding-Überlappung. Erkennt Fälle, in denen das Modell plausibel klingende, aber frei erfundene Übersetzungen generiert. |
| `terminology_adherence` | Terminologietreue | ✅ Implementiert | 0,0–1,0 | Beides | Für instruierte Methoden (Coached Methods): Anteil der vorgegebenen Terminologiebegriffe, die in der Ausgabe erscheinen. Erfordert ein Glossar (`{"source term": "translation"}` oder eine Liste akzeptierter Übersetzungen pro Begriff). Die Quelle ist `--glossary <file.json>`, eine Evaluierungseingabe, die niemals an das Modell gesendet wird und jedem verglichenen Durchlauf bereitgestellt wird. Andernfalls ist es das `dictionary`-Objekt eines JSON-`--coaching-file`: Der Durchlauf wird dann anhand seiner eigenen Vorgaben bewertet, worauf die Ausgabe hinweist. Ohne beides ist die Metrik inaktiv (null). Misst, ob das Modell von Experten bereitgestelltes Vokabular berücksichtigt. |
| `consistency_score` | Eintragsübergreifende Konsistenz | 🔲 Geplant | 0,0–1,0 | Nur Korpus | Übersetzt das Modell denselben Ausgangsbegriff über verschiedene Einträge hinweg einheitlich? Geringe Konsistenz deutet darauf hin, dass das Modell eher rät, als gelernte Muster anzuwenden. Erfordert wiederkehrende Begriffe über Korpuseinträge hinweg. |

### 2.5 Konformitätsmetriken

Konformitätsmetriken prüfen, ob Übersetzungen die strukturelle Integrität wahren – Platzhalter, Formatierung und typografische Konventionen. Es handelt sich um Prüfungen für Qualitätsgrenzen (Quality Gates), nicht um Qualitätswerte; im Rahmen des Standards fungieren sie als Diagnosen.

| ID | Metrik | Status | Skala | Ebene | Implementierung |
|----|--------|--------|-------|-------|---------------|
| `compliance_index` | Double-Pass-Konformität | 🔲 Geplant | 0,0–1,0 | Beides | Gewichteter Gesamtwert: 60 % Variablenintegrität (bleiben `{placeholder}`-Variablen erhalten?) + 20 % Anführungszeichen-Konformität (die Anführungszeichen der Zielsprache) + 20 % Groß-/Kleinschreibungskonformität (kein Einfließen lateinischer Buchstaben bei Schriften ohne Groß-/Kleinschreibung). Berechnet sowohl für die Rohausgabe als auch für die nachbearbeitete Ausgabe. Eine `DoublePassCompliancePlugin`-Klasse existiert, wird jedoch von keinem Evaluierungsdurchlauf geladen, und es liegt bislang keine zitierte Quelle für zielsprachenspezifische Anführungszeichen- und Schreibweisenkonventionen vor. Sprachkarten enthalten diese nicht. Ohne diese Quelle misst lediglich der Term für die Variablenintegrität einen Wert. |
| `repair_effectiveness` | Reparatureffektivität | 🔲 Geplant | 0,0–1,0 | Korpus | Anteil der Konformitätsverstöße, die durch nachgelagerte Übersetzungshooks automatisch repariert wurden. Misst, wie stark das Quality Gate die Rohausgabe verbessert hat. Aus demselben Grund wie `compliance_index` geplant. |

> **Warum Konformität ein Gate und kein Wert ist.** Konformitätsmetriken messen die strukturelle Erhaltung (Platzhalter, Anführungszeichen), nicht die linguistische Übersetzungsqualität. Eine Übersetzung kann sprachlich perfekt sein, aber die Konformitätsprüfung nicht bestehen, weil eine `{name}`-Variable weggelassen wurde. Sie sind als Qualitätsfilter (Quality Gates) konzipiert, um fehlerhafte Ausgaben vor der Auslieferung zu blockieren, nicht um Übersetzungsqualität einzustufen.

### 2.6 Ausgewiesene Vergleichsmetriken

spBLEU ist eine der Standardmetriken, die neben chrF++ ausgewiesen werden; einfaches chrF und der FUSE-ähnliche Komparator werden zum Vergleich mit anderen veröffentlichten Tabellen berichtet. Keine davon wird mit anderen Werten vermischt:

| ID | Metrik | Status | Hinweise |
|----|--------|--------|-------|
| `spbleu` | spBLEU (FLORES-200-Tokenizer) | ✅ Implementiert | **Standardmetrik, neben chrF++ dargestellt** (`scores.spbleu`, mit sacreBLEU-Signatur). BLEU auf Basis der FLORES-200 SentencePiece-Tokenisierung (Goyal et al. 2022) – vergleichbar über Schriftsysteme und Segmentierungen hinweg (die NLLB/FLORES-Lingua-Franca). Benötigt `sentencepiece` (Kernabhängigkeit). |
| `chrf_plain` | Einfaches chrF (`word_order=0`) | ✅ Implementiert | Der chrF-Wert, den AmericasNLP und viele WMT-Tabellen ausweisen, neben unserer primären chrF++-Kennzahl (`word_order=2`). Seine Signatur lautet `sacrebleu_signatures.chrf_plain`. |
| `fuse_score` | FUSE-ähnlicher Komparator | ⚡ Opt-in (`--fuse`) | Eine **UNRAINIERTE Reimplementierung** des FUSE-Ansatzes von AmericasNLP-2025 (Raja & Vats): LaBSE semantisch + lexikalischer Token-F1 + phonetisches Soundex + Fuzzy-difflib, kombiniert als *ungewichteter Mittelwert* (uns fehlen Trainingsdaten aus menschlichen Bewertungen, um das ursprüngliche Ridge/GBM anzupassen, worauf hingewiesen wird). LaBSE/Soundex sind das optionale Extra `fuse`; ohne LaBSE gibt `compute_fuse` `None` zurück (offengelegt), anstatt einen Wert vorzutäuschen. Jede Komponente, die ausgeführt wurde, ist in `fuse_components` aufgeführt; das Ergebnis wird mit `fuse_untrained=true` markiert. Dient ausschließlich als diagnostischer Komparator. |

### 2.7 Metrik-Namensräume {#2-7-metric-namespaces}

Eine einzelne Metrik trägt bis zu vier koordinierte Namen über den Stack hinweg: die
**kanonische ID** (der `scores`-Schlüssel in einer Run Card, z. B. `equivalent_match_rate`),
den Python-**Plugin-Namen**, der sie berechnet (z. B. `crk_linter`), den Sprachkarten-**`evalMetrics`-Schlüssel**, der sie deklariert (z. B. `lyss-eq`), und die denormalisierte
**`run_cards`-Spalte** in der Rangliste (z. B. `equivalent_match_rate`). Diese sind
bewusst unterschiedlich — der Plugin-Name gibt das *Werkzeug* an, die Metrik-ID gibt die
*Messung* an — aber sie müssen im Gleichschritt bleiben.

Die maßgebliche Referenz für diese Zuordnung ist `shared/metric-registry.json`, geladen
durch `mt_eval_harness.metric_manifest`. Jeder Eintrag erfasst die vier Bezeichnungen sowie `scale`,
`direction` (höher/niedriger/neutral), `level` (Eintrag/Korpus/beides), `in_composite`
(ob er Teil des ausgemusterten Gesamtwerts war; beibehalten zur Verifizierung alter Karten) und
`verifier_reproducible`. Ein Paritätstest schlägt fehl, wenn die Tabellen von `scoring.py` oder die
von `publish.py` erzeugten `scores`-Schlüssel der Durchlaufkarte vom Register abweichen, sodass keine neue
Metrik unvollständig angebunden veröffentlicht werden kann.

Zwei zugehörige Run-Card-Felder machen die Metrikherkunft explizit:

- **`scores.metric_availability`** – ein `{metric: reason}`-Block, der ein
  `null`-Ergebnis aufschlüsselt: `not_applicable` (die Sprache/der Durchlauf verwendet es nicht), `unavailable`
  (eine optionale Abhängigkeit fehlte), `below_coverage_floor` (vorhanden, aber zu
  spärlich, um mehr als rein hinweisend zu sein), `not_run` (Opt-in und nicht angefordert) oder
  `not_implemented` (geplant). Eine im Block nicht aufgeführte Metrik wurde regulär berechnet.
- **`fst_version`** / **`fst_provenance`** – das installierte GiellaLT-Transducer-Release
  und die `pyhfst`-Version hinter jeder FST-basierten Metrik, auf dieselbe Weise erfasst
  wie die sacreBLEU-Signaturen, damit ein struktureller Wert auf einen exakten
  Analysator-Build zurückgeführt werden kann. `fst_provenance.acceptance_method` gibt an, wie die Akzeptanz
  aus den Antworten des Transducers berechnet wurde (`case-fallback/1`, §1); eine Karte ohne
  diese Angabe wurde unter Beachtung der Groß-/Kleinschreibung bewertet.
- **`scores.sacrebleu_signatures`** – die sacreBLEU-Signatur jeder
  sacreBLEU-Metrik, die der Durchlauf berechnet hat: `chrf` (die primäre chrF++-Kennzahl,
  `word_order=2`), `chrf_plain`, `bleu`, `spbleu`, `ter`. Zwei chrF++-Werte sind
  nur vergleichbar, wenn ihre Signaturen übereinstimmen (Post 2018).

### 2.8 Bewertungsvorbehalte {#2-8-score-caveats}

Ein Wert kann rechnerisch korrekt ermittelt worden sein und dennoch nicht das aussagen, was seine Bezeichnung suggeriert. Die
Testumgebung prüft jeden Durchlauf auf die bekannten Ursachen hierfür. Tritt ein Fall ein,
wird er neben der primären Kennzahl in der Testzusammenfassung, `mt-eval compare`, der
Veröffentlichungsvorschau und im Dashboard ausgegeben; die veröffentlichte Karte führt ihn als
`score_caveats`, sodass auch das Leaderboard ihn anzeigt. Ein Vorbehalt ändert niemals den Wert;
er legt dessen Grenzen dar. Jeder Vorbehalt ist eine Diagnose mit einem `severity` (`major` oder
`minor`) und einer einzeiligen Meldung, die Anzahlen nennt, niemals die Ausgaben
selbst.

| Vorbehalt | Greift, wenn |
|--------|-----------|
| `source_copy` | Mindestens die Hälfte der bewerteten Ausgaben entspricht exakt ihrer Quelle (Groß-/Kleinschreibung, Akzente und Zeichensetzung ignoriert). Einträge, deren Referenz selbst die Quelle ist (z. B. Namen, Zahlen), bleiben unberücksichtigt. |
| `length_deflation` | Ausgaben im Durchschnitt weniger als das 0,5-Fache der Referenzlänge aufweisen oder ein Viertel oder mehr dies tun – es wurden Wörter weggelassen. FST-Akzeptanz und Code-Switching bewerten nur die vorhandenen Wörter; das Weglassen von Wörtern führt daher zu besseren Werten. |
| `length_inflation` | Ausgaben im Durchschnitt mehr als das 2-Fache der Referenzlänge aufweisen oder ein Viertel oder mehr dies tun (beispielsweise wenn Few-Shot-Beispiele in jede Ausgabe einfließen). |
| `near_constant_output` | Eine einzige Ausgabe für viele unterschiedliche Eingaben generiert wird: Wiederholungen decken mindestens ein Viertel der verschiedenen Quellen und mindestens 5 davon ab. Eine Ausgabe gilt als Wiederholung, wenn 3 Quellen sie erhalten haben (bei Ausgaben von drei oder mehr Wörtern) oder 5 Quellen (bei Ein- oder Zwei-Wort-Ausgaben, da kurze Antworten wie „Ja.“ legitimerweise wiederkehren); eine Ausgabe, die ihrer eigenen Referenz entspricht, ist ein Treffer und keine unzulässige Wiederholung. Vor Festlegung dieser Schwellenwerte wurde die Regel an 2.161 realen Systemausgaben und Referenzen aus den WMT-Metrik-Tasks 2019–2025 getestet; die fünf markierten Fälle stellten ausnahmslos fehlerhafte Ausgaben dar. |
| `train_test_near_twin` | Von nmt-forge erzeugt: Jede (oder fast jede) Testzeile besitzt einen nahezu identischen Zwilling in den Trainingsdaten, sodass der Wert das Abrufen auswendig gelernter Trainingsphrasen misst, nicht die Übersetzung. |

---

## 3. Metrik-Statusstufen

Jede Metrik in §2 fällt in eine von vier Implementierungsstufen:

| Stufe | Bedeutung | Run-Card-Verhalten |
|------|---------|-------------------|
| **✅ Implementiert** | Code existiert, getestet, produziert heute Werte in Run Cards | Numerischer Wert in Run Card |
| **⚡ Teilweise** | Sprachspezifische Näherung existiert (z. B. CRK), aber universelle Implementierung steht noch aus | Numerischer Wert, wenn Näherung zutrifft, ansonsten `null` |
| **🔲 Geplant** | Spezifiziert, aber noch nicht implementiert | `null` in Run Card (Feld vorhanden, Wert fehlt) |
| **💡 Vorgeschlagen** | In Diskussion, noch nicht spezifiziert | Nicht in Run Card |

Eine Metrik wechselt von Geplant → Teilweise, wenn:
1. Eine sprachspezifische Implementierung zusammengeführt und getestet wurde
2. Sie Werte für mindestens ein Sprachpaar produziert
3. Die universelle Implementierung noch aussteht (in dieser Spezifikation dokumentiert)

Eine Metrik wechselt von Teilweise → Implementiert, wenn:
1. Eine sprachunabhängige Implementierung zusammengeführt und getestet wurde
2. Sie Werte für ein beliebiges Sprachpaar ohne sprachspezifische Plugins produziert
3. Dieses Dokument aktualisiert wird, um den ✅-Status widerzuspiegeln

Eine Metrik wechselt von Geplant → Implementiert, wenn:
1. Die Implementierung zusammengeführt und getestet wurde
2. Sie an mindestens einem echten Bewertungslauf validiert wurde
3. Dieses Dokument mit ihren Implementierungsdetails aktualisiert wird

Eine Metrik wechselt von Vorgeschlagen → Geplant, wenn:
1. Ihre Definition, Skala und Berechnungsmethode vereinbart sind
2. Sie diesem Dokument mit einem `🔲 Planned`-Status hinzugefügt wird
3. Ein Null-Platzhalter zum Run-Card-Schema hinzugefügt wird

---

## 4. Ausgemustert: der Gesamtwert (Legacy) {#4-composite-score}

> [!CAUTION]
> **Kein neuer Durchlauf wird mit dem Gesamtwert (Composite) bewertet.** Er wurde durch den Bewertungsstandard `standard/1` ausgemustert ([Wie Durchläufe bewertet werden](#how-runs-are-scored)). Neue Karten veröffentlichen `composite: null`. Dieser Abschnitt bleibt **ausschließlich** erhalten, damit vor Einführung des Standards veröffentlichte Karten weiterhin gelesen und verifiziert werden können: Der Prüfer leitet den gespeicherten Gesamtwert jeder Karte, die kein `scores.scoring_standard` aufweist, exakt nach der nachfolgenden Formel und den Tabellen ab. Wo der Gesamtwert einer alten Karte noch dargestellt wird, ist er als **Legacy-Gesamtwert (ausgemustert)** gekennzeichnet und wird niemals mit chrF++ oder mit einer neuen Karte verglichen.

### Warum er ausgemustert wurde {#why-the-composite-was-retired}

Der Gesamtwert war eine gewichtete Mischung aus chrF++/100, exakter Übereinstimmung, FST-Akzeptanz (Gewichtung 0,25), morphologischer Genauigkeit, dem semantischen Wert, Code-Switching, Halluzination und Terminologie – mit Gewichtungen, die nach technischem Ermessen festgelegt und niemals anhand menschlicher Urteile kalibriert wurden. Da mehrere Eingangsgrößen die Ausgabe zu keinem Zeitpunkt mit der Quelle oder der Referenz abgleichen, konnte ein System den Großteil der Punkte erzielen, ohne tatsächlich zu übersetzen:

- **Ein einziger Satz für jede Eingabe.** Ein untrainiertes Englisch→Nordsamisch-Modell, das für jede Eingabe denselben gültigen nordsamischen Satz wiederholte, erzielte einen Gesamtwert von **0,6244** – eingestuft als „funktional“ – bei einem **chrF++ von 5,5**. Die wiederholten Wörter sind gültiges Samisch, sodass die FST-Akzeptanz 100 % betrug. Bei einer Sprache, deren FST ein Rechtschreibprüfungs-Akzeptor ist, trug die FST-Akzeptanz nach der Umverteilung fehlender Metriken rund 45 % zum Gesamtwert bei.
- **Weglassen unübersetzbarer Wörter.** Ein simples Testglossar, das jedes unbekannte Wort ausließ, erzielte **0,6612**, da FST-Akzeptanz und Code-Switching nur die in der Ausgabe vorhandenen Wörter beurteilen.
- **Kopieren der Quelle.** Unverändert als „nordsamische“ Ausgabe übernommenes Englisch erhielt dennoch FST-Punkte, da eine Rechtschreibprüfung großgeschriebene und manche englische Wörter akzeptiert.

Keine Standardevaluierung würde solche Systeme besser als eine echte Übersetzung einstufen, und chrF++ tut dies auch nicht: Es gleicht jede Ausgabe mit ihrer Referenz ab. Die Vorbehalte der Testumgebung (§2.8) erkennen diese Muster ebenfalls und werden stets gut sichtbar neben der primären chrF++-Kennzahl ausgewiesen.

### 4.1 Formel (Legacy)

Der Gesamtwert war ein gewichteter Mittelwert aller *verfügbaren* Metriken, renormiert, sodass die Gewichte der verfügbaren Metriken in der Summe 1,0 ergeben:

```
composite = Σ (weight_i × value_i)    for all available metrics
             ─────────────────────
             Σ weight_i               (re-normalization denominator)
```

Eine Metrik gilt als „verfügbar“, wenn ihr Wert in der Durchlaufkarte eine Zahl ist (nicht `null`). War eine Metrik nicht verfügbar – weil für die Sprache kein FST existiert oder die Metrik noch nicht implementiert ist –, wurde ihr Gewicht proportional auf die verbleibenden Metriken umverteilt. Gesamtwerte, die aus unterschiedlichen Metrik-Sets berechnet wurden, waren niemals untereinander vergleichbar; jede Legacy-Karte dokumentiert ihr `scores.scoring_profile` und `scores.metric_availability` (§2.7), sodass der Prüfer weiß, welches Set anzuwenden ist.

### 4.2 Eingangsnormierung (Legacy)

Vor dem Einfließen in die Formel des Gesamtwerts wurde jede Metrik auf eine **Skala von 0,0–1,0** normiert, wobei 1,0 = perfekt bedeutet:

| Metrik | Native Skala | Normalisierung |
|--------|-------------|----------------|
| `exact_match_rate` | 0.0–1.0 | Keine (bereits normalisiert) |
| `equivalent_match_rate` | 0.0–1.0 | Keine |
| `fst_acceptance_rate` | 0.0–1.0 | Keine |
| `morphological_accuracy` | 0.0–1.0 | Keine |
| `chrf_plus_plus` | 0–100 | **Durch 100 teilen** |
| `semantic_score` | 0.0–1.0 | Keine |
| `code_switching_rate` | 0.0–1.0 (niedriger = besser) | **`1.0 - value`** (invertieren: 0 % Code-Switching = 1,0) |
| `hallucination_rate` | 0.0–1.0 (niedriger = besser) | **`1.0 - value`** (invertieren) |
| `terminology_adherence` | 0.0–1.0 | Keine |

### 4.3 Gewichtungstabellen (Legacy) {#43-weight-tables}

Jede Sprache wurde über `language_cards.resolve_scoring_profile()` einem **benannten Profil** zugeordnet (`fst-coverage`, wenn ein FST den Durchlauf bewertete, sonst `surface-only`, sofern die Sprachkarte nicht `scoringProfile.basis` deklarierte); das Profil wird im `PROFILE_REGISTRY` von `scoring.py` gespiegelt und auf jeder Legacy-Karte als `scores.scoring_profile` erfasst. `orthographic_accuracy` ist in `scoring.INACTIVE_METRICS` aufgeführt und wurde nie berechnet, sodass dessen Gewicht stets umverteilt wurde. `morphological_accuracy` floss nur ein, wenn `morph_coverage ≥ 0.25`. Neuronale Metriken (`comet_score`, `qe_score`; `scoring.NEURAL_METRICS`) waren in keinem Gesamtwert enthalten.

#### `fst-coverage` (Profil A): Sprachen MIT FST-Abdeckung

| Metrik | Zielgewichtung | Begründung |
|--------|--------------|-----------|
| `fst_acceptance_rate` | **0.25** | Höchste Gewichtung. Wenn der FST ein Wort ablehnt, ist es keine gültige Form in der Sprache — unabhängig davon, was andere Metriken sagen. Binär, strukturell fundiert. |
| `morphological_accuracy` | **0.15** | Ein Wort kann FST-gültig, aber morphologisch falsch sein (richtige Wurzel, falsche Flexion). Zusammen mit FST tragen Strukturmetriken 40 %. |
| `chrf_plus_plus` | **0.15** | Zeichen-N-Gramm-Überlappung: die beste Oberflächen-Näherung für polysynthetische Sprachen. Behandelt agglutinierende Morphologie besser als wortbasierte Metriken. |
| `semantic_score` | **0.15** | Bedeutungserhaltung, wenn die Oberflächenform abweicht. Erfasst semantisch falsche Übersetzungen, die Strukturprüfungen bestehen. |
| `equivalent_match_rate` | **0.10** | Belohnt akzeptable Varianten, nicht nur die eine Referenzübersetzung. Wichtig für Sprachen mit flexibler Wortstellung. |
| `code_switching_rate` | **0.05** | Bestraft das Durchsickern der Quellsprache. Invertiert: 0 % Code-Switching = 1,0. |
| `terminology_adherence` | **0.05** | Belohnt gecoachte Methoden, die vorgeschriebenes Vokabular respektieren. Nur aktiv, wenn Coaching-Daten vorhanden sind. |
| `hallucination_rate` | **0.05** | Bestraft erfundenen Inhalt. Invertiert: 0 % Halluzination = 1,0. |
| `exact_match_rate` | **0.05** | Niedrigste Gewichtung. Zu streng für polysynthetische Sprachen — es existieren mehrere korrekte Übersetzungen. Als Obergrenzenprüfung beibehalten. |

> **Gesamt: 1,00.** Fehlte `morphological_accuracy` (kein FST-Analysator, reiner FST-Akzeptor oder Abdeckung unter 0,25), wurden die verbleibenden 8 Metriken (Summe 0,85) jeweils mit 1/0,85 ≈ 1,176 skaliert. Für eine Sprache mit reinem FST-Akzeptor (Nordsamisch, Amharisch, Baskisch) ohne Evaluierungsstandard und ohne Glossar verblieben lediglich FST-Akzeptanz 0,25, chrF++ 0,15, Code-Switching, Halluzination und exakte Übereinstimmung (je 0,05) – Gesamtsumme 0,55 –, sodass die FST-Akzeptanz **0,25/0,55 ≈ 45 %** des Gesamtwerts ausmachte. Genau diese Gewichtung machten sich die obigen Beispiele zunutze.

#### `surface-only` (Profil B): Sprachen OHNE FST-Abdeckung

| Metrik | Zielgewichtung | Begründung |
|--------|--------------|-----------|
| `semantic_score` | **0.25** | Ohne strukturelle Validierung ist die Bedeutungserhaltung das stärkste verfügbare Signal. |
| `chrf_plus_plus` | **0.25** | Ohne FST wird die Zeichenebenen-Überlappung zur primären Oberflächenprüfung. |
| `equivalent_match_rate` | **0.15** | Variantenabgleich bietet eine strukturierte Qualitätsbewertung, ohne morphologische Werkzeuge zu erfordern. |
| `exact_match_rate` | **0.10** | Ohne FST trägt die exakte Übereinstimmung mehr Gewicht als einzige strukturelle Validierungs-Näherung. |
| `code_switching_rate` | **0.10** | Das Durchsickern der Quellsprache ist wichtiger, wenn es keinen FST gibt, um schlechte Ausgaben zu erfassen. |
| `terminology_adherence` | **0.05** | Konformität mit gecoachtem Vokabular. |
| `hallucination_rate` | **0.05** | Erkennung erfundenen Inhalts. |
| `orthographic_accuracy` | **0.05** | Schriftspezifische Korrektheit füllt einen Teil der Lücke, die durch den fehlenden FST entstanden ist. |

> **Gesamt: 1,00.** `orthographic_accuracy` wurde nie berechnet, sodass die verbleibenden 7 Metriken (Summe 0,95) mit 1/0,95 ≈ 1,053 skaliert wurden.

#### `no-reference`: Runs OHNE Goldreferenz

| Metrik | Zielgewichtung | Begründung |
|--------|--------------|-----------|
| `fst_acceptance_rate` | **0.40** | Morphologische Validität benötigt keine Referenz; das stärkste deterministische Signal, wenn ein FST existiert. |
| `code_switching_rate` | **0.25** | Durchsickern der Quellsprache (invertiert). |
| `hallucination_rate` | **0.20** | Erfundener Inhalt (invertiert). |
| `terminology_adherence` | **0.15** | Konformität mit gecoachtem Vokabular. |

> **Gesamt: 1,00.** Für Durchläufe, deren Korpus keine Gold-Referenzen enthielt. Verfügte ein solcher Durchlauf über keinen FST, wurde der Gesamtwert allein über die Verhaltensprüfungen renormiert.

### 4.4 Hinzufügen einer neuen Metrik

Eine neue Metrik wird als **Diagnose** hinzugefügt; sie ändert niemals die primäre Kennzahl:

1. **Definieren Sie sie** in §2 mit dem Status `🔲 Planned`, einschließlich Skala, Ebene, Richtung und Berechnungsmethode.
2. **Implementieren Sie sie** als MetricPlugin (oder in `tester.py` für Kernmetriken).
3. **Registrieren Sie sie** in `shared/metric-registry.json` und fügen Sie einen Null-Platzhalter im Scores-Block der Durchlaufkarte ein.
4. **Aktualisieren Sie BENCHMARK_SPEC.md** §3, falls sich das Schema der Durchlaufkarte ändert.
5. **Führen Sie einen Validierungs-Benchmark durch**, um sicherzustellen, dass die Metrik auf echten Daten sinnvolle Werte liefert.
6. **Aktualisieren Sie dieses Dokument**, um den Status von `🔲` auf `✅` zu ändern.

Das Ändern der primären Kennzahl oder der Ranking-Metrik gilt nicht als „Hinzufügen einer Metrik“: Hierfür ist eine neue Version des Bewertungsstandards erforderlich ([Wie Durchläufe bewertet werden](#how-runs-are-scored)).

---

## 5. Ausgemustert: Qualitätsstufen (Legacy) {#5-quality-tiers}

> [!CAUTION]
> **Keine neue Karte weist eine Qualitätsstufe auf.** Neue Karten veröffentlichen `quality_tier: null`, und keine neue Ausgabe druckt eine Stufe oder Bezeichnungen wie „funktional“ oder „einsatzbereit“. Eine automatische Bewertung ist kein Qualitätsurteil: Derselbe Zahlenwert bedeutet für verschiedene Sprachen und Evaluierungssets Unterschiedliches, und die ausgemusterten Stufen stuften ein System, das für jede Eingabe denselben Satz wiederholte, als „funktional“ ein (§4). Nur eine menschliche Evaluierung durch Sprecher bestätigt die tatsächliche Qualität ([BENCHMARK_SPEC §7](/docs/network/specifications/benchmark#7-human-validation)).

Die Stufen waren Bezeichnungen, die aus dem Legacy-Gesamtwert abgeleitet wurden. Legacy-Karten speichern sie weiterhin; sie werden hier nur aufgeführt, damit alte Karten gelesen werden können, und stellen keine Qualitätszusicherungen dar.

| Legacy-Stufe | Legacy-Gesamtwertbereich |
|------|----------------|
| Baseline | 0,00–0,30 |
| Emerging | 0,30–0,50 |
| Functional | 0,50–0,70 |
| Deployable | 0,70–0,85 |
| Fluent | 0,85–1,00 |

### 5.1 Stufenschwellenwerte (maschinenlesbar, Legacy)

Die Legacy-Schwellenwerte (werden von oben nach unten ausgewertet, der erste Treffer gewinnt):

```
composite >= 0.85  →  "fluent"
composite >= 0.70  →  "deployable"
composite >= 0.50  →  "functional"
composite >= 0.30  →  "emerging"
composite >= 0.00  →  "baseline"
composite is null  →  "unscored"
```

---

## 6. Kostenmetriken

Kostenmetriken messen die wirtschaftliche Effizienz einer Übersetzungsmethode. Sie werden neben der Bewertung ausgewiesen und niemals mit ihr verrechnet.

### 6.1 Token-Metriken

| ID | Metrik | Berechnung |
|----|--------|-------------|
| `prompt_tokens` | Gesamte Eingabe-Token | Summe von `usage.prompt_tokens` über alle API-Aufrufe |
| `completion_tokens` | Gesamte Ausgabe-Token | Summe von `usage.completion_tokens` |
| `reasoning_tokens` | Chain-of-Thought-Token | Summe von `usage.completion_tokens_details.reasoning_tokens` (0 für die meisten Modelle) |
| `cached_tokens` | Provider-gecachte Token | Summe von `usage.prompt_tokens_details.cached_tokens` |
| `total_tokens` | Gesamt verbrauchte Token | `prompt_tokens + completion_tokens` |
| `tokens_per_entry` | Durchschnittliche Token pro Übersetzung | ✅ `total_tokens / entry_count` |

### 6.2 Kostenmetriken

| ID | Metrik | Berechnung | Anwendungsfall |
|----|--------|-------------|----------|
| `total_cost_usd` | Gesamte Run-Kosten | Vom Provider berichtete Preise × Token-Anzahlen | "Wie viel hat dieser Benchmark gekostet?" |
| `cost_per_entry_usd` | Kosten pro Korpuseintrag | `total_cost_usd / entry_count` | Vergleich von Methoden am selben Korpus |
| `cost_per_1k_tokens` | Kosten pro 1.000 Token | ✅ `total_cost_usd / total_tokens × 1000` | Universelle LLM-Effizienz — korpusübergreifend vergleichbar |
| `cost_per_source_char` | Kosten pro Quellzeichen | `total_cost_usd / total_source_chars` | Vergleichbar über Sprachen mit unterschiedlicher Tokenisierung |

> **Warum mehrere Kostenmetriken?** Ein "Eintrag" variiert in der Länge — eine 3-Wort-Phrase kostet weniger als ein Absatz. `cost_per_entry_usd` ist nützlich zum Vergleich von Methoden am *selben* Korpus (gleiche Einträge = gleiche Längen = fairer Vergleich). `cost_per_1k_tokens` ist die standardmäßige LLM-Effizienzmetrik, vergleichbar *über* Korpora hinweg. `cost_per_source_char` normalisiert für Tokenisierungsunterschiede — derselbe Satz kann je nach Vokabular des Modells in eine unterschiedliche Anzahl von Token tokenisiert werden.

### 6.3 Kostenbereinigte Bewertung (ausgemustert)

Legacy-Karten führen eine kostenbereinigte Bewertung, die aus dem ausgemusterten Gesamtwert berechnet wurde:

```
cost_adjusted = composite / log2(1 + cost_per_entry_usd × 1000)
```

Sie ist zusammen mit dem Gesamtwert ausgemustert: Neue Karten veröffentlichen `cost_adjusted: null`. Um Kosten und Qualität gegeneinander abzuwägen, vergleichen Sie chrF++ (mit seinem KI) und `cost_per_entry_usd` direkt nebeneinander; das Leaderboard kann nach beiden Dimensionen sortieren.

---

## 7. Geschwindigkeitsmetriken

Geschwindigkeitsmetriken messen die Latenz und den Durchsatz einer Übersetzungsmethode. Wie die Kosten wird auch die Geschwindigkeit neben der Bewertung ausgewiesen und niemals mit ihr zusammengefasst.

| ID | Metrik | Berechnung | Ebene |
|----|--------|-------------|-------|
| `elapsed_seconds` | Echtzeit-Run-Dauer | `time_end - time_start` | Run |
| `avg_latency_seconds` | Mittlere Latenz pro Eintrag | `Σ latency_s / n_entries` | Korpus |
| `median_latency_seconds` | Median-Latenz pro Eintrag | 50. Perzentil von `latency_s` | Korpus |
| `p95_latency_seconds` | 95. Perzentil-Latenz | 95. Perzentil von `latency_s` | Korpus |
| `tokens_per_second` | Durchsatz | `total_tokens / elapsed_seconds` | Run |
| `entries_per_minute` | Übersetzungsrate | `entry_count / (elapsed_seconds / 60)` | Run |

---

## 8. Konfidenz und Signifikanz

### 8.1 Bootstrap-Konfidenzintervalle

Konfidenzintervalle sind Perzentil-Bootstrap-Intervalle über die Segmente des Evaluierungssets (n=1000 Resamples, α=0,05; Koehn 2004). Das chrF++-Intervall ist fester Bestandteil der primären Kennzahl: `chrF++ 47.5 [45.9, 49.0]`. Bei einem kleinen Evaluierungsset fällt das Intervall breit aus; die Testumgebung warnt, wenn eine Teilmenge zu klein für ein aussagekräftiges Intervall ist.

| Metrik | KI ausgewiesen |
|--------|------------|
| `chrf_plus_plus` (primär) | ✅ Durchlaufkarte `confidence_intervals.corpus_chrf`; Datenbank `chrf_ci_lower`, `chrf_ci_upper` |
| `exact_match_rate` | ✅ `exact_match_ci_lower`, `exact_match_ci_upper` |
| `fst_acceptance_rate` | ✅ `fst_ci_lower`, `fst_ci_upper` (wird nur berechnet, wenn FST-Daten vorliegen) |
| `comet_score` | ✅ `comet_ci_lower`, `comet_ci_upper` (mittels Bootstrap aus zwischengespeicherten eintragsbezogenen Werten berechnet – keine redundante neuronale Inferenz) |
| `composite` | Nur Legacy-Karten (`composite_ci_lower`, `composite_ci_upper`); wird für neue Durchläufe nicht berechnet |
| KIs pro Stufe | ✅ `confidence_intervals_by_tier` – chrF++- und exact_match-KIs pro Schwierigkeitsgrad (Stufe 1–5) |

### 8.2 Gepaarte Signifikanztests {#82-paired-significance-tests}

Ob ein Durchlauf besser ist als ein anderer, entscheidet ein gepaarter Signifikanztest auf Basis von chrF++ über die von beiden Durchläufen übersetzten Segmente – niemals der bloße Vergleich zweier Zahlenwerte. `mt-eval compare --significance` führt Folgendes aus:

- **Approximative Randomisierung** (Standard; Riezler & Maxwell 2005, ebenfalls Standard in sacreBLEU): Die Ausgaben beider Systeme werden Segment für Segment 1.000 Mal zufällig vertauscht, um zu ermitteln, wie häufig ein mindestens ebenso großer Unterschied rein zufällig auftritt.
- **Gepaartes Bootstrap-Resampling** (`--method paired_bootstrap`; Koehn 2004): Segmente werden mit Zurücklegen neu gezogen, und die Differenz wird für jede Stichprobe neu berechnet. Dies ist eine konservativere Schätzung, die zum Vergleich mit älteren Arbeiten bereitgestellt wird.

```
H₀: The two methods perform equally on this evaluation set.
H₁: One method is better.
```

Jede Differenz wird zusammen mit ihrem 95%-Konfidenzintervall angegeben und als signifikant ausgewiesen, wenn p < 0,05 ist. BLEU, spBLEU, TER und die in beiden Durchläufen vorhandenen Diagnosen werden ebenfalls getestet und angezeigt (p-Werte gelten pro Metrik und sind nicht für multiples Testen korrigiert), das entscheidende Urteil über „Besser“ fällt jedoch der chrF++-Test. Zwei chrF++-Zahlen sind nur vergleichbar, wenn ihre sacreBLEU-Signaturen übereinstimmen. Handelt es sich bei einem der verglichenen Berichte um einen Legacy-Bericht, weist die Vergleichsfunktion darauf hin, dass dessen Gesamtwert ausgemustert ist, und vergleicht ihn nicht. Vollständige Methodik: [Statistische Signifikanztests](/docs/network/specifications/significance).

---

## 9. Run-Card-Bewertungsschema

Dieser Abschnitt definiert die hierarchische Struktur des `scores`-Blocks in einer Run Card. Dieses Schema leitet sich aus den in §2–§7 definierten Metriken ab und muss synchron gehalten werden.

```jsonc
{
  "scores": {
    // The scoring standard
    "scoring_standard":       "standard/1", // absent on legacy cards → "legacy-composite"
    "primary_metric":         "chrf_plus_plus",

    // HEADLINE (§2.1): corpus chrF++, 0–100; CI in confidence_intervals.corpus_chrf,
    // signature in sacrebleu_signatures.chrf
    "chrf_plus_plus":         47.52,

    // Other standard metrics — shown beside chrF++, never blended
    // (BLEU rides at the card's top level as "corpus_bleu"; COMET below)
    "spbleu":                 24.01,        // FLORES-200 SentencePiece BLEU
    "ter":                    61.2,         // 0–∞ (lower=better)
    "chrf_plain":             44.10,        // plain chrF (word_order=0), for comparison with published tables
    "sacrebleu_signatures": {
      "chrf":   "nrefs:1|case:mixed|eff:yes|nc:6|nw:2|space:no|version:2.4.3",
      "bleu":   "nrefs:1|case:mixed|eff:no|tok:13a|smooth:exp|version:2.4.3"
      // also chrf_plain, spbleu, ter
    },

    // Diagnostics (§2) — reported separately, never in a headline
    "exact_match_rate":       0.1613,       // 0.0–1.0
    "exact_matches":          10,           // count
    "equivalent_match_rate":  null,         // ⚡ partial (CRK: eval_standards/crk CrkLinterMetric)
    "equivalent_matches":     null,
    "length_ratio":           1.03,         // ideal=1.0
    "fst_acceptance_rate":    0.92,         // 0.0–1.0
    "fst_accepted":           274,          // count
    "morphological_accuracy": 0.63,         // FST-derived, lemma-matched, verifier-re-derived
    "morph_coverage":         0.41,         // fraction of analyzable predicted words lemma-matched to the reference
    "morph_in_composite":     false,        // legacy key; always false on a standard/1 card
    "orthographic_accuracy":  null,         // 🔲 planned
    "semantic_score":         null,         // ⚡ partial (CRK: eval_standards/crk CrkSemanticMetric)
    "code_switching_rate":    0.03,         // lower=better
    "hallucination_rate":     0.01,         // lower=better
    "terminology_adherence":  null,         // null when no glossary
    "style_consistency_rate": null,         // writing style
    "consistency_score":      null,         // 🔲 planned

    // COMET — a standard metric when computed (model id beside it)
    "comet_score":            0.712,        // null when not computed
    "comet_model":            "Unbabel/wmt22-comet-da",

    // Retired (§4, §5, §6.3) — always null on a standard/1 card
    "composite":              null,
    "quality_tier":           null,
    "cost_adjusted":          null,

    // §7 Speed metrics (merged into scores block)
    "tokens_per_second":      4462.5,       // ✅ total_tokens / elapsed
    "entries_per_minute":     82.30,        // ✅ entry_count / (elapsed/60)
    "avg_latency_seconds":    0.234,
    "median_latency_seconds": 0.190,
    "p95_latency_seconds":    0.415,

    // §8.1 Confidence intervals
    "confidence_intervals": {
      "corpus_chrf":        { "ci_lower": 45.9, "ci_upper": 49.0 },   // the headline's CI
      "exact_match_rate":   { "ci_lower": 0.08, "ci_upper": 0.25 },
      "corpus_comet":       { "ci_lower": 0.69, "ci_upper": 0.73 }
    },
    "confidence_intervals_by_tier": {
      "1": { "corpus_chrf": { "ci_lower": 68.1, "ci_upper": 76.5 } },
      "3": { "corpus_chrf": { "ci_lower": 36.2, "ci_upper": 47.0 } }
    },

    // Breakdowns
    "by_difficulty":          {},           // scores grouped by difficulty tier
    "by_provenance":          {},           // scores grouped by entry provenance

    // Counts
    "total":                  62,
    "evaluated":              62,
    "errors":                 0
  },

  "totals": {
    // §6.1 Token metrics
    "prompt_tokens":          13985,
    "completion_tokens":      187822,
    "reasoning_tokens":       175726,
    "cached_tokens":          0,
    // §6.2 Cost metrics
    "total_cost_usd":         1.7114,
    "cost_per_entry_usd":     0.027603,
    "cost_per_source_char":   null          // 🔲 needs source char counting
  }
}
```

Bewertungsvorbehalte (§2.8) befinden sich auf der obersten Ebene der Karte als `score_caveats`, eine Liste von `{kind, source, severity, message, …}`-Objekten; BLEU befindet sich dort als `corpus_bleu`.

> **Schemaverlauf.** Frühere Spezifikationsentwürfe schlugen separate `cost`-, `speed`- und `tokens`-Blöcke vor. Diese wurden der Einfachheit halber in `scores` bzw. `totals` zusammengeführt. Geschwindigkeitsmetriken (`tokens_per_second`, `entries_per_minute`, Latenzen) leben in `scores`; Token-Anzahlen und Kostenzahlen leben in `totals`.

### 9.1 Schema-Datenbank-Zuordnung

Die Run-Card-JSON wird vollständig als `jsonb`-Spalte in Supabase gespeichert. Schlüsselmetriken werden zudem für die Sortier-/Filterleistung in Spalten auf oberster Ebene denormalisiert:

| Feld der Durchlaufkarte | Supabase-Spalte | Typ | Index |
|---------------|----------------|------|-------|
| `scores.chrf_plus_plus` | `chrf_plus_plus` | `real` | `idx_leaderboard` |
| `scores.confidence_intervals.corpus_chrf` | `chrf_ci_lower`, `chrf_ci_upper` | `real` | — |
| `scores.composite` | `composite_score` | `real` | `idx_composite` – nur Legacy-Karten; null für `standard/1` |
| `scores.quality_tier` | `quality_tier` | `text` | — nur Legacy-Karten; null für `standard/1` |
| `scores.exact_match_rate` | `exact_match_rate` | `real` | — |
| `scores.fst_acceptance_rate` | `fst_acceptance_rate` | `real` | — |
| `corpus_bleu` | `corpus_bleu` | `real` | — |
| `scores.comet_score` | `comet_score` | `real` | — |
| `totals.total_cost_usd` | `total_cost_usd` | `real` | — |
| `totals.cost_per_entry_usd` | `cost_per_entry_usd` | `real` | — |
| `totals.cost_per_source_char` | `cost_per_source_char` | `real` | — |
| `scores.avg_latency_seconds` | `avg_latency_seconds` | `real` | — |
| `model_slug` | `model_slug` | `text` | `idx_model` |
| `condition` | `condition` | `text` | — |
| `dataset.id` | `dataset_id` | `text` | `idx_leaderboard` |
| `dataset.language_pair` | `language_pair` | `text` | — |
| `fingerprint.hash` | `fingerprint_hash` | `text` | `idx_fingerprint` |
| `scores.equivalent_match_rate` | `equivalent_match_rate` | `real` | — |
| `scores.semantic_score` | `semantic_score` | `real` | — |
| `scores.ter` | `ter` | `real` | — |
| `scores.length_ratio` | `length_ratio` | `real` | — |
| `scores.code_switching_rate` | `code_switching_rate` | `real` | — |
| `scores.hallucination_rate` | `hallucination_rate` | `real` | — |
| `scores.terminology_adherence` | `terminology_adherence` | `real` | — |
| `scores.tokens_per_second` | `tokens_per_second` | `real` | — |
| `scores.entries_per_minute` | `entries_per_minute` | `real` | — |
| `elapsed_seconds` | `elapsed_seconds` | `real` | — |
| *(vollständige Karte)* | `run_card` | `jsonb` | — |

Wenn neue Metriken implementiert werden, sollte die entsprechende Spalte über eine nummerierte Migration in `arena/migrations/` hinzugefügt werden.

---

## 10. Code-Spezifikations-Synchronisation

### 10.1 Kanonische Quelle

Dieses Dokument ist die maßgebliche Referenz für:
- Den Bewertungsstandard: die primäre Kennzahl, die daneben ausgewiesenen Standardmetriken und die Diagnosen ([Wie Durchläufe bewertet werden](#how-runs-are-scored))
- Metrikdefinitionen (§2) und Bewertungsvorbehalte (§2.8)
- Die Legacy-Gewichtungstabellen des Gesamtwerts (§4.3) und Stufenschwellenwerte (§5.1), beibehalten zur Verifizierung alter Karten
- Kostenmetrik-Formeln (§6.2)
- Das Bewertungsschema der Durchlaufkarten (§9)

### 10.2 Code-Spiegel

Die Datei `arena/mt_eval_harness/scoring.py` bildet die Code-Implementierung dieses Dokuments: die Metrikrollen des Standards (`SCORING_STANDARD`, `PRIMARY_METRIC`, `SECONDARY_METRICS`, `DIAGNOSTIC_METRICS`) und darunter die Legacy-Tabellen des Gesamtwerts sowie die Stufenschwellenwerte, die nur zur Verifizierung alter Karten dienen. Kein anderes Modul definiert sie; die Tests der Testumgebung sichern beides ab. Wenn dieses Dokument aktualisiert wird, aktualisieren Sie `scoring.py` entsprechend und führen Sie die Tests der Testumgebung erneut aus.

### 10.3 Dokumente, die auf diese Spezifikation verweisen

| Dokument | Worauf es sich bezieht | Wie die Synchronität gewahrt bleibt |
|----------|-------------------|---------------------|
| [Benchmark-Spezifikation](/docs/network/specifications/benchmark) §4–§5 | Primäre Kennzahl, Ranking, Legacy-Gesamtwert | Verweisen Sie auf dieses Dokument; keine Tabellen duplizieren |
| [Statistische Signifikanztests](/docs/network/specifications/significance) | Wie über „Besser“ entschieden wird | Muss mit §8.2 übereinstimmen |
| [FAQ](/docs/network/getting-started/faq) und [Funktionsweise](/docs/network/how-it-works) | Allgemeinverständliche Zusammenfassung des Standards | Auf dieses Dokument zurückverlinken |
| `publish.py` über `scoring.py` | `standard_score_fields()` und der Legacy-Gesamtwert | Tests der Testumgebung prüfen die Übereinstimmung |

---

## Anhang A: Warum chrF++ die primäre Kennzahl ist (und die anderen es nicht sind)

| Metrik | Rolle | Warum |
|--------|------|-----|
| **chrF++** | Primär | Zeichen-N-Gramme vergeben Teilpunkte für ein Wort mit dem richtigen Stamm und einem abweichenden Suffix; es kommt daher mit reicher Morphologie deutlich besser zurecht als wortbasierte Metriken (Popović 2015, 2017). Es ist für jede Sprache und Schrift allein anhand des Korpus reproduzierbar und entspricht dem Standard, über den FLORES-200 und die AmericasNLP-Shared-Tasks berichten. |
| **BLEU** | Standard, daneben | Der Abgleich auf Wortebene wertet einen geringfügigen Flexionsunterschied als vollständigen Fehlschlag, was polysynthetische Sprachen benachteiligt. Ausgewiesen zum Vergleich mit der MT-Fachliteratur. |
| **spBLEU** | Standard, daneben | BLEU auf Basis einer gemeinsamen SentencePiece-Tokenisierung, schriftübergreifend vergleichbar; wird von FLORES-200 berichtet. |
| **TER** | Standard, daneben | Editierdistanz; korreliert in den meisten Anwendungsfällen mit chrF++. |
| **COMET** | Standard, daneben (sofern berechnet) | Auf WMT-Daten trainiert (ressourcenstarke europäische Paare). Bei ressourcenarmen Sprachen (z. B. Cree) extrapoliert das Modell und ist unkalibriert; zudem erfordert es ein großes Modell und kann daher nicht der eine Wert sein, den jeder Durchlauf besitzt. Wird vom Prüfer neu abgeleitet. |
| **Längenverhältnis** | Diagnose | Ein Verhältnis von 1,02 und eines von 0,98 sind gleichermaßen unbedenklich. Nur extreme Werte weisen auf Probleme hin (§2.8). |
| **FST-Akzeptanz, morphologische Genauigkeit, LYSS** | Diagnose | Technische Heuristiken ohne Daten zu menschlichen Korrelationen; die FST-Akzeptanz bezieht Quelle und Referenz zu keinem Zeitpunkt ein (§4). |
| **Konsistenzwert** | Diagnose (geplant) | Gewisse Inkonsistenzen sind legitim (dasselbe englische Wort führt je nach Kontext zu unterschiedlichen Übersetzungen in der Zielsprache). |
| **Konformitätsindex** | Filter / Gate (geplant) | Misst die strukturelle Erhaltung (Platzhalter, Anführungszeichen), nicht die Übersetzungsgenauigkeit. |

## Anhang B: LYSS — Sprachspezifische Metrik-Implementierungen

Das **LYSS**-Framework (Linguistically-informed Yield & Structural Scoring) stellt sprachspezifische Metriken bereit, die über den oberflächlichen Zeichenkettenvergleich hinausgehen. LYSS hat drei Kernkomponenten:

- **LYSS-fst** — Morphologische Validität (`fst_acceptance_rate`): Ist jedes Wort eine gültige Form in der Zielsprache?
- **LYSS-eq** — Linguistische Äquivalenz (`equivalent_match_rate`): Ist die Ausgabe eine akzeptable Variante der Referenz?
- **LYSS-sem** — Semantische Validierung (`semantic_score`): Erhält die Ausgabe die Quellbedeutung?

Alle drei fungieren im Rahmen des Bewertungsstandards als **Diagnosen**: Sie werden neben der primären chrF++-Kennzahl ausgewiesen, fließen jedoch niemals in diese ein.

> **Validierungsstatus: 🔶 Engineering-Heuristik.** LYSS-Metriken wurden NICHT gegen menschliche Qualitätsurteile validiert. Sie sind aus linguistischen Prinzipien entworfen (FSTs, Wörterbücher, Grammatikregeln, die von Linguisten am UAlberta ALTLab erstellt wurden), aber die Korrelation zwischen LYSS-Bewertungen und tatsächlicher Übersetzungsqualität wurde nicht gemessen. Siehe das [Sprecher-Validierungsprotokoll](/docs/network/specifications/speaker-validation) für die erforderlichen Validierungsexperimente.

| Sprache | Plugin | Speicherort | LYSS-Komponente | Metrikschlüssel | Hinweise |
|----------|--------|----------|----------------|------------|-------|
| CRK (Plains Cree) | `CrkLinterMetric` | `eval_standards/crk/metrics.py` | **LYSS-eq** | `equivalent_match_rate` | Deterministische Variantenklassenregeln: Wortstellung, Orthografie, optionale Partikel, Lemma-Synonym, progressive Ambiguität, inklusiv/exklusiv. Liefert eintragsbezogenes `lint_verdict` (EXACT/EQUIVALENT/MISS/NO_OUTPUT). |
| CRK | `CrkSemanticMetric` | `eval_standards/crk/metrics.py` | **LYSS-sem** | `semantic_score` | Deterministisch: FST-Lemma-Extraktion + Wörterbuchglossen + spaCy-Inhaltswortüberlappung. Erzeugt Beurteilungen (EXACT_MATCH/VALID/GRAMMAR_ISSUES/PARTIAL/INCOMPLETE/WRONG/NO_OUTPUT). |
| GiellaLT-Sprachen | `GiellaLTFSTMetric` | `plugins/giellalt_fst.py` | **LYSS-fst** | `fst_acceptance_rate` | Generisch: Jede Sprache mit einem in der Testumgebung festgelegten FST (`mt_eval_harness/data/fst-pins.json`). Ein Analysator-FST liefert zudem `morphological_accuracy`; ein reiner Akzeptor-Speller (die für Nordsamisch, Amharisch und Baskisch festgelegten Divvun-Pakete) berichtet ausschließlich die Akzeptanz. Um in der Praxis FST-bewertet zu werden, ist zudem ein Evaluierungsset für das Paar erforderlich, das für ein Ranking geeignet ist: Die beiden Sets von Plains Cree (EdTeKLA) stellen unter Quarantäne stehende Labels dar, gegen die die Datenbank eine Bewertung verweigert, während mehrere andere FST-Sprachen über offene Sets verfügen (Tatoeba, WMT, WMT24++). Die [Datensätze-Seite](/docs/network/leaderboard/datasets) führt den Katalog auf, und `mt-eval corpora --source eng --target <code>` listet auf, was für ein Paar ausgeführt werden kann (siehe [Ehrliche Einschränkungen](/docs/network/honest-limitations)). |

> **Architekturhinweis (Juni 2026).** Sprachspezifische LYSS-Metriken werden nun auf der Sprachkarte unter `evalMetrics` deklariert und von `plugin_discovery.py` aus `eval_standards/<lang>/` geladen. Sie fungieren als **Evaluierungsstandards** (Schiedsrichter), nicht als Metriken von Methoden-Plugins (Teilnehmer). Das bedeutet, dass jede Übersetzungsmethode für CRK automatisch durch die LYSS-Diagnosen überprüft wird – ohne dass eine methodenspezifische Konfiguration erforderlich ist. `CrkFSTMetric` wurde entfernt; seine Funktionalität wird vollständig durch das generische `GiellaLTFSTMetric` abgedeckt.

## Anhang C: In Betracht gezogene Metriken

Dies sind Ideen, die evaluiert, aber noch nicht ausreichend für §2 spezifiziert sind:

| Idee | Was es messen würde | Blocker |
|------|----------------------|----------|
| Flüssigkeit (LM-Perplexität) | Ist die Ausgabe wohlgeformte Prosa in der Zielsprache? | Erfordert ein Zielsprachen-LM. Für die meisten LRLs existieren keine guten Modelle. |
| Register-Übereinstimmung | Entspricht die Übersetzung der erwarteten Formalitätsstufe? | Erfordert soziolinguistische Klassifikatoren. Forschungsproblem. |
| Kulturelle Angemessenheit | Werden kulturelle Referenzen korrekt behandelt? | Nicht automatisierbar — erfordert von Natur aus eine menschliche Überprüfung. |
| Diskurskohärenz | Bilden aufeinanderfolgende Übersetzungen eine kohärente Passage? | Erfordert Bewertung auf Dokumentebene, nicht auf Satzebene. |

---

## Referenzen

Wissenschaftliche Arbeiten, Werkzeuge und Sprachressourcen, die in dieser Spezifikation zitiert werden.

### Oberflächenmetriken

1. Popović, M. (2017). "chrF++: words helping character n-grams." *Proceedings of the Second Conference on Machine Translation (WMT 2017)*, S. 612–618. Kopenhagen, Dänemark.

1a. Popović, M. (2015). "chrF: character n-gram F-score for automatic MT evaluation." *Proceedings of the Tenth Workshop on Statistical Machine Translation (WMT 2015)*. Lissabon, Portugal.

2. Papineni, K., Roukos, S., Ward, T., & Zhu, W.-J. (2002). "BLEU: a method for automatic evaluation of machine translation." *Proceedings of the 40th Annual Meeting of the Association for Computational Linguistics (ACL 2002)*, S. 311–318. Philadelphia, PA.

3. Post, M. (2018). "A Call for Clarity in Reporting BLEU Scores." *Proceedings of the Third Conference on Machine Translation (WMT 2018)*, S. 186–191. Belgien, Brüssel. Referenzimplementierung: [sacrebleu](https://github.com/mjpost/sacrebleu).

4. Snover, M., Dorr, B., Schwartz, R., Micciulla, L., & Makhoul, J. (2006). "A Study of Translation Edit Rate with Targeted Human Annotation." *Proceedings of the 7th Conference of the Association for Machine Translation in the Americas (AMTA 2006)*, S. 223–231. Cambridge, MA.

### Evaluierungspraxis und Signifikanztests

S1. Koehn, P. (2004). "Statistical Significance Tests for Machine Translation Evaluation." *Proceedings of the 2004 Conference on Empirical Methods in Natural Language Processing (EMNLP 2004)*. Barcelona, Spanien.

S2. Riezler, S. & Maxwell, J. T. (2005). "On Some Pitfalls in Automatic Evaluation and Significance Testing for MT." *Proceedings of the ACL Workshop on Intrinsic and Extrinsic Evaluation Measures for Machine Translation and/or Summarization*. Ann Arbor, MI.

S3. Kocmi, T., Federmann, C., Grundkiewicz, R., Junczys-Dowmunt, M., Matsushita, H., & Menezes, A. (2021). "To Ship or Not to Ship: An Extensive Evaluation of Automatic Metrics for Machine Translation." *Proceedings of the Sixth Conference on Machine Translation (WMT 2021)*.

S4. Kocmi, T., et al. (2024). "Findings of the WMT24 General Machine Translation Shared Task." *Proceedings of the Ninth Conference on Machine Translation (WMT 2024)*.

S5. NLLB Team, Costa-jussà, M. R., et al. (2022). "No Language Left Behind: Scaling Human-Centered Machine Translation." arXiv:2207.04672. (FLORES-200; berichtet chrF++ und spBLEU.)

S6. Goyal, N., Gao, C., Chaudhary, V., et al. (2022). "The Flores-101 Evaluation Benchmark for Low-Resource and Multilingual Machine Translation." *Transactions of the Association for Computational Linguistics*, Bd. 10. (spBLEU.)

S7. Mager, M., Oncevay, A., Ebrahimi, A., et al. (2021). "Findings of the AmericasNLP 2021 Shared Task on Open Machine Translation for Indigenous Languages of the Americas." *Proceedings of the First Workshop on Natural Language Processing for Indigenous Languages of the Americas*.

S8. Ebrahimi, A., Mager, M., Rijhwani, S., et al. (2023). "Findings of the AmericasNLP 2023 Shared Task on Machine Translation into Indigenous Languages." *Proceedings of the Workshop on Natural Language Processing for Indigenous Languages of the Americas (AmericasNLP 2023)*.

### Neuronale Metriken

5. Rei, R., Stewart, C., Farinha, A. C., & Lavie, A. (2020). "COMET: A Neural Framework for MT Evaluation." *Proceedings of the 2020 Conference on Empirical Methods in Natural Language Processing (EMNLP 2020)*, S. 2685–2702. Online.

6. Juraska, J., Finkelstein, M., Deutsch, D., Siddhant, A., Mirzazadeh, M., & Freitag, M. (2023). "MetricX-23: The Google Submission to the WMT 2023 Metrics Shared Task." *Proceedings of the Eighth Conference on Machine Translation (WMT 2023)*, Singapur. (ACL Anthology 2023.wmt-1.63)

7. Zhang, T., Kishore, V., Wu, F., Weinberger, K. Q., & Artzi, Y. (2020). "BERTScore: Evaluating Text Generation with BERT." *Proceedings of the Eighth International Conference on Learning Representations (ICLR 2020)*. Addis Abeba, Äthiopien.

8. Sellam, T., Das, D., & Parikh, A. (2020). "BLEURT: Learning Robust Metrics for Text Generation." *Proceedings of the 58th Annual Meeting of the Association for Computational Linguistics (ACL 2020)*, S. 7881–7892. Online.

### Morphologische und linguistische Werkzeuge

9. Lindén, K., Silfverberg, M., Axelson, E., Hardwick, S., & Pirinen, T. (2011). "HFST—Framework for Compiling and Applying Morphologies." *Systems and Frameworks for Computational Morphology (SFCM 2011)*, Communications in Computer and Information Science, Bd. 100, S. 67–85. Springer, Berlin, Heidelberg.

10. Sánchez-Cartagena, V. M., & Toral, A. (2024). "MorphEval: Automatic Evaluation of Morphological Capabilities of Machine Translation Systems." *Machine Translation*, Bd. 38, S. 1–28.

### Fehlerklassifikation und diagnostische Bewertung

11. Popović, M. (2011). "Hjerson: An Open Source Tool for Automatic Error Classification of Machine Translation Output." *The Prague Bulletin of Mathematical Linguistics*, Nr. 96, S. 59–68.

12. Dreyer, M. & Marcu, D. (2012). "HyTER: Meaning-Equivalent Semantics for Translation Evaluation." *Proceedings of the 2012 Conference of the North American Chapter of the Association for Computational Linguistics: Human Language Technologies (NAACL 2012)*, S. 162–171. Montréal, Kanada.

13. Reiter, E. & Belz, A. (2009). "An Investigation into the Validity of Some Metrics for Automatically Evaluating Natural Language Generation Systems." *Computational Linguistics*, Bd. 35, Nr. 4, S. 529–558. (Verwandte Arbeit zu merkmalsbasierten Bewertungsmetriken, einschließlich FUSE.)

### Halluzinationserkennung

14. Raunak, V., Menezes, A., & Junczys-Dowmunt, M. (2021). "The Curious Case of Hallucinations in Neural Machine Translation." *Proceedings of the 2021 Conference of the North American Chapter of the Association for Computational Linguistics: Human Language Technologies (NAACL 2021)*, S. 1172–1183. Online.

15. Guerreiro, N. M., Voita, E., & Martins, A. F. T. (2023). "Looking for a Needle in a Haystack: A Comprehensive Study of Hallucinations in Neural Machine Translation." *Proceedings of the 17th Conference of the European Chapter of the Association for Computational Linguistics (EACL 2023)*, S. 1059–1075. Dubrovnik, Kroatien.

### Cree-Sprachressourcen

16. Wolfart, H. C. (1973). "Plains Cree: A Grammatical Study." *Transactions of the American Philosophical Society*, Bd. 63, Nr. 5, S. 1–90.

17. Wolvengrey, A. (2001). *nêhiyawêwin: itwêwina / Cree: Words.* Canadian Plains Research Center, University of Regina.

### Datenverwaltung

18. Global Indigenous Data Alliance. "CARE Principles for Indigenous Data Governance." [https://www.gida-global.org/care](https://www.gida-global.org/care).

19. Carroll, S. R., Garba, I., Figueroa-Rodríguez, O. L., Holbrook, J., Lovett, R., Materechera, S., Parsons, M., Raseroka, K., Rodriguez-Lonebear, D., Rowe, R., Sara, R., Walker, J. D., Anderson, J., & Hudson, M. (2020). "The CARE Principles for Indigenous Data Governance." *Data Science Journal*, Bd. 19, Nr. 1, S. 43.
