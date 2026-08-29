---
sidebar_position: 6
title: "Skript-Konverter"
---

# Schriftkonverter

Schriftkonverter sind deterministische, LLM-freie Post-Übersetzungs-Hooks, die Text von einem Schriftsystem in ein anderes konvertieren. Sie ermöglichen einen Workflow nach dem Prinzip „einmal übersetzen, in mehreren Schriften darstellen“ — Sie übersetzen in eine Arbeitsschrift (typischerweise Latein) und konvertieren dann automatisch in die Anzeigeschrift.

## Warum Schriftkonverter?

Einige Sprachen verwenden mehrere Schriften für dieselbe gesprochene Sprache:

- **Plains Cree**: SRO (Latein) zum Bearbeiten → Silbenschrift (ᓀᐦᐃᔭᐍᐏᐣ) zur Anzeige
- **Serbisch**: Latein für den internationalen Gebrauch → Kyrillisch für den inländischen Gebrauch
- **Klingonisch**: Romanisierung zum Tippen → pIqaD (  ) zur Anzeige

Die direkte Übersetzung in nicht-lateinische Schriften verursacht Probleme: LLMs halluzinieren Zeichen, JSON-Dateien lassen sich schwer versionieren, und Diff-Tools können Änderungen nicht vergleichen. Schriftkonverter lösen dieses Problem, indem sie Übersetzungen in einer versionierungsfreundlichen Schrift halten und zum Zeitpunkt der Synchronisierung deterministisch konvertieren.

## Verfügbare Konverter

Champollion liefert fünf integrierte Schriftkonverter mit:

| Locale | Von | Nach | Typ | Schriftart erforderlich? |
|--------|------|----|------|----------------|
| `crk` | SRO (Standard Roman Orthography) | Cree-Silbenschrift | Deterministisch | Nein — natives Unicode |
| `sr` | Latein | Kyrillisch | Deterministisch | Nein — natives Unicode |
| `tlh` | Romanisierung | pIqaD | Deterministisch | Ja — PUA U+F8D0–F8FF |
| `x-elvish-s` | Latein | Tengwar (Mode of Beleriand) | Deterministisch | Ja — PUA U+E000–E07F |
| `x-kryptonian` | Latein | Kryptonisch | Schriftartbasierte Chiffre | Ja — PUA U+E100–E119 |

### Deterministisch vs. schriftartbasiert

- **Deterministische Konverter** (Cree, Serbisch, Klingonisch, Tengwar) führen eine echte Zeichen-zu-Zeichen-Zuordnung anhand linguistischer Regeln durch. Die Ausgabe enthält tatsächliche Unicode-Zeichen.
- **Schriftartbasierte Konverter** (Kryptonisch) sind 1:1-Substitutionschiffren, bei denen die Ausgabe aus Unicode-PUA-Zeichen besteht, die nur mit einer bestimmten geladenen Schriftart korrekt dargestellt werden.

## Funktionsweise

Schriftkonverter laufen **nach** der Übersetzung als Nachbearbeitungsschritt. Die Pipeline lautet:

```
Source (English) → LLM Translation → Working Script → Script Converter → Display Script
```

Zum Beispiel Plains Cree:
```
"Welcome" → LLM → "tānisi" (SRO) → Converter → "ᑖᓂᓯ" (Syllabics)
```

### Greedy-Abgleich von links nach rechts

Alle Konverter verwenden denselben Algorithmus: An jeder Zeichenposition wird zuerst der längstmögliche Treffer versucht, dann schrittweise kürzere Treffer. Zeichen, die keinem Muster entsprechen (Leerzeichen, Interpunktion, Zahlen), werden unverändert durchgereicht.

Dies behandelt Digraphen und Trigraphen korrekt:
- Klingonisch: `tlh` → einzelnes pIqaD-Zeichen (nicht `t` + `l` + `h`)
- Serbisch: `nj` → `њ` (nicht `н` + `ј`)
- Cree: `twê` → einzelnes Silbenzeichen (nicht `t` + `w` + `ê`)

## Verwendung von Schriftkonvertern

Die Konvertierung ist eine **Konfigurationsentscheidung, niemals automatisch** (seit 0.3.0 — frühere Versionen konvertierten bedingungslos, was nicht darstellbaren PUA-Text an Projekte auslieferte, deren Schriftarten eine lateinische Transliteration erwarteten):

- **crk und sr haben zwei reale Orthografien** (SRO/Syllabics, Lateinisch/Kyrillisch). Es gibt keinen Standardwert: `champollion init` fragt, welche geschrieben werden soll, und `sync` verweigert die Ausführung, bis die Konfiguration dies festlegt. Champollion wählt nicht das Schriftsystem einer Gemeinschaft aus.
- **tlh, x-elvish-s und x-kryptonian verwenden standardmäßig die Romanisierung** — ihre Anzeigeschriften befinden sich in der Private Use Area und sind ohne eine spezielle Schriftart nicht darstellbar. Sie müssen dies explizit aktivieren.

```json title="champollion.config.json"
{
  "languages": {
    "crk": { "script": "Cans" },
    "tlh": { "script": "Piqd" }
  }
}
```

