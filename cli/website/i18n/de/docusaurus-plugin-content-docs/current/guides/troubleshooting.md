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

1. **Reduzieren Sie die Batch-Größe** in Ihrer Konfiguration:
   ```json
   { "batchSize": 15 }
   ```
2. **Verwenden Sie ein Modell mit höheren Ratenbegrenzungen** (z. B. bietet `google/gemini-3.8-flash` großzügige Limits)
3. **Verwenden Sie eine günstigere/schnellere Methode** für Sprachpaare mit hohem Volumen – Google Translate hat keine Ratenbegrenzungen:
   ```json
   { "pairs": { "en:it": { "method": "google-translate" } } }
   ```

### Modell nicht gefunden / 404-Fehler

Direkte LLM-Anbieter (`openai`, `anthropic`, `gemini`) erhalten ihre eigenen Modellnamen. Eine OpenRouter-formatierte ID ihres eigenen Anbieters wird automatisch für Sie zugeordnet (`google/gemini-3.8-flash` → `gemini-3.8-flash` auf `gemini`). Wenn die Ausführung abbricht mit:

**"is an OpenRouter model id … which has no model by that name"** – Sie verwenden ein Modell im OpenRouter-Format eines anderen Anbieters (`google/gemini-3.8-flash` mit `openai`). Es wurde nichts gesendet. Geben Sie ein Modell dieses Anbieters an, verwenden Sie die Methode, die das Modell bereitstellt, oder wechseln Sie zur Methode `llm`, um OpenRouter zu nutzen – die Meldung nennt jeweils beides sowie den Ort, an dem das Modell konfiguriert wurde:

```diff
- { "method": "openai", "model": "google/gemini-3.8-flash" }
+ { "method": "openai", "model": "gpt-4o" }
```
```json
{ "method": "llm", "model": "google/gemini-3.8-flash" }
```

Sie überprüfen außerdem Ihren Modellnamen bei der ersten Verwendung. Wenn Sie eine Warnung sehen:

**"is an Anthropic/OpenAI/Gemini model"** — Sie senden ein Modell an den falschen Anbieter:

```diff
- { "method": "gemini", "model": "claude-sonnet-4-6" }
+ { "method": "anthropic", "model": "claude-sonnet-4-6" }
```

**"not found in available models"** — Das Modell ist möglicherweise veraltet oder falsch geschrieben. Champollion ruft die Live-Modellliste des Anbieters ab und schlägt Alternativen vor. Aktuelle Modellnamen finden Sie in der Dokumentation des Anbieters.

:::tip[Modellveraltung kommt vor]
Anbieter stellen Modellnamen regelmäßig ein. Wenn Übersetzungen nach einem Anbieter-Update plötzlich fehlschlagen, prüfen Sie die Ausgabe von `[WARN]` — sie zeigt Ihnen aktuelle Alternativen an.
:::

### `local`: "could not reach …"

Die Methode `local` sendet Anfragen an einen OpenAI-kompatiblen Server auf Ihrem Rechner (Ollama, vLLM, LM Studio, llama.cpp). Wenn keine Verbindung hergestellt werden kann, nennt der Fehler die versuchte Adresse und die Einstellung, über die sie ausgewählt wurde:

```text
[ERR] Local (OpenAI-compatible) Batch 1 failed: fetch failed (ECONNREFUSED) — could not reach http://localhost:8000/v1 (from LOCAL_API_BASE in .env)
```

Die Adresse stammt aus der ersten dieser Variablen, die in der Umgebung oder in `.env.local` / `.env` gesetzt ist: `LOCAL_API_BASE`, dann `OPENAI_API_BASE`, dann `OPENAI_BASE_URL`. Wenn keine davon gesetzt ist, wird der Standardwert von Ollama verwendet: `http://localhost:11434/v1`. Starten Sie den Server oder korrigieren Sie die in der Meldung angegebene Einstellung.

## Übersetzungsqualität

### Übersetzungen geben die Ausgangssprache wieder

Das Quality Gate erkennt dies. Wenn eine Übersetzung identisch mit dem englischen Ausgangstext ist, wird sie abgelehnt und erneut versucht. Falls das Problem fortbesteht:

1. **Überprüfen Sie das Modell** – Einige Modelle schneiden bei bestimmten Sprachpaaren schlecht ab
2. **Fügen Sie Registeranweisungen hinzu** – Teilen Sie dem Modell mit, welches Sprachregister erzeugt werden soll:
   ```json
   {
     "languages": {
       "ja": { "name": "Japanese", "register": "Polite/formal Japanese" }
     }
   }
   ```
3. **Probieren Sie ein anderes Modell aus** – Wechseln Sie von `gpt-4o-mini` zu `gpt-4o` oder `google/gemini-3.1-pro-preview`

### Falsche Schriftausgabe (z. B. lateinischer Text für Japanisch)

Die Schriftkonformitätsprüfung des Quality Gate erkennt die meisten Fälle. Falls das Problem fortbesteht:

- Stellen Sie sicher, dass der Locale-Code korrekt ist (`ja`, nicht `jp`)
- Fügen Sie explizite Schriftanweisungen im Feld `register` hinzu:
  ```json
  { "register": "Japanese using hiragana, katakana, and kanji" }
  ```

### Namen bestehen die Überprüfung nicht (z. B. "Curtis Forbes" auf Japanisch)

Namen sind in lateinischer Schrift korrekt. Teilen Sie Champollion daher mit, welche Namen vorliegen:

```json
{ "protectedTerms": ["Curtis Forbes", "Game Day Suits"] }
```

Das Modell wird angewiesen, diese unverändert zu übernehmen, und ein Wert, der ausschließlich aus diesen Namen besteht, wird niemals als unübersetzt oder in falscher Schriftart gemeldet. Ohne diese Liste wird bei einem kurzen Wert in lateinischer Schrift in einer nicht-lateinischen Sprache ein erneuter Versuch unternommen, bei dem gefragt wird, ob es sich um einen Namen oder eine Beschriftung handelt. Behält das Modell den Wert bei, wird er als Name akzeptiert und zwischengespeichert, sodass er nie erneut abgerechnet wird. Sie benötigen `--no-verify` nicht.

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

`.champollion.lock` zeichnet auf, aus welchem englischen Text jede Übersetzung
erstellt wurde. Lösen Sie einen Merge-Konflikt darin wie bei jeder generierten
Datei: Behalten Sie eine der beiden Seiten bei, führen Sie `npx champollion sync` aus und
committen Sie das Ergebnis.

:::warning[Das Löschen der Lockdatei führt zu keiner Neuübersetzung]
Ohne die Lockdatei kann sync nicht feststellen, welche englischen Zeichenfolgen sich
seit der Erstellung der bestehenden Übersetzungen geändert haben. Es übersetzt nur
Schlüssel, die in einer Zieldatei **fehlen**, und erfasst das aktuelle Englisch als
neue Basislinie. Eine englische Zeichenfolge, die vor dem Löschen der Lockdatei
bearbeitet wurde, behält stillschweigend ihre alte Übersetzung. Um ein Locale
gezielt neu aufzubauen, verwenden Sie `--force` (schränken Sie dies mit
`--pair` ein); zwischengespeicherte Übersetzungen werden wiederverwendet, sodass
nur Text abgerechnet wird, den der Cache noch nie gesehen hat.
:::

### Erneutes Übersetzen bestimmter Schlüssel

Wenn einzelne Übersetzungen falsch sind und Sie eine erneute Übersetzung erzwingen möchten, ohne die Lock-Datei zu löschen:

```bash
# Re-translate a single key
npx champollion sync --force-keys "hero.title"

# Re-translate multiple keys
npx champollion sync --force-keys "nav.home,nav.about,footer.copyright"
```

