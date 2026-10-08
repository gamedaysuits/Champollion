---
sidebar_position: 1
title: "Einreichungsregeln"
related:
  - label: "Scoring Specification"
    to: /docs/network/specifications/scoring
    kind: spec
    note: "How runs are scored: chrF++ with its CI and signature"
  - label: "Statistical Significance Testing"
    to: /docs/network/specifications/significance
    kind: spec
  - label: "Evaluation Datasets"
    to: /docs/network/leaderboard/datasets
    kind: doc
  - label: "Live Leaderboard"
    to: https://champollion.dev/leaderboard
    kind: leaderboard
    note: "The rules, applied"
---

# MT-Evaluation

> **Zusammenfassung.** Diese Seite definiert die Kriterien für Einreichungen zur Bestenliste, die Bewertung (chrF++ als Hauptmetrik, flankiert von den Standardmetriken und Diagnosen), Richtlinien gegen Manipulation, Verifizierungsstufen und den Einreichungsworkflow. Methoden, die mit Evaluierungsdaten in Berührung gekommen sind, werden disqualifiziert.

champollion enthält ein Framework zur Bewertung maschineller Übersetzung, das für **reproduzierbares Benchmarking** von Übersetzungsmethoden konzipiert ist — insbesondere für ressourcenarme und indigene Sprachen, für die keine Standard-MT-Benchmarks existieren und Qualitätsaussagen schwer zu verifizieren sind.

---

## Das Leaderboard

