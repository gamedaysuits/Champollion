---
sidebar_position: 9
title: "Einen souveränen Wettbewerb durchführen"
slug: /network/sovereignty/run-a-sovereign-contest
description: "Der Self-Service-Weg von Anfang bis Ende, mit dem eine Gemeinschaft oder Organisation einen MT-Wettbewerb gegen ihren eigenen versiegelten, zurückgehaltenen Korpus durchführen kann — ohne dass Champollion jemals die Daten oder das Preisgeld verwaltet."
related:
  - label: "Registering Corpora & Exposure Lanes"
    to: /docs/network/sovereignty/registering-corpora
    kind: doc
    note: "The registration lane this path builds on"
  - label: "Data Stewardship"
    to: /docs/network/sovereignty/data-sovereignty
    kind: doc
  - label: "Terms Templates"
    to: /docs/network/sovereignty/terms-templates
    kind: doc
    note: "Adaptable terms ideas, including trojan-horse risks"
  - label: "Prize Specification"
    to: /docs/network/specifications/prizes
    kind: spec
---

# Führen Sie einen souveränen Wettbewerb durch

> **Zusammenfassung.** Eine Gemeinschaft oder Organisation kann einen
> Evaluierungswettbewerb — einschließlich eines gesponserten Preises — gegen
> einen zurückgehaltenen Testkorpus durchführen, der **niemals ihre eigene
> Infrastruktur verlässt**. Sie erstellen den Korpus, verschlüsseln ihn,
> hosten ihn und behalten die Schlüssel; das Netzwerk registriert lediglich
> eine inhaltsfreie Metadatenkarte und einen Chiffretext-Digest. Methoden
> qualifizieren sich zunächst auf öffentlichen Korpora; jeder Durchlauf gegen
> Ihren versiegelten Datensatz erfordert die Autorisierung Ihrer Verwalter;
> nur **Scores** kommen jemals heraus. Preisgelder werden **vom Sponsor
> gehalten** — von Ihrer Organisation oder einem von Ihnen benannten Treuhänder —
> und **Champollion berührt weder das Geld noch die Daten.** Diese Seite ist
> das durchgängige Self-Service-Handbuch.

:::warning[Was heute live ist vs. in Entwicklung]
Seien Sie sich vor dem Start im Klaren — dies ist ein sich entwickelndes,
nicht-kommerzielles Forschungsprojekt, und es ist uns lieber, wenn Sie uns
überprüfen, als wenn Sie uns vertrauen:

- ✅ **Live:** Korpusregistrierung (Metadaten-Karten, Hash-Pinning, Freigabepfade), das Register versiegelter Sets (Digest + Treuhändergruppe + Qualifier, kein Inhalt), die Wettbewerbsmaschinerie mit dem versiegelten Pfad, die Datenschicht für Autorisierungsanfragen/-erteilungen/-prüfungen (ausstehend → M-von-N-Entscheidung → zeitlich befristete Einmalerteilung, anfügungsgeschütztes hash-verkettetes Audit-Protokoll) und die auf Datenbankebene erzwungene reine Ausgabe von Punktwerten.
- ✅ **Live: Der Scoring-Knoten des Veranstalters.** Ein einziger Befehl teilt Ihr Korpus in ein öffentliches Dev-Set (auf dem Teilnehmende sich selbst bewerten, um sich zu qualifizieren) und ein versiegeltes Geheim-Set auf, gegen das Ihr Knoten Einreichungen ausführt, und versiegelt die geheime Hälfte im Ruhezustand auf IHREM Rechner (`mt-eval contest prepare`). Die Registrierung der versiegelten Sets, des Qualifiers und des Wettbewerbs erfolgt **per Self-Service über Ihre eigene Anmeldung** – `contest prepare --self-serve` oder `mt-eval contest register --manifest` für einen zuvor vorbereiteten Wettbewerb – wobei jede Zeile auf Datenbankebene an eine Identität gebunden ist; kein Kurator greift ein und kein privilegierter Schlüssel wird benötigt (siehe Schritt 4 für die ehrlichen Grenzen).
- ✅ **Live: Einreichungen sind METHODEN, keine Übersetzungen.** Die Teilnahme an einem Wettbewerb erfolgt, indem Sie Ihrem Knoten etwas übergeben, das er AUSFÜHREN kann. Ein Teilnehmer bewertet das öffentliche Dev-Set selbst (`mt-eval contest qualify`), um einen Beleg zu erhalten, und reicht dann ein Modell oder eine Methode ein; Ihr Knoten führt die Bewertung dieses Belegs auf seiner eigenen Kopie des Dev-Sets erneut aus, bevor ein Treuhänder um eine Genehmigung gebeten wird, und lehnt bei einer Abweichung ab. Der Knoten wählt den Pfad anhand der Einreichung:
  - **Pfad A – deklaratives Modell (bevorzugt).** Ein standardmäßiges neuronales Modell besteht aus DATEN: `mt-eval contest submit-model` sendet Safetensors-Gewichte + einen deklarativen Tokenizer + eine Konfiguration – **keinen Code, kein Dockerfile.** Ihr Knoten überprüft, ob es codefrei ist (Safetensors, kein Pickle; kein `trust_remote_code`/`auto_map`; reine Datendateien) und führt die Gewichte in seiner EIGENEN vertrauenswürdigen Engine aus (`transformers`, `trust_remote_code=False`, offline). Die Architektur ist standardmäßig freizügig (jede, die Ihre Engine nativ lädt); ein vorsichtiger Host kann eine Zulassungsliste festlegen. Es wird nichts Nicht-Vertrauenswürdiges ausgeführt, daher muss auch nichts isoliert werden. Veröffentlicht `declarative-model`, Methodenidentität **konstruktionsbedingt codefrei**.
  - **Pfad B – ausführbares Paket (Sandbox-Fallback).** Für Methoden, die TATSÄCHLICH Code sind: `mt-eval contest submit-method` sendet ein Dockerfile + Einstiegspunkt. Nach der Genehmigung durch Ihren Treuhänder führt IHR Knoten dies in einem netzwerkisolierten Container aus (`--network=none` – der Netzwerk-Stack existiert im Inneren nicht; schreibgeschütztes Root-Dateisystem, entzogene Berechtigungen, bereinigte Umgebung), wobei zuvor automatisierte statische Prüfungen stattfinden und Referenzen den Container niemals betreten. Veröffentlicht `method-execution` mit **ausführungsüberprüfter** Identität.
  Für beide Pfade gilt: Der Paket-Hash wird in der Autorisierungsanfrage festgeschrieben (was ausgeführt wird, entspricht nachweisbar dem, was vorgeschlagen wurde), und die Bewertungen werden über denselben Pfad veröffentlicht, der ausschließlich aggregierte Werte ausgibt. Für maximale Isolation kann der Scoring-Rechner über eine echte physische Trennung (Air-Gap) verfügen: Autorisierte Anfragen und Ed25519-signierte Pakete mit reinen Punktwerten werden über Wechselmedien übertragen (`mt-eval node relay` / `import-bundle` / `export-scores`) – der geheime Text erreicht nicht einmal den vernetzten Rechner. Was diese Pfade derzeit NOCH NICHT enthalten: Hardware-Attestierung des Knotens (Identität wird selbst deklariert), formelle Streitbeilegungsmechanismen und – speziell für Pfad B – eine weitergehende Container-Härtung über den entfernten Netzwerk-Stack hinaus (Seccomp-Profile, MicroVMs; dies ist ein Grund, Pfad A zu bevorzugen). Siehe [Ehrliche Einschränkungen](/docs/network/honest-limitations).
- ✅ **Die Zusicherungsebene ist live (07.09.2026).** Einreichungsdeklarationen (primär/kontrastiv, Tracks), Einreichungsphasen, zurückgehaltene Ergebnisse (`hidden_until_close`) und die Festschreibung, die Ihre deklarierten Zusicherungen uneditierbar macht, sobald Einreichungen vorliegen, werden auf dem netzwerkgehosteten Endpunkt in der Datenbank erzwungen. Ein föderierter Host erhält dieselben Regeln, indem er die mit dem Harness mitgelieferte Migration anwendet; bei einem älteren Endpunkt fällt das Harness auf das Basisset zurück und weist explizit darauf hin (`declarations_available: false`), anstatt etwas vorzutäuschen. Wenn in einem der folgenden Schritte steht, dass *die Datenbank festschreibt / zurückhält*, dann ist das wörtlich gemeint.
- 🔲 **In Entwicklung: Schwellenwert-Signierung (Threshold Signing).** Bei einem mit `champollion seal-corpus` versiegelten Set wird die M-von-N-Treuhändergenehmigung in den Autorisierungs- und Audit-Tabellen *erfasst*, und der Versiegelungsschlüssel ist ein gekennzeichneter Stellvertreter für ein einzelnes Schlüsselpaar (`champollion seal-corpus keygen`). Ein auf dem Offline-Knoten versiegeltes Set (`mt-eval node seal`) verwendet die integrierte **Schlüsselzeremonie** des Knotens (`mt-eval node ceremony`): Der Set-Schlüssel wird nach einem M-von-N-Verfahren aufgeteilt und nur während eines quorum-autorisierten Laufs im Arbeitsspeicher wieder zusammengesetzt. Diese Zeremonie wurde noch nie mit einem echten Treuhänder durchgeführt, und ihre Schlüsselanteile liegen in Version 1 als einfache Dateien vor. Keiner der beiden Pfade verfügt über eine Schwellenwert-*Signierung*: Die Signatur des Air-Gap-Punktwert-Pakets stammt von einem einzelnen Knotenschlüssel (`seal-corpus sign-keygen`).
- ❌ **Konstruktionsbedingt nicht vorgesehen:** Dass Champollion Ihr Korpus hostet, Ihre Schlüssel verwahrt oder Preisgelder verwaltet. Das Paket eines Teilnehmers (sein eigenes Modell oder sein Code) passiert unseren Speicher auf dem Weg zu Ihrem Knoten; die Inhalte Ihres Korpus tun dies zu keinem Zeitpunkt.
- ❌ **Gelöscht statt als Falle belassen.** `contest submit-hypotheses` (eingestellt am 06.09.2026) lud Übersetzungen eines quelloffenen Blind-Sets hoch; `contest submit` (eingestellt am 06.09.2026) verlinkte einen selbst veröffentlichten Punktwert. Beides ist kein Weg mehr zur Wettbewerbsteilnahme. Eine quelloffene Blind-Runde existiert nur noch als optionale Diagnosemöglichkeit für Veranstalter, und selbst gemeldete Werte gehören weiterhin auf die offene Bestenliste – eine öffentliche Tafel, indexiert nach Korpus und Sprachpaar-Richtung, nicht nach Wettbewerb.

Wenn ein Schritt unten von etwas aus der 🔲-Liste abhängt, wird dies im Schritt
angegeben.
:::

---

## Die Gestalt der Vereinbarung

| Wer | Hält | Hält niemals |
|-----|-------|-------------|
| **Sie (Gemeinschaft/Organisation)** | Den Korpus, die Verschlüsselungsschlüssel (über Ihre Verwalter), die Preisgelder, die Vergabeentscheidung | — |
| **Champollion / das Netzwerk** | Eine Metadatenkarte, einen Chiffretext-Digest, den Autorisierungs- + Audit-Datensatz, die veröffentlichten Scores | Ihre Korpusinhalte, Ihre Schlüssel, Ihr Geld |
| **Methodenentwickler** | Ihre Methode | Ihre Testdaten — sie sehen Scores, niemals Sätze |

Alles Folgende ist die mechanische Erweiterung dieser Tabelle.

---

## Voraussetzungen für Organisatoren

Bevor Sie mit Schritt 1 beginnen, sollten Sie wissen, was der Betrieb der Node-Seite tatsächlich erfordert:

- **Das Harness mit seinem Node-Extra:**
  `python3 -m pip install 'mt-eval-harness[node]'` (0.2.0 oder neuer; verwenden Sie
  `python3 -m pip`, was in jeder Umgebung funktioniert, in der das Harness läuft –
  ein bloßes `pip` befindet sich nicht in jeder virtuellen Umgebung im `PATH`). Das Extra `[node]`
  ergänzt die Bibliothek `cryptography`, die von `mt-eval node keygen`,
  der Treuhänder-Zeremonie und der Signierung von Score-Manifesten verwendet wird. Ein einfaches
  `python3 -m pip install mt-eval-harness` enthält sie nicht, und diese Befehle brechen ab und nennen
  diese Installation.
- **docker oder podman** – erforderlich für den Methoden-Ausführungspfad. Der Knoten
  erkennt docker automatisch, danach podman (`sandbox.runtime` in `node.json` ist standardmäßig
  `null`; tragen Sie dort eines ein, um es verbindlich vorzuschreiben). Befindet sich keines von beiden im `PATH`,
  verweigert `mt-eval node run-method` die Ausführung mit einer Zeile, die beide nennt, bevor irgendetwas
  ausgeführt wird, und die Anfrage bleibt unverändert, damit Sie sie ausführen können, sobald eine
  Laufzeitumgebung installiert ist. Es gibt **keinen Fallback**. Die Container-Isolation mit
  `--network=none` ist die tragende Garantie, daher wird ohne eine Container-Laufzeitumgebung
  nichts ausgeführt.
