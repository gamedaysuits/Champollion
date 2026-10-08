"""Tests for mt_eval_harness.contest_prize_terms — the prize DISPOSITION.

Founder ruling R1-trinary (2026-09-07): "I think it should be kinda trinary:
'pass to holders' / 'retain IP' / 'release open' options."

What these tests hold to:

* the vocabularies here, in migration 074's SQL, and on the public prize page
  are the SAME vocabularies (three-way parity — the page test reads its values
  out of this module, so a hand-edited page that drifts fails);
* the participant-facing term is ONE of three, and the four dimensions are
  DERIVED from it: `rights` and `host_use` are refused as explicit keys, and
  the only overrides are the narrow ones each option offers;
* nothing is defaulted, inferred or repaired: a missing disposition, an
  unknown key, the retired switches and an override the option does not offer
  are refusals that name the offending values;
* the hash is stable across spellings of the same term (declared or derived)
  and changes when the option or any override changes — it is what a
  participant accepts;
* ``describe`` leads with the option in plain language and is generated from
  the values, and ``prize_gate`` is derived from them (never configured).
"""

from __future__ import annotations

import json
import re
from pathlib import Path

import pytest

from mt_eval_harness import contest_policy, contest_prize_terms as cpt
from mt_eval_harness.contest_prize_terms import (
    PrizeTermsError,
    declared_prize_terms,
    describe,
    from_preset,
    money_declared_without_terms,
    normalize_prize_terms,
    parse_prize_terms,
    prize_gate,
    terms_sha256,
)

PRIZE_PAGE = (Path(__file__).resolve().parents[2] / "cli" / "website" / "docs"
              / "network" / "specifications" / "prize-spec.md")
PUBLIC_DOCS = (Path(__file__).resolve().parents[2] / "cli" / "website" / "docs")


def _terms(disposition, **overrides):
    return dict(disposition=disposition, **overrides)


# ---------------------------------------------------------------------------
# Vocabulary
# ---------------------------------------------------------------------------

class TestVocabulary:
    def test_the_options_are_the_founder_s_three(self):
        assert cpt.DISPOSITIONS == (
            "pass_to_holders", "retain_ip", "release_open")

    def test_every_option_has_a_plain_language_headline(self):
        for name in cpt.DISPOSITIONS:
            headline = cpt.DISPOSITION_HEADLINES[name]
            assert headline and headline == headline.strip()
            assert "{" not in headline

    def test_dimensions_lead_with_the_disposition(self):
        assert cpt.DIMENSIONS[0] == "disposition"
        assert cpt.DIMENSIONS == (
            "disposition", "retention", "rights", "host_use", "release",
            "release_license", "community_terms_url")

    def test_declared_keys_exclude_the_derived_ones(self):
        assert set(cpt.DERIVED_ONLY_KEYS) == {"rights", "host_use"}
        assert not set(cpt.DECLARED_KEYS) & set(cpt.DERIVED_ONLY_KEYS)
        assert cpt.DECLARED_KEYS[0] == "disposition"

    def test_every_derivation_fills_all_four_dimensions(self):
        for name in cpt.DISPOSITIONS:
            derived = cpt.DISPOSITION_DERIVED[name]
            for dimension, vocabulary in cpt.ENUM_DIMENSIONS.items():
                assert derived[dimension] in vocabulary, (name, dimension)

    def test_every_override_is_inside_its_dimension_vocabulary(self):
        for name, table in cpt.DISPOSITION_OVERRIDES.items():
            for key, vocabulary in table.items():
                if vocabulary is None:
                    assert key == "release_license"
                    continue
                assert set(vocabulary) <= set(cpt.ENUM_DIMENSIONS[key]), name

    def test_contest_policy_is_the_constants_ssot(self):
        assert cpt.DISPOSITIONS is contest_policy.PRIZE_DISPOSITIONS
        assert cpt.DIMENSIONS is contest_policy.PRIZE_DIMENSIONS
        assert cpt.ENUM_DIMENSIONS is contest_policy.PRIZE_ENUM_DIMENSIONS
        assert cpt.GATE_STEPS is contest_policy.PRIZE_GATE_STEPS

    def test_contest_policy_still_imports_nothing(self):
        source = Path(contest_policy.__file__).read_text(encoding="utf-8")
        imports = [l for l in source.splitlines()
                   if l.startswith("import ") or l.startswith("from ")]
        assert imports == ["from __future__ import annotations"]

    def test_every_enum_value_has_a_plain_language_meaning(self):
        for name, vocabulary in cpt.ENUM_DIMENSIONS.items():
            assert set(cpt.VALUE_MEANINGS[name]) == set(vocabulary), name
            for value in vocabulary:
                assert cpt.VALUE_MEANINGS[name][value]
        assert set(cpt.VALUE_MEANINGS["disposition"]) == set(cpt.DISPOSITIONS)

    def test_prize_terms_is_a_frozen_promise_key(self):
        assert "prize_terms" in contest_policy.FROZEN_PROMISE_KEYS


