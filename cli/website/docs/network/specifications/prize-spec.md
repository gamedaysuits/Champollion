---
sidebar_position: 8
title: 'Prize Specification'
slug: '/network/specifications/prizes'
related:
  - label: "Run a Sovereign Contest"
    to: /docs/network/sovereignty/run-a-sovereign-contest
    kind: guide
    note: "The self-serve path to running your own prize"
  - label: "How Speakers Get Paid"
    to: /docs/network/perspectives/how-speakers-get-paid
    kind: position
    note: "The plain-language version of these numbers"
  - label: "The Economic Model"
    to: /docs/network/sovereignty/economic-model
    kind: doc
  - label: "MT Evaluation Rules"
    to: /docs/network/leaderboard/rules
    kind: doc
  - label: "Submit a Method"
    to: /docs/network/getting-started/submit-a-method
    kind: guide
---

# Prize Specification

A prize is the incentive half of the eval-first bargain. A community or
research group curates a small, sealed evaluation set — a few hundred pairs,
every one checked ([Corpus Partnership](/docs/network/specifications/corpus-partnership)
is that workflow). A sponsor posts a prize against a target score on that
set. From that moment the language is a standing challenge: any method
builder in the world can aim at it, the leaderboard measures every attempt
in public, and the bar is settled by the community's own answer key rather
than by whoever shouts loudest. This document specifies how such a prize
works — threshold conditions, claim process, dependency classes, and rules —
so the bar is unambiguous and method-agnostic when one opens.

Prizes are **sponsor-funded and sponsor-held**: the money sits with the
sponsoring organization, or with a community trust the sponsor designates —
**Champollion never holds, escrows, or routes prize funds.** Any community
or organization can run one on the self-serve path in
[Run a Sovereign Contest](/docs/network/sovereignty/run-a-sovereign-contest),
holding its own corpus and its own money.

> **Status: PROPOSED — no prize is open, and nothing here is claimable yet.**
> What gates a prize *opening* is the measurement side: a
> community-consented gold-standard corpus, the air-gapped evaluation
> sandbox (specified, not yet built), and the speaker-review gate. No score
> on this site has cleared a prize bar. See
> [Honest Limitations](/docs/network/honest-limitations). Metrics reference:
> the [Scoring Spec](/docs/network/specifications/scoring); protocol:
> the [Benchmark Spec](/docs/network/specifications/benchmark).

---

## Want to help bring a language into the network?

You don't need to wait for a prize. The highest-leverage things you can do today:

- **Sponsor an MT achievement prize.** Fund a targeted bar — for example, a
  reliable English → Plains Cree method. Champollion coordinates the
  measurement; the funds stay with **you** (your organization, or a community
  trust you designate) and are awarded on the community's terms (see
  [Data Sovereignty](/docs/network/sovereignty/data-sovereignty)
  and the [Economic Model](/docs/network/sovereignty/economic-model)). The
  end-to-end self-serve path is documented in
  [Run a Sovereign Contest](/docs/network/sovereignty/run-a-sovereign-contest);
  bringing a new language pair starts with a
  [corpus partnership](/docs/network/specifications/corpus-partnership).
- **Coordinate a compute donation.** Pool API credits / tokens so the public
  queue can map more pairs and surface where translation is — and isn't — yet
  reliable.
