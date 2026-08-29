---
sidebar_position: 4
title: "Mga Sinusuportahang Wika"
related:
  - label: "The Language Atlas"
    to: /languages
    kind: atlas
    note: "Browse the same coverage on the map"
  - label: "Trading Cards"
    to: /trading-cards
    kind: card
    note: "Every language as a collectible stat card"
  - label: "Language Card Specification"
    to: /docs/reference/language-card-spec
    kind: reference
  - label: "Endonym"
    to: /glossary#term-endonym
    kind: glossary
    note: "Why we write languages in their own names"
---

# Mga Sinusuportahang Wika

Ang champollion ay may kasamang **Language Cards** — mga naka-istrukturang configuration file para sa 50 wika. Bawat card ay naglalaman ng mga preset ng register, metadata ng sistema ng formality, mga flag ng method support, mga panuntunan sa typography, at impormasyon ng script. Maaaring idagdag sa isang config line ang anumang wikang alam ng inyong LLM — ito ang mga may curated at production-ready na register.

---

## Mga Paraan ng Pagsasalin

Maaaring gumamit ang bawat wika ng isa o higit pa sa mga paraang ito ng pagsasalin:

| Icon | Paraan | Paano Ito Gumagana | Halaga |
|------|--------|-------------|------|
| 🟢 | **Google Translate** | Baseline ng Neural MT. 194 na wika. Mga key-value string lamang — hindi ligtas na maisasalin ang nilalaman ng Markdown. | ~$20/1M na character |
| 🔵 | **LLM (OpenRouter)** | Anumang wika na alam ng modelo. Mga prompt na ginagabayan ng rehistro. Pinangangasiwaan ang key-value + nilalaman ng Markdown. | Nag-iiba batay sa modelo |
| 🟣 | **LLM-Coached** | LLM + mga diksyunaryo ng gramatika + coaching data na inilagay sa mga prompt. Pinakamahusay para sa mga wikang may kumplikadong morpolohiya. | Nag-iiba batay sa modelo |
| 🟠 | **API (Plugin)** | Mga translation pipeline na naka-host sa komunidad at inihahatid sa pamamagitan ng HTTP. [Sovereignty-aspirant](/docs/network/community/low-resource-languages). | Nag-iiba batay sa provider |

Itakda ang `GOOGLE_TRANSLATE_API_KEY` para sa Google Translate, o `OPENROUTER_API_KEY` para sa mga LLM method. Tingnan ang [Mga Paraan ng Pagsasalin](/docs/guides/translation-methods) para sa kumpletong detalye.

---

## Mga Priyoridad na Wika

Ito ang mga pinakakaraniwang hinihiling na locale para sa mga web at mobile application, nakalista ayon sa inirerekomendang accessibility-first na pagkakasunod-sunod ng champollion.

| Bandila | Wika | Code | Google | LLM | Coached | Script | Mga Tala |
|------|----------|------|:------:|:---:|:-------:|--------|-------|
| 🇸🇦 | Arabe | `ar` | ✅ | ✅ | ✅ | — | RTL. Modern Standard Arabic (فصحى). |
| 🇵🇭 | Filipino (Taglish) | `tl` / `fil` | ✅ | ✅ | ✅ | — | Gamitin ang `fil` sa Docusaurus configs. Nireresolba ng champollion ang pareho. |
| 🇫🇷 | Pranses | `fr` | ✅ | ✅ | ✅ | — | Vous-form. Gender-inclusive (Connecté·e). |
| 🇪🇸 | Espanyol | `es` | ✅ | ✅ | ✅ | — | Neutral Latin American. |
| 🇩🇪 | Aleman | `de` | ✅ | ✅ | ✅ | — | Sie-form. Gender-inclusive (Benutzer:innen). |
| 🇯🇵 | Hapones | `ja` | ✅ | ✅ | ✅ | — | です/ます para sa body text, する para sa UI labels. |
| 🇨🇳 | Tsino (Simplified) | `zh` | ✅ | ✅ | ✅ | — | 简体中文. |
| 🇮🇹 | Italyano | `it` | ✅ | ✅ | ✅ | — | Lei-form. |
| 🇧🇷 | Portuges (BR) | `pt` | ✅ | ✅ | ✅ | — | Brazilian Portuguese. |
| 🇰🇷 | Koreano | `ko` | ✅ | ✅ | ✅ | — | Magalang na register na 해요체. |

## Mga Pangunahing Wika sa Mundo

