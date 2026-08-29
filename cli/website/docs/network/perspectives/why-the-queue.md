---
sidebar_position: 5
title: 'Why the Queue Is Built This Way'
slug: '/network/perspectives/why-the-queue'
description: 'The philosophy behind the community-compute queue: donated tokens are a budget, the mesh is the mission, and a priority list is a set of beliefs that should be written down, criticized, and falsifiable.'
related:
  - label: "Queue Construction Specification"
    to: /docs/network/specifications/queue-construction
    kind: spec
    note: "The formula this philosophy commits us to"
  - label: "Contributing Compute"
    to: /docs/network/getting-started/contributing-compute
    kind: guide
  - label: "Corpus Design Framework"
    to: /docs/network/specifications/corpus-design
    kind: spec
---

# Why the Queue Is Built This Way

The queue is the most consequential editorial artifact we publish.
Every item on it says: *if you are willing to spend a few cents of
API credit to low-resource machine translation, this is the best place
we know to spend it.* That sentence carries obligations. This page is
about what they are and how the
[queue construction formula](/docs/network/specifications/queue-construction)
discharges them.

## A priority list is a set of beliefs

Any ordering of work encodes answers to three questions, whether or
not anyone wrote them down:

1. **What do we value?** What is one completed run actually *worth*?
2. **What do we believe?** What do we expect to happen when a run we
   haven't tried yet is executed?
3. **What do we admit we don't know?** Where should curiosity
   override prediction?

Most benchmark queues answer these implicitly — "biggest gap first,"
"newest model first," someone's spreadsheet. We think a project asking
strangers to spend money deserves explicit answers, in a formula
anyone can recompute, with every input published. Not because formulas
are neutral — they aren't, ours encodes our mission and our hunches —
but because **a written-down bias can be argued with, and an unwritten
one can't.**

## What we value: chains, not checkmarks

Our mission is *every language into every language by measured
individual pair chains*. The world's translation infrastructure is
English-centric; ours started that way too — a star of eng→X
benchmarks. But a star only ever measures one thing: distance from
English. The languages of the world deserve a *mesh*: when no direct
benchmark exists between two languages, a chain of measured pairs
should — and its quality should be something we can estimate from
measurements rather than assert.

So the value of a completed run is not "one more leaderboard row." It
is **how much stronger the whole mesh gets**: the gain in our
quality-weighted chain-capacity objective Φ, which asks, for every
ordered pair of languages on Earth that we track, *how good is the
best chain between them right now?* A run that connects an isolated
language is worth hundreds of runs that polish an already-bright
corner — and the formula says exactly how many hundreds, instead of
leaving it to vibes. This is the same instinct that led M2M-100 to
mine "bridge languages" across families rather than more
English-paired data (Fan et al. 2021) — made continuous, and pointed
at evaluation instead of training.

Two consequences we accept on purpose:

- **A cheap small run on an unmeasured pair usually beats an expensive
  run on a measured one.** Contributed compute is a budget; we rank by
  mesh gain *per dollar* (the classic greedy rule for covering the
  most under a budget — Khuller, Moss & Naor 1999). Lighting the
  hundredth edge does more for the mission than gold-plating the
  first.
- **Estimated chains are worth less than measured edges.** Our chain
  model multiplies edge qualities and charges a fidelity discount per
  pivot junction, because forty years of pivot-translation results
  say routing through an intermediate language loses more than naive
  composition suggests (Utiyama & Isahara 2007; Wu & Wang 2007). The
  discount is the formula's permanent incentive to *measure the
  direct pair* rather than rest on a plausible chain.

## What we believe: predictions simple enough to audit

To value an unrun experiment you must predict its outcome. There is a
spectrum here, from "assume nothing" to "train a model to guess." We
deliberately stop early on that spectrum: our prediction is a sum a
contributor can check on a napkin — *how does this language pair
usually score, how does this model usually deviate, does coaching
evidence exist for this exact language* — and nothing else. No learned
weights, no embeddings, no model whose own biases would need auditing.

This costs us accuracy. A gradient-boosted predictor over language
features would guess better. We trade that accuracy for a property we
value more: **every rank on the queue is re-derivable by hand from
numbers printed on the item itself.** When someone asks "why is this
Faroese run #1?", the answer is four published numbers and one
sentence, not "the model said so." Active-learning research has long
balanced selection sophistication against trust and inspectability
(Haffari, Roy & Sarkar 2009 brought exactly this trade-off to machine
translation); a volunteer-funded benchmark belongs at the inspectable
end.

## What we don't know: curiosity with a budget

A queue driven purely by predictions has a failure mode: it
confidently starves everything it predicts poorly about, and never
finds out it was wrong. The classic answer from the bandit literature
is *optimism in the face of uncertainty*: give every untried option a
bonus that shrinks as evidence accumulates (Auer, Cesa-Bianchi &
Fischer 2002). Our queue carries exactly that bonus — scaled, not
coincidentally, to the noise floor of our instruments: optimism never
exceeds the ~5 chrF++ points that small dev corpora can't distinguish
anyway ([Corpus Design §6.3](/docs/network/specifications/corpus-design)).

The same humility shows up in two asymmetries worth naming:

- **Everything published is evidence; only open corpora are actions.**
  Results on restricted-license corpora inform the mesh's knowledge,
  but the queue only ever asks contributors to run what anyone may
  freely run.
- **Coaching evidence doesn't travel.** Where coached runs beat naive
  ones, that's measured fact for that language — and silence about
  every other. The queue keeps baseline-first ordering wherever
  coaching is unmeasured, rather than assuming one language's gains
  generalize.

## What we refuse to do

- **No engagement optimization.** Items are never ordered to maximize
  clicks, streaks, or completion satisfaction. The mesh objective is
  the only objective.
- **No hidden editorial thumb.** If we ever need to boost a pair (a
  community partnership, a deadline), it will appear as a named,
  versioned term in the spec — not as a quiet re-sort.
- **No claim-locking.** Anyone may run any item at any time; identical
  runs deduplicate by fingerprint and independent replications are
  welcome evidence. A queue position is advice, not permission.
- **No capability theater.** Φ and every score feeding it are
  development-set numbers with known caveats (contamination upper
  bounds, cross-language scale differences). They steer spending; they
  are never quoted as what a model "can do."

## Built to be wrong in public

The formula is versioned (`ecv-v2`), its parameters are echoed in
every published queue, and its central modeling assumption — that
chain quality composes multiplicatively with a per-junction discount —
is now *testable with our own data*: the mesh contains measured
triangles (direct deu→fra alongside deu→eng and eng→fra), so we can
score actual chained translations against the model's predictions and
fit the discount empirically instead of choosing it. When that
happens, v3 will say so, and this page will explain what changed and
why. That is the standard we want to be held to: not a queue that is
always right, but one whose reasoning is always on the record.

*The math, defaults, worked example, and full citations live in the
[Queue Construction Specification](/docs/network/specifications/queue-construction).*
