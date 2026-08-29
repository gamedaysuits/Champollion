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

> **Zusammenfassung.** Dies ist die einzige maßgebliche Quelle für alle Evaluierungsmetriken, Gesamtbewertungen, Qualitätsstufen und Kostenanalysen im Champollion MT-Evaluierungsökosystem. Die sprachspezifischen Evaluierungsmetriken — morphologische FST-Validität, Linter-Äquivalenzklassen und deterministische semantische Validierung — werden kollektiv als **LYSS** (Linguistically-informed Yield & Structural Scoring) bezeichnet. Jede vom Harness berechnete Metrik, jedes Gewicht in der Formel für die Gesamtbewertung und jeder Schwellenwert der Qualitätsstufen wird hier definiert — und nur hier. Code, Dokumentation und Datenbankschemata leiten sich von diesem Dokument ab. Bei Konflikten ist dieses Dokument maßgeblich.
>
> **Geltungsbereich.** Dieses Dokument definiert, *was* wir messen und *wie wir es bewerten*. Es definiert nicht das Run-Card-Schema (siehe BENCHMARK_SPEC §3), das Benchmark-Protokoll (BENCHMARK_SPEC §6) oder die Leaderboard-Regeln (siehe Arena-Dokumentation). Diese Dokumente verweisen für Metrikdefinitionen und Bewertungslogik auf dieses Dokument.


---

## 1. Bewertungsphilosophie

### 1.1 Microeval-Philosophie

> *"Wenn wir uns nur auf das konzentrieren, was verallgemeinerbar ist, werden wir zwangsläufig vergessen, wo es das nicht ist — und diese Sprachen mit all ihrem Wissen und ihrer Weisheit verlieren."*

Dieses Projekt praktiziert **Microeval-Entwicklung**: den Aufbau von Bewertungsmetriken, die mit den besten verfügbaren linguistischen Werkzeugen auf bestimmte Sprachen zugeschnitten sind — endliche Automaten (Finite-State-Transducer), zweisprachige Wörterbücher, morphologische Analysewerkzeuge, von Linguisten kuratierte Äquivalenzregeln. Dies ist das Gegenteil des vorherrschenden Paradigmas in der MT-Bewertung, das universelle Metriken sucht, die sprachübergreifend funktionieren. Universelle Metriken sind wertvoll, aber sie sind gerade dort am schwächsten, wo sie am dringendsten benötigt werden: bei Sprachen mit komplexer Morphologie, begrenzten Trainingsdaten und ohne Vertretung in neuronalen Metrik-Trainingsdatensätzen.

Bei vielen Sprachen der Welt kommen wir in der maschinellen Übersetzung nicht nur deshalb nicht voran, weil uns Korpora fehlen, sondern weil **wir nicht einmal wissen, wie Fortschritt aussieht** — uns fehlen die automatisierten Bewertungswerkzeuge, um zu messen, ob sich ein Übersetzungssystem verbessert. LYSS ist unser Versuch, diese Werkzeuge Sprache für Sprache aufzubauen, unter Verwendung sämtlicher vorhandener linguistischer Ressourcen.

### 1.2 Automatisierte Metriken sind Näherungswerte

Jede hier definierte Metrik wird maschinell berechnet. Sie sind nützlich für schnelle Iteration, systematischen Vergleich und das Erkennen von Regressionen. Sie sind **kein Ersatz für menschliches Urteilsvermögen**. Die Qualitätsstufen in §5 sind heuristische Bezeichnungen — nur eine menschliche Überprüfung kann die tatsächliche Verwendbarkeit bestätigen.

### 1.3 Multi-Signal-Design

Keine einzelne Metrik erfasst die Übersetzungsqualität. Eine Übersetzung kann eine perfekte chrF++-Überlappung aufweisen, aber die morphologische Validierung nicht bestehen. Sie kann FST-Prüfungen bestehen, aber die falsche Bedeutung tragen. Sie kann semantisch korrekt, aber stilistisch der Zielsprache fremd sein. Die zusammengesetzte Bewertung in §4 aggregiert mehrere unabhängige Signale, von denen jedes eine andere Qualitätsdimension erfasst.

### 1.4 Erweiterbarkeit

Dieses Metrikinventar ist nicht abgeschlossen. Neue Sprachen bringen neue Anforderungen mit sich: Tongenauigkeit für tonale Sprachen, diakritische Präzision für semitische Schriften, Silbenschriftkorrektheit für Cree. Die Architektur (MetricPlugin-Protokoll, gewichtetes Kompositum mit Neu-Normalisierung) ist so konzipiert, dass Metriken hinzugefügt werden können, ohne bestehende Bewertungen zu beeinträchtigen. Sprachspezifische Metriken (z. B. der Linter und der semantische Validator von CRK) werden auf Sprachkarten unter `evalMetrics` deklariert und aus `eval_standards/` geladen — die Harness wird nur mit generischen verhaltensbasierten Metriken ausgeliefert (Code-Switching, Halluzination, Terminologie).

### 1.5 Drei Bewertungsdimensionen

Jede Run Card misst drei unabhängige Dimensionen:

```
Quality   — How good is the translation?   (composite score, §4)
Cost      — How much does it cost?          (cost metrics, §6)
Speed     — How fast does it run?           (speed metrics, §7)
```

Dies sind unabhängige Achsen. Eine Methode kann qualitativ hochwertig, aber teuer sein, schnell, aber ungenau, oder eine beliebige Kombination davon. Die Rangliste ermöglicht die Sortierung nach jeder Dimension. Die kostenbereinigte Bewertung (§6.3) ist die einzige Metrik, die Dimensionen kombiniert.

### 1.6 Validierungsstatus

Jede Metrik in dieser Spezifikation hat einen **Validierungsstatus**, der sich von ihrem Implementierungsstatus (§3) unterscheidet. Der Implementierungsstatus verfolgt, ob Code existiert. Der Validierungsstatus verfolgt, ob nachgewiesen wurde, dass die Metrik mit menschlichen Qualitätsurteilen korreliert.

| Validierungsstufe | Bedeutung | Aktuelle Metriken |
|------------------|---------|----------------|
| **✅ Extern validiert** | Veröffentlichte Studien zur Human-Korrelation existieren (WMT, wissenschaftliche Arbeiten) | `chrf_plus_plus`, `bleu`, `comet_score` *(nur ressourcenreiche Sprachpaare)* |
| **⚡ Näherungsvalidiert** | Für ressourcenreiche Sprachen validiert; für unsere Ziel-LRLs nicht validiert | `comet_score` *(für LRLs: validiert an ressourcenreichen/EU-Paaren, extrapoliert z. B. auf CRK — richtungsweisend nützlich, aber nicht kalibriert)* |

> **Warum `comet_score` in zwei Zeilen erscheint.** Dies ist eine Aufteilung nach Ressourcenstufe, kein Widerspruch. COMET ist *extern validiert*, wo WMT-Human-Korrelationsstudien existieren — ressourcenreiche, überwiegend europäische Paare. Für unsere ressourcenarmen Zielsprachen gibt es keine solchen Studien, sodass dieselbe Metrik nur *näherungsvalidiert* ist: Das Modell extrapoliert aus Sprachen mit unterschiedlichen morphologischen Systemen. Dies ist auch der Grund, warum COMET in einer separaten neuronalen Spur berichtet und niemals in das Kompositum eingerechnet wird (§4.3).
| **🔶 Engineering-Heuristik** | Aus linguistischen Prinzipien oder beobachteten Fehlermodi abgeleitet; keine Human-Korrelationsdaten | `fst_acceptance_rate`, `morphological_accuracy` (FST-abgeleitet, lemma-abgeglichen; **aktiv** im fst-coverage-Kompositum, verifier-neuberechnet), `equivalent_match_rate`, `semantic_score`, `code_switching_rate`, `hallucination_rate`, `terminology_adherence` |
| **🔲 Nicht validiert** | Noch an keinen Daten getestet | `orthographic_accuracy`, `consistency_score` |