| Bandila | Wika | Code | Google | LLM | Coached | Script | Mga Tala |
|------|----------|------|:------:|:---:|:-------:|--------|-------|
| 🇧🇩 | Bengali | `bn` | ✅ | ✅ | ✅ | — | Kagustuhan sa শুদ্ধ ভাষা. |
| 🇧🇬 | Bulgaro | `bg` | ✅ | ✅ | ✅ | — | |
| 🇨🇿 | Czech | `cs` | ✅ | ✅ | ✅ | — | Vykání (vy-form). |
| 🇩🇰 | Danish | `da` | ✅ | ✅ | ✅ | — | |
| 🇬🇷 | Griyego | `el` | ✅ | ✅ | ✅ | — | Modern Δημοτική. |
| 🇮🇷 | Persian | `fa` | ✅ | ✅ | ✅ | — | RTL. |
| 🇫🇮 | Finnish | `fi` | ✅ | ✅ | ✅ | — | Walang grammatical gender. |
| 🇮🇱 | Hebrew | `he` | ✅ | ✅ | ✅ | — | RTL. |
| 🇮🇳 | Hindi | `hi` | ✅ | ✅ | ✅ | — | शुद्ध हिन्दी. Minimal na English loanwords. |
| 🇭🇺 | Hungarian | `hu` | ✅ | ✅ | ✅ | — | Ön-form. |
| 🇮🇩 | Indonesian | `id` | ✅ | ✅ | ✅ | — | |
| 🇲🇾 | Malay | `ms` | ✅ | ✅ | ✅ | — | |
| 🇳🇱 | Dutch | `nl` | ✅ | ✅ | ✅ | — | U-form. |
| 🇳🇴 | Norwegian | `nb` | ✅ | ✅ | ✅ | — | Bokmål. |
| 🇵🇱 | Polish | `pl` | ✅ | ✅ | ✅ | — | Pan/Pani form. |
| 🇵🇹 | Portuges (EU) | `pt-PT` | ✅ | ✅ | ✅ | — | European Portuguese. |
| 🇷🇴 | Romanian | `ro` | ✅ | ✅ | ✅ | — | |
| 🇷🇺 | Ruso | `ru` | ✅ | ✅ | ✅ | — | Вы-form. |
| 🇸🇰 | Slovak | `sk` | ✅ | ✅ | ✅ | — | Vykanie (vy-form). |
| 🇷🇸 | Serbian | `sr` | ✅ | ✅ | ✅ | 🔤 Latin→Cyrillic | Deterministic script converter. |
| 🇸🇪 | Swedish | `sv` | ✅ | ✅ | ✅ | — | |
| 🇰🇪 | Swahili | `sw` | ✅ | ✅ | ✅ | — | |
| 🇹🇭 | Thai | `th` | ✅ | ✅ | ✅ | — | Mga politeness particle na ครับ/ค่ะ. |
| 🇹🇷 | Turkish | `tr` | ✅ | ✅ | ✅ | — | Siz-form. |
| 🇺🇦 | Ukrainian | `uk` | ✅ | ✅ | ✅ | — | Ви-form. |
| 🇵🇰 | Urdu | `ur` | ✅ | ✅ | ✅ | — | RTL. آپ form. |
| 🇻🇳 | Vietnamese | `vi` | ✅ | ✅ | ✅ | — | |
| 🇹🇼 | Tsino (Traditional) | `zh-TW` | ✅ | ✅ | ✅ | — | 繁體中文. |
| 🇬🇪 | Georgian | `ka` | ✅ | ✅ | — | — | ქართული. Pamilyang Kartvelian. |
| 🇳🇬 | Yoruba | `yo` | ✅ | ✅ | — | — | Èdè Yorùbá. Tonal (3 tono). |

## Mga Regional Variant

| Bandila | Wika | Code | Google | LLM | Coached | Script | Mga Tala |
|------|----------|------|:------:|:---:|:-------:|--------|-------|
| 🇲🇽 | Mexican Spanish | `es-MX` | ✅ | ✅ | ✅ | — | Tú-form. Mainit na register. |
| 🇨🇦 | Canadian French | `fr-CA` | ✅ | ✅ | ✅ | — | Mga Québécois idiom. |

---

## Mga Katutubo at Low-Resource na Wika

Ang mga wikang ito po ay hindi sinusuportahan ng mga komersyal na serbisyo ng MT. Nagbibigay po ang champollion ng mga tool para sa mga komunidad ng wika upang makabuo sila ng sarili nilang mga paraan sa ilalim ng [mga prinsipyo ng data sovereignty ng komunidad](/docs/network/community/low-resource-languages).

