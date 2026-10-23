---
sidebar_position: 2
title: "Schnellstart"
related:
  - label: "Installation"
    to: /docs/getting-started/installation
    kind: guide
  - label: "Configuration"
    to: /docs/getting-started/configuration
    kind: reference
    note: "Every config field, explained"
  - label: "Troubleshooting"
    to: /docs/guides/troubleshooting
    kind: guide
---

# Schnellstart

Übersetzen Sie Ihre erste Sprachdatei in 60 Sekunden.

Die CLI ist für die nicht-kommerzielle Nutzung unter der
[PolyForm Noncommercial License 1.0.0](https://github.com/gamedaysuits/Champollion/blob/main/cli/LICENSE) kostenlos; die kommerzielle Nutzung ist durch diese
Lizenz nicht abgedeckt. Eine Schule, ein öffentliches Krankenhaus oder eine Klinik, eine gemeinnützige Organisation oder ein persönliches Projekt sind abgedeckt; der Online-Auftritt eines Geschäfts
ist es nicht. Unter [Wer dies nutzen darf](/docs/getting-started/who-may-use-this) finden Sie alle Einzelheiten.

## 1. Richten Sie Ihre Sprachdateien ein

Erstellen Sie eine Quellsprachdatei. Champollion unterstützt JSON, TOML, YAML und mehr – die vollständige Liste finden Sie in der [CLI-Referenz](/docs/reference/cli):

```json title="locales/en.json"
{
  "hero": {
    "title": "Welcome to our platform",
    "subtitle": "Build something amazing"
  },
  "nav": {
    "home": "Home",
    "about": "About",
    "contact": "Contact"
  }
}
```

## 2. Richten Sie Ihren API-Schlüssel ein

Wählen Sie einen Anbieter und hinterlegen Sie den Schlüssel:

```bash
# Option A: OpenRouter (200+ models, recommended)
export OPENROUTER_API_KEY=sk-or-v1-...

# Option B: Gemini (free tier — zero cost to start)
export GEMINI_API_KEY=AI...

# Option C: a model on your own machine (Ollama, LM Studio, vLLM) — no key
#   nothing to export if it listens on Ollama's default http://localhost:11434/v1
#   another server: export LOCAL_API_BASE=http://localhost:8000/v1 (its address; or put that line in .env.local or .env)
```

Holen Sie sich einen kostenlosen Gemini-Schlüssel unter [aistudio.google.com/apikey](https://aistudio.google.com/apikey). Einen OpenRouter-Schlüssel erhalten Sie unter [openrouter.ai](https://openrouter.ai). Für Option C geben Sie Ihr Modell bei der Einrichtung des Projekts an: `npx champollion init --yes --langs fr,de --method local --model llama3.1` (oder führen Sie `sync --method local --model llama3.1` aus).

## 3. Führen Sie die Synchronisierung aus

```bash
npx champollion sync
```

:::note[Von Ihnen eingegeben oder von einem Skript ausgeführt?]
Die Befehle auf dieser Seite tippen Sie selbst ein: `npx champollion` führt die Version aus, die Ihr Projekt installiert hat, oder diejenige, die npx abruft – beim ersten Mal die neueste Version, danach die zwischengespeicherte Kopie. Ein Befehl, den ein Skript für Sie ausführt – CI, ein `package.json`-Skript, ein Git-Hook –, sollte seine Version explizit benennen, `npx --yes champollion@0.6 sync`, damit eine neue Version niemals ändert, was der Build ausführt (und `--yes` verhindert, dass npx nachfragt). Der [CI-Leitfaden](/docs/guides/ci-cd) und die [Framework-Seiten](/docs/integrations/frameworks) pinnen die Version auf diese Weise fest.
:::

:::tip[Nutzen Sie Gemini?]
Wenn Sie Option B (Gemini) gewählt haben, fügen Sie `--method gemini` hinzu:
```bash
npx champollion sync --method gemini
```
:::

Champollion wird:
1. `locales/en.json` automatisch als Quelle erkennen
2. Zielsprachen finden (oder danach fragen)
3. Alle Schlüssel übersetzen
4. `locales/fr.json`, `locales/ja.json` usw. schreiben
5. `.champollion.lock` anlegen, um nachzuhalten, was übersetzt wurde

## 4. Prüfen Sie die Ergebnisse

```bash
cat locales/fr.json
```

```json
{
  "hero": {
    "title": "Bienvenue sur notre plateforme",
    "subtitle": "Construisez quelque chose d'incroyable"
  },
  "nav": {
    "home": "Accueil",
    "about": "À propos",
    "contact": "Contact"
  }
}
```

## Was passiert als Nächstes?

Wenn Sie eine Quellzeichenfolge ändern, erkennt Champollion die Änderung über SHA-256-Hash-Tracking und übersetzt bei der nächsten Synchronisierung nur diesen Schlüssel neu:

```json title="locales/en.json (updated)"
{
  "hero": {
    "title": "Welcome to Acme Platform",  // ← changed
    "subtitle": "Build something amazing"  // ← unchanged, skipped
  }
}
```

```bash
npx champollion sync
# Only "hero.title" is re-translated across all locales
```

Der unveränderte Schlüssel (`hero.subtitle`) wird **übersprungen**: Seine Übersetzung befindet sich bereits in `locales/fr.json`, sodass er nirgendwohin gesendet und nicht einmal nachgeschlagen wird – kein Aufruf, keine Kosten und nicht in der Zahl „aus dem Cache bedient“ des Durchlaufs mitgezählt.

Das **Translation Memory** (`.champollion/tm.json`, das bei jeder Synchronisierung automatisch aufgebaut wird) ist für Text gedacht, der *tatsächlich* in der Warteschlange steht: eine Zeichenfolge, die Sie wieder zurückändern, derselbe Satz in einer anderen Datei, eine Neuübersetzung einer gesamten Sprachversion (`sync --redo all`). Diese werden kostenlos aus dem Cache bedient, und die Statuszeile des Durchlaufs gibt an, wie viele es waren (`… 0 key(s) sent to the model, 12 served from the cache (free)`). Der Cache wird pro Methode, Sprachebene und Coaching geführt – jeweils für das Sprachpaar und dessen Fallback. Nach einem Methodenwechsel (etwa `local` → `llm`) oder dem Ändern des Textes einer Coaching-Datei (beim Sprachpaar, seiner Sprache oder seinem Fallback) wird nichts wiederverwendet und der Durchlauf erklärt den Grund; ein reiner Modellwechsel verwendet frühere Übersetzungen weiter. Eine Änderung führt für sich allein zu keiner Neuübersetzung: `sync` nennt die Neuübersetzung und ihren Preis.

## Optional: Konfigurationsdatei erstellen

Für mehr Kontrolle generieren Sie eine Konfigurationsdatei:

```bash
npx champollion init                         # guided wizard
npx champollion init --yes --langs fr,de,ja  # quick setup with specific targets
npx champollion init --yes --langs fr,de --method local --model llama3.1   # a model on this machine
```

`--method` und `--model` wählen die Übersetzungsmethode und das Modell (`npx champollion init --help` listet die Methoden auf); init gibt aus, welche die Konfiguration verwendet.

Der geführte Assistent leitet Sie durch die **Sprachebenen-Voreinstellungen** jeder Sprache – vorgefertigte Anweisungen zu Tonfall und Formalität, die auf das jeweilige Sprachsystem abgestimmt sind. Für Französisch gibt es T-V-Voreinstellungen (Vouvoiement vs. Tutoiement), für Koreanisch Sprachebenen (해요체 vs. 합쇼체 vs. 해체), für Japanisch Keigo-Optionen (です/ます vs. 丁寧語).

Oder erstellen Sie eine Konfiguration manuell mit Voreinstellungsschlüsseln:

```json title="champollion.config.json"
{
  "version": 3,
  "inputLocale": "en",
  "localesDir": "./locales",
  "languages": {
    "fr": "casual-tu",
    "ko": "polite-haeyo",
    "ja": "polite"
  },
  "model": "google/gemini-3.8-flash"
}
```

Führen Sie `npx champollion init` aus, um die verfügbaren Voreinstellungen für jede Sprache zu durchsuchen.

## Optional: Beobachtungsmodus

Automatisch übersetzen, wenn sich Ihre Quelldatei ändert:

```bash
npx champollion watch
```

## Nächste Schritte

- **[Konfiguration](/docs/getting-started/configuration)** – Vollständige Konfigurationsreferenz
- **[Übersetzungsmethoden](/docs/guides/translation-methods)** – Wählen Sie die passende Methode pro Sprachpaar
- **[Translation Memory](/docs/concepts/translation-memory)** – Wie Caching Ihnen bei erneuten Durchläufen Geld spart
- **[Zusammenarbeit mit professionellen Übersetzern](/docs/guides/professional-translators)** – XLIFF zur menschlichen Überprüfung exportieren
- **[Framework-Integration](/docs/integrations/frameworks)** – Hugo, next-intl, react-i18next
- **[CI/CD](/docs/guides/ci-cd)** – Übersetzungen in Ihrer Pipeline automatisieren
- **[Fehlerbehebung](/docs/guides/troubleshooting)** – Häufige Probleme und Lösungen
