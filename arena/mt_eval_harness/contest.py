"""
Contest Management — Create, submit to, and list evaluation contests.

Contests are structured evaluation challenges scoped to a corpus and
language pair. They support three visibility modes:

  - public:  Anyone can see the contest and all submissions.
  - private: Anyone can see the contest exists, but submissions are
             visible only to the contest creator and the submitter.
  - team:    Only listed teams can see and submit.

This module handles CRUD operations against the Supabase `contests`
and `contest_submissions` tables. Authentication uses the same OAuth
PKCE flow as publish.py (via auth.py).

Under founder ruling R2 (2026-09-06) a contest is SOVEREIGN HOSTING: an entry
is a method handed to the organizer's node (`contest submit-model` /
`contest submit-method`), which executes it on the sealed set and writes the
`contest_submissions` row itself. There is no `contest submit` verb here any
more — a self-reported card belongs on the public leaderboard, not in a
contest.

Usage (via CLI):
    mt-eval contest create --name "EN→CRK Open" --corpus edtekla-v1.json
    mt-eval contest submit-method en-crk-open --bundle method.tar.gz
    mt-eval contest list
"""

import json
import re
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from mt_eval_harness.auth import get_session, SUPABASE_URL, SUPABASE_ANON_KEY
from mt_eval_harness.contest_policy import DEFAULT_RESULTS_VISIBILITY


# ---------------------------------------------------------------------------
# Configuration — imported from auth.py (same constants as publish.py)
# ---------------------------------------------------------------------------


# ---------------------------------------------------------------------------
# Slug generation
# ---------------------------------------------------------------------------

def _slugify(name: str) -> str:
    """Convert a contest name to a URL-safe slug.

    "EN→CRK Open 2026" → "en-crk-open-2026"
    """
    # Replace arrows and special chars with hyphens
    slug = name.lower()
    slug = slug.replace("→", "-").replace("->", "-")
    slug = re.sub(r"[^a-z0-9]+", "-", slug)
    slug = slug.strip("-")
    return slug


#: What a contest id looks like: lowercase letters, digits and single
#: hyphens — exactly what _slugify produces. It is a database key, a receipt
#: directory name (~/.mt-eval/qualifier/<id>/), a node.json key and part of
#: every sealed-set id, so one spelling must work in all four.
_CONTEST_ID_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")

#: The identifier's one name in help text lives in contest_policy
#: (CONTEST_ID_HELP), which the CLI imports without loading this module.


def validate_contest_id(contest_id: str, *, flag: str = "--slug") -> str:
    """Return ``contest_id`` if it is a usable contest id, else refuse.

    Never silently rewritten: an id that changed between the organizer's
    announcement and the database would strand every receipt written under
    the announced one (synthetic researcher, Round 4). The refusal suggests
    the slug form instead.
    """
    cid = str(contest_id or "").strip()
    if not _CONTEST_ID_RE.match(cid):
        suggestion = _slugify(cid)
        raise ValueError(
            f"{flag} {contest_id!r} is not a contest id: use lowercase "
            f"letters, digits and single hyphens"
            + (f" (e.g. {suggestion!r})" if suggestion else "")
            + ". It becomes the contest's id everywhere — the database row, "
              "the receipt entrants write with `contest qualify`, and the "
              "node's config.")
    return cid


# ---------------------------------------------------------------------------
# API helpers
# ---------------------------------------------------------------------------

def _api_request(
    method: str,
    path: str,
    data: Optional[dict] = None,
    params: Optional[dict] = None,
    session: Optional[dict] = None,
    prefer: Optional[str] = None,
) -> dict | list | None:
    """Make a request to the Supabase REST API.

    If session is provided, the request is authenticated with the user's
    access token. If session is None, only the anon key is used (suitable
    for reading public data without forcing a login).

    `prefer` overrides the Prefer header (default return=representation) —
    the self-serve registration lane (contest_prep.register_prepared_self_serve)
    passes resolution=ignore-duplicates so re-running a partially-registered
    contest is idempotent.

    Returns parsed JSON response, or None for empty responses.
    Raises RuntimeError on HTTP errors with descriptive messages.
    """
    url = f"{SUPABASE_URL}/rest/v1/{path}"

    if params:
        query = "&".join(f"{k}={v}" for k, v in params.items())
        url = f"{url}?{query}"

    headers = {
        "apikey": SUPABASE_ANON_KEY,
        "Content-Type": "application/json",
        "Prefer": prefer or "return=representation",
    }

    # Add user auth if a session was provided
    if session:
        access_token = session.get("access_token", "")
        headers["Authorization"] = f"Bearer {access_token}"

    body = json.dumps(data).encode() if data else None
    req = urllib.request.Request(url, data=body, headers=headers, method=method)

    try:
        with urllib.request.urlopen(req) as resp:
            raw = resp.read().decode()
            if not raw:
                return None
            return json.loads(raw)
    except urllib.error.HTTPError as e:
        body_text = e.read().decode() if e.fp else ""
        raise RuntimeError(
            f"Supabase API error ({e.code}): {body_text}"
        ) from e
    except (urllib.error.URLError, OSError) as e:
        raise RuntimeError(
            f"Network error contacting Supabase: {e}"
        ) from e


