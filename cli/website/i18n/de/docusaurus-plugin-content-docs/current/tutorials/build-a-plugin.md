---
sidebar_position: 1
title: "Ein Übersetzungs-Plugin erstellen"
description: "Umfassendes Tutorial: Coaching-Daten entwickeln, mit dem Eval-Harness Benchmarks durchführen, ein Plugin exportieren und es mit champollion bereitstellen."
related:
  - label: "Plugin Specification"
    to: /docs/reference/plugin-spec
    kind: reference
    note: "The full plugin schema"
  - label: "Coaching Data"
    to: /docs/concepts/coaching-data
    kind: concept
    note: "What goes into a coached method"
  - label: "Serving a Custom Method as an API"
    to: /docs/guides/serving-a-method
    kind: guide
  - label: "Submit a Method"
    to: /docs/network/getting-started/submit-a-method
    kind: arena
    note: "Benchmark your plugin on the public leaderboard"
---

# Tutorial: Ein Übersetzungs-Plugin erstellen

Erstellen Sie eine benutzerdefinierte Übersetzungsmethode von Grund auf, führen Sie ein Benchmarking durch und stellen Sie sie als champollion-Plugin bereit. Dies ist der vollständige Workflow zum Hinzufügen eines neuen Sprachpaars, das von keiner Standard-API unterstützt wird.

**Was Sie erstellen werden:** Ein gecoachtes Übersetzungs-Plugin für formelles Französisch mit durchgesetzter Terminologie, Grammatikregeln und Benchmark-Werten.

**Dauer:** 30–45 Minuten

**Voraussetzungen:**
- champollion installiert (`npm install --save-dev champollion`)
- Ein OpenRouter-API-Schlüssel (`OPENROUTER_API_KEY`)
- Python 3.10+ (für das Eval-Harness)

---

## Schritt 1: Das Problem identifizieren

Sie übersetzen ein SaaS-Dashboard ins Französische. Die Standardmethode `llm` liefert korrekte, aber inkonsistente Übersetzungen:

- Manchmal wird aus „dashboard“ „tableau de bord“, ein anderes Mal „panneau de contrôle“
- Der Tonfall wechselt zwischen den Formen `tu` und `vous`
- Technische Begriffe werden inkonsistent anglisiert

Sie benötigen eine **Durchsetzung der Terminologie** und eine **Registerkontrolle**, die der generische LLM-Prompt nicht bietet.

## Schritt 2: Coaching-Daten erstellen

Erstellen Sie eine Coaching-Datei, die Ihre sprachlichen Anforderungen codiert:

```bash
mkdir -p .champollion/coaching
```

```json title=".champollion/coaching/fr.json"
{
  "grammar_rules": [
    "Always use the 'vous' form for formal register",
    "French adjectives agree in gender and number with their noun",
    "Use the present tense for UI instructions, not the imperative",
    "Preserve sentence-final punctuation style from the source"
  ],
  "dictionary": {
    "dashboard": "tableau de bord",
    "deployment": "déploiement",
    "settings": "paramètres",
    "environment variable": "variable d'environnement",
    "webhook": "webhook",
    "API key": "clé API",
    "sign in": "se connecter",
    "sign out": "se déconnecter",
    "repository": "dépôt",
    "pull request": "demande de tirage"
  },
  "style_notes": "Formal technical French. Prefer native French terms over anglicisms where established equivalents exist. Keep UI labels concise — 3 words maximum where possible."
}
```

**Was jedes Feld bewirkt:**
- **`grammar_rules`** — Als explizite Einschränkungen in den LLM-System-Prompt eingefügt
- **`dictionary`** — Wird mit den Quellschlüsseln abgeglichen; wenn ein Wörterbuchbegriff auftritt, wird er als „erforderliche Terminologie“ in den Prompt eingefügt
- **`style_notes`** — Als allgemeine Stilrichtlinie an den System-Prompt angehängt

## Schritt 3: Das Paar konfigurieren

Weisen Sie champollion an, `llm-coached` für Französisch zu verwenden:

```json title="champollion.config.json"
{
  "version": 3,
  "inputLocale": "en",
  "localesDir": "./locales",
  "pairs": {
    "en:fr": {
      "method": "llm-coached",
      "model": "google/gemini-3.5-flash",
      "temperature": 0.2
    }
  },
  "languages": {
    "fr": {
      "register": "Formal technical French (vous-form)",
      "name": "French"
    }
  }
}
```

## Schritt 4: Testen

```bash
npx champollion sync --dry
```

Überprüfen Sie die Dry-Run-Ausgabe. Stellen Sie sicher, dass:
- ✅ Wörterbuchbegriffe konsistent verwendet werden („tableau de bord“, nicht „panneau de contrôle“)
- ✅ Durchgehend die Form `vous` verwendet wird
- ✅ Technische Begriffe mit Ihrem Wörterbuch übereinstimmen

