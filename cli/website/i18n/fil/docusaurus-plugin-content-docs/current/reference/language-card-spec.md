---
sidebar_position: 4
title: "Ispesipikasyon ng Language Card"
description: "Kanonikal na schema para sa mga configuration card ng Champollion para sa bawat wika."
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

# Espesipikasyon ng Language Card

> **Nag-iisang batayan ng katotohanan (Single source of truth).** Tinutukoy ng dokumentong ito ang kanonikal na hugis ng bawat language card. Ipinapahayag lamang ng isang card kung ano ang ipinapahayag ng isang binanggit na source: ang isang field na walang source na nagpapahayag ay **inaalis, hindi null** — ang isang nawawalang field ay nangangahulugang "walang source na nagsalita", at hindi kailanman "walang dapat malaman". Ang machine-checkable na schema ay kasama bilang `shared/schemas/language-card.schema.json` sa npm package, at ang [kanonikal na halimbawa sa ibaba](#canonical-template) ay binubuo mula sa live na corpus sa bawat site build, kaya ang pahinang ito ay hindi maaaring lumihis mula sa mga card na inilalarawan nito.

## Ang 2026-08 atlas rebuild — ano ang nagbago sa schema na ito

Ang card corpus ngayon ay isa nang **build output**: ang bawat card ay naka-project mula sa isang imbakan ng mga naka-pin na upstream snapshot, at muling binubuo — hindi kailanman ine-edit — kapag may nagbagong katotohanan. May apat na bagay tungkol sa hugis ang nagbago kasama ng rebuild na iyon:

1. **Ang mga pinagtatalunang field ay nagtataglay ng isang attribution envelope.** Kung saan ang mga binanggit na source ay talagang hindi sumasang-ayon, ang field ay hindi isang flat value kundi `{"agreement": "...", "consensus": <value?>, "values": [{"value": ...,
   "source": "..."}]}`. This applies to `name`, `classification.family`,
   `speakerEstimates`, `endangerment`, at anumang field na ginagawang pinagtatalunan ng isang bagong source. Dapat basahin ng mga consumer ang mga card sa pamamagitan ng inilathalang adapter (`normalizeCard()` sa npm package) sa halip na ipagpalagay na flat values ang mga ito — nire-resolve ng `display()` ang isang envelope sa napagkasunduang value nito at sadyang walang ibinabalik sa isang tunay na pagtatalo sa halip na pumili ng mananalo.

2. **Mga pinalitang pangalan ng field.** Pinalitan ng `endonym` ang `nativeName` · Pinalitan ng `codeAliases` ang `aliases` · Pinalitan ng `scripts[]` (lahat ng pinatunayang script) ang flat na `script`, kung saan ang pangunahing script ay hinango mula sa maximal na BCP 47 tag ng card · Pinalitan ng `endangerment` (pagsusuri ng bawat source, sa sariling sukat ng source na iyon) ang nag-iisang `vitality` object · Ang `isoLanguageType` at `isoScope` ay nagtataglay na ngayon ng sariling mga salita ng ISO 639-3 ("Living", "Macrolanguage") sa halip na mga inisyal. Mga bagong field: `modality` ("spoken"/"signed", hinango mula sa ancestry ng Glottolog), `glottologBucket` (mga non-genealogical bucket ng Glottolog, na inilabas mula sa family slot), `locale`/`localeScoped`.

3. **Ang mga hindi ipinahayag na field ay inaalis, hindi null.** Ang isang field na walang source na nagpapahayag ay wala sa card. Ang naunang panuntunan ("ang bawat card ay DAPAT maglaman ng bawat top-level na field, kahit na null") ay inalis na: ang isang walang laman na value sa isang pampublikong surface ay mababasa bilang isang pag-aangkin na walang dapat malaman, na hindi katulad ng hindi paghahanap.

4. **Mayroong mga locale card.** Kasama ng mga language card, ang mga locale projection (`fra-CA`, `cmn-Hant`) ay nagtataglay ng mga katotohanan ng kanilang wika na na-resolve para sa isang teritoryo o script, na tinukoy ng isang `locale: {language, region, script}` block. Ang isang locale ay hindi isang wika: ibukod ang mga locale mula sa mga bilang ng wika sa pamamagitan ng block na iyon.

## Mga Prinsipyo ng Disenyo

1. **I-source ang lahat.** Ang bawat makatotohanang pag-aangkin ay nagmumula sa isang pinangalanan, may bersyon, at pangunahing source. Ang mga pag-aangkin na walang source ay mga pag-aangkin na hindi mabe-verify. Ginagawang malinaw ng `_fieldSources` map (at per-field na `source` annotations sa mga sub-object) ang pinagmulan (provenance).

2. **Panatilihin ang hindi pagkakasundo.** Kapag hindi sumasang-ayon ang mga awtoridad (isang source ang nagsasabing 50,000 ang nagsasalita, ang isa naman ay nagsasabing 20,000), iniimbak ng card ang *pareho* na may source attribution — ang hugis ng envelope sa itaas. Hindi po tayo kumukuha ng average, nagre-resolve, o pumapanig. Maaaring i-navigate ng mga user ang nuance.

3. **Ang absent ay nangangahulugang hindi ipinahayag.** Ang isang nawawalang field ay nangangahulugang walang source na nagpapahayag ng isang value. Kapag ang isang property ay talagang hindi naaangkop (hal., grammatical gender para sa isang wika na wala nito), tahasan itong sinasabi ng binanggit na value sa halip na maging blangko.

4. **Muling binubuo, hindi kailanman pina-patch.** Ang mga card ay naka-project mula sa mga naka-pin na source sa pamamagitan ng isang deterministic na build. Ang isang depekto sa katotohanan ay inaayos sa source handler nito at muling binubuo ang corpus — walang mga in-place na pag-edit, walang merge-only na enrichment layer.

---

## Three-Layer Architecture

| Layer | Lokasyon | Layunin |
|-------|----------|---------|
| **Language cards** | `shared/language-cards/<code>.json` | Per-language configuration: identity, classification, resources, lahat |
| **Genus cards** | `shared/language-cards/genera/<genus>.json` | Mga shared runtime property para sa magkakaugnay na wika (curated, hindi auto-generated) |
| **Language tree** | `shared/language-cards/language-tree.json` | Buong hierarchy ng Glottolog — reference data para sa Lab UI at language discovery |

---

## Inheritance Model

> **Karamihan ay historikal na mula noong atlas rebuild.** Wala nang language card sa disk ang nagtataglay ng `extends` — ang bawat card ay ganap na namateryalisa ng build, dahil ang namang prose ay hindi maaaring banggitin (ang isang family-level na pag-aangkin ay nagdala ng isang language-level na address). Ang mekanismo mismo ay nananatili sa isang lugar: ang offline bundle ng npm package ay nagpapadala ng mga locale card bilang mga compact na `extends` delta laban sa kanilang wika, na na-resolve sa pamamagitan ng parehong merge na inilarawan dito.

Kapag nag-set ang isang card ng `"extends": "family-dravidian"`, minemerge ng runtime ang parent
card papunta sa child gamit ang `_deepMerge()` (sa `lib/registers.js`). Nagbibigay-daan ito sa mga
genus card na tukuyin ang mga shared register, formality system, at gender guidance na
dumadaloy pababa sa lahat ng member language — nang hindi dinu-duplicate ang data sa daan-daang
indibidwal na card.

### Merge Semantics

| Child value | Behavior | Bakit |
|-------------|----------|-------|
| `null` | Mag-inherit mula sa parent | Ang `null` ay nangangahulugang "hindi ko ito tinutukoy" — dumadaloy ang value ng parent |
| Non-null | I-override ang parent | Mas specific ang data ng child — ito ang may priority |
| Nested object | Recursive merge | Nag-o-override ang mga field ng child, pinapanatili ang mga field ng parent |
| Array | Palitan nang buo | Hindi nagme-merge ang arrays item-by-item — panalo ang child array |

### Identity Fields (Hindi Kailanman Ini-inherit)

May ilang field na pag-aari mismo ng card at HINDI DAPAT kailanman i-inherit mula sa parent:

```
code, extends, _migration, aliases, iso639_1, iso639_3
```

Kahit na tumukoy ang parent card ng `aliases: ["macro-code"]`, HINDI
ii-inherit ng child card ang mga alias na iyon. Ang mga field na ito ay palaging sariling value ng child (kabilang ang
`null` kung hindi naka-set).

**Bakit:** Kung wala ang panuntunang ito, ii-inherit ng bawat wikang Cree ang `aliases: ["cre"]`
mula sa macrolanguage parent, kaya magiging alias ng macro ang bawat variety.

### Halimbawa: Paano Nare-resolve ang isang Cree Card

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

Sa runtime, nagbabalik ang `getLanguageCard("crk")` ng merged object na may mga
register ng genus-cree + mga property ng family-algic (kung mayroon) + sariling identity at metadata ng crk.

### Template ng Genus Card

Nasa `shared/language-cards/genera/` ang mga genus card at tumutukoy ang mga ito ng mga shared property
para sa isang language group. Sinusunod nila ang parehong schema tulad ng mga regular na card ngunit may
magkakaibang convention:

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

**Pangunahing panuntunan:** DAPAT lamanin LAMANG ng mga genus card ang data na tunay na shared sa
buong group at may source mula sa mga authoritative reference. Kung nag-iiba ang formality system
sa pagitan ng mga member, kabilang ito sa mga indibidwal na card, hindi sa genus.

## Kanonikal na Halimbawa \{#canonical-template}

> **Binuo (Generated), hindi isinulat.** Ang lahat sa seksyong ito ay hinango mula sa live na corpus sa oras ng pag-build: ang buong `crk` (Plains Cree) card, byte-for-byte, kasama ang isang `fra-CA` locale excerpt. Kapag muling binuo ang corpus, muling hinahango ng susunod na site build ang pahinang ito. Wala nang natitirang hand-maintained na template na maaaring maluma — ang nauna ay lumihis ng isang buong henerasyon ng schema sa likod ng mga card at inalis na noong 2026-08-16.

Ipinapakita ng halimbawa ang **on-disk na hugis** — kung ano ang makukuha ninyo kung bubuksan ninyo ang file. Dapat pa ring basahin ng mga consumer ang mga card sa pamamagitan ng inilathalang adapter (`normalizeCard()` sa npm package): nire-resolve nito ang mga envelope, pinag-uugnay ang mga pre-cutover na pangalan, at hinahango ang mga display-only na value (pangunahing script, vitality tier) na sadyang hindi taglay ng raw na card.

Ano ang dapat pansinin habang nagbabasa:

1. **Mga attribution envelope.** Ang `name`, `classification.family`,
   `endangerment`, `speakerEstimates`, `endonym`, `bcp47FullTag`, at
   `politenessDistinction` ay bawat isa nagtataglay ng `{agreement, consensus?, values:
   [{value, source}]}`, every value attributed to its source. `endangerment`
   ay may `"agreement": "incommensurable"`: ang mga source nito ay nagsusuri sa iba't ibang sukat, kaya ang bawat value ay pinapangalanan ang `scale` nito sa halip na i-convert sa sukat ng isang nanalo.

2. **Ang inalis ay nangangahulugang hindi ipinahayag.** Ang card ay walang `iso639_1` (ang Plains Cree ay walang ISO 639-1 code) at walang `phonologicalInventory` (walang na-ingest na source ang nagpapahayag nito) — ang mga field na iyon ay sadyang wala, hindi kailanman `null` o `[]`.

3. **Ang provenance ay isang first-class na layer.** Imina-map ng `_fieldSources` ang bawat field sa (mga) source na nagpahayag nito, kung saan minamarkahan ng `champollion-derived-v1` ang mga value na kinompyut ng Champollion. Tinitatakan ng `_card` ang uri, id, rebisyon ng card, at kung aling mga field ang maaaring galawin ng correction lane; tinitatakan ng `_atlas` ang corpus release.

4. **Walang mga run result.** Walang anuman sa card ang isang nasukat na score ng method output — ang chrF, mga FST acceptance rate, at ang mga kauri nito ay mga run result na naka-key ayon sa (method, dataset, metric) at makikita sa leaderboard. Ipinapahayag lamang ng card na *mayroong* mga resource (`resources`, `lexicalResources`,
   `methodSupport`).

<CardSpecExample variant="language" />

### Ang isang locale card ay isang projection, hindi isang wika \{#locale-card-example}

Sa tabi ng mga language card ay ang mga locale card (`fra-CA`, `cmn-Hant`): ang mga katotohanan ng isang wika na **na-resolve para sa isang teritoryo o script**, na tinukoy ng kanilang `locale` block — hindi kailanman sa pamamagitan ng hugis ng code. Minamana ng isang locale card ang mga katotohanan ng wika nito, nire-resolve ang mga may saklaw sa script at teritoryo (`script`,
`localeScoped`), at **hindi isang wika**: ibukod ang mga locale card mula sa bawat bilang ng wika at per-language na listahan sa pamamagitan ng `locale` block na iyon.

<CardSpecExample variant="locale" />

---

## Sanggunian ng Field (Field Reference) \{#field-reference}

Dalawang kumbensyon ang naaangkop sa bawat talahanayan sa ibaba:

- Ang **"envelope"** ay nangangahulugang isang attribution envelope — `{agreement, consensus?,
  values: [{value, source, note?, scale?}]}` — na nagtataglay ng pag-aangkin ng *bawat* source. Ang isang field na nakalista bilang `envelope` ay maaaring lumabas bilang isang flat value sa mga card kung saan iisang source lamang ang nagsasalita (halimbawa, ang mga Glottolog-only na languoid ay nagtataglay ng isang flat na `name`); dapat pangasiwaan ng mga consumer ang pareho, na siyang ginagawa ng inilathalang adapter.
- Walang field ang kinakailangan maliban sa `code` at `name`; ang lahat ng iba pa ay **inaalis kapag walang source na nagpapahayag nito**. Ang (mga) source na nagpapahayag ng bawat field ay naka-record per-card sa `_fieldSources`, kaya inilalarawan ng mga talahanayan ang *uri* ng source sa halip na i-pin ang mga bersyon na maaaring lumihis.

### § 1. Identity Fields

| Field | Hugis | Mga Tala |
|-------|-------|-------|
| `code` | `string` | **Kinakailangan.** Ang card ID at filename. ISO 639-3 para sa mga language card (`crk`); ang mga Glottolog-only na languoid ay nagtataglay ng kanilang glottocode; ang mga locale card ay nagtataglay ng isang locale code (`fra-CA`). |
| `name` | envelope | **Kinakailangan.** Ingles na reference name (ISO 639-3 registry, LinguaMeta, Glottolog). |
| `endonym` | envelope | Pinalitan ang `nativeName`. Kung ano ang tawag ng mga nagsasalita sa wika, sa wikang iyon (LinguaMeta, Wikidata). Wala kapag walang source na nagpapahayag nito — ang isang endonym ay hindi kailanman iniimbento o tina-transliterate natin. |
| `alternateNames` | `string[]` | Iba pang pinatunayang Ingles na pangalan. |
| `iso639_1` | `string` | Naroroon lamang kapag mayroong dalawang-letra na ISO 639-1 code (`fra` → `"fr"`). |
| `isoScope` | `string` | Sariling mga salita ng ISO 639-3 — `"Individual"`, `"Macrolanguage"`, `"Special"` (pinalitan ang mga inisyal na `"I"`/`"M"`/`"S"`). |
| `isoLanguageType` | `string` | Pinalitan ang `isoType`. Sariling mga salita ng ISO 639-3 — `"Living"`, `"Extinct"`, `"Ancient"`, `"Historical"`, `"Constructed"`. |
| `macrolanguage` | `string` | Ang macrolanguage kung saan kabilang ang wikang ito (`crk` → `"cre"`). Mga ISO 639-3 macrolanguage mapping. |
| `macrolanguageMembers` | `string[]` | Sa mga macrolanguage hub card: ang mga indibidwal na member code (`nor` → `["nno", "nob"]`). |
| `canonicalisedMembers` | envelope | Sa mga macrolanguage card: mga miyembro na ang mga tag ay itinutupi ng mga BCP 47 registry sa tag ng macrolanguage na ito (CLDR alias table + SIL langtags, bawat isa ay naka-attribute). |
| `supersededCodes` | `string[]` | Mga retiradong ISO 639-3 code na idinidirekta na ngayon ng SIL sa wikang ito — naka-record sa kahalili upang ang mga corpora na inilathala sa ilalim ng lumang code ay ma-resolve pa rin. |
| `codeAliases` | `string[]` | Pinalitan ang `aliases`. Mga code-level identifier na nagre-resolve sa card na ito. |
| `bcp47` | `string` | Ang BCP 47 tag ng wika gaya ng ipinahayag (LinguaMeta). |
| `bcp47Tag` | envelope | Hinango ng Champollion: ang RFC 5646 tag (ang pinakamaikling ISO 639 code ang mananalo). |
| `bcp47FullTag` | envelope | Ang maximal na language–script–region form (CLDR likelySubtags + SIL langtags). Hinahango ng adapter ang **pangunahing script** mula sa tag na ito. |
| `modality` | `string` | `"spoken"` o `"signed"`, hinango mula sa ancestry ng Glottolog. Ang pagsusulat ay isang attribute ng ortograpiya, hindi isang modality — ang isang hindi nakasulat na wika ay ganap pa ring sinasalita o sinenyas. |
| `locale` | `object` | **Mga locale card lamang.** `{language, region, script, publishedTag, source, note}` — ANG pagkakakilanlan ng locale. Ibukod ang mga locale card mula sa mga bilang ng wika sa pamamagitan ng block na ito, hindi kailanman sa pamamagitan ng hugis ng code. |
| `localeScoped` | `object` | Mga locale card lamang: mga value na na-resolve para sa teritoryo/script ng locale (hal. `scriptName`, `cldrOfficialStatus`). |

### § 2. Classification Fields

| Field | Hugis | Mga Tala |
|-------|-------|-------|
| `glottocode` | `string` | Identifier ng Glottolog para sa languoid na ito (`crk` → `"plai1258"`). Ang mga Glottolog-only na languoid — mga wika na nire-record ng Glottolog na hindi nire-record ng ISO 639-3 — ay gumagamit ng glottocode bilang kanilang card `code`. |
| `classification` | `object` | Container para sa mga placement field sa ibaba. Ang bawat isa ay may independiyenteng source at independiyenteng inaalis — ang isang isolate, o isang wika na inilagay sa isang Glottolog bucket, ay lehitimong nagtataglay lamang ng bahagi ng object na ito. |
| `classification.family` | envelope | Ang top-level na pamilya na ipinapahayag ng bawat awtoridad sa klasipikasyon. Ang Glottolog at WALS ay magkahiwalay na mga taxonomy na hindi palaging sumasang-ayon, kaya pareho itong pinapanatili at ina-attribute. Sinusuri ng Lint rule R5 ang Glottolog value sa loob ng envelope laban sa sariling tree ng Glottolog: maaaring hindi sumang-ayon ang WALS sa Glottolog, ngunit hindi maaaring ma-misquote ang Glottolog. Ang mga isolate ay walang taglay na pamilya. |
| `classification.familyGlottocode` | `string` | Glottocode ng top-level na pamilyang iyon (`crk` → `"algi1248"`). |
| `classification.genus` | `string` | Intermediate classification node ng WALS (`crk` → `"Algonquian"`). Isang konsepto ng WALS, **hindi** sa Glottolog — naglalathala ang Glottolog ng isang arbitrary-depth tree na walang genus level — kaya naroroon lamang ito kung saan kino-code ng WALS ang wika. |
| `classification.ancestry` | `string[]` | Descent path ng Glottolog bilang mga ancestor glottocode, nauuna ang root (`["algi1248", …, "plai1264"]`). Ang pagkakasunud-sunod **ay** ang pag-aangkin: ito ay isang path, hindi kailanman isang naka-alpabetong set. |
| `classification.glottologBucket` | `string` | Mga non-genealogical bucket ng Glottolog — `"Artificial Language"`, `"Pidgin"`, `"Mixed Language"`, `"Speech Register"`, `"Unclassifiable"`, `"Unattested"`. Inilabas mula sa family slot dahil ang isang bucket ay nag-uuri ayon sa uri, hindi sa pinagmulan: ang isang card na may bucket ay walang pamilya, at iyon ang tapat na resulta. |
| `isIsolate` | `boolean` | Kung inuuri ng Glottolog ang wikang ito bilang isang isolate. |

Ang pre-cutover na card ay nagtaglay din ng isang `genusGlottocode`. Inalis na ito kasama ng category error na gumawa nito: ang genus ay konsepto ng WALS, at ang pagbibihis nito sa isang Glottolog identifier ay nagpahayag ng isang tree node na wala sa Glottolog. Ang hierarchy ng Glottolog ay taglay na ng `ancestry` sa halip.

### § 3. Geography Fields

| Field | Hugis | Mga Tala |
|-------|-------|-------|
| `macroarea` | `string` | Macroarea ng Glottolog — `"Africa"`, `"Australia"`, `"Eurasia"`, `"North America"`, `"Papunesia"` o `"South America"`. |
| `coordinates` | `object` | `{lat, lng}` — representative point ng Glottolog. Isang punto, hindi isang teritoryo: inilalagay nito ang wika sa isang mapa at walang ipinapahayag tungkol sa saklaw o mga hangganan. |
| `countries` | `string[]` | Mga ISO 3166-1 alpha-2 code ng mga bansa na iniuugnay ng Glottolog sa wika (`["CA", "US"]`). |
| `cldrOfficialStatus` | `string` | Isang opisyal na katayuan na ipinagkakaloob ng ilang teritoryo sa wika, gaya ng nire-record ng CLDR (taglay sa pamamagitan ng LinguaMeta) — `"Official"`, `"Regional official"`. Sa isang locale card, ang katayuan na na-resolve para sa teritoryo ng *locale na iyon* ay matatagpuan sa `localeScoped.cldrOfficialStatus`. |

Ang pre-cutover na `regions` array (mga per-country speaker breakdown na may mga admin code) at `arealContext` (Sprachbund membership) ay inalis na: walang na-ingest na source ang nagpapahayag ng mga ito, at ang unsourced na curation ay hindi nakaliligtas sa isang rebuild. Ang mga region-level na pag-aangkin sa nagsasalita ay maaaring bumalik sa araw na may isang citable na source na dumating sa pipeline; hanggang sa panahong iyon, ang pagkawala nito ay ang tapat na estado.

### § 4. Writing System Fields

| Field | Hugis | Mga Tala |
|-------|-------|-------|
| `scripts` | `string[]` | Pinalitan ang flat na `script`. **Lahat** ng pinatunayang ISO 15924 code (`crk` → `["Cans", "Latn"]`), hindi nakaayos — huwag kailanman basahin ang `scripts[0]` bilang "ang" script. Ang pangunahing script ay hinahango ng adapter mula sa maximal tag ng `bcp47FullTag`. |
| `scriptNames` | `string[]` | Mga display name na hinango ng Champollion para sa `scripts[]` (`"Unified Canadian Aboriginal Syllabics"`). |
| `textDirection` | `string` | Pinalitan ang `dir`. Sariling mga salita ng source — `"left-to-right"` / `"right-to-left"` (dating `"ltr"`/`"rtl"`). |
| `suppressScript` | `string` | CLDR Suppress-Script: ang script na napaka-kanonikal para sa wika kaya inaalis ito ng mga BCP 47 tag (`fra` → `"Latn"`). |
| `script` | `string` | **Mga locale card lamang**: ang locale-resolved na script (`fra-CA` → `"Latn"`, `cmn-Hant` → `"Hant"`). Ang mga language card ay walang taglay na flat script field. |

Ang isang wika na walang pinatunayang pagsusulat ay sadyang **walang `scripts` field** — ang pagkawala nito ay nangangahulugang walang source na nagpahayag ng isang script, hindi isang pag-aangkin na ang wika ay "hindi nakasulat". (Ang mga sign language ang pinakamalaking pangkat na ganito: walang notation system ang may community-standard na pag-aangkop para sa pang-araw-araw na literasiya.)

### § 5. Demographic & Vitality Fields

| Field | Hugis | Mga Tala |
|-------|-------|-------|
| `speakerEstimates` | envelope | Pagtatantya ng bawat source, naka-attribute. Ang mga value ay maaaring mga eksaktong bilang o sariling mga range string ng source (`"10000-99999"`), kung saan ang mga caveat ng source ay taglay nang verbatim sa `note`. Ang `"agreement": "conflicting"` ay karaniwan — ang pagpapakita ng salungatan *ay* ang produkto; walang kinukuhang average o pinipili. |
| `endangerment` | envelope | Pinalitan ang nag-iisang `vitality` object. Pagsusuri ng bawat source **sa sariling sukat ng source na iyon** — ang bawat value ay nagtataglay ng isang `scale` field, at ang `"agreement": "incommensurable"` ang pamantayan dahil ang mga bokabularyo ng ELCat, Glottolog AES, at LinguaMeta ay hindi mga pagsasalin ng isa't isa. Hinahango ng adapter ang isang display na *vitality tier* mula sa isang pinangalanang source ayon sa idineklarang authority order; ang tier na iyon ay display-only — ang buong naka-attribute na set ay nananatili sa card. |

Ang isang *naka-display* na bilang ng nagsasalita saanman sa Champollion ay dapat tumugma sa isa sa mga binanggit na `speakerEstimates` entry o magtaglay ng tahasang `champollion-derived`
provenance — ipinapatupad ng mga card-integrity rule.

### § 5.5 Documentation & Digital Presence Fields

| Field | Hugis | Mga Tala |
|-------|-------|-------|
| `documentation` | `object` | Pinalitan ang `documentationDepth`. Record ng Glottolog kung gaano kahusay na inilarawan ang wika, sa sariling mga termino ng Glottolog. |
| `documentation.medLevel` | `string` | Most Extensive Description level ng Glottolog, verbatim — `"long grammar"`, `"grammar"`, `"grammar sketch"`, `"phonology"`, `"wordlist"`. |
| `documentation.medSourceId` | `string` | Ang bibliographic key ng pinakakomprehensibong paglalarawang iyon sa reference catalogue ng Glottolog. |
| `documentation.firstDocumented` | `number` | Sariling first-year-of-documentation column ng Glottolog, verbatim — inilipat dito mula sa pre-cutover na top-level field. Naroroon lamang sa ilang daang wika, at ang pagiging madalang nito ay mismong mahalagang malaman. |
| `documentation.lastDocumented` | `number` | Last-year-of-documentation column ng Glottolog, verbatim — naroroon sa humigit-kumulang isang libong wika. |
| `wikipediaEdition` | `object` | Pinalitan ang `digitalPresence`. `{site, url, name}` — mayroong isang bukas na edisyon ng Wikipedia sa wikang ito (`afr` → `af.wikipedia.org`). Pag-iral lamang, sadyang **walang mga bilang ng artikulo**: ilang mga edisyon ay higit na bot-generated, at ang isang malaking edisyon ay hindi "mas mahusay na naidokumento" kaysa sa isang maliit sa anumang paraan na magagamit ng isang tagasalin. |
| `dialectCount` | `number` | Sariling `child_dialect_count` column ng Glottolog, verbatim — mga direktang child dialect lamang, hindi ang buong subtree. Ito ay pag-aangkin ng Glottolog, hindi natin aritmetika: isang naunang panuntunan ang nagtatak dito ng `champollion-derived` at ginawang angkinin ng libu-libong card ang kredito para sa bilang ng Glottolog. |

Ang natitira sa pre-cutover na `digitalPresence` block (mga oras sa Common Voice, mga bilang ng pangungusap sa Tatoeba) ay inalis na hanggang sa dumating ang mga source na iyon sa pipeline — ang Tatoeba corpus mismo ay lumalabas na kung saan ito nabibilang, bilang isang parallel corpus sa ilalim ng `resources.corpora` (§ 9).

### § 6. Formality, Register & Gender Fields

Ang naka-project na corpus ay nagtataglay ng eksaktong isang field dito — ang binanggit na katotohanan:

| Field | Hugis | Mga Tala |
|-------|-------|-------|
| `politenessDistinction` | envelope | Kung ang wika ay nagga-grammaticalise ng pagiging magalang sa mga second-person form. Naka-attribute sa Grambank GB415 (binary: absent/present) at WALS 45A (apat na antas: no distinction / binary / multiple / pronouns avoided). Ang mga iyon ay magkakaibang sukat, kaya ang bawat value ay pinapangalanan ang `scale` nito at inuulat ng envelope ang mga ito bilang **incommensurable** (hindi mapaghahambing) sa halip na bilang isang hindi pagkakasundo. |

**Ang register system ay configuration, hindi isang katotohanan ng card.** Ang pre-cutover na corpus ay nag-imbak ng `formality` prose at `registers` prompt sa halos labingwalong daang card bawat isa — halos lahat ng ito ay binuo mula sa parehong dalawang source sa itaas, pagkatapos ay dinala na parang ito ay hand-curated na configuration. Pinapanatili ng atlas ang katotohanan; ang mga configuration surface — `formality`, `registers`,
`gender`, `codeSwitching` — ay nananatiling bahagi ng **curated schema ng npm package** (`language-card.schema.json`), makikita sa mga curated na genus/family hub card, at umaabot sa CLI sa pamamagitan ng `extends` merge ng register system na inilarawan sa [Inheritance Model](#inheritance-model). Hindi ang mga ito naka-project na atlas field: walang card sa naka-project na corpus ang nagtataglay ng mga ito, at hindi kailanman isusulat ng atlas build ang mga ito. Ang patnubay sa
[Writing Good Register Presets](#writing-good-register-presets) ay naaangkop sa curated lane na iyon.

### § 7. Linguistic Profile Fields

| Field | Hugis | Mga Tala |
|-------|-------|-------|
| `typologicalProfile` | `object` | Isang key bawat na-ingest na typological feature, ang bawat value ay sariling coding ng source, ang bawat key ay naroroon lamang kung saan kino-code ng source ang wikang ito. Ang mga boolean ay nagmumula sa mga feature ng Grambank, ang mga category string mula sa mga chapter ng WALS; pinapangalanan ng decision registry ang eksaktong upstream parameter para sa bawat key. |
| `phonologicalInventory` | `object` | `{consonants, vowels, tones, totalPhonemes, hasTone}` — mga bilang na kinompyut ng Champollion sa isang binanggit na PHOIBLE inventory (naglalathala ang PHOIBLE ng isang row bawat segment at walang ipinapahayag na mga bilang), kaya ang bawat value ay nagtataglay ng `champollion-derived` provenance. **Ang PHOIBLE ang tanging awtoridad sa tono** (lint R1): Ang Grambank ay walang tone feature, at wala nang iba pa sa card ang maaaring mag-angkin ng tonality. |
| `numeralSystem` | `object` | `{base}` — ang numeral base, verbatim mula sa *Numeral Systems of the World's Languages* ni Chan (`"decimal"`, `"quinary-vigesimal"`, `"body tally"`; halos isang daang magkakaibang value). Wala kapag ang sariling base column ni Chan ay walang laman — humigit-kumulang kalahati ng mga na-survey na wika — dahil pinunan ng isang nakaraang generator ang blangko ng `"decimal"` at nag-imbento ng mga value para sa dalawang libong wika. |
| `pluralCategories` | `string[]` | Ang mga cardinal plural category na isinasaad ng CLDR para sa wikang ito — ang Arabic ay nagtatangi ng `["zero", "one", "two", "few", "many", "other"]`, ang French ay tatlo sa mga ito, ang Chinese ay isa. Binasa mula sa mga key ng sariling rule set ng CLDR, kaya ito ay pag-aangkin ng CLDR, hindi natin derivation. Pinalitan ang pre-cutover na `rules.plurals.categories`; kailangan ito ng isang i18n pipeline upang malaman kung gaano karaming plural form ang dapat ibigay ng isang mensahe. |

Ang mga `typologicalProfile` key na kasalukuyang naka-project, kasama ang kanilang mga upstream parameter:

- **Mga chapter ng WALS** (mga category string, sariling mga value label ng WALS): `fusion`
  (20A), `verbSynthesis` (22A), `affixPreference` (26A), `reduplication`
  (27A), `genderCount` (30A), `caseCount` (49A), `wordOrder` (81A),
  `subjectVerbOrder` (82A), `verbalAlignment` (100A), `negationOrder` (143A)
- **Mga feature ng Grambank** (mga boolean): `hasGenderInPronouns` (GB030),
  `hasSexBasedGender` (GB051), `hasNumeralClassifiers` (GB057), `hasCoreCase`
  (GB070), `hasObliqueCase` (GB071), `marksPastTense` (GB083),
  `marksPresentTense` (GB084)

Ang mga pre-cutover na `linguisticChallenges` at `contactInfluences` block ay hindi naka-project — ang sinaliksik na prose na walang na-ingest na source ay nananatili sa curated schema ng npm package, tulad ng mga register surface sa § 6 (ang mga talahanayan ng [Contact Influence Types](#contact-influence-types) sa ibaba ay nagsisilbi sa lane na iyon). Ang `rules` block ay inalis na: kung ano ang maaaring banggitin dito ay nananatili bilang `pluralCategories` dito at ang mga script field sa § 4.

### § 8. Encyclopedic Fields

Inalis na mula sa mga card. Ang mga pre-cutover na `encyclopedic` (mga sanaysay sa kasaysayan at diyalekto, mga institutional link), `culturalAphorism`, at `varieties` block ay mga hand-curated na prose sa card grain, na sadyang dine-delete ng rebuild. Ang mga katotohanan sa membership na itinuro ng `varieties` ay mga binanggit na identity field na ngayon (§ 1 `macrolanguageMembers` at `canonicalisedMembers`), at ang per-variety na tool coverage ay sinasagot ng sariling card ng bawat miyembro (`methodSupport`,
`resources`). Ang isang kinatawang kasabihan ay maaaring bumalik sa pamamagitan ng isang community contribution lane na may pahintulot at citation; hindi ito babalik bilang isang hindi binanggit na card field.

### § 9. Digital Resource Fields

Ang lahat sa seksyong ito ay nagpapahayag ng **pag-iral at kakayahan, hindi kailanman kalidad**: na ang isang resource ay inilathala at kung sino ang naglathala nito — hindi kailanman na ito ay mahusay, kumpleto, o magagamit, at hindi kailanman isang nasukat na score. Ang anumang nasukat na score ng method output ay isang run result na naka-key ayon sa (method, dataset, metric), makikita sa leaderboard, at ipinagbabawal sa mga card (lint R3).

| Field | Hugis | Mga Tala |
|-------|-------|-------|
| `resources` | `object` | Container: ang bawat subfield sa ibaba ay isang listahan na may independiyenteng source, inaalis kapag walang source na nagpapahayag nito. |
| `resources.fsts` | `object[]` | Mga inilathalang finite-state morphological analyser: `{name, url, publisher, license, licenceEstablished, archived}`. Ang lisensya ay kasama sa bawat entry sa halip na ipagpalagay na pare-pareho sa buong catalogue — kailangan ng mga hangganan ng lisensya ang mga aktwal na termino. Para sa isang polysynthetic na wika, ang isang FST ay madalas na ang tanging structural check na umiiral. |
| `resources.corpora` | `object[]` | Mga parallel corpora na nagpapatunay sa wikang ito: `{corpus, corpusId, pairCount, topPartners, alignmentPairsTotal, …}`. Isinasaad sa pamamagitan ng mga **pares**, dahil ang isang parallel corpus ay nagpapatunay lamang sa isang wika sa pamamagitan ng isang pares — ang "sumasaklaw sa Swahili" nang hindi sinasabi kung laban saan ay sumasagot sa isang tanong na walang nagtanong. Pag-iral at laki, hindi kailanman kalidad. |
| `resources.monolingualCorpora` | `object[]` | Mga monolingual corpora — pinananatiling hiwalay mula sa `corpora` kaya ang "may corpus" ay hindi kailanman nangangahulugang dalawang hindi mapaghahambing na bagay. |
| `resources.speech` | `object[]` | Mga inilathalang speech resource. Pag-iral lamang. |
| `resources.keyboards` | `object[]` | Mga inilathalang keyboard layout. Payak ngunit mahalaga: para sa isang ortograpiya na nangangailangan ng mga character na hindi nagagawa ng anumang standard na layout, ang isang layout ang pagkakaiba sa pagitan ng wika na maaaring i-type at hindi. |
| `resources.typology` | `object[]` | Mga typological dataset na *nagko-code* sa wikang ito, kasama ang lawak: `{dataset, featuresCoded, datasetFeatureTotal}`. Pag-iral at lawak, hindi kailanman nilalaman — kung ano ang sinasabi ng isang feature ay nananatili sa labas ng card hanggang sa may sumulat ng parameter map na tumatanggap nito (ang mga tinanggap ay lumalabas sa `typologicalProfile` ng § 7). Ang mga bilang ng feature ay ating aritmetika, kaya nagtataglay ang mga ito ng `champollion-derived` provenance. |
| `lexicalResources` | `object` | Container para sa mga katotohanan ng lexical existence. |
| `lexicalResources.datasets` | `object[]` | Mga inilathalang wordlist kasama ang kanilang coverage: `{dataset, forms, concepts, release}`. |
| `lexicalResources.dictionaries` | `object[]` | Mga inilathalang diksyunaryo — pag-iral, hindi kailanman kalidad, at **nakadirekta** kung saan idinidirekta ng publisher ang mga ito: ang isang diksyunaryo na papunta sa isang direksyon ay ibang resource mula sa isa na papunta sa kabila. Ang mga entry ay hindi pare-pareho ang hugis (alam ng isang CLDF dataset ang bilang ng entry nito; alam ng isang repository ang pares at direksyon nito); pinapangalanan ng bawat isa ang sarili nitong source, at ang lisensya at naka-archive na estado ay kasama sa bawat entry. |
| `lexicalResources.colexificationConcepts` / `colexifyingForms` | `number` | Mga bilang na kinompyut ng Champollion sa CLICS³: mga konseptong pinatunayan para sa wikang ito, at mga form na nagma-map sa dalawa o higit pang magkakaibang konsepto. `champollion-derived`. |
| `methodSupport` | `object` | Aling mga translation method ang sumasaklaw sa wikang ito — kakayahan, hindi kailanman isang score. Hugis: `{total, byTier, named, truncated}`. Ang Ingles ay nagtataglay ng libu-libong method edge at ang median na wika ay ilang dosena, kaya hawak ng card ang *hugis* ng ebidensya — `total` kasama ang mga `byTier` bilang bawat confidence tier (`fetched`, `partially-confirmed`, `model-card-declared`) — at pinapangalanan lamang ang pinakamalakas na mga entry (bawat `{value, variant, source, confidence}`), na may cap. Ang mga registry **service** ay palaging pinapangalanan nang buo, sa itaas ng cap, kaya ang pagkawala ng isang serbisyo mula sa `named` ay isang tunay na sagot; ang pagkawala ng isang model-card entry ay nangangahulugan lamang na "hindi kabilang sa pinakamalakas", at ang bawat edge ay nananatiling maaaring i-query sa atlas store. |
| `metricModelSupport` | envelope | Mga evaluation metric model na naglalathala ng coverage ng wikang ito, kasama ang model identifier na nilo-load ng isang harness (`masakhane/africomet-mtl`). Nagpapatakbo ng tunay na pag-uugali — pagpili ng COMET model — at kakayahan pa rin, hindi kailanman isang score. |

**Itinupi sa mga field sa itaas:** ang pre-cutover na `keyboardSupport` (→
`resources.keyboards`), `corpusAvailability` (→ `resources.corpora` /
`resources.monolingualCorpora`), at `databaseCoverage` (→
`resources.typology` kasama ang `lexicalResources` — ang isang database entry ay isa na ngayong binanggit na coverage fact na may lawak, hindi isang boolean).

**Inalis na mula sa mga card:** `omt1600`, `evalDatasets`, `pipelineReadiness`, at
`metricPlugins` — wala sa mga ito ang ipinahayag ng isang na-ingest na source, at ang isang readiness tier ay isang paghuhusga, hindi isang citation.

**Curated, hindi naka-project:** ang mga eval-standard declaration surface
(`evalStandard`, `evalMetrics`, `evalPack`) ay nananatili sa curated schema ng npm package. Sinasabi ng mga ito sa evaluation harness kung aling external referee package ang nagbibigay ng score sa isang wika (mga referee, hindi mga kalahok — ang harness core ay hindi nagpapadala ng language-specific na scorer code); binabasa ng harness ang mga ito mula sa isang card kapag naroroon, ngunit walang card sa naka-project na corpus ang kasalukuyang nagtataglay ng mga ito, at hindi isinusulat ng atlas build ang mga ito. Ganoon din ang para sa `install` block na binabasa ng FST installer ng harness mula sa mga `resources.fsts[]` entry
(`get_fst_install_info()` sa `language_cards.py`): ang mga naka-project na entry ay nagtataglay lamang ng mga katotohanan ng pag-iral.

### § 10. Provenance Fields

| Field | Hugis | Mga Tala |
|-------|-------|-------|
| `_fieldSources` | `object` | Sa bawat card. Imina-map ang bawat field path sa card (`"classification.family"`, `"coordinates.lat"`) sa mga naka-sort na source id na nagpahayag nito (`["glottolog-v5.3", "wals-v2020.5"]`). Ang mga value na kinompyut ng Champollion ay nagtataglay ng `champollion-derived-v1`. Ang mga source id ay may bersyon — `grambank-v1.0.3`, `iso639-3-20260715` — kaya ang bawat pag-aangkin ay nagmumula sa eksaktong release na gumawa nito. |
| `coverage` | `object` | Sa bawat card, at **kinompyut ng projector, hindi ipinahayag ng anumang source**: `{sourceCount, componentsPresent, componentsTotal, notAttested}` — kung gaano karaming magkakaibang source ang nagsasalita tungkol sa wikang ito, kung gaano karaming card component ang nagtataglay ng isang value mula sa kung gaano karami ang umiiral na pupunan, at kung gaano karaming value ang positibong na-record ng isang source bilang *absent* (tiningnan at sinabing wala — isang magkaibang katotohanan mula sa hindi kailanman pagtingin). Ito ang nagbibigay-daan sa isang manipis na card na sabihin **kung bakit** ito manipis sa halip na magmukhang napabayaan. |
| `_card` | `object` | Sariling metadata ng card: `{type, id, revision, correctableFields}`. Ang `type` ay `"language"` o `"locale"` (ang mga method at corpus card ay sumasakay sa parehong projector); ang `revision` ay isang content hash, kaya ang anumang pagbabago sa nilalaman ng card ay nagpapabago rito; inililista ng `correctableFields` ang mga field path na nagtataglay ng mga value — ang mga field na maaaring galawin ng correction lane. |
| `_atlas` | `object` | `{version}` — ang corpus release stamp (`"unreleased"` sa pagitan ng mga release). Sadyang isang release id, **hindi** isang build timestamp: ang isang timestamp ay gagawing magkaiba sa kalendaryo ang dalawang build mula sa magkaparehong mga pin, na sumisira sa property na nagbibigay-daan sa sinuman na suriin ang atlas — parehong mga pin ang ipinasok, parehong mga byte ang ilalabas. |

Ang pre-cutover na provenance block ay inalis na nang buo: `dataSources`
(pinalitan ng per-field na `_fieldSources` map), `supportTier` (isang kinompyut na paghuhusga, pinalitan ng mga neutral na `coverage` na bilang), `_generated` (ang buong corpus ay binuo; ang tatak ay `_card.revision` kasama ang
`_atlas.version`), `humanReviewed` at `notes` (curation na kabilang sa mga lane na may sariling mga record), at ang top-level na
`firstDocumented`/`lastDocumented` (inilipat sa `documentation` sa § 5.5,
kung saan aktwal na ipinapahayag ang mga ito ng kanilang source).

---

## Patakaran sa Language Code

Gumagamit ang Champollion ng **ISO 639-3** bilang canonical identifier. Ang iba pang standard code
ay naka-register bilang mga alias at nare-resolve sa ISO 639-3 code sa runtime.

| Prayoridad | Pamantayan | Halimbawa | Field | Paggamit |
|----------|----------|---------|-------|-----|
| 1 (kanonikal) | ISO 639-3 | `crk` | `code` | Filename ng card, mga config key, mga API param |
| 2 (alias) | ISO 639-1 | `iu` | `codeAliases[]` | Tinatanggap sa CLI, na-resolve sa ISO 639-3 |
| 3 (alias) | BCP 47 | `fil` | `codeAliases[]` | Tinatanggap sa CLI, na-resolve sa ISO 639-3 |
| Sanggunian | Glottocode | `plai1258` | `glottocode` | Klasipikasyon lamang, hindi para sa runtime |

**Pagkakasunud-sunod ng resolution (Resolution order):** Kapag nagbigay ang isang user ng code:
1. Direktang tugma sa `card.code` → natagpuan
2. Tugma sa `card.codeAliases[]` → natagpuan, ibalik ang kanonikal na card
3. Tugma sa `card.iso639_1` → natagpuan (fallback)
4. Hindi natagpuan → error

### Kasaysayan ng Migration: ISO 639-1 → ISO 639-3

Bago ang v8, gumamit ang mga card filename ng ISO 639-1 code kung available (`fr.json`,
`de.json`, `ja.json`). Sa 639-3 migration, pinalitan ng pangalan ang lahat ng card patungo sa kanilang
mga katumbas sa ISO 639-3:

| Dati | Pagkatapos | Bakit |
|------|------------|-------|
| `fr.json` | `fra.json` | Canonical ang 639-3 |
| `de.json` | `deu.json` | Canonical ang 639-3 |
| `zh.json` | `cmn.json` | Macrolanguage → default individual |
| `ar.json` | `arb.json` | Macrolanguage → Modern Standard Arabic |
| `ms.json` | `zsm.json` | Macrolanguage → Standard Malay |

**Ano ang nangyari sa mga lumang code?**
- Ang lumang 639-1 code ay nasa `card.iso639_1`
- Ang lumang 639-1 code ay nasa `card.codeAliases[]` (`fra` → `["fr"]`)
- Ang `resolveCode("fr")` ay nagbabalik ng `"fra"` sa runtime — backwards compatible
- Maaari pa ring isulat ng mga user ang `"fr"` sa kanilang config — nagre-resolve ito nang transparent

**Ano ang nagbago sa architecture:**
- Nilalaktawan na ngayon ng `_deepMerge()` ang mga value na `null` (nag-i-inherit mula sa parent)
- May identity field set na ngayon ang `_deepMerge()` (hindi kailanman ini-inherit ang code, extends, aliases)
- Hinango na ngayon ang `formality.default` mula sa mga flag ng register na `isDefault: true`
- 205 card na derived mula sa Grambank ang nagkaroon ng structural na pag-aayos sa `formality.default`
- 38 genus/family/macrolanguage card ang nagbibigay ng inheritance targets

---

## Edge Cases

### Mga Sign Language
Ang mga sign language (hal., ASE — American Sign Language) ay mga lehitimong wika na may mga ISO 639-3 code. Mayroon silang heograpiya at mga bilang ng nagsasalita ngunit:
- Ang `modality` ay `"signed"` — ang positibong pag-aangkin ng card kung ano *ang* wika; ang pagkawala ng isang writing system ay isang hiwalay na katotohanan
- Ang `scripts` ay karaniwang wala (walang notation system ang may community-standard na pag-aangkop), bagaman ang `"Sgnw"` (SignWriting) ay lumalabas kung saan ipinapahayag ito ng isang source
- Ang `textDirection` ay wala
- Dapat tugunan ng `linguisticChallenges` ang spatial grammar, mga classifier, atbp.

### Mga Sinauna at Historikal na Wika
Ang mga wika tulad ng Latin (`lat`, isoLanguageType `"Historical"`) at Sanskrit
(`san`) ay ginagamit pa rin sa mga partikular na konteksto (liturhikal, akademiko) ngunit walang mga katutubong nagsasalita:
- Ang `isoLanguageType` ay nagtataglay ng sariling status word ng ISO (`"Ancient"`,
  `"Historical"`, `"Extinct"`) — hindi kailanman pinapalambot o ino-override ito ng card
- Inuulat ng `endangerment` at `speakerEstimates` kung anuman ang aktwal na sinusuri ng mga binanggit na source, mga caveat nang verbatim (ang mga bilang ng L2-community ay nananatiling may label gaya ng pag-label ng kanilang mga source)
- Hinahanap sila ng `firstDocumented` / `lastDocumented` sa panahon

### Mga Binuong Wika (Constructed Languages)
Esperanto (`epo`, isoLanguageType `"Constructed"`), Lojban, atbp.:
- Maaaring wala ang `classification` — inilalagay ng Glottolog ang mga conlang sa ilalim ng isang non-genealogical bucket, at ang bucket ay hindi kailanman ipinapakita bilang isang pamilya
- Sinasalamin ng `contactInfluences` ang source material (hal., ang Esperanto ay humahango sa Romance, Germanic, Slavic)
- Ang `endangerment` ay hindi karaniwan — lumalaking komunidad ng nagsasalita ngunit walang katutubong tinubuang-bayan

### Mga Macrolanguage
Ang Arabic (`ara`), Chinese (`zho`), Cree (`cre`), Quechua (`que`) ay mga macrolanguage na sumasaklaw sa maraming indibidwal na wika:
- `isoScope: "Macrolanguage"` — isang navigation hub, hindi kailanman isang benchmark target
- Inililista ng `macrolanguageMembers` ang mga indibidwal na member code;
  nire-record ng `canonicalisedMembers` kung aling mga miyembro ang itinutupi ng mga BCP 47 registry sa tag ng macrolanguage (naka-attribute ang bawat registry)
- Sinasalamin ng `methodSupport` kung ano ang sinusuportahan ng *macrolanguage card* (karaniwan ay ang standardized na barayti)
- Ang mga indibidwal na miyembro ay may sariling mga card, na nagdadala ng `macrolanguage` pabalik sa hub

### Mga Wika na Walang Standardized na Ortograpiya
Maraming wika (lalo na ang mga wika na may oral na tradisyon) ang walang standardized na writing system, o may mga naglalabanang ortograpiya:
- Ang `scripts`, `scriptNames`, at `textDirection` ay wala — walang source na nagpahayag ng isang script, na hindi katulad ng pag-aangkin na "hindi nakasulat"
- Dapat ipaliwanag ng `notes` ang sitwasyon sa ortograpiya
- Dapat tandaan ng `linguisticChallenges` kung paano ito nakakaapekto sa MT (hal., walang training data)

### Diglossia
Mga wikang tulad ng Arabic (MSA vs. dialects) o Guaraní (Jopará vs. pure Guaraní):
- Kinukuha ng `codeSwitching` ang sitwasyon ng mixed-variety
- Maaaring mag-alok ang `registers` ng mga preset para sa iba't ibang level
- Maaaring ilista ng `varieties` ang diglossic pair

---

## Mga Uri ng Contact Influence

| Uri | Kahulugan | Halimbawa |
|-----|-----------|-----------|
| `superstrate` | Dominanteng wikang ipinataw sa isang komunidad | French → English (pagkatapos ng 1066) |
| `substrate` | Native language na nakaaimpluwensiya sa ipinataw na wika | Celtic → English |
| `adstrate` | Kalapit na wikang may mutual influence | Norse → English |
| `learned_borrowing` | Mga borrowing sa pamamagitan ng edukasyon/scholarship | Latin → English |
| `lexical_borrowing` | Direktang vocabulary loans sa pamamagitan ng contact | Spanish → Filipino |
| `relexification` | Maramihang pagpapalit ng vocabulary | Portuguese → Papiamentu |

## Lalim ng Contact Influence

| Lalim | Kahulugan |
|-------|-----------|
| `light` | Ilang loanword, minimal na structural impact |
| `moderate` | Makabuluhang vocabulary sa mga partikular na domain |
| `heavy` | Malaganap na vocabulary at ilang structural feature |
| `structural` | Apektado ang grammar, syntax, at phonology |
| `defining` | Nabubuo ng contact ang core identity (creoles, mixed languages) |

---

## Pagsulat ng Mahuhusay na Register Preset

**Mahuhusay na preset prompt:**
- Tahasang pangalanan ang formality feature (hal., "해요체", "vous-form", "siz-form")
- Ipaliwanag ang partikular na pronoun o verb form na gagamitin
- Magbigay ng context kung kailan angkop ang register na ito
- Banggitin ang mga konsiderasyon sa script kung applicable

**Huwag** ilagay ang gender-inclusive guidance sa preset prompt. Ang gender guidance
ay kabilang sa `card.gender.inclusiveGuidance` — hiwalay itong ini-inject.

```
❌ Bad:  "Standard Thai. Professional register."
✔ Good: "Professional Thai. Use คุณ (khun) for second person, เรา (rao)
         for first person when needed. Clear, concise phrasing
         appropriate for digital interfaces."
```

### Preset Naming Convention

Dapat descriptive at lowercase-hyphenated ang mga preset key:
- Mga T-V language: `formal-vous`, `informal-tu`, `formal-Sie`, `casual-du`
- Speech levels: `polite-haeyo`, `formal-hapsyo`, `casual-hae`
- Neutral: `professional`, `neutral-professional`
- Code-switching: `taglish-professional`, `pure-filipino`

---

## Paano Naa-update ang mga Katotohanan ng Card

Ang mga card ay **build output** — isang deterministic na projection mula sa mga naka-pin na upstream snapshot. Wala nang per-card na enrichment procedure: ang hand-run na `enrich-*` script lane ay inalis na, at ang isang pag-edit na direktang ginawa sa isang card file ay dine-delete ng susunod na build. Upang baguhin ang isang katotohanan:

1. **Irehistro ang desisyon.** Ang bawat field ay isang row sa decision registry ng build: kung aling upstream parameter ang nagpapakain dito, kung paano ito nagpo-project, at kung ano ang ibig sabihin ng isang absent na value.
2. **Ayusin ang ingest layer.** Ang isang maling value ay isang depekto sa source handler (o isang lumang upstream pin), hindi kailanman isang bagay na ipa-patch sa card.
3. **Muling buuin at i-cut over.** Muling pino-project ng build ang bawat card mula sa mga naka-pin na snapshot; tinatanggihan ng mga gate ang mga partial build, mga null/empty na value, at mga card na bumabagsak sa mga integrity rule.

### Conflict Handling

Kapag hindi sumasang-ayon ang mga source:
1. **Iimbak ang lahat ng mga ito** na may source attribution — iyan ang layunin ng attribution envelope
2. **HUWAG kumuha ng average** o pumanig — lumalabas lamang ang `consensus` kapag aktwal na sumasang-ayon ang mga source
3. **Dalhin ang mga caveat ng bawat source** nang verbatim sa `note` ng value na iyon
4. Ang isang value para sa display o computation ay **hinahango ng adapter** mula sa idineklarang authority order — pinapanatili ng card mismo ang buong spread

---

## Validation

Patakbuhin ang linter pagkatapos ng anumang rebuild:

```bash
node scripts/lint-language-cards.mjs              # all cards
node scripts/lint-language-cards.mjs --lang crk    # single card
```

### PR Checklist

Kapag nagsusumite ng isang pagbabago na gumagalaw sa mga card (tandaan: baguhin ang build, hindi ang card):

- [ ] Ang pag-aayos ay nasa isang ingest handler o sa decision registry — walang card file ang hand-edited
- [ ] Ang mga field ay nagtataglay lamang ng mga source-asserted na value — walang idinagdag sa `null` o
      `[]` upang "kumpletuhin" ang isang card
- [ ] Ang `classification` ay nagmumula sa Glottolog (hindi hand-built)
- [ ] Ang provenance ng bawat ginalaw na field ay napupunta sa `_fieldSources`, kung saan ang mga value na kinompyut ng Champollion ay nagtataglay ng `champollion-derived` provenance
- [ ] Walang nasukat na score ng method output ang lumalabas saanman sa isang card
- [ ] Pumasa ang linter at card-integrity gate nang walang mga error

---

## Professional References

| Standard | Pinapanatili Ng | Aming Gamit |
|----------|-----------------|-------------|
| [ISO 639-3](https://iso639-3.sil.org) | SIL International | Canonical language codes, macrolanguage relationships |
| [Glottolog](https://glottolog.org) | Max Planck Institute | Classification, coordinates, AES endangerment |
| [WALS](https://wals.info) | Max Planck Institute | Genus definitions, typological features |
| [ISO 15924](https://unicode.org/iso15924/) | Unicode/ISO | Script codes |
| [CLDR](https://cldr.unicode.org) | Unicode Consortium | Locale data, plural rules, typography |
| [Wikidata](https://www.wikidata.org) | Wikimedia Foundation | Speaker counts, endonyms, script data |
| [Ethnologue](https://www.ethnologue.com) | SIL International | EGIDS, speaker estimates, DLS |
| [UNESCO Atlas](http://www.unesco.org/languages-atlas/) | UNESCO | Endangerment classification |
| [Katig Collective](https://linguistics.upd.edu.ph/the-katig-collective/) | UP Diliman | Philippine language capsules |

Tingnan din: [Language Card Citation Procedure](/docs/reference/language-card-citation-procedure)
para sa detalyadong gabay source-by-source.
