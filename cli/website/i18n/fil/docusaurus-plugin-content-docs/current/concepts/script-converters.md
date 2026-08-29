---
sidebar_position: 6
title: "Mga Script Converter"
---

# Mga Script Converter

Ang mga script converter ay deterministic, walang LLM na mga post-translation hook na nagko-convert ng teksto mula sa isang sistema ng pagsulat patungo sa iba. Pinapagana nila ang workflow na "isalin nang isang beses, i-render sa maraming script" — nagsasalin po kayo sa isang working script (karaniwang Latin), pagkatapos ay awtomatikong kino-convert sa display script.

## Bakit Kailangan ang mga Script Converter?

May ilang wika na gumagamit ng maraming script para sa iisang sinasalitang wika:

- **Plains Cree**: SRO (Latin) para sa pag-edit → Syllabics (ᓀᐦᐃᔭᐍᐏᐣ) para sa display
- **Serbian**: Latin para sa internasyonal na paggamit → Cyrillic para sa lokal na paggamit
- **Klingon**: Romanization para sa pagta-type → pIqaD (  ) para sa display

Nagkakaroon ng mga problema kapag direktang nagsasalin sa mga non-Latin script: nagha-hallucinate ang mga LLM ng mga character, nagiging mahirap i-version-control ang mga JSON file, at hindi maikumpara ng mga diff tool ang mga pagbabago. Nilulutas ito ng mga script converter sa pamamagitan ng pagpapanatili ng mga salin sa isang script na madaling gamitin sa version control at deterministic na pag-convert sa oras ng sync.

## Mga Available na Converter

May kasamang limang built-in na script converter ang Champollion:

| Locale | Mula | Patungo | Uri | Kailangan ng Font? |
|--------|------|----|------|----------------|
| `crk` | SRO (Standard Roman Orthography) | Cree Syllabics | Deterministic | Hindi — native Unicode |
| `sr` | Latin | Cyrillic | Deterministic | Hindi — native Unicode |
| `tlh` | Romanization | pIqaD | Deterministic | Oo — PUA U+F8D0–F8FF |
| `x-elvish-s` | Latin | Tengwar (Mode of Beleriand) | Deterministic | Oo — PUA U+E000–E07F |
| `x-kryptonian` | Latin | Kryptonian | Font-based cipher | Oo — PUA U+E100–E119 |

### Deterministic vs. Font-Based

- Ang **deterministic converters** (Cree, Serbian, Klingon, Tengwar) ay nagsasagawa ng tunay na character-to-character mapping gamit ang mga tuntuning lingguwistiko. Naglalaman ang output ng mga aktuwal na Unicode character.
- Ang **font-based converters** (Kryptonian) ay mga 1:1 substitution cipher kung saan ang output ay mga Unicode PUA character na tama lang na mare-render kapag naka-load ang partikular na font.

## Paano Gumagana ang mga Ito

Tumatakbo ang mga script converter **pagkatapos** ng pagsasalin bilang post-processing step. Ang pipeline ay:

```
Source (English) → LLM Translation → Working Script → Script Converter → Display Script
```

Halimbawa, Plains Cree:
```
"Welcome" → LLM → "tānisi" (SRO) → Converter → "ᑖᓂᓯ" (Syllabics)
```

### Greedy Left-to-Right Matching

Ginagamit ng lahat ng converter ang parehong algorithm: sa bawat posisyon ng character, sinusubukan muna ang pinakamahabang posibleng match, pagkatapos ay unti-unting mas maiikling match. Ang mga character na hindi tumutugma sa anumang pattern (mga espasyo, bantas, numero) ay nananatiling hindi nababago.

Tama nitong hinahawakan ang mga digraph at trigraph:
- Klingon: `tlh` → iisang pIqaD character (hindi `t` + `l` + `h`)
- Serbian: `nj` → `њ` (hindi `н` + `ј`)
- Cree: `twê` → iisang syllabic (hindi `t` + `w` + `ê`)

## Paggamit ng mga Script Converter

Ang conversion po ay isang **desisyon sa configuration, hindi kailanman awtomatiko** (mula pa noong 0.3.0 — ang mga naunang bersyon ay nag-convert nang walang kondisyon, na nagpadala ng hindi ma-render na PUA text sa mga proyekto na ang mga font ay umaasa sa Latin transliteration):

