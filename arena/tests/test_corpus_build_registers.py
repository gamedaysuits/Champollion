"""Every corpus-build domain has a register, and runs name safe files.

Synthetic researcher persona (2026-10-03): building any fetch-from-source
corpus (Tatoeba, the queue's family, the docs' own example) crashed with
NameError — the domain→register table was left behind when the build
primitives moved into the harness. And a "/" in --run-name lost the run log
after the run had been paid for.
"""

from types import SimpleNamespace

from mt_eval_harness.corpus_build.adapters.base import RawEntry
from mt_eval_harness.corpus_build.domain_classifier import DOMAIN_TO_REGISTER, VALID_DOMAINS
from mt_eval_harness.corpus_build import sampling


def test_every_domain_has_a_register():
    assert VALID_DOMAINS <= set(DOMAIN_TO_REGISTER), VALID_DOMAINS - set(DOMAIN_TO_REGISTER)


def test_enrich_entry_builds_an_entry():
    import inspect
    params = inspect.signature(RawEntry).parameters
    kwargs = {"source_text": "Where is the clinic?", "target_text": "¿Dónde está la clínica?",
              "source_id": "1", "metadata": {"license": "CC-BY-2.0-FR"}}
    raw = RawEntry(**{k: v for k, v in kwargs.items() if k in params})
    entry = sampling._enrich_entry(raw, "tatoeba")
    assert entry.register


def test_run_id_is_a_safe_filename():
    from mt_eval_harness.runner import _build_run_id
    cfg = SimpleNamespace(display_model="google/gemini-3.5-flash", prompt_version="naive",
                          dataset="smol/sent", tools_enabled=False, post_hooks=[], batch_size=1,
                          run_name="yor/baseline: try 2")
    rid = _build_run_id(cfg)
    assert "/" not in rid and ":" not in rid and " " not in rid
