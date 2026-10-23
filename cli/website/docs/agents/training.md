---
title: Training with nmt-forge
slug: /agents/training
description: "How nmt-forge trains and tests a model on the rails: the model presets and what --model auto picks by memory, the guarded loop command by command, decoding and length limits, background jobs and the one-training-at-a-time queue, disk space (kept checkpoints, the disk check, tidy), export and serve, the improve rounds (the round verdict, the speaker's verdict) and the stronger-model offer, synthetic data, a verified symptom → cause → fix table, and the failure taxonomy."
---

# Training with nmt-forge

`nmt-forge` trains a model on the people's pairs, inside guardrails: it
refuses what would corrupt a result, and every refusal says what, why and the
fix. It implements no metric of its own — every score comes from the
evaluation engine (`mt-eval`), the same code that scores everything else.

On the rails you rarely type these commands: `champollion next` names them,
and from the `forge` step on it relays forge's own advisor
(`nmt-forge status`). This page is what those steps do.

## Models

`nmt-forge init --model <preset>` writes a preset into `config.json` as
explicit numbers (hashed into every run's identity: a later forge release
never changes an existing project's runs). `nmt-forge use-model <preset>`
switches a project.

| Preset | What it is | Needs | What forge says to expect |
|---|---|---|---|
| `cpu-tiny` | A small transformer trained from scratch on the pairs, with a 4,000-piece vocabulary learned from the training rows | CPU only · no download | "on ~1–2k pairs: chrF++ roughly 5–30 (the top end only for highly templated data) — memorized phrases and your data's templates, not general translation" |
| `byt5-small` | Google's ByT5-small (300M parameters, reads bytes — no vocabulary to fit), fine-tuned | ~1.2 GB download · Apple silicon or a CUDA GPU recommended | "in forge's own trials it learned far more from the same pairs than cpu-tiny — still measure it against your model in use on your dev set" |
| `byt5-small-lowmem` | The same model, learning rate and length limits, set up for a computer with 8–15 GB of memory: Adafactor, gradient checkpointing, and batches of 4 pairs accumulated 4 times (the same 16 pairs a step) — less memory per step, more time. Not yet measured on an 8 GB computer | as `byt5-small` | as `byt5-small` |
| `cpu-finetune` | A small pretrained Marian/opus-mt model, fine-tuned on CPU. You name the base (`--base`); it is never guessed | CPU only · ~300 MB download | "depends on how related the base's target language is — measure it against cpu-tiny on your dev set" |
| `nllb-600m` | NLLB-200 distilled 600M with LoRA | a CUDA GPU (8 GB+) · ~2.5 GB download | "the strongest of the three when NLLB covers a related language; still measure it — never assume" |

Every preset trains with forge's training extra (`nmt-forge[hf]`), with seed 42.
No preset sets a time budget: that number is the people's.

- **Without `--model`**, `init` writes `cpu-tiny`.
- **`--model auto`** (what the rails pass) reads the memory of the GPU forge
  can train on — on a Mac with Apple silicon, the computer's memory (shared
  with the GPU); with `nvidia-smi` on `PATH`, the largest NVIDIA card's:
  16 GB or more (or memory it cannot read) → `byt5-small`; 8–15 GB →
  `byt5-small-lowmem`; under 8 GB → `cpu-tiny`. With neither GPU, `cpu-tiny`.
  The reason, with the memory it found, is printed (`chosen: …`) and returned
  as `model_choice` in `--json`. It does not test that the GPU works.
  `NMT_FORGE_AUTO_PRESET` overrides it (it must name a preset).
- **The stronger model the rounds offer** goes only to a project whose model
  in use is `cpu-tiny`: `byt5-small-lowmem` where `--model auto` would pick it,
  otherwise `byt5-small` — also on a computer where `auto` would pick
  `cpu-tiny`; the offer's `why` names what it needs.

**Note.** Never describe a preset's expectation as a promise. Measure on the
dev set.

## The guarded loop

Each command takes `--json`; `--workspace <dir>` (default `.forge`) goes
before the subcommand. Forge refuses abbreviated flags.

