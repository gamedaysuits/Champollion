---
sidebar_position: 3
title: 'From Benchmark to Daily Use: The Post-Editing Path'
slug: '/network/perspectives/from-benchmark-to-daily-use'
description: 'How a benchmarked translation method becomes a community translation workflow: machine draft, fluent-speaker post-edit, published text — with honest quality thresholds at every step.'
related:
  - label: "Deploy to Production"
    to: /docs/network/getting-started/deploy-to-production
    kind: guide
    note: "From proven method to live translation"
  - label: "Cookbook: Partial Translation (Human + Machine)"
    to: /docs/network/tutorials/partial-translation
    kind: cookbook
  - label: "Scoring Specification"
    to: /docs/network/specifications/scoring
    kind: spec
    note: "How runs are scored, and why no score is a quality label"
  - label: "Translation Is Not Revitalization"
    to: /docs/network/perspectives/translation-is-not-revitalization
    kind: position
---

# From Benchmark to Daily Use: The Post-Editing Path

> **The short version.** A leaderboard score is not a product. The path from "this method scores chrF++ 47.5" to "the band office publishes documents in the language every week" runs through exactly one workflow: the machine produces a draft, a fluent speaker corrects it, and only the corrected text gets published. Every quality threshold in our specs is calibrated to that workflow — not to unsupervised machine output, which we do not endorse for any language on this platform.

People sometimes ask when a translation method will be "good enough to just use." For the languages this Network serves, that question has a trap in it. The honest answer is that the bar worth aiming for is not "good enough to publish unreviewed" — it is **"good enough that reviewing a draft beats translating from scratch."** That bar is much lower, it is measurable, and crossing it changes what a community translation office can produce in a week.

---

## The workflow, end to end

```
 English source document
        │
        ▼
 Machine draft  ←  a benchmarked, community-owned method
        │
        ▼
 Fluent-speaker post-edit  ←  the human gate; nothing skips it
        │
        ▼
 Published text  ←  carries human approval, not a machine score
        │
        ▼
 (Optional, community-controlled) corrections become
 data that improves the next version of the method
```

Three things to notice:

1. **The machine never publishes.** The unit of output is a draft. The speaker's correction pass is not quality assurance bolted on at the end — it is the workflow.
2. **The speaker's time is the resource being optimized.** A method is better than another method exactly insofar as it leaves the speaker less to fix. Research on post-editing for well-resourced languages consistently finds it faster than translating from scratch at moderate MT quality (Plitt & Masselot 2010; Green, Heer & Manning 2013, both cited with links in [Translation Is Not Revitalization](/docs/network/perspectives/translation-is-not-revitalization)). Whether that holds for polysynthetic languages is precisely what the benchmark exists to find out — we treat it as a hypothesis to verify per language, not an assumption.
3. **The feedback loop is owned.** Every corrected document is potential training and coaching data — and it belongs to the community, to feed back (or not) on their terms under the [data sovereignty](/docs/network/sovereignty/data-sovereignty) rules. The feedback mechanism is a design goal of the platform, not yet a built feature; see [Reporting Errors and Owning Corrections](/docs/network/perspectives/reporting-errors-and-owning-corrections) for how corrections and provenance are meant to work.

## What a leaderboard score can and cannot tell you

