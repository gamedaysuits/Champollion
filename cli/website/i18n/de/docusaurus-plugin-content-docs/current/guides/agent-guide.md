---
sidebar_position: 9
title: "Agent-Leitfaden: Verwendung von champollion"
description: "Wie KI-Agenten champollion installieren, konfigurieren und ausführen können, um Locale-Dateien zu übersetzen."
related:
  - label: "Agent Guide: Building & Benchmarking on the Network"
    to: /docs/network/getting-started/agent-guide
    kind: arena
    note: "The eval-side guide for the same agents"
  - label: "Serving a Custom Method as an API"
    to: /docs/guides/serving-a-method
    kind: guide
  - label: "Build a Translation Plugin"
    to: /docs/tutorials/build-a-plugin
    kind: tutorial
  - label: "CLI Reference"
    to: /docs/reference/cli
    kind: reference
---

# Agent-Leitfaden: Verwendung von champollion

champollion ist ein CLI-Tool, das die Locale-Dateien Ihrer App mit einem einzigen Befehl übersetzt. Dieser Leitfaden richtet sich an KI-Agenten (oder Entwickler, die mit KI-Agenten arbeiten), die schnell von null zu übersetzten Locale-Dateien gelangen möchten.

:::tip[Bereits vertraut?]
Wenn Sie nur die Befehle benötigen, springen Sie zur [CLI-Referenz](/docs/reference/cli). Wenn Sie eine Übersetzungsmethode erstellen und benchmarken möchten, lesen Sie den [Network Agent Guide](/docs/network/getting-started/agent-guide).
:::

---

## Einrichtung der Umgebung

```bash
# No global install needed — npx runs it directly
npx champollion sync
```

**Voraussetzungen:**
- Node.js 20.11+ (natives ESM)
- Einen API-Schlüssel für Ihren Übersetzungsanbieter

**Einrichtung des API-Schlüssels** — champollion benötigt je nach den verwendeten Methoden mindestens einen Schlüssel:

```bash
# Option 1: export (session only)
export OPENROUTER_API_KEY="sk-or-..."        # for llm / llm-coached methods
export GOOGLE_TRANSLATE_API_KEY="AIza..."    # for google-translate method

# Option 2: .env file in your project root (persistent, gitignored)
echo 'OPENROUTER_API_KEY=sk-or-...' > .env
```

