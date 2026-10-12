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

## 1. Deep morphological validation depends on an FST *and* a rankable test set

FST-based morphological validation — checking that every output word is a
well-formed word in the target language — needs two things for a language
pair: an FST the harness has pinned, and an evaluation set for the pair that
can rank. The `GiellaLTFSTMetric` itself is **generic**: it scores any
language with a pinned GiellaLT FST (Plains Cree, the Sámi languages,
Finnish, Norwegian Bokmål, Inuktitut, and others). Several of those languages
have open evaluation sets (Tatoeba, WMT, WMT24++) — the
[datasets page](/docs/network/leaderboard/datasets) lists the catalogue,
`mt-eval corpora --source eng --target <code>` lists what can run for a pair,
and `mt-eval corpora --with-fst` lists only the pairs whose target has a
pinned FST, with whether it is installed on your machine.
Plains Cree, the language the FST work started with, is the exception: its
two evaluation sets (EdTeKLA) are catalogued as quarantined labels, and the
database refuses any score posted against them.

Two further limits apply. Where the pinned FST is only a spell-checking
**acceptor** (Northern Sámi, Amharic, Basque), it says whether a word exists
but not whether it is correctly inflected, so `morphological_accuracy` is not
computed — and an acceptor accepts some English and capitalised words, so
FST acceptance can credit untranslated output (the run card then shows a
source-copy caveat; see [score caveats](/docs/network/specifications/scoring#2-8-score-caveats)). FST acceptance is a diagnostic: it never enters the chrF++ headline or ranks a run.
It also credits one valid sentence repeated for every input; the run card
then shows a near-constant-output caveat.
And every pair without an FST is scored with surface metrics (chrF++, BLEU)
and behavioral checks. Those are useful signals, but they do **not**
guarantee morphological validity. We do not claim morphological validation
for any language without both an FST and an evaluation set that can rank.

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
speaker gate**. chrF++ and every other automatic number are machine signals,
not a community verdict, which is why no score here carries a quality label.

## 4. The evaluation sandbox and key ceremony exist; no custodian has used them

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
optional true-airgap file transport). Because the sandbox has no network, a
method runs there only with every model it calls inside its bundle: an
LLM-coached hybrid must ship its LLM as open weights, since a hosted LLM API
cannot be reached. The sandbox contains untrusted code rather
than refusing to run it, so it is the honestly-weaker lane — its load-bearing
guarantee is `--network=none` (a heuristic static scan can't vet a binary
model), and deeper hardening (seccomp, microVMs) is deferred. See
[run a sovereign contest](/docs/network/sovereignty/run-a-sovereign-contest)
for exactly what is live and what is not. The offline node's **key ceremony is
built** — the set key is split M-of-N and re-assembled only in memory during a
quorum-authorized run — but it has never been used with a real custodian, and
shares are plain files in this first version. What is **not** built: threshold
signing (a score is signed by a single node key) and hardware attestation (score
manifests are signed in software only). No custodian has been appointed, so
gold-standard **prize** evaluation remains closed until custodians and
community consent are in place.

## 5. Key custody is designed; no custodians are appointed yet

The custody *mechanism* is designed: a threshold scheme in which **Champollion
is designed to hold zero key shares**. It has not yet been run with real
custodians. Custodians are chosen by the communities themselves, and none has
been appointed, so we say **"community key custodians — none appointed yet."**
Custody is not consent: the relational community-consent process is its own,
slower, and more important track.

## 6. We measure methods on benchmarks; we do not score individual translations {#system-vs-output}

Two different things get called "trustworthy machine translation." We do one of
them.

**System level — what we do.** Given a language pair, a test set and a method:
how does that method score, under which metric, on which domain, in which
contamination lane, at which trust tier? That is a claim about a *method on a
benchmark*, plus a claim about who set the bar. The scoring rules are
published, the corpora are pinned, and for a sovereign benchmark the community
that owns the test set decides what passes. The leaderboard, the map, the run
cards and `mt-eval` are all this, and only this.

**Output level — what we do not do.** Given one source sentence and one
translation of it: how likely is *that* translation to be right? In MT and NLP
that is quality estimation and uncertainty quantification, and it is a research
field of its own. We publish **no per-segment confidence on any translation**,
and nothing here is a calibrated probability that a given output is correct. A
high-scoring row is not a warranty on the next sentence a method produces.

The inverse is the easier mistake, and it binds us too. When a surface here says
no method on a pair scores well enough to deploy — as
[human translation services](/human-services) does — that is a statement about
measured methods on measured test sets. It is a good reason not to ship machine
output for that pair. It is not a verdict on any particular sentence.

**Quality estimation is an open slot, not a hidden gap.** The harness already
computes one reference-free neural score, AfriCOMET-QE (`qe_score`), as the
adequacy signal for runs with no gold reference. It is reported as a
**corpus-level** number in the separate neural lane, is re-derived by the
verifier, and never enters the chrF++ headline
([Scoring Specification](/docs/network/specifications/scoring#how-runs-are-scored)). Metrics are
plugins ([Plugin Specification](/docs/reference/plugin-spec)), so a
segment-level QE metric is something this harness can take. Until one is wired,
published, and meta-evaluated per language the way the reference-based metrics
are ([Metric Reliability](/docs/network/specifications/metric-reliability)), we
say nothing about individual outputs.

---

These limits will move as the work does. When one of them changes, this page
changes with it — and the change should be visible in the page history, not
quietly dropped.
