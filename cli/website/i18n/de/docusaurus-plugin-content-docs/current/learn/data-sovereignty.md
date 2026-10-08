---
title: "Was Datensouveränität bedeutet, wenn man sie in Software implementiert"
sidebar_label: "Datensouveränität"
description: "Indigene Datensouveränität umfasst eine Reihe von Prinzipien darüber, wer Daten besitzt, kontrolliert, auf sie zugreift und über sie verfügt. So sehen diese Prinzipien aus, wenn jemand versucht, sie in funktionierende Software zu implementieren – und was dieser Versuch nicht für sich beanspruchen kann."
---

# Was Datensouveränität bedeutet, wenn man sie in Software implementiert

:::info[Für wen dies gedacht ist]
Für alle. Es werden keine Vorkenntnisse in Recht, maschinellem Lernen oder indigener Selbstverwaltung
vorausgesetzt. Wenn Sie sich jemals gefragt haben, was tatsächlich nötig wäre, damit eine Gemeinschaft
die Kontrolle über ihre eigenen Sprachdaten behält, sobald Computer ins Spiel kommen, ist diese Seite
die ausführliche Antwort.
:::

Die meisten Diskussionen über Daten und Zustimmung enden bei der Erlaubnis: Hat jemand Ja gesagt?
Datensouveränität stellt eine Reihe schwierigerer Fragen. Wem **gehört** das? Wer entscheidet,
was damit passiert? Wer hat Zugriff darauf? Wo befindet es sich physisch?

Diese Fragen sind nicht aus dem Nichts entstanden. Sie wurden zuerst und am
nachdrücklichsten von indigenen Völkern formuliert.

---

## 1. Die Fragen – und wer sie zuerst stellte

First Nations in Kanada formulierten Prinzipien der Datensouveränität bezüglich
**Eigentum, Kontrolle, Zugang und Besitz** als Geltendmachung von Jurisdiktion
über ihre eigenen Informationen – hervorgegangen aus einer dokumentierten Geschichte von Forschung,
die *an* Gemeinschaften statt *mit* ihnen betrieben wurde, und daraus, dass die resultierenden Daten
nie zurückkehrten.

Dieser Ursprung ist keine Nebensächlichkeit. Es handelt sich hierbei nicht um eine allgemeine Ethik-Checkliste,
die beliebig übernommen werden kann; es sind Geltendmachungen von Jurisdiktion, formuliert von bestimmten
Völkern in spezifischen rechtlichen und kulturellen Kontexten, und sie gehören den
Gemeinschaften, die sie geschaffen haben.

Die vier Fragen in Kürze:

| | Die Frage, die es beantwortet |
|---|---|
| **Ownership** | Wem gehören diese Informationen? Eine Gemeinschaft besitzt ihr kulturelles Wissen und ihre Daten kollektiv — so wie eine Person ihre eigenen persönlichen Informationen besitzt. |
| **Control** | Wer entscheidet, was damit passiert? Gemeinschaften kontrollieren jede Phase von allem, was sie betrifft: was gesammelt wird, wie, von wem, wofür und was danach damit gemacht wird. |
| **Access** | Wer hat Zugriff darauf? Gemeinschaften müssen auf Informationen über sich selbst zugreifen können, wo immer sie aufbewahrt werden und wer auch immer sie besitzt. |
| **Possession** | Wo befindet es sich physisch? Nicht dasselbe wie Eigentum — Besitz ist die konkrete Tatsache der Verwahrung, und er ist der Mechanismus, der die anderen drei Prinzipien durchsetzbar macht, anstatt sie nur zu versprechen. |

Es existieren unterschiedliche Frameworks, die nicht austauschbar sind:
unter anderem **CARE** (Collective Benefit, Authority to Control, Responsibility, Ethics)
für indigene Data Governance im Allgemeinen und **Te Mana Raraunga** für die
Datensouveränität der Māori. Jedes davon entstand in seinem eigenen rechtlichen und kulturellen
Umfeld. Den Namen eines Frameworks für die Prinzipien eines anderen zu verwenden, ist eine eigene Form
der Auslöschung.

---

## 2. Warum Software dies zuspitzt

Ein Prinzip kann auf dem Papier als gute Absicht überleben. Software erzwingt die
Frage, denn ein Computer handelt nicht nach Absichten — er handelt nach dem, was
entwickelt wurde.

Betrachten Sie die übliche Art und Weise, wie ein Übersetzungssystem evaluiert wird. Um herauszufinden,
ob ein System Ihre Sprache gut übersetzt, benötigt jemand ein **Testset**:
Sätze in Ihrer Sprache, gepaart mit ihrer Bedeutung. Fast jede Evaluierungsplattform
fordert Sie auf, dieses Testset **hochzuladen**, damit es bewertet werden kann.