- **Support the open-source initiatives we build on — *directly*.** Champollion
  is plumbing that stitches together other people's open work; supporting *them*
  is supporting this map (we would rather point you upstream than take credit for
  their work):
  - [Tatoeba](https://tatoeba.org) — community-contributed parallel sentences
  - [Endangered Languages Catalog (ELCat)](https://www.endangeredlanguages.com) — endangerment data
  - [Glottolog](https://glottolog.org) · [WALS](https://wals.info) · [Grambank](https://grambank.clld.org) · [PHOIBLE](https://phoible.org) — language catalogues & typology
  - [GiellaLT](https://giellalt.uit.no) / ALTLab — the morphological transducers (FSTs)
  - [Masakhane](https://www.masakhane.io) — African-language MT community
  - [OPUS](https://opus.nlpl.eu) — open parallel corpora

> To sponsor a prize, organize a compute donation, or discuss a partnership,
> reach the project via [GitHub](https://github.com/gamedaysuits). Community key
> custodians are in confirmation; no nation or organization is named as a partner
> before it has consented.

---

## 1. Philosophy

> **The deal in one line: crack a language, win, give it back.** Champollion is an
> ML-benchmarking operation on purpose — competition is how hard pairs get solved.
> We invite ML researchers and any capable builder to build the best method for a
> specific hard language pair, win the prize, **and** hand the resulting method to
> the sovereignty organization that owns that language (§1.3). The competitive
> energy is real, and it is pointed at the mission — getting every language
> translated, under terms its people set — not at climbing a leaderboard for its
> own sake.

### 1.1 Prizes Reward Breakthroughs, Not Participation

Prize money is released only when a method demonstrably achieves a defined capability threshold. There are no participation prizes, runner-up awards, or consolation payouts. If nobody clears the bar, nobody gets paid. This is by design — it means sponsors only pay for results that actually work.

### 1.2 Community Validation Is Non-Negotiable

Automated metrics are proxies (SCORING_SPEC §1.1). A method can score well on chrF++ and FST acceptance while producing output that no speaker would accept. **Every prize claim requires community validation** — bilingual speakers must confirm the output is usable. This is the human validation gate (BENCHMARK_SPEC §7).

### 1.3 Ownership Transfer Is Part of the Deal

Methods that claim a prize are subject to the ownership transfer clause (BENCHMARK_SPEC §8.3). The developer keeps attribution and publication rights. The governance org gains the right to use, modify, distribute, and monetize the method for their language. This is not a penalty — it's the point. Prize money funds the creation of technology that belongs to the language community.

### 1.4 Anti-Gaming

Prize thresholds are defined against **gold-standard evaluation** (secret test set, run by governance org in sandbox). Developers never see the test data. This is architecturally enforced — not a policy that relies on honor. See BENCHMARK_SPEC §8.2.

### 1.5 Corpus Licensing: Non-Commercial Corpora Stay Out of the Prize Lane

Some corpora used during method development carry non-commercial licenses — for example, the EdTeKLA Cree Language Textbook corpus carries **EdTeKLA's modified CC BY-NC-SA** (sovereignty-scoped, non-commercial; the root textbook is CC BY-NC-ND 4.0). These corpora are **research/development-lane only**:

1. **Prize gold-standard corpora must not embed NC-licensed corpus content.** Gold-standard test segments are community-commissioned originals (see Corpus Partnership Strategy) — human-authored for the prize, with rights cleared for evaluation and commercial deployment from the start.
2. **A method that claims a prize must not embed NC-licensed corpus content** (e.g., as coaching data, embedded examples, or lookup tables). The transferred method must be deployable by the governance org on any terms it chooses — including commercially, if the community so decides (BENCHMARK_SPEC §8.3); NC-licensed content inside it would poison that freedom.
3. **Developers may freely use NC-licensed corpora to develop and self-evaluate** — that is what the development lane is for. The restriction applies to what is submitted and what is deployed, not to how a developer learns.

### 1.6 Dependency Classes Gate Prize Eligibility

All prize evaluation happens in a sandbox (§1.4), and prize-winning methods transfer to the governance org (§1.3). Both facts impose the same constraint: **everything a method depends on must be something the developer has the right to put in the sandbox and convey to the community.** Every submission declares a dependency class — defined in the [Method Interface spec](/docs/network/specifications/methods#method-validity-and-dependency-classes) — and eligibility follows the class:

| Dependency class | Prize-eligible? | Conditions |
|------------------|----------------|------------|
| **S** — self-contained | ✅ Yes | None beyond the threshold conditions in §2 |
| **O** — open external (e.g., AGPL FST mirrored at submission) | ✅ Yes | Artifacts pinned and vendored into the submission; licenses permit community transfer; copyleft terms preserved (the community receives the same rights the license grants everyone) |
| **A1** — substitutable LLM inference | ⚠️ Conditional | Model declared, pinned, and substitutable (must run against a community-hosted open-weight model); evaluation routed through the sandbox LLM gateway (🔲 planned — A1 methods cannot produce gold-standard scores until the gateway is operational); transfer conveys the full recipe (prompts, coaching, code), not the model |
| **A2** — non-substitutable external data/service API | ❌ Not yet | Ineligible until the rights holder grants sandbox-inclusion and transfer permissions. Allowed on the open leaderboard with a visible "external dependency" flag |
| **X** — bundled content without rights | ❌ Never | Inadmissible in every lane |

A method's class is the most restrictive class among its declared dependencies. Undeclared dependencies of any class are disqualifying (§5).

---

## 2. Proposed Prize Pools (none open yet)

### 2.1 The Founder's Prize — EN→Plains Cree (nêhiyawêwin)

| Field | Value |
|-------|-------|
| **Prize pool** | **$10,000 CAD** (proposed) |
| **Language pair** | English → Plains Cree (EN→CRK) |
| **Intended sponsor** | Champollion project founder — an intended commitment, **no funds are held anywhere yet.** When committed, the funds would sit with the sponsor or a designated community trust — never with Champollion. |
| **Status** | **PROPOSED — not open.** Not accepting submissions. |
| **Opens** | Only when the gold-standard corpus, the evaluation sandbox, and the speaker-review gate all exist (none do yet), and the sponsor's funds are verifiably held per §4.2. |
| **Expires** | No expiry once opened. |

#### Threshold Conditions

A method claims the Founder's Prize by meeting **ALL** of the following conditions simultaneously:

| # | Condition | Metric | Threshold | Rationale |
|---|-----------|--------|-----------|-----------|
| 1 | **Composite score** | `composite` (SCORING_SPEC §4) | **≥ 0.80** | Between Deployable (0.70) and Fluent (0.85). Requires high quality across all metric dimensions — not just morphological validity. |
| 2 | **FST acceptance** | `fst_acceptance_rate` (SCORING_SPEC §2.2) | **≥ 0.99 (99%+)** | Effectively all output words must be morphologically valid forms recognized by the GiellaLT FST. The 1% tolerance accounts for edge cases (proper nouns, neologisms, loanwords) that the FST may legitimately not cover. This is the defining quality gate for polysynthetic MT — if the FST rejects more than 1% of words, the method is producing forms that do not exist in the language. The entire point of this prize is to buy a system that doesn't mangle things. |
| 3 | **chrF++** | `chrf_plus_plus` (SCORING_SPEC §2.1) | **≥ 55.0** | Character n-gram overlap must exceed 55 on the 0–100 scale. Ensures surface-level similarity to reference translations, not just morphological validity. |
| 4 | **Community validation** | Human review (BENCHMARK_SPEC §7) | **≥ 70% "acceptable" or "excellent"** | A stratified sample of outputs (≥30 entries across difficulty tiers 2–5) is reviewed by ≥2 bilingual CRK speakers. At least 70% of reviewed entries must receive an "acceptable" or "excellent" rating. |
| 5 | **Gold-standard evaluation** | Sandbox execution (BENCHMARK_SPEC §8.2) | **Required** | All automated metrics must be computed against the `gold_standard` corpus segment, run by the governance org in a sandboxed environment. Development-set scores do not count. |
| 6 | **Reproducibility** | Fingerprint match (BENCHMARK_SPEC §3.8) | **±2%** | The governance org must be able to re-run the method and achieve scores within ±2% of the submitted run card. |

> **Why 99+% FST?** The central problem in machine translation for polysynthetic languages is hallucination — LLMs produce strings that *look* like the target language but are morphologically invalid. A method that produces 95% valid output still has 5% fabricated words — unacceptable noise for any production use. The 99%+ threshold demands near-zero hallucination while allowing for the rare edge case (a proper noun the FST doesn't know, a legitimate neologism). If a method cannot achieve 99%+ FST acceptance, it has not solved the problem.
>
> **Why 0.80 composite?** This sits between Deployable (0.70) and Fluent (0.85). A method at 0.80 with 99%+ FST acceptance produces output where virtually every word is a real Cree word *and* the overall translation quality is high across surface, structural, and semantic dimensions. The community validation gate (condition #4) ensures this isn't just metric gaming — speakers must confirm the output is genuinely usable.

#### What This Threshold Means in Practice

At composite ≥ 0.80 with FST ≥ 0.99 and chrF++ ≥ 55, a bilingual speaker would typically see:

- **Virtually every** output word is a real Cree word (FST validates 99%+ — near-zero hallucinated forms)
- Major grammatical categories (person, number, tense) are correct in most entries
- Word order is generally natural
- Meaning is preserved reliably
- Remaining errors are real-language errors (wrong inflection, incorrect obviation, animacy mismatches) — not fabricated words
- A fluent speaker could use the output as a high-quality draft and correct it significantly faster than translating from scratch

This is a system that **does not mangle the language.** It may not be perfect, but every word it produces is a real word. That is the minimum bar for respectful machine translation of a polysynthetic language.

---

## 3. Prize Claim Process

### 3.1 Submission

1. Developer submits their complete, runnable method to the governance org:
   - All source code
   - All dependencies (coaching data, dictionaries, FST configs, prompts)
   - Installation and execution instructions
   - A README describing the method's approach
   - A development-set run card showing approximate scores (for pre-screening)

2. Developer signs the terms of participation, including:
   - Ownership transfer clause (BENCHMARK_SPEC §8.3)
   - No training on evaluation data declaration
   - Reproducibility commitment

### 3.2 Evaluation

1. Governance org installs and runs the method in a sandboxed harness against the `gold_standard` corpus
2. Automated metrics are computed (composite, FST, chrF++, etc.)
3. If automated thresholds are met (conditions 1–3), governance org proceeds to community review
4. If automated thresholds are NOT met, developer receives scores and feedback. No community review is triggered.

### 3.3 Community Review

1. A stratified sample of outputs (≥30 entries, covering difficulty tiers 2–5) is presented to bilingual speakers
2. At minimum 2 independent reviewers rate each entry
3. Rating scale: **reject** / **gist** / **acceptable** / **excellent**
4. If ≥70% of entries receive "acceptable" or "excellent" from both reviewers, community validation passes

### 3.4 Payout

1. All 6 conditions are met
2. Governance org confirms result
3. Prize is paid within 30 days of confirmation
4. Method ownership transfers per BENCHMARK_SPEC §8.3
5. Result is published on the leaderboard with "Community Validated" verification tier

### 3.5 Multiple Submissions

- The same developer/team may submit multiple times
- Each submission is evaluated independently
- If a method is improved and re-submitted, only the latest run card counts
- The prize is awarded to the **first** method that clears all thresholds — it is not split

### 3.6 Team Submissions

- Teams and Elder-youth pairs are eligible
- Prize distribution within a team is the team's responsibility
- All team members must sign the terms of participation
- Attribution on the leaderboard lists all team members

---

## 4. Future Prize Pools {#4-future-prize-pools}

The Founder's Prize is the seed. Additional prize pools are funded by sponsors. Each new prize pool is documented as a new subsection of §2 with its own:

- Prize amount and currency
- Language pair
- Sponsor attribution
- Threshold conditions (which may differ from the Founder's Prize)
- Expiry date (if any)
- Any special conditions

### 4.1 Sponsor Prize Template

Sponsors fund prize pools at any amount. Suggested tiers:

| Tier | Amount | Suggested Threshold |
|------|--------|---------------------|
| **Seed** | $5,000–$15,000 | Deployable (composite ≥ 0.70) + community validation |
| **Breakthrough** | $25,000–$50,000 | Fluent (composite ≥ 0.85) + community validation |
| **Grand Prize** | $100,000+ | Fluent + multi-register coverage + deployment integration |

Sponsors may also fund:
- **Improvement bounties** — fixed payment for each 5-point improvement in chrF++ over the current best
- **Register prizes** — separate awards for specific registers (formal, ceremonial, educational)
- **Speed prizes** — best cost-adjusted score (SCORING_SPEC §6.3)

### 4.2 Where Prize Funds Are Held

Prize funds are **sponsor-held**: they sit with the sponsoring organization, or with a community trust the sponsor designates — **never with Champollion**, which coordinates measurement and touches no money. A credible prize publishes, before it opens: **who holds the funds**, under what arrangement (organizational account, trust, or third-party escrow of the sponsor's choosing), and the award threshold — so that clearing the bar is verifiable from published scores plus the community's speaker-validation verdict, and a payment default would be publicly visible as one. No prize funds are held anywhere today. If a prize were to expire unclaimed, funds stay where they always were — with the sponsor — to be redirected or withdrawn at the sponsor's discretion. The self-serve mechanics, including the sponsor-default risk and its mitigations, are documented in [Run a Sovereign Contest](/docs/network/sovereignty/run-a-sovereign-contest) and the [Terms Templates](/docs/network/sovereignty/terms-templates).

---

## 5. Disqualification

A submission is disqualified if:

1. **Training on evaluation data.** Method was exposed to `gold_standard` or `held_out` corpus entries. (Architecturally prevented by sandboxed execution — but if evidence of contamination is found, the result is voided.)
2. **Non-reproducible.** Governance org cannot reproduce scores within ±2%.
3. **Undeclared or ineligible dependencies.** The method requires runtime access to external services beyond what its dependency manifest declares, or its effective dependency class is A2 or X (§1.6). Declared Class A1 LLM inference routed through the evaluation gateway is permitted; any other runtime network dependency — and any undeclared dependency of any class — is disqualifying.
4. **Terms of participation not signed.** All team members must agree to ownership transfer.
5. **Gaming detected.** Output is optimized for the metric rather than translation quality (caught by community review and/or anti-gaming checks per BENCHMARK_SPEC §9.3).

---

## 6. Relationship to Other Specs

| This Document | References | For |
|--------------|-----------|-----|
| §2 threshold conditions | SCORING_SPEC §4 (composite), §2.1–2.2 (metrics), §5 (tiers) | Metric definitions and scale |
| §2 community validation | BENCHMARK_SPEC §7 | Human review protocol |
| §3 sandbox execution | BENCHMARK_SPEC §8.2 | Sovereignty mechanism |
| §3 ownership transfer | BENCHMARK_SPEC §8.3 | IP transfer terms |
| §1.6 dependency classes | Method Interface spec; BENCHMARK_SPEC §8.6 | Class definitions, admissibility terms, sandbox network policy |
| §4 cost-adjusted prizes | SCORING_SPEC §6.3 | Cost-adjusted formula |

---

## 7. Code–Spec Synchronization

### 7.1 Canonical Source

This document (`cli/website/docs/network/specifications/prize-spec.md`) is the canonical source for:
- Prize pool definitions (§2)
- Threshold conditions (§2.x)
- Claim process (§3)
- Disqualification rules (§5)

### 7.2 Implementation Requirements

When a prize pool is activated:
1. The leaderboard UI must display active prizes and their threshold conditions
2. Run cards that meet automated thresholds (conditions 1–3) must be flagged for community review
3. The `quality_tier` field in the run card schema already captures the tier ("deployable", "fluent")
4. No new code changes to the harness are needed — the prize spec is a policy layer on top of existing scoring

---

*Prize structures must be compatible with ownership transfer terms. The winner can claim the prize, but the method becomes the governance org's property if it reaches Deployable tier. This is by design — the prize funds the creation of technology that belongs to the language community.*
