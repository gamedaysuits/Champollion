"""Transmission policy — restricted corpora only flow through no-train channels.

Guards the run-time counterpart of the publish content gates: migrations
033/051 stop restricted corpus text from being REDISTRIBUTED on the board;
this policy stops it from being TRANSMITTED to a data-collecting model
provider in the first place (docs/DATA_BOUNDARIES.md §"Transmission to
model APIs", founder ruling 2026-07-19).
"""

from __future__ import annotations

import asyncio
import json
from pathlib import Path

import pytest

from mt_eval_harness.api import call_openrouter
from mt_eval_harness.config import RunConfig
from mt_eval_harness.providers.base import LLMProvider
from mt_eval_harness.providers.anthropic_provider import AnthropicProvider
from mt_eval_harness.providers.gemini_provider import GeminiProvider
from mt_eval_harness.providers.local_provider import LocalProvider
from mt_eval_harness.providers.openai_provider import OpenAIProvider
from mt_eval_harness.providers.openrouter import OpenRouterProvider
from mt_eval_harness.transmission_policy import (
    MODE_CLEARED,
    MODE_CONSENT_REQUIRED,
    MODE_NO_TRAIN,
    MODE_SEALED,
    OPENROUTER_RESTRICTED_PROVIDER_PREFS,
    enforce_transmission_policy,
    resolve_transmission_policy,
)

REPO_ROOT = Path(__file__).resolve().parents[2]
REGISTRY = REPO_ROOT / "arena" / "datasets" / "registry.json"


# ---------------------------------------------------------------------------
# Classifier
# ---------------------------------------------------------------------------

