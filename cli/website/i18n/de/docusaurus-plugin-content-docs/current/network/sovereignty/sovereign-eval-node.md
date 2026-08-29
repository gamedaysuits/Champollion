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
Die Organizer-Node-Software (Wettbewerbsvorbereitung, Hypothesenaufnahme, schwellenwertgesteuerte Bewertung, der netzwerkisolierte Methoden-Executor mit seiner import scan) **ships today** in `mt-eval` — see the [sovereign contest guide](/docs/network/sovereignty/run-a-sovereign-contest). Die **Schwellenwert-Schlüsselzeremonie (Threshold Key Ceremony) und der Sealed-at-Rest-Workflow aus §4 sind ebenfalls heute verfügbar**: `mt-eval node ceremony init|share|verify|restore`, `mt-eval node
seal`, zur Laufzeit präsentierte Quorum-Anteile
(`node run-method --offline --share …`), ein Hash-verkettetes lokales
Autorisierungs-Ledger (`node ledger verify|head`), signierte Score-Manifeste
(`node sign-manifest` / `node verify-manifest`) und die Air-Gap-Werkzeuge aus §2–§3 (`node bundle`, `node manifest`, `node egress-check`). Der
Einzel-Schlüsselpaar-Ersatz bleibt nur für Wettbewerbe bestehen, bei denen der Organisator
die Referenzen vollständig besitzt — jede Oberfläche kennzeichnet, welcher Pfad (Lane) in
Gebrauch ist. Klar ausgedrückt, was v1 **nicht** beinhaltet: Hardware-Remote-Attestierung (TEE) wird nicht beansprucht (§5), und plattformseitiges Threshold-*Signing* (Genehmigungen durch Verwahrer-Telefone gegen gehostete Infrastruktur) ist
zukünftige Arbeit — auf einem Sovereign Node wird die Verwahrung durch physische Präsentation von M von N Anteilen an der Maschine ausgeübt (§4). Und um bezüglich der
Kryptographie präzise zu sein: Dies ist Shamir M-of-N Secret Sharing, wobei der Schlüssel
**während eines autorisierten Durchlaufs im gesperrten Speicher des Nodes rekonstruiert**
(und danach genullt) wird — es ist *keine* Multi-Party Computation, und der Schlüssel existiert
kurzzeitig zusammengesetzt auf Ihrer Offline-Maschine. Schließlich, bis sich das
Community-Zustimmungstor (Consent-Gate) öffnet, läuft der Pfad **nur gegen synthetische Daten**; echte Korpora warten auf diese Zustimmung.
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

1. Installieren Sie ein aktuelles Linux LTS (Ubuntu/Debian) von einem USB-Installationsmedium **bei ausgestecktem Netzwerkkabel**; aktivieren Sie bei der Installation die vollständige Festplattenverschlüsselung.
2. Erstellen Sie auf einer separaten, mit dem Internet verbundenen Maschine das Offline-Bundle —
   `mt-eval node bundle --out <dir>` Wheels `mt-eval[node]` und dessen
   Abhängigkeiten, kopiert alle `--include`-Artefakte und schreibt ein sha256-Manifest über jede Datei. Alles, was der Node benötigt, wird einmalig auf dem IN-Laufwerk übertragen.
3. Übertragen Sie das Bundle auf dem IN-Laufwerk; verifizieren Sie den sha256-Hash jedes Artefakts
   gegen das Manifest **auf dem Node**, bevor Sie es installieren
   (`mt-eval node bundle --verify <dir>`).
4. Erstellen Sie das Signaturschlüsselpaar des Nodes (`mt-eval node keygen`) und notieren Sie
   dessen öffentliche Hälfte — Sie werden diese veröffentlichen, damit jeder Ihre Score-Manifeste verifizieren kann (§5).
5. Von da an sieht die Maschine nie wieder ein Netzwerk — und ein versiegelter Durchlauf kann
   durchgeführt werden, um dies zuerst zu beweisen: `mt-eval node egress-check` (wird auch automatisch mit `assert_airgap` in der Node-Konfiguration erzwungen) verweigert den Dienst, wenn eine
   Route, ein Probe oder DNS irgendeinen Weg nach draußen zeigt. OS-Updates sind ein bewusstes,
   gebündeltes, Hash-verifiziertes Ereignis — kein Hintergrunddienst.