Wenn Champollion `en:crk` mit `"script": "Cans"` synchronisiert, werden die Übersetzungen in SRO (der Arbeitsschrift, die das Gate validiert) erstellt und dann in Syllabics konvertiert, bevor sie in `crk.json` geschrieben werden. Mit `"script": "Latn"` — oder für tlh ganz ohne `script:` — ist die Arbeitsschrift das Endergebnis und es wird nichts konvertiert.

Buchstaben, die der Konverter nicht zuordnen kann (Klingonisch hat kein `d`, `c`, `f`, `g`, `i`, `k`, `s`, `x`, `z` — daher kann "GitHub" nicht vollständig konvertiert werden), behalten den **gesamten Wert** in der Arbeitsschrift bei, anstatt Schriften zu mischen, wobei eine Warnung die entsprechenden Buchstaben benennt. Deklarieren Sie Ihre eigenen Transliterationsregeln mit [`scriptFallback`](/docs/getting-started/configuration#script-fallback).

Um eine Konvertierung rückgängig zu machen, die stattfand, als sie noch bedingungslos war, führen Sie [`champollion repair-script`](/docs/getting-started/configuration#repair-script) aus; `champollion integrity` schlägt fehl, wenn PUA-Zeichen gefunden werden, wo die Konvertierung deaktiviert ist.

### Konverterstatus überprüfen

```bash
npx champollion status
```

Die Statusausgabe zeigt die ermittelte Schriftentscheidung für jedes Paar an — was geschrieben wird und ob ein Konverter verfügbar, aber nicht aktiviert ist.

## Anforderungen an Webschriftarten

Drei Konverter geben Unicode-Private-Use-Area-Zeichen (PUA) aus, die benutzerdefinierte Webschriftarten erfordern:

### Klingonisch (pIqaD)

Installieren Sie eine CSUR-kompatible pIqaD-Schriftart (z. B. „pIqaD qolqoS“ oder „Klingon pIqaD HaSta“):

```css
@font-face {
  font-family: 'pIqaD';
  src: url('/fonts/pIqaD.woff2') format('woff2');
  unicode-range: U+F8D0-F8FF;
}

:lang(tlh) {
  font-family: 'pIqaD', sans-serif;
}
```

### Tengwar (Sindarin)

Installieren Sie eine CSUR-kompatible Tengwar-Schriftart (z. B. „Tengwar Formal CSUR“, „Tengwar Annatar“):

```css
@font-face {
  font-family: 'Tengwar';
  src: url('/fonts/tengwar-formal-csur.woff2') format('woff2');
  unicode-range: U+E000-E07F;
}

:lang(x-elvish-s) {
  font-family: 'Tengwar', serif;
}
```

### Kryptonisch

Installieren Sie eine Kryptonisch-Schriftart, die den PUA-Codepunkten U+E100–E119 zugeordnet ist:

```css
@font-face {
  font-family: 'Kryptonian';
  src: url('/fonts/kryptonian.woff2') format('woff2');
  unicode-range: U+E100-E119;
}

:lang(x-kryptonian) {
  font-family: 'Kryptonian', sans-serif;
}
```

:::tip[Alternativer Ansatz für Kryptonisch]
Da Kryptonisch eine reine A-Z-Chiffre ist, können Sie den Script-Konverter vollständig überspringen und die Schriftart über CSS auf lateinischen Text anwenden. Dies ist für Web-Deployments oft einfacher – stellen Sie einfach die kryptonische Schriftart bereit und setzen Sie `font-family` für die betreffenden Elemente.
:::

## Hinzufügen eines benutzerdefinierten Konverters

Um einen Konverter für eine neue Sprache hinzuzufügen, bearbeiten Sie `lib/scripts.js`:

1. **Erstellen Sie die Konvertierungszuordnung** — ein geordnetes Array von `[from, to]`-Paaren, längste Sequenzen zuerst
2. **Erstellen Sie die Konverterfunktion** — einen Greedy-Scanner von links nach rechts (verwenden Sie `sroToSyllabics` als Vorlage)
3. **Registrieren Sie sie** im `SCRIPT_CONVERTERS`-Objekt mit dem Locale-Code als Schlüssel
4. **Fügen Sie das Feld `script` hinzu** zum Registereintrag der Sprache in `registers.js`

```javascript
// Example: adding a converter for Cherokee (chr)
const LATIN_TO_CHEROKEE_MAP = [
  ['ga', 'Ꭶ'], ['ka', 'Ꭷ'], ['ge', 'Ꭸ'], // ...
];

function latinToCherokee(text) {
  // Same greedy left-to-right pattern as other converters
}

SCRIPT_CONVERTERS['chr'] = {
  from: 'Latin',
  to: 'Cherokee Syllabary',
  type: 'deterministic',
  converter: latinToCherokee,
};
```

---

## Siehe auch

- [Conlangs, Schriften & Orthographie](/docs/guides/conlangs-scripts-orthography) — PUA-Schriftarten, Unicode, Hinzufügen neuer Konverter
- [Quality Gate](/docs/concepts/quality-gate) — Validierung, die vor der Schriftkonvertierung läuft
- [Unterstützte Sprachen](/docs/reference/supported-languages) — welche Sprachen über Schriftkonverter verfügen
- [Eine ressourcenarme Sprache unterstützen](/docs/network/community/low-resource-languages) — SRO→Silbenschrift im Kontext
- [Cookbook: FST-gesteuerte Pipeline](/docs/network/tutorials/fst-gated-pipeline) — Schriftkonvertierung in einer mehrstufigen Pipeline
