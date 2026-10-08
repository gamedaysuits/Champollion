"""Contest policy vocabularies — the Python half of migration 074's SSOT.

Migration 074 (``mt-eval-arena/supabase/migrations/074_contest_entries_phases_
and_promises.sql``) writes a handful of closed vocabularies into the database
as CHECK constraints and trigger-body literals: the entry tracks, the phase
names, the participant-facing PROMISE keys that freeze once entries exist, the
post-close escape hatch, the deferred-result roles, and the ticket kinds.

Every one of those is a rule written twice — once in SQL, once in Python. This
module is the Python side; ``arena/tests/test_contest_entries_migration.py``
parses the migration text and asserts each SQL literal list equals the tuple
here, so the two can never drift silently (the 072 /
``test_contest_lifecycle_migration.py`` precedent).

CONSTANTS ONLY. This module imports nothing from the rest of the harness on
purpose: it is the leaf every contest module may depend on.
"""

from __future__ import annotations

#: The ONE name for a contest's identifier, used in every help text and
#: message: `contest prepare --slug` sets it, entrants pass it to `contest
#: qualify` / `submit-method`, and a scoring node keys node.json by it. Until
#: 2026-10-03 the id came from --name while every help text said "Contest
#: slug", so a receipt written under the slug matched no contest (synthetic
#: researcher, Round 4).
CONTEST_ID_HELP: str = ("Contest id — the --slug given to `contest prepare` "
                        "(`mt-eval contest list` shows it)")

# ---------------------------------------------------------------------------
# Where a participant reads the method-submission terms framework before
# passing --agree. Messages used to name the repo path
# (arena/legal/method-submission-agreement.md), which a pip-installed user
# does not have (synthetic organizer persona, 2026-10-03).
# ---------------------------------------------------------------------------
SUBMISSION_TERMS_URL: str = (
    "https://github.com/gamedaysuits/Champollion/blob/main/arena/legal/"
    "method-submission-agreement.md")

# ---------------------------------------------------------------------------
# Entry tracks (contest_submissions.track; manifest["constraints"]["track"]).
#
# 'constrained' — the entry declares it used only the resources the contest
#                 named as allowed (the WMT constrained-track idea).
# 'unconstrained' — anything else. The DEFAULT, because an undeclared entry is
#                 never silently promoted into the stricter track.
# ---------------------------------------------------------------------------
TRACKS: tuple[str, ...] = ("constrained", "unconstrained")

DEFAULT_TRACK: str = "unconstrained"

# ---------------------------------------------------------------------------
# Phase names (contest_phases.name; contest_submissions.phase).
#
# A contest that declares phases is deadline-enforced at the METHOD door: an
# authorization request outside every window is refused by the database
# ("REQUEST GUARD: no open phase …"), which is what a submission deadline
# actually is under R2 (contest = sovereign hosting, entries are executed
# methods, not uploaded files).
# ---------------------------------------------------------------------------
PHASE_NAMES: tuple[str, ...] = ("practice", "evaluation", "post-evaluation")

# ---------------------------------------------------------------------------
# contests.metadata keys that are PROMISES to participants — frozen by the 074
# lifecycle guard the moment the contest has entries (a contest_submissions
# row, a contest_intake row, or an authorization_requests row against any of
# the contest's sealed sets). A promise that can be edited after entries are in
# is not a promise; it is a setting.
# ---------------------------------------------------------------------------
FROZEN_PROMISE_KEYS: tuple[str, ...] = (
    "tie_test",
    "alpha",
    "n_resamples",
    "seed",
    "require_description",
    "prize_terms",
    "test_suites",
    "anonymize_until_close",
    "results_visibility",
    "allowed_tracks",
    "open_weight_only",
    "sealed_holdout_set_id",
    # The exact computation behind metadata.primary_metric (its sacreBLEU
    # signature, or model id + harness version) and the harness version that
    # scores entries. Recorded at creation; a card scored any other way is not
    # ranked against the promise (contest_rank).
    "metric_signature",
    "harness_version",
    # What the sealed test can resolve, stated before it opens: its size and
    # minimum detectable effect (power.declare_test_power), or an explicit
    # null MDE with the reason when no honest effect parameters exist.
    "declared_power",
)

