---
title: What data sovereignty means when you write it into software
sidebar_label: Data sovereignty
description: "Indigenous data sovereignty is a set of principles about who owns, controls, accesses and possesses data. This is what those principles look like when someone tries to build them into working software — and what that attempt cannot claim."
---

# What data sovereignty means when you write it into software

:::info[Who this is for]
Anyone. No background in law, machine learning, or Indigenous governance is
assumed. If you have ever wondered what it would actually take for a community
to keep control of its own language data once computers get involved, this page
is the long answer.
:::

Most discussion of data and consent stops at permission: did someone say yes.
Data sovereignty asks a harder set of questions. Who **owns** this? Who decides
what happens to it? Who can reach it? Where does it physically sit?

Those questions did not appear from nowhere. They were articulated first and
most forcefully by Indigenous peoples.

---

## 1. The questions — and who first asked them

First Nations in Canada articulated data-sovereignty principles of
**ownership, control, access, and possession** as an assertion of jurisdiction
over their own information — arising from a documented history of research
being done *on* communities rather than *with* them, and of the resulting data
never coming back.

That origin is not trivia. These are not a general-purpose ethics checklist
that anyone may pick up; they are assertions of jurisdiction, made by specific
peoples in specific legal and cultural settings, and they belong to the
communities that made them.

The four questions, briefly:

| | The question it answers |
|---|---|
| **Ownership** | Who owns this information? A community owns its cultural knowledge and data collectively — the way a person owns their own personal information. |
| **Control** | Who decides what happens to it? Communities control every stage of anything touching them: what is collected, how, by whom, for what, and what is done with it afterwards. |
| **Access** | Who can reach it? Communities must be able to access information about themselves, wherever it is held, whoever holds it. |
| **Possession** | Where does it physically sit? Not the same as ownership — possession is the concrete fact of custody, and it is the mechanism that makes the other three enforceable rather than promised. |

Distinct frameworks exist and are not interchangeable with each other:
**CARE** (Collective Benefit, Authority to Control, Responsibility, Ethics)
for Indigenous data governance broadly, and **Te Mana Raraunga** for Māori
data sovereignty, among others. Each arose in its own legal and cultural
setting. Using one framework's name for another's principles is its own kind
of erasure.

---

## 2. Why software makes this sharp

A principle can survive on paper as a good intention. Software forces the
question, because a computer does not act on intentions — it acts on what was
built.

Consider the ordinary way a translation system gets evaluated. To find out
whether a system translates your language well, someone needs a **test set**:
sentences in your language, paired with what they mean. Almost every evaluation
platform asks you to **upload** that test set so it can be scored against.

Read that again with the four questions in hand. Uploading transfers
possession. It usually transfers practical control — once a copy exists on
someone else's machine, your ability to say "stop" is a request, not a
capability. Access becomes something you are granted rather than something you
have. Ownership survives on paper and stops meaning much.

For a community whose language data was extracted before, "upload it and trust
us" is not a neutral request. It is the same shape as the thing that already
happened.

---

## 3. What the mechanisms actually are

This project's position is that if sovereignty is real, it has to be a property
of the software, not a paragraph in a policy. Here is what that looks like
concretely. These are described so you can evaluate them, and argue with them.

**Registration without surrender.** A test set is registered by describing
*where it lives* and pinning a cryptographic hash of its exact contents — not by
uploading the sentences. At evaluation time the system fetches from the source,
checks the hash matches, and scores. Nothing is stored. If the holder takes the
source offline, the corpus simply stops being evaluable. Control stays where it
started, because possession never moved.

**Encryption before departure, for the strongest tier.** Where a corpus must be
usable without ever being readable, it is encrypted **on the holder's own
device** before anything leaves. What this project receives is ciphertext and a
description containing no content.