> **Was dies in der Praxis bedeutet.** Die zusammengesetzte Bewertung (§4) aggregiert Metriken aller Validierungsstufen. Dies ist eine bewusste Designentscheidung: Wir glauben, dass eine strukturell fundierte Engineering-Heuristik (FST-Akzeptanz) für polysynthetische Sprachen aussagekräftiger ist als eine neuronale Metrik, die nur an europäischen Paaren validiert wurde (COMET). Aber wir haben dies nicht bewiesen. Die zusammengesetzte Bewertung sollte als **Engineering-Schätzung** behandelt werden, nicht als validierte Qualitätsmessung, bis für jede Zielsprache Human-Korrelationsstudien abgeschlossen sind.
>
> **Erforderliche Validierungsexperimente** (siehe `mt-evaluation-landscape.md` §6 und `speaker-validation.md`):
> 1. Studie zur Korrelation mit menschlichem Urteil: 200+ Satzpaare, bewertet von 3+ zweisprachigen Sprechern
> 2. Messung der FST-Fehlablehnungsrate an einem repräsentativen Korpus
> 3. Portierung auf eine zweite Sprache (Nordsamisch) zur Prüfung der Verallgemeinerbarkeit
> 4. Direkter Vergleich mit COMET an denselben Daten


---

## 2. Metrikinventar {#2-metric-inventory}

Die Metriken sind in sechs Kategorien organisiert (Oberfläche, Struktur, Semantik, Verhalten, Konformität und berichtete Vergleichsmetriken). Jede Metrik hat einen Implementierungsstatus, eine Skala und eine Ebene (pro Eintrag, auf Korpus-Ebene oder beides).

### 2.1 Oberflächenmetriken

Oberflächenmetriken vergleichen die vorhergesagte Übersetzung mit der Referenzübersetzung auf Zeichenkettenebene. Sie erfordern keine linguistischen Werkzeuge — nur einen Zeichenkettenvergleich.

| ID | Metrik | Status | Skala | Ebene | Implementierung |
|----|--------|--------|-------|-------|---------------|
| `exact_match_rate` | Exakte Übereinstimmung | ✅ Implementiert | 0.0–1.0 | Beides | Binär: Ist vorhergesagt == Referenz? Korpusrate = Übereinstimmungen / Gesamtzahl. |
| `equivalent_match_rate` | Äquivalente Übereinstimmung | ⚡ Teilweise | 0.0–1.0 | Beides | Stimmt die vorhergesagte Ausgabe mit einer akzeptierten Variante überein? Für CRK: implementiert über den `CrkLinterMetric` des CRK-Bewertungsstandards (in `eval_standards/crk/`) unter Verwendung deterministischer Variantenklassenregeln (Wortstellung, orthografisch, optionale Partikel, Lemma-Synonym, progressive Ambiguität). Automatisch über die `evalMetrics`-Deklaration der CRK-Sprachkarte geladen. Die generische sprachübergreifende Implementierung erfordert `variants[]` pro Eintrag im Korpus. |
| `chrf_plus_plus` | chrF++ | ✅ Implementiert | 0–100 | Beides | Zeichen-N-Gramm-F-Wert (sacrebleu). Robust gegenüber morphologischer Variation. Die primäre Oberflächenmetrik für agglutinierende/polysynthetische Sprachen. Pro Eintrag verwendet `sentence_chrf`; Korpus verwendet `corpus_chrf`. |
| `bleu` | BLEU | ✅ Implementiert | 0–100 | Korpus | Wortbasierte N-Gramm-Präzision (sacrebleu). **Vom Kompositum ausgeschlossen** — wortbasierte Bewertung bestraft morphologische Variation unfair. Zur Kompatibilität mit der MT-Literatur berechnet und berichtet. |
| `ter` | Translation Edit Rate | ✅ Implementiert | 0–∞ (niedriger ist besser) | Beides | Minimale Editierdistanz zwischen Vorhersage und Referenz, normalisiert durch die Referenzlänge (sacrebleu `corpus_ter`). Wird zusammen mit chrF++ und BLEU berechnet. Vom Kompositum ausgeschlossen — korreliert mit chrF++, sodass die Einbeziehung beider die Oberflächenähnlichkeit doppelt zählen würde. |
| `length_ratio` | Längenverhältnis | ✅ Implementiert | 0–∞ (1.0 ist ideal) | Beides | `len(predicted) / len(reference)` in Zeichen. Erkennt Kürzung (<0,5) und Aufblähung/Halluzination (>2,0). Auf Korpus-Ebene über Einträge gemittelt. |

### 2.2 Strukturmetriken

Strukturmetriken validieren die linguistische Wohlgeformtheit der Übersetzung. Sie erfordern sprachspezifische Werkzeuge (FST-Analysewerkzeuge, morphologische Parser) und sind die stärksten Signale für morphologisch reiche Sprachen.

| ID | Metrik | Status | Skala | Ebene | Implementierung |
|----|--------|--------|-------|-------|---------------|
| `fst_acceptance_rate` | FST-Akzeptanz | ✅ Implementiert | 0.0–1.0 | Beides | Anteil der von einem endlichen Automaten (GiellaLT) akzeptierten Ausgabewörter. Ein Wort ist "gültig", wenn der FST mindestens eine morphologische Analyse zurückgibt. Verfügbar für jede Sprache mit einem GiellaLT-`.hfstol`-Analysewerkzeug. |
| `morphological_accuracy` | Morphologische Genauigkeit | ✅ Aktiv (fst-coverage-Profil; verifier-neuberechnet) | 0.0–1.0 | Beides | Ein Wort kann FST-gültig sein, aber die falsche Flexion aufweisen (richtige Wurzel, falsches Suffix). **Berechnet** durch `plugins/giellalt_fst.py`: Für jedes analysierbare vorhergesagte Wort wird ein Referenzwort gesucht, das dessen **Lemma** (Wurzel) teilt, und geprüft, ob die vorhergesagte **Flexion** (FST-Merkmalstags) übereinstimmt. Der Abgleich nach Lemma — nicht nach Position — umgeht die Wortausrichtung: eine andere Wortwahl oder ein falsch ausgerichtetes Paar ist einfach nicht *abgedeckt* (wird nie fälschlich bewertet). **Keine Goldannotationen erforderlich** — die FST-Analyse der Referenz *ist* die Grundwahrheit. Wörter, die der FST nicht analysieren kann oder deren Wurzel nicht in der Referenz vorkommt, liegen außerhalb der Abdeckung; `morph_coverage` (der Anteil der lemma-abgeglichenen) wird offengelegt, und die Metrik geht nur dann ins Kompositum ein, wenn die Abdeckung ≥ `MORPH_COVERAGE_FLOOR` (0,25) beträgt — unterhalb der Schwelle bleibt sie beratend. Sie ist **nachsichtig bei FST-Ambiguität** (ein vorhergesagtes Wort mit mehreren Analysen ist "korrekt", wenn *irgendeine* übereinstimmt → eine offengelegte Obergrenze). Sie trägt eine **Gewichtung von 0,15** im fst-coverage-Profil und wird **vom Verifier neuberechnet** gegenüber dem kanonischen Korpus (`verifier.recompute_corpus_morph`, das den auf der Karte fixierten FST erneut ausführt — fail-closed, wenn der FST fehlt, gleicher Vertrag wie bei COMET). Aktiviert am 2026-06-16 (Migration 029 auf dev + prod angewendet). |
| `orthographic_accuracy` | Orthografische Genauigkeit | 🔲 Geplant | 0.0–1.0 | Beides | Validiert schriftspezifische Korrektheit: SRO-Makron-/Zirkumflex-Verwendung für Cree, diakritische Zeichen für Inuktitut, Vokallängenmarkierungen für Ojibwe. Sprachspezifische Regelsätze. |