# ---------------------------------------------------------------------------
# Contest CRUD
# ---------------------------------------------------------------------------

# Contest lanes (migration 041). 'standard' is every ordinary contest;
# 'sealed' is the sovereign bridge — a contest over a registered sealed set
# (migration 037) whose every run defers to the custodian authorization path
# (migrations 038/039, audited by 040). The contest itself grants no access.
CONTEST_LANES = ("standard", "sealed")


def sealed_set_registration(corpus_id: str) -> Optional[dict]:
    """Look up a sealed_sets registration (migration 037) for a corpus id.

    The sealed_sets registry is content-free and anon-readable (its RLS grants
    public SELECT), so no session is needed. Returns the registration row
    (``sealed_set_id`` / ``status``) or None when the corpus is not a
    registered sealed set. Raises RuntimeError on API/network failure — the
    sealed lane treats that as fatal (fail-closed), while the standard lane
    treats an unreachable registry as "not a sealed set" (the registry may not
    exist on databases that predate migration 037; the DB-side guard remains
    the backstop where it does).
    """
    result = _api_request(
        "GET", "sealed_sets",
        params={
            "sealed_set_id": f"eq.{corpus_id}",
            "select": "sealed_set_id,status",
        },
    )
    if isinstance(result, list):
        for row in result:
            # Positive identification only: the row must actually BE the
            # registration for this corpus (guards against a permissive mock
            # or a misrouted response ever passing for a registration).
            if isinstance(row, dict) and row.get("sealed_set_id") == corpus_id:
                return row
    return None


def computation_promise(primary_metric: Optional[str],
                        metric_model: Optional[str]) -> tuple[str, str, str]:
    """``(primary_metric, metric_signature, harness_version)`` — the ranking
    metric a contest promises, as a COMPUTATION.

    The metric is contest DATA (metadata.primary_metric), validated against
    the rankable vocabulary here and again by migration 072's trigger. Its
    signature (sacreBLEU's nrefs|case|eff|nc|nw|space|version, or the neural
    model id + harness version) and the harness version that will score the
    entries are recorded at creation and frozen with the other promises once
    entries exist. Pure: no network. create_contest and the registration plan
    (contest_prep.registration_plan) both use it.

    This is the NEW-contest path, so a metric the registry marks retired
    (``ranking.retired`` — scoring standard/1 retired the weighted composite)
    is refused here with the reason; contests that already recorded it keep
    ranking on it (contest_rank.resolve_metric)."""
    # Lazy import: contest_rank imports this module's API seam.
    from mt_eval_harness.contest_rank import (
        DEFAULT_PRIMARY_METRIC, canonical_metric,
    )
    primary_metric = canonical_metric(primary_metric or DEFAULT_PRIMARY_METRIC)
    from mt_eval_harness import __version__ as harness_version
    from mt_eval_harness.rankable_metrics import (
        RANKABLE_METRICS, expected_signature, refuse_retired_for_new,
    )
    refuse_retired_for_new(primary_metric)
    if metric_model and RANKABLE_METRICS[primary_metric]["signature"]["kind"] != "model":
        raise ValueError(
            f"--metric-model names a neural model, but {primary_metric} is not "
            f"model-scored; drop the flag.")
    return (primary_metric,
            expected_signature(primary_metric, model_id=metric_model),
            harness_version)


def contest_row(*, contest_id: str, name: str, description: str,
                corpus_id: str, language_pair: str, visibility: str,
                teams: Optional[list[str]], created_by: str,
                use_context: str, lane: str, primary_metric: str,
                metric_signature: str, harness_version: str,
                declared_power: Optional[dict], results_visibility: str,
                anonymize_until_close: bool,
                metadata_extra: Optional[dict] = None) -> dict:
    """The ``contests`` row create_contest POSTs — built in ONE place, so the
    registration plan `contest prepare --no-register` prints
    (contest_prep.registration_plan) is the row that is sent. Pure."""
    data = {
        "id": contest_id,
        "name": name,
        "description": description,
        "corpus_id": corpus_id,
        "language_pair": language_pair,
        "visibility": visibility,
        "teams": teams or [],
        "created_by": created_by,
        "status": "open",
        "use_context": use_context,
        # Ranking policy and the publication promises are contest DATA
        # (migrations 072/074 vocabulary-check them and freeze them once
        # entries exist). The 008 metadata column has always existed, so this
        # is safe on every database.
        "metadata": {
            **dict(metadata_extra or {}),
            "primary_metric": primary_metric,
            "metric_signature": metric_signature,
            "harness_version": harness_version,
            **({"declared_power": declared_power} if declared_power else {}),
            "results_visibility": results_visibility,
            "anonymize_until_close": bool(anonymize_until_close),
        },
    }
    # The lane column lands with migration 041. A standard contest omits it
    # (the column default is 'standard'), so creating ordinary contests keeps
    # working against a database that predates the sealed bridge.
    if lane != "standard":
        data["lane"] = lane
    return data


