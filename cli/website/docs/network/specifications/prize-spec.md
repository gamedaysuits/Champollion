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
> community-consented gold-standard corpus and the speaker-review gate.
> Neither exists yet. The air-gapped evaluation sandbox does ship — see the
> [Benchmark Spec §8.6](/docs/network/specifications/benchmark#86-dependency-classes-and-the-sandbox-network-policy).
> No score on this site has cleared a prize bar. See
> [Honest Limitations](/docs/network/honest-limitations). Metrics reference:
> the [Scoring Spec](/docs/network/specifications/scoring); protocol:
> the [Benchmark Spec](/docs/network/specifications/benchmark).

> **The promise layer is live.** The freeze that makes a declared prize term
> un-editable once entries exist, and withheld (`hidden_until_close`) results,
> are enforced in the database on the network-hosted endpoint as of
> 2026-09-07. A federated host gets the same rules by applying the migration
> that ships with the harness; against an older endpoint the harness falls back
> to the base set and says so rather than pretending. The aggregates-only
> egress rule in §3.2 has always been enforced everywhere.

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
> reach the project via [GitHub](https://github.com/gamedaysuits). No community
> key custodians have been appointed yet, and no nation or organization is named
> as a partner before it has consented.

---

## 1. Philosophy

> **The deal in one line: crack a language, win, on the host's declared terms.**
> Champollion is an ML-benchmarking operation on purpose — competition is how hard
> pairs get solved. We invite ML researchers and any capable builder to build the
> best method for a specific hard language pair and win the prize. What happens to
> the method afterwards is the **host's** published choice, not ours and not a
> default: a community that wants a winning method handed over says so in its
> terms, and one that wants only to measure and delete says that instead (§1.3).
> The competitive energy is real, and it is pointed at the mission — getting every
> language translated, under terms its people set — not at climbing a leaderboard
> for its own sake.

### 1.1 Prizes Reward Breakthroughs, Not Participation

Prize money is released only when a method demonstrably achieves a defined capability threshold. There are no participation prizes, runner-up awards, or consolation payouts. If nobody clears the bar, nobody gets paid. This is by design — it means sponsors only pay for results that actually work.

### 1.2 Community Validation Is Non-Negotiable

Automated metrics are proxies (SCORING_SPEC §1.1). A method can score well on chrF++ and FST acceptance while producing output that no speaker would accept. **Every prize claim requires community validation** — bilingual speakers must confirm the output is usable. This is the human validation gate (BENCHMARK_SPEC §7).

### 1.3 What Happens to a Winning Method Is Declared, Not Assumed {#1-3-declared-terms}

One thing is fixed, because it is what a sovereign contest *is*: the entry is handed to the host's own air-gapped node, which runs it against a sealed set on the host's machine. What happens to it *afterwards* is the host's declared choice, made per contest and published with it — and it is **one choice out of three**:

| The term | What it means for you |
|---|---|
| `pass_to_holders` — *pass to holders* | The method passes to the sovereign benchmark holders. They score it and keep it, regardless of who wins. |
| `retain_ip` — *retain IP* | You keep ownership of your method. The host scores it and keeps at most a sealed copy for audit. |
| `release_open` — *release open* | You keep ownership but must publish the method under an open licence. That release is the prize condition. |

Everything else that follows from a term — whether the artifact is kept, whether any rights move, what the host may use it for, when a release falls due — is **derived** from the option the host chose (§2.1, condition 7), not a separate box for a host to tick. A host picks the term; the detail follows.

Two consequences worth stating plainly:

- **A contest with no declared prize terms has no prize.** That is the default. It is not a lesser contest, and nothing about the entry moves.
- **Nothing is implied.** The declared term is hashed, shown to the entrant in plain language, and accepted by that hash; the acceptance travels inside the entry and is covered by its content hash, and the host's node refuses an entry that accepted anything else. The term then freezes the moment the contest has its first entry, so nobody is held to terms they could not have read.

Where a host chooses `pass_to_holders`, the developer still keeps attribution and publication rights, and the point of the arrangement is that prize money funds technology the language community can actually use. That is a good reason for a community host to choose that term. It is a choice, not a rule.

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
| **Opens** | Only when the gold-standard corpus and the speaker-review gate exist (neither does yet), the evaluation sandbox has been proven with real models (so far it has run only a toy method), and the sponsor's funds are verifiably held per §4.2. |
| **Expires** | No expiry once opened. |

#### Threshold Conditions

A method claims the Founder's Prize by meeting **ALL** of the following conditions simultaneously:

| # | Condition | Metric | Threshold | Rationale |
|---|-----------|--------|-----------|-----------|
| 1 | ~~Composite score~~ — **retired** | — | — | This condition (composite ≥ 0.80) was retired with the composite on 2026-10-04 ([Scoring Specification §4](/docs/network/specifications/scoring#4-composite-score)). The score condition is chrF++ alone (condition 3); the number is kept so the other conditions keep their numbers. |
| 2 | **FST acceptance** (a diagnostic gate, not the score) | `fst_acceptance_rate` (SCORING_SPEC §2.2) | **≥ 0.99 (99%+)** | Effectively all output words must be morphologically valid forms recognized by the GiellaLT FST. The 1% tolerance accounts for edge cases (proper nouns, neologisms, loanwords) that the FST may legitimately not cover. This is the defining quality gate for polysynthetic MT — if the FST rejects more than 1% of words, the method is producing forms that do not exist in the language. The entire point of this prize is to buy a system that doesn't mangle things. |
| 3 | **chrF++** (the score) | `chrf_plus_plus` (SCORING_SPEC §2.1), with its sacreBLEU signature and 95% CI | **≥ 55.0** | Corpus chrF++ on the sealed set must reach 55 on the 0–100 scale — the standard headline metric ([Scoring Specification](/docs/network/specifications/scoring#how-runs-are-scored)). It compares every output with its reference, so a system cannot meet it with valid words that do not translate the input. |
| 4 | **Community validation** | Human review (BENCHMARK_SPEC §7) | **≥ 70% "acceptable" or "excellent"** | A stratified sample of outputs (≥30 entries across difficulty tiers 2–5) is reviewed by ≥2 bilingual CRK speakers. At least 70% of reviewed entries must receive an "acceptable" or "excellent" rating. |
| 5 | **Gold-standard evaluation** | Sandbox execution (BENCHMARK_SPEC §8.2) | **Required** | All automated metrics must be computed against the `gold_standard` corpus segment, run by the governance org in a sandboxed environment. Development-set scores do not count. |
| 6 | **Reproducibility** | Fingerprint match (BENCHMARK_SPEC §3.8) | **±2%** | The governance org must be able to re-run the method and achieve scores within ±2% of the submitted run card. |
| 7 | **The contest's declared prize terms are met** | The verifications that term requires (see below) | **Required** | Prizes exist only on sovereign contests, where your entry is executed by the host's air-gapped node on a sealed set. What happens to it *afterwards* is one of three declared options, published with the contest before entries open — not a single condition every contest imposes. |

#### Condition 7 in detail: the term is one choice of three

Every sovereign contest works the same way at execution time: you hand your
method (weights or code) to the host's air-gapped node, and the node scores it
on the sealed set. That much is what "the host measured it" means, and it is
not adjustable.

What happens *after* that is the host's choice, declared per contest, and it
is one of three options. The host publishes it before entries open; it is
**frozen** the moment the contest has its first entry, so the term you read is
the term you are held to.

| The term | What it means for you |
|---|---|
| `pass_to_holders` — *pass to holders* | The method passes to the sovereign benchmark holders. They score it and keep it, regardless of who wins. |
| `retain_ip` — *retain IP* | You keep ownership of your method. The host scores it and keeps at most a sealed copy for audit. |
| `release_open` — *release open* | You keep ownership but must publish the method under an open licence. That release is the prize condition. |

**What each option means in detail.** These four dimensions — plus the licence
that comes with a required release — are *derived* from the option: a host
never writes `rights` or `host_use` by hand, and no contest can mix and match
them:

| Field | `pass_to_holders` | `retain_ip` | `release_open` |
|---|---|---|---|
| `retention` — does the artifact survive the scoring? | `retain` | `retain_sealed_audit` | `retain` |
| `rights` — does ownership move? | `assignment_to_host` | `participant_retains_all` | `participant_retains_all` |
| `host_use` — what may the host use it for? | `any` | `evaluation_only` | `any` (under the open licence you published) |
| `release` — must **you** publish it, and when? | `not_required` | `not_required` | `required_before_prize` |
| `release_license` — under which licence you publish | — | — | `any_osi`, or a named SPDX identifier |

Two of the options let a host narrow one field, and that is the whole of it:

- under `retain_ip`, the host may set `retention` to `delete_after_scoring` — your method is destroyed once it has been scored;
- under `release_open`, the host may move the release to `required_before_scores` (you publish before your own scores are released) or `required_after_prize` (you publish after payout), and may name the licence instead of accepting any OSI-approved one.

A `community_terms_url` — an `https://` link to the host's own written terms —
may accompany any of the three. On the contest itself the chosen option is
recorded as its `disposition`, and that is the single value everything above
is read from.

Anything else is refused when the contest is created: an option does not offer
a field it does not offer, and a field written by hand where it should be
derived is refused by name rather than silently believed.

**What is checked before a prize is paid.** The required verifications follow
from the term; no host configures them separately:

- **Handover** — always. The host holds the exact artifact it scored (the
  node's recorded method digest). This one is measured.
- **Release** — under `release_open`, when the release falls due before scores
  or before the prize. The host records the release URL and the SHA-256 of the
  published artifact; the record is checked, and the URL is never fetched, so a
  frozen result never depends on someone else's uptime. A release required
  *after* the prize is an obligation that falls due after payout, so it is not
  one of the payout checks.
- **Assignment** — under `pass_to_holders`, where ownership moves. An
  assignment is an instrument signed outside this platform; the host records it
  and its date, and the platform verifies that a record exists.
  **It never verifies law.**

**A contest with no declared prize terms has no prize.** There is no default
term and none is assumed on anyone's behalf. Entering a contest that does
declare one means accepting it explicitly, by its hash, at submission time —
the acceptance is packed into your bundle and is part of what the host's node
checks.

> **Why 99+% FST?** The central problem in machine translation for polysynthetic languages is hallucination — LLMs produce strings that *look* like the target language but are morphologically invalid. A method that produces 95% valid output still has 5% fabricated words — unacceptable noise for any production use. The 99%+ threshold demands near-zero hallucination while allowing for the rare edge case (a proper noun the FST doesn't know, a legitimate neologism). If a method cannot achieve 99%+ FST acceptance, it has not solved the problem.
>
> **Why chrF++ and FST together, and why neither is enough.** FST acceptance only says each word exists; a system that repeats one valid sentence for every input passes it completely. chrF++ compares each output with its reference, so it catches that. Neither automatic number certifies quality: the community validation gate (condition #4) is what confirms speakers find the output usable.

#### What This Threshold Means in Practice

What the conditions establish together:

- **Virtually every** output word is a real Cree word (FST validates 99%+ — near-zero fabricated forms)
- The outputs are close to the references on the sealed set (chrF++ ≥ 55)
- Bilingual speakers, under the community's own protocol, rated at least 70% of a stratified sample acceptable or better — the only condition that speaks to quality
- Remaining errors are real-language errors (wrong inflection, incorrect obviation, animacy mismatches) — not fabricated words

This is a system that **does not mangle the language.** It may not be perfect, but every word it produces is a real word. That is the minimum bar for respectful machine translation of a polysynthetic language.

---

## 3. Prize Claim Process

### 3.1 Admission, then submission

1. **Qualify in public.** The developer scores the contest's released dev set with their own system and keeps the receipt (`mt-eval contest qualify`). The receipt is self-reported by construction — it is a claim, and the host checks it in step 4.

2. **Hand the entry over.** A contest is entered by giving the host's node something it can run, in one of two lanes:
   - a **model** — safetensors weights, a declarative tokenizer and a config, with no code at all (`mt-eval contest submit-model`); or
   - a **method** — a Dockerfile and an entrypoint, vendored so it builds and runs with no network (`mt-eval contest submit-method`).

   Uploading translations of a released test set, and linking a score the developer published themselves, were **retired as contest entry paths on 2026-09-06** and the commands deleted. Self-reported scores still belong on the open leaderboard, which is a public board indexed by corpus and pair direction — not a contest, and not a prize lane.

3. **Declare, on the entry itself:** the track (`constrained` — trained only on the data the host allowed — or `unconstrained`), the parameter count, the licence of the weights and whether they are public, the training data the constrained claim is about, whether this is the team's primary entry or a contrastive one, and — when the contest requires it — a system description. The developer also passes `--agree` for the method-submission terms, and, when the contest declares prize terms, `--accept-terms <hash>` for those.

### 3.2 Evaluation

1. The host's node runs its **static checks** on the bundle, refusing anything that would need the network, and refusing an entry that accepted prize terms other than the ones this contest declares.
2. The node **re-executes the qualifier itself**, on its own copy of the public dev set, using the same lane executor and the same scorer. The developer's receipt was a claim; this is the measurement. A miss is denied here — before any custodian is asked to approve anything, and before the sealed set is opened — with what was claimed, what was measured and what the bar was.
3. **Custodians authorize** the sealed run (M-of-N, per the contest's authorization model). The grant is single-use, time-boxed, and bound to the exact (bundle hash, corpus, corpus version, node) fingerprint.
4. The entry runs against the `gold_standard` sealed corpus inside the network-isolated sandbox on the host's own machine, and automated metrics are computed (chrF++ with its CI and signature, the other standard metrics, and diagnostics such as FST acceptance). A declared sealed holdout and any third-party test suites run inside the **same** authorized run.
5. **Only aggregate scores leave** — enforced at the database layer, not by convention. If the contest promised `hidden_until_close`, the card is withheld until the close publishes it.
6. If automated thresholds are met (conditions 2–3), the host proceeds to community review. If they are not, the developer receives their scores and no community review is triggered.

### 3.3 Community Review

1. A stratified sample of outputs (≥30 entries, covering difficulty tiers 2–5) is presented to bilingual speakers
2. At minimum 2 independent reviewers rate each entry
3. Rating scale: **reject** / **gist** / **acceptable** / **excellent**
4. If ≥70% of entries receive "acceptable" or "excellent" from both reviewers, community validation passes

### 3.4 Payout

The order is fixed: **declared gate steps verified → contest closed → prize paid.** Which steps those are depends on the terms *this* contest declared (§2.1, condition 7) — but whichever they are, they are verified before the close, and nothing is paid out of a ranking that is still moving.

An organizer can `close --force` past an unsatisfied gate. The close then goes through and the frozen ranking records that entry's prize eligibility exactly as computed — not eligible, with the failing step named. A forced close is a closed contest, never a cleared gate.

1. All 7 conditions are met
2. **Every gate step the contest's declared prize terms require is verified** — always the handover of the scored artifact, plus a recorded release and/or a recorded assignment when those terms call for them
3. The contest is **closed** and its ranking frozen
4. Governance org confirms the result against the frozen ranking
5. Prize is paid within 30 days of confirmation
6. Anything the declared terms say about ownership takes effect as those terms specify — for a contest whose `rights` is `participant_retains_all`, nothing transfers at all
7. Result is published on the leaderboard with "Community Validated" verification tier

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
| **Seed** | $5,000–$15,000 | A chrF++ bar on the sealed set, published before the contest opens + community validation |
| **Breakthrough** | $25,000–$50,000 | A higher chrF++ bar + community validation |
| **Grand Prize** | $100,000+ | The Breakthrough conditions + multi-register coverage + deployment integration |

The bar is always chrF++ (with its signature, so it is reproducible); diagnostic gates such as FST acceptance may be added, as gates. A composite or a quality tier cannot be a prize threshold.

Sponsors may also fund:
- **Improvement bounties** — fixed payment for each 5-point improvement in chrF++ over the current best
- **Register prizes** — separate awards for specific registers (formal, ceremonial, educational)
- **Cost prizes** — lowest cost per entry among methods that clear the chrF++ bar (cost is reported beside the score, never combined with it)

### 4.2 Where Prize Funds Are Held

Prize funds are **sponsor-held**: they sit with the sponsoring organization, or with a community trust the sponsor designates — **never with Champollion**, which coordinates measurement and touches no money. A credible prize publishes, before it opens: **who holds the funds**, under what arrangement (organizational account, trust, or third-party escrow of the sponsor's choosing), and the award threshold — so that clearing the bar is verifiable from published scores plus the community's speaker-validation verdict, and a payment default would be publicly visible as one. No prize funds are held anywhere today. If a prize were to expire unclaimed, funds stay where they always were — with the sponsor — to be redirected or withdrawn at the sponsor's discretion. The self-serve mechanics, including the sponsor-default risk and its mitigations, are documented in [Run a Sovereign Contest](/docs/network/sovereignty/run-a-sovereign-contest) and the [Terms Templates](/docs/network/sovereignty/terms-templates).

---

## 5. Disqualification

A submission is disqualified if:

1. **Training on evaluation data.** Method was exposed to `gold_standard` or `held_out` corpus entries. (Architecturally prevented by sandboxed execution — but if evidence of contamination is found, the result is voided.)
2. **Non-reproducible.** Governance org cannot reproduce scores within ±2%.
3. **Undeclared or ineligible dependencies.** The method requires runtime access to external services beyond what its dependency manifest declares, or its effective dependency class is A2 or X (§1.6). Declared Class A1 LLM inference routed through the evaluation gateway is permitted; any other runtime network dependency — and any undeclared dependency of any class — is disqualifying.
4. **Terms of participation not signed.** All team members must agree to the method-submission terms, and — when the contest declares prize terms (§1.3) — to those, by hash.
5. **Gaming detected.** Output is optimized for the metric rather than translation quality (caught by community review and/or anti-gaming checks per BENCHMARK_SPEC §9.3).

---

## 6. Relationship to Other Specs

| This Document | References | For |
|--------------|-----------|-----|
| §2 threshold conditions | SCORING_SPEC "How runs are scored" and §2.1–2.2 (metrics) | Metric definitions and scale |
| §2 community validation | BENCHMARK_SPEC §7 | Human review protocol |
| §3 sandbox execution | BENCHMARK_SPEC §8.2 | Sovereignty mechanism |
| §1.3 declared prize terms | BENCHMARK_SPEC §8.3 | What the host may do with an entry afterwards |
| §1.6 dependency classes | Method Interface spec; BENCHMARK_SPEC §8.6 | Class definitions, admissibility terms, sandbox network policy |
| §4 cost prizes | SCORING_SPEC §6.2 | Cost metric formulas |

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
2. Run cards that meet automated thresholds (conditions 2–3) must be flagged for community review
3. No quality tier is used: the `quality_tier` field is null on every new run card (scoring standard/1)
4. The prize **terms** layer already ships (`contest_prize_terms` — declaration, hash, acceptance, and the payout gate), and the scoring itself is unchanged. What a new prize pool adds is the threshold policy in §2 and the leaderboard surfacing in items 1–2 above

---

*A prize structure must be compatible with the prize terms the same contest declares (§1.3). Those terms are the host's choice along every dimension — from "score it, delete it, all rights stay with the entrant" to "you hand it over, we score it and keep it regardless" — and they are published, hashed and accepted before anyone enters. A community host that wants a winning method to become the community's property can declare exactly that, and the prize then funds the creation of technology that belongs to the language community. Nothing here assumes it on any host's behalf.*
