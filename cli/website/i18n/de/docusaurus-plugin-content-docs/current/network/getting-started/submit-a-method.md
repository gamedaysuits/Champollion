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
python3 -m pip install mt-eval-harness
```

---

## Schritt 1: Das Harness ausführen

Das Harness bewertet Ihre Methode gegen einen standardisierten Datensatz:

```bash
mt-eval run \
  --corpus eval-amh-fra-globalvoices-test-v1 \
  --model google/gemini-3.1-pro-preview \
  --name your-method-name \
  --temperature 0.2
```

| Flag | Funktion |
|---|---|
| `--corpus` | Korpus-Dateipfad oder registrierte Korpus-ID (`.json`, `.jsonl`, `.tsv`) |
| `--model` | Exakter Modell-Slug – die vollständige OpenRouter-ID (z. B. `google/gemini-3.1-pro-preview`); kurze Aliase und variable IDs (`…-latest`) werden abgelehnt. Mit `--method <plugin dir>` das Modell, das Ihrem Plugin als `config.method_model` übergeben wird (beliebige Namensgebung Ihres Plugins) |
| `-n, --name` | Für Menschen lesbare Bezeichnung für Ihren Durchlauf (erscheint auf der Bestenliste) |
| `--temperature` | Sampling-Temperatur (niedriger = deterministischer) |
| `--fst-retries` | Optional: Anzahl der FST-Wiederholungsversuche |
| `--publish` | Veröffentlicht die Run-Card auf der Bestenliste, sobald der Durchlauf abgeschlossen ist |

Das Harness erzeugt eine **Run Card** — eine eigenständige JSON-Datei mit Ihren Bewertungen, dem Datensatz-Hash, dem Modell-Slug und einem kryptografischen Fingerabdruck, der die Ergebnisse an die exakte Experimentkonfiguration bindet.

---

## Schritt 2: Ihre Run Card überprüfen

Jeder Durchlauf schreibt zwei Dateien nach `eval/logs/harness/`: das Ausführungsprotokoll `<run-id>.json`
und den bewerteten Bericht `<run-id>_report.json`. Der Bericht ist das, was Sie veröffentlichen.
Überprüfen Sie ihn zuerst:

```bash
python -m json.tool eval/logs/harness/<run-id>_report.json | less
```

Wichtige Felder im `overall`-Block des Berichts:
- `corpus_chrf` — chrF++ auf Korpusebene (0–100), die primäre Kennzahl und
  Ranking-Metrik. Ihr 95%-Bootstrap-KI ist `confidence_intervals.corpus_chrf` und ihre
  sacreBLEU-Signatur ist `sacrebleu_signatures.chrf`
- `scoring_standard` (`"standard/1"`) und `primary_metric`
  (`"chrf_plus_plus"`) — der Standard, nach dem der Bericht bewertet wurde
- `corpus_bleu`, `corpus_spbleu`, `corpus_ter` — die weiteren Standardmetriken,
  die neben chrF++ angezeigt und niemals damit vermischt werden
- `exact_match_rate` — eine Diagnosemetrik: der Anteil perfekter Übersetzungen
- `confidence_intervals` — Bootstrap-Intervalle für die obigen Metriken
- `total_cost_usd` — Kosten des Durchlaufs (`null`, wenn für das Modell kein Preis
  veröffentlicht ist, z. B. bei einem lokalen Modell; wird niemals als 0 $ angegeben)

Der Bericht zeichnet außerdem als Verweis auf, welche Vorgaben das Modell erhalten hat
(`instructions`: Name und SHA-256 der Coaching-Datei, SHA-256 des
System-Prompts und der Speicherort des vollständigen Textes, das Ausführungsprotokoll auf Ihrem Rechner). Die Run-Card,
die an die Bestenliste übermittelt wird, wird aus diesem Bericht zusammengestellt. Sie ergänzt die
Method-Card sowie den Reproduzierbarkeits-Fingerprint und stellt denselben
chrF++-Wert und dasselbe KI voran; ihre Felder `composite` und `quality_tier` sind `null`, da beide
[veraltet sind](/docs/network/specifications/scoring#how-runs-are-scored). (Ein Bericht,
der vor dem Standard erstellt wurde, enthält möglicherweise `published_composite`; dies ist ein veralteter
zusammengesetzter Wert, der ausgemustert wurde und niemals mit chrF++ verglichen wird.)
`mt-eval publish <report> --dry-run` gibt die Card genau so aus, wie sie
veröffentlicht werden würde. Siehe die [Run-Card-Spezifikation](/docs/network/specifications/run-card)
für das zugehörige Schema.

---

## Schritt 3: Einreichen

Die Veröffentlichung schreibt direkt in die **Live**-Bestenliste, daher ist ein explizites
`--prod` erforderlich – ohne dieses verweigert das Test-Harness die Ausführung und weist Sie darauf hin. Prüfen Sie zunächst die Vorschau:

```bash
# See exactly what would be uploaded (no sign-in, no network)
mt-eval publish eval/logs/harness/<run-id>_report.json --dry-run

# Publish (opens a browser sign-in the first time; add --anonymous to skip it)
mt-eval publish eval/logs/harness/<run-id>_report.json --prod
```

Um direkt aus einem Durchlauf heraus zu veröffentlichen, fügen Sie `--publish --prod` zu `mt-eval run` hinzu. Falls der
Veröffentlichungsschritt fehlschlägt, bleiben die Bewertungen des Durchlaufs dennoch gespeichert und das Test-Harness gibt den
exakten Befehl für einen erneuten Versuch aus. Das Setzen von `MT_EVAL_ALLOW_PROD=1` in der Umgebung entspricht
`--prod` für Skripte.

:::note[Die Einreichungs-API und der Web-Upload sind noch nicht aktiv]
Ein `POST https://champollion.dev/api/leaderboard/submit`-Endpunkt und eine
Upload-Benutzeroberfläche für die Bestenliste sind geplant, aber **noch nicht implementiert**. Bis zu deren Bereitstellung
ist der einzige funktionierende Einreichungsweg `mt-eval publish` (es gibt keine
Einreichung über Pull-Requests).
:::

---

## Was als Nächstes geschieht

1. Ihre Einreichung wird validiert (Dataset-Hash, Integrität der Run-Card)
2. Ergebnisse erscheinen auf der Bestenliste als **Selbst evaluiert** (Vertrauensstufe 1)
3. Um den Status **Champollion-verifiziert** zu erhalten, reichen Sie Ihre Methode als installierbares Plugin ein, damit Maintainer Ihre Ergebnisse reproduzieren können
4. Für Methoden für indigene Sprachen: Wenn Ihre Methode die Spitzenposition erreicht, beginnt der Prozess der [Eigentumsübertragung](/docs/network/sovereignty/ownership-transfer)

---

## Siehe auch

- [Harness-Nutzung](/docs/network/specifications/harness) — vollständige CLI-Referenz
- [Regeln der Bestenliste](/docs/network/leaderboard/rules) — Einreichungskriterien und Anti-Gaming-Richtlinien
- [Eine Methode erstellen](/docs/network/specifications/methods) — das TranslationMethod-Protokoll
- [Datensätze](/docs/network/leaderboard/datasets) — verfügbare Evaluierungsdatensätze
