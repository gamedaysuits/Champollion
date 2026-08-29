---
sidebar_position: 2
title: "30 Sprachen übersetzen"
description: "Kochbuch: Skalieren Sie ein Projekt von 3 auf 30 Sprachen durch paarweise Methodenmischung, Batch-Verarbeitung und CI-Integration."
related:
  - label: "Writing-style & register metrics"
    to: /docs/network/specifications/harness#writing-style-and-register-metrics-informational
    kind: arena
    note: "Measure register adherence with the eval harness"
  - label: "Register"
    to: /glossary#term-register
    kind: glossary
    note: "What a register is, in plain language"
  - label: "Translation Methods"
    to: /docs/guides/translation-methods
    kind: guide
    note: "When to mix LLM, Google Translate, and coached pairs"
  - label: "Quality Gate"
    to: /docs/concepts/quality-gate
    kind: concept
    note: "How every translation is validated before it lands"
  - label: "CI/CD"
    to: /docs/guides/ci-cd
    kind: guide
    note: "Keep 30 locales current on every push"
---

# Cookbook: 30 Sprachen übersetzen

Skalieren Sie ein Projekt von einer Handvoll Locales auf globale Abdeckung. Dieses Cookbook führt durch die Methodenauswahl, Kostenoptimierung und CI-Integration für eine reale mehrsprachige Bereitstellung.

**Szenario:** Sie haben eine SaaS-App mit `en`, `fr`, `es`. Sie müssen 27 weitere Sprachen über drei Stufen von Qualitätsanforderungen hinzufügen.

---

## Schritt 1: Kategorisieren Sie Ihre Sprachen

Nicht alle 30 Sprachen benötigen denselben Ansatz. Gruppieren Sie sie nach der verfügbaren Methodenqualität:

| Stufe | Sprachen | Methode | Grund |
|------|-----------|--------|-----|
| **Stufe 1 — Premium** | `ja`, `ko`, `zh`, `de`, `pt` | `llm` (GPT-4o) | Hochwertige Märkte, nuancierte Grammatik |
| **Stufe 2 — Standard** | `it`, `nl`, `pl`, `sv`, `da`, `fi`, `no`, `cs`, `ro`, `hu`, `el`, `tr`, `id`, `ms`, `th`, `vi`, `uk`, `bg` | `google-translate` | Hohes Volumen, gut von Google unterstützt |
| **Stufe 3 — Coached** | `crk`, `oj`, `mi`, `haw` | `llm-coached` + Plugins | Ressourcenarm, erfordern Terminologiedurchsetzung |

## Schritt 2: Konfiguration pro Sprachpaar

```json title="champollion.config.json"
{
  "version": 3,
  "inputLocale": "en",
  "localesDir": "./locales",
  "defaultMethod": "google-translate",
  "model": "google/gemini-3.5-flash",
  "languages": {
    "ja": { "name": "Japanese", "register": "Polite/formal" },
    "ko": { "name": "Korean", "register": "Formal" },
    "zh": { "name": "Simplified Chinese", "register": "Neutral" },
    "de": { "name": "German", "register": "Formal (Sie)" },
    "pt": { "name": "Brazilian Portuguese", "register": "Informal" },
    "crk": { "name": "Plains Cree (SRO)", "register": "Neutral" }
  },
  "pairs": {
    "en:ja": { "method": "llm", "model": "openai/gpt-4o" },
    "en:ko": { "method": "llm", "model": "openai/gpt-4o" },
    "en:zh": { "method": "llm", "model": "openai/gpt-4o" },
    "en:de": { "method": "llm", "model": "openai/gpt-4o" },
    "en:pt": { "method": "llm", "model": "openai/gpt-4o" },
    "en:crk": { "methodPlugin": "crk-coached-v1" }
  }
}
```

**Hinweis:** Sprachen, die nicht in `pairs` aufgeführt sind, erben `defaultMethod: "google-translate"`. Sie müssen nicht alle 30 auflisten.

:::info
Die Unterstützung für `crk` befindet sich in der Entwicklung — siehe [Eine ressourcenarme Sprache unterstützen](/docs/network/community/low-resource-languages) für den Status und die Beitragsrichtlinien.
:::

## Schritt 3: API-Schlüssel einrichten

Für diese Konfiguration benötigen Sie beide API-Schlüssel:

```bash
export OPENROUTER_API_KEY="sk-or-v1-..."
export GOOGLE_TRANSLATE_API_KEY="AIza..."
```

## Schritt 4: Zunächst ein Dry Run

Erstellen Sie stets eine Vorschau, bevor Sie 30 Sprachen übersetzen:

```bash
npx champollion sync --dry
```

Prüfen Sie die Ausgabe. Sie zeigt:
- Welche Sprachpaare welche Methode verwenden
- Wie viele Schlüssel pro Locale neu/geändert sind
- Geschätzte API-Aufrufe pro Stufe

## Schritt 5: Die Synchronisierung ausführen

```bash
npx champollion sync
```

Champollion verarbeitet jedes Sprachpaar unabhängig. Die Stufe-2-Sprachpaare, die Google Translate verwenden, sind schnell. Stufe-1-LLM-Sprachpaare sind langsamer, aber von höherer Qualität. Stufe-3-Coached-Sprachpaare verwenden die Coaching-Daten des Plugins.

### Inkrementelle Aktualisierungen

