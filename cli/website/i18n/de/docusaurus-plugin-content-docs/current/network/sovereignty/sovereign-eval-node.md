---
sidebar_position: 9
title: "Souveräner Evaluierungsknoten — Hardware & Air-Gap-Betrieb"
description: "Referenzhardware, Air-Gap-Disziplin und Abläufe zur Schlüsselverwahrung für den Betrieb eines gemeinschaftlich kontrollierten Evaluierungsknotens: Der geheime Testdatensatz verlässt niemals Ihren Rechner; die Methoden kommen zu den Daten."
related:
  - label: "Run a Sovereign Contest"
    to: /docs/network/sovereignty/run-a-sovereign-contest
    kind: doc
    note: "The organizer workflow this node runs"
  - label: "The Derived-Artifacts Commitment"
    to: /docs/network/sovereignty/derived-artifacts
    kind: doc
    note: "Who owns what comes out: you"
  - label: "Benchmark Specification §8 (sandbox)"
    to: /docs/network/specifications/benchmark
    kind: doc
    note: "The isolation model the executor implements"
---

# Sovereign Eval Node — Hardware & Air-Gap-Betrieb

Ein Sovereign Eval Node ist eine Maschine, die **Sie** kontrollieren, die ein geheimes Test-Set vorhält und Übersetzungsmethoden dagegen evaluiert. Die Methoden reisen zu den Daten; die Daten reisen niemals. Scores — und ausschließlich Scores — werden ausgegeben.

Diese Seite ist die praktische Spezifikation: welche Hardware Sie kaufen (oder umwidmen) sollten, wie Sie sie einrichten und die Betriebsdisziplin, die "das Test-Set hat die Maschine nie verlassen" zu einer Tatsache macht, die Sie belegen können, statt zu einem Versprechen, dem Sie vertrauen müssen.

:::info[Was heute verfügbar ist vs. was als in Arbeit gekennzeichnet ist]
Die Software für den Organisator-Node **ist heute verfügbar** in `mt-eval` – siehe den
[Leitfaden für souveräne Wettbewerbe](/docs/network/sovereignty/run-a-sovereign-contest):
Wettbewerbsvorbereitung und -versiegelung, das Public-Qualifier-Gate, das **vom
Node selbst bei jeder Einreichung erneut ausgeführt wird, bevor ein Treuhänder
etwas genehmigen muss**, Schwellenwert-gestütztes Scoring und der netzwerkisolierte Method-Executor
mit seinem Import-Scan. Was ein Node akzeptiert, ist ein **Modell oder eine Methode** – ein
Artefakt, das er ausführen kann. Das Hochladen von Übersetzungen eines quelloffenen Blindsets wurde
am 06.09.2026 als Wettbewerbs-Einreichungspfad eingestellt und das entsprechende Verb gelöscht; eine
quelloffene Runde existiert nur noch als optionale Diagnose für Organisatoren, und
selbstberichtete Scores gehören auf die offene Bestenliste, bei der es sich um eine öffentliche,
nach Korpus und Sprachpaar-Richtung indizierte Übersicht und nicht um einen Wettbewerb handelt.
Die **Schwellenwert-Schlüsselzeremonie und der Sealed-at-Rest-Workflow aus §4 sind ebenfalls
heute verfügbar**: `mt-eval node ceremony init|share|verify|restore`, `mt-eval node
seal`, zur Laufzeit vorgelegte Quorum-Anteile
(`node run-method --offline --share …`), ein hash-verkettetes lokales
Autorisierungs-Ledger (`node ledger verify|head`), signierte Score-Manifeste
(`node sign-manifest` / `node verify-manifest`) und das Air-Gap-Tooling
aus §2–§3 (`node bundle`, `node manifest`, `node egress-check`). Score-Bundles
werden **auf dem Node in Python signiert** – das Offline-Bundle benötigt keine
Node.js-Laufzeitumgebung – und dasselbe Format für abgetrennte Signaturen lässt sich mit
beiden Implementierungen verifizieren. Organisatorseitiges **Request-Staging ist ebenfalls verfügbar**:
`mt-eval node stage-request` schreibt genau die Exchange-Anfrage, die ein Online-Relay
schreiben würde – aus einer Bundle-Datei und ganz ohne Datenbank (für einen
Testlauf oder ein Deployment, das nie verbunden wird), vorvalidiert, wie ein Import
sie validieren würde, und an die ID des Nodes gebunden; die zurückgegebenen Scores sind
manifest-verifizierbar, werden jedoch nicht per Relay veröffentlicht, da kein Autorisierungsdatensatz
existiert, gegen den sie veröffentlicht werden könnten. Die
Ersatzlösung mit einem einzelnen Schlüsselpaar verbleibt nur für Wettbewerbe, bei denen der Organisator
die Referenzen vollständig besitzt – jede Oberfläche kennzeichnet, welcher Pfad verwendet
wird. Klar ausgedrückt: Was v1 **nicht** beinhaltet: Hardware-Remote-Attestation
(TEE) wird nicht beansprucht (§5), und plattformseitiges Schwellenwert-*Signieren*
(Genehmigungen durch Treuhänder per Smartphone gegen eine gehostete Infrastruktur) ist
zukünftige Arbeit – auf einem souveränen Node wird die Verwahrung dadurch ausgeübt, dass
physisch M von N Anteilen am Rechner vorgelegt werden (§4). Und um bezüglich der
Kryptographie präzise zu sein: Dies ist Shamirs M-von-N-Secret-Sharing, bei dem der Schlüssel
**während eines autorisierten Laufs im gesperrten Speicher des Nodes rekonstruiert**
(und anschließend genullt) wird – es handelt sich *nicht* um Multi-Party Computation, und der Schlüssel
existiert für kurze Zeit zusammengesetzt auf Ihrem Offline-Rechner. Schließlich läuft dieser Pfad,
bis das Community-Einwilligungs-Gate geöffnet wird, **ausschließlich mit synthetischen
Daten**; echte Korpora warten auf diese Einwilligung.
:::

