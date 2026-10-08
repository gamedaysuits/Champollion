---
sidebar_position: 1
slug: /intro
title: "Einführung"
related:
  - label: "Quick Start"
    to: /docs/getting-started/quick-start
    kind: guide
    note: "Install, configure, and run your first sync"
  - label: "How It Works"
    to: /docs/how-it-works
    kind: doc
    note: "The pipeline behind every translation"
  - label: "Translation Methods"
    to: /docs/guides/translation-methods
    kind: guide
    note: "LLM, Google Translate, coached, plugin — when to use which"
  - label: "The Language Atlas"
    to: /languages
    kind: atlas
    note: "Every language Champollion knows, on the map"
  - label: "Live Leaderboard"
    to: /leaderboard
    kind: leaderboard
    note: "Translation methods, benchmarked in the open"
---

# champollion

Ein vollständig anpassbares Internationalisierungs-Framework. Ein Befehl übersetzt Ihre Locale-Dateien. Eine Konfiguration steuert jede Methode, jedes Modell und jedes Sprachpaar. Und wenn die integrierten Methoden nicht ausreichen — entwickeln Sie Ihre eigene, testen Sie, ob sie funktioniert, und stellen Sie sie bereit.

```bash
npx champollion sync
```

champollion erkennt Ihre Lokalisierungsdateien, das Format und die Zielsprachen automatisch. Es übersetzt, was fehlt, überspringt bereits Erledigtes, prüft jedes Ergebnis auf fehlerhafte Ausgaben und schreibt saubere Ergebnisse. Das ist der Ausgangspunkt.

:::info[Teil von etwas Größerem]

Diese CLI ist der produktive Einsatzbereich von **Champollion** – einer Infrastruktur,
die maschinelle Übersetzung für Sprachen misst, die sonst niemand misst, und
die Ergebnisse veröffentlicht. Die messende Seite erstellt Evaluierungstestsets und
eine öffentliche Übersicht darüber, wer was wie gut und auf welchen Textarten übersetzen kann;
über die CLI wird eine bewährte Methode zu etwas, das Sie tatsächlich ausführen können.

Eine Regel bestimmt alles: Sprachdaten werden wie Biodaten behandelt, sodass die
Personen, die ein Korpus bereitstellen, die Kontrolle darüber sowie über alles behalten, was daran
gemessen wird. Das Gesamtbild – was existiert, wie die Regeln lauten und welche Rolle Sie dabei
einnehmen – finden Sie unter [Was Champollion ist](/docs/what-is-champollion), und der
Messbereich befindet sich unter [das Netzwerk](/docs/network/).

:::

---

## Warum nicht einfach selbst ein Skript schreiben?

Sie könnten eine schnelle Schleife schreiben, die für jeden Schlüssel Google Translate aufruft. Die meisten Entwickler tun das — es dauert etwa 30 Zeilen. Hier scheitert es:

- **Keine Änderungserkennung.** Wenn Sie eine englische Zeichenkette aktualisieren, bleibt die Übersetzung für immer veraltet. champollion erfasst jeden Quellwert mit SHA-256-Hashes und übersetzt nur das neu, was sich geändert hat.
- **Keine Stapelverarbeitung.** Ein API-Aufruf pro Schlüssel bedeutet: 200 Schlüssel = 200 Roundtrips. champollion fasst Anfragen intelligent zusammen (konfigurierbar, standardmäßig 80 Schlüssel/Batch für LLMs, 128 für Google).
- **Keine Zwischenspeicherung.** Jede Synchronisierung übersetzt alles neu. Das Translation Memory von champollion speichert Übersetzungen nach Quelltext + Locale + Methode zwischen – wird die Synchronisierung nach der Änderung eines einzelnen Schlüssels erneut ausgeführt, wird nur dieser eine Schlüssel übersetzt, nicht die gesamte Datei.
- **Kein Quality Gate.** Maschinelle Übersetzung halluziniert, gibt die Quelle unverändert wieder oder verwendet das falsche Schriftsystem. champollion überprüft jede Übersetzung vor dem Schreiben – leere Ausgaben, Quelltext-Echos, Wiederholungsschleifen, Textaufblähung, gelöschte Inhalte und falsche Schriftsysteme werden abgefangen und abgelehnt. Das Gate fängt fehlerhafte Ausgaben ab, keine Bedeutungsfehler.
- **Keine Formaterkennung.** Fest auf JSON ausgelegt? champollion unterstützt JSON, TOML, YAML und Hugo-Markdown (Frontmatter + Textkörper) mit automatischer Erkennung.
- **Keine Methodensteuerung.** Jedes Sprachpaar erhält dieselbe Methode. Mit champollion können Sie Google Translate für Französisch, ein LLM für Japanisch und eine benutzerdefinierte, von der Community gehostete Pipeline für Cree verwenden – in ein und derselben Konfigurationsdatei.