- **Node.js 20.11+ und die npm-CLI `champollion`** – das Harness implementiert die
  Verschlüsselung zur Versiegelung nicht neu. `champollion seal-corpus` (Befehle: `keygen`,
  `seal`, `open`, `sign-keygen`, `sign`, `verify`) ist die einzige
  Chiffren-Implementierung (X25519-ECDH → HKDF-SHA256 → AES-256-GCM), und der Knoten des
  Veranstalters greift per Shell darauf zu.
- **Eine Knotenkonfiguration unter `~/.mt-eval/node.json`.** Jeder `mt-eval node`-Befehl
  verweigert den Start ohne eine solche Datei. `mt-eval node init` schreibt eine Starter-Konfiguration
  dorthin (`--print` zeigt sie stattdessen an). Sie enthält Ihre selbst deklarierte `node_id`
  (eingebunden in jeden Anfrage-Fingerabdruck) und eine `contests`-Zuordnung, die auf Ihr
  Dev-Set, Ihr versiegeltes Set (`secret_set_id` + `secret_artifact`), Ihr versiegeltes
  Holdout-Set, falls Sie eines vorbereitet haben (`holdout_set_id` + `holdout_corpus`; löschen
  Sie beide Schlüssel, falls nicht), und das öffentliche Qualifikations-Gate (`qualifier` +
  `dev_corpus`, den Schwellenwert auf der Qualifier-Skala von 0–100) verweist. Sobald Sie
  `contest prepare` (Schritt 1) ausgeführt haben, schreibt `mt-eval node init --from-contest ./mytask`
  die Starter-Konfiguration, wobei die Werte des Wettbewerbs bereits aus
  `./mytask/local/manifest.json` ausgefüllt sind, und listet auf, was noch für Sie zu tun bleibt. Die
  Zuordnung, die angewendet wird (tragen Sie die Werte manuell ein, falls Sie dies bevorzugen):

  | `local/manifest.json` | `node.json` (unter `contests.<contest-id>`) |
  |---|---|
  | `contest.language_pair` | `language_pair` |
  | `secret.sealed_set_id` | `secret_set_id` |
  | `secret.corpus_sealed_artifact` | `secret_artifact` |
  | `holdout.sealed_set_id` / `holdout.corpus_sealed_artifact` | `holdout_set_id` / `holdout_corpus` (beide entfernt, wenn kein Holdout vorhanden ist) |
  | `qualifier.corpus_file` | `dev_corpus` |
  | `qualifier.qualifier_id`, `corpus_card_id`, `threshold`, `metric`, `year` | `qualifier.*` (dieselben Namen) |
  | `test_suites[].suite_id` / `sha256`, `test_suite_local_copies` | `test_suites[].suite_id` / `corpus_sha256` / `corpus_path`: die von `contest prepare` gelesene Kopie (`--test-suite <id>=<path>` oder eine gefundene), wenn sie sich auf diesem Rechner mit den gepinnten Bytes befindet; andernfalls legen Sie `corpus_path` fest |
  | `secret.sealed_block.keyScheme` | `custody`: `single-key` für ein Set, das mit einem einzelnen Schlüsselpaar versiegelt ist (legen Sie dann `secret_privkey` fest), `threshold-quorum` für eine Zeremonie |
  | `registration.prize_terms` (erfasst durch `contest prepare` und `contest register`) | `prize_terms_sha256`: der SHA-256-Wert der Bedingungen, der Hash, den Teilnehmende an `--accept-terms` übergeben (wird weggelassen, wenn der Wettbewerb keinen Preis deklariert) |

  Die Wettbewerbs-ID ist die `--slug`, die Sie `contest prepare` übergeben haben (`mytask` im
  folgenden Beispiel). Der Vorbereitungsschritt erfasst sie im Manifest, die Registrierung erstellt
  den Wettbewerb darunter, und es ist die ID, die Teilnehmende an `contest qualify`
  und `submit-method` übergeben; kündigen Sie sie daher mit dem Dev-Release an; `--contest-id`
  überschreibt sie. (Ein Manifest, das geschrieben wurde, bevor die ID erfasst wurde, behält die ID,
  die die Registrierung aus seinem Namen abgeleitet hat, `"My Task 2026"` → `my-task-2026`,
  da dessen Wettbewerb, Belege und Knotenkonfigurationen diese bereits verwenden.) Kein
  Manifest kennt `node_id`, `cards_dir`, `signing_key` oder Ihre private
  Schlüsseldatei, sodass diese als `<...>` zum Ausfüllen verbleiben.
  `mt-eval node ledger verify` überprüft die Konfiguration anschließend und gibt an, was geprüft wurde: Es
  lädt die Konfiguration (Treuhänderschaft, das gesamte Qualifikations-Gate, das Holdout-Paar, den
  lokalen Kartenindex), verweigert den Start beim ersten Wert, der noch ein `<...>`-Platzhalter
  oder eine deklarierte Datei ist, die sich nicht auf diesem Rechner befindet, gibt die Sets und Dateien
  jedes Wettbewerbs aus und spielt erst danach die Hash-Kette des Autorisierungs-Ledgers ab
  (null Einträge auf einem neuen Knoten).
- **Ein lokaler Sprachkarten-Index, den der Knoten mitführt.** Das Scoring benennt das
  Sprachpaar des Laufs, und der Knoten schlägt Sprachen niemals über das Netzwerk nach.
  Verweisen Sie mit `cards_dir` in `node.json` auf ein Verzeichnis, das eine Karte für jede
  Sprache enthält, die Ihr Knoten bewertet (oder setzen Sie `MT_EVAL_CARDS_DIR`); ein Knoten ohne lokalen
  Index verweigert den Start, anstatt einen herunterzuladen. Keines der installierten
  Pakete enthält ein sprachspezifisches Kartenverzeichnis; erstellen Sie daher eines auf einem vernetzten
  Rechner mit der CLI `champollion`, eine Datei `<code>.json` pro Sprache
  Ihres Paars:

  ```bash
  mkdir -p node-cards
  champollion network card eng --json > node-cards/eng.json
  champollion network card crk --json > node-cards/crk.json
  ```

  Setzen Sie dann `"cards_dir"` auf den absoluten Pfad dieses Verzeichnisses. Übertragen Sie es
  bei einem physisch getrennten Knoten (Air-Gap) im Offline-Paket
  (`mt-eval node bundle --out <dir> --include node-cards`); es landet unter
  `<dir>/artifacts/node-cards`, und `cards_dir` verweist auf dem Knoten dorthin.
- **Eine Anmeldung.** Es gibt keinen separaten Schritt zur Kontoerstellung: Der erste Befehl,
  der eine Identität benötigt (z. B. `mt-eval contest prepare --self-serve` oder
  `mt-eval publish`), öffnet eine Browser-OAuth-Anmeldung über **GitHub oder Google**
  (Supabase Auth). Die E-Mail-Adresse dieses Kontos ist die Identität, an die jede Zeile im Register
  gebunden ist – verwenden Sie eine, die Ihrer Organisation untersteht.
- **Die Einreichungsdrosselung.** Teilnehmer-Einreichungen sind pro
  Einreicher standardmäßig auf **5 pro 24 Stunden begrenzt** (Schutz vor systematischem Sondieren; konfigurierbar pro Wettbewerb
  mit `--intake-daily-limit` bei der Vorbereitung oder als Standardwert
  einer Shared-Task-Edition). Planen Sie Ihren Wettbewerbszeitplan entsprechend ein.