def create_contest(
    name: str,
    corpus_id: str,
    language_pair: str,
    visibility: str = "public",
    teams: Optional[list[str]] = None,
    description: str = "",
    use_context: str = "non-commercial",
    lane: Optional[str] = None,
    primary_metric: Optional[str] = None,
    results_visibility: str = DEFAULT_RESULTS_VISIBILITY,
    anonymize_until_close: bool = False,
    metadata_extra: Optional[dict] = None,
    metric_model: Optional[str] = None,
    declared_power: Optional[dict] = None,
    contest_id: Optional[str] = None,
) -> dict:
    """Create a new evaluation contest.

    Args:
        name:          Human-readable contest name (e.g. "EN→CRK Open 2026")
        contest_id:    The contest's id (``contests.id``) — what entrants pass
                       to `contest qualify` / `submit-method` and nodes key
                       node.json by. `contest prepare --slug` sets it (and
                       `contest create --slug`). Validated, never rewritten
                       (validate_contest_id). None → derived from ``name``
                       (_slugify), the only form before 2026-10-03.
        primary_metric: The metric `mt-eval contest rank` / `close` rank on,
                       recorded as ``metadata.primary_metric``: any metric
                       shared/metric-registry.json marks rankable (a
                       ``ranking`` block; see rankable_metrics) and has not
                       retired for new contests (the composite is refused:
                       scoring standard/1). Aliases are exact (``chrf`` is
                       plain chrF). Default chrF++, the standard headline.
                       Migration 072 freezes it once any entry exists.
        metric_model:  The neural model a model-scored primary metric
                       (COMET) uses. Required for those, refused for the
                       others. With the harness version it becomes the
                       frozen ``metadata.metric_signature``.
        declared_power: power.declare_test_power's statement of what the
                       test can resolve (size + minimum detectable effect),
                       recorded as the frozen ``metadata.declared_power``.
        results_visibility:
                       "hidden_until_close" (default) or "immediate",
                       recorded as ``metadata.results_visibility``. Under
                       hidden_until_close EVERY card the organizer node scores
                       is parked in ``contest_deferred_results`` and published
                       by `contest close` before the ranking freezes — the
                       participant gets no feedback from the sealed set while
                       the contest runs. Under immediate each card publishes
                       as the node finishes it. A PROMISE: migration 074
                       freezes it the moment the contest has entries.
        anonymize_until_close:
                       Recorded as ``metadata.anonymize_until_close``.
                       Pseudonymises the ORGANIZER'S ranking artifacts while
                       the contest is open; it does NOT anonymise the public
                       board (a published run card shows whatever
                       ``run_cards`` shows). Hiding results is what
                       results_visibility does.
        metadata_extra:
                       Extra ``contests.metadata`` keys to record at creation
                       (the promise keys other verbs own). Merged UNDER the
                       keys this function sets, which always win.
        corpus_id:     Dataset ID or corpus filename to evaluate against
        language_pair: Language pair string (e.g. "en>crk")
        visibility:    Access mode: "public", "private", or "team"
        teams:         Team slugs for team-scoped contests
        description:   Human-readable description
        use_context:   "commercial" | "non-commercial" (migration 035). Combined
                       with the corpus license to decide eligibility: a
                       commercial contest may NOT use a NonCommercial dataset; a
                       non-commercial contest may. Quarantined corpora are never
                       eligible in either lane.
        lane:          "standard" | "sealed" (migration 041), or None to
                       auto-resolve from the sealed_sets registry: a corpus
                       with a registration gets the sealed lane, anything else
                       the standard lane. A sealed contest is eligible ONLY
                       over a corpus with an existing, active sealed_sets
                       registration (migration 037); creating it grants no
                       access — every run against the sealed set still
                       requires a custodian-authorized, single-use grant
                       (migrations 038/039). A standard contest refuses sealed
                       sets and quarantined corpora (fail-closed).
    created_by is ALWAYS the JWT email: migration 052 binds it at the RLS
    door (the 043/045/046 identity pattern), and the 008/031 "Owner update
    contests" policy has always compared created_by against the email — a
    display identity would now be refused at creation, and previously left
    the owner permanently unable to update their own contest.

    Returns:
        The created contest record as a dict.

    Raises:
        ValueError: If visibility/use_context/lane is invalid, team mode has no
                    teams, or the corpus is ineligible for the chosen
                    use_context/lane.
        RuntimeError: On Supabase API errors.
    """
    if visibility not in ("public", "private", "team"):
        raise ValueError(
            f"Invalid visibility '{visibility}'. "
            f"Must be one of: public, private, team."
        )
    if visibility == "team" and not teams:
        raise ValueError(
            "Team-scoped contests require at least one team. "
            "Use --teams 'team1,team2'."
        )

    from mt_eval_harness.license_use import (
        USE_CONTEXTS,
        contest_dataset_eligible,
        corpus_is_quarantined,
        resolve_corpus_license,
    )
    if use_context not in USE_CONTEXTS:
        raise ValueError(
            f"Invalid use_context '{use_context}'. "
            f"Must be one of: {', '.join(USE_CONTEXTS)}."
        )
    if lane is not None and lane not in CONTEST_LANES:
        raise ValueError(
            f"Invalid lane '{lane}'. "
            f"Must be one of: {', '.join(CONTEST_LANES)}."
        )

    primary_metric, metric_signature, harness_version = computation_promise(
        primary_metric, metric_model)

    # The publication PROMISES (contract C5, practices 2 and 6). Checked here
    # against the same vocabulary migration 074 holds — contest_policy.py is
    # the Python half of that SSOT — so a typo is a refusal at the door, not a
    # 400 from a trigger halfway through creation.
    from mt_eval_harness.contest_policy import RESULTS_VISIBILITY
    if results_visibility not in RESULTS_VISIBILITY:
        raise ValueError(
            f"Invalid results_visibility '{results_visibility}'. "
            f"Must be one of: {', '.join(RESULTS_VISIBILITY)} "
            f"(migration 074 vocabulary).")
    if not isinstance(anonymize_until_close, bool):
        raise ValueError(
            f"anonymize_until_close must be a boolean, got "
            f"{type(anonymize_until_close).__name__}.")
    if metadata_extra is not None and not isinstance(metadata_extra, dict):
        raise ValueError(
            f"metadata_extra must be a dict of contests.metadata keys, got "
            f"{type(metadata_extra).__name__}.")

    if lane is None:
        # Auto-resolve the lane from the sealed_sets registry, so the
        # self-serve path needs no extra flag: a registered sealed set gets
        # the sealed lane; everything else is a standard contest. If the
        # registry is unreachable (or predates migration 037) we fall back to
        # standard — the contests_corpus_guard trigger (041) is the
        # un-bypassable backstop that refuses a sealed set in the wrong lane.
        try:
            lane = (
                "sealed"
                if sealed_set_registration(corpus_id) is not None
                else "standard"
            )
        except RuntimeError:
            lane = "standard"

    if lane == "sealed":
        # The sovereign bridge (migration 041). Fail-closed: a sealed contest
        # requires an EXISTING sealed_sets registration (migration 037) — the
        # registration is what puts the custodian group, ciphertext digest, and
        # public qualifier on the record. Creating the contest grants no
        # access: every run against the sealed set still enters the pending
        # authorization queue (038) and needs a custodian-minted, single-use,
        # fingerprint-bound grant (039), with the audit trail of 040. The DB
        # trigger (contests_corpus_guard) enforces the same rule beneath us.
        registration = sealed_set_registration(corpus_id)
        if registration is None:
            raise ValueError(
                f"Corpus '{corpus_id}' has no sealed_sets registration — a "
                f"sealed contest requires a registered sealed set (register "
                f"the set first; see the sovereign-contest runbook)."
            )
        if registration.get("status") != "active":
            raise ValueError(
                f"Sealed set '{corpus_id}' is "
                f"'{registration.get('status', 'unknown')}' (not active) — a "
                f"sealed contest may only run against an active sealed set."
            )
    else:
        # Standard lane. Eligibility = use_context flag + corpus license
        # (quarantine always wins). Fail-closed: a contest must not be created
        # over a corpus its use_context cannot legally rank (e.g. a commercial
        # contest over an NC dataset), and a registered sealed set may only be
        # contested through the sealed lane — anything else quarantined still
        # refuses.
        try:
            is_sealed = sealed_set_registration(corpus_id) is not None
        except RuntimeError:
            # The sealed_sets registry may not exist on this database yet (it
            # lands with migration 037); an ordinary contest must keep working
            # without it. Where the registry exists, the contests_corpus_guard
            # trigger (041) is the un-bypassable backstop.
            is_sealed = False
        if is_sealed:
            raise ValueError(
                f"Corpus '{corpus_id}' is a registered sealed set — it may "
                f"only back a sealed-lane contest, whose every run passes the "
                f"custodian authorization path (migrations 038/039)."
            )
        corpus_license, _ = resolve_corpus_license(corpus_id)
        quarantined = corpus_is_quarantined(corpus_id)
        eligible, reason = contest_dataset_eligible(
            use_context, corpus_license, quarantined=quarantined
        )
        if not eligible:
            raise ValueError(
                f"Corpus '{corpus_id}' (license: {corpus_license or 'unknown'}) is not "
                f"eligible for a {use_context} contest: {reason}."
            )

    slug = (validate_contest_id(contest_id) if contest_id
            else _slugify(name))

    # Identity: ALWAYS the JWT email — migration 052's contests_create_own
    # policy compares created_by against the email claim, and the owner-update
    # policy always has. A display identity would be refused at the door.
    session = get_session()
    from mt_eval_harness.auth import get_submitter_email
    submitter = get_submitter_email(session)

    contest_data = contest_row(
        contest_id=slug, name=name, description=description,
        corpus_id=corpus_id, language_pair=language_pair,
        visibility=visibility, teams=teams, created_by=submitter,
        use_context=use_context, lane=lane, primary_metric=primary_metric,
        metric_signature=metric_signature, harness_version=harness_version,
        declared_power=declared_power, results_visibility=results_visibility,
        anonymize_until_close=anonymize_until_close,
        metadata_extra=metadata_extra)

    print(f"\n  Creating contest: {name}")
    print(f"  Contest id:      {slug}  (entrants pass this to `contest "
          f"qualify` / `submit-method`)")
    print(f"  Corpus:          {corpus_id}")
    print(f"  Language pair:   {language_pair}")
    print(f"  Visibility:      {visibility}")
    print(f"  Use context:     {use_context}")
    print(f"  Lane:            {lane}")
    print(f"  Primary metric:  {primary_metric}")
    print(f"  Metric signature: {metric_signature}")
    print(f"  Harness version: {harness_version}")
    if declared_power:
        mde = declared_power.get("minimum_detectable_effect")
        print(f"  Declared power:  n={declared_power['n_segments']}, MDE "
              f"{mde if mde is not None else 'not stated'} "
              f"({declared_power.get('note') or 'at ' + format(declared_power['target_power'], '.0%') + ' power'})")
    print(f"  Results:         {results_visibility}"
          + ("  (every scored card is withheld until `contest close` "
             "publishes it)" if results_visibility == "hidden_until_close"
             else ""))
    if anonymize_until_close:
        print("  Identities:      pseudonymous in the organizer's ranking "
              "artifacts until close (the public board is NOT anonymised)")
    if lane == "sealed":
        print(
            "  Note:            sealed contest — every run requires custodian "
            "authorization (no access is granted by the contest itself)."
        )
    if teams:
        print(f"  Teams:           {', '.join(teams)}")

    result = _api_request("POST", "contests", data=contest_data, session=session)

    if result:
        record = result[0] if isinstance(result, list) else result
        print(f"\n  ✅ Contest created: {record['id']}")
        return record
    else:
        raise RuntimeError("Contest creation returned empty response.")


