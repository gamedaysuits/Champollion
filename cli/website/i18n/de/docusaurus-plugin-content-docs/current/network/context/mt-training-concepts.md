---
sidebar_position: 0
title: "MT-Training in einfacher Sprache"
description: "Ein Glossar ohne Vorkenntnisse für das Vokabular, das Sie zum Trainieren eines Übersetzungsmodells benötigen – jeder Begriff wird mit einem durchgearbeiteten Beispiel erläutert, geschrieben für Personen, die einen Coding-Agenten steuern."
related:
  - label: "So You Want to Train Your Own Model"
    to: /docs/network/tutorials/train-your-own-model
    kind: tutorial
    note: "The hands-on walkthrough these words are for"
  - label: "Train a Model Honestly (nmt-forge)"
    to: /docs/network/getting-started/training-honestly
    kind: guide
    note: "The suite that turns every rule here into a guardrail"
  - label: "MT Field Briefing"
    to: /docs/network/context/mt-field-briefing
    kind: doc
    note: "Broader context on where machine translation stands"
  - label: "Statistical Significance Testing"
    to: /docs/network/specifications/significance
    kind: spec
    note: "The math behind error bars — why one number is never enough"
  - label: "Metric Reliability"
    to: /docs/network/specifications/metric-reliability
    kind: spec
    note: "Which score to believe for your language"
---

# MT-Training in einfacher Sprache

Das Training eines maschinellen Übersetzungsmodells (MT) hat sein eigenes
Vokabular, und das meiste davon wird Neulingen nie erklärt — es wird
vorausgesetzt. Diese Seite setzt nichts voraus. Jeder Begriff unten wird in
einfachen Worten definiert und an einem konkreten Beispiel festgemacht,
damit Sie, wenn Sie die [Trainingsanleitung](/docs/network/tutorials/train-your-own-model)
lesen oder Ihrem Coding-Agenten beim Ausführen eines Befehls zusehen, wissen,
was die Wörter bedeuten und, noch wichtiger, **welche von ihnen die Fehler
verbergen, die Ergebnisse still und leise zunichtemachen.**

:::info[Für wen dies gedacht ist]
Sie müssen kein Python schreiben. Die erwartete Vorgehensweise für diese Arbeit
besteht heute darin, **einen Coding-Agenten zu steuern** — Claude Code, OpenAI Codex,
Cursor, OpenCode, Google Antigravity oder Ähnliches —, der die Werkzeuge für Sie
ausführt. Ihre Aufgabe ist es, die Konzepte gut genug zu verstehen, um gute
Anweisungen zu geben und die Ergebnisse ehrlich zu lesen. Genau dafür ist diese
Seite gedacht. Wenn wir ein Werkzeug erwähnen, meinen wir
[**nmt-forge**](/docs/network/getting-started/training-honestly),
die Trainings-Suite, in die diese Ideen eingebaut sind; die Begriffe jedoch
gehören dem gesamten Fachgebiet, nicht uns.
:::

Ein durchgängiges Beispiel verbindet die Seite miteinander. Angenommen, Sie
möchten ein Modell erstellen, das **Englisch → eine ressourcenarme Sprache**
übersetzt — nennen wir sie Ihre *Zielsprache* —, für die fast kein übersetzter
Text existiert. Alles unten ist ein Teil dieses Projekts.

---

## 1. Die zwei Stapel: Trainingsdaten und Evaluationsdaten

**Parallele Daten** sind Text, der mit seiner Übersetzung gepaart ist — dieselbe
Bedeutung in zwei Sprachen, Satz für Satz aufgereiht.

> `The children are playing.` → `awâsisak mêtawêwak.`

Ein Modell lernt, indem es Tausende solcher Paare studiert. Aber Sie müssen die
Paare in **zwei Stapeln halten, die sich niemals berühren**:

- **Trainingsdaten** — die Paare, die das Modell *studieren darf*. Es liest
  diese immer wieder und passt sich an, um sie zu reproduzieren.
- **Evaluationsdaten** (oder **Eval-Daten**) — Paare, die das Modell *während
  des Trainings niemals sehen darf*. Sie verbergen die Übersetzungen, bitten
  das Modell, die Ausgangsseite kalt zu übersetzen, und vergleichen seine
  Antwort mit der verborgenen Wahrheit. Dies ist das einzige ehrliche Maß dafür,
  ob es gelernt hat zu *übersetzen* statt zu *memorieren*.

