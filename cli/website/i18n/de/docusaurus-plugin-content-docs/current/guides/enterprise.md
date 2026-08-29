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
    "en:ja": { "method": "llm", "model": "google/gemini-2.5-pro" },
    "en:de": { "method": "google-translate" },
    "en:ko": { "method": "llm", "register": "polite-haeyo" },
    "en:es": { "method": "api", "endpoint": "https://review.your-lsp.example/mtpe" },
    "en:crk": { "methodPlugin": "crk-coached-v3" }
  }
}
```

Französisch erhält DeepL (Ihr Team schätzt dessen europäische Sprachgewandtheit). Japanisch erhält ein hochmodernes LLM. Deutsch erhält Google Translate (schnell, günstig, ausreichend gut). Koreanisch erhält ein LLM mit formellem Register. Spanisch wird über die Methode `api` an einen professionellen Human-/MTPE-Dienst weitergeleitet — menschliche Übersetzung ist hier eine vollwertige Methode, kein nachträglicher Zusatz. Plains Cree erhält ein von der Community erstelltes, der Community gehörendes, gecoachtes Plugin.

**Derselbe Befehl. Dieselbe CI-Pipeline. Unterschiedliche Methoden pro Sprachpaar — menschlich oder maschinell. Eine Konfigurationsdatei.**

:::note[Methoden für Gemeinschaftssprachen sind souverän]
Das oben genannte Plains-Cree-Plugin ist nicht einfach nur „eine weitere Methode“. Methoden für indigene und andere Gemeinschaftssprachen sind **im Besitz und unter der Verwaltung der Gemeinschaft**: Die Gemeinschaft hält die Schlüssel zu den dahinterstehenden Daten, legt die Nutzungsbedingungen fest, und jedes nicht-kommerzielle (NC) Korpus oder jede solche Methode ist standardmäßig von kommerziellen Nutzungswegen ausgenommen. Wenn Ihre Nutzung kommerziell ist, prüfen Sie die Lizenz der Methode, bevor Sie ausliefern. Siehe [Datensouveränität](/docs/network/sovereignty/data-sovereignty).
:::

## Der Workflow Leaderboard → Bereitstellung

:::tip[`champollion leaderboard` wird mit der CLI ausgeliefert]
Der untenstehende Workflow wird über den Befehl `champollion leaderboard` ausgeführt — durchsuchen Sie die [Network](/arena)-Rangliste von Ihrem Terminal aus und installieren Sie direkt daraus ein Methoden-Plugin. Weitere Informationen zu allen Optionen finden Sie in der [CLI-Referenz](/docs/reference/cli#leaderboard).
:::

Das [Network](/arena) ist der Ort, an dem Übersetzungsmethoden mit reproduzierbarer, fingerabdruckbasierter Bewertung verglichen werden. Jede Methode erhält eine zusammengesetzte Punktzahl über mehrere Metriken hinweg (chrF++, exakte Übereinstimmung, FST-Akzeptanz, semantische Bewertung). Das Leaderboard erfasst jede Einreichung.

Der Workflow:

```bash
# Browse the leaderboard from your terminal
npx champollion leaderboard --pair en:crk

# Output:
# ┌──────┬───────────────────────┬────────────┬──────────┬───────────┐
# │ Rank │ Method                │ Model      │ chrF++   │ Composite │
# ├──────┼───────────────────────┼────────────┼──────────┼───────────┤
# │  1   │ crk-coached-v3        │ gemini-2.5 │ 43.2     │ 0.67      │
# │  2   │ fst-gated-pipeline    │ gpt-4o     │ 41.8     │ 0.63      │
# │  3   │ prompt-baseline       │ claude-4   │ 38.1     │ 0.55      │
# └──────┴───────────────────────┴────────────┴──────────┴───────────┘

# Install the method that fits as a plugin
npx champollion leaderboard --install crk-coached-v3

# Use it
npx champollion sync
```

*Nur zur Veranschaulichung — die obigen Leaderboard-Zeilen sind ein Beispiellayout. Das Board ist derzeit für Einreichungen geöffnet und hat noch keine veröffentlichten Durchläufe.*

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
# In your CI pipeline
npx champollion lint        # Catch hardcoded strings
npx champollion sync        # Translate what changed
npx champollion audit       # Fail if any locale is incomplete
npx champollion integrity   # Validate placeholder consistency
```

