#!/usr/bin/env python3
"""Generate the public community-compute sweep queue.

Emits four published artifacts into the website static dir (default
``cli/website/static/``), regenerated together so they cannot drift apart:
``queue.json`` (the full work-list behind champollion.dev/queue.json that the
harness + run_queue one-liner consume), ``queue-preview.json`` (a small
companion the /contribute and /leaderboard pages fetch instead of the full
file — top items + a per-pair aggregation + the full file's size),
``mesh.json`` (the /mesh visualization), and ``registry.json`` (a
byte-identical copy of ``arena/datasets/registry.json``, served at
champollion.dev/registry.json as the harness's remote-fallback registry —
see ``publish_registry``).

The full ``queue.json`` is the contributor / agent WORK-LIST: it is encoded
compactly and carries only the fields needed to run an item (what corpus +
model + condition, the cost estimate, a pasteable command). The ecv-v3
ranking diagnostics and the per-item corpus-fetch provenance are dropped from
the *published* file — see ``_PUBLISHED_DROP_FIELDS`` — to keep it well under
GitHub's 100 MB per-file limit; both are preserved elsewhere (the formula in
the spec + mesh.json bridges; the corpus provenance in registry.json).

Reads three sources of truth and emits ``cli/website/static/queue.json``,
the artifact behind champollion.dev/queue.json and the /contribute page:

  1. ``arena/datasets/registry.json`` — which dev-split corpora are open
     for community runs. Two kinds qualify, both requiring
     ``segment: "development"``, a redistributable license (CC-BY
     family, non-NC), and no quarantine flag:
       - ``access: "local"`` corpora hosted in the public harness
         mirror (fetched with curl in the run command);
       - ``access: "fetch-from-source"`` corpora with a
         ``source_export`` block (the Tatoeba mesh corpora) — never
         hosted by us; the harness rebuilds them locally from the
         pinned upstream export when ``mt-eval run --yes`` finds the
         corpus path missing, then verifies the registry sha256.
     NC-licensed (EdTeKLA) corpora are excluded either way — see the
     project licensing policy (NC content stays out of open
     contribution lanes). Transmission gate (founder ruling
     2026-07-19): corpora whose license requires the rights-holder's
     recorded transmission consent (LicenseRef-*/modified/unstated
     without a data-side pin) and sealed sets never enqueue — their
     remote evaluation refuses; restricted corpora enqueue only under
     a founder-recorded ``transmission_policy: "no-train"`` registry
     pin (the WMT research-use sets), and each of their items carries
     the channel-requirement stamp (``transmission`` block — see
     :func:`transmission_stamp`).
  2. ``arena/eval/logs/sweep_manifest.json`` — the validated model lineup
     and observed per-run costs from the 2026-06-11 baseline sweep.
     Cost estimates are either the *observed* cost for that exact
     (corpus, model) pair, or an extrapolation from the model's average
     cost per entry across the sweep (``est_basis`` says which). Both
     are scaled by ``LLM_COST_SAFETY_MULTIPLIER`` (see its calibration
     note) — the frozen sweep under-predicts current runs, and budget
     mode turns underestimates directly into overspend.
  3. The public leaderboard REST endpoint (read-only anon key, same as
     cli/website/src/pages/leaderboard.js) — already-covered
     (dataset, model, condition) combos are dropped from the queue.

The MT-engine lane (below) reads two more: ``shared/method-registry.json``
(which mt-api engines exist) and ``shared/catalogue/method-coverage.json``
(which languages each engine supports).

Priority model (expected-chain-value v3)
----------------------------------------
Normative definition, philosophy, defaults, and citations live in the
public spec — cli/website/docs/network/specifications/queue-construction.md
(https://champollion.dev/docs/network/specifications/queue-construction). The
implementation here mirrors it exactly; a summary:

The mission is "every language into every language by measured
individual pair chains". The benchmark's value therefore lives in its
*quality-weighted graph* — and v3 makes every edge a BRIDGE with two
numbers, not one:

    quality      q(e) = best published corpus-level chrF++ / 100
    reliability  r(e) = f_size · f_rich · f_conf · f_repl   ∈ [0,1]
    effective    s_eff(e) = q(e) · r(e)

f_size = min(1, n/100) (evaluated entries vs the significance floor);
f_rich = min(1, L̄/5) where L̄ is mean effective source length in
content units (chars divided by the language's MEASURED character
economy — registry ``richness`` backfill; fixes both the CJK "one
word per sentence" artifact and polysynthetic word counting);
f_conf = min(1, 5/h) with h the best run's chrF CI half-width (proxy
50/√n when unpublished); f_repl = min(1, runs/2). 62 single-word
vocabulary items run once compute r ≈ 0.04 — not a path. Chains
compose multiplicatively over s_eff with a per-junction discount λ
(pivot literature), and the mesh objective is

    Φ = mean over ordered language pairs (u,v) of Q(u,v),
    Q(u,v) = max over paths P of  λ^(|P|-1) · Π_{e in P} s_eff(e)

(the Latora–Marchiori 2001 efficiency construction with the 1/d kernel
replaced by chain fidelity). Each open queue item is valued by the
mesh improvement it is expected to buy per dollar:

    ECV(item) = ΔΦ(item) / max(est_cost, COST_FLOOR)

where ΔΦ raises the item's edge to the best of (a) the run becoming
the edge's new best (predicted quality × the reliability ITS corpus
would produce) or (b) a pure replication bump on the current best —
so replications, bigger corpora, richer corpora, and tighter CIs all
carry priced value, not just higher scores. Quality predictions are
the v2 transparent sum (hierarchical back-off prior + model offset +
pair/target-local condition offset + UCB1-shaped exploration bonus,
Auer et al. 2002); ΔΦ uses the exact single-edge closed form
Q'(u,v) = max(Q(u,v), E(u,a)·s'·E(b,v), E(u,b)·s'·E(a,v)) with
E = λQ off-diagonal. Ranking by marginal value per cost is the greedy
rule for budgeted coverage-style maximization (Nemhauser et al. 1978;
Khuller, Moss & Naor 1999).

2026-07-12 ranking remedies (founder-approved)
----------------------------------------------
Four adjustments on top of the greedy ECV rule. (1) CONTAMINATION —
each item's ECV is multiplied by ``CONTAMINATION_ECV_FACTORS`` (LOW
1.0 / MEDIUM 0.4 / HIGH 0.1; unknown treated as MEDIUM): the clean
chain graph only admits positively-LOW edges, so MEDIUM/HIGH runs
cannot strengthen the mesh and must not outrank clean-mesh work at
equal cost (they stay queued — relative-lane value is real).
(2) FRONTIER INTERLEAVE — after the greedy sort, every
``FRONTIER_INTERLEAVE_EVERY``-th slot of the final ranking carries the
highest-ranked not-yet-placed ``FRONTIER_MODELS`` item, so frontier
evidence reaches the prediction priors early instead of only after the
cheap tiers saturate; priorities are renumbered to the woven order.
(3) PREVIEW HUB CAP — the top-25 preview holds at most
``PREVIEW_SOURCE_CAP`` items sharing one SOURCE language (observed
pre-remedy: 17/25 jpn→X). (4) PREVIEW CONLANG EXCLUSION — items whose
source or target is a constructed language (Glottolog's 'Artificial
Language' bucket arti1236, read from the language cards — never a
hardcoded language set) are skipped by the preview. (3) and (4) are
presentation policy only: the full queue.json and its priorities are
unaffected, and preview-skipped items keep their real priority. The
preview policy is also published AS DATA in the full queue's metadata
(``preview_policy``: source cap + the card-derived conlang codes
actually present in the queue — see :func:`build_preview_policy`) so
the card-less server-side refresh (the regenerate-queue edge function)
applies the identical selection.

MT-engine lane
--------------
Alongside the LLM lane (model × corpus × prompting condition), the queue
carries an MT-ENGINE lane: engine × corpus items for the self-contained
MT API systems (``mt-eval run --method <engine>``). Engines translate by
themselves — there are no prompting conditions — so each engine item
carries the sentinel condition ``"engine"`` (selection treats it like
naive: only "coached" is gated behind --include-coached). Three rules:

  * COVERAGE GATING — an engine enqueues for a pair only when BOTH its
    source and target are in the engine's published support list
    (``shared/catalogue/method-coverage.json``, cite-only ISO 639-3).
    Engines with no coverage entry (apertium, amazon-translate) or an
    empty one (translated/Lara — provider list import pending) cannot be
    pair-gated and enqueue nothing (fail safe; see ``load_engine_lane``).
  * NEVER-INVENT-PRICING — engines with a published per-character list
    price (reference SSOT: ``cli/lib/methods/provider-pricing.js``) get
    ``est_cost_usd`` = price × estimated corpus source characters
    (measured registry richness when available, else a median-based
    extrapolation, ``est_basis`` says which). Engines whose pricing is
    not published carry ``est_cost_usd: null`` / ``est_basis:
    "unpublished"``, and self-hosted engines (libretranslate) carry null
    too — their real cost is the contributor's infrastructure, unknown,
    never claimed $0. A price is never fabricated.
  * NEUTRAL PRIOR — engine items rank through the same ecv-v3
    transparent sum. Engines have no baseline-sweep priors, so until
    engine runs publish, their model offset is exactly 0 (neutral) and
    the UCB exploration bonus applies as usual; once engine runs are on
    the board their offsets are learned exactly like any model's.
    Unpriced engine items use the median published engine rate as the
    ECV cost denominator (a ranking stand-in, never a price claim).

Coverage-dropping is condition-agnostic for engine items: an engine run
publishes under its real prompt-condition label ("naive" by default), so
any (corpus, engine) row on the board covers the item.

Ties break: naive before coached, cheaper first, then item id.
Every item exposes its full breakdown (edge_quality,
edge_reliability, edge_tier, effective_strength, pair_prior + basis,
model_offset, condition_offset, exploration_bonus,
predicted_strength, post_run_reliability, predicted_effective,
expected_mesh_gain, ecv_per_usd) so any ranking can be re-derived by
hand. Bridge display tiers: established (n ≥ 100, L̄ ≥ 5, h ≤ 5,
runs ≥ 2) / provisional / registered.

With ``--offline`` (or a failed query) there are no results: all
edges are registered-only, predictions collapse to the 0.5 prior, and
ranking degrades to structural chain value per dollar — with
reliability still differentiating corpora (a bigger, richer corpus
yields a stronger post-run bridge for the same predicted score). The
legacy v1 field ``chaining_gain`` is kept for continuity.

No claim-locking by design: run-card fingerprints make duplicate runs
harmless (identical fingerprints dedupe on publish; non-identical
duplicates are legitimate replications). "Pick any open item" is correct.

Usage:
  python3 scripts/generate_sweep_queue.py [--output ../cli/website/static/queue.json]
      [--offline]        # skip the leaderboard query (structural ranking)
      [--lam 0.9]        # chain junction discount λ
      [--kappa 0.05]     # exploration bonus scale κ
      [--rank-mode map]  # survey ordering (map-value v2) + desert ledger —
                         # THE PUBLISHED-QUEUE DEFAULT (founder flip
                         # 2026-07-19, commit 283524f9a); 'ecv' is the
                         # exploitation ordering for dense-board campaigns
      [--lane llm|engine|both]  # default llm (founder 2026-07-19): the
                         # public queue is LLM-only, on pairs touching at
                         # least one language outside every MT service's
                         # coverage; engines run as separate campaigns
"""
from __future__ import annotations

import argparse
import csv
import json
import math
import os
import re
import sys
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from functools import lru_cache
from pathlib import Path

ARENA = Path(__file__).resolve().parent.parent
MONOREPO = ARENA.parent

# ISO code-scope resolution (sibling module — pinned official ISO 639-3/-5
# tables; the single home for scope logic). Used for mesh node scope
# markers/names; the per-entry resolution itself is stamped by
# build_registry.py as ``language_resolution`` (data over code).
sys.path.insert(0, str(Path(__file__).resolve().parent))
import iso_resolution  # noqa: E402

# The card reader's attribution helpers. This script reads card JSON directly
# (it needs only two fields and runs before the harness is configured), so it
# must resolve attribution envelopes the same way every other consumer does
# rather than reinventing the shape check.
sys.path.insert(0, str(ARENA))
from mt_eval_harness.language_cards import display  # noqa: E402
REGISTRY = ARENA / "datasets" / "registry.json"
MANIFEST = ARENA / "eval" / "logs" / "sweep_manifest.json"
CARDS_DIR = MONOREPO / "cli" / "shared" / "language-cards"
#: Name fallbacks for registry codes without a language card (script-suffixed
#: + macrolanguage codes) — the same SIL/Glottolog exports the card
#: generators read (SSOT rule: language facts come from data files, never
#: from code).
ISO_639_3_TAB = MONOREPO / "cli" / "data" / "iso639-3" / "iso-639-3.tab"
GLOTTOLOG_LANGUOID_CSV = MONOREPO / "cli" / "data" / "glottolog" / "languoid.csv"
DEFAULT_OUTPUT = MONOREPO / "cli" / "website" / "static" / "queue.json"

# Transmission-policy SSOT (mt_eval_harness/transmission_policy.py — the
# founder channel rule, 2026-07-19): which corpora may be SENT to model APIs
# at all, and under which channel discipline. The queue consumes it for two
# things — EXCLUDING corpora whose remote evaluation refuses
# (consent-required / sealed: an item nobody may lawfully run remotely is
# dead weight and an invitation to mis-transmit), and STAMPING the per-item
# no-train notice on restricted-but-pinned corpora (the WMT research-use
# sets) so donors see the channel requirement on the work-list itself. No
# policy logic is duplicated here (sibling-script import pattern:
# run_queue.py, seed_board_anonymous.py).
sys.path.insert(0, str(ARENA))
from mt_eval_harness.transmission_policy import (  # noqa: E402
    MODE_CLEARED,
    MODE_CONSENT_REQUIRED,
    MODE_SEALED,
    resolve_transmission_policy,
)

# Public, read-only Supabase config — identical to leaderboard.js.
# RLS restricts the anon key to SELECT; this script never writes.
# Env-overridable (MT_EVAL_SUPABASE_URL / MT_EVAL_SUPABASE_ANON_KEY) so the
# queue can be regenerated against a staging branch during end-to-end tests.
SUPABASE_URL = os.environ.get(
    "MT_EVAL_SUPABASE_URL", "https://sjdomynysdljkbemupqa.supabase.co"
)
SUPABASE_ANON_KEY = os.environ.get(
    "MT_EVAL_SUPABASE_ANON_KEY", "sb_publishable_bV6CFNFnzxhQI0wlBx2J0A_5Vm5gFBp"
)

# Raw-file base of the public monorepo (harness lives under the arena/ subtree).
MIRROR_RAW = (
    "https://raw.githubusercontent.com/gamedaysuits/Champollion/main/arena"
)

CONDITIONS = ("naive", "coached")

#: Premium-tier models (the validated lineup lives in the sweep manifest;
#: this is its frontier subset). Frontier runs are disproportionately
#: informative for the prediction priors — the v2 model offsets learn the
#: most from them, and a purely cost-greedy ECV ranking would surface them
#: only after the cheap tiers saturate (~84k items deep). interleave_frontier
#: therefore reserves every FRONTIER_INTERLEAVE_EVERY-th slot of the final
#: ranking for the best not-yet-placed frontier item. Founder-adjustable:
#: edit this set as the premium tier moves.
FRONTIER_MODELS = frozenset({
    # Refreshed 2026-08-24 with the lineup expansion (13 additions,
    # probe-validated against the live /models catalog — see
    # sweep_manifest.json): each lab's newest flagship replaces its
    # predecessor (opus-5 for opus-4.8, gpt-5.6-terra-pro for gpt-5.5),
    # and the two strongest post-freeze entrants join. The superseded
    # flagships stay in the LINEUP (their board history is evidence);
    # they just stop consuming interleave slots.
    "anthropic/claude-fable-5",
    "anthropic/claude-opus-5",
    "openai/gpt-5.6-terra-pro",
    "google/gemini-3.1-pro-preview",
    "x-ai/grok-4.6",
    "deepseek/deepseek-v4-pro-0813",
})

#: Frontier interleave cadence: every Nth slot (1-indexed positions N, 2N, …)
#: of the final ranking carries a FRONTIER_MODELS item while any remain.
FRONTIER_INTERLEAVE_EVERY = 5

# ---- MT-engine lane --------------------------------------------------------
# Engine × corpus items for the self-contained MT API systems
# (``mt-eval run --method <engine>``). See the module docstring's
# "MT-engine lane" section for the three rules (coverage gating,
# never-invent-pricing, neutral prior).

#: Condition sentinel engine items carry — engines have no prompting
#: conditions. Both select_items (queue_runner.py) and the JS filterQueue
#: port gate only "coached", so engine items are selectable by default.
ENGINE_CONDITION = "engine"

SHARED_DIR = MONOREPO / "shared"
METHOD_REGISTRY_JSON = SHARED_DIR / "method-registry.json"
METHOD_COVERAGE_JSON = SHARED_DIR / "catalogue" / "method-coverage.json"

#: There is no engine→coverage mapping any more, and that is the point.
#:
#: This used to be a six-row table translating method-registry ids
#: ("microsoft-translator") into short coverage keys ("microsoft"), because the
#: registry and the coverage register had each grown their own spelling of the
#: same method. A hand-maintained mapping is a place for a seventh method to be
#: forgotten, and Apertium proved it: a runtime adapter with no coverage entry,
#: invisible to the map from the day it was added.
#:
#: The coverage register is now keyed by the registry id, so the lookup is
#: identity. cli/test/method-parity.test.js fails if the two vocabularies drift
#: apart again, or if this table comes back.

#: Published per-character list prices, USD per 1M source characters.
#: REFERENCE SSOT: cli/lib/methods/provider-pricing.js (PROVIDER_RATES,
#: last verified 2026-06-08) — keep the two in sync. NEVER-INVENT-PRICING:
#: engines absent here have no published per-character price and their
#: items carry est_cost_usd: null / est_basis: "unpublished".
ENGINE_USD_PER_MCHAR = {
    "google-translate": 20.0,
    "deepl": 25.0,
    "microsoft-translator": 10.0,
    "libretranslate": 0.0,  # self-hosted: $0 API cost; infrastructure excluded
}

