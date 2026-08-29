"""
Tests for mt_eval_harness.license_use — use-based (commercial vs non-commercial)
license eligibility, contest eligibility, corpus-license resolution, and the
NC-terms acknowledgment record.

The headline cases (project doctrine 2026-06-19): an NC dataset PASSES a
non-commercial use and is BLOCKED from a commercial use / redistribution; and a
quarantined dataset (EdTeKLA / sovereignty corpora) is NEVER eligible in ANY
lane — quarantine always wins over the use-based nuance.
"""

from __future__ import annotations

import json

import pytest

from mt_eval_harness import license_use
from mt_eval_harness.license_use import (
    COMMERCIAL,
    NON_COMMERCIAL,
    contest_dataset_eligible,
    is_commercial_safe,
    is_non_commercial,
    corpus_is_quarantined,
    is_usage_allowed,
    make_nc_acknowledgment,
    non_commercial_use_allowed,
    resolve_corpus_license,
)


# ---------------------------------------------------------------------------
# is_non_commercial — positive NC detection
# ---------------------------------------------------------------------------

class TestIsNonCommercial:
    def test_detects_nc_families(self):
        for s in ("CC-BY-NC-4.0", "CC-BY-NC-SA-4.0", "CC-BY-NC-ND-4.0",
                  "LicenseRef-NonCommercial", "research non-commercial only"):
            assert is_non_commercial(s), s

    def test_does_not_flag_permissive_or_sa(self):
        for s in ("CC-BY-4.0", "CC-BY-SA-4.0", "CC0-1.0", "MIT",
                  "LicenseRef-Unstated", "", None):
            assert not is_non_commercial(s), s


# ---------------------------------------------------------------------------
# is_commercial_safe / non_commercial_use_allowed (mirror license-gate.mjs)
# ---------------------------------------------------------------------------

class TestClassification:
    def test_commercial_safe_only_permissive(self):
        for s in ("CC-BY-4.0", "CC0-1.0", "MIT", "Apache-2.0", "BSD-3-Clause"):
            assert is_commercial_safe(s), s
        for s in ("CC-BY-NC-4.0", "CC-BY-SA-4.0", "GPL-3.0-only",
                  "LicenseRef-Unstated", "LicenseRef-OPUS-Mixed", "CC", "", None):
            assert not is_commercial_safe(s), s

    def test_nc_use_allows_open_families_but_not_unstated(self):
        for s in ("CC-BY-4.0", "CC-BY-NC-4.0", "CC-BY-SA-4.0",
                  "CC-BY-NC-ND-4.0", "LicenseRef-SIL-Terms"):
            assert non_commercial_use_allowed(s), s
        for s in ("LicenseRef-OPUS-Mixed", "LicenseRef-Unstated",
                  "UNCONFIRMED", "", None):
            assert not non_commercial_use_allowed(s), s


# ---------------------------------------------------------------------------
# is_usage_allowed — the orthogonal commercial/NC model
# ---------------------------------------------------------------------------

class TestIsUsageAllowed:
    def test_nc_passes_non_commercial_blocked_commercial(self):
        """The headline case: NC allowed non-commercial, blocked commercial."""
        ok_nc, _ = is_usage_allowed("CC-BY-NC-4.0", use_context=NON_COMMERCIAL)
        assert ok_nc is True
        ok_com, reason = is_usage_allowed("CC-BY-NC-4.0", use_context=COMMERCIAL)
        assert ok_com is False
        assert "commercial" in reason.lower()

    def test_nc_blocked_from_redistribution_in_either_context(self):
        assert is_usage_allowed("CC-BY-NC-4.0", redistribution=True)[0] is False
        assert is_usage_allowed(
            "CC-BY-NC-4.0", use_context=NON_COMMERCIAL, redistribution=True
        )[0] is False

    def test_permissive_allowed_in_both_and_redistribution(self):
        for ctx in (NON_COMMERCIAL, COMMERCIAL):
            assert is_usage_allowed("CC-BY-4.0", use_context=ctx)[0] is True
        assert is_usage_allowed("CC-BY-4.0", redistribution=True)[0] is True

    def test_unstated_fails_safe_in_every_context(self):
        for lic in ("LicenseRef-Unstated", None, "", "some-unknown-thing"):
            assert is_usage_allowed(lic, use_context=NON_COMMERCIAL)[0] is False
            assert is_usage_allowed(lic, use_context=COMMERCIAL)[0] is False

    def test_unknown_context_treated_as_commercial(self):
        # A typo must not accidentally open the NC lane for an NC dataset.
        assert is_usage_allowed("CC-BY-NC-4.0", use_context="whatever")[0] is False