class TestResolveTransmissionPolicy:
    def test_edtekla_dev_registry_entry_is_consent_required(self):
        """The REAL registry row for the EdTeKLA dev corpus: a modified,
        sovereignty-scoped grant means remote evaluation needs the
        rights-holder's recorded permission — never our interpretation."""
        registry = json.loads(REGISTRY.read_text())
        entry = next(d for d in registry["datasets"]
                     if d["id"] == "eval-eng-crk-edtekla-dev-v1")
        pol = resolve_transmission_policy(entry["id"], registry_entry=entry)
        # The real row is ALSO quarantined, which is even stricter (sealed).
        assert pol.mode in (MODE_SEALED, MODE_CONSENT_REQUIRED)
        assert pol.restricted
        assert pol.provider_prefs == {"data_collection": "deny"}

    def test_licenseref_without_quarantine_is_consent_required(self):
        pol = resolve_transmission_policy(
            "x",
            registry_entry={
                "license": "LicenseRef-EdTeKLA-Modified-CC-BY-NC-SA-4.0",
                "segment": "development",
            },
        )
        assert pol.mode == MODE_CONSENT_REQUIRED

    def test_wmt_research_use_defaults_to_consent_required(self):
        """Fail-safe: a LicenseRef/bespoke grant WITHOUT a data-side decision
        is consent-required (this synthetic entry omits the real cards'
        transmission_policy pin)."""
        pol = resolve_transmission_policy(
            "wmt24-x",
            registry_entry={"license": "LicenseRef-WMT-Research-Use",
                            "segment": "development"})
        assert pol.mode == MODE_CONSENT_REQUIRED

    def test_real_wmt_entries_are_pinned_no_train(self):
        """Founder decision 2026-07-19 (IP_TRANSMISSION_REVIEW §6): the WMT
        research-use sets carry transmissionPolicy 'no-train' on their cards
        — WMT distributes them FOR research evaluation, so remote eval
        proceeds over no-train channels without a per-dataset upstream ask.
        The other LicenseRef families (EdTeKLA, Gamayun, AmericasNLP,
        NusaWrites) stay gated: no overrides, no consent blocks."""
        registry = json.loads(REGISTRY.read_text())
        wmt = [d for d in registry["datasets"]
               if d.get("license") == "LicenseRef-WMT-Research-Use"]
        assert wmt, "expected WMT research-use entries in the registry"
        for entry in wmt:
            # Every WMT entry carries the founder's data-side pin...
            assert entry.get("transmission_policy") == "no-train", entry["id"]
            pol = resolve_transmission_policy(entry["id"],
                                              registry_entry=entry)
            if entry.get("quarantine"):
                # ...but an operationally quarantined set (e.g. wmt25's
                # provisional pairs) stays sealed until unquarantined —
                # quarantine always outranks a data-side pin.
                assert pol.mode == MODE_SEALED, entry["id"]
            else:
                assert pol.mode == MODE_NO_TRAIN, entry["id"]
        for entry in registry["datasets"]:
            lic = str(entry.get("license") or "")
            if lic.startswith("LicenseRef") and "WMT" not in lic:
                assert not entry.get("transmission_policy"), entry["id"]
                assert not entry.get("transmission_consent"), entry["id"]
                pol = resolve_transmission_policy(entry["id"],
                                                  registry_entry=entry)
                assert pol.mode in (MODE_CONSENT_REQUIRED, MODE_SEALED), \
                    entry["id"]

    def test_plain_standard_nc_license_is_no_train(self):
        pol = resolve_transmission_policy(
            "x", registry_entry={"license": "CC-BY-NC-SA-4.0",
                                 "segment": "development"})
        assert pol.mode == MODE_NO_TRAIN

    def test_permissive_registered_corpus_is_cleared(self):
        pol = resolve_transmission_policy(
            "tatoeba-x",
            registry_entry={"license": "CC-BY-2.0", "segment": "development"},
        )
        assert pol.mode == MODE_CLEARED
        assert not pol.restricted
        assert pol.provider_prefs is None

    def test_recorded_consent_grant_downgrades_to_no_train(self):
        pol = resolve_transmission_policy(
            "x",
            registry_entry={
                "license": "LicenseRef-EdTeKLA-Modified-CC-BY-NC-SA-4.0",
                "segment": "development",
                "transmission_consent": {
                    "granted_by": "EdTeKLA Research Group",
                    "date": "2026-08-01",
                    "scope": "non-commercial benchmark evaluation",
                    "evidence": "docs/consent/edtekla-2026-08-01.md",
                },
            },
        )
        assert pol.mode == MODE_NO_TRAIN
        assert pol.consent is not None
        assert "recorded upstream permission" in pol.reason

    def test_incomplete_consent_block_is_ignored(self):
        pol = resolve_transmission_policy(
            "x",
            registry_entry={
                "license": "LicenseRef-TWB-Gamayun",
                "segment": "development",
                "transmission_consent": {"granted_by": ""},
            },
        )
        assert pol.mode == MODE_CONSENT_REQUIRED

    def test_explicit_data_side_override_is_honored(self):
        pol = resolve_transmission_policy(
            "x",
            registry_entry={"license": "LicenseRef-WMT-Research-Use",
                            "segment": "development",
                            "transmission_policy": "no-train"})
        assert pol.mode == MODE_NO_TRAIN
        assert "explicit data-side" in pol.reason

    def test_quarantine_is_sealed_even_with_permissive_license(self):
        pol = resolve_transmission_policy(
            "x", registry_entry={"license": "CC-BY-4.0", "quarantine": True,
                                 "quarantine_reason": "improper subset"})
        assert pol.mode == MODE_SEALED

    def test_sealed_segments_are_sealed(self):
        for seg in ("held_out", "gold_standard"):
            pol = resolve_transmission_policy(
                "x", registry_entry={"license": "CC-BY-4.0", "segment": seg})
            assert pol.mode == MODE_SEALED, seg

    def test_unregistered_defaults_to_privacy_pinned_no_train(self):
        """The private-corpus pillar: an unregistered (caller-owned) corpus
        still RUNS — privacy-pinned, not consent-blocked."""
        pol = resolve_transmission_policy("", registry_entry=None,
                                          corpus_meta={})
        assert pol.mode == MODE_NO_TRAIN

    def test_unregistered_sealed_envelope_is_sealed_despite_override(self):
        pol = resolve_transmission_policy(
            "", registry_entry=None,
            corpus_meta={"segment": "held_out"},
            allow_data_collection_unregistered=True,
        )
        assert pol.mode == MODE_SEALED

    def test_unregistered_permissive_envelope_is_cleared(self):
        pol = resolve_transmission_policy(
            "", registry_entry=None, corpus_meta={"license": "CC-BY-4.0"})
        assert pol.mode == MODE_CLEARED

    def test_unregistered_override_clears(self):
        pol = resolve_transmission_policy(
            "", registry_entry=None, corpus_meta={},
            allow_data_collection_unregistered=True)
        assert pol.mode == MODE_CLEARED

    def test_registered_consent_required_ignores_data_collection_flag(self):
        pol = resolve_transmission_policy(
            "x",
            registry_entry={"license": "LicenseRef-TWB-Gamayun",
                            "segment": "development"},
            allow_data_collection_unregistered=True,
        )
        assert pol.mode == MODE_CONSENT_REQUIRED


