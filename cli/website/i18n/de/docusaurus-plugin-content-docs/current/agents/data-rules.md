---
title: "Daten- und Übertragungsregeln"
slug: /agents/data-rules
description: "Die Regeln, die jedes Champollion-Werkzeug auf die Daten der Menschen anwendet: die set/1-Sidecar-Datei Feld für Feld, „local-only“ und dessen vorläufiger Standardwert, „training not-allowed“, Sprecher:innen und Rechteinhaber:innen, die zugestimmt haben, was jedes Werkzeug ausgibt und niemals ausgibt, die vier Übertragungsmodi, die Registrierungsstufen sowie Modellausgaben als abgeleitete Werke."
---

# Daten- und Übertragungsregeln

Die Menschen, die Sprachdaten halten, entscheiden darüber, wie sie verwendet werden. Die Schienen schreiben ihre
Entscheidungen neben jede Datei, und jedes Werkzeug befolgt, was geschrieben steht – mit
gemeinschaftlicher Eigenverantwortung und Kontrolle über Sprachdaten als Gestaltungsregel, nicht als bloße
Einstellung. Diese Seite beschreibt das Regelwerk im Detail: was jedes Feld bewirkt, was die
Werkzeuge ablehnen und welche Teile nur Sie bewahren können.

## Das Sidecar (set/1)

Neben jeder Datendatei, `<file>.champollion.json`, `$schema`
`https://champollion.dev/schemas/set/1.json`. Unbekannte Schlüssel werden abgelehnt; Anmerkungen
gehören unter `x-`. Ein vor set/1 geschriebenes Sidecar (ohne `$schema`) wird als set/0
gelesen und bleibt gültig (`champollion upgrade` schreibt es neu).

| Feld | Werte | Wirkung |
|---|---|---|
| `transmission` | `local-only` (der einzige Wert) | Nur ein Modell auf diesem Rechner darf den Text sehen; jedes Werkzeug weigert sich, ihn irgendwohin zu senden (einschließlich `mt-eval project offer`) |
| `role` | `train` · `dev` · `test` · `sealed` · `input` · `resource` | Wofür die Datei da ist. Mit `test` und `sealed` wird niemals trainiert |
| `kind` | `parallel` · `monolingual` · `lexicon` · `grammar` · `glossary` | Was sie enthält |
| `pair` | `{source, target}` | Die Richtung, in der ihre Spalten verlaufen, in den Codes der Karten |
| `fields` | `{source, target}` | Welche Spalte oder welches JSON-Feld welche Seite enthält |
| `terms.training` | `allowed` · `not-allowed` | `not-allowed`: Kein Modell darf darauf trainiert werden |
| `terms.owner` | Text | Wer sie hält, in den Worten der haltenden Personen |
| `terms.speakers` | Text | Wessen Worte sie enthält, in den Worten der haltenden Personen |
| `terms.speakers_agreed` | `yes` · `not-yet` · `some-said-no` | Ob die Menschen, deren Worte dies sind, zugestimmt haben |
| `terms.consent_record` | Pfad | Der Zustimmungsvermerk, relativ zum Ordner der Datei |
| `holders_agreed` | `{by, date}` | Wer von den Haltenden zugestimmt hat, dass eine rein lokale Ausgabe dort verbleiben darf, wo sie ist (lockert nichts) |
| `derived_from` | Pfad | Die geschützte Datei, aus der diese erstellt wurde; ihre Markierungen wurden hierher übertragen |
| `id`, `name`, `license`, `tier`, `segment`, `sha256`, `rows`, `card`, `registeredAt` | | Geschrieben von `champollion network register-corpus`; eine geänderte Datei (anderer sha256) erhält nicht mehr die ID der Karte |
| `written_by` | Text | Der Befehl, der sie geschrieben hat |

**Sperre.** Ein Sidecar macht eine Datei immer nur strenger: Es lockert niemals, was ein
Korpus-Umschlag oder ein Registereintrag besagt.