| | Wika | Code | Google | LLM | Coached | Script | Status |
|---|----------|------|:------:|:---:|:-------:|--------|--------|
| 🪶 | Plains Cree | `crk` | ❌ | ✅ | ✅ | 🔤 SRO→Syllabics | 🚧 Under development |
| 🌄 | Quechua | `qu` | ✅ | ✅ | — | — | Runasimi. Mga evidential suffix. |

:::info[Ang Plains Cree ay nasa ilalim ng aktibong pagbuo]
Ang rehistro, imprastraktura ng coaching, script converter, at evaluation harness para sa Plains Cree ay gumagana na po lahat, ngunit ang translation pipeline ay **hindi pa po inilalabas**. Nakikipagtulungan po kami sa mga komunidad ng wika sa ilalim ng [mga prinsipyo ng data sovereignty ng komunidad](/docs/network/community/low-resource-languages) upang matiyak ang kalidad bago ito ilabas. Tingnan po ninyo ang [Suportahan ang Isang Low-Resource Language](/docs/network/community/low-resource-languages) para sa buong kwento — at kung paano kayo makakapag-ambag.
:::

:::tip[Pagdaragdag ng higit pang mga low-resource na wika]
Ang method plugin system ng champollion ay idinisenyo para rito. Maaaring bumuo ang isang komunidad ng wika ng custom translation method, i-host ito sa ilalim ng sarili nilang kontrol, at ihatid ito sa pamamagitan ng [API method](/docs/guides/serving-a-method). Sinusubaybayan ng [Method Leaderboard](/leaderboard) ang mga score para sa anumang pares ng wika — bumuo ng method, patakbuhin ang harness, at i-claim ang pinakamataas na score.
:::

---

## Mga Constructed Language

Sinusuportahan ang mga conlang sa pamamagitan ng mga LLM register at optional na script converter. Ginagamit nila ang parehong infrastructure gaya ng mga tunay na wika — magkaparehong gumagana ang quality gate, coaching system, at script conversion pipeline.

| | Wika | Code | Google | LLM | Script | Mga Tala |
|---|----------|------|:------:|:---:|--------|-------|
| 🖖 | Klingon | `tlh` | ❌ | ✅ | 🔤 Romanization→pIqaD | Kailangan ang PUA font. Bokabularyo ni Marc Okrand. |
| 🧝 | Sindarin (Tolkien Elvish) | `x-elvish-s` | ❌ | ✅ | 🔤 Latin→Tengwar | Kailangan ang CSUR PUA font. |
| 🏴‍☠️ | Pirate English | `x-pirate` | ❌ | ✅ | — | Register lamang. Mga nautical metaphor. |
| 🦸 | Kryptonian | `x-kryptonian` | ❌ | ✅ | 🔤 Latin→Kryptonian | Kailangan ang PUA font. |
| 🎭 | Shakespearean English | `x-shakespeare` | ❌ | ✅ | — | Register lamang. Mga anyong thee/thou, -eth/-est. |
| 🐸 | Yoda-speak | `x-yoda` | ❌ | ✅ | — | Register lamang. OSV word order. |

Tingnan ang [Conlangs, Scripts at Orthography](/docs/guides/conlangs-scripts-orthography) para sa mga kinakailangan sa PUA font, limitasyon ng Unicode, at kung paano magdagdag ng sarili ninyo.

---

## Mga Language Preset

Sinusuportahan ng `init` wizard ang mga preset name para sa mabilis na setup. Maaari ninyong paghaluin ang mga preset at indibidwal na code.

| Preset | Nag-e-expand Sa |
|--------|-----------|
| `european` | fr, de, es, it, pt, nl |
| `asian` | ja, zh, ko |
| `global` | fr, es, de, ja, zh, ko, pt, ar |
| `nordic` | da, fi, nb, sv |

```bash
# Mix presets with individual codes
champollion init
# → Target languages: european, ja
# → Resolves to: fr, de, es, it, pt, nl, ja
```

---

## Pagdaragdag ng Anumang Wika

Maaaring magsalin ang champollion sa **anumang wikang alam ng inyong LLM** — inililista lamang ng talahanayan sa itaas ang mga wikang may built-in na register preset. Upang magdagdag ng wikang hindi nakalista, isama ang BCP-47 code nito sa inyong config:

```json
{
  "languages": {
    "sw": {},
    "am": {
      "register": "Formal Amharic. Professional register with Geʽez script."
    }
  }
}
```

Magsasalin ang LLM gamit ang training knowledge nito sa wika. Ang pagtatakda ng `register` ay nagbibigay sa inyo ng kontrol sa tone, formality, at orthographic conventions. Tingnan ang [Configuration](/docs/getting-started/configuration) para sa mga detalye.

