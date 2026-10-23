---
title: Reading the numbers
slug: /reading-the-numbers
description: "What every number the rails show you means, in plain words: the score out of 100, the speaker's share of drafts marked right, ranges, and 'no measurable change'."
---

# Reading the numbers

The rails show you numbers at every step. Each one is only useful if you know
three things about it: **what it measures**, **out of what**, and **on which
sentences**. The tools say all three, and your assistant is told to. This page
explains each kind.

## The speaker's share of drafts marked right

**The number that matters most.** Each round, a speaker marks the translator's
drafts right or wrong. *"31 of 40 drafts marked right"* means just what it
says: on the 40 sentences your family wanted translated this round, the
speaker judged 31 right.

Nothing a computer measures beats a speaker's judgement. But it depends on the
sentences: an easy week and a hard week can give different numbers with the
same translator. That's why the tools also measure the same way each time, on
the same sentences — the score.

## The score, out of 100

A **score** is a number from 0 to 100 for how close the translator's sentences
come to the way a speaker wrote the same sentences. It counts matching
letters and words, and gives partial credit: a translation that's nearly
right scores higher than one that's way off. 100 means identical.

Two things to know:

- **It measures closeness, not correctness.** A good translation worded
  differently from the speaker's can score low. A fluent translation that
  means something else can score fairly high. That's why a speaker's check
  matters more.
- **It's not a percentage of sentences right.** A score of 60 doesn't mean
  60 in 100 sentences were right.

For the curious: this score is called **chrF++**, and it's the field's usual
way to compare translators. The tools also report others beside it.

## Ranges

Most numbers come with a **range**, like *14–22*. That's not two results. It's
how sure the tools are: the real value is very likely somewhere in there. With
a few sentences, the range is wide. With many, it narrows.

When two ranges overlap a lot, the two translators may really be the same.

## Which sentences

A number always says which sentences it was measured on:

- **Test sentences** — the ones a speaker checked and the translator never
  learned from. Used for the results that matter, and only now and then.
- **Practice sentences** — set aside from your data, and also never learned
  from. Used to judge each round, so the test sentences stay fresh.
- **Your round's sentences** — the ones your family wanted translated; the
  speaker's marks are on these.

A number measured on sentences the translator learned from would mean nothing,
so the rails never show you one as a result.

## "No measurable change"

This doesn't mean nothing changed. It means any change was too small to tell
apart from luck, with the number of practice sentences you have. The tools say
how big a change they *could* have seen. More practice sentences let them see
smaller changes — which is why, while the practice set is small, some rows of
each round's sheet are left for the speaker to write.

## "Too few practice sentences to tell"

With fewer than 50 practice sentences, no score can reliably say which of two
translators is better. On our practice language, with 23 practice sentences,
the careful rule called two nearly equal translators different 9 times in
100 — and noticed a real gain of about 6 points out of 100 only 21 times in
100. With 50, those were 4 and 96. So below 50, the tools don't call it. The one you're using stays, and the speaker's marks on
the next sheet decide.

## The dictionary floor

If you brought a word list, you'll see a score for *just looking each word
up*. It's the floor: a translator is worth using only where it scores above
it. With very few sentences, a first translator can fall below it. That's
worth knowing, not worth hiding.

## A number you'll see on our pages: "meaning right"

When we talk about our made-up practice language, you'll see *"79 in 100
exactly right"*. That one is a share of sentences: a computer checked every
part of each translation's meaning against the made-up language's own grammar.
It's only possible on a language we invented, where the right answer is known
exactly. On a real language, the nearest thing is a speaker's marks.

**Next:** [Make it better, round by round →](/docs/make-it-better)

## Go deeper

- [Measurement rules](/docs/agents/measurement) — the exact rules: chrF++
  with its 95% range, the paired comparison, gates and refusal rates.
- [Scoring specification](/docs/network/specifications/scoring) — how every
  published score is computed.
- [Significance](/docs/network/specifications/significance) — how "better by
  more than luck" is decided.
