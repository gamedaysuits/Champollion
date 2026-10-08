---
sidebar_position: 2
title: "Was zählt hier als Sprache?"
---

# Was zählt hier als Sprache?

> **Zusammenfassung.** Das Network katalogisiert Sprachen nach ISO 639-3, bewertet einzelne Sprachen (nicht Makrosprachen-Dachbegriffe), schließt Gebärdensprachen als die natürlichen Sprachen ein, die sie sind, schließt ISO-anerkannte konstruierte Sprachen ein, schließt Programmiersprachen aus und zeigt taxonomische Streitfragen, ohne Partei zu ergreifen. Diese Seite erläutert jede Entscheidung und was sie für die Bestenliste bedeutet.

Jedes Projekt, das Übersetzungen über Tausende von Sprachen hinweg bewertet, muss eine alte und überraschend schwierige Frage beantworten: Was zählt als Sprache? Linguisten wissen seit Langem, dass die Grenze zwischen „Sprache“ und „Dialekt“ ebenso sehr eine soziale und politische wie eine strukturelle ist — der berühmte Ausspruch, dass *„eine Sprache ein Dialekt mit einer Armee und Marine“* sei, wurde 1945 von dem jiddischen Linguisten Max Weinreich popularisiert (er schrieb ihn einem Zuhörer bei einem seiner Vorträge zu). Wir können dieser Frage nicht ausweichen, daher hier unsere Antworten und unsere Begründung.

---

## Gebärdensprachen sind Sprachen. Punkt.

Gebärdensprachen sind natürliche Sprachen — mit vollständigen Grammatiken, muttersprachlichem Erwerb durch Kinder und lebendigen Sprachgemeinschaften. Dies gilt in der Linguistik als gesichert, seit William Stokoe 1960 nachwies, dass die Amerikanische Gebärdensprache dieselbe Art innerer Struktur aufweist wie gesprochene Sprachen, und sechzig Jahre Forschung seither (Klima & Bellugi 1979; Sandler & Lillo-Martin 2006) haben diesen Punkt nur vertieft. ISO 639-3 weist Gebärdensprachen individuelle Sprachcodes zu; Glottolog katalogisiert sie neben gesprochenen Familien. Unser Katalog umfasst mehr als 160 davon, gekennzeichnet als `modality: signed`.

Einige sind bedrohte indigene Sprachen: Die Plains Indian Sign Language (`psd`), historisch eine bedeutende interstammliche Verkehrssprache in ganz Nordamerika, ist heute akut vom Aussterben bedroht (Davis 2010, *Hand Talk*). Die Gefährdung von Gebärdensprachen *ist* eine Gefährdung indigener Sprachen, und sie gehört zum Auftrag dieses Projekts.

**Eine ehrliche Anmerkung zum Umfang.** Das Network bewertet derzeit *textbasierte* maschinelle Übersetzung. Maschinelle Übersetzung von Gebärdensprachen — die mit Video, räumlicher Grammatik und Sprachen ohne weit verbreitete schriftliche Form arbeitet — ist ein anderes und weitgehend ungelöstes technisches Problem (siehe Yin et al. 2021, „Including Signed Languages in Natural Language Processing“, ACL). Wir bedienen es noch nicht. Einträge zu Gebärdensprachen in unserem Katalog sagen genau das aus: **noch nicht bedient — niemals „keine Sprache“.**

## Es gibt zwei Modalitäten. Schrift ist keine davon.

Sprachen treten in zwei primären Modalitäten auf: **gesprochen** und **gebärdet**. Schrift ist keine dritte Modalität — sie ist eine Technologie, die auf eine Sprache aufgesetzt wird, und die meisten Sprachen der Welt kommen ohne eine standardisierte Schrift aus. Deshalb erfassen unsere Sprachkarten die Schrift gesondert (welche Schriftsysteme eine Sprache verwendet oder ob sie überhaupt keine standardisierte Orthographie besitzt) und erfassen sie ehrlich: Für eine textbasierte MT-Plattform ist es eine kritische Information und keine Fußnote, ob eine Sprache verschriftlicht ist — und eine unverschriftlichte Sprache ist keine minderwertigere Sprache.

## Konstruierte Sprachen: drin. Programmiersprachen: draußen.

