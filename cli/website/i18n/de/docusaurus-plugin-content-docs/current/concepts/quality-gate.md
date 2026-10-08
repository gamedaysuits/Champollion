---
sidebar_position: 3
title: "Quality Gate"
related:
  - label: "Coaching Data"
    to: /docs/concepts/coaching-data
    kind: concept
  - label: "Script Converters"
    to: /docs/concepts/script-converters
    kind: concept
  - label: "Scoring Specification"
    to: /docs/network/specifications/scoring
    kind: arena
    note: "How quality is scored on the public benchmark"
  - label: "Cookbook: Translate 30 Languages"
    to: /docs/tutorials/translate-30-languages
    kind: cookbook
    note: "Audit quality across 30 locales"
---

# Quality Gate

Jede Übersetzung durchläuft ein deterministisches Validierungs-Gate, bevor sie auf die Festplatte geschrieben wird. Das Quality Gate erkennt häufige Fehlermuster maschineller Übersetzungen — keine stillen Fallbacks, kein unbrauchbarer Inhalt, der in Ihre Locale-Dateien geschrieben wird.

## Validierungsprüfungen

| Prüfung | Was erkannt wird | Gate-Label |
|---------|------------------|------------|
| **Leer/Blank** | Modell gab leere Zeichenkette oder Leerraum zurück | `[GATE] empty` |
| **Quelltext-Echo** | Modell gab die ursprüngliche englische Eingabe zurück – unverändert oder verschleiert (Akzente, Groß-/Kleinschreibung, vollbreite Zeichen), im gesamten Wert oder in einer Pluralform | `[GATE] source-echo` |
| **ICU- / Platzhalter-Struktur** | Eine übersetzte Variable, ein Plural-Schlüsselwort oder -Selektor, ein verloren gegangenes `#` oder `%s` | `[GATE] icu` |
| **Markup** | Ein Tag anders geöffnet, geschlossen oder verschachtelt als in der Quelle | `[GATE] markup` |
| **Satzumbruch neben einem Platzhalter** | Ein Satzende, das die Übersetzung direkt vor oder nach einem Platzhalter setzt, wo die Quelle keines hat: `Take this medicine at {time}.` → `… sina. {time}.` | `sentence break beside a placeholder` |
| **Halluzinationsschleife** | Sich wiederholende Trigramm-Muster (z. B. `"Qo' Qo' Qo'"`) | `[GATE] hallucination` |
| **Längenaufblähung** | Ausgabe ist signifikant länger als die Quelle | `[GATE] length` |
| **Inhaltslöschung** | Ausgabe ist die Quelle mit entfernten Buchstaben | `[GATE] content` |
| **Schriftsystem-Konformität** | Falsches Schriftsystem für das Ziel-Locale | `[GATE] script` |
| **Gleiche Ausgabe bei unterschiedlichen Eingaben** | Ein Text für mehrere unterschiedliche Quellzeichenketten zurückgegeben (ein auswendig gelernter Satz) | `[GATE] shared-output` |
| **ICU-Plural-Kategorien** | Fehlende erforderliche Pluralformen für das Locale | `[GATE] icu-plural` |

