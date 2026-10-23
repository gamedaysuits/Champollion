---
title: "Begleitung der Mitwirkenden"
slug: /agents/coaching
description: "Wie ein KI-Agent den Rundenbericht von Champollion weitergibt und mit den Menschen spricht, die ein Übersetzungssystem aufbauen: Fortschritte zuerst, jede Zahl mit Einheit und Datensatz, Ermutigung nur bei gemessenen Fortschritten, Zeit ohne Druck erbeten und keinerlei Versprechungen zur Qualität."
---

# Die Menschen anleiten

Die Schienen messen. Sie übermitteln. Das Meiste von dem, was die Menschen über ihr
Übersetzungssystem erfahren, hören sie von Ihnen – die Art und Weise, wie Sie es sagen,
ist daher Teil der Arbeit. Auf dieser Seite erfahren Sie, wie Sie es vermitteln: was der
Rundenbericht enthält, wie Sie ihn weitergeben, wie Sie nach Zeit fragen und welche Worte
Sie wählen sollten.

Die zugrundeliegenden Regeln finden sich in [dem Vertrag](/docs/agents/contract) § 5: Sagen Sie
nur die Wahrheit, geben Sie jeden Vorbehalt wortgetreu weiter, versprechen Sie Vorgehen und
niemals Qualität, nennen Sie zu jeder Zahl ihre Einheit und den Datensatz, an dem sie gemessen wurde.

## Der Rundenbericht

Jede Verbesserungsrunde endet mit `champollion improve report` (dem Schritt
`improve-report` der Reise, Modus `auto`). Es schreibt
`improve/round-<k>/report.json` und gibt vier Teile aus; `--json` gibt
dasselbe Objekt aus:

| Feld | Was es enthält |
|---|---|
| `round` | Die laufende Runde: eine nach den Runden, die forge bewertet hat |
| `progress` | Zeilen in dieser Reihenfolge: der Trend bei den Bewertungen der sprechenden Person, dann die Bewertungen jeder Runde (jeweils gefolgt vom Blindvergleich in einer Runde, deren Bogen Entwürfe eines anderen Modells beigemischt hat), dann das Urteil jeder Runde über das Dev-Set |
| `checks` | Warnhinweise dazu, was die Zahlen zeigen können und was nicht |
| `projection` | Eine grobe Schätzung, wie viele Trainingssätze noch nötig sind, um „funktioniert“ zu erreichen, gezählt pro Verdopplung, mit einem Bereich – oder warum es keine gibt – oder `null` vor zwei Runden von Bewertungen |
| `projection_numbers` | Dieselbe Schätzung als Zahlen: `more_sentences`, `range` (`[fewest, most]` Trainingssätze; `most` ist `null`, wenn die Prüfungen dies nicht eingrenzen können) und `speaker_hours` – oder `null`, wenn keine Hochrechnung vorliegt |
| `actions` | Ein bis vier Dinge, die als Nächstes zu tun sind |

Es liest nur Aufzeichnungen, die die Runden behalten – `marks.json` der sprechenden Person
pro Runde und forges `improve-compare`-Urteile – und gibt Anzahlen sowie Prozentsätze aus,
niemals einen Satz.

### Was jede Zeile bedeutet

**Die Bewertungen der sprechenden Person – das Maß, auf das es ankommt.** In jeder Runde entwirft
das eingesetzte Modell die Sätze, die die Familie verfasst hat, und die sprechende Person bewertet jeden Entwurf
mit `Y` (richtig), `N` (falsch, mit Angabe, wie man es sagt) oder `?` (unsicher). Der Anteil der richtigen Entwürfe
wird über die mit `Y` oder `N` markierten Entwürfe berechnet, mit einem 95-%-Wilson-Intervall:

> Runde 1: Die sprechende Person hat 9 von 24 Entwürfen neuer Sätze als richtig bewertet – 38 %
> (95-%-Bereich 21 %–57 %).

Dies sind neue Sätze – entworfen, bevor irgendein Modell sie gelernt hat –,
dies ist also das Maß außerhalb der Stichprobe. In einer Runde, deren Bogen
Entwürfe eines anderen Modells untergemischt hat, beziehen sich diese Zahlen
nur auf die Zeilen des aktuell verwendeten Modells. Erneut gezeigte Zeilen
(unten) sind darin nie enthalten.

