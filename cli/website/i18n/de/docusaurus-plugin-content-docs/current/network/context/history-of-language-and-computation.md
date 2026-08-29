---
sidebar_position: 1
title: "Von Pāṇini zu Transformern"
---

# Von Pāṇini zu Transformern: Sprache, Berechnung und die unvollendete Aufgabe der Übersetzung

**Eine Geschichte der Ideen hinter champollion**

---

> *„Wenn ich einen Artikel auf Russisch betrachte, sage ich: ‚Dies ist eigentlich auf Englisch geschrieben, wurde aber in seltsamen Symbolen kodiert. Ich werde nun mit der Dekodierung fortfahren.‘"*
> — Warren Weaver, 1949

---

## Einführung

Der Traum von einer Maschine, die zwischen menschlichen Sprachen übersetzen könnte, ist älter als der Computer selbst. Er ist in gewissem Sinne *das* ursprüngliche Problem der künstlichen Intelligenz — älter als schachspielende Programme, älter als Expertensysteme, älter als neuronale Netze. Dieser Wunsch wird oft durch europäische Gleichnisse wie den Turmbau zu Babel gerahmt, der sprachliche Vielfalt als Strafe oder als zu lösendes Problem positioniert und dabei die Realität übergeht, dass indigene Gesellschaften vor dem Kontakt seit Langem eine überwältigende sprachliche Vielfalt durch ausgefeilte Handelssprachen (wie das Chinook Jargon) und Zeichensysteme (wie die Plains Indian Sign Language) bewältigt haben, ohne eine universelle Homogenisierung anzustreben.

Doch die Geschichte, die zu diesem Moment führt — zu einer Welt, in der große Sprachmodelle passables Französisch übersetzen, aber Unsinn auf Cree halluzinieren —, ist keine gerade Linie. Sie ist ein Geflecht aus mindestens vier verschiedenen Strängen: dem formalen Studium der Sprache, der mathematischen Theorie der Berechnung, der statistischen Revolution im maschinellen Lernen und einer dunkleren Geschichte, die erklärt, *warum* die Sprachen, die Technologie am dringendsten benötigen, ausgerechnet jene Sprachen sind, für die sie nicht existiert. Dieser vierte Strang ist die Geschichte der kolonialen Sprachunterdrückung und des kulturellen Völkermords — der bewussten, systematischen Zerstörung indigener Sprachen auf jedem Kontinent, auf dem europäische Mächte ihre Herrschaft errichteten. Ohne das Verständnis dieser Geschichte erscheint das technische Problem wie ein Zufall des Datenmangels. Es ist kein Zufall.

Dieses Papier verfolgt alle vier Stränge von ihren Ursprüngen bis zu ihrer Konvergenz in der Gegenwart. Es ist, zugegebenermaßen, etwas whiggistisch — es erzählt die Geschichte, als hätte sie stets hierher geführt. Die Geschichte wusste natürlich nicht, wohin sie ging. Doch die Stränge sind real, die Verbindungen sind echt, und ihr Verständnis ist wesentlich, um zu verstehen, warum Projekte wie champollion existieren, warum sie so gebaut sind, wie sie gebaut sind, und warum sie gerade jetzt von Bedeutung sind.

---

## I. Die Grammatik von allem: Von Pāṇini zu Chomsky

### Die erste formale Grammatik (ca. 4. Jahrhundert v. Chr.)

Die Geschichte beginnt nicht an einer europäischen Universität, sondern im alten Indien, mit einem Gelehrten namens Pāṇini. Um das 4. Jahrhundert v. Chr. verfasste Pāṇini das *Aṣṭādhyāyī* — eine Grammatik des Sanskrit, die etwa 4.000 Regeln umfasst. Dies war keine Grammatik im lockeren, pädagogischen Sinne. Es war eine *generative* Grammatik: eine endliche Menge von Regeln, die im Prinzip jede gültige Äußerung in der Sprache erzeugen konnte.

Pāṇinis System verwendete das, was wir heute als formale Umschreibungsregeln erkennen würden, mit Variablen, Rekursion und geordneter Anwendung. Der Linguist Paul Kiparsky hat argumentiert, dass das *Aṣṭādhyāyī* „die vollständigste generative Grammatik ist, die je für eine Sprache geschrieben wurde" (Kiparsky, 1993). Der Informatiker Gerard Huet hat gezeigt, dass Pāṇinis Regeln als endlicher Zustandsübersetzer (Finite-State-Transducer) modelliert werden können — dasselbe rechnerische Formalismus, das fünfundzwanzig Jahrhunderte später zentral für die morphologische Analyse polysynthetischer Sprachen werden sollte.

Pāṇini wusste nicht, dass er Informatik betrieb. Aber das tat er.

### Der Stein von Rosette und die Geburt der vergleichenden Linguistik (1799)

Während des größten Teils der aufgezeichneten Geschichte war das Studium der Sprache in erster Linie das Studium der *eigenen* Sprache — oder bestenfalls das Studium einer heiligen oder klassischen Sprache für liturgische Zwecke. Die intellektuelle Revolution, die die moderne Linguistik hervorbrachte, begann mit einem Stein.

Der Stein von Rosette, 1799 von Napoleons Soldaten entdeckt, trug denselben Erlass in drei Schriften: ägyptische Hieroglyphen, demotische Schrift und Altgriechisch. Jean-François Champollions Entzifferung der Hieroglyphen im Jahr 1822 war mehr als ein archäologischer Triumph. Sie demonstrierte ein Prinzip, das grundlegend werden sollte: dass Sprachen *durcheinander* verstanden werden konnten. Übersetzung war nicht bloß eine praktische Fertigkeit; sie war eine Methode der wissenschaftlichen Untersuchung.

### William Jones und die indoeuropäische Hypothese (1786)

Schon vor Champollion hatte der britische Philologe Sir William Jones seine berühmte Vorlesung vor der Asiatic Society of Bengal im Jahr 1786 gehalten und beobachtet, dass das Sanskrit zum Griechischen und Lateinischen „eine stärkere Verwandtschaft aufweist, sowohl in den Wurzeln der Verben als auch in den Formen der Grammatik, als möglicherweise durch Zufall hätte hervorgebracht werden können." Jones schlug vor, dass alle drei von einem gemeinsamen Vorfahren abstammten, „der vielleicht nicht mehr existiert."

Dies war die Geburt der historischen und vergleichenden Linguistik. Sie stellte fest, dass Sprachen keine isolierten, statischen Entitäten waren, sondern Mitglieder von Familien — verwandt durch Abstammung, geformt von der Zeit, unterworfen regelmäßigen Gesetzen des Wandels. Es war, auf seine Weise, eine Evolutionstheorie, Jahrzehnte vor Darwin.

### August Schleichers Sprachbäume (1861)

Es war August Schleicher, ein deutscher Linguist, der die darwinistische Verbindung explizit machte. Im Jahr 1861 — nur zwei Jahre nach *Über die Entstehung der Arten* — veröffentlichte Schleicher sein *Stammbaum*-Modell der indoeuropäischen Sprachen. Seine Diagramme sehen fast ununterscheidbar von phylogenetischen Bäumen in der Biologie aus. Sprachen, wie Arten, verzweigten sich, divergierten und starben gelegentlich aus.

Schleichers Bäume waren eine Vereinfachung (Sprachen *konvergieren* auch durch Kontakt, Entlehnung und Kreolisierung), aber das Modell erwies sich als enorm produktiv. Es begründete das Prinzip, dass sprachliche Vielfalt kein zufälliges Rauschen war, sondern strukturierte Daten, die einer systematischen Analyse zugänglich sind. Und es warf implizit eine Frage auf, die für unser Projekt weiterhin zentral bleibt: Was geschieht mit den Zweigen, die sterben?

### Ferdinand de Saussure und die Architektur der Sprache (1916)

Die nächste Revolution kam von Ferdinand de Saussure, dessen *Cours de linguistique générale* (posthum 1916 aus den Aufzeichnungen der Studenten veröffentlicht) die strukturelle Linguistik begründete. Saussure zog eine scharfe Unterscheidung zwischen *langue* (dem abstrakten System einer Sprache) und *parole* (der tatsächlichen Rede). Er argumentierte, dass sprachliche Zeichen *willkürlich* seien — das Wort „Baum" trägt keine inhärente Verbindung zu Bäumen — und dass Bedeutung aus *Unterschieden* innerhalb eines Systems entstehe, nicht aus einem positiven Gehalt.

Saussures zentrales Diagramm — das Oval, unterteilt zwischen *signifié* (dem Bezeichneten, dem Konzept) und *signifiant* (dem Bezeichnenden, dem Lautbild), verbunden durch Pfeile, die ihre untrennbare Beziehung zeigen — wurde zu einem der am häufigsten reproduzierten Bilder in den Geisteswissenschaften. Es begründete das Prinzip, dass eine Sprache ein *System von Systemen* ist, in dem jedes Element seinen Wert aus seinen Beziehungen zu allen anderen ableitet.

Dies hatte tiefgreifende Implikationen für die Übersetzung. Wenn Bedeutung relational und systemisch ist, dann ist Übersetzung keine Frage des Austauschs von Wörtern. Sie erfordert das Verständnis der gesamten Architektur einer Sprache. Zwei Sprachen mögen die Welt auf grundlegend unterschiedliche Weise gliedern — eine Erkenntnis, die später von Edward Sapir und Benjamin Lee Whorf entwickelt (und manchmal übertrieben) wurde.

### Sapir, Bloomfield und das Studium indigener Sprachen

In Nordamerika brachte das frühe 20. Jahrhundert eine andere Tradition der sprachwissenschaftlichen Feldforschung. Edward Sapir und Leonard Bloomfield arbeiteten ausgiebig mit indigenen Sprachen — Sapir mit Navajo, Nootka und vielen anderen; Bloomfield mit Menomini und anderen Algonkin-Sprachen. Sie stießen auf sprachliche Strukturen, die sich radikal von allem in der indoeuropäischen Familie unterschieden.

