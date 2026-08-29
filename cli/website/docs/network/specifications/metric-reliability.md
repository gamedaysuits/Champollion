---
sidebar_position: 6
title: 'Metric Reliability Specification'
slug: '/network/specifications/metric-reliability'
related:
  - label: "Scoring Specification"
    to: /docs/network/specifications/scoring
    kind: spec
    note: "What each metric measures and how the harness computes it"
  - label: "Statistical Significance Testing"
    to: /docs/network/specifications/significance
    kind: spec
    note: "When a score difference actually means something"
  - label: "Benchmark Specification"
    to: /docs/network/specifications/benchmark
    kind: spec
  - label: "Eval Harness v2.0"
    to: /docs/network/specifications/harness
    kind: spec
---

# Metric Reliability Specification

> **Executive Summary.** A benchmark score is only as meaningful as the metric
> behind it — and automatic metrics do not agree with human judgment equally
> well across languages. This document specifies how Champollion measures
> **metric reliability**: for each language family, how strongly each automatic
> metric (BLEU, spBLEU, chrF, chrF++, COMET, MetricX) correlates with human
> quality judgments, computed from the WMT Metrics shared-task archives
> (2019–2025). The output is a published, machine-readable evidence artifact
> that the harness, the CLI, and the MCP server consult before presenting any
> score as trustworthy. To our knowledge no other evaluation infrastructure
> publishes this evidence per language; it is what turns "we ran a metric"
> into "here is how much to believe it."
>
> **Scope.** This document defines *what the reliability evidence is, where it
> comes from, exactly how it is computed, and what it deliberately excludes*.
> Metric definitions themselves live in the
> [Scoring Specification](/docs/network/specifications/scoring); statistical
> testing of score differences lives in
> [Significance](/docs/network/specifications/significance). The importer that
> regenerates the artifact is `arena/scripts/import_wmt_metaeval.py` in the
> harness repository — the code is the final word on implementation detail,
> and it is open for review.

---

## 1. The problem this solves

Machine-translation quality is, in the end, a human judgment. Automatic
metrics exist because human evaluation is slow and expensive; every automatic
score is a *proxy* for what a competent bilingual would say. The entire
field's shorthand — "System A beats System B by 2 BLEU" — silently assumes
the proxy is faithful.

That assumption has been tested for years by the WMT Metrics shared task, but
almost always *in aggregate*: metrics are ranked by average correlation with
human judgment across whatever language pairs that year's campaign covered —
mostly high-resource European pairs plus Chinese and Japanese. The per-language
detail exists in the raw data and in per-year findings papers, but it is not
published anywhere as a queryable, per-language-family evidence layer that an
evaluation pipeline can consult.

The detail matters enormously for low-resource and morphologically rich
languages. Two findings from our own import illustrate the stakes
(§7 has the full table):

- **English→Inuktitut (wmt20).** BLEU's system-level correlation with human
  judgment is **+0.16** — essentially uninformative. chrF manages +0.35.
  COMET reaches +0.86. A leaderboard ranked by BLEU for this pair would be
  ranking noise; the same leaderboard ranked by COMET carries signal.
- **English→Maasai (wmt25).** The inverse failure: MetricX-25's correlation
  is **−0.09** — a state-of-the-art *learned* metric scoring a language
  absent from its training gives numbers uncorrelated with human judgment,
  while computed chrF++ (a "dumb" string metric with no training data to
  lack) manages +0.50.

Neither failure mode is visible in a global average, and they point in
opposite directions: for one language the learned metric is the only usable
one; for another it is the only *unusable* one. Any infrastructure that
scores hundreds of language pairs with a fixed metric suite — as Champollion
does — owes its users this evidence.

## 2. Definitions

The definitions below are the minimum needed to read the rest of the
document precisely. Readers familiar with MT evaluation can skim to §3.

**Automatic metric.** A function from (system output, reference translation,
and sometimes the source) to a number. *String metrics* — BLEU, spBLEU,
chrF, chrF++ — compare surface overlap between output and reference.
*Learned metrics* — COMET, MetricX, BLEURT — are neural models trained on
past human judgments to predict quality. Canonical identifiers for all
metrics in this document come from Champollion's metric registry
(`shared/metric-registry.json`): `bleu`, `spbleu`, `chrf_plain`,
`chrf_plus_plus`, `comet_score`, `metricx_score`.

