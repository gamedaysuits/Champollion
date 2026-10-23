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
    to: https://champollion.dev/docs/getting-started/configuration
    kind: champollion
    note: "Use the harness to audit registers in production"
---

# Eval Harness v2.0

> **Zusammenfassung.** Diese Seite behandelt Installation, Konfiguration und Verwendung des MT-Evaluations-Harness — des Werkzeugs, das Übersetzungsmethoden anhand standardisierter Korpora bewertet und benotete Run Cards erzeugt. Für die kanonischen Definitionen von Metriken, Schemata und Evaluationsprotokoll siehe die [Benchmark-Spezifikation](/docs/network/specifications/benchmark).

Der Harness führt Übersetzungsexperimente durch und erzeugt Run Cards. Er übernimmt die Prompt-Konstruktion, API-Aufrufe, die Bewertung und die Serialisierung der Ergebnisse — Sie stellen den Datensatz und das Modell bereit.

## Installation

**Voraussetzungen:** Python 3.11+

```bash
python3 -m pip install mt-eval-harness
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
|------|--------------|----------|--------------|
| `--corpus` | ✅ | — | Pfad zur Korpusdatei (`.json`, `.jsonl`, `.tsv`) |
| `--source-file` / `--reference-file` | — | — | Parallele Textdateien (FLORES+-, WMT-Format) |
| `-m, --model` | — | `google/gemini-3.1-pro-preview` | Exakter Modell-Slug: die vollständige OpenRouter-ID oder der eigene, exakte Name eines direkten Anbieters. Keine Aliase und keine dynamischen IDs (`~vendor/…`, `…-latest`): Ein Kurzname wie `gemini-pro` wird abgewiesen, und die Abweisung nennt den anzugebenden Slug. Kommagetrennt für Läufe mit mehreren Modellen. Bei `--method local-model` ist dies das auszuführende Modell – eine Hugging-Face-ID oder ein Modellverzeichnis – und es ist erforderlich: diese Engine hat kein Standardmodell. Bei einem Methoden-Plugin wird es als `config.method_model` an das Plugin übergeben. Jede andere MÜ-Engine übersetzt mit ihrem eigenen Modell und der Lauf meldet, dass `-m` ungenutzt bleibt |
| `-d, --dataset` | — | `all` | Datensatzfilter: `all`, Segmentname oder ID-Bereich |
| `--ids` | — | — | Kommagetrennte Eintrags-IDs zur Evaluierung |
| `--source-lang` | — | `English` | Name der Ausgangssprache |
| `--target-lang` | — | — | Name der Zielsprache, wie im Prompt angegeben. Ein hier angegebener Code (`sme`) wird anhand seiner Sprachkarte benannt („Nordsamisch“), und der Lauf-Header weist darauf hin; ein Code, den keine Karte nennt (ein privat genutzter `qaa`), bleibt ein Code, mit einer Warnung, dass der Prompt ihn enthalten wird |
| `-p, --prompt` | — | `naive` | Prompt-Version (`naive`, `custom`, `champollion`) |
| `--coaching-file` | — | — | Pfad zur Textdatei des Coaching-Prompts. Sie **ersetzt** den integrierten Prompt: Das Modell erhält die Datei unverändert (plus die `--target-script`-Zeile), nicht die integrierte Anweisung „Translate the given … text to …; output only the translation“. Der Probelauf und der Lauf-Header teilen dies in einem Urteil mit: ✓, wenn die Datei die Zielsprache nennt (und unter welchem Namen oder Code), ⚠, wenn sie weder die Sprache noch ihren Code nennt, oder nicht geprüft, wenn weder Name noch Code bekannt ist |
| `--glossary` | — | — | Evaluierungsglossar (JSON) für Terminologietreue; dient nur der Bewertung, wird niemals an das Modell gesendet |
| `--coaching` | — | — | Inline-Coaching-Text (Zeichenkette in Anführungszeichen) |
| `--method` | — | — | Pfad zum Methoden-Plugin-Verzeichnis (enthält `method.json` + Python-Modul) oder eine registrierte MÜ-Engine (`google-translate`, `deepl`, `local-model`, …) |
| `--allow-model-pair-mismatch` | — | `false` | Mit `--method local-model`: Führt ein OPUS-MT-Paarmodell aus, dessen ID ein anderes Paar als das des Korpus nennt (`opus-mt-en-fi` auf einem `eng>sme`-Korpus, als Baseline für verwandte Sprachen). Ohne diese Angabe abgewiesen; die Laufkarte zeichnet dies auf |
| `--method-card` | — | — | Pfad zur Methodenkarte (JSON) für Bestenlisten-Metadaten |
| `--skip-fst` | — | `false` | Bewerten ohne FST-Akzeptanz, selbst wenn die Sprache über einen FST verfügt, ohne weitere Meldungen dazu. Die Laufkarte markiert dies als nicht berechnet. Ohne dieses Flag stoppt ein fehlender FST (der Analysator oder seine pyhfst-Laufzeitumgebung) den Lauf ebenfalls nicht: Er wird fortgesetzt, die Laufkarte markiert FST-Akzeptanz und Morphologie als nicht berechnet, und der Hinweis nennt `mt-eval setup --lang <code>`. Nach dieser Installation fügt `mt-eval test <run log>` das FST-Ergebnis dem abgeschlossenen Lauf hinzu, ohne erneut zu übersetzen. Es wird nichts automatisch heruntergeladen |
| `--skip-eval-standard` | — | `false` | Bewerten ohne die standardmäßigen Evaluierungsmetriken der Sprachkarte (ein externes Paket). Die Laufkarte markiert sie als nicht berechnet. Ohne dieses Flag werden die Metriken eines installierten Pakets berechnet; ein nicht installiertes Paket ist ein optionales Add-on – der Lauf wird ohne dessen Metriken fortgesetzt (als nicht berechnet markiert) und nennt die von der Karte deklarierte `python3 -m pip install`. Bei einem Lauf wird nichts installiert |
| `--tools` | — | `false` | Tool-Calling-Modus aktivieren |
| `--tools-list` | — | — | Kommagetrennte Tool-Namen |
| `--max-tool-rounds` | — | `8` | Maximale Tool-Calling-Runden pro Eintrag |
| `--style-profile` | — | — | Pfad zu einem Stilprofil (JSON). Aktiviert Metriken zur Konsistenz des Schreibstils (Diagnose – niemals Teil des Hauptwerts; siehe [§ Metriken für Schreibstil und Register](#writing-style-and-register-metrics-informational)) |
| `-b, --batch-size` | — | `25` | Einträge pro API-Aufruf |
| `-c, --concurrency` | — | `8` | Parallele API-Aufrufe |
| `--max-tokens` | — | `32768` | Maximale Tokenanzahl pro API-Aufruf |
| `--temperature` | — | `0.0` | Sampling-Temperatur (0,0 = deterministisch) |
| `--no-cache` | — | `false` | Antwort-Caching deaktivieren |
| `--cache-dir` | — | `eval/cache/harness` | Pfad zum Cache-Verzeichnis (siehe [Der Übersetzungscache](#the-translation-cache)) |
| `--metricx` | — | `false` | Berechnet zusätzlich MetricX-24 (Google, Apache-2.0), einen neuronalen Fehlerscore (0–25, niedrigere Werte sind besser), der neben dem chrF++-Hauptwert ausgewiesen und niemals mit ihm vermischt wird. Erfordert das Extra `metricx` und Googles Modellcode (siehe [Optionale neuronale Metriken](#opt-in-neural-metrics)) |
| `--metricx-model` | — | `google/metricx-24-hybrid-large-v2p6` | Mit `--metricx`: Ein anderer MetricX-Checkpoint (ein xl/xxl-Checkpoint oder ein `google/metricx-25-*`-Checkpoint) |
| `--fuse` | — | `false` | Berechnet zusätzlich den Komparator im FUSE-Stil, eine untrainierte Neuimplementierung des AmericasNLP-2025-FUSE-Ansatzes, der als diagnostischer Komparator berichtet wird, niemals im Hauptwert. Erfordert das Extra `fuse` (siehe [Optionale neuronale Metriken](#opt-in-neural-metrics)) |
| `-o, --output-dir` | — | `eval/logs/harness` | Ausgabeverzeichnis für Laufkarten und Protokolle |
| `-n, --name` | — | — | Für Menschen lesbarer Laufname |
| `--dry-run` | — | `false` | Validiert Konfiguration und Korpus, ohne API-Aufrufe durchzuführen. Nennt die Coaching-Datei und das Glossar, die der Lauf verwenden würde (oder `none`), zeigt den Prompt (den integrierten vollständig; eine Coaching-Datei anhand ihrer ersten Zeile und sha256, sowie den Hinweis, dass sie den integrierten ersetzt), gibt an, wo sich der Übersetzungscache befindet, und führt dieselbe eval-pack-Prüfung wie der reale Lauf durch, wobei die Ausgabe in Zeilen erfolgt, die mit `EVAL PACK:` beginnen (`ready (…)`, `missing — <pieces>; …` oder `none needed for <language>`), ohne abzubrechen. Eine zweite Zeile gibt an, ob der reale Lauf stoppen würde: Ein fehlender FST stoppt ihn nie, während jeder andere fehlende Bestandteil dies tut. Unter `--json` enthält die Zusammenfassung `coaching_file`, `prompt` (dessen Art, sha256 und Länge; den Text des integrierten Prompts), `glossary_file` und `eval_pack` (`status`, `missing`, `setup_command`, `blocks_run`, `advisory`) |
| `--target-lang-code` | — | — | BCP-47-Sprachcode |
| `--target-script` | — | — | Die ISO-15924-Schrift, in der die Übersetzungen verfasst sein müssen (`Latn`, `Cans`, …), wie sie in der Sprachkarte des Ziels aufgeführt ist. Der Prompt des Testumfelds fordert diese an (auch an den Text einer Coaching-Datei angehängt), sodass sie Teil der sha256 des Prompts ist. Verwenden Sie bei einer Sprache, die in mehr als einer Schrift geschrieben wird, wie z. B. Plains Cree, die Schrift, in der Ihre Referenzen verfasst sind. Ohne diese Angabe zählt das Testumfeld die Buchstaben der Referenzen nach Schrift (aggregiert: es wird kein Satz angezeigt, dies gilt also auch für einen rein lokalen Korpus) und fordert die Schrift an, auf die 90 % oder mehr entfallen, was im Lauf-Header angegeben („references are 100% Latn → prompting for Latn“) und im Laufprotokoll festgehalten wird (`config.target_script_source`); gemischte Referenzen erhalten keine Schriftangabe und eine Warnung mit den Anteilen, und eine Referenz in der anderen Schrift erzielt dann eine Punktzahl nahe null. Wird für eine MÜ-Engine oder ein Methoden-Plugin abgelehnt, da diese keinen Prompt erhalten |

`--champollion-config` und `--prompt champollion` wurden in Version 0.2.0 eingestellt und werden unter Angabe des Grundes abgelehnt. Dasselbe gilt für `--champollion-cards-dir`; setzen Sie `MT_EVAL_CARDS_DIR`, um das Test-Harness auf ein anderes Kartenverzeichnis zu verweisen. Sie hatten den Prompt der CLI in Python nachgebildet, und diese Kopie war vom Stand der CLI abgewichen. Verwenden Sie ein Methoden-Plugin (`--method`), um eine CLI-Methode zu evaluieren, und `mt-eval export-config`, um ein Ergebnis in ein CLI-Projekt zurückzuführen.

### Optionale neuronale Metriken

COMET wird berechnet, sobald `unbabel-comet` installiert ist (`mt-eval setup --comet`: ca. 300 MB für die Installation und ca. 2,3 GB Modellgröße bei der ersten Nutzung). Zwei weitere Metriken sind standardmäßig deaktiviert, sofern ein Durchlauf sie nicht explizit anfordert, da jede davon ein großes Modell lädt. Wie COMET laufen sie lokal auf diesem Computer (keine API-Kosten, kein Textversand), werden neben dem chrF++-Hauptergebnis ausgewiesen und niemals damit verrechnet; die Durchlaufkarte vermerkt "not run" samt dem anzugebenden Flag, wenn sie nicht angefordert wurden.

| Metrik | Flag | Voraussetzungen | Ressourcenbedarf |
|--------|------|-----------------|------------------|
| MetricX-24 (`metricx_score`, niedriger ist besser, 0–25) | `--metricx` (Checkpoint: `--metricx-model`) | `python3 -m pip install 'mt-eval-harness[metricx]'` (PyTorch, Transformers, SentencePiece) und Googles Modellcode, der nicht auf PyPI verfügbar ist: `python3 -m pip install git+https://github.com/google-research/metricx` | Der standardmäßige Checkpoint `google/metricx-24-hybrid-large-v2p6` und der mT5-XL-Tokenizer laden bei der ersten Verwendung mehrere Gigabyte von Hugging Face herunter; die Auswertung ist auf einer CPU langsam. Ohne Referenz erfolgt die Bewertung im referenzfreien Modus (QE-Modus) |
| Komparator im FUSE-Stil (`fuse_score`) | `--fuse` | `python3 -m pip install 'mt-eval-harness[fuse]'` (sentence-transformers, jellyfish) | LaBSE lädt bei der ersten Verwendung etwa 1,8 GB herunter. Ohne LaBSE wird das Ergebnis nicht berechnet und der Bericht weist darauf hin. Das Modell ist untrainiert (ein ungewichter Mittelwert seiner Komponenten) und das Ergebnis wird als `fuse_untrained` gekennzeichnet |

