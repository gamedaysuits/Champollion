---
sidebar_position: 2
title: Ownership & Terms
---

# Ownership & Terms

> **Executive Summary.** Champollion has no universal agreement, by design.
> Terms are set per corpus, per language, and per prize by the steward who owns
> the data — the platform's job is to respect whatever terms those are. This
> page describes the dimensions a term sheet covers and the **Community
> Transfer Template**, the default starting point for sponsored prizes on
> Indigenous-language corpora.

## The terms framework

Champollion is meant to be flexible in its terms so that all licenses are
respected — and so that it can support novel arrangements: secret corpora,
community-held test sets, and sovereign deployment requirements. Different
languages will have different agreements. A CC0 corpus, a research-only
community corpus, and a sealed gold-standard set governed by a tribal council
can all participate, each on its own terms.

What is uniform is the machinery that honors those terms: exposure lanes,
license gates, quarantine, and fetch-from-source registration (see
[Registering Corpora](/docs/network/sovereignty/registering-corpora)). What is
*never* uniform is the deal itself.

When a corpus steward sets terms — for benchmark participation, for a sponsored
prize, or for anything else — the term sheet answers a small set of questions:

| Dimension | The question |
|---|---|
| **Corpus exposure** | Which lane — public, research-only, or private? Are references ever shown? |
| **Method ownership** | If a prize is won, who owns the winning method — the developer, the community, or shared? |
| **Deployment** | Who may deploy the method, where, and under what conditions? |
| **Self-hosting** | Must the method run entirely on community-controlled infrastructure? |
| **Secrecy** | Is the test set sealed? Who holds the keys? Who authorizes each evaluation run? |
| **Compensation** | What are builders, validators, and reviewers paid? (Published defaults: [How Speakers Get Paid](/docs/network/perspectives/how-speakers-get-paid)) |

None of these have platform-imposed answers. The defaults below are a template,
not a rule.

## The Community Transfer Template

For sponsored prizes on Indigenous-language corpora, the default template —
offered as a starting point for a community's governance body to revise —
works like this:

### 1. Method development
A researcher, student, or developer builds a translation method — an FST-gated
pipeline, a coached LLM, a fine-tuned model, or any other approach — using
their own resources and openly licensed data.

### 2. Network evaluation
The method is benchmarked through the [eval harness](/docs/network/specifications/harness).
Every submission is fingerprinted to a specific Git commit and dataset version.
Scores are reproducible.

### 3. Community review
Results are reviewed by community language workers. A high leaderboard score
proves the method *works*; it does not prove it is *appropriate*. Bilingual
speakers validate a sample of outputs, and the community's reviewers can decline
a method for any reason.

### 4. Ownership transfer
When a method meets the prize bar (automated metrics **and** human validation),
the developer transfers the method — source code, trained weights,
configuration, coaching data — to the community's governance organization
(a tribal council, language authority, or similar body chosen by the community,
never by Champollion). The community owns the artifact outright: it can
inspect, modify, deploy, shelve, or license it, with no ongoing claim from the
developer or from Champollion.

Third-party components the developer does not own (an open-weight base model,
an AGPL FST) cannot have their ownership transferred — they pass to the
community under their own open licenses, which is why prize admissibility
requires every dependency to carry rights the community can actually receive.
See the dependency classes in the
[Method Interface spec](/docs/network/specifications/methods#method-validity-and-dependency-classes).

The developer keeps what researchers should keep: the unrestricted right to
publish the approach and results, to reuse their techniques anywhere, and
permanent attribution as the method's creator.

### 5. Deployment — if and how the community chooses
The community decides whether the method is deployed at all, by whom, and on
what terms. Independent deployment is entirely the community's affair:
**Champollion takes no share of anything a community earns from an asset it
owns**, and holds no deployment rights of its own.

:::note[Status: template, not track record]
No prize has opened and no transfer has happened yet — the leaderboard
currently has no published runs. This template is documented so the intended
terms are transparent before anyone invests effort, and so a community's
governance body has a concrete draft to react to rather than a blank page.
A signed instrument, drafted with counsel for the specific parties, is what
would make any of this binding.
:::

## For researchers

If you are developing a method for an Indigenous language:

1. **Establish a relationship** with the language community before you start
2. **Use openly licensed data** for development (not community-restricted resources)
3. **Document provenance** in your [run card](/docs/network/specifications/run-card) — every resource, its license, and origin
4. **Read the prize's terms before building for it** — if the terms include
   transfer, your contribution is the architecture and technique (yours to
   publish and reuse); the community's contribution is the linguistic knowledge
   that makes it work for their language

## See Also

- [Data Stewardship](/docs/network/sovereignty/data-sovereignty) — the position these terms implement
- [How the Work Is Funded](/docs/network/sovereignty/economic-model) — where money moves, and what Champollion takes (nothing)
- [Registering Corpora](/docs/network/sovereignty/registering-corpora) — exposure lanes and fetch-from-source
- [Prize Specification](/docs/network/specifications/prizes) — threshold conditions and claim process