# RETIRED 2026-09-06 (founder ruling R2): `submit_to_contest` / the
# `mt-eval contest submit` verb. Linking a SELF-REPORTED run card to a contest
# is no longer a contest entry path — "contest" means SOVEREIGN HOSTING, and an
# entry is a METHOD the organizer's own node executes on the sealed set:
# Lane A (`contest submit-model`) or Lane B (`contest submit-method`). The
# `contest_submissions` row is now written by the node itself, after it has
# executed the handed-over method, carrying the entry's declarations
# (contest_declarations.submission_fields_from_manifest) and the
# authorization_request_id that produced it. The public leaderboard —
# `mt-eval publish` against a public corpus, indexed by corpus × pair
# direction — is where a self-reported card belongs; it is not a contest.


def _owned_contest(contest_id: str, session: dict, email: str) -> dict:
    """Fetch a contest with the owner's session and prove ownership.

    Ownership is what the 008/031 "Owner update contests" RLS policy checks
    (created_by = JWT email); we check it client-side too so the refusal
    names the reason instead of surfacing as "0 rows updated".
    """
    from mt_eval_harness.contest_rank import fetch_contest
    contest = fetch_contest(contest_id, session=session)
    if contest.get("created_by") != email:
        raise RuntimeError(
            f"Contest '{contest_id}' is owned by "
            f"{contest.get('created_by') or '?'}, not {email} — only the "
            f"creator (the identity migration 052 bound at creation) may "
            f"change its lifecycle.")
    return contest