# ---------------------------------------------------------------------------
# The three options
# ---------------------------------------------------------------------------

class TestDispositions:
    def test_pass_to_holders_is_hand_it_over_and_they_keep_it(self):
        assert parse_prize_terms(_terms("pass_to_holders")) == {
            "disposition": "pass_to_holders",
            "retention": "retain",
            "rights": "assignment_to_host",
            "host_use": "any",
            "release": "not_required",
        }

    def test_retain_ip_moves_nothing_and_keeps_a_sealed_copy(self):
        assert parse_prize_terms(_terms("retain_ip")) == {
            "disposition": "retain_ip",
            "retention": "retain_sealed_audit",
            "rights": "participant_retains_all",
            "host_use": "evaluation_only",
            "release": "not_required",
        }

    def test_release_open_keeps_ownership_and_requires_publication(self):
        assert parse_prize_terms(_terms("release_open")) == {
            "disposition": "release_open",
            "retention": "retain",
            "rights": "participant_retains_all",
            "host_use": "any",
            "release": "required_before_prize",
            "release_license": "any_osi",
        }

    def test_a_missing_disposition_lists_the_three_options(self):
        with pytest.raises(PrizeTermsError) as ei:
            parse_prize_terms({})
        for name, headline in cpt.DISPOSITION_HEADLINES.items():
            assert name in str(ei.value)
            assert headline in str(ei.value)

    def test_a_value_outside_the_three_is_refused(self):
        with pytest.raises(PrizeTermsError) as ei:
            parse_prize_terms(_terms("generous"))
        assert "generous" in str(ei.value)
        assert "pass_to_holders | retain_ip | release_open" in str(ei.value)

    def test_not_an_object_is_refused(self):
        for bad in (None, [], "pass_to_holders", 3):
            with pytest.raises(PrizeTermsError, match="disposition"):
                parse_prize_terms(bad)


# ---------------------------------------------------------------------------
# Derived detail, and what may override it
# ---------------------------------------------------------------------------

