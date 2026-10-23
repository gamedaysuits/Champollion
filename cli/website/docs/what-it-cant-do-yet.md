---
title: What it can't do yet
slug: /what-it-cant-do-yet
description: "The honest part, in plain words: your first translator will be small, a working one takes a lot of sentences, and no tool can promise quality — only that you'll know where you stand."
---

# What it can't do yet

Your first translator will probably be a **phrasebook**. It will be good with
sentences like the ones it learned from, and shaky with anything new. That's
normal: every project starts there.

What moves it forward is more sentences — the right kinds, checked by someone
who speaks the language. Every round, the tools tell you whether it really got
better, and suggest what would help most next. This page tells you, plainly,
what to expect along the way.

## A working translator takes a lot of sentences

How many? We don't know yet for any real language. Here is what we do know.

We made up a practice language, so that a computer could check every answer:
about 2,000 words, perfectly regular grammar, clean data. A translator taught
on a laptop then translated new everyday sentences it had never seen, and a
computer checked whether each one meant exactly what the English meant:

- after 6,400 example sentences, **about 79 in 100** were exactly right;
- after 25,600, **about 96 in 100**.

Every sentence with a word it had never seen came out wrong — about a third of
its misses at 6,400 examples; the rest were grammar it hadn't learned yet.
That's the first thing to know: **a translator can't translate a word it
never learned.** So the tools point it out: when a sentence has a word your
translator never saw in its lessons, they say which word — that line is very
likely wrong, however fluent it reads.

A real language is much richer than our practice one: far more everyday
words, words with several meanings, grammar that marks things English leaves
unsaid. So these numbers are a floor, not an estimate. A real language will
need more sentences, and we don't yet know how many more. We are measuring it
now.

What that means in time: we haven't measured a real speaker's time yet. If
writing or checking a sentence took about a minute, 6,400 sentences would be
about a hundred hours. Shared across a family and a class, an hour or two a
week each adds up — and a small translator helps with your most-used phrases
long before then. [How many sentences does it take?](/docs/how-many-sentences)
goes into it.

## It can't promise a good translator — only that you'll know

A score measures how close the translator comes to the way a speaker said a
sentence. A good translation worded differently can score low, and a fluent
wrong one can score fairly high. That's why a speaker checking the drafts
matters more than any number.

A score also speaks only for sentences like the ones it was measured on, and
with only a few sentences it is rough — the tools show you a range, not a
single number. It can't tell you whether the *next* sentence the translator
writes will be right. A fluent speaker decides what is fit to use.

## Nobody has taken a real language all the way yet

We've walked every step of the rails many times, with made-up languages and
with many different AI assistants, from an empty folder to a translator you
can try in your browser. In our latest practice runs — AI assistants helping
a pretend family — more than half went wrong at some step. We fixed those
steps and are testing again.

No community has yet taken a real language all the way to a working
translator on the rails. If you start now, you're among the first.

## Some parts aren't ready

- **The step-by-step tools come with the next version.** Until then, these
  pages describe how they will work. [Before you begin](/docs/before-you-begin)
  is what you can do today.
- **Letting others test translators on your sentences** — without ever seeing
  them — works, but it isn't on the rails yet. Today it means following a
  longer manual.
- **Your computer matters.** A newer Mac (M1 or later) with 16 GB of memory,
  or a computer whose NVIDIA graphics card has 16 GB of its own, can build the
  stronger kind of translator; with 8 GB, a lighter version of it, which
  hasn't been tried on an 8 GB computer yet. On Windows, the training tools
  need WSL (Windows' built-in Linux). Other computers build a much smaller
  kind, which stayed far behind in our tests.
- **Rounds take the computer's time.** Most rounds carry on from the
  translator you're using rather than starting over, but with the stronger
  translator a round can still take hours, and only one translator learns at
  a time on a computer.
- **Keep sentences short.** The stronger translator reads only so much of a
  sentence — less if your language uses its own alphabet. The tools count
  any sentence that was too long and tell you, so you can split it.
- **Spelling isn't checked for you.** If people spell the language in
  different ways, agree on one way for the project before you begin.

## It can't stop every leak

For files kept on this computer — the default — the tools show your AI
assistant counts, not sentences. But an assistant that can use your computer
can open any file you can, asked or not, and most send what they read to the
company that runs them.
[Your words, your rules](/docs/your-words-your-rules) explains what to do.

## A translator isn't a living language

A translator can help a language program, a school or a family. The
language lives in its speakers, and in being used every day.
[Translation is not revitalization](/docs/network/perspectives/translation-is-not-revitalization)
says more.

---

These limits will change as the work does. When one does, this page changes
with it.

**Next:** [Before you begin →](/docs/before-you-begin)

## Go deeper

- [The guardrails, one by one](/docs/guardrails) — how each check works.
- [The technical limits](/docs/network/honest-limitations) — what the
  measurements cover and don't, trust tiers on published scores, sealed-test
  custody, and why no per-sentence confidence is given.
- About the practice-language numbers: one run per size, so the spread
  between runs isn't measured. "Exactly right" is an automatic check of every
  part of the meaning — verb, tense, person, negation, subject, object and
  more — against the invented language's own grammar, not a person's
  judgement. The translator was a pretrained byte-level model fine-tuned on an
  Apple-silicon laptop. How long it trains changes the result a lot (the same
  model and 6,400 sentences scored about 27 in 100 with a quarter of the
  training), so these are not limits. At 6,400 sentences, about 9 in 100
  translations were fluent, used real words, and meant something else. The
  smaller model the tools use on other computers got about 6 in 100 right at
  6,400 sentences.
- The stronger translator reads at most 320 bytes of a sentence — about 100
  letters of syllabics, since accented letters and letters of other alphabets
  take two to four bytes each. Training counts the pairs past the limit before it cuts
  them, and a served translation says what it cut.
