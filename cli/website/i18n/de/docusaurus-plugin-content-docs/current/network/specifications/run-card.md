---
sidebar_position: 4
title: "Spezifikation der Run Card"
---

# Run-Card-Spezifikation

> **Zusammenfassung.** Die Run-Card ist die atomare Einheit des Benchmarkings — ein JSON-Dokument, das die vollständige Konfiguration, die Ergebnisse pro Eintrag und die aggregierten Bewertungen eines Evaluierungslaufs aufzeichnet. Diese Seite dokumentiert das Schema, die Felder, den Fingerprinting-Mechanismus und die Struktur der Bewertungen. Siehe die [Benchmark-Spezifikation](/docs/network/specifications/benchmark) für die kanonischen Definitionen.

Die Run-Card ist die vollständige Aufzeichnung eines einzelnen Evaluierungslaufs. Sie enthält alles, was zum Verständnis, zur Reproduktion und zur Verifikation des Experiments erforderlich ist: Konfiguration, Bewertungen, einzelne Ergebnisse, Token-Verbrauch und Umgebungs-Metadaten.

**Schema-Version:** 2.0

:::info[Maßgebliches Schema]
Die [Benchmark-Spezifikation](/docs/network/specifications/benchmark) ist die einzige verbindliche Quelle für das Run-Card-Schema. Für Metrikdefinitionen, zusammengesetzte Gewichtungen und Qualitätsstufen siehe die [Scoring-Spezifikation](/docs/network/specifications/scoring). Diese Seite dokumentiert die aktuelle Implementierung.
:::

---

## Felder der obersten Ebene

| Feld | Typ | Beschreibung |
|-------|------|-------------|
| `run_id` | `string` | UUID v4, die zu Beginn des Laufs generiert wird |
| `harness_version` | `string` | Semantische Version des Harness, das diese Card erzeugt hat (z. B. `2.0`) |
| `model_slug` | `string` | Für den Lauf verwendeter Model-Slug (z. B. `google/gemini-3.1-pro`) |
| `model_id` | `string` | Aufgelöste Modellkennung, die von der API zurückgegeben wird (z. B. `gemini-3.1-pro-001`) |
| `condition` | `string` | Experiment-Label (z. B. `baseline`, `coached-v3`, `few-shot`) |
| `timestamp` | `string` | ISO-8601-UTC-Zeitstempel des Laufbeginns |
| `elapsed_seconds` | `number` | Tatsächliche Gesamtdauer (Wall-Clock) des gesamten Laufs |

```json
{
  "run_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "harness_version": "2.0",
  "model_slug": "google/gemini-3.1-pro",
  "model_id": "gemini-3.1-pro-001",
  "condition": "baseline",
  "timestamp": "2026-06-01T03:22:41Z",
  "elapsed_seconds": 142.7
}
```

---

## `dataset`

Identifiziert den Evaluierungsdatensatz und bindet ihn über SHA-256 an eine bestimmte Inhaltsversion.

| Feld | Typ | Beschreibung |
|-------|------|-------------|
| `id` | `string` | Datensatzkennung (z. B. `edtekla-dev-v1`) |
| `version` | `string` | Versions-String des Datensatzes |
| `language_pair` | `string` | Anzeigelabel (z. B. `EN→CRK`) |
| `sha256` | `string` | SHA-256-Hash des Inhalts der Datensatzdatei. Garantiert die exakt verwendeten Daten |
| `entry_count` | `number` | Anzahl der Einträge im Datensatz |

```json
// Example using textbook_dev.json — the 436-entry textbook dev split
{
  "dataset": {
    "id": "edtekla-dev-v1",
    "version": "1.0",
    "language_pair": "EN→CRK",
    "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "entry_count": 436
  }
}
```

---

## `config`

Die für diesen Lauf verwendete API- und Batching-Konfiguration.

| Feld | Typ | Beschreibung |
|-------|------|-------------|
| `api_provider` | `string` | Name des API-Anbieters (z. B. `openrouter`) |
| `temperature` | `number` | Sampling-Temperatur |
| `max_tokens` | `number` | Maximale Anzahl Tokens pro Completion |
| `batch_size` | `number` | Einträge pro gleichzeitigem Batch |
| `concurrency` | `number` | Maximale Anzahl paralleler API-Anfragen |
| `coaching_file` | `string` | Pfad zur Coaching-Prompt-Datei, falls verwendet |
| `method_path` | `string` | Pfad zum Verzeichnis des Methoden-Plugins, falls verwendet |
| `fst_retries` | `number` | Anzahl der FST-Wiederholungsversuche |

