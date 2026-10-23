---
title: "Messregeln"
slug: /agents/measurement
description: "Wie Champollion eine:n Übersetzer:in bewertet und wie ein Agent darüber berichtet: der Bewertungsstandard (Korpus-chrF++ mit einem 95-%-Bootstrap-Intervall), Gated Scores, Dev im Vergleich zu Test, Vorhersagen, Beinahe-Kopien, die Wörterbuch-Untergrenze, die Regel für gepaarte Urteile und die darunterliegende 50-Sätze-Untergrenze, woran sich die Wunschliste orientiert, die Noten der Sprecher:innen, der verblindete Zwei-Modell-Vergleich, das Urteil der Sprecher:innen, erneut angezeigte Zeilen (Übereinstimmung, Zufallsfehler, Drift) und wie man eine Zahl angibt."
---

# Messregeln

Die Leitplanken versprechen, dass die Sprachgemeinschaft **wissen** wird,
wie gut ein Modell anhand ihrer eigenen Sätze ist – nicht, dass es gut ist.
Dieses Versprechen stützt sich auf einige wenige Regeln, von denen die
meisten erzwungen werden. Diese Seite legt sie genau dar und schließt damit ab,
wie eine Zahl benannt werden soll.

## Der Bewertungsstandard (standard/1)

Jeder neue Durchlauf wird auf dieselbe Weise bewertet (`arena/mt_eval_harness/scoring.py`):

- **Der Hauptwert:** **chrF++** auf Korpusebene (sacreBLEU chrF mit Wortordnung
  2), von 0 bis 100 – höher bedeutet näher an den Referenzübersetzungen –
  mit seinem **95%-Bootstrap-Intervall** und seiner sacreBLEU-Signatur. Geschrieben
  als `chrF++ 47.5 [45.9, 49.0]`.
- **Welche Segmente zählen:** eine einzige Regel für den Hauptwert, sein Intervall
  und jeden Vergleich. Ein Segment, dessen Übersetzung fehlschlug, zählt als leere
  Ausgabe – wird niemals verworfen, niemals als Platzhalter gewertet; ein Segment
  ohne Referenz wird überall weggelassen.
- **Das Intervall:** das eigene des Hauptwerts – Perzentil-Bootstrap über diese
  Segmente, 1.000 Wiederholungen, Seed 12345, α 0,05. Unter 30 Segmenten warnen
  die Werkzeuge, dass das Intervall eine geringe Abdeckung haben kann; bei weniger
  als 2 gibt es keines.
- **Daneben, niemals vermischt:** BLEU, spBLEU, TER und COMET, sofern berechnet,
  jeweils mit Signatur oder Modell-ID.
- **Diagnosen, getrennt:** exakte Übereinstimmung, äquivalente Übereinstimmung,
  FST-Akzeptanz, morphologische Genauigkeit, semantischer Validator, Code-Switching,
  Halluzination, Termintreue, Schreibstil. Sie fließen niemals in einen Hauptwert ein
  und bilden niemals eine Rangfolge.
- **„Besser“ ist ein gepaarter Signifikanztest** auf chrF++, niemals zwei nach
  Augenschein verglichene Zahlen.
- **Keine Qualitätsbezeichnungen.** Nur eine menschliche Beurteilung bestätigt
  Qualität.

**Zurückgezogen:** der gewichtete Gesamtwert und die Qualitätsstufen-Bezeichnungen.
Eine Run Card nach standard/1 führt `composite: null` und `quality_tier: null`.
**Hinweis.** Präsentieren, berechnen oder zitieren Sie niemals einen Gesamtwert
oder eine Stufe, auch nicht aus einer alten Karte.

**Bewertungsvorbehalte** sind Diagnosen, die neben einem Wert stehen, niemals eine
Änderung daran: `source_copy` (die Hälfte oder mehr der Ausgaben kopiert die Quelle),
`length_inflation` und `length_deflation` (Ausgaben mit mehr als der doppelten oder weniger
als der halben Referenzlänge – im Durchschnitt oder in mindestens einem Viertel der
Segmente), `near_constant_output` (eine Ausgabe wiederholt sich über viele Quellen hinweg) und
`train_test_near_twin` (Testzeilen mit einem Zwilling im Training – schwerwiegend, wenn die
Hälfte oder mehr dies aufweist). **Hinweis.** Geben Sie jeden Vorbehalt wortgetreu
zusammen mit dem Wert weiter.

## Gating-Messung

