---
sidebar_position: 4
title: "Diagnose eines Trainingslaufs"
description: "Symptomorientierte Fehlerbehebung für das MT-Training bei ressourcenarmen Sprachen — beginnen Sie mit dem, was Sie beobachten, ermitteln Sie die wahrscheinliche Ursache und den passenden Regler, der das Problem behebt."
related:
  - label: "Build MT for Your Language"
    to: /docs/build-mt-for-your-language
    kind: guide
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

Ihr Modell wurde trainiert. Die Zahlen entsprechen nicht Ihren Erwartungen. Diese Seite geht von dem aus,
**was Sie sehen**, und führt Sie zur wahrscheinlichen Ursache sowie zum passenden forge-Werkzeug,
um das Problem zu beheben. Das meiste davon geschieht automatisiert – `nmt-forge export` (und sein rein
bewertungsbezogenes Gegenstück, `nmt-forge evaluate`) hängt einen Abschnitt **Diagnose & Empfehlungen** an,
der den Befund und den Hebel benennt; dieser Leitfaden ist die allgemeinverständliche Fassung,
ergänzt um die wenigen Dinge, vor denen forge lediglich *warnen* kann (markiert mit ⚠ **hierauf achten**).

Sagen Sie Ihrem Agenten: *„Führen Sie `nmt-forge lint <battery-manifest.json> --json` aus und reagieren Sie auf
den Befund mit dem höchsten Schweregrad.“* Nach einem Export lautet das Batterie-Manifest
`export/evaluation/battery-hyps-battery.json`. Gleichen Sie anschließend dessen Berichte mit den
unten stehenden Abschnitten ab.

---

## „Der Score des Standardmodells ist niedrig“

Sie haben mit dem Standard-Preset `cpu-tiny` trainiert und der Test-Score liegt irgendwo
zwischen 5 und 30 chrF++.

**Was geschieht:** Genau dafür ist dieses Preset gedacht. Es handelt sich um einen kleinen Transformer,
der von Grund auf ausschließlich auf Ihren Paaren trainiert wird. Bei 1.000 bis 2.000 Paaren lernt
er somit die Phrasen und Satzmuster Ihrer Daten, nicht die Sprache im Allgemeinen – das
obere Ende dieser Spanne wird nur erreicht, wenn die Daten stark schablonenhaft sind. Seine Aufgabe besteht darin,
den gesamten Ablauf real werden zu lassen (abgegrenztes Dev-Set, geprüfte Daten, vorregistriertes Test-Set, ein Modell,
das die CLI aufrufen kann), nicht darin, das Modell zu sein, das Sie produktiv ausliefern.

**Lösung:** Ändern Sie jeweils eine Sache und messen Sie das Ergebnis am Dev-Set, in grober Reihenfolge des
Nutzens:

1. **Mehr echte Paare.** Bei dieser Größenordnung schlagen Daten jede Konfigurationseinstellung.
2. **Ein vortrainierter Ausgangspunkt.** `nmt-forge init <code> --model cpu-finetune --base
   <hf-id>` führt ein Fine-Tuning eines kleinen, vortrainierten Marian/opus-mt-Modells auf einer CPU durch – wählen
   Sie eines für ein *verwandtes* Sprachpaar und vergleichen Sie es auf dem Dev-Set mit `cpu-tiny`,
   anstatt vorauszusetzen, dass es gewinnt. `--model nllb-600m` bietet den stärksten Ausgangspunkt
   und erfordert eine GPU.
3. **Mehr Daten aus vorhandenem Material** – Rückübersetzung (Backtranslation) von einsprachigem Text oder
   verifizierte Synthese, falls Ihre Sprache über einen Analyzer verfügt (siehe
   [Sie möchten Ihr eigenes Modell trainieren](/docs/network/tutorials/train-your-own-model)).

