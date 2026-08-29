---
sidebar_position: 3
title: "Mga Conlang, Sistema ng Pagsulat at Ortograpiya"
---

# Mga Conlang, Script at Ortograpiya

Ang champollion ay may first-class support para sa mga constructed language sa pamamagitan ng mga LLM register at deterministic script converter. Sinasaklaw ng gabay na ito kung paano gumagana ang suporta sa conlang, kung anong mga font ang kailangan ninyo, at kung paano magdagdag ng sarili ninyo.

:::tip[Bakit mahalaga ang mga conlang]
Ang mga conlang ay hindi lamang novelty — sinusubok nila ang eksaktong parehong infrastructure na ginagamit para sa tunay na mga wikang kulang ang suporta. Gumagana nang magkapareho ang quality gate, coaching system, at script conversion pipeline para sa Klingon at Plains Cree. Kung gumagana ang inyong conlang pipeline, gagana rin ang inyong low-resource language pipeline.
:::

---

## Mga Sinusuportahang Constructed Language

| Wika | Code | Script Converter | Kinakailangang Font |
|----------|------|:----------------:|:-------------:|
| Klingon | `tlh` | ✅ Romanization → pIqaD | PUA font (hal., pIqaD qolqoS) |
| Sindarin (Tolkien Elvish) | `x-elvish-s` | ✅ Latin → Tengwar | CSUR PUA font |
| Kryptonian | `x-kryptonian` | ✅ Latin → Kryptonian | PUA font |
| Pirate English | `x-pirate` | ❌ register lamang | Wala |
| Shakespearean English | `x-shakespeare` | ❌ register lamang | Wala |
| Yoda-speak | `x-yoda` | ❌ register lamang | Wala |