Sapir insbesondere entwickelte einen typologischen Rahmen, der Sprachen entlang mehrerer Achsen klassifizierte, einschließlich der kritischen Unterscheidung zwischen *analytischen* Sprachen (wie dem Englischen, wo Wörter tendenziell kurz sind und Bedeutung durch die Wortstellung getragen wird) und *polysynthetischen* Sprachen (wie dem Cree, wo ein einzelnes Wort kodieren kann, was das Englische als einen ganzen Satz ausdrücken würde). Eine einzelne Cree-Verbform könnte das Subjekt, das Objekt, das Tempus, den Aspekt, die Evidentialität und mehrere modifizierende Elemente in einem morphologisch komplexen Wort vereinen.

Diese Arbeit begründete zwei Tatsachen, die für unser Projekt weiterhin zentral bleiben. Erstens: Die Sprachen der Welt sind weitaus strukturell vielfältiger, als jedes europazentrische Modell nahelegen würde. Zweitens: Viele dieser Sprachen waren bereits gefährdet. Doch während frühe strukturelle Linguisten diese Komplexität dokumentierten, beteiligten sie sich oft an einer „Rettungsanthropologie" — einem extraktiven akademischen Modell, das indigene Menschen bloß als „Informanten" behandelte, um westliche akademische Karrieren aufzubauen. Dieser Ansatz trennte Sprachen von ihren epistemologischen Wurzeln ab und ebnete den Weg dafür, Sprache als körperlose, extrahierbare Daten statt als lebendige, relationale Systeme zu behandeln.

### Die Chomsky-Revolution (1957)

Im Jahr 1957 veröffentlichte ein 28-jähriger Linguist am MIT namens Noam Chomsky *Syntactic Structures*, ein schmales Buch, das wie eine Bombe im Fachgebiet detonierte. Chomsky argumentierte, dass das Ziel der Linguistik darin bestehen sollte, die *generative Grammatik* einer Sprache zu entdecken — eine endliche Menge von Regeln, die alle und nur die grammatikalischen Sätze dieser Sprache erzeugen könnten.

Noch provokanter schlug Chomsky die *Chomsky-Hierarchie* vor: eine Klassifikation formaler Grammatiken nach ihrer Rechenmächtigkeit. Die Hierarchie hat vier Ebenen:

- **Typ 3 (Regulär)**: Erkannt durch endliche Automaten. Einfache Muster.
- **Typ 2 (Kontextfrei)**: Erkannt durch Kellerautomaten. Rekursive Strukturen wie verschachtelte Klammern.
- **Typ 1 (Kontextsensitiv)**: Erkannt durch linear beschränkte Automaten. Komplexere Abhängigkeiten.
- **Typ 0 (Rekursiv aufzählbar)**: Erkannt durch Turing-Maschinen. Alles Berechenbare.

Chomsky argumentierte, dass natürliche Sprachen mindestens kontextfreie Grammatiken erforderten, und möglicherweise mehr. Dies war eine direkte Brücke zwischen der Linguistik und der mathematischen Theorie der Berechnung. Dieselben formalen Werkzeuge, die Alan Turing entwickelt hatte, um über die Grenzen des Rechnens nachzudenken, konnten nun auf die menschliche Sprache angewendet werden.

Chomsky schlug auch die Idee der *Universalgrammatik* vor — dass die Fähigkeit zur Sprache angeboren ist, dass alle menschlichen Sprachen tiefe strukturelle Eigenschaften teilen und dass die Vielfalt der Oberflächenformen eine zugrunde liegende Einheit verschleiert. Dies bleibt umstritten (viele Typologen und Funktionalisten widersprechen), aber die formalen Werkzeuge, die Chomsky einführte — Phrasenstrukturregeln, Transformationsgrammatiken, die Hierarchie selbst —, wurden zur Grundlage der Computerlinguistik.

---

## II. Der Traum von der universellen Übersetzung

### Ramon Llulls Denkmaschine (1305)

Der Traum von der Mechanisierung des Denkens — und damit der Traum von der maschinellen Übersetzung — ist bemerkenswert alt. Ramon Llull, ein katalanischer Mystiker des 13. Jahrhunderts, entwarf die *Ars Magna*: ein System rotierender konzentrischer Scheiben, beschriftet mit grundlegenden Konzepten, deren Kombinationen alle möglichen Wahrheiten erzeugen sollten. Llulls Räder waren gewissermaßen die erste kombinatorische Logikmaschine. Leibniz zitierte Llull später als Inspiration.

### Athanasius Kircher und die Polygraphia Nova (1663)

Athanasius Kircher, der große jesuitische Universalgelehrte, veröffentlichte 1663 *Polygraphia Nova et Universalis* — ein System der „universellen Schrift", das die Kommunikation über Sprachbarrieren hinweg ermöglichen sollte. Kirchers System ordnete Konzepten Zahlen zu, die dann mit der entsprechenden Tabelle in jede Sprache dekodiert werden konnten. Es war im Wesentlichen eine Interlingua — eine sprachunabhängige Darstellung von Bedeutung.

Das System funktionierte nicht besonders gut. Aber die *Idee* blieb bestehen: dass zwischen zwei beliebigen Sprachen ein gemeinsamer konzeptueller Raum existiert und dass Übersetzung eine Frage der Abbildung durch diesen Raum ist. Diese Interlingua-Hypothese war nicht bloß ein fehlerhaftes wissenschaftliches Experiment; sie war eine epistemologische Erweiterung der kolonialen Kontrolle, unfähig, divergierende Ontologien abzubilden. Der Philosoph W.V.O. Quine sollte dieses Scheitern später mit seinem Konzept der *Unbestimmtheit der Übersetzung* (1960) formalisieren und argumentieren, dass radikale Übersetzung von Natur aus unbestimmt ist. Eine universelle, kontextfreie Abbildung zwischen grundlegend divergierenden Sprachsystemen ist eine philosophische Unmöglichkeit, nicht bloß eine technische Hürde.

### John Wilkins und die philosophische Sprache (1668)

Nur fünf Jahre nach Kircher veröffentlichte der englische Naturphilosoph John Wilkins *An Essay towards a Real Character, and a Philosophical Language* — einen Versuch, eine Sprache zu schaffen, deren Struktur *die Struktur der Wirklichkeit perfekt widerspiegelte*. Jedes Konzept würde in einer großen Taxonomie klassifiziert, und sein Name würde seine Position in dieser Taxonomie kodieren.

Wilkins' Projekt scheiterte (die Wirklichkeit erwies sich als widerständig gegenüber einer ordentlichen Klassifikation), aber es nahm etwas Wichtiges vorweg: die Idee, dass Sprache *entwickelt* werden könnte, dass die Beziehung zwischen Wörtern und Bedeutungen systematisch und explizit gemacht werden könnte. Dies ist in einem tiefen Sinne das, was Computerlinguisten tun, wenn sie Ontologien und Wissensgraphen erstellen.

### Leibniz und die Characteristica Universalis

Gottfried Wilhelm Leibniz, der unabhängig die Infinitesimalrechnung erfand und eine mechanische Rechenmaschine entwarf, träumte von einer *characteristica universalis* — einer universellen formalen Sprache, in der alles menschliche Wissen ausgedrückt werden könnte — und einem *calculus ratiocinator* — einer Maschine, die in dieser Sprache schlussfolgern könnte. „Wenn Kontroversen entstünden", schrieb Leibniz, „bedürfte es zwischen zwei Philosophen nicht mehr eines Disputs als zwischen zwei Buchhaltern. Denn es würde genügen, ihre Stifte in die Hand zu nehmen, sich an ihre Schiefertafeln zu setzen und einander zu sagen: Lasst uns rechnen."

Leibniz erfand auch die binäre Arithmetik — das Zahlensystem, das Jahrhunderte später zur Sprache der digitalen Computer werden sollte. Seine Abhandlung von 1703, *Explication de l'Arithmétique Binaire*, zeigte, dass jede Zahl nur mit 0 und 1 dargestellt werden konnte. Er sah dies als eine Reflexion der göttlichen Schöpfung (etwas aus dem Nichts), aber es sollte sich als die Grundlage aller digitalen Berechnung erweisen.

### Warren Weavers Memorandum (1949)

Die moderne Ära der maschinellen Übersetzung beginnt mit einem Memorandum. Im Juli 1949 schrieb der amerikanische Mathematiker und Wissenschaftsverwalter Warren Weaver an Norbert Wiener und schlug vor, dass die neuen elektronischen Computer auf die Übersetzung angewendet werden könnten. Sein Memorandum enthielt die bemerkenswerte Passage, die zu Beginn dieses Papiers zitiert wird: die Idee, dass ein russischer Text „eigentlich auf Englisch geschrieben ist, aber ... in seltsamen Symbolen kodiert."

Weavers Metapher war der Kryptoanalyse aus Kriegszeiten entnommen — der Idee, dass Übersetzung im Grunde ein *Dekodierungsproblem* war. Dies war nicht bloß eine Analogie. Dieselben statistischen und informationstheoretischen Werkzeuge, die entwickelt worden waren, um feindliche Chiffren zu knacken, könnten, wie Weaver vorschlug, auf das Problem der Übersetzung anwendbar sein.

Das Memorandum war maßlos optimistisch, aber es setzte ein Forschungsprogramm in Gang. Innerhalb von fünf Jahren sollte die erste Demonstration der maschinellen Übersetzung stattfinden.

---

## III. Die Maschinerie des Denkens: Berechnung und Information

### George Boole und die Algebra der Logik (1854)

