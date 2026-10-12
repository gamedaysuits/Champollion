---
sidebar_position: 2
title: "Schnelleinstieg"
related:
  - label: "Installation"
    to: /docs/getting-started/installation
    kind: guide
  - label: "Configuration"
    to: /docs/getting-started/configuration
    kind: reference
    note: "Every config field, explained"
  - label: "Cookbook: Translate 30 Languages"
    to: /docs/tutorials/translate-30-languages
    kind: cookbook
    note: "Scale from three locales to thirty"
  - label: "Troubleshooting"
    to: /docs/guides/troubleshooting
    kind: guide
---

# Schnellstart

Übersetzen Sie Ihre erste Locale-Datei in 60 Sekunden.

Das CLI ist für die nicht-kommerzielle Nutzung unter der
[PolyForm Noncommercial License 1.0.0](https://github.com/gamedaysuits/Champollion/blob/main/cli/LICENSE) kostenlos; eine kommerzielle Nutzung wird von dieser Lizenz nicht abgedeckt. Eine Schule, ein öffentliches Krankenhaus oder eine Klinik, eine gemeinnützige Organisation oder ein persönliches Projekt sind abgedeckt; die Storefront eines Geschäfts ist es nicht. [Wer dies nutzen darf](/docs/getting-started/who-may-use-this) erläutert dies ausführlich.

## 1. Richten Sie Ihre Locale-Dateien ein

Erstellen Sie eine Quell-Locale-Datei. Champollion unterstützt JSON, TOML, YAML und mehr – die vollständige Liste finden Sie in der [CLI-Referenz](/docs/reference/cli):

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

## 2. Legen Sie Ihren API-Schlüssel fest

Wählen Sie einen Anbieter und legen Sie den Schlüssel fest:

```bash
# Option A: OpenRouter (200+ models, recommended)
export OPENROUTER_API_KEY=sk-or-v1-...

# Option B: Gemini (free tier — zero cost to start)
export GEMINI_API_KEY=AI...

# Option C: a model on your own machine (Ollama, LM Studio, vLLM) — no key
#   nothing to export if it listens on Ollama's default http://localhost:11434/v1
#   another server: export LOCAL_API_BASE=http://localhost:8000/v1 (its address; or put that line in .env.local or .env)
```

Holen Sie sich einen kostenlosen Gemini-Schlüssel unter [aistudio.google.com/apikey](https://aistudio.google.com/apikey). Einen OpenRouter-Schlüssel erhalten Sie unter [openrouter.ai](https://openrouter.ai). Geben Sie für Option C Ihr Modell an, wenn Sie das Projekt einrichten: `npx champollion init --yes --langs fr,de --method local --model llama3.1` (oder führen Sie `sync --method local --model llama3.1` aus).

## 3. Führen Sie Sync aus

```bash
npx champollion sync
```

:::note[Selbst eingegeben oder per Skript ausgeführt?]
Die Befehle auf dieser Seite tippen Sie selbst ein: `npx champollion` führt die Version aus, die Ihr Projekt installiert hat, oder diejenige, die npx abruft – beim ersten Mal das neueste Release, danach diese zwischengespeicherte Version. Ein Befehl, den ein Skript für Sie ausführt – CI, ein `package.json`-Skript, ein Git-Hook –, sollte die Versionsnummer explizit angeben, `npx --yes champollion@0.5 sync`, damit ein neues Release niemals ändert, was der Build ausführt (und `--yes` verhindert, dass npx anhält, um nachzufragen). Der [CI-Leitfaden](/docs/guides/ci-cd) und die [Framework-Seiten](/docs/integrations/frameworks) pinnen die Version auf diese Weise fest.
:::

:::tip[Verwenden Sie Gemini?]
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
5. `.champollion.lock` erstellen, um nachzuverfolgen, was übersetzt wurde

## 4. Überprüfen Sie die Ergebnisse

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

Wenn Sie eine Quellzeichenkette ändern, erkennt champollion die Änderung über SHA-256-Hash-Tracking und übersetzt beim nächsten Sync nur diesen Schlüssel neu:

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

Der unveränderte Schlüssel (`hero.subtitle`) wird **übersprungen**: Seine Übersetzung befindet sich bereits in `locales/fr.json`, daher wird er nirgendwohin gesendet und nicht einmal nachgeschlagen – kein Aufruf, keine Kosten und er wird nicht in der Angabe „aus dem Cache bereitgestellt“ des Durchlaufs gezählt.

Das **Translation Memory** (`.champollion/tm.json`, das bei jeder Synchronisierung automatisch aufgebaut wird) ist für Text gedacht, der *tatsächlich* in die Warteschlange eingereiht ist: eine Zeichenkette, die Sie zurückändern, derselbe Satz in einer anderen Datei, eine vollständige Wiederholung eines Locales (`sync --redo all`). Diese werden kostenlos aus dem Cache bereitgestellt, und die Ausführungszeile gibt an, wie viele (`… 0 key(s) sent to the model, 12 served from the cache (free)`). Der Cache wird pro Methode, Sprachregister und Coaching verwaltet – jeweils für das Paar und seinen Fallback. Nach dem Wechseln der Methode (etwa `local` → `llm`) oder dem Ändern des Textes einer Coaching-Datei (für das Paar, seine Sprache oder seinen Fallback) wird nichts wiederverwendet und der Durchlauf gibt den Grund dafür an; ein reiner Modellwechsel verwendet frühere Übersetzungen weiter. Eine Änderung führt für sich allein nicht zu einer Neuübersetzung: `sync` nennt die Wiederholung und ihren Preis.

## Optional: Erstellen Sie eine Konfigurationsdatei

Für mehr Kontrolle generieren Sie eine Konfigurationsdatei:

```bash
npx champollion init                         # guided wizard
npx champollion init --yes --langs fr,de,ja  # quick setup with specific targets
npx champollion init --yes --langs fr,de --method local --model llama3.1   # a model on this machine
```

`--method` und `--model` wählen die Übersetzungsmethode und das Modell aus (`npx champollion init --help` listet die Methoden auf); init gibt aus, welche die Konfiguration verwendet.

Der geführte Assistent führt Sie durch die **Register-Voreinstellungen** jeder Sprache — vorgefertigte Ton-/Förmlichkeitsanweisungen, die auf das jeweilige linguistische System abgestimmt sind. Französisch verfügt über T-V-Voreinstellungen (vouvoiement vs. tutoiement), Koreanisch über Sprechebenen (해요체 vs. 합쇼체 vs. 해체), Japanisch über Keigo-Optionen (です/ます vs. 丁寧語).

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

## Optional: Watch-Modus

Automatisches Übersetzen, wenn sich Ihre Quelldatei ändert:

```bash
npx champollion watch
```

## Nächste Schritte

- **[Konfiguration](/docs/getting-started/configuration)** — Vollständige Konfigurationsreferenz
- **[Übersetzungsmethoden](/docs/guides/translation-methods)** — Wählen Sie die richtige Methode pro Sprachpaar
- **[Translation Memory](/docs/concepts/translation-memory)** — Wie Caching Ihnen bei erneuten Durchläufen Kosten spart
- **[Zusammenarbeit mit professionellen Übersetzern](/docs/guides/professional-translators)** — XLIFF für die menschliche Überprüfung exportieren
- **[Framework-Integration](/docs/guides/framework-integration)** — Hugo, next-intl, react-i18next
- **[CI/CD](/docs/guides/ci-cd)** — Übersetzungen in Ihrer Pipeline automatisieren
- **[Fehlerbehebung](/docs/guides/troubleshooting)** — Häufige Probleme und Lösungen
