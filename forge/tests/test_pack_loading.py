"""Pack discovery: forge ships no language packs; external packs plug in.

The crk reference pack lives in crk-translate (``nmt_forge_crk``) — founder
ruling 2026-07-12: nmt-forge is general-purpose, language-specific code lives
in the language's own home. These tests pin the two doors external packs use.
"""

import pytest

from nmt_forge.errors import ForgeError
from nmt_forge.synthesis.engine import SynthesisEngine
from nmt_forge.synthesis.packs import load_pack


def test_module_spec_loads_and_synthesizes(tmp_path):
    pack = load_pack("tests.fake_pack:get_pack")
    assert pack.code == "zzt"
    manifest = SynthesisEngine(pack).run(tmp_path / "out.jsonl")
    assert manifest["rows"] == 1


def test_unknown_name_error_names_both_doors():
    with pytest.raises(ForgeError) as e:
        load_pack("nonexistent")
    msg = str(e.value)
    assert "get_pack" in msg and "entry point" in msg


def test_bad_spec_module_is_actionable():
    with pytest.raises(ForgeError, match="PYTHONPATH"):
        load_pack("no.such.module:get_pack")
    with pytest.raises(ForgeError, match="no attribute"):
        load_pack("tests.fake_pack:ghost_factory")


def test_factory_returning_non_pack_refused():
    # a factory that returns something pack-unshaped fails loud, not deep
    # inside the engine later
    with pytest.raises(ForgeError, match="LanguagePack"):
        load_pack("pathlib:Path")