Im Jahr 1854 veröffentlichte George Boole *An Investigation of the Laws of Thought* — ein Werk, das das logische Schlussfolgern auf algebraische Operationen reduzierte. Boole zeigte, dass die Sätze der Logik mit denselben Regeln wie die Algebra manipuliert werden konnten, wobei UND der Multiplikation, ODER der Addition und NICHT der Komplementbildung entsprach.

Die Boolesche Algebra erschien damals wie eine mathematische Kuriosität. Sie sollte zum Funktionsprinzip jeder jemals gebauten digitalen Schaltung werden.

### Charles Babbage und Ada Lovelace (1837–1843)

Charles Babbage entwarf (aber vollendete nie) die Analytical Engine — einen mechanischen, dampfbetriebenen Universalcomputer. Anders als seine frühere Difference Engine (ein spezialisierter Rechner) hatte die Analytical Engine einen Speicher („the Store"), eine Verarbeitungseinheit („the Mill"), bedingte Verzweigungen und Schleifen. Sie war im Prinzip Turing-vollständig.

Ada Lovelace, die von einer Beschreibung der Engine ausging, schrieb eine Reihe detaillierter Anmerkungen, die das enthielten, was weithin als das erste veröffentlichte Computerprogramm gilt: ein Algorithmus zur Berechnung der Bernoulli-Zahlen (Note G, 1843). Doch Lovelaces tiefgreifendster Beitrag war konzeptueller Natur. Sie erkannte, dass die Engine *Symbole* manipulieren konnte, nicht nur Zahlen. „Die Analytical Engine webt algebraische Muster", schrieb sie, „genau wie der Jacquard-Webstuhl Blumen und Blätter webt." Die Implikation — dass Berechnung auf jeden Bereich mit einer formalen Struktur angewendet werden könnte, einschließlich der Sprache — war vorausschauend.

### Alan Turing und die universelle Maschine (1936)

Im Jahr 1936 veröffentlichte Alan Turing „On Computable Numbers, with an Application to the Entscheidungsproblem" — ein Papier, das gleichzeitig die Berechnung definierte, ihre Grenzen bewies und den modernen Computer (in abstrakter Form) erfand.

Turings zentrale Erkenntnis war die *universelle Maschine*: eine einzelne Maschine, die, mit den richtigen auf ihrem Band kodierten Anweisungen versehen, *jede andere* Maschine simulieren konnte. Dies stellte fest, dass es keinen wesentlichen Unterschied zwischen Hardware und Software, zwischen der Maschine und dem Programm gab. Ein einzelnes Gerät, richtig programmiert, konnte alles berechnen, was überhaupt berechenbar war.

Turings Arbeit stellte auch die Grenzen der Berechnung fest (das Halteproblem) und legte den Grundstein für seine spätere Erforschung der maschinellen Intelligenz. Sein Papier von 1950, „Computing Machinery and Intelligence", das den berühmten Turing-Test vorschlug, formulierte die Frage der maschinellen Intelligenz ausdrücklich in Bezug auf *Sprache*: Eine Maschine ist intelligent, wenn sie sich im Gespräch nicht von einem Menschen unterscheiden lässt.

### Claude Shannon und die Informationstheorie (1948)

Im Jahr 1948 veröffentlichte Claude Shannon „A Mathematical Theory of Communication" im *Bell System Technical Journal* — ein Papier, das das Fachgebiet der Informationstheorie begründete. Shannon zeigte, dass Kommunikation als ein System modelliert werden konnte: eine *Informationsquelle* erzeugt eine *Nachricht*, die ein *Sender* in ein *Signal* kodiert, das einen *Kanal* durchläuft (unterworfen dem *Rauschen*), das ein *Empfänger* wieder in eine Nachricht für ein *Ziel* dekodiert.

Shannons zentraler Beitrag war das Konzept der *Entropie* — ein Maß für die Unsicherheit oder den Informationsgehalt einer Nachricht. Er bewies, dass für jeden Kanal mit einem gegebenen Rauschpegel eine maximale Rate existiert, mit der Information zuverlässig übertragen werden kann (die Kanalkapazität), und dass diese Rate mit hinreichend geschickter Kodierung erreicht werden kann.

Die Verbindung zur Übersetzung ist tiefgreifend. Shannon selbst verwendete in einem Papier von 1951 die Informationstheorie, um die statistische Struktur des Englischen zu analysieren. Er zeigte, dass englischer Text hochgradig redundant ist — dass ein Muttersprachler, wenn er eine Buchstabenfolge erhält, den nächsten Buchstaben mit hoher Genauigkeit vorhersagen kann. Diese Redundanz ist es, die Kommunikation gegen Rauschen robust macht, aber sie bedeutet auch, dass der *Informationsgehalt* der Sprache viel geringer ist, als ihre rohe Symbolzahl nahelegen würde.

Warren Weaver erkannte sofort die Verbindung: Wenn Übersetzung Dekodierung ist und wenn die statistische Struktur der Sprache modelliert werden kann, dann ist Übersetzung ein informationstheoretisches Problem. Diese Erkenntnis sollte Jahrzehnte brauchen, um Früchte zu tragen, aber als sie es tat, verwandelte sie das Fachgebiet.

### Von Neumann und der Computer mit gespeichertem Programm (1945)

John von Neumanns Bericht von 1945 über den EDVAC (Electronic Discrete Variable Automatic Computer) beschrieb das, was wir heute die *Von-Neumann-Architektur* nennen: einen Computer mit einem einzigen Speicher für sowohl Daten als auch Anweisungen, einer zentralen Verarbeitungseinheit und Ein-/Ausgabemechanismen. Diese Architektur — Daten und Programme teilen sich denselben Speicher, sequenziell von einer CPU verarbeitet — bleibt das grundlegende Design nahezu jedes heute in Gebrauch befindlichen Computers.

Die Von-Neumann-Architektur machte Software praktikabel. Programme konnten gespeichert, modifiziert und sogar von anderen Programmen erzeugt werden. Dies war die technologische Voraussetzung für alles, was folgte: Compiler, Betriebssysteme und schließlich die neuronalen Netzwerk-Frameworks, die die moderne maschinelle Übersetzung antreiben.

---

## IV. Maschinelle Übersetzung: Das erste KI-Problem

### Das Georgetown-IBM-Experiment und der Kalte Krieg (1954)

Am 7. Januar 1954 demonstrierten Forscher der Georgetown University und von IBM das erste öffentliche maschinelle Übersetzungssystem. Das System übersetzte 60 russische Sätze ins Englische mit einem Wortschatz von 250 Wörtern und sechs Grammatikregeln. Die Sätze waren sorgfältig ausgewählt, um innerhalb der Fähigkeiten des Systems zu liegen, aber die Demonstration erzeugte enorme Begeisterung.

Die *New York Times* berichtete, dass das Experiment eine Zukunft ankündige, in der ein „elektronischer Übersetzer per Knopfdruck" die gesamte wissenschaftliche Literatur der Welt sofort zugänglich machen würde. Doch dieser öffentliche Optimismus verschleierte die materielle Realität der Finanzierung und des Zwecks des Projekts. Das Georgetown-IBM-Experiment — und das frühe Feld der maschinellen Übersetzung allgemein — wurde nicht von einem utopischen Wunsch nach universeller Kommunikation angetrieben. Es wurde vom militärischen und geheimdienstlichen Apparat der Vereinigten Staaten (einschließlich der CIA und DARPA) als dringendes Gebot des Kalten Krieges finanziert, um sowjetische wissenschaftliche und militärische Texte zu überwachen und abzufangen.

Die Sichtweise auf Sprache als einen „zu knackenden Code" (wie Weaver es formulierte) war untrennbar mit militarisierter Überwachung verbunden. Forscher sagten voraus, dass die maschinelle Übersetzung innerhalb von fünf Jahren ein gelöstes Problem sein würde. Sie irrten sich um mehr als ein halbes Jahrhundert.

### Der ALPAC-Bericht und der erste KI-Winter (1966)

Im Jahr 1966 gab das Automatic Language Processing Advisory Committee (ALPAC), einberufen von der US-Regierung, einen vernichtenden Bericht heraus. Nach der Überprüfung eines Jahrzehnts der MÜ-Forschung kam ALPAC zu dem Schluss, dass die maschinelle Übersetzung langsamer, ungenauer und teurer als die menschliche Übersetzung sei, und empfahl, die Finanzierung auf die Grundlagenforschung in der Computerlinguistik umzuleiten.

Der ALPAC-Bericht tötete effektiv die MÜ-Forschungsfinanzierung in den Vereinigten Staaten für über ein Jahrzehnt. Es war der erste „KI-Winter" — ein Muster, das sich wiederholen sollte: extravagante Versprechen, bescheidene Ergebnisse, Ernüchterung, Finanzierungszusammenbruch.

Aber der Bericht enthielt auch eine tiefere Erkenntnis. Die maschinelle Übersetzung war teilweise gescheitert, weil Sprache schwieriger war, als irgendjemand erwartet hatte. Der regelbasierte Ansatz — das Schreiben expliziter Grammatikregeln, um Sätze zu analysieren und zu erzeugen — funktionierte für einfache Fälle, brach aber bei echtem Text katastrophal zusammen. Sprache war zu mehrdeutig, zu kontextabhängig, zu *lebendig*, als dass spröde Regeln sie erfassen könnten.

### Regelbasierte und transferbasierte MÜ (1970er–1980er Jahre)

Die Forschung ging in den 1970er und 1980er Jahren leiser weiter. Systeme wie SYSTRAN (das die frühen Übersetzungsdienste der Europäischen Kommission antrieb) verwendeten große handgefertigte Wörterbücher und Transferregeln, um zwischen Sprachpaaren abzubilden. Diese Systeme konnten für eingeschränkte Bereiche nützliche grobe Übersetzungen produzieren, aber sie erforderten einen enormen technischen Aufwand für jedes Sprachpaar und bewältigten uneingeschränkten Text selten elegant.