Lesen Sie das noch einmal mit den vier Fragen im Hinterkopf. Das Hochladen überträgt den
Besitz. Es überträgt in der Regel auch die praktische Kontrolle — sobald eine Kopie auf
dem Rechner einer anderen Person existiert, ist Ihre Möglichkeit, „Stopp“ zu sagen, eine Bitte und keine
Fähigkeit mehr. Zugang wird zu etwas, das Ihnen gewährt wird, anstatt etwas zu sein, das Sie
haben. Eigentum überlebt auf dem Papier und verliert weitgehend an Bedeutung.

Für eine Gemeinschaft, deren Sprachdaten bereits in der Vergangenheit extrahiert wurden, ist „Laden Sie es hoch und vertrauen
Sie uns“ keine neutrale Bitte. Es hat dieselbe Form wie das, was bereits
geschehen ist.

---

## 3. Was die Mechanismen tatsächlich sind

Der Standpunkt dieses Projekts ist, dass Souveränität, wenn sie real sein soll, eine Eigenschaft
der Software sein muss und nicht nur ein Absatz in einer Richtlinie. Hier sehen Sie, wie das konkret
aussieht. Diese Mechanismen werden beschrieben, damit Sie sie evaluieren und kritisch hinterfragen können.

**Registrierung ohne Preisgabe.** Ein Testset wird registriert, indem beschrieben wird,
*wo es sich befindet*, und ein kryptografischer Hash seines genauen Inhalts angeheftet wird — nicht durch
das Hochladen der Sätze. Zum Zeitpunkt der Evaluierung ruft das System die Daten von der Quelle ab,
prüft, ob der Hash übereinstimmt, und führt die Bewertung durch. Nichts wird gespeichert. Wenn der Inhaber die
Quelle offline nimmt, kann der Korpus schlichtweg nicht mehr evaluiert werden. Die Kontrolle bleibt dort, wo sie
begonnen hat, da der Besitz nie übertragen wurde.

**Verschlüsselung vor dem Versenden für die restriktivste Stufe.** Wenn ein Korpus
nutzbar sein muss, ohne jemals lesbar zu sein, wird er **auf dem eigenen Gerät des
Inhabers** verschlüsselt, und der Geheimtext verbleibt beim Inhaber. Was dieses Projekt erhält,
ist eine Beschreibung, die keinerlei Inhalte enthält.

**Keine einzelne Partei kann entschlüsseln.** Der Schlüssel ist so konzipiert, dass er auf eine Gruppe
von Verwahrern aufgeteilt wird, sodass eine bestimmte Anzahl von ihnen – beispielsweise drei von fünf –
gemeinsam handeln muss, um eine Aktion zu autorisieren. Kein einzelner Verwahrer kann allein handeln,
und dieses Projekt ebenso wenig: Das Konzept sieht **null Anteile für Champollion** vor, sodass es
weder mit noch ohne die Kooperation Dritter entschlüsseln könnte. Ein Ausführungslauf fände statt,
weil ein Quorum von Verwahrern dies beschlossen hat.

> **Der tatsächliche aktuelle Stand.** Der Mechanismus ist gebaut und testbar, wurde jedoch
> noch nicht mit realen Verwahrern betrieben. *Es wurden keine Verwahrer
> ernannt* – die Zusammensetzung obliegt den beteiligten Gemeinschaften, und bisher hat keine Gruppe
> eingewilligt, Anteile zu halten. Bis dies geschieht,
> gibt es keine aktive Verwahrergruppe, und dieses Projekt wird öffentlich keine Kandidaten
> benennen. Betrachten Sie den vorstehenden Absatz daher als einen funktionierenden Mechanismus, der auf die
> Beziehungen wartet, die ihn in Betrieb setzen würden, und nicht als etwas, das heute bereits produktiv läuft.

**Ergebnisse ohne Offenlegung.** Was von einer versiegelten Evaluierung zurückkommt, sind
Bewertungen, keine Sätze. Es kann bewiesen werden, dass eine Methode auf einem Korpus funktioniert, den
der Autor der Methode und dieses Projekt nie gelesen haben.

**Zustimmung vor der Übermittlung.** Das Senden von Text an eine externe Modell-API ist an sich schon
eine Offenlegung. Korpora unter Gemeinschafts-, maßgeschneiderten oder ungenannten Lizenzen **verweigern**
die Remote-Evaluierung, bis der Rechteinhaber explizit die Erlaubnis dafür hinterlegt hat.
Diese Verweigerung wird im Code erzwungen, und kein automatisierter Prozess kann die
Erlaubnis im Namen einer Gemeinschaft erteilen.

**Umkehrbarkeit nur in eine Richtung.** Die Offenlegung kann durch eine
bewusste Entscheidung des Inhabers gelockert werden. Sie wird niemals standardmäßig, durch Zufall oder
aus Bequemlichkeit einer anderen Person gelockert.

---

