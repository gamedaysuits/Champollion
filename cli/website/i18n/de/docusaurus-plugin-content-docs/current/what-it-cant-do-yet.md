---
title: "Was es noch nicht kann"
slug: /what-it-cant-do-yet
description: "Der ehrliche Teil, in einfachen Worten: Ihr erster Übersetzer wird klein sein, ein funktionierender braucht viele Sätze, und kein Werkzeug kann Qualität versprechen – nur, dass Sie wissen, woran Sie sind."
---

# Was es noch nicht kann

Ihr erstes Übersetzungsprogramm wird wahrscheinlich ein **Phrasenbuch** sein. Es wird gut mit Sätzen zurechtkommen, die denen ähneln, aus denen es gelernt hat, und unsicher bei allem Neuen sein. Das ist normal: Jedes Projekt fängt so an.

Was es voranbringt, sind mehr Sätze – die richtigen Arten von Sätzen, geprüft von jemandem, der die Sprache spricht. In jeder Runde sagen Ihnen die Werkzeuge, ob es wirklich besser geworden ist, und schlagen vor, was als Nächstes am meisten helfen würde. Diese Seite erklärt Ihnen offen, was Sie auf diesem Weg erwarten können.

## Ein funktionierendes Übersetzungsprogramm braucht viele Sätze

Wie viele? Für eine echte Sprache wissen wir es noch nicht. Hier ist das, was wir wissen.

Wir haben eine Übungssprache erfunden, damit ein Computer jede Antwort überprüfen konnte: etwa 2.000 Wörter, vollkommen regelmäßige Grammatik, saubere Daten. Ein auf einem Laptop trainiertes Übersetzungsprogramm übersetzte dann neue Alltagssätze, die es noch nie zuvor gesehen hatte, und ein Computer überprüfte, ob jeder einzelne genau das bedeutete, was das englische Original bedeutete:

- nach 6.400 Beispielsätzen waren **etwa 79 von 100** genau richtig;
- nach 25.600 **etwa 96 von 100**.

Jeder Satz mit einem Wort, das es noch nie gesehen hatte, war fehlerhaft – etwa ein Drittel seiner Fehlversuche bei 6.400 Beispielen; der Rest betraf Grammatik, die es noch nicht gelernt hatte. Das ist das Erste, was man wissen muss: **Ein Übersetzungsprogramm kann kein Wort übersetzen, das es nie gelernt hat.** Daher weisen die Werkzeuge darauf hin: Wenn ein Satz ein Wort enthält, das Ihr Übersetzungsprogramm in seinen Lektionen nie gesehen hat, geben sie an, welches Wort – diese Zeile ist sehr wahrscheinlich falsch, egal wie flüssig sie sich liest.

Eine echte Sprache ist viel reichhaltiger als unsere Übungssprache: weit mehr alltägliche Wörter, Wörter mit mehreren Bedeutungen, Grammatik, die Dinge kennzeichnet, die das Englische ungesagt lässt. Diese Zahlen sind daher eine Untergrenze, keine Schätzung. Eine echte Sprache wird mehr Sätze brauchen, und wir wissen noch nicht, wie viele mehr. Wir messen es gerade.

Was das in Zeit bedeutet: Wir haben die Zeit einer echten sprechenden Person noch nicht gemessen. Wenn das Schreiben oder Prüfen eines Satzes etwa eine Minute dauern würde, wären 6.400 Sätze etwa einhundert Stunden. Aufgeteilt auf eine Familie und eine Schulklasse summiert sich jede Woche eine Stunde oder zwei – und ein kleines Übersetzungsprogramm hilft schon lange vorher bei Ihren meistverwendeten Wendungen. [Wie viele Sätze braucht man?](/docs/how-many-sentences) geht näher darauf ein.

## Es kann kein gutes Übersetzungsprogramm versprechen – nur, dass Sie Bescheid wissen

Ein Wert misst, wie nahe das Übersetzungsprogramm dem kommt, wie eine sprechende Person einen Satz formuliert hat. Eine gute Übersetzung, die anders formuliert ist, kann eine niedrige Punktzahl erhalten, und eine flüssige, falsche Übersetzung kann recht gut abschneiden. Deshalb ist eine sprechende Person, die die Entwürfe prüft, wichtiger als jede Zahl.

Ein Wert gilt zudem nur für Sätze, die denen ähneln, an denen er gemessen wurde, und bei nur wenigen Sätzen ist er ungenau – die Werkzeuge zeigen Ihnen eine Spanne, keine einzelne Zahl. Er kann Ihnen nicht sagen, ob der *nächste* Satz, den das Übersetzungsprogramm schreibt, richtig sein wird. Eine fließend sprechende Person entscheidet, was verwendbar ist.

## Niemand hat eine echte Sprache bisher den ganzen Weg geführt

Wir sind jeden Schritt auf diesen Schienen viele Male gegangen, mit erfundenen Sprachen und mit vielen verschiedenen KI-Assistenten, von einem leeren Ordner bis hin zu einem Übersetzungsprogramm, das Sie in Ihrem Browser ausprobieren können. In unseren letzten Übungsläufen – KI-Assistenten, die einer erdachten Familie halfen – ging bei mehr als der Hälfte an irgendeinem Schritt etwas schief. Wir haben diese Schritte behoben und testen erneut.

Noch keine Gemeinschaft hat eine echte Sprache auf diesen Schienen bis zu einem funktionierenden Übersetzungsprogramm geführt. Wenn Sie jetzt anfangen, gehören Sie zu den Ersten.

