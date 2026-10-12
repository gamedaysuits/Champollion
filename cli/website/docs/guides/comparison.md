---
sidebar_position: 7
title: Comparison
---

# How Champollion Compares

champollion occupies a different category than most localization tools. Here's an honest comparison.

## The Landscape

Most localization tooling falls into one of three categories:

| Category | Examples | Model |
|----------|----------|-------|
| **Cloud TMS Platforms** | Crowdin, Phrase, Locize, Tolgee | SaaS dashboard + human translators + monthly subscription |
| **Key Extraction Tools** | i18next-scanner, FormatJS CLI | Scan source code for translation function calls |
| **CLI Translation Engines** | **champollion** | Run in your project, translate files directly, no cloud account |

Champollion is a **CLI translation engine** — it translates your locale files directly using configurable backends (LLMs, Google Translate, custom plugins). No cloud dashboard, no human translator workflow, no monthly fee.

---

## Feature Comparison

| Feature | champollion | Crowdin | Phrase | Locize |
|---------|:------------:|:-------:|:------:|:------:|
| **Runs locally (no cloud account)** | ✅ | ❌ | ❌ | ❌ |
| **Minimal dependencies** | ✅ | ❌ | ❌ | ❌ |
| **Per-pair method configuration** | ✅ | ❌ | ❌ | ❌ |
| **Custom language registers** | ✅ | ❌ | ❌ | ❌ |
| **Content-aware (shields code blocks)** | ✅ | ❌ | ❌ | ❌ |
| **Conlang & script conversion** | ✅ | ❌ | ❌ | ❌ |
| **Plugin architecture** | ✅ | ❌ | ❌ | ❌ |
| **Markdown / content translation** | ✅ | ✅ | ✅ | ❌ |
| **Translation Memory** | ✅ | ✅ | ✅ | ✅ |
| **XLIFF export/import** | ✅ | ✅ | ✅ | ❌ |
| **ICU plural validation** | ✅ | ✅ | ✅ | ❌ |
| **Terminology enforcement** | ✅ | ✅ | ✅ | ❌ |
| **Human translator workflow** | XLIFF-based | ✅ | ✅ | ✅ |
| **In-context editing (visual)** | ❌ | ✅ | ✅ | ✅ |
| **Team collaboration** | ❌ | ✅ | ✅ | ✅ |
| **File format support** | JSON, TOML, YAML, MD, XLIFF | 50+ | 40+ | JSON |
| **Pricing** | Free for noncommercial use (pay your LLM) | From $0/mo | From $0/mo | From $0/mo |

---

## When to Use Champollion

**Champollion is a good fit when:**

- You want machine translation baked into your build pipeline — not a separate workflow
- You need per-language method control (LLM for some, Google Translate for others, custom plugins for the rest)
- You're translating to languages with no API coverage (Indigenous, endangered, constructed)
- You want deterministic script output (Cree Syllabics, Klingon pIqaD, Tengwar)
- You want zero vendor lock-in and zero cloud dependencies
- You're a solo developer or small team that doesn't need a full TMS dashboard
- You want XLIFF-based handoff to professional translators without a cloud subscription

**A cloud TMS is a better fit when:**

- You have professional human translators reviewing every string (champollion's XLIFF workflow is simpler than a full TMS)
- You need cross-project translation memory and glossary management
- You need in-context visual editing (preview translations inside your UI)
- You have a large team with role-based access control needs
- You need 50+ file format support

---

## What Champollion Does That Nobody Else Does

### 1. Custom Registers

Every language pair gets culturally-appropriate tone instructions for the LLM:

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

No other tool ships with 47 pre-configured language registers, or lets you define custom ones per project.

### 2. Deterministic Script Converters

Champollion ships five built-in script converters that run as post-translation hooks — no LLM needed:

| Locale | Conversion | Example |
|--------|-----------|---------|
| `crk` | SRO → Cree Syllabics | `nêhiyawêwin` → `ᓀᐦᐃᔭᐍᐏᐣ` |
| `sr` | Latin → Cyrillic | `Beograd` → `Београд` |
| `tlh` | Romanization → pIqaD | `tlhIngan Hol` → (pIqaD glyphs) |
| `x-elvish-s` | Latin → Tengwar | Sindarin → Tengwar (Mode of Beleriand) |
| `x-kryptonian` | Latin → Kryptonian | Cipher-substitution (requires font) |

These are pure lookup-table converters — deterministic, auditable, zero LLM hallucination risk.

### 3. Content-Aware Shielding

When translating Markdown or rich content, Champollion shields:

- Fenced code blocks (` ``` `)
- Inline code (`` ` ` ``)
- Hugo shortcodes (`{{</* */>}}`, `{{%/* */%}}`)
- Interpolation variables (`{{ .Count }}`, `{name}`, `{{t('key')}}`)
- Raw HTML blocks

These are replaced with Unicode sentinel tokens before translation and restored afterward. The LLM never sees your code, your shortcodes, or your variables.

### 4. Coached Method Plugins

For languages with no API coverage, you can build a coached translation method:

1. Write linguistic coaching data (grammar rules, vocabulary, examples)
2. Bundle it as a plugin
3. Benchmark it against reference translations using the [eval harness](https://github.com/gamedaysuits/Champollion)
4. Install it in your project with `champollion plugin install`

This is how champollion handles Plains Cree — and how you can handle any language, including ones that don't exist yet.

---

## The Bottom Line

Champollion is not a replacement for Crowdin. It's a different tool for a different workflow. If you need human translators, use a TMS. If you need a CLI that translates your files with one command and gives you per-language control over methods, models, and registers — use champollion.