> **Warum strukturelle Metriken wichtig sind.** Metas OMT-1600 – das größte jemals veröffentlichte MT-System (1.600 Sprachen; Meta AI, *Omnilingual MT*, arXiv:2603.16309, 2026) – wird mit ChrF++, xCOMET, MetricX und BLASER 3 evaluiert. Keine dieser Metriken validiert die morphologische Korrektheit. ChrF++ misst die Überlappung von Zeichen-N-Grammen: Es belohnt Zeichenketten, die *wie* die Zielsprache *aussehen*. Für polysynthetische Sprachen bedeutet dies, dass ein morphologisch ungültiges Wort, das viele Zeichen mit der Referenz teilt, gut abschneidet. Unsere FST-Akzeptanzmetrik ist ein binärer Struktur­test: Das Wort ist entweder eine gültige Form in der Sprache oder nicht. Kein anderes MT-Evaluierungsframework bietet dies in diesem Umfang. ChrF++ weist zudem eine **Zufalls-Untergrenze ungleich null** auf, die je nach Orthographie variiert – zufälliger Text in derselben Schrift schneidet messbar über null ab, in manchen Schriftsystemen stärker als in anderen –, sodass roher chrF++ sprachübergreifend nicht vergleichbar ist; die Netzwerkkarte korrigiert dies mit [zufallskorrigiertem chrF++ (cchrF++)](/docs/network/specifications/connection-strength).

### 2.3 Semantische Metriken

Semantische Metriken messen die Bedeutungserhaltung mithilfe von Einbettungen oder gelernten Modellen. Sie erkennen Übersetzungen, die sich in der Oberfläche unterscheiden, aber bedeutungsäquivalent sind, und markieren Übersetzungen, die oberflächlich ähnlich, aber semantisch falsch sind.

| ID | Metrik | Status | Skala | Ebene | Implementierung |
|----|--------|--------|-------|-------|---------------|
| `semantic_score` | Semantische Ähnlichkeit | ⚡ Teilweise | 0.0–1.0 | Beides | CRK: verdikt-gewichtete Bewertung aus dem `CrkSemanticMetric` des CRK-Bewertungsstandards (in `eval_standards/crk/`, Näherung). Universell: Kosinus-Ähnlichkeit von Satzeinbettungen (Quelle + Vorhersage gegenüber Quelle + Referenz). Modell noch festzulegen — muss ressourcenarme Sprachen unterstützen, was die meisten englischzentrierten Einbettungsmodelle ausschließt. |
| `comet_score` | COMET | ✅ Implementiert | ~0.0–1.0 | Beides | Gelernte MT-Bewertungsmetrik (Unbabel). **Berechnet und SEPARAT berichtet — niemals in einem Kompositum** (das Kompositum ist deterministisch; §4.3). Vom Verifier neuberechnet, sodass ein berichteter Wert reproduzierbar sein muss. Für Sprachen wie Plains Cree mit einem Kalibrierungsvorbehalt für ressourcenarme Sprachen gekennzeichnet. Berechnet, wenn `unbabel-comet` installiert ist. Für 35 afrikanische Sprachen wählt die Harness automatisch AfriCOMET (`masakhane/africomet-mtl`) über `resolve_comet_model()` aus, das für diese Sprachen eine bessere Korrelation mit menschlichem Urteil aufweist. |

> **Warum COMET separat berichtet und nicht in das Kompositum eingerechnet wird.** COMET wird an WMT-Human-Bewertungsdaten trainiert, überwiegend ressourcenreichen europäischen Paaren. Auf Plains Cree oder andere LRLs angewendet, extrapoliert das Modell aus Sprachen mit unterschiedlichen morphologischen Systemen — richtungsweisend nützlich, aber nicht kalibriert. Anstatt ein modellabhängiges, ungleichmäßig validiertes Signal in die Hauptbewertung einzufügen, wird das Kompositum **deterministisch** gehalten (nur verifier-reproduzierbare Metriken), und COMET/AfriCOMET werden in einer **separaten neuronalen Spur** berichtet (§4.3), vom Verifier neuberechnet. Ein neuronales Kompositum könnte später hinzugefügt werden, sobald es validiert ist.
>
> **Ressourcenreiches COMET wird berichtet, nicht in das Kompositum eingerechnet (per Design).** Für wirklich ressourcenreiche Paare (Deutsch, Französisch, …) ist das Standard-`Unbabel/wmt22-comet-da` durch WMT gut validiert, und `resolve_comet_model()` wählt es aus. Aber COMET wird **nicht** in ein Kompositum eingerechnet — es wird wie jede andere neuronale Metrik berechnet und in der separaten neuronalen Spur angezeigt und vom Verifier neuberechnet. Das deterministische Halten des Kompositums vermeidet, dass eine 2,3 GB große modellabhängige Metrik für die ~100+ Sprachen mit `metricModelSupport.xlmr.tier: "high"` verpflichtend wird, und hält die Hauptbewertung allein aus dem Korpus reproduzierbar.

> **AfriCOMET für afrikanische Sprachen.** Jede Sprachkarte hat ein `metricModelSupport`-Feld (siehe Sprachkarten-Spezifikation §9), das deklariert, welche spezialisierten COMET-Modelle für diese Sprache trainiert sind. Für 35 afrikanische Sprachen (yor, hau, ibo, amh, swa usw.) deklariert die Karte AfriCOMET (`masakhane/africomet-mtl`) — ein COMET-Modell, das von der Masakhane-Community anhand von menschlichen MT-Urteilen für afrikanische Sprachen feinabgestimmt wurde. Die Harness wählt das empfohlene Modell automatisch über `resolve_comet_model()` aus, das aus den Sprachkarten liest, dies kann jedoch mit `--comet-model` überschrieben werden. Das Hinzufügen neuer Sprache→Modell-Zuordnungen erfolgt durch Anreicherung der Sprachkarte (nicht durch Bearbeiten von Python-Code).

### 2.4 Verhaltensmetriken

Verhaltensmetriken erkennen bestimmte Fehlermodi in der Übersetzungsausgabe. Sie messen die Qualität nicht direkt — sie erkennen Probleme.

| ID | Metrik | Status | Skala | Ebene | Implementierung |
|----|--------|--------|-------|-------|---------------|
| `code_switching_rate` | Code-Switching-Rate | ✅ Implementiert | 0.0–1.0 (niedriger ist besser) | Beides | Anteil der Ausgabewörter, die in der Quellsprache (typischerweise Englisch) sind. Erkannt über Unicode-Schriftanalyse und/oder eine Quellsprachen-Wortliste. Sehr häufiger LLM-Fehlermodus: Das Modell fügt englische Wörter ein, wenn es das Äquivalent in der Zielsprache nicht kennt. |
| `hallucination_rate` | Halluzinationsrate | ✅ Implementiert | 0.0–1.0 (niedriger ist besser) | Beides | Anteil des Ausgabeinhalts, der keinen entsprechenden Quellinhalt hat. Erkannt über Wortausrichtung oder sprachübergreifende Einbettungsüberlappung. Erfasst, wenn das Modell plausibel klingende, aber erfundene Übersetzungen generiert. |
| `terminology_adherence` | Terminologietreue | ✅ Implementiert | 0.0–1.0 | Beides | Für gecoachte Methoden: Anteil der vorgeschriebenen Terminologiebegriffe, die in der Ausgabe erscheinen. Erfordert Coaching-Wörterbuchdaten. Misst, ob das Modell das von Experten bereitgestellte Vokabular respektiert. |
| `consistency_score` | Eintragsübergreifende Konsistenz | 🔲 Geplant | 0.0–1.0 | Nur Korpus | Übersetzt das Modell denselben Quellbegriff über Einträge hinweg auf dieselbe Weise? Geringe Konsistenz deutet darauf hin, dass das Modell rät, anstatt gelernte Muster anzuwenden. Erfordert wiederholte Begriffe über Korpuseinträge hinweg. |