Wir folgen der Linie von ISO 639-3 selbst. Der Standard lässt eine konstruierte Sprache nur dann zu, wenn sie eine vollständige Sprache ist, die für die menschliche Kommunikation entworfen wurde, über eine Literatur verfügt und eine Gemeinschaft besitzt, die sie an eine zweite Generation von Nutzern weitergegeben hat — und er schließt Computer-Programmiersprachen ausdrücklich aus. Esperanto mit seinen Muttersprachlern erfüllt diese Kriterien; Python nicht, weil niemand Python als Erstsprache von seinen Eltern erwirbt. Unser Katalog umfasst die zwei Dutzend von ISO anerkannten konstruierten Sprachen, als solche typisiert, und keine Programmiersprachen.

## Wir bewerten einzelne Sprachen, keine Dachbegriffe

ISO 639-3 unterscheidet *einzelne Sprachen* von *Makrosprachen* — Dachcodes wie `cre` (Cree), `ara` (Arabisch) oder `zho` (Chinesisch), die mehrere eng verwandte einzelne Sprachen umfassen. Die Bewertungseinheit des Network ist die **einzelne Sprache**, und zwar aus einem operativen Grund: Übersetzungsressourcen sind varietätenspezifisch. Ein für Plains Cree (`crk`) entwickelter morphologischer Analysator erzeugt kein Moose Cree (`crm`); ein Korpus des ägyptischen Arabisch sagt wenig über die Qualität einer Methode im marokkanischen Arabisch aus. Ein Wert, der einem Dachcode zugeordnet wird, wäre eine Aussage über Varietäten, die nie tatsächlich evaluiert wurden — daher tun wir das nicht.

Makrosprachen erscheinen im Katalog dennoch als **Hub-Seiten**: eine Navigation, die eine Dachidentität mit ihren einzelnen Mitgliedern verknüpft und damit ISOs eigene Beobachtung widerspiegelt, dass beide Identitätsebenen real sind. Unterhalb der einzelnen Sprache zeigen wir Informationen zu Dialekt und Abstammung aus Glottologs Languoid-Baum (Hammarström & Forkel 2022) an, der Familien, Sprachen und Dialekte als eine navigierbare Hierarchie modelliert.

**Was ist mit Korpora, die unter einem Dachcode bereitgestellt werden?** Bei vielen Daten aus der Praxis ist dies der Fall – Datensätze, die als „Quechua“, „Persisch“ oder „Chinesisch (Vereinfacht)“ veröffentlicht werden. Wir behandeln die vorgelagerte Kennzeichnung als *aufzulösende Metadaten*, nicht als unumstößliche Tatsache, der man sich beugen oder die man verwerfen müsste. Mechanische Fälle werden automatisch anhand der offiziellen ISO-Tabellen aufgelöst: Ein Schrift-Tag wird entfernt (`cmn-Hans` ist Mandarin-Chinesisch, geschrieben in vereinfachten Han-Schriftzeichen – die Schrift wird erfasst, die Sprachidentität ist `cmn`), und ein veralteter Code folgt seinem offiziellen Nachfolger. Wenn die herausgebende Stelle dokumentiert, um welche Varietät es sich bei ihren Daten tatsächlich handelt – FLORES+ kodiert seinen Quechua-Datensatz als `quy`, Ayacucho-Quechua –, erfassen wir diese Auflösung *zusammen mit der Quellenangabe* im Registereintrag des Korpus, und das Korpus wird unter der tatsächlichen Einzelsprache gebenchmarkt. Und wenn niemand sagen kann, welche Varietät eine Sammlung enthält (einige Community-Satzsammlungen führen bewusst eine generische Sammelkategorie „Arabisch“), stellen wir keine Vermutungen an: Das Korpus bleibt unter seiner eigenen Kennzeichnung katalogisiert, wird mit einer maschinenlesbaren Begründung aus der Arbeitswarteschlange ausgeschlossen, die Sie in den Metadaten der Warteschlange einsehen können, und alle historischen Bewertungen dazu bleiben einem ehrlich gekennzeichneten Dachknoten zugeordnet – niemals stillschweigend einer Varietät gutgeschrieben, die nie evaluiert wurde. Jede Auflösung ist nachvollziehbar: Die festgeschriebenen ISO-Tabellen, die korpusspezifischen Auflösungsstempel und die Zitationen sind alle im öffentlichen Register enthalten.

