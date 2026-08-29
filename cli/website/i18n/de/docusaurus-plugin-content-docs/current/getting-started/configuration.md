---
sidebar_position: 3
title: "Konfiguration"
related:
  - label: "Translation Methods"
    to: /docs/guides/translation-methods
    kind: guide
    note: "What the method fields actually select"
  - label: "Cookbook: Translate 30 Languages"
    to: /docs/tutorials/translate-30-languages
    kind: cookbook
    note: "Per-pair methods and registers at scale"
  - label: "Register"
    to: /glossary#term-register
    kind: glossary
    note: "The linguistic term behind the register field"
  - label: "Supported Languages"
    to: /docs/reference/supported-languages
    kind: reference
  - label: "CLI Reference"
    to: /docs/reference/cli
    kind: reference
---

# Konfiguration

Champollion funktioniert ohne Konfiguration — es erkennt Locale-Dateien, Format und Zielsprachen automatisch aus Ihrem Projekt. Für mehr Kontrolle erstellen Sie `champollion.config.json` im Stammverzeichnis Ihres Projekts oder führen Sie folgenden Befehl aus:

```bash
npx champollion init
```

## Vollständige Konfigurationsreferenz

```json title="champollion.config.json"
{
  "version": 3,
  "inputLocale": "en",
  "localesDir": "./locales",
  "contentDir": null,
  "translatableFields": null,
  "format": "auto",
  "model": "google/gemini-3.5-flash",
  "temperature": 0.3,
  "defaultMethod": "llm",
  "batchSize": 80,
  "coachingFile": null,
  "promptContext": null,
  "jsonConcurrency": 200,
  "contentConcurrency": 48,
  "fallbackPrefix": "[EN] ",
  "apiKeyEnvVar": "OPENROUTER_API_KEY",
  "noTranslate": [],
  "noTranslateUrls": true,
  "baseUrl": "",
  "pairs": {},
  "languages": {},
  "lint": {
    "srcDir": null,
    "ignore": ["node_modules", ".next", "dist"],
    "minLength": 2
  },
  "seo": {
    "urlPattern": "/:locale/:path",
    "pages": null
  },
  "typegen": {
    "output": null,
    "autoGenerate": false
  }
}
```

:::note[typegen ist noch nicht implementiert]
Der Konfigurationsblock `typegen` wird vom Konfigurationslader erkannt und beibehalten, aber die TypeScript-Typgenerierung ist noch nicht implementiert. Dies ist ein Platzhalter für eine geplante Funktion. Das Setzen dieser Werte hat keine Wirkung.
:::


### Felder

