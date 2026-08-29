---
title: "Wie ein Tokenizer entscheidet, welche Sprachen günstig sind"
sidebar_label: "Tokenizer"
description: "Bevor ein Sprachmodell ein Wort liest, zerlegt es etwas in Einzelteile. Dieser Schritt wird aus Daten gelernt, optimiert Komprimierung statt Bedeutung und entscheidet im Stillen, welche Sprachen in der Nutzung teuer sind. Eine Einführung für Leser:innen, die bei null anfangen."
---

# Wie ein Tokenizer entscheidet, welche Sprachen günstig sind

:::info[Für wen dies gedacht ist]
Für alle. Diese Seite setzt weder Kenntnisse im Bereich des maschinellen Lernens noch in der Linguistik
voraus. Wenn Sie wissen, was ein Sprachmodell ist – eine Software, die Text aufnimmt und
Text ausgibt –, reicht das völlig aus.
:::

Jedes Sprachmodell hat einen unsichtbaren ersten Schritt. Bevor es ein Wort liest, zerlegt eine
Software dieses Wort in Fragmente. Diese Fragmente sind das, was das
Modell tatsächlich sieht.

Dieser Schritt wird als **Tokenisierung** bezeichnet, und fast niemand beachtet ihn. Es lohnt sich jedoch,
ihn zu betrachten, denn dies ist der Punkt, an dem die Nutzung einiger Sprachen um ein Vielfaches
teurer wird als die anderer – und diese Entscheidung fällt, bevor überhaupt jemand
über Qualität, Fairness oder Abdeckung nachdenkt.

---

## 1. Ein Modell kann nicht lesen

Ein neuronales Netz führt arithmetische Operationen mit Zahlen durch. Es hat keine Vorstellung von Buchstaben oder
Wörtern. Daher muss Text zunächst in Zahlen umgewandelt werden.

Ein **Tokenizer** ist die Software, die diese Umwandlung vornimmt und sie am Ende
wieder rückgängig macht. Er verwandelt eine Zeichenkette in eine Liste von Ganzzahlen, wobei jede Ganzzahl auf
eine Zeile in einer großen Nachschlagetabelle verweist.

Er trifft zwei Entscheidungen:

**Das Vokabular** – das feste Inventar an Teilen, die das Modell sehen darf.
Keine Wörter: *Teile*. Häufige Teile sind ganze Wörter, aber selteneres Material wird
zerlegt. Das Inventar hat eine feste, im Voraus festgelegte Größe – oft Zehntausende
von Einträgen.

**Die Segmentierung** – für jede tatsächliche Zeichenkette: welche Teile in welcher Reihenfolge. Das
Wort *unbelievable* könnte zu `un` + `believ` + `able` werden, oder zu einem einzigen Teil, oder
zu elf einzelnen Buchstaben. Was Sie erhalten, hängt vollständig davon ab, was sich im
Vokabular befindet.

> **Praxisbeispiel.** Wenn `believ` im Vokabular enthalten ist, kostet *unbelievable*
> drei Teile. Ist dies nicht der Fall, greift der Tokenizer auf immer kleinere
> Fragmente zurück, bis er das Wort abdecken kann – möglicherweise ein Teil pro Buchstabe. Dasselbe
> Wort, dieselbe Bedeutung, dreimal so viele Teile oder elfmal so viele Teile,
> abhängig von einer Entscheidung, die lange vor Ihrer Eingabe getroffen wurde.

---

## 2. Das Vokabular wird *erlernt*, und es optimiert das Falsche

Hier ist der Teil, der viele überrascht.

Das Vokabular wird nicht von einem Linguisten entworfen. Es wird **aus einer Menge von
Texten erlernt**, und zwar von einem Algorithmus, dessen Ziel die **Kompression** ist – diesen Text mit so
wenigen Teilen wie möglich abzudecken.

Bedeutung spielt dabei keine Rolle. Der Algorithmus hat keine Ahnung, was ein Wort ist, was ein Präfix
ist oder dass eine Sprache überhaupt existiert. Er zählt, was oft zusammen auftritt, und gibt
häufigen Sequenzen einen eigenen Eintrag, weil das den Text kürzer macht.

Die Konsequenz daraus ergibt sich mechanisch. Teile werden einer Sprache ungefähr
in dem Verhältnis zugewiesen, **wie viel von dieser Sprache in der Textmenge enthalten war**. Eine Sprache, die
einen großen Anteil ausmachte, erhält viele dedizierte Teile, und ihre Wörter bleiben ganz
oder fast ganz. Eine Sprache, die fast gar nicht vorkam, erhält fast keine eigenen Teile,
und ihre Wörter werden durch beliebige generische Fragmente abgedeckt, die gerade passen.

Eine Sprache, die überhaupt nicht in der Textmenge enthalten war, erhält **null** dedizierte Teile. Es
funktioniert trotzdem – der Tokenizer wird immer *irgendeinen* Weg finden, den Text darzustellen,
da er auf einzelne Zeichen oder rohe Bytes zurückgreifen kann. Es kostet nur
erheblich mehr, überhaupt etwas auszudrücken.