Schlüssel, die als [`noTranslate`](/docs/getting-started/configuration#no-translate) deklariert sind, erreichen das Gate nie – sie werden wortwörtlich aus der Quelle kopiert, sodass es nichts zu validieren gibt.

**Markdown-Seiten durchlaufen dieselben Prüfungen, Block für Block.** In einem Inhaltsordner (`contentDir`, Docusaurus-Dokumentation) wird jede Überschrift, jeder Absatz, jedes Listenelement und jede Tabellenzelle separat geprüft, ebenso wie jedes Front-Matter-Feld. Die Prüfungen entsprechen den oben genannten: leer, Quelltext-Echo, Halluzinationsschleife, Längenaufblähung, Inhaltslöschung, Schriftsystem und gleiche Ausgabe bei unterschiedlichen Eingaben. Eine kurze Überschrift wie `## Feast`, die als ganzer Satz zurückgegeben wird, wird abgewiesen, genau wie der App-Schlüssel mit demselben Text.

Ein abgewiesener Block wird **unter Angabe des Grundes noch einmal angefordert**. Dem Modell wird mitgeteilt, was fehlerhaft war und dass Text, der im Originalzustand korrekt ist, unverändert zurückgegeben werden darf. Manche Abweisungen lassen sich durch keine feste Regel entscheiden: Eine Überschrift, die ein Name ist (`### BLEURT (Sellam et al., 2020)`), ein Eintrag in einem Literaturverzeichnis, eine Codetabelle oder eine Glosse kann genau so, wie sie geschrieben ist, korrekt sein oder eine versäumte Übersetzung darstellen. Wenn der Block unverändert zurückkam oder in einer nicht-lateinischen Sprache in lateinischer Schrift beibehalten wurde und das Modell dieselbe Antwort erneut liefert, wird diese Antwort als beabsichtigt akzeptiert. Jede andere Abweisung muss das Gate bei der zweiten Antwort vollständig passieren. Ein Endpunkt, der deklariert, dass er keinen Anweisungen folgt (`"acceptsInstructions": false`), wird nicht erneut befragt; seine erste Antwort wird wie eine zweite beurteilt.

Was weiterhin abgewiesen wird, wird an die `fallback`-Methode des Sprachpaars übergeben. Ohne eine solche Methode **behält der Block seinen Quelltext, ohne dass der Seite eine Markierung hinzugefügt wird**, wird nie zwischengespeichert und der Sperreintrag der Seite lautet `pending:<hash>`. `status` und `verify` listen solche Seiten auf, und Sync benennt jeden einzelnen Block. Die Abweisung wird vermerkt: Der nächste reguläre Sync sendet diesen Block nicht erneut an dasselbe Modell (siehe [Abgewiesene Markdown-Blöcke und Front-Matter-Felder](#refused-markdown-blocks-and-front-matter-fields)). Code, Links und Markup in einem Block werden separat geschützt, und ein HTML-Kommentar wird niemals gesendet. Manche Texte werden unverändert beibehalten, ohne nachgefragt zu werden:
- ein kurzer Name (`## GitHub`), gemessen ohne Inline-Code, Anführungszeichen, Klammern und `{#anchor}`;
- ein Eintrag in einem Literaturverzeichnis oder ein vollständiges Literaturverzeichnis in einem Block;
- vollbreite Zeichen, die die Quelle selbst enthält.

Eine Tabelle wird anhand ihrer Zellen gemessen, nicht anhand ihrer Pipes und Trennzeilen. `verify` prüft die bereits auf dem Datenträger vorhandenen Blöcke auf dieselbe Weise, mit Ausnahme eines Blocks, der exakt dem entspricht, was Sync für seine Quelle akzeptiert und zwischengespeichert hat. Ein Block, der fehlschlägt, ist eine Warnung, die `verify --strict` fehlschlagen lässt, und wird zusammen mit dem Reparaturbefehl `champollion sync --pair en:fr --redo files:<page>` ausgegeben. Sync gibt denselben Befehl für dieselbe Datei aus.

### Empty/Blank

Lehnt Übersetzungen ab, die leere Strings, ausschließlich Leerzeichen oder `null` sind. Dies erkennt Modelle, die für schwierige Keys nichts zurückgeben.

### Source Echo

Erkennt, wenn das Modell den englischen Quelltext zurückgibt, anstatt ihn zu übersetzen. Dies tritt häufig bei kurzen Zeichenketten und ungenau spezifizierten Prompts auf. Es gelten zwei Regeln, die unterschiedliche Aspekte messen:

1. **Eine exakte Kopie** (Byte für Byte die Quelle) wird abgewiesen – mit Ausnahme eines **kurzen, überwiegend aus ASCII-Zeichen bestehenden** Werts: 30 Zeichen oder weniger, mehr als 80 % reines ASCII. `"Blog"`, `"GitHub"`, `"npm"` bleiben berechtigterweise auf Englisch; in einer Zielsprache mit lateinischer Schrift wird eine solche Kopie daher akzeptiert (`verify` listet sie als Quelltext-Echo auf); bei einem nicht-lateinischen Ziel wird das Modell einmal gefragt, ob es sich um einen Namen handelt, und dieselbe Antwort beim zweiten Mal wird als solcher akzeptiert. **Diese Ausnahme bezieht sich auf die Länge und gilt nur für exakte Kopien.**
2. **Eine verschleierte Kopie** – die Quelle, bei der lediglich Groß-/Kleinschreibung, Akzente, Abstände, unsichtbare Zeichen oder Kompatibilitätsformen (vollbreite Buchstaben, Ligaturen) geändert wurden – wird abgewiesen, wenn die Quelle **drei oder mehr Wörter** mit Buchstaben enthält (Platzhalter wie `{count}` oder `%s` sowie Markup-Tags zählen nicht), **ganz gleich, wie kurz sie ist**. `"Book an appointment"` (19 Zeichen, 3 Wörter) → `"Bóok án appóintment"` wird abgewiesen; `"cafe"` → `"café"` (1 Wort) wird akzeptiert, da sich eine echte Übersetzung vom Englischen nur durch ihre Akzente unterscheiden kann. Ein längerer Name, der berechtigterweise Akzente erhält (`"Universite de Montreal"`), wird akzeptiert, sobald Sie die akzentuierte Schreibweise als geschützten Begriff deklarieren.

Beide Regeln gelten ebenso **für jede Pluralform**. Ein gettext-`msgstr[n]`-Plural, ein ICU-`{n, plural, …}`-Zweig oder ein i18next-`_one`/`_other`-Schlüssel unterliegt denselben Regeln wie ein Singularwert: Ein russischer Plural, dessen `few`-Form als englisches Wort mit Akzenten zurückkam, wird genauso abgewiesen wie der Singular.

Längere Werte, die ebenfalls unverändert korrekt sind – URLs, Repository-Pfade, Produktkennungen –, stellen kein Problem des Gates dar und lassen sich nicht durch eine Justierung des Gates beheben: Die korrekte Antwort *ist* das Echo, daher ist jede denkbare Modellausgabe falsch. Deklarieren Sie diese Schlüssel mit [`noTranslate`](/docs/getting-started/configuration#no-translate), damit sie die Pipeline vollständig umgehen. Schlüssel mit URLs als Werten werden standardmäßig so behandelt.

### Hallucination Loop

Analysiert Trigramm-Muster (3 Zeichen) in der Ausgabe. Wenn sich ein Trigramm im Verhältnis zur Ausgabelänge häufiger als ein Schwellenwert wiederholt, wird die Übersetzung abgelehnt. Dies erkennt degenerierte Ausgaben wie `"Qo' Qo' Qo' Qo' Qo'"`.

### Length Inflation

Weist Übersetzungen ab, bei denen die Ausgabelänge `maxLengthRatio × source length` (Standard: 4×) überschreitet – strikt mehr: Eine Übersetzung mit genau 4× wird akzeptiert. Dies fängt Modell-Halluzinationen ab, die bei einer kurzen Eingabe regelrechte Textwände erzeugen.

Konfigurierbar über `maxLengthRatio` in Ihrer Konfiguration.

### Inhaltslöschung

Das Gegenstück zur Längenaufblähung. Ein Modell, dem das Vokabular für eine Zeichenkette fehlt, kann jeden Buchstaben löschen, den es nicht übersetzen kann, und die Satzzeichen sowie Abstände der Quelle stehen lassen:

```
"low-resource nmt · tokenizers · nêhiyawêwin"  →  "   ·   · êhiêi"
"the simple-builder approach"                  →  "  "
```

Keine andere Prüfung erkennt dies. Es ist nicht leer, kein Echo, nicht repetitiv und unterschreitet bzw. passiert mit 33 % der Quell*länge* `minLengthRatio` problemlos.

Die Prüfung vergleicht **Inhaltszeichen** – Buchstaben und Ziffern, unter Ausschluss von Satzzeichen, Leerraum und unsichtbarer Formatierung – zwischen Quelle und Ausgabe. Die Zeichendichte allein kann jedoch nicht als Regel dienen, da legitime dichte Schriftsysteme im exakt selben Bereich liegen:

| Quelle | Ausgabe | Beibehaltener Inhalt | Urteil |
|--------|---------|----------------------|--------|
| `low-resource nmt · tokenizers · nêhiyawêwin` | `   ·   · êhiêi` | 14% | **abgewiesen** |
| `Getting started` | `入门` | 14% | akzeptiert |
| `Frequently asked questions` | `常见问题` | 17% | akzeptiert |

Jeder Schwellenwert, der den ersten Fall abfängt, würde Chinesisch, Japanisch und Koreanisch sofort abweisen. Was sie unterscheidet, ist nicht, wie viel erhalten geblieben ist, sondern *woher es stammt*: Die ausgehöhlte Ausgabe ist eine **Teilsequenz** (Subsequence) ihrer eigenen Quelle – erzeugbar durch das Löschen von Zeichen daraus –, während eine echte Übersetzung praktisch keine Gemeinsamkeiten mit der Quelle aufweist. Eine Markierung erfordert **beide** Signale; die Prüfung ist also im selben Maße notwendig, aber nicht hinreichend, wie die Wiederholungserkennung.

Konfigurierbar über `minContentRetention` (Standard: `0.35`), pro Sprachpaar oder pro Sprache. Eine Erhöhung macht die Prüfung strenger; sie schlägt stets nur zusammen mit dem Teilsequenz-Signal an.

:::note[Dies ist ein Vokabularsignal, kein Qualitätsregler]
Wenn dies bei einer Zielsprache wiederholt anschlägt, verfügt das Modell über keine Wörter für diesen Text – typischerweise bei kurzen, fachsprachlichen Zeichenketten in einer Sprache mit geschlossenem Lexikon. Eine Lockerung des Schwellenwerts stellt lediglich die unbemerkte Verfälschung wieder her; sie erzeugt keine Übersetzung. Korrigieren Sie den Prompt, die Coaching-Daten oder das Sprachpaar.
:::

### Script Compliance

Für Locales, deren Sprachkarte ein nicht-lateinisches Schriftsystem ausweist (Arabisch, CJK, Kyrillisch, …), wird validiert, dass die Ausgabe nicht ausschließlich lateinisch ist. Buchstaben werden nach **Unicode-Schriftsystem** (Unicode Script) klassifiziert, nicht nach Byte: Lateinische Zeichen mit Akzent (`"Bóók"`) und vollbreite lateinische Zeichen (`"Ｂｏｏｋ"`) gelten als lateinisch, daher wird keines von beiden als Russisch akzeptiert. Vollbreite lateinische Buchstaben werden in jedem Ziel außerhalb der CJK-Typografie (wo `"ＯＫ"` gängiger japanischer Praxis entspricht) abgewiesen – sie stellen verschleiertes Englisch dar. Die üblichen Ausnahmen gelten weiterhin: Ein kurzer Name, der wie geschrieben beibehalten wird (die oben beschriebene Namens- oder Label-Prüfung), deklarierte geschützte Begriffe und `noTranslate`-Schlüssel (darunter URLs) schlagen hierbei nie fehl.

Zwei Klarstellungen darüber, was diese Prüfung *nicht* ist:

- Sie wird **nicht durch das Konfigurationsfeld `script:` gesteuert.** Dieses Feld wählt die Ausgabe-Orthografie für die [Schriftkonvertierung](/docs/getting-started/configuration#script-conversion) aus; die Erwartung des Gates stammt aus den Sprachkarten.
- Sie validiert stets die **Arbeitsschrift, die das Modell ausgibt**, *vor* jeglicher Schriftkonvertierung. Locales mit einem Schriftkonverter (crk, sr, tlh, …) erzeugen korrekterweise Ausgaben in lateinischer Arbeitsschrift und sind daher von dieser Prüfung ausgenommen; die Konvertierung – sofern in der Konfiguration aktiviert – erfolgt nach dem Gate.

### Markup

Tags sind Code. Pro Tag-Name muss die Übersetzung dieselbe Anzahl von Tags öffnen, schließen und selbstschließend abschließen wie die Quelle, und sie auf dieselbe Weise verschachteln (`<b>` innerhalb von `<a>` bleibt innerhalb von `<a>`); die Reihenfolge gleichrangiger Tags darf sich mit der Wortstellung ändern. `"Please <strong>book</strong> now"` → `"Veuillez <strong>réserver maintenant"` wird abgewiesen – ein verloren gegangenes schließendes Tag zerstört die Seite. In einer Plural-Nachricht wird jede Form mit der Quellform verglichen, die sie übersetzt. `verify` führt dieselbe Prüfung für die Dateien durch.

### Satzumbruch neben einem Platzhalter

Ein Platzhalter wird zur Laufzeit ausgefüllt; ein Satzende, das die Übersetzung direkt daneben platziert, verändert daher das, was der Leser sieht: `"Take this medicine at {time}."` → `"… sina. {time}."` stellt die Uhrzeit als eigenständigen Satz dar. Das Gate weist eine Übersetzung ab, die ein Satzende (`.`, `!`, `?` oder das Zeichen eines anderen Schriftsystems: `。`, `？`, `।`, `؟`, `።`, `᙮`, …) direkt **vor** einen Platzhalter oder direkt **nach** einen Platzhalter setzt, wenn weiterer Text folgt, sofern die Quelle an dieser Stelle kein Satzzeichen aufweist und die Übersetzung mehr Satzenden enthält als die Quelle. Ein Platzhalter, der lediglich an das Satzende verschoben wird (`"Shipped by {carrier} on {date}."` → `"Expédié le {date} par {carrier}."`), wird akzeptiert. Dasselbe gilt für Auslassungspunkte, Dezimalzahlen oder Dateinamen (`{host}.com`) sowie einbuchstabige Abkürzungen (`"M. {name}"`). Eine längere Abkürzung vor einem Platzhalter (`"ca. {count}"`) lässt sich nicht von einem Satzende unterscheiden, wird daher ebenfalls abgewiesen und an den Fallback des Sprachpaars oder eine umformulierte Antwort übergeben. `verify` markiert dieselben Werte auf dem Datenträger zusammen mit dem Befehl `--redo` für eine erneute Anfrage. ICU-Plural- und Select-Nachrichten bleiben der ICU-Prüfung überlassen.

### Gleiche Ausgabe bei unterschiedlichen Eingaben

Ein Modell, das einen Trainingssatz auswendig gelernt hat, kann diesen für unbekannte Zeichenketten zurückgeben: derselbe Satz für den App-Titel, „Contact the school“, einen Newsletter-Titel und dessen Überschrift, wobei jeder Text für sich genommen alle obigen Prüfungen besteht. Wenn eine Übersetzung auf **drei oder mehr verschiedene Quellzeichenketten** innerhalb des Durchlaufs eines Locales antwortet – und sie vier oder mehr Wörter umfasst oder die Quellen jeweils zwei oder mehr Wörter mit geringer Gemeinsamkeit aufweisen –, werden diese Schlüssel abgewiesen (sodass der Neuversuch und anschließend der Fallback greifen). **Zwei** unterschiedliche Quellzeichenketten genügen, wenn die Indizien eindeutig sind: Beide bestehen aus zwei oder mehr Wörtern, teilen weniger als die Hälfte ihrer Wörter und die gemeinsame Übersetzung umfasst vier oder mehr Wörter (`"Thank you for coming!"` und `"Please bring the forms."` mit einem Satz beantwortet). Ein auf diese Weise erkannter Satz wird für das Locale vorgemerkt: Ein späterer Sync, der ihn selbst für nur eine einzige Zeichenkette zurückerhält, weist ihn ab, und die Cache-Einträge, die ihn bereits bereitgestellt haben, werden entfernt, sodass ein Redo das Modell erneut anfragt, anstatt ihn aus dem Cache zu schreiben. Synonyme, die zu einer einzigen kurzen Übersetzung zusammenfallen (`"OK"`/`"Okay"`/`"Sure"` → `"D'accord"`, `"Close"`/`"Dismiss"` → `"Fermer"`), werden akzeptiert, ebenso wie ein einzelner Quelltext, der unter mehreren Schlüsseln verwendet wird. Markdown-Blöcke und Front-Matter-Felder der Inhaltsdateien des Durchlaufs zählen ebenfalls dazu, genau wie jeder Zweig einer ICU-Plural- oder Select-Nachricht (die Zweige eines Plurals zählen als eine Quelle – eine Sprache ohne Numerusflexion schreibt in jeden Zweig denselben Text). Ausgaben werden ohne Berücksichtigung von Groß-/Kleinschreibung, Zeichensetzung und Markdown-Blockmarkierungen verglichen, sodass `"S?"`, `"S."` und eine Überschrift `# S` als eine Ausgabe gelten. Die Zählung schließt ein, was das Locale bereits auf dem Datenträger enthält und was der Cache liefern würde (ein Satz, der von einem anderen Tool Text für Text zwischengespeichert wurde, wird am Cache abgewiesen und nicht geschrieben), sodass auch Schlüssel erfasst werden, die schrittweise über mehrere Syncs hinweg hinzugefügt werden. `verify` schlägt bei demselben Muster auf dem Datenträger fehl, und das MCP-Tool `translate` weist es innerhalb eines Aufrufs ab.

### Eine Frage, die ihr Satzzeichen verloren hat

Wenn die Quelle mit `?` oder `!` endet und die Übersetzung weder damit noch mit der im jeweiligen Schriftsystem üblichen Entsprechung endet (`？`, `؟`, griechisches `;`, `¿…?`, `！`, …), geben `sync` und `verify` eine Warnung aus: Ein als Aussage formuliertes `"Where does it hurt?"` liest sich auch wie eine solche. Es handelt sich um eine Warnung, nicht um eine Abweisung, da manche Sprachen eine Frage durch ein Wort oder eine Partikel statt durch ein Satzzeichen kennzeichnen. Die Warnung nennt die Schlüssel und den Befehl `--redo keys:<key> --fresh` für eine erneute Anfrage (`--fresh`, da der Cache die Antwort enthält).

## Was bei einem Fehler geschieht

1. Die fehlerhafte Übersetzung wird mit dem Präfix `[GATE]`, dem Schlüsselnamen, dem Grund und einer Vorschau des Werts auf stderr protokolliert
2. Der Schlüssel wird **nicht** in die Locale-Datei geschrieben
3. Die Wiederholungskaskade greift (siehe unten)
4. Schlägt sie weiterhin fehl, wird die Abweisung **vorgemerkt** (siehe [Abgewiesene Schlüssel werden zurückgehalten](#refused-keys-are-held-back))

```
[GATE] hero.title: source-echo — "Welcome to our platform"
[GATE] nav.about: hallucination — "À À À À À À À À"
```

## Feedback-Wiederholung und die Wiederholungskaskade

Ein vom Gate abgewiesener Schlüssel erhält **eine Feedback-Wiederholung**: Der Abweisungsgrund wird als schlüsselspezifischer Kontext in den Prompt eingefügt (ein blinder Wiederholungsversuch bei niedriger Temperature würde eine Byte-identische Ausgabe liefern). Besteht der Wiederholungsversuch die Prüfung, wird der Schlüssel geschrieben und der Sync ist **erfolgreich (grün)** – eine Abweisung am Gate, die sich selbst behebt, gilt nicht als Fehler, und dies entspricht der beabsichtigten Semantik. Schlüssel, die nach der Wiederholung weiterhin fehlschlagen, werden übersprungen und gemeldet (der Sync beendet mit `2`).

Die Wiederholung erfolgt über die eigene Übersetzungsmethode des Sprachpaars, unabhängig davon, um was es sich handelt – LLM, Google Translate, DeepL oder ein direkter Anbieter. Nur LLM-Methoden verarbeiten das Feedback; die Ausführungszeile weist darauf hin (`retrying with feedback` oder `asking once more (deepl takes no instructions…)`). Ein `api`-Endpunkt erhält das Feedback nur, wenn er `"acceptsInstructions": true` deklariert (beim Sprachpaar oder in seinem Plugin-Manifest); ein Endpunkt, der `false` deklariert – ein trainiertes NMT-Modell wie `nmt-forge serve`, das dieselbe Antwort liefern würde –, wird überhaupt nicht erneut befragt: Seine Antworten werden wie eine zweite Antwort beurteilt, und was abgewiesen wird, geht an den Fallback des Sprachpaars. Die Wiederholung gilt auch für Treffer im Translation Memory: Ein zwischengespeicherter Wert, den das Gate abweist, wird verworfen und im selben Durchlauf neu übersetzt, sodass sich ein verfälschter Cache selbst bereinigt.

### Abgewiesene Schlüssel werden zurückgehalten

Eine Abweisung wird in `.champollion.lock` pro Schlüssel für den **aktuellen Quelltext** des Schlüssels sowie die **Methode und das Modell** vermerkt, die die abgewiesene Antwort erzeugt haben. Docusaurus-UI-Zeichenketten (`i18n/<locale>/code.json` und die JSON-Dateien der Plugins) folgen derselben Regel, pro Datei und ID. Der nächste reguläre Aufruf von `sync` sendet diesen Schlüssel nicht erneut an dasselbe Modell – dies würde lediglich Kosten für dieselbe Antwort verursachen – und gibt an, wie viele Schlüssel zurückgehalten wurden und wie weiter vorzugehen ist:

- Erneut anfragen: `champollion sync --redo keys:<key>` (oder `--redo all`, oder `--fresh`) – die Nennung des Schlüssels stellt einen expliziten Neuversuch dar;
- Auf andere Weise ausfüllen: Fügen Sie dem Sprachpaar eine `"fallback"`-Methode hinzu (diese wird für Schlüssel angefragt, die die eigene Methode des Sprachpaars abgewiesen hat), führen Sie den Schlüssel in `noTranslate` auf, falls er unverändert bleibt, oder tragen Sie die Übersetzung manuell in die Datei ein.

Ein zurückgehaltener Schlüssel gilt als unübersetzt, sodass der Sync mit `2` beendet wird, bis er ausgefüllt ist. Eine Änderung des Quelltexts, des Modells oder der Methode hebt die Zurückhaltung auf (die Abweisung galt für diesen spezifischen Text von diesem Modell). Der Cache wird dafür weiterhin abgefragt – das Zurückhalten stoppt kostenpflichtige Aufrufe, keine kostenlosen. Ein Schlüssel, den ein Redo nicht abschließen konnte, stellt die einzige Ausnahme dar (siehe unten).

### Abgewiesene Markdown-Blöcke und Front-Matter-Felder

Dieselbe Regel gilt für Inhaltsdateien (`contentDir`, Docusaurus-Dokumentation). Ein Block oder Front-Matter-Feld, das vom Gate abgewiesen wurde, wird in `.champollion-content.lock` pro Seite, Block und Locale für den **aktuellen Quelltext** des Blocks sowie die **Methode und das Modell** vermerkt, die die abgewiesene Antwort erzeugt haben. Ein Block wird über seinen Quelltext identifiziert, daher hebt die Bearbeitung des Absatzes die Zurückhaltung auf. Der nächste reguläre Aufruf von `sync` sendet ihn nicht erneut an dasselbe Modell und gibt an, wie viele Blöcke und Felder auf welcher Seite zurückgehalten wurden:

- Ein zurückgehaltener Block behält seinen Quelltext auf der Seite ohne Markierung bei, bis er ausgefüllt ist; der Rest der Seite wird geschrieben;
- ein zurückgehaltenes Front-Matter-Feld behält seinen Quelltext auf dieselbe Weise bei, und der Rest der Seite wird geschrieben;
- eine als Ganzes übersetzte Seite (`contentSegmentation: "page"`) wird als Ganzes abgewiesen, wenn ihre Antwort einen geschützten Block beschädigt oder die Seite aushöhlt. Sie wird über den Text ihres Textkörpers (Body) vermerkt und vollständig zurückgehalten: Sie wird nicht geschrieben und nichts davon wird gesendet, bis sie ausgefüllt ist. Das Bearbeiten des Inhalts oder der Wechsel zur Blocksegmentierung hebt die Zurückhaltung auf.

Eine Abweisung durch eine frühere Version des Gates hebt sich von selbst auf. Wenn eine Prüfung gelockert wird, wird das zuvor Abgewiesene beim nächsten Sync ohne Redo erneut angefordert.

Die Rangfolge entspricht der Rangfolge für Schlüssel:

1. Eine für einen Redo angegebene Seite wird immer gesendet: `champollion sync --redo files:<page>`, `--redo content` (jede Seite), `--retranslate` oder alles unter `--fresh`.
2. Andernfalls wird ein abgewiesener Block oder ein abgewiesenes Feld zurückgehalten. Verfügt das Sprachpaar über eine `fallback`-Methode, die diesen nicht abgewiesen hat, wird der Fallback angefragt und die eigene Methode des Sprachpaars übergangen.
3. Ein Wechsel des Modells oder der Methode hebt die Zurückhaltung auf, ebenso wie eine Änderung am Quelltext des Blocks.

Der Cache wird weiterhin zuerst gelesen, sodass das Zurückhalten kostenpflichtige Aufrufe verhindert, nicht jedoch kostenlose. Ein auf andere Weise ausgefüllter Block entfernt seinen Eintrag: durch einen Fallback, durch den Cache oder durch einen Absatz, den Sie selbst in der Übersetzung verfassen (ein Inhaltsordner behält manuell geschriebene Absätze bei). Ein zurückgehaltener Block oder ein zurückgehaltenes Feld gilt als unübersetzt, sodass der Sync mit `2` beendet wird, bis der Inhalt vorliegt. Dasselbe gilt für einen Block, den das Gate während dieses Durchlaufs abgewiesen hat. Ein Probelauf (Dry Run) listet auf, was ein tatsächlicher Durchlauf zurückhalten würde.

### Ein Redo, das nicht abgeschlossen werden konnte

Wenn `--redo all`, `--redo keys:` oder ein Modellwechsel (`--redo all --fresh-on-model-change`) Schlüssel einer Key-Value-Datei unübersetzt lässt, werden diese in `.champollion.lock` als **ausstehend (pending)** erfasst, und der nächste reguläre Aufruf von `sync` fragt sie erneut beim Modell an – beim Modell, nicht beim Cache (denn das Ziel des Redos war der Text des neuen Modells). `champollion status` listet diese auf. Wenn dieser Neuversuch ebenfalls abgewiesen wird, bleibt der Schlüssel ausstehend (der Status weist darauf hin) und wird wie jeder andere abgewiesene Schlüssel zurückgehalten. In der Reihenfolge der Priorität: Ein durch `--redo`/`--fresh` benannter Schlüssel wird immer gesendet; ein ausstehender Schlüssel erhält diesen einen Neuversuch; ein abgewiesener Schlüssel wird zurückgehalten. Eine Docusaurus-UI-Zeichenkette besitzt keinen ausstehenden Neuversuch: Wird sie bei einem Redo abgewiesen, wird sie beim nächsten regulären Sync zurückgehalten, genau wie ein Inhaltsblock.

Unabhängig davon wiederholt Champollion den Versuch mit schrittweise kleineren Batches, wenn ein gesamter Batch fehlschlägt (JSON-Parsing-Fehler):

```
Full batch (80 keys) → parse error
  └→ Half batch (40 keys) → 2 failures
      └→ Individual keys (1 each) → isolates the 2 problem keys
```

Das Retry-Budget wird durch `maxRetries` begrenzt (Standard: 3, pro Sprache konfigurierbar). Dies verhindert ausufernde Token-Kosten bei Keys, die durchgängig fehlschlagen.

Nach Ausschöpfung aller Wiederholungsversuche werden die problematischen Schlüssel protokolliert und übersprungen. Ein Schlüssel, der keine verwertbare Antwort erhalten hat (in der Antwort fehlte), wird beim nächsten Aufruf von `sync` erneut angefragt; ein vom Gate abgewiesener Schlüssel wird wie oben beschrieben zurückgehalten.

## Prompt Caching

Die System-Nachricht (Register, Grammatikregeln, Stilhinweise) wird von der Benutzer-Nachricht (den zu übersetzenden Keys) getrennt. Diese Trennung ist beabsichtigt:

- Die System-Nachricht ist **über alle Batches hinweg identisch** für eine gegebene Locale
- Anbieter wie Anthropic und Google cachen wiederholte System-Nachrichten
- Ergebnis: Der erste Batch trägt die vollen Token-Kosten, nachfolgende Batches zahlen nur für die Benutzer-Nachricht

Dies kann die Token-Kosten für Projekte mit vielen Batches erheblich reduzieren.

## ICU-MessageFormat-Validierung

Der Befehl `integrity` validiert ICU-MessageFormat-Pluralmuster anhand der CLDR-Pluralregeln. Wenn Ihre Quelldatei ICU-Syntax wie die folgende verwendet:

```json
"items": "{count, plural, one {# item} other {# items}}"
```

verifiziert Champollion, dass die übersetzten Versionen alle für die Ziel-Locale erforderlichen Pluralkategorien enthalten. Beispielsweise erfordert Arabisch sechs Kategorien (`zero`, `one`, `two`, `few`, `many`, `other`) — nicht nur `one` und `other`.

### Pluralformen, die die Übersetzung nicht geliefert hat

Der Prompt nennt die CLDR-Kategorien der Zielsprache. Wenn eine Plural-Nachricht ohne eine Kategorie zurückkommt, die die Sprache für gewöhnliche Zählmengen verwendet (jede Zahl von 0 bis 1000 – im Russischen `few` für 2, 3, 4 und `many` für 0, 5, 6), fragt das Gate das Modell noch einmal an und nennt die fehlenden Formen sowie die Zählmengen, die sie abdecken. Eine zweite Antwort ohne diese Formen wird akzeptiert, niemals ein drittes Mal angefragt und niemals durch das Tool ergänzt – Sync geht dann wie folgt vor:

- Gibt eine Warnung aus, die jeden Schlüssel und seine fehlenden Formen sowie den Befehl für eine erneute Anfrage nennt (`sync --redo keys:… --fresh`, wobei ein stärkeres `--model` hilft);
- schreibt in einem gettext-Katalog, in dem `msgfmt` jedes `msgstr[n]` benötigt, die fehlenden Formen als Kopien von `other` und kennzeichnet den Eintrag mit einem Übersetzerkommentar `# champollion:` (Poedit und Weblate zeigen diesen an; `verify` liest ihn, auch in der CI ohne Cache);
- schreibt die Nachricht in ICU-Dateien (next-intl, ARB) so, wie sie empfangen wurde; die Anwendung zeigt für diese Zählmengen die `other`-Form an.

Eine solche Nachricht wird nicht als übersetzt behandelt. Ein späterer Sync, der eine andere Methode oder ein anderes Modell ausführt – ein Modell, das die Nachricht noch nicht beantwortet hat, wie etwa das gehostete Modell in der CI nach einem lokalen Modell –, fragt sie erneut an, und zwar beim Modell und nicht beim Cache (der die unvollständige Antwort enthält); die Kostenschätzung preist dies ein. `sync --redo gaps` fragt jede dieser Nachrichten an, unabhängig davon, wer sie hinterlassen hat. Wenn der neuen Antwort die Formen ebenfalls fehlen, bleibt die Nachricht unverändert (in einem Katalog markiert), und `.champollion.lock` zeichnet auf, welche Konfigurationen ohne diese Formen geantwortet haben, sodass keine davon erneut für denselben Text angefragt wird ([CI-Leitfaden](/docs/guides/ci-cd#plural-gaps)).

`verify` meldet beide Fälle mit dem Reparaturbefehl. Formen, die erst oberhalb von 1000 oder bei Bruchteilen erreicht werden (französisches und spanisches `many`, verwendet für 1 000 000), erhalten eine Info-Zeile statt einer Warnung. Einer Machine-Translation-Engine (DeepL, Google, …) kann nicht vorgegeben werden, welche Formen sie schreiben soll, daher wird deren Antwort nicht wiederholt – sondern lediglich gemeldet. Bei i18next-Dateien ist jede Form, die in der Quelle nicht vorhanden ist (französisches `count_many` ausgehend vom Englischen), ein eigener Schlüssel, der anhand des `_other`-Texts übersetzt wird: Ein LLM wird nach dieser Form gefragt, worauf Sync hinweist; bei einer Machine-Translation-Engine wird angegeben, dass der Wert die `other`-Form enthält.

Führen Sie `champollion integrity` aus, um die Pluralvollständigkeit über alle Locales hinweg zu prüfen.

## Terminologie-Durchsetzung

Für gecoachte Paare mit einem Wörterbuch führt champollion nach der Übersetzung eine Terminologieprüfung durch. Nachdem das Quality Gate bestanden wurde, wird verifiziert, ob das LLM die erforderlichen Wörterbuchbegriffe tatsächlich verwendet hat.

```
[TERM] en→fr: 2 term violation(s)
  • hero.title: "dashboard" → expected "tableau de bord" but got "panneau de contrôle"
```

Terminologieverstöße sind **Warnungen, keine blockierenden Fehler**. Die Übersetzung wird dennoch auf die Festplatte geschrieben. Dies ist beabsichtigt — das LLM kann triftige Gründe für die Wahl einer Alternative haben (Kontext, Grammatik), und ein Blockieren bei Begriffsabweichungen würde mehr Schaden als Nutzen anrichten.

Um Verstöße zu beheben, aktualisieren Sie das Coaching-Wörterbuch oder bearbeiten Sie die Locale-Datei manuell.

---

## Siehe auch

- [Wie die Synchronisierung funktioniert](/docs/concepts/how-sync-works) — wo das Quality Gate in die Pipeline passt
- [Übersetzungsmethoden](/docs/guides/translation-methods) — Methoden, die in das Gate einfließen
- [Script Converters](/docs/concepts/script-converters) — Schriftkonvertierung nach dem Gate
- [Coaching-Daten](/docs/concepts/coaching-data) — Verbesserung der Übersetzungsqualität im Vorfeld
- [Translation Memory](/docs/concepts/translation-memory) — Caching validierter Übersetzungen
- [CLI-Referenz — sync](/docs/reference/cli#sync) — sync-Flags einschließlich Retry-Verhalten
- [CLI-Referenz — integrity](/docs/reference/cli#integrity) — ICU-Pluralprüfung
