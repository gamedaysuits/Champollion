---
sidebar_position: 4
title: "Rechenleistung beitragen"
description: "Die Warteschlange abarbeiten: Führen Sie offene Benchmark-Durchläufe aus der öffentlichen Warteschlange mit Ihrem eigenen API-Schlüssel aus und veröffentlichen Sie die Ergebnisse."
related:
  - label: "Agent Guide: Building & Benchmarking on the Network"
    to: /docs/network/getting-started/agent-guide
    kind: guide
  - label: "Cookbook: Coached LLM Prompting"
    to: /docs/network/tutorials/coached-llm-prompting
    kind: cookbook
  - label: "Cookbook: FST-Gated Pipeline"
    to: /docs/network/tutorials/fst-gated-pipeline
    kind: cookbook
  - label: "Method Interface & Dependency Classes"
    to: /docs/network/specifications/methods
    kind: spec
  - label: "Leaderboard Rules & Trust Tiers"
    to: /docs/network/leaderboard/rules
    kind: guide
---

# Rechenleistung beitragen

> **Die Idee:** Die Rangliste weist leere Felder auf – Kombinationen aus (Sprachpaar, Methode, Bedingung), die noch niemand gemessen hat. Wir pflegen eine öffentliche Warteschlange dafür. Sie führen die Einträge mit Ihrem eigenen API-Schlüssel aus, veröffentlichen die Berichte, und die Karte füllt sich. Das Beisteuern von Rechenleistung ist ein echter, zitierfähiger Beitrag zur Evaluierung maschineller Übersetzung für ressourcenarme Sprachen.

Die Warteschlange enthält zwei Arten von Aufgaben. **LLM-Einträge** testen ein Chat-Modell für ein
Sprachpaar in einer `naive`- oder `coached`-Prompting-Bedingung. **Engine-
Einträge** (Bedingung `engine`) testen einen klassischen MT-Dienst – DeepL, Google
Translate, Microsoft Translator, LibreTranslate, Tilde – für Paare innerhalb
der eigenen veröffentlichten Abdeckung dieses Dienstes; diese bilden das gemessene Rückgrat der
Abdeckungskarte und waren bis 2026-08 fast vollständig leer. Beide
Arten durchlaufen dasselbe Test-Framework und werden auf derselben Rangliste veröffentlicht.

## Die Warteschlange