class TestDerivedDetail:
    @pytest.mark.parametrize("key", ["rights", "host_use"])
    def test_a_derived_key_is_refused_at_the_declaration_door(self, key):
        derived = cpt.DISPOSITION_DERIVED["retain_ip"][key]
        with pytest.raises(PrizeTermsError) as ei:
            parse_prize_terms(_terms("retain_ip", **{key: derived}))
        assert "DERIVED" in str(ei.value)
        assert key in str(ei.value)

    def test_a_derived_key_that_agrees_reads_back_fine(self):
        derived = parse_prize_terms(_terms("pass_to_holders"))
        assert normalize_prize_terms(derived) == derived

    def test_a_derived_key_that_disagrees_is_refused_even_on_read_back(self):
        broken = dict(parse_prize_terms(_terms("retain_ip")),
                      rights="assignment_to_host")
        with pytest.raises(PrizeTermsError) as ei:
            normalize_prize_terms(broken)
        assert "contradicts" in str(ei.value)
        assert "assignment_to_host" in str(ei.value)

    def test_retain_ip_may_narrow_what_the_host_keeps(self):
        t = parse_prize_terms(_terms("retain_ip",
                                     retention="delete_after_scoring"))
        assert t["retention"] == "delete_after_scoring"
        assert t["host_use"] == "evaluation_only"

    def test_release_open_may_move_the_release_and_name_a_licence(self):
        t = parse_prize_terms(_terms("release_open",
                                     release="required_before_scores",
                                     release_license="Apache-2.0"))
        assert t["release"] == "required_before_scores"
        assert t["release_license"] == "Apache-2.0"

    @pytest.mark.parametrize("disposition,key,value", [
        ("pass_to_holders", "retention", "delete_after_scoring"),
        ("pass_to_holders", "release", "required_before_prize"),
        ("retain_ip", "release", "required_before_prize"),
        ("release_open", "retention", "delete_after_scoring"),
    ])
    def test_an_override_the_option_does_not_offer_is_refused(
            self, disposition, key, value):
        with pytest.raises(PrizeTermsError) as ei:
            parse_prize_terms(_terms(disposition, **{key: value}))
        assert disposition in str(ei.value)
        assert key in str(ei.value)

    def test_an_override_outside_its_own_vocabulary_is_refused(self):
        with pytest.raises(PrizeTermsError) as ei:
            parse_prize_terms(_terms("retain_ip", retention="retain"))
        assert "retain_sealed_audit | delete_after_scoring" in str(ei.value)

    def test_an_unknown_key_names_the_option_and_its_overrides(self):
        with pytest.raises(PrizeTermsError) as ei:
            parse_prize_terms(_terms("retain_ip", keep_forever=True))
        assert "keep_forever" in str(ei.value)
        assert "retention" in str(ei.value)

    def test_the_retired_switch_names_its_replacement(self):
        with pytest.raises(PrizeTermsError) as ei:
            parse_prize_terms({"release_required_before_scores": True})
        assert "RETIRED" in str(ei.value)
        assert "release_open" in str(ei.value)

    def test_the_retired_preset_key_names_its_replacement(self):
        with pytest.raises(PrizeTermsError) as ei:
            parse_prize_terms({"preset": "audit"})
        assert "RETIRED" in str(ei.value)
        assert "disposition" in str(ei.value)

    def test_from_preset_is_retired_and_says_what_to_do(self):
        with pytest.raises(PrizeTermsError) as ei:
            from_preset("audit")
        assert "RETIRED" in str(ei.value)
        assert "disposition" in str(ei.value)
        for name in cpt.DISPOSITIONS:
            assert name in str(ei.value)

    def test_money_does_not_live_in_the_terms(self):
        for key in contest_policy.PRIZE_MONEY_KEYS:
            with pytest.raises(PrizeTermsError, match="MONEY"):
                parse_prize_terms(_terms("pass_to_holders",
                                         **{key: "CAD 5000"}))


# ---------------------------------------------------------------------------
# The stored spelling
# ---------------------------------------------------------------------------

class TestDeclaredForm:
    def test_only_the_chosen_option_and_its_overrides_are_stored(self):
        assert declared_prize_terms(_terms("pass_to_holders")) == {
            "disposition": "pass_to_holders"}
        assert declared_prize_terms(_terms("retain_ip")) == {
            "disposition": "retain_ip", "retention": "retain_sealed_audit"}
        assert declared_prize_terms(_terms("release_open")) == {
            "disposition": "release_open",
            "release": "required_before_prize",
            "release_license": "any_osi"}

    def test_it_never_stores_a_derived_key(self):
        for name in cpt.DISPOSITIONS:
            stored = declared_prize_terms(_terms(name))
            assert not set(stored) & set(cpt.DERIVED_ONLY_KEYS)
            assert set(stored) <= set(cpt.DECLARED_KEYS)

    def test_it_round_trips_a_derived_dict_back_to_the_stored_shape(self):
        derived = parse_prize_terms(_terms("release_open"))
        assert declared_prize_terms(derived) == declared_prize_terms(
            _terms("release_open"))

    def test_the_host_s_own_terms_url_survives_on_every_option(self):
        url = "https://example.org/terms"
        for name in cpt.DISPOSITIONS:
            assert declared_prize_terms(
                _terms(name, community_terms_url=url))["community_terms_url"] == url