## 1. Referenz-Hardware

Der Executor führt in sich geschlossene Methoden aus: lokale NMT-Dekodierung, FST/Morphologie-Validierung und Metrik-Berechnung. Innerhalb des Air-Gaps finden keine Cloud-Aufrufe statt (LLM-API-Methoden sind genau die Klasse, die ein Air-Gapped-Node ablehnt — siehe die Methodenklassen der [Benchmark-Spezifikation](/docs/network/specifications/benchmark)).

| Stufe | Spezifikation | Geeignet für | Ungefähre Kosten (2026) |
|---|---|---|---|
| **Minimum** (funktioniert) | 4-Kern x86_64 oder Apple/ARM, 16 GB RAM, 500 GB SSD | Metrik- + FST-Evaluierung, CPU-Dekodierung kleiner NMT-Modelle (langsam, aber korrekt) | US$0 (ein ausgemusterter Laptop) – $400 gebraucht |
| **Empfohlen** | 8-Kern, 32 GB RAM, 1 TB NVMe, NVIDIA GPU ≥ 12 GB VRAM (z. B. RTX 4070-Klasse) | Komfortable NMT-Dekodierung für vollständige Testbatterien; parallele Methodenevaluierung | ~US$900–1.600 (Small-Form-Workstation) |
| **Institutionell** | 16-Kern, 64–128 GB RAM, 2 TB NVMe, 24 GB+ VRAM | Wettbewerbe mit vielen Methoden, große Batterien, archivierter Ciphertext-Speicher | ~US$2.500–4.000 |

Zwingende Anforderungen auf jeder Stufe:

- **Keine Funkmodule, oder Funkmodule, von denen Sie beweisen können, dass sie ausgeschaltet sind.** Am besten: ein Desktop ohne
  WLAN/Bluetooth-Karte. Akzeptabel: ein Laptop, dessen WLAN-Karte
  physisch entfernt oder in der Firmware deaktiviert wurde. "Flugmodus" ist kein
  Air-Gap.