---

## Language Cards {#language-cards}

Bawat built-in na wika ay may **Language Card** — isang unified JSON file sa `shared/language-cards/` na naglalaman ng lahat ng metadata: mga register, formality, method support, mga panuntunan sa typography, genealogical classification, linguistic challenges, at NLP resources.

### Pinag-isang Arkitektura ng Card

Agad na nilo-load ang bawat card sa import. Walang hiwalay na reference tier — lahat ng data ay nasa iisang file para sa bawat wika. Pinayayaman ang mga card mula sa authoritative sources:

| Source | Data |
|--------|------|
| [Glottolog](https://glottolog.org) | Family classification, ancestry chain, Glottocode |
| [WALS](https://wals.info) | Genus classification, typological features |
| [CLDR](https://cldr.unicode.org) | Script, direction, plural rules, typography |
| [ISO 15924](https://unicode.org/iso15924/) | Script codes |

### Mga Pangunahing Field ng Card

| Field | Nilalaman Nito |
|-------|------------------|
| **`nativeName`** | Endonym — ang pangalan ng wika para sa sarili nito, sa sarili nitong script (hal., ქართული, Runasimi) |
| **`classification`** | Genealogical anchor: family, genus, buong ancestry chain mula sa Glottolog |
| **`contactInfluences`** | Universal contact history — mga layer ng panghihiram, superstrates, substrates |
| **Sistema ng formality** | T-V distinction, speech levels, keigo, particles, atbp. |
| **Mga register preset** | Mga pinangalanang LLM prompt preset na partikular sa katangian ng wika |
| **Method support** | Aling mga translation API ang sumusuporta sa wikang ito |
| **Gender guidance** | Mga panuntunan sa grammatical gender at mga tip para sa inclusive writing |
| **Script/direction** | ISO 15924 script code at RTL/LTR |
| **Mga Panuntunan** | Typography (quotes, spacing), capitalization, plural categories |
| **`glottocode`** | Canonical Glottolog identifier para sa cross-referencing |
| **`dataSources`** | Pagsubaybay ng provenance (hal., `["glottolog-5.3", "cldr-48"]`) |

### Pag-scaffold ng Bagong Language Card

Gamitin ang generator upang mag-scaffold ng card mula sa authoritative data sources (IANA, CLDR, Glottolog):

```bash
# Preview what would be generated
node scripts/generate-language-card.mjs sw --dry-run

# Generate a unified card
node scripts/generate-language-card.mjs sw
```

Awtomatikong pini-fill ng generator ang metadata (codes, script, direction, plurals, quotes, method support, classification) at minamarkahan bilang TODO ang mga linguistic judgment field para sa human curation.

### Paggamit ng mga Preset Key

Sa halip na isulat ang buong register text, maaari kayong gumamit ng preset key name:

```json
{
  "languages": {
    "fr": "casual-tu",
    "ko": "formal-hapsyo",
    "ja": "polite"
  }
}
```

Nireresolba ng Champollion ang key patungo sa buong register prompt. Patakbuhin ang `npx champollion init` upang makita ang mga available na preset para sa bawat wika.

### Mga Halimbawang Preset

| Wika | Mga Preset | Default |
|----------|---------|--------|
| Pranses | `formal-vous`, `casual-tu` | `formal-vous` |
| Koreano | `polite-haeyo`, `formal-hapsyo`, `casual-hae` | `polite-haeyo` |
| Hapones | `polite`, `formal-keigo`, `casual` | `polite` |
| Aleman | `formal-Sie`, `casual-du` | `formal-Sie` |
| Thai | `neutral-professional`, `polite-male`, `polite-female` | `neutral-professional` |
| Espanyol | `neutral-professional`, `formal-usted`, `casual-tuteo` | `neutral-professional` |

Tingnan ang [Pag-contribute ng Language Card](https://github.com/gamedaysuits/champollion) para sa buong spec, kabilang ang field validation at PR checklist.

---

## Tingnan Din

- [Configuration](/docs/getting-started/configuration) — buong config reference kabilang ang language setup
- [Mga Paraan ng Pagsasalin](/docs/guides/translation-methods) — kung paano gumagana ang bawat method
- [Mga Script Converter](/docs/concepts/script-converters) — deterministic script conversion pipeline
- [Conlangs, Scripts at Orthography](/docs/guides/conlangs-scripts-orthography) — PUA fonts, Unicode, pagdaragdag ng mga conlang
- [Suportahan ang Low-Resource na Wika](/docs/network/community/low-resource-languages) — pagbuo ng mga method para sa mga wikang kulang ang serbisyo

