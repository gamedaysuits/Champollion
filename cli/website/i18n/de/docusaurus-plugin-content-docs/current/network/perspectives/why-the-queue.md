---
sidebar_position: 5
title: "Warum die Queue so aufgebaut ist"
slug: '/network/perspectives/why-the-queue'
description: "Die Philosophie hinter der Community-Compute-Queue: Gespendete Tokens sind ein Budget, das Mesh ist die Mission, und eine Prioritätenliste ist eine Reihe von Überzeugungen, die niedergeschrieben, kritisiert und falsifizierbar sein sollten."
related:
  - label: "Queue Construction Specification"
    to: /docs/network/specifications/queue-construction
    kind: spec
    note: "The formula this philosophy commits us to"
  - label: "Contributing Compute"
    to: /docs/network/getting-started/contributing-compute
    kind: guide
  - label: "Corpus Design Framework"
    to: /docs/network/specifications/corpus-design
    kind: spec
---

# Warum die Warteschlange auf diese Weise aufgebaut ist

Die Warteschlange ist das folgenreichste redaktionelle Artefakt, das wir veröffentlichen.
Jeder Eintrag darauf besagt: *Wenn Sie bereit sind, ein paar Cent
API-Guthaben für maschinelle Übersetzung ressourcenarmer Sprachen aufzuwenden, ist dies der beste Ort,
den wir kennen, um es auszugeben.* Dieser Satz bringt Verpflichtungen mit sich. Auf dieser Seite geht es
darum, worin diese bestehen und wie die
[Formel zur Warteschlangenkonstruktion](/docs/network/specifications/queue-construction)
diese erfüllt.

## Eine Prioritätenliste ist eine Reihe von Überzeugungen

Jede Anordnung von Arbeit kodiert Antworten auf drei Fragen, ob nun
jemand sie aufgeschrieben hat oder nicht:

1. **Was schätzen wir wert?** Was ist ein abgeschlossener Durchlauf tatsächlich *wert*?
2. **Was glauben wir?** Was erwarten wir, das geschieht, wenn ein Durchlauf, den wir
   noch nicht versucht haben, ausgeführt wird?
3. **Was geben wir zu, nicht zu wissen?** Wo sollte Neugier
   die Vorhersage übertrumpfen?

Die meisten Benchmark-Warteschlangen beantworten diese implizit – „größte Lücke zuerst“,
„neuestes Modell zuerst“, irgendjemandes Tabellenkalkulation. Wir sind der Ansicht, dass ein Projekt, das
Fremde bittet, Geld auszugeben, explizite Antworten verdient, in einer Formel,
die jeder neu berechnen kann, mit jeder veröffentlichten Eingabe. Nicht weil Formeln
neutral sind – das sind sie nicht, unsere kodiert unsere Mission und unsere Ahnungen –
sondern weil **gegen eine niedergeschriebene Voreingenommenheit argumentiert werden kann, gegen eine nicht niedergeschriebene jedoch nicht.**

## Was wir wertschätzen: Ketten, keine Häkchen

Unsere Mission ist *jede Sprache in jede Sprache durch gemessene
einzelne Paarketten*. Die Übersetzungsinfrastruktur der Welt ist
englischzentriert; unsere begann ebenfalls so – ein Stern aus eng→X-
Benchmarks. Doch ein Stern misst immer nur eine Sache: die Entfernung vom
Englischen. Die Sprachen der Welt verdienen ein *Netz*: Wenn kein direkter
Benchmark zwischen zwei Sprachen existiert, sollte eine Kette gemessener Paare
es leisten – und ihre Qualität sollte etwas sein, das wir aus Messungen
abschätzen können, statt es zu behaupten.

