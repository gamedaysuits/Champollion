---
sidebar_position: 8
title: "Preisspezifikation"
slug: '/network/specifications/prizes'
related:
  - label: "Run a Sovereign Contest"
    to: /docs/network/sovereignty/run-a-sovereign-contest
    kind: guide
    note: "The self-serve path to running your own prize"
  - label: "How Speakers Get Paid"
    to: /docs/network/perspectives/how-speakers-get-paid
    kind: position
    note: "The plain-language version of these numbers"
  - label: "The Economic Model"
    to: /docs/network/sovereignty/economic-model
    kind: doc
  - label: "MT Evaluation Rules"
    to: /docs/network/leaderboard/rules
    kind: doc
  - label: "Submit a Method"
    to: /docs/network/getting-started/submit-a-method
    kind: guide
---

# Preisspezifikation

Ein Preis ist die Anreiz-Hälfte der „Eval-First“-Vereinbarung. Eine Gemeinschaft oder Forschungsgruppe kuratiert ein kleines, versiegeltes Evaluierungsset — ein paar hundert Paare, jedes einzelne geprüft ([Corpus Partnership](/docs/network/specifications/corpus-partnership) ist dieser Arbeitsablauf). Ein Sponsor lobt einen Preis für das Erreichen einer Zielpunktzahl auf diesem Set aus. Ab diesem Moment ist die Sprache eine dauerhafte Herausforderung: Jeder Methodenentwickler weltweit kann sich daran versuchen, die Rangliste misst jeden Versuch öffentlich, und die Messlatte wird durch den eigenen Lösungsschlüssel der Gemeinschaft festgelegt, anstatt durch denjenigen, der am lautesten schreit. Dieses Dokument spezifiziert, wie ein solcher Preis funktioniert — Schwellenbedingungen, Anspruchsprozess, Abhängigkeitsklassen und Regeln —, damit die Messlatte eindeutig und methodenunabhängig ist, wenn ein Preis eröffnet wird.

Preise sind **vom Sponsor finanziert und werden vom Sponsor verwaltet**: Das Geld verbleibt bei der sponsernden Organisation oder bei einem vom Sponsor benannten Gemeinschaftstreuhandfonds — **Champollion hält niemals Preisgelder, verwahrt sie nicht treuhänderisch und leitet sie nicht weiter.** Jede Gemeinschaft oder Organisation kann über den Self-Service-Weg unter [Run a Sovereign Contest](/docs/network/sovereignty/run-a-sovereign-contest) einen eigenen Wettbewerb durchführen und dabei ihren eigenen Korpus und ihr eigenes Geld verwalten.

> **Status: VORGESCHLAGEN — es ist kein Preis eröffnet, und hier kann noch nichts beansprucht werden.**
> Was die *Eröffnung* eines Preises bedingt, ist die Messseite: ein
> von der Gemeinschaft gebilligter Goldstandard-Korpus, die isolierte (air-gapped) Evaluierungs-Sandbox
> (spezifiziert, aber noch nicht gebaut) und die Überprüfungsinstanz durch Sprecher. Keine Punktzahl
> auf dieser Website hat bisher die Hürde für einen Preis genommen. Siehe
> [Honest Limitations](/docs/network/honest-limitations). Metrik-Referenz:
> die [Scoring Spec](/docs/network/specifications/scoring); Protokoll:
> die [Benchmark Spec](/docs/network/specifications/benchmark).

---

## Möchten Sie helfen, eine Sprache in das Netzwerk aufzunehmen?

Sie müssen nicht auf einen Preis warten. Die wirkungsvollsten Dinge, die Sie heute tun können:

- **Sponsern Sie einen MT-Errungenschaftspreis.** Finanzieren Sie eine gezielte Messlatte — zum Beispiel eine
  zuverlässige Methode für Englisch → Plains Cree. Champollion koordiniert die
  Messung; die Mittel bleiben bei **Ihnen** (Ihrer Organisation oder einem von Ihnen benannten
  Gemeinschaftsfonds) und werden zu den Bedingungen der Gemeinschaft vergeben (siehe
  [Datensouveränität](/docs/network/sovereignty/data-sovereignty)
  und das [Wirtschaftsmodell](/docs/network/sovereignty/economic-model)). Der
  durchgängige Selbstbedienungsweg ist in
  [Einen souveränen Wettbewerb durchführen](/docs/network/sovereignty/run-a-sovereign-contest) dokumentiert;
  die Aufnahme eines neuen Sprachpaares beginnt mit einer
  [Korpus-Partnerschaft](/docs/network/specifications/corpus-partnership).
- **Koordinieren Sie eine Rechenleistungsspende.** Bündeln Sie API-Guthaben / Token, damit die öffentliche
  Warteschlange mehr Paare kartieren und aufzeigen kann, wo Übersetzung bereits — und wo noch nicht —
  zuverlässig ist.
- **Unterstützen Sie die Open-Source-Initiativen, auf denen wir aufbauen — *direkt*.** Champollion
  ist eine Infrastruktur, die die offene Arbeit anderer Menschen zusammenfügt; *sie* zu unterstützen,
  bedeutet, diese Karte zu unterstützen (wir verweisen Sie lieber an die Ursprünge, als uns die
  Anerkennung für ihre Arbeit zuzuschreiben):
  - [Tatoeba](https://tatoeba.org) — von der Gemeinschaft beigetragene Parallelsätze
  - [Endangered Languages Catalog (ELCat)](https://www.endangeredlanguages.com) — Daten zur Gefährdung
  - [Glottolog](https://glottolog.org) · [WALS](https://wals.info) · [Grambank](https://grambank.clld.org) · [PHOIBLE](https://phoible.org) — Sprachkataloge & Typologie
  - [GiellaLT](https://giellalt.uit.no) / ALTLab — die morphologischen Transduktoren (FSTs)
  - [Masakhane](https://www.masakhane.io) — MT-Gemeinschaft für afrikanische Sprachen
  - [OPUS](https://opus.nlpl.eu) — offene Parallelkorpora

> Um einen Preis zu sponsern, eine Rechenleistungsspende zu organisieren oder eine Partnerschaft zu besprechen,
> erreichen Sie das Projekt über [GitHub](https://github.com/gamedaysuits). Verwahrer der
> Gemeinschaftsschlüssel werden derzeit bestätigt; keine Nation und keine Organisation wird als Partner
> benannt, bevor sie zugestimmt hat.

---

## 1. Philosophie

> **Die Abmachung in einem Satz: eine Sprache knacken, gewinnen, zurückgeben.** Champollion ist bewusst ein
> Betrieb für ML-Benchmarking — Wettbewerb ist die Art, wie schwierige Paare gelöst werden.
> Wir laden ML-Forscher und jeden fähigen Entwickler ein, die beste Methode für ein
> bestimmtes schwieriges Sprachpaar zu entwickeln, den Preis zu gewinnen **und** die resultierende Methode an die
> Souveränitätsorganisation zu übergeben, der diese Sprache gehört (§1.3). Die Wettbewerbs-
> energie ist real, und sie ist auf die Mission gerichtet — jede Sprache
> übersetzbar zu machen, zu den Bedingungen, die ihre Menschen festlegen — nicht darauf, um seiner selbst
> willen eine Rangliste zu erklimmen.

### 1.1 Preise belohnen Durchbrüche, nicht Teilnahme

Preisgeld wird nur ausgeschüttet, wenn eine Methode nachweislich eine definierte Fähigkeitsschwelle erreicht. Es gibt keine Teilnahmepreise, keine Auszeichnungen für Zweitplatzierte und keine Trostpreise. Wenn niemand die Messlatte erreicht, wird niemand bezahlt. Dies ist beabsichtigt — es bedeutet, dass Sponsoren nur für Ergebnisse zahlen, die tatsächlich funktionieren.

### 1.2 Gemeinschaftsvalidierung ist unverhandelbar

Automatisierte Metriken sind Näherungswerte (SCORING_SPEC §1.1). Eine Methode kann bei chrF++ und FST-Akzeptanz gut abschneiden und dabei eine Ausgabe erzeugen, die kein Sprecher akzeptieren würde. **Jeder Preisantrag erfordert Gemeinschaftsvalidierung** — zweisprachige Sprecher müssen bestätigen, dass die Ausgabe verwendbar ist. Dies ist das Tor der menschlichen Validierung (BENCHMARK_SPEC §7).

### 1.3 Die Eigentumsübertragung ist Teil der Abmachung

Methoden, die einen Preis beanspruchen, unterliegen der Klausel zur Eigentumsübertragung (BENCHMARK_SPEC §8.3). Der Entwickler behält Namensnennungs- und Veröffentlichungsrechte. Die Governance-Organisation erhält das Recht, die Methode für ihre Sprache zu nutzen, zu modifizieren, zu verbreiten und zu monetarisieren. Dies ist keine Strafe — es ist der Sinn der Sache. Preisgeld finanziert die Entwicklung von Technologie, die der Sprachgemeinschaft gehört.

### 1.4 Manipulationsschutz

Preisschwellen werden gegen eine **Goldstandard-Evaluierung** definiert (geheimer Testsatz, ausgeführt von der Governance-Organisation in der Sandbox). Entwickler sehen die Testdaten niemals. Dies wird architektonisch durchgesetzt — es ist keine Richtlinie, die auf Ehre beruht. Siehe BENCHMARK_SPEC §8.2.

### 1.5 Korpuslizenzierung: Nicht-kommerzielle Korpora bleiben aus der Preisspur heraus

Einige Korpora, die während der Methodenentwicklung verwendet werden, unterliegen nicht-kommerziellen Lizenzen — zum Beispiel unterliegt der Korpus des EdTeKLA Cree Language Textbook der **modifizierten CC BY-NC-SA von EdTeKLA** (souveränitätsbezogen, nicht-kommerziell; das zugrundeliegende Lehrbuch ist CC BY-NC-ND 4.0). Diese Korpora sind **ausschließlich für den Forschungs-/Entwicklungsbereich bestimmt**:

1. **Preis-Goldstandard-Korpora dürfen keine NC-lizenzierten Korpusinhalte einbetten.** Goldstandard-Testsegmente sind von der Gemeinschaft in Auftrag gegebene Originale (siehe Korpus-Partnerschaftsstrategie) — von Menschen für den Preis verfasst, mit von Anfang an geklärten Rechten für Evaluierung und kommerziellen Einsatz.
2. **Eine Methode, die einen Preis beansprucht, darf keine NC-lizenzierten Korpusinhalte einbetten** (z. B. als Coaching-Daten, eingebettete Beispiele oder Nachschlagetabellen). Die übertragene Methode muss von der Governance-Organisation zu beliebigen Bedingungen einsetzbar sein — einschließlich kommerziell, wenn die Gemeinschaft dies so entscheidet (BENCHMARK_SPEC §8.3); NC-lizenzierte Inhalte darin würden diese Freiheit vergiften.
3. **Entwickler dürfen NC-lizenzierte Korpora frei zur Entwicklung und Selbstevaluierung nutzen** — genau dafür ist die Entwicklungsspur da. Die Einschränkung gilt für das, was eingereicht und was eingesetzt wird, nicht dafür, wie ein Entwickler lernt.

### 1.6 Abhängigkeitsklassen steuern die Preisberechtigung

Alle Preis-Evaluierungen finden in einer Sandbox statt (§1.4), und preisgekrönte Methoden werden an die Governance-Organisation übertragen (§1.3). Beide Tatsachen erlegen dieselbe Einschränkung auf: **Alles, wovon eine Methode abhängt, muss etwas sein, das der Entwickler das Recht hat, in die Sandbox einzubringen und der Gemeinschaft zu übermitteln.** Jede Einreichung deklariert eine Abhängigkeitsklasse — definiert in der [Method Interface-Spezifikation](/docs/network/specifications/methods#method-validity-and-dependency-classes) — und die Berechtigung richtet sich nach der Klasse:

| Abhängigkeitsklasse | Preisberechtigt? | Bedingungen |
|------------------|----------------|------------|
| **S** — eigenständig | ✅ Ja | Keine über die Schwellenbedingungen in §2 hinaus |
| **O** — offen extern (z. B. AGPL-FST, bei Einreichung gespiegelt) | ✅ Ja | Artefakte fixiert und in die Einreichung eingebettet; Lizenzen erlauben die Übertragung an die Gemeinschaft; Copyleft-Bedingungen bewahrt (die Gemeinschaft erhält dieselben Rechte, die die Lizenz allen gewährt) |
| **A1** — austauschbare LLM-Inferenz | ⚠️ Bedingt | Modell deklariert, fixiert und austauschbar (muss gegen ein von der Gemeinschaft gehostetes Open-Weight-Modell laufen); Evaluierung über das Sandbox-LLM-Gateway geleitet (🔲 geplant — A1-Methoden können keine Goldstandard-Werte erzeugen, bis das Gateway betriebsbereit ist); die Übertragung vermittelt das vollständige Rezept (Prompts, Coaching, Code), nicht das Modell |
| **A2** — nicht-austauschbare externe Daten-/Dienst-API | ❌ Noch nicht | Nicht berechtigt, bis der Rechteinhaber die Erlaubnis zur Sandbox-Einbindung und Übertragung erteilt. Auf der offenen Rangliste mit einem sichtbaren „Externe Abhängigkeit"-Kennzeichen erlaubt |
| **X** — gebündelte Inhalte ohne Rechte | ❌ Niemals | In jeder Spur unzulässig |

Die Klasse einer Methode ist die restriktivste Klasse unter ihren deklarierten Abhängigkeiten. Nicht deklarierte Abhängigkeiten jeglicher Klasse führen zur Disqualifikation (§5).

---

## 2. Vorgeschlagene Preispools (noch keiner eröffnet)

### 2.1 Der Gründerpreis — EN→Plains Cree (nêhiyawêwin)

| Feld | Wert |
|-------|-------|
| **Preispool** | **10.000 CAD** (vorgeschlagen) |
| **Sprachpaar** | Englisch → Plains Cree (EN→CRK) |
| **Vorgesehener Sponsor** | Gründer des Champollion-Projekts — eine beabsichtigte Zusage, **es werden bisher nirgendwo Mittel gehalten.** Wenn zugesagt, würden die Mittel beim Sponsor oder einem benannten Gemeinschaftsfonds liegen — niemals bei Champollion. |
| **Status** | **VORGESCHLAGEN — nicht eröffnet.** Es werden keine Einreichungen angenommen. |
| **Eröffnung** | Nur wenn der Goldstandard-Korpus, die Evaluierungs-Sandbox und das Sprecher-Prüfungstor allesamt existieren (keines davon bisher) und die Mittel des Sponsors gemäß §4.2 nachweislich gehalten werden. |
| **Ablauf** | Kein Ablauf nach der Eröffnung. |

#### Schwellenbedingungen

Eine Methode beansprucht den Gründerpreis, indem sie **ALLE** folgenden Bedingungen gleichzeitig erfüllt:

| # | Bedingung | Metrik | Schwelle | Begründung |
|---|-----------|--------|-----------|-----------|
| 1 | **Zusammengesetzter Wert** | `composite` (SCORING_SPEC §4) | **≥ 0,80** | Zwischen Einsatzfähig (0,70) und Flüssig (0,85). Erfordert hohe Qualität über alle Metrikdimensionen hinweg — nicht nur morphologische Gültigkeit. |
| 2 | **FST-Akzeptanz** | `fst_acceptance_rate` (SCORING_SPEC §2.2) | **≥ 0,99 (99 %+)** | Praktisch alle Ausgabewörter müssen morphologisch gültige Formen sein, die vom GiellaLT-FST erkannt werden. Die Toleranz von 1 % berücksichtigt Grenzfälle (Eigennamen, Neologismen, Lehnwörter), die der FST berechtigterweise möglicherweise nicht abdeckt. Dies ist das entscheidende Qualitätstor für polysynthetische MT — wenn der FST mehr als 1 % der Wörter ablehnt, erzeugt die Methode Formen, die in der Sprache nicht existieren. Der gesamte Sinn dieses Preises ist es, ein System zu erwerben, das die Dinge nicht verstümmelt. |
| 3 | **chrF++** | `chrf_plus_plus` (SCORING_SPEC §2.1) | **≥ 55,0** | Die Zeichen-n-Gramm-Überlappung muss auf der Skala von 0–100 über 55 liegen. Stellt eine oberflächliche Ähnlichkeit mit Referenzübersetzungen sicher, nicht nur morphologische Gültigkeit. |
| 4 | **Gemeinschaftsvalidierung** | Menschliche Prüfung (BENCHMARK_SPEC §7) | **≥ 70 % „akzeptabel" oder „ausgezeichnet"** | Eine stratifizierte Stichprobe von Ausgaben (≥30 Einträge über die Schwierigkeitsstufen 2–5) wird von ≥2 zweisprachigen CRK-Sprechern geprüft. Mindestens 70 % der geprüften Einträge müssen eine Bewertung „akzeptabel" oder „ausgezeichnet" erhalten. |
| 5 | **Goldstandard-Evaluierung** | Sandbox-Ausführung (BENCHMARK_SPEC §8.2) | **Erforderlich** | Alle automatisierten Metriken müssen gegen das Korpussegment `gold_standard` berechnet werden, ausgeführt von der Governance-Organisation in einer Sandbox-Umgebung. Werte des Entwicklungssatzes zählen nicht. |
| 6 | **Reproduzierbarkeit** | Fingerabdruck-Übereinstimmung (BENCHMARK_SPEC §3.8) | **±2 %** | Die Governance-Organisation muss in der Lage sein, die Methode erneut auszuführen und Werte innerhalb von ±2 % der eingereichten Run-Card zu erreichen. |

> **Warum 99+ % FST?** Das zentrale Problem bei der maschinellen Übersetzung für polysynthetische Sprachen ist die Halluzination — LLMs erzeugen Zeichenketten, die *wie* die Zielsprache *aussehen*, aber morphologisch ungültig sind. Eine Methode, die zu 95 % gültige Ausgabe erzeugt, hat immer noch 5 % erfundene Wörter — inakzeptables Rauschen für jeden Produktiveinsatz. Die Schwelle von 99 %+ verlangt nahezu keine Halluzination, lässt aber den seltenen Grenzfall zu (einen Eigennamen, den der FST nicht kennt, einen legitimen Neologismus). Wenn eine Methode keine FST-Akzeptanz von 99 %+ erreichen kann, hat sie das Problem nicht gelöst.
>
> **Warum ein zusammengesetzter Wert von 0,80?** Dieser liegt zwischen Einsatzfähig (0,70) und Flüssig (0,85). Eine Methode bei 0,80 mit einer FST-Akzeptanz von 99 %+ erzeugt eine Ausgabe, bei der praktisch jedes Wort ein echtes Cree-Wort ist *und* die Gesamtübersetzungsqualität über oberflächliche, strukturelle und semantische Dimensionen hinweg hoch ist. Das Gemeinschaftsvalidierungstor (Bedingung #4) stellt sicher, dass dies nicht bloß Metrikmanipulation ist — Sprecher müssen bestätigen, dass die Ausgabe wirklich verwendbar ist.

#### Was diese Schwelle in der Praxis bedeutet

Bei einem zusammengesetzten Wert ≥ 0,80 mit FST ≥ 0,99 und chrF++ ≥ 55 würde ein zweisprachiger Sprecher typischerweise Folgendes sehen:

- **Praktisch jedes** Ausgabewort ist ein echtes Cree-Wort (FST validiert 99 %+ — nahezu keine halluzinierten Formen)
- Die wichtigsten grammatischen Kategorien (Person, Numerus, Tempus) sind in den meisten Einträgen korrekt
- Die Wortstellung ist im Allgemeinen natürlich
- Die Bedeutung wird zuverlässig bewahrt
- Verbleibende Fehler sind Fehler der echten Sprache (falsche Flexion, unkorrekte Obviation, Animatheit-Unstimmigkeiten) — keine erfundenen Wörter
- Ein fließender Sprecher könnte die Ausgabe als hochwertigen Entwurf nutzen und deutlich schneller korrigieren, als von Grund auf zu übersetzen

Dies ist ein System, das **die Sprache nicht verstümmelt.** Es mag nicht perfekt sein, aber jedes Wort, das es erzeugt, ist ein echtes Wort. Das ist die Mindestmesslatte für respektvolle maschinelle Übersetzung einer polysynthetischen Sprache.

---

## 3. Preis-Antragsprozess

### 3.1 Einreichung

1. Der Entwickler reicht seine vollständige, ausführbare Methode bei der Governance-Organisation ein:
   - Sämtlichen Quellcode
   - Alle Abhängigkeiten (Coaching-Daten, Wörterbücher, FST-Konfigurationen, Prompts)
   - Installations- und Ausführungsanweisungen
   - Eine README, die den Ansatz der Methode beschreibt
   - Eine Run-Card des Entwicklungssatzes mit ungefähren Werten (zur Vorabprüfung)

2. Der Entwickler unterzeichnet die Teilnahmebedingungen, einschließlich:
   - Klausel zur Eigentumsübertragung (BENCHMARK_SPEC §8.3)
   - Erklärung, dass kein Training auf Evaluierungsdaten erfolgt ist
   - Verpflichtung zur Reproduzierbarkeit

### 3.2 Evaluierung

1. Die Governance-Organisation installiert und führt die Methode in einem Sandbox-Harness gegen das Korpus `gold_standard` aus
2. Automatisierte Metriken werden berechnet (zusammengesetzter Wert, FST, chrF++ usw.)
3. Wenn die automatisierten Schwellen erreicht werden (Bedingungen 1–3), fährt die Governance-Organisation mit der Gemeinschaftsprüfung fort
4. Wenn die automatisierten Schwellen NICHT erreicht werden, erhält der Entwickler Werte und Rückmeldungen. Es wird keine Gemeinschaftsprüfung ausgelöst.

### 3.3 Gemeinschaftsprüfung

1. Eine stratifizierte Stichprobe von Ausgaben (≥30 Einträge, die die Schwierigkeitsstufen 2–5 abdecken) wird zweisprachigen Sprechern vorgelegt
2. Mindestens 2 unabhängige Prüfer bewerten jeden Eintrag
3. Bewertungsskala: **ablehnen** / **Kernaussage** / **akzeptabel** / **ausgezeichnet**
4. Wenn ≥70 % der Einträge von beiden Prüfern „akzeptabel" oder „ausgezeichnet" erhalten, besteht die Gemeinschaftsvalidierung

### 3.4 Auszahlung

1. Alle 6 Bedingungen sind erfüllt
2. Die Governance-Organisation bestätigt das Ergebnis
3. Der Preis wird innerhalb von 30 Tagen nach der Bestätigung ausgezahlt
4. Das Eigentum an der Methode geht gemäß BENCHMARK_SPEC §8.3 über
5. Das Ergebnis wird auf der Rangliste mit der Verifizierungsstufe „Gemeinschaftsvalidiert" veröffentlicht

### 3.5 Mehrfacheinreichungen

- Derselbe Entwickler / dasselbe Team kann mehrfach einreichen
- Jede Einreichung wird unabhängig evaluiert
- Wenn eine Methode verbessert und erneut eingereicht wird, zählt nur die neueste Run-Card
- Der Preis wird an die **erste** Methode vergeben, die alle Schwellen erreicht — er wird nicht geteilt

### 3.6 Team-Einreichungen

- Teams und Ältesten-Jugend-Paare sind teilnahmeberechtigt
- Die Preisverteilung innerhalb eines Teams liegt in der Verantwortung des Teams
- Alle Teammitglieder müssen die Teilnahmebedingungen unterzeichnen
- Die Namensnennung auf der Rangliste führt alle Teammitglieder auf

---

## 4. Zukünftige Preispools {#4-future-prize-pools}

Der Gründerpreis ist der Ausgangspunkt. Zusätzliche Preispools werden von Sponsoren finanziert. Jeder neue Preispool wird als neuer Unterabschnitt von §2 mit eigenen Angaben dokumentiert:

- Preisbetrag und Währung
- Sprachpaar
- Sponsor-Nennung
- Schwellenbedingungen (die vom Gründerpreis abweichen können)
- Ablaufdatum (falls vorhanden)
- Etwaige Sonderbedingungen

### 4.1 Vorlage für Sponsorenpreise

Sponsoren finanzieren Preispools in beliebiger Höhe. Vorgeschlagene Stufen:

| Stufe | Betrag | Vorgeschlagene Schwelle |
|------|--------|---------------------|
| **Seed** | 5.000–15.000 $ | Einsatzfähig (zusammengesetzter Wert ≥ 0,70) + Gemeinschaftsvalidierung |
| **Durchbruch** | 25.000–50.000 $ | Flüssig (zusammengesetzter Wert ≥ 0,85) + Gemeinschaftsvalidierung |
| **Hauptpreis** | 100.000 $+ | Flüssig + Abdeckung mehrerer Register + Einsatzintegration |

Sponsoren können außerdem finanzieren:
- **Verbesserungsprämien** — feste Zahlung für jede Verbesserung von 5 Punkten bei chrF++ gegenüber dem aktuellen Bestwert
- **Registerpreise** — separate Auszeichnungen für bestimmte Register (formell, zeremoniell, edukativ)
- **Geschwindigkeitspreise** — bester kostenbereinigter Wert (SCORING_SPEC §6.3)

### 4.2 Wo Preisgelder gehalten werden

Preisgelder werden **vom Sponsor gehalten**: Sie liegen bei der sponsernden Organisation oder bei einem vom Sponsor benannten Gemeinschaftsfonds — **niemals bei Champollion**, das die Messung koordiniert und kein Geld berührt. Ein glaubwürdiger Preis veröffentlicht vor seiner Eröffnung: **wer die Mittel hält**, unter welcher Vereinbarung (Organisationskonto, Treuhandfonds oder Drittverwahrung nach Wahl des Sponsors) und die Vergabeschwelle — sodass das Erreichen der Messlatte anhand veröffentlichter Werte sowie des Sprecher-Validierungsurteils der Gemeinschaft überprüfbar ist und ein Zahlungsausfall öffentlich als solcher sichtbar wäre. Heute werden nirgendwo Preisgelder gehalten. Sollte ein Preis unbeansprucht ablaufen, bleiben die Mittel dort, wo sie immer waren — beim Sponsor —, um nach Ermessen des Sponsors umgeleitet oder abgezogen zu werden. Die Selbstbedienungsmechanik, einschließlich des Ausfallrisikos des Sponsors und dessen Minderungsmaßnahmen, ist in [Einen souveränen Wettbewerb durchführen](/docs/network/sovereignty/run-a-sovereign-contest) und den [Bedingungsvorlagen](/docs/network/sovereignty/terms-templates) dokumentiert.

---

## 5. Disqualifikation

Eine Einreichung wird disqualifiziert, wenn:

1. **Training auf Evaluierungsdaten.** Die Methode wurde `gold_standard`- oder `held_out`-Korpuseinträgen ausgesetzt. (Architektonisch durch Sandbox-Ausführung verhindert — aber wenn Beweise für eine Kontamination gefunden werden, wird das Ergebnis für ungültig erklärt.)
2. **Nicht reproduzierbar.** Die Governance-Organisation kann die Werte nicht innerhalb von ±2 % reproduzieren.
3. **Nicht deklarierte oder nicht berechtigte Abhängigkeiten.** Die Methode benötigt zur Laufzeit Zugriff auf externe Dienste über das hinaus, was ihr Abhängigkeitsmanifest deklariert, oder ihre effektive Abhängigkeitsklasse ist A2 oder X (§1.6). Deklarierte LLM-Inferenz der Klasse A1, die über das Evaluierungs-Gateway geleitet wird, ist erlaubt; jede andere Netzwerkabhängigkeit zur Laufzeit — und jede nicht deklarierte Abhängigkeit jeglicher Klasse — führt zur Disqualifikation.
4. **Teilnahmebedingungen nicht unterzeichnet.** Alle Teammitglieder müssen der Eigentumsübertragung zustimmen.
5. **Manipulation entdeckt.** Die Ausgabe ist für die Metrik optimiert statt für die Übersetzungsqualität (aufgedeckt durch Gemeinschaftsprüfung und/oder Manipulationsschutzprüfungen gemäß BENCHMARK_SPEC §9.3).

---

## 6. Beziehung zu anderen Spezifikationen

| Dieses Dokument | Verweist auf | Für |
|--------------|-----------|-----|
| §2 Schwellenbedingungen | SCORING_SPEC §4 (zusammengesetzter Wert), §2.1–2.2 (Metriken), §5 (Stufen) | Metrikdefinitionen und Skala |
| §2 Gemeinschaftsvalidierung | BENCHMARK_SPEC §7 | Protokoll der menschlichen Prüfung |
| §3 Sandbox-Ausführung | BENCHMARK_SPEC §8.2 | Souveränitätsmechanismus |
| §3 Eigentumsübertragung | BENCHMARK_SPEC §8.3 | Bedingungen der Rechteübertragung |
| §1.6 Abhängigkeitsklassen | Method Interface-Spezifikation; BENCHMARK_SPEC §8.6 | Klassendefinitionen, Zulässigkeitsbedingungen, Sandbox-Netzwerkrichtlinie |
| §4 kostenbereinigte Preise | SCORING_SPEC §6.3 | Kostenbereinigte Formel |

---

## 7. Code-Spezifikations-Synchronisation

### 7.1 Kanonische Quelle

Dieses Dokument (`cli/website/docs/network/specifications/prize-spec.md`) ist die kanonische Quelle für:
- Preispool-Definitionen (§2)
- Schwellenbedingungen (§2.x)
- Antragsprozess (§3)
- Disqualifikationsregeln (§5)

### 7.2 Implementierungsanforderungen

Wenn ein Preispool aktiviert wird:
1. Die Ranglisten-UI muss aktive Preise und ihre Schwellenbedingungen anzeigen
2. Run-Cards, die die automatisierten Schwellen erreichen (Bedingungen 1–3), müssen zur Gemeinschaftsprüfung gekennzeichnet werden
3. Das Feld `quality_tier` im Run-Card-Schema erfasst bereits die Stufe („deployable", „fluent")
4. Es sind keine neuen Codeänderungen am Harness erforderlich — die Preisspezifikation ist eine Richtlinienschicht über der bestehenden Bewertung

---

*Preisstrukturen müssen mit den Bedingungen der Eigentumsübertragung kompatibel sein. Der Gewinner kann den Preis beanspruchen, aber die Methode wird zum Eigentum der Governance-Organisation, wenn sie die Stufe Einsatzfähig erreicht. Dies ist beabsichtigt — der Preis finanziert die Entwicklung von Technologie, die der Sprachgemeinschaft gehört.*
