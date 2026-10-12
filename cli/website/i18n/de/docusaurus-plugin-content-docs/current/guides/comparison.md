---
sidebar_position: 7
title: "Vergleich"
---

# Wie sich Champollion im Vergleich schlägt

champollion gehört einer anderen Kategorie an als die meisten Lokalisierungswerkzeuge. Hier ein ehrlicher Vergleich.

## Die Landschaft

Die meisten Lokalisierungswerkzeuge fallen in eine von drei Kategorien:

| Kategorie | Beispiele | Modell |
|----------|----------|-------|
| **Cloud-TMS-Plattformen** | Crowdin, Phrase, Locize, Tolgee | SaaS-Dashboard + menschliche Übersetzer + monatliches Abonnement |
| **Werkzeuge zur Schlüsselextraktion** | i18next-scanner, FormatJS CLI | Durchsuchen den Quellcode nach Aufrufen von Übersetzungsfunktionen |
| **CLI-Übersetzungs-Engines** | **champollion** | Laufen in Ihrem Projekt, übersetzen Dateien direkt, kein Cloud-Konto |

Champollion ist eine **CLI-Übersetzungs-Engine** — es übersetzt Ihre Locale-Dateien direkt über konfigurierbare Backends (LLMs, Google Translate, benutzerdefinierte Plugins). Kein Cloud-Dashboard, kein Workflow für menschliche Übersetzer, keine monatliche Gebühr.

---

## Funktionsvergleich

| Funktion | champollion | Crowdin | Phrase | Locize |
|---------|:------------:|:-------:|:------:|:------:|
| **Lokale Ausführung (kein Cloud-Konto)** | ✅ | ❌ | ❌ | ❌ |
| **Minimale Abhängigkeiten** | ✅ | ❌ | ❌ | ❌ |
| **Methodenkonfiguration pro Sprachpaar** | ✅ | ❌ | ❌ | ❌ |
| **Benutzerdefinierte Sprachregister** | ✅ | ❌ | ❌ | ❌ |
| **Inhaltssensitiv (schützt Codeblöcke)** | ✅ | ❌ | ❌ | ❌ |
| **Kunstsprachen & Schriftkonvertierung** | ✅ | ❌ | ❌ | ❌ |
| **Plugin-Architektur** | ✅ | ❌ | ❌ | ❌ |
| **Markdown- / Inhaltsübersetzung** | ✅ | ✅ | ✅ | ❌ |
| **Translation Memory** | ✅ | ✅ | ✅ | ✅ |
| **XLIFF-Export/Import** | ✅ | ✅ | ✅ | ❌ |
| **ICU-Plural-Validierung** | ✅ | ✅ | ✅ | ❌ |
| **Einhaltung von Terminologie** | ✅ | ✅ | ✅ | ❌ |
| **Workflow für menschliche Übersetzer** | XLIFF-basiert | ✅ | ✅ | ✅ |
| **In-Context-Bearbeitung (visuell)** | ❌ | ✅ | ✅ | ✅ |
| **Team-Zusammenarbeit** | ❌ | ✅ | ✅ | ✅ |
| **Dateiformat-Unterstützung** | JSON, TOML, YAML, MD, XLIFF | 50+ | 40+ | JSON |
| **Preise** | Kostenlos für nicht-kommerzielle Nutzung (Sie bezahlen Ihr LLM) | Ab $0/Monat | Ab $0/Monat | Ab $0/Monat |

---

## Wann Champollion einzusetzen ist

**Champollion ist gut geeignet, wenn:**

- Sie maschinelle Übersetzung fest in Ihre Build-Pipeline integrieren möchten — nicht als separaten Workflow
- Sie eine Methodensteuerung pro Sprache benötigen (LLM für manche, Google Translate für andere, benutzerdefinierte Plugins für den Rest)
- Sie in Sprachen übersetzen, die von keiner API abgedeckt werden (indigene, bedrohte, konstruierte Sprachen)
- Sie eine deterministische Schriftausgabe wünschen (Cree-Silbenschrift, Klingonisch pIqaD, Tengwar)
- Sie keinerlei Herstellerbindung und keine Cloud-Abhängigkeiten wünschen
- Sie ein einzelner Entwickler oder ein kleines Team sind, das kein vollständiges TMS-Dashboard benötigt
- Sie eine XLIFF-basierte Übergabe an professionelle Übersetzer ohne Cloud-Abonnement wünschen

