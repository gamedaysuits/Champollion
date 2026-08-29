from nmt_forge.canonical import (
    canonical_key,
    config_hash,
    detect_target_field,
    jaccard,
    key_hash,
    stable_hash,
    token_set,
)


def test_canonical_key_merges_case_punct_whitespace():
    assert canonical_key("Feed  him!") == canonical_key("feed him")
    assert canonical_key("Wug, blar.") == canonical_key("wug blar")


def test_canonical_key_composes_pack_canonicalizer():
    canon = lambda t: t.replace("ý", "y")
    assert canonical_key("pimipaýiw", canon) == canonical_key("pimipayiw")
    # without the canonicalizer they differ — the ý-bug surface
    assert canonical_key("pimipaýiw") != canonical_key("pimipayiw")


def test_canonical_key_nfc_normalizes():
    composed = "w\u00e2pam"            # a-circumflex as one codepoint
    decomposed = "wa\u0302pam"         # a + combining circumflex
    assert composed != decomposed      # different byte sequences going in
    assert canonical_key(composed) == canonical_key(decomposed)


def test_stable_hash_deterministic():
    assert stable_hash("nipâw") == stable_hash("nipâw")
    assert stable_hash("nipâw") != stable_hash("nipâwx")


def test_jaccard_edges():
    a = token_set("the big wug")
    assert jaccard(a, a) == 1.0
    assert jaccard(a, frozenset()) == 0.0
    assert jaccard(frozenset(), frozenset()) == 1.0


def test_key_hash_is_content_free_reference():
    h = key_hash(canonical_key("secret sentence"))
    assert "secret" not in h and len(h) == 16


def test_detect_target_field():
    assert detect_target_field([{"source": "a", "target": "b"}]) == "target"
    assert detect_target_field([{"source": "a", "reference": "b"}]) == "reference"
    try:
        detect_target_field([{"source": "a", "target": "b"}, {"source": "c"}])
    except KeyError as e:
        assert "target_field" in str(e)
    else:
        raise AssertionError("mixed fields must fail loud")


def test_config_hash_order_independent():
    assert config_hash({"a": 1, "b": 2}) == config_hash({"b": 2, "a": 1})
    assert config_hash({"a": 1}) != config_hash({"a": 2})
