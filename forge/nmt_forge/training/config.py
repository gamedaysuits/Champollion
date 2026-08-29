"""Run configuration — one JSON file, hashed, validated loudly.

The config hash (sha256 of the canonical raw JSON) is the identity that
threads through everything: the dev-fence read, the preregistration binding,
the run directory, the manifests. Two runs with the same hash are the same
experiment; a changed config is visibly a different one.

Validation refuses unknown keys (a typo like ``gold_upwieght`` must not
silently become a default) and enforces the shape of lane tags.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from pathlib import Path

from ..canonical import config_hash
from ..errors import ConfigError

_TAG_RE = re.compile(r"^<[a-z0-9_-]+>$")

_TOP_KEYS = {"run_name", "workspace", "language", "data", "mix", "model",
             "selection", "curriculum", "decode", "regime", "eval"}
_DATA_KEYS = {"gold", "synthetic", "dev", "monolingual", "rights"}
_MIX_KEYS = {"gold_upweight", "kind_cap", "synthetic_sample", "seed",
             "validator", "validity_floor"}
_SELECTION_KEYS = {"metric", "patience", "top_k", "plugins", "auto_plugins"}
_DECODE_KEYS = {"max_new_tokens", "headroom_factor", "hook", "num_beams"}
_LANE_KEYS = {"path", "tag", "origin", "dataset_id", "rights"}
_EVAL_KEYS = {"battery", "by", "metrics", "plugins", "card_plugins",
              "conventions", "canonicalizer", "prereg", "seed", "n_bootstrap"}


def _check_keys(obj: dict, allowed: set[str], where: str) -> None:
    unknown = set(obj) - allowed
    if unknown:
        raise ConfigError(
            f"{where}: unknown key(s) {sorted(unknown)} — refusing to guess. "
            f"Allowed: {sorted(allowed)}"
        )


@dataclass(frozen=True)
class SynthLane:
    path: str
    tag: str = "<synth>"
    origin: str = ""
    dataset_id: str | None = None
    # rights metadata for fetch-from-source data (gloss-bearing corpora etc.):
    # free-form {source, license_note, redistributable, …} — recorded in the
    # mix manifest and the run report, never enforced (honest paper trail)
    rights: dict | None = None

    def __post_init__(self):
        if not _TAG_RE.match(self.tag):
            raise ConfigError(
                f"synthetic lane tag {self.tag!r} must look like '<synth>' — "
                "the tag is a source-side token (Caswell et al. 2019, tagged "
                "back-translation, adapted); a malformed tag silently merges "
                "the lane into gold"
            )


@dataclass(frozen=True)
class MixParams:
    gold_upweight: int = 20
    kind_cap: float | None = 0.15
    synthetic_sample: int | None = None
    seed: int = 42
    # target-validity gate: 'module.path:attr' resolving to a callable
    # (target_text) -> bool (e.g. every-word-FST-analyzable). Synthetic lanes
    # claim verified-by-construction, so a rate under the floor means the
    # GENERATOR lied — refused. Gold is real text: measured, never gated.
    validator: str | None = None
    validity_floor: float = 0.98


@dataclass(frozen=True)
class SelectionParams:
    metric: str = "generation:chrf++"   # or "loss", a neural lane, a plugin lane
    patience: int = 6
    top_k: int = 3                      # checkpoints decoded for generation metric
    plugins: tuple[str, ...] = ()       # "module.path:ClassName" LYSS lanes
    auto_plugins: bool = False          # harness plugin discovery for language.target

    def __post_init__(self):
        if self.metric != "loss" and not self.metric.startswith("generation:"):
            raise ConfigError(
                f"selection.metric {self.metric!r} must be 'loss' or "
                "'generation:<metric>' (e.g. 'generation:chrf++', or a LYSS "
                "plugin lane like "
                "'generation:crk_linter:equivalent_match_rate' with the "
                "plugin listed in selection.plugins) — the generation option "
                "exists because 'eval-loss is enough' is an OPEN QUESTION, "
                "not a fact (the run that 'proved' it was contaminated)"
            )
        object.__setattr__(self, "plugins", tuple(self.plugins))


@dataclass(frozen=True)
class DecodeParams:
    max_new_tokens: int = 256
    headroom_factor: float = 1.5
    # decode-time feedback: 'module:attr' → callable(source, candidates) that
    # picks among beam candidates [(text, score), ...] — e.g. the crk FST
    # validity TIE-BREAK (validity-first is forbidden: it launders
    # grammatical-but-wrong beams; measured 2026-07-07). Applied everywhere
    # forge decodes: checkpoint selection, the final dev report, evaluate —
    # so checkpoints are selected under the decoding regime actually deployed.
    hook: str | None = None
    num_beams: int = 4


@dataclass
class RunConfig:
    run_name: str
    dev: str                              # registry name, role=dev — the fence
    workspace: str = ".forge"
    language: dict | None = None          # informational (from `nmt-forge init`)
    regime: str = "auto"                  # schedule preset (schedule-sanity guard)
    gold: list[str] = field(default_factory=list)
    synthetic: list[SynthLane] = field(default_factory=list)
    monolingual: list[str] = field(default_factory=list)
    mix: MixParams = field(default_factory=MixParams)
    model: dict = field(default_factory=lambda: {"backend": "dummy"})
    selection: SelectionParams = field(default_factory=SelectionParams)
    curriculum: list[dict] | None = None
    decode: DecodeParams = field(default_factory=DecodeParams)
    data_rights: dict | None = None       # rights note for the gold lanes
    eval_battery: dict | None = None      # the eval block (nmt-forge score --config)
    raw: dict = field(default_factory=dict, repr=False)

    def hash(self) -> str:
        return config_hash(self.raw)

    @classmethod
    def from_dict(cls, raw: dict) -> RunConfig:
        _check_keys(raw, _TOP_KEYS, "config")
        data = raw.get("data", {})
        _check_keys(data, _DATA_KEYS, "config.data")
        if not raw.get("run_name"):
            raise ConfigError("config.run_name is required")
        if not data.get("dev"):
            raise ConfigError(
                "config.data.dev is required — it names a REGISTERED dev set "
                "(role=dev). Checkpoint selection without a dev set means "
                "selecting on the test set, the exact catalogued mistake #2.\n"
                "  fix: carve one with group_split(dev_size=...) and register "
                "it, then set data.dev to its registry name"
            )
        mix_raw = raw.get("mix", {})
        _check_keys(mix_raw, _MIX_KEYS, "config.mix")
        sel_raw = raw.get("selection", {})
        _check_keys(sel_raw, _SELECTION_KEYS, "config.selection")
        dec_raw = raw.get("decode", {})
        _check_keys(dec_raw, _DECODE_KEYS, "config.decode")
        eval_raw = raw.get("eval")
        if eval_raw is not None:
            _check_keys(eval_raw, _EVAL_KEYS, "config.eval")
            if not eval_raw.get("battery"):
                raise ConfigError(
                    "config.eval.battery is required when the eval block is "
                    "present — it names the REGISTERED test battery"
                )
        lanes = []
        for i, lane in enumerate(data.get("synthetic", [])):
            _check_keys(lane, _LANE_KEYS, f"config.data.synthetic[{i}]")
            lanes.append(SynthLane(**lane))
        model = raw.get("model", {"backend": "dummy"})
        if "backend" not in model:
            raise ConfigError("config.model.backend is required")
        return cls(
            run_name=raw["run_name"],
            dev=data["dev"],
            workspace=raw.get("workspace", ".forge"),
            language=raw.get("language"),
            regime=raw.get("regime", "auto"),
            gold=list(data.get("gold", [])),
            synthetic=lanes,
            monolingual=list(data.get("monolingual", [])),
            mix=MixParams(**mix_raw),
            model=model,
            selection=SelectionParams(**sel_raw),
            curriculum=raw.get("curriculum"),
            decode=DecodeParams(**dec_raw),
            data_rights=data.get("rights"),
            eval_battery=eval_raw,
            raw=raw,
        )

    @classmethod
    def from_file(cls, path: str | Path) -> RunConfig:
        try:
            raw = json.loads(Path(path).read_text(encoding="utf-8"))
        except json.JSONDecodeError as e:
            raise ConfigError(f"{path}: not valid JSON ({e})") from e
        return cls.from_dict(raw)