- **Eine kabelgebundene Netzwerkkarte (NIC), die Sie ausgesteckt lassen können.** Das Fehlen des Kabels ist die am besten
  überprüfbare Netzwerkkontrolle, die es gibt.
- **Zwei dedizierte USB-Laufwerke** (beschriftet mit IN und OUT — siehe §3) und idealerweise
  eine Maschine, deren andere Anschlüsse Sie in der Firmware deaktivieren.
- **Vollständige Festplattenverschlüsselung** (LUKS unter Linux), damit ein gestohlener Node nutzlos ist, und
  eine USV (UPS), falls Ihre Stromversorgung unzuverlässig ist — eine Evaluierung, die mitten in der Batterie unterbrochen wird,
  ist zwar wiederherstellbar, aber warum sollte man es darauf ankommen lassen.

## 2. Software-Einrichtung (einmalig, ~eine Stunde)

1. Installieren Sie ein aktuelles Linux-LTS (Ubuntu/Debian) von einem USB-Installationsmedium **bei
   ausgestecktem Netzwerkkabel**; aktivieren Sie bei der Installation die vollständige Festplattenverschlüsselung.
2. Erstellen Sie auf einem separaten Online-Rechner mit installiertem Harness
   (`python3 -m pip install mt-eval-harness`, 0.2.0 oder höher) das Offline-Bundle.
   `mt-eval node bundle --out <dir>` führt vier Schritte aus:
   - erstellt Wheels des installierten Harness und seiner Abhängigkeiten (oder eines bestimmten Wheels
     mit `--wheel <file>`);
   - ruft die Kryptographie-Bibliotheken anhand der im Harness mitgelieferten,
     hash-gepinnten Liste ab;
   - kopiert etwaige `--include`-Artefakte;
   - schreibt ein SHA256-Manifest über jede Datei.

   Schließen Sie die **Sprachkarten** für jede Sprache ein, die der Node bewerten wird
   (`--include <cards-dir>`): Der Node bestimmt das Sprachpaar eines Laufs anhand eines
   lokalen Sprachkarten-Index und ruft niemals eine Karte extern ab. Keines der
   installierten Pakete liefert ein Sprachkarten-Verzeichnis pro Sprache mit. Erstellen
   Sie es daher hier mit der `champollion`-CLI,
   eine `<code>.json` pro Sprache (`champollion network card eng --json >
   node-cards/eng.json`, danach dasselbe für Ihre andere Sprache), und übergeben Sie
   `--include node-cards`. Auf dem Node befindet es sich unter
   `<dir>/artifacts/node-cards`; verweisen Sie mit `cards_dir` dorthin. Alles, was der Node benötigt,
   wird einmalig über das IN-Laufwerk übertragen. Erstellen Sie das Bundle auf derselben
   Python-Version, die der Node ausführt (3.11 oder 3.12); die gepinnte Liste weist jede
   andere ab.
3. Übertragen Sie das Bundle auf dem IN-Laufwerk; überprüfen Sie den SHA256-Hash jedes
   Artefakts anhand des Manifests **auf dem Node**, bevor Sie es installieren
   (`mt-eval node bundle --verify <dir>`). Installieren Sie anschließend ausschließlich aus den gebündelten
   Wheels:
   `python3 -m pip install --no-index --find-links <dir>/wheels 'mt-eval-harness[node]'`.
   Das `[node]`-Extra ist die `cryptography`-Bibliothek, die `mt-eval node
   keygen` and the custody ceremony need; a plain `mt-eval-harness`-Installation
   fehlt.