Der Wert eines abgeschlossenen Durchlaufs ist also nicht „eine weitere Zeile in der Bestenliste“. Er
besteht darin, **um wie viel stärker das gesamte Netz wird**: der Zuwachs in unserem
qualitätsgewichteten Kettenkapazitätsziel Φ, das für jedes
geordnete Sprachpaar auf der Erde, das wir verfolgen, fragt: *Wie gut ist die
beste Kette zwischen ihnen im Moment?* Ein Durchlauf, der eine isolierte
Sprache verbindet, ist Hunderte von Durchläufen wert, die eine bereits hell erleuchtete
Ecke polieren – und die Formel besagt genau, wie viele Hunderte, anstatt es
dem Bauchgefühl zu überlassen. Dies ist derselbe Instinkt, der M2M-100 dazu führte,
„Brückensprachen“ über Sprachfamilien hinweg zu erschließen, statt mehr
englischgepaarte Daten (Fan et al. 2021) – kontinuierlich gemacht und auf
die Evaluation statt auf das Training gerichtet.

Zwei Konsequenzen, die wir bewusst in Kauf nehmen:

- **Ein günstiger kleiner Durchlauf auf einem ungemessenen Paar schlägt in der Regel einen teuren
  Durchlauf auf einem gemessenen.** Beigesteuerte Rechenleistung ist ein Budget; wir ordnen nach
  Netzzuwachs *pro Dollar* (die klassische Greedy-Regel, um unter einem Budget am meisten
  abzudecken – Khuller, Moss & Naor 1999). Die
  hundertste Kante zu beleuchten leistet mehr für die Mission als die erste mit Gold zu überziehen.
- **Geschätzte Ketten sind weniger wert als gemessene Kanten.** Unser Kettenmodell
  multipliziert Kantenqualitäten und erhebt einen Treuerabatt pro
  Pivot-Knotenpunkt, da vierzig Jahre Ergebnisse zur Pivot-Übersetzung
  belegen, dass das Routing über eine Zwischensprache mehr verliert, als die naive
  Komposition nahelegt (Utiyama & Isahara 2007; Wu & Wang 2007). Der
  Rabatt ist der dauerhafte Anreiz der Formel, *das direkte Paar zu messen*
  anstatt sich auf eine plausible Kette zu verlassen.

## Was wir glauben: Vorhersagen, die einfach genug sind, um sie zu prüfen

Um ein nicht durchgeführtes Experiment zu bewerten, müssen Sie sein Ergebnis vorhersagen. Es gibt hier
ein Spektrum, von „nichts annehmen“ bis „ein Modell trainieren, um zu raten“. Wir
hören auf diesem Spektrum bewusst früh auf: Unsere Vorhersage ist eine Summe, die ein
Mitwirkender auf einer Serviette überprüfen kann – *Wie schneidet dieses Sprachpaar
üblicherweise ab, wie weicht dieses Modell üblicherweise ab, gibt es Coaching-Belege
für genau diese Sprache* – und nichts weiter. Keine erlernten
Gewichte, keine Embeddings, kein Modell, dessen eigene Voreingenommenheiten geprüft werden müssten.

Das kostet uns Genauigkeit. Ein per Gradient Boosting trainierter Prädiktor über Sprachmerkmale
würde besser raten. Wir tauschen diese Genauigkeit gegen eine Eigenschaft, die wir
höher schätzen: **Jeder Rang in der Warteschlange ist von Hand aus
Zahlen reproduzierbar, die auf dem Eintrag selbst aufgedruckt sind.** Wenn jemand fragt: „Warum ist dieser
Färöisch-Durchlauf Nr. 1?“, lautet die Antwort vier veröffentlichte Zahlen und ein
Satz, nicht „das Modell hat es so gesagt“. Die Forschung zum aktiven Lernen hat seit Langem
die Ausgereiftheit der Auswahl gegen Vertrauen und Überprüfbarkeit abgewogen
(Haffari, Roy & Sarkar 2009 brachten genau diesen Kompromiss in die maschinelle
Übersetzung); ein freiwillig finanzierter Benchmark gehört an das überprüfbare
Ende.

## Was wir nicht wissen: Neugier mit einem Budget

