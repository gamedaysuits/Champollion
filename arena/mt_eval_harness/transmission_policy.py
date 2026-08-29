"""
Transmission policy — which corpora may be SENT to which model APIs, and
which may not be sent at all without recorded upstream permission.

Publishing guards (migrations 033/051, publish.py) control what corpus
content is *redistributed* on the public board. This module controls the
step before that: whether corpus content may be *transmitted* to a
third-party model API at run time, and through which channel.

THE RULE (founder direction 2026-07-19, recorded in champollion.dev/docs/network/sovereignty/data-sovereignty
§"Transmission to model APIs"). Champollion does not interpret ambiguous or
community-scoped licenses on the upstream's behalf — under a modified /
sovereignty-scoped / bespoke / unstated grant, whether evaluation-by-LLM is
a permitted use is the RIGHTS-HOLDER's call. Model outputs over corpus
sentences are derivatives; an eval run manufactures them at scale. So:

  • ``cleared``           — redistribution-cleared license: no constraint.
  • ``no-train``          — plain standard SPDX NC/ND license (the license
                            itself unambiguously permits non-commercial
                            reproduction): remote evaluation allowed ONLY
                            over channels that do not TRAIN on inputs
                            (OpenRouter pinned to ``data_collection: deny``,
                            first-party vendor APIs, or local).
                            SCOPE, stated exactly (corrected 2026-08-21):
                            this is a no-TRAINING guarantee, not a
                            no-RETENTION one. OpenRouter separates the two
                            axes and documents providers that do not train
                            on inputs but do retain them; non-retention
                            requires ``provider.zdr: true``, which we
                            deliberately do not send (see the constant
                            below). Do not describe this lane as
                            "does not retain".
  • ``consent-required``  — LicenseRef-* / modified / bespoke / unstated
                            licenses (EdTeKLA, WMT-Research-Use,
                            TWB-Gamayun, AmericasNLP-Mixed,
                            NusaWrites-Unstated, …): remote evaluation
                            REFUSES until the dataset's registry entry
                            carries an explicit ``transmission_consent``
                            grant (recorded by the founder/steward lane —
                            never assumed, never inferred from "probably
                            academic use"). ``--provider local`` remains
                            possible: nothing leaves the machine.
  • ``sealed``            — held-out / gold-standard segments and
                            quarantined sets: remote evaluation REFUSES
                            unconditionally (no consent override in code —
                            a blind set sent to a third party is exposed
                            regardless of that party's training policy).

Fail-safe posture for unregistered corpora: a corpus that declares NO
license runs under ``no-train`` privacy-pinned routing by default (it is
typically the caller's own data; the private-corpus pillar must keep
working), and ``--allow-data-collection`` lifts the pin for such a corpus.
A corpus whose envelope DOES declare a license is classified by that
license on the same ladder as a registry entry — cleared / standard-NC
no-train / consent-required — because the declaration is the upstream's
statement of terms, not the caller's. ``--allow-data-collection`` cannot
reach past a declared third-party license. A sealed envelope declaration
is honored either way.

Explicit per-dataset overrides live in the DATA, not in code: a corpora
card / registry entry may set ``transmission_policy`` to ``"no-train"`` or
``"consent-required"`` (recording WHY in its notes), and a granted
permission is recorded as a ``transmission_consent`` object
(``{"granted_by", "date", "scope", "evidence"}``). Absent those fields,
the license-string default above applies.

The license classifier is publish.py's ``_license_is_redistributable`` —
the client twin of the DB's ``is_license_redistributable`` (migration 033).
This module deliberately adds no third copy of that logic.
"""

from __future__ import annotations

from dataclasses import dataclass, field


# OpenRouter request-body preference that restricts routing to providers
# that do not collect prompts for training. Verified against the OpenRouter
# provider-routing docs 2026-07-19, re-verified 2026-08-21
# (`provider.data_collection`: "allow" | "deny").
#
# DELIBERATE SCOPE — do not "fix" this by adding zdr without a founder call.
# `data_collection: deny` governs the COLLECTION/TRAINING axis. A stricter
# `zdr: true` (zero data retention) also exists — 762 endpoints / 282 models
# / 48 providers as of 2026-08-21 — but it shrinks the provider pool further
# than the no-TRAINING guarantee requires, and the rule this module enforces
# is a no-training rule. Two caveats that belong in any claim made about it:
# provider ZDR is a self-declared boolean in the provider's own model
# document (OpenRouter's own docs call the data-policy tag "not a definitive
# source"), and the guarantee is best-effort rather than contractual absent
# a DPA. See docs/competitive/14_openrouter.md.
OPENROUTER_RESTRICTED_PROVIDER_PREFS: dict = {"data_collection": "deny"}