## Rein lokal und der vorläufige Standard

`champollion data add` markiert die von ihm geschriebene Datei als rein lokal, wenn das
`defaults.transmission` des Projekts auf `local-only` steht (was `champollion new` schreibt), und
ausnahmslos bei `--into test`. Diese Markierung ist der Schutz des Werkzeugs, bis die haltenden Personen
antworten, gekennzeichnet mit `"x-transmission-default": true`.

- Die erste Antwort der haltenden Personen entscheidet. `champollion data mark <file>
  --may-leave` lifts a provisional mark; `--local-only` macht sie zu ihrer eigenen Entscheidung (die
  Kennzeichnung wird entfernt).
- **Hinweis.** Das Werkzeug kann nicht erkennen, wer den Befehl ausgeführt hat. Heben Sie eine vorläufige Markierung
  nur mit der eigenen Antwort der haltenden Personen auf.
- **Sperre.** Eine von den haltenden Personen vorgenommene Markierung als rein lokal kann durch keinen
  Befehl aufgehoben werden: *„Diese Datei ist als rein lokal markiert, und ein Sidecar wird immer nur
  strenger. Ob sie diesen Rechner verlassen darf, ist die Entscheidung ihrer haltenden Personen – wenn
  sie zustimmen, bearbeiten Sie das Sidecar von Hand.“*
- **Sperre.** `data mark` bei einer Datei, die noch nicht rein lokal ist, erfordert `--local-only` oder
  `--may-leave`: *„Ob der Text dieser Datei jemals an einen externen KI-Dienst
  gesendet werden darf, ist die Entscheidung ihrer haltenden Personen, daher wird dies niemals vorausgesetzt“*.

Was rein lokal in jedem Werkzeug bedeutet:

| Wo | Was geschieht |
|---|---|
| Jede Evaluierung (`mt-eval run`, Forge-Bewertung) | Die Richtlinie löst sich zu `sealed` auf (Stufe `local-only`): Nur ein Loopback-Endpunkt, der prozessinterne Adapter des Testrahmens (`local-model`) oder eine mit `--attest-local-transport` ausgeführte externe Methode darf den Text sehen |
| Ausgabe im Terminal und in `--json` | Die Sätze werden zurückgehalten; stattdessen werden Zeilennummern, IDs, Anzahlen und Punktwerte ausgegeben, zusammen mit einer Zeile, die den Grund nennt |
| Daraus abgeleitete Dateien | Splits, bereinigte Kopien, Hypothesen und Ausführungsprotokolle behalten den Text (sie befinden sich in den Ordnern der Person) und tragen die Markierung in einem eigenen Sidecar weiter |
| Ein darauf trainiertes Modell | Seine Ausgabe ist ebenfalls rein lokal (`forge-model.json` `trained_on.terms`; unrecorded gilt als rein lokal): `try_translation` gibt nur die Seite des Modells zurück, `champollion connect`, `mt-eval serve` außerhalb von Loopback und `mt-eval translate` außerhalb des Projekts erfordern `--holders-agreed-by`, und `sync` hält seine Antworten zurück, sowohl über die `api`- als auch über die `local`-Methode ([Bereitstellung](/docs/agents/serving)) |
| Eine Coaching-Datei oder ein Wörterbuch | Eine Coaching-Datei mit einem Sidecar überträgt ihre Richtlinie auf den Prompt; die Ausgaben eines Lexikondurchlaufs werden zurückgehalten, wenn ihr Wörterbuch rein lokal ist |

**Hinweis.** `--attest-local-transport` deklariert den Endpunkt einer Methode als lokal. Übergeben
Sie dies nur, wenn Sie überprüft haben, dass sich der Endpunkt auf diesem Rechner befindet: Eine Loopback-Adresse
kann ein Proxy sein, der an jeden beliebigen Ort weiterleitet.

## Training