# ---------------------------------------------------------------------------
# Enforcement — who may proceed, who refuses
# ---------------------------------------------------------------------------

def _enforce(pol, provider_name="openrouter", supports=True,
             basis="test-basis", external=False, attest=False,
             local_verified=False):
    return enforce_transmission_policy(
        pol,
        provider_name=None if external else provider_name,
        provider_supports_restricted=supports,
        provider_basis=basis,
        has_external_method=external,
        attest_local_transport=attest,
        local_transport_verified=local_verified,
    )


class TestEnforcement:
    def _policy(self, mode, reason="r"):
        prefs = (None if mode == MODE_CLEARED
                 else dict(OPENROUTER_RESTRICTED_PROVIDER_PREFS))
        from mt_eval_harness.transmission_policy import TransmissionPolicy
        return TransmissionPolicy(mode, reason, provider_prefs=prefs)

    def test_cleared_proceeds(self):
        prov = _enforce(self._policy(MODE_CLEARED))
        assert prov["enforced"] is True

    def test_no_train_proceeds_on_supported_provider(self):
        prov = _enforce(self._policy(MODE_NO_TRAIN))
        assert prov["enforced"] is True
        assert prov["channel_basis"] == "test-basis"

    def test_no_train_refuses_unsupported_provider(self):
        with pytest.raises(RuntimeError, match="no no-train channel basis"):
            _enforce(self._policy(MODE_NO_TRAIN), provider_name="mystery",
                     supports=False)

    def test_no_train_external_method_records_unenforced(self):
        prov = _enforce(self._policy(MODE_NO_TRAIN), external=True)
        assert prov["enforced"] is False
        assert prov["channel"] == "external-method"

    def test_consent_required_refuses_remote(self):
        for name in ("openrouter", "openai", "anthropic", "gemini"):
            with pytest.raises(RuntimeError, match="permission is recorded"):
                _enforce(self._policy(MODE_CONSENT_REQUIRED),
                         provider_name=name)

    def test_consent_required_allows_verified_local(self):
        prov = _enforce(self._policy(MODE_CONSENT_REQUIRED),
                        provider_name="local", local_verified=True)
        assert prov["enforced"] is True
        assert "nothing leaves the machine" in prov["note"]

    def test_consent_required_refuses_local_name_without_verification(self):
        # The provider NAME is never trusted: --provider local --base-url
        # https://api.groq.com/… must refuse, not stamp locality.
        with pytest.raises(RuntimeError, match="not a\n?\\s*loopback"):
            _enforce(self._policy(MODE_CONSENT_REQUIRED),
                     provider_name="local")

    def test_consent_required_external_needs_attestation(self):
        with pytest.raises(RuntimeError, match="attest-local-transport"):
            _enforce(self._policy(MODE_CONSENT_REQUIRED), external=True)
        prov = _enforce(self._policy(MODE_CONSENT_REQUIRED), external=True,
                        attest=True)
        assert prov["local_transport_attested"] is True

    def test_sealed_refuses_remote_without_consent_language(self):
        # Sealed refusal must NOT suggest consent can unlock it.
        with pytest.raises(RuntimeError) as exc:
            _enforce(self._policy(MODE_SEALED))
        assert "permission is recorded" not in str(exc.value)

    def test_sealed_allows_verified_local(self):
        prov = _enforce(self._policy(MODE_SEALED), provider_name="local",
                        local_verified=True)
        assert prov["enforced"] is True

    def test_sealed_refuses_local_name_without_verification(self):
        with pytest.raises(RuntimeError, match="refused"):
            _enforce(self._policy(MODE_SEALED), provider_name="local")

    def test_no_train_local_name_remote_keeps_caller_directed_basis(self):
        # MODE_NO_TRAIN over an unverified "local" provider proceeds on the
        # provider's declared basis (LocalProvider inherits the
        # caller-directed wording for overridden endpoints) — the policy must
        # not add a locality claim.
        prov = _enforce(self._policy(MODE_NO_TRAIN), provider_name="local",
                        basis="caller-directed OpenAI-compatible endpoint "
                              "(https://api.groq.com/openai/v1) — the caller "
                              "chose where this text goes")
        assert prov["enforced"] is True
        assert "nothing leaves the machine" not in str(prov)
        assert "caller-directed" in prov["channel_basis"]