:::note[Dies ist kein Fehler]
Nichts hat hier versagt. Der Kompressionsalgorithmus hat genau das getan, was von ihm
verlangt wurde. Das Problem ist, dass „mache den Trainingstext kurz“ als
Stellvertreter für „stelle Sprache gut dar“ akzeptiert wurde, und für Sprachen, die in diesem Text fehlen, versagt dieser
Stellvertreter völlig.
:::

---

## 3. Fertilität: Die Zahl, die den Schaden benennt

**Fertilität** ist die durchschnittliche Anzahl an Tokens, die ein Wort kostet.

Für eine Sprache, auf die der Tokenizer intensiv trainiert wurde, liegt die Fertilität nahe bei 1 –
die meisten Wörter bestehen aus einem einzigen Teil. Für eine Sprache, die er nie gesehen hat, kann derselbe Wert
um ein Vielfaches höher sein, da jedes Wort aus Fragmenten zusammengesetzt werden muss.

Diese einzige Zahl führt kaskadenartig zu vier separaten Belastungen:

| Belastung | Was sie bedeutet |
|---|---|
| **Kosten** | Die meisten kommerziellen Modelle rechnen pro Token ab. Mehr Tokens pro Wort bedeuten, dass derselbe Satz mehr Geld kostet, wenn er übersetzt, zusammengefasst oder generiert wird. |
| **Kontext** | Modelle haben ein festes Fenster. Eine hohe Fertilität bedeutet, dass weniger von Ihrem eigentlichen Dokument hineinpasst. |
| **Rechenleistung** | Längere Sequenzen sind langsamer, überall und für immer. |
| **Lernen** | Der schwierigste Punkt. Die Bedeutung ist nun über viele informationsarme Fragmente verstreut, sodass das Modell ein schwereres Problem lösen muss – selbst bei identischen Daten. |

Die ersten drei sind unfair. Der vierte ist derjenige, der die Qualität beeinträchtigt.

**Dies ist gemessen, nicht nur behauptet.** Petrov, La Malfa, Torr und Bibi fanden heraus, dass
derselbe Text, übersetzt in verschiedene Sprachen, sich in der tokenisierten
Länge um das **bis zu 15-Fache** unterscheiden kann, und dass diese Diskrepanz auch bei Tokenizern bestehen bleibt,
die gezielt für den mehrsprachigen Einsatz entwickelt wurden.

Ihre Erkenntnis verkompliziert die offensichtliche Lösung: Modelle auf Zeichen- und Byte-Ebene
– die intuitive Antwort: „Verwenden Sie einfach Buchstaben, dann ist jede Sprache gleich“ –
zeigten bei einigen Sprachpaaren immer noch einen Unterschied von **über dem 4-Fachen**. Der Rückgriff
auf kleinere Einheiten verringert die Lücke. Er schließt sie jedoch nicht.