def set_intake(contest_id: str, open_: bool) -> dict:
    """Open or close hypotheses intake on a contest you own.

    PATCHes ``contests.intake_open`` through the owner-update RLS policy
    (008/031) with the organizer's own session — no service key. The 043
    intake admission trigger reads this flag beneath every client, so
    closing intake here stops `contest submit-hypotheses` for everyone.
    Refuses on: not found, not the owner, contest not ``open`` (a closed
    contest's intake is pinned shut by migration 072), or zero rows updated.
    """
    session = get_session()
    from mt_eval_harness.auth import get_submitter_email
    email = get_submitter_email(session)

    contest = _owned_contest(contest_id, session, email)
    if contest.get("status") != "open":
        raise RuntimeError(
            f"Contest '{contest_id}' is {contest.get('status')} — intake "
            f"cannot be {'opened' if open_ else 'changed'} on a contest "
            f"that is no longer open.")
    if bool(contest.get("intake_open")) == bool(open_):
        print(f"\n  Contest {contest_id}: intake already "
              f"{'OPEN' if open_ else 'CLOSED'} — nothing to change.")
        return contest

    patched = _api_request(
        "PATCH", "contests", params={"id": f"eq.{contest_id}"},
        data={"intake_open": bool(open_)}, session=session)
    if not patched:
        raise RuntimeError(
            f"Could not update intake on contest '{contest_id}': the "
            f"owner-update policy matched no row for {email}.")
    record = patched[0] if isinstance(patched, list) else patched
    print(f"\n  ✅ Contest {contest_id}: intake "
          f"{'OPEN' if record.get('intake_open') else 'CLOSED'}"
          f"{'' if open_ else ' — submissions already received keep flowing through the node'}")
    return record