Über MCP (das vollständige Profil, `--profile full`) akzeptiert `run_benchmark` `metricx` (mit `metricx_model`) und `fuse`, und `comet: true` erfordert COMET; sein Plan gibt an, ob das jeweilige Element installiert ist, und ein bestätigter Lauf, der etwas anfordert, was das Testumfeld nicht berechnen kann, wird abgelehnt.

Was die einzelnen Metriken messen und inwieweit ihnen für eine bestimmte Sprache vertraut werden kann, ist unter [Scoring](/docs/network/specifications/scoring) und [Metrik-Zuverlässigkeit](/docs/network/specifications/metric-reliability) beschrieben.

### Der Übersetzungscache

Jeder Durchlauf speichert die Ausgabe des Modells für jeden Ausgangssatz in einem Cache (`--cache-dir`, standardmäßig `eval/cache/harness` unterhalb des Verzeichnisses, in dem der Durchlauf gestartet wird), sodass ein erneuter Durchlauf mit identischer Konfiguration diese kostenlos wiederverwendet. Der Cache-Schlüssel umfasst das Modell, den gesendeten Prompt (dessen SHA-256), die Einstellungen, die Ausgaben beeinflussen, sowie die Version des Test-Harness. Bei einer Änderung an einem dieser Faktoren wird somit niemals eine veraltete Ausgabe geliefert. Der Cache enthält Kopien der Sätze des Korpus:

