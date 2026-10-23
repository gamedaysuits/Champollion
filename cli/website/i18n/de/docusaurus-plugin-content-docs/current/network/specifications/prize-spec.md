---
sidebar_position: 8
title: "Preisspezifikation"
slug: '/network/specifications/prizes'
related:
  - label: "Run a Sovereign Contest"
    to: /docs/network/sovereignty/run-a-sovereign-contest
    kind: guide
    note: "The self-serve path to running your own prize"
  - label: "Working with speakers"
    to: /docs/working-with-speakers
    kind: position
  - label: "The Economic Model"
    to: /docs/getting-started/who-may-use-this
    kind: doc
  - label: "MT Evaluation Rules"
    to: /docs/network/leaderboard/rules
    kind: doc
  - label: "Submit a Method"
    to: /docs/network/getting-started/submit-a-method
    kind: guide
---

# Preisspezifikation

Ein Preis ist die Anreizseite der Eval-First-Vereinbarung. Eine Gemeinschaft oder
Forschungsgruppe kuratiert einen kleinen, versiegelten Evaluationsdatensatz – einige hundert Paare,
jedes einzelne geprüft ([Korpora registrieren](/docs/network/sovereignty/registering-corpora)
ist dieser Ablauf). Ein Sponsor lobt einen Preis für einen Zielwert auf diesem
Datensatz aus. Von diesem Moment an ist die Sprache eine ständige Herausforderung: Jeder
Entwickler von Methoden weltweit kann darauf abzielen, die Bestenliste misst jeden Versuch
öffentlich, und die Messlatte wird durch den eigenen Lösungsschlüssel der Gemeinschaft bestimmt
und nicht dadurch, wer am lautesten schreit. Dieses Dokument legt fest, wie ein solcher Preis
funktioniert – Schwellenwertbedingungen, Anspruchsverfahren, Abhängigkeitsklassen und Regeln –,
damit die Messlatte eindeutig und methodenunabhängig ist, sobald ein Wettbewerb eröffnet wird.

Preise werden **vom Sponsor finanziert und verwaltet**: Das Geld verbleibt bei
der sponsernden Organisation oder bei einem von ihr benannten Community-Trust –
**Champollion verwahrt, treuhändet oder leitet Preisgelder zu keinem Zeitpunkt weiter.**
Jede Gemeinschaft oder Organisation kann einen solchen Wettbewerb eigenständig über den
Self-Service-Pfad in [Run a Sovereign Contest](/docs/network/sovereignty/run-a-sovereign-contest)
durchführen und dabei ihren eigenen Korpus sowie ihre eigenen Gelder verwalten.