| Feld | Typ | Standardwert | Beschreibung |
|-------|------|---------|-------------|
| `version` | `number` | `3` | Version des Konfigurationsschemas. Immer `3`. |
| `inputLocale` | `string` | `"en"` | Quellsprachcode (BCP 47). |
| `localesDir` | `string` | `"./locales"` | Pfad zu den Locale-Dateien. Champollion durchsucht dieses Verzeichnis. |
| `contentDir` | `string` | `null` | Hugo-Content-Verzeichnis. Aktiviert die Übersetzung von Markdown-Textkörpern. |
| `translatableFields` | `string[]` | `null` | Überschreibt die standardmäßig übersetzbaren Frontmatter-Felder für die Content-Übersetzung. `null` verwendet die integrierten Standardwerte (`title`, `description`, `summary`). |
| `format` | `string` | `"auto"` | Dateiformat: `json`, `toml`, `yaml` oder `auto` (wird anhand der Dateiendung erkannt). |
| `model` | `string` | `"google/gemini-3.5-flash"` | Standardmodell für LLM-Methoden. Akzeptiert vollständige OpenRouter-Slugs (`provider/model`) oder kurze Aliase aus `shared/model-aliases.json` (z. B. `gemini-flash`). Direkte Anbieter verwenden einfache Namen (z. B. `gpt-4o`). |
| `temperature` | `number` | `0.3` | LLM-Temperatur (0.0–2.0). Niedriger = deterministischer. |
| `defaultMethod` | `string` | `"llm"` | Standard-Übersetzungsmethode: `llm`, `llm-coached`, `google-translate`, `deepl`, `microsoft-translator`, `libretranslate`, `openai`, `anthropic`, `gemini`, `api`. Wird durch das CLI-Flag `--method` überschrieben. |
| `batchSize` | `number` | `80` | Schlüssel pro Übersetzungs-Batch. Höher = weniger API-Aufrufe, aber größere Prompts. |
| `coachingFile` | `string` | `null` | Pfad zu einer Freitext-Coaching-Prompt-Datei (relativ zum Projektstamm). Der Inhalt wird beim Start gelesen und als `Coaching guidance:`-Block in den System-Prompt eingefügt. |
| `promptContext` | `string` | `null` | Anwendungskontext-String, der in den System-Prompt eingefügt wird (z. B. "E-Commerce-Produktbeschreibungen"). Hilft dem Modell, Übersetzungen an Ihre Domäne anzupassen. |
| `jsonConcurrency` | `number` | `200` | Maximale parallele Locale-Übersetzungen für die JSON-Schlüssel-Synchronisation. Wird durch das CLI-Flag `--json-concurrency` überschrieben. |
| `contentConcurrency` | `number` | `48` | Maximale parallele API-Aufrufe für die Content-Übersetzung (Markdown/MDX). Wird durch das CLI-Flag `--content-concurrency` überschrieben. |
| `fallbackPrefix` | `string` | `"[EN] "` | Marker-Präfix, das von `audit` und `verify` verwendet wird, um veraltete unübersetzte Werte aus früheren Durchläufen zu erkennen. Champollion schreibt dieses Präfix nicht — es wird nur zur Erkennung gelesen. |
| `apiKeyEnvVar` | `string` | `"OPENROUTER_API_KEY"` | Name der Umgebungsvariablen für den API-Schlüssel. Überschreiben Sie dies für benutzerdefinierte Namen von Umgebungsvariablen. |
| `minContentRetention` | `number` | `0.35` | Anteil der Buchstaben/Ziffern der Quelle, den eine Ausgabe beibehalten muss, bevor die [Prüfung auf Inhaltslöschung](/docs/concepts/quality-gate) ihr zweites Signal heranzieht. Kann auch pro Paar und pro Sprache festgelegt werden. |
| `noTranslate` | `string[]` | `[]` | Dot-Path-Schlüssel und Glob-Muster, deren Wert wortwörtlich in jedes Locale kopiert wird. Siehe [Nicht zu übersetzende Schlüssel](#no-translate). Wird auch als `skipKeys` akzeptiert. |
| `noTranslateUrls` | `boolean` | `true` | Behandelt Quellwerte, die ausschließlich aus einer `scheme://`-URL bestehen, als nicht zu übersetzen. Setzen Sie dies auf `false`, um Schlüssel mit URL-Werten an das Übersetzungs-Backend zu senden. |
| `baseUrl` | `string` | `""` | Basis-URL für die Generierung von SEO-Artefakten (hreflang, Sitemaps, JSON-LD). |
| `pairs` | `object` | `{}` | Überschreibungen für Methode, Modell und Qualität pro Paar. Siehe [Paar-Konfiguration](#pair-configuration). |
| `languages` | `object` | `{}` | Überschreibungen pro Sprache. Siehe [Sprachkonfiguration](#language-configuration). |
| `lint.srcDir` | `string` | `null` | Quellverzeichnis für den Lint-Scan. `null` = automatische Erkennung anhand des Frameworks. |
| `lint.ignore` | `string[]` | `["node_modules", ...]` | Glob-Muster, die vom Linting ausgeschlossen werden sollen. |
| `lint.minLength` | `number` | `2` | Minimale Zeichenfolgenlänge, um als hartcodiert markiert zu werden. |
| `seo.urlPattern` | `string` | `"/:locale/:path"` | URL-Muster-Vorlage für die Generierung von hreflang-Tags. |
| `seo.pages` | `string[]` | `null` | Explizite Seitenliste für SEO. `null` = automatische Erkennung anhand der Locale-Schlüssel. |
| `typegen.output` | `string` | `null` | Ausgabepfad für generierte TypeScript-Typen. `null` = deaktiviert. |
| `typegen.autoGenerate` | `boolean` | `false` | Typen nach jeder Synchronisation automatisch neu generieren. |

## Nicht zu übersetzende Schlüssel {#no-translate}

Einige Werte haben in jeder Sprache genau eine korrekte Darstellung: eine URL, ein
Repository-Pfad, ein Paketname, eine Produktkennung. Eine korrekte Übersetzung von
`https://example.org/paper` ist `https://example.org/paper`.

Das [Quality Gate](/docs/concepts/quality-gate) von Champollion lehnt
Source-Echo ab — eine Übersetzung, die mit ihrer Quelle identisch ist —, da dies normalerweise
bedeutet, dass ein Modell die Arbeit verweigert. Für diese Schlüssel wird dadurch die korrekte Antwort
zur abgelehnten Antwort, und es gibt keine Ausgabe, die das Modell erzeugen kann, um die Prüfung zu bestehen.
Schwächere Modelle lernen, das Gate zu umgehen, indem sie den Wert gerade genug verändern (ein
erfundenes `#fragment`, ein überflüssiger abschließender Schrägstrich, ein unsichtbares Leerzeichen ohne Breite),
was zu fehlerhaften Links führt. Stärkere Modelle geben den Wert unverändert zurück und scheitern
am Gate, sodass `sync` bei jedem Durchlauf mit einem Fehlercode (non-zero) beendet wird.

Deklarieren Sie diese Schlüssel stattdessen:

```json title="champollion.config.json"
{
  "noTranslate": ["**.url", "pages.software.*.repo", "meta.appId"]
}
```

Ein übereinstimmender Schlüssel wird **wortwörtlich aus dem Quell-Locale kopiert** — er wird niemals an ein
Übersetzungs-Backend gesendet, niemals durch das Quality Gate geprüft, niemals als Fehler gezählt und niemals
in Rechnung gestellt. Aus demselben Grund wird er von der Kostenschätzung vor dem Durchlauf ausgeschlossen.

### Muster-Syntax

Muster sind Dot-Paths über den abgeflachten Schlüsselraum, mit zwei Platzhaltern (Wildcards):

| Muster | Stimmt überein mit | Stimmt nicht überein mit |
|---------|---------|----------------|
| `nav.brand` | `nav.brand` (exakter Pfad) | `nav.brandName` |
| `**.url` | `url`, `pages.a.b.url` (ein `url`-Blatt auf beliebiger Tiefe) | `pages.urlLabel`, `pages.url.caption` |
| `pages.software.*.repo` | `pages.software.portal.repo` | `pages.software.a.b.repo` |
| `meta.og*` | `meta.ogImage`, `meta.ogTitle` | `meta.twitterImage`, `meta.og.image` |

`*` stimmt innerhalb eines einzelnen Segments überein; `**` stimmt mit null oder mehr ganzen Segmenten überein.
Ein Muster ohne Platzhalter ist ein exakter Schlüsselpfad.

### URLs werden standardmäßig behandelt

Da ein Schlüssel mit einem URL-Wert unter dem Gate kein korrektes Ergebnis haben kann,
ist `noTranslateUrls` standardmäßig auf `true` gesetzt: Jeder Quellwert, der ausschließlich aus
einer absoluten `scheme://`-URL besteht, wird ohne weitere Konfiguration als nicht zu übersetzen behandelt.

Die Erkennung ist absichtlich eng gefasst — der gesamte getrimmte Wert muss die URL sein.
Fließtext, der lediglich einen Link enthält (`"Read the paper at https://…"`), wird weiterhin
normal übersetzt.

Schalten Sie dies mit `"noTranslateUrls": false` aus, wenn Ihre URLs tatsächlich
locale-spezifisch sind (z. B. pro Sprache unterschiedliche Dokumentations-Hosts) — deklarieren Sie dann
diejenigen, die es nicht sind, mit `noTranslate`.

### Reparatur und Durchsetzung

Für einen nicht zu übersetzenden Schlüssel gibt es genau einen korrekten Zielwert, daher ist jede
Abweichung ein Fehler. Champollion setzt dies in beide Richtungen durch:

- **`sync` repariert es.** Ein nicht zu übersetzender Schlüssel, dessen Ziel fehlt,
  mit dem Präfix `[EN] ` versehen ist oder geändert wurde, wird aus der Quelle neu geschrieben. Das kostet keinen API-Aufruf
  und ist idempotent: Sobald die Werte übereinstimmen, überspringen spätere Synchronisationen den Schlüssel
  vollständig.
- **`verify` und `integrity` schlagen dabei fehl.** Ein abgewichener, nicht zu übersetzender Schlüssel wird
  als `NO-TRANSLATE DRIFT` mit den erwarteten und tatsächlichen Werten gemeldet —
  unsichtbare Zeichen werden als `\uXXXX` maskiert (escaped), da diese Art der Beschädigung in einem Diff
  sonst unmöglich zu erkennen ist. `champollion integrity` wird mit `1` beendet, sodass ein
  damit verknüpfter Build eine beschädigte URL abfängt, bevor sie ausgeliefert wird.

Wenn `integrity` auf diese Weise in einem Projekt fehlschlägt, das Sie gerade konfiguriert haben, meldet es
Schäden, die bereits in Ihren Locale-Dateien vorhanden waren. Führen Sie `champollion sync`
einmal aus, um dies zu reparieren.

## Schriftkonvertierung {#script-conversion}

Einige Sprachen, die Champollion übersetzt, können auf mehr als eine Weise *geschrieben* werden. Das Modell arbeitet immer in der **Arbeitsschrift** der Sprache (lateinische Romanisierung — SRO für Plains Cree, Okrand-Romanisierung für Klingonisch), und ein deterministischer Konverter kann die Ausgabe dann in eine Anzeigeschrift umschreiben. Ob dies geschehen soll, ist eine Entscheidung, die in der Konfiguration getroffen wird — **niemals standardmäßig**:

| Locale | Arbeitsschrift | Konvertierbar in | Art |
|--------|---------------|----------------|------|
| `crk` (Plains Cree) | `Latn` (SRO) | `Cans` (Silbenschrift) | Echtes Unicode — **Auswahl erforderlich** |
| `sr` / `srp` (Serbisch) | `Latn` | `Cyrl` (Kyrillisch) | Echtes Unicode — **Auswahl erforderlich** |
| `tlh` (Klingonisch) | `Latn` (Romanisierung) | `Piqd` (pIqaD) | PUA — Opt-in |
| `x-elvish-s` (Sindarin) | `Latn` | `Teng` (Tengwar) | PUA — Opt-in |
| `x-kryptonian` | `Latn` | Kryptonisch | PUA — Opt-in via `"script": "x-kryptonian"` |

**Echte Unicode-Paare (crk, sr) erfordern die Auswahl.** Cree-Silbenschrift und Kyrillisch sind gewöhnliches Unicode — sie werden überall gerendert — und beide Orthografien sind im realen Gebrauch. Champollion wird das Schriftsystem einer Gemeinschaft nicht im Namen eines Projekts auswählen: `init` fragt nach, wenn Sie die Sprache auswählen, und `sync` verweigert die Ausführung, bis die Konfiguration angibt, welches verwendet werden soll:

```json
{
  "languages": {
    "crk": { "script": "Cans" }
  }
}
```

**PUA-Schriften (tlh, x-elvish-s, x-kryptonian) verwenden standardmäßig die Romanisierung.** pIqaD, Tengwar und Kryptonisch sind *nicht in Unicode enthalten* — die Konverter geben Codepoints der Private Use Area aus, die als nichts gerendert werden, es sei denn, Sie liefern eine Schriftart mit, die diesen Codepoints zugeordnet ist. Die Romanisierung ist die einzige Ausgabe, die überall gerendert wird, daher ist sie der Standard. Um stattdessen die Anzeigeschrift auszugeben:

```json
{
  "languages": {
    "tlh": { "script": "Piqd" }
  }
}
```

…und führen Sie `champollion fonts install` aus, damit Ihre Website über eine Schriftart verfügt, die sie darstellen kann. Wenn Ihre Schriftarten auf lateinische Transliteration abgestimmt sind (wie viele Conlang-Schriftarten), behalten Sie den Standardwert bei.

`script` akzeptiert einen ISO 15924-Code in beliebiger Groß-/Kleinschreibung (`"cans"`, `"Cans"` und `"CANS"` sind identisch). Er kann auch pro Paar festgelegt werden, was Vorrang vor der Sprachebene hat. Ein ungültiger Wert oder eine Schrift, die das Locale nicht erzeugen kann, führt beim Start zu einem Fehler — noch vor jeglichem API-Aufruf.

### Nicht zugeordnete Buchstaben und `scriptFallback` {#script-fallback}

Konverter übersetzen das, was ihre Orthografie definiert, und nichts anderes. Die klingonische Romanisierung hat kein `d`, `c`, `f`, `g`, `i`, `k`, `s`, `x` oder `z` — daher kann eine Modellausgabe, die einen Eigennamen wie "GitHub" enthält, nicht vollständig konvertiert werden. Champollion **schreibt niemals einen halb konvertierten Wert**: Wenn ein Buchstabe nicht zugeordnet werden kann, bleibt der gesamte Wert in der Arbeitsschrift, und die Warnung nennt die Buchstaben sowie die Konfigurationszeile, die sie zuordnen würde.

Diese Zuordnungen müssen von Ihnen deklariert werden:

```json
{
  "languages": {
    "tlh": {
      "script": "Piqd",
      "scriptFallback": { "d": "D", "f": "p", "z": "S" }
    }
  }
}
```

Jede Regel ersetzt eine Sequenz der Arbeitsschrift durch eine, die der Konverter zuordnen *kann*, bevor die Konvertierung ausgeführt wird. Regeln werden beim Start validiert — eine Ersetzung, die selbst nicht zugeordnet werden kann, wird abgelehnt.

Champollion liefert **keine eigenen Fallback-Regeln** mit: Die Erfindung orthografischer Anpassungen, insbesondere für das Schriftsystem einer realen Sprache, ist nicht Aufgabe eines Index. Gemeinschaften und Fandoms haben Konventionen — übernehmen Sie diese bewusst, pro Projekt.

### Reparatur unerwünschter Konvertierungen {#repair-script}

Vor Version 0.3.0 war die Konvertierung bedingungslos — Projekte, die auf PUA-Locales abzielten, erhielten nicht renderbare Ausgaben, ob sie wollten oder nicht. Zwei Werkzeuge schließen diese Lücke:

- **`champollion repair-script`** durchsucht Locales, deren Konfiguration besagt, dass die Konvertierung für PUA-Codepoints *ausgeschaltet* ist, und stellt die Romanisierung mithilfe der konvertereigenen Umkehrtabelle wieder her (`--dry` für eine Vorschau). pIqaD wird exakt umgekehrt; bei Tengwar- und kryptonischen Umkehrungen geht die Groß-/Kleinschreibung verloren, worauf hingewiesen wird.
- **`champollion integrity`** schlägt fehl (Exit 1), wenn PUA gefunden wird, wo die Konvertierung ausgeschaltet ist — so fängt ein Build-Gate nicht renderbaren Text ab, bevor er ausgeliefert wird, und der Bericht benennt die Reparatur.

Das Translation Memory muss nie repariert werden: Es speichert Werte vor der Konvertierung, sodass ein späteres Ein- oder Ausschalten von `script:` keine Cache-Arbeit erfordert.

Die Schriftkonvertierung gilt für UI-Strings (Schlüssel-Wert-Dateien und Docusaurus-JSON). Markdown-Textkörper werden niemals konvertiert — ein gieriger Zeichenkonverter hat keinen sicheren Weg durch Code-Spans, URLs und Frontmatter.

## Paar-Konfiguration {#pair-configuration}

Jedes Quelle→Ziel-Paar kann unabhängig konfiguriert werden:

```json
{
  "pairs": {
    "en:fr": {
      "method": "google-translate",
      "qualityTier": "high"
    },
    "en:ja": {
      "method": "llm",
      "model": "google/gemini-2.5-pro"
    },
    "en:crk": {
      "methodPlugin": "crk-coached-v1"
    }
  }
}
```

### Paar-Felder

| Feld | Typ | Beschreibung |
|-------|------|-------------|
| `method` | `string` | Übersetzungsmethode: `llm`, `llm-coached`, `google-translate`, `deepl`, `microsoft-translator`, `libretranslate`, `openai`, `anthropic`, `gemini`, `api` |
| `methodPlugin` | `string` | Name eines installierten Plugins (aus `.champollion/methods/`) |
| `model` | `string` | Überschreibt das Standardmodell für dieses Paar |
| `temperature` | `number` | Überschreibt die Standardtemperatur für dieses Paar |
| `batchSize` | `number` | Überschreibt die Standard-Batch-Größe für dieses Paar |
| `register` | `string` | Register-/Tonalitätsüberschreibung (Preset-Schlüssel oder Freitext) |
| `endpoint` | `string` | URL des Remote-API-Endpunkts. Erforderlich, wenn `method` `api` ist. |
| `coachingFile` | `string` | Pfad zu einer Coaching-Prompt-Datei für dieses Paar |
| `promptContext` | `string` | Anwendungskontext für dieses Paar |
| `qualityTier` | `string` | Anzeigestufe: `standard`, `high`, `research`, `verified` |

## Sprach-Konfiguration {#language-configuration}

Sprachen akzeptieren drei Formate:

### Array von Codes (am einfachsten)

```json
{
  "languages": ["fr", "de", "ja"]
}
```

Jede Sprache erhält ihr Standardregister aus der integrierten Registertabelle. Sprachen ohne Standardwert erhalten `"Professional register."`.

### Objekt mit Register-Zeichenketten

Der Wert kann ein **Preset-Schlüssel** aus der Sprachkarte oder ein benutzerdefinierter Register-Text sein:

```json
{
  "languages": {
    "fr": "casual-tu",
    "ko": "formal-hapsyo",
    "ja": "Custom: Polite Japanese for a gaming app."
  }
}
```

Champollion prüft, ob die Zeichenkette einem Preset-Schlüssel in der Sprachkarte entspricht. Ist dies der Fall, wird der vollständige Register-Prompt aus der Karte verwendet. Andernfalls wird die Zeichenkette unverändert verwendet. Siehe [Unterstützte Sprachen](/docs/reference/supported-languages#language-cards) für verfügbare Presets.

### Objekt mit vollständiger Konfiguration

```json
{
  "languages": {
    "crk": {
      "name": "Plains Cree",
      "register": "SRO syllabics with grammatical precision.",
      "model": "google/gemini-2.5-pro",
      "batchSize": 5,
      "maxRetries": 5,
      "script": "Cans"
    }
  }
}
```

Sie können Kurzform und vollständige Objekte im selben Block mischen.


### Sprach-Felder

| Feld | Typ | Beschreibung |
|-------|------|-------------|
| `register` | `string` | Stil-/Ton-Anweisungen. Kann ein **voreingestellter Schlüssel** (z. B. `casual-tu`, `formal-hapsyo`) oder benutzerdefinierter Text sein. Siehe [Sprachkarten](/docs/reference/supported-languages#language-cards). |
| `name` | `string` | Menschenlesbarer Sprachname (für die Statusanzeige) |
| `model` | `string` | Überschreibt das Standardmodell |
| `temperature` | `number` | Überschreibt die Standardtemperatur |
| `batchSize` | `number` | Überschreibt die Standard-Batch-Größe |
| `coachingFile` | `string` | Pfad zu einer Coaching-Prompt-Datei für diese Sprache |
| `promptContext` | `string` | Anwendungskontext für diese Sprache |
| `maxRetries` | `number` | Maximales Wiederholungsbudget für fehlgeschlagene Batches (Standard: 3) |
| `script` | `string` | ISO 15924-Code der Orthografie, die Champollion schreibt (z. B. `"Cans"`, `"Piqd"`). Siehe [Schriftkonvertierung](#script-conversion). |
| `scriptFallback` | `object` | Transliterationsregeln für Buchstaben, die der Schriftkonverter nicht zuordnen kann. Siehe [Schriftkonvertierung](#script-conversion). |

:::info[Vererbungskette]
Einstellungen werden in dieser Reihenfolge aufgelöst (erste gewinnt):

**Paar-Ebene** → **Sprach-Ebene** → **globale Konfiguration** → **Standardwerte**

Wenn beispielsweise `pairs["en:fr"]` `model` setzt, überschreibt es sowohl die Werte auf Sprach-Ebene als auch die globalen `model`-Werte.
:::

## Nicht-englische Quelle

Wenn Ihre Quellsprache nicht Englisch ist:

```bash
# CLI flag (one-time)
npx champollion sync --source fr
```

```json title="champollion.config.json (permanent)"
{
  "inputLocale": "fr"
}
```

## Lock-Datei

Champollion erstellt `.champollion.lock`, um SHA-256-Hashes der übersetzten Quellwerte zu verfolgen. **Committen Sie diese Datei**, damit alle Entwickler dieselbe Übersetzungsgrundlage teilen.

Wenn sich ein Quellwert ändert, stimmt der Hash nicht mehr überein, und Champollion übersetzt diesen Schlüssel bei der nächsten Synchronisierung erneut.

## `.champollionignore`

Erstellen Sie `.champollionignore` im Stammverzeichnis Ihres Projekts, um Dateien vom `lint`-Scan auszuschließen. Verwendet Glob-Muster, wie `.gitignore`:

```text title=".champollionignore"
src/components/legacy/**
src/utils/constants.js
**/*.test.js
```

## `.champollion/`-Verzeichnis

Champollion erstellt ein `.champollion/`-Verzeichnis im Stammverzeichnis Ihres Projekts für den internen Zustand. Sie sollten dies im Allgemeinen **zu `.gitignore` hinzufügen** — es handelt sich um lokale Optimierung, nicht um Projektquellen:

```gitignore
.champollion/
```

| Datei | Zweck | Committen? |
|------|---------|--------|
| `tm.json` | Translation-Memory-Cache — speichert vorherige Übersetzungen, indiziert nach Quelltext + Locale + Methode | Nein (lokaler Cache) |
| `xliff/*.xliff` | XLIFF-Exportdateien für die Überprüfung durch professionelle Übersetzer | Nein (temporär) |
| `methods/` | Manifeste installierter Methoden-Plugins | Ja (geteilte Konfiguration) |
| `backups/` | Pre-Wrap-Backups (erstellt von `wrap --undo`) | Nein (Sicherheitsnetz) |

Siehe [Translation Memory](/docs/concepts/translation-memory) für Details zu `tm.json` und wie es API-Kosten spart.

---

## Programmatische API

Für Build-Skripte und benutzerdefinierte Integrationen importieren Sie direkt aus dem Paket:

```javascript
import { GeminiMethod, runSync, resolveConfig } from 'champollion';

// Use a method class directly
const gemini = new GeminiMethod();
const result = await gemini.translate(
  ['greeting', 'farewell'],
  { greeting: 'Hello', farewell: 'Goodbye' },
  { target: 'fr', name: 'French', register: 'formal', model: 'gemini-2.5-flash' },
  { cwd: process.cwd() }
);
// result = { greeting: 'Bonjour', farewell: 'Au revoir' }
```

### Verfügbare Exporte

| Export | Was er tut |
|--------|-------------|
| `TranslationMethod` | Basisklasse für alle Methoden |
| `LLMMethod` | Basisklasse für LLM-Methoden (OpenRouter) |
| `DirectLLMMethod` | Basisklasse für direkte LLM-Anbieter (OpenAI, Anthropic, Gemini) |
| `OpenAIMethod`, `AnthropicMethod`, `GeminiMethod` | Klassen für direkte LLM-Anbieter |
| `DeepLMethod`, `MicrosoftTranslatorMethod`, `LibreTranslateMethod`, `TildeMethod`, `TranslatedMethod` | Traditionelle MT-Klassen |
| `GoogleTranslateMethod` | Google Cloud Translation |
| `LLMCoachedMethod` | Gecoachtes LLM (OpenRouter + Coaching-Daten) |
| `APIMethod` | Remote-API-Client |
| `runSync`, `runContentSync` | Vollständige Synchronisierungs-Pipeline |
| `resolveConfig`, `resolvePairs` | Konfigurationsauflösung |
| `validateTranslations` | Quality-Gate |
| `loadCoachingData`, `findDictionaryMatches` | Coaching-Hilfsprogramme |

### Erweiterung für benutzerdefinierte Anbieter

Erweitern Sie `DirectLLMMethod`, um in ~40 Zeilen einen neuen LLM-Anbieter hinzuzufügen:

```javascript
import { DirectLLMMethod } from 'champollion';

class MistralMethod extends DirectLLMMethod {
  constructor(options) {
    super(options);
    this.name = 'mistral';
  }
  _getApiKeyEnvVar()     { return 'MISTRAL_API_KEY'; }
  _getApiKeyOptionsKey() { return 'mistralApiKey'; }
  _getDefaultModel()     { return 'mistral-large-latest'; }
  _getProviderLabel()    { return 'Mistral'; }

  _buildApiRequest({ prompt, systemMessage, apiKey, model, temperature }) {
    return {
      url: 'https://api.mistral.ai/v1/chat/completions',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: {
        model,
        messages: [
          ...(systemMessage ? [{ role: 'system', content: systemMessage }] : []),
          { role: 'user', content: prompt },
        ],
        temperature,
      },
    };
  }

  _extractResponseText(json) {
    return json.choices?.[0]?.message?.content;
  }

  // Optional but recommended: provider-specific setup help when translation fails
  getSetupHelp() {
    if (!process.env.MISTRAL_API_KEY) {
      return [
        '',
        '  ┌─ Missing API Key ─────────────────────────────────────────────┐',
        '  │ Mistral requires an API key from https://console.mistral.ai   │',
        '  │ Run: export MISTRAL_API_KEY=...                               │',
        '  └────────────────────────────────────────────────────────────────┘',
      ];
    }
    return ['        API key is set but translation failed. Check your Mistral dashboard.'];
  }
}
```

Sie erhalten Übersetzung, Coaching, Wiederholungsschleifen, Modellvalidierung, Qualitätsstufen und Einrichtungshilfe kostenlos. Nur die Form der HTTP-Anfrage ist anbieterspezifisch. Für Nicht-LLM-Adapter, die rohes `fetch()` verwenden, nutzen Sie den geteilten `fetchWithRetry()`-Helfer aus `lib/methods/fetch-with-retry.js`, anstatt Ihre eigene Wiederholungsschleife zu schreiben.

---

## Siehe auch

- [CLI-Referenz](/docs/reference/cli) — alle Befehle und Flags
- [Übersetzungsmethoden](/docs/guides/translation-methods) — Auswahl und Kombination von Methoden
- [Translation Memory](/docs/concepts/translation-memory) — Caching und Kosteneinsparungen
- [Zusammenarbeit mit professionellen Übersetzern](/docs/guides/professional-translators) — XLIFF-Workflow
- [Plugin-Spezifikation](/docs/reference/plugin-spec) — Manifestformat für Methoden-Plugins
- [Architektur](/docs/concepts/architecture) — wie die Teile zusammenhängen
- [Unterstützte Sprachen](/docs/reference/supported-languages) — integrierte Sprachunterstützung
- [Wie die Synchronisierung funktioniert](/docs/concepts/how-sync-works) — die Übersetzungs-Pipeline