### 2.5 Konformitätsmetriken

Konformitätsmetriken validieren, dass Übersetzungen die strukturelle Integrität bewahren — Platzhalter, Formatierung und typografische Konventionen. Es sind Qualitätsgate-Prüfungen, keine Qualitätsbewertungen.

| ID | Metrik | Status | Skala | Ebene | Implementierung |
|----|--------|--------|-------|-------|---------------|
| `compliance_index` | Double-Pass-Konformität | ✅ Implementiert | 0.0–1.0 | Beides | Gewichtetes Kompositum: 60 % Variablenintegrität (sind `{placeholder}`-Variablen erhalten?) + 20 % Anführungszeichen-Konformität (korrekte Anführungszeichen pro Sprachkarte) + 20 % Groß-/Kleinschreibungs-Konformität (kein Durchsickern lateinischer Buchstaben bei Sprachen ohne Groß-/Kleinschreibung). Berechnet auf sowohl der Roh- als auch der nachbearbeiteten Ausgabe. Über `DoublePassCompliancePlugin`. |
| `repair_effectiveness` | Reparatureffektivität | ✅ Implementiert | 0.0–1.0 | Korpus | Anteil der Konformitätsverletzungen, die von Nachübersetzungs-Hooks automatisch repariert wurden. Misst, wie sehr das Qualitätsgate die Rohausgabe verbessert hat. |

> **Warum Konformität nicht im Kompositum enthalten ist.** Konformitätsmetriken messen die strukturelle Erhaltung (Platzhalter, Anführungszeichen), nicht die Übersetzungsqualität. Eine Übersetzung kann linguistisch perfekt sein, aber die Konformität nicht bestehen, weil sie eine `{name}`-Variable weggelassen hat. Dies sind Qualitätsgates — sie verhindern das Ausliefern schlechter Ausgaben, aber sie bewerten nicht die Übersetzungsqualität.

### 2.6 Berichtete Vergleichsmetriken (NIEMALS im Kompositum)

Diese werden nur zum Kontext/Vergleich berichtet und gehen niemals in ein Kompositumprofil ein:

| ID | Metrik | Status | Anmerkungen |
|----|--------|--------|-------|
| `spbleu` | spBLEU (FLORES-200-Tokenizer) | ✅ Implementiert | BLEU auf der FLORES-200-SentencePiece-Tokenisierung — vergleichbar über Schriften/Segmentierung (die NLLB/FLORES-Lingua-Franca). Benötigt `sentencepiece` (Kern-Abhängigkeit). |
| `chrf_plain` | Einfaches chrF (`word_order=0`) | ✅ Implementiert | Der chrF-Wert, den FLORES/WMT-Tabellen berichten, neben unserem chrF++ (`word_order=2`). |
| `fuse_score` | FUSE-artige Vergleichsmetrik | ⚡ Opt-in (`--fuse`) | Eine **UNTRAINIERTE Neuimplementierung** des AmericasNLP-2025-FUSE-Ansatzes (Raja & Vats): LaBSE-semantisch + lexikalisches Token-F1 + phonetisches Soundex + Fuzzy-difflib, gemischt als *ungewichteter Mittelwert* (wir haben keine menschlichen Urteilstrainingsdaten, um die ursprüngliche Ridge/GBM anzupassen, und sagen dies auch). LaBSE/Soundex sind das optionale `fuse`-Extra; ohne LaBSE gibt `compute_fuse` `None` (offengelegt) zurück, anstatt eine Bewertung vorzutäuschen. Jede ausgeführte Komponente ist in `fuse_components` aufgeführt; das Ergebnis wird als `fuse_untrained=true` markiert. Ermöglicht der Rangliste, FST-gegatete/strukturelle Bewertung gegen eine FUSE-artige Baseline anzuzeigen. |

### 2.7 Metrik-Namensräume {#2-7-metric-namespaces}

Eine einzelne Metrik trägt bis zu vier koordinierte Namen über den Stack hinweg: die
**kanonische ID** (der `scores`-Schlüssel in einer Run Card, z. B. `equivalent_match_rate`),
den Python-**Plugin-Namen**, der sie berechnet (z. B. `crk_linter`), den Sprachkarten-**`evalMetrics`-Schlüssel**, der sie deklariert (z. B. `lyss-eq`), und die denormalisierte
**`run_cards`-Spalte** in der Rangliste (z. B. `equivalent_match_rate`). Diese sind
bewusst unterschiedlich — der Plugin-Name gibt das *Werkzeug* an, die Metrik-ID gibt die
*Messung* an — aber sie müssen im Gleichschritt bleiben.

Die zentrale verbindliche Referenz für diese Zuordnung ist `shared/metric-registry.json`, geladen
von `mt_eval_harness.metric_manifest`. Jeder Eintrag erfasst die vier Namen plus `scale`,
`direction` (höher/niedriger/neutral), `level` (Eintrag/Korpus/beides), `in_composite` und
`verifier_reproducible`. Der Paritätstest `arena/tests/test_metric_registry_ssot.py`
schlägt fehl, wenn die Gewichtungstabellen von `scoring.py` oder die von
`publish.py` geprägten Run-Card-`scores`-Schlüssel von der Registry abweichen, sodass eine neue Metrik nicht halb verdrahtet ausgeliefert werden kann.

Zwei zugehörige Run-Card-Felder machen die Metrikherkunft explizit:

- **`scores.metric_availability`** — ein `{metric: reason}`-Block, der eine
  `null`-Bewertung disambiguiert: `not_applicable` (die Sprache/der Run verwendet sie nicht), `unavailable`
  (eine optionale Abhängigkeit fehlte), `below_coverage_floor` (vorhanden, aber zu
  spärlich, um in das Kompositum einzugehen), `not_run` (Opt-in und nicht angefordert) oder
  `not_implemented` (geplant). Eine im Block fehlende Metrik wurde normal berechnet.
- **`fst_version`** / **`fst_provenance`** — das installierte GiellaLT-Transducer-Release
  und die `pyhfst`-Version hinter jeder FST-abgeleiteten Metrik, auf dieselbe Weise erfasst
  wie die sacreBLEU-Signaturen, sodass eine strukturelle Bewertung zu einem exakten
  Analysewerkzeug-Build zurückverfolgt werden kann.

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

## 4. Zusammengesetzte Bewertung {#4-composite-score}

> [!CAUTION]
> **Das Kompositum ist EXPERIMENTELL und NICHT VALIDIERT.** Es ist ein gewichtetes Aggregat von Metriken, die *für verschiedene Sprachen Verschiedenes bedeuten*, mit Gewichtungen, die **Engineering-Urteil sind, nicht empirisch an menschliche Qualitätsurteile angepasst**. Keine Human-Korrelationsstudie stützt die Gewichtung für irgendeine Zielsprache. Behandeln Sie es als groben, praktischen Sortierschlüssel, **niemals** als Qualitätsmessung oder als Behauptung, dass ein System "besser" sei. Das eigentliche Signal ist das **Metrik-für-Metrik-Profil** — jede Metrik wird mit ihrem Wert und ihrer Validierungsstufe angezeigt (§1.6). Das Kompositum wird überall, wo es erscheint (Rangliste inbegriffen), als "experimentell — nicht validiert" gekennzeichnet, und es ist niemals das Kriterium für einen Preis oder eine Auszeichnung. (Per Design.)

