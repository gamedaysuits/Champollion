---
title: Put it to work
slug: /put-it-to-work
description: "Using your translator: try it in your browser, translate documents, run it as a service, or connect it to an app — and who decides what may leave your computer."
---

# Put it to work

A translator is for using. Here are the ways to use yours, from the simplest
to the biggest — and the one rule that runs through all of them: **the people
who hold the words decide what leaves your computer.**

## Try it in your browser

The quickest way. The tools start your translator on your computer and give
you a page to open in your web browser. Type a sentence, see the translation.
Nothing leaves your computer. If your sentence has a word the translator never
saw in its lessons, the page says which — that line is very likely wrong,
however fluent it reads.

If your translator learned from private sentences, it can repeat them — so
the rails' try tool won't pass its translations to your AI assistant (that
would send them to the assistant's company). It gives you the page's address
instead, and you look there yourself. An assistant that can run commands on
your computer could still ask the translator directly, so ask it not to.

## Translate documents

Give the tools a file of sentences, and they translate every line into a new
file, on your computer, using the settings the translator was tested with.
The new file is held to the same rules as the sentences the translator
learned from.

## Run it as a service

The tools can run your translator as a small service on your computer, so
other programs can ask it for translations. By default, only programs on the
same computer can reach it, and it can require a password.

Making it reachable from other computers is a bigger step. For a translator
that learned from private sentences, the tools refuse until you name who,
among the people who hold the words, agreed — and that is written down.

## Connect it to an app

If you're building an app, the tools can connect your translator to it, so the
app's words are translated by your translator. The same rule applies: a
translator that learned from private sentences connects only once you've
named who agreed.

## On other computers and phones

Your translator lives on the computer that built it. For a school or an office
to use it from other computers or phones, it has to be reachable from them —
by running it as a service on your network, or inside an app. Both are bigger
steps, and for a translator that learned from private sentences, both wait for
the people who hold the words to agree. If you'd like a hand with this part,
[let's talk](/docs/getting-help).

## Translate an app or website's words

For translating the buttons, menus and pages of an app or website — and
keeping them up to date as the original changes —
[Translate an app or website](/docs/translate-an-app-or-website) has the whole
story.

## In daily use: a speaker has the last word

However good the scores, a person who speaks the language should read anything
before it's published. A good way to work is drafts: the translator writes, a
speaker corrects. Every correction is also a gift to the next round — it's
exactly where the translator went wrong.

When something wrong does get out, fix it in the open and say what changed.
Mistakes caught and owned build more trust than a translator that claims to
be perfect.

**Next:** [Your words, your rules →](/docs/your-words-your-rules)

## Go deeper

- [Serving and deployment](/docs/agents/serving) — the deployment file,
  `mt-eval translate` and `serve`, the try page, `champollion connect`, and
  the exact rules for private output.
- [Data and transmission rules](/docs/agents/data-rules) — why a translator
  trained on private sentences is private too.
- [App and site translation](/docs/intro) — the full reference for
  translating an app's or website's text.
