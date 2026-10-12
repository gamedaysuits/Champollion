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

A steward can mark ANY corpus local-only — ``"transmission": "local-only"``
in its JSON envelope, in a sidecar ``<file>.champollion.json`` next to a
TSV / JSONL / text file, or on its registry entry. That seals it (only a
loopback endpoint may see the text) regardless of license, and nothing
can loosen it.

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

# A steward's mark (corpus_loader.LOCAL_ONLY carries the same word; kept as a
# literal so this module imports nothing from the loader).
LOCAL_ONLY_TIER = "local-only"


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
    # The corpus's own tier when it is narrower than the mode: a steward's
    # "local-only" mark resolves to MODE_SEALED (same enforcement), but a
    # message that calls a local-only file "sealed" names the wrong thing
    # (synthetic hospital persona, 2026-10-03). Empty = the mode says it.
    tier: str = ""

    @property
    def restricted(self) -> bool:
        """Any mode that constrains transmission (kept for back-compat)."""
        return self.mode != MODE_CLEARED

    @property
    def label(self) -> str:
        """What to call this corpus's protection in a message."""
        return self.tier or self.mode

    def as_provenance(self) -> dict:
        out = {
            "mode": self.mode,
            "restricted": self.restricted,
            "reason": self.reason,
            "openrouter_provider_prefs": self.provider_prefs,
        }
        if self.tier:
            out["tier"] = self.tier
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

    # A data steward's local-only mark (corpus envelope, steward sidecar
    # <file>.champollion.json, or registry entry) seals the corpus whatever
    # its license: only a model on this machine may see it. It can only ever
    # tighten — checked before every rule that could loosen.
    for where, block in (("registry entry", registry_entry or {}),
                         ("corpus metadata", corpus_meta or {})):
        if str(block.get("transmission") or "").strip().lower() == "local-only":
            return TransmissionPolicy(
                MODE_SEALED,
                f"the data's steward marked it local-only ({where}) — only a "
                "model on this machine may see it",
                provider_prefs=prefs, tier=LOCAL_ONLY_TIER)

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
    endpoint: str | None = None,
    in_process_method: str | None = None,
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
    ``endpoint`` is the URL the provider would send to, named in a refusal
    so the message points at the real problem (the endpoint, not the
    provider name).

    ``in_process_method`` names one of the HARNESS'S OWN adapters that
    translates inside this process (``in_process_transport`` on the adapter
    class — today ``local-model``: transformers / CTranslate2 loaded here).
    No request carries a sentence anywhere, so it is local transport by
    construction and needs no operator attestation; downloading model
    weights moves files, never corpus text. A third-party method plugin or a
    service-backed engine is never this: it stays ``has_external_method``.
    """
    prov = policy.as_provenance()

    # The operator's attestation is RECORDED whatever the corpus's mode: it
    # is what a plugin run's recorded provider rests on
    # (config.recorded_api_provider → "local"). It used to be written only
    # for sealed/consent-required corpora, so on a cleared corpus the flag
    # vanished from the RunLog while the run still claimed it.
    if has_external_method and attest_local_transport:
        prov["local_transport_attested"] = True

    if policy.mode == MODE_CLEARED:
        prov["enforced"] = True
        return prov

    # The harness's own in-process adapter: local by construction (see the
    # docstring) — enforced for every restricted mode, sealed included,
    # without an attestation (synthetic researcher, Round 5: a local-only
    # corpus refused `--method local-model` unless the operator attested a
    # transport the harness itself runs).
    if in_process_method:
        prov["enforced"] = True
        prov["channel"] = "in-process"
        prov["channel_basis"] = (
            f"the harness's own {in_process_method} adapter, run in this "
            f"process — no sentence leaves the machine (model weights are "
            f"downloaded, never corpus text)")
        prov["note"] = "in-process model — nothing leaves the machine"
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
                f"Transmission policy ({policy.label}): {policy.reason}. "
                "This run delegates transport to an external method, and "
                "the harness cannot verify nothing leaves the machine. "
                "If the method's transport is fully local, re-run with "
                "--attest-local-transport (recorded in the RunLog). "
                "Remote evaluation of this corpus is refused"
                + ("" if policy.mode == MODE_SEALED else
                   " until the rights-holder's permission is recorded on "
                   "the dataset entry (transmission_consent, which the "
                   "dataset's steward records once the rights-holder "
                   "grants it)")
                + ". See champollion.dev/docs/network/sovereignty/data-sovereignty §'Transmission to model "
                "APIs'."
            )
        if is_local:
            prov["enforced"] = True
            prov["channel_basis"] = provider_basis
            prov["note"] = "local endpoint — nothing leaves the machine"
            return prov
        where = f" ({endpoint})" if endpoint else ""
        raise RuntimeError(
            f"Transmission policy ({policy.label}): {policy.reason}. "
            "Remote evaluation of this corpus is refused"
            + ("" if policy.mode == MODE_SEALED else
               " until the rights-holder's explicit permission is recorded "
               "on the dataset entry (transmission_consent, which the "
               "dataset's steward records once the rights-holder grants "
               "it — never assumed)")
            + ". "
            # --provider local WAS chosen: the problem is where it points,
            # so say that, not "use --provider local" (synthetic hospital
            # persona, 2026-10-03: --provider local --base-url https://
            # api.groq.com/… was told to "run locally instead").
            + (f"--provider local is set, but its endpoint{where} is not a "
               "loopback address: it is not on this machine, so the text "
               "would leave it. Only a loopback endpoint counts as local — "
               "localhost, 127.0.0.1, ::1 or a unix socket (a --base-url, "
               "LOCAL_API_BASE or OPENAI_API_BASE pointing anywhere else is "
               "another machine, a LAN box included). Point --base-url at a "
               "model served on this machine, e.g. "
               "http://localhost:11434/v1 (Ollama). "
               if provider_name == "local" else
               "Run locally instead: --provider local with a model served "
               "on this machine (e.g. --base-url http://localhost:11434/v1). ")
            + "See champollion.dev/docs/network/sovereignty/data-sovereignty §'Transmission to model "
            "APIs'."
        )

    # MODE_NO_TRAIN
    if has_external_method:
        prov["channel"] = "external-method"
        # An attested fully-local transport satisfies the no-train rule by
        # construction (nothing reaches a provider that could train on it) —
        # the same attestation the sealed lane accepts above. Without it the
        # harness cannot see the plugin's channel, and says so.
        prov["enforced"] = bool(attest_local_transport)
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


# ---------------------------------------------------------------------------
# Terminal output: a restricted corpus's sentences are not printed.
#
# The local-only promise is "this text does not leave this machine". The
# public guide is written for AI agents, and an agent reads the terminal and
# sends what it reads to its own model provider — so a command that PRINTS
# the nurse-checked sentences (compare's was/now diffs, an error that quotes
# the input) breaks the promise with the tool's own output (synthetic
# hospital persona, 2026-10-03). Every mode that refuses a remote model
# refuses the terminal too: the sentences are withheld and ids + scores are
# printed instead. Files the user writes into their own results directory
# (reports, RunLogs, comparison.json) are unchanged — only what is printed.
# ---------------------------------------------------------------------------

#: Modes whose corpus text is not printed (they refuse remote models).
TEXT_WITHHELD_MODES = frozenset({MODE_SEALED, MODE_CONSENT_REQUIRED})

#: The one opt-in that prints withheld sentences — for a human at the terminal.
SHOW_TEXT_FLAG = "--show-text"
SHOW_TEXT_HELP = (
    "Print corpus sentences even when the corpus is local-only, sealed or "
    "consent-required (otherwise ids and scores are printed instead). Only "
    "for a human at the terminal: an AI agent that reads this output sends "
    "it to its model provider.")


def withheld_text_reason(run_doc: dict | None) -> str:
    """Why a command must not print this run's corpus sentences, or ``""``.

    ``run_doc`` is a RunLog or a TestReport (both carry the run's ``config``;
    a RunLog also carries ``provenance``). Three signals, any one suffices:

    1. the transmission policy the run itself recorded
       (``config.transmission_policy.mode`` in TEXT_WITHHELD_MODES);
    2. a steward's local-only mark recorded with the corpus metadata
       (``provenance.dataset_meta.transmission``);
    3. a local-only mark on the corpus files as they are NOW (the sidecar or
       a JSON envelope) — a file marked after the run, or a run older than
       the recorded policy.

    An unreadable sidecar counts as a mark (a steward wrote it to restrict
    the data; a typo must not unlock it).
    """
    if not isinstance(run_doc, dict):
        return ""
    config = run_doc.get("config") or {}
    pol = config.get("transmission_policy") or {}
    if isinstance(pol, dict) and pol.get("mode") in TEXT_WITHHELD_MODES:
        label = pol.get("tier") or pol.get("mode")
        why = str(pol.get("reason") or "").strip()
        return f"{label} corpus" + (f" ({why})" if why else "")
    meta = ((run_doc.get("provenance") or {}).get("dataset_meta") or {})
    if str(meta.get("transmission") or "").strip().lower() == LOCAL_ONLY_TIER:
        return "local-only corpus (its steward marked it local-only)"
    paths = [config.get(k) for k in ("corpus_path", "source_file",
                                      "reference_file") if config.get(k)]
    if paths:
        from mt_eval_harness.corpus_loader import marked_local_only
        try:
            marked = marked_local_only(*paths)
        except ValueError as exc:
            return f"local-only status unreadable ({exc})"
        if marked:
            return "local-only corpus (its steward marked it local-only)"
    return ""


def withheld_note(reason: str) -> str:
    """The line a command prints where it withheld sentences."""
    return (f"Sentence text withheld: {reason}. Showing ids and scores. A "
            f"human at the terminal can pass {SHOW_TEXT_FLAG} to see the "
            f"text; an AI agent should not — what it reads goes to its model "
            f"provider.")


#: A quoted fragment this long is treated as the sentence it starts.
_QUOTE_PREFIX_CHARS = 24
#: Corpus strings shorter than this are not scrubbed (they collide with
#: ordinary words in error text).
_MIN_SCRUB_CHARS = 8
SCRUBBED = "[sentence withheld]"


def scrub_corpus_text(message: str, texts) -> str:
    """``message`` with every corpus sentence in ``texts`` replaced.

    For error text printed from a restricted run: provider errors carry the
    response body (``HTTP 400: …``), which can quote the request. The error
    stays readable ("HTTP 404: model not found" is unchanged) and any
    sentence — or a truncated quote of one, by its first
    ``_QUOTE_PREFIX_CHARS`` characters — becomes ``[sentence withheld]``.
    """
    out = str(message)
    candidates = sorted({str(t) for t in texts
                         if t and len(str(t).strip()) >= _MIN_SCRUB_CHARS},
                        key=len, reverse=True)
    for t in candidates:
        if t in out:
            out = out.replace(t, SCRUBBED)
    for t in candidates:
        prefix = t[:_QUOTE_PREFIX_CHARS]
        if len(t) > _QUOTE_PREFIX_CHARS and prefix in out:
            # Replace from the prefix to the end of the quoted run (the next
            # quote mark / newline, or the end of the message).
            start = out.index(prefix)
            end = len(out)
            for stop in ('"', "'", "\n", "\\n"):
                j = out.find(stop, start + len(prefix))
                if j != -1:
                    end = min(end, j)
            out = out[:start] + SCRUBBED + out[end:]
    return out
