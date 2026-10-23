---
sidebar_position: 7
title: "Verbindungsstärke"
slug: '/network/specifications/connection-strength'
related:
  - label: "Scoring Specification"
    to: /docs/network/specifications/scoring
    kind: spec
    note: "How individual runs are scored"
  - label: "Metric Reliability"
    to: /docs/network/specifications/metric-reliability
    kind: spec
    note: "How well each metric tracks human judgment, per language pair"
  - label: "Statistical Significance Testing"
    to: /docs/network/specifications/significance
    kind: spec
---

# Verbindungsstärke

Wenn die Netzwerkkarte einen Bogen zwischen zwei Sprachen zeichnet, beantwortet
seine Farbe eine einzige Frage: **Wurde dieses Paar tatsächlich gemessen?**

Das ist bewusst weniger, als die Karte früher beanspruchte. Bis zum 04.09.2026 wurde ein Bogen
anhand einer fünfstufigen Stärkeskala eingefärbt – wie *gut* die beste Übersetzung
auf einer zufallskorrigierten Skala war. Diese Skala wurde eingestellt. Diese Seite
erklärt den Wert, der dahinterstand, warum seine Entfernung die ehrlichere Entscheidung war,
und was die Karte jetzt aussagt.

## Das Problem: Rohwerte sind bei null nicht gleich null