Das grundlegende Problem war klar: Sprache ist keine Chiffre. Man kann nicht übersetzen, indem man Wörter in einem Wörterbuch nachschlägt und sie nach grammatikalischen Regeln umordnet, denn Bedeutung hängt vom Kontext ab, vom Weltwissen, von der Absicht des Sprechers, von der gesamten Geschichte eines Gesprächs. Der Interlingua-Ansatz — die Übersetzung durch eine abstrakte, sprachunabhängige Darstellung — war theoretisch elegant, aber praktisch unmöglich. Niemand konnte die Interlingua definieren.

### Die statistische Revolution (1990er Jahre)

Der Durchbruch kam nicht von besseren Regeln, sondern von besseren Daten. Ende der 1980er und Anfang der 1990er Jahre entwickelten Forscher bei IBM (Peter Brown, Stephen Della Pietra, Vincent Della Pietra und Robert Mercer) eine Reihe statistischer Modelle für die maschinelle Übersetzung — die berühmten IBM-Modelle 1 bis 5.

Die zentrale Erkenntnis war Weavers alte Idee, endlich rigoros gemacht: Übersetzung als Dekodierung. Gegeben einen fremdsprachlichen Satz *f*, finde den englischen Satz *e*, der P(e|f) maximiert. Nach dem Satz von Bayes ist dies gleichbedeutend mit der Maximierung von P(f|e) × P(e) — ein *Übersetzungsmodell* (wie wahrscheinlich ist dieser fremdsprachliche Satz bei gegebenem englischem Satz?) multipliziert mit einem *Sprachmodell* (wie wahrscheinlich ist dieser englische Satz für sich allein?).

Die IBM-Modelle lernten diese Wahrscheinlichkeiten aus großen *Parallelkorpora* — Sammlungen von Texten, die in beiden Sprachen existierten (wie die kanadischen Parlamentsprotokolle, die sogenannten Hansards, die sowohl auf Englisch als auch auf Französisch veröffentlicht wurden). Keine handgefertigten Regeln waren erforderlich. Das System lernte zu übersetzen, indem es Millionen von Beispielen menschlicher Übersetzung beobachtete.

Die statistische MÜ funktionierte für Sprachen mit reichlich vorhandenen Paralleldaten dramatisch besser als die regelbasierte MÜ. Sie führte auch ein kritisches Stück Infrastruktur ein: den **BLEU-Score** (Papineni et al., 2002), eine Metrik zur automatischen Bewertung der Übersetzungsqualität durch Vergleich der Maschinenausgabe mit menschlichen Referenzübersetzungen. BLEU machte es möglich, Fortschritte quantitativ zu messen und groß angelegte Experimente durchzuführen.

Aber die statistische MÜ hatte eine fatale Annahme eingebaut: Sie erforderte *Parallelkorpora*. Für die wichtigsten Sprachpaare der Welt — Englisch-Französisch, Englisch-Chinesisch, Englisch-Spanisch — waren Paralleldaten reichlich vorhanden. Für die überwiegende Mehrheit der 7.000 Sprachen der Welt existierten sie schlichtweg nicht.

### Die neuronale Revolution: Seq2Seq, Attention, Transformer (2014–2017)

Die nächste Transformation kam mit Deep Learning. Im Jahr 2014 demonstrierten Ilya Sutskever, Oriol Vinyals und Quoc Le *Sequence-to-Sequence*-Modelle (Seq2Seq) für die MÜ: neuronale Netze, die einen ganzen Satz in einer Sprache lesen und eine Übersetzung in einer anderen erzeugen konnten, ohne explizite Ausrichtung oder Phrasentabellen.

Im Jahr 2015 führten Dzmitry Bahdanau, Kyunghyun Cho und Yoshua Bengio den *Attention-Mechanismus* ein — der es dem Decoder ermöglichte, „zurückzublicken" auf verschiedene Teile des Quellsatzes, während er jedes Wort der Übersetzung erzeugte. Dies verbesserte die Leistung bei langen Sätzen dramatisch.

Und im Jahr 2017 veröffentlichten Vaswani et al. bei Google „Attention Is All You Need" und führten die *Transformer*-Architektur ein. Der Transformer verzichtete vollständig auf Rekurrenz und verarbeitete ganze Sequenzen parallel unter Verwendung von Self-Attention. Er war schneller zu trainieren, leichter zu skalieren und produzierte bessere Übersetzungen als alles, was zuvor gekommen war.

Transformer führten direkt zu den großen Sprachmodellen (LLMs) der 2020er Jahre: GPT, BERT, PaLM, LLaMA und ihren Nachfahren. Diese Modelle, trainiert auf riesigen Textmengen aus dem Internet, können zwischen Hunderten von Sprachpaaren mit bemerkenswerter Flüssigkeit übersetzen.

Aber „bemerkenswerte Flüssigkeit" ist nicht dasselbe wie „zuverlässige Genauigkeit". Und für die ressourcenarmen Sprachen der Welt ist die Situation weit schlimmer, als es erscheint.

---

## V. Die andere Geschichte: Sprache, Macht und kultureller Völkermord

Die vorherigen vier Abschnitte erzählen die Geschichte der Ideen — von Grammatikern, Mathematikern und Ingenieuren, die auf die maschinelle Übersetzung hinarbeiteten. Aber es gibt eine andere Geschichte, die parallel verläuft und erklärt, *warum* die Sprachen, die Übersetzungstechnologie am dringendsten benötigen, ausgerechnet jene sind, für die sie nicht existiert. Dies ist keine Geschichte über Datenmangel als neutrale Tatsache. Es ist eine Geschichte über bewusste Zerstörung.

Der Grund dafür, dass das Plains Cree keine Unterstützung durch maschinelle Übersetzung hat, liegt nicht in erster Linie darin, dass Cree eine schwierige Sprache für Computer ist (obwohl das der Fall ist). Es liegt daran, dass über ein Jahrhundert lang die Regierungen von Kanada und den Vereinigten Staaten systematische Programme durchführten, um indigene Sprachen aus den Mündern von Kindern auszurotten. Der „Datenmangel", der die ressourcenarme MÜ so schwierig macht, ist zu einem großen Teil die *nachgelagerte Folge des kulturellen Völkermords*. Jede ehrliche Darstellung dessen, warum diese Sprachen Technologie benötigen, muss sich damit auseinandersetzen, warum sie überhaupt an den Rand des Aussterbens gebracht wurden.

### Vor dem Kontakt: Ein Kontinent der Sprachen

Die sprachliche Vielfalt Amerikas vor dem Kontakt war überwältigend. Zur Zeit des europäischen Kontakts beherbergte allein Nordamerika schätzungsweise 300 bis 600 verschiedene Sprachen, organisiert in Dutzenden nicht verwandter Sprachfamilien — mehr genetische Vielfalt als in ganz Europa. Südamerika hatte möglicherweise 1.500 oder mehr (Campbell, 1997). Australien hatte über 250 Sprachen. Die Pazifikinseln, das subsaharische Afrika und das südostasiatische Festland waren ähnlich vielfältig.

Dies waren keine „primitiven" oder „einfachen" Sprachen. Viele der strukturell komplexesten jemals dokumentierten Sprachen sind indigen. Die polysynthetische Morphologie der Algonkin-Sprachen (einschließlich Cree, Ojibwe und Blackfoot), die Tonsysteme des Navajo, die aufwendige Evidentialitätsmarkierung des Quechua, die Klickkonsonanten der Khoisan-Sprachen — diese repräsentieren die volle Bandbreite dessen, was menschliche Sprache sein kann. Sie kodieren ausgefeilte Wissenssysteme über Verwandtschaft, Ökologie, Recht, Spiritualität und Geschichte. Jede Sprache ist eine Bibliothek — ein unersetzliches Zeugnis der Art und Weise, wie eine Gemeinschaft die Welt versteht und ordnet.

Edward Sapir erkannte dies klar. 1921 schrieb er, dass „wenn es um sprachliche Form geht, Platon mit dem mazedonischen Schweinehirten wandelt, Konfuzius mit dem kopfjagenden Wilden von Assam." Die Sprachen indigener Völker waren nicht minderwertig. Sie waren anders — und ihre Unterschiede enthielten Wissen, das keine andere Sprache besaß.

### Die Mechanik des Sprachtods

Sprachen sterben nicht aus natürlichen Ursachen. Sie sterben, wenn die Bedingungen für ihre Weitergabe gestört werden — wenn Kinder aufhören, sie zu lernen, wenn Sprecher für ihren Gebrauch bestraft werden, wenn sich die sozialen und wirtschaftlichen Anreize so verschieben, dass das Sprechen der dominanten Sprache zu einer Überlebensbedingung wird.

Diese Störung kann allmählich geschehen, durch wirtschaftlichen und demografischen Druck. Aber in der kolonialen Welt war sie überwältigend *bewusst*. Die Unterdrückung indigener Sprachen war keine Nebenwirkung der Kolonisierung. Sie war ein erklärtes politisches Ziel.

### Kanada: Das Residential-School-System (1831–1996)

In Kanada betrieb das System der Indian Residential Schools über 160 Jahre lang mit dem ausdrücklichen Ziel, indigene Sprachen und Kulturen zu beseitigen. Schätzungsweise 150.000 Kinder der First Nations, der Métis und der Inuit wurden ihren Familien und Gemeinschaften entrissen und in staatlich finanzierten, von Kirchen betriebenen Internaten untergebracht.

Die zentrale Politik wurde 1920 mit erschreckender Klarheit von Duncan Campbell Scott, dem stellvertretenden Generalsuperintendenten für Indianerangelegenheiten, formuliert: „Ich will das Indianerproblem loswerden ... Unser Ziel ist es, fortzufahren, bis es keinen einzigen Indianer in Kanada gibt, der nicht in den politischen Körper aufgenommen wurde, und es keine Indianerfrage und kein Indianerdepartement mehr gibt."