Champollion liest `.env.local` und `.env` automatisch (Priorität: `process.env` → `.env.local` → `.env`). Einen OpenRouter-Schlüssel erhalten Sie unter [openrouter.ai/keys](https://openrouter.ai/keys).

---

## Erste Synchronisierung

Champollion erkennt automatisch Ihre Locale-Dateien, deren Format (JSON, TOML oder YAML) sowie Ihre Zielsprachen:

```bash
npx champollion sync
```

**Was geschieht:**
1. Lädt `champollion.config.json` (oder erkennt die Einstellungen automatisch)
2. Durchsucht Ihre Quell-Locale-Datei und flacht verschachtelte Schlüssel ab
3. Vergleicht mit `.champollion.lock` (SHA-256-Hashes zuvor übersetzter Werte)
4. Prüft `.champollion/tm.json` auf zwischengespeicherte Übersetzungen (Translation Memory)
5. Übersetzt nur **geänderte, fehlende oder veraltete Schlüssel** über die konfigurierte Methode
6. Führt das Quality Gate (5 Prüfungen) für jede Übersetzung aus
7. Schreibt bestandene Übersetzungen in die Ziel-Locale-Datei
8. Aktualisiert die Lock-Datei und den TM-Cache

Bei einem typischen erneuten Durchlauf nach Änderung eines einzelnen Schlüssels liefert Schritt 4 142 Schlüssel aus dem Cache und Schritt 5 übersetzt 1 Schlüssel. Aus diesem Grund sind nachfolgende Synchronisierungen schnell und kostengünstig.

---

## Konfiguration

Erstellen Sie `champollion.config.json` im Stammverzeichnis Ihres Projekts:

```json
{
  "inputLocale": "en",
  "pairs": {
    "en:fr": { "method": "llm-coached" },
    "en:ja": { "method": "google-translate" },
    "en:crk": { "method": "api", "endpoint": "http://localhost:3000/translate" }
  }
}
```

Paarschlüssel verwenden einen **Doppelpunkt** (`en:fr`), keinen Bindestrich – Bindestriche sind für regionale Locale-Codes wie `es-MX` reserviert.

Wichtige Felder:

| Feld | Zweck | Standard |
|------|-------|----------|
| `inputLocale` | Quellsprache | `en` |
| `languages` | Zielsprachen (Array oder Objekt) | `[]` |
| `pairs` | Überschreibungen pro Sprachpaar (`"src:tgt"`-Schlüssel) mit Methodenkonfiguration | optional |
| `localesDir` | Speicherort der Locale-Dateien | `./locales` |
| `model` | LLM-Modell für `llm`/`llm-coached`-Methoden | `google/gemini-3.8-flash` |
| `batchSize` | Schlüssel pro API-Aufruf | 80 (LLM); Google Translate begrenzt auf 128 Segmente/Anfrage |
| `jsonConcurrency` | Parallele Locale-Übersetzungen für JSON-Schlüssel | 50 |
| `contentConcurrency` | Parallele API-Aufrufe für die Inhaltsübersetzung | 48 (Docusaurus-Dokumentation), 12 (`contentDir`) |

Vollständige Referenz: [Konfiguration](/docs/getting-started/configuration)

---

## Übersetzungsmethoden

| Methode | Wann zu verwenden | Kosten | Benötigter API-Schlüssel |
|--------|------------|------|---------------|
| **`llm`** | Allzweck, gut für ressourcenstarke Sprachen | Pro Token (modellabhängig) | `OPENROUTER_API_KEY` |
| **`llm-coached`** | Wenn Sie Grammatikregeln/ein Wörterbuch für die Zielsprache haben | Pro Token + Coaching-Kontext | `OPENROUTER_API_KEY` |
| **`google-translate`** | Ressourcenstarke Sprachen, bei denen GT gut funktioniert | 20 $/Million Zeichen | `GOOGLE_TRANSLATE_API_KEY` |
| **`api`** | Benutzerdefinierte Pipeline hinter einem HTTP-Endpunkt | Servergesteuert | Keiner (Endpunkt übernimmt die Authentifizierung) |
| **`plugin`** | Vorgefertigte, lokal installierte Methode | Variiert | Variiert |

Details: [Übersetzungsmethoden](/docs/guides/translation-methods)

---

## Coaching-Daten

Für `llm-coached`-Paare steuern Coaching-Daten das LLM mit explizitem linguistischem Wissen. Erstellen Sie eine Coaching-Datei:

```json title="coaching/fr.json"
{
  "grammar_rules": [
    "Use formal register (vous) for all UI text",
    "Adjectives agree in gender and number with the noun"
  ],
  "dictionary": {
    "dashboard": "tableau de bord",
    "settings": "paramètres"
  },
  "style_notes": "Prefer active voice. Avoid anglicisms."
}
```

Verweisen Sie in Ihrer Paar-Konfiguration darauf:

```json
"en:fr": { "method": "llm-coached", "coachingFile": "coaching/fr.json" }
```

Das Quality Gate überprüft, ob die Wörterbuchbegriffe tatsächlich in der Ausgabe erscheinen — Verstöße werden als `[TERM]`-Warnungen protokolliert.

Details: [Coaching-Daten](/docs/concepts/coaching-data)

---

## Quality Gate

Jede Übersetzung durchläuft fünf automatisierte Prüfungen, bevor sie auf die Festplatte geschrieben wird:

| Prüfung | Was erkannt wird | Beispiel |
|---------|------------------|----------|
| **Leer/blank** | Modell hat nichts zurückgegeben | `""` |
| **Quellecho** | Modell hat die englische Eingabe unverändert zurückgegeben | `"Welcome"` für Japanisch |
| **Halluzinationsschleife** | Wiederholte Trigramme | `"Qo' Qo' Qo' Qo'"` |
| **Längeninflation** | Ausgabe ist mehr als 4× so lang wie die Quelle (genau 4× wird akzeptiert) | 10-Zeichen-Quelle → 50-Zeichen-Ausgabe |
| **Schriftkonformität** | Falsches Schriftsystem für das Locale | Lateinischer Text für arabisches Locale |

Fehlschläge werden mit dem Präfix `[GATE]` protokolliert. Keine stillen Fallbacks — schlägt eine Übersetzung fehl, wird dies gemeldet und nicht stillschweigend akzeptiert.

Details: [Quality Gate](/docs/concepts/quality-gate)

---

## Translation Memory

Champollion speichert Übersetzungen in `.champollion/tm.json` zwischen, indexiert nach Quelltext + Locale + Methode. Bei nachfolgenden Synchronisierungen werden unveränderte Schlüssel aus dem Cache bereitgestellt — kein API-Aufruf, keine Kosten.

```
[TM] 142 key(s) served from cache
Translating 3 key(s) to French (llm)... [OK]
```

Um den Cache für einen einzelnen Durchlauf zu umgehen: `npx champollion sync --no-tm`

Details: [Translation Memory](/docs/concepts/translation-memory)

---

## Generierte Dateien

Champollion erstellt mehrere Dateien in Ihrem Projekt. Machen Sie sich damit vertraut, damit Sie nicht versehentlich die falschen löschen oder committen:

| Datei | Zweck | Git? |
|-------|-------|------|
| `.champollion.lock` | SHA-256-Hashes der übersetzten Quellwerte (Änderungserkennung), plus pro Locale: was Sync geschrieben hat, Schlüssel, die ein Redo ausstehend gelassen hat, nach einer Ablehnung zurückgehaltene Schlüssel | **Ja** — committen Sie dies |
| `.champollion-replaced-edits.jsonl` | Manuell bearbeitete Übersetzungen, die durch einen Sync ersetzt wurden, samt ihrem Wortlaut (wird nur geschrieben, wenn dies eintritt) | **Ja** — committen Sie dies |
| `.champollion-content.lock` | Dasselbe, jedoch für Markdown/MDX-Inhaltsdateien | **Ja** — committen Sie dies |
| `.champollion/` | Internes Statusverzeichnis (`tm.json`-Cache, XLIFF-Exporte, Backups) | **Nein** — in .gitignore aufnehmen; `tm.json` ist ein lokaler Cache (siehe [Konfiguration](/docs/getting-started/configuration)) |
| Von Ihnen verfasste Coaching-Dateien (z. B. `coaching/fr.json`) | Ihr linguistisches Wissen | **Ja** — committen Sie diese |
| `champollion.config.json` | Projektkonfiguration | **Ja** — committen Sie dies |

---

## Gängige Muster

**Alle konfigurierten Paare übersetzen:**
```bash
npx champollion sync
```
Champollion übersetzt alle Locales parallel. Mit TM-Caching werden nur geänderte Schlüssel an die API gesendet (unveränderte Paare werden aus dem Cache bedient, sodass ein vollständiger Sync kostengünstig ist).

**Nur bestimmte Paare übersetzen:**
```bash
npx champollion sync --pair en:fr          # one pair
npx champollion sync --pair en:fr,en:de    # comma-separated list
```
`--pair` beschränkt die Ausführung auf das bzw. die benannten Paare; Bereitschaftsprüfungen und Ausgaben gelten nur für diese Paare. Die Angabe eines Paars, das nicht in Ihrem konfigurierten Paargraphen enthalten ist, schlägt mit der Liste der konfigurierten Paare deutlich fehl – niemals als stiller No-Op.

**Wie ein Paar geschrieben wird.** Ein Projektpaar wird so geschrieben, wie `champollion.config.json` es als Schlüssel verwendet: `en:fr`. `sync`, `verify` und `serve` lesen auch `en>fr` und `en-fr`, und `en-pt-BR` wird mit den von Ihnen konfigurierten Paaren abgeglichen. Die Netzwerkbefehle (`network register-corpus`, `leaderboard`, `recommend`, `submit`) schreiben ein Paar als `eng>crk`, dem Format, das die Bestenliste speichert, und lesen `eng-crk` und `eng:crk` auf dieselbe Weise. Dort muss ein Paar, das nur Bindestriche enthält, aus zwei Codes mit zwei oder drei Buchstaben bestehen (`eng-crk`). Ein Code mit einem eigenen Bindestrich erfordert `>`: `--pair "eng>pt-BR"`. `eng-pt-BR` könnte auch `eng-pt` und `BR` bedeuten, daher wird es abgelehnt und niemals erraten. Setzen Sie die Form `>` in einer Shell in Anführungszeichen: `--pair "eng>crk"`. Ohne Anführungszeichen leitet die Shell die Ausgabe in eine Datei namens `crk` weiter.

**Inhaltsmodus (ein Ordner mit Markdown/MDX: ein Hugo-`content/` oder ein beliebiger Ordner; Docusaurus-Dokumente werden ohne diesen gefunden):**
```bash
npx champollion sync --content-dir ./content
```
Übersetzt Dokumentationen, Blogbeiträge und Inhaltsdateien neben den Locale-JSON-Dateien. Jede Übersetzung wird neben ihrer Quelle als `<name>.<locale>.md` gespeichert; Bearbeitungen, die ein Reviewer daran vornimmt, bleiben erhalten, wenn sich die Quelle an anderer Stelle ändert ([Inhaltsübersetzung](/docs/guides/content-translation#reviewing-and-editing-translations)). Die Inhaltsübersetzung läuft parallel; anpassbar mit `--content-concurrency`.

**Probelauf (Vorschau ohne Schreiben):**
```bash
npx champollion sync --dry-run
```

**Erneute Übersetzung bestimmter Schlüssel erzwingen:**
```bash
npx champollion sync --force-keys "hero.title,nav.about"
```

**Alle Inhaltsdateien erneut verarbeiten (gespeicherter Text wird wiederverwendet, daher ist unveränderter Text kostenlos):**
```bash
npx champollion sync --force-content
```

**Bestimmte Inhaltsdateien neu übersetzen (kostenpflichtig) oder einen Durchlauf auf bestimmte Dateien beschränken:**
```bash
npx champollion sync --retranslate docs/intro.md
npx champollion sync --files "docs/guides/**"
```

**Maschinenlesbarer Durchlauf:** `--json` schreibt ein JSON-Objekt pro Zeile (NDJSON), jeweils mit einem `level`: auf stdout `info`- und `ok`-Meldungen, `event`-Datensätze (`"event": "cost"` – die Schätzung vor dem `--max-cost`-Gate – und ein `"event": "file"` pro Inhaltsdatei und Locale) und zuletzt die abschließende `{"level": "summary", "command": "sync", …}`; auf stderr `warn`- und `error`-Zeilen, ebenfalls als JSON. Wählen Sie die Zusammenfassung anhand ihres Levels aus, niemals allein über die Zeilenposition: `npx champollion sync --dry --json 2>/dev/null | jq -c 'select(.level == "summary")'`. Der Exit-Code `2` bedeutet teilweise erfolgreich (einige Arbeiten wurden erledigt, etwas ist fehlgeschlagen).

In der Schätzung (`cost`-Ereignis und `costEstimate` in der Zusammenfassung) ist `totalEstimatedCost` immer dann `null`, wenn für irgendeinen Teil kein Preis bekannt ist – niemals eine Teilsumme, niemals `0` für unbekannt; `knownEstimatedCost` enthält den bepreisten Teil, `unknownCost.reason` nennt die Paare ohne Preis und `unknownCost.notes` gibt an, was keinen hat und warum – `{ subject, pairs, note }`, wie beispielsweise ein Modellname, den die Liste von OpenRouter nicht enthält (ein wahrscheinlicher Tippfehler, mit den ähnlichsten aufgelisteten Namen), ein gelistetes Modell ohne Token-Preis oder eine Preisliste, die nicht gelesen werden konnte. Ein Modell auf diesem Rechner (ein `local`- oder `api`-Endpunkt unter `localhost`/`127.0.0.1`/`::1`) wird mit `0` bei `"local": true` bepreist. `sentToModel` in der Zusammenfassung zählt die Schlüssel, die bei diesem Durchlauf an die Methode gesendet wurden (`tmHits`: aus dem Cache bedient). Die Zusammenfassung eines Probelaufs (Dry Run) enthält `preflight: { ready, failures }` – `ready: false` bedeutet, dass der tatsächliche Durchlauf anhalten und mit `1` beendet werden würde (ein fehlender Schlüssel oder ein für den Durchlauf benötigter Modellserver, der nicht antwortet), obwohl der Probelauf selbst mit `0` beendet wird ([Exit-Codes](/docs/reference/cli#sync-exit-codes)). Mit `--max-cost` enthält sie außerdem `maxCost: { cap, estimatedCost, wouldStop }` – `wouldStop: true` (mit `exitCode: 2` und `reason`) bedeutet, dass der tatsächliche Durchlauf vor jedem API-Aufruf am Limit anhalten würde. `realRun: { exitCode, wouldStop, reasons }` ist der Exit-Code, mit dem der tatsächliche Durchlauf enden würde, soweit eine Vorschau dies ermitteln kann: der Preflight und das Limit sowie das, was ihn unvollständig zurücklassen würde – zurückgehaltene Schlüssel, Pluralmeldungen auf der Festplatte ohne eine von der Sprache verwendete Form, die nicht erneut angefordert werden würde (gezählt im `totalPluralGaps` des Probelaufs). Ein Probelauf verifiziert nichts (`verify: { "ran": false }`). Führen Sie den Probelauf mit den Parametern `--method`/`--model` des tatsächlichen Durchlaufs aus: ohne diese prüft er die in der Konfiguration angegebene Methode.

**Übersetzungsstatus überprüfen:**
```bash
npx champollion status
```
Zeigt die Methode, das Modell, die Abdeckung und die Plugin-Informationen jedes Paars an (ein `qualityTier` nur dann, wenn die Konfiguration eines festlegt – eine Kennzeichnung, keine Messung).

**Auf nicht übersetzte Fallbacks prüfen:**
```bash
npx champollion audit
```
Listet alle `[EN]`-Fallback-Werte auf, die übersetzt werden müssen.

---

## Fehlerbehebung

| Problem | Lösung |
|---------|--------|
| `OPENROUTER_API_KEY not set` | Exportieren Sie den Schlüssel oder fügen Sie ihn zu `.env` im Stammverzeichnis Ihres Projekts hinzu |
| `No locale files found` | Setzen Sie `localesDir` in der Konfiguration oder stellen Sie sicher, dass Ihre Locale-Dateien der Standardbenennung entsprechen (`en.json`, `fr.json`) |
| `[GATE] Script compliance failed` | Ihr Ziel-Locale hat lateinischen Text anstelle des erwarteten Schriftsystems erhalten – versuchen Sie es mit einem anderen Modell oder fügen Sie Coaching-Daten hinzu |
| `[GATE] Source echo` | Das Modell hat Englisch unverändert zurückgegeben – Coaching-Daten oder ein anderes Modell beheben dies üblicherweise |
| Alle Übersetzungen zwischengespeichert | Führen Sie den Befehl mit `--no-tm` aus, um den Cache zu umgehen, oder mit `--force-keys` für bestimmte Schlüssel |
| Konflikte in der Lock-Datei | `.champollion.lock` enthält Hashes – ein Merge-Konflikt lässt sich sicher beheben, indem Sie eine der beiden Versionen beibehalten und den Sync erneut ausführen. Das Beibehalten des Locale-Eintrags der anderen Seite kann dazu führen, dass einige Werte als manuell bearbeitet interpretiert werden (ein Bulk-Redo behält sie dann bei und benennt sie; `--redo keys:` ersetzt einen) – niemals umgekehrt |
| Schlüssel „zurückgehalten“ | Das Quality Gate hat die Antwort dieses Modells zuvor abgelehnt; ein einfacher Sync sendet sie nicht erneut (es würde dieselbe Antwort in Rechnung stellen). `champollion sync --redo keys:<key>` fordert sie erneut an; oder fügen Sie eine `fallback` hinzu, listen Sie sie in `noTranslate` auf oder schreiben Sie sie manuell |

---

## Wie es weitergeht

- [Schnellstart](/docs/getting-started/quick-start) — vollständige Einführungsanleitung
- [CLI-Referenz](/docs/reference/cli) — jeder Befehl und jedes Flag
- [Funktionsweise](/docs/how-it-works) — die Synchronisierungs-Pipeline erklärt
- [Die Eval-Harness-Brücke](/docs/guides/bridge) — wie champollion sich mit dem Network verbindet
- **Möchten Sie Ihre eigene Übersetzungsmethode erstellen?** Lesen Sie den [Network-Agent-Leitfaden](/docs/network/getting-started/agent-guide) — erstellen Sie eine Methode, beweisen Sie auf der öffentlichen Bestenliste, dass sie funktioniert, und treten Sie um einen Preis an, sofern und sobald einer ausgeschrieben ist (Preise sind ein geplanter Mechanismus — siehe [Ehrliche Einschränkungen](/docs/network/honest-limitations)).
