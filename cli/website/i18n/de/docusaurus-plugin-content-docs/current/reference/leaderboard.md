---
title: "Bestenliste und Veröffentlichung"
slug: /reference/leaderboard
description: "Was die öffentliche Bestenliste ist, die zwei Arten von Benchmarks (öffentlich und versiegelt), was sie abdeckt und was nicht, und was genau ein veröffentlichter Durchlauf beinhaltet."
---

# Bestenliste und Veröffentlichung

Die [Bestenliste](/leaderboard) ist ein öffentliches Verzeichnis bewerteter Übersetzungsläufe.
Jede Person kann dazu beitragen: Sie führen die Evaluierungsumgebung (`mt-eval`) auf Ihrem eigenen
Rechner für einen registrierten Datensatz aus und veröffentlichen das Ergebnis als **Laufkarte**.
Die Bestenliste speichert die Karte; sie führt Ihre Methode nicht für Sie aus. Sie
enthält satzweisen Text nur für offen lizenzierte, frei weiterverteilbare Datensätze –
niemals für nichtkommerzielle, eingeschränkte, versiegelte, unter Quarantäne gestellte oder rein lokale Datensätze
und niemals, wenn Sie mit `--scores-only` veröffentlichen.

Sie ist ein Messprotokoll, kein Urteil über ein Übersetzungssystem. Eine Platzierung darauf
gibt an, wie eine Methode bei einem Datensatz unter einer bestimmten Metrik abgeschnitten hat. Sie besagt nicht,
dass die Übersetzung gut ist, und sie erteilt niemandem die Erlaubnis, eine Methode für die
Sprache einer Gemeinschaft einzusetzen.

## Drei Dinge, klar getrennt

| | Was es ist | Wo es ausgeführt wird |
|---|---|---|
| **Die Evaluierungsumgebung** ([`mt-eval`](/docs/network/specifications/harness)) | Das Bewertungswerkzeug. Aus einer Methode und einem Testdatensatz erzeugt sie eine Punktzahl und eine Laufkarte | Ihr Rechner |
| **Die Bestenliste** | Das Portal für Einreichungen und das Verzeichnis der Laufkarten, indexiert nach Datensatz und Sprachpaarrichtung | champollion.dev |
| **Die Netzwerkkarte** | Was die veröffentlichten Läufe in der Summe ergeben: welche Paare gemessen wurden und welche nicht | Eine Ansicht des Verzeichnisses, keine eigene Komponente |

Nichts gelangt in die Karte außer über die Bestenliste, und nichts gelangt in die Bestenliste
außer als bewerteter, mit einem digitalen Fingerabdruck versehener Lauf. Eine Messung ohne Herkunftsnachweis
kann nicht Teil davon werden.

## Zwei Arten von Benchmarks

**Öffentliche Benchmarks** verwenden offene Datensätze. Jeder Datensatz ist als
Metadatenkarte mit einem Zeiger zum Abruf von der Quelle registriert: Die Evaluierungsumgebung lädt die
Referenzen zur Laufzeit vom Upstream-Speicherort herunter, gleicht sie mit einem festgelegten SHA-256-Hash ab
und bewertet anhand der abgerufenen Daten. Öffentliche Daten können bereits in den Trainingsdaten eines Modells
enthalten sein, daher tragen Datensätze eine Kontaminationsstufe. Ein Datensatz mit der Einstufung `HIGH`
oder `MEDIUM` (FLORES+ ist `HIGH`) oder ganz ohne Einstufung ist **nur relativ**:
Er eignet sich zum Vergleich von Methoden, die darauf ausgeführt wurden, darf jedoch niemals als absolute Qualität ausgewiesen werden.
Nur ein Datensatz mit der Einstufung `LOW` ermöglicht eine Rangfolge nach absoluter Qualität. Ein unter Quarantäne gestellter Datensatz
wird niemals in der Rangfolge geführt: Die Datenbank weist jede dafür eingereichte Punktzahl zurück.
Die registrierten Datensätze und ihre Lizenzpfade sind unter
[Evaluierungsdatensätze](/docs/network/leaderboard/datasets) aufgeführt.

**Versiegelte Benchmarks** sind zurückgehaltene Testdatensätze, die die gastgebende Stelle auf ihrem eigenen
Rechner verwahrt. Einreichende bekommen sie nie zu Gesicht. Ein Beitrag ist ein Modell oder eine Methode, die
der eigene Bewertungsknoten des Gastgebers für den versiegelten Datensatz ausführt; nach außen gelangen nur Punktzahlen, und
jeder versiegelte Lauf erfordert die Autorisierung des Gastgebers. Die Schlüssel der Datensätze befinden sich derzeit
in den Händen der Ausrichter. Schlüsseltreuhänder aus den Gemeinschaften – bisher sind keine ernannt;
Champollion hält keine Schlüsselanteile. Preise gibt es nur bei versiegelten Wettbewerben zu
Bedingungen, die der Gastgeber vor jeglicher Teilnahme bekanntgibt. Wie Sie einen solchen Wettbewerb ausrichten:
[Einen souveränen Wettbewerb veranstalten](/docs/network/sovereignty/run-a-sovereign-contest).

