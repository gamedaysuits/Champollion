---
title: "Methoden und Gates"
slug: /agents/methods
description: "method/1 und gate-chain/1, wie jedes Champollion-Werkzeug sie liest, ein FST-Validierungsgate als Praxisbeispiel und die Methodenrezepte jenseits des standardmäßig trainierten Modells — angeleitetes LLM, Few-Shot, wörterbuchgestützt, regelbasierter Hybrid, verkettet, Teilübersetzung, feinabgestimmt — jeweils mit der Angabe, was wohin gesendet wird."
---

# Methoden und Gates

Eine **Methode** ist alles, was übersetzt: ein trainiertes Modell, ein per Prompt
gesteuertes LLM, ein Wörterbuch-Lookup, eine Regel-Engine, ein Dienst, Menschen.
Ein **Gate** ist eine Prüfung zwischen der Ausgabe einer Methode und dem, was
ausgeliefert wird. Die Standardmethode der Rails ist ein mit nmt-forge trainiertes
Modell ([Training](/docs/agents/training)); diese Seite beschreibt das Format, in
dem beide verfasst sind, sowie die weiteren Rezepte.

Jedes nachfolgende Rezept befolgt die [Übertragungsregeln](/docs/agents/data-rules):
**Eine Methode, die einen Modellanbieter aufruft, sendet Text an diesen Anbieter**,
und eine rein lokale, versiegelte oder zustimmungspflichtige Datei lehnt dies ab.

## method/1

`$schema` `https://champollion.dev/schemas/method/1.json`. Erforderlich: `id`
(durch Bindestriche verbundene Kleinbuchstaben), `name`, `kind` – plus die
eine Einstellung, die diese Art benötigt, von den Readern mit denselben Meldungen in
beiden Laufzeitumgebungen geprüft.

| `kind` | Erforderliche Einstellung | Läuft in | Sendet Text an |
|---|---|---|---|
| `llm` | `model` (eine exakte ID, niemals ein Alias); optional `provider` | CLI; Harness über `-m` und `--provider` | Der Anbieter |
| `llm-coached` | `model`; das Coaching gehört in `coaching` (`file`, `prompt` oder `dir`) | CLI; Harness über `-m` und `--coaching-file` | Der Anbieter: die Sätze und das Coaching |
| `mt-api` | `engine` (aus `shared/method-registry.json`) | CLI; Harness | Dienst der Engine |
| `local-model` | `model` (eine Hugging-Face-ID oder ein lokaler Ordner) | Harness, prozessintern | Nirgendwohin |
| `nmt-checkpoint` | `model_dir` | Über seinen Dienst (`nmt-forge serve`) | Der Server dieses Computers |
| `lexicon` | `dictionary` | Harness, prozessintern | Nirgendwohin |
| `python` | `entry_point` (`module:Class`) | Harness (`mt-eval run --method <folder>`) | Wohin auch immer das Plugin ihn sendet (`dependency_class`) |
| `service` | `service.endpoint` | CLI (`api`-Methode) | Dieser Endpunkt |
| `human` | — | Menschen; bewerten Sie deren Ausgabe mit `mt-eval test` | — |

Optional: `version`, `description`, `author`, `pairs` (`{source?, target}`),
`decode` (`temperature` 0–2, `batch_size`, `max_tokens`), `card` (was die
Bestenliste anzeigt), `dependency_class` (`S` in sich geschlossen, `O` offen extern,
`A1`/`A2` API-abhängig, `X` geschlossen), `evidence` (gemessene Durchläufe: `dataset`,
`metric`, `score`, `ci`, `n` – nur Zahlen), `runtimes` (`cli`, `engine`).

