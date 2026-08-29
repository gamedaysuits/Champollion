---
sidebar_position: 2
title: "Eval Harness v2.0"
related:
  - label: "Scoring Specification"
    to: /docs/network/specifications/scoring
    kind: spec
    note: "What the harness metrics feed into"
  - label: "Statistical Significance Testing"
    to: /docs/network/specifications/significance
    kind: spec
  - label: "Method Interface"
    to: /docs/network/specifications/methods
    kind: spec
  - label: "Run Card Specification"
    to: /docs/network/specifications/run-card
    kind: spec
  - label: "Cookbook: Translate 30 Languages"
    to: https://champollion.dev/docs/tutorials/translate-30-languages
    kind: champollion
    note: "Use the harness to audit registers in production"
---

# Eval Harness v2.0

> **Zusammenfassung.** Diese Seite behandelt Installation, Konfiguration und Verwendung des MT-Evaluations-Harness — des Werkzeugs, das Übersetzungsmethoden anhand standardisierter Korpora bewertet und benotete Run Cards erzeugt. Für die kanonischen Definitionen von Metriken, Schemata und Evaluationsprotokoll siehe die [Benchmark-Spezifikation](/docs/network/specifications/benchmark).

Der Harness führt Übersetzungsexperimente durch und erzeugt Run Cards. Er übernimmt die Prompt-Konstruktion, API-Aufrufe, die Bewertung und die Serialisierung der Ergebnisse — Sie stellen den Datensatz und das Modell bereit.

## Installation

**Voraussetzungen:** Python 3.10+

```bash
pip install mt-eval-harness
```

Dies installiert den Befehl `mt-eval`.

## Verwendung

```bash
mt-eval run --corpus path/to/dataset.json
```

Dies führt jeden Eintrag des Korpus durch das konfigurierte Modell (oder Methoden-Plugin), bewertet die Ausgaben und schreibt eine Run-Card-JSON-Datei in das Ausgabeverzeichnis.

## CLI-Flags

### `mt-eval run`

