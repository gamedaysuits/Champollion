---
sidebar_position: 8
title: "The Derived-Artifacts Commitment"
description: "Who owns the models, translation memories, and evaluation standards built from community language data: not us. Champollion is infrastructure for communities to build and own their own."
related:
  - label: "Data Stewardship"
    to: /docs/network/sovereignty/data-sovereignty
    kind: doc
    note: "The corpus-side position: data stays with its stewards"
  - label: "Ownership Transfer"
    to: /docs/network/sovereignty/ownership-transfer
    kind: doc
    note: "How infrastructure custody hands over to communities"
  - label: "For Language Communities"
    to: /docs/network/community/for-language-communities
    kind: doc
    note: "The ground rules, in plain language"
---

# The Derived-Artifacts Commitment

The [Data Stewardship](/docs/network/sovereignty/data-sovereignty) position
covers the *inputs*: corpora stay with their stewards, we never host or
redistribute community data. This page covers the *outputs* — the things that
get **built from** language data: trained models and their weights,
translation memories, fine-tunes, coaching sets, evaluation standards, and
run artifacts.

The commitment, in one sentence:

> **We claim no ownership over any language model or language-derived
> artifact built from a community's data — and we have no desire to. The
> entire point of this project is getting development-level and
> ownership-level control of these technologies into the hands of speakers.**

Champollion is **infrastructure**. A road does not own the goods that travel
on it.

## What this means concretely

**Models belong to the people whose language they speak.** If a model is
trained on a community's data — with our tooling or anyone else's — the
weights, the fine-tunes, and every derivative follow the community's terms,
not ours. We do not take copies, we do not relicense, and we do not treat
"we wrote the training script" as an ownership stake in what it produced.
The lesson is historical, not hypothetical: language communities have
repeatedly watched outside organizations record, compile, or train on their
language and then hold the results — copyrights over elders' recordings,
models trained on scraped speech — while the speakers themselves had to ask
permission for their own voices. That failure shape is the one this
commitment exists to rule out.

**The Plains Cree (nêhiyawêwin) work is the test case, and the answer is
already fixed.** Nothing built for Cree in this project is ours — not the
training corpus (used under its holders' permission and never
redistributed), not the coached pipelines, not any trained model. Any Cree
model produced in this work will be released **only to a recognized
community authority** — an education authority, an Elders' council, or
whichever body the community itself designates — under the community's own
terms, and to no one else. There is no version of this where a Cree model
ships as a product. The Cree evaluation work is likewise **non-commercial
throughout**: at most, Champollion maintains the *generic* evaluation
methodology (the LYSS standard — the idea of intensional, morphology-aware,
fail-honest scoring). The **Cree instantiation** of that standard — the
linguistic knowledge it encodes and validates against — is not something we
own; commercial use of it is reserved pending consultation with the nêhiyaw
language community, and community terms govern.

**Scores travel; artifacts don't.** The leaderboard publishes *measurements*
— a chrF++ value, a validation rate, a confidence interval — with the method
and corpus identified. It never publishes, hosts, or requires the model
itself, the corpus content, or the outputs beyond what the steward's terms
allow. If a community wants their language's row removed from public view,
the [registration lanes](/docs/network/sovereignty/registering-corpora) exist
precisely so exposure is their dial, not ours.

## Infrastructure means: your data, your build, your keys

Three concrete shapes of what "we are only infrastructure" looks like in
practice:

1. **A community builds its own corpus.** They use the CLI on their own
   machines; the corpus lives where they put it. If they choose to register
   it for benchmarking, the registry stores a *pointer and a checksum* —
   fetch-from-source, under their license, delistable at their request. The
   corpus never enters our repository or our storage. This is enforced by
   machinery you can inspect: the public repo ships the quarantine gates and
   database triggers that make hosting community content structurally
   impossible, not just impolite.

2. **A community trains its own model.** The training suite
   ([nmt-forge](https://github.com/gamedaysuits/Champollion)) runs on their
   hardware; checkpoints and weights exist only there. The eval harness
   scores it; the board records the score. We never possess the model. If
   they want it private forever, it is — a score row is the only public
   trace, and only if they publish one.

3. **A community runs its own benchmark.** With
   [sovereign contests](/docs/network/sovereignty/run-a-sovereign-contest),
   the test set stays sealed on community-controlled infrastructure; methods
   come *to* the data; only aggregate scores leave. The community decides
   who may evaluate, on what terms, and can stop at any time.

In every case the direction of travel is the same: capability moves toward
the community; data and its derivatives do not move away from it.

## The frameworks we look up to

We are **inspired by, and aspirant towards,** the Indigenous data-governance
frameworks that communities themselves have built. It is not up to us to
deem ourselves compliant with any of them — that judgment belongs to the
communities and institutions who authored them. What we can do is design in
their direction, name them as the standard-setters, and say plainly that we
would deeply value the opportunity to listen to and work with these experts
to improve this system in their spirit:

- **First Nations data-sovereignty principles** — ownership, control,
  access, and possession of a community's own information: precisely the
  four capabilities this page commits to keeping in community hands.
- **The CARE Principles for Indigenous Data Governance** (Collective
  Benefit, Authority to Control, Responsibility, Ethics), from the Global
  Indigenous Data Alliance — the corrective lens to purely "open" data:
  openness is not a virtue when it strips a people's authority over their
  own knowledge.
- **Te Mana Raraunga**, the Māori Data Sovereignty Network's charter —
  data as a living taonga (treasure), with rights and responsibilities that
  follow it.
- **The Kaitiakitanga License** (Te Hiku Media) — to our knowledge the
  clearest working example of derived-artifact sovereignty in language
  technology: Te Hiku built speech models *from* and *for* te reo Māori and
  licenses access under guardianship terms, so that the models benefit Māori
  and remain under Māori governance. When we say "models belong to
  speakers," Te Hiku is the existence proof that it works.
- **Masakhane's participatory research model** — African NLP built by
  speaker-researchers as co-authors and owners rather than data sources; the
  demonstration that the *process* of building language technology can
  itself be the transfer of capability.

These are different frameworks from different peoples with different legal
and cultural positions — we name them side by side rather than folding them
into one label. Where our design falls short of their spirit, that is a
defect to fix, and we would rather hear it from the experts than discover
it in a postmortem. If you work in this space and are willing to tell us
what we've gotten wrong: **that conversation is the most valuable
contribution this project can receive.** Reach us via
[Get Involved](/get-involved).

## What we do own

For clarity, the things Champollion *does* claim: the infrastructure code
(CLI, harness, training suite — each under its published license), the
generic evaluation methodology, and the index's *derived
measurements* (which carry `champollion-derived` provenance precisely so
they are never misattributed to a community or an upstream source). That's
the toolbox. What you build with it is yours.

