---
sidebar_position: 6
title: "Abdeckungszahlen: Wie wir sie zählen"
description: "Wie Champollion „Sprachen mit maschineller Übersetzung“ zählt – die zwei Stufen (beliebige Engine vs. bereitgestellter Dienst), die SSOT, aus der jede angezeigte Zahl ausgelesen wird, und die Aktualisierungsdisziplin. Korrekturen sind willkommen."
---

# Abdeckungszahlen: Wie wir sie zählen

> **Zusammenfassung.** Wenn die Website besagt, dass **für 552 lebende Sprachen irgendeine Form der maschinellen Übersetzung existiert** und **196 von einem bereitgestellten Dienst bedient werden**, handelt es sich um zwei unterschiedliche, bewusst getrennte Zählungen. Diese Seite definiert beide Stufen, benennt die einzige verlässliche Datenquelle (Single Source of Truth), aus der jede Zahl zur Build-Zeit ausgelesen wird, und beschreibt, wie die Listen aktualisiert werden. Abdeckung ist eine *Aussage über die Existenz*, niemals eine Aussage über die Qualität.

## Die zwei Stufen

**Stufe 1 — eine beliebige dedizierte MT-Engine ("abgedeckt").** Eine lebende Sprache gilt als abgedeckt, wenn sie auf der veröffentlichten Liste der unterstützten Sprachen *irgendeiner* erfassten dedizierten MT-Engine (Machine Translation) erscheint — bereitgestellte Endnutzer-/API-Dienste (Google Translate, Microsoft Translator, DeepL, LibreTranslate, …) **oder** offene Forschungsmodelle (NLLB-200, OPUS-MT, M2M-100, MADLAD-400, …). Dies ist die Vereinigungsmenge, die einen Punkt auf der Netzwerkkarte grün aufleuchten lässt.

**Stufe 2 — bereitgestellter Dienst ("bedient").** Die strengere Abgrenzung: Die Sprache steht auf der Liste einer Engine, die jeder *heute tatsächlich* als Endnutzer- oder API-Dienst nutzen kann. Ein offener Forschungs-Checkpoint, den Sie selbst herunterladen, hosten und bereitstellen müssten, zählt hier nicht. Dies ist die Zahl, die die Frage beantwortet: "Könnte ein Sprecher jetzt sofort eine Webseite übersetzen, ohne Entwicklungsaufwand betreiben zu müssen?"

Die beiden Stufen existieren, weil sie unterschiedliche Fragen beantworten, und eine Zusammenlegung würde die weltweite Abdeckung zu hoch ansetzen. Beide werden ausschließlich über **lebende Einzelsprachen nach ISO 639-3** gezählt (`isoType: 'L'`).

## Woher die Zahlen stammen (nichts ist handgetippt)

Jede angezeigte Zählung ist ein **Auslesen zur Build-Zeit** aus maschinellen SSOTs (Single Source of Truth) — keine Zahl auf der Website wird als Fließtext eingetippt und veraltet dann:

1. **Die Listen pro Engine** befinden sich in `cli/shared/catalogue/method-coverage.json` —
   ein Eintrag pro Engine, *nur als Zitat* (cite-only) aus der vom Anbieter selbst veröffentlichten
   Liste der unterstützten Sprachen importiert, mit seiner `source_url` und einem `asOf`-Datum. Champollion
   überprüft oder reproduziert diese Listen nicht; es handelt sich um die eigenen Angaben der Anbieter.
2. **Der Build bildet die Schnittmenge** dieser Listen mit dem Index der lebenden Sprachen und gibt die
   Stufenzählungen in die Build-Statistiken der Website aus (`stats.coverage.dedicatedLiving` für
   Stufe 1, `stats.coverage.serviceLiving` für Stufe 2, über `stats.livingTotal`
   lebende Sprachen).
3. **Die Seiten rendern die Statistiken**, und ein Pre-Push-Paritäts-Gate lässt den Build fehlschlagen, falls Fließtext
   und Statistiken jemals voneinander abweichen.

## "194 Sprachen" und "187 Sprachen" können beide wahr sein

Die Liste eines Anbieters und eine Zählung von *Sprachen* sind nicht dasselbe Objekt, daher deklariert jeder Eintrag in der SSOT, um welche Art von Zahl es sich handelt:

- **`publisher-list-rows`** — die Länge der vom Anbieter selbst veröffentlichten Liste,
  genau so, wie sie veröffentlicht wurde. Die Cloud Translation-Seite von Google listet **194** Zeilen
  für sein NMT-Modell auf; das ist die Zahl, die diese Website Google namentlich zuschreibt.
- **`champollion-derived-enumeration`** — *unsere* Zusammenfassung dieser Liste auf eindeutige
  ISO 639-3-Basissprachen. Dieselben 194 Google-Zeilen entsprechen **187** Sprachen,
  da `zh-CN` und `zh-TW` eine Sprache in zwei Schriften sind, ebenso wie `pt-PT`
  und `pt-BR`, und so weiter. Diese Zahl stammt von uns, niemals vom Anbieter.