## Einige Teile sind noch nicht bereit

- **Die Schritt-für-Schritt-Werkzeuge kommen mit der nächsten Version.** Bis dahin beschreiben diese Seiten, wie sie funktionieren werden. [Bevor Sie beginnen](/docs/before-you-begin) zeigt, was Sie heute schon tun können.
- **Andere Personen Übersetzungsprogramme an Ihren Sätzen testen zu lassen** – ohne dass sie diese jemals zu Gesicht bekommen – funktioniert, ist aber noch nicht auf den Schienenweg gebracht. Heute bedeutet das, einer längeren Anleitung zu folgen.
- **Ihr Computer spielt eine Rolle.** Ein neuerer Mac (M1 oder neuer) mit 16 GB Arbeitsspeicher oder ein Computer, dessen NVIDIA-Grafikkarte über eigene 16 GB verfügt, kann die leistungsstärkere Art von Übersetzungsprogramm erstellen; mit 8 GB eine leichtere Version davon, die auf einem 8-GB-Computer allerdings noch nicht ausprobiert wurde. Unter Windows benötigen die Trainingswerkzeuge WSL (das in Windows integrierte Linux). Andere Computer erstellen eine deutlich kleinere Variante, die in unseren Tests weit zurückblieb.
- **Runden kosten Rechenzeit.** Die meisten Runden bauen auf dem Übersetzungsprogramm auf, das Sie bereits verwenden, anstatt von vorne zu beginnen; beim leistungsstärkeren Übersetzungsprogramm kann eine Runde dennoch Stunden dauern, und auf einem Computer lernt jeweils nur ein Übersetzungsprogramm zur selben Zeit.
- **Halten Sie Sätze kurz.** Das stärkere Übersetzungsprogramm liest nur einen begrenzten Teil eines Satzes – noch weniger, wenn Ihre Sprache ein eigenes Schriftsystem verwendet. Die Werkzeuge zählen jeden Satz, der zu lang war, und weisen Sie darauf hin, damit Sie ihn aufteilen können.
- **Die Rechtschreibung wird nicht für Sie geprüft.** Wenn Menschen die Sprache auf unterschiedliche Weise schreiben, einigen Sie sich vor Beginn des Projekts auf eine gemeinsame Schreibweise.

## Es kann nicht jedes Datenleck verhindern

Bei Dateien, die auf diesem Computer verbleiben – dem Standardfall –, zeigen die Werkzeuge Ihrem KI-Assistenten Zählwerte an, keine Sätze. Doch ein Assistent, der Ihren Computer bedienen kann, kann jede Datei öffnen, die auch Sie öffnen können, ob aufgefordert oder nicht, und die meisten senden das Gelesene an das Unternehmen, das sie betreibt.
[Ihre Worte, Ihre Regeln](/docs/your-words-your-rules) erklärt, was zu tun ist.

## Ein Übersetzungsprogramm ist keine lebendige Sprache

Ein Übersetzungsprogramm kann ein Sprachprogramm, eine Schule oder eine Familie unterstützen. Die Sprache lebt in den Menschen, die sie sprechen, und darin, jeden Tag gebraucht zu werden.
[Übersetzung ist keine Wiederbelebung](/docs/network/perspectives/translation-is-not-revitalization)
erläutert mehr dazu.

---

Diese Grenzen werden sich mit der weiteren Arbeit verändern. Sobald sich eine ändert, wird diese Seite entsprechend angepasst.

**Weiter:** [Bevor Sie beginnen →](/docs/before-you-begin)

## Weiterführende Informationen

- [Die Leitplanken im Einzelnen](/docs/guardrails) – wie jede einzelne Prüfung funktioniert.
- [Die technischen Grenzen](/docs/network/honest-limitations) – was die Messungen abdecken und was nicht, Vertrauensstufen für veröffentlichte Bewertungen, Verwahrung versiegelter Tests und warum keine Konfidenzwerte pro Satz angegeben werden.
- Zu den Zahlen der Übungssprache: ein Durchlauf pro Datensatzgröße, daher ist die Streuung zwischen verschiedenen Durchläufen nicht gemessen. „Genau richtig“ ist eine automatische Überprüfung aller Bedeutungsbestandteile – Verb, Zeitform, Person, Verneinung, Subjekt, Objekt und mehr – anhand der Grammatik der erfundenen Sprache selbst, nicht das Urteil eines Menschen. Das Übersetzungsprogramm war ein vortrainiertes Modell auf Byte-Ebene, feingetunt auf einem Laptop mit Apple Silicon. Wie lange es trainiert, verändert das Ergebnis stark (dasselbe Modell und 6.400 Sätze erzielten mit einem Viertel des Trainings etwa 27 von 100), es handelt sich also nicht um feste Obergrenzen. Bei 6.400 Sätzen waren etwa 9 von 100 Übersetzungen flüssig, verwendeten echte Wörter und bedeuteten etwas anderes. Das kleinere Modell, das die Werkzeuge auf anderen Computern verwenden, erzielte bei 6.400 Sätzen etwa 6 von 100 richtige Treffer.
- Das stärkere Übersetzungsprogramm liest höchstens 320 Bytes eines Satzes – etwa 100 Silbenzeichen, da Buchstaben mit Akzenten und Buchstaben anderer Alphabete jeweils zwei bis vier Bytes belegen. Das Training zählt die Paare jenseits der Grenze, bevor es sie abschneidet, und eine bereitgestellte Übersetzung gibt an, was abgeschnitten wurde.
