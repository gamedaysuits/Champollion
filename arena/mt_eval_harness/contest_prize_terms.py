"""contest_prize_terms — the prize DISPOSITION: one term, said the way a
participant would say it, with its detail derived rather than assembled.

Founder ruling (R1-trinary, 2026-09-07)
---------------------------------------
    "I think it should be kinda trinary: 'pass to holders' / 'retain IP' /
    'release open' options."

That replaces the four-dimension matrix (and its named presets) as the
HEADLINE. A prized contest declares ``metadata.prize_terms.disposition``, one
of:

``pass_to_holders``
    The method — weights or code — passes to the sovereign benchmark holders.
    They score it and keep it, regardless of who wins. This is the strict end,
    stated plainly rather than implied.
``retain_ip``
    The participant keeps ownership. The host scores the entry and keeps at
    most a sealed copy for audit and reproduction; an organizer may narrow
    that to deleting the artifact once it is scored.
``release_open``
    The participant keeps ownership but must publish the method under an open
    licence; that release is the prize condition. The organizer chooses when
    the release falls due and may name the licence.

What is NOT a choice (ruling R2, unchanged)
-------------------------------------------
The EXECUTION mode. A contest entry is Lane A (weights, ``submit-model``) or
Lane B (code, ``submit-method``) executed by the organizer's air-gapped node
on the sealed set. Handing the artifact to that node in order for it to be
scored is inherent to sovereign hosting — it is what "the host measured it"
means — and no contest can opt out of it. The disposition is about what
happens to the artifact AFTERWARDS.

The derived detail
------------------
Behind each disposition sit the four dimensions the rest of the system already
works in — ``retention``, ``rights``, ``host_use``, ``release`` (plus
``release_license``) — filled in from
``contest_policy.PRIZE_DISPOSITION_DERIVED``. An organizer never writes
``rights`` or ``host_use``: a hand-written copy of a derived value is a second
source of truth waiting to disagree with the first, so writing one is refused
by name. Two dimensions accept a narrow, named override and that is the whole
of the dial:

* ``retain_ip`` may set ``retention: delete_after_scoring``;
* ``release_open`` may set ``release`` to ``required_before_scores`` |
  ``required_before_prize`` | ``required_after_prize``, and must name a
  ``release_license`` (an SPDX identifier or ``any_osi``, which is the default
  when it is omitted).

``community_terms_url`` (https) is declarable on any disposition.

RETIRED 2026-09-07: the presets ``open`` / ``audit`` / ``community`` /
``strict`` and ``from_preset``. ``from_preset`` still exists only to raise and
point at the disposition, so an old call site fails with the answer rather
than an AttributeError.

The hash is the point
---------------------
``terms_sha256(terms)`` is canonical JSON over the FULLY DERIVED dict, so the
declared spelling an organizer writes (``{"disposition": "retain_ip"}``) and
the derived dict a ranking snapshot froze hash identically, and any change to
the disposition or to any override changes the hash. That hash is what a
participant ACCEPTS (``--accept-terms`` on ``submit-method`` /
``submit-model``, carried on the manifest as
``submission.acceptedPrizeTermsSha256`` and therefore covered by
``method_sha``). Migration 074 freezes ``metadata.prize_terms`` the moment a
contest has entries, so the hash a participant accepted is the hash the
contest is still promising — and the organizer node refuses a bundle whose
accepted hash does not match.

What the platform verifies and what it cannot
---------------------------------------------
``prize_gate(terms)`` derives the verifications a payout requires:

* ``handover_verified`` — always. The node holds the artifact
  (``authorization_requests.method_sha``) and the request produced a published
  card. This one the platform measures.
* ``release_verified`` — when the release falls due before scores or before
  the prize (``release_open``). The organizer records ``release_url`` +
  ``release_sha256`` in ``contests.metadata.prize_terms_execution[<entry>]``;
  the platform checks PRESENCE and SHAPE. It never fetches the URL: a ranker
  that reached out to the network would make a frozen result depend on someone
  else's uptime.
* ``assignment_recorded`` — under ``pass_to_holders``. An assignment is an
  instrument signed OUTSIDE this platform; the organizer records
  ``assignment_instrument_url`` + ``assignment_recorded_at``, and the platform
  verifies that a record EXISTS. **It never verifies law.**

``release='required_after_prize'`` is deliberately NOT a gate step: an
obligation that falls due after payout cannot be a precondition of payout.
``describe()`` says so out loud.
"""

