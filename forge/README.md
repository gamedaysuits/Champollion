# nmt-forge

**Train NMT models without fooling yourself.** nmt-forge is a general-purpose
training suite that makes the classic training/eval mistakes — leaked test
sets, test-driven checkpoint selection, scores without error bars, structural
gaps hidden by volume — **structurally hard to commit**. It doesn't warn; it
refuses, and every refusal says what happened, why it corrupts results, and
the exact fix.

Every guard mechanizes a real, measured failure from Champollion's Plains
Cree work (the 2026-07-12 mistake ledger). Scoring is delegated entirely to
[`mt-eval`](../arena) — forge implements zero metrics.

## Sixty seconds, end to end

```bash
# carve an honest split: pairs sharing a source OR target stay together
$ nmt-forge split corpus.jsonl --test 150 --dev 42 --seed 42 \
      --out data/split --register textbook
{"verified": "0 shared canonical source/target keys across sides", ...}

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

$ nmt-forge prereg new e2 --eval-set textbook-test --predictions preds.json
$ nmt-forge score --eval-set textbook-test --hyps decoded.txt
  chrf++       46.02  [43.11, 48.87] 95% CI
```

That's the whole philosophy: the honest path is the easy path, and the
dishonest paths are closed with actionable messages.

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
```

A rich card wires more for free: Plains Cree's card carries its eval-dataset
ids (cross-checked against the mt-eval registry — all flagged NEVER TRAIN ON
THIS) and its LYSS referee, so `discover crk` emits ready-to-paste
`--plugin champollion_lyss...` lanes and `init crk` pre-wires them into the
starter config. Same tool, no special cases — the card decides.

## What's inside (start here, dig later)

| you want to… | use | it kills the mistake of… |
|---|---|---|
| split a corpus | `split` / `verify-split` | test answers hiding in training via shared sources/targets |
| pick checkpoints | the run's **dev-fence** | the test set choosing the model |
| screen any corpus/harvest | `leak-audit` | training on eval text (exact, reworded, or whole-file) |
| generate training data | `synth` + a language pack | unverified forms, uncited templates, invisible gaps |
| sample synthetic data | `sample` | two template kinds hogging half the signal |
| report numbers | `score` / `compare` | scores with no error bars, no preregistration |
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
commercial use requires permission (relicensed from AGPL-3.0-or-later on
2026-08-17, before any release shipped). The harness it links stays
open-source AGPL-3.0-or-later. Analyzer models and
dictionaries consumed by packs are upstream artifacts fetched by the user
under the upstream's terms.