# The ONLY metadata key that may still change after a contest is closed. The
# human-eval selection is chosen FROM the frozen ranking, so it necessarily
# lands after close; everything else is the result of record.
POST_CLOSE_KEYS: tuple[str, ...] = ("human_eval_selection",)

# ---------------------------------------------------------------------------
# Vocabularies for the promise keys the guard checks at write time.
# ---------------------------------------------------------------------------
# metadata.results_visibility — 'hidden_until_close' routes every scored card
# into contest_deferred_results until `contest close` publishes them.
RESULTS_VISIBILITY: tuple[str, ...] = ("immediate", "hidden_until_close")
# What a NEW contest promises when the organizer does not say (founder,
# 2026-10-03). Hidden is the safe default for a shared task: under
# `immediate` an entrant reads a sealed-set score while the contest runs and
# can tune against it, and that leak cannot be undone after the fact.
# Organizers who want a live board pass `--results-visibility immediate`.
# Readers still treat a contest with NO recorded value as `immediate`:
# contests created before this promise existed hid nothing, and a reader
# must not retroactively claim they did.
DEFAULT_RESULTS_VISIBILITY: str = "hidden_until_close"

# metadata.tie_test — the significance test the ranking's tie groups come from.
TIE_TESTS: tuple[str, ...] = ("ar", "bootstrap")

# The string keys every metadata.test_suites[] element must carry.
TEST_SUITE_KEYS: tuple[str, ...] = (
    "suite_id",
    "corpus_card_id",
    "publisher",
    "url",
    "sha256",
)

# ---------------------------------------------------------------------------
# metadata.prize_terms — the PRIZE DISPOSITION (founder ruling R1-trinary,
# 2026-09-07): "I think it should be kinda trinary: 'pass to holders' /
# 'retain IP' / 'release open' options."
#
# The headline, participant-facing term of a prized contest is ONE choice out
# of three. It is not a matrix an organizer fills in, and it is not a preset
# name that stands for a private meaning: it is the term itself, said the way
# a participant would say it.
#
# What stays FIXED (R2) is the EXECUTION mode: an entry is a method handed to
# the organizer's air-gapped node and executed there on the sealed set.
# Handing the artifact over to be scored is inherent to that mode and is not a
# choice. The disposition governs what happens to it AFTERWARDS.
#
# The four dimensions below (retention / rights / host_use / release) survive
# as the DERIVED DETAIL behind each disposition — the vocabulary every
# downstream reader (ranking, report, payout gate, migration guard) still
# works in. An organizer never writes `rights` or `host_use`: they follow from
# the disposition. Two dimensions accept a narrow, named override, and that is
# the whole of the dial.
#
# Vocabulary discipline: the disposition and every derived value are checked in
# three places — migration 074's contest_lifecycle_guard (write time,
# un-bypassable), contest_prize_terms.parse_prize_terms (every read), and the
# public prize-spec page's tables (which a parity test reads from HERE).
# ---------------------------------------------------------------------------

#: The three options. THE participant-facing term of a prized contest.
PRIZE_DISPOSITIONS: tuple[str, ...] = (
    "pass_to_holders",
    "retain_ip",
    "release_open",
)

#: The key that carries the choice inside metadata.prize_terms.
PRIZE_DISPOSITION_KEY: str = "disposition"

#: One plain sentence per option — the founder's own framing, generated into
#: every banner, report, help text and public table. There is no second
#: wording anywhere: two wordings of one term are two terms.
PRIZE_DISPOSITION_HEADLINES: dict[str, str] = {
    "pass_to_holders":
        "the method passes to the sovereign benchmark holders — they score it "
        "and keep it, regardless of who wins",
    "retain_ip":
        "you keep ownership of your method — the host scores it and keeps at "
        "most a sealed copy for audit",
    "release_open":
        "you keep ownership but must publish the method under an open "
        "licence — that release is the prize condition",
}

#: What the host may do with the handed-over artifact once scoring is done.
#: 'delete_after_scoring'   — the node destroys it; nothing is kept.
#: 'retain_sealed_audit'    — a sealed copy is kept for audit/reproduction only.
#: 'retain'                 — the host keeps a working copy regardless.
PRIZE_RETENTION: tuple[str, ...] = (
    "delete_after_scoring",
    "retain_sealed_audit",
    "retain",
)

