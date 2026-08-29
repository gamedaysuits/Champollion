---
sidebar_position: 4
title: "Sicherheit"
---

# Sicherheit & Schutz

Champollion ist darauf ausgelegt, in feindlichen Umgebungen sicher zu sein — in denen Locale-Daten aus nicht vertrauenswürdigen Quellen stammen können, in denen manipulierte Dateinamen Verzeichnisgrenzen überschreiten könnten und in denen LLM-Ausgaben beliebige Inhalte enthalten können.

## Bedrohungsmodell

| Bedrohung | Angriffsvektor | Gegenmaßnahme |
|--------|--------------|-----------|
| **Prototype Pollution** | Manipulierte JSON-Schlüssel (`__proto__`, `constructor`) | Bei der Auswertung abgelehnt |
| **Path Traversal** | Locale-Codes wie `../../etc/passwd` | Schreibvorgänge auf konfigurierte Verzeichnisse validiert |
| **Korruption von Code-Blöcken** | LLM übersetzt innerhalb von Code-Fences | Abschirmung durch Unicode-Sentinels |
| **Halluzinierte Schlüssel** | LLM gibt Schlüssel zurück, die nicht gesendet wurden | Antwortvalidierung — nur akzeptierte Schlüssel werden geschrieben |
| **Außer Kontrolle geratener Token-Verbrauch** | Endlose Wiederholungsschleifen | Budgetbegrenzung über `maxRetries` |

## Schutz vor Prototype Pollution

Alle Locale-Schlüssel werden vor der Verarbeitung gegen eine Sperrliste validiert:

- `__proto__`
- `constructor`
- `prototype`

Jeder Schlüssel, der diesen Mustern entspricht, wird mit einem Fehler abgelehnt. Dies verhindert, dass Angreifer manipulierte Locale-Dateien verwenden, um JavaScript-Objektprototypen zu verändern.

## Pfadbeschränkung

Beim Schreiben von Locale-Dateien validiert champollion, dass der Ausgabepfad innerhalb der konfigurierten Verzeichnisse (`localesDir`, `contentDir`) bleibt. Locale-Codes werden bereinigt — ein Code wie `../../secrets` kann nicht außerhalb des erwarteten Verzeichnisses schreiben.

## Block-Schutz

Während der Übersetzung von Markdown-Inhalten werden strukturierte Elemente durch Unicode-Sentinel-Platzhalter ersetzt, bevor der Text an das LLM gesendet wird:

1. **Code-Blöcke** (fenced und inline) → Sentinel
2. **Hugo-Shortcodes** (`{{< >}}`, `{{% %}}`) → Sentinel  
3. **Roh-HTML** → Sentinel
4. **Interpolationsvariablen** (`{{ .Count }}`) → Sentinel

Nach der Übersetzung werden die Sentinels durch den ursprünglichen Inhalt ersetzt. Das LLM sieht niemals Code-Blöcke, Shortcodes oder HTML — es kann sie nicht beschädigen.

## Antwortvalidierung

Wenn das LLM eine JSON-Antwort zurückgibt, validiert champollion, dass:
- Nur Schlüssel, die im Batch gesendet wurden, in der Antwort erscheinen
- Keine zusätzlichen Schlüssel eingefügt werden
- Die Antwort als gültiges JSON ausgewertet wird

Halluzinierte Schlüssel werden stillschweigend verworfen. Dies verhindert, dass die LLM-Ausgabe unerwartete Übersetzungen in Ihre Locale-Dateien einschleust.

## Quality Gate

Jede Übersetzung wird durch fünf deterministische Prüfungen validiert, bevor sie auf die Festplatte geschrieben wird. Siehe [Quality Gate](/docs/concepts/quality-gate) für Details.

## Exponentielles Backoff

API-Aufrufe verwenden exponentielles Backoff mit Jitter bei 429-Antworten (Rate-Limit) und 5xx-Antworten (Serverfehler). Drei Wiederholungen mit zunehmender Verzögerung verhindern eine Überlastung der API während Ausfällen.

## Anfrage-Timeout

Jede API-Anfrage hat ein Timeout von 30 Sekunden über `AbortController`. Dies verhindert, dass der Synchronisierungsprozess bei einer toten Verbindung unendlich hängen bleibt.

## Laute Meldung von Übersetzungsfehlern

Wenn die API nicht verfügbar ist oder eine Übersetzung fehlschlägt, wirft champollion einen lauten Fehler mit umsetzbaren Hinweisen, anstatt stillschweigend fehlerhafte Inhalte zu schreiben. Während der Synchronisierung werden niemals `[EN]`-präfigierte Platzhalter geschrieben.

```
[ERR] Content sync for fr: no API key available.
  Set OPENROUTER_API_KEY in .env.local to translate content.
```

Der Fehlschlag einer Datei stoppt nicht die gesamte Synchronisierung — der Fehler wird protokolliert und die Pipeline fährt mit der nächsten Datei fort, sodass Sie pro Durchlauf maximalen Fortschritt erzielen.

## Verifizierung nach der Synchronisierung

Nachdem alle Übersetzungen abgeschlossen sind, liest champollion die geschriebenen Locale-Dateien erneut von der Festplatte ein und führt einen Verifizierungsdurchlauf aus. Dies erfasst die Lücke zwischen einer als erfolgreich gemeldeten Synchronisierung und tatsächlich fehlerhaften Übersetzungen:

- **Schlüsselparität** — alle Quellschlüssel in jedem Ziel vorhanden
- **`[EN]`-Markierungen** — veraltete Fallback-Markierungen aus früheren Durchläufen
- **Leere Übersetzungen** — leere Werte, die durchgerutscht sind
- **Skript-Konformität** — nicht-lateinische Locales mit ausschließlich ASCII-Übersetzungen
- **Erhalt von Platzhaltern** — ICU-Platzhalter stimmen mit der Quelle überein

Überspringen mit `--no-verify` oder eigenständig ausführen mit `npx champollion verify`.

## Testen

Sicherheitseigenschaften werden durch die adversariale Test-Suite verifiziert:

```bash
npm run test:redteam    # prototype pollution, path traversal, encoding attacks
```

---

## Siehe auch

- [Architektur](/docs/concepts/architecture) — wie das dreiteilige Ökosystem zusammenhängt
- [CLI-Referenz — integrity](/docs/reference/cli#integrity) — Befehl zur Integritätsprüfung
- [CLI-Referenz — provenance](/docs/reference/cli#provenance) — Befehl zur Herkunftsprüfung
- [Plugin-Spezifikation](/docs/reference/plugin-spec) — Herkunftsfelder in Plugin-Manifesten
- [Quality Gate](/docs/concepts/quality-gate) — Sicherheitsprüfungen auf Übersetzungsebene
