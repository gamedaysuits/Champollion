---
sidebar_position: 3
title: "Das Unermessliche messen"
---

# Das Unermessliche messen: Das Bewertungsproblem in der maschinellen Übersetzung

**Ein Überblick darüber, wie das Fachgebiet die Übersetzungsqualität misst, wo es scheitert und was LYSS (Linguistically-informed Yield & Structural Scoring) als Alternative bietet**

---

> *„Automatische Metriken sind eine bequeme Lüge. Sie liefern uns eine Zahl, und die Zahl erlaubt es uns, ein Paper zu schreiben, und das Paper erlaubt es uns, Fortschritt zu behaupten. Ob tatsächlich Fortschritt stattgefunden hat, ist eine andere Frage."*
> — Angelehnt an eine wiederkehrende Stimmung bei den WMT Metrics Shared Tasks

---

## Einführung

Die maschinelle Übersetzung hat ein Messproblem.

Das Fachgebiet hat zwei Jahrzehnte damit verbracht, zunehmend ausgefeilte Systeme zu entwickeln — von Phrasentabellen über Attention-Mechanismen bis hin zu Sprachmodellen mit Billionen von Parametern — und während dieses gesamten Verlaufs hat es mit einer trügerisch einfachen Frage gerungen: *Woher weiß man, ob eine Übersetzung gut ist?*

Diese Frage ist nicht akademisch. Die Metrik, die Sie wählen, bestimmt, welches System „gewinnt". Sie bestimmt, was finanziert, was veröffentlicht, was eingesetzt wird und — für die Sprachen, die MT am dringendsten benötigen — ob die Übersetzungen einer Gemeinschaft als Fehler beurteilt werden, obwohl sie in Wirklichkeit korrekt sind.

Die Geschichte der MT-Bewertung ist im Kleinen eine Geschichte der Werte des Fachgebiets. Die nahezu zwei Jahrzehnte währende Dominanz von BLEU offenbart eine Vorliebe für billige, schnelle, sprachunabhängige Messung gegenüber linguistisch fundierter Bewertung. Der Aufstieg neuronaler Metriken wie COMET spiegelt die wachsende Ausgereiftheit des Fachgebiets wider — und seine fortdauernde Abhängigkeit von englischzentrierten Trainingsdaten. Das nahezu vollständige Fehlen morphologiebewusster Bewertung spiegelt ein Fachgebiet wider, das bis vor Kurzem von und für Sprecher analytischer europäischer Sprachen aufgebaut wurde.

Dieses Paper zeichnet die Entwicklung der MT-Bewertung von BLEU bis heute nach, identifiziert, wo bestehende Ansätze für morphologisch komplexe und ressourcenarme Sprachen systematisch versagen, und untersucht, wie eine linguistisch fundierte Alternative aussehen könnte. Es ist ein Begleitdokument zu den anderen Kontextdokumenten des Projekts — [*From Pāṇini to Transformers*](./history-of-language-and-computation.md) (das die geistesgeschichtliche Entwicklung von Sprache und Computation nachzeichnet) und das [*Field Briefing*](./mt-field-briefing.md) (das die aktuelle MT-Landschaft überblickt). Wo jene Dokumente fragen „Wie sind wir hierher gekommen?" und „Was existiert?", fragt dieses: „Woher wissen wir, ob irgendetwas davon funktioniert?"

---

## Teil 1: Die Ära des String-Matchings (2002–2015)

### BLEU und die Geburt der automatischen Bewertung



Die moderne Ära der MT-Bewertung beginnt mit einem einzigen Paper: Kishore Papineni, Salim Roukos, Todd Ward und Wei-Jing Zhus „BLEU: a Method for Automatic Evaluation of Machine Translation", veröffentlicht auf der ACL 2002. BLEU (Bilingual Evaluation Understudy) misst, wie stark die Wortsequenzen (n-Gramme) einer maschinellen Übersetzung mit einer oder mehreren menschlichen Referenzübersetzungen überlappen. Es beinhaltet eine Kürzestrafe (Brevity Penalty), um zu verhindern, dass Systeme den Score durch kurze Ausgaben manipulieren, und es berechnet ein geometrisches Mittel der n-Gramm-Präzisionen der Ordnungen 1 bis 4.

BLEU wurde aus einem einfachen Grund zur Währung des Fachgebiets: Es war schnell, billig, reproduzierbar und sprachunabhängig. Vor BLEU erforderte die Bewertung eines MT-Systems eine teure, langsame menschliche Begutachtung. BLEU bot eine Zahl, die in Millisekunden berechnet, über Paper hinweg verglichen und zur Rangordnung von Systemen in Shared Tasks verwendet werden konnte. Innerhalb weniger Jahre war es im Wesentlichen obligatorisch — ein Paper ohne BLEU-Scores war nicht veröffentlichungsfähig.

Aber BLEU hat tiefe, gut dokumentierte Mängel, die das Fachgebiet zwei Jahrzehnte lang zu umgehen versucht hat:

**Kein semantisches Verständnis.** BLEU ist reines Oberflächen-Matching. „The cat sat on the mat" erzielt null Punkte gegenüber einer Referenz „the feline rested on the rug". Jedes Wort ist ein korrektes Synonym; die Bedeutung ist identisch; der Score ist null.

**Morphologische Blindheit.** Für agglutinierende und polysynthetische Sprachen versagt striktes Matching auf Wortebene katastrophal. Ein korrekt konjugiertes Cree-Verb, das sich um ein Morphem von der Referenz unterscheidet, erzielt null Punkte — selbst wenn der Unterschied eine grammatisch optionale Partikel oder eine ebenso valide Wortstellung ist.

**Schlechte Diskriminierung auf Satzebene.** BLEU wurde als korpusbasierte Metrik konzipiert. Auf Satzebene ist es verrauscht und unzuverlässig — wird aber routinemäßig auf einzelne Sätze angewendet.