**Human judgment protocols.** The WMT campaigns collected human quality
scores under several protocols, which this artifact keeps distinct:

- **DA (Direct Assessment)** — crowdworkers or researchers rate a
  translation 0–100. *z-normalized* DA (written `wmt-z`) standardizes each
  rater's scores to mean 0, variance 1, removing rater-generosity effects.
- **DA+SQM** (`da-sqm`, `wmt`) — DA collected on a 0–100 scale annotated
  with scalar quality metric anchor descriptions; used from WMT22.
- **MQM (Multidimensional Quality Metrics)** (`mqm`) — professional
  annotators mark and classify individual error spans with severities; the
  weighted error count becomes a segment score. Slow, expensive, and the
  most trusted signal available; collected only for a few high-resource
  pairs per year (the annotations originate from Google's
  `wmt-mqm-human-evaluation` releases).
- **ESA (Error Span Annotation)** (`esa`, `esa-merged`) — WMT24's and
  WMT25's protocol combining error-span marking with a scalar rating;
  cheaper than MQM, more informative than DA.

**Meta-evaluation.** Evaluating the evaluators: measuring how well each
automatic metric's scores agree with the human scores over the same
translations. Agreement is measured at two levels:

- **System level** (`sys`): each MT system gets one aggregate human score
  and one aggregate metric score for a test set; agreement is computed
  across systems. This asks: *does the metric rank whole systems the way
  humans do?* — the question a leaderboard cares about.
- **Segment level** (`seg`): agreement across individual (system, sentence)
  pairs. This asks: *can the metric tell a good sentence from a bad one?* —
  the question quality estimation and data filtering care about. It is much
  harder, and correlations are systematically lower.

**Correlation statistics.** Four standard statistics, defined here exactly
as computed:

- **Pearson's r** — linear correlation between the two score vectors.
- **Spearman's ρ** — Pearson's r computed on average ranks; measures
  monotonic agreement, insensitive to scale.
- **Kendall's τ-b** — among all pairs of items, the (tie-adjusted) excess
  of concordantly ordered pairs over discordantly ordered ones. We use the
  standard tie-adjusted τ-b formulation (equivalent to `scipy.stats.kendalltau`;
  our implementation is dependency-free and is cross-checked against a
  brute-force reference in the test suite).
- **Pairwise ranking accuracy** (system level only) — of all system pairs
  that humans order *strictly*, the fraction the metric orders the same
  way, with a metric tie counted as a failure to reproduce the order. This
  is the accuracy statistic of Kocmi et al. (2021), which recent WMT
  campaigns use as their headline system-level number.

**Language family.** The genealogical grouping of the *target* language
(the language being translated into), as recorded in Champollion's language
database (`languages.family`, derived from Glottolog). §5 discusses why the
target side, and what a family can and cannot proxy for.

## 3. Data

### 3.1 Sources, pinned

| Source | What it provides | Pin |
|---|---|---|
| `google-research/mt-metrics-eval` (data archive v2) | Human scores, metric scores, system outputs, sources, and references for every WMT Metrics-task test set, wmt19–wmt25 | code commit `68a481ae…`; data tarball `mt-metrics-eval-v2.tgz` from `data.statmt.org`, pinned **sha256 `6708eec9aaa8a9deca5e370bdd0e23db4881aeca129f29d5281575eaa66c7e10`**, ETag `36579a46-64ff8bb1d3080`, Last-Modified 2026-04-21, 911,710,790 bytes |
| `google/wmt-mqm-human-evaluation` | The upstream origin of the MQM expert annotations that mt-metrics-eval redistributes in merged form; Apache-2.0 | commit `7fadea28…` |

Two data-integrity facts shape the pinning discipline. First, **the data
tarball is not immutable** — it is republished in place as campaigns are
added — so the artifact records the checksum, ETag, and timestamp of the
exact copy the numbers were computed from, and the importer refuses to run
without a checksum. Second, the toolkit's Apache-2.0 grant covers its *code*;
**the bundled human-judgment and test-set data carries no explicit license
statement**. Consequences of that are in §8.

