---
sidebar_position: 1
slug: /intro
title: App and site translation
description: "The reference for translating an app's or a website's own files with `champollion sync`: what it does, when to use it, and a guide to every page about it."
related:
  - label: "Quick Start"
    to: /docs/getting-started/quick-start
    kind: guide
    note: "Install, configure, and run your first sync"
  - label: "How Sync Works"
    to: /docs/concepts/how-sync-works
    kind: doc
    note: "The pipeline behind every translation"
  - label: "Translation Methods"
    to: /docs/guides/translation-methods
    kind: guide
    note: "LLM, machine-translation APIs, your own model — when to use which"
  - label: "Translate an app or website"
    to: /docs/translate-an-app-or-website
    kind: guide
    note: "The same lane, in plain words"
---

# App and site translation

`champollion sync` keeps an app's or a website's translations in step with its
source language. It reads your locale files (or your Markdown pages), finds
what is missing or out of date, translates only that, checks each result, and
writes it back in the file's own format.

```bash
npx champollion sync
```

This section is the reference for that lane. If you want the plain-words
version first, read [Translate an app or website](/docs/translate-an-app-or-website).

## What `sync` does

1. **Finds your files.** It detects the locale folder and format (JSON, TOML,
   YAML, gettext PO, Flutter ARB), or a folder of Markdown/MDX pages (Hugo,
   Docusaurus, or any folder you name with `--content-dir`).
2. **Works out what changed.** Every source value is recorded by its SHA-256
   hash in `.champollion.lock`. Keys that are missing, empty, or whose source
   text changed are queued; everything else is left alone.
3. **Translates with the method you chose for each pair.** One config file can
   send one pair to an LLM, another to a machine-translation API, and a third
   to a model you trained and serve yourself. LLM methods translate at
   temperature 0 by default (the one default in `shared/model-defaults.json`);
   a hosted model can still vary a little between runs, which is one reason
   the Translation Memory keeps what it already got.
4. **Reuses what it already paid for.** The Translation Memory caches each
   translation by source text, locale and method: text that comes back (a
   string changed back, the same sentence in another file, a redo) is free.
5. **Checks every result before writing it.** The quality gate refuses empty
   output, a copy of the source, repetition loops, wrong-script output,
   damaged placeholders and similar breakage, with one feedback retry. It
   catches broken output, not wrong meaning.
6. **Verifies after writing.** A post-sync pass re-reads the written files and
   checks key parity, empty values, script and placeholders;
   `champollion verify` and `champollion audit` run the same kind of checks as
   CI gates.

Nothing is written silently. A key the gate still refuses after its retry is
left untranslated and reported, and the sync exits `2`. The refusal is
remembered, so the next plain sync does not pay the same model for the same
answer: you ask again with `--redo`, add a `fallback` method to the pair, or
write the value by hand.

## When to use it

- You have an app or a website whose text lives in locale files or Markdown,
  and you want its other languages kept current as the source changes.
- You want a different method per language pair in one project, with spending
  bounded (`--max-cost`) and visible before anything is billed (`--dry`).
- You built a translator on the rails and want an app to use it:
  `champollion connect` puts a served model into an app project, and `sync`
  then translates with it. A model trained on local-only data is connected
  only when its holders have agreed.

`sync` is not how you build a translator for a language no service handles
well. For that, start at [Start a project](/docs/start).

## The pages in this section

**Getting started**

- [Quick Start](/docs/getting-started/quick-start) — a first sync in minutes.
- [Installation](/docs/getting-started/installation) — requirements, API keys,
  and the licence.
- [Configuration](/docs/getting-started/configuration) — every field in
  `champollion.config.json`, per-pair settings, locale layouts, and fallbacks.

**Your framework and your pipeline**

- [Framework integrations](/docs/integrations/frameworks) — Hugo, next-intl,
  react-i18next, Flutter, and Django with gettext.
- [CI/CD](/docs/guides/ci-cd) — `lint`, `sync`, `verify` and `audit` as gates.
- [Content translation](/docs/guides/content-translation) — Markdown and MDX
  pages, front matter, and what is preserved.

**Choosing how it translates**

- [Translation methods](/docs/guides/translation-methods) — every method,
  its key, and when to use it.
- [Coaching data](/docs/concepts/coaching-data) — grammar notes and word lists
  given to an LLM alongside each request.
- [Script converters](/docs/concepts/script-converters) and
  [Conlangs, scripts & orthography](/docs/guides/conlangs-scripts-orthography)
  — writing systems, fonts, and invented languages.

**How it works inside**

- [How sync works](/docs/concepts/how-sync-works) — the pipeline, step by step.
- [Translation memory](/docs/concepts/translation-memory) — the cache, and what
  it keys on.
- [Quality gate](/docs/concepts/quality-gate) — every check, and what happens
  to a refused key or block.
- [Security](/docs/concepts/security) — crafted keys and paths, protected
  code blocks, and failing loudly.

**People and problems**

- [Working with professional translators](/docs/guides/professional-translators)
  — XLIFF export and import for review.
- [Troubleshooting](/docs/guides/troubleshooting) — common errors and fixes.

Every command and flag is in the [CLI reference](/docs/reference/cli), and the
method plugin format is in the [Plugin Specification](/docs/reference/plugin-spec).

## Licence

The `champollion` CLI is source-available under the
[PolyForm Noncommercial License 1.0.0](https://github.com/gamedaysuits/Champollion/blob/main/cli/LICENSE);
[who may use it](/docs/getting-started/who-may-use-this) says who is covered.
Having trouble, or want help with your project? [Let's talk](/docs/getting-help).