Der Mechanismus war die Sprache. Kindern war es verboten, ihre Muttersprachen zu sprechen. Die Strafen für das Sprechen einer indigenen Sprache reichten von Schlägen über Einzelhaft bis hin dazu, dass ihnen Nadeln durch die Zunge gestoßen wurden. Kinder kamen an und sprachen Cree, Ojibwe, Inuktitut, Dene, Haida oder eine von Dutzenden anderer Sprachen. Sie wurden bestraft, bis sie aufhörten.

Die Truth and Reconciliation Commission of Canada (2015) dokumentierte die systematische Natur dieses Angriffs. Ihr Abschlussbericht kam zu dem Schluss, dass das Residential-School-System einen *kulturellen Völkermord* darstellte — die Zerstörung der Strukturen und Praktiken, die es einer Gruppe ermöglichen, als Gruppe fortzubestehen. Sprache war das Hauptziel. Ohne Sprache wird die Zeremonie gestört, die mündliche Geschichte gebrochen, Verwandtschaftssysteme unverständlich, und die generationenübergreifende Weitergabe von Wissen hört auf.

Die letzte staatlich betriebene Residential School in Kanada schloss 1996. Viele der Ältesten, die heute die letzten fließenden Sprecher ihrer Sprachen sind, sind Überlebende der Residential Schools. Ihre Sprachbeherrschung ist nicht bloß eine sprachliche Ressource. Sie ist ein Akt des Widerstands.

### Die Vereinigten Staaten: Indian Boarding Schools (1860er–1960er Jahre)

Die Vereinigten Staaten betrieben ein paralleles System. Captain Richard Henry Pratt, Gründer der Carlisle Indian Industrial School im Jahr 1879, prägte den Satz, der die Ära definierte: „Kill the Indian, save the man." („Tötet den Indianer, rettet den Menschen.") Über 350 staatlich finanzierte Internate operierten in den gesamten Vereinigten Staaten, mit Richtlinien, die nahezu identisch mit denen in Kanada waren. Indigenen Kindern war es verboten, ihre Sprachen zu sprechen, sie wurden gezwungen, englische Namen anzunehmen, und einer systematischen kulturellen Auslöschung unterworfen.

Ein Bericht des US-Innenministeriums aus dem Jahr 2022 identifizierte über 400 föderale Indian Boarding Schools in 37 Bundesstaaten und dokumentierte den Tod von mindestens 500 Kindern im System — eine Zahl, von der der Bericht anerkannte, dass sie mit ziemlicher Sicherheit eine erhebliche Untererfassung darstellte. Die Untersuchung stellte fest, dass das System nicht bloß zur Bildung, sondern zur „kulturellen Assimilation indianischer Kinder durch ihre gewaltsame Umsiedlung von ihren Familien und Gemeinschaften" konzipiert war.

Die sprachlichen Folgen waren katastrophal. Von den etwa 300 indigenen Sprachen, die in dem Gebiet gesprochen wurden, das zu den Vereinigten Staaten wurde, sind heute mehr als die Hälfte ausgestorben. Von denen, die überleben, haben die meisten weniger als 1.000 fließende Sprecher, und viele haben weniger als 10. Das Endangered Languages Project klassifiziert die Mehrheit der überlebenden indianischen Sprachen als „stark" oder „kritisch" gefährdet.

### Australien: Die Stolen Generations (1910–1970)

In Australien entfernten Regierungspolitiken zwischen 1910 und 1970 gewaltsam Aboriginal- und Torres-Strait-Islander-Kinder aus ihren Familien. Diese Kinder — bekannt als die Stolen Generations — wurden in Missionen, Reservate und weiße Pflegefamilien gebracht. Das ausdrückliche Ziel war die Assimilation: die Aboriginal-Identität innerhalb weniger Generationen auszumerzen.

Aboriginal-Sprachen wurden in Missionen und Regierungseinrichtungen unterdrückt. Kinder, die ihre Sprachen sprachen, wurden bestraft. Der Bericht Bringing Them Home (1997), erstellt von der Australian Human Rights Commission, dokumentierte die systematische Natur dieser Entfernungen und ihre verheerenden Auswirkungen auf Sprache, Kultur und Familie.

Von den geschätzten 250 australischen Aboriginal-Sprachen, die zur Zeit des europäischen Kontakts gesprochen wurden, werden heute weniger als 20 an Kinder weitergegeben (Marmion et al., 2014). Über 100 sind vollständig ausgestorben. Die verbleibenden Sprachen überleben größtenteils durch die Bemühungen älterer Sprecher, die mit Linguisten und Gemeinschaftsorganisationen in einem Wettlauf gegen die Zeit arbeiten.

### Skandinavien: Die samischen Sprachen

Die Unterdrückung indigener Sprachen war nicht auf siedlerkoloniale Staaten der südlichen Hemisphäre beschränkt. In Norwegen, Schweden und Finnland wurden samische Kinder von der Mitte des 19. Jahrhunderts bis in die 1960er Jahre Internatsschulsystemen (*internatskoler*) unterworfen. Samische Sprachen wurden in Schulen verboten; Kinder wurden für ihr Sprechen bestraft. Norwegens Politik der „Norwegisierung" (*fornorskingspolitikk*) zielte ausdrücklich darauf ab, die samische Sprache zu beseitigen und durch Norwegisch zu ersetzen.

Von den neun überlebenden samischen Sprachen haben mehrere weniger als 500 Sprecher. Das Umesamische hat etwa 20. Das Pitesamische hat weniger als 30. Die Sprachen überleben teilweise aufgrund von Revitalisierungsprogrammen, die in den 1970er Jahren begannen, einschließlich der Einrichtung samischsprachiger Schulen und Medien — Programme, die für einige Dialekte gerade rechtzeitig und für andere zu spät kamen.

### Aotearoa Neuseeland: Te Reo Māori

Die Māori-Sprache (te reo Māori) war bis Mitte des 20. Jahrhunderts die Mehrheitssprache Aotearoas. Die britische koloniale Bildungspolitik, die in den 1860er Jahren begann, marginalisierte te reo zunehmend in den Schulen. In den 1970er Jahren waren weniger als 20 % der Māori fließende Sprecher, und die Sprache war innerhalb einer Generation vom Aussterben bedroht.

Die Reaktion der Māori war eine der frühesten und erfolgreichsten Sprachrevitalisierungsbewegungen der Welt. Kōhanga reo (Sprachnester) für Kinder im Vorschulalter, 1982 eingerichtet, tauchten Säuglinge und Kleinkinder von Geburt an in te reo ein. Kura kaupapa Māori (māorisprachige Schulen) folgten. Diese Programme haben zusammen mit dem Māori Language Act von 1987 (der te reo zu einer Amtssprache machte) die Sprache stabilisiert — obwohl fließende Sprecher immer noch eine Minderheit der Māori-Bevölkerung ausmachen.

Neuseeland brachte auch einen der wichtigsten Rahmen für die indigene Datenverwaltung hervor: *Te Mana Raraunga*, das Māori Data Sovereignty Network. Dieser Rahmen bekräftigt, dass Māori-Daten — einschließlich sprachlicher Daten — ein taonga (Schatz) sind, der den Rechten und Pflichten der kaitiakitanga (Hüterschaft) unterliegt. Er beeinflusste direkt die Entwicklung der CARE-Prinzipien für die indigene Datenverwaltung und ist eine grundlegende Referenz für die Mechanismen der Datensouveränität in champollion.

### Das Muster: Sprache als Ziel kolonialer Macht

Die geografischen und kulturellen Besonderheiten unterscheiden sich, aber das Muster ist bemerkenswert konsistent. In ganz Kanada, den Vereinigten Staaten, Australien, Skandinavien und Neuseeland — und an vielen anderen Orten, von Taiwan über Sibirien bis zum andinen Hochland — identifizierten koloniale und postkoloniale Staaten indigene Sprachen als Hindernisse für die Assimilation und zielten auf ihre Beseitigung ab. Die Werkzeuge waren überall ähnlich: Kinder aus ihren Familien entfernen, den Gebrauch indigener Sprachen verbieten, Übertretungen bestrafen und die Übernahme der Kolonialsprache belohnen.

Dies war keine historische Fußnote. Die letzte Residential School in Kanada schloss *1996*. Die letzte Indian Boarding School in den Vereinigten Staaten schloss in den *1960er Jahren*. Viele der Menschen, die diese Systeme überlebten, leben noch. Das Trauma ist generationenübergreifend. Und der sprachliche Schaden dauert an: Sprachen, die in der Internatsschulzeit eine Generation von Sprechern verloren, verlieren nun ihre letzten fließend sprechenden Ältesten.

### Vom kulturellen Völkermord zum „Datenmangel"

Diese Geschichte ist direkt relevant für das technische Problem der maschinellen Übersetzung. Wenn Informatiker eine Sprache als „ressourcenarm" beschreiben, meinen sie typischerweise: Es gibt wenige digitale Texte, wenige Parallelkorpora, wenige Wörterbücher und wenige annotierte Datensätze. Die Rahmung ist neutral, als wäre der Datenmangel ein Akt der Natur, wie eine Wüste mit wenig Regen.

Das ist er nicht. Der „Datenmangel" indigener Sprachen ist die *nachgelagerte Folge* der Sprachunterdrückungspolitik. Sprachen, die in Schulen verboten waren, produzierten weniger geschriebene Texte. Sprachen, deren Sprecher für ihren Gebrauch bestraft wurden, entwickelten weniger institutionelle Verwendungen. Sprachen, die eine Generation der Weitergabe verloren, produzierten weniger zweisprachige Sprecher, die Parallelkorpora hätten erstellen können.

Die Pipeline vom kulturellen Völkermord zum Datenmangel ist direkt:

1. **Unterdrückung** → Kinder werden für das Sprechen der Sprache bestraft
2. **Gestörte Weitergabe** → Weniger Kinder lernen die Sprache
3. **Reduzierte Sprecherbasis** → Weniger Erwachsene verwenden sie im täglichen Leben
4. **Reduzierte institutionelle Verwendung** → Weniger geschriebene Dokumente, weniger digitale Texte
5. **Datenmangel** → ML-Modelle haben nichts, worauf sie trainieren können
6. **Keine MÜ-Unterstützung** → Die Sprache ist für die Technologie unsichtbar
7. **Beschleunigter Niedergang** → Technologie verstärkt die Marginalisierung, die die Politik begann

Diese Pipeline bedeutet, dass jedes Technologieprojekt, das mit indigenen Sprachen arbeitet, einen politischen und moralischen Kontext erbt, ob es dies anerkennt oder nicht. Ein maschinelles Übersetzungssystem, das Cree-Sprachdaten als Rohmaterial behandelt, das von Modellen aufgenommen werden soll, setzt, so unbeabsichtigt auch immer, die extraktive Dynamik fort, die mit den Residential Schools begann. Die Daten wurden durch Gewalt knapp gemacht. Die Sprecher, die die vorhandenen Daten schufen, taten dies unter enormen Widrigkeiten. Jedes System, das diese Daten ohne die bedeutungsvolle Kontrolle der Gemeinschaft nutzt, verschlimmert den ursprünglichen Schaden.

### Die Komplizenschaft der Wissenschaften und der westlichen Ideologie

Es ist entscheidend anzuerkennen, dass Wissenschaft und Technologie keine unschuldigen Zuschauer dieses kolonialen Projekts waren; sie waren aktive Teilnehmer. Die „Aufklärungs"-Ideologie, die die Welt kategorisieren, quantifizieren und standardisieren wollte, behandelte indigene Völker und ihre Sprachen oft bloß als Forschungsobjekte oder Kuriositäten für eine „Rettungsanthropologie". Diese extraktive Praxis schloss Wissen in westlichen Universitäten ein, während sie wenig unternahm, um die politische Maschinerie zu stoppen, die diese Gemeinschaften zerstörte.

Dieses Projekt steht in scharfem Kontrast zu Methodologien wie der Tuskegee-Syphilis-Studie oder der extraktiven Sprachanthropologie, die BIPOC-Menschen als Versuchsobjekte oder passive Lieferanten von Rohdaten behandeln. Wir sind nicht hier, um mit indigenen Menschen zu experimentieren, ihr Wissen zu extrahieren oder ihnen eine westlich kulturell monolithische Ideologie aufzuzwingen. Unser Ziel ist es, ihre *eigenen* Wissensweisen und ihre *eigenen* Wertmaßstäbe zu ermöglichen. Wir stellen die Infrastruktur bereit; die Sprachgemeinschaften bauen die Testsätze auf, definieren die Metriken und erhalten die Zustimmung aufrecht. Ohne ihre Zustimmung funktioniert nichts davon.

### Warum diese Geschichte unser Design prägt

Deshalb ist das Governance-Modell von champollion kein Feature — es ist das Fundament. Jede wesentliche Designentscheidung im Projekt ist eine *direkte Reaktion* auf die oben beschriebene Geschichte. Das Ziel ist Datensouveränität: Gemeinschaften dabei zu unterstützen, ihre lebendigen Sprachen vollständig zu ihren eigenen Bedingungen zu erhalten, zu revitalisieren und zu verwalten.

**Warum die Testdaten verschlüsselt sind und von Community-Trusts gehalten werden.** Weil indigene Sprachdaten über ein Jahrhundert lang ohne Einwilligung extrahiert, veröffentlicht und ausgebeutet wurden. Die missionarische Linguistik, wie die Bemühungen des Summer Institute of Linguistics (SIL), monopolisierte historisch indigene Parallelkorpora unter einem extraktiven, assimilatorischen Rahmen. Darüber hinaus verwenden wir im Gegensatz zu vielen modernen NLP-Projekten, die für ressourcenarme Sprachen stark auf übersetzte Bibeln als ihr primäres Parallelkorpus setzen, ausdrücklich keine übersetzten Bibeln als Korpora. Der verschlüsselte Testsatz, dessen Schlüssel nur von der Governance-Organisation der Gemeinschaft gehalten werden, ist ein technischer Mechanismus, der es *architektonisch unmöglich* macht, extraktive Muster zu wiederholen.

**Warum wir sandboxed Ausführung statt offener Testsätze verwenden.** Weil eine Gemeinschaft, sobald sprachliche Daten offen veröffentlicht sind, die Kontrolle darüber dauerhaft verliert. Konventionelle ML-Benchmarks veröffentlichen ihre Testsätze — jeder kann sie herunterladen, auf ihnen trainieren oder sie für jeden Zweck verwenden. Dieses moderne KI-Daten-Scraping stellt eine neue Form des „Datenkolonialismus" und der „digitalen Einhegung" dar. Für Gemeinschaften, deren Sprachen durch Gewalt fast ausgerottet wurden, ist der Verlust der Kontrolle über ihre verbleibenden sprachlichen Ressourcen keine geringfügige Unannehmlichkeit. Es ist eine direkte Fortsetzung der historischen territorialen Enteignung. Die sandboxed Ausführung stellt sicher, dass die Daten der Gemeinschaft niemals ihre Infrastruktur verlassen.

**Warum die Methodeneigentümerschaft auf die Gemeinschaft übergeht.** Weil die Geschichte des „Helfens" indigener Gemeinschaften überwältigend eine Geschichte von Außenstehenden ist, die Dinge *über* indigene Menschen bauen, anstatt *für* oder *mit* ihnen. Akademische Arbeiten werden veröffentlicht, Fördermittel werden eingesammelt, Karrieren werden vorangetrieben — und der Gemeinschaft bleibt nichts. Der Mechanismus der Eigentumsübertragung stellt sicher, dass wenn ein ML-Ingenieur eine funktionierende Übersetzungsmethode für das Plains Cree entwickelt, die Plains-Cree-Gemeinschaft *diese Methode besitzt*. Der Ingenieur behält Anerkennung und Zuschreibung. Die Gemeinschaft behält den Vermögenswert.

**Warum alles, was eine gemeinschaftseigene Methode erwirtschaftet, vollständig der Gemeinschaft gehört.** Weil Sprachrevitalisierung teuer ist und die Gemeinschaften, die die härteste Arbeit leisten — die lehrenden Ältesten, die Eltern, die Kinder auf Immersionsschulen schicken, die Aktivisten, die Sprachnester betreiben — chronisch unterfinanziert sind. Darüber hinaus fordert die KI-Infrastruktur, die wir selbst verwenden (z. B. Rechenzentren, Mineralienabbau, Wasserverbrauch), einen unverhältnismäßigen materiellen Tribut von indigenen Ländern weltweit. Champollion ist ein nicht-kommerzielles Projekt und erhebt keinen Anspruch auf irgendetwas davon: Wenn eine Cree-Übersetzungsmethode jemals Wert erzeugt, sollte dieser Wert Cree-Sprachprogramme finanzieren. Technologie sollte ein Werkzeug sein, das Gemeinschaften dient, kein Mechanismus, der Wert aus ihnen extrahiert.

**Warum wir „souveränitätsanstrebend“ sagen, statt Konformität zu behaupten.** Indigene Datensouveränitäts-Frameworks wurden von bestimmten Völkern für bestimmte Kontexte entwickelt — die Datensouveränitätsprinzipien der First Nations in Kanada, CARE (Collective Benefit, Authority to Control, Responsibility, Ethics), Te Mana Raraunga (Māori Data Sovereignty) und die FAIR-Prinzipien adressieren diese Anliegen jeweils aus unterschiedlichen kulturellen und rechtlichen Positionen. Wir behaupten nicht, eines davon vollständig umzusetzen; diese Entscheidung obliegt den Gemeinschaften, die sie verfasst haben. Wir sagen, unser Design ist *souveränitätsanstrebend* — so aufgebaut, dass Gemeinschaften Eigentum, Kontrolle, Zugang und Besitz über ihre Daten und die daraus abgeleiteten Technologien ausüben *können*. Die Architektur strebt nach Souveränität; ob sie Souveränität erreicht, müssen die Gemeinschaften entscheiden. Wir betrachten dies als unvollendete Arbeit, begrüßen Einwände und werden entsprechend darauf reagieren.

**Warum die Plattform *Methoden* statt *Modelle* benchmarkt.** Weil indigene Sprachgemeinschaften nicht vom Modell eines einzelnen Konzerns abhängig sein sollten. Die offene Architektur einer „Methode" bedeutet, dass die Lösung nicht einmal ein kostspieliges, materialintensives LLM sein muss. Es könnte ein hocheffizientes, von der Gemeinschaft gehostetes regelbasiertes System sein, das auf traditioneller Rechenhardware läuft. Wenn die beste Übersetzungsmethode für Cree heute Googles Gemini verwendet, sollte die Gemeinschaft morgen zu einer Open-Source- oder deterministischen Alternative wechseln können, ohne alles neu aufzubauen. Das Benchmarking auf Methodenebene stellt sicher, dass der Vermögenswert der Gemeinschaft ein *Rezept* ist, keine Abhängigkeit.

**Warum die Gemeinschaft diese Infrastruktur jetzt aufbauen muss.** Das Paradoxon, KI zu nutzen und gleichzeitig ihre materielle Extraktion zu kritisieren, wird durch eine harte strategische Realität aufgelöst: Wenn dieses Problem nicht von der Gemeinschaft zu ihren eigenen souveränen Bedingungen gelöst wird, wird es unweigerlich von anderen zu extraktiven Bedingungen „gelöst" werden. Selbst wenn ein riesiger Konzern schließlich ein Übersetzungsmodell für eine bestimmte indigene Sprache baut, benötigt die Gemeinschaft ihre eigene unabhängige, sandboxed Benchmarking-Infrastruktur, um zu verifizieren, *wann* und *ob* sie gemäß den Standards der Gemeinschaft tatsächlich erfolgreich waren — und um sicherzustellen, dass die Gemeinschaft den Wert dieses Erfolgs erfasst.