The archive contents (≈4.2 GB uncompressed: human judgments, references,
and full system outputs for every campaign) are **never stored in this
repository or redistributed by Champollion**. They are fetched from source
into a local cache; only derived correlation numbers are published. This is
the same fetch-from-source posture every Champollion benchmark follows.

### 3.2 What each campaign contributes

| Test set | Pairs with human judgments | Human protocol(s) used here |
|---|---|---|
| wmt19 | 18 | DA-z |
| wmt20 | 18 (incl. en→iu, en→ta, km→en, ps→en) | DA-z; MQM (en→de, zh→en) |
| wmt21.news | 16 (incl. en→ha, en→is) | DA-z; MQM (en→de, zh→en, en→ru) |
| wmt21.tedtalks | 3 | MQM |
| wmt21.flores | 4 (bn↔hi, xh↔zu) | DA-z |
| wmt22 | 17 (incl. en→liv, sah→ru, cs↔uk) | DA-SQM; MQM (en→de, zh→en, en→ru) |
| wmt23 | 9 (incl. he→en) | DA-SQM; MQM |
| wmt23.sent | 1 | MQM |
| wmt24 | 11 (incl. en→is, en→hi) | ESA; MQM |
| wmt25 | 16 (incl. en→bho, en→mas, en→ar) | ESA-merged; MQM |

**Excluded: wmt24pp.** The WMT24++ release extends coverage to 55 language
pairs but ships *references and system outputs only* — no human judgments —
so no correlation can be computed from it. It is listed in the artifact's
exclusion ledger rather than silently dropped.

## 4. Method

The importer walks each (test set, language pair) and computes one
**cell** per (human-judgment lane, level, metric):

1. **Discover human lanes.** All available human score files for the pair
   are matched against an explicit allowlist (§4.1). Rater-level files,
   raw error-span files, and document/domain-level scores are out of scope.
2. **Exclude human "systems."** WMT score files include the reference
   translations themselves as scored systems (`refA`, `refb`, `HUMAN.0`…).
   Correlating a metric against its own reference is meaningless, so any
   system matching the pair's reference set or the prefixes
   `ref`/`human`/`synthetic` is excluded throughout.
3. **Align.** System level: the intersection of systems holding both a
   human and a metric score (missing values are dropped, never coerced to
   zero). Segment level: every (system, segment) with both scores, pooled
   across systems without grouping — this is mt-metrics-eval's "no
   averaging" flattening. Ragged files (mismatched segment counts) fail the
   cell rather than aligning approximately.
4. **Compute.** Pearson, Spearman, and Kendall τ-b at both levels; pairwise
   ranking accuracy at system level. Cells with fewer than 3 aligned
   systems (sys) or fewer than 10 aligned points across at least 2 systems
   (seg), or with zero variance on either side, are recorded in the
   exclusion ledger as degenerate (20 cells in the current build).
5. **Roll up.** Per target-language family, per metric, per level: the
   n-weighted mean of each statistic across the *preferred* cells (§4.1),
   with the contributing (test set, pair) list retained so any aggregate
   can be decomposed back to its inputs.

### 4.1 Human-lane preference

Where a pair has several human-judgment lanes, all are computed, but exactly
one is flagged **preferred** and only preferred cells enter the family
roll-up — otherwise a pair judged under both MQM and DA would count twice.
The preference order is by signal quality:

```
mqm > esa-merged > esa > da-sqm > wmt-z > wmt-appraise-z > wmt-appraise > wmt > wmt-raw
```

Expert error annotation (MQM) outranks error-span protocols (ESA), which
outrank scalar direct assessment; within DA, z-normalized lanes outrank raw
ones. The non-preferred cells remain in the artifact for anyone who wants to
study protocol effects.

### 4.2 Metric identity and versioning

