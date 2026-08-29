---
sidebar_position: 4
title: 'Reporting Errors and Owning Corrections'
slug: '/network/perspectives/reporting-errors-and-owning-corrections'
description: 'How a speaker reports a wrong fact or a bad translation, who decides what happens next, how corrections carry provenance, and why communities hold veto power over their language data.'
related:
  - label: "Data Sovereignty"
    to: /docs/network/sovereignty/data-sovereignty
    kind: doc
    note: "Who holds veto power over language data"
  - label: "Ownership Transfer"
    to: /docs/network/sovereignty/ownership-transfer
    kind: doc
  - label: "Speaker Validation Protocol"
    to: /docs/network/specifications/speaker-validation
    kind: spec
  - label: "How Speakers Get Paid"
    to: /docs/network/perspectives/how-speakers-get-paid
    kind: position
---

# Reporting Errors and Owning Corrections

> **Position.** Being wrong is inevitable for a platform that publishes facts and evaluations about thousands of languages. What is *not* inevitable is who gets believed when an error is reported, and who owns the correction. Our answer: a fluent speaker's report outranks our automation, every correction carries provenance saying who changed what and why, and a community can withdraw or veto the use of its language data — not as a courtesy, but as an enforced property of the architecture.

Most data platforms treat error reports as support tickets: a user complains, a maintainer decides, the record silently changes. For Indigenous language data that model is upside down. The person reporting the error is usually more authoritative than the platform — a speaker telling us a word is wrong is not a "user," they are the ground truth correcting a proxy. The design below follows from taking that seriously.

---

## Two kinds of error, one principle

The platform publishes two kinds of claims that can be wrong:

1. **Facts about a language** — the language cards that drive evaluation: classification data, orthography, linguistic features, which metrics apply. A card might claim the wrong speaker estimate, the wrong dialect relationship, the wrong writing system status.
2. **Judgments about translations** — a reference translation in a corpus that a speaker considers wrong or unnatural; an automated metric that rejects a valid word or accepts an invalid one; a "Deployable" badge on output speakers wouldn't accept.

The principle covering both, already binding in the [Scoring Specification](/docs/network/specifications/scoring) and [Benchmark Specification §7](/docs/network/specifications/benchmark#7-human-validation): **automated outputs are proxies; speakers are the ground truth.** The published commitment in the [Speaker Validation Protocol §6](/docs/network/specifications/speaker-validation#6-what-speakers-get) puts it bluntly: if a speaker says the linter is wrong about something, we fix the linter.

## How a report travels

Here is the path a report takes, with honest status markers — some of this runs today, some is specified and not yet built.

**Reporting a bad translation or metric judgment (running today, by direct channel).** A speaker who sees a wrong reference translation, a falsely rejected word, or an unacceptable "equivalent" can report it through the project's public repository issue tracker or by contacting the project directly. The structured version of this — rating screens with *reject / gist / acceptable / excellent* options and free-text notes — is the community review interface, which is specified in the [Benchmark Specification §7.3](/docs/network/specifications/benchmark#7-human-validation) but not yet live. Until it is, reports are handled person-to-person, and the validation tasks themselves (paid, structured speaker review — see [How Speakers Get Paid](/docs/network/perspectives/how-speakers-get-paid)) are the main correction pipeline.

**Reporting a wrong fact on a language card (running today, same channels).** Card corrections follow the same path: report, review, versioned change. Because cards drive evaluation behavior — which metrics load, which models are recommended — a card fix can change scores, so corrections are applied as recorded data changes, never silent edits.

**What happens next — who decides:**

- **Linguistic judgment calls belong to speakers of that language.** Whether a form is valid, whether two phrasings are equivalent, whether a register is appropriate — the platform implements the answer; it does not supply it. Where speakers disagree (dialects, orthographic conventions), the answer is recorded as variation, not adjudicated by us — the corpus and linter schemas support tagging dialectal variants as acceptable alternatives rather than forcing one winner.
- **Decisions about a community's data belong to its governance organization.** For languages with a governance org, changes to evaluation corpora, acceptance of corrections into sealed test sets, and deployment consequences run through them — that is community control of language data — see [Data Sovereignty](/docs/network/sovereignty/data-sovereignty) — implemented as process, not poster.
- **Mechanical errors are just fixed.** A typo, a broken link, a mis-parsed field — reported, corrected, logged. Not everything needs a council.

## Corrections carry provenance

A correction you cannot trace is just a newer opinion. Three provenance rules apply to every fact and every fix:

1. **Every fact names its source.** Language cards and corpus entries record where each value came from — a published dataset, a community contribution, a speaker's review.
2. **Derived values are labeled as ours, not the upstream's.** When the platform computes something — an aggregate, a recoding, a composite — it is recorded as a platform derivation *from* the upstream source, never written under the upstream's name. An upstream dataset should never be blamed for, or credited with, a number it didn't publish.
3. **Corrections become part of the record.** A speaker's correction is recorded as a new, attributed assertion (named or anonymous, at the speaker's choice — the same terms as validation work) that supersedes the old value; the history of what changed remains auditable. Corpus versions are hash-manifested ([Corpus Partnership §4.4](/docs/network/specifications/corpus-partnership)), so a corrected corpus is a visibly new version, and every run card records exactly which version it was scored against — old scores stay interpretable, new scores reflect the fix.