Die Live-Warteschlange wird aus der Datenbank bereitgestellt (das Test-Framework liest sie standardmäßig); ein kompakter Snapshot wird unter [champollion.dev/queue-preview.json](https://champollion.dev/queue-preview.json) veröffentlicht, wobei die vollständige Datei unter [queue.json](https://champollion.dev/queue.json) zu finden ist (mehrere Dutzend MB – die Vorschau ist der richtige erste Abruf). Sie können auf [der Live-Karte unter champollion.dev](https://champollion.dev) beobachten, worauf Ihre Testläufe aufbauen – die Abdeckungskarte darüber, wer was übersetzen kann. Es gibt auch einen Terminal-Viewer ohne Installation:

```bash
curl -fsSL https://champollion.dev/run_queue | bash -s -- --budget 2
```

Der Viewer *zeigt* lediglich offene Einträge und deren exakte `mt-eval run`-Befehle an — er führt niemals etwas aus und verbraucht keine Ihrer Tokens. Jeder Eintrag enthält:

- `run_command` — bereit zum Kopieren und Einfügen (ruft den Korpus ab, führt das Test-Framework aus)
- `est_cost_usd` und `est_basis` — entweder die **beobachteten** Kosten unseres eigenen Basis-Testlaufs für dasselbe (Korpus, Modell) oder eine **Extrapolation** aus den durchschnittlichen Sweep-Kosten dieses Modells pro Eintrag × die Anzahl der Korpuseinträge. Die Grundlage wird pro Eintrag angegeben; Ihre tatsächlichen Kosten hängen von der Preisgestaltung des Anbieters zur Laufzeit ab.
- `priority` — die veröffentlichte Rangliste (Survey-Modus: erste Erkenntnisse über
  Paare, Sprachen und Familien hinweg pro Dollar). Die Vorschau veröffentlicht auch
  **Budgetstufen** — was 1 $ / 10 $ / 100 $ / 1000 $ an der Spitze der
  Rangliste ermöglichen (erreichte Einträge, Paare, Modelle) —, sodass Sie einen Beitrag
  dimensionieren können, bevor Sie Geld ausgeben. Das zugrunde liegende Wertmodell ist der **erwartete
  Kettenwert** (expected chain value): wie sehr dieser eine Testlauf voraussichtlich das gesamte Sprachnetz pro geschätztem Dollar stärken wird. Jeder Eintrag enthält seine vollständige Formelaufschlüsselung (`edge_strength`, `pair_prior`, `model_offset`, `exploration_bonus`, `predicted_strength`, `expected_mesh_gain`, `ecv_per_usd`), sodass jeder Rang von Hand neu abgeleitet werden kann — die Formel und ihre Standardwerte sind in der [Spezifikation zur Erstellung der Warteschlange](/docs/network/specifications/queue-construction) veröffentlicht, und die dahinter stehende Argumentation in [Warum die Warteschlange so aufgebaut ist](/docs/network/perspectives/why-the-queue).

**Keine Anspruchssperre — wählen Sie einen beliebigen offenen Eintrag.** Dass zwei Personen denselben Eintrag ausführen, ist von vornherein unschädlich: Jede Lauf-Karte erhält einen Fingerabdruck (SHA-256 über Datensatz-Hash + Modell + Bedingung + System-Prompt, [Benchmark Spec §3.8](/docs/network/specifications/benchmark)), sodass identische Läufe bei der Veröffentlichung dedupliziert werden und unabhängige Replikationen derselben Konfiguration nützliche Belege sind, keine Verschwendung.

Eingereihte Korpora sind Dev-Split, aus der CC-BY-Familie (Tatoeba-abgeleitet) und mit `do_not_train` gekennzeichnet — es handelt sich um Evaluierungssätze, nicht um Trainingsdaten. Nicht-kommerziell lizenzierte und in Quarantäne befindliche Korpora sind von der offenen Warteschlange ausgeschlossen.

## Einrichtung (einmalig)

```bash
# 1. Install the harness (python3 + pipx, no sudo — read it first if you like)
pipx install mt-eval-harness

# 2. Set your API key — any ONE of these; the harness auto-detects it
export OPENROUTER_API_KEY="sk-or-..."     # reaches every model in the queue
# or a direct vendor key:
#   ANTHROPIC_API_KEY / OPENAI_API_KEY / GOOGLE_API_KEY
# (any of them can also live in a local .env file)
```

### Welcher Anbieter-Schlüssel?

Der Harness akzeptiert vier Anbieter-Schlüssel, ausgewählt mit `--provider` auf `mt-eval run` und `mt-eval queue` — oder automatisch erkannt anhand desjenigen Schlüssels, der in Ihrer Umgebung oder in `.env` gesetzt ist:

| `--provider` | Schlüssel | Erreicht |
|---|---|---|
| `openrouter` (Standard) | `OPENROUTER_API_KEY` | jedes Modell in der Warteschlangen-Aufstellung |
| `anthropic` | `ANTHROPIC_API_KEY` | Anthropic Claude-Modelle |
| `openai` | `OPENAI_API_KEY` | OpenAI GPT-Modelle |
| `gemini` | `GOOGLE_API_KEY` | Google Gemini-Modelle |

Ein einziger [OpenRouter](https://openrouter.ai/keys)-Schlüssel erreicht jedes Modell in der Aufstellung, und die Kostenverfolgung sowie die Preis-Snapshots des Harness stammen aus denselben OpenRouter-Metadaten, sodass die gemeldeten Laufkosten dem entsprechen, was Ihrem Schlüssel in Rechnung gestellt wurde — deshalb ist er der Standard. Wenn Ihr Guthaben direkt bei Anthropic, OpenAI oder Google liegt, setzen Sie den Schlüssel dieses Anbieters, und der Harness ruft die API des Anbieters ohne Proxy auf. Ein direkter Schlüssel erreicht nur die Modelle des jeweiligen Anbieters (gut für einen Ein-Anbieter-Stapel), und dessen Kostenangaben stammen aus der veröffentlichten Anbieterpreisgestaltung statt aus abgerechneten Metadaten — behandeln Sie sie als grobe Schätzungen. Wenn sowohl ein OpenRouter-Schlüssel als auch ein direkter Schlüssel gesetzt sind, wählt die automatische Erkennung OpenRouter; der Warteschlangen-Worker teilt Ihnen dies mit und wie Sie es mit `--provider` überschreiben. Jede Lauf-Karte hält in ihrem `api_provider`-Feld fest, über welche Spur sie ausgeführt wurde.

(`mt-eval run` nimmt zudem `--provider local` für selbst gehostete OpenAI-kompatible Endpunkte entgegen — Ollama, vLLM, LM Studio — via `--base-url`. Dies ist ein ausdrückliches Opt-in und wird niemals automatisch erkannt.)

### Kein API-Schlüssel: Ein selbst gehostetes Modell ausführen

Sie benötigen überhaupt keinen Cloud-Schlüssel. Die Methode `local-model` führt ein offenes neuronales MT-Modell auf Ihrer eigenen Hardware aus – jene Modelle, die von den Cloud-Engines nicht bereitgestellt werden, und genau dort ist die Abdeckung für ressourcenarme Sprachen zu finden: **NLLB-200**, **OPUS-MT** (Helsinki-NLP) und **MADLAD-400**.

```bash
# transformers backend (Hugging Face) — install the extra once:
pip install 'mt-eval[local-models]'

# then point --model at any Hugging Face id (or a local from_pretrained dir):
mt-eval run --method local-model \
  --model facebook/nllb-200-distilled-600M \
  --dataset flores-eng-fra
```

**Zwei „übliche Wege“, um ein Modell zu laden, automatisch ausgewählt – nichts zu konfigurieren:**

- **transformers** (Standard): `--model` ist eine Hugging Face Hub-ID (`facebook/nllb-200-distilled-600M`, `Helsinki-NLP/opus-mt-en-es`, `google/madlad400-3b-mt`) oder ein lokales `from_pretrained()`-Verzeichnis. Benötigt `pip install 'mt-eval[local-models]'`.
- **CTranslate2** (schnelle CPU/GPU-Inferenz): `--model` ist ein für CTranslate2 konvertiertes Modellverzeichnis (eines, das von `ct2-transformers-converter` erstellt wurde und eine `model.bin` enthält). Benötigt `pip install 'mt-eval[ctranslate2]'`. Der Tokenizer wird aus dem konvertierten Verzeichnis gelesen oder mit `LOCAL_TOKENIZER_ID` benannt.

Das Backend wird anhand des Modellpfads erkannt (ein CTranslate2-Verzeichnis enthält eine `model.bin`); erzwingen Sie es mit `LOCAL_MODEL_BACKEND=transformers|ctranslate2`, falls dies jemals erforderlich sein sollte.

**Sprachcodes stammen aus der Sprachkarte, nicht aus einer Vermutung.** Für ein mehrsprachiges Modell wie NLLB liest das Test-Framework den FLORES-200-Code direkt von der Karte der Zielsprache ab (dieselbe maßgebliche Quelle, die jede Methode verwendet). Eine Sprache, die das Modell tatsächlich nicht unterstützt – NLLB-200 hat beispielsweise kein Plains Cree (`crk`) – **schlägt ehrlich fehl** („out of scope for this model“), anstatt einen erfundenen Code und eine plausible, aber falsche Übersetzung auszugeben. OPUS-MT-Modelle sind paarspezifisch, daher *ist* das Paar das Modell.

Ein Testlauf mit einem lokalen Modell wird genau wie jeder andere Testlauf bewertet und veröffentlicht – dieselben Metriken, dieselbe Run Card, dieselbe Rangliste. (Es handelt sich um eine Methode des Test-Frameworks; das CLI-Übersetzungstool greift später über eine Subprozess-Brücke darauf zu, sodass Node niemals einen Python-ML-Stack benötigt.)

### Der Schnellweg mit dem Agenten

Wenn Sie mit Claude Code oder einem anderen Coding-Agenten arbeiten, besteht der gesamte Beitrag aus einem einzigen Prompt:

```text
Install the Champollion mt-eval harness with `pipx install mt-eval-harness`.
Fetch https://champollion.dev/queue.json and show me the top 3 open items.
Using my API key (OPENROUTER_API_KEY, or a direct ANTHROPIC_API_KEY /
OPENAI_API_KEY / GOOGLE_API_KEY), execute the run_command of the
item I pick, then run `mt-eval publish` on the generated report JSON and
show me the published run card.
```

## Tier 0 — Ein Befehl

Der schnellste Weg, beizutragen, besteht darin, den Harness den Kopf der
Warteschlange für Sie übernehmen zu lassen:

```bash
mt-eval queue --top 5          # run the 5 highest-value open items
mt-eval queue --budget 2.50    # or: run from the top until ~$2.50 of
                               # estimated spend is committed
mt-eval queue --top 3 --dry-run   # see the plan first, spend nothing
```

Es wird niemals neu sortiert — die Warteschlangenreihenfolge *ist* das
[Prioritätsmodell](/docs/network/specifications/queue-construction) — und es zeigt den vollständigen
Plan mit geschätzten Ausgaben und fragt nach, bevor irgendetwas ausgeführt wird. Gecoachte
Einträge werden übersprungen, sofern Sie nicht Ihre eigene Coaching-Datei mitbringen
(`--include-coached --coaching-file my-coaching.txt`).

**Der Warteschlangen-Worker veröffentlicht für Sie — kein Konto erforderlich.** Anders als ein einzelner
`mt-eval run` (der niemals automatisch veröffentlicht) ermittelt `mt-eval queue` eine
Veröffentlichungsidentität, *bevor* irgendwelche Tokens ausgegeben werden, und **veröffentlicht jeden
erfolgreichen Lauf automatisch** auf der Bestenliste, sobald er abgeschlossen ist — kein separater Veröffentlichungsschritt.
Melden Sie sich (GitHub/Google) nur an, wenn Ihr Name auf der Liste erscheinen soll;
andernfalls fahren Sie anonym fort, und die Ergebnisse werden als Einreicher `anonymous` gepostet
(`--anonymous` erzwingt es, und nicht-interaktive `curl | bash`-Läufe ohne
zwischengespeicherte Anmeldung greifen standardmäßig darauf zurück und sagen es ausdrücklich). Übergeben Sie `--no-publish`, um
die Ergebnisse stattdessen lokal zu behalten (Sie können sie später mit `mt-eval
publish` veröffentlichen). Verfolgen Sie dann auf
[der Live-Karte unter champollion.dev](https://champollion.dev), worauf Ihre Läufe aufgebaut haben.

## Tier 1 — Einen Benchmark ausführen

Der `run_command` jedes Warteschlangeneintrags ist in sich abgeschlossen. Ein typischer:

```bash
mt-eval run --corpus eval-eng-yor-tatoeba-dev-v1 \
  --model anthropic/claude-haiku-4.5 \
  --target-lang "Yoruba" \
  --yes
```

Sie übergeben die **Registry-ID**, keine Datei — der Harness holt die Referenz zur
Ausführungszeit aus ihrer Upstream-Quelle und bewertet gegen die frisch geholten Daten
(Korpusinhalte werden hier niemals gehostet oder verfolgt).

Der Lauf gibt seine Gesamtkosten aus und schreibt ein Lauf-Log sowie einen bewerteten Bericht nach `eval/logs/`. Dann veröffentlichen Sie:

```bash
mt-eval publish eval/logs/harness/run_..._report.json
```

**Kein Konto erforderlich.** Die Veröffentlichung bietet eine OAuth-Anmeldung (GitHub/Google), sodass Ihr Name zur Zuordnung auf der Bestenliste wird — aber sie ist optional: `mt-eval publish <report> --anonymous` veröffentlicht ohne Konto, und die Zeile wird genau wie jedes andere selbst benchmarkte Ergebnis mit Einreicher `anonymous` angezeigt. Die anonyme Aufnahme ist ratenbegrenzt (einige Karten pro Stunde pro Verbindung; die Anmeldung ist der unbegrenzte Weg) und durchläuft dieselben Datenbank-Integritätsprüfungen wie jede andere Einreichung — Quarantäne, Score-Bereiche, Korpus-SHA-Bindung und der Korpusinhalts-Schutz gelten allesamt identisch. Ob anonym oder zugeordnet, Community-Einreichungen landen in der Vertrauensstufe **selbst benchmarkt** — klar gekennzeichnet als „eingereicht von der Person, die ihn ausgeführt hat“. Das ist keine Herabstufung; es ist das Vertrauensmodell in Aktion. Die Lauf-Karte enthält alles, was nötig ist, damit jeder Ihre exakte Konfiguration erneut ausführen kann: Datensatz-Hash, Modell, Bedingung, den vollständigen System-Prompt und die Kosten. Höhere Stufen (Verifizierung, Community-Validierung) werden durch Prüfung gewährt — siehe [Leaderboard Rules](/docs/network/leaderboard/rules).

:::note[Moderation]
Anonyme Zeilen werden wie alles andere moderiert: Einreichungen sind für die öffentliche API unveränderlich, und jede Entfernung oder Korrektur durch Kuratoren erfolgt über die Service-Role-Spur, wo der Audit-Trail der Datenbank die vorherige Zeile bewahrt — sodass eine Löschung protokolliert und rückgängig zu machen ist, niemals still.
:::

## Tier 2 — Gecoachte Prompts erstellen

Der Harness bietet erstklassige Unterstützung für **Coaching**: Ersetzen Sie den naiven System-Prompt durch einen, der echtes linguistisches Wissen enthält. Übergeben Sie `--coaching-file` (oder `--coaching "inline text"` für kurze Prompts), und der Harness verwendet Ihren Text als System-Prompt, hält den **vollständigen Text plus dessen SHA-256** im Provenienz-Block des Lauf-Logs fest und kennzeichnet die Bedingung des Laufs als **`coached`** (sofern Sie `--prompt` nicht ausdrücklich setzen) — sodass Prompt-Gestaltung ein reproduzierbares, zuordenbares Experiment ist, zwei verschiedene Coaching-Dateien niemals miteinander verwechselt werden können und gecoachte Läufe auf der Bestenliste niemals mit naiven Baselines verwechselt werden.

Ein durchgearbeitetes Beispiel für Färöisch, unter Verwendung von Typologiefakten und Glossareinträgen aus der [öffentlichen Sprachkarte](https://champollion.dev/languages) der Sprache:

```text title="coaching-fao.txt"
You are translating English into Faroese (føroyskt).

Grammar notes:
- Faroese is a North Germanic V2 language: the finite verb is the second
  constituent of a main clause.
- Nouns inflect for case (nominative, accusative, dative, genitive),
  gender (masculine, feminine, neuter), and number. Make adjectives and
  determiners agree.
- The skerping pattern applies before -gv/-ggj sequences; preserve
  standard orthography including ð (which is silent).

Glossary (use these exact equivalents):
- language -> mál
- island -> oyggj
- weather -> veður

Style: plain register, modern standard orthography. Output only the
Faroese translation, no commentary.
```

```bash
mt-eval run --corpus eval-eng-fao-tatoeba-dev-v1 \
  --model anthropic/claude-haiku-4.5 \
  --target-lang "Faroese" \
  --coaching-file coaching-fao.txt \
  --yes
```

(Verfassen Sie Ihre eigenen Coaching-Inhalte — die obigen Fakten veranschaulichen die *Form*: einige wirkungsstarke Grammatikregeln, ein kleines Glossar von Begriffen, die das Modell falsch übersetzt, eine Registeranweisung. Sprachkarten unter [champollion.dev/languages](https://champollion.dev/languages) zitieren Typologiequellen, aus denen Sie schöpfen können.)

Vergleichen Sie mit der naiven Baseline mittels `mt-eval compare <naive_log> <coached_log>`, iterieren Sie und veröffentlichen Sie Ihren besten Lauf. Der Lauf wird automatisch mit der Bedingung `coached` veröffentlicht; wenn die Bestenliste statt der generischen Bezeichnung eine benannte Methode anzeigen soll, hängen Sie beim Veröffentlichen eine Methodenkarte an (der Veröffentlichungsablauf bietet einen Assistenten). Die naive Baseline bei einem ressourcenarmen Paar mit nichts als Prompt-Engineering zu schlagen, ist ein echter, veröffentlichungswürdiger Befund — siehe das vollständige [Coached LLM Prompting cookbook](/docs/network/tutorials/coached-llm-prompting) für Gestaltungshinweise.

## Tier 3 — Eine Methode entwickeln

Der ambitionierteste Beitrag: Implementieren Sie das `TranslationMethod`-Protokoll (`translate(entries, config)`) und benchmarken Sie ein tatsächliches System, keinen Prompt. Der Harness führt es via `--method <plugin-dir>` aus und bettet Ihre Methodenkarte in die Lauf-Karte ein. Muster mit durchgearbeiteten Cookbooks:

- **[FST-gated pipelines](/docs/network/tutorials/fst-gated-pipeline)** — jedes Kandidatenwort wird von einem morphologischen Analysator geprüft; das LLM generiert neu, bis das Gate passiert wird. Semi-deterministische, morphologisch garantierte Ausgabe.
- **[Dictionary-augmented generation](/docs/network/tutorials/dictionary-augmented-llm)** — schlagen Sie Quellbegriffe zur Übersetzungszeit in einem zweisprachigen Lexikon nach und schränken Sie die Ausgabe ein.
- [Chained models](/docs/network/tutorials/chained-models), [few-shot retrieval](/docs/network/tutorials/few-shot-prompting), [back-translation](/docs/network/tutorials/back-translation), [rule-based hybrids](/docs/network/tutorials/rule-based-hybrid)…

Methoden deklarieren eine **Abhängigkeitsklasse** (S/O/A1/A2/X — siehe [die Methoden-Spezifikation](/docs/network/specifications/methods#method-validity-and-dependency-classes)), die beschreibt, was sie zum Ausführen und Übertragen benötigen: eine in sich abgeschlossene Pipeline ist Klasse S; eine, die zur Laufzeit eine lizenzierte Wörterbuch-API aufruft, ist A2. Deklarieren Sie ehrlich — die Klasse bestimmt, wo Ihre Methode antreten kann, und Manifeste werden geprüft.

## Warum dies über die Bestenliste hinaus von Bedeutung ist

Jeder veröffentlichte Lauf ist ein unabhängiger Beleg über die Qualität maschineller Übersetzung für ein Sprachpaar, das kommerzielle Anbieter nicht messen. Die Warteschlange dient zugleich als öffentliches Register der *Nachfrage*: welche Paare die Community für messenswert hält, was die Abdeckung zu aktuellen API-Preisen kostet und wie weit beigetragene Rechenleistung reicht. Wenn wir Fördereinrichtungen bitten, systematische Sweeps zu finanzieren, sind diese Warteschlange und ihre Füllrate der Nachweis der Nachfrage.