from __future__ import annotations

import hashlib
import json
import re
from urllib.parse import urlsplit

from mt_eval_harness.contest_policy import (
    PRIZE_DECLARED_KEYS,
    PRIZE_DERIVED_ONLY_KEYS,
    PRIZE_DIMENSIONS,
    PRIZE_DISPOSITION_DERIVED,
    PRIZE_DISPOSITION_HEADLINES,
    PRIZE_DISPOSITION_KEY,
    PRIZE_DISPOSITION_OVERRIDES,
    PRIZE_DISPOSITIONS,
    PRIZE_ENUM_DIMENSIONS,
    PRIZE_EXECUTION_FIELDS,
    PRIZE_EXECUTION_KEY,
    PRIZE_GATE_STEPS,
    PRIZE_HOST_USE,
    PRIZE_MONEY_KEYS,
    PRIZE_MONEY_METADATA_KEYS,
    PRIZE_RELEASE,
    PRIZE_RELEASE_LICENSE_ANY,
    PRIZE_RETENTION,
    PRIZE_RETIRED_KEYS,
    PRIZE_RIGHTS,
    PRIZE_UNIVERSAL_KEYS,
)

__all__ = [
    "DISPOSITIONS",
    "DISPOSITION_KEY",
    "DISPOSITION_DERIVED",
    "DISPOSITION_OVERRIDES",
    "DISPOSITION_HEADLINES",
    "DIMENSIONS",
    "ENUM_DIMENSIONS",
    "DECLARED_KEYS",
    "DERIVED_ONLY_KEYS",
    "GATE_STEPS",
    "EXECUTION_KEY",
    "EXECUTION_FIELDS",
    "RETENTION",
    "RIGHTS",
    "HOST_USE",
    "RELEASE",
    "RELEASE_LICENSE_ANY",
    "RELEASE_REQUIRED_VALUES",
    "PrizeTermsError",
    "parse_prize_terms",
    "normalize_prize_terms",
    "declared_prize_terms",
    "from_preset",
    "terms_sha256",
    "describe",
    "prize_gate",
    "money_declared_without_terms",
    "execution_record",
]

# Re-exported under the names this module's own callers read, so nothing else
# has to know the contest_policy prefixes.
DISPOSITIONS = PRIZE_DISPOSITIONS
DISPOSITION_KEY = PRIZE_DISPOSITION_KEY
DISPOSITION_DERIVED = PRIZE_DISPOSITION_DERIVED
DISPOSITION_OVERRIDES = PRIZE_DISPOSITION_OVERRIDES
DISPOSITION_HEADLINES = PRIZE_DISPOSITION_HEADLINES
DIMENSIONS = PRIZE_DIMENSIONS
ENUM_DIMENSIONS = PRIZE_ENUM_DIMENSIONS
DECLARED_KEYS = PRIZE_DECLARED_KEYS
DERIVED_ONLY_KEYS = PRIZE_DERIVED_ONLY_KEYS
GATE_STEPS = PRIZE_GATE_STEPS
EXECUTION_KEY = PRIZE_EXECUTION_KEY
EXECUTION_FIELDS = PRIZE_EXECUTION_FIELDS
RETENTION = PRIZE_RETENTION
RIGHTS = PRIZE_RIGHTS
HOST_USE = PRIZE_HOST_USE
RELEASE = PRIZE_RELEASE
RELEASE_LICENSE_ANY = PRIZE_RELEASE_LICENSE_ANY

#: The `release` values that mean "the participant must publish BEFORE the
#: prize is paid" — the ones a payout gate can actually check.
RELEASE_REQUIRED_VALUES: tuple[str, ...] = (
    "required_before_scores",
    "required_before_prize",
)

_SPDX_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9.+-]{0,63}$")
_SHA256_RE = re.compile(r"^[0-9a-f]{64}$")


