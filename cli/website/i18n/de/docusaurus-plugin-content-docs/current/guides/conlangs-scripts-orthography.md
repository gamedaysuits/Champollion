---
sidebar_position: 3
title: "Plansprachen, Schriftsysteme & Orthographie"
---

# Konstruierte Sprachen, Schriften & Orthographie

champollion bietet erstklassige Unterstützung für konstruierte Sprachen über LLM-Register und deterministische Schriftkonverter. Dieser Leitfaden behandelt, wie die Unterstützung für konstruierte Sprachen funktioniert, welche Schriftarten Sie benötigen und wie Sie eigene hinzufügen.

:::tip[Warum Konsprachen wichtig sind]
Konsprachen sind nicht bloß eine Kuriosität – sie beanspruchen genau dieselbe Infrastruktur, die auch für real unterversorgte Sprachen verwendet wird. Das Quality-Gate, das Coaching-System und die Pipeline zur Schriftkonvertierung funktionieren für Klingonisch und Plains Cree identisch. Wenn Ihre Pipeline für Konsprachen funktioniert, wird auch Ihre Pipeline für ressourcenarme Sprachen funktionieren.
:::

---

## Unterstützte konstruierte Sprachen

| Sprache | Code | Schriftkonverter | Schriftart erforderlich |
|----------|------|:----------------:|:-------------:|
| Klingonisch | `tlh` | ✅ Romanisierung → pIqaD | PUA-Schriftart (z. B. pIqaD qolqoS) |
| Sindarin (Tolkien-Elbisch) | `x-elvish-s` | ✅ Latein → Tengwar | CSUR-PUA-Schriftart |
| Kryptonisch | `x-kryptonian` | ✅ Latein → Kryptonisch | PUA-Schriftart |
| Piraten-Englisch | `x-pirate` | ❌ nur Register | Keine |
| Shakespeare-Englisch | `x-shakespeare` | ❌ nur Register | Keine |
| Yoda-Sprache | `x-yoda` | ❌ nur Register | Keine |