- **ang crk at sr ay may dalawang totoong orthography** (SRO/Syllabics, Latin/Cyrillic). Wala po itong default: nagtatanong ang `champollion init` kung alin ang isusulat, at tumatanggi ang `sync` na tumakbo hanggang sa tukuyin ito sa config. Hindi po pinipili ng Champollion ang writing system ng isang komunidad.
- **ang tlh, x-elvish-s at x-kryptonian ay naka-default sa romanization** — ang kanilang mga display script ay Private Use Area, na hindi ma-render nang walang espesyal na font. Mangyari po na mag-opt in nang tahasan.

```json title="champollion.config.json"
{
  "languages": {
    "crk": { "script": "Cans" },
    "tlh": { "script": "Piqd" }
  }
}
```

Kapag nag-sync po ang champollion ng `en:crk` sa `"script": "Cans"`, ang mga pagsasalin ay ginagawa sa SRO (ang working script na bini-validate ng gate), pagkatapos ay kino-convert sa Syllabics bago isulat sa `crk.json`. Gamit po ang `"script": "Latn"` — o para sa tlh na walang `script:` kahit ano — ang working script ang siyang deliverable at wala pong kino-convert.

Ang mga titik na hindi ma-map ng converter (walang `d`, `c`, `f`, `g`, `i`, `k`, `s`, `x`, `z` ang Klingon — kaya hindi ganap na ma-convert ang "GitHub") ay pinapanatili ang **buong value** sa working script sa halip na paghaluin ang mga script, na may kasamang babala na nagpapangalan sa mga titik. Ideklara po ninyo ang inyong sariling mga panuntunan sa transliteration gamit ang [`scriptFallback`](/docs/getting-started/configuration#script-fallback).

Upang i-undo po ang conversion na nangyari noong ito ay walang kondisyon, patakbuhin ang [`champollion repair-script`](/docs/getting-started/configuration#repair-script); nabibigo po ang `champollion integrity` sa PUA na natagpuan kung saan naka-off ang conversion.

### Pagsusuri ng Status ng Converter

```bash
npx champollion status
```

Ipinapakita po ng status output ang nadesisyunang script ng bawat pares — kung ano ang isusulat, at kung may available na converter ngunit hindi naka-enable.

## Mga Kinakailangan sa Web Font

Tatlong converter ang naglalabas ng mga Unicode Private Use Area (PUA) character na nangangailangan ng mga custom na web font:

### Klingon (pIqaD)

Mag-install ng CSUR-compatible na pIqaD font (hal., "pIqaD qolqoS" o "Klingon pIqaD HaSta"):

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

Mag-install ng CSUR-compatible na Tengwar font (hal., "Tengwar Formal CSUR", "Tengwar Annatar"):

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

### Kryptonian

Mag-install ng Kryptonian font na naka-map sa mga PUA codepoint na U+E100–E119:

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

:::tip[Alternatibong lapit para sa Kryptonian]
Dahil ang Kryptonian ay isang purong A-Z cipher, maaari ninyong laktawan nang buo ang script converter at ilapat ang font sa Latin text sa pamamagitan ng CSS. Kadalasan itong mas simple para sa mga web deployment — i-serve lamang ang Kryptonian font at itakda ang `font-family` sa mga kaugnay na element.
:::

## Pagdaragdag ng Custom na Converter

Upang magdagdag ng converter para sa bagong wika, i-edit ang `lib/scripts.js`:

1. **Gumawa ng conversion map** — isang ordered array ng mga pares na `[from, to]`, na inuuna ang pinakamahahabang sequence
2. **Gumawa ng converter function** — isang greedy left-to-right scanner (gamitin ang `sroToSyllabics` bilang template)
3. **Irehistro ito** sa object na `SCRIPT_CONVERTERS` gamit ang locale code bilang key
4. **Idagdag ang field na `script`** sa register entry ng wika sa `registers.js`

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

## Tingnan Din

- [Conlangs, Mga Script at Ortograpiya](/docs/guides/conlangs-scripts-orthography) — mga PUA font, Unicode, pagdaragdag ng mga bagong converter
- [Quality Gate](/docs/concepts/quality-gate) — validation na tumatakbo bago ang script conversion
- [Mga Sinusuportahang Wika](/docs/reference/supported-languages) — kung aling mga wika ang may mga script converter
- [Suportahan ang isang Low-Resource Language](/docs/network/community/low-resource-languages) — SRO→Syllabics sa konteksto
- [Cookbook: FST-Gated Pipeline](/docs/network/tutorials/fst-gated-pipeline) — script conversion sa isang multi-stage pipeline