## The veto, concretely

"Community control" is easy to claim. Here is what it cashes out to in the published architecture:

- **Speakers can withdraw their contributions.** A speaker can pull their ratings at any time, and withdrawal removes them from all analyses ([Speaker Validation §5](/docs/network/specifications/speaker-validation#5-data-governance)). Speakers also hold veto power over publication of results they find problematic.
- **Communities can stop evaluation entirely.** Sealed test sets are encrypted, with keys held so that the platform alone can never reconstruct them; a community can revoke evaluation access by declining to participate in key reconstruction ([Corpus Partnership §4.3](/docs/network/specifications/corpus-partnership#4-cryptographic-sealing-and-sandbox-testing)). "What if we want to stop?" has a specified answer: the sealed data is never exposed, and evaluation ends.
- **No score overrides a community decision.** A method that tops the leaderboard still deploys only if the governance organization says so ([Ownership Transfer](/docs/network/sovereignty/ownership-transfer)) — and a community that decides MT should not be deployed for their language at all is exercising the system as designed, not breaking it (see [Translation Is Not Revitalization](/docs/network/perspectives/translation-is-not-revitalization)).

## What we have not built yet

In the spirit of the rest of this shelf: the community review interface is planned, not live. Governance organizations are established for none of the current languages yet — community custodianship for the Plains Cree benchmark is in confirmation, and we do not name custodians publicly before they have consented. Until those pieces exist, corrections run through direct, attributable channels, and the published specs — not this page — remain the binding description of the process. Where this page and a spec disagree, the spec wins, and we'd consider the disagreement a bug worth reporting too.

---

## What this means for you

:::info[If you are a community member]
If something about your language on this platform is wrong — a fact, a translation, a label — your report is testimony from the ground truth, not a complaint to be triaged. You decide whether your correction is credited by name; your contribution can be withdrawn later; and your community can halt the use of its data outright. Start at [For Language Communities](/docs/network/community/for-language-communities), or just open an issue on the public repository.
:::

:::info[If you are a researcher]
Corrections here are data with provenance, not silent edits: corpus versions are hashed, run cards pin the exact version they were scored against, and derived values are labeled as derivations. If you build on Network scores or corpora, cite the version — and treat a speaker-driven correction wave as a finding about metric validity, because that is what it is.
:::

:::info[If you are a builder]
Your method's score can legitimately change without your code changing — a falsely rejected word gets allowlisted, a reference translation gets corrected, a variant class gets fixed. Design for that: pin corpus versions in your run cards ([Run Card spec](/docs/network/specifications/run-card)), watch dataset changelogs, and treat speaker corrections as the most reliable error signal you will ever get for free.
:::

## See also

- [How Speakers Get Paid](/docs/network/perspectives/how-speakers-get-paid) — the same speaker authority, at the benchmark stage
- [From Benchmark to Daily Use](/docs/network/perspectives/from-benchmark-to-daily-use) — where corrections meet the publishing workflow
- [Data Sovereignty](/docs/network/sovereignty/data-sovereignty) — Indigenous data-sovereignty principles, CARE, and Te Mana Raraunga — the principles behind this design
