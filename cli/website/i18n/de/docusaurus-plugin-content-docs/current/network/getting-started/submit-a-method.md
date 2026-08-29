---
sidebar_position: 1
title: "Eine Methode einreichen"
related:
  - label: "Method Interface"
    to: /docs/network/specifications/methods
    kind: spec
    note: "The contract your method implements"
  - label: "Run Card Specification"
    to: /docs/network/specifications/run-card
    kind: spec
    note: "What every published run must disclose"
  - label: "MT Evaluation Rules"
    to: /docs/network/leaderboard/rules
    kind: doc
  - label: "Cookbook: Few-Shot Prompting"
    to: /docs/network/tutorials/few-shot-prompting
    kind: cookbook
    note: "The fastest first method to submit"
  - label: "Agent Guide: Building & Benchmarking on the Network"
    to: /docs/network/getting-started/agent-guide
    kind: guide
---

# Eine Methode einreichen

> **Zusammenfassung.** Ein Schritt-für-Schritt-Schnelleinstieg zum Einreichen Ihres ersten Benchmark-Laufs in die Bestenliste. Installieren Sie das Harness, führen Sie es gegen einen Datensatz aus, überprüfen Sie Ihre Run Card und veröffentlichen Sie sie. Dauert 10 Minuten, wenn Sie einen API-Schlüssel besitzen.

Diese Anleitung führt Sie durch das Einreichen Ihres ersten Benchmark-Laufs in die Network-Bestenliste.

---

## Voraussetzungen

- **Python 3.11+**
- **Einen OpenRouter-API-Schlüssel** (oder ein Äquivalent für Ihren Modellanbieter)
- **Eine Übersetzungsmethode** — alles, was aus einem Quelltext Übersetzungen erzeugt

```bash
# Install the eval harness (provides the `mt-eval` command)
pip install mt-eval-harness
```

---

## Schritt 1: Das Harness ausführen

Das Harness bewertet Ihre Methode gegen einen standardisierten Datensatz:

```bash
mt-eval run \
  --corpus eval-amh-fra-globalvoices-test-v1 \
  --model gemini-pro \
  --name your-method-name \
  --temperature 0.2
```

| Flag | Funktion |
|---|---|
| `--corpus` | Korpus-Dateipfad oder registrierte Korpus-ID (`.json`, `.jsonl`, `.tsv`) |
| `--model` | Modell-Slug — kurzer Alias (z. B. `gemini-pro`) oder vollständige OpenRouter-ID |
| `-n, --name` | Für Menschen lesbare Bezeichnung für Ihren Lauf (erscheint in der Bestenliste) |
| `--temperature` | Sampling-Temperatur (niedriger = deterministischer) |
| `--fst-retries` | Optional: Anzahl der FST-Wiederholungsversuche |
| `--publish` | Die Run Card nach Abschluss des Laufs in der Bestenliste veröffentlichen |

Das Harness erzeugt eine **Run Card** — eine eigenständige JSON-Datei mit Ihren Bewertungen, dem Datensatz-Hash, dem Modell-Slug und einem kryptografischen Fingerabdruck, der die Ergebnisse an die exakte Experimentkonfiguration bindet.

---

## Schritt 2: Ihre Run Card überprüfen

Run-Cards werden unter `eval/logs/harness/` gespeichert. Prüfen Sie Ihre vor dem Einreichen:

```bash
cat eval/logs/harness/your-run-card.json | python -m json.tool
```

Wichtige zu prüfende Felder:
- `scores.chrf_plus_plus` — Ihre primäre Qualitätsmetrik
- `scores.exact_match_rate` — Anteil perfekter Übersetzungen
- `scores.fst_acceptance_rate` — morphologische Gültigkeit (falls FST verwendet wurde)
- `totals.total_cost_usd` — die Kosten des Laufs
- `fingerprint` — der Reproduzierbarkeits-Hash des Experiments

Siehe die [Run-Card-Spezifikation](/docs/network/specifications/run-card) für das vollständige Schema.

---

## Schritt 3: Einreichen

### Automatische Veröffentlichung

Wenn Sie beim Ausführen des Harness `--publish` angegeben haben, wurde Ihre Run Card bereits hochgeladen.

### Manuelle Veröffentlichung

Veröffentlichen Sie eine beliebige Run Card mit dem Harness:

```bash
mt-eval publish eval/logs/harness/your-run-card.json
```

Wenn Sie den Veröffentlichungs-Workflow lieber nicht nutzen möchten, öffnen Sie einen Pull Request gegen das
[Eval-Harness-Repository](https://github.com/gamedaysuits/Champollion)
mit Ihrer Run-Card-JSON im Verzeichnis `results/`.

:::note[Die Einreichungs-API und der Web-Upload sind noch nicht verfügbar]
Ein `POST https://champollion.dev/api/leaderboard/submit`-Endpunkt und eine
Upload-Oberfläche für die Leaderboard sind geplant, aber **noch nicht implementiert**. Bis diese verfügbar sind,
sind die einzigen funktionierenden Einreichungswege `mt-eval publish` und ein Pull Request an
das oben genannte Harness-Repository.
:::

---

## Was als Nächstes geschieht

1. Ihre Einreichung wird validiert (Dataset-Hash, Integrität der Run Card)
2. Die Ergebnisse erscheinen auf der Rangliste als **Self-benchmarked** (Vertrauensstufe 1)
3. Um den Status **Champollion Verified** zu erhalten, reichen Sie Ihre Methode als installierbares Plugin ein, damit die Maintainer Ihre Ergebnisse reproduzieren können
4. Für Methoden für indigene Sprachen: Wenn Ihre Methode die Spitzenposition erreicht, beginnt der Prozess der [Eigentumsübertragung](/docs/network/sovereignty/ownership-transfer)

---

## Siehe auch

- [Harness-Nutzung](/docs/network/specifications/harness) — vollständige CLI-Referenz
- [Regeln der Bestenliste](/docs/network/leaderboard/rules) — Einreichungskriterien und Anti-Gaming-Richtlinien
- [Eine Methode erstellen](/docs/network/specifications/methods) — das TranslationMethod-Protokoll
- [Datensätze](/docs/network/leaderboard/datasets) — verfügbare Evaluierungsdatensätze
