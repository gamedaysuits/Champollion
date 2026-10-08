---
sidebar_position: 2
title: "Kochbuch: Angeleitetes LLM-Prompting"
related:
  - label: "Cookbook: Few-Shot Prompting"
    to: /docs/network/tutorials/few-shot-prompting
    kind: cookbook
  - label: "Cookbook: Fine-Tuned Model"
    to: /docs/network/tutorials/fine-tuned-model
    kind: cookbook
  - label: "Coaching Data"
    to: https://champollion.dev/docs/concepts/coaching-data
    kind: champollion
    note: "How coaching data ships to production"
  - label: "Submit a Method"
    to: /docs/network/getting-started/submit-a-method
    kind: guide
---

# Gecoachtes LLM-Prompting

> **Die Idee:** Grammatikregeln, zweisprachige Wörterbücher und Stilhinweise werden direkt in den System-Prompt des LLM injiziert. Kein Training, kein Fine-Tuning — nur strukturiertes linguistisches Wissen, das die Ausgabe in Richtung gültiger Übersetzungen lenkt.

:::info[Dies ist ein Kochbuch, keine fertige Implementierung]
Dieser Leitfaden skizziert den Ansatz und seine zentralen Designentscheidungen. Passen Sie ihn an Ihr Sprachpaar, die verfügbaren Ressourcen und Ihre Evaluierungsziele an.
:::

## Wann Sie dies verwenden sollten

- Sie verfügen über **linguistisches Wissen** zur Zielsprache (Grammatikregeln, Wörterbucheinträge, Stilpräferenzen), aber nicht über genügend parallele Daten für ein Fine-Tuning
- Sie möchten **schnell iterieren** — Prompt-Änderungen werden in Sekunden ausgerollt, kein erneutes Training
- Die Zielsprache weist **bekannte Muster** auf, die ein LLM falsch macht (Genuskongruenz, Schriftkonventionen, Formalitätsebenen)
- Sie möchten gecoachtes Prompting gegen eine Baseline benchmarken und an dem iterieren, was funktioniert

## Wie es funktioniert

1. **Coaching-Daten zusammenstellen** — Grammatikregeln, ein zweisprachiges Wörterbuch und Stilhinweise in einer strukturierten JSON-Datei
2. **Register konfigurieren** — ein System-Prompt-Präfix, das Sprache, Schrift und Ton festlegt
3. **Harness ausführen** — die Coaching-Daten werden in jeden LLM-Prompt injiziert
4. **Fehler überprüfen** — betrachten Sie, was das Quality-Gate ablehnt, und fügen Sie Regeln hinzu, um Muster zu adressieren
5. **Iterieren** — jede Revision der Coaching-Datei ist ein neues Experiment; das Harness verfolgt sie alle

## Struktur der Coaching-Daten

```json title="coaching/<locale>.json"
{
  "grammar_rules": [
    "Adjectives agree in gender and number with the noun they modify",
    "Use formal register (vous) for all UI text",
    "Preserve interpolation variables exactly: {{name}}, {count}"
  ],
  "dictionary": {
    "dashboard": "tableau de bord",
    "settings": "paramètres",
    "deploy": "déployer"
  },
  "style_notes": "Prefer active voice. Avoid anglicisms where a native term exists. Keep sentences concise for UI readability."
}
```

`mt-eval run --coaching-file` sendet den vollständigen Text der Datei unverändert an das Modell, sodass auch eine Markdown- oder reine Textdatei als Anleitung fungiert. Die oben dargestellte JSON-Struktur ergänzt eines: Wenn kein `--glossary` angegeben ist, dient dessen `dictionary` zugleich als Glossar für die Metrik **Terminologietreue**, welche für jeden in einem Quellsatz gefundenen Begriff aus dem Wörterbuch prüft, ob dessen Übersetzung in der Ausgabe erscheint (ein Begriff kann einer Übersetzung oder einer Liste zulässiger Übersetzungen zugeordnet sein). Dadurch wird der Durchlauf anhand seiner eigenen Anleitung bewertet. Um also einen angeleiteten Durchlauf mit einem unangeleiteten zu vergleichen, übergeben Sie beiden dieselbe Begriffsliste über `--glossary terms.json`. Diese wird ausschließlich für die Bewertung herangezogen und niemals an das Modell gesendet. Wird keines von beiden angegeben, bleibt die Metrik inaktiv.

## Zentrale Designentscheidungen

**Regelspezifität vs. Kontextfenster:** Mehr Regeln geben dem LLM mehr Orientierung, beanspruchen aber das für die eigentliche Übersetzung verfügbare Kontextfenster. Beginnen Sie mit 5–10 wirkungsvollen Regeln und fügen Sie weitere nur dann hinzu, wenn Sie spezifische Fehlermuster erkennen.

**Wörterbuchabdeckung:** Sie benötigen kein vollständiges Wörterbuch — konzentrieren Sie sich auf Begriffe, die das LLM konsequent falsch übersetzt. Schon 20–30 erzwungene Begriffe können die Konsistenz erheblich verbessern.

**Reihenfolge der Regeln ist entscheidend:** Stellen Sie die wichtigsten Regeln an den Anfang. LLMs beachten frühe Anweisungen stärker.

## Ein Experiment ausführen

```bash
mt-eval run \
  --corpus eval-amh-fra-globalvoices-test-v1 \
  --model google/gemini-2.5-pro \
  --name coached-v1 \
  --coaching-file coaching/crk.json
```

## Vor- und Nachteile

| | |
|---|---|
| ✅ Keine Trainingskosten | ❌ Qualitätsobergrenze durch das Basiswissen des LLM begrenzt |
| ✅ Sofortige Iteration (Prompt ändern → erneut ausführen) | ❌ Das Kontextfenster begrenzt, wie viel Coaching hineinpasst |
| ✅ Funktioniert mit jedem LLM-Anbieter | ❌ Regeln können in Konflikt geraten — das Debuggen von Prompt-Interaktionen ist eine Kunst |
| ✅ Transparent — Sie können genau lesen, was das LLM sieht | ❌ Erzeugt kein neues Wissen, sondern lenkt nur vorhandenes Wissen |

## Lässt sich gut kombinieren mit

- **[FST-Gated Pipeline](./fst-gated-pipeline)** — Coaching + morphologische Validierung erfasst, was Coaching allein übersieht
- **[Dictionary-Augmented LLM](./dictionary-augmented-llm)** — erzwungene Terminologie ist eine Form des Coachings
- **[Few-Shot Prompting](./few-shot-prompting)** — Beispiele + Regeln zusammen sind wirkungsvoller als jedes für sich allein

## Siehe auch

- [Method Interface](/docs/network/specifications/methods) — Format der Coaching-Daten und das TranslationMethod-Protokoll
- [Support a Low-Resource Language](/docs/network/community/low-resource-languages) — der vollständige Kontext
- [Eval Harness](/docs/network/specifications/harness) — wie Sie Experimente ausführen