def close_contest(
    contest_id: str,
    *,
    include_unverified: bool = False,
    force: bool = False,
    auto_confirm: bool = False,
    tie_test: str = "ar",
    n_resamples: Optional[int] = None,
    alpha: Optional[float] = None,
    seed: Optional[int] = None,
    use_segments: bool = True,
    reveal_identities: bool = True,
    node_verdicts: Optional[str] = None,
    verify_key: Optional[str] = None,
) -> dict:
    """Close a contest you own and freeze its ranking.

    Order (contract C5 — it matters):

      1. owner check;
      2. **publish every withheld result** (``contest_deferred_results``,
         migration 074) — ALWAYS, including under ``--force``: a contest that
         promised "hidden until close" owes participants their scores AT
         close, and a `--force` that skipped publication would turn a
         withheld run into a lost one;
      3. the prize gate, when ``metadata.prize_terms`` is declared at all
         (founder rulings R1 + R1-amended: terms are a per-contest dial; the
         prize condition is HANDOVER of the method to the sovereign host);
      4. build the ranking with the contest's RECORDED primary metric only
         (``metadata.primary_metric`` — a close never re-chooses the metric;
         use `contest rank --metric` to explore) and with
         ``reveal_identities`` (a closed contest names its entrants; that is
         what ``metadata.anonymize_until_close`` means by "until close");
      5. ONE PATCH: ``status='closed'``, ``intake_open=false``,
         ``metadata ∪ {final_ranking, closed_at, closed_by}``. JSONB PATCH
         replaces the whole column, so the merge happens here; migration 072
         re-checks every rule beneath us, requires ``metadata.final_ranking``,
         and server-stamps ``closed_at``.

    Refuses while intake work is still in flight unless ``force``, shows the
    table, and asks for confirmation before the PATCH.
    """
    from mt_eval_harness.confidence import (
        DEFAULT_ALPHA, DEFAULT_N_BOOTSTRAP, DEFAULT_SEED,
    )
    from mt_eval_harness import contest_node, contest_rank
    from mt_eval_harness.contest_rank import format_ranking_table
    session = get_session()
    from mt_eval_harness.auth import get_submitter_email
    email = get_submitter_email(session)

    contest = _owned_contest(contest_id, session, email)
    if contest.get("status") != "open":
        raise RuntimeError(
            f"Contest '{contest_id}' is already {contest.get('status')} — "
            f"a close is one-way (open → closed → archived) and cannot be "
            f"repeated; `mt-eval contest export {contest_id}` returns the "
            f"frozen result.")

    # 2. Withheld results are published BEFORE the ranking is built, so the
    #    frozen snapshot ranks every score the contest actually holds.
    withheld = contest_node.fetch_deferred_count(contest_id, session=session)
    deferred_published: list[str] = []
    if withheld:
        print(f"\n  {withheld} withheld result(s) will be published by this "
              f"close (contest promised results_visibility="
              f"{(contest.get('metadata') or {}).get('results_visibility')}).")
        deferred_published = contest_node.publish_deferred(contest_id)
        if len(deferred_published) != withheld:
            raise RuntimeError(
                f"Expected to publish {withheld} withheld result(s) for "
                f"'{contest_id}' but published {len(deferred_published)} — "
                f"stopping before the ranking is frozen. Inspect "
                f"contest_deferred_results.")

    ranking = contest_rank.build_ranking(
        contest_id,
        metric=None,                      # the recorded metric only
        include_unverified=include_unverified,
        tie_test=tie_test,
        n_resamples=DEFAULT_N_BOOTSTRAP if n_resamples is None else n_resamples,
        alpha=DEFAULT_ALPHA if alpha is None else alpha,
        seed=DEFAULT_SEED if seed is None else seed,
        use_segments=use_segments,
        session=session,
        contest=contest,
        reveal_identities=reveal_identities,
        # A sealed contest's paired tests, run on the node (contest_verdicts):
        # verified and bound to this contest, or the close refuses.
        node_verdicts=node_verdicts,
        verify_key=verify_key,
    )
    # Annotate — never replace — the ranking's own reporting blocks
    # (contest_rank owns their shape; this close owns what it DID).
    deferred_block = dict(ranking.get("deferred_results") or {})
    deferred_block.update({
        "published_at_close": deferred_published,
        "published_count": len(deferred_published),
        "published_note": (
            f"{len(deferred_published)} result(s) withheld under "
            f"metadata.results_visibility=hidden_until_close were published "
            f"by this close, BEFORE the ranking was built — so this frozen "
            f"ranking includes them."
            if deferred_published else
            "No results were withheld for this contest at close time."),
    })
    ranking["deferred_results"] = deferred_block
    identity_block = dict(ranking.get("identity_policy") or {})
    identity_block.update({
        "revealed_at_close": bool(reveal_identities),
        "close_note": (
            "Identities are revealed in this frozen ranking. "
            "anonymize_until_close only ever pseudonymised the organizer's "
            "own ranking artifacts; the public board was never anonymised."
            if reveal_identities else
            "Identities were NOT revealed in this frozen ranking "
            "(--no-reveal-identities)."),
    })
    ranking["identity_policy"] = identity_block

    # 3. Prize gate (founder rulings R1 + R1-amended 2026-09-07). Prize terms
    #    are a per-contest DIAL (retention / rights / host use / release);
    #    whenever a contest declares any, contest_rank derives the gate steps
    #    those terms require and this checks them. No terms = no prize = no
    #    gate. The gate decides eligibility, never the ranking itself.
    prize_terms = (contest.get("metadata") or {}).get("prize_terms") or {}
    if prize_terms:
        gate = contest_rank.handover_gate_ok(ranking)
        if not gate.get("ok"):
            if not force:
                raise RuntimeError(
                    f"Contest '{contest_id}' declares prize_terms, and the "
                    f"gate those terms require is not satisfied: "
                    f"{gate.get('reason')}. Close with "
                    f"--force to freeze the ranking anyway — prize "
                    f"eligibility stays recorded exactly as the ranking "
                    f"computes it.")
            print(f"\n  ⚠ handover gate NOT satisfied "
                  f"({gate.get('reason')}) — closing anyway (--force). The "
                  f"frozen ranking records prize eligibility as computed, "
                  f"unchanged.")

    pending = ranking.get("pending_intake") or []
    if pending and not force:
        raise RuntimeError(
            f"Contest '{contest_id}' still has {len(pending)} intake "
            f"submission(s) in flight ({', '.join(p.get('state') or '?' for p in pending[:5])}"
            f"{'…' if len(pending) > 5 else ''}). Let the node finish them, "
            f"or pass --force to close and leave them unranked (they stay "
            f"listed under pending_intake in the frozen snapshot).")

    print(format_ranking_table(ranking))
    if not ranking.get("entries"):
        print("  ⚠ The frozen ranking will contain NO ranked entries.")
    if not auto_confirm:
        try:
            answer = input(
                f"  Close contest {contest_id} and FREEZE this ranking "
                f"(one-way; intake shuts) ? [y/N] ").strip().lower()
        except EOFError:
            answer = ""
        if answer not in ("y", "yes"):
            raise RuntimeError("Close aborted — the contest stays open.")

    closed_at = datetime.now(timezone.utc).isoformat(timespec="seconds")
    snapshot = dict(ranking)
    snapshot["provisional"] = False
    snapshot["frozen"] = True
    snapshot["frozen_at"] = closed_at
    metadata = dict(contest.get("metadata") or {})
    metadata.update({
        "final_ranking": snapshot,
        "closed_at": closed_at,
        "closed_by": email,
    })
    patched = _api_request(
        "PATCH", "contests", params={"id": f"eq.{contest_id}"},
        data={"status": "closed", "intake_open": False, "metadata": metadata},
        session=session)
    if not patched:
        raise RuntimeError(
            f"Could not close contest '{contest_id}': the owner-update "
            f"policy matched no row for {email}.")
    record = patched[0] if isinstance(patched, list) else patched
    n = len(snapshot.get("entries") or [])
    print(f"\n  ✅ Contest {contest_id} CLOSED by {email} — ranking frozen "
          f"({n} ranked entr{'y' if n == 1 else 'ies'}, metric "
          f"{snapshot.get('metric')}, trust policy {snapshot.get('trust_policy')}).")
    if deferred_published:
        print(f"     {len(deferred_published)} withheld result(s) were "
              f"published by this close and are on the board now.")
    print(f"     Export it with: mt-eval contest export {contest_id} "
          f"--format json|csv")
    return record