Die meisten unserer Werte sind **chrF++** (Character-n-Gram-F-Score, [Popović
2017](https://aclanthology.org/W17-4770/)) — dieser misst, wie stark sich die
Zeichen und Wörter einer Übersetzung mit einer Referenzübersetzung überschneiden,
auf einer Skala von 0 bis 100.

Aber *zufälliger Text ist nicht gleich null*. Jedes Schriftsystem liefert eine
gewisse Überschneidung „umsonst": Eine Orthografie mit wenigen unterschiedlichen
Zeichen oder langen, vorhersehbaren Wörtern erzielt messbar mehr als null, selbst
wenn die „Übersetzung" Unsinn ist. Diese kostenlose Überschneidung — der
**Zufallsboden** — unterscheidet sich je nach Sprache. In unseren Messungen reicht
sie von etwa 1,6 (chinesische Schrift) bis zu mehr als 13 (einige Sprachen mit
lateinischer und arabischer Schrift). Ein roher chrF++-Wert von 14 ist in einer
Sprache nahezu zufälliges Rauschen und in einer anderen ein echtes Signal — daher
ist roher chrF++ **nicht sprachübergreifend vergleichbar**, und eine danach
eingefärbte Karte würde manche Schriften stillschweigend begünstigen.

Dieses Problem ist real, und genau deshalb stuft die Karte die Stärke über
Sprachen hinweg **nicht** vergleichend ein. Es ist kein Problem, das wir gelöst haben.

## Die Korrektur, die wir entwickelt haben, und warum sie die Karte nicht mehr einfärbt

**Zufallskorrigiertes chrF++ (cchrF++)** skaliert einen Score so neu, dass 0 „nicht
besser als der Zufall“ *in dieser Sprache* bedeutet und 1 perfekt:

```
cchrF++ = (chrF++ − floor) / (100 − floor)
```

Die Untergrenzen werden gemessen, nicht angenommen: Für jede Sprache führen wir eine Monte-Carlo-Schätzung
durch – Tausende von zufälligen Baselines derselben Orthografie, bewertet anhand echter
Referenzen –, und zwar ausschließlich unter Verwendung öffentlich zugänglicher monolingualer Texte (FLORES-200 dev,
von der Quelle bezogen, niemals weiterverbreitet). Die Untergrenzen-Tabelle deckt 196
Sprachen ab und ist ein von Champollion abgeleitetes Artefakt.

**Was diese Korrektur tatsächlich nachweist.** Die Zufallsuntergrenze existiert, variiert
um etwa das Neunfache über verschiedene Schriftsysteme hinweg und kann aus monolingualem
Text ganz ohne menschliche Qualitätsbewertungen geschätzt werden. Ihre Subtraktion bereinigt
triviale Baselines nachweislich um die Zufallskomponente: Ein Copy-the-Source-Trick,
der im Finnischen unkorrigiert über 15 Punkte erzielt, fällt auf etwa 2,5 und in den meisten Sprachen auf genau
null. Der entfernte „Zufall“ entspricht Oberflächenstatistiken, keinem verbleibenden Sinngehalt.

**Was sie nicht nachweist.** Sie bewirkt, dass **0** in jeder Sprache dasselbe
bedeutet. Sie bewirkt nicht, dass **40** dasselbe bedeutet. Oberhalb der Untergrenze
ist die Korrektur eine reine Neuskalierung, und der Nachweis, dass gleiche *Qualität*
über Sprachen hinweg zu gleichen korrigierten Werten führt, ist nur am
unteren Ende des Bereichs erbracht. Im Vergleich zu Pools menschlicher Bewertungen hilft
sie dort, wo sich die Untergrenzen tatsächlich unterscheiden, bewirkt nichts, wo dies nicht der
Fall ist, und bei einem Pool mit einheitlich niedrigen Untergrenzen verschob sie die Übereinstimmung
mit menschlichen Bewertern in die *falsche* Richtung – ein Ergebnis, das wir noch nicht aufgeklärt haben.

Das Einfärben einer öffentlichen Karte mit einer fünfstufigen Stärkeskala behauptete mehr, als
diese Belege stützen – und das genau bei den ressourcenarmen Sprachen, bei denen Fehler
am schwersten wiegen. Daher wurde die Skala ausgemustert, bis weitere Untersuchungen die Frage klären.

Beachten Sie, dass eine Einfärbung nach **unkorrigiertem** chrF++ stattdessen nie eine Option
war: Unkorrigierte Scores sind über Sprachen hinweg überhaupt nicht vergleichbar – genau aus diesem
Grund wurde die Korrektur entwickelt. Eine binäre Kodierung ist der ehrliche Ausweichweg, keine
Herabstufung auf etwas Schwächeres.

## Wo die Messung in der Hierarchie steht

Vom vertrauenswürdigsten zum am wenigsten vertrauenswürdigen Verfahren:

1. **Menschliche Überprüfung** – fließend Sprechende bewerten die Ausgabe ([Sprecher-Validierung](/docs/network/specifications/speaker-validation)). Nichts
   Automatisches steht darüber.
2. **MQM-artige Expertenannotation** ([Multidimensional Quality
   Metrics](https://aclanthology.org/2014.tc-1.6/), Lommel et al.) – das
   Protokoll, das WMT für seine Gold-Urteile verwendet; teuer, selten, sehr gut.
3. **Automatische Scores – ausschließlich innerhalb eines Sprachpaars.** Unkorrigiertes chrF++, BLEU,
   COMET und die übrigen sind nützlich, um Systeme für *dasselbe* Paar zu vergleichen;
   siehe [Metrik-Zuverlässigkeit](/docs/network/specifications/metric-reliability)
   dazu, wie ungenau jede Metrik menschliche Urteile bei Ihrem Paar abbilden kann.
4. **Sprachübergreifende Stärke.** Wir veröffentlichen kein Ranking. Siehe oben.

Sobald menschlich verifizierte und MQM-taugliche Ergebnisse in die Tafel eingehen,
haben sie für dasselbe Paar Vorrang vor automatischen Werten.

## Wie die Karte es darstellt

Jeder visuelle Kanal trägt genau eine Bedeutung:

| Kanal | Bedeutung |
|---------|---------|
| **Farbe** | gemessen. Eine Farbe, keine Skala – der Bogen besagt, dass ein Durchlauf dieses Paar bewertet hat, und sagt nichts darüber aus, wie gut |
| **Gestrichelt + abgeblendet** | vorläufig: Der Testdatensatz liegt unter der [Signifikanzgrenze](/docs/network/specifications/significance) (n &lt; 100), wo Score-Abstände innerhalb von ~5 chrF++ Rauschen sind. Dies ist eine Eigenschaft des Stichprobenumfangs, unabhängig von jeder Metrik |
| **Breite** | konstant. Es gibt nichts weiter zu kodieren |

Nur **gemessene** Paare zeichnen einen gemessenen Bogen. Registrierte Paare – eingereiht
zur Messung, aber noch nicht bewertet – erscheinen als schwache, flächig gefärbte
Haarlinien, deren Farbe lediglich angibt, *wie das Paar heute erreichbar ist*
(kommerzielle API · Open-Source-Modell · Frontier, kein Anbieter), niemals jedoch,
wie gut eine Übersetzung ist. Die beiden Vokabularien sind bewusst getrennt:
gedämpfte, flache Linien = Erreichbarkeit, die eine gemessene Farbe = gemessen.
Der zugrunde liegende Score eines Bogens ist der beste gemessene Durchlauf für dieses Paar auf dem
öffentlichen Dashboard, der automatisch aktualisiert wird, sobald neue Durchläufe eingehen, und wird als
Wert innerhalb des Paars angezeigt, wenn Sie den Bogen öffnen – niemals als sprachübergreifender Rang.

## Das Kleingedruckte

- Die Zufallsuntergrenzen sind Eigenschaften von Metrik × Orthografie, die ausschließlich aus
  monolingualem Text geschätzt werden; es werden keine Inhalte aus Parallelkorpora einbezogen oder gespeichert.
- Der Atlas der Untergrenzen und die Korrektur bleiben veröffentlichte Forschung, und der Code
  bleibt im Repository unter Tests. Sie sind an keine öffentliche Oberfläche angebunden.
- **Sie korrigiert die Untergrenze, nicht die Obergrenze.** Wie hoch ein Score für eine wirklich gute
  Übersetzung ausfallen kann, variiert weiterhin je nach Sprache, und die Korrektur ändert daran
  nichts.
- **Sie bietet keinen Schutz gegen das Kopieren bei geteilter Schrift.** Eine Ausgabe, die lediglich
  die Quelle kopiert, kann immer noch über dem Zufallsniveau liegen, wenn Ausgangs- und Zielsprache
  dasselbe Schriftsystem teilen.
- **Sie kann Systeme innerhalb eines Sprachpaars nicht neu ordnen.** Oberhalb der Untergrenze ist
  die Korrektur eine reine Neuskalierung, sodass Rankings innerhalb eines Paars davor und
  danach identisch sind – ihr einziger potenzieller Wert lag im Sprachvergleich.
- Ein gemessener Bogen zeigt Ihnen, dass ein Paar bewertet wurde. Er validiert **nicht**
  Bedeutung, Register oder kulturelle Angemessenheit. Dies bleiben menschliche Beurteilungen ([Ehrliche
  Einschränkungen](/docs/network/honest-limitations)).
- Die Methodik der Zufallsuntergrenze ist Forschung von Champollion, die hier veröffentlicht
  wurde, genau damit sie überprüft und hinterfragt werden kann.