class PrizeTermsError(ValueError):
    """Prize terms that cannot be read — always naming the offending values."""


# ---------------------------------------------------------------------------
# Plain-language vocabulary. ONE sentence per value, generated into every
# banner, report and public table — never re-worded per option, because two
# wordings of the same term are two terms.
# ---------------------------------------------------------------------------

VALUE_MEANINGS: dict[str, dict[str, str]] = {
    "disposition": dict(PRIZE_DISPOSITION_HEADLINES),
    "retention": {
        "delete_after_scoring":
            "the host deletes your method once it has been scored",
        "retain_sealed_audit":
            "the host keeps a sealed copy for audit and reproduction only",
        "retain":
            "the host keeps a working copy of your method",
    },
    "rights": {
        "participant_retains_all":
            "you keep every right in your method and none transfer",
        "license_to_host":
            "you keep ownership and grant the host a licence",
        "assignment_to_host":
            "ownership of the method is assigned to the host",
    },
    "host_use": {
        "evaluation_only":
            "the host may use it only to evaluate and reproduce this contest's "
            "result",
        "non_commercial":
            "the host may use it for any non-commercial purpose",
        "any":
            "the host may use it for any purpose, including commercially",
    },
    "release": {
        "not_required":
            "you are never required to publish your method",
        "required_before_scores":
            "you must publish your method before your scores are released",
        "required_before_prize":
            "you must publish your method before the prize is paid",
        "required_after_prize":
            "you must publish your method after the prize is paid",
    },
}

DIMENSION_LABELS: dict[str, str] = {
    "disposition": "The option the host chose",
    "retention": "What the host keeps",
    "rights": "Who owns it afterwards",
    "host_use": "What the host may use it for",
    "release": "Whether you must publish it",
    "release_license": "Under which licence you publish",
    "community_terms_url": "The host's own written terms",
}

#: Short labels for the three options, for a table's first column.
DISPOSITION_LABELS: dict[str, str] = {
    "pass_to_holders": "pass to holders",
    "retain_ip": "retain IP",
    "release_open": "release open",
}


# ---------------------------------------------------------------------------
# Shape helpers.
# ---------------------------------------------------------------------------

def _https_problem(url) -> str | None:
    """Why ``url`` is not an acceptable https URL, or None. Deliberately the
    same strictness ``contest_declarations.url_problem`` applies to a method
    release link — one rule for links a contest publishes."""
    if not isinstance(url, str):
        return f"must be a string URL (got {type(url).__name__})"
    if url.strip() != url:
        return "must not have leading or trailing whitespace"
    if not url:
        return "must not be empty (omit the key when there is no URL)"
    parts = urlsplit(url)
    if parts.scheme != "https":
        return f"must be an https:// URL (got scheme {parts.scheme or '(none)'!r})"
    if not parts.netloc:
        return "must have a host (https://<host>/…)"
    if "@" in parts.netloc:
        return "must not embed credentials in the host"
    if " " in url:
        return "must not contain spaces"
    return None


def _options() -> str:
    return " | ".join(DISPOSITIONS)


def _overrides_sentence(disposition: str) -> str:
    """What an organizer may still choose under this disposition, in words."""
    allowed = DISPOSITION_OVERRIDES.get(disposition) or {}
    parts = []
    for key, vocabulary in allowed.items():
        if vocabulary is None:
            parts.append(f"{key} (an SPDX identifier or "
                         f"{RELEASE_LICENSE_ANY!r})")
        else:
            parts.append(f"{key} ({' | '.join(vocabulary)})")
    parts.append(f"{PRIZE_UNIVERSAL_KEYS[0]} (an https:// link)")
    return (f"under disposition {disposition!r} the only keys you may declare "
            f"besides the disposition itself are: {', '.join(parts)}")


# ---------------------------------------------------------------------------
# parse / normalise / project.
# ---------------------------------------------------------------------------

