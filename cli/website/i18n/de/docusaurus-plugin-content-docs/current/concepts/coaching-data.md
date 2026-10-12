---
sidebar_position: 5
title: "Coaching-Daten"
related:
  - label: "Build a Translation Plugin"
    to: /docs/tutorials/build-a-plugin
    kind: tutorial
    note: "Develop and ship coaching data end-to-end"
  - label: "Plugin Specification"
    to: /docs/reference/plugin-spec
    kind: reference
  - label: "Cookbook: Coached LLM Prompting"
    to: /docs/network/tutorials/coached-llm-prompting
    kind: arena
    note: "The eval-side cookbook for coached methods"
  - label: "Quality Gate"
    to: /docs/concepts/quality-gate
    kind: concept
---

# Coaching-Daten

Coaching-Daten sind der Mechanismus von champollion, um LLMs Sprachen beizubringen, für die sie nicht trainiert wurden. Indem Sie Grammatikregeln, Wörterbücher und Stilhinweise zu jeder Übersetzungsanfrage bereitstellen, verwandeln Sie ein universelles LLM in einen kontextbewussten Übersetzer für jede beliebige Sprache — einschließlich Sprachen, für die keinerlei maschinelle Übersetzungsunterstützung existiert.

## Wie es funktioniert

Wenn Sie die Methode eines Sprachpaars auf `llm-coached` setzen, lädt champollion eine Coaching-Datei aus `.champollion/coaching/<locale>.json` und fügt deren Inhalt als Teil der Systemnachricht in jeden LLM-Prompt ein. Das LLM sieht Ihre linguistischen Regeln zusammen mit der Übersetzungsanfrage und erzeugt eine Ausgabe, die Ihrer Grammatik und Terminologie folgt, anstatt zu raten.

```
┌──────────────────────────────────────────────────────┐
│ System Message (cached across batches)               │
│ ┌──────────────────────────────────────────────────┐ │
│ │ Base translation rules                           │ │
│ │ + Register instructions                          │ │
│ │ + Coaching guidance (from coachingFile, if set)   │ │
│ │ + Grammar rules (from coaching data)             │ │
│ │ + Dictionary entries (from coaching data)         │ │
│ │ + Style notes (from coaching data)               │ │
│ └──────────────────────────────────────────────────┘ │
├──────────────────────────────────────────────────────┤
│ User Message (per batch)                             │
│ ┌──────────────────────────────────────────────────┐ │
│ │ Keys to translate (JSON)                         │ │
│ └──────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────┘
```

Es gibt zwei Arten von Coaching-Inhalten:

1. **Strukturierte Coaching-Daten** (`llm-coached`-Methode) — Grammatikregeln, Wörterbücher und Stilhinweise im JSON-Format. Geladen aus `.champollion/coaching/<locale>.json` oder dem Verzeichnis `coaching/` eines Plugins. Dessen `dictionary` fungiert auch als Glossar des Projekts: Jede LLM-Methode (`llm`, `openai`, `anthropic`, `gemini`, `local`) wird über die im jeweiligen Batch enthaltenen Glossarbegriffe informiert, DeepL sendet es als Glossar, und sync warnt, wenn die Ausgabe einer Methode einen Begriff auslässt. Die Grammatikregeln und Stilhinweise werden ausschließlich von `llm-coached` gelesen — auf jedem Anbieter (`"provider": "openai"`, `"local"`, …).
2. **Freitext-Coaching-Prompt** (`coachingFile`-Konfigurationsfeld) — Eine reine Textdatei mit zusätzlichen Hinweisen, die in den System-Prompt eingefügt werden. Funktioniert mit jeder LLM-Methode, nicht nur mit `llm-coached`. Festgelegt über `coachingFile` in Ihrer Konfiguration oder über `--coaching-file` in der CLI.

Beide können zusammen verwendet werden. Das Eval-Harness verwendet exakt dieselbe Prompt-Struktur — sodass Ihre Benchmark-Werte Ihre tatsächlichen Produktions-Prompts widerspiegeln.

Da die Coaching-Daten Teil der Systemnachricht sind, profitieren sie vom **Prompt-Caching** — Anbieter wie Anthropic und Google cachen wiederholte System-Präfixe, sodass Sie den Coaching-Kontext nur einmal pro Sitzung bezahlen, nicht einmal pro Batch.

## Format der Coaching-Datei

Erstellen Sie eine JSON-Datei pro Locale in `.champollion/coaching/`. Das nachfolgende
Beispiel gilt für eine erfundene Sprache unter `qaa`, einem Code für die private
Nutzung, den keine echte Sprache besitzt: Jede Regel und jeder Begriff darin ist ein
Platzhalter und keine Tatsache über irgendeine reale Sprache. Verfassen Sie Ihre eigene Datei,
idealerweise gemeinsam mit einem Sprecher oder einer Sprecherin der Sprache, und übernehmen
Sie Wörterbuchbegriffe aus einer Quelle, die Sie benennen können.

```json title=".champollion/coaching/qaa.json"
{
  "grammar_rules": [
    "One word can carry what English says in a whole clause: translate the meaning of the phrase, not word by word",
    "Nouns are animate or inanimate, and the verb ending follows the class: check the noun's class before choosing the verb form",
    "Write the standard Latin orthography; the script converter produces the display script",
    "Put the verb first in a command (button labels, menu items)"
  ],
  "dictionary": {
    "home": "<your term for home>",
    "settings": "<your term for settings>",
    "search": "<your term for search>",
    "welcome": "<your term for welcome>",
    "submit": "<your term for submit>",
    "cancel": "<your term for cancel>"
  },
  "style_notes": "Use the formal register. When the language has no term for an English technical word, write a descriptive phrase and keep the English word in parentheses after it."
}
```