Nach der ersten Synchronisierung übersetzen nachfolgende Durchläufe nur **geänderte oder neue** Schlüssel:

```bash
# Only keys that changed since last sync
npx champollion sync
```

Die Lock-Datei (`.champollion.lock`) verfolgt, was bereits übersetzt wurde, sodass Sie stabile Inhalte niemals erneut übersetzen.

## Schritt 6: Qualität prüfen

Überprüfen Sie den Status aller Sprachpaare:

```bash
npx champollion status
```

Dies gibt eine Tabelle aus, die für jedes Sprachpaar die Methode, das Modell, die Qualitätsstufe sowie die Verfügbarkeit von Coaching-Daten oder Benchmark-Werten anzeigt.

### Hat die Ausgabe Ihre Register beachtet?

In Schritt 2 haben Sie ein [Register](/glossary#term-register) pro Sprache festgelegt — `"Polite/formal"` für Japanisch, `"Formal (Sie)"` für Deutsch. (Der Begriff ist Ihnen neu? Das Glossar erklärt ihn in einfacher Sprache.) Diese Anweisungen gehen in den Übersetzungsprompt ein, aber ein Prompt ist eine Aufforderung, keine Garantie.

Der [Network-Harness](/docs/network/specifications/harness) — dasselbe Werkzeug, das die öffentliche Bestenliste antreibt — kann die Register- und Stiltreue anhand einer Stichprobe Ihrer Übersetzungen messen. Seine Metriken zum Schreibstil prüfen jede Ausgabe gegen das erwartete Register (Formalitäts-/Informalitätsmarker, T–V-Pronomen, Kontraktionen, Abweichungen der Satzlänge) und melden einen `style_consistency_rate` über den gesamten Durchlauf hinweg. Sie können es auch mit `--style-profile` auf ein benutzerdefiniertes Brand-Voice-Profil richten.

```bash
# install the harness, then run your sample corpus through it
pipx install mt-eval-harness
mt-eval run --corpus my-sample.json --style-profile brand-voice.json
```

Zwei ehrliche Einschränkungen: Diese Metriken sind **informativ** (sie fließen niemals in die Gesamtwertung der Bestenliste ein), und die Formalitätserkennung ist markerbasiert — ein Abweichungsdetektor, kein menschliches Urteil. Details und Metrikdefinitionen: [Metriken zu Schreibstil und Register](/docs/network/specifications/harness#writing-style-and-register-metrics-informational).

## Schritt 7: CI-Integration

Fügen Sie dies Ihrem GitHub-Actions-Workflow hinzu, damit die Übersetzungen bei jedem Push aktuell bleiben:

```yaml title=".github/workflows/i18n-sync.yml"
name: Sync Translations
on:
  push:
    paths:
      - 'locales/en/**'

jobs:
  translate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - run: npm ci

      - name: Sync translations
        run: npx champollion sync
        env:
          OPENROUTER_API_KEY: ${{ secrets.OPENROUTER_API_KEY }}
          GOOGLE_TRANSLATE_API_KEY: ${{ secrets.GOOGLE_TRANSLATE_API_KEY }}

      - name: Commit updated translations
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add locales/
          git diff --staged --quiet || git commit -m "chore(i18n): sync translations"
          git push
```

## Kostenschätzung

Für ein Projekt mit 500 Quellschlüsseln über 30 Sprachen:

| Stufe | Sprachen | Methode | Ungefähre Kosten |
|------|-----------|--------|-----------------|
| Stufe 1 (5 Sprachen) | ja, ko, zh, de, pt | GPT-4o | ~$2,50/vollständige Synchronisierung |
| Stufe 2 (18 Sprachen) | it, nl, pl, usw. | Google Translate | ~$0,90/vollständige Synchronisierung |
| Stufe 3 (4 Sprachen) | crk, oj, mi, haw | GPT-4o-mini coached | ~$0,40/vollständige Synchronisierung |
| **Gesamt** | **30 Sprachen** | **Gemischt** | **~$3,80/vollständige Synchronisierung** |

Inkrementelle Synchronisierungen (5–20 geänderte Schlüssel) kosten nur einen Bruchteil einer vollständigen Synchronisierung.

## Siehe auch

- [Übersetzungsmethoden](/docs/guides/translation-methods) — Wie jede Übersetzungsmethode funktioniert und wann sie zu verwenden ist
- [Plugin-Spezifikation](/docs/reference/plugin-spec) — Erstellen Sie Coaching-Daten für beliebige Ihrer Stufe-3-Sprachen
- [CI/CD-Leitfaden](/docs/guides/ci-cd) — Fortgeschrittene CI-Muster einschließlich PR-Vorschau-Builds
- [Quality Gate](/docs/concepts/quality-gate) — Wie Champollion jede Übersetzung validiert, bevor sie geschrieben wird
- [Unterstützte Sprachen](/docs/reference/supported-languages) — Vollständige Liste der Sprachcodes und Methodenkompatibilität
- [Metriken zu Schreibstil und Register](/docs/network/specifications/harness#writing-style-and-register-metrics-informational) — Messen Sie die Register-/Stiltreue mit dem Eval-Harness (informative Metriken)
- [Glossar: Register](/glossary#term-register) — Was „Register" in einfacher Sprache bedeutet
- [Eine ressourcenarme Sprache unterstützen](/docs/network/community/low-resource-languages) — Fügen Sie Coaching-Daten für Sprachen ohne breite MÜ-Abdeckung hinzu