> Aleksandar Petrov, Emanuele La Malfa, Philip Torr, Adel Bibi.
> *Language Model Tokenizers Introduce Unfairness Between Languages.*
> [NeurIPS 2023](https://proceedings.neurips.cc/paper_files/paper/2023/hash/74bb24dca8334adce292883b4b651eda-Abstract-Conference.html).

---

## 4. Warum dies einige Sprachen strukturell und nicht nur statistisch trifft

Eine Unterrepräsentation in der Trainingsmenge ist eine Ursache. Es gibt noch eine zweite, und
diese verschwindet nicht durch das Hinzufügen von Daten.

Sprachen unterscheiden sich darin, wie viel Arbeit ein einzelnes Wort leistet.

Im Englischen besteht ein Satz meist aus aneinandergereihten, separaten Wörtern: *I saw them*. Drei
Wörter, drei Konzepte, Leerzeichen dazwischen. Tokenizer wurden von Menschen entwickelt,
die an Sprachen arbeiten, die sich so verhalten, und sie setzen dies voraus – die meisten von ihnen
behandeln ein Leerzeichen buchstäblich als Teilegrenze.

Andere Sprachen packen einen ganzen Teilsatz in **ein einziges Wort**, indem sie bedeutungstragende
Teile aneinanderreihen. Linguisten nennen diese Sprachen **polysynthetisch**, und sie sind
unter den indigenen Sprachen Amerikas und anderswo weit verbreitet.

> **Praxisbeispiel.** Auf Plains Cree (nêhiyawêwin) bedeutet *nikî-wâpamâwak* in
> etwa „Ich sah sie“. Es ist ein einziges Wort. Darin stecken mehrere bedeutungstragende Teile:
> wer handelt, dass die Handlung in der Vergangenheit liegt, das Sehen selbst und wer
> gesehen wird.
>
> Ein Englischsprecher benötigt dafür vier Wörter, und ein auf Englisch trainierter Tokenizer
> wird wahrscheinlich vier Teile dafür aufwenden. Ein Tokenizer, der noch nie Cree gesehen hat,
> hat für keinen dieser Teile einen Eintrag, also zerfetzt er das einzelne Wort in
> Fragmente, die keine der bedeutungstragenden Grenzen respektieren.

Zwei Dinge gehen gleichzeitig kaputt. Das Wort kostet viel mehr Teile, als es sollte –
und die Teile **durchschneiden die Bedeutungseinheiten**, sodass das Modell eine
Struktur wieder zusammensetzen muss, die der Tokenizer gerade zerstört hat.

Das Hinzufügen von mehr Cree-Text zur Trainingsmenge verbessert das erste Problem. Es hilft
beim zweiten nur bedingt, da der Algorithmus weiterhin auf Kompression optimiert,
und die Kompression nicht weiß, dass eine Grenze bedeutungsvoll ist.

---

## 5. Von der Tokenisierung zur falschen Antwort

Die Kette von „schlechter Segmentierung“ zu „falscher Ausgabe“ ist kurz.

1. Der Tokenizer bricht ein Wort an Grenzen um, die keine Bedeutung tragen.
2. Das Modell lernt schwächere Assoziationen, da dasselbe Konzept unter
   vielen verschiedenen Fragment-Schreibweisen anstelle eines konsistenten Teils auftritt.
3. Bei der Generierung setzt das Modell die Ausgabe Fragment für Fragment zusammen.
4. Fragmente, die einzeln plausibel sind, können sich zu einem Wort verbinden, das in der Sprache **nicht
   existiert**.

Dieser letzte Schritt ist der entscheidende. In einer Sprache, in der Wörter aus
Teilen aufgebaut sind, kann ein Modell etwas produzieren, das für jeden, der sie
nicht spricht, wohlgeformt aussieht – korrekt aussehende Teile, zusammengefügt zu einem Wort, das kein Sprecher
jemals sagen würde.

Standardmäßige automatische Bewertungen erkennen dies oft nicht, da diese Bewertungen meist
die Überschneidung mit einer Referenzantwort messen, und ein falsches Wort, das aus richtig aussehenden
Fragmenten besteht, sich dennoch überschneiden kann.

:::danger[Warum dies über Qualitätsbewertungen hinaus wichtig ist]
Eine Ausgabe, die flüssig und falsch ist, ist gefährlicher als eine, die offensichtlich
fehlerhaft ist. Ein Leser, der die Sprache nicht spricht, hat keine Möglichkeit, dies zu erkennen. Dies ist ein
wesentlicher Grund, warum Champollion auf der Validierung durch Personen besteht, die die
Sprache sprechen, sowie auf strukturellen Prüfungen, die fragen: „Ist dies ein echtes Wort?“ anstatt
nur: „Ähnelt dies der erwarteten Antwort?“
:::

---

## 6. Wer entscheidet, und warum das der eigentliche Punkt ist

Alles oben Genannte folgt aus einer einzigen Entscheidung: **welcher Text in die Menge eingeflossen ist, aus der
der Tokenizer gelernt hat.**

Wer auch immer diese Entscheidung trifft, entscheidet darüber, wie jede Sprache zerlegt wird, wie viel ihre
Nutzung kosten wird und wie hart das Modell arbeiten muss, um sie darzustellen. Diese
Entscheidung wird einmalig, frühzeitig und meist von einer kleinen Gruppe getroffen, und sie ist faktisch
für die gesamte Lebensdauer dieses Modells dauerhaft – der Tokenizer ist nichts, was man
im Nachhinein anpassen kann.

Darüber wird auch fast nie diskutiert. Debatten über Sprachtechnologie drehen sich meist
um Daten, Modellgröße und Qualitätsbewertungen. Der Schritt, der entscheidet, ob eine
Sprache überhaupt darstellbar ist, liegt unter all dem und wird als bloße
Infrastruktur behandelt.

Deshalb existiert diese Seite. Wenn eine Gemeinschaft echte Kontrolle darüber haben möchte, wie ihre
Sprache von Maschinen verarbeitet wird, reicht die Kontrolle über die Daten nicht aus. Die
Frage *"Wer hat entschieden, wie unsere Wörter in Teile zerlegt werden?"* hat eine Antwort, und
für die meisten Sprachen der Welt lautet diese Antwort derzeit: jemand anderes, als
Nebeneffekt der Kompression einer Textmenge, die die Sprache kaum oder gar nicht
enthielt.

---

## Nächste Schritte

- [Was Champollion ist](/docs/what-is-champollion) – das Projekt, zu dem diese Seite gehört, und was es gegen die oben genannten Probleme unternimmt.
- [Wie Modelle trainiert werden](/docs/network/context/mt-training-concepts) – das Vokabular für den Schritt *nach* der Tokenisierung, mit demselben Von-Null-an-Ansatz.
- [Ehrliche Einschränkungen](/docs/network/honest-limitations) – was dieses Projekt **nicht** beansprucht.
- [Datenverantwortung](/docs/network/sovereignty/data-sovereignty) – wer die Schlüssel zu einem Korpus hält und was das in der Praxis bedeutet.
