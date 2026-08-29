"""Tests for the REAL Python card adapter — language_cards.py's envelope helpers.

History (docs/TEST_SUITE_AUDIT_2026-08-19.md, S3): card_reader.py was a second,
DEAD adapter — zero production importers — carrying 21 tests, while the adapter
production actually uses (language_cards.display / attributions / is_disputed,
imported by e.g. arena/scripts/build_corpus_wishlist.py) went untested, and the
two disagreed about what "disputed" means. card_reader.py is deleted; these
tests pin the surviving adapter's semantics directly.

The semantics pinned here are language_cards.py's OWN, not the dead reader's:

  * ``display()`` returns None on genuine disagreement — the project rule is
    "never elect a winner among sources" — with two explicit opt-outs
    (``prefer_source`` and ``on_disagreement='first'``).
  * ``attributions()`` reports a plain value as one claim with ``source: None``
    so callers can treat both shapes uniformly.
  * ``is_disputed()`` is about VALUES: an envelope with a consensus is never
    disputed, and repeated identical claims are agreement, not an argument.

All offline: pure-function tests, no card corpus, no network.
"""

from __future__ import annotations

from mt_eval_harness.language_cards import (
    attributions,
    display,
    is_attributed,
    is_disputed,
)


def _envelope(*claims, agreement="conflicting", consensus=..., **extra):
    """Build an attribution envelope from (value, source) pairs."""
    env = {
        "agreement": agreement,
        "values": [{"value": v, "source": s} for v, s in claims],
        **extra,
    }
    if consensus is not ...:
        env["consensus"] = consensus
    return env


# ---------------------------------------------------------------------------
# is_attributed — envelope detection
# ---------------------------------------------------------------------------

class TestIsAttributed:
    def test_true_for_an_envelope(self):
        assert is_attributed(_envelope(("French", "iso639-3"), agreement="unanimous"))

    def test_false_for_plain_values_and_none(self):
        for v in ("French", 31, False, None, ["a", "b"], {"family": "Algic"}):
            assert not is_attributed(v), v

    def test_false_for_a_dict_missing_the_envelope_markers(self):
        # A dict with values but no agreement string (or vice versa) is data,
        # not an envelope — misreading it would swallow a real field.
        assert not is_attributed({"values": [{"value": "x"}]})
        assert not is_attributed({"agreement": "unanimous"})
        assert not is_attributed({"agreement": 3, "values": []})


# ---------------------------------------------------------------------------
# display — the single displayable value
# ---------------------------------------------------------------------------

class TestDisplayPlainValues:
    def test_passes_a_plain_value_through(self):
        assert display("Latin") == "Latin"
        assert display(31) == 31
        # False is a VALUE: a feature being absent is a fact about a language.
        assert display(False) is False

    def test_none_stays_none(self):
        # The atlas OMITS what no source asserts; None is the normal answer.
        assert display(None) is None


class TestDisplayEnvelopes:
    def test_unanimous_envelope_returns_the_consensus(self):
        # Real corpus shape (fra.json name): unanimous + consensus + values.
        env = _envelope(
            ("French", "iso639-3-20260715"),
            ("French", "linguameta-452a21ad3dae"),
            agreement="unanimous", consensus="French",
        )
        assert display(env) == "French"

    def test_single_claim_envelope_with_consensus(self):
        env = _envelope(("Algic", "glottolog-v5.0"),
                        agreement="single", consensus="Algic")
        assert display(env) == "Algic"

    def test_single_claim_envelope_without_consensus_refuses_by_default(self):
        # No consensus key → display() does not invent one; the caller must
        # opt in to taking the (only) recorded claim.
        env = _envelope(("Testish", "glottolog-v5.0"), agreement="unanimous")
        assert display(env) is None
        assert display(env, on_disagreement="first") == "Testish"

    def test_conflicting_envelope_returns_none(self):
        # The project rule: on genuine disagreement, never elect a winner.
        env = _envelope(
            ("Niger-Congo", "wals"),
            ("Atlantic-Congo", "glottolog"),
        )
        assert display(env) is None

    def test_a_falsy_consensus_still_wins(self):
        # "consensus" in the envelope is the test — a consensus of False/0 is
        # a real agreed value, not an absence.
        env = _envelope(("no", "grambank"), agreement="unanimous", consensus=False)
        assert display(env) is False