| Flag | Erforderlich | Standard | Beschreibung |
|------|----------|---------|-------------|
| `--corpus` | ✅ | — | Pfad zur Korpus-Datei (`.json`, `.jsonl`, `.tsv`) |
| `--source-file` / `--reference-file` | — | — | Parallele Textdateien (FLORES+, WMT-Format) |
| `-m, --model` | — | `gemini-pro` | Modell-Slug (Kurzname oder vollständige OpenRouter-ID). Auflösung über `shared/model-aliases.json`. Kommagetrennt für Läufe mit mehreren Modellen |
| `-d, --dataset` | — | `all` | Datensatzfilter: `all`, Segmentname oder ID-Bereich |
| `--ids` | — | — | Kommagetrennte Eintrags-IDs zur Auswertung |
| `--source-lang` | — | `English` | Name der Quellsprache |
| `--target-lang` | — | — | Name der Zielsprache |
| `-p, --prompt` | — | `naive` | Prompt-Version (`naive`, `custom`, `champollion`) |
| `--coaching-file` | — | — | Pfad zur Coaching-Prompt-Textdatei |
| `--coaching` | — | — | Inline-Coaching-Text (Zeichenkette in Anführungszeichen) |
| `--method` | — | — | Pfad zum Methoden-Plugin-Verzeichnis (enthält `method.json` + Python-Modul) |
| `--method-card` | — | — | Pfad zur Methoden-Card-JSON für Leaderboard-Metadaten |
| `--fst-retries` | — | `0` | Anzahl der FST-Wiederholungsversuche (nur Standard-LLM-Methode) |
| `--skip-fst` | — | `false` | Das FST-Qualitätsgate vollständig überspringen |
| `--tools` | — | `false` | Tool-Calling-Modus aktivieren |
| `--tools-list` | — | — | Kommagetrennte Tool-Namen |
| `--max-tool-rounds` | — | `8` | Maximale Tool-Calling-Runden pro Eintrag |
| `--hooks` | — | — | Namen der Nach-Übersetzungs-Hooks |
| `--style-profile` | — | — | Pfad zu einer Stilprofil-JSON. Aktiviert Metriken zur Konsistenz des Schreibstils (informativ — niemals Teil der zusammengesetzten Bewertung; siehe [§ Schreibstil- und Register-Metriken](#writing-style-and-register-metrics-informational)) |
| `-b, --batch-size` | — | `25` | Einträge pro API-Aufruf |
| `-c, --concurrency` | — | `8` | Parallele API-Aufrufe |
| `--max-tokens` | — | `32768` | Maximale Tokens pro API-Aufruf |
| `--temperature` | — | `0.0` | Sampling-Temperatur (0.0 = deterministisch) |
| `--no-cache` | — | `false` | Response-Caching deaktivieren |
| `--cache-dir` | — | `eval/cache/harness` | Pfad zum Cache-Verzeichnis |
| `-o, --output-dir` | — | `eval/logs/harness` | Ausgabeverzeichnis für Run Cards und Logs |
| `-n, --name` | — | — | Menschenlesbarer Name des Laufs |
| `--dry-run` | — | `false` | Konfiguration validieren, ohne API-Aufrufe durchzuführen |
| `--champollion-config` | — | — | Pfad zu `champollion.config.json` |
| `--champollion-cards-dir` | — | — | Verzeichnis der Sprach-Cards |
| `--target-lang-code` | — | — | BCP-47-Sprachcode |

### Jeder Unterbefehl

Alle achtzehn Unterbefehle der obersten Ebene, generiert gegen `mt_eval_harness/cli.py`
am 01.08.2026. Bis dahin listete dieser Abschnitt sieben davon auf, und sechs —
einschließlich `node`, dem souveränen Organizer-Scoring-Knoten — waren
**weder hier noch im Harness-Handbuch** dokumentiert.

**Ausführen und bewerten**

| Unterbefehl | Beschreibung |
|---|---|
| `mt-eval run` | Führt einen Übersetzungsdurchlauf aus (Flags siehe oben) |
| `mt-eval test <log>` | Analysiert ein abgeschlossenes Durchlaufprotokoll |
| `mt-eval compare <logs…>` | Vergleicht mehrere Durchlaufprotokolle |
| `mt-eval dashboard <logs…>` | Generiert ein interaktives HTML-Dashboard |
| `mt-eval card <run-card>` | Gibt eine menschenlesbare Durchlaufkarte formatiert aus (Pretty-Print) |

**Den Weg zu einer Methode finden**

| Unterbefehl | Beschreibung |
|---|---|
| `mt-eval recommend <src> <tgt>` | Methoden-Leitfaden für ein Sprachpaar — Verfügbarkeit plus **zitierte Belege**, kein bloßes Ranking |
| `mt-eval corpora --source X --target Y` | Listet verfügbare Evaluierungskorpora für ein Sprachpaar auf |
| `mt-eval list models\|prompts\|datasets` | Listet verfügbare Ressourcen auf |

**Mitwirken**

| Unterbefehl | Beschreibung |
|---|---|
| `mt-eval publish <report>` | Reicht einen TestReport für das Leaderboard ein |
| `mt-eval queue` | Führt die Spitze der Community-Compute-Warteschlange mit Ihrem eigenen Schlüssel aus — siehe [Rechenleistung beisteuern](/docs/network/getting-started/contributing-compute) |
| `mt-eval export` | Verpackt einen TestReport als Champollion-Methoden-Plugin |
| `mt-eval generate-plugin` | Alias für `export` |
| `mt-eval export-config` | Generiert ein `champollion.config.json`-Snippet aus einem TestReport |

**Wettbewerbe und die Durchführung eines eigenen Wettbewerbs**

| Unterbefehl | Beschreibung |
|---|---|
| `mt-eval contest` | Verwaltet Evaluierungswettbewerbe — `prepare`, `register`, `create`, `submit`, `submit-hypotheses`, `status`, `list` |
| `mt-eval shared-task` | Dach für Multi-Pair Shared-Task-Editionen: Eine Zeile gruppiert die N Wettbewerbe pro Sprachpaar einer Edition im AmericasNLP-Stil und trägt deren Richtlinien-Standardwerte. **Nur Gruppierung und Standardwerte — jedes Gate bleibt pro Wettbewerb bestehen** |
| `mt-eval node` | **Der Organizer-Scoring-Knoten.** Ruft den Eingang ab, prüft die öffentliche Qualifikation (Gate), autorisiert gemäß Wettbewerbsrichtlinie, bewertet gegen **geheime Referenzen des Organisators**, veröffentlicht nur die Ergebnisse. Dies ist der Befehl hinter [Einen souveränen Wettbewerb durchführen](/docs/network/sovereignty/run-a-sovereign-contest) und dem [Souveränen Eval-Knoten](/docs/network/sovereignty/sovereign-eval-node) — das Korpus verlässt niemals den Rechner des Organisators |

`mt-eval node` hat siebzehn eigene Unterbefehle, einschließlich des Airgap-Pfads
(`import-bundle`, `export-scores`, `relay`, `egress-check`, `manifest`) und der
M-von-N-Verwahrungszeremonie (`ceremony`, `seal`, `keygen`, `sign-manifest`,
`verify-manifest`, `ledger`). Führen Sie `mt-eval node --help` aus; die Souveränitätsmechanismen
werden auf den beiden oben verlinkten Seiten beschrieben.

**Einrichtung**

| Unterbefehl | Beschreibung |
|---|---|
| `mt-eval setup` | Installiert optionale Abhängigkeiten (neuronale Metrik COMET, FST-Laufzeitumgebung) |
| `mt-eval logout` | Entfernt gespeicherte Authentifizierungsdaten |

### Beispiele

```bash
# Run with defaults (gemini-pro alias → google/gemini-3.1-pro-preview, naive prompt)
mt-eval run --corpus eval-amh-fra-globalvoices-test-v1

# Coached experiment with coaching file
mt-eval run \
  --corpus eval-amh-fra-globalvoices-test-v1 \
  --model google/gemini-3.1-pro \
  --coaching-file prompts/crk-coaching-v8.txt \
  --temperature 0.0

# Run a custom method plugin with FST retries
mt-eval run \
  --corpus eval-amh-fra-globalvoices-test-v1 \
  --method ./methods/fst-gated-pipeline \
  --fst-retries 3
```

---

## Run-Card-Schema

Jedes Experiment erzeugt eine **Run Card** — ein eigenständiges JSON-Dokument. Die Struktur auf oberster Ebene:

```json
{
  "run_id": "uuid-v4",
  "harness_version": "2.0",
  "model_slug": "google/gemini-3.1-pro",
  "model_id": "gemini-3.1-pro-001",
  "condition": "baseline",
  "timestamp": "2026-06-01T03:22:41Z",
  "elapsed_seconds": 142.7,
  "dataset": { ... },
  "config": { ... },
  "method_card": { ... },
  "system_prompt_sha256": "abc123...",
  "system_prompt_used": "You are a translator...",
  "fingerprint": { ... },
  "scores": { ... },
  "totals": { ... },
  "environment": { ... },
  "results": [ ... ],
  "run_card_hash": "sha256-of-entire-card"
}
```

Das vollständige Schema mit allen dokumentierten Feldern finden Sie in der [Run-Card-Spezifikation](/docs/network/specifications/run-card).

:::info[Maßgebliches Schema]
Die [Benchmark-Spezifikation](/docs/network/specifications/benchmark) ist die einzige verbindliche Quelle für das Run-Card-Schema. Für Metrikdefinitionen, Verbundgewichtungen und Qualitätsstufen siehe die [Scoring-Spezifikation](/docs/network/specifications/scoring). Diese Seite dokumentiert, wie das Harness zu verwenden ist; die Spezifikationen definieren, was die Ausgaben bedeuten.
:::

### Zentrale Blöcke

**`dataset`** — Gibt an, welcher Datensatz verwendet wurde, einschließlich seines Inhalts-Hashes, sodass Ergebnisse an eine bestimmte Version gebunden sind:

```json
// Example using textbook_dev.json — the 436-entry textbook dev split
{
  "id": "edtekla-dev-v1",
  "version": "1.0",
  "language_pair": "EN→CRK",
  "sha256": "...",
  "entry_count": 436
}
```

**`scores`** — Aggregierte Metriken für den Lauf:

```json
// Counts reflect the dataset used (here: textbook_dev.json, 436 entries)
{
  "total": 436,
  "exact_matches": 12,
  "exact_match_rate": 0.0968,
  "fst_accepted": 87,
  "fst_acceptance_rate": 0.7016,
  "chrf_plus_plus": 42.31,
  "errors": 0,
  "avg_latency_seconds": 1.15,
  "median_latency_seconds": 1.02,
  "p95_latency_seconds": 2.34,
  "by_difficulty": { ... },
  "by_provenance": { ... }
}
```

**`totals`** — Token-Verbrauch und Kostenverfolgung:

```json
{
  "prompt_tokens": 48200,
  "completion_tokens": 3100,
  "reasoning_tokens": 0,
  "cached_tokens": 12000,
  "total_cost_usd": 0.42,
  "cost_per_entry_usd": 0.0034,
  "reasoning_ratio": 0.0
}
```

---

## Schreibstil- und Register-Metriken (informativ) {#writing-style-and-register-metrics-informational}

Der Harness kann bewerten, ob Übersetzungen einem Ziel-**Register** und **Schreibstil** entsprechen, über das Metrik-Plugin `WritingStyleConsistency` (`mt_eval_harness/plugins/writing_style.py`). Eine Übersetzung kann sprachlich korrekt sein, aber im falschen Register verfasst — informelle Formulierungen in einem Rechtsdokument, formelle Standardtexte in Marketingtexten — und Zeichenketten-Metriken bemerken dies nicht. Diese Metriken tun es.

**Was gemessen wird (pro Eintrag):**

| Metrik | Skala | Bedeutung |
|--------|-------|---------|
| `style_register_match` | boolean | Entspricht die Ausgabe dem erwarteten Register? Das Ziel stammt aus dem Feld `register` des Korpus-Eintrags (siehe [Benchmark-Spezifikation §2.6](/docs/network/specifications/benchmark)) oder aus einem Stilprofil |
| `style_sentence_length_ratio` | float | Vorhergesagte vs. durchschnittliche Satzlänge der Referenz (1.0 = Übereinstimmung; Abweichung = Stilabweichung) |
| `style_formality_score` | 0.0–1.0 | Vorhandensein von formellen/informellen Markern (T–V-Pronomen, Kontraktionen, …) unter Verwendung sprachspezifischer Marker-Ressourcen |

**Aggregat:** `style_consistency_rate` — der Anteil der Einträge ohne erkannte Register-Abweichung.

Aktivieren Sie ein benutzerdefiniertes Ziel mit `--style-profile path/to/profile.json` (z. B. ein Markenstimmen-Profil); ohne ein solches greift das Plugin auf die `register`-Metadaten jedes Korpus-Eintrags zurück, sofern vorhanden.

:::caution[Ehrliche Einordnung]
Diese Metriken sind **rein informativ** — sie sind niemals Teil der Verbundwertung, und die Formalitätserkennung ist markerbasiert (eine Heuristik), keine erlernte Beurteilung. Betrachten Sie sie als Drift-Detektor für die Einhaltung des Registers, nicht als Urteil über die Stilqualität.
:::

---

## Fingerprint vs. Run-Card-Hash {#fingerprint-vs-run-card-hash}

Der Harness erzeugt zwei unterschiedliche Hashes. Sie dienen verschiedenen Zwecken:

### Fingerprint

Der **Fingerprint** beantwortet: *„Könnte dieser Lauf reproduziert werden?“*

Er hasht die Kombination der Eingaben, die die Experimentkonfiguration definieren — nicht die Ausgaben:

- Datensatz-SHA-256
- Modell-Slug
- Bedingungs-Label
- System-Prompt-SHA-256
- Temperatur
- Harness-Version

Zwei Läufe mit identischen Fingerprints verwendeten dasselbe Setup. Ihre Ergebnisse sollten vergleichbar sein (abgesehen von API-Nichtdeterminismus).

### Run-Card-Hash

Der **Run-Card-Hash** beantwortet: *„Wurde diese spezifische Ergebnisdatei manipuliert?“*

Es ist der SHA-256 der gesamten Run-Card-JSON (ausgenommen das Feld `run_card_hash` selbst). Wenn sich ein beliebiges Feld ändert — eine Bewertung, ein Zeitstempel, eine einzelne Ausgabe — bricht der Hash.

:::info[Wann was verwenden]
Verwenden Sie den **Fingerprint**, um vergleichbare Läufe zu gruppieren (gleiches Experiment, unterschiedliche Ausführungen). Verwenden Sie den **Run-Card-Hash**, um die Integrität einer bestimmten Ergebnisdatei zu überprüfen.
:::

---

## Veröffentlichung im Leaderboard

Nach Abschluss eines Laufs verwenden Sie `mt-eval publish`, um die Run Card zu übermitteln:

```bash
mt-eval publish eval/logs/harness/your-run-card.json
```

Wenn während des Laufs kein `--method-card` bereitgestellt wurde, startet `mt-eval publish` einen interaktiven Assistenten (`method_card_wizard.py`), der Sie durch die Beschreibung Ihrer Methode führt (Name, Klasse, verwendete Tools usw.). Die Ausgabe des Assistenten wird vor der Übermittlung in die Run Card eingebettet.

### Manuelle Inspektion

Run Cards werden als JSON-Dateien im Ausgabeverzeichnis gespeichert (standardmäßig `eval/logs/harness/`) — prüfen Sie sie dort, bevor Sie sie veröffentlichen. `mt-eval publish` ist der Einreichungspfad; es gibt keine PR-basierte Run-Card-Erfassung.

:::note[Die Einreichungs-API und der Web-Upload sind noch nicht verfügbar]
Ein `POST https://champollion.dev/api/leaderboard/submit`-Endpunkt und eine Leaderboard-Upload-Oberfläche sind geplant, aber **noch nicht implementiert**. Bis diese verfügbar sind, ist der einzige funktionierende Einreichungspfad `mt-eval publish`.
:::

:::warning[Leaderboard-Validierung]
Das Leaderboard validiert eingereichte Run Cards gegen das Datensatzregister. Einreichungen, die auf unbekannte Datensätze verweisen oder einen fehlerhaften `run_card_hash` aufweisen, werden abgelehnt.
:::

:::danger[Trainieren Sie NICHT mit Evaluierungsdaten]
Wenn Ihre Methode den Evaluierungsdatensatz während der Entwicklung gesehen hat — als Trainingsdaten, Few-Shot-Beispiele, Wörterbucheinträge oder Prompt-Engineering-Material — wird Ihre Einreichung **disqualifiziert**. Siehe [MT Evaluation](/docs/network/leaderboard/rules) für die Unterscheidung zwischen guten und schlechten Methoden.
:::

---

## Siehe auch

- [MT-Evaluation](/docs/network/leaderboard/rules) — Überblick, Wertversprechen des Leaderboards und Leitfaden für gute/schlechte Methoden
- [Evaluationsdatensätze](/docs/network/leaderboard/datasets) — Datensatzformat, EDTeKLA, FLORES+
- [Run-Card-Spezifikation](/docs/network/specifications/run-card) — das vollständige JSON-Schema
- [Eine Methode erstellen](/docs/network/specifications/methods) — die Methodenschnittstelle zur Erstellung evaluierbarer Methoden
- [Methoden-Leaderboard](https://champollion.dev/leaderboard) — Live-Benchmark-Bewertungen
- [Benchmark-Spezifikation](/docs/network/specifications/benchmark) — Evaluationsprotokoll, Korpusformat, Run-Card-Schema
- [Scoring-Spezifikation](/docs/network/specifications/scoring) — SSOT für Metriken, zusammengesetzte Gewichtungen und Qualitätsstufen
