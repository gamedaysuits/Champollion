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

## Funktionsweise

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

1. **Strukturierte Coaching-Daten** (Methode `llm-coached`) — Grammatikregeln, Wörterbücher und Stilhinweise im JSON-Format. Werden aus `.champollion/coaching/<locale>.json` oder dem Verzeichnis `coaching/` eines Plugins geladen.
2. **Freitext-Coaching-Prompt** (Konfigurationsfeld `coachingFile`) — Eine Klartextdatei mit zusätzlichen Hinweisen, die in den System-Prompt eingefügt werden. Funktioniert mit jeder LLM-Methode, nicht nur mit `llm-coached`. Wird über `coachingFile` in Ihrer Konfiguration oder `--coaching-file` auf der CLI festgelegt.

Beide können zusammen verwendet werden. Das Eval-Harness verwendet exakt dieselbe Prompt-Struktur — sodass Ihre Benchmark-Werte Ihre tatsächlichen Produktions-Prompts widerspiegeln.

Da die Coaching-Daten Teil der Systemnachricht sind, profitieren sie vom **Prompt-Caching** — Anbieter wie Anthropic und Google cachen wiederholte System-Präfixe, sodass Sie den Coaching-Kontext nur einmal pro Sitzung bezahlen, nicht einmal pro Batch.

## Format der Coaching-Datei

Erstellen Sie eine JSON-Datei pro Locale in `.champollion/coaching/`:

```json title=".champollion/coaching/crk.json"
{
  "grammar_rules": [
    "Plains Cree is polysynthetic — a single word can express what English needs a full sentence for",
    "Animate/inanimate noun distinction affects verb conjugation",
    "Use SRO (Standard Roman Orthography) unless script converter handles conversion",
    "Verb stems are modified by prefixes and suffixes to indicate person, number, tense, and evidentiality"
  ],
  "dictionary": {
    "home": "kīwēwin",
    "settings": "isi-nākatohkēwin",
    "search": "nānātawāpahtam",
    "welcome": "tānisi",
    "submit": "ispīhci",
    "cancel": "pōni"
  },
  "style_notes": "Use formal register. Preserve English technical terms in parentheses when no Cree equivalent exists. Avoid loanwords when a descriptive Cree expression exists."
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
[INFO] No coaching data for "crk" at .champollion/coaching/crk.json
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
"Plains Cree has animate and inanimate noun classes"

// ✅ Instructive (the LLM knows what to do)
"When translating nouns, check whether the Cree equivalent is animate (NA) or inanimate (NI) — this affects which verb conjugation to use"
```

### Wörterbücher

Konzentrieren Sie sich auf **domänenspezifische Begriffe**, die das LLM falsch übersetzen oder erfinden würde. Verschwenden Sie keine Mühe an gängige Wörter, die das LLM bereits beherrscht — konzentrieren Sie sich auf die für die Benutzeroberfläche Ihrer Anwendung spezifischen Begriffe.

### Stilhinweise

Seien Sie präzise bei Register, Förmlichkeit und Konventionen:

```json
"style_notes": "Use formal register (vous-form in French). Preserve brand names untranslated. UI labels should be imperative mood ('Save', not 'Saves'). Maximum 40 characters for button text."
```

## Gecoachte Übersetzungen testen

Verwenden Sie das [MT Eval Harness](https://github.com/gamedaysuits/Champollion), um Ihre gecoachten Übersetzungen anhand eines Referenzkorpus zu benchmarken:

```bash
# Install the harness
pip install mt-eval-harness

# Run coached translations against your test corpus
mt-eval run --corpus data/crk-corpus.json --model google/gemini-2.5-pro

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
