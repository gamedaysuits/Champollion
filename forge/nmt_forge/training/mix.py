"""The mix builder — training best practices as the DEFAULT path.

Everything the requirements ledger says a training mix must do, in one
audited place:

- **leak-audit first** (guards #1/#9): every lane — gold, synthetic — is
  screened against every registered eval set; exact hits on test/sealed are
  fatal; whole-file identity is fatal.
- **benchmarks never train**: a lane declaring a harness ``dataset_id`` is
  checked against the mt-eval registry's ``do_not_train``/``quarantine``
  flags (all 5,602 registry datasets are do_not_train) and refused.
- **tagged synthetic** (Caswell, Kreutzer & Cherry 2019 — tagged
  back-translation, adapted to synthetic-source lanes): every synthetic lane
  carries its source-side tag; gold stays untagged; a tag colliding with
  gold text is refused. Inference is untagged, so gold anchors output style.
- **stratified sampling** (guard #7): the per-kind capped reservoir is the
  default sampler for synthetic lanes.
- **gold upweighting with the exposure math WRITTEN DOWN**: the manifest
  records unique gold sentences, the detected augmentation multiplier, and
  effective exposure per unique sentence — the silent ×20-is-really-×54 trap
  from the reference A/Bs, made explicit.
- **single-convention targets** (guard #5) when the pack declares conventions.
- **target-validity gate** (2026-07-14, founder question "is there a reason
  we don't gate at this stage?" — answer: there wasn't a good one): when a
  validator is configured (``mix.validator``, e.g. every-word-FST-analyzable),
  forge STOPS TRUSTING the pack's verified-at-generation claim and re-measures
  each lane at ingest. A synthetic lane below ``mix.validity_floor`` is
  refused — verified-by-construction data that fails re-verification means the
  generator (or a later transform) broke, the exact 'trust the tool' failure
  class in the taxonomy (§8.1). Gold is real text: measured and recorded,
  never gated.
"""

from __future__ import annotations

import random
from dataclasses import dataclass, field

from ..canonical import canonical_key
from ..errors import ConfigError
from ..guards.convention_lint import assert_single_convention
from ..guards.leak_audit import assert_clean
from ..guards.sample_strata import stratified_sample, top_kind_share
from ..registry import load_rows
from ..workspace import Workspace
from .config import RunConfig


@dataclass
class MixResult:
    rows: list[dict]
    manifest: dict = field(default_factory=dict)


def _harness_dataset_flags(dataset_ids: list[str]) -> dict:
    """do_not_train / quarantine flags from the mt-eval registry; degrades
    gracefully (with an explicit warning) when the registry is unreachable."""
    if not dataset_ids:
        return {"declared": []}
    try:
        from .. import _harness

        _harness.load_harness()
        from mt_eval_harness.config import load_registry

        reg = load_registry()
        by_id = {e.get("id"): e for e in reg.get("datasets", [])}
    except Exception as e:  # registry absent (PyPI wheel gotcha) or gated
        return {
            "declared": dataset_ids,
            "warning": f"mt-eval registry unavailable ({type(e).__name__}); "
                       "declared dataset ids NOT verified against "
                       "do_not_train/quarantine",
        }
    verdicts = {}
    for did in dataset_ids:
        entry = by_id.get(did)
        if entry is None:
            verdicts[did] = "unknown-id"
            continue
        if entry.get("do_not_train") or entry.get("quarantine"):
            raise ConfigError(
                f"synthetic/gold lane declares dataset_id {did!r}, which the "
                "mt-eval registry marks "
                f"{'quarantined' if entry.get('quarantine') else 'do_not_train'} "
                "— benchmarks and quarantined sets never enter training "
                "mixes. Remove the lane; if you need in-domain data, build a "
                "train split from a source the registry does not protect."
            )
        verdicts[did] = "ok"
    return {"declared": dataset_ids, "verdicts": verdicts}


def _measure_validity(rows: list[dict], validator) -> dict:
    """Fraction of rows whose target the validator accepts, with examples of
    failing row ids (never target text — content-free discipline)."""
    invalid_ids = []
    for i, r in enumerate(rows):
        if not validator(str(r.get("target", ""))):
            invalid_ids.append(str(r.get("id", i)))
    n = len(rows)
    return {
        "rows_checked": n,
        "valid_rate": round((n - len(invalid_ids)) / n, 4) if n else 1.0,
        "invalid_rows": len(invalid_ids),
        "invalid_ids_sample": invalid_ids[:20],
    }


def _resolve_validator(cfg: RunConfig, validator):
    if validator is not None:
        return validator
    if cfg.mix.validator:
        from importlib import import_module

        module, _, attr = cfg.mix.validator.partition(":")
        if not module or not attr:
            raise ConfigError(
                f"mix.validator {cfg.mix.validator!r} must look like "
                "'package.module:attr'")
        return getattr(import_module(module), attr)
    return None