### 4.1 Formel

Die zusammengesetzte Bewertung ist ein gewichteter Durchschnitt aller *verfügbaren* Metriken, neu normalisiert, sodass die Gewichtungen der verfügbaren Metriken sich zu 1,0 summieren:

```
composite = Σ (weight_i × value_i)    for all available metrics
             ─────────────────────
             Σ weight_i               (re-normalization denominator)
```

Eine Metrik ist "verfügbar", wenn ihr Wert in der Run Card eine Zahl ist (nicht `null`). Wenn eine Metrik nicht verfügbar ist — weil die Sprache keinen FST hat oder weil eine Metrik noch nicht implementiert ist — wird ihre Gewichtung proportional auf die übrigen Metriken umverteilt.

**Dies bedeutet, dass das Kompositum innerhalb eines Runs immer vergleichbar ist:** Es verwendet die jeweils verfügbaren Metriken und normalisiert entsprechend. Der laufübergreifende Vergleich ist gültig, wenn die Runs denselben Satz verfügbarer Metriken verwenden.

> [!WARNING]
> **Vergleichbarkeit zwischen Durchläufen.** Beim Vergleich von Durchläufen mit unterschiedlicher Metrikverfügbarkeit (z. B. hat ein Durchlauf FST-Werte, ein anderer nicht) sind die Gesamtbewertungen **nicht direkt vergleichbar**. Eine Gesamtbewertung von 0,72, die aus 5 Metriken berechnet wurde, enthält mehr Informationen als eine Gesamtbewertung von 0,72, die aus 2 Metriken berechnet wurde. Der genaue Metriksatz jedes Durchlaufs ist überprüfbar: Die Run-Card erfasst `scores.scoring_profile` und `scores.metric_availability` (§2.7), und eine nicht gemessene Metrik wird auf dem Leaderboard als „—“ dargestellt, niemals als 0. Für einen rigorosen Vergleich verwenden Sie gepaarte Bootstrap-Signifikanztests (§8.2) ausschließlich für gemeinsame Metriken.

### 4.2 Eingabenormalisierung

Bevor sie in die Kompositum-Formel eingehen, müssen alle Metriken auf einer **Skala von 0,0–1,0** liegen, wobei 1,0 = perfekt:

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

Metriken, die in keinem Kompositumprofil enthalten sind (`bleu`, `ter`, `length_ratio`, `consistency_score` und die neuronalen `comet_score`/`qe_score`), werden zu diesem Zweck nicht normalisiert. (Neuronale Metriken werden separat berichtet und gehen niemals in ein Kompositum ein — §4.3.)

### 4.3 Gewichtungstabellen {#43-weight-tables}

**Benannte Profil-Registry (kartengesteuert).** Das Kompositum wird nicht mehr durch einen einzelnen `has_fst`-Boolean gewählt. Jede Sprache wird über `language_cards.resolve_scoring_profile()` zu einem **benannten Profil** aufgelöst; das Profil benennt eine Gewichtungstabelle, gespiegelt in `PROFILE_REGISTRY` von `scoring.py`. Eine Karte kann `scoringProfile.basis` deklarieren, um zu überschreiben; wenn abwesend, reproduziert der Standard das Legacy-Verhalten (`fst-coverage`, wenn ein FST den Run bewertet hat, andernfalls `surface-only`). Das Profil, das jedes Kompositum produziert hat, wird auf der Run Card als `scores.scoring_profile` erfasst, sodass die Gewichtung pro Ranglistenzeile überprüfbar ist.

**Inaktive (reservierte) Metriken.** Einige Metriken tragen unten eine *deklarierte* Gewichtung, sind aber noch nicht aktiv, sodass sie in `scoring.INACTIVE_METRICS` aufgeführt und **vom Kompositum ausgeschlossen** sind, bis sie sowohl pro Eintrag berechnet als auch vom Verifier neu bewertbar sind (das Vertrauensgate). Der Ausschluss einer abwesenden Metrik ändert keine Bewertung — er macht nur "noch nicht bewertend" explizit statt stillschweigend. Derzeit inaktiv:

- `orthographic_accuracy` — benötigt sprachspezifische orthografische Regeln (nicht gebaut).

(`morphological_accuracy` war bis P5 inaktiv; **aktiviert am 2026-06-16** unter dem `fst-coverage`-Profil — es wird berechnet (lemma-abgeglichen; §2.2), geht in das Kompositum ein, wenn `morph_coverage ≥ 0.25` (beratend unterhalb der Schwelle), und wird vom Verifier neuberechnet. **Neuronale Metriken (`comet_score`, `qe_score`) sind von jedem Kompositum ausgeschlossen** — sie werden separat berechnet und berichtet; siehe "Neuronale Metriken" unten.)

#### `fst-coverage` (Profil A): Sprachen MIT FST-Abdeckung

Für Sprachen, für die ein GiellaLT-endlicher-Automat verfügbar ist. Strukturmetriken tragen 40 % des Kompositums (FST 0,25 + morphologische Genauigkeit 0,15), was den Vorrang der morphologischen Korrektheit für polysynthetische/agglutinierende Sprachen widerspiegelt.

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

> **Gesamt: 1,00.** Wenn Metriken nicht verfügbar sind, werden ihre Gewichtungen proportional auf die verfügbaren Metriken umverteilt. `morphological_accuracy` (Gewichtung 0,15) ist **aktiv** — es geht in das Kompositum ein, wenn `morph_coverage ≥ 0.25`, und wird vom Verifier neuberechnet; unterhalb der Schwelle wird es wie jede nicht verfügbare Metrik umverteilt. Wenn es *tatsächlich* abwesend ist (kein FST oder Abdeckung unter der Schwelle), werden die übrigen 8 Metriken (Gesamtgewichtung 0,85) jeweils mit 1/0,85 ≈ 1,176 skaliert. Zum Beispiel:
> - FST: 0,25/0,85 = 0,294
> - chrF++: 0,15/0,85 = 0,176
> - semantisch: 0,15/0,85 = 0,176

#### `surface-only` (Profil B): Sprachen OHNE FST-Abdeckung

Für Sprachen ohne morphologische Validierungswerkzeuge. Semantische und Oberflächenmetriken tragen gleiches Gewicht.

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

> **Gesamt: 1,00.** `orthographic_accuracy` (Gewichtung 0,05) ist in `INACTIVE_METRICS` (geplant, noch nicht berechnet). Wenn es abwesend ist, werden die übrigen 7 Metriken (Gesamtgewichtung 0,95) mit 1/0,95 ≈ 1,053 skaliert — eine vernachlässigbare Auswirkung auf das Kompositum.

#### `no-reference`: Runs OHNE Goldreferenz

Für Runs, deren Korpus **keine Goldreferenzen** hat (z. B. Floor-Sprachen mit nur kontaminiertem FLORES, gegen das wir nicht bewerten wollen). Referenzbasierte Metriken (`chrf_plus_plus`, `bleu`, `exact_match_rate`, `equivalent_match_rate`) können nicht berechnet werden, sodass sich das deterministische Kompositum auf die **referenzfreien, verifier-reproduzierbaren** Signale stützt.