**Ein ehrlicher Hinweis zur Self-Service-Registrierung.** Auf dem **standardmäßigen
netzwerkgehosteten Endpunkt** stoppt die Self-Service-Registrierung (`contest prepare
--self-serve` / `contest register`) derzeit an einer Schutzsperre des Produktionsendpunkts:
Die CLI verweigert den Vorgang mit einer expliziten Meldung, anstatt in das
Produktionsprojekt zu schreiben, bis eine Richtlinienentscheidung über die Freigabe dieses Zugangs getroffen wurde. Föderierte
Hosts (Ihr eigenes Supabase-Projekt) sind davon nicht betroffen. Wenn Sie auf dem Standard-Host auf diese Sperre stoßen,
entspricht dies dem aktuellen Stand und ist keine
Fehlkonfiguration Ihrerseits – [eröffnen Sie ein Issue](https://github.com/gamedaysuits/Champollion/issues),
und wir begleiten Sie durch die Registrierung.

---

## Schritt 1 — Erstellen Sie Ihren zurückgehaltenen Testkorpus

Entwerfen Sie den Korpus, gegen den Sie messen werden, und halten Sie ihn vom
ersten Tag an zurück: nichts darin sollte jemals veröffentlicht, gepostet oder
mit einem Modellanbieter geteilt worden sein.

- Folgen Sie dem [Framework für Korpusdesign](/docs/network/specifications/corpus-design)
  für die Struktur der Einträge, Schwierigkeitsstufen und Registerabdeckung
  sowie dem [Kochbuch zur Korpuserstellung](/docs/network/tutorials/corpus-creation)
  für das Werkzeug.
- Lassen Sie die Einträge vor der Versiegelung von fließend sprechenden
  Personen prüfen — das
  [Protokoll zur Sprecher-Validierung](/docs/network/specifications/speaker-validation)
  beschreibt eine Prüfstruktur, die Sie für die Korpus-Qualitätssicherung
  wiederverwenden können, nicht nur für die Methodenprüfung.
- Legen Sie das **Versions**-Label des Korpus jetzt fest (z. B. `v1`).
  Autorisierungserteilungen sind an eine bestimmte Version gebunden, daher ist
  die Versionierung Teil des Sicherheitsmodells, keine Buchhaltung.

### Wie das Korpus aufgeteilt wird

Ein einziger Befehl nimmt Ihr Master-Korpus und erzeugt jede Stufe deterministisch
aus einem Seed, den Sie wählen und dokumentieren:

```bash
mt-eval contest prepare --corpus master.json --slug mytask --name "My Task 2026" \
    --pair 'eng>crk' --seed 20260906 --qualifier-threshold 35 \
    --dev-size 400 --secret-size 500 --sealed-holdout-size 250 \
    --test-suite <a public corpus card id> \
    --license <the licence the rights-holder grants> \
    --custodian-group <opaque id> --threshold-pubkey ./contest.pub.json \
    --out ./mytask
```

`--qualifier-threshold` ist der Punktwert, den eine Methode auf dem öffentlichen Dev-Set
erreichen muss, bevor Ihr Knoten sie auf dem versiegelten Set und dem versiegelten Holdout ausführt. Er
liegt auf der **Qualifier-Skala von 0–100**: Der Qualifikationswert ist **Korpus-chrF++**
(sacreBLEU chrF, `word_order=2`) der Dev-Ausgaben im Vergleich zu den freigegebenen Dev-Referenzen –
die Hauptmetrik des Bewertungsstandards und dieselbe Zahl, die eine
`mt-eval run`-Karte als Überschrift für dieselben Ausgaben ausweist. Es wird nichts anderes
hineingerechnet; exakte Übereinstimmungen (Exact Match) werden daneben rein zur Diagnose angezeigt und fungieren nie als Gate. Ihr
Knoten berechnet dieselbe Zahl, wenn er eine Methode erneut ausführt, sodass der Beleg eines
Teilnehmers und die Messung Ihres Knotens vergleichbar sind.

Legen Sie den Schwellenwert anhand von chrF++-Werten fest, die Sie auf diesem Dev-Set gemessen haben (führen Sie
`contest qualify` auf den Dev-Ausgaben einer Baseline aus), nicht anhand von Werten auf anderen
Evaluierungssets: Das chrF++-Niveau unterscheidet sich zwischen Sprachen und Korpora erheblich.
Ein Qualifier, der vor dem
[Bewertungsstandard](/docs/network/specifications/scoring#how-runs-are-scored)
mit dem inzwischen eingestellten Verbundwert als Metrik registriert wurde, funktioniert weiterhin: Sein Schwellenwert wird
auf der chrF++-Skala gelesen, und qualify weist jedes Mal darauf hin; bestätigen Sie daher den Wert oder
wechseln Sie zu einem neuen Qualifier.

`--license` ist erforderlich. Es benennt die Lizenz, unter der das freigegebene Dev-Set angeboten
wird, und mt-eval wählt niemals eigenmächtig eine für Sie aus. Die freigegebene Datei trägt sie als
`dataset.license`, was von `mt-eval run`, `contest qualify` und
`publish` gelesen wird, sodass die Läufe eines Teilnehmers an Ihre Lizenz gebunden sind. Verwenden Sie die Freigabe des Rechteinhabers
als SPDX-ID. Mit `CC-BY-4.0` dürfen Teilnehmende die Evaluierung mit beliebigen Modelldiensten durchführen.
Bei einer nicht-kommerziellen Lizenz wie `CC-BY-NC-4.0` laufen Remote-Modelle ausschließlich
über trainingsfreie Kanäle. Mit eigenen Bedingungen (`LicenseRef-<name>`) wird die
Remote-Evaluierung verweigert, bis die Erlaubnis des Rechteinhabers vorliegt, sodass
Teilnehmende lokale Modelle verwenden müssen.

Die freigegebenen Dateien geben auch die sonstigen Bedingungen des Masters an, gelesen aus der
eigenen Karte des Masters (der Korpuskarte, die `champollion network register-corpus`
über ihr `<file>.champollion.json`-Sidecar geschrieben hat) und ihrem eigenen Umschlag:
`dataset.do_not_train` und, wenn der Master als rein lokal markiert ist,
`dataset.transmission: "local-only"` (Teilnehmende dürfen das Dev-Set dann nur
mit einem Modell auf ihrem eigenen Rechner ausführen), wobei `dataset.terms_from` angibt,
woher die jeweilige Angabe stammt. Wenn die Karte des Masters keine Trainingsbedingung nennt, übergeben Sie
`--do-not-train true` oder `false`; das Flag kann die Bedingungen des Masters verschärfen,
niemals lockern (`--do-not-train false` bei einem Master mit `doNotTrain: true` wird
abgelehnt). prepare gibt diese Bedingungen aus und warnt, wenn die Karte des Masters besagt, dass eine
Weiterverbreitung untersagt ist: Die Veröffentlichung von `public/` stellt eine Weiterverbreitung dar; veröffentlichen
Sie es daher erst, wenn der Rechteinhaber zustimmt.

| Split | Wer ihn sieht | Wofür er da ist |
|-------|---------------|-----------------|
| **Öffentliches Dev-Set** (`--dev-size`) | Alle – Quelle *und* Referenzen werden freigegeben | Der **Qualifier**: Teilnehmende bewerten sich selbst darauf, bevor sie überhaupt etwas einreichen dürfen (Schritt 8) |
| **Versiegeltes Set** (`--secret-size`) | Niemand außer Ihrem Knoten – Quelle *und* Referenzen bleiben verschlüsselt | Das Set, auf dem ein Beitrag tatsächlich bewertet wird |
| **Versiegeltes Holdout** (`--sealed-holdout-size`, optional) | Niemand außer Ihrem Knoten | Ein **zweiter** versiegelter Split, der im selben Lauf bewertet wird, dessen Werte aber zurückgehalten werden, bis Sie den Wettbewerb schließen |
| *Blind-Set* (`--blind-size`, Standard 0) | Quelle freigegeben, Referenzen zurückgehalten | Eine optionale eigene Diagnoserunde für Sie. Es ist **kein** Einreichungsweg: Die Teilnahme erfolgt durch Übergabe einer Methode, niemals durch Hochladen von Übersetzungen |

Die Splits sind disjunkt und reproduzierbar: gleiches Korpus, gleicher Seed, gleicher Split,
für immer. Die Zusammensetzung verbleibt in einem für den Veranstalter lokalen Manifest, das Ihren
Rechner nie verlässt.

**Sich wiederholende Sätze bleiben auf einer Seite.** Der Split ist gruppendisjunkt
(`group-disjoint/1`, festgehalten im `split`-Block des Manifests): Zeilen, die eine
Quelle oder eine Referenz teilen – exakt oder nach Normalisierung von Groß-/Kleinschreibung, Interpunktion und
Leerzeichen –, bilden eine Gruppe, und eine Gruppe landet vollständig in einem Split. Somit wiederholt keine
versiegelte Zeile eine Zeile des freigegebenen Dev-Sets. Die Gruppen werden mit Ihrem
Seed gemischt und in der Reihenfolge Dev, Blind, Secret, Holdout platziert; ein Master ohne
wiederholte Sätze erhält genau die Aufteilung, die ein zeilenweises Mischen ergibt. Reichen ganze
Gruppen nicht aus, um die gewünschten Größen zu füllen, bricht prepare ab – unter Angabe der Anzahl
wiederholter Zeilen und der Lösung: Entfernen Sie die Wiederholungen (behalten Sie eine Zeile pro Gruppe)
oder fordern Sie eine Gesamtzahl unterhalb der Größe des Masters an, damit manche Gruppen ausgelassen werden können.

**`public/` ist freigabefähig; Ausführungsprotokolle gehören nach `runs/`.** prepare schreibt eine Markierungsdatei,
`.champollion-releasable.json`, in `public/`. Ausführungsprotokolle, Berichte und
Übersetzungs-Caches werden dort niemals abgelegt: `mt-eval run` verweigert ein
`--output-dir` oder `--cache-dir` darin und schlägt stattdessen `runs/` daneben
(`<out>/runs/`) vor, und `run_benchmark` des MCP-Servers legt einen Lauf auf
dem freigegebenen Dev-Set (die Baseline, die Sie zum Festlegen des Schwellenwerts ausführen) selbstständig in `runs/`
ab und weist darauf hin. Ein Wettbewerb, der vor der Existenz der Markierung vorbereitet wurde,
wird an seiner Struktur erkannt (`public/` neben `local/manifest.json`).

**Warum ein Holdout?** Auf ein einzelnes versiegeltes Set kann über einen langen
Wettbewerb hinweg dennoch hin optimiert werden – jede Einreichung ist eine Sondierung, und genügend Sondierungen lassen ein wenig durchsickern. Ein zweiter
Split, der im selben autorisierten Lauf bewertet wird, dessen Zahlen aber bis zum
Abschluss niemand sieht, liefert Ihnen am Ende ein sauberes Bild: Verschiebt sich der Rang eines Systems
zwischen beiden Sets, erfahren Sie, wie viel davon Feinabstimmung auf den Testdatensatz und wie viel echte
Übersetzungsleistung war. Beide Sets werden von **einer einzigen** Autorisierung abgedeckt, sodass für Ihre
Treuhänder kein zusätzlicher Zeremonieaufwand entsteht.

**Test-Suites von Drittanbietern.** `--test-suite` benennt ein öffentliches Diagnosekorpus –
von jemand anderem, mit SHA-Pinning und öffentlich herunterladbar –, auf dem jede Einreichung ebenfalls
ausgeführt wird. Diese Zahlen werden **berichtet und niemals in die Rangliste aufgenommen**: Sie dienen dazu, dass
Lesende nachvollziehen können, ob ein starker Wert auf dem versiegelten Set auch auf einem Set Bestand hat, das nicht von Ihrem
Wettbewerb entworfen wurde. Champollion verweigert eine Suite, die unter Quarantäne steht,
nicht gepinnt ist, nicht zu Ihrem Sprachpaar passt oder einer Ihrer eigenen Splits ist.

**Eine versiegelte Zeile, die bereits öffentlich ist, ist nicht versiegelt.** `contest prepare`
vergleicht Ihr versiegeltes Set und Ihr versiegeltes Holdout mit allem, was öffentlich ist: dem freigegebenen
Dev-Set (der oben beschriebene gruppendisjunkte Split hält diesen Wert bei null), der
blinden Quelltextfreigabe, falls vorhanden, und jeder deklarierten Test-Suite. Der Abgleich erfolgt
exakt sowie nach Normalisierung von Groß-/Kleinschreibung, Interpunktion und Leerzeichen (derselbe
Vergleich, nach dem der Split gruppiert), gibt dann jede Überschneidung samt Anzahl aus (zum
Beispiel „30 von 30 Zeilen erscheinen auch in Test-Suite …“) und erfasst die Anzahlen
in `local/manifest.json`. Bei einer Suite von Drittanbietern wird lediglich gewarnt statt
abgebrochen: Die Suite ist der öffentliche Text eines Dritten, und Sie entscheiden, ob Sie
diese Zeilen aus dem Master entfernen oder die Suite weglassen und die Vorbereitung erneut durchführen. Um eine Suite zu prüfen, benötigt prepare deren
Sätze. Es verwendet eine Kopie, die sich bereits auf Ihrem Rechner befindet, und lädt während
der Vorbereitung niemals Dateien herunter. Benennen Sie Ihre Kopie mit `--test-suite <id>=<path>`; ihr
SHA-256-Hash muss mit dem Pin des Registers übereinstimmen. Wird keine Kopie gefunden, weist die Warnung darauf hin,
dass die Suite **nicht geprüft wurde**, niemals, dass sie frei von Überschneidungen war. Das Manifest erfasst
den Pfad jeder von prepare gelesenen Kopie, sodass `node init --from-contest`
Ihren Knoten darauf verweisen kann.

Ihr deklariertes Holdout und die Suites werden zu festen Zusicherungen: Sobald die erste Einreichung eingeht,
schreibt der Wettbewerb sie unveränderlich fest, sodass Sie mitten im Wettbewerb keine Test-Suite hinzufügen oder entfernen können.

## Schritt 2 — Verschlüsseln Sie ihn und hosten Sie ihn auf IHRER Infrastruktur

Verschlüsseln Sie den Korpus bei Ruhe (jedes moderne AEAD-Verfahren — z. B.
`age`/x25519 oder AES-256-GCM) und hosten Sie den **Chiffretext**
irgendwo, das Sie kontrollieren. Champollion empfängt niemals den Klartext
*oder* den Chiffretext.

Veröffentlichen Sie genau ein Artefakt: den **SHA-256-Digest des
Chiffretext-Blobs**.

```bash
shasum -a 256 sealed-corpus-v1.age
# → 3b5f0c…e91a  sealed-corpus-v1.age
```

Der Digest ist öffentlich; die Daten sind es nicht. Jeder kann später
überprüfen, dass der Blob, gegen den evaluiert wurde, byte-identisch mit dem
Blob ist, den Sie versiegelt haben — Integrität ohne Besitz. Dies ist dieselbe
Disziplin von Hash-statt-Kopie wie bei der
[gewöhnlichen Korpusregistrierung](/docs/network/sovereignty/registering-corpora#1-registration-is-metadata-not-content).

## Schritt 3 — Registrieren Sie die Metadatenkarte

Registrieren Sie den Korpus über die standardmäßige, privat-fehlschlagende
[Registrierungsspur](/docs/network/sovereignty/registering-corpora): eine Karte
mit `language_pair`, `license`, `attribution` und `do_not_train` — **keine
Sätze**. Wählen Sie die **private** Expositionsspur; die Registrierung des
versiegelten Datensatzes im nächsten Schritt macht ihn wettbewerbsfähig.

## Schritt 4 — Registrieren Sie ihn als versiegelten Datensatz

Ein versiegelter Datensatz ist ein inhaltsfreier Registereintrag, der drei
Dinge in das öffentliche Register aufnimmt:

| Feld | Wozu es Sie verpflichtet |
|-------|------------------------|
| `ciphertext_digest` | Die genauen Bytes, die als „der Korpus" zählen |
| `custodian_group_id` | Eine undurchsichtige ID für die Gruppe, die den Zugriff kontrolliert (niemals ein öffentlicher Organisations-/Nationsname vor Zustimmung) |
| `current_qualifier_id` | Die öffentliche Runde, die eine Methode bestehen muss, bevor ein versiegelter Durchlauf überhaupt vorgeschlagen werden kann |

Die Registrierung erfolgt **im Self-Service über Ihre eigene Anmeldung** — kein
Kurator ist beteiligt und kein privilegierter Schlüssel:

```bash
# Register a contest you prepared with `mt-eval contest prepare --no-register`
mt-eval contest register --manifest local/manifest.json

# Or do it in one shot at prepare time
mt-eval contest prepare … --self-serve
```

Das Manifest bleibt auf Ihrem Rechner – die Registrierung sendet nur die inhaltsfreien
IDs, Digests und Schwellenwerte. Sie können vor dem Absenden genau einsehen, was übertragen wird:
`contest prepare --no-register` gibt den Registrierungsplan aus,
jede Zeile, die `contest register` schreiben wird, der Reihe nach – die ID jedes versiegelten Sets und
den SHA-256-Wert seines Chiffrats (samt der Information, wie viele Zeilen auf Ihrem Rechner versiegelt bleiben),
die Treuhändergruppe, die Qualifier-ID und den Schwellenwert, die Wettbewerbszeile mit ihren
erfassten Zusicherungen, die Richtlinienspalten sowie etwaige Holdouts, Test-Suites und Preisbedingungen,
die in die Metadaten des Wettbewerbs eingeflossen sind. Der Plan wird von demselben Code erstellt,
der die Zeilen sendet; er kann also nichts anderes beschreiben als das, was tatsächlich übertragen wird.
Jede Zeile im Register ist **an eine Identität gebunden**: Die
Datenbank erfasst das angemeldete Konto, das sie registriert hat, und sperrt diese
Bindung gegen spätere Änderungen, und ein Qualifier darf nur ein versiegeltes Set absichern, das
von **derselben** Identität registriert wurde. Versiegelte Sets stehen anfänglich unter Quarantäne (sie können niemals
einen gewöhnlichen Wettbewerb unterstützen oder auf der öffentlichen Bestenliste gerankt werden), Qualifier starten
in einem sicheren Zustand, und die Registrierung ist ratenbegrenzt – all dies wird durch
Datenbank-Trigger unterhalb jedes Clients erzwungen, einschließlich unseres eigenen. Das Register selbst ist
öffentlich lesbar, sodass Sie überprüfen können, ob Ihr Eintrag genau dem entspricht, was Sie versiegelt haben –
und nichts weiter.

**Ehrliche Grenzen.** Das Self-Service-Verfahren beschränkt sich ausschließlich auf die Registrierung (Insert-only auf
Datenbankebene). **Die Rotation von Qualifiern und die Stilllegung versiegelter Sets bleiben
kuratorengestützt** – eröffnen Sie ein Issue oder kontaktieren Sie das Projekt über
[GitHub](https://github.com/gamedaysuits/Champollion/issues). Und der Betrieb des Scoring-Knotens des
Veranstalters in den späteren Schritten (Vorantreiben des Lebenszyklus, Autorisierungserteilungen, Audit-Operationen)
ist ein separater Pfad mit Dienst-Anmeldedaten auf Ihrem eigenen Knoten –
der Self-Service endet bei den öffentlichen Datensätzen.

## Schritt 5 — Wählen Sie Verwalter und die M-von-N-Regel

Wählen Sie die Personen oder Institutionen aus, die jede Evaluierung gegen Ihren
Korpus gemeinsam genehmigen müssen, und den Schwellenwert (z. B. **3 von 5**).
Verwalter sollten Ihrer Gemeinschaft rechenschaftspflichtig sein, nicht
Champollion — siehe
[Datenverwaltung](/docs/network/sovereignty/data-sovereignty) und
[Eigentum & Bedingungen](/docs/network/sovereignty/ownership-transfer) dafür,
wie gemeinschaftsspezifische Bedingungen festgelegt werden.

**Transparenzhinweis:** Eine Schwellenwert-*Signierung* (eine Berechtigung, die ohne M Signaturen
buchstäblich nicht erzeugt werden kann) befindet sich **in der Entwicklung**. Die Schlüsselzeremonie des Offline-Knotens
(`mt-eval node ceremony`, Shamir M-von-N) ist implementiert, wurde jedoch noch nicht
mit einem echten Treuhänder eingesetzt. Ansonsten wird die M-von-N-Regel als protokollierter
Prozess durchgesetzt: Jede Zugriffsanfrage
wird in eine Warteschlange für **ausstehende** Anfragen eingereiht, Treuhänderentscheidungen werden erfasst, eine Berechtigung wird
nur für eine autorisierte Anfrage ausgestellt, jede Berechtigung ist **für den Einmalgebrauch bestimmt, zeitlich befristet und
an einen spezifischen Fingerabdruck aus (Methode, Korpusversion, Evaluierungsknoten) gebunden**,
und jedes Ereignis – einschließlich blockierter Versuche – landet in einem **anfügungsgeschützten,
hash-verketteten, öffentlich lesbaren Audit-Protokoll**. Die Datenbank verweigert unzulässige Zustandsübergänge
unterhalb jedes Clients und Schlüssels. Was sie derzeit noch nicht abwehren kann, ist eine
Kompromittierung des Plattformbetreibers selbst – genau das soll die Schwellenwert-Signierung
schließen. Bis zu deren Bereitstellung sollten Sie die Aussage „Champollion besitzt null Schlüsselanteile“
als angestrebtes Entwicklungsziel betrachten, nicht als eine Eigenschaft, die Sie heute bereits überprüfen können.

## Schritt 6 — Preis festlegen und Bedingungen deklarieren

Ein Preis ist optional. **Ein Wettbewerb ohne deklarierte Preisbedingungen hat schlichtweg keinen
Preis** – das ist der Standard, und es macht ihn nicht zu einem zweitklassigen Wettbewerb.

Wenn Sie einen Preis ausloben, legen Sie Folgendes fest und veröffentlichen Sie es zusammen mit dem Wettbewerb:

- **Betrag und Währung.**
- **Sponsor** – wer das Geld bereitstellt.
- **Wo die Gelder liegen** – auf dem Konto Ihrer Organisation oder bei einem von Ihnen
  benannten Community-Treuhandfonds. **Champollion verwahrt, treuhändet oder leitet zu keinem Zeitpunkt Preisgelder weiter.**
  Die Offenlegung der Identität des Verwahrers im Vorfeld verleiht dem Preis Glaubwürdigkeit;
  siehe den [Hinweis zum Sponsor-Ausfallrisiko](/docs/network/sovereignty/terms-templates#trojan-horse-risks)
  in den Bedingungsvorlagen.
- **Schwellenwert-Bedingungen** – die Punktewert-Hürde, die eine Methode nehmen muss, formuliert
  gemäß der [Preisspezifikation](/docs/network/specifications/prizes): ein chrF++-Schwellenwert,
  etwaige Diagnose-Gates Ihrer Wahl (wie etwa eine minimale FST-Akzeptanz –
  ein Gate, das eine Einreichung passieren muss, niemals der eigentliche Score), Anforderungen
  an die Sprecher-Validierung, Reproduzierbarkeit. Gestalten Sie die Vergabebedingungen
  anhand der veröffentlichten Punktewerte nachprüfbar, sodass sich niemand auf Ihr Wort
  (oder unseres) verlassen muss, ob die Hürde genommen wurde.
- **Die Preisbedingungen** – was mit der Einreichung selbst geschieht.

### Die Preisbedingung können Sie frei wählen

Die Ausführung ist festgelegt: Bei einem souveränen Wettbewerb übergibt der Teilnehmer Ihnen ein Modell oder eine
Methode, und Ihr Knoten führt sie aus. Was *danach* damit geschieht, liegt in Ihrer Hand,
und es gibt drei Möglichkeiten:

| Bedingung | Was Sie den Teilnehmenden mitteilen |
|---|---|
| `pass_to_holders` — *an Inhaber übergehen* | Die Methode geht an Sie, die Inhaber des souveränen Benchmarks, über. Sie bewerten sie und behalten sie, unabhängig davon, wer gewinnt. |
| `retain_ip` — *IP behalten* | Der Einreichende behält das geistige Eigentum. Sie bewerten den Beitrag und behalten höchstens eine versiegelte Kopie für Prüfzwecke. |
| `release_open` — *offen veröffentlichen* | Der Einreichende behält das geistige Eigentum, muss die Methode jedoch unter einer offenen Lizenz veröffentlichen. Diese Veröffentlichung ist die Auszahlungsbedingung. |

Die Details ergeben sich aus der gewählten Bedingung, es muss also keine Matrix ausgefüllt werden: Was Sie
behalten (`retention`), ob Rechte übertragen werden (`rights`), wofür Sie die Einreichung nutzen dürfen
(`host_use`) und ob der Teilnehmer veröffentlichen muss (`release`), wird alles
aus der von Ihnen gewählten Option **abgeleitet**. Zwei der Optionen erlauben es Ihnen, ein
Feld weiter einzugrenzen:

- unter `retain_ip` vernichtet `--prize-retention delete_after_scoring` das Artefakt nach der Bewertung (standardmäßig wird eine versiegelte Kopie für Prüfzwecke aufbewahrt);
- unter `release_open` verlegt `--prize-release-timing` die Veröffentlichung auf `required_before_scores` oder `required_after_prize` (Standard ist `required_before_prize`), und `--prize-release-license` nennt die Lizenz, anstatt jede OSI-zertifizierte Lizenz zu akzeptieren (`any_osi`).

Die vollständige abgeleitete Tabelle und die Art und Weise, wie jede Option vor einer Auszahlung überprüft wird, finden Sie
in der [Preisspezifikation §2.1, Bedingung 7](/docs/network/specifications/prizes#condition-7-in-detail-the-term-is-one-choice-of-three).

```bash
# The term…
mt-eval contest prepare … --prize-disposition retain_ip

# …with the one narrowing that option offers
mt-eval contest prepare … --prize-disposition retain_ip \
  --prize-retention delete_after_scoring

# …or the same declaration from a JSON file
mt-eval contest prepare … --prize-terms my-terms.json
```

Wofür auch immer Sie sich entscheiden: Die Bedingung wird Ihnen vor dem Speichern im Klartext mit
einem **SHA-256-Hash** ausgegeben. Dieser Hash dient als Akzeptanz-Token:
Ein Teilnehmer übergibt `--accept-terms <hash>`, die Annahme wird in sein
Paket gepackt und durch dessen Inhalts-Hash abgesichert, und Ihr Knoten verweigert Pakete,
die andere Bedingungen akzeptiert haben. Die Bedingung wird in dem Moment festgeschrieben, in dem Ihr Wettbewerb seine erste
Einreichung erhält, sodass niemand an Bedingungen gebunden werden kann, die er nie zu Gesicht bekommen hat.

Finanzielle Aspekte sind bewusst *kein* Bestandteil der Bedingung: Betrag, Währung und
Sponsor sind Wettbewerbsinformationen, und eine Klausel darüber, wer eine Methode besitzt, ist eine
grundlegend andere Aussage als eine Bestimmung darüber, welcher Betrag ausgezahlt wird.

## Schritt 7 — Erstellen Sie den Wettbewerb

Wettbewerbe über versiegelte Datensätze verwenden die explizite **versiegelte
Spur**. Die Teilnahmeberechtigung schlägt sicher fehl: der Wettbewerb wird
verweigert, es sei denn, Ihre Registrierung des versiegelten Datensatzes
existiert und ist aktiv — und die Erstellung des Wettbewerbs gewährt
**niemandem** irgendeinen Zugriff auf den Korpus.

```bash
mt-eval contest create \
  --name "EN→CRK Community Challenge 2026" \
  --corpus sealed-eng-crk-v1 \
  --language-pair "en>crk" \
  --visibility public \
  --use-context non-commercial \
  --prize-disposition retain_ip \
  --results-visibility hidden_until_close \
  --anonymize-until-close \
  --description "Community-custodied held-out set; scores-only; prize held by <your org/trust>."
```

Zwei dieser Flags werden von der Datenbank festgesetzt oder gesperrt, ganz gleich, was Sie
danach tun, und drei weitere sind **Zusicherungen**:

- `--use-context` ist Teil der Identität des Wettbewerbs: Es wird im Moment
  der Registrierung festgelegt und kann nicht mehr geändert werden (erstellen Sie
  stattdessen einen neuen Wettbewerb). Der Standardwert ist `non-commercial`.
- `--primary-metric` (Standard `chrf_plus_plus`), die für das Ranking verwendete Metrik,
  wird gesperrt, sobald der Wettbewerb seine erste Einreichung verzeichnet. Ein neuer Wettbewerb, der das
  eingestellte `composite` angibt, wird unter Angabe des Grundes abgelehnt; Wettbewerbe, die vor dem
  [Bewertungsstandard](/docs/network/specifications/scoring#how-runs-are-scored)
  registriert wurden, funktionieren weiterhin.
- `--visibility` (Standard `public`), `--description` und die Information, ob die Einreichungsphase
  geöffnet ist, werden nicht gesperrt.

Die drei Zusicherungen werden in dem Moment gesperrt, in dem Ihr Wettbewerb seine erste Einreichung erhält:

- `--prize-disposition` / `--prize-terms` – die Bedingung aus Schritt 6. Wenn Sie beide weglassen,
  hat der Wettbewerb keinen Preis.
- `--results-visibility hidden_until_close` – jeder von Ihrem Knoten ermittelte Punktwert
  wird **zurückgehalten**, bis Sie den Wettbewerb schließen, sodass niemand anhand der eigenen
  Ergebnisse gezielt auf das versiegelte Set hin optimieren kann. Dies ist der Standardwert; das Beispiel gibt
  ihn explizit an, damit die Zusicherung in Ihren eigenen Unterlagen sichtbar ist. Übergeben Sie
  `--results-visibility immediate`, wenn Sie stattdessen eine Live-Rangliste wünschen, bei der jede
  Karte veröffentlicht wird, sobald Ihr Knoten sie fertiggestellt hat.
- `--anonymize-until-close` – Teilnehmende erscheinen in Ihrer Rangliste unter stabilen
  Pseudonymen, solange der Wettbewerb läuft. (Dies betrifft Ihre Ranglistenansicht; eine
  Karte wird dadurch nicht anonymisiert, sobald sie auf der offenen Bestenliste veröffentlicht wird.)

Dieselben drei Flags stehen auch bei `contest prepare` und `contest register` zur Verfügung;
hier werden die meisten Veranstalter sie festlegen, da diese Wege den
Wettbewerb für Sie anlegen. Bei `contest prepare --no-register` werden die von Ihnen übergebenen
Registrierungs-Flags (`--results-visibility`, `--anonymize-until-close`,
`--primary-metric`, die Preis-Flags, `--visibility`, `--use-context`,
`--closed-intake`) in `local/manifest.json` festgehalten, und
`contest register --manifest` wendet sie an, sofern Sie keine eigenen Flags übergeben,
wobei darauf hingewiesen wird, wenn ein gespeicherter Wert ersetzt wird. Prepare gibt jede
dieser Bedingungen samt Wert aus – unabhängig davon, ob Sie ihn angegeben haben oder es sich um den Standardwert handelt – und
nennt den Zeitpunkt, ab dem sie nicht mehr änderbar ist, bevor irgendetwas registriert wird. Die Option
`--help` nennt die jeweiligen Standardwerte.

*(Der Wert `--corpus` ist Ihr registrierter `sealed_set_id`. Die versiegelte
Spur wird **automatisch** aus der Registrierung des versiegelten Datensatzes
ausgewählt — kein zusätzliches Flag; ein versiegelter Datensatz kann niemals
einen gewöhnlichen Wettbewerb unterstützen, und ein gewöhnlicher, unter
Quarantäne stehender Datensatz kann niemals irgendeinen Wettbewerb unterstützen.
Beide Regeln werden in der Datenbank durchgesetzt, unter jedem Client. Wenn Sie
in Schritt 4 mit `contest register` oder `prepare --self-serve` registriert haben, existiert
die Wettbewerbszeile **bereits** — überspringen Sie diesen Schritt;
`contest create` von Hand dient nur zum Zusammenstellen eines Wettbewerbs aus
einem bereits registrierten versiegelten Datensatz.)*

## Schritt 8 — Methoden qualifizieren sich zuerst öffentlich

Entwickler erstellen und bewerten ihre Methoden auf dem **öffentlichen Dev-Set**, das Sie in
Schritt 1 freigegeben haben. `current_qualifier_id` Ihres versiegelten Sets verweist auf diese Runde, und eine
Methode muss deren Schwellenwert erreichen, bevor ein versiegelter Lauf überhaupt angefordert werden kann. Dies
hält Sondierungsversuche von Ihrem Korpus fern: Niemand darf auf das versiegelte Set zielen,
bevor nicht öffentlich eine solide Leistung nachgewiesen wurde.

Teilnehmende führen dies selbst offline mit einem einzigen Befehl aus:

```bash
mt-eval contest qualify <contest-id> --dev my-dev-output.txt \
    --dev-corpus <the dev corpus you released> \
    --system "acme-nmt" --method-class pipeline \
    --offline-qualifier-id <qualifier id> --offline-threshold <threshold>
```

Die Qualifier-ID und der Schwellenwert sind die beiden Angaben, die das Scoring von
Ihnen benötigt; veröffentlichen Sie daher beide zusammen mit dem Dev-Release. Bei einem mit `contest
prepare` erstellten Wettbewerb ist die Qualifier-ID die ID des Dev-Korpus selbst (seine
`dataset.corpus_id`), und prepare schreibt den Schwellenwert in die Beschreibung des Dev-Korpus.
Ohne die beiden `--offline-…`-Flags liest qualify sie stattdessen aus der
Wettbewerbsdatenbank aus. Das funktioniert erst, sobald der Wettbewerb auf dem
Endpunkt registriert ist, auf den der Teilnehmer verweist. Fehlt der Wettbewerb dort oder kann die Datenbank
nicht erreicht werden, stoppt qualify und gibt den obigen Offline-Befehl aus, ausgefüllt
mit den Parametern des Teilnehmers.

`--dev` nimmt die Übersetzungen des Dev-Sets zeilenweise in der
Reihenfolge des Korpus entgegen: als JSON mit der Eintrags-ID als Schlüssel oder als das Ausführungsprotokoll, das `mt-eval run
--corpus <the dev corpus>` wrote (or its `_report.json`) erzeugt. Ein Ausführungsprotokoll wird anhand der
Eintrags-ID eingelesen und daraufhin geprüft, ob es sich um einen Lauf auf genau diesem Dev-Korpus handelt; ein Protokoll mit
fehlerhaften Einträgen wird abgelehnt, da jeder Eintrag bewertet werden muss. Die Zusammenfassung besagt dann, dass die
Ausgaben vom Harness in diesem Lauf erzeugt und anhand seiner Datei neu bewertet wurden
(unter Angabe der Kosten jenes Laufs), niemals, dass sie außerhalb des Harness entstanden sind; nur
eine reine Hypothesendatei wird auf diese Weise ausgewiesen.

**Ein Bestehen ist noch keine Einreichung.** Nach dem Ergebnis teilt qualify mit, was es
bereits über die spätere Einreichung sagen kann. Bei einem Lauf eines Methoden-Plugins, dessen Ordner
auf dem Rechner liegt, führt es denselben statischen Scan durch, den auch `submit-method` und Ihr Knoten
ausführen (Netzwerkbibliotheken, Shell-Netzwerktools, unzulässige Dateisystempfade), und
zeigt alles an, was abgewiesen würde – etwa ein Plugin, das `urllib` importiert,
um einen Modellserver anzufragen. Bei einem Lauf über den internen LLM-Pfad des Harness (ein über
einen Provider angebundenes Modell) weist es darauf hin, dass es in dieser Form keine einreichbare Methode gibt:
Der Knoten führt Beiträge ohne Netzwerkzugriff aus, daher muss das Modell im Paket mitgeliefert werden
(siehe *Jedes von Ihrer Methode aufgerufene Modell mitliefern* weiter unten). Andernfalls listet die Erfolgszeile
die Prüfungen auf, die beim Einreichen noch bevorstehen. Nichts davon ändert etwas am
Ergebnis oder am Beleg.

Es gibt den Qualifikationswert (die Hürde) und den Schwellenwert nebeneinander aus,
beide auf der chrF++-Qualifier-Skala von 0–100, gefolgt von der Zusammensetzung des Werts: Korpus-chrF++
mit seiner sacreBLEU-Signatur, den weiteren Standardmetriken daneben
(niemals vermischt), exakten Übereinstimmungen als rein diagnostischem Wert ohne Hürdenfunktion sowie etwaigen
Einschränkungen bei der Bewertung. Qualify veröffentlicht nichts. Ein System, dessen Dev-Ausgaben
überwiegend aus Kopien des Quelltexts bestehen, wird unabhängig vom erreichten Wert abgewiesen:
Wenn die Hälfte oder mehr dem Quelltext entspricht (Groß-/Kleinschreibung, Akzente und Satzzeichen
ignoriert, ausgenommen Zeilen, deren Referenz dem Quelltext entspricht, wie etwa Eigennamen),
übersetzt der Teilnehmer nicht wirklich. Dieselbe Regel greift erneut, wenn
Ihr Knoten die Methode re-exekutiert. Dadurch wird ein **Qualifier-Beleg** auf dessen
Rechner abgelegt, ohne den `submit-model` und `submit-method` das Erstellen einer
Einreichung verweigern. Belege werden pro Wettbewerb und pro System verwaltet (`--system`);
qualifiziert ein Teilnehmer zwei Systeme, bleiben beide erhalten; bei erneuter Qualifizierung desselben
Systems bleibt der frühere Beleg daneben bestehen. `submit-method` und
`submit-model` verwenden den Beleg für `--system` (Standard: der für `--name`,
sonst der einzige Beleg des Wettbewerbs) und brechen mit der Auswahlliste ab, falls dies
mehrdeutig ist. Der Beleg beruht
konstruktionsbedingt auf Selbstauskunft – er stellt also nicht die eigentliche Hürde dar. Bevor eine Autorisierung
in Anspruch genommen wird, **führt Ihr Knoten die eingereichte Methode auf demselben Dev-Set erneut aus** und
vergleicht seine eigene Messung mit den deklarierten Werten; ein Beleg, der die Leistung der Methode übertreibt,
wird an dieser Stelle abgewiesen, wobei die deklarierten und gemessenen Werte im Ablehnungsgrund gegenübergestellt werden.

**Ein Beleg nennt den Lauf, aus dem er stammt.** Handelt es sich bei `--dev` um ein Ausführungsprotokoll (oder dessen
`_report.json`), erfasst der Beleg den Lauf und das ausgeführte Modell: für
`mt-eval run --method local-model -m <model>` die Hugging-Face-ID und
-Revision oder das Modellverzeichnis mit einem SHA-256-Hash über dessen Dateien. Ein
`local-model`-Ausführungsprotokoll, das kein Modell benennt, wird abgelehnt – frühere 0.2.0-Builds
übergaben `-m` nicht an diese Engine, die daraufhin ersatzweise ein Standardmodell für Englisch→Spanisch
ausführte. `submit-model` prüft anschließend, ob die eingepackten Gewichte
zu den im Beleg genannten Dateien gehören, und verweigert die Annahme unter Nennung beider Hashes,
falls dies nicht zutrifft. Ein Beleg, der aus einer reinen Hypothesendatei berechnet wurde, nennt kein Modell;
hierfür dient die Re-Exekution durch den Knoten als Gegenprüfung.

**Eine Diskrepanz zwischen Beleg und Knoten wird markiert.** Beide Zahlen werden
auf dieselbe Weise berechnet – derselbe Scorer, dasselbe Dev-Set und bei einem Modell
dieselbe Regel für die Dekodierlänge –, sodass dieselben Gewichte bis auf einen Bruchteil
eines Punktes übereinstimmen. Weichen der Wert des Knotens und der des Belegs um mehr als **2,0
Punkte** auf der Qualifier-Skala von 0–100 voneinander ab, weist der Knoten nach seiner
Re-Exekution darauf hin; ein Rechner mit Air-Gap erfasst die Abweichung zusammen mit seiner Prüfung
im lokalen Ledger und gibt sie bei `node approve --offline` erneut für den Treuhänder aus. Dies ist lediglich ein Warnhinweis, keine Ablehnung:
Die eigene Zahl des Knotens ist das entscheidende Gate. (Die Grenze von 2,0 ist eine bewusst
konservative Wahl, die frühzeitig anschlägt; Veranstalter können diesen Richtlinienwert bei Bedarf anpassen.)

### Teilnehmende können alles vor dem Einreichen durchspielen

Niemand sollte erst Tage später durch eine Ablehnung erfahren, dass das eigene Paket fehlerhaft aufgebaut war.
`mt-eval contest validate` führt auf dem Rechner des Teilnehmers und vollständig ohne
Netzwerkzugriff genau das aus, was Ihr Knoten als Erstes prüft:

```bash
# the static checks your node runs on a bundle
mt-eval contest validate ./my-bundle.tar.gz

# …and the qualifier: does my dev output line up, and does it clear the bar?
mt-eval contest validate ./my-bundle.tar.gz --contest <contest-id> \
    --dev my-dev-output.txt --dev-corpus <released dev corpus>
```

Der Befehl gibt eine Tabelle mit den Ergebnissen aus und beendet sich mit einem Rückgabewert ungleich null, falls etwas abgewiesen würde
(`--json` für automatisierte Toolings). Weisen Sie Teilnehmende in Ihrem Teilnahmeaufruf darauf hin:
Es erfordert nur einen einzigen Befehl und erspart Ihnen unnötige Ablehnungen.

`validate` nimmt keine Schreiboperationen vor. Es bewertet die Dev-Ausgabe erneut, ohne einen
Beleg zu schreiben, und überprüft anschließend einen Beleg:

- **Ein gepacktes Paket** (die von einem Einreichungsbefehl geschriebene Datei `.tar.gz`) führt den
  Beleg mit, mit dem es gepackt wurde, und diese Kopie liest Ihr Knoten ein. Validate prüft
  den Probelauf daher anhand dieser Kopie. Es ermittelt zudem den Beleg auf dem Rechner des Teilnehmers,
  aus dem die Kopie stammt, und benennt dessen System, unabhängig vom Methodennamen des Pakets.
  Es warnt, wenn `--system` einen abweichenden Beleg nennt und wenn der Teilnehmer dieses System
  seit dem Packen erneut qualifiziert hat (das Paket enthält dann noch den älteren Beleg). Ohne
  `--offline-…`-Flags stammen auch die Qualifier-ID und der Schwellenwert aus jener
  Kopie, entsprechen also den Werten, die der Teilnehmer an `contest qualify` übergeben hat.
  Der Befund weist darauf hin.
- **Ein Quellverzeichnis**, das mit `--manifest` für die Prüfung gepackt wurde: Validate
  verwendet den Beleg, den `submit-method` und `submit-model` einbetten würden, ermittelt nach
  derselben Logik: `--system`, andernfalls der Beleg mit dem Namen der Methode des Pakets,
  andernfalls der einzige Beleg des Wettbewerbs.

Es warnt, wenn dieser Beleg für eine andere Dev-Ausgabe, eine andere Dev-Datei oder einen
anderen Qualifier gilt. Es warnt ebenfalls, wenn kein Beleg vorhanden ist. Belege stammen
ausschließlich aus `contest qualify`.

Es handelt sich um einen Probelauf, und dies wird auch so ausgewiesen. Ihr Knoten erstellt das Image weiterhin
ohne Netzwerkzugriff, führt den Container aus und wiederholt den Qualifikationsschritt selbst. Ein fehlerfreies Ergebnis bei validate
bedeutet lediglich, dass im Vorfeld *keine bekannten Fehler* vorliegen – nicht, dass der Lauf erfolgreich Punkte erzielen wird.

:::note[Teilnehmende: Auf welchem Endpunkt liegt Ihr Wettbewerb?]
Ein **netzwerkgehosteter** Wettbewerb erfordert keine Einrichtung eines Endpunkts – der vom
Harness standardmäßig mitgelieferte Endpunkt enthält die Wettbewerbsmechanik (das Qualifier-Gate,
Methodenvorschläge, Autorisierung), und `mt-eval contest submit-model` /
`submit-method` kommunizieren direkt damit. Sie benötigen das Harness in Version **0.2.0 oder neuer**
(`mt-eval --version`); frühere Versionen enthalten `qualify`, `validate`, `rank` und
`close` noch nicht. Netzwerkgehostete Wettbewerbe werden erst zugänglich, wenn ein Veranstalter über
den im obigen Hinweis beschriebenen Weg registriert wurde; die meisten Wettbewerbe sind daher derzeit
**föderiert**.

Ein **föderierter** Contest — der Organisator betreibt die Maschinerie auf
seinem eigenen Supabase-Projekt, sodass Einreichungen niemals unser Projekt
durchlaufen — veröffentlicht seinen Endpunkt zusammen mit den
Contest-Materialien. Exportieren Sie ihn vor der Einreichung:

```bash
export MT_EVAL_SUPABASE_URL=https://<contest-host>.supabase.co
export MT_EVAL_SUPABASE_ANON_KEY=<contest-anon-key>
```

Wenn das Harness auf einen Endpunkt verweist, der die Contest-Maschinerie nicht
besitzt (etwa ein föderierter Host, dem eine Migration fehlt), stoppt der Befehl
mit *"the contest lane isn't available on this Supabase endpoint yet"* und teilt
Ihnen mit, mit welchem Endpunkt er kommuniziert hat. (Föderierte Organisatoren:
Veröffentlichen Sie diese beiden Werte neben Ihrer Korpus-Freigabe,
`--node-id` und `--corpus-version`.)
:::

## Schritt 9 — Versiegelte Durchläufe: anfordern, autorisieren, ausführen, Scores heraus

Für jede Einreichung:

1. Eine **Anfrage** wird für Ihr versiegeltes Set gestellt – sie geht in den Status `pending` über und
   trägt einen unveränderlichen Fingerabdruck aus (Paket-Hash, Korpus-ID, Korpusversion,
   `scores-only`, Messwert des Evaluierungsknotens).
2. Ihr Knoten führt **eigene statische Prüfungen** auf dem Paket durch. Bei Code-Beiträgen
   (Pfad B) prüft er anschließend, ob er diese überhaupt ausführen kann: Eine Container-Laufzeitumgebung
   ist vorhanden, und der vom Paket deklarierte Arbeitsspeicher, der temporäre Speicherplatz und die Laufzeit
   passen unter Ihre Obergrenzen in `sandbox`. Eine Nichtübereinstimmung stellt kein inhaltliches Urteil über die Methode dar. Die
   Ablehnung nennt jede Diskrepanz („8 GB RAM angefordert, dieser Knoten erlaubt 4 GB
   (sandbox.max_ram_gb)“), es wird nichts ausgeführt oder verworfen, und die Anfrage bleibt
   im bisherigen Zustand. Sie können die Obergrenze in `node.json` anheben und
   `mt-eval node run-method <id>` erneut ausführen, ohne dass neu eingereicht werden muss. Alternativ kann der Teilnehmer
   das Paket mit den in der Ablehnung genannten Flags neu packen (z. B. `--ram-gb 4`);
   da die Anforderungen in den Paket-Hash einfließen, entsteht dadurch eine neue Anfrage.
   Danach **führt der Knoten den deklarierten Qualifikationsanspruch des Teilnehmers auf seiner eigenen
   Kopie des öffentlichen Dev-Sets erneut aus**. Der Beleg ist eine Behauptung; dies ist die
   tatsächliche Messung. Eine Verfehlung wird hier abgewiesen – bevor ein Treuhänder um Genehmigung
   gebeten wird und bevor das versiegelte Set geöffnet wird –, und die Ablehnung weist aus, was deklariert,
   was gemessen und wie die Vorgabe definiert war. Ein Paket, das andere Preisbedingungen akzeptiert hat
   als die von Ihrem Wettbewerb deklarierten, wird an derselben Stelle abgewiesen.
3. Ihre **Treuhänder entscheiden** (M-von-N). Die Genehmigung erzeugt eine **Berechtigung**: einmalig nutzbar,
   zeitlich befristet und ausschließlich gültig für genau diesen Fingerabdruck.
4. Die Evaluierung läuft in der netzwerkisolierten Sandbox auf **Ihrem** Knoten
   (`mt-eval node run-method`): ein Container ohne Netzwerk-Stack, wobei Referenzen
   außerhalb verwahrt werden – oder, für maximale Isolation, auf einem Rechner mit echter physischer Netztrennung (Air-Gap),
   bei dem signierte Pakete mit reinen Punktwerten über Wechselmedien transportiert werden (den aktuellen
   Funktionsumfang entnehmen Sie dem Statuskasten oben). Ein vollständig isolierter Knoten lädt nichts hoch: Sie
   bringen dessen signiertes Punktekarten-Paket nach außen und veröffentlichen die Ausführungskarte von einem vernetzten
   Rechner aus (`mt-eval node relay`). Ihr versiegeltes Holdout und alle deklarierten
   Drittanbieter-Test-Suites laufen innerhalb **desselben** autorisierten Laufs, verursachen für Ihre Treuhänder
   also keinen zusätzlichen Zeremonieaufwand.
5. **Ausschließlich Punktewerte verlassen den Knoten.** Die Ausgaberegel `scores-only` ist auf
   Datenbankebene verankert; Textdaten aus Ihrem Korpus werden pro Eintrag niemals veröffentlicht.
6. Hat Ihr Wettbewerb `hidden_until_close` zugesichert, wird das Ergebnis noch nicht
   veröffentlicht: Es wird als zurückgestelltes Ergebnis **einbehalten**, das nur Sie einsehen können, und
   `contest close` veröffentlicht jede einbehaltene Karte, bevor die Rangliste
   festgeschrieben wird. Ein einbehaltenes Ergebnis geht niemals verloren.
7. Jeder Schritt – Anfrage, Abstimmungen, Berechtigung, Ausführung und jeder blockierte Versuch – wird
   an das öffentliche, hash-verkettete Audit-Protokoll angehängt, das Sie (und jeder andere) nachvollziehen können.

## Einreichen einer Methode (für Teilnehmende) — zwei Pfade

Die meisten NMT-Beiträge sind keine Exoten: ein standardmäßiger feingetunter Transformer samt
seinen Gewichten. Für diese Fälle gibt es einen **bevorzugten, codefreien Pfad** – sowie ein Sandbox-Fallback
für Methoden, die tatsächlich aus ausführbarem Code bestehen.

### Pfad A – deklaratives Modell (bevorzugt für Standard-NMT)

Handelt es sich bei Ihrer Methode um ein standardmäßiges neuronales Modell, reichen Sie es als **Daten** ein –
die Gewichte, der Tokenizer und die Konfiguration – und der Veranstalter führt es in seiner eigenen, vertrauenswürdigen
Inferenz-Engine aus. **Kein Dockerfile, kein Code, keine Sandbox.** Da nichts von dem, was Sie
einreichen, zur Ausführung kommt, beschränkt sich die Sicherheitsprüfung des Veranstalters auf eine entscheidbare Formatvalidierung,
anstatt beweisen zu müssen, dass beliebiger Code sicher ist – eine wesentlich stärkere
Garantie für Sie und für das Korpus.

```bash
mt-eval contest submit-model <contest-id> \
  --model-dir ./my-model \          # config.json + model.safetensors + tokenizer.* at the ROOT
  --name "My NMT" --version 2.0 \
  --architecture MarianMTModel \    # must be on the organizer's trusted whitelist
  --method-class pipeline --paradigm neural-nmt \
  --track constrained --training-data-file ./training-data.txt \
  --parameter-count 92487 \
  --weights-license Apache-2.0 --weights-public \
  --developer "Your Name" --node-id <organizer-advertised-node-id> --agree
```

**Ein mit NMT Forge trainiertes Modell.** `nmt-forge export` schreibt den
bereitstellbaren Ordner `export/model/`. Neben den Gewichten, der Konfiguration und dem Tokenizer
enthält er `forge-model.json` (die Punktewerte dieses Modells auf Ihrem privaten Testset
sowie lokale Pfade), `DEPLOY.md` und `champollion-plugin/` – nichts davon ist
Teil einer Einreichung. `submit-model` packt ausschließlich die Dateien, die transformers einliest
(Gewichte, `config.json`, `generation_config.json`, die Tokenizer-Dateien), und
gibt alles aus, was ausgelassen wurde, sodass diese drei Dateien von selbst außen vor bleiben.
Abschnitt 6 dieser `DEPLOY.md` führt die Dateien auf, aus denen die Einreichung besteht, die
Architektur aus `config.json` sowie die aus dem Header der Gewichtsdatei ausgelesene Parameteranzahl samt dem genauen Befehl.
Um exakt die Dateien einzureichen, die Sie geprüft haben, kopieren Sie sie in einen
eigenen Ordner und übergeben Sie diesen als `--model-dir`:

```bash
mkdir -p lane-a
cp export/model/config.json export/model/generation_config.json \
   export/model/model.safetensors export/model/tokenizer.json \
   export/model/tokenizer_config.json lane-a/      # the files DEPLOY.md §6 lists
mt-eval contest submit-model <contest-id> --model-dir lane-a \
  --architecture MarianMTModel --paradigm neural-nmt …
```

**Welche Parameteranzahl gilt?** Pfad A gleicht `--parameter-count` mit der
Gewichtsdatei ab. Es summiert die Tensor-Größen im Header von `safetensors` auf und
weist Deklarationen ab, die um mehr als 1 % abweichen. Das ist der im Dateisystem hinterlegte Wert,
der von einer in torch ermittelten Zählung abweichen kann. Geteilte oder gekoppelte Gewichte (Tied Weights) werden nur einmal gespeichert. Eine
Tabelle, die das Modell beim Laden neu aufbaut – wie etwa sinusförmige Positionskodierungen –, wird unter Umständen
gar nicht mitgespeichert. Die Ablehnungsmeldung gibt den Zählwert der Datei aus; deklarieren Sie diesen Wert.

Die Vorgaben, die Ihr Paket erfüllen muss (lokal vor dem Upload validiert und erneut
durch den Knoten des Veranstalters geprüft):

- **Gewichte liegen als `safetensors` vor, niemals als Pickle.** Eine PyTorch-Datei `.bin`/`.pt`/`.ckpt`
  ist ein Pickle-Format – beliebiger Code beim Ladevorgang – und wird abgewiesen. Exportieren Sie nach
  `model.safetensors` (`safetensors` / `transformers` unterstützen dies nativ).
- **Eine Architektur, die die Engine des Veranstalters nativ lädt.** Das Feld `architectures` in `config.json`
  kann jede Architektur sein, die `transformers` des Hosts implementiert
  (Marian, NLLB/M2M100, mBART, T5, Pegasus und viele weitere) – Hosts sind
  **standardmäßig freizügig**, da die Sicherheit bei `trust_remote_code=False`
  aus dem codefreien Format herrührt, nicht aus dem Architekturnamen (eine nicht unterstützte
  Architektur schlägt beim Laden schlicht fehl, ohne Code auszuführen). Ein vorsichtiger Host kann
  eine Zulassungsliste veröffentlichen. Kein `auto_map`, kein `trust_remote_code` – diese schleusen
  benutzerdefinierten Code wieder ein und werden ausnahmslos abgewiesen.
- **Ein deklarativer Tokenizer** (`tokenizer.json` oder ein `sentencepiece` `.model` +
  Vokabular) und **ausschließlich Datendateien** – kein `.py`, keine Skripte oder Binärdateien im Paket.

**Was `submit-model` einpackt.** Die Datendateien auf der obersten Ebene von `--model-dir`
(`.safetensors`, `.json`, `.model`, `.txt`, `.spm`, `.vocab`, `.merges`): die
Gewichte, die Konfiguration, der Tokenizer und die Generierungskonfiguration. Alles andere – ein
`README.md` oder `DEPLOY.md`, Unterordner, ein Pickle-Checkpoint neben den
Safetensors – bleibt außen vor, und der Befehl listet die ausgeschlossenen Dateien auf. Somit kann der von `nmt-forge export`
erstellte Ordner `model/` direkt so eingereicht werden: `DEPLOY.md`
und `champollion-plugin/` verbleiben lokal. `contest validate` packt auf dieselbe Weise
und weist die ausgelassenen Dateien als INFO-Meldung aus. Die Prüfung Ihres Knotens bleibt
unverändert: Ein Paket, das Nicht-Datendateien enthält, wird dort nach wie vor abgewiesen.

**Maximale Ausgabelänge.** Ihr Knoten dekodiert immer mit einer expliziten Längenangabe:
dem vom Modell deklarierten Wert für `max_new_tokens` oder `max_length` (dessen
`generation_config.json`), andernfalls bis zu `max(64, 4 × source tokens)` neue Token
pro Satz, begrenzt durch die Positionen des Decoders. `mt-eval run --method
local-model` dekodiert nach derselben Regel, sodass der Beleg eines Teilnehmers und die
Re-Exekution Ihres Knotens übereinstimmen. `submit-model` gibt die anzuwendende Länge aus
und schreibt sie in das Manifest (`model.decodeLength`); der Knoten hält die
angewendete Länge in den Ausführungsdaten des Laufs fest (`execution.generation`).
Ohne eine explizite Längenbegrenzung stoppt die Transformers-Bibliothek nach etwa 20
Token, wodurch jeder Beitrag anhand unvollständiger Ausgaben bewertet würde.

Der Veranstalter führt das Modell mit `trust_remote_code=False` offline aus, und ausschließlich Punktewerte
verlassen die Umgebung – veröffentlicht als `declarative-model`, Methodenidentität **konstruktionsbedingt
codefrei**. (Bei Modellen mit mehreren Gigabyte: Nutzen Sie `--bundle-out` für die Offline-Übertragung,
wie nachfolgend beschrieben.)

### Pfad B – ausführbares Paket (die Sandbox, für Code-Methoden)

Wenn Ihre Methode tatsächlich aus Code besteht – eine Pipeline, ein LLM-gestütztes Hybridsystem, ein
angepasster Decoder –, kann sie nicht deklarativ ausgeführt werden und durchläuft stattdessen die
netzwerkisolierte Sandbox. Dies ist der pragmatisch schwächere Pfad (er kapselt nicht vertrauenswürdigen
Code ein, anstatt dessen Ausführung von vornherein auszuschließen); verwenden Sie daher nach Möglichkeit immer Pfad A,
wenn es sich bei Ihrer Methode um ein Standardmodell handelt.

**Jedes von Ihrer Methode aufgerufene Modell mitliefern.** Der Knoten führt Ihren Beitrag
vollständig ohne Netzwerkzugriff aus. Eine Methode, die eine gehostete Modell-API aufruft
(ein LLM-gestütztes Hybridsystem, das ein Cloud-LLM anfragt, ein MT-Dienst), erhält keine Antwort
und erzielt keinerlei Punkte. Ein LLM-gestützter Hybrid qualifiziert sich nur dann, wenn sich das LLM innerhalb des Pakets befindet:
offene Gewichte unter `/method`, ausgeführt im selben Prozess oder über einen lokalen Server, den
Ihr Einstiegspunkt startet. Dasselbe gilt für Wörterbücher, FSTs oder andere Daten, die Ihre
Methode zur Laufzeit einliest. (Die [Methodenspezifikation](/docs/network/specifications/methods#method-validity-and-dependency-classes)
bezeichnet eine Methode, die ein gehostetes LLM benötigt, als Abhängigkeitsklasse A1; das Gateway,
das dies innerhalb der Sandbox ermöglichen würde, existiert noch nicht.)

**Die Schnittstelle für ausführbare Pakete ist stdin/stdout.** Innerhalb des Containers führt der
Knoten des Veranstalters exakt Folgendes aus:

```
cat /eval/source.txt | <your entrypoint> > /output/translations.txt
```

Quellsätze treffen zeilenweise über stdin ein; Sie geben eine Übersetzung pro
Zeile auf stdout aus. Der Container verfügt über keinen Netzwerk-Stack (`--network=none`), ein
schreibgeschütztes Root-Dateisystem und ein beschreibbares `/tmp`.

**Wo Ihre Dateien abgelegt werden.** Alles in dem Ordner, den Sie als `--method-dir` übergeben,
wird im Paket unter `method/` abgelegt und zur Laufzeit **schreibgeschützt unter `/method`**
eingebunden, einschließlich der Gewichte, sodass nichts in das Image kopiert werden muss. Bauen Sie
die Struktur wie folgt auf:

```text
my-method/              ← --method-dir ./my-method
  translate.py          ← --entrypoint translate.py   (runs as /method/translate.py)
  weights/              ← read at /method/weights
  wheels/               ← vendored dependencies (see the Dockerfile below)
Dockerfile              ← --dockerfile ./Dockerfile
training-data.txt       ← --training-data-file ./training-data.txt
```

`--entrypoint` ist der Pfad des Skripts innerhalb von `--method-dir`. Sein Paketpfad,
`method/translate.py`, wird ebenfalls akzeptiert. Könnte ein Name zwei verschiedene
Dateien bezeichnen, bricht der Befehl ab und nennt beide; fehlt die Datei, werden alle
durchsuchten Pfade aufgeführt.

**Ein minimaler Hugging Face transformers-Wrapper:**

```python title="my-method/translate.py"
#!/usr/bin/env python3
import sys
from transformers import AutoModelForSeq2SeqLM, AutoTokenizer

tok = AutoTokenizer.from_pretrained("/method/weights")
model = AutoModelForSeq2SeqLM.from_pretrained("/method/weights")

for line in sys.stdin:
    inputs = tok(line.strip(), return_tensors="pt", truncation=True)
    out = model.generate(**inputs, max_new_tokens=256)
    print(tok.decode(out[0], skip_special_tokens=True), flush=True)
```

**Das Dockerfile muss ohne Netzwerk bauen.** Der Organisator baut Ihr Image
mit `--network=none` — der Air-Gap-Build-Test *ist* der Build —, sodass jede
Abhängigkeit **in das Bundle eingebettet werden muss** (ein `pip install`, das
PyPI erreicht, lässt den Build fehlschlagen, und der statische Pre-Flight-Scan
markiert Netzwerkaufrufe, bevor überhaupt etwas gesendet wird). Liefern Sie
Wheels in Ihrem Methodenverzeichnis mit und installieren Sie daraus:

```dockerfile title="Dockerfile"
FROM python:3.11-slim
# The build context is the bundle root: Dockerfile + method/
COPY method/wheels/ /wheels/
RUN python3 -m pip install --no-index --find-links=/wheels torch transformers sentencepiece
# Weights are NOT copied — /method is mounted read-only at run time.
```

**Was jede Einreichung enthalten muss.** Diese Angaben sind obligatorisch, und der Befehl
bricht vor jedem Netzwerkschritt ab, falls eine davon fehlt:

- `--method-dir`, `--dockerfile`, `--entrypoint`, `--name`, `--version`,
  `--method-class`, `--developer`, `--node-id` und `--agree`;
- ein **positiver `mt-eval contest qualify`-Beleg** für diesen Wettbewerb und dieses
  System (Schritt 8; `--system` nennt ihn, wenn Sie mehrere qualifiziert haben);
- zwei Deklarationen, die als Ihre Zusicherungen erfasst werden: `--track constrained` oder
  `--track unconstrained` (es gibt keinen Standardwert) sowie `--parameter-count`;
- für eine Methode mit trainierten Gewichten (`--parameter-count` größer als 0): zusätzlich
  `--weights-license <SPDX id or LicenseRef-…>` und entweder `--weights-public`
  oder `--weights-private`;
- für eine Methode **ohne trainierte Gewichte** (regelbasiert, Wörterbuch, FST):
  `--parameter-count 0` und keine Gewichts-Flags. Die Einreichung vermerkt die
  Lizenz und Offenheit der Gewichte als nicht zutreffend, anstatt eine fiktive Lizenz
  erfinden zu müssen;
- für eine Methode, die **ein LLM per Prompt ansteuert** (sie trainiert nichts, sondern verfasst lediglich
  Prompts): Als Parameteranzahl gilt die Summe aller Modelle, die das Paket ausführt,
  einschließlich des LLMs, auch wenn Sie es nicht selbst trainiert haben. Entnehmen Sie den Wert der Modellkarte
  des LLMs oder dem Header seiner Gewichte und übergeben Sie die Lizenz des LLMs als
  `--weights-license` mit `--weights-public`, wenn die Gewichte frei herunterladbar
  sind. `--parameter-count 0` würde das System falsch darstellen: 0 bedeutet, dass die
  Methode überhaupt kein Modell ausführt. Eine Methode, die ein gehostetes LLM aufruft, kann an einem
  versiegelten Wettbewerb gar nicht teilnehmen: Der Knoten hat kein Netzwerk, und das Gateway,
  das solche Aufrufe weiterleiten würde, existiert nicht (siehe oben unter *Jedes von Ihrer Methode
  aufgerufene Modell mitliefern*). `contest qualify` weist bereits darauf hin, wenn die bewerteten
  Ausgaben über einen Provider bezogen wurden;
- bei `--track constrained`: `--training-data-file`, eine Klartextliste der
  Trainingsdaten (eine Methode, die auf keinen Daten trainiert wurde, hält dies in der Datei fest);
- falls der Wettbewerb Preisbedingungen vorgibt: `--accept-terms <hash>` (führen Sie den Befehl einmal
  ohne dieses Flag aus, werden die Bedingungen samt dem zurückzugebenden Hash ausgegeben); falls
  Beschreibungen verlangt werden: `--description-file`.

**Ressourcendeklaration Ihrer Methode.** Das Paket gibt den benötigten Arbeitsspeicher,
den Festplattenplatz für temporäre Daten sowie die Laufzeit an. Der Knoten des Veranstalters lehnt Pakete ab,
die dessen Obergrenzen in `sandbox` überschreiten. Als Standardwerte gelten die Obergrenzen aus der
Knotenvorlage, die von `mt-eval node init` erzeugt wird: `--ram-gb 4`, `--disk-gb 4`,
`--max-runtime-minutes 30`, keine GPU. Ein mit den Standardwerten erstelltes Paket
kann somit auf einem Knoten ausgeführt werden, der mit den Standardwerten der Vorlage konfiguriert ist. Benötigt
Ihre Methode mehr Ressourcen, geben Sie dies über diese Flags an (sowie `--gpu`) und prüfen Sie, ob der
Knoten des Veranstalters dies zulässt. Veranstalter, die die Limits anpassen, sollten diese
zusammen mit dem Wettbewerb veröffentlichen. Weist der Knoten die Einreichung ab, führt die Fehlermeldung
jeden Wert und die erlaubte Obergrenze auf.

Reichen Sie es ein mit:

```bash
mt-eval contest submit-method <contest-id> \
  --method-dir ./my-method --dockerfile ./Dockerfile \
  --name "My NMT" --version 1.0 \
  --entrypoint translate.py \
  --method-class pipeline --paradigm neural-nmt \
  --developer "Your Name" --node-id <organizer-advertised-node-id> \
  --track constrained --parameter-count 78000000 \
  --weights-license Apache-2.0 --weights-public \
  --training-data-file ./training-data.txt \
  --primary \
  --agree
```

Der Knoten des Veranstalters führt Ihre Methode auf seiner eigenen Kopie des öffentlichen Dev-Sets erneut aus,
bevor ein Treuhänder um die Genehmigung des Laufs gebeten wird. `--agree` bestätigt
die Bedingungen für die Methodeneinreichung.

**Modellgewichte im Multi-Gigabyte-Bereich oder keine Verbindung: Nutzen Sie den Offline-Pfad.** Der gehostete
Einreichungsweg lädt Ihr Tarball über einen **einzelnen POST-Request** in den Speicher des Wettbewerbshosts hoch
und unterliegt daher dessen Upload-Begrenzung – völlig ausreichend für Code
und kleine Modelle, jedoch nicht für Checkpoints von mehreren Gigabyte. Die Paketspezifikation
selbst unterstützt deutlich größere Artefakte (Tarballs bis zu 100 GB, erstellte Images bis zu
150 GB). `--offline` schnürt das Paket und erstellt ein Austauschverzeichnis
vollständig ohne Netzwerkzugriff. Ohne Verbindung existiert kein Wettbewerbsdatensatz zum Auslesen,
daher werden die vom Veranstalter publizierten Werte benötigt: `--bundle-out`,
`--secret-set`, `--pair`, `--developer-email`, `--offline-qualifier-id` und
`--offline-threshold` (der Schwellenwert auf der Qualifier-Skala von 0–100). Eine regelbasierte Methode
ohne Gewichte, offline gepackt:

```bash
mt-eval contest submit-method <contest-id> \
  --method-dir ./my-method --dockerfile ./Dockerfile \
  --name "My Rules" --version 1.0 \
  --entrypoint translate.py \
  --method-class pipeline --paradigm rule-based \
  --developer "Your Name" --developer-email you@example.org \
  --node-id <organizer-advertised-node-id> \
  --track constrained --parameter-count 0 \
  --training-data-file ./training-data.txt \
  --agree \
  --offline --bundle-out ./exchange \
  --secret-set <sealed-set-id> --pair 'eng>crk' \
  --offline-qualifier-id <published-qualifier-id> --offline-threshold 35
```

Das Austauschverzeichnis gelangt per Wechseldatenträger (oder über einen
beliebigen Kanal, dem Sie beide vertrauen) zum Organisator; dieser nimmt es mit
`mt-eval node import-bundle` auf. Der SHA-256-Hash des Bundles wird in jedem Fall in die
Autorisierungsanfrage eingefroren, sodass das, was läuft, nachweislich das ist,
was Sie vorgeschlagen haben.

**Für Veranstalter: Ein Offline-Vorschlag wartet ebenso auf einen Treuhänder wie ein Online-Vorschlag – und der Knoten prüft ihn vorab in der Reihenfolge aus Schritt 9.** Er geht als
*ausstehende* Anfrage ein, und der Rechner mit Air-Gap erfasst sowohl seine eigenen Prüfungen
als auch die Entscheidung des Treuhänders selbst – ganz ohne Datenbank und Dienstschlüssel:

```bash
mt-eval node import-bundle ./exchange               # stages it: PENDING custodian approval
mt-eval node run-method <request-id> --offline      # the node's checks: re-runs the entrant's qualifier, checks the container runtime
mt-eval node list --offline                         # what is staged, checked, approved or waiting, and the next command
mt-eval node approve <request-id> --offline --actor <custodian>
#   or: mt-eval node deny <request-id> --offline --actor <custodian> --reason "…"
mt-eval node run-method <request-id> --offline      # the sealed run: refuses until the approval is recorded
mt-eval node export-scores ./exchange               # signed scores, or the signed refusal
```

Der erste Aufruf von `node run-method --offline` auf einem ausstehenden Vorschlag öffnet noch keine
versiegelten Daten. Er führt den Qualifier des Einreichenden auf dem öffentlichen Dev-Set erneut aus (dem
`qualifier` + `dev_corpus`, das Ihre `node.json` deklariert; `node init
--from-contest` füllt beides aus) und prüft bei Code-Beiträgen, ob eine Container-Laufzeitumgebung
vorhanden ist und ob der im Paket deklarierte Arbeitsspeicher, der temporäre Speicherplatz und die
Laufzeit Ihren Obergrenzen in `sandbox` entsprechen. Ein erfolgreicher Durchlauf wird in das
hash-verkettete lokale Ledger des Knotens eingetragen. Wird die Qualifikationshürde verfehlt, bricht der Vorgang ab, wird
als Ablehnung des Knotens protokolliert und als signierte Ablehnung zurückübermittelt: Ein Treuhänder wird nicht befragt.
Kann der Knoten den Beitrag nicht ausführen (fehlende Laufzeitumgebung, zu niedriges Limit), bricht er mit einem
Knotenfehler ab, ohne etwas zu protokollieren, und die Anfrage bleibt unverändert bestehen.

`node approve --offline` bricht ab, solange dieser erfolgreiche Prüfschritt nicht
für den exakten Fingerabdruck und das Paket dieser Anfrage im Ledger vorliegt, und die Fehlermeldung nennt den
zuerst auszuführenden Befehl. Anschließend schreibt es ein Votum und die Autorisierung in
dasselbe Ledger (das auch von der Treuhänder-Zeremonie genutzt wird) sowie einen Entscheidungsdatensatz,
der mit `signing_key` des Knotens signiert ist und die zugrunde liegende Prüfung benennt. Der
zweite Aufruf von `node run-method --offline` prüft alle drei Voraussetzungen, bevor versiegelte Daten
verarbeitet werden (das Ledger ist valide, weist diese Anfrage als unter dem importierten Fingerabdruck autorisiert aus,
und der signierte Datensatz ist gültig und benennt diese Anfrage), sodass ein ausstehender Vorschlag niemals allein
auf Geheiß des Administrators ausgeführt wird. Anschließend wiederholt er die Laufzeitprüfung und den Qualifier, bevor das versiegelte Set geöffnet wird.
Eine Ablehnung wird analog protokolliert und geht als signierte Ablehnung an den Einreichenden zurück; ein Treuhänder kann
einen Vorschlag jederzeit ablehnen, unabhängig vom Prüfstatus.
Anfragen, die bereits autorisiert eintreffen – ein Relay-Export (in der Wettbewerbsdatenbank autorisiert)
oder `node stage-request` (der Staging-Veranstalter fungiert als Autorisierung) –,
erfordern keine zweite Entscheidung.

**Organisatoren: laden Sie Basis-Images auf Airgap-Maschinen vor.** Da der
Image-Build mit `--network=none` ausgeführt wird, muss das `FROM`-Basis-Image des
Dockerfiles bereits im lokalen Image-Speicher der Maschine vorhanden sein. Auf
einer verbundenen Maschine `docker pull python:3.11-slim && docker save -o base.tar python:3.11-slim`;
tragen Sie `base.tar` mit dem Bundle hinüber; auf der Airgap-Maschine
`docker load -i base.tar`, bevor Sie `mt-eval node run-method` ausführen. Einigen Sie sich mit den
Teilnehmern in Ihren veröffentlichten Wettbewerbsunterlagen auf das/die Basis-Image(s).

## Schritt 10 — Rangliste erstellen, abschließen, exportieren

Reine Punktergebnisse werden wie jeder andere Lauf auf der [Bestenliste](/docs/network/leaderboard/rules)
veröffentlicht, gekennzeichnet als Evaluierungen auf versiegelten Datensätzen. Die Rangliste des Wettbewerbs
selbst erstellen, sperren und veröffentlichen Sie eigenständig:

```bash
mt-eval contest open-intake <contest-id>     # entry intake on — submit-model / submit-method admitted (owner only)
mt-eval contest close-intake <contest-id>    # intake off — work already received still scores
mt-eval contest rank <contest-id> --json     # provisional ranking, any time
mt-eval contest close <contest-id>           # one-way: freezes the ranking, shuts intake
mt-eval contest export <contest-id> --format csv --out results.csv
```

Was `rank` leistet, damit Sie dies in Ihr Regelwerk aufnehmen können: Die Beiträge werden nach der
**gespeicherten Primärmetrik** des Wettbewerbs eingestuft (`--primary-metric` bei der Erstellung; standardmäßig
chrF++), danach chrF++ → BLEU → COMET → früheste Einreichung. Die Auswertung erfolgt
**standardmäßig rein verifiziert** – anhand der vom Knoten veröffentlichten Ergebniskarten – und zählt
alle ausgeblendeten, selbst gemeldeten Karten mit. Jedes benachbarte Paar erhält ein ausgewiesenes Gleichstands-Urteil
(Tie Verdict): ein segmentweiser gepaarter Signifikanztest, sofern segmentweise Daten vorliegen,
andernfalls **Überlappung des 95-%-Konfidenzintervalls**, andernfalls Punktegleichheit.
**Ein versiegelter Wettbewerb veröffentlicht niemals Daten auf Segmentebene** (konstruktionsbedingt nur
aggregierte Werte), daher läuft der gepaarte Test stattdessen auf Ihrem Knoten. Führen Sie vor dem Abschluss
`mt-eval node verdicts --contest <id> --out verdicts.json` auf dem Knoten aus; der Befehl
schreibt ausschließlich signierte Urteile (pro Paar: p-Wert, Punktwertdifferenz, Intervall,
Segmentanzahl – kein Text). Schließen Sie den Wettbewerb anschließend mit `--node-verdicts verdicts.json
--verify-key <the node's .pub.json>` ab. Liegen keine Urteile vor, werden Gleichstände anhand der
KI-Überlappung ermittelt. In beiden Fällen nennt die Ausgabe die herangezogene Entscheidungsgrundlage, und bei Gleichstand
teilen sich die Systeme einen Rang (`1, 1, 3`).

`close` ist ein unumkehrbarer Vorgang. Es erstellt die Rangliste nach der hinterlegten Metrik, bricht ab,
solange noch Einreichungen ausgewertet werden (außer bei erzwungenem Abschluss), zeigt Ihnen die
Tabelle an, bittet um Bestätigung und friert die Rangliste anschließend im Wettbewerbsdatensatz ein. `export`
gibt dieses festgeschriebene Ergebnis unverändert als JSON oder CSV für Ihren Abschlussbericht (Findings) oder Ihre
Ergebnisseite aus. Karten, die auf anderen Sets bewertet wurden (ein vollständig geheimes T2-Set, eine verirrte
Dev-Set-Karte), werden separat aufgeführt und niemals in die Hauptrangliste eingemischt.

### Festlegen, wann Ergebnisse sichtbar werden

Zwei Zusicherungen, die Sie bei der Erstellung machen und danach nicht mehr unbemerkt ändern können – die
Datenbank sperrt beide in dem Moment, in dem Ihr Wettbewerb eine Einreichung verzeichnet:

```bash
mt-eval contest create … \
  --results-visibility hidden_until_close \   # no score is visible while the contest runs
  --anonymize-until-close                     # pseudonyms in YOUR ranking artifacts
```

**`--results-visibility hidden_until_close` ist die Option, die ein Ergebnis tatsächlich
verbirgt.** Ist sie aktiv, wird jede von Ihrem Knoten bewertete Karte zurückgehalten statt
veröffentlicht: Die Methode wurde regulär ausgeführt, die Autorisierung wurde verbraucht, und die
Karte wird vollständig zusammengestellt, validiert und unverändert gespeichert – sie erscheint lediglich nicht
auf der Bestenliste. `contest close` veröffentlicht jede zurückgehaltene Karte **zuerst** und baut
erst danach die Rangliste auf und friert sie ein, sodass nichts verloren geht und das festgeschriebene Ergebnis alle
vorliegenden Daten berücksichtigt. Dies geschieht auch bei einem forcierten Abschluss: Das Erzwingen bezieht sich lediglich auf noch
laufende Auswertungen, niemals auf das Zurückhalten von Ergebnissen, die Ihr Wettbewerb schuldig ist. Der gespeicherte
Snapshot listet exakt auf, welche Ergebnisse durch den Abschluss veröffentlicht wurden.

„Zurückgehalten“ ist ein **dokumentierter Zustand, kein verlorener Lauf**: Die einbehaltene Karte kann nicht
mehr bearbeitet werden, und der Verweis auf ihren Veröffentlichungsort wird einmalig geschrieben und
niemals umgebogen – beides wird in der Datenbank unterhalb jedes Clients durchgesetzt. Solange
der Wettbewerb läuft, gibt `rank` an, wie viele Ergebnisse aktuell zurückgehalten werden, damit
eine vorläufige Rangliste nicht fälschlicherweise als vollständig wahrgenommen wird.

**`--anonymize-until-close` bewirkt weniger, und es ist wichtig, die genaue
Wirkungsweise zu verstehen.** Es ersetzt die Namen der Teilnehmenden in *Ihren*
Ranglisten-Artefakten – der Tabelle von `rank`, deren JSON-Ausgabe, der CSV – durch deterministische Pseudonyme,
solange der Wettbewerb läuft, und `close` deckt sie auf. Es anonymisiert die öffentliche
Bestenliste **nicht**: Eine bereits veröffentlichte Karte zeigt die in der Einreichung
deklarierte Urheberschaft an. Wenn Sie verhindern möchten, dass Teilnehmende die Ergebnisse der anderen vor
dem Ende einsehen können, ist dafür `--results-visibility hidden_until_close` zuständig; dieses Flag ist
kein Ersatz dafür.

Erfüllt eine Methode die von Ihnen in Schritt 6 veröffentlichten Schwellenwert-Bedingungen –
einschließlich der [Sprecher-Validierung](/docs/network/specifications/speaker-validation),
die als Kriterium Ihrer Community dient und nicht automatisiert erfolgt –, vergeben **Sie** (oder Ihre Treuhandstelle)
den Preis gemäß Ihren eigenen publizierten Bedingungen. Die Rolle von Champollion endet bei der Messung.

---

## Was Sie für immer behalten

- **Den Korpus.** Er hat Ihre Infrastruktur niemals verlassen. Nehmen Sie den
  Chiffretext offline und der versiegelte Datensatz hört einfach auf,
  ausführbar zu sein.
- **Die Schlüssel.** Der Zugriff erlischt, wenn Ihre Verwalter aufhören, ihn zu
  gewähren.
- **Das Geld.** Es war niemals irgendwo anders.
- **Das Register.** Der Kopf-Digest des Audit-Logs ist veröffentlichbar, sodass
  die Historie, wer was gegen Ihren Korpus ausgeführt hat, nicht stillschweigend
  umgeschrieben werden kann — von niemandem, einschließlich uns.

Für Bedingungssprache, die Sie anpassen können — Eigentum, Lizenzierung mit
ausschließlich Scores und einen expliziten Rundgang durch die Wege, auf denen
ein Wettbewerb angegriffen werden kann —
siehe [Bedingungsvorlagen](/docs/network/sovereignty/terms-templates).
