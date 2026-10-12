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

## 1. Tiefe morphologische Validierung erfordert einen FST *und* ein bewertungsfähiges Testset

FST-basierte morphologische Validierung – die Überprüfung, dass jedes Ausgabewort ein
wohlgeformtes Wort in der Zielsprache ist – erfordert zwei Dinge für ein
Sprachpaar: einen FST, den die Testumgebung gepinnt hat, und ein Evaluierungsset
für das Paar, das ein Ranking ermöglicht. Das `GiellaLTFSTMetric` selbst ist **generisch**:
Es bewertet jede Sprache mit einem gepinnten GiellaLT-FST (Plains Cree, die samischen
Sprachen, Finnisch, Norwegisches Bokmål, Inuktitut und weitere). Mehrere dieser
Sprachen verfügen über offene Evaluierungssets (Tatoeba, WMT, WMT24++) – die
[Datensatz-Seite](/docs/network/leaderboard/datasets) führt den Katalog auf,
`mt-eval corpora --source eng --target <code>` listet auf, was für ein Paar ausgeführt werden kann,
und `mt-eval corpora --with-fst` listet nur die Paare auf, deren Zielsprache über einen
gepinnten FST verfügt, samt der Information, ob dieser auf Ihrem Rechner installiert ist.
Plains Cree, die Sprache, mit der die FST-Arbeit begann, bildet die Ausnahme: Seine
zwei Evaluierungssets (EdTeKLA) sind als unter Quarantäne stehende Labels katalogisiert,
und die Datenbank weist jeden Score zurück, der für sie eingereicht wird.