#: Ranking-only stand-in for engines with UNPUBLISHED pricing: the median of
#: the published nonzero per-character rates above. The ECV denominator needs
#: a finite number; the item itself keeps est_cost_usd: null — this is a
#: documented ranking heuristic, never a price claim.
_NONZERO_ENGINE_RATES = sorted(r for r in ENGINE_USD_PER_MCHAR.values() if r > 0)
MEDIAN_ENGINE_RATE = _NONZERO_ENGINE_RATES[len(_NONZERO_ENGINE_RATES) // 2]

# ---- Expected-chain-value v3 parameters -----------------------------------
# Normative home: cli/website/docs/network/specifications/queue-construction.md §4.
# Change them there first; the queue metadata echoes the values used.

#: Chain junction discount λ: an estimated h-hop chain is worth
#: λ^(h-1)·Π s(e). Direct measurement always beats a product-equal
#: estimated chain because pivoting loses fidelity beyond what edge
#: scores compose to (Utiyama & Isahara 2007; Wu & Wang 2007; Fan et
#: al. 2021 measure direct-vs-pivot gaps; the ~10% per-junction haircut
#: is our calibration choice, revisited as chain triangles get measured).
LAMBDA = 0.9

#: Exploration bonus scale κ, in strength units (chrF/100). 0.05 = the
#: ~5-chrF noise floor below which differences are noise on n<100
#: corpora (fair-scoring policy §5 / corpus-design §6.3) — optimism
#: never exceeds what the measurement could distinguish anyway, scaled
#: by the UCB1 schedule (Auer, Cesa-Bianchi & Fischer 2002).
KAPPA = 0.05

#: Predictions are capped here — no estimated edge may claim
#: near-perfect fidelity it hasn't demonstrated.
S_CAP = 0.95

#: Uninformed pair prior when there are no results at all (observed
#: global mean is preferred whenever any result exists; 429 live runs
#: averaged ≈ 0.54 at v2 ship time).
S0_FALLBACK = 0.5

#: Floor for the cost denominator (USD) — keeps near-free runs from
#: claiming unbounded value per dollar.
COST_FLOOR = 0.01

#: Contamination multiplier on each item's ECV score (2026-07-12 remedy #1).
#: The clean chain graph only admits positively-LOW contamination edges
#: (doctrine: arena/mt_eval_harness/contamination.py — MEDIUM/HIGH results
#: are relative-only and can never strengthen the mesh), so a MEDIUM/HIGH
#: run must not outrank clean-mesh work at equal cost. The items REMAIN
#: queued — relative-lane comparisons are real value — they just rank
#: behind clean work. An unknown/missing grade is treated as MEDIUM
#: (conservative: never assume clean).
CONTAMINATION_ECV_FACTORS = {"LOW": 1.0, "MEDIUM": 0.4, "HIGH": 0.1}
CONTAMINATION_DEFAULT_FACTOR = CONTAMINATION_ECV_FACTORS["MEDIUM"]


_MACROLANGUAGE_CACHE: dict[str, str | None] = {}


def language_macrolanguage(iso3: str) -> str | None:
    """The card-recorded ISO 639-3 macrolanguage for an individual code
    (e.g. cmn → zho, swh → swa), or None. Data-driven from the language
    cards (SSOT) — service coverage lists often name the MACRO code while
    mesh corpora use the individual code, and missing this aliasing lets
    fully-covered pairs (nld>cmn) slip the llm-lane filter."""
    code = (iso3 or "").strip().lower()
    if not code:
        return None
    if code in _MACROLANGUAGE_CACHE:
        return _MACROLANGUAGE_CACHE[code]
    macro = None
    card = CARDS_DIR / f"{code}.json"
    if card.is_file():
        try:
            data = json.loads(card.read_text(encoding="utf-8"))
            value = data.get("macrolanguage")
            if isinstance(value, str) and value.strip():
                macro = value.strip().lower()
        except (json.JSONDecodeError, OSError):
            macro = None
    _MACROLANGUAGE_CACHE[code] = macro
    return macro


def pair_is_fully_service_covered(
    src: str, tgt: str, service_covered: frozenset | set,
    macro_of=language_macrolanguage,
) -> bool:
    """True when BOTH sides of a pair are inside the union of the MT
    services' published coverage lists — the pairs the default (llm-lane)
    public queue excludes (founder directive 2026-07-19: the queue is for
    LLM calling of non-covered languages; fully service-covered pairs are
    the engines' separate campaign). A side counts as covered when its own
    code OR its macrolanguage is in the union (coverage lists say zho/swa;
    corpora say cmn/swh). An empty coverage union excludes nothing — fail
    open, never fail the whole queue on a missing import."""
    if not service_covered:
        return False

    def covered(code: str) -> bool:
        if code in service_covered:
            return True
        macro = macro_of(code)
        return bool(macro) and macro in service_covered

    return covered(src) and covered(tgt)


def contamination_ecv_factor(grade: str | None) -> float:
    """ECV multiplier for a registry contamination grade (case-insensitive);
    unknown/missing grades fall back to the MEDIUM factor."""
    return CONTAMINATION_ECV_FACTORS.get(
        (grade or "").strip().upper(), CONTAMINATION_DEFAULT_FACTOR,
    )

# ---- Reliability (ecv-v3) — founder-approved thresholds, spec §3 ----------
# A bridge is (quality q, reliability r): s_eff = q·r enters the chain
# matrix, so "62 single-word vocabulary items, run once" can never look
# like an established bridge. Literature anchors: Koehn 2004 (even 300
# sentences is a small test set); Kocmi et al. 2021 (chrF deltas inside
# the CI are noise); Marie et al. 2021 (unreplicated comparisons are
# the field's credibility failure); Mager et al. 2021/2022 (character-
# level content units for morphologically rich languages).

#: Evaluated entries for full size credit (significance floor).
RELIABILITY_N_FULL = 100

#: Mean effective source words (chars / measured character economy)
#: for full richness credit — a real-sentence corpus.
RELIABILITY_L_HEALTHY = 5.0

#: chrF 95% CI half-width for full confidence credit (noise floor).
RELIABILITY_H_NOISE = 5.0

#: Published runs on an edge for full replication credit.
RELIABILITY_RUNS_FULL = 2


def _ci_half_proxy(n: int) -> float:
    """CI half-width estimate when a run published no bootstrap CI.

    Anchored at the policy noise floor (±5 chrF at n=100) with 1/√n
    scaling: h ≈ 50/√n. A 50-entry run proxies to ±7.1, a 200-entry
    run to ±3.5.
    """
    import math
    return 50.0 / math.sqrt(max(1, n))


def reliability_factors(
    n_eval: int,
    eff_words: float | None,
    ci_half: float | None,
    runs: int,
) -> dict:
    """The four reliability factors and their product r ∈ [0,1].

    Missing effective-length metadata is treated as neutral (the
    registry backfill stamps every locally-buildable corpus; absence
    means we could not measure, not that entries are poor). A missing
    CI falls back to the n-based proxy.
    """
    f_size = min(1.0, n_eval / RELIABILITY_N_FULL) if n_eval else 0.0
    f_rich = (
        min(1.0, eff_words / RELIABILITY_L_HEALTHY)
        if eff_words else 1.0
    )
    h = ci_half if ci_half and ci_half > 0 else _ci_half_proxy(n_eval)
    f_conf = min(1.0, RELIABILITY_H_NOISE / h) if h > 0 else 0.0
    f_repl = min(1.0, runs / RELIABILITY_RUNS_FULL)
    r = f_size * f_rich * f_conf * f_repl
    return {
        "f_size": round(f_size, 4),
        "f_rich": round(f_rich, 4),
        "f_conf": round(f_conf, 4),
        "f_repl": round(f_repl, 4),
        "r": round(r, 4),
    }


def bridge_tier(n_eval: int, eff_words: float | None,
                ci_half: float | None, runs: int) -> str:
    """Display tier: established / provisional (registered = no runs)."""
    if runs <= 0:
        return "registered"
    h = ci_half if ci_half and ci_half > 0 else _ci_half_proxy(n_eval)
    ok = (
        n_eval >= RELIABILITY_N_FULL
        and (eff_words is None or eff_words >= RELIABILITY_L_HEALTHY)
        and h <= RELIABILITY_H_NOISE
        and runs >= RELIABILITY_RUNS_FULL
    )
    return "established" if ok else "provisional"


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def load_registry_for_queue() -> dict:
    """Load the dev/runnable registry the queue is built from.

    Prefers the merged ``registry.json`` (regenerated from the corpora cards
    by build_registry.py — the development-segment, runnable corpora,
    including the FLORES/NTREX curated promotedSubset pairs). If it
    is absent, falls back to merging the development-segment entries from the
    ``registry-*.json`` split files directly, so the queue still regenerates
    on a fresh checkout where only the split files were built. Unbuilt
    catalogue tails (FLORES/NTREX beyond their promotedSubset, devtest/test
    segment) are excluded either way — no per-pair built sha means the
    sha-parity guard would refuse their published runs.

    Fails loudly if no registry is found: a queue silently built from nothing
    is worse than no queue.
    """
    if REGISTRY.is_file():
        return load_json(REGISTRY)

    split_files = sorted((ARENA / "datasets").glob("registry-*.json"))
    if not split_files:
        raise SystemExit(
            f"FATAL: no registry found. Looked for {REGISTRY} and "
            f"{ARENA / 'datasets'}/registry-*.json. Run "
            f"`python3 arena/scripts/build_registry.py` first."
        )
    merged: dict = {"registry_version": "3.0.0", "datasets": []}
    for split_path in split_files:
        source = split_path.stem.replace("registry-", "")
        reg = json.loads(split_path.read_text(encoding="utf-8"))
        for ds in reg.get("datasets", []):
            if ds.get("segment") != "development":
                continue  # catalogue corpora never reach the queue
            ds["registry_source"] = source
            merged["datasets"].append(ds)
    print(
        f"  registry.json absent — merged {len(merged['datasets'])} "
        f"development corpora from {len(split_files)} split files."
    )
    return merged


def publish_registry(registry: dict, out_dir: Path) -> tuple[Path, int]:
    """Publish the canonical registry next to queue.json (champollion.dev).

    ``cli/website/static/registry.json`` is served at
    ``champollion.dev/registry.json`` and is the harness's remote-fallback
    registry (config.load_registry step 4 — the `pip install`ed CLI fetches
    it when no in-repo / bundled registry is present). Nothing else
    republished it, so it silently drifted stale (a 1,378-entry snapshot
    behind a 4,441-entry canonical registry). Wiring it HERE — into the same
    step that writes queue.json — means the served registry and the served
    queue are regenerated together from one ``arena/datasets/registry.json``
    and cannot diverge again.

    Byte-identical to the canonical file when it exists (so the served
    registry matches what build_registry.py wrote); otherwise the merged
    fallback registry passed in is serialized.

    Returns ``(path, dataset_count)``.
    """
    out = out_dir / "registry.json"
    if REGISTRY.is_file():
        out.write_bytes(REGISTRY.read_bytes())
    else:
        out.write_text(
            json.dumps(registry, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
    return out, len(registry.get("datasets", []))


def model_short(slug: str) -> str:
    """Normalize a model slug for coverage comparison.

    The leaderboard stores both full slugs ("anthropic/claude-sonnet-4.6")
    and short names ("claude-sonnet-4.6") depending on how the run was
    configured, so compare on the post-vendor segment, lowercased.
    """
    return slug.split("/")[-1].strip().lower()


def queue_corpora_split(
    registry: dict,
) -> tuple[list[dict], list[tuple[str, list[str]]]]:
    """Select corpora eligible for the public queue; also return the
    DOCTRINE-EXCLUDED tail as ``[(corpus_id, exclusion_reasons)]``.

    Eligible = dev-split, non-NC license, transmission-eligible,
    benchmark-resolvable (below), and obtainable by a contributor: either
    hosted in the public mirror (``access: "local"``) or rebuildable from a
    pinned upstream export (``access: "fetch-from-source"`` with a
    ``source_export`` block — the harness fetch-on-miss path). Everything
    else (NC corpora, quarantined sets, local-only gold standards,
    consent-gated licenses) stays out of the open contribution lane.

    DOCTRINE GATE (LANGUAGE_TAXONOMY.md Position 4 v2; spec §2.2): a queue
    item may target only ACTIVE INDIVIDUAL ISO 639-3 codes — a score
    against a macrolanguage or collective label would be an unfalsifiable
    claim about varieties never evaluated. build_registry stamps every
    entry with ``language_resolution`` (script-suffix strip, clean
    retirement successors, founder/agent-recorded variety pins); corpora
    whose sides do not all resolve are EXCLUDED here with machine-readable
    reasons, surfaced in queue metadata (``doctrine_exclusions``) and the
    desert ledger — never silently dropped. A registry entry MISSING the
    stamp fails the whole generation loudly: it means the served registry
    predates the resolution framework, and ranking on unresolved codes
    would silently re-serve macro-target items.
    """
    out = []
    doctrine_excluded: list[tuple[str, list[str]]] = []
    for ds in registry.get("datasets", []):
        access = ds.get("access")
        if access == "fetch-from-source":
            if not isinstance(ds.get("source_export"), dict):
                continue  # no public rebuild recipe (e.g. EdTeKLA cards)
        elif access != "local":
            continue
        if ds.get("segment") != "development":
            continue
        license_str = (ds.get("license") or "").upper()
        if "NC" in license_str:  # non-commercial lane — not queued
            continue
        if ds.get("quarantine"):
            continue
        path = ds.get("path")
        if not path:
            continue
        # Transmission gate (founder ruling 2026-07-19, SSOT:
        # mt_eval_harness.transmission_policy): consent-required and sealed
        # corpora never enter the public queue — their remote evaluation
        # REFUSES, so a queue item over one would be undonatable dead
        # weight and an invitation to send restricted content over an
        # unpinned channel. Restricted corpora reach the queue ONLY via a
        # founder-recorded data-side pin (``transmission_policy:
        # "no-train"`` on the registry entry — today the WMT research-use
        # sets), and every such item is stamped with the channel
        # requirement (see :func:`transmission_stamp`). Pinned by
        # arena/tests/test_transmission_policy.py::
        # TestQueueNeverServesRestricted.
        pol = resolve_transmission_policy(ds.get("id") or "",
                                          registry_entry=ds)
        if pol.mode in (MODE_CONSENT_REQUIRED, MODE_SEALED):
            continue
        # Doctrine gate (see docstring). Fail LOUD on a missing stamp.
        lr = ds.get("language_resolution")
        if lr is None:
            raise SystemExit(
                f"DOCTRINE GATE ERROR: registry entry '{ds.get('id')}' has "
                f"no language_resolution stamp — the registry predates the "
                f"Position 4 v2 resolution framework. Rebuild it "
                f"(arena/scripts/build_registry.py) before generating the "
                f"queue; refusing to rank on unresolved language codes."
            )
        if not lr.get("benchmark_eligible"):
            doctrine_excluded.append(
                (ds.get("id") or "?", list(lr.get("exclusion_reasons") or []))
            )
            continue
        out.append(ds)
    return out, doctrine_excluded


def queue_corpora(registry: dict) -> list[dict]:
    """Back-compat wrapper: the eligible list only (see
    :func:`queue_corpora_split`)."""
    return queue_corpora_split(registry)[0]


def resolved_pair(ds: dict) -> tuple[str, str] | None:
    """The pair a dataset's evidence and queue items key on.

    Benchmark-eligible entries key on their RESOLVED individual codes
    (``language_resolution`` — script suffixes stripped, retirements
    followed, variety pins applied), so a run on an ``eng>cmn-Hans``
    corpus strengthens the ``eng–cmn`` edge instead of minting a phantom
    node. Unresolved entries (unpinned macro/collective labels) keep
    their RAW upstream codes — their historical evidence stays on its own
    honestly-labeled node, never merged into a member variety (that would
    fabricate a variety claim). Entries with no pair at all return None.
    """
    lr = ds.get("language_resolution")
    if lr and lr.get("benchmark_eligible"):
        return lr["source"]["resolved"], lr["target"]["resolved"]
    lp = ds.get("language_pair")
    if not lp or not lp.get("source") or not lp.get("target"):
        return None
    return lp["source"], lp["target"]


def transmission_stamp(ds: dict) -> dict | None:
    """Per-item transmission notice for a queued corpus — ``None`` when the
    license is redistribution-cleared (no constraint; the common case stays
    field-free to keep the published work-list compact).

    A restricted-but-queueable corpus (a founder-recorded data-side
    ``transmission_policy`` pin on its registry entry, e.g. the WMT
    research-use sets → no-train) gets a stamp naming the channel
    requirement, so a donor sees it on the item BEFORE spending tokens and
    a custom client can copy the exact OpenRouter request preference.
    ``mt-eval run`` enforces the same rule at run time from the registry
    (transmission_policy resolution + ``provider_prefs`` on every
    OpenRouter request) — the stamp is the queue-side DISCLOSURE of that
    requirement, never a substitute for the enforcement.
    """
    pol = resolve_transmission_policy(ds.get("id") or "", registry_entry=ds)
    if pol.mode == MODE_CLEARED:
        return None
    return {
        "policy": pol.mode,
        "reason": pol.reason,
        # The verbatim OpenRouter request-body preference the run must
        # carry ({"data_collection": "deny"} — transmission_policy SSOT).
        "openrouter_provider_prefs": pol.provider_prefs,
        "notice": (
            "License-restricted corpus: send it only over channels that do "
            "not retain or train on inputs. mt-eval enforces this "
            "automatically at run time; custom clients MUST attach the "
            "openrouter_provider_prefs above to OpenRouter requests, use a "
            "first-party vendor API, or run locally."
        ),
    }


def graph_efficiency(nodes: list[str], edges: set[frozenset]) -> float:
    """Global efficiency of an undirected graph via per-node BFS.

    Mean over ordered node pairs of 1/d(u,v), with 1/inf = 0 — defined
    even on disconnected graphs. Mirror of
    ``corpora_builder.probe_tatoeba.graph_efficiency`` (kept duplicated
    so this script stays stdlib-only; parity-tested in arena/tests).
    """
    from collections import deque

    adj: dict[str, set] = {n: set() for n in nodes}
    for e in edges:
        pair = tuple(e)
        if len(pair) != 2:
            continue
        a, b = pair
        if a in adj and b in adj:
            adj[a].add(b)
            adj[b].add(a)

    n = len(nodes)
    if n < 2:
        return 0.0
    total = 0.0
    for start in nodes:
        dist = {start: 0}
        queue = deque([start])
        while queue:
            u = queue.popleft()
            for v in adj[u]:
                if v not in dist:
                    dist[v] = dist[u] + 1
                    queue.append(v)
        total += sum(1.0 / d for node, d in dist.items() if node != start)
    return total / (n * (n - 1))


def chaining_gains(
    corpora: list[dict],
    covered_pair_ids: set,
) -> dict[str, float]:
    """Chaining value per corpus id against the covered-pair graph.

    Nodes are every language appearing in an eligible corpus; edges are
    the pairs of corpora already covered on the leaderboard. A corpus's
    chaining value is the global-efficiency gain from adding its pair
    edge — 0.0 when the edge is already covered (replications add no
    new chaining).
    """
    nodes = sorted({
        lang
        for ds in corpora
        for lang in (ds["language_pair"]["source"],
                     ds["language_pair"]["target"])
    })
    covered_edges = {
        frozenset((ds["language_pair"]["source"],
                   ds["language_pair"]["target"]))
        for ds in corpora
        if ds["id"] in covered_pair_ids
    }
    baseline = graph_efficiency(nodes, covered_edges)

    gains: dict[str, float] = {}
    for ds in corpora:
        edge = frozenset((ds["language_pair"]["source"],
                          ds["language_pair"]["target"]))
        if edge in covered_edges:
            gains[ds["id"]] = 0.0
        else:
            gains[ds["id"]] = (
                graph_efficiency(nodes, covered_edges | {edge}) - baseline
            )
    return gains


#: An ISO 15924 script subtag on a registry code (cmn-Hans, sat-Latn,
#: hoc-Wara): 4 letters, title case, after a 2–3 letter base code. Matching
#: on the structural pattern — never a list of scripts — keeps this a code
#: normalization, not a language fact.
_SCRIPT_SUFFIX_RE = re.compile(r"^([a-z]{2,3})-[A-Z][a-z]{3}$")


def strip_script_suffix(code: str) -> str | None:
    """Base code of a script-suffixed registry code, else None.

    Region subtags (ar-EG) and anything else non-script pass through as
    None — only the ISO 15924 shape is stripped.
    """
    m = _SCRIPT_SUFFIX_RE.match(code or "")
    return m.group(1) if m else None


@lru_cache(maxsize=1)
def _iso_ref_names() -> dict[str, str]:
    """ISO 639-3 Ref_Name by code, from the SIL table the card generators
    also read. Names the card-less codes a card can't — notably
    macrolanguages (sqi 'Albanian', ara 'Arabic'). A missing or unreadable
    table degrades to {}: affected corpora fall back to the skip list,
    fail-safe, never a crash."""
    if not ISO_639_3_TAB.is_file():
        return {}
    names: dict[str, str] = {}
    try:
        with ISO_639_3_TAB.open(encoding="utf-8", newline="") as fh:
            for row in csv.DictReader(fh, delimiter="\t"):
                code = (row.get("Id") or "").strip()
                name = (row.get("Ref_Name") or "").strip()
                if code and name:
                    names[code] = name
    except (OSError, csv.Error, UnicodeDecodeError):
        return {}
    return names


@lru_cache(maxsize=1)
def _glottolog_iso_names() -> dict[str, str]:
    """Glottolog languoid name by ISO 639-3 code, from the export the card
    generators also read. The net behind the ISO table: Glottolog still
    indexes codes ISO has retired (kzj 'Coastal Kadazan'). When several
    languoids share a code, the primary one wins deterministically:
    level=language over dialect, non-bookkeeping over bookkeeping, then
    lowest glottocode. Missing/unreadable file degrades to {}."""
    if not GLOTTOLOG_LANGUOID_CSV.is_file():
        return {}
    best: dict[str, tuple[tuple, str]] = {}
    try:
        with GLOTTOLOG_LANGUOID_CSV.open(encoding="utf-8", newline="") as fh:
            for row in csv.DictReader(fh):
                code = (row.get("iso639P3code") or "").strip()
                name = (row.get("name") or "").strip()
                if not code or not name:
                    continue
                rank = (
                    (row.get("level") or "") != "language",
                    (row.get("bookkeeping") or "") == "True",
                    row.get("id") or "",
                )
                cur = best.get(code)
                if cur is None or rank < cur[0]:
                    best[code] = (rank, name)
    except (OSError, csv.Error, UnicodeDecodeError):
        return {}
    return {code: name for code, (_rank, name) in best.items()}


def target_lang_name(code: str) -> str | None:
    """Human-readable target-language name for a registry language code.

    Resolution chain, every step data-driven (SSOT rule):

      1. the language card, ``cli/shared/language-cards/<code>.json``;
      2. the BASE code's card when ``code`` carries an ISO 15924 script
         subtag (cmn-Hans → cmn 'Mandarin Chinese') — the script split is
         a corpus labeling detail, the language is the same;
      3. ISO 639-3 Ref_Name (macrolanguages: sqi, ara);
      4. Glottolog's name for the ISO code (retired codes: kzj).

    None when every source misses — e.g. ber, an ISO 639-2 collective
    code none of the tracked sources name — and the caller keeps that
    corpus on the printed skip list, fail-safe.
    """
    candidates = [code]
    base = strip_script_suffix(code)
    if base:
        candidates.append(base)
    for cand in candidates:
        card = CARDS_DIR / f"{cand}.json"
        if not card.exists():
            continue
        try:
            # `name` is an attribution envelope wherever registries disagree
            # (439 languages). It is an IDENTITY field — a target with no
            # display name is unusable in a queue, a log line or a prompt — so
            # this takes the documented first-on-dispute opt-out, the same one
            # cli/lib/cards/reader.js and _normalize_card take, rather than
            # returning None and falling through to a weaker source.
            name = display(
                json.loads(card.read_text(encoding="utf-8")).get("name"),
                on_disagreement="first",
            )
        except json.JSONDecodeError:
            name = None
        if name:
            return name
    for lookup in (_iso_ref_names, _glottolog_iso_names):
        for cand in candidates:
            name = lookup().get(cand)
            if name:
                return name
    return None


# ---------------------------------------------------------------------------
# MT-engine lane — coverage gating + cost estimation
# ---------------------------------------------------------------------------

def load_engine_lane() -> tuple[dict[str, frozenset], list[str]]:
    """Which MT API engines enqueue, and the languages each one supports.

    Engines come from ``shared/method-registry.json`` (``kind: "mt-api"`` —
    the SSOT both runtimes parity-test against); support comes from
    ``shared/catalogue/method-coverage.json`` (each provider's published
    language list, imported cite-only, ISO 639-3 — the same code system as
    the registry's language pairs). An engine enqueues ONLY for pairs whose
    source AND target are both in its list.

    Fail-safe skips, each returned as a human-readable note (printed and
    echoed in the queue metadata so a silently-missing engine is visible):

      * no coverage entry under the engine's own registry id
        (amazon-translate) — per-pair support cannot be verified, so
        nothing enqueues;
      * an empty ``iso6393`` list ('translated' / Lara — provider list
        import pending) — same, until the pending import resolves.

    Missing shared/ files degrade to an empty lane with a note (the LLM
    lane must still regenerate on a checkout without shared/), never a
    crash.

    Returns ``({engine: frozenset(iso639-3 codes)}, [notes])``.
    """
    notes: list[str] = []
    if not METHOD_REGISTRY_JSON.is_file():
        notes.append(
            f"engine lane disabled: {METHOD_REGISTRY_JSON} not found"
        )
        return {}, notes
    if not METHOD_COVERAGE_JSON.is_file():
        notes.append(
            f"engine lane disabled: {METHOD_COVERAGE_JSON} not found"
        )
        return {}, notes

    registry = load_json(METHOD_REGISTRY_JSON)
    coverage_doc = load_json(METHOD_COVERAGE_JSON)
    coverage_by_key = {
        m.get("key"): m for m in coverage_doc.get("methods", [])
    }

    lane: dict[str, frozenset] = {}
    for name, entry in sorted(registry.get("entries", {}).items()):
        if entry.get("kind") != "mt-api":
            continue
        # Identity: the coverage register is keyed by the registry id.
        cov = coverage_by_key.get(name)
        if cov is None:
            notes.append(
                f"'{name}' skipped: no '{name}' entry in "
                f"method-coverage.json — per-pair support cannot be verified, "
                f"so nothing enqueues"
            )
            continue
        langs = frozenset(cov.get("iso6393") or [])
        if not langs:
            notes.append(
                f"'{name}' skipped: empty iso6393 coverage list "
                f"(provider language-list import pending)"
            )
            continue
        lane[name] = langs
    return lane, notes


def engine_char_medians(
    datasets: list[dict],
) -> tuple[dict[str, float], float | None]:
    """Median measured source chars/entry, per source language + global.

    Computed over every registry corpus carrying the richness backfill's
    ``mean_source_chars`` (a MEASURED value — the backfill only stamps
    corpora it could rebuild and count). Used to extrapolate an engine
    item's character volume when its own corpus was not measured; the
    per-source-language median is preferred because character economy
    varies wildly across scripts (a CJK entry is ~3× fewer characters
    than a Latin-script one for the same content).
    """
    by_src: dict[str, list[float]] = {}
    all_chars: list[float] = []
    for ds in datasets:
        mean_chars = (ds.get("richness") or {}).get("mean_source_chars")
        src = (ds.get("language_pair") or {}).get("source")
        if not mean_chars or not src:
            continue
        by_src.setdefault(src, []).append(mean_chars)
        all_chars.append(mean_chars)

    def _median(xs: list[float]) -> float:
        return sorted(xs)[len(xs) // 2]

    return (
        {src: _median(v) for src, v in by_src.items()},
        _median(all_chars) if all_chars else None,
    )


def estimate_source_chars(
    ds: dict,
    medians: tuple[dict[str, float], float | None],
) -> tuple[float | None, str | None]:
    """Estimated total source characters for one corpus, with its basis.

    Returns ``(chars, how)`` where ``how`` ∈ {"measured",
    "source-language median", "global median"} — or ``(None, None)`` when
    no estimate is possible (no entry count, or no richness measurement
    anywhere in the registry). Never invents a number without saying how
    it was derived.
    """
    size = ds.get("size") or 0
    if not size:
        return None, None
    mean_chars = (ds.get("richness") or {}).get("mean_source_chars")
    if mean_chars:
        return mean_chars * size, "measured"
    by_src, global_median = medians
    src = (ds.get("language_pair") or {}).get("source")
    if src in by_src:
        return by_src[src] * size, "source-language median"
    if global_median:
        return global_median * size, "global median"
    return None, None


def engine_cost_estimate(
    engine: str,
    ds: dict,
    medians: tuple[dict[str, float], float | None],
) -> tuple[float | None, str]:
    """(est_cost_usd, est_basis) for one engine × corpus item.

    NEVER-INVENT-PRICING: the price side must be a published list price
    (ENGINE_USD_PER_MCHAR, reference cli/lib/methods/provider-pricing.js).
    Engines without one return ``(None, "unpublished")`` — the exact
    contract consumers rely on (budget mode already treats unknown cost
    as never-free). The volume side is measured registry richness when
    available, else a median extrapolation — ``est_basis`` says which.
    """
    rate = ENGINE_USD_PER_MCHAR.get(engine)
    if rate is None:
        return None, "unpublished"
    if rate == 0.0:
        # Self-hosted: the API charge is $0 but the real cost is the
        # contributor's own infrastructure — UNKNOWN, not $0 (the method-
        # registry cost doctrine). est must be null: a 0.0 here would make
        # every self-hosted item "fit" any budget, so one --budget donate
        # run would select ALL of them at once (unknown ≠ free).
        return None, (
            "self-hosted: $0 API list price but total cost is your own "
            "infrastructure (unknown, never claimed $0). Rate reference: "
            "cli/lib/methods/provider-pricing.js"
        )
    chars, how = estimate_source_chars(ds, medians)
    if chars is None:
        return None, (
            "published per-character rate, but no source-character volume "
            "estimate for this corpus (no registry richness measurement "
            "available)"
        )
    est = round(rate * chars / 1e6, 4)
    if how == "measured":
        basis = (
            "published per-character list price x measured corpus source "
            "characters (registry richness). Rate reference: "
            "cli/lib/methods/provider-pricing.js (verified 2026-06-08); "
            "actual billing varies (free tiers, minimum billable units)"
        )
    else:
        basis = (
            f"extrapolated: published per-character list price x {how} of "
            f"measured source chars/entry (registry richness backfill) x "
            f"entry count. Rate reference: "
            f"cli/lib/methods/provider-pricing.js"
        )
    return est, basis


#: LLM-lane cost safety multiplier, applied to every sweep-derived LLM
#: estimate ("observed" AND "extrapolated"). CALIBRATION DATAPOINT
#: (prelaunch audit, 2026-07): a real claude-haiku-4.5 queue run cost
#: $0.0124 against a $0.0036 estimate — 3.4x under. The 2026-06 baseline
#: sweep manifest under-predicts current runs (provider price updates and
#: longer completions since the sweep was frozen), and budget mode
#: (queue_runner.select_items: an item is selected only if its estimated
#: cost fits ENTIRELY within the remaining budget) turns an underestimate
#: directly into overspend of donated money. 5.0 = the observed 3.44x
#: drift x ~1.45 conservative headroom, so the calibration run lands
#: ~1.45x OVER (better to over-reserve ~1.5x than underspend a
#: contributor's budget cap). Applied to LLM items only: MT-engine items
#: are priced from published per-character list prices, which do not
#: drift this way. Revisit (and ideally retire) when the baseline sweep
#: is re-run against current pricing.
LLM_COST_SAFETY_MULTIPLIER = 5.0


def llm_cost_estimate(
    stem: str,
    slug: str,
    ds: dict,
    observed: dict[tuple[str, str], float],
    avg_per_entry: dict[str, float],
    condition: str,
) -> tuple[float | None, str]:
    """(est_cost_usd, est_basis) for one LLM model × corpus item.

    Fallback chain: observed sweep cost for this exact (corpus, model) →
    the model's sweep-average cost/entry × corpus entry count → ``(None,
    "no sweep data...")``. Both sweep-derived numbers are scaled by
    LLM_COST_SAFETY_MULTIPLIER (see its calibration note) and the basis
    string says so — an estimate silently 3.4x under actual is a claim we
    know to be false.
    """
    cost = observed.get((stem, slug))
    if cost is not None and condition == "naive":
        est = round(cost * LLM_COST_SAFETY_MULTIPLIER, 4)
        basis = (
            f"observed (baseline sweep manifest) x "
            f"{LLM_COST_SAFETY_MULTIPLIER:g} cost-drift safety margin "
            f"(calibrated against a 2026-07 run that cost 3.4x the raw "
            f"sweep estimate; conservative — expect actual at or below this)"
        )
        return est, basis
    if avg_per_entry.get(slug) and ds.get("size"):
        est = round(
            avg_per_entry[slug] * ds["size"] * LLM_COST_SAFETY_MULTIPLIER, 4,
        )
        basis = (
            f"extrapolated: sweep avg cost/entry for this model x corpus "
            f"entry count x {LLM_COST_SAFETY_MULTIPLIER:g} cost-drift "
            f"safety margin (naive condition; coached runs add "
            f"system-prompt tokens, expect slightly more)"
        )
        return est, basis
    return None, "no sweep data for this model"


#: Rows per page when reading the leaderboard. Supabase/PostgREST caps
#: single responses (commonly at 1,000 rows) regardless of the limit
#: parameter, so the board MUST be read in pages — a single capped GET
#: would silently rank the queue on a truncated scoreboard once the
#: board outgrows the cap.
FETCH_PAGE_SIZE = 1000


def _fetch_run_rows(page_size: int = FETCH_PAGE_SIZE) -> list[dict]:
    """Read the ENTIRE leaderboard, page by page.

    Pages are ordered by the primary key so pagination is stable while
    rows are being inserted concurrently (an unordered offset walk can
    skip or duplicate rows between pages).
    """
    rows: list[dict] = []
    offset = 0
    while True:
        url = (
            f"{SUPABASE_URL}/rest/v1/run_cards"
            "?select=dataset_id,model_slug,condition,chrf_plus_plus,"
            "submitted_at,corpus_size,chrf_ci_lower,chrf_ci_upper"
            "&trust=neq.disqualified&order=id.asc"
            f"&limit={page_size}&offset={offset}"
        )
        req = urllib.request.Request(
            url,
            headers={
                "apikey": SUPABASE_ANON_KEY,
                "Authorization": f"Bearer {SUPABASE_ANON_KEY}",
            },
        )
        with urllib.request.urlopen(req, timeout=30) as resp:
            page = json.loads(resp.read())
        rows.extend(page)
        if len(page) < page_size:
            return rows
        offset += page_size


def fetch_results() -> tuple[set[tuple[str, str, str]], list[dict]]:
    """Fetch ALL published runs: coverage combos + scored result rows.

    Returns (combos, results):
      combos  — (dataset_token, model_short, condition) already on the
                board (dataset_token matched loosely against registry id
                and corpus file stem, because publish.py resolves
                dataset_id from either).
      results — [{token, model, condition, strength}] for rows carrying
                a corpus-level chrF++ (the canonical published number,
                fair-scoring policy §4); strength = chrf/100 ∈ [0,1].

    The whole board is paged in (see _fetch_run_rows) — the formula's
    contract is "every published, non-disqualified run is evidence",
    at any board size.
    """
    rows = _fetch_run_rows()
    combos = set()
    results = []
    for row in rows:
        ds = (row.get("dataset_id") or "").strip().lower()
        model = model_short(row.get("model_slug") or "")
        cond = (row.get("condition") or "").strip().lower()
        # Coaching runs publish condition labels like "coached-v1" or a
        # method-card class like "coached-llm" — normalize to "coached".
        if "coach" in cond:
            cond = "coached"
        combos.add((ds, model, cond))
        chrf = row.get("chrf_plus_plus")
        if chrf is not None and 0 <= chrf <= 100:
            lo, hi = row.get("chrf_ci_lower"), row.get("chrf_ci_upper")
            ci_half = (
                (hi - lo) / 2.0
                if lo is not None and hi is not None and hi >= lo
                else None
            )
            results.append({
                "token": ds,
                "model": model,
                "condition": cond,
                "strength": chrf / 100.0,
                "submitted_at": row.get("submitted_at"),
                "n_eval": row.get("corpus_size") or 0,
                "ci_half": ci_half,
            })
    return combos, results


# ---------------------------------------------------------------------------
# Expected-chain-value v2 — evidence, chain matrix, marginal gain, prediction
# (normative spec: cli/website/docs/network/specifications/queue-construction.md)
# ---------------------------------------------------------------------------

def build_evidence(datasets: list[dict], results: list[dict]) -> dict:
    """Aggregate published results into the quantities the formula needs.

    ``datasets`` should be the FULL registry list, not just
    queue-eligible corpora: results published on NC or restricted
    corpora (e.g. the EdTeKLA eng→crk runs) are still legitimate
    measurements of their language pair. Eligibility gates what the
    queue can ask contributors to run — never what the mesh is allowed
    to know.

    Returns a dict with:
      edge_strength   {frozenset pair: max strength}      — s(e)
      pair_scores     {frozenset pair: [strengths]}       — back-off lvl 1
      target_scores   {lang: [strengths]}                 — back-off lvl 2
      source_scores   {lang: [strengths]}                 — back-off lvl 3
      all_scores      [strengths]                         — back-off lvl 4
      cell_counts     {(pair, model): n}                  — bonus n
      model_deltas    {model: [s − pair-mean-of-others]}  — β̂ inputs
      cond_deltas_pair    {pair: [coached − naive, same (pair, model)]}
      cond_deltas_target  {target lang: [same deltas]}
      n_results       int
    """
    token_pair: dict[str, tuple[str, str]] = {}
    token_dataset: dict[str, dict] = {}
    for ds in datasets:
        # Evidence keys on the RESOLVED pair (script-suffix strip, clean
        # retirements, variety pins) so a run on an eng>cmn-Hans corpus is
        # evidence for eng–cmn; unresolved macro/collective corpora keep
        # their raw labels — their own honest node, never a member's.
        pair = resolved_pair(ds)
        if pair is None:
            continue
        token_pair[ds["id"].lower()] = pair
        token_dataset[ds["id"].lower()] = ds
        if ds.get("path"):
            stem = Path(ds["path"]).stem.lower()
            token_pair[stem] = pair
            token_dataset[stem] = ds

    pair_scores: dict[frozenset, list[float]] = {}
    target_scores: dict[str, list[float]] = {}
    source_scores: dict[str, list[float]] = {}
    all_scores: list[float] = []
    cell_counts: dict[tuple[frozenset, str], int] = {}
    by_pair_model: dict[tuple[frozenset, str], list[float]] = {}
    by_pair_model_cond: dict[tuple[frozenset, str, str], list[float]] = {}
    best_run: dict[frozenset, dict] = {}   # the run that set the edge's q
    edge_runs: dict[frozenset, int] = {}

    for r in results:
        pair = token_pair.get(r["token"])
        if pair is None:
            continue  # row predates the registry or uses a legacy id
        src, tgt = pair
        e = frozenset(pair)
        s = r["strength"]
        pair_scores.setdefault(e, []).append(s)
        target_scores.setdefault(tgt, []).append(s)
        source_scores.setdefault(src, []).append(s)
        all_scores.append(s)
        cell = (e, r["model"])
        cell_counts[cell] = cell_counts.get(cell, 0) + 1
        by_pair_model.setdefault(cell, []).append(s)
        by_pair_model_cond.setdefault(
            (e, r["model"], r["condition"]), []
        ).append(s)
        edge_runs[e] = edge_runs.get(e, 0) + 1
        if e not in best_run or s > best_run[e]["strength"]:
            best_run[e] = r

    # ---- Bridge facts per edge (reliability layer, ecv-v3) --------------
    # q from the best run; n/CI from that same run; richness from the
    # corpus that run used (registry backfill); replication = run count.
    edge_bridge: dict[frozenset, dict] = {}
    for e, br in best_run.items():
        ds = token_dataset.get(br["token"]) or {}
        eff_words = (ds.get("richness") or {}).get("mean_effective_words")
        n_eval = br.get("n_eval") or 0
        runs = edge_runs.get(e, 0)
        factors = reliability_factors(
            n_eval, eff_words, br.get("ci_half"), runs,
        )
        q = max(pair_scores[e])
        edge_bridge[e] = {
            "q": round(q, 4),
            **factors,
            "s_eff": round(q * factors["r"], 4),
            "n_eval": n_eval,
            "ci_half": (round(br["ci_half"], 2)
                        if br.get("ci_half") else None),
            "eff_words": eff_words,
            "runs": runs,
            "tier": bridge_tier(n_eval, eff_words, br.get("ci_half"), runs),
        }

    # Model offsets: how a model does relative to the other models on the
    # same pair, averaged over pairs where a comparison exists (a plain
    # two-way main-effects decomposition — no opaque fitting).
    model_deltas: dict[str, list[float]] = {}
    pairs_models: dict[frozenset, dict[str, float]] = {}
    for (e, m), scores in by_pair_model.items():
        pairs_models.setdefault(e, {})[m] = sum(scores) / len(scores)
    for e, per_model in pairs_models.items():
        if len(per_model) < 2:
            continue
        for m, mean_m in per_model.items():
            others = [v for mm, v in per_model.items() if mm != m]
            model_deltas.setdefault(m, []).append(
                mean_m - sum(others) / len(others)
            )

    # Condition offset: coached − naive on the same (pair, model).
    # Kept at pair/target-language level only — coaching gains do NOT
    # generalize globally (the large eng→crk FST-coached uplift says
    # nothing about coaching Faroese), and on unscored pairs the
    # baseline-first convention should hold.
    cond_deltas_pair: dict[frozenset, list[float]] = {}
    cond_deltas_target: dict[str, list[float]] = {}
    pair_target = {}
    for ds in datasets:
        lp = ds.get("language_pair")
        if lp:
            pair_target[frozenset((lp["source"], lp["target"]))] = lp["target"]
    for (e, m, cond), scores in by_pair_model_cond.items():
        if cond != "coached":
            continue
        naive = by_pair_model_cond.get((e, m, "naive"))
        if naive:
            delta = sum(scores) / len(scores) - sum(naive) / len(naive)
            cond_deltas_pair.setdefault(e, []).append(delta)
            tgt = pair_target.get(e)
            if tgt:
                cond_deltas_target.setdefault(tgt, []).append(delta)

    return {
        # quality space (predictions back off over these)
        "edge_strength": {e: max(v) for e, v in pair_scores.items()},
        # bridge space (reliability layer; s_eff drives the chain matrix)
        "edge_bridge": edge_bridge,
        "pair_scores": pair_scores,
        "target_scores": target_scores,
        "source_scores": source_scores,
        "all_scores": all_scores,
        "cell_counts": cell_counts,
        "model_deltas": model_deltas,
        "cond_deltas_pair": cond_deltas_pair,
        "cond_deltas_target": cond_deltas_target,
        "n_results": len(all_scores),
        "token_dataset": token_dataset,
        # Judge-lane view for rank-mode edv (spec §2.3.1): same results,
        # organized around same-corpus method contrasts.
        "judge": build_judge_evidence(results, token_pair),
    }


def build_chain_matrix(
    nodes: list[str],
    edge_strength: dict[frozenset, float],
    lam: float = LAMBDA,
) -> dict[str, dict[str, float]]:
    """All-pairs best-chain strengths Q(u,v) = max_P λ^(|P|-1)·Π s(e).

    Computed exactly as shortest paths under w(e) = −ln(λ·s(e)) ≥ 0
    (Dijkstra), then Q = exp(−d)/λ for u≠v and Q(u,u) = 1. λ·s ≤ 1
    keeps weights non-negative, so Dijkstra applies.
    """
    import heapq
    import math

    adj: dict[str, list[tuple[str, float]]] = {u: [] for u in nodes}
    for e, s in edge_strength.items():
        if s <= 0:
            continue
        pair = tuple(e)
        if len(pair) != 2:
            continue
        a, b = pair
        if a in adj and b in adj:
            w = -math.log(lam * min(s, 1.0))
            adj[a].append((b, w))
            adj[b].append((a, w))

    Q: dict[str, dict[str, float]] = {}
    for src in nodes:
        dist = {src: 0.0}
        heap = [(0.0, src)]
        while heap:
            d, u = heapq.heappop(heap)
            if d > dist.get(u, float("inf")):
                continue
            for v, w in adj[u]:
                nd = d + w
                if nd < dist.get(v, float("inf")) - 1e-15:
                    dist[v] = nd
                    heapq.heappush(heap, (nd, v))
        row = {}
        for v in nodes:
            if v == src:
                row[v] = 1.0
            elif v in dist:
                row[v] = math.exp(-dist[v]) / lam
            else:
                row[v] = 0.0
        Q[src] = row
    return Q


def single_edge_gain(
    nodes: list[str],
    Q: dict[str, dict[str, float]],
    a: str,
    b: str,
    s_new: float,
    lam: float = LAMBDA,
) -> float:
    """Exact ΔΦ from raising edge (a,b) to strength s_new.

    A best chain in the upgraded graph either ignores the new edge or
    uses it exactly once (multiplicative weights ≤ 1 make repeat use
    dominated), so:

        Q'(u,v) = max(Q(u,v), E(u,a)·s_new·E(b,v), E(u,b)·s_new·E(a,v))

    with E(x,y) = λ·Q(x,y) for x≠y (a junction is crossed to continue
    the chain) and E(x,x) = 1 (the chain starts/ends at the new edge).
    ΔΦ is the mean increase over ordered pairs.
    """
    if s_new <= 0 or a not in Q or b not in Q:
        return 0.0
    n = len(nodes)
    if n < 2:
        return 0.0

    def E(x: str, y: str) -> float:
        return 1.0 if x == y else lam * Q[x][y]

    total = 0.0
    for u in nodes:
        Eua, Eub = E(u, a), E(u, b)
        Qu = Q[u]
        for v in nodes:
            if u == v:
                continue
            cand = s_new * max(Eua * E(b, v), Eub * E(a, v))
            cur = Qu[v]
            if cand > cur:
                total += cand - cur
    return total / (n * (n - 1))


def predict_strength(
    pair: tuple[str, str],
    model: str,
    condition: str,
    evidence: dict,
    *,
    kappa: float = KAPPA,
) -> dict:
    """Transparent score prediction for an unrun (pair, model, condition).

    ŝ = clip(pair_prior + model_offset + condition_offset + bonus,
             0, S_CAP), with every component returned for display.

    pair_prior: hierarchical back-off — mean of published strengths on
    this pair, else on this target language, else on this source
    language, else globally, else S0_FALLBACK. model_offset /
    condition_offset: mean observed deltas (0 without evidence). bonus:
    κ·sqrt(2·ln(1+N)/(1+n)) — the UCB1 schedule (Auer et al. 2002) with
    n = published runs on this (pair, model); we borrow the optimism
    schedule, not the regret theorem.
    """
    import math

    e = frozenset(pair)
    src, tgt = pair

    def _mean(xs: list[float] | None) -> float | None:
        return sum(xs) / len(xs) if xs else None

    for level, value in (
        ("pair", _mean(evidence["pair_scores"].get(e))),
        ("target-language", _mean(evidence["target_scores"].get(tgt))),
        ("source-language", _mean(evidence["source_scores"].get(src))),
        ("global", _mean(evidence["all_scores"])),
        ("default", S0_FALLBACK),
    ):
        if value is not None:
            prior, prior_basis = value, level
            break

    deltas = evidence["model_deltas"].get(model)
    model_offset = sum(deltas) / len(deltas) if deltas else 0.0
    cond_offset = 0.0
    if condition == "coached":
        local = (
            evidence["cond_deltas_pair"].get(e)
            or evidence["cond_deltas_target"].get(tgt)
        )
        if local:
            cond_offset = sum(local) / len(local)

    n_cell = evidence["cell_counts"].get((e, model), 0)
    n_total = evidence["n_results"]
    bonus = kappa * math.sqrt(
        2.0 * math.log(1.0 + n_total) / (1.0 + n_cell)
    ) if n_total > 0 else 0.0

    predicted = max(0.0, min(
        S_CAP, prior + model_offset + cond_offset + bonus,
    ))
    return {
        "pair_prior": round(prior, 4),
        "prior_basis": prior_basis,
        "model_offset": round(model_offset, 4),
        "condition_offset": round(cond_offset, 4),
        "exploration_bonus": round(bonus, 4),
        "predicted_strength": round(predicted, 4),
    }


#: chrF++ display bands for the public mesh visualization (champollion.dev/mesh).
#: Band edges in chrF++ points: <40 red, 40–55 orange, 55–70 yellow,
#: 70–80 green, 80–90 blue, 90+ white.
MESH_BANDS = [40, 55, 70, 80, 90]


def _is_flores_ntrex(ds: dict) -> bool:
    """True when a corpus is a FLORES / NTREX multiway catalogue entry.

    FLORES is HIGH-contamination illustration-only data (relative-only lane,
    `docs/DATA_BOUNDARIES.md`): it is never a chain edge. We sniff the
    registry_source plus the id/source name so a card that mislabels its
    contamination can't sneak a FLORES edge into the clean chaining graph.
    """
    blob = " ".join(
        str(ds.get(k) or "") for k in ("registry_source", "id", "source")
    ).lower()
    return "flores" in blob or "ntrex" in blob


def _corpus_is_clean(ds: dict) -> bool:
    """A corpus is *clean* (usable as a chain-bridge edge) ONLY when its
    contamination grade is explicitly LOW and it is not a FLORES/NTREX
    catalogue set. Everything else — MEDIUM, HIGH, NONE, or an unknown/missing
    grade — is NOT clean (FAIL SAFE).

    This is the per-edge gate the public /mesh "unprecedented pairs" gallery
    routes over: a bridge is only ever traversed when we can positively vouch
    for it as low-contamination. It must never route through a corpus whose
    grade is merely "possibly contaminated" (MEDIUM), illustration-only (HIGH /
    FLORES / NTREX), unassessed (NONE), or absent. This mirrors the relative-
    only lane policy (arena/mt_eval_harness/contamination.py): only positively-
    LOW corpora are rankable on absolute quality, and only those are bridges."""
    cont = (ds.get("contamination") or "").upper()
    return cont == "LOW" and not _is_flores_ntrex(ds)


def build_mesh_snapshot(
    corpora: list[dict],
    evidence: dict,
    results: list[dict],
    registry: dict,
    *,
    phi_current: float,
) -> dict:
    """Assemble the mesh visualization artifact (static/mesh.json).

    The artifact answers "how did the mesh get filled, and how strong is
    it?": one node per language (with language-card coordinates for the
    geographic layout), one edge per registered language pair, and for
    measured edges the full time-ordered run history so the page can
    replay growth. Edge ``size`` is the largest registered corpus on the
    pair (the visualization maps it to stroke thickness).
    """
    # token → (pair, size) over the full registry; pair-level max size.
    token_pair: dict[str, tuple[str, str]] = {}
    pair_size: dict[frozenset, int] = {}
    pair_status: dict[frozenset, str] = {}
    # Per-pair "clean" flag: True when at least one registered corpus on the
    # pair is explicitly LOW contamination and not FLORES/NTREX (see
    # _corpus_is_clean — MEDIUM/HIGH/NONE/unknown all fail safe to NOT clean).
    # The /mesh chaining gallery only ever routes through clean edges, so a
    # pair whose data is FLORES/HIGH/MEDIUM (illustration-only or merely
    # possibly-contaminated) is excluded as a bridge.
    pair_clean: dict[frozenset, bool] = {}
    for ds in registry.get("datasets", []):
        # Mesh nodes/edges key on the RESOLVED pair (same rule as
        # build_evidence): eng>cmn-Hans corpora light the eng–cmn edge;
        # unresolved macro/collective corpora keep their raw labels as
        # their own honestly-marked nodes (see the node scope markers).
        pair = resolved_pair(ds)
        if pair is None:
            continue
        # Skip self-pairs (source == target): they collapse to a 1-element
        # edge and aren't a translation direction. build_registry already
        # excludes them from the registry; this guards the nightly mesh job
        # against a stray one ever crashing the whole regeneration.
        if pair[0] == pair[1]:
            continue
        e = frozenset(pair)
        token_pair[ds["id"].lower()] = pair
        if ds.get("path"):
            token_pair[Path(ds["path"]).stem.lower()] = pair
        pair_size[e] = max(pair_size.get(e, 0), ds.get("size") or 0)
        pair_status.setdefault(e, "registered")
        pair_clean[e] = pair_clean.get(e, False) or _corpus_is_clean(ds)

    # Per-edge run history, time-ordered.
    edge_runs: dict[frozenset, list[tuple[str, float]]] = {}
    for r in results:
        pair = token_pair.get(r["token"])
        if pair is None or not r.get("submitted_at"):
            continue
        e = frozenset(pair)
        edge_runs.setdefault(e, []).append(
            (r["submitted_at"], round(r["strength"] * 100, 2))
        )
    for runs in edge_runs.values():
        runs.sort()

    # Nodes: every language in any registered pair, with card coordinates.
    # Benchmark-eligible pairs arrive RESOLVED (individual codes with flat
    # cards); the remaining macro/collective-labeled nodes — historical or
    # doctrine-excluded evidence — get honest names from the macrolanguage
    # hub cards / pinned ISO tables plus a ``scope`` marker, and are NEVER
    # merged into a member variety (that would fabricate a variety claim).
    langs = sorted({lang for e in pair_size for lang in e})
    nodes = []
    for lang in langs:
        card_path = CARDS_DIR / f"{lang}.json"
        name, lat, lng, family = lang, None, None, None
        scope = None
        if card_path.exists():
            try:
                card = json.loads(card_path.read_text(encoding="utf-8"))
                # Both fields may be attribution envelopes — see display().
                # `name` takes the identity opt-out; `family` asks Glottolog,
                # matching language_family() so a node's family and its
                # stratum key cannot disagree.
                name = display(card.get("name"), on_disagreement="first") or lang
                coords = card.get("coordinates") or {}
                lat, lng = coords.get("lat"), coords.get("lng")
                family = display(
                    (card.get("classification") or {}).get("family"),
                    prefer_source="glottolog",
                )
                # ISO 639-3's scope, in BOTH spellings. The old corpus stored
                # the registry initial ("M"); the atlas records the legible
                # word ("Macrolanguage") by a deliberate decision in
                # parameters.csv. Testing only for "M" silently marked every
                # macrolanguage as an ordinary language, so the mesh lost its
                # umbrella nodes — the third place this same rename has bitten,
                # after the site's living-language count and the card linter.
                iso_scope = str(card.get("isoScope") or "").upper()
                if iso_scope in ("M", "MACROLANGUAGE"):
                    scope = "macrolanguage"
            except json.JSONDecodeError:
                pass
        else:
            base, _script = iso_resolution.parse_code(lang)
            cls = iso_resolution.classify(base)
            hub = CARDS_DIR / "genera" / f"macrolanguage-{base}.json"
            if hub.is_file():
                try:
                    name = (json.loads(hub.read_text(encoding="utf-8"))
                            .get("name")) or name
                except (json.JSONDecodeError, OSError):
                    pass
            if name == lang:
                name = iso_resolution.iso_ref_name(base) or lang
            if cls in ("macrolanguage", "collective", "retired"):
                scope = cls
        node = {
            "id": lang, "name": name, "lat": lat, "lng": lng,
            "family": family,
        }
        if scope:
            node["scope"] = scope
        nodes.append(node)

    edges = []
    for e in sorted(pair_size, key=lambda x: tuple(sorted(x))):
        a, b = sorted(e)
        runs = edge_runs.get(e, [])
        bridge = (evidence.get("edge_bridge") or {}).get(e)
        edge_obj = {
            "a": a,
            "b": b,
            "size": pair_size[e],
            "status": "measured" if runs else "registered",
            # Chain-eligibility: only clean (LOW/MEDIUM/NONE, non-FLORES) edges
            # may be traversed by the /mesh unprecedented-pairs gallery and the
            # best-measured-path finder. FLORES/HIGH edges still render on the
            # map but are never used as a bridge.
            "clean": pair_clean.get(e, False),
            "best_chrf": max((c for _t, c in runs), default=None),
            # Reliability layer (ecv-v3): the viz maps r to opacity and
            # shows the tier; q stays the color band.
            "reliability": bridge["r"] if bridge else None,
            "tier": bridge["tier"] if bridge else "registered",
            "runs": [[t, c] for t, c in runs],
        }
        # Full factor breakdown for the bridge inspector's per-factor
        # bars, "what this bridge needs" panel, and lens overlays.
        if bridge:
            edge_obj.update({
                "f_size": bridge["f_size"],
                "f_rich": bridge["f_rich"],
                "f_conf": bridge["f_conf"],
                "f_repl": bridge["f_repl"],
                "s_eff": bridge["s_eff"],
                "n_eval": bridge["n_eval"],
                "eff_words": bridge.get("eff_words"),
            })
            # Compute actionable "needs" — what would push each factor
            # to 1.0 — so the inspector can show "+53 entries" etc.
            needs = {}
            if bridge["f_size"] < 1.0:
                needs["entries"] = RELIABILITY_N_FULL - (bridge["n_eval"] or 0)
            if bridge["f_rich"] < 1.0 and bridge.get("eff_words") is not None:
                needs["eff_words_gap"] = round(
                    RELIABILITY_L_HEALTHY - bridge["eff_words"], 1
                )
            if bridge["f_repl"] < 1.0:
                needs["replications"] = RELIABILITY_RUNS_FULL - bridge["runs"]
            if needs:
                edge_obj["needs"] = needs
        edges.append(edge_obj)

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "generator": "arena/scripts/generate_sweep_queue.py",
        "formula_version": "ecv-v3",
        "phi_current": round(phi_current, 6),
        "bands_chrf": MESH_BANDS,
        "band_note": (
            "chrF++ display bands: <40 red, 40-55 orange, 55-70 yellow, "
            "70-80 green, 80-90 blue, 90+ white. Edge thickness scales "
            "with the largest registered corpus on the pair. Development-"
            "set readings — see /docs (scores are baselines, not "
            "capability claims)."
        ),
        "nodes": nodes,
        "edges": edges,
    }


# =====================================================================
# Published-artifact shaping
# =====================================================================
# The served queue.json (champollion.dev/queue.json) is the contributor /
# agent work-list: per item it must carry what to run, what it costs, and a
# pasteable command — nothing more. Two field groups are dropped from the
# *published* file so it stays well under GitHub's 100 MB per-file limit and
# is cheap for the browser pages to consume; both are preserved elsewhere:
#
#   * ranking diagnostics — the full ecv-v3 formula breakdown. Items are
#     emitted in priority order and the per-edge quality/reliability bridges
#     are published in mesh.json, so the ranking stays re-derivable from the
#     normative spec without repeating ~16 floats on every one of ~60k items.
#   * per-item corpus-fetch provenance — the canonical copy lives in
#     registry.json (served alongside, keyed by corpus_id); the harness
#     resolves corpora by id through the registry, never from the queue item.
#
# Everything the harness, the run_queue one-liner, the agent prompt, and the
# leaderboard/contribute pages actually read is kept.
# ---------------------------------------------------------------------------
# Final ranking order — greedy ECV sort + frontier interleave
# ---------------------------------------------------------------------------

def ecv_sort_key(it: dict):
    """Greedy ranking key (spec §3): contamination-weighted ECV descending;
    ties break naive before coached, cheaper first, then item id."""
    return (
        -it["ecv_per_usd"],                          # mesh value per $
        it["condition"] != "naive",                  # naive before coached
        it["est_cost_usd"] if it["est_cost_usd"] is not None else 10**9,
        it["id"],
    )


def interleave_frontier(
    items: list[dict],
    frontier: frozenset[str] | set[str] = FRONTIER_MODELS,
    every: int = FRONTIER_INTERLEAVE_EVERY,
) -> list[dict]:
    """Re-weave the greedy-sorted list so every ``every``-th slot (1-indexed
    positions ``every``, ``2·every``, …) carries the highest-ranked
    not-yet-placed item whose model is in ``frontier`` (2026-07-12 remedy #2).

    Pure reordering: nothing is dropped or duplicated. When no frontier items
    remain the natural order simply continues, and non-frontier items are
    never displaced into oblivion — they only shift down. A frontier item
    that already earned a natural slot keeps it (the reserved slot then takes
    the NEXT best frontier item). Callers must renumber ``priority`` from the
    returned order."""
    if every < 2 or not items:
        return list(items)
    frontier_idx = [
        i for i, it in enumerate(items)
        if (it.get("model") or "") in frontier
    ]
    placed = [False] * len(items)
    out: list[dict] = []
    gi = 0  # next unplaced item overall (natural order)
    fp = 0  # next unplaced frontier item (pointer into frontier_idx)
    for slot in range(1, len(items) + 1):
        take = None
        if slot % every == 0:
            while fp < len(frontier_idx) and placed[frontier_idx[fp]]:
                fp += 1
            if fp < len(frontier_idx):
                take = frontier_idx[fp]
                fp += 1
        if take is None:
            while placed[gi]:
                gi += 1
            take = gi
        placed[take] = True
        out.append(items[take])
    return out


# ---------------------------------------------------------------------------
# Map-value mode (--rank-mode map) — survey ordering, founder review
# 2026-07-18 (docs/QUEUE_ALGORITHM_REVIEW_2026-07-18.md); v2 bridge/quality
# terms per founder direction 2026-07-19 (spec §2.2 is normative)
# ---------------------------------------------------------------------------
# Re-ranks the SAME items for a different campaign objective: maximize what
# the MAP learns per dollar (first measurements across pairs, languages,
# families, method-cells, and domains) instead of what the MESH gains per
# dollar — while growing OUT of the measured network instead of scattering.
#
#     MapValue = novelty · uncertainty · promise · connectivity
#                · corpus-quality · contamination ÷ cost
#
#   novelty      positional first-light credit — decays as items already
#                PLACED ABOVE occupy the same pair / target language / target
#                family / (method × target-family) / (target × domain) cell;
#   uncertainty  how much the result would move the map: prediction back-off
#                depth (prior_basis) × 1/(1+edge runs) — replication is
#                ecv-mode value, not survey value;
#   promise      predicted_strength floored at MAP_PROMISE_FLOOR (likely-
#                working unknowns first; definite-desert probes stay alive —
#                negative knowledge is also lay of the land);
#   connectivity (v2) bridge-into-network credit: full for pairs with
#                exactly one endpoint in the measured/covered network
#                ("link established paths to new paths" — founder
#                2026-07-19), reduced for islands (neither endpoint) and
#                interior densification (both endpoints);
#   corpus-quality (v2) the corpus's intrinsic reliability potential
#                f_size · f_rich (spec §1.5) — a 62-entry vocabulary list
#                must not headline the survey just because it is cheap;
#   contamination / cost — identical honesty machinery to ecv mode.
#
# Assembly is an EXACT lazy greedy: novelty is monotone non-increasing in the
# placement counters and every other factor is order-independent, so a stale
# heap key can only overestimate — pop, recompute, accept iff still at least
# the next-best key (verified identical to brute-force greedy in
# tests/test_queue_map_mode.py). Family facts come from the language cards
# (SSOT); a card-less or family-less language counts as its own stratum,
# never pooled into a shared "unknown" bucket.

#: Uncertainty weight per prediction back-off basis (predict_strength's
#: prior_basis): deeper back-off = less known = more survey value.
MAP_BASIS_UNCERTAINTY = {
    "pair": 0.25,
    "target-language": 0.55,
    "source-language": 0.75,
    "global": 1.0,
    "default": 1.0,
}

#: Floor for the promise factor — a probe predicted to fail still carries
#: survey value (documenting a desert), just never top-dollar value.
MAP_PROMISE_FLOOR = 0.25

#: Connectivity factors (map-value v2, founder direction 2026-07-19): the
#: survey should GROW OUT of the measured network, not scatter. An endpoint
#: is ESTABLISHED when it lies on any measured mesh edge (a published,
#: non-disqualified run — mesh.json status "measured") or inside any MT
#: service's published coverage list (macrolanguage-aliased, the same
#: aliasing rule as the llm-lane gate). Classes:
#:   bridge   — exactly ONE endpoint established: running it links the
#:              network to a language it cannot currently reach ("link
#:              established paths to new paths"). Full credit.
#:   island   — NEITHER endpoint established: first light on two unknowns.
#:              FULL credit since 2026-08-27 (founder ruling, ninth
#:              principle: "first light outranks refinement") — the
#:              2026-07-19 sizing scored islands 0.5 so growth stayed
#:              rooted in the measured network, which structurally demoted
#:              the deepest tail; a disconnected desert's first reading now
#:              counts as much as a bridge.
#:   interior — BOTH endpoints established: densification between known
#:              points is ecv-mode's business, lowest survey priority
#:              (novelty's method/domain cells still surface genuinely new
#:              interior measurements).
MAP_CONNECTIVITY_FACTORS = {"bridge": 1.0, "island": 1.0, "interior": 0.5}

#: Ninth-principle multiplier (founder, 2026-08-27): an item that buys a
#: LANGUAGE's first published measurement anywhere — either side of the
#: pair has zero board runs — is worth this factor on the survey term.
#: The uncertainty back-off treats "unmeasured pair between two measured
#: languages" and "never-measured language" identically; this factor is
#: what distinguishes them. Spec §2.2.
MAP_FIRST_READING_BOOST = 2.0

_FAMILY_CACHE: dict[str, str] = {}


def language_family(iso3: str) -> str:
    """Glottolog family name for a language code, read from its language
    card (classification.family — SSOT; cards are generated from Glottolog,
    lint rule R5). A missing card or family yields a per-language stratum
    ``lang:<code>`` so unclassified languages and isolates each count as
    their own family rather than pooling into one mega-bucket."""
    code = (iso3 or "").strip().lower()
    if not code:
        return "lang:?"
    cached = _FAMILY_CACHE.get(code)
    if cached is not None:
        return cached
    family = f"lang:{code}"
    card = CARDS_DIR / f"{code}.json"
    if card.is_file():
        try:
            data = json.loads(card.read_text(encoding="utf-8"))
            # `family` is an ATTRIBUTION ENVELOPE wherever the sources
            # disagree, and 946 languages do — Glottolog says "Atlantic-Congo"
            # where WALS says "Niger-Congo". Read raw, that dict went straight
            # into the `fam_visible` set below and raised "unhashable type:
            # dict".
            #
            # This function's contract is already specific: its docstring says
            # the GLOTTOLOG family name. So it asks Glottolog, rather than
            # flattening the disagreement or picking whichever claim happens to
            # be first. A stratum key has to be one value; taking it from the
            # named authority keeps the strata reproducible even as new sources
            # land and turn more families into disagreements.
            name = display(
                (data.get("classification") or {}).get("family"),
                prefer_source="glottolog",
            )
            if name:
                family = name
        except (json.JSONDecodeError, OSError):
            pass
    _FAMILY_CACHE[code] = family
    return family


def map_uncertainty(prior_basis: str | None, edge_runs: int) -> float:
    """Back-off-depth uncertainty × replication discount, in (0, 1]."""
    basis = MAP_BASIS_UNCERTAINTY.get(prior_basis or "default", 1.0)
    return basis / (1.0 + max(0, edge_runs))


def map_connectivity(
    src: str,
    tgt: str,
    measured_langs: frozenset | set,
    service_covered: frozenset | set,
    macro_of=language_macrolanguage,
) -> tuple[str, float]:
    """Classify one pair against the measured/covered network — map-value
    v2's bridge-into-network term. Returns ``(class, factor)``.

    A side is ESTABLISHED when its code — or its card-recorded
    macrolanguage (coverage lists say zho/swa; corpora say cmn/swh) — is on
    a measured mesh edge or in the MT services' published coverage union.
    Exactly one established side → "bridge" (full credit: the run extends
    the network's reach to a new language); both → "interior"; neither →
    "island". Factor values + rationale: MAP_CONNECTIVITY_FACTORS.
    Everything here is re-derivable from published artifacts: measured
    edges from mesh.json, the coverage union from method-coverage.json,
    macrolanguage facts from the language cards."""
    def _established(code: str) -> bool:
        if code in measured_langs or code in service_covered:
            return True
        macro = macro_of(code)
        return bool(macro) and (
            macro in measured_langs or macro in service_covered
        )

    a, b = _established(src), _established(tgt)
    cls = "bridge" if a != b else ("interior" if a else "island")
    return cls, MAP_CONNECTIVITY_FACTORS[cls]


def _map_static_part(it: dict) -> float:
    """The item's order-independent factors: uncertainty · promise ·
    connectivity · corpus-quality · contamination ÷ cost. Multiplied by the
    positional novelty during assembly. Missing diagnostics degrade to the
    uninformed defaults (basis 'default', 0 runs, prior 0.5 promise,
    neutral connectivity, quality from entry_count when present else
    neutral, contamination from the grade) so the published slim item shape
    still ranks sanely."""
    unc = map_uncertainty(it.get("prior_basis"), it.get("edge_runs") or 0)
    promise = max(
        it.get("predicted_strength") or S0_FALLBACK, MAP_PROMISE_FLOOR,
    )
    conn = it.get("map_connectivity")
    if conn is None:
        conn = 1.0
    # Ninth principle: a language's first reading outranks refinement.
    fl = it.get("map_first_reading")
    if fl is None:
        fl = 1.0
    conn = conn * fl
    quality = it.get("map_corpus_quality")
    if quality is None:
        # Slim-shape fallback: entry_count is a published work-list field,
        # so f_size is still derivable; richness is not — stay neutral on
        # it (absence of measurement is not evidence of poverty).
        n = it.get("entry_count") or 0
        quality = min(1.0, n / RELIABILITY_N_FULL) if n else 1.0
    contam = it.get("contamination_factor")
    if contam is None:
        contam = contamination_ecv_factor(it.get("contamination"))
    cost = it.get("cost_for_value")
    if not cost:
        est = it.get("est_cost_usd")
        cost = max(est, COST_FLOOR) if est is not None else COST_FLOOR
    return unc * promise * conn * quality * contam / cost


def _map_tiebreak(it: dict):
    """Deterministic tie order matching ecv_sort_key's spirit: naive before
    coached, cheaper first, then id."""
    return (
        it["condition"] != "naive",
        it["est_cost_usd"] if it.get("est_cost_usd") is not None else 10**9,
        it["id"],
    )


def map_value_order(items: list[dict]) -> list[dict]:
    """Exact greedy map-value ranking (lazy evaluation).

    Stamps each item's selection-time diagnostics (map_novelty,
    map_uncertainty, map_promise, map_value) — unpublished, like the ecv
    breakdown fields; the v2 static inputs (map_connectivity,
    map_corpus_quality) are stamped at assembly and only READ here. Pure
    reordering: nothing dropped or duplicated.
    """
    import heapq

    if not items:
        return []

    pair_c: dict[str, int] = {}
    tgt_c: dict[str, int] = {}
    fam_c: dict[str, int] = {}
    cell_c: dict[tuple[str, str], int] = {}
    dom_c: dict[tuple[str, str], int] = {}

    def novelty(it: dict) -> float:
        src_tgt = it["language_pair"].split(">")
        tgt = src_tgt[1] if len(src_tgt) == 2 else src_tgt[0]
        fam = language_family(tgt)
        n_pair = pair_c.get(it["language_pair"], 0)
        n_tgt = tgt_c.get(tgt, 0)
        n_fam = fam_c.get(fam, 0)
        n_cell = cell_c.get((it.get("model") or "", fam), 0)
        # v2: (target × domain) cell — a target's early coverage should
        # spread across registers, not repeat the first domain measured
        # (domain from the corpus registry's 17-code taxonomy; a missing
        # domain is one shared per-target "unknown" stratum).
        n_dom = dom_c.get((tgt, it.get("domain") or "unknown"), 0)
        return (
            1.0 / (1.0 + n_pair)
            * (1.0 + n_tgt) ** -0.5
            * (1.0 + n_fam) ** -0.5
            * (1.0 + n_cell) ** -0.5
            * (1.0 + n_dom) ** -0.5
        )

    static = [_map_static_part(it) for it in items]
    # Heap key: (-value, tiebreak, index). Initial novelty is 1.0 for every
    # item (no counters yet), so the initial key needs no novelty() call.
    heap = [
        (-static[i], _map_tiebreak(it), i) for i, it in enumerate(items)
    ]
    heapq.heapify(heap)

    out: list[dict] = []
    while heap:
        neg_v, tb, i = heapq.heappop(heap)
        it = items[i]
        nov = novelty(it)
        entry = (-(static[i] * nov), tb, i)
        if heap and entry > heap[0]:
            # Stale (counters grew since this key was pushed) and no longer
            # best — re-queue at its true value.
            heapq.heappush(heap, entry)
            continue
        # Accept: stamp diagnostics, bump counters.
        src_tgt = it["language_pair"].split(">")
        tgt = src_tgt[1] if len(src_tgt) == 2 else src_tgt[0]
        fam = language_family(tgt)
        it["map_novelty"] = round(nov, 6)
        it["map_uncertainty"] = round(
            map_uncertainty(it.get("prior_basis"), it.get("edge_runs") or 0),
            4,
        )
        it["map_promise"] = round(
            max(it.get("predicted_strength") or S0_FALLBACK,
                MAP_PROMISE_FLOOR), 4,
        )
        it["map_value"] = round(static[i] * nov, 8)
        pair_c[it["language_pair"]] = pair_c.get(it["language_pair"], 0) + 1
        tgt_c[tgt] = tgt_c.get(tgt, 0) + 1
        fam_c[fam] = fam_c.get(fam, 0) + 1
        cell_key = (it.get("model") or "", fam)
        cell_c[cell_key] = cell_c.get(cell_key, 0) + 1
        dom_key = (tgt, it.get("domain") or "unknown")
        dom_c[dom_key] = dom_c.get(dom_key, 0) + 1
        out.append(it)
    return out


# ---------------------------------------------------------------------------
# Rank-mode edv — expected decision value (spec §2.3, 2026-08-27).
#
#   EDV(item) = [w_judge·Ĵ + w_mesh·M̂ + w_survey·Ŝ] × contamination ÷ cost
#
# Ĵ prices settling SAME-CORPUS method comparisons — the only cross-method
# claim the project's own measurement research licenses (research/w2-irt:
# cross-language ability transfer is NOT licensed; its positive result —
# within-language additive method×corpus adjustment — is exactly what the
# per-pair ranking below uses). Scores enter only as orderings and
# separations, never as acceptability probabilities (research/
# afri-calibration), and same-corpus contrasts cancel the per-language
# chance floor by construction (research/cchrf). M̂ is §3's expected mesh
# gain unchanged; Ŝ is map-v2's survey core unchanged. Constants change in
# the spec first; this block mirrors it.
# ---------------------------------------------------------------------------

#: Separation (chrF points over pooled CI half-widths) at which a
#: same-corpus method contrast counts as DECIDED.
Z_DEC = 1.96
#: Credit for creating a method pair's FIRST same-corpus contrast.
JUDGE_FIRST = 1.0
#: Credit scale for a run expected to help decide a CONTESTED contrast.
JUDGE_CONTESTED = 0.8
#: Credit scale (÷(1+n_dec)) for re-confirming an already-DECIDED contrast.
JUDGE_DECIDED = 0.25
#: Credit (÷(1+n_cond)) for a coached-vs-base contrast on the same
#: (corpus, method).
JUDGE_COND = 0.5
#: Diminishing returns across one item's own contrasts (sorted desc).
JUDGE_GAMMA = 0.7
#: Venue value of a corpus where future contrasts can be judged — the
#: graceful floor on an empty board. Never a borrowed score.
JUDGE_SEED = 0.25
#: How many contrast records ride the item diagnostics.
JUDGE_DIAG_MAX = 8
#: Per-component normalizer = p95 of positive values, capped here.
EDV_NORM_CAP = 4.0
#: Portfolio weights (founder-dialable via --edv-weights; echoed in
#: metadata.edv_parameters). Survey-leaning while the board is sparse.
EDV_DEFAULT_WEIGHTS = {"judge": 0.35, "mesh": 0.25, "survey": 0.40}


def _judge_lane(condition: str | None) -> str:
    """Contrast lane for a condition. 'coached' is its own lane; naive LLM
    and engine runs pool into 'base' — both are the method as shipped, no
    coaching, and Google-vs-GPT on the same corpus is exactly the
    capability-map comparison the judge component exists to price."""
    return "coached" if (condition or "").strip().lower() == "coached" else "base"


def _ci_points(ci_half: float | None, n_eval: int) -> float:
    """CI half-width in chrF POINTS: the recorded half-width when
    published, else the 50/√n proxy (fair-scoring §5)."""
    if ci_half is not None and ci_half > 0:
        return ci_half
    return 50.0 / math.sqrt(max(n_eval, 1))


def als_additive_rank(
    cells: dict[tuple[str, str], float], iters: int = 25,
) -> dict[str, float]:
    """Additive method×corpus fit over observed cells: score ≈ a_m + d_c,
    by alternating row/column means of residuals (missingness-aware ALS).

    This is the licensed within-language adjustment from research/w2-irt
    (code/02_fit_irt.py als_additive; 21/21 languages improved under
    unbalanced masks), reimplemented stdlib-only. The fit is STRICTLY per
    language pair — callers must never pool cells across pairs (W2's
    cross-language transfer falsifier is alive). a and d trade a constant
    (unidentified intercept); method ORDER, which is all we consume, is
    unaffected.
    """
    methods = sorted({m for m, _ in cells})
    corpora = sorted({c for _, c in cells})
    a = {m: 0.0 for m in methods}
    d = {c: 0.0 for c in corpora}
    by_m: dict[str, list[tuple[str, float]]] = {m: [] for m in methods}
    by_c: dict[str, list[tuple[str, float]]] = {c: [] for c in corpora}
    for (m, c), s in cells.items():
        by_m[m].append((c, s))
        by_c[c].append((m, s))
    for _ in range(iters):
        for m in methods:
            vals = [s - d[c] for c, s in by_m[m]]
            a[m] = sum(vals) / len(vals)
        for c in corpora:
            vals = [s - a[m] for m, s in by_c[c]]
            d[c] = sum(vals) / len(vals)
    return a


def build_judge_evidence(
    results: list[dict], token_pair: dict[str, tuple[str, str]],
) -> dict:
    """Judge-lane view of the board, for Ĵ (spec §2.3.1).

    Returns:
      runs:            {(token, lane): {model: {s, h, n}}}   best run/cell
      contrast_state:  {(pair, lane, frozenset({A,B})):
                        {"state": "contested"|"decided", "n_dec": int}}
                       (an absent method pair is "unmet")
      method_rank:     {(pair, lane): {model: 1-based rank}}
      rank_basis:      {(pair, lane): "als-adjusted"|"raw-mean"}
      cond_counts:     {(pair, model): n coached-vs-base corpora}
    """
    runs: dict[tuple[str, str], dict[str, dict]] = {}
    for r in results:
        s_val = r.get("strength")
        if not isinstance(s_val, (int, float)) or isinstance(s_val, bool):
            continue  # fetch_results guarantees floats; guard hand-fed rows
        lane = _judge_lane(r.get("condition"))
        cell = runs.setdefault((r["token"], lane), {})
        cur = cell.get(r["model"])
        if cur is None or r["strength"] > cur["s"]:
            cell[r["model"]] = {
                "s": r["strength"],
                "h": _ci_points(r.get("ci_half"), r.get("n_eval") or 0),
                "n": r.get("n_eval") or 0,
            }

    # Per (pair, lane): the method×corpus cells and the shared-corpus
    # separations per unordered method pair.
    pair_cells: dict[tuple[frozenset, str], dict[tuple[str, str], dict]] = {}
    for (token, lane), cell in runs.items():
        pair = token_pair.get(token)
        if pair is None:
            continue
        e = frozenset(pair)
        dest = pair_cells.setdefault((e, lane), {})
        for model, run in cell.items():
            dest[(model, token)] = run

    contrast_state: dict[tuple, dict] = {}
    method_rank: dict[tuple[frozenset, str], dict[str, int]] = {}
    rank_basis: dict[tuple[frozenset, str], str] = {}
    for (e, lane), cells in pair_cells.items():
        by_token: dict[str, dict[str, dict]] = {}
        methods = set()
        for (model, token), run in cells.items():
            by_token.setdefault(token, {})[model] = run
            methods.add(model)
        # Contrast states over corpora where both methods have runs.
        for token, per_model in by_token.items():
            ms = sorted(per_model)
            for i in range(len(ms)):
                for j in range(i + 1, len(ms)):
                    a_run, b_run = per_model[ms[i]], per_model[ms[j]]
                    sep = (
                        abs(a_run["s"] - b_run["s"]) * 100.0
                        / math.sqrt(a_run["h"] ** 2 + b_run["h"] ** 2)
                    )
                    key = (e, lane, frozenset((ms[i], ms[j])))
                    rec = contrast_state.setdefault(
                        key, {"state": "contested", "n_dec": 0})
                    if sep >= Z_DEC:
                        rec["state"] = "decided"
                        rec["n_dec"] += 1
        # Per-pair method ranking: the licensed ALS adjustment when the
        # pair has ≥2 methods × ≥2 corpora, else raw best score.
        distinct_tokens = len(by_token)
        if len(methods) >= 2 and distinct_tokens >= 2:
            ability = als_additive_rank(
                {(m, t): run["s"] for (m, t), run in cells.items()})
            basis = "als-adjusted"
        else:
            ability = {}
            for (m, _t), run in cells.items():
                if m not in ability or run["s"] > ability[m]:
                    ability[m] = run["s"]
            basis = "raw-mean"
        ordered = sorted(ability, key=lambda m: (-ability[m], m))
        method_rank[(e, lane)] = {m: i + 1 for i, m in enumerate(ordered)}
        rank_basis[(e, lane)] = basis

    # Coached-vs-base contrast counts per (pair, method).
    cond_counts: dict[tuple[frozenset, str], int] = {}
    for (token, lane), cell in runs.items():
        if lane != "coached":
            continue
        base_cell = runs.get((token, "base"), {})
        pair = token_pair.get(token)
        if pair is None:
            continue
        e = frozenset(pair)
        for model in cell:
            if model in base_cell:
                cond_counts[e, model] = cond_counts.get((e, model), 0) + 1

    return {
        "runs": runs,
        "contrast_state": contrast_state,
        "method_rank": method_rank,
        "rank_basis": rank_basis,
        "cond_counts": cond_counts,
    }


def judge_static_value(
    *,
    token: str,
    pair: frozenset,
    lane: str,
    model: str,
    s_hat: float,
    n_entries: int,
    corpus_quality: float,
    m_corpus: int,
    judge: dict,
) -> tuple[float, list[dict], str]:
    """The order-independent judge value of one candidate item (spec
    §2.3.1) and its diagnostics. `model` is the SHORT model name (evidence
    keys use model_short). Returns (J_static, contrasts_diag, rank_basis).
    """
    h_hat = 50.0 / math.sqrt(max(n_entries, 1))
    partners = judge["runs"].get((token, lane), {})
    ranks = judge["method_rank"].get((pair, lane), {})
    n_ranked = len(ranks)
    basis = judge["rank_basis"].get((pair, lane), "none")

    gs: list[dict] = []
    for m2, run in partners.items():
        if m2 == model:
            continue  # an exact repeat is coverage-dropped upstream
        rec = judge["contrast_state"].get(
            (pair, lane, frozenset((model, m2))))
        sep_pred = (
            abs(s_hat - run["s"]) * 100.0
            / math.sqrt(h_hat ** 2 + run["h"] ** 2)
        )
        if rec is None:
            kind, base = "first", JUDGE_FIRST
        elif rec["state"] == "contested":
            kind = "contested"
            base = JUDGE_CONTESTED * max(0.0, min(1.0, sep_pred / Z_DEC))
        else:
            kind = "decided"
            base = JUDGE_DECIDED / (1.0 + rec["n_dec"])
        r1 = ranks.get(model, n_ranked + 1)
        r2 = ranks.get(m2, n_ranked + 1)
        w_top = 1.0 / math.sqrt(r1 * r2)
        gs.append({
            "method": m2,
            "kind": kind,
            "sep_pred": round(sep_pred, 3),
            "w_top": round(w_top, 4),
            "g": base * w_top,
        })

    gs.sort(key=lambda g: (-g["g"], g["method"]))
    j = sum(g["g"] * JUDGE_GAMMA ** k for k, g in enumerate(gs))

    # Coached-vs-base contrast on the same (corpus, method).
    other = judge["runs"].get(
        (token, "base" if lane == "coached" else "coached"), {})
    if model in other:
        n_cond = judge["cond_counts"].get((pair, model), 0)
        g_cond = JUDGE_COND / (1.0 + n_cond)
        j += g_cond
        gs.append({"method": model, "kind": "condition",
                   "sep_pred": None, "w_top": 1.0, "g": g_cond})

    # Seed: venue value. Never zero everywhere, never a borrowed score.
    j += JUDGE_SEED * min(1.0, m_corpus / 3.0) * corpus_quality
    return j, gs[:JUDGE_DIAG_MAX], basis


def stamp_judge_statics(items: list[dict], evidence: dict) -> None:
    """Compute and stamp judge_static (+ diagnostics) on every item.
    Pure function of the item universe and the board evidence."""
    judge = evidence.get("judge") or {
        "runs": {}, "contrast_state": {}, "method_rank": {},
        "rank_basis": {}, "cond_counts": {},
    }
    # m_C: how many distinct lineup methods have a queue item on each
    # corpus — the static venue-size input to the seed term.
    methods_by_corpus: dict[str, set] = {}
    for it in items:
        methods_by_corpus.setdefault(
            (it.get("corpus_id") or "").lower(), set()
        ).add(it.get("model") or "")
    for it in items:
        token = (it.get("corpus_id") or "").lower()
        lp = (it.get("language_pair") or "").split(">")
        # A malformed pair gets an empty key that matches NO evidence —
        # never a synthesized key that could collide with a real pair.
        pair = frozenset(lp) if len(lp) == 2 else frozenset()
        quality = it.get("map_corpus_quality")
        if quality is None:
            n = it.get("entry_count") or 0
            quality = min(1.0, n / RELIABILITY_N_FULL) if n else 1.0
        j, contrasts, basis = judge_static_value(
            token=token,
            pair=pair,
            lane=_judge_lane(it.get("condition")),
            model=model_short(it.get("model") or ""),
            s_hat=it.get("predicted_strength") or S0_FALLBACK,
            n_entries=it.get("entry_count") or 0,
            corpus_quality=quality,
            m_corpus=len(methods_by_corpus.get(token, set())) - 1,
            judge=judge,
        )
        it["judge_static"] = round(j, 6)
        it["judge_contrasts"] = contrasts
        it["judge_rank_basis"] = basis


def _p95(values: list[float]) -> float:
    """95th percentile of the POSITIVE values (nearest-rank), else 1.0 —
    the outlier-robust normalizer of spec §2.3.3."""
    pos = sorted(v for v in values if v > 0)
    if not pos:
        return 1.0
    idx = min(len(pos) - 1, max(0, math.ceil(0.95 * len(pos)) - 1))
    return pos[idx]


def edv_value_order(
    items: list[dict],
    weights: dict[str, float] | None = None,
) -> tuple[list[dict], dict]:
    """Exact greedy expected-decision-value ranking (lazy evaluation) —
    spec §2.3.4. Same heap discipline as map_value_order: every
    order-dependent multiplier (survey novelty, judge placement decay) is
    monotone non-increasing in placements, so a stale key can only
    overestimate and the lazy trace equals brute-force greedy.

    Items must already carry judge_static (stamp_judge_statics), the ecv
    diagnostics (expected_mesh_gain, predicted_strength, prior_basis,
    edge_runs), and the map assembly stamps. Returns (ordered items,
    edv_parameters metadata block).
    """
    import heapq

    w = dict(EDV_DEFAULT_WEIGHTS)
    if weights:
        w.update(weights)

    if not items:
        return [], {"weights": w, "normalizers": None}

    def survey_static(it: dict) -> float:
        # map-v2 static minus contamination and cost — those live in the
        # shared EDV wrapper (spec: contamination applied exactly once).
        unc = map_uncertainty(it.get("prior_basis"), it.get("edge_runs") or 0)
        promise = max(
            it.get("predicted_strength") or S0_FALLBACK, MAP_PROMISE_FLOOR)
        conn = it.get("map_connectivity")
        if conn is None:
            conn = 1.0
        # Ninth principle: first-reading boost rides the survey component
        # in edv exactly as in map mode.
        fl = it.get("map_first_reading")
        if fl is None:
            fl = 1.0
        conn = conn * fl
        quality = it.get("map_corpus_quality")
        if quality is None:
            n = it.get("entry_count") or 0
            quality = min(1.0, n / RELIABILITY_N_FULL) if n else 1.0
        return unc * promise * conn * quality

    j_static = [it.get("judge_static") or 0.0 for it in items]
    m_static = [it.get("expected_mesh_gain") or 0.0 for it in items]
    s_static = [survey_static(it) for it in items]
    n_j, n_m, n_s = _p95(j_static), _p95(m_static), _p95(s_static)

    def wrapper(it: dict) -> float:
        contam = it.get("contamination_factor")
        if contam is None:
            contam = contamination_ecv_factor(it.get("contamination"))
        cost = it.get("cost_for_value")
        if not cost:
            est = it.get("est_cost_usd")
            cost = max(est, COST_FLOOR) if est is not None else COST_FLOOR
        return contam / cost

    wraps = [wrapper(it) for it in items]
    j_hat = [min(v / n_j, EDV_NORM_CAP) for v in j_static]
    m_hat = [min(v / n_m, EDV_NORM_CAP) for v in m_static]
    s_hat = [min(v / n_s, EDV_NORM_CAP) for v in s_static]

    # Dynamic state: map-v2's five novelty counters + the judge lane decay.
    pair_c: dict[str, int] = {}
    tgt_c: dict[str, int] = {}
    fam_c: dict[str, int] = {}
    cell_c: dict[tuple[str, str], int] = {}
    dom_c: dict[tuple[str, str], int] = {}
    judge_c: dict[tuple[str, str], int] = {}

    def novelty(it: dict) -> float:
        src_tgt = it["language_pair"].split(">")
        tgt = src_tgt[1] if len(src_tgt) == 2 else src_tgt[0]
        fam = language_family(tgt)
        return (
            1.0 / (1.0 + pair_c.get(it["language_pair"], 0))
            * (1.0 + tgt_c.get(tgt, 0)) ** -0.5
            * (1.0 + fam_c.get(fam, 0)) ** -0.5
            * (1.0 + cell_c.get((it.get("model") or "", fam), 0)) ** -0.5
            * (1.0 + dom_c.get((tgt, it.get("domain") or "unknown"), 0)) ** -0.5
        )

    def judge_decay(it: dict) -> float:
        key = (it["language_pair"], _judge_lane(it.get("condition")))
        return 1.0 / (1.0 + judge_c.get(key, 0))

    def value(i: int, it: dict) -> float:
        return (
            w["judge"] * j_hat[i] * judge_decay(it)
            + w["mesh"] * m_hat[i]
            + w["survey"] * s_hat[i] * novelty(it)
        ) * wraps[i]

    heap = [
        (-value(i, it), _map_tiebreak(it), i) for i, it in enumerate(items)
    ]
    heapq.heapify(heap)

    out: list[dict] = []
    while heap:
        neg_v, tb, i = heapq.heappop(heap)
        it = items[i]
        v = value(i, it)
        entry = (-v, tb, i)
        if heap and entry > heap[0]:
            heapq.heappush(heap, entry)
            continue
        # Accept: stamp diagnostics, bump counters. The stamped edv_value
        # is recomputed FROM the stamped (rounded) components so the row is
        # exactly self-consistent — the §2.3.5 explainability contract.
        # The heap ordered on the unrounded value; the difference is
        # sub-1e-6 and never crosses a tie-break.
        it["edv_judge_norm"] = round(j_hat[i], 6)
        it["edv_mesh_norm"] = round(m_hat[i], 6)
        it["edv_survey_norm"] = round(s_hat[i], 6)
        it["edv_novelty"] = round(novelty(it), 6)
        it["edv_judge_decay_n"] = judge_c.get(
            (it["language_pair"], _judge_lane(it.get("condition"))), 0)
        it["edv_value"] = (
            w["judge"] * it["edv_judge_norm"]
            / (1.0 + it["edv_judge_decay_n"])
            + w["mesh"] * it["edv_mesh_norm"]
            + w["survey"] * it["edv_survey_norm"] * it["edv_novelty"]
        ) * wraps[i]
        src_tgt = it["language_pair"].split(">")
        tgt = src_tgt[1] if len(src_tgt) == 2 else src_tgt[0]
        fam = language_family(tgt)
        pair_c[it["language_pair"]] = pair_c.get(it["language_pair"], 0) + 1
        tgt_c[tgt] = tgt_c.get(tgt, 0) + 1
        fam_c[fam] = fam_c.get(fam, 0) + 1
        cell_key = (it.get("model") or "", fam)
        cell_c[cell_key] = cell_c.get(cell_key, 0) + 1
        dom_key = (tgt, it.get("domain") or "unknown")
        dom_c[dom_key] = dom_c.get(dom_key, 0) + 1
        jd_key = (it["language_pair"], _judge_lane(it.get("condition")))
        judge_c[jd_key] = judge_c.get(jd_key, 0) + 1
        out.append(it)

    params = {
        "version": "edv-v1",
        "weights": w,
        "normalizers": {
            "judge_p95": round(n_j, 8),
            "mesh_p95": round(n_m, 10),
            "survey_p95": round(n_s, 8),
            "cap": EDV_NORM_CAP,
        },
        "constants": {
            "Z_DEC": Z_DEC, "JUDGE_FIRST": JUDGE_FIRST,
            "JUDGE_CONTESTED": JUDGE_CONTESTED,
            "JUDGE_DECIDED": JUDGE_DECIDED, "JUDGE_COND": JUDGE_COND,
            "JUDGE_GAMMA": JUDGE_GAMMA, "JUDGE_SEED": JUDGE_SEED,
        },
    }
    return out, params


def build_service_landscape(
    items: list[dict],
    registry_datasets: list[dict],
    engine_lane: dict[str, frozenset],
    cards_dir: Path = None,
) -> dict:
    """The desert ledger (map mode only): how much of the language index the
    queue can and cannot see, as citable counts. Champollion-derived from our
    own artifacts (cards, registry, coverage imports) — no upstream claims.

    Reasons an invisible language is invisible:
      * corpus-not-queueable — a registry corpus mentions it, but that corpus
        is NC-licensed / quarantined / not a dev split (excluded by
        queue_corpora's doctrine gates);
      * no-registry-corpus — no corpus mentions it at all. Sub-count
        engine_coverage_only: some MT engine claims support (a measurable
        service exists) but there is nothing to measure it WITH.
    """
    cards = cards_dir or CARDS_DIR
    queue_langs: set[str] = set()
    for it in items:
        parts = it["language_pair"].split(">")
        if len(parts) == 2:
            queue_langs.update(parts)

    registry_langs: set[str] = set()
    for ds in registry_datasets or []:
        pair = ds.get("language_pair") or {}
        for side in ("source", "target"):
            if pair.get(side):
                registry_langs.add(pair[side])

    engine_langs: set[str] = set()
    for supported in (engine_lane or {}).values():
        engine_langs.update(supported)

    card_langs: set[str] = set()
    family_of: dict[str, str] = {}
    for card in sorted(cards.glob("*.json")):
        code = card.stem
        card_langs.add(code)
        family_of[code] = language_family(code)

    invisible = card_langs - queue_langs
    corpus_not_queueable = sorted(invisible & registry_langs)
    no_corpus = invisible - registry_langs
    engine_only = sorted(no_corpus & engine_langs)

    # Doctrine-excluded annotation (Position 4 v2): card languages whose
    # only registry corpora carry unresolved macro/collective labels — a
    # sub-count of corpus_not_queueable, so the ledger can say WHY a
    # measurable-looking language is invisible.
    doctrine_langs: set[str] = set()
    for ds in registry_datasets or []:
        lr = ds.get("language_resolution")
        if lr and not lr.get("benchmark_eligible"):
            pair = ds.get("language_pair") or {}
            for side in ("source", "target"):
                if pair.get(side):
                    doctrine_langs.add(pair[side])
    doctrine_invisible = sorted(invisible & doctrine_langs)

    fam_sizes: dict[str, int] = {}
    fam_visible: set[str] = {family_of.get(l, f"lang:{l}")
                             for l in card_langs & queue_langs}
    for lang in card_langs:
        fam = family_of.get(lang, f"lang:{lang}")
        fam_sizes[fam] = fam_sizes.get(fam, 0) + 1
    invisible_fams = {
        f: n for f, n in fam_sizes.items()
        if f not in fam_visible and not f.startswith("lang:")
    }
    top_invisible = sorted(
        invisible_fams.items(), key=lambda kv: (-kv[1], kv[0]),
    )[:20]

    return {
        "note": (
            "Champollion-derived service ledger: which of the indexed "
            "languages this queue can measure at all. A language is "
            "invisible when no queueable corpus covers it — the queue "
            "cannot rank what it cannot see, so the lack of service is "
            "published here as data."
        ),
        "card_languages": len(card_langs),
        "queue_languages": len(queue_langs & card_langs),
        "invisible_languages": len(invisible),
        "invisible_reasons": {
            "corpus_not_queueable": len(corpus_not_queueable),
            "no_registry_corpus": len(no_corpus),
            "no_corpus_but_engine_coverage": len(engine_only),
            # Sub-count of corpus_not_queueable: excluded by the Position 4
            # v2 doctrine gate (unresolved macrolanguage/collective labels).
            "corpus_excluded_by_doctrine": len(doctrine_invisible),
        },
        "families_on_cards": len(
            {f for f in fam_sizes if not f.startswith("lang:")}
        ),
        "families_visible": len(
            {f for f in fam_visible if not f.startswith("lang:")}
        ),
        "largest_invisible_families": [
            {"family": f, "languages": n} for f, n in top_invisible
        ],
    }


_PUBLISHED_DROP_FIELDS = frozenset({
    # ranking diagnostics (re-derivable from the spec + mesh.json bridges)
    "pair_covered_on_leaderboard", "chaining_gain", "edge_quality",
    "edge_reliability", "edge_tier", "effective_strength", "pair_prior",
    "prior_basis", "model_offset", "condition_offset", "exploration_bonus",
    "predicted_strength", "post_run_reliability", "predicted_effective",
    "expected_mesh_gain", "contamination_factor", "ecv_per_usd",
    # map-value diagnostics (--rank-mode map; same re-derivability contract)
    "cost_for_value", "edge_runs", "map_novelty", "map_uncertainty",
    "map_promise", "map_value", "map_connectivity",
    "map_connectivity_class", "map_corpus_quality", "map_first_reading",
    # edv diagnostics (--rank-mode edv, spec §2.3; same contract — the DB
    # row's diagnostics JSONB keeps them all)
    "judge_static", "judge_contrasts", "judge_rank_basis",
    "edv_judge_norm", "edv_mesh_norm", "edv_survey_norm", "edv_novelty",
    "edv_judge_decay_n", "edv_value",
    # corpus-fetch provenance (canonical in registry.json, keyed by corpus_id)
    "corpus_file", "corpus_url", "source_export_url", "corpus_sha256",
    "corpus_fetch",
})

# How many top items the on-page preview carries. /contribute renders ~5;
# a few more keeps the preview useful if the page grows without re-shipping.
PREVIEW_TOP_N = 25

#: Served-blob size cap (bytes). queue.json rides static hosting with
#: GitHub's hard 100 MB per-file ceiling; since the FLORES/NTREX
#: promotion (2026-08-27) the full ranking can exceed it, so the blob
#: carries the top slice — cut at this cap WITH an explicit
#: metadata.blob_truncated {kept, total} stamp (no silent caps) — while
#: the DB queue (queue_items/queue_top) carries the complete ranking and
#: is authoritative.
BLOB_MAX_BYTES = 90_000_000

#: Preview-only diversity cap (2026-07-12 remedy #3): at most this many
#: preview items may share one SOURCE language. Prevents one well-resourced
#: hub from monopolizing the public shop window (observed pre-remedy:
#: 17 of the top 25 were jpn→X — a hub-completion artifact of the greedy
#: rule, not a mission signal). Over-cap items stay in the full queue with
#: their real priority; the preview just pulls the next eligible item.
PREVIEW_SOURCE_CAP = 6

#: Glottolog's "Artificial Language" bucket glottocode — the category
#: Glottolog files constructed languages under (they stand outside
#: genealogical classification). This is a classification-category
#: identifier, not a language set: WHICH languages fall in the bucket is
#: read from the language cards (SSOT rule — language facts live in data,
#: never hardcoded in code).
GLOTTOLOG_ARTIFICIAL_BUCKET = "arti1236"

_CONSTRUCTED_LANG_CACHE: dict[str, bool] = {}


def is_constructed_language(iso3: str) -> bool:
    """True when the language card files this code under Glottolog's
    'Artificial Language' bucket (classification.glottologBucket ==
    arti1236, e.g. epo/Esperanto, tlh/Klingon) or asserts the family name
    'Artificial Language'. Data-driven from cli/shared/language-cards/;
    a missing or unreadable card returns False — a card-less language is
    never presumed constructed."""
    code = (iso3 or "").strip().lower()
    if not code:
        return False
    cached = _CONSTRUCTED_LANG_CACHE.get(code)
    if cached is not None:
        return cached
    result = False
    card = CARDS_DIR / f"{code}.json"
    if card.is_file():
        try:
            data = json.loads(card.read_text(encoding="utf-8"))
            cls = data.get("classification") or {}
            result = (
                cls.get("glottologBucket") == GLOTTOLOG_ARTIFICIAL_BUCKET
                or cls.get("family") == "Artificial Language"
            )
        except (json.JSONDecodeError, OSError):
            result = False
    _CONSTRUCTED_LANG_CACHE[code] = result
    return result


def select_preview_items(
    items: list[dict],
    top_n: int = PREVIEW_TOP_N,
    policy: dict | None = None,
) -> list[dict]:
    """Pick the preview's top-N under the two PRESENTATION-ONLY policies
    (2026-07-12 remedies #3 + #4): skip items whose source or target is a
    constructed language, and cap items sharing one source language.
    Skipped items are NOT removed from the full queue and keep their real
    priority — the preview simply pulls the next eligible item in ranking
    order.

    ``policy`` is a ``metadata.preview_policy`` block, consumed VERBATIM —
    the exact twin of the edge function's ``selectPreviewItems``
    (regenerate-queue/lib.ts). The cards are NOT consulted here, so the
    selection always matches the block published beside it, and a refresh
    in an environment where the cards are unreachable can never silently
    blank the policy (a card-less :func:`is_constructed_language` answers
    False, not an error). ``None`` derives a fresh block from the cards
    via :func:`build_preview_policy` — the full-generation entry point and
    the only place card facts enter the preview path."""
    if not isinstance(policy, dict):
        policy = build_preview_policy(items)
    # A malformed cap fails OPEN (no cap), matching the TS twin — there
    # Number(null) is 0, which would silently empty the preview instead.
    cap_raw = policy.get("source_cap")
    source_cap = (
        cap_raw
        if isinstance(cap_raw, (int, float)) and not isinstance(cap_raw, bool)
        and math.isfinite(cap_raw)
        else math.inf
    )
    raw_codes = policy.get("constructed_language_codes")
    conlangs = ({str(c).strip().lower() for c in raw_codes}
                if isinstance(raw_codes, list) else set())
    exclude = policy.get("exclude_constructed") is True and bool(conlangs)
    picked: list[dict] = []
    per_source: dict[str, int] = {}
    for it in items:
        if len(picked) >= top_n:
            break
        lp = (it.get("language_pair") or "").strip().lower()
        src, sep, tgt = lp.partition(">")
        # Conlang exclusion (remedy #4): the mission statement says "every
        # language", so conlangs stay fully rankable in queue.json — but the
        # public shop window should not show Klingon ahead of thousands of
        # under-resourced natural languages.
        if sep and exclude and (src in conlangs or tgt in conlangs):
            continue
        # Per-source-hub diversity cap (remedy #3).
        if src and per_source.get(src, 0) >= source_cap:
            continue
        if src:
            per_source[src] = per_source.get(src, 0) + 1
        picked.append(it)
    return picked


def build_preview_policy(items: list[dict]) -> dict:
    """The preview selection policy, published AS DATA in the full queue's
    metadata (and echoed by queue-preview.json) — the parity contract with
    the regenerate-queue edge function's ``selectPreviewItems``
    (mt-eval-arena/supabase/functions/regenerate-queue/lib.ts). The edge
    function has no language-card access, so the constructed-language
    determination must travel in the artifact:
    ``constructed_language_codes`` is derived at generation time by running
    the same card-driven :func:`is_constructed_language` check over the
    languages actually present in ``items`` (SSOT rule — the cards decide,
    never a hardcoded set in code; the published list stays small because
    it only names codes the queue actually contains)."""
    seen: set[str] = set()
    for it in items:
        lp = (it.get("language_pair") or "").strip().lower()
        src, sep, tgt = lp.partition(">")
        if sep:
            seen.add(src)
            seen.add(tgt)
    return {
        "source_cap": PREVIEW_SOURCE_CAP,
        "exclude_constructed": True,
        "constructed_language_codes": sorted(
            c for c in seen if is_constructed_language(c)
        ),
    }


def slim_published_item(item: dict) -> dict:
    """Project a full queue item down to the published work-list fields,
    preserving key order."""
    return {k: v for k, v in item.items()
            if k not in _PUBLISHED_DROP_FIELDS}


#: Budget tiers summarized in queue-preview.json — "what does $X buy the
#: network right now?" Each tier is the greedy prefix of the published
#: ranking that fits the budget (skipping unaffordable items and
#: continuing), which under the ECV greedy rule IS the allocation the
#: ranking recommends for that spend. Contributors at very different
#: budgets thereby each get a concrete, optimal work-list summary instead
#: of one ranking implicitly sized to nobody. Twin: buildBudgetTiers in
#: regenerate-queue/lib.ts — keep field names, order, and rounding equal.
BUDGET_TIERS_USD = (1.0, 10.0, 100.0, 1000.0)


def build_budget_tiers(items: list[dict],
                       tiers: tuple = BUDGET_TIERS_USD) -> list[dict]:
    """Greedy budget-tier summaries over the ranked items (see
    BUDGET_TIERS_USD). Pure + offline-testable."""
    out = []
    for budget in tiers:
        spent = 0.0
        taken = 0
        pairs: set[str] = set()
        models: set[str] = set()
        max_priority = None
        for it in items:
            cost = it.get("est_cost_usd")
            # Guard shape matches the TS twin (lib.ts accumulateBudgetTiers):
            # booleans, NaN and infinity are not prices — a single NaN cost
            # would otherwise poison `spent` for the rest of the tier.
            if (isinstance(cost, bool)
                    or not isinstance(cost, (int, float))
                    or not math.isfinite(cost) or cost < 0):
                continue
            if spent + cost > budget:
                continue
            spent += cost
            taken += 1
            lp = (it.get("language_pair") or "").strip().lower()
            if lp:
                pairs.add(lp)
            model = it.get("model")
            if model:
                models.add(model)
            pr = it.get("priority")
            if isinstance(pr, int):
                max_priority = pr if max_priority is None else max(max_priority, pr)
        out.append({
            "budget_usd": budget,
            "items": taken,
            "total_cost_usd": round(spent, 4),
            "pairs": len(pairs),
            "models": len(models),
            "max_priority": max_priority,
        })
    return out


def build_queue_preview(queue: dict, full_queue_bytes: int,
                        top_n: int = PREVIEW_TOP_N) -> dict:
    """Build the small queue-preview.json the website pages consume so they
    never download the full multi-MB work-list.

    Carries the full metadata, the top-N items for the /contribute preview
    (selected via :func:`select_preview_items` — source-hub cap + conlang
    exclusion, presentation policy only), a compact per-language-pair
    aggregation (count + min cost) for the /leaderboard "N runs waiting"
    affordance, and the full file's path + byte size so a page can render an
    honest "Download full queue (NN MB)" link.
    """
    items = queue.get("items", [])
    by_pair: dict[str, dict] = {}
    for it in items:
        lp = (it.get("language_pair") or "").strip().lower()
        if ">" not in lp:
            continue
        src, tgt = lp.split(">", 1)
        agg = by_pair.get(lp)
        if agg is None:
            agg = {"pair": lp, "src": src, "tgt": tgt,
                   "count": 0, "minCost": None}
            by_pair[lp] = agg
        agg["count"] += 1
        cost = it.get("est_cost_usd")
        if cost is not None:
            agg["minCost"] = (cost if agg["minCost"] is None
                              else min(agg["minCost"], cost))
    # Presentation policy applied to the preview selection only — skipped
    # items keep their real priority in the full queue. The full queue's
    # metadata.preview_policy (the edge-function parity contract) is
    # consumed verbatim when present AND drives the selection below, so the
    # published block always describes the selection actually made; only a
    # pre-policy queue derives a fresh block from the cards.
    meta_policy = (queue.get("metadata") or {}).get("preview_policy")
    policy = (meta_policy if isinstance(meta_policy, dict)
              else build_preview_policy(items))
    preview_items = select_preview_items(items, top_n, policy=policy)
    return {
        "metadata": queue.get("metadata", {}),
        "full_queue": {
            "path": "/queue.json",
            "bytes": full_queue_bytes,
            "items": len(items),
        },
        "preview_count": len(preview_items),
        "preview_policy": policy,
        "items": [slim_published_item(it) for it in preview_items],
        # Highest-volume pairs first; the page filters this client-side.
        "pairs": sorted(by_pair.values(), key=lambda p: -p["count"]),
        # "What does $X buy?" — see BUDGET_TIERS_USD. Summaries only; the
        # actual allocation is just the ranking itself walked greedily.
        "budget_tiers": build_budget_tiers(items),
    }


# ── DB-as-queue (B1): materialize the ranked queue into public.queue_items ────
# The Python ranker is the ranking AUTHORITY; it ALSO writes its ranked items to
# the DB so the queue can be SERVED from Postgres (the queue_top RPC) with live
# verified-coverage filtering — retiring the static queue.json blob + the edge
# streaming scanner. Every served scalar field becomes a column (byte-identical
# to what slim_published_item publishes); map_value gets its own column; the
# re-derivability diagnostics (_PUBLISHED_DROP_FIELDS) go to the diagnostics
# JSONB — so a DB row carries strictly MORE than the served queue.json item.

# The columns that come straight off a ranked item — exactly the served
# (non-dropped) scalar fields, so DB rows and queue.json items cannot diverge.
_QUEUE_ITEM_COLUMNS = (
    "id", "priority", "language_pair", "source_language", "target_language",
    "corpus_id", "corpus_license", "entry_count", "contamination", "domain",
    "source_length", "model", "condition", "est_cost_usd", "est_basis",
    "run_command",
)


def queue_items_rows(items: list[dict], rank_mode: str,
                     generation_id: str) -> list[dict]:
    """Map fully-ranked queue items to public.queue_items row dicts. Pure +
    offline-testable — this is the parity contract between the DB and the served
    queue.json (the served scalar fields are copied verbatim)."""
    rows: list[dict] = []
    for it in items:
        row = {c: it.get(c) for c in _QUEUE_ITEM_COLUMNS}
        row["rank_mode"] = rank_mode
        # The generic rank-value column: map_value for map rows, edv_value
        # for edv rows (documented column semantics — the column name is
        # historical; the row's rank_mode says which value model filled it).
        row["map_value"] = (
            it.get("edv_value") if rank_mode == "edv" else it.get("map_value")
        )
        # Everything that is not a first-class column (all ecv/map diagnostics
        # AND any served extras like a restricted-corpus `transmission` block)
        # goes here, so a DB row is a complete SUPERSET of the served item —
        # nothing is lost relative to queue.json.
        row["diagnostics"] = {
            k: v for k, v in it.items()
            if k not in _QUEUE_ITEM_COLUMNS and k != "map_value"
        }
        row["generation_id"] = generation_id
        rows.append(row)
    return rows


def upsert_queue_items(rows: list[dict], generation_id: str,
                       url: str, service_key: str, batch: int = 1000) -> int:
    """Upsert queue_items (merge on the id PK) then delete rows from earlier
    generations — the served table always reflects the latest ranking with no
    empty window (same ids overwrite in place; vanished items are swept by the
    generation delete). Service-role only. Returns rows upserted.

    Two safety properties, both learned the hard way in review (2026-08-27):
    an EMPTY ranking never sweeps (a generator bug or a filtered-to-nothing
    run must not wipe the served table — refuse loudly instead), and the
    sweep only runs after EVERY batch succeeded (an upsert exception
    propagates out before the delete, so a partial write leaves the previous
    generation's rows serving rather than a spliced table)."""
    if not rows:
        raise SystemExit(
            "REFUSING queue_items sweep: the ranking produced ZERO rows. "
            "Deleting every served row on empty input is never intended — "
            "if the queue is genuinely meant to be empty, clear the table "
            "deliberately with a founder-run SQL statement."
        )
    base = f"{url}/rest/v1/queue_items"
    write_headers = {
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates,return=minimal",
    }
    n = 0
    for i in range(0, len(rows), batch):
        chunk = rows[i:i + batch]
        req = urllib.request.Request(
            base, data=json.dumps(chunk, ensure_ascii=False).encode("utf-8"),
            headers=write_headers, method="POST",
        )
        with urllib.request.urlopen(req, timeout=120) as resp:
            resp.read()
        n += len(chunk)
    # Sweep items no longer in the queue (rows stamped by an earlier generation).
    del_url = (base + "?generation_id=neq."
               + urllib.parse.quote(generation_id, safe=""))
    del_req = urllib.request.Request(
        del_url,
        headers={"apikey": service_key,
                 "Authorization": f"Bearer {service_key}",
                 "Prefer": "return=minimal"},
        method="DELETE",
    )
    with urllib.request.urlopen(del_req, timeout=120) as resp:
        resp.read()
    return n


def _write_json_if_changed(
    path: Path,
    obj: dict,
    ignore_paths: tuple[str, ...] = ("metadata.generated_at",),
) -> bool:
    """Write ``obj`` to ``path`` as compact JSON — unless the on-disk content
    is identical apart from ``ignore_paths`` (dotted key paths, masked on
    BOTH sides before the deep comparison).

    Kills pure timestamp churn: a regeneration whose only difference is
    ``metadata.generated_at`` must not dirty a tracked artifact (the website
    prestart re-runs the generator, which used to leave queue-preview.json
    modified on every dev build with no content change). Returns True when
    the file was (re)written.
    """
    def _masked(data: dict) -> dict:
        clone = json.loads(json.dumps(data))  # deep copy, comparison-only
        for dotted in ignore_paths:
            node = clone
            *parents, leaf = dotted.split(".")
            for key in parents:
                node = node.get(key) if isinstance(node, dict) else None
                if node is None:
                    break
            if isinstance(node, dict):
                node.pop(leaf, None)
        return clone

    if path.is_file():
        try:
            existing = json.loads(path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            existing = None
        if existing is not None and _masked(existing) == _masked(obj):
            return False
    path.write_text(
        json.dumps(obj, ensure_ascii=False, separators=(",", ":")) + "\n",
        encoding="utf-8",
    )
    return True


# =====================================================================
# Server-side delta refresh (event-driven regeneration)
# =====================================================================
# The full generation above re-derives the ecv-v3 ranking + reliability
# bridges from the registry, the cost manifest, and the language cards — it is
# the STRUCTURAL regeneration, run when corpora change or the ranking is
# re-tuned. Between those, the served artifacts must still stay fresh as runs
# arrive: completed items should drop off the queue and new results should
# light up the mesh. That high-frequency, run_cards-driven update is the DELTA
# REFRESH below.
#
# It is deliberately cheap and input-light: it needs only the already-served
# base artifacts (queue.json + mesh.json), the registry, and the public
# run_cards board — no cost manifest, no re-ranking. The same delta is
# implemented in the Supabase Edge Function (mt-eval-arena/supabase/functions/
# regenerate-queue/ — twins in lib.ts, streamed at prod scale rather than
# whole-parsed) so it can run server-side on a run_cards trigger; these pure
# helpers are the SSOT + the founder's portable (cron/local) fallback, and
# are unit-tested in arena/tests/test_queue_refresh.py +
# test_queue_remedies.py (TS side: the function dir's lib_test.ts). Keep the
# two in sync — if you change the drop/fold/preview rules here, mirror them
# there.
#
# PREVIEW POLICY CONTRACT: the edge function has no language-card access, so
# the preview selection policy (source-hub cap + constructed-language codes)
# travels in queue.json's metadata.preview_policy, built by
# build_preview_policy from the cards at FULL generation only. BOTH refresh
# twins consume the stamped block verbatim — the TS selectPreviewItems must
# match select_preview_items' semantics exactly. They differ only when a
# base queue predates the policy: run_refresh derives a fresh block from
# the cards (it runs inside the repo), while the edge function falls back
# to the pre-policy plain top-N slice (no cards to derive from).


def item_is_covered(
    item: dict,
    coverage: set[tuple[str, str, str]],
    covered_models: set[tuple[str, str]] | None = None,
) -> bool:
    """True if a queue item's (corpus, model, condition) is already on the
    board — the drop rule for the delta refresh.

    ``coverage`` is the set of ``(dataset_token, model_short, condition)``
    from :func:`fetch_results`. The item's ``model`` is the full slug; it is
    matched in short form (post-vendor segment, lowercased), and ``condition``
    is normalized so any "coached-*" label folds to "coached" — mirroring how
    generation drops covered combos. An item missing corpus/model can't match,
    so it is kept (never wrongly dropped).

    ENGINE items (condition "engine") have no prompting conditions, and an
    engine run publishes under its real prompt-condition label ("naive" by
    default — publish.py records config.prompt_version), so they are covered
    by ANY (corpus, engine) row on the board. ``covered_models`` is the
    optional precomputed ``{(token, model_short)}`` projection of
    ``coverage`` (drop_completed_items builds it once per refresh); it is
    derived on the fly when omitted."""
    cond = (item.get("condition") or "").strip().lower()
    if "coach" in cond:
        cond = "coached"
    ms = model_short(item.get("model") or "")
    cid = (item.get("corpus_id") or "").strip().lower()
    if not cid or not ms:
        return False
    if cond == ENGINE_CONDITION:
        if covered_models is None:
            covered_models = {(t, m) for (t, m, _c) in coverage}
        return (cid, ms) in covered_models
    return (cid, ms, cond) in coverage


def drop_completed_items(
    items: list[dict], coverage: set[tuple[str, str, str]]
) -> list[dict]:
    """Return only the items NOT yet covered — completed work falls off the
    queue. Pure (no I/O), so the refresh's core is unit-tested."""
    covered_models = {(t, m) for (t, m, _c) in coverage}
    return [
        it for it in items
        if not item_is_covered(it, coverage, covered_models)
    ]


def build_token_pair(registry: dict) -> dict[str, tuple[str, str]]:
    """Map every corpus token (registry id + corpus-file stem, lowercased) to
    its ``(source, target)`` pair — used to attribute a run_cards row to a mesh
    edge during the fold."""
    tp: dict[str, tuple[str, str]] = {}
    for ds in registry.get("datasets", []):
        lp = ds.get("language_pair")
        if not lp or not lp.get("source") or not lp.get("target"):
            continue
        pair = (lp["source"], lp["target"])
        tp[ds["id"].lower()] = pair
        if ds.get("path"):
            tp[Path(ds["path"]).stem.lower()] = pair
    return tp


def fold_results_into_mesh(
    mesh: dict,
    results: list[dict],
    token_pair: dict[str, tuple[str, str]],
    registry: dict | None = None,
) -> dict:
    """Light up an EXISTING mesh snapshot from the current board (delta refresh).

    Mirrors :func:`build_mesh_snapshot`'s per-edge run-history shaping but
    updates the base mesh in place — preserving node coordinates and the
    reliability bridges from the last full generation — so a frequently-run,
    input-light refresh fleshes out the map as runs arrive. Each edge's
    ``runs`` / ``status`` / ``best_chrf`` are recomputed from the FULL result
    set (idempotent — re-folding the same board is a no-op, never a
    double-count). When ``registry`` is given, any registered pair not yet on
    the map is appended as a ``registered`` edge and edge sizes are refreshed,
    so brand-new corpora appear. Mutates and returns ``mesh``."""
    edge_runs: dict[frozenset, list[tuple[str, float]]] = {}
    for r in results:
        pair = token_pair.get(r.get("token"))
        if pair is None or not r.get("submitted_at"):
            continue
        e = frozenset(pair)
        edge_runs.setdefault(e, []).append(
            (r["submitted_at"], round(r["strength"] * 100, 2))
        )
    for runs in edge_runs.values():
        runs.sort()

    edges = mesh.setdefault("edges", [])
    index: dict[frozenset, dict] = {
        frozenset((e.get("a"), e.get("b"))): e for e in edges
    }

    def _ensure_edge(e: frozenset, size: int = 0) -> dict:
        edge = index.get(e)
        if edge is None:
            a, b = sorted(e)
            edge = {
                "a": a, "b": b, "size": size, "status": "registered",
                "best_chrf": None, "reliability": None,
                "tier": "registered", "runs": [],
            }
            edges.append(edge)
            index[e] = edge
        return edge

    for e, runs in edge_runs.items():
        edge = _ensure_edge(e)
        edge["runs"] = [[t, c] for t, c in runs]
        edge["status"] = "measured" if runs else edge.get("status", "registered")
        edge["best_chrf"] = max(
            (c for _t, c in runs), default=edge.get("best_chrf")
        )

    if registry:
        for ds in registry.get("datasets", []):
            lp = ds.get("language_pair") or {}
            s, t = lp.get("source"), lp.get("target")
            if not s or not t or s == t:
                continue
            edge = _ensure_edge(frozenset((s, t)), size=ds.get("size") or 0)
            edge["size"] = max(edge.get("size") or 0, ds.get("size") or 0)

    measured = sum(1 for e in edges if e.get("status") == "measured")
    mesh["refreshed_at"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
    mesh["measured_edges"] = measured
    return mesh


def run_refresh(
    output: str | Path,
    *,
    offline: bool = False,
    fetch=None,
    registry: dict | None = None,
) -> dict:
    """Delta-refresh the served artifacts in place from the current board.

    Reads the base ``queue.json`` (at ``output``) + sibling ``mesh.json``,
    drops completed items, rebuilds ``queue-preview.json``, folds the latest
    results into the mesh, and writes all three back in the same compact/slim
    encodings the full generator uses. ``fetch`` (defaults to
    :func:`fetch_results`) and ``registry`` are injectable for tests. Returns a
    summary dict. The full ecv-v3 ranking is intentionally NOT recomputed here
    — run the generator without ``--refresh`` for that."""
    out = Path(output)
    qpath = out
    mpath = out.parent / "mesh.json"
    if not qpath.is_file():
        raise SystemExit(
            f"--refresh: base queue not found at {qpath}. Run a full "
            f"generation first (or seed the served artifact)."
        )
    queue = load_json(qpath)
    mesh = load_json(mpath) if mpath.is_file() else {"nodes": [], "edges": []}

    if registry is None:
        registry = load_registry_for_queue()

    if offline:
        coverage: set[tuple[str, str, str]] = set()
        results: list[dict] = []
    else:
        coverage, results = (fetch or fetch_results)()

    items = queue.get("items", [])
    before = len(items)
    kept = drop_completed_items(items, coverage)
    queue["items"] = kept
    meta = queue.setdefault("metadata", {})
    meta["open_items"] = len(kept)
    meta["refreshed_at"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
    # Preview-policy parity: the policy is stamped at FULL generation (the
    # cards decide, via build_preview_policy) and consumed VERBATIM here —
    # exactly like the regenerate-queue edge function — keeping the delta
    # refresh input-light and making it impossible to silently blank the
    # conlang codes where the cards are unreachable (a card-less
    # is_constructed_language answers False, not an error). An over-
    # inclusive codes list is harmless: the refresh only DROPS items, so no
    # new language can enter between regens. Only a base queue from before
    # the policy existed derives a fresh block (this portable fallback runs
    # inside the repo, where the cards live).
    if not isinstance(meta.get("preview_policy"), dict):
        meta["preview_policy"] = build_preview_policy(kept)

    qpath.write_text(
        json.dumps(queue, ensure_ascii=False, separators=(",", ":")) + "\n",
        encoding="utf-8",
    )
    preview = build_queue_preview(queue, qpath.stat().st_size)
    _write_json_if_changed(out.parent / "queue-preview.json", preview)

    token_pair = build_token_pair(registry)
    fold_results_into_mesh(mesh, results, token_pair, registry)
    mpath.write_text(
        json.dumps(mesh, ensure_ascii=False, indent=1) + "\n",
        encoding="utf-8",
    )

    summary = {
        "dropped": before - len(kept),
        "remaining": len(kept),
        "results_on_board": len(results),
        "measured_edges": mesh.get("measured_edges"),
    }
    print(
        f"refresh: dropped {summary['dropped']} completed item(s); "
        f"{summary['remaining']} remain; {summary['results_on_board']} "
        f"board result(s); {summary['measured_edges']} measured edge(s) "
        f"-> {qpath}, queue-preview.json, {mpath}"
    )
    return summary


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--output", default=str(DEFAULT_OUTPUT))
    ap.add_argument(
        "--mesh-output",
        default=None,
        help="Where to write the mesh visualization artifact "
             "(default: mesh.json next to --output).",
    )
    ap.add_argument(
        "--offline",
        action="store_true",
        help="Skip the leaderboard coverage query (treat everything as open)",
    )
    ap.add_argument(
        "--refresh",
        action="store_true",
        help="Delta-refresh the existing served artifacts in place (drop "
             "completed items, fold new results into the mesh, rebuild the "
             "preview) WITHOUT re-deriving the ecv-v3 ranking. Cheap + "
             "input-light — the portable twin of the regenerate-queue edge "
             "function. Requires a base queue.json at --output.",
    )
    ap.add_argument(
        "--lam", type=float, default=LAMBDA,
        help="Chain junction discount λ (spec §4; default %(default)s)",
    )
    ap.add_argument(
        "--kappa", type=float, default=KAPPA,
        help="Exploration bonus scale κ (spec §4; default %(default)s)",
    )
    ap.add_argument(
        # DEFAULT = THE PUBLISHED-QUEUE POLICY. Founder ruling 2026-08-27
        # reversed the llm-only lane of 2026-07-19: the engine campaigns
        # that ruling reserved for the founder never ran, stranding 4,740
        # of 5,461 corpora, so the public queue now carries BOTH lanes.
        # Schema half: migration 071 (condition CHECK admits 'engine').
        "--lane", choices=("llm", "engine", "both"), default="both",
        help="Which work lane the queue carries: 'both' (default, founder "
             "ruling 2026-08-27 — LLM items plus non-LLM MT-service items: "
             "Google Translate, DeepL, Microsoft Translator, "
             "LibreTranslate, Tilde), 'llm' (LLM items only, restricted to "
             "pairs touching at least one language outside every MT "
             "service's published coverage — the 2026-07-19..2026-08-27 "
             "published policy), or 'engine' (engines-only queue).",
    )
    ap.add_argument(
        # DEFAULT = THE PUBLISHED-QUEUE POLICY (founder flip 2026-07-19,
        # commit 283524f9a). The default must match the policy because every
        # regen pipeline (website ensure-network-artifacts prebuild, ad-hoc
        # reruns) invokes this script bare — a lagging default silently
        # reverted the flip on the first regen (caught 2026-07-19; pinned by
        # test_queue_map_mode.test_default_rank_mode_is_the_published_policy).
        "--rank-mode", choices=("ecv", "map", "edv"), default="map",
        help="Ranking objective: 'map' (default — the published-queue survey "
             "ordering, map-value v2: novelty × uncertainty × promise × "
             "connectivity × corpus-quality per dollar — first-light across "
             "pairs/languages/families/method-cells/domains, bridges into "
             "the measured network first, plus the service_landscape desert "
             "ledger in metadata) or 'ecv' (the exploitation ordering — "
             "expected mesh gain per dollar; §2–§3). Founder review: "
             "docs/QUEUE_ALGORITHM_REVIEW_2026-07-18.md — do not flip the "
             "published queue's mode without founder approval. 'edv' "
             "(expected decision value, spec §2.3 — implemented, default "
             "OFF pending the §2.3.6 measured comparison): the portfolio "
             "[w·judge + w·mesh + w·survey] × contamination ÷ cost, where "
             "judge prices settling same-corpus method comparisons.",
    )
    ap.add_argument(
        "--edv-weights", default=None, metavar="J,M,S",
        help="Override the edv portfolio weights (judge,mesh,survey), e.g. "
             "'0.35,0.25,0.40'. Echoed in metadata.edv_parameters.",
    )
    ap.add_argument(
        "--dump-full-items", default=None, metavar="PATH",
        help="Also write the FULL ranked items (every diagnostic field, "
             "nothing slimmed) to PATH — the input eval_rank_modes.py "
             "compares rank modes on. Never served.",
    )
    args = ap.parse_args()

    # Delta refresh: drop completed + fold results into the existing served
    # artifacts, no re-ranking. Returns early (does not touch the cost
    # manifest or the ecv-v3 machinery below).
    if args.refresh:
        run_refresh(args.output, offline=args.offline)
        return 0

    registry = load_registry_for_queue()
    manifest = load_json(MANIFEST)

    corpora, doctrine_excluded = queue_corpora_split(registry)
    # Registry entry by corpus id — the SSOT for each item's quality markers
    # (contamination grade, domain, source length). queue_corpora returns the
    # registry entries themselves, but keying by id keeps the copy-through
    # explicit and robust if that ever changes.
    registry_by_id = {ds["id"]: ds for ds in registry.get("datasets", [])}
    lineup = [m["slug"] for m in manifest.get("lineup", [])]
    if not lineup:
        print("No validated model lineup in sweep manifest — aborting.")
        return 1

    # ---- MT-engine lane (engine × corpus; coverage-gated) ----------------
    # Which self-contained MT API engines enqueue, and for which languages
    # (module docstring, "MT-engine lane"). Skipped engines are surfaced —
    # never silently absent.
    engine_lane, engine_notes = load_engine_lane()
    for note in engine_notes:
        print(f"  engine lane: {note}")
    char_medians = engine_char_medians(registry.get("datasets", []))

    # ---- Cost model from the sweep manifest -----------------------------
    # Per-(corpus_stem, model) observed costs; per-model avg cost/entry.
    size_by_stem = {
        Path(ds["path"]).stem: ds.get("size") for ds in corpora
    }
    observed: dict[tuple[str, str], float] = {}
    per_entry_samples: dict[str, list[float]] = {}
    sweep_total = 0.0
    sweep_ok = 0
    for run in manifest.get("runs", []):
        sweep_total += run.get("cost", 0.0)
        if not run.get("ok"):
            continue
        sweep_ok += 1
        stem, model, cost = run["corpus"], run["model"], run.get("cost", 0.0)
        observed[(stem, model)] = cost
        size = size_by_stem.get(stem)
        if size and cost > 0:
            per_entry_samples.setdefault(model, []).append(cost / size)
    avg_per_entry = {
        m: sum(v) / len(v) for m, v in per_entry_samples.items() if v
    }

    # ---- Results from the public leaderboard -----------------------------
    coverage: set[tuple[str, str, str]] = set()
    results: list[dict] = []
    coverage_note = "offline (leaderboard query skipped — structural ranking)"
    if not args.offline:
        try:
            coverage, results = fetch_results()
            coverage_note = (
                f"queried public run_cards (read-only) at generation time; "
                f"{len(results)} scored runs on the board"
            )
        except Exception as exc:  # noqa: BLE001
            # FAIL LOUD — do NOT regenerate from a failed read. A board-read
            # failure (auth rotation, RLS change, PostgREST 5xx, pagination
            # break, network blip) is NOT an empty board: silently continuing
            # would emit a queue.json/mesh.json with EVERY edge unmeasured and
            # the nightly workflow would commit+push that "nothing is
            # connected" snapshot to the live site. A *successful* read that
            # returns 0 rows (a genuinely empty board) proceeds normally below.
            # For an intentional structural-only build, use the explicit
            # --offline flag instead.
            print(
                f"ERROR: leaderboard read failed ({exc}). Refusing to "
                f"regenerate queue.json/mesh.json from a failed read — the "
                f"existing committed snapshots are left untouched. Re-run when "
                f"the board is reachable, or pass --offline for an intentional "
                f"structural-only build.",
                file=sys.stderr,
            )
            return 1

    # ---- Build items: expected-chain-value v2 ----------------------------
    # (normative spec: cli/website/docs/network/specifications/queue-construction.md)
    covered_pairs = set()
    for ds in corpora:
        stem = Path(ds["path"]).stem
        tokens = {stem.lower(), ds["id"].lower()}
        for token, _m, _c in coverage:
            if token in tokens:
                covered_pairs.add(ds["id"])

    gains = chaining_gains(corpora, covered_pairs)  # legacy v1 field

    # Evidence maps results through the FULL registry (NC/restricted
    # corpora produce knowledge even though they are not queueable).
    evidence = build_evidence(registry.get("datasets", []), results)
    # Languages with ANY published measurement (full-registry attribution,
    # same asymmetry as above) — one half of map-value v2's "established"
    # set; the other half is the service coverage union computed below.
    measured_langs = frozenset(
        lang for e in evidence["edge_strength"] for lang in e
    )
    # Graph nodes: languages the queue can act on, plus languages with
    # published evidence — their chain values respond to queue items
    # even when no item targets their own edges directly.
    nodes = sorted(
        {
            lang
            for ds in corpora
            for lang in (ds["language_pair"]["source"],
                         ds["language_pair"]["target"])
        }
        | {lang for e in evidence["edge_strength"] for lang in e}
    )
    # The chain matrix runs on EFFECTIVE strengths (quality × reliability,
    # ecv-v3): an unreliable bridge contributes weak chains no matter how
    # flashy its best score.
    effective_strengths = {
        e: b["s_eff"] for e, b in evidence["edge_bridge"].items()
    }
    Q = build_chain_matrix(nodes, effective_strengths, lam=args.lam)
    n_nodes = len(nodes)
    phi_now = (
        sum(Q[u][v] for u in nodes for v in nodes if u != v)
        / (n_nodes * (n_nodes - 1))
    ) if n_nodes > 1 else 0.0
    # ΔΦ depends only on (edge, upgraded strength) — memoize across the
    # per-model/per-condition item loop.
    gain_cache: dict[tuple[frozenset, float], float] = {}

    # Cost fallback chain for the ECV denominator: observed/extrapolated
    # estimate → global median estimate → COST_FLOOR.
    all_per_entry = [c for v in per_entry_samples.values() for c in v]
    median_per_entry = (
        sorted(all_per_entry)[len(all_per_entry) // 2]
        if all_per_entry else None
    )

    # Engine items are covered by ANY condition already on the board —
    # engines have no prompting conditions and their runs publish under the
    # real prompt-condition label ("naive" by default); see item_is_covered.
    covered_any_condition = {(t, m) for (t, m, _c) in coverage}

    # ---- Lane policy (founder directive 2026-07-19) ----------------------
    # The PUBLIC queue is the LLM lane, focused on languages no MT service
    # covers: engine items (Microsoft/Google/DeepL/LibreTranslate/Tilde) are
    # OUT of the default queue and run as separate founder campaigns
    # (--lane engine emits an engines-only queue; --lane both restores the
    # combined pre-2026-07-19 behavior). In the default llm lane, an LLM
    # item survives only if at least ONE side of its pair is NOT in the
    # union of the engine coverage lists — "LLM calling of non-covered
    # languages". The union is data-driven from the same
    # method-coverage.json the engine lane reads (SSOT, never hardcoded).
    service_covered: frozenset = frozenset().union(*engine_lane.values()) \
        if engine_lane else frozenset()
    lane = args.lane
    dropped_fully_covered = 0

    # Work specs per corpus: the LLM lane is model × prompting condition;
    # the engine lane is the engine alone under the ENGINE_CONDITION
    # sentinel (pair-gated per corpus inside the loop).
    llm_specs = (
        [(slug, cond) for cond in CONDITIONS for slug in lineup]
        if lane in ("llm", "both") else []
    )
    engine_specs = (
        [(eng, ENGINE_CONDITION) for eng in sorted(engine_lane)]
        if lane in ("engine", "both") else []
    )

    items = []
    unresolvable_names = []
    for ds in sorted(corpora, key=lambda d: (d.get("size") or 0, d["id"])):
        stem = Path(ds["path"]).stem
        # Items key on the RESOLVED individual codes (doctrine gate upstream
        # guarantees both sides resolve); the corpus's upstream labels stay
        # on the registry entry, and a stripped script subtag is carried as
        # display metadata on the item.
        res = ds["language_resolution"]
        src, tgt = res["source"]["resolved"], res["target"]["resolved"]
        src_script = res["source"].get("script")
        tgt_script = res["target"].get("script")
        lang = target_lang_name(tgt)
        if not lang:
            # Post-gate, every target is an active individual code — a
            # missing display name is a real language-card defect, not
            # routine noise. Collected and raised loudly after the loop.
            unresolvable_names.append(f"{ds['id']} (target {tgt})")
            continue
        # Source language NAME for the run command + item display (founder
        # 2026-07-19: commands must name BOTH sides, not just the target —
        # and the harness's --source-lang otherwise defaults to "English",
        # mislabeling prompts on non-English-source corpora). A card-less
        # source falls back to its ISO code — honest, never a wrong name.
        src_lang = target_lang_name(src) or src
        # llm lane: keep only pairs touching at least one language outside
        # every service's published coverage — fully service-covered pairs
        # are the engines' separate campaign, not the public LLM queue.
        if lane == "llm" and pair_is_fully_service_covered(
                src, tgt, service_covered):
            dropped_fully_covered += 1
            continue
        # Map-value v2 bridge-into-network class: a corpus-pair property,
        # shared by all its model × condition items below.
        conn_cls, conn_factor = map_connectivity(
            src, tgt, measured_langs, service_covered,
        )
        # Ninth principle (2026-08-27): does this item buy a LANGUAGE's
        # first published measurement? Plain per-code, measurement-based —
        # service coverage is irrelevant here (a Google-covered language
        # with zero published measurements still has no reading), and a
        # variety is not "read" because its macrolanguage is.
        first_reading = (
            MAP_FIRST_READING_BOOST
            if (src not in measured_langs or tgt not in measured_langs)
            else 1.0
        )
        is_fetch = ds.get("access") == "fetch-from-source"
        corpus_url = (
            None if is_fetch else f"{MIRROR_RAW}/datasets/{ds['path']}"
        )
        # One transmission stamp per corpus, shared by all its
        # model × condition items (the channel requirement is a corpus
        # property). None — and no item field at all — for the cleared
        # common case.
        corpus_stamp = transmission_stamp(ds)
        for kind, specs in (("llm", llm_specs), ("engine", engine_specs)):
            for slug, cond in specs:
                ds_tokens = {stem.lower(), ds["id"].lower()}
                ms = model_short(slug)
                if kind == "engine":
                    # Coverage gating: BOTH sides of the pair must be in the
                    # engine's published support list (fail safe — an
                    # unlisted language never enqueues for that engine).
                    supported = engine_lane[slug]
                    if src not in supported or tgt not in supported:
                        continue
                    if any((t, ms) in covered_any_condition
                           for t in ds_tokens):
                        continue
                    est, basis = engine_cost_estimate(slug, ds, char_medians)
                else:
                    if any((t, ms, cond) in coverage for t in ds_tokens):
                        continue
                    est, basis = llm_cost_estimate(
                        stem, slug, ds, observed, avg_per_entry, cond,
                    )
                # Engine items run the MT system itself (--method); LLM
                # items pass a model slug (--model). Language codes need no
                # flags either way — the runner auto-fills source/target
                # codes from the corpus's registry language_pair.
                runner_flag = (
                    f"--method {slug}" if kind == "engine"
                    else f"--model {slug}"
                )
                if is_fetch:
                    # Not hosted by us: run from an arena checkout and the
                    # harness rebuilds the corpus from the pinned upstream
                    # export on first use (--yes accepts the CC-BY terms),
                    # verifying the registry sha256.
                    # Use the registry id, not a repo-relative path: the
                    # documented contributor flow runs from a scratch dir,
                    # where 'datasets/...' resolves to nothing (verified
                    # 2026-06-12). The harness resolves ids via the
                    # registry -> local file -> fetch-from-source chain.
                    run_cmd = (
                        f"mt-eval run --corpus {ds['id']} "
                        f'{runner_flag} --source-lang "{src_lang}" '
                        f'--target-lang "{lang}" --yes'
                    )
                else:
                    # --yes also covers eval-pack auto-install (FST
                    # languages) for downloaded-file runs.
                    run_cmd = (
                        f"curl -fsSLO {corpus_url} && "
                        f"mt-eval run --corpus {stem}.json "
                        f'{runner_flag} --source-lang "{src_lang}" '
                        f'--target-lang "{lang}" --yes'
                    )
                if cond == "coached":
                    run_cmd += " --coaching-file YOUR_COACHING.txt"

                # ---- Expected-chain-value v3 (spec §3) -------------------
                # A bridge is (quality, reliability): the chain matrix
                # runs on s_eff = q·r, and a run is valued by how much
                # it raises the edge's EFFECTIVE strength — via a better
                # score, a bigger/richer corpus, a tighter CI, or simply
                # by replicating a single-run edge.
                edge = frozenset((src, tgt))
                bridge = evidence["edge_bridge"].get(edge)
                q_cur = bridge["q"] if bridge else 0.0
                r_cur = bridge["r"] if bridge else 0.0
                s_eff_cur = bridge["s_eff"] if bridge else 0.0
                runs_cur = bridge["runs"] if bridge else 0
                pred = predict_strength(
                    (src, tgt), ms, cond, evidence, kappa=args.kappa,
                )
                n_run = ds.get("size") or 0
                rich_run = (ds.get("richness") or {}).get(
                    "mean_effective_words"
                )
                # Branch A: this run becomes the edge's best run — its
                # corpus stats define r (CI proxied from n until scored).
                fac_a = reliability_factors(
                    n_run, rich_run, None, runs_cur + 1,
                )
                s_post_a = pred["predicted_strength"] * fac_a["r"]
                # Branch B: the current best stays; this run replicates.
                if bridge:
                    fac_b = reliability_factors(
                        bridge["n_eval"], bridge["eff_words"],
                        bridge["ci_half"], runs_cur + 1,
                    )
                    s_post_b = bridge["q"] * fac_b["r"]
                else:
                    s_post_b = 0.0
                post_r = (fac_a["r"] if s_post_a >= s_post_b
                          else fac_b["r"])
                s_new = max(s_eff_cur, s_post_a, s_post_b)
                cache_key = (edge, round(s_new, 6))
                if cache_key not in gain_cache:
                    gain_cache[cache_key] = single_edge_gain(
                        nodes, Q, src, tgt, s_new, lam=args.lam,
                    )
                mesh_gain = gain_cache[cache_key]
                if est is not None:
                    cost_for_value = max(est, COST_FLOOR)
                elif kind == "engine":
                    # Unpublished engine pricing: rank on the median
                    # PUBLISHED engine rate x the corpus's estimated
                    # character volume — a conservative, documented
                    # stand-in for the ECV denominator only. The item's
                    # est_cost_usd stays null (est_basis "unpublished"):
                    # ranking heuristic, never a price claim.
                    chars, _how = estimate_source_chars(ds, char_medians)
                    cost_for_value = (
                        max(MEDIAN_ENGINE_RATE * chars / 1e6, COST_FLOOR)
                        if chars else COST_FLOOR
                    )
                elif median_per_entry and ds.get("size"):
                    # Same safety multiplier as priced LLM items: this
                    # median comes from the same drifting sweep samples,
                    # and an unscaled denominator would rank unknown-cost
                    # items above their identically-priced known-cost peers.
                    cost_for_value = max(
                        median_per_entry * ds["size"]
                        * LLM_COST_SAFETY_MULTIPLIER,
                        COST_FLOOR,
                    )
                else:
                    cost_for_value = COST_FLOOR
                # ---- Corpus quality markers (copied through from the
                # registry entry, keyed by corpus_id) ---------------------
                # The queue/contribute page can show *what kind* of corpus a
                # run targets without re-reading cards: contamination grade
                # (LOW/MEDIUM/HIGH), domain, and a length figure. The length
                # is the registry richness mean source-character count when
                # available (only computed for some corpora), else the entry
                # count as a coarse stand-in.
                reg_entry = registry_by_id.get(ds["id"], ds)
                richness_markers = reg_entry.get("richness") or {}
                source_length = richness_markers.get("mean_source_chars")
                if source_length is None:
                    source_length = reg_entry.get("size")

                # Contamination multiplier (2026-07-12 remedy #1): MEDIUM/
                # HIGH corpora can never strengthen the clean chain graph
                # (contamination.py doctrine), so their items must not
                # outrank clean-mesh work at equal cost — they stay queued
                # for their relative-lane value, discounted, never dropped.
                contamination_factor = contamination_ecv_factor(
                    reg_entry.get("contamination")
                )
                ecv = (mesh_gain / cost_for_value) * contamination_factor

                item = {
                    # Item id must be UNIQUE per (corpus, model, condition).
                    # Use the corpus_id (ds["id"], globally unique), NOT the
                    # file `stem`: per-pair virtual corpora carved from one
                    # multiway set (e.g. every WMT year's eng>cmn-Hans slice)
                    # share a filename stem, so a stem-based id collided —
                    # 1,988 duplicate ids across the served queue, the same
                    # (corpus,model,cond) run shown up to 8× at different
                    # priorities. `stem` stays the cost-lookup key below.
                    "id": f"{ds['id']}__{slug.replace('/', '_')}__{cond}",
                    "language_pair": f"{src}>{tgt}",
                    "source_language": src_lang,
                    "target_language": lang,
                    # Script subtags stripped by the resolution framework
                    # (display metadata: the corpus is written in this
                    # script; the language identity is the base code).
                    **({"source_script": src_script} if src_script else {}),
                    **({"target_script": tgt_script} if tgt_script else {}),
                    "corpus_id": ds["id"],
                    "corpus_file": f"datasets/{ds['path']}",
                    "corpus_url": corpus_url,
                    "corpus_license": ds.get("license"),
                    "entry_count": ds.get("size"),
                    # Corpus quality markers (registry copy-through, spec: a
                    # contributor sees contamination/domain/length per item).
                    "contamination": reg_entry.get("contamination"),
                    "domain": reg_entry.get("domain"),
                    "source_length": source_length,
                    "model": slug,
                    "condition": cond,
                    "est_cost_usd": est,
                    "est_basis": basis,
                    "pair_covered_on_leaderboard": ds["id"] in covered_pairs,
                    "chaining_gain": round(gains.get(ds["id"], 0.0), 6),
                    # Full formula breakdown (spec §3) — every ranking is
                    # re-derivable by hand from these fields.
                    "edge_quality": round(q_cur, 4),
                    "edge_reliability": round(r_cur, 4),
                    "edge_tier": (bridge["tier"] if bridge
                                  else "registered"),
                    "effective_strength": round(s_eff_cur, 4),
                    "pair_prior": pred["pair_prior"],
                    "prior_basis": pred["prior_basis"],
                    "model_offset": pred["model_offset"],
                    "condition_offset": pred["condition_offset"],
                    "exploration_bonus": pred["exploration_bonus"],
                    "predicted_strength": pred["predicted_strength"],
                    "post_run_reliability": round(post_r, 4),
                    "predicted_effective": round(max(s_post_a, s_post_b), 4),
                    "expected_mesh_gain": round(mesh_gain, 8),
                    "contamination_factor": contamination_factor,
                    "ecv_per_usd": round(ecv, 8),
                    # Map-value inputs (--rank-mode map): the resolved ECV
                    # cost denominator, the edge's published-run count, the
                    # v2 bridge-into-network class/factor, and the corpus's
                    # intrinsic reliability potential f_size × f_rich (spec
                    # §1.5). Unpublished diagnostics, like the ecv breakdown.
                    "cost_for_value": round(cost_for_value, 6),
                    "edge_runs": runs_cur,
                    "map_connectivity_class": conn_cls,
                    "map_connectivity": conn_factor,
                    "map_first_reading": first_reading,
                    "map_corpus_quality": round(
                        fac_a["f_size"] * fac_a["f_rich"], 4,
                    ),
                    "run_command": run_cmd,
                }
                if corpus_stamp is not None:
                    # No-train channel-requirement disclosure (donor-facing;
                    # published — NOT in _PUBLISHED_DROP_FIELDS).
                    item["transmission"] = corpus_stamp
                if is_fetch:
                    se = ds.get("source_export") or {}
                    builder = se.get("builder") or "a registered builder"
                    # The sha the fetch verifies: per-pair built-file pin
                    # (top-level sha256, e.g. GlobalVoices/Tatoeba) when
                    # present, else the upstream archive pin
                    # (source_export.sha256, e.g. TICO-19/IN22).
                    corpus_sha = ds.get("sha256") or se.get("sha256")
                    item["corpus_fetch"] = (
                        f"fetch-from-source: corpus is not hosted in the "
                        f"mirror; mt-eval builds it locally via the "
                        f"'{builder}' builder from the pinned upstream export"
                        + (" and verifies its sha256" if corpus_sha else "")
                        + " (run from an arena checkout)"
                    )
                    item["source_export_url"] = se.get("url")
                    if corpus_sha:
                        item["corpus_sha256"] = corpus_sha
                items.append(item)

    items.sort(key=ecv_sort_key)
    edv_params = None
    if args.rank_mode == "map":
        # Map-value survey ordering (docs/QUEUE_ALGORITHM_REVIEW_2026-07-18):
        # exact lazy greedy over novelty × uncertainty × promise ÷ cost,
        # seeded from the ecv order for deterministic ties. The ecv fields
        # stay on every item — both rankings remain re-derivable.
        items = map_value_order(items)
    elif args.rank_mode == "edv":
        # Expected-decision-value ordering (spec §2.3): judge statics are
        # a pure function of the item universe + board evidence, stamped
        # here so every ranked item carries its own derivation.
        stamp_judge_statics(items, evidence)
        weights = None
        if args.edv_weights:
            j_w, m_w, s_w = (float(x) for x in args.edv_weights.split(","))
            weights = {"judge": j_w, "mesh": m_w, "survey": s_w}
        items, edv_params = edv_value_order(items, weights)
    # Frontier interleave (2026-07-12 remedy #2): every 5th slot of the
    # final ranking carries the best remaining FRONTIER_MODELS item, so
    # contributors produce frontier evidence early. Priorities below are
    # numbered from the WOVEN order — the published ranking is the truth.
    # Applies in both rank modes (frontier evidence feeds the priors that
    # map mode's uncertainty factor reads).
    items = interleave_frontier(items)
    for rank, it in enumerate(items, start=1):
        it["priority"] = rank
        # keep priority near the front of the object for readability
        it_reordered = {"priority": it["priority"], **{k: v for k, v in it.items() if k != "priority"}}
        items[rank - 1] = it_reordered

    # Fail LOUD on duplicate item ids. The DB-as-queue PK (public.queue_items)
    # requires them unique, and a duplicate means the SAME (corpus, model,
    # condition) run is shown twice at different priorities — a silent
    # regression of the 2026-07-20 stem-collision bug. Never emit a queue that
    # cannot be served.
    _ids = [it["id"] for it in items]
    if len(_ids) != len(set(_ids)):
        seen: dict[str, int] = {}
        for _i in _ids:
            seen[_i] = seen.get(_i, 0) + 1
        dups = sorted(k for k, c in seen.items() if c > 1)
        raise SystemExit(
            f"QUEUE ID COLLISION: {len(_ids) - len(set(_ids))} duplicate item "
            f"ids across {len(dups)} keys (e.g. {dups[:3]}). Item ids must be "
            f"unique per (corpus, model, condition) — see the id construction."
        )

    # Transmission-stamp bookkeeping for the metadata block below.
    n_stamped = sum(1 for it in items if "transmission" in it)
    stamped_corpora = len(
        {it["corpus_id"] for it in items if "transmission" in it}
    )

    # Doctrine-exclusion bookkeeping (reason prefix → count) for metadata.
    doctrine_by_reason: dict[str, int] = {}
    for _cid, _reasons in doctrine_excluded:
        for _r in _reasons:
            _key = _r.split(":")[0]
            doctrine_by_reason[_key] = doctrine_by_reason.get(_key, 0) + 1

    queue = {
        "metadata": {
            "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "generator": "arena/scripts/generate_sweep_queue.py",
            "open_items": len(items),
            "corpora": len({it["corpus_id"] for it in items}),
            "models": lineup,
            # Lane policy (founder directive 2026-07-19): the public queue
            # carries the LLM lane only, restricted to pairs touching at
            # least one language outside every MT service's published
            # coverage. Engines run as separate campaigns (--lane engine).
            "lane": lane,
            "lane_policy": (
                "llm: LLM items only, on pairs where at least one side is "
                "not in any MT service's published coverage list "
                "(shared/catalogue/method-coverage.json — the union below); "
                "MT-engine evaluations run as separate campaigns and their "
                "published results still appear on the leaderboard and "
                "mesh. engine/both lanes exist for those campaigns."
            ),
            "service_coverage_methods": sorted(engine_lane),
            "service_covered_languages": len(service_covered),
            "pairs_dropped_fully_covered": dropped_fully_covered,
            # Doctrine gate (LANGUAGE_TAXONOMY Position 4 v2 / spec §2.2):
            # corpora whose upstream language labels do not all resolve to
            # ACTIVE INDIVIDUAL ISO 639-3 codes are excluded with
            # machine-readable reasons — visible here and in the desert
            # ledger, never silently dropped.
            "doctrine_exclusions": {
                "total": len(doctrine_excluded),
                "by_reason": dict(sorted(doctrine_by_reason.items())),
                "corpora": [
                    {"id": cid, "reasons": rs}
                    for cid, rs in sorted(doctrine_excluded)
                ],
                "policy": (
                    "Queue items target only active INDIVIDUAL ISO 639-3 "
                    "codes: a score against a macrolanguage or collective "
                    "label would be an unfalsifiable claim about varieties "
                    "never evaluated. Excluded corpora stay catalogued "
                    "under their upstream-faithful labels and re-enter the "
                    "queue when a variety resolution with a citable basis "
                    "is recorded on their corpora card "
                    "(docs: /docs/network/specifications/queue-construction)."
                ),
            },
            "conditions": (
                list(CONDITIONS) if lane == "llm" else
                ([ENGINE_CONDITION] if lane == "engine" else
                 list(CONDITIONS) + [ENGINE_CONDITION])
            ),
            "engines": sorted(engine_lane) if lane in ("engine", "both") else [],
            "engine_lane_notes": engine_notes,
            "engine_lane": (
                "Not in this queue: MT-engine evaluations run as separate "
                "campaigns (generator --lane engine); their published "
                "results still count on the leaderboard and mesh. See "
                "lane_policy."
            ) if lane == "llm" else (
                "MT-engine items (condition \"engine\") pair a self-"
                "contained MT API system with a corpus — run via `mt-eval "
                "run --method <engine>`; engines translate by themselves, "
                "so no prompting conditions apply. An engine enqueues only "
                "for pairs whose source AND target are in its published "
                "coverage list (shared/catalogue/method-coverage.json, "
                "imported cite-only). Ranking uses the same ecv-v3 "
                "transparent sum as LLM items with a NEUTRAL model-offset "
                "prior: engines have no baseline-sweep priors, so until "
                "engine runs are published their model offset is exactly 0 "
                "and the UCB exploration bonus applies as usual; once "
                "engine runs land on the board their offsets are learned "
                "from published results exactly like any model's. Cost: "
                "engines with a published per-character list price "
                "(reference: cli/lib/methods/provider-pricing.js) get "
                "price x estimated corpus source characters (est_basis "
                "says whether the volume was measured or extrapolated); "
                "engines without published pricing carry est_cost_usd null "
                "/ est_basis \"unpublished\", and self-hosted engines carry "
                "null too (the real cost is your infrastructure — unknown, "
                "never claimed $0). A price is never invented; null-cost "
                "items rank on the median published engine rate as a "
                "conservative denominator stand-in."
            ),
            "coverage_source": coverage_note,
            "priority_model": (
                "expected-chain-value v3: items are ranked by "
                "ECV = ΔΦ / cost — the expected gain in quality-weighted "
                "mesh efficiency Φ from publishing this run, per estimated "
                "dollar. Φ averages, over all ordered language pairs, the "
                "best chain strength Q(u,v) = max over paths of "
                "λ^(hops−1)·Π(chrF++/100 per edge). Each item's "
                "predicted score is pair prior + model offset + condition "
                "offset + UCB exploration bonus; every component is defined "
                "in the normative spec and the per-edge quality/reliability "
                "bridges are published in mesh.json, so the ranking stays "
                "re-derivable. 2026-07-12 remedies: each item's ECV is "
                "multiplied by a contamination factor (LOW 1.0 / MEDIUM 0.4 "
                "/ HIGH 0.1; unknown treated as MEDIUM) — MEDIUM/HIGH runs "
                "cannot enter the clean chain graph, so they rank behind "
                "clean-mesh work while staying queued for relative-lane "
                "value — and every 5th priority slot carries the best "
                "remaining frontier-model item so frontier evidence reaches "
                "the prediction priors early. Normative definition, "
                "philosophy, and citations: "
                "https://champollion.dev/docs/network/specifications/"
                "queue-construction"
            ),
            "priority_parameters": {
                "formula_version": "ecv-v3",
                "lambda_junction_discount": args.lam,
                "kappa_exploration_scale": args.kappa,
                "strength_cap": S_CAP,
                "cost_floor_usd": COST_FLOOR,
                "prior_fallback": S0_FALLBACK,
                "contamination_ecv_factors": {
                    **CONTAMINATION_ECV_FACTORS,
                    "UNKNOWN": CONTAMINATION_DEFAULT_FACTOR,
                },
                "frontier_interleave": {
                    "every": FRONTIER_INTERLEAVE_EVERY,
                    "models": sorted(FRONTIER_MODELS),
                },
                "reliability_thresholds": {
                    "n_full": RELIABILITY_N_FULL,
                    "effective_words_healthy": RELIABILITY_L_HEALTHY,
                    "ci_half_noise_floor": RELIABILITY_H_NOISE,
                    "runs_full": RELIABILITY_RUNS_FULL,
                },
                "phi_current": round(phi_now, 6),
                "scored_runs_used": evidence["n_results"],
                "scored_edges": len(evidence["edge_strength"]),
                "languages_in_graph": n_nodes,
            },
            # Preview selection policy (2026-07-12 remedies #3 + #4),
            # published AS DATA so the card-less regenerate-queue edge
            # function applies the identical top-N selection between full
            # regenerations. Presentation only — the ranking above is
            # unaffected.
            "preview_policy": build_preview_policy(items),
            "cost_basis": (
                "Cost estimates come from the 2026-06 baseline sweep manifest "
                f"(arena/eval/logs/sweep_manifest.json: {sweep_ok} successful "
                f"runs, ${sweep_total:.2f} total). 'observed' = exact cost of "
                "the same corpus x model naive run; 'extrapolated' = that "
                "model's sweep-average cost per entry x corpus entry count. "
                f"Both are scaled by a {LLM_COST_SAFETY_MULTIPLIER:g}x "
                "cost-drift safety margin: a 2026-07 calibration run cost "
                "3.4x the raw sweep estimate (provider price updates since "
                "the sweep froze), so LLM estimates are deliberately "
                "conservative — expect actual spend at or below the estimate. "
                "Your cost varies with provider pricing at run time. "
                "MT-engine items are priced from published per-character "
                "list prices (reference: cli/lib/methods/provider-pricing.js) "
                "x estimated corpus source characters; engines without "
                "published pricing carry est_cost_usd null (est_basis "
                "'unpublished') — unpublished pricing is never invented."
            ),
            "how_to_run": (
                "Install: pipx install mt-eval-harness ; set "
                "OPENROUTER_API_KEY; then paste any item's run_command. "
                "Corpora not hosted by us (fetch-from-source in the "
                "registry) run from your arena checkout and the harness "
                "downloads the pinned Tatoeba Challenge export (~169 MB, "
                "cached once for all pairs), rebuilds the corpus locally, "
                "and verifies its sha256 against the registry. "
                "Coached items: write your own coaching file first — see "
                "https://champollion.dev/docs/network/tutorials/coached-llm-prompting"
            ),
            "how_to_publish": (
                "mt-eval publish <report.json> — sign in via OAuth when "
                "prompted. Community submissions land at the "
                "'self-benchmarked' trust tier with your name attached; "
                "that is the trust model working as designed."
            ),
            "dedupe_note": (
                "No claim-locking: pick any open item. Run-card fingerprints "
                "(SHA-256 of dataset hash + model + condition + system prompt) "
                "deduplicate identical runs on publish, and independent "
                "replications of the same item are scientifically useful, "
                "not wasted."
            ),
            "license_note": (
                "Most queued corpora are CC-BY family (Tatoeba-derived) and "
                "carry do_not_train: true — they are evaluation sets, not "
                "training data. NC-licensed and quarantined corpora are "
                "excluded from this queue; license-restricted corpora "
                "appear only under the recorded no-train policy described "
                "in transmission_note, and their items say so."
            ),
            # Channel rule for license-restricted corpora (founder ruling
            # 2026-07-19 — the rights-holder decides, never us). Counts are
            # measured from the items actually emitted above.
            "transmission_note": (
                "Corpora whose license requires the rights-holder's "
                "recorded transmission consent — and sealed/held-out sets — "
                "are never queued: their remote evaluation refuses. "
                "License-restricted corpora reach this queue only under an "
                "explicitly recorded no-train policy on their registry "
                "entry (today: the WMT research-use test sets), and every "
                "such item carries a 'transmission' block naming the "
                "requirement: send only over channels that do not retain "
                "or train on inputs. mt-eval enforces this automatically "
                "(OpenRouter requests pinned to provider "
                "data_collection=deny; first-party vendor APIs; or local "
                "runs); custom clients must attach the item's "
                "openrouter_provider_prefs to OpenRouter requests."
            ),
            "transmission_restricted_items": n_stamped,
            "transmission_restricted_corpora": stamped_corpora,
        },
        "items": items,
    }

    if args.rank_mode == "map":
        # Map mode is additive-only on metadata: rank_mode marker, an honest
        # priority_model description, and the desert ledger. The default ecv
        # path emits none of these keys (byte-stable behavior).
        queue["metadata"]["rank_mode"] = "map"
        queue["metadata"]["priority_model"] = (
            "map-value v2 (survey mode): items are ranked by "
            "MapValue = novelty × uncertainty × promise × connectivity × "
            "corpus-quality × contamination ÷ cost. novelty is positional "
            "first-light credit that decays as higher-ranked items occupy "
            "the same directed pair (1/(1+n)), target language, target "
            "family, (method × target-family) cell, and (target × domain) "
            "cell (each 1/√(1+n); families from the language cards, "
            "domains from the corpus registry); uncertainty is the "
            "prediction back-off depth (pair 0.25 / target-language 0.55 / "
            "source-language 0.75 / global 1.0) × 1/(1+published runs on "
            "the edge); promise is the ecv-v3 predicted strength floored "
            "at 0.25; connectivity ranks up pairs that LINK the measured/"
            "covered network to a language it cannot yet reach — a side is "
            "established when it lies on a measured mesh edge or in any MT "
            "service's published coverage (macrolanguage-aliased), and "
            "exactly one established side scores 1.0 (bridge) while "
            "islands (neither) and interior densification (both) score "
            "0.5; corpus-quality is the corpus's intrinsic reliability "
            "potential f_size × f_rich (thresholds of the reliability "
            "model, §1.5 of the spec), so tiny or single-word corpora no "
            "longer headline the survey on cheapness alone; contamination "
            "and cost discipline are identical to ecv mode. Assembly is an "
            "exact greedy trace with deterministic tie-breaks, then the "
            "standard frontier interleave. Objective: maximize what the "
            "map learns per dollar while growing OUT of the measured "
            "network — first measurements across pairs, languages, "
            "families, method-cells, and domains, bridges before deserts "
            "before densification — instead of expected mesh gain "
            "(rank_mode 'ecv'). Normative definition + factor values: "
            "https://champollion.dev/docs/network/specifications/"
            "queue-construction (§2.2); connectivity and quality inputs "
            "are re-derivable from the published mesh.json, registry.json, "
            "and method-coverage artifacts, and the ecv-v3 diagnostics "
            "remain on every item, so either ordering can be re-derived."
        )
        queue["metadata"]["map_value_parameters"] = {
            "map_value_version": "map-v2",
            "basis_uncertainty": MAP_BASIS_UNCERTAINTY,
            "promise_floor": MAP_PROMISE_FLOOR,
            "connectivity_factors": MAP_CONNECTIVITY_FACTORS,
            "first_reading_boost": MAP_FIRST_READING_BOOST,
            "first_reading_note": (
                "ninth principle (2026-08-27): an item whose source or "
                "target language has zero published measurements carries "
                "this multiplier on the survey value — a language's first "
                "reading outranks refinement"
            ),
            "connectivity_note": (
                "a side is established when on a measured mesh edge "
                "(mesh.json status 'measured') or in the MT services' "
                "published coverage union (macrolanguage-aliased via the "
                "language cards)"
            ),
            "corpus_quality": (
                "f_size (min(1, entries/100)) × f_rich (min(1, effective "
                "words/5)); missing richness measurements are neutral"
            ),
            "novelty_counters": [
                "directed pair: 1/(1+n)",
                "target language: (1+n)^-0.5",
                "target family: (1+n)^-0.5",
                "method × target-family: (1+n)^-0.5",
                "target × domain: (1+n)^-0.5",
            ],
            "measured_languages": len(measured_langs),
            "established_languages": len(measured_langs | service_covered),
        }
        queue["metadata"]["service_landscape"] = build_service_landscape(
            items, registry.get("datasets", []), engine_lane,
        )
    elif args.rank_mode == "edv":
        # Same additive-only discipline as map mode: rank_mode marker, an
        # honest priority_model description, and the full parameter echo so
        # every published edv value is re-derivable from its own artifacts.
        queue["metadata"]["rank_mode"] = "edv"
        queue["metadata"]["priority_model"] = (
            "edv-v1 (expected decision value): items are ranked by "
            "EDV = [w_judge·Ĵ + w_mesh·M̂ + w_survey·Ŝ] × contamination ÷ "
            "cost. Ĵ prices settling same-corpus method comparisons — "
            "first contrasts, contested contrasts near decision, "
            "condition contrasts — with per-pair method rankings from the "
            "licensed within-language additive adjustment (research/"
            "w2-irt; never pooled across pairs). M̂ is the ecv-v3 expected "
            "mesh gain; Ŝ is map-value v2's survey core (uncertainty × "
            "promise × connectivity × corpus-quality with positional "
            "novelty decay). Components are p95-normalized over the "
            "candidate set (normalizers below); assembly is an exact lazy "
            "greedy trace, then the standard frontier interleave. "
            "Normative definition: https://champollion.dev/docs/network/"
            "specifications/queue-construction (§2.3)."
        )
        queue["metadata"]["edv_parameters"] = edv_params
        queue["metadata"]["service_landscape"] = build_service_landscape(
            items, registry.get("datasets", []), engine_lane,
        )

    out = Path(args.output)
    out.parent.mkdir(parents=True, exist_ok=True)
    # Published work-list: slim items + compact encoding. The full ecv-v3
    # diagnostics live in the spec + mesh.json bridges; per-item corpus-fetch
    # provenance lives in registry.json. Compact + slim keeps the served file
    # well under GitHub's 100 MB per-file limit (a pretty-printed full-field
    # dump of ~60k items runs >100 MB and is rejected on push).
    if args.dump_full_items:
        dump_path = Path(args.dump_full_items)
        dump_path.parent.mkdir(parents=True, exist_ok=True)
        dump_path.write_text(
            json.dumps({"metadata": queue["metadata"], "items": items},
                       ensure_ascii=False, separators=(",", ":")) + "\n",
            encoding="utf-8",
        )
        print(f"  full-items dump: {len(items)} items -> {dump_path}")

    published_items = [slim_published_item(it) for it in items]
    published = {
        "metadata": queue["metadata"],
        "items": published_items,
    }
    body = json.dumps(published, ensure_ascii=False, separators=(",", ":")) + "\n"
    # Blob size cap: keep the top slice of the ranking, stamped loudly.
    # The DB queue holds the complete ranking either way (queue_items rows
    # are written from the FULL items list above, before this cut).
    if len(body.encode("utf-8")) > BLOB_MAX_BYTES:
        total = len(published_items)
        keep = total
        while len(body.encode("utf-8")) > BLOB_MAX_BYTES and keep > 1:
            keep = int(keep * BLOB_MAX_BYTES / len(body.encode("utf-8")) * 0.97)
            queue["metadata"]["blob_truncated"] = {
                "kept": keep,
                "total": total,
                "note": (
                    "queue.json carries the top slice of the ranking "
                    "(static-hosting size cap); the DB queue "
                    "(queue_top/queue_pairs) serves the complete ranking "
                    "and is authoritative."
                ),
                "preview_scope": (
                    "queue-preview.json's pairs and budget_tiers aggregate "
                    "the served blob slice, not the complete ranking — use "
                    "the queue_pairs() RPC for full-set aggregates."
                ),
            }
            published["items"] = published_items[:keep]
            body = json.dumps(
                published, ensure_ascii=False, separators=(",", ":")) + "\n"
        print(f"  blob cap: queue.json truncated to top {keep} of {total} "
              f"items ({len(body.encode('utf-8')) / 1e6:.1f} MB) — DB queue "
              f"carries the full ranking")
    out.write_text(body, encoding="utf-8")

    # Small companion the website pages fetch instead of the full file, so a
    # page load never pulls tens of MB. Size is measured from the file we just
    # wrote so the "Download full queue (NN MB)" link is always honest.
    preview = build_queue_preview(published, out.stat().st_size)
    preview_out = out.parent / "queue-preview.json"
    _write_json_if_changed(preview_out, preview)

    mesh = build_mesh_snapshot(
        corpora, evidence, results, registry, phi_current=phi_now,
    )
    mesh_out = (
        Path(args.mesh_output) if args.mesh_output
        else out.parent / "mesh.json"
    )
    mesh_out.parent.mkdir(parents=True, exist_ok=True)
    mesh_out.write_text(
        json.dumps(mesh, ensure_ascii=False, indent=1) + "\n",
        encoding="utf-8",
    )

    # Publish the canonical registry alongside queue.json so the served
    # registry (champollion.dev/registry.json, the harness remote fallback)
    # cannot drift from the served queue — both come from one regeneration.
    registry_out, registry_n = publish_registry(registry, out.parent)

    # DB-as-queue (B1): materialize the SAME ranking into public.queue_items so
    # the queue can be served from Postgres (queue_top) with live
    # verified-coverage filtering. Additive + NON-FATAL: only when a service key
    # is present, only for the public LLM lane (naive/coached — matches the
    # queue_items CHECK); a failure here never breaks the file artifacts above.
    service_key = (os.environ.get("MT_EVAL_SUPABASE_SERVICE_KEY")
                   or os.environ.get("SUPABASE_SERVICE_KEY"))
    # Lane 'both' materializes too since migration 071 admitted the
    # 'engine' condition; an engines-only campaign queue stays file-only.
    if service_key and lane in ("llm", "both"):
        # The DB generation id carries a random suffix on top of the
        # metadata timestamp: a retried or same-second run gets a DISTINCT
        # id, so its sweep correctly retires the earlier attempt's rows
        # instead of leaving two generations interleaved under one id.
        # (Two generators running truly concurrently remain last-writer-
        # wins by design — the sweep is the serialization point.)
        gen_id = (queue["metadata"]["generated_at"]
                  + "-" + os.urandom(3).hex())
        try:
            qi_rows = queue_items_rows(items, args.rank_mode, gen_id)
            n_qi = upsert_queue_items(qi_rows, gen_id, SUPABASE_URL, service_key)
            print(f"  queue_items: upserted {n_qi} rows to the DB "
                  f"(generation {gen_id}) — served via queue_top()")
        except Exception as exc:  # never break artifact generation
            print(f"  queue_items: DB upsert skipped (non-fatal): {exc}",
                  file=sys.stderr)

    print(f"queue: {len(items)} open items -> {out} "
          f"({out.stat().st_size / 1e6:.1f} MB, compact)")
    print(f"  preview: top {preview['preview_count']} + "
          f"{len(preview['pairs'])} pairs -> {preview_out} "
          f"({preview_out.stat().st_size / 1e6:.2f} MB)")
    print(f"  corpora: {queue['metadata']['corpora']}  models: {len(lineup)}  conditions: {CONDITIONS}")
    n_engine_items = sum(
        1 for it in items if it["condition"] == ENGINE_CONDITION
    )
    print(f"  engine lane: {len(engine_lane)} engine(s) "
          f"({', '.join(sorted(engine_lane)) or 'none'}) -> "
          f"{n_engine_items} coverage-gated items")
    print(f"  coverage: {coverage_note}")
    measured = sum(1 for e in mesh["edges"] if e["status"] == "measured")
    print(f"  mesh: {len(mesh['nodes'])} languages, {measured} measured / "
          f"{len(mesh['edges'])} registered edges -> {mesh_out}")
    print(f"  registry: {registry_n} datasets -> {registry_out}")
    if n_stamped:
        print(f"  transmission: {n_stamped} no-train item(s) across "
              f"{stamped_corpora} license-restricted corpora — stamped with "
              f"the channel requirement (OpenRouter provider "
              f"data_collection=deny)")
    if doctrine_excluded:
        print(f"  doctrine exclusions (Position 4 v2 — unresolved macro/"
              f"collective labels, see metadata.doctrine_exclusions): "
              f"{len(doctrine_excluded)} corpora")
    if unresolvable_names:
        # Post-gate every target is an active individual code; a missing
        # display name is a language-card defect. Fail LOUD — a silently
        # shrinking queue misled us for weeks (the pre-v2 skip list).
        raise SystemExit(
            f"NAME RESOLUTION ERROR: {len(unresolvable_names)} corpora "
            f"resolve to an individual code with no display name in the "
            f"language cards / ISO tables — fix the cards, do not skip: "
            f"{', '.join(unresolvable_names)}"
        )
    return 0


if __name__ == "__main__":
    sys.exit(main())
