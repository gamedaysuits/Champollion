---
title: How it works
slug: /how-it-works
description: "What 'on rails with guardrails' means: every step of building a translator laid out in order, with checks that stop the usual mistakes and keep your words under your control."
---

# How it works: on rails with guardrails

Picture two lines running side by side: a sentence in one language, and the
same sentence in the other. That's what a translator learns from, and what it
writes.

Building one used to take a specialist. You had to know how to prepare the
sentences, how to teach a translator, and — hardest of all — how to test it
without fooling yourself. Most of those lessons were learned the hard way.

Champollion lays all of it out as **rails**: every step in order, and a place
for everything. Along the rails run **guardrails**: checks that stop the
usual mistakes and keep your words under your control. You — or an AI
assistant you trust — follow the rails. You make the decisions.

## Who decides what

The rails do the steps. People decide. Every step is one of four kinds:

- **Only a person can do it** — writing sentences, and checking translations.
  No tool pretends to be a speaker.
- **Only you can answer** — who your words belong to, whether a translator
  may learn from them, what you expect before you see any result. Your
  assistant asks; it never answers for you.
- **Your assistant asks first** — anything that installs something, teaches a
  translator, costs money or puts anything online waits for your yes. *Not
  now* is an answer too: the rails won't ask again that session.
- **Your assistant just does it** — like checking sentences for problems, or
  setting some aside.

## The rails: a place for everything

A project is one folder on your computer, with a shelf for each kind of thing:

| Shelf | What goes on it |
|---|---|
| Sentences to learn from | Pairs of sentences, one in each language |
| Test sentences | Sentences a fluent speaker checked. Used only to judge, never to learn from |
| Word lists | Dictionaries and word lists |
| Grammar notes | Anything written about how the language works |
| Agreements | Notes of who agreed to what, and when |
| Inbox | Your files, as you have them, waiting to come in |

The translators you build, their results, and a record of every step get
shelves of their own.

Your sentences end up in three piles. Most are for **learning**. Some — a
quarter at first, one in ten once you have many — become **practice
sentences** — like practice questions, used every round
to see how it's doing. A few, checked by a speaker, are the **test
sentences**, used only now and then. The translator never learns from the
last two.

Because everything has its place, the tools can always see what's done and
what comes next. Ask them at any moment and they name **the next step**, read
straight from the folder. Your assistant doesn't have to be an expert, or
remember where you left off. It follows the rails.

The steps come in this order:

1. **Start the project** — name the two languages, and which way you're
   translating.
2. **Gather your data** — bring in what you have, and record who it belongs
   to and how it may be used.
3. **Protect your test set** — set aside the sentences you'll judge every
   translator on.
4. **Install the training tools** — once, with your yes.
5. **Build and test a translator** — teach it, then see how it does on the
   test sentences.
6. **Make it better, round by round** — a speaker checks its drafts, and each
   round aims at what it gets wrong.

You can always do a step your own way — by hand, or with other tools — and
the rails pick up from wherever the folder says you are.

## The guardrails

The guardrails come in two kinds.

**Some stop you from fooling yourself.** A translator tested on sentences it
already learned looks brilliant and isn't. A lucky round looks like progress.
So the rails:

- set the test sentences aside before any teaching starts,
- take out sentences that nearly copy them,
- ask you to write down what you expect before you see a result,
- and only call a new translator better when it beats the old one by more
  than luck.

**Some keep your words under your control.** Each file gets a note saying what
the people it belongs to decided — may it leave this computer, may a
translator learn from it — and every tool obeys the note.

The tools refuse to skip most of these checks. A few depend on you and your
assistant, and [the guardrails page](/docs/guardrails) says which.

**Next:** [The guardrails, one by one →](/docs/guardrails)

## Go deeper

- [The operating contract for AI agents](/docs/agents/contract) — the rules an
  assistant follows on the rails, and which ones the tools themselves enforce.
- [Every command, step by step](/docs/agents/shell) — the full
  technical walk.
- [How the app translation pipeline works](/docs/concepts/how-sync-works) —
  if you came here for translating an app's or website's text.