Führen Sie dann die eigentliche Synchronisierung durch:

```bash
npx champollion sync
```

## Schritt 5: Benchmarking mit dem Eval-Harness (optional)

Wenn Sie Qualitätswerte möchten – und das möchten Sie, denn Plugins werden mit Benchmark-Daten ausgeliefert – verwenden Sie das begleitende Eval-Harness.

### Das Harness installieren

```bash
pip install mt-eval-harness
```

### Einen Referenzkorpus erstellen

Erstellen Sie eine Datei mit Quelltexten und bekannt guten Übersetzungen:

```json title="corpus/french-formal.json"
[
  {
    "source": "Dashboard",
    "reference": "Tableau de bord"
  },
  {
    "source": "Sign in to your account",
    "reference": "Connectez-vous à votre compte"
  },
  {
    "source": "Your deployment is ready",
    "reference": "Votre déploiement est prêt"
  },
  {
    "source": "Environment variables",
    "reference": "Variables d'environnement"
  }
]
```

### Den Benchmark ausführen

```bash
mt-eval test \
  --corpus corpus/french-formal.json \
  --source en \
  --target fr \
  --model google/gemini-3.5-flash \
  --temperature 0.2 \
  --champollion-config champollion.config.json
```

Das Harness gibt aus:
- **chrF++** — F-Wert auf Zeichenebene (0–100). Über 70 ist stark.
- **BLEU** — N-Gramm-Überlappung (0–100). Über 40 ist solide für gecoachte Übersetzung.
- **Exact-Match-Rate** — Anteil der Übersetzungen, die exakt mit der Referenz übereinstimmen.
- **COMET** — Neuronale Qualitätsmetrik (falls über `mt-eval setup --comet` installiert).

:::tip[Testen Sie, was Sie ausliefern]
Bei Verwendung von `--champollion-config` werden Ihr Produktionsmodell, Register, Ihre Temperatur und Coaching-Daten direkt aus Ihrer `champollion.config.json` importiert. Dadurch wird sichergestellt, dass Sie genau die Methode benchmarken, die Sie bereitstellen werden.
:::

### Das Plugin exportieren

Sobald Sie mit den Werten zufrieden sind:

```bash
mt-eval export \
  --name french-formal-v1 \
  --report eval/logs/harness/run_report.json \
  --output ./french-formal-v1/
```

Dadurch wird Folgendes erstellt:

```
french-formal-v1/
├── method.json          # Manifest with config + benchmarks
└── coaching/
    └── fr.json          # Your coaching data
```

## Schritt 6: Das Plugin in Champollion installieren

```bash
npx champollion plugin install ./french-formal-v1/
```

Dadurch wird das Plugin nach `.champollion/methods/french-formal-v1/` kopiert.

Aktualisieren Sie Ihre Konfiguration, um es zu verwenden:

```json title="champollion.config.json"
{
  "pairs": {
    "en:fr": {
      "methodPlugin": "french-formal-v1"
    }
  }
}
```

## Schritt 7: Überprüfen

```bash
# Check plugin is installed and shows benchmark scores
npx champollion status

# Run a sync with the plugin
npx champollion sync

# Audit licensing status
npx champollion provenance
```

Die Ausgabe von `status` zeigt Folgendes an:

```
en → fr
  Method:    french-formal-v1 (llm-coached)
  Model:     google/gemini-3.5-flash
  Quality:   high
  chrF++:    74.2
  BLEU:      46.8
  Exact:     42%
```

## Was Sie erstellt haben

```mermaid
flowchart LR
    A["Coaching data\n(grammar + dictionary)"] --> B["Eval harness\n(benchmark)"]
    B --> C["method.json\n(export)"]
    C --> D["champollion plugin install"]
    D --> E["champollion sync\n(production)"]
```

Sie verfügen nun über:
1. **Coaching-Daten** — Grammatikregeln und Terminologie, die Konsistenz durchsetzen
2. **Benchmark-Werte** — Quantifizierte Qualität, die mit dem Plugin ausgeliefert wird
3. **Ein portables Plugin** — `method.json` + Coaching-Daten, auf jedem Rechner installierbar
4. **Produktions-Deployment** — Integriert in Ihre Synchronisierungs-Pipeline

## Nächste Schritte

- **[Plugin-Spezifikation](/docs/reference/plugin-spec)** — Vollständige Referenz zum Manifest-Format
- **[Übersetzungsmethoden](/docs/guides/translation-methods)** — Vergleichen Sie alle vier Methoden
- **[Ressourcenarme Sprachen](/docs/network/community/low-resource-languages)** — Wenden Sie dieses Muster auf Sprachen ohne API-Abdeckung an
- **[30 Sprachen übersetzen](/docs/tutorials/translate-30-languages)** — Skalieren Sie Ihr Projekt für ein globales Publikum
