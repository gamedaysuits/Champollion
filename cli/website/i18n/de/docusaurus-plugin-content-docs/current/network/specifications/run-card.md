---
sidebar_position: 4
title: "Spezifikation der Run Card"
---

# Run-Card-Spezifikation

> **Zusammenfassung.** Die Run-Card ist die atomare Einheit des Benchmarkings — ein JSON-Dokument, das die vollständige Konfiguration, die Ergebnisse pro Eintrag und die aggregierten Bewertungen eines Evaluierungslaufs aufzeichnet. Diese Seite dokumentiert das Schema, die Felder, den Fingerprinting-Mechanismus und die Struktur der Bewertungen. Siehe die [Benchmark-Spezifikation](/docs/network/specifications/benchmark) für die kanonischen Definitionen.

Die Run-Card ist die vollständige Aufzeichnung eines einzelnen Evaluierungslaufs. Sie enthält alles, was zum Verständnis, zur Reproduktion und zur Verifikation des Experiments erforderlich ist: Konfiguration, Bewertungen, einzelne Ergebnisse, Token-Verbrauch und Umgebungs-Metadaten.

**Schema-Version:** 2.0

:::info[Verbindliches Schema]
Die [Benchmark-Spezifikation](/docs/network/specifications/benchmark) ist die alleinige maßgebliche Quelle (Single Source of Truth) für das Run-Card-Schema. Definitionen der Metriken und Informationen dazu, wie Durchläufe bewertet werden (die primäre chrF++-Metrik, die standardmäßigen Nebenmetriken, die Diagnostiken), finden Sie in der [Bewertungsspezifikation](/docs/network/specifications/scoring). Diese Seite dokumentiert die aktuelle Implementierung.
:::

---

## Felder der obersten Ebene

| Feld | Typ | Beschreibung |
|-------|------|-------------|
| `run_id` | `string` | UUID v4, die zu Beginn des Durchlaufs generiert wird |
| `harness_version` | `string` | Semantische Version des Test-Harness, der diese Karte erstellt hat (z. B. `2.0`) |
| `model_slug` | `string` | Für den Durchlauf verwendeter Modell-Slug (z. B. `google/gemini-3.1-pro-preview`) |
| `model_id` | `string` | Von der API zurückgegebener aufgelöster Modellbezeichner (z. B. `gemini-3.1-pro-001`) |
| `condition` | `string` | Experiment-Label: Was der Test-Harness schreibt, ist `naive` (sein integrierter Prompt), `coached` (eine Coaching-Datei hat ihn ersetzt) oder bei einem Methoden-Plugin dessen Methodenklasse; Freitext, daher kann eine manuell erstellte Karte `coached-v3` oder `few-shot` enthalten. Kein Qualitätslabel (Qualitätsstufen wurden eingestellt; `scores.quality_tier` ist auf jeder neuen Karte null) |
| `timestamp` | `string` | ISO-8601-UTC-Zeitstempel für den Beginn des Durchlaufs |
| `elapsed_seconds` | `number` | Reale Gesamtdauer (Wall-Clock-Zeit) des Durchlaufs |

```json
{
  "run_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "harness_version": "2.0",
  "model_slug": "google/gemini-3.1-pro-preview",
  "model_id": "gemini-3.1-pro-001",
  "condition": "naive",
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
| `api_provider` | `string` | Was den Text übertragen hat: der API-Anbieter für den internen LLM-Pfad des Test-Harness (`openrouter`, `openai`, `anthropic`, `gemini`, `local`); die Engine-ID für eine MT-Engine (z. B. `google-translate`); bei einem Methoden-Plugin `local`, wenn der Betreiber einen vollständig lokalen Transport bestätigt hat (`--attest-local-transport`), andernfalls `method-plugin` |
| `temperature` | `number` | Sampling-Temperatur |
| `max_tokens` | `number` | Maximale Token-Anzahl pro Vervollständigung |
| `batch_size` | `number` | Einträge pro gleichzeitigem Batch |
| `concurrency` | `number` | Maximale Anzahl paralleler API-Anfragen |
| `coaching_file` | `string` | Pfad zur Coaching-Prompt-Datei, falls verwendet (der eigene Eintrag des Ausführungsprotokolls; eine veröffentlichte Karte benennt das Coaching nach dem Dateinamen oder `inline coaching` für `--coaching`-Text – niemals ein lokaler Pfad) |
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
    "model": "google/gemini-3.1-pro-preview",
    "temperature": 0.0,
    "batchSize": 25,
    "register": "Formal Plains Cree. Use SRO orthography.",
    "coachingFile": "prompts/crk-coaching-v8.txt",
    "coachingPrompt": null,
    "promptContext": "champollion",
    "qualityTier": null
  }
}
```