| Metrik | Zielgewichtung | Begründung |
|--------|--------------|-----------|
| `fst_acceptance_rate` | **0.40** | Morphologische Validität benötigt keine Referenz; das stärkste deterministische Signal, wenn ein FST existiert. |
| `code_switching_rate` | **0.25** | Durchsickern der Quellsprache (invertiert). |
| `hallucination_rate` | **0.20** | Erfundener Inhalt (invertiert). |
| `terminology_adherence` | **0.15** | Konformität mit gecoachtem Vokabular. |

> **Gesamt: 1,00.** Alle vier sind deterministisch und verifier-reproduzierbar. Wenn ein Run ohne Referenz keinen FST hat, normalisiert das Kompositum allein über die Verhaltensprüfungen neu (ein bewusst dünnes, ehrliches Signal); die **neuronale referenzfreie QE-Bewertung (AfriCOMET-QE) wird separat berechnet und berichtet** — siehe "Neuronale Metriken" unten — als Adäquanzsignal für solche Runs.

#### Neuronale Metriken — SEPARAT berechnet und berichtet (nicht in irgendeinem Kompositum)

Das Kompositum ist **deterministisch**: Jede darin enthaltene Metrik ist vom Verifier allein aus dem Korpus reproduzierbar. **Neuronale Metriken sind von jedem Kompositum ausgeschlossen** und werden eigenständig dargestellt (Designentscheidung — "deterministisches Kompositum; neuronal separat, vielleicht später separat zusammengesetzt"):

| Metrik | Was es ist | Wo es angezeigt wird |
|--------|-----------|----------------|
| `comet_score` | COMET / AfriCOMET neuronale Adäquanz (referenzbasiert) | Eigene Ranglistenspalte + Run-Card-`neural_metrics`, mit einem Kalibrierungsvorbehalt für ressourcenarme Sprachen. |
| `qe_score` | AfriCOMET-QE referenzfreie neuronale QE (Quelle + MT) | Dieselbe separate neuronale Spur; das Adäquanzsignal für `no-reference`-Runs. |

Beide werden dennoch **vom Verifier neuberechnet** (`verifier.recompute_corpus_comet` / `recompute_corpus_qe`), sodass einer berichteten neuronalen Bewertung, die sich nicht reproduzieren lässt, nicht vertraut werden kann — aber sie bewegen niemals das deterministische Kompositum. Der benannte Satz ist `scoring.NEURAL_METRICS`. Ein neuronales Kompositum könnte später eingeführt werden; vorerst stehen neuronale Metriken für sich allein.

> **Anmerkung zur Gewichtungsentwicklung.** Diese Gewichtungen sind vorläufig und werden neu kalibriert, sobald menschliche Validierungsdaten anwachsen. Das langfristige Ziel ist, die Gewichtungen empirisch abzuleiten: Welche automatisierten Metriken sagen menschliche Qualitätsurteile für jede Sprachfamilie am besten voraus?

### 4.4 Eine neue Metrik zum Kompositum hinzufügen

Um eine neue Metrik zum Kompositum hinzuzufügen:

1. **Definieren Sie sie** in §2 mit dem Status `🔲 Planned`, einschließlich Skala, Ebene und Berechnungsmethode.
2. **Implementieren Sie sie** als MetricPlugin (oder in `tester.py` für Kernmetriken).
3. **Fügen Sie einen Null-Platzhalter** im Bewertungsblock der Run Card hinzu.
4. **Weisen Sie ihr eine Zielgewichtung** in §4.3 zu, indem Sie bestehende Gewichtungen nach unten anpassen. Die Gewichtungen müssen sich zu 1,00 summieren.
5. **Aktualisieren Sie BENCHMARK_SPEC.md** §3, wenn sich das Run-Card-Schema ändert.
6. **Aktualisieren Sie die Gewichtungstabellen von `scoring.py`** (der Code muss dieses Dokument spiegeln).
7. **Führen Sie einen Validierungs-Benchmark aus**, um zu bestätigen, dass die Metrik sinnvolle Werte an echten Daten produziert.
8. **Aktualisieren Sie dieses Dokument**, um den Status von `🔲` auf `✅` zu ändern.

---

## 5. Qualitätsstufen {#5-quality-tiers}

Diese Stufen sind heuristische Bezeichnungen auf automatisierten zusammengesetzten Bewertungen. Sie beschreiben, was die Bewertungen in der Praxis tendenziell bedeuten, basierend auf der menschlichen Überprüfung von Ausgaben auf jeder Ebene. **Es sind keine validierten Qualitätsurteile** — nur eine menschliche Überprüfung kann die tatsächliche Verwendbarkeit bestätigen.

