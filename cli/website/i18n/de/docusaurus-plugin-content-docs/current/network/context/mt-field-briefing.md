# Maschinelle Übersetzung: Ein Lagebericht (2013–2026)

*Eine narrative Geschichte für alle, die in das Feld der maschinellen Übersetzung einsteigen*

---

## Inhaltsverzeichnis

- [Teil 1: Die neuronale Revolution (2013–2017)](#part-1-the-neural-revolution-20132017)
- [Teil 2: Die multilinguale Wende (2018–2022)](#part-2-the-multilingual-turn-20182022)
- [Teil 3: Die LLM-Ära (2022–2026)](#part-3-the-llm-era-20222026)
- [Teil 4: Das Low-Resource-Problem](#part-4-the-low-resource-problem)
- [Teil 5: Finite-State-Transduktoren und regelbasierte Systeme](#part-5-finite-state-transducers-and-rule-based-systems)
- [Teil 6: Qualität messen — Das Evaluationsproblem](#part-6-measuring-quality--the-evaluation-problem)
- [Teil 7: Die institutionelle Landschaft](#part-7-the-institutional-landscape)
- [Teil 8: Offene Grenzen](#part-8-open-frontiers)
- [Anhang A: Wichtige Arbeiten](#appendix-a-key-papers)
- [Anhang B: Konferenzen und Communities](#appendix-b-conferences-and-communities)
- [Anhang C: Werkzeuge, Datensätze und praktische Ressourcen](#appendix-c-tools-datasets-and-practical-resources)
- [Anhang D: Glossar](#appendix-d-glossary)

---

## Teil 1: Die neuronale Revolution (2013–2017) {#part-1-the-neural-revolution-20132017}

### Das alte Regime: Statistische maschinelle Übersetzung

Um die Revolution zu verstehen, die die maschinelle Übersetzung Mitte der 2010er-Jahre umgestaltete, müssen Sie zunächst verstehen, was ihr vorausging — und warum es scheiterte.

Von etwa 2003 bis 2015 war das vorherrschende Paradigma in der maschinellen Übersetzung die **Statistische maschinelle Übersetzung (SMT)**, genauer gesagt die **phrasenbasierte SMT**. Die Grundidee war trügerisch einfach: Statt Regeln darüber zu schreiben, wie Sprache funktioniert, sammelt man enorme Mengen an Paralleltext — von Menschen in zwei Sprachen übersetzte Dokumente — und lässt statistische Algorithmen die Entsprechungen lernen. Das System zerlegte einen Quellsatz in überlappende Phrasen (keine linguistischen Phrasen, sondern beliebige n-Gramm-Abschnitte), suchte für jeden Abschnitt statistisch wahrscheinliche Übersetzungen und setzte dann einen Zielsatz zusammen, wobei ein **Sprachmodell** dafür sorgte, dass die Ausgabe flüssig war.

Das Arbeitspferd dieser Ära war **Moses**, ein quelloffenes SMT-Toolkit, das hauptsächlich an der University of Edinburgh unter Philipp Koehn entwickelt und 2006 veröffentlicht wurde. Moses wurde zum Linux der MT-Forschung — praktisch jedes akademische MT-Labor weltweit verwendete es. Sein Begleiter, **cdec** (entwickelt von Chris Dyer an der Carnegie Mellon), bot ähnliche Fähigkeiten mit einem anderen Formalismus. Zusammen prägten diese Werkzeuge ein Jahrzehnt der MT-Forschung.

Phrasenbasierte SMT funktionierte überraschend gut für Sprachpaare mit reichlich Paralleldaten und ähnlicher Wortstellung — Englisch–Französisch, Englisch–Spanisch, Englisch–Deutsch. Aber sie hatte tiefe strukturelle Einschränkungen. Das System hatte kein Konzept von Bedeutung. Es war Mustervergleich über Oberflächenketten, das Übersetzungen aus auswendig gelernten Fragmenten zusammensetzte. Es kämpfte mit weitreichenden Abhängigkeiten (ein Pronomen, das sich auf ein Substantiv mehrere Teilsätze zuvor bezieht), mit Umordnungen zwischen typologisch verschiedenen Sprachen (etwa Englisch–Japanisch, wo Verben in entgegengesetzten Positionen erscheinen) und mit jedem Phänomen, das echte Abstraktion über Sprachstruktur erforderte. Jede Verbesserung verlangte zunehmend barockes Engineering: handgefertigte Umordnungsregeln, dünn besetzte Merkmale, massive Sprachmodelle. Die Architektur näherte sich ihrer Obergrenze.

### Der Durchbruch: Sequence-to-Sequence mit Attention

Der erste Riss im SMT-Paradigma kam nicht von der MT-Community, sondern von Deep-Learning-Forschern, die an Problemen der Sequenzmodellierung arbeiteten.

Im September 2014 veröffentlichten **Dzmitry Bahdanau, Kyunghyun Cho und Yoshua Bengio** an der Université de Montréal eine Arbeit, die sich als transformativ erweisen sollte: ["Neural Machine Translation by Jointly Learning to Align and Translate"](https://arxiv.org/abs/1409.0473) (vorgestellt auf der ICLR 2015). Die zentrale Innovation war der **Attention-Mechanismus**.

Um zu verstehen, warum dies von Bedeutung war, benötigen Sie den vorherigen Kontext. Nur wenige Monate zuvor hatten Ilya Sutskever, Oriol Vinyals und Quoc V. Le bei Google ["Sequence to Sequence Learning with Neural Networks"](https://arxiv.org/abs/1409.3215) (NIPS 2014) veröffentlicht und gezeigt, dass ein neuronales Netz mit einer **Encoder-Decoder**-Architektur Sätze übersetzen konnte. Der Encoder liest den Quellsatz Wort für Wort und komprimiert ihn in einen einzigen Vektor fester Länge — eine numerische Zusammenfassung der gesamten Eingabe. Der Decoder erzeugt dann den Zielsatz Wort für Wort aus diesem Vektor.

Dies war elegant, hatte aber einen entscheidenden Mangel: Der einzelne Vektor war ein **Flaschenhals**. Alle Informationen eines dreißig Wörter umfassenden Quellsatzes mussten durch einen einzigen Vektor von beispielsweise 1.000 Zahlen gepresst werden. Kurze Sätze wurden recht gut übersetzt; lange Sätze verschlechterten sich stark, weil das Modell frühere Wörter vergaß, als es die späteren fertig kodiert hatte.

Bahdanaus Attention-Mechanismus löste dies. Anstatt die gesamte Quelle in einen Vektor zu komprimieren, durfte der Decoder auf alle verborgenen Zustände des Encoders **zurückblicken** — die Zwischenrepräsentationen an jeder Quellposition — und dynamisch gewichten, welche Positionen für die Erzeugung jedes Zielworts am relevantesten waren. Bei der Erzeugung des englischen Wortes „cat" konnte das Modell am stärksten auf das französische Wort „chat" in der Quelle achten, selbst wenn sie im Satz weit voneinander entfernt waren. Das Modell lernte, Quell- und Zielwörter als Teil des Übersetzungsprozesses zu *alignieren*, anstatt sich auf eine einzige komprimierte Zusammenfassung zu verlassen.

Dies war die grundlegende Innovation. Attention verbesserte nicht nur die maschinelle Übersetzung; es wurde zum zentralen Mechanismus praktisch aller nachfolgenden Fortschritte in der Verarbeitung natürlicher Sprache.

### Google wird neuronal

Die akademischen Ergebnisse von 2014–2015 waren beeindruckend, aber noch nicht produktionsreif. Das änderte sich Ende 2016.

Im September 2016 veröffentlichte ein großes Team bei Google unter der Leitung von **Yonghui Wu** ["Google's Neural Machine Translation System: Bridging the Gap Between Human and Machine Translation"](https://arxiv.org/abs/1609.08144). Das System, bekannt als **GNMT** (Google Neural Machine Translation), war eine industrielle Encoder-Decoder-Architektur mit Attention, trainiert auf Googles riesigen Paralleldatenressourcen. Die Arbeit erhob eine bemerkenswerte Behauptung: Bei bestimmten Sprachpaaren reduzierte GNMT die Übersetzungsfehler um 55–85 % im Vergleich zu Googles bestehendem phrasenbasiertem SMT-System.

Im November 2016 begann Google, Google Translate für die wichtigsten Sprachpaare stillschweigend von der phrasenbasierten SMT auf GNMT umzustellen. Der Übergang war für Sprachpaare mit vielen Ressourcen bis 2017 im Wesentlichen abgeschlossen. Für die Nutzer war die Veränderung dramatisch. Übersetzungen, die zuvor gestelzt, fragmentiert und gelegentlich unsinnig gewirkt hatten, wurden wesentlich flüssiger — bisweilen erstaunlich flüssig. Die Ära des „Google-Translate-Kauderwelschs" als Pointe ging zu Ende.

Die Reaktion der Konkurrenz ließ nicht lange auf sich warten. Im August 2017 startete **DeepL**, gegründet von **Gereon Frahling** in Köln, Deutschland, seinen Übersetzungsdienst. DeepL war aus dem zweisprachigen Konkordanzprojekt Linguee hervorgegangen und hob sich durch die wahrgenommene Übersetzungsqualität ab – insbesondere bei europäischen Sprachpaaren, wo es sich unter professionellen Übersetzern schnell den Ruf erwarb, natürlichere und idiomatischere Ergebnisse als Google zu liefern. Das Geschäftsmodell von DeepL (Freemium mit einer kostenpflichtigen API) und der Fokus auf Qualität statt Quantität sollten die zukünftige Marktposition des Unternehmens definieren. DeepL unterstützt etwa 33 Sprachen – weit weniger als die 194 auf der Cloud Translation-Liste von Google –, positioniert sich jedoch mit einem klaren Fokus auf Qualität.

### Der Transformer

Wenn Bahdanaus Attention-Mechanismus das Fundament war, dann war der **Transformer** das darauf errichtete Gebäude — und das Gebäude war ein Wolkenkratzer.

Im Juni 2017 veröffentlichte ein Team von acht Forschern bei Google — **Ashish Vaswani, Noam Shazeer, Niki Parmar, Jakob Uszkoreit, Llion Jones, Aidan N. Gomez, Łukasz Kaiser und Illia Polosukhin** — ["Attention Is All You Need"](https://arxiv.org/abs/1706.03762) auf der NIPS 2017. Der Titel war keine Übertreibung; er war eine präzise architektonische Aussage. Wo frühere Modelle rekurrente neuronale Netze (RNNs) als Rückgrat verwendeten — Wörter sequenziell verarbeitend, eines nach dem anderen, wie das Lesen eines Satzes von links nach rechts — verzichtete der Transformer vollständig auf Rekurrenz und stützte sich allein auf Attention.

Die zentralen Innovationen waren:

1. **Self-Attention**: Jedes Wort in einem Satz achtet auf jedes andere Wort im selben Satz und berechnet Beziehungen parallel statt sequenziell. Dies erfasst weitreichende Abhängigkeiten ohne den Informationsflaschenhals der RNNs und — entscheidend — es parallelisiert auf moderner Hardware (GPUs und TPUs), wodurch das Training dramatisch schneller wird.

2. **Multi-Head-Attention**: Anstatt ein einziges Attention-Muster zu berechnen, berechnet das Modell mehrere Attention-Muster gleichzeitig („Heads"), von denen jedes potenziell verschiedene Arten sprachlicher Beziehungen erfasst — syntaktische, semantische, positionelle.

3. **Positionskodierung**: Da Self-Attention alle Wörter gleichzeitig verarbeitet (anders als RNNs, die sequenziell verarbeiten), hat das Modell keinen inhärenten Begriff von Wortstellung. Positionskodierungen — in die Eingabe eingespeiste mathematische Funktionen — liefern diese Information.

Der Transformer übertraf RNN-basierte Modelle bei Übersetzungs-Benchmarks nicht nur. Er trainierte aufgrund seiner Parallelität **um Größenordnungen schneller**. Dies war wohl ebenso wichtig wie die Qualitätsverbesserung: Forscher konnten nun schneller iterieren, auf mehr Daten trainieren und auf größere Modelle skalieren. Der Teufelskreis der Skalierung — im positiven Sinne — hatte begonnen.

Innerhalb von zwei Jahren war die Transformer-Architektur zum Substrat für praktisch die gesamte hochmoderne Arbeit in der NLP geworden — nicht nur maschinelle Übersetzung, sondern auch Sprachmodellierung, Textklassifizierung, Frage-Antwort-Systeme, Zusammenfassung und schließlich die großen Sprachmodelle (GPT, BERT, LLaMA), die die breitere KI-Landschaft umgestalten sollten. Jedes System, das im weiteren Verlauf dieses Berichts besprochen wird, baut auf dem Transformer auf.

### Der WMT-2016-Wendepunkt

Die **Conference on Machine Translation** (WMT), jährlich als Workshop in Verbindung mit großen NLP-Konferenzen abgehalten, betreibt kompetitive **Shared Tasks**, bei denen Forschungsteams MT-Systeme einreichen und auf standardisierten Testdatensätzen gegeneinander bewertet werden. WMT ist das, was dem Feld der maschinellen Übersetzung einer öffentlichen Bestenliste am nächsten kommt.

Bei der **WMT 2016** übertrafen neuronale MT-Systeme die phrasenbasierten SMT-Systeme über praktisch alle Sprachpaare in der Shared Task hinweg entscheidend. Dies war der Moment, in dem sich der Schwerpunkt des Feldes verlagerte. Forscher, die Karrieren mit dem Bau phrasenbasierter Systeme verbracht hatten, begannen, sich für das neuronale Paradigma umzurüsten. Innerhalb von zwei Jahren hatten neue Veröffentlichungen, die phrasenbasierte SMT für etwas anderes als historische Vergleiche verwendeten, im Wesentlichen aufgehört. Moses, das Werkzeug, das ein Jahrzehnt geprägt hatte, wurde funktional ausgemustert.

Der Übergang war nach den Maßstäben akademischer Paradigmenwechsel bemerkenswert schnell — vielleicht drei bis vier Jahre von Bahdanaus Arbeit von 2014 bis zur nahezu vollständigen Dominanz der neuronalen maschinellen Übersetzung bis 2018. Für einen Forscher, der heute in das Feld einsteigt, ist phrasenbasierte SMT historischer Kontext, keine aktive Forschungsrichtung. Aber es ist wesentlicher Kontext, denn die Annahmen, Benchmarks und Evaluationsgewohnheiten der SMT-Ära hallen noch immer durch das Feld.

---

## Teil 2: Die multilinguale Wende (2018–2022) {#part-2-the-multilingual-turn-20182022}

### Ein Modell, viele Sprachen

Die erste Generation neuronaler MT-Systeme war **bilingual**: ein Modell pro Sprachpaar. Englisch–Französisch erforderte ein Modell; Französisch–Englisch erforderte ein separates. Diesen Ansatz auf N Sprachen zu skalieren erforderte theoretisch N×(N−1) Modelle — ein Engineering- und Datenflaschenhals, der neuronale maschinelle Übersetzung effektiv auf eine Handvoll gut ausgestatteter Paare beschränkte.

Die Frage, die 2018–2022 prägte, lautete: *Kann ein einzelnes neuronales Modell lernen, zwischen vielen Sprachen gleichzeitig zu übersetzen?* Die Antwort stellte sich als Ja heraus, mit tiefgreifenden und komplizierten Konsequenzen.

### Cross-linguale Repräsentationen: mBERT und XLM-R

Bevor multilinguale Übersetzungsmodelle erschienen, bereitete eine unerwartete Entdeckung bei Modellen des Sprach*verständnisses* die Bühne.

Ende 2018 veröffentlichte Google **Multilingual BERT (mBERT)** — ein einzelnes Transformer-Modell, trainiert auf Wikipedia-Texten aus 104 Sprachen. BERT (Bidirectional Encoder Representations from Transformers) war kein Übersetzungsmodell; es war ein universeller Sprach-Encoder, trainiert, um maskierte Wörter in Texten vorherzusagen. Was die Forscher überraschte, war eine emergente Eigenschaft: mBERT entwickelte **cross-linguale Repräsentationen**, ohne ihm jemals explizit beigebracht worden zu sein, dass Sprachen verwandt sind. Wenn man mBERT auf einer englischen Sentiment-Klassifizierungsaufgabe feinjustierte und es dann auf französischen Text anwendete — ganz ohne französische Trainingsdaten — schnitt es bemerkenswert gut ab. Dieses Phänomen, genannt **Zero-Shot-Cross-Lingual-Transfer**, deutete darauf hin, dass multilinguale Modelle eine Art geteilten Repräsentationsraum über Sprachen hinweg lernten.

Im Jahr 2020 trieben **Alexis Conneau** und Kollegen bei Facebook AI Research (heute Meta) dies mit **XLM-R** (Cross-lingual Language Model – RoBERTa) weiter voran. Trainiert auf 2,5 Terabyte gefilterter CommonCrawl-Daten über 100 Sprachen hinweg, übertraf XLM-R mBERT deutlich bei cross-lingualen Benchmarks. Es demonstrierte, dass ein einzelner Encoder mit genügend Daten und Modellkapazität robuste multilinguale Repräsentationen aufbauen konnte.

Diese Modelle waren selbst keine Übersetzer, lieferten aber das konzeptionelle und technische Fundament für die multilinguale maschinelle Übersetzung. Wenn ein Modell geteilte Repräsentationen über 100 Sprachen lernen konnte, dann sollte ein Übersetzungsmodell — zumindest im Prinzip — in der Lage sein, zwischen ihnen zu übersetzen.

### Many-to-Many-Übersetzung: M2M-100

Traditionelle multilinguale MT-Systeme hatten ein schmutziges Geheimnis: Sie leiteten die meisten Übersetzungen **über das Englische**. Eine Übersetzung von Portugiesisch nach Japanisch bedeutete, zuerst Portugiesisch ins Englische zu übersetzen und dann Englisch ins Japanische. Dieser „englisch-zentrische" Ansatz war pragmatisch — die meisten Paralleldaten haben das Englische auf einer Seite — führte aber zu sich verstärkenden Fehlern und zwang jeder Übersetzung englische Sprachstruktur auf.

Im Oktober 2020 veröffentlichte Facebook AI **M2M-100** (Fan et al., ["Beyond English-Centric Multilingual Machine Translation"](https://arxiv.org/abs/2010.11125), JMLR 2021): ein Many-to-Many-Übersetzungsmodell, das **100 Sprachen und 2.200 Übersetzungsrichtungen** abdeckt, ohne über das Englische zu leiten. Dies war ein konzeptioneller Durchbruch. Das Modell konnte direkt zwischen, sagen wir, Bengali und Suaheli übersetzen, indem es aus dem Web geschürfte Paralleldaten für nicht-englische Paare verwendete.

M2M-100 bewies, dass das Pivoting über das Englische keine notwendige Einschränkung der multilingualen maschinellen Übersetzung war. Aber es offenbarte auch die Grenzen des Ansatzes: Die Qualität war über die Sprachpaare hinweg sehr ungleichmäßig, wobei einige Richtungen kaum nutzbar waren. Die Kluft zwischen „dieses Modell *deckt* 2.200 Richtungen ab" und „dieses Modell *funktioniert gut* in 2.200 Richtungen" sollte zu einem zentralen Thema werden.

### NLLB-200: No Language Left Behind

Metas ambitioniertestes multilinguales MT-Projekt kam im Juli 2022 mit **NLLB-200** (["No Language Left Behind: Scaling Human-Centered Machine Translation"](https://arxiv.org/abs/2207.04672), veröffentlicht als Meta-AI-Forschungsarbeit mit über 200 Co-Autoren). Das Ziel war im Namen explizit: ein einzelnes Modell zu bauen, das 200 Sprachen unterstützt, mit besonderem Fokus auf Low-Resource-Sprachen, die zuvor von kommerzieller maschineller Übersetzung ignoriert wurden.

Die technischen Beiträge von NLLB-200 waren beträchtlich:

- **Architektur**: Ein dichter Transformer und eine **Mixture-of-Experts (MoE)**-Variante, bei der für verschiedene Sprachpaare unterschiedliche Teilmengen der Modellparameter aktiviert werden. Die größte Variante, NLLB-200-MoE-54B, hatte 54 Milliarden Parameter. Eine destillierte 600M-Parameter-Version machte die Bereitstellung praktikabel.

- **Data-Mining**: Das Team entwickelte automatisierte Werkzeuge zum Schürfen paralleler Sätze aus Web-Crawls, darunter ein Modell zur Sprachidentifikation (über 200 Sprachen abdeckend) und einen Filter für parallele Sätze. Diese Pipeline war entscheidend für die Sammlung von Trainingsdaten für Sprachen mit minimaler Web-Präsenz.

- **FLORES-200**: Ein standardisierter Evaluations-Benchmark, der alle 200 Sprachen mit professionell übersetzten Sätzen abdeckt. FLORES-200 wurde zu einem wesentlichen Werkzeug für das Feld — zuvor existierte für die meisten dieser Sprachen kein Benchmark.

- **Offene Veröffentlichung**: Sowohl das Modell als auch FLORES-200 wurden offen veröffentlicht, was Forschern weltweit ermöglichte, auf der Arbeit aufzubauen.

NLLB-200 war ein Meilenstein, aber seine Grenzen sind ebenso wichtig zu verstehen. Die Qualität variierte enorm über die Sprachen hinweg. Für gut ausgestattete Paare (Englisch–Französisch, Englisch–Chinesisch) war das Modell kompetent, aber im Vergleich zu spezialisierten Systemen nicht hochmodern. Für Low-Resource-Sprachen reichte die Ausgabequalität von nützlich bis im Wesentlichen funktionsunfähig, je nachdem, wie viele Trainingsdaten geschürft worden waren. Das Modell zeigte auch den **Fluch der Multilingualität**: Das Hinzufügen weiterer Sprachen zu einem Modell mit fester Kapazität verwässert die Repräsentationsqualität für jede Sprache. Low-Resource-Sprachen profitieren vom Transferlernen (geteilte Struktur mit verwandten Sprachen), aber High-Resource-Sprachen können tatsächlich *schlechter* werden, wenn das Modell versucht, zu vielen Herren zu dienen. Dies ist nicht bloß ein Skalierungsproblem — es spiegelt eine grundlegende Spannung im Design multilingualer Modelle wider.

### Die Seamless-Suite

Meta trieb die multilinguale maschinelle Übersetzung mit der **Seamless**-Modellfamilie in den Jahren 2023–2024 weiter voran. **SeamlessM4T** („Massively Multilingual and Multimodal Machine Translation", August 2023) war ein einzelnes Modell, das **Sprache-zu-Sprache-, Sprache-zu-Text-, Text-zu-Sprache- und Text-zu-Text-Übersetzung** über etwa 100 Sprachen hinweg bewältigte (mit unterschiedlicher Abdeckung über die Modalitäten). Dies stellte eine Konvergenz zuvor getrennter Forschungsstränge dar — automatische Spracherkennung (ASR), Textübersetzung und Text-zu-Sprache (TTS) — in einem einheitlichen multilingualen System.

Die nachfolgende **Seamless-Communication**-Suite fügte Streaming-Fähigkeiten (Übersetzung nahezu in Echtzeit) und expressive Sprachübersetzung (Erhalt von Stimmcharakteristika wie Emotion und Sprechstil über Sprachen hinweg) hinzu. Diese Systeme bleiben eher Forschungsprototypen als produktionsreife Werkzeuge, aber sie signalisieren die Richtung des Feldes: multimodal, multilingual und in Echtzeit.

### Was „massiv multilingual" in der Praxis bedeutet

Für einen Forscher, der in dieses Feld einsteigt, ist es entscheidend, zwischen der **Sprachabdeckung** eines Modells und seiner **Sprachqualität** zu unterscheiden. Ein Modell, das „200 Sprachen unterstützt", liefert möglicherweise für 20 davon ausgezeichnete Übersetzungen, für 50 brauchbare Ausgaben und für den Rest im Wesentlichen Zufallstext. Die Schlagzeilenzahl ist ohne sprachspezifische Qualitätsbewertung irreführend.

Der **Fluch der Multilingualität** ist der Fachbegriff für das Problem der Kapazitätsverwässerung: Ein Modell mit endlichen Parametern kann nicht alle Sprachen gleich gut repräsentieren. Das Hinzufügen weiterer Sprachen nützt den Sprachen mit den geringsten Ressourcen (durch cross-lingualen Transfer von verwandten Sprachen), schadet aber den ressourcenstärksten (indem es Kapazität verbraucht, die ihnen hätte gewidmet werden können). Dies erzeugt eine Designspannung: Baut man ein universelles Modell oder viele spezialisierte? Das Feld hat diese Frage nicht gelöst.

---

## Teil 3: Die LLM-Ära (2022–2026) {#part-3-the-llm-era-20222026}

### Als universelle KI das Übersetzen lernte

Die Ankunft großer Sprachmodelle (LLMs) — GPT-3.5/4, Gemini, Claude, LLaMA — schuf eine eigenartige Situation im Feld der maschinellen Übersetzung. Diese Modelle waren nicht speziell für die Übersetzung trainiert worden. Sie waren trainiert, das nächste Token in riesigen Textkorpora vorherzusagen, vorwiegend englischen, aber zunehmend multilingualen. Doch wenn man sie mit Anweisungen wie „Übersetze den folgenden französischen Satz ins Englische" promptete, produzierten sie Übersetzungen, die für High-Resource-Sprachpaare erstaunlich gut waren.

Dies stellte das Feld vor eine Identitätsfrage: Wenn universelle KI ebenso gut übersetzen kann wie zweckgebaute Übersetzungssysteme, bleibt „maschinelle Übersetzung" dann ein eigenständiges Forschungsgebiet? Die Antwort lautet, Stand 2026, ein eingeschränktes Ja — aber die Beziehung zwischen MT-Forschung und der Entwicklung universeller LLMs ist tief verflochten geworden.

### Die ersten Benchmarks: LLMs gegen dedizierte maschinelle Übersetzung

Die systematische Evaluation von LLMs für die Übersetzung begann Anfang 2023, kurz nach der Veröffentlichung von ChatGPT (November 2022) und GPT-4 (März 2023).

**Jiao et al. (2023)** lieferten in ["Is ChatGPT A Good Translator? Yes With GPT-4 As The Engine"](https://arxiv.org/abs/2301.08745) eine frühe Einschätzung. Ihre Erkenntnisse begründeten ein Muster, das bemerkenswert stabil geblieben ist: LLMs sind **hochgradig wettbewerbsfähig für europäische High-Resource-Sprachpaare** (Englisch–Deutsch, Englisch–Französisch, Englisch–Chinesisch) und **deutlich schwächer für Low-Resource- und typologisch entfernte Paare**. Sie führten auch das **Pivot-Prompting** ein — die Anweisung an das Modell, über eine Zwischensprache zu übersetzen — das die Leistung bei schwierigen Paaren verbesserte.

**Hendy et al. (2023)** bei Microsoft ([arXiv:2302.09210](https://arxiv.org/abs/2302.09210)) führten eine umfassendere Evaluation über 18 Übersetzungsrichtungen durch. Ihre Schlussfolgerung: GPT-Modelle waren für High-Resource-Paare mit hochmoderner kommerzieller maschineller Übersetzung konkurrenzfähig, hatten aber bei Low-Resource-Sprachen „begrenzte Fähigkeiten".

Bis 2024–2025 hatte sich das Bild geschärft. Für **High-Resource-Paare** erreichten oder übertrafen die besten LLMs (GPT-4o, Gemini 2.5 Pro, Claude 3.5 Sonnet) dedizierte MT-Systeme, insbesondere bei Aufgaben, die kontextuelles Verständnis, idiomatischen Ausdruck und dokumentebene-Kohärenz erfordern — Bereiche, in denen traditionelle neuronale maschinelle Übersetzung, die Sätze isoliert verarbeitet, schon immer Mühe hatte. Für **Low-Resource-Paare** übertreffen dedizierte multilinguale Modelle wie NLLB-200 und die zweckgebauten Systeme von Google Translate LLMs noch immer, oft deutlich.

### BLOOM: Der offene multilinguale Moment

Im Juli 2022 veröffentlichte die **BigScience**-Kollaboration — eine einjährige freiwillige Anstrengung, koordiniert von Hugging Face und Hunderte von Forschern weltweit einbeziehend — **BLOOM**: ein multilinguales Sprachmodell mit 176 Milliarden Parametern und offenem Zugang, das **46 natürliche Sprachen und 13 Programmiersprachen** abdeckt. Trainiert auf dem ROOTS-Korpus unter Verwendung des Jean-Zay-Supercomputers in Frankreich, war BLOOM das erste wirklich massive multilinguale LLM mit offenem Zugang.

BLOOM war kein dedizierter Übersetzer, aber seine Bedeutung für die maschinelle Übersetzung war beträchtlich. Es demonstrierte, dass quelloffene Modelle Dutzende von Sprachen im großen Maßstab unterstützen konnten, und lieferte ein Fundament für multilinguale Forschung außerhalb von Unternehmenslaboren. Seine instruktionsfeinjustierte Variante, **BLOOMZ**, zeigte cross-linguale Generalisierungsfähigkeiten — auf Aufgaben in einer Sprache feinjustiert, konnte es diese in anderen ausführen.

### LLaMA und die Feinjustierungs-Explosion

Metas **LLaMA**-Serie (Large Language Model Meta AI), beginnend im Februar 2023, schlug einen anderen Weg ein. LLaMA 1 war vorwiegend englisch-zentrisch, mit begrenzten multilingualen Fähigkeiten. LLaMA 2 (Juli 2023) verbesserte dies geringfügig, klassifizierte die nicht-englische Verwendung aber noch immer als „außerhalb des Anwendungsbereichs". Der Wendepunkt kam mit **LLaMA 3** (April 2024), das die Trainingsdaten versiebenfachte und ein Vokabular von 128.000 Token einführte — was die Kodierung nicht-englischen Texts dramatisch verbesserte. LLaMA 3 unterstützte offiziell acht Sprachen (Englisch, Deutsch, Französisch, Italienisch, Portugiesisch, Hindi, Spanisch, Thailändisch) mit unterschiedlicher Qualität für viele weitere.

LLaMAs Bedeutung für die maschinelle Übersetzung liegt weniger in seiner direkten Übersetzungsfähigkeit und mehr in seiner Rolle als **Foundation-Modell für die Feinjustierung**. Beide der unten besprochenen spezialisierten Übersetzungs-LLMs — Tower und ALMA — bauen auf LLaMA auf. Die offenen Gewichte schufen ein florierendes Ökosystem spezialisierter Ableger.

### Zweckgebaute Übersetzungs-LLMs: Tower und ALMA

Die bedeutendste Entwicklung von 2023–2024 war das Aufkommen von LLMs, die speziell für die Übersetzung feinjustiert wurden — Hybridsysteme, die die kontextuelle Raffinesse universeller LLMs erben, aber für Übersetzungsqualität optimiert sind.

**ALMA** (Advanced Language Model-based trAnslator), entwickelt von **Haoran Xu** und Kollegen an der Johns Hopkins University, demonstrierte eine zentrale Erkenntnis: Man benötigt keine massiven Parallelkorpora, um einen ausgezeichneten Übersetzer zu bauen. ALMA verwendete einen **zweistufigen Feinjustierungs**-Ansatz auf LLaMA-2: zunächst fortgesetztes Pretraining auf nicht-englischen monolingualen Daten zur Erweiterung des multilingualen Wissens; dann Feinjustierung auf einem kleinen, hochwertigen Paralleldatensatz. Der Nachfolger **ALMA-R** (Januar 2024) führte **Contrastive Preference Optimisation (CPO)** ein — das Training des Modells auf Präferenzdaten (bessere vs. schlechtere Übersetzungen) statt nur auf Paralleltext. Das Ergebnis: 7B- und 13B-Parameter-Modelle, die GPT-4 bei Übersetzungs-Benchmarks erreichten oder übertrafen. Die Arbeit wurde auf der ICLR 2024 veröffentlicht ([arXiv:2309.11674](https://arxiv.org/abs/2309.11674)). Eine spätere Version, **X-ALMA**, erweiterte die Abdeckung auf 50 Sprachen unter Verwendung sprachspezifischer Plug-and-Play-Module.

**Tower**, entwickelt von **Unbabel** (einem portugiesischen KI-Übersetzungsunternehmen) in Zusammenarbeit mit dem SARDINE Lab und dem MICS Lab, nahm eine breitere Sichtweise ein. Statt allein für die Übersetzung zu optimieren, deckte Tower die **gesamte Übersetzungspipeline** ab: Quellkorrektur, Eigennamenerkennung, Post-Editing, Übersetzungsrangfolge und Fehlererkennung. Die ersten Tower-Modelle (7B und 13B, basierend auf LLaMA-2) übertrafen NLLB-200-54B. **Tower v2** (70B, vorgestellt auf der WMT 2024) übertraf GPT-4o, Claude 3.5 Sonnet und DeepL. Das neueste **Tower+** (2025) erweiterte sich auf 22–27 Sprachen und befasste sich mit dem „katastrophalen Vergessen" — der Tendenz feinjustierter Modelle, allgemeine Fähigkeiten zu verlieren — durch Präferenzoptimierung und bestärkendes Lernen.

### Prompting vs. Feinjustierung: Die anhaltende Debatte

Eine beständige Frage im LLM-MT-Bereich ist, ob es besser ist, ein universelles LLM für die Übersetzung zu **prompten** (Zero-Shot oder Few-Shot) oder ein Modell speziell für die Übersetzung **feinzujustieren**. Die Evidenz legt nahe, dass die Antwort aufgabenabhängig ist:

- **Prompting** bewahrt die allgemeinen Fähigkeiten des LLM — Formalitätssteuerung, Stilkontrolle, Dokumentebene-Kohärenz — und erfordert kein zusätzliches Training. Es ist ideal für schnelle Iteration sowie kreative oder kontextuelle Übersetzung.
- **Feinjustierung** erzielt höhere Genauigkeit bei spezifischen Sprachpaaren und Domänen, riskiert aber die Verschlechterung anderer Fähigkeiten („katastrophales Vergessen"). Sie erfordert Paralleldaten und Rechenleistung.
- **Hybridansätze** sind in der Praxis zunehmend dominant: feinjustierte Modelle für die Erstübersetzung, mit LLM-basiertem Post-Editing oder Selbstverfeinerungsdurchläufen.

### Der aktuelle Stand der Technik (2025–2026)

Die ehrliche Antwort auf „Was ist das beste MT-System?" lautet: **Es kommt darauf an.**

| Anwendungsfall | Bester Ansatz | Warum |
|---|---|---|
| High-Resource, hohes Volumen | Kommerzielle NMT (Google, DeepL) | Geschwindigkeit, Kosten, Konsistenz |
| High-Resource, hohe Qualität | LLMs (GPT-4o, Gemini 2.5 Pro) oder Tower+ | Kontextuelles Verständnis, Idiomverarbeitung |
| Low-Resource, breite Abdeckung | Meta OMT, NLLB-200, Google Translate | Zweckgebaute multilinguale Abdeckung |
| Low-Resource, spezifisches Paar | Feinjustiertes NLLB oder LLM auf Domänendaten | Gezielte Qualitätsverbesserung |
| Quelloffene Forschung | Tower+, ALMA-R, X-ALMA | Offene Gewichte, reproduzierbar, wettbewerbsfähig |

Im März 2026 veröffentlichte Meta **OMT (Omnilingual Machine Translation)** — den Nachfolger von NLLB-200, der die Abdeckung von 200 auf **über 1.600 Sprachen** erweitert. OMT befasst sich mit dem, was Meta den „Generierungsflaschenhals" nennt: Große Sprachmodelle können viele Sprachen verstehen, haben aber Mühe, flüssigen Text in ihnen zu generieren. OMT kommt in zwei Architekturen — OMT-LLaMA (decoder-only, 1B–8B Parameter) und OMT-NLLB (encoder-decoder) — und führt neue Evaluationswerkzeuge ein, darunter BOUQuET und BLASER 3 (eine referenzfreie Qualitätsschätzungsmetrik). Erste Berichte deuten darauf hin, dass die 1B–8B-Parameter-Modelle bei Übersetzungsaufgaben 70B-LLM-Baselines erreichen oder übertreffen. Ob OMT schließlich Plains Cree oder andere Algonkin-Sprachen einbeziehen wird, bleibt abzuwarten.

Die Arbeit zu den Erkenntnissen der WMT-2024-Shared-Task trug treffend den Titel **„The LLM Era Is Here but MT Is Not Solved Yet."** LLMs haben die Obergrenze für High-Resource-Übersetzung angehoben, aber die grundlegenden Herausforderungen der Low-Resource-Übersetzung, der Angemessenheit der Evaluation oder der morphologischen Komplexität nicht gelöst.

---

## Teil 4: Das Low-Resource-Problem {#part-4-the-low-resource-problem}

### Warum die meisten Sprachen zurückgelassen werden

Von den weltweit etwa 7.000 lebenden Sprachen decken kommerziell eingesetzte MT-Dienste (maschinelle Übersetzung) rund 200 ab, und alle Formen der maschinellen Übersetzung zusammen erreichen nur etwa 550 ([wie wir zählen](/docs/network/context/coverage-counting)). Für die überwiegende Mehrheit der Sprachen gibt es **überhaupt keine maschinelle Übersetzung**. Um zu verstehen, warum das so ist, muss man begreifen, was MT-Systeme benötigen und woran es den meisten Sprachen mangelt.

Neuronale maschinelle Übersetzung benötigt **Paralleldaten**: große Sammlungen von Sätzen, die von Menschen zwischen zwei Sprachen übersetzt wurden. Für Englisch–Französisch existieren diese Daten in Hülle und Fülle — EU-Parlamentsprotokolle (Europarl), UN-Dokumente, Nachrichtenarchive und kommerzielle Übersetzungsspeicher liefern Hunderte von Millionen paralleler Sätze. Für eine Sprache wie Plains Cree (*nêhiyawêwin*), gesprochen von etwa 20.000 Menschen vorwiegend im Westen Kanadas, existieren solche Daten im Wesentlichen nicht. Es gibt keine UN-Protokolle in Plains Cree. Es gibt keine zweisprachigen Nachrichtenkorpora. Der gesamte verfügbare Paralleltext lässt sich vielleicht in Tausenden statt in Millionen von Sätzen messen.

Das Feld verwendet grobe Ressourcenstufen zur Kategorisierung von Sprachen:

| Stufe | Verfügbare Paralleldaten | Beispiele |
|---|---|---|
| High-Resource | >10 Millionen Satzpaare | Englisch, Französisch, Deutsch, Chinesisch, Spanisch |
| Medium-Resource | 1–10 Millionen Paare | Türkisch, Vietnamesisch, Suaheli |
| Low-Resource | 100K–1 Million Paare | Yoruba, Guaraní, Maltesisch |
| Extrem Low-Resource | <100K Paare | Plains Cree, Quechua, die meisten indigenen Sprachen |
| Im Wesentlichen null | <10K Paare | Tausende von Sprachen weltweit |

### Das Tokenizer-Problem

Bevor ein neuronales Modell Text verarbeiten kann, muss es Zeichen in numerische Token umwandeln — ein Prozess namens **Tokenisierung**. Der vorherrschende Tokenisierungsalgorithmus ist **Byte Pair Encoding (BPE)**, popularisiert von Sennrich et al. (2016) und implementiert in Werkzeugen wie **SentencePiece** (Kudo & Richardson, 2018). BPE funktioniert, indem es die häufigsten Zeichensequenzen in einem Trainingskorpus lernt und ein Vokabular von Teilworteinheiten aufbaut. Im Englischen werden häufige Wörter wie „the" zu einzelnen Token; seltene Wörter werden in Teilwortstücke zerlegt („unforgivable" → „un" + „forgiv" + „able").

Das Problem ist, dass BPE-Vokabulare vorwiegend auf High-Resource-Sprachen trainiert werden, wobei das Englische typischerweise dominiert. Für Low-Resource-Sprachen, insbesondere solche mit komplexer Morphologie oder nicht-lateinischen Schriften, sind die Konsequenzen gravierend:

- **Übersegmentierung**: Ein einzelnes Wort in einer polysynthetischen Sprache wie Plains Cree könnte einen ganzen Teilsatz kodieren. Das Wort *nikî-nipâw* („Ich schlief") würde in zahlreiche Fragmente zerlegt — möglicherweise einzelne Bytes — weil der BPE-Algorithmus diese Zeichensequenzen nie zuvor gesehen hat. Was für einen Sprecher eine bedeutungstragende Einheit ist, wird für das Modell zu einem Dutzend bedeutungsloser Fragmente.

- **Das Fertilitätsproblem**: Ein einzelnes Wort in einer morphologisch komplexen Sprache könnte 5–15 Token erfordern, während seine englische Übersetzung 1–3 verwendet. Dies erzeugt eine massive Asymmetrie in der Sequenzlänge, die die Attention-Alignierung und Übersetzungsqualität verschlechtert.

- **Schrift-Nachteile**: Sprachen, die nicht-lateinische Schriften verwenden (Cree-Silbenschrift, Äthiopisch, Devanagari), werden noch ineffizienter tokenisiert und fallen manchmal auf einzelne Bytes zurück. Dies bedeutet, dass das effektive Kontextfenster des Modells für diese Sprachen dramatisch kleiner ist.

Dies ist nicht bloß eine technische Unannehmlichkeit. Das Vokabular des Tokenizers kodiert effektiv eine Verzerrung zugunsten gut ausgestatteter Sprachen auf der grundlegendsten Ebene des Systems. Ein Modell, das 15 Token zur Kodierung eines einzigen Cree-Worts aufwendet, hat weit weniger Kapazität übrig, um den Rest des Satzes zu verstehen, verglichen mit einem Modell, das Englisch verarbeitet, wo dieselbe Information vielleicht 3 Token belegt.

### Das Datenqualitätsproblem

Die begrenzten Paralleldaten, die für Low-Resource-Sprachen existieren, stammen oft aus **engen Domänen**. Die zwei größten Quellen multilingualen Paralleltexts für unterausgestattete Sprachen sind:

1. **Bibelübersetzungen**: Die Bibel ist in über 700 Sprachen übersetzt worden, und Teile in über 3.000. Dies macht religiösen Text zur am häufigsten verfügbaren parallelen Ressource für viele Sprachen — aber ein Modell, das vorwiegend auf biblischem Text trainiert wird, lernt ein spezifisches Register, Vokabular und eine spezifische Domäne. Es kann „du sollst nicht" produzieren, aber nicht „bitte buchen Sie einen Flug" übersetzen.

2. **JW300**: Ein Datensatz, der aus Publikationen der Zeugen Jehovas extrahiert wurde und etwa 300 Sprachen abdeckt. Obwohl groß und multilingual, wirft JW300 sowohl Probleme der Domänenverzerrung (religiöse Inhalte) als auch ethische Bedenken hinsichtlich der Herkunft und der Einwilligung der zugrunde liegenden Übersetzungen auf.

**Benchmark-Kontamination** ist ein weiteres ernsthaftes Problem. Wenn Paralleldaten knapp sind, kann derselbe Text sowohl in Trainings- als auch in Evaluationsdatensätzen landen — ein Datenleck, das die Qualitätsmetriken aufbläht. Je kleiner der Datenpool, desto schwieriger ist dies zu verhindern und zu erkennen.

### Datenaugmentierung: Aus weniger mehr machen

Forscher haben Techniken entwickelt, um begrenzte Daten zu strecken:

- **Backtranslation** (Sennrich et al., 2016): Ein anfängliches Modell auf verfügbaren Paralleldaten trainieren, dann damit **monolingualen** zielsprachlichen Text zurück in die Quellsprache übersetzen. Dies erzeugt synthetische Paralleldaten, die verrauscht sind, aber die Modellqualität erheblich verbessern können. Backtranslation ist zu einer Standardtechnik über das gesamte Ressourcenspektrum hinweg geworden.

- **LLM-generierte synthetische Daten**: Die Verwendung großer Sprachmodelle zur Generierung von Trainingsdaten für Low-Resource-Paare. Dies ist vielversprechend, birgt aber Risiken — der generierte Text kann „Übersetzerisch" aufweisen (unnatürlich wörtliche oder quellbeeinflusste Muster) und kann jegliche im LLM vorhandenen Verzerrungen verstärken.

- **Cross-lingualer Transfer**: Training auf Paralleldaten einer verwandten ressourcenstärkeren Sprache (z. B. Verwendung von Spanisch–Englisch-Daten, um Guaraní–Englisch-MT in Gang zu setzen) in der Hoffnung, dass die geteilten strukturellen Merkmale übertragen werden. Dies funktioniert für eng verwandte Sprachen besser als für typologisch entfernte.

- **Morphologische Segmentierung**: Vorverarbeitung von Text zur Zerlegung von Wörtern in Morpheme (kleinste bedeutungstragende Einheiten), bevor sie dem Modell zugeführt werden. Für agglutinierende und polysynthetische Sprachen kann dies die Tokenisierungseffizienz und Übersetzungsqualität dramatisch verbessern. Dieser Ansatz steht in direktem Zusammenhang mit den regelbasierten Werkzeugen, die im nächsten Abschnitt besprochen werden.

---

## Teil 5: Finite-State-Transduktoren und regelbasierte Systeme {#part-5-finite-state-transducers-and-rule-based-systems}

### Warum Regeln noch immer von Bedeutung sind

Die bisherige Erzählung war eine der neuronalen Dominanz: statistische Systeme ersetzt durch neuronale Netze, neuronale Netze ersetzt durch Transformer, Transformer skaliert zu LLMs. Aber es gibt eine parallele Tradition in der Computerlinguistik, die nie verschwand — und für bestimmte Sprachen bleibt sie unverzichtbar.

**Regelbasierte Systeme** kodieren explizites linguistisches Wissen: morphologische Regeln, Lexika, syntaktische Transfermuster. Sie lernen nicht aus Daten; sie werden von Linguisten gebaut, die die beteiligten Sprachen verstehen. Für gut ausgestattete Sprachen wurde dieser Ansatz längst von datengetriebenen Methoden überholt. Aber für Sprachen mit komplexer Morphologie und minimalen Daten bieten regelbasierte Systeme oft die einzige verlässliche verfügbare Analyse.

### Finite-State-Transduktoren: Eine Einführung

Ein **Finite-State-Transduktor (FST)** ist ein Rechengerät, das zwischen zwei Repräsentationsebenen abbildet — typischerweise zwischen einer Oberflächenform (was man im Text sieht) und einer zugrunde liegenden Analyse (was es linguistisch bedeutet). Stellen Sie es sich als eine Maschine mit Zuständen und Übergängen vor: Sie liest Eingabesymbole, bewegt sich zwischen Zuständen und produziert Ausgabesymbole.

Betrachten Sie als konkretes Beispiel das Plains-Cree-Wort *nikî-nipâw*. Ein FST-basierter morphologischer Analysator kann diese Oberflächenform nehmen und produzieren:

> nipâw + Verb + AI + Independent + Past + 1st Person Singular

Dies sagt Ihnen, dass das Wort das Verb *nipâw* („schlafen") im unabhängigen Modus ist, Vergangenheitsform, erste Person Singular — „Ich schlief". Der Transduktor kodiert die Regeln der Cree-Morphologie: welche Präfixe Person anzeigen, welche Tempus markieren, welche Verbformen welche Flexionsmuster annehmen. Entscheidend ist, dass dies **bidirektional** funktioniert: Gegeben eine Analyse, kann der FST die korrekte Oberflächenform erzeugen.

Die technische Infrastruktur zum Bau von FSTs umfasst:

- **HFST** (Helsinki Finite-State Transducer Technology): Ein quelloffenes Toolkit, gepflegt an der University of Helsinki, das den Rechenrahmen für den Bau und Betrieb von Transduktoren bereitstellt. HFST implementiert die ursprünglich von Xerox entwickelten Formalismen (lexc, twolc, xfst) und ist mit **foma**, einem weiteren quelloffenen FST-Toolkit, kompatibel.

- **lexc**: Ein Formalismus zur Spezifikation des **Lexikons** — des Inventars von Morphemen (Wurzeln, Präfixe, Suffixe) und der Wortbildungsmuster, die sie kombinieren.

- **twolc**: Ein Formalismus zur Spezifikation **morphophonologischer Regeln** — der Lautveränderungen, die auftreten, wenn Morpheme kombiniert werden (z. B. Vokalharmonie, Konsonantenmutation).

### GiellaLT: Arktische Infrastruktur

**GiellaLT** (vom nordsamischen Wort *giella*, „Sprache") ist eine Sprachtechnologie-Infrastruktur mit Sitz an der **UiT — The Arctic University of Norway** in Tromsø. Sie stellt die umfangreichste weltweite Anstrengung dar, FST-basierte Werkzeuge für indigene und Minderheitensprachen zu bauen.

Ursprünglich bekannt als **Giellatekno** (Forschung) und **Divvun** (Sprachwerkzeuge), hat das Projekt – geleitet von den Linguisten **Trond Trosterud** und **Sjur Nørstebø Moshagen** – morphologische Analysatoren, Rechtschreibprüfungen und andere Sprachwerkzeuge für über **100 Sprachen** entwickelt, mit einem Schwerpunkt auf samischen Sprachen (Nordsamisch, Lulesamisch, Südsamisch und andere), uralischen Sprachen sowie weiteren arktischen und indigenen Sprachen.

GiellaLT verwendet HFST als Rechen-Backend und hat eine ausgefeilte geteilte Infrastruktur entwickelt: ein gemeinsames Build-System, geteilte Test-Frameworks und wiederverwendbare linguistische Komponenten. Der gesamte Code ist quelloffen, gehostet auf [GitHub](https://github.com/giellalt), mit Hunderten von Repositories, darunter Kerninfrastruktur und sprachspezifische Repos (z. B. `lang-sme` für Nordsamisch, `lang-crk` für Plains Cree). Die Dokumentation des Projekts befindet sich unter [giellalt.github.io](https://giellalt.github.io/). Das öffentlich zugängliche Portal **[Borealium.org](https://borealium.org)** — finanziert vom Nordischen Ministerrat — bietet freien Zugang zu Korrekturwerkzeugen, Tastaturen, Wörterbüchern, Sprachlernwerkzeugen (Oahpa) und Sprachsynthese für samische Sprachen, Kvenisch, Färöisch, Grönländisch und andere.

Die Beziehung zwischen GiellaLT und der nationalen Sprachpolitik ist bemerkenswert. Ein Großteil der Finanzierung des Projekts stammt vom **Norwegischen Sámi-Parlament** und nordischen Regierungssprachprogrammen, was ein politisches Engagement für indigene Sprachtechnologie widerspiegelt, das in Umfang und Dauer ungewöhnlich ist.

### Apertium: Quelloffene regelbasierte maschinelle Übersetzung

**[Apertium](https://www.apertium.org/)** ist eine quelloffene regelbasierte Plattform für maschinelle Übersetzung, ursprünglich an der Universitat d'Alacant (Spanien) mit Mitteln der spanischen und katalanischen Regierung entwickelt. Es begann 2004 mit einem Fokus auf verwandte Sprachpaare (Spanisch–Katalanisch, Spanisch–Portugiesisch), bei denen oberflächliche Transferregeln — Wort-für-Wort-Übersetzung mit morphologischen Anpassungen — überraschend gute Ergebnisse erzielen. Zu den wichtigsten Mitwirkenden gehört **Francis M. Tyers**, der sowohl für Apertiums Entwicklung als auch für seine Übernahme für unterausgestattete Sprachen zentral war.

Apertiums Architektur ist eine klassische **Pipeline**:

1. **Morphologische Analyse** (FST-basiert): Lemma und morphologische Merkmale jedes Worts identifizieren
2. **Wortarten-Disambiguierung**: Die korrekte Analyse wählen, wenn Wörter mehrdeutig sind
3. **Lexikalischer Transfer**: Quellsprachliche Lemmata auf zielsprachliche Lemmata abbilden
4. **Struktureller Transfer**: Regeln anwenden, um Wortstellungsänderungen, Kongruenz und andere syntaktische Unterschiede zu bewältigen
5. **Morphologische Generierung** (FST-basiert): Die korrekt flektierte zielsprachliche Oberflächenform erzeugen

Stand 2025 unterstützt Apertium Hunderte von Sprachpaaren auf unterschiedlichen Qualitätsstufen, alle gehostet auf [GitHub](https://github.com/apertium). Es wird von einer internationalen Community aktiv weiterentwickelt und ist besonders nützlich für eng verwandte Sprachpaare, bei denen sein regelbasierter Ansatz ohne Trainingsdaten eine angemessene Qualität erreichen kann.

### Hybridansätze: FST + neuronal

Die vielversprechendste Grenze für Low-Resource-MT könnten **Hybridarchitekturen** sein, die regelbasierte morphologische Analyse mit neuronaler Übersetzung kombinieren. Die Idee ist unkompliziert: einen FST verwenden, um Wörter in Morpheme zu segmentieren (was das in Teil 4 beschriebene Tokenisierungsproblem löst), dann den segmentierten Text einem neuronalen MT-System zuführen.

Für eine polysynthetische Sprache wie Plains Cree bedeutet dies, dass das neuronale Modell eine Sequenz bedeutungstragender Einheiten statt beliebiger Byte-Fragmente erhält. Das **Alberta Language Technology Lab (ALT Lab)** an der University of Alberta, geleitet von **Antti Arppe**, hat umfassende FST-basierte morphologische Analysatoren und gemeinschaftsorientierte Wörterbuchwerkzeuge für Plains Cree unter Verwendung der GiellaLT-Infrastruktur gebaut. Ihre jüngste veröffentlichte Arbeit (Arppe 2025, AmericasNLP) demonstriert FST-basierte Abbildung zwischen flektierten Cree-Wortformen und englischen Phrasen — im Wesentlichen „eingeschränkte Übersetzung" mittels Finite-State-Methoden, die auf Wort-/Phrasenebene statt auf vollständigen Sätzen operiert. Bemerkenswerterweise hat das ALT Lab **kein** hybrides FST+neuronales MT-System veröffentlicht; ihre Arbeit ist linguistisch fundiert, regelbasiert und priorisiert Verlässlichkeit und gemeinschaftlichen Nutzen gegenüber experimentellen neuronalen Ansätzen. Unterdessen demonstrierten Nguyen, Hammerly und Silfverberg (2025, AmericasNLP) eine hybride LLM+FST-Pipeline für Ojibwe-Verben an der UBC, die starke Ergebnisse erzielte (chrF 0,82) — das am nächsten kommende veröffentlichte Analogon zu einem Hybridansatz für eine Algonkin-Sprache.

Diese Hybridstrategie stellt eine Konvergenz der zwei Traditionen dar, die sich durch die Geschichte der maschinellen Übersetzung gezogen haben: das explizite Wissen des Linguisten und das statistische Lernen des Ingenieurs. Für die Sprachen, die maschinelle Übersetzung am dringendsten benötigen, ist keine der beiden Traditionen allein ausreichend.

---

## Teil 6: Qualität messen — Das Evaluationsproblem {#part-6-measuring-quality--the-evaluation-problem}

### Woher weiß man, ob eine Übersetzung gut ist?

Diese Frage klingt einfach. Sie ist tatsächlich eines der schwierigsten ungelösten Probleme des Feldes, und wie man sie beantwortet, bestimmt, welche Systeme zu „funktionieren" scheinen und welche nicht.

### BLEU: Der unvollkommene Standard

Über zwei Jahrzehnte lang war die vorherrschende automatische Metrik in der maschinellen Übersetzung **BLEU** (Bilingual Evaluation Understudy), eingeführt von Papineni et al. bei IBM im Jahr 2002. BLEU misst, wie stark die Wortsequenzen (n-Gramme) der maschinellen Übersetzung mit einer oder mehreren menschlichen Referenzübersetzungen überlappen. Es enthält eine Kürze-Strafe, um zu verhindern, dass Systeme den Wert mit kurzen Ausgaben manipulieren.

BLEU wurde zur Währung des Feldes, weil es schnell, günstig, sprachunabhängig und reproduzierbar ist. Nahezu jede zwischen 2002 und 2020 veröffentlichte MT-Arbeit berichtete BLEU-Werte. WMT-Shared-Tasks verwendeten es jahrelang als primäre Metrik.

Aber BLEU hat tiefe Mängel, die zunehmend offensichtlich geworden sind:

- **Kein semantisches Verständnis**: BLEU ist reiner Oberflächenvergleich. Wenn eine Übersetzung ein perfektes Synonym verwendet, das zufällig nicht in der Referenz erscheint, bestraft BLEU es. Der Satz „the cat sat on the mat" erreicht null Punkte gegen eine Referenz von „the feline rested on the rug".
- **Schlechte satzebene-Diskriminierung**: BLEU wurde als korpusebene-Metrik entworfen. Auf Satzebene ist es unzuverlässig und verrauscht.
- **Morphologische Blindheit**: Für agglutinierende Sprachen (Türkisch, Finnisch, Suaheli), bei denen ein einzelnes Lemma Dutzende flektierter Formen haben kann, scheitert ein strikter wortebene-Vergleich katastrophal. Ein korrekt flektiertes Verb, das sich um ein Suffix von der Referenz unterscheidet, erreicht null Punkte.
- **Schwache Korrelation mit menschlichem Urteil**: Metaanalysen, insbesondere Reiter (2018), haben gezeigt, dass BLEUs Korrelation mit menschlichen Qualitätsbewertungen oft schwach ist, insbesondere für hochwertige Systeme und für Sprachen, die vom Englischen entfernt sind.

### chrF und chrF++

**chrF** (Character-F-Score), eingeführt von Maja Popović im Jahr 2015, befasst sich mit BLEUs morphologischer Blindheit, indem es die Überlappung auf **Zeichenebene** statt auf Wortebene misst. Dies gibt teilweise Anrechnung für geteilte Stämme und Wurzeln, selbst wenn sich Flexionen unterscheiden — entscheidend für morphologisch reiche Sprachen. **chrF++** (Popović, 2017) fügt wortebene-n-Gramme wieder hinzu und erzielt eine bessere Korrelation mit menschlichem Urteil als entweder rein zeichenbasierte oder rein wortbasierte Metriken. Beide sind in **sacreBLEU**, dem Standard-Evaluations-Toolkit, implementiert und zu Standard-Sekundärmetriken in WMT-Shared-Tasks geworden.

### COMET und xCOMET: Neuronale Evaluation

Der bedeutendste Fortschritt in der MT-Evaluation war der Übergang zu **neuronalen Metriken** — Evaluationsmodellen, die selbst Transformer sind, trainiert zur Vorhersage menschlicher Qualitätsurteile.

**COMET** (Crosslingual Optimized Metric for Evaluation of Translation), entwickelt von Ricardo Rei und Kollegen bei **Unbabel** (2020), verwendet einen cross-lingualen Encoder (XLM-RoBERTa), um den Quellsatz, die Übersetzung und die Referenz einzubetten, und sagt dann einen Qualitätswert voraus. Anders als BLEU operiert COMET im semantischen Raum — es erkennt Paraphrasen, erfasst Bedeutungserhalt und hat durchgehend eine viel höhere Korrelation mit menschlichem Urteil gezeigt als oberflächenebene-Metriken. COMET gewann oder belegte ab 2020 den ersten Platz in WMT-Metrics-Shared-Tasks.

**xCOMET** (Guerreiro et al., 2024, veröffentlicht in TACL) geht weiter: Zusätzlich zu einem Qualitätswert produziert es **feingranulare Fehlerspannen-Erkennung** — die Identifizierung spezifischer Fehler in der Übersetzung, klassifiziert nach Typ (Genauigkeit, Flüssigkeit, Terminologie) und Schweregrad (geringfügig, schwer, kritisch). Dies überbrückt die Kluft zwischen automatischer Bewertung und menschlicher linguistischer Analyse.

### AfriCOMET: Evaluation für die Unterversorgten

Standard-COMET, vorwiegend auf menschlichen Urteilen europäischer Sprachen trainiert, generalisiert möglicherweise nicht gut auf typologisch verschiedene Sprachen. **AfriCOMET** (Wang, Adelani et al., NAACL 2024) befasst sich damit, indem es auf menschlichen Evaluationsdaten aus **13 afrikanischen Sprachen** feinjustiert und **AfroXLM-R** verwendet — einen multilingualen Encoder, der speziell trainiert wurde, um afrikanische Sprachen besser zu repräsentieren. Diese Arbeit, produziert von der Masakhane-Community (siehe Teil 7), demonstriert, dass Evaluationsmetriken selbst für linguistische Vielfalt angepasst werden müssen.

### Menschliche Evaluation: MQM und Direct Assessment

Automatische Metriken sind Stellvertreter. Die Grundwahrheit bleibt die **menschliche Evaluation**, die zwei primäre Formen annimmt:

**Direct Assessment (DA)** bittet menschliche Bewerter, Übersetzungen auf einer Skala von 0–100 zu bewerten. Es ist relativ schnell und günstig (es können Crowd-Bewerter eingesetzt werden) und war von 2017 bis 2020 die primäre menschliche Evaluationsmethode bei WMT. Seine Schwäche: Mit zunehmender Verbesserung der MT-Qualität konnten Laien-Bewerter nicht mehr zwischen Systemen unterscheiden, die nahezu professionelle Ausgaben produzierten. DA wurde am oberen Ende des Qualitätsspektrums unzuverlässig.

**Multidimensional Quality Metrics (MQM)** ersetzte DA ab 2021 als WMTs primäre menschliche Evaluationsmethode. MQM setzt **professionelle Übersetzer** ein, die spezifische Fehlerspannen in der Übersetzung markieren, Fehler nach Typ (Fehlübersetzung, Auslassung, Grammatik, Terminologie) und Schweregrad (geringfügig = 1 Punkt, schwer = 5 Punkte, kritisch = 25 Punkte) klassifizieren. Dies produziert sowohl einen Qualitätswert als auch handlungsrelevante diagnostische Informationen — Sie wissen nicht nur, *wie schlecht* eine Übersetzung ist, sondern *was genau* schiefging.

| Merkmal | DA | MQM |
|---|---|---|
| Bewerter | Crowd-Worker | Professionelle Übersetzer |
| Methode | Ganzheitlicher 0–100-Wert | Fehlerspannen-Annotation |
| Diagnostik | Keine | Detaillierte Fehlerkategorisierung |
| Kosten | Niedriger | Höher |
| Verlässlichkeit | Schwächer für hochwertige MT | Goldstandard |
| WMT-Primärverwendung | 2017–2020 | 2021–heute |

### Die Evaluationskrise für Low-Resource-Sprachen

Für Low-Resource-Sprachen wird das Evaluationsproblem durch mehrere Faktoren verschärft:

- **Keine qualifizierten Evaluatoren**: MQM erfordert zweisprachige professionelle Übersetzer. Für viele LRLs ist es extrem schwierig, solche Evaluatoren zu finden.
- **Keine Referenzübersetzungen**: Sowohl COMET als auch BLEU erfordern Referenzübersetzungen zum Vergleich. Für viele Domänen und Sprachen existieren diese nicht.
- **Metrik-Verzerrung**: Sowohl Oberflächenmetriken als auch neuronale Metriken wurden anhand europäischer Sprachdaten entwickelt und validiert. Ihr Verhalten bei typologisch entfernten Sprachen ist ungewiss.
- **Halluzinationsrisiko**: In Low-Resource-Umgebungen können MT-Modelle flüssige Ausgaben produzieren, die völlig unabhängig von der Quelle sind — ein Phänomen namens **Halluzination**. Oberflächenmetriken können halluzinierten Ausgaben von null verschiedene Werte zuweisen, wenn diese zufällig n-Gramme mit der Referenz teilen.

Der Bau **maßgeschneiderter Evaluationsdatensätze** — selbst kleiner von 200–500 sorgfältig kuratierten Satzpaaren in der Zieldomäne — ist für jede ernsthafte Low-Resource-MT-Anstrengung wesentlich. Sich allein auf FLORES-200 oder BLEU-Werte ohne domänenspezifische Evaluation zu verlassen, ist ein Rezept für falsches Vertrauen.

---

## Teil 7: Die institutionelle Landschaft {#part-7-the-institutional-landscape}

### Unternehmensakteure

Das Feld der maschinellen Übersetzung wird von einer Handvoll großer Unternehmensakteure geprägt, jeder mit unterschiedlichen Strategien:

**Google Translate** bleibt das weltweit am häufigsten genutzte MT-System; seine Cloud Translation API listet **194 Sprachen** auf ([von Google veröffentlichte Liste](https://docs.cloud.google.com/translate/docs/languages) – das Endkundenprodukt wirbt mit mehr, aber Google veröffentlicht dafür keine statische, offizielle Liste). Googles **1000 Languages Initiative** (angekündigt 2022) zielt darauf ab, KI-Modelle zu entwickeln, die die 1.000 meistgesprochenen Sprachen der Welt abdecken. Die Cloud Translation API bietet zwei Stufen: Basic (ältere NMT) und Advanced (neueste Modelle). Google hat zunehmend seine Gemini-LLM-Fähigkeiten in Translate integriert, wobei kontextbezogene, idiomatische Übersetzungsfunktionen im Jahr 2025 erschienen sind.

**Meta** hat sich durch NLLB-200, M2M-100, FLORES-200 und die Seamless-Suite als der primäre Treiber quelloffener multilingualer maschineller Übersetzung positioniert. Metas Philosophie der offenen Modellveröffentlichung war für die akademische Forschung transformativ und lieferte Baselines und Werkzeuge, die andernfalls unerschwingliche Rechenressourcen erfordern würden.

**DeepL** besetzt eine qualitätsfokussierte Nische und unterstützt etwa **33 Sprachen** — alle relativ gut ausgestattet — mit einem Ruf für natürliche, idiomatische Ausgaben, die von professionellen Übersetzern bevorzugt werden. DeepLs Geschäftsmodell (Freemium für Verbraucher + kostenpflichtige API für Unternehmen) und sein Formalitätsparameter (Steuerung von formellem vs. informellem Register) spiegeln einen Fokus auf professionelle Übersetzungs-Workflows statt auf breite Sprachabdeckung wider.

**Microsoft Translator** (Teil der Azure AI Services) bietet Übersetzungen für **135 Sprachen** mit Unternehmensintegration über Microsoft 365 und Teams. Die Funktion Custom Translator ermöglicht es Organisationen, Modelle mit domänenspezifischen Daten fein abzustimmen.

**Unbabel** kombiniert maschinelle Übersetzung mit menschlichem Post-Editing in einem „Human-in-the-Loop"-Workflow, neben seinen Forschungsbeiträgen (COMET, xCOMET, Tower). Es repräsentiert die kommerzielle Anwendung des „MT + menschliche Überprüfung"-Paradigmas.

**LibreTranslate**, aufgebaut auf der **Argos Translate**-Engine, bietet eine vollständig quelloffene, selbst hostbare MT-Alternative ohne Unternehmensabhängigkeit — wichtig für Organisationen mit Anforderungen an die Datensouveränität.

### Basisbewegungen

Einige der wichtigsten Arbeiten in der maschinellen Übersetzung — insbesondere für unterversorgte Sprachen — geschehen in gemeinschaftsgetriebenen Forschungsorganisationen:

**[Masakhane](https://www.masakhane.io/)** (vom isiZulu für „wir bauen gemeinsam") ist eine basisgetriebene Forschungs-Community mit Fokus auf NLP für afrikanische Sprachen, gegründet 2019. Mit Hunderten von Mitgliedern über den Kontinent und die Diaspora hinweg hat Masakhane grundlegende Datensätze (MasakhaNER, MAFAND-MT, MENYO-20k, AfriQA), Evaluationsmetriken (AfriCOMET) und Forschung produziert, die das NLP afrikanischer Sprachen erheblich vorangebracht hat. Zu den Schlüsselfiguren gehört **David Ifeoluwa Adelani** (Mila / UCL). Code und Daten sind auf [GitHub](https://github.com/masakhane-io) gehostet; der primäre Kommunikationsknotenpunkt ist ihr Slack-Workspace (Beitritt über masakhane.io), mit wöchentlichen Community-Treffen. Masakhane operiert nach Prinzipien afrikanischen Eigentums an afrikanischer Sprachtechnologie — ein bewusster Gegenentwurf zu extraktiven Forschungsmustern, bei denen außenstehende Institutionen Daten von Sprachgemeinschaften ohne sinnvolle Zusammenarbeit sammeln. Sie raten ausdrücklich von „Fallschirm-Forschung" ab, bei der Außenstehende linguistische Daten ohne sinnvolle Partnerschaft mit der Gemeinschaft extrahieren.

**AmericasNLP** ist eine Workshop-Reihe (in Verbindung mit NAACL) mit Fokus auf NLP für indigene Sprachen Amerikas. Organisiert von Forschern wie **Manuel Mager**, **Arturo Oncevay** und **Luis Chiruzzo**, betreibt es Shared Tasks zur maschinellen Übersetzung für Sprachen wie Quechua, Guaraní, Aymara, Nahuatl, Rarámuri und andere. Der Workshop bringt Forschungsherausforderungen zutage, die für Amerika einzigartig sind — polysynthetische Morphologie, Tonsysteme, extreme Datenknappheit und die politischen Dimensionen von Sprachtechnologie für kolonisierte Völker.

**[ALT Lab](https://altlab.ualberta.ca)** (Alberta Language Technology Lab) an der University of Alberta, geleitet von **Antti Arppe**, konzentriert sich speziell auf Rechenwerkzeuge für Plains Cree und andere indigene Sprachen des Westens Kanadas. Das ALT Lab baut FST-basierte morphologische Analysatoren und gemeinschaftsorientierte Sprachwerkzeuge (unter Verwendung der GiellaLT-Infrastruktur) und arbeitet eng mit Cree sprechenden Gemeinschaften zusammen — ein Modell für gemeinschaftszentrierte Sprachtechnologieentwicklung. Ihr öffentlich zugängliches Projekt **[21st Century Tools for Indigenous Languages](https://21c.tools)** bietet Online-Wörterbücher und morphologische Werkzeuge, die auf dieser Infrastruktur aufbauen.

**[NRC Indigenous Languages Technology](https://nrc.canada.ca)** (National Research Council Canada), geleitet von **Patrick Littell**, unterhält ein aktives Programm, das 25+ indigene Sprachen in ganz Kanada unterstützt, darunter mehrere Cree-Dialekte, Algonquin, Innu und Michif. NRC ILT hat MT-Forschung für Englisch–Inuktitut (unter Verwendung des Nunavut-Hansard-Korpus) veröffentlicht und entwickelt quelloffene Werkzeuge, darunter **kiyânaw Transcribe** (Cree- und Ojibwe-Transkription), morphologische Analysatoren und **ReadAlong Studio** (Audio-Text-Alignierung). Der gesamte Code ist quelloffen, und NRC beansprucht ausdrücklich kein Urheberrecht an gemeinschaftlichen linguistischen Daten.

**[Aya](https://cohere.com/research/aya)** (Cohere For AI) ist eine offen-wissenschaftliche multilinguale LLM-Initiative mit 3.000+ Mitwirkenden aus 119+ Ländern. Obwohl kein dediziertes MT-System, sind Aya-Modelle (Aya-101 mit 101 Sprachen, Aya 23 mit 23 wirkungsstarken Sprachen, Tiny Aya mit 70 Sprachen bei 3,35B Parametern) für Übersetzungsaufgaben hochwirksam. Die **Aya Collection** — 513M Trainingsinstanzen im Instruktionsstil — ist der größte offene multilinguale Instruktionsdatensatz. Das Community-Governance-Modell ist studierenswert.

**[GhanaNLP / Khaya](https://ghananlp.org)** ist eine gemeinschaftsgetriebene NLP-Initiative, die die **Khaya**-Übersetzungsplattform produzierte — eines der wenigen gemeinschaftsverwalteten MT-Systeme, das tatsächlich für den täglichen Gebrauch eingesetzt wird. Khaya bietet neuronale maschinelle Übersetzung, ASR und TTS für ~12 ghanaische Sprachen (Twi, Ewe, Ga, Fante, Kusaal und andere) über Web, mobile Apps und Entwickler-API. Ihr Ansatz — 40.000+ parallele Satzpaare, aufgebaut durch Linguisten-Zusammenarbeit und Community-Feedback — demonstriert, dass gemeinschaftsverwaltete maschinelle Übersetzung operativ sein kann, nicht nur erstrebenswert.

### Finanzierung und Politik

MT-Forschung für Low-Resource-Sprachen hängt von Finanzierungsströmen ab, die sich erheblich von dem Risikokapital und den Werbeeinnahmen unterscheiden, die die kommerzielle maschinelle Übersetzung tragen:

- **Lacuna Fund**: Ein kollaborativer Datenfonds, unterstützt von der Rockefeller Foundation, Google.org, Kanadas IDRC und Deutschlands GIZ. Lacuna finanziert speziell die Erstellung **annotierter Datensätze** für unterrepräsentierte Sprachen — und schließt damit die Datenlücke, die die Grundursache der MT-Qualitätsdifferenzen ist.

- **AI4D** (Artificial Intelligence for Development): Ein Programm, das KI-Forschungsstipendien für afrikanische Sprachtechnologie unterstützt, betrieben über das IDRC und die Schwedische Internationale Entwicklungszusammenarbeitsagentur.

- **UNESCO International Decade of Indigenous Languages (2022–2032)**: Ein politischer Rahmen, der das Profil indigener Sprachtechnologie weltweit angehoben hat, wenngleich die konkrete Forschungsfinanzierung bescheiden war.

- **Inter-American Development Bank**: Finanzierte das **GuaranIA**-Projekt für Guaraní–Spanisch-MT in Paraguay, ein Beispiel für Entwicklungsfinanzierung zur Unterstützung von Sprachtechnologie.

- **Nationale Forschungsräte**: Ein Großteil der Low-Resource-MT-Arbeit wird über standardmäßige akademische Kanäle finanziert (NSF, NSERC, EU-Horizon-Programme), oft als Komponenten breiterer KI- oder Linguistik-Förderungen.

---

## Teil 8: Offene Grenzen {#part-8-open-frontiers}

### Was ungelöst bleibt

Das Feld der maschinellen Übersetzung ist 2026 zugleich leistungsfähiger und ehrlicher hinsichtlich seiner Grenzen als zu jedem früheren Zeitpunkt. Mehrere Grenzprobleme definieren die aktuelle Forschungslandschaft:

**Dokumentebene-Übersetzung** bleibt weitgehend ungelöst. Die meisten MT-Systeme — einschließlich vieler LLMs — übersetzen Satz für Satz und verlieren dabei Diskurskohärenz, Pronomenauflösung über Satzgrenzen hinweg und stilistische Konsistenz. Ein menschlicher Übersetzer liest das gesamte Dokument, bevor er übersetzt; die meisten MT-Systeme verarbeiten Sätze isoliert. Die Forschung zur dokumentebene-MT ist aktiv, hat aber noch keine Systeme hervorgebracht, die zuverlässig Kohärenz über lange Texte aufrechterhalten.

**Diskurs und Pragmatik** — die Kluft zwischen wörtlicher Bedeutung und kommunikativer Absicht — fordern die maschinelle Übersetzung weiterhin heraus. Ironie, Untertreibung, kulturelle Anspielungen und Registersensibilität (formell vs. informell, respektvoll vs. salopp) werden von den besten LLMs teilweise erfasst, aber inkonsistent. Ein Übersetzer, der zwischen Japanisch und Englisch arbeitet, muss ein ausgeklügeltes Honorativsystem navigieren; aktuelle MT-Systeme bewältigen dies bestenfalls ungleichmäßig.

**Multimodale Übersetzung** — Übersetzung im Kontext von Bildern, Video oder Audio — ist ein aufkommendes Forschungsgebiet. Ein Menüpunkt, der als „fliegender Fischrogen" beschrieben wird, ergibt mit einem begleitenden Bild vollkommen Sinn; ohne dieses könnte die maschinelle Übersetzung etwas Seltsames produzieren. Die Seamless-Suite und multimodale LLMs (Gemini, GPT-4o) haben begonnen, dies anzugehen, aber robuste multimodale maschinelle Übersetzung bleibt eine Grenze.

**Echtzeit-Sprache-zu-Sprache-Übersetzung** mit natürlicher Latenz (Verzögerung unter 3 Sekunden), Erhalt der Sprecheridentität und Übertragung des emotionalen Tons nähert sich der Produktionsreife für High-Resource-Paare. Google, Meta und mehrere Start-ups demonstrierten 2025 Prototypensysteme. Für Low-Resource-Sprachen bleibt Echtzeit-Sprachübersetzung fern.

**Die „letzte Meile" für Low-Resource-Sprachen** ist vielleicht das wichtigste ungelöste Problem des Feldes. Die Kluft zwischen einem FLORES-200-Benchmark-Wert und der tatsächlichen Nützlichkeit für eine Sprachgemeinschaft ist enorm. Ein Modell, das bei der Plains-Cree–Englisch-Übersetzung 15 BLEU erreicht, ist für keinen praktischen Zweck nützlich. Diese Kluft zu schließen erfordert nicht nur bessere Modelle, sondern bessere Daten, bessere Evaluation, bessere Tokenisierung und — entscheidend — echte Zusammenarbeit mit Sprachgemeinschaften statt Extraktion linguistischer Ressourcen für akademische Veröffentlichungen.

**Post-Editing und Mensch-KI-Zusammenarbeit** wird zum vorherrschenden Paradigma für die professionelle Übersetzung. Statt menschliche Übersetzer zu ersetzen, wird maschinelle Übersetzung zunehmend als Erstentwurf-Generator positioniert, den menschliche Übersetzer dann verfeinern. Das Verständnis der Kognitionswissenschaft des Post-Editings, die Messung des Post-Editing-Aufwands und das Design von Schnittstellen, die die Mensch-KI-Zusammenarbeit unterstützen, sind aktive Forschungsgebiete mit direkten kommerziellen Implikationen.

### Die politischen Dimensionen

Maschinelle Übersetzung ist nicht politisch neutral. Die Wahl, welche Sprachen unterstützt werden, welche Daten gesammelt werden, wer die Modelle kontrolliert und wessen Qualitätsstandards gelten, sind allesamt Entscheidungen mit erheblichen Konsequenzen für Sprachgemeinschaften.

Die Dominanz des Englischen als Pivot-Sprache kodiert eine bestimmte Sicht auf Übersetzung als etwas, das durch das Englische fließt. Die Verwendung von Bibel- und Missionarstexten als Trainingsdaten für indigene Sprachen wirft Fragen über Einwilligung und kulturelle Angemessenheit auf. Die Konzentration der MT-Fähigkeit in einer Handvoll Silicon-Valley-Unternehmen schafft Abhängigkeitsbeziehungen, denen sich manche Sprachgemeinschaften ausdrücklich widersetzen.

**Datensouveränität** ist ein zentrales Anliegen. In Kanada besagen die Datensouveränitätsprinzipien der First Nations, dass indigene Gemeinschaften Eigentümer ihrer Daten sind, kontrollieren, wie diese gesammelt und verwendet werden, Zugang zu ihnen haben und sie physisch besitzen. Für die maschinelle Übersetzung bedeutet dies, dass Trainingsdaten, die aus Texten in indigenen Sprachen stammen, Evaluierungskorpora, die auf dem Wissen der Gemeinschaft aufbauen, und Übersetzungsmodelle, die mit Ressourcen der Gemeinschaft trainiert wurden, alle der Verwaltung durch die Gemeinschaft unterliegen – und nicht der Verwaltung der Forschungseinrichtung oder des Technologieunternehmens, das das Modell entwickelt hat.

Dies hat direkte technische Auswirkungen. Ein MT-System, das mit Daten einer Gemeinschaft erstellt wurde, kann nicht einfach im herkömmlichen Sinne als Open Source veröffentlicht werden, wenn die Gemeinschaft dem nicht zugestimmt hat. Evaluierungs-Benchmarks können nicht veröffentlicht werden, wenn die Testdaten kulturell sensibles Material enthalten. Ein „Modell im Besitz der Gemeinschaft“ ist kein Widerspruch – es ist eine Designanforderung. Jede ernsthafte Bemühung im Bereich der ressourcenarmen maschinellen Übersetzung für indigene Sprachen muss standardmäßig souveränitätsanstrebend sein — auf Eigentum und Kontrolle der Gemeinschaft über ihre Sprachdaten hin entworfen, nicht als nachträglicher Gedanke.

Dies sind nicht bloß ethische Fußnoten — sie prägen Forschungsprioritäten, Finanzierungsentscheidungen und technische Architekturen. „Bessere maschinelle Übersetzung bauen" ist untrennbar von Fragen darüber, wer profitiert, wer entscheidet und wessen linguistisches Wissen geschätzt wird.

---

## Anhang A: Wichtige Arbeiten {#appendix-a-key-papers}

Eine chronologische Leseliste der Arbeiten, die die Entwicklung des Feldes prägten. Jeder Eintrag enthält eine kurze Anmerkung dazu, warum er von Bedeutung ist.

| Jahr | Arbeit | Autoren | Bedeutung |
|---|---|---|---|
| 2002 | [BLEU: a Method for Automatic Evaluation of MT](https://aclanthology.org/P02-1040/) | Papineni et al. (IBM) | Etablierte die vorherrschende MT-Evaluationsmetrik für zwei Jahrzehnte |
| 2014 | [Sequence to Sequence Learning with Neural Networks](https://arxiv.org/abs/1409.3215) | Sutskever, Vinyals, Le (Google) | Demonstrierte neuronale Encoder-Decoder-Übersetzung |
| 2014 | [Neural MT by Jointly Learning to Align and Translate](https://arxiv.org/abs/1409.0473) | Bahdanau, Cho, Bengio | Führte den Attention-Mechanismus ein |
| 2016 | [Google's Neural MT System](https://arxiv.org/abs/1609.08144) | Wu et al. (Google) | Brachte neuronale maschinelle Übersetzung in den Produktionsmaßstab |
| 2016 | [Neural MT of Rare Words with Subword Units](https://aclanthology.org/P16-1162/) | Sennrich, Haddow, Birch | Führte BPE-Tokenisierung für maschinelle Übersetzung ein |
| 2016 | [Improving NMT Models with Monolingual Data](https://aclanthology.org/P16-1009/) | Sennrich, Haddow, Birch | Führte Backtranslation zur Datenaugmentierung ein |
| 2017 | [Attention Is All You Need](https://arxiv.org/abs/1706.03762) | Vaswani et al. (Google) | Führte die Transformer-Architektur ein |
| 2020 | [Unsupervised Cross-lingual Representation Learning at Scale](https://arxiv.org/abs/1911.02116) | Conneau et al. (Facebook) | XLM-R: cross-linguale Repräsentationen für 100 Sprachen |
| 2020 | [Beyond English-Centric Multilingual MT](https://arxiv.org/abs/2010.11125) | Fan et al. (Facebook) | M2M-100: Many-to-Many ohne Pivoting über das Englische |
| 2020 | [COMET: A Neural Framework for MT Evaluation](https://arxiv.org/abs/2009.09025) | Rei et al. (Unbabel) | Neuronale Evaluationsmetrik mit hoher menschlicher Korrelation |
| 2022 | [No Language Left Behind](https://arxiv.org/abs/2207.04672) | NLLB Team (Meta) | 200-Sprachen-MT-Modell + FLORES-200-Benchmark |
| 2023 | [ALMA: A Paradigm Shift in MT](https://arxiv.org/abs/2309.11674) | Xu et al. (JHU) | LLM-Feinjustierung für hochmoderne Übersetzung mit wenig Daten |
| 2024 | [Tower: Open Multilingual LLM for Translation](https://arxiv.org/abs/2402.17733) | Alves et al. (Unbabel) | Vollständige Übersetzungspipeline in einem einzigen LLM |
| 2024 | [xCOMET: Transparent MT Evaluation](https://aclanthology.org/2024.tacl-1.54) | Guerreiro et al. | Feingranulare Fehlererkennung in der MT-Evaluation |
| 2024 | [AfriMTE and AfriCOMET](https://aclanthology.org/2024.naacl-long.334/) | Wang, Adelani et al. | Für afrikanische Sprachen angepasste MT-Evaluation |

---

## Anhang B: Konferenzen und Communities {#appendix-b-conferences-and-communities}

### Wichtige Konferenzen

Das Ökosystem der NLP/MT-Konferenzen folgt einem jährlichen Rhythmus. Die folgende Tabelle listet die wichtigsten Veranstaltungen auf, gefolgt von den Daten der jüngsten Ausgaben.

| Konferenz | Vollständiger Name | Häufigkeit | Anmerkungen |
|---|---|---|---|
| **[WMT](https://statmt.org/wmt25/)** | Conference on Machine Translation | Jährlich | Der primäre kompetitive Veranstaltungsort des Feldes; Shared Tasks definieren Benchmarks |
| **[ACL](https://www.aclweb.org/)** | Association for Computational Linguistics | Jährlich | Die führende NLP-Konferenz |
| **EMNLP** | Empirical Methods in NLP | Jährlich | Führende Konferenz zweiter Reihe; hostet typischerweise WMT |
| **NAACL** | North American Chapter of the ACL | Jährlich (wechselt mit ACL) | Große regionale Konferenz |
| **EACL** | European Chapter of the ACL | Zweijährlich | Europäische regionale Konferenz |
| **COLING** | Intl. Conf. on Computational Linguistics | Zweijährlich | War für 2024 mit LREC zusammengelegt; nun wieder separat |
| **LREC** | Language Resources & Evaluation Conference | Zweijährlich | Fokus auf Daten, Ressourcen und Evaluation |
| **[IWSLT](https://iwslt.org/)** | Intl. Workshop on Spoken Language Translation | Jährlich | Fokus auf Sprachübersetzung |

#### Jüngste Ausgaben

*Nur Daten – und das ganz bewusst. Eine „Status“-Spalte mit der Angabe **Bevorstehend** ist an dem
Tag falsch, an dem die Veranstaltung beginnt, und diese Seite kann das heutige Datum nicht kennen. Vergleichen Sie die unten stehenden Daten
selbst mit dem Kalender; die Tagungsbände (Proceedings) für alle bereits stattgefundenen Veranstaltungen finden Sie in der
[ACL Anthology](https://aclanthology.org).*

| Veranstaltung | Datum | Ort |
|---|---|---|
| **COLING 2025** | 19.–24. Jan. 2025 | Abu Dhabi, VAE |
| **EACL 2026** | 24.–29. März 2026 | Rabat, Marokko |
| **LREC 2026** | 11.–16. Mai 2026 | Palma de Mallorca, Spanien |
| **ACL 2026** | 2.–7. Juli 2026 | San Diego, USA |
| **AmericasNLP 2026** | 3.–4. Juli 2026 (zusammen mit ACL) | San Diego, USA |

*ACL 2025 (Wien), EMNLP 2025 (Suzhou), WMT 2025 (Suzhou), IWSLT 2025 (Wien) und PACLIC 39 (Hanoi) fanden alle 2025 statt. Ihre Tagungsbände sind in der [ACL Anthology](https://aclanthology.org) verfügbar.*

#### WMT 2025 Shared Tasks

WMT-Shared-Tasks sind das, was dem Feld der maschinellen Übersetzung einem öffentlichen Wettbewerb am nächsten kommt. Die Ausgabe 2025 umfasst:

- **General Machine Translation** — die führende Aufgabe
- **Automated Translation Evaluation Systems** — einheitliche Metriken und Qualitätsschätzung
- **Low-Resource Indic Language Translation**
- **Creole Language Translation**
- **Terminology Shared Task**
- **Model Compression** — MT-Modelle kleiner und schneller machen
- **Open Language Data** — Verbesserung offener Trainingsdaten
- **Multilingual Instruction Shared Task (MIST)**
- **Limited Resources Slavic LLMs**

### Spezialisierte Workshops

| Workshop | Schwerpunkt | Jüngste bekannte Ausgabe | Zusammen mit |
|---|---|---|---|
| **[AmericasNLP](https://americasnlp.org/)** | Indigene Sprachen Amerikas | 3.–4. Juli 2026 (ACL 2026, San Diego) | ACL |
| **AfricaNLP** | NLP für afrikanische Sprachen | 31. Juli 2025 (ACL 2025, Wien) | ACL / ICLR |
| **LoResMT** | Ressourcenarme MT | Typischerweise jährlich auf *ACL-Konferenzen | Verschiedene |
| **SIGTYP** | ACL SIG für linguistische Typologie | Jährlicher Workshop | ACL |

### Wichtige Community-Ressourcen

- **[machinetranslate.org](https://machinetranslate.org)** — Gemeinschaftsgetriebene, quelloffene Wissensdatenbank über MT-Technologie. Betrieben von der Machine Translate Foundation (gemeinnützig, Zug, Schweiz, gegründet 2021). Behandelt Ansätze, APIs, Modelle, Sprachunterstützung und Branchennachrichten. Lizenziert unter CC BY-SA 4.0. Ein ausgezeichneter Ausgangspunkt für jedes Thema in diesem Bericht.

- **[ACL Anthology](https://aclanthology.org)** — Das maßgebliche Open-Access-Archiv von NLP/CL-Forschungsarbeiten. Jede Arbeit der ACL, EMNLP, NAACL, EACL, WMT und verwandter Veranstaltungsorte ist hier frei verfügbar.

---

## Anhang C: Werkzeuge, Datensätze und praktische Ressourcen {#appendix-c-tools-datasets-and-practical-resources}

Dieser Anhang behandelt die konkreten Werkzeuge und Datenquellen, die in der MT-Arbeit heute von Bedeutung sind. Er ist für Personen geschrieben, die sich in einem Terminal auskennen, aber das MT-Ökosystem möglicherweise nicht kennen.

### Trainings-Frameworks

Dies sind die Softwarepakete, die zum *Trainieren* neuronaler MT-Modelle von Grund auf (oder zum Feinjustieren bestehender) verwendet werden. Sie würden diese verwenden, wenn Sie Ihr eigenes Übersetzungsmodell bauen, statt ein bestehendes über eine API zu nutzen.

| Framework | Entwickler | Sprache | Anmerkungen |
|---|---|---|---|
| **[Marian NMT](https://marian-nmt.github.io/)** | Microsoft / U. Edinburgh | C++ | Der schnellste quelloffene NMT-Trainer — kann ein Modell 3–5× schneller trainieren als PyTorch-basierte Alternativen. In reinem C++ mit minimalen Abhängigkeiten geschrieben. Treibt Microsoft Translator an. Jedes OpusMT-Modell (siehe unten) wurde damit trainiert. Benannt nach Marian Rejewski, dem polnischen Mathematiker, der bei der Entschlüsselung der Enigma half. |
| **[fairseq](https://github.com/facebookresearch/fairseq)** | Meta AI | Python (PyTorch) | Metas Arbeitspferd-Forschungs-Toolkit — verwendet zum Bau von M2M-100, NLLB-200 und dem Großteil von Metas veröffentlichter MT-Arbeit. Hochgradig modular: Sie können Architekturen, Verlustfunktionen und Datenverarbeitung austauschen. Die Standardwahl für Forscher, die Metas Arbeit reproduzieren oder erweitern. |
| **[OpenNMT](https://opennmt.net/)** | Harvard NLP / SYSTRAN | Python (PyTorch, TF) | Der zugänglichste Einstiegspunkt zum Trainieren maßgeschneiderter MT-Modelle. Entstanden als Harvard-Forschungsprojekt, nun gepflegt von SYSTRAN (einem kommerziellen MT-Unternehmen). Enthält CTranslate2 für die Bereitstellung (siehe unten). Gute Dokumentation für Anfänger. |

**Wann würden Sie diese verwenden?** Wenn Sie Paralleldaten haben (auch nur wenige tausend Satzpaare) und ein dediziertes Übersetzungsmodell für ein bestimmtes Sprachpaar trainieren oder feinjustieren wollen. Sie würden diese NICHT für LLM-basierte Übersetzung verwenden (Prompting von GPT/Claude/Gemini), die kein Training erfordert — nur API-Aufrufe.

### Inferenz und Bereitstellung

Diese Werkzeuge betreiben *bereits trainierte* Modelle, um Übersetzungen zu produzieren. Stellen Sie sich die obigen Trainings-Frameworks als „die Werkstatt, in der das Auto gebaut wird" und diese als „den Zündschlüssel, der das Auto startet" vor.

| Werkzeug | Was es tut | Wann man es verwendet |
|---|---|---|
| **[CTranslate2](https://github.com/OpenNMT/CTranslate2)** | Eine C++-Engine, die Transformer-Modelle mit hoher Geschwindigkeit und geringem Speicher betreibt. Unterstützt INT8/INT4-Quantisierung (Verkleinerung von Modellen auf 1/4 ihrer Größe bei minimalem Qualitätsverlust). Läuft auf CPU oder GPU, ohne dass PyTorch installiert sein muss. Unterstützt NLLB, M2M-100, OpusMT, LLaMA, Whisper. | Wenn Sie ein Übersetzungsmodell auf einem Server oder Laptop selbst hosten wollen, ohne GPU-Cluster. Die erste Wahl für die Produktionsbereitstellung quelloffener MT-Modelle. |
| **[Hugging Face Transformers](https://huggingface.co/models?pipeline_tag=translation)** | Python-Bibliothek, die Modelle mit wenigen Codezeilen lädt und betreibt: `pipe = pipeline('translation', model='Helsinki-NLP/opus-mt-en-fr'); pipe('Hello world')`. Bietet ~1.500 vortrainierte bilinguale OpusMT-Modelle plus NLLB-200, mBART, mT5 und M2M-100. | Wenn Sie den schnellsten Weg von „Ich möchte etwas übersetzen" zu funktionierendem Code wollen. Zwei Zeilen Python und Sie übersetzen. Geringerer Durchsatz als CTranslate2, aber weit einfacher einzurichten. |

### Vortrainierte Modellfamilien

Dies sind *bereits trainierte* Übersetzungsmodelle, die Sie herunterladen und sofort verwenden können. Kein Training erforderlich — einfach laden und übersetzen.

| Modellfamilie | Sprachen | Entwickler | Was es ist | Wo zu finden |
|---|---|---|---|---|
| **[OpusMT / Helsinki-NLP](https://huggingface.co/Helsinki-NLP)** | 1.000+ Paare | University of Helsinki (Jörg Tiedemann) | Die größte Sammlung quelloffener bilingualer Übersetzungsmodelle. Jedes Modell bewältigt ein Sprachpaar (z. B. `opus-mt-en-fr` für Englisch→Französisch). Trainiert auf OPUS-Daten unter Verwendung von Marian NMT, in PyTorch-Format für Hugging Face konvertiert. Qualität variiert — ausgezeichnet für gut ausgestattete Paare, marginal für Low-Resource. | Hugging Face (`Helsinki-NLP/opus-mt-*`) |
| **NLLB-200** | 200 Sprachen | Meta | Ein einzelnes multilinguales Modell, das zwischen beliebigen von 200 Sprachen übersetzt. Verfügbar in 600M-, 1,3B- und 3,3B-Parameter-Varianten. Die 600M-Version läuft auf einem Laptop; die 3,3B-Version benötigt eine anständige GPU. Qualität variiert enorm — stark für Medium-Resource, oft schlecht für wirklich Low-Resource. | Hugging Face (`facebook/nllb-200-*`) |
| **M2M-100** | 100 Sprachen | Meta | Der Vorgänger von NLLB-200 — erstes Modell, das direkt zwischen nicht-englischen Paaren (z. B. Bengali↔Suaheli) übersetzte, ohne über das Englische zu leiten. Historisch bedeutsam; weitgehend von NLLB-200 abgelöst. | Hugging Face (`facebook/m2m100_*`) |
| **Tower / Tower+** | 22–27 Sprachen | Unbabel | Nicht nur ein Übersetzer — bewältigt die vollständige Übersetzungspipeline (Korrektur, NER, Post-Editing, Qualitätsschätzung) in einem einzigen LLM. Feinjustiert von LLaMA. Stand 2025 übertrifft Tower v2 (70B) GPT-4o und DeepL bei mehreren Benchmarks. | Hugging Face |
| **ALMA / X-ALMA** | 50 Sprachen | Johns Hopkins University | LLaMA-basierte Modelle, speziell für die Übersetzung feinjustiert unter Verwendung von Präferenzoptimierung (dem Modell beizubringen, welche Übersetzungen Menschen bevorzugen). Die 7B- und 13B-Versionen erreichen GPT-4-Qualität bei High-Resource-Paaren. X-ALMA erweitert sich auf 50 Sprachen mit sprachspezifischen Adaptermodulen. | Hugging Face |

### Paralleldatenquellen

Paralleldaten sind der Treibstoff zum Trainieren von MT-Modellen: Sammlungen von Sätzen in zwei Sprachen, die Übersetzungen voneinander sind und Zeile für Zeile aligniert sind. Ohne Paralleldaten kann man kein konventionelles MT-Modell trainieren. (LLM-basierte Übersetzung umgeht dies — man kann GPT zur Übersetzung promptem, ohne jegliche Paralleldaten — aber dedizierte Modelle benötigen sie noch.)

| Datensatz | Umfang | Was es ist | URL |
|---|---|---|---|
| **[OPUS](https://opus.nlpl.eu)** | 100B+ Satzpaare, 1.000+ Sprachen | Die einzelne wichtigste Ressource für MT-Daten. Eine Meta-Sammlung, die Dutzende von Teilkorpora (siehe unten) in einem durchsuchbaren Portal aggregiert. Erstellt und gepflegt von Jörg Tiedemann an der University of Helsinki. Wenn Sie Paralleldaten in einer beliebigen Sprache suchen, ist OPUS der Ausgangspunkt. Zugänglich über Web-Portal, Python-`opustools`-Paket und Hugging Face. | [opus.nlpl.eu](https://opus.nlpl.eu) |
| **[Europarl](http://www.statmt.org/europarl/)** | ~60M Wörter/Sprache, 21 EU-Sprachen | Protokolle des Europäischen Parlaments — Reden von Politikern, übersetzt in alle offiziellen EU-Sprachen. Erstellt von Philipp Koehn. Historisch grundlegend (der Datensatz, der die SMT-Forschung ermöglichte), aber auf EU-Sprachen und parlamentarisches Register beschränkt. | [statmt.org/europarl](http://www.statmt.org/europarl/) |
| **[ParaCrawl](https://paracrawl.eu)** | Milliarden von Paaren, 29+ Sprachpaare | EU-finanziertes Projekt, das das Web durchsucht, um natürlich vorkommenden Paralleltext zu finden (zweisprachige Websites, übersetzte Seiten). Viel verrauschter als kuratierte Korpora, aber enorm viel größer. Veröffentlichte die quelloffene **Bitextor**-Crawling-Pipeline, die jeder verwenden kann, um seine eigenen Paralleldaten aus dem Web zu schürfen. | [paracrawl.eu](https://paracrawl.eu) |
| **[CCAligned](http://www.statmt.org/cc-aligned/)** | 392M URL-Paare, 137 englisch-gepaarte Richtungen | Web-geschürfte parallele Dokumente aus Common Crawl (Meta/JHU). Besonders nützlich für Sprachen von niedrigem bis mittlerem Ressourcenniveau, die nicht in kuratierten Korpora erscheinen. Die Qualität ist niedriger als bei Europarl, aber die Abdeckung ist viel breiter. | [statmt.org/cc-aligned](http://www.statmt.org/cc-aligned/) |
| **[WikiMatrix](https://github.com/facebookresearch/LASER)** | 135M parallele Sätze, 1.620 Paare | Parallele Sätze, automatisch aus Wikipedia geschürft unter Verwendung von LASER-multilingualen Embeddings (Meta). Nützlich, weil Wikipedia in vielen Sprachen existiert — aber die Alignierung ist automatisch (nicht menschlich verifiziert), sodass einige Paare verrauscht oder falsch sind. | GitHub (LASER-Repo) |
| **[Tatoeba](https://tatoeba.org)** | 500+ Sprachen | Eine gemeinschaftlich gepflegte Sammlung von Beispielsätzen und ihren Übersetzungen, beigetragen von Freiwilligen weltweit. Einzelne Sätze, keine Dokumente. Die zugehörige **[Tatoeba Translation Challenge](https://github.com/Helsinki-NLP/Tatoeba-Challenge)** (Helsinki-NLP) bietet saubere Trainings-/Test-Splits für Tausende von Sprachpaaren — verwendet zum Training der OpusMT-Modelle. | [tatoeba.org](https://tatoeba.org) |
| **FLORES-200** | 200 Sprachen | Ein standardisierter Evaluations-Benchmark (KEINE Trainingsdaten). Professionell übersetzte Sätze, verwendet zum Vergleich von Systemen auf gleicher Augenhöhe. Erstellt von Meta neben NLLB-200. Wenn Sie Ihr System gegen veröffentlichte Baselines vergleichen wollen, ist dies der zu verwendende Testdatensatz. | Hugging Face |

### Wichtige Teilkorpora innerhalb von OPUS

OPUS aggregiert viele unabhängige Parallelkorpora. Bei der Suche nach Daten in einer bestimmten Sprache lohnt es sich, diese Teilsammlungen zu prüfen:

- **OpenSubtitles** — Film- und Fernsehuntertitel. Massives Volumen, aber verrauscht — Untertitel sind oft vereinfacht, informell und können Transkriptionsfehler enthalten.
- **JW300** — Publikationen der Zeugen Jehovas, die ~300 Sprachen abdecken. Die breiteste Sprachabdeckung jedes einzelnen Korpus, aber stark in Richtung religiöser Inhalte verzerrt und ethisch umstritten (siehe Teil 4).
- **Bible** — Bibelübersetzungen in 700+ Sprachen. Engste Domäne von allen (alter religiöser Text), aber für viele Sprachen der einzige Paralleltext, der überhaupt existiert.
- **Tanzil** — Koranübersetzungen. Nützlich für arabisch-gepaarte Daten.
- **GNOME / KDE** — Software-Lokalisierungs-Strings („Datei → Speichern", „Sind Sie sicher, dass Sie löschen wollen?"). Nützlich für die technische/UI-Domäne, aber sehr formelhaft.
- **EMEA** — Dokumente der Europäischen Arzneimittel-Agentur. Nützlich für die Übersetzung in der biomedizinischen Domäne.

---

## Anhang D: Glossar {#appendix-d-glossary}

**Attention-Mechanismus**: Eine neuronale Netzwerkkomponente, die es dem Modell ermöglicht, sich bei der Erzeugung jedes Teils der Ausgabe dynamisch auf verschiedene Teile der Eingabe zu fokussieren. Eingeführt von Bahdanau et al. (2014) für die maschinelle Übersetzung; verallgemeinert im Transformer (2017).

**Backtranslation**: Eine Datenaugmentierungstechnik, bei der monolingualer zielsprachlicher Text von einem vorläufigen MT-System zurück in die Quellsprache übersetzt wird, um synthetische Paralleldaten für das Training zu erzeugen.

**BLEU**: Bilingual Evaluation Understudy. Eine automatische MT-Evaluationsmetrik, die auf der n-Gramm-Präzisionsüberlappung mit Referenzübersetzungen basiert.

**BPE (Byte Pair Encoding)**: Ein Teilwort-Tokenisierungsalgorithmus, der iterativ die häufigsten Zeichenpaare zusammenführt, um ein Vokabular aufzubauen. Verwendet in praktisch allen modernen NMT- und LLM-Systemen.

**COMET**: Eine neuronale MT-Evaluationsmetrik, die cross-linguale Embeddings verwendet, um menschliche Qualitätsurteile vorherzusagen, und auf Quelle + Hypothese + Referenz operiert.

**Fluch der Multilingualität**: Das Phänomen, bei dem das Hinzufügen weiterer Sprachen zu einem multilingualen Modell die sprachspezifische Qualität aufgrund der festen Modellkapazität verwässert.

**Encoder-Decoder**: Eine neuronale Architektur, bei der ein Encoder die Eingabesequenz in Repräsentationen verarbeitet und ein Decoder die Ausgabesequenz aus diesen Repräsentationen erzeugt.

**FLORES-200**: Ein standardisierter MT-Evaluations-Benchmark, der 200 Sprachen abdeckt, erstellt von Meta neben NLLB-200.

**FST (Finite-State-Transduktor)**: Ein Rechengerät, das mittels Zuständen und Übergängen zwischen Eingabe- und Ausgabesymbolsequenzen abbildet. Verwendet in der Computermorphologie zur Analyse und Generierung von Wortformen.

**Halluzination**: In der maschinellen Übersetzung die Produktion flüssiger Ausgaben, die unabhängig vom oder untreu zum Quelltext sind. Besonders häufig in Low-Resource-Umgebungen.

**High-Resource-Sprache**: Eine Sprache mit reichlich digitalem Text und parallelen Übersetzungsdaten (typischerweise >10M Satzpaare mit dem Englischen). Beispiele: Französisch, Deutsch, Chinesisch, Spanisch.

**LLM (Large Language Model)**: Ein neuronales Sprachmodell mit Milliarden von Parametern, trainiert auf riesigen Textkorpora zur Vorhersage des nächsten Tokens. Beispiele: GPT-4, Gemini, LLaMA, Claude.

**Low-Resource-Sprache (LRL)**: Eine Sprache mit begrenztem digitalem Text und Paralleldaten (<1M Satzpaare). Die überwiegende Mehrheit der Sprachen der Welt fällt in diese Kategorie.

**MQM (Multidimensional Quality Metrics)**: Ein menschliches Evaluations-Framework, bei dem professionelle Übersetzer spezifische Fehlerspannen in Übersetzungen annotieren, klassifiziert nach Typ und Schweregrad.

**NMT (Neural Machine Translation)**: Maschinelle Übersetzung unter Verwendung neuronaler Netze, im Gegensatz zu statistischen (SMT) oder regelbasierten (RBMT) Ansätzen.

**Paralleldaten / Parallelkorpus**: Eine Sammlung von Texten in zwei Sprachen, die Übersetzungen voneinander sind, auf Satzebene aligniert. Die primäre Trainingsressource für die maschinelle Übersetzung.

**Polysynthetische Sprache**: Eine Sprache, in der Wörter aus vielen Morphemen zusammengesetzt sind, die oft Informationen kodieren, die in analytischen Sprachen wie dem Englischen einen ganzen Teilsatz erfordern würden. Beispiele: Plains Cree, Mohawk, Inuktitut.

**SentencePiece**: Ein sprachunabhängiger Teilwort-Tokenizer und -Detokenizer, der BPE und Unigramm-Sprachmodell-Segmentierung implementiert. Weit verbreitet in der multilingualen NLP.

**Transformer**: Die seit 2017 vorherrschende neuronale Architektur für NLP, vollständig auf Self-Attention-Mechanismen basierend. Eingeführt in „Attention Is All You Need" (Vaswani et al., 2017).

**Zero-Shot-Cross-Lingual-Transfer**: Die Anwendung eines auf einer Sprache (typischerweise Englisch) trainierten Modells auf eine andere Sprache ohne jegliche zielsprachliche Trainingsdaten, unter Berufung auf geteilte multilinguale Repräsentationen.

---

*Dieser Bericht wurde im Juni 2026 zusammengestellt. Das Feld der maschinellen Übersetzung bewegt sich rasch; spezifische Modellfähigkeiten und Benchmark-Ergebnisse sollten gegen aktuelle Quellen verifiziert werden. Für die neuesten Entwicklungen konsultieren Sie [machinetranslate.org](https://machinetranslate.org), die [ACL Anthology](https://aclanthology.org) und die Tagungsbände der jüngsten WMT-Shared-Task.*


## Wohin dies auf dieser Website führt

Die Lücke, die dieses Briefing beschreibt – Hunderte von Sprachen, für die es überhaupt keine
gemessene Übersetzung gibt –, ist genau das, was der Rest dieser Website schließen soll. Die
Argumentation, wie dies geschieht ([Was Champollion ist](/docs/what-is-champollion)), die
Wirtschaftlichkeit des Aufbaus eines Evaluierungsdatensatzes anstelle eines Trainingskorpus
([Wer profitiert – Forscher](/docs/network/who-benefits#researchers)) und
der aktuelle Stand dessen, was bisher tatsächlich gemessen wurde
([Ehrliche Einschränkungen](/docs/network/honest-limitations)), sind die drei
logischen nächsten Lektüren.