Das Herzstück ist das **[Method Leaderboard](https://champollion.dev/leaderboard)** – eine öffentliche, live geschaltete und **für Einreichungen offene** Bestenliste, auf der Forschende und Community-Mitglieder Übersetzungsmethoden mit Fingerabdruck-versehener, reproduzierbarer Evaluierung einreichen und vergleichen.

Jede Einreichung umfasst:

- **Pipeline mit Fingerabdruck** – an einen bestimmten Git-Commit und Konfigurations-Hash gebunden, sodass Ergebnisse exakt auf den Code zurückgeführt werden können, der sie erzeugt hat
- **Versionierter Datensatz** – inhaltlich gehasht und versioniert; Punktwerte sind nur innerhalb derselben Datensatzversion vergleichbar
- **Standardisierte Metriken** – die gesamte Bewertung wird durch die gemeinsame Evaluierungs-Harness berechnet, was Implementierungsunterschiede eliminiert
- **Vertrauensstufen** – Self-benchmarked, Champollion Verified oder Community Validated
- **Kostenerfassung** – API-Kosten pro Einreichung, sodass Kosten-Qualitäts-Abwägungen transparent sind

Die Bestenliste stuft Durchläufe so ein, wie WMT, FLORES-200 und die AmericasNLP-Shared-Tasks MT-Evaluierungen berichten: anhand **einer Standardmetrik, chrF++**, dargestellt mit ihrem 95%-Konfidenzintervall und der sacreBLEU-Signatur – beispielsweise `chrF++ 47.5 [45.9, 49.0]`. Alles andere wird daneben dargestellt, niemals damit vermischt:

| Metrik | Rolle | Was gemessen wird |
|--------|-------|-------------------|
| **chrF++** | **Haupt- und Ranking-Metrik** | Zeichen-n-Gramm-F-Score gegenüber der Referenz (sacreBLEU, `word_order=2`). Bewältigt morphologisch reiche Sprachen besser als Metriken auf Wortebene |
| **BLEU, spBLEU, TER, COMET** | Standardmetriken, neben der Hauptmetrik | Die weiteren Metriken, über die MT-Publikationen berichten; COMET, sofern berechnet, mit Modell-ID |
| **Exact Match** | Diagnose | Wie oft die Übersetzung exakt der Referenz entspricht |
| **FST Acceptance** | Diagnose | Für Sprachen mit einem Finite-State-Transducer: welcher Anteil der Ausgabewörter gültige Formen sind. Vergleicht nicht mit der Quelle oder Referenz und ist daher niemals ein Score |
| **Equivalent Match** | Diagnose | Anteil, der mit der Referenz oder einer akzeptablen Variante übereinstimmt (Wortstellung, orthografische Konvention). Derzeit CRK; wird generalisiert. |
| **Semantic Score** | Diagnose | Bedeutungserhalt, ermittelt durch einen deterministischen Validator. Derzeit CRK; wird generalisiert. |
| **Score-Hinweise** | Neben der Hauptmetrik dargestellt | Wenn Ausgaben ihre Quelle kopieren, deutlich kürzer oder länger als die Referenzen sind, eine einzige Ausgabe für viele Eingaben wiederholen oder die Testzeilen Zwillinge in den Trainingsdaten haben |

Ob ein Durchlauf besser ist als ein anderer, wird durch einen gepaarten Signifikanztest auf Basis von chrF++ entschieden, nicht durch die Rangfolge zweier Zahlen – überlappende Intervalle sind eine Warnung, dass die Reihenfolge Rauschen sein könnte ([Statistische Signifikanztests](/docs/network/specifications/significance)); Wettbewerbs-Rankings nutzen den Test, um Rang-Cluster zu bilden. chrF++ vergleicht Systeme nur auf demselben Datensatz, niemals sprachübergreifend. Kein automatischer Score trägt ein Qualitätssiegel – erst die menschliche Prüfung durch Sprechende bescheinigt Qualität. Der zuvor verwendete gewichtete Gesamtwert (Composite) und die Qualitätsstufen wurden eingestellt; der Gesamtwert einer alten Karte wird, falls überhaupt, als „legacy composite (retired)“ ausgewiesen.

:::info[Vollständige Metrik-Suite]
Die [Bewertungsspezifikation](/docs/network/specifications/scoring#how-runs-are-scored) definiert, wie Durchläufe bewertet werden, sowie das vollständige Metrikinventar (sechs Kategorien: Oberflächenmetriken, strukturelle, semantische, verhaltensbezogene, Compliance- und berichtete Vergleichsmetriken).
:::

**[→ Leaderboard ansehen](https://champollion.dev/leaderboard)**

---

## Verfügbare Datensätze

Worauf ein Durchlauf bewertet werden kann, wird von den Werkzeugen aufgelistet, sodass diese Seite keine eigene Liste führt:

```bash
# the runnable corpora for a pair: size, contamination, domain, licence, provider
mt-eval corpora --source eng --target crk

# …and the catalogued ones that can never run, each with its reason
mt-eval corpora --source eng --target crk --include-quarantined
```

Die Seite [Evaluierungsdatensätze](/docs/network/leaderboard/datasets) beschreibt
den Katalog, das Korpusformat, die Schwierigkeitsstufen, die Lizenzpfade
und wie Sie Ihre eigenen Datensätze erstellen. Drei Regeln aus diesem Katalog bestimmen, was
gewertet werden kann:

- **Ein unter Quarantäne stehender Korpus wird niemals gewertet.** Er ist katalogisiert, aber niemals ausführbar,
  und die Datenbank weist jeden dagegen übermittelten Score ab. Die Englisch→Plains-Cree-Korpora von EdTeKLA
  (`eval-eng-crk-edtekla-dev-v1` und
  `eval-eng-crk-edtekla-textbook`) stehen unter Quarantäne. Sie unterliegen einer modifizierten,
  auf Souveränität ausgerichteten CC BY-NC-SA
  (`LicenseRef-EdTeKLA-Modified-CC-BY-NC-SA-4.0`) und sind von jeder
  Bestenliste, jedem Preis- und kommerziellen Pfad ausgenommen.
- **Ein kontaminierter Korpus wird nur relativ gewertet.** FLORES+ sowie jeder Korpus,
  der hinsichtlich Kontamination mit `HIGH` oder `MEDIUM` bewertet oder gar nicht eingestuft ist, erhält
  auf seiner Run Card den Vermerk „relative-comparison-only“. Er vergleicht Methoden, die
  auf diesem Korpus ausgeführt wurden, und wird niemals als absolute Qualität ausgewiesen. Nur ein mit
  `LOW` eingestufter Korpus wird nach absoluter Qualität gewertet.
- **Lizenzpfade sind bindend.** Ein nicht-kommerzieller Korpus bleibt von kommerziellen und
  Preis-Pfaden ausgeschlossen. Ein Korpus unter einer modifizierten, maßgeschneiderten oder nicht angegebenen Lizenzierung verweigert
  die Evaluierung über Remote-Modell-APIs, bis die Zustimmung der Rechteinhaber
  in seinem Eintrag hinterlegt ist.

**Wettbewerbe laufen auf versiegelten Datensätzen, die der Host verwahrt.** Ein Wettbewerb wird nicht
auf einem dieser öffentlichen Korpora bewertet. Der Host – eine Community oder eine Organisation – verwahrt
einen versiegelten, zurückgehaltenen Testdatensatz auf der eigenen Infrastruktur. Teilnehmende qualifizieren sich
über das vom Host veröffentlichte öffentliche Dev-Set und übergeben dem Knoten des Hosts anschließend ein Modell oder eine
Methode zur Ausführung. Die Treuhänder des Hosts autorisieren jeden Durchlauf, und es werden ausschließlich Scores
ausgegeben. Siehe [Einen souveränen Wettbewerb veranstalten](/docs/network/sovereignty/run-a-sovereign-contest).

:::danger[Trainieren Sie NICHT mit Evaluationsdaten]

**Diese Datensätze dienen ausschließlich der Evaluierung.** Methoden, die mit Evaluierungsdaten trainiert, feinjustiert, per Few-Shot-Prompting versehen oder anderweitig diesen ausgesetzt wurden, erzeugen künstlich überhöhte Werte und werden **vom Leaderboard disqualifiziert.**

Dies ist keine Empfehlung — es ist die wichtigste Regel für die Integrität der Evaluierung. Verwenden Sie separate Korpora für das Training. Evaluierungssätze müssen während der Entwicklung für Ihr Modell ungesehen bleiben.

Wenn Sie Coaching-Daten oder Few-Shot-Beispiele verwenden, müssen diese aus **völlig separaten Quellen** stammen. Im Zweifelsfall verzichten Sie darauf.
:::

:::warning[LLM-Nichtdeterminismus]

LLM-Ausgaben sind nichtdeterministisch. Werte stellen zeitpunktbezogene Messungen unter bestimmten Modellversionen und API-Konfigurationen dar. Modellanbieter können Gewichte, Dekodierungsstrategien oder Sicherheitsfilter jederzeit aktualisieren, was zu einer Wertedrift zwischen Durchläufen führen kann. Das Leaderboard erfasst für jede Einreichung den exakten Modell-Slug und Zeitstempel.
:::

---

## Was eine gute Methode ausmacht

Nicht alle Methoden sind gleichwertig. Folgendes unterscheidet rigorose Arbeit von überhöhten Werten.

### Merkmale einer starken Methode

- **Saubere Trennung von Trainings- und Evaluierungsdaten** — Ihre Methode hat den Evaluierungssatz während der Entwicklung, Feinabstimmung, Prompt-Erstellung oder Auswahl von Few-Shot-Beispielen nie gesehen
- **Reproduzierbar** — jemand anderes kann Ihr Repository klonen, das Harness ausführen und dieselben Werte erhalten (innerhalb der Grenzen des LLM-Nichtdeterminismus)
- **Dokumentiert** — Ihre [Methodenkarte](/docs/network/specifications/methods) beschreibt, was Ihre Methode tut, welche Werkzeuge sie verwendet und welche Einschränkungen sie hat
- **Ehrlich hinsichtlich des Umfangs** — wenn Ihre Methode nur für ein Sprachpaar funktioniert, sagen Sie es; wenn sie bei bestimmten morphologischen Mustern nachlässt, dokumentieren Sie das
- **Community-bewusst** — bei indigenen Sprachen respektiert Ihre Methode die Datensouveränität. Sie haben Sprachgemeinschaften konsultiert oder ausschließlich offen lizenzierte Daten verwendet

### Warnsignale (was zur Disqualifikation führt)

| Warnsignal | Warum es ein Problem ist |
|----------|--------------------|
| Training mit Evaluierungsdaten | Untergräbt den Zweck der Evaluierung vollständig. Überhöhte Werte führen alle in die Irre. |
| Rosinenpicken bei Ergebnissen | 10-maliges Ausführen und Einreichen des besten Durchlaufs, ohne die anderen offenzulegen |
| Nicht offengelegte Nachbearbeitung | Manuelles Korrigieren von Ausgaben vor der Bewertung |
| Kontaminierte Coaching-Daten | Verwendung von Beispielen aus dem Evaluierungssatz als Few-Shot-Prompts oder Wörterbucheinträge |
| Behauptung kommerzieller Einsatzbereitschaft ohne Herkunftsnachweis | Wenn Ihre Methode CC BY-NC-SA-Daten verwendet, ist sie nicht kommerziell einsatzbereit |

### Verifizierungsstufen

Verifizierungsstufen beschreiben, **wer das Ergebnis validiert hat**. Sie sind keine Gütesiegel (die alten automatischen Qualitätsstufen wurden [eingestellt](/docs/network/specifications/scoring#5-quality-tiers)).

| Stufe | Bedeutung | Wie man sie erhält |
|-------|-----------|--------------------|
| **Self-benchmarked** | Sie haben die Harness selbst ausgeführt und Ergebnisse eingereicht | Veröffentlichen Sie Ihre Run Card mit `mt-eval publish` |
| **Champollion Verified** | Das Projekt hat Ihre eingereichten Ausgaben unabhängig anhand des sha-gepinnten Referenzkorpus neu bewertet und Ihren Score reproduziert | Der Re-Scorer ist ein Maintainer-Tool, das manuell als Batch ausgeführt wird. Es gibt keine automatische Ablaufplanung, daher wird keine Einreichung direkt bei Eingang neu bewertet (siehe unten) |
| **Community Validated** | Zweisprachige Sprechende der Zielsprache, qualifiziert nach dem Protokoll der jeweiligen Community, haben eine geschichtete Stichprobe der Ausgabe geprüft (≥30 Einträge, ≥2 Prüfende) und ≥70 % entsprachen den Anforderungen der Community. Wird ausschließlich durch eigene Prüfungen der Community vergeben; eine Herabstufung durch Stichprobenaudits erfolgt symmetrisch | Reichen Sie den Methodencode bei der Governance-Organisation ein – diese führt ihn gegen das Gold-Standard-Set aus und übergibt die Ausgabe der Community-Prüfung |

**Die Community-validierte Beurteilung ist ein separater Pfad, und bislang existieren keine Bewertungen aus menschlicher Evaluierung:** Die Harness kann zwar auswählen, welche Systeme ein festes Budget für menschliche Prüfungen aus dem eingefrorenen Ranking eines abgeschlossenen Wettbewerbs abdecken würde (nur vollständige Gleichstandsgruppen – ein Cluster wird niemals geteilt), sie erfasst jedoch keine Bewertungen, und kein Eintrag auf der Bestenliste verfügt derzeit über ein menschliches Urteil.

**Ränge sind Cluster, keine strikte Rangfolge.** Benachbarte Einträge, die der Signifikanztest nicht voneinander trennen kann, teilen sich einen Rang und tragen einen Rang-*Bereich*; in einem versiegelten Wettbewerb, bei dem segmentweise Ausgaben den Rechner des Veranstalters niemals verlassen, läuft der gepaarte Test auf diesem Rechner und nur seine signierten Entscheide werden ausgegeben; ohne diese stützen sich Gleichstände auf Nachweise aus Konfidenzintervallen oder Punktegleichheit. Wie dies funktioniert und wie schwach jede Stufe der Evidenzleiter ist, wird in [Statistische Signifikanztests → Rang-Cluster](/docs/network/specifications/significance#ranking-clusters) dargelegt.

### Wie Verifizierung skaliert: Reputationsgewichtete Audits

**Wir beanspruchen keine lückenlose Provenienz.** Ein Bestenlisteneintrag wird von einer beitragenden Person
erzeugt, die die *Open-Source*-Harness auf dem *eigenen* Rechner ausführt. „Dieser Durchlauf stammt wirklich
aus der Harness“ ist nichts, was ein Server für selbst gehostete Rechenleistung verifizieren kann – der
Signaturschlüssel der Harness liegt in den Händen der beitragenden Person, sodass eine Signatur eine *Maschine authentifiziert,
nicht Ehrlichkeit*. Anstatt etwas anderes vorzutäuschen, **wird Validität hier verdient und korrigiert sich selbst**: Ein
Eintrag ist vertrauenswürdig, weil sein Score **reproduzierbar** ist und weil die dahinterstehende Person
**eine Reputation aufs Spiel gesetzt hat, die durch eine aufgedeckte Fälschung zerstört würde.** Die Verifizierung
erfolgt in vier Schichten, sodass sie dort gründlich ist, wo sie es sein muss, und dort kostengünstig, wo sie es sein kann
– das Projekt muss niemals die Arbeit aller Beteiligten erneut ausführen.

- **L0 – Alles neu bewerten (kostenlos, ~100 %).** Der Re-Scorer leitet Ihren
  Score aus *Ihren eigenen eingereichten Ausgaben* anhand des **sha-gepinnten Referenzkorpus**
  (nicht Ihrer gespeicherten Kopie davon) mit derselben Metrik ab, die die Harness verwendet.
  Lässt sich der Score anhand der Ausgaben nicht reproduzieren oder wurde eine gespeicherte Referenz
  verändert, wird der Durchlauf **disqualifiziert** – dies allein unterbindet eingetippte oder manipulierte
  Scores. Ein Durchlauf, der reproduzierbar ist, wird zu **Champollion Verified** hochgestuft – der
  Stufe, die ein Wettbewerbs-Ranking standardmäßig verwendet und die als einzige für einen
  Preis infrage kommt. Dies ist implementiert und kostengünstig, aber es ist ein **Maintainer-Befehl, der manuell
  ausgeführt wird**: Nichts führt ihn bei der Einreichung automatisch aus, und nichts plant ihn zeitlich ein. Bis sich das
  ändert, geht jeder Eintrag als „self-benchmarked“ ein – und bleibt es auch.
- **L1 – Eine Reputationsleiter für Beitragende.** Jede beitragende Person (identifiziert über ihren
  Login) erlangt Reputation *ausschließlich* dadurch, dass sie die tiefergehenden Prüfungen unten besteht – niemals
  durch reines Volumen, sodass das Erstellen neuer Identitäten keinen Vorteil bringt. Die Reputation ist
  **öffentlich**, und sie bestimmt, wie oft die aufwendige Prüfung ausgelöst wird.
- **L2 – Eine *Stichprobe* erneut ausführen (die aufwendige Prüfung; derzeit nur Richtlinie, noch kein Re-Runner
  vorhanden).** Bei einem *öffentlichen* Development-Set kann L0 niemanden überführen, der
  einfach die Referenz als seine „Übersetzung“ kopiert. Um dies aufzudecken, muss
  das Modell tatsächlich erneut ausgeführt werden – echte Rechenleistung –, weshalb wir dies bei einer
  **Stichprobe** durchführen würden, nicht bei allen. Die **Stichproben-Richtlinie** ist implementiert und getestet: Ein
  Durchlauf wird mit einer Wahrscheinlichkeit ausgewählt, die mit der **Tragweite** steigt (ein Durchlauf,
  der die erste Brücke zu einer ganzen Sprachfamilie schlägt, wird *immer* ausgewählt),
  mit der **Anomalie** steigt (ein Sprung gegenüber dem bisherigen Bestwert, der zu gut ist, um wahr zu sein, wird
  *immer* ausgewählt) und mit der **Reputation** sinkt (wer viele Audits
  bestanden hat, wird nur selten stichprobenartig geprüft; ein Neuling oder anonymer Einreicher
  wird bei jedem Durchlauf geprüft, bis Vertrauen aufgebaut ist). Das Bestehen eines L2-Audits
  erhöht die Reputation. **Der Re-Runner, den diese Richtlinie ansteuern würde, existiert noch nicht**,
  sodass noch nie ein L2-Audit ausgelöst wurde: Ein ausgewählter Durchlauf wird als *L2-pending* erfasst.
- **L3 – Bekräftigung (kostenlose Verifizierung).** Wenn zwei *unabhängige* Beitragende
  dasselbe Modell auf demselben Korpus ausführen und ihre neu bewerteten Ausgaben **übereinstimmen**,
  *ist* diese Übereinstimmung eine Verifizierung – und sie erhöht die Reputation beider. Eine
  tatsächliche **Abweichung** markiert beide Durchläufe für ein L2-Audit. Replikation wird
  belohnt, anstatt als redundant behandelt zu werden.

**Eine aufgedeckte Fälschung ist katastrophal – wie ein Widerruf.** Eine nachgewiesene
Fälschung setzt die Reputation der beitragenden Person auf null zurück, **unterzieht ihre gesamte
verifizierte Historie einem erneuten Audit** (jeder ihrer verifizierten Durchläufe wird erneut der
Verifizierung zugeführt) und wird **öffentlich** im Audit-Protokoll festgehalten. Das macht
seltene Stichproben sicher: Bei einem öffentlichen Dev-Set zu betrügen, mag bei einem einzelnen Durchlauf unbemerkt bleiben,
aber die erwarteten Kosten – der Verlust des gesamten erarbeiteten Vertrauens und die erneute Überprüfung
der gesamten Historie – machen es zu einer schlechten Wette. Diese Regeln binden die eigenen Durchläufe der Maintainer
gleichermaßen.

**Warum sich das Beitragen trotzdem lohnt.** Sie übernehmen stets den aufwendigen Teil
(die Ausführung Ihrer Methode); das Projekt übernimmt lediglich das kostenlose L0-Re-Scoring für alle
sowie eine erneute L2-Ausführung bei einer *schrumpfenden Stichprobe* – hoch bei Neulingen und Durchläufen mit hoher
Tragweite, niedrig bei bewährten Beitragenden. Die Verifizierungskosten werden *durch Reputation amortisiert
und durch Bekräftigung geteilt*, anstatt jedes Mal vollständig neu bezahlt zu werden.

---

## Wie man einreicht

1. **Erstellen Sie Ihre Methode** – siehe [Erstellen einer Methode](/docs/network/specifications/methods) für die Methodenschnittstelle
2. **Führen Sie die Harness aus** – siehe [Eval Harness](/docs/network/specifications/harness) für Einrichtung und Nutzung
3. **Generieren Sie eine Run Card** – die Harness erzeugt eine JSON-Run-Card mit Ihren Scores, Fingerabdruck und Metadaten
4. **Veröffentlichen** – `mt-eval publish eval/logs/harness/<run-id>_report.json --prod` lädt die Run Card auf die Bestenliste hoch (Vorschau mit `--dry-run`)
5. **Erscheinen auf der Bestenliste** – Ihr Durchlauf wird als *self-benchmarked (unverified)* aufgeführt. Das [Method Leaderboard](https://champollion.dev/leaderboard) listet und stuft jede Zeile ein, die nicht `disqualified` ist, einschließlich selbst evaluierter Durchläufe, die entsprechend gekennzeichnet sind; filtern Sie nach *Champollion Verified*, um nur neu bewertete Ergebnisse zu sehen. Das L0-Re-Scoring, das einen Durchlauf auf diese Stufe hochstuft, ist ein Maintainer-Batch, der nicht automatisiert geplant wird, sodass heute jeder Eintrag auf der Bestenliste eine selbstberichtete Angabe ist. „Verified-only“ ist der Standard für ein **Wettbewerbs**-Ranking und die einzige Stufe, die für einen Preis infrage kommt

---

## Integritätsrichtlinie: Widerrufe, erneute Ausführungen, Delisting, Streitfälle

Im Vorfeld verfasst, damit die Durchsetzung ein Verfahren ist und kein Drama. Diese Regeln
binden alle gleichermaßen – einschließlich der eigenen Durchläufe der Maintainer.

**Keine Widerrufe.** Ein veröffentlichter Durchlauf ist ein dauerhafter Datensatz. Es gibt
keinerlei Mechanismus – für niemanden –, einen Score zu löschen, weil er peinlich ist.
Jede Durchlaufzeile trägt einen serverseitig erstellten `submitted_at`-Zeitstempel und einen
unveränderlichen Prüfpfad; Moderationsmaßnahmen selbst werden protokolliert.

**Erneute Ausführungen werden angehängt, niemals ersetzt.** Wenn Sie Ihre Methode verbessern, veröffentlichen Sie einen
neuen Durchlauf. Der alte Durchlauf bleibt bestehen. Selektive Offenlegung – das private Testen vieler
Varianten und die Veröffentlichung nur des Gewinners – hat andere Bestenlisten
anfällig für Manipulationen gemacht; ein reines Anhängeprotokoll (Append-only) ist die strukturelle Antwort darauf. Die Deduplizierung
über Fingerabdrücke verhindert byte-identischen Spam durch Neueinreichungen; sie schreibt die Historie niemals um.

**Ein Delisting ist Regeldurchsetzung unter Nennung der Regel.** Ein Durchlauf wird nur aus
aufgeführten Gründen delistet (sichtbar als `disqualified` markiert – nicht stillschweigend entfernt):
ein unter Quarantäne stehender oder unzulässig teilweiser Datensatz (erzwungen durch Datenbank-Trigger
unterhalb jedes Clients), Prüfsummenabweichungen beim Korpus, gefälschte oder
außerhalb des gültigen Bereichs liegende Scores, Verstöße gegen Inhaltsrichtlinien (Content Guards) oder der Rückruf der
Registrierung der zugrundeliegenden Daten durch einen Treuhänder. Das Delisting benennt die Regel und die
Belege. Neue Gründe werden hier durch datierte Änderungen hinzugefügt, bevor sie jemals
angewendet werden – niemals rückwirkend für einen Einzelfall erfunden.

### Ein Ergebnis melden

*Hinzugefügt am 2026-09-07.*

:::caution[Derzeit werden noch keine Meldungen entgegengenommen]

Das Meldesystem ist implementiert und die Datenbank ist seit dem 2026-09-07 dafür vorbereitet – aber das
Formular zum Einreichen einer Meldung wurde noch nicht entsprechend neu bereitgestellt, sodass *Flag this
result* noch nicht abgesendet werden kann. Der Vorgang schlägt fehl, anstatt eine Meldung stillschweigend anzunehmen.
Senden Sie in der Zwischenzeit eine E-Mail an `info@champollion.dev`. Dieser Hinweis wird an dem Tag entfernt,
an dem das Formular bereitgestellt wird.

:::

**Jede Person kann ein Ergebnis melden.** Erweitern Sie die entsprechende Zeile auf der Bestenliste und wählen Sie *Flag
this result*: Es öffnet sich ein Nachrichtenformular, das bereits an die ID dieses Durchlaufs gebunden ist, und Sie
geben an, was Ihrer Ansicht nach falsch ist und woher Sie das wissen – ein kontaminierter Korpus, eine
Metrik, die nicht zu ihrer Bezeichnung passt, eine falsch zugeschriebene Methode oder etwas anderes. Eine
Meldung muss einen Grund angeben. Eine Meldung ohne Begründung ist ein Downvote, und auf dieser Bestenliste
gibt es keine Downvotes.

**Eine Meldung ist eine private Nachricht, keine Abstimmung.** Sie erreicht die Maintainer als
Ticket und gelangt nirgendwo sonst hin. Es wird niemals die Anzahl der Meldungen angezeigt – weder in der
Zeile noch in der Run Card noch sonst wo –, da ein sichtbarer Zähler selbst
ein Anreiz zur Manipulation wäre und der Status eines Ergebnisses auf Belegen beruhen muss, nicht darauf,
wie viele Personen Einwände erhoben haben. Das Einreichen einer Meldung allein ändert nichts an der
Zeile.

**Eine bestätigte Meldung zeigt sich auf genau eine Weise:** Das Ergebnis wird als
`disqualified` markiert, aus einem Grund, der bereits auf dieser Seite aufgeführt ist. Wie bei jedem anderen
Delisting wird ein neuer Grund hier **durch eine datierte Änderung hinzugefügt, bevor er auf irgendjemanden angewendet wird**
– eine Meldung kann also niemals eine geheime oder rückwirkende Regel hervorbringen. Wird einer
Meldung nicht stattgegeben, bleibt die Zeile unverändert; und wenn Sie eine Adresse hinterlassen haben, erhalten Sie in jedem Fall
eine Antwort.

**Vertrauensstufen sind Bezeichnungen, keine Bearbeitungen.** `self-benchmarked`-Zeilen sind Behauptungen;
`Champollion Verified`-Zeilen wurden unabhängig anhand der Ausgaben des
Einreichenden gegen den sha-gepinnten Korpus neu bewertet; `Community Validated` wird
ausschließlich durch eigene Tests der Community vergeben. Eine Verifizierung ändert die Stufe einer Zeile
– sie ändert niemals die Scores der Zeile.

**Reputation ist öffentlich und korrigiert sich selbst.** Die Reputation der Beitragenden sowie das
Audit-Protokoll, das jedes Re-Scoring, stichprobenartige erneute Ausführungen, Bekräftigungen und
Aufdeckungen von Fälschungen aufzeichnet, sind öffentlich. Reputation ist kein Score-Multiplikator und berührt
niemals die Zahlen eines Durchlaufs – sie bestimmt lediglich, wie oft die Durchläufe einer beitragenden Person
erneut auditiert werden (siehe *reputationsgewichtete Audits* oben). Eine nachgewiesene Fälschung wird
ebenso öffentlich wie ein Widerruf festgehalten und zieht ein erneutes Audit der gesamten verifizierten Historie
der beitragenden Person nach sich; dieselben Regeln gelten für die eigenen Durchläufe der Maintainer.

**Streitfälle.** Eröffnen Sie ein Issue mit der Durchlauf-ID und der konkreten Beanstandung (falscher
Score, falscher Datensatz, falsch angewendete Regel). Die Maintainer führen die
deterministischen Prüfungen öffentlich erneut durch; das Ergebnis und die Belege dafür werden im
Issue dokumentiert. Betrifft die Streitigkeit die Daten oder Validierung einer Community, entscheidet
die zuständige Instanz der Community selbst und die Bestenliste setzt deren Entscheidung um.
Für Preiswettbewerbe gelten dieselben Regeln zuzüglich der vorab veröffentlichten
Qualifikations- und Audit-Schritte des Wettbewerbs – Gewinner werden **vor** der Auszahlung auditiert, und eine
Disqualifikation zitiert die Regel genau wie jedes andere Delisting.

## Zukünftige Ausrichtungen

- **Umfassende Modellvergleichsdurchläufe** — systematische Evaluierung von Frontier-Modellen (GPT-4o, Claude, Gemini usw.) über champollion-Sprachen hinweg unter Verwendung benutzerdefinierter Evaluierungskorpora (keine öffentlichen Benchmarks)
- **Mehr Sprachpaare** — Quechua, Inuktitut und andere ressourcenarme Sprachen, sobald Community-verifizierte Datensätze verfügbar werden
- **Datensatzimport** — Werkzeuge zur Konvertierung externer Evaluierungsdatensätze (WMT, Tatoeba usw.) in das champollion-Evaluierungsformat
- **Automatisierte Wiederholungsdurchläufe** — Erkennung von Modellversionsänderungen und erneutes Ausführen von Benchmarks zur Verfolgung der Wertedrift

---

## Siehe auch

- **[Method Leaderboard](https://champollion.dev/leaderboard)** – Live-Scores und Einreichungen
- **[Eval Harness](/docs/network/specifications/harness)** – Durchführung von Evaluierungen
- **[Evaluierungsdatensätze](/docs/network/leaderboard/datasets)** – Datensatzformat und verfügbare Datensätze
- **[Erstellen einer Methode](/docs/network/specifications/methods)** – Spezifikation der Methodenschnittstelle
- **[Run-Card-Spezifikation](/docs/network/specifications/run-card)** – JSON-Schema der Run Card
- **[Benchmark-Spezifikation](/docs/network/specifications/benchmark)** – Evaluierungsprotokoll, Korpusformat, Souveränität
- **[Bewertungsspezifikation](/docs/network/specifications/scoring)** – SSOT für Metriken und wie Durchläufe bewertet werden
