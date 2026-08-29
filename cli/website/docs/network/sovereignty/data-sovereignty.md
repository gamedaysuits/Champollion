---
sidebar_position: 7
title: Data Stewardship
description: "Champollion's position on language data: corpora stay with their stewards, every license is respected, and community terms govern community data."
related:
  - label: "The Derived-Artifacts Commitment"
    to: /docs/network/sovereignty/derived-artifacts
    kind: doc
    note: "The output side: models and derived artifacts belong to speakers"
  - label: "Registering Corpora & Exposure Lanes"
    to: /docs/network/sovereignty/registering-corpora
    kind: doc
    note: "The mechanics: benchmark a corpus without handing it over"
  - label: "How the Work Is Funded"
    to: /docs/network/sovereignty/economic-model
    kind: doc
  - label: "Reporting Errors and Owning Corrections"
    to: /docs/network/perspectives/reporting-errors-and-owning-corrections
    kind: position
  - label: "For Language Communities"
    to: /docs/network/community/for-language-communities
    kind: doc
---

# Data Stewardship

> **Executive Summary.** Champollion is machine-translation research and
> development tooling — source-available and free for noncommercial use, its
> evaluation harness open source. This page states its position on language data in
> full: corpora belong to the people they come from, every license and community
> term is respected mechanically rather than by promise, and the platform sets
> no terms of its own on anyone's language.

:::info[Language data is biodata]
Language data is **biodata**. Like genetic or health data, a language carries
the identity, kinship, and relationships of the people who speak it — and like
a genome, it cannot be meaningfully anonymized: strip the names and the language
still encodes who its people are. So the people who provide a corpus hold the
keys to it, and to anything measured against it. That is the premise everything
below rests on.
:::

From that premise, the design follows. Champollion treats every corpus
contributor as a **steward**: the corpus remains theirs — legally, physically,
and practically — while the infrastructure makes it *measurable*.

## The commitments

1. **We never hold the data.** Corpora are registered as hash-pinned metadata
   cards and fetched from the steward's own hosting at evaluation time. Nothing
   is copied into this repository or served from our infrastructure. Take your
   archive offline and evaluation against it simply stops. See
   [Registering Corpora](/docs/network/sovereignty/registering-corpora).

2. **Every license is respected — by gate, not by promise.** Non-commercial and
   research-only corpora are mechanically excluded from any use their license
   does not permit. Restrictions asserted by a community beyond the license are
   recorded with their source and honored the same way. The enforcement lives in
   CI gates and database triggers, not in a code of conduct.

3. **Terms are the steward's, and they vary.** Different languages will have
   different agreements — a public CC0 corpus, a research-only community
   corpus, and a sealed test set with sovereign deployment requirements can all
   participate, each on its own terms. There is no universal contract here and
   no default claim on anything. See the
   [Terms Framework](/docs/network/sovereignty/ownership-transfer).

4. **Secret corpora are supported as architecture, not exception.** A community
   can keep a test set sealed — held on its own infrastructure, never seen by
   Champollion or by developers — and still have methods scored against it.
   Measurability without extractability is a design goal, not a workaround.

5. **Attribution and credit travel with the data.** Builder and linguist credit
   is mandatory on every surface a corpus appears on. Where a community has
   applied [Local Contexts](https://localcontexts.org/) TK or BC Labels, we
   display them and honor the protocol they encode. We carry Labels; we never
   mint them.

6. **Contributors are paid.** Corpus building and validation are professional
   work at published rates — see
   [How Speakers Get Paid](/docs/network/perspectives/how-speakers-get-paid).
   Payment does not buy the corpus: the builder is paid *and* remains the
   steward.

## How a license becomes an enforcement

Commitment 2 has a specific shape, and it is worth stating in full — this is
how "every license is respected" actually runs, not a summary of good
intentions.

**Every benchmark enters held.** A newly catalogued test set is quarantined by
default: visible in the index, excluded from the evaluation queue, from
contests, and from every ranking. Nothing about a corpus is assumed at intake
— not even a permissive-looking license — until its terms are reviewed against
the actual license text at a pinned upstream revision.

**Review verdicts are mechanical, and the hard cases stay held.** A clearly
stated permissive license clears the corpus for every lane. A clearly stated
non-commercial license clears it into a research lane that is excluded from
every commercial, prize, and API surface. And a license that is unstated,
modified, mixed, or bespoke is **never interpreted on the rights-holder's
behalf**: the corpus stays catalogued but held — out of the queue, contests,
and rankings — until the rights-holder states terms or records a grant. The
verdict, its date, its lane, and its basis are stamped machine-readably on the
corpus card and its registry entries, so "why is this runnable?" always has a
citable answer, and so does "why is this not?"

**Sending text to a model is a transmission, and it is gated.** Evaluating a
model means sending it source sentences — that is the corpus leaving home, and
it is governed per license. Permissively licensed corpora may use standard
channels. Corpora under a stated non-commercial license travel only over
channels that contractually do not train on inputs — stated as exactly that: a
no-training guarantee, not a no-retention one. Corpora under unstated or
modified grants are refused remote evaluation outright until consent is
recorded, and sealed community sets never leave their steward's
infrastructure at all. When the gate refuses, its refusal message quotes the
license review's verdict.

**The enforcement sits beneath every client.** Holds are enforced by a
database trigger no client can bypass, the no-hosting rule is enforced by a
repository gate that scans every tracked path for corpus content, and the
transmission gate runs inside the evaluation harness itself. Any of these can
say no to us, which is the point.

## What this is not

Champollion is not a data broker, not a translation vendor, and not a
commercial platform. It is research tooling. A high leaderboard score proves a
method works technically; it is not a license to publish translations,
redistribute a corpus, or deploy anything against a community's wishes. Those
decisions belong to the steward, always.

## The frameworks that shaped this design

This posture was not invented here. It is informed by, and indebted to, the
Indigenous data governance work of the last two decades:

- **First Nations data-sovereignty principles** — First Nations in Canada
  have articulated community ownership, control, access, and possession of
  their own information; the stewardship model here is designed to be
  compatible with those assertions.
- **[CARE Principles](https://www.gida-global.org/care)** (Collective Benefit,
  Authority to Control, Responsibility, Ethics) — Global Indigenous Data
  Alliance.
- **[Te Mana Raraunga](https://www.temanararaunga.maori.nz/)** — the Māori Data
  Sovereignty Network.
- **The [Kaitiakitanga License](https://tehiku.nz/)** — Te Hiku Media's
  guardianship-based license for te reo Māori data, a direct influence on the
  steward-holds-the-keys custody model used here.

We point anyone designing governance for their own language's data to those
sources directly — they are the authorities, not us. Where a community adopts
any of these frameworks for its corpus, the corpus card records that assertion
and the tooling honors it.

Champollion displays the Local Contexts **"Open to Collaborate" Notice**: we
build relationships with the communities whose languages appear here, and
community-authored Labels supersede anything we say about their data.

## See Also

- [Data Sovereignty, from zero](/docs/learn/data-sovereignty) — the primer version of this page, for readers new to the idea

- [Registering Corpora & Exposure Lanes](/docs/network/sovereignty/registering-corpora) — the mechanics
- [For Language Communities](/docs/network/community/for-language-communities) — a plain-language guide
- [How Speakers Get Paid](/docs/network/perspectives/how-speakers-get-paid) — published rates and terms
- [Translation Methods](https://champollion.dev/docs/guides/translation-methods) — the `api` method, which keeps a community's prompts, dictionaries, and coaching data on its own servers