- Der Durchlauf-Header und der Probedurchlauf (Dry Run) geben aus, wo er sich befindet und wie viele Einträge er enthält;
- Der Ordner enthält eine `.gitignore`-Datei, sodass Git ihn ignoriert;
- Er wird niemals in einen Ordner `mt-eval contest prepare` geschrieben, der als freigabefähig markiert ist (dessen `public/`): `mt-eval run` weist ein solches `--cache-dir` oder `--output-dir` zurück und verweist stattdessen auf den Ordner `runs/` des Wettbewerbs ([Einen souveränen Wettbewerb durchführen](/docs/network/sovereignty/run-a-sovereign-contest));
- Ein rein lokaler, versiegelter oder zustimmungspflichtiger Korpus erhält einen eigenen `protected/<namespace>/`-Ordner, der über die Einstellungen des Durchlaufs, den SHA-256-Wert des Korpus und dessen Nutzungsbedingungen identifiziert wird; jede Datei dort trägt die Kennzeichnung des Korpus in einer `<file>.champollion.json`-Begleitdatei ([Korpora registrieren](/docs/network/sovereignty/registering-corpora));
- Löschen Sie den Ordner, um die Kopien zu entfernen, oder übergeben Sie `--no-cache`, um keine Zwischenspeicherung vorzunehmen.

