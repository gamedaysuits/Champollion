---
sidebar_position: 7
title: "Paghahambing"
---

# Paano Naihahambing ang Champollion

Ang champollion ay nasa ibang kategorya kaysa sa karamihan ng mga localization tool. Narito ang isang tapat na paghahambing.

## Ang Landscape

Karamihan sa localization tooling ay nabibilang sa isa sa tatlong kategorya:

| Kategorya | Mga Halimbawa | Modelo |
|----------|----------|-------|
| **Cloud TMS Platforms** | Crowdin, Phrase, Locize, Tolgee | SaaS dashboard + mga human translator + buwanang subscription |
| **Key Extraction Tools** | i18next-scanner, FormatJS CLI | I-scan ang source code para sa mga translation function call |
| **CLI Translation Engines** | **champollion** | Patakbuhin sa inyong proyekto, direktang isalin ang mga file, walang cloud account |

Ang Champollion ay isang **CLI translation engine** — direktang isinasalin nito ang inyong mga locale file gamit ang mga configurable backend (LLMs, Google Translate, custom plugins). Walang cloud dashboard, walang workflow para sa human translator, walang buwanang bayarin.

---

## Paghahambing ng Feature

| Tampok | champollion | Crowdin | Phrase | Locize |
|---------|:------------:|:-------:|:------:|:------:|
| **Tumatakbo nang lokal (walang cloud account)** | ✅ | ❌ | ❌ | ❌ |
| **Minimal na mga dependency** | ✅ | ❌ | ❌ | ❌ |
| **Kumpigurasyon ng method bawat pares** | ✅ | ❌ | ❌ | ❌ |
| **Custom na mga language register** | ✅ | ❌ | ❌ | ❌ |
| **Content-aware (pinoprotektahan ang mga code block)** | ✅ | ❌ | ❌ | ❌ |
| **Kumbersiyon ng conlang at script** | ✅ | ❌ | ❌ | ❌ |
| **Arkitektura ng plugin** | ✅ | ❌ | ❌ | ❌ |
| **Pagsasalin ng Markdown / nilalaman** | ✅ | ✅ | ✅ | ❌ |
| **Translation Memory** | ✅ | ✅ | ✅ | ✅ |
| **Pag-export/pag-import ng XLIFF** | ✅ | ✅ | ✅ | ❌ |
| **Balidasyon ng ICU plural** | ✅ | ✅ | ✅ | ❌ |
| **Pagpapatupad ng terminolohiya** | ✅ | ✅ | ✅ | ❌ |
| **Workflow ng taong tagasalin** | Nakabatay sa XLIFF | ✅ | ✅ | ✅ |
| **In-context na pag-edit (biswal)** | ❌ | ✅ | ✅ | ✅ |
| **Kolaborasyon ng koponan** | ❌ | ✅ | ✅ | ✅ |
| **Suporta sa format ng file** | JSON, TOML, YAML, MD, XLIFF | 50+ | 40+ | JSON |
| **Pagpepresyo** | Libre para sa hindi komersiyal na paggamit (bayaran ang iyong LLM) | Mula $0/buwan | Mula $0/buwan | Mula $0/buwan |

---

## Kailan Gagamitin ang Champollion

**Ang Champollion ay angkop kapag:**

- Gusto ninyong isama ang machine translation sa inyong build pipeline — hindi bilang hiwalay na workflow
- Kailangan ninyo ng per-language method control (LLM para sa ilan, Google Translate para sa iba, custom plugins para sa natitira)
- Nagsasalin kayo sa mga wikang walang API coverage (Katutubo, nanganganib, constructed)
- Gusto ninyo ng deterministic script output (Cree Syllabics, Klingon pIqaD, Tengwar)
- Gusto ninyo ng zero vendor lock-in at zero cloud dependencies
- Isa kayong solo developer o maliit na team na hindi nangangailangan ng buong TMS dashboard
- Gusto ninyo ng XLIFF-based handoff sa mga propesyonal na translator nang walang cloud subscription