champollion ist die Produktionsversion dieses Skripts.

---

## Was es unterscheidet

### Jede Methode ist ein Plugin

Die Übersetzungsmethode ist **pro Sprachpaar konfigurierbar**. Kombinieren Sie Google Translate, LLMs, gecoachte Prompts und benutzerdefinierte APIs im selben Projekt:

```json title="champollion.config.json"
{
  "version": 3,
  "pairs": {
    "en:fr": { "method": "google-translate" },
    "en:ja": { "method": "llm", "model": "google/gemini-3.1-pro-preview" },
    "en:crk": { "method": "llm-coached" }
  }
}
```

Französisch erhält Google Translate (schnell, günstig). Japanisch erhält ein Premium-LLM (nuanciert). Plains Cree erhält ein LLM, das mit den von Ihnen bereitgestellten Grammatikregeln und Wörterbüchern geschult wird. Derselbe `sync`-Befehl. Dasselbe Quality Gate. Dieselbe CLI.

### Sehen Sie, was funktioniert

Glauben Sie, Ihre Methode kann Englisch nach Spanisch übersetzen? Türkisch nach Aserbaidschanisch? Englisch nach Cree?

**Entwickeln Sie sie und testen Sie sie.** Das begleitende [Eval-Harness](/docs/network/specifications/harness) benchmarkt jede Übersetzungsmethode mit reproduzierbarer, fingerabdruckversehener Bewertung. Das [Leaderboard](/leaderboard) zeichnet jeden veröffentlichten Durchlauf auf, sodass jeder sehen kann, was funktioniert.

Das Eval-Harness und die Produktions-CLI teilen sich dieselbe Plugin-Schnittstelle. Eine Methode, die im Harness gut abschneidet, kann in der Produktion verwendet werden — sofern die Gemeinschaft, deren Sprache sie bedient, ihre Zustimmung gibt. Für indigene und ressourcenarme Sprachen ist diese Zustimmung von Bedeutung. Siehe [Datensouveränität](/docs/network/sovereignty/data-sovereignty).

```bash
# Benchmark a method against a real, non-bundled eval corpus
# (GlobalVoices amh->fra, 945 sentences, fetched from source on first run)
python3 -m pip install mt-eval-harness
export OPENROUTER_API_KEY=sk-or-...   # any OpenRouter-proxied model works
mt-eval run --corpus eval-amh-fra-globalvoices-test-v1 --model google/gemini-3.1-pro-preview --yes

# Use it locally
npx champollion sync
```

Dasselbe Plugin. Einstecken und testen.

### Das vollständige Toolkit

champollion ist nicht nur `sync`. Es ist eine vollständige i18n-Pipeline:

| Befehl | Was er tut |
|---------|-------------|
| `sync` | Übersetzt fehlende und veraltete Schlüssel (mit Verifizierung nach der Synchronisierung) |
| `watch` | Automatische Synchronisierung, wenn sich Ihre Quelldatei ändert |
| `lint` | Durchsucht den Quellcode nach fest codierten Zeichenketten |
| `wrap` | Umschließt fest codierte Zeichenketten automatisch in `t()`-Aufrufen |
| `audit` | Listet alle `[EN]`-Fallback-Marker aus vorherigen Durchläufen auf |
| `verify` | Überprüft, ob Übersetzungen vorhanden und korrekt sind (CI-Gate) |
| `integrity` | Erkennt Platzhalterbeschädigung, Kodierungsprobleme und ICU-Plural-Vollständigkeit |
| `seo` | Generiert hreflang-Tags, Sitemaps und JSON-LD-Schema |
| `status` | Zeigt Paar-Konfiguration, Plugins und Benchmark-Ergebnisse |
| `provenance` | Prüft die Lizenzierung von Übersetzungsressourcen |
| `plugin` | Installiert, entfernt und listet Methoden-Plugins auf |
| `fonts` | Lädt Webfonts für PUA-Schriftkonverter herunter |
| `tm` | Verwaltet den Translation-Memory-Cache (Statistiken, Leeren, pro Locale) |
| `xliff` | Exportiert/importiert XLIFF 1.2 für die Überprüfung durch professionelle Übersetzer |

Vier davon — `lint`, `sync`, `verify`, `audit` — bilden eine CI-Pipeline, die fest codierte Zeichenketten erkennt, übersetzt, die Korrektheit verifiziert und den Build fehlschlagen lässt, wenn eine Locale unvollständig ist.

