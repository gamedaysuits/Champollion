"""Coaching-prompt content gate — the 051 method-artifact exemption is scanned.

A run card's ``system_prompt_used`` may legitimately be long (it is the
submitter's own method artifact), but for a restricted corpus it must not
embed the corpus's own source/reference pairs. The DB cannot check this
(never-host doctrine: it has no corpus text to compare against), so
publish.py's client-side gate is the enforcement point.
"""

from __future__ import annotations

import pytest

from mt_eval_harness.publish import (
    _coaching_prompt_content_gate,
    _coaching_prompt_pair_hits,
)


ENTRIES = [
    {"id": 0, "source": "I see him", "expected": "niwâpamâw"},
    {"id": 1, "source": "when he works", "expected": "ê-atoskêt"},
    {"id": 2, "source": "my house", "expected": "niwâskahikan"},
    {"id": 3, "source": "The children are playing outside today",
     "expected": "awâsisak mêtawêwak wayawîtimihk anohc"},
]

NC_ENTRY = {"license": "CC-BY-NC-SA-4.0", "segment": "development"}
SEALED_ENTRY = {"license": "CC-BY-NC-SA-4.0", "segment": "gold_standard"}
CLEAR_ENTRY = {"license": "CC-BY-4.0", "segment": "development"}


def card(prompt: str) -> dict:
    return {"system_prompt_used": prompt, "system_prompt_sha256": "abc123"}


class TestPairHits:
    def test_pair_requires_both_sides(self):
        # Source alone (a grammar prompt mentioning the English) is not a hit.
        hits = _coaching_prompt_pair_hits(
            "Translate phrases like 'I see him' into Cree.", ENTRIES)
        assert hits == []

    def test_pair_detected_when_both_sides_present(self):
        hits = _coaching_prompt_pair_hits(
            "Example: 'I see him' → niwâpamâw (VTA direct).", ENTRIES)
        assert [h["id"] for h in hits] == [0]

    def test_normalization_case_and_whitespace(self):
        hits = _coaching_prompt_pair_hits(
            "example:  I  SEE  HIM  =  NiwâpamâW", ENTRIES)
        assert [h["id"] for h in hits] == [0]

    def test_degenerate_short_entries_ignored(self):
        entries = [{"id": 9, "source": "and", "expected": "êkwa"}]
        hits = _coaching_prompt_pair_hits("and means êkwa", entries)
        assert hits == []


class TestGate:
    def test_cleared_corpus_never_scanned(self, capsys):
        # Even a blatant pair embed passes for a redistribution-cleared corpus
        # — its entries publish openly anyway.
        _coaching_prompt_content_gate(
            card("I see him → niwâpamâw; when he works → ê-atoskêt; "
                 "my house → niwâskahikan"),
            ENTRIES, CLEAR_ENTRY, redact=False)

    def test_restricted_three_pairs_refuses(self):
        with pytest.raises(SystemExit):
            _coaching_prompt_content_gate(
                card("I see him → niwâpamâw. when he works → ê-atoskêt. "
                     "my house → niwâskahikan."),
                ENTRIES, NC_ENTRY, redact=False)

    def test_restricted_one_sentence_pair_refuses(self):
        with pytest.raises(SystemExit):
            _coaching_prompt_content_gate(
                card("The children are playing outside today = "
                     "awâsisak mêtawêwak wayawîtimihk anohc"),
                ENTRIES, NC_ENTRY, redact=False)

    def test_restricted_one_short_pair_warns_but_publishes(self, capsys):
        _coaching_prompt_content_gate(
            card("Example: I see him → niwâpamâw"),
            ENTRIES, NC_ENTRY, redact=False)
        assert "Coaching-prompt scan" in capsys.readouterr().out

    def test_sealed_one_pair_refuses(self):
        with pytest.raises(SystemExit):
            _coaching_prompt_content_gate(
                card("Example: I see him → niwâpamâw"),
                ENTRIES, SEALED_ENTRY, redact=False)

    def test_unregistered_corpus_is_scanned(self):
        # Fail-safe posture: no registry entry → treated as restricted.
        with pytest.raises(SystemExit):
            _coaching_prompt_content_gate(
                card("I see him → niwâpamâw. when he works → ê-atoskêt. "
                     "my house → niwâskahikan."),
                ENTRIES, None, redact=False)

    def test_redact_replaces_text_and_keeps_sha(self):
        c = card("I see him → niwâpamâw. when he works → ê-atoskêt. "
                 "my house → niwâskahikan.")
        _coaching_prompt_content_gate(c, ENTRIES, NC_ENTRY, redact=True)
        assert c["system_prompt_used"].startswith("[REDACTED")
        assert "niwâpamâw" not in c["system_prompt_used"]
        assert c["system_prompt_sha256"] == "abc123"

    def test_clean_grammar_prompt_passes_restricted(self, capsys):
        _coaching_prompt_content_gate(
            card("VTA verbs take direct-order theme signs; SRO uses macrons "
                 "on long vowels. Okimâsis (2004) ch. 7 covers conjunct "
                 "order."),
            ENTRIES, NC_ENTRY, redact=False)
        assert "Coaching-prompt scan" not in capsys.readouterr().out

    def test_unregistered_owner_override_skips_scan(self):
        # --publish-entries (owner affirms rights over an unregistered
        # corpus) also licenses quoting their own pairs in coaching.
        _coaching_prompt_content_gate(
            card("I see him → niwâpamâw. when he works → ê-atoskêt. "
                 "my house → niwâskahikan."),
            ENTRIES, None, redact=False, owner_override=True)

    def test_registered_restricted_ignores_owner_override(self):
        with pytest.raises(SystemExit):
            _coaching_prompt_content_gate(
                card("I see him → niwâpamâw. when he works → ê-atoskêt. "
                     "my house → niwâskahikan."),
                ENTRIES, NC_ENTRY, redact=False, owner_override=True)