def parse_prize_terms(obj) -> dict:
    """Validate one DECLARED ``contests.metadata.prize_terms`` and derive it.

    This is the DECLARATION door: what an organizer writes, and what migration
    074 accepts into the column. It takes ``{disposition, [retention],
    [release], [release_license], [community_terms_url]}`` and returns a NEW
    dict with every derived dimension filled in, in ``DIMENSIONS`` order, so
    every downstream reader (ranking, report, payout gate) keeps working on the
    dimensions.

    ``rights`` and ``host_use`` are refused as explicit keys: they follow from
    the disposition. Raises ``PrizeTermsError`` naming the disposition and the
    allowed overrides on anything else.
    """
    return _resolve(obj, lenient=False)


def normalize_prize_terms(obj) -> dict:
    """Like :func:`parse_prize_terms`, but also accepts an already-DERIVED dict.

    Snapshots, ranking dicts and this module's own output carry the full
    derived form (``rights``/``host_use`` included). Reading one back must not
    fail, so a derived key is accepted here when — and only when — it matches
    what the disposition derives; a derived key that DISAGREES with its
    disposition is still refused, loudly, because one of the two is a lie.
    """
    return _resolve(obj, lenient=True)


def declared_prize_terms(obj) -> dict:
    """The minimal, STORABLE spelling of these terms.

    What goes into ``contests.metadata.prize_terms``: the disposition, the
    override keys that disposition actually allows, and the host's own terms
    URL. Derived detail is never written to the database — it is recomputed on
    every read from the one key that was chosen.
    """
    terms = _resolve(obj, lenient=True)
    disposition = terms["disposition"]
    out: dict = {"disposition": disposition}
    for key in DISPOSITION_OVERRIDES.get(disposition) or {}:
        if key in terms:
            out[key] = terms[key]
    for key in PRIZE_UNIVERSAL_KEYS:
        if key in terms:
            out[key] = terms[key]
    return {k: out[k] for k in DECLARED_KEYS if k in out}


