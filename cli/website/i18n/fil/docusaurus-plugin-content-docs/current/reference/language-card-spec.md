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

> **Nag-iisang pinagmumulan ng katotohanan (Single source of truth).** Tinutukoy ng dokumentong ito ang kanonikal na anyo ng
> bawat card ng wika. Isinasaad lamang ng isang card kung ano ang isinasaad ng isang binanggit na sanggunian: ang isang
> field na walang pinagmulang sanggunian ay **tinanggal, hindi null** — ang isang nawawalang field ay nangangahulugang
> "walang sangguniang nagpahayag", at hindi kailanman "walang anumang dapat malaman". Ang machine-checkable na
> schema ay ipinapadala bilang `shared/schemas/language-card.schema.json` sa npm
> package, at ang [kanonikal na halimbawa sa ibaba](#canonical-template) ay
> nabubuo mula sa live corpus sa bawat pag-build ng site, kaya hindi maaaring
> lumihis ang pahinang ito mula sa mga card na inilalarawan nito.

## Ang muling pag-build ng atlas noong 2026-08 — ang mga nagbago sa schema na ito

Ang corpus ng card ay isa nang **build output**: bawat card ay ipinoproyekto mula sa isang imbakan
ng mga naka-pin na upstream snapshot, at muling binu-build — hindi kailanman ine-edit — kapag may
nagbagong impormasyon. Apat na bagay tungkol sa anyo ang nagbago sa muling pag-build na iyon:

1. **Ang mga pinagtatalunang field ay naglalaman ng attribution envelope.** Kung saan ang mga binanggit na sanggunian
   ay tunay na hindi sumasang-ayon, ang field ay hindi isang flat na value kundi
   `{"agreement": "...", "consensus": <value?>, "values": [{"value": ...,
   "source": "..."}]}`. This applies to `name`, `classification.family`,
   `speakerEstimates`, `endangerment`, at anumang field na naging pinagtatalunan dahil sa isang bagong sanggunian. Dapat basahin ng mga consumer ang mga card sa pamamagitan ng nai-publish na adapter
   (`normalizeCard()` sa npm package) sa halip na magpalagay ng mga flat na value —
   nilulutas ng `display()` ang isang envelope tungo sa napagkasunduang value nito at sadyang
   walang ibinabalik sa isang tunay na pagtatalo sa halip na pumili ng nanalo.

2. **Mga pinangalanang muling field.** Pinalitan ng `endonym` ang `nativeName` · Pinalitan ng `codeAliases`
   ang `aliases` · Pinalitan ng `scripts[]` (lahat ng napatunayang script) ang flat na
   `script`, kung saan ang pangunahing script ay hinango mula sa maximal na BCP 47
   tag ng card · Pinalitan ng `endangerment` (ang pagtatasa ng bawat sanggunian, sa sariling
   scale ng sangguniang iyon) ang nag-iisang object na `vitality` · Dala na ngayon ng `isoLanguageType` at
   `isoScope` ang mismong mga salita ng ISO 639-3 ("Living", "Macrolanguage")
   sa halip na mga inisyal. Mga bagong field: `modality` ("spoken"/"signed", hinango
   mula sa pinagmulang lahi ng Glottolog), `glottologBucket` (mga non-genealogical bucket ng Glottolog,
   inihiwalay sa slot ng family), `locale`/`localeScoped`.

3. **Ang mga unasserted field ay tinanggal, hindi null.** Ang isang field na walang sangguniang nagpatunay ay
   wala sa card. Ang naunang panuntunan ("bawat card ay DAPAT maglaman ng bawat
   top-level field, kahit na null") ay inalis na: ang isang walang lamang value sa isang pampublikong
   surface ay binabasa bilang isang pag-aangkin na walang dapat malaman, na hindi kapareho
   ng hindi pa pagtingin o pagsusuri.

4. **Umiiral ang mga locale card.** Kasabay ng mga card ng wika, ang mga projection ng locale
   (`fra-CA`, `cmn-Hant`) ay nagdadala ng mga katotohanan ng kanilang wika na nilutas para sa isang
   teritoryo o script, na tinutukoy ng isang block na `locale: {language, region, script}`.
   Ang isang locale ay hindi isang wika: ibukod ang mga locale mula sa mga bilang ng wika gamit
   ang block na iyon.

## Mga Prinsipyo ng Disenyo

1. **Isanggunian ang lahat.** Bawat makatotohanang pahayag ay nagmumula sa isang pinangalanan, may bersyon, at
   pangunahing sanggunian. Ang mga pahayag na walang sanggunian ay mga pahayag na hindi mabeberipika. Ginagawang
   hayag ng `_fieldSources` map (at ng per-field na mga anotasyon ng `source` sa mga sub-object)
   ang pinagmulan (provenance).

2. **Panatilihin ang hindi pagkakasundo.** Kapag hindi nagkakasundo ang mga awtoridad (sinasabi ng isang sanggunian
   na 50,000 ang mga nagsasalita, sinasabi ng isa pa na 20,000), iniimbak ng card ang *pareho* na may attribution
   sa sanggunian — ang anyo ng envelope sa itaas. Hindi kami nag-a-average, nagreresolba, o
   pumapanig. Maaaring siyasatin ng mga gumagamit ang mga pagkakaibang ito.

3. **Ang wala ay nangangahulugang unasserted.** Ang isang nawawalang field ay nangangahulugang walang sangguniang nagpapatunay
   ng isang value. Kapag ang isang katangian ay tunay na hindi naaangkop (hal., grammatical gender
   para sa isang wikang wala nito), tahasang sinasabi ito ng binanggit na value sa halip na
   maging blangko.

4. **Muling binu-build, hindi kailanman pini-patch.** Ang mga card ay ipinoproyekto mula sa mga naka-pin na sanggunian sa pamamagitan ng isang
   deterministic na build. Ang isang depekto sa impormasyon ay itinatama sa source handler nito at ang
   corpus ay muling binu-build — walang in-place na pag-edit, walang merge-only na enrichment layer.

---

## Three-Layer Architecture

| Layer | Lokasyon | Layunin |
|-------|----------|---------|
| **Language cards** | `shared/language-cards/<code>.json` | Per-language configuration: identity, classification, resources, lahat |
| **Genus cards** | `shared/language-cards/genera/<genus>.json` | Mga shared runtime property para sa magkakaugnay na wika (curated, hindi auto-generated) |
| **Language tree** | `shared/language-cards/language-tree.json` | Buong hierarchy ng Glottolog — reference data para sa Lab UI at language discovery |

---

## Inheritance Model

> **Karamihan ay pangkasaysayan na lamang mula noong muling pag-build ng atlas.** Wala nang card ng wika sa disk
> ang nagdadala ng `extends` — bawat card ay ganap na naisasakatuparan (materialized) ng build,
> dahil ang minanang prosa ay hindi masanggunian (ang isang pahayag sa antas ng pamilya ay nagtataglay ng
> address sa antas ng wika). Ang mekanismo mismo ay nananatili sa isang lugar: ipinapadala ng offline bundle
> ng npm package ang mga locale card bilang mga compact na `extends` delta
> laban sa kanilang wika, na nilulutas sa pamamagitan ng parehong merge na inilarawan dito.

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

> **Binuo, hindi isinulat nang manu-mano.** Ang lahat sa seksyong ito ay hinango mula sa
> live corpus sa oras ng pag-build: ang buong card ng `crk` (Plains Cree), byte-for-byte,
> kasama ang isang sipi ng locale na `fra-CA`. Kapag muling binuo ang corpus, muling
> hinahango ng susunod na build ng site ang pahinang ito. Walang natitirang template na manu-manong
> pinapanatili na maaaring mapag-iwanan sa panahon — ang nauna ay nahuli nang isang buong henerasyon ng schema
> sa likod ng mga card at inalis noong 2026-08-16.

Ipinapakita ng halimbawa ang **anyo sa disk (on-disk shape)** — ang makukuha ninyo kung bubuksan ninyo ang file.
Dapat pa ring basahin ng mga consumer ang mga card sa pamamagitan ng nai-publish na adapter
(`normalizeCard()` sa npm package): nilulutas nito ang mga envelope, pinag-uugnay ang mga
pangalan bago ang cutover, at hinahango ang mga value na display-only (primary script,
vitality tier) na sadyang hindi dinadala ng raw card.

Mga dapat pansinin habang nagbabasa:

1. **Mga attribution envelope.** Ang bawat isa sa `name`, `classification.family`,
   `endangerment`, `speakerEstimates`, `endonym`, `bcp47FullTag`, at
   `politenessDistinction` ay may dalang `{agreement, consensus?, values:
   [{value, source}]}`, every value attributed to its source. `endangerment`
   na may `"agreement": "incommensurable"`: sumusukat ang mga sanggunian nito sa magkakaibang
   scale, kaya ipinapahayag ng bawat value ang `scale` nito sa halip na i-convert sa scale
   ng isang nanalo.

2. **Ang tinanggal ay nangangahulugang unasserted.** Ang card ay walang `iso639_1` (ang Plains Cree ay
   walang ISO 639-1 code) at walang `phonologicalInventory` (walang na-ingest na sangguniang
   nagpapatunay nito) — ang mga field na iyon ay sadyang wala, hindi kailanman `null` o `[]`.

3. **Ang provenance ay isang first-class layer.** Isinasaayos ng `_fieldSources` ang bawat field patungo sa
   (mga) sangguniang nagpatunay nito, kung saan minamarkahan ng `champollion-derived-v1`
   ang mga value na kinalkula ng Champollion. Tinatatakan ng `_card` ang uri, id, rebisyon ng card,
   at kung aling mga field ang maaaring baguhin ng correction lane; tinatatakan naman ng `_atlas` ang corpus
   release.

4. **Walang mga run result.** Walang anuman sa card ang isang nasukat na marka (score) ng output
   ng pamamaraan — ang chrF, mga FST acceptance rate, at mga katulad nito ay mga run result na naka-key
   ayon sa (method, dataset, metric) at matatagpuan sa leaderboard. Isinasaad lamang ng card na ang mga resource ay *umiiral* (`resources`, `lexicalResources`,
   `methodSupport`).

<CardSpecExample variant="language" />

### Ang isang locale card ay isang projection, hindi isang wika \{#locale-card-example}

Kahanay ng mga card ng wika ang mga locale card (`fra-CA`, `cmn-Hant`): ang mga katotohanan
ng isang wika na **nilutas para sa isang teritoryo o script**, na tinutukoy ng kanilang block na
`locale` — hindi kailanman sa pamamagitan ng anyo ng code. Minamana ng isang locale card ang mga katotohanan
ng wika nito, nilulutas ang mga nakasaklaw sa script at teritoryo (`script`,
`localeScoped`), at **hindi isang wika**: ibukod ang mga locale card mula sa bawat
bilang ng wika at listahan bawat wika gamit ang block na `locale`.

<CardSpecExample variant="locale" />

---

## Sanggunian ng Field \{#field-reference}

Dalawang kombensiyon ang nalalapat sa bawat talahanayan sa ibaba:

- Ang **"envelope"** ay nangangahulugang isang attribution envelope — `{agreement, consensus?,
  values: [{value, source, note?, scale?}]}` — na nagdadala ng pahayag ng *bawat*
  sanggunian. Ang isang field na nakalista bilang `envelope` ay maaaring lumabas bilang isang flat value sa mga card
  kung saan isang sanggunian lamang ang nagpapahayag (halimbawa, ang mga languoid na Glottolog-only ay nagdadala ng
  flat na `name`); dapat pangasiwaan ng mga consumer ang pareho, na siyang ginagawa ng nai-publish na
  adapter.
- Walang field na kinakailangan maliban sa `code` at `name`; ang lahat ng iba pa ay
  **tinatanggal kapag walang sangguniang nagpatunay nito**. Ang (mga) nagpapatunay na sanggunian ng bawat field
  ay itinatala bawat card sa `_fieldSources`, kaya inilalarawan ng mga talahanayan ang
  *uri* ng sanggunian sa halip na mag-pin ng mga bersyon na maaaring magbago sa paglipas ng panahon.

### § 1. Identity Fields

| Field | Anyo | Mga Tala |
|-------|------|----------|
| `code` | `string` | **Kinakailangan.** Ang ID at filename ng card. ISO 639-3 para sa mga card ng wika (`crk`); ang mga languoid na Glottolog-only ay nagdadala ng kanilang glottocode; ang mga locale card ay nagdadala ng locale code (`fra-CA`). |
| `name` | envelope | **Kinakailangan.** Pangalang sanggunian sa Ingles (ISO 639-3 registry, LinguaMeta, Glottolog). |
| `endonym` | envelope | Pinalitan ang `nativeName`. Ang tawag ng mga nagsasalita sa wika, sa mismong wika (LinguaMeta, Wikidata). Wala kapag walang sangguniang nagpapatunay nito — ang endonym ay hindi kailanman iniimbento o tinatranslitera namin. |
| `alternateNames` | `string[]` | Iba pang napatunayang mga pangalan sa Ingles. |
| `iso639_1` | `string` | Naroroon lamang kapag mayroong dalawang-titik na ISO 639-1 code (`fra` → `"fr"`). |
| `isoScope` | `string` | Mismong mga salita ng ISO 639-3 — `"Individual"`, `"Macrolanguage"`, `"Special"` (pinalitan ang mga inisyal na `"I"`/`"M"`/`"S"`). |
| `isoLanguageType` | `string` | Pinalitan ang `isoType`. Mismong mga salita ng ISO 639-3 — `"Living"`, `"Extinct"`, `"Ancient"`, `"Historical"`, `"Constructed"`. |
| `macrolanguage` | `string` | Ang macrolanguage kung saan nabibilang ang wikang ito (`crk` → `"cre"`). Mga mapping ng macrolanguage ng ISO 639-3. |
| `macrolanguageMembers` | `string[]` | Sa mga hub card ng macrolanguage: ang indibidwal na mga code ng miyembro (`nor` → `["nno", "nob"]`). |
| `canonicalisedMembers` | envelope | Sa mga card ng macrolanguage: mga miyembro na ang mga tag ay itinitiklop ng mga BCP 47 registry sa tag ng macrolanguage na ito (CLDR alias table + SIL langtags, bawat isa ay may attribution). |
| `supersededCodes` | `string[]` | Mga retiradong ISO 639-3 code na idinidirekta na ngayon ng SIL sa wikang ito — nakatala sa kahalili upang ang mga corpus na nai-publish sa ilalim ng lumang code ay patuloy na malutas. |
| `codeAliases` | `string[]` | Pinalitan ang `aliases`. Mga code-level na identifier na lumulutas sa card na ito. |
| `bcp47` | `string` | Ang BCP 47 tag ng wika ayon sa ipinahayag (LinguaMeta). |
| `bcp47Tag` | envelope | Hinango ng Champollion: ang RFC 5646 tag (ang pinakamaikling ISO 639 code ang mananalo). |
| `bcp47FullTag` | envelope | Ang maximal na anyong wika–script–rehiyon (CLDR likelySubtags + SIL langtags). Hinahango ng adapter ang **pangunahing script** mula sa tag na ito. |
| `modality` | `string` | `"spoken"` o `"signed"`, hinango mula sa pinagmulang lahi ng Glottolog. Ang pagsulat ay katangian ng ortograpiya, hindi modality — ang isang hindi nakasulat na wika ay ganap pa ring sinasalita o isinesenyas. |
| `locale` | `object` | **Mga locale card lamang.** `{language, region, script, publishedTag, source, note}` — ANG pagkakakilanlan ng locale. Ibukod ang mga locale card mula sa mga bilang ng wika gamit ang block na ito, hindi kailanman ayon sa anyo ng code. |
| `localeScoped` | `object` | Mga locale card lamang: mga value na nilutas para sa teritoryo/script ng locale (hal. `scriptName`, `cldrOfficialStatus`). |

### § 2. Classification Fields

| Field | Anyo | Mga Tala |
|-------|------|----------|
| `glottocode` | `string` | Identifier ng Glottolog para sa languoid na ito (`crk` → `"plai1258"`). Ang mga languoid na Glottolog-only — mga wikang itinala ng Glottolog na wala sa ISO 639-3 — ay gumagamit ng glottocode bilang kanilang `code` ng card. |
| `classification` | `object` | Container para sa mga placement field sa ibaba. Ang bawat isa ay may independiyenteng sanggunian at independiyenteng tinanggal — ang isang isolate, o isang wikang nakatala sa isang Glottolog bucket, ay lehitimong nagdadala lamang ng bahagi ng object na ito. |
| `classification.family` | envelope | Ang top-level family na pinatutunayan ng bawat awtoridad sa klasipikasyon. Ang Glottolog at WALS ay magkahiwalay na taxonomy na hindi palaging sumasang-ayon, kaya pareho silang pinapanatili at binibigyan ng attribution. Sinusuri ng lint rule R5 ang value ng Glottolog sa loob ng envelope laban sa sariling tree ng Glottolog: maaaring hindi sumang-ayon ang WALS sa Glottolog, ngunit hindi maaaring maliin ang pagbanggit sa Glottolog. Ang mga isolate ay walang dalang pamilya. |
| `classification.familyGlottocode` | `string` | Glottocode ng top-level family na iyon (`crk` → `"algi1248"`). |
| `classification.genus` | `string` | Intermediate classification node ng WALS (`crk` → `"Algonquian"`). Isang konsepto ng WALS, **hindi** ng Glottolog — naglalathala ang Glottolog ng isang arbitrary-depth tree na walang antas ng genus — kaya naroroon lamang ito kung saan kino-code ng WALS ang wika. |
| `classification.ancestry` | `string[]` | Descent path ng Glottolog bilang mga glottocode ng ninuno, una ang ugat (`["algi1248", …, "plai1264"]`). Ang pagkakasunod-sunod **ang** mismong pahayag: ito ay isang path, hindi kailanman isang alpabetisadong set. |
| `classification.glottologBucket` | `string` | Mga non-genealogical bucket ng Glottolog — `"Artificial Language"`, `"Pidgin"`, `"Mixed Language"`, `"Speech Register"`, `"Unclassifiable"`, `"Unattested"`. Inihiwalay sa slot ng family dahil nag-uuri ang bucket ayon sa uri, hindi ayon sa pinagmulan: ang isang card na may bucket ay walang family, at iyon ang tapat na resulta. |
| `isIsolate` | `boolean` | Kung inuuri ba ng Glottolog ang wikang ito bilang isang isolate. |

Ang card bago ang cutover ay nagdala rin ng isang `genusGlottocode`. Inalis na ito kasama
ng category error na nagdulot nito: ang genus ay konsepto ng WALS, at
ang pagbibihis dito sa isang identifier ng Glottolog ay nagpahayag ng isang tree node na wala sa
Glottolog. Ang hierarchy ng Glottolog ay dinadala na ngayon ng `ancestry`.

### § 3. Geography Fields

| Field | Anyo | Mga Tala |
|-------|------|----------|
| `macroarea` | `string` | Macroarea ng Glottolog — `"Africa"`, `"Australia"`, `"Eurasia"`, `"North America"`, `"Papunesia"` o `"South America"`. |
| `coordinates` | `object` | `{lat, lng}` — Kinatawang punto ng Glottolog. Isang punto, hindi isang teritoryo: inilalagay nito ang wika sa isang mapa at walang inaangkin tungkol sa lawak o mga hangganan. |
| `countries` | `string[]` | Mga ISO 3166-1 alpha-2 code ng mga bansang iniuugnay ng Glottolog sa wika (`["CA", "US"]`). |
| `cldrOfficialStatus` | `string` | Isang opisyal na katayuan na ibinibigay ng ilang teritoryo sa wika, ayon sa itinala ng CLDR (dinadala sa pamamagitan ng LinguaMeta) — `"Official"`, `"Regional official"`. Sa isang locale card, ang katayuang nilutas para sa teritoryo ng *locale na iyon* ay nasa `localeScoped.cldrOfficialStatus`. |

Ang array na `regions` bago ang cutover (mga breakdown ng nagsasalita bawat bansa na may mga admin
code) at `arealContext` (membership sa Sprachbund) ay inalis na: walang na-ingest
na sangguniang nagpapatunay sa mga ito, at ang curation na walang sanggunian ay hindi nananatili sa isang muling pag-build.
Maaaring bumalik ang mga pahayag ukol sa nagsasalita sa antas ng rehiyon sa araw na magkaroon ng masangguniang pinagmulan sa
pipeline; hanggang noon, ang kawalan nito ang tapat na kalagayan.

### § 4. Writing System Fields

| Field | Anyo | Mga Tala |
|-------|------|----------|
| `scripts` | `string[]` | Pinalitan ang flat na `script`. **Lahat** ng napatunayang ISO 15924 code (`crk` → `["Cans", "Latn"]`), walang partikular na pagkakasunod-sunod — huwag kailanman basahin ang `scripts[0]` bilang "ang" tanging script. Ang pangunahing script ay hinango ng adapter mula sa maximal tag ng `bcp47FullTag`. |
| `scriptNames` | `string[]` | Mga display name na hinango ng Champollion para sa `scripts[]` (`"Unified Canadian Aboriginal Syllabics"`). |
| `textDirection` | `string` | Pinalitan ang `dir`. Mismong mga salita ng sanggunian — `"left-to-right"` / `"right-to-left"` (dating `"ltr"`/`"rtl"`). |
| `suppressScript` | `string` | CLDR Suppress-Script: ang script na lubhang kanonikal para sa wika kaya tinatanggal ito ng mga BCP 47 tag (`fra` → `"Latn"`). |
| `script` | `string` | **Mga locale card lamang**: ang script na nilutas para sa locale (`fra-CA` → `"Latn"`, `cmn-Hant` → `"Hant"`). Ang mga card ng wika ay walang dalang flat na script field. |

Ang isang wikang walang napatunayang sistema ng pagsulat ay sadyang **walang field na `scripts`** —
ang kawalan ay nangangahulugang walang sangguniang nagpatunay ng script, hindi isang pag-aangkin na ang wika ay
"walang pasulat na anyo". (Ang mga sign language ang pinakamalaking grupong ganito: walang sistema ng notasyon
ang may community-standard na paggamit para sa pang-araw-araw na literasiya.)

### § 5. Mga Field ng Demograpiko at Kasiglahan (Vitality)

| Field | Anyo | Mga Tala |
|-------|------|----------|
| `speakerEstimates` | envelope | Pagtatantya ng bawat sanggunian, may attribution. Ang mga value ay maaaring eksaktong bilang o mismong mga range string ng sanggunian (`"10000-99999"`), kung saan ang mga caveat ng sanggunian ay buong tapat na dinadala sa `note`. Karaniwan ang `"agreement": "conflicting"` — ang pagpapakita ng salungatan *ang* mismong produkto; walang ini-average o pinipili. |
| `endangerment` | envelope | Pinalitan ang nag-iisang object na `vitality`. Pagtatasa ng bawat sanggunian **sa sariling scale ng sangguniang iyon** — bawat value ay may dalang field na `scale`, at karaniwan ang `"agreement": "incommensurable"` dahil ang mga bokabularyo ng ELCat, Glottolog AES, at LinguaMeta ay hindi mga salin ng isa't isa. Hinahango ng adapter ang isang display na *vitality tier* mula sa isang pinangalanang sanggunian ayon sa idineklarang authority order; ang tier na iyon ay display-only — ang buong attributed set ay nananatili sa card. |

Ang isang *ipinapakitang* bilang ng tagapagsalita saanman sa Champollion ay dapat tumugma sa isa sa
mga binanggit na entry ng `speakerEstimates` o magdala ng hayag na provenance ng
`champollion-derived` — ipinapatupad ng mga panuntunan sa integridad ng card (card-integrity rules).

### § 5.5 Mga Field ng Dokumentasyon at Digital Presence

| Field | Anyo | Mga Tala |
|-------|------|----------|
| `documentation` | `object` | Pinalitan ang `documentationDepth`. Tala ng Glottolog kung gaano kahusay na nailarawan ang wika, sa sariling mga termino ng Glottolog. |
| `documentation.medLevel` | `string` | Antas ng Most Extensive Description ng Glottolog, verbatim — `"long grammar"`, `"grammar"`, `"grammar sketch"`, `"phonology"`, `"wordlist"`. |
| `documentation.medSourceId` | `string` | Ang bibliographic key ng pinakamalawak na paglalarawang iyon sa reference catalogue ng Glottolog. |
| `documentation.firstDocumented` | `number` | Mismong first-year-of-documentation column ng Glottolog, verbatim — inilipat dito mula sa pre-cutover na top-level field. Naroroon lamang sa ilang daang wika, at ang pagiging madalang nito ay mahalagang malaman. |
| `documentation.lastDocumented` | `number` | Mismong last-year-of-documentation column ng Glottolog, verbatim — naroroon sa humigit-kumulang isang libong wika. |
| `wikipediaEdition` | `object` | Pinalitan ang `digitalPresence`. `{site, url, name}` — mayroong bukas na edisyon ng Wikipedia sa wikang ito (`afr` → `af.wikipedia.org`). Pag-iral lamang, sadyang **walang bilang ng artikulo**: maraming edisyon ang karaniwang binuo ng bot, at ang isang malaking edisyon ay hindi "mas mahusay na nadokumento" kaysa sa isang maliit sa anumang paraang magagamit ng tagasalin. |
| `dialectCount` | `number` | Mismong `child_dialect_count` column ng Glottolog, verbatim — mga direktang child dialect lamang, hindi ang buong subtree. Ito ay pahayag ng Glottolog, hindi ang aming aritmetika: tinatakan ito ng isang naunang panuntunan bilang `champollion-derived` at naging dahilan upang akuin ng libu-libong card ang bilang ng Glottolog. |

Ang nalalabi sa `digitalPresence` block bago ang cutover (mga oras ng Common Voice,
bilang ng pangungusap sa Tatoeba) ay inalis hanggang sa mapabilang ang mga sangguniang iyon sa pipeline —
ang Tatoeba corpus mismo ay lumalabas na kung saan ito nararapat, bilang isang parallel
corpus sa ilalim ng `resources.corpora` (§ 9).

### § 6. Mga Field ng Pormalidad, Rehistro at Kasarian (Gender)

Eksaktong isang field lamang ang dinadala ng projected corpus dito — ang binanggit na katotohanan:

| Field | Anyo | Mga Tala |
|-------|------|----------|
| `politenessDistinction` | envelope | Kung ginagawang gramatikal ng wika ang pagiging magalang sa mga anyo ng ikalawang panauhan. May attribution sa Grambank GB415 (binary: absent/present) at WALS 45A (apat na antas: no distinction / binary / multiple / pronouns avoided). Magkaibang scale ang mga iyon, kaya pinapangalanan ng bawat value ang `scale` nito at iniuulat ng envelope ang mga ito bilang **incommensurable** sa halip na bilang isang hindi pagkakasundo. |

**Ang sistema ng rehistro ay pagsasaayos (configuration), hindi isang katotohanan sa card.** Nag-imbak ang corpus
bago ang cutover ng prosang `formality` at mga prompt ng `registers` sa halos isang libo
at walong daang card bawat isa — halos lahat ng ito ay nabuo mula sa parehong dalawang sanggunian
sa itaas, pagkatapos ay dinala na parang ito ay manu-manong na-curate na configuration. Pinapanatili
ng atlas ang katotohanan; ang mga configuration surface — `formality`, `registers`,
`gender`, `codeSwitching` — ay nananatiling bahagi ng **curated schema ng npm
package** (`language-card.schema.json`), matatagpuan sa mga curated na genus/family hub
card, at nakakarating sa CLI sa pamamagitan ng `extends` merge ng sistema ng rehistro
na inilarawan sa [Modelo ng Pagmamana (Inheritance Model)](#inheritance-model). Hindi ang mga ito
projected atlas field: walang card sa projected corpus ang nagdadala sa mga ito, at hindi kailanman
isusulat ng build ng atlas ang mga ito. Ang gabay sa
[Pagsusulat ng Mahuhusay na Register Preset](#writing-good-register-presets) ay nalalapat sa
curated lane na iyon.

### § 7. Linguistic Profile Fields

| Field | Anyo | Mga Tala |
|-------|------|----------|
| `typologicalProfile` | `object` | Isang key bawat na-ingest na typological feature, bawat value ay ang sariling coding ng sanggunian, bawat key ay naroroon lamang kung saan kino-code ng sanggunian ang wikang ito. Ang mga boolean ay nagmumula sa mga feature ng Grambank, ang mga category string ay mula sa mga kabanata ng WALS; pinapangalanan ng decision registry ang eksaktong upstream parameter para sa bawat key. |
| `phonologicalInventory` | `object` | `{consonants, vowels, tones, totalPhonemes, hasTone}` — mga bilang na kinalkula ng Champollion batay sa isang binanggit na imbentaryo ng PHOIBLE (naglalathala ang PHOIBLE ng isang row bawat segment at hindi nagpapatunay ng mga bilang), kaya bawat value ay may dalang provenance na `champollion-derived`. **Ang PHOIBLE ang nag-iisang awtoridad sa tono** (lint R1): walang tone feature ang Grambank, at wala nang iba pa sa card ang maaaring mag-angkin ng tonality. |
| `numeralSystem` | `object` | `{base}` — ang numeral base, verbatim mula sa *Numeral Systems of the World's Languages* ni Chan (`"decimal"`, `"quinary-vigesimal"`, `"body tally"`; halos isang daang natatanging value). Wala kapag walang laman ang sariling base column ni Chan — humigit-kumulang kalahati ng mga sinuring wika — dahil pinunuan ng isang dating generator ang puwang ng `"decimal"` at nag-imbento ng mga value para sa dalawang libong wika. |
| `pluralCategories` | `string[]` | Ang mga kategorya ng cardinal plural na isinasaad ng CLDR para sa wikang ito — kinikilala ng Arabic ang `["zero", "one", "two", "few", "many", "other"]`, tatlo sa mga ito ang sa French, isa sa Chinese. Binabasa mula sa mga key ng sariling rule set ng CLDR, kaya ito ay pahayag ng CLDR, hindi ang aming derivation. Pinalitan ang `rules.plurals.categories` bago ang cutover; kailangan ito ng isang pipeline ng i18n upang malaman kung ilang plural form ang dapat ibigay ng isang mensahe. |

Ang mga key ng `typologicalProfile` na kasalukuyang ipinoproyekto, kasama ang kanilang mga upstream
parameter:

- **Mga kabanata ng WALS** (mga category string, sariling value label ng WALS): `fusion`
  (20A), `verbSynthesis` (22A), `affixPreference` (26A), `reduplication`
  (27A), `genderCount` (30A), `caseCount` (49A), `wordOrder` (81A),
  `subjectVerbOrder` (82A), `verbalAlignment` (100A), `negationOrder` (143A)
- **Mga feature ng Grambank** (mga boolean): `hasGenderInPronouns` (GB030),
  `hasSexBasedGender` (GB051), `hasNumeralClassifiers` (GB057), `hasCoreCase`
  (GB070), `hasObliqueCase` (GB072), `marksPastTense` (GB083),
  `marksPresentTense` (GB082)

Ang mga block na `linguisticChallenges` at `contactInfluences` bago ang cutover ay hindi
ipinoproyekto — ang nasaliksik na prosa na walang na-ingest na sanggunian ay nananatili sa
curated schema ng npm package, tulad ng mga register surface sa § 6 (nagsisilbi sa lane na
iyon ang mga talahanayan ng [Mga Uri ng Impluwensya sa Pakikipag-ugnayan (Contact Influence Types)](#contact-influence-types) sa ibaba).
Inalis na ang block na `rules`: ang masasanggunian dito ay nananatili bilang
`pluralCategories` dito at sa mga field ng script sa § 4.

### § 8. Encyclopedic Fields

Inalis mula sa mga card. Ang mga block bago ang cutover na `encyclopedic` (mga sanaysay sa kasaysayan at diyalekto,
mga institusyonal na link), `culturalAphorism`, at `varieties` ay mga manu-manong
curated na prosa sa antas ng card, na sadyang binubura ng muling pag-build ayon sa disenyo nito. Ang mga
katotohanan sa pagiging miyembro na tinukoy ng `varieties` ay mga binanggit na identity field na ngayon
(§ 1 `macrolanguageMembers` at `canonicalisedMembers`), at ang saklaw ng tool para sa bawat baryasyon
ay sinasagot ng sariling card ng bawat miyembro (`methodSupport`,
`resources`). Maaaring maibalik ang isang kinatawang kasabihan sa pamamagitan ng isang community
contribution lane na may pahintulot at pagbanggit sa sanggunian; hindi ito maibabalik bilang isang
field sa card na walang sanggunian.

### § 9. Digital Resource Fields

Ang lahat sa seksyong ito ay nagpapatunay ng **pag-iral at kakayahan, hindi kailanman
kalidad**: na ang isang resource ay nai-publish at kung sino ang nag-publish nito — hindi kailanman na ito
ay maganda, kumpleto, o magagamit, at hindi kailanman isang nasukat na marka (score). Ang anumang nasukat na marka
ng output ng pamamaraan ay isang run result na naka-key ayon sa (method, dataset, metric), matatagpuan sa
leaderboard, at ipinagbabawal sa mga card (lint R3).

| Field | Anyo | Mga Tala |
|-------|------|----------|
| `resources` | `object` | Container: bawat subfield sa ibaba ay isang listahang may independiyenteng sanggunian, tinanggal kapag walang sangguniang nagpapatunay nito. |
| `resources.fsts` | `object[]` | Mga nai-publish na finite-state morphological analyser: `{name, url, publisher, license, licenceEstablished, archived}`. Kasamang dinadala ang lisensya sa bawat entry sa halip na ipalagay na pare-pareho sa buong catalogue — kailangan sa mga hangganan ng lisensya ang aktwal na mga tuntunin. Para sa isang polysynthetic na wika, ang isang FST ay madalas na siyang tanging umiiral na structural check. |
| `resources.corpora` | `object[]` | Mga parallel corpora na nagpapatunay sa wikang ito: `{corpus, corpusId, pairCount, topPartners, alignmentPairsTotal, …}`. Isinasaad sa pamamagitan ng **mga pares**, dahil ang isang parallel corpus ay nagpapatunay lamang sa isang wika sa pamamagitan ng isang pares — ang "sumasaklaw sa Swahili" nang hindi sinasabi kung laban sa ano ay sumasagot sa isang tanong na walang nagtanong. Pag-iral at laki, hindi kailanman kalidad. |
| `resources.monolingualCorpora` | `object[]` | Mga monolingual corpora — pinanatiling hiwalay mula sa `corpora` upang ang "mayroong corpus" ay hindi kailanman mangahulugan ng dalawang bagay na hindi maihahambing. |
| `resources.speech` | `object[]` | Mga nai-publish na speech resource. Pag-iral lamang. |
| `resources.keyboards` | `object[]` | Mga nai-publish na keyboard layout. Payak ngunit napakahalaga: para sa isang ortograpiyang nangangailangan ng mga character na hindi nagagawa ng karaniwang layout, ang isang layout ang pagkakaiba sa pagitan ng pagiging maitatype at hindi ng wika. |
| `resources.typology` | `object[]` | Mga typological dataset na *nagko-code* sa wikang ito, kasama ang saklaw: `{dataset, featuresCoded, datasetFeatureTotal}`. Pag-iral at saklaw, hindi kailanman nilalaman — ang sinasabi ng isang feature ay nananatiling wala sa card hanggang sa may taong sumulat ng parameter map na tumatanggap dito (ang mga tinanggap ay lumalabas sa `typologicalProfile` ng § 7). Ang mga bilang ng feature ay aming aritmetika, kaya nagdadala ang mga ito ng provenance na `champollion-derived`. |
| `lexicalResources` | `object` | Container para sa mga katotohanan ng leksikal na pag-iral. |
| `lexicalResources.datasets` | `object[]` | Mga nai-publish na wordlist kasama ang kanilang saklaw: `{dataset, forms, concepts, release}`. |
| `lexicalResources.dictionaries` | `object[]` | Mga nai-publish na diksyonaryo — pag-iral, hindi kailanman kalidad, at **may direksyon (directed)** kung saan idinidirekta ng publisher: ang isang diksyonaryong papunta sa isang direksyon ay ibang resource kaysa sa papunta sa kabilang direksyon. Ang mga entry ay hindi pare-pareho ang anyo (alam ng isang CLDF dataset ang bilang ng entry nito; alam ng isang repository ang pares at direksyon nito); pinapangalanan ng bawat isa ang sarili nitong sanggunian, at ang lisensya at katayuang naka-archive ay kasamang dinadala bawat entry. |
| `lexicalResources.colexificationConcepts` / `colexifyingForms` | `number` | Mga bilang na kinalkula ng Champollion batay sa CLICS³: mga konseptong napatunayan para sa wikang ito, at mga anyo na nagmamapa sa dalawa o higit pang magkakaibang konsepto. `champollion-derived`. |
| `methodSupport` | `object` | Aling mga paraan ng pagsasalin ang sumasaklaw sa wikang ito — kakayahan, hindi kailanman isang marka (score). Anyo: `{total, byTier, named, truncated}`. Ang English ay nagdadala ng libu-libong edge ng pamamaraan at ang median na wika ay humigit-kumulang dalawampu, kaya hawak ng card ang *anyo* ng ebidensya — `total` kasama ang mga bilang ng `byTier` bawat confidence tier (`fetched`, `partially-confirmed`, `model-card-declared`) — at pinapangalanan lamang ang pinakamalakas na mga entry (bawat isa ay `{value, variant, source, confidence}`), na may limitasyon (capped). Ang mga **serbisyo** sa registry ay palaging buong pinapangalanan, lampas sa limitasyon, kaya ang kawalan ng isang serbisyo mula sa `named` ay isang tunay na sagot; ang kawalan ng entry ng model-card ay nangangahulugan lamang na "wala sa mga pinakamalakas", at bawat edge ay nananatiling nasasaliksik sa imbakan ng atlas. |
| `metricModelSupport` | envelope | Mga modelo ng evaluation metric na naglalathala ng saklaw sa wikang ito, kasama ang model identifier na nilo-load ng isang harness (`masakhane/africomet-mtl`). Nagpapatakbo ng totoong gawi — pagpili ng modelo ng COMET — at nananatiling kakayahan, hindi kailanman isang marka (score). |

**Isinama sa mga field sa itaas:** ang mga sumusunod bago ang cutover: `keyboardSupport` (→
`resources.keyboards`), `corpusAvailability` (→ `resources.corpora` /
`resources.monolingualCorpora`), at `databaseCoverage` (→
`resources.typology` kasama ang `lexicalResources` — ang isang entry sa database ay isa nang
binanggit na katotohanan ng saklaw na may lawak, hindi isang boolean).

**Inalis mula sa mga card:** `omt1600`, `evalDatasets`, `pipelineReadiness`, at
`metricPlugins` — wala sa mga ito ang pinatutunayan ng isang na-ingest na sanggunian, at ang isang readiness
tier ay isang paghuhusga, hindi isang sanggunian.

**Na-curate, hindi ipinoproyekto:** ang mga eval-standard declaration surface
(`evalStandard`, `evalMetrics`, `evalPack`) ay nananatili sa curated schema ng npm
package. Sinasabi ng mga ito sa evaluation harness kung aling external referee package
ang nagmamarka sa isang wika (mga referee, hindi mga kalahok — walang ipinapadalang language-specific
scorer code ang harness core); binabasa ng harness ang mga ito mula sa isang card kapag
naroroon, ngunit sa kasalukuyan ay walang card sa projected corpus ang nagdadala sa mga ito, at hindi
isinusulat ng build ng atlas ang mga ito. Totoo rin ito para sa block na `install` na binabasa
ng FST installer ng harness mula sa mga entry ng `resources.fsts[]`
(`get_fst_install_info()` sa `language_cards.py`): ang mga projected entry
ay nagdadala lamang ng mga katotohanan ukol sa pag-iral.

### § 10. Provenance Fields

| Field | Anyo | Mga Tala |
|-------|------|----------|
| `_fieldSources` | `object` | Sa bawat card. Isinasaayos ang bawat field path sa card (`"classification.family"`, `"coordinates.lat"`) patungo sa nakaayos na mga source id na nagpatunay nito (`["glottolog-v5.3", "wals-v2020.5"]`). Ang mga value na kinalkula ng Champollion ay nagdadala ng `champollion-derived-v1`. May bersyon ang mga source id — `grambank-v1.0.3`, `iso639-3-20260715` — kaya bawat pahayag ay natutunton sa eksaktong release na nagbigay nito. |
| `coverage` | `object` | Sa bawat card, at **kinalkula ng projector, hindi pinatunayan ng anumang sanggunian**: `{sourceCount, componentsPresent, componentsTotal, notAttested}` — ilang magkakaibang sanggunian ang nagpahayag tungkol sa wikang ito, ilang bahagi ng card ang may dalang value mula sa kung ilan ang umiiral upang punan, at ilang value ang positibong itinala ng isang sanggunian bilang *absent* (sumuri at nagsabing wala — ibang katotohanan mula sa hindi kailanman sumuri). Ito ang nagbibigay-daan sa isang manipis na card na sabihin kung **bakit** ito manipis sa halip na magmukhang napabayaan. |
| `_card` | `object` | Ang sariling metadata ng card: `{type, id, revision, correctableFields}`. Ang `type` ay `"language"` o `"locale"` (ang mga card ng method at corpus ay gumagamit ng parehong projector); ang `revision` ay isang content hash, kaya binabago ito ng anumang pagbabago sa nilalaman ng card; inililista ng `correctableFields` ang mga field path na may dalang value — ang mga field na maaaring baguhin ng correction lane. |
| `_atlas` | `object` | `{version}` — ang stamp ng corpus release (`"unreleased"` sa pagitan ng mga release). Sadyang isang release id, **hindi** isang build timestamp: dahil sa isang timestamp, mag-iiba ang dalawang build mula sa magkaparehong pin ayon sa kalendaryo, na sumisira sa katangiang nagpapahintulot sa sinuman na suriin ang atlas — parehong mga pin papasok, parehong mga byte palabas. |

Ang provenance block bago ang cutover ay ganap na inalis: `dataSources`
(pinalitan ng per-field na `_fieldSources` map), `supportTier` (isang kinalkulang
paghuhusga, pinalitan ng mga neutral na bilang ng `coverage`), `_generated` (binubuo
ang buong corpus; ang stamp ay `_card.revision` kasama ang
`_atlas.version`), `humanReviewed` at `notes` (curation na nabibilang sa
mga lane na may sariling mga tala), at ang top-level na
`firstDocumented`/`lastDocumented` (inilipat sa `documentation` sa § 5.5,
kung saan aktwal na pinatutunayan ng kanilang sanggunian).

---

## Patakaran sa Language Code

Gumagamit ang Champollion ng **ISO 639-3** bilang canonical identifier. Ang iba pang standard code
ay naka-register bilang mga alias at nare-resolve sa ISO 639-3 code sa runtime.

| Prayoridad | Pamantayan | Halimbawa | Field | Gamit |
|------------|------------|-----------|-------|-------|
| 1 (kanonikal) | ISO 639-3 | `crk` | `code` | Filename ng card, mga config key, mga API param |
| 2 (alias) | ISO 639-1 | `iu` | `codeAliases[]` | Tinatanggap sa CLI, nilulutas sa ISO 639-3 |
| 3 (alias) | BCP 47 | `fil` | `codeAliases[]` | Tinatanggap sa CLI, nilulutas sa ISO 639-3 |
| Sanggunian | Glottocode | `plai1258` | `glottocode` | Para sa klasipikasyon lamang, hindi para sa runtime |

**Pagkakasunod-sunod ng paglutas:** Kapag nagbigay ang isang gumagamit ng code:
1. Direktang pagtutugma sa `card.code` → nahanap
2. Pagtutugma sa `card.codeAliases[]` → nahanap, ibalik ang kanonikal na card
3. Pagtutugma sa `card.iso639_1` → nahanap (fallback)
4. Hindi nahanap → error

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
- Nagbabalik ang `resolveCode("fr")` ng `"fra"` sa runtime — backwards compatible
- Maaari pa ring isulat ng mga gumagamit ang `"fr"` sa kanilang config — kusang nilulutas ito nang maayos

**Ano ang nagbago sa architecture:**
- Nilalaktawan na ngayon ng `_deepMerge()` ang mga value na `null` (nag-i-inherit mula sa parent)
- May identity field set na ngayon ang `_deepMerge()` (hindi kailanman ini-inherit ang code, extends, aliases)
- Hinango na ngayon ang `formality.default` mula sa mga flag ng register na `isDefault: true`
- 205 card na derived mula sa Grambank ang nagkaroon ng structural na pag-aayos sa `formality.default`
- 38 genus/family/macrolanguage card ang nagbibigay ng inheritance targets

---

## Edge Cases

### Mga Sign Language
Ang mga sign language (hal., ASE — American Sign Language) ay mga lehitimong wika
na may mga ISO 639-3 code. May heograpiya at mga bilang ng nagsasalita ang mga ito ngunit:
- Ang `modality` ay `"signed"` — ang positibong pagpapatunay ng card kung ano
  ang wika; ang kawalan ng sistema ng pagsulat ay isang hiwalay na katotohanan
- Karaniwang wala ang `scripts` (walang sistema ng notasyon ang may pangkalahatang
  pagtanggap sa komunidad), bagama't lumalabas ang `"Sgnw"` (SignWriting) kung saan ito pinatutunayan ng isang sanggunian
- Wala ang `textDirection`
- Dapat talakayin ng `linguisticChallenges` ang spatial grammar, mga classifier, atbp.

### Mga Sinauna at Historikal na Wika
Ang mga wika tulad ng Latin (`lat`, isoLanguageType `"Historical"`) at Sanskrit
(`san`) ay ginagamit pa rin sa mga partikular na konteksto (liturhikal, akademiko) ngunit
walang mga katutubong tagapagsalita (native speakers):
- Dinadala ng `isoLanguageType` ang sariling salita ng katayuan ng ISO (`"Ancient"`,
  `"Historical"`, `"Extinct"`) — hindi ito kailanman pinapahina o ino-override ng card
- Iniulat ng `endangerment` at `speakerEstimates` kung anuman ang aktwal na tinatasa ng
  mga binanggit na sanggunian, kasama ang mga caveat nang verbatim (ang mga bilang ng komunidad ng L2 ay nananatiling may label ayon sa pagka-label ng kanilang mga sanggunian)
- Inilalagay sila sa panahon ng `firstDocumented` / `lastDocumented`

### Mga Binuong Wika (Constructed Languages)
Esperanto (`epo`, isoLanguageType `"Constructed"`), Lojban, atbp.:
- Maaaring wala ang `classification` — inilalagay ng Glottolog ang mga conlang sa ilalim ng isang
  non-genealogical bucket, at ang bucket ay hindi kailanman ipinapakita bilang isang pamilya
- Sinasalamin ng `contactInfluences` ang pinagmulang materyal (hal., humahalaw ang Esperanto sa Romance, Germanic, Slavic)
- Hindi karaniwan ang `endangerment` — lumalaking komunidad ng mga nagsasalita ngunit walang katutubong sariling bayan

### Mga Macrolanguage
Ang Arabic (`ara`), Chinese (`zho`), Cree (`cre`), at Quechua (`que`) ay mga macrolanguage
na sumasaklaw sa maraming indibidwal na wika:
- `isoScope: "Macrolanguage"` — isang navigation hub, hindi kailanman isang benchmark target
- Inililista ng `macrolanguageMembers` ang mga code ng indibidwal na miyembro;
  itinatala ng `canonicalisedMembers` kung aling mga miyembro ang itinitiklop ng mga BCP 47 registry
  sa tag ng macrolanguage (bawat registry ay may attribution)
- Sinasalamin ng `methodSupport` kung ano ang sinusuportahan ng *macrolanguage card* (karaniwan ay ang standardized variety)
- Ang mga indibidwal na miyembro ay may sariling mga card, na may dalang `macrolanguage` pabalik sa hub

### Mga Wikang Walang Standardized na Ortograpiya
Maraming wika (lalo na ang mga wikang may tradisyong pasalita) ang walang standardized na
sistema ng pagsulat, o may nagtutunggaliang mga ortograpiya:
- Wala ang `scripts`, `scriptNames`, at `textDirection` — walang sangguniang
  nagpatunay ng isang script, na hindi kapareho ng pahayag na "unwritten"
- Dapat ipaliwanag ng `notes` ang sitwasyon sa ortograpiya
- Dapat pansinin ng `linguisticChallenges` kung paano ito nakakaapekto sa MT (hal., walang training data)

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

## Paano Naa-update ang mga Katotohanan sa Card

Ang mga card ay **build output** — isang deterministic na projection mula sa mga naka-pin na upstream
snapshot. Wala nang pamamaraan ng pagpapayaman (enrichment) bawat card: ang manu-manong pinapatakbong
script lane na `enrich-*` ay inalis na, at ang isang pagbabagong direktang ginawa sa isang file ng card
ay binubura ng susunod na build. Upang magbago ng isang katotohanan:

1. **Irehistro ang desisyon.** Bawat field ay isang row sa decision registry
   ng build: aling upstream parameter ang nagbibigay rito, paano ito nagpoproyekto, at kung ano
   ang ibig sabihin ng kawalan ng value.
2. **Ayusin ang ingest layer.** Ang isang maling value ay isang depekto sa source handler
   (o isang lumang upstream pin), hindi kailanman isang bagay na dapat i-patch sa card.
3. **Muling i-build at i-cut over.** Muling ipinoproyekto ng build ang bawat card mula sa mga naka-pin
   na snapshot; tinatanggihan ng mga gate ang mga bahagyang build, mga null/empty value, at mga card na
   bumabagsak sa mga panuntunan sa integridad.

### Conflict Handling

Kapag hindi nagkakasundo ang mga sanggunian:
1. **I-imbak ang lahat ng ito** nang may attribution sa sanggunian — iyon ang layunin ng
   attribution envelope
2. **HUWAG i-average** o pumili ng panig — lumalabas lamang ang `consensus` kapag
   tunay na sumasang-ayon ang mga sanggunian
3. **Dalhin ang mga caveat ng bawat sanggunian** nang verbatim sa `note` ng value na iyon
4. Ang isang solong value para sa display o pagtutuos ay **hinahango ng adapter**
   mula sa idineklarang authority order — ang mismong card ang nagpapanatili ng buong hanay ng mga datos

---

## Validation

Patakbuhin ang linter pagkatapos ng anumang muling pag-build:

```bash
node scripts/lint-language-cards.mjs              # all cards
node scripts/lint-language-cards.mjs --lang crk    # single card
```

### PR Checklist

Kapag nagpapasa ng pagbabagong sumasaklaw sa mga card (tandaan: baguhin ang build,
hindi ang card):

- [ ] Ang pag-aayos ay nasa isang ingest handler o sa decision registry — walang file
      ng card ang manu-manong ine-edit
- [ ] Nagdadala lamang ang mga field ng mga value na pinatunayan ng sanggunian — walang dinagdagan ng `null` o
      `[]` upang "makumpleto" ang isang card
- [ ] Ang `classification` ay nagmumula sa Glottolog (hindi manu-manong binuo)
- [ ] Ang provenance ng bawat nabagong field ay napupunta sa `_fieldSources`, kung saan ang
      mga value na kinalkula ng Champollion ay nagdadala ng `champollion-derived` na provenance
- [ ] Walang nasukat na marka (score) ng output ng pamamaraan ang lumalabas saanman sa isang card
- [ ] Pumasa ang linter at card-integrity gate nang walang error

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