Eine rein von Vorhersagen getriebene Warteschlange hat einen Fehlermodus: Sie
hungert selbstbewusst alles aus, über das sie schlecht prognostiziert, und findet nie
heraus, dass sie sich geirrt hat. Die klassische Antwort aus der Bandit-Literatur
ist *Optimismus angesichts von Ungewissheit*: Geben Sie jeder ungetesteten Option einen
Bonus, der schrumpft, wenn sich Belege ansammeln (Auer, Cesa-Bianchi &
Fischer 2002). Unsere Warteschlange trägt genau diesen Bonus – skaliert, nicht
zufällig, auf das Rauschniveau unserer Instrumente: Der Optimismus übersteigt nie
die ~5 chrF++-Punkte, die kleine Entwicklungskorpora ohnehin nicht unterscheiden
können ([Korpusdesign §6.3](/docs/network/specifications/corpus-design)).

Dieselbe Demut zeigt sich in zwei nennenswerten Asymmetrien:

- **Alles Veröffentlichte ist Beleg; nur offene Korpora sind Aktionen.**
  Ergebnisse auf lizenzbeschränkten Korpora informieren das Wissen des Netzes,
  doch die Warteschlange bittet Mitwirkende nur, das auszuführen, was jeder
  frei ausführen darf.
- **Coaching-Belege übertragen sich nicht.** Wo gecoachte Durchläufe naive
  übertreffen, ist das eine gemessene Tatsache für diese Sprache – und Schweigen über
  jede andere. Die Warteschlange behält die Baseline-zuerst-Reihenfolge bei, wo immer
  Coaching ungemessen ist, anstatt anzunehmen, dass sich die Gewinne einer Sprache
  verallgemeinern lassen.

## Was wir abzulehnen

- **Keine Engagement-Optimierung.** Einträge werden niemals so angeordnet, dass sie
  Klicks, Serien oder Abschlusszufriedenheit maximieren. Das Netzziel ist
  das einzige Ziel.
- **Kein verborgener redaktioneller Eingriff.** Sollten wir je ein Paar fördern müssen (eine
  Gemeinschaftspartnerschaft, eine Frist), so wird dies als benannter,
  versionierter Term in der Spezifikation erscheinen – nicht als stille Neusortierung.
- **Keine Anspruchssperre.** Jeder darf jeden Eintrag jederzeit ausführen; identische
  Durchläufe werden per Fingerabdruck dedupliziert, und unabhängige Replikationen sind
  willkommene Belege. Eine Warteschlangenposition ist ein Ratschlag, keine Erlaubnis.
- **Kein Fähigkeitstheater.** Φ und jeder Wert, der in es einfließt, sind
  Entwicklungssatzzahlen mit bekannten Vorbehalten (Obergrenzen für Kontamination,
  sprachübergreifende Skalenunterschiede). Sie steuern die Ausgaben; sie
  werden niemals als das zitiert, was ein Modell „kann“.

## Gebaut, um öffentlich falsch zu liegen

Die Formel ist versioniert (`ecv-v2`), ihre Parameter werden in
jeder veröffentlichten Warteschlange wiedergegeben, und ihre zentrale Modellierungsannahme – dass
sich Kettenqualität multiplikativ mit einem Rabatt pro Knotenpunkt zusammensetzt –
ist nun *mit unseren eigenen Daten testbar*: Das Netz enthält gemessene
Dreiecke (direktes deu→fra neben deu→eng und eng→fra), sodass wir
tatsächliche verkettete Übersetzungen gegen die Vorhersagen des Modells bewerten und
den Rabatt empirisch ermitteln können, anstatt ihn zu wählen. Wenn das
geschieht, wird v3 dies vermerken, und diese Seite wird erläutern, was sich änderte und
warum. Das ist der Standard, an dem wir gemessen werden möchten: nicht eine Warteschlange, die
immer richtig liegt, sondern eine, deren Argumentation stets dokumentiert ist.

*Die Mathematik, die Standardwerte, das durchgearbeitete Beispiel und die vollständigen Quellenangaben befinden sich in der
[Spezifikation zur Warteschlangenkonstruktion](/docs/network/specifications/queue-construction).*
