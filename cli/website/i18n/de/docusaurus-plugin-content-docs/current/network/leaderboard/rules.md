---
sidebar_position: 1
title: "Einreichungsregeln"
related:
  - label: "Scoring Specification"
    to: /docs/network/specifications/scoring
    kind: spec
    note: "How the composite score is computed"
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

> **Zusammenfassung.** Diese Seite definiert die Einreichungskriterien für das Leaderboard, die Bewertungsmetriken (chrF++, FST-Akzeptanz, exakte Übereinstimmung, äquivalente Übereinstimmung, semantischer Wert), Richtlinien gegen Manipulation, Verifizierungsstufen und den Einreichungsablauf. Methoden, die den Evaluierungsdaten ausgesetzt waren, werden disqualifiziert.

champollion enthält ein Framework zur Bewertung maschineller Übersetzung, das für **reproduzierbares Benchmarking** von Übersetzungsmethoden konzipiert ist — insbesondere für ressourcenarme und indigene Sprachen, für die keine Standard-MT-Benchmarks existieren und Qualitätsaussagen schwer zu verifizieren sind.

---

## Das Leaderboard

Das Herzstück ist das **[Method Leaderboard](https://champollion.dev/leaderboard)** — eine öffentliche Rangliste, live und **offen für Einreichungen**, in der Forscher und Community-Mitglieder Übersetzungsmethoden mit einer per Fingerabdruck versehenen, reproduzierbaren Evaluierung einreichen und vergleichen.

Jede Einreichung umfasst:

- **Fingerprinted Pipeline** — an einen spezifischen Git-Commit und Config-Hash gebunden, sodass Ergebnisse exakt auf den Code zurückverfolgt werden können, der sie erzeugt hat
- **Versionierter Datensatz** — inhaltsgehasht und versioniert; Bewertungen (Scores) sind nur innerhalb derselben Datensatzversion vergleichbar
- **Standardisierte Metriken** — alle Bewertungen werden durch das gemeinsame Evaluation Harness berechnet, wodurch Implementierungsunterschiede eliminiert werden
- **Vertrauensstufen** — self-benchmarked, Champollion Verified oder Community Validated
- **Kostenverfolgung** — API-Kosten pro Einreichung, sodass Kompromisse zwischen Kosten und Qualität transparent sind

Das Leaderboard bewertet fünf Metriken. Drei funktionieren für jede Sprache; zwei sind für Plains Cree verfügbar und werden mit unserer Erweiterung generalisiert:

| Metrik | Typ | Was sie misst |
|--------|------|------------------|
| **chrF++** | Zeichen-n-Gramm-F-Wert | Primäre Qualitätsmetrik — korreliert gut mit menschlicher Beurteilung, insbesondere bei morphologisch reichen Sprachen |
| **Exact Match** | Anteil perfekter Übereinstimmungen | Strikte Genauigkeit — wie oft entspricht die Übersetzung exakt dem Goldstandard? |
| **FST Acceptance** | Durchlaufrate des morphologischen Filters | Für Methoden mit Finite-State-Transducer-Verifizierung — welcher Anteil der Ausgaben ist morphologisch valide? |
| **Equivalent Match** | Rate akzeptabler Varianten | Anteil, der der Referenz oder einer akzeptablen Variante entspricht (Wortstellung, orthografische Konvention). Derzeit CRK; wird generalisiert. |
| **Semantic Score** | Semantische Treue | Bedeutungserhaltung — erfasst die Übersetzung die beabsichtigte Bedeutung unabhängig von der Oberflächenform? Derzeit CRK; wird generalisiert. |

:::info[Vollständige Metrik-Suite]
Die [Bewertungsspezifikation](/docs/network/specifications/scoring) definiert das vollständige Metrik-Inventar (sechs Kategorien: Oberfläche, Struktur, Semantik, Verhalten, Konformität und gemeldete Vergleichswerte), die Formel für den zusammengesetzten Score, die Gewichtungstabellen und die Schwellenwerte für die Qualitätsstufen.
:::

**[→ Leaderboard ansehen](https://champollion.dev/leaderboard)**

---

## Verfügbare Datensätze

### EDTeKLA Development Set v1

Der erste Evaluierungsdatensatz, erstellt für die Übersetzung Englisch→Plains Cree (SRO). Erstellt von der [EdTeKLA-Forschungsgruppe](https://spaces.facsci.ualberta.ca/edtekla/) an der University of Alberta.

| Eigenschaft | Wert |
|----------|-------|
| **ID** | `edtekla-dev-v1` |
| **Sprachpaar** | EN → CRK (Plains Cree, SRO-Orthografie) |
| **Anzahl der Einträge** | Dev-Split mit 436 Einträgen (`textbook_dev.json`); die vollständige Aufschlüsselung wird einmal auf der Seite [Evaluation Datasets](/docs/network/leaderboard/datasets#edtekla-development-set-v1) angegeben |
| **Lizenz** | [EdTeKLAs modifizierte CC BY-NC-SA](https://github.com/EdTeKLA/IndigenousLanguages_Corpora) (`LicenseRef-EdTeKLA-Modified-CC-BY-NC-SA-4.0`, souveränitätsbezogen) — nicht-kommerziell; ausgenommen von den Leaderboard-, Preis- und kommerziellen/API-Bereichen |
| **Provenienz** | `gold_standard` (von Sprechern verifiziert), `textbook` (veröffentlichte Lehrmaterialien) |

### FLORES+ Devtest — Nur für Entwicklungszwecke

> [!WARNING]
> **FLORES+ ist für Entwicklung und Debugging verfügbar, wird aber NICHT für die offizielle Leaderboard-Evaluierung verwendet.** FLORES+ (ursprünglich Meta FLORES-200) ist ein weithin öffentlicher Benchmark-Datensatz, auf dem Frontier-LLMs mit ziemlicher Sicherheit trainiert wurden. Werte gegen FLORES+ spiegeln die reale Übersetzungsqualität bei LLM-basierten Methoden nicht zuverlässig wider. Nicht-LLM-Methoden (FST, regelbasiert, feinjustierte NMT) sind weniger betroffen, aber FLORES+-Werte werden dennoch nicht auf dem Leaderboard veröffentlicht.

FLORES+-Fixtures bleiben in `test/benchmark/fixtures/` verfügbar für Pipeline-Smoke-Tests, sprachübergreifende Validierung und Entwicklungszwecke. Die offizielle Evaluierung verwendet benutzerdefinierte Korpora, die aus von Menschen verfassten Texten erstellt wurden, welche nicht öffentlich in paralleler Form verfügbar sind.

Siehe [Evaluation Datasets](/docs/network/leaderboard/datasets) für das vollständige Datensatzschema, die Schwierigkeitsstufen und wie Sie Ihren eigenen erstellen.

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

Verifizierungsstufen beschreiben, **wer das Ergebnis validiert hat** — getrennt von den Qualitätsstufen (Baseline → Fluent), die in der [Scoring Specification, §5](/docs/network/specifications/scoring#5-quality-tiers) definiert sind und beschreiben, was der automatisierte Gesamtwert bedeutet.

| Stufe | Bedeutung | Wie man sie erhält |
|------|---------|--------------|
| **Self-benchmarked** | Sie haben das Harness selbst ausgeführt und die Ergebnisse eingereicht | Veröffentlichen Sie Ihre Run Card mit `mt-eval publish` |
| **Champollion Verified** | Der Server hat Ihre eingereichten Ausgaben unabhängig gegen das SHA-gepinnte Referenzkorpus neu bewertet und Ihren Score reproduziert | Automatisch — jede Einreichung wird neu bewertet (siehe unten) |
| **Community Validated** | Zweisprachige Sprecher der Zielsprache, die gemäß dem eigenen Protokoll der Community qualifiziert sind, haben eine geschichtete Stichprobe der Ausgabe (≥30 Einträge, ≥2 Prüfer) überprüft und ≥70 % haben die Anforderungen der Community erfüllt. Wird nur durch die eigenen Tests der Community verliehen; eine Rückstufung durch Stichprobenprüfung erfolgt symmetrisch | Reichen Sie den Methodencode bei der Governance-Organisation ein — diese führt ihn gegen das Goldstandard-Set aus und legt die Ausgabe der Community zur Überprüfung vor |

### Wie die Verifizierung skaliert: reputationsgewichtete Prüfung

**Wir beanspruchen keine Provenienz.** Eine Zeile im Leaderboard wird von einem Mitwirkenden (Contributor) erstellt, der das *Open-Source*-Harness auf seiner *eigenen* Maschine ausführt. „Dieser Run stammt wirklich aus dem Harness“ ist nichts, was ein Server für selbstgehostete Rechenleistung verifizieren kann — der Signaturschlüssel des Harness liegt in den Händen des Mitwirkenden, sodass eine Signatur eine *Maschine authentifiziert, keine Ehrlichkeit*. Anstatt etwas anderes vorzutäuschen, **wird Gültigkeit hier verdient und ist selbstkorrigierend**: Eine Zeile ist vertrauenswürdig, weil ihr Score **reproduzierbar** ist und weil der Mitwirkende dahinter **seinen Ruf aufs Spiel gesetzt hat, den eine aufgedeckte Fälschung zerstören würde.** Die Verifizierung erfolgt in vier Schichten, sodass sie gründlich ist, wo sie es sein muss, und günstig, wo sie es sein kann — das Projekt muss niemals die Arbeit aller neu ausführen.

- **L0 — alles neu bewerten (kostenlos, 100 %).** Der Server leitet Ihren Score aus *Ihren eigenen eingereichten Ausgaben* gegen das **SHA-gepinnte Referenzkorpus** (nicht Ihre gespeicherte Kopie davon) neu ab, mit derselben Metrik, die das Harness verwendet. Wenn sich der Score nicht aus den Ausgaben reproduzieren lässt oder eine gespeicherte Referenz geändert wurde, wird der Run **disqualifiziert** — dies allein verhindert einen manuell eingegebenen oder manipulierten Score. Ein Run, der sich reproduzieren lässt, wird zu **Champollion Verified** hochgestuft, der einzigen Stufe, die das Leaderboard in die Rangliste aufnimmt. Dies wird bei jeder Einreichung ausgeführt und dauert nur Millisekunden.
- **L1 — eine Reputationsleiter für Mitwirkende.** Jeder Mitwirkende (identifiziert durch seine Anmeldung) verdient sich Reputation *nur*, indem er die tiefergehenden Prüfungen unten übersteht — niemals nur durch schiere Menge, sodass das Erstellen neuer Identitäten keinen Vorteil bringt. Die Reputation ist **öffentlich** und entscheidet darüber, wie oft die teure Prüfung ausgelöst wird.
- **L2 — eine *Stichprobe* neu ausführen (die teure Prüfung).** Bei einem *öffentlichen* Development-Set kann L0 keinen Mitwirkenden erwischen, der einfach die Referenz als seine „Übersetzung“ kopiert. Um dies aufzudecken, muss das Modell tatsächlich neu ausgeführt werden — echte Rechenleistung —, daher tun wir dies bei einer **Stichprobe**, nicht bei jedem. Ein Run wird für eine L2-Neuausführung mit einer Wahrscheinlichkeit als Stichprobe ausgewählt, die mit dem **Einsatz** steigt (ein Run, der die erste Brücke zu einer ganzen Sprachfamilie schlägt, wird *immer* neu ausgeführt), mit **Anomalien** steigt (ein Zu-schön-um-wahr-zu-sein-Sprung über den bisherigen Bestwert wird *immer* neu ausgeführt) und mit der **Reputation** sinkt (ein Mitwirkender, der viele Audits bestanden hat, wird selten stichprobenartig geprüft; ein Neuling oder anonymer Einreicher wird bei jedem Run geprüft, bis er sich Vertrauen verdient hat). Das Bestehen eines L2-Audits erhöht die Reputation.
- **L3 — Bestätigung (kostenlose Verifizierung).** Wenn zwei *unabhängige* Mitwirkende dasselbe Modell auf demselben Korpus ausführen und ihre neu bewerteten Ausgaben **übereinstimmen**, *ist* diese Übereinstimmung eine Verifizierung — und sie erhöht die Reputation beider. Eine echte **Nichtübereinstimmung** markiert beide Runs für ein L2-Audit. Replikation wird belohnt und nicht als redundant behandelt.

**Eine aufgedeckte Fälschung ist katastrophal — wie eine Zurückziehung.** Eine nachgewiesene Fälschung setzt die Reputation des Mitwirkenden auf null, **unterzieht seine gesamte verifizierte Historie einem erneuten Audit** (jeder seiner verifizierten Runs wird erneut durch die Verifizierung geschickt) und wird **öffentlich** im Audit-Protokoll festgehalten. Genau das macht eine leichte Stichprobenziehung sicher: Das Betrügen bei einem öffentlichen Dev-Set mag bei einem Run durchrutschen, aber die erwarteten Kosten — der Verlust allen verdienten Vertrauens und die erneute Überprüfung der gesamten Aufzeichnungen — machen es zu einer schlechten Wette. Diese Regeln binden die eigenen Runs der Maintainer symmetrisch.

**Warum sich das Mitwirken dennoch lohnt.** Sie zahlen immer den teuren Teil (die Ausführung Ihrer Methode); das Projekt zahlt nur die kostenlose L0-Neubewertung für alle plus eine L2-Neuausführung bei einer *schrumpfenden Stichprobe* — hoch für Neulinge und Runs mit hohem Einsatz, niedrig für bewährte Mitwirkende. Die Verifizierungskosten werden *durch Reputation amortisiert und durch Bestätigung geteilt*, anstatt jedes Mal vollständig neu bezahlt zu werden.

---

## Wie man einreicht

1. **Erstellen Sie Ihre Methode** — siehe [Building a Method](/docs/network/specifications/methods) für das Methoden-Interface
2. **Führen Sie das Harness aus** — siehe [Eval Harness](/docs/network/specifications/harness) für Einrichtung und Nutzung
3. **Generieren Sie eine Run Card** — das Harness erstellt eine JSON-Run-Card mit Ihren Scores, Ihrem Fingerabdruck und Metadaten
4. **Veröffentlichen** — `mt-eval publish eval/logs/harness/<your-run-card>.json` lädt die Run Card auf das Leaderboard hoch
5. **Erscheinen Sie auf dem Leaderboard** — Ihr Run wird als *self-benchmarked (unverified)* bereitgestellt, dann bewertet der Server Ihre Ausgaben automatisch gegen das SHA-gepinnte Korpus neu (L0); wenn er reproduziert wird, steigt der Run zu *Champollion Verified* auf — der einzigen Stufe, die das [Method Leaderboard](https://champollion.dev/leaderboard) in die Rangliste aufnimmt. Ein tiefergehendes reputationsgewichtetes Audit folgt den oben genannten Vertrauensstufen

---

## Integritätsrichtlinie: Zurückziehungen, Neuausführungen, Delisting, Streitigkeiten

Im Voraus verfasst, damit die Durchsetzung ein Verfahren und kein Drama ist. Diese Regeln binden alle symmetrisch — einschließlich der eigenen Runs der Maintainer.

**Keine Zurückziehungen.** Ein veröffentlichter Run ist ein dauerhafter Eintrag. Es gibt keinen Mechanismus — für niemanden —, um einen Score zu löschen, weil er peinlich ist. Jede Run-Zeile trägt einen vom Server gestempelten `submitted_at`-Zeitstempel und einen unveränderlichen Audit-Trail; Moderationsmaßnahmen selbst werden protokolliert.

**Neuausführungen werden angehängt, niemals ersetzt.** Wenn Sie Ihre Methode verbessern, veröffentlichen Sie einen neuen Run. Der alte Run bleibt bestehen. Selektive Offenlegung — das private Testen vieler Varianten und die Veröffentlichung nur des Gewinners — ist das, was andere Leaderboards manipulierbar gemacht hat; ein reiner Anfüge-Datensatz (Append-only) ist die strukturelle Antwort darauf. Die Fingerabdruck-Deduplizierung stoppt Spam durch byte-identische Wiedereinreichungen; sie schreibt niemals die Geschichte um.

**Delisting ist Regelausführung, unter Nennung der Regel.** Ein Run wird nur aus den aufgeführten Gründen aus der Liste entfernt (sichtbar als `disqualified` markiert — nicht stillschweigend entfernt): ein unter Quarantäne gestellter Datensatz oder ein Datensatz mit unzulässiger Teilmenge (durchgesetzt durch Datenbank-Trigger unterhalb jedes Clients), Nichtübereinstimmung der Korpus-Prüfsumme, gefälschte oder außerhalb des zulässigen Bereichs liegende Scores, Verstöße gegen den Content-Guard oder der Widerruf der Registrierung der zugrunde liegenden Daten durch einen Steward. Das Delisting benennt die Regel und die Beweise. Neue Gründe werden hier durch eine datierte Bearbeitung hinzugefügt, bevor sie jemals angewendet werden, und niemals rückwirkend für einen Einzelfall erfunden.

**Vertrauensstufen sind Labels, keine Bearbeitungen.** `self-benchmarked`-Zeilen sind Behauptungen; `Champollion Verified`-Zeilen wurden unabhängig aus den Ausgaben des Einreichers gegen das SHA-gepinnte Korpus neu bewertet; `Community Validated` wird nur durch die eigenen Tests der Community verliehen. Die Verifizierung ändert die Stufe einer Zeile — sie ändert niemals die Scores der Zeile.

**Reputation ist öffentlich und selbstkorrigierend.** Die Reputation der Mitwirkenden und das Audit-Protokoll, das jede Neubewertung, jede stichprobenartige Neuausführung, jede Bestätigung und jeden Reputationsverlust durch Fälschung aufzeichnet, sind öffentlich. Reputation ist kein Score-Multiplikator und berührt niemals die Zahlen eines Runs — sie legt nur fest, wie oft die Runs eines Mitwirkenden erneut geprüft werden (siehe *reputationsgewichtete Prüfung* oben). Eine nachgewiesene Fälschung wird ebenso öffentlich wie eine Zurückziehung protokolliert und führt zu einem erneuten Audit der gesamten verifizierten Historie des Mitwirkenden; dieselben Regeln gelten für die eigenen Runs der Maintainer.

**Streitigkeiten.** Eröffnen Sie ein Issue mit der Run-ID und der spezifischen Behauptung (falscher Score, falscher Datensatz, Regel falsch angewendet). Die Maintainer führen die deterministischen Prüfungen öffentlich neu aus; das Ergebnis und seine Beweise landen im Issue. Wenn es bei der Streitigkeit um die Daten oder die Validierung einer Community geht, entscheidet die eigene Autorität der Community und das Board setzt ihre Entscheidung um. Für Preiswettbewerbe gelten dieselben Regeln plus die vorab veröffentlichten Qualifikations- und Audit-Schritte des Wettbewerbs — Gewinner werden **vor** der Auszahlung geprüft, und eine Disqualifikation zitiert die Regel genau wie jedes andere Delisting.

## Zukünftige Ausrichtungen

- **Umfassende Modellvergleichsdurchläufe** — systematische Evaluierung von Frontier-Modellen (GPT-4o, Claude, Gemini usw.) über champollion-Sprachen hinweg unter Verwendung benutzerdefinierter Evaluierungskorpora (keine öffentlichen Benchmarks)
- **Mehr Sprachpaare** — Quechua, Inuktitut und andere ressourcenarme Sprachen, sobald Community-verifizierte Datensätze verfügbar werden
- **Datensatzimport** — Werkzeuge zur Konvertierung externer Evaluierungsdatensätze (WMT, Tatoeba usw.) in das champollion-Evaluierungsformat
- **Automatisierte Wiederholungsdurchläufe** — Erkennung von Modellversionsänderungen und erneutes Ausführen von Benchmarks zur Verfolgung der Wertedrift

---

## Siehe auch

- **[Method Leaderboard](https://champollion.dev/leaderboard)** — Live-Werte und Einreichungen
- **[Eval Harness](/docs/network/specifications/harness)** — wie man Evaluierungen ausführt
- **[Evaluation Datasets](/docs/network/leaderboard/datasets)** — Datensatzformat und verfügbare Datensätze
- **[Building a Method](/docs/network/specifications/methods)** — die Spezifikation der Methodenschnittstelle
- **[Run Card Specification](/docs/network/specifications/run-card)** — das JSON-Schema der Run-Karte
- **[Benchmark Specification](/docs/network/specifications/benchmark)** — Evaluierungsprotokoll, Korpusformat, Souveränität
- **[Scoring Specification](/docs/network/specifications/scoring)** — SSOT für Metriken, Gesamtgewichtungen und Qualitätsstufen