## 3. Transfer-Disziplin (jeder Wettbewerb, beide Richtungen)

Der Air-Gap ist ein *Verfahren*, kein Produkt. Das Verfahren:

- **IN-Laufwerk** transportiert: eingereichte Methodenpakete, Hypothesendateien und
  deren Manifest. Bevor irgendetwas ausgeführt wird, verifiziert der Node den Hash jedes Pakets
  gegen das Manifest und der Import-Scan läuft (er lehnt Methoden ab, die Netzwerkbibliotheken importieren — dies ist heute verfügbar).
- **OUT-Laufwerk** transportiert: das signierte Score-Manifest — aggregierte Scores, die
  Methoden-/Konfigurations-Hashes, zu denen sie gehören, den Kopf des Audit-Logs (Audit-Log Head) — und *sonst nichts*. Segmentweise Ausgaben verbleiben auf dem Node unter der Kontrolle des Organisators; deren Veröffentlichung ist eine separate, bewusste Entscheidung der Community.
- Immer nur eine Richtung pro Laufwerk. Ein Laufwerk, das den Node berührt hat, wird niemals
  automatisch auf einer Online-Maschine gemountet — mounten Sie es `noexec,nodev` und kopieren Sie das
  Manifest manuell herunter.
- `mt-eval node manifest write <drive> --direction in|out` hasht jede
  Datei auf dem Laufwerk vor einem Übergang; `mt-eval node manifest verify`
  auf der Empfängerseite lehnt alles ab, was hinzugefügt, geändert oder entfernt wurde.
- Protokollieren Sie jeden Übergang (Datum, Laufwerk, Manifest-Hash) im Papier- oder
  On-Node-Protokoll des Nodes. Eintönigkeit ist hier gewollt: Das Protokoll ermöglicht es Ihnen, die Frage "Hat jemals etwas anderes das System verlassen?" mit Beweisen zu beantworten.

## 4. Schlüsselverwahrung (M-von-N, in Community-Hand)

Das versiegelte Test-Set ist im Ruhezustand verschlüsselt (encrypted at rest); die Entschlüsselung erfordert ein Quorum von Schlüsselanteilen, die von Verwahrern gehalten werden, **die die Community auswählt** — ein Ältestenrat, eine Sprachbehörde, eine Bildungseinrichtung. Die Plattform hält null Anteile; Champollion kann ein versiegeltes Set nicht entschlüsseln, und auch kein einzelner Verwahrer allein.

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

1. Kündigen Sie den Wettbewerb an; veröffentlichen Sie den öffentlichen Schlüssel des Nodes + den Dev-Set-Schwellenwert.
2. Empfangen Sie Einreichungen online (gewöhnliche Maschine), stellen Sie das IN-Manifest zusammen
   (`mt-eval node manifest write <drive> --direction in`).
3. Tragen Sie das IN-Laufwerk zum Node; verifizieren Sie die Hashes (`node manifest verify`);
   import-scan (`node import-bundle`); queue methods.
4. Verwahrer autorisieren den Durchlauf durch Präsentation eines Quorums von Anteilen (§4 —
   `node run-method <id> --offline --share … --share …`); das versiegelte Set
   wird nur in den Executor entschlüsselt. Kein Quorum, kein Durchlauf — und der Versuch
   wird im Ledger verzeichnet.
5. Ausführen; Scores werden berechnet; segmentweise Ausgaben verbleiben auf der Node-Seite.
6. Abbau (Teardown): Der Arbeits-Klartext wird gelöscht; das Audit-Log wird ergänzt; das Manifest wird signiert.
7. Tragen Sie das OUT-Laufwerk zurück; veröffentlichen Sie Scores + Manifest; jeder kann sie verifizieren
   (`node verify-manifest`).
8. Protokollieren Sie den Übergang; Laufwerke bleiben dediziert; der Node bleibt offline.