def _resolve(obj, *, lenient: bool) -> dict:
    if not isinstance(obj, dict):
        raise PrizeTermsError(
            f"metadata.prize_terms must be an object declaring "
            f"{PRIZE_DISPOSITION_KEY!r} — one of {_options()} (got "
            f"{type(obj).__name__}: {obj!r}). A contest with no prize declares "
            f"no prize_terms at all.")

    # 1. Retired keys, named with their replacement.
    for key, replacement in PRIZE_RETIRED_KEYS.items():
        if key in obj:
            raise PrizeTermsError(
                f"metadata.prize_terms.{key} is RETIRED (since "
                f"2026-09-07 the prize term is one choice of three). Use "
                f"{replacement}. Declare "
                f"{PRIZE_DISPOSITION_KEY} = {_options()}.")

    # 2. Money does not live in the terms.
    money = [k for k in obj if k in PRIZE_MONEY_KEYS]
    if money:
        raise PrizeTermsError(
            f"metadata.prize_terms carries prize MONEY key(s) "
            f"{', '.join(sorted(money))}. prize_terms declares only the TERM "
            f"(which of {_options()} the host chose); the money and its holder "
            f"are declared in contests.metadata.prize and are the sponsor's, "
            f"never Champollion's.")

    # 3. The disposition itself — required, and the whole headline.
    if PRIZE_DISPOSITION_KEY not in obj:
        raise PrizeTermsError(
            f"metadata.prize_terms is missing {PRIZE_DISPOSITION_KEY!r}. A "
            f"contest that declares prize terms declares exactly one of "
            f"{_options()} — "
            + "; ".join(f"{name}: {text}"
                        for name, text in DISPOSITION_HEADLINES.items())
            + ". Nothing is defaulted: an undeclared term is not a term "
              "participants were promised.")
    disposition = obj[PRIZE_DISPOSITION_KEY]
    if not isinstance(disposition, str) or disposition not in DISPOSITIONS:
        raise PrizeTermsError(
            f"metadata.prize_terms.{PRIZE_DISPOSITION_KEY} = {disposition!r} "
            f"is not one of {_options()}.")

    derived = dict(DISPOSITION_DERIVED[disposition])
    allowed_overrides = DISPOSITION_OVERRIDES.get(disposition) or {}

    # 4. Derived-only keys: refused outright at the declaration door, and
    #    accepted on a read-back only when they agree with the disposition.
    for key in DERIVED_ONLY_KEYS:
        if key not in obj:
            continue
        if not lenient:
            raise PrizeTermsError(
                f"metadata.prize_terms.{key} is DERIVED from "
                f"{PRIZE_DISPOSITION_KEY} and is not declared: "
                f"{disposition!r} means {key} = {derived[key]!r}. "
                f"{_overrides_sentence(disposition)}.")
        if obj[key] != derived[key]:
            raise PrizeTermsError(
                f"metadata.prize_terms.{key} = {obj[key]!r} contradicts "
                f"{PRIZE_DISPOSITION_KEY} = {disposition!r}, which derives "
                f"{key} = {derived[key]!r}. One of the two is wrong; the "
                f"disposition is the term, so fix or drop the {key} key.")

    # 5. No unknown keys.
    known = set(DECLARED_KEYS) | (set(DERIVED_ONLY_KEYS) if lenient else set())
    unknown = [k for k in obj if k not in known]
    if unknown:
        raise PrizeTermsError(
            f"metadata.prize_terms has unknown key(s) "
            f"{', '.join(repr(k) for k in sorted(unknown))}. "
            f"{_overrides_sentence(disposition).capitalize()}. An "
            f"unrecognised key would read as a promise nothing enforces.")

    # 6. The overrides this disposition allows — and only those.
    for key in ("retention", "release", "release_license"):
        if key not in obj:
            continue
        value = obj[key]
        if key not in allowed_overrides:
            if lenient and value == derived.get(key):
                continue  # a derived dict echoing its own value
            raise PrizeTermsError(
                f"metadata.prize_terms.{key} = {value!r} is not an override "
                f"{PRIZE_DISPOSITION_KEY} = {disposition!r} allows "
                f"({key} = {derived.get(key)!r} follows from the "
                f"disposition). {_overrides_sentence(disposition).capitalize()}.")
        vocabulary = allowed_overrides[key]
        if vocabulary is not None:
            if not isinstance(value, str) or value not in vocabulary:
                raise PrizeTermsError(
                    f"metadata.prize_terms.{key} = {value!r} is not one of "
                    f"{' | '.join(vocabulary)} (the values "
                    f"{PRIZE_DISPOSITION_KEY} = {disposition!r} allows).")
        derived[key] = value

    # 7. release_license — required exactly when the disposition requires a
    #    release, forbidden otherwise (a licence for a release nobody has to
    #    make is a term about nothing). `release_open` defaults it to any_osi.
    if "release_license" in allowed_overrides:
        licence = derived.get("release_license")
        if not isinstance(licence, str) or not licence.strip():
            raise PrizeTermsError(
                f"metadata.prize_terms.release_license = {licence!r} must be a "
                f"non-empty SPDX identifier (e.g. 'Apache-2.0', 'MIT', "
                f"'AGPL-3.0-or-later') or {RELEASE_LICENSE_ANY!r} for any "
                f"OSI-approved licence.")
        if licence != RELEASE_LICENSE_ANY and not _SPDX_RE.match(licence):
            raise PrizeTermsError(
                f"metadata.prize_terms.release_license = {licence!r} is not an "
                f"SPDX-shaped identifier (letters, digits, '.', '+', '-') and "
                f"is not {RELEASE_LICENSE_ANY!r}.")
    else:
        derived.pop("release_license", None)

    # 8. community_terms_url — optional on every disposition, https only.
    if PRIZE_UNIVERSAL_KEYS[0] in obj:
        url = obj[PRIZE_UNIVERSAL_KEYS[0]]
        problem = _https_problem(url)
        if problem:
            raise PrizeTermsError(
                f"metadata.prize_terms.{PRIZE_UNIVERSAL_KEYS[0]} {url!r} "
                f"{problem}.")
        derived[PRIZE_UNIVERSAL_KEYS[0]] = url

    derived[PRIZE_DISPOSITION_KEY] = disposition
    # Canonical order — the hash is over sorted keys, but every human-readable
    # rendering walks DIMENSIONS, so store them that way too.
    return {k: derived[k] for k in DIMENSIONS if k in derived}


