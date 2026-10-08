"""Import shim for the eval harness (``mt-eval-harness`` on PyPI).

forge implements ZERO metrics (mistake #10 in the requirements ledger: a
bespoke evaluator partially re-implemented scoring and drifted). All scoring
delegates to ``mt_eval_harness``:

- point scores + bootstrap CIs: ``mt_eval_harness.confidence``
- A/B significance:             ``mt_eval_harness.significance``
- language cards (resolver + the ONE adapter): ``mt_eval_harness.language_cards``
- RunLog / TestReport (the bridge to ``mt-eval``): ``mt_eval_harness.pipeline``
  and ``mt_eval_harness.tester``

``mt-eval-harness`` is a declared dependency of nmt-forge, so a normal
``python3 -m pip install nmt-forge`` brings it in. Resolution order:
1. the installed ``mt-eval-harness`` distribution (import ``mt_eval_harness``);
2. ``$MT_EVAL_HARNESS_PATH`` (a checkout containing ``mt_eval_harness/``);
3. monorepo fallback: the sibling ``arena/`` directory (forge lives at
   ``<repo>/forge/``, the harness at ``<repo>/arena/mt_eval_harness/``).

Fails loud with install instructions — never a silent no-scores path.
"""

from __future__ import annotations

import contextlib
import functools
import importlib
import io
import json
import os
import sys
from pathlib import Path


def _candidate_paths() -> list[Path]:
    cands = []
    env = os.environ.get("MT_EVAL_HARNESS_PATH")
    if env:
        cands.append(Path(env))
    # <repo>/forge/nmt_forge/_harness.py → <repo>/arena
    cands.append(Path(__file__).resolve().parents[2] / "arena")
    return cands


def _load_from_checkout(cand: Path):
    """Import ``<cand>/mt_eval_harness`` as the package WITHOUT putting
    ``cand`` on sys.path.

    Adding the whole ``arena/`` directory to sys.path (the pre-2026-10
    fallback) also made every sibling directory importable as a namespace
    package — ``arena/datasets/`` then shadowed Hugging Face ``datasets``,
    transformers believed `datasets` was installed, and every HF training
    run crashed inside the Trainer's dataloader. Loading the one package by
    location avoids that whole class of collision."""
    import importlib.util

    pkg_dir = cand / "mt_eval_harness"
    spec = importlib.util.spec_from_file_location(
        "mt_eval_harness", pkg_dir / "__init__.py",
        submodule_search_locations=[str(pkg_dir)])
    if spec is None or spec.loader is None:
        raise ImportError(f"cannot load mt_eval_harness from {pkg_dir}")
    module = importlib.util.module_from_spec(spec)
    sys.modules["mt_eval_harness"] = module
    try:
        spec.loader.exec_module(module)
    except BaseException:
        sys.modules.pop("mt_eval_harness", None)
        raise
    return module


def load_harness():
    """Import and return the ``mt_eval_harness`` package, or raise ForgeError."""
    try:
        return importlib.import_module("mt_eval_harness")
    except ImportError:
        pass
    for cand in _candidate_paths():
        if (cand / "mt_eval_harness" / "__init__.py").is_file():
            try:
                return _load_from_checkout(cand)
            except ImportError:
                continue
    from .errors import ForgeError

    raise ForgeError(
        "mt-eval-harness is not importable — forge delegates ALL scoring to "
        "it and has no fallback scorer by design.\n"
        "  fix: `python3 -m pip install mt-eval-harness` (it is a declared dependency of "
        "nmt-forge, so `python3 -m pip install nmt-forge` normally brings it in), or "
        "point MT_EVAL_HARNESS_PATH at a checkout containing "
        "mt_eval_harness/, or run from the Champollion monorepo where arena/ "
        "is a sibling of forge/."
    )


def confidence():
    load_harness()
    return importlib.import_module("mt_eval_harness.confidence")


def significance():
    load_harness()
    return importlib.import_module("mt_eval_harness.significance")


def language_cards_mod():
    """The harness's language_cards module (the ONE Python card adapter)."""
    load_harness()
    return importlib.import_module("mt_eval_harness.language_cards")


def corpus_loader_mod():
    """The harness's corpus loader (TSV is read by the harness's own rules)."""
    load_harness()
    return importlib.import_module("mt_eval_harness.corpus_loader")


def language_cards_remote_mod():
    """The harness's remote card source (its LanguageCardsUnavailable is the
    fail-loud signal forge converts into an actionable ResourceMissing)."""
    load_harness()
    return importlib.import_module("mt_eval_harness.language_cards_remote")


def harness_version() -> str:
    """The installed harness version (recorded in exports and run logs)."""
    return getattr(load_harness(), "__version__", "unknown")


def transmission_policy_mod():
    """The harness's transmission policy: which corpora may reach which
    model — and, since 2026-10, which corpus sentences may be PRINTED
    (``withheld_text_reason`` / ``withheld_note`` / ``scrub_corpus_text``).
    forge decides nothing about a corpus's terms itself."""
    load_harness()
    return importlib.import_module("mt_eval_harness.transmission_policy")


