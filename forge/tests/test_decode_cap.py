"""The decode cap: fixed, or proportional to each input (decode.length_ratio), and the headroom guard for both."""
import pytest

from nmt_forge.errors import GenerationHeadroomError
from nmt_forge.training.config import DecodeParams
from nmt_forge.training.decode_cap import cap_params, dynamic_cap
from nmt_forge.training.selection import check_generation_headroom


def test_dynamic_cap_is_proportional_and_bounded():
    assert dynamic_cap(256, None, 32, 500) == 256                 # no ratio: the fixed cap
    assert dynamic_cap(900, 2.0, 32, 10) == 52                    # ceil(2 x 10 + 32)
    assert dynamic_cap(900, 2.0, 32, 400) == 832
    assert dynamic_cap(900, 2.0, 32, 1000) == 900                 # never above max_new_tokens
    assert dynamic_cap(900, 0.5, 0, 1) == 1                       # at least one token


def test_cap_params_from_config_and_from_an_export_manifest():
    assert cap_params(DecodeParams()) == {"max_new_tokens": 256}
    assert cap_params(DecodeParams(max_new_tokens=900, length_ratio=2.5, length_margin=40)) == \
        {"max_new_tokens": 900, "length_ratio": 2.5, "length_margin": 40}
    assert cap_params({"max_new_tokens": 300}) == {"max_new_tokens": 300}
    assert cap_params({"max_new_tokens": 300, "length_ratio": 3}) == \
        {"max_new_tokens": 300, "length_ratio": 3.0, "length_margin": 32}


def test_headroom_fixed_cap_unchanged():
    ln = len
    assert check_generation_headroom(["abcd"], 6, ln)["required_min"] == 6
    with pytest.raises(GenerationHeadroomError):
        check_generation_headroom(["abcdefgh"], 6, ln)


def test_headroom_proportional_checks_every_pair():
    ln = len
    # a short input with a long reference: 2 x 2 + 4 = 8 < 1.5 x 10 → refused, naming the ratio needed
    with pytest.raises(GenerationHeadroomError) as e:
        check_generation_headroom(["x" * 10, "y" * 4], 100, ln, sources=["ab", "abcd"], length_ratio=2.0,
                                  length_margin=4)
    assert "length_ratio" in e.value.fix
    ok = check_generation_headroom(["x" * 10, "y" * 4], 100, ln, sources=["ab", "abcd"], length_ratio=6.0,
                                   length_margin=4)
    assert ok["mode"] == "proportional" and ok["pairs_checked"] == 2
    # the ceiling still binds: a generous ratio under too small a max_new_tokens is refused
    with pytest.raises(GenerationHeadroomError):
        check_generation_headroom(["x" * 10], 12, ln, sources=["ab"], length_ratio=10.0, length_margin=0)


def test_headroom_proportional_needs_sources():
    from nmt_forge.errors import ScoringError
    with pytest.raises(ScoringError):
        check_generation_headroom(["abc"], 100, len, length_ratio=2.0)