# ---------------------------------------------------------------------------
# release_license / community_terms_url shapes
# ---------------------------------------------------------------------------

class TestReleaseLicense:
    def test_release_open_defaults_to_any_osi(self):
        assert parse_prize_terms(
            _terms("release_open"))["release_license"] == cpt.RELEASE_LICENSE_ANY

    @pytest.mark.parametrize("licence", ["MIT", "Apache-2.0",
                                         "AGPL-3.0-or-later", "any_osi"])
    def test_spdx_shapes_and_the_wildcard_are_accepted(self, licence):
        t = parse_prize_terms(_terms("release_open", release_license=licence))
        assert t["release_license"] == licence

    @pytest.mark.parametrize("licence", ["", "  ", "not a licence", "GPL/2",
                                         True, 3])
    def test_a_bad_licence_is_refused(self, licence):
        with pytest.raises(PrizeTermsError, match="release_license"):
            parse_prize_terms(_terms("release_open", release_license=licence))

    @pytest.mark.parametrize("disposition", ["pass_to_holders", "retain_ip"])
    def test_a_licence_without_a_release_is_a_term_about_nothing(
            self, disposition):
        with pytest.raises(PrizeTermsError) as ei:
            parse_prize_terms(_terms(disposition, release_license="MIT"))
        assert "release_license" in str(ei.value)
        assert disposition in str(ei.value)

    def test_no_other_option_carries_a_licence_at_all(self):
        for name in ("pass_to_holders", "retain_ip"):
            assert "release_license" not in parse_prize_terms(_terms(name))


class TestCommunityTermsUrl:
    def test_https_is_accepted(self):
        t = parse_prize_terms(
            _terms("retain_ip", community_terms_url="https://example.org/t"))
        assert t["community_terms_url"] == "https://example.org/t"

    @pytest.mark.parametrize("url", [
        "http://example.org/t", "example.org/t", "", " ",
        "https://user:pw@example.org/t", 5, None])
    def test_anything_else_is_refused(self, url):
        with pytest.raises(PrizeTermsError, match="community_terms_url"):
            parse_prize_terms(_terms("retain_ip", community_terms_url=url))


# ---------------------------------------------------------------------------
# The hash
# ---------------------------------------------------------------------------

class TestHash:
    def test_it_is_a_64_hex_digest(self):
        assert re.fullmatch(r"[0-9a-f]{64}",
                            terms_sha256(_terms("retain_ip")))

    def test_key_order_does_not_change_the_hash(self):
        a = {"disposition": "release_open", "release_license": "MIT",
             "release": "required_after_prize"}
        b = {"release": "required_after_prize", "release_license": "MIT",
             "disposition": "release_open"}
        assert terms_sha256(a) == terms_sha256(b)

    def test_the_declared_and_the_derived_spelling_hash_the_same(self):
        for name in cpt.DISPOSITIONS:
            declared = declared_prize_terms(_terms(name))
            derived = parse_prize_terms(_terms(name))
            assert terms_sha256(_terms(name)) == terms_sha256(declared)
            assert terms_sha256(declared) == terms_sha256(derived)

    def test_every_option_hashes_differently(self):
        digests = {name: terms_sha256(_terms(name))
                   for name in cpt.DISPOSITIONS}
        assert len(set(digests.values())) == len(digests)

    def test_changing_any_override_changes_the_hash(self):
        base = terms_sha256(_terms("release_open"))
        assert terms_sha256(
            _terms("release_open", release_license="MIT")) != base
        assert terms_sha256(
            _terms("release_open", release="required_before_scores")) != base
        assert terms_sha256(_terms(
            "release_open", community_terms_url="https://x.org/t")) != base
        assert terms_sha256(_terms("retain_ip")) != terms_sha256(
            _terms("retain_ip", retention="delete_after_scoring"))

    def test_the_hash_is_stable_across_runs_and_processes(self):
        assert terms_sha256(_terms("retain_ip")) == (
            "195b48f2f865780f221c0021b8c0c27c"
            "a87b4904fddf19316d62c2a26e2f64a2")

    def test_unreadable_terms_cannot_be_hashed(self):
        with pytest.raises(PrizeTermsError):
            terms_sha256({"disposition": "whatever"})