## Geltungsbereich

- **Geschriebener Text.** Die Bestenliste misst die Übersetzung von geschriebenem Text: Dokumente,
  Bildungsmaterialien, behördliche Unterlagen, Benutzeroberflächen-Texte. Sie misst weder gesprochene Sprache
  noch Simultanverdolmetschung oder freie Unterhaltungen.
- **Textbasierte Sprachen.** Maschinelle Übersetzung für Gebärdensprachen ist ein anderes
  Problem; Gebärdensprach-Einträge im Index weisen den Vermerk „noch nicht unterstützt“ auf
  ([Was als Sprache zählt](/docs/network/context/what-counts-as-a-language)).
- **Ein Datensatz nach dem anderen.** Eine Punktzahl ist nur mit Punktzahlen für dieselbe
  Datensatzversion vergleichbar. Platzierungen werden niemals über Datensätze oder Sprachen hinweg verglichen.
- **Methoden, keine Sätze.** Eine Punktzahl beschreibt eine Methode auf einem Benchmark. Es wird keine
  Konfidenz auf Satzebene für irgendeine Übersetzung veröffentlicht
  ([Technische Grenzen](/docs/network/honest-limitations#system-vs-output)).

## Was ein veröffentlichter Lauf beinhaltet

Jede neue Karte wird nach **scoring standard/1** bewertet
([Bewertungsspezifikation](/docs/network/specifications/scoring)):

- **Der Hauptwert:** chrF++ auf Korpusebene (0–100) mit seinem 95%-Bootstrap-Konfidenzintervall
  und seiner sacreBLEU-Signatur, damit jede Person ihn nachberechnen kann.
- **Daneben:** BLEU, spBLEU und TER sowie COMET, sofern berechnet. Sie werden
  dargestellt, fließen jedoch niemals in den Hauptwert ein.
- **Getrennt davon:** Diagnosen wie FST-Akzeptanz und exakte Übereinstimmung, sofern entsprechende
  Werkzeuge existieren. Sie fließen niemals in den Hauptwert ein und bestimmen keine Rangfolge.
- **Eingestellte Felder:** `composite`, `quality_tier` und `cost_adjusted` sind
  auf jeder neuen Karte `null`. Eine alte Karte behält ihren gespeicherten Gesamtwert, ausgewiesen als
  „legacy composite (retired)“. Kein automatischer Wert trägt ein Qualitätsurteil.
- **Herkunftsnachweis:** die Datensatz-ID und ihr SHA-256-Hash, der genaue Modell-Slug, die
  Bedingung, die Vorgabe an das Modell (der SHA-256-Hash des Prompts und dessen Text,
  sofern Sie ihn nicht schwärzen), die Kosten, die Version der Evaluierungsumgebung und ein digitaler Fingerabdruck über
  die Konfiguration. Identische Läufe werden bei der Veröffentlichung dedupliziert, und eine unabhängige
  Replikation zählt als Bestätigung.
- **Vertrauensstufe:** Jede Zeile trifft als *selbst evaluiert* ein. *Champollion-verifiziert*
  bedeutet, dass die Punktzahl aus Ihren eingereichten Ausgaben anhand der
  festgelegten Referenzen neu ermittelt wurde; dieses Neuberechnungswerkzeug ist ein manuell ausgeführter Befehl der Betreuenden, sodass
  derzeit keine Zeile bei Eingang hochgestuft wird. *Gemeinschaftlich validiert* wird ausschließlich
  durch eine Überprüfung durch die Gemeinschaft selbst vergeben ([Verifizierungsstufen](/docs/network/leaderboard/rules#verification-tiers)).

Das vollständige Schema finden Sie in der [Laufkarten-Spezifikation](/docs/network/specifications/run-card).

## Veröffentlichung

```bash
# See exactly what would be uploaded (no sign-in, no network)
mt-eval publish eval/logs/harness/<run-id>_report.json --dry-run

# Publish to the live board (a browser sign-in the first time)
mt-eval publish eval/logs/harness/<run-id>_report.json --prod
```

- `--prod` (oder `MT_EVAL_ALLOW_PROD=1`) ist für einen Schreibvorgang auf die Live-Bestenliste
  erforderlich; andernfalls verweigert die Evaluierungsumgebung die Ausführung.
- `--anonymous` veröffentlicht ohne Anmeldung; die Bestenliste zeigt „anonymous“ an.
- `--scores-only` veröffentlicht aggregierte Punktzahlen sowie Hash und Größe des Datensatzes,
  niemals jedoch den Ausgangs- oder Referenztext – gedacht für eigene oder private Korpora.
- `--redact-coaching` ersetzt den Prompt-Text durch einen Platzhalter und behält dessen
  Hash bei. Bei einem rein lokalen Korpus wird ein angeleiteter Prompt standardmäßig geschwärzt.

Die Schritt-für-Schritt-Anleitung finden Sie unter [Eine Methode einreichen](/docs/network/getting-started/submit-a-method).

## Die Regeln, die überall gelten

- **Niemals mit Evaluierungsdaten trainieren.** Eine Methode, die mit einem Benchmark-Datensatz in Berührung gekommen ist – als
  Trainingsdaten, Few-Shot-Beispiele, Wörterbucheinträge oder Prompt-Material –, wird
  disqualifiziert ([Einreichungsregeln](/docs/network/leaderboard/rules)).
- **Was besser ist, entscheidet ein Signifikanztest, nicht zwei Zahlen.** Ob ein Lauf einen
  anderen schlägt, entscheidet ein gepaarter Signifikanztest auf Basis von chrF++; benachbarte Einträge, die der Test nicht
  voneinander trennen kann, teilen sich einen Rang ([Signifikanz](/docs/network/specifications/significance)).
- **Korpora werden hier nicht gehostet.** Die Registrierung betrifft Metadaten; Korpora werden
  von ihrer Quelle abgerufen. Ein veröffentlichter Lauf eines offen lizenzierten Datensatzes darf
  dessen satzweisen Text enthalten (siehe oben).
- **Lizenzpfade sind strukturell.** Nichtkommerzielle Korpora bleiben von
  jedem Preis, jeder API und jedem kommerziellen Pfad ausgeschlossen. Ein Korpus unter einer modifizierten, maßgeschneiderten oder
  nicht genannten Lizenz (`LicenseRef-*`) verweigert die Evaluierung über Remote-Modell-APIs, bis
  die Zustimmung des Rechteinhabers auf dessen Karte verzeichnet ist; standardmäßige nichtkommerzielle
  Lizenzen werden nur über Kanäle ohne Trainingsnutzung an Remote-Modelle gesendet; versiegelte Segmente
  werden niemals an externe Systeme übertragen. Die Plains-Cree-Datensätze von EdTeKLA sind als unter Quarantäne stehend
  katalogisiert, und die Datenbank weist jede dafür eingereichte Punktzahl zurück.

## Was heute bereits aktiv ist

- Die Bestenliste ist online, öffentlich und für Einreichungen geöffnet. Ihre Inhalte sind Live-Daten,
  daher werden sie auf dieser Seite nicht beschrieben – [sehen Sie sich die Bestenliste an](/leaderboard).
- Jede Zeile ist derzeit selbst evaluiert (siehe Vertrauensstufen oben).
- Es ist kein Preis ausgeschrieben und keine Punktzahl hat eine Preishürde genommen
  ([Preisspezifikation](/docs/network/specifications/prizes)).
- Es wurde noch keine Überprüfung durch Sprechende der Gemeinschaften durchgeführt
  ([Validierung durch Sprechende](/docs/network/specifications/speaker-validation)).
- Es wurde noch keine Methode im Rahmen der Bedingungen eines Wettbewerbs an eine Gemeinschaft übergeben.

[Technische Grenzen](/docs/network/honest-limitations) enthält die vollständige Aufzählung dessen,
was nicht beansprucht wird; weichen diese Seite und jene voneinander ab, gilt jene.

## Siehe auch

- [Einreichungsregeln](/docs/network/leaderboard/rules) – was zugelassen ist,
  Disqualifikation, Verifizierung und Reputation.
- [Evaluierungsdatensätze](/docs/network/leaderboard/datasets) – das Register und
  seine Lizenzpfade.
- [Eine Methode einreichen](/docs/network/getting-started/submit-a-method) und die
  [FAQ](/docs/network/getting-started/faq).
- [Bewertung](/docs/network/specifications/scoring),
  [Signifikanz](/docs/network/specifications/significance) und die
  [Laufkarte](/docs/network/specifications/run-card).
- [Rechenleistung beisteuern](/docs/network/getting-started/contributing-compute) –
  Elemente aus der öffentlichen Warteschlange mit Ihrem eigenen Schlüssel ausführen.