**Bias durch Einzelreferenz.** BLEU geht davon aus, dass es *eine* korrekte Übersetzung (oder eine kleine Menge von Referenzen) gibt. Für Sprachen mit freier Wortstellung, synonymreichem Vokabular oder systematischen Mehrdeutigkeiten (wie Crees inklusivem/exklusivem „wir") kann es Dutzende ebenso korrekter Übersetzungen geben, und BLEU bestraft alle bis auf diejenige, die zufällig mit der Referenz übereinstimmt.

**Schwache Korrelation mit menschlichem Urteil.** Metaanalysen — insbesondere Reiter (2018, *Computational Linguistics*) — haben gezeigt, dass die Korrelation von BLEU mit menschlichen Qualitätsbewertungen oft schwach ist, insbesondere für hochwertige Systeme und für Sprachen, die weit vom Englischen entfernt sind.

Diese Mängel waren fast von Anfang an bekannt. Dennoch hielt sich BLEU, weil die Alternativen schlechter waren — nicht in der Genauigkeit, sondern in der Bequemlichkeit. Das Fachgebiet optimierte für die Metrik, die es berechnen konnte, nicht für die Metrik, die es benötigte.

### NIST (Doddington, 2002)

Die NIST-Metrik, im selben Jahr wie BLEU von George Doddington auf der HLT 2002 veröffentlicht, modifizierte die BLEU-Formel auf zwei Arten. Erstens gewichtete sie n-Gramme nach ihrem **Informationsgehalt** — seltene n-Gramme erhielten ein höheres Gewicht als häufige, gestützt auf die Intuition, dass die korrekte Übersetzung einer ungewöhnlichen Phrase informativer ist als die korrekte Übersetzung von „of the". Zweitens verwendete sie ein **arithmetisches Mittel** anstelle des geometrischen Mittels von BLEU, was stabilere Scores erzeugte, die nicht auf null zusammenbrachen, wenn eine einzelne n-Gramm-Ordnung keine Übereinstimmungen hatte. NIST wurde in den DARPA-TIDES- und NIST-OpenMT-Bewertungsprogrammen umfangreich eingesetzt, erreichte aber nie die Dominanz von BLEU in der breiteren Forschungsgemeinschaft. Trotz seiner Verbesserungen teilte es die grundlegende Beschränkung von BLEU: oberflächliches String-Matching ohne ein Konzept von Bedeutung.

### METEOR (Banerjee & Lavie, 2005)

METEOR (Metric for Evaluation of Translation with Explicit ORdering) war ein früher Versuch, die Starrheit von BLEU zu adressieren. Während BLEU exaktes Wort-Matching durchführt, führte METEOR drei Neuerungen ein:

1. **Stemming**: Wörter werden vor dem Vergleich auf ihre Stämme reduziert, was Teilpunkte für morphologische Varianten vergibt (z. B. stimmt „running" nach dem Stemming mit „ran" überein).
2. **Synonym-Matching**: Mithilfe von WordNet erkennt METEOR, dass „car" und „automobile" dasselbe Konzept sind.
3. **Wort-Alignment**: Anstatt n-Gramm-Überlappungen zu zählen, alignt METEOR explizit Wörter zwischen Hypothese und Referenz und berechnet dann Präzision und Recall mit einer Fragmentierungsstrafe.

METEOR zeigte durchgängig eine höhere Korrelation mit menschlichen Urteilen als BLEU. Aber es erforderte sprachspezifische Ressourcen (Stemmer, Synonymdatenbanken), die seine Anwendbarkeit einschränkten, und seine Berechnung war langsamer. Für Englisch war es besser. Für ressourcenarme Sprachen existierten die Stemmer und Synonymdatenbanken schlicht nicht.

### TER (Snover et al., 2006)

Translation Edit Rate misst die minimale Anzahl von Bearbeitungen (Einfügungen, Löschungen, Ersetzungen und *Phrasenverschiebungen*), die nötig sind, um die Hypothese in die Referenz zu transformieren, normalisiert durch die Referenzlänge. Die Phrasenverschiebungsoperation — das Verschieben einer zusammenhängenden Wortsequenz an eine andere Position — war ein direktes Eingeständnis, dass die Wortstellung über Sprachen hinweg nicht festgelegt ist. Der auf Editierdistanz basierende Ansatz von TER ist intuitiv (er misst „wie viel Arbeit müsste ein menschlicher Post-Editor leisten?"), erbt aber dieselbe grundlegende Beschränkung: Er vergleicht mit einer einzelnen Referenz und hat kein Konzept von Bedeutung.

### chrF und chrF++ (Popović, 2015; 2017)

Die wichtigste Metrik-Innovation zwischen BLEU und der neuronalen Ära kam von Maja Popović. **chrF** (Character F-Score) misst die Überlappung auf *Zeichenebene* statt auf Wortebene und berechnet die Präzision und den Recall von Zeichen-n-Grammen. **chrF++** fügt Unigramme und Bigramme auf Wortebene wieder hinzu.

Warum dies für morphologisch reiche Sprachen wichtig ist: Matching auf Zeichenebene vergibt *Teilpunkte* für gemeinsame Morpheme. Die Cree-Wörter *nikî-nipâw* („ich schlief") und *kikî-nipâw* („du schliefst") teilen die meisten ihrer Zeichen-n-Gramme, obwohl sie verschiedene Wörter sind. chrF würde erhebliche Teilpunkte vergeben; BLEU würde null vergeben.

chrF++ ist zu einer Standard-Sekundärmetrik bei den WMT Shared Tasks geworden, implementiert in **sacreBLEU** (Post, 2018), und wird weithin als BLEU für morphologisch reiche Sprachen überlegen anerkannt. Aber es bleibt eine String-Matching-Metrik — besser als BLEU, aber grundlegend durch dieselbe Annahme beschränkt, dass Übersetzungsqualität durch Oberflächenform-Überlappung gemessen werden kann.

---

## Teil 2: Die Revolution der neuronalen Metriken (2018–heute)



### Die Erkenntnis: Bewerten lernen

Die String-Matching-Metriken aus Teil 1 teilen eine grundlegende Designentscheidung: Sie sind handgefertigte Formeln. Jemand entschied, dass n-Gramm-Präzision, Zeichenüberlappung oder Editierdistanz ein guter Stellvertreter für Übersetzungsqualität sei, und dann verwendeten alle diese Formel ein Jahrzehnt lang.

Die Revolution der neuronalen Metriken begann mit einer anderen Frage: *Was wäre, wenn wir ein Modell trainieren würden, um Übersetzungsqualität vorherzusagen, so wie wir Modelle zum Übersetzen trainieren?*

### BERTScore (Zhang et al., 2020)

BERTScore, veröffentlicht auf der ICLR 2020 von Tianyi Zhang und Kollegen an der Cornell University und am MIT, war die erste weit verbreitete Metrik, die die Bewertung vom exakten String-Matching zur semantischen Ähnlichkeit verlagerte. Der Mechanismus ist elegant: Sowohl die Hypothese als auch die Referenz werden durch ein vortrainiertes Transformer-Modell (BERT, RoBERTa oder DeBERTa) kodiert, die Kosinus-Ähnlichkeit zwischen jedem Paar von Token-Embeddings wird berechnet, und dann wird mittels Greedy-Matching die Präzision (die beste Übereinstimmung jedes Hypothesen-Tokens in der Referenz), der Recall (die beste Übereinstimmung jedes Referenz-Tokens in der Hypothese) und der F1-Wert berechnet.

BERTScore behandelt Synonyme, Paraphrasen und Wortstellungsvarianten auf natürliche Weise — „the feline rested on the rug" erhält eine hohe Ähnlichkeit zu „the cat sat on the mat", weil die kontextuellen Embeddings semantische Äquivalenz erfassen. Mit mehrsprachigem BERT lässt es sich auf jede Sprache erweitern, die das Modell abdeckt.

Aber BERTScore wird nicht *auf* menschlichen Qualitätsurteilen trainiert. Es verwendet vortrainierte Embeddings unverändert, was bedeutet, dass es allgemeine semantische Ähnlichkeit erfasst, anstatt spezifisch zu lernen, was eine *Übersetzung* gut macht. Diese Unterscheidung ist wichtig: Ein Satz kann einer Referenz semantisch ähnlich sein und dennoch eine schlechte Übersetzung sein (falsches Register, ausgelassene Verneinung, halluzinierte Näherbestimmung). BERTScore erbt zudem jegliche Sprach-Bias, die im zugrunde liegenden Modell vorhanden sind — für Sprachen, die in den Trainingsdaten von BERT unterrepräsentiert sind, erfassen die Embeddings möglicherweise keine bedeutsamen Unterscheidungen.

### BLEURT (Sellam et al., 2020)

BLEURT (Bilingual Evaluation Understudy with Representations from Transformers), veröffentlicht auf der ACL 2020 von Thibault Sellam, Dipanjan Das und Ankur Parikh bei Google, führte eine zentrale Neuerung ein: **Vortraining auf synthetischen Perturbationen** vor dem Fine-Tuning auf menschlichen Urteilen. Die Erkenntnis war, dass das direkte Fine-Tuning eines Sprachmodells auf den kleinen WMT-Datensätzen menschlicher Urteile eine Metrik erzeugte, die brüchig war — sie überangepasste sich an die spezifischen Muster in den Trainingsdaten und versagte bei Eingaben außerhalb der Verteilung.

BLEURTs Lösung war ein zweiphasiges Trainingsrezept. In Phase eins wurden Millionen synthetischer Satzpaare durch zufällige Wortauslassungen, Einfügungen, Ersetzungen und Rückübersetzung erzeugt. Das Modell wurde darauf trainiert, bestehende automatische Metrik-Scores (BLEU, ROUGE, BERTScore, Entailment) für diese Paare vorherzusagen — und lernte dabei allgemeine Begriffe von Textähnlichkeit. In Phase zwei wurde das vortrainierte Modell auf WMT-Direct-Assessment-Bewertungen fine-getuned. Dieses „Aufwärmen" verbesserte die Robustheit dramatisch.

BLEURT-20 erweiterte den Ansatz auf mehrsprachige Bewertung unter Verwendung von Googles RemBERT-Encoder. Aber BLEURT bleibt referenzbasiert — es verwendet den Quelltext nicht, was bedeutet, dass es keine Halluzinationen erkennen kann, die zufällig flüssig sind, und es hängt vollständig von der Qualität der Referenz ab.

### COMET (Rei et al., 2020)

COMET (Crosslingual Optimized Metric for Evaluation of Translation) repräsentiert den aktuellen Stand der Technik in der automatischen MT-Bewertung. Entwickelt von Ricardo Rei und Kollegen bei **Unbabel**, verwendet COMET einen sprachübergreifenden Encoder (XLM-RoBERTa), um drei Eingaben — den Quellsatz, die MT-Hypothese und die Referenzübersetzung — zu kodieren und sagt einen Qualitäts-Score vorher, der auf menschlichen Direct-Assessment-Urteilen trainiert ist.

COMET gewann oder belegte ab 2020 den ersten Platz bei den WMT Metrics Shared Tasks. Seine Korrelation mit menschlichem Urteil ist wesentlich höher als bei jeder String-Matching-Metrik. Es erkennt Paraphrasen, erfasst Bedeutungserhaltung und behandelt Synonymvarianz, die BLEU völlig entgeht.

Aber COMET hat für unsere Zwecke eine entscheidende Beschränkung: Es wird auf menschlichen Urteilen von WMT trainiert, die überwiegend in europäischen Sprachen vorliegen. Sein sprachübergreifender Encoder (XLM-R) wurde auf CommonCrawl-Daten trainiert, in denen Plains Cree, Nordsamisch und die meisten indigenen Sprachen im Wesentlichen fehlen. Für diese Sprachen sind die internen Repräsentationen von COMET unzuverlässig — es mag Scores erzeugen, aber diese Scores sind in keinerlei echtem Verständnis der Struktur der Sprache verankert.

### xCOMET (Guerreiro et al., 2024)

xCOMET, veröffentlicht in TACL 2024 von Nuno Guerreiro, Ricardo Rei und Kollegen bei Unbabel und am Instituto Superior Técnico, erweiterte COMET von einem Black-Box-Bewerter zu einem **Diagnosewerkzeug**. Die zentrale Neuerung ist Multi-Task-Learning: Neben dem Qualitäts-Score auf Satzebene führt xCOMET eine **Sequenz-Annotation auf Subword-Ebene** durch, um spezifische Fehlerspannen in der Übersetzung zu identifizieren und sie als geringfügig, schwerwiegend oder kritisch zu klassifizieren.

Dies überbrückt die Lücke zwischen automatischer Bewertung und menschlicher Fehleranalyse im MQM-Stil. Anstatt nur zu berichten „diese Übersetzung erzielt 0,73", kann xCOMET auf die spezifischen Wörter zeigen, die falsch sind, und angeben, wie schwerwiegend. Das Training verwendet einen Curriculum-Learning-Ansatz: zunächst Training auf Direct-Assessment-Daten für die Regression auf Satzebene, dann Hinzufügen von MQM-annotierten Daten mit Fehlerspannen-Labels für gemeinsames Training.

xCOMET erreichte gleichzeitig State-of-the-Art-Leistung bei der Bewertung auf Satz-, System- und Spannenebene. Es funktioniert sowohl im referenzbasierten als auch im referenzfreien Modus. Aber es erfordert MQM-annotierte Trainingsdaten — deren Erstellung teuer ist und die überwiegend für europäische Sprachpaare existieren.

### AfriCOMET (Wang & Adelani, NAACL 2024)

AfriCOMET, veröffentlicht auf der NAACL 2024 von Jiayi Wang, David Ifeoluwa Adelani und Kollegen in der Masakhane-Gemeinschaft, ist der wichtigste Beweis dafür, dass neuronale Metriken für unterversorgte Sprachen angepasst werden *müssen* — sie generalisieren nicht ohne Weiteres.

Das Paper demonstrierte zunächst das Problem: Standard-COMET, trainiert auf WMT-Daten aus europäischen Sprachen, zeigte eine deutlich schwächere Korrelation mit menschlichen Urteilen, wenn es auf 13 afrikanische Sprachen (darunter Amharisch, Hausa, Igbo, Swahili, Yoruba und Zulu) angewendet wurde. Die Behebung erforderte zwei Änderungen. Erstens den Ersatz von XLM-R durch **AfroXLM-R**, einen sprachübergreifenden Encoder, der speziell darauf trainiert ist, afrikanische Sprachen besser zu repräsentieren. Zweitens die Erstellung von **AfriMTE**, einem neuen menschlichen Bewertungsdatensatz mit vereinfachten MQM-Richtlinien, die für Nicht-Experten als Annotatoren konzipiert sind — weil es schwierig ist, professionelle bilinguale Übersetzer für diese Sprachen zu finden.

AfriCOMET bewies das Konzept: Eine sprachfamilienspezifische neuronale Metrik kann die generische Version dramatisch übertreffen. Aber es bewies auch die Kosten: Jemand musste AfroXLM-R erstellen, menschliche Urteilsdaten für 13 Sprachen sammeln und ein neues Modell trainieren. Für Plains Cree existiert kein entsprechender Encoder, kein menschlicher Urteilsdatensatz und keine angepasste Metrik. Der AfriCOMET-Weg würde erfordern, all dies von Grund auf zu erstellen — ein mehrjähriges Unterfangen, das gemeinschaftsbasierte menschliche Bewertung und wahrscheinlich einen dedizierten Encoder für die Algonkin-Familie einbezieht.

### GEMBA: LLM-as-Evaluator (Kocmi & Federmann, 2023)

GEMBA (GPT Estimation Metric Based Assessment), veröffentlicht auf der EAMT 2023 von Tom Kocmi und Christian Federmann bei Microsoft, stellte eine radikale Frage: Was wäre, wenn man GPT-4 einfach *fragte*, ob eine Übersetzung gut sei?

Der Ansatz ist entwaffnend einfach. **GEMBA-DA** versorgt das LLM mit Quelle und Hypothese und bittet um eine Qualitätsbewertung auf einer Skala von 0–100. **GEMBA-MQM** liefert drei annotierte Beispiele und bittet das LLM, spezifische Fehlerspannen zu identifizieren, sie nach Typ und Schweregrad zu klassifizieren und einen Score im MQM-Stil zu erzeugen. Kein metrikspezifisches Training ist erforderlich.

Die Ergebnisse waren bemerkenswert: Auf Systemebene erreichte GEMBA eine konkurrenzfähige oder State-of-the-Art-Korrelation mit menschlichen Urteilen. Die Fehlerannotationen von GEMBA-MQM lieferten zwar nicht so zuverlässig wie menschliche Annotatoren, boten aber interpretierbare diagnostische Informationen ohne jegliches spezialisierte Training.

Aber GEMBA wirft ernsthafte Bedenken auf. Es hängt von proprietären Closed-Source-Modellen ab, deren Verhalten sich zwischen API-Versionen ändert. Ergebnisse sind im strengen Sinne nicht reproduzierbar. Es ist im großen Maßstab teuer (API-Kosten für die Bewertung eines vollständigen WMT-Testsets). Und — entscheidend für unsere Zwecke — das Wissen des LLMs über ressourcenarme Sprachen ist ungewiss. GPT-4 versteht die Morphologie von Plains Cree möglicherweise gut genug, um Übersetzungen zu bewerten, oder auch nicht; es gibt keine Möglichkeit, dies ohne Tests zu wissen, und keine Garantie, dass das Verhalten über Modell-Updates hinweg konsistent ist. Kocmi und Federmann selbst rieten davon ab, GEMBA zu verwenden, um Verbesserungen in akademischen Papern zu behaupten, aufgrund der Black-Box-Natur der Bewertung.

### MetricX und der WMT 2024 Metrics Shared Task

**MetricX-24**, entwickelt von Juraj Juraska, Daniel Deutsch, Mara Finkelstein und Markus Freitag bei Google, gewann den WMT 2024 Metrics Shared Task. Aufgebaut auf **mT5** (Multilingual T5, einem Encoder-Decoder-Modell statt des von COMET verwendeten reinen Encoder-Modells XLM-R), beschreitet MetricX einen anderen architektonischen Weg. Es verwendet zweistufiges Fine-Tuning — zunächst auf Direct-Assessment-Daten, dann auf MQM-Scores — mit umfangreicher **synthetischer Datenaugmentierung**, die auf bekannte Fehlermodi der Metrik abzielt (Unterübersetzung, flüssige-aber-falsche Übersetzungen, Halluzinationen).

Das WMT-2024-Findings-Paper mit dem Titel **„Are LLMs Breaking MT Metrics?"** fragte, ob LLM-generierte Übersetzungen das Metrik-Ökosystem zerstört hätten. Die Antwort war ein eingeschränktes Nein: Fine-getunte neuronale Metriken (MetricX-24, COMET-Varianten) blieben effektiv, obwohl LLM-basierte Metriken (GEMBA-Varianten) auf Systemebene überraschende Stärke zeigten. Wesentliche Erkenntnisse:

- **Quelltextbewusste Metriken** (die Quelle + Referenz + Hypothese verwenden) übertrafen durchgängig referenzbasierte Metriken
- **Hybride Modelle**, die aus einer einzigen Architektur heraus sowohl im referenzbasierten als auch im referenzfreien Modus arbeiten, sind die aufkommende Richtung
- Die **Lücke bei ressourcenarmen Sprachen** bleibt bestehen: Alle Metriken schneiden bei unterrepräsentierten Sprachen schlechter ab, und die Lücke verkleinert sich nicht
- **MQM-trainierte Metriken** (die feingranulare Fehlerannotationen verwenden) übertreffen durchgängig DA-trainierte Metriken (die skalare Scores verwenden)

Die Implikationen für die Bewertung ressourcenarmer Sprachen sind klar: Das Fachgebiet konvergiert auf große, trainierte, quelltextbewusste neuronale Metriken als Goldstandard. Diese Metriken erfordern erhebliche Trainingsdaten, Rechenleistung und — entscheidend — menschliche Bewertungsdaten in der Zielsprache. Für Sprachen ohne eine dieser Ressourcen ist die State-of-the-Art-Metrik-Pipeline schlicht nicht anwendbar.

### Das Bias-Problem: Neuronale Metriken und ressourcenarme Sprachen

Die Revolution der neuronalen Metriken war überwiegend ein Phänomen ressourcenreicher Sprachen. Jede trainierte Metrik in den vorhergehenden Abschnitten wurde auf WMT-Daten menschlicher Urteile trainiert, die etwa 20 Sprachpaare abdecken — alle davon unter Beteiligung europäischer Sprachen, des Chinesischen oder des Japanischen. Die zugrunde liegenden Encoder (XLM-R, mT5, InfoXLM) wurden auf CommonCrawl-Daten trainiert, in denen die Repräsentation proportional zur Webpräsenz ist: Englisch dominiert, europäische Sprachen sind gut abgedeckt, und die überwältigende Mehrheit der über 7.000 Sprachen der Welt fehlt faktisch.

Für eine Sprache wie Plains Cree erzeugt dies ein kaskadierendes Versagen:

1. **Keine Trainingsdaten**: Es gibt keine WMT-Daten menschlicher Urteile für Cree-Übersetzungen, also wurde keine Metrik darauf trainiert, sie zu bewerten.
2. **Keine Encoder-Abdeckung**: Das Vokabular von XLM-R wurde auf CommonCrawl aufgebaut, wo Cree-Text verschwindend selten ist. Der Tokenisierer übersegmentiert Cree-Wörter in willkürliche Byte-Fragmente, und die kontextuellen Embeddings für diese Fragmente sind schlecht trainiert.
3. **Keine Validierung**: Niemand hat gemessen, ob COMET, BLEURT oder MetricX bedeutsame Scores für Cree erzeugen. Sie mögen *Zahlen* erzeugen, aber es gibt keinen Beleg dafür, dass diese Zahlen mit der tatsächlichen Übersetzungsqualität korrelieren.
4. **Kein Weg zur Verbesserung**: Der AfriCOMET-Ansatz — einen sprachfamilienspezifischen Encoder bauen, menschliche Bewertungsdaten sammeln, eine neue Metrik trainieren — ist ein mehrjähriges Unterfangen mehrerer Institutionen. Für eine Sprachgemeinschaft von 20.000 Sprechern existiert die Forschungsinfrastruktur, die dies stützen würde, derzeit nicht.

Das Ergebnis ist ein Paradox: Die Sprachen, die MT-Bewertung am dringendsten benötigen (weil ihre MT-Systeme am schwächsten sind und die sorgfältigste Beurteilung benötigen), sind genau die Sprachen, bei denen die besten Bewertungswerkzeuge am unzuverlässigsten sind. Die Antwort des Fachgebiets bestand darin, chrF++ als „ausreichend gute" Alternative zu empfehlen — und es ist besser als BLEU — aber chrF++ ist immer noch eine String-Matching-Metrik, die keine Äquivalenz erkennen kann, keine freie Wortstellung behandeln kann und kein Konzept von morphologischer Validität hat.

---

## Teil 3: Jenseits der Bewertung — Diagnostische und linguistische Evaluierung

### Die Aufteilung in Adäquatheit/Flüssigkeit

Bevor automatische Metriken existierten, verwendete die menschliche Bewertung von MT einen Rahmen mit zwei Dimensionen: **Adäquatheit** (vermittelt die Übersetzung die Bedeutung der Quelle?) und **Flüssigkeit** (ist die Übersetzung grammatikalisch und natürlich in der Zielsprache?). Diese Unterscheidung, kodifiziert in frühen DARPA-MT-Bewertungen und später bei NIST, erkannte etwas an, dessen Wiedererlangung automatische Metriken zwei Jahrzehnte lang versuchen sollten: Übersetzungsqualität ist nicht eindimensional.

Der Adäquatheit/Flüssigkeit-Rahmen geriet in Ungnade, als Direct Assessment (ein einzelner skalarer Score) ihn bei WMT ersetzte. Aber die zugrunde liegende Erkenntnis bleibt entscheidend: Eine Übersetzung kann flüssig, aber falsch sein (Halluzination) oder unflüssig, aber korrekt (morphologische Variante). Kein einzelner Score erfasst beides.

### MQM: Der Goldstandard (Lommel et al., 2014; Freitag et al., 2021)

**Multidimensional Quality Metrics (MQM)** ersetzte Direct Assessment ab 2021 als primäre menschliche Bewertung von WMT. MQM setzt professionelle Übersetzer ein, die spezifische Fehlerspannen markieren, sie nach Typ (Fehlübersetzung, Auslassung, Hinzufügung, Grammatik, Terminologie) und Schweregrad (geringfügig = 1 Punkt, schwerwiegend = 5 Punkte, kritisch = 25 Punkte) klassifizieren. Dies erzeugt sowohl einen Qualitäts-Score als auch verwertbare diagnostische Informationen.

MQM ist das, was einer „korrekten" Bewertungsmethodik am nächsten kommt — es sagt einem nicht nur, *wie schlecht* eine Übersetzung ist, sondern *was genau* schiefgelaufen ist. Aber es erfordert professionelle bilinguale Übersetzer, die für die meisten ressourcenarmen Sprachen nicht in ausreichender Zahl für eine statistisch zuverlässige Bewertung existieren.

### MorphEval: Kontrastive morphologische Bewertung (Burlot & Yvon, 2017)

MorphEval ist die direkteste Vorarbeit für morphologiebewusste MT-Bewertung. Eingeführt von Franck Burlot und François Yvon auf der WMT 2017 und 2018 erweitert, bewertet MorphEval die morphologische *Kompetenz* mithilfe **kontrastiver Testsuiten**.

**Wie es funktioniert:** Die Testsuite besteht aus Satzpaaren in der Quellsprache, die sich um genau einen morphologischen Kontrast unterscheiden — zum Beispiel Singular vs. Plural, Präsens vs. Präteritum, Maskulinum vs. Femininum. Das MT-System übersetzt beide Sätze. Wenn das System den Kontrast in seinen Übersetzungen korrekt vermittelt (z. B. ein Plural-Ziel erzeugt, wenn die Quelle Plural ist, und ein Singular-Ziel, wenn die Quelle Singular ist), wird der Kontrast als korrekt bewertet.

**Abgedeckte Sprachen:** Englisch→Tschechisch, Englisch→Lettisch (v1, WMT 2017); erweitert auf Englisch→Französisch, Englisch→Deutsch, Englisch→Finnisch, Türkisch→Englisch (v2, WMT 2018).

**Wesentliche Erkenntnisse:** MorphEval offenbarte, dass selbst leistungsstärkste neuronale MT-Systeme systematische morphologische Fehler hatten — sie konnten flüssige Ausgaben erzeugen und dabei Tempus, Numerus oder Kasus falsch machen. Diese Fehler waren für BLEU unsichtbar und sogar teilweise für COMET unsichtbar.

**Verfügbarkeit:** Open Source auf GitHub ([franckbrl/morpheval](https://github.com/franckbrl/morpheval), [franckbrl/morpheval_v2](https://github.com/franckbrl/morpheval_v2)).

**Beschränkungen:** MorphEval erfordert gestaltete kontrastive Testsuiten pro Zielsprache, entworfen von Linguisten, die die morphologischen Kontraste dieser Sprache verstehen. Für keine polysynthetische Sprache existieren Testsuiten. Die Methodik prüft auf *Kompetenz* (kann das System diesen Kontrast handhaben?) statt auf *Validität* (hat das System echte Wörter erzeugt?) oder *Äquivalenz* (sind diese zwei verschiedenen Übersetzungen beide korrekt?).

### CheckList: Behaviorales Testen für NLP (Ribeiro et al., ACL 2020)

**CheckList**, veröffentlicht auf der ACL 2020 von Marco Tulio Ribeiro und Kollegen (Gewinner des Best Paper Award), importierte eine Idee aus dem Software Engineering in die NLP-Bewertung: **Unit-Testing**. Anstatt die aggregierte Leistung eines Modells auf einem Benchmark zu bewerten, definiert CheckList eine Matrix von **Fähigkeiten** (Vokabular, Verneinung, Eigennamen, temporales Schlussfolgern, Koreferenz), die mit **Testtypen** gekreuzt werden:

- **Minimum Functionality Tests (MFT)**: Einfache, gezielte Testfälle, die jedes kompetente Modell bestehen sollte.
- **Invariance Tests (INV)**: Perturbationen der Eingabe, die die Ausgabe *nicht* ändern sollten (z. B. sollte das Ändern eines Namens das Sentiment nicht ändern).
- **Directional Expectation Tests (DIR)**: Perturbationen, die die Ausgabe in eine vorhersagbare Richtung ändern *sollten*.

CheckList wurde ursprünglich für Sentiment-Analyse und NLI entworfen, aber das Paradigma ist direkt auf MT anwendbar. Man könnte MFTs für morphologische Phänomene erstellen („erzeugt das System die korrekte Pluralform?"), INV-Tests für freie Wortstellung („ändert das Umordnen der Cree-Wörter die englische Übersetzung?") und DIR-Tests für morphologische Merkmale („ändert das Ändern der Quelle vom Präteritum zum Präsens das Tempus des Ziels?").

Das CheckList-Paradigma ist besonders relevant, weil es formalisiert, was MorphEval intuitiv tut: spezifische Fähigkeiten testen statt aggregierte Scores messen. Die Variantenklassen unseres Linters (WORD_ORDER, ORTHOGRAPHIC, OPTIONAL_PARTICLE usw.) sind faktisch Invarianzregeln — sie definieren Perturbationen, die das Bewertungsurteil nicht ändern sollten.

### Challenge Sets und gezielte Bewertung

Das breitere Paradigma der **Challenge Sets** — gestaltete Testsuiten, die auf spezifische linguistische Phänomene abzielen — ist seit etwa 2017 zu einer etablierten ergänzenden Bewertungsmethodik bei WMT geworden.

**Isabelle, Cherry & Foster (2017)**, am NRC Canada, leisteten Pionierarbeit für den Ansatz für MT mit handgefertigten Testsets, die strukturelle Divergenzen zwischen Sprachen isolierten — Fälle, in denen wörtliche Übersetzung wahrscheinlich falsch ist. Ihre Folgearbeit (Isabelle & Kuhn, 2018) konstruierte 506 französische Sätze, die auf spezifische Übersetzungsherausforderungen abzielten und feingranulare Bilder der Systemfähigkeiten lieferten.

**LingEval97** (Sennrich, EACL 2017) erstellte 97.000 kontrastive Englisch→Deutsch-Übersetzungspaare, die testeten, ob NMT-Modelle korrekten Übersetzungen eine höhere Wahrscheinlichkeit zuweisen als Paaren mit eingeführten morphosyntaktischen Fehlern. Eine zentrale Erkenntnis: Zeichenbasierte Modelle waren bei der Transliteration herausragend, schnitten aber bei langreichweitiger morphosyntaktischer Kongruenz schlechter ab.

**ACES** (Amrhein, Moghe & Guillou, 2022–2023) skalierte den Challenge-Set-Ansatz dramatisch: 36.476 Beispiele über 146 Sprachpaare, die 68 verschiedene linguistische Phänomene testeten. ACES wurde zur Meta-Evaluierung von Metriken verwendet, die beim WMT Metrics Shared Task eingereicht wurden — es testete, ob *Metriken* die Kontraste erkennen konnten, nicht nur, ob *Systeme* sie erzeugen konnten. Erweitert zu **SPAN-ACES** mit Fehlerspannen-Annotationen.

**MT-GenEval** (Currey et al., EMNLP 2022) und **WinoMT** (Stanovsky, Smith & Zettlemoyer, ACL 2019) zielen speziell auf Genauigkeit beim Genus ab. WinoMT ist bemerkenswert, weil es explizit **morphologische Analyse** auf der Zielsprache verwendet, um das Genus übersetzter Berufsbezeichnungen zu verifizieren — einer der wenigen Fälle, in denen ein morphologischer Analysator als Teil eines MT-Bewertungswerkzeugs verwendet wird.

**Hjerson** (Popović & Ney, 2011) ist ein Open-Source-Werkzeug zur automatischen MT-Fehlerklassifizierung, das **Lemmata und POS-Tags** verwendet, um Fehler in fünf Typen zu kategorisieren: morphologische, Umordnungs-, fehlende Wörter, überzählige Wörter und lexikalische Fehler. Dies ist vielleicht die im Geiste unserem Linter am nächsten stehende Vorarbeit — es verwendet linguistische Analyse, um diagnostische Fehlerkategorien statt eines einzelnen Scores zu liefern.

Der gemeinsame Faden: Das Fachgebiet hat wiederholt anerkannt, dass aggregierte Scores unzureichend sind. Diagnostische Bewertung liefert die Granularität, die nötig ist, um zu verstehen, *warum* ein System versagt. Aber diagnostische Ansätze erfordern linguistische Expertise pro Sprache, und diese Expertise konzentriert sich auf europäische Sprachen.

### AmericasNLP: Bewertung an der Front

Die AmericasNLP-Workshop-Reihe (gemeinsam mit der NAACL ausgerichtet), die sich auf NLP für indigene Sprachen Amerikas konzentriert, bietet den direktesten Vergleichspunkt für unsere Bewertungsherausforderungen.

Von 2021 bis 2023 verwendete der Shared Task **chrF** als primäre Bewertungsmetrik — gewählt aufgrund seiner Robustheit in ressourcenarmen Settings und seines Matchings auf Zeichenebene, das Teilpunkte für morphologische Überlappung vergibt. Die Organisatoren erkannten die Beschränkungen von chrF an, hatten aber keine bessere Alternative, die über die diversen vertretenen Typologien hinweg funktionieren konnte (Quechua, Guaraní, Aymara, Nahuatl, Rarámuri und andere).

2025 führte AmericasNLP einen dedizierten **Shared Task 3** speziell für die Entwicklung von MT-Bewertungsmetriken für indigene Sprachen ein — das erste Mal, dass das Fachgebiet explizit anerkannte, dass bestehende Metriken für diese Sprachen unzureichend sind. Die siegreiche Einreichung, **FUSE** (Feature-Union Scorer), kombinierte mehrsprachige Satz-Embeddings (fine-getuntes LaBSE), lexikalische Ähnlichkeit, phonetische Ähnlichkeit und unscharfes Token-Matching mittels Ridge-Regression und Gradient Boosting. FUSE verwendet keine morphologischen Analysatoren — das Feature Engineering ist sprachunabhängig.

Dies ist die Lücke, die unsere Arbeit besetzt. AmericasNLP hat das Problem identifiziert (Standardmetriken versagen für indigene Sprachen) und begonnen, Alternativen zu entwickeln (FUSE). Aber keine der Alternativen nutzt das morphologische Wissen, das FSTs bereitstellen. Die AmericasNLP-Gemeinschaft verwendet chrF++, weil es die beste verfügbare generische Option ist, während die GiellaLT-Gemeinschaft ausgefeilte morphologische Werkzeuge baut, die nie an die MT-Bewertung angeschlossen werden. Die beiden Gemeinschaften sind nicht konvergiert.

---

## Teil 4: Referenzfreie Bewertung und Quality Estimation

Einige der wichtigsten Bewertungssignale in unserer Testumgebung erfordern überhaupt keine Referenzübersetzungen. Die FST-Validitätsprüfung („ist dies ein echtes Wort?") benötigt nur die MT-Ausgabe. Der Halluzinationsdetektor benötigt die Quelle und die Hypothese. Der Code-Switching-Detektor benötigt nur die Hypothese und Wissen über die Schrift der Zielsprache. Zu verstehen, wo diese in die breitere Landschaft der referenzfreien Bewertung passen, ist wesentlich, um sie korrekt zu positionieren.

### Das Quality-Estimation-Paradigma

**Quality Estimation (QE)** ist das Teilgebiet der MT-Bewertung, das sich mit der Vorhersage der Übersetzungsqualität *ohne* Referenzübersetzungen befasst. Es ist seit 2012 ein dedizierter Shared Task bei WMT, motiviert durch die praktische Notwendigkeit, die MT-Qualität zum Zeitpunkt des Einsatzes zu beurteilen — wenn man neuen Text übersetzt und keine menschliche Referenz zum Vergleich hat.

Die QE-Aufgabe hat sich durch drei Generationen entwickelt. **Feature-basiertes QE** (2012–2016) extrahierte handgefertigte Features aus der Quelle und der Hypothese — Sprachmodell-Perplexität, Worthäufigkeit, n-Gramm-Überlappung mit monolingualen Daten — und trainierte Klassifizierer, um die Qualität vorherzusagen. **Neuronales QE** (2017–2021) ersetzte handgefertigte Features durch gelernte Repräsentationen, typischerweise unter Verwendung bilingualer Encoder. **Aktuelles QE** (2022–heute) wird von COMET-basierten Ansätzen dominiert, insbesondere **CometKiwi**.

### CometKiwi und referenzfreies COMET

**CometKiwi** (Rei et al., WMT 2022), die referenzfreie Variante von COMET, verwendet InfoXLM, um den Quellsatz und die MT-Hypothese (ohne eine Referenz) zu kodieren und sagt einen Qualitäts-Score vorher. Es erreichte State-of-the-Art-Ergebnisse bei den WMT-2022- und 2023-QE-Shared-Tasks.

Die bemerkenswerte Erkenntnis: Referenzfreies CometKiwi nähert sich der Korrelation mit menschlichem Urteil an, die referenzbasiertes COMET erreicht. Dies legt nahe, dass für gut ausgestattete Sprachen der Quelltext nahezu so viel Bewertungssignal enthält wie die Referenzübersetzung. Aber derselbe Vorbehalt gilt: CometKiwis Encoder hat minimale Repräsentation für ressourcenarme Sprachen, sodass seine referenzfreien Vorhersagen für Cree oder Samisch unzuverlässig sind.

Hier bieten unsere FST-basierten Metriken etwas wirklich Anderes. Die FST-Validitätsprüfung ist ein **deterministisches, referenzfreies Qualitätssignal**, das kein trainiertes Modell und keine menschlichen Urteilsdaten erfordert. Wenn der FST sagt, ein Wort sei kein gültiges Cree-Wort, dann ist dieses Wort kein gültiges Cree-Wort — mit dem Vorbehalt von Fehlzurückweisungen bei Lehnwörtern, Neologismen und Eigennamen. Diese Art von hartem, regelbasiertem Qualitätssignal hat keine Entsprechung im neuronalen QE-Ökosystem.

### Halluzinationserkennung in MT

Halluzination in MT — flüssige Ausgabe, die völlig unabhängig von der Quelle ist — ist ein schwerwiegender Fehlermodus, insbesondere in ressourcenarmen Settings, in denen Modelle unzureichende Trainingsdaten haben, um zuverlässige Quell-Ziel-Korrespondenzen zu lernen.

Der akademische Stand der Technik in der Halluzinationserkennung verwendet mehrere Ansätze:

- **Embedding-basierte Erkennung**: Vergleich von Quell- und Hypothesen-Embeddings in einem gemeinsamen Raum (LASER, LaBSE) und Markierung von Fällen, in denen die Ähnlichkeit unter einem Schwellenwert liegt.
- **Wahrscheinlichkeitsbasierte Erkennung**: Verwendung der eigenen Konfidenz-Scores des MT-Modells — Halluzinationen neigen dazu, eine hohe Ausgabewahrscheinlichkeit, aber eine niedrige quellkonditionierte Wahrscheinlichkeit zu haben.
- **Kontrastive Perturbation**: Vergleich der MT-Ausgabe für die echte Quelle mit der Ausgabe für eine perturbierte oder unverwandte Quelle; wenn die Ausgaben verdächtig ähnlich sind, ignoriert das Modell die Quelle.
- **LLM-as-Judge**: Aufforderung an ein LLM zu beurteilen, ob die Übersetzung der Quelle treu ist.

Unsere Testumgebung verwendet ein **heuristisches Erkennungs-Plugin**, das vier Signale kombiniert: Längeninflation (Hypothese viel länger als erwartet), Wiederholung (wiederholte Phrasen), Entitätsdiskrepanz (Eigennamen in der Quelle, die in der Hypothese fehlen) und Quellecho (Hypothese ist dem Quelltext zu ähnlich, was auf unübersetztes Kopieren hindeutet). Dies ist im Vergleich zum akademischen Stand der Technik auf Basisniveau — es fängt grobe Halluzinationen ab, wird aber subtile übersehen. Sein Wert liegt darin, ein **billiges, schnelles, referenzfreies Sieb** zu sein, das die schlimmsten Fehler markieren kann, ohne eine GPU oder einen API-Aufruf zu erfordern.

### Code-Switching-Erkennung

Code-Switching in der MT-Ausgabe — wo das System Wörter in der Quellsprache erzeugt, statt sie zu übersetzen — ist ein eigenständiger Fehlermodus, der sich von Halluzination unterscheidet. Es tritt typischerweise auf, wenn das Modell auf ein Wort stößt, das es nicht übersetzen kann, und auf das Kopieren der Quelle zurückgreift.

Unser Code-Switching-Erkennungs-Plugin verwendet **Unicode-Block-Analyse** (Erkennung von Zeichen aus der Schrift der Quellsprache in dem, was Zielsprachen-Ausgabe sein sollte) und **Listen häufiger Wörter** (Identifizierung hochfrequenter Quellsprachenwörter, die unübersetzt erscheinen). Für Cree, das sowohl SRO (lateinbasiert) als auch Silbenschrift verwendet, erfordert dies eine gewisse Sorgfalt — Englisch und SRO teilen die lateinische Schrift, sodass Unicode-Block-Analyse allein unzureichend ist.

Die akademische Literatur zur Code-Switching-Erkennung in MT ist im Vergleich zur Halluzinationserkennung spärlich. Die meiste Arbeit konzentriert sich auf Code-Switching im *Eingabetext* (bilinguale Sprecher, die Sprachen mischen) statt im *Ausgabetext* (MT-Systeme, die bei der Übersetzung versagen). Unser heuristischer Ansatz liegt unseres Wissens nach für dieses spezifische Problem nicht wesentlich hinter irgendeinem veröffentlichten Stand der Technik zurück.

---

## Teil 5: Die morphologische Lücke

### Was bestehende Metriken nicht sehen können

Dies ist das Kernargument dieses Papers, und es erfordert eine konkrete Demonstration.

Betrachten Sie das Plains-Cree-Satzpaar:

| | Text |
|--|------|
| **Quelle (Englisch)** | „I saw the man" |
| **Referenz (Cree)** | *nikî-wâpamâw nâpêw* |
| **Hypothese A** | *nâpêw nikî-wâpamâw* |
| **Hypothese B** | *nikî-wâpamikow nâpêsis* |

**Hypothese A** ist eine perfekte Übersetzung — sie hat dieselben Wörter in einer anderen Reihenfolge, was im Cree grammatikalisch ist (freie Wortstellung). **Hypothese B** sagt „der Junge wurde von mir gesehen" — falsche Richtung der Handlung (*-ikow* ist invers), falscher Referent (*nâpêsis* = „Junge", nicht „Mann").

| Metrik | Hypothese A (korrekt) | Hypothese B (falsch) | Kann sie sie unterscheiden? |
|--------|----------------------|---------------------|------------------------|
| BLEU | ~30 % | ~20 % | Kaum |
| chrF++ | ~65 % | ~55 % | Etwas |
| COMET | Unbekannt (keine Cree-Trainingsdaten) | Unbekannt | Unzuverlässig |
| **FST-Akzeptanz** | 100 % | 100 % | Nein (beide sind gültiges Cree) |
| **Linter** | EQUIVALENT (WORD_ORDER) | MISS | **Ja** |
| **Semantischer Validator** | VALID | WRONG | **Ja** |

Der Linter und der semantische Validator sind dort erfolgreich, wo BLEU, chrF++ und COMET versagen — nicht weil sie in einem universellen Sinne „bessere Metriken" sind, sondern weil sie Zugang zu *linguistischem Wissen* haben, das String-Matching- und neuronale Metriken nicht haben. Sie wissen, dass Cree freie Wortstellung hat. Sie wissen, dass *wâpamêw* und *wâpamikow* verschiedene Lemmata mit verschiedenen Argumentstrukturen sind. Sie wissen, dass *nâpêw* und *nâpêsis* verschiedene Wörter sind.

Dieses Wissen stammt aus dem FST (der die morphologische Grammatik kodiert), dem bilingualen Wörterbuch (das englische Glossen für jedes Lemma bereitstellt) und den manuell definierten Variantenklassen (die linguistisch fundierte Äquivalenzregeln kodieren). Nichts von diesem Wissen ist einer Metrik zugänglich, die die Übersetzung als String behandelt.

### Warum das Fachgebiet dies nicht angegangen ist

Die morphologische Lücke in der MT-Bewertung ist kein Rätsel. Das Fachgebiet weiß, dass sie existiert. Die Gründe, warum sie fortbesteht, sind struktureller Natur:

1. **Skalierungs-Bias.** Die MT-Bewertungsgemeinschaft optimiert für Metriken, die über alle WMT-Sprachpaare hinweg funktionieren. FST-basierte Metriken funktionieren für ~30 Sprachen. COMET funktioniert für über 100. chrF++ funktioniert für alle Sprachen mit einem Schriftsystem. Die Gemeinschaft belohnt Universalität über Präzision.

2. **Gemeinschafts-Silos.** Die Leute, die FSTs bauen (Computerlinguisten an der UiT Tromsø, am NRC Canada, an der University of Alberta), und die Leute, die Bewertungsmetriken bauen (ML-Forscher bei Google, Unbabel, WMT), besuchen verschiedene Konferenzen, publizieren in verschiedenen Veröffentlichungsorganen und operieren unter verschiedenen Anreizstrukturen. Die Querbefruchtung, die nötig wäre, um FST-basierte Bewertungsmetriken zu bauen, hat nicht stattgefunden — nicht, weil sie versucht wurde und scheiterte, sondern weil die Gemeinschaften nie konvergiert sind.

3. **Abdeckungsangst.** FSTs haben bekannte Fehlzurückweisungsprobleme: Lehnwörter, Neologismen und Eigennamen können als ungültig zurückgewiesen werden, selbst wenn sie völlig akzeptabel sind. Dies macht Forscher nervös, FSTs als Metriken zu verwenden — eine Fehlzurückweisung bläht die Fehlerrate auf. Die Sorge ist berechtigt, aber quantifizierbar: Die Fehlzurückweisungsrate auf bekanntermaßen gutem Text zu messen, ist unkompliziert.

4. **Unzureichende Nachfrage.** Sehr wenige Leute bauen MT für polysynthetische Sprachen, und diejenigen, die es tun (ALT Lab, NRC, AmericasNLP-Teilnehmer), verwenden typischerweise chrF++, weil das existiert. Es hat keinen konzertierten Vorstoß der Gemeinschaft für ressourcenarme MT in Richtung morphologiebewusster Bewertung gegeben, teils weil die Gemeinschaft klein ist und teils weil der Bau solcher Metriken Expertise sowohl in NLP-Engineering als auch in der Morphologie der spezifischen Zielsprache erfordert.

5. **Die Annahme der neuronalen Metrik.** Die vorherrschende Annahme seit 2020 ist, dass neuronale Metriken das morphologische Problem schließlich durch gelernte Repräsentationen lösen werden. Wenn man COMET auf genügend Daten aus morphologisch reichen Sprachen trainiert, so das Argument, wird es lernen, morphologische Variation implizit zu handhaben. Dies mag für ressourcenreiche morphologisch reiche Sprachen (Finnisch, Türkisch, Tschechisch) zutreffen. Für Sprachen mit faktisch null Repräsentation in den Trainingsdaten ist es unwahrscheinlich, dass es zutrifft.

---

## Teil 6: LYSS — Eine linguistisch fundierte Alternative

### Was Champollion gebaut hat: LYSS (Linguistically-informed Yield & Structural Scoring)

Die Bewertungs-Testumgebung des Champollion-Projekts implementiert ein zusammengesetztes Bewertungsframework namens **LYSS**, das Standardmetriken (chrF++, exakte Übereinstimmung) mit vier Kategorien linguistisch fundierter Metriken kombiniert. Der Name spiegelt den Fokus des Frameworks wider: die Messung des *Ertrags* (yield) (wie viel Bedeutung den Übersetzungsprozess überlebt) durch *strukturelles Scoring* (deterministische, linguistisch fundierte Prüfungen statt gelernter Embeddings).

#### 1. Morphologisches Validitätstor (GiellaLT-FST-Metrik)

Die einfachste und am breitesten anwendbare Metrik: Jedes Wort der MT-Ausgabe wird durch den finite-state morphologischen Analysator von GiellaLT für die Zielsprache geleitet. Wenn der FST ein Wort parsen kann (mindestens eine Analyse zurückgibt), ist das Wort morphologisch gültig. Wenn nicht, existiert das Wort in der Zielsprache nicht — es ist entweder ein halluziniertes Wort, ein morphologischer Fehler, ein Rechtschreibfehler oder ein Lehnwort, das nicht im Lexikon ist.

**Ausgabe:** `fst_validity_rate` (0,0–1,0, höher = besser). Makro-Durchschnitt (Mittelwert der Raten pro Eintrag) und Mikro-Durchschnitt (gesamte gültige Wörter / gesamte Wörter).

**Abhängigkeiten:** `pyhfst` (Python-Bindings der Helsinki Finite-State Technology), eine kompilierte `.hfstol`-Analysatordatei für die Zielsprache.

**Erweiterbarkeit:** Funktioniert für jede Sprache mit einem GiellaLT-FST-Analysator — derzeit über 30 Sprachen, vorrangig samische, uralische und indigene arktische Sprachen.

**Verhältnis zur Vorarbeit:** MorphEval testet, ob ein System spezifische Kontraste handhaben kann. Die FST-Metrik testet, ob die Ausgabe des Systems aus echten Wörtern besteht. Diese sind komplementär: MorphEval testet Kompetenz, die FST-Metrik testet Validität.

#### 2. Linguistische Äquivalenzklassen (CRK-Linter)

Der Linter adressiert, was vielleicht der heimtückischste Fehlermodus der referenzbasierten Bewertung ist: **die Bestrafung korrekter Übersetzungen, die von der Referenz abweichen**.

Der Plains-Cree-Linter (844 Zeilen) implementiert sechs **Variantenklassen**, von denen jede eine linguistisch fundierte Äquivalenzregel kodiert:

- **WORD_ORDER**: Cree hat pragmatisch freie Wortstellung (Wolfart, 1973 §3.2). *nikî-wâpamâw nâpêw* und *nâpêw nikî-wâpamâw* bedeuten dasselbe. Der Linter erzeugt alle Permutationen und prüft, ob die Hypothese mit einer übereinstimmt.
- **ORTHOGRAPHIC**: Die Standard Roman Orthography hat bekannte Variationspunkte — Zirkumflex vs. Makron (*â* vs. *ā*), Bindestrichsetzung von Präverbien (*nikî-nipâw* vs. *nikî nipâw* vs. *nikînipâw*). Der Linter normalisiert diese.
- **OPTIONAL_PARTICLE**: Bestimmte Diskurspartikeln (*mâka*, *êkwa*, *êwako*) können vorhanden oder abwesend sein, ohne die Kernaussage zu ändern. Der Linter prüft, ob die Hypothese nach Partikelentfernung mit der Referenz übereinstimmt.
- **LEMMA_SYNONYM**: Manche Cree-Lemmata sind in spezifischen Kontexten austauschbar. Dies verwendet eine kuratierte Synonymliste (z. B. dialektale Varianten) und prüft, wenn der FST verfügbar ist, ob Hypothese und Referenz morphologische Analysen teilen.
- **PROGRESSIVE_AMBIGUITY**: Englische Progressivformen („is walking") können mit verschiedenen Konstruktionen ins Cree übersetzt werden. Der Linter erkennt diese als äquivalent.
- **INCLUSIVE_EXCLUSIVE**: Cree unterscheidet inklusives „wir" (*ki-*-Präfix) von exklusivem „wir" (*ni-*-Präfix) — eine Unterscheidung, die Englisch in ein einzelnes Pronomen zusammenfasst. Der Linter erkennt, dass beide Formen korrekt sein können, wenn die englische Quelle mehrdeutig ist.

Der Linter erzeugt drei Urteile: **EXACT** (Hypothese stimmt mit der Referenz überein), **EQUIVALENT** (Hypothese weicht ab, ist aber als gültige Variante klassifiziert) oder **MISS** (keine Übereinstimmung gefunden). Auf aggregierter Ebene berechnet er eine `equivalent_match_rate` — den Anteil der Übersetzungen, die exakt oder äquivalent sind.

**Verhältnis zur Vorarbeit:** Die nächste Parallele ist **HyTER** (Dreyer & Marcu, NAACL-HLT 2012), das exponentiell viele gültige Übersetzungen als Paraphrasen-Netzwerke kodiert und die Editierdistanz zur nächstgelegenen gültigen Form misst. Unser Linter ist konzeptionell ähnlich — er definiert eine Menge gültiger Übersetzungen für jede Referenz — verwendet aber linguistisch definierte Transformationsregeln statt Paraphrasendatenbanken. HyTER wurde für Englisch entworfen; niemand hat Paraphrasen-Netzwerke für Cree gebaut. Unsere Variantenklassen sind faktisch eine kompakte, regelbasierte Approximation dessen, was HyTER mit Graphen tut.

Im CheckList-Framework funktionieren unsere Variantenklassen als **Invarianztests**: Transformationen, die das Bewertungsurteil nicht ändern sollten. Der Unterschied besteht darin, dass CheckList-Tests typischerweise auf das *Modell* angewendet werden; unsere Variantenregeln werden auf die *Metrik* angewendet.

#### 3. Deterministische semantische Validierung (CRK-Semantikmetrik)

Der semantische Validator (792 Zeilen) versucht etwas Ehrgeizigeres: **deterministischen Bedeutungsvergleich** ohne neuronale Embeddings. Er operiert in vier Stufen:

1. **Morphologische Analyse**: Sowohl die Hypothese als auch die Referenz werden durch den CRK FST-Analysator geleitet, der das Lemma und die morphologischen Merkmale für jedes Wort zurückgibt.
2. **Glossenauflösung**: Jedes Lemma wird über die itwêwina-Wörterbuch-API nachgeschlagen – welche Wolvengrey (2001) neben den Wörterbüchern von Maskwacîs und den Alberta Elders bereitstellt –, um englische Glossen zu erhalten.
3. **Extraktion von Inhaltswörtern**: Unter Verwendung der englischen Pipeline von spaCy (`en_core_web_md`) werden Funktionswörter sowohl aus den englischen Glossen als auch aus dem Ausgangstext herausgefiltert.
4. **Überlappungsbewertung**: Die Überlappung der Inhaltswörter zwischen den Glossen der Hypothese und den Glossen der Referenz bestimmt das semantische Urteil.

Der Validator erzeugt kategoriale Urteile: **EXACT_MATCH**, **VALID** (verschiedene Wörter, aber dieselbe Bedeutung), **GRAMMAR_ISSUES** (korrekte Lemmata, aber Grammatikprobleme auf Satzebene — Kongruenz, Belebtheit, Verbform), **PARTIAL** (etwas Bedeutung erhalten), **INCOMPLETE** (Bedeutung teilweise fehlend), **WRONG** (andere Bedeutung) oder **NO_OUTPUT**.

**Verhältnis zur Vorarbeit:** Dies ist faktisch eine **deterministische Approximation der semantischen Ähnlichkeitsberechnung von COMET**. Wo COMET gelernte sprachübergreifende Embeddings verwendet, um zu beurteilen, ob zwei Sätze dasselbe bedeuten, verwendet unser Validator eine Kette deterministischer Nachschlageoperationen: FST → Wörterbuch → spaCy. Der Vorteil ist Transparenz (jeder Schritt ist inspizierbar und deterministisch) und Unabhängigkeit von Trainingsdaten. Der Nachteil ist Brüchigkeit: Die Qualität der Beurteilung hängt vollständig von der Abdeckung des FST und der Vollständigkeit des Wörterbuchs ab.

Der Ansatz ist konzeptionell mit **MEANT** (Lo & Wu, 2011; Lo, 2017) verwandt, das Semantic Role Labelling verwendete, um zu beurteilen, ob die „Wer-tat-was-wem"-Struktur in der Übersetzung erhalten blieb. Unser Ansatz ist gröbergranular (Inhaltswort-Überlappung statt semantische Rollen), operiert aber auf einer Sprache, für die keine SRL-Werkzeuge existieren.

#### 4. Behaviorale Erkennungs-Plugins (Halluzination, Code-Switching, Terminologie)

Drei zusätzliche Plugins liefern **behaviorale Qualitätssignale**, die die morphologischen Metriken ergänzen:

- **Halluzinationserkennung** (259 Zeilen): Vier heuristische Signale, gewichtet und kombiniert — Längeninflation (40 %), Wiederholung (30 %), Entitätsdiskrepanz (20 %), Quellecho (10 %). Dies sind billige, referenzfreie Siebe, die grobe Fabrikation abfangen.
- **Code-Switching-Erkennung** (~280 Zeilen): Unicode-Block-Analyse plus Listen häufiger Wörter, um unübersetzte Quellsprachen-Token zu erkennen. Gibt eine `code_switching_rate` (0,0–1,0) aus.
- **Terminologietreue** (199 Zeilen): Prüft, ob spezifizierte Glossarbegriffe konsistent übersetzt werden. Gibt `terminology_adherence` (0,0–1,0) oder None zurück, wenn kein Glossar konfiguriert ist.

Diese Plugins werden ehrlich als **heuristische Detektoren auf Basisniveau** positioniert, nicht als State of the Art. Ihr Wert liegt darin, billige, schnelle, interpretierbare Signale zu liefern, die neben den anspruchsvolleren morphologischen Metriken berechnet werden können. Im zusammengesetzten Bewertungsframework tragen sie geringe Gewichte (jeweils 0,05).

### Ehrliche Beschränkungen

Dieser Ansatz hat erhebliche Beschränkungen, die anerkannt werden müssen, bevor irgendeine Behauptung von Neuartigkeit oder Nützlichkeit aufgestellt wird:

1. **FST-Fehlzurückweisungsrate.** Der FST wird gültige Wörter zurückweisen, die nicht in seinem Lexikon sind — Lehnwörter, Neologismen, Eigennamen, codegemischte Begriffe. Dies bläht die morphologische Fehlerrate auf. Die Fehlzurückweisungsrate wurde nicht formal an einem repräsentativen Korpus von Cree-Text gemessen. Ohne diese Messung ist die Präzision der FST-Validitätsmetrik unbekannt.

2. **Wörterbuchabdeckung.** Die Qualität des semantischen Validators hängt vollständig von der Abdeckung des Wolvengrey-Wörterbuchs ab. Cree-Wörter, die nicht im Wörterbuch stehen, erzeugen keine Glossen, was der Validator als Bedeutungslücke behandelt. Das Wörterbuch enthält etwa 18.000–22.000 Einträge (die Zählungen variieren je nach Ausgabe und Zählmethode) – beträchtlich, aber nicht erschöpfend.

3. **Vollständigkeit der Variantenklassen.** Die sechs Variantenklassen des Linters wurden auf Grundlage linguistischer Literatur und der Beobachtung von MT-Ausgabemustern entworfen. Es mag zusätzliche Äquivalenzklassen geben, die nicht erfasst sind — dialektale Variationen, Registerunterschiede, Synonyme auf Diskursebene. Kein formaler Prozess gewährleistet Vollständigkeit.

4. **Keine Studie zur menschlichen Korrelation.** Die kritischste Lücke: Niemand hat gemessen, ob die Urteile des Linters (EXACT/EQUIVALENT/MISS) oder die Urteile des semantischen Validators mit menschlichen Urteilen über Übersetzungsqualität korrelieren. Neuronale Metriken verbringen Jahre damit, die Korrelation mit menschlicher Beurteilung zu etablieren (WMT Shared Tasks). Unsere Metriken haben keine solche Validierung.

5. **Sprachspezifität.** Die Variantenklassen, Synonymlisten und Regeln für optionale Partikeln sind spezifisch für Plains Cree. Sie auf Nordsamisch, Inuktitut oder eine andere Sprache zu portieren, erfordert Linguisten, die die Morphologie, die Wortstellungsflexibilität und die orthographische Variation dieser Sprache verstehen. Das *Framework* ist portabel; die *Regeln* sind es nicht.

6. **Lücken in der Metrik-Verdrahtung.** Zum Zeitpunkt der Niederschrift haben vier der neun Metriken im zusammengesetzten Bewertungsprofil (semantic_score, morphological_accuracy, equivalent_match_rate, orthographic_accuracy) eine unvollständige oder unklare Plugin-Verdrahtung in der Arena-Testumgebung. Der zusammengesetzte Score wird faktisch aus etwa fünf Metriken mit umverteilten Gewichten berechnet.

### Was nötig wäre, um diesen Ansatz zu validieren

Um diese Arbeit veröffentlichungsfähig zu machen — in irgendeinem Veröffentlichungsorgan, auf irgendeiner Ebene akademischer Ernsthaftigkeit — wären die folgenden Experimente erforderlich:

1. **Studie zur Korrelation mit menschlichem Urteil.** Menschliche Qualitätsbewertungen für eine Menge von Englisch→Cree-Übersetzungen sammeln (idealerweise über 200 Satzpaare, beurteilt von über 3 bilingualen Sprechern). Korrelationen zwischen menschlichen Scores und jeder unserer Metriken berechnen. Dies ist die mit Abstand wichtigste Validierung. Ohne sie sind die Metriken Engineering-Artefakte, keine Bewertungswerkzeuge.

2. **Messung der FST-Fehlzurückweisungsrate.** Den FST-Analysator auf einem Korpus bekanntermaßen guten Cree-Texts laufen lassen (z. B. veröffentlichte Cree-Texte, validierte parallele Korpora) und messen, welcher Prozentsatz gültiger Wörter zurückgewiesen wird. Dies quantifiziert die Präzision der FST-Validitätsmetrik.

3. **Zweitsprachenvalidierung.** Die FST-Validitätsmetrik auf eine zweite GiellaLT-Sprache portieren (höchstwahrscheinlich Nordsamisch, das den ausgereiftesten FST-Analysator im GiellaLT-Ökosystem hat). Demonstrieren, dass die Metrik sinnvolle Ergebnisse auf samischer MT-Ausgabe erzeugt. Dies validiert die Behauptung der Erweiterbarkeit.

4. **Vergleich mit COMET.** COMET auf denselben Cree-Daten laufen lassen und seine Scores mit unseren Metriken und mit menschlichen Urteilen vergleichen. Wenn COMET bedeutsame Scores für Cree erzeugt (was wir bezweifeln, aber nicht getestet haben), müssen unsere Metriken es schlagen, um nützlich zu sein. Wenn COMET Rauschen erzeugt (was wir erwarten), validiert dies den Bedarf an unserem Ansatz.

5. **Diagnostisches MorphEval-Komplement.** Eine kleine (50–100 Kontraste) MorphEval-artige Testsuite für Plains Cree bauen, die auf die markantesten morphologischen Merkmale der Sprache abzielt (Obviativ, Invers, Konjunkt/Independent, inklusiv/exklusiv). MT-Systeme dagegen laufen lassen und zeigen, dass die diagnostischen Informationen verwertbar sind.

6. **Verdrahtungs- und Integrationsaudit.** Die in der Codebasis-Bestandsaufnahme identifizierten Lücken in der Verdrahtung des Bewertungsprofils beheben. Sicherstellen, dass alle neun zusammengesetzten Metriken Werte erzeugen und dass der aggregierte Score korrekt berechnet wird.

---

## Teil 7: Positionierung und zukünftige Arbeit

### Wo LYSS in der Bewertungslandschaft steht

Eine Taxonomie der MT-Bewertungsansätze, ehrlich positioniert:

| Dimension | String-Metriken (BLEU, chrF++) | Neuronale Metriken (COMET, MetricX) | LLM-as-Judge (GEMBA) | Diagnostisch (MorphEval, CheckList) | **LYSS** |
|-----------|-------------------------------|---|----|-------|--------|
| Signaltyp | Oberflächenüberlappung | Gelernte semantische Ähnlichkeit | Offenes Urteil | Gezielte Fähigkeitssonden | Morphologische Validität + regelbasierte Äquivalenz |
| Benötigte Trainingsdaten | Keine | Menschliche Urteile (Tausende) | Vortrainiertes LLM | Von Linguisten entworfene Testsuiten | FST + Wörterbuch + Variantenregeln |
| LRL-Anwendbarkeit | Universal, aber schwach | Durch Encoder-Abdeckung begrenzt | Durch LLM-Abdeckung begrenzt | Durch Testsuiten-Erstellung begrenzt | Durch FST-Verfügbarkeit begrenzt (~30 Sprachen) |
| Referenz benötigt | Ja | Ja (oder Quelltext-only-QE) | Optional | Ja (kontrastiv) | Ja (LYSS-eq/LYSS-sem) / Nein (LYSS-fst) |
| Interpretierbarkeit | Niedrig (eine Zahl) | Niedrig (eine Zahl) | Hoch (Textbegründung) | Hoch (Bestanden/Nicht bestanden pro Phänomen) | Hoch (Urteile + Variantenklassen) |

**LYSS ist nicht**: ein Ersatz für COMET bei gut ausgestatteten Sprachen, eine universelle Metrik oder die erste morphologiebewusste Bewertung.

**LYSS ist**: ein integriertes Framework, das FST-basierte morphologische Validierung mit Standardmetriken für den spezifischen Fall von Sprachen kombiniert, bei denen neuronale Metriken keine Abdeckung haben und regelbasierte Werkzeuge (FSTs, Wörterbücher) existieren. Es hat drei Kernkomponenten:
- **LYSS-fst** — Morphologische Validität via FST (`fst_acceptance_rate`)
- **LYSS-eq** — Linguistische Äquivalenz via Linter (`equivalent_match_rate`)
- **LYSS-sem** — Deterministische semantische Validierung (`semantic_score`)

**LYSS erweitert**: MorphEvals Kernerkenntnis (morphologische Werkzeuge für die Bewertung verwenden) von diagnostischer Kompetenzprüfung zu kontinuierlichem Qualitäts-Scoring.

**LYSS ergänzt**: chrF++ (das Teilpunkte für gemeinsame Morpheme vergibt, aber keine Äquivalenz erkennen kann), COMET (das im semantischen Raum operiert, aber keine Trainingsdaten für LRL hat) und FUSE (das Feature Engineering verwendet, aber keine morphologischen Analysatoren).

**Die nächste Vorarbeit ist**: Hjerson (linguistische Fehlerklassifizierung) + HyTER (Äquivalenzklassen via Paraphrasen-Netzwerke) + Apertiums naive Abdeckungsmetrik (FST-basierte Validitätsprüfung). LYSS' Beitrag ist nicht irgendeine einzelne Technik, sondern die Integration dieser Ideen — insbesondere FST-basierte Validität und regelbasierte Äquivalenz — in eine funktionierende Bewertungs-Testumgebung für eine polysynthetische Sprache.

### Integration von MorphEval

MorphEvals kontrastive Testsuiten-Methodik und unser kontinuierlicher Bewertungsansatz sind komplementär:

- **MorphEval** beantwortet: „Kann dieses System Tempusmarkierung handhaben? Numeruskongruenz? Kasuszuweisung?"
- **Unsere FST-Metrik** beantwortet: „Hat dieses System echte Wörter erzeugt?"
- **Unser Linter** beantwortet: „Ist diese Übersetzung trotz Oberflächenunterschieden äquivalent zur Referenz?"
- **Unser semantischer Validator** beantwortet: „Bedeutet diese Übersetzung das Richtige?"

MorphEval ist Open Source. Die Erstellung einer Plains-Cree-Testsuite würde erfordern, dass ein Linguist kontrastive Paare entwirft, die cree-spezifische morphologische Kontraste abdecken (Obviation, Inversmarkierung, Konjunkt/Independent-Ordnung, inklusiv/exklusiv „wir", Präverb-Ketten). Dies ist substanzielle, aber begrenzte Arbeit — Wochen, nicht Monate — und würde diagnostische Fähigkeiten bieten, die kein anderes Bewertungswerkzeug für Cree bietet.

### Die Frage der Erweiterbarkeit

Welche anderen Sprachen könnten diesen Ansatz übernehmen? Die primäre Einschränkung ist die FST-Verfügbarkeit. Die GiellaLT-Infrastruktur stellt morphologische Analysatoren für über 30 Sprachen bereit, vorrangig in drei Familien:

- **Samische Sprachen** (Nordsamisch, Lulesamisch, Südsamisch, Skoltsamisch, Inarisamisch): Ausgereifte FSTs mit breiter Abdeckung. Nordsamisch ist das am unmittelbarsten portierbare Ziel.
- **Uralische Sprachen** (Finnisch, Estnisch, Komi, Ersja, Mokscha): Gut entwickelte Analysatoren, obwohl Finnisch und Estnisch FST-basierte Bewertung möglicherweise nicht so dringend benötigen (sie haben mehr neuronale Metrik-Abdeckung).
- **Indigene arktische Sprachen** (Inuktitut via Uqailaut, Grönländisch): Analysatoren existieren, aber die Abdeckung variiert.
- **Andere GiellaLT-Sprachen**: Färöisch, Irisch, Kornisch, Livisch und andere mit variierenden Reifegraden der FSTs.

Über GiellaLT hinaus stellt die **Apertium**-Plattform morphologische Analysatoren für etwa über 40 Sprachpaare bereit. Das **HFST**-Ökosystem (Helsinki Finite-State Technology) ist die gemeinsame Infrastruktur, die sowohl GiellaLT als auch Apertium verwenden, was bedeutet, dass jeder Apertium-Analysator im Prinzip an dieselbe FST-Validitätsmetrik angeschlossen werden könnte.

Die praktische Einschränkung ist nicht die FST-Verfügbarkeit, sondern die **Kuratierung der Variantenklassen**. Die Äquivalenzregeln des Linters erfordern linguistische Expertise pro Zielsprache. Für Nordsamisch würde dies das Verständnis der Wortstellungsflexibilität, der orthographischen Konventionen und der dialektalen Variation des Samischen erfordern. Für Inuktitut würde es das Verständnis polysynthetischer Morphologie auf einem Niveau erfordern, das mit dem für Cree Geleisteten vergleichbar ist. Die FST-Validitätsmetrik kann jedoch unmittelbar für jede Sprache mit einem GiellaLT-Analysator eingesetzt werden — keine zusätzliche linguistische Arbeit erforderlich.

### In Richtung eines Papers

Eine Publikation auf Grundlage dieser Arbeit würde am natürlichsten eines dieser Veröffentlichungsorgane anvisieren:

- **WMT Metrics Shared Task** (gemeinsam mit EMNLP ausgerichtet): Das direkteste Veröffentlichungsorgan. Würde erfordern, die Metriken als Shared-Task-Einreichung zu implementieren und auf WMT-Testsets zu bewerten — die derzeit keine polysynthetische Sprache enthalten. Könnte als „Findings"-Paper eingereicht werden oder am Challenge-Sets-Subtask teilnehmen.
- **LREC-COLING** (Language Resources and Evaluation Conference): Natürliche Passung für ein Ressourcen-/Werkzeug-Paper, das das Bewertungsframework und die linguistischen Ressourcen beschreibt, die es verwendet (FSTs, Wörterbücher, Variantenregeln).
- **ACL oder NAACL** (Hauptkonferenz): Würde die Studie zur menschlichen Korrelation und mindestens eine zusätzliche Sprache erfordern, um die Latte für ein Hauptkonferenz-Paper zu erreichen.
- **AmericasNLP-Workshop**: Das aufnahmebereiteste Publikum für die MT-Bewertung indigener Sprachen. Niedrigere Veröffentlichungshürde, aber hohe Wirkung innerhalb der Zielgemeinschaft.
- **ComputEL** (Computational Approaches to Endangered Languages): Fokussiertes Veröffentlichungsorgan genau für diese Art von Arbeit.

Jede Publikation würde Koautoren mit Expertise in Cree-Linguistik (um die Variantenklassen zu validieren und Ergebnisse zu interpretieren) und idealerweise bilinguale Cree-Sprecher erfordern (um die menschlichen Qualitätsbewertungen für die Korrelationsstudie bereitzustellen). Dies ist nicht optional — ein Paper über Cree-MT-Bewertung, das vollständig von Nicht-Cree-Sprechern geschrieben wird, wäre bestenfalls unvollständig und schlimmstenfalls eine Fortsetzung der extraktiven Forschungsdynamiken, die das Fachgebiet zu überwinden versucht.

---

## Anhang A: Matrix der Metrik-Anforderungen

| Metrik | Referenz benötigt? | Quelle benötigt? | Trainiertes Modell? | Sprachspezifische Ressourcen? | Funktioniert für LRL? |
|--------|-------------------|---------------|----------------|------------------------------|----------------|
| BLEU | Ja | Nein | Nein | Nein | Schlecht |
| chrF++ | Ja | Nein | Nein | Nein | Besser als BLEU |
| METEOR | Ja | Nein | Nein | Stemmer + WordNet | Nur wenn Ressourcen existieren |
| TER | Ja | Nein | Nein | Nein | Wie BLEU |
| BERTScore | Ja | Nein | Ja (mBERT) | Nein | Abhängig von Modellabdeckung |
| BLEURT | Ja | Nein | Ja (trainiert) | Nein | Abhängig von Trainingsdaten |
| COMET | Ja | Ja | Ja (XLM-R) | Nein | Abhängig von XLM-R-Abdeckung |
| CometKiwi | Nein | Ja | Ja (XLM-R) | Nein | Abhängig von XLM-R-Abdeckung |
| GEMBA | Optional | Ja | Ja (LLM) | Nein | Abhängig von LLM-Abdeckung |
| **FST-Akzeptanz** | **Nein** | **Nein** | **Nein** | **Ja (FST-Analysator)** | **Ja, wenn FST existiert** |
| **CRK-Linter** | **Ja** | **Nein** | **Nein** | **Ja (FST + Variantenregeln)** | **Ja, wenn Ressourcen existieren** |
| **CRK-Semantik** | **Ja** | **Optional** | **Nein** | **Ja (FST + Wörterbuch + spaCy)** | **Ja, wenn Ressourcen existieren** |
| Halluzinationserk. | Nein | Ja | Nein | Nein | Ja |
| Code-Switching-Erk. | Optional | Ja | Nein | Minimal | Ja |
| MorphEval | Ja (kontrastiv) | Ja | Nein | Ja (Testsuite + Analysator) | Nur wenn Testsuite existiert |

## Anhang B: Wichtige Paper

| Zitat | Veröffentlichungsorgan | Relevanz |
|----------|-------|-----------|
| Papineni et al. (2002). BLEU: a Method for Automatic Evaluation of Machine Translation | ACL 2002 | Die Metrik, die das Fachgebiet definierte |
| Doddington (2002). Automatic Evaluation of Machine Translation Quality Using N-gram Co-Occurrence Statistics | HLT 2002 | Informationsgewichtetes n-Gramm-Matching |
| Banerjee & Lavie (2005). METEOR: An Automatic Metric for MT Evaluation | ACL 2005 Workshop | Stemming, Synonyme, Wort-Alignment |
| Snover et al. (2006). A Study of Translation Edit Rate | AMTA 2006 | Editierdistanz mit Phrasenverschiebungen |
| Popović & Ney (2011). Morphemes and POS tags for n-gram based evaluation metrics | WMT 2011 | Hjerson-Fehlerklassifizierung |
| Dreyer & Marcu (2012). HyTER: Meaning-Equivalent Semantics for Translation Evaluation | NAACL-HLT 2012 | Äquivalenzklassen via Paraphrasen-Netzwerke |
| Lommel et al. (2014). Multidimensional Quality Metrics | — | MQM-Fehlertypologie |
| Popović (2015). chrF: character n-gram F-score for automatic MT evaluation | WMT 2015 | Bewertung auf Zeichenebene |
| Popović (2017). chrF++: words helping character n-grams | WMT 2017 | Zeichen- + Wort-n-Gramm-Bewertung |
| Burlot & Yvon (2017). Evaluating the Morphological Competence of Machine Translation Systems | WMT 2017 | Kontrastive morphologische Testsuiten |
| Sennrich (2017). How Grammatical is Character-level Neural Machine Translation? | EACL 2017 | LingEval97 kontrastive Paare |
| Isabelle, Cherry & Foster (2017). A Challenge Set Approach to Evaluating Machine Translation | EMNLP 2017 | Gezielte Prüfung struktureller Divergenz |
| Post (2018). A Call for Clarity in Reporting BLEU Scores | WMT 2018 | sacreBLEU-Standardisierung |
| Reiter (2018). A Structured Review of the Validity of BLEU | Computational Linguistics | Metaanalyse der Korrelation von BLEU mit menschlichem Urteil |
| Stanovsky, Smith & Zettlemoyer (2019). Evaluating Gender Bias in Machine Translation | ACL 2019 | WinoMT-Genusbewertung |
| Ribeiro et al. (2020). Beyond Accuracy: Behavioral Testing of NLP Models with CheckList | ACL 2020 (Best Paper) | Fähigkeitsbasiertes Unit-Testing für NLP |
| Zhang et al. (2020). BERTScore: Evaluating Text Generation with BERT | ICLR 2020 | Embedding-basierte semantische Ähnlichkeit |
| Sellam et al. (2020). BLEURT: Learning Robust Metrics for Text Generation | ACL 2020 | Vortrainierte + fine-getunte Metrik |
| Rei et al. (2020). COMET: A Neural Framework for MT Evaluation | EMNLP 2020 | Sprachübergreifende trilinguale Bewertung |
| Freitag et al. (2021). Results of the WMT 2021 Metrics Shared Task | WMT 2021 | MQM-basierte Meta-Evaluierung |
| Thompson & Post (2020). PRISM: Automatic MT Evaluation via Zero-Shot Paraphrasing | EMNLP 2020 | Mehrsprachiges NMT als Paraphrasen-Bewerter |
| Currey et al. (2022). MT-GenEval | EMNLP 2022 | Kontrafaktische Genusgenauigkeit |
| Amrhein et al. (2022). ACES: Translation Accuracy Challenge Sets | WMT 2022 | 68 Phänomene, 146 Sprachpaare |
| Kocmi & Federmann (2023). GEMBA: Large Language Models Are State-of-the-Art Evaluators | EAMT 2023 | LLM-as-Evaluator |
| Guerreiro et al. (2024). xCOMET: Transparent MT Evaluation through Fine-grained Error Detection | TACL 2024 | Fehlerspannen-Erkennung |
| Wang & Adelani (2024). AfriMTE and AfriCOMET | NAACL 2024 | Neuronale Metriken für afrikanische Sprachen |
| Juraska et al. (2024). MetricX-24 | WMT 2024 | mT5-basierte siegreiche Metrik |

## Anhang C: Glossar der Bewertungsbegriffe

| Begriff | Definition |
|------|------------|
| **Adäquatheit** | Ob eine Übersetzung die Bedeutung der Quelle vermittelt. |
| **Flüssigkeit** | Ob eine Übersetzung grammatikalisch und natürlich in der Zielsprache ist. |
| **Direct Assessment (DA)** | Menschliche Bewertungsmethode, bei der Annotatoren Übersetzungen auf einer Skala von 0–100 bewerten. |
| **MQM** | Multidimensional Quality Metrics — fehlerspannenbasierte menschliche Bewertung mit typisierten Schweregraden. |
| **Quality Estimation (QE)** | Vorhersage der Übersetzungsqualität ohne eine Referenzübersetzung. |
| **FST** | Finite-State Transducer — ein Rechengerät, das die morphologischen Regeln einer Sprache kodiert. |
| **GiellaLT** | Infrastruktur für regelbasierte Sprachtechnologie, vorrangig für Samisch und andere arktische Sprachen. |
| **HFST** | Helsinki Finite-State Technology — das Software-Framework, das GiellaLT und Apertium zugrunde liegt. |
| **SRO** | Standard Roman Orthography — das lateinbasierte Schriftsystem für Plains Cree. |
| **Silbenschrift** | Canadian Aboriginal Syllabics — ein Abugida-Schriftsystem, das für Cree und andere Algonkin-Sprachen verwendet wird. |
| **Polysynthetisch** | Ein Sprachtyp, bei dem ein einzelnes Wort durch ausgedehnte Affigierung das Äquivalent eines ganzen englischen Satzes kodieren kann. |
| **Obviation** | Eine grammatische Kategorie in Algonkin-Sprachen, die zwischen zwei Referenten der dritten Person unterscheidet. |
| **Invers** | Eine diathesenähnliche Kategorie in Algonkin-Sprachen, die markiert, dass der Patiens den Agens auf der Belebtheitshierarchie übertrifft. |
| **WMT** | Conference on Machine Translation — das primäre Veröffentlichungsorgan für MT-Shared-Tasks und -Bewertung. |
| **Kontrastive Bewertung** | Prüfung, ob ein System minimal unterschiedliche Eingaben unterscheiden kann, die unterschiedliche Ausgaben erfordern. |
| **Challenge Set** | Eine gestaltete Testsuite, die auf spezifische linguistische Phänomene abzielt. |
| **Äquivalenzklasse** | Eine Menge verschiedener Oberflächenformen, die dieselbe Bedeutung repräsentieren und denselben Bewertungs-Score erhalten sollten. |

## Wohin dies auf dieser Website führt

Champollions eigene Antworten auf die hier katalogisierten Probleme sind die
[Bewertungsspezifikation](/docs/network/specifications/scoring) (welche Metrik
wann zählt), die [Metrik-Zuverlässigkeit](/docs/network/specifications/metric-reliability)
(welcher Metrik pro Zielsprache zu vertrauen ist) und das
[Korpus-Design-Framework](/docs/network/specifications/corpus-design)
(wie ein Testset seine Glaubwürdigkeit erlangt).