> **Status: VORGESCHLAGEN – derzeit ist kein Preis ausgeschrieben, und hier kann noch nichts beansprucht werden.**
> Was die *Eröffnung* eines Preises bedingt, ist die Messseite: ein
> mit Zustimmung der Gemeinschaft erstellter Goldstandard-Korpus und das
> Sprecherprüfungs-Gate. Beides existiert derzeit noch nicht. Die netzwerkisolierte
> Evaluations-Sandbox wird jedoch ausgeliefert – siehe
> [Benchmark Spec §8.6](/docs/network/specifications/benchmark#86-dependency-classes-and-the-sandbox-network-policy).
> Bisher hat kein Wert auf dieser Website eine Preishürde erreicht. Siehe
> [Honest Limitations](/docs/network/honest-limitations). Metriken-Referenz:
> die [Scoring Spec](/docs/network/specifications/scoring); Protokoll:
> die [Benchmark Spec](/docs/network/specifications/benchmark).

> **Die Zusicherungsebene ist aktiv.** Die Sperre, die deklarierte Preisbedingungen
> unveränderlich macht, sobald Einreichungen vorliegen, sowie zurückgehaltene
> (`hidden_until_close`) Ergebnisse werden seit dem 07.09.2026 auf dem netzwerkgehosteten
> Endpunkt direkt in der Datenbank durchgesetzt. Ein föderierter Host erhält dieselben
> Regeln durch Anwenden der Migration, die mit der Prüfumgebung ausgeliefert wird; bei
> einem älteren Endpunkt fällt die Prüfumgebung auf das Basisset zurück und weist explizit
> darauf hin, anstatt etwas vorzutäuschen. Die Nur-Aggregate-Egress-Regel in §3.2 wurde
> schon immer überall durchgesetzt.

---

## Möchten Sie helfen, eine Sprache in das Netzwerk aufzunehmen?

Sie müssen nicht auf einen Preis warten. Die wirkungsvollsten Dinge, die Sie heute tun können:

- **Sponsern Sie einen MT-Leistungspreis.** Finanzieren Sie eine gezielte Messlatte – zum Beispiel eine
  zuverlässige Methode für Englisch → Plains Cree. Champollion koordiniert die
  Messung; die Gelder verbleiben bei **Ihnen** (Ihrer Organisation oder einem von Ihnen benannten
  Treuhandfonds der Gemeinschaft) und werden nach den Bedingungen der Gemeinschaft vergeben (siehe
  [Ihre Worte, Ihre Regeln](/docs/your-words-your-rules)
  und [Wer es nutzen darf und was es kostet](/docs/getting-started/who-may-use-this)). Der
  durchgängige Self-Service-Pfad ist in
  [Einen souveränen Wettbewerb durchführen](/docs/network/sovereignty/run-a-sovereign-contest) dokumentiert;
  das Einbringen eines neuen Sprachpaars beginnt mit
  [Korpora registrieren](/docs/network/sovereignty/registering-corpora).
- **Koordinieren Sie eine Rechenleistungsspende.** Bündeln Sie API-Guthaben / Tokens, damit die öffentliche
  Warteschlange mehr Paare abbilden und aufzeigen kann, wo Übersetzungen bereits
  zuverlässig sind – und wo noch nicht.
- **Unterstützen Sie die Open-Source-Initiativen, auf denen wir aufbauen – *direkt*.** Champollion
  ist die Infrastruktur, die die offene Arbeit anderer zusammenfügt; *sie* zu unterstützen
  bedeutet, diese Übersicht zu unterstützen (wir verweisen Sie lieber nach Upstream, als uns
  ihre Arbeit zuzuschreiben):
  - [Tatoeba](https://tatoeba.org) – von der Community beigesteuerte Parallelsätze
  - [Endangered Languages Catalog (ELCat)](https://www.endangeredlanguages.com) – Gefährdungsdaten
  - [Glottolog](https://glottolog.org) · [WALS](https://wals.info) · [Grambank](https://grambank.clld.org) · [PHOIBLE](https://phoible.org) – Sprachkataloge & Typologie
  - [GiellaLT](https://giellalt.uit.no) / ALTLab – die morphologischen Transduktoren (FSTs)
  - [Masakhane](https://www.masakhane.io) – MT-Community für afrikanische Sprachen
  - [OPUS](https://opus.nlpl.eu) – offene Parallelkorpora

> Um einen Preis zu sponsern, eine Rechenleistungsspende zu organisieren oder über eine Partnerschaft zu sprechen,
> schreiben Sie an [info@champollion.dev](mailto:info@champollion.dev). Schlüsselverwalter der Gemeinschaft –
> bisher sind keine ernannt; die Schlüssel eines versiegelten Datensatzes werden von den Organisatoren gehalten, und
> Champollion hält keine Schlüsselanteile. Champollion hat keine Partner, und keine Nation
> oder Organisation wird als solche genannt, bevor sie nicht zugestimmt hat.

---

## 1. Philosophie

> **Die Vereinbarung in einer Zeile: Knacken Sie eine Sprache, gewinnen Sie, zu den erklärten Bedingungen des Gastgebers.**
> Champollion ist ganz bewusst eine ML-Benchmarking-Initiative – Wettbewerb ist der Weg, wie schwierige
> Sprachpaare gelöst werden. Wir laden ML-Forscher und alle fähigen Entwickler dazu ein, die
> beste Methode für ein bestimmtes schwieriges Sprachpaar zu entwickeln und den Preis zu gewinnen. Was danach
> mit der Methode geschieht, ist die veröffentlichte Entscheidung des **Gastgebers**, nicht unsere und kein
> Standard: Eine Gemeinschaft, die die Übergabe einer siegreichen Methode wünscht, legt dies in ihren
> Bedingungen fest, und eine, die sie nur messen und löschen möchte, legt stattdessen das fest (§1.3).
> Die Wettbewerbsenergie ist echt, und sie ist auf die Mission gerichtet – Sprachen zu übersetzen,
> zu den Bedingungen, die ihre Menschen festlegen –, nicht auf das Erklimmen einer Bestenliste
> um des Erklimmens willen.

### 1.1 Preise belohnen Durchbrüche, nicht Teilnahme

Preisgeld wird nur ausgeschüttet, wenn eine Methode nachweislich eine definierte Fähigkeitsschwelle erreicht. Es gibt keine Teilnahmepreise, keine Auszeichnungen für Zweitplatzierte und keine Trostpreise. Wenn niemand die Messlatte erreicht, wird niemand bezahlt. Dies ist beabsichtigt — es bedeutet, dass Sponsoren nur für Ergebnisse zahlen, die tatsächlich funktionieren.

### 1.2 Gemeinschaftsvalidierung ist unverhandelbar

Automatisierte Metriken sind Näherungswerte (SCORING_SPEC §1.1). Eine Methode kann bei chrF++ und FST-Akzeptanz gut abschneiden und dabei eine Ausgabe erzeugen, die kein Sprecher akzeptieren würde. **Jeder Preisantrag erfordert Gemeinschaftsvalidierung** — zweisprachige Sprecher müssen bestätigen, dass die Ausgabe verwendbar ist. Dies ist das Tor der menschlichen Validierung (BENCHMARK_SPEC §7).

### 1.3 Was mit einer gewinnenden Methode geschieht, wird deklariert, nicht vorausgesetzt {#1-3-declared-terms}

Eine Sache steht fest, denn sie macht das Wesen eines souveränen Wettbewerbs aus: Die Einreichung wird an den eigenen, netzwerkisolierten Node des Hosts übergeben, der sie auf der Maschine des Hosts gegen ein versiegeltes Set ausführt. Was *danach* mit ihr geschieht, ist die deklarierte Wahl des Hosts, die pro Wettbewerb getroffen und mit diesem veröffentlicht wird – und es handelt sich um **eine Wahl aus drei Optionen**:

| Bedingung | Was sie für Sie bedeutet |
|---|---|
| `pass_to_holders` – *an Inhaber übergeben* | Die Methode geht an die souveränen Benchmark-Inhaber über. Diese bewerten sie und behalten sie, unabhängig davon, wer gewinnt. |
| `retain_ip` – *geistiges Eigentum behalten* | Sie behalten das Eigentum an Ihrer Methode. Der Host bewertet sie und behält höchstens eine versiegelte Kopie für Prüfzwecke. |
| `release_open` – *offen veröffentlichen* | Sie behalten das Eigentum, müssen die Methode jedoch unter einer Open-Source-Lizenz veröffentlichen. Diese Veröffentlichung ist die Preisbedingung. |

Alles Weitere, was sich aus einer Bedingung ergibt – ob das Artefakt aufbewahrt wird, ob Rechte übertragen werden, wofür der Host es nutzen darf, wann eine Veröffentlichung fällig wird –, wird aus der vom Host gewählten Option **abgeleitet** (§2.1, Bedingung 7) und ist kein separates Kontrollkästchen, das ein Host ankreuzen müsste. Ein Host wählt die Bedingung; die Details folgen daraus.

Zwei Konsequenzen, die klar benannt werden sollten:

- **Ein Wettbewerb ohne deklarierte Preisbedingungen hat keinen Preis.** Das ist der Standard. Es ist kein minderwertiger Wettbewerb, und an der Einreichung ändert sich bezüglich der Rechte nichts.
- **Nichts wird stillschweigend vorausgesetzt.** Die deklarierte Bedingung wird gehasht, der einreichenden Person in klarer Sprache angezeigt und über diesen Hash akzeptiert; die Annahme wird innerhalb der Einreichung mitgeführt und ist durch deren Content-Hash abgedeckt, und der Node des Hosts weist jede Einreichung ab, die etwas anderes akzeptiert hat. Die Bedingung wird in dem Moment eingefroren, in dem der Wettbewerb seine erste Einreichung erhält, sodass niemand an Bedingungen gebunden ist, die er nicht hätte einsehen können.

Entscheidet sich ein Host für `pass_to_holders`, behält die entwickelnde Person weiterhin das Recht auf Namensnennung und Veröffentlichung, und der Sinn der Regelung besteht darin, dass Preisgelder Technologien finanzieren, die die Sprachgemeinschaft tatsächlich nutzen kann. Das ist ein guter Grund für einen Community-Host, diese Bedingung zu wählen. Es ist eine freie Wahl, keine Vorschrift.

### 1.4 Manipulationsschutz

Preisschwellen werden gegen eine **Goldstandard-Evaluierung** definiert (geheimer Testsatz, ausgeführt von der Governance-Organisation in der Sandbox). Entwickler sehen die Testdaten niemals. Dies wird architektonisch durchgesetzt — es ist keine Richtlinie, die auf Ehre beruht. Siehe BENCHMARK_SPEC §8.2.

### 1.5 Korpuslizenzierung: Nicht-kommerzielle Korpora bleiben aus der Preisspur heraus

Einige Korpora, die bei der Methodenentwicklung verwendet werden, unterliegen nicht-kommerziellen Lizenzen – beispielsweise steht der EdTeKLA Cree Language Textbook-Korpus unter **EdTeKLAs modifizierter CC BY-NC-SA** (souveränitätsbezogen, nicht-kommerziell; das zugrunde liegende Lehrbuch steht unter CC BY-NC-ND 4.0). Diese Korpora sind **ausschließlich für die Forschungs-/Entwicklungsschiene** bestimmt:

1. **Goldstandard-Korpora für Preise dürfen keine NC-lizenzierten Korpusinhalte einbetten.** Goldstandard-Testsegmente sind von der Gemeinschaft in Auftrag gegebene Originale (siehe Korpus-Partnerschaftsstrategie) – von Menschen für den Preis verfasst, mit von Beginn an geklärten Rechten für Evaluation und kommerziellen Einsatz.
2. **Eine Methode, die einen Preis beansprucht, darf keine NC-lizenzierten Korpusinhalte einbetten** (z. B. als Coaching-Daten, eingebettete Beispiele oder Nachschlagetabellen). Unter einer `pass_to_holders`-Bedingung muss die Methode von den Inhabern zu beliebigen Bedingungen eingesetzt werden können – einschließlich kommerziell, falls die Gemeinschaft dies beschließt (BENCHMARK_SPEC §8.3); NC-lizenzierte Inhalte darin würden diese Freiheit zunichtemachen.
3. **Entwickler dürfen NC-lizenzierte Korpora frei zur Entwicklung und Selbstevaluation nutzen** – genau dafür ist die Entwicklungsspur gedacht. Die Einschränkung gilt für das, was eingereicht und was eingesetzt wird, nicht dafür, wie ein Entwickler lernt.

### 1.6 Abhängigkeitsklassen steuern die Preisberechtigung

Jede Preisevaluation findet in einer Sandbox statt (§1.4), und unter einer `pass_to_holders`-Bedingung geht eine preisgekrönte Methode an die Inhaber über (§1.3). Beides erlegt dieselbe Einschränkung auf: **Alles, wovon eine Methode abhängt, muss etwas sein, das der Entwickler in die Sandbox einbringen und, sofern die Bedingung dies vorsieht, an die Gemeinschaft übertragen darf.** Jede Einreichung deklariert eine Abhängigkeitsklasse – definiert in der [Spezifikation der Methodenschnittstelle](/docs/network/specifications/methods#method-validity-and-dependency-classes) – und die Berechtigung richtet sich nach der Klasse:

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
| **Vorgesehener Sponsor** | Gründer des Champollion-Projekts – eine beabsichtigte Zusage, **bislang werden nirgendwo Gelder verwahrt.** Nach verbindlicher Zusage würden die Mittel beim Sponsor oder einem benannten Community-Trust verbleiben – niemals bei Champollion. |
| **Status** | **VORGESCHLAGEN – nicht geöffnet.** Es werden keine Einreichungen entgegengenommen. |
| **Öffnet** | Erst, wenn der Goldstandard-Korpus und das Sprecherprüfungs-Gate existieren (beides ist noch nicht der Fall), die Evaluations-Sandbox mit echten Modellen erprobt wurde (bislang wurde nur eine Dummy-Methode ausgeführt) und die Mittel des Sponsors gemäß §4.2 nachweislich hinterlegt sind. |
| **Läuft ab** | Nach Eröffnung kein Ablaufdatum. |

#### Schwellenbedingungen

Eine Methode beansprucht den Gründerpreis, indem sie **ALLE** folgenden Bedingungen gleichzeitig erfüllt:

| # | Bedingung | Metrik | Schwellenwert | Begründung |
|---|-----------|--------|---------------|------------|
| 1 | ~~Zusammengesetzter Score~~ — **eingestellt** | — | — | Diese Bedingung (zusammengesetzt ≥ 0,80) wurde zusammen mit dem zusammengesetzten Score am 04.10.2026 eingestellt ([Bewertungsspezifikation §4](/docs/network/specifications/scoring#4-composite-score)). Die Score-Bedingung ist allein chrF++ (Bedingung 3); die Nummer wird beibehalten, damit die anderen Bedingungen ihre Nummerierung behalten. |
| 2 | **FST-Akzeptanz** (ein diagnostisches Gate, nicht der Score) | `fst_acceptance_rate` (SCORING_SPEC §2.2) | **≥ 0,99 (99%+)** | Praktisch alle Ausgabewörter müssen morphologisch gültige Formen sein, die vom GiellaLT-FST anerkannt werden. Die Toleranz von 1 % berücksichtigt Randfälle (Eigennamen, Neologismen, Lehnwörter), die der FST berechtigterweise möglicherweise nicht abdeckt. Dies ist das entscheidende Qualitäts-Gate für polysynthetische maschinelle Übersetzung — wenn der FST mehr als 1 % der Wörter ablehnt, erzeugt die Methode Formen, die in der Sprache nicht existieren. Der eigentliche Zweck dieses Preises besteht darin, ein System zu erwerben, das Inhalte nicht verfälscht. |
| 3 | **chrF++** (der Score) | `chrf_plus_plus` (SCORING_SPEC §2.1), mit seiner sacreBLEU-Signatur und 95%-KI | **≥ 55,0** | Der Korpus-chrF++ auf dem versiegelten Datensatz muss auf der Skala von 0–100 den Wert 55 erreichen — die standardmäßige Hauptmetrik ([Bewertungsspezifikation](/docs/network/specifications/scoring#how-runs-are-scored)). Er vergleicht jede Ausgabe mit ihrer Referenz, sodass ein System ihn nicht mit gültigen Wörtern erreichen kann, die die Eingabe nicht übersetzen. |
| 4 | **Validierung durch die Gemeinschaft** | Menschliche Überprüfung (BENCHMARK_SPEC §7) | **≥ 70% "akzeptabel" oder "hervorragend"** | Eine geschichtete Stichprobe von Ausgaben (≥30 Einträge über die Schwierigkeitsstufen 2–5) wird von ≥2 zweisprachigen CRK-Sprechern überprüft. Mindestens 70 % der überprüften Einträge müssen eine Bewertung von "akzeptabel" oder "hervorragend" erhalten. |
| 5 | **Goldstandard-Evaluierung** | Sandbox-Ausführung (BENCHMARK_SPEC §8.2) | **Erforderlich** | Alle automatisierten Metriken müssen gegen das Korpussegment `gold_standard` berechnet werden, ausgeführt durch die Governance-Organisation des Wettbewerbs (noch existiert keine) in einer Sandbox-Umgebung. Werte des Entwicklungssatzes zählen nicht. |
| 6 | **Reproduzierbarkeit** | Fingerabdruck-Übereinstimmung (BENCHMARK_SPEC §3.8) | **±2%** | Die Governance-Organisation des Wettbewerbs muss in der Lage sein, die Methode erneut auszuführen und Scores innerhalb von ±2 % der eingereichten Run-Card zu erzielen. |
| 7 | **Die deklarierten Preisbedingungen des Wettbewerbs sind erfüllt** | Die von dieser Bedingung geforderten Überprüfungen (siehe unten) | **Erforderlich** | Preise existieren nur bei souveränen Wettbewerben, bei denen Ihr Beitrag vom physisch isolierten Node des Veranstalters auf einem versiegelten Datensatz ausgeführt wird. Was *danach* damit geschieht, ist eine von drei deklarierten Optionen, die mit dem Wettbewerb vor Beginn der Einreichungen veröffentlicht werden — keine einzelne Bedingung, die jeder Wettbewerb vorschreibt. |

#### Bedingung 7 im Detail: Die Bedingung ist eine von drei Optionen

Jeder souveräne Wettbewerb funktioniert zum Ausführungszeitpunkt auf dieselbe Weise: Sie übergeben Ihre
Methode (Gewichte oder Code) an den netzwerkisolierten Node des Hosts, und der Node bewertet sie
auf dem versiegelten Set. Genau das bedeutet „der Host hat es gemessen“, und daran gibt es
nichts zu rütteln.

Was *danach* geschieht, ist die Wahl des Hosts, die pro Wettbewerb deklariert wird, und es
ist eine von drei Optionen. Der Host veröffentlicht sie vor Eröffnung der Einreichungen; sie
wird in dem Moment **eingefroren**, in dem der Wettbewerb seine erste Einreichung verzeichnet,
sodass genau die Bedingung gilt, die Sie eingesehen haben.

| Bedingung | Was sie für Sie bedeutet |
|---|---|
| `pass_to_holders` – *an Inhaber übergeben* | Die Methode geht an die souveränen Benchmark-Inhaber über. Diese bewerten sie und behalten sie, unabhängig davon, wer gewinnt. |
| `retain_ip` – *geistiges Eigentum behalten* | Sie behalten das Eigentum an Ihrer Methode. Der Host bewertet sie und behält höchstens eine versiegelte Kopie für Prüfzwecke. |
| `release_open` – *offen veröffentlichen* | Sie behalten das Eigentum, müssen die Methode jedoch unter einer Open-Source-Lizenz veröffentlichen. Diese Veröffentlichung ist die Preisbedingung. |

**Was die einzelnen Optionen im Detail bedeuten.** Diese vier Dimensionen – plus die Lizenz,
die mit einer geforderten Veröffentlichung einhergeht – werden aus der Option *abgeleitet*: Ein Host
trägt `rights` oder `host_use` niemals manuell ein, und kein Wettbewerb kann
diese beliebig kombinieren:

| Feld | `pass_to_holders` | `retain_ip` | `release_open` |
|---|---|---|---|
| `retention` – bleibt das Artefakt nach der Bewertung erhalten? | `retain` | `retain_sealed_audit` | `retain` |
| `rights` – wechselt das Eigentum? | `assignment_to_host` | `participant_retains_all` | `participant_retains_all` |
| `host_use` – wofür darf der Host es nutzen? | `any` | `evaluation_only` | `any` (unter der von Ihnen veröffentlichten Open-Source-Lizenz) |
| `release` – müssen **Sie** es veröffentlichen und wann? | `not_required` | `not_required` | `required_before_prize` |
| `release_license` – unter welcher Lizenz Sie veröffentlichen | — | — | `any_osi` oder eine benannte SPDX-Kennung |

Zwei der Optionen gestatten es einem Host, genau ein Feld einzugrenzen, und das ist auch schon alles:

- unter `retain_ip` kann der Host `retention` auf `delete_after_scoring` setzen – Ihre Methode wird vernichtet, sobald sie bewertet wurde;
- unter `release_open` kann der Host die Veröffentlichung auf `required_before_scores` (Sie veröffentlichen, bevor Ihre eigenen Ergebnisse freigegeben werden) oder `required_after_prize` (Sie veröffentlichen nach der Auszahlung) legen und die Lizenz vorgeben, anstatt jede von der OSI genehmigte Lizenz zu akzeptieren.

Ein `community_terms_url` – ein `https://`-Link zu den eigenen schriftlichen Bedingungen des Hosts –
kann jede der drei Optionen begleiten. Auf dem Wettbewerb selbst wird die gewählte Option
als `disposition` festgehalten, und das ist der einzige Wert, aus dem alles oben Genannte
ausgelesen wird.

Alles andere wird bei der Erstellung des Wettbewerbs abgewiesen: Eine Option bietet kein
Feld an, das nicht vorgesehen ist, und ein manuell eingetragenes Feld, wo ein abgeleiteter
Wert stehen müsste, wird namentlich zurückgewiesen, anstatt stillschweigend übernommen zu werden.

**Was vor der Auszahlung eines Preises geprüft wird.** Die erforderlichen Verifizierungen ergeben
sich aus der Bedingung; kein Host konfiguriert sie separat:

- **Übergabe** – immer. Der Host besitzt exakt das von ihm bewertete Artefakt (der vom Node
  aufgezeichnete Methoden-Digest). Dieser wird gemessen.
- **Veröffentlichung** – unter `release_open`, wenn die Veröffentlichung vor der Bekanntgabe der Ergebnisse
  oder vor der Preisvergabe fällig wird. Der Host erfasst die Release-URL und den SHA-256-Hash des
  veröffentlichten Artefakts; der Datensatz wird geprüft, und die URL wird niemals abgerufen, sodass ein
  eingefrorenes Ergebnis niemals von der Verfügbarkeit externer Dienste abhängt. Eine Veröffentlichung, die
  *nach* dem Preis gefordert wird, ist eine Verpflichtung, die nach der Auszahlung fällig wird, weshalb sie
  nicht zu den Auszahlungsprüfungen gehört.
- **Rechteübertragung** – unter `pass_to_holders`, wo das Eigentum übergeht. Eine Rechteübertragung
  ist eine Vereinbarung, die außerhalb dieser Plattform unterzeichnet wird; der Host erfasst sie und ihr
  Datum, und die Plattform prüft, ob ein Eintrag existiert.
  **Sie nimmt niemals eine rechtliche Prüfung vor.**

**Ein Wettbewerb ohne deklarierte Preisbedingungen hat keinen Preis.** Es gibt keine Standardbedingung
und es wird für niemanden etwas vorausgesetzt. An einem Wettbewerb teilzunehmen, der eine solche Bedingung
deklariert, bedeutet, sie bei der Einreichung ausdrücklich über ihren Hash zu akzeptieren –
die Annahme wird in Ihr Paket eingebunden und ist Teil dessen, was der Node des Hosts überprüft.

> **Warum 99+% FST?** Das Kernproblem der maschinellen Übersetzung für polysynthetische Sprachen sind Halluzinationen – LLMs erzeugen Zeichenketten, die wie die Zielsprache *aussehen*, aber morphologisch ungültig sind. Eine Methode, die 95 % gültige Ausgaben liefert, enthält immer noch 5 % frei erfundene Wörter – inakzeptables Rauschen für jeden Produktiveinsatz. Der Schwellenwert von 99%+ verlangt eine Halluzinationsrate von nahezu null und lässt gleichzeitig Raum für seltene Grenzfälle (einen Eigennamen, den der FST nicht kennt, einen legitimen Neologismus). Schafft eine Methode keine 99%+ FST-Akzeptanz, hat sie das Problem nicht gelöst.
>
> **Warum chrF++ und FST zusammen, und warum keines von beiden allein genügt.** Die FST-Akzeptanz besagt lediglich, dass jedes Wort existiert; ein System, das für jede Eingabe denselben gültigen Satz wiederholt, besteht diesen Test vollständig. chrF++ vergleicht jede Ausgabe mit ihrer Referenz und deckt dies somit auf. Keine der beiden automatischen Zahlen bescheinigt jedoch Qualität: Erst das Community-Validierungs-Gate (Bedingung 4) bestätigt, dass Sprecher die Ausgabe als brauchbar einstufen.

#### Was diese Schwelle in der Praxis bedeutet

Was die Bedingungen gemeinsam sicherstellen:

- **Praktisch jedes** Ausgabewort ist ein echtes Cree-Wort (FST validiert 99%+ – nahezu keine erfundenen Formen)
- Die Ausgaben liegen nahe an den Referenzen des versiegelten Sets (chrF++ ≥ 55)
- Zweisprachige Sprecher haben gemäß dem Protokoll der Gemeinschaft mindestens 70 % einer geschichteten Stichprobe als akzeptabel oder besser bewertet – die einzige Bedingung, die über Qualität aussagt
- Verbleibende Fehler sind sprachliche Fehler (falsche Flexion, fehlerhafte Obviation, Nichtübereinstimmung der Belebtheit) – keine erfundenen Wörter

Dies ist ein System, das **die Sprache nicht verstümmelt.** Es mag nicht perfekt sein, aber jedes Wort, das es erzeugt, ist ein echtes Wort. Das ist die Mindestmesslatte für respektvolle maschinelle Übersetzung einer polysynthetischen Sprache.

---

## 3. Preis-Antragsprozess

### 3.1 Zulassung, dann Einreichung

1. **Öffentlich qualifizieren.** Die entwickelnde Person bewertet das veröffentlichte Entwicklungsset des Wettbewerbs mit ihrem eigenen System und bewahrt den Beleg auf (`mt-eval contest qualify`). Der Beleg basiert naturgemäß auf Selbstauskunft – es handelt sich um eine Behauptung, die der Host in Schritt 4 überprüft.

2. **Die Einreichung übergeben.** Die Teilnahme an einem Wettbewerb erfolgt, indem dem Node des Hosts etwas übergeben wird, das er ausführen kann, und zwar auf einer von zwei Schienen:
   - ein **Modell** – Safetensors-Gewichte, ein deklarativer Tokenizer und eine Konfiguration, ganz ohne Code (`mt-eval contest submit-model`); oder
   - eine **Methode** – ein Dockerfile und ein Entrypoint, vendorisiert, sodass Erstellung und Ausführung komplett ohne Netzwerkzugriff funktionieren (`mt-eval contest submit-method`).

   Das Hochladen von Übersetzungen eines veröffentlichten Testsets sowie das Verlinken eines Werts, den Entwickler selbst veröffentlicht haben, wurden **am 06.09.2026 als Teilnahmepfade für Wettbewerbe ausgemustert** und die entsprechenden Befehle gelöscht. Selbstauskunftsbasierte Werte gehören weiterhin auf das offene Leaderboard, das eine nach Korpus und Sprachpaarrichtung indexierte öffentliche Übersicht darstellt – kein Wettbewerb und keine Preisschiene.

3. **Direkt auf der Einreichung deklarieren:** den Track (`constrained` – ausschließlich auf den vom Host zugelassenen Daten trainiert – oder `unconstrained`), die Parameteranzahl, die Lizenz der Gewichte und ob diese öffentlich sind, die Trainingsdaten, auf die sich die Beschränkungsangabe bezieht, ob es sich um die primäre Einreichung des Teams oder eine kontrastive handelt, und – falls der Wettbewerb dies verlangt – eine Systembeschreibung. Die entwickelnde Person übergibt außerdem `--agree` für die Bedingungen zur Methodeneinreichung sowie, falls der Wettbewerb Preisbedingungen deklariert, `--accept-terms <hash>` für diese.

### 3.2 Evaluierung

1. Der Node des Hosts führt seine **statischen Prüfungen** auf dem Bundle durch und weist alles zurück, was Netzwerkzugriff erfordern würde, sowie jede Einreichung, die andere als die von diesem Wettbewerb deklarierten Preisbedingungen akzeptiert hat.
2. Der Node **führt die Qualifikation selbst erneut aus**, und zwar auf seiner eigenen Kopie des öffentlichen Entwicklungssets unter Verwendung desselben Schienen-Executors und desselben Scorers. Der Beleg des Entwicklers war eine Behauptung; dies ist die Messung. Ein Nichterreichen wird hier abgewiesen – bevor irgendein Treuhänder um Zustimmung gebeten wird und bevor das versiegelte Set geöffnet wird – mit der Angabe, was behauptet wurde, was gemessen wurde und wo die Messlatte lag.
3. **Treuhänder autorisieren** den versiegelten Lauf (M-von-N gemäß dem Autorisierungsmodell des Wettbewerbs). Die Freigabe ist einmalig, zeitlich begrenzt und an den exakten Fingerprint (Bundle-Hash, Korpus, Korpusversion, Node) gebunden.
4. Die Einreichung wird gegen den versiegelten Korpus `gold_standard` innerhalb der netzwerkisolierten Sandbox auf der eigenen Maschine des Hosts ausgeführt, und die automatisierten Metriken werden berechnet (chrF++ mit Konfidenzintervall und Signatur, die übrigen Standardmetriken sowie Diagnosen wie die FST-Akzeptanz). Ein deklariertes versiegeltes Holdout-Set und eventuelle Testsuiten von Drittanbietern laufen im **selben** autorisierten Lauf.
5. **Es verlassen ausschließlich aggregierte Werte die Umgebung** – auf Datenbankebene erzwungen, nicht bloß durch Konvention. Falls der Wettbewerb `hidden_until_close` zugesichert hat, wird die Card zurückgehalten, bis der Abschluss sie veröffentlicht.
6. Werden die automatisierten Schwellenwerte erreicht (Bedingungen 2–3), leitet der Host die Community-Prüfung ein. Werden sie nicht erreicht, erhält die einreichende Person ihre Werte und es wird keine Community-Prüfung ausgelöst.

### 3.3 Gemeinschaftsprüfung

1. Eine stratifizierte Stichprobe von Ausgaben (≥30 Einträge, die die Schwierigkeitsstufen 2–5 abdecken) wird zweisprachigen Sprechern vorgelegt
2. Mindestens 2 unabhängige Prüfer bewerten jeden Eintrag
3. Bewertungsskala: **ablehnen** / **Kernaussage** / **akzeptabel** / **ausgezeichnet**
4. Wenn ≥70 % der Einträge von beiden Prüfern „akzeptabel" oder „ausgezeichnet" erhalten, besteht die Gemeinschaftsvalidierung

### 3.4 Auszahlung

Die Reihenfolge ist festgelegt: **Deklarierte Gate-Schritte verifiziert → Wettbewerb geschlossen → Preis ausgezahlt.** Welche Schritte dies sind, hängt von den Bedingungen ab, die *dieser* Wettbewerb deklariert hat (§2.1, Bedingung 7) – aber welche es auch sind, sie werden vor dem Abschluss verifiziert, und es wird niemals Geld auf Basis einer Rangliste ausgezahlt, die sich noch verändern kann.

Ein Organisator kann mittels `close --force` ein nicht erfülltes Gate übergehen. Der Abschluss wird dann dennoch vollzogen, und die eingefrorene Rangliste erfasst die Preisberechtigung dieser Einreichung exakt wie berechnet – nicht berechtigt, unter Nennung des fehlgeschlagenen Schritts. Ein erzwungener Abschluss ist ein geschlossener Wettbewerb, niemals ein bestandenes Gate.

1. Alle 7 Bedingungen sind erfüllt
2. **Jeder Gate-Schritt, den die deklarierten Preisbedingungen des Wettbewerbs verlangen, ist verifiziert** – stets die Übergabe des bewerteten Artefakts plus eine erfasste Veröffentlichung und/oder eine erfasste Rechteübertragung, sofern diese Bedingungen dies verlangen
3. Der Wettbewerb ist **geschlossen** und seine Rangliste eingefroren
4. Die Governance-Organisation bestätigt das Ergebnis anhand der eingefrorenen Rangliste
5. Der Preis wird innerhalb von 30 Tagen nach Bestätigung ausgezahlt
6. Alles, was die deklarierten Bedingungen bezüglich des Eigentums besagen, tritt gemäß diesen Bedingungen in Kraft – bei einem Wettbewerb, dessen `rights` `participant_retains_all` lautet, wird überhaupt nichts übertragen
7. Das Ergebnis wird auf dem Leaderboard mit der Verifizierungsstufe „Community Validated“ veröffentlicht

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

| Stufe | Betrag | Vorgeschlagener Schwellenwert |
|------|--------|---------------------|
| **Seed** | 5.000–15.000 $ | Eine chrF++-Hürde auf dem versiegelten Set, veröffentlicht vor Eröffnung des Wettbewerbs + Community-Validierung |
| **Breakthrough** | 25.000–50.000 $ | Eine höhere chrF++-Hürde + Community-Validierung |
| **Grand Prize** | 100.000 $+ | Die Breakthrough-Bedingungen + Abdeckung mehrerer Sprachregister + Bereitstellungsintegration |

Die Messlatte ist stets chrF++ (mit Signatur, damit sie reproduzierbar ist); diagnostische Gates wie die FST-Akzeptanz können als Gates hinzugefügt werden. Ein Gesamtwert (Composite) oder eine Qualitätsstufe kann kein Preisschwellenwert sein.

Sponsoren können außerdem Folgendes finanzieren:
- **Verbesserungsprämien (Bounties)** – feste Vergütung für jede Steigerung des chrF++ um 5 Punkte gegenüber dem aktuellen Bestwert
- **Register-Preise** – gesonderte Auszeichnungen für bestimmte Sprachregister (formell, zeremoniell, pädagogisch)
- **Kosten-Preise** – geringste Kosten pro Eintrag unter den Methoden, die die chrF++-Hürde nehmen (Kosten werden neben dem Wert ausgewiesen, niemals mit ihm verrechnet)

### 4.2 Wo Preisgelder gehalten werden

Preisgelder werden **vom Sponsor gehalten**: Sie liegen bei der sponsernden Organisation oder bei einem vom Sponsor benannten Gemeinschaftsfonds — **niemals bei Champollion**, das die Messung koordiniert und kein Geld berührt. Ein glaubwürdiger Preis veröffentlicht vor seiner Eröffnung: **wer die Mittel hält**, unter welcher Vereinbarung (Organisationskonto, Treuhandfonds oder Drittverwahrung nach Wahl des Sponsors) und die Vergabeschwelle — sodass das Erreichen der Messlatte anhand veröffentlichter Werte sowie des Sprecher-Validierungsurteils der Gemeinschaft überprüfbar ist und ein Zahlungsausfall öffentlich als solcher sichtbar wäre. Heute werden nirgendwo Preisgelder gehalten. Sollte ein Preis unbeansprucht ablaufen, bleiben die Mittel dort, wo sie immer waren — beim Sponsor —, um nach Ermessen des Sponsors umgeleitet oder abgezogen zu werden. Die Selbstbedienungsmechanik, einschließlich des Ausfallrisikos des Sponsors und dessen Minderungsmaßnahmen, ist in [Einen souveränen Wettbewerb durchführen](/docs/network/sovereignty/run-a-sovereign-contest) und den [Bedingungsvorlagen](/docs/network/sovereignty/terms-templates) dokumentiert.

---

## 5. Disqualifikation

Eine Einreichung wird disqualifiziert, wenn:

1. **Training auf Evaluationsdaten.** Die Methode kam mit Korpuseinträgen aus `gold_standard` oder `held_out` in Berührung. (Architektonisch durch die Sandbox-Ausführung verhindert – werden jedoch Hinweise auf Kontamination gefunden, wird das Ergebnis annulliert.)
2. **Nicht reproduzierbar.** Die Governance-Organisation kann die Werte nicht innerhalb von ±2 % reproduzieren.
3. **Undeklarierte oder unzulässige Abhängigkeiten.** Die Methode benötigt zur Laufzeit Zugriff auf externe Dienste über das hinaus, was ihr Abhängigkeitsmanifest deklariert, oder ihre effektive Abhängigkeitsklasse ist A2 oder X (§1.6). Deklarierte LLM-Inferenz der Klasse A1, die über das Evaluations-Gateway geleitet wird, ist zulässig; jede andere Laufzeit-Netzwerkabhängigkeit – sowie jede undeklarierte Abhängigkeit jeglicher Klasse – führt zur Disqualifikation.
4. **Teilnahmebedingungen nicht unterzeichnet.** Alle Teammitglieder müssen den Bedingungen für die Methodeneinreichung zustimmen und – sofern der Wettbewerb Preisbedingungen deklariert (§1.3) – auch diesen, per Hash.
5. **Manipulation festgestellt.** Die Ausgabe ist auf die Metrik statt auf die Übersetzungsqualität hin optimiert (aufgedeckt durch Community-Prüfung und/oder Anti-Gaming-Prüfungen gemäß BENCHMARK_SPEC §9.3).

---

## 6. Beziehung zu anderen Spezifikationen

| Dieses Dokument | Verweise | Für |
|--------------|-----------|-----|
| §2 Schwellenwertbedingungen | SCORING_SPEC „How runs are scored“ und §2.1–2.2 (Metriken) | Metrikdefinitionen und Skala |
| §2 Community-Validierung | BENCHMARK_SPEC §7 | Protokoll der menschlichen Prüfung |
| §3 Sandbox-Ausführung | BENCHMARK_SPEC §8.2 | Souveränitätsmechanismus |
| §1.3 Deklarierte Preisbedingungen | BENCHMARK_SPEC §8.3 | Was der Host danach mit einer Einreichung tun darf |
| §1.6 Abhängigkeitsklassen | Spezifikation der Methodenschnittstelle; BENCHMARK_SPEC §8.6 | Klassendefinitionen, Zulassungsbedingungen, Sandbox-Netzwerkrichtlinie |
| §4 Kosten-Preise | SCORING_SPEC §6.2 | Formeln der Kostenmetrik |

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
1. Die Benutzeroberfläche des Leaderboards muss aktive Preise und deren Schwellenwertbedingungen anzeigen
2. Run-Cards, die automatisierte Schwellenwerte erfüllen (Bedingungen 2–3), müssen für die Community-Prüfung markiert werden
3. Es wird keine Qualitätsstufe verwendet: Das Feld `quality_tier` ist auf jeder neuen Run-Card null (scoring standard/1)
4. Die Ebene der Preis-**Bedingungen** wird bereits ausgeliefert (`contest_prize_terms` – Deklaration, Hash, Annahme und das Auszahlungs-Gate), und die Bewertung selbst bleibt unverändert. Was ein neuer Preispool hinzufügt, ist die Schwellenwertrichtlinie in §2 und die Darstellung auf dem Leaderboard in den Punkten 1–2 oben

---

*Eine Preisstruktur muss mit den Preisbedingungen kompatibel sein, die derselbe Wettbewerb deklariert (§1.3). Diese Bedingungen sind die freie Wahl des Hosts in jeder Dimension – von „bewerten, löschen, alle Rechte verbleiben bei der einreichenden Partei“ bis hin zu „Sie übergeben es, wir bewerten es und behalten es in jedem Fall“ – und sie werden veröffentlicht, gehasht und akzeptiert, bevor jemand teilnimmt. Ein Community-Host, der möchte, dass eine gewinnende Methode in das Eigentum der Gemeinschaft übergeht, kann genau dies deklarieren, und der Preis finanziert dann die Entwicklung von Technologie, die der Sprachgemeinschaft gehört. Nichts hierin setzt dies im Namen irgendeines Hosts stillschweigend voraus.*
