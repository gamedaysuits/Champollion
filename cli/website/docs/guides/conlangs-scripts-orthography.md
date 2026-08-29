---
sidebar_position: 3
title: "Conlangs, Scripts & Orthography"
---

# Conlangs, Scripts & Orthography

champollion has first-class support for constructed languages via LLM registers and deterministic script converters. This guide covers how conlang support works, what fonts you need, and how to add your own.

:::tip[Why conlangs matter]
Conlangs aren't just novelty — they exercise the exact same infrastructure used for real underserved languages. The quality gate, coaching system, and script conversion pipeline work identically for Klingon and Plains Cree. If your conlang pipeline works, your low-resource language pipeline will too.
:::

---

## Supported Constructed Languages

| Language | Code | Script Converter | Font Required |
|----------|------|:----------------:|:-------------:|
| Klingon | `tlh` | ✅ Romanization → pIqaD | PUA font (e.g., pIqaD qolqoS) |
| Sindarin (Tolkien Elvish) | `x-elvish-s` | ✅ Latin → Tengwar | CSUR PUA font |
| Kryptonian | `x-kryptonian` | ✅ Latin → Kryptonian | PUA font |
| Pirate English | `x-pirate` | ❌ register only | None |
| Shakespearean English | `x-shakespeare` | ❌ register only | None |
| Yoda-speak | `x-yoda` | ❌ register only | None |

