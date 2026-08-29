# Champollion

[![npm version](https://img.shields.io/npm/v/champollion.svg)](https://www.npmjs.com/package/champollion)
[![License: Apache-2.0](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](#license)


Übersetzen Sie Ihre Lokalisierungsdateien mit einem einzigen Befehl:

```bash
npx champollion sync
```

Champollion erkennt automatisch Ihre Lokalisierungsdateien, deren Format und die Zielsprachen. Es übersetzt fehlende Schlüssel, überspringt bereits Erledigtes und speichert die Ergebnisse. Das ist alles.

> **Teil von Champollion** — Open-Source-Infrastruktur für vertrauenswürdige maschinelle Übersetzung in jeder Sprache. Diese CLI ist die Bereitstellungskomponente eines größeren Projekts, das Testdatensätze und eine Übersichtskarte erstellt. Diese zeigt, wer was übersetzen kann, wie gut jede Methode bei verschiedenen Textarten abschneidet und wo noch Lücken bestehen. Es basiert auf zwei Arten von Benchmarks: öffentliche Benchmarks mit offenen Daten (breit angelegt, kostengünstig, jede Methode ist willkommen) und souveräne Benchmarks — geheime Testdatensätze, die von Gemeinschaften erstellt, besessen und kontrolliert werden und die wir niemals einsehen. Die Infrastruktur ist Open Source und wird zentral verwaltet; die Testdatensätze und Methoden für die Sprache einer Gemeinschaft gehören dieser Gemeinschaft. Entwickelt mit den Gemeinschaften, niemals von ihnen abgeschöpft (Scraping) — sie behalten die Kontrolle. Jede Methode ist willkommen, ob menschlich oder maschinell. Erkunden Sie das Netzwerk unter [champollion.dev/docs/network](https://champollion.dev/docs/network/).

## Warum nicht einfach selbst ein Skript schreiben?

Sie könnten ein kurzes Skript schreiben, das Ihre englischen Schlüssel durchläuft und Google Translate aufruft. Die meisten Entwickler tun dies — es erfordert etwa 30 Zeilen Code. Hier ist der Grund, warum dieser Ansatz scheitert:

- **Keine Änderungserkennung.** Wenn Sie eine englische Zeichenfolge aktualisieren, bleibt die Übersetzung für immer veraltet. Champollion verfolgt jeden Quellwert mit SHA-256-Hashes und übersetzt nur das neu, was sich geändert hat.
- **Keine Stapelverarbeitung (Batching).** Ein API-Aufruf pro Schlüssel bedeutet bei 200 Schlüsseln 200 Netzwerkanfragen. Champollion bündelt Anfragen intelligent (konfigurierbar, Standard: 80 Schlüssel/Batch für LLMs, 128 für Google).
- **Keine Qualitätskontrolle.** Maschinelle Übersetzung halluziniert, gibt den Quelltext unverändert zurück oder verwendet das falsche Schriftsystem. Champollion validiert jede Übersetzung vor dem Speichern — falsche Schriftsysteme, unnatürliche Längenzunahme und Quelltext-Echos werden erkannt und abgelehnt.
- **Keine Formaterkennung.** Fest auf JSON programmiert? Champollion verarbeitet JSON, TOML, YAML und Hugo Markdown (Frontmatter + Body) mit automatischer Erkennung.
- **Keine Sicherheit.** Champollion schützt vor Prototype Pollution, Path Traversal durch manipulierte Sprachcodes und der Beschädigung von Codeblöcken während der Markdown-Übersetzung.

Champollion ist die produktionsreife Version dieses Skripts.

> [!NOTE]
> **Was Champollion übersetzt.** Champollion zielt auf **Lokalisierungsdateien und strukturierte Inhalte** ab — JSON-Schlüssel-Wert-Paare, TOML/YAML-Konfigurationen, Hugo-Markdown-Seiten, XLIFF-Austauschdokumente. Es ist für formelle, geschriebene Texte optimiert: UI-Zeichenfolgen, Dokumentationen, offizielle Mitteilungen, Lehrmaterialien. Es ist kein Chatbot, kein Echtzeit-Sprachübersetzer und keine universelle Konversations-KI. Für jedes Sprachpaar ist die Übersetzungsmethode konfigurierbar — von kommerziellen APIs (Google Translate, DeepL) bis hin zu von der Gemeinschaft entwickelten Plugins, die über die [MT Eval Arena](https://champollion.dev/arena) gebenchmarkt wurden.

## Schnellstart

```bash
npm install --save-dev champollion
```

### Einen API-Schlüssel abrufen

Champollion benötigt ein Übersetzungs-Backend. Wählen Sie eines aus:

| Anbieter | Schlüssel | Am besten für |
|----------|-----|----------|
| **OpenRouter** (empfohlen) | `OPENROUTER_API_KEY` | Inhaltslastige Projekte, Markdown, 200+ Modelle |
| **OpenAI** | `OPENAI_API_KEY` | Direkter GPT-4o-Zugriff |
| **Anthropic** | `ANTHROPIC_API_KEY` | Direkter Claude-Zugriff |
| **Gemini** | `GEMINI_API_KEY` | Kostenloser Tarif verfügbar |
| **DeepL** | `DEEPL_API_KEY` | Europäische Sprachen, Glossar-Unterstützung |
| **Google Translate** | `GOOGLE_TRANSLATE_API_KEY` | 130+ Sprachen, hohes Volumen |

**Schnellster Start** (kostenlos): Registrieren Sie sich unter [aistudio.google.com](https://aistudio.google.com/apikey) für einen kostenlosen Gemini-Schlüssel:

```bash
export GEMINI_API_KEY=AI...
npx champollion sync --method gemini
```

**OpenRouter** (200+ Modelle): Registrieren Sie sich unter [openrouter.ai](https://openrouter.ai), dann:

```bash
export OPENROUTER_API_KEY=sk-or-v1-...
npx champollion sync
```

**Google Translate**-Alternative (nur Schlüssel-Wert-Paare — keine Markdown-Unterstützung):

```bash
export GOOGLE_TRANSLATE_API_KEY=...
npx champollion sync --method google-translate
```

> **Hinweis**: Wenn nur `GOOGLE_TRANSLATE_API_KEY` gesetzt ist, wechselt Champollion automatisch zu Google Translate. Es ist keine Konfigurationsänderung erforderlich. Verwendet die REST-API direkt — kein SDK, kein Dienstkonto (Service Account), kein `pip install`. Nur der Schlüssel.

Das ist alles. Für mehr Kontrolle erstellen Sie eine Konfigurationsdatei:

```bash
npx champollion init                        # guided wizard — walks you through registers, methods, and content
npx champollion init --yes --langs fr,de,ja  # quick setup with specific languages and default registers
```

Jede Sprache verfügt über **Register-Voreinstellungen** — vorgefertigte Anweisungen zu Tonfall und Formalität, die auf das jeweilige Sprachsystem abgestimmt sind (Vouvoiement für Französisch, Siezen für Deutsch, です/ます für Japanisch, 해요체 für Koreanisch). Der Initialisierungsassistent ermöglicht es Ihnen, Voreinstellungen zu durchsuchen und auszuwählen, oder übergeben Sie `--yes`, um die Standardwerte zu übernehmen.

### Nicht-englische Ausgangssprache

Wenn Ihre Ausgangssprache nicht Englisch ist:

```bash
champollion sync --source fr                      # CLI flag
```

Oder legen Sie sie dauerhaft in Ihrer Konfiguration fest:

```json
{ "inputLocale": "fr" }
```

## Funktionsweise

Sie kümmern sich um das i18n-Framework (next-intl, i18next, Hugo). Champollion kümmert sich um die Übersetzungsdateien.

- **Multi-Format** — JSON, TOML, YAML, Hugo Markdown (Frontmatter + Body) und XLIFF 1.2
- **Inkrementell** — Übersetzt nur das, was sich geändert hat (SHA-256-Hash-Verfolgung)
- **Gecacht** — Das Translation Memory speichert vorherige Ergebnisse; ein erneuter Synchronisierungslauf kostet nichts für unveränderte Schlüssel
- **Qualitätskontrolliert** — Validiert jede Übersetzung: erkennt Halluzinationen, falsche Schriftsysteme, Quelltext-Echos und unnatürliche Längenzunahme
- **Inhaltsbewusst** — LLM-Methoden schützen Codeblöcke, Shortcodes, Links und Interpolationsvariablen während der Markdown-Übersetzung
- **Pipeline-Werkzeuge** — `lint`, `audit`, `integrity`, `seo` für CI-Gates
- **XLIFF-Interoperabilität** — Exportieren Sie Übersetzungen für die professionelle Überprüfung in CAT-Tools (memoQ, SDL Trados, Phrase) und importieren Sie sie wieder zurück
- **Minimale Abhängigkeiten** — zwei Laufzeitabhängigkeiten (better-sqlite3 für die gebündelte Sprachdatenbank, CLDR-Gebietsschemanamen); keine Anbieter-SDKs. Erfordert Node 20+

## Jenseits von Google Translate

Der Schnellstart bringt Sie mit einem LLM oder Google Translate zum Laufen. Aber Google Translate unterstützt ca. 130 Sprachen. Es gibt jedoch über 7.000.

**Die Kernidee von Champollion: Die Übersetzungsmethode ist pro Sprachpaar konfigurierbar.** Verwenden Sie Google Translate für Französisch, ein LLM mit morphologischem Coaching für Plains Cree und eine von der Gemeinschaft gehostete API für Quechua — alles im selben Projekt, alles mit derselben CLI.

```json
{
  "version": 3,
  "pairs": {
    "en:fr": { "method": "google-translate" },
    "en:ja": { "method": "llm" },
    "en:crk": { "methodPlugin": "crk-coached-v1" }
  }
}
```

Wenn Sie herausfinden, wie ein Sprachpaar übersetzt werden kann — durch Prompt Engineering, Community-Wörterbücher, FST-Pipelines oder feinabgestimmte Modelle —, ermöglicht Ihnen Champollion, diese Methode als Plugin zu verpacken und sie zusammen mit allem anderen bereitzustellen.

> Entstanden aus der Übersetzung einer Produktions-Website ins Plains Cree, für das es keine fertige API gibt. Die Architektur pro Sprachpaar ist nicht theoretisch — sie existiert, weil ein Projekt Google Translate für Französisch und eine gecoachte FST-Pipeline für eine indigene Sprache benötigte, die Seite an Seite im selben Synchronisierungsbefehl ausgeführt wurden.

Das begleitende [MT Eval Harness](https://github.com/gamedaysuits/Champollion) ermöglicht es Ihnen, Übersetzungsansätze zu benchmarken und zu vergleichen, um funktionierende Methoden anschließend als Champollion-Plugins zu exportieren. Jeder, der beide Sprachen spricht, kann eine Übersetzungsmethode entwickeln, testen und teilen — es ist keine proprietäre Plattform erforderlich.

### Wählen Sie Ihre Methode

Champollion unterstützt 10 Übersetzungsmethoden. Jedes Sprachpaar kann eine andere Methode verwenden.

**LLM-Anbieter** — am besten für Qualität, Markdown-Unterstützung, Coaching-kompatibel:

| Methode | Schlüssel | Funktion |
|--------|-----|-------------|
| `llm` (Standard) | `OPENROUTER_API_KEY` | LLM via OpenRouter — 200+ Modelle, Auto-Routing |
| `llm-coached` | `OPENROUTER_API_KEY` | LLM + Grammatikregeln, Wörterbücher, Stilhinweise |
| `openai` | `OPENAI_API_KEY` | Direkte OpenAI-API (gpt-4o, gpt-4o-mini) |
| `anthropic` | `ANTHROPIC_API_KEY` | Direkte Anthropic-API (Claude Sonnet, Haiku, Opus) |
| `gemini` | `GEMINI_API_KEY` | Direkte Google Gemini-API (Flash, Pro) — kostenloser Tarif verfügbar |

**Traditionelle MÜ (Maschinelle Übersetzung)** — am besten für Geschwindigkeit, Kosten und große Mengen an Schlüssel-Wert-Paaren:

| Methode | Schlüssel | Funktion |
|--------|-----|-------------|
| `google-translate` | `GOOGLE_TRANSLATE_API_KEY` | Google Cloud Translation API v2 (130+ Sprachen) |
| `deepl` | `DEEPL_API_KEY` | DeepL-API mit Glossar-Unterstützung (30+ Sprachen) |
| `microsoft-translator` | `MICROSOFT_TRANSLATOR_API_KEY` | Azure Cognitive Services Translator (100+ Sprachen) |
| `libretranslate` | *(selbst gehostet)* | Selbst gehostetes LibreTranslate (AGPL, kostenlos) |

**Infrastruktur** — für benutzerdefinierte oder von der Gemeinschaft gehostete Endpunkte:

| Methode | Schlüssel | Funktion |
|--------|-----|-------------|
| `api` | *(pro Anbieter)* | Schlanker HTTP-Client für jeden REST-Endpunkt |

```bash
# Force a specific method for one run
champollion sync --method deepl

# Or configure per pair
```

```json
{
  "pairs": {
    "en:fr": { "method": "deepl" },
    "en:ja": { "method": "openai", "model": "gpt-4o" },
    "en:crk": { "methodPlugin": "crk-coached-v1" }
  }
}
```

> **Hinweis**: Traditionelle MÜ-Methoden (Google Translate, DeepL, Microsoft Translator, LibreTranslate) verarbeiten Schlüssel-Wert-Paare gut, können aber Markdown-Inhalte nicht sicher übersetzen. Für inhaltslastige Projekte werden LLM-Methoden empfohlen — sie schützen Codeblöcke, Shortcodes und Interpolationsvariablen explizit.

## Plugins

Plugins sind vorgefertigte Übersetzungsrezepte für bestimmte Sprachpaare. Es handelt sich um JSON-Manifeste — keinen Code —, die Champollion mitteilen, welche Methode mit welchen Einstellungen verwendet werden soll und welche Qualität im Benchmark ermittelt wurde.

```bash
champollion plugin install ./french-formal-v1/    # install from directory
champollion plugin list                           # see installed plugins
champollion plugin remove french-formal-v1        # uninstall
champollion status                                # shows quality tiers + benchmarks
```

Siehe [website/docs/reference/plugin-spec.md](../website/docs/reference/plugin-spec.md) für das Manifest-Format.

## Befehle

| Befehl | Zweck |
|---------|---------|
| `init` | Interaktiver Einrichtungsassistent (oder `--yes` für schnelle Standardwerte) |
| `sync` | Alle Lokalisierungsdateien übersetzen & synchronisieren |
| `watch` | Automatische Synchronisierung bei Dateiänderungen |
| `audit` | Unvollständige Lokalisierungen markieren (CI-Gate) |
| `card` | Eine Sprachkarte formatiert ausgeben (`card <code>`, `--json` für Rohdaten) |
| `register-corpus` | Ein Evaluierungskorpus registrieren: Lizenz + Freigabestufe wählen (nur lokal/privat/öffentlich/versiegelt) |
| `submit` | Einen Indexeintrag vorschlagen (Review-gesteuert) — gibt ein vorausgefülltes GitHub-Issue aus |
| `lint` | Fest codierte Zeichenfolgen im Quellcode finden |
| `status` | Paarkonfiguration, Methoden, Register und Qualitätsstufen anzeigen |
| `provenance` | Lizenzierung von Übersetzungsressourcen prüfen |
| `wrap` | Fest codierte Zeichenfolgen automatisch in `t()`-Aufrufe einbetten (mit Rückgängig-Funktion) |
| `seo` | hreflang, sitemap.xml oder JSON-LD-Schema generieren |
| `integrity` | Auf Platzhalter-Beschädigung, Codierung und Vollständigkeit von ICU-Pluralen prüfen |
| `plugin` | Methoden-Plugins installieren, entfernen oder auflisten |
| `fonts` | Webfonts für PUA-Schriftkonverter herunterladen |
| `tm` | Translation-Memory-Cache verwalten (Statistiken, leeren, pro Gebietsschema) |
| `xliff` | XLIFF 1.2 für die professionelle Überprüfung durch Übersetzer exportieren/importieren |
| `models` | Verfügbare Modelle für einen Anbieter auflisten (`--method gemini`) |
| `verify` | Geschriebene Lokalisierungsdateien erneut lesen und bestätigen, dass Übersetzungen vorhanden und korrekt sind (CI-Gate) |
| `leaderboard` | Die MÜ-Bestenliste anzeigen (`--pair`, `--sort`, `--install N`) |
| `doctor` | System-Gesundheitsprüfung: Karten, Konfiguration, Methoden und Konverter |

Führen Sie `champollion <command> --help` aus, um detaillierte Hilfe zu einem beliebigen Befehl zu erhalten.

Vollständige Referenz: [website/docs/reference/cli.md](../website/docs/reference/cli.md)

### Pre-Commit-Gate

`champollion lint` ist als Commit-Gate konzipiert: Es beendet sich mit `1`, wenn es fest codierte, benutzerseitige Zeichenfolgen findet, und mit `0`, wenn alles sauber ist (`--warn-only` meldet ohne zu blockieren). Binden Sie es in ein versioniertes Hooks-Verzeichnis in Ihrem Projekt ein:

```bash
mkdir -p .githooks
printf '#!/bin/sh\nnpx champollion lint\n' > .githooks/pre-commit
chmod +x .githooks/pre-commit
git config core.hooksPath .githooks   # once per clone
```

Oder lösen Sie es über [lint-staged](https://github.com/lint-staged/lint-staged) aus, sodass es nur ausgeführt wird, wenn Quelldateien für den Commit vorgemerkt (staged) sind:

```json
{
  "lint-staged": {
    "src/**/*.{js,jsx,ts,tsx}": "champollion lint"
  }
}
```

Halten Sie `champollion sync` aus dem Pre-Commit heraus — es führt Netzwerk-API-Aufrufe durch, ist also im besten Fall langsam und blockiert im schlimmsten Fall Commits im Offline-Modus. Führen Sie es stattdessen in der CI oder in einem Pre-Push-Hook aus, mit `champollion audit` / `champollion verify` als Gate.

## Konfiguration

Erstellen Sie `champollion.config.json` oder führen Sie `champollion init` aus:

```json
{
  "version": 3,
  "inputLocale": "en",
  "localesDir": "./locales",
  "model": "google/gemini-3.5-flash",
  "pairs": {
    "en:fr": { "qualityTier": "high" },
    "en:ja": { "method": "google-translate" }
  }
}
```

| Option | Standard | Beschreibung |
|--------|---------|-------------|
| `inputLocale` | `"en"` | Code der Ausgangssprache |
| `localesDir` | `"./locales"` | Pfad zu den Lokalisierungsdateien |
| `contentDir` | `null` | Hugo-Inhaltsverzeichnis (aktiviert Markdown-Übersetzung) |
| `format` | `"auto"` | Dateiformat: `json`, `toml`, `yaml` oder `auto` |
| `model` | `"google/gemini-3.5-flash"` | Standardmodell (OpenRouter-Slug). Direkte Anbieter lösen ihren eigenen Standard zur Laufzeit auf. Führen Sie `champollion models --method gemini` aus, um verfügbare Modelle zu entdecken. |
| `defaultMethod` | `"llm"` | Standard-Übersetzungsmethode (wird durch das Flag `--method` überschrieben) |
| `batchSize` | `80` | Schlüssel pro Übersetzungs-Batch |
| `pairs` | `{}` | Überschreibungen für Methode, Modell und Qualität pro Sprachpaar |

**Überschreibungen pro Sprache**: Jede Sprache verfügt über eine [Sprachkarte (Language Card)](../website/docs/reference/language-card-spec.md) — eine von 50 kuratierten Karten, die Register-Voreinstellungen, Formalitätssysteme, Typografieregeln und Flags zur Methodenunterstützung enthalten. Karten verwenden eine [zweistufige Architektur](../website/docs/concepts/architecture.md) (Laufzeit + Referenz) für Leistung bei Skalierung. Erstellen Sie das Grundgerüst einer neuen Karte mit `node scripts/generate-language-card.mjs <code>`. Verwenden Sie Voreinstellungsschlüssel als Kurzschreibweise oder schreiben Sie benutzerdefinierten Registertext:

```json
{
  "languages": {
    "fr": "casual-tu",
    "ko": "formal-hapsyo",
    "crk": {
      "name": "Plains Cree",
      "register": "SRO syllabics with grammatical precision.",
      "model": "google/gemini-2.5-pro",
      "batchSize": 5,
      "maxRetries": 5,
      "script": "cans"
    }
  }
}
```

**Zero-Config-Modus**: Keine Konfigurationsdatei? Champollion erkennt Lokalisierungsdateien, Format und Zielsprachen automatisch aus Ihrem Projekt.

Sprachwerte können ein Voreinstellungsschlüssel (z. B. `"casual-tu"`), benutzerdefinierter Registertext oder ein Objekt (volle Kontrolle) sein. Überschreibungen auf Paarebene in `pairs` haben Vorrang vor Einstellungen auf Sprachebene. Führen Sie `npx champollion init` aus, um die verfügbaren Voreinstellungen für jede Sprache zu durchsuchen.

Weitere Informationen zur Framework-spezifischen Einrichtung finden Sie in der [CLI-Referenz](../website/docs/reference/cli.md).

## CLI-Ausgabe

Wenn Sie `sync` ausführen, zeigt Champollion genau an, was passiert:

```
champollion v0.1.0

[INFO] Detected format: json (auto)
[INFO] Detected framework: Hugo
[INFO] Source: en.json (2,847 keys)
[INFO] Pairs: es-MX:llm, fr:deepl, it:llm
[INFO] Estimated translation cost:

  Pair       Method   Keys  Est. Cost
  ────────   ──────   ────  ─────────
  en:es-MX   llm      2847    ~$0.8400
  en:fr      deepl    2847    ~$0.5694
  en:it      llm      2847    ~$0.8400

  Total: ~$2.2494

[INFO] es-MX.json — 2,847 missing
     ████████████████████████████████ 2,847/2,847 keys
[INFO] fr.json — 2,847 missing
     ████████████████████████████████ 2,847/2,847 keys
[OK] Synced 5,694 keys total.
```

Der Fortschrittsbalken wird direkt aktualisiert, sobald jeder Batch abgeschlossen ist (ca. 80 Schlüssel pro Aktualisierung). Die Framework-Erkennung zeigt `Hugo` an, wenn `contentDir` gesetzt ist. Die Formaterkennung unterscheidet `(auto)` von `(config)`, um zu verdeutlichen, wie das Format aufgelöst wurde.

**Ausgabemodi**: `--quiet` unterdrückt Informationsausgaben (nur Fehler und Warnungen). `--json` gibt maschinenlesbares NDJSON für CI/CD-Pipelines aus.

## Härtung

- **Exponentielles Backoff** — 3 Wiederholungsversuche mit Jitter bei 429/5xx-Fehlern
- **30s Anfrage-Timeout** — AbortController verhindert ein Aufhängen
- **Antwortvalidierung** — akzeptiert nur Schlüssel, die zur Übersetzung gesendet wurden
- **Qualitätskontrolle** — erkennt Halluzinationsschleifen, falsche Schriftsysteme, unnatürliche Längenzunahme und Quelltext-Echos
- **Wiederholungskaskade** — bei JSON-Parsing-Fehlern wird der Batch → halber Batch → einzelne Schlüssel wiederholt (Budget-begrenzt über `maxRetries`)
- **Translation Memory** — `.champollion/tm.json` cacht Übersetzungen basierend auf Quelltext + Gebietsschema + Methode; unveränderte Schlüssel werden bei nachfolgenden Synchronisierungen aus dem Cache bedient, wodurch redundante API-Aufrufe entfallen
- **Prompt-Caching** — die Trennung von System-/Benutzernachrichten ermöglicht Caching auf Anbieterebene, was die Token-Kosten über Batches hinweg senkt
- **Terminologiedurchsetzung** — gecoachte Übersetzungen werden nach der LLM-Antwort gegen Wörterbuchbegriffe verifiziert
- **Schutz vor Prototype Pollution** — blockiert `__proto__`, `constructor`, `prototype`
- **Pfad-Eingrenzung (Path Containment)** — Dateischreibvorgänge werden validiert, um innerhalb der konfigurierten Verzeichnisse zu bleiben
- **Blockschutz** — Codeblöcke, Shortcodes und HTML werden während der Inhaltsübersetzung geschützt
- **Fail-Loud-Architektur** — Übersetzungsfehler werfen immer Ausnahmen mit umsetzbaren Fehlermeldungen und schreiben niemals stillschweigend Datenmüll
- **Post-Sync-Verifizierung** — der Befehl `verify` liest geschriebene Dateien erneut und bestätigt, dass Übersetzungen vorhanden sind, das richtige Schriftsystem verwenden und Platzhalter intakt sind
- **Teilerfolg** — ein fehlgeschlagener Batch blockiert nicht den Rest

## Testen

```bash
npm test      # all tests
npm run test:unit                # core sync pipeline
npm run test:redteam             # adversarial edge cases
npm run test:format              # TOML/YAML adapters
npm run test:content             # Markdown content parser
npm run test:hugo                # full Hugo E2E
npm run test:lint                # hardcoded string detection
npm run test:pairs               # pair graph resolution
npm run test:methods             # translation method suite
```

**Minimale Abhängigkeiten** — siehe oben.

## Lizenz

Apache-2.0. Die Champollion-CLI ist Open Source — kostenlos zu installieren, zu nutzen, zu modifizieren und weiterzuverbreiten unter den Bedingungen der [Apache License, Version 2.0](../LICENSE). Das veröffentlichte npm-Paket `champollion` steht unter Apache-2.0; `cli/LICENSE` ist die maßgebliche Lizenz für das verteilte Paket. Das begleitende MT Eval Harness und die Spezifikationen sind ebenfalls Open Source, lizenziert unter AGPL-3.0-or-later — mit einer §7 eval-standard-plugin-Ausnahme — im öffentlichen [Harness-Repository](https://github.com/gamedaysuits/Champollion).