4. Erstellen Sie das Signaturschlüsselpaar des Nodes (`mt-eval node keygen`) und erfassen
   Sie dessen öffentlichen Teil – Sie werden ihn veröffentlichen, damit jeder Ihre Score-Manifeste
   überprüfen kann (§5).
   Der Node benötigt außerdem **Docker** (oder Podman), das jede eingereichte
   Methode in einem Container ohne Netzwerk ausführt; ist keines von beiden im `PATH`,
   verweigert `mt-eval node run-method` dies in einer Zeile unter Nennung beider, und die
   Anfrage bleibt ausführbar. Er benötigt außerdem eine Node-Konfiguration unter
   `~/.mt-eval/node.json`. Diese Datei benennt den Node, sein Kartenverzeichnis
   (`cards_dir` oder `MT_EVAL_CARDS_DIR`) und die Wettbewerbe, die er bedient.
   `mt-eval node init` schreibt eine Starter-Konfiguration mit allen Schlüsseln, die ein Scoring-Node
   liest, einschließlich des Public-Qualifier-Gates (`qualifier` + `dev_corpus`,
   gegen das der Node jede Methode erneut ausführt, bevor er ein versiegeltes Set öffnet)
   und der Slots des versiegelten Holdouts (`holdout_set_id` + `holdout_corpus`;
   löschen Sie diese für einen Wettbewerb ohne Holdout).
   `mt-eval node init --from-contest <out>` füllt die Werte des Wettbewerbs anhand
   des Manifests aus, das `contest prepare` geschrieben hat (die Zuordnung finden Sie im
   [Leitfaden für souveräne Wettbewerbe](/docs/network/sovereignty/run-a-sovereign-contest#organizer-prerequisites)).
   Sein `sandbox`-Block ist die Ressourcenrichtlinie des Nodes (4 GB RAM, 4 GB Scratch-Speicher,
   30 Minuten pro Lauf, keine GPU), und `contest submit-method` deklariert standardmäßig genau
   diese Werte; veröffentlichen Sie daher Ihre Obergrenzen zusammen mit dem Wettbewerb, wenn Sie
   diese ändern.
   Eine Node-Konfiguration, die nur die Hälfte dieses Gates deklariert, wird beim Start abgewiesen.
   `mt-eval node ledger verify` prüft die ausgefüllte Datei: Es verweigert den
   ersten verbliebenen `<...>`-Wert oder eine deklarierte Datei, die sich nicht auf dem Node befindet,
   gibt aus, was geprüft wurde, und spielt anschließend die Hash-Kette des lokalen Ledgers erneut ab. Der
   verbundene Rechner, der Anfragen an den Node weiterleitet, benötigt außerdem den
   **Service-Role-Schlüssel** der Datenbank (`MT_EVAL_SUPABASE_SERVICE_KEY`). Dieser Schlüssel
   wird auf dem Air-Gap-Node selbst niemals benötigt.
5. Von da an sieht der Rechner niemals ein Netzwerk – und ein versiegelter Lauf kann
   so eingerichtet werden, dass er dies zuerst nachweist: `mt-eval node egress-check` (wird auch
   automatisch mit `assert_airgap` in der Node-Konfiguration erzwungen) bricht ab, wenn eine
   Route, ein Probe oder DNS irgendeinen Weg nach außen anzeigt. Betriebssystem-Updates sind ein bewusstes,
   gebündeltes, hash-verifiziertes Ereignis – kein Hintergrunddienst.

## 3. Transfer-Disziplin (jeder Wettbewerb, beide Richtungen)

Der Air-Gap ist ein *Verfahren*, kein Produkt. Das Verfahren:

- **IN-Laufwerk** überträgt: eingereichte Methoden- oder Modell-Bundles und deren
  Manifest. Bevor irgendetwas ausgeführt wird, überprüft der Node den Hash
  jedes Pakets anhand des Manifests, und der Import-Scan wird ausgeführt (er weist Methoden ab,
  die Netzwerk-Bibliotheken importieren – dies ist bereits heute verfügbar).
- **OUT-Laufwerk** überträgt: das signierte Score-Manifest – aggregierte Scores, die
  zugehörigen Methoden-/Konfigurations-Hashes, den Audit-Log-Kopf – und *nichts
  weiter*. Segmentweise Ausgaben verbleiben auf dem Node unter der Kontrolle
  des Organisators; deren Veröffentlichung ist eine separate, bewusste Entscheidung der Community.
- Grundsätzlich nur eine Richtung pro Laufwerk. Ein Laufwerk, das mit dem Node in Kontakt war, wird auf
  einem Online-Rechner niemals automatisch eingehängt – hängen Sie es `noexec,nodev` ein und kopieren Sie das
  Manifest manuell herunter.
- `mt-eval node manifest write <drive> --direction in|out` berechnet den Hash jeder
  Datei auf dem Laufwerk vor einem Übergang; `mt-eval node manifest verify`
  auf der Empfängerseite weist alles ab, was hinzugefügt, geändert wurde oder fehlt.
- Protokollieren Sie jeden Übergang (Datum, Laufwerk, Manifest-Hash) im Papier- oder
  Node-internen Protokoll. Diese Nüchternheit ist der Zweck: Das Protokoll ermöglicht es Ihnen, die Frage „Hat
  jemals etwas anderes das System verlassen?“ mit Nachweisen zu beantworten.

## 4. Schlüsselverwahrung (M-von-N, in Community-Hand)

Das versiegelte Testset ist im Ruhezustand verschlüsselt; die Entschlüsselung erfordert ein Quorum von
Schlüsselanteilen, die von Treuhändern gehalten werden, welche **die Community auswählt** – ein Ältestenrat,
eine Sprachbehörde oder eine Bildungseinrichtung. Die Konzeption weist der
Plattform null Anteile zu, sodass Champollion ein versiegeltes Set nicht entschlüsseln könnte –
ebenso wenig wie ein einzelner Treuhänder allein. Die nachfolgende Zeremonie wurde bislang noch nicht
mit echten Treuhändern durchgeführt.

Die Zeremonie (eine Offline-Sitzung; die mitgelieferten Werkzeuge automatisieren dies):
`mt-eval node ceremony init` generiert den Set-Schlüssel auf dem Node, teilt ihn
in N Anteile auf (beliebige M rekonstruieren ihn; weniger offenbaren nichts — die Aufteilung ist
informationstheoretisch sicher) und nullt den Schlüssel im selben Atemzug; `ceremony share` gibt den Anteil jedes Verwahrers als Datei für ein Token plus ein
ausdruckbares Papier-Backup aus; `ceremony verify` beweist, dass die verteilten Kopien
sich rekonstruieren lassen — ohne irgendetwas dauerhaft zu speichern; `ceremony share
--wipe-originals` then destroys the node's own copies. `mt-eval node
seal` verschlüsselt den Korpus mit dem öffentlichen Schlüssel der Zeremonie: Der Node speichert den
Ciphertext und eine inhaltsfreie Metadatenkarte, sonst nichts. Von da an bedeutet die
Durchführung einer Evaluierung, dass Verwahrer physisch M von N Anteilen präsentieren
(`node run-method --offline --share …`): Der Schlüssel wird **nur im gesperrten Speicher des Executors** wiederhergestellt,
für diesen einen an die Genehmigung gebundenen Durchlauf verwendet und genullt — er berührt nie wieder die Festplatte. Jede Anfrage, jede Abstimmung, jede Genehmigung und jede Nutzung wird an ein Hash-verkettetes lokales Ledger angehängt (`node ledger verify`), und ein
Versuch ohne Quorum wird abgelehnt *und* aufgezeichnet.

Ein ehrlicher Satz über den Mechanismus: Dies ist Shamir Secret Sharing
mit Rekonstruktion im Speicher der von der Community gehaltenen Offline-Maschine —
keine Multi-Party Computation. Während eines autorisierten Durchlaufs existiert der Schlüssel kurzzeitig,
zusammengesetzt, auf Hardware, die die Community physisch kontrolliert; die
Eigenschaften, die er verteidigt, sind *kein dauerhafter Schlüssel auf der Festplatte*, *kein Durchlauf ohne anwesendes Quorum* und *jede Nutzung wird in das überprüfbare Ledger verkettet*.
Plattformseitiges Threshold-Signing, bei dem sich der Schlüssel nirgendwo zusammensetzt,
bleibt zukünftige Arbeit und wird überall dort als solche gekennzeichnet, wo es erwähnt wird.

Rotation und der Austausch von Verwahrern erfordern eine erneute Durchführung der Zeremonie; der Verlust von mehr als
N−M Anteilen bedeutet, dass das Set aus der Quellkopie der Community neu versiegelt wird —
die Community behält immer ihr eigenes Klartext-Original, da der
[Besitz](/docs/network/sovereignty/data-sovereignty) nie bei uns lag.

## 5. Was "attestiert" hier bedeutet — und was nicht

Jede Evaluierung erzeugt ein **signiertes Score-Manifest**: die Signatur des Nodes
über die Scores, die Methodenpaket-Hashes, die Korpus-Prüfsumme und den
Kopf des Append-only-Audit-Logs. Jeder, der den veröffentlichten öffentlichen Schlüssel des Nodes besitzt, kann verifizieren — `mt-eval node verify-manifest <manifest>
--pubkey <published .pub.json>` —, dass *dieser Node* *diese Scores*
für *genau diese Eingaben* erzeugt hat, und das Hash-verkettete Log macht stille Änderungen an der Historie erkennbar.

Das ist **Software-Attestierung** — sie beweist die Integrität des Datensatzes, und
das ist es, was v1 bietet. Sie beweist **nicht**, welches Silizium den Durchlauf ausgeführt hat:
Hardware-Remote-Attestierung (TEEs) ist zukünftige Arbeit und wird bewusst nicht beansprucht. Die ehrliche Sicherheitsaussage für v1: Die Disziplin des Organisators
(§3) plus signierte Manifeste plus die physische Verwahrung der Maschine durch die Community
bilden den Vertrauensanker — was genau der Ort ist, an dem ein Sovereignty-First-Design das Vertrauen ohnehin ansiedeln möchte.

## 6. Die Betriebsschleife

1. Kündigen Sie den Wettbewerb an; veröffentlichen Sie den öffentlichen Schlüssel des Nodes + den Schwellenwert für das Dev-Set.
2. Nehmen Sie Einreichungen online entgegen (auf einem gewöhnlichen Rechner), stellen Sie das IN-Manifest zusammen
   (`mt-eval node manifest write <drive> --direction in`).
3. Bringen Sie das IN-Laufwerk zum Node; überprüfen Sie die Hashes (`node manifest verify`);
   import-scan (`node import-bundle`); queue methods. An entrant's offline
   Proposal trifft mit Status *pending* ein. Der Node prüft es zuerst (`node run-method
   <id> --offline` führt den Qualifier des Einreichenden auf dem öffentlichen Dev-Set erneut aus
   und prüft eine Container-Laufzeitumgebung für einen Code-Beitrag, öffnet nichts Versiegeltes und
   protokolliert ein Bestehen im lokalen Ledger). Anschließend erfasst ein Treuhänder die Entscheidung
   auf dem Node (`node approve <id> --offline --actor <custodian>`, wird abgewiesen,
   bis diese Prüfung bestanden ist, oder `node deny … --offline --reason …`: eine Stimme
   + Autorisierung im lokalen Ledger und ein mit dem Node-Schlüssel signierter Datensatz;
   `node list --offline` zeigt an, was aussteht). Der versiegelte Lauf (erneut `node run-method
   --offline`) weist ein ausstehendes Proposal ab, bis diese Genehmigung
   erfasst wurde und sich verifizieren lässt.
4. Treuhänder autorisieren den Lauf durch Vorlage eines Quorums an Anteilen (§4 –
   `node run-method <id> --offline --share … --share …`); das versiegelte Set
   wird ausschließlich im Executor entschlüsselt. Kein Quorum, kein Lauf – und der Versuch
   wird im Ledger protokolliert.
5. Ausführen; Scores werden berechnet; segmentweise Ausgaben verbleiben auf dem Node.
6. Bereinigung: Arbeits-Klartext wird sicher gelöscht; Audit-Log wird fortgeschrieben; Manifest wird signiert.
7. Bringen Sie das OUT-Laufwerk zurück; veröffentlichen Sie Scores + Manifest; jede Person kann die Verifizierung durchführen
   (`node verify-manifest`).
8. Protokollieren Sie den Übergang; Laufwerke bleiben zweckgebunden; der Node bleibt offline.
