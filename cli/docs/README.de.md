# Champollion

[![npm-Version](https://img.shields.io/npm/v/champollion.svg)](https://www.npmjs.com/package/champollion)
[![Lizenz: PolyForm Noncommercial 1.0.0](https://img.shields.io/badge/license-PolyForm--Noncommercial--1.0.0-blue.svg)](#license)


Übersetzen Sie Ihre Lokalisierungsdateien mit einem einzigen Befehl:

```bash
npx champollion sync
```

Champollion erkennt automatisch Ihre Lokalisierungsdateien, deren Format und die Zielsprachen. Es übersetzt fehlende Schlüssel, überspringt bereits Erledigtes und speichert die Ergebnisse. Das ist alles.

**Lizenz:** Quelloffen (source-available) unter der [PolyForm Noncommercial License 1.0.0](../LICENSE) — kostenlose Nutzung, Änderung und Weitergabe für nicht-kommerzielle Zwecke (persönliche Projekte, Forschung, Lehre sowie die Nutzung durch wohltätige Organisationen, Schulen und öffentliche Einrichtungen). Die Nutzung für einen kommerziellen Zweck wird von dieser Lizenz nicht abgedeckt. Die Evaluierungsumgebung (Evaluation Harness) ist Open Source (AGPL-3.0-or-later). [Wer dies nutzen darf](https://champollion.dev/docs/getting-started/who-may-use-this) · [Details](#license).

> **Teil von Champollion** — Infrastruktur für die vertrauenswürdige Evaluierung maschineller Übersetzungen über alle Sprachen hinweg, quelloffen und kostenlos für die nicht-kommerzielle Nutzung (die Evaluierungsumgebung und die geteilten Register sind Open Source). Diese CLI ist die Bereitstellungskomponente eines größeren Projekts, das die Testdatensätze und die Karte erstellt, die zeigt, wer was übersetzen kann, wie gut jede Methode bei jeder Art von Text ist und wo noch Lücken bestehen. Es läuft auf zwei Arten von Benchmarks: öffentliche Benchmarks mit offenen Daten (breit, günstig, jede Methode ist willkommen) und souveräne Benchmarks — geheime Testdatensätze, die Gemeinschaften erstellen, besitzen und kontrollieren, und die wir niemals sehen. Die Infrastruktur ist quelloffen und wird von einer einzigen Instanz verwaltet; die Testdatensätze und die Methoden für die Sprache einer Gemeinschaft gehören dieser Gemeinschaft. Entwickelt für die Zusammenarbeit mit Gemeinschaften, ohne jemals deren Korpora zu hosten — das Design legt die Schlüssel in ihre Hände. Jede Methode ist willkommen, ob Mensch oder Maschine. Erkunden Sie das Netzwerk unter [champollion.dev/docs/network](https://champollion.dev/docs/network/).

## Warum nicht einfach selbst ein Skript schreiben?

Sie könnten ein kurzes Skript schreiben, das Ihre englischen Schlüssel durchläuft und Google Translate aufruft. Die meisten Entwickler tun dies — es erfordert etwa 30 Zeilen Code. Hier ist der Grund, warum dieser Ansatz scheitert:

- **Keine Änderungserkennung.** Wenn Sie eine englische Zeichenfolge aktualisieren, bleibt die Übersetzung für immer veraltet. Champollion verfolgt jeden Quellwert mit SHA-256-Hashes und übersetzt nur das neu, was sich geändert hat.
- **Keine Stapelverarbeitung (Batching).** Ein API-Aufruf pro Schlüssel bedeutet 200 Schlüssel = 200 Roundtrips. Champollion bündelt intelligent (konfigurierbar, Standard 80 Schlüssel/Stapel für LLM, 128 für Google).
- **Kein Quality Gate.** Maschinelle Übersetzung halluziniert, gibt den Quelltext unverändert zurück oder gibt Text im falschen Schriftsystem aus. Champollion prüft jede Übersetzung, bevor sie geschrieben wird — leere Ausgaben, Quelltext-Echos, Wiederholungsschleifen, Längeninflation, gelöschte Inhalte und falsche Schriftsysteme werden erkannt und abgelehnt. Das Gate fängt fehlerhafte Ausgaben ab, nicht jedoch eine falsche Bedeutung.
- **Kein Formatbewusstsein.** Fest auf JSON codiert? Champollion verarbeitet JSON, TOML, YAML und Hugo Markdown (Frontmatter + Body) mit automatischer Erkennung.
- **Keine Sicherheit.** Champollion schützt vor Prototype Pollution, Path Traversal durch manipulierte Gebietsschema-Codes (Locale Codes) und der Beschädigung von Codeblöcken während der Markdown-Übersetzung.

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

- **Multiformat** — JSON, TOML, YAML, Hugo Markdown (Frontmatter + Body) und XLIFF 1.2
- **Inkrementell** — Übersetzt nur, was sich geändert hat (SHA-256-Hash-Verfolgung)
- **Zwischengespeichert** — Das Translation Memory speichert vorherige Ergebnisse; das erneute Ausführen der Synchronisierung kostet für unveränderte Schlüssel nichts
- **Qualitätsgeprüft** — Prüft jede Übersetzung auf fehlerhafte Ausgaben: Wiederholungsschleifen, Ausgaben im falschen Schriftsystem, Quelltext-Echos, Längeninflation und gelöschte Inhalte (die Bedeutung wird nicht geprüft)
- **Inhaltsbewusst** — LLM-Methoden schützen Codeblöcke, Shortcodes, Links und Interpolationsvariablen während der Markdown-Übersetzung
- **Pipeline-Werkzeuge** — `lint`, `audit`, `integrity`, `seo` für CI-Gates
- **XLIFF-Interoperabilität** — Exportieren Sie Übersetzungen für die professionelle Überprüfung in CAT-Tools (memoQ, SDL Trados, Phrase) und importieren Sie diese wieder zurück
- **Minimale Abhängigkeiten** — zwei Laufzeitabhängigkeiten: `@translated/lara` (das Lara-Anbieter-SDK) und `cree-sro-syllabics` (der Plains Cree SRO ⇄ Silbenschrift-Konverter von ALTLab/NRC). Erfordert Node 20+

## Jenseits von Google Translate

Der Schnellstart bringt Sie mit einem LLM oder Google Translate zum Laufen. Aber Google Translate unterstützt ca. 130 Sprachen. Es gibt jedoch über 7.000.

**Die Kernidee von Champollion: Die Übersetzungsmethode ist pro Sprachpaar konfigurierbar.** Verwenden Sie Google Translate für Französisch, ein LLM, das mit Ihren eigenen Grammatiknotizen und Ihrem Wörterbuch für Plains Cree trainiert wurde, und eine von Ihnen gehostete API für eine Sprache, die von keinem Dienst abgedeckt wird — alles im selben Projekt, alles mit derselben CLI.

```json
{
  "version": 3,
  "pairs": {
    "en:fr": { "method": "google-translate" },
    "en:ja": { "method": "llm" },
    "en:crk": { "method": "llm-coached" }
  }
}
```

Wenn Sie herausfinden, wie ein Sprachpaar übersetzt werden kann — durch Prompt Engineering, Community-Wörterbücher, FST-Pipelines oder feinabgestimmte Modelle —, ermöglicht Ihnen Champollion, diese Methode als Plugin zu verpacken und sie zusammen mit allem anderen bereitzustellen.

> Entstanden aus der Übersetzung einer Produktions-Website ins Plains Cree, für das es keine fertige API gibt. Die Architektur pro Sprachpaar ist nicht theoretisch — sie existiert, weil ein Projekt Google Translate für Französisch und eine gecoachte FST-Pipeline für eine indigene Sprache benötigte, die Seite an Seite im selben Synchronisierungsbefehl ausgeführt wurden.

Das begleitende [MT Eval Harness](https://github.com/gamedaysuits/Champollion) ermöglicht es Ihnen, Übersetzungsansätze zu benchmarken und zu vergleichen, um funktionierende Methoden anschließend als Champollion-Plugins zu exportieren. Jeder, der beide Sprachen spricht, kann eine Übersetzungsmethode entwickeln, testen und teilen — es ist keine proprietäre Plattform erforderlich.

### Wählen Sie Ihre Methode

Champollion unterstützt 10 Übersetzungsmethoden. Jedes Sprachpaar kann eine andere Methode verwenden.

**LLM-Anbieter** — am besten für Qualität, Markdown-Unterstützung, Coaching-kompatibel:

| Methode | Schlüssel | Was sie tut |
|--------|-----|-------------|
| `llm` (Standard) | `OPENROUTER_API_KEY` | LLM über OpenRouter — 200+ Modelle, Auto-Routing |
| `llm-coached` | `OPENROUTER_API_KEY` | LLM + Grammatikregeln, Wörterbücher, Stilnotizen |
| `openai` | `OPENAI_API_KEY` | Direkte OpenAI-API (gpt-4o, gpt-4o-mini) |
| `anthropic` | `ANTHROPIC_API_KEY` | Direkte Anthropic-API (Claude Sonnet, Haiku, Opus) |
| `gemini` | `GEMINI_API_KEY` | Direkte Google Gemini-API (Flash, Pro) — kostenlose Stufe verfügbar |
| `local` | *(keiner)* | Ihr eigenes Modell hinter einem OpenAI-kompatiblen Endpunkt (Ollama, vLLM, LM Studio, ein mit `nmt-forge` trainiertes Modell). Setzen Sie `LOCAL_API_BASE`, falls es sich nicht auf dem Ollama-Standard befindet. Der Text verlässt niemals Ihre Infrastruktur |

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
    "en:crk": { "method": "llm-coached" }
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
champollion status                                # shows each pair's method, model + plugin benchmarks
```

Siehe [die Referenzdokumentation](https://champollion.dev/docs/reference/plugin-spec) für das Manifest-Format.

## Befehle

| Befehl | Zweck |
|---------|---------|
| `init` | Interaktiver Einrichtungsassistent (oder `--yes` für schnelle Standardwerte) |
| `sync` | Alle Gebietsschema-Dateien übersetzen & synchronisieren |
| `serve` | Den Übersetzungs-Stack dieses Projekts über HTTP bereitstellen (api-method-Vertrag) |
| `watch` | Automatische Synchronisierung bei Dateiänderungen |
| `audit` | Unvollständige Gebietsschemata markieren (CI-Gate) |
| `lint` | Fest codierte Zeichenfolgen im Quellcode finden |
| `status` | Paarkonfiguration, Methoden, Register und Plugin-Benchmarks anzeigen |
| `provenance` | Lizenzierung der Übersetzungsressourcen prüfen |
| `wrap` | Fest codierte Zeichenfolgen automatisch in `t()`-Aufrufe einhüllen (mit Rückgängig-Funktion) |
| `seo` | hreflang, sitemap.xml oder JSON-LD-Schema generieren |
| `integrity` | Auf Platzhalterbeschädigung, Codierung und Vollständigkeit von ICU-Pluralen prüfen |
| `plugin` | Methoden-Plugins installieren, entfernen oder auflisten |
| `fonts` | Web-Schriftarten für PUA-Skript-Konverter herunterladen |
| `tm` | Translation Memory-Cache verwalten (Statistiken, leeren, befüllen, bereinigen) |
| `xliff` | XLIFF 1.2 für die professionelle Überprüfung durch Übersetzer exportieren/importieren |
| `models` | Verfügbare Modelle für einen Anbieter auflisten (`--method gemini`) |
| `verify` | Geschriebene Gebietsschema-Dateien erneut lesen und bestätigen, dass Übersetzungen vorhanden und korrekt sind (CI-Gate) |
| `doctor` | System-Gesundheitsprüfung: Karten, Konfiguration, Methoden und Konverter |

Die Befehle, die mit dem geteilten Index und der Rangliste anstelle Ihres Projekts arbeiten, sind unter `champollion network` gruppiert (jeder funktioniert auch ohne das Präfix):

| Befehl | Zweck |
|---------|---------|
| `network card` | Eine Sprachkarte formatiert ausgeben (`network card <code>`, `--json` für Rohdaten) |
| `network recommend` | Methodenleitfaden für ein Paar — Verfügbarkeit + zitierte Belege (`network recommend eng fra`, `--use`, `--json`) |
| `network leaderboard` | Die MT-Rangliste anzeigen (`--pair`, `--sort`, `--install N`) |
| `network register-corpus` | Einen Evaluierungskorpus registrieren: Wählen Sie eine Lizenz + Expositionsstufe (local-only/private/public/sealed) |
| `network seal-corpus` | Krypto-Verben der Sealed-Stufe: `keygen` / `seal` / `open` (Organizer-Node-Brücke) |
| `network submit` | Einen Indexeintrag vorschlagen (Review-geprüft) — gibt ein vorausgefülltes GitHub-Issue aus |

Führen Sie `champollion <command> --help` aus, um detaillierte Hilfe zu einem beliebigen Befehl zu erhalten.

Vollständige Referenz: [die Referenzdokumentation](https://champollion.dev/docs/reference/cli)

### Pre-Commit-Gate

`champollion lint` ist als Commit-Gate konzipiert: Es beendet sich mit `1`, wenn es fest codierte, benutzerseitige Zeichenfolgen findet, und mit `0`, wenn alles sauber ist (`--warn-only` meldet ohne zu blockieren). Binden Sie es in ein versioniertes Hooks-Verzeichnis in Ihrem Projekt ein:

```bash
mkdir -p .githooks
printf '#!/bin/sh\nnpx --yes champollion@0.5 lint\n' > .githooks/pre-commit   # pinned: a new release never changes what the hook runs
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
  "model": "google/gemini-3.8-flash",
  "pairs": {
    "en:fr": { "qualityTier": "high" },
    "en:ja": { "method": "google-translate" }
  }
}
```

| Option | Standard | Beschreibung |
|--------|---------|-------------|
| `inputLocale` | `"en"` | Quellsprachencode |
| `localesDir` | `"./locales"` | Pfad zu den Gebietsschema-Dateien: eine Datei pro Sprache (`fr.json`) oder ein Ordner pro Sprache (`fr/common.json`, i18next) |
| `localesPattern` | `null` | Jedes andere Layout, z. B. `"src/i18n/{ns}/{lang}.json"` (ersetzt `localesDir`) |
| `contentDir` | `null` | Ordner mit Markdown/MDX zum Übersetzen (ein Hugo `content/` oder ein beliebiger Ordner); jede Übersetzung wird neben ihrer Quelle als `<name>.<locale>.md` geschrieben |
| `format` | `"auto"` | Dateiformat: `json`, `toml`, `yaml` oder `auto` |
| `model` | `"google/gemini-3.8-flash"` | Standardmodell (OpenRouter-Slug). Direkte Anbieter lösen ihren eigenen Standard zur Laufzeit auf. Führen Sie `champollion models --method gemini` aus, um verfügbare Modelle zu entdecken. |
| `defaultMethod` | `"llm"` | Standard-Übersetzungsmethode (wird durch das Flag `--method` überschrieben) |
| `batchSize` | `80` | Schlüssel pro Übersetzungsstapel |
| `pairs` | `{}` | Überschreibungen für Methode, Modell und Qualität pro Paar |

**Überschreibungen pro Sprache**: Jede Sprache verfügt über eine [Sprachkarte (Language Card)](https://champollion.dev/docs/reference/language-card-spec) — eine von 50 kuratierten Karten, die Register-Voreinstellungen, Formalitätssysteme, Typografieregeln und Flags zur Methodenunterstützung enthalten. Karten verwenden eine [zweistufige Architektur](https://champollion.dev/docs/concepts/architecture) (Laufzeit + Referenz) für Leistung bei Skalierung. Erstellen Sie das Grundgerüst einer neuen Karte mit `node scripts/generate-language-card.mjs <code>`. Verwenden Sie voreingestellte Schlüssel als Abkürzung oder schreiben Sie benutzerdefinierten Registertext:

```json
{
  "languages": {
    "fr": "casual-tu",
    "ko": "formal-hapsyo",
    "crk": {
      "name": "Plains Cree",
      "register": "SRO syllabics with grammatical precision.",
      "model": "google/gemini-3.1-pro-preview",
      "batchSize": 5,
      "maxRetries": 5,
      "script": "Cans"
    }
  }
}
```

**Zero-Config-Modus**: Keine Konfigurationsdatei? Champollion erkennt Lokalisierungsdateien, Format und Zielsprachen automatisch aus Ihrem Projekt.

Sprachwerte können ein Voreinstellungsschlüssel (z. B. `"casual-tu"`), benutzerdefinierter Registertext oder ein Objekt (volle Kontrolle) sein. Überschreibungen auf Paarebene in `pairs` haben Vorrang vor Einstellungen auf Sprachebene. Führen Sie `npx champollion init` aus, um die verfügbaren Voreinstellungen für jede Sprache zu durchsuchen.

Siehe die [CLI-Referenz](https://champollion.dev/docs/reference/cli) für Framework-spezifische Einrichtungsdetails.

## CLI-Ausgabe

Wenn Sie `sync` ausführen, zeigt Champollion genau an, was passiert:

```
champollion v0.4.0

[INFO] Detected format: json (auto)
[INFO] Detected framework: Hugo
[INFO] Source: en.json (2847 keys)
[INFO] Pairs: es-MX:llm, fr:deepl, it:llm
Estimated translation cost:

  Pair      Method    Keys  TM hits   Est. Cost
  ────────  ──────  ──────  ───────  ──────────
  en:es-MX  llm       2847        0    ~$0.3843
  en:fr     deepl     2847        0    ~$1.7794
  en:it     llm       2847        0    ~$0.3843

  Total: ~$2.5480
  Rates: google/gemini-3.8-flash $0.30 input / $2.50 output per 1M tokens — OpenRouter's price list, read 2026-10-04 14:02 UTC; deepl $25.00 per 1M characters — the provider's published price, as checked 2026-06-08. An estimate: ~200 input + ~30 output tokens or ~25 characters per key assumed — the bill depends on the real lengths (--json has the detail).

[INFO] Translating 3 locale(s) with concurrency 50
[INFO] es-MX.json — 2847 missing
     ████████████████████████████████ 2,847/2,847 keys
[INFO] fr.json — 2847 missing
     ████████████████████████████████ 2,847/2,847 keys
[INFO] it.json — 2847 missing
     ████████████████████████████████ 2,847/2,847 keys
[OK] Synced 8541 keys total — 8541 key(s) sent to the model, 0 served from the cache (free).
```

Die letzte Zeile der Schätzung nennt den Tarif, zu dem jede Zahl berechnet wurde, woher sie stammt und wann (`--json` enthält die Details). „Translating …“ wird nur ausgegeben, wenn etwas gesendet wird: Ein Probelauf (Dry Run) oder ein Durchlauf, bei dem nichts zu senden ist, gibt stattdessen an, dass die Gebietsschemata geprüft werden. Der Fortschrittsbalken wird an Ort und Stelle aktualisiert, sobald jeder Stapel abgeschlossen ist (~80 Schlüssel pro Aktualisierung). Wenn `contentDir` gesetzt ist, benennt die Synchronisierung den Ordner und den Zielort der Übersetzungen; sie gibt `Detected framework: Hugo` nur aus, wenn sie eine echte Hugo-Website findet (`hugo.toml`, eine `config.toml` mit Hugo-Einstellungen, `archetypes/`, …). Die Formaterkennung unterscheidet `(auto)` von `(config)`, um zu verdeutlichen, wie das Format aufgelöst wurde.

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

PolyForm Noncommercial 1.0.0. Die Champollion-CLI ist quelloffen — kostenlos zu installieren, zu nutzen und zu modifizieren für nicht-kommerzielle Zwecke (Forschung, Bildung, Gemeinschaftsarbeit) unter der [PolyForm Noncommercial License 1.0.0](../LICENSE); die Nutzung für einen kommerziellen Zweck wird von dieser Lizenz nicht abgedeckt. In einfachen Worten, mit Beispielen — eine Schule, ein öffentliches Krankenhaus oder eine Klinik, eine wohltätige Organisation, ein persönliches oder Forschungsprojekt ist abgedeckt; das Produkt eines gewinnorientierten Unternehmens, wie z. B. die Schaufensterseite eines Shops, ist es nicht: [Wer dies nutzen darf](https://champollion.dev/docs/getting-started/who-may-use-this) (eine Zusammenfassung, keine Rechtsberatung; der Lizenztext ist maßgeblich). Das veröffentlichte npm-Paket `champollion` ist PolyForm-Noncommercial-1.0.0; `cli/LICENSE` ist die maßgebliche Lizenz für das verteilte Paket. Die begleitende MT-Evaluierungsumgebung (MT Eval Harness) und die Spezifikationen sind Open Source, lizenziert unter AGPL-3.0-or-later — mit einer §7 eval-standard-plugin-Ausnahme — im öffentlichen [Harness-Repository](https://github.com/gamedaysuits/Champollion).