## 4. Was dies nicht ist

**Dieses Projekt ist nach keinem indigenen Datensouveränitäts-Framework validiert,
zertifiziert oder genehmigt. Es hat keine Begutachtung stattgefunden, keine steht aus,
und keine wird impliziert.**

Was existiert, ist ein **Versuch, Datensouveränität in Code umzusetzen** – von indigenen
Völkern formulierte Prinzipien aufzugreifen und sie als funktionierende Mechanismen
statt als bloße Absichtserklärungen auszudrücken. Dieser Versuch liegt in unserer Verantwortung. Ob er gelingt,
obliegt nicht unserem Urteil. Die Feststellung von Konformität gebührt den beteiligten
Gemeinschaften, und ein Projekt, das seine eigene Konformität behauptet, würde im
Kleinen genau die Haltung reproduzieren, zu deren Korrektur diese Prinzipien existieren: die außenstehende Partei,
die darüber entscheidet, was als angemessener Umgang mit den Informationen einer Gemeinschaft gilt.

Nichts davon ist eine Garantie für Unmöglichkeit. Software hat Fehler. Betreiber
machen Fehler. Eine entschlossene Partei, die genügend der richtigen Rollen innehat, ist ein
Restrisiko, das keine Architektur beseitigt. Der Anspruch ist enger gefasst und, wie wir glauben,
nützlicher: **Die einfachen Wege sind verschlossen, und die schwierigen hinterlassen Spuren.**

Es gibt auch Lücken zwischen den Prinzipien und den Mechanismen, und wir möchten
diese lieber benennen, als Sie sie finden zu lassen. Besitz ist das Prinzip, dem diese
Mechanismen am besten dienen — der Code ist wirklich gut darin, Dinge nicht zu behalten.
Eigentum und Kontrolle reichen weiter, als Software allein gehen kann, hinein in Bedingungen,
Governance und Beziehungen, die durch noch so viel Kryptografie nicht geklärt werden können. Und jeder
der oben genannten Mechanismen setzt eine Gemeinschaft voraus, die bereits über die Kapazität und
Infrastruktur verfügt, um ihre eigenen Daten zu halten, was keine neutrale Annahme ist.

---

## 5. Bitte setzen Sie sich kritisch damit auseinander

Dieser Versuch ist offen für Kritik, und diese Einladung ist keine bloße Dekoration.

Wenn Sie im Bereich der indigenen Data Governance, an CARE, Te Mana Raraunga oder
an Technologien für indigene Sprachen arbeiten – oder wenn Sie Mitglied oder Vertretung einer
Gemeinschaft sind, deren Sprache in diesem Index verzeichnet ist –, möchten wir erfahren, an welchen Stellen dies fehlerhaft ist.
Konkret:

- wo ein Mechanismus nicht das leistet, was das Prinzip erfordert;
- wo die Darstellung die Prinzipien einer Gemeinschaft verzerrt oder deren Autorität vereinnahmt;
- wo etwas als schützend beschrieben wird, das Sie nicht schützen würde;
- wo eine Gemeinschaft etwas benötigen würde, das wir nicht entwickelt haben;
- wo bereits die Begrifflichkeiten unpassend sind.

Einwände und Korrekturen können über den
[Kontakt- und Takedown-Weg](/docs/network/community/contact-objections-takedown)
vorgebracht werden, der auch die Beantragung der Entfernung von allem abdeckt, was eine von Ihnen
vertretene Sprache betrifft. Es gibt keine Verpflichtung, dabei diplomatisch zu sein.

Dass diese Arbeit noch nicht überprüft wurde, ist eine Tatsache und keine Verteidigung derselben. Ein Versuch, der
zur Überprüfung einlädt, ist ehrlich; einer, der dies nicht tut, ist eine bloße Behauptung.

> Diese Seite beschreibt einen Versuch, auf Prinzipien hinzuarbeiten, deren Urheber die Gemeinschaften selbst sind – informieren Sie sich über diese Prinzipien direkt aus den Quellen ihrer Urheber; dieser Versuch wird von keiner der Organisationen unterstützt oder autorisiert, die diese Prinzipien verwalten.

---

## Nächste Schritte

- [Datenverantwortung](/docs/network/sovereignty/data-sovereignty) — die operative Position im Detail.
- [Korpora registrieren](/docs/network/sovereignty/registering-corpora) — die vier Offenlegungsstufen und was bei jeder Stufe Ihren Rechner verlässt.
- [Einen souveränen Wettbewerb durchführen](/docs/network/sovereignty/run-a-sovereign-contest) — die Verwahrer-Zeremonie von Anfang bis Ende.
- [Ehrliche Einschränkungen](/docs/network/honest-limitations) — was dieses Projekt nicht beansprucht.
- [Für Sprachgemeinschaften](/docs/network/community/for-language-communities) — der praktische Ausgangspunkt.