# ---------------------------------------------------------------------------
# describe
# ---------------------------------------------------------------------------

class TestDescribe:
    @pytest.mark.parametrize("name", ["pass_to_holders", "retain_ip",
                                      "release_open"])
    def test_it_leads_with_the_option_in_plain_language(self, name):
        text = describe(_terms(name))
        assert "THE TERM:" in text
        assert cpt.DISPOSITION_HEADLINES[name] in text
        assert text.index("THE TERM:") < text.index("In detail")

    @pytest.mark.parametrize("name", ["pass_to_holders", "retain_ip",
                                      "release_open"])
    def test_no_placeholders_and_no_unrendered_values(self, name):
        text = describe(_terms(name))
        assert "{" not in text and "_" not in text.replace(
            "pass_to_holders", "").replace("retain_ip", "").replace(
            "release_open", "").replace("any_osi", "")

    @pytest.mark.parametrize("name", ["pass_to_holders", "retain_ip",
                                      "release_open"])
    def test_it_states_the_execution_mode_is_not_a_choice(self, name):
        assert "is not a choice" in describe(_terms(name))

    def test_each_derived_value_contributes_its_own_sentence(self):
        text = describe(_terms("pass_to_holders"))
        for dimension in ("retention", "rights", "host_use"):
            value = cpt.DISPOSITION_DERIVED["pass_to_holders"][dimension]
            assert cpt.VALUE_MEANINGS[dimension][value] in text

    def test_two_different_options_read_differently(self):
        assert describe(_terms("retain_ip")) != describe(
            _terms("pass_to_holders"))

    def test_a_required_release_names_the_licence(self):
        assert "under Apache-2.0" in describe(
            _terms("release_open", release_license="Apache-2.0"))
        assert "any OSI-approved licence" in describe(_terms("release_open"))

    def test_an_after_prize_release_says_it_is_not_a_payout_check(self):
        text = describe(_terms("release_open", release="required_after_prize"))
        assert "AFTER payout" in text

    def test_an_assignment_says_the_platform_never_verifies_law(self):
        assert "never verifies law" in describe(_terms("pass_to_holders"))
        assert "never verifies law" not in describe(_terms("retain_ip"))

    def test_the_host_s_own_terms_are_linked_when_declared(self):
        url = "https://example.org/community-terms"
        assert url in describe(_terms("retain_ip", community_terms_url=url))

    def test_it_lists_the_verifications_it_will_make(self):
        assert "Before a prize is paid this platform verifies" in describe(
            _terms("retain_ip"))


# ---------------------------------------------------------------------------
# prize_gate
# ---------------------------------------------------------------------------

