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

- ✅ **Live:** Korpus-Registrierung (Metadaten-Karten, Hash-Pinning, Exposure-
  Lanes), die Registry für versiegelte Sets (Digest + Custodian-Gruppe + Qualifier, kein
  Inhalt), die Wettbewerbs-Maschinerie mit der Sealed-Lane, die Daten-Schicht für Autorisierungs-
  anfragen/-freigaben/-audits (ausstehend → M-von-N-Entscheidung → einmalige,
  zeitlich begrenzte Freigabe, Append-only Hash-verkettetes Audit-Log) und Scores-only-
  Ausgabe, erzwungen auf der Datenbankschicht.
- ✅ **Live: der Scoring-Node des Organisators + Hypotheses-Lane.** Ein
  Befehl teilt Ihr Korpus in ein öffentliches Dev-Set (den Qualifier), ein Blind-
  Test-Set (Quelle veröffentlicht, Referenzen ruhend auf IHRER Maschine versiegelt) und
  optional ein vollständig geheimes Set (`mt-eval contest prepare`). Die Registrierung der
  versiegelten Sets, des Qualifiers und des Wettbewerbs erfolgt im **Self-Service über Ihr eigenes
  Login** — `contest prepare --self-serve`, oder `mt-eval contest register
  --manifest` für einen zuvor vorbereiteten Wettbewerb — wobei jede Zeile
  auf der Datenbankschicht an eine Identität gebunden ist; kein Kurator im Prozess und kein
  privilegierter Schlüssel (siehe Schritt 4 für die ehrlichen Einschränkungen). Teilnehmer
  reichen ihre Übersetzungen mit `mt-eval contest submit-hypotheses` ein (die CLI
  bewertet das Dev-Set lokal selbst und lehnt Uploads unterhalb Ihres Schwellenwerts ab);
  IHR selbst gehosteter Node (`mt-eval node serve`) bewertet die Dev-Nachweise
  selbst neu, fungiert als Gatekeeper für den Qualifier, autorisiert gemäß dem Modell Ihres Wettbewerbs
  (`per-submission` — ein Custodian genehmigt jedes Scoring — oder `blanket` /
  `open`), bewertet das Blind-Set gegen Referenzen, die Ihre Maschine niemals verlassen,
  und veröffentlicht Run-Cards, die **nur Aggregate** enthalten. Was diese Lane
  NICHT beweist: dass die genannte Methode die Hypothesen erzeugt hat (die Methodenidentität wird
  vom Teilnehmer behauptet und auf jeder Run-Card als solche gekennzeichnet), und sie kann
  einen entschlossenen Angreifer nicht davon abhalten, Referenzsignale über viele verschiedene
  Einreichungen hinweg zu extrahieren — Rate-Limits, byte-identische Deduplizierung und die Audit-Kette verlangsamen
  dies; die unten stehende Method-Execution-Lane ist die eigentliche Antwort.
- ✅ **Live: zwei Method-Lanes für geheime Sets.** Teilnehmer mit einem veröffentlichten
  Hypotheses-Lane-Eintrag können ihre Methode für Ihr geheimes Set vorschlagen. Der
  Node wählt die Lane anhand der Einreichung aus:
  - **Lane A — deklaratives Modell (bevorzugt).** Ein neuronales Standardmodell sind
    DATEN: `mt-eval contest submit-model` sendet Safetensors-Gewichte + einen
    deklarativen Tokenizer + eine Config — **kein Code, kein Dockerfile.** Ihr Node
    validiert, dass es codefrei ist (Safetensors, kein Pickle; kein
    `trust_remote_code`/`auto_map`; nur Daten-Dateien) und führt die Gewichte in
    seiner EIGENEN vertrauenswürdigen Engine aus (`transformers`, `trust_remote_code=False`, offline).
    Die Architektur ist standardmäßig permissiv (jede, die Ihre Engine nativ lädt); ein
    vorsichtiger Host kann eine Allowlist festlegen. Nichts Nicht-Vertrauenswürdiges wird ausgeführt, daher
    gibt es nichts in eine Sandbox zu packen. Veröffentlicht als `declarative-model`, Methodenidentität
    **konstruktionsbedingt codefrei**.
  - **Lane B — ausführbares Bundle (Sandbox-Fallback).** Für Methoden, die Code SIND:
    `mt-eval contest submit-method` sendet ein Dockerfile + Entrypoint. Nachdem Ihr
    Custodian zugestimmt hat, führt IHR Node es in einem netzwerkisolierten
    Container aus (`--network=none` — der Netzwerk-Stack existiert im Inneren nicht;
    Read-only-Root, entzogene Capabilities, bereinigte Umgebung), wobei
    zuerst automatisierte statische Prüfungen stattfinden und Referenzen den Container niemals betreten.
    Veröffentlicht als `method-execution` mit **ausführungsgeprüfter** Identität.
  In beiden Lanes: Der Bundle-Hash wird in der Autorisierungsanfrage eingefroren (was
  ausgeführt wird, ist nachweislich das, was vorgeschlagen wurde), und die Scores werden über denselben
  Aggregates-only-Pfad veröffentlicht. Für maximale Isolation kann die Scoring-Maschine ein echtes
  Airgap sein: autorisierte Anfragen und Ed25519-signierte Scores-only-Bundles werden über
  Wechseldatenträger übertragen (`mt-eval node relay` / `import-bundle` / `export-scores`) —
  der geheime Text erreicht nicht einmal die verbundene Maschine. Was diese Lanes noch
  NICHT beinhalten: Hardware-Attestierung des Nodes (Identität ist selbst deklariert),
  formelle Streitbeilegungs-Maschinerie und — speziell für Lane B — tiefere Container-
  Härtung über den entfernten Netzwerk-Stack hinaus (Seccomp-Profile, MicroVMs; dies
  ist ein Grund, Lane A zu bevorzugen). Siehe
  [Ehrliche Einschränkungen](/docs/network/honest-limitations).
