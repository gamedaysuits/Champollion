---
title: Translate an app or website
slug: /translate-an-app-or-website
description: "Translate the words on an app's or website's screens into your language, keep them up to date as the original changes, and choose which translator does each language."
---

# Translate an app or website

Apps and websites keep their words — buttons, menus, messages, pages — in
files, one per language. Champollion can fill in your language's file for
you, and keep it up to date whenever the original changes. One command does
it:

```bash
npx champollion sync
```

It finds your app's language files, translates only what's missing or
changed, checks every translation before writing it, and leaves the rest
alone.

## Which translator does the work

You choose, for each language:

- **Your own translator**, built on the rails — the tools connect it to your
  app. If it learned from private sentences, it connects only once you've
  named who, among the people who hold the words, agreed.
- **An AI model or a translation service** — for languages they already
  handle well. These send your app's words to the company that runs them, so
  use them for text that is fine to share.
- **Your own service**, at an address you give.

## What it takes care of

- **Only what changed.** It remembers what it translated before, so you never
  pay twice for the same sentence.
- **Checks before writing.** Empty answers, the original copied back, words
  repeating in a loop, text much longer than it should be, missing pieces, or
  the wrong alphabet are caught and refused. These checks catch broken output,
  not wrong meaning — a speaker still has the last word.
- **Your files, your format.** JSON, YAML, TOML and Markdown pages, and the
  common app and website frameworks.

## Who may use it

Free for noncommercial use — a school's app, a community website, a public
service. A business's product is not covered by the free licence; if a speaker
community wants to use it commercially, ask, and the licence is free.
[Who may use this](/docs/getting-started/who-may-use-this) has the details.

**Next:** [Host a sealed test →](/docs/host-a-sealed-test)

## Go deeper

- [App and site translation](/docs/intro) — the full reference: quick start,
  configuration, frameworks, translation memory, the quality checks, CI.
- [Serving and deployment](/docs/agents/serving) — connecting your own
  translator.
