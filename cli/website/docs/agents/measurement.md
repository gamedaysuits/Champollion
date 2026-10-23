---
title: Measurement rules
slug: /agents/measurement
description: "How Champollion measures a translator, and how an agent reports it: the scoring standard (corpus chrF++ with a 95% bootstrap interval), gated scores, dev versus test, predictions, near-copies, the dictionary floor, the paired verdict rule and the 50-sentence floor under it, what the wishlist steers on, the speaker's marks, the blind two-model comparison, the speaker's verdict, rows shown again (agreement, random error, drift), and how to say a number."
---

# Measurement rules

The rails promise the people will **know** how good a model is on their own
sentences — not that it is good. That promise rests on a few rules, most of
them enforced. This page states them exactly, and ends with how to say a
number.

## The scoring standard (standard/1)

Every new run is scored the same way (`arena/mt_eval_harness/scoring.py`):

- **The headline:** corpus-level **chrF++** (sacreBLEU chrF with word order
  2), from 0 to 100 — higher means closer to the reference translations —
  with its **95% bootstrap interval** and its sacreBLEU signature. Written
  `chrF++ 47.5 [45.9, 49.0]`.
- **Which segments count:** one rule for the headline, its interval and every
  comparison. A segment whose translation failed counts as an empty output —
  never dropped, never scored as a placeholder; a segment with no reference
  is left out everywhere.
- **The interval:** the headline's own — percentile bootstrap over those
  segments, 1,000 resamples, seed 12345, α 0.05. Below 30 segments the tools
  warn that the interval may have poor coverage; with fewer than 2 there is
  none.
- **Beside it, never blended:** BLEU, spBLEU, TER, and COMET when it was
  computed, each with its signature or model id.
- **Diagnostics, apart:** exact match, equivalent match, FST acceptance,
  morphological accuracy, semantic validator, code-switching, hallucination,
  terminology adherence, writing style. They never enter a headline and never
  rank.
- **"Better" is a paired significance test** on chrF++, never two numbers
  compared by eye.
- **No quality labels.** Only human evaluation certifies quality.

**Retired:** the weighted composite score and the quality-tier labels. A
standard/1 run card carries `composite: null` and `quality_tier: null`.
**Note.** Never present, compute or quote a composite or a tier, even from an
old card.

**Score caveats** are diagnostics written beside a score, never a change to
it: `source_copy` (half or more of the outputs copy the source),
`length_inflation` and `length_deflation` (outputs over twice, or under half,
the reference length — on average, or in a quarter or more of the segments), `near_constant_output` (one output repeated across many
sources), and `train_test_near_twin` (test rows with a twin in training —
major when half or more do). **Note.** Pass every caveat on with the score,
word for word.

## Gated measurement