- 🔲 **In Entwicklung: Threshold-Signing.** Die M-von-N-Custodian-Genehmigung wird
  heute in den Autorisierungs- und Audit-Tabellen *aufgezeichnet*; das kryptografische
  Threshold-Key-Tooling, das eine Freigabe ohne M Anteile nicht erzeugbar macht, ist noch
  nicht entwickelt — der aktuelle Versiegelungsschlüssel ist ein gekennzeichneter Einzel-Schlüsselpaar-Ersatz
  (`champollion seal-corpus keygen`), und die Airgap-Score-Bundle-Signatur
  ist ein einzelner Node-Schlüssel (`seal-corpus sign-keygen`), keine Steward-Zeremonie.
- ❌ **Absichtlich nicht vorhanden:** Dass Champollion Ihr Korpus hostet, Ihre
  Schlüssel hält oder Preisgelder verwaltet. Die Hypothesen der Teilnehmer (ihre eigenen Übersetzungen)
  durchlaufen unseren Speicher; der Inhalt Ihres Korpus niemals.

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

- **docker oder podman** — erforderlich für die Methodenausführungs-Spur. Die
  Node erkennt automatisch zuerst docker, dann podman; ist keines von beiden
  vorhanden, verweigert sie den Dienst mit einer deutlichen Meldung.
  Es gibt **keinen Fallback** — Container-Isolation mit `--network=none` ist die
  tragende Garantie, daher läuft ohne eine Container-Laufzeitumgebung nichts.
- **Node.js 20.11+ und die `champollion` npm CLI** — der Harness
  implementiert die Versiegelungs-Chiffre nicht selbst neu. `champollion seal-corpus` (Verben: `keygen`,
  `seal`, `open`, `sign-keygen`, `sign`, `verify`) ist die eine Chiffre-Implementierung
  (X25519-ECDH → HKDF-SHA256 → AES-256-GCM), und die Organisator-Node
  ruft sie extern auf.
- **Eine Node-Konfiguration unter `~/.mt-eval/node.json`.** Jeder `mt-eval node`-Befehl
  verweigert den Start ohne eine solche — führen Sie einen davon einmal aus,
  und die Fehlermeldung nennt den Konfigurationspfad sowie den Ort, an dem die
  Vorlage liegt (sie wird im Harness-Quellcode ausgeliefert, in `mt_eval_harness/contest_node.py`). Die Konfiguration trägt Ihre
  selbst gemeldete `node_id` (die in jeden Anfrage-Fingerabdruck eingebunden wird) und eine
  `contests`-Zuordnung, die auf Ihre Dev-Referenzen und versiegelten Artefakte verweist.
- **Eine Anmeldung.** Es gibt keinen separaten Schritt zur Kontoerstellung: Der
  erste Befehl, der eine Identität benötigt (z. B. `mt-eval contest prepare --self-serve` oder
  `mt-eval publish`), öffnet eine Browser-OAuth-Anmeldung über **GitHub oder Google**
  (Supabase Auth). Die E-Mail-Adresse dieses Kontos ist die Identität, an die
  jede Registry-Zeile gebunden ist — verwenden Sie eine, die Ihre Organisation kontrolliert.