class TestPrizeGate:
    def test_handover_is_always_required(self):
        for name in cpt.DISPOSITIONS:
            assert prize_gate(_terms(name))[0] == "handover_verified"

    def test_retain_ip_requires_nothing_else(self):
        assert prize_gate(_terms("retain_ip")) == ["handover_verified"]
        assert prize_gate(_terms("retain_ip",
                                 retention="delete_after_scoring")) == [
            "handover_verified"]

    def test_pass_to_holders_records_the_assignment(self):
        assert prize_gate(_terms("pass_to_holders")) == [
            "handover_verified", "assignment_recorded"]

    def test_release_open_checks_the_release_only_when_it_falls_due_first(self):
        for timing in ("required_before_scores", "required_before_prize"):
            assert "release_verified" in prize_gate(
                _terms("release_open", release=timing))
        assert "release_verified" not in prize_gate(
            _terms("release_open", release="required_after_prize"))

    def test_the_order_is_always_the_declared_step_order(self):
        for name in cpt.DISPOSITIONS:
            steps = prize_gate(_terms(name))
            assert steps == [s for s in cpt.GATE_STEPS if s in steps]

    def test_the_gate_is_derived_never_configured(self):
        """There is no key by which a host could ask for a different gate."""
        assert not set(cpt.GATE_STEPS) & set(cpt.DECLARED_KEYS)


# ---------------------------------------------------------------------------
# The organizer's out-of-platform record
# ---------------------------------------------------------------------------

class TestExecutionRecord:
    _REL = {"release_url": "https://example.org/m.tar.gz",
            "release_sha256": "ab" * 32}
    _ASSIGN = {"assignment_instrument_url": "https://example.org/a.pdf",
               "assignment_recorded_at": "2026-09-07T00:00:00Z"}

    def test_it_is_found_under_either_id_in_order(self):
        table = {cpt.EXECUTION_KEY: {"rc-1": self._REL,
                                     "authreq-1": self._ASSIGN}}
        assert cpt.execution_record(table, ["rc-1", "authreq-1"]) == self._REL
        assert cpt.execution_record(table, [None, "authreq-1"]) == self._ASSIGN
        assert cpt.execution_record(table, ["rc-x"]) == {}

    def test_missing_or_malformed_tables_yield_nothing(self):
        assert cpt.execution_record(None, ["rc-1"]) == {}
        assert cpt.execution_record({}, ["rc-1"]) == {}
        assert cpt.execution_record({cpt.EXECUTION_KEY: []}, ["rc-1"]) == {}

    def test_a_good_release_record_passes(self):
        assert cpt.release_record_problem(self._REL) is None

    @pytest.mark.parametrize("record,needle", [
        ({}, "nothing recorded"),
        ({"release_sha256": "ab" * 32}, "no release_url"),
        ({"release_url": "http://x.org/m", "release_sha256": "ab" * 32},
         "https"),
        ({"release_url": "https://x.org/m"}, "release_sha256"),
        ({"release_url": "https://x.org/m", "release_sha256": "nope"},
         "release_sha256"),
    ])
    def test_a_bad_release_record_says_why(self, record, needle):
        problem = cpt.release_record_problem(record)
        assert problem and needle in problem

    def test_a_good_assignment_record_passes(self):
        assert cpt.assignment_record_problem(self._ASSIGN) is None

    @pytest.mark.parametrize("record,needle", [
        ({}, "nothing recorded"),
        ({"assignment_recorded_at": "2026-09-07"}, "no assignment_instrument_url"),
        ({"assignment_instrument_url": "http://x.org/a.pdf"}, "https"),
        ({"assignment_instrument_url": "https://x.org/a.pdf"},
         "assignment_recorded_at"),
    ])
    def test_a_bad_assignment_record_says_why(self, record, needle):
        problem = cpt.assignment_record_problem(record)
        assert problem and needle in problem