Der MCP-Server `run_benchmark` (vollständiges Profil) nennt den Cache in seinem Plan und seinem Ergebnis. Bei einer Datei, die Sie vorhalten, legt er den Cache neben den Ergebnissen des Laufs ab (`<corpus folder>/results/cache/`), und bei einer registrierten Korpus-ID in einem eigenen Ordner (`~/.champollion-mcp/cache/harness/`). Ein Cache, der sich aus früheren Läufen bereits in `eval/cache/harness` unter dem Arbeitsverzeichnis des Servers befindet, wird weiterhin verwendet, sodass dessen Ausgaben nicht doppelt bezahlt werden. Seine Einträge hängen nicht davon ab, wo sich der Ordner befindet, er kann also verschoben werden.

### Alle Unterbefehle

Alle zwanzig Unterbefehle der obersten Ebene. Jedes Flag von jedem einzelnen davon ist in der
generierten [`mt-eval`-Befehlsreferenz](/docs/reference/mt-eval) aufgeführt; dieser Abschnitt
beschreibt, wozu die einzelnen Befehle dienen.

**Ausführen und Bewerten**

| Unterbefehl | Funktion |
|---|---|
| `mt-eval run` | Übersetzungslauf ausführen (Flags siehe oben) |
| `mt-eval test <log>` | Protokoll eines abgeschlossenen Durchlaufs analysieren. `-o <path>` schreibt den Bericht an einen anderen Ort als `<log>_report.json`, und das Durchlaufprotokoll zeichnet diesen Pfad auf, damit `card` und `compare` ihn finden. `--glossary <file>` bewertet die Terminologie anhand dieses Glossars; der Bericht erfasst dessen Namen und SHA-256, und die Karte, `compare` sowie die Veröffentlichungsvorschau geben an, anhand welchen Glossars die Terminologietreue (eine Diagnose) bewertet wurde |
| `mt-eval compare <reports…>` | Zwei oder mehr Durchläufe vergleichen (`*_report.json` oder Durchlaufprotokolle). Eine Zeile pro Metrik (chrF++, BLEU, spBLEU, TER, …), eine Spalte pro Durchlauf mit den Buchstaben A, B, C…, Metriken mit "niedriger ist besser" markiert; `--significance` fügt paarweise Tests für jedes Paar hinzu, jede Tabelle benannt nach den Buchstaben der Durchläufe, mit dem 95%-Konfidenzintervall für Δ, und weist darauf hin, dass die p-Werte pro Metrik und unkorrigiert sind; `--method paired_bootstrap` ersetzt die standardmäßige approximative Randomisierung durch das Bootstrap-Verfahren nach Koehn ([Signifikanz](/docs/network/specifications/significance)). Schreibt `comparison-<hash>.json` (den Hash der IDs der verglichenen Durchläufe, damit ein weiterer Vergleich ihn niemals überschreibt) neben die Berichte, wenn sie sich im selben Ordner befinden, andernfalls in `comparisons/` im nächstgelegenen gemeinsamen Ordner (niemals in den eigenen Ordner eines einzelnen Durchlaufs), es sei denn, `-o` gibt eine Datei an. Der chrF++-Test allein entscheidet, welcher Durchlauf besser ist; die anderen Zeilen werden angezeigt, fließen aber nicht in die Entscheidung ein. Der zusammengesetzte Wert eines veralteten Berichts wird als eingestellt deklariert und nicht verglichen |
| `mt-eval dashboard <logs…>` | Interaktives HTML-Dashboard generieren |
| `mt-eval card <run log>` | Formatierte, visuell aufbereitete Ausgabe einer Durchlaufkarte. Die Bewertungen stammen aus dem Bericht des Durchlaufs: neben dem Protokoll, wo `mt-eval test -o` ihn erfasst hat, oder unter `--report <path>`. Ein Durchlauf ohne gefundenen Bericht zeigt NICHT BEWERTET und den durchsuchten Ort an, niemals Nullen. Eine Berichtsdatei kann ebenfalls übergeben werden; sie wird zusammen mit dem darin erfassten Durchlaufprotokoll eingelesen |