# Sealed segments whose content must never reach a remote channel
# (same set the publish entry-gate seals).
_SEALED_SEGMENTS = frozenset({"held_out", "gold_standard"})

# Plain, unmodified SPDX Creative Commons restricted ids. These licenses'
# TEXTS are standard and unambiguous: non-commercial reproduction is within
# the grant, so remote evaluation runs under the no-train channel rule
# without a per-dataset permission. Anything not in this set and not
# redistribution-cleared — every LicenseRef-*, bespoke, modified, or
# unstated license — is consent-required by default. Keep this list to
# STANDARD ids only; never add a LicenseRef here (per-dataset overrides
# belong in the card data, with their rationale).
STANDARD_RESTRICTED_SPDX = frozenset({
    "CC-BY-NC-4.0", "CC-BY-NC-3.0", "CC-BY-NC-2.0",
    "CC-BY-NC-SA-4.0", "CC-BY-NC-SA-3.0",
    "CC-BY-NC-ND-4.0", "CC-BY-NC-ND-3.0",
    "CC-BY-ND-4.0", "CC-BY-ND-3.0",
})

# Modes
MODE_CLEARED = "cleared"
MODE_NO_TRAIN = "no-train"
MODE_CONSENT_REQUIRED = "consent-required"
MODE_SEALED = "sealed"

# Data-side override values a registry entry / card may carry.
_VALID_ENTRY_OVERRIDES = frozenset({MODE_NO_TRAIN, MODE_CONSENT_REQUIRED})


@dataclass
class TransmissionPolicy:
    """Resolved transmission policy for one run.

    Serialized into the RunLog / run card (``as_provenance``) so every
    result records which channel discipline it ran under.
    """

    mode: str
    reason: str
    # Preferences the OpenRouter proxy channel must attach when restricted.
    provider_prefs: dict | None = field(default=None)
    # The consent grant honored (verbatim from the registry), if any.
    consent: dict | None = field(default=None)

    @property
    def restricted(self) -> bool:
        """Any mode that constrains transmission (kept for back-compat)."""
        return self.mode != MODE_CLEARED

    def as_provenance(self) -> dict:
        out = {
            "mode": self.mode,
            "restricted": self.restricted,
            "reason": self.reason,
            "openrouter_provider_prefs": self.provider_prefs,
        }
        if self.consent is not None:
            out["consent"] = self.consent
        return out


def _consent_grant(entry: dict) -> dict | None:
    """Return the entry's transmission_consent block iff it is a real grant."""
    grant = entry.get("transmission_consent")
    if isinstance(grant, dict) and grant.get("granted_by") and grant.get("date"):
        return grant
    return None


