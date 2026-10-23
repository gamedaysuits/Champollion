---
title: Coaching the people
slug: /agents/coaching
description: "How an AI agent relays Champollion's round report and talks with the people building a translator: progress first, every number with its unit and set, encouragement only for measured gains, time asked for without pressure, and nothing promised about quality."
---

# Coaching the people

The rails measure. You relay. Most of what the people hear about their
translator comes through you, so the way you say it is part of the work. This
page is how to say it: what the round report holds, how to pass it on, how to
ask for time, and the words to use.

The rules underneath are in [the contract](/docs/agents/contract) §5: say only
what is true, pass on every caveat word for word, promise process and never
quality, give every number its unit and the set it was measured on.

## The round report

Each improve round ends with `champollion improve report` (the journey's
`improve-report` step, mode `auto`). It writes
`improve/round-<k>/report.json` and prints four parts; `--json` prints the
same object:

| Field | What it holds |
|---|---|
| `round` | The round under way: one past the rounds forge has judged |
| `progress` | Lines, in order: the trend in the speaker's marks, then each round's marks (each followed, in a round whose sheet mixed in another model's drafts, by the blind comparison), then each round's verdict on the dev set |
| `checks` | Warnings about what the numbers can and cannot show |
| `projection` | A rough guess at how many more training sentences reach "working", counted per doubling of them, with a range — or why there is none — or `null` before two rounds of marks |
| `projection_numbers` | The same guess as numbers: `more_sentences`, `range` (`[fewest, most]` training sentences; `most` is `null` when the checks cannot bound it) and `speaker_hours` — or `null` when there is no projection |
| `actions` | One to four things to do next |

It reads only records the rounds keep — the speaker's `marks.json` per round
and forge's `improve-compare` verdicts — and prints counts and percentages,
never a sentence.

### What each line means

**The speaker's marks — the measure that matters.** Each round, the model in
use drafts the sentences the family wrote, and the speaker marks each draft
`Y` (right), `N` (wrong, with how it is said) or `?` (unsure). The share right
is counted over the drafts marked `Y` or `N`, with a 95% Wilson interval:

> Round 1: the speaker marked 9 of 24 drafts of new sentences right — 38%
> (95% range 21%–57%).

These are new sentences — drafted before any model learned them — so this is
the out-of-sample measure. In a round whose sheet mixed in another model's
drafts, these counts are the model in use's rows only. Rows shown again
(below) are never in them.

**Rows shown again.** From round 2, about one row in ten is a draft the
speaker already marked on an earlier sheet, back unmarked. The sheet says so
at its top — *"A few rows below come back from earlier sheets on purpose.
Please mark them fresh, as if new: how often the marks agree tells how far
they can be trusted."* — and never says which. `improve marks` prints *"Rows
shown again: the speaker marked A of J the way they did before (P%)"*, with
the flips each way. These rows are never counted in the round's share and
never trained on again; they cost the speaker about 10 seconds a row
([measurement](/docs/agents/measurement#the-speakers-marks)).

**The blind comparison.** A second model drafts a random half of a sheet's
drafts, unmarked, and the speaker judges both without knowing which is which
([measurement](/docs/agents/measurement#the-speakers-marks)). The second
model is the newest one when it was not put to use; on the visit after a
promotion, it is the model the new one replaced. The report adds a line:

> Round 2: Blind, on new sentences: the model in use was marked right on 5
> of 12 (42%), the newer model (not in use) on 7 of 12 (58%) — no clear
> difference on 24 sentences.

After a promotion it reads *"the model put to use last was marked right on …,
the model it replaced on …"*. It ends in one of three ways (a two-proportion
test at 5%): for a newer model, *the newer model is clearly better on the
sentences the family needs* or *the model in use is clearly better*; after a
promotion, *the new model is clearly better on the sentences the family
needs* or *the model it replaced was clearly better — the new one has not
helped on the sentences the family needs*; or *no clear difference on N
sentences*. With too few marked rows of one model it says *"too few rows of
one model were judged to compare"*.

**The trend.** The report calls a rise *real progress* only when all three
hold:

- the last round's range sits wholly above the first round's (its lower end
  above the first's upper end);
- a round's model was put to use in between — chosen by the people
  (forge's `export` and `choose` records): after a **better** verdict and
  their yes, on the speaker's blind marks, or by their own choice. A
  **better** verdict alone does not count; and
- marking blind on the same visits, the speaker marked the new model right
  clearly more often than the one it replaced (the checks after each
  promotion, pooled; a two-proportion test at 5%).

The third is there because a speaker's marking can drift: one who grows
kinder each round lifts every share, but on one visit it touches both models
alike. In a simulation with a speaker who marks 10% of drafts wrongly and
grows kinder each round, a promotion the practice set got wrong by chance
read as real progress in 106 of 1,600 reports where the model could not
improve; with the blind check, 3 — and at most 3 in 1,600 again when rerun
with the 50-sentence floor and the speaker's verdict, including runs whose
practice set starts at 30 sentences.

A rise with a promotion but without that check is printed as *not yet
counted as real progress: how kindly drafts are marked may have changed too*
— with the check's counts, or saying the next sheet mixes the two models'
drafts. A rise with the same model in use is printed as *not counted as
progress*: the sentences or the marking changed, not the model. A rise inside
the ranges is printed as *up, though not yet beyond the uncertainty*.

**The dev-set verdict.** Forge compares the new model with the one in use on
the same dev (practice) sentences, sentence by sentence:

> Round 1: on the same 50 practice (dev) sentences, chrF++ (0–100, overlap
> with the checked translation) 24.1 for the new model against 22.0 for the
> model in use — no measurable change: not used (on 50 sentences only a
> difference of about 5.8 points or more shows reliably).

How the line ends depends on the verdict and on whether the people chose
the round's model (forge's `export` and `choose` records) — a verdict alone
puts nothing to use:

| Verdict | Not chosen | Chosen |
|---|---|---|
| **better** | *measurably better: not put to use — the people have not chosen it* | *measurably better: put to use* |
| **worse** | *measurably worse: not used* | *measurably worse — put to use …* |
| **no-change** | *no measurable change: not used* | *no measurable change — put to use …* |
| **too-few** | *too few practice sentences to tell (under 50): the speaker's blind marks decide* | *too few practice sentences to tell (under 50) — put to use …* |

"Put to use …" ends *on the speaker's blind marks* when forge holds a
speaker verdict for that model with `clear: newer` (`improve-speaker`), and
*by the people's own choice* otherwise. `champollion improve status` uses the
same words: each round's line ends *"· new model on the practice (dev)
sentences: …"*. The verdict rule is in
[measurement](/docs/agents/measurement#comparing-two-models).

**The checks.**

- *Overfitting.* If the dev chrF++ of the model in use rose 3 points or
  more across the rounds (the last round's new model counts only once the
  people chose it) while the speaker's share right rose 2 points or less,
  the report says the gain may belong to the practice sentences, and to
  trust the marks.
- *A dev set too small to see a gain.* When the smallest difference the dev
  set shows reliably is more than 3 chrF++ points (or, unknown, under 50
  sentences), the report says "no measurable change" is the dev set's limit,
  not proof the round did nothing.
- *How far the marks can be trusted.* Once 10 rows shown again are judged,
  over all rounds: *"The speaker marked A of J rows shown again the way they
  did before (P%): about E% of marks go the other way at random, which pulls
  every share marked right toward 50% — the projection allows for it."* When
  once-wrong drafts now marked right clearly outnumber the other way (a sign
  test at 5%, 6 flips or more), it adds *"the marking may be growing kinder,
  which a rise in the share would not show"*. Before 10: *"N rows shown
  again judged so far — the speaker's own marking error is estimated from
  10."*

**The projection.** Made only when the rise is real progress (all three
above) and the share right is still under 80% — the rails' word for
*working* on the sentences the family needs. Learning curves rise by roughly
even steps per doubling of the training sentences, so it reads the step from
the speaker's blind checks of each new model against the one it replaced
(both models' training pairs recorded) and says how many more training
sentences reach 80% marked right, with a range, and the speaker's hours at
about 70 seconds a sentence (a minute to write, ten seconds to mark). The
range covers what the checks allow (95%) and, once 10 rows shown again are
judged, where "truly right on 80%" may sit on this speaker's own marks; the
text then says *"drafts truly right on 80% may be marked right about T% of
the time on their marks — the range takes that in"*. Before then it says
*"(The speaker's own marking error is not yet allowed for: too few rows
shown again have been judged.)"* The estimate itself stays at the plain
80%. Counts are rounded to two figures. When the checks cannot bound it, it
says they *"cannot yet say how many more it could take"*. Otherwise it says
why there is none — for one, *"the speaker's blind check has not yet shown
the new model beating the one it replaced, so the rise may be in the
marking, not the model"*. Always say it is a rough guess; the report does.
In simulation it landed within a factor of 2 of the true count 69–78% of the
time at 400 sentences a round and 53–56% at 800, and the true count fell
inside the range 89–94% and 76–80% of the time (at 800 a round, 51–54%
before the range took in the speaker's marks); the straight line it
replaced, 5% at 400. Never say a model "may already be working" from the
speaker's marking error: the report does not, because in simulation that
note was wrong 2–3 times for each time it was right.

**The actions.** In priority, at most four: mark this round's sheet, or write
the sentences still missing (20 a round); when the blind comparison found the
newer model clearly better, that *"the round did help, even where the
practice set could not show it"* — keep going, and growing the practice set
lets the next verdict see it; when the speaker marked the model a promotion
replaced clearly better, to ask the people whether to put the earlier model
back, and to make the practice set more like the sentences they need; grow
the practice set, when it is too small to see a round's gain and under 200
sentences (*"one sentence in 2 on each sheet has no draft — the speaker
writes how it is said, and it joins the practice set (now 31; 50 lets a
round be judged at all, 200 lets a gain of about 3 points show)"* — "in 4"
from 50); what to do after two rounds without a gain (below); that
the time the speaker said they can give looks too small; and, once the lower
end of the share right reaches 70%, a check on the locked test set — with a
prediction written first.

**Two rounds without a gain** — the last two verdicts both **no-change** or
**worse** (a **too-few** round says nothing either way, and does not count),
with no model put to use between them; forge counts the same way for the
stronger-model offer. Where the practice set can see a round's usual gain,
the action reads *"Two rounds without a gain this practice set can see
(about X chrF++ points or more): the rounds may be adding less than that, or
nothing — it cannot tell which. Faster ways forward: the stronger model the
rails offer when the computer can train one, or more of the kinds of sentence
it gets wrong."* (X is the verdict's smallest difference it shows.) Where it
cannot, it says to keep going. Never say or imply that more sentences will not
help: near the top of the curve a round adds about half a chrF++ point, under
what 200 practice sentences can show. In simulated rounds, the older line
"more of the same may not help" was said in 98 of 1,200 reports while the
model was really improving.

### How to pass it on

1. **Progress first.** Lead with what moved, in the speaker's marks.
2. **Every number with its unit and set.** "9 of the 24 new sentences the
   speaker checked were right — 38%", never "38%". "chrF++ 24.1 out of 100 on
   the 50 practice sentences", never "24.1". A range is how sure the tools are,
   not two results: "somewhere between 21% and 57% — with 24 sentences, the
   tools can't be surer than that".
3. **The checks, plainly.** If the report warns, say what it warns.
4. **The next steps as things they can do.** Turn each action into a sentence
   addressed to the people, with the file it names.
5. **Pass on every caveat word for word.**

**Encourage what is measured.** A draft marked right, a rise beyond the
ranges, a new model put to use: say so warmly. The first translation is worth
celebrating. Never celebrate a number the report does not call progress.

**"No measurable change" — plainly and kindly.** It does not mean the round
was wasted. Say what it means: on this many practice sentences, only a
difference of about this size shows; a smaller gain may be hiding; the model
in use stays in use; the sentences the speaker fixed still count. Then say
the next step.

**"Too few practice sentences to tell" — not "no change".** Under 50
practice sentences no comparison decides, whatever the two scores are; it is
not a verdict about the new model. Say what happens instead: the model in use
stays for now; the next sheet mixes the newer model's drafts in, unmarked,
and the speaker's marks decide; one sheet row in two has no draft, and those
sentences grow the practice set until a round can be judged on it.

**The blind comparison — with both counts, and what it does.** Say
both models' counts and the report's ending, as written. When the newer model
is clearly better, say it as the report does — the round did help, even where
the practice set could not show it — and that it is the speaker's own
judgement on new sentences. After a **too-few** or **no-change** verdict on
that model, a clear preference makes forge offer it for use: `improve marks`
prints *"forge recorded it: it offers to put the newer model to use (the
people say yes first)"*, and the offer comes as the `improve-promote` step
(below) — ask before running it. After a **worse** verdict it is not
offered. After a promotion, the same check is what lets the report count a
rise as real progress; when it says the model it replaced was clearly
better, ask the people whether to put the earlier model back — never do it
without their yes. "No clear difference" on 24 sentences means what it says.
**Note.** Never tell the speaker which rows came from which model before
their marks are read.

**Rows shown again — what they are for.** Say the agreement with its counts,
as the report does ("the speaker marked 17 of 20 rows shown again the way
they did before — 85%"), and what it is for: how far the marks can be
trusted. It is announced on the sheet, not a hidden check of the speaker.
Say the random error the way the report does: about E% of marks go the
other way at random, which pulls every share toward 50%, and the projection
allows for it. When the report says *"the marking may be growing kinder"*,
say it plainly and without blame: a rise in the share may then be the
marking, not the model. **Note.** Never tell the speaker which rows come
back, or what they marked before — the sheet says only that a few rows do.

**Words the model never saw.** When `sync` warns that keys *"hold words the
model never saw in training — very likely mistranslated, however fluent"*,
say it plainly: those lines are very likely wrong even if they read well; a
speaker should check them, or the next round's sentences can teach those
words. Name the keys, as the warning does; you never see the words. The
person sees them on the model's try page, under each line. The evidence, on
the invented test language: sentences holding a word the model had not seen
were right 0 times in 358 ([serving](/docs/agents/serving#words-the-model-never-saw)).

**The wishlist's words.** Its "Words it has never seen" section asks for
*"two or three sentences with each word you need, each saying something
different"*: fewer words, each in a few sentences, teach the model more than
many words once. Relay it that way. On the invented test language, a word
seen once in training came out right 27–29% of the time, and seen 2–4 times
63–95%; and with 3,200 training sentences, ByT5-small trained on sentences
chosen for the most new words had 39.4% of 500 held-out sentences right in
meaning, against 53.4% for everyday sentences — at slightly more of the
speaker's time (about 57 hours against 54).

Never call a score good or bad yourself. A fluent speaker decides what is fit
to use.

## Asking for time

The `improve-time` step (mode `ask_user`) asks how much time the speaker can
give: `per_week` and `total`, each **exactly as they said it** ("maybe 30
sentences a week", "a few hours, then we'll see"). It is recorded by
`champollion improve time` in `improve/time.json`; each round's sentence
count is planned around it, and the report compares the projection with it.

- **Note.** Ask once; never press for more. If they don't know, pass what they
  said — vague words are an answer.
- **Note.** When the report says the projection needs more sentences than the
  time they said is left, tell them plainly, with the options it names: more
  speakers, helpers on the project, or a narrower goal for now (a phrasebook
  for the sentences they need most). Then let them choose.

## The offers the rails make

**Offering a better model for use** (forge state `improve-promote`, mode
`confirm`). A new model was measurably better on the dev set — or the dev
set could not decide (**too-few**, or **no-change**) and the speaker, marking
blind, marked it right clearly more often. Then forge's `why` adds the
speaker's counts: *"Marking blind on the same visit, the speaker marked the
newer model right on A of B new sentences (P%) and the model in use on C of
D (Q%) — a clear difference: the newer model is better on the sentences the
family needs."* Say which it was. It is an offer: a verdict alone changes
nothing. Using it changes what their page or app answers, so ask before
running the step; on "not now", `declined: true`. Only their yes — the step's
`export` and `choose` — puts it to use; until then the report reads
*"measurably better: not put to use — the people have not chosen it"*, and
no rise counts as progress from it. Once chosen on the speaker's marks, the
round's line reads *"put to use on the speaker's blind marks"*.

**A stronger model** (forge state `improve-stronger-model`, mode `ask_user`).
After two rounds in a row that the dev set could judge show no gain —
both **no-change** or **worse**; a **too-few** round does not count —
counted from the last change of model (a switch of preset, or any model the
people put to use with `choose`, a promotion on the speaker's marks
included), with the tiny model in use, the rails offer ByT5-small
— `byt5-small`, or `byt5-small-lowmem` where the GPU has 8–15 GB of memory
to train with (less memory per step, slower): a download of about 1.2 GB and
longer training, best on Apple silicon or an NVIDIA GPU
([training](/docs/agents/training#models)). The answer slot is `try_it`:
`yes` or `not-now`. Say what forge's `why` says — when the dev set is too
small to see a round's gain, that small gains may be hiding; otherwise, that
the two rounds brought *"no change the dev sentences can see (about X chrF++
points or more): the rounds may be adding less than that, or nothing"*. It
does not say more sentences are not helping, and neither do you. "Not now"
is one of this step's answers: pass `try_it: "not-now"` (over MCP,
`declined: true` is refused here). Forge records it, keeps the model in use,
and the offer returns only after two more such rounds (**no-change** or
**worse**). Either answer is fine; it is theirs.

**Judging the prediction.** After a test-set score, the people say whether
the prediction they wrote held (`held` or `missed`) and who judged it. Read
them the prediction and the score with its range; never judge it for them.

**Speakers who have not agreed yet.** A file in `waiting_for_agreement` is
asked about once a session, gently. Only a yes from the person — that
everyone whose words are in it agreed — answers it.

## Words for the people

| Say | Instead of |
|---|---|
| "a score out of 100 for how close the translations come to the speaker's own — chrF++" | "chrF++ 24.1" alone |
| "how sure the tools are: somewhere between 21% and 57%" | "CI [0.21, 0.57]" |
| "the practice sentences" (the dev set) | "dev split" |
| "the test sentences, kept locked" | "held-out test set" |
| "the first small model" | its folder or run name |
| "no measurable change — on 50 practice sentences, only a difference of about 6 points shows" | "no improvement" |
| "too few practice sentences to tell yet — under 50, the speaker's own marks decide" | "no change" for a too-few verdict |
| "a phrasebook: good with sentences like the ones it learned" | "low-resource NMT baseline" |
| "the speaker marked 9 of 24 right" | "accuracy 38%" |

Explain a term the first time it appears, with an example before the word.

## When to suggest help

- **The project is stuck, or they ask for help from people.** Say: *"Having
  trouble, or want help with your project? Let's talk."* —
  [info@champollion.dev](mailto:info@champollion.dev). Never required; no
  pricing.
- **They need more sentences, speakers or computing than they have.**
  Point them to [Join a project](/docs/join-a-project): others can offer
  sentences, word lists or methods (files only, today), and nothing of theirs
  leaves without their yes ([hosting and joining](/docs/agents/hosting-and-joining)).

## Go deeper

- [Make it better, round by round](/docs/make-it-better) — the improve loop as
  the people read it.
- [Measurement rules](/docs/agents/measurement) — the verdict rule, ranges and
  dev-set limits.
- [Training with nmt-forge](/docs/agents/training) — what the stronger model
  is and costs.
- [The operating contract](/docs/agents/contract) §5 — say only what is true.