The leaderboard ranks methods the way the MT field does: by corpus-level **chrF++** (0–100) with its 95% confidence interval and sacreBLEU signature, with BLEU, spBLEU, TER and COMET beside it and diagnostics such as FST acceptance reported separately ([Scoring Specification](/docs/network/specifications/scoring#how-runs-are-scored)). Whether one method is better than another on the same evaluation set is decided by a paired significance test, not by eyeballing two numbers ([Significance Testing](/docs/network/specifications/significance)).

What that tells a community: which methods produce output closer to trusted reference translations, and whether a gap between two methods is real. What it cannot tell you: whether a draft is worth a speaker's time. The same chrF++ number means different things for different languages and evaluation sets, so no automatic score here carries a quality label. The Network used to map a weighted composite onto named tiers ("functional", "deployable", …); those labels are retired, partly because a system that repeated one valid sentence for every input was labelled "functional" ([why the composite was retired](/docs/network/specifications/scoring#why-the-composite-was-retired)).

Two structural honesty rules follow, from the [Benchmark Specification §7](/docs/network/specifications/benchmark#7-human-validation):

- **A score is a nomination for human review, not a verdict.** A strong chrF++ makes a method worth piloting with speakers; it does not make it ready.
- **Only community review says a method is ready for a post-editing workflow.** A stratified sample of its output goes to bilingual speakers, who rate each translation *reject / gist / acceptable / excellent*. The governance organization — not the leaderboard — decides whether the method advances.

For comparison, the [Founder's Prize](/docs/network/specifications/prizes) conditions (a chrF++ floor, ≥99% morphologically valid words as a gate, ≥70% speaker-rated acceptable-or-better) describe a method whose remaining mistakes are *real-language errors* — wrong inflection, not fabricated words. That is what "a draft worth a speaker's time" looks like in numbers, and the speakers' verdict is the condition that settles it.

## From a winning method to a working office

Suppose a method clears those gates. The remaining steps are organizational, and they are specified rather than improvised:

1. **Ownership transfers.** The method's code becomes the property of the community's governance organization — the developer keeps attribution and publication rights ([Ownership Transfer](/docs/network/sovereignty/ownership-transfer)).
2. **The method becomes a service — the community's service.** It is packaged as a plugin the governance organization can run on its own infrastructure, controlling access and permitted uses ([Deploy to Production](/docs/network/getting-started/deploy-to-production)). If the community chooses to offer it commercially, that is its business in every sense — Champollion takes no share ([How the Work Is Funded](/docs/network/sovereignty/economic-model)).
3. **Translators plug it into their day.** A translation office points its existing document workflow at the method's API: source text in, draft out, post-edit, publish. The published text carries the translator's name and authority — the machine is a tool on their desk, like a dictionary.

## Where this stands today

Plainly: the full path is specified end to end, and partially built. The evaluation harness, metrics, run cards, and public leaderboard exist; the evaluation sandbox is built but has only been rehearsed with a toy method; a Plains Cree development corpus exists upstream; a prize is proposed, but none is open; the deployment platform exists. The community review interface and the corrected-text feedback loop are specified but not yet operational — the specs mark them as planned, and so do we. No method has yet completed the entire journey from benchmark to daily community use. That journey is the project's definition of success, which is exactly why we won't claim it early.

---

## What this means for you

:::info[If you are a community member]
A high leaderboard score never means a machine will publish in your language unsupervised — it means a draft generator may be ready to *audition* for your translators, on your terms, with your speakers as the judges (paid ones — see [How Speakers Get Paid](/docs/network/perspectives/how-speakers-get-paid)). If your community runs a translation office, the relevant question to bring to us is: "what would a pilot look like, and who reviews the output?"
:::

:::info[If you are a researcher]
The post-editing framing changes what is worth measuring: time-to-acceptable-text with a speaker in the loop, not just chrF++. The Network's metrics are proxies for that ([Scoring Specification §1](/docs/network/specifications/scoring)), and per-language post-editing studies for morphologically complex languages are an open research gap this infrastructure is designed to support.
:::

:::info[If you are a builder]
Optimize for the editor, not the metric. A method that produces real words with occasional wrong inflections is fixable in seconds by a speaker; a method that hallucinates plausible-looking forms poisons the whole workflow — which is why morphological validity is gated so hard here. Start at [Submit a Method](/docs/network/getting-started/submit-a-method), and read the [Method Interface](/docs/network/specifications/methods) for what you'll eventually hand over if you win.
:::

## See also

- [Translation Is Not Revitalization](/docs/network/perspectives/translation-is-not-revitalization) — why the human gate is the point, not a limitation
- [Reporting Errors and Owning Corrections](/docs/network/perspectives/reporting-errors-and-owning-corrections) — what happens when the published text is wrong anyway
- [Benchmark Specification §7](/docs/network/specifications/benchmark#7-human-validation) — the human validation gate, formally
