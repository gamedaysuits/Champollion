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

| Prüfung | Was sie erfasst | Gate-Label |
|-------|----------------|-----------|
| **Leer/Leerzeichen** | Modell hat eine leere Zeichenfolge oder Leerzeichen zurückgegeben | `[GATE] empty` |
| **Quelltext-Echo** | Modell hat die ursprüngliche englische Eingabe zurückgegeben | `[GATE] source-echo` |
| **Halluzinationsschleife** | Wiederholte Trigramm-Muster (z. B. `"Qo' Qo' Qo'"`) | `[GATE] hallucination` |
| **Längeninflation** | Ausgabe ist deutlich länger als die Quelle | `[GATE] length` |
| **Inhaltslöschung** | Ausgabe ist die Quelle, bei der die Buchstaben entfernt wurden | `[GATE] content` |
| **Schriftsystem-Konformität** | Falsches Schriftsystem für das Ziel-Locale | `[GATE] script` |
| **ICU-Pluralkategorien** | Fehlende erforderliche Pluralformen für das Locale | `[GATE] icu-plural` |

Schlüssel, die als [`noTranslate`](/docs/getting-started/configuration#no-translate) deklariert sind, erreichen das Gate niemals — sie werden wortwörtlich aus der Quelle kopiert, sodass es nichts zu validieren gibt.

### Empty/Blank

Lehnt Übersetzungen ab, die leere Strings, ausschließlich Leerzeichen oder `null` sind. Dies erkennt Modelle, die für schwierige Keys nichts zurückgeben.

### Source Echo

Erkennt, wenn das Modell den englischen Quelltext zurückgibt, anstatt ihn zu übersetzen. Häufig bei kurzen Strings und unzureichend spezifizierten Prompts.

Kurze, überwiegend aus ASCII bestehende Zeichenfolgen (≤ 30 Zeichen) sind ausgenommen — `"Blog"`, `"GitHub"`, `"npm"` bleiben legitimerweise überall auf Englisch, und sie abzulehnen würde zu einer Endlosschleife führen.

Längere Werte, die unverändert ebenfalls korrekt sind — URLs, Repository-Pfade, Produktkennungen — stellen kein Gate-Problem dar und können nicht durch eine Anpassung des Gates behoben werden: Die korrekte Antwort *ist* das Echo, daher ist jede mögliche Modellausgabe falsch. Deklarieren Sie diese Schlüssel mit [`noTranslate`](/docs/getting-started/configuration#no-translate), und sie umgehen die Pipeline vollständig. Schlüssel mit URL-Werten werden standardmäßig auf diese Weise behandelt.

### Hallucination Loop

Analysiert Trigramm-Muster (3 Zeichen) in der Ausgabe. Wenn sich ein Trigramm im Verhältnis zur Ausgabelänge häufiger als ein Schwellenwert wiederholt, wird die Übersetzung abgelehnt. Dies erkennt degenerierte Ausgaben wie `"Qo' Qo' Qo' Qo' Qo'"`.

### Length Inflation

Lehnt Übersetzungen ab, bei denen die Ausgabelänge `maxLengthRatio × source length` überschreitet (Standard: 4×). Dies erkennt Modell-Halluzinationen, die für eine kurze Eingabe ganze Textwände erzeugen.

Konfigurierbar über `maxLengthRatio` in Ihrer Konfiguration.

### Inhaltslöschung

Das Spiegelbild der Längeninflation. Ein Modell ohne Vokabular für eine Zeichenfolge kann jeden Buchstaben löschen, den es nicht übersetzen kann, und die Interpunktion sowie die Leerzeichen der Quelle stehen lassen:

```
"low-resource nmt · tokenizers · nêhiyawêwin"  →  "   ·   · êhiêi"
"the simple-builder approach"                  →  "  "
```

Nichts anderes erfasst dies. Es ist nicht leer, kein Echo, nicht repetitiv, und mit 33 % der *Länge* der Quelle passiert es `minLengthRatio` problemlos.

Die Prüfung vergleicht **Inhaltszeichen** — Buchstaben und Ziffern, wobei Interpunktion, Leerzeichen und unsichtbare Formatierungen ignoriert werden — zwischen Quelle und Ausgabe. Aber die Dichte allein kann nicht die Regel sein, da legitime dichte Schriftsysteme an genau derselben Stelle ansetzen:

| Quelle | Ausgabe | Behaltener Inhalt | Urteil |
|--------|--------|------------------|---------|
| `low-resource nmt · tokenizers · nêhiyawêwin` | `   ·   · êhiêi` | 14% | **abgelehnt** |
| `Getting started` | `入门` | 14% | akzeptiert |
| `Frequently asked questions` | `常见问题` | 17% | akzeptiert |

Jeder Schwellenwert, der das Erste erfasst, lehnt Chinesisch, Japanisch und Koreanisch kategorisch ab. Was sie unterscheidet, ist nicht, wie viel übrig geblieben ist, sondern *woher es stammt*: Die ausgehöhlte Ausgabe ist eine **Teilsequenz** ihrer eigenen Quelle — erzeugbar durch das Löschen von Zeichen daraus —, während eine echte Übersetzung im Grunde nichts mit der Quelle teilt. Eine Markierung erfordert **beide** Signale, daher ist die Prüfung notwendig, aber nicht hinreichend, genau wie der Wiederholungsdetektor.

Konfigurierbar über `minContentRetention` (Standardwert `0.35`), pro Paar oder pro Sprache. Eine Erhöhung macht die Prüfung empfindlicher; sie wird immer nur zusammen mit dem Teilsequenz-Signal ausgelöst.

:::note[Dies ist ein Vokabular-Signal, kein Qualitätsregler]
Wenn dies wiederholt für eine Zielsprache ausgelöst wird, hat das Modell keine Wörter für diesen Text — meist kurze, fachsprachlich dichte Zeichenfolgen in einer Sprache mit einem geschlossenen Lexikon. Eine Lockerung des Schwellenwerts stellt die unbemerkte Verfälschung wieder her; sie erzeugt keine Übersetzung. Korrigieren Sie den Prompt, die Coaching-Daten oder das Paar.
:::

### Script Compliance

Für Locales, deren Sprachkarte ein nicht-lateinisches Schriftsystem (Arabisch, CJK, Kyrillisch, …) verzeichnet, wird validiert, dass die Ausgabe tatsächlich Nicht-ASCII-Zeichen enthält — eine rein lateinische Ausgabe für diese Locales wird als falsches Schriftsystem abgelehnt.

Zwei Klarstellungen darüber, was diese Prüfung *nicht* ist:

- Sie wird **nicht durch das Konfigurationsfeld `script:` gesteuert.** Dieses Feld wählt die Ausgabe-Orthografie für die [Schriftsystem-Konvertierung](/docs/getting-started/configuration#script-conversion) aus; die Erwartung des Gates stammt aus den Sprachkarten.
- Sie validiert immer das **Arbeitsschriftsystem, das das Modell ausgibt**, *bevor* eine Schriftsystem-Konvertierung stattfindet. Locales mit einem Schriftsystem-Konverter (crk, sr, tlh, …) erzeugen korrekterweise eine Ausgabe im lateinischen Arbeitsschriftsystem, daher sind sie von dieser Prüfung ausgenommen; die Konvertierung erfolgt — sofern in der Konfiguration aktiviert — nach dem Gate.

## Was bei einem Fehler geschieht

1. Die fehlerhafte Übersetzung wird mit einem `[GATE]`-Präfix, dem Key-Namen, dem Grund und einer Vorschau des Werts auf stderr protokolliert
2. Der Key wird **nicht** in die Locale-Datei geschrieben
3. Die Retry-Kaskade greift ein (siehe unten)

```
[GATE] hero.title: source-echo — "Welcome to our platform"
[GATE] nav.about: hallucination — "À À À À À À À À"
```

## Feedback-Wiederholung und die Wiederholungskaskade

Ein vom Gate abgelehnter Schlüssel erhält **eine Feedback-Wiederholung**: Der Ablehnungsgrund wird als schlüsselspezifischer Kontext in den Prompt injiziert (eine blinde Wiederholung bei niedriger Temperatur würde eine byte-identische Ausgabe zurückgeben). Wenn die Wiederholung erfolgreich ist, wird der Schlüssel geschrieben und die Synchronisierung ist **grün** — eine Gate-Ablehnung, die sich selbst heilt, ist kein Fehler, und dies ist die beabsichtigte Semantik. Nur Schlüssel, die nach der Wiederholung weiterhin fehlschlagen, werden übersprungen, gemeldet (die Synchronisierung wird mit einem Nicht-Null-Status beendet) und bei der nächsten Synchronisierung erneut versucht.

Die Wiederholung durchläuft die eigene Übersetzungsmethode des Paares, unabhängig davon, welche es ist — LLM, Google Translate, DeepL oder ein direkter Anbieter. Dies gilt auch für Treffer im Translation Memory: Ein zwischengespeicherter Wert, den das Gate ablehnt, wird verworfen und im selben Durchlauf neu übersetzt, sodass sich ein vergifteter Cache selbst heilt.

Unabhängig davon wiederholt Champollion den Vorgang mit zunehmend kleineren Batches, wenn ein ganzer Batch fehlschlägt (JSON-Parsing-Fehler):

```
Full batch (80 keys) → parse error
  └→ Half batch (40 keys) → 2 failures
      └→ Individual keys (1 each) → isolates the 2 problem keys
```

Das Retry-Budget wird durch `maxRetries` begrenzt (Standard: 3, pro Sprache konfigurierbar). Dies verhindert ausufernde Token-Kosten bei Keys, die durchgängig fehlschlagen.

Nach Ausschöpfung der Wiederholungsversuche werden die problematischen Keys protokolliert und übersprungen. Sie werden beim nächsten `sync`-Durchlauf erneut versucht.

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