**Mas angkop ang cloud TMS kapag:**

- Mayroon kayong mga propesyonal na human translator na nagre-review ng bawat string (mas simple ang XLIFF workflow ng champollion kaysa sa buong TMS)
- Kailangan ninyo ng cross-project translation memory at glossary management
- Kailangan ninyo ng in-context visual editing (i-preview ang mga salin sa loob ng inyong UI)
- Mayroon kayong malaking team na may mga pangangailangan sa role-based access control
- Kailangan ninyo ng suporta para sa 50+ file format

---

## Ang Ginagawa ng Champollion na Wala sa Iba

### 1. Custom Registers

Bawat language pair ay may mga tagubilin sa tono para sa LLM na angkop sa kultura:

```json
{
  "de": {
    "register": "Standard professional register. Use Sie-form for formal address."
  },
  "tl": {
    "register": "Educated Manila Taglish. Use Tagalog as the primary language but keep technical terms in English."
  },
  "tlh": {
    "register": "Warrior's honor. OVS grammar. Use Marc Okrand vocabulary."
  }
}
```

Walang ibang tool na may kasamang 47 pre-configured language registers, o nagpapahintulot sa inyong magtakda ng custom na mga register per project.

### 2. Deterministic Script Converters

May kasamang limang built-in script converter ang Champollion na tumatakbo bilang post-translation hooks — walang LLM na kailangan:

| Locale | Conversion | Halimbawa |
|--------|-----------|---------|
| `crk` | SRO → Cree Syllabics | `nêhiyawêwin` → `ᓀᐦᐃᔭᐍᐏᐣ` |
| `sr` | Latin → Cyrillic | `Beograd` → `Београд` |
| `tlh` | Romanization → pIqaD | `tlhIngan Hol` → (pIqaD glyphs) |
| `x-elvish-s` | Latin → Tengwar | Sindarin → Tengwar (Mode of Beleriand) |
| `x-kryptonian` | Latin → Kryptonian | Cipher-substitution (nangangailangan ng font) |

Ang mga ito ay pure lookup-table converters — deterministic, auditable, at walang panganib ng LLM hallucination.

### 3. Content-Aware Shielding

Kapag nagsasalin ng Markdown o rich content, pinoprotektahan ng Champollion ang:

- Fenced code blocks (` ``` `)
- Inline code (`` ` ` ``)
- Hugo shortcodes (`{{</* */>}}`, `{{%/* */%}}`)
- Interpolation variables (`{{ .Count }}`, `{name}`, `{{t('key')}}`)
- Raw HTML blocks

Pinapalitan ang mga ito ng Unicode sentinel tokens bago ang pagsasalin at ibinabalik pagkatapos. Hindi kailanman nakikita ng LLM ang inyong code, mga shortcode, o mga variable.

### 4. Coached Method Plugins

Para sa mga wikang walang API coverage, maaari kayong bumuo ng coached translation method:

1. Sumulat ng linguistic coaching data (mga grammar rule, vocabulary, mga halimbawa)
2. I-bundle ito bilang plugin
3. I-benchmark ito laban sa mga reference translation gamit ang [eval harness](https://github.com/gamedaysuits/Champollion)
4. I-install ito sa inyong proyekto gamit ang `champollion plugin install`

Ganito hinahawakan ng champollion ang Plains Cree — at ganito rin ninyo mahahawakan ang anumang wika, kabilang ang mga hindi pa umiiral.

---

## Ang Pinaka-mahalagang Punto

Hindi kapalit ng Crowdin ang Champollion. Ibang tool ito para sa ibang workflow. Kung kailangan ninyo ng mga human translator, gumamit ng TMS. Kung kailangan ninyo ng CLI na nagsasalin ng inyong mga file sa isang command at nagbibigay sa inyo ng per-language control sa methods, models, at registers — gamitin ang champollion.