class TestMoneyWithoutTerms:
    def test_advertised_money_with_no_terms_is_reported(self):
        assert money_declared_without_terms({"prize": {"amount": 5000}}) == ["prize"]
        assert money_declared_without_terms({"prize_pool": "CAD 10k"}) == ["prize_pool"]

    def test_terms_present_means_nothing_to_report(self):
        assert money_declared_without_terms(
            {"prize": {"amount": 5000},
             "prize_terms": _terms("retain_ip")}) == []

    def test_empty_or_absent_money_keys_are_not_a_prize(self):
        assert money_declared_without_terms({}) == []
        assert money_declared_without_terms({"prize": None}) == []
        assert money_declared_without_terms({"prize": {}}) == []
        assert money_declared_without_terms(None) == []


# ---------------------------------------------------------------------------
# Public-page parity — a hardcoded page that drifts must fail a test
# ---------------------------------------------------------------------------

class TestPublicPageParity:
    """The public prize spec's condition-7 tables are hand-written Markdown.

    They are the participant-facing statement of this vocabulary, so every
    option and every derived value must appear on the page verbatim. An option
    added here and forgotten there fails here, not in front of an entrant.
    """

    @pytest.fixture(scope="class")
    def page(self):
        assert PRIZE_PAGE.is_file(), PRIZE_PAGE
        return PRIZE_PAGE.read_text(encoding="utf-8")

    def test_every_option_is_named_on_the_page(self, page):
        for name in cpt.DISPOSITIONS:
            assert f"`{name}`" in page, name

    def test_every_option_is_also_said_in_plain_words(self, page):
        for label in cpt.DISPOSITION_LABELS.values():
            assert label in page, label

    def test_every_dimension_name_is_on_the_page(self, page):
        for name in cpt.DIMENSIONS:
            assert f"`{name}`" in page, name

    def test_every_derived_value_the_options_use_is_on_the_page(self, page):
        for name in cpt.DISPOSITIONS:
            for value in cpt.DISPOSITION_DERIVED[name].values():
                assert f"`{value}`" in page, f"{name}: {value}"

    def test_every_override_value_is_on_the_page(self, page):
        for table in cpt.DISPOSITION_OVERRIDES.values():
            for vocabulary in table.values():
                for value in (vocabulary or ()):
                    assert f"`{value}`" in page, value

    def test_the_release_licence_wildcard_is_on_the_page(self, page):
        assert f"`{cpt.RELEASE_LICENSE_ANY}`" in page

    def test_the_page_says_rights_and_host_use_are_derived(self, page):
        assert "derived" in page.lower()
        for key in cpt.DERIVED_ONLY_KEYS:
            assert f"`{key}`" in page

    def test_the_page_states_no_terms_means_no_prize(self, page):
        assert "no declared prize terms has no prize" in page

    def test_the_page_never_implies_one_mandatory_condition(self, page):
        """The pre-ruling wording said handover was THE prize condition."""
        assert "The prize condition is" not in page
        assert "release_required_before_scores" not in page

    def test_the_payout_order_names_the_declared_gate_steps(self, page):
        assert ("declared gate steps verified → contest closed → prize paid"
                in page)

    def test_the_page_says_assignment_is_never_verified_as_law(self, page):
        assert "never verifies law" in page

    def test_the_page_carries_no_internal_paths(self, page):
        """Public pages never reference an internal path (the doc-set rule).

        `/docs/network/...` links are the SITE's own routes and are fine, and
        §7.1 names the page's own `cli/website/...` path (pre-existing, and the
        public tree). An INTERNAL repo directory is what must never appear.
        """
        for forbidden in ("arena/", "mt-eval-arena/", ".vault",
                          "references/", "contest_prize_terms.py",
                          "contest_policy", "docs/INDEX"):
            assert forbidden not in page, forbidden