# ---------------------------------------------------------------------------
# contest_dataset_eligible — quarantine ALWAYS wins (EdTeKLA hard floor)
# ---------------------------------------------------------------------------

class TestContestEligibility:
    def test_nc_dataset_eligible_for_noncommercial_contest(self):
        ok, _ = contest_dataset_eligible(NON_COMMERCIAL, "CC-BY-NC-SA-4.0")
        assert ok is True

    def test_nc_dataset_blocked_from_commercial_contest(self):
        ok, _ = contest_dataset_eligible(COMMERCIAL, "CC-BY-NC-SA-4.0")
        assert ok is False

    def test_permissive_eligible_for_both(self):
        assert contest_dataset_eligible(NON_COMMERCIAL, "CC-BY-4.0")[0] is True
        assert contest_dataset_eligible(COMMERCIAL, "CC-BY-4.0")[0] is True

    def test_edtekla_quarantine_blocks_every_lane(self):
        """EdTeKLA + crk sovereignty corpora stay hard-quarantined and never
        rank in ANY lane — commercial or non-commercial — regardless of license.
        Quarantine overrides the use-based nuance (the DB trigger in migration
        022 is the un-bypassable backstop; this is its client-side mirror)."""
        # EdTeKLA is CC-BY-NC-SA, but quarantine wins no matter the use context.
        for ctx in (COMMERCIAL, NON_COMMERCIAL):
            ok, reason = contest_dataset_eligible(
                ctx, "CC-BY-NC-SA-4.0", quarantined=True
            )
            assert ok is False, f"quarantined dataset must not rank in {ctx} lane"
            assert "quarantine" in reason.lower()
        # Even a permissive license cannot un-quarantine a sovereignty corpus.
        assert contest_dataset_eligible(
            NON_COMMERCIAL, "CC-BY-4.0", quarantined=True
        )[0] is False


# ---------------------------------------------------------------------------
# resolve_corpus_license
# ---------------------------------------------------------------------------

@pytest.fixture
def registry_file(tmp_path):
    reg = {
        "registry_version": "3.0.0",
        "datasets": [
            {
                "id": "eval-eng-xxx-nc-dev-v1",
                "language_pair": {"source": "eng", "target": "xxx"},
                "license": "CC-BY-NC-4.0",
                "path": "curated/eng-xxx-nc-dev-v1.json",
                "segment": "development",
            },
            {
                "id": "eval-eng-yyy-open-dev-v1",
                "aliases": ["open-alias"],
                "language_pair": {"source": "eng", "target": "yyy"},
                "license": "CC-BY-4.0",
                "segment": "development",
            },
        ],
    }
    p = tmp_path / "registry.json"
    p.write_text(json.dumps(reg), encoding="utf-8")
    return p


class TestResolveCorpusLicense:
    def test_resolves_by_id(self, registry_file):
        lic, did = resolve_corpus_license(
            "eval-eng-xxx-nc-dev-v1", registry_path=registry_file)
        assert lic == "CC-BY-NC-4.0" and did == "eval-eng-xxx-nc-dev-v1"

    def test_resolves_by_alias(self, registry_file):
        lic, did = resolve_corpus_license("open-alias", registry_path=registry_file)
        assert lic == "CC-BY-4.0" and did == "eval-eng-yyy-open-dev-v1"

    def test_reads_license_from_corpus_file(self, tmp_path):
        corpus = tmp_path / "mine.json"
        corpus.write_text(json.dumps({
            "corpus_id": "mine-v1",
            "provenance": {"license": "CC-BY-NC-4.0"},
            "entries": [],
        }), encoding="utf-8")
        lic, did = resolve_corpus_license(str(corpus))
        assert lic == "CC-BY-NC-4.0" and did == "mine-v1"

    def test_unknown_returns_none(self, registry_file):
        assert resolve_corpus_license(
            "no-such-corpus", registry_path=registry_file) == (None, None)
        assert resolve_corpus_license(None) == (None, None)


