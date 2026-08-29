---
sidebar_position: 6
title: "Fehlerbehebung"
---

# Fehlerbehebung

Häufige Probleme und Lösungen für champollion.

## API & Authentifizierung

### "OPENROUTER_API_KEY not found"

Champollion benötigt einen API-Schlüssel für die LLM-Übersetzung. Legen Sie ihn als Umgebungsvariable fest:

```bash
export OPENROUTER_API_KEY="sk-or-v1-..."
```

Oder in einer `.env`-Datei (sofern Ihr Projekt `.env`-Dateien lädt):

```
OPENROUTER_API_KEY=sk-or-v1-...
```

:::tip
Wenn Sie nur über einen Google-Translate-API-Schlüssel verfügen, erkennt champollion dies automatisch und verwendet Google Translate als Standardmethode. Keine Konfigurationsänderung erforderlich.
:::

### "401 Unauthorized" von OpenRouter

Ihr API-Schlüssel ist ungültig oder abgelaufen. Überprüfen Sie ihn unter [openrouter.ai/keys](https://openrouter.ai/keys).

### "429 Too Many Requests" / Ratenbegrenzung

Champollion verarbeitet Ratenbegrenzungen intern mittels exponentiellem Backoff. Wenn Sie wiederholt an Ratenbegrenzungen stoßen:

1. **Verringern Sie die Batch-Größe** in Ihrer Konfiguration:
   ```json
   { "batchSize": 15 }
   ```
2. **Verwenden Sie ein Modell mit höheren Ratenbegrenzungen** (z. B. verfügt `google/gemini-3.5-flash` über großzügige Limits)
3. **Verwenden Sie eine günstigere/schnellere Methode** für Paare mit hohem Volumen — Google Translate hat keine Ratenbegrenzungen:
   ```json
   { "pairs": { "en:it": { "method": "google-translate" } } }
   ```

### Modell nicht gefunden / 404-Fehler

Direkte LLM-Anbieter (`openai`, `anthropic`, `gemini`) validieren Ihren Modellstring bei der ersten Verwendung. Wenn Sie eine Warnung sehen:

**"looks like an OpenRouter path"** — Sie verwenden ein Modell im OpenRouter-Format (`google/gemini-3.5-flash`) mit einem direkten Anbieter. Direkte Anbieter verwenden bloße Modellnamen:

```diff
- { "method": "gemini", "model": "google/gemini-3.5-flash" }
+ { "method": "gemini", "model": "gemini-2.5-flash" }
```

Oder wechseln Sie zur Methode `llm`, um OpenRouter zu verwenden:
```json
{ "method": "llm", "model": "google/gemini-3.5-flash" }
```

**"is an Anthropic/OpenAI/Gemini model"** — Sie senden ein Modell an den falschen Anbieter:

```diff
- { "method": "gemini", "model": "claude-sonnet-4-6" }
+ { "method": "anthropic", "model": "claude-sonnet-4-6" }
```

**"not found in available models"** — Das Modell ist möglicherweise veraltet oder falsch geschrieben. Champollion ruft die Live-Modellliste des Anbieters ab und schlägt Alternativen vor. Aktuelle Modellnamen finden Sie in der Dokumentation des Anbieters.

:::tip[Modellveraltung kommt vor]
Anbieter stellen Modellnamen regelmäßig ein. Wenn Übersetzungen nach einem Anbieter-Update plötzlich fehlschlagen, prüfen Sie die Ausgabe von `[WARN]` — sie zeigt Ihnen aktuelle Alternativen an.
:::

## Übersetzungsqualität

### Übersetzungen geben die Ausgangssprache wieder

Das Quality Gate erkennt dies. Wenn eine Übersetzung identisch mit dem englischen Ausgangstext ist, wird sie abgelehnt und erneut versucht. Falls das Problem fortbesteht:

1. **Überprüfen Sie das Modell** — Manche Modelle schneiden bei bestimmten Sprachpaaren schlecht ab
2. **Fügen Sie Register-Anweisungen hinzu** — Teilen Sie dem Modell mit, welche Sprache es erzeugen soll:
   ```json
   {
     "languages": {
       "ja": { "name": "Japanese", "register": "Polite/formal Japanese" }
     }
   }
   ```
3. **Probieren Sie ein anderes Modell aus** — Wechseln Sie von `gpt-4o-mini` zu `gpt-4o` oder `google/gemini-2.5-pro`

### Falsche Schriftausgabe (z. B. lateinischer Text für Japanisch)

Die Schriftkonformitätsprüfung des Quality Gate erkennt die meisten Fälle. Falls das Problem fortbesteht:

- Stellen Sie sicher, dass der Locale-Code korrekt ist (`ja`, nicht `jp`)
- Fügen Sie explizite Schriftanweisungen im Feld `register` hinzu:
  ```json
  { "register": "Japanese using hiragana, katakana, and kanji" }
  ```

### Halluzinationsmuster in der Ausgabe

Wiederholte Trigramm-Muster (z. B. "hello hello hello") werden vom Halluzinationsschleifen-Detektor erkannt. Wenn die Ausgabe verstümmelt ist, den Detektor aber besteht:

1. **Verringern Sie die Batch-Größe** — Kleinere Batches erzeugen fokussiertere Ausgaben
2. **Verwenden Sie ein stärkeres Modell** — Größere Modelle halluzinieren bei nicht-lateinischen Schriften weniger
3. **Fügen Sie Coaching-Daten hinzu** — Wörterbuchbegriffe verankern die Übersetzung

## Datei- & Formatprobleme

### "No locale files found"

Champollion erkennt Locale-Dateien automatisch. Wenn sie nicht gefunden werden können:

1. **Überprüfen Sie `localesDir`** — Muss auf das Verzeichnis verweisen, das die Locale-Dateien enthält:
   ```json
   { "localesDir": "./locales" }
   ```
2. **Überprüfen Sie die Dateibenennung** — Dateien müssen nach dem Locale-Code benannt sein: `en.json`, `fr.json` usw.
3. **Überprüfen Sie das Format** — Unterstützte Formate: JSON, verschachteltes JSON, YAML, TOML

### Konflikte bei der Lock-Datei

Wenn `.champollion.lock` in einen fehlerhaften Zustand gerät:

```bash
# Reset the lock file (next sync will retranslate everything)
rm .champollion.lock
npx champollion sync
```

:::warning
Das Löschen der Lock-Datei bedeutet, dass die nächste Synchronisierung alle Schlüssel neu übersetzt, nicht nur die geänderten. Dies hat bei großen Projekten Auswirkungen auf die API-Kosten.
:::

### Erneutes Übersetzen bestimmter Schlüssel

Wenn einzelne Übersetzungen falsch sind und Sie eine erneute Übersetzung erzwingen möchten, ohne die Lock-Datei zu löschen:

```bash
# Re-translate a single key
npx champollion sync --force-keys "hero.title"

# Re-translate multiple keys
npx champollion sync --force-keys "nav.home,nav.about,footer.copyright"
```

Das Flag `--force-keys` setzt die Hash-Prüfung der Lock-Datei für diese bestimmten Schlüssel außer Kraft und erzwingt deren erneute Übersetzung, ohne andere Schlüssel zu beeinträchtigen.

### Inhaltsübersetzung beschädigt Codeblöcke

Dies sollte nicht passieren — Codeblöcke werden vor der Übersetzung abgeschirmt. Falls es dennoch geschieht:

1. Stellen Sie sicher, dass der Codeblock Standard-Fencing verwendet (dreifache Backticks)
2. Prüfen Sie auf nicht geschlossene Codeblöcke im Ausgangs-Markdown
3. Melden Sie ein Issue — dies ist ein Fehler im Sentinel-Abschirmungssystem

## CLI-Probleme

### `--watch` erkennt keine Änderungen

Die Dateiüberwachung verwendet das native `fs.watch` von Node.js. Bekannte Probleme:

- **Netzlaufwerke** — `fs.watch` funktioniert auf NFS/SMB-Mounts nicht zuverlässig
- **Docker-Volumes** — Verwenden Sie den Polling-Modus oder führen Sie champollion innerhalb des Containers aus
- **Große Verzeichnisse** — Der Watcher überwacht `localesDir` rekursiv; sehr tiefe Bäume können die Betriebssystem-Limits überschreiten

### `npx` führt eine alte Version aus

```bash
# Clear the npx cache
npx --yes champollion@latest sync
```

Oder global installieren:

```bash
npm install -g champollion
champollion sync
```

## Leistung

### Synchronisierung ist bei vielen Sprachen langsam

Champollion übersetzt standardmäßig alle Locales parallel. Wenn die Synchronisierung dennoch langsam ist:

1. **Verwenden Sie Google Translate für Paare mit hohem Volumen** — Es ist 10–50× schneller als die LLM-Übersetzung
2. **Erhöhen Sie die Batch-Größe** (Standard ist 80):
   ```json
   { "batchSize": 120 }
   ```
3. **Passen Sie die Nebenläufigkeit an** — Die Parallelität für JSON-Locales ist standardmäßig auf 200 und für Inhalte auf 48 eingestellt. Wenn Ihr API-Anbieter höhere Ratenbegrenzungen unterstützt:
   ```bash
   npx champollion sync --json-concurrency 80 --content-concurrency 20
   ```
4. **Verwenden Sie ein schnelles Modell** — `gpt-4o-mini` ist erheblich schneller als `gpt-4o`

### Hohe API-Kosten

- **Überprüfen Sie die Batch-Größen** — Größere Batches = weniger API-Aufrufe = niedrigere Kosten
- **Verwenden Sie Translation Memory** — TM ist standardmäßig aktiviert. Führen Sie `champollion tm stats` aus, um zu überprüfen, ob es funktioniert. Wenn Sie nach mehreren Synchronisierungen 0 Einträge sehen, stimmt möglicherweise etwas mit den Berechtigungen Ihres `.champollion/`-Verzeichnisses nicht
- **Verwenden Sie Prompt-Caching** — Champollion trennt System-/Benutzernachrichten für Cache-Treffer bei Anthropic- und Google-Modellen
- **Verwenden Sie Google Translate für Tier-2-Sprachen** — Siehe das Kochbuch [30 Sprachen übersetzen](/docs/tutorials/translate-30-languages)

### Veraltete Übersetzungen nach Anbieterwechsel

Wenn Sie von einer Übersetzungsmethode zu einer anderen wechseln (z. B. von `llm` zu `deepl`), liefert der TM-Cache möglicherweise weiterhin alte Übersetzungen der vorherigen Methode für Schlüssel, deren Ausgangstext sich nicht geändert hat. Der Cache-Schlüssel enthält den Methodennamen, sodass die meisten Fälle automatisch behandelt werden. Wenn Sie jedoch `model` innerhalb derselben Methode geändert haben:

```bash
# Force fresh translations for all keys
champollion sync --no-tm

# Or clear the cache entirely and re-sync
champollion tm clear --yes
champollion sync
```

Einzelheiten zum Design des Cache-Schlüssels finden Sie unter [Translation Memory](/docs/concepts/translation-memory).

## Wiederherstellung nach einer fehlerhaften Version {#recover-old-damage}

Werte, die von einer älteren Pipeline geschrieben wurden, **heilen sich niemals selbst**: Ihre Manifest-Hashes stimmen mit der aktuellen Quelle überein, sodass `sync` sie als abgeschlossen betrachtet und kein Gate sie jemals wieder sieht. Wenn Sie ein Projekt aktualisieren, das mit Versionen vor 0.3.0 ausgeführt wurde, gehen Sie davon aus, dass sich möglicherweise beschädigte Daten in Ihren Locale-Dateien befinden, und führen Sie zunächst ein Audit durch:

```bash
champollion integrity
```

Das Audit erkennt die bekannten Schadenssignaturen und benennt die jeweilige Lösung:

| Befund | Beschreibung | Lösung |
|---------|-----------|-----|
| `UNEXPECTED PUA` | Ausgabe der Skriptkonvertierung (pIqaD/Tengwar/Kryptonian), die geschrieben wurde, obwohl keine Konvertierung erwünscht war — wird leer gerendert | `champollion repair-script` (offline, exakt für pIqaD) |
| `HOLLOWED VALUES` | Die Quelle, bei der die Buchstaben gelöscht wurden — Ausgabe aus der Zeit vor dem Content-Preservation-Gate | Neu übersetzen (siehe unten) |
| `NO-TRANSLATE DRIFT` | Eine URL oder ein anderer wörtlich zu übernehmender Schlüssel, der "übersetzt" wurde | `champollion sync` (kostenlos und automatisch repariert) |

Für ausgehöhlte Werte — oder jedes Locale, dem Sie einfach nicht mehr vertrauen — führen Sie einen Rebuild durch:

```bash
champollion sync --pair en:tlh --force
```

`--force` reiht jeden Quellschlüssel für das/die im Scope befindliche(n) Paar(e) neu in die Warteschlange ein. Treffer aus dem Translation Memory werden weiterhin verwendet, aber jeder verwendete Treffer wird **zuerst gegen die aktuellen Gates validiert** — ein zwischengespeicherter Wert, den das Gate nun ablehnt, wird verworfen und neu berechnet, sodass sich ein vergifteter Cache selbst heilt, anstatt den Rebuild zu speisen. Fügen Sie `--no-tm` hinzu, wenn Sie unabhängig davon eine komplett neue Berechnung wünschen, und `--max-cost`, um die Ausgaben in jedem Fall zu begrenzen.

Die Überprüfung nach der Synchronisierung (Post-Sync-Verifizierung) meldet diese Signaturen ebenfalls, sodass ein beschädigtes Locale bei `sync` lautstark fehlschlägt (mit Nennung der Lösung), anstatt stillschweigend ausgeliefert zu werden.

### Einmaliges Wiedereinreihen nach `--no-tm`-Bereinigungen {#one-time-requeue}

Wenn Ihre Wiederherstellung `--no-tm` verwendet hat, stellen Sie sich darauf ein, dass die **nächste** Synchronisierung einen Stapel von Source-Echo-Schlüsseln in die Warteschlange einreiht, von denen Sie dachten, sie seien abgeschlossen. `--no-tm` schreibt Werte, ohne sie im Translation Memory zu vermerken, und ein *nicht vermerkter* Wert, der mit seiner Quelle identisch ist, ist von einem unübersetzten Wert nicht zu unterscheiden — er wird also einmal neu eingereiht, kommt zurück (oft identisch), wird vermerkt und dauerhaft abgeschlossen. Dies ist ein einmaliger Aufwand, keine Endlosschleife. Eine genaue Vorschau dieser Schlüssel erhalten Sie mit:

```bash
champollion sync --dry --list-keys
```

## Immer noch nicht weiter?

- **[GitHub Issues](https://github.com/gamedaysuits/champollion/issues)** — Durchsuchen Sie vorhandene Issues oder melden Sie ein neues
- **[Architektur-Dokumentation](/docs/concepts/architecture)** — Verstehen Sie das Systemdesign
- **[Quality Gate](/docs/concepts/quality-gate)** — Wie die Validierung im Hintergrund funktioniert