- **Sperre.** nmt-forge weigert sich, auf einer Datei zu trainieren, deren Sidecar
  `terms.training: not-allowed` besagt; ein unlesbares Sidecar gilt als
  Einschränkung, niemals als keine.
- **Sperre.** `champollion data combine` führt niemals eine nicht erlaubte Datei zusammen: Es verschiebt
  sie samt ihrem Sidecar nach `data/not-for-training/`. Es verweigert eine Datei, deren
  haltende Personen noch nicht geantwortet haben – kein `terms.training` oder kein
  `terms.speakers_agreed` (*„Bislang hat niemand gesagt, ob alle zugestimmt haben, deren Worte
  darin vorkommen – champollion next befragt die Menschen; führen Sie sie danach zusammen“*) –
  und die zusammengeführte Datei übernimmt die strengste der Bedingungen der Dateien (rein lokal, falls
  eine es ist; nicht erlaubt, falls eine es ist; alle Eigentümer benannt).
- **Sperre.** Der Schritt für Bedingungen im Ablauf zählt eine Datei in `data/parallel/`,
  `data/lexicon/`, `data/grammar/` oder `data/monolingual/` nur dann als beantwortet, wenn
  ihr Sidecar sowohl `terms.training` als auch `terms.speakers_agreed` aufweist (und die
  Antwort zum Training die der haltenden Personen ist, nicht die unten beschriebene Vorsichtsmaßnahme des Werkzeugs); bis dahin
  fragt er erneut, und die Schienen führen nicht weiter.
- **Hinweis.** nmt-forge liest `terms.training`, nicht `speakers_agreed`. Bei einer einzelnen
  Paardatei gibt es kein Zusammenführen (Combine), daher wartet nur der Schritt für Bedingungen auf diese
  Antwort: Trainieren Sie niemals mit einer Datei, bei der die Antwort der Sprecherinnen und Sprecher fehlt.
- **Sperre.** Eine Datei unter `test` oder `sealed` wird niemals für das Training verwendet: `--training
  allowed` wird dafür abgelehnt, und ihr eine andere Rolle zuzuweisen, wird verweigert.
- **Sperre.** `not-allowed` kann nicht per Befehl zu `allowed` werden (*„Wenn ihre haltenden Personen
  dem Training zustimmen, bearbeiten Sie das Sidecar von Hand“*) – mit der einen Ausnahme unten.
- Bibeltexte (USFM) werden als Vorsichtsmaßnahme des Werkzeugs
  mit `terms.training: not-allowed` markiert (`"x-training-default": true`); die Antwort der haltenden Personen
  ersetzt dies.

## Wessen Worte und wer zugestimmt hat

`--speakers` erfasst, wessen Worte die Datei enthält; `--speakers-agreed`, ob
diese zugestimmt haben.

| `speakers_agreed` | Wirkung |
|---|---|
| `yes` | Training gemäß den Angaben der haltenden Personen |
| `not-yet` | Das Training wird erzwungenermaßen auf `not-allowed` gesetzt, bis alle zustimmen; die Datei erscheint in `waiting_for_agreement` |
| `some-said-no` | Kein Modell darf jemals von der Datei lernen: *„Lagern Sie deren Worte in eine andere Datei aus und markieren Sie den Rest“* |
| (keine Antwort) | Der Schritt für Bedingungen fragt weiterhin nach, und `data combine` lehnt die Datei ab (siehe oben) |

**Die einzige Lockerung, die ein Befehl bewirkt:** `not-yet` → `yes` zusammen mit
`--training allowed`. Eine Datei, die `combine` beiseitegelegt hatte, kehrt dann
für den nächsten Zusammenführungslauf zu `data/parallel/` zurück.

**Hinweis.** Stellen Sie die `waiting_for_agreement`-Frage einmal pro Sitzung, behutsam, und
beantworten Sie sie nur mit dem Ja der Person, dass alle zugestimmt haben.

