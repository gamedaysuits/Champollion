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

## 1. Richten Sie Ihre Locale-Dateien ein

Erstellen Sie eine Quell-Lokalisierungsdatei. Champollion unterstützt JSON, TOML, YAML und mehr — siehe die [CLI-Referenz](/docs/reference/cli) für die vollständige Liste:

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
```

Erhalten Sie einen kostenlosen Gemini-Schlüssel unter [aistudio.google.com/apikey](https://aistudio.google.com/apikey). Erhalten Sie einen OpenRouter-Schlüssel unter [openrouter.ai](https://openrouter.ai).

## 3. Führen Sie Sync aus

```bash
npx champollion sync
```

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

Der unveränderte Schlüssel (`hero.subtitle`) wird aus dem **Translation Memory**-Cache von champollion bereitgestellt — kein API-Aufruf, keine Kosten. Der Cache wird bei jedem Sync automatisch aufgebaut und unter `.champollion/tm.json` gespeichert.

## Optional: Erstellen Sie eine Konfigurationsdatei

Für mehr Kontrolle generieren Sie eine Konfigurationsdatei:

```bash
npx champollion init                         # guided wizard
npx champollion init --yes --langs fr,de,ja  # quick setup with specific targets
```

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
  "model": "google/gemini-2.5-flash"
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
