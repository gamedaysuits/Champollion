---
sidebar_position: 8
title: 'Queue Construction Specification'
slug: '/network/specifications/queue-construction'
description: 'The transparent formula behind the community-compute queue: expected-chain-value ranking, every component published, every rank re-derivable by hand.'
related:
  - label: "Why the Queue Is Built This Way"
    to: /docs/network/perspectives/why-the-queue
    kind: position
    note: "The philosophy behind this formula"
  - label: "Contributing Compute"
    to: /docs/network/getting-started/contributing-compute
    kind: guide
    note: "How to actually run queue items"
  - label: "Scoring Specification"
    to: /docs/network/specifications/scoring
    kind: spec
  - label: "Corpus Design Framework"
    to: /docs/network/specifications/corpus-design
    kind: spec
    note: "Small-corpus floors and noise thresholds the formula inherits"
---

# Queue Construction Specification

**Formula version: `ecv-v3` (expected chain value with bridge
reliability).** This document is the normative definition of how
[champollion.dev/queue.json](https://champollion.dev/queue.json) is
ordered. The implementation
(`arena/scripts/generate_sweep_queue.py` in the public harness repo)
mirrors this page section by section; the queue's metadata echoes the
exact parameter values used at generation time, and **every item
carries its full formula breakdown**, so any rank can be re-derived by
hand from the published JSON alone. If this page and the queue ever
disagree, that is a bug — please report it.

**The queue today, in one paragraph.** The public queue carries both LLM
items (naive and coached prompting conditions) and MT-service engine items
on one board, ranked by the survey ordering (`map`, §2.2): first light
across pairs, languages, and families per dollar, with a first-reading
boost for languages that have never been measured (§2.2), budget tiers
published in the preview (§2.1.1), and the complete ranking served from
the database (the static file carries the top slice when the full ranking
outgrows its size cap, and says so). The sections below are the normative
definition, kept with their dated decision history — the metadata on any
served queue names the exact parameters that ranked it.

> **v3 (2026-06-13).** Every edge is now a *bridge* with two numbers —
> quality and reliability — and the chain matrix runs on their product
> (§1.5). 62 single-word vocabulary items run once can no longer look
> like a path; replications, bigger corpora, richer corpora, and
> tighter confidence intervals all carry priced value. v2 queues
> (quality-only) remain interpretable via their own metadata.

## 1. The objective: a quality-weighted mesh

The mission is *every language into every language by measured
individual pair chains*. A translation between two languages with no
direct benchmark is served by **chaining** benchmarked pairs
(X→pivot→Y), so what the benchmark is worth is not its number of
corpora but the **chain capacity of its graph**.

**Definitions.** Let the *benchmark graph* have one node per language
and, for every language pair with at least one published, non-disqualified
run, an **edge strength**

```
s(e) = (best published corpus-level chrF++ on that pair) / 100   ∈ [0, 1]
```

Corpus-level chrF++ is the canonical published number (see the
[Scoring Specification](/docs/network/specifications/scoring)); *best* because
a chain would route through the best demonstrated system per hop.
Pairs with no published runs have s(e) = 0.

The **estimated chain strength** of a path P between two languages is

```
strength(P) = λ^(|P|−1) · Π_{e ∈ P} s(e)
```

— edge qualities compose multiplicatively, and each *junction* (each
intermediate pivot) costs an additional fidelity factor **λ < 1**.
Both choices are grounded in the pivot-translation literature:
translation through a pivot reliably loses quality relative to direct
translation, beyond what naive composition suggests (Utiyama & Isahara
2007; Wu & Wang 2007), the size of the loss depends on the pivot
chosen (Paul et al. 2009), and building *direct* non-English-centric
pairs measurably beats English-pivoting at scale — by ~10 BLEU in
M2M-100's many-to-many setting (Fan et al. 2021). λ is the formula's
standing reminder that an estimated chain is not a measurement: only a
direct run removes the discount.

The **best-chain matrix** and the **mesh objective** are then

```
Q(u,v) = max over paths P from u to v of strength(P)      (1 if u = v, 0 if disconnected)

Φ = mean over ordered language pairs (u ≠ v) of Q(u,v)    ∈ [0, 1]
```

Q is computed exactly as a shortest-path problem under the standard
log transform (edge weight −ln(λ·s(e)) ≥ 0, Dijkstra, then
Q = exp(−d)/λ). Φ is the [Latora & Marchiori
(2001)](https://arxiv.org/abs/cond-mat/0101396) *global efficiency*
construction with the 1/distance kernel replaced by multiplicative
chain fidelity — the natural kernel when edges carry per-hop quality
retention rather than unit lengths. (Queue v1 ranked by unweighted
global efficiency gain — the special case of this family where all
you know about an edge is whether it exists.)

### 1.5 Reliability: a bridge is (q, r)

A flashy score on a tiny, thin, never-replicated corpus is not a
bridge. v3 therefore splits every measured edge into:

```
quality      q(e)   = best published corpus-level chrF++ / 100
reliability  r(e)   = f_size · f_rich · f_conf · f_repl        ∈ [0, 1]
effective    s_eff(e) = q(e) · r(e)        ← what chains compose over
```

| Factor | Definition | Full credit at | Anchor |
|---|---|---|---|
| `f_size` | min(1, n/100), n = evaluated entries of the best run | 100 entries | the [corpus-design](/docs/network/specifications/corpus-design) significance floor; Koehn (2004) validates bootstrap testing on ~300-sentence sets — even 300 is "small", so size discounts reliability rather than merely gating display |
| `f_rich` | min(1, L̄/5), L̄ = mean *effective* source length | 5 effective words | AmericasNLP (Mager et al. 2021) adopted chrF because word-level units break on rich morphology; Mager et al. (2022) document whitespace tokens as the wrong unit |
| `f_conf` | min(1, 5/h), h = the best run's chrF 95% CI half-width (proxy `50/√n` when unpublished) | CI ≤ ±5 chrF | the noise floor below which deltas are indistinguishable on small corpora; Kocmi et al. (2021) show within-CI deltas frequently contradict human preference |
| `f_repl` | min(1, runs/2) | 2 published runs | Marie, Fujita & Rubino (2021), meta-evaluating 769 papers: unreplicated single comparisons are the field's documented credibility failure |

**Effective length** is measured in content units, not whitespace
words: `L̄ = mean source chars / c(L)`, where the *character economy*
`c(L)` is the median characters on language L's side per English word
on the aligned side, measured from this project's own parallel corpora
(7,400+ aligned entries at v3 ship time: cmn 1.6, jpn 2.3, kor 2.6;
eng baseline 5.0; deu 6.0; crk 4.7 — polysynthetic words priced by the
content they carry). No typology lookup tables; the estimate sharpens
as corpora grow; languages without eng-paired data use the default
economy. Stamped per corpus in the registry (`richness` block).

**Bridge tiers** (display vocabulary): **established** — n ≥ 100,
L̄ ≥ 5, h ≤ 5, runs ≥ 2; **provisional** — measured but failing any;
**registered** — no published runs. A chain claim ("you can get from X
to Y") is only as strong as its weakest hop's tier, and the mesh
visualization shows reliability as edge opacity.

**Worked checks** (from the checked-in verification script, run before
v3 shipped): *62 single-word vocabulary items, one run* → r ≈ **0.04**
(not a path); *200 sentences, ±3 CI, 3 runs* → r = **1.00**; a
101-entry Japanese corpus whose naive word count is 1.0 (script
artifact) rehabilitates to 6.5 effective words and full `f_rich`.
Bounds and per-factor monotonicity are property-tested.

**Value of a run under v3.** A run can improve a bridge two ways, and
ΔΦ takes the better of: **(a)** it becomes the edge's best run —
`ŝ_eff = predicted quality × r(its corpus's n, richness, CI proxy,
runs+1)`; or **(b)** it merely replicates — the current best stays,
`f_repl` rises. Replication on a single-run edge is therefore real,
priced value, and a bigger or richer corpus on a measured pair
outranks a re-run of the small one. Items expose `edge_quality`,
`edge_reliability`, `edge_tier`, `effective_strength`,
`post_run_reliability`, and `predicted_effective` alongside the v2
prediction fields.

**What Φ is not.** Φ is the queue's internal prioritization currency,
not a capability claim. Its inputs are development-set scores with all
the caveats of the [Corpus Design
Framework](/docs/network/specifications/corpus-design): possible training-data
contamination makes each score an upper bound, chrF++ values are not
strictly comparable across languages, and small corpora carry wide
confidence intervals. The formula only needs Φ to *order runs by
usefulness*; it is never published as a quality guarantee.

## 2. The decision problem

The queue's open items are every (corpus, model, condition)
combination that is eligible (development split, redistributable
license, not quarantined, transmission-eligible, and
**benchmark-resolvable** — see the language-identity gate in §2.2) and
not yet on the leaderboard. Identical re-runs of covered combinations
are excluded — run-card fingerprints dedupe them on publish — but new
models or conditions on an already-measured pair remain open items.

Contributed compute is a budget. Choosing which open item to run next so
that the mesh improves fastest is a budgeted coverage-style
maximization, and the canonical approach is greedy selection by
**marginal value per unit cost**: for monotone submodular objectives
the greedy rule carries the classic (1 − 1/e) guarantee (Nemhauser,
Wolsey & Fisher 1978), and its benefit/cost-ratio form is the standard
algorithm under budgets (Khuller, Moss & Naor 1999). We use the
ratio rule as our ranking principle. (Honesty note: our objective has
coverage-like diminishing returns in its deterministic core, but the
stochastic prediction layer means we cite the greedy guarantee as
*motivation*, not as a theorem about this exact system.)

```
ECV(item) = ΔΦ(item) / max(est_cost_usd, COST_FLOOR)
```

Items are ranked by ECV descending. Ties break: naive before coached,
cheaper first, then item id.

### 2.1 Ranking remedies — 2026-07-12

Four adjustments layered on the greedy ECV rule, each echoed in the
queue's metadata (`priority_parameters.contamination_ecv_factors`,
`priority_parameters.frontier_interleave`, `metadata.preview_policy`):

1. **Contamination multiplier.** Each item's ECV is multiplied by a
   factor from its corpus's contamination grade: **LOW 1.0 / MEDIUM
   0.4 / HIGH 0.1**, with an unknown or missing grade treated as
   MEDIUM (never assume clean). Rationale: the clean chain graph only
   admits LOW-contamination edges, so a non-LOW run cannot enter it
   and must not outrank clean-mesh work at equal cost. Non-LOW items
   stay queued — relative-lane comparisons are real value — they just
   rank behind clean work.
2. **Frontier interleave.** After the greedy sort, every 5th priority
   slot carries the highest-ranked not-yet-placed item from the
   frontier-model set (maintained as data in the generator and echoed
   in the metadata), so frontier evidence reaches the prediction
   priors early instead of only after the cheap tiers saturate. Pure
   reordering: nothing is dropped or duplicated, a frontier item that
   earned a natural slot keeps it, and priorities are numbered from
   the woven order — the published ranking is the truth.
3. **Preview source-hub cap.** The top-25 public preview shows at
   most **6** items sharing one source language, so a single
   well-resourced hub cannot monopolize the shop window. Over-cap
   items keep their real priority in the full queue; the preview
   simply pulls the next eligible item in ranking order.
4. **Preview constructed-language exclusion.** Items whose source or
   target is a constructed language are skipped by the preview. The
   determination is card-family-driven (Glottolog's Artificial
   Language bucket, read from the language cards — never a hardcoded
   language set), and the derived code list is published in
   `metadata.preview_policy` so server-side refreshes apply the same
   selection.

(3) and (4) are **presentation policy only**: the full `queue.json`,
its ranking, and its priorities are unaffected.

### 2.1.1 Budget tiers — "what does $X buy?" (2026-08-24)

`queue-preview.json` carries a `budget_tiers` array summarizing, for
budgets of **$1 / $10 / $100 / $1000**, the greedy affordable prefix of
the published ranking: walk the items in priority order, take each item
whose estimated cost still fits the budget, skip the ones that don't,
and keep filling with later cheaper items. Each tier reports how many
items that buys, their total estimated cost, how many distinct language
pairs and models they touch, and how deep in the ranking the budget
reaches (`max_priority`).

Because the ranking is already marginal-value-per-cost (§2), the greedy
affordable prefix **is** the allocation this model recommends for that
spend — a small contributor and a large one each read a concrete,
optimal answer from the same published ranking, rather than one list
implicitly sized to nobody. The tiers are summaries only: the
allocation itself is just the ranking, walked in order against your own
budget. Server-side refreshes recompute the tiers over the surviving
items with the identical walk (the generator and the refresh function
implement it as twins, tested on both sides).

### 2.2 Lanes and ranking modes — 2026-07-19

The served queue declares, in its own metadata, which **lane** it
carries and which **ranking mode** ordered it. The metadata is the
authority; this section defines the vocabulary.

**Lanes** (`metadata.lane`, `metadata.lane_policy`). Since 2026-08-27
the public queue carries the **both** lane: LLM items (model ×
prompting condition) **and** MT-service items (condition `engine` —
DeepL, Google Translate, Microsoft Translator, LibreTranslate, Tilde;
each enqueues only for pairs inside its own published coverage list).
The 2026-07-19 **llm** lane — LLM items only, restricted to pairs where
at least one side is outside every MT service's published coverage —
reserved service benchmarking for organizer-run campaigns that never
ran, which parked most of the catalogue; measuring the services *is*
the coverage map's backbone, so both kinds of work now sit on one
board. The coverage union (macrolanguage-aliased via the language
cards) is still echoed as `service_coverage_methods` and
`service_covered_languages`, and an llm-lane queue still reports its
excluded pairs as `pairs_dropped_fully_covered`.

**Blob size cap** (2026-08-27). The served `queue.json` is a static
file with a hard hosting ceiling, so when the full ranking outgrows it
the file carries the **top slice** of the ranking and says so in
`metadata.blob_truncated {kept, total}` — never a silent cap. The
database queue (`queue_top()` / `queue_pairs()`) always serves the
**complete** ranking and is the authoritative work-list; the preview's
pair aggregation and budget tiers describe the artifact they ship
with.

**Language-identity gate** (2026-07-19). Queue items target only
**active individual ISO 639-3 codes** — a score against a macrolanguage
("Arabic") or a collective family code ("Berber languages") would be an
unfalsifiable claim about varieties never evaluated (the same reasoning
FLORES-200/NLLB follow by coding data as `arb`/`quy`/`zsm`). Upstream
corpus labels are *resolved*, never obeyed or discarded: script tags
strip mechanically (an `eng→cmn-Hans` corpus enqueues for `eng→cmn`,
the script kept as item display metadata `source_script`/
`target_script`); cleanly retired codes follow their official ISO
successor; and a macro-labeled corpus enqueues only under a recorded,
cited **variety resolution** on its registry entry (e.g. FLORES+
documents its Quechua as `quy`). Corpora that resolve on neither path
are excluded with machine-readable reasons published in
`metadata.doctrine_exclusions` (total, per-reason counts, per-corpus
reasons) and counted in the desert ledger
(`service_landscape.invisible_reasons.corpus_excluded_by_doctrine`) —
visible exclusions, never silent drops. Historical results on
umbrella-labeled corpora keep their own honestly-named mesh node
(node `scope`: `macrolanguage` / `collective` / `retired`), never
merged into a member variety. The resolution inputs are all published:
the registry's per-entry `language_resolution` stamps carry the
resolved codes, scopes, and pin citations.

**Ranking modes** (`metadata.rank_mode`, described in
`metadata.priority_model`). Two orderings of the same items:

- **ecv** — the greedy expected-chain-value rule of §2–§3: mesh
  improvement per estimated dollar. The exploitation ordering; right
  when the board is dense enough for predictions and ΔΦ to carry
  signal.
- **map** (map-value v2) — the survey ordering:
  `MapValue = novelty × uncertainty × promise × connectivity ×
  corpus-quality × contamination ÷ cost`, assembled by an exact greedy
  trace. *Novelty* is positional first-light credit that decays as
  already-placed items occupy the same directed pair (1/(1+n)), target
  language, target family, method × target-family cell, and target ×
  domain cell (each 1/√(1+n); families from the language cards,
  domains from the corpus registry's taxonomy — a target's early
  coverage should spread across registers, not repeat the first domain
  measured). *Uncertainty* is the §3.1 prediction's back-off depth
  (pair 0.25 · target-language 0.55 · source-language 0.75 · global
  1.0) × 1/(1+published runs on the edge). *Promise* is the §3.1
  predicted strength floored at 0.25 — likely-working unknowns lead,
  and mapping a probable desert still carries value. *Connectivity*
  ranks up pairs that **link the measured network to a language it
  cannot yet reach**: an endpoint is *established* when it lies on a
  measured mesh edge (`mesh.json`, status `measured`) or inside any MT
  service's published coverage list (macrolanguage-aliased, the same
  aliasing as the lane gate above); **bridges** (exactly one
  established endpoint) and **islands** (neither) both score 1.0 —
  since 2026-08-27 a disconnected desert's first light counts fully
  (islands scored 0.5 under the 2026-07-19 grow-out-of-the-network
  sizing, which structurally demoted the deepest tail) — while
  **interior** densification (both established) scores 0.5:
  strengthening between known points is ecv mode's job. A
  **first-reading boost** (×2.0) additionally multiplies the survey
  value of any item whose source or target language has ZERO published
  measurements anywhere — the ninth principle, stated plainly: **a
  language's first reading outranks refinement**. The uncertainty
  factor alone cannot express this (it scores an unmeasured pair
  between two well-measured languages identically to a never-measured
  language); the boost makes the long tail's first light a stated
  objective rather than an emergent accident. Both factors ride
  `metadata.map_value_parameters` and apply identically inside edv's
  survey component (§2.3).

  The ninth principle's other half lives OUTSIDE the ranking: no
  ordering of existing items can reach a language with no corpus at
  all (~7,500 living individual-code languages today). The **corpus
  wish-list** (`/corpus-wishlist.json`, regenerated beside the queue)
  publishes that acquisition frontier: every living, individual-code,
  zero-corpus language ranked by its best cited speaker count —
  speaker count as the feasibility proxy for a community that could
  actually build a corpus — every count attributed to its source and
  never arbitrated.
  *Corpus-quality* is the corpus's intrinsic reliability potential
  `f_size × f_rich` from §1.5 — the survey should land on corpora that
  can bear weight, so a 62-entry single-word vocabulary list no longer
  headlines just because it is cheap; a missing richness measurement
  stays neutral (absence of measurement is not evidence of poverty).
  Cost and contamination discipline are identical to ecv. The frontier
  interleave and tie-breaks (§2.1) apply unchanged. Right for the
  survey phase: it maximizes what the *map learns* per dollar — first
  measurements across pairs, languages, families, method-cells, and
  domains, growing out of the measured network instead of scattering —
  at the deliberate price of slower mesh-strength growth.

> **map-value v2 (2026-07-19).** Two founder-directed additions to the
> survey ordering: pairs that *bridge into the measured network* now
> rank ahead of disconnected probes and interior densification, and
> corpus quality (size floor × effective richness, §1.5) plus
> per-target domain spread weigh the ranking — contributor compute
> should link established paths to new ones, on corpora good enough to
> hold the weight. License remains a **gate, not a weight**: licensing
> and transmission-channel rules decide what may be queued at all (§2,
> and the queue's `transmission_note`); among eligible corpora the
> ranking is license-blind, so restricted-but-pinned research sets —
> often a pair's only corpus — are never systematically starved. v1
> queues (novelty × uncertainty × promise only) remain interpretable
> via their own metadata.

The exact factor values used at generation ship in
`metadata.map_value_parameters`; the connectivity and quality inputs
are re-derivable from the published `mesh.json` (measured edges), the
service coverage union echoed in the metadata, and `registry.json`
(entry counts + richness). Every item additionally retains the full
ecv-v3 diagnostic fields regardless of mode, so either ordering can be
re-derived from the same artifacts.

### 2.3 Ranking mode `edv` — expected decision value (2026-08-27)

*Status: implemented, default off pending the measured comparison in
§2.3.6. The published default remains `map` until then.*

The queue buys exactly two products: the **capability map** (which
method is good at what, with honest uncertainty) and the **routing
mesh** (measured pairs that chain into routes). `edv` prices each
candidate item by how much it advances both, as a weighted portfolio:

```
EDV(item) = [ w_judge·Ĵ + w_mesh·M̂ + w_survey·Ŝ ] × contamination ÷ max(cost, COST_FLOOR)
```

with defaults `w_judge = 0.35, w_mesh = 0.25, w_survey = 0.40`
(founder-dialable; every generation echoes the weights actually used in
`metadata.edv_parameters`). The contamination factor (§2.1 remedy 1) is
applied exactly once, as the outer multiplier. Licensing and
transmission remain **gates, not weights** — eligibility is decided
before any value is computed, and the ranking is license-blind among
eligible corpora.

#### 2.3.1 Ĵ — method-judgment value

Prices how much the run advances **settling same-corpus method
comparisons** — the only cross-method claim this project's own
measurement research licenses. (The W2 difficulty-transfer study
rejected cross-language ability linking; its licensed positive result —
within-language additive method × corpus adjustment — is exactly what
this component uses. Scores are used only for ordering and separation,
never converted to acceptability probabilities, per the calibration
pilot.)

For a candidate (corpus C, method M, condition): the **contrast
partners** are the methods M′ that already have a published run on
(C, same condition). For each partner, with `sep` the score separation
in chrF points over pooled CI half-widths (recorded CIs; proxy `50/√n`
when unpublished), and `sep_pred` the same computed against the §3.1
predicted score:

| contrast state of {M, M′} on the pair | credit |
|---|---|
| **unmet** — no shared corpus yet | `JUDGE_FIRST = 1.0` |
| **contested** — shared corpora exist, all `sep < Z_DEC` | `JUDGE_CONTESTED = 0.8 × clip(sep_pred / Z_DEC, 0, 1)` |
| **decided** — some `sep ≥ Z_DEC`, n_dec corpora decide it | `JUDGE_DECIDED = 0.25 / (1 + n_dec)` |

each multiplied by `w_top = 1/√(rank(M)·rank(M′))` — deciding first
place against second is worth more than seventh against eighth. The
per-pair method ranking uses the licensed additive method × corpus fit
(alternating least squares over observed cells) when the pair has ≥2
methods × ≥2 corpora measured, else per-method best score; the fit is
**strictly per pair, never pooled across languages**. `Z_DEC = 1.96`.

A coached-vs-naive contrast on the same (C, M) adds
`JUDGE_COND = 0.5 / (1 + n_cond)`. An item's contrasts are summed with
diminishing returns (`JUDGE_GAMMA = 0.7` per additional contrast,
sorted descending), plus a **seed term**
`JUDGE_SEED = 0.25 × min(1, m_C/3) × corpus-quality` (m_C = other
lineup methods with a queue item on C) so an empty board still prefers
corpora where future comparisons can be judged — venue value, never a
borrowed score. During assembly the judge component decays
`1/(1 + items already placed on the same pair and condition lane)`.

#### 2.3.2 M̂ and Ŝ

`M̂` is §3's expected mesh gain (ΔΦ), unchanged, with the chain matrix
frozen at generation time. `Ŝ` is §2.2's map-value v2 core —
`uncertainty × promise × connectivity × corpus-quality` with the
positional novelty decay — unchanged. The predicted-score *level*
(promise) lives only in Ŝ; Ĵ uses only score *separations* — the two
components cannot double-count the same optimism.

#### 2.3.3 Normalization

The three components live on incommensurable scales, so each static
component is divided by its 95th percentile over the candidate set
(capped at `EDV_NORM_CAP = 4.0`); the three normalizers ship in
`metadata.edv_parameters.normalizers`, making every published EDV value
re-derivable from its own artifacts.

#### 2.3.4 Assembly

The ordering is the same exact lazy-greedy trace as map mode: every
order-dependent multiplier (survey novelty, judge placement decay) is
monotone non-increasing as items are placed, so a stale heap entry can
only overestimate — the lazy-greedy invariant holds and the trace
equals brute-force greedy. Frontier interleave, preview policy, and
budget tiers apply unchanged.

#### 2.3.5 Explainability

Every item retains, in its diagnostics: the contrast list it was
credited for (partner, state, predicted separation, rank weight), the
seed and decay terms, all §2.2 and §3 fields, the weights and
normalizers — the published EDV value is exactly recomputable from the
row. "How did this item get this rank?" is answerable without any
external state.

#### 2.3.6 Adoption criterion

`edv` becomes the published default only after a measured comparison
against `map` and `ecv` on the same board: within 10% of map on every
survey metric (first-light depth percentiles, distinct
pairs/languages/families at depth, marginal-new-pair rate), strictly
better on both judge metrics (contested contrasts resolved per
simulated $1k; method-ranking recovery at fixed spend), and
mesh-growth-per-dollar not worse than map. The comparison report is
published alongside the flip.

## 3. The value of one run

### 3.1 Predicting the score before running

The expected score of an unrun (pair, model, condition) is a
deliberately simple, fully-inspectable sum — a two-way main-effects
prediction plus structured optimism, every term published on the item:

```
ŝ = clip( pair_prior + model_offset + condition_offset + exploration_bonus,  0, S_CAP )
```

- **`pair_prior`** — hierarchical back-off over published strengths:
  mean on this pair → mean on this target language → mean on this
  source language → global mean → `S0_FALLBACK`. The level used is
  published as `prior_basis`.
- **`model_offset`** — how this model does relative to the *other*
  models on the same pair, averaged over all pairs where a comparison
  exists. Zero for never-seen models.
- **`condition_offset`** — the observed coached-minus-naive delta on
  the same pair (falling back to the same target language), and **zero
  otherwise**: coaching gains are real where measured but are not
  assumed to transfer across languages, so on unevidenced pairs the
  baseline-first convention holds.
- **`exploration_bonus`** — optimism in the face of uncertainty, with
  the UCB1 schedule (Auer, Cesa-Bianchi & Fischer 2002):
  `κ·sqrt(2·ln(1+N)/(1+n))`, where N is the total number of published
  scored runs and n the number on this (pair, model). Never-tried
  cells get the largest bonus; well-measured cells decay toward zero.
  We borrow the schedule — the shape that makes under-explored arms
  resurface at the right rate — not the regret theorem, which assumes
  a stationary bandit this system is not.

### 3.2 The mesh gain, in closed form

A run can only improve the mesh by raising its pair's edge to
`s' = max(s(e), ŝ)`. For a single-edge change, the new best chain
between any two languages either ignores the new edge or uses it
exactly once, so the upgraded matrix — and therefore ΔΦ — has an exact
one-line form (no re-solving the whole graph):

```
Q'(u,v) = max( Q(u,v),  E(u,a)·s'·E(b,v),  E(u,b)·s'·E(a,v) )

E(x,y) = λ·Q(x,y) for x ≠ y;  E(x,x) = 1        (edge e = {a, b})

ΔΦ = mean over ordered pairs of (Q'(u,v) − Q(u,v))
```

E is "the best chain to the new edge's endpoint, paying the junction
to splice onto it"; the two terms are the two directions of crossing
the edge. This is tested in the harness suite against brute-force
recomputation of Φ.

A prediction that cannot beat the current edge strength yields
ΔΦ = 0: the formula spends donors' money confirming the unknown, not
re-measuring the demonstrated. (The exploration bonus keeps weak or
under-sampled cells from being starved forever.)

### 3.3 What counts as evidence vs. what can be queued

Two different gates, deliberately asymmetric:

- **Evidence** comes from *every* published, non-disqualified run —
  including runs on corpora that cannot be publicly queued (e.g.
  non-commercially licensed sets). A published measurement of a pair
  is knowledge regardless of whether you could re-run it.
- **Actions** (queue items) come only from openly runnable corpora:
  development split, CC-BY-family license, fetchable by anyone.

Languages reachable only through non-queueable corpora still sit in
the graph: improving edges *around* them changes their chain values,
and the formula accounts for it.

## 4. Parameters

| Parameter | Default | Meaning and justification |
|---|---|---|
| `λ` (`lambda_junction_discount`) | **0.9** | Per-junction fidelity retention of an *estimated* chain. Encodes "direct measurement beats product-equal chaining" (Utiyama & Isahara 2007; Wu & Wang 2007; Fan et al. 2021). The ~10% haircut is a calibration choice, revisited as measured chain triangles accumulate (§6). |
| `κ` (`kappa_exploration_scale`) | **0.05** | Exploration bonus scale, in strength units. 0.05 ≡ 5 chrF++ points — the noise floor below which score differences are indistinguishable on sub-100-entry corpora ([Corpus Design §6.3](/docs/network/specifications/corpus-design)). Optimism is capped at the resolution of the instrument. |
| `S_CAP` | **0.95** | Prediction ceiling — no estimated edge may claim near-perfect fidelity it hasn't demonstrated. |
| `S0_FALLBACK` | **0.5** | Pair prior of last resort, used only when there are no published results at all (the observed global mean — ≈ 0.54 over the first 429 runs — is preferred whenever any result exists). |
| `COST_FLOOR` | **$0.01** | Floor for the ECV denominator, so near-free runs can't claim unbounded value per dollar. |
| `N_FULL` | **100** | Evaluated entries for full size credit (§1.5). |
| `L_HEALTHY` | **5.0** | Effective words for full richness credit (§1.5). |
| `H_NOISE` | **±5 chrF** | CI half-width for full confidence credit; missing CIs proxy as 50/√n (anchored to ±5 at n=100). |
| `RUNS_FULL` | **2** | Published runs for full replication credit. |

**Versioning.** Parameter or formula changes bump `formula_version`
(metadata) and this page's version line. The queue always echoes the
exact values used under `metadata.priority_parameters`, including the
current Φ, so historical queues remain interpretable. Sensitivity
runs are one flag away: `generate_sweep_queue.py --lam 0.8 --kappa 0.1`.

## 5. Worked example (live values, 2026-06-12)

Generation against 424 scored runs, 59 measured edges, 60 languages;
**Φ = 0.272**. The top item:

```
eng>fao · claude-haiku-4.5 · naive
  edge_strength        0.0      (no published eng→fao runs)
  pair_prior           0.613    basis: target-language (Faroese runs exist via dan→fao)
  model_offset        −0.114    (haiku trails other models on shared pairs)
  condition_offset     0.0      (no coaching evidence for fao)
  exploration_bonus   +0.174    (never-run cell: κ·√(2·ln 425 / 1))
  predicted_strength   0.673
  expected_mesh_gain   0.0181   (eng→fao is a near-component join)
  est_cost_usd         0.0101
  ecv_per_usd          1.79     ← rank #1
```

Read it back: Faroese is connected to the mesh only through Danish, so
a measured eng→fao edge shortcuts a huge family of chains (the large
ΔΦ); the model is predicted mid-pack on a pair like this (prior +
offset), nobody has ever tried this cell (large bonus), and the run
costs a cent. Nothing else in the queue buys more mesh per dollar.
The same arithmetic, with every input published, produces every other
rank.

## 6. Known limitations (and what would fix them)

1. **chrF++ is not comparable across languages.** Morphology moves the
   scale; an 0.5 edge into Basque is not the same achievement as into
   Dutch. Mitigation: priorities are dominated by *structure* (s = 0 →
   s > 0 transitions) where scale effects are second-order. Fix:
   per-language score normalization, or metrics with better
   cross-lingual calibration as they become available for these
   languages.
2. **The product-λ chain model is a prior, not a measurement.** It is
   directionally supported by the pivot literature but uncalibrated
   for LLM translation. Fix (planned): the mesh now contains measured
   triangles (e.g. deu→fra direct alongside deu→eng→fra), so chained
   output can be scored directly and λ fit to data instead of chosen.
3. **Contamination and dev-set status.** Edge strengths inherit every
   caveat of public development sets — treat Φ as an upper-bound
   planning signal, never a capability claim
   ([Corpus Design](/docs/network/specifications/corpus-design)).
4. **Domain blindness.** An edge measured on conversational text is
   treated as one number; chains crossing domains will degrade more
   than λ predicts.
5. **Directionality.** Edges are currently undirected (X→Y evidence
   lights X↔Y). When chain composition becomes direction-sensitive in
   practice, strengths split by direction — the formula is unchanged,
   the graph just doubles.

## 7. References

- Latora, V. & Marchiori, M. (2001). *Efficient Behavior of
  Small-World Networks.* Physical Review Letters 87, 198701.
  [arXiv:cond-mat/0101396](https://arxiv.org/abs/cond-mat/0101396)
- Auer, P., Cesa-Bianchi, N. & Fischer, P. (2002). *Finite-time
  Analysis of the Multiarmed Bandit Problem.* Machine Learning 47,
  235–256. [doi:10.1023/A:1013689704352](https://link.springer.com/article/10.1023/A:1013689704352)
- Nemhauser, G., Wolsey, L. & Fisher, M. (1978). *An Analysis of
  Approximations for Maximizing Submodular Set Functions—I.*
  Mathematical Programming 14, 265–294.
  [doi:10.1007/BF01588971](https://link.springer.com/article/10.1007/BF01588971)
- Khuller, S., Moss, A. & Naor, J. (1999). *The Budgeted Maximum
  Coverage Problem.* Information Processing Letters 70(1), 39–45.
  [doi:10.1016/S0020-0190(99)00031-9](https://dl.acm.org/doi/10.1016/S0020-0190(99)00031-9)
- Utiyama, M. & Isahara, H. (2007). *A Comparison of Pivot Methods for
  Phrase-Based Statistical Machine Translation.* HLT-NAACL 2007,
  484–491. [ACL Anthology N07-1061](https://aclanthology.org/N07-1061/)
- Wu, H. & Wang, H. (2007). *Pivot Language Approach for Phrase-Based
  Statistical Machine Translation.* ACL 2007; journal version Machine
  Translation 21(3), 165–181.
  [doi:10.1007/s10590-008-9041-6](https://link.springer.com/article/10.1007/s10590-008-9041-6)
- Paul, M., Yamamoto, H., Sumita, E. & Nakamura, S. (2009). *On the
  Importance of Pivot Language Selection for Statistical Machine
  Translation.* NAACL-HLT 2009 Short Papers, 221–224.
  [ACL Anthology N09-2056](https://aclanthology.org/N09-2056/)
- Haffari, G., Roy, M. & Sarkar, A. (2009). *Active Learning for
  Statistical Phrase-Based Machine Translation.* NAACL-HLT 2009,
  415–423. [ACL Anthology N09-1047](https://aclanthology.org/N09-1047/)
- Fan, A. et al. (2021). *Beyond English-Centric Multilingual Machine
  Translation.* Journal of Machine Learning Research 22(107), 1–48.
  [arXiv:2010.11125](https://arxiv.org/abs/2010.11125)
