---
sidebar_position: 6
title: "Scriptconverters"
---

# Scriptconverters

Scriptconverters zijn deterministische, LLM-vrije post-vertaalhooks die tekst van het ene schriftsysteem naar het andere omzetten. Ze maken een "eenmalig vertalen, weergeven in meerdere schriften"-workflow mogelijk — u vertaalt naar een werkbaar schrift (doorgaans Latijn) en converteert vervolgens automatisch naar het weergaveschrift.

## Waarom Scriptconverters?

Sommige talen gebruiken meerdere schriften voor dezelfde gesproken taal:

- **Plains Cree**: SRO (Latijn) voor bewerking → Syllabics (ᓀᐦᐃᔭᐍᐏᐣ) voor weergave
- **Servisch**: Latijn voor internationaal gebruik → Cyrillisch voor binnenlands gebruik
- **Klingon**: Romanisering voor typen → pIqaD (  ) voor weergave

Rechtstreeks vertalen naar niet-Latijnse schriften veroorzaakt problemen: LLM's hallucineren tekens, JSON-bestanden worden moeilijk te beheren in versiebeheer, en diff-tools kunnen wijzigingen niet vergelijken. Scriptconverters lossen dit op door vertalingen in een versiebeheer-vriendelijk schrift te bewaren en deze deterministisch te converteren tijdens het synchroniseren.

## Beschikbare Converters

Champollion wordt geleverd met vijf ingebouwde scriptconverters:

| Taal | Van | Naar | Type | Lettertype vereist? |
|--------|------|----|------|----------------|
| `crk` | SRO (Standard Roman Orthography) | Cree Syllabics | Deterministisch | Nee — native Unicode |
| `sr` | Latijn | Cyrillisch | Deterministisch | Nee — native Unicode |
| `tlh` | Romanisering | pIqaD | Deterministisch | Ja — PUA U+F8D0–F8FF |
| `x-elvish-s` | Latijn | Tengwar (Mode of Beleriand) | Deterministisch | Ja — PUA U+E000–E07F |
| `x-kryptonian` | Latijn | Kryptoniaans | Op lettertype gebaseerd cijfer | Ja — PUA U+E100–E119 |

### Deterministisch vs. Op Lettertype Gebaseerd

- **Deterministische converters** (Cree, Servisch, Klingon, Tengwar) voeren een echte teken-voor-teken-omzetting uit op basis van taalkundige regels. De uitvoer bevat werkelijke Unicode-tekens.
- **Op lettertype gebaseerde converters** (Kryptoniaans) zijn 1:1-vervangingscijfers waarbij de uitvoer bestaat uit Unicode PUA-tekens die alleen correct worden weergegeven wanneer een specifiek lettertype is geladen.

## Hoe Ze Werken

Scriptconverters worden uitgevoerd **na** de vertaling als een nabewerkingsstap. De pipeline is:

```
Source (English) → LLM Translation → Working Script → Script Converter → Display Script
```

Bijvoorbeeld voor Plains Cree:
```
"Welcome" → LLM → "tānisi" (SRO) → Converter → "ᑖᓂᓯ" (Syllabics)
```

### Greedy Links-naar-Rechts Matching

Alle converters gebruiken hetzelfde algoritme: probeer op elke tekenpositie eerst de langst mogelijke overeenkomst, en vervolgens progressief kortere overeenkomsten. Tekens die niet overeenkomen met een patroon (spaties, leestekens, cijfers) worden ongewijzigd doorgegeven.

Dit verwerkt digrafen en trigrafen correct:
- Klingon: `tlh` → enkel pIqaD-teken (niet `t` + `l` + `h`)
- Servisch: `nj` → `њ` (niet `н` + `ј`)
- Cree: `twê` → enkel syllabisch teken (niet `t` + `w` + `ê`)

## Scriptconverters Gebruiken

Conversie is een **configuratiebeslissing, nooit automatisch** (sinds 0.3.0 — eerdere versies converteerden onvoorwaardelijk, wat niet-weergeefbare PUA-tekst leverde aan projecten waarvan de lettertypen Latijnse transliteratie verwachtten):

