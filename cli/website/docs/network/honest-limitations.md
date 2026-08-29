---
title: Honest Limitations
description: "What Champollion does not (yet) claim. The checkable limits on our evaluation, trust tiers, community validation, and held-out infrastructure."
---

# Honest Limitations

> These are the claims we will **not** exceed. If anything elsewhere on this
> site implies more than what's written here, treat it as a bug and
> [tell us](/docs/network/perspectives/reporting-errors-and-owning-corrections).

Evaluation infrastructure only earns trust by being honest about its edges. Here
are ours, stated plainly enough to check.

## 1. Deep morphological validation currently covers one pair

FST-based morphological validation — checking that every output word is a
well-formed word in the target language — is in practice wired for **English →
Plains Cree only**. The `GiellaLTFSTMetric` itself is **generic**: it scores any
language with a published GiellaLT `.hfstol` analyzer (Plains Cree, the Sámi
languages, Finnish, Norwegian Bokmål, Inuktitut, and others), so the capability
is broad. But **evaluation corpora exist only for Plains Cree** today, so crk is
the only pair that is FST-scored in practice. Every other pair on the
leaderboard is scored with surface metrics (chrF++, BLEU) and behavioral checks.
Those are useful signals, but they do **not** guarantee morphological validity.
We do not claim morphological validation for any language without both an FST and
an evaluation corpus.

## 2. Trust tiers are self-reported at launch

Most scores are computed by contributors running the harness themselves and
publishing the result. Server-side **verification** — re-scoring a submission
against the SHA-pinned canonical corpus — exists and is expanding, but
"verified" is not yet universal. Read the trust badge on each row: **"self-reported"
means exactly that**, and it is the default.

## 3. Community speaker-validation has not happened yet

Our prize requires **≥ 70% acceptance from bilingual speakers**. That gate is
specified, and the tooling to run it is under construction — but **no community
speaker review has been conducted**, and **no score on this site has cleared the
speaker gate**. Composite and chrF++ numbers are machine signals, not a
community verdict.

## 4. The evaluation sandbox exists; its custody ceremony does not yet

We fetch corpora from their source and SHA-pin them, and held-out splits are
sealed. When a community holds a secret test set, a method can be scored
against it without the set ever leaving their hands — and that evaluation
now has **two lanes**. The
preferred one, for standard neural models, is **declarative**: the participant
submits data only — safetensors weights + a declarative tokenizer + a config —
and the organizer runs it in their own trusted inference engine
(`trust_remote_code=False`, offline; permissive about the architecture because
the safety is in the code-free format, not the architecture name). No participant code runs
at all, so there is nothing to sandbox; the safety check is a decidable format
validation (is this safetensors and not a pickle? no `trust_remote_code`?), not
an attempt to prove arbitrary code is safe. For methods that genuinely are code
(pipelines, LLM-coached hybrids), the fallback is the network-isolated
**sandbox** (static checks, `--network=none` containers, scores-only egress, an
optional true-airgap file transport). The sandbox contains untrusted code rather
than refusing to run it, so it is the honestly-weaker lane — its load-bearing
guarantee is `--network=none` (a heuristic static scan can't vet a binary
model), and deeper hardening (seccomp, microVMs) is deferred. See
[run a sovereign contest](/docs/network/sovereignty/run-a-sovereign-contest)
for exactly what is live and what is not. What is **not** built either way: the
community-key-custodied side — threshold signing, key ceremonies, and node
attestation. Today's authorization is recorded process (single custodians,
single keys, honestly labeled), so gold-standard **prize** evaluation remains
closed until the custody work and community consent catch up.

## 5. Key custody is decided; community custodians are in confirmation

The custody *mechanism* is decided: a threshold/multisig scheme in which
**Champollion holds zero key shares**. The custodians themselves are chosen by
the communities, and those conversations are ongoing — so we say **"community
key custodians (in confirmation)."** Custody is not consent: the relational
community-consent process is its own, slower, and more important track.

---

These limits will move as the work does. When one of them changes, this page
changes with it — and the change should be visible in the page history, not
quietly dropped.
