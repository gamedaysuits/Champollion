---
sidebar_position: 4
title: "Sprachkarten-Spezifikation"
description: "Kanonisches Schema für die sprachspezifischen Konfigurationskarten von Champollion."
# This page renders its canonical example from the live corpus via an MDX
# component; `mdx.format` opts this one .md file into the MDX processor.
mdx:
  format: mdx
related:
  - label: "Language Card Citation Procedure"
    to: /docs/reference/language-card-citation-procedure
    kind: reference
    note: "How every card fact gets its source"
  - label: "Trading Cards"
    to: /trading-cards
    kind: card
    note: "The cards rendered from this schema"
  - label: "Supported Languages"
    to: /docs/reference/supported-languages
    kind: reference
  - label: "Morphology"
    to: /glossary#term-morphology
    kind: glossary
---

import CardSpecExample from '@site/src/components/CardSpecExample';

# Spezifikation der Sprachkarte

> **Single Source of Truth (Einzige Wahrheitsquelle).** Dieses Dokument definiert die kanonische Form jeder Sprachkarte (Language Card). Eine Karte behauptet nur das, was eine zitierte Quelle behauptet: Ein Feld, das von keiner Quelle behauptet wird, wird **weggelassen, nicht auf null gesetzt** — ein fehlendes Feld bedeutet „keine Quelle hat sich geäußert“, niemals „es gibt nichts zu wissen“. Das maschinell überprüfbare Schema wird als `shared/schemas/language-card.schema.json` im npm-Paket ausgeliefert, und das [kanonische Beispiel unten](#canonical-template) wird bei jedem Website-Build aus dem Live-Korpus generiert, sodass diese Seite nicht von den beschriebenen Karten abweichen kann.

## Der Atlas-Rebuild von 2026-08 — was sich in diesem Schema geändert hat

Das Kartenkorpus ist nun ein **Build-Output**: Jede Karte wird aus einem Speicher von fixierten (pinned) Upstream-Snapshots projiziert und neu erstellt — niemals bearbeitet —, wenn sich ein Fakt ändert. Vier Dinge an der Struktur haben sich mit diesem Rebuild geändert:

1. **Umstrittene Felder enthalten einen Attributions-Umschlag (Attribution Envelope).** Wo zitierte Quellen tatsächlich nicht übereinstimmen, ist das Feld kein flacher Wert, sondern `{"agreement": "...", "consensus": <value?>, "values": [{"value": ..., "source": "..."}]}`. This applies to `name`, `classification.family`, `speakerEstimates`, `endangerment` und jedes Feld, das durch eine neue Quelle umstritten wird. Konsumenten sollten Karten über den veröffentlichten Adapter (`normalizeCard()` im npm-Paket) lesen, anstatt von flachen Werten auszugehen — `display()` löst einen Umschlag in seinen vereinbarten Wert auf und gibt bei einem echten Streitfall absichtlich nichts zurück, anstatt einen Gewinner zu küren.

2. **Umbenannte Felder.** `endonym` ersetzte `nativeName` · `codeAliases` ersetzte `aliases` · `scripts[]` (alle belegten Schriften) ersetzte das flache `script`, wobei die primäre Schriftart aus dem maximalen BCP 47-Tag der Karte abgeleitet wird · `endangerment` (die Bewertung jeder Quelle auf der eigenen Skala dieser Quelle) ersetzte das einzelne `vitality`-Objekt · `isoLanguageType` und `isoScope` enthalten nun die eigenen Wörter von ISO 639-3 ("Living", "Macrolanguage") anstelle von Initialen. Neue Felder: `modality` ("spoken"/"signed", abgeleitet von der Abstammung in Glottolog), `glottologBucket` (die nicht-genealogischen Kategorien von Glottolog, die aus dem Familien-Slot herausgehalten werden), `locale`/`localeScoped`.

3. **Nicht behauptete Felder werden weggelassen, nicht auf null gesetzt.** Ein Feld, das von keiner Quelle behauptet wird, fehlt auf der Karte. Die frühere Regel („jede Karte MUSS jedes Top-Level-Feld enthalten, auch wenn es null ist“) wurde abgeschafft: Ein leerer Wert auf einer öffentlichen Oberfläche wird als Behauptung gelesen, dass es nichts zu wissen gibt, was nicht dasselbe ist, wie nicht nachgesehen zu haben.

4. **Locale-Karten existieren.** Neben den Sprachkarten enthalten Locale-Projektionen (`fra-CA`, `cmn-Hant`) die Fakten ihrer Sprache, aufgelöst für ein Territorium oder eine Schrift, identifiziert durch einen `locale: {language, region, script}`-Block. Ein Locale ist keine Sprache: Schließen Sie Locales anhand dieses Blocks aus Sprachzählungen aus.

## Designprinzipien

1. **Alles belegen.** Jede Tatsachenbehauptung lässt sich auf eine benannte, versionierte Primärquelle zurückführen. Unbelegte Behauptungen sind nicht überprüfbare Behauptungen. Die `_fieldSources`-Map (und die feldbezogenen `source`-Annotationen in Unterobjekten) machen die Herkunft (Provenance) explizit.

2. **Uneinigkeit bewahren.** Wenn Autoritäten nicht übereinstimmen (eine Quelle sagt 50.000 Sprecher, eine andere sagt 20.000), speichert die Karte *beide* mit Quellenangabe — in der oben genannten Umschlagform (Envelope). Wir bilden keinen Durchschnitt, lösen nicht auf und ergreifen keine Partei. Benutzer können selbst durch diese Nuancen navigieren.

3. **Fehlend bedeutet nicht behauptet.** Ein fehlendes Feld bedeutet, dass keine Quelle einen Wert behauptet. Wenn eine Eigenschaft tatsächlich nicht zutrifft (z. B. grammatikalisches Geschlecht für eine Sprache ohne dieses), gibt der zitierte Wert dies explizit an, anstatt leer zu sein.

4. **Neu erstellt, niemals gepatcht.** Karten werden durch einen deterministischen Build aus fixierten Quellen projiziert. Ein fehlerhafter Fakt wird in seinem Source-Handler behoben und das Korpus neu erstellt — keine In-Place-Bearbeitungen, keine reine Merge-Anreicherungsschicht.

---

## Drei-Schichten-Architektur

| Schicht | Speicherort | Zweck |
|-------|----------|---------|
| **Sprachkarten** | `shared/language-cards/<code>.json` | Sprachspezifische Konfiguration: Identität, Klassifikation, Ressourcen, alles |
| **Genus-Karten** | `shared/language-cards/genera/<genus>.json` | Gemeinsame Laufzeiteigenschaften für verwandte Sprachen (kuratiert, nicht automatisch generiert) |
| **Sprachbaum** | `shared/language-cards/language-tree.json` | Vollständige Glottolog-Hierarchie — Referenzdaten für die Lab-Benutzeroberfläche und Sprachentdeckung |

---

## Vererbungsmodell

> **Größtenteils historisch seit dem Atlas-Rebuild.** Keine Sprachkarte auf der Festplatte enthält mehr `extends` — jede Karte wird durch den Build vollständig materialisiert, da vererbter Fließtext nicht zitierfähig war (eine Behauptung auf Familienebene trug eine Adresse auf Sprachebene). Der Mechanismus selbst überlebt an einer Stelle: Das Offline-Bundle des npm-Pakets liefert Locale-Karten als kompakte `extends`-Deltas gegenüber ihrer Sprache aus, die durch denselben hier beschriebenen Merge aufgelöst werden.

Wenn eine Karte `"extends": "family-dravidian"` setzt, führt die Laufzeitumgebung die übergeordnete
Karte mittels `_deepMerge()` (in `lib/registers.js`) in die untergeordnete ein. Dies ermöglicht es
Genus-Karten, gemeinsame Register, Formalitätssysteme und Geschlechterhinweise zu definieren, die
an alle zugehörigen Sprachen weitergegeben werden — ohne Daten über Hunderte von
einzelnen Karten hinweg zu duplizieren.

### Merge-Semantik

| Wert der untergeordneten Karte | Verhalten | Grund |
|-------------|----------|-----|
| `null` | Von übergeordneter Karte erben | `null` bedeutet „Ich definiere dies nicht" — der Wert der übergeordneten Karte wird durchgereicht |
| Nicht-null | Übergeordnete Karte überschreiben | Die Daten der untergeordneten Karte sind spezifischer — haben Vorrang |
| Verschachteltes Objekt | Rekursive Zusammenführung | Felder der untergeordneten Karte überschreiben, Felder der übergeordneten bleiben erhalten |
| Array | Vollständig ersetzen | Arrays werden nicht elementweise zusammengeführt — das Array der untergeordneten Karte gewinnt |

### Identitätsfelder (Niemals vererbt)

Einige Felder gehören zur Karte selbst und dürfen NIEMALS von einer übergeordneten Karte vererbt werden:

```
code, extends, _migration, aliases, iso639_1, iso639_3
```

Selbst wenn eine übergeordnete Karte `aliases: ["macro-code"]` definiert, wird eine untergeordnete Karte diese
Aliase NICHT erben. Diese Felder sind stets die eigenen Werte der untergeordneten Karte (einschließlich
`null`, falls nicht gesetzt).

**Warum:** Ohne diese Regel würde jede Cree-Sprache `aliases: ["cre"]`
von der übergeordneten Makrosprache erben, wodurch jede Varietät zu einem Alias der Makrosprache würde.

### Beispiel: Wie eine Cree-Karte aufgelöst wird

```
┌───────────────────────┐
│  family-algic.json    │  formality: null, registers: null
│  (no registers)       │
└──────────┬────────────┘
           │ extends
┌──────────┴────────────┐
│  genus-cree.json      │  formality: { system: "obviative-animate", ... }
│  (sourced registers)  │  registers: { formal: {...}, informal: {...} }
└──────────┬────────────┘
           │ extends
┌──────────┴────────────┐
│  crk.json             │  code: "crk", extends: "genus-cree"
│  (Plains Cree)        │  formality: null → inherits from genus-cree
│                       │  registers: null → inherits from genus-cree
│                       │  script: "Cans"  → own value, no inheritance
│                       │  code: "crk"     → identity field, never inherited
└───────────────────────┘
```

Zur Laufzeit gibt `getLanguageCard("crk")` ein zusammengeführtes Objekt mit den Registern von genus-cree
+ den Eigenschaften von family-algic (falls vorhanden) + der eigenen Identität und Metadaten von crk zurück.

### Vorlage für Genus-Karten

Genus-Karten befinden sich in `shared/language-cards/genera/` und definieren gemeinsame Eigenschaften
für eine Sprachgruppe. Sie folgen demselben Schema wie reguläre Karten, jedoch mit
anderen Konventionen:

```jsonc
{
  // Identity — genus cards use a prefixed code, NOT an ISO 639-3 code
  "code": "genus-cree",           // "genus-", "family-", or "macrolanguage-" prefix
  "name": "Cree Languages",      // Human-readable group name
  "extends": "family-algic",     // Genus cards can extend family cards (chaining)

  // Formality — shared across the group, sourced from typological databases
  "formality": {
    "system": "obviative-animate",
    "description": "Cree languages use an obviative/proximate system...",
    "default": "formal",
    "source": "WALS 37A, 38A + Wolfart 1973"
  },

  // Registers — shared presets, if the group shares a formality system
  "registers": {
    "formal": {
      "label": "Formal (Proximate)",
      "description": "...",
      "prompt": "...",
      "isDefault": true
    },
    "informal": {
      "label": "Informal",
      "description": "...",
      "prompt": "..."
    }
  },

  // Gender — shared grammatical gender behavior
  "gender": {
    "grammatical": false,       // Cree doesn't have grammatical gender
    "inclusiveGuidance": null   //   so no inclusive guidance needed
  },

  // Everything else is null — individual cards provide their own
  // classification, geography, resources, etc.
  "classification": null,
  "methodSupport": null,
  // ...
}
```

**Schlüsselregel:** Genus-Karten dürfen NUR Daten enthalten, die tatsächlich über
die gesamte Gruppe hinweg gemeinsam sind und aus maßgeblichen Referenzen stammen. Wenn ein Formalitätssystem
zwischen Mitgliedern variiert, gehört es auf die einzelnen Karten, nicht auf das Genus.

## Kanonisches Beispiel \{#canonical-template}

> **Generiert, nicht geschrieben.** Alles in diesem Abschnitt wird zur Build-Zeit aus dem Live-Korpus abgeleitet: die vollständige `crk`-Karte (Plains Cree), Byte für Byte, plus ein `fra-CA`-Locale-Auszug. Wenn das Korpus neu erstellt wird, leitet der nächste Website-Build diese Seite neu ab. Es gibt keine manuell gepflegte Vorlage mehr, die veralten könnte — die vorherige fiel eine ganze Schema-Generation hinter die Karten zurück und wurde am 16.08.2026 ausgemustert.

Das Beispiel zeigt die **Struktur auf der Festplatte (On-Disk Shape)** — das, was Sie erhalten, wenn Sie die Datei öffnen. Konsumenten sollten Karten weiterhin über den veröffentlichten Adapter (`normalizeCard()` im npm-Paket) lesen: Er löst Umschläge (Envelopes) auf, überbrückt die Namen vor der Umstellung (Pre-Cutover) und leitet die reinen Anzeigewerte (primäre Schriftart, Vitalitätsstufe) ab, die die rohe Karte absichtlich nicht enthält.

Worauf Sie beim Lesen achten sollten:

1. **Attributions-Umschläge (Attribution Envelopes).** `name`, `classification.family`, `endangerment`, `speakerEstimates`, `endonym`, `bcp47FullTag` und `politenessDistinction` enthalten jeweils `{agreement, consensus?, values: [{value, source}]}`, every value attributed to its source. `endangerment` hat `"agreement": "incommensurable"`: Seine Quellen bewerten auf unterschiedlichen Skalen, sodass jeder Wert seine `scale` benennt, anstatt auf die eines Gewinners konvertiert zu werden.

2. **Weggelassen bedeutet nicht behauptet.** Die Karte hat kein `iso639_1` (Plains Cree hat keinen ISO 639-1-Code) und kein `phonologicalInventory` (keine eingelesene Quelle behauptet eines) — diese Felder fehlen einfach, sie sind niemals `null` oder `[]`.

3. **Herkunft (Provenance) ist eine First-Class-Schicht.** `_fieldSources` ordnet jedes Feld der Quelle bzw. den Quellen zu, die es behauptet haben, wobei `champollion-derived-v1` Werte markiert, die Champollion berechnet hat. `_card` stempelt den Typ, die ID, die Revision der Karte und welche Felder die Korrektur-Lane berühren darf; `_atlas` stempelt das Korpus-Release.

4. **Keine Ausführungsergebnisse (Run Results).** Nichts auf der Karte ist ein gemessener Score einer Methodenausgabe — chrF, FST-Akzeptanzraten und Ähnliches sind Ausführungsergebnisse, die nach (Methode, Datensatz, Metrik) geschlüsselt sind und auf dem Leaderboard leben. Die Karte behauptet lediglich, dass Ressourcen *existieren* (`resources`, `lexicalResources`, `methodSupport`).

<CardSpecExample variant="language" />

### Eine Locale-Karte ist eine Projektion, keine Sprache \{#locale-card-example}

Neben den Sprachkarten befinden sich Locale-Karten (`fra-CA`, `cmn-Hant`): Die Fakten einer Sprache, **aufgelöst für ein Territorium oder eine Schrift**, identifiziert durch ihren `locale`-Block — niemals durch die Code-Form. Eine Locale-Karte erbt die Fakten ihrer Sprache, löst die auf Schrift und Territorium bezogenen Fakten auf (`script`, `localeScoped`) und ist **keine Sprache**: Schließen Sie Locale-Karten anhand dieses `locale`-Blocks aus jeder Sprachzählung und jeder sprachspezifischen Auflistung aus.

<CardSpecExample variant="locale" />

---

## Feldreferenz \{#field-reference}

Für jede der folgenden Tabellen gelten zwei Konventionen:

- **„envelope“** bedeutet ein Attributions-Umschlag (Attribution Envelope) — `{agreement, consensus?, values: [{value, source, note?, scale?}]}` —, der die Behauptung *jeder* Quelle enthält. Ein als `envelope` aufgeführtes Feld kann als flacher Wert auf Karten erscheinen, bei denen nur eine Quelle spricht (zum Beispiel enthalten reine Glottolog-Languoide ein flaches `name`); Konsumenten müssen beides handhaben, was der veröffentlichte Adapter auch tut.
- Kein Feld ist über `code` und `name` hinaus erforderlich; alles andere wird **weggelassen, wenn keine Quelle es behauptet**. Die behauptende(n) Quelle(n) jedes Feldes werden pro Karte in `_fieldSources` aufgezeichnet, sodass die Tabellen die *Art* der Quelle beschreiben, anstatt Versionen festzulegen, die abweichen würden.

### § 1. Identitätsfelder

| Feld | Form | Hinweise |
|-------|-------|-------|
| `code` | `string` | **Erforderlich.** Die Karten-ID und der Dateiname. ISO 639-3 für Sprachkarten (`crk`); reine Glottolog-Languoide tragen ihren Glottocode; Locale-Karten tragen einen Locale-Code (`fra-CA`). |
| `name` | envelope | **Erforderlich.** Englischer Referenzname (ISO 639-3-Register, LinguaMeta, Glottolog). |
| `endonym` | envelope | Ersetzte `nativeName`. Wie Sprecher die Sprache in der Sprache nennen (LinguaMeta, Wikidata). Fehlt, wenn keine Quelle eines behauptet — ein Endonym wird von uns niemals erfunden oder transliteriert. |
| `alternateNames` | `string[]` | Andere belegte englische Namen. |
| `iso639_1` | `string` | Nur vorhanden, wenn ein zweistelliger ISO 639-1-Code existiert (`fra` → `"fr"`). |
| `isoScope` | `string` | Die eigenen Wörter von ISO 639-3 — `"Individual"`, `"Macrolanguage"`, `"Special"` (ersetzte die Initialen `"I"`/`"M"`/`"S"`). |
| `isoLanguageType` | `string` | Ersetzte `isoType`. Die eigenen Wörter von ISO 639-3 — `"Living"`, `"Extinct"`, `"Ancient"`, `"Historical"`, `"Constructed"`. |
| `macrolanguage` | `string` | Die Makrosprache, zu der diese Sprache gehört (`crk` → `"cre"`). ISO 639-3-Makrosprachen-Zuordnungen. |
| `macrolanguageMembers` | `string[]` | Auf Makrosprachen-Hub-Karten: die einzelnen Mitgliedscodes (`nor` → `["nno", "nob"]`). |
| `canonicalisedMembers` | envelope | Auf Makrosprachen-Karten: Mitglieder, deren Tags die BCP 47-Register in das Tag dieser Makrosprache zusammenfassen (CLDR-Alias-Tabelle + SIL-Langtags, jeweils mit Quellenangabe). |
| `supersededCodes` | `string[]` | Ausgemusterte ISO 639-3-Codes, die SIL nun auf diese Sprache verweist — auf dem Nachfolger aufgezeichnet, damit Korpora, die unter einem alten Code veröffentlicht wurden, weiterhin aufgelöst werden. |
| `codeAliases` | `string[]` | Ersetzte `aliases`. Identifikatoren auf Code-Ebene, die zu dieser Karte aufgelöst werden. |
| `bcp47` | `string` | Das BCP 47-Tag der Sprache wie behauptet (LinguaMeta). |
| `bcp47Tag` | envelope | Von Champollion abgeleitet: das RFC 5646-Tag (der kürzeste ISO 639-Code gewinnt). |
| `bcp47FullTag` | envelope | Die maximale Sprache–Schrift–Region-Form (CLDR likelySubtags + SIL langtags). Der Adapter leitet die **primäre Schriftart** aus diesem Tag ab. |
| `modality` | `string` | `"spoken"` oder `"signed"`, abgeleitet von der Abstammung in Glottolog. Schreiben ist ein Orthografie-Attribut, keine Modalität — eine ungeschriebene Sprache wird dennoch vollständig gesprochen oder gebärdet. |
| `locale` | `object` | **Nur Locale-Karten.** `{language, region, script, publishedTag, source, note}` — DIE Locale-Identität. Schließen Sie Locale-Karten anhand dieses Blocks aus Sprachzählungen aus, niemals durch die Code-Form. |
| `localeScoped` | `object` | Nur Locale-Karten: Werte, die für das Territorium/die Schrift des Locales aufgelöst wurden (z. B. `scriptName`, `cldrOfficialStatus`). |

### § 2. Klassifikationsfelder

| Feld | Form | Hinweise |
|-------|-------|-------|
| `glottocode` | `string` | Der Identifikator von Glottolog für dieses Languoid (`crk` → `"plai1258"`). Reine Glottolog-Languoide — Sprachen, die Glottolog erfasst, ISO 639-3 jedoch nicht — verwenden den Glottocode als ihre Karten-`code`. |
| `classification` | `object` | Container für die unten stehenden Platzierungsfelder. Jedes wird unabhängig belegt und unabhängig weggelassen — ein Isolat oder eine Sprache, die in einer Glottolog-Kategorie (Bucket) abgelegt ist, enthält legitimerweise nur einen Teil dieses Objekts. |
| `classification.family` | envelope | Die Top-Level-Familie, die jede Klassifizierungsautorität behauptet. Glottolog und WALS sind separate Taxonomien, die nicht immer übereinstimmen, daher werden beide beibehalten und mit Quellenangaben versehen. Die Lint-Regel R5 prüft den Glottolog-Wert innerhalb des Umschlags gegen den eigenen Baum von Glottolog: WALS darf Glottolog widersprechen, aber Glottolog darf nicht falsch zitiert werden. Isolate haben überhaupt keine Familie. |
| `classification.familyGlottocode` | `string` | Glottocode dieser Top-Level-Familie (`crk` → `"algi1248"`). |
| `classification.genus` | `string` | Der intermediäre Klassifizierungsknoten von WALS (`crk` → `"Algonquian"`). Ein WALS-Konzept, **kein** Glottolog-Konzept — Glottolog veröffentlicht einen Baum beliebiger Tiefe ohne Genus-Ebene —, daher ist es nur dort vorhanden, wo WALS die Sprache codiert. |
| `classification.ancestry` | `string[]` | Der Abstammungspfad von Glottolog als Vorfahren-Glottocodes, Wurzel zuerst (`["algi1248", …, "plai1264"]`). Die Reihenfolge **ist** die Behauptung: Dies ist ein Pfad, niemals eine alphabetisierte Menge. |
| `classification.glottologBucket` | `string` | Die nicht-genealogischen Kategorien (Buckets) von Glottolog — `"Artificial Language"`, `"Pidgin"`, `"Mixed Language"`, `"Speech Register"`, `"Unclassifiable"`, `"Unattested"`. Werden aus dem Familien-Slot herausgehalten, da eine Kategorie nach Art und nicht nach Abstammung klassifiziert: Eine Karte mit einer Kategorie hat keine Familie, und das ist das ehrliche Ergebnis. |
| `isIsolate` | `boolean` | Ob Glottolog diese Sprache als Isolat klassifiziert. |

Die Karte vor der Umstellung (Pre-Cutover) enthielt auch ein `genusGlottocode`. Es wurde zusammen mit dem Kategorienfehler, der es hervorgebracht hat, ausgemustert: Das Genus ist das Konzept von WALS, und es in einen Glottolog-Identifikator zu kleiden, behauptete einen Baumknoten, den Glottolog nicht hat. Die Glottolog-Hierarchie wird stattdessen durch `ancestry` getragen.

### § 3. Geografiefelder

| Feld | Form | Hinweise |
|-------|-------|-------|
| `macroarea` | `string` | Die Makroarea von Glottolog — `"Africa"`, `"Australia"`, `"Eurasia"`, `"North America"`, `"Papunesia"` oder `"South America"`. |
| `coordinates` | `object` | `{lat, lng}` — Der repräsentative Punkt von Glottolog. Ein Punkt, kein Territorium: Er platziert die Sprache auf einer Karte und behauptet nichts über Verbreitungsgebiet oder Grenzen. |
| `countries` | `string[]` | ISO 3166-1 alpha-2-Codes der Länder, die Glottolog mit der Sprache assoziiert (`["CA", "US"]`). |
| `cldrOfficialStatus` | `string` | Ein offizieller Status, den ein Territorium der Sprache gewährt, wie von CLDR erfasst (übertragen via LinguaMeta) — `"Official"`, `"Regional official"`. Auf einer Locale-Karte befindet sich der für das Territorium *dieses Locales* aufgelöste Status in `localeScoped.cldrOfficialStatus`. |

Das Pre-Cutover-Array `regions` (Aufschlüsselung der Sprecher pro Land mit Admin-Codes) und `arealContext` (Sprachbund-Mitgliedschaft) sind ausgemustert: Keine eingelesene Quelle behauptet sie, und unbelegte Kuration überlebt keinen Rebuild. Sprecherbehauptungen auf Regionsebene können an dem Tag zurückkehren, an dem eine zitierfähige Quelle in der Pipeline landet; bis dahin ist das Fehlen der ehrliche Zustand.

### § 4. Schriftsystemfelder

| Feld | Form | Hinweise |
|-------|-------|-------|
| `scripts` | `string[]` | Ersetzte das flache `script`. **Alle** belegten ISO 15924-Codes (`crk` → `["Cans", "Latn"]`), ungeordnet — lesen Sie `scripts[0]` niemals als „die“ Schrift. Die primäre Schriftart wird vom Adapter aus dem maximalen Tag von `bcp47FullTag` abgeleitet. |
| `scriptNames` | `string[]` | Von Champollion abgeleitete Anzeigenamen für `scripts[]` (`"Unified Canadian Aboriginal Syllabics"`). |
| `textDirection` | `string` | Ersetzte `dir`. Die eigenen Wörter der Quelle — `"left-to-right"` / `"right-to-left"` (war `"ltr"`/`"rtl"`). |
| `suppressScript` | `string` | CLDR Suppress-Script: die Schrift, die für die Sprache so kanonisch ist, dass BCP 47-Tags sie weglassen (`fra` → `"Latn"`). |
| `script` | `string` | **Nur Locale-Karten**: die für das Locale aufgelöste Schrift (`fra-CA` → `"Latn"`, `cmn-Hant` → `"Hant"`). Sprachkarten enthalten kein flaches Schrift-Feld. |

Eine Sprache ohne belegte Schrift hat einfach **kein `scripts`-Feld** — das Fehlen bedeutet, dass keine Quelle eine Schrift behauptet hat, nicht die Behauptung, dass die Sprache „ungeschrieben“ ist. (Gebärdensprachen sind die größte derartige Gruppe: Kein Notationssystem hat eine gemeinschaftsweite Akzeptanz für die alltägliche Lese- und Schreibfähigkeit.)

### § 5. Demografische & Vitalitätsfelder

| Feld | Form | Hinweise |
|-------|-------|-------|
| `speakerEstimates` | envelope | Die Schätzung jeder Quelle, mit Quellenangabe. Werte können genaue Zählungen oder die eigenen Bereichs-Strings der Quelle sein (`"10000-99999"`), wobei die Vorbehalte der Quelle wörtlich in `note` übernommen werden. `"agreement": "conflicting"` ist häufig — den Konflikt zu zeigen, *ist* das Produkt; es wird kein Durchschnitt gebildet oder ausgewählt. |
| `endangerment` | envelope | Ersetzte das einzelne `vitality`-Objekt. Die Bewertung jeder Quelle **auf der eigenen Skala dieser Quelle** — jeder Wert enthält ein `scale`-Feld, und `"agreement": "incommensurable"` ist die Norm, da die Vokabulare von ELCat, Glottolog AES und LinguaMeta keine Übersetzungen voneinander sind. Der Adapter leitet eine Anzeige-*Vitalitätsstufe (Vitality Tier)* aus einer einzigen benannten Quelle gemäß der deklarierten Autoritätsreihenfolge ab; diese Stufe dient nur der Anzeige — das vollständige Set mit Quellenangaben bleibt auf der Karte. |

Eine *angezeigte* Sprecherzahl an beliebiger Stelle in Champollion muss mit einem der zitierten `speakerEstimates`-Einträge übereinstimmen oder eine explizite `champollion-derived`-Herkunft (Provenance) tragen — dies wird durch die Kartenintegritätsregeln erzwungen.

### § 5.5 Dokumentations- & digitale Präsenzfelder

| Feld | Form | Hinweise |
|-------|-------|-------|
| `documentation` | `object` | Ersetzte `documentationDepth`. Die Aufzeichnung von Glottolog darüber, wie gut die Sprache beschrieben ist, in den eigenen Begriffen von Glottolog. |
| `documentation.medLevel` | `string` | Das „Most Extensive Description“-Level von Glottolog, wörtlich — `"long grammar"`, `"grammar"`, `"grammar sketch"`, `"phonology"`, `"wordlist"`. |
| `documentation.medSourceId` | `string` | Der bibliografische Schlüssel dieser umfangreichsten Beschreibung im Referenzkatalog von Glottolog. |
| `documentation.firstDocumented` | `number` | Die eigene Spalte „first-year-of-documentation“ von Glottolog, wörtlich — hierher verschoben aus dem Pre-Cutover-Top-Level-Feld. Nur bei wenigen hundert Sprachen vorhanden, und diese Spärlichkeit ist an sich schon wissenswert. |
| `documentation.lastDocumented` | `number` | Die Spalte „last-year-of-documentation“ von Glottolog, wörtlich — bei etwa tausend Sprachen vorhanden. |
| `wikipediaEdition` | `object` | Ersetzte `digitalPresence`. `{site, url, name}` — eine offene Wikipedia-Ausgabe existiert in dieser Sprache (`afr` → `af.wikipedia.org`). Nur Existenz, absichtlich **ohne Artikelzählungen**: Mehrere Ausgaben sind größtenteils bot-generiert, und eine riesige Ausgabe ist in keinem für einen Übersetzer nutzbaren Sinne „besser dokumentiert“ als eine kleine. |
| `dialectCount` | `number` | Die eigene `child_dialect_count`-Spalte von Glottolog, wörtlich — nur direkte untergeordnete Dialekte, nicht der gesamte Teilbaum. Dies ist die Behauptung von Glottolog, nicht unsere Arithmetik: Eine frühere Regel stempelte es als `champollion-derived` und ließ Tausende von Karten die Zählung von Glottolog für sich beanspruchen. |

Der Rest des Pre-Cutover-Blocks `digitalPresence` (Common Voice-Stunden, Tatoeba-Satzanzahlen) ist ausgemustert, bis diese Quellen in der Pipeline landen — das Tatoeba-Korpus selbst erscheint bereits dort, wo es hingehört, als paralleles Korpus unter `resources.corpora` (§ 9).

### § 6. Formalitäts-, Register- & Geschlechterfelder

Das projizierte Korpus enthält hier genau ein Feld — den zitierten Fakt:

| Feld | Form | Hinweise |
|-------|-------|-------|
| `politenessDistinction` | envelope | Ob die Sprache Höflichkeit in Formen der zweiten Person grammatikalisiert. Belegt durch Grambank GB415 (binär: absent/present) und WALS 45A (vier Stufen: no distinction / binary / multiple / pronouns avoided). Dies sind unterschiedliche Skalen, daher benennt jeder Wert seine `scale` und der Umschlag meldet sie als **inkommensurabel** (nicht vergleichbar) anstatt als Uneinigkeit. |

**Das Register-System ist Konfiguration, kein Kartenfakt.** Das Pre-Cutover-Korpus speicherte `formality`-Fließtext und `registers`-Prompts auf jeweils fast achtzehnhundert Karten — fast alles davon aus denselben beiden oben genannten Quellen generiert und dann so mitgeführt, als wäre es handkuratierte Konfiguration. Der Atlas behält den Fakt; die Konfigurationsoberflächen — `formality`, `registers`, `gender`, `codeSwitching` — bleiben Teil des **kuratierten Schemas des npm-Pakets** (`language-card.schema.json`), leben auf den kuratierten Genus-/Familien-Hub-Karten und erreichen die CLI durch den `extends`-Merge des Register-Systems, der im [Vererbungsmodell (Inheritance Model)](#inheritance-model) beschrieben ist. Es handelt sich nicht um projizierte Atlas-Felder: Keine Karte im projizierten Korpus enthält sie, und der Atlas-Build wird sie niemals schreiben. Die Anleitung unter [Gute Register-Presets schreiben (Writing Good Register Presets)](#writing-good-register-presets) gilt für diese kuratierte Lane.

### § 7. Linguistische Profilfelder

| Feld | Form | Hinweise |
|-------|-------|-------|
| `typologicalProfile` | `object` | Ein Schlüssel pro eingelesenem typologischen Merkmal, jeder Wert ist die eigene Codierung der Quelle, jeder Schlüssel ist nur dort vorhanden, wo die Quelle diese Sprache codiert. Boolesche Werte stammen aus Grambank-Merkmalen, Kategorie-Strings aus WALS-Kapiteln; das Decision-Registry benennt den genauen Upstream-Parameter für jeden Schlüssel. |
| `phonologicalInventory` | `object` | `{consonants, vowels, tones, totalPhonemes, hasTone}` — Zählungen, die von Champollion über ein zitiertes PHOIBLE-Inventar berechnet wurden (PHOIBLE veröffentlicht eine Zeile pro Segment und behauptet keine Zählungen), sodass jeder Wert eine `champollion-derived`-Herkunft trägt. **PHOIBLE ist die einzige Ton-Autorität** (Lint R1): Grambank hat kein Ton-Merkmal, und nichts anderes auf der Karte darf Tonalität beanspruchen. |
| `numeralSystem` | `object` | `{base}` — die Zahlenbasis, wörtlich aus Chans *Numeral Systems of the World's Languages* (`"decimal"`, `"quinary-vigesimal"`, `"body tally"`; fast hundert verschiedene Werte). Fehlt, wenn Chans eigene Basis-Spalte leer ist — bei etwa der Hälfte der untersuchten Sprachen —, da ein früherer Generator die Lücke mit `"decimal"` füllte und Werte für zweitausend Sprachen erfand. |
| `pluralCategories` | `string[]` | Die kardinalen Pluralkategorien, die CLDR für diese Sprache angibt — Arabisch unterscheidet `["zero", "one", "two", "few", "many", "other"]`, Französisch drei davon, Chinesisch eine. Aus den Schlüsseln des eigenen Regelwerks von CLDR gelesen, es ist also die Behauptung von CLDR, nicht unsere Ableitung. Ersetzte das Pre-Cutover-`rules.plurals.categories`; eine i18n-Pipeline benötigt es, um zu wissen, wie viele Pluralformen eine Nachricht bereitstellen muss. |

Die derzeit projizierten `typologicalProfile`-Schlüssel mit ihren Upstream-Parametern:

- **WALS-Kapitel** (Kategorie-Strings, die eigenen Wert-Labels von WALS): `fusion` (20A), `verbSynthesis` (22A), `affixPreference` (26A), `reduplication` (27A), `genderCount` (30A), `caseCount` (49A), `wordOrder` (81A), `subjectVerbOrder` (82A), `verbalAlignment` (100A), `negationOrder` (143A)
- **Grambank-Merkmale** (Boolesche Werte): `hasGenderInPronouns` (GB030), `hasSexBasedGender` (GB051), `hasNumeralClassifiers` (GB057), `hasCoreCase` (GB070), `hasObliqueCase` (GB071), `marksPastTense` (GB083), `marksPresentTense` (GB084)

Die Pre-Cutover-Blöcke `linguisticChallenges` und `contactInfluences` werden nicht projiziert — recherchierter Fließtext ohne eingelesene Quelle verbleibt im kuratierten Schema des npm-Pakets, wie die Register-Oberflächen in § 6 (die Tabellen zu [Kontakteinfluss-Typen (Contact Influence Types)](#contact-influence-types) unten bedienen diese Lane). Der `rules`-Block ist ausgemustert: Was darin zitierfähig war, überlebt hier als `pluralCategories` und in den Schrift-Feldern in § 4.

### § 8. Enzyklopädische Felder

Von Karten ausgemustert. Die Pre-Cutover-Blöcke `encyclopedic` (Essays zu Geschichte und Dialekten, institutionelle Links), `culturalAphorism` und `varieties` waren handkuratierter Fließtext auf Kartenebene, den der Rebuild absichtlich löscht. Die Mitgliedschaftsfakten, auf die `varieties` hindeutete, sind nun zitierte Identitätsfelder (§ 1 `macrolanguageMembers` und `canonicalisedMembers`), und die Tool-Abdeckung pro Varietät wird durch die eigene Karte jedes Mitglieds beantwortet (`methodSupport`, `resources`). Ein repräsentatives Sprichwort kann über eine Community-Beitrags-Lane mit Zustimmung und Quellenangabe zurückkehren; es wird nicht als unzitiertes Kartenfeld zurückkehren.

### § 9. Digitale Ressourcenfelder

Alles in diesem Abschnitt behauptet **Existenz und Fähigkeit, niemals Qualität**: dass eine Ressource veröffentlicht ist und wer sie veröffentlicht — niemals, dass sie gut, vollständig oder nutzbar ist, und niemals ein gemessener Score. Jeder gemessene Score einer Methodenausgabe ist ein Ausführungsergebnis (Run Result), das nach (Methode, Datensatz, Metrik) geschlüsselt ist, auf dem Leaderboard lebt und auf Karten verboten ist (Lint R3).

| Feld | Form | Hinweise |
|-------|-------|-------|
| `resources` | `object` | Container: Jedes der folgenden Unterfelder ist eine unabhängig belegte Liste, die weggelassen wird, wenn keine Quelle sie behauptet. |
| `resources.fsts` | `object[]` | Veröffentlichte Finite-State-Morphologie-Analysatoren: `{name, url, publisher, license, licenceEstablished, archived}`. Die Lizenz reist mit jedem Eintrag mit, anstatt als einheitlich über einen Katalog hinweg angenommen zu werden — Lizenzgrenzen benötigen die tatsächlichen Bedingungen. Für eine polysynthetische Sprache ist ein FST häufig die einzige strukturelle Prüfung, die überhaupt existiert. |
| `resources.corpora` | `object[]` | Parallele Korpora, die diese Sprache belegen: `{corpus, corpusId, pairCount, topPartners, alignmentPairsTotal, …}`. Angegeben durch **Paare**, da ein paralleles Korpus eine Sprache nur durch ein Paar belegt — „deckt Swahili ab“, ohne zu sagen, wogegen, beantwortet eine Frage, die niemand gestellt hat. Existenz und Größe, niemals Qualität. |
| `resources.monolingualCorpora` | `object[]` | Monolinguale Korpora — getrennt von `corpora` gehalten, damit „hat ein Korpus“ niemals zwei unvergleichbare Dinge bedeutet. |
| `resources.speech` | `object[]` | Veröffentlichte Sprachressourcen. Nur Existenz. |
| `resources.keyboards` | `object[]` | Veröffentlichte Tastaturlayouts. Schlicht, aber tragend: Für eine Orthografie, die Zeichen benötigt, die kein Standardlayout erzeugt, ist ein Layout der Unterschied, ob die Sprache tippbar ist oder nicht. |
| `resources.typology` | `object[]` | Typologische Datensätze, die diese Sprache *codieren*, mit Umfang: `{dataset, featuresCoded, datasetFeatureTotal}`. Existenz und Umfang, niemals Inhalt — was ein Merkmal aussagt, bleibt von der Karte fern, bis eine Person die Parameter-Map schreibt, die es akzeptiert (die akzeptierten tauchen in `typologicalProfile` in § 7 auf). Die Merkmalszählungen sind unsere Arithmetik, daher tragen sie eine `champollion-derived`-Herkunft. |
| `lexicalResources` | `object` | Container für lexikalische Existenzfakten. |
| `lexicalResources.datasets` | `object[]` | Veröffentlichte Wortlisten mit ihrer Abdeckung: `{dataset, forms, concepts, release}`. |
| `lexicalResources.dictionaries` | `object[]` | Veröffentlichte Wörterbücher — Existenz, niemals Qualität, und **gerichtet**, wohin der Herausgeber sie richtet: Ein Wörterbuch, das in die eine Richtung geht, ist eine andere Ressource als eines, das in die andere geht. Einträge sind nicht einheitlich in ihrer Form (ein CLDF-Datensatz kennt seine Eintragsanzahl; ein Repository kennt sein Paar und seine Richtung); jeder benennt seine eigene Quelle, und Lizenz sowie Archivierungsstatus reisen pro Eintrag mit. |
| `lexicalResources.colexificationConcepts` / `colexifyingForms` | `number` | Von Champollion berechnete Zählungen über CLICS³: für diese Sprache belegte Konzepte und Formen, die auf zwei oder mehr unterschiedliche Konzepte abgebildet werden. `champollion-derived`. |
| `methodSupport` | `object` | Welche Übersetzungsmethoden diese Sprache abdecken — Fähigkeit, niemals ein Score. Form: `{total, byTier, named, truncated}`. Englisch hat Tausende von Methoden-Kanten (Edges) und die Median-Sprache ein paar Dutzend, daher enthält die Karte die *Form* der Evidenz — `total` plus `byTier`-Zählungen pro Konfidenzstufe (`fetched`, `partially-confirmed`, `model-card-declared`) — und benennt nur die stärksten Einträge (jeweils `{value, variant, source, confidence}`), gedeckelt. Registry-**Dienste (Services)** werden immer vollständig benannt, über der Deckelung, sodass das Fehlen eines Dienstes in `named` eine echte Antwort ist; das Fehlen eines Model-Card-Eintrags bedeutet nur „nicht unter den stärksten“, und jede Kante bleibt im Atlas-Store abfragbar. |
| `metricModelSupport` | envelope | Evaluierungsmetrik-Modelle, die eine Abdeckung dieser Sprache veröffentlichen, mit dem Modell-Identifikator, den ein Harness lädt (`masakhane/africomet-mtl`). Steuert echtes Verhalten — COMET-Modellauswahl — und ist immer noch Fähigkeit, niemals ein Score. |

**In die obigen Felder eingefaltet:** das Pre-Cutover-`keyboardSupport` (→ `resources.keyboards`), `corpusAvailability` (→ `resources.corpora` / `resources.monolingualCorpora`) und `databaseCoverage` (→ `resources.typology` plus `lexicalResources` — ein Datenbankeintrag ist nun ein zitierter Abdeckungsfakt mit Umfang, kein Boolescher Wert).

**Von Karten ausgemustert:** `omt1600`, `evalDatasets`, `pipelineReadiness` und `metricPlugins` — keines davon wird von einer eingelesenen Quelle behauptet, und eine Readiness-Stufe ist ein Urteil, kein Zitat.

**Kuratiert, nicht projiziert:** Die Deklarationsoberflächen für Eval-Standards (`evalStandard`, `evalMetrics`, `evalPack`) verbleiben im kuratierten Schema des npm-Pakets. Sie teilen dem Evaluierungs-Harness mit, welches externe Referee-Paket eine Sprache bewertet (Referees, keine Contestants — der Harness-Core liefert keinen sprachspezifischen Scorer-Code aus); der Harness liest sie von einer Karte ab, wenn sie vorhanden sind, aber derzeit enthält keine Karte im projizierten Korpus sie, und der Atlas-Build schreibt sie nicht. Dasselbe gilt für den `install`-Block, den der FST-Installer des Harness aus `resources.fsts[]`-Einträgen liest (`get_fst_install_info()` in `language_cards.py`): Die projizierten Einträge enthalten nur Existenzfakten.

### § 10. Herkunftsfelder

| Feld | Form | Hinweise |
|-------|-------|-------|
| `_fieldSources` | `object` | Auf jeder Karte. Ordnet jeden Feldpfad auf der Karte (`"classification.family"`, `"coordinates.lat"`) den sortierten Quell-IDs zu, die ihn behauptet haben (`["glottolog-v5.3", "wals-v2020.5"]`). Von Champollion berechnete Werte tragen `champollion-derived-v1`. Quell-IDs sind versioniert — `grambank-v1.0.3`, `iso639-3-20260715` —, sodass sich jede Behauptung auf das genaue Release zurückführen lässt, das sie aufgestellt hat. |
| `coverage` | `object` | Auf jeder Karte und **vom Projektor berechnet, nicht von einer Quelle behauptet**: `{sourceCount, componentsPresent, componentsTotal, notAttested}` — wie viele verschiedene Quellen über diese Sprache sprechen, wie viele Kartenkomponenten einen Wert tragen von wie vielen, die ausgefüllt werden können, und wie viele Werte eine Quelle positiv als *fehlend* aufgezeichnet hat (nachgesehen und nein gesagt — ein anderer Fakt als nie nachgesehen zu haben). Dies ermöglicht es einer dünnen Karte zu sagen, **warum** sie dünn ist, anstatt vernachlässigt auszusehen. |
| `_card` | `object` | Die eigenen Metadaten der Karte: `{type, id, revision, correctableFields}`. `type` ist `"language"` oder `"locale"` (Methoden- und Korpus-Karten nutzen denselben Projektor); `revision` ist ein Content-Hash, sodass jede Änderung am Inhalt der Karte ihn ändert; `correctableFields` listet die Feldpfade auf, die Werte tragen — die Felder, die die Korrektur-Lane berühren darf. |
| `_atlas` | `object` | `{version}` — der Korpus-Release-Stempel (`"unreleased"` zwischen Releases). Absichtlich eine Release-ID, **kein** Build-Zeitstempel: Ein Zeitstempel würde dazu führen, dass sich zwei Builds aus identischen Pins durch den Kalender unterscheiden, was die Eigenschaft zerstört, die es jedem ermöglicht, den Atlas zu überprüfen — gleiche Pins rein, gleiche Bytes raus. |

Der Pre-Cutover-Provenance-Block ist komplett ausgemustert: `dataSources` (ersetzt durch die feldbezogene `_fieldSources`-Map), `supportTier` (ein berechnetes Urteil, ersetzt durch die neutralen `coverage`-Zählungen), `_generated` (das gesamte Korpus wird generiert; der Stempel ist `_card.revision` plus `_atlas.version`), `humanReviewed` und `notes` (Kuration, die zu Lanes mit eigenen Aufzeichnungen gehört) und die Top-Level-`firstDocumented`/`lastDocumented` (verschoben nach `documentation` in § 5.5, wo ihre Quelle sie tatsächlich behauptet).

---

## Sprachcode-Richtlinie

Champollion verwendet **ISO 639-3** als kanonischen Bezeichner. Andere Standardcodes
werden als Aliase registriert und werden zur Laufzeit auf den ISO 639-3-Code aufgelöst.

| Priorität | Standard | Beispiel | Feld | Verwendung |
|----------|----------|---------|-------|-----|
| 1 (kanonisch) | ISO 639-3 | `crk` | `code` | Karten-Dateiname, Config-Schlüssel, API-Parameter |
| 2 (Alias) | ISO 639-1 | `iu` | `codeAliases[]` | In der CLI akzeptiert, aufgelöst zu ISO 639-3 |
| 3 (Alias) | BCP 47 | `fil` | `codeAliases[]` | In der CLI akzeptiert, aufgelöst zu ISO 639-3 |
| Referenz | Glottocode | `plai1258` | `glottocode` | Nur Klassifizierung, nicht für die Laufzeit |

**Auflösungsreihenfolge:** Wenn ein Benutzer einen Code angibt:
1. Direkter Treffer bei `card.code` → gefunden
2. Treffer bei `card.codeAliases[]` → gefunden, die kanonische Karte zurückgeben
3. Treffer bei `card.iso639_1` → gefunden (Fallback)
4. Nicht gefunden → Fehler

### Migrationshistorie: ISO 639-1 → ISO 639-3

Vor v8 verwendeten Kartendateinamen ISO 639-1-Codes, sofern verfügbar (`fr.json`,
`de.json`, `ja.json`). Bei der 639-3-Migration wurden alle Karten in ihre
ISO 639-3-Entsprechungen umbenannt:

| Vorher | Nachher | Grund |
|--------|-------|-----|
| `fr.json` | `fra.json` | 639-3 ist kanonisch |
| `de.json` | `deu.json` | 639-3 ist kanonisch |
| `zh.json` | `cmn.json` | Makrosprache → standardmäßige Einzelsprache |
| `ar.json` | `arb.json` | Makrosprache → Modernes Standardarabisch |
| `ms.json` | `zsm.json` | Makrosprache → Standardmalaiisch |

**Was ist mit den alten Codes passiert?**
- Der alte 639-1-Code befindet sich in `card.iso639_1`
- Der alte 639-1-Code befindet sich in `card.codeAliases[]` (`fra` → `["fr"]`)
- `resolveCode("fr")` gibt zur Laufzeit `"fra"` zurück — abwärtskompatibel
- Benutzer können weiterhin `"fr"` in ihre Config schreiben — es wird transparent aufgelöst

**Was sich architektonisch geändert hat:**
- `_deepMerge()` überspringt nun `null`-Werte (erbt von der übergeordneten Karte)
- `_deepMerge()` hat nun ein gesetztes Identitätsfeld (code, extends, aliases werden niemals vererbt)
- `formality.default` wird nun aus den Register-`isDefault: true`-Flags abgeleitet
- 205 aus Grambank abgeleitete Karten erhielten eine strukturelle `formality.default`-Korrektur
- 38 Genus-/Familien-/Makrosprachkarten stellen Vererbungsziele bereit

---

## Sonderfälle

### Gebärdensprachen
Gebärdensprachen (z. B. ASE — American Sign Language) sind legitime Sprachen mit ISO 639-3-Codes. Sie haben Geografie und Sprecherzahlen, aber:
- `modality` ist `"signed"` — die positive Behauptung der Karte darüber, was die Sprache *ist*; das Fehlen eines Schriftsystems ist ein separater Fakt
- `scripts` fehlt typischerweise (kein Notationssystem hat eine gemeinschaftsweite Akzeptanz), obwohl `"Sgnw"` (SignWriting) dort erscheint, wo eine Quelle es behauptet
- `textDirection` fehlt
- `linguisticChallenges` sollte räumliche Grammatik, Klassifikatoren usw. ansprechen

### Antike & Historische Sprachen
Sprachen wie Latein (`lat`, isoLanguageType `"Historical"`) und Sanskrit (`san`) werden in bestimmten Kontexten (liturgisch, akademisch) immer noch verwendet, haben aber keine Muttersprachler:
- `isoLanguageType` enthält das eigene Statuswort von ISO (`"Ancient"`, `"Historical"`, `"Extinct"`) — die Karte weicht es niemals auf oder überschreibt es
- `endangerment` und `speakerEstimates` berichten, was auch immer die zitierten Quellen tatsächlich bewerten, Vorbehalte wörtlich (L2-Community-Zählungen bleiben so gekennzeichnet, wie ihre Quellen sie kennzeichnen)
- `firstDocumented` / `lastDocumented` verorten sie in der Zeit

### Konstruierte Sprachen
Esperanto (`epo`, isoLanguageType `"Constructed"`), Lojban usw.:
- `classification` kann fehlen — Glottolog legt Conlangs in einer nicht-genealogischen Kategorie (Bucket) ab, und die Kategorie wird niemals als Familie angezeigt
- `contactInfluences` spiegelt das Ausgangsmaterial wider (z. B. greift Esperanto auf romanische, germanische und slawische Sprachen zurück)
- `endangerment` ist ungewöhnlich — wachsende Sprechergemeinschaft, aber keine angestammte Heimat

### Makrosprachen
Arabisch (`ara`), Chinesisch (`zho`), Cree (`cre`), Quechua (`que`) sind Makrosprachen, die mehrere Einzelsprachen umfassen:
- `isoScope: "Macrolanguage"` — ein Navigations-Hub, niemals ein Benchmark-Ziel
- `macrolanguageMembers` listet die einzelnen Mitgliedscodes auf; `canonicalisedMembers` zeichnet auf, welche Mitglieder die BCP 47-Register in das Tag der Makrosprache zusammenfassen (jedes Register mit Quellenangabe)
- `methodSupport` spiegelt wider, was die *Makrosprachen-Karte* unterstützt (normalerweise die standardisierte Varietät)
- Einzelne Mitglieder haben ihre eigenen Karten, die `macrolanguage` zurück zum Hub tragen

### Sprachen ohne standardisierte Orthografie
Viele Sprachen (insbesondere Sprachen mit mündlicher Tradition) haben kein standardisiertes Schriftsystem oder haben konkurrierende Orthografien:
- `scripts`, `scriptNames` und `textDirection` fehlen — keine Quelle hat eine Schrift behauptet, was nicht dieselbe Behauptung ist wie „ungeschrieben“
- `notes` sollte die orthografische Situation erklären
- `linguisticChallenges` sollte anmerken, wie sich dies auf MT (Maschinelle Übersetzung) auswirkt (z. B. keine Trainingsdaten)

### Diglossie
Sprachen wie Arabisch (MSA vs. Dialekte) oder Guaraní (Jopará vs. reines Guaraní):
- `codeSwitching` erfasst die Situation der gemischten Varietäten
- `registers` kann Voreinstellungen für verschiedene Ebenen anbieten
- `varieties` kann das diglossische Paar auflisten

---

## Arten von Kontakteinfluss

| Typ | Bedeutung | Beispiel |
|------|---------|---------|
| `superstrate` | Dominante Sprache, die einer Gemeinschaft auferlegt wird | Französisch → Englisch (nach 1066) |
| `substrate` | Muttersprache, die eine auferlegte Sprache beeinflusst | Keltisch → Englisch |
| `adstrate` | Nachbarsprache mit gegenseitigem Einfluss | Altnordisch → Englisch |
| `learned_borrowing` | Entlehnungen durch Bildung/Gelehrsamkeit | Latein → Englisch |
| `lexical_borrowing` | Direkte Vokabularübernahmen durch Kontakt | Spanisch → Filipino |
| `relexification` | Vollständige Vokabularersetzung | Portugiesisch → Papiamentu |

## Tiefen von Kontakteinfluss

| Tiefe | Bedeutung |
|-------|---------|
| `light` | Einige wenige Lehnwörter, minimale strukturelle Auswirkung |
| `moderate` | Signifikantes Vokabular in bestimmten Domänen |
| `heavy` | Durchdringendes Vokabular und einige strukturelle Merkmale |
| `structural` | Grammatik, Syntax und Phonologie betroffen |
| `defining` | Kernidentität durch Kontakt geprägt (Kreolsprachen, Mischsprachen) |

---

## Gute Register-Voreinstellungen schreiben

**Gute Voreinstellungs-Prompts:**
- Benennen Sie das Formalitätsmerkmal explizit (z. B. „해요체", „vous-Form", „siz-Form")
- Erklären Sie die spezifische zu verwendende Pronomen- oder Verbform
- Geben Sie Kontext dazu, wann dieses Register angemessen ist
- Erwähnen Sie ggf. Schrifterwägungen

**Setzen** Sie geschlechterinklusive Hinweise **nicht** in den Voreinstellungs-Prompt. Geschlechterhinweise
gehören in `card.gender.inclusiveGuidance` — sie werden separat eingefügt.

```
❌ Bad:  "Standard Thai. Professional register."
✔ Good: "Professional Thai. Use คุณ (khun) for second person, เรา (rao)
         for first person when needed. Clear, concise phrasing
         appropriate for digital interfaces."
```

### Namenskonvention für Voreinstellungen

Voreinstellungsschlüssel sollten beschreibend und in Kleinbuchstaben mit Bindestrichen sein:
- T-V-Sprachen: `formal-vous`, `informal-tu`, `formal-Sie`, `casual-du`
- Sprachebenen: `polite-haeyo`, `formal-hapsyo`, `casual-hae`
- Neutral: `professional`, `neutral-professional`
- Code-Switching: `taglish-professional`, `pure-filipino`

---

## Wie Kartenfakten aktualisiert werden

Karten sind **Build-Output** — eine deterministische Projektion aus fixierten (pinned) Upstream-Snapshots. Es gibt kein Anreicherungsverfahren pro Karte mehr: Die manuell ausgeführte `enrich-*`-Skript-Lane ist ausgemustert, und eine direkt an einer Kartendatei vorgenommene Bearbeitung wird durch den nächsten Build gelöscht. Um einen Fakt zu ändern:

1. **Die Entscheidung registrieren.** Jedes Feld ist eine Zeile im Decision-Registry des Builds: welcher Upstream-Parameter es speist, wie es projiziert wird und was ein fehlender Wert bedeutet.
2. **Die Ingest-Schicht reparieren.** Ein falscher Wert ist ein Defekt im Source-Handler (oder ein veralteter Upstream-Pin), niemals etwas, das auf der Karte gepatcht werden darf.
3. **Neu erstellen und umstellen (Rebuild and cut over).** Der Build projiziert jede Karte aus den fixierten Snapshots neu; Gates lehnen unvollständige Builds, Null-/leere Werte und Karten ab, die die Integritätsregeln nicht erfüllen.

### Umgang mit Konflikten

Wenn Quellen nicht übereinstimmen:
1. **Alle speichern** mit Quellenangabe — dafür ist der Attributions-Umschlag (Attribution Envelope) da
2. **KEINEN Durchschnitt bilden** oder Partei ergreifen — `consensus` erscheint nur, wenn die Quellen tatsächlich übereinstimmen
3. **Die Vorbehalte jeder Quelle** wörtlich in der `note` dieses Wertes mitführen
4. Ein einzelner Wert für die Anzeige oder Berechnung wird **vom Adapter** aus der deklarierten Autoritätsreihenfolge **abgeleitet** — die Karte selbst behält die volle Bandbreite

---

## Validierung

Führen Sie den Linter nach jedem Rebuild aus:

```bash
node scripts/lint-language-cards.mjs              # all cards
node scripts/lint-language-cards.mjs --lang crk    # single card
```

### PR-Checkliste

Wenn Sie eine Änderung einreichen, die die Karten berührt (denken Sie daran: Ändern Sie den Build, nicht die Karte):

- [ ] Der Fix befindet sich in einem Ingest-Handler oder im Decision-Registry — keine Kartendatei wird manuell bearbeitet
- [ ] Felder enthalten nur von Quellen behauptete Werte — nichts wird mit `null` oder `[]` aufgefüllt, um eine Karte zu „vervollständigen“
- [ ] `classification` stammt von Glottolog (nicht manuell erstellt)
- [ ] Die Herkunft (Provenance) jedes berührten Feldes landet in `_fieldSources`, wobei von Champollion berechnete Werte eine `champollion-derived`-Herkunft tragen
- [ ] Nirgendwo auf einer Karte erscheint ein gemessener Score einer Methodenausgabe
- [ ] Linter und Kartenintegritäts-Gate bestehen ohne Fehler

---

## Fachliche Referenzen

| Standard | Gepflegt von | Unsere Verwendung |
|----------|---------------|---------|
| [ISO 639-3](https://iso639-3.sil.org) | SIL International | Kanonische Sprachcodes, Makrosprachenbeziehungen |
| [Glottolog](https://glottolog.org) | Max-Planck-Institut | Klassifikation, Koordinaten, AES-Gefährdung |
| [WALS](https://wals.info) | Max-Planck-Institut | Genus-Definitionen, typologische Merkmale |
| [ISO 15924](https://unicode.org/iso15924/) | Unicode/ISO | Schriftcodes |
| [CLDR](https://cldr.unicode.org) | Unicode Consortium | Locale-Daten, Pluralregeln, Typografie |
| [Wikidata](https://www.wikidata.org) | Wikimedia Foundation | Sprecherzahlen, Endonyme, Schriftdaten |
| [Ethnologue](https://www.ethnologue.com) | SIL International | EGIDS, Sprecherschätzungen, DLS |
| [UNESCO Atlas](http://www.unesco.org/languages-atlas/) | UNESCO | Gefährdungsklassifikation |
| [Katig Collective](https://linguistics.upd.edu.ph/the-katig-collective/) | UP Diliman | Kapseln zu philippinischen Sprachen |

Siehe auch: [Zitierverfahren für Sprachkarten](/docs/reference/language-card-citation-procedure)
für detaillierte quellenspezifische Anleitung.