# ---------------------------------------------------------------------------
# RunConfig plumbing
# ---------------------------------------------------------------------------

class TestRunConfigPrefs:
    def test_unresolved_policy_yields_no_prefs(self):
        assert RunConfig().transmission_provider_prefs is None

    def test_unrestricted_policy_yields_no_prefs(self):
        c = RunConfig()
        c.transmission_policy = {"restricted": False, "reason": "ok",
                                 "openrouter_provider_prefs": None}
        assert c.transmission_provider_prefs is None

    def test_restricted_policy_yields_deny_prefs(self):
        c = RunConfig()
        c.transmission_policy = {
            "restricted": True, "reason": "nc",
            "openrouter_provider_prefs": dict(
                OPENROUTER_RESTRICTED_PROVIDER_PREFS),
        }
        assert c.transmission_provider_prefs == {"data_collection": "deny"}

    def test_policy_serializes_into_config_dict(self):
        c = RunConfig()
        c.transmission_policy = {"restricted": True, "reason": "nc",
                                 "openrouter_provider_prefs":
                                     {"data_collection": "deny"}}
        assert c.to_dict()["transmission_policy"]["restricted"] is True


# ---------------------------------------------------------------------------
# Provider channel declarations
# ---------------------------------------------------------------------------

class TestProviderChannelBasis:
    def test_base_default_is_unsupported(self):
        """A future provider must state its basis before restricted text can
        flow through it — the base class defaults closed."""
        assert LLMProvider.supports_restricted_transmission is False

    def test_known_channels_declare_a_basis(self):
        for provider in (OpenRouterProvider(), AnthropicProvider(),
                         GeminiProvider(), OpenAIProvider(), LocalProvider()):
            assert provider.supports_restricted_transmission, provider.name
            assert provider.transmission_basis, provider.name

    def test_openai_default_endpoint_uses_first_party_basis(self, monkeypatch):
        monkeypatch.delenv("OPENAI_API_BASE", raising=False)
        assert "first-party" in OpenAIProvider().transmission_basis

    def test_openai_overridden_endpoint_uses_caller_directed_basis(self):
        p = OpenAIProvider(base_url="https://api.groq.com/openai/v1")
        assert "caller-directed" in p.transmission_basis


# ---------------------------------------------------------------------------
# Wire-level: the OpenRouter payload really carries the pin
# ---------------------------------------------------------------------------

class _FakeResponse:
    status = 200

    def __init__(self, capture: dict):
        self._capture = capture

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False

    async def json(self):
        return {"choices": [{"message": {"content": "ok"},
                             "finish_reason": "stop"}],
                "usage": {"prompt_tokens": 1, "completion_tokens": 1}}


class _FakeSession:
    def __init__(self):
        self.captured: dict = {}

    def post(self, url, headers=None, json=None, timeout=None):
        self.captured["url"] = url
        self.captured["json"] = json
        return _FakeResponse(self.captured)