Dies ist keine Politik, die auf Technologie aufgeschraubt wird. Es ist Technologie, die von Menschen entworfen wurde, die die Geschichte verstehen.

---

## VI. Der gegenwärtige Moment: 6.800 zurückgelassene Sprachen

### Das Ausmaß des Problems

Von den rund 7.000 lebenden Sprachen, die heute auf der Erde gesprochen werden, verfügen nur etwa 550 über irgendeine Form der maschinellen Übersetzung — und kaum 200 werden von einem bereitgestellten kommerziellen Dienst abgedeckt ([wie wir zählen](/docs/network/context/coverage-counting)). Der Rest ist für die Technologie unsichtbar — nicht weil sie weniger wertvoll sind, sondern weil die statistischen und neuronalen Ansätze, die die moderne maschinelle Übersetzung dominieren, grundlegend *datenhungrig* sind. Sie benötigen Millionen von parallelen Sätzen, um daraus zu lernen. Für die meisten Sprachen der Welt existieren diese Sätze nicht.

Die am stärksten betroffenen Sprachen sind gerade jene, die am stärksten gefährdet sind: indigene Sprachen, Minderheitensprachen, mündliche Traditionen mit begrenzten schriftlichen Aufzeichnungen. Dies sind Sprachen, deren Sprecher oft alt sind, deren Gemeinschaften klein sind, deren politische Macht minimal ist. Sie sind die Sprachen, die am dringendsten technologische Unterstützung für Erhaltung und Revitalisierung benötigen — und sie sind die Sprachen, für die die bestehende Technologie am wenigsten nützlich ist.

### Die polysynthetische Herausforderung

Das Problem ist nicht bloß eines des Datenmangels. Viele der am stärksten gefährdeten Sprachen der Welt sind *polysynthetisch* — sie haben morphologische Systeme von außerordentlicher Komplexität, die die Annahmen der standardmäßigen NLP grundlegend brechen.

Betrachten Sie das Plains Cree (nêhiyawêwin), eine Algonkin-Sprache, die in den kanadischen Prärien gesprochen wird. Ein einzelnes Cree-Verb kann Informationen kodieren, die das Englische über einen ganzen Satz verteilen würde: das Subjekt, das Objekt, das Tempus, den Aspekt, die Evidentialität, die Modalität und verschiedene andere grammatikalische Kategorien, alle durch ein System von Präfixen, Suffixen und internen Modifikationen in ein einziges Wort gepackt.

Dies schafft mehrere Probleme für standardmäßige MÜ-Ansätze:

1. **Tokenisierungsversagen.** Subword-Tokenizer wie BPE (Byte Pair Encoding), entworfen für analytische Sprachen wie das Englische, zerschmettern polysynthetische Wörter in bedeutungslose Fragmente. Die morphologische Struktur wird zerstört, bevor das Modell sie jemals sieht. BPE ist nicht neutral; es repräsentiert eine rein empiristische Epistemologie auf Oberflächenebene, die grundlegend mit den tiefen, regelbasierten morphologischen Hierarchien kollidiert, die polysynthetischen Sprachen innewohnen. Es ist eine architektonische Voreingenommenheit, die strukturelle Morphologie aktiv demontiert.

2. **Kombinatorische Explosion.** Eine polysynthetische Sprache kann Millionen möglicher Wortformen für eine einzige Verbwurzel haben. Kein Trainingskorpus, wie groß auch immer, kann mehr als einen winzigen Bruchteil davon enthalten. Neuronale Modelle haben keine Möglichkeit, auf ungesehene Formen zu *verallgemeinern*.

3. **Halluzination.** Große Sprachmodelle erzeugen, wenn sie gebeten werden, in polysynthetische Sprachen zu übersetzen, oft morphologisch ungültige Formen — Wörter, die kein Muttersprachler jemals produzieren würde. Das Modell hat statistische Muster aus begrenzten Daten gelernt, hat aber kein Verständnis der morphologischen Regeln der Sprache.

### Finite-State-Transducer: Die Brücke

Es gibt jedoch eine Technologie, die morphologische Komplexität gut bewältigt: den **Finite-State-Transducer** (FST). Ein FST ist ein formales rechnerisches Gerät, das durch eine Reihe von Zustandsübergängen zwischen einer Eingabezeichenkette und einer Ausgabezeichenkette abbildet. Für die morphologische Analyse kann ein FST eine Oberflächenwortform auf ihre zugrunde liegende morphologische Struktur (und umgekehrt) abbilden und die volle kombinatorische Komplexität der Morphologie der Sprache bewältigen.

FSTs sind die direkten Nachfahren von Pāṇinis Umschreibungsregeln. Sie sind Chomskys Typ-3-Grammatiken (regulär) in rechnerischer Form. Sie sind die lebendige Verkörperung der Verbindung zwischen formaler Linguistik und Berechnung.

Bei der Kombination von FSTs mit LLMs vollzieht `champollion` eine entscheidende philosophische Synthese: Es versöhnt die *rationalistische* strukturelle Tradition (Regeln) mit dem *empiristischen* statistischen Paradigma (Wahrscheinlichkeit), um den datenhungrigen, majoritären Voreingenommenheiten der modernen KI entgegenzuwirken.

Für polysynthetische Sprachen können FSTs etwas bereitstellen, das neuronale Modelle nicht können: *deterministische Verifikation*. Gegeben eine Wortform, kann ein FST definitiv sagen, ob es eine gültige Form in der Sprache ist — nicht probabilistisch, nicht „das sieht richtig aus", sondern *ja* oder *nein*. Dies ist die Antwort auf die zentrale Frage, die die neuronale MÜ für ressourcenarme Sprachen heimsucht: *Wie verifiziert man, dass ein erzeugtes Wort echt ist, ohne einen Menschen in der Schleife?*

Die technische Antwort lautet: Man verwendet die formale Grammatik. Man verwendet ausgerechnet die Werkzeuge, die Pāṇini vor fünfundzwanzig Jahrhunderten erfand, kodiert in dem rechnerischen Formalismus, den Turing und Chomsky rigoros machten.

Wir müssen jedoch anerkennen, dass diese deterministische Macht ihre eigenen Risiken birgt. Das Durchsetzen einer „Ja"- oder „Nein"-Validierung auf eine mündliche, fließende Sprache riskiert, eine starre Standard-Sprachideologie aufzuzwingen. Wenn ein FST diktiert, was „korrekt" ist, kann er unbeabsichtigt genau die koloniale Normativität rekapitulieren, der zu entkommen er entworfen wurde — indem er dialektale Variation einebnet, Code-Switching bestraft und eine einzelne, normierte Grammatik einer vielfältigen Gemeinschaft aufzwingt. Da FSTs nur eine Metrik der formalen Korrektheit darstellen, muss ihr starrer Empirismus gemildert werden. Genau deshalb muss die Gemeinschaft die Feder halten. Die Gemeinschaft setzt den Standard, baut die Regeln und definiert, was die Maschine als gültig akzeptiert, indem sie FSTs entwickelt, die Raum für mündliche Fließbarkeit und regionale Dialekte schaffen. Die formale Grammatik ist keine universelle Wahrheit, die von Informatikern verkündet wird; sie ist eine Infrastruktur, die von den Sprechern selbst betrieben wird.

### champollion: Wo die Stränge konvergieren

Hier tritt das champollion-Projekt in die Geschichte ein. Es sitzt am genauen Konvergenzpunkt aller Stränge, die wir verfolgt haben:

- **Von Pāṇini**: Das Prinzip, dass Sprache durch formale, generative Regeln beschrieben werden kann.
- **Von Schleicher und Sapir**: Das Verständnis, dass die Sprachen der Welt vielfältig, strukturiert und oft gefährdet sind.
- **Von den Residential Schools und ihren Folgen**: Das Verständnis, dass „Datenmangel" keine neutrale technische Tatsache ist, sondern die Folge bewusster Sprachunterdrückung — und dass jede Technologie, die diese Sprachen berührt, mit Souveränität als Fundament gebaut werden muss.
- **Von Chomsky**: Die formale Hierarchie der Grammatiken, die die Linguistik mit der Berechnung verbindet.
- **Von Shannon**: Der mathematische Rahmen zum Verständnis von Kommunikation, Rauschen und Signal.
- **Von Turing und von Neumann**: Die universellen Maschinen, die jede berechenbare Funktion ausführen können.
- **Von Weaver und den IBM-Modellen**: Die Erkenntnis, dass Übersetzung als statistisches Problem behandelt werden kann.
- **Von der Transformer-Revolution**: Die leistungsstarken neuronalen Modelle, die übersetzen können — aber nur, wenn sie genügend Daten haben.
- **Von der FST-Tradition**: Die formalen Werkzeuge, die morphologische Komplexität dort bewältigen können, wo neuronale Modelle versagen.
- **Von indigenen Datensouveränitäts-Frameworks — CARE, Te Mana Raraunga und verwandten**: Die Governance-Rahmen, die sicherstellen, dass Technologie Gemeinschaften dient, anstatt aus ihnen zu extrahieren.

champollion ist eine Plattform, die entworfen wurde, um die wettbewerbsorientierte Energie der Machine-Learning-Gemeinschaft auf Sprachen zu lenken, die der Markt aufgegeben hat. Sie stellt eine Benchmarking-Infrastruktur bereit, in der jeder eine Übersetzungsmethode einreichen kann — neuronal, regelbasiert, hybrid oder neuartig — und sie an rigorosen Standards bewerten lassen kann. Entscheidend ist, dass sie FST-basierte Validierung verwendet, um sicherzustellen, dass erzeugte Formen morphologisch gültig sind, und dass sie sich auf die Verifikation durch Muttersprachler als ultimative Grundwahrheit stützt.

