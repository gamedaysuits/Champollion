---
sidebar_position: 7
title: "Für Unternehmen"
description: "Wie Organisationen die Übersetzung mit ranglistenbewährten Methoden, benutzerdefinierten Plugins und einer Bereitstellung per einzelnem Befehl standardisieren können."
---

# champollion für Unternehmen

Ihr Team übersetzt regelmäßig Inhalte. Sie verfügen über einen Stapel von Locale-Dateien, eine CI-Pipeline und einen Prozess, bei dem vermutlich jemand manuell Google Translate ausführt, die Ergebnisse in JSON kopiert und auf das Beste hofft. Oder Sie bezahlen für eine TMS-Plattform, an deren Übersetzungsmaschine eines einzigen Anbieters Sie gebunden sind.

champollion bietet Ihnen eine entspanntere Option: Wählen Sie für jede Sprache die richtige Methode — maschinell oder menschlich — und führen Sie sie alle über einen einzigen Befehl aus.

## Warum Teams champollion einsetzen

1. **Wählen Sie die richtige Methode für jede Sprache** — maschinell oder menschlich, nicht das, was Ihr Anbieter standardmäßig vorgibt
2. **Bereitstellung mit einem einzigen Befehl** — `npx champollion sync` übersetzt jede Locale, jedes Format, jedes Mal
3. **Methoden austauschen, ohne Code zu ändern** — eine Konfigurationsänderung, keine Migration
4. **Besitzen Sie Ihre Pipeline** — kein Vendor-Lock-in, keine monatlichen Dashboards, keine Konten

```json title="champollion.config.json"
{
  "version": 3,
  "pairs": {
    "en:fr": { "method": "deepl" },
    "en:ja": { "method": "llm", "model": "google/gemini-3.1-pro-preview" },
    "en:de": { "method": "google-translate" },
    "en:ko": { "method": "llm", "register": "polite-haeyo" },
    "en:es": { "method": "api", "endpoint": "https://review.your-lsp.example/mtpe" },
    "en:crk": { "method": "llm-coached" }
  }
}
```

Französisch erhält DeepL (Ihr Team bevorzugt dessen europäische Sprachgewandtheit). Japanisch erhält ein Frontier-LLM. Deutsch erhält Google Translate (schnell, günstig, gut genug). Koreanisch erhält ein LLM mit formalem Register. Spanisch wird über die Methode `api` an einen professionellen Dienst für Humanübersetzung / MTPE weitergeleitet – menschliche Übersetzung ist hier eine Methode erster Klasse, kein nachträglicher Zusatz. Plains Cree erhält die Coached-LLM-Methode mit von Ihnen bereitgestellten Grammatiknotizen und einem Wörterbuch.

**Derselbe Befehl. Dieselbe CI-Pipeline. Unterschiedliche Methoden pro Sprachpaar — menschlich oder maschinell. Eine Konfigurationsdatei.**

:::note[Methoden für Community-Sprachen sind souverän]
Das oben genannte Plains-Cree-Sprachpaar ist nicht einfach irgendein weiteres Paar. Methoden für indigene und andere Community-Sprachen sind **im Besitz der Community und werden von ihr verwaltet**: Die Community hält die Schlüssel zu den zugrunde liegenden Daten, legt die Nutzungsbedingungen fest und jeder nicht-kommerzielle (NC) Korpus oder jede solche Methode ist standardmäßig von kommerziellen Wegen ausgeschlossen. Wenn Ihre Nutzung kommerziell ist, prüfen Sie die Lizenz der Methode, bevor Sie sie produktiv einsetzen. Siehe [Datensouveränität](/docs/network/sovereignty/data-sovereignty).
:::

## Der Workflow Leaderboard → Bereitstellung