Learned metrics change year to year (COMET-20, COMET-22, MetricX-23/24/25
are different models), and treating them as one metric would blur exactly
the distinction meta-evaluation exists to draw. Every cell therefore records
the **verbatim upstream score name** (`COMET-22`, `MetricX-25-Ref`,
`metricx_xxl_MQM_2020`…) alongside the canonical registry id, and the
artifact lists which upstream names fed each id. Where a campaign scored a
metric against several references, the reference stream used is also
recorded per cell.

Scores are used exactly as the archive distributes them (all lanes
higher-is-better; MQM error scores and MetricX are stored negated upstream).
No sign flipping or rescaling is applied; correlations are invariant to the
scale and the orientation convention was verified empirically before import.

### 4.3 The computed chrF++ lane

chrF++ — the harness's primary string metric — was only submitted to the
wmt20 campaign, so upstream scores exist for one year. For every other test
set the importer computes chrF++ itself (sacreBLEU, `word_order=2`) from the
cached system outputs against the recorded reference. These cells are
flagged `computed: true` and their upstream name says so: a
Champollion-computed score is never presented as a WMT submission. All other
metric cells are verbatim upstream values; the only thing Champollion adds
to them is the correlation arithmetic.

## 5. Design choices, alternatives, and rationale

These are the decisions a reviewer should interrogate. Each lists what was
chosen, what was not, and why.

**Keyed by target-language family.** *Chosen:* aggregate by the family of
the language being translated *into*. *Alternatives:* per-pair only (no
aggregation); source-side or pair-level typology; typological feature
vectors instead of genealogy. *Rationale:* metric reliability is dominated
by how hard the *output* language is to score — morphological richness
inflates surface mismatch for string metrics, and training-data scarcity
degrades learned metrics — both properties of the target. Family is a crude
but universally available key (every language in Champollion's database has
one); typological features would be finer-grained but are missing or
contested for exactly the low-resource languages this exists for. The
per-pair cells are retained in full, so finer re-aggregations (by genus, by
morphological type) can be built from the artifact without re-importing.

**Flattened segment-level correlation.** *Chosen:* Kendall τ-b over the
pooled (system, segment) vector. *Alternatives:* item-grouped pairwise
accuracy with tie calibration (the acc*-eq of recent WMT findings);
per-segment τ averaged across segments. *Rationale:* the flattened
statistic is the simplest defensible choice, is exactly reproducible from
its definition without a tie-calibration procedure, and preserves the
cross-language comparability this artifact needs. It is *not* the newest
WMT headline statistic, and §8 lists that as a limitation rather than
pretending equivalence.

**Metric ties count against the metric** in pairwise accuracy. A metric
that cannot separate two systems humans separate has failed to reproduce
the human ordering; giving half credit would reward score quantization.

**Weighted means in the roll-up.** Family aggregates weight each cell by
its sample size (systems at sys level, points at seg level), so a
17-system MQM pair counts more than a 6-system DA pair. The unweighted
per-cell values remain available.

**Thresholds.** Cells need ≥3 aligned systems (a correlation over 2 points
is meaningless) or ≥10 aligned segment points over ≥2 systems. These are
floors against degenerate arithmetic, not significance claims — §8.

**Verbatim-upstream discipline.** Champollion re-computes nothing it can
cite (except the flagged chrF++ lane), because re-scored learned metrics
would introduce version and environment drift that the per-cell upstream
names exist to prevent. The trade-off — coverage gaps where a campaign
didn't run a metric — is visible as missing cells rather than papered over.

**Fail-honest exclusions.** Everything skipped (a test set without human
judgments, an unresolvable language code, a degenerate cell) is written to
an exclusion ledger with a reason. A reader of the artifact can enumerate
what is *not* in it — the property most aggregate reports lack.

## 6. The published artifact

The evidence ships as one machine-readable JSON file, tracked in the
monorepo (deliberately not bundled into the npm/PyPI packages):

```
shared/catalogue/metric-reliability.json    # the artifact (≈0.6 MB)
shared/schemas/metric-reliability.schema.json  # its JSON-Schema contract
```