**Woher eine method.json stammt:** `methods/<id>/method.json` in einem Projekt;
`nmt-forge export` (Art `nmt-checkpoint`); `mt-eval export --report <report>
--name <name> --type <type> --locales <code>`; `champollion serve
--emit-manifest` (kind `service`). Ältere Formen (das CLI-Plugin-Manifest mit
`type`, das Harness-Plugin-Manifest mit `entry_point`) werden weiterhin eingelesen, als
method/0, mit einer Warnung. Ein Dokument, das `$schema` trägt, wird als
method/1 eingelesen und muss validieren.

**Welche Laufzeitumgebung welche Art akzeptiert.** Die CLI verweigert `python`, `lexicon`,
`local-model` und `human` (*„läuft in der Evaluierungs-Engine (mt-eval run --method),
nicht in der champollion-CLI – oder stellen Sie es bereit und nutzen Sie es über seinen Endpunkt“*).
Das `--method <folder>` des Harness lädt nur `python`; für jede andere Art nennt es die
Flags, die es stattdessen ausführen.

**Dekodierung.** Die Standardtemperatur ist **0** (`shared/model-defaults.json`):
ein Wert dafür, womit eine App übersetzt und woran das Harness evaluiert, sodass
das gemessen wird, was ausgeliefert wird – `mt-eval run --temperature` ist standardmäßig darauf gesetzt.
Ein Sprachpaar, eine Konfiguration oder ein Durchlauf kann einen eigenen Wert festlegen.
Modell-IDs sind exakte Slugs, niemals Aliase.

## Gate-Ketten

`$schema` `https://champollion.dev/schemas/gate-chain/1.json`, eine Datei in
`gates/`. Erforderlich: `id`, `gates` (eine oder mehrere). Optional: `description`,
`fallback`.

Jedes Gate: `id`, `kind` (`metric-threshold`, die einzige Art), `metric` (der
Name eines Metrik-Plugins), `field` (ein Schlüssel im Segment-Ergebnis dieses Plugins – eine
Zahl oder wahr/falsch gelesen als 1/0), `min` und/oder `max`, `on_refuse`.

**Die Regeln** (`arena/mt_eval_harness/gates.py`):

- Gates laufen der Reihe nach ab; das **erste** Gate, das ein Segment ablehnt,
  entscheidet darüber, was ausgeliefert wird:

  | `on_refuse` | Liefert aus | Gezählt als |
  |---|---|---|
  | `drop` | nichts | abgelehnt |
  | `keep-source` | den Quelltext | abgelehnt |
  | `flag` | die Ausgabe, markiert | markiert, nicht abgelehnt |
  | `fallback` | die Übersetzung des Fallbacks, sofern dieselben Gates sie akzeptieren; erneut abgelehnt: nichts | abgelehnt |

- **Lock.** Ein Segment, das das Plugin nicht bewerten kann, wird abgelehnt (`no_value` oder
  `plugin_error:<type>`) – niemals so ausgeliefert, als hätte es bestanden.
- **Lock.** Ein Gate, dessen Plugin nicht geladen ist oder hier nicht bewerten kann, stoppt den
  Durchlauf, bevor irgendetwas übersetzt wird: *„ein Gate, das nicht urteilen kann, gilt niemals
  als bestanden“*.
- **Lock.** Der Fallback muss in diesem Prozess laufen (`lexicon`, `local-model`
  oder ein Plugin, das `dependency_class` `S` oder `O` deklariert), damit ein abgelehntes Segment
  nirgendwohin gelangt.
- **Lock.** `mt-eval run` und `mt-eval test` verweigern eine Kette mit einem `fallback`-Gate:
  *„ein Fallback dient der Bereitstellung und Übersetzung, niemals einer Messung:
  die Bewertung würde teils von dieser Methode und teils vom Fallback stammen, unter einem
  einzigen Namen“*. Messen Sie den Fallback als eigenständige Methode.
- **Wo Gates greifen:** `mt-eval run --gates`, `mt-eval test <run log>
  --gates` (re-scored without translating again), `mt-eval translate --gates`,
  `mt-eval serve --gates` und das `gates` eines Deployments.