def corpus_terms(path) -> dict:
    """What the harness reads about a corpus file's terms and identity,
    WITHOUT scoring anything: ``{"meta", "envelope", "notes"}``.

    ``envelope`` is a harness-JSON corpus's own ``dataset`` block (``{}`` for
    TSV / JSONL / a bare list); ``meta`` is that block merged with the
    steward's ``<file>.champollion.json`` sidecar and the corpora card it
    registers (``corpus_loader.merge_steward_sidecar`` — the same merge an
    ``mt-eval run`` on the file does: ``transmission``, a sealed
    ``segment``, ``license``, ``id``, ``corpus_card``, ``contamination``);
    ``notes`` is what the harness printed while merging (e.g. why a card's
    id was not applied). Raises ValueError for an unreadable sidecar or
    envelope — a steward wrote it to restrict the data, so a typo must not
    unlock it.
    """
    cl = corpus_loader_mod()
    p = Path(path)
    envelope: dict = {}
    if p.suffix.lower() == ".json" and p.is_file():
        try:
            _, envelope = cl._load_harness_json(p, None)
        except SystemExit as exc:   # the loader's own "not valid JSON" exit
            raise ValueError(" ".join(str(exc).split())) from None
        envelope = dict(envelope) if isinstance(envelope, dict) else {}
    buf = io.StringIO()
    with contextlib.redirect_stdout(buf):
        meta = cl.merge_steward_sidecar(p, dict(envelope))
    notes = [" ".join(ln.split()) for ln in buf.getvalue().splitlines()
             if ln.strip()]
    return {"meta": meta, "envelope": envelope, "notes": notes}


def card_not_applied_reason(path) -> str:
    """Why the corpora card a sidecar names was NOT applied to this file
    (moved, unreadable, no id, or the file changed since registration — the
    harness's own words), or ``""`` (no card named, or it applies)."""
    cl = corpus_loader_mod()
    side = cl.read_steward_sidecar(path)
    if not side.get("card"):
        return ""
    buf = io.StringIO()
    with contextlib.redirect_stdout(buf):
        card = cl.registered_card(path, side)
    if card is not None:
        return ""
    text = " ".join(buf.getvalue().split())
    return text.removeprefix("Steward: ").strip() or (
        f"the card {side['card']} named in the sidecar was not applied")


@functools.lru_cache(maxsize=512)
def _registry_entry(dataset_id: str, corpus_path: str, meta_key: str):
    """``publish.registry_entry_for_run`` (id, then the path/basename
    ladder), memoized per process: one lookup reads the 5,600-entry
    registry, and a command may ask about the same file several times."""
    load_harness()
    from mt_eval_harness.publish import registry_entry_for_run

    return registry_entry_for_run(dataset_id, corpus_path=corpus_path,
                                  corpus_meta=json.loads(meta_key))


def corpus_transmission_policy(path, *, dataset_id: str = ""):
    """The harness's TransmissionPolicy for a corpus file, resolved exactly
    as a run on it would be: the file's own terms (``corpus_terms``) and
    its mt-eval registry entry (by ``dataset_id``, then the path ladder).
    Raises ValueError when the file's terms are unreadable."""
    tp = transmission_policy_mod()
    meta = corpus_terms(path)["meta"]
    p = str(Path(path).resolve())
    did, entry = _registry_entry(
        str(dataset_id or ""), p,
        json.dumps(meta, sort_keys=True, ensure_ascii=False, default=str))
    return tp.resolve_transmission_policy(did, registry_entry=entry,
                                          corpus_meta=meta)


def derived_mark(path, *, dataset_id: str = "") -> dict:
    """The terms a file DERIVED from this corpus must carry, as the harness
    decides them (``corpus_loader.derived_mark``, the mark ``mt-eval`` puts
    on the run logs and reports it writes), or ``{}``.

    Read over the policy a run on the file would resolve — the file's own
    terms AND its mt-eval registry entry — so a set the registry seals or
    quarantines, or whose consent-required licence only the registry
    records, is marked too. ``{}`` from a harness that predates the helper
    (forge then carries the file's own terms alone). Raises ValueError when
    the file's terms are unreadable."""
    cl = corpus_loader_mod()
    helper = getattr(cl, "derived_mark", None)
    if helper is None:
        return {}
    policy = corpus_transmission_policy(path, dataset_id=dataset_id)
    meta = corpus_terms(path)["meta"]
    return dict(helper({"config": {"corpus_path": str(path),
                                   "transmission_policy":
                                       policy.as_provenance()},
                        "provenance": {"dataset_meta": meta}}))


def withheld_text_reason(path, *, dataset_id: str = "") -> str:
    """Why forge must not PRINT this corpus file's sentences, or ``""``.

    The harness decides (``transmission_policy.withheld_text_reason``): a
    steward's local-only mark (sidecar or JSON envelope), or a policy that
    refuses remote models (sealed segment, quarantined, consent-required
    license). An unreadable sidecar/envelope counts as a reason."""
    tp = transmission_policy_mod()
    try:
        policy = corpus_transmission_policy(path, dataset_id=dataset_id)
    except ValueError as exc:
        return f"its terms could not be read ({exc})"
    return tp.withheld_text_reason({"config": {
        "corpus_path": str(path),
        "transmission_policy": policy.as_provenance()}})