class TestOpenRouterPayloadPin:
    def _call(self, **kwargs):
        session = _FakeSession()
        result = asyncio.run(call_openrouter(
            session=session,
            messages=[{"role": "user", "content": "hi"}],
            model_id="test/model",
            api_key="k",
            semaphore=asyncio.Semaphore(1),
            **kwargs,
        ))
        assert result["error"] is None
        return session.captured["json"]

    def test_restricted_prefs_reach_the_wire(self):
        payload = self._call(
            provider_prefs=dict(OPENROUTER_RESTRICTED_PROVIDER_PREFS))
        assert payload["provider"] == {"data_collection": "deny"}

    def test_no_prefs_means_no_provider_block(self):
        payload = self._call()
        assert "provider" not in payload

    def test_openrouter_provider_class_passes_prefs_through(self, monkeypatch):
        captured = {}

        async def fake_call(**kwargs):
            captured.update(kwargs)
            return {"content": "ok", "tool_calls": [], "usage": {},
                    "latency_s": 0.0, "error": None, "finish_reason": "stop"}

        import mt_eval_harness.providers.openrouter as orp
        monkeypatch.setattr(orp, "call_openrouter", fake_call)
        asyncio.run(OpenRouterProvider().call(
            session=object(),
            messages=[{"role": "user", "content": "hi"}],
            model_id="m",
            api_key="k",
            semaphore=asyncio.Semaphore(1),
            provider_prefs={"data_collection": "deny"},
        ))
        assert captured["provider_prefs"] == {"data_collection": "deny"}


# ---------------------------------------------------------------------------
# Queue invariant: the public token-donor queue never serves a corpus whose
# transmission refuses (consent-required / sealed), and never serves a
# restricted corpus without an explicit founder-pinned data-side policy.
#
# 2026-07-19 correction (at merge): the first cut asserted `not restricted`
# under the §6 decision-sheet premise that zero WMT pairs were queued — the
# live 83,708-item queue in fact carried 158 WMT test-set pairs. Under the
# founder's same-day WMT→no-train ruling (WMT's own license grants research
# evaluation) those are queue-eligible; everything else restricted still is
# not. The queue cannot control a donor's transport, so consent-required and
# sealed corpora — whose remote transmission refuses outright — stay banned
# unconditionally.
# ---------------------------------------------------------------------------

class TestQueueNeverServesRestricted:
    @staticmethod
    def _queue_and_registry():
        queue_path = (REPO_ROOT / "cli" / "website" / "static" / "queue.json")
        if not queue_path.exists():
            pytest.skip("queue.json not built in this checkout")
        registry = json.loads(REGISTRY.read_text())
        by_id = {d["id"]: d for d in registry["datasets"]}
        queue = json.loads(queue_path.read_text())
        items = queue.get("items", [])
        assert items, "queue.json unexpectedly empty"
        return items, by_id

    def test_every_queued_corpus_is_transmission_eligible(self):
        items, by_id = self._queue_and_registry()
        seen = set()
        for item in items:
            ds = (item.get("dataset_id") or item.get("corpus_id")
                  or (item.get("corpus") or {}).get("id"))
            if not ds or ds in seen:
                continue
            seen.add(ds)
            entry = by_id.get(ds)
            if entry is None:
                continue  # queue may carry mesh ids not in the merged registry
            pol = resolve_transmission_policy(ds, registry_entry=entry)
            assert pol.mode not in (MODE_CONSENT_REQUIRED, MODE_SEALED), (
                ds, pol.reason)
            if pol.restricted:
                # Restricted-but-queued needs a founder-pinned data-side
                # policy (today: the 178 WMT research-use sets → no-train).
                assert entry.get("transmission_policy") == MODE_NO_TRAIN, (
                    ds, pol.reason)

    def test_restricted_queued_items_carry_transmission_stamp(self):
        # 2026-07-19 residual closure: every published queue item over a
        # restricted corpus must DISCLOSE the channel requirement — a
        # per-item `transmission` block whose policy mirrors the registry
        # resolution and which carries the OpenRouter request preference
        # verbatim ({"data_collection": "deny"}). Cleared corpora must stay
        # unstamped (no field), keeping the disclosure meaningful.
        items, by_id = self._queue_and_registry()
        policy_by_ds: dict = {}
        stamped = 0
        for item in items:
            ds = (item.get("dataset_id") or item.get("corpus_id")
                  or (item.get("corpus") or {}).get("id"))
            entry = by_id.get(ds) if ds else None
            if entry is None:
                continue
            if ds not in policy_by_ds:
                policy_by_ds[ds] = resolve_transmission_policy(
                    ds, registry_entry=entry)
            pol = policy_by_ds[ds]
            stamp = item.get("transmission")
            if pol.restricted:
                assert isinstance(stamp, dict), (
                    ds, "restricted item published without a transmission "
                        "stamp")
                assert stamp.get("policy") == pol.mode, (ds, stamp)
                assert (stamp.get("openrouter_provider_prefs")
                        == OPENROUTER_RESTRICTED_PROVIDER_PREFS), (ds, stamp)
                stamped += 1
            else:
                assert stamp is None, (
                    ds, "cleared corpus must not carry a transmission stamp")
        # Fixture-rot guard: today's queue carries the WMT no-train lane,
        # so this test must actually exercise. A queue with zero restricted
        # items means the lane was retired — revisit this pin consciously
        # rather than letting the test idle green.
        assert stamped, (
            "no restricted items in queue.json — if the no-train lane was "
            "deliberately retired, update this test alongside that change")