**Eine Methode in Betrieb nehmen** (nichts wird bewertet)

| Unterbefehl | Funktion |
|---|---|
| `mt-eval translate` | Übersetzt Eingaben, die nur aus der Ausgangssprache bestehen, mit einer Methode – die Ausführungspipeline ohne Bewertung. Schreibt `.jsonl` oder `.tsv` mit den Begriffen der Eingabe als set/1-Sidecar; eine Methode, deren Ausgabe nur lokal ist, schreibt nur innerhalb des Projekts, es sei denn, `--holders-agreed-by` nennt, welche der Dateninhaber zugestimmt haben |
| `mt-eval serve` | Stellt eine Methode, die auf diesem Rechner läuft (`lexicon`, `local-model` oder ein Plugin der Abhängigkeitsklasse S oder O), hinter dem Champollion-`/translate`-Vertrag über eine deployment/1-Datei oder Flags bereit, mit einer optionalen gate-chain/1-Datei, die jede Antwort prüft. Bindet standardmäßig an 127.0.0.1; ein anderer Host erfordert `$MT_EVAL_SERVE_TOKEN` |

**Den Weg zu einer Methode finden**

| Unterbefehl | Funktion |
|---|---|
| `mt-eval recommend <src> <tgt>` | Methodenempfehlungen für ein Sprachpaar — Verfügbarkeit plus **zitierte Nachweise**, kein bloßes Ranking. Das Paar kann auch als `--source <src> --target <tgt>` angegeben werden, dem von `corpora` erwarteten Format |
| `mt-eval corpora --source X --target Y` | Für ein Paar verfügbare Evaluierungskorpora auflisten. Jedes Flag funktioniert auch separat: `--target Y` listet alle Korpora nach Y auf, `--source X` alle Korpora aus X |
| `mt-eval corpora --with-fst` | Nur diejenigen Korpora auflisten, deren Zielsprache über einen vom Test-Harness fixierten FST verfügt, sodass die FST-Akzeptanz bewertet werden kann. Für jedes Ziel wird angegeben, ob der FST auf diesem Computer installiert ist und wie er installiert werden kann (`mt-eval setup --lang <code>` oder eine manuelle Installation für bestimmte Formate). Kann mit `--source`/`--target` kombiniert oder einzeln für alle Paare verwendet werden. Es wird nichts heruntergeladen |
| `mt-eval list models\|prompts\|datasets` | Verfügbare Ressourcen auflisten |

