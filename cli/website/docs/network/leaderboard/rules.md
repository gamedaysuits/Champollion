---
sidebar_position: 1
title: Submission Rules
related:
  - label: "Scoring Specification"
    to: /docs/network/specifications/scoring
    kind: spec
    note: "How runs are scored: chrF++ with its CI and signature"
  - label: "Statistical Significance Testing"
    to: /docs/network/specifications/significance
    kind: spec
  - label: "Evaluation Datasets"
    to: /docs/network/leaderboard/datasets
    kind: doc
  - label: "Live Leaderboard"
    to: https://champollion.dev/leaderboard
    kind: leaderboard
    note: "The rules, applied"
---

# MT Evaluation

> **Executive Summary.** This page defines the leaderboard submission criteria, scoring (chrF++ as the headline, with the standard metrics and diagnostics beside it), anti-gaming policies, verification tiers, and the submission workflow. Methods that have been exposed to evaluation data are disqualified.

champollion includes a machine translation evaluation framework designed for **reproducible benchmarking** of translation methods — especially for low-resource and Indigenous languages where standard MT benchmarks don't exist and quality claims are hard to verify.

---

## The Leaderboard

The centerpiece is the **[Method Leaderboard](https://champollion.dev/leaderboard)** — a public scoreboard, live and **open for submissions**, where researchers and community members submit and compare translation methods with fingerprinted, reproducible evaluation.

Every submission includes:

- **Fingerprinted pipeline** — tied to a specific Git commit and config hash, so results trace back to the exact code that produced them
- **Versioned dataset** — content-hashed and versioned; scores are only comparable within the same dataset version
- **Standardised metrics** — all scoring is computed by the shared evaluation harness, eliminating implementation differences
- **Trust tiers** — self-benchmarked, Champollion Verified, or Community Validated
- **Cost tracking** — API cost per submission, so cost–quality tradeoffs are transparent

The leaderboard ranks runs the way WMT, FLORES-200 and the AmericasNLP shared tasks report MT evaluation: by **one standard metric, chrF++**, shown with its 95% confidence interval and sacreBLEU signature — for example `chrF++ 47.5 [45.9, 49.0]`. Everything else is shown beside it, never blended into it:

| Metric | Role | What It Measures |
|--------|------|------------------|
| **chrF++** | **Headline and ranking metric** | Character n-gram F-score against the reference (sacreBLEU, `word_order=2`). Copes with rich morphology better than word-level metrics |
| **BLEU, spBLEU, TER, COMET** | Standard metrics, beside the headline | The other metrics MT papers report; COMET when it was computed, with its model id |
| **Exact Match** | Diagnostic | How often the translation is exactly the reference |
| **FST Acceptance** | Diagnostic | For languages with a finite-state transducer: what proportion of output words are valid forms. It does not compare with the source or reference, so it is never a score |
| **Equivalent Match** | Diagnostic | Fraction matching the reference or an acceptable variant (word order, orthographic convention). Currently CRK; generalizing. |
| **Semantic Score** | Diagnostic | Meaning preservation, by a deterministic validator. Currently CRK; generalizing. |
| **Score caveats** | Shown beside the headline | When outputs copy their source, are far shorter or longer than the references, repeat one output for many inputs, or the test rows have twins in the training data |

Whether one run is better than another is decided by a paired significance test on chrF++, not by the order of two numbers — overlapping intervals are a warning that the order may be noise ([Statistical Significance Testing](/docs/network/specifications/significance)); contest rankings use the test to form rank clusters. chrF++ ranks systems on the same dataset only, never across languages. No automatic score carries a quality label — only human review by speakers certifies quality. The weighted composite and quality tiers used before are retired; an old card's composite is shown, if at all, as "legacy composite (retired)".

:::info[Full Metric Suite]
The [Scoring Specification](/docs/network/specifications/scoring#how-runs-are-scored) defines how runs are scored and the complete metric inventory (six categories: surface, structural, semantic, behavioral, compliance, and reported comparators).
:::

**[→ View the leaderboard](https://champollion.dev/leaderboard)**

---

## Available Datasets

What a run can be scored on is listed by the tools, so this page keeps no
list of its own:

```bash
# the runnable corpora for a pair: size, contamination, domain, licence, provider
mt-eval corpora --source eng --target crk

# …and the catalogued ones that can never run, each with its reason
mt-eval corpora --source eng --target crk --include-quarantined
```

The [Evaluation Datasets](/docs/network/leaderboard/datasets) page describes
the catalogue, the corpus format, the difficulty tiers, the licence lanes,
and how to create your own. Three rules from that catalogue decide what can
rank:

- **A quarantined corpus never ranks.** It is catalogued but never runnable,
  and the database refuses a score posted against it. EdTeKLA's
  English→Plains Cree corpora (`eval-eng-crk-edtekla-dev-v1` and
  `eval-eng-crk-edtekla-textbook`) are quarantined. They carry a modified,
  sovereignty-scoped CC BY-NC-SA
  (`LicenseRef-EdTeKLA-Modified-CC-BY-NC-SA-4.0`) and are carved out of every
  leaderboard, prize and commercial lane.
- **A contaminated corpus ranks relative-only.** FLORES+, and any corpus
  graded `HIGH` or `MEDIUM` for contamination or not graded at all, is
  stamped relative-comparison-only on its run card. It compares methods run
  on that corpus and is never reported as absolute quality. Only a corpus
  graded `LOW` ranks on absolute quality.
- **Licence lanes hold.** A non-commercial corpus stays out of commercial and
  prize paths. A corpus under a modified, bespoke or unstated grant refuses
  remote model-API evaluation until the rights-holder's permission is
  recorded on its entry.

**Contests run on sealed sets the host keeps.** A contest is not scored on
any of these public corpora. The host, a community or an organization, keeps
a sealed, held-out test set on its own infrastructure. Entrants qualify on
the public dev set the host releases, then hand the host's node a model or a
method to run. The host's custodians authorize each run, and only scores
come out. See [Run a Sovereign Contest](/docs/network/sovereignty/run-a-sovereign-contest).

:::danger[DO NOT TRAIN on evaluation data]

**These datasets are evaluation-only.** Methods trained, fine-tuned, few-shot-prompted, or otherwise exposed to evaluation data will produce artificially inflated scores and will be **disqualified from the leaderboard.**

This is not a suggestion — it is the single most important rule of evaluation integrity. Use separate corpora for training. Evaluation sets must remain unseen by your model during development.

If you are using coaching data or few-shot examples, those must come from **completely separate sources**. If in doubt, don't include it.
:::

:::warning[LLM non-determinism]

LLM outputs are non-deterministic. Scores represent point-in-time measurements under specific model versions and API configurations. Model providers may update weights, decoding strategies, or safety filters at any time, which can cause score drift between runs. The leaderboard records the exact model slug and timestamp for every submission.
:::

---

## What Makes a Good Method

Not all methods are created equal. Here's what separates rigorous work from inflated scores.

### Characteristics of a strong method

- **Clean separation of train and eval data** — your method has never seen the evaluation set during development, tuning, prompt engineering, or few-shot example selection
- **Reproducible** — someone else can clone your repo, run the harness, and get the same scores (within LLM non-determinism bounds)
- **Documented** — your [method card](/docs/network/specifications/methods) describes what your method does, what tools it uses, and what its limitations are
- **Honest about scope** — if your method only works for one language pair, say so; if it degrades on certain morphological patterns, document that
- **Community-aware** — for Indigenous languages, your method respects data sovereignty. You've consulted with language communities or used only openly licensed data

### Red flags (what gets disqualified)

| Red Flag | Why It's a Problem |
|----------|--------------------|
| Training on eval data | Defeats the purpose of evaluation entirely. Inflated scores mislead everyone. |
| Cherry-picking results | Running 10 times and submitting the best run without disclosing the others |
| Undisclosed post-processing | Manually fixing outputs before scoring |
| Contaminated coaching data | Using eval set examples as few-shot prompts or dictionary entries |
| Claiming commercial readiness without provenance | If your method uses CC BY-NC-SA data, it's not commercially ready |

### Verification tiers

Verification tiers describe **who validated the result**. They are not quality labels (the old automatic quality tiers are [retired](/docs/network/specifications/scoring#5-quality-tiers)).

| Tier | Meaning | How to Get It |
|------|---------|--------------|
| **Self-benchmarked** | You ran the harness yourself and submitted results | Publish your run card with `mt-eval publish` |
| **Champollion Verified** | The project independently re-scored your submitted outputs against the sha-pinned reference corpus and reproduced your score | The re-scorer is a maintainer tool, run by hand as a batch. Nothing schedules it, so no submission is re-scored on arrival (see below) |
| **Community Validated** | Bilingual speakers of the target language, qualified under the community's own protocol, reviewed a stratified sample of the output (≥30 entries, ≥2 reviewers) and ≥70% met the community's bar. Conferred only by the community's own testing; demotion by spot-audit is symmetric | Submit method code to the governance org — they run it against the gold-standard set and put the output to community review |

**Community-validated judgment is a separate lane, and no human-evaluation scores exist yet:** the harness can select which systems a fixed human-review budget would cover from a closed contest's frozen ranking (whole tie groups only — a cluster is never cut in half), but it records no ratings, and nothing on the leaderboard today carries a human judgment.

**Ranks are clusters, not a strict order.** Neighbouring entries the significance test cannot separate share a rank and carry a rank *range*; in a sealed contest, where per-segment output never leaves the organizer's machine, the paired test runs on that machine and only its signed verdicts come out; without them, ties rest on confidence-interval or point-equality evidence. How that works, and how weak each rung of the evidence ladder is, is set out in [Statistical Significance Testing → Ranking clusters](/docs/network/specifications/significance#ranking-clusters).

### How verification scales: reputation-weighted auditing

**We do not claim provenance.** A leaderboard row is produced by a contributor
running the *open-source* harness on their *own* machine. "This run really came
through the harness" is not something a server can verify for self-hosted
compute — the harness's signing key is in the contributor's hands, so a
signature authenticates a *machine, not honesty*. Instead of pretending
otherwise, **validity here is earned and self-correcting**: a row is trustworthy
because its score is **reproducible** and because the contributor behind it has
**staked a reputation that a caught fabrication would destroy.** Verification is
run in four layers, so it is thorough where it must be and cheap where it can be
— the project never has to re-run everyone's work.

- **L0 — re-score everything (free, ~100%).** The re-scorer re-derives your
  score from *your own submitted outputs* against the **sha-pinned reference
  corpus** (not your stored copy of it), with the same metric the harness uses.
  If the score doesn't reproduce from the outputs, or a stored reference was
  altered, the run is **disqualified** — this alone kills a typed-in or edited
  score. A run that reproduces is promoted to **Champollion Verified** — the
  tier a contest ranking uses by default, and the only tier eligible for a
  prize. It is built and it is cheap, but it is a **maintainer command, run by
  hand**: nothing runs it on submission, and nothing schedules it. Until that
  changes, every row arrives — and stays — self-benchmarked.
- **L1 — a contributor reputation ladder.** Each contributor (identified by their
  sign-in) earns reputation *only* by surviving the deeper checks below — never
  by volume alone, so spinning up fresh identities buys nothing. Reputation is
  **public**, and it decides how often the expensive check fires.
- **L2 — re-run a *sample* (the expensive check; policy only, no re-runner
  yet).** For a *public* development set, L0 cannot catch a contributor who
  simply copies the reference as their "translation." Catching that needs
  actually re-running the model — real compute — so we would do it on a
  **sample**, not on everyone. The **sampling policy** is built and tested: a
  run is selected with a probability that rises with **stakes** (a run that
  lights the first bridge to a whole language family is *always* selected),
  rises with **anomaly** (a too-good-to-be-true jump over the prior best is
  *always* selected), and falls with **reputation** (a contributor who has
  passed many audits is spot-checked rarely; a newcomer or anonymous submitter
  is checked on every run until they've earned trust). Passing an L2 audit
  raises reputation. **The re-runner that policy would drive does not exist**,
  so no L2 audit has ever fired: a selected run is recorded as *L2-pending*.
- **L3 — corroboration (free verification).** When two *independent* contributors
  run the same model on the same corpus and their re-scored outputs **agree**,
  that agreement *is* verification — and it raises both of their reputations. A
  genuine **disagreement** flags both runs for an L2 audit. Replication is
  rewarded rather than treated as redundant.

**One caught fabrication is catastrophic — like a retraction.** A proven
fabrication zeroes the contributor's reputation, **re-audits their entire
verified history** (every one of their verified runs is sent back through
verification), and is recorded **publicly** in the audit log. That is what makes
light sampling safe: cheating a public dev set might slip past on one run, but
the expected cost — losing all earned trust and having your whole record
re-scrutinized — makes it a bad bet. These rules bind the maintainers' own runs
symmetrically.

**Why contributing is still worth it.** You always pay the expensive part
(running your method); the project pays only the free L0 re-score on everyone
plus an L2 re-run on a *shrinking sample* — high for newcomers and high-stakes
runs, low for proven contributors. Verification cost is *amortized by reputation
and shared by corroboration*, not re-paid in full every time.

---

## How to Submit

1. **Build your method** — see [Building a Method](/docs/network/specifications/methods) for the method interface
2. **Run the harness** — see [Eval Harness](/docs/network/specifications/harness) for setup and usage
3. **Generate a run card** — the harness produces a JSON run card with your scores, fingerprint, and metadata
4. **Publish** — `mt-eval publish eval/logs/harness/<run-id>_report.json --prod` uploads the run card to the leaderboard (preview with `--dry-run`)
5. **Appear on the leaderboard** — your run is listed as *self-benchmarked (unverified)*. The [Method Leaderboard](https://champollion.dev/leaderboard) lists and ranks every row that is not `disqualified`, self-benchmarked ones included and labelled as such; filter to *Champollion Verified* to see only re-scored results. The L0 re-score that promotes a run to that tier is a maintainer batch, and nothing schedules it, so today every row on the board is a self-reported claim. Verified-only is the default for a **contest** ranking, and it is the only tier eligible for a prize

---

## Integrity Policy: Retractions, Re-runs, Delisting, Disputes

Written in advance so that enforcement is procedure, not drama. These rules
bind everyone symmetrically — including the maintainers' own runs.

**No retractions.** A published run is a permanent record. There is no
mechanism — for anyone — to delete a score because it is embarrassing.
Every run row carries a server-stamped `submitted_at` timestamp and an
immutable audit trail; moderation actions themselves are logged.

**Re-runs append, never replace.** If you improve your method, publish a new
run. The old run stays. Selective disclosure — privately testing many
variants and publishing only the winner — is what made other leaderboards
gameable; an append-only record is the structural answer. Fingerprint
de-duplication stops byte-identical resubmission spam; it never rewrites
history.

**Delisting is rule-execution, with the rule named.** A run is delisted
(marked `disqualified`, visibly — not silently removed) only for listed
causes: a quarantined or improper-subset dataset (enforced by database
trigger beneath every client), corpus-checksum mismatch, fabricated or
out-of-range scores, content-guard violations, or a steward's withdrawal of
the underlying data's registration. The delisting names the rule and the
evidence. New causes are added here by dated edit before they are ever
applied, never retroactively invented for one case.

### Flagging a result

*Added 2026-09-07.*

:::caution[Not accepting flags yet]

Flagging is built, and the database is ready for it as of 2026-09-07 — but the
form that files a flag has not been redeployed against it, so *Flag this
result* still cannot submit. It fails rather than accepting a flag silently.
Email `info@champollion.dev` in the meantime. This notice comes down the day
the form ships.

:::

**Anyone can flag a result.** Expand its row on the leaderboard and use *Flag
this result*: it opens a message form already bound to that run's id, and you
say what you believe is wrong and how you know — a contaminated corpus, a
metric that does not match its label, a misattributed method, anything else. A
flag has to give a reason. A flag without one is a downvote, and this board has
no downvotes.

**A flag is a private message, not a vote.** It reaches the maintainers as a
ticket and goes nowhere else. No count of flags is ever displayed — not on the
row, not in the run card, not anywhere — because a visible tally would itself
be worth gaming, and a result's standing has to rest on evidence rather than on
how many people objected. Filing a flag, on its own, changes nothing about the
row.

**An upheld flag shows up in exactly one way:** the result is marked
`disqualified`, for a cause already listed on this page. As with every other
delisting, a new cause is added here **by dated edit before it is applied to
anyone** — so a flag can never produce a secret rule or a retroactive one. If a
flag is not upheld the row stands unchanged, and if you left an address you get
an answer either way.

**Trust tiers are labels, not edits.** `self-benchmarked` rows are claims;
`Champollion Verified` rows have been independently re-scored from the
submitter's outputs against the sha-pinned corpus; `Community Validated` is
conferred only by the community's own testing. Verification changes a row's
tier — it never changes the row's scores.

**Reputation is public and self-correcting.** Contributor reputation, and the
audit log that records every re-score, sampled re-run, corroboration, and
fabrication burn, are public. Reputation is not a score multiplier and never
touches a run's numbers — it only sets how often a contributor's runs are
re-audited (see *reputation-weighted auditing* above). A proven fabrication is
recorded as publicly as a retraction and re-audits the contributor's whole
verified history; the same rules apply to the maintainers' own runs.

**Disputes.** Open an issue with the run id and the specific claim (wrong
score, wrong dataset, rule misapplied). The maintainers re-run the
deterministic checks in public; the outcome and its evidence land on the
issue. If the dispute is about a community's data or validation, the
community's own authority decides and the board implements their decision.
For prize contests, the same rules apply plus the contest's pre-published
qualifier and audit steps — winners are audited **before** payout, and a
disqualification cites the rule exactly like any other delisting.

## Future Directions

- **Comprehensive model comparison runs** — systematic evaluation of frontier models (GPT-4o, Claude, Gemini, etc.) across champollion languages using custom evaluation corpora (not public benchmarks)
- **More language pairs** — Quechua, Inuktitut, and other low-resource languages as community-verified datasets become available
- **Dataset import** — tooling to convert external evaluation datasets (WMT, Tatoeba, etc.) into the champollion evaluation format
- **Automated re-runs** — detecting model version changes and re-running benchmarks to track score drift

---

## See Also

- **[Method Leaderboard](https://champollion.dev/leaderboard)** — live scores and submissions
- **[Eval Harness](/docs/network/specifications/harness)** — how to run evaluations
- **[Evaluation Datasets](/docs/network/leaderboard/datasets)** — dataset format and available datasets
- **[Building a Method](/docs/network/specifications/methods)** — the method interface specification
- **[Run Card Specification](/docs/network/specifications/run-card)** — the run card JSON schema
- **[Benchmark Specification](/docs/network/specifications/benchmark)** — evaluation protocol, corpus format, sovereignty
- **[Scoring Specification](/docs/network/specifications/scoring)** — SSOT for metrics and how runs are scored