#: Who owns the method afterwards. DERIVED from the disposition — never
#: declared by an organizer.
#: 'participant_retains_all' — no rights move; the host scored it, nothing more.
#: 'license_to_host'         — the participant keeps ownership, the host gets a
#:                             licence bounded by `host_use`.
#: 'assignment_to_host'      — ownership is assigned (pass_to_holders).
PRIZE_RIGHTS: tuple[str, ...] = (
    "participant_retains_all",
    "license_to_host",
    "assignment_to_host",
)

#: What the host may USE it for. DERIVED from the disposition.
PRIZE_HOST_USE: tuple[str, ...] = (
    "evaluation_only",
    "non_commercial",
    "any",
)

#: Whether the PARTICIPANT must publish the method, and when. This is public
#: release to the world — a different thing from handover to the host.
PRIZE_RELEASE: tuple[str, ...] = (
    "not_required",
    "required_before_scores",
    "required_before_prize",
    "required_after_prize",
)

#: `release_license` accepts an SPDX identifier or this wildcard.
PRIZE_RELEASE_LICENSE_ANY: str = "any_osi"

#: The DERIVED detail of each disposition, in full. This table is the whole
#: definition of what each option means: nothing is inferred anywhere else.
PRIZE_DISPOSITION_DERIVED: dict[str, dict[str, str]] = {
    # "You hand it over, we score and keep regardless" — said plainly.
    "pass_to_holders": {
        "retention": "retain",
        "rights": "assignment_to_host",
        "host_use": "any",
        "release": "not_required",
    },
    # The host measured it; nothing moves. A sealed audit copy is the default
    # so the result can be reproduced — an organizer may narrow that to
    # deleting the artifact once it is scored.
    "retain_ip": {
        "retention": "retain_sealed_audit",
        "rights": "participant_retains_all",
        "host_use": "evaluation_only",
        "release": "not_required",
    },
    # The participant keeps ownership and licenses the world, including the
    # host: the open licence is what the host's use runs under.
    "release_open": {
        "retention": "retain",
        "rights": "participant_retains_all",
        "host_use": "any",
        "release": "required_before_prize",
        "release_license": PRIZE_RELEASE_LICENSE_ANY,
    },
}

#: The ONLY overrides an organizer may declare, per disposition. A value of
#: ``None`` means the key is shape-checked rather than drawn from a closed
#: vocabulary (``release_license``). An option missing from this table takes
#: no overrides at all: the term is the term.
PRIZE_DISPOSITION_OVERRIDES: dict[str, dict[str, tuple[str, ...] | None]] = {
    "pass_to_holders": {},
    "retain_ip": {
        "retention": ("retain_sealed_audit", "delete_after_scoring"),
    },
    "release_open": {
        "release": ("required_before_scores", "required_before_prize",
                    "required_after_prize"),
        "release_license": None,
    },
}

#: Declarable on ANY disposition: the host's own written terms.
PRIZE_UNIVERSAL_KEYS: tuple[str, ...] = ("community_terms_url",)

#: The dimensions a PARSED (fully derived) prize-terms dict carries, in the
#: order every artifact prints them — the disposition first, because it is the
#: term; the derived detail after it, because it is the detail.
PRIZE_DIMENSIONS: tuple[str, ...] = (
    "disposition",
    "retention",
    "rights",
    "host_use",
    "release",
    "release_license",
    "community_terms_url",
)

#: The keys an organizer may WRITE (and therefore the keys migration 074
#: accepts inside metadata.prize_terms). `rights` and `host_use` are absent on
#: purpose: they are derived, and a hand-written copy of a derived value is a
#: second source of truth waiting to disagree.
PRIZE_DECLARED_KEYS: tuple[str, ...] = (
    "disposition",
    "retention",
    "release",
    "release_license",
    "community_terms_url",
)

#: Derived-only: refused as explicit input, present in every parsed result.
PRIZE_DERIVED_ONLY_KEYS: tuple[str, ...] = ("rights", "host_use")

#: The four closed-vocabulary DERIVED dimensions, each mapped to its
#: vocabulary. (`release_license`, `community_terms_url` are shape-checked.)
PRIZE_ENUM_DIMENSIONS: dict[str, tuple[str, ...]] = {
    "retention": PRIZE_RETENTION,
    "rights": PRIZE_RIGHTS,
    "host_use": PRIZE_HOST_USE,
    "release": PRIZE_RELEASE,
}