Current build: **1,810 cells** (1,052 preferred) over **57 language pairs**,
**10 test sets**, **11 target families**, with 21 ledger exclusions. Top-level
blocks: pinned `sources` and `provenance` (every derived value carries
`champollion-derived` provenance naming the upstreams — the correlations are
ours, the judgments are not); `correlation_definitions` (the exact statistic
definitions of §2); `metrics` (registry id ↔ upstream names); `languages`
(code → family/genus); `families` (the roll-up); `cells` (every correlation,
fully attributed); `excluded` (the ledger).

Three consumer surfaces read it today:

- **Harness CLI:** `mt-eval recommend SRC TGT` renders a "metric trust for
  the target" block alongside method availability and cited results.
- **Champollion CLI:** `champollion recommend SRC TGT` (same payload
  contract; the artifact is monorepo-tracked, so packaged installs degrade
  to an explicit "index not available" note).
- **MCP server:** the `get_metric_reliability` tool answers "which metric
  should I trust for language X?" for any connected AI agent, including an
  explicit UNMEASURED answer for languages no WMT campaign has judged.

## 7. Results overview

System-level Pearson correlation with the preferred human lane, weighted
mean per target family (current build; segment-level numbers, Spearman, τ-b
and pairwise accuracy are in the artifact):

| Target family | Pairs | BLEU | spBLEU | chrF | chrF++ | COMET | MetricX |
|---|---|---|---|---|---|---|---|
| Afro-Asiatic | 2 | +0.88 | +0.95 | +0.85 | +0.87 | +0.67 | **−0.62** |
| Dravidian | 1 | +0.88 | — | +0.94 | +0.93 | +0.94 | — |
| Eskimo-Aleut | 1 | **+0.16** | — | +0.35 | +0.33 | **+0.86** | — |
| Indo-European | 42 | +0.75 | +0.76 | +0.79 | +0.76 | +0.81 | +0.84 |
| Japonic | 1 | +0.52 | +0.89 | +0.93 | +0.84 | +0.73 | +0.74 |
| Koreanic | 1 | +0.89 | +0.87 | +0.87 | +0.88 | +0.55 | +0.77 |
| Niger-Congo | 2 | +0.94 | — | +1.00 | +1.00 | +1.00 | — |
| Nilotic | 1 | — | — | — | +0.50 | — | **−0.09** |
| Sino-Tibetan | 2 | +0.49 | +0.68 | +0.68 | +0.62 | +0.72 | +0.82 |
| Turkic | 1 | +0.85 | — | +0.97 | +0.97 | — | — |
| Uralic | 3 | +0.85 | +0.88 | +0.91 | +0.91 | +0.75 | +0.81 |

How to read this — and how not to:

- **The broad pattern matches the field's aggregate findings.** On the
  42-pair Indo-European bulk, learned metrics lead (MetricX +0.84, COMET
  +0.81) with chrF behind and BLEU last — the standard WMT result,
  reproduced here from raw data as a sanity anchor.
- **The per-family deviations are the payload.** For polysynthetic
  Inuktitut, string metrics collapse and COMET is the only usable signal.
  For Maasai and for English→Arabic in wmt25, MetricX correlates *negatively*
  while string metrics stay serviceable — a learned metric extrapolating
  beyond its training distribution fails silently, with confident-looking
  scores. These are precisely the cases a global average erases.
- **Single-pair families are evidence, not conclusions.** Eight of eleven
  families rest on one or two pairs from a single campaign. The honest
  reading of "Eskimo-Aleut: BLEU +0.16" is *"in the one campaign where
  humans judged en→iu, BLEU was uninformative"* — a documented measurement,
  a red flag, and a reason to collect more, not a law about the family.
- **A negative cell does not mean the metric is broken everywhere.** It
  means: on that pair, in that campaign's system pool, the metric ordered
  systems against human judgment. Range restriction (see §8) can depress
  any correlation when systems cluster tightly in quality.

## 8. Limitations

Stated plainly, because the artifact's value is its honesty:

1. **Family is a proxy, not a mechanism.** Genealogical family correlates
   with, but does not determine, the morphological properties that drive
   metric behaviour. The per-pair cells (with genus recorded per language)
   allow finer slicing; the family key is a queryable default, not a claim
   of typological causality.