**`--holders-agreed-by "<who>"`** benennt eine Person aus dem Kreis der haltenden Personen der Daten, die
zugestimmt hat, dass eine rein lokale Ausgabe an einen bestimmten Ort gelangen darf: in die Lokalisierungsdateien
einer App (`champollion connect`, erfasst als `holdersAgreed` des Paares), an
eine Adresse, die andere Rechner erreichen (`mt-eval serve`, `nmt-forge serve`, gemeldet
unter `/health`), oder in eine Datei außerhalb des Projekts (`mt-eval translate`,
erfasst als `holders_agreed` des Sidecars). Es lockert nichts anderes: Die
Ausgabe bleibt für jedes Werkzeug rein lokal. **Hinweis.** Übergeben Sie nur den Namen, den die Person
Ihnen genannt hat.

## Was Werkzeuge ausgeben und was niemals

| Werkzeug | Gibt aus | Gibt niemals aus |
|---|---|---|
| `champollion data add` | Anzahlen, Spalten (Buchstabe, Füllrate, mittlere Länge, Anteil lateinischer Buchstaben), eine Kopfzeilenzelle nur dann, wenn sie eine der Sprachen des Paares benennt, ELAN-Tiers nach Nummer sowie die Zeilennummern, die die Zeilenprüfung ermittelt | Einen Satz; jede andere Kopfzeilenzelle (stattdessen deren Länge); die ID eines ELAN-Tiers |
| `champollion data mark`, `combine`, `next`, `validate` | Felder, Anzahlen, Statuswerte | Den Text einer Datendatei – sie öffnen diese niemals |
| `champollion improve …` | Anzahlen und Prozentsätze | Die Sätze der Tabellenblätter |
| `champollion sync` (die Methoden `local` und `api`) | Die Schlüssel, deren Text Wörter enthält, die ein Forge-Modell beim Training nie gesehen hat, aus dem `meta.unseen_words` des Servers | Den Text oder die Wörter selbst |
| `nmt-forge`, `mt-eval` | Für ein rein lokales, versiegeltes oder zustimmungspflichtiges Korpus: IDs, Zeilennummern, Anzahlen, Punktwerte; `[sentence withheld]` in Fehlermeldungen | Seine Sätze, weder in lesbarer Form noch in `--json`-Ausgabe |
| MCP-Schienen-Werkzeuge | Was die CLI ausgibt, gekürzt | Sätze; die Ausgabe eines rein lokalen Modells |

**Hinweis.** `--show-text` (nmt-forge; `mt-eval compare`) gibt zurückgehaltene
Sätze aus. Dies ist für eine Person am eigenen Terminal gedacht, niemals für einen Agenten –
was Sie lesen, wird an Ihren Modellanbieter übermittelt.