#: The verification steps a payout can require. Derived from the declared
#: terms by contest_prize_terms.prize_gate — never configured directly.
PRIZE_GATE_STEPS: tuple[str, ...] = (
    "handover_verified",
    "release_verified",
    "assignment_recorded",
)

#: Retired spellings. Migration 074 and the parser both name the key in their
#: refusal so an old contest row (or an old runbook) points at the replacement
#: instead of failing mysteriously.
PRIZE_RETIRED_KEYS: dict[str, str] = {
    "release_required_before_scores":
        "disposition ('release_open' is the option that requires publication; "
        "handover to the node is inherent to sovereign execution and is no "
        "longer a switch)",
    "preset":
        "disposition (the named presets open / audit / community / strict were "
        "RETIRED on 2026-09-07 — the participant-facing term is one of "
        "pass_to_holders | retain_ip | release_open)",
}

#: Keys that would put PRIZE MONEY inside the terms. Money is declared in
#: contests.metadata.prize; prize_terms carries only the terms.
PRIZE_MONEY_KEYS: tuple[str, ...] = (
    "amount", "prize", "prize_pool", "prize_amount", "currency", "value",
)

#: contests.metadata keys that mean "this contest has a prize". A contest that
#: carries one of these and no prize_terms is a validation error: an
#: undeclared-terms prize is exactly the ambiguity the disposition removes.
PRIZE_MONEY_METADATA_KEYS: tuple[str, ...] = (
    "prize", "prize_pool", "prize_amount", "prizes",
)

#: Where the organizer records the out-of-platform facts a gate step needs:
#: metadata.prize_terms_execution[<run_card_id or authorization_request_id>] =
#: {release_url, release_sha256, assignment_instrument_url,
#:  assignment_recorded_at}. The platform verifies PRESENCE and SHAPE; it never
#: fetches the URL and never judges whether an instrument is legally valid.
PRIZE_EXECUTION_KEY: str = "prize_terms_execution"

PRIZE_EXECUTION_FIELDS: tuple[str, ...] = (
    "release_url",
    "release_sha256",
    "assignment_instrument_url",
    "assignment_recorded_at",
)

# ---------------------------------------------------------------------------
# contest_deferred_results.role — which sealed set produced the withheld card.
# ---------------------------------------------------------------------------
DEFERRED_ROLES: tuple[str, ...] = ("main", "holdout")

# ---------------------------------------------------------------------------
# tickets.kind (migration 065, extended by 074 with 'flag' — the community
# flagging lane). The Deno edge function `functions/submit-ticket/lib.ts` holds
# the same list; arena/tests/test_ticket_kinds_parity.py is the third leg.
# ---------------------------------------------------------------------------
TICKET_KINDS: tuple[str, ...] = (
    "takedown",
    "objection",
    "correction",
    "question",
    "flag",
    "other",
)

__all__ = [
    "TRACKS",
    "DEFAULT_TRACK",
    "PHASE_NAMES",
    "FROZEN_PROMISE_KEYS",
    "POST_CLOSE_KEYS",
    "RESULTS_VISIBILITY",
    "DEFAULT_RESULTS_VISIBILITY",
    "TIE_TESTS",
    "TEST_SUITE_KEYS",
    "PRIZE_DISPOSITIONS",
    "PRIZE_DISPOSITION_KEY",
    "PRIZE_DISPOSITION_HEADLINES",
    "PRIZE_DISPOSITION_DERIVED",
    "PRIZE_DISPOSITION_OVERRIDES",
    "PRIZE_UNIVERSAL_KEYS",
    "PRIZE_DECLARED_KEYS",
    "PRIZE_DERIVED_ONLY_KEYS",
    "PRIZE_RETENTION",
    "PRIZE_RIGHTS",
    "PRIZE_HOST_USE",
    "PRIZE_RELEASE",
    "PRIZE_RELEASE_LICENSE_ANY",
    "PRIZE_DIMENSIONS",
    "PRIZE_ENUM_DIMENSIONS",
    "PRIZE_GATE_STEPS",
    "PRIZE_RETIRED_KEYS",
    "PRIZE_MONEY_KEYS",
    "PRIZE_MONEY_METADATA_KEYS",
    "PRIZE_EXECUTION_KEY",
    "PRIZE_EXECUTION_FIELDS",
    "DEFERRED_ROLES",
    "TICKET_KINDS",
]
