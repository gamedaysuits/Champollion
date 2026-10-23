---
title: "Einen versiegelten Test ausrichten und einem Projekt beitreten"
slug: /agents/hosting-and-joining
description: "Zwei Einstiegswege jenseits der Entwicklung: einen versiegelten Test mit mt-eval contest und mt-eval node ausrichten (es funktioniert, läuft aber noch nicht ganz auf Schienen, und die von den Organisator:innen ausgewählten Treuhänder:innen halten die Schlüsselanteile) und einem registrierten Projekt mit mt-eval project beitreten – jeder Befehl, was er wohin sendet und was er niemals zeigt."
---

# Einen versiegelten Test hosten und einem Projekt beitreten

Zwei Pfade neben den Build-Schienen. Beide sind einfache `mt-eval`-Befehle; keiner
ist ein Schritt, den `champollion next` nennt.

## Einen versiegelten Test hosten

**Ehrlicher Status.**

- Es funktioniert: Das Vorbereiten eines versiegelten Datensatzes, eine Schlüsselzeremonie, das Ausführen von Beiträgen auf einem
  vom Internet getrennten Node, Urteile und Ranglisten sind allesamt Befehle mit Tests.
- **Es befindet sich noch nicht auf den Schienen.** `champollion new --kind task` wird verweigert;
  die einzige Reise ist die der Sprache. Stellen Sie sich auf einen längeren manuellen Ablauf ein und
  folgen Sie dem [Wettbewerbs-Leitfaden](/docs/network/sovereignty/run-a-sovereign-contest).
- **Die Schlüsselanteile werden von Treuhändern verwahrt, die der Organisator benennt.** Nichts im
  Code ernennt oder überprüft sie. Für keinen Test wurden bisher gemeinschaftliche Schlüsseltreuhänder
  ernannt.
- **Champollion besitzt keinen Schlüsselanteil und keinen privaten Schlüssel.** Die Zeremonie läuft auf
  dem Rechner des Organisators, und bei der Registrierung werden nur Kennungen, Prüfsummen
  und der Qualifikationsschwellenwert übertragen – niemals ein Schlüssel, ein Anteil oder die Sätze.

**Hinweis.** Das Hosting entscheidet darüber, was mit den Sätzen der Menschen geschieht und wer sie
entschlüsseln kann. Jeder der folgenden Schritte ist die Entscheidung des Organisators; führen Sie jeden davon nur aus,
wenn dieser darum bittet.

### Was erstellt wird

`mt-eval contest prepare` teilt das Korpus des Organisators auf:

| Flag | Datensatz | Wer ihn sieht |
|---|---|---|
| `--dev-size` (erforderlich) | Der Qualifikator: Quelle und Referenzen | Öffentlich, freigegeben aus `<out>/public/` |
| `--secret-size` | Der versiegelte Test, gegen den der Wettbewerb registriert ist | Niemand: versiegelt in `<out>/local/` |
| `--sealed-holdout-size` (benötigt `--secret-size`) | Ein zweiter versiegelter Teil, bewertet, aber bis zum Abschluss zurückgehalten | Niemand |

`--seed`, `--qualifier-threshold` (über 0) und `--license` sind erforderlich – es wird keine
Lizenz vorausgesetzt. `--custodian-group` und `--threshold-pubkey` sind erforderlich
(der Schlüssel, für den die versiegelten Datensätze verschlüsselt werden). Der Klartext jedes versiegelten Datensatzes
wird nach der Versiegelung gelöscht; `<out>/local/manifest.json` enthält die Anleitung und
verlässt den Rechner nie. Die Versiegelung führt `champollion network seal-corpus seal` aus, daher muss die
`champollion`-CLI installiert sein.

### Verwahrung

**Schwellenwert-Verwahrung (M-von-N).** Auf dem vom Internet getrennten Node:

```bash
mt-eval node ceremony init --dir <ceremony> --set <sealed set id> --group <group id> --quorum 3 --shares 5 \
  --custodian <name 1> --custodian <name 2> --custodian <name 3> --custodian <name 4> --custodian <name 5>
mt-eval node ceremony share --dir <ceremony> --custodian <name 1> --dest <their token>
mt-eval node ceremony verify --dir <ceremony> --share <a> --share <b> --share <c>
mt-eval node ceremony share --dir <ceremony> --wipe-originals
```

`init` erzeugt den Schlüssel, teilt ihn mit Shamirs Schema auf und überschreibt ihn in einem
Aufruf mit Nullen; der Befehl schreibt `ceremony.json` (das öffentliche Protokoll) und eine Anteilsdatei pro
Treuhänder. `--set` muss die ID des geheimen Datensatzes sein und `--group` der Wert,
den `--custodian-group` bei prepare verwenden wird – prepare überprüft dies nicht, und eine
Diskrepanz fällt erst auf, wenn ein Durchlauf verweigert wird. Übergeben Sie prepare das Protokoll
der Zeremonie: `--threshold-pubkey <ceremony>/ceremony.json`.

**Sperre.** Ein versiegelter Datensatz wird nur durch `mt-eval node run-method <id>
--offline --share … --share …` mit mindestens M Anteilen von verschiedenen
Treuhändern entschlüsselt, deren IDs mit dem Datensatz übereinstimmen. Die Schwellenwert-Verwahrung läuft nur auf diesem
Offline-Pfad.

**Einzelschlüssel.** `champollion network seal-corpus keygen --out <dir>` erstellt ein
Schlüsselpaar; wer dessen Schlüsseldatei besitzt, kann alleine entschlüsseln. Dies ist der Pfad,
den der verbundene Node nutzt.

### Der Ablauf für Organisatoren (Schwellenwert-Verwahrung)

```bash
mt-eval node bundle --out <bundle>                    # on a connected machine: the node's install
mt-eval node bundle --verify <bundle>                 # on the node
mt-eval node keygen --out <keys>
# the ceremony, above
mt-eval contest prepare --corpus master.json --slug <slug> --name "<name>" --pair '<src>><tgt>' \
  --dev-size <n> --secret-size <n> --seed <n> --qualifier-threshold <chrF++> --license <licence> \
  --custodian-group <group id> --threshold-pubkey <ceremony>/ceremony.json --out ./<slug> --no-register
mt-eval contest register --manifest ./<slug>/local/manifest.json
mt-eval node init --from-contest ./<slug>
mt-eval node egress-check
mt-eval node import-bundle <exchange>                 # entries, carried in
mt-eval node run-method <request id> --offline --share <s1> --share <s2> --share <s3>
mt-eval node export-scores <exchange>
mt-eval node verdicts --contest <slug> --out verdicts.json --metric chrf_plus_plus --tie-test ar \
  --alpha <a> --n-resamples <n> --seed <n>
mt-eval contest rank <slug>
mt-eval contest close <slug> --node-verdicts verdicts.json --verify-key <score-signing public key>
```

`node init --from-contest` richtet die Schwellenwert-Verwahrung ein, wenn der Datensatz für
einen Zeremonienschlüssel versiegelt wurde. Teilnehmer qualifizieren sich am öffentlichen Entwicklungsdatensatz (`mt-eval contest
qualify`) and submit methods or models (`mt-eval contest submit-method`,
`mt-eval contest submit-model`, beide mit einem `--offline --bundle-out`-Pfad).
Der [Node-Leitfaden](/docs/network/sovereignty/sovereign-eval-node) enthält jeden
Node-Befehl.

### Was eine Verbindung benötigt und wessen

