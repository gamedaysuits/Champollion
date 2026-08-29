---
sidebar_position: 4
title: "Diagnose eines Trainingslaufs"
description: "Symptomorientierte Fehlerbehebung für das MT-Training bei ressourcenarmen Sprachen — beginnen Sie mit dem, was Sie beobachten, ermitteln Sie die wahrscheinliche Ursache und den passenden Regler, der das Problem behebt."
related:
  - label: "Train Your First Model (with your agent)"
    to: /docs/network/getting-started/train-your-first-model
    kind: guide
  - label: "Train a Model Honestly"
    to: /docs/network/getting-started/training-honestly
    kind: guide
  - label: "forge Command Reference"
    to: /docs/network/getting-started/forge-command-reference
    kind: reference
---

# Diagnose eines Trainingslaufs

Ihr Modell wurde trainiert. Die Zahlen entsprechen nicht Ihren Erwartungen. Diese Seite beginnt bei
**dem, was Sie sehen**, und führt Sie zur wahrscheinlichen Ursache sowie zum forge-Werkzeug, das
sie behebt. Die meisten dieser Punkte sind automatisiert — `nmt-forge evaluate` hängt einen
Abschnitt **Diagnose & Empfehlungen** an, der den Befund und den Hebel benennt;
diese Anleitung ist die Version in verständlicher Sprache, ergänzt um die wenigen Dinge, vor denen forge nur
*warnen* kann (gekennzeichnet mit ⚠ **hierauf achten**).

Weisen Sie Ihren Agenten an: *„Führe `nmt-forge lint <battery-manifest.json> --json` aus und handle
auf Grundlage des Befunds mit dem höchsten Schweregrad."* Gleichen Sie dann das Gemeldete mit den nachstehenden Abschnitten
ab.

---

## „Großartig bei meinen Lehrbuchbeispielen, katastrophal bei echten Sätzen"

**Die mit Abstand häufigste Falle bei ressourcenarmen Sprachen.** Ihre synthetischen/schablonenbasierten Daten
schneiden hervorragend ab; echter Text zerfällt.

**Was passiert:** ein **Transfer-Plateau**. Während des Trainings erreichte der Verlust auf Ihrem
echten Dev-Set früh sein Minimum und stieg dann wieder an, während der Trainingsverlust weiter
sank — das Modell beherrschte die synthetische *Masse*, lernte aber nicht zu
übersetzen. Mehr synthetische Daten werden **nicht** helfen.

**forge-Befund:** `R7-transfer-plateau` (aus der Zeitplan-Darstellung des Laufmanifests). **Hebel: REAL-DATA.**

**Behebung:** Fügen Sie echten Text hinzu. Rückübersetzen Sie einsprachige Daten in der Zielsprache
(`nmt_forge.training.backtranslation`) oder beschaffen Sie echte parallele Sätze.
Die Menge synthetischer Daten ist nicht der Hebel — die Vielfalt *echter* Daten ist es.

⚠ **hierauf achten:** Wenn Ihre Mischung zu etwa 99 % synthetisch gegenüber einem kleinen echten Dev-Set ist,
laufen Sie Gefahr, dies zu erleben, *bevor* Sie es in den Werten sehen. Es gibt noch keine Vorab-Prüfung
für ein pathologisches Verhältnis — überprüfen Sie die Gold-/Synthetik-Zahlen Ihres Mix-Manifests.

---

## „Ein Register ist deutlich schlechter als die anderen"

Sehen Sie sich die Tabelle pro Register an. Ein einzelnes Register (etwa Behörden- oder Rechtssprache) liegt
weit unter dem Rest.

**Zwei verschiedene Ursachen — die Diagnose unterscheidet sie, indem sie die *Abdeckung*
betrachtet und ob die Ausgaben *unvollständig* sind:**

- **Dem Modell fehlen die Wörter** (`R1-vocabulary-gap`: geringe Abdeckung **und** hohe
  Unvollständigkeitsrate). **Hebel: VOCABULARY.** Erweitern Sie das Lexikon (Wörterbuch- /
  Belegsammlung) und führen Sie anschließend die `nmt-forge`-Trichterrechnung aus, um zu bestätigen, dass die neuen
  Einträge tatsächlich im Korpus ankommen — eine Orthografie-Abweichung um ein einziges Zeichen hat schon zuvor
  stillschweigend Tausende Wörter gelöscht.
- **Das Modell hat die Wörter, aber nicht die Satzformen** (`R2-structure-gap`:
  Abdeckung in Ordnung, dennoch unvollständig). **Hebel: STRUCTURE.** Führen Sie die Abdeckungskarte
  gegen Ihre Grammatik-Checkliste aus und fügen Sie die fehlenden Konstruktionen hinzu
  (Imperative, W-Fragen, Besitz, Inversiv — was auch immer Ihre Schablonen nie
  abgefragt haben).

---

## „Die Ausgaben mischen Schreibweisen innerhalb eines Satzes"

Das Modell schreibt denselben Laut auf zwei Arten, manchmal in einem einzigen Satz.

**Was passiert:** Ihre Trainingsziele haben ihm beigebracht, dass Konventionen
austauschbar seien — der Korpus enthielt denselben Inhalt in mehreren
Orthografien.

**forge-Befund:** `R3-mixed-convention`. **Hebel: ORTHOGRAPHY.**

**Behebung:** `convention-lint` den Korpus, normalisieren Sie auf **eine** kanonische Konvention
an der Datengrenze und trainieren Sie neu. Behalten Sie eine Rate gemischter Konventionen in Ihrer Testbatterie,
damit Sie deren Rückgang sehen können.