- **`publisher-stated-headline`** — eine Gesamtzahl, die der Anbieter angibt, ohne dass eine Liste
  dahinter veröffentlicht ist. Daraus darf nichts abgeleitet werden.

Die Diskrepanz zwischen den ersten beiden ist arithmetischer Natur, keine Unstimmigkeit, und sie zieht sich durch jeden Anbieter: Microsoft 135 Zeilen → 128 Sprachen, LibreTranslate 49 → 47, die 200 FLORES-Varianten von NLLB-200 → 196. Die Karte und die Stufenzählungen lesen die *aufgezählte Liste*, niemals die Überschrift. Ein Pre-Push-Gate lässt den Build fehlschlagen, falls die deklarierte Basis eines Eintrags und seine Liste jemals im Widerspruch zueinander stehen.

Beachten Sie auch, dass ein Anbieter mehrere Listen veröffentlichen kann. Die Seite von Google enthält eine separate Tabelle für seine Translation-LLM-Stufe (127 Zeilen Stand 2026-08-16) und gibt überhaupt keine kombinierte Gesamtzahl an — die Frage "Wie viele Sprachen unterstützt Google?" hat also keine einzige veröffentlichte Antwort, und diese Website erfindet auch keine.

## Behauptete Abdeckung ist nicht gleich Qualität — und nicht immer einsatzbereit

Eine Sprache auf der Liste eines Anbieters bedeutet, dass der Anbieter *Unterstützung angibt*, mehr nicht. Zwei Hinweise zur Transparenz, die die Website überall dort anwendet, wo diese Zählungen erscheinen:

- **Abdeckung ≠ Qualität.** Ob die Übersetzungen gut sind, ist eine separate,
  gemessene Frage — das ist der eigentliche Zweck des Benchmark-Netzwerks. Qualitätsangaben
  befinden sich auf dem Leaderboard, aufgeschlüsselt nach (Methode, Datensatz, Metrik); Abdeckungsangaben
  befinden sich hier.
- **Behauptet ≠ einsatzbereit.** Breit angelegte Forschungsmodelle können sehr hohe Sprachenzahlen
  beanspruchen, während ihre eigene Dokumentation eine nutzbare Qualität nur für eine viel kleinere
  Teilmenge ausweist. Wenn ein Anbieter eine solche Selbsteinschätzung veröffentlicht, zeigt die Website die
  behauptete Anzahl *und* die eigene Einsatzbereitschafts-/Qualitätszahl des Anbieters, jeweils mit Verweis auf die
  Materialien des Anbieters.

## Die Aktualisierungsdisziplin

Anbieterlisten ändern sich; die Zählungen müssen mechanisch folgen:

- Jeder Eintrag in `method-coverage.json` trägt sein eigenes `asOf`-Datum, und die Datei
  enthält ein übergeordnetes `asOf` — das Datum des letzten Sweeps (Durchlaufs). Oberflächen, die
  Abdeckungszahlen zeigen, zeigen dieses Datum an oder verlinken darauf.
- Ein **SOTA-Sweep** (die erneute Überprüfung der veröffentlichten Liste jedes Anbieters, das Hinzufügen neu
  erfasster Engines) ist eine regelmäßige Wartungsaufgabe; der Sweep aktualisiert die SSOT, und
  jede Zählung auf der Website folgt beim nächsten Build. Nichts muss im Fließtext der Seite manuell nachgehalten
  werden.
- Zwischen den Sweeps sind die Zählungen genau so aktuell wie ihre `asOf`-Datumsangaben — weshalb
  diese Datumsangaben Teil der Daten sind und keine Fußnotenkonvention.

## Korrekturen und Diskussionen willkommen

Wenn sich die Liste eines Anbieters geändert hat, eine Sprache falsch klassifiziert ist oder Sie der Meinung sind, dass eine Stufengrenze falsch gezogen wurde, teilen Sie uns dies mit — eröffnen Sie ein Issue unter
[github.com/gamedaysuits/Champollion/issues](https://github.com/gamedaysuits/Champollion/issues)
oder senden Sie eine E-Mail an [info@champollion.dev](mailto:info@champollion.dev).

---

## Quellen

- **Listen pro Engine** — `cli/shared/catalogue/method-coverage.json`: die vom jeweiligen Anbieter
  selbst veröffentlichte Liste der unterstützten Sprachen (nur als Zitat; `source_url` + `asOf` pro Eintrag).
- **Menge der lebenden Sprachen** — lebende Einzelsprachen nach ISO 639-3 (`isoType: 'L'`)
  im Sprachenindex, der aus den zitierten Sprachkarten (Language Cards) erstellt wird.
- **Stufenzählungen** — vom Build ausgegebene `stats.coverage.dedicatedLiving` (Stufe 1),
  `stats.coverage.serviceLiving` (Stufe 2), `stats.livingTotal`. Von Champollion abgeleitet.
- **Die auf diesen Zählungen basierende Bevölkerungsschätzung** — siehe
  [Die Abdeckungslücke: Wie wir sie schätzen](/docs/network/context/coverage-gap-estimate).