- **crk en sr hebben twee echte orthografieën** (SRO/Syllabics, Latijn/Cyrillisch). Er is geen standaard: `champollion init` vraagt welke er geschreven moet worden, en `sync` weigert uit te voeren totdat de configuratie dit aangeeft. Champollion kiest niet het schrijfsysteem van een gemeenschap.
- **tlh, x-elvish-s en x-kryptonian gebruiken standaard romanisatie** — hun weergaveschriften bevinden zich in de Private Use Area en zijn niet weergeefbaar zonder een speciaal lettertype. U dient hier expliciet voor te kiezen.

```json title="champollion.config.json"
{
  "languages": {
    "crk": { "script": "Cans" },
    "tlh": { "script": "Piqd" }
  }
}
```

Wanneer champollion `en:crk` synchroniseert met `"script": "Cans"`, worden vertalingen geproduceerd in SRO (het werkschrift dat de gate valideert), en vervolgens geconverteerd naar Syllabics voordat ze naar `crk.json` worden geschreven. Met `"script": "Latn"` — of voor tlh zonder enige `script:` — is het werkschrift het eindproduct en wordt er niets geconverteerd.

Letters die de converter niet kan omzetten (Klingon heeft geen `d`, `c`, `f`, `g`, `i`, `k`, `s`, `x`, `z` — dus "GitHub" kan niet volledig converteren) behouden de **volledige waarde** in het werkschrift in plaats van schriften te mengen, met een waarschuwing die de letters benoemt. Definieer uw eigen transliteratieregels met [`scriptFallback`](/docs/getting-started/configuration#script-fallback).

Om conversie ongedaan te maken die plaatsvond toen deze onvoorwaardelijk was, voert u [`champollion repair-script`](/docs/getting-started/configuration#repair-script) uit; `champollion integrity` mislukt bij gevonden PUA waar conversie is uitgeschakeld.

### Converterstatus Controleren

```bash
npx champollion status
```

De statusuitvoer toont voor elk paar de vastgestelde beslissing over het schrift — wat er geschreven zal worden, en of er een converter beschikbaar is maar niet is ingeschakeld.

## Weblettertype-vereisten

Drie converters produceren Unicode Private Use Area (PUA)-tekens waarvoor aangepaste weblettertypen vereist zijn:

### Klingon (pIqaD)

Installeer een CSUR-compatibel pIqaD-lettertype (bijv. "pIqaD qolqoS" of "Klingon pIqaD HaSta"):

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

Installeer een CSUR-compatibel Tengwar-lettertype (bijv. "Tengwar Formal CSUR", "Tengwar Annatar"):

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

### Kryptoniaans

Installeer een Kryptoniaans lettertype gekoppeld aan PUA-codepunten U+E100–E119:

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

:::tip[Alternatieve aanpak voor Kryptonian]
Omdat Kryptonian een zuiver A-Z-cijfer is, kunt u de scriptconverter volledig overslaan en het lettertype via CSS op Latijnse tekst toepassen. Dit is vaak eenvoudiger bij webimplementaties — serveer gewoon het Kryptonian-lettertype en stel `font-family` in op de relevante elementen.
:::

## Een Aangepaste Converter Toevoegen

Om een converter voor een nieuwe taal toe te voegen, bewerkt u `lib/scripts.js`:

1. **Maak de conversiemap aan** — een geordende reeks van `[from, to]`-paren, langste reeksen eerst
2. **Maak de converterfunctie aan** — een greedy links-naar-rechts-scanner (gebruik `sroToSyllabics` als sjabloon)
3. **Registreer deze** in het `SCRIPT_CONVERTERS`-object met de taalcode als sleutel
4. **Voeg het veld `script` toe** aan het registeritem van de taal in `registers.js`

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

## Zie ook

- [Conlangs, Schriften & Orthografie](/docs/guides/conlangs-scripts-orthography) — PUA-lettertypen, Unicode, nieuwe converters toevoegen
- [Kwaliteitspoort](/docs/concepts/quality-gate) — validatie die wordt uitgevoerd vóór scriptconversie
- [Ondersteunde Talen](/docs/reference/supported-languages) — welke talen scriptconverters hebben
- [Ondersteuning voor een Taal met Weinig Bronnen](/docs/network/community/low-resource-languages) — SRO→Syllabics in context
- [Kookboek: FST-Gated Pipeline](/docs/network/tutorials/fst-gated-pipeline) — scriptconversie in een meerfasige pipeline
