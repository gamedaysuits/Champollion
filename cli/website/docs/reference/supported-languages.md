---
sidebar_position: 4
title: Supported Languages
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

# Supported Languages

champollion ships with **Language Cards** — structured configuration files for 50 languages. Each card contains register presets, formality system metadata, method support flags, typography rules, and script information. Any language your LLM knows can be added with a single config line — these are the ones with curated, production-ready registers.

---

## Translation Methods

Each language can use one or more of these translation methods:

| Icon | Method | How It Works | Cost |
|------|--------|-------------|------|
| 🟢 | **Google Translate** | Neural MT baseline. 194 languages. Key-value strings only — cannot safely translate Markdown content. | ~$20/1M chars |
| 🔵 | **LLM (OpenRouter)** | Any language the model knows. Register-steered prompts. Handles key-value + Markdown content. | Varies by model |
| 🟣 | **LLM-Coached** | LLM + grammar dictionaries + coaching data injected into prompts. Best for morphologically complex languages. | Varies by model |
| 🟠 | **API (Plugin)** | Community-hosted translation pipelines served over HTTP. [Sovereignty-aspirant](/docs/network/community/low-resource-languages). | Varies by provider |

Set `GOOGLE_TRANSLATE_API_KEY` for Google Translate, or `OPENROUTER_API_KEY` for LLM methods. See [Translation Methods](/docs/guides/translation-methods) for full details.

---

## Priority Languages

These are the most commonly requested locales for web and mobile applications, listed in champollion's recommended accessibility-first order.

| Flag | Language | Code | Google | LLM | Coached | Script | Notes |
|------|----------|------|:------:|:---:|:-------:|--------|-------|
| 🇸🇦 | Arabic | `ar` | ✅ | ✅ | ✅ | — | RTL. Modern Standard Arabic (فصحى). |
| 🇵🇭 | Filipino (Taglish) | `tl` / `fil` | ✅ | ✅ | ✅ | — | Use `fil` in Docusaurus configs. champollion resolves both. |
| 🇫🇷 | French | `fr` | ✅ | ✅ | ✅ | — | Vous-form. Gender-inclusive (Connecté·e). |
| 🇪🇸 | Spanish | `es` | ✅ | ✅ | ✅ | — | Neutral Latin American. |
| 🇩🇪 | German | `de` | ✅ | ✅ | ✅ | — | Sie-form. Gender-inclusive (Benutzer:innen). |
| 🇯🇵 | Japanese | `ja` | ✅ | ✅ | ✅ | — | です/ます for body text, する for UI labels. |
| 🇨🇳 | Chinese (Simplified) | `zh` | ✅ | ✅ | ✅ | — | 简体中文. |
| 🇮🇹 | Italian | `it` | ✅ | ✅ | ✅ | — | Lei-form. |
| 🇧🇷 | Portuguese (BR) | `pt` | ✅ | ✅ | ✅ | — | Brazilian Portuguese. |
| 🇰🇷 | Korean | `ko` | ✅ | ✅ | ✅ | — | 해요체 polite register. |

## Major World Languages