def from_preset(name: str, **overrides) -> dict:
    """RETIRED 2026-09-07 — always raises, naming the replacement.

    The presets ``open`` / ``audit`` / ``community`` / ``strict`` are gone: the
    founder's ruling made the participant-facing term one choice of three. This
    function survives so an old call site fails with the answer in the message
    rather than an ``AttributeError`` three frames away.
    """
    raise PrizeTermsError(
        f"from_preset({name!r}) is RETIRED (since 2026-09-07 the "
        f"prize term is one choice of three). The presets open / audit / community / "
        f"strict no longer exist. Declare "
        f"{PRIZE_DISPOSITION_KEY} = {_options()} instead — "
        + "; ".join(f"{n}: {t}" for n, t in DISPOSITION_HEADLINES.items())
        + ".")


# ---------------------------------------------------------------------------
# The hash a participant accepts.
# ---------------------------------------------------------------------------

def terms_sha256(terms: dict) -> str:
    """SHA-256 over canonical JSON (sorted keys, no whitespace, UTF-8).

    This is the string a participant passes to ``--accept-terms``. It is
    computed from the FULLY DERIVED terms, so the declared spelling an
    organizer writes and the derived dict a snapshot froze hash the same, and
    any change to the disposition or to any override changes the hash.
    """
    parsed = normalize_prize_terms(terms)
    canonical = json.dumps(parsed, sort_keys=True, separators=(",", ":"),
                           ensure_ascii=False)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


# ---------------------------------------------------------------------------
# Plain language, generated.
# ---------------------------------------------------------------------------

def describe(terms: dict) -> str:
    """A plain-language paragraph for the CLI banner, the report and the page.

    Leads with the DISPOSITION — the term a participant actually agrees to —
    and only then spells out the derived detail. GENERATED from the declared
    value: there is no hand-written blurb per option, because a blurb and a
    term are two things that drift apart.
    """
    t = normalize_prize_terms(terms)
    disposition = t["disposition"]
    parts: list[str] = [
        f"Prize terms for this contest (declared by the host, frozen once the "
        f"contest has entries). THE TERM: "
        f"{DISPOSITION_LABELS[disposition]} — "
        f"{DISPOSITION_HEADLINES[disposition]}.",
        f"Your method is executed by the host's air-gapped node on the sealed "
        f"set — that much is how a sovereign contest works, and is not a "
        f"choice. In detail, that term means: "
        f"{VALUE_MEANINGS['retention'][t['retention']]}; "
        f"{VALUE_MEANINGS['rights'][t['rights']]}; "
        f"{VALUE_MEANINGS['host_use'][t['host_use']]}.",
    ]

    release = t["release"]
    if release == "not_required":
        parts.append(VALUE_MEANINGS["release"][release].capitalize() + ".")
    else:
        licence = t["release_license"]
        licence_txt = ("under any OSI-approved licence"
                       if licence == RELEASE_LICENSE_ANY
                       else f"under {licence}")
        sentence = (VALUE_MEANINGS["release"][release].capitalize()
                    + f", {licence_txt}.")
        if release == "required_after_prize":
            sentence += (" That obligation falls due AFTER payout, so it is "
                         "not one of the checks the prize gate makes before "
                         "paying.")
        parts.append(sentence)

    if t.get("community_terms_url"):
        parts.append(f"The host's own written terms: {t['community_terms_url']}.")

    steps = prize_gate(t)
    parts.append(
        "Before a prize is paid this platform verifies: "
        + "; ".join(_GATE_MEANINGS[s] for s in steps) + ".")
    if "assignment_recorded" in steps:
        parts.append(
            "An assignment is an instrument signed outside this platform. The "
            "platform verifies that the host RECORDED one; it never verifies "
            "law, and recording is not legal advice to either side.")
    return " ".join(parts)


_GATE_MEANINGS: dict[str, str] = {
    "handover_verified":
        "that the host holds the exact artifact it scored "
        "(the node's recorded method digest)",
    "release_verified":
        "that the host recorded your public release (URL + SHA-256 — the "
        "platform checks the record and never fetches the URL)",
    "assignment_recorded":
        "that the host recorded the assignment instrument and its date",
}


# ---------------------------------------------------------------------------
# The gate a payout has to pass.
# ---------------------------------------------------------------------------