Conlang codes use the `x-` prefix per BCP-47 private-use convention, except Klingon (`tlh`) which has an [ISO 639-3](https://iso639-3.sil.org/code/tlh) code assigned by SIL International.

---

## Unicode, PUA, and Font Requirements

### The Private Use Area

Klingon (pIqaD), Sindarin (Tengwar), and Kryptonian use Unicode **Private Use Area (PUA)** characters. PUA is the range U+E000–U+F8FF — these codepoints have **no standard assignment**. The [ConScript Unicode Registry (CSUR)](https://www.evertype.com/standards/csur/) maintains community-agreed mappings for fictional scripts, but these are not part of the Unicode standard.

What this means in practice:

- PUA text renders as **empty boxes** (□□□) without the correct font loaded
- Different fonts may map different glyphs to the same PUA codepoints
- champollion does NOT bundle PUA fonts — you must load them yourself
- System fonts will never render these characters

### PUA Ranges by Script

| Script | PUA Range | CSUR Reference |
|--------|-----------|---------------|
| Klingon (pIqaD) | U+F8D0–U+F8FF | [CSUR Klingon](https://www.evertype.com/standards/csur/klingon.html) |
| Tengwar (Elvish) | U+E000–U+E07F | [CSUR Tengwar](https://www.evertype.com/standards/csur/tengwar.html) |
| Kryptonian | Varies by font | No CSUR standard |

### Loading PUA Web Fonts

champollion includes a built-in command to download and manage PUA web fonts:

```bash
# See which fonts are needed for your configured languages
champollion fonts list

# Download all needed fonts (auto-detects project type for output directory)
champollion fonts install

# Also generate a CSS snippet with @font-face declarations
champollion fonts install --css
```

The `fonts install` command downloads from verified open-source repositories:

| Font | Script | License | Source |
|------|--------|---------|--------|
| pIqaD qolqoS | Klingon | SIL Open Font License 1.1 | [GitHub](https://github.com/dadap/pIqaD-fonts) |
| FreeMonoTengwar | Tengwar | GNU GPL v3 (with font exception) | [SourceForge](https://sourceforge.net/projects/freetengwar/) |
| *(user-provided)* | Kryptonian | Varies | No open-source PUA font available |

The output directory is auto-detected from your project structure (Docusaurus → `static/fonts/`, Hugo → `static/fonts/`, default → `public/fonts/`). Override with `--dir`.

If you prefer to manage fonts manually, add `@font-face` rules in your CSS:

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

:::warning[Unicode support is NOT guaranteed]
The Unicode Consortium has [explicitly declined](https://www.unicode.org/faq/private_use.html) to encode fictional scripts in the standard. PUA assignments are community-maintained and may conflict between font implementations. Always specify the exact font your project uses, and test rendering across browsers.
:::

---

## Script Converters

### How They Work

champollion's script conversion is a **post-translation hook, applied only when the config asks for it**:

1. The LLM translates text into a **working script** (usually Latin or SRO)
2. The [quality gate](/docs/concepts/quality-gate) validates the output
3. If the pair's `script:` setting selects the display script, the deterministic converter transforms the validated text — values with letters the converter cannot map stay whole in the working script, warned per key
4. The result is written to disk

This two-step approach works because LLMs produce better output when working in Latin-based scripts. The deterministic converter guarantees correct script output without relying on the model's (often unreliable) script knowledge.

Whether step 3 runs at all is a per-project decision — see [Script Conversion](/docs/getting-started/configuration#script-conversion). The PUA display scripts (pIqaD, Tengwar, Kryptonian) are off by default because they render as nothing without a purpose-built font; crk and sr have no default at all, because both of their orthographies are real and the choice belongs to the project.

### All Five Converters

champollion ships with five built-in script converters:

#### Plains Cree: SRO → Syllabics (`crk`)

Standard Roman Orthography to Canadian Aboriginal Syllabics.

```
Input:  "tawâw"
Output: "ᑕᐚᐤ"
```

Long vowels use macron/circumflex: ê, î, ô, â. The converter handles all SRO diacritics and maps them to the correct syllabic characters. See [Support a Low-Resource Language](/docs/network/community/low-resource-languages) for the full Cree pipeline.

#### Serbian: Latin → Cyrillic (`sr`)

Deterministic Latin-to-Cyrillic conversion for Serbian.

```
Input:  "zdravo"
Output: "здраво"
```

This handles the full Serbian alphabet mapping including digraphs (lj → љ, nj → њ, dž → џ).

#### Klingon: Romanization → pIqaD (`tlh`)

Marc Okrand's romanization system to pIqaD PUA characters.

```
Input:  "Qapla'"    (romanized Klingon)
Output: [pIqaD PUA] (requires pIqaD font to render)
```

#### Sindarin: Latin → Tengwar (`x-elvish-s`)

Tolkien's Sindarin mode Tengwar mapping.

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

### Triggering a Converter

Set the `script` field to the ISO 15924 code of the orthography you want written:

```json
{
  "languages": {
    "sr": { "script": "Cyrl" },
    "crk": { "script": "Cans" },
    "tlh": { "script": "Piqd" }
  }
}
```

Nothing converts without this. For `crk` and `sr` the field is **required** — both of their orthographies are real, and `sync` refuses to pick one for you. For the PUA locales it is an opt-in over the romanization default. See [Script Conversion](/docs/getting-started/configuration#script-conversion).

---

## Multi-Script Languages

Some real languages use multiple active scripts:

| Language | Scripts | champollion Approach |
|----------|---------|-----------------|
| Serbian | Latin + Cyrillic | One locale, explicit choice: `"script": "Cyrl"` converts, `"script": "Latn"` keeps Latin |
| Plains Cree | SRO (Latin) + Syllabics | One locale, explicit choice: `"script": "Cans"` or `"script": "Latn"` |
| Chinese | Simplified + Traditional | Separate locale codes (`zh` vs `zh-TW`) with distinct registers |

For languages where both scripts serve the same audience (Serbian, Plains Cree), one locale plus an explicit `script` choice keeps a single translation pipeline. For languages where the scripts serve different audiences (Chinese Simplified for mainland China, Traditional for Taiwan/HK), use separate locale codes.

---

## Orthography Notes

Registers aren't just tone — they carry **orthographic instructions** that steer the LLM toward correct writing conventions.

### Formal Address Forms

champollion's built-in registers include the culturally appropriate formal address for each language:

| Language | Formal Form | Register Instruction |
|----------|------------|---------------------|
| German | Sie | `Use Sie-form for formal address` |
| French | vous | `Use vous-form` |
| Russian | вы | `Professional register with вы-form` |
| Turkish | siz | `Professional register with siz-form` |
| Korean | 합쇼체 | `Formal Korean (합쇼체)` |
| Japanese | です/ます | `Polite professional register (です/ます form)` |
| Polish | Pan/Pani | `Professional register with Pan/Pani form` |

### Gender-Inclusive Writing

Each language card has a `gender.inclusiveGuidance` field with language-specific advice. This is injected into the LLM translation prompt separately from the register preset, so it applies consistently regardless of which formality preset the user chooses:

- **French**: Écriture inclusive with interpunct notation (e.g., "Connecté·e")
- **German**: Doppelpunkt notation (e.g., "Benutzer:innen")
- **Spanish**: Gender-neutral restructuring preferred; slash notation (e.g., "usuario/a") as fallback

For languages without specific guidance in their card (e.g., Korean, conlangs), the system falls back to a generic rule: *"prefer gender-neutral forms or the most inclusive option available."*

### RTL Script Requirements

Arabic, Hebrew, Persian, and Urdu registers all note right-to-left requirements: `Ensure text reads naturally in RTL layout contexts.`

### Overriding Any Register

Every register is a config value — override it to match your project's voice:

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

See [Configuration](/docs/getting-started/configuration) for the full config reference.

---

## Adding a New Conlang

### Step-by-step

1. **Choose a BCP-47 private-use code**: Use the `x-` prefix (e.g., `x-dothraki`, `x-valyrian`).

2. **Add to your config**:

```json
{
  "languages": {
    "x-dothraki": {
      "register": "Dothraki language. Use David J. Peterson's vocabulary from the Living Language Dothraki textbook. Harsh, direct tone. No articles, no verb 'to be'."
    }
  }
}
```

3. **(Optional) Add a script converter**: If your conlang uses a non-Latin display script, add a converter in `lib/scripts.js` and register it in `SCRIPT_CONVERTERS`.

4. **Test**: Run `champollion sync --dry` to preview translations without writing files.

5. **Check the quality gate**: The [quality gate](/docs/concepts/quality-gate) may need tuning for your conlang — particularly the `requireNonLatin` check if your conlang uses PUA characters.

:::note[Conlang quality depends on LLM knowledge]
The LLM can only translate into a conlang it has seen in training data. Well-documented conlangs (Klingon, Sindarin, Dothraki) work well. Obscure or newly invented conlangs may produce inconsistent results. Use [coaching data](/docs/concepts/coaching-data) to improve quality.
:::

---

## See Also

- [Supported Languages](/docs/reference/supported-languages) — full language table with method availability
- [Script Converters](/docs/concepts/script-converters) — technical details of the conversion pipeline
- [Translation Methods](/docs/guides/translation-methods) — how each translation method works
- [Configuration](/docs/getting-started/configuration) — config reference including language and register setup
- [Support a Low-Resource Language](/docs/network/community/low-resource-languages) — the same infrastructure applied to real underserved languages
