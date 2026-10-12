---
sidebar_position: 10
title: Terms Templates
slug: /network/sovereignty/terms-templates
description: "Adaptable, trustless-leaning terms ideas for a community running a sovereign contest — ownership, scores-only licensing, hash-pinned integrity, fail-closed defaults, and an honest tour of trojan-horse risks."
related:
  - label: "Run a Sovereign Contest"
    to: /docs/network/sovereignty/run-a-sovereign-contest
    kind: doc
    note: "The runbook these terms attach to"
  - label: "Ownership & Terms"
    to: /docs/network/sovereignty/ownership-transfer
    kind: doc
  - label: "Data Stewardship"
    to: /docs/network/sovereignty/data-sovereignty
    kind: doc
  - label: "Prize Specification"
    to: /docs/network/specifications/prizes
    kind: spec
---

# Terms Templates

> **Executive Summary.** Starting-point terms a community or organization can
> adapt when running a [sovereign contest](/docs/network/sovereignty/run-a-sovereign-contest).
> The design bias throughout is **trustless-leaning**: wherever possible, a
> term is backed by a mechanism (a hash, a gate, an append-only log) rather
> than a promise. Each term is one short paragraph plus a plain-English gloss.

:::warning[This is not legal advice]
These are drafting *ideas* from a non-commercial research project, not legal
advice, and we are not lawyers. Laws differ by jurisdiction, and Indigenous
data-governance frameworks impose obligations no template can
discharge. Have your own counsel — and your own community governance process —
review anything before you rely on it.
:::

---

## Core terms

### 1. The corpus is and remains the owner's property

*Term.* The evaluation corpus, all entries in it, and all derivative metadata
remain the sole property of the registering community/organization. No use of
the Network's registration, contest, or evaluation machinery transfers any
right, title, or interest in the corpus to the platform, to method developers,
or to any sponsor. The platform holds no copy and claims no license beyond the
digest of the encrypted blob.

*Plain English:* running a contest against your corpus gives nobody a piece of
it. Champollion holds a hash, not a claim.

### 2. Evaluation grants a scores-only license — nothing else

*Term.* An authorized evaluation run grants the platform and the method
developer a license to receive and publish **numerical scores and aggregate
statistics only**. It grants **no** right to retain corpus content after the
run, **no** right to train, fine-tune, or coach any model on it, and **no**
right to construct derivative corpora, memorized examples, or lookup tables
from it. Any content retention beyond the run terminates the license and voids
the run's results.

*Plain English:* what comes out of a sealed run is a number. Sentences never
do — not into a leaderboard, not into a training set, not into anyone's cache.

### 3. Hash-pinned integrity: the digest is published, the content never is

*Term.* The corpus is identified exclusively by the published SHA-256 digest of
its encrypted blob and a version label. Only blobs matching the digest count as
the corpus; any run against non-matching bytes is void. Publication of the
digest is not publication of the content, and nothing in these terms obliges
the owner to ever disclose the content to anyone.

*Plain English:* everyone can check *which* corpus was used; nobody gets to
*read* it. If the bytes don't match the hash, the run doesn't count.

### 4. Fail-closed defaults

*Term.* Every ambiguity resolves toward no access and no publication. A request
that is not affirmatively authorized by the custodian threshold is denied; a
grant that has expired or been used is dead; a result whose provenance cannot
be verified is not published; a corpus whose registration lapses stops being
runnable. Silence never constitutes consent.

*Plain English:* when in doubt, the answer is no. Nothing defaults to open.

### 5. Custodian authorization gates every run

*Term.* No evaluation may execute against the sealed corpus without a recorded,
threshold-approved authorization and a single-use, time-boxed grant bound to
the specific method, corpus version, and evaluation environment. All
authorization events, including denials and blocked attempts, are recorded in
an append-only, publicly replayable audit log.

*Plain English:* your custodians approve every single run, one run at a time,
and the whole history is public and tamper-evident. (The cryptographic
threshold-signing tooling is still in development — see the
[status box in the runbook](/docs/network/sovereignty/run-a-sovereign-contest) —
so today this term is enforced as recorded process, not yet as math.)

### 6. Prize funds are sponsor-held and the award rule is public

*Term.* Prize funds are held by the named sponsor organization or a designated
community trust — never by the platform. The award threshold is published
before the contest opens, is verifiable from published scores plus the
community's own speaker-validation verdict, and the award decision belongs to
the funds' holder alone.

*Plain English:* the money sits with whoever put it up, the bar is public, and
whether the bar was cleared is checkable by anyone. Champollion can't pay,
withhold, or redirect a prize because Champollion never has the money.

---

## Trojan-horse risks {#trojan-horse-risks}

An honest terms document names the ways the arrangement can be attacked. Put
these in yours — a sponsor or community that has read them is harder to burn.

### Malicious method submissions that try to exfiltrate the test data

A "method" is submitted code. A hostile one can try to smuggle test sentences
out — encoding them in its outputs, writing them to logs, or phoning home.
**Mitigations:** scores-only emission (per-entry output text from sealed runs
is never published — enforced at the data layer today); a **no-egress
sandbox** for sealed execution (🔲 in development — until it ships, treat this
mitigation as partial and weight your custodians' approvals accordingly); and
**query/run budgets per method per round** — a method gets a small, fixed
number of sealed runs, so the corpus cannot be reconstructed by repeated
probing even through the scores channel.

### Poisoned or contaminated submitted corpora

The attack can also run the other way: someone offers a community a
"ready-made" test corpus that is subtly wrong, offensive, or already public
(so methods have memorized it and scores are meaningless).
**Mitigations:** provenance requirements on every entry (who authored it,
when, from what source); [speaker validation](/docs/network/specifications/speaker-validation)
of the corpus itself before sealing; and contamination screening against
public data before a corpus is accepted as a qualifier or gold standard.

### License trojans in dependencies

A winning method that quietly bundles content or code whose license forbids
the community's intended use (commercial deployment, redistribution) poisons
the transfer — you win a tool you cannot legally use.
**Mitigations:** dependency-class declarations and a mechanical license gate on
submissions (see the [Prize Specification](/docs/network/specifications/prizes)
dependency-class table); undeclared dependencies are disqualifying.

### Credential phishing

Anyone running a contest becomes a target for "paste your token here to
verify your registration" attacks. **Mitigations:** never paste tokens,
keys, or credentials into third-party pages or share them in chat; all
authentication in this project happens through the CLI's OAuth flow, and
**no browser personal-access-token flows exist anymore** — any page asking
for one is hostile. Custodian decisions should happen over channels your
community already trusts.

### Sponsor-side prize default

The quiet failure mode: methods clear the bar and the sponsor doesn't pay.
**Mitigations:** publish the funds holder's identity and the holding
arrangement (org account, trust, escrow agent) *before* the contest opens;
make award conditions verifiable from published scores so a default is
publicly visible as a default, not deniable as a judgment call; and prefer a
holder with something to lose reputationally. Champollion cannot underwrite
this risk — by design it never holds the funds — so the credibility of a prize
is exactly the credibility of its named holder.

---

## Using these

Copy what fits, delete what doesn't, add what your governance requires, and
publish the result alongside your contest so participants agree to *your*
terms, not to a vibe. Per-community terms — including method ownership
transfer for sponsored prizes — are the norm here, not the exception: see
[Ownership & Terms](/docs/network/sovereignty/ownership-transfer).