:::tip[Die Ein-Satz-Version von allem auf dieser Seite]
Ein Test bedeutet nur dann etwas, wenn das Modell die Antworten nie gesehen hat.
Fast jeder Fehler unten ist eine andere Art, wie die Antworten unbemerkt aus dem
Eval-Stapel in den Trainingsstapel durchsickern.
:::

### Echte vs. synthetische parallele Daten

- **Echte (oder *Gold*-)parallele Daten** sind von Menschen erstellt: ein
  zweisprachiges Lehrbuch, von Menschen übersetzte Regierungsunterlagen,
  von der Gemeinschaft archivierte Geschichten. Sie sind vertrauenswürdig,
  aber für die meisten Sprachen schmerzlich knapp — oft nur ein paar hundert
  Satzpaare.
- **Synthetische parallele Daten** werden von einem Programm *hergestellt* statt
  von einer Person geschrieben. Wenn Sie nur 400 echte Paare haben, können Sie
  kein brauchbares Modell trainieren — also generieren Sie Hunderttausende
  zusätzlicher Paare aus Regeln (mehr dazu, wie, in
  [§7](#7-manufacturing-data-when-you-dont-have-enough)).

Das Verhältnis ist enorm wichtig:

> **Ausgearbeitetes Beispiel.** Ein Projekt hat 435 echte Englisch→Cree-Paare
> und stellt ~1.000.000 synthetische her. Das Modell trainiert auf dem großen
> synthetischen Stapel *plus* den wenigen hundert echten Paaren. Synthetische
> Daten kaufen Abdeckung; echte Daten verankern das Modell daran, wie die
> Sprache tatsächlich verwendet wird. Die ganze Kunst besteht darin, (a) den
> synthetischen Stapel so viel von der Sprache wie möglich abdecken zu lassen
> und (b) nur an echtem Text zu messen, den das Modell nie berührt hat.

:::danger[Testen Sie niemals auf synthetischen Daten]
Ein Evaluationsset darf **ausschließlich aus echten Daten** bestehen. Wenn Sie
auf hergestellten Sätzen testen, messen Sie, ob das Modell zu Ihrem *Generator*
passt — nicht, ob es übersetzen kann. Eine gute Trainings-Suite weigert sich,
synthetische Zeilen überhaupt als Testset zu registrieren.
:::

---

## 2. Aufteilen: Train, Dev und Test

Sie beginnen mit einem Stapel echter Paare und **teilen** ihn in drei Rollen auf.

| Split | Auch genannt | Wofür es dient | Sieht das Modell es im Training? |
|---|---|---|---|
| **train** | Trainingsset | Die Paare, die das Modell studiert | Ja |
| **dev** | Validierungsset, held-in | Entscheiden, *wann aufhören* und *welche Version am besten ist* | Nein (nur *bewertet*, nie studiert) |
| **test** | held-out, Evaluationsset | Die finale ehrliche Note | **Niemals** |

Zwei Ideen verbergen sich in dieser Tabelle:

- **Held-out** bedeutet einfach „beiseitegelegt und vom Training ferngehalten".
  Ein Testset wird absichtlich held-out gehalten.
- Das **Dev-Set** ist das clevere mittlere Kind. Das Modell *studiert* es nie,
  aber Sie *schauen* während des Trainings darauf, wie gut das Modell darauf
  abschneidet, um Entscheidungen zu treffen — wie eine Probeprüfung, die Ihnen
  sagt, ob Sie weiterlernen sollten, ohne die echte Prüfung zu sein. Das Dev-Set
  auf diese Weise zu verwenden, ist legitim; das *Test*-Set auf diese Weise zu
  verwenden, ist Betrug (siehe
  [§4](#4-contamination-and-leakage-the-mistake-that-eats-results)).

### Versiegelte Sets und Neuaufteilungen

- Ein **versiegeltes Set** ist ein Testset, das **genau einmal** bewertet
  werden darf. In dem Moment, in dem Sie Ihre Punktzahl darauf betrachten, ist
  es „verbraucht" — denn sobald Sie die Zahl kennen, wird jede spätere
  Entscheidung, die Sie treffen, subtil von ihr geprägt. Versiegelte Sets sind
  die Art und Weise, wie Wettbewerbe und Gemeinschaften eine finale Note wirklich
  final halten.
- Eine **Neuaufteilung** liegt vor, wenn Sie die Train/Dev/Test-Aufteilung von
  Grund auf neu aufbauen — meist, weil Sie entdeckt haben, dass die alte
  Aufteilung kontaminiert war. Sie können eine undichte Aufteilung nicht durch
  Löschen einiger Zeilen reparieren; Sie gruppieren alles neu und schneiden
  erneut ([§4](#4-contamination-and-leakage-the-mistake-that-eats-results)
  erklärt warum).

---

## 3. Was „Training" eigentlich bewirkt: Loss und seine zwei Gesichter

Training ist eine Schleife. Das Modell trifft eine Vorhersage, sieht, wie falsch
es lag, und stupst seine internen Zahlen an, um beim nächsten Mal ein wenig
weniger falsch zu sein — millionenfach.

**Loss** ist die eine Zahl, die misst, „wie falsch". Niedriger ist besser. Aber
es gibt *zwei* Loss-Werte, und sie zu verwechseln ist eine klassische Falle:

- **Training-Loss** — wie falsch das Modell bei den Paaren liegt, die es aktiv
  studiert. Dieser fällt fast immer weiter, weil das Modell im Grenzfall die
  Trainingspaare einfach *memorieren* kann.
- **Dev-Loss** (Validierungs-Loss) — wie falsch das Modell beim zurückgehaltenen
  Dev-Set liegt, das es *nicht* studiert. Dies ist das ehrliche Signal. Wenn
  der Dev-Loss aufhört sich zu verbessern, während der Training-Loss weiter
  fällt, hat das Modell aufgehört, *die Sprache zu lernen*, und angefangen,
  *das Trainingsset zu memorieren*.

> **Ausgearbeitetes Beispiel.** Nach einer Weile sehen Sie den Training-Loss bei
> 0,8 und fallend, aber den Dev-Loss festhängend bei 1,9 und *nach oben*
> kriechend. Diese Lücke ist das verräterische Zeichen: Das Modell wird besser
> darin, seine Trainingspaare aufzusagen, und nicht besser — sogar schlechter —
> darin, irgendetwas Neues zu übersetzen.

### Loss ist ein Stellvertreter. Das Decoding ist die eigentliche Sache.

Hier ist eine Feinheit, die fast jeden stolpern lässt. Der Loss misst, ob das
Modell dem korrekten nächsten Wort eine hohe Wahrscheinlichkeit zuweist, *wenn
die korrekte Antwort bereits vor ihm liegt*. Das ist **nicht** dasselbe, wie
wenn das Modell tatsächlich selbstständig eine gute Übersetzung erzeugt.

- **Decoding** (auch *Generierung* oder *Inferenz*) ist das Modell beim
  **tatsächlichen Übersetzen**: Gegeben nur den Ausgangssatz, gibt es Wort für
  Wort einen Zielsatz aus, ohne sich auf etwas stützen zu können.
- **Loss** ist ein billiger *Stellvertreter*, der während des Trainings
  berechnet wird. Er korreliert mit der Qualität, aber unvollkommen.

> **Ausgearbeitetes Beispiel.** Zwei Checkpoints haben nahezu identischen
> Dev-Loss, aber wenn Sie die Dev-Sätze *decodieren* und die tatsächlichen
> Übersetzungen bewerten, ist einer klar flüssiger. Der Loss konnte diesen
> Unterschied nicht sehen; das Decoding schon. Deshalb decodiert eine seriöse
> Checkpoint-Auswahl das Dev-Set und bewertet die tatsächliche Ausgabe, statt
> allein dem Loss zu vertrauen.

:::note[„Verfolgt der Dev-Loss die Qualität?" ist eine offene Frage, keine Folklore]
Sie werden selbstbewusste Behauptungen hören, dass „der Eval-Loss lügt".
Behandeln Sie das als **unentschieden**, nicht als bewiesen — ein Großteil
dieser Folklore stammte aus kontaminierten Experimenten. Die ehrliche Position:
Der Dev-Loss ist ein nützliches, billiges Signal; eine
**Dev-Generierungsmetrik** (decodieren, dann bewerten) ist ein direkteres.
Bevorzugen Sie das direktere für finale Entscheidungen und wiederholen Sie nicht
„der Loss lügt" als Tatsache.
:::

---

## 4. Kontamination und Leakage: der Fehler, der Ergebnisse auffrisst

**Kontamination** (oder **Leakage**) bedeutet, dass Eval-Antworten heimlich im
Trainingsstapel gelandet sind. Das Modell „besteht dann die Prüfung mit
Bestnoten" aus dem Gedächtnis, Ihre Punktzahl sieht großartig aus, und das
Ergebnis ist wertlos. Dies ist die mit Abstand häufigste Art, wie sich
ressourcenarme MT-Ergebnisse als gefälscht herausstellen — und das Wichtigste,
wovor diese ganze Seite Sie warnt.

Die klassische, heimtückische Form ist ein **Minimalpaar mit gemeinsamem Ziel**:

> **Ausgearbeitetes Beispiel — „Feed him" / „Feed her".** Ein Sprachlehrbuch
> bildet viele verschiedene englische Übungen auf **ein** Zielwort ab. *„Feed him"*
> und *„Feed her"* werden beide zur selben Form übersetzt, `asam`. Eine
> naive zufällige Aufteilung wirft *„Feed him"* → `asam` ins **Training**
> und *„Feed her"* → `asam` ins **Testset**. Die Zielantwort, `asam`,
> befindet sich nun in beiden Stapeln. Das Modell hat `asam` aus dem
> Training memoriert und „hat es beim Test richtig" — aber es hat nichts gelernt.
> In einem realen Projekt sickerten 17 von 54 „Test"-Zeilen auf diese Weise durch,
> und diese Zeilen erreichten **83** bei der Qualitätsmetrik gegenüber **44** für
> saubere Zeilen. Jede auf dieser Zahl aufgebaute Erkenntnis musste verworfen
> werden.

Leakage hat mehrere Gesichter, und ein ordentliches **Leak-Audit** prüft auf
alle davon:

- **Exakte Überschneidung** — dieselbe Quelle *oder* dasselbe Ziel erscheint auf
  beiden Seiten (das Beispiel oben).
- **Fast-Duplikat-Überschneidung** — nicht identisch, aber eine *umformulierte*
  Version eines Testsatzes befindet sich im Training. Dokumente aus derselben
  Domäne teilen Paraphrasen; exaktes Matching übersieht diese, daher messen
  Audits auch die Wortüberschneidungs-Ähnlichkeit.
- **Ganzdatei-Überschneidung** — jemand hat versehentlich mit einer Kopie der
  Testdatei selbst trainiert. (Das passiert wirklich: Eine „Trainings"-Ernte
  entpuppte sich als das Gold-Lehrbuch selbst, 489 von 489 übereinstimmenden
  Zeilen.)

### Gruppendisjunkte Aufteilung — die Lösung

Sie können Leakage nicht beheben, indem Sie die betroffenen Zeilen eine nach der
anderen löschen; das Muster taucht einfach wieder auf. Die Lösung ist die
**gruppendisjunkte Aufteilung**: Bevor Sie aufteilen, verknüpfen Sie jedes Paar,
das eine Quelle *oder* ein Ziel teilt, zu einer **Gruppe**, und schicken Sie
dann jede *ganze Gruppe* auf genau eine Seite. Nun leben `asam` und alles,
was es teilt, vollständig im Train *oder* vollständig im Test — niemals in
beidem. Nach dem Schnitt **verifizieren Sie null Überschneidung** und weigern
sich fortzufahren, wenn eine bestehen bleibt.

:::tip[Das ist, was „der Split-Guard" für Sie tut]
Wenn Ihr Agent den Splitter ausführt, führt er standardmäßig eine
gruppendisjunkte Aufteilung durch und verifiziert automatisch null
Überschneidung. Sie müssen sich nicht an die „Feed him / Feed her"-Falle
erinnern — das Werkzeug macht es schwer, sie zu begehen, und wenn Sie es umgehen,
verweigert es sich mit einer Meldung, die die Lösung benennt.
:::

---

## 5. Overfitting, Early Stopping und das Plateau

**Overfitting** ist das, was passiert, wenn ein Modell über den Punkt des
Lernens hinaus weiter studiert und anfängt zu *memorieren*. Sein Training-Loss
sieht wunderbar aus; seine tatsächliche Übersetzungsqualität wird schlechter.
Die Loss-Lücke aus [§3](#3-what-training-actually-does-loss-and-its-two-faces)
ist die Art, wie Sie es erkennen.

**Early Stopping** ist die Abwehr: Beobachten Sie das Dev-Signal, und wenn es
sich für eine festgelegte Anzahl von Prüfungen (seine **Geduld**/patience) nicht
mehr verbessert, stoppen Sie das Training und behalten die beste frühere Version
— den besten **Checkpoint** (eine gespeicherte Momentaufnahme des Modells
mitten im Training). Early Stopping verhindert verschwendete Rechenleistung und
Overfitting zugleich.

Aber Early Stopping hat einen berühmten Fehlermodus, wenn Sie hauptsächlich auf
synthetischen Daten trainieren — das **synthetisch→echt-Transfer-Plateau**:

> **Ausgearbeitetes Beispiel — der Halbepochen-Tod.** Ein Modell trainiert auf
> einer Mischung, die zu 97,5 % synthetisch ist, und wird an einem *echten*
> Dev-Set von 42 Sätzen beurteilt. Früh wird das Modell schnell gut in der
> synthetischen Masse, sodass der Dev-Loss auf den echten Sätzen schnell fällt,
> um Schritt 8.000 herum den Tiefpunkt erreicht — und dann *nach oben* driftet.
> Naives Early Stopping sieht „Dev-Loss stieg 6 Prüfungen in Folge" und erklärt
> bei Epoche 0,52 den Sieg, ein Zwanzigstel des geplanten Trainings. Aber das
> Modell war nicht fertig; es hatte lediglich das *einfache* synthetische Lernen
> abgeschlossen und den langsamen **Transfer** zur echten Sprachqualität noch
> nicht begonnen. Es wurde am Plateau gestoppt, vor der Belohnung.

Die Lehre: Bei einer synthetiklastigen Mischung ist ein *früher* Abfall-und-
Anstieg im Dev-Loss **zu erwarten**, keine Konvergenz. Die Stopp-Regel muss
klug genug sein, um das Training durch das Plateau hindurchzuhalten — eine
Untergrenze, die aus der Größe Ihrer Mischung abgeleitet wird, keine magische
Zahl, die Sie kennen sollen.

:::note[Ehrliche Setups bringen echte Bugs ans Licht]
Dieser Plateau-Bug war monatelang unsichtbar — weil frühere Läufe
(unrechtmäßig) das *Test*-Set als ihr Dev-Set verwendet hatten, was ihn
verbarg. Der erste *saubere* Lauf hat ihn aufgedeckt. Das ist das
wiederkehrende Thema: Es ehrlich zu machen, hält Sie nicht nur wahrhaftig,
sondern macht auch echte Probleme sichtbar.
:::

---

## 6. Qualität messen: Metriken, Batterien, Register

Wenn das Modell einen Testsatz *decodiert*, wie bewerten Sie seine Antwort im
Vergleich zur Referenzübersetzung?

### Teilpunkt-Metriken: chrF++ und BLEU

Eine Übersetzung stimmt selten Wort für Wort exakt mit der Referenz überein und
kann dennoch vollkommen gut sein. Daher verwendet MT **Teilpunkt**-Metriken, die
*Überschneidung* belohnen, statt eine exakte Übereinstimmung zu verlangen:

- **chrF++** bewertet die Überschneidung von **Zeichenfolgen** (plus einiger
  Wortfolgen) zwischen der Ausgabe des Modells und der Referenz. Da es auf
  Zeichenebene arbeitet, vergibt es Teilpunkte dafür, ein Wort *fast* richtig
  zu treffen — der korrekte Stamm mit falscher Endung bringt immer noch etwas.
  Das macht es gut geeignet für morphologisch reiche Sprachen, in denen eine
  Wurzel viele Formen annimmt. Höher ist besser; es wird meist auf einer
  Skala von 0–100 angegeben.
- **BLEU** ist der ältere Standard. Es bewertet die Überschneidung von
  **Ganzwort**-Blöcken (N-Gramme). Es wird immer noch weit verbreitet
  berichtet, ist aber hart bei Sprachen, in denen Wörter viele flektierte
  Formen haben, weil ein Beinahe-Treffer bei einer Endung als vollständiger
  Fehltreffer zählt.

> **Ausgearbeitetes Beispiel.** Referenz: `awâsisak mêtawêwak`. Modellausgabe:
> `awâsisak mêtawêw` (richtige Wurzel, falsche Endsilbe). BLEU sieht das zweite
> Wort schlicht als falsch an. chrF++ sieht, dass die meisten Zeichen
> übereinstimmen, und vergibt Teilpunkte. Dieselbe Ausgabe, sehr
> unterschiedliche Punktzahl — weshalb die Metrik, die Sie wählen, die
> Geschichte verändert.

:::tip[Welcher Metrik man glauben soll, ist eine gemessene Frage]
Nicht jede Metrik verfolgt das menschliche Urteil für jede Sprache gleich gut.
Für einige Familien korreliert BLEU kaum mit dem, was Menschen denken; für
andere ist eine ausgefeilte neuronale Metrik die unzuverlässige. Bevor Sie auf
*irgendeine* Metrik hin optimieren, prüfen Sie die Belege zur
[Metrik-Zuverlässigkeit](/docs/network/specifications/metric-reliability) für
Ihre Sprachfamilie — und wenn die ehrliche Antwort „ungemessen" lautet, sagen
Sie das, statt einer Zahl zu vertrauen.
:::

### Neuronale Metriken: COMET, MetricX

Über die Zeichen-/Wortüberschneidung hinaus verwenden **neuronale Metriken**
(COMET, COMET-QE, MetricX) ein trainiertes Modell, um Übersetzungen eher wie ein
Mensch zu *beurteilen*. Sie können weitaus zuverlässiger sein — aber nur für
Sprachen, für deren Beurteilung sie trainiert wurden, was die meisten
ressourcenarmen ausschließt. Sie laufen auch richtungsabhängig: **MetricX** ist
**niedriger-ist-besser**, das Gegenteil von chrF++ — ein Detail, das man
kennen sollte, bevor man Zahlen vergleicht.

### Fehlerbalken: Vertrauen Sie nie einer einzelnen Zahl

Eine einzelne Punktzahl ohne Unsicherheit ist eine Falle. Bei kleinen Testsets
sind Unterschiede oft nur Rauschen.

> **Ausgearbeitetes Beispiel.** „Das Modell verbesserte sich beim
> Erzählgeschichten-Set von 16,7 auf 18,1" klingt nach Fortschritt — bis Sie
> bemerken, dass das Set 37 Sätze hat. Mit so wenig Daten ist eine
> ±3-Punkte-Schwankung reiner Zufall. Der ehrliche Bericht lautet
> `17.4 [15.1, 19.8] 95% CI`: die Zahl, plus das **Konfidenzintervall (KI)** — der Bereich,
> in den der wahre Wert plausibel fällt. Wenn sich die Intervalle zweier Modelle
> stark überschneiden, können Sie nicht behaupten, dass eines besser ist.

Gutes Tooling weigert sich, eine Punktzahl ohne ihr KI auszugeben, und verwendet
einen [Signifikanztest](/docs/network/specifications/significance), bevor es
einen A-schlägt-B-Sieg erklärt.

### Batterien und Register

Echte Sprache ist keine einzige flache Sache. Ein **Register** (oder eine
**Domäne**) ist eine *Art* von Sprache: lockere Konversation, eine
Lehrbuchübung, ein Nachrichtenartikel, eine mündliche Erzählung, formelle
Regierungsprosa. Ein Modell kann in einer großartig und in einer anderen
schlecht sein.

Eine **Batterie** ist ein Evaluationsset, das bewusst in mehrere Register
aufgeteilt und **separat** bewertet wird, sodass ein einzelner Durchschnitt
keine Schwäche verbergen kann.

> **Ausgearbeitetes Beispiel.** Ein Modell erreicht insgesamt 46 — respektabel.
> Aber die Batterie-Aufschlüsselung zeigt 58 bei Lehrbuchübungen und 22 bei
> mündlichen Erzählungen. Der Durchschnitt verdeckte ein nahezu vollständiges
> Versagen bei natürlicher Sprache. Nur die Batterie pro Register hat es
> offengelegt.

---

## 7. Daten herstellen, wenn Sie nicht genug haben

Wenn echte Paare knapp sind, stellen Sie synthetische her. Zwei Techniken
dominieren, und beide stehen und fallen mit einem Wort: **Verifikation**.

### FSTs und morphologische Analysatoren

Ein **morphologischer Analysator** ist ein Werkzeug, das die Wortgrammatik einer
Sprache kennt: wie Wurzeln sich mit Präfixen und Suffixen verbinden, um gültige
Wörter zu bilden. Viele sind als **FSTs** gebaut — *endliche Transduktoren*,
eine präzise, regelbasierte Technologie (kein neuronales Netz), die in zwei
Richtungen laufen kann:

- **analysieren**: Gegeben ein Wort, es in Wurzel + grammatische Tags zerlegen
  (`nipâw` → „schlafen, 3. Person Singular").
- **generieren**: Gegeben eine Wurzel + Tags, die korrekte Wortform
  buchstabieren (`sleep + 3sg` → `nipâw`).

Für eine polysynthetische Sprache — bei der ein einziges Wort tragen kann, wofür
das Englische einen ganzen Satz braucht — ist ein FST Gold wert: Er kann *jede*
gültige Form *jeder* bekannten Wurzel buchstabieren, was genau das Rohmaterial
für die Herstellung von Trainingsdaten ist.

### Round-Trip-Verifikation — die Regel, die synthetische Daten vertrauenswürdig macht

Das Herstellen von Daten ist gefährlich: Ein Generator kann still und leise
Unsinn ausgeben. Die Disziplin, die das verhindert, ist das **Round-Trip-Gesetz**:
Jedes hergestellte Wort muss *generieren → analysieren → dieselbe Analyse, mit
der Sie begonnen haben* überstehen. Wenn Sie den FST bitten, eine Form zu
buchstabieren, und diese Schreibweise dann zurückführen und Ihre Tags nicht
zurückerhalten, wird das Wort verworfen. Nichts, was den Round Trip nicht
besteht, wird jemals in die Trainingsdaten aufgenommen.

> **Ausgearbeitetes Beispiel — das Ein-Zeichen-Leck.** Ein Wörterbuch
> buchstabierte einen Laut mit dem Buchstaben `ý`; der Analysator
> erwartete schlichtes `y`. Weil niemand die beiden Schreibweisen an
> der Grenze abglich, wurden *1.375 Verben* stillschweigend als „unbekannt"
> beurteilt und aus der Generierung ausgeschlossen — wochenlang, unsichtbar.
> Die Lösung ist ein **Kanonisierer**: eine Funktion, die die Schreibweise
> *überall*, wo sich zwei Komponenten treffen, auf eine einzige Konvention
> normalisiert, plus ein **Trichter-Audit**, das zählt, wie viele Elemente jede
> Pipeline-Stufe überstehen, sodass sich ein stiller Verlust von 1.375
> Elementen nie wieder verstecken kann.

### Abdeckung, nicht nur Volumen

Eine Million hergestellter Sätze klingt umfassend. Sie sind es nicht, wenn sie
eine Million Variationen derselben wenigen Formen sind.

> **Ausgearbeitetes Beispiel.** Ein synthetischer Korpus von 1.000.000 Paaren
> enthielt letztlich **keine Imperative** („Wähle!"), **keine W-Fragen**
> („wer/wo/wann"), **keinen Besitz** („mein Hund") und **keine inversen Formen**
> („sie sieht *mich*" — Kerngrammatik in vielen Sprachen). Der Analysator konnte
> sie alle generieren; die Vorlagen fragten nur nie danach. Das Volumen verdeckte
> ein strukturelles Loch.

Die Abwehr ist eine **Abdeckungs-Checkliste**, die aus einer veröffentlichten
Grammatik übertragen wird: die erforderlichen grammatischen Phänomene, jedes mit
Beleg, sodass der Build fehlschlägt, wenn ein erforderliches null Beispiele hat.
Und eine **Obergrenze pro Art** hindert eine einzelne Vorlagenform daran, zu
dominieren — in einem Korpus machten zwei Formen 54 % der Daten aus, sodass die
Hälfte der „Erfahrung" des Modells zwei Satzmuster waren.

### Rückübersetzung

**Rückübersetzung** ist die andere große synthetische Technik, und sie ist
clever. Wenn Sie schlichten, *unübersetzten* Text in Ihrer Zielsprache haben
(einen **einsprachigen** Korpus — viel leichter zu finden als paralleler Text),
können Sie:

1. ein *umgekehrtes* Modell nehmen (Ziel → Englisch),
2. Ihren einsprachigen Zieltext maschinell *ins* Englische übersetzen,
3. jeden maschinen-englischen Satz mit dem **echten** Zielsatz paaren, mit dem
   Sie begonnen haben, und
4. Ihr Vorwärtsmodell (Englisch → Ziel) auf diesen Paaren trainieren.

Die Zielseite ist echte Sprache; nur die englische Seite ist synthetisch —
meist ein gutes Geschäft.

> **Ausgearbeitetes Beispiel.** Sie haben 50.000 echte Sätze in Ihrer
> Zielsprache, aber nur 400 parallele Paare. Übersetzen Sie die 50.000 zurück
> in grobes Englisch, und Sie haben einsprachigen Text in 50.000 Trainingspaare
> verwandelt, deren *Zielseite* authentisch ist.

:::danger[Leak-Auditieren Sie auch Ihren einsprachigen Text]
Rückübersetzung fühlt sich sicher an, weil „es ja nur einsprachiger Text ist" —
aber dieser Text kann Ihre Eval-Daten in Verkleidung *sein*. In einem Projekt
erwischte das Leak-Audit eine einsprachige Ernte, die exakt mit dem Gold-Testset
übereinstimmte. Auditieren Sie **jede** Eingabe gegen **jedes** Eval-Set,
synthetische und einsprachige eingeschlossen — nicht nur Ihren offensichtlichen
parallelen Korpus.
:::

### Synthetische Daten taggen

Eine letzte Praxis: **Taggen** Sie synthetische Quellen mit einem Marker (wie
`<synth>` oder `<bt>`) und lassen Sie echte (Gold-)Daten ungetaggt.
Dies erlaubt dem Modell, „Übungsmaterial" von „der echten Sache" zu
unterscheiden, sodass die authentischen Daten seinen Ausgabestil verankern; zur
Übersetzungszeit fügen Sie das Tag nicht hinzu, und das Modell stützt sich auf
das, was es aus dem Gold gelernt hat. (Siehe das
[Rückübersetzungs-Kochbuch](/docs/network/tutorials/back-translation) für diese
Technik im Detail.)

---

## 8. Wie die Teile zusammenhängen

Von oben nach unten gelesen ist dies ein Workflow:

1. Sammeln Sie **echte parallele Daten** ([§1](#1-the-two-piles-training-data-and-evaluation-data)) — meist zu wenig.
2. **Teilen** Sie sie gruppendisjunkt in Train / Dev / Test auf ([§2](#2-splitting-train-dev-and-test), [§4](#4-contamination-and-leakage-the-mistake-that-eats-results)).
3. **Stellen** Sie synthetische Daten her, um die Lücke zu füllen — round-trip-verifiziert, abdeckungsgeprüft, leak-auditiert ([§7](#7-manufacturing-data-when-you-dont-have-enough)).
4. **Trainieren** Sie auf der Mischung und beobachten Sie **Dev-Loss / Dev-Generierung**, um **Overfitting** zu vermeiden und das **Plateau** zu überstehen ([§3](#3-what-training-actually-does-loss-and-its-two-faces), [§5](#5-overfitting-early-stopping-and-the-plateau)).
5. **Decodieren** Sie die zurückgehaltene **Test-Batterie** und bewerten Sie sie mit **Teilpunkt-Metriken + Konfidenzintervallen**, pro **Register** ([§6](#6-measuring-quality-metrics-batteries-registers)).
6. Tun Sie all das, ohne jemals Eval-Antworten das Training berühren zu lassen ([§4](#4-contamination-and-leakage-the-mistake-that-eats-results)) — die Regel, der die anderen fünf dienen.

Jede Regel hier entspricht einem echten, gemessenen Fehler, den ein reales
Projekt gemacht und dokumentiert hat. Sie müssen sie nicht auswendig lernen:
Die Trainings-Suite mechanisiert jeden einzelnen, sodass der ehrliche Weg der
Standard ist und die unehrlichen Wege sich mit einer Erklärung verweigern. Das
ist das Thema der nächsten Seite.

## Ihren Agenten mit diesem Vokabular steuern

Da Sie über einen Coding-Agenten arbeiten werden, ist der praktische Nutzen
dieser Seite, dass Sie nun Anweisungen wie diese geben — und überprüfen — können:

- *„Teile den Korpus gruppendisjunkt auf und verifiziere null Überschneidung vor dem Training."*
- *„Schnitze ein Dev-Set aus der Trainingsseite; wähle niemals Checkpoints auf dem Testset aus."*
- *„Leak-auditiere jede Eingabe gegen jedes Eval-Set, einschließlich der synthetischen und einsprachigen Daten."*
- *„Berichte chrF++ mit 95-%-Konfidenzintervallen, aufgeschlüsselt nach Register."*
- *„Prüfe die Metrik-Zuverlässigkeit für diese Sprachfamilie, bevor wir auf irgendeine Punktzahl hin optimieren."*

Wenn Ihrem Agenten der Champollion-MCP-Server zur Verfügung steht, kann er
`get_training_guardrails` aufrufen, um diese Regeln — und den Fehler, den jede von ihnen
beseitigt — direkt in seinen Kontext zu ziehen, bevor er einen einzigen Befehl
schreibt.

**Nächstes:** setzen Sie es in die Tat um in
[**Sie möchten also Ihr eigenes Modell trainieren**](/docs/network/tutorials/train-your-own-model),
der Schritt-für-Schritt-Anleitung — oder lesen Sie
[**Ein Modell ehrlich trainieren**](/docs/network/getting-started/training-honestly),
um zu erfahren, wie die Suite jedes Konzept hier in ein automatisches Sicherheitsgeländer verwandelt.

Wenn Begriffe wie *Tokenizer* noch unklar sind, ist [Tokenizers](/docs/learn/tokenizers) die ideale Grundlagen-Einführung — lesen Sie diese einmal durch, und alles oben Genannte wird einfacher.