When a run has a gate chain ([methods and gates](/docs/agents/methods#gate-chains)),
**what is measured is what ships**:

- the headline chrF++ scores the gated output;
- the ungated chrF++, with its interval, sits beside it
  (`overall.gates.ungated`);
- the **refusal rate** — segments the gates refused ÷ segments judged — is a
  number of its own, with counts by gate and by what shipped (`shipped_from`:
  method, source, fallback, nothing);
- the chain's **fingerprint** (sha256 of its canonical JSON) travels with the
  report and any published run.

**Lock.** No fallback in measurement: `mt-eval run` and `mt-eval test` refuse
a chain whose gates hand refused segments to a fallback, before anything is
translated or spent.

**Note.** Report a gated score with its ungated score and refusal rate.
A gated score alone hides what the gates threw away.

## Sets and what each is for

| Role | Used for | Read |
|---|---|---|
| `train` | Learning | Never scored as a result |
| `dev` (practice) | Choosing the checkpoint; judging improve rounds (from 50 sentences); the dictionary floor | Freely |
| `test` | Milestones: testing a model, against the people's prediction | Every scoring read needs a preregistration (forge); every read is logged |
| `sealed` | A test no one outside its holders sees | Once |

**In nmt-forge** (the registry, `.forge/eval-registry.json`; the ledger):

- **Lock.** Every read of a registered set is written to the hash-chained
  ledger with its purpose (`score`, `dev-selection`, `audit`, `inspect`).
- **Lock.** Scoring a test set requires a valid preregistration for its
  current content.
- **Lock.** A sealed set is scored once. A second score is refused (`sealed
  set '<name>' has already been spent`); a single `mt-eval` read of the sealed
  file spends it too. `--override-respend '<reason>'` (on `nmt-forge score`
  and `nmt-forge compare`) is written to the ledger. `export` refuses to
  re-spend and names `--no-eval`.
- **Lock.** The dev fence: training needs a registered `dev` set; dev rows may
  not share an exact source or target with a test or sealed set; no training
  row may be a dev row.

**In mt-eval:**

- **Note.** `mt-eval run` and `mt-eval compare` score a test or sealed file
  without any preregistration and never refuse on read counts. `mt-eval run`
  only appends a line to the file's read log (`<file>.reads.jsonl`) when forge
  created one; `compare` and `test` log nothing. Never score the test set with
  mt-eval before the people's prediction is written.

## Predictions

```bash
nmt-forge prereg new first-model --eval-set project-test --expect "<their words>" --rationale "<their reason>"
nmt-forge prereg new round-2 --eval-set project-test --predictions predictions.json
nmt-forge prereg template --out predictions.json
```

- `--expect` and `--rationale`: one free-text prediction about chrF++, in the
  people's own words. Its verdict is the people's: `nmt-forge prereg verdict
  <id> --prediction <n> --held` (or `--missed`) `--by "<who>"`.
- `--predictions <file>`: a JSON array; each prediction names a `metric` and
  a `rationale`, and either a `direction` (`increase`, `decrease`,
  `no_change`) with a `baseline_score` (and optional `margin`) — judged by the
  tools — or free-text `expect`.
- **Lock.** A prediction written after any scoring read of the set (by forge,
  or by `mt-eval run`) is refused: *"eval set '…' was already read for scoring
  (N time(s): …) before this preregistration"*. `--allow-after-reads` lets it
  through, and every report, export and status says so.
- **Note.** The prediction is the people's, written before any score exists,
  never reworded or narrowed by you. The rails' question suggests no number
  (*"No number is suggested here, so the guess stays theirs"*); do not offer
  one either.

## Near-copies

`nmt-forge leak-audit` compares every training pair with every registered dev,
test and sealed set:

| Found | Rule | What happens |
|---|---|---|
| Same file | sha256 | Dropped |
| Exact copy | Same source or same target after normalization | Dropped |
| Near copy | Target word sets overlap ≥ 0.6 (Jaccard) where one contains the other, or ≥ 0.9 | Dropped |
| Template sibling | Same sentence frame, different answer | **Kept** to learn from, and counted, so the score can be read with and without those test rows |
| Source-only match | Same prompt, different answer | Kept, reported |

Short sentences are compared by character trigrams; very short ones by exact
match only. A test row is a **near-twin** when a training row is identical or
overlaps it ≥ 0.6 on either side; when half or more of the test rows have
twins, the score is mostly recall, not translation, and the caveat is major.
`--clean-to` writes the screened file; `--drop-test-twins` also drops the
training rows that twin a test row, for a twin-free score.

The rails' first dev split applies the same threshold: `--near-dupe 0.6` on
`nmt-forge split` keeps rows whose words overlap ≥ 0.6 on one side of the
dev/training line, so the first dev score holds no near-copy memory a later
round's screen would deny. `--max-group` caps a near-copy group at half the
dev size plus one, so a file written from templates still splits.

**Note.** Say "the leak audit found …" only from `true_now` or the audit's own
output, never "the test set is clean" on your own.

## The dictionary floor

`nmt-forge floor <word lists>` translates the dev set word for word with the
dictionary (longest phrase first) and scores it with the same code as a run's
dev score: chrF++ with its 95% interval. It runs on this computer, never reads
the test set, and records only the dictionaries' names, hashes and entry
counts, how many source words they reached, and the scores. A run **beats the
floor** only when the lower end of its dev interval is above the upper end of
the floor's; `nmt-forge status` warns about a run that does not.

## Comparing two models

**An improve round** (`nmt-forge compare-runs <in-use> <new>`): both models'
translations of the **same dev sentences**, paired row by row; a paired
approximate-randomization test (1,000 trials) and a 95% bootstrap interval on
the difference.

| Verdict | Rule |
|---|---|
| **too-few** | fewer than 50 dev sentences, whatever the scores — the model in use stays, and the speaker's blind marks decide (below) |
| **better** | 50 or more, p < 0.05 **and** the interval's lower end above 0 — the new model is offered for use; it is put to use only on the people's yes |
| **worse** | 50 or more, p < 0.05 and the interval's upper end below 0 |
| **no-change** | anything else — the model in use stays |

**Why 50.** Measured on the invented test language's ByT5-small outputs, 100
random practice sets per size, with this rule: at 23 dev sentences it called
two near-equal models (0.7 chrF++ apart on 500 sentences) different 9 times
in 100, and called a real +5.9 chrF++ gain **better** only 21 times in 100;
at 50 sentences, 4 times and 96 times in 100. The smallest difference seen 8
times in 10 was 8.1 chrF++ points at 23 sentences, 5.8 at 50, 4.0 at 100 and
2.8 at 200. So the rails' first split sets aside at least 50 dev sentences
when there are 200 pairs or more — one in ten of the screened pairs, at most
500; with fewer than 200 pairs, a quarter of them, which is under 50 — and
the review sheets grow the set with practice rows: one row in two while it
is under 50, one in four until it reaches 200.

Each verdict also says the smallest difference its dev set shows reliably
(8 times in 10): the interval's width × (1.96 + 0.84) ÷ (2 × 1.96). When that
is over 3 chrF++ points, "no-change" is the dev set's limit, not proof the
round did nothing. The dev set also chose the new run's checkpoint, which
favours the new model slightly — **say so** when you relay a verdict.

A blind preference by the speaker for the newer model (below) makes forge
offer it for use only after a **too-few** or **no-change** verdict — never
after **worse** — and the people say yes first (`improve-promote`, mode
`confirm`). A blind preference for the model a promotion replaced never puts
it back: the round report's action asks the people.

**Any two runs** (`mt-eval compare <report> <report> --significance`):
approximate randomization by default (`--method paired_bootstrap` for the
other), 1,000 trials (`--n-bootstrap`), α 0.05, seed 12345, on the entries the
reports share by id (a warning under 10). chrF++ first, then the secondary
metrics. Every pair of runs is tested; there is no multiple-testing
correction, and the output says so.

## What the wishlist steers on

`nmt-forge analyze` breaks a run's dev chrF++ down by kind of sentence (with
at least 5 dev sentences of a kind). A kind is **weakest** — and weights the
wishlist — only when the 95% interval on how far its sentences score below
the rest sits wholly above zero (Welch's interval on sentence-level chrF++).
A lower score that could be chance is reported as such (*"… could be chance —
the wishlist does not steer by it"*) and never weights the sheet.

Its "Words it has never seen" section asks for two or three sentences with
each word, each saying something different, not one: on the invented test
language, a word seen once in training came out right 27–29% of the time and
a word seen 2–4 times 63–95%; and at 3,200 training sentences, ByT5-small
trained on sentences chosen for the most new words had 39.4% of 500 held-out
sentences right in meaning, against 53.4% for everyday sentences, at
slightly more of the speaker's time (about 57 hours against 54).

## The speaker's marks

In each improve round the speaker marks the model's drafts of new sentences
`Y`, `N` or `?`. The share right is `Y ÷ (Y + N)` (`?`, unmarked, practice
rows and rows shown again left out), with a 95% Wilson interval. A rise between rounds counts as
**progress** only when the last round's interval sits wholly above the
first's, a round's model was put to use in between — chosen by the people
(forge's `export` and `choose` records), whether after a **better** verdict,
on the speaker's blind marks or by their own choice; a **better** verdict
alone does not count — **and** the speaker's blind checks of each promotion
(below), pooled over the rounds in between, marked the new models right
clearly more often than the ones they replaced (|z| > 1.96).
These are sentences no model had seen: the measure that matters most, and the
one to lead with ([coaching](/docs/agents/coaching)).

**Two models, blind.** `champollion improve sheet` has a second model draft a
seeded random half of the drafted rows (`nmt-forge draft-newer`), unmarked:
the newest trained model when it is not the one in use — as after a round
whose verdict was too-few, no-change or worse — or, on the visit after a
promotion, the model the one in use replaced. Which rows are whose is kept
beside the sheet in `improve/round-<k>/sheet-key.json` (`in_use`, `other`,
`relation` `newer` or `replaced`, each model's training pairs `in_use_pairs`
and `other_pairs`, `other_rows`, and `repeat_rows`, below).
`champollion improve marks` then counts the two models apart, rows shown
again left out of all of it:

- the share right above — the progress measure — counts the model in use's
  rows only;
- every draft marked right and every fix becomes a training pair, whichever
  model drafted it;
- a two-proportion test (pooled, two-sided at 5%: |z| > 1.96) says which
  model the speaker marked right more often, if either: `clear` is `newer`
  or `replaced` (the other model), `in-use` or `neither`, recorded in
  `marks.json` (`blind`) with both counts (`in_use_right`, `in_use_judged`,
  `other_right`, `other_judged`, `in_use_share`, `other_share`), `other`,
  `relation` and both training-pair counts; a comparison with a newer model
  also keeps `newer`, `newer_right`, `newer_judged` and `newer_share`. When
  either model has no row marked `Y` or `N`, `clear` is `null` and the text
  says *"too few rows of one model were judged to compare"*;
- against a newer model, with at least one draft of each judged, the counts
  go to forge (`nmt-forge speaker-verdict`), which runs the same test and
  records `clear` (`newer`, `in-use` or `neither`) in its ledger
  (`improve-speaker`). After a **too-few** or **no-change** verdict on that
  run, `clear: newer` makes forge offer the newer model for use;
  `champollion improve marks` then prints *"forge recorded it: it offers to
  put the newer model to use (the people say yes first)"*
  ([training](/docs/agents/training#the-improve-rounds)).

The rows were assigned at random, on one sheet, judged by the same speaker, on
the family's own new sentences — so a clear difference says something the dev
set may be too small to show, and a change in how kindly the speaker marks
touches both models alike. **Note.** Never tell the speaker which rows came
from which model before their marks are read.

**Rows shown again.** From round 2, `champollion improve sheet` puts back one
row for every 10 new sentences on the sheet (`REPEAT_EVERY`; rounded down,
and fewer when fewer qualify): a draft the speaker marked `Y` or `N` on an
earlier sheet, with its earlier draft, unmarked, at a seeded random place —
never a practice row, a row that was itself a repeat, one already shown
again, or a sentence on this sheet. The sheet's first line, above the
header, says: *"A few rows below come back from earlier sheets on purpose.
Please mark them fresh, as if new: how often the marks agree tells how far
they can be trusted."* It never says which; `sheet-key.json` keeps them as
`repeat_rows` (`row`, `from_round`, `from_row`, and `mark`, the earlier
mark). They cost the speaker about 10 seconds a row.

`improve marks` judges each against the speaker's own earlier mark only: a
repeat is never counted in the round's share, never a training pair again,
never in the blind comparison. `marks.json` gains `repeats`: `shown`,
`judged` (marked `Y` or `N` this time; `?` or blank is shown, not judged),
`agreed`, `agreement` (agreed ÷ judged), `wrong_to_right`,
`right_to_wrong`, `wrong_before` (judged rows once marked `N`) and
`rounds_apart_wrong_before`. It prints *"Rows shown again: the speaker
marked A of J the way they did before (P%) — W once wrong now right, R once
right now wrong. Not counted in this round's share, and not trained on
again."*

Pooled over the rounds, once 10 or more are judged (`MIN_REPEATS`), the
round report reads two things from them:

- **Random error** `e`, from the flips that go both ways alike. Two marks of
  one draft disagree by chance 2e(1 − e) of the time, half each way; with
  d = 2 × min(`wrong_to_right`, `right_to_wrong`) ÷ `judged`,
  e = (1 − √(1 − 2d)) ÷ 2. Error pulls every share toward 50%: a draft truly
  right a share p of the time is marked right e + p(1 − 2e) of the time, so
  at e = 10% "truly 80% right" reads about 74%.
- **Drift**: flips one way beyond the even ones. The report warns that the
  marking may be growing kinder when once-wrong-now-right flips clearly
  outnumber the other way: 6 flips or more and a sign test,
  (`wrong_to_right` − flips ÷ 2) ÷ √(flips ÷ 4) > 1.96.

Its check line: *"The speaker marked A of J rows shown again the way they did
before (P%): about E% of marks go the other way at random, which pulls every
share marked right toward 50% — the projection allows for it."* — and on
drift, *"And W drafts once marked wrong are now marked right, against R the
other way: the marking may be growing kinder, which a rise in the share would
not show."* Under 10 judged: *"N rows shown again judged so far — the
speaker's own marking error is estimated from 10."*

**Where the rounds point.** The round report's projection is made only from
real progress (above) while the share right is under 80%. Learning curves
rise by roughly even steps in log-odds per doubling of the training data, so
it reads the step from the same blind checks after promotions: the sum of
`logit(in_use_share) − logit(other_share)` over the sum of
`log2(in_use_pairs ÷ other_pairs)` (shares clamped to 1–99%), with a 95%
range from each share's variance, about 1 ÷ (n·p·(1 − p)) for n drafts
judged. From the model in use's training pairs it says how many more reach
80% marked right — the estimate — and the speaker's hours at 70 seconds a
sentence. The range covers the step's interval (no upper end beyond six more
doublings) and, once 10 rows shown again are judged, where "truly right on
80%" may sit on this speaker's marks: e + 0.8(1 − 2e) + 0.2 × K, at most
97%, where K is the drift per round (flips beyond the even ones, over how
many rounds apart the once-wrong rows' two marks were) times the rounds
between the first and last marks, capped at ±30%. The fewest is the smaller of the two aims at the step's
upper bound, the most the larger at its lower bound; a fewest of 0 reads
"none". The text then adds *"The speaker's own marking: they marked A of J
rows shown again the way they did before (P%), so about E% of marks go the
other way at random … drafts truly right on 80% may be marked right about T%
of the time on their marks — the range takes that in."* (with, when K is
1% or more either way, how much more or less often drafts once marked wrong
are now marked right); before then, *"(The speaker's own marking error is not yet
allowed for: too few rows shown again have been judged.)"* `report.json`
carries the numbers as `projection_numbers` (`more_sentences`, `range`,
`speaker_hours`).

In simulation — a noisy speaker, the rails' own dev split and these verdict
rules, 200 trials per scenario on two sets of seeds — the estimate landed
within a factor of 2 of the true count 69–78% of the time at 400 new
sentences a round and 53–56% at 800, and the true count fell inside the
range 89–94% and 76–80% of the time (without repeats, 91–93% and 51–54%).
Moving the estimate itself to the speaker's marks helped at 800 a round and
hurt at 400 (within a factor of 2: 64% and 19%), so it stays at the plain
80%. A note that the model "may already be working" was tried and dropped:
it was wrong 2–3 times for each time it was right. A rough guess, said so.

## What the numbers do not say

- A score is for the system on that set, not for any one sentence: there is no
  per-sentence confidence.
- chrF++ measures overlap with a reference. A good translation worded
  differently can score low; a fluent wrong one can score fairly high.
- FST acceptance says words exist, not that a sentence means the right thing.
- Published leaderboard rows are self-reported by default; the verifier
  re-scores submitted outputs against the hash-pinned corpus (within 1.0
  chrF++), and does not re-run methods.

## How to report a number

Every number carries **its unit, what it measures, and the set it was
measured on** — with the set's size and the range when there is one.

| Say | Never |
|---|---|
| "chrF++ 24.1 out of 100 on the 50 practice (dev) sentences, range 20.6–27.6" | "24.1" · "24% accurate" |
| "the speaker marked 9 of 24 new drafts right — 38% (21%–57%)" | "38% accuracy" |
| "no measurable change: on 50 dev sentences only a difference of about 5.8 points shows" | "it improved slightly" |
| "too few practice sentences to tell yet: under 50, no comparison decides — the speaker's blind marks will" | "no change" for a **too-few** verdict |
| "on the 50 locked test sentences, once, against the prediction you wrote: '…'" (their words, read back) | a test score with no set or prediction |
| "blind, on new sentences, the speaker marked the newer model right on 7 of 12 and the model in use on 5 of 12 — no clear difference on 24 sentences" | "the new model is better" from the marks alone |
| "chrF++ 31.0 gated (what ships), 33.5 ungated, 12% refused by the gates" | the gated score alone |

- A range is how sure the tools are, not two results.
- Two scores on different sets are not comparable. Two scores on the same set
  differ only when the paired test says so.
- Quote caveats and warnings word for word.
- Never call a score good or bad; never attach a quality word. A fluent
  speaker decides what is fit to use.

## Go deeper

- [The scoring spec](/docs/network/specifications/scoring) and
  [significance](/docs/network/specifications/significance).
- [The run card](/docs/network/specifications/run-card) — what a scored run
  records.
- [Metric reliability](/docs/network/specifications/metric-reliability) —
  which metric has been checked against human judgments for which languages.
- [The technical limits](/docs/network/honest-limitations).
- [The guardrails](/docs/guardrails) — the people's version.