- **Die Intake-Drosselung.** Teilnehmereinreichungen sind pro Einreicher
  ratenbegrenzt auf **standardmäßig 5 pro 24 Stunden** (Anti-Sondierung; pro
  Wettbewerb mit `--intake-daily-limit` zur Vorbereitungszeit festlegbar, oder als
  Standard einer Shared-Task-Edition). Planen Sie Ihren Wettbewerbszeitplan entsprechend.

**Ein ehrlicher Vorbehalt zur Self-Serve-Registrierung.** Auf dem
**standardmäßigen netzwerkgehosteten Endpunkt** stoppt die
Self-Serve-Registrierung (`contest prepare
--self-serve` / `contest register`) derzeit an einer
Produktionsendpunkt-Sperre: Die CLI verweigert mit einer expliziten Meldung,
anstatt in das Produktionsprojekt zu schreiben, solange eine
Richtlinienentscheidung zum Öffnen dieser Tür aussteht. Föderierte
Hosts (Ihr eigenes Supabase-Projekt) sind nicht betroffen. Wenn Sie auf dem
Standard-Host auf die Sperre stoßen, entspricht das dem aktuellen Stand der
Dinge, nicht einer Fehlkonfiguration auf Ihrer Seite —
[eröffnen Sie ein Issue](https://github.com/gamedaysuits), und wir führen die
Registrierung gemeinsam durch.

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

Das Manifest bleibt auf Ihrer Maschine — die Registrierung sendet nur die
inhaltsfreien IDs, Digests und Schwellenwerte. Jede Registerzeile ist
**identitätsgebunden**: die Datenbank zeichnet das angemeldete Konto auf, das
sie registriert hat, und friert diese Bindung gegen spätere Bearbeitungen ein,
und ein Qualifizierer darf nur einen versiegelten Datensatz filtern, den
**dieselbe** Identität registriert hat. Versiegelte Datensätze werden unter
Quarantäne geboren (sie können niemals einen gewöhnlichen Wettbewerb
unterstützen oder auf der öffentlichen Bestenliste ranken), Qualifizierer werden
in einem sicheren Zustand geboren, und die Registrierung ist ratenbegrenzt —
alles durch Datenbank-Trigger unter jedem Client durchgesetzt, einschließlich
unseres. Das Register selbst ist öffentlich lesbar, sodass Sie überprüfen
können, dass Ihr Eintrag genau das aussagt, was Sie versiegelt haben — und
nicht mehr.

**Ehrliche Grenzen.** Die Self-Service-Tür ist ausschließlich für die
Registrierung (nur einfügend auf Datenbankebene). **Qualifizierer-Rotation und
Ausmusterung versiegelter Datensätze bleiben kuratorvermittelt** — öffnen Sie
ein Issue oder kontaktieren Sie das Projekt über
[GitHub](https://github.com/gamedaysuits). Und das Ausführen des
Organisator-Scoring-Knotens in den späteren Schritten (Lebenszyklus-Fortschritte,
Autorisierungserteilungen, Audit-Operationen) ist eine separate,
dienst-berechtigte Spur auf Ihrem eigenen Knoten — der Self-Service endet beim
öffentlichen Register.

## Schritt 5 — Wählen Sie Verwalter und die M-von-N-Regel

Wählen Sie die Personen oder Institutionen aus, die jede Evaluierung gegen Ihren
Korpus gemeinsam genehmigen müssen, und den Schwellenwert (z. B. **3 von 5**).
Verwalter sollten Ihrer Gemeinschaft rechenschaftspflichtig sein, nicht
Champollion — siehe
[Datenverwaltung](/docs/network/sovereignty/data-sovereignty) und
[Eigentum & Bedingungen](/docs/network/sovereignty/ownership-transfer) dafür,
wie gemeinschaftsspezifische Bedingungen festgelegt werden.

**Ehrlichkeitsbox:** das Schwellenwert-*Kryptografie*-Werkzeug
(Schlüsselanteile, sodass eine Erteilung buchstäblich nicht ohne M Signaturen
erstellt werden kann) ist **in Entwicklung**. Heute wird die M-von-N-Regel als
aufgezeichneter Prozess durchgesetzt: jede Zugriffsanfrage tritt in eine
**ausstehende** Warteschlange ein, Verwalterentscheidungen werden aufgezeichnet,
eine Erteilung wird nur für eine autorisierte Anfrage erstellt, jede Erteilung
ist **einmalig, zeitlich begrenzt und an einen bestimmten (Methode,
Korpusversion, Evaluierungsknoten)-Fingerabdruck gebunden**, und jedes Ereignis
— einschließlich blockierter Versuche — landet in einem **Append-only,
hash-verketteten, öffentlich lesbaren Audit-Log**. Die Datenbank verweigert
illegale Zustandsübergänge unter jedem Client und Schlüssel. Was sie noch nicht
verweigern kann, ist eine Kompromittierung des Plattformbetreibers selbst — das
ist es, was die Schwellenwert-Signierung schließt, und bis sie ausgeliefert
wird, sollten Sie „Champollion hält null Schlüsselanteile" als das
angestrebte Designziel behandeln, nicht als eine Eigenschaft, die Sie heute
überprüfen können.

## Schritt 6 — Legen Sie den Preis fest

Entscheiden Sie und veröffentlichen Sie mit dem Wettbewerb:

- **Betrag und Währung.**
- **Sponsor** — wer das Geld bereitstellt.
- **Wo die Gelder liegen** — das Konto Ihrer Organisation oder ein von Ihnen
  benannter Gemeinschaftstreuhänder. **Champollion hält, verwahrt oder leitet
  Preisgelder niemals.** Die Identität des Halters vorab zu veröffentlichen ist
  das, was den Preis glaubwürdig macht; siehe die
  [Risikohinweis zur Sponsor-Voreinstellung](/docs/network/sovereignty/terms-templates#trojan-horse-risks)
  in den Bedingungsvorlagen.
- **Schwellenwertbedingungen** — die Score-Grenze, die eine Methode bestehen
  muss, geschrieben gemäß der
  [Preis-Spezifikation](/docs/network/specifications/prizes): Metrik-Schwellenwerte,
  Anforderungen an die Sprecher-Validierung, Reproduzierbarkeit. Machen Sie die
  Vergabebedingungen aus den veröffentlichten Scores überprüfbar, sodass niemand
  Ihnen (oder uns) glauben muss, ob die Grenze bestanden wurde.

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
  --description "Community-custodied held-out set; scores-only; prize held by <your org/trust>."
```

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

Entwickler bauen und bewerten ihre Methoden auf **öffentlichen** Korpora für
Ihr Sprachpaar — der normale
[Methode-einreichen](/docs/network/getting-started/submit-a-method)-Pfad. Der
`current_qualifier_id` Ihres versiegelten Datensatzes benennt die öffentliche Runde,
die eine Methode bestehen muss, bevor ein versiegelter Durchlauf überhaupt
angefordert werden kann. Dies hält den Sondierungsdruck von Ihrem Korpus fern:
niemand darf auf den versiegelten Datensatz zielen, bis er im Offenen echte
Leistung gezeigt hat.

:::note[Teilnehmer: Auf welchem Endpunkt läuft Ihr Wettbewerb?]
Ein **netzwerkgehosteter** Wettbewerb erfordert keine Einrichtung — der
standardmäßige Endpunkt, mit dem der Harness ausgeliefert wird, trägt die
Wettbewerbsmechanik (Hypothesen-Intake, das Qualifizierer-Gate,
Methodenvorschläge), und `mt-eval contest submit-hypotheses` /
`submit-method` funktionieren sofort.

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

Für jede qualifizierende Methode:

1. Eine **Anfrage** wird gegen Ihren versiegelten Datensatz eingereicht — sie
   tritt in `pending` ein und trägt einen unveränderlichen Fingerabdruck
   von (Methoden-Tarball-Hash, Korpus-ID, Korpusversion, `scores-only`,
   Messung des Evaluierungsknotens).
2. Ihre **Verwalter entscheiden** (M-von-N). Die Genehmigung erstellt eine
   **Erteilung**: einmalig, ablaufend, gültig nur für diesen exakten
   Fingerabdruck.
3. Die Evaluierung läuft in der netzwerkisolierten Sandbox auf **Ihrem** Knoten
   (`mt-eval node run-method`): automatisierte statische Prüfungen, ein Container ohne
   Netzwerkstack, Referenzen außerhalb davon gehalten — oder, für maximale
   Isolation, auf einer echt luftisolierten Maschine mit signierten Bündeln mit
   ausschließlich Scores, die per Wechseldatenträger die Grenze überqueren
   (siehe die Statusbox oben für das, was abgedeckt ist und was nicht).
4. **Nur Scores verlassen sie.** Die `scores-only`-Ausgaberegel ist auf
   Datenbankebene fixiert; einzeleintragsbezogener Text aus Ihrem Korpus wird
   niemals veröffentlicht.
5. Jeder Schritt — Anfrage, Stimmen, Erteilung, Nutzung und jeder blockierte
   Versuch — wird an das öffentliche, hash-verkettete Audit-Log angehängt, das
   Sie (und jeder) wiedergeben können.

## Einreichen einer Methode (für Teilnehmer) — zwei Lanes

Die meisten NMT-Einträge sind nicht exotisch: ein standardmäßiger, feingetunter Transformer und seine
Gewichte. Für diese gibt es eine **bevorzugte, codefreie Lane** — und einen Sandbox-Fallback
für Methoden, die tatsächlich Code sind.

### Lane A — deklaratives Modell (bevorzugt für Standard-NMT)

Wenn Ihre Methode ein neuronales Standardmodell ist, reichen Sie es als **Daten** ein — die
Gewichte, den Tokenizer und die Config — und der Organisator führt es in seiner eigenen vertrauenswürdigen
Inference-Engine aus. **Kein Dockerfile, kein Code, keine Sandbox.** Da nichts von dem, was Sie
einreichen, ausgeführt wird, ist die Sicherheitsprüfung des Organisators eine entscheidbare Formatvalidierung,
anstatt zu versuchen, die Sicherheit von beliebigem Code zu beweisen — eine strikt stärkere
Garantie für Sie und für das Korpus.

```bash
mt-eval contest submit-model <contest-slug> \
  --model-dir ./my-model \          # config.json + model.safetensors + tokenizer.* at the ROOT
  --name "My NMT" --version 2.0 \
  --architecture MarianMTModel \    # must be on the organizer's trusted whitelist
  --method-class pipeline --paradigm neural-nmt \
  --developer "Your Name" --node-id <organizer-advertised-node-id> --agree
```

Die Regeln, die Ihr Bundle erfüllen muss (lokal vor dem Upload validiert und erneut
durch den Node des Organisators):

- **Gewichte sind `safetensors`, niemals Pickle.** Ein PyTorch-`.bin`/`.pt`/`.ckpt`
  ist ein Pickle — beliebiger Code beim Laden — und wird abgelehnt. Exportieren Sie nach
  `model.safetensors` (`safetensors` / `transformers` tun dies nativ).
- **Eine Architektur, die die Engine des Organisators nativ lädt.** `config.json`s
  `architectures` kann jede Architektur sein, die das `transformers` des Hosts implementiert
  (Marian, NLLB/M2M100, mBART, T5, Pegasus und viele mehr) — Hosts sind
  **standardmäßig permissiv**, denn bei `trust_remote_code=False` kommt die Sicherheit
  aus dem codefreien Format, nicht aus dem Architekturnamen (eine nicht unterstützte
  Architektur lädt einfach nicht und führt nichts aus). Ein vorsichtiger Host kann
  eine Allowlist veröffentlichen. Kein `auto_map`, kein `trust_remote_code` — diese schmuggeln
  wieder benutzerdefinierten Code ein und werden immer abgelehnt.
- **Ein deklarativer Tokenizer** (`tokenizer.json` oder ein `sentencepiece` `.model` +
  Vocab) und **nur Daten-Dateien** — keine `.py`/Skripte/Binärdateien im Bundle.

Der Organisator führt es mit `trust_remote_code=False` offline aus, und nur Scores
verlassen das System — veröffentlicht als `declarative-model`, Methodenidentität **konstruktionsbedingt
codefrei**. (Multi-GB-Gewichte: Verwenden Sie `--bundle-out` für die Sneakernet-Lane,
genau wie unten.)

### Lane B — ausführbares Bundle (die Sandbox, für Code-Methoden)

Wenn Ihre Methode tatsächlich Code ist — eine Pipeline, ein LLM-gestützter Hybrid, ein benutzerdefinierter
Decoder — kann sie nicht deklarativ ausgeführt werden, also durchläuft sie stattdessen die netzwerkisolierte
Sandbox. Dies ist die ehrlich gesagt schwächere Lane (sie enthält nicht-vertrauenswürdigen Code,
anstatt dessen Ausführung zu verweigern), verwenden Sie also Lane A, wann immer Ihre Methode ein
Standardmodell ist.

**Der Vertrag für ausführbare Bundles ist stdin/stdout.** Ihr Bundle deklariert
einen Einstiegspunkt (z. B. `method/translate.py`). Innerhalb des Containers führt die
Node des Organisators genau Folgendes aus:

```
cat /eval/source.txt | <your entrypoint> > /output/translations.txt
```

Quellsätze treffen zeilenweise auf stdin ein; Sie schreiben eine Übersetzung pro
Zeile auf stdout. Alles, was Sie als `--method-dir` übergeben haben, wird unter
`method/` im Bundle gepackt und zur Laufzeit **schreibgeschützt unter `/method`** eingebunden —
einschließlich der Gewichte, ohne dass ein Kopieren in das Image erforderlich ist. Der Container hat keinen
Netzwerkstack (`--network=none`), ein schreibgeschütztes Root und ein beschreibbares `/tmp`.

**Ein minimaler Hugging Face transformers-Wrapper:**

```python title="method/translate.py"
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
RUN pip install --no-index --find-links=/wheels torch transformers sentencepiece
# Weights are NOT copied — /method is mounted read-only at run time.
```

Reichen Sie es ein mit:

```bash
mt-eval contest submit-method <contest-slug> \
  --method-dir ./my-method --dockerfile ./Dockerfile \
  --name "My NMT" --version 1.0 \
  --entrypoint method/translate.py \
  --method-class pipeline --paradigm neural-nmt \
  --developer "Your Name" --node-id <organizer-advertised-node-id> \
  --agree
```

(Sie benötigen zunächst einen veröffentlichten Datensatz der Hypothesen-Spur für
den Wettbewerb — das T1-Gate aus Schritt 9 — und `--agree` bestätigt die
Bedingungen der Methodeneinreichung.)

**Gewichte im Multi-GB-Bereich: nutzen Sie die Sneakernet-Spur.** Der
gehostete Intake-Pfad lädt Ihren Tarball als **einzelnen POST** in den Speicher
des Wettbewerbs-Hosts hoch, ist also durch das Upload-Limit dieses Hosts
begrenzt — in Ordnung für Code und kleine Modelle, nicht für Checkpoints im
Multi-GB-Bereich. Der Bundle-Vertrag selbst erlaubt weitaus größere Artefakte
(Tarballs bis 100 GB, gebaute Images bis 150 GB). Überspringen Sie für große
Gewichte den gehosteten Upload:

```bash
# Package + write an exchange directory, no upload:
mt-eval contest submit-method … --offline --bundle-out ./exchange \
  --secret-set <sealed-set-id> --pair eng>crk --developer-email you@example.org
```

Das Austauschverzeichnis gelangt per Wechseldatenträger (oder über einen
beliebigen Kanal, dem Sie beide vertrauen) zum Organisator; dieser nimmt es mit
`mt-eval node import-bundle` auf. Der SHA-256-Hash des Bundles wird in jedem Fall in die
Autorisierungsanfrage eingefroren, sodass das, was läuft, nachweislich das ist,
was Sie vorgeschlagen haben.

**Organisatoren: laden Sie Basis-Images auf Airgap-Maschinen vor.** Da der
Image-Build mit `--network=none` ausgeführt wird, muss das `FROM`-Basis-Image des
Dockerfiles bereits im lokalen Image-Speicher der Maschine vorhanden sein. Auf
einer verbundenen Maschine `docker pull python:3.11-slim && docker save -o base.tar python:3.11-slim`;
tragen Sie `base.tar` mit dem Bundle hinüber; auf der Airgap-Maschine
`docker load -i base.tar`, bevor Sie `mt-eval node run-method` ausführen. Einigen Sie sich mit den
Teilnehmern in Ihren veröffentlichten Wettbewerbsunterlagen auf das/die Basis-Image(s).

## Schritt 10 — Veröffentlichen Sie Scores, vergeben Sie gemäß Ihrem veröffentlichten Schwellenwert

Ergebnisse mit ausschließlich Scores werden wie jeder andere Durchlauf auf der
[Bestenliste](/docs/network/leaderboard/rules) veröffentlicht, gekennzeichnet
als Evaluierungen versiegelter Datensätze. Wenn eine Methode die
Schwellenwertbedingungen besteht, die Sie in Schritt 6 veröffentlicht haben —
einschließlich der
[Sprecher-Validierung](/docs/network/specifications/speaker-validation), die
das Tor Ihrer Gemeinschaft ist, kein automatisiertes — vergeben **Sie** (oder
Ihr Treuhänder) den Preis gemäß Ihren eigenen veröffentlichten Bedingungen. Die
Rolle von Champollion endet bei der Messung.

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