**Hinweis.** Kein Werkzeug kann Sie daran hindern, eine Datei zu öffnen. Öffnen, drucken,
fassen Sie niemals die Datendateien, Testsätze, Wortlisten oder
Tabellenblätter der Menschen zusammen und fügen Sie sie nirgends ein — ebenso wenig das `input-words.json` eines Exports: Es listet die Wörter ihrer
Trainingssätze auf und bleibt neben dem Modellordner, niemals darin
([Bereitstellung](/docs/agents/serving#what-an-export-holds)).

**Die Zeilenprüfung.** Beim Einbinden einer Datei (Paare, ein Testsatz oder eine Wortliste)
prüft `data add` deren Zeilen anhand der beiden dateieigenen Spalten – ohne
Wörterbuch, ohne dass etwas entfernt wird. Es zählt und benennt nach Zeilennummer:

- Kopien: Die Übersetzung ist wieder der Ausgangssatz (ein Name oder ein Lehnwort
  ist in Ordnung; andernfalls fehlt die Übersetzung);
- Wiederholungen eines früheren Paares;
- Übersetzungen, die weit länger oder kürzer als das übliche Verhältnis der Datei sind (abgeschnitten
  oder zwei Sätze in einer Zelle);
- Zeilen, die vertauscht wirken: Die Quelle liest sich wie die Übersetzungen der Datei und
  umgekehrt;
- Folgen von Zeilen, die um eine Zeile verschoben wirken: Ihre Übersetzungen passen besser zur nächsten oder
  vorherigen Zeile – Zahlen, Fragezeichen und Längen stimmen eine Zeile
  versetzt überein, und ebenso die Wörter: wie gut die Ausgangswörter einer Zeile Übereinstimmungen
  unter den Wörtern einer Übersetzung finden, gemessen daran, wie oft beide im
  Rest derselben Datei gemeinsam vorkommen (seltenere Wörter wiegen schwerer; die Zeile selbst bleibt unberücksichtigt).
  Dies erkennt eine Verschiebung in einer Datei mit formelhaften Vorlagensätzen, deren Längen alle gleich
  aussehen; es trägt nichts bei, wenn die Wörter der Datei zu wenig aussagen.

Es gibt bis zu 12 Zeilennummern pro Art aus (bis zu 6 Folgen bei um eins verschobenen Zeilen) – bei einer
Tabellenkalkulation die Zeile in der dateieigenen Datei der Person, Kopfzeile mitgezählt – und erfasst
die Anzahlen im `x-import.quality` des Sidecars. Längen-, Vertauschungs- und Verschiebungsprüfungen
benötigen mindestens 20 Paare; eine Wortliste (`--into lexicon`) erhält nur Kopien und
Wiederholungen. **Hinweis.** Geben Sie die Zeilennummern weiter: Die Menschen sehen sich diese Zeilen in
ihrer eigenen Datei an und entscheiden. Öffnen Sie die Datei niemals, um selbst nachzusehen.

**ELAN-Dateien.** Wenn `data add` nicht feststellen kann, welcher Tier welcher ist (eine Seite, die
durch kein Flag benannt ist, mit nicht genau einem in ihrer Sprache erfassten Tier), verweigert es die Ausführung
und listet die Tiers nach Nummer in der Reihenfolge der Datei auf: `tier <n> (<language or
"no language">, <count> annotation(s))`, with `, under tier <m>` für einen Tier,
der sich auf einen anderen bezieht. Übergeben Sie die Nummern als `--source-col` und `--target-col`
(`champollion data add <file> --source-col <number> --target-col <number>`);
das Sidecar erfasst die Nummern (`x-import.elan_tiers`). Eine Nummer oder ID,
die keinen Tier benennt, wird abgelehnt (`no such tier — … Name a tier by its number`), und
ebenso ein Tier, dessen erfasste Sprache nicht die dieser Seite ist. Zwei Tiers werden nur dann
gepaart, wenn sich einer auf den anderen bezieht oder sie dieselben Zeitfenster teilen – niemals durch
bloßes Raten. **Hinweis.** Die ID eines Tiers ist das, was die erstellende Person der Datei eingegeben hat, und ist
oft der Name einer Person, daher gibt `data add` sie niemals aus. Die Person kann selbst eine
exakte ID eingeben; Sie übergeben die Nummer.
LIFT-Dateien werden anhand ihrer Sprachcodes zugeordnet, Toolbox-Dateien anhand ihrer MDF-Marker
(`\ge` und `\xe` sind laut Standard Englisch).

## Übertragungsmodi

Jede Evaluierung löst ihr Korpus in einen Modus auf, bevor irgendetwas gesendet wird
(`arena/mt_eval_harness/transmission_policy.py`), und erfasst diesen im
Ausführungsprotokoll:

| Modus | Wann | Entfernte Modelle |
|---|---|---|
| `cleared` | Eine für die Weiterverbreitung freigegebene Lizenz | Erlaubt |
| `no-train` | Eine standardmäßige Creative-Commons-Lizenz (nicht-kommerziell oder keine Bearbeitung); oder ein nicht registriertes Korpus, das keine Lizenz deklariert | Nur über Kanäle, die nicht mit Eingaben trainieren: OpenRouter fixiert auf `data_collection: deny`, Erstanbieter-APIs oder lokal. Eine Nicht-Trainings-Garantie, keine Garantie gegen Datenspeicherung |
| `consent-required` | Eine modifizierte, maßgeschneiderte oder nicht angegebene Lizenz (`LicenseRef-*`) | Abgelehnt, bis der Eintrag des Datensatzes eine `transmission_consent`-Erteilung festhält (`granted_by`, `date`, `scope`, `evidence`); lokal funktioniert weiterhin |
| `sealed` | Ein zurückgehaltenes oder Gold-Standard-Segment, ein unter Quarantäne gestellter Datensatz oder die Rein-lokal-Markierung einer verwaltenden Person | Abgelehnt, ohne Möglichkeit zur Außerkraftsetzung |

- **Sperre.** Der Text eines Korpus unter `consent-required` oder `sealed` wird auch vom
  Terminal zurückgehalten.
- Bei einer externen Methode (einem Plugin) auf einem `no-train`-Korpus wird gewarnt, sie wird nicht
  abgelehnt: Der Testrahmen kann den Kanal des Plugins nicht einsehen. Bei `consent-required`-
  und `sealed`-Korpora wird sie abgelehnt, es sei denn, `--attest-local-transport` ist gesetzt.
- **Sperre.** Der lokale Anbieter zählt nur dann als lokal, wenn sein Endpunkt eine
  Loopback-Adresse ist (`localhost`, `127.0.0.1`, `::1`, ein Unix-Socket) – niemals
  aufgrund seines Namens.
- **Hinweis.** Erfassen Sie niemals eine `transmission_consent`-Freigabe und interpretieren Sie niemals eine
  Lizenz im Namen der rechteinhabenden Person. Eine Freigabe wird von der verwaltenden Person des Datensatzes
  eingetragen, sobald die rechteinhabende Person sie erteilt.
- **Hinweis.** `--allow-data-collection` hebt die Nicht-Trainings-Fixierung nur für ein
  nicht registriertes Korpus auf, das keine Lizenz deklariert; es sichert zu, dass die aufrufende Person
  die Rechte hält. Übergeben Sie dies nur, wenn die Person bestätigt, dass sie die Rechte besitzt.

## Registrierungsstufen

Die Registrierung eines Korpus ist optional: Die Schienen benötigen sie nie. Sie schreibt eine
Metadaten-Karte, damit das Korpus benannt, verglichen und, falls seine haltenden Personen dies wünschen,
aufgelistet werden kann. `champollion network register-corpus` ist interaktiv am Terminal
und über Flags skriptfähig (`--tier`, `--data`, `--license`, `--name`, …).
**Hinweis.** Die Stufe ist, wie jede Bedingung, die Entscheidung der haltenden Personen.

| Stufe | Die Karte | Der Text | Was abgelehnt wird |
|---|---|---|---|
| `local-only` (Standard) | Wird neben der Datei `--data` (oder `--out` oder hier) geschrieben, niemals in den geteilten Kartenordner | Verlässt diesen Rechner niemals; das Sidecar erhält `transmission: local-only` | — |
| `private` | Metadaten mit `quarantine: true`; bei einer npm-Installation bleibt sie lokal, und die Auflistung ist eine separate Anfrage (`champollion network submit --type dataset`) | Wird niemals hochgeladen; keine Übertragungsmarkierung – seine Lizenz bestimmt den Modus | — |
| `public` | Metadaten plus ein Zeiger zum Abruf von der Quelle (`--repo-url`, `--builder`) | Wird niemals gehostet: wird von der Quelle bezogen | Eine nicht-kommerzielle, keine Bearbeitung erlaubende, eingeschränkte oder unbestätigte Lizenz (*„Registrieren Sie stattdessen privat oder rein lokal.“*); `--data` |
| `sealed` | Metadaten mit `quarantine: true` und einem versiegelten Block (`--seal-input`, `--threshold-pubkey`, `--custodian-group`, `--qualifier-id`) | Es existiert nur Geheimtext, geschrieben nach `<id>.sealed.json` oder `--seal-out` | Eine Datei, die eine Byte-Kopie eines öffentlichen Korpus ist; `--data` |

In jeder Stufe wird bei der Registrierung nichts hochgeladen (`--json` besagt
`uploadedContent: false`). Der einzige Netzwerkaufruf, aus einer npm-Installation, vergleicht
den sha256-Wert der Datei mit dem des öffentlichen Katalogs auf diesem Rechner (der Hash verlässt
den Rechner nie); mit `CHAMPOLLION_OFFLINE=1` vermerkt die Karte, dass der Vergleich nicht
durchgeführt wurde. Bei `--data` erfasst das Sidecar `id`, `name`, `license`, `tier`,
`sha256`, `rows`, `card` und `registeredAt`. **Sperre.** Eine registrierte ID wird
niemals neu abgeleitet: Die erneute Registrierung der Datei unter einer anderen ID wird verweigert, und
eine geänderte Datei (anderer sha256) erhält nicht mehr die ID oder Einstufung der Karte.

## Ausgaben sind abgeleitete Werke

Die Ausgabe eines Modells über eingeschränkten Sätzen ist ein abgeleitetes Werk derselben, und eine
Evaluierung erzeugt solche Ausgaben in großem Umfang. Die Werkzeuge behandeln Ausgaben genauso wie
ihre Eingaben:

- Für jedes Korpus, das nicht `cleared` ist, erfasst und gibt der Durchlauf einen Hinweis aus:
  Seine Vorhersagen sind maschinell abgeleitete Werke eingeschränkter Sätze, die nicht
  weiterverbreitet werden dürfen.
- Wo der Text zurückgehalten wird (rein lokal, versiegelt, zustimmungspflichtig), erhält jede
  daraus erstellte Datei – Ausführungsprotokolle, Berichte, Vergleiche, Cache-Einträge,
  `mt-eval translate`-Ausgaben, Forges geteilte Seiten, bereinigte Korpora und
  Hypothesen – ein set/1-Sidecar, das die Markierung trägt (`derived_from`,
  `written_by`). Ein `no-train`-Korpus erhält den Hinweis, aber kein Sidecar.
- Ein auf rein lokalem Text trainiertes Modell schreibt ebenfalls rein lokale Ausgaben (siehe oben).
- `mt-eval publish` lädt niemals die Sätze eines rein lokalen Korpus hoch, selbst mit
  `--publish-entries`, und veröffentlicht bei einem solchen Korpus einen gecoachten Prompt standardmäßig
  nur als dessen Hash. Bei anderen Korpora wird der Prompt veröffentlicht, es sei denn,
  `--redact-coaching` ist gesetzt.

**Hinweis.** Das Veröffentlichen ist die Entscheidung der Menschen, getroffen in ihren eigenen Worten, nachdem ihnen
zuvor die Vorschau (`--dry-run`) gezeigt wurde. Veröffentlichen, fügen oder versenden Sie die Ausgaben eines Durchlaufs
niemals im Namen der Menschen.

## Weiterführende Informationen

- [Der Betriebsvertrag](/docs/agents/contract) §1 und §3.
- [Ihre Worte, Ihre Regeln](/docs/your-words-your-rules) – die Fassung für die Menschen.
- [Korpora registrieren](/docs/network/sovereignty/registering-corpora) – die
  Stufen mit jedem Flag.
- [Bereitstellung und Einsatz](/docs/agents/serving) – rein lokale Ausgabe in
  der Praxis.
- [Datensouveränität in einfachen Worten](/docs/learn/data-sovereignty).