Codes für konstruierte Sprachen verwenden das Präfix `x-` gemäß der BCP-47-Konvention für private Verwendung, mit Ausnahme von Klingonisch (`tlh`), dem von SIL International ein [ISO-639-3](https://iso639-3.sil.org/code/tlh)-Code zugewiesen wurde.

---

## Unicode, PUA und Schriftartanforderungen

### Der Private Use Area

Klingonisch (pIqaD), Sindarin (Tengwar) und Kryptonisch verwenden Unicode-Zeichen aus dem **Private Use Area (PUA)**. Der PUA ist der Bereich U+E000–U+F8FF — diese Codepunkte haben **keine standardisierte Zuweisung**. Das [ConScript Unicode Registry (CSUR)](https://www.evertype.com/standards/csur/) pflegt von der Gemeinschaft vereinbarte Zuordnungen für fiktive Schriften, diese sind jedoch nicht Teil des Unicode-Standards.

Was dies in der Praxis bedeutet:

- PUA-Text wird ohne die korrekt geladene Schriftart als **leere Kästchen** (□□□) dargestellt
- Unterschiedliche Schriftarten können verschiedene Glyphen denselben PUA-Codepunkten zuordnen
- champollion bündelt KEINE PUA-Schriftarten — Sie müssen sie selbst laden
- Systemschriftarten werden diese Zeichen niemals darstellen

### PUA-Bereiche nach Schrift

| Schrift | PUA-Bereich | CSUR-Referenz |
|--------|-----------|---------------|
| Klingonisch (pIqaD) | U+F8D0–U+F8FF | [CSUR Klingon](https://www.evertype.com/standards/csur/klingon.html) |
| Tengwar (Elbisch) | U+E000–U+E07F | [CSUR Tengwar](https://www.evertype.com/standards/csur/tengwar.html) |
| Kryptonisch | Variiert je nach Schriftart | Kein CSUR-Standard |

### Laden von PUA-Webschriftarten

champollion enthält einen integrierten Befehl zum Herunterladen und Verwalten von PUA-Webschriftarten:

```bash
# See which fonts are needed for your configured languages
champollion fonts list

# Download all needed fonts (auto-detects project type for output directory)
champollion fonts install

# Also generate a CSS snippet with @font-face declarations
champollion fonts install --css
```

Der Befehl `fonts install` lädt aus verifizierten Open-Source-Repositorys herunter:

| Schriftart | Schrift | Lizenz | Quelle |
|------|--------|---------|--------|
| pIqaD qolqoS | Klingonisch | SIL Open Font License 1.1 | [GitHub](https://github.com/dadap/pIqaD-fonts) |
| FreeMonoTengwar | Tengwar | GNU GPL v3 (mit Schriftartausnahme) | [SourceForge](https://sourceforge.net/projects/freetengwar/) |
| *(vom Benutzer bereitgestellt)* | Kryptonisch | Variiert | Keine Open-Source-PUA-Schriftart verfügbar |

Das Ausgabeverzeichnis wird automatisch aus Ihrer Projektstruktur erkannt (Docusaurus → `static/fonts/`, Hugo → `static/fonts/`, Standard → `public/fonts/`). Überschreiben Sie es mit `--dir`.

Wenn Sie Schriftarten lieber manuell verwalten möchten, fügen Sie `@font-face`-Regeln in Ihr CSS ein:

```css
@font-face {
  font-family: 'pIqaD';
  src: url('/fonts/pIqaDqolqoS.ttf') format('truetype');
  font-display: swap;
  unicode-range: U+F8D0-F8FF;
}

/* Apply to Klingon text elements */
[lang="tlh"], [data-script="piqad"] {
  font-family: 'pIqaD', sans-serif;
}
```

:::warning[Unicode-Unterstützung ist NICHT garantiert]
Das Unicode Consortium hat es [ausdrücklich abgelehnt](https://www.unicode.org/faq/private_use.html), fiktive Schriften im Standard zu kodieren. PUA-Zuweisungen werden von der Community gepflegt und können zwischen Font-Implementierungen in Konflikt geraten. Geben Sie stets die genaue Schriftart an, die Ihr Projekt verwendet, und testen Sie die Darstellung in verschiedenen Browsern.
:::

---

## Schriftkonverter

### Funktionsweise

Champollions Schriftkonvertierung ist ein **Post-Translation-Hook, der nur angewendet wird, wenn die Konfiguration dies verlangt**:

1. Das LLM übersetzt den Text in eine **Arbeitsschrift** (meist Lateinisch oder SRO)
2. Das [Quality Gate](/docs/concepts/quality-gate) validiert die Ausgabe
3. Wenn die `script:`-Einstellung des Paares die Anzeigeschrift auswählt, transformiert der deterministische Konverter den validierten Text — Werte mit Buchstaben, die der Konverter nicht zuordnen kann, bleiben vollständig in der Arbeitsschrift erhalten, wobei pro Schlüssel eine Warnung ausgegeben wird
4. Das Ergebnis wird auf die Festplatte geschrieben

Dieser zweistufige Ansatz funktioniert, weil LLMs bessere Ergebnisse liefern, wenn sie in lateinbasierten Schriften arbeiten. Der deterministische Konverter garantiert eine korrekte Schriftausgabe, ohne sich auf das (oft unzuverlässige) Schriftwissen des Modells zu verlassen.

Ob Schritt 3 überhaupt ausgeführt wird, ist eine projektbezogene Entscheidung — siehe [Schriftkonvertierung](/docs/getting-started/configuration#script-conversion). Die PUA-Anzeigeschriften (pIqaD, Tengwar, Kryptonisch) sind standardmäßig deaktiviert, da sie ohne eine speziell dafür entwickelte Schriftart nicht dargestellt werden; crk und sr haben überhaupt keinen Standardwert, da beide ihrer Orthografien real sind und die Entscheidung beim Projekt liegt.

### Alle fünf Konverter

champollion wird mit fünf integrierten Schriftkonvertern ausgeliefert:

#### Plains Cree: SRO → Silbenschrift (`crk`)

Standard Roman Orthography zu Canadian Aboriginal Syllabics.

```
Input:  "tawâw"
Output: "ᑕᐚᐤ"
```

Lange Vokale verwenden Makron/Zirkumflex: ê, î, ô, â. Der Konverter verarbeitet alle SRO-Diakritika und ordnet sie den korrekten Silbenzeichen zu. Siehe [Eine ressourcenarme Sprache unterstützen](/docs/network/community/low-resource-languages) für die vollständige Cree-Pipeline.

#### Serbisch: Latein → Kyrillisch (`sr`)

Deterministische Latein-zu-Kyrillisch-Konvertierung für Serbisch.

```
Input:  "zdravo"
Output: "здраво"
```

Dies verarbeitet die vollständige serbische Alphabetzuordnung einschließlich Digraphen (lj → љ, nj → њ, dž → џ).

#### Klingonisch: Romanisierung → pIqaD (`tlh`)

Marc Okrands Romanisierungssystem zu pIqaD-PUA-Zeichen.

```
Input:  "Qapla'"    (romanized Klingon)
Output: [pIqaD PUA] (requires pIqaD font to render)
```

#### Sindarin: Latein → Tengwar (`x-elvish-s`)

Tolkiens Tengwar-Zuordnung im Sindarin-Modus.

```
Input:  "elen síla"  (Latin Sindarin)
Output: [Tengwar PUA] (requires Tengwar font to render)
```

#### Kryptonisch: Latein → Kryptonisch (`x-kryptonian`)

Schriftzuordnung des Fan-Lexikons für Kryptonisch.

```
Input:  "Kal-El"
Output: [Kryptonian PUA] (requires Kryptonian font to render)
```

### Auslösen eines Konverters

Setzen Sie das Feld `script` auf den ISO 15924-Code der Orthografie, in der geschrieben werden soll:

```json
{
  "languages": {
    "sr": { "script": "Cyrl" },
    "crk": { "script": "Cans" },
    "tlh": { "script": "Piqd" }
  }
}
```

Ohne dies wird nichts konvertiert. Für `crk` und `sr` ist das Feld **erforderlich** — beide ihrer Orthografien sind real, und `sync` trifft diese Wahl nicht für Sie. Für die PUA-Locales ist es ein Opt-in gegenüber der standardmäßigen Romanisierung. Siehe [Schriftkonvertierung](/docs/getting-started/configuration#script-conversion).

---

## Sprachen mit mehreren Schriften

Einige reale Sprachen verwenden mehrere aktive Schriften:

| Sprache | Schriften | Champollion-Ansatz |
|----------|---------|-----------------|
| Serbisch | Lateinisch + Kyrillisch | Ein Locale, explizite Wahl: `"script": "Cyrl"` konvertiert, `"script": "Latn"` behält Lateinisch bei |
| Plains Cree | SRO (Lateinisch) + Silbenschrift | Ein Locale, explizite Wahl: `"script": "Cans"` oder `"script": "Latn"` |
| Chinesisch | Vereinfacht + Traditionell | Separate Locale-Codes (`zh` vs. `zh-TW`) mit unterschiedlichen Registern |

Für Sprachen, bei denen beide Schriften dieselbe Zielgruppe bedienen (Serbisch, Plains Cree), ermöglicht ein Locale in Kombination mit einer expliziten `script`-Wahl eine einzige Übersetzungs-Pipeline. Für Sprachen, bei denen die Schriften unterschiedliche Zielgruppen bedienen (Vereinfachtes Chinesisch für Festlandchina, Traditionelles Chinesisch für Taiwan/HK), verwenden Sie separate Locale-Codes.

---

## Hinweise zur Orthographie

Register sind nicht nur Tonalität — sie enthalten **orthographische Anweisungen**, die das LLM zu korrekten Schreibkonventionen lenken.

### Förmliche Anredeformen

Die integrierten Register von champollion enthalten die kulturell angemessene förmliche Anrede für jede Sprache:

| Sprache | Förmliche Form | Registeranweisung |
|----------|------------|---------------------|
| Deutsch | Sie | `Use Sie-form for formal address` |
| Französisch | vous | `Use vous-form` |
| Russisch | вы | `Professional register with вы-form` |
| Türkisch | siz | `Professional register with siz-form` |
| Koreanisch | 합쇼체 | `Formal Korean (합쇼체)` |
| Japanisch | です/ます | `Polite professional register (です/ます form)` |
| Polnisch | Pan/Pani | `Professional register with Pan/Pani form` |

### Geschlechtergerechtes Schreiben

Jede Sprachkarte verfügt über ein Feld `gender.inclusiveGuidance` mit sprachspezifischen Hinweisen. Dieses wird getrennt vom Register-Preset in den Übersetzungsprompt des LLM eingefügt, sodass es konsistent angewendet wird, unabhängig davon, welches Förmlichkeits-Preset der Benutzer wählt:

- **Französisch**: Écriture inclusive mit Mittelpunktnotation (z. B. „Connecté·e“)
- **Deutsch**: Doppelpunktnotation (z. B. „Benutzer:innen“)
- **Spanisch**: Geschlechtsneutrale Umstrukturierung bevorzugt; Schrägstrichnotation (z. B. „usuario/a“) als Rückfalloption

Für Sprachen ohne spezifische Hinweise in ihrer Karte (z. B. Koreanisch, konstruierte Sprachen) greift das System auf eine generische Regel zurück: *„geschlechtsneutrale Formen oder die inklusivste verfügbare Option bevorzugen.“*

### Anforderungen für RTL-Schriften

Die Register für Arabisch, Hebräisch, Persisch und Urdu vermerken alle Anforderungen für die Schreibrichtung von rechts nach links: `Ensure text reads naturally in RTL layout contexts.`

### Überschreiben eines beliebigen Registers

Jedes Register ist ein Konfigurationswert — überschreiben Sie es, um es an die Stimme Ihres Projekts anzupassen:

```json
{
  "languages": {
    "fr": {
      "register": "Casual French. Use tu-form. Conversational blog tone. Gender-neutral when possible."
    },
    "de": {
      "register": "Informal German. Use du-form. Tech startup voice."
    }
  }
}
```

Siehe [Konfiguration](/docs/getting-started/configuration) für die vollständige Konfigurationsreferenz.

---

## Eine neue konstruierte Sprache hinzufügen

### Schritt für Schritt

1. **Wählen Sie einen BCP-47-Code für private Verwendung**: Verwenden Sie das Präfix `x-` (z. B. `x-dothraki`, `x-valyrian`).

2. **Zur Konfiguration hinzufügen**:

```json
{
  "languages": {
    "x-dothraki": {
      "register": "Dothraki language. Use David J. Peterson's vocabulary from the Living Language Dothraki textbook. Harsh, direct tone. No articles, no verb 'to be'."
    }
  }
}
```

3. **(Optional) Einen Schriftkonverter hinzufügen**: Wenn Ihre konstruierte Sprache eine nicht-lateinische Anzeigeschrift verwendet, fügen Sie einen Konverter in `lib/scripts.js` hinzu und registrieren Sie ihn in `SCRIPT_CONVERTERS`.

4. **Testen**: Führen Sie `champollion sync --dry` aus, um Übersetzungen in der Vorschau anzuzeigen, ohne Dateien zu schreiben.

5. **Das Qualitätstor prüfen**: Das [Qualitätstor](/docs/concepts/quality-gate) muss möglicherweise für Ihre konstruierte Sprache angepasst werden — insbesondere die Prüfung `requireNonLatin`, falls Ihre konstruierte Sprache PUA-Zeichen verwendet.

:::note[Die Qualität von Konsprachen hängt vom Wissen des LLM ab]
Das LLM kann nur in eine Konsprache übersetzen, die es in den Trainingsdaten gesehen hat. Gut dokumentierte Konsprachen (Klingonisch, Sindarin, Dothraki) funktionieren gut. Obskure oder neu erfundene Konsprachen können zu inkonsistenten Ergebnissen führen. Verwenden Sie [Coaching-Daten](/docs/concepts/coaching-data), um die Qualität zu verbessern.
:::

---

## Siehe auch

- [Unterstützte Sprachen](/docs/reference/supported-languages) — vollständige Sprachtabelle mit Verfügbarkeit der Methoden
- [Schriftkonverter](/docs/concepts/script-converters) — technische Details der Konvertierungspipeline
- [Übersetzungsmethoden](/docs/guides/translation-methods) — wie jede Übersetzungsmethode funktioniert
- [Konfiguration](/docs/getting-started/configuration) — Konfigurationsreferenz einschließlich Sprach- und Registereinrichtung
- [Eine ressourcenarme Sprache unterstützen](/docs/network/community/low-resource-languages) — dieselbe Infrastruktur, angewendet auf reale unterversorgte Sprachen