**Ein Cloud-TMS ist besser geeignet, wenn:**

- Sie professionelle menschliche Übersetzer haben, die jede Zeichenkette prüfen (der XLIFF-Workflow von champollion ist einfacher als ein vollständiges TMS)
- Sie projektübergreifenden Übersetzungsspeicher und Glossarverwaltung benötigen
- Sie kontextbezogene visuelle Bearbeitung benötigen (Vorschau von Übersetzungen innerhalb Ihrer Benutzeroberfläche)
- Sie ein großes Team mit Anforderungen an rollenbasierte Zugriffssteuerung haben
- Sie Unterstützung für über 50 Dateiformate benötigen

---

## Was Champollion leistet, das sonst niemand bietet

### 1. Benutzerdefinierte Register

Jedes Sprachpaar erhält kulturell angemessene Tonanweisungen für das LLM:

```json
{
  "de": {
    "register": "Standard professional register. Use Sie-form for formal address."
  },
  "tl": {
    "register": "Educated Manila Taglish. Use Tagalog as the primary language but keep technical terms in English."
  },
  "tlh": {
    "register": "Warrior's honor. OVS grammar. Use Marc Okrand vocabulary."
  }
}
```

Kein anderes Werkzeug wird mit 47 vorkonfigurierten Sprachregistern ausgeliefert oder erlaubt es Ihnen, benutzerdefinierte Register pro Projekt zu definieren.

### 2. Deterministische Schriftkonverter

Champollion wird mit fünf integrierten Schriftkonvertern ausgeliefert, die als Hooks nach der Übersetzung laufen — kein LLM erforderlich:

| Locale | Konvertierung | Beispiel |
|--------|-----------|---------|
| `crk` | SRO → Cree-Silbenschrift | `nêhiyawêwin` → `ᓀᐦᐃᔭᐍᐏᐣ` |
| `sr` | Latein → Kyrillisch | `Beograd` → `Београд` |
| `tlh` | Romanisierung → pIqaD | `tlhIngan Hol` → (pIqaD-Glyphen) |
| `x-elvish-s` | Latein → Tengwar | Sindarin → Tengwar (Mode of Beleriand) |
| `x-kryptonian` | Latein → Kryptonisch | Chiffren-Substitution (erfordert Schriftart) |

Dies sind reine Konverter auf Basis von Nachschlagetabellen — deterministisch, überprüfbar, ohne Risiko von LLM-Halluzinationen.

### 3. Inhaltsbewusster Schutz

Beim Übersetzen von Markdown oder umfangreichen Inhalten schützt Champollion:

- Umschlossene Codeblöcke (` ``` `)
- Inline-Code (`` ` ` ``)
- Hugo-Shortcodes (`{{</* */>}}`, `{{%/* */%}}`)
- Interpolationsvariablen (`{{ .Count }}`, `{name}`, `{{t('key')}}`)
- Rohe HTML-Blöcke

Diese werden vor der Übersetzung durch Unicode-Sentinel-Token ersetzt und danach wiederhergestellt. Das LLM sieht niemals Ihren Code, Ihre Shortcodes oder Ihre Variablen.

### 4. Angeleitete Methoden-Plugins

Für Sprachen ohne API-Abdeckung können Sie eine angeleitete Übersetzungsmethode erstellen:

1. Erstellen Sie linguistische Anleitungsdaten (Grammatikregeln, Wortschatz, Beispiele)
2. Bündeln Sie diese als Plugin
3. Vergleichen Sie sie anhand von Referenzübersetzungen mit dem [Eval-Harness](https://github.com/gamedaysuits/Champollion)
4. Installieren Sie sie in Ihrem Projekt mit `champollion plugin install`

So handhabt champollion Plains Cree — und so können Sie jede Sprache handhaben, auch solche, die noch nicht existieren.

---

## Das Fazit

Champollion ist kein Ersatz für Crowdin. Es ist ein anderes Werkzeug für einen anderen Workflow. Wenn Sie menschliche Übersetzer benötigen, verwenden Sie ein TMS. Wenn Sie ein CLI benötigen, das Ihre Dateien mit einem einzigen Befehl übersetzt und Ihnen die Kontrolle über Methoden, Modelle und Register pro Sprache gibt — verwenden Sie champollion.