# ---------------------------------------------------------------------------
# Regression: the consent gate must not be bypassable by running a REGISTERED
# corpus by file path, or by a corpus whose envelope declares someone else's
# license. Both routes previously resolved to `no-train` and the run proceeded.
# ---------------------------------------------------------------------------

class TestDeclaredEnvelopeLicense:
    """An envelope's DECLARED license is the upstream's statement of terms and
    is classified on the same ladder as a registry entry's — the caller does
    not get to treat it as their own unlicensed private data."""

    def test_declared_licenseref_is_consent_required(self):
        for lic in ("LicenseRef-EdTeKLA-Modified-CC-BY-NC-SA-4.0",
                    "LicenseRef-NusaWrites-Unstated-Data-License",
                    "LicenseRef-AmericasNLP-Mixed-ResearchUse",
                    "LicenseRef-TWB-Gamayun"):
            pol = resolve_transmission_policy(
                "", registry_entry=None, corpus_meta={"license": lic})
            assert pol.mode == MODE_CONSENT_REQUIRED, lic

    def test_declared_standard_nc_is_no_train(self):
        pol = resolve_transmission_policy(
            "", registry_entry=None, corpus_meta={"license": "CC-BY-NC-4.0"})
        assert pol.mode == MODE_NO_TRAIN

    def test_declared_cleared_license_stays_cleared(self):
        pol = resolve_transmission_policy(
            "", registry_entry=None, corpus_meta={"license": "CC-BY-4.0"})
        assert pol.mode == MODE_CLEARED

    def test_no_declared_license_keeps_the_private_corpus_pillar(self):
        """The caller's own unlabelled corpus still runs, privacy-pinned."""
        pol = resolve_transmission_policy(
            "", registry_entry=None, corpus_meta={})
        assert pol.mode == MODE_NO_TRAIN
        pol = resolve_transmission_policy(
            "", registry_entry=None, corpus_meta={},
            allow_data_collection_unregistered=True)
        assert pol.mode == MODE_CLEARED

    def test_allow_data_collection_cannot_clear_a_declared_third_party_license(self):
        """--allow-data-collection affirms the CALLER's rights; a corpus that
        names someone else's grant is not the caller's to clear."""
        pol = resolve_transmission_policy(
            "", registry_entry=None,
            corpus_meta={"license": "LicenseRef-EdTeKLA-Modified-CC-BY-NC-SA-4.0"},
            allow_data_collection_unregistered=True)
        assert pol.mode == MODE_CONSENT_REQUIRED
        pol = resolve_transmission_policy(
            "", registry_entry=None, corpus_meta={"license": "CC-BY-NC-4.0"},
            allow_data_collection_unregistered=True)
        assert pol.mode == MODE_NO_TRAIN

    def test_sealed_envelope_still_wins_over_a_declared_license(self):
        pol = resolve_transmission_policy(
            "", registry_entry=None,
            corpus_meta={"license": "CC-BY-4.0", "segment": "held_out"})
        assert pol.mode == MODE_SEALED