> [!IMPORTANT]
> **Automatisierte Stufen sind vorläufig.** Diese Bezeichnungen sind Nominierungen zur Überprüfung, keine Qualitätserklärungen. Eine Methode, die bei automatisierten Metriken "Einsatzfähig" erreicht, ist ein Kandidat für die Community-Bewertung — kein Produkt zum Ausliefern. Nur eine menschliche Überprüfung durch zweisprachige Sprecher kann die tatsächliche Verwendbarkeit bestätigen (siehe [BENCHMARK_SPEC §7](/docs/network/specifications/benchmark#7-human-validation)). Keine Methode kann Einsatzfähig oder höher beanspruchen, ohne eine Community-Überprüfung, die bestätigt, dass Sprecher der Verwendbarkeit der Ausgabe zustimmen. Die Stufengrenzen können sich zwischen Sprachen unterscheiden, sobald menschliche Validierungsdaten anwachsen.

| Stufe | Kompositum-Bereich | Was ein Sprecher typischerweise sieht |
|------|----------------|-------------------------------|
| **Baseline** | 0.00–0.30 | Rohe LLM-Ausgabe ohne sprachspezifische Unterstützung. Die Morphologie ist größtenteils halluziniert. |
| **Aufkommend** | 0.30–0.50 | Einige korrekte Muster erscheinen. Coaching hilft, aber die Ausgabe ist nicht zuverlässig. |
| **Funktional** | 0.50–0.70 | Die Ausgabe ist für einen Sprecher erkennbar. Wichtige grammatische Kategorien sind meist korrekt. Häufige morphologische Fehler. |
| **Einsatzfähig** | 0.70–0.85 | Geeignet für Entwurfsübersetzung mit menschlicher Überprüfung. Die meiste Morphologie ist korrekt. |
| **Fließend** | 0.85–1.00 | Nähert sich einer kompetenten menschlichen Übersetzung. Fehler sind selten und geringfügig. |

Diese Stufen sind vorläufig. Sie werden neu kalibriert, sobald menschliche Validierungsdaten anwachsen und wir erfahren, wo die Schwelle "ein Sprecher findet dies nützlich" für jede Sprache tatsächlich liegt. Keine Methode kann **Einsatzfähig** oder höher beanspruchen, ohne eine Community-Überprüfung, die bestätigt, dass zweisprachige Sprecher der Verwendbarkeit der Ausgabe zustimmen.

### 5.1 Stufenschwellenwerte (maschinenlesbar)

Für Code-Implementierungen sind die Schwellenwerte (von oben nach unten ausgewertet, erste Übereinstimmung gewinnt):

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

Kostenmetriken messen die finanzielle Effizienz einer Übersetzungsmethode. Sie werden getrennt von der Qualität berichtet — die Kosten beeinflussen die zusammengesetzte Bewertung nicht (außer in der kostenbereinigten Sekundärrangliste).

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

### 6.3 Kostenbereinigte Bewertung

Für Methoden, die kostenpflichtige APIs verwenden, berechnen wir eine Sekundärrangliste:

```
cost_adjusted = composite / log2(1 + cost_per_entry_usd × 1000)
```

Dies belohnt Methoden, die gute Bewertungen effizient erzielen. Es verwendet `cost_per_entry_usd` (nicht pro Token), weil die kostenbereinigte Bewertung immer innerhalb eines einzelnen Benchmarks (gleiches Korpus) berechnet wird, was einen fairen Vergleich pro Eintrag ermöglicht.

Die kostenbereinigte Bewertung ist eine **Sekundärrangliste** — die primäre Rangliste ordnet nach der zusammengesetzten Bewertung. Sie beantwortet eine andere Frage: "Bei gegebenem Budget, welche Methode liefert die besten Ergebnisse?"

---

## 7. Geschwindigkeitsmetriken

Geschwindigkeitsmetriken messen die Latenz und den Durchsatz einer Übersetzungsmethode. Wie die Kosten beeinflusst die Geschwindigkeit die zusammengesetzte Bewertung nicht.

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

Alle Schlüsselmetriken unterstützen Bootstrap-Konfidenzintervalle (Perzentilmethode, n=1000 Resamples, α=0,05):

| Metrik | CI berichtet |
|--------|------------|
| `chrf_plus_plus` | ✅ `chrf_ci_lower`, `chrf_ci_upper` |
| `exact_match_rate` | ✅ `exact_match_ci_lower`, `exact_match_ci_upper` |
| `fst_acceptance_rate` | ✅ `fst_ci_lower`, `fst_ci_upper` (nur berechnet, wenn FST-Daten existieren) |
| `comet_score` | ✅ `comet_ci_lower`, `comet_ci_upper` (aus gecachten Bewertungen pro Eintrag gebootstrappt — keine redundante neuronale Inferenz) |
| `composite` | ✅ `composite_ci_lower`, `composite_ci_upper` (berechnet, wenn chrF++ und exact_match verfügbar sind) |
| CIs pro Stufe | ✅ `confidence_intervals_by_tier` — chrF++- und exact_match-CIs pro Schwierigkeitsgrad (Stufe 1-5) |

### 8.2 Gepaarte Bootstrap-Signifikanztests

Zum Vergleich zweier Methoden berechnet die Harness gepaarte Bootstrap-Resampling-Tests:

```
H₀: The two methods perform equally on this corpus.
H₁: One method is significantly better.
```

Wenn der p-Wert < 0,05 ist und das Konfidenzintervall der Differenz Null ausschließt, ist die Differenz auf dem 95 %-Niveau statistisch signifikant.

---

## 9. Run-Card-Bewertungsschema

Dieser Abschnitt definiert die hierarchische Struktur des `scores`-Blocks in einer Run Card. Dieses Schema leitet sich aus den in §2–§7 definierten Metriken ab und muss synchron gehalten werden.

```jsonc
{
  "scores": {
    // §2.1 Surface metrics
    "exact_match_rate":       0.6613,       // 0.0–1.0
    "exact_matches":          41,           // count
    "equivalent_match_rate":  0.7258,       // ⚡ partial (CRK: eval_standards/crk CrkLinterMetric)
    "equivalent_matches":     45,           // ⚡ partial (CRK: eval_standards/crk CrkLinterMetric)
    "chrf_plus_plus":         80.65,        // 0–100 (sacrebleu native scale)
    "bleu":                   54.78,        // 0–100, NOT in composite
    "ter":                    42.3,         // ✅ implemented, 0–∞ (lower=better)
    "length_ratio":           1.03,         // ✅ implemented, ideal=1.0

    // §2.2 Structural metrics
    "fst_acceptance_rate":    1.0,          // 0.0–1.0
    "fst_accepted":           74,           // count
    "morphological_accuracy": 0.83,         // ✅ active: FST-derived, lemma-matched, verifier-re-derived (fst-coverage profile — §4.3)
    "morph_coverage":         0.41,         // fraction of analyzable predicted words lemma-matched to the reference
    "morph_in_composite":     true,         // true when active AND coverage ≥ MORPH_COVERAGE_FLOOR (0.25); else advisory
    "orthographic_accuracy":  null,         // 🔲 planned

    // §2.3 Semantic metrics
    "semantic_score":         0.6842,       // ⚡ partial (CRK: eval_standards/crk CrkSemanticMetric)
    "comet_score":            null,         // nullable; NEURAL — reported separately, not in any composite (§4.3)
    "comet_model":            "",           // model ID used for COMET

    // §2.4 Behavioral metrics
    "code_switching_rate":    0.03,         // ✅ implemented (lower=better)
    "hallucination_rate":     0.01,         // ✅ implemented (lower=better)
    "terminology_adherence":  null,         // ✅ implemented (null when no glossary)
    "consistency_score":      null,         // 🔲 planned

    // §4 Composite
    "composite":              0.8988,       // 0.0–1.0
    "quality_tier":           "fluent",     // §5 tier label
    "cost_adjusted":          null,         // §6.3 secondary ranking

    // §7 Speed metrics (merged into scores block)
    "tokens_per_second":      4462.5,       // ✅ total_tokens / elapsed
    "entries_per_minute":     82.30,        // ✅ entry_count / (elapsed/60)
    "avg_latency_seconds":    0.234,
    "median_latency_seconds": 0.190,
    "p95_latency_seconds":    0.415,

    // §8.1 Confidence intervals
    "confidence_intervals": {
      "chrf_plus_plus":     { "ci_lower": 78.2, "ci_upper": 83.1 },
      "exact_match_rate":   { "ci_lower": 0.54, "ci_upper": 0.78 },
      "corpus_comet":       { "ci_lower": 0.71, "ci_upper": 0.76 }
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

> **Schemaverlauf.** Frühere Spezifikationsentwürfe schlugen separate `cost`-, `speed`- und `tokens`-Blöcke vor. Diese wurden der Einfachheit halber in `scores` bzw. `totals` zusammengeführt. Geschwindigkeitsmetriken (`tokens_per_second`, `entries_per_minute`, Latenzen) leben in `scores`; Token-Anzahlen und Kostenzahlen leben in `totals`.

### 9.1 Schema-Datenbank-Zuordnung

Die Run-Card-JSON wird vollständig als `jsonb`-Spalte in Supabase gespeichert. Schlüsselmetriken werden zudem für die Sortier-/Filterleistung in Spalten auf oberster Ebene denormalisiert:

| Run-Card-Feld | Supabase-Spalte | Typ | Index |
|---------------|----------------|------|-------|
| `scores.composite` | `composite_score` | `real` | `idx_composite` |
| `scores.quality_tier` | `quality_tier` | `text` | — |
| `scores.chrf_plus_plus` | `chrf_plus_plus` | `real` | `idx_leaderboard` |
| `scores.exact_match_rate` | `exact_match_rate` | `real` | — |
| `scores.fst_acceptance_rate` | `fst_acceptance_rate` | `real` | — |
| `scores.bleu` | `corpus_bleu` | `real` | — |
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

Dieses Dokument (`cli/website/docs/network/specifications/scoring.md`) ist die kanonische Quelle für:
- Metrikdefinitionen (§2)
- Kompositum-Gewichtungstabellen (§4.3)
- Qualitätsstufen-Schwellenwerte (§5.1)
- Kostenmetrik-Formeln (§6.2)
- Run-Card-Bewertungsschema (§9)

### 10.2 Code-Spiegel

Die Datei `arena/mt_eval_harness/scoring.py` spiegelt die Gewichtungstabellen und Stufenschwellenwerte aus diesem Dokument. Sie ist die **Code-Implementierung** von §4.3 und §5.1. Wenn dieses Dokument aktualisiert wird:

1. Aktualisieren Sie `scoring.py` zur Übereinstimmung
2. Führen Sie `pytest tests/test_scoring_ssot.py` aus, um die Ausrichtung zu validieren
3. Aktualisieren Sie FAQ und Website-Dokumentation, die die Gewichtungen zusammenfassen

### 10.3 Dokumente, die auf diese Spezifikation verweisen

| Dokument | Worauf es verweist | Wie es synchron gehalten wird |
|----------|-------------------|---------------------|
| `cli/website/docs/network/specifications/benchmark-spec.md` §4–§5 | Kompositum-Formel, Gewichtungstabellen, Stufenschwellenwerte | Verweisen Sie auf dieses Dokument; duplizieren Sie keine Tabellen |
| `website/docs/getting-started/faq.md` | Vereinfachte Gewichtungszusammenfassung | Muss §4.3 entsprechen; verlinken Sie zurück auf dieses Dokument |
| `cli/website/docs/network/how-it-works.md` | Einsatzfähig-Schwellenwert | Muss §5 entsprechen |
| `publish.py` über `scoring.py` | Gewichtungs-Dicts + Stufenfunktion | Automatisierter Test validiert die Übereinstimmung |

---

## Anhang A: Metriken NICHT im Kompositum (und warum)

| Metrik | Warum ausgeschlossen |
|--------|-------------|
| **BLEU** | Wortbasierte Bewertung bestraft morphologische Variation in polysynthetischen Sprachen. Ein geringfügiger Flexionsunterschied (korrekte Bedeutung, leicht abweichendes Suffix) zählt als kompletter Fehltreffer. chrF++ handhabt dies auf Zeichenebene besser. |
| **COMET** | An WMT-Daten trainiert (ressourcenreiche europäische Paare). Für LRLs (z. B. Cree) extrapoliert das Modell und ist nicht kalibriert. COMET/AfriCOMET werden **in einer separaten neuronalen Spur berechnet und berichtet — niemals in irgendeinem Kompositum** (das Kompositum ist deterministisch; §4.3) — und vom Verifier neuberechnet. |
| **TER** | Die Editierdistanz korreliert für die meisten Anwendungsfälle mit chrF++. Die Einbeziehung beider würde die Oberflächenähnlichkeit doppelt zählen. TER wird als Referenz berichtet. |
| **Längenverhältnis** | Ein Diagnostikum, kein Qualitätssignal. Ein Verhältnis von 1,02 und ein Verhältnis von 0,98 sind beide in Ordnung. Nur Extremwerte deuten auf Probleme hin. |
| **Konsistenzbewertung** | Nur auf Korpus-Ebene — kein Wert pro Eintrag zum Aggregieren. Zudem ist eine gewisse Inkonsistenz legitim (dasselbe englische Wort → verschiedene Übersetzungen in der Zielsprache je nach Kontext). |
| **Konformitätsindex** | Qualitätsgate, kein Qualitätssignal. Misst die strukturelle Erhaltung (Platzhalter, Anführungszeichen), nicht die Übersetzungsgenauigkeit. |

## Anhang B: LYSS — Sprachspezifische Metrik-Implementierungen

Das **LYSS**-Framework (Linguistically-informed Yield & Structural Scoring) stellt sprachspezifische Metriken bereit, die über den oberflächlichen Zeichenkettenvergleich hinausgehen. LYSS hat drei Kernkomponenten:

- **LYSS-fst** — Morphologische Validität (`fst_acceptance_rate`): Ist jedes Wort eine gültige Form in der Zielsprache?
- **LYSS-eq** — Linguistische Äquivalenz (`equivalent_match_rate`): Ist die Ausgabe eine akzeptable Variante der Referenz?
- **LYSS-sem** — Semantische Validierung (`semantic_score`): Erhält die Ausgabe die Quellbedeutung?

> **Validierungsstatus: 🔶 Engineering-Heuristik.** LYSS-Metriken wurden NICHT gegen menschliche Qualitätsurteile validiert. Sie sind aus linguistischen Prinzipien entworfen (FSTs, Wörterbücher, Grammatikregeln, die von Linguisten am UAlberta ALTLab erstellt wurden), aber die Korrelation zwischen LYSS-Bewertungen und tatsächlicher Übersetzungsqualität wurde nicht gemessen. Siehe das [Sprecher-Validierungsprotokoll](/docs/network/specifications/speaker-validation) für die erforderlichen Validierungsexperimente.

| Sprache | Plugin | Speicherort | LYSS-Komponente | Metrikschlüssel | Anmerkungen |
|----------|--------|----------|----------------|------------|-------|
| CRK (Plains Cree) | `CrkLinterMetric` | `eval_standards/crk/metrics.py` | **LYSS-eq** | `equivalent_match_rate` | Deterministische Variantenklassenregeln: Wortstellung, orthografisch, optionale Partikel, Lemma-Synonym, progressive Ambiguität, inklusiv/exklusiv. Produziert `lint_verdict` pro Eintrag (EXACT/EQUIVALENT/MISS/NO_OUTPUT). |
| CRK | `CrkSemanticMetric` | `eval_standards/crk/metrics.py` | **LYSS-sem** | `semantic_score` | Deterministisch: FST-Lemma-Extraktion + Wörterbuchglossen + spaCy-Inhaltswortüberlappung. Produziert Verdikte (EXACT_MATCH/VALID/GRAMMAR_ISSUES/PARTIAL/INCOMPLETE/WRONG/NO_OUTPUT). |
| GiellaLT-Sprachen | `GiellaLTFSTMetric` | `plugins/giellalt_fst.py` | **LYSS-fst** | `fst_acceptance_rate` | Generisch: funktioniert für CRK, SME, SMA, SMJ, SMN, SMS, FIN, NOB, IKU — jede Sprache mit einem `.hfstol`-Analysewerkzeug. Die Metrik ist generisch, aber **Bewertungskorpora existieren heute nur für Plains Cree (crk)**, sodass crk in der Praxis die einzige FST-bewertete Sprache ist (siehe [Ehrliche Einschränkungen](/docs/network/honest-limitations)). |

> **Architekturhinweis (Juni 2026).** Sprachspezifische LYSS-Metriken werden nun auf der Sprachkarte unter `evalMetrics` deklariert und von `plugin_discovery.py` aus `eval_standards/<lang>/` geladen. Es sind **Bewertungsstandards** (Schiedsrichter), keine Methoden-Plugin-Metriken (Teilnehmer). Dies bedeutet, dass jede auf CRK abzielende Übersetzungsmethode automatisch von LYSS bewertet wird — keine methodenspezifische Konfiguration erforderlich. `CrkFSTMetric` wurde entfernt; seine Funktionalität ist vollständig durch das generische `GiellaLTFSTMetric` abgedeckt.

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

2. Papineni, K., Roukos, S., Ward, T., & Zhu, W.-J. (2002). "BLEU: a method for automatic evaluation of machine translation." *Proceedings of the 40th Annual Meeting of the Association for Computational Linguistics (ACL 2002)*, S. 311–318. Philadelphia, PA.

3. Post, M. (2018). "A Call for Clarity in Reporting BLEU Scores." *Proceedings of the Third Conference on Machine Translation (WMT 2018)*, S. 186–191. Belgien, Brüssel. Referenzimplementierung: [sacrebleu](https://github.com/mjpost/sacrebleu).

4. Snover, M., Dorr, B., Schwartz, R., Micciulla, L., & Makhoul, J. (2006). "A Study of Translation Edit Rate with Targeted Human Annotation." *Proceedings of the 7th Conference of the Association for Machine Translation in the Americas (AMTA 2006)*, S. 223–231. Cambridge, MA.

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