| Funktioniert offline | Erfordert eine Anmeldung | Erfordert den Dienstschlüssel der Datenbank |
|---|---|---|
| `contest prepare --no-register`, `contest qualify` (mit `--offline-qualifier-id`, `--offline-threshold`), `contest validate`, `submit-* --offline`, jedes `node ceremony`, `node seal`, `node keygen`, `node init`, `node import-bundle`, `node run-method --offline`, `node export-scores`, `node verdicts`, `node egress-check` | `contest register`, `contest create`, Online-`submit-*`, `contest open-intake`, `contest close-intake`, `contest close` | `contest prepare` ohne `--no-register` oder `--self-serve`, `node serve`, `node list`, `node approve`, `node deny`, Online-`node run-method`, `node relay` und `contest close`, wenn Ergebnisse zurückgehalten wurden |

Der Dienstschlüssel gehört der Person oder Stelle, die die Datenbank betreibt. Ein externer Organisator
führt diese Befehle gegen eine eigene Datenbank aus (`MT_EVAL_SUPABASE_URL` und deren
Schlüssel) oder bleibt auf dem Offline-Pfad – dessen Bewertungen anhand ihrer
signierten Manifeste überprüfbar sind, aber keinen Eintrag in der öffentlichen Bestenliste erhalten. **Hinweis.** Setzen Sie
`MT_EVAL_ALLOW_PROD` niemals: Es hebt die Weigerung der Werkzeuge auf, in die standardmäßige
Produktionsdatenbank zu schreiben, und das ist nicht die Entscheidung eines Agenten.

## Einem Projekt beitreten

Ein **registriertes Projekt** ist ein Sprachprojekt, das dessen Eigentümer gelistet hat, damit andere
helfen können – mit Dateien: Sätze, Wortlisten oder Methoden (Begutachtungszeit und
Rechenleistung werden noch nicht angeboten). Die folgenden `mt-eval
project`-Befehle kommunizieren mit der Projektdatenbank
(`MT_EVAL_SUPABASE_URL`). Jeder Unterbefehl außer `list` (anonym) und
`review` (des Betreibers) erfordert eine Anmeldung (eine zwischengespeicherte
Sitzung, `MT_EVAL_REFRESH_TOKEN` oder eine interaktive GitHub- oder Google-Anmeldung);
das Konto entspricht der E-Mail-Adresse der Anmeldung.

**Die Regeln.**

- **Vor der Listung überprüft.** Ein neues Projekt beginnt als `pending_review`; es wird
  erst nach einer Überprüfung gelistet. Ein Eigentümer kann ein Projekt schließen und niemals listen lassen.
- **Der Eigentümer wird nach eigener Wahl benannt** (`--owner-name`). Die Projektzeile
  enthält keine E-Mail-Adresse; das Konto des Eigentümers wird getrennt aufbewahrt und ist nur für diesen lesbar.
- **Keine E-Mail in einer Auflistung.** `project list` ist anonym und zeigt Namen und
  Zahlen; `project offers` gibt Helfer mit dem von ihnen angegebenen Namen aus (`--as`).
  Das Konto des Eigentümers kann die Konto-E-Mail eines Helfers weiterhin im Datensatz
  des Angebots einsehen, und der Zustimmungshinweis erfasst beide Konten.
- **Angebote werden von beiden gehalten.** Die Annahme erzeugt einen Zustimmungshinweis, der nennt, wer
  es eingereicht und wer es autorisiert hat.
- **Aus einer Datei wird nichts ausgegeben.** Nur Namen, Anzahlen und Status.

### Eigentümer

```bash
mt-eval project register --project . --name "<project name>" --owner-name "<as they want to be named>" \
  --purpose "<what the translations are for>"
mt-eval project ask <slug> --kind sentences --what "<what would help>" --how-many 200 --terms "<their terms>"
mt-eval project offers <slug>
mt-eval project accept <offer id> --into .
mt-eval project decline <offer id> --why "<reason>"
```

