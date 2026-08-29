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

champollion erkennt Ihre Locale-Dateien, das Format und die Zielsprachen automatisch. Es übersetzt, was fehlt, überspringt, was erledigt ist, validiert jedes Ergebnis und schreibt eine saubere Ausgabe. Das ist der Ausgangspunkt.

:::info[Teil von etwas Größerem]

Diese CLI ist die Bereitstellungskomponente von **Champollion** — einer Infrastruktur, die
maschinelle Übersetzung für Sprachen misst, die sonst niemand misst, und
die Ergebnisse veröffentlicht. Die Messkomponente erstellt Evaluierungs-Testsets und
eine öffentliche Übersicht darüber, wer was, wie gut und bei welchen Textarten übersetzen kann;
die CLI ist der Ort, an dem eine bewährte Methode zu etwas wird, das Sie tatsächlich ausführen können.

Eine Regel prägt alles: Sprachdaten werden wie Biodaten behandelt, sodass die
Personen, die einen Korpus bereitstellen, die Kontrolle darüber und über alles behalten,
was daran gemessen wird. Das Gesamtbild — was existiert, wie die Regeln lauten, wo Sie
sich einfügen — finden Sie unter [Was Champollion ist](/docs/what-is-champollion), und die
Messkomponente ist unter [Das Netzwerk](/docs/network/) zu finden.

:::

---

## Warum nicht einfach selbst ein Skript schreiben?

Sie könnten eine schnelle Schleife schreiben, die für jeden Schlüssel Google Translate aufruft. Die meisten Entwickler tun das — es dauert etwa 30 Zeilen. Hier scheitert es:

- **Keine Änderungserkennung.** Aktualisieren Sie eine englische Zeichenkette — die Übersetzung bleibt für immer veraltet. champollion verfolgt jeden Quellwert mit SHA-256-Hashes und übersetzt nur das neu, was sich geändert hat.
- **Kein Batching.** Ein API-Aufruf pro Schlüssel bedeutet: 200 Schlüssel = 200 Roundtrips. champollion bündelt intelligent (konfigurierbar, standardmäßig 80 Schlüssel/Batch bei LLM, 128 bei Google).
- **Kein Caching.** Bei jeder Synchronisierung wird alles neu übersetzt. Der Translation Memory von champollion cached Übersetzungen nach Quelltext + Locale + Methode — bei erneuter Synchronisierung nach einer Schlüsseländerung wird nur dieser eine Schlüssel übersetzt, nicht die gesamte Datei.
- **Keine Qualitätskontrolle.** Maschinelle Übersetzung halluziniert, gibt die Quelle zurück oder liefert die Ausgabe in der falschen Schrift. champollion validiert jede Übersetzung vor dem Schreiben — falsche Schrift, Längeninflation und Quellwiederholungen werden erkannt und abgewiesen.
- **Kein Formatbewusstsein.** Fest auf JSON verdrahtet? champollion verarbeitet JSON, TOML, YAML und Hugo Markdown (Frontmatter + Body) mit automatischer Erkennung.
- **Keine Methodensteuerung.** Jedes Paar erhält dieselbe Methode. champollion ermöglicht es Ihnen, Google Translate für Französisch, ein LLM für Japanisch und eine benutzerdefinierte, community-gehostete Pipeline für Cree zu verwenden — in derselben Konfigurationsdatei.

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
    "en:ja": { "method": "llm", "model": "google/gemini-2.5-pro" },
    "en:crk": { "methodPlugin": "crk-coached-v1" }
  }
}
```

Französisch erhält Google Translate (schnell, günstig). Japanisch erhält ein Premium-LLM (nuanciert). Plains Cree erhält ein gecoachtes Plugin mit Grammatikregeln, Wörterbüchern und morphologischer Validierung. Derselbe `sync`-Befehl. Dieselbe Qualitätskontrolle. Dieselbe CLI.

### Sehen Sie, was funktioniert

Glauben Sie, Ihre Methode kann Englisch nach Spanisch übersetzen? Türkisch nach Aserbaidschanisch? Englisch nach Cree?

**Entwickeln Sie sie und testen Sie sie.** Das begleitende [Eval-Harness](/docs/network/specifications/harness) benchmarkt jede Übersetzungsmethode mit reproduzierbarer, fingerabdruckversehener Bewertung. Das [Leaderboard](/leaderboard) zeichnet jeden veröffentlichten Durchlauf auf, sodass jeder sehen kann, was funktioniert.

Das Eval-Harness und die Produktions-CLI teilen sich dieselbe Plugin-Schnittstelle. Eine Methode, die im Harness gut abschneidet, kann in der Produktion verwendet werden — sofern die Gemeinschaft, deren Sprache sie bedient, ihre Zustimmung gibt. Für indigene und ressourcenarme Sprachen ist diese Zustimmung von Bedeutung. Siehe [Datensouveränität](/docs/network/sovereignty/data-sovereignty).

```bash
# Benchmark a method against a real, non-bundled eval corpus
# (GlobalVoices amh->fra, 945 sentences, fetched from source on first run)
pip install mt-eval-harness
export OPENROUTER_API_KEY=sk-or-...   # any OpenRouter-proxied model works
mt-eval run --corpus eval-amh-fra-globalvoices-test-v1 --model gemini-pro --yes

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

Die [Methoden-Rangliste](/leaderboard) ist die Anzeigetafel — live, öffentlich und offen für Einreichungen. Jede Einreichung wird mit einem Fingerabdruck an einen Git-Commit gebunden, für einen spezifischen Datensatz versioniert und durch dieselbe Testumgebung bewertet. Jeder kann Einreichungen vornehmen.

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

**Weiterführende Informationen:**
- [Zusammenarbeit mit professionellen Übersetzern](/docs/guides/professional-translators) — XLIFF-Export/Import-Workflow
- [Datenhoheit](/docs/network/sovereignty/data-sovereignty) — indigene Prinzipien der Datensouveränität: Eigentum und Kontrolle der Gemeinschaften über ihre Sprachdaten
- [Unterstützung einer ressourcenarmen Sprache](/docs/network/community/low-resource-languages) — Die Herausforderung, mit der alles begann
- [Kochbuch: FST-gesteuerte Pipeline](/docs/network/tutorials/fst-gated-pipeline) — Aufbau einer Dekompositions-Pipeline
- [MT-Evaluierung](/docs/network/leaderboard/rules) — Wie die Testumgebung und die Rangliste funktionieren
- [Methoden-Rangliste](/leaderboard) — Live-Ergebnisse und Einreichungen