def resolve_transmission_policy(
    dataset_id: str,
    *,
    registry_entry: dict | None = None,
    corpus_meta: dict | None = None,
    allow_data_collection_unregistered: bool = False,
) -> TransmissionPolicy:
    """Classify a run's corpus into a transmission mode.

    Args:
        dataset_id: canonical dataset id ("" when unknown).
        registry_entry: the datasets-registry row for this corpus, or None
            when unregistered. Authoritative when present.
        corpus_meta: the corpus file's own envelope metadata (may carry a
            ``license`` / ``segment`` for unregistered local corpora).
        allow_data_collection_unregistered: caller affirms rights over an
            UNREGISTERED corpus and lifts the privacy-pinned routing. Has no
            effect on a registered corpus.
    """
    # Import inside the function: publish.py pulls auth/urllib at module
    # import; the runner should not pay that (or any future) import cost
    # until a policy is actually resolved.
    from mt_eval_harness.publish import _license_is_redistributable

    prefs = dict(OPENROUTER_RESTRICTED_PROVIDER_PREFS)

    entry = registry_entry
    if entry is not None:
        if entry.get("quarantine"):
            qreason = entry.get("quarantine_reason") or "quarantined"
            return TransmissionPolicy(
                MODE_SEALED, f"dataset is quarantined ({qreason})",
                provider_prefs=prefs)
        seg = (entry.get("segment") or "").strip().lower()
        if seg in _SEALED_SEGMENTS:
            return TransmissionPolicy(
                MODE_SEALED, f"segment '{seg}' is sealed",
                provider_prefs=prefs)

        lic = entry.get("license")
        if _license_is_redistributable(lic):
            return TransmissionPolicy(
                MODE_CLEARED,
                f"registered corpus '{dataset_id}' with redistribution-"
                f"cleared license '{lic}'")

        # Restricted from here down. Order: recorded consent grant →
        # explicit data-side override → license-string default.
        grant = _consent_grant(entry)
        if grant is not None:
            return TransmissionPolicy(
                MODE_NO_TRAIN,
                f"license '{lic}' with recorded upstream permission "
                f"(granted by {grant.get('granted_by')}, "
                f"{grant.get('date')}) — no-train channels only",
                provider_prefs=prefs, consent=grant)

        override = (entry.get("transmission_policy") or "").strip().lower()
        if override in _VALID_ENTRY_OVERRIDES:
            return TransmissionPolicy(
                override,
                f"license '{lic}': explicit data-side transmission_policy="
                f"'{override}' on the registry entry",
                provider_prefs=prefs)

        if (lic or "").strip() in STANDARD_RESTRICTED_SPDX:
            return TransmissionPolicy(
                MODE_NO_TRAIN,
                f"standard non-commercial license '{lic}' — no-train "
                "channels only",
                provider_prefs=prefs)

        return TransmissionPolicy(
            MODE_CONSENT_REQUIRED,
            f"license '{lic or 'unknown'}' is a modified/bespoke/unstated "
            "grant — remote evaluation needs the rights-holder's recorded "
            "permission (transmission_consent on the dataset entry)",
            provider_prefs=prefs)

    # Unregistered corpus: the caller's own data by default. The
    # private-corpus pillar keeps working — runs proceed privacy-pinned.
    meta = corpus_meta or {}
    seg = (str(meta.get("segment") or "")).strip().lower()
    if seg in _SEALED_SEGMENTS:
        return TransmissionPolicy(
            MODE_SEALED, f"corpus envelope declares sealed segment '{seg}'",
            provider_prefs=prefs)
    lic = str(meta.get("license") or "").strip()
    if lic and _license_is_redistributable(lic):
        return TransmissionPolicy(
            MODE_CLEARED,
            f"unregistered corpus with redistribution-cleared envelope "
            f"license '{lic}'")
    # A DECLARED, non-cleared license on the envelope is the upstream's own
    # statement about its terms — classify it exactly as a registry entry's
    # license is classified, rather than treating the corpus as the caller's
    # unlicensed private data. Without this, a corpus file self-declaring
    # 'LicenseRef-EdTeKLA-Modified-CC-BY-NC-SA-4.0' resolved to `no-train`
    # (remote evaluation permitted) instead of `consent-required`, and
    # --allow-data-collection promoted it all the way to `cleared`.
    # --allow-data-collection cannot reach past a declared third-party
    # license: the flag affirms the CALLER's rights, and a corpus that names
    # someone else's grant is not the caller's to clear.
    if lic:
        if lic in STANDARD_RESTRICTED_SPDX:
            return TransmissionPolicy(
                MODE_NO_TRAIN,
                f"unregistered corpus declaring standard non-commercial "
                f"license '{lic}' — no-train channels only",
                provider_prefs=prefs)
        return TransmissionPolicy(
            MODE_CONSENT_REQUIRED,
            f"unregistered corpus declaring license '{lic}', a modified/"
            "bespoke/unstated grant — remote evaluation needs the rights-"
            "holder's recorded permission (register the corpus and record "
            "transmission_consent on its entry), or run --provider local",
            provider_prefs=prefs)
    if allow_data_collection_unregistered:
        return TransmissionPolicy(
            MODE_CLEARED,
            "unregistered corpus with no declared license; "
            "--allow-data-collection override "
            "(caller affirms rights over this corpus)")
    return TransmissionPolicy(
        MODE_NO_TRAIN,
        "unregistered corpus (no cleared license on the envelope) — "
        "privacy-pinned no-train routing by default; pass "
        "--allow-data-collection only for a corpus you hold the rights to",
        provider_prefs=prefs)