| Flag | Language | Code | Google | LLM | Coached | Script | Notes |
|------|----------|------|:------:|:---:|:-------:|--------|-------|
| 🇧🇩 | Bengali | `bn` | ✅ | ✅ | ✅ | — | শুদ্ধ ভাষা preference. |
| 🇧🇬 | Bulgarian | `bg` | ✅ | ✅ | ✅ | — | |
| 🇨🇿 | Czech | `cs` | ✅ | ✅ | ✅ | — | Vykání (vy-form). |
| 🇩🇰 | Danish | `da` | ✅ | ✅ | ✅ | — | |
| 🇬🇷 | Greek | `el` | ✅ | ✅ | ✅ | — | Modern Δημοτική. |
| 🇮🇷 | Persian | `fa` | ✅ | ✅ | ✅ | — | RTL. |
| 🇫🇮 | Finnish | `fi` | ✅ | ✅ | ✅ | — | No grammatical gender. |
| 🇮🇱 | Hebrew | `he` | ✅ | ✅ | ✅ | — | RTL. |
| 🇮🇳 | Hindi | `hi` | ✅ | ✅ | ✅ | — | शुद्ध हिन्दी. Minimal English loanwords. |
| 🇭🇺 | Hungarian | `hu` | ✅ | ✅ | ✅ | — | Ön-form. |
| 🇮🇩 | Indonesian | `id` | ✅ | ✅ | ✅ | — | |
| 🇲🇾 | Malay | `ms` | ✅ | ✅ | ✅ | — | |
| 🇳🇱 | Dutch | `nl` | ✅ | ✅ | ✅ | — | U-form. |
| 🇳🇴 | Norwegian | `nb` | ✅ | ✅ | ✅ | — | Bokmål. |
| 🇵🇱 | Polish | `pl` | ✅ | ✅ | ✅ | — | Pan/Pani form. |
| 🇵🇹 | Portuguese (EU) | `pt-PT` | ✅ | ✅ | ✅ | — | European Portuguese. |
| 🇷🇴 | Romanian | `ro` | ✅ | ✅ | ✅ | — | |
| 🇷🇺 | Russian | `ru` | ✅ | ✅ | ✅ | — | Вы-form. |
| 🇸🇰 | Slovak | `sk` | ✅ | ✅ | ✅ | — | Vykanie (vy-form). |
| 🇷🇸 | Serbian | `sr` | ✅ | ✅ | ✅ | 🔤 Latin→Cyrillic | Deterministic script converter. |
| 🇸🇪 | Swedish | `sv` | ✅ | ✅ | ✅ | — | |
| 🇰🇪 | Swahili | `sw` | ✅ | ✅ | ✅ | — | |
| 🇹🇭 | Thai | `th` | ✅ | ✅ | ✅ | — | ครับ/ค่ะ politeness particles. |
| 🇹🇷 | Turkish | `tr` | ✅ | ✅ | ✅ | — | Siz-form. |
| 🇺🇦 | Ukrainian | `uk` | ✅ | ✅ | ✅ | — | Ви-form. |
| 🇵🇰 | Urdu | `ur` | ✅ | ✅ | ✅ | — | RTL. آپ form. |
| 🇻🇳 | Vietnamese | `vi` | ✅ | ✅ | ✅ | — | |
| 🇹🇼 | Chinese (Traditional) | `zh-TW` | ✅ | ✅ | ✅ | — | 繁體中文. |
| 🇬🇪 | Georgian | `ka` | ✅ | ✅ | — | — | ქართული. Kartvelian family. |
| 🇳🇬 | Yoruba | `yo` | ✅ | ✅ | — | — | Èdè Yorùbá. Tonal (3 tones). |

## Regional Variants

| Flag | Language | Code | Google | LLM | Coached | Script | Notes |
|------|----------|------|:------:|:---:|:-------:|--------|-------|
| 🇲🇽 | Mexican Spanish | `es-MX` | ✅ | ✅ | ✅ | — | Tú-form. Warm register. |
| 🇨🇦 | Canadian French | `fr-CA` | ✅ | ✅ | ✅ | — | Québécois idioms. |

---

## Indigenous & Low-Resource Languages

These languages are not supported by commercial MT services. champollion provides the tooling for language communities to build their own methods under [community data-sovereignty principles](/docs/network/community/low-resource-languages).

| | Language | Code | Google | LLM | Coached | Script | Status |
|---|----------|------|:------:|:---:|:-------:|--------|--------|
| 🪶 | Plains Cree | `crk` | ❌ | ✅ | ✅ | 🔤 SRO→Syllabics | 🚧 Under development |
| 🌄 | Quechua | `qu` | ✅ | ✅ | — | — | Runasimi. Evidential suffixes. |

:::info[Plains Cree is under active development]
The register, coaching infrastructure, script converter, and evaluation harness for Plains Cree are all functional, but the translation pipeline has **not yet been released**. We are working with language communities under [community data-sovereignty principles](/docs/network/community/low-resource-languages) to ensure quality before release. See [Support a Low-Resource Language](/docs/network/community/low-resource-languages) for the full story — and how you can contribute.
:::

:::tip[Adding more low-resource languages]
champollion's method plugin system is designed for this. A language community can build a custom translation method, host it under their own control, and serve it via the [API method](/docs/guides/serving-a-method). The [Method Leaderboard](/leaderboard) tracks scores for any language pair — build a method, run the harness, and claim the top score.
:::

---

## Constructed Languages

Conlangs are supported via LLM registers and optional script converters. They use the same infrastructure as real languages — the quality gate, coaching system, and script conversion pipeline work identically.

| | Language | Code | Google | LLM | Script | Notes |
|---|----------|------|:------:|:---:|--------|-------|
| 🖖 | Klingon | `tlh` | ❌ | ✅ | 🔤 Romanization→pIqaD | PUA font required. Marc Okrand vocabulary. |
| 🧝 | Sindarin (Tolkien Elvish) | `x-elvish-s` | ❌ | ✅ | 🔤 Latin→Tengwar | CSUR PUA font required. |
| 🏴‍☠️ | Pirate English | `x-pirate` | ❌ | ✅ | — | Register only. Nautical metaphors. |
| 🦸 | Kryptonian | `x-kryptonian` | ❌ | ✅ | 🔤 Latin→Kryptonian | PUA font required. |
| 🎭 | Shakespearean English | `x-shakespeare` | ❌ | ✅ | — | Register only. Thee/thou, -eth/-est forms. |
| 🐸 | Yoda-speak | `x-yoda` | ❌ | ✅ | — | Register only. OSV word order. |