```json
{
  "config": {
    "api_provider": "openrouter",
    "temperature": 0.0,
    "max_tokens": 32768,
    "batch_size": 25,
    "concurrency": 8
  }
}
```

:::info[Veröffentlichte Run Cards enthalten `method_config`]
Wenn eine Run Card über `mt-eval publish` veröffentlicht wird, fügt `publish.py` einen `method_config`-Block ein, der die kanonische 8-Feld-MethodConfig enthält. Dies ermöglicht eine reibungslose Leaderboard-Installation — jeder kann die Methode direkt aus der veröffentlichten Card reproduzieren.

```json
{
  "method_config": {
    "model": "gemini-pro",
    "temperature": 0.0,
    "batchSize": 25,
    "register": "Formal Plains Cree. Use SRO orthography.",
    "coachingFile": "prompts/crk-coaching-v8.txt",
    "coachingPrompt": null,
    "promptContext": "champollion",
    "qualityTier": "verified"
  }
}
```

Alle Felder verwenden **camelCase** und folgen dem kanonischen MethodConfig-Schema (siehe [Eine Methode erstellen](/docs/network/specifications/methods)).
:::

---

## `system_prompt_sha256` / `system_prompt_used`

| Feld | Typ | Beschreibung |
|-------|------|-------------|
| `system_prompt_sha256` | `string` | SHA-256-Hash des System-Prompts. Im Fingerprint enthalten |
| `system_prompt_used` | `string` | Der vollständige System-Prompt-Text, der an das Modell gesendet wird |

