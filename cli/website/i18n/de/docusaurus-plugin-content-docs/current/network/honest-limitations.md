---
title: "Ehrliche Einschränkungen"
description: "Was Champollion (noch) nicht für sich beansprucht. Die überprüfbaren Grenzen unserer Bewertung, der Vertrauensstufen, der Community-Validierung und der zurückgehaltenen Infrastruktur."
---

# Ehrliche Einschränkungen

> Dies sind die Aussagen, die wir **nicht** übertreffen werden. Falls irgendetwas an anderer
> Stelle auf dieser Website mehr suggeriert, als hier geschrieben steht, betrachten Sie dies als
> Fehler und [teilen Sie es uns mit](/docs/network/perspectives/reporting-errors-and-owning-corrections).

Evaluierungsinfrastruktur verdient Vertrauen nur dadurch, dass sie ehrlich über ihre Grenzen ist.
Hier sind unsere, klar genug formuliert, um überprüft werden zu können.

## 1. Die tiefe morphologische Validierung deckt derzeit ein Sprachpaar ab

Die FST-basierte morphologische Validierung — die Überprüfung, ob jedes Ausgabewort ein
wohlgeformtes Wort in der Zielsprache ist — ist in der Praxis nur für **Englisch →
Plains Cree** eingerichtet. Der `GiellaLTFSTMetric` selbst ist **generisch**: Er bewertet jede
Sprache mit einem veröffentlichten GiellaLT-`.hfstol`-Analysator (Plains Cree, die
samischen Sprachen, Finnisch, norwegisches Bokmål, Inuktitut und andere), sodass die Fähigkeit
umfassend ist. Aber **Evaluierungskorpora existieren heute nur für Plains Cree**, sodass crk das
einzige Sprachpaar ist, das in der Praxis FST-bewertet wird. Jedes andere Sprachpaar auf der
Bestenliste wird mit Oberflächenmetriken (chrF++, BLEU) und Verhaltensprüfungen bewertet.
Diese sind nützliche Signale, aber sie garantieren **keine** morphologische Gültigkeit.
Wir beanspruchen keine morphologische Validierung für eine Sprache, die nicht sowohl über einen
FST als auch über ein Evaluierungskorpus verfügt.

## 2. Die Vertrauensstufen werden zum Start selbst gemeldet

Die meisten Bewertungen werden von Mitwirkenden berechnet, die das Harness selbst ausführen und
das Ergebnis veröffentlichen. Eine serverseitige **Verifizierung** — die erneute Bewertung einer
Einreichung anhand des SHA-fixierten kanonischen Korpus — existiert und wird ausgebaut, doch
„verifiziert“ ist noch nicht allgemeingültig. Lesen Sie das Vertrauensabzeichen in jeder Zeile:
**„selbst gemeldet“ bedeutet genau das** und ist der Standard.

## 3. Die Sprecher-Validierung durch die Community hat noch nicht stattgefunden

Unser Preis erfordert eine **Akzeptanz von ≥ 70 % durch zweisprachige Sprecher**. Diese Schwelle
ist festgelegt, und die Werkzeuge zu ihrer Durchführung befinden sich im Aufbau — aber **es wurde
noch keine Sprecher-Überprüfung durch die Community durchgeführt**, und **keine Bewertung auf
dieser Website hat die Sprecher-Schwelle überschritten**. Zusammengesetzte und chrF++-Werte sind
maschinelle Signale, kein Urteil der Community.

## 4. Die Evaluierungs-Sandbox existiert; ihre Verwahrungszeremonie noch nicht

Wir rufen Korpora von ihrer Quelle ab und fixieren sie per SHA-Hash, und zurückgehaltene Splits werden
versiegelt. Wenn eine Gemeinschaft ein geheimes Test-Set besitzt, kann eine Methode damit evaluiert
werden, ohne dass das Set jemals ihre Hände verlässt — und diese Evaluierung
verfügt nun über **zwei Wege**. Der
bevorzugte Weg für standardmäßige neuronale Modelle ist **deklarativ**: Der Teilnehmer
reicht ausschließlich Daten ein — safetensors-Gewichte + einen deklarativen Tokenizer + eine Config —
und der Organisator führt diese in seiner eigenen vertrauenswürdigen Inference-Engine aus
(`trust_remote_code=False`, offline; tolerant gegenüber der Architektur, da
die Sicherheit im codefreien Format und nicht im Namen der Architektur liegt). Es wird keinerlei Code der Teilnehmer
ausgeführt, daher muss auch nichts in eine Sandbox isoliert werden; die Sicherheitsprüfung ist eine entscheidbare Formatvalidierung
(handelt es sich um safetensors und nicht um ein Pickle? kein `trust_remote_code`?) und nicht
der Versuch zu beweisen, dass beliebiger Code sicher ist. Für Methoden, die tatsächlich aus Code bestehen
(Pipelines, LLM-gestützte Hybride), dient die netzwerkisolierte
**Sandbox** als Fallback (statische Prüfungen, `--network=none`-Container, Datenabfluss nur für Ergebnisse, ein
optionaler echter Airgap-Dateitransport). Die Sandbox kapselt nicht vertrauenswürdigen Code ein, anstatt
dessen Ausführung zu verweigern, weshalb sie ehrlicherweise der schwächere Weg ist — ihre tragende
Garantie ist `--network=none` (ein heuristischer statischer Scan kann ein binäres Modell nicht überprüfen),
und eine tiefergehende Härtung (seccomp, microVMs) ist vorerst zurückgestellt. Unter
[einen souveränen Wettbewerb durchführen](/docs/network/sovereignty/run-a-sovereign-contest)
finden Sie genaue Informationen darüber, was bereits live ist und was nicht. Was in beiden Fällen **nicht** implementiert ist: die
Seite der Schlüsselverwahrung durch die Gemeinschaft — Threshold-Signing, Schlüsselzeremonien und Node-Attestierung.
Die heutige Autorisierung ist ein protokollierter Prozess (einzelne Verwahrer,
einzelne Schlüssel, ehrlich gekennzeichnet), sodass die Goldstandard-**Preis**-Evaluierung geschlossen bleibt,
bis die Arbeit an der Verwahrung und die Zustimmung der Gemeinschaft nachgezogen haben.

## 5. Die Schlüsselverwahrung ist entschieden; die Community-Verwahrer werden bestätigt

Der Verwahrungs-*Mechanismus* ist entschieden: ein Schwellenwert-/Multisig-Verfahren, bei dem
**Champollion null Schlüsselanteile hält**. Die Verwahrer selbst werden von den Communitys
ausgewählt, und diese Gespräche laufen noch — daher sagen wir **„Community-Schlüsselverwahrer
(in Bestätigung)“**. Verwahrung ist keine Zustimmung: Der relationale Prozess der Community-Zustimmung ist ein eigener,
langsamerer und wichtigerer Weg.

---

Diese Grenzen werden sich mit der Arbeit verschieben. Wenn sich eine von ihnen ändert, ändert sich
diese Seite mit ihr — und die Änderung sollte im Seitenverlauf sichtbar sein, nicht stillschweigend
verschwinden.