def list_contests(
    status: str = "open",
    language_pair: Optional[str] = None,
) -> list[dict]:
    """List contests, optionally filtered by status and language pair.

    Args:
        status:        Filter by status: "open", "closed", "all"
        language_pair: Filter by language pair (e.g. "en>crk")

    Returns:
        List of contest records.
    """
    params = {"order": "created_at.desc"}

    if status != "all":
        params["status"] = f"eq.{status}"

    if language_pair:
        params["language_pair"] = f"eq.{language_pair}"

    result = _api_request("GET", "contests", params=params)
    contests = result if isinstance(result, list) else []

    if not contests:
        print("\n  No contests found.")
        return []

    print(f"\n  {'ID':<30s} {'Name':<35s} {'Lang':<8s} {'Vis':<8s} {'Status':<8s}")
    print(f"  {'-'*30} {'-'*35} {'-'*8} {'-'*8} {'-'*8}")

    for c in contests:
        print(
            f"  {c['id']:<30s} "
            f"{c['name'][:35]:<35s} "
            f"{c.get('language_pair', '?'):<8s} "
            f"{c['visibility']:<8s} "
            f"{c['status']:<8s}"
        )

    print(f"\n  {len(contests)} contest(s) found.")
    return contests


def list_submissions(
    contest_id: str,
) -> list[dict]:
    """List submissions for a specific contest.

    Returns submissions joined with basic run_card info. For private
    contests, Supabase RLS ensures only the creator and individual
    submitters see their own submissions.

    Args:
        contest_id: The contest id (`contest prepare --slug`)

    Returns:
        List of submission records.
    """
    params = {
        "contest_id": f"eq.{contest_id}",
        "order": "submitted_at.desc",
        # Select submission fields + key run_card fields via foreign key
        "select": "id,contest_id,run_card_id,submitted_by,submitted_at,team,notes",
    }

    result = _api_request("GET", "contest_submissions", params=params)
    submissions = result if isinstance(result, list) else []

    if not submissions:
        print(f"\n  No submissions for contest '{contest_id}'.")
        return []

    print(f"\n  Submissions for '{contest_id}':")
    print(f"  {'Run Card':<40s} {'By':<25s} {'Team':<15s} {'Date':<20s}")
    print(f"  {'-'*40} {'-'*25} {'-'*15} {'-'*20}")

    for s in submissions:
        print(
            f"  {s['run_card_id']:<40s} "
            f"{s['submitted_by'][:25]:<25s} "
            f"{(s.get('team') or '-'):<15s} "
            f"{s['submitted_at'][:19]:<20s}"
        )

    print(f"\n  {len(submissions)} submission(s).")
    return submissions


def resolve_run_card_id(run_path: str) -> str:
    """Resolve a run card ID from either a direct ID or a report JSON path.

    If the input looks like a file path (contains / or .json), load the
    file and extract the run_id. Otherwise, treat it as a direct ID.

    Args:
        run_path: Either a run_card_id string or a path to a report JSON.

    Returns:
        The resolved run_card_id string.

    Raises:
        FileNotFoundError: If the path doesn't exist.
        KeyError: If the JSON doesn't contain a run_id.
    """
    if "/" in run_path or run_path.endswith(".json"):
        path = Path(run_path)
        if not path.exists():
            raise FileNotFoundError(f"Report file not found: {run_path}")

        data = json.loads(path.read_text(encoding="utf-8"))

        # Try run_id at top level, then in run_card, then in the report
        run_id = (
            data.get("run_id")
            or data.get("run_card", {}).get("run_id")
            or data.get("metadata", {}).get("run_id")
        )
        if not run_id:
            raise KeyError(
                f"Could not find run_id in {run_path}. "
                f"Publish the run first with 'mt-eval publish'."
            )
        return run_id

    # Treat as direct ID
    return run_path
