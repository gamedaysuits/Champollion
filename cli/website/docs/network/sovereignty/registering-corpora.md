---
sidebar_position: 8
title: Registering Corpora & Exposure Lanes
slug: /network/sovereignty/registering-corpora
description: "Register an evaluation corpus without surrendering it. The four exposure tiers — local-only, private, public and sealed — the license lanes that run alongside them, and how fetch-from-source keeps corpus content out of our hands."
related:
  - label: "Data Stewardship"
    to: /docs/network/sovereignty/data-sovereignty
    kind: doc
    note: "The position these mechanics implement"
  - label: "Ownership & Terms"
    to: /docs/network/sovereignty/ownership-transfer
    kind: doc
  - label: "Evaluation Datasets"
    to: /docs/network/leaderboard/datasets
    kind: doc
    note: "The catalogue these lanes apply to"
  - label: "Corpus Design Framework"
    to: /docs/network/specifications/corpus-design
    kind: spec
---

# Registering Corpora & Exposure Lanes

> **Executive Summary.** You can register an evaluation corpus with the Network so
> methods can be benchmarked against it **without handing us the data**. Every
> corpus is registered as a sha-pinned *metadata card*, not content — the actual
> sentences are fetched from their source at evaluation time. When you register
> you make two independent choices: an **exposure tier** — how much leaves your
> machine (`local-only`, `private`, `public`, or `sealed`, where the corpus is
> encrypted on your device under an M-of-N custodian key) — and a **license
> lane**, which governs what the corpus may be used for (public, non-commercial
> research-only, or private). This is the mechanism that lets a community make
> its language *measurable* without making it *extractable*.

Machine-translation evaluation usually demands the opposite of data sovereignty:
"upload your test set so we can score against it." That is a non-starter for
Indigenous-language and other community-held corpora, where the data is owned by
the people it comes from. The Network is built so you never have to make that
trade.

---

## 1. Registration is metadata, not content

A registered corpus is a **card**: a small JSON record describing *where* the
corpus lives and *what it is*, with a content hash so the exact bytes can be
verified — but **no sentences**. A card carries:

| Field | What it is |
|-------|-----------|
| `url` | Where the corpus is fetched from (the upstream archive you control) |
| `sha256` | Content hash of the pinned archive — proves nobody swapped the data |
| `license` | SPDX identifier (or `LicenseRef-…` for a bespoke license) |
| `language_pair` | Source → target, e.g. `eng-crk` |
| `do_not_train` | Always set — evaluation data must never be trained on |
| `attribution` | The builder/linguist credit shown everywhere the corpus appears |

At evaluation time the harness **fetches from source**, verifies the `sha256`,
and scores against the freshly fetched references. The Network never stores, hosts,
or redistributes the corpus content. If you take the upstream archive offline,
the corpus simply stops being runnable — control stays with you. This is the
same fetch-from-source discipline applied to the whole catalogue (see
[Evaluation Datasets](/docs/network/leaderboard/datasets)).

:::info[Why a hash instead of a copy]
A content hash lets a self-reported score be **re-checked** against the real,
unmodified corpus without us ever holding that corpus. A run whose numbers don't
reproduce against the hash-pinned source is rejected. Verifiability and
non-possession are not in tension here — the hash is what makes both possible.
:::

---

## 2. Two separate choices

Registration asks you two independent questions, and it is worth keeping them
apart because they protect different things:

1. **What leaves your machine** — the *exposure tier*.
2. **What your corpus may be used for** — the *license lane*.

A corpus can be sealed and non-commercial, or public and commercially clear, or
any other combination. One does not imply the other.

### 2a. Exposure tiers — what leaves your machine

Four tiers, defined in `cli/lib/corpus-registration.mjs`. **Plaintext corpus
content is never uploaded in any of them** — that is not a policy setting, it is
true of every tier. Registration always defaults to the most private.

| Tier | Registered? | What we receive | Card tracked |
|---|:---:|---|:---:|
| **Private / local-only** | ❌ | Nothing. Card and text stay on your machine. **The default.** | ❌ |
| **Register privately** | ✅ | Metadata only — a WMT-style secret held-out set. You keep custody; results can be published without exposing the data. | ✅ |
| **Register publicly** | ✅ | Metadata + a fetch-from-source pointer. Your text is fetched from upstream on demand, never hosted here. Needs a redistribution-cleared license. | ✅ |
| **Sealed** | ✅ | Ciphertext + a content-free card. Nothing else. | ✅ |

