---
sidebar_position: 1
slug: /intro
title: "App- und Website-Übersetzung"
description: "Die Referenz zum Übersetzen der eigenen Dateien einer App oder Website mit `champollion sync`: was er tut, wann Sie ihn verwenden sollten und ein Leitfaden zu allen dazugehörigen Seiten."
related:
  - label: "Quick Start"
    to: /docs/getting-started/quick-start
    kind: guide
    note: "Install, configure, and run your first sync"
  - label: "How Sync Works"
    to: /docs/concepts/how-sync-works
    kind: doc
    note: "The pipeline behind every translation"
  - label: "Translation Methods"
    to: /docs/guides/translation-methods
    kind: guide
    note: "LLM, machine-translation APIs, your own model — when to use which"
  - label: "Translate an app or website"
    to: /docs/translate-an-app-or-website
    kind: guide
    note: "The same lane, in plain words"
---

# App- und Website-Übersetzung

`champollion sync` hält die Übersetzungen einer App oder Website mit der
Ausgangssprache synchron. Es liest Ihre Locale-Dateien (oder Ihre Markdown-Seiten),
ermittelt, was fehlt oder veraltet ist, übersetzt nur diesen Teil, prüft jedes
Ergebnis und schreibt es im ursprünglichen Dateiformat zurück.

```bash
npx champollion sync
```

Dieser Abschnitt ist die Referenz für diesen Bereich. Wenn Sie zuerst die
einfach verständliche Version lesen möchten, finden Sie sie unter [Eine App oder Website übersetzen](/docs/translate-an-app-or-website).

## Was `sync` tut

1. **Findet Ihre Dateien.** Es erkennt den Locale-Ordner und das Format (JSON, TOML,
   YAML, gettext PO, Flutter ARB) oder einen Ordner mit Markdown/MDX-Seiten (Hugo,
   Docusaurus oder jeden Ordner, den Sie mit `--content-dir` angeben).
2. **Ermittelt Änderungen.** Jeder Ausgangswert wird anhand seines SHA-256-Hashs
   in `.champollion.lock` erfasst. Schlüssel, die fehlen, leer sind oder deren Ausgangstext
   geändert wurde, werden eingereiht; alles andere bleibt unberührt.
3. **Übersetzt mit der Methode, die Sie für jedes Paar gewählt haben.** Eine Konfigurationsdatei
   kann ein Paar an ein LLM senden, ein anderes an eine API für maschinelle Übersetzung und
   ein drittes an ein Modell, das Sie selbst trainiert haben und betreiben. LLM-Methoden übersetzen
   standardmäßig bei Temperatur 0 (der einzige Standardwert in `shared/model-defaults.json`);
   ein gehostetes Modell kann zwischen Durchläufen dennoch leicht variieren, was ein Grund
   dafür ist, dass das Translation Memory bereits Vorhandenes speichert.
4. **Verwendet bereits Bezahltes wieder.** Das Translation Memory speichert jede
   Übersetzung nach Ausgangstext, Locale und Methode: Text, der erneut auftritt (eine
   zurückgeänderte Zeichenkette, derselbe Satz in einer anderen Datei, ein erneuter Durchlauf),
   ist kostenlos.
5. **Prüft jedes Ergebnis vor dem Schreiben.** Das Quality Gate verweigert leere
   Ausgaben, Duplikate der Quelle, Wiederholungsschleifen, Ausgaben in der falschen Schrift,
   beschädigte Platzhalter und ähnliche Fehler – mit einem Feedback-Wiederholungsversuch. Es
   erkennt fehlerhafte Ausgaben, keine inhaltlich falsche Bedeutung.
6. **Verifiziert nach dem Schreiben.** Ein Durchlauf nach der Synchronisation liest die geschriebenen
   Dateien erneut ein und prüft Schlüsselparität, leere Werte, Schrift und Platzhalter;
   `champollion verify` und `champollion audit` führen dieselbe Art von Prüfungen als
   CI-Gates aus.

Nichts wird stillschweigend geschrieben. Ein Schlüssel, den das Gate auch nach dem
Wiederholungsversuch verweigert, bleibt unübersetzt und wird gemeldet; die Synchronisation
wird mit `2` beendet. Die Verweigerung wird gespeichert, sodass bei der nächsten
normalen Synchronisation nicht erneut dasselbe Modell für dieselbe Antwort bezahlt werden muss:
Sie fordern die Übersetzung mit `--redo` erneut an, fügen dem Paar eine `fallback`-Methode
hinzu oder schreiben den Wert von Hand.