---

## „Modell B schlägt Modell A — aber nur geringfügig"

Sie haben zwei Modelle verglichen, und eines liegt um einen Bruchteil eines Punktes vorne.

**Was passiert:** Der Unterschied kann kleiner sein als das Rauschen. Bei 80
Sätzen ist ein Abstand von 0,4 chrF++ ein Münzwurf.

**forge-Befund:** `R5-low-power` (das Konfidenzintervall ist breiter als der
Delta-Wert). **Hebel: MEASUREMENT.**

**Behebung:** Handeln Sie nicht auf Grundlage von Deltas, die kleiner sind als das KI. Vergrößern Sie das Eval-Set für dieses
Register oder verwenden Sie `nmt-forge compare`, das einen *gepaarten* Signifikanztest
statt zweier überlappender Intervalle meldet. forge stellt niemals einen nackten Wert dar — das
Intervall ist stets vorhanden, genau damit Sie dies erkennen können.

⚠ **hierauf achten:** Ein Ergebnis aus einem **einzelnen Seed** trägt kein
Band der Varianz über mehrere Seeds. Ein Gewinn, der eine erneute Seed-Wahl nicht übersteht, ist nicht real.
Wenn eine Entscheidung wichtig ist, führen Sie den Lauf mit 2–3 Seeds erneut aus.

---

## „Der Wert sieht zu gut aus"

Verdächtig hoch, besonders früh oder bei wenig Daten. Vertrauen Sie dem Verdacht.

**Prüfen Sie der Reihe nach:**

1. **Leckage.** `nmt-forge leak-audit <corpus>` — ist eine Testantwort im
   Training gelandet? Treffer auf der Zielseite sind aus gutem Grund fatal.
2. **Checkpoint-Auswahl.** Wurde der Checkpoint auf einem **abgeschotteten Dev-Set**
   ausgewählt, nicht auf dem Test-Set? forge verweigert das Training ohne Dev-Set genau, um
   dies zu verhindern, eine selbstgebaute Pipeline jedoch nicht.
3. **Optimismus durch Beinahe-Zwillinge.** `R4-optimism-bound`: Wenn der Wert der „vollständigen" Testbatterie
   mehrere Punkte über dem „strengen" (um Beinahe-Duplikate bereinigten) Wert liegt, ist die Differenz
   Drill-Geschwister-Optimismus. **Zitieren Sie die strenge Zahl** für jede Behauptung zur Generalisierung.

---

## „Das Training stoppte fast sofort"

Der Lauf endete nach einigen hundert Schritten; das Modell sah seine Daten kaum.

**Was passiert:** Das frühe Stoppen hielt das erwartete Schwanken des synthetiklastigen Dev-Sets
für Konvergenz.

**forge-Verhalten:** Dies wird standardmäßig *verhindert* — `nmt-forge run` leitet aus Ihrer Mischung eine
**Untergrenze** für das Stoppen ab und unterdrückt frühe Stopps unterhalb dieser, wobei der Grund in den
`[schedule-sanity]`-Zeilen protokolliert wird. Wenn Sie einen unerwarteten Stopp sehen,
lesen Sie diese Zeilen; das Laufmanifest verzeichnet genau, was passiert ist und warum.

---

## „Eine gewünschte Metrik fehlt im Bericht einfach…"

Der Bericht ist ehrlich, aber auf einer Achse leer (COMET, eine FST-Gültigkeitsprüfung).

**forge-Befund:** `R6-referee-unavailable` — die Bahn wird mit der Begründung als nicht verfügbar
benannt. **Hebel: REFEREE.**

**Behebung:** Installieren/konfigurieren Sie den benannten Referee und werten Sie erneut aus. Die Werte, die Sie haben,
sind weiterhin ehrlich — sie sind lediglich auf dieser einen Achse blind, bis der Referee
vorhanden ist.

---

## „Das Modell gibt `<unk>` oder verstümmelte Zeichen aus"

Besonders bei einer Silben- oder erweiterten lateinischen Schrift.

⚠ **hierauf achten — noch nicht automatisiert.** Der **Tokenizer des Basismodells stellt Ihre Zielschrift
möglicherweise nicht dar**. forge prüft die Tokenizer-Abdeckung vor dem
Training noch nicht (es ist der oberste Punkt auf unserer Lückenliste). Prüfen Sie den Tokenizer Ihres Basismodells
gegen Stichproben Ihrer Zielschrift; bevorzugen Sie ein Basismodell, dessen Vokabular die
Schrift abdeckt (viele ressourcenarme Sprachen werden von Basismodellen der NLLB-Familie abgedeckt), oder erweitern Sie
den Tokenizer vor dem Training.

---

## Wenn forge sich geweigert hat und Sie nicht verstehen, warum

Eine Verweigerung nennt stets, **was** passiert ist, **warum** es die Ergebnisse verfälscht und die
**Behebung**. Falls es weiterhin unklar ist:

- `nmt-forge status` — wo Sie sich befinden und der einzige nächste Befehl.
- `nmt-forge preflight <command>` — jedes Gate, auf das dieser Befehl treffen wird, ✓/✗, mit
  der Behebung für jedes ✗, sodass Sie alle auf einmal lösen statt nacheinander.

Eine Verweigerung ist kein Fehler in Ihrer Einrichtung — es ist das Werkzeug, das einen Fehler abfängt, bevor
er Ihre Ergebnisse erreicht. Das ist der gesamte Entwurfsgedanke.