⚠ **hierauf achten:** Ein hoher Score von `cpu-tiny` verdient eher Misstrauen als
Jubel – siehe [„Der Score sieht zu gut aus“](#the-score-looks-too-good).

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

1. **Leakage.** `nmt-forge leak-audit <corpus>` – ist ein Testsatz im
   Training gelandet? Es verwirft Zeilen, deren Prompt mit einem Test-Prompt identisch ist (selbst
   bei abweichender Übersetzung), Zeilen, deren Antwort mit einer Test-Antwort identisch ist,
   sowie Zeilen, die eine Test-Antwort enthalten, ein Fragment davon sind oder zu ≥ 90 % mit einer Test-Antwort
   übereinstimmen. `nmt-forge run` weist Trainingszeilen ab, die in ein registriertes
   Test-Set oder versiegeltes Set einfließen; dies ist daher vor allem für Daten oder eine Pipeline außerhalb
   von forge von Bedeutung – oder für ein Test-Set, das Sie nie registriert haben.
2. **Checkpoint-Auswahl.** Wurde der Checkpoint anhand eines **abgegrenzten Dev-Sets** (fenced dev set)
   ausgewählt und nicht anhand des Test-Sets? forge verweigert das Training ohne Dev-Set genau aus diesem
   Grund, eine selbstgebaute Pipeline tut dies jedoch nicht.
3. **Optimismus durch Fast-Zwillinge (Near-Twins).** `R4-optimism-bound`: Liegt der „Full“-Batterie-Score
   mehrere Punkte über dem „Strict“-Score, rührt die Differenz von Drill-Sibling-Optimismus her.
   `leak-audit` *behält* Schablonen-Geschwister bewusst bei (*„Ich sehe den Hund“* im Training,
   *„Ich sehe die Katze“* im Test-Set) und listet die Testzeilen auf, die ein solches besitzen;
   wenn `eval.near_dupe_corpus` auf Ihre Trainingsdatei gesetzt ist (die Starter-Konfiguration tut dies),
   bewertet der Bericht die Testzeilen *ohne* Geschwister separat, gekennzeichnet als „(strict)“.
   **Geben Sie für jede Aussage zur Generalisierbarkeit den Strict-Wert an.** Falls *jede* Testzeile
   ein Geschwister hat (`R4-recall-not-translation`: die Strict-Teilmenge ist leer, der Score misst also nur
   das Wiederabrufen von Trainingsphrasen) und das Test-Set fest vorgegeben ist, schreiben Sie mit
   `nmt-forge leak-audit <train> --clean-to <train>.notwins.jsonl --drop-test-twins`
   einen zwillingsfreien Korpus in eine eigene Datei und trainieren Sie ein zweites, zwillingsfreies Modell
   darauf (leak-audit überschreibt nicht die Datei, auf der das erste Modell trainiert) – oder lassen Sie
   Testsätze unabhängig von den Trainingsschablonen erstellen.
4. **Die Ausgaben folgen nicht den Eingaben.** `R9-harness-score-caveat`: Der
   mt-eval-Bericht besagt, dass der Score eingeschränkt zu betrachten ist – meistens handelt es sich um eine
   **nahezu konstante Ausgabe**: Viele verschiedene Testsätze führten zu denselben wenigen Ausgaben
   (ein Krankenhaus-Modell beantwortete 150 verschiedene Sätze mit 9 Ausgaben; es erzielte dennoch einen
   chrF++-Wert von 48, da eine häufige Phrase viele Zeichen mit vielen Referenzen teilt). Das zwillingsfreie
   Modell ist hierbei der übliche Verdächtige: Wurden die Trainingsschablonen entfernt, kann ein kleines Modell
   auf seine häufigsten Sätze zurückfallen. forge gibt diesen Vorbehalt in den Worten des Prüf-Frameworks weiter –
   in der Export-Zusammenfassung, `DEPLOY.md`, `status`, `report`, `compare` und
   `lint` – und bezeichnet einen solchen Score ohne diesen Zusatz niemals als „den zu zitierenden Wert“.
   Lesen Sie einige der Ausgaben (`<export>/evaluation/battery-hyps.jsonl` auf dem Computer, der das Test-Set enthält),
   bevor Sie den Score als Übersetzungsqualität ausweisen; mehr echte, vielfältige Trainingspaare sind der Hebel hierfür.

---

## „Das Training stoppte fast sofort"

Der Lauf endete nach einigen hundert Schritten; das Modell sah seine Daten kaum.

**Was passiert:** Das frühe Stoppen hielt das erwartete Schwanken des synthetiklastigen Dev-Sets
für Konvergenz.

**forge-Verhalten:** Dies wird standardmäßig *verhindert* – `nmt-forge run` leitet eine
Mindestschrittgrenze (**Floor**) für den Abbruch aus Ihrem Mix ab und unterdrückt frühe Abbrüche darunter, wobei
die Begründung in den `[schedule-sanity]`-Zeilen protokolliert wird. Wie oft das Dev-Set evaluiert wird,
wird ebenfalls aus der Größe des Trainingslaufs abgeleitet, sodass auch ein kleiner Lauf nicht unevaluiert bleibt. Wenn
Sie einen Abbruch sehen, den Sie nicht erwartet haben, lesen Sie diese Zeilen; das Run-Manifest zeichnet
genau auf, was passiert ist und warum. (Ein Durchlauf, der schlicht seinen letzten geplanten Schritt erreicht hat,
wird als abgeschlossen gemeldet, nicht als vorzeitiger Abbruch.)

---

## „Der Durchlauf wurde verweigert, bevor er richtig begonnen hat“

**Was geschieht:** Ein Gate hat ausgelöst – was kostengünstiger ist als ein Durchlauf, der erst nach
Stunden fehlschlägt. Die häufigsten Fälle:

- **Das Training-Extra fehlt** – `nmt-forge preflight run --config
  config.json` shows `✗ backend-installed` samt der Lösung,
  `python3 -m pip install 'nmt-forge[hf]'`.
- **Kein Dev-Set oder das falsche** – Die Dev-Fence verweigert einen Durchlauf, dessen
  `data.dev` kein registriertes Set mit der Rolle `dev` ist. Erstellen Sie eines mit
  `nmt-forge split … --register project`.
- **Leakage** – Eine Trainingsdatei teilt Prompts oder Antworten mit einem registrierten
  Test-Set oder versiegelten Set. Bereinigen Sie sie mit `nmt-forge leak-audit <file> --clean-to
  <file.clean.jsonl>` und verweisen Sie in der Konfiguration auf die bereinigte Datei.
- **Laufzeitgrenze (Wall-Clock)** – In den ersten Minuten misst forge die Trainingsgeschwindigkeit und
  verweigert Durchläufe, deren prognostizierte Dauer `model.time_budget_hours` überschreitet. Auf einer CPU bedeutet
  dies üblicherweise, dass das Preset eine GPU benötigt (`nllb-600m`), oder dass der Mix wesentlich größer ist
  als beabsichtigt. Die Meldung nennt die Hebel: ein kleinerer Mix, kürzere
  Sequenzen oder ein größeres Zeitbudget, falls Sie die Wartezeit tatsächlich in Kauf nehmen wollen.

**Lösung:** Führen Sie `nmt-forge preflight run --config config.json` vor jedem Durchlauf aus;
es listet jedes Gate mit ✓/✗ auf, zusammen mit der Lösung für jedes ✗.

---

## „Eine gewünschte Metrik fehlt im Bericht einfach…"

Der Bericht ist ehrlich, aber auf einer Achse leer (COMET, eine FST-Gültigkeitsprüfung).

**forge-Befund:** `R6-referee-unavailable` — die Bahn wird mit der Begründung als nicht verfügbar
benannt. **Hebel: REFEREE.**

**Lösung:** Installieren/konfigurieren Sie den genannten Referee und berechnen Sie die Scores erneut. Wenn die Language
Card den Referee deklariert, nennt die forge-Meldung den Installationsbefehl
(`mt-eval setup --lang <code>`). Die bisherigen Scores bleiben unverfälscht – sie sind
lediglich auf dieser einen Achse blind, bis der Referee vorhanden ist.

---

## „Das Modell gibt `<unk>` oder verstümmelte Zeichen aus"

Besonders bei einer Silben- oder erweiterten lateinischen Schrift.

**Es hängt vom Preset ab.**

- **`cpu-tiny`** lernt sein eigenes Vokabular aus Ihren Trainingszeilen, sodass jedes
  Zeichen, das im Training vorkommt, abgedeckt ist. `<unk>` bedeutet hier, dass die Eingabe
  ein Zeichen enthält, das im Training nie vorgekommen ist – einen seltenen Buchstaben, ein seltenes
  diakritisches Zeichen oder eine abweichende Unicode-Normalform davon (Text wird zu NFC normalisiert, daher
  zählen zusammengesetzte und zerlegte Akzente als identisch). Prüfen Sie, ob Ihre Trainings-
  und Testdaten dieselbe Orthographie verwenden.
- **`cpu-finetune` und `nllb-600m`** verwenden den Tokenizer des vortrainierten Basismodells.

⚠ **hierauf achten – noch nicht automatisiert (vortrainierte Basismodelle).** Der Tokenizer
des Basismodells **bildet Ihre Zielschrift möglicherweise nicht ab**. forge prüft die
Tokenizer-Abdeckung vor dem Training derzeit noch nicht. Überprüfen Sie den Tokenizer Ihres Basismodells anhand von
Stichproben Ihrer Zielschrift; bevorzugen Sie ein Basismodell, dessen Vokabular die Schrift abdeckt
(viele ressourcenarme Sprachen werden von Basismodellen der NLLB-Familie abgedeckt), oder erweitern Sie den
Tokenizer vor dem Training.

---

## Wenn forge sich geweigert hat und Sie nicht verstehen, warum

Eine Verweigerung nennt stets, **was** passiert ist, **warum** es die Ergebnisse verfälscht und die
**Behebung**. Falls es weiterhin unklar ist:

- `nmt-forge status` – wo Sie sich befinden und der einzelne nächste Befehl.
- `nmt-forge preflight <command>` – jedes Gate, auf das dieser Befehl treffen wird, ✓/✗, zusammen mit
  der Lösung für jedes ✗, sodass Sie alle auf einmal beheben können, statt eines nach dem anderen
  (für `run`, `evaluate` und `export` fügen Sie `--config config.json` hinzu).
- Fügen Sie jedem Befehl `--json` hinzu, wenn ein Agent das Ergebnis liest: Eine Verweigerung
  wird dann als einzelnes JSON-Objekt zurückgegeben – `{"error": {"type", "guard", "message",
  "why", "fix", …}}` – mit dem Exit-Code 2.

Eine Verweigerung ist kein Fehler in Ihrer Einrichtung — es ist das Werkzeug, das einen Fehler abfängt, bevor
er Ihre Ergebnisse erreicht. Das ist der gesamte Entwurfsgedanke.