**Mitwirken**

| Unterbefehl | Funktion |
|---|---|
| `mt-eval publish <report>` | Einen TestReport an die Bestenliste übermitteln |
| `mt-eval queue` | Den obersten Eintrag der Community-Rechenwarteschlange mit dem eigenen Schlüssel ausführen – siehe [Rechenleistung beisteuern](/docs/network/getting-started/contributing-compute) |
| `mt-eval export` | Einen TestReport als Champollion-Methoden-Plugin paketieren (ein method/1 `method.json`) |
| `mt-eval generate-plugin` | Alias für `export` |
| `mt-eval export-config` | Ein `champollion.config.json`-Snippet aus einem TestReport generieren |

**Wettbewerbe und eigene Durchführung**

| Unterbefehl | Funktion |
|---|---|
| `mt-eval contest` | Einen **souveränen Wettbewerb** durchführen oder daran teilnehmen – für Veranstalter: `prepare`, `register`, `create`, `rank`, `close`, `export`; für Teilnehmer: `qualify` (den öffentlichen Dev-Set zur Erlangung des Zulassungsbelegs selbst auswerten; das Qualifikationskriterium ist chrF++ auf einer Skala von 0–100), `validate` (die Prüfungen des Knotens offline proben), `submit-model` / `submit-method` (ein Modell oder eine Methode übergeben), `status`, `list`. Die Teilnahme an einem Wettbewerb erfolgt, indem dem Knoten des Veranstalters etwas übergeben wird, das er AUSFÜHREN kann; das Hochladen von Übersetzungen und das Verlinken einer selbstberichteten Karte wurden am 06.09.2026 als Teilnahmepfade eingestellt |
| `mt-eval shared-task` | Dachstruktur für Shared-Task-Editionen mit mehreren Paaren: Eine Zeile fasst die N Paare-Wettbewerbe einer Multi-Paar-Shared-Task-Edition zusammen und enthält deren Richtlinien-Standardwerte. **Nur Gruppierung und Standardwerte – jedes Gate bleibt wettbewerbsspezifisch** |
| `mt-eval node` | **Der Bewertungsknoten des Veranstalters.** Einreichungen abfragen, anhand des öffentlichen Qualifikationskriteriums prüfen, gemäß Wettbewerbsrichtlinie autorisieren, gegen die **geheimen, vom Veranstalter gehaltenen Referenzen** bewerten, nur Ergebnisse veröffentlichen. Dies ist der Befehl hinter [Einen souveränen Wettbewerb durchführen](/docs/network/sovereignty/run-a-sovereign-contest) und dem [Souveränen Evaluierungsknoten](/docs/network/sovereignty/sovereign-eval-node) – der Korpus verlässt niemals den Rechner des Veranstalters |