class TestRetiredPresetsAreGoneFromEveryPublicPage:
    """The presets were participant-facing; a page still naming one would be
    offering a term that no longer exists."""

    #: Never acceptable on ANY public page.
    RETIRED_ANYWHERE = ("--prize-preset", "prize-preset", "prize preset",
                        "from_preset", "open/audit/community/strict",
                        "open`, `audit`, `community`, `strict")
    #: The pages that talk about prize terms: there, a bare backticked preset
    #: name reads as a term on offer. (`audit` is a real CLI verb elsewhere,
    #: and `open` is the sealed-run verb `mt-eval node open` on the runbook
    #: page, so that one page is checked for the other three names.)
    PRIZE_PAGES = ("network/specifications/prize-spec.md",
                   "network/specifications/benchmark-spec.md",
                   "network/sovereignty/run-a-sovereign-contest.md")
    RETIRED_BY_PAGE = {
        "network/specifications/prize-spec.md":
            ("`open`", "`audit`", "`community`", "`strict`"),
        "network/specifications/benchmark-spec.md":
            ("`open`", "`audit`", "`community`", "`strict`"),
        "network/sovereignty/run-a-sovereign-contest.md":
            ("`audit`", "`community`", "`strict`"),
    }

    @pytest.mark.parametrize("needle", RETIRED_ANYWHERE)
    def test_no_public_page_names_a_retired_preset(self, needle):
        offenders = [
            str(path.relative_to(PUBLIC_DOCS))
            for path in sorted(PUBLIC_DOCS.rglob("*.md"))
            if needle in path.read_text(encoding="utf-8")]
        assert offenders == [], f"{needle}: {offenders}"

    @pytest.mark.parametrize("page", sorted(RETIRED_BY_PAGE))
    def test_the_prize_pages_offer_no_preset_by_name(self, page):
        text = (PUBLIC_DOCS / page).read_text(encoding="utf-8")
        offenders = [n for n in self.RETIRED_BY_PAGE[page] if n in text]
        assert offenders == [], f"{page}: {offenders}"

    @pytest.mark.parametrize("name", PRIZE_PAGES)
    def test_the_prize_pages_name_the_three_options(self, name):
        text = (PUBLIC_DOCS / name).read_text(encoding="utf-8")
        for disposition in cpt.DISPOSITIONS:
            assert disposition in text, f"{name}: {disposition}"


# ---------------------------------------------------------------------------
# Migration parity — the SQL and this module hold the same vocabularies
# ---------------------------------------------------------------------------

MIGRATION = (Path(__file__).resolve().parents[2] / "mt-eval-arena" / "supabase"
             / "migrations" / "074_contest_entries_phases_and_promises.sql")


class TestMigrationParity:
    @pytest.fixture(scope="class")
    def sql(self):
        assert MIGRATION.is_file(), MIGRATION
        return MIGRATION.read_text(encoding="utf-8")

    def test_the_disposition_vocabulary_is_a_sql_literal_list(self, sql):
        match = re.search(
            r"v_prize ->> 'disposition'\) NOT IN \(([^)]*)\)", sql)
        assert match
        assert tuple(re.findall(r"'([^']+)'", match.group(1))) == cpt.DISPOSITIONS

    @pytest.mark.parametrize("key", ["retention", "release"])
    def test_each_override_vocabulary_is_a_sql_literal_list(self, sql, key):
        match = re.search(rf"v_prize ->> '{key}'\) NOT IN \(([^)]*)\)", sql)
        assert match, key
        literals = tuple(re.findall(r"'([^']+)'", match.group(1)))
        expected = next(table[key]
                        for table in cpt.DISPOSITION_OVERRIDES.values()
                        if key in table)
        assert literals == expected

    def test_the_derived_keys_are_refused_in_sql_too(self, sql):
        for key in cpt.DERIVED_ONLY_KEYS:
            assert f"v_prize ? '{key}'" in sql, key

    def test_json_that_this_module_accepts_is_the_json_the_sql_accepts(self):
        """Both sides are exercised by the same fixtures elsewhere; here we
        only assert the stored terms are plain JSON scalars, which is what a
        jsonb column can hold at all."""
        for name in cpt.DISPOSITIONS:
            terms = declared_prize_terms(_terms(name))
            assert json.loads(json.dumps(terms)) == terms
            assert all(isinstance(v, str) for v in terms.values())