Wenn ein Durchlauf eine Gating-Kette hat ([Methoden und Gates](/docs/agents/methods#gate-chains)),
gilt: **Gemessen wird, was ausgeliefert wird**:

- der Hauptwert chrF++ bewertet die gefilterte Ausgabe;
- der ungefilterte chrF++ steht samt Intervall daneben
  (`overall.gates.ungated`);
- die **Ablehnungsrate** – von den Gates abgelehnte Segmente ÷ beurteilte Segmente – ist
  eine eigenständige Zahl mit Zählungen nach Gate und danach, was ausgeliefert wurde
  (`shipped_from`: Methode, Quelle, Rückfallebene, nichts);
- der **Fingerabdruck** der Kette (SHA256 ihres kanonischen JSON) wird mit dem
  Bericht und jedem veröffentlichten Durchlauf mitgeführt.

**Sperre.** Keine Rückfallebene bei der Messung: `mt-eval run` und `mt-eval test`
lehnen eine Kette ab, deren Gates abgelehnte Segmente an eine Rückfallebene übergeben,
bevor etwas übersetzt oder aufgewendet wird.

**Hinweis.** Berichten Sie einen gefilterten Wert stets mit dem ungefilterten Wert
und der Ablehnungsrate. Ein gefilterter Wert allein verbirgt, was die Gates verworfen
haben.

## Datensätze und wozu jeder dient

| Rolle | Verwendet für | Lesezugriff |
|---|---|---|
| `train` | Lernen | Wird nie als Ergebnis bewertet |
| `dev` (Übung) | Auswahl des Prüfpunkts; Bewertung von Verbesserungsrunden (ab 50 Sätzen); die Wörterbuch-Untergrenze | Frei |
| `test` | Meilensteine: Testen eines Modells gegen die Vorhersage der Menschen | Jeder bewertende Lesezugriff erfordert eine Vorabregistrierung (forge); jeder Lesezugriff wird protokolliert |
| `sealed` | Ein Test, den niemand außerhalb der Verwahrung sieht | Einmal |

**In nmt-forge** (die Registry, `.forge/eval-registry.json`; das Ledger):

- **Sperre.** Jeder lesende Zugriff auf einen registrierten Datensatz wird mit seinem
  Zweck (`score`, `dev-selection`, `audit`, `inspect`) in das
  hash-verkettete Ledger geschrieben.
- **Sperre.** Die Bewertung eines Testdatensatzes erfordert eine gültige
  Vorabregistrierung für seinen aktuellen Inhalt.
- **Sperre.** Ein versiegelter Datensatz wird einmal bewertet. Eine zweite Bewertung
  wird abgelehnt (`sealed set '<name>' has already been spent`); a single `mt-eval`-Zugriff
  auf die versiegelte Datei verbraucht ihn ebenfalls. `--override-respend '<reason>'` (auf `nmt-forge score`
  und `nmt-forge compare`) wird in das Ledger geschrieben. `export` verweigert
  einen erneuten Verbrauch und nennt `--no-eval`.
- **Sperre.** Die Dev-Schranke: Das Training erfordert einen registrierten `dev`-Datensatz;
  Dev-Zeilen dürfen weder eine exakte Quelle noch ein exaktes Ziel mit einem Test- oder
  versiegelten Datensatz teilen; keine Trainingszeile darf eine Dev-Zeile sein.

**In mt-eval:**

- **Hinweis.** `mt-eval run` und `mt-eval compare` bewerten eine Test- oder versiegelte
  Datei ohne jegliche Vorabregistrierung und lehnen Zugriffe niemals aufgrund von
  Zugriffszahlen ab. `mt-eval run` hängt nur dann eine Zeile an das Leseprotokoll
  der Datei an (`<file>.reads.jsonl`), wenn forge ein solches angelegt hat; `compare`
  und `test` protokollieren nichts. Bewerten Sie den Testdatensatz niemals
  mit mt-eval, bevor die Vorhersage der Gemeinschaft vorliegt.

## Vorhersagen

```bash
nmt-forge prereg new first-model --eval-set project-test --expect "<their words>" --rationale "<their reason>"
nmt-forge prereg new round-2 --eval-set project-test --predictions predictions.json
nmt-forge prereg template --out predictions.json
```

- `--expect` und `--rationale`: eine Freitext-Vorhersage zu chrF++ in den
  eigenen Worten der Gemeinschaft. Ihr Urteil liegt bei der Gemeinschaft:
  `nmt-forge prereg verdict <id> --prediction <n> --held` (or `--missed`) `--by "<who>"`.
- `--predictions <file>`: ein JSON-Array; jede Vorhersage nennt eine `metric` und
  eine `rationale` sowie entweder eine `direction` (`increase`, `decrease`,
  `no_change`) mit einem `baseline_score` (und optional `margin`) – beurteilt durch
  die Werkzeuge – oder Freitext-`expect`.
- **Sperre.** Eine Vorhersage, die nach einem bewertenden Lesezugriff auf den
  Datensatz verfasst wurde (durch forge oder durch `mt-eval run`), wird abgewiesen:
  *„eval set '…' was already read for scoring (N time(s): …) before this preregistration“*.
  `--allow-after-reads` lässt sie durch, und jeder Bericht, Export und Status weist dies aus.
- **Hinweis.** Die Vorhersage stammt von der Gemeinschaft, verfasst bevor ein
  Wert existiert, niemals von Ihnen umformuliert oder eingeengt. Die Frage der
  Leitplanken schlägt keine Zahl vor (*„Hier wird keine Zahl vorgeschlagen, damit die
  Schätzung ihre eigene bleibt“*); bieten auch Sie keine an.

## Fast-Kopien

`nmt-forge leak-audit` vergleicht jedes Trainingspaar mit jedem registrierten Dev-,
Test- und versiegelten Datensatz:

| Befund | Regel | Maßnahme |
|---|---|---|
| Identische Datei | sha256 | Verworfen |
| Exakte Kopie | Identische Quelle oder identisches Ziel nach Normalisierung | Verworfen |
| Fast-Kopie | Zielwortmengen überlappen zu ≥ 0,6 (Jaccard), wenn eine die andere enthält, oder zu ≥ 0,9 | Verworfen |
| Vorlagengeschwister | Identisches Satzgerüst, unterschiedliche Antwort | **Behalten** zum Lernen und gezählt, damit der Wert mit und ohne diese Testzeilen gelesen werden kann |
| Nur-Quell-Übereinstimmung | Identische Eingabeaufforderung, unterschiedliche Antwort | Behalten, berichtet |

Kurze Sätze werden anhand von Zeichen-Trigrammen verglichen; sehr kurze nur
über exakte Übereinstimmung. Eine Testzeile ist ein **Fast-Zwilling**, wenn eine
Trainingszeile identisch ist oder sie auf einer Seite zu ≥ 0,6 überlappt; wenn die
Hälfte oder mehr der Testzeilen Zwillinge aufweist, beruht der Wert überwiegend auf
Wiedererkennung statt Übersetzung, und der Vorbehalt ist schwerwiegend.
`--clean-to` schreibt die bereinigte Datei; `--drop-test-twins` entfernt zusätzlich
die Trainingszeilen, die zu einer Testzeile zwillingsgleich sind, für einen
zwillingsfreien Wert.

Die erste Dev-Aufteilung der Leitplanken wendet denselben Schwellenwert an:
`--near-dupe 0.6` auf `nmt-forge split` behält Zeilen, deren Wörter zu ≥ 0,6 überlappen,
auf einer Seite der Dev/Training-Trennlinie, damit der erste Dev-Wert keine
Fast-Kopie-Erinnerung enthält, die eine spätere Prüfung untersagen würde.
`--max-group` begrenzt eine Fast-Kopie-Gruppe auf die halbe Dev-Größe plus eins,
sodass eine aus Vorlagen verfasste Datei dennoch geteilt werden kann.

**Hinweis.** Sagen Sie „Das Datenleck-Audit ergab …“ nur anhand von `true_now`
oder der direkten Ausgabe des Audits; behaupten Sie niemals von sich aus „Der
Testdatensatz ist sauber“.

## Die Wörterbuch-Untergrenze

`nmt-forge floor <word lists>` übersetzt den Dev-Datensatz Wort für Wort mit dem Wörterbuch
(längste Wendung zuerst) und bewertet ihn mit demselben Code wie der Dev-Wert
eines Durchlaufs: chrF++ mit seinem 95%-Intervall. Es läuft auf diesem Computer,
liest niemals den Testdatensatz und zeichnet nur die Namen, Hashes und
Eintragszahlen der Wörterbücher auf, wie viele Quellwörter sie erreicht haben
sowie die Werte. Ein Durchlauf **übertrifft die Untergrenze** nur dann, wenn das
untere Ende seines Dev-Intervalls über dem oberen Ende des Intervalls der
Untergrenze liegt; `nmt-forge status` warnt vor einem Durchlauf, bei dem dies nicht
der Fall ist.

## Zwei Modelle vergleichen

**Eine Verbesserungsrunde** (`nmt-forge compare-runs <in-use> <new>`): die Übersetzungen **derselben
Dev-Sätze** beider Modelle, Zeile für Zeile gepaart; ein gepaarter
Approximative-Randomisierungs-Test (1.000 Durchläufe) und ein 95%-Bootstrap-Intervall
auf die Differenz.

| Urteil | Regel |
|---|---|
| **too-few** | weniger als 50 Entwicklungssätze, ganz gleich, wie die Werte ausfallen – das bisherige Modell bleibt im Einsatz, und die Blindbewertungen der sprechenden Person entscheiden (unten) |
| **better** | 50 oder mehr, p < 0,05 **und** das untere Ende des Intervalls liegt über 0 – das neue Modell wird zur Nutzung angeboten; es wird nur bei einem Ja der Menschen eingesetzt |
| **worse** | 50 oder mehr, p < 0,05 und das obere Ende des Intervalls liegt unter 0 |
| **no-change** | alles andere – das bisherige Modell bleibt im Einsatz |

**Warum 50.** Gemessen an den ByT5-small-Ausgaben der erfundenen Testsprache, 100
zufällige Übungsdatensätze pro Größe, nach dieser Regel: Bei 23 Dev-Sätzen stufte
sie zwei nahezu gleichwertige Modelle (0,7 chrF++ Unterschied auf 500 Sätzen)
in 9 von 100 Fällen als unterschiedlich ein und bezeichnete einen echten Zuwachs
von +5,9 chrF++ nur in 21 von 100 Fällen als **better**; bei 50 Sätzen in 4 und
in 96 von 100 Fällen. Der kleinste Unterschied, der in 8 von 10 Fällen erkannt
wurde, betrug 8,1 chrF++-Punkte bei 23 Sätzen, 5,8 bei 50, 4,0 bei 100 und 2,8
bei 200. Daher zweigt die erste Aufteilung der Rails mindestens 50 Dev-Sätze
ab, wenn 200 oder mehr Paare vorhanden sind – eines von zehn der geprüften
Paare, höchstens 500; bei weniger als 200 Paaren ein Viertel davon, was unter
50 liegt – und die Prüfbögen vergrößern den Datensatz um Übungszeilen: jede
zweite Zeile, solange er unter 50 liegt, jede vierte, bis er 200 erreicht.

Jedes Urteil nennt auch den kleinsten Unterschied, den sein Dev-Datensatz
verlässlich anzeigt (in 8 von 10 Fällen): Intervallbreite × (1,96 + 0,84) ÷ (2 × 1,96).
Liegt dieser über 3 chrF++-Punkten, ist „keine-änderung“ die Grenze des Dev-Datensatzes,
nicht der Beweis dafür, dass die Runde nichts bewirkt hat. Der Dev-Datensatz
wählte zudem den Prüfpunkt des neuen Durchlaufs aus, was das neue Modell leicht
begünstigt – **weisen Sie darauf hin**, wenn Sie ein Urteil weitergeben.

Eine verdeckte Bevorzugung des neueren Modells durch die sprechende Person
(siehe unten) führt dazu, dass forge es erst nach einem Urteil von **too-few**
oder **no-change** zur Nutzung anbietet – niemals nach **worse** –, und die
Menschen stimmen zuerst zu (`improve-promote`, Modus `confirm`). Eine verdeckte
Bevorzugung des Modells, das durch eine Hochstufung ersetzt wurde, setzt dieses
niemals wieder zurück: Die Aktion des Rundenberichts fragt die Menschen.

**Beliebige zwei Durchläufe** (`mt-eval compare <report> <report> --significance`):
standardmäßig approximative Randomisierung (`--method paired_bootstrap` für das
andere Verfahren), 1.000 Durchläufe (`--n-bootstrap`), α 0,05, Seed 12345,
auf den Einträgen, die die Berichte nach ID teilen (Warnung bei unter 10).
Zuerst chrF++, danach die sekundären Metriken. Jedes Modellpaar wird getestet;
es gibt keine Korrektur für multiples Testen, und die Ausgabe weist dies aus.

## Woran sich die Wunschliste orientiert

`nmt-forge analyze` schlüsselt das Dev-chrF++ eines Durchlaufs nach Satzart auf
(bei mindestens 5 Dev-Sätzen einer Art). Eine Art gilt nur dann als **am schwächsten** –
und gewichtet die Wunschliste –, wenn das 95%-Intervall des Abstands ihrer
Sätze zum Rest vollständig über null liegt (Welch-Intervall auf Satzebenen-chrF++).
Ein niedrigerer Wert, der Zufall sein könnte, wird als solcher ausgewiesen
(*„… könnte Zufall sein – die Wunschliste richtet sich nicht danach“*) und
gewichtet das Arbeitsblatt niemals.

Der Abschnitt „Wörter, die es noch nie gesehen hat“ bittet um zwei oder drei
Sätze pro Wort, die jeweils etwas Unterschiedliches aussagen, nicht um einen:
Bei der erfundenen Testsprache wurde ein einmal im Training vorkommendes Wort
in 27–29 % der Fälle richtig übersetzt, ein 2–4 Mal vorkommendes Wort in
63–95 %; und bei 3.200 Trainingssätzen hatte ByT5-small, trainiert auf Sätzen
mit den meisten neuen Wörtern, bei 39,4 % von 500 zurückgehaltenen Sätzen die
Bedeutung richtig getroffen, gegenüber 53,4 % bei Alltagssätzen – bei geringfügig
höherem Zeitaufwand der sprachkundigen Person (etwa 57 Stunden gegenüber 54).

## Die Bewertungen der sprachkundigen Person

In jeder Verbesserungsrunde bewertet die sprechende Person die Entwürfe des Modells für neue Sätze als `Y`, `N` oder `?`. Der Anteil richtiger Entwürfe liegt bei `Y ÷ (Y + N)` (`?`, unmarkierte Zeilen, Übungszeilen und erneut gezeigte Zeilen ausgenommen), mit einem 95-%-Wilson-Intervall. Ein Anstieg zwischen Runden zählt nur dann als **Fortschritt**, wenn das Intervall der letzten Runde vollständig über dem der ersten liegt, dazwischen ein Modell der Runde in Betrieb genommen wurde – ausgewählt durch die Menschen (`export`- und `choose`-Einträge von forge), sei es nach einem **Besser**-Urteil, anhand der verblindeten Bewertungen der sprechenden Person oder nach eigener Entscheidung; ein **Besser**-Urteil allein zählt nicht – **und** die verblindeten Prüfungen jeder Beförderung durch die sprechende Person (unten), zusammengefasst über die Runden dazwischen, die neuen Modelle deutlich häufiger als richtig bewertet haben als diejenigen, die sie ersetzt haben (|z| > 1,96).
Dies sind Sätze, die kein Modell zuvor gesehen hatte: der Maßstab, auf den es am meisten ankommt, und derjenige, mit dem man vorangehen sollte ([Coaching](/docs/agents/coaching)).

**Zwei Modelle, verblindet.** `champollion improve sheet` lässt ein zweites Modell eine zufällige, über einen Seed gesteuerte Hälfte der entworfenen Zeilen entwerfen (`nmt-forge draft-newer`), unmarkiert: das neueste trainierte Modell, wenn es nicht das aktuell verwendete ist – wie nach einer Runde, deren Urteil „Zu wenige“, „Keine Änderung“ oder „Schlechter“ lautete – oder, beim Besuch nach einer Beförderung, das Modell, das durch das aktuell verwendete ersetzt wurde. Welche Zeilen von wem stammen, wird neben der Tabelle in `improve/round-<k>/sheet-key.json` festgehalten (`in_use`, `other`, `relation` `newer` oder `replaced`, die Trainingspaare jedes Modells `in_use_pairs` und `other_pairs`, `other_rows` und `repeat_rows`, siehe unten).
`champollion improve marks` zählt die beiden Modelle dann getrennt aus, wobei erneut gezeigte Zeilen bei all dem außen vor bleiben:

- der Anteil richtiger Entwürfe oben – das Maß für den Fortschritt – zählt
  nur die Zeilen des aktiven Modells;
- jeder als richtig markierte Entwurf und jede Korrektur wird zu einem
  Trainingspaar, unabhängig davon, welches Modell den Entwurf erstellt hat;
- ein Test auf zwei Anteilswerte (gepoolt, zweiseitig bei 5 %: |z| > 1,96)
  gibt an, welches Modell die sprechende Person häufiger als richtig markiert
  hat, falls überhaupt eines: `clear` ist `newer` oder `replaced`
  (das andere Modell), `in-use` oder `neither`, festgehalten in
  `marks.json` (`blind`) mit beiden Zählungen (`in_use_right`, `in_use_judged`,
  `other_right`, `other_judged`, `in_use_share`, `other_share`), `other`,
  `relation` und beiden Zahlen der Trainingspaare; ein Vergleich mit einem
  neueren Modell behält zudem `newer`, `newer_right`, `newer_judged` und `newer_share`. Wenn
  für eines der Modelle keine Zeile mit `Y` oder `N` markiert ist,
  lautet `clear` `null` und der Text besagt *"zu wenige Zeilen eines Modells wurden beurteilt, um einen Vergleich durchzuführen"*;
- im Vergleich zu einem neueren Modell, bei dem von jedem mindestens ein Entwurf
  beurteilt wurde, gehen die Zahlen an forge (`nmt-forge speaker-verdict`), das denselben Test
  ausführt und `clear` (`newer`, `in-use` oder `neither`) in seinem
  Hauptbuch (`improve-speaker`) vermerkt. Nach einem Urteil von **too-few** oder
  **no-change** bei diesem Durchlauf bewirkt `clear: newer`, dass forge das neuere
  Modell zur Nutzung anbietet; `champollion improve marks` gibt dann aus: *"forge hat es erfasst: es schlägt vor, das neuere Modell einzusetzen (die Menschen stimmen zuerst zu)"*
  ([Training](/docs/agents/training#the-improve-rounds)).

Die Zeilen wurden nach dem Zufallsprinzip auf einem einzigen Arbeitsblatt zugewiesen,
von derselben sprachkundigen Person beurteilt, anhand der eigenen neuen Sätze der
Familie – ein klarer Unterschied besagt also etwas, wofür der Dev-Datensatz
möglicherweise zu klein ist, und eine Änderung im Wohlwollen der Beurteilung
betrifft beide Modelle gleichermaßen. **Hinweis.** Teilen Sie der sprachkundigen
Person niemals mit, welche Zeilen von welchem Modell stammen, bevor ihre Bewertungen
erfasst sind.

**Erneut gezeigte Zeilen.** Ab Runde 2 fügt `champollion improve sheet` für jeweils 10 neue Sätze auf der Tabelle eine Zeile wieder ein (`REPEAT_EVERY`; abgerundet und weniger, falls sich weniger eignen): ein Entwurf, den die sprechende Person auf einer früheren Tabelle als `Y` oder `N` bewertet hat, mit seinem früheren Entwurf, unmarkiert, an einer zufälligen, über einen Seed gesteuerten Stelle – niemals eine Übungszeile, eine Zeile, die selbst eine Wiederholung war, eine bereits erneut gezeigte oder ein Satz auf dieser Tabelle. Die erste Zeile der Tabelle über der Kopfzeile lautet: *„Einige der untenstehenden Zeilen stammen absichtlich aus früheren Tabellen. Bitte bewerten Sie sie unvoreingenommen neu, als wären sie neu: Wie oft die Bewertungen übereinstimmen, zeigt, wie verlässlich sie sind.“* Es wird nie angegeben, welche; `sheet-key.json` speichert sie als `repeat_rows` (`row`, `from_round`, `from_row` und `mark`, die frühere Bewertung). Sie kosten die sprechende Person etwa 10 Sekunden pro Zeile.

`improve marks` beurteilt jede Zeile ausschließlich im Abgleich mit der früheren Bewertung der sprechenden Person selbst: Eine Wiederholung wird nie in den Anteil der Runde eingerechnet, wird nie wieder zu einem Trainingspaar und fließt nie in den Blindvergleich ein. `marks.json` erhält `repeats`: `shown`, `judged` (diesmal als `Y` oder `N` bewertet; `?` oder leer wird angezeigt, nicht beurteilt), `agreed`, `agreement` (übereinstimmend ÷ beurteilt), `wrong_to_right`, `right_to_wrong`, `wrong_before` (beurteilte Zeilen, die zuvor als `N` bewertet wurden) und `rounds_apart_wrong_before`. Es gibt Folgendes aus: *„Erneut gezeigte Zeilen: Die sprechende Person hat A von J so bewertet wie zuvor (P %) – W zuvor falsch, jetzt richtig; R zuvor richtig, jetzt falsch. Wird nicht in den Anteil dieser Runde eingerechnet und nicht erneut trainiert.“*

Über die Runden zusammengefasst liest der Rundenbericht, sobald 10 oder mehr beurteilt wurden (`MIN_REPEATS`), zwei Dinge daraus ab:

- **Zufälliger Fehler** `e`, aus den Wechseln, die in beide Richtungen gleichermaßen auftreten. Zwei Bewertungen desselben Entwurfs weichen rein zufällig in 2e(1 − e) der Fälle voneinander ab, jeweils zur Hälfte in jede Richtung; mit d = 2 × min(`wrong_to_right`, `right_to_wrong`) ÷ `judged`, e = (1 − √(1 − 2d)) ÷ 2. Fehler zieht jeden Anteil in Richtung 50 %: Ein Entwurf, der in einem Anteil von p tatsächlich richtig ist, wird in e + p(1 − 2e) der Fälle als richtig bewertet; bei e = 10 % liest sich „tatsächlich 80 % richtig“ also als etwa 74 %.
- **Drift**: Wechsel in eine Richtung, die über die gleichmäßig verteilten hinausgehen. Der Bericht warnt davor, dass die Bewertung möglicherweise nachsichtiger wird, wenn Wechsel von „zuvor falsch, jetzt richtig“ die Gegenrichtung deutlich überwiegen: 6 Wechsel oder mehr und ein Vorzeichentest, (`wrong_to_right` − Wechsel ÷ 2) ÷ √(Wechsel ÷ 4) > 1,96.

Die Prüfzeile lautet: *„Die sprechende Person hat A von J erneut gezeigten Zeilen so bewertet wie zuvor (P %): Ungefähr E % der Bewertungen fallen rein zufällig andersherum aus, was jeden als richtig bewerteten Anteil in Richtung 50 % zieht – die Hochrechnung berücksichtigt dies.“* – und zu Drift: *„Und W Entwürfe, die zuvor als falsch bewertet wurden, sind jetzt als richtig bewertet, gegenüber R in die andere Richtung: Die Bewertung wird möglicherweise nachsichtiger, was ein Anstieg des Anteils nicht zeigen würde.“* Bei weniger als 10 beurteilten Zeilen: *„Bislang wurden N erneut gezeigte Zeilen beurteilt – der eigene Bewertungsfehler der sprechenden Person wird ab 10 geschätzt.“*

**Wohin die Runden deuten.** Die Hochrechnung des Rundenberichts erfolgt nur anhand echten Fortschritts (oben), solange der Anteil richtiger Entwürfe unter 80 % liegt. Lernkurven steigen pro Verdopplung der Trainingsdaten in annähernd gleichmäßigen Schritten in den Log-Odds an; daher liest er die Schrittgröße aus denselben Blindprüfungen nach Beförderungen ab: die Summe von `logit(in_use_share) − logit(other_share)` über der Summe von `log2(in_use_pairs ÷ other_pairs)` (Anteile begrenzt auf 1–99 %), mit einer 95-%-Spanne aus der Varianz jedes Anteils, ungefähr 1 ÷ (n·p·(1 − p)) für n beurteilte Entwürfe. Ausgehend von den Trainingspaaren des aktuell verwendeten Modells gibt er an, wie viele weitere Paare nötig sind, um 80 % als richtig Bewertete zu erreichen – die Schätzung – sowie den Zeitaufwand der sprechenden Person in Stunden bei 70 Sekunden pro Satz. Die Spanne deckt das Intervall der Schrittgröße ab (keine Obergrenze über sechs weitere Verdopplungen hinaus) und, sobald 10 erneut gezeigte Zeilen beurteilt wurden, wo „tatsächlich zu 80 % richtig“ bei den Bewertungen dieser sprechenden Person liegen könnte: e + 0,8(1 − 2e) + 0,2 × K, höchstens 97 %, wobei K die Drift pro Runde ist (Wechsel über die gleichmäßigen hinaus, geteilt durch den Rundenabstand zwischen den beiden Bewertungen der zuvor falschen Zeilen) multipliziert mit den Runden zwischen der ersten und letzten Bewertung, gedeckelt auf ±30 %. Das Minimum ist das kleinere der beiden Ziele an der Obergrenze der Schrittgröße, das Maximum das größere an deren Untergrenze; ein Minimum von 0 liest sich als „keine“. Der Text ergänzt dann: *„Eigene Bewertung der sprechenden Person: Sie hat A von J erneut gezeigten Zeilen so bewertet wie zuvor (P %), daher fallen etwa E % der Bewertungen rein zufällig andersherum aus … Entwürfe, die tatsächlich zu 80 % richtig sind, werden bei ihren Bewertungen möglicherweise in etwa T % der Fälle als richtig eingestuft – die Spanne bezieht dies ein.“* (zusammen mit der Angabe, wenn K 1 % oder mehr in die eine oder andere Richtung beträgt, wie viel häufiger oder seltener zuvor als falsch bewertete Entwürfe jetzt als richtig bewertet werden); davor: *„(Der eigene Bewertungsfehler der sprechenden Person wird noch nicht berücksichtigt: Es wurden zu wenige erneut gezeigte Zeilen beurteilt.)“* `report.json` enthält die Zahlen als `projection_numbers` (`more_sentences`, `range`, `speaker_hours`).

In Simulationen – eine uneinheitlich bewertende sprechende Person, der Dev-Split der Rails selbst und diese Urteilsregeln, 200 Durchläufe pro Szenario auf zwei Seed-Sätzen – lag die Schätzung bei 400 neuen Sätzen pro Runde in 69–78 % der Fälle innerhalb eines Faktors von 2 der tatsächlichen Anzahl und bei 800 Sätzen in 53–56 %; die tatsächliche Anzahl fiel in 89–94 % bzw. 76–80 % der Fälle in die Spanne (ohne Wiederholungen in 91–93 % bzw. 51–54 %). Die Schätzung selbst an die Bewertungen der sprechenden Person anzupassen, half bei 800 pro Runde und schadete bei 400 (innerhalb eines Faktors von 2: 64 % und 19 %), daher bleibt es bei den einfachen 80 %. Ein Hinweis darauf, dass das Modell „möglicherweise bereits funktioniert“, wurde erprobt und verworfen: Er lag 2- bis 3-mal so oft falsch, wie er richtig lag. Eine grobe Schätzung, und offen so benannt.

## Was die Zahlen nicht aussagen

- Ein Wert gilt für das Gesamtsystem auf diesem Datensatz, nicht für einen
  einzelnen Satz: Es gibt keine satzbezogene Konfidenz.
- chrF++ misst die Übereinstimmung mit einer Referenz. Eine gute Übersetzung,
  die anders formuliert ist, kann einen niedrigen Wert erzielen; eine flüssige,
  aber falsche Übersetzung kann recht hoch abschneiden.
- Die FST-Akzeptanz besagt lediglich, dass Wörter existieren, nicht, dass ein
  Satz die richtige Bedeutung wiedergibt.
- Veröffentlichte Zeilen auf der Bestenliste basieren standardmäßig auf
  Selbstauskunft; das Prüfwerkzeug bewertet eingereichte Ausgaben anhand des
  per Hash fixierten Korpus neu (innerhalb von 1,0 chrF++) und führt Methoden
  nicht erneut aus.

## Wie eine Zahl berichtet wird

Jede Zahl trägt **ihre Einheit, was sie misst, und den Datensatz, auf dem sie
gemessen wurde** – zusammen mit der Größe des Datensatzes und der Spanne,
sofern vorhanden.

| Sagen | Niemals |
|---|---|
| "chrF++ 24,1 von 100 bei den 50 Übungssätzen (Dev), Spanne 20,6–27,6" | "24,1" · "24 % treffsicher" |
| "Die sprechende Person hat 9 von 24 neuen Entwürfen als richtig markiert – 38 % (21 %–57 %)" | "38 % Genauigkeit" |
| "Keine messbare Veränderung: Auf 50 Dev-Sätzen zeigt sich erst ein Unterschied von etwa 5,8 Punkten" | "Es hat sich leicht verbessert" |
| "Noch zu wenige Übungssätze für ein Urteil: Unter 50 entscheidet kein Vergleich – die Blindbewertungen der sprechenden Person werden es tun" | "Keine Änderung" bei einem **too-few**-Urteil |
| "Auf den 50 gesperrten Testsätzen, einmalig, gegen die Vorhersage, die Sie verfasst haben: ‚…‘" (deren Worte, vorgelesen) | Ein Testergebnis ohne Datensatz oder Vorhersage |
| "Verdeckt, bei neuen Sätzen, hat die sprechende Person das neuere Modell bei 7 von 12 und das aktive Modell bei 5 von 12 als richtig markiert – kein eindeutiger Unterschied bei 24 Sätzen" | "Das neue Modell ist besser" allein anhand der Markierungen |
| "chrF++ 31,0 mit Schranke (was ausgeliefert wird), 33,5 ohne Schranke, 12 % von den Schranken abgewiesen" | Der abgesicherte Wert allein |

- Eine Spanne drückt aus, wie sicher die Werkzeuge sind, nicht zwei Ergebnisse.
- Zwei Werte auf unterschiedlichen Datensätzen sind nicht vergleichbar. Zwei
  Werte auf demselben Datensatz unterscheiden sich nur, wenn der gepaarte
  Test dies bestätigt.
- Zitieren Sie Vorbehalte und Warnungen wortgetreu.
- Bezeichnen Sie einen Wert niemals als gut oder schlecht; fügen Sie niemals
  ein Qualitätsurteil hinzu. Eine fließend sprechende Person entscheidet, was
  für den Einsatz taugt.

## Weiterführende Informationen

- [Die Bewertungsspezifikation](/docs/network/specifications/scoring) und
  [Signifikanz](/docs/network/specifications/significance).
- [Die Run Card](/docs/network/specifications/run-card) – was ein bewerteter
  Durchlauf festhält.
- [Metrik-Zuverlässigkeit](/docs/network/specifications/metric-reliability) –
  welche Metrik für welche Sprachen anhand menschlicher Urteile überprüft wurde.
- [Die technischen Grenzen](/docs/network/honest-limitations).
- [Die Leitplanken](/docs/guardrails) – die Version für die Gemeinschaft.