def enforce_transmission_policy(
    policy: TransmissionPolicy,
    *,
    provider_name: str | None,
    provider_supports_restricted: bool,
    provider_basis: str,
    has_external_method: bool,
    attest_local_transport: bool = False,
    local_transport_verified: bool = False,
) -> dict:
    """Apply a resolved policy to the run's actual channel.

    Returns the provenance dict to store on the config (with
    ``enforced`` / ``channel_basis`` / notice fields filled in), or raises
    RuntimeError when the run must not proceed.

    ``provider_name`` is None when an external method owns the transport.
    ``local_transport_verified`` is the caller's PROOF of locality: True only
    when the provider is the local provider AND its endpoint is verifiably
    loopback (``LocalProvider.is_loopback_endpoint()``). The provider NAME is
    never trusted on its own — ``--provider local --base-url https://…``
    points a "local" run at a remote host, and sealed/consent-required text
    must refuse that channel rather than stamp "nothing leaves the machine".
    """
    prov = policy.as_provenance()

    if policy.mode == MODE_CLEARED:
        prov["enforced"] = True
        return prov

    # Locality is the caller's verified claim about the ENDPOINT, never an
    # inference from the provider's name (see docstring).
    is_local = bool(local_transport_verified)

    if policy.mode in (MODE_CONSENT_REQUIRED, MODE_SEALED):
        if has_external_method:
            if attest_local_transport:
                prov["enforced"] = True
                prov["channel"] = "external-method"
                prov["local_transport_attested"] = True
                return prov
            raise RuntimeError(
                f"Transmission policy ({policy.mode}): {policy.reason}. "
                "This run delegates transport to an external method, and "
                "the harness cannot verify nothing leaves the machine. "
                "If the method's transport is fully local, re-run with "
                "--attest-local-transport (recorded in the RunLog). "
                "Remote evaluation of this corpus is refused"
                + ("" if policy.mode == MODE_SEALED else
                   " until the rights-holder's permission is recorded on "
                   "the dataset entry (transmission_consent — founder/"
                   "steward lane)")
                + ". See champollion.dev/docs/network/sovereignty/data-sovereignty §'Transmission to model "
                "APIs'."
            )
        if is_local:
            prov["enforced"] = True
            prov["channel_basis"] = provider_basis
            prov["note"] = "local endpoint — nothing leaves the machine"
            return prov
        raise RuntimeError(
            f"Transmission policy ({policy.mode}): {policy.reason}. "
            "Remote evaluation of this corpus is refused"
            + ("" if policy.mode == MODE_SEALED else
               " until the rights-holder's explicit permission is recorded "
               "on the dataset entry (transmission_consent — founder/"
               "steward lane; never assumed)")
            + ". "
            + ("The provider is named 'local' but its endpoint is not a "
               "loopback address — a remote base_url (or LOCAL_API_BASE/"
               "OPENAI_API_BASE) sends this text off-machine, so it does "
               "not count as local. Point --provider local at a loopback "
               "endpoint (e.g. http://localhost:11434/v1). "
               if provider_name == "local" else
               "Run locally instead: --provider local. ")
            + "See champollion.dev/docs/network/sovereignty/data-sovereignty §'Transmission to model "
            "APIs'."
        )

    # MODE_NO_TRAIN
    if has_external_method:
        prov["enforced"] = False
        prov["channel"] = "external-method"
        return prov
    if provider_name is not None and not provider_supports_restricted:
        raise RuntimeError(
            f"Transmission policy: this corpus is restricted "
            f"({policy.reason}) but provider '{provider_name}' declares no "
            "no-train channel basis (supports_restricted_transmission="
            "False). Use the default OpenRouter provider (pinned to "
            "data_collection=deny), a first-party provider "
            "(openai/anthropic/gemini), or --provider local. "
            "See champollion.dev/docs/network/sovereignty/data-sovereignty §'Transmission to model APIs'."
        )
    prov["enforced"] = True
    prov["channel_basis"] = (
        provider_basis if provider_name is not None
        else "OpenRouter routing pinned to data_collection=deny providers")
    return prov
