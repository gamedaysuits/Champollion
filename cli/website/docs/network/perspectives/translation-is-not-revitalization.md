---
sidebar_position: 1
title: 'Translation Is Not Revitalization'
slug: '/network/perspectives/translation-is-not-revitalization'
description: 'What machine translation can and cannot do for endangered languages — stated plainly. MT is infrastructure for language communities. It never substitutes for people speaking to people.'
related:
  - label: "How Speakers Get Paid"
    to: /docs/network/perspectives/how-speakers-get-paid
    kind: position
  - label: "From Benchmark to Daily Use"
    to: /docs/network/perspectives/from-benchmark-to-daily-use
    kind: position
    note: "The post-editing path from draft to published text"
  - label: "Data Sovereignty"
    to: /docs/network/sovereignty/data-sovereignty
    kind: doc
    note: "Data-sovereignty principles, CARE, and consent before deployment"
  - label: "For Language Communities"
    to: /docs/network/community/for-language-communities
    kind: doc
---

# Translation Is Not Revitalization

> **Position.** Machine translation converts text between languages. Revitalization creates new speakers. These are different activities with different success criteria, and no leaderboard score changes that. We build MT as infrastructure that serves a community's goals — never as a substitute for intergenerational transmission. Children learn language from people, not machines.

In 2026 it is easy to believe that software can fix anything, including a language that is losing speakers. We want to be precise about why that belief is wrong — and about what translation technology *can* honestly contribute.

This piece exists because a linguist we invited to critique this project made the argument forcefully: a perfect English→Cree translation system would not solve the transmission problem (children not learning the language at home), the prestige problem (English as the language of economic power), or the pedagogical problem (not enough immersion schools and trained teachers). It might even make things worse, by creating the illusion that "the computer can speak Cree" and softening the urgency of human transmission. We accepted most of that critique, and we publish our response here rather than burying it.

---

## What revitalization actually requires

The research literature on language revitalization is consistent on one point: languages survive when they are passed between generations — when parents, grandparents, and communities speak them to children, and children grow up speaking them back (Fishman 1991; Hinton & Hale 2001). Everything else — schools, media, dictionaries, apps — supports that transmission or it supports nothing.

No translation system participates in that exchange. A model that converts an English document into Plains Cree does not create a speaker. It does not staff an immersion classroom, train a teacher, or sit with a child at a kitchen table. If our work is ever described as "saving languages," that description is wrong and we will say so.

## What MT cannot do

Stated plainly, so there is no ambiguity later:

- **It cannot replace speakers.** Output that no fluent speaker has reviewed is a draft, not a text. Our own [scoring rules](/docs/network/specifications/scoring) treat every automated score as a proxy; only human review confirms usability.
- **It cannot teach a first language.** Children acquire language through relationship and immersion, not through translated documents.
- **It can create a harmful illusion.** A demo that "speaks" a language can suggest the language is safe when it is not. This prestige risk is real, and we treat it as an open question to be examined *with* communities, not a talking point to be managed.
- **It cannot decide anything.** Whether a translation system should exist for a language, and where it may be used, is the community's call — including the call to not deploy it at all. That control is built into the [ownership transfer](/docs/network/sovereignty/ownership-transfer) and [data sovereignty](/docs/network/sovereignty/data-sovereignty) architecture, and it includes contexts: a community might accept MT for official documents and refuse it for classroom materials.

## What MT can honestly do

Against that backdrop, there are concrete, bounded things translation infrastructure contributes — each one serving people who are already doing the real work.

**1. Throughput for overloaded translators.** Community translation offices face more documents that *should* exist in the language than human translators can produce from scratch. A machine draft changes the job from "translate everything" to "review and correct" — and controlled studies have found post-editing meaningfully faster than translating from scratch, with quality maintained or improved (Plitt & Masselot 2010; Green, Heer & Manning 2013). We describe this workflow in detail in [From Benchmark to Daily Use](/docs/network/perspectives/from-benchmark-to-daily-use). The hedge: those studies covered high-resource language pairs; we do not yet have equivalent evidence for polysynthetic languages, which is part of what this project is set up to measure.

**2. Practical leverage for language rights.** The right to government services in Indigenous languages exists in law in several jurisdictions. What is often missing is the practical capacity to produce translations at the speed bureaucracy demands. A community that can turn a fifty-page policy document into a reviewed translation in days rather than months is in a stronger negotiating position. The technology does not create the right; it makes the right harder to ignore.