### Felder

| Feld | Typ | Erforderlich | Beschreibung |
|-------|------|----------|-------------|
| `grammar_rules` | `string[]` | Nein | Array von Grammatikregeln, die in den System-Prompt eingefügt werden. Jede Regel sollte eine prägnante, umsetzbare Anweisung sein, der das LLM folgen kann. |
| `dictionary` | `object` | Nein | Schlüssel-Wert-Zuordnung von englischem Begriff → Begriff in der Zielsprache. Wird für domänenspezifisches Vokabular verwendet, das das LLM nicht kennen würde. |
| `style_notes` | `string` | Nein | Frei formulierte Stilanweisungen (Register, Ton, Konventionen zur Förmlichkeit). |

Alle Felder sind optional — Sie können mit nur einem Wörterbuch beginnen und Grammatikregeln hinzufügen, während Sie es verfeinern.

## Fallback-Verhalten

Wenn ein Sprachpaar für `llm-coached` konfiguriert ist, aber keine Coaching-Datei für diese Locale existiert, **greift champollion auf die Standardmethode `llm` zurück** und gibt eine Konsolenwarnung aus:

```
[INFO] No coaching data for "qaa" at .champollion/coaching/qaa.json
       Falling back to standard LLM method. Create coaching data for better results.
```

Das bedeutet, dass Sie `"defaultMethod": "llm-coached"` bedenkenlos global festlegen können — Sprachen mit Coaching-Daten verwenden diese, und die übrigen erhalten ohne Fehler eine standardmäßige LLM-Übersetzung.

## Wann Sie Coaching verwenden sollten

| Szenario | Empfohlene Methode |
|----------|-------------------|
| Tier-1-Sprachen (Französisch, Spanisch, Deutsch) | `llm` oder `google-translate` — LLMs kennen diese bereits gut |
| Tier-2-Sprachen (Koreanisch, Türkisch, Thai) | `llm` mit einem Register — LLMs bewältigen diese mit Stilhinweisen angemessen |
| Tier-3-Sprachen (Plains Cree, Yoruba, Quechua) | `llm-coached` — LLMs benötigen Grammatikregeln und Wörterbücher |
| Konstruierte Sprachen (Klingonisch, Sindarin, Kryptonisch) | `llm-coached` — LLMs verfügen über einige Trainingsdaten, benötigen aber Korrekturen |

## Gute Coaching-Daten erstellen

### Grammatikregeln

Formulieren Sie Regeln als **Anweisungen**, nicht als Beschreibungen. Das LLM folgt Anweisungen besser, als es linguistische Theorie interpretiert.

```json
// ❌ Descriptive (the LLM learns nothing actionable)
"This language has animate and inanimate noun classes"

// ✅ Instructive (the LLM knows what to do)
"When translating a noun, look up whether it is animate (NA) or inanimate (NI) in the dictionary — the class decides the verb ending"
```

### Wörterbücher

Konzentrieren Sie sich auf **domänenspezifische Begriffe**, die das LLM falsch übersetzen oder erfinden würde. Verschwenden Sie keine Mühe an gängige Wörter, die das LLM bereits beherrscht — konzentrieren Sie sich auf die für die Benutzeroberfläche Ihrer Anwendung spezifischen Begriffe.

**Das Wörterbuch wird bei jeder Methode geprüft.** Welche Methode auch immer ein
Paar übersetzt — ein gehostetes Modell, Ihr eigenes Modell über `local`, DeepL, ein `api`-Endpunkt —,
`champollion sync` prüft jeden übersetzten String anhand des
Wörterbuchs und gibt eine `[TERM]`-Warnung aus, die jeden nicht verwendeten Begriff benennt.
Nur `llm-coached` (im Prompt) und `deepl` (als DeepL-Glossar) wenden
es beim Übersetzen auch *an*; bei den anderen teilt Ihnen die Prüfung mit, welche
Strings korrigiert werden müssen, beispielsweise mit `champollion sync --method llm-coached
--redo keys:<key>`.

### Stilhinweise

Seien Sie präzise bei Register, Förmlichkeit und Konventionen:

```json
"style_notes": "Use formal register (vous-form in French). Preserve brand names untranslated. UI labels should be imperative mood ('Save', not 'Saves'). Maximum 40 characters for button text."
```

## Gecoachte Übersetzungen testen

Verwenden Sie das [MT Eval Harness](https://github.com/gamedaysuits/Champollion), um Ihre gecoachten Übersetzungen anhand eines Referenzkorpus zu benchmarken:

```bash
# Install the harness
python3 -m pip install mt-eval-harness

# Run coached translations against your test corpus
mt-eval run --corpus data/crk-corpus.json --model google/gemini-3.1-pro-preview

# Score the results
mt-eval test eval/logs/run_*.json
```

Dies liefert Ihnen chrF++-, BLEU- und Exact-Match-Werte. Erstellen Sie mehrere Versionen der Coaching-Datei und vergleichen Sie sie — objektive Metriken sind besser als subjektive Bewertungen.

---

## Siehe auch

- [Übersetzungsmethoden](/docs/guides/translation-methods) — die Methode llm-coached
- [Eine ressourcenarme Sprache unterstützen](/docs/network/community/low-resource-languages) — Coaching in der Praxis
- [Plugin-Spezifikation](/docs/reference/plugin-spec) — Verpacken von Coaching-Daten in einem Plugin
- [Quality Gate](/docs/concepts/quality-gate) — wie gecoachte Übersetzungen validiert werden
- [Konfiguration](/docs/getting-started/configuration) — Coaching-Konfiguration pro Sprachpaar
