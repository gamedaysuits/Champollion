---
id: how-this-site-is-translated
title: How this site is translated
description: Every locale on this site is machine-translated by Champollion itself — the same CLI these docs describe. We dogfood our own tool.
---

# How this site is translated

This site is available in 13 languages. Every locale except English is
**machine-translated by Champollion itself** — the same CLI these docs
describe (`npx champollion sync`). We dogfood our own tool.

Right now every language pair uses a single model:
**`google/gemini-3.1-pro-preview`**, translating with the per-language
register and terminology guidance described below. We chose one model
deliberately as an honest default while we rebuild our benchmark-based
model selection (see below) — so this is a plain, documented choice, not a
result we're dressing up as something it isn't.

Two things you should know as a reader:

1. **These pages are machine translations.** They are produced with the
   register and terminology guidance described below, but no human reviewed
   every sentence. If something reads wrong, the English version is
   authoritative — and we'd love a correction.
2. **The model is one default today, chosen per benchmark tomorrow.**
   Champollion's design is to pick the translation model *for each language
   pair* by benchmark — score every candidate on a development corpus and
   translate that locale with the highest-scoring method (statistical ties
   broken by cost). We are re-running that selection through our own
   integrity gate before we pin per-pair winners here. **Until those runs
   are published on the [Network leaderboard](/leaderboard), this page will
   not claim a benchmark provenance it can't show you.**

## Provenance by locale

| Locale | Language | Method | Model | Register | Last synced |
|--------|----------|--------|-------|----------|-------------|
| fr | Français | llm | `google/gemini-3.1-pro-preview` | formal *vous* | 2026-07-18 |
| de | Deutsch | llm | `google/gemini-3.1-pro-preview` | Sie-Form | 2026-07-18 |
| nl | Nederlands | llm | `google/gemini-3.1-pro-preview` | u-vorm | 2026-07-18 |
| fil | Filipino | llm | `google/gemini-3.1-pro-preview` | formal | 2026-07-18 |
| es | Español | llm | `google/gemini-3.1-pro-preview` | neutral Latin American | 2026-07-18 |
| zh | 简体中文 | llm | `google/gemini-3.1-pro-preview` | professional technical | 2026-07-18 |
| ja | 日本語 | llm | `google/gemini-3.1-pro-preview` | です/ます (polite) | 2026-07-18 |
| ko | 한국어 | llm | `google/gemini-3.1-pro-preview` | 해요체 (polite) | 2026-07-18 |
| pt | Português | llm | `google/gemini-3.1-pro-preview` | professional | 2026-07-18 |
| th | ไทย | llm | `google/gemini-3.1-pro-preview` | neutral professional | 2026-07-18 |
| vi | Tiếng Việt | llm | `google/gemini-3.1-pro-preview` | neutral *bạn*-form | 2026-07-18 |
| ar | العربية | llm | `google/gemini-3.1-pro-preview` | MSA, professional | 2026-07-18 |

## The benchmark selection we're rebuilding

The intended method — and how the config is structured to work — is
per-pair model selection driven by our own evaluation: score every
candidate model on the pair's development corpus, take the highest
composite score, and break statistical ties by cost. The full loop is
documented for anyone who wants to reproduce it.

We are **not** publishing composite scores or a "benchmark winner" per
language on this page today, because the selection sweep that would back
those numbers is being re-run through the harness integrity gate first.
When it lands, the runs will be on the public leaderboard, this table will
carry each pair's winning model with its cited run, and the site config
will re-pin per-pair winners. Until then: one honest default.

*Composite score* is the Network's blended quality metric (chrF++, exact
match, and loaded metric plugins, bootstrap-CI verified). Scores are only
comparable **within a language pair**, never across pairs — script and
corpus differences make cross-pair comparison meaningless.

## Register and tone

Each language is translated with an explicit register chosen from
Champollion's language cards, so formality is consistent site-wide:

- **Français** — vouvoiement (formal *vous*)
- **Deutsch** — Sie-Form
- **Nederlands** — u-vorm
- **Filipino** — formal, with standard technical terms
- **Español** — neutral Latin American Spanish
- **简体中文** — professional technical register
- **日本語** — です/ます (polite form)
- **한국어** — 해요체 (polite)
- **Português** — professional register
- **ไทย** — neutral professional
- **Tiếng Việt** — neutral *bạn*-form
- **العربية** — Modern Standard Arabic, professional register

## What is not machine-translated

Code blocks, CLI commands, configuration keys, package names, URLs, and
proper nouns are protected during translation and remain in English by
design.

## Found a mistranslation?

Open an issue or PR — the source of every translated page is the English
original. Corrections to a translated page are preserved on future syncs as
long as the English source of that page is unchanged (sync re-translates a
page only when its English source changes).

*This page is itself machine-translated by the method described above — it
describes its own translation.*