def prize_gate(terms) -> list[str]:
    """The verification steps THESE terms require, in ``GATE_STEPS`` order.

    Derived, never configured: a host chooses one of three options and the
    checks follow from it. ``handover_verified`` is always present — under R2
    the host ran the method, so it can always be asked to show it holds what
    it ran.
    """
    t = normalize_prize_terms(terms)
    steps = ["handover_verified"]
    if t["release"] in RELEASE_REQUIRED_VALUES:
        steps.append("release_verified")
    if t["rights"] == "assignment_to_host":
        steps.append("assignment_recorded")
    return [s for s in GATE_STEPS if s in steps]


# ---------------------------------------------------------------------------
# The organizer's out-of-platform record.
# ---------------------------------------------------------------------------

def execution_record(metadata, entry_keys) -> dict:
    """``metadata.prize_terms_execution`` for one entry, or ``{}``.

    ``entry_keys`` is the ordered list of ids the record may be filed under
    (the run card id, then the authorization request id). Returns ``{}`` when
    nothing was recorded — an absent record is "not recorded", never "fine".
    """
    if not isinstance(metadata, dict):
        return {}
    table = metadata.get(EXECUTION_KEY)
    if not isinstance(table, dict):
        return {}
    for key in entry_keys:
        if not key:
            continue
        record = table.get(key)
        if isinstance(record, dict):
            return record
    return {}


def release_record_problem(record: dict) -> str | None:
    """Why a recorded release does not count, or None when it does.

    Presence + shape only. The URL is never fetched: a frozen ranking must not
    depend on someone else's uptime, and a 200 from a URL is not evidence that
    the bytes behind it are the method anyway — the SHA-256 the host recorded
    is what a third party can check for themselves.
    """
    if not isinstance(record, dict) or not record:
        return (f"nothing recorded in contests.metadata.{EXECUTION_KEY} for "
                f"this entry — the host records release_url + release_sha256 "
                f"when it has seen the release")
    url = record.get("release_url")
    if url is None:
        return (f"no release_url in contests.metadata.{EXECUTION_KEY} for this "
                f"entry")
    problem = _https_problem(url)
    if problem:
        return f"release_url {url!r} {problem}"
    digest = record.get("release_sha256")
    if not isinstance(digest, str) or not _SHA256_RE.match(digest):
        return (f"release_sha256 {digest!r} is not a 64-hex SHA-256 — the host "
                f"records the digest of the exact published artifact so a "
                f"third party can check the release for themselves")
    return None


def assignment_record_problem(record: dict) -> str | None:
    """Why a recorded assignment does not count, or None when it does.

    PRESENCE, not law. The platform cannot and does not judge whether an
    instrument is valid, signed by the right party, or enforceable anywhere.
    """
    if not isinstance(record, dict) or not record:
        return (f"nothing recorded in contests.metadata.{EXECUTION_KEY} for "
                f"this entry — the host records assignment_instrument_url + "
                f"assignment_recorded_at when the assignment is executed")
    url = record.get("assignment_instrument_url")
    if url is None:
        return (f"no assignment_instrument_url in "
                f"contests.metadata.{EXECUTION_KEY} for this entry")
    problem = _https_problem(url)
    if problem:
        return f"assignment_instrument_url {url!r} {problem}"
    when = record.get("assignment_recorded_at")
    if not isinstance(when, str) or not when.strip():
        return ("no assignment_recorded_at (an ISO-8601 timestamp) — when the "
                "instrument was recorded is part of the record")
    return None


# ---------------------------------------------------------------------------
# Money without terms.
# ---------------------------------------------------------------------------

def money_declared_without_terms(metadata) -> list[str]:
    """The prize-like ``contests.metadata`` keys declared with no ``prize_terms``.

    Empty list = nothing to complain about. A non-empty list is a validation
    ERROR for the caller (``contest_rank.resolve_prize_terms``): a contest that
    advertises a prize without declaring its terms is exactly the ambiguity the
    disposition exists to remove.
    """
    if not isinstance(metadata, dict):
        return []
    if metadata.get("prize_terms"):
        return []
    return [k for k in PRIZE_MONEY_METADATA_KEYS
            if metadata.get(k) not in (None, "", [], {})]