| Step | Command | What it does | What it refuses |
|---|---|---|---|
| Workshop | `nmt-forge init <code> --dir . --pair <src>-<tgt> --model auto` | Writes `.forge/`, `config.json`, `NEXT_STEPS.md` | An unreadable `--pair`; `cpu-finetune` without `--base` |
| Test set | `nmt-forge registry add project-test <file> --role test` | Pins the file's sha256; starts its read log | Synthetic rows in a test or sealed set; a name already registered with other content (unless `--allow-rotate`) |
| Screen | `nmt-forge leak-audit <corpus> --clean-to <clean.jsonl>` | Screens every pair against every registered dev, test and sealed set; writes a clean copy | Overwriting a file in use (unless `--overwrite`); a result with no training left |
| Predict | `nmt-forge prereg new <id> --eval-set <set> --expect "…" --rationale "…"` | Writes the people's prediction before any score | An existing id; writing after any scoring read of the set, by forge or `mt-eval` (unless `--allow-after-reads`, written to the ledger) |
| Dev set | `nmt-forge split <clean.jsonl> --test 0 --dev <n> --seed 42 --near-dupe 0.6 --max-group <m> --out data/split --register project` | A group-disjoint dev carve, registered as `project-dev`. The rails' `<n>`: one in ten of the screened pairs, at least 50, at most 500 — a quarter of them under 200 pairs ([shell](/docs/agents/shell#build-and-test-a-model)). `--near-dupe 0.6` keeps near-copies (word overlap ≥ 0.6) on one side, the threshold every later round's screen applies; the rails set `--max-group` to half the dev size plus one, so a file written from templates still splits | A side over 1.5× its request, or training keeping under half the rows |
| Floor | `nmt-forge floor <word lists>` | Translates the dev set word for word from the dictionary and scores it the same way as a run's dev score | No dev set registered |
| Check | `nmt-forge preflight run --config config.json` | Runs every gate the run will hit, with fixes; exit 2 if any fails | — |
| Train | `nmt-forge run config.json --detach` | Trains, picks the checkpoint on dev, removes the run's other checkpoints ([disk space](#disk-space)), writes `.forge/runs/<run name>-<8 hex>/` with `run-manifest.json`, `run-report.md`, `dev-outputs.jsonl` | A run that already exists (same config, training files and dev set); a disk without room for it (`disk-room`, before anything is written; `--skip-disk-check` overrides); a run in progress; training rows that leak into a test or sealed set; dev rows in training; data marked do-not-train or quarantined; `terms.training: not-allowed`; synthetic data over its cap; a decode cap too short for the references; unknown config keys |
| Test score | `nmt-forge export <run-manifest.json> --prereg <id> --out export/` | Scores the test set once, against the prediction; packages the model, with `input-words.json` beside its folder — the words it was trained on, so a server can name the ones it never saw ([serving](/docs/agents/serving#what-an-export-holds)) | No preregistration, or several and no `--prereg`; a spent sealed set; a non-empty `--out` without `--force` |
| Choose | `nmt-forge choose <export>/model` | Records the people's choice of model | A folder that is not a recorded export with a model |
| Serve | `nmt-forge serve <export>/model --detach` | Serves it on this computer ([serving](/docs/agents/serving#nmt-forge-serve)) | Off loopback without a token, or a local-only model without `--holders-agreed-by` |

Everything that matters is written to the hash-chained ledger
(`.forge/ledger.jsonl`): registrations, reads with their purpose, predictions,
scores, sealed-set spends, overrides, audit verdicts, the floor, exports,
choices, serves and job starts and exits. The run manifest is the record of a
run.

**Preflight gates:** config (prints the full config hash), workspace match, no
run in progress, dev fence, training data, backend installed, selection
plugins, test near-twins and dev near-twins (warnings), leak audit, training
mix, generation headroom, schedule sanity.

**Decoding.** The final dev decode, the test read (`export`), a model in use
translating the dev set again, and the served model use beam search with
`decode.num_beams` (4 unless `config.json` says otherwise); checkpoint
selection, which ranks many checkpoints, decodes greedily. An export
records `beams_applied`, and `nmt-forge serve` decodes the way the model was
measured: an older export without it is served greedily.

**Length limits.** A model learns from at most `model.max_src` tokens of a
source sentence and `model.max_tgt` of its translation, reads at most
`model.max_src` when it translates, and writes at most
`decode.max_new_tokens` (`byt5-small`: 320 bytes each — about 320 letters of
a Latin script, about 100 of syllabics; `cpu-tiny`: 256 pieces in, 384 out).
Nothing is cut silently: training counts the pairs past either limit before
it cuts them, and the final dev decode counts sentences cut going in and
translations that stopped at the cap. Both go in the run manifest
(`length_limits`), and `status` warns, with the fix: split long sentences, or
raise `model.max_src` and `model.max_tgt` (and `decode.max_new_tokens`) in
`config.json` — training then takes longer.

**Note.** `nmt-forge run` itself does not require a prediction; the rails ask
for it first. Do not train before the predict step is done.

**Note.** `export` is the step that reads the test set. Running it is a
milestone, with the people's prediction already written — never a routine
check.

## Background jobs

`run --detach` and `serve --detach` start a supervised job and return.

```bash
nmt-forge jobs                          # every job: state, stage, step, time left, last sign of life
nmt-forge jobs stop <name> --wait 120   # stop it, and wait up to 120 s (at most 180) for it to exit
```

- States: `running`, `finished`, `refused`, `crashed`, `stalled`,
  `deadline`, `interrupted`, `lost`. `lost` is a job whose supervisor ended
  without a record — including after a reboot, when its process number now
  belongs to another process.
- **One training at a time on this computer.** Training jobs queue
  machine-wide, first come first served (`~/.nmt-forge/machine/train-queue`),
  across every project. A queued job stays `running`, with `queued_behind`
  (the job it waits for) in `nmt-forge jobs --json`; `status` is `training`
  and says whom it waits behind, and it starts by itself. A stop while it
  waits ends it unstarted (`interrupted`); a 24-hour wait ends it
  (`deadline`).
- **Bounds** (training jobs): no sign of life for 15 minutes at startup
  (`--startup-minutes`); no progress for the longer of 10 minutes and 30 times
  the median step time (`--stall-minutes`); a deadline of `--deadline-hours`,
  else the config's time budget × 1.25, else 24 hours. A job past a bound is
  stopped and written down.
- **Stopping**: the run halts at its next step; the supervisor escalates to
  terminate after 60 s and kill 10 s later.
- **The wall-clock gate** (Hugging Face backends): after warm-up, forge times
  the steps, projects the run, and refuses one that will not fit the budget
  (`wall-clock budget exceeded: …`). With no budget set, the limit is a 24-hour
  ceiling.
- While a training job runs, `status` is `training` and the rails step is
  `wait`. A job that failed is a warning on every later status.
- **Resuming.** When the last training job ended `lost`, `crashed`, `stalled`
  or `deadline` after saving a checkpoint, `status` names `nmt-forge preflight
  run --config config.json && nmt-forge run config.json --resume --detach`:
  a new run that starts from the interrupted run's last checkpoint (its
  weights, a fresh optimizer, the epochs it had left), and whose manifest says
  where it resumed from (`resumed_from`). It is never offered after a stop by
  hand.
- Detached jobs are POSIX only (macOS, Linux).

## Disk space

Training writes checkpoints: up to `model.save_total_limit` of them at once
(4 unless `config.json` says otherwise), about 1.4 GB each for ByT5-small.
Before these rules, every improve round of a ByT5-small project kept about
5.6 GB, nothing removed an earlier round's model, and a full disk killed a
run as it saved. Forge's GB is 1024³ bytes.

- **A finished run keeps only its selected checkpoint.** Every other
  `checkpoint-*` folder of the run goes once the checkpoint is chosen:
  nothing reads them again (`export` copies the selected one; the next round
  starts from the model in use). The manifest records `checkpoints_pruned`
  (`removed`, `bytes`, `kept`). `"keep_checkpoints": "all"` in `config.json`'s
  `model` block keeps them all. Any other value is refused when the config
  is read, before any training (`ConfigError`; here for the value `x`):
  `config.model.keep_checkpoints is "selected" (the default: only the checkpoint the run picks stays) or "all", not 'x'`.
- **Lock.** A run the disk cannot hold is refused before anything is written
  (guard `disk-room`); a detached run is refused at once, before its job
  starts. The estimate: one checkpoint's size — the kept checkpoint of an
  earlier run of the same base in this workspace, else the base's own weight
  files (a local folder, or the Hugging Face cache) — times
  `model.save_total_limit`, plus 1 GB to finish; never under 2 GB. The
  refusal reads
  `[disk-room] this computer has <free> free; training this model needs about <need> (<n> checkpoints of about <size> each while it trains, and room to finish)`
  — or, when no size is known, *"(at least that much must stay free
  whatever the model)"* — then
  `why: a disk that fills mid-training loses the run as it saves, and slows the whole computer`,
  and a `fix` that names what `nmt-forge tidy` can free here (when it can
  free anything), moving other files off the disk, and `--skip-disk-check`.
- `nmt-forge run … --skip-disk-check` (with or without `--detach`) starts
  anyway. The manifest's `disk_room` records the check — `free_bytes`,
  `checkpoint_bytes` (`null` when unknown), `checkpoints_at_once`,
  `need_bytes` — or `{"skipped": "--skip-disk-check"}`. **Note.** The
  estimate can be wrong; whether to skip the check is the person's call.
- **`nmt-forge tidy`** lists the model weights of earlier rounds that nothing
  uses — each run with its size, the total, the free space — and removes
  nothing. `nmt-forge tidy --yes` removes them. It never removes the model in
  use, the newest run, or the model the one in use replaced (the blind
  review sheet drafts with it); the output's `Kept:` line names each, with
  why. A tidied run keeps its record — manifest, dev translations, report —
  and its manifest gains `model_removed` (`at`, `by`, `bytes`, `why`); the
  ledger gets a `tidy` entry (`runs`, `bytes`). A tidied run asked to
  translate (`compare-runs` re-translating the dev set with it) is refused:
  `run <name>'s model was removed by nmt-forge tidy on <time> to free disk space — its record stays, its weights do not`.
  **Note.** `--yes` deletes files: show the person the list, and run it only
  on their yes.
- **`status` warns** — a line in `warnings`, relayed by the rails — when the
  disk holding the workspace has under 10 GB free, or tidy could free 5 GB
  or more: *"this computer has X GB free; the models of N earlier round(s)
  nothing uses take Y GB — `nmt-forge tidy` lists them,
  `nmt-forge tidy --yes` frees the space (the model in use, the newest and
  the one it replaced are kept)"* (the part after the semicolon only when
  tidy would free something).

## The improve rounds

Once a model is in use, each round trains a new run on more data with the
same dev set.

**How a round trains.** `champollion improve prepare` runs `nmt-forge
round-plan --config config.json`, which rewrites `config.json` one of two
ways and writes the plan to the ledger (`round-plan`):

- **On from the model in use** (`init_from` its model folder): 4 passes
  (epochs) over all the sentences so far — the old ones keep it from
  forgetting — at half the learning rate. Much shorter than training from the
  start. The full settings wait in `config.json` under `model_full`.
- **From the start**, with the full settings put back, when no model is in
  use yet; when the model was changed (`use-model`, which also drops
  `model_full`); for `cpu-tiny`, whose vocabulary comes from the training
  sentences (it trains in minutes); for an adapter (LoRA) model; and every
  4th round, so many short continuations do not drift.

`prepare` prints the plan and its reason, and records `training` (`mode`,
`epochs`) in `improve/round-<k>/prepared.json`. Either way the new run is
judged against the model in use on the same dev sentences. Then (1, 3 and
4 are states forge's advisor names; 2 is recorded by the rails):

1. **`improve-compare`** (`auto`): `nmt-forge compare-runs <in-use
   run-manifest.json> <new run-manifest.json>` — the two models, paired
   sentence by sentence on the dev set. With fewer than 50 dev sentences the
   verdict is **too-few**, whatever the scores: *"too few dev sentences to
   tell: below 50, a difference is not told from chance reliably, whatever
   its size"*. From 50: **better** only when the paired test's p < 0.05
   **and** the 95% interval of the difference is above zero; **worse** when
   p < 0.05 and it is below zero; otherwise **no-change**. Every verdict says
   the smallest difference its dev set shows reliably. The test set is never
   read. Refused (`improve-loop`) for runs on different dev sets, a run
   without saved dev translations, or a dev set changed since the new run.
2. **The speaker's verdict**, where the dev set could not decide. A round's
   model that was not put to use drafts half of the next review sheet's
   drafted rows, blind (`draft-newer`, below), and `champollion improve
   marks` records the speaker's counts with forge:
   `nmt-forge speaker-verdict --newer <run> --in-use <run> --newer-right <n> --newer-judged <n> --in-use-right <n> --in-use-judged <n> --json`.
   Forge acts on it only after a **too-few** or **no-change** verdict. A
   pooled two-proportion test, two-sided at 5% (|z| > 1.96), gives `clear`:
   `newer`, `in-use` or `neither`; the ledger's `improve-speaker` entry keeps
   the two run names, the four counts, `z` and `clear` — counts only. It
   refuses counts below 0, more right than judged, and a model with no
   judged draft. Its text: *"Marking blind on the same visit, the speaker
   marked the newer model right on A of B new sentences (P%) and the model
   in use on C of D (Q%)"*, then *"the newer model is clearly better on
   these sentences — forge offers to put it to use"*, *"the model in use is
   clearly better on these sentences — it stays"* or *"no clear difference
   on these sentences — the model in use stays"*.
3. **`improve-promote`** (`confirm`), on **better** — or on **too-few** or
   **no-change** when the newest `speaker-verdict` on that run says
   `clear: newer` (never on **worse**). It is an offer: a verdict alone puts
   nothing to use. On the people's yes it exports the new run without reading
   the test set (`--no-eval`), records it as chosen (`choose`), stops the
   running server and serves the new model at the same port. Only that
   `export` and `choose` count as putting a model to use: until then the
   round report reads *"measurably better: not put to use — the people have
   not chosen it"*, and its progress, projection and overfit check leave the
   model out. On the speaker's marks, its `why` adds their counts and *"a
   clear difference: the newer model is better on the sentences the family
   needs"*. On the next sheet, half the drafted rows come from the model it
   replaced, so the speaker checks the promotion blind (below).
4. Otherwise the model in use stays and the next round begins — unless the
   last two round verdicts since the last change of model are both
   **no-change** or **worse**, with `cpu-tiny` in use. The last change of
   model is the newest `model-change` (a preset switch or a `not-now`) or
   `choose` entry in the ledger — any model the people put to use, a
   promotion on the speaker's marks included. A **too-few** round is not a
   judged round: when either of the last two is too-few, there is no offer.
   Then **`improve-stronger-model`** (`ask_user`):
   `nmt-forge use-model <preset> --config config.json --answer yes` (or
   `not-now`), the preset `byt5-small` or `byt5-small-lowmem`
   ([models](#models)). The answer slot is `try_it`. `yes` rewrites the
   config's model (keeping the people's time budget) and the next step trains
   it; `not-now` changes nothing. Both are written to the ledger
   (`model-change`), and the offer returns only after two more such rounds.
   Over MCP, "not now" here is the answer `try_it: "not-now"`;
   `declined: true` is refused on this step
   ([MCP](/docs/agents/mcp#not-now)). Its `why` never says more sentences are
   not helping: when the dev set is too small to see a round's gain, *"small
   gains may be hiding"*; otherwise the rounds brought *"no change the dev
   sentences can see (about X chrF++ points or more): the rounds may be
   adding less than that, or nothing"* — near the top of the curve a round
   adds about half a chrF++ point, under what 200 dev sentences show.
   **Note.** `--answer` defaults to `yes`: always pass the people's answer
   explicitly.

The rails drive the rest of a round (`champollion improve …`): `nmt-forge
wishlist` writes the sheet of what would help most (40 prompts by default, at
least a quarter left open; its words the model has never seen ask for two or
three sentences each, each saying something different — a word seen once in
training is rarely learned
([measurement](/docs/agents/measurement#what-the-wishlist-steers-on))), `nmt-forge analyze` breaks dev chrF++ down by kind
of sentence, and `nmt-forge grow-dev` adds the speaker's practice sentences to
the dev set under the same name — never a row already in dev, never one
whose source is in a test or sealed set. A kind of sentence steers the
wishlist only when it scores clearly below the rest
([measurement](/docs/agents/measurement#what-the-wishlist-steers-on)).
`nmt-forge draft-newer` (run by `champollion improve sheet`) drafts a random
half of the next review sheet's rows with the other model, unmarked, so the
speaker judges both models blind
([measurement](/docs/agents/measurement#the-speakers-marks)): the newest
trained model when it is not the one in use (its round was not put to
use), or, after a promotion, the model the one in use replaced. Its `--json`
says which (`relation`: `newer` or `replaced`, `null` when there is no other
model and every row is the model in use's), with `other`, `in_use`, the
training pairs behind each (`other_pairs`, `in_use_pairs`) and `n`; the
ledger's `draft-newer` entry records the same. How to relay a round:
[coaching](/docs/agents/coaching).

## Synthetic data and back-translation

- `nmt-forge synth <pack> --out <file>` runs a language pack's generator.
  Forge ships no packs. Each row is verified and stamped `synthetic: true`.
- A synthetic file trains as a tagged lane in `config.json`
  (`data.synthetic`, `{"path", "tag": "<synth>"}`). Over 15% of a kind, the run
  is refused unless the config names `mix.synthetic_sample`;
  `nmt-forge sample --cap 0.15 --key kind` draws a capped sample.
- **Back-translation has no command.** It is a library function
  (`nmt_forge.training.backtranslation.backtranslate`): you supply the
  reverse model; it screens the monolingual text against every registered set
  first and tags its output `<bt>`; the output then trains as a synthetic
  lane. No quality filter runs on it. `config.data.monolingual` is refused.
- **Note.** Monolingual text is the people's data like any other: its sidecar
  terms apply, and a reverse model that is a hosted LLM sends it to a provider
  ([data rules](/docs/agents/data-rules)).

## Symptom → cause → fix

| Symptom | Likely cause | Fix |
|---|---|---|
| `cpu-tiny` scores between 5 and 30 chrF++ on dev | It is weak by design: a phrasebook for phrases like its training data | More real pairs; on Apple silicon or a GPU, `byt5-small` (`nmt-forge use-model byt5-small`; `byt5-small-lowmem` where the GPU has 8–15 GB) |
| "Good on templates, bad on real text" | Rule R7 (transfer plateau): dev loss bottomed out before the last checkpoint and rose 5% or more. It fires on any such rise, whatever the dev chrF++ did — read it with the dev scores | More real pairs. Shown by `nmt-forge lint <run-manifest.json>`, not by export |
| The score looks too good | Test copies or near-copies in training; or most test rows have a training twin (R4-recall-not-translation, at half or more) | `leak-audit --drop-test-twins` for a twin-free file; report scores with and without the twins |
| A small difference between two models | The interval is wide (R5-low-power, interval wider than 8 points) | `nmt-forge compare` (paired test); for rounds, `compare-runs`. Grow the dev set |
| A round says "too few dev sentences to tell" (`too-few`) | The dev set holds under 50 sentences: no comparison decides there | Nothing to fix: the next sheet mixes both models' drafts blind and the speaker's marks decide; one sheet row in two is a practice row until the dev set holds 50 |
| A round says "no measurable change" | The dev set is too small to see a round's gain | Grow it from the speaker's practice sentences (`grow-dev`, driven by `champollion improve prepare`) |
| Training refused: `[disk-room] this computer has … free` | The disk cannot hold the run's checkpoints | `nmt-forge tidy` lists what earlier rounds' models would free; `nmt-forge tidy --yes` on the person's yes; or free space elsewhere. `--skip-disk-check` only when the person decides the estimate is wrong |
| A run does not beat the dictionary floor | Training learned nothing the word list does not give | More pairs; check the floor's coverage; say so to the people |
| The dev set is saturated | The interval's lower bound is at 99% of the ceiling | A harder dev set; the score cannot rise further |
| Refused before training | See the "Train" row above; `preflight run` names each failing gate and its fix | Follow the fix. A missing training extra: `uv tool install --reinstall --python 3.12 'nmt-forge[hf]'` (or `pip` into forge's own Python) |
| Stopped by the wall clock | The projected run exceeds the budget (24 hours without one) | A smaller model or fewer epochs, or a budget the people set (`model.time_budget_hours`) |
| A background job failed | `nmt-forge jobs` shows `crashed`, `stalled`, `deadline`, `lost` or `refused` | Read its `stderr.log` in `.forge/jobs/<name>/` and fix it; then train again, or resume from its last checkpoint when `status` names `--resume` |
| Training waits and does not start | Another training on this computer is running; this one is queued behind it (`queued_behind`) | Wait: it starts by itself. Do not start another |
| Long sentences come out cut off | The length limits: `status` warns with counts (pairs cut in training, dev sentences cut going in, translations stopped at the cap) | Split long sentences; or raise `model.max_src`, `model.max_tgt` and `decode.max_new_tokens` (longer training) |
| Words come out as unknown pieces (`cpu-tiny`) | The vocabulary is learned from the training rows only | More pairs that use those words; or `byt5-small`, which reads bytes |

## The failure taxonomy

Forge was built from a catalogue of ways a training project fools itself. In
summary — enforced means the tools refuse it:

| Family | Failures | In code |
|---|---|---|
| Leakage | The answer in the training set; near-copies; paraphrases straddling the split; chained templates | Enforced (leak audit, split guard). Template siblings are kept and counted |
| Dev/test contamination | Choosing checkpoints on the test set; spending a sealed set twice; a test score with no prediction; predicting after reading | Enforced (dev fence, eval ledger, preregistration) |
| Tokenizer and orthography | A tokenizer that cannot write the script; mixed spelling conventions | Not checked for tokenizers; mixed conventions are a lint, only when the config names them |
| Synthetic data | Mastering the synthetic mix; early stopping killing a synthetic-heavy run; collapse; back-translation feeding on its own errors | The early-stopping floor is enforced; the rest are lints or tags |
| Coverage | Missing words for the register | A lint, when a plugin reports coverage |
| Measurement | A delta smaller than its interval; one opaque number; metric math outside the engine | Enforced: every score carries its interval and comes from the engine |
| Decoding | Truncated output; checkpoints chosen by loss instead of output | Enforced: decode headroom, generation-metric selection; length cuts counted and warned about |
| Process | Unknown config keys; do-not-train data; runaway runs | Enforced |

Known gaps, with no code yet: tokenizer coverage, back-translation quality,
truncation by register, the gold/synthetic ratio, variance across seeds.

## Output for programs

`--json` puts exactly one JSON document on stdout. A refusal is
`{"error": {"type", "guard", "message", "why", "fix", "how_to_get", "text"}}`
and exit 2 (`details` is added for split and dev-fence refusals). Exit 1 is an
unexpected crash. `nmt-forge run` ends with `RUN EXIT <code>` (0, 1, 2 or
130); `run --detach` returns 0 with the job document. `nmt-forge status
--json` is `{"snapshot", "advice": {"state", "next_command", "why", "ready",
"blockers", "warnings", "answers"}}`.

## Go deeper

- [The `nmt-forge` command reference](/docs/network/getting-started/forge-command-reference)
  — every subcommand and flag.
- [Measurement rules](/docs/agents/measurement) — what the scores mean.
- [Your first translator](/docs/your-first-translator) and
  [Make it better](/docs/make-it-better) — the people's versions.
- [Serving and deployment](/docs/agents/serving) — what an export holds.
