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

> **Zentrale Informationsquelle (Single Source of Truth).** Dieses Dokument
> definiert die kanonische Struktur jeder Sprachkarte. Eine Karte behauptet nur
> das, was eine zitierte Quelle belegt: Ein Feld, das keine Quelle bestätigt,
> wird **weggelassen, nicht auf null gesetzt** – ein fehlendes Feld bedeutet
> „keine Quelle hat Angaben gemacht“, niemals „es gibt nichts zu wissen“. Das
> maschinenprüfbare Schema wird als `shared/schemas/language-card.schema.json` im
> npm-Paket ausgeliefert, und das [kanonische Beispiel unten](#canonical-template)
> wird bei jedem Website-Build aus dem Live-Korpus generiert, sodass diese Seite
> nicht von den Karten abweichen kann, die sie beschreibt.

## Der Atlas-Rebuild von 2026-08 – was sich in diesem Schema geändert hat

Der Kartenkorpus ist nun **Build-Ausgabe**: Jede Karte wird aus einem Bestand
festgepinnter Upstream-Snapshots projiziert und neu erstellt – niemals direkt
bearbeitet –, wenn sich eine Tatsache ändert. Vier Dinge an der Struktur haben
sich mit diesem Rebuild geändert:

1. **Umstrittene Felder enthalten einen Attributions-Envelope.** Wo zitierte Quellen
   tatsächlich uneins sind, ist das Feld kein flacher Wert, sondern
   `{"agreement": "...", "consensus": <value?>, "values": [{"value": ...,
   "source": "..."}]}`. This applies to `name`, `classification.family`,
   `speakerEstimates`, `endangerment` und jedes Feld, das durch eine neue Quelle
   umstritten wird. Consumer sollten Karten über den veröffentlichten Adapter
   (`normalizeCard()` im npm-Paket) lesen, anstatt flache Werte vorauszusetzen –
   `display()` löst einen Envelope zu seinem vereinbarten Wert auf und gibt
   bei einem echten Disput bewusst nichts zurück, anstatt einen Gewinner zu küren.

2. **Umbenannte Felder.** `endonym` ersetzt `nativeName` · `codeAliases`
   ersetzt `aliases` · `scripts[]` (alle belegten Schriften) ersetzt das flache
   `script`, wobei die primäre Schrift aus dem maximalen BCP-47-Tag der
   Karte abgeleitet wird · `endangerment` (die Bewertung jeder Quelle auf der
   quelleneigenen Skala) ersetzt das einzelne `vitality`-Objekt · `isoLanguageType` und
   `isoScope` enthalten nun die eigenen Bezeichnungen von ISO 639-3 („Living“, „Macrolanguage“)
   statt Initialen. Neue Felder: `modality` („spoken“/„signed“, abgeleitet
   aus der Glottolog-Abstammung), `glottologBucket` (Glottologs nicht-genealogische
   Buckets, die außerhalb des Familienfelds gehalten werden), `locale`/`localeScoped`.

3. **Nicht belegte Felder werden weggelassen, nicht auf null gesetzt.** Ein Feld,
   das von keiner Quelle belegt wird, fehlt auf der Karte. Die frühere Regel
   („jede Karte MUSS jedes Feld auf oberster Ebene enthalten, selbst wenn es null ist“)
   wurde aufgegeben: Ein leerer Wert auf einer öffentlichen Schnittstelle liest
   sich wie die Behauptung, es gäbe nichts zu wissen – was nicht dasselbe ist wie
   nicht nachgesehen zu haben.

4. **Locale-Karten existieren.** Neben den Sprachkarten enthalten Locale-Projektionen
   (`fra-CA`, `cmn-Hant`) die Fakten ihrer Sprache aufgelöst für ein
   Gebiet oder eine Schrift, identifiziert durch einen `locale: {language, region, script}`-Block.
   Ein Locale ist keine Sprache: Schließen Sie Locales anhand dieses Blocks
   von Sprachzählungen aus.

## Designprinzipien

1. **Alles belegen.** Jede Tatsachenbehauptung geht auf eine benannte, versionierte
   Primärquelle zurück. Unbelegte Angaben sind nicht verifizierbare Angaben. Die
   `_fieldSources`-Map (und feldspezifische `source`-Annotationen in Unterobjekten)
   machen die Provenienz explizit.

2. **Widersprüche bewahren.** Wenn Autoritäten uneins sind (eine Quelle spricht
   von 50.000 Sprechern, eine andere von 20.000), speichert die Karte *beide* mit
   Quellenangabe – in der oben beschriebenen Envelope-Struktur. Wir bilden keine
   Mittelwerte, lösen nichts auf und ergreifen keine Partei. Benutzer können sich
   durch die Nuancen bewegen.

3. **Fehlend bedeutet unbelegt.** Ein fehlendes Feld bedeutet, dass keine Quelle
   einen Wert belegt. Wenn eine Eigenschaft tatsächlich nicht zutrifft (z. B.
   grammatikalisches Geschlecht bei einer Sprache, die keines besitzt), gibt der
   zitierte Wert dies explizit an, anstatt leer zu sein.

4. **Neu gebaut, niemals gepatcht.** Karten werden durch einen deterministischen
   Build aus festgepinnten Quellen projiziert. Ein Fehler in den Fakten wird im
   entsprechenden Source-Handler behoben und der Korpus neu erstellt – keine
   In-Place-Bearbeitungen, keine reine Merge-Anreicherungsschicht.

---

## Drei-Schichten-Architektur

| Schicht | Speicherort | Zweck |
|-------|----------|---------|
| **Sprachkarten** | `shared/language-cards/<code>.json` | Sprachspezifische Konfiguration: Identität, Klassifikation, Ressourcen, alles |
| **Genus-Karten** | `shared/language-cards/genera/<genus>.json` | Gemeinsame Laufzeiteigenschaften für verwandte Sprachen (kuratiert, nicht automatisch generiert) |
| **Sprachbaum** | `shared/language-cards/language-tree.json` | Vollständige Glottolog-Hierarchie — Referenzdaten für die Lab-Benutzeroberfläche und Sprachentdeckung |

---

## Vererbungsmodell

> **Seit dem Atlas-Rebuild weitgehend historisch.** Keine Sprachkarte auf der
> Festplatte enthält mehr `extends` – jede Karte wird durch den Build vollständig
> materialisiert, da geerbter Fließtext nicht zitierfähig war (eine Behauptung
> auf Familienebene trug eine Adresse auf Sprachebene). Der Mechanismus selbst
> überlebt an einer Stelle: Das Offline-Bundle des npm-Pakets liefert
> Locale-Karten als kompakte `extends`-Deltas gegenüber ihrer Sprache aus,
> die durch denselben hier beschriebenen Merge aufgelöst werden.

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

> **Generiert, nicht manuell verfasst.** Alles in diesem Abschnitt wird zur
> Build-Zeit aus dem Live-Korpus abgeleitet: die vollständige `crk`-Karte
> (Plains Cree), Byte für Byte, plus ein `fra-CA`-Locale-Auszug. Wenn der Korpus
> neu gebaut wird, leitet der nächste Website-Build diese Seite neu ab. Es gibt
> keine manuell gepflegte Vorlage mehr, die veralten könnte – die vorherige
> geriet eine ganze Schema-Generation hinter die Karten und wurde am 16.08.2026 ausgemustert.

Das Beispiel zeigt die **Struktur auf der Festplatte** – was Sie erhalten, wenn
Sie die Datei öffnen. Consumer sollten Karten dennoch über den veröffentlichten
Adapter (`normalizeCard()` im npm-Paket) einlesen: Er löst Envelopes auf, überbrückt
die Namen von vor der Umstellung und leitet die reinen Anzeigewerte (primäre
Schrift, Vitalitätsstufe) ab, welche die Rohkarte bewusst nicht enthält.

Worauf beim Lesen zu achten ist:

1. **Attributions-Envelopes.** `name`, `classification.family`,
   `endangerment`, `speakerEstimates`, `endonym`, `bcp47FullTag` und
   `politenessDistinction` enthalten jeweils `{agreement, consensus?, values:
   [{value, source}]}`, every value attributed to its source. `endangerment`
   hat `"agreement": "incommensurable"`: Seine Quellen bewerten auf
   unterschiedlichen Skalen, sodass jeder Wert seine `scale` nennt,
   anstatt auf die Skala eines Siegers konvertiert zu werden.

2. **Weggelassen bedeutet unbelegt.** Die Karte hat kein `iso639_1` (Plains Cree
   besitzt keinen ISO-639-1-Code) und kein `phonologicalInventory` (keine eingelesene Quelle
   belegt eines) – diese Felder fehlen einfach, sie sind niemals `null` oder `[]`.

3. **Provenienz ist eine erstklassige Schicht.** `_fieldSources` ordnet jedes Feld
   der Quelle bzw. den Quellen zu, die es belegt haben, wobei `champollion-derived-v1` von
   Champollion berechnete Werte kennzeichnet. `_card` stempelt Typ, ID und Revision
   der Karte sowie die Felder, die der Korrekturpfad ändern darf; `_atlas` stempelt
   das Korpus-Release.

4. **Keine Durchlaufergebnisse (Run Results).** Nichts auf der Karte ist ein gemessener
   Score einer Methodenausgabe – chrF, FST-Akzeptanzraten und ähnliche Werte sind
   Ausführungsergebnisse, die durch (Methode, Datensatz, Metrik) indexiert sind und
   auf der Bestenliste geführt werden. Die Karte bestätigt lediglich, dass Ressourcen
   *existieren* (`resources`, `lexicalResources`,
   `methodSupport`).

<CardSpecExample variant="language" />

### Eine Locale-Karte ist eine Projektion, keine Sprache \{#locale-card-example}

Neben den Sprachkarten stehen Locale-Karten (`fra-CA`, `cmn-Hant`): die
Fakten einer Sprache, **aufgelöst für ein Gebiet oder eine Schrift**, identifiziert durch
ihren `locale`-Block – niemals durch die Form des Codes. Eine Locale-Karte erbt die
Fakten ihrer Sprache, löst die schrift- und gebietsspezifischen Fakten auf (`script`,
`localeScoped`) und ist **keine Sprache**: Schließen Sie Locale-Karten anhand dieses
`locale`-Blocks von jeder Sprachzählung und einzelsprachlichen Auflistung aus.

<CardSpecExample variant="locale" />

---

## Feldreferenz \{#field-reference}

Für jede der folgenden Tabellen gelten zwei Konventionen:

- **„envelope“** bezeichnet einen Attributions-Envelope – `{agreement, consensus?,
  values: [{value, source, note?, scale?}]}` –, der die Angaben *jeder* Quelle
  enthält. Ein als `envelope` aufgeführtes Feld kann auf Karten, zu denen sich
  nur eine Quelle äußert, als flacher Wert erscheinen (so tragen beispielsweise reine
  Glottolog-Languoide ein flaches `name`); Consumer müssen beides verarbeiten
  können, was der veröffentlichte Adapter übernimmt.
- Außer `code` und `name` ist kein Feld erforderlich; alles andere wird
  **weggelassen, wenn keine Quelle es belegt**. Die das jeweilige Feld belegende(n)
  Quelle(n) werden pro Karte in `_fieldSources` festgehalten, sodass die Tabellen
  die *Art* der Quelle beschreiben, anstatt Versionen festzuschreiben, die veralten würden.

### § 1. Identitätsfelder

| Feld | Struktur | Anmerkungen |
|-------|-------|-------|
| `code` | `string` | **Erforderlich.** Die Karten-ID und der Dateiname. ISO 639-3 für Sprachkarten (`crk`); reine Glottolog-Languoide tragen ihren Glottocode; Locale-Karten tragen einen Locale-Code (`fra-CA`). |
| `name` | envelope | **Erforderlich.** Englischer Referenzname (ISO 639-3-Register, LinguaMeta, Glottolog). |
| `endonym` | envelope | Ersetzt `nativeName`. Wie Sprecher die Sprache in der Sprache selbst nennen (LinguaMeta, Wikidata). Fehlt, wenn keine Quelle eines belegt – ein Endonym wird von uns niemals erfunden oder transliteriert. |
| `alternateNames` | `string[]` | Weitere belegte englische Namen. |
| `iso639_1` | `string` | Nur vorhanden, wenn ein zweistelliger ISO-639-1-Code existiert (`fra` → `"fr"`). |
| `isoScope` | `string` | Eigene Bezeichnungen von ISO 639-3 – `"Individual"`, `"Macrolanguage"`, `"Special"` (ersetzte die Initialen `"I"`/`"M"`/`"S"`). |
| `isoLanguageType` | `string` | Ersetzt `isoType`. Eigene Bezeichnungen von ISO 639-3 – `"Living"`, `"Extinct"`, `"Ancient"`, `"Historical"`, `"Constructed"`. |
| `macrolanguage` | `string` | Die Makrosprache, zu der diese Sprache gehört (`crk` → `"cre"`). ISO 639-3-Makrosprach-Zuordnungen. |
| `macrolanguageMembers` | `string[]` | Auf Makrosprachen-Hub-Karten: die Codes der einzelnen Einzelsprachen (`nor` → `["nno", "nob"]`). |
| `canonicalisedMembers` | envelope | Auf Makrosprachen-Karten: Einzelsprachen, deren Tags von den BCP-47-Registern in das Tag dieser Makrosprache zusammengeführt werden (CLDR-Alias-Tabelle + SIL-Langtags, jeweils mit Quellenangabe). |
| `supersededCodes` | `string[]` | Zurückgezogene ISO-639-3-Codes, die SIL nun auf diese Sprache verweist – auf dem Nachfolger erfasst, damit unter einem alten Code veröffentlichte Korpora weiterhin aufgelöst werden. |
| `codeAliases` | `string[]` | Ersetzt `aliases`. Bezeichner auf Code-Ebene, die zu dieser Karte aufgelöst werden. |
| `bcp47` | `string` | Der BCP-47-Tag der Sprache wie belegt (LinguaMeta). |
| `bcp47Tag` | envelope | Von Champollion abgeleitet: der RFC-5646-Tag (kürzester ISO-639-Code gewinnt). |
| `bcp47FullTag` | envelope | Die maximale Sprache–Schrift–Region-Form (CLDR likelySubtags + SIL-Langtags). Der Adapter leitet die **primäre Schrift** aus diesem Tag ab. |
| `modality` | `string` | `"spoken"` oder `"signed"`, abgeleitet aus der Glottolog-Abstammung. Schrift ist ein Orthografie-Attribut, keine Modalität – eine schriftlose Sprache ist dennoch vollständig gesprochen oder gebärdet. |
| `locale` | `object` | **Nur Locale-Karten.** `{language, region, script, publishedTag, source, note}` – DIE Locale-Identität. Schließen Sie Locale-Karten anhand dieses Blocks von Sprachzählungen aus, niemals anhand der Codeform. |
| `localeScoped` | `object` | Nur Locale-Karten: Werte, die für das Gebiet/die Schrift des Locales aufgelöst wurden (z. B. `scriptName`, `cldrOfficialStatus`). |

### § 2. Klassifikationsfelder

| Feld | Struktur | Anmerkungen |
|-------|-------|-------|
| `glottocode` | `string` | Glottolog-Bezeichner für dieses Languoid (`crk` → `"plai1258"`). Reine Glottolog-Languoide – Sprachen, die Glottolog verzeichnet, ISO 639-3 jedoch nicht – verwenden den Glottocode als Karten-`code`. |
| `classification` | `object` | Container für die unten stehenden Klassifikationsfelder. Jedes wird unabhängig bezogen und unabhängig weggelassen – ein Isolat oder eine in einem Glottolog-Bucket geführte Sprache enthält berechtigterweise nur einen Teil dieses Objekts. |
| `classification.family` | envelope | Die Familie auf oberster Ebene, die von der jeweiligen Klassifikationsautorität angegeben wird. Glottolog und WALS sind getrennte Taxonomien, die nicht immer übereinstimmen, daher werden beide beibehalten und mit Quellenangabe versehen. Lint-Regel R5 prüft den Glottolog-Wert innerhalb des Envelopes gegen Glottologs eigenen Baum: WALS darf von Glottolog abweichen, aber Glottolog darf nicht falsch zitiert werden. Isolate tragen überhaupt keine Familie. |
| `classification.familyGlottocode` | `string` | Glottocode dieser Familie auf oberster Ebene (`crk` → `"algi1248"`). |
| `classification.genus` | `string` | WALS-Zwischenklassifikationsknoten (`crk` → `"Algonquian"`). Ein WALS-Konzept, **kein** Glottolog-Konzept – Glottolog veröffentlicht einen Baum beliebiger Tiefe ohne Genus-Ebene –, daher nur vorhanden, wo WALS die Sprache codiert. |
| `classification.ancestry` | `string[]` | Glottolog-Abstammungspfad als Glottocodes der Vorfahren, Wurzel zuerst (`["algi1248", …, "plai1264"]`). Die Reihenfolge **ist** die Aussage: Dies ist ein Pfad, niemals eine alphabetisierte Menge. |
| `classification.glottologBucket` | `string` | Glottologs nicht-genealogische Buckets – `"Artificial Language"`, `"Pidgin"`, `"Mixed Language"`, `"Speech Register"`, `"Unclassifiable"`, `"Unattested"`. Werden außerhalb des Familienfelds gehalten, da ein Bucket nach Art und nicht nach Abstammung klassifiziert: Eine Karte mit einem Bucket hat keine Familie, und das ist das ehrliche Ergebnis. |
| `isIsolate` | `boolean` | Gibt an, ob Glottolog diese Sprache als Isolat klassifiziert. |

Die Karte von vor der Umstellung enthielt außerdem ein `genusGlottocode`. Es
wurde zusammen mit dem Kategorienfehler ausgemustert, der es hervorgebracht
hatte: Das Genus ist ein Konzept von WALS, und es mit einem Glottolog-Bezeichner
zu versehen, behauptete einen Baumknoten, den Glottolog gar nicht hat. Die
Glottolog-Hierarchie wird stattdessen von `ancestry` getragen.

### § 3. Geografiefelder

| Feld | Struktur | Anmerkungen |
|-------|-------|-------|
| `macroarea` | `string` | Glottologs Makroareal – `"Africa"`, `"Australia"`, `"Eurasia"`, `"North America"`, `"Papunesia"` oder `"South America"`. |
| `coordinates` | `object` | `{lat, lng}` – Glottologs repräsentativer Punkt. Ein Punkt, kein Gebiet: Er platziert die Sprache auf einer Karte und trifft keine Aussage über Verbreitungsgebiet oder Grenzen. |
| `countries` | `string[]` | ISO 3166-1 alpha-2-Codes der Länder, die Glottolog der Sprache zuordnet (`["CA", "US"]`). |
| `cldrOfficialStatus` | `string` | Ein offizieller Status, den ein Gebiet der Sprache zuerkennt, wie von CLDR erfasst (übertragen via LinguaMeta) – `"Official"`, `"Regional official"`. Auf einer Locale-Karte befindet sich der für das Gebiet *dieses Locales* aufgelöste Status in `localeScoped.cldrOfficialStatus`. |

Das Array `regions` von vor der Umstellung (Sprecheraufschlüsselung nach
Ländern mit Admin-Codes) und `arealContext` (Sprachbund-Zugehörigkeit) wurden
ausgemustert: Keine eingelesene Quelle belegt sie, und unbelegte Kuration
überlebt keinen Rebuild. Sprecherzahlen auf Regionalebene können an dem Tag
zurückkehren, an dem eine zitierfähige Quelle in der Pipeline landet; bis
dahin ist das Fehlen der ehrliche Zustand.

### § 4. Schriftsystemfelder

| Feld | Struktur | Anmerkungen |
|-------|-------|-------|
| `scripts` | `string[]` | Ersetzt das flache `script`. **Alle** belegten ISO-15924-Codes (`crk` → `["Cans", "Latn"]`), ungeordnet – lesen Sie `scripts[0]` niemals als „die“ Schrift. Die primäre Schrift wird vom Adapter aus dem maximalen Tag von `bcp47FullTag` abgeleitet. |
| `scriptNames` | `string[]` | Von Champollion abgeleitete Anzeigenamen für `scripts[]` (`"Unified Canadian Aboriginal Syllabics"`). |
| `textDirection` | `string` | Ersetzt `dir`. Eigene Bezeichnungen der Quelle – `"left-to-right"` / `"right-to-left"` (zuvor `"ltr"`/`"rtl"`). |
| `suppressScript` | `string` | CLDR Suppress-Script: Die Schrift, die für die Sprache so kanonisch ist, dass BCP-47-Tags sie auslassen (`fra` → `"Latn"`). |
| `script` | `string` | **Nur Locale-Karten**: die für das Locale aufgelöste Schrift (`fra-CA` → `"Latn"`, `cmn-Hant` → `"Hant"`). Sprachkarten enthalten kein flaches Schriftfeld. |

Eine Sprache ohne belegte Schrift hat schlicht **kein `scripts`-Feld** –
das Fehlen bedeutet, dass keine Quelle eine Schrift belegt hat, nicht die
Behauptung, die Sprache sei „schriftlos“. (Gebärdensprachen sind die größte
derartige Gruppe: Kein Notationssystem hat eine gemeinschaftsweite
Standardakzeptanz für die alltägliche Schriftkompetenz erreicht.)

### § 5. Demografische & Vitalitätsfelder

| Feld | Struktur | Anmerkungen |
|-------|-------|-------|
| `speakerEstimates` | envelope | Die Schätzung jeder Quelle, mit Quellenangabe. Werte können genaue Zählungen oder quelleneigene Bereichszeichenfolgen sein (`"10000-99999"`), wobei Vorbehalte der Quelle wortgetreu in `note` übernommen werden. `"agreement": "conflicting"` ist häufig – den Konflikt darzustellen, *ist* das Produkt; nichts wird gemittelt oder ausgewählt. |
| `endangerment` | envelope | Ersetzt das einzelne `vitality`-Objekt. Die Bewertung jeder Quelle **auf der quelleneigenen Skala** – jeder Wert enthält ein `scale`-Feld, und `"agreement": "incommensurable"` ist die Norm, da die Vokabulare von ELCat, Glottolog AES und LinguaMeta keine Übersetzungen voneinander sind. Der Adapter leitet gemäß der deklarierten Autoritätsreihenfolge eine Anzeige-*Vitalitätsstufe* aus einer einzelnen benannten Quelle ab; diese Stufe dient nur der Anzeige – der vollständige belegte Satz verbleibt auf der Karte. |

Eine an beliebiger Stelle in Champollion *angezeigte* Sprecherzahl muss mit einem
der zitierten `speakerEstimates`-Einträge übereinstimmen oder eine explizite
`champollion-derived`-Provenienz aufweisen – dies wird durch die
Karten-Integritätsregeln erzwungen.

### § 5.5 Dokumentations- & digitale Präsenzfelder

| Feld | Struktur | Anmerkungen |
|-------|-------|-------|
| `documentation` | `object` | Ersetzt `documentationDepth`. Glottologs Aufzeichnung darüber, wie gut die Sprache beschrieben ist, in Glottologs eigenen Begriffen. |
| `documentation.medLevel` | `string` | Glottologs Stufe der umfangreichsten Beschreibung (Most Extensive Description), wortgetreu – `"long grammar"`, `"grammar"`, `"grammar sketch"`, `"phonology"`, `"wordlist"`. |
| `documentation.medSourceId` | `string` | Der bibliografische Schlüssel dieser umfangreichsten Beschreibung in Glottologs Referenzkatalog. |
| `documentation.firstDocumented` | `number` | Glottologs eigene Spalte für das erste Dokumentationsjahr, wortgetreu – hierher verschoben aus dem Feld auf oberster Ebene von vor der Umstellung. Nur bei wenigen hundert Sprachen vorhanden, und die Lückenhaftigkeit ist an sich bereits wissenswert. |
| `documentation.lastDocumented` | `number` | Glottologs Spalte für das letzte Dokumentationsjahr, wortgetreu – bei etwa tausend Sprachen vorhanden. |
| `wikipediaEdition` | `object` | Ersetzt `digitalPresence`. `{site, url, name}` – eine offene Wikipedia-Ausgabe existiert in dieser Sprache (`afr` → `af.wikipedia.org`). Nur Existenz, bewusst **ohne Artikelzahlen**: Mehrere Ausgaben sind größtenteils bot-generiert, und eine riesige Ausgabe ist in keinem für Übersetzer nützlichen Sinne „besser dokumentiert“ als eine kleine. |
| `dialectCount` | `number` | Glottologs eigene Spalte `child_dialect_count`, wortgetreu – nur direkte Unterdialekte, nicht der gesamte Teilbaum. Dies ist Glottologs Angabe, nicht unsere Arithmetik: Eine frühere Regel stempelte sie als `champollion-derived` und ließ tausende von Karten die Urheberschaft für Glottologs Zählung beanspruchen. |

Der Rest des `digitalPresence`-Blocks von vor der Umstellung (Common-Voice-Stunden,
Tatoeba-Satzzahlen) wird ausgemustert, bis diese Quellen in der Pipeline landen –
das Tatoeba-Korpus selbst erscheint bereits dort, wo es hingehört: als paralleles
Korpus unter `resources.corpora` (§ 9).

### § 6. Formalitäts-, Register- & Geschlechterfelder

Das projizierte Korpus enthält hier genau ein Feld – die zitierte Tatsache:

| Feld | Struktur | Anmerkungen |
|-------|-------|-------|
| `politenessDistinction` | envelope | Gibt an, ob die Sprache Höflichkeit in Formen der zweiten Person grammatikalisiert. Belegt über Grambank GB415 (binär: abwesend/vorhanden) und WALS 45A (vier Stufen: keine Unterscheidung / binär / mehrere / Pronomen vermieden). Dies sind unterschiedliche Skalen, sodass jeder Wert seine `scale` nennt und der Envelope sie als **inkommensurabel** statt als Widerspruch ausweist. |

**Das Registersystem ist Konfiguration, keine Karten-Tatsache.** Das Korpus von
vor der Umstellung speicherte `formality`-Fließtext und `registers`-Prompts
auf jeweils fast 1.800 Karten – fast alles davon generiert aus denselben beiden
obigen Quellen und dann so mitgeführt, als handele es sich um manuell kuratierte
Konfiguration. Der Atlas behält die Tatsache bei; die Konfigurationsoberflächen –
`formality`, `registers`, `gender`, `codeSwitching` – bleiben Teil
des **kuratierten Schemas des npm-Pakets** (`language-card.schema.json`), befinden sich auf
den kuratierten Genus-/Familien-Hub-Karten und erreichen die CLI über den
`extends`-Merge des Registersystems, wie im
[Vererbungsmodell](#inheritance-model) beschrieben. Es handelt sich nicht um
projizierte Atlasfelder: Keine Karte im projizierten Korpus enthält sie, und der
Atlas-Build wird sie niemals schreiben. Die Anleitung unter
[Gute Register-Presets verfassen](#writing-good-register-presets) gilt für
diesen kuratierten Pfad.

### § 7. Linguistische Profilfelder

| Feld | Struktur | Anmerkungen |
|-------|-------|-------|
| `typologicalProfile` | `object` | Ein Schlüssel pro eingelesenem typologischem Merkmal, jeder Wert die quelleneigene Codierung, jeder Schlüssel nur vorhanden, wo die Quelle diese Sprache codiert. Booleans stammen aus Grambank-Merkmalen, Kategoriestrings aus WALS-Kapiteln; die Entscheidungs-Registry nennt den exakten Upstream-Parameter für jeden Schlüssel. |
| `phonologicalInventory` | `object` | `{consonants, vowels, tones, totalPhonemes, hasTone}` – von Champollion berechnete Zählungen über ein zitiertes PHOIBLE-Inventar (PHOIBLE veröffentlicht eine Zeile pro Segment und nennt keine Zählungen), sodass jeder Wert eine `champollion-derived`-Provenienz trägt. **PHOIBLE ist die einzige Ton-Autorität** (Lint-Regel R1): Grambank hat kein Tonmerkmal, und nichts anderes auf der Karte darf Tonalität beanspruchen. |
| `numeralSystem` | `object` | `{base}` – die Zahlenbasis, wortgetreu aus Chans *Numeral Systems of the World's Languages* (`"decimal"`, `"quinary-vigesimal"`, `"body tally"`; fast hundert verschiedene Werte). Fehlt, wenn Chans eigene Basisspalte leer ist – bei etwa der Hälfte der untersuchten Sprachen –, weil ein früherer Generator die Lücke mit `"decimal"` füllte und Werte für zweitausend Sprachen erfand. |
| `pluralCategories` | `string[]` | Die Kardinal-Pluralkategorien, die CLDR für diese Sprache angibt – Arabisch unterscheidet `["zero", "one", "two", "few", "many", "other"]`, Französisch drei davon, Chinesisch eine. Gelesen aus den Schlüsseln des Regelsatzes von CLDR selbst, es ist also die Angabe von CLDR, nicht unsere Ableitung. Ersetzt das `rules.plurals.categories` von vor der Umstellung; eine i18n-Pipeline benötigt dies, um zu wissen, wie viele Pluralformen eine Nachricht bereitstellen muss. |

Die derzeit projizierten `typologicalProfile`-Schlüssel mit ihren Upstream-Parametern:

- **WALS-Kapitel** (Kategoriestrings, eigene Wertbezeichnungen von WALS): `fusion`
  (20A), `verbSynthesis` (22A), `affixPreference` (26A), `reduplication`
  (27A), `genderCount` (30A), `caseCount` (49A), `wordOrder` (81A),
  `subjectVerbOrder` (82A), `verbalAlignment` (100A), `negationOrder` (143A)
- **Grambank-Merkmale** (Booleans): `hasGenderInPronouns` (GB030),
  `hasSexBasedGender` (GB051), `hasNumeralClassifiers` (GB057), `hasCoreCase`
  (GB070), `hasObliqueCase` (GB072), `marksPastTense` (GB083),
  `marksPresentTense` (GB082)

Die Blöcke `linguisticChallenges` und `contactInfluences` von vor der Umstellung werden
nicht projiziert – recherchierter Fließtext ohne eingelesene Quelle verbleibt
im kuratierten Schema des npm-Pakets, genau wie die Registeroberflächen in § 6 (die
Tabellen unter [Arten von Kontakteinflüssen](#contact-influence-types) unten
dienen diesem Pfad). Der Block `rules` wurde ausgemustert: Was darin
zitierfähig war, überlebt als `pluralCategories` hier und in den Schriftfeldern in § 4.

### § 8. Enzyklopädische Felder

Aus Karten ausgemustert. Die Blöcke `encyclopedic` (Essays zu Geschichte und
Dialekten, institutionelle Links), `culturalAphorism` und `varieties` von vor
der Umstellung waren handkuratierter Fließtext auf Kartenebene, den der Rebuild
per Design löscht. Die Zugehörigkeitsfakten, die `varieties` andeutete,
sind nun zitierte Identitätsfelder (§ 1 `macrolanguageMembers` und `canonicalisedMembers`),
und die Werkzeugabdeckung pro Varietät wird durch die eigene Karte jedes Mitglieds
beantwortet (`methodSupport`, `resources`). Ein repräsentatives Sprichwort
kann über einen Community-Beitragspfad mit Einwilligung und Zitierung zurückkehren;
als unzitiertes Kartenfeld wird es nicht zurückkehren.

### § 9. Digitale Ressourcenfelder

Alles in diesem Abschnitt bestätigt **Existenz und Fähigkeit, niemals
Qualität**: dass eine Ressource veröffentlicht ist und wer sie veröffentlicht –
niemals, dass sie gut, vollständig oder brauchbar ist, und niemals einen
gemessenen Score. Jeder gemessene Score einer Methodenausgabe ist ein
Durchlaufergebnis, das durch (Methode, Datensatz, Metrik) indexiert ist, auf
der Bestenliste geführt wird und auf Karten verboten ist (Lint-Regel R3).

| Feld | Struktur | Anmerkungen |
|-------|-------|-------|
| `resources` | `object` | Container: Jedes nachfolgende Unterfeld ist eine unabhängig bezogene Liste, die weggelassen wird, wenn keine Quelle sie belegt. |
| `resources.fsts` | `object[]` | Veröffentlichte morphologische Finite-State-Analysatoren: `{name, url, publisher, license, licenceEstablished, archived}`. Die Lizenz wird mit jedem Eintrag mitgeführt, anstatt als einheitlich über einen Katalog hinweg angenommen zu werden – Lizenzgrenzen erfordern die tatsächlichen Bedingungen. Für eine polysynthetische Sprache ist ein FST häufig die einzige strukturelle Prüfung, die überhaupt existiert. |
| `resources.corpora` | `object[]` | Parallele Korpora, die diese Sprache belegen: `{corpus, corpusId, pairCount, topPartners, alignmentPairsTotal, …}`. Angegeben über **Paare**, da ein paralleles Korpus eine Sprache nur über ein Paar belegt – „deckt Swahili ab“, ohne anzugeben gegenüber was, beantwortet eine Frage, die niemand gestellt hat. Existenz und Umfang, niemals Qualität. |
| `resources.monolingualCorpora` | `object[]` | Einsprachige Korpora – getrennt gehalten von `corpora`, damit „hat ein Korpus“ niemals zwei nicht vergleichbare Dinge bedeutet. |
| `resources.speech` | `object[]` | Veröffentlichte Sprachressourcen (Audio/Speech). Nur Existenz. |
| `resources.keyboards` | `object[]` | Veröffentlichte Tastaturlayouts. Unscheinbar, aber essenziell: Für eine Orthografie, die Zeichen benötigt, die kein Standardlayout erzeugt, entscheidet ein Layout darüber, ob die Sprache tippbar ist oder nicht. |
| `resources.typology` | `object[]` | Typologische Datensätze, die diese Sprache *codieren*, mit Umfang: `{dataset, featuresCoded, datasetFeatureTotal}`. Existenz und Umfang, niemals Inhalt – was ein Merkmal besagt, bleibt von der Karte fern, bis jemand das Parameter-Mapping schreibt, das es akzeptiert (die akzeptierten werden in `typologicalProfile` von § 7 aufgeführt). Die Merkmalszählungen sind unsere Arithmetik, daher tragen sie eine `champollion-derived`-Provenienz. |
| `lexicalResources` | `object` | Container für lexikalische Existenzfakten. |
| `lexicalResources.datasets` | `object[]` | Veröffentlichte Wortlisten mit ihrer Abdeckung: `{dataset, forms, concepts, release}`. |
| `lexicalResources.dictionaries` | `object[]` | Veröffentlichte Wörterbücher – Existenz, niemals Qualität, und **gerichtet**, wo der Herausgeber sie ausrichtet: Ein Wörterbuch, das in eine Richtung geht, ist eine andere Ressource als eines in die Gegenrichtung. Einträge sind nicht einheitlich strukturiert (ein CLDF-Datensatz kennt seine Eintragszahl; ein Repository kennt sein Paar und seine Richtung); jeder nennt seine eigene Quelle, und Lizenz sowie Archivierungsstatus werden pro Eintrag mitgeführt. |
| `lexicalResources.colexificationConcepts` / `colexifyingForms` | `number` | Von Champollion berechnete Zählungen über CLICS³: für diese Sprache belegte Konzepte und Formen, die zwei oder mehr verschiedenen Konzepten zugeordnet sind. `champollion-derived`. |
| `methodSupport` | `object` | Welche Übersetzungsmethoden diese Sprache abdecken – Fähigkeit, niemals ein Score. Struktur: `{total, byTier, named, truncated}`. Englisch weist tausende Methodenkanten auf und die durchschnittliche Sprache ein paar Dutzend; die Karte enthält daher die *Struktur* der Evidenz – `total` plus `byTier` Zählungen pro Konfidenzstufe (`fetched`, `partially-confirmed`, `model-card-declared`) – und nennt nur die stärksten Einträge (jeweils `{value, variant, source, confidence}`), gedeckelt. Registry-**Dienste** werden oberhalb des Limits stets vollständig genannt, sodass das Fehlen eines Dienstes in `named` eine verlässliche Aussage darstellt; das Fehlen eines Model-Card-Eintrags bedeutet lediglich „nicht unter den stärksten“, und jede Kante bleibt im Atlas-Speicher abfragbar. |
| `metricModelSupport` | envelope | Bewertungsmetrik-Modelle, die eine Abdeckung dieser Sprache veröffentlichen, mit dem Modellbezeichner, den ein Harness lädt (`masakhane/africomet-mtl`). Steuert tatsächliches Verhalten – COMET-Modellauswahl – und stellt dennoch eine Fähigkeit dar, niemals einen Score. |

**In die obigen Felder integriert:** die Felder von vor der Umstellung `keyboardSupport` (→
`resources.keyboards`), `corpusAvailability` (→ `resources.corpora` /
`resources.monolingualCorpora`) und `databaseCoverage` (→
`resources.typology` plus `lexicalResources` – ein Datenbankeintrag ist nun ein
zitierter Abdeckungsfakt mit Umfang, kein Boolean).

**Aus Karten ausgemustert:** `omt1600`, `evalDatasets`, `pipelineReadiness` und
`metricPlugins` – keines davon wird von einer eingelesenen Quelle belegt, und eine
Bereitschaftsstufe (Readiness Tier) ist ein Urteil, kein Zitat.

**Kuratiert, nicht projiziert:** Die Deklarationsflächen für Evaluierungsstandards
(`evalStandard`, `evalMetrics`, `evalPack`) verbleiben im kuratierten Schema
des npm-Pakets. Sie teilen dem Evaluations-Harness mit, welches externe Schiedsrichter-Paket
eine Sprache bewertet (Schiedsrichter, keine Teilnehmer – der Harness-Kern enthält keinen
sprachspezifischen Scorer-Code); der Harness liest sie von einer Karte aus, sofern vorhanden,
aber derzeit enthält keine Karte im projizierten Korpus diese Angaben, und der
Atlas-Build schreibt sie nicht. Dasselbe gilt für den Block `install`, den das
FST-Installationsprogramm des Harness aus `resources.fsts[]`-Einträgen liest
(`get_fst_install_info()` in `language_cards.py`): Die projizierten Einträge
enthalten ausschließlich Existenzfakten.

### § 10. Herkunftsfelder

| Feld | Struktur | Anmerkungen |
|-------|-------|-------|
| `_fieldSources` | `object` | Auf jeder Karte. Ordnet jeden Feldpfad auf der Karte (`"classification.family"`, `"coordinates.lat"`) den sortierten Quell-IDs zu, die ihn belegt haben (`["glottolog-v5.3", "wals-v2020.5"]`). Von Champollion berechnete Werte tragen `champollion-derived-v1`. Quell-IDs sind versioniert – `grambank-v1.0.3`, `iso639-3-20260715` –, sodass jede Behauptung auf das exakte Release zurückgeht, das sie aufgestellt hat. |
| `coverage` | `object` | Auf jeder Karte und **vom Projektor berechnet, von keiner Quelle behauptet**: `{sourceCount, componentsPresent, componentsTotal, notAttested}` – wie viele verschiedene Quellen sich zu dieser Sprache äußern, wie viele Kartenkomponenten einen Wert tragen von der Gesamtzahl der ausfüllbaren Komponenten, und wie viele Werte eine Quelle ausdrücklich als *abwesend* erfasst hat (nachgesehen und verneint – eine andere Tatsache als nie nachgesehen zu haben). Dadurch kann eine dünn besetzte Karte begründen, **warum** sie dünn besetzt ist, anstatt vernachlässigt zu wirken. |
| `_card` | `object` | Die Metadaten der Karte selbst: `{type, id, revision, correctableFields}`. `type` ist `"language"` oder `"locale"` (Methoden- und Korpus-Karten nutzen denselben Projektor); `revision` ist ein Inhalts-Hash, sodass jede Änderung am Inhalt der Karte diesen ändert; `correctableFields` listet die Feldpfade auf, die Werte tragen – die Felder, die der Korrekturpfad ändern darf. |
| `_atlas` | `object` | `{version}` – der Release-Stempel des Korpus (`"unreleased"` zwischen Releases). Bewusst eine Release-ID, **kein** Build-Zeitstempel: Ein Zeitstempel würde zwei Builds aus identischen Pins kalendarisch unterschiedlich machen und die Eigenschaft zerstören, die es jedem ermöglicht, den Atlas zu überprüfen – dieselben Pins rein, dieselben Bytes raus. |

Der Provenienzblock von vor der Umstellung wurde vollständig ausgemustert: `dataSources`
(ersetzt durch die feldspezifische `_fieldSources`-Map), `supportTier` (ein berechnetes
Urteil, ersetzt durch die neutralen `coverage`-Zählungen), `_generated` (das
gesamte Korpus wird generiert; der Stempel ist `_card.revision` plus
`_atlas.version`), `humanReviewed` und `notes` (Kuration, die in
Pfade mit eigenen Datensätzen gehört) und die Felder auf oberster Ebene
`firstDocumented`/`lastDocumented` (verschoben nach `documentation` in § 5.5,
wo ihre Quelle sie tatsächlich belegt).

---

## Sprachcode-Richtlinie

Champollion verwendet **ISO 639-3** als kanonischen Bezeichner. Andere Standardcodes
werden als Aliase registriert und werden zur Laufzeit auf den ISO 639-3-Code aufgelöst.

| Priorität | Standard | Beispiel | Feld | Verwendung |
|-----------|----------|----------|------|------------|
| 1 (kanonisch) | ISO 639-3 | `crk` | `code` | Kartendateiname, Konfigurationsschlüssel, API-Parameter |
| 2 (Alias) | ISO 639-1 | `iu` | `codeAliases[]` | In CLI akzeptiert, aufgelöst zu ISO 639-3 |
| 3 (Alias) | BCP 47 | `fil` | `codeAliases[]` | In CLI akzeptiert, aufgelöst zu ISO 639-3 |
| Referenz | Glottocode | `plai1258` | `glottocode` | Nur Klassifikation, nicht zur Laufzeit |

**Auflösungsreihenfolge:** Wenn ein Benutzer einen Code angibt:
1. Direkte Übereinstimmung mit `card.code` → gefunden
2. Übereinstimmung mit `card.codeAliases[]` → gefunden, kanonische Karte zurückgeben
3. Übereinstimmung mit `card.iso639_1` → gefunden (Fallback)
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

**Was geschah mit den alten Codes?**
- Der alte 639-1-Code befindet sich in `card.iso639_1`
- Der alte 639-1-Code befindet sich in `card.codeAliases[]` (`fra` → `["fr"]`)
- `resolveCode("fr")` gibt zur Laufzeit `"fra"` zurück – abwärtskompatibel
- Benutzer können weiterhin `"fr"` in ihrer Konfiguration angeben – es wird transparent aufgelöst

**Was sich architektonisch geändert hat:**
- `_deepMerge()` überspringt nun `null`-Werte (erbt von der übergeordneten Karte)
- `_deepMerge()` hat nun ein gesetztes Identitätsfeld (code, extends, aliases werden niemals vererbt)
- `formality.default` wird nun aus den Register-`isDefault: true`-Flags abgeleitet
- 205 aus Grambank abgeleitete Karten erhielten eine strukturelle `formality.default`-Korrektur
- 38 Genus-/Familien-/Makrosprachkarten stellen Vererbungsziele bereit

---

## Sonderfälle

### Gebärdensprachen
Gebärdensprachen (z. B. ASE – American Sign Language) sind vollwertige Sprachen
mit ISO-639-3-Codes. Sie besitzen Geografie und Sprecherzahlen, aber:
- `modality` ist `"signed"` – die positive Aussage der Karte darüber, was die
  Sprache *ist*; das Fehlen eines Schriftsystems ist eine separate Tatsache
- `scripts` fehlt in der Regel (kein Notationssystem besitzt eine
  gemeinschaftsweite Standardakzeptanz), wenngleich `"Sgnw"` (SignWriting) dort erscheint, wo eine Quelle dies belegt
- `textDirection` fehlt
- `linguisticChallenges` sollte räumliche Grammatik, Klassifikatoren usw. behandeln

### Antike und historische Sprachen
Sprachen wie Latein (`lat`, isoLanguageType `"Historical"`) und Sanskrit
(`san`) werden nach wie vor in bestimmten Kontexten verwendet (liturgisch, akademisch), haben
jedoch keine Muttersprachler:
- `isoLanguageType` enthält das ISO-eigene Statuswort (`"Ancient"`,
  `"Historical"`, `"Extinct"`) – die Karte schwächt dieses niemals ab und überschreibt es nicht
- `endangerment` und `speakerEstimates` geben das wieder, was die zitierten Quellen
  tatsächlich einschätzen, Vorbehalte wortgetreu (Zahlen zu L2-Gemeinschaften bleiben so bezeichnet,
  wie ihre Quellen sie bezeichnen)
- `firstDocumented` / `lastDocumented` verorten sie zeitlich

### Konstruierte Sprachen (Plansprachen)
Esperanto (`epo`, isoLanguageType `"Constructed"`), Lojban usw.:
- `classification` kann fehlen – Glottolog führt Plansprachen (Conlangs) unter einem
  nicht-genealogischen Bucket, und dieser Bucket wird niemals als Familie angezeigt
- `contactInfluences` spiegelt das Ausgangsmaterial wider (z. B. greift Esperanto auf romanische, germanische und slawische Elemente zurück)
- `endangerment` ist ungewöhnlich – wachsende Sprechergemeinschaft, aber keine ursprüngliche Heimat

### Makrosprachen
Arabisch (`ara`), Chinesisch (`zho`), Cree (`cre`), Quechua (`que`) sind Makrosprachen,
die mehrere Einzelsprachen umfassen:
- `isoScope: "Macrolanguage"` – ein Navigations-Hub, niemals ein Benchmark-Ziel
- `macrolanguageMembers` listet die Codes der einzelnen Mitgliedssprachen auf;
  `canonicalisedMembers` erfasst, welche Mitglieder von den BCP-47-Registern in das
  Tag der Makrosprache zusammengeführt werden (jedes Register mit Quellenangabe)
- `methodSupport` spiegelt wider, was die *Makrosprachen-Karte* unterstützt (üblicherweise die standardisierte Varietät)
- Einzelne Mitglieder besitzen eigene Karten, die über `macrolanguage` auf den Hub zurückverweisen

### Sprachen ohne standardisierte Orthografie
Viele Sprachen (insbesondere Sprachen mit mündlicher Überlieferung) besitzen kein standardisiertes
Schriftsystem oder haben konkurrierende Orthografien:
- `scripts`, `scriptNames` und `textDirection` fehlen – keine Quelle
  hat eine Schrift belegt, was nicht dieselbe Behauptung wie „schriftlos“ ist
- `notes` sollte die orthografische Situation erläutern
- `linguisticChallenges` sollte anmerken, wie sich dies auf MÜ (maschinelle Übersetzung) auswirkt (z. B. keine Trainingsdaten)

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

Karten sind **Build-Ausgabe** – eine deterministische Projektion aus festgepinnten
Upstream-Snapshots. Es gibt kein Verfahren zur kartenweisen Anreicherung mehr:
Der manuell ausgeführte Skriptpfad `enrich-*` wurde ausgemustert, und eine
direkt an einer Kartendatei vorgenommene Änderung wird beim nächsten Build gelöscht.
Um einen Fakt zu ändern:

1. **Die Entscheidung registrieren.** Jedes Feld ist eine Zeile in der Entscheidungs-Registry
   des Builds: welcher Upstream-Parameter es speist, wie es projiziert wird und was ein
   fehlender Wert bedeutet.
2. **Die Ingest-Schicht korrigieren.** Ein falscher Wert ist ein Defekt im Source-Handler
   (oder ein veralteter Upstream-Pin), niemals etwas, das auf der Karte gepatcht werden sollte.
3. **Neu bauen und umstellen.** Der Build projiziert jede Karte neu aus den festgepinnten
   Snapshots; Quality Gates lehnen Teil-Builds, Null-/Leerwerte und Karten ab, die
   die Integritätsregeln verletzen.

### Umgang mit Konflikten

Wenn Quellen uneins sind:
1. **Speichern Sie alle** mit Quellenangabe – genau dafür ist der
   Attributions-Envelope gedacht
2. **Bilden Sie KEINE Mittelwerte** und ergreifen Sie keine Partei – `consensus` erscheint nur, wenn die
   Quellen tatsächlich übereinstimmen
3. **Führen Sie Vorbehalte jeder Quelle** wortgetreu im `note` dieses Werts mit
4. Ein einzelner Wert zur Anzeige oder Berechnung wird **vom Adapter**
   aus der deklarierten Autoritätsreihenfolge abgeleitet – die Karte selbst behält die volle Bandbreite

---

## Validierung

Führen Sie den Linter nach jedem Rebuild aus:

```bash
node scripts/lint-language-cards.mjs              # all cards
node scripts/lint-language-cards.mjs --lang crk    # single card
```

### PR-Checkliste

Wenn Sie eine Änderung einreichen, die die Karten betrifft (denken Sie daran: Ändern Sie den Build, nicht die Karte):

- [ ] Die Korrektur liegt in einem Ingest-Handler oder der Entscheidungs-Registry – keine Kartendatei wird manuell bearbeitet
- [ ] Felder enthalten nur von Quellen belegte Werte – nichts wird auf `null` oder
      `[]` aufgefüllt, um eine Karte zu „vervollständigen“
- [ ] `classification` stammt von Glottolog (nicht manuell erstellt)
- [ ] Die Provenienz jedes geänderten Felds landet in `_fieldSources`, wobei
      von Champollion berechnete Werte eine `champollion-derived`-Provenienz tragen
- [ ] Kein gemessener Score einer Methodenausgabe erscheint an irgendeiner Stelle auf einer Karte
- [ ] Linter und Karten-Integritätsprüfung (Card-Integrity Gate) laufen fehlerfrei durch

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