Der Prompt-Hash ist Teil des [Fingerprints](#fingerprint) — zwei Läufe mit unterschiedlichen Prompts erhalten unterschiedliche Fingerprints, selbst wenn alle anderen Einstellungen übereinstimmen.

---

## `fingerprint`

Eine Kennung zur Reproduzierbarkeit. Zwei Läufe mit identischen Fingerprints verwendeten dasselbe experimentelle Setup.

| Feld | Typ | Beschreibung |
|-------|------|-------------|
| `hash` | `string` | SHA-256-Hash der sortierten Komponenten |
| `components` | `object` | Die Eingabewerte, die gehasht wurden |

### Fingerprint-Komponenten

| Komponente | Beschreibung |
|-----------|-------------|
| `dataset_sha256` | Hash der Datensatzdatei |
| `model_slug` | Verwendetes Modell |
| `condition` | Label der Experimentbedingung |
| `system_prompt_sha256` | Hash des System-Prompts |
| `temperature` | Sampling-Temperatur |
| `harness_version` | Harness-Version |

```json
{
  "fingerprint": {
    "hash": "7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069",
    "components": {
      "dataset_sha256": "e3b0c44298fc1c14...",
      "model_slug": "google/gemini-3.1-pro",
      "condition": "baseline",
      "system_prompt_sha256": "abc123...",
      "temperature": 0.0,
      "harness_version": "2.0"
    }
  }
}
```

:::info[Fingerprint ≠ Run-Card-Hash]
Der Fingerprint identifiziert die *Experimentkonfiguration*. Der `run_card_hash` überprüft die *Integrität der Ergebnisdatei*. Siehe [Fingerprint vs Run Card Hash](/docs/network/specifications/harness#fingerprint-vs-run-card-hash) für Details.
:::

---

## `scores`

Aggregierte Metriken für den gesamten Lauf.

### Bewertungen der obersten Ebene

| Feld | Typ | Beschreibung |
|-------|------|-------------|
| `total` | `number` | Gesamtzahl der evaluierten Einträge |
| `exact_matches` | `number` | Einträge, bei denen die Ausgabe exakt mit dem Goldstandard übereinstimmte |
| `exact_match_rate` | `number` | `exact_matches / total` (0.0–1.0) |
| `fst_accepted` | `number` | Einträge, bei denen der FST-Analyzer die Ausgabe akzeptierte |
| `fst_acceptance_rate` | `number` | `fst_accepted / total` (0.0–1.0). `null`, wenn kein FST-Analyzer verwendet wurde |
| `chrf_plus_plus` | `number` | chrF++-Bewertung auf Korpusebene (0–100) |
| `errors` | `number` | Einträge, die fehlgeschlagen sind (API-Fehler, Timeout usw.) |
| `avg_latency_seconds` | `number` | Mittlere Antwortzeit über alle Einträge |
| `median_latency_seconds` | `number` | Median der Antwortzeit |
| `p95_latency_seconds` | `number` | Antwortzeit im 95. Perzentil |

### `by_difficulty`

Nach Schwierigkeitsstufe aufgeschlüsselte Bewertungen. Jeder Schlüssel (Ganzzahl 1–5) enthält dieselben Metrikfelder wie die Bewertungen der obersten Ebene.

```json
{
  "by_difficulty": {
    "1": {
      "total": 20,
      "exact_matches": 8,
      "exact_match_rate": 0.40,
      "chrf_plus_plus": 68.2,
      "fst_accepted": 18,
      "fst_acceptance_rate": 0.90
    },
    "2": { ... },
    "3": { ... },
    "4": { ... },
    "5": { ... }
  }
}
```

### `by_provenance`

Nach Herkunft des Eintrags aufgeschlüsselte Bewertungen. Jeder Schlüssel (z. B. `gold_standard`, `textbook`) enthält dieselben Metrikfelder.

```json
{
  "by_provenance": {
    "gold_standard": {
      "total": 80,
      "exact_matches": 10,
      "exact_match_rate": 0.125,
      "chrf_plus_plus": 44.8
    },
    "textbook": { ... }
  }
}
```

---

## `totals`

Token-Verbrauch und Kostenverfolgung für den gesamten Lauf.

| Feld | Typ | Beschreibung |
|-------|------|-------------|
| `prompt_tokens` | `number` | Gesamtzahl der Eingabe-Tokens über alle API-Aufrufe |
| `completion_tokens` | `number` | Gesamtzahl der Ausgabe-Tokens |
| `reasoning_tokens` | `number` | Tokens, die für Chain-of-Thought-Reasoning verwendet wurden (modellabhängig, 0 bei den meisten Modellen) |
| `cached_tokens` | `number` | Tokens, die aus dem Prompt-Cache des Anbieters bereitgestellt wurden |
| `total_cost_usd` | `number` | Gesamtkosten in USD (wie von der API gemeldet) |
| `cost_per_entry_usd` | `number` | `total_cost_usd / entry_count` |
| `reasoning_ratio` | `number` | `reasoning_tokens / completion_tokens` (0.0–1.0) |

```json
{
  "totals": {
    "prompt_tokens": 48200,
    "completion_tokens": 3100,
    "reasoning_tokens": 0,
    "cached_tokens": 12000,
    "total_cost_usd": 0.42,
    "cost_per_entry_usd": 0.0034,
    "reasoning_ratio": 0.0
  }
}
```

---

## `environment`

Metadaten zur Laufzeitumgebung für die Reproduzierbarkeit.

| Feld | Typ | Beschreibung |
|-------|------|-------------|
| `harness_version` | `string` | Harness-Version (spiegelt `harness_version` der obersten Ebene wider) |
| `harness_git_commit` | `string` | Git-Commit-SHA des Harness zum Zeitpunkt des Laufs |
| `python_version` | `string` | Version des Python-Interpreters |
| `sacrebleu_version` | `string` | Version der sacrebleu-Bibliothek (verwendet für chrF++-Bewertung) |
| `os` | `string` | Betriebssystemkennung |

```json
{
  "environment": {
    "harness_version": "2.0",
    "harness_git_commit": "a1b2c3d",
    "python_version": "3.11.9",
    "sacrebleu_version": "2.4.0",
    "os": "macOS-14.5-arm64"
  }
}
```

---

## `results[]`

Das Array mit den Ergebnissen pro Eintrag. Ein Objekt pro Datensatzeintrag, in Indexreihenfolge.

| Feld | Typ | Beschreibung |
|-------|------|-------------|
| `entry_id` | `integer` | ID dieses Eintrags im Korpus (entspricht `entries[].id`) |
| `source` | `string` | Der übersetzte Quelltext |
| `reference` | `string` | Die Goldstandard-Referenz aus dem Korpus |
| `predicted` | `string` | Die tatsächliche Ausgabe der Methode |
| `exact_match` | `boolean` | Ob `predicted` nach Normalisierung exakt mit `reference` übereinstimmt |
| `entry_chrf` | `number` | chrF++-Bewertung auf Satzebene für diesen Eintrag (0–100) |
| `fst_accepted` | `boolean \| null` | Ob der FST-Analyzer die Ausgabe akzeptierte. `null`, wenn kein Analyzer konfiguriert war |
| `fst_analysis` | `string[]` | FST-Analyse-Strings für die Ausgabe (leeres Array, wenn nicht analysiert oder abgelehnt) |
| `difficulty` | `integer` | Schwierigkeitsstufe aus dem Korpus (1–5) |
| `provenance` | `string` | Herkunfts-Tag aus dem Korpus |
| `latency_seconds` | `number` | Antwortzeit für diesen einzelnen Eintrag |
| `usage` | `object` | Token-Verbrauch pro Eintrag: `{ prompt_tokens, completion_tokens, reasoning_tokens }` |
| `error` | `string \| null` | Fehlermeldung, falls dieser Eintrag fehlgeschlagen ist. `null` bei Erfolg |

```json
{
  "results": [
    {
      "entry_id": 1,
      "source": "Hello",
      "reference": "tânisi",
      "predicted": "tânisi",
      "exact_match": true,
      "entry_chrf": 100.0,
      "fst_accepted": true,
      "fst_analysis": ["tânisi+V+AI+Ind+2Sg"],
      "difficulty": 1,
      "provenance": "gold_standard",
      "latency_seconds": 0.82,
      "usage": {
        "prompt_tokens": 385,
        "completion_tokens": 12,
        "reasoning_tokens": 0
      },
      "error": null
    }
  ]
}
```

---

## `run_card_hash`

| Feld | Typ | Beschreibung |
|-------|------|-------------|
| `run_card_hash` | `string` | SHA-256-Hash der gesamten Run-Card-JSON, wobei das Feld `run_card_hash` selbst während des Hashings auf `""` gesetzt wird |

Dies ist das Siegel zur Manipulationserkennung. Das Leaderboard berechnet diesen Hash bei der Einreichung neu und weist Cards zurück, bei denen er nicht übereinstimmt.

**Berechnung des Hashs:**

1. Serialisieren Sie die Run-Card als JSON mit `run_card_hash` auf `""` gesetzt
2. Berechnen Sie SHA-256 des serialisierten Strings
3. Setzen Sie `run_card_hash` auf den resultierenden Hex-Digest

```python
import hashlib, json

card["run_card_hash"] = ""
card_json = json.dumps(card, sort_keys=True, ensure_ascii=False)
card["run_card_hash"] = hashlib.sha256(card_json.encode()).hexdigest()
```

:::info[Detailanalyse pro Eintrag]
Veröffentlichte Run Cards befüllen zudem die Supabase-Tabelle `run_card_entries`, in der die Ergebnisse pro Eintrag für die Detailanalyse auf dem Leaderboard gespeichert werden. Diese Tabelle wird während `mt-eval publish` automatisch befüllt.
:::

---

## Siehe auch

- [MT-Evaluierung](/docs/network/leaderboard/rules) — Überblick, Wert des Leaderboards und Hinweise zu guten/schlechten Methoden
- [Eval-Harness](/docs/network/specifications/harness) — wie man Evaluierungen ausführt und Run-Cards generiert
- [Evaluierungsdatensätze](/docs/network/leaderboard/datasets) — Datensatzformat, EDTeKLA, FLORES+
- [Eine Methode erstellen](/docs/network/specifications/methods) — die Methodenschnittstelle und die Spezifikation der Method-Card
- [Methoden-Leaderboard](https://champollion.dev/leaderboard) — aktuelle Benchmark-Bewertungen
- [Benchmark-Spezifikation](/docs/network/specifications/benchmark) — Evaluierungsprotokoll, Korpusformat, Run-Card-Schema
- [Scoring-Spezifikation](/docs/network/specifications/scoring) — SSOT für Metriken, Gewichtungen des composite score und Qualitätsstufen