class TestDisplayOptOuts:
    ENV = {
        "agreement": "conflicting",
        "values": [
            {"value": "Niger-Congo", "source": "wals-2020"},
            {"value": "Atlantic-Congo", "source": "glottolog-v5.0"},
        ],
    }

    def test_on_disagreement_first_takes_the_first_recorded_claim(self):
        assert display(self.ENV, on_disagreement="first") == "Niger-Congo"

    def test_prefer_source_answers_what_does_this_source_say(self):
        assert display(self.ENV, prefer_source="glottolog") == "Atlantic-Congo"
        assert display(self.ENV, prefer_source="wals") == "Niger-Congo"

    def test_prefer_source_matches_on_prefix(self):
        # Sources carry version suffixes ("glottolog-v5.0"); the caller names
        # the authority, not the pin.
        assert display(self.ENV, prefer_source="glottolog-v5.0") == "Atlantic-Congo"

    def test_prefer_source_miss_falls_through(self):
        # An absent preferred source does not silently elect another one:
        # with no consensus and no 'first' opt-in, the answer stays None.
        assert display(self.ENV, prefer_source="phoible") is None

    def test_prefer_source_miss_with_consensus_returns_the_consensus(self):
        env = dict(self.ENV, agreement="unanimous", consensus="Atlantic-Congo")
        assert display(env, prefer_source="phoible") == "Atlantic-Congo"

    def test_first_on_an_empty_values_list_is_none(self):
        env = {"agreement": "conflicting", "values": []}
        assert display(env, on_disagreement="first") is None


# ---------------------------------------------------------------------------
# attributions — every claim, uniformly
# ---------------------------------------------------------------------------

class TestAttributions:
    def test_none_is_an_empty_list(self):
        assert attributions(None) == []

    def test_plain_value_is_one_unsourced_claim(self):
        # source=None so both shapes read uniformly — a caller never branches
        # on which corpus it was handed.
        assert attributions("Latin") == [{"value": "Latin", "source": None}]
        assert attributions(0) == [{"value": 0, "source": None}]

    def test_envelope_reports_every_claim_with_its_source(self):
        env = _envelope(
            ("moribund", "glottolog-cldf-v5.3"),
            ("threatened", "elcat-v2024.1"),
            agreement="incommensurable",
        )
        got = attributions(env)
        assert len(got) == 2
        # A value without its source cannot be cited.
        assert all(v.get("source") for v in got)
        assert got[0]["value"] == "moribund"

    def test_non_dict_entries_are_dropped_not_crashed_on(self):
        env = {
            "agreement": "unanimous",
            "values": [{"value": "x", "source": "s1"}, "stray-string"],
        }
        assert attributions(env) == [{"value": "x", "source": "s1"}]

    def test_envelope_with_null_values_list_is_empty(self):
        assert attributions({"agreement": "unanimous", "values": None}) == []


# ---------------------------------------------------------------------------
# is_disputed — genuine disagreement only
# ---------------------------------------------------------------------------

class TestIsDisputed:
    def test_plain_values_are_never_disputed(self):
        for v in ("Latin", 31, False, None, ["a"], {"family": "Algic"}):
            assert not is_disputed(v), v

    def test_a_consensus_settles_it(self):
        env = _envelope(("French", "iso"), ("French", "linguameta"),
                        agreement="unanimous", consensus="French")
        assert not is_disputed(env)

    def test_two_distinct_claims_without_consensus_are_a_dispute(self):
        env = _envelope(("Niger-Congo", "wals"), ("Atlantic-Congo", "glottolog"))
        assert is_disputed(env)

    def test_repeated_identical_claims_are_agreement_not_an_argument(self):
        # Two sources saying the same thing (compared as values, order-stable
        # via sorted JSON) is corroboration.
        env = _envelope(("Algic", "wals"), ("Algic", "glottolog"))
        assert not is_disputed(env)

    def test_structured_values_compare_by_content(self):
        # Dict-valued claims (e.g. coordinate blobs) must compare by content,
        # not identity — sort_keys makes key order irrelevant.
        a = {"lat": 1, "lon": 2}
        b = {"lon": 2, "lat": 1}
        env = _envelope((a, "s1"), (b, "s2"))
        assert not is_disputed(env)
        env2 = _envelope((a, "s1"), ({"lat": 9, "lon": 2}, "s2"))
        assert is_disputed(env2)

    def test_single_claim_is_not_a_dispute(self):
        env = _envelope(("Testish", "glottolog"), agreement="single")
        assert not is_disputed(env)