## Wenn die Autoritäten uneins sind, zeigen wir beides

ISO 639-3 und Glottolog unterteilen oder bündeln Sprachen bisweilen unterschiedlich, und Sprachgemeinschaften stimmen manchmal mit keinem von beiden überein. Wir fällen hierzu kein Schiedsurteil. Sprachkarten verfügen über einen Bereich für *Taxonomie-Hinweise*, der die Abweichungen zu den Quellen darstellt, und die Benennung folgt der Gemeinschaft, wo immer diese eine Präferenz geäußert hat. Ob eine Varietät „eine Sprache“ ist, ist letztlich zum Teil eine Frage der Identität – und Identitätsfragen gehören den Gemeinschaften selbst, ein Grundsatz, den wir aus Rahmenwerken zur indigenen Daten-Governance übernehmen.

## Eine Forschungsrichtung: Benchmarks als Messinstrument

Ein Aspekt, den ein solcher Vergleichsraum fast als Nebenprodukt hervorbringt, sind neuartige Erkenntnisse darüber, wie nah sich Sprachvarietäten *im praktischen Einsatz* wirklich sind. Wenn eine einzelne, unveränderte Übersetzungsmethode mehrere verwandte Varietäten so gut abdeckt, dass deren Sprecher das Ergebnis akzeptieren, bilden diese Varietäten in der Praxis Cluster; erfordern sie jedoch separate Korpora und separate Methoden, sind sie operativ voneinander verschieden – ganz gleich, was die Nomenklaturpolitik besagt. Dies ähnelt älteren empirischen Traditionen, von Verständlichkeitstests anhand aufgezeichneter Texte bis hin zu automatisierten Maßen für den lexikalischen Abstand, allerdings mit einem konsequent anwendungsorientierten Ansatz.

Wir bieten dies mit Bedacht an, als Forschungsrichtung und nicht als Behauptung. Ergebnisse zur Methodenübertragung werden durch Korpusgröße, Domäne, Orthographie und Kontamination der Trainingsdaten verfälscht, und eine Clusterbildung ist stets relativ zu einer Methode und einer Qualitätsschwelle. Vor allem: Dieses Signal kann Gespräche über Sprache und Dialekt *informieren*, aber es setzt sich niemals darüber hinweg, wie eine Gemeinschaft ihre eigene Sprache identifiziert.

---

## Referenzen

- Davis, Jeffrey E. (2010). *Hand Talk: Sign Language among American Indian Nations.* Cambridge University Press.
- Dryer, Matthew S. & Martin Haspelmath, Hrsg. (2013). *The World Atlas of Language Structures Online.* https://wals.info
- Hammarström, Harald & Robert Forkel (2022). "Glottocodes: Identifiers Linking Families, Languages and Dialects to Comprehensive Reference Information." *Semantic Web* 13(6).
- Haugen, Einar (1966). "Dialect, Language, Nation." *American Anthropologist* 68(4).
- ISO 639-3 Registration Authority. "Scope of denotation" und "Types of individual languages." https://iso639-3.sil.org/about/scope · https://iso639-3.sil.org/about/types
- Klima, Edward S. & Ursula Bellugi (1979). *The Signs of Language.* Harvard University Press.
- Sandler, Wendy & Diane Lillo-Martin (2006). *Sign Language and Linguistic Universals.* Cambridge University Press.
- Stokoe, William C. (1960). *Sign Language Structure.* Studies in Linguistics, Occasional Papers 8.
- Weinreich, Max (1945). "Der YIVO un di problemen fun undzer tsayt." *YIVO Bleter* 25(1).
- Yin, Kayo, Amit Moryossef, Julie Hochgesang, Yoav Goldberg & Malihe Alikhani (2021). "Including Signed Languages in Natural Language Processing." *Proc. ACL-IJCNLP 2021.* https://aclanthology.org/2021.acl-long.570/


## Wohin dies auf dieser Website führt

Die hier beschriebenen Zählregeln bestimmen jede Zahl auf dieser Website: Die
[Methodik zur Abdeckungsmessung](/docs/network/context/coverage-counting) wendet
sie auf MT-Dienste an, und die
[Sprachkarten](/docs/reference/language-card-spec) erfassen für jede Sprache,
was die einzelnen Quellen tatsächlich angeben.