`qualityTier` ist auf einer neuen Karte immer `null`: Qualitätsstufen wurden eingestellt. Alle Felder verwenden **camelCase** und folgen dem kanonischen MethodConfig-Schema (siehe [Erstellen einer Methode](/docs/network/specifications/methods)).
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

Die kanonische Liste ist [Benchmark-Spezifikation §3.8](/docs/network/specifications/benchmark#38-fingerprint). Kurz gefasst:

| Komponente | Beschreibung |
|-----------|-------------|
| `dataset_sha256` | Hash der Datensatzdatei |
| `model_slug` | Verwendetes Modell (bei einer MT-Engine oder einem Methoden-Plugin die Engine- oder Methoden-ID) |
| `condition` | Label der Versuchsbedingung |
| `system_prompt_sha256` | Hash des System-Prompts |
| `temperature` | Sampling-Temperatur |
| `batch_size`, `tools_enabled` | Batching und Werkzeugnutzung |
| `harness_version` | Version des Test-Harness |
| `api_provider`, `endpoint_host_sha256`, `max_tokens`, `method_version`, `method_sha256` | Version 2 (Test-Harness 0.2.0 und höher): der Kanal, der Endpunkt-Host (gehasht), das Token-Limit sowie die Version und der Code-Hash der Methode |
| `method_model`, `method_dependencies_sha256` | Version 2, nur bei Durchläufen von Methoden-Plugins: das dem Plugin übergebene Modell (`-m`) und der Hash seiner deklarierten `dependencies` |
| `method_model`, `method_model_sha256` | Version 2, nur bei Durchläufen von `--method local-model`: das geladene Modell (Hugging-Face-ID oder Verzeichnisname) und sein Inhalts-Hash (ein Verzeichnis) oder seine Revision (eine Hugging-Face-ID) |

`fingerprint.version` gibt an, nach welcher Liste eine Karte gehasht wurde.

### `engine_model`

Ein Durchlauf einer MT-Engine, die ein übergebenes Modell ausführt (`--method local-model -m <model>`), enthält das geladene Modell:

| Feld | Beschreibung |
|-------|-------------|
| `given` | Was `-m` zurückgemeldet hat |
| `kind` | `directory` oder `hub` (eine Hugging-Face-ID) |
| `id` | Die Hugging-Face-ID oder der Name des Verzeichnisses (niemals dessen lokaler Pfad) |
| `sha256` | Nur bei einem Verzeichnis: SHA-256 über eine Liste seiner Dateien im `sha256sum`-Stil |
| `revision` | Nur bei einer Hugging-Face-ID: die geladene Revision |
| `family`, `backend` | `opus`, `nllb` oder `madlad`; `transformers` oder `ctranslate2` |
| `decode` | Wie lang Ausgaben sein durften: die vom Modell deklarierte Länge oder die Harness-Regel (`max(64, 4 × source tokens)` neue Token, begrenzt durch die Positionen des Decoders) |
| `pair_mismatch` | Nur vorhanden, wenn ein OPUS-MT-Paarmodell für ein anderes Paar absichtlich ausgeführt wurde (`--allow-model-pair-mismatch`) |

`method_config.model` nennt dasselbe Modell (`<id>@<revision>` oder `<directory name>@sha256:<hash>`). Ein `local-model`-Ausführungsprotokoll, das kein Modell aufgezeichnet hat, veröffentlicht nichts: Die Karte enthält `engine_model_unrecorded` und `mt-eval publish` lehnt sie ab.

### `method_plugin`

Ein Durchlauf eines Methoden-Plugins (`--method <plugin dir>`) enthält zudem die Angaben zur Identifizierung des Plugins, so wie der Runner sie aufgezeichnet hat:

| Feld | Beschreibung |
|-------|-------------|
| `version` | Die von `method.json` deklarierte Version (`null`, falls keine deklariert ist) |
| `code_sha256` | SHA-256 über die Dateien des Plugins (`method.json` und seine `.py`-Dateien, ein Manifest im `sha256sum`-Stil) |
| `model_given` | Das dem Plugin mit `-m/--model` übergebene Modell oder `null` |
| `models_called`, `models_basis` | Das Modell bzw. die Modelle, deren Aufruf das Plugin gemeldet hat, und ob dies anhand der Ergebnisse beobachtet oder deklariert wurde |
| `dependency_class` | Die von `method.json` deklarierte Abhängigkeitsklasse |
| `dependencies` | Die von `dependencies` deklarierte `method.json`-Liste ohne den Freitext `notes` |
| `dependencies_sha256` | SHA-256 der vollständigen deklarierten Liste (die Fingerabdruck-Komponente) |

```json
{
  "fingerprint": {
    "hash": "7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069",
    "components": {
      "dataset_sha256": "e3b0c44298fc1c14...",
      "model_slug": "google/gemini-3.1-pro-preview",
      "condition": "naive",
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
| `total` | `number` | Gesamtzahl der bewerteten Einträge |
| `exact_matches` | `number` | Einträge, bei denen die Ausgabe exakt mit dem Goldstandard übereinstimmte |
| `exact_match_rate` | `number` | `exact_matches / total` (0,0–1,0) |
| `fst_accepted` | `number` | Vom FST-Analysator akzeptierte Ausgabe-**Wörter**, summiert über alle Einträge (keine Zählung von Einträgen). `null`, falls kein FST-Analysator verwendet wurde |
| `fst_acceptance_rate` | `number` | Mittelwert der Akzeptanzraten pro Eintrag (akzeptierte Wörter jedes Eintrags ÷ dessen Wörter; eine leere Ausgabe zählt als 0), 0,0–1,0. Es ist **nicht** `fst_accepted` ÷ alle Wörter – diese zusammengefasste Wortrate ist `corpus_validity_rate` des Berichts, auf der Run Card dargestellt als „Words accepted“. `null`, falls kein FST-Analysator verwendet wurde |
| `chrf_plus_plus` | `number` | **Die primäre und für das Ranking maßgebliche Metrik:** chrF++ auf Korpusebene (sacreBLEU chrF, `word_order=2`), 0–100. Ihr 95%-Bootstrap-KI ist `confidence_intervals.corpus_chrf` und ihre Signatur `sacrebleu_signatures.chrf` |
| `scoring_standard` | `string` | `"standard/1"` auf jeder neuen Karte. Eine Karte ohne dieses Feld wurde nach dem eingestellten zusammengesetzten Wert (`legacy-composite`) bewertet und wird auf diese Weise verifiziert |
| `primary_metric` | `string` | `"chrf_plus_plus"` |
| `spbleu`, `ter` | `number` | Neben chrF++ angezeigte Standardmetriken, niemals kombiniert (BLEU ist das `corpus_bleu` der obersten Ebene der Karte; COMET ist `comet_score` mit `comet_model`, falls berechnet) |
| `sacrebleu_signatures` | `object` | Die sacreBLEU-Signatur jeder berechneten sacreBLEU-Metrik: `chrf` (die primäre Metrik), `chrf_plain`, `bleu`, `spbleu`, `ter` |
| `confidence_intervals` | `object` | 95%-Bootstrap-Intervalle; `corpus_chrf` ist das der primären Metrik |
| `composite`, `quality_tier`, `cost_adjusted` | `null` | **Eingestellt.** Auf einer neuen Karte immer `null`. Eine ältere Karte behält ihre gespeicherten Werte; eine Oberfläche, die diesen zusammengesetzten Wert noch anzeigt, kennzeichnet ihn als „legacy composite (retired)“ |
| `errors` | `number` | Einträge, die fehlgeschlagen sind (API-Fehler, Zeitüberschreitung usw.) |
| `avg_latency_seconds` | `number` | Durchschnittliche Antwortzeit über alle Einträge hinweg |
| `median_latency_seconds` | `number` | Mediane Antwortzeit |
| `p95_latency_seconds` | `number` | 95. Perzentil der Antwortzeit |

### `by_difficulty`

Ergebnisse aufgeschlüsselt nach Schwierigkeitsstufe, indexiert nach Stufe (`"1"`–`"5"`, `"0"` für nicht bewertete). Die Felder sind **nicht** die der obersten Ebene: `avg_chrf` und `avg_bleu` sind der **Mittelwert der satzweisen** chrF++- und BLEU-Werte über die Einträge der Stufe, während die Werte für `chrf_plus_plus` und BLEU der obersten Ebene **auf Korpusebene** erhoben werden (über alle Segmente gleichzeitig berechnet). Es handelt sich um zwei unterschiedliche Statistiken: Insbesondere Korpus-BLEU liegt gewöhnlich weit unter dem Mittelwert von Satz-BLEU, sodass ein primärer Wert von 0,5 neben einem Stufenwert von 10,2 kein Widerspruch ist. Vergleichen Sie Stufen untereinander, niemals mit dem primären Wert.

```json
{
  "by_difficulty": {
    "1": {
      "name": "difficulty_1",
      "count": 20,
      "exact_match_count": 8,
      "miss_count": 12,
      "error_count": 0,
      "avg_chrf": 68.2,
      "avg_bleu": 31.5,
      "avg_latency_s": 0.84,
      "total_cost_usd": 0.0021,
      "plugin_aggregates": {}
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

## `score_caveats`

Nur vorhanden, wenn die Aussagekraft der Werte durch bestimmte Faktoren eingeschränkt ist. Ein Wert kann korrekt berechnet worden sein und dennoch nicht das messen, was seine Bezeichnung suggeriert; daher wird die Einschränkung zusammen mit dem Zahlenwert weitergegeben: `mt-eval test`, `mt-eval card`, `mt-eval compare`, das Dashboard und die `mt-eval publish`-Vorschau geben sie neben dem primären Wert aus, und `publish` speichert sie hier für die Anzeige in der Bestenliste. Sie ändert niemals einen Wert: Die primäre chrF++-Metrik wird wie gewohnt berechnet, und der Hinweis erläutert, was sie oder eine danebenstehende Diagnosemetrik einschränkt.

| Feld | Typ | Beschreibung |
|-------|------|-------------|
| `kind` | `string` | `train_test_near_twin`, `length_inflation`, `length_deflation`, `source_copy` oder `near_constant_output` |
| `source` | `string` | Wer es gemessen hat: `nmt-forge` oder `mt-eval-harness` |
| `severity` | `string` | `major` (interpretieren Sie den primären Wert vor diesem Hintergrund) oder `minor` |
| `message` | `string` | Ein Satz, maximal 480 Zeichen |

**`train_test_near_twin`**, geschrieben von nmt-forge. Wenn `nmt-forge export` (oder `evaluate`) ein Modell bewertet, prüft es jede Testzeile auf ein nahezu identisches Gegenstück in den Trainingsdaten und erfasst das Ergebnis in den generierten mt-eval-Dateien. Der Test-Harness überträgt diesen Messwert auf die Karte: `near_twin_rows` von `n` Testzeilen haben ein Gegenstück (`near_twin_share`), und `strict_n` Zeilen haben keines. Gibt es davon ausreichend viele, liefern `strict_corpus_chrf` und `strict_corpus_chrf_ci` den chrF++-Wert ausschließlich für diese Zeilen, welcher den Generalisierungsgrad widerspiegelt. `recall_not_translation` ist `true`, wenn mindestens die Hälfte der Zeilen ein Gegenstück aufweist. In diesem Fall misst selbst ein chrF++-Wert von 100 lediglich, wie gut sich das Modell an Trainingsphrasen erinnert, nicht aber seine Übersetzungsqualität. Wurde die forge-Prüfung nicht ausgeführt, lautet der Hinweis `minor` und weist darauf hin. Ergibt die Prüfung kein Gegenstück, wird kein Hinweis hinzugefügt.

**`length_inflation`**, gemessen durch den Test-Harness. Wird hinzugefügt, wenn Ausgaben im Durchschnitt mehr als das Doppelte ihrer Referenzlänge betragen (die Inflationsgrenze von [`length_ratio`](/docs/network/specifications/scoring)), oder wenn dies auf mindestens ein Viertel der bewerteten Einträge zutrifft. Durchgesickerte Few-Shot-Beispiele, Notizen oder wiederholter Text blähen die Ausgaben auf, was sich dann in den referenzbasierten Werten niederschlägt. Die Felder sind `mean_length_ratio`, `inflated_entries` von `scored_entries`, `ratio_bound` und `share_bound`.

**`length_deflation`**, gemessen durch den Test-Harness. Es ist das Gegenstück zu `length_inflation`: Ausgaben, die deutlich **kürzer** als ihre Referenzen sind, sodass Wörter ausgelassen wurden. Wird hinzugefügt, wenn Ausgaben im Durchschnitt weniger als die Hälfte ihrer Referenzlänge betragen (die Kürzungs- bzw. Truncation-Grenze von [`length_ratio`](/docs/network/specifications/scoring)), oder wenn dies auf mindestens ein Viertel der bewerteten Einträge zutrifft. Einige Diagnosemetriken bewerten ausschließlich die Wörter, die eine Ausgabe tatsächlich enthält: FST-Akzeptanz und Code-Switching. Ein System, das unübersetzbare Teile einfach verwirft, erzielt bei diesen Metriken bessere Werte. Wenn der Durchlauf eine dieser Metriken enthält, lautet der Hinweis `major` und empfiehlt, diese Werte im Vergleich zu Durchläufen, die alles übersetzen, nicht als Qualitätsmaßstab zu betrachten. Der primäre chrF++-Wert gewichtet den Recall, erfasst also die fehlenden Wörter. Ist keine der beiden Metriken vorhanden (nur chrF++ und exakte Übereinstimmung), handelt es sich um eine `minor`-Anmerkung. Die Felder sind `mean_length_ratio`, `short_entries` von `scored_entries`, `ratio_bound`, `share_bound` und `emitted_only_metrics`.

**`source_copy`**, gemessen durch den Test-Harness. Wird hinzugefügt, wenn mindestens die Hälfte der bewerteten Ausgaben Kopien ihrer Quelle sind (Groß-/Kleinschreibung, Akzente und Zeichensetzung ignoriert). Zeilen, deren Referenz der Quelle selbst entspricht, wie etwa Namen, werden ausgeschlossen. Metriken, die keinen Abgleich mit der Referenz durchführen, können kopierte Wörter dennoch positiv werten. Die Felder sind `copies` von `considered_entries`, `copy_share` und `share_bound`.

**`near_constant_output`**, gemessen durch den Test-Harness. Eine einzelne Ausgabe wurde für viele *verschiedene* Eingaben erzeugt. Ausgaben und Quellen werden ohne Berücksichtigung von Groß-/Kleinschreibung, Zeichensetzung und Leerzeichen verglichen; diakritische Zeichen werden berücksichtigt, da sie bei zwei Ausgaben zur Unterscheidung von Wörtern dienen. Eine Ausgabe gilt als quellenübergreifende Wiederholung, wenn mindestens 3 verschiedene Quellen zu ihr führten (5 bei Ausgaben aus nur einem oder zwei Wörtern, da kurze Antworten legitimerweise wiederkehren). Eine Ausgabe, die ihrer eigenen Referenz entspricht, ist eine korrekte Antwort und wird nicht mitgezählt. Der Hinweis wird hinzugefügt, wenn Wiederholungen mindestens ein Viertel der verschiedenen Quellen und mindestens 5 davon abdecken. Er lautet stets `major`. Enthält der Durchlauf eine Metrik, die eine Ausgabe ohne deren Referenz bewertet (FST-Akzeptanz, Code-Switching), nennt die Meldung diese Metrik: Eine solche Metrik honoriert einen gültigen Satz bei jedem Auftreten. Die Felder sind `repeated_sources` von `considered_sources`, `repeat_share`, `repeated_outputs`, `top_output_sources` und `top_output_words` (die am häufigsten wiederholte Ausgabe: von wie vielen Quellen sie erzeugt wurde und ihre Länge), `share_bound`, `min_repeats`, `min_sources`, `min_sources_short` und `emitted_only_metrics`. Es handelt sich ausschließlich um Anzahlen: Der Hinweis enthält niemals den Text einer Ausgabe.

```json
"score_caveats": [
  {
    "kind": "train_test_near_twin",
    "source": "nmt-forge",
    "severity": "major",
    "checked": true,
    "recall_not_translation": true,
    "near_twin_rows": 150,
    "n": 150,
    "near_twin_share": 1.0,
    "strict_n": 0,
    "message": "all 150 test rows have a near-identical twin in the training data — there is no clean subset to score: this score measures recall of training phrases, not translation"
  }
]
```

Das Feld befindet sich innerhalb des gespeicherten JSON-Objekts der Run Card, sodass keine Datenbankspalte erforderlich ist. Es ist nicht Teil des [Fingerabdrucks](#fingerprint): Es beschreibt das Ergebnis, nicht das Experiment.

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

- [MT-Bewertung](/docs/network/leaderboard/rules) – Übersicht, Bestenlisten-Werte und Richtlinien für gute/schlechte Methoden
- [Eval-Harness](/docs/network/specifications/harness) – Durchführen von Bewertungen und Erstellen von Run Cards
- [Evaluierungsdatensätze](/docs/network/leaderboard/datasets) – Datensatzformat, EDTeKLA, FLORES+
- [Erstellen einer Methode](/docs/network/specifications/methods) – Die Methodenschnittstelle und Method-Card-Spezifikation
- [Methoden-Bestenliste](https://champollion.dev/leaderboard) – Live-Benchmark-Ergebnisse
- [Benchmark-Spezifikation](/docs/network/specifications/benchmark) – Evaluierungsprotokoll, Korpusformat, Run-Card-Schema
- [Bewertungsspezifikation](/docs/network/specifications/scoring) – Verbindliche Quelle (SSOT) für Metriken und die Bewertung von Durchläufen