2. **Coverage is what WMT judged, not what the world speaks.** 57 pairs,
   heavily Europe-weighted; every xx→English pair rolls into Indo-European;
   whole macro-families (Algonquian, Austronesian, Quechuan, …) have *no
   human-judgment coverage at all*. For those, Champollion's surfaces answer
   UNMEASURED rather than borrowing a neighbour's number. Champollion's own
   sovereign-benchmark program — community-controlled test sets with native
   speaker validation — is the long-term fix for exactly this gap.
3. **Within-family transfer is an assumption.** When a queried language was
   never directly judged, family-level evidence comes from *other* languages
   in the family, and every consuming surface says so explicitly.
4. **No confidence intervals yet.** Cells carry sample sizes but not
   bootstrap intervals; single-pair family aggregates especially should be
   read with the widths §7 implies. Adding per-cell bootstrap CIs (the
   harness already has the machinery for score CIs) is planned work.
5. **Range restriction.** Correlations are computed over each campaign's
   submitted systems. Recent campaigns cluster many strong systems tightly
   together, which depresses correlations for all metrics — part of why
   wmt25-derived cells (Maasai, Arabic) show extreme values. The
   per-testset attribution on every cell keeps this inspectable.
6. **Segment-level statistic choice.** The flattened τ-b is simple and
   reproducible but is not the tie-calibrated grouped accuracy of the most
   recent WMT findings papers; numbers here should not be compared digit
   -for-digit against those publications.
7. **Data license.** The upstream human-judgment data carries no explicit
   license statement (§3.1). Champollion redistributes none of it, publishes
   only derived statistics with full attribution, and holds this artifact in
   a **non-commercial evidence lane** (`license_lane.commercial_ok: false`)
   until the posture is resolved. The MQM lanes additionally trace to
   Google's Apache-2.0 annotation releases.
8. **The archive is a moving target.** New campaigns are added to the same
   tarball URL. The pins identify our snapshot exactly; regeneration against
   a newer snapshot is a new artifact version with new pins, never a silent
   update.

## 9. Reproduction

The artifact is regenerable from source by anyone:

```bash
# 1. Fetch the archive (912 MB compressed; NOT immutable — keep the pins)
mkdir -p ~/.mt-eval/mt-metrics-eval && cd ~/.mt-eval/mt-metrics-eval
curl -sSL -D mt-metrics-eval-v2.headers -o mt-metrics-eval-v2.tgz \
     https://data.statmt.org/wmt26/mt-metrics-eval-v2.tgz
shasum -a 256 mt-metrics-eval-v2.tgz > mt-metrics-eval-v2.sha256
tar xzf mt-metrics-eval-v2.tgz

# 2. Regenerate (refuses to run without a checksum pin)
python3 arena/scripts/import_wmt_metaeval.py
```

Note the archive's own README points at a retired storage.googleapis.com
URL; `data.statmt.org` is the live host. The importer is pure Python
standard library (sacreBLEU only for the computed chrF++ lane); its
correlation implementations are cross-checked against brute-force references
in `arena/tests/test_wmt_metaeval.py`, and the artifact's structural
contract is enforced by its JSON schema plus integrity tests in both
runtimes.

## 10. Credits and citation

The human judgments summarized here are the work of the **WMT Metrics
shared-task organizers and annotators** — including Markus Freitag, Nitika
Mathur, Tom Kocmi, and many collaborators across the 2019–2025 campaigns —
and of the **Google MQM annotation program** (Freitag et al., *Experts,
Errors, and Context*, TACL 2021; `google/wmt-mqm-human-evaluation`). The
archive and toolkit are maintained as `google-research/mt-metrics-eval`.
Pairwise ranking accuracy follows Kocmi, Federmann et al. (2021), *To Ship
or Not to Ship*. Champollion's contribution is the per-language-family
organization, the correlation computation, and the honesty scaffolding
around it — every number in the artifact carries `champollion-derived`
provenance naming the upstream it derives from, and none of their text,
judgments, or scores is redistributed.

When citing reliability numbers from this artifact, cite both the WMT
campaign(s) the cells attribute and Champollion's artifact version (the
`sources` block carries the exact data pins), and respect the
non-commercial evidence lane described in §8.