- `register` liest das Sprachpaar aus `champollion.project.json` (und den Zweck,
  sofern nicht `--purpose`); optional `--slug`, `--domain`, `--register`, `--about`.
  Höchstens 5 Registrierungen pro Konto innerhalb von 24 Stunden.
- `ask` `--kind` ist `sentences`, `word-list` oder `method`; Anfragen werden nur angezeigt, während
  das Projekt gelistet ist.
- `accept` lädt die Datei herunter, **verifiziert deren sha256** (bei einer
  Abweichung verweigert), schreibt `inbox/offer-<offer id>-<file name>` und
  `consent/offer-<offer id>.json` (`offer_id`, `file`, `sha256`,
  `submitted_by`, `authorized_by`, `terms`, `note`, `held_by`) und markiert das
  Angebot anschließend als angenommen. Die Datei wird dann wie jede andere importiert –
  `champollion data add inbox/<file>` – und die Bedingungen ihrer Rechteinhaber werden abgefragt.
- **Hinweis.** Die `--terms` des Helfers stehen im Zustimmungshinweis. Die Antworten, die Sie
  mit `champollion data mark` erfassen, dürfen diese nicht lockern.

### Helfer

```bash
mt-eval project list
mt-eval project offer <slug> <file> --as "<your name>" --terms "<what it may be used for>" --ask <ask id> --note "<note>"
mt-eval project withdraw <offer id>
```

- `offer` lädt eine nicht-leere Datei von höchstens 50 MB in den privaten Speicher
  des Projekts hoch, zusammen mit ihrem sha256, und zwar nur für ein gelistetes Projekt. Höchstens 24
  Angebote pro Helfer innerhalb von 24 Stunden.
- Ein Angebot wechselt den Status nur einmal: `offered` → `accepted`, `declined` oder `withdrawn`.
- **Hinweis.** Ein Zurückziehen oder Ablehnen ändert den Status des Angebots; es löscht
  die hochgeladene Datei nicht aus dem Speicher. Weisen Sie darauf hin, bevor ein Helfer
  etwas anbietet, das er möglicherweise zurückhaben möchte.
- **Sperre.** `offer` liest das Sidecar der Datei, bevor etwas hochgeladen wird. Der Befehl
  verweigert eine `local-only`-Datei, einen `sealed`-Datensatz und eine Datei, deren
  `speakers_agreed` `not-yet` oder `some-said-no` ist; ein unlesbares Sidecar
  bricht das Angebot ab. Es gibt keine Möglichkeit zur Außerkraftsetzung: Die Kennzeichnung kann nur von den Rechteinhabern geändert werden.
  Eine `training: not-allowed`-Bedingung wird den Bedingungen des Angebots hinzugefügt, damit der Eigentümer
  sie sieht.
- **Hinweis.** Ein Angebot sendet die Datei vom Computer des Helfers in den Speicher
  der Projektdatenbank. Fragen Sie den Helfer und bieten Sie niemals eine Datei stellvertretend für ihn an.

`mt-eval project review` ist für den Datenbankbetreiber bestimmt (der Befehl nutzt den
Dienstschlüssel). Es ist kein Befehl für Agenten.

## Weiterführende Informationen

- [Einen versiegelten Test hosten](/docs/host-a-sealed-test) und
  [Einem Projekt beitreten](/docs/join-a-project) – die allgemeinverständlichen Versionen.
- [Einen souveränen Wettbewerb durchführen](/docs/network/sovereignty/run-a-sovereign-contest)
  und [der souveräne Evaluierungs-Node](/docs/network/sovereignty/sovereign-eval-node).
- [Eigentumsübertragung](/docs/network/sovereignty/ownership-transfer) und
  [Bedingungsvorlagen](/docs/network/sovereignty/terms-templates).
- [Daten- und Übertragungsregeln](/docs/agents/data-rules) – versiegelte Datensätze und
  ausschließlich lokale Dateien.
- [`mt-eval`-Referenz](/docs/reference/mt-eval).