Das Flag `--force-keys` setzt die Hash-Prüfung der Lockdatei für diese spezifischen Schlüssel außer Kraft und erzwingt eine Neuübersetzung, ohne andere Schlüssel zu beeinflussen. `--redo keys:hero.title` ist dasselbe unter seinem neueren Namen. Beide werden aus dem Translation Memory bedient, wenn dieses den Text enthält; fügen Sie `--fresh` hinzu, um stattdessen für eine neue Übersetzung zu bezahlen. Ein Schlüssel, der ein Komma enthält (eine gettext-msgid ist ein ganzer Satz), wird mit `\,` angegeben und das Argument für die Shell in Anführungszeichen gesetzt: `--redo 'keys:Welcome back\, %(name)s!'`.

### `verify` meldet eine Platzhalter-Diskrepanz (oder einen anderen beschädigten Wert)

`champollion verify` (sowie die Prüfung, die nach jedem Sync ausgeführt wird) meldet beschädigte Werte: einen verloren gegangenen oder umbenannten Platzhalter, einen fehlerhaften ICU-Plural, einen Wert, dessen Buchstaben gelöscht wurden. Ein einfaches `champollion sync` repariert diese **nicht**. Der Wert existiert bereits auf dem Datenträger und sein Lock-Eintrag besagt, dass er aktuell ist, sodass sync ihn unberührt lässt.

Jeder Befund nennt den Befehl, der genau diese Schlüssel repariert, zum Beispiel:

```text
[ERR] [VERIFY] fr: 1 i18next {{…}} placeholder mismatch(es): greeting (placeholder {{name}} was changed to {{nom}}) — fix: `champollion sync --pair en:fr --redo keys:greeting`
```

Führen Sie diesen Befehl aus. Wenn sich ein Locale über mehrere Dateien erstreckt, werden die Schlüssel als `<file>::<key>` geschrieben (zum Beispiel `common::nav.home`), wodurch nur der Schlüssel dieser einen Datei neu übersetzt wird und kein anderer.

Sie benötigen `--fresh` nicht. Wenn der beschädigte Wert aus dem Translation Memory stammte, hat `verify` ihn bereits aus dem Cache entfernt und weist darauf hin: `[TM] Evicted 1 cached translation(s) that produced damaged values`. Die Wiederholung übersetzt den Text dann erneut (oder liefert die eigene, abweichende Übersetzung des Caches aus), anstatt die Beschädigung erneut auszuliefern. Ein Wert, der manuell bearbeitet wurde, wird niemals zwischengespeichert; daher wird dafür nichts entfernt und die Wiederholung funktioniert auf dieselbe Weise.

Verwenden Sie für Markdown/MDX-Inhaltsdateien stattdessen `--retranslate` mit einem Pfad oder Glob (z. B. `--retranslate docs/intro.md`). Dadurch werden diese Dateien neu übersetzt, selbst wenn sie aktuell sind oder manuell übersetzt wurden. Verwenden Sie `--files`, um einen Durchlauf auf bestimmte Inhaltsdateien zu beschränken, ohne eine Übersetzung zu erzwingen.

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

### Übersetzungen nach dem Wechsel von Modell oder Anbieter

Das Wechseln der Methode (z. B. von `llm` zu `deepl`), des Registers oder des Coachings führt zu neuen Übersetzungen für das, was erneut übersetzt wird, da der Cache-Schlüssel diese enthält – ein einfacher Sync übersetzt jedoch nichts erneut, was bereits erledigt ist: `champollion sync --redo all` tut dies. Ein Wechsel des **Modells** innerhalb derselben Methode verwendet das vom vorherigen Modell Übersetzte kostenlos wieder; sync teilt Ihnen dies vor der Kostenschätzung mit. Wenn Sie die eigenen Übersetzungen des neuen Modells wünschen:

```bash
# Have the new model translate what an earlier model wrote
# (what the new model already translated still comes from the cache)
champollion sync --redo all --fresh-on-model-change

# Re-translate specific content files from scratch
champollion sync --retranslate "docs/guides/**"
```

`--fresh-on-model-change` allein ändert nur die Schlüssel, die ein Durchlauf ohnehin übersetzt (neue oder geänderte): Nach einem reinen Modellwechsel sendet ein einfaches `sync --fresh-on-model-change` nichts.

Einzelheiten zum Design des Cache-Schlüssels finden Sie unter [Translation Memory](/docs/concepts/translation-memory).