---

## Das Network

Die [Methoden-Bestenliste](/leaderboard) ist die Anzeigetafel – live, öffentlich und offen für Einreichungen. Jede Einreichung ist über einen Prüfwert an einen Git-Commit gebunden, auf einen bestimmten Datensatz versioniert und wird vom selben Test-Harness bewertet. Jeder kann Einreichungen vornehmen.

**Was können Sie entwickeln?** Das Harness nimmt JSON entgegen. Plugins nehmen JSON entgegen. Jede Methode, die JSON erzeugt, kann getestet werden:

| Ansatz | Beispiel |
|----------|---------|
| **Gecoachtes LLM** | Injizieren Sie Grammatikregeln und Wörterbücher in den Prompt eines Frontier-Modells |
| **Feinabgestimmtes Modell** | Trainieren Sie ein offenes Modell mit Paralleltext — nur nicht mit den Eval-Daten |
| **FST-gesteuerte Pipeline** | LLM generiert → Finite-State-Transducer validiert die Morphologie → Wiederholung |
| **Verkettete Modelle** | Modell A entwirft → Modell B überarbeitet → Modell C bewertet |
| **Wörterbuch + LLM** | Erzwingen Sie bekannte Begriffe aus einem Wörterbuch, lassen Sie das LLM den Rest erledigen |
| **Evolutionär** | Generieren Sie Kandidaten, bewerten Sie sie, mutieren Sie die besten, wiederholen Sie |
| **Teilübersetzung** | Übersetzen Sie eine Stichprobe von Hand, beweisen Sie, dass Ihr LLM übereinstimmt, übersetzen Sie den Rest automatisch |

Stimmen Sie Modelle fein ab. Setzen Sie evolutionäre Algorithmen ein. Testen Sie Studentenantworten in Sprachprüfungen. Erstellen Sie Nachschlagetabellen. Verketten Sie drei Modelle miteinander. Solange Ihre Methode JSON erzeugt, bewertet das Harness sie und das Framework führt sie aus.

:::danger[Die eine Regel]
**Trainieren Sie nicht mit den Evaluationsdaten.** Methoden, die dem Benchmark-Datensatz ausgesetzt waren, werden disqualifiziert. Stimmen Sie fein ab, womit Sie wollen. Nur nicht mit dem Testsatz.
:::

Dies ist eine offene Einladung. Wenn Sie mit einer ressourcenarmen Sprache arbeiten — als Forscher, als Mitglied einer Gemeinschaft, als Student oder einfach als jemand, dem es wichtig ist — entwickeln Sie eine Methode, führen Sie das Harness aus und stärken Sie das Network für alle. Das Problem ist ungelöst. Die Infrastruktur ist da, und sie ist offen.

**[→ Das Leaderboard ansehen](/leaderboard)**

---

## Nächste Schritte

**Erste Schritte:**
- [Installation](/docs/getting-started/installation) — Einrichtung in 2 Minuten
- [Quick Start](/docs/getting-started/quick-start) — Führen Sie Ihre erste Synchronisierung durch
- [Unterstützte Sprachen](/docs/reference/supported-languages) — Was standardmäßig verfügbar ist

**Anpassen Ihrer Einrichtung:**
- [Übersetzungsmethoden](/docs/guides/translation-methods) — Wählen Sie die richtige Methode pro Paar
- [Translation Memory](/docs/concepts/translation-memory) — Wie Caching Ihnen Geld spart
- [Konfiguration](/docs/getting-started/configuration) — Vollständige Konfigurationsreferenz
- [Mehrsprachige Hugo-Website](/docs/tutorials/hugo-multilingual-site) — Übersetzung von Markdown-Inhalten

**Vertiefende Themen:**
- [Zusammenarbeit mit professionellen Übersetzern](/docs/guides/professional-translators) – XLIFF-Export/Import-Workflow
- [Datensouveränität](/docs/network/sovereignty/data-sovereignty) – Prinzipien indigener Datensouveränität: Gemeinschaftseigentum und Kontrolle über Sprachdaten
- [Eine ressourcenarme Sprache unterstützen](/docs/network/community/low-resource-languages) – Die Herausforderung, mit der alles begann
- [Cookbook: FST-Gated Pipeline](/docs/network/tutorials/fst-gated-pipeline) – Aufbau einer Zerlegungspipeline
- [MT-Evaluierung](/docs/network/leaderboard/rules) – Wie das Test-Harness und die Bestenliste funktionieren
- [Methoden-Bestenliste](/leaderboard) – Live-Ergebnisse und Einreichungen