**3. Reusable linguistic infrastructure.** The morphological analyzer (FST) we use to verify that translation output contains real words — not hallucinated ones — encodes *why* each word form is valid. That same machinery is the foundation for learning tools: conjugation trainers, error-correcting writing aids, morphological explorers. The verification engine and the pedagogical engine are the same artifact. This is a pathway, not a promise — the learning tools require building, and whether they get built is a community decision.

**4. Support for second-language learners.** Revitalization is not only children acquiring a first language. It is also adults learning as a second language — people who may never reach Elder-level fluency but who can read community documents, participate with comprehension, and raise the language's public presence by using it. For this population, a translation aid is a genuine tool, the way a dictionary is a tool.

**5. A reason for the work to be funded and owned at home.** In our model, proven methods [transfer to community ownership](/docs/network/sovereignty/ownership-transfer) outright, and anything a community earns from an asset it owns is entirely its own ([how the work is funded](/docs/network/sovereignty/economic-model)). Speakers are [paid for their expertise](/docs/network/perspectives/how-speakers-get-paid), not asked to volunteer it. None of that is revitalization either — but it directs resources toward the people doing revitalization, instead of away from them.

## The honest framing

The field has a long record of technology projects that arrive with rescue narratives and leave with publications (Bird 2020). We try to hold a narrower claim: **MT is infrastructure.** Infrastructure serves goals set by other people. Roads do not decide where you travel; this technology does not decide whether a language lives. Speakers, families, and communities do — and the [UNESCO International Decade of Indigenous Languages](https://idil2022-2032.org/) framing is right to put Indigenous peoples, not tools, at the center.

If a community concludes that translation technology helps their goals, we want it to be the best, most accountable version possible — owned by them, validated by their speakers, deployed on their terms. If a community concludes it doesn't help, that conclusion is a valid outcome of this project, not a failure of it. Both halves of that sentence are commitments.

---

## What this means for you

:::info[If you are a community member]
This project will not tell you that an app can save your language — it can't. What it offers is bounded: faster document translation under fluent-speaker review, infrastructure your community can own outright, and compensation for speakers' expertise. Whether and how any of it gets used is your community's decision, including the decision not to use it. See [For Language Communities](/docs/network/community/for-language-communities) and [Reporting Errors and Owning Corrections](/docs/network/perspectives/reporting-errors-and-owning-corrections).
:::

:::info[If you are a researcher]
Treat "MT for endangered languages" as an infrastructure claim, not a revitalization claim, and your evaluation question changes: not "is the BLEU score high?" but "does this measurably reduce the workload of the people doing the real work, on their terms?" The [benchmark specification](/docs/network/specifications/benchmark) and [How It Works §8 (Tensions and Limitations)](/docs/network/how-it-works#8-tensions-and-limitations) are where we hold ourselves to that standard.
:::

:::info[If you are a builder]
Build for the post-editing workflow, not the demo. The user of your method is a fluent speaker correcting a draft, and the worst failure mode is hallucinated words that look plausible to non-speakers — which is why morphological validation gates everything here. Start with [Submit a Method](/docs/network/getting-started/submit-a-method) and [From Benchmark to Daily Use](/docs/network/perspectives/from-benchmark-to-daily-use).
:::

---

## Sources

- Fishman, J. A. (1991). *Reversing Language Shift: Theoretical and Empirical Foundations of Assistance to Threatened Languages.* Multilingual Matters.
- Hinton, L., & Hale, K. (eds.) (2001). *The Green Book of Language Revitalization in Practice.* Academic Press.
- Plitt, M., & Masselot, F. (2010). "A Productivity Test of Statistical Machine Translation Post-Editing in a Typical Localisation Context." *The Prague Bulletin of Mathematical Linguistics*, 93, 7–16. [PDF](https://ufal.mff.cuni.cz/pbml/93/art-plitt-masselot.pdf)
- Green, S., Heer, J., & Manning, C. D. (2013). "The Efficacy of Human Post-Editing for Language Translation." *Proceedings of CHI 2013.* [Paper](https://idl.uw.edu/papers/post-editing)
- Bird, S. (2020). "Decolonising Speech and Language Technology." *Proceedings of COLING 2020*, 3504–3519. [Paper](https://aclanthology.org/2020.coling-main.42/)
- UNESCO. *International Decade of Indigenous Languages 2022–2032.* [idil2022-2032.org](https://idil2022-2032.org/)

## See also

- [How Speakers Get Paid](/docs/network/perspectives/how-speakers-get-paid) — the compensation model, in numbers
- [From Benchmark to Daily Use](/docs/network/perspectives/from-benchmark-to-daily-use) — the post-editing path
- [How It Works](/docs/network/how-it-works) — the full platform architecture, including §8 on tensions we have not resolved