:::tip[`champollion network leaderboard` ist in der CLI enthalten]
Der folgende Arbeitsablauf basiert auf dem Befehl `champollion network leaderboard` – durchsuchen Sie die Bestenliste des [Network](/arena) direkt aus Ihrem Terminal heraus und installieren Sie ein Methoden-Plugin unmittelbar daraus. Alle Optionen finden Sie in der [CLI-Referenz](/docs/reference/cli#leaderboard).
:::

Im [Network](/arena) werden Übersetzungsmethoden mit reproduzierbaren, per Fingerprint verifizierten Bewertungen gebenchmarkt. Die Durchläufe werden so eingestuft, wie es in der maschinellen Übersetzung üblich ist: nach chrF++ auf Korpusebene mit 95-%-Konfidenzintervall. BLEU, TER und COMET werden daneben ausgewiesen, und Diagnosewerte wie exakte Übereinstimmung (Exact Match) und FST-Akzeptanz werden separat aufgeführt und niemals mit dem Hauptergebnis vermischt. Ob eine Methode tatsächlich besser ist als eine andere, entscheidet ein gepaarter Signifikanztest, nicht der bloße Abstand zwischen zwei Zahlen. Die Bestenliste erfasst jede Einreichung.

Der Arbeitsablauf:

```bash
# Browse the leaderboard from your terminal
npx champollion network leaderboard --pair "eng>fra"

# Output (abridged):
#   #   Model         chrF++ [95% CI]      BLEU   …   EM     FST
#   1   gemini-3.5    72.3 [70.8, 73.7]    48.1   …   0.31   —
#   2   deepl         70.9 [69.2, 72.4]    46.0   …   0.29   —
#   3   claude-4      68.4 [66.9, 70.0]    43.7   …   0.27   —
#   Headline: chrF++ with its 95% bootstrap CI; rows whose intervals overlap are not distinguishable.

# Install the method that fits as a plugin (by its rank)
npx champollion network leaderboard --install 1

# Use it
npx champollion sync
```

*Nur zur Veranschaulichung – die obigen Zeilen der Bestenliste stellen ein Beispiellayout dar. In diesem Beispiel überschneiden sich die Intervalle der ersten beiden Zeilen, sodass die Rangliste keine Aussage darüber trifft, ob eine Methode besser als die andere ist. Die Bestenliste ist derzeit für Einreichungen geöffnet und enthält noch keine veröffentlichten Durchläufe.*

**Sie bauen die Methode nicht. Sie trainieren das Modell nicht. Sie wählen die Methode, die zu Ihrer Domäne, Ihrem Budget und Ihrer Lizenz passt — menschlich oder maschinell — und stellen sie bereit.** Wenn im nächsten Monat eine besser passende Methode erscheint, tauschen Sie sie mit einem einzigen Befehl aus.

## Was heute verfügbar ist

Die Brücke vom Leaderboard zur CLI befindet sich in der Entwicklung. Folgendes funktioniert bereits jetzt:

### Integrierte Methoden (keine Plugins erforderlich)

| Methode | Am besten geeignet für | Kosten |
|--------|----------|------|
| `llm` (Standard) | Qualitätsorientiert, jede Sprache | Pro Token über OpenRouter |
| `gemini` | Qualität + kostenloses Kontingent | Kostenlos (begrenzt), dann pro Token |
| `google-translate` | Geschwindigkeit + Volumen | 20 $/Mio. Zeichen |
| `deepl` | Europäische Sprachen | 25 $/Mio. Zeichen |
| `llm-coached` | Sprachen mit Coaching-Daten | Pro Token über OpenRouter |
| `api` | Benutzerdefinierte/Community-gehostete Methoden | Selbst gehostet |

### Plugin-Methoden (separat installieren)

Benutzerdefinierte Plugins können jede beliebige Übersetzungslogik einbinden — ein feinabgestimmtes Modell, eine FST-gesteuerte Pipeline, eine Community-API oder alles andere, das JSON erzeugt. Siehe [Ein Plugin erstellen](/docs/tutorials/build-a-plugin).

## Workflow für Unternehmen

### 1. Bewerten Sie Ihre aktuelle Qualität

```bash
# See what you're getting today
npx champollion status

# Output shows: method per pair, cache hit rate, quality gate stats
```

### 2. Führen Sie das Eval-Harness an Kandidaten aus

Das [Eval-Harness](/docs/network/specifications/harness) ermöglicht es Ihnen, mehrere Methoden anhand desselben Datensatzes zu vergleichen. Führen Sie einen Durchlauf aus, vergleichen Sie die Punktzahlen, wählen Sie die Gewinner:

```bash
# In the eval harness repo
python -m mt_eval_harness.run \
  --methods coached-v3 baseline prompt-tuned \
  --dataset data/your-corpus.json
```

### 3. Konfigurieren Sie Gewinner pro Sprachpaar

Aktualisieren Sie Ihre Konfiguration, um die beste Methode pro Sprachpaar zu verwenden. Unterschiedliche Sprachen haben unterschiedliche beste Methoden — das ist der Sinn der Sache.

### 4. Integration in CI/CD

```bash
# In your CI pipeline — pinned to the 0.5 line, so a new release never
# changes what the pipeline runs (the CI guide has the complete workflow)
npx --yes champollion@0.5 lint        # Catch hardcoded strings
npx --yes champollion@0.5 sync        # Translate what changed
npx --yes champollion@0.5 audit       # Fail if any locale is incomplete
npx --yes champollion@0.5 integrity   # Validate placeholder consistency
```

Drei Befehle. Keine manuelle Übersetzung. Die Pipeline erkennt fest codierte Zeichenketten, übersetzt sie mit Ihren gewählten Methoden und lässt den Build fehlschlagen, wenn etwas fehlt oder beschädigt ist.

### 5. Professionelle Überprüfung (optional)

Für besonders kritische Inhalte exportieren Sie nach XLIFF zur menschlichen Überprüfung:

```bash
npx champollion xliff export --locale ja --out translations.xliff
# → Send to your translation agency
# → Import corrections back:
npx champollion xliff import translations.xliff
```

Maschinelle Übersetzung für die Masse. Menschliche Überprüfung für die kritischen Pfade. Bezahlen Sie für menschliche Arbeitszeit nur dort, wo es darauf ankommt.

## Kostenmodell

champollion erfordert **weder ein Abonnement noch Gebühren pro Nutzerplatz**. Die CLI ist unter PolyForm Noncommercial 1.0.0 quelloffen verfügbar – kostenlos für die nicht-kommerzielle Nutzung: Forschung, Bildung, gemeinnützige Organisationen, öffentliche Krankenhäuser und Kliniken, Behörden, persönliche Projekte. Eine Nutzung für kommerzielle Zwecke, etwa für das Produkt eines gewinnorientierten Unternehmens, ist durch diese Lizenz nicht abgedeckt. Prüfen Sie [wer dies nutzen darf](/docs/getting-started/who-may-use-this), bevor Sie das Tool einsetzen. Darüber hinaus zahlen Sie lediglich für die API-Aufrufe zur Übersetzung:

| Volumen | Google Translate | LLM (Gemini Flash) | LLM (GPT-4o) |
|--------|-----------------|---------------------|---------------|
| 1.000 Schlüssel × 5 Locales | ~0,50 $ | ~0,30 $ (kostenloses Kontingent) | ~2,00 $ |
| 10.000 Schlüssel × 15 Locales | ~15 $ | ~8 $ | ~60 $ |
| 50.000 Schlüssel × 30 Locales | ~75 $ | ~40 $ | ~300 $ |

Translation Memory bedeutet, dass Sie bei nachfolgenden Synchronisierungen nur für **geänderte Schlüssel** zahlen. Wenn Sie 10 von 10.000 Zeichenketten aktualisieren, zahlen Sie für 10 Übersetzungen, nicht für 10.000.

## Im Vergleich zu TMS-Plattformen

| | champollion | Crowdin / Phrase / Locize |
|---|---|---|
| **Preise** | Kostenlos für nicht-kommerzielle Nutzung ([wer dies nutzen darf](/docs/getting-started/who-may-use-this)) + API-Kosten | 50–500 $/Monat + pro Nutzerplatz |
| **Vendor-Lock-in** | Keiner – Anbieter in der Konfiguration wechseln | Hoch – Daten in deren Cloud |
| **Methodenauswahl** | Beliebiger Anbieter, beliebiges Modell, pro Sprachpaar | Was dort angeboten wird |
| **CI/CD** | Erstklassig integriert (`lint → sync → audit`) | Plugin/Webhook |
| **Eigene Methoden** | Plugin-System, Community-Plugins | Nicht unterstützt |
| **Qualitätsprüfung** | Integriert (falsches Schriftsystem, Echo, Länge) | Variiert |
| **Selbst gehostet** | Ja (LibreTranslate, eigene API) | Nein |

Siehe den [vollständigen Vergleich](/docs/guides/comparison) für Details.

## Weiterführende Lektüre

- **[Schnellstart](/docs/getting-started/quick-start)** — führen Sie Ihre erste Synchronisierung in 60 Sekunden durch
- **[Übersetzungsmethoden](/docs/guides/translation-methods)** — das vollständige Methodenmenü mit Entscheidungsbaum
- **[CI/CD-Integration](/docs/guides/ci-cd)** — automatisieren Sie in Ihrer Pipeline
- **[Zusammenarbeit mit professionellen Übersetzern](/docs/guides/professional-translators)** — XLIFF-Export/-Import
- **[das Network](/arena)** — Benchmark und Leaderboard
- **[Konfigurationsreferenz](/docs/getting-started/configuration)** — jede Konfigurationsoption