- Bei einer Messung bewertet der Hauptwert das, was ausgeliefert wird; der ungegatete chrF++-Wert und die
  Ablehnungsrate stehen daneben, und der Fingerabdruck der Kette (SHA-256 ihres
  kanonischen JSON) wird mit dem Bericht übermittelt ([Messung](/docs/agents/measurement#gated-measurement)).
  Bei `keep-source` bewertet der Hauptwert den Quelltext dort, wo er ausgeliefert wurde.
- **Lock.** Jedes Gate benötigt `min` und/oder `max`, Gate-IDs sind eindeutig, und ein
  `fallback`-Gate benötigt das `fallback` der Kette – `champollion validate` und
  das Harness fällen dasselbe Urteil. Die erneute Ausführung eines abgelehnten Segments unter
  Berücksichtigung der Gate-Begründung ist nicht implementiert.

## Ausführliches Beispiel: Ein FST-Gültigkeits-Gate

Ein Finite-State-Analysator (FST) prüft, ob ein Wort ein wohlgeformtes Wort der
Sprache ist. Das Metrik-Plugin `giellalt_fst_validity` des Harness meldet pro
Segment `fst_total_words`, `fst_valid_words`, `fst_invalid_words` und
`fst_validity_rate` (0–1). Wörter werden an Leerzeichen getrennt, wobei Satzzeichen an den
Rändern entfernt werden; ein großgeschriebenes Wort wird nochmals in Kleinschreibung geprüft.

```json
{
  "$schema": "https://champollion.dev/schemas/gate-chain/1.json",
  "id": "fst-every-word",
  "description": "Ship a sentence only when the analyzer accepts every word.",
  "gates": [
    { "id": "fst-all-words", "kind": "metric-threshold",
      "metric": "giellalt_fst_validity", "field": "fst_validity_rate",
      "min": 1.0, "on_refuse": "flag" }
  ]
}
```

```bash
mt-eval setup --status               # the languages with a pinned analyzer
mt-eval setup --fst                  # the analyzer runtime
mt-eval setup --lang <code>          # the language's analyzer, once per machine
mt-eval run --corpus <dev file> --target-lang-code <code> --method local-model -m <model folder> \
  --gates gates/fst-every-word.json
```

- Der Analysator ist **nicht gebündelt**: Das Harness liefert nur Pins aus (einen Dateinamen
  und SHA-256 pro Sprache), und `setup --lang` ruft den Analysator von dessen
  Upstream nach `~/.mt-eval/fsts/<code>/` ab, gemäß den Bedingungen des Upstreams. Er wird
  als separates Werkzeug ausgeführt und niemals in die `champollion`-CLI eingebunden.
- Ein fehlender Analysator wird niemals zu einer Null: Als Metrik wird er als nicht
  berechnet markiert; als Gate stoppt er den Durchlauf.
- Eine leere Ausgabe erhält den Wert 0 und wird unter `min` abgelehnt.
- Um damit bereitzustellen, verwenden Sie `on_refuse: "fallback"` und eine `fallback` wie
  `{"method": "lexicon", "model": "data/lexicon/words.tsv"}` – nur für
  `translate` und `serve`.
- **Hinweis.** Die FST-Akzeptanz besagt lediglich, dass ein Wort existiert, nicht, dass der Satz
  das Richtige bedeutet. Es handelt sich um eine Diagnose: Sie fließt niemals in den chrF++-Hauptwert ein.

## Die Rezepte

### Gecoachtes LLM (`llm-coached`)

Ein allgemeines Modell, das mit den Hinweisen der Sprachgemeinschaft per Prompt
gesteuert wird: Grammatiknotizen, Stil, Begriffe.

```bash
mt-eval run --corpus <dev file> -m <exact model id> --coaching-file coaching.md --glossary terms.json
champollion sync --method llm-coached --coaching-file coaching.md
```

- **Im Harness** *ist* der Text der Coaching-Datei der gesamte System-Prompt;
  er muss also angeben, was übersetzt werden soll und dass nur die Übersetzung ausgegeben wird.
  `--glossary` ist eine Bewertungseingabe (Terminologietreue) und wird niemals gesendet.
- **Lock.** Ein Harness-Durchlauf hat genau ein Coaching: `--coaching-file`, `--coaching`
  (Inline-Text) oder das ältere `--custom-prompt` – geben Sie eines an. Zwei zusammen werden
  abgelehnt: *"--coaching-file and --coaching each give the run its coaching —
  give one (put inline text in the file, or drop the file)"*.
- **In der CLI** sendet `llm-coached` einen eigenen Prompt mit dem Coaching als
  „Coaching guidance“-Block, plus `.champollion/coaching/<locale>.json`
  (`grammar_rules`, `style_notes`, `dictionary`).
- **Hinweis.** Dies sind zwei verschiedene Prompts: Ein im Harness gemessener Coaching-Wert
  basiert nicht auf exakt demselben Prompt, den die CLI ausliefert. Weisen Sie darauf hin, wenn
  Sie das eine als Beleg für das andere anführen.
- **Sendet:** jeden Quellsatz und das vollständige Coaching an den Anbieter. Eine
  Coaching-Datei mit einer rein lokalen Sidecar-Datei läuft nur auf einem Loopback-Endpunkt
  (`champollion data mark coaching.md --local-only` kennzeichnet einen solchen).

### Few-Shot

Beispiele für gute Übersetzungen innerhalb des Coachings. Es handelt sich um ein gecoachtes LLM:
dieselben Befehle, derselbe Transport – die Beispiele gelangen im System-Prompt an den
Anbieter.

- **Hinweis.** Übernehmen Sie niemals Beispiele aus dem Testset und niemals aus einer
  rein lokalen Datei für einen Remote-Anbieter. Es gibt keine automatische Prüfung von
  Few-Shot-Beispielen gegen die Testreferenzen.

### Wörterbuchgestütztes LLM

- **CLI:** Die `dictionary` in `.champollion/coaching/<locale>.json` wird für die in jedem
  Batch gefundenen Begriffe als „REQUIRED TERMINOLOGY“ an jede LLM-Methode gesendet
  (Teilzeichenfolgenabgleich ohne Berücksichtigung der Groß-/Kleinschreibung). DeepL empfängt sie als Glossar.
  Bei Verstößen wird nach der Übersetzung gewarnt; es gibt keinen Neuversuch.
- **Harness:** Ein Wörterbuch erreicht das Modell ausschließlich als Text in der Coaching-Datei.
- **Wörterbuch allein:** `mt-eval run --method lexicon -m data/lexicon/words.tsv
  --corpus <dev file>` – längster Ausdruck zuerst, unbekannte Wörter beibehalten,
  prozessintern. `nmt-forge floor` entspricht dem auf dem Dev-Set
  ([Messung](/docs/agents/measurement#the-dictionary-floor)).
- **Sendet:** die passenden Wörterbucheinträge zusammen mit den Sätzen an den
  Anbieter. Ein rein lokales Wörterbuch darf nicht an einen Remote-Anbieter übermittelt werden.

### Regelbasiertes Hybridmodell

Es ist keine Regel-Engine fest integriert. Was existiert: `lexicon` (deterministisch,
prozessintern); `mt-eval run --method apertium` (eine regelbasierte Engine – sie sendet Text
an `apertium.org`, es sei denn, `APERTIUM_API_URL` verweist auf Ihren eigenen Server); und
`python`-Plugins für eigene Regeln, optional mit einem LLM. Eine Plugin-Klasse
benötigt `async def translate(self, entries, config)`; führen Sie sie mit `mt-eval run
--method <folder>` aus. Validieren Sie deren Ausgabe mit einer Gate-Kette.

- **Sendet:** was immer das Plugin aufruft. Ein Plugin ist eine externe Methode: Bei einem
  zustimmungspflichtigen oder versiegelten Korpus (einschließlich rein lokaler) verweigert das
  Harness dies, es sei denn, `--attest-local-transport` ist gesetzt – was Sie erst übergeben, nachdem
  Sie überprüft haben, dass sich alles, was aufgerufen wird, auf diesem Computer befindet.

### Verkettete Methoden

Zwei Ketten sind fest integriert:

1. **Der Fallback einer Gate-Kette:** Methode → Gates → prozessinterner Fallback →
   dieselben Gates. Nur für `translate` und `serve`.
2. **Der Sprachpaar-Fallback der CLI** (`"fallback": {"method": …}` bei einem Paar einer App):
   primäre Methode → das Qualitäts-Gate der CLI → ein Neuversuch mit dem Feedback des Gates
   (LLM-Methoden oder ein `api`-Endpunkt, der `acceptsInstructions` deklariert) →
   der Fallback einmalig, durch dasselbe Gate.

Alles darüber Hinausgehende (Generieren, Bearbeiten, Validieren über Modelle hinweg) ist ein
`python`-Plugin oder ein `service`.

- **Sendet:** Jedes Glied sendet das, was seine Art sendet. Eine Kette ist nur so
  privat wie ihr am wenigsten privates Glied.

### Partielle Übersetzung (Mensch und Maschine)

Das Modell erstellt Entwürfe; eine sprechende Person prüft und korrigiert. Auf den Rails ist dies die
Verbesserungsrunde: `champollion improve sheet` entwirft, die sprechende Person markiert `Y`/`N`/`?`,
`champollion improve marks` wandelt Korrekturen und bestätigte Entwürfe in Trainingspaare
und Übungszeilen in Dev-Sätze um ([Coaching](/docs/agents/coaching)). Um die eigenen
Übersetzungen von Menschen als Methode zu bewerten (`kind` `human`), führen
Sie `mt-eval test` auf deren Ausgaben aus. Ein Gate mit `on_refuse: "flag"` markiert die Ausgabe
zur Überprüfung.

- **Hinweis.** Ein Satz, der zum Coachen oder Trainieren einer Methode verwendet wird, darf niemals
  ein Satz sein, an dem sie bewertet wird.
- **Sendet:** nichts über die eigenen Regeln des Entwurfsmodells hinaus; die Tabellen verbleiben
  im Projektordner.

### Feingetuntes Modell

- **Auf den Rails:** `nmt-forge` (`nmt-checkpoint`; Presets `cpu-tiny`,
  `byt5-small`, `byt5-small-lowmem`, `cpu-finetune`, `nllb-600m`), exportiert,
  bereitgestellt und angebunden –
  [Training](/docs/agents/training), [Bereitstellung](/docs/agents/serving).
- **Ein offenes Modell, das Sie bereits haben:** `mt-eval run --method local-model -m
  <Hugging Face id or folder>` – prozessintern; nichts verlässt den Computer.
- **Ein LLM, das Sie selbst bereitstellen** (Ollama, vLLM, alles OpenAI-Kompatible):
  `mt-eval run --provider local --base-url http://127.0.0.1:11434/v1 -m
  <model name>`. Es zählt nur dann als lokal, wenn der Endpunkt eine Loopback-Adresse
  ist.
- **Sendet:** nichts außerhalb des Computers, wenn der Endpunkt tatsächlich lokal ist.

## Weiterführende Informationen

- [Die Methodenspezifikation](/docs/network/specifications/methods) und das
  [Plugin-Manifest](/docs/reference/plugin-spec) (die ältere Form).
- [Bereitstellung und Deployment](/docs/agents/serving) – deployment/1 und
  service-api/1.
- [Messregeln](/docs/agents/measurement) – Gate-geprüfte Werte.
- [Daten- und Übertragungsregeln](/docs/agents/data-rules) – was gesendet werden darf.
- [Übersetzungsmethoden für Apps und Websites](/docs/guides/translation-methods).
