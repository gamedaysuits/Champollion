---
title: "Technische Grenzen"
description: "Was Champollion (noch) nicht für sich beansprucht, präzise dargelegt: die Grenzen morphologischer Validierung, selbstberichteter Vertrauensstufen, der Sprecher:innen-Validierung, der Verwahrung versiegelter Tests und warum keine Konfidenz pro Satz angegeben wird."
---

# Technische Grenzen

> **Neu hier?** [Was es noch nicht kann](/docs/what-it-cant-do-yet) erklärt
> dieselben Punkte in einfachen Worten. Diese Seite ist die präzise Fassung für
> Entwickler, Forschende und Agenten.

Dies sind die Zusicherungen, über die wir **nicht** hinausgehen werden. Falls an anderer Stelle auf dieser
Website mehr suggeriert wird, als hier steht, betrachten Sie dies als Fehler und
[teilen Sie es uns mit](/docs/network/perspectives/reporting-errors-and-owning-corrections).

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

## 2. Vertrauensstufen: Jeder Eintrag ist derzeit selbstberichtet {#2-trust-tiers-are-self-reported-at-launch}

Die meisten Punktzahlen werden von Mitwirkenden berechnet, die die Testumgebung selbst ausführen und
das Ergebnis veröffentlichen. Die **Verifizierung** — die erneute Bewertung einer Einreichung anhand ihrer eigenen
Ausgaben gegen den SHA-gepinnten kanonischen Korpus — ist implementiert, aber sie ist ein
Maintainer-Befehl, der manuell ausgeführt wird: Nichts führt sie bei der Einreichung automatisch aus und nichts
plant sie zeitlich ein, sodass heute jede Zeile als selbst evaluiert eingeht und bleibt
([Einreichungsregeln](/docs/network/leaderboard/rules#verification-tiers)). Beachten
Sie das Vertrauenssiegel in jeder Zeile: **„Selbstberichtet“ bedeutet genau das**, und es ist
der Standard.

## 3. Die Sprecher-Validierung durch die Community hat noch nicht stattgefunden

Der vorgeschlagene Preis erfordert eine **Akzeptanz von ≥ 70 % durch zweisprachige Sprechende** (derzeit ist kein Wettbewerb eröffnet). Diese Prüfstufe ist
spezifiziert, und die Werkzeuge zu ihrer Durchführung befinden sich im Aufbau — aber **es wurde noch keine
Überprüfung durch Community-Sprechende durchgeführt**, und **keine Punktzahl auf dieser Website hat die
Sprecherprüfung bestanden**. chrF++ und jeder andere automatische Wert sind maschinelle Signale,
kein Urteil der Community; deshalb trägt keine Punktzahl hier ein Qualitätssiegel.

## 4. Die Evaluierungs-Sandbox und die Schlüsselzeremonie existieren; kein Treuhänder hat sie bisher genutzt

Wir beziehen Korpora von ihrer Quelle und pinnen sie per SHA, und zurückgehaltene Splits sind
versiegelt. Wenn eine Community einen geheimen Testdatensatz verwahrt, kann eine Methode daran
evaluiert werden, ohne dass der Datensatz jemals ihre Hände verlässt — und diese Evaluierung
verfügt nun über **zwei Pfade**. Der
bevorzugte Pfad für standardmäßige neuronale Modelle ist **deklarativ**: Die teilnehmende Partei
reicht ausschließlich Daten ein — safetensors-Gewichte + einen deklarativen Tokenizer + eine Konfiguration —
und der Veranstalter führt dies in seiner eigenen vertrauenswürdigen Inferenz-Engine aus
(`trust_remote_code=False`, offline; tolerant hinsichtlich der Architektur, da
die Sicherheit im codefreien Format liegt und nicht im Architekturnamen). Es wird keinerlei Teilnehmer-Code
ausgeführt, sodass nichts in eine Sandbox isoliert werden muss; die Sicherheitsprüfung ist eine entscheidbare
Formatvalidierung (handelt es sich um safetensors und nicht um ein Pickle? Kein `trust_remote_code`?), kein
Versuch zu beweisen, dass beliebiger Code sicher ist. Für Methoden, die tatsächlich aus Code bestehen
(Pipelines, LLM-gestützte Hybride), ist der Fallback die netzwerkisolierte
**Sandbox** (statische Prüfungen, `--network=none`-Container, ausgehender Datenverkehr nur für Punktzahlen, ein
optionaler echter Air-Gap-Dateitransport). Da die Sandbox über kein Netzwerk verfügt, läuft eine
Methode dort nur, wenn jedes von ihr aufgerufene Modell in ihrem Bundle enthalten ist: Ein
LLM-gestützter Hybrid muss sein LLM als offene Gewichte bereitstellen, da eine gehostete LLM-API
nicht erreichbar ist. Die Sandbox kapselt nicht vertrauenswürdigen Code ein, anstatt
seine Ausführung zu verweigern; sie ist daher der ehrlich gesagt schwächere Pfad — ihre tragende
Garantie ist `--network=none` (ein heuristischer statischer Scan kann ein binäres
Modell nicht prüfen), und eine weitergehende Härtung (seccomp, MicroVMs) ist aufgeschoben. Siehe
[Einen souveränen Wettbewerb durchführen](/docs/network/sovereignty/run-a-sovereign-contest)
für Details darüber, was bereits produktiv ist und was nicht. Die **Schlüsselzeremonie** des Offline-Knotens ist
**implementiert** — der Datensatz-Schlüssel wird M-von-N geteilt und nur während eines durch ein
Quorum autorisierten Laufs im Arbeitsspeicher wieder zusammengesetzt —, aber sie wurde noch nie mit einer echten Verwahrperson eingesetzt, und
die Anteile sind in dieser ersten Version einfache Dateien. Was **nicht** implementiert ist:
Schwellenwert-Signaturen (eine Punktzahl wird von einem einzelnen Knotenschlüssel signiert) und Hardware-Attestierung (Punktzahl-Manifeste
werden ausschließlich in Software signiert). Es wurden noch keine Community-Schlüsselverwahrpersonen ernannt,
daher bleibt die Evaluierung für den Goldstandard-**Preis** geschlossen, bis
Verwahrpersonen und die Einwilligung der Community vorliegen.

## 5. Schlüssel liegen heute beim Veranstalter; es sind keine Community-Verwahrpersonen ernannt {#5-key-custody-is-designed-no-custodians-are-appointed-yet}

**Heute werden die Schlüssel eines versiegelten Datensatzes von dessen Veranstalter verwahrt** — von der Person oder Organisation, die ihn versiegelt hat,
auf dem jeweils eigenen Rechner. **Champollion hält keine Schlüsselanteile.** Der Verwahrungs-*Mechanismus*
für mehr als einen Halter ist implementiert: Die M-von-N-Schlüsselzeremonie des Offline-Knotens
teilt einen Datensatz-Schlüssel unter Verwahrpersonen auf. Sie wurde noch nicht mit echten
Verwahrpersonen durchgeführt. Verwahrpersonen werden von den Communities selbst bestimmt, und bisher
wurde keine ernannt: **Community-Schlüsselverwahrpersonen — bisher keine ernannt.** Verwahrung
ist keine Zustimmung: Der relationale Prozess zur Einwilligung der Community ist ein eigener,
langsamerer und wichtigerer Pfad.

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