Drei Befehle. Keine manuelle Übersetzung. Die Pipeline erkennt fest codierte Zeichenketten, übersetzt sie mit Ihren gewählten Methoden und lässt den Build fehlschlagen, wenn etwas fehlt oder beschädigt ist.

### 5. Professionelle Überprüfung (optional)

Für besonders kritische Inhalte exportieren Sie nach XLIFF zur menschlichen Überprüfung:

```bash
npx champollion xliff export --locale ja --output translations.xliff
# → Send to your translation agency
# → Import corrections back:
npx champollion xliff import translations.xliff
```

Maschinelle Übersetzung für die Masse. Menschliche Überprüfung für die kritischen Pfade. Bezahlen Sie für menschliche Arbeitszeit nur dort, wo es darauf ankommt.

## Kostenmodell

champollion hat **kein Abonnement und keine Preise pro Arbeitsplatz**. Der Quellcode der CLI ist unter der PolyForm Noncommercial 1.0.0 verfügbar — kostenlos für die nichtkommerzielle Nutzung (Forschung, Bildung, gemeinnützige Arbeit); die kommerzielle Nutzung erfordert eine Genehmigung, [sprechen Sie uns also bitte zuerst an](/get-involved). Darüber hinaus zahlen Sie nur für die API-Aufrufe zur Übersetzung:

| Volumen | Google Translate | LLM (Gemini Flash) | LLM (GPT-4o) |
|--------|-----------------|---------------------|---------------|
| 1.000 Schlüssel × 5 Locales | ~0,50 $ | ~0,30 $ (kostenloses Kontingent) | ~2,00 $ |
| 10.000 Schlüssel × 15 Locales | ~15 $ | ~8 $ | ~60 $ |
| 50.000 Schlüssel × 30 Locales | ~75 $ | ~40 $ | ~300 $ |

Translation Memory bedeutet, dass Sie bei nachfolgenden Synchronisierungen nur für **geänderte Schlüssel** zahlen. Wenn Sie 10 von 10.000 Zeichenketten aktualisieren, zahlen Sie für 10 Übersetzungen, nicht für 10.000.

## Im Vergleich zu TMS-Plattformen

| | champollion | Crowdin / Phrase / Locize |
|---|---|---|
| **Preisgestaltung** | Kostenlos für nichtkommerzielle Nutzung (kommerziell mit Genehmigung) + API-Kosten | 50–500 $/Monat + pro Arbeitsplatz |
| **Anbieterbindung** | Keine — Anbieterwechsel in der Konfiguration | Hoch — Daten in deren Cloud |
| **Methodenauswahl** | Jeder Anbieter, jedes Modell, pro Sprachpaar | Was auch immer sie anbieten |
| **CI/CD** | First-Class (`lint → sync → audit`) | Plugin/Webhook |
| **Benutzerdefinierte Methoden** | Plugin-System, Community-Plugins | Nicht unterstützt |
| **Qualitätsprüfung** | Integriert (falsches Schriftsystem, Echo, Länge) | Variiert |
| **Selbstgehostet** | Ja (LibreTranslate, benutzerdefinierte API) | Nein |

Siehe den [vollständigen Vergleich](/docs/guides/comparison) für Details.

## Weiterführende Lektüre

- **[Schnellstart](/docs/getting-started/quick-start)** — führen Sie Ihre erste Synchronisierung in 60 Sekunden durch
- **[Übersetzungsmethoden](/docs/guides/translation-methods)** — das vollständige Methodenmenü mit Entscheidungsbaum
- **[CI/CD-Integration](/docs/guides/ci-cd)** — automatisieren Sie in Ihrer Pipeline
- **[Zusammenarbeit mit professionellen Übersetzern](/docs/guides/professional-translators)** — XLIFF-Export/-Import
- **[das Network](/arena)** — Benchmark und Leaderboard
- **[Konfigurationsreferenz](/docs/getting-started/configuration)** — jede Konfigurationsoption