## Wann Sie es verwenden sollten

- Sie haben eine App oder eine Website, deren Texte in Locale-Dateien oder Markdown liegen,
  und möchten, dass die anderen Sprachen bei Änderungen der Ausgangssprache aktuell gehalten werden.
- Sie möchten in einem einzigen Projekt eine unterschiedliche Methode pro Sprachpaar nutzen,
  wobei die Ausgaben begrenzt sind (`--max-cost`) und vor jeder Abrechnung sichtbar werden (`--dry`).
- Sie haben einen Übersetzer auf den Rails erstellt und möchten, dass eine App ihn nutzt:
  `champollion connect` bindet ein bereitgestelltes Modell in ein App-Projekt ein, und `sync`
  übersetzt anschließend damit. Ein Modell, das ausschließlich auf lokalen Daten trainiert wurde,
  wird nur angebunden, wenn die Rechteinhaber zugestimmt haben.

`sync` ist nicht dafür gedacht, einen Übersetzer für eine Sprache zu erstellen, die
von keinem Dienst gut unterstützt wird. Beginnen Sie dafür unter [Ein Projekt starten](/docs/start).

## Die Seiten in diesem Abschnitt

**Erste Schritte**

- [Schnellstart](/docs/getting-started/quick-start) — eine erste Synchronisation in wenigen Minuten.
- [Installation](/docs/getting-started/installation) — Voraussetzungen, API-Schlüssel
  und die Lizenz.
- [Konfiguration](/docs/getting-started/configuration) — jedes Feld in
  `champollion.config.json`, Einstellungen pro Paar, Locale-Strukturen und Fallbacks.

**Ihr Framework und Ihre Pipeline**

- [Framework-Integrationen](/docs/integrations/frameworks) — Hugo, next-intl,
  react-i18next, Flutter und Django mit gettext.
- [CI/CD](/docs/guides/ci-cd) — `lint`, `sync`, `verify` und `audit` als Gates.
- [Inhaltsübersetzung](/docs/guides/content-translation) — Markdown- und MDX-Seiten,
  Frontmatter und was erhalten bleibt.

**Auswahl der Übersetzungsmethode**

- [Übersetzungsmethoden](/docs/guides/translation-methods) — jede Methode,
  ihr Schlüssel und wann sie verwendet werden sollte.
- [Coaching-Daten](/docs/concepts/coaching-data) — Grammatiknotizen und Wortlisten,
  die einem LLM bei jeder Anfrage übergeben werden.
- [Schriftkonverter](/docs/concepts/script-converters) und
  [Plansprachen, Schriften & Orthografie](/docs/guides/conlangs-scripts-orthography)
  — Schriftsysteme, Schriftarten und erfundene Sprachen.

**Funktionsweise im Detail**

- [Wie die Synchronisation funktioniert](/docs/concepts/how-sync-works) — die Pipeline, Schritt für Schritt.
- [Translation Memory](/docs/concepts/translation-memory) — der Cache und wie
  die Schlüssel gebildet werden.
- [Quality Gate](/docs/concepts/quality-gate) — jede Prüfung und was mit einem
  abgelehnten Schlüssel oder Block geschieht.
- [Sicherheit](/docs/concepts/security) — manipulierte Schlüssel und Pfade, geschützte
  Code-Blöcke und unübersehbare Fehlerabbrüche.

**Menschen und Probleme**

- [Zusammenarbeit mit professionellen Übersetzern](/docs/guides/professional-translators)
  — XLIFF-Export und -Import zur Überprüfung.
- [Fehlerbehebung](/docs/guides/troubleshooting) — häufige Fehler und Lösungen.

Jeder Befehl und jedes Flag befindet sich in der [CLI-Referenz](/docs/reference/cli), und das
Format der Methoden-Plugins ist in der [Plugin-Spezifikation](/docs/reference/plugin-spec) beschrieben.

## Lizenz

Die CLI von `champollion` ist source-available unter der
[PolyForm Noncommercial License 1.0.0](https://github.com/gamedaysuits/Champollion/blob/main/cli/LICENSE);
unter [Wer es nutzen darf](/docs/getting-started/who-may-use-this) erfahren Sie, wer abgedeckt ist.
Haben Sie Probleme oder wünschen Sie Unterstützung bei Ihrem Projekt? [Lassen Sie uns sprechen](/docs/getting-help).