Es gelten zwei weitere Einschränkungen. Wenn der gepinnte FST lediglich ein
**Akzeptor** zur Rechtschreibprüfung ist (Nordsamisch, Amharisch, Baskisch), gibt er
zwar an, ob ein Wort existiert, nicht jedoch, ob es korrekt flektiert ist, sodass
`morphological_accuracy` nicht berechnet wird – und ein Akzeptor akzeptiert einige englische
und großgeschriebene Wörter, sodass die FST-Akzeptanz unübersetzte Ausgaben positiv
werten kann (die Run-Card zeigt dann einen Vorbehalt bezüglich Quellkopien an;
siehe [Score-Vorbehalte](/docs/network/specifications/scoring#2-8-score-caveats)).
Die FST-Akzeptanz ist eine Diagnose: Sie fließt nie in den chrF++-Hauptwert ein und stuft einen Durchlauf nie ein.
Sie honoriert auch einen einzelnen gültigen Satz, der für jede Eingabe wiederholt wird;
die Run-Card zeigt dann einen Vorbehalt wegen nahezu konstanter Ausgabe an.
Und jedes Paar ohne FST wird mit Oberflächenmetriken (chrF++, BLEU) und Verhaltensprüfungen
bewertet. Dies sind nützliche Signale, sie garantieren jedoch **keine** morphologische
Validität. Wir beanspruchen für keine Sprache eine morphologische Validierung, für die
nicht sowohl ein FST als auch ein bewertungsfähiges Evaluierungsset vorliegen.

## 2. Die Vertrauensstufen werden zum Start selbst gemeldet

Die meisten Bewertungen werden von Mitwirkenden berechnet, die das Harness selbst ausführen und
das Ergebnis veröffentlichen. Eine serverseitige **Verifizierung** — die erneute Bewertung einer
Einreichung anhand des SHA-fixierten kanonischen Korpus — existiert und wird ausgebaut, doch
„verifiziert“ ist noch nicht allgemeingültig. Lesen Sie das Vertrauensabzeichen in jeder Zeile:
**„selbst gemeldet“ bedeutet genau das** und ist der Standard.

## 3. Die Sprecher-Validierung durch die Community hat noch nicht stattgefunden

Unser Preis erfordert eine **Akzeptanz von ≥ 70 % durch zweisprachige Sprecherinnen und Sprecher**.
Dieses Gate ist spezifiziert, und die Werkzeuge zu seiner Durchführung befinden sich im Aufbau –
doch **es wurde noch keine Überprüfung durch Sprecher aus der Sprachgemeinschaft durchgeführt**,
und **kein Score auf dieser Website hat das Sprecher-Gate passiert**. chrF++ und jede
andere automatische Kennzahl sind maschinelle Signale, kein Urteil der Gemeinschaft,
weshalb kein Score hier ein Qualitätssiegel trägt.

## 4. Die Evaluierungs-Sandbox und die Schlüsselzeremonie existieren; kein Treuhänder hat sie bisher genutzt

Wir rufen Korpora von ihrer Quelle ab und versehen sie mit einem SHA-Pin, und zurückbehaltene
Splits sind versiegelt. Wenn eine Gemeinschaft ein geheimes Testset besitzt, kann eine
Methode daran bewertet werden, ohne dass das Set jemals ihre Hände verlässt – und diese
Evaluierung hat nun **zwei Pfade**. Der bevorzugte Pfad für standardmäßige neuronale
Modelle ist **deklarativ**: Der Teilnehmer reicht ausschließlich Daten ein –
safetensors-Gewichte + einen deklarativen Tokenizer + eine Konfiguration – und der
Veranstalter führt dies in seiner eigenen vertrauenswürdigen Inferenz-Engine aus
(`trust_remote_code=False`, offline; tolerant gegenüber der Architektur, da die Sicherheit im
codefreien Format liegt und nicht im Architekturnamen). Es wird keinerlei Teilnehmer-Code
ausgeführt, sodass nichts in eine Sandbox gelegt werden muss; die Sicherheitsprüfung
ist eine entscheidbare Formatvalidierung (handelt es sich um safetensors und nicht um ein
Pickle? kein `trust_remote_code`?), kein Versuch zu beweisen, dass beliebiger Code sicher ist.
Für Methoden, die tatsächlich aus Code bestehen (Pipelines, LLM-gestützte Hybride), ist
der Ausweichpfad die netzwerkisolierte **Sandbox** (statische Prüfungen,
`--network=none`-Container, ausschließlicher Egress für Scores, ein optionaler
Dateitransport über eine echte physische Netztrennung). Da die Sandbox kein Netzwerk
hat, wird eine Methode dort nur mit allen Modellen ausgeführt, die sie innerhalb ihres
Bundles aufruft: Ein LLM-gestützter Hybrid muss sein LLM als offene Gewichte mitliefern,
da eine gehostete LLM-API nicht erreichbar ist. Die Sandbox isoliert nicht
vertrauenswürdigen Code, anstatt dessen Ausführung zu verweigern, weshalb sie der
ehrlich schwächere Pfad ist – ihre tragende Garantie ist `--network=none` (ein heuristischer
statischer Scan kann kein binäres Modell überprüfen), und eine tiefere Härtung (seccomp,
MicroVMs) ist aufgeschoben. Siehe
[Einen souveränen Wettbewerb durchführen](/docs/network/sovereignty/run-a-sovereign-contest)
für genaue Angaben darüber, was bereits live ist und was nicht. Die **Schlüsselzeremonie
des Offline-Knotens ist implementiert** – der Testset-Schlüssel wird M-aus-N aufgeteilt
und nur während eines durch ein Quorum autorisierten Durchlaufs im Arbeitsspeicher
wieder zusammengesetzt –, sie wurde jedoch noch nie mit einem echten Treuhänder
durchgeführt, und die Anteile liegen in dieser ersten Version als Klartextdateien vor.
Was **nicht** implementiert ist: Schwellenwert-Signaturen (ein Score wird von einem
einzelnen Knotenschlüssel signiert) und Hardware-Attestierung (Score-Manifeste werden
nur per Software signiert). Es wurde noch kein Treuhänder ernannt, sodass die
Gold-Standard-**Preis**-Evaluierung geschlossen bleibt, bis Treuhänder und die
Einwilligung der Gemeinschaft vorhanden sind.

## 5. Die Schlüsselverwahrung ist konzipiert; es sind noch keine Treuhänder benannt

Der Verwahrungs-*Mechanismus* ist konzipiert: ein Schwellenwert-Schema, bei dem
**Champollion so ausgelegt ist, dass es null Schlüsselanteile hält**. Es wurde noch nicht
mit echten Treuhändern durchgeführt. Treuhänder werden von den Gemeinschaften selbst
gewählt, und es wurde noch keiner ernannt, weshalb wir sagen: **„Community-Schlüssel-Treuhänder –
noch keine ernannt.“**
Verwahrung ist keine Einwilligung: Der relationale Prozess der gemeinschaftlichen
Einwilligung ist ein eigener, langsamerer und wichtigerer Strang.

## 6. Wir messen Methoden anhand von Benchmarks; wir bewerten keine einzelnen Übersetzungen {#system-vs-output}

Zwei verschiedene Dinge werden als „vertrauenswürdige maschinelle Übersetzung“ bezeichnet.
Wir machen eines davon.

**Systemebene – was wir tun.** Gegeben seien ein Sprachpaar, ein Testset und eine Methode:
Wie schneidet diese Methode ab, unter welcher Metrik, in welcher Domäne, in welchem
Kontaminationspfad, auf welcher Vertrauensstufe? Das ist eine Aussage über eine *Methode auf
einem Benchmark*, ergänzt durch eine Aussage darüber, wer die Messlatte gelegt hat. Die
Bewertungsregeln sind veröffentlicht, die Korpora sind gepinnt, und bei einem souveränen
Benchmark entscheidet die Gemeinschaft, die Eigentümerin des Testsets ist, was besteht.
Die Bestenliste, die Karte, die Run-Cards und `mt-eval` sind genau dies und nichts anderes.

**Ausgabenebene – was wir nicht tun.** Gegeben seien ein Quellsatz und eine Übersetzung davon:
Wie wahrscheinlich ist es, dass *diese* Übersetzung korrekt ist? In der maschinellen
Übersetzung und im NLP nennt man das Qualitätsschätzung und Quantifizierung von Unsicherheit,
und dies ist ein eigenes Forschungsfeld. Wir veröffentlichen **keinerlei segmentspezifische
Konfidenz für irgendeine Übersetzung**, und nichts hier ist eine kalibrierte Wahrscheinlichkeit
dafür, dass eine bestimmte Ausgabe korrekt ist. Eine Zeile mit hohem Score ist keine Garantie
für den nächsten Satz, den eine Methode generiert.

Der Umkehrschluss ist der leichtere Fehler, und er bindet auch uns. Wenn eine Oberfläche
hier besagt, dass keine Methode für ein Paar gut genug abschneidet, um eingesetzt zu werden –
wie dies bei [Menschliche Übersetzungsdienste](/human-services) der Fall ist –, dann ist
das eine Aussage über gemessene Methoden auf gemessenen Testsets. Es ist ein triftiger
Grund, für dieses Paar keine maschinellen Ausgaben auszuliefern. Es ist kein Urteil über
einen einzelnen bestimmten Satz.

**Qualitätsschätzung ist ein offener Steckplatz, keine versteckte Lücke.** Die Testumgebung
berechnet bereits einen referenzfreien neuronalen Score, AfriCOMET-QE (`qe_score`), als
Adäquatheitssignal für Durchläufe ohne Gold-Referenz. Er wird als Zahl auf **Korpusebene**
im separaten neuronalen Pfad ausgewiesen, wird vom Verifizierer neu abgeleitet und fließt
niemals in die chrF++-Hauptmetrik ein
([Bewertungsspezifikation](/docs/network/specifications/scoring#how-runs-are-scored)).
Metriken sind Plugins ([Plugin-Spezifikation](/docs/reference/plugin-spec)), sodass eine
QE-Metrik auf Segmentebene etwas ist, das diese Testumgebung aufnehmen kann. Bis eine
solche angebunden, veröffentlicht und pro Sprache so meta-evaluiert ist wie die
referenzbasierten Metriken ([Metrik-Zuverlässigkeit](/docs/network/specifications/metric-reliability)),
treffen wir keinerlei Aussagen über einzelne Ausgaben.

---

Diese Grenzen werden sich mit der Arbeit verschieben. Wenn sich eine von ihnen ändert, ändert sich
diese Seite mit ihr — und die Änderung sollte im Seitenverlauf sichtbar sein, nicht stillschweigend
verschwinden.