# ---------------------------------------------------------------------------
# corpus_is_quarantined — the client-side quarantine mirror, against a REAL
# registry file (test-suite audit 2026-08-19, S1: this function was previously
# only ever monkeypatched, so its registry-lookup behaviour had zero coverage)
# ---------------------------------------------------------------------------

@pytest.fixture
def quarantine_registry(tmp_path):
    """A registry in the arena/datasets/registry.json shape ({"datasets": [...]})
    with one quarantined entry, one clean entry, and an aliased quarantined
    entry — resolved through the real load path, no mocks."""
    reg = {
        "registry_version": "3.0.0",
        "datasets": [
            {
                "id": "eval-eng-qqq-quar-dev-v1",
                "aliases": ["quar-alias"],
                "language_pair": {"source": "eng", "target": "qqq"},
                "license": "CC-BY-NC-SA-4.0",
                "path": "curated/eng-qqq-quar-dev-v1.json",
                "quarantine": True,
            },
            {
                "id": "eval-eng-zzz-clean-dev-v1",
                "language_pair": {"source": "eng", "target": "zzz"},
                "license": "CC-BY-4.0",
                "path": "curated/eng-zzz-clean-dev-v1.json",
            },
        ],
    }
    p = tmp_path / "registry.json"
    p.write_text(json.dumps(reg), encoding="utf-8")
    return p


class TestCorpusIsQuarantined:
    def test_quarantined_entry_returns_true(self, quarantine_registry):
        assert corpus_is_quarantined(
            "eval-eng-qqq-quar-dev-v1", registry_path=quarantine_registry) is True

    def test_quarantined_entry_resolves_by_alias(self, quarantine_registry):
        assert corpus_is_quarantined(
            "quar-alias", registry_path=quarantine_registry) is True

    def test_quarantined_entry_resolves_by_path_basename(self, quarantine_registry):
        # A `--corpus some/dir/<file>.json` argument matches the registry
        # entry whose `path` basename agrees.
        assert corpus_is_quarantined(
            "downloads/eng-qqq-quar-dev-v1.json",
            registry_path=quarantine_registry) is True

    def test_clean_entry_returns_false(self, quarantine_registry):
        assert corpus_is_quarantined(
            "eval-eng-zzz-clean-dev-v1", registry_path=quarantine_registry) is False

    def test_unregistered_corpus_returns_false(self, quarantine_registry):
        # Quarantine is a registry/DB property; the un-bypassable backstop for
        # unregistered ids is migration 022's DB trigger, not this client check.
        assert corpus_is_quarantined(
            "no-such-corpus", registry_path=quarantine_registry) is False

    def test_none_returns_false(self, quarantine_registry):
        assert corpus_is_quarantined(None, registry_path=quarantine_registry) is False


# ---------------------------------------------------------------------------
# make_nc_acknowledgment
# ---------------------------------------------------------------------------

class TestNcAcknowledgment:
    def test_record_shape(self):
        rec = make_nc_acknowledgment("eval-x", "CC-BY-NC-4.0", via="flag")
        assert rec["acknowledged"] is True
        assert rec["kind"] == "non-commercial-terms"
        assert rec["corpus"] == "eval-x"
        assert rec["license"] == "CC-BY-NC-4.0"
        assert rec["via"] == "flag"
        assert rec["statement"] == license_use.NC_TERMS_STATEMENT
        assert "acknowledged_at" in rec
