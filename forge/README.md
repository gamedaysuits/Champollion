# nmt-forge

**Train NMT models without fooling yourself.** nmt-forge is a general-purpose
training suite that makes the classic training/eval mistakes — leaked test
sets, test-driven checkpoint selection, scores without error bars, structural
gaps hidden by volume — **structurally hard to commit**. It doesn't warn; it
refuses, and every refusal says what happened, why it corrupts results, and
the exact fix.

Every guard mechanizes a real, measured failure from Champollion's Plains
Cree work (the 2026-07-12 mistake ledger). Scoring is delegated entirely to
[`mt-eval-harness`](../arena) — forge implements zero metrics.

## Install

```bash
python3 -m pip install nmt-forge              # the guards, splits, audits, scoring (via mt-eval-harness)
python3 -m pip install 'nmt-forge[hf]'        # + training, export and serving (torch, transformers,
                                   #   accelerate, sentencepiece, peft — CPU wheels are fine)
```

`mt-eval-harness` comes in as a dependency: it is forge's scorer AND its
language-card resolver, so `discover`/`init` work from a plain pip install —
cards come from `--cards-dir`, `$MT_EVAL_CARDS_DIR`, a checkout or
`node_modules/champollion` above you, or the public card index (cached,
reused offline). Offline with no cache:
`npx champollion network card crk --json > cards/crk.json`, then `--cards-dir cards`.

## From `pip install` to a served model — on a laptop

The north star: *"a Cree model for our school"* — ~1,600 parallel pairs and a
private, teacher-checked test set — or *"an Atya model for the hospital"* —
~900 pairs and a sensitive test set. No GPU required:

```bash
nmt-forge init crk --dir school-mt          # card → workspace + config + NEXT_STEPS.md
cd school-mt                                # run everything from the project dir
nmt-forge registry add project-test ~/teacher-test.jsonl --role test   # YOUR test set
nmt-forge leak-audit ~/pairs.jsonl --clean-to pairs.clean.jsonl        # screen against it
#   …says most test rows have a near-twin in your pairs? a second, twin-free model:
#   --clean-to pairs.notwins.jsonl --drop-test-twins (its OWN file — it writes
#   config-notwins.json too) — one prereg per model, named after it
nmt-forge prereg template --out predictions.json      # write predictions BEFORE any score —
nmt-forge prereg new all-data --eval-set project-test --predictions predictions.json
#   …named after the model it predicts (`prereg new notwins …` for the twin-free one),
#   and before any benchmark (mt-eval run) on the test set: a read blocks a later prereg
#   …then read the training guardrails, once, before the split: the "Train a Model
#   Honestly" page (agents: the MCP tool get_training_guardrails)
nmt-forge split pairs.clean.jsonl --test 0 --dev 100 --seed 42 \
    --out data/split --register project     # train/dev only — the test set stays yours
nmt-forge preflight run --config config.json          # the checks run makes, incl. the [hf] extra
nmt-forge run config.json                   # cpu-tiny: minutes on a CPU, no download
nmt-forge export .forge/runs/<run>/run-manifest.json --prereg all-data --out export/
#   …the twin-free model: --prereg notwins --out export-<its run>/ (with two preregs
#   on one test set, export refuses to guess which one predicted which model)
nmt-forge serve export/model                # http://127.0.0.1:8378 — champollion can call it
```

That order — register the test set, screen the corpus, one preregistration
per model, (benchmarks), read the guardrails, split, train — is the one `nmt-forge init`,
`NEXT_STEPS.md` and `nmt-forge status` give. `--prereg <id>` on export names
the prediction that judges each model. Pinning is the other way:
`prereg new <id> … --config-hash <hash>` binds a prediction to one config —
the full hash `nmt-forge preflight run --config <its config>` prints — but any
later edit of that config (a time budget, say) changes the hash and drops the
pin, so naming it on export is the simpler route.

