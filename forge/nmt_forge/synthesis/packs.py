"""Language packs — the synthesis plugin interface.

A pack bundles everything forge needs to manufacture verified training data
for one language: the analyzer adapter, the orthography canonicalizer +
convention specs, the dictionary adapter, the cited templates, the cited
grammar checklist, and the cited closed-class word list.

License boundaries (non-negotiable, from CLAUDE.md):
- packs never BUNDLE analyzer models or dictionary content. Adapters load
  user-fetched resources from configured paths and raise
  :class:`~nmt_forge.errors.ResourceMissing` with fetch instructions;
- emitted rows carry ``champollion-derived`` provenance naming their inputs
  — a derived value never wears an upstream's name.

Discovery — forge itself ships NO language packs (it is a general-purpose
tool; language-specific code lives in the language's own home, e.g. the
Plains Cree pack in crk-translate's ``nmt_forge_crk``):

1. ``"package.module:get_pack"`` specs — work from any checkout on
   PYTHONPATH, no install needed;
2. the ``nmt_forge.packs`` entry-point group — installed packages register
   short names (manifest-driven, loud on failure — the harness's plugin
   discipline).
"""

from __future__ import annotations

from collections.abc import Iterable, Mapping
from dataclasses import dataclass, field
from importlib import import_module, metadata

from ..errors import ForgeError
from ..guards.convention_lint import ConventionSpec
from ..guards.coverage_map import ChecklistItem
from .analyzer import Analyzer
from .templates import Template

# forge ships no language packs; the mechanism stays for a future built-in
_BUILTIN_PACKS: dict[str, str] = {}


@dataclass(frozen=True)
class LexEntry:
    """One dictionary item as synthesis sees it (already canonicalized —
    canonicalize AT THE ADAPTER BOUNDARY is the ý-bug fix, guard #4)."""

    lemma: str
    pos: str          # pack-defined class, e.g. VAI / VTA / NA / NI
    gloss: str
    meta: dict = field(default_factory=dict)


class LanguagePack:
    """Base class for packs. Override what the language needs; the defaults
    are honest no-ops, not silent magic."""

    code: str = ""        # ISO 639-3
    name: str = ""
    version: str = "0"

    # -- resources (may raise ResourceMissing with fetch instructions) -------
    def analyzer(self) -> Analyzer:
        raise NotImplementedError

    def dictionary(self) -> Iterable[LexEntry]:
        raise NotImplementedError

    # -- orthography ----------------------------------------------------------
    def canonicalize(self, text: str) -> str:
        return text

    def conventions(self) -> list[ConventionSpec]:
        return []

    # -- grammar-cited inventories ---------------------------------------------
    def templates(self) -> list[Template]:
        raise NotImplementedError

    def checklist(self) -> list[ChecklistItem]:
        raise NotImplementedError

    def closed_class(self) -> Mapping[str, str]:
        """Literal → citation, for Lit pieces the analyzer may not know."""
        return {}

    # -- engine plumbing ---------------------------------------------------------
    def context(self, *, seed: int = 42):
        """The object handed to every template's realize function. The pack
        decides its shape (pools, probe results, EN helpers…). Determinism
        rule: derive any rotation/assignment from ``seed`` or
        :func:`nmt_forge.canonical.stable_hash` — never builtin ``hash()``,
        which is per-process salted and produced irreproducible corpora in
        the reference implementation."""
        raise NotImplementedError

    def provenance(self) -> str:
        """The provenance string stamped on every emitted row."""
        return (
            f"champollion-derived [{self.name or self.code} pack "
            f"v{self.version}: analyzer × dictionary; local training only]"
        )


def _validate_pack(pack, origin: str) -> LanguagePack:
    for member in ("code", "templates", "analyzer", "checklist", "context"):
        if not hasattr(pack, member):
            raise ForgeError(
                f"{origin} did not return a LanguagePack (missing {member!r}); "
                "packs subclass nmt_forge.synthesis.packs.LanguagePack"
            )
    return pack


def load_pack(name_or_spec: str, **pack_kwargs) -> LanguagePack:
    """Load a pack by ``"module.path:get_pack"`` spec, built-in name, or
    entry-point name; loud on every failure mode."""
    if ":" in name_or_spec:
        module_name, _, attr = name_or_spec.partition(":")
        try:
            mod = import_module(module_name)
        except ImportError as e:
            raise ForgeError(
                f"cannot import pack module {module_name!r}: {e}\n"
                "  fix: install the pack's package, or add its checkout to "
                "PYTHONPATH (e.g. the crk pack lives in crk-translate as "
                "nmt_forge_crk)"
            ) from e
        factory = getattr(mod, attr, None)
        if factory is None:
            raise ForgeError(f"module {module_name!r} has no attribute {attr!r}")
        return _validate_pack(factory(**pack_kwargs), name_or_spec)
    if name_or_spec in _BUILTIN_PACKS:
        mod = import_module(_BUILTIN_PACKS[name_or_spec])
        return _validate_pack(mod.get_pack(**pack_kwargs), name_or_spec)
    eps = metadata.entry_points(group="nmt_forge.packs")
    for ep in eps:
        if ep.name == name_or_spec:
            get_pack = ep.load()
            return _validate_pack(get_pack(**pack_kwargs), name_or_spec)
    known = sorted(set(_BUILTIN_PACKS) | {ep.name for ep in eps})
    raise ForgeError(
        f"no language pack named {name_or_spec!r}; available: "
        f"{known or '(none — forge ships no packs)'}.\n"
        "  fix: pass a 'package.module:get_pack' spec (works uninstalled via "
        "PYTHONPATH), or install a package registering the 'nmt_forge.packs' "
        "entry point (e.g. crk-translate registers 'crk')"
    )
