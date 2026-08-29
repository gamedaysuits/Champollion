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
|-------|---------|---------|
| `inputLocale` | Quellsprache | `en` |
| `languages` | Zielsprachen (Array oder Objekt) | `[]` |
| `pairs` | Überschreibungen pro Paar (`"src:tgt"`-Schlüssel) mit Methodenkonfiguration | optional |
| `localesDir` | Wo die Locale-Dateien liegen | `./locales` |
| `model` | LLM-Modell für `llm`/`llm-coached`-Methoden | `google/gemini-3.5-flash` |
| `batchSize` | Schlüssel pro API-Aufruf | 80 (LLM); Google Translate begrenzt auf 128 Segmente/Anfrage |
| `jsonConcurrency` | Parallele Locale-Übersetzungen für JSON-Schlüssel | 50 |
| `contentConcurrency` | Parallele API-Aufrufe für die Inhaltsübersetzung | 48 (Docusaurus-Dokumentation), 12 (Hugo `contentDir`) |

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

| Prüfung | Was sie erkennt | Beispiel |
|-------|----------------|---------|
| **Leer/leerer Inhalt** | Modell hat nichts zurückgegeben | `""` |
| **Quell-Echo** | Modell hat die englische Eingabe unverändert zurückgegeben | `"Welcome"` für Japanisch |
| **Halluzinationsschleife** | Wiederholte Trigramme | `"Qo' Qo' Qo' Qo'"` |
| **Längeninflation** | Ausgabe ist 4×+ länger als die Quelle | 10-Zeichen-Quelle → 50-Zeichen-Ausgabe |
| **Schrift-Konformität** | Falsche Schrift für die Locale | Lateinischer Text für arabische Locale |

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
|------|---------|------|
| `.champollion.lock` | SHA-256-Hashes der übersetzten Quellwerte (Änderungserkennung) | **Ja** – committen Sie diese Datei |
| `.champollion-content.lock` | Dasselbe, jedoch für Markdown-/MDX-Inhaltsdateien | **Ja** – committen Sie diese Datei |
| `.champollion/` | Internes Statusverzeichnis (`tm.json`-Cache, XLIFF-Exporte, Backups) | **Nein** – nehmen Sie es in gitignore auf; `tm.json` ist ein lokaler Cache (siehe [Konfiguration](/docs/getting-started/configuration)) |
| Coaching-Dateien, die Sie selbst erstellen (z. B. `coaching/fr.json`) | Ihr sprachliches Wissen | **Ja** – committen Sie diese Dateien |
| `champollion.config.json` | Projektkonfiguration | **Ja** – committen Sie diese Datei |

---

## Gängige Muster

**Alle konfigurierten Paare übersetzen:**
```bash
npx champollion sync
```
Champollion übersetzt alle Locales parallel. Durch TM-Caching rufen nur geänderte Schlüssel die API auf (unveränderte Paare werden aus dem Cache geladen, sodass eine vollständige Synchronisation kostengünstig ist).

**Nur bestimmte Paare übersetzen:**
```bash
npx champollion sync --pair en:fr          # one pair
npx champollion sync --pair en:fr,en:de    # comma-separated list
```
`--pair` beschränkt den Durchlauf auf das genannte Paar bzw. die genannten Paare; Bereitschaftsprüfungen und Kosten gelten nur für diese Paare. Die Angabe eines Paares, das nicht in Ihrem konfigurierten Paar-Graphen enthalten ist, schlägt mit einer deutlichen Fehlermeldung fehl, die die Liste der konfigurierten Paare enthält — es gibt niemals einen stillen No-Op.

**Inhaltsmodus (Markdown/MDX für Docusaurus, Hugo usw.):**
```bash
npx champollion sync --content-dir ./content
```
Übersetzt Dokumentation, Blogbeiträge und Inhaltsdateien zusammen mit dem Locale-JSON. Die Inhaltsübersetzung läuft parallel; anpassbar über `--content-concurrency`.

**Probelauf (Vorschau ohne Schreiben):**
```bash
npx champollion sync --dry-run
```

**Erneute Übersetzung bestimmter Schlüssel erzwingen:**
```bash
npx champollion sync --force-keys "hero.title,nav.about"
```

**Erneute Übersetzung aller Inhaltsdateien erzwingen:**
```bash
npx champollion sync --force-content
```

**Übersetzungsstatus prüfen:**
```bash
npx champollion status
```
Zeigt Abdeckung, Qualitätsstufen und Plugin-Informationen für jedes Paar an.

**Auf nicht übersetzte Fallbacks prüfen:**
```bash
npx champollion audit
```
Listet alle `[EN]`-Fallback-Werte auf, die übersetzt werden müssen.

---

## Fehlerbehebung

| Problem | Lösung |
|---------|-----|
| `OPENROUTER_API_KEY not set` | Exportieren Sie den Schlüssel oder fügen Sie ihn `.env` im Stammverzeichnis Ihres Projekts hinzu |
| `No locale files found` | Setzen Sie `localesDir` in der Konfiguration oder stellen Sie sicher, dass Ihre Locale-Dateien der Standardbenennung entsprechen (`en.json`, `fr.json`) |
| `[GATE] Script compliance failed` | Ihre Ziel-Locale hat lateinischen Text anstelle der erwarteten Schrift erhalten — versuchen Sie ein anderes Modell oder fügen Sie Coaching-Daten hinzu |
| `[GATE] Source echo` | Das Modell hat Englisch unverändert zurückgegeben — Coaching-Daten oder ein anderes Modell beheben dies in der Regel |
| Alle Übersetzungen zwischengespeichert | Führen Sie den Vorgang mit `--no-tm` aus, um den Cache zu umgehen, oder mit `--force-keys` für bestimmte Schlüssel |
| Konflikte in der Lock-Datei | `.champollion.lock` verwendet SHA-256-Hashes — Merge-Konflikte können sicher gelöst werden, indem Sie eine der beiden Versionen beibehalten und die Synchronisierung anschließend erneut ausführen |

---

## Wie es weitergeht

- [Schnellstart](/docs/getting-started/quick-start) — vollständige Einführungsanleitung
- [CLI-Referenz](/docs/reference/cli) — jeder Befehl und jedes Flag
- [Funktionsweise](/docs/how-it-works) — die Synchronisierungs-Pipeline erklärt
- [Die Eval-Harness-Brücke](/docs/guides/bridge) — wie champollion sich mit dem Network verbindet
- **Möchten Sie Ihre eigene Übersetzungsmethode erstellen?** Lesen Sie den [Network-Agent-Leitfaden](/docs/network/getting-started/agent-guide) — erstellen Sie eine Methode, beweisen Sie auf der öffentlichen Bestenliste, dass sie funktioniert, und treten Sie um einen Preis an, sofern und sobald einer ausgeschrieben ist (Preise sind ein geplanter Mechanismus — siehe [Ehrliche Einschränkungen](/docs/network/honest-limitations)).