**Sealed is the strongest guarantee the system offers.** Your corpus is
encrypted **on your device**, under the custodian group's threshold key, before
a single byte leaves. Champollion receives ciphertext and cannot decrypt it —
and neither can any single custodian: it takes **M of N** of them together to
authorize a run. Sealed sets are catalogued but quarantined, and are paired with
a public *qualifier* corpus that a method must clear before a sealed run can
even be proposed. See [Run a Sovereign
Contest](/docs/network/sovereignty/run-a-sovereign-contest) and the [Sovereign
Eval Node](/docs/network/sovereignty/sovereign-eval-node).

### 2b. License lanes — what the corpus may be used for

Separately, the license governs where results may appear.

#### Public

An openly licensed corpus (e.g. CC0, CC-BY) whose references may appear on public
surfaces and whose runs may rank on the public leaderboard. The content is still
fetch-from-source — "public" governs *exposure of references and rankings*, not
hosting. Most of the catalogue (Tatoeba, GlobalVoices, TICO-19, IN22, SMOL, ALT,
Turkic-x-WMT, WMT24++) is in this lane.

#### Non-commercial research-only

A corpus under a non-commercial license (e.g. CC BY-NC-SA, or a bespoke
community/NGO license such as the Gamayun kits' `LicenseRef-TWB-Gamayun`). It can
be **benchmarked against for research** — methods run on it, scores are computed —
but it is **carved out of every commercial, prize, and API path.** Eligibility is
**use-based**, not corpus-based:

- the **commercial lane is strict** — anything not clearly commercial-licensed is
  excluded;
- the **research lane is lenient** — non-commercial corpora are welcome;
- **quarantine always wins** — a corpus flagged as an improper subset (or
  otherwise barred) can never rank in *any* lane, regardless of license.

This is how a community can let its corpus drive research progress while keeping
it out of anyone's product.

#### Private

A corpus registered for **your own scored runs**, where the references are never
published. You hold the source; you run the evaluation; you decide what, if
anything, is ever shown. A private corpus can be made public or non-commercial
later — exposure only ever *loosens* by an explicit, owner-driven decision, never
silently.

| License lane | Benchmarkable | References shown publicly | May rank on public board | In commercial / prize / API path |
|------|:---:|:---:|:---:|:---:|
| **Public** | ✅ | ✅ | ✅ | ✅ (if license permits) |
| **Non-commercial research-only** | ✅ | depends on license | research lane only | ❌ |
| **Private** | ✅ (your runs) | ❌ | ❌ | ❌ |

:::note[The commercial lane is a guardrail, not a business]
Champollion itself is non-commercial — there is no paid API or product behind
any of this. The commercial/prize lane exists as a *forward* guardrail: it
records, mechanically, which corpora could ever lawfully appear in a prize or
commercial context, so that no future use — by anyone — can drift past a
license or a steward's terms.
:::

---

## 3. Sovereignty guarantees

Registration is designed around the [data stewardship position](/docs/network/sovereignty/data-sovereignty).
Concretely:

- **Possession stays with the source.** We hold a hash and a URL, not the data.
- **Control is the owner's.** The lane is the owner's choice, and exposure only
  loosens by an explicit decision. Pulling the upstream archive revokes runnability.
- **Non-commercial means non-commercial.** NC corpora are mechanically excluded
  from commercial, prize, and API lanes — not by promise, by gate.
- **Improper subsets can never rank.** Quarantine overrides license, so a corpus
  barred from ranking stays barred everywhere.
- **Attribution is mandatory.** The builder/linguist credit travels with the card
  to every surface the corpus appears on.

For how per-language terms are set — including method-ownership transfer for
sponsored prizes — see [Ownership & Terms](/docs/network/sovereignty/ownership-transfer).

---

## 4. How to register

The corpus card schema and the build/verify tooling are documented in the
[Corpus Design Framework](/docs/network/specifications/corpus-design) and the
[Corpus Creation cookbook](/docs/network/tutorials/corpus-creation). In short:

1. Host the corpus archive somewhere you control (it stays there — it is never
   copied into the Network).
2. Write a card: `url`, `sha256`, `license`, `language_pair`, `attribution`,
   `do_not_train`.
3. Choose the exposure lane (public / non-commercial / private).
4. Register the card. Methods can now be benchmarked against the corpus
   fetch-from-source, under the lane's rules.

You never upload the sentences. You can stop at any time.
