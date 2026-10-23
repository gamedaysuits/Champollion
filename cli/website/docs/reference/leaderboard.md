---
title: Leaderboard and publishing
slug: /reference/leaderboard
description: "What the public leaderboard is, the two kinds of benchmark (public and sealed), what it covers and does not, and exactly what a published run carries."
---

# Leaderboard and publishing

The [leaderboard](/leaderboard) is a public record of scored translation runs.
Anyone can add to it: you run the evaluation harness (`mt-eval`) on your own
machine, against a registered dataset, and publish the result as a **run
card**. The board keeps the card; it does not run your method for you. It
holds per-sentence text only for openly licensed, redistributable datasets —
never for non-commercial, restricted, sealed, quarantined or local-only ones,
and never when you publish with `--scores-only`.

It is a ledger of measurements, not a verdict on any translator. A position on
it says how a method scored on one dataset under one metric. It does not say
the translation is good, and it grants nobody permission to use a method on a
community's language.

## Three things, kept apart

| | What it is | Where it runs |
|---|---|---|
| **The harness** ([`mt-eval`](/docs/network/specifications/harness)) | The scorer. Given a method and a test set, it produces a score and a run card | Your machine |
| **The leaderboard** | The submission door and the run-card ledger, indexed by dataset and pair direction | champollion.dev |
| **The network map** | What the published runs add up to: which pairs have been measured, and which have not | A view of the ledger, not a component |

Nothing enters the map except through the board, and nothing enters the board
except as a scored, fingerprinted run. A measurement with no provenance cannot
become part of it.

## Two kinds of benchmark

**Public benchmarks** use open datasets. Each dataset is registered as a
metadata card with a fetch-from-source pointer: the harness downloads the
references from upstream at run time, checks them against a pinned SHA-256,
and scores against what it fetched. Public data may already be in a model's
training data, so datasets carry a contamination grade. A set graded `HIGH`
or `MEDIUM` (FLORES+ is `HIGH`), or not graded at all, is **relative-only**:
usable to compare methods run on it, never reported as absolute quality.
Only a set graded `LOW` ranks on absolute quality. A quarantined dataset
never ranks: the database refuses a score posted against it.
The registered datasets and their licence lanes are listed in
[Evaluation datasets](/docs/network/leaderboard/datasets).

**Sealed benchmarks** are held-out test sets their host keeps on their own
machine. Entrants never see them. An entry is a model or a method that the
host's own scoring node runs against the sealed set; only scores come out, and
every sealed run needs the host's authorization. The sets' keys are
organizer-held today. Community key custodians — none appointed yet;
Champollion holds no key shares. Prizes exist only on sealed contests, on
terms the host declares before anyone enters. How to host one:
[Run a sovereign contest](/docs/network/sovereignty/run-a-sovereign-contest).

## Scope

- **Written text.** The board measures translation of written text: documents,
  educational and official material, UI strings. It does not measure speech,
  real-time interpreting or open-ended chat.
- **Text-based languages.** Signed-language machine translation is a different
  problem; sign-language entries in the index say "not yet served"
  ([What counts as a language](/docs/network/context/what-counts-as-a-language)).
- **One dataset at a time.** A score is comparable only with scores on the
  same dataset version. Ranks never cross datasets or languages.