## Wiederherstellung nach einer fehlerhaften Version {#recover-old-damage}

Werte, die von einer älteren Pipeline geschrieben wurden, **heilen niemals von selbst**: Ihre Manifest-Hashes stimmen mit der aktuellen Quelle überein, sodass `sync` sie als erledigt betrachtet und kein Gate sie jemals wieder zu Gesicht bekommt. Wenn Sie ein Upgrade für ein Projekt durchführen, das mit Versionen vor 0.3.0 lief, gehen Sie davon aus, dass sich Beschädigungen in Ihren Locale-Dateien befinden könnten, und führen Sie zuerst ein Audit durch:

```bash
champollion integrity
```

Das Audit erkennt die bekannten Schadensmuster und nennt die jeweilige Behebung:

| Befund | Bedeutung | Behebung |
|---------|-----------|-----|
| `UNEXPECTED PUA` | Ausgabe der Schriftkonvertierung (pIqaD/Tengwar/Kryptonisch), die geschrieben wurde, obwohl keine Konvertierung gewünscht war – wird leer gerendert | `champollion repair-script` (offline, exakt für pIqaD) |
| `HOLLOWED VALUES` | Die Quelle mit gelöschten Buchstaben – Ausgabe vor Einführung des Content-Preservation-Gates | Neu übersetzen (siehe unten) |
| `NO-TRANSLATE DRIFT` | Eine URL oder ein anderer wörtlicher Schlüssel, der „übersetzt“ wurde | `champollion sync` (kostenlos und automatisch repariert) |

Für ausgehöhlte Werte – oder jedes Locale, dem Sie einfach nicht mehr vertrauen – bauen Sie es neu auf:

```bash
champollion sync --pair en:tlh --force
```

`--force` stellt jeden Quellschlüssel für die eingegrenzten Paare erneut in die Warteschlange. Treffer aus dem Translation Memory werden weiterhin bedient, aber jeder gelieferte Treffer wird **zunächst anhand der aktuellen Gates validiert** – ein zwischengespeicherter Wert, den das Gate jetzt ablehnt, wird verworfen und neu abgerechnet, sodass sich ein vergifteter Cache selbst heilt, anstatt den Neuaufbau zu kontaminieren. Fügen Sie `--no-tm` hinzu, wenn Sie unabhängig davon eine vollständige Neuabrechnung wünschen, und `--max-cost`, um die Ausgaben in jedem Fall zu begrenzen.

Die Überprüfung nach dem Sync meldet diese Signaturen ebenfalls, sodass ein beschädigtes Locale bei `sync` unübersehbar fehlschlägt (unter Nennung der Behebung), anstatt unbemerkt ausgeliefert zu werden.

### Einmaliges Wiedereinreihen nach Bereinigungen mit `--no-tm` {#one-time-requeue}

Wenn Ihre Wiederherstellung `--no-tm` verwendet hat, müssen Sie damit rechnen, dass der **nächste** Sync eine Reihe von Source-Echo-Schlüsseln in die Warteschlange stellt, die Sie für erledigt hielten. `--no-tm` schreibt Werte, ohne sie im Translation Memory zu stempeln, und ein *ungestempelter* Wert, der mit seiner Quelle identisch ist, lässt sich nicht von einem unübersetzten unterscheiden – er wird also einmalig wieder eingereiht, kommt (oft identisch) zurück, wird abgestempelt und ist dauerhaft erledigt. Dies sind einmalige Kosten, keine Endlosschleife. Mit folgendem Befehl können Sie genau einsehen, um welche Schlüssel es sich handelt:

```bash
champollion sync --dry --list-keys
```

## Immer noch nicht weiter?

- **[GitHub Issues](https://github.com/gamedaysuits/champollion/issues)** — Durchsuchen Sie vorhandene Issues oder melden Sie ein neues
- **[Architektur-Dokumentation](/docs/concepts/architecture)** — Verstehen Sie das Systemdesign
- **[Quality Gate](/docs/concepts/quality-gate)** — Wie die Validierung im Hintergrund funktioniert