Ginagamit ng mga conlang code ang `x-` prefix ayon sa BCP-47 private-use convention, maliban sa Klingon (`tlh`) na may [ISO 639-3](https://iso639-3.sil.org/code/tlh) code na itinalaga ng SIL International.

---

## Unicode, PUA, at Mga Kinakailangan sa Font

### Ang Private Use Area

Gumagamit ang Klingon (pIqaD), Sindarin (Tengwar), at Kryptonian ng mga Unicode **Private Use Area (PUA)** character. Ang PUA ay ang saklaw na U+E000–U+F8FF — ang mga codepoint na ito ay **walang standard assignment**. Pinananatili ng [ConScript Unicode Registry (CSUR)](https://www.evertype.com/standards/csur/) ang mga mapping na napagkasunduan ng komunidad para sa mga fictional script, ngunit hindi bahagi ang mga ito ng Unicode standard.

Ang ibig sabihin nito sa praktika:

- Nagre-render ang PUA text bilang **mga empty box** (□□□) kapag hindi naka-load ang tamang font
- Maaaring i-map ng magkakaibang font ang magkakaibang glyph sa parehong PUA codepoint
- HINDI nagba-bundle ang champollion ng mga PUA font — kailangan ninyo itong i-load mismo
- Hindi kailanman maire-render ng mga system font ang mga character na ito

### Mga PUA Range ayon sa Script

| Script | PUA Range | CSUR Reference |
|--------|-----------|---------------|
| Klingon (pIqaD) | U+F8D0–U+F8FF | [CSUR Klingon](https://www.evertype.com/standards/csur/klingon.html) |
| Tengwar (Elvish) | U+E000–U+E07F | [CSUR Tengwar](https://www.evertype.com/standards/csur/tengwar.html) |
| Kryptonian | Nag-iiba ayon sa font | Walang CSUR standard |

### Pag-load ng Mga PUA Web Font

May kasamang built-in command ang champollion upang mag-download at mamahala ng mga PUA web font:

```bash
# See which fonts are needed for your configured languages
champollion fonts list

# Download all needed fonts (auto-detects project type for output directory)
champollion fonts install

# Also generate a CSS snippet with @font-face declarations
champollion fonts install --css
```

Nagda-download ang command na `fonts install` mula sa mga beripikadong open-source repository:

| Font | Script | License | Source |
|------|--------|---------|--------|
| pIqaD qolqoS | Klingon | SIL Open Font License 1.1 | [GitHub](https://github.com/dadap/pIqaD-fonts) |
| FreeMonoTengwar | Tengwar | GNU GPL v3 (may font exception) | [SourceForge](https://sourceforge.net/projects/freetengwar/) |
| *(ibinigay ng user)* | Kryptonian | Nag-iiba | Walang available na open-source PUA font |

Awtomatikong natutukoy ang output directory mula sa istruktura ng inyong proyekto (Docusaurus → `static/fonts/`, Hugo → `static/fonts/`, default → `public/fonts/`). I-override gamit ang `--dir`.

Kung mas nais ninyong pamahalaan ang mga font nang manual, magdagdag ng mga rule na `@font-face` sa inyong CSS:

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

:::warning[HINDI garantisado ang suporta sa Unicode]
Ang Unicode Consortium ay [tahasang tumanggi](https://www.unicode.org/faq/private_use.html) na i-encode ang mga fictional script sa standard. Ang mga PUA assignment ay pinananatili ng community at maaaring magkasalungatan sa pagitan ng mga font implementation. Palaging tukuyin ang eksaktong font na ginagamit ng inyong proyekto, at subukan ang rendering sa iba’t ibang browser.
:::

---

## Mga Script Converter

### Paano Gumagana ang mga Ito

Ang script conversion ng champollion ay isang **post-translation hook, na inilalapat lamang kapag hinihingi ito ng config**:

1. Isinasalin ng LLM ang teksto sa isang **working script** (kadalasan ay Latin o SRO)
2. Bina-validate ng [quality gate](/docs/concepts/quality-gate) ang output
3. Kung pinipili ng setting na `script:` ng pair ang display script, babaguhin ng deterministic converter ang na-validate na teksto — ang mga value na may mga titik na hindi ma-map ng converter ay mananatiling buo sa working script, at magbibigay ng babala bawat key
4. Ang resulta ay isusulat sa disk

Gumagana ang two-step approach na ito dahil mas mahusay ang output ng mga LLM kapag nagtatrabaho sa mga Latin-based script. Ginagarantiyahan ng deterministic converter ang tamang script output nang hindi umaasa sa kaalaman ng model sa script (na kadalasang hindi maaasahan).

Kung tatakbo man ang step 3 ay nakadepende sa desisyon ng bawat proyekto — tingnan ang [Script Conversion](/docs/getting-started/configuration#script-conversion). Ang mga PUA display script (pIqaD, Tengwar, Kryptonian) ay naka-off bilang default dahil hindi sila magre-render ng anuman kung walang purpose-built font; ang crk at sr ay walang default, dahil parehong tunay ang kanilang mga ortograpiya at ang pagpili ay nasa proyekto.

### Lahat ng Limang Converter

May kasamang limang built-in script converter ang champollion:

#### Plains Cree: SRO → Syllabics (`crk`)

Standard Roman Orthography papunta sa Canadian Aboriginal Syllabics.

```
Input:  "tawâw"
Output: "ᑕᐚᐤ"
```

Gumagamit ang mahahabang patinig ng macron/circumflex: ê, î, ô, â. Pinangangasiwaan ng converter ang lahat ng SRO diacritic at mina-map ang mga ito sa tamang syllabic character. Tingnan ang [Sumuporta sa Isang Low-Resource Language](/docs/network/community/low-resource-languages) para sa buong Cree pipeline.

#### Serbian: Latin → Cyrillic (`sr`)

Deterministic na Latin-to-Cyrillic conversion para sa Serbian.

```
Input:  "zdravo"
Output: "здраво"
```

Pinangangasiwaan nito ang buong Serbian alphabet mapping kasama ang mga digraph (lj → љ, nj → њ, dž → џ).

#### Klingon: Romanization → pIqaD (`tlh`)

Romanization system ni Marc Okrand papunta sa mga pIqaD PUA character.

```
Input:  "Qapla'"    (romanized Klingon)
Output: [pIqaD PUA] (requires pIqaD font to render)
```

#### Sindarin: Latin → Tengwar (`x-elvish-s`)

Tengwar mapping para sa Sindarin mode ni Tolkien.

```
Input:  "elen síla"  (Latin Sindarin)
Output: [Tengwar PUA] (requires Tengwar font to render)
```

#### Kryptonian: Latin → Kryptonian (`x-kryptonian`)

Fan-lexicon Kryptonian script mapping.

```
Input:  "Kal-El"
Output: [Kryptonian PUA] (requires Kryptonian font to render)
```

### Pag-trigger ng Converter

I-set ang `script` field sa ISO 15924 code ng ortograpiya na nais ninyong isulat:

```json
{
  "languages": {
    "sr": { "script": "Cyrl" },
    "crk": { "script": "Cans" },
    "tlh": { "script": "Piqd" }
  }
}
```

Walang mako-convert kung wala ito. Para sa `crk` at `sr`, ang field ay **kinakailangan** — parehong tunay ang kanilang mga ortograpiya, at hindi pipili ang `sync` para sa inyo. Para sa mga PUA locale, ito ay isang opt-in sa halip na romanization default. Tingnan ang [Script Conversion](/docs/getting-started/configuration#script-conversion).

---

## Mga Multi-Script Language

Gumagamit ang ilang tunay na wika ng maraming aktibong script:

| Wika | Mga Script | Pamamaraan ng champollion |
|----------|---------|-----------------|
| Serbian | Latin + Cyrillic | Isang locale, tahasang pagpili: magko-convert ang `"script": "Cyrl"`, pananatilihin ng `"script": "Latn"` ang Latin |
| Plains Cree | SRO (Latin) + Syllabics | Isang locale, tahasang pagpili: `"script": "Cans"` o `"script": "Latn"` |
| Chinese | Simplified + Traditional | Magkahiwalay na locale code (`zh` vs `zh-TW`) na may magkakaibang register |

Para sa mga wika kung saan ang parehong script ay nagsisilbi sa iisang audience (Serbian, Plains Cree), ang isang locale kasama ang tahasang pagpili sa `script` ay nagpapanatili ng iisang translation pipeline. Para sa mga wika kung saan ang mga script ay nagsisilbi sa magkaibang audience (Chinese Simplified para sa mainland China, Traditional para sa Taiwan/HK), gumamit ng magkahiwalay na locale code.

---

## Mga Tala sa Ortograpiya

Hindi lamang tono ang mga register — nagdadala rin ang mga ito ng **orthographic instructions** na gumagabay sa LLM patungo sa mga tamang writing convention.

### Mga Formal Address Form

Kasama sa mga built-in register ng champollion ang culturally appropriate formal address para sa bawat wika:

| Wika | Formal Form | Register Instruction |
|----------|------------|---------------------|
| German | Sie | `Use Sie-form for formal address` |
| French | vous | `Use vous-form` |
| Russian | вы | `Professional register with вы-form` |
| Turkish | siz | `Professional register with siz-form` |
| Korean | 합쇼체 | `Formal Korean (합쇼체)` |
| Japanese | です/ます | `Polite professional register (です/ます form)` |
| Polish | Pan/Pani | `Professional register with Pan/Pani form` |

### Gender-Inclusive na Pagsulat

May field na `gender.inclusiveGuidance` ang bawat language card na may payong partikular sa wika. Ini-inject ito sa LLM translation prompt nang hiwalay sa register preset, kaya pare-pareho itong nalalapat anuman ang formality preset na piliin ng user:

- **French**: Écriture inclusive gamit ang interpunct notation (hal., "Connecté·e")
- **German**: Doppelpunkt notation (hal., "Benutzer:innen")
- **Spanish**: Mas pinipili ang gender-neutral restructuring; slash notation (hal., "usuario/a") bilang fallback

Para sa mga wikang walang partikular na gabay sa kanilang card (hal., Korean, conlangs), bumabalik ang system sa isang generic rule: *"mas piliin ang gender-neutral forms o ang pinakainklusibong opsyong available."*

### Mga Kinakailangan sa RTL Script

Lahat ng register para sa Arabic, Hebrew, Persian, at Urdu ay nagtatala ng mga right-to-left requirement: `Ensure text reads naturally in RTL layout contexts.`

### Pag-override ng Anumang Register

Ang bawat register ay isang config value — i-override ito upang tumugma sa voice ng inyong proyekto:

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

Tingnan ang [Configuration](/docs/getting-started/configuration) para sa buong config reference.

---

## Pagdaragdag ng Bagong Conlang

### Step-by-step

1. **Pumili ng BCP-47 private-use code**: Gamitin ang prefix na `x-` (hal., `x-dothraki`, `x-valyrian`).

2. **Idagdag sa inyong config**:

```json
{
  "languages": {
    "x-dothraki": {
      "register": "Dothraki language. Use David J. Peterson's vocabulary from the Living Language Dothraki textbook. Harsh, direct tone. No articles, no verb 'to be'."
    }
  }
}
```

3. **(Opsyonal) Magdagdag ng script converter**: Kung gumagamit ang inyong conlang ng non-Latin display script, magdagdag ng converter sa `lib/scripts.js` at i-register ito sa `SCRIPT_CONVERTERS`.

4. **Subukan**: Patakbuhin ang `champollion sync --dry` upang i-preview ang mga translation nang hindi nagsusulat ng mga file.

5. **Suriin ang quality gate**: Maaaring kailanganing i-tune ang [quality gate](/docs/concepts/quality-gate) para sa inyong conlang — partikular ang check na `requireNonLatin` kung gumagamit ng mga PUA character ang inyong conlang.

:::note[Nakadepende ang kalidad ng conlang sa kaalaman ng LLM]
Makapagsasalin lamang ang LLM sa isang conlang na nakita nito sa training data. Gumagana nang maayos ang mga conlang na mahusay ang dokumentasyon (Klingon, Sindarin, Dothraki). Maaaring magbigay ng hindi magkakatugmang resulta ang mga conlang na hindi gaanong kilala o bagong imbento. Gamitin ang [coaching data](/docs/concepts/coaching-data) upang mapabuti ang kalidad.
:::

---

## Tingnan Din

- [Mga Sinusuportahang Wika](/docs/reference/supported-languages) — buong language table na may method availability
- [Mga Script Converter](/docs/concepts/script-converters) — mga teknikal na detalye ng conversion pipeline
- [Mga Paraan ng Pagsasalin](/docs/guides/translation-methods) — kung paano gumagana ang bawat translation method
- [Configuration](/docs/getting-started/configuration) — config reference kasama ang language at register setup
- [Sumuporta sa Isang Low-Resource Language](/docs/network/community/low-resource-languages) — ang parehong imprastrakturang inilalapat sa mga tunay na wikang kulang sa suporta
