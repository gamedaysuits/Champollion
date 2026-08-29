"""Harness-protocol metric plugins (LYSS lanes) as first-class forge lanes.

The eval harness defines the MetricPlugin protocol (``name``,
``compute(entry) -> dict``, ``aggregate(entry_results) -> dict``) and the
LYSS eval-standard packages (e.g. ``champollion-lyss`` for Plains Cree)
implement it — deterministic per-language referees: equivalence linting,
FST-based semantic verdicts, LYSS-normalized chrF.

forge speaks the same protocol, so a LYSS lane plugs into:
- :func:`nmt_forge.guards.ci_scoring.score` — every numeric aggregate the
  plugin reports gets a bootstrap CI, like any other metric;
- :func:`nmt_forge.guards.ci_scoring.compare` — paired significance over
  plugin lanes;
- checkpoint selection — ``selection.metric: "generation:crk_linter:
  equivalent_match_rate"`` selects on the LYSS verdict instead of chrF++.

Honesty is preserved end to end: a plugin whose aggregate says
``available: False`` is REPORTED unavailable — forge never fabricates a
number for it (the LYSS fail-honest contract).
"""

from __future__ import annotations

import importlib

from .errors import ConfigError, ForgeError


def load_plugin(spec: str):
    """Instantiate a metric plugin from a ``"module.path:ClassName"`` spec.

    The same addressing style the harness uses for method metric plugins.
    Loud on every failure mode — a mistyped plugin must never silently
    drop a scoring lane.
    """
    module_name, _, attr = str(spec).partition(":")
    if not module_name or not attr:
        raise ConfigError(
            f"plugin spec {spec!r} must look like 'package.module:ClassName' "
            "(e.g. 'champollion_lyss.crk.metrics:CrkLinterMetric')"
        )
    try:
        mod = importlib.import_module(module_name)
    except ImportError as e:
        raise ForgeError(
            f"cannot import plugin module {module_name!r}: {e}\n"
            "  fix: install the eval-standard package (e.g. `pip install "
            "champollion-lyss`) or add its checkout to PYTHONPATH"
        ) from e
    obj = getattr(mod, attr, None)
    if obj is None:
        raise ForgeError(f"module {module_name!r} has no attribute {attr!r}")
    plugin = obj() if isinstance(obj, type) else obj
    for member in ("name", "compute", "aggregate"):
        if not hasattr(plugin, member):
            raise ForgeError(
                f"{spec!r} is not MetricPlugin-shaped: missing {member!r} "
                "(the protocol is name / compute(entry)->dict / "
                "aggregate(results)->dict — see mt_eval_harness.plugins.metrics)"
            )
    return plugin


def load_plugins(specs) -> list:
    return [load_plugin(s) for s in specs or ()]


def discover_plugins_for_language(
    target_lang: str, *, source_lang: str = "", skip_fst: bool = False,
) -> list:
    """The harness's OWN plugin discovery, as forge lanes.

    Delegates to ``mt_eval_harness.plugin_discovery.discover_metric_plugins``
    — the exact loader the harness uses at benchmark time — so forge speaks
    the same referee stack: the generic GiellaLT FST word-validity metric
    (any language with an FST), the language card's declared evalMetrics
    (the LYSS lane, fetched from external packages), and the always-on
    behavioral linters (code-switching, hallucination, terminology, writing
    style). Everything returned is MetricPlugin-shaped and drops straight
    into ``plugins=`` on score/compare/selection.

    ``skip_fst=True`` skips the harness's FST quality gate (which may prompt
    to install a missing FST — skip it in non-interactive runs).
    """
    from . import _harness

    _harness.load_harness()
    from mt_eval_harness.plugin_discovery import discover_metric_plugins

    config = {"target_lang": target_lang}
    if source_lang:
        config["source_lang"] = source_lang
    return discover_metric_plugins(config, skip_fst=skip_fst)


class PluginLane:
    """One plugin bound to a set of entries, bootstrap-ready.

    ``compute()`` runs ONCE per entry (results cached by entry object
    identity); the corpus-level metric functions handed to the harness's
    bootstrap/AR machinery only re-run the cheap ``aggregate`` over cached
    per-entry results — 1,000 resamples never re-run an FST.
    """

    # aggregate keys that are bookkeeping, not scores
    _NON_SCORE_SUFFIXES = ("_count",)

    def __init__(self, plugin, entries: list[dict]):
        self.plugin = plugin
        self.name = plugin.name
        self._per = {id(e): plugin.compute(e) for e in entries}
        self.aggregate = plugin.aggregate(list(self._per.values()))

    @property
    def available(self) -> bool:
        return self.aggregate.get("available") is not False

    def score_keys(self) -> list[str]:
        if not self.available:
            return []
        return [
            k for k, v in self.aggregate.items()
            if isinstance(v, (int, float)) and not isinstance(v, bool)
            and not any(k.endswith(s) for s in self._NON_SCORE_SUFFIXES)
        ]

    def extend(self, entries: list[dict]) -> None:
        """Cache more entries (system B of a comparison)."""
        for e in entries:
            if id(e) not in self._per:
                self._per[id(e)] = self.plugin.compute(e)

    def aggregate_for(self, entries: list[dict]) -> dict:
        """Aggregate over a specific (cached) entry subset."""
        return self.plugin.aggregate([self._per[id(e)] for e in entries])

    def metric_fn(self, key: str):
        per = self._per
        plugin = self.plugin

        def fn(sub_entries: list[dict]) -> float:
            agg = plugin.aggregate([per[id(e)] for e in sub_entries])
            v = agg.get(key)
            return float(v) if isinstance(v, (int, float)) and not isinstance(v, bool) else 0.0

        fn.__name__ = f"{plugin.name}:{key}"
        return fn

    def metric_fns(self) -> dict:
        return {f"{self.name}:{k}": self.metric_fn(k) for k in self.score_keys()}