def build_mix(
    cfg: RunConfig,
    workspace: Workspace,
    *,
    canonicalizer=None,
    conventions=None,
    validator=None,
    stage_overrides: dict | None = None,
) -> MixResult:
    ov = stage_overrides or {}
    upweight = int(ov.get("gold_upweight", cfg.mix.gold_upweight))
    kind_cap = ov.get("kind_cap", cfg.mix.kind_cap)
    sample_n = ov.get("synthetic_sample", cfg.mix.synthetic_sample)
    seed = cfg.mix.seed
    rng = random.Random(seed)
    validator = _resolve_validator(cfg, validator)

    flags = _harness_dataset_flags(
        [l.dataset_id for l in cfg.synthetic if l.dataset_id])

    # -- gold ---------------------------------------------------------------
    gold_rows: list[dict] = []
    gold_audits = {}
    gold_validity = {}
    for path in ov.get("gold", cfg.gold):
        rows = load_rows(path)
        report = assert_clean(rows, workspace, canonicalizer=canonicalizer)
        gold_audits[str(path)] = report.to_manifest()
        if validator is not None:
            # gold is real text: the validator's coverage of it is a fact
            # about the VALIDATOR (and the orthography), never a gate
            gold_validity[str(path)] = _measure_validity(rows, validator)
        gold_rows.extend(rows)
    unique_sources = {canonical_key(str(r.get("source", "")), canonicalizer)
                      for r in gold_rows}
    augment_multiplier = (len(gold_rows) / len(unique_sources)
                          if unique_sources else 0.0)

    # tag collision check needs gold text BEFORE synthetic tagging
    gold_text = " \n".join(str(r.get("source", "")) for r in gold_rows)

    # -- synthetic lanes ------------------------------------------------------
    synth_rows: list[dict] = []
    lane_manifests = []
    floor = float(ov.get("validity_floor", cfg.mix.validity_floor))
    for lane in ov.get("synthetic", cfg.synthetic):
        rows = load_rows(lane.path)
        report = assert_clean(rows, workspace, canonicalizer=canonicalizer)
        lane_validity = None
        if validator is not None:
            lane_validity = _measure_validity(rows, validator)
            if lane_validity["valid_rate"] < floor:
                raise ConfigError(
                    f"synthetic lane {lane.path!r}: target-validity "
                    f"{lane_validity['valid_rate']:.1%} is under the "
                    f"{floor:.0%} floor ({lane_validity['invalid_rows']} rows "
                    f"failed; ids: {lane_validity['invalid_ids_sample'][:5]}). "
                    "Synthetic data claims verified-by-construction, so "
                    "failing re-verification at ingest means the generator "
                    "(or a transform after it) broke — do NOT train on it.\n"
                    "  fix: regenerate the lane through the pack's emit law, "
                    "or drop the failing rows and re-run; lower "
                    "mix.validity_floor only if the validator itself is "
                    "known-stricter than the generator's"
                )
        if lane.tag in gold_text:
            raise ConfigError(
                f"lane tag {lane.tag!r} appears verbatim in gold source text "
                "— the tag would stop being a lane marker. Pick a tag that "
                "cannot occur in real text."
            )
        # the kind cap balances BETWEEN kinds; a single-kind lane (e.g. a
        # backtranslation lane, all kind=backtranslation) has nothing to
        # balance and is exempt — recorded as such in the lane manifest.
        n_kinds = len({str(r.get("kind", "?")) for r in rows})
        strata_manifest = None
        if sample_n is not None:
            effective_cap = kind_cap if (kind_cap is not None and n_kinds > 1) else 1.0
            rows, strata_manifest = stratified_sample(
                rows, sample_n, cap_fraction=effective_cap, seed=seed)
            strata_manifest["single_kind_lane"] = n_kinds == 1
        elif kind_cap is not None and n_kinds > 1:
            kind, share = top_kind_share(rows)
            if share > kind_cap:
                raise ConfigError(
                    f"synthetic lane {lane.path!r}: kind {kind!r} is "
                    f"{share:.0%} of the lane, over the {kind_cap:.0%} cap, "
                    "and no synthetic_sample size is set to sample it down. "
                    "Two kinds were 54% of the reference corpus this way "
                    "(mistake #7).\n  fix: set mix.synthetic_sample to enable "
                    "the capped reservoir, or set mix.kind_cap: null to "
                    "accept the skew deliberately (recorded in the manifest)",
                )
        tagged = 0
        out_rows = []
        for r in rows:
            src = str(r.get("source", ""))
            if not src.startswith(lane.tag + " "):
                src = f"{lane.tag} {src}"
                tagged += 1
            out_rows.append({**r, "source": src})
        synth_rows.extend(out_rows)
        lane_manifests.append({
            "path": str(lane.path),
            "tag": lane.tag,
            "origin": lane.origin,
            "rights": lane.rights,
            "rows": len(out_rows),
            "newly_tagged": tagged,
            "leak_audit": report.to_manifest(),
            "strata": strata_manifest,
            "target_validity": lane_validity,
        })

    # -- conventions (guard #5) ----------------------------------------------
    convention_report = None
    if conventions:
        all_targets = [str(r.get("target", "")) for r in gold_rows + synth_rows]
        convention_report = assert_single_convention(
            all_targets, conventions, context="training targets").to_manifest()

    # -- assemble ---------------------------------------------------------------
    rows = gold_rows * upweight + synth_rows
    rng.shuffle(rows)

    manifest = {
        "guard": "mix-builder",
        "seed": seed,
        "gold": {
            "rows": len(gold_rows),
            "unique_sources": len(unique_sources),
            "detected_augment_multiplier": round(augment_multiplier, 2),
            "upweight": upweight,
            # the number that silently differed between "fair" A/B arms in
            # the reference work (×20 on 4-variant-augmented rows ≈ ×54 per
            # unique sentence):
            "effective_exposure_per_unique_sentence":
                round(upweight * augment_multiplier, 1),
            "leak_audits": gold_audits,
            "target_validity": gold_validity or None,
            "rights": cfg.data_rights,
        },
        "validity_gate": ({"validator": cfg.mix.validator or "(callable)",
                           "floor": floor}
                          if validator is not None else None),
        "synthetic": lane_manifests,
        "dataset_id_flags": flags,
        "conventions": convention_report,
        "total_rows": len(rows),
    }
    return MixResult(rows=rows, manifest=manifest)
