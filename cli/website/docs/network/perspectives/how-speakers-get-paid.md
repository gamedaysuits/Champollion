---
sidebar_position: 2
title: 'How Speakers Get Paid'
slug: '/network/perspectives/how-speakers-get-paid'
description: 'What community validators and translators are paid for benchmark work, why paying speakers is non-negotiable, and how compensation scales as the Network grows. All numbers come from the published specifications.'
related:
  - label: "Speaker Validation Protocol"
    to: /docs/network/specifications/speaker-validation
    kind: spec
    note: "The work validators are paid for"
  - label: "Prize Specification"
    to: /docs/network/specifications/prizes
    kind: spec
    note: "Where prize money goes, and why"
  - label: "The Economic Model"
    to: /docs/network/sovereignty/economic-model
    kind: doc
  - label: "Reporting Errors and Owning Corrections"
    to: /docs/network/perspectives/reporting-errors-and-owning-corrections
    kind: position
---

# How Speakers Get Paid

> **Transparency note.** Every number on this page already appears in a published specification — the [Benchmark Specification §10](/docs/network/specifications/benchmark#10-cost-framework), the [Speaker Validation Protocol](/docs/network/specifications/speaker-validation), and the [Prize Specification](/docs/network/specifications/prizes). This page gathers them in one place, in plain language, so nobody has to read a spec to find out what speaker time is worth here. It makes no commitments beyond what those documents already state.

A bilingual speaker who can judge whether a machine-produced sentence is real, fluent, and means the right thing is the scarcest and most valuable participant in this entire system. Everything else — harnesses, metrics, leaderboards — exists to make a small amount of that person's time go a long way.

So the first rule is simple: **speakers are paid for their time, at professional rates, regardless of what the results show.**

---

## Why paying speakers is non-negotiable

Language technology research has a long habit of treating fluent speakers as a free resource — "community engagement" that produces datasets, papers, and careers for everyone except the speakers. We consider that pattern extractive, and the people most qualified to do this work are precisely the people whose time is already claimed by the urgent work of teaching, translating, and raising children in the language.

Three design consequences follow:

1. **No volunteer pipeline.** We do not ask speakers to donate evaluation work as a favor to research. Participation is a paid engagement, and declining it costs a speaker nothing.
2. **Payment is unconditional.** Speakers are paid whether or not their ratings are used, and payment is not contingent on results. The published protocol commits to payment within two weeks of completing each task block.
3. **Compensation is not the whole deal.** Speakers who contribute ratings also receive credit (named or anonymous, their choice), optional co-authorship on publications that use their ratings, the right to withdraw their contributions at any time, and veto power over publication of results they find problematic. Those terms are in the [Speaker Validation Protocol §5–6](/docs/network/specifications/speaker-validation), not in a side letter.

## The published rates

The benchmark cost framework sets bilingual speaker compensation at **$50–65 CAD per hour** for corpus and validation work. What that means per role:

### Building a benchmark corpus

Creating the reference translations that every method gets scored against is the foundational speaker task. The published establishment budget per language:

| Work | Published range | Basis |
|------|-----------------|-------|
| Corpus curation (50–150 entries) | $2,500–6,000 | $50–65/hr, bilingual speaker time |
| Reviewing method output | $500–1,500 | Same hourly rates |

A full corpus traditionally takes a speaker roughly 80 hours; the planned agent-assisted workflow (sentence drafting and formatting handled by tooling, translation always by a human) is designed to bring that toward 30–40 hours — fewer hours of repetitive work, same hourly rate, with the speaker doing only the parts that genuinely require a human.

### Validating the metrics

Before automated scores mean anything, speakers have to check them against human judgment. The [Speaker Validation Protocol](/docs/network/specifications/speaker-validation) publishes the exact tasks, hours, and pay:

| Task | Time | Pay per speaker |
|------|------|-----------------|
| A — Rate 200 machine translations for adequacy and fluency | ~8 hours | $400–520 CAD |
| B — Review 50 "equivalent" translation pairs | ~2 hours | $100–130 CAD |
| C — Review 100 words the morphological analyzer rejected | ~1.5 hours | $75–100 CAD |

A speaker doing all three commits about 11.5 hours over two to four weeks for **$575–750 CAD**. The full three-speaker validation round costs the project $1,475–1,920 — which is the point: speaker validation is a small line item for the project and should never be where costs get "saved."

### Reviewing prize claims

No prize is paid on automated scores alone. The [Founder's Prize](/docs/network/specifications/prizes) ($10,000 CAD, English→Plains Cree) requires that at least two bilingual speakers independently review a stratified sample of at least 30 outputs, and that 70% or more be rated "acceptable" or "excellent." That review is paid speaker work under the same rates — and it is also a gate: speakers can sink a prize claim, and that is by design.

## How it scales with contests

The model is built so that speaker compensation grows with the platform instead of being diluted by it:

- **Each new language begins with a paid corpus engagement.** The published establishment cost per language ($3,350–8,500 all-in) is mostly speaker compensation — the largest single component, deliberately.
- **Each new prize pool brings its own paid review.** Every sponsored contest that follows the [prize template](/docs/network/specifications/prizes#4-future-prize-pools) carries the same community-validation requirement, which means every contest funds speaker review work for that language.
- **Community-owned methods stay community-funded assets.** A transferred method belongs to the governance organization outright — anything it earns from deploying it is entirely the community's ([How the Work Is Funded](/docs/network/sovereignty/economic-model)), available for continued review, corpus growth, and language programs as it sees fit. That allocation is the community's decision, not ours.

## What we have *not* promised

Honesty requires marking the edges:

- The rates above are the published rates for the current Plains Cree work. Rates for future languages will be set with the partner community and published the same way — in the specs, before the work starts.
- Champollion is non-commercial, generates no revenue of its own, and is currently **self-funded by its founder** — grant and sponsor funding is what we are seeking, not what we have. [How the Work Is Funded](/docs/network/sovereignty/economic-model) describes the mechanism, not a guarantee.
- "Paid fairly" is necessary but not sufficient. Payment does not by itself make a project non-extractive — ownership and control do, which is why compensation sits inside the [stewardship model](/docs/network/sovereignty/data-sovereignty) rather than replacing it.

---

## What this means for you

:::info[If you are a community member]
If you are bilingual in an underserved language and English, your judgment is the most valuable input in this system, and the published terms are: $50–65 CAD/hour, flexible scheduling, payment within two weeks, credit on your terms, and the right to withdraw your contributions. No programming is required. Start with [For Language Communities](/docs/network/community/for-language-communities) or the [Speaker Validation Protocol §7](/docs/network/specifications/speaker-validation#7-how-to-get-started).
:::

:::info[If you are a researcher]
Budget speaker compensation as a first-class research cost — the published figures ($1,475–1,920 for a metric-validation round; $2,500–6,000 for corpus curation) are small by grant standards and they are what makes automated scores defensible. The [Corpus Partnership Strategy](/docs/network/specifications/corpus-partnership) shows how an academic department plugs into this with funded speaker work built in.
:::

:::info[If you are a builder]
You benefit from paid speaker work even if you never fund it: validated metrics are what make your leaderboard score meaningful, and paid community review is what stands between your method and a prize. If you win, expect speakers to have been paid to scrutinize your output — and expect [ownership of your method to transfer](/docs/network/sovereignty/ownership-transfer) to the community whose language it serves.
:::

## See also

- [Translation Is Not Revitalization](/docs/network/perspectives/translation-is-not-revitalization) — why speaker authority frames everything else
- [Reporting Errors and Owning Corrections](/docs/network/perspectives/reporting-errors-and-owning-corrections) — speaker authority after the benchmark, too
- [Benchmark Specification §10](/docs/network/specifications/benchmark#10-cost-framework) — the full cost framework these numbers come from