`mt-eval node` umfasst achtzehn eigene Unterbefehle, darunter die Airgap-Verarbeitung
(`import-bundle`, `export-scores`, `relay`, `egress-check`, `manifest`) und das
M-von-N-Verwahrungsverfahren (`ceremony`, `seal`, `keygen`, `sign-manifest`,
`verify-manifest`, `ledger`). Führen Sie `mt-eval node --help` aus; die Souveränitätsmechanismen
sind auf den beiden oben verlinkten Seiten beschrieben.

**Einrichtung**

| Unterbefehl | Funktion |
|---|---|
| `mt-eval setup` | Optionale Abhängigkeiten installieren (neuronale COMET-Metrik, FST-Laufzeitumgebung) |
| `mt-eval logout` | Gespeicherte Authentifizierungsdaten entfernen |

### Beispiele

```bash
# Run with defaults (google/gemini-3.1-pro-preview, naive prompt)
mt-eval run --corpus eval-amh-fra-globalvoices-test-v1

# Coached experiment with coaching file
mt-eval run \
  --corpus eval-amh-fra-globalvoices-test-v1 \
  --model google/gemini-3.1-pro-preview \
  --coaching-file prompts/crk-coaching-v8.txt \
  --temperature 0.0

# Run a custom method plugin
mt-eval run \
  --corpus eval-amh-fra-globalvoices-test-v1 \
  --method ./methods/fst-gated-pipeline
```

Das Testumfeld wiederholt oder filtert niemals eine Übersetzung, die der FST ablehnt: Die FST-
Akzeptanz ist eine Metrik, die bewertet wird, wenn das Eval-Pack der Sprache einen FST enthält. Eine
Methode, die FST-gesteuerte Wiederholungsversuche wünscht, führt diese innerhalb ihres eigenen Plugins durch, wie das
`fst-gated-pipeline`-Tutorial zeigt. (`--fst-retries` und `--hooks` wurden auf der
Befehlszeile nie mit irgendetwas verknüpft; beide werden mit dieser Begründung abgewiesen.)

---

## Run-Card-Schema

Jedes Experiment erzeugt eine **Run Card** — ein eigenständiges JSON-Dokument. Die Struktur auf oberster Ebene:

```json
{
  "run_id": "uuid-v4",
  "harness_version": "2.0",
  "model_slug": "google/gemini-3.1-pro-preview",
  "model_id": "gemini-3.1-pro-001",
  "condition": "naive",
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

:::info[Verbindliches Schema]
Die [Benchmark-Spezifikation](/docs/network/specifications/benchmark) ist die zentrale Referenz (Single Source of Truth) für das Schema der Durchlaufkarten. Definitionen von Metriken und Angaben dazu, wie Durchläufe bewertet werden, finden Sie in der [Scoring-Spezifikation](/docs/network/specifications/scoring). Diese Seite dokumentiert die Verwendung des Test-Harness; die Spezifikationen definieren die Bedeutung der Ausgaben.
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
Diese Metriken sind **Diagnosedaten** — sie sind niemals Teil des Gesamtergebnisses, und die Formalitätserkennung basiert auf Signalwörtern (einer Heuristik), nicht auf einer erlernten Beurteilung. Betrachten Sie sie als Instrument zur Erkennung von Abweichungen bei der Registertreue, nicht als Urteil über die stilistische Qualität.
:::

---

## Fingerprint vs. Run-Card-Hash {#fingerprint-vs-run-card-hash}

Der Harness erzeugt zwei unterschiedliche Hashes. Sie dienen verschiedenen Zwecken:

### Fingerprint

Der **Fingerprint** beantwortet: *„Könnte dieser Lauf reproduziert werden?“*

Er hasht die Kombination der Eingaben, die die Experimentkonfiguration definieren — nicht die Ausgaben:

- Datensatz-SHA-256
- Modell-Slug
- Bedingungsbezeichnung
- System-Prompt-SHA-256
- Temperatur
- Batch-Größe
- Aktivierte Tools
- Version des Test-Harness

Insgesamt acht Komponenten: Batch-Größe und Tool-Calling verändern die Ausgabe
wesentlich, weshalb sie Teil der Identität des Experiments sind — zwei Durchläufe mit
unterschiedlichen Batch-Größen teilen sich **keinen** Fingerprint. Siehe
[Benchmark-Spezifikation §3.8](/docs/network/specifications/benchmark#38-fingerprint).

Zwei Läufe mit identischen Fingerprints verwendeten dasselbe Setup. Ihre Ergebnisse sollten vergleichbar sein (abgesehen von API-Nichtdeterminismus).

### Run-Card-Hash

Der **Run-Card-Hash** beantwortet: *„Wurde diese spezifische Ergebnisdatei manipuliert?“*

Es ist der SHA-256 der gesamten Run-Card-JSON (ausgenommen das Feld `run_card_hash` selbst). Wenn sich ein beliebiges Feld ändert — eine Bewertung, ein Zeitstempel, eine einzelne Ausgabe — bricht der Hash.

:::info[Wann was verwenden]
Verwenden Sie den **Fingerprint**, um vergleichbare Läufe zu gruppieren (gleiches Experiment, unterschiedliche Ausführungen). Verwenden Sie den **Run-Card-Hash**, um die Integrität einer bestimmten Ergebnisdatei zu überprüfen.
:::

---

## Veröffentlichung im Leaderboard

Führen Sie nach Abschluss eines Durchlaufs `mt-eval publish` auf der `<run-id>_report.json` des Durchlaufs aus. Ein Schreibvorgang in das produktive Leaderboard erfordert ein explizites `--prod` (oder `MT_EVAL_ALLOW_PROD=1`); `mt-eval run --publish --prod` führt beide Schritte auf einmal aus:

```bash
mt-eval publish eval/logs/harness/<run-id>_report.json --dry-run   # preview
mt-eval publish eval/logs/harness/<run-id>_report.json --prod      # write to the live board
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

- [MT-Evaluierung](/docs/network/leaderboard/rules) — Übersicht, Mehrwert des Leaderboards und Empfehlungen zu guten/schlechten Methoden
- [Evaluierungsdatensätze](/docs/network/leaderboard/datasets) — Datensatzformat, EDTeKLA, FLORES+
- [Run-Card-Spezifikation](/docs/network/specifications/run-card) — das vollständige JSON-Schema
- [Erstellen einer Methode](/docs/network/specifications/methods) — die Schnittstelle zum Erstellen evaluierbarer Methoden
- [Methoden-Leaderboard](https://champollion.dev/leaderboard) — Live-Benchmark-Ergebnisse
- [Benchmark-Spezifikation](/docs/network/specifications/benchmark) — Evaluierungsprotokoll, Korpusformat, Run-Card-Schema
- [Scoring-Spezifikation](/docs/network/specifications/scoring) — Zentrale Referenz für Metriken und die Bewertung von Durchläufen