class TestRegisteredCorpusRunByFilePath:
    """A registered corpus must hit its registry entry however it is named.

    Regression: `mt-eval run --corpus arena/datasets/curated/eng-crk-dev-v1.json`
    (the path EdTeKLA is fetched to) resolved no dataset id, fell into the
    unregistered branch, and transmitted a quarantined, sovereignty-scoped
    corpus to a remote API under `no-train`. It must resolve SEALED and refuse.
    """

    def _entry(self, corpus_path, corpus_meta=None):
        from mt_eval_harness.publish import registry_entry_for_run
        return registry_entry_for_run(
            "", corpus_path=corpus_path, corpus_meta=corpus_meta or {})

    def test_edtekla_path_resolves_its_registry_entry(self):
        dsid, entry = self._entry("arena/datasets/curated/eng-crk-dev-v1.json")
        assert entry is not None, "EdTeKLA path resolved no registry entry"
        assert dsid == "eval-eng-crk-edtekla-dev-v1"
        assert entry.get("license") == \
            "LicenseRef-EdTeKLA-Modified-CC-BY-NC-SA-4.0"

    def test_edtekla_path_run_is_sealed_and_refuses_remote(self):
        """The envelope edtekla_adapter writes carries `dataset.name` and no
        license — the exact shape that used to defeat the gate."""
        meta = {"name": "edtekla-dev-v1", "version": "1.0",
                "source_attribution": "EDTeKLA Project", "access": "private"}
        dsid, entry = self._entry(
            "arena/datasets/curated/eng-crk-dev-v1.json", meta)
        pol = resolve_transmission_policy(
            dsid, registry_entry=entry, corpus_meta=meta)
        assert pol.mode == MODE_SEALED, pol.reason
        with pytest.raises(RuntimeError):
            enforce_transmission_policy(
                pol, provider_name="openrouter",
                provider_supports_restricted=True,
                provider_basis="openrouter data_collection=deny",
                has_external_method=False)

    def test_unregistered_path_is_still_unregistered(self):
        """The private-corpus pillar: an unknown path resolves no entry."""
        _dsid, entry = self._entry("/tmp/my-own-corpus.json")
        assert entry is None


class TestHeldOutBenchmarkIsDeclaredNotNamed:
    """No dataset earns held-out status by having its name written into code.

    Regression: `HELD_OUT_BENCHMARK_CARD_MARKERS = ("edtekla",)` forced one
    named corpus to contamination=HIGH by id substring — the exact
    "never hardcode language-specific sets in code" rule this repo holds
    everywhere else. Status is now declared on the card.
    """

    def _fn(self):
        import importlib.util
        from pathlib import Path
        path = (Path(__file__).resolve().parent.parent
                / "scripts" / "build_registry.py")
        spec = importlib.util.spec_from_file_location("_build_registry", path)
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        return mod

    def test_no_card_id_is_pattern_matched(self):
        mod = self._fn()
        assert not hasattr(mod, "HELD_OUT_BENCHMARK_CARD_MARKERS")
        # An id that used to trip the marker is now unremarkable on its own.
        assert mod.is_held_out_benchmark(
            None, "development", "eval-eng-crk-edtekla-dev-v1") is False

    def test_the_declaration_forces_held_out_for_any_corpus(self):
        mod = self._fn()
        for cid in ("eval-eng-crk-edtekla-dev-v1", "eval-xxx-yyy-anything-v1"):
            assert mod.is_held_out_benchmark(
                None, "development", cid, declared_held_out=True) is True

    def test_family_and_test_split_rules_are_unchanged(self):
        mod = self._fn()
        assert mod.is_held_out_benchmark("flores", "devtest", "x") is True
        assert mod.is_held_out_benchmark(None, "test", "x") is True
        assert mod.is_held_out_benchmark(None, "test", "x",
                                         fresh_blind=True) is False
        # fresh_blind never rescues a declared held-out set.
        assert mod.is_held_out_benchmark(None, "test", "x", fresh_blind=True,
                                         declared_held_out=True) is True

    def test_the_edtekla_cards_carry_the_declaration(self):
        """Mechanism changed, policy did not: the cards that were forced HIGH
        by the marker now declare it themselves."""
        import json
        from pathlib import Path
        cards = (Path(__file__).resolve().parent.parent.parent
                 / "cli" / "shared" / "corpora-cards")
        for f in cards.glob("*edtekla*.json"):
            assert json.loads(f.read_text())["heldOutBenchmark"] is True, f.name