`export` scores the test set once (prereg-gated, 95% CIs), writes an
**mt-eval RunLog + TestReport** (built by the harness itself with the metric
battery `mt-eval run` loads for your language, so `mt-eval compare` works on
it — anything it could not compute is listed with the command that computes
it) into `export/evaluation/`, and packages the model into `export/model/`:
weights, tokenizer, a champollion plugin manifest and a `DEPLOY.md` (with
the per-pair `fallback` config for strings the model cannot do). Every
caveat the harness writes on the score — a near-constant output (one of a
few sentences for many different inputs), length, copies of the source —
is passed on in its own words beside the score: in the export summary,
`forge-model.json`, `DEPLOY.md`, `status`, `report`, `compare` and `lint`.
Scores follow the harness's scoring standard (`standard/1`): the headline —
the number to quote — is corpus **chrF++ with its 95% bootstrap CI**, written
`chrF++ 47.5 [45.9, 49.0]`, with its sacreBLEU signature wherever a full record
is kept (`forge-model.json`, `DEPLOY.md`, the export summary). BLEU, spBLEU,
TER and COMET are shown beside it, never blended into it; exact match and the
referee lanes are labelled diagnostics. forge prints no composite and no
quality label: only a speaker's review certifies quality. `nmt-forge lint`
takes the battery manifest (`export/evaluation/battery-hyps-battery.json`); given
a run's `run-manifest.json` it lints every scored export of that run, or tells
you the `nmt-forge export` command to run first.
**`export/model/` is what you deploy — it holds no test sentence;
`export/evaluation/` holds your test set's text and never leaves your
machine** (marked with the test set's terms when it has any). `serve` speaks the champollion
**api-method** contract (`POST /translate` — `"method": "api"`) and an
**OpenAI-compatible** `/v1/chat/completions` (`champollion sync --method
local`) — app strings and Markdown content files alike. The model never sees
placeholders, ICU plural/select syntax, tags or Markdown markup: the server
copies them around the model's output and hands it only the text between
them, sentence by sentence. `export` prints the verdict on each
preregistered prediction and how many test sentences have a near-twin in
training (when most do, it says the score measures recall, not
translation) — and `split`, `leak-audit` and `preflight run` say the same
count BEFORE training, while the test set is still unspent, with the fix:
`split --near-dupe 0.6` holds out whole templates when forge carves the
test set; for a FIXED test set like the teacher's, `leak-audit <pairs>
--clean-to <pairs.notwins.jsonl> --drop-test-twins` drops the training rows
that are near-twins of it (same measure and threshold as the count), says
how many go and what the strict subset becomes, and refuses to leave
nothing to train on. It writes to its own file: `leak-audit` refuses to
replace a file a config, a run or a split reads, or another audit's output
(`--overwrite` only on purpose). At every step `nmt-forge
status` names the next command; while a run is training it says `training`
— wait — and `nmt-forge run` refuses to start a second run in the same
workspace. With several exported models, the user picks the one to deploy:
`nmt-forge choose <export>/model` records it (serving a model to try it is
recorded as served, never as the choice).

**Enter it in a sovereign contest.** A contest's declarative lane (Lane A,
`mt-eval contest submit-model`) takes a model as data: weights, config and
tokenizer. `export/model/DEPLOY.md` §6 names exactly those files (never
`forge-model.json` — this model's scores on your test set and local paths —
nor `DEPLOY.md` or `champollion-plugin/`; `submit-model` leaves all three
out by itself), the architecture, and the parameter
count the lane checks, read from the weights file's header, with the
command. The contest side: [Run a Sovereign
Contest](https://champollion.dev/docs/network/sovereignty/run-a-sovereign-contest#lane-a--declarative-model-preferred-for-standard-nmt).

**A private test set stays private.** Mark it the way a data steward does —
`champollion network register-corpus --tier local-only --role test`, or a sidecar next to the
file: `echo '{"transmission": "local-only"}' > teacher-test.tsv.champollion.json`
— and forge, like `mt-eval`, never prints its sentences. `leak-audit` names
the rows that matched it by line number (a row that matched a test answer
IS most of that answer), says once why, and shows the text only with
`--show-text` — for a person at the terminal; an AI agent passes whatever it
reads to its model provider. `--json` never carries sentences. The same goes
for sealed and consent-required corpora (the harness decides which), for a
training corpus that is itself marked, and for an error message that quotes
such a row (`[sentence withheld]`). Files forge writes into your folders keep
the text, and files it carves from a marked corpus (`split` sides, `leak-audit
--clean-to`, `sample`) get the same mark. When the sidecar names a registered
corpora card whose sha256 matches the file, the card's id is the set's
**dataset id** in forge's registry listing, reports, export and mt-eval
RunLog — the name `mt-eval` runs on the file use — with your `registry add`
name (`project-test`) kept beside it.

**Model presets** (`nmt-forge init --model …`, written out as explicit numbers
in `config.json`):

| preset | what it is | needs | honest expectation |
|---|---|---|---|
| `cpu-tiny` (default) | a ~6M-parameter Marian trained from scratch; BPE vocabulary fit on the TRAIN rows only | a CPU, no download — 1,600 pairs train in ~2–3 minutes on a laptop | weak: on 1–2k pairs, chrF++ roughly 5–30 (the top end only for highly templated data) — your data's phrases and templates, not general translation |
| `cpu-finetune --base <hf-id>` | fine-tune a small pretrained Marian/opus-mt (you name a RELATED pair) | a CPU, ~300 MB download | usually better than cpu-tiny when a related pair exists — measure it, don't assume |
| `nllb-600m` | NLLB-200 distilled 600M + LoRA | a GPU, ~2.5 GB download | the strongest start; the wall-clock gate refuses it on a CPU in minutes |

The point of `cpu-tiny` is not the score: it makes the WHOLE loop real — the
fence, the audits, the preregistered test, an exportable model the CLI can
call — so a better model later drops into the same project and is measured
the same way.

## Sixty seconds, end to end

```bash
# carve an honest split: pairs sharing a source OR target stay together
$ nmt-forge split corpus.jsonl --test 150 --dev 42 --seed 42 \
      --out data/split --register textbook
split corpus.jsonl: 1240 rows in 1187 share-groups (largest 4)
  train 1048 · dev 42 · test 150  → data/split/
  verified: 0 shared canonical source/target keys across sides

# train: one command, config-hashed, dev-fenced
$ nmt-forge run config.json
dev report (95% CIs — there is no bare-score rendering):
n=42 · set=textbook-dev
  chrf++       44.31  [41.20, 47.15] 95% CI

# score the test set? not without predictions written down first
$ nmt-forge score --eval-set textbook-test --hyps decoded.txt
[preregister] no preregistration for eval set 'textbook-test' ...
  why: results looked at without written-down expectations become post-hoc stories
  fix: write one FIRST: ... — then score

$ nmt-forge prereg template --out preds.json     # the ONE format; edit it
$ nmt-forge prereg new e2 --eval-set textbook-test --predictions preds.json
$ nmt-forge score --eval-set textbook-test --hyps decoded.txt
  chrf++       46.02  [43.11, 48.87] 95% CI
```

That's the whole philosophy: the honest path is the easy path, and the
dishonest paths are closed with actionable messages.

**Agents:** every command takes `--json` — exactly one JSON document on
stdout, refusals as `{"error": {…, "why", "fix"}}` with exit 2. Shapes:
[docs/JSON_OUTPUT.md](docs/JSON_OUTPUT.md). Call `nmt-forge status --json`
first, always.

## Any language: start from the card

forge is general-purpose across all ~7,900 SSOT language cards. `discover`
answers "what does this language actually have?" honestly (absence on a card
= **unknown**, never zero), and `init` scaffolds a project from it:

```bash
$ nmt-forge discover nav
Navajo (nav) · ltr
WHAT THE CARD SAYS EXISTS (absence = unknown, not zero):
  OPUS: 5 corpora, 36533 aligned pairs
  unknown (card is silent): analyzers, dictionaries, eval datasets
THE ASSET LADDER — what this language can do TODAY:
  ✓ rung 1: parallel text → train with every guard (no pack needed)
  ? rung 2: monolingual text → the tagged backtranslation lane
  ? rung 3: dictionary (+ grammar) → a cited template pack is worth building
  ? rung 4: morphological analyzer → round-trip-VERIFIED synthesis
  ? rung 5: LYSS referee → the language's own metric in selection
  note: no analyzer on the card → synthesis is off the menu until one
  exists; every guard and the training loop work regardless

$ nmt-forge init nav --dir my-navajo-mt
# → .forge/ workspace + starter config.json + NEXT_STEPS.md (the agent brief)

# a language the index doesn't have yet? still trainable — nothing invented:
$ nmt-forge init qzx --no-card --name "My Language" --dir my-mt
```

A rich card wires more for free: Plains Cree's card carries its eval-dataset
ids (cross-checked against the mt-eval registry — all flagged NEVER TRAIN ON
THIS) and its LYSS referee, so `discover crk` emits ready-to-paste
`--plugin champollion_lyss...` lanes. The referee is an OPTIONAL add-on with
its own license, never a requirement: `init crk` wires its lanes into the
starter config only when the package is installed, and otherwise names it in
NEXT_STEPS.md — the config passes its own preflight on a plain install. Same
tool, no special cases — the card decides.

## What's inside (start here, dig later)

| you want to… | use | it kills the mistake of… |
|---|---|---|
| split a corpus | `split` / `verify-split` | test answers hiding in training via shared sources/targets |
| pick checkpoints | the run's **dev-fence** | the test set choosing the model — and training on the dev set's own rows (a file written before the split, such as an early twin-free corpus, is refused with the re-audit that fixes it) |
| screen any corpus/harvest | `leak-audit` | training on eval text (exact, reworded, or whole-file) — while KEEPING template siblings ("I see the dog" vs "I see the cat") and similar-prompt/different-answer pairs (an *identical* prompt is dropped whatever its answer), and saying which is which, with examples (by line number only for a private — local-only, sealed, consent-required — set or corpus); `--drop-test-twins` also drops the near-twins of a FIXED test set when they would turn its score into recall |
| generate training data | `synth` + a language pack | unverified forms, uncited templates, invisible gaps |
| sample synthetic data | `sample` | two template kinds hogging half the signal |
| report numbers | `score` / `compare` / `evaluate` | scores with no error bars, no preregistration |
| hand the model on | `export` / `serve` | a result nobody else can compare (mt-eval TestReport) or deploy (champollion api / OpenAI-compatible endpoint) |
| see how spent an eval set is | `ledger show` | invisible adaptive use; sealed sets are one-shot |

Each guard is also a library call under `nmt_forge.guards.*`. The full
mistake→mechanism map, with the measured numbers behind each guard, is in
[DESIGN.md](DESIGN.md).

## Language packs plug in — forge ships none

forge is general-purpose; language-specific code lives in the language's own
home and plugs in through the pack interface (analyzer + dictionary adapter +
orthography + **grammar-cited** templates + checklist):

```bash
# from any checkout (no install needed):
nmt-forge synth nmt_forge_crk.pack:get_pack --out data/synth.jsonl
# or, once the pack's package is installed (entry point):  nmt-forge synth crk
```

The engine enforces the **emit law** on every pack: every generated word must
round-trip through the language's analyzer, every closed-class literal must
be cited, every filter is named and counted, and every row is stamped
`synthetic: true` — which is exactly why the registry refuses synthetic rows
in test sets (tests are real data only). The Plains Cree reference pack lives
in crk-translate (`nmt_forge_crk`); FST models and dictionaries stay
**separate, user-fetched tools** under their own licenses — never bundled.

## The full harness referee stack — neural metrics included

forge speaks everything the eval harness speaks, by delegation: the
deterministic lanes (chrF++/BLEU/exact-match), the **neural lanes** —
COMET, COMET-QE, MetricX — and the harness's own plugin discovery (FST
word-validity, behavioral linters, card-declared metrics):

```bash
nmt-forge score --eval-set project-test --hyps decoded.txt \
    --metric chrf++ --metric comet --target-lang iku --card-plugins iku
  chrf++    32.10  [29.4, 34.9] 95% CI
  comet      0.71  [ 0.66,  0.75] 95% CI
  metricx    3.20  [ 2.9,  3.6] 95% CI  (lower = better)
```

Neural inference runs **once**; the bootstrap re-averages cached per-entry
scores (the harness's own CI pattern). Missing extras report an install fix
— never a fabricated number — and checkpoint selection *refuses* rather
than silently switching metrics. Direction is first-class: MetricX's
lower-is-better rides the score through rendering, selection, and A/B
winners. And `discover` tells you which lane to **believe**, from the WMT
meta-evaluations:

```
$ nmt-forge discover iku
  metric trust (Eskimo-Aleut, WMT meta-eval): comet_score r=0.86, ... bleu r=0.163
```

— for Inuktitut, BLEU barely tracks human judgment while COMET does; for
other families it's the reverse; for most low-resource families the honest
answer is UNMEASURED. forge surfaces that before you select on anything.

## LYSS referees plug in too

LYSS eval-standard linters (harness `MetricPlugin` protocol — Plains Cree
today, more languages later) drop into every scoring surface:

```bash
nmt-forge score --eval-set textbook-test --hyps decoded.txt \
    --plugin champollion_lyss.crk.metrics:CrkLinterMetric
  chrf++                            46.02  [43.11, 48.87] 95% CI
  crk_linter:equivalent_match_rate   0.31  [ 0.24,  0.38] 95% CI
  crk_linter · variant_class_counts: LONG_VOWEL_MACRON=9, WORD_ORDER=3
```

Every numeric aggregate a plugin reports gets a bootstrap CI; per-entry
computation runs once (a thousand resamples never re-run an FST); a plugin
that says `available: false` is shown unavailable, never fabricated. And
checkpoint selection can use the language's own referee:

```jsonc
"selection": {"metric": "generation:crk_linter:equivalent_match_rate",
              "plugins": ["champollion_lyss.crk.metrics:CrkLinterMetric"]}
```

## A worked example: the half-epoch death

The first CLEAN-protocol Cree run — honest group-disjoint dev, leak-audited
mix — died at epoch 0.52 of a 115,000-step plan. Mechanism: the mix was
97.5% tagged synthetic; early in training the model fits the synthetic
mass, so dev loss on the 42 *real* dev sentences bottomed at step ~8k and
drifted upward, and patience-6 declared convergence at half an epoch. Every
earlier run had hidden this bug by (illegitimately) using the test set as
dev. **The honest setup is what surfaced it — that's the point of the
suite.**

forge makes the fix the default, not a flag (`schedule-sanity`):

```
[schedule-sanity] train: regime=synthetic-heavy (auto-detected), floor=38,205 of 114,614 planned steps
[schedule-sanity] early stopping ASKED to stop at step 14,000 but the
  schedule floor (38,205) held training, because: the mix is 97.5% synthetic
  and the dev set is REAL: early in training the model fits the synthetic
  mass, so dev loss on real sentences bottoms fast and drifts up — that
  pattern is EXPECTED, not convergence …
```

The floor is **derived** from the config (max of one full pass over the mix
and 30% of planned steps, capped at 60%) and activates only in the
`synthetic-heavy` regime — auto-detected from the mix, overridable with one
word (`"regime": "balanced"`), never ten flags. Every intervention prints
the dev-loss trajectory and the why; nobody should diagnose this from raw
logs again.

## Training defaults that encode the ledger

Tagged synthetic lanes (Caswell et al. 2019) with gold untagged; gold
upweighting with the **exposure math written into the manifest**; per-kind
sampling caps; curriculum stages; a backtranslation lane that leak-audits
mono text *before* spending translation; generation-headroom checks; and a
do-not-train gate — datasets the mt-eval registry protects never enter a mix.
Details and the config schema: [DESIGN.md](DESIGN.md) §6.

## What forge refuses to be

Not an evaluator (the harness scores), not a corpus host (manifests are
content-free — hashes and counts, never text), not a language-card writer,
not a leaderboard.

## License

PolyForm Noncommercial 1.0.0 — source-available, free for noncommercial use;
using it for a commercial purpose is not covered by this license (relicensed
from AGPL-3.0-or-later on 2026-08-17, before any release shipped). Who is
covered, in plain words with examples: [Who may use this](https://champollion.dev/docs/getting-started/who-may-use-this) (a summary,
not legal advice; [LICENSE](LICENSE) governs). The harness it uses stays
open-source AGPL-3.0-or-later. Analyzer models and
dictionaries consumed by packs are upstream artifacts fetched by the user
under the upstream's terms.