**No single party can decrypt.** The key is split among a group of custodians so
that some number of them — say three of five — must act together to authorize
anything. No individual custodian can act alone, and neither can this project:
the decided model is that **Champollion holds zero shares**, so it cannot
decrypt with or without anyone's cooperation. A run happens because a quorum of
custodians decided it should.

> **Where this actually stands.** The mechanism is built and testable. The
> *custodians are not confirmed* — composition belongs to the communities
> involved, and no group has consented to hold shares yet. Until they have,
> there is no live custodian set, and this project will not name candidates
> publicly. So read the paragraph above as a working mechanism awaiting the
> relationships that would make it operate, not as something running today.

**Results without exposure.** What comes back from a sealed evaluation is
scores, not sentences. A method can be proven to work on a corpus that the
method's author, and this project, never read.

**Consent before transmission.** Sending text to an external model API is itself
a disclosure. Corpora under community, bespoke or unstated licences **refuse**
remote evaluation until the rights-holder has explicitly recorded permission for
it. That refusal is enforced in code, and no automated process can grant the
permission on a community's behalf.

**Reversibility in one direction only.** Exposure can be loosened by a
deliberate decision of the holder. It never loosens by default, by accident, or
by someone else's convenience.

---

## 4. What this is not

**This project is not validated, certified, or approved against any Indigenous
data-sovereignty framework. No assessment has taken place, none is pending,
and none is implied.**

What exists is an **attempt to enact data sovereignty in code** — to take
principles articulated by Indigenous peoples and express them as working
mechanisms rather than commitments. That attempt is ours. Whether it succeeds
is not ours to declare. Compliance determinations belong to the communities
involved, and a project asserting its own compliance would be reproducing in
miniature the exact posture these principles exist to correct: the outsider
deciding what counts as adequate treatment of a community's information.

Nor is any of it a guarantee of impossibility. Software has defects. Operators
make mistakes. A determined party holding enough of the right roles is a
residual risk that no architecture removes. The claim is narrower and, we think,
more useful: **the easy paths are closed, and the hard ones leave evidence.**

There are also gaps between the principles and the mechanisms, and we would
rather name them than let you find them. Possession is the principle these
mechanisms serve best — the code is genuinely good at not holding things.
Ownership and Control reach further than software can go on its own, into terms,
governance and relationships that no amount of cryptography settles. And every
mechanism above assumes a community that already has the capacity and
infrastructure to hold its own data, which is not a neutral assumption.

---

## 5. Please argue with this

The attempt is open to critique, and the invitation is not decoration.

If you work on Indigenous data governance, CARE, Te Mana Raraunga, or
Indigenous language technology — or if you are a member or representative of a
community whose language is in this index — we want to hear where this is wrong.
Specifically:

- where a mechanism does not do what the principle requires;
- where the framing misrepresents a community's principles, or borrows their authority;
- where something is described as protective that would not protect you;
- where a community would need something we have not built;
- where the vocabulary itself is off.

Objections and corrections can be raised through the
[contact and takedown route](/docs/network/community/contact-objections-takedown),
which also covers requesting the removal of anything about a language you
represent. There is no requirement to be diplomatic about it.

Being unreviewed is a fact about this work, not a defence of it. An attempt that
invites review is honest; one that does not is a claim.

> This page is a description of one attempt to build toward principles whose authors are the communities themselves — seek out those principles as their authors state them; this attempt is not endorsed by any of the organizations that steward them.

---

## Where to go next

- [Data Stewardship](/docs/network/sovereignty/data-sovereignty) — the operational position, in more depth.
- [Registering Corpora](/docs/network/sovereignty/registering-corpora) — the four exposure tiers, and what leaves your machine under each.
- [Run a Sovereign Contest](/docs/network/sovereignty/run-a-sovereign-contest) — the custodian ceremony, end to end.
- [Honest Limitations](/docs/network/honest-limitations) — what this project does not claim.
- [For Language Communities](/docs/network/community/for-language-communities) — the practical starting point.