Die Plattform verkörpert mehrere Prinzipien, die diese Geschichte deutlich macht:

**Kein einzelner Ansatz ist ausreichend.** Die Geschichte der MÜ ist eine Geschichte der Paradigmenwechsel — von Regeln zu Statistik zu neuronalen Netzen. Jedes neue Paradigma löste Probleme, die das vorherige nicht konnte, aber jedes hatte auch blinde Flecken. Für ressourcenarme polysynthetische Sprachen ist die Antwort mit ziemlicher Sicherheit *hybrid*: neuronale Flüssigkeit, eingeschränkt durch formale Korrektheit.

**Datensouveränität ist nicht optional — sie ist eine strukturelle Antwort auf historischen Schaden.** Wie Abschnitt V im Detail dokumentiert, sind indigene Sprachen nicht bloß durch Zufall „datenarm“. Sie wurden durch bewusste politische Maßnahmen dazu gemacht. Das souveränitätsanstrebende Design des Projekts — das sicherstellt, dass Sprachdaten unter der Kontrolle indigener Gemeinschaften bleiben, dass Entschlüsselungscodes von Gemeinschaftstreuhändern verwaltet werden und dass das Eigentum an Algorithmen auf die Sprecher übergeht — ist kein nachträglicher Einfall. Es ist eine direkte Antwort auf Jahrhunderte extraktiver Praktiken, von der Dokumentation durch Außenstehende in der Ära der Residential Schools bis hin zum modernen Scraping von Datensätzen.

Eine frühere Version dieses Absatzes besagte, dass die Architektur eine Wiederholung dieser Muster *technisch unmöglich* macht. Das war eine übertriebene Behauptung und sie wurde zurückgezogen. Die Mechanismen sind real und spezifisch — ein Korpus wird auf dem eigenen Gerät des Inhabers verschlüsselt, bevor irgendetwas dieses verlässt, die Entschlüsselung erfordert das gemeinsame Handeln mehrerer Verwahrer anstelle einer einzelnen Partei, und der Korpusinhalt wird von seiner Quelle abgerufen, anstatt hier gehostet zu werden —, aber „unmöglich“ ist keine Eigenschaft, die einer von ihnen beanspruchen kann. Software hat Fehler, Betreiber machen Fehler, und eine entschlossene Partei mit genügend der richtigen Rollen stellt ein Restrisiko dar, das kein Design beseitigt. Die ehrliche Behauptung ist, dass die einfachen Wege verschlossen sind und die schwierigen Beweise hinterlassen. Was dieses Projekt versprechen kann, sind Mechanismen und Offenlegung, keine Unmöglichkeit.

**Das langfristige Ziel ist Revitalisierung.** Übersetzung ist das *Erprobungsfeld*, aber der wahre Preis ist die Sprachrevitalisierung durch Lehre. Die formalen Grammatiken und morphologischen Modelle, die für die maschinelle Übersetzung gebaut werden, sind genau die technischen Grundlagen, die für maschinengestütztes Sprachenlernen benötigt werden. Wenn wir einen FST bauen können, der Cree-Verbformen für ein Übersetzungssystem validiert, können wir denselben FST auch verwenden, um einem Schüler zu helfen, Cree-Verben zu konjugieren.

### Warum dieser Moment

Wir leben in einem einzigartigen Moment in der Geschichte der Sprachtechnologie. Mehrere Faktoren sind konvergiert:

1. **Open-Source-Werkzeuge sind ausgereift.** Die FST-Toolkits (wie HFST und Foma), die neuronalen MÜ-Frameworks (wie OpenNMT und Fairseq) und die Bewertungsinfrastruktur können nun von einem kleinen Team zu minimalen Kosten zusammengesetzt werden.

2. **Gemeinschaftsorganisation beschleunigt sich.** Indigene Sprachgemeinschaften werden zunehmend versiert in ihrer Nutzung von Technologie und ihrer Behauptung von Datensouveränität. Organisationen wie die First-Voices-Initiative, das Canadian Indigenous Languages Technology Project und zahlreiche gemeinschaftsgeführte Bemühungen bauen die menschliche Infrastruktur auf, die Technologie allein nicht bereitstellen kann.

3. **KI-Fähigkeiten haben eine Schwelle erreicht.** Große Sprachmodelle können, obwohl sie für sich allein für die ressourcenarme MÜ unzureichend sind, als leistungsstarke Komponenten in hybriden Systemen dienen — indem sie Kandidatenübersetzungen erzeugen, die dann durch formale Methoden verifiziert und eingeschränkt werden.

4. **Die Kosten sind eingebrochen.** Was 1954 ein Regierungslabor oder 2000 einen großen Konzern erfordert hätte, kann nun mit Cloud-Computing-Guthaben und Open-Source-Software erledigt werden. Der Engpass ist nicht mehr Technologie oder Geld. Es ist der *Wille*.

Die Frage ist nicht, ob die Technologie gebaut werden kann. Sie kann es. Die Frage ist, ob sie *korrekt* gebaut werden wird — mit der richtigen Governance, den richtigen Anreizen und dem richtigen Respekt für die Gemeinschaften, denen sie dienen soll.

Das ist die Frage, zu deren Beantwortung dieses Projekt existiert.

---

## Referenzen

- Bahdanau, D., Cho, K., & Bengio, Y. (2015). Neural Machine Translation by Jointly Learning to Align and Translate. *ICLR*.
- Boole, G. (1854). *An Investigation of the Laws of Thought*. Walton and Maberly.
- Bringing Them Home: Report of the National Inquiry into the Separation of Aboriginal and Torres Strait Islander Children from Their Families. (1997). Australian Human Rights Commission.
- Brown, P., Della Pietra, S., Della Pietra, V., & Mercer, R. (1993). The Mathematics of Statistical Machine Translation. *Computational Linguistics*, 19(2).
- Campbell, L. (1997). *American Indian Languages: The Historical Linguistics of Native America*. Oxford University Press.
- Champollion, J.-F. (1822). *Lettre à M. Dacier relative à l'alphabet des hiéroglyphes phonétiques*.
- Chomsky, N. (1957). *Syntactic Structures*. Mouton.
- Chomsky, N. (1956). Three Models for the Description of Language. *IRE Transactions on Information Theory*, 2(3).
- Huet, G. (2006). Lexicon-directed Segmentation and Tagging of Sanskrit. In *Proceedings of the XIIth World Sanskrit Conference*.
- Jones, W. (1786). The Third Anniversary Discourse. *Asiatick Researches*, 1.
- Kiparsky, P. (1993). Paninian Linguistics. In R. E. Asher (Ed.), *The Encyclopedia of Language and Linguistics*. Pergamon.
- Kircher, A. (1663). *Polygraphia Nova et Universalis*.
- Leibniz, G. W. (1703). Explication de l'Arithmétique Binaire. *Mémoires de l'Académie Royale des Sciences*.
- Llull, R. (c. 1305). *Ars Magna*.
- Lovelace, A. (1843). Notes by the Translator (Note G). In L. F. Menabrea, *Sketch of the Analytical Engine Invented by Charles Babbage*.
- Marmion, D., Obata, K., & Troy, J. (2014). *Community, Identity, Wellbeing: The Report of the Second National Indigenous Languages Survey*. Australian Institute of Aboriginal and Torres Strait Islander Studies.
- National Research Council. (1966). *Language and Machines: Computers in Translation and Linguistics* (ALPAC Report). National Academy of Sciences.
- Papineni, K., Roukos, S., Ward, T., & Zhu, W.-J. (2002). BLEU: A Method for Automatic Evaluation of Machine Translation. *ACL*.
- Saussure, F. de. (1916). *Cours de linguistique générale* (C. Bally & A. Sechehaye, Eds.). Payot.
- Schleicher, A. (1861). *Compendium der vergleichenden Grammatik der indogermanischen Sprachen*.
- Shannon, C. E. (1948). A Mathematical Theory of Communication. *Bell System Technical Journal*, 27(3).
- Shannon, C. E. (1951). Prediction and Entropy of Printed English. *Bell System Technical Journal*, 30(1).
- Sutskever, I., Vinyals, O., & Le, Q. V. (2014). Sequence to Sequence Learning with Neural Networks. *NeurIPS*.
- Truth and Reconciliation Commission of Canada. (2015). *Honouring the Truth, Reconciling for the Future: Summary of the Final Report*. Government of Canada.
- Turing, A. M. (1936). On Computable Numbers, with an Application to the Entscheidungsproblem. *Proceedings of the London Mathematical Society*, 2(42).
- Turing, A. M. (1950). Computing Machinery and Intelligence. *Mind*, 59(236).
- Vaswani, A., et al. (2017). Attention Is All You Need. *NeurIPS*.
- von Neumann, J. (1945). *First Draft of a Report on the EDVAC*. University of Pennsylvania.
- Weaver, W. (1949). Translation. Memorandum, Rockefeller Foundation.
- Wilkins, J. (1668). *An Essay towards a Real Character, and a Philosophical Language*. Royal Society.
- U.S. Department of the Interior. (2022). *Federal Indian Boarding School Initiative Investigative Report*. Bureau of Indian Affairs.

---

*Dieses Dokument ist Teil der Dokumentation des champollion-Projekts. Es wird unter derselben Lizenz veröffentlicht wie das Projekt selbst.*

## Wohin dies auf dieser Website führt

Die Geschichte endet dort, wo dieses Projekt beginnt: Die meisten lebenden Sprachen stehen immer noch
außerhalb der Technologie. [Was Champollion ist](/docs/what-is-champollion)
legt den Plan in fünf Minuten dar, und
[wie die Abdeckung gezählt wird](/docs/network/context/coverage-counting) zeigt
genau, wo die heutige Grenze verläuft.