- **Methods, not sentences.** A score describes a method on a benchmark. No
  per-sentence confidence is published for any translation
  ([Technical limits](/docs/network/honest-limitations#system-vs-output)).

## What a published run carries

Every new card is scored under **scoring standard/1**
([Scoring Specification](/docs/network/specifications/scoring)):

- **The headline:** corpus-level chrF++ (0–100) with its 95% bootstrap
  confidence interval and its sacreBLEU signature, so anyone can recompute it.
- **Beside it:** BLEU, spBLEU and TER, and COMET when it was computed. They are
  shown, never blended into the headline.
- **Apart:** diagnostics such as FST acceptance and exact match, where their
  tools exist. They never enter the headline or rank a run.
- **Retired fields:** `composite`, `quality_tier` and `cost_adjusted` are
  `null` on every new card. An old card keeps its stored composite, shown as
  "legacy composite (retired)". No automatic score carries a quality label.
- **Provenance:** the dataset id and its SHA-256, the exact model slug, the
  condition, what the model was told (the prompt's SHA-256, and its text
  unless you redact it), the cost, the harness version and a fingerprint over
  the configuration. Identical runs deduplicate on publish, and an independent
  replication counts as evidence.
- **Trust tier:** every row arrives *self-benchmarked*. *Champollion Verified*
  means the score was re-derived from your submitted outputs against the
  pinned references; that re-scorer is a maintainer command run by hand, so
  today no row is promoted on arrival. *Community Validated* is conferred only
  by a community's own review ([verification tiers](/docs/network/leaderboard/rules#verification-tiers)).

The full schema is the [Run Card Specification](/docs/network/specifications/run-card).

## Publishing

```bash
# See exactly what would be uploaded (no sign-in, no network)
mt-eval publish eval/logs/harness/<run-id>_report.json --dry-run

# Publish to the live board (a browser sign-in the first time)
mt-eval publish eval/logs/harness/<run-id>_report.json --prod
```

- `--prod` (or `MT_EVAL_ALLOW_PROD=1`) is required for a write to the live
  board; without it the harness refuses.
- `--anonymous` publishes without signing in; the board shows "anonymous".
- `--scores-only` publishes aggregate scores and the dataset's hash and size,
  never the source or reference text — for your own or a private corpus.
- `--redact-coaching` replaces the prompt text with a marker and keeps its
  hash. A local-only corpus's coached prompt is redacted by default.

The step-by-step guide is [Submit a method](/docs/network/getting-started/submit-a-method).

## The rules that hold everywhere

- **Never train on evaluation data.** A method exposed to a benchmark set — as
  training data, few-shot examples, dictionary entries or prompt material — is
  disqualified ([Submission rules](/docs/network/leaderboard/rules)).
- **Better is decided by a test, not by two numbers.** Whether one run beats
  another is a paired significance test on chrF++; neighbours the test cannot
  separate share a rank ([Significance](/docs/network/specifications/significance)).
- **Corpora are not hosted here.** Registration is metadata; corpora are
  fetched from their source. A published run of an openly licensed set may
  carry its per-sentence text (above).
- **Licence lanes are structural.** Non-commercial corpora are kept out of
  every prize, API and commercial path. A corpus under a modified, bespoke or
  unstated licence (`LicenseRef-*`) refuses remote model-API evaluation until
  its rights-holder's consent is recorded on its card; standard non-commercial
  licences go to remote models only over no-training channels; sealed segments
  never go remote. The EdTeKLA Plains Cree sets are catalogued as quarantined
  labels, and the database refuses any score posted against them.

## What is running today

- The board is live, public and open for submissions. Its contents are live
  data, so this page does not describe them — [read the board](/leaderboard).
- Every row is self-benchmarked today (see trust tiers above).
- No prize is open, and no score has cleared a prize bar
  ([Prize Specification](/docs/network/specifications/prizes)).
- No community speaker review has been conducted
  ([Speaker validation](/docs/network/specifications/speaker-validation)).
- No method has passed to a community under a contest's terms.

[Technical limits](/docs/network/honest-limitations) is the full list of what
is not claimed; where this page and that one differ, that one wins.

## See also

- [Submission rules](/docs/network/leaderboard/rules) — what is accepted,
  disqualification, verification and reputation.
- [Evaluation datasets](/docs/network/leaderboard/datasets) — the registry and
  its licence lanes.
- [Submit a method](/docs/network/getting-started/submit-a-method) and the
  [FAQ](/docs/network/getting-started/faq).
- [Scoring](/docs/network/specifications/scoring),
  [Significance](/docs/network/specifications/significance) and the
  [Run card](/docs/network/specifications/run-card).
- [Contributing compute](/docs/network/getting-started/contributing-compute) —
  run items off the public queue with your own key.