**Erneut gezeigte Zeilen.** Ab Runde 2 ist etwa jede zehnte Zeile ein
Entwurf, den die sprechende Person bereits auf einem früheren Bogen bewertet
hat, wieder unbewertet vorgelegt. Der Bogen weist ganz oben darauf hin –
*„Einige Zeilen weiter unten stammen mit Absicht aus früheren Bögen. Bitte
bewerten Sie sie unvoreingenommen neu, als wären sie frisch: Wie oft die
Bewertungen übereinstimmen, zeigt, wie verlässlich sie sind.“* – und verrät
nie, welche es sind. `improve marks` gibt aus: *„Erneut gezeigte Zeilen: Die
sprechende Person hat A von J so bewertet wie zuvor (P%)“*, mit den Wechseln
in beide Richtungen. Diese Zeilen fließen nie in den Anteil der Runde ein
und werden nie erneut trainiert; sie kosten die sprechende Person etwa 10
Sekunden pro Zeile ([Messung](/docs/agents/measurement#the-speakers-marks)).

**Der Blindvergleich.** Ein zweites Modell entwirft eine zufällige Hälfte der
Entwürfe eines Bogens ohne Kennzeichnung, und die sprechende Person beurteilt beide, ohne zu wissen,
welcher Entwurf von welchem Modell stammt ([Messung](/docs/agents/measurement#the-speakers-marks)). Das zweite
Modell ist das neueste Modell, wenn es nicht in den Einsatz übernommen wurde; beim Besuch nach einer
Beförderung ist es das Modell, das durch das neue ersetzt wurde. Der Bericht fügt eine Zeile hinzu:

> Runde 2: Blind, bei neuen Sätzen: Das eingesetzte Modell wurde bei 5
> von 12 als richtig bewertet (42 %), das neuere Modell (nicht im Einsatz) bei 7 von 12 (58 %) – kein eindeutiger
> Unterschied bei 24 Sätzen.

Nach einer Beförderung heißt es: *„Das zuletzt in den Einsatz übernommene Modell wurde bei … als richtig bewertet,
das von ihm ersetzte Modell bei …“*. Es endet auf eine von drei Weisen (ein Zwei-Stichproben-Test auf Anteilswerte bei 5 %): für ein neueres Modell: *Das neuere Modell ist bei den Sätzen, die die Familie benötigt, eindeutig besser* oder *Das eingesetzte Modell ist eindeutig besser*; nach einer
Beförderung: *Das neue Modell ist bei den Sätzen, die die Familie
benötigt, eindeutig besser* oder *Das ersetzte Modell war eindeutig besser – das neue Modell hat bei den Sätzen, die die Familie benötigt, nicht
geholfen*; oder *Kein eindeutiger Unterschied bei N
Sätzen*. Bei zu wenigen bewerteten Zeilen eines Modells heißt es: *„Es wurden zu wenige Zeilen eines Modells bewertet, um einen Vergleich durchzuführen“*.

**Der Trend.** Der Bericht bezeichnet einen Anstieg nur dann als *echten Fortschritt*, wenn alle drei
Bedingungen erfüllt sind:

- der Bereich der letzten Runde liegt vollständig über dem der ersten Runde (sein unteres Ende liegt über dem oberen Ende der ersten);
- dazwischen wurde das Modell einer Runde eingesetzt — von den Menschen gewählt (die Einträge `export` und `choose` von forge): nach einem Urteil **better** und ihrer Zustimmung, anhand der Blindbewertungen der sprachkundigen Person oder nach eigener Wahl. Ein Urteil **better** allein zählt nicht; und
- bei der Blindbewertung bei denselben Besuchen bewertete die sprachkundige Person das neue Modell deutlich häufiger als richtig als dasjenige, das es ersetzte (die Prüfungen nach jeder Beförderung, zusammengefasst; ein Test zweier Anteile bei 5 %).

Der dritte Punkt ist da, weil die Bewertung einer sprechenden Person abdriften kann: Jemand, der mit jeder Runde wohlwollender wird, hebt jeden Anteil an, doch bei einem einzelnen Besuch betrifft dies beide Modelle gleichermaßen. In einer Simulation mit einer sprechenden Person, die 10 % der Entwürfe falsch bewertet und mit jeder Runde wohlwollender wird, wurde eine Beförderung, bei der sich der Übungssatz zufällig irrte, in 106 von 1.600 Berichten, in denen sich das Modell nicht verbessern konnte, als echter Fortschritt gewertet; mit der Blindprüfung waren es 3 — und wiederum höchstens 3 von 1.600 bei einer Wiederholung mit der 50-Sätze-Untergrenze und dem Urteil der sprechenden Person, einschließlich Durchläufen, bei denen der Übungssatz mit 30 Sätzen beginnt.

Ein Anstieg mit einer Beförderung, aber ohne diese Prüfung, wird ausgegeben als: *Noch nicht
als echter Fortschritt gewertet: Die Nachsicht bei der Bewertung von Entwürfen könnte sich ebenfalls geändert haben*
– zusammen mit den Zahlen der Prüfung oder dem Hinweis, dass der nächste Bogen die Entwürfe beider Modelle
mischt. Ein Anstieg beim selben eingesetzten Modell wird ausgegeben als *Nicht als
Fortschritt gewertet*: Die Sätze oder die Bewertung haben sich geändert, nicht das Modell. Ein Anstieg innerhalb
der Bereiche wird ausgegeben als *Angestiegen, wenn auch noch nicht über die Unsicherheit hinaus*.

**Das Urteil des Dev-Sets.** Forge vergleicht das neue Modell Satz für Satz mit dem eingesetzten Modell
anhand derselben Dev-Sätze (Übungssätze):

> Runde 1: bei denselben 50 Übungssätzen (Dev) chrF++ (0–100, Überschneidung
> mit der geprüften Übersetzung) 24,1 für das neue Modell gegenüber 22,0 für das
> verwendete Modell — keine messbare Veränderung: nicht verwendet (bei 50 Sätzen zeigt
> sich erst ein Unterschied von etwa 5,8 Punkten oder mehr zuverlässig).

Wie die Zeile endet, hängt vom Urteil ab und davon, ob die Menschen das Modell der Runde gewählt haben (die Einträge `export` und `choose` von forge) — ein Urteil allein setzt nichts ein:

| Urteil | Nicht gewählt | Gewählt |
|---|---|---|
| **better** | *messbar besser: nicht eingesetzt — die Menschen haben es nicht gewählt* | *messbar besser: eingesetzt* |
| **worse** | *messbar schlechter: nicht verwendet* | *messbar schlechter — eingesetzt …* |
| **no-change** | *keine messbare Änderung: nicht verwendet* | *keine messbare Änderung — eingesetzt …* |
| **too-few** | *zu wenige Übungssätze für eine Aussage (unter 50): die Blindbewertungen der sprachkundigen Person entscheiden* | *zu wenige Übungssätze für eine Aussage (unter 50) — eingesetzt …* |

„Eingesetzt …“ endet mit *anhand der Blindbewertungen der sprachkundigen Person*, wenn forge ein Urteil der sprachkundigen Person für dieses Modell mit `clear: newer` (`improve-speaker`) bereithält, und andernfalls mit *nach eigener Wahl der Menschen*. `champollion improve status` verwendet dieselben Worte: Die Zeile jeder Runde endet mit *„· neues Modell anhand der Übungssätze (Dev-Sätze): …“*. Die Urteilsregel finden Sie unter [Messung](/docs/agents/measurement#comparing-two-models).

**Die Prüfungen.**

- *Überanpassung.* Wenn der Dev-chrF++-Wert des verwendeten Modells über
  die Runden hinweg um 3 Punkte oder mehr gestiegen ist (das neue Modell der
  letzten Runde zählt erst, wenn die Gemeinschaft es ausgewählt hat),
  während der Anteil der richtigen Bewertungen der sprechenden Person um
  2 Punkte oder weniger gestiegen ist, besagt der Bericht, dass der Gewinn
  den Übungssätzen zuzuschreiben sein könnte und den Bewertungen vertraut
  werden sollte.
- *Ein Dev-Set, das zu klein ist, um einen Zuwachs zu erkennen.* Wenn der
  kleinste Unterschied, den das Dev-Set verlässlich anzeigt, mehr als 3
  chrF++-Punkte beträgt (oder, falls unbekannt, unter 50 Sätzen liegt),
  besagt der Bericht, dass „keine messbare Veränderung“ die Grenze des
  Dev-Sets ist und kein Beweis dafür, dass die Runde wirkungslos war.
- *Wie weit den Bewertungen vertraut werden kann.* Sobald über alle Runden
  hinweg 10 erneut gezeigte Zeilen beurteilt wurden: *„Die sprechende Person
  hat A von J erneut gezeigten Zeilen so bewertet wie zuvor (P%): Etwa E%
  der Bewertungen fallen rein zufällig anders aus, was jeden als richtig
  bewerteten Anteil in Richtung 50% zieht – die Hochrechnung berücksichtigt
  dies.“* Wenn ehemals falsche Entwürfe, die nun als richtig bewertet
  wurden, die Gegenrichtung deutlich übertreffen (ein Vorzeichentest bei 5%,
  6 oder mehr Wechsel), fügt er hinzu: *„die Bewertung wird möglicherweise
  wohlwollender, was ein Anstieg des Anteils nicht zeigen würde“*. Vor 10
  Zeilen: *„Bisher N erneut gezeigte Zeilen beurteilt – der eigene
  Bewertungsfehler der sprechenden Person wird ab 10 geschätzt.“*

**Die Hochrechnung.** Wird nur erstellt, wenn der Anstieg ein echter
Fortschritt ist (alle drei oben genannten Punkte) und der Anteil richtiger
Entwürfe noch unter 80% liegt – das Kriterium der Leitplanken dafür, dass es
für die Sätze, die die Familie braucht, *funktioniert*. Lernkurven steigen
pro Verdopplung der Trainingssätze in etwa gleichmäßigen Schritten an; daher
liest sie den Schritt aus den Blindprüfungen der sprechenden Person von jedem
neuen Modell im Vergleich zu dem ab, das es ersetzt hat (die Trainingspaare
beider Modelle sind erfasst), und gibt an, wie viele weitere Trainingssätze
nötig sind, um 80% als richtig bewertet zu erreichen, mit einer Spanne und
den Arbeitsstunden der sprechenden Person bei etwa 70 Sekunden pro Satz (eine
Minute zum Schreiben, zehn Sekunden zum Bewerten). Die Spanne deckt ab, was
die Prüfungen zulassen (95%), und – sobald 10 erneut gezeigte Zeilen
beurteilt wurden –, wo „bei 80% wirklich richtig“ nach den eigenen
Bewertungen dieser sprechenden Person liegen könnte; der Text lautet dann:
*„Entwürfe, die zu 80% wirklich richtig sind, werden nach ihren Bewertungen
möglicherweise in etwa T% der Fälle als richtig eingestuft – die Spanne
bezieht dies ein“*. Davor heißt es: *„(Der eigene Bewertungsfehler der
sprechenden Person ist noch nicht berücksichtigt: Es wurden zu wenige erneut
gezeigte Zeilen beurteilt.)“* Die Schätzung selbst bleibt bei einfachen 80%.
Zahlen werden auf zwei Stellen gerundet. Wenn die Prüfungen sie nicht
eingrenzen können, heißt es, dass sie *„noch nicht sagen können, wie viele
weitere nötig sein könnten“*. Andernfalls erklärt sie, warum keine vorliegt
– zum Beispiel: *„Die Blindprüfung der sprechenden Person hat noch nicht
gezeigt, dass das neue Modell das ersetzte übertrifft; der Anstieg könnte
also an der Bewertung liegen, nicht am Modell“*. Betonen Sie stets, dass es
sich um eine grobe Schätzung handelt; der Bericht tut dies auch. In
Simulationen lag sie bei 400 Sätzen pro Runde in 69–78% der Fälle innerhalb
eines Faktors von 2 der tatsächlichen Zahl und bei 800 Sätzen in 53–56% der
Fälle; die tatsächliche Zahl fiel in 89–94% und 76–80% der Fälle in die
Spanne (bei 800 pro Runde 51–54%, bevor die Spanne die Bewertungen der
sprechenden Person einbezog); die gerade Linie, die sie ersetzte, lag bei 5%
bei 400 Sätzen. Sagen Sie niemals aufgrund des Bewertungsfehlers der
sprechenden Person, dass ein Modell „möglicherweise bereits funktioniert“:
Der Bericht tut dies nicht, da dieser Hinweis in Simulationen auf jeden
Treffer 2- bis 3-mal falsch lag.

**Die Maßnahmen.** Nach Priorität, höchstens vier: den Bogen dieser Runde bewerten
oder die noch fehlenden Sätze schreiben (20 pro Runde); wenn der Blindvergleich das
neuere Modell als eindeutig besser befunden hat, dass *„die Runde geholfen hat, selbst
wo der Übungssatz es nicht zeigen konnte“* — weitermachen, und durch das Vergrößern
des Übungssatzes kann das nächste Urteil es erkennen; wenn die sprechende Person das
Modell, das durch eine Beförderung ersetzt wurde, als eindeutig besser bewertet hat,
die Menschen fragen, ob das frühere Modell wieder eingesetzt werden soll, und den
Übungssatz ähnlicher zu den Sätzen gestalten, die sie benötigen; den Übungssatz
vergrößern, wenn er zu klein ist, um den Zuwachs einer Runde zu erkennen, und unter
200 Sätzen liegt (*„jeder 2. Satz auf jedem Bogen hat keinen Entwurf — die sprechende
Person schreibt, wie man es sagt, und er kommt zum Übungssatz hinzu (jetzt 31; 50
ermöglicht überhaupt erst die Beurteilung einer Runde, 200 lässt einen Zuwachs von
etwa 3 Punkten erkennen)“* — „jeder 4.“ ab 50); was nach zwei Runden ohne Zuwachs zu
tun ist (siehe unten); dass die Zeit, die die sprechende Person nach eigener Aussage
aufbringen kann, zu knapp bemessen wirkt; und, sobald das untere Ende des Anteils
richtiger Sätze 70 % erreicht, eine Prüfung am gesperrten Testsatz — mit einer zuvor
schriftlich festgehaltenen Vorhersage.

**Zwei Runden ohne Zuwachs** — die letzten beiden Urteile lauten jeweils **no-change** oder **worse** (eine Runde mit **too-few** besagt in keinerlei Hinsicht etwas und zählt nicht), wobei dazwischen kein Modell eingesetzt wurde; forge zählt für das Angebot eines stärkeren Modells auf dieselbe Weise. Wo das Übungsset den üblichen Zuwachs einer Runde erkennen kann, lautet die Handlungsanweisung: *„Zwei Runden ohne einen Zuwachs, den dieses Übungsset erkennen kann (etwa X chrF++-Punkte oder mehr): Die Runden bringen möglicherweise weniger als das oder gar nichts — es lässt sich nicht unterscheiden. Schnellere Wege nach vorn: das stärkere Modell, das die Rails anbieten, wenn der Computer eines trainieren kann, oder mehr Sätze von der Art, die es falsch übersetzt.“* (X ist der kleinste Unterschied, den das Urteil anzeigt.) Wo es das nicht kann, rät sie dazu, weiterzumachen. Sagen oder deuten Sie niemals an, dass mehr Sätze nicht helfen werden: Nahe dem oberen Ende der Kurve bringt eine Runde etwa einen halben chrF++-Punkt, was unter dem liegt, was 200 Übungssätze zeigen können. In simulierten Runden erschien der ältere Satz „Mehr desselben hilft möglicherweise nicht“ in 98 von 1.200 Berichten, während sich das Modell in Wirklichkeit verbesserte.

### Wie Sie ihn weitergeben

1. **Fortschritt zuerst.** Beginnen Sie mit dem, was sich bei den Bewertungen der
   sprechenden Person verändert hat.
2. **Jede Zahl mit Einheit und Bezugsmenge.** „9 der 24 neuen Sätze, die die
   sprechende Person geprüft hat, waren richtig — 38 %“, niemals nur „38 %“.
   „chrF++ 24,1 von 100 bei den 50 Übungssätzen“, niemals „24,1“. Ein Bereich
   zeigt, wie sicher sich die Werkzeuge sind, nicht zwei Ergebnisse: „irgendwo
   zwischen 21 % und 57 % — bei 24 Sätzen können sich die Werkzeuge nicht
   sicherer sein“.
3. **Die Prüfungen, klar und einfach.** Wenn der Bericht warnt, sagen Sie,
   wovor er warnt.
4. **Die nächsten Schritte als Dinge, die sie tun können.** Formulieren Sie
   jede Maßnahme als einen an die Menschen gerichteten Satz, einschließlich der
   genannten Datei.
5. **Geben Sie jeden Vorbehalt wortwörtlich weiter.**

**Ermutigen Sie anhand dessen, was gemessen wird.** Ein als richtig bewerteter Entwurf, ein Anstieg über die
Bereiche hinaus, ein neues Modell, das in den Einsatz übernommen wurde: Sagen Sie dies mit herzlichen Worten. Die erste Übersetzung ist ein Grund
zum Feiern. Feiern Sie niemals eine Zahl, die der Bericht nicht als Fortschritt bezeichnet.

**„Keine messbare Änderung“ – sachlich und wohlwollend.** Es bedeutet nicht, dass die Runde
umsonst war. Erklären Sie, was es bedeutet: Bei dieser Anzahl an Übungssätzen zeichnet sich erst ein
Unterschied etwa dieser Größenordnung ab; ein kleinerer Gewinn könnte verborgen sein; das eingesetzte
Modell bleibt weiterhin im Einsatz; die von der sprechenden Person korrigierten Sätze zählen trotzdem. Nennen Sie anschließend
den nächsten Schritt.

**„Zu wenige Übungssätze zur Beurteilung“ — nicht „keine Veränderung“.** Unter 50
Übungssätzen entscheidet kein Vergleich, wie auch immer die beiden Werte lauten;
es ist kein Urteil über das neue Modell. Sagen Sie, was stattdessen geschieht: Das
verwendete Modell bleibt vorerst bestehen; der nächste Bogen mischt die Entwürfe
des neueren Modells unmarkiert darunter, und die Bewertungen der sprechenden
Person entscheiden; jede zweite Zeile auf dem Bogen enthält keinen Entwurf, und
diese Sätze erweitern den Übungssatz, bis eine Runde anhand dessen beurteilt
werden kann.

**Der Blindvergleich — mit beiden Zahlen und was er bewirkt.** Nennen Sie die
Zahlen beider Modelle und den Abschluss des Berichts genau wie geschrieben. Wenn
das neuere Modell eindeutig besser ist, sagen Sie es so, wie es der Bericht tut —
die Runde hat geholfen, selbst wo der Übungssatz es nicht zeigen konnte —, und
dass dies das eigene Urteil der sprechenden Person über neue Sätze ist. Nach
einem Urteil **zu wenige** oder **keine Veränderung** für dieses Modell führt eine
klare Bevorzugung dazu, dass forge es zur Nutzung anbietet: `improve marks`
gibt aus: *„forge hat es erfasst: Es bietet an, das neuere Modell einzusetzen (die
Menschen stimmen zuerst zu)“*, und das Angebot erscheint als Schritt
`improve-promote` (siehe unten) — fragen Sie nach, bevor Sie ihn ausführen. Nach
einem Urteil **schlechter** wird es nicht angeboten. Nach einer Beförderung ist es
genau diese Prüfung, die den Bericht einen Anstieg als echten Fortschritt werten
lässt; wenn sie besagt, dass das ersetzte Modell eindeutig besser war, fragen Sie
die Menschen, ob das frühere Modell wieder eingesetzt werden soll — tun Sie dies
niemals ohne ihre Zustimmung. „Kein klarer Unterschied“ bei 24 Sätzen bedeutet
genau das, was da steht.
**Hinweis.** Verraten Sie der sprechenden Person niemals, welche Zeilen von
welchem Modell stammen, bevor ihre Bewertungen eingelesen wurden.

**Erneut gezeigte Zeilen – wozu sie dienen.** Nennen Sie die Übereinstimmung
mitsamt ihren Zahlen, wie es der Bericht tut („Die sprechende Person hat 17
von 20 erneut gezeigten Zeilen so bewertet wie zuvor – 85%“), und wozu sie
dient: wie verlässlich die Bewertungen sind. Sie wird auf dem Bogen
angekündigt und ist keine verdeckte Überprüfung der sprechenden Person.
Benennen Sie den Zufallsfehler so, wie es der Bericht tut: Etwa E% der
Bewertungen fallen rein zufällig anders aus, was jeden Anteil in Richtung 50%
zieht, und die Hochrechnung berücksichtigt dies. Wenn der Bericht besagt:
*„die Bewertung wird möglicherweise wohlwollender“*, sagen Sie dies sachlich
und ohne Vorwurf: Ein Anstieg des Anteils kann dann an der Bewertung liegen,
nicht am Modell. **Hinweis.** Verraten Sie der sprechenden Person niemals,
welche Zeilen wiederkehren oder wie sie zuvor bewertet hat – der Bogen weist
lediglich darauf hin, dass einige Zeilen wiederkehren.

**Wörter, die das Modell noch nie gesehen hat.** Wenn `sync` davor warnt, dass Schlüssel *„Wörter enthalten, die das
Modell im Training nie gesehen hat – sehr wahrscheinlich falsch übersetzt, wie flüssig auch immer“*,
sprechen Sie es klar aus: Diese Zeilen sind sehr wahrscheinlich fehlerhaft, selbst wenn sie sich flüssig lesen; eine
sprechende Person sollte sie prüfen, oder die Sätze der nächsten Runde können dem Modell diese
Wörter beibringen. Nennen Sie die Schlüssel wie in der Warnung; Sie selbst sehen die Wörter nicht. Die
Person sieht sie auf der Testseite des Modells unter jeder Zeile. Der Beleg anhand
der erfundenen Test-Sprache: Sätze mit einem Wort, das das Modell noch nicht gesehen hatte,
waren in 0 von 358 Fällen richtig ([Bereitstellung](/docs/agents/serving#words-the-model-never-saw)).

**Die Wörter der Wunschliste.** Der Abschnitt „Wörter, die es noch nie gesehen hat“ bittet um
*„zwei oder drei Sätze mit jedem Wort, das Sie benötigen, die jeweils etwas
Anderes aussagen“*: Weniger Wörter, die jeweils in einigen wenigen Sätzen vorkommen, bringen dem Modell mehr bei als
viele Wörter, die nur einmal auftauchen. Vermitteln Sie es genau so. Bei der erfundenen Test-Sprache war ein Wort,
das im Training einmal vorkam, in 27–29 % der Fälle richtig übersetzt, und bei 2–4 Vorkommen in
63–95 %; und bei 3.200 Trainingssätzen übersetzte ByT5-small, trainiert auf Sätzen, die nach
den meisten neuen Wörtern ausgewählt wurden, 39,4 % von 500 zurückgehaltenen Sätzen sinngemäß richtig,
gegenüber 53,4 % bei alltäglichen Sätzen – bei nur geringfügig mehr Zeitaufwand
der sprechenden Person (etwa 57 Stunden gegenüber 54).

Bezeichnen Sie ein Ergebnis niemals selbst als gut oder schlecht. Eine Person, die die Sprache fließend spricht, entscheidet, was für den Einsatz taugt.

## Nach Zeit fragen

Der Schritt `improve-time` (Modus `ask_user`) fragt danach, wie viel Zeit die sprechende Person
aufbringen kann: `per_week` und `total`, jeweils **genau so, wie sie es formuliert hat** („vielleicht 30
Sätze pro Woche“, „ein paar Stunden, dann sehen wir weiter“). Dies wird von
`champollion improve time` in `improve/time.json` festgehalten; die Satzanzahl
jeder Runde wird daran ausgerichtet, und der Bericht vergleicht die Hochrechnung damit.

- **Hinweis:** Fragen Sie einmal; drängen Sie niemals auf mehr. Wenn die Person es nicht weiß, geben Sie weiter, was
  sie gesagt hat – auch vage Worte sind eine Antwort.
- **Hinweis:** Wenn der Bericht besagt, dass die Hochrechnung mehr Sätze erfordert, als nach den Zeitangaben
  übrig sind, sagen Sie es offen und nennen Sie die aufgeführten Optionen: weitere
  Sprecherinnen und Sprecher, Hilfskräfte für das Projekt oder vorerst ein enger gestecktes Ziel (ein Sprachführer
  für die am dringendsten benötigten Sätze). Lassen Sie dann die Menschen entscheiden.

## Die Angebote, die die Schienen machen

**Ein besseres Modell zur Nutzung anbieten** (forge-Zustand `improve-promote`, Modus `confirm`). Ein neues Modell war auf dem Dev-Set messbar besser — oder das Dev-Set konnte keine Entscheidung treffen (**too-few** oder **no-change**) und die sprachkundige Person bewertete es bei der Blindbewertung deutlich häufiger als richtig. Dann ergänzt `why` von forge die Zahlen der sprachkundigen Person: *„Bei der Blindbewertung während desselben Besuchs bewertete die sprachkundige Person das neuere Modell bei A von B neuen Sätzen als richtig (P %) und das verwendete Modell bei C von D (Q %) — ein deutlicher Unterschied: Das neuere Modell ist besser bei den Sätzen, die die Familie benötigt.“* Geben Sie an, was davon der Fall war. Es ist ein Angebot: Ein Urteil allein ändert nichts. Seine Verwendung ändert, was deren Website oder App ausgibt; fragen Sie daher nach, bevor Sie den Schritt ausführen; bei „nicht jetzt“: `declined: true`. Nur ihre Zustimmung — `export` und `choose` des Schritts — setzt es ein; bis dahin lautet der Bericht *„messbar besser: nicht eingesetzt — die Menschen haben es nicht gewählt“*, und kein Zuwachs daraus zählt als Fortschritt. Sobald es anhand der Bewertungen der sprachkundigen Person gewählt wurde, lautet die Zeile der Runde *„eingesetzt anhand der Blindbewertungen der sprachkundigen Person“*.

**Ein stärkeres Modell** (forge-Zustand `improve-stronger-model`, Modus `ask_user`).
Wenn zwei Runden in Folge, die das Dev-Set beurteilen konnte, keinen Zuwachs zeigen —
beide **no-change** oder **worse**; eine Runde mit **too-few** zählt nicht —,
gezählt ab dem letzten Modellwechsel (ein Wechsel der Voreinstellung oder jedes Modell, das die Menschen mit `choose` eingesetzt haben, einschließlich einer Beförderung anhand der Bewertungen der sprachkundigen Person), während das winzige Modell im Einsatz ist, bieten die Rails ByT5-small an
— `byt5-small` oder `byt5-small-lowmem`, wo die GPU über 8–15 GB Speicher für das Training verfügt (weniger Speicher pro Schritt, langsamer): ein Download von etwa 1,2 GB und ein längeres Training, am besten auf Apple Silicon oder einer NVIDIA-GPU ([Training](/docs/agents/training#models)). Der Antwort-Slot ist `try_it`:
`yes` oder `not-now`. Sagen Sie, was `why` von forge besagt — wenn das Dev-Set zu klein ist, um den Zuwachs einer Runde zu erkennen, dass sich kleine Zuwächse verbergen könnten; andernfalls, dass die beiden Runden *„keine Änderung, die die Dev-Sätze erkennen können (etwa X chrF++-Punkte oder mehr): Die Runden bringen möglicherweise weniger als das oder gar nichts“* brachten. Es besagt nicht, dass mehr Sätze nicht helfen, und Sie tun das ebenfalls nicht. „Nicht jetzt“ ist eine der Antworten dieses Schritts: Übergeben Sie `try_it: "not-now"` (über MCP wird `declined: true` hier abgelehnt). Forge zeichnet dies auf, behält das Modell im Einsatz bei und das Angebot erscheint erst nach zwei weiteren solchen Runden (**no-change** oder **worse**) wieder. Beide Antworten sind in Ordnung; die Entscheidung liegt bei ihnen.

**Die Vorhersage beurteilen.** Nach einem Test-Set-Wert beurteilen die Menschen, ob
die von ihnen festgehaltene Vorhersage zutraf (`held` oder `missed`) und wer darüber geurteilt hat. Lesen
Sie ihnen die Vorhersage und das Ergebnis samt Bereich vor; fällen Sie das Urteil niemals an ihrer Stelle.

**Sprechende Personen, die noch nicht zugestimmt haben.** Eine Datei in `waiting_for_agreement` wird
einmal pro Sitzung behutsam angesprochen. Nur ein Ja der Person – dass
alle, deren Worte darin enthalten sind, zugestimmt haben – gilt als Bestätigung.

## Worte für die Menschen

| Sagen Sie | Statt |
|---|---|
| „eine Bewertung von 100 Punkten dafür, wie nah die Übersetzungen an jene der sprechenden Person herankommen — chrF++“ | „chrF++ 24,1“ allein |
| „wie sicher sich die Werkzeuge sind: irgendwo zwischen 21 % und 57 %“ | „CI [0.21, 0.57]“ |
| „die Übungssätze“ (der Dev-Satz) | „Dev-Split“ |
| „die Testsätze, unter Verschluss gehalten“ | „Held-out-Testset“ |
| „das erste kleine Modell“ | dessen Ordner- oder Durchlaufname |
| „keine messbare Veränderung — bei 50 Übungssätzen zeigt sich erst ein Unterschied von etwa 6 Punkten“ | „keine Verbesserung“ |
| „noch zu wenige Übungssätze zur Beurteilung — unter 50 entscheiden die eigenen Bewertungen der sprechenden Person“ | „keine Veränderung“ bei einem Urteil „zu wenige“ |
| „ein Sprachführer: gut bei Sätzen wie jenen, die er gelernt hat“ | „Low-Resource-NMT-Baseline“ |
| „die sprechende Person hat 9 von 24 als richtig bewertet“ | „Accuracy 38 %“ |

Erklären Sie einen Begriff beim ersten Auftreten mit einem Beispiel vor dem eigentlichen Wort.

## Wann Sie Unterstützung vorschlagen sollten

- **Das Projekt stockt, oder die Menschen bitten um persönliche Hilfe.** Sagen Sie: *„Gibt es
  Schwierigkeiten oder wünschen Sie sich Unterstützung bei Ihrem Projekt? Sprechen wir darüber.“* –
  [info@champollion.dev](mailto:info@champollion.dev). Niemals verpflichtend; keine
  Preise.
- **Sie benötigen mehr Sätze, sprechende Personen oder Rechenleistung, als sie haben.**
  Verweisen Sie auf [Einem Projekt beitreten](/docs/join-a-project): Andere können
  Sätze, Wortlisten oder Methoden beisteuern (derzeit nur Dateien), und nichts von ihnen
  wird ohne ihre Zustimmung weitergegeben ([Hosting und Beitreten](/docs/agents/hosting-and-joining)).

## Weiterführende Informationen

- [Runde für Runde verbessern](/docs/make-it-better) – die Verbesserungsschleife, wie
  die Menschen sie lesen.
- [Messregeln](/docs/agents/measurement) – die Urteilsregel, Bereiche und
  Dev-Set-Grenzen.
- [Training mit nmt-forge](/docs/agents/training) – was das stärkere Modell
  ist und erfordert.
- [Der Betriebsvertrag](/docs/agents/contract) § 5 – sagen Sie nur die Wahrheit.