See [Conlangs, Scripts & Orthography](/docs/guides/conlangs-scripts-orthography) for PUA font requirements, Unicode limitations, and how to add your own.

---

## Language Presets

The `init` wizard supports preset names for quick setup. You can mix presets with individual codes.

| Preset | Expands To |
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

## Adding Any Language

champollion can translate to **any language your LLM knows** — the table above just lists languages with built-in register presets. To add an unlisted language, include its BCP-47 code in your config:

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

The LLM will translate using its training knowledge of the language. Setting a `register` gives you control over tone, formality, and orthographic conventions. See [Configuration](/docs/getting-started/configuration) for details.

---

## Language Cards {#language-cards}

Each built-in language has a **Language Card** — a unified JSON file in `shared/language-cards/` containing all metadata: registers, formality, method support, typography rules, genealogical classification, linguistic challenges, and NLP resources.

### Unified Card Architecture

Each card is loaded eagerly at import. There is no separate reference tier — all data lives in a single file per language. Cards are enriched from authoritative sources:

| Source | Data |
|--------|------|
| [Glottolog](https://glottolog.org) | Family classification, ancestry chain, Glottocode |
| [WALS](https://wals.info) | Genus classification, typological features |
| [CLDR](https://cldr.unicode.org) | Script, direction, plural rules, typography |
| [ISO 15924](https://unicode.org/iso15924/) | Script codes |

### Key Card Fields

| Field | What It Contains |
|-------|------------------|
| **`nativeName`** | Endonym — the language's name for itself, in its own script (e.g., ქართული, Runasimi) |
| **`classification`** | Genealogical anchor: family, genus, full ancestry chain from Glottolog |
| **`contactInfluences`** | Universal contact history — borrowing layers, superstrates, substrates |
| **Formality system** | T-V distinction, speech levels, keigo, particles, etc. |
| **Register presets** | Named LLM prompt presets specific to the language's character |
| **Method support** | Which translation APIs support this language |
| **Gender guidance** | Grammatical gender rules and inclusive writing tips |
| **Script/direction** | ISO 15924 script code and RTL/LTR |
| **Rules** | Typography (quotes, spacing), capitalization, plural categories |
| **`glottocode`** | Canonical Glottolog identifier for cross-referencing |
| **`dataSources`** | Provenance tracking (e.g., `["glottolog-5.3", "cldr-48"]`) |

### Scaffolding a New Language Card

Use the generator to scaffold a card from authoritative data sources (IANA, CLDR, Glottolog):

```bash
# Preview what would be generated
node scripts/generate-language-card.mjs sw --dry-run

# Generate a unified card
node scripts/generate-language-card.mjs sw
```

The generator auto-populates metadata (codes, script, direction, plurals, quotes, method support, classification) and marks linguistic judgment fields as TODO for human curation.

### Using Preset Keys

Instead of writing full register text, you can use a preset key name:

```json
{
  "languages": {
    "fr": "casual-tu",
    "ko": "formal-hapsyo",
    "ja": "polite"
  }
}
```

Champollion resolves the key to the full register prompt. Run `npx champollion init` to see available presets for each language.

### Example Presets

| Language | Presets | Default |
|----------|---------|--------|
| French | `formal-vous`, `casual-tu` | `formal-vous` |
| Korean | `polite-haeyo`, `formal-hapsyo`, `casual-hae` | `polite-haeyo` |
| Japanese | `polite`, `formal-keigo`, `casual` | `polite` |
| German | `formal-Sie`, `casual-du` | `formal-Sie` |
| Thai | `neutral-professional`, `polite-male`, `polite-female` | `neutral-professional` |
| Spanish | `neutral-professional`, `formal-usted`, `casual-tuteo` | `neutral-professional` |

See [Contributing a Language Card](https://github.com/gamedaysuits/champollion) for the full spec, including field validation and PR checklist.

---

## See Also

- [Configuration](/docs/getting-started/configuration) — full config reference including language setup
- [Translation Methods](/docs/guides/translation-methods) — how each method works
- [Script Converters](/docs/concepts/script-converters) — deterministic script conversion pipeline
- [Conlangs, Scripts & Orthography](/docs/guides/conlangs-scripts-orthography) — PUA fonts, Unicode, adding conlangs
- [Support a Low-Resource Language](/docs/network/community/low-resource-languages) — building methods for underserved languages

