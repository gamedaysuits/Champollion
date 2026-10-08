---
sidebar_position: 7
title: 'Connection Strength'
slug: '/network/specifications/connection-strength'
related:
  - label: "Scoring Specification"
    to: /docs/network/specifications/scoring
    kind: spec
    note: "How individual runs are scored"
  - label: "Metric Reliability"
    to: /docs/network/specifications/metric-reliability
    kind: spec
    note: "How well each metric tracks human judgment, per language pair"
  - label: "Statistical Significance Testing"
    to: /docs/network/specifications/significance
    kind: spec
---

# Connection Strength

When the network map draws an arc between two languages, its colour answers
one question: **has this pair actually been measured?**

That is deliberately less than the map used to claim. Until 2026-09-04 an arc
was coloured by a five-step strength ramp — how *good* the best translation
was, on a chance-corrected scale. That ramp has been retired. This page
explains the number that was behind it, why removing it was the honest call,
and what the map says now.

## The problem: raw scores aren't zero at zero

Most of our scores are **chrF++** (character n-gram F-score, [Popović
2017](https://aclanthology.org/W17-4770/)) — it measures how much a
translation's characters and words overlap with a reference translation, from
0 to 100.

But *random text is not zero*. Every writing system gives some overlap "for
free": an orthography with few distinct characters, or long predictable
words, scores measurably above zero even when the "translation" is nonsense.
That free overlap — the **chance floor** — differs by language. In our
measurements it ranges from about 1.6 (Chinese script) to more than 13
(some Latin- and Arabic-script languages). A raw chrF++ of 14 is near-random
noise in one language and a real signal in another — so raw chrF++ is **not
comparable across languages**, and a map coloured by it would quietly
flatter some scripts.

This problem is real, and it is why the map does **not** rank strength across
languages. It is not a problem we have solved.

## The correction we built, and why it no longer colours the map

**Chance-corrected chrF++ (cchrF++)** rescales a score so that 0 means "no
better than chance" *in that language* and 1 means perfect:

```
cchrF++ = (chrF++ − floor) / (100 − floor)
```

The floors are measured, not assumed: for each language we run a Monte-Carlo
estimate — thousands of random same-orthography baselines scored against real
references — using publicly available monolingual text only (FLORES-200 dev,
fetched from source, never redistributed). The floor table covers 196
languages and is a Champollion-derived artifact.

**What that correction genuinely establishes.** The chance floor exists, spans
roughly ninefold across writing systems, and can be estimated from monolingual
text with no human quality labels at all. Subtracting it demonstrably strips
the chance component from trivial baselines: a copy-the-source cheat that
scores 15+ raw in Finnish drops to about 2.5, and in most languages to exactly
zero. The "chance" being removed is surface statistics, not leftover meaning.

**What it does not establish.** It makes **0** mean the same thing in every
language. It does not make **40** mean the same thing. Above the floor the
correction is a straight rescaling, and the evidence that equal *quality*
lands at equal corrected scores across languages is demonstrated only at the
bottom of the range. Against pools of human judgments it helps where the
floors genuinely differ, does nothing where they don't, and on one pool with
uniformly low floors it moved agreement with human raters the *wrong* way — a
result we have not resolved.

Colouring a public map with a five-band strength ramp asserted more than that
evidence supports, on exactly the low-resource languages where being wrong
matters most. So the ramp is retired until further study settles the question.

Note that colouring by **raw** chrF++ instead was never an option: raw scores
are not comparable across languages at all, which is the whole reason the
correction was built. A binary encoding is the honest fallback, not a
downgrade to something weaker.

## Where measurement sits in the hierarchy

From most to least trustworthy:

1. **Human verification** — fluent speakers judging output ([speaker
   validation](/docs/network/specifications/speaker-validation)). Nothing
   automatic outranks it.
2. **MQM-style expert annotation** ([Multidimensional Quality
   Metrics](https://aclanthology.org/2014.tc-1.6/), Lommel et al.) — the
   protocol WMT uses for its gold judgments; expensive, rare, very good.
3. **Automatic scores — within one language pair only.** Raw chrF++, BLEU,
   COMET and the rest are useful for comparing systems on the *same* pair;
   see [Metric Reliability](/docs/network/specifications/metric-reliability)
   for how badly each can track human judgment on your pair.
4. **Cross-language strength.** We do not publish a ranking. See above.

As human-verified and MQM-grade results enter the board, they take
precedence over automatic scores for the same pair.

## How the map draws it

Each visual channel carries exactly one meaning:

| Channel | Meaning |
|---------|---------|
| **Colour** | measured. One colour, no ramp — the arc says a run has scored this pair, and nothing about how well |
| **Dashed + dimmed** | provisional: the test set is below the [significance floor](/docs/network/specifications/significance) (n &lt; 100), where score gaps within ~5 chrF++ are noise. This is a property of the sample size, independent of any metric |
| **Width** | constant. There is nothing left to encode |

Only **measured** pairs draw a measured arc. Registered pairs — queued
for measurement but not yet scored — appear as faint flat-coloured
hairlines whose colour says only *how the pair is reachable today*
(commercial API · open-source model · frontier, no provider), never how
well anything translates. The two vocabularies are deliberately disjoint:
muted flat threads = reachability, the one measured colour = measured.
An arc's underlying score is the best measured run for that pair on the
public board, refreshed automatically as new runs land, and is shown as a
within-pair number when you open the arc — never as a cross-language rank.

## The fine print

- The chance floors are metric × orthography properties estimated from
  monolingual text only; no parallel corpus content is involved or stored.
- The floor atlas and the correction remain published research, and the code
  remains in the repository under test. They are wired to no public surface.
- **It corrects the floor, not the ceiling.** How high a genuinely good
  translation can score still varies by language, and the correction does
  nothing about that.
- **It is not a defence against shared-script copying.** An output that simply
  copies the source can still score above chance when source and target share
  a writing system.
- **It cannot reorder systems within one language pair.** Above the floor the
  correction is a straight rescaling, so within-pair rankings are identical
  before and after — its only possible value was across pairs.
- A measured arc tells you a pair has been scored. It does **not** validate
  meaning, register, or cultural fit. Those remain human judgments ([honest
  limitations](/docs/network/honest-limitations)).
- The chance-floor methodology is Champollion research, published here
  precisely so it can be checked and challenged.
