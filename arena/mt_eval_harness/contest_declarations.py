"""contest_declarations — the participant DECLARATIONS every contest entry carries.

Under the 2026-09-06 founder rulings a "contest" is sovereign hosting: entries
are Lane A (weights, `mt-eval contest submit-model`) or Lane B (code,
`mt-eval contest submit-method`, executed `--network=none` on the organizer's
air-gapped node). Neither lane can observe how a system was BUILT, so the
shared-task practices that depend on that knowledge — constrained vs
unconstrained tracks (WMT), primary vs contrastive selection, system
descriptions — are carried as DECLARATIONS on the bundle manifest and copied
onto the `contest_submissions` row.

Two blocks, both written into the manifest by the bundle builders:

    manifest["constraints"] = {
        "track": "constrained" | "unconstrained",
        "parameterCount": <int >= 0; 0 = no trainable parameters>,
        "weightsLicense": "<SPDX id or LicenseRef-*>",  # null when 0: no weights
        "weightsPublic": <bool>,                        # null when 0: no weights
        "trainingData": "<free text, <= 2000 chars; required when constrained>",
    }

A method with no trained weights (a rule-based, dictionary or FST method)
declares ``parameterCount: 0`` and has no weights to license or publish, so
its ``weightsLicense`` / ``weightsPublic`` are null — "not applicable", never a
licence it would have to invent (synthetic researcher persona, Round 2,
2026-10-03: a stdlib-only method could not be submitted without one). Any
count above 0 still requires both, exactly as before.
    manifest["submission"] = {
        "isPrimary": <bool>,
        "description": "<free text, <= 4000 chars>",
        "methodReleaseUrl": "https://…" | None,
        "acceptedPrizeTermsSha256": "<64 hex>",   # only when the contest
                                                  # declares prize terms
    }

``acceptedPrizeTermsSha256`` is the participant's ACCEPTANCE of the contest's
declared prize terms (``contest_prize_terms.terms_sha256`` of
``contests.metadata.prize_terms``, which migration 074 freezes once the contest
has entries). It is carried on the manifest, so it is covered by ``method_sha``
and cannot be edited after submission; the organizer node re-computes the
contest's hash and REFUSES a bundle that accepted different terms. A contest
with no prize terms has no prize, and its entries carry no acceptance.

**What is verified and what is not.** Exactly one of these is checkable by the
host: for Lane A the node re-derives ``parameterCount`` from the safetensors
header of the submitted weights and BLOCKS a claim that is off by more than
one percent. Everything else — the track, the licence, whether the weights are
public, what the training data was — is an unverifiable participant claim
recorded on the submission, and the ranking artifacts say so. This module never
pretends otherwise: there is no silent normalisation, no default track, and no
"probably constrained" inference. A declaration that is missing or malformed is
a BLOCK, refused before any byte leaves the participant's machine and refused
again by the organizer node's static checks.

Findings use the shape ``method_bundle.manifest_consistency_findings`` uses —
``{"check", "severity", "detail"}`` — so a caller can concatenate the lists.
"""

from __future__ import annotations

import json
import re
from pathlib import Path
from urllib.parse import urlsplit

# The two WMT-style tracks. "constrained" = trained only on the data the
# organizer declared allowed; "unconstrained" = anything goes. The vocabulary
# is closed: a contest that wants a third track changes it HERE and in the
# migration's CHECK constraint together.
TRACKS = ("constrained", "unconstrained")

# Free-text ceilings. They exist so a manifest cannot be used as a payload
# channel and so the DB columns and the ranking table stay readable.
MAX_TRAINING_DATA_CHARS = 2000
MAX_DESCRIPTION_CHARS = 4000

# Lane A: the declared parameter count may differ from the count derived from
# the safetensors header — the sum of tensor sizes the FILE stores, the count
# checked and recorded — by at most this fraction (a stray buffer, a
# counted-or-not final bias). Anything larger is a false claim about a
# checkable fact and BLOCKS; the finding says which count it uses and why
# torch's sum(p.numel()) can differ (tied weights, non-saved tables).
PARAMETER_COUNT_TOLERANCE = 0.01

# ---------------------------------------------------------------------------
# Declared resource requirements (manifest.requirements) — the defaults.
# ---------------------------------------------------------------------------
# The node policy that ships with the harness: the `sandbox` block of the
# `mt-eval node init` template (data/node-template.json). It is the ONE source
# of the resources a bundle declares when the entrant does not say — so a
# bundle packaged with submit-method's defaults runs on a node configured from
# node init's defaults. They disagreed (8 GB RAM / 10 GB disk / 120 min
# against 4 / 4 / 30) and a node refused every default-packaged entry
# (synthetic researcher persona, Round 3, 2026-10-03). A contest manifest
# carries no published limits; an organizer whose node allows more says so
# with the contest, and the entrant passes --ram-gb / --disk-gb /
# --max-runtime-minutes.
NODE_TEMPLATE_PATH = Path(__file__).resolve().parent / "data" / "node-template.json"


def _template_sandbox() -> dict:
    tpl = json.loads(NODE_TEMPLATE_PATH.read_text(encoding="utf-8"))
    contests = tpl.get("contests") or {}
    if len(contests) != 1:
        raise RuntimeError(
            f"{NODE_TEMPLATE_PATH} must carry exactly one example contest "
            f"(found {len(contests)}) — its sandbox block is the shipped node "
            f"policy the entrant defaults are read from.")
    (entry,) = contests.values()
    sandbox = entry.get("sandbox") or {}
    missing = [k for k in ("max_ram_gb", "max_tmp_gb", "max_runtime_minutes")
               if not isinstance(sandbox.get(k), (int, float))]
    if missing:
        raise RuntimeError(
            f"{NODE_TEMPLATE_PATH} sandbox block lacks {missing} — the entrant "
            f"defaults are read from it, never invented.")
    return sandbox


_TEMPLATE_SANDBOX = _template_sandbox()

#: manifest.requirements when the entrant declares nothing: exactly what the
#: shipped node template allows.
DEFAULT_REQUIREMENTS = {
    "ramGB": int(_TEMPLATE_SANDBOX["max_ram_gb"]),
    "diskGB": int(_TEMPLATE_SANDBOX["max_tmp_gb"]),
    "maxRuntimeMinutes": int(_TEMPLATE_SANDBOX["max_runtime_minutes"]),
}


# The qualifier-receipt fields copied verbatim onto the manifest (contract C1 →
# C2). The receipt itself is written by contest_qualify.qualify().
QUALIFIER_MANIFEST_FIELDS = (
    "receiptVersion",
    "qualifierId",
    "devCorpusSha256",
    "hypothesesSha256",
    "score",
    "threshold",
    "passed",
    "scoredAt",
    "selfReported",
)

# The `contest_submissions` columns these declarations populate (migration
# 074). `submission_fields_from_manifest` returns EXACTLY these keys — the
# writers POST the dict as-is, so a rename here is a rename there.
SUBMISSION_COLUMNS = (
    "track",
    "is_primary",
    "description",
    "method_release_url",
    "constraints",
    "submitter_label",
)

# The declarative lane's manifest marker (model_bundle.SUBMISSION_KIND). Kept
# as a literal so this module imports nothing from the bundle modules — they
# import IT.
DECLARATIVE_SUBMISSION_KIND = "declarative-model"

# manifest["submission"]["acceptedPrizeTermsSha256"] — the participant's
# acceptance of the contest's declared prize terms. A lowercase 64-hex SHA-256.
ACCEPTED_TERMS_KEY = "acceptedPrizeTermsSha256"

_SHA256_RE = re.compile(r"^[0-9a-f]{64}$")


class DeclarationError(ValueError):
    """A declaration block that cannot be built — always with the reason."""


# ---------------------------------------------------------------------------
# Shared helpers.
# ---------------------------------------------------------------------------

def _finding(detail: str, check: str = "constraints") -> dict:
    return {"check": check, "severity": "BLOCK", "detail": detail}


def url_problem(url: str) -> str | None:
    """Why ``url`` is not an acceptable public https URL, or None if it is.

    Deliberately strict: https only (an http link to a method release is a
    downgrade the participant did not intend), a real host, and no embedded
    credentials. Shared by the manifest checks and the method-card validator so
    both refuse the same strings.
    """
    if not isinstance(url, str):
        return f"must be a string URL (got {type(url).__name__})"
    text = url.strip()
    if not text:
        return "must not be empty (use null when there is no URL)"
    if text != url:
        return "must not have leading or trailing whitespace"
    parts = urlsplit(text)
    if parts.scheme != "https":
        return (f"must be an https:// URL (got scheme "
                f"{parts.scheme or '(none)'!r})")
    if not parts.netloc:
        return "must have a host (https://<host>/…)"
    if "@" in parts.netloc:
        return "must not embed credentials in the host"
    if " " in text:
        return "must not contain spaces"
    return None


def _is_positive_int(value) -> bool:
    # bool is a subclass of int; True is not a parameter count.
    return isinstance(value, int) and not isinstance(value, bool) and value > 0


def _is_parameter_count(value) -> bool:
    """A declared ``parameterCount``: a non-negative integer.

    ZERO IS A REAL ANSWER (founder call, 2026-09-07). A rule-based entry — an
    FST pipeline, a dictionary lookup, a hand-written transducer — has no
    trainable parameters at all, and the toy Lane B example in this repo was
    declaring ``1`` purely to satisfy a positive-integer check. A declaration
    the entrant has to falsify to get past the door is worse than no
    declaration: it puts a number the host will never verify onto a public
    submission row. ``0`` means "no trainable parameters"; a MISSING count
    still blocks, so "none" and "did not say" stay different answers.

    Lane A is the exception and keeps the stricter rule: a weights submission
    has parameters by construction (the safetensors header sums to more than
    zero), so a declared 0 there contradicts the artifact and is blocked by
    ``parameter_count_findings``.
    """
    return isinstance(value, int) and not isinstance(value, bool) and value >= 0


# ---------------------------------------------------------------------------
# Block builders.
# ---------------------------------------------------------------------------

def build_constraints_block(
    *,
    track: str,
    parameter_count: int,
    weights_license: str | None,
    weights_public: bool | None,
    training_data: str,
) -> dict:
    """Assemble ``manifest["constraints"]``. Refuses anything the checker blocks.

    No defaults: every field is an explicit participant declaration — a track
    guessed on someone's behalf is a claim they never made. The one field that
    may be left out is the weights pair, and only by a method with no weights
    (``parameter_count == 0``): it is recorded as null, not as a made-up
    licence.
    """
    block = {
        "track": track,
        "parameterCount": parameter_count,
        "weightsLicense": weights_license,
        "weightsPublic": weights_public,
        "trainingData": training_data,
    }
    problems = constraints_block_findings(block)
    if problems:
        raise DeclarationError(
            "Constraints declaration is invalid:\n    "
            + "\n    ".join(p["detail"] for p in problems))
    return block


def build_submission_block(
    *,
    is_primary: bool,
    description: str,
    method_release_url: str | None,
    accepted_prize_terms_sha256: str | None = None,
) -> dict:
    """Assemble ``manifest["submission"]``. Refuses anything the checker blocks.

    ``accepted_prize_terms_sha256`` is the hash of the contest's declared prize
    terms the participant accepted (``--accept-terms``). The key is present
    ONLY when a hash was given: a contest with no prize terms has no prize, and
    an entry to it accepts nothing.
    """
    block = {
        "isPrimary": is_primary,
        "description": description,
        "methodReleaseUrl": method_release_url,
    }
    if accepted_prize_terms_sha256 is not None:
        block[ACCEPTED_TERMS_KEY] = accepted_prize_terms_sha256
    problems = submission_block_findings(block)
    if problems:
        raise DeclarationError(
            "Submission declaration is invalid:\n    "
            + "\n    ".join(p["detail"] for p in problems))
    return block


def qualifier_block_from_receipt(receipt: dict) -> dict:
    """``manifest["qualifier"]`` — the C1 receipt's public fields, verbatim.

    The receipt is the participant's SELF-SCORED admission evidence; the node
    re-executes the bundle on the dev set before any grant is claimed. Copying
    it onto the manifest is what makes the claim comparable to the measurement.
    """
    if not isinstance(receipt, dict):
        raise DeclarationError(
            f"Qualifier receipt is not an object (got "
            f"{type(receipt).__name__}).")
    missing = [k for k in QUALIFIER_MANIFEST_FIELDS if k not in receipt]
    if missing:
        raise DeclarationError(
            f"Qualifier receipt is missing required field(s): "
            f"{', '.join(missing)}. Re-run `mt-eval contest qualify`.")
    return {k: receipt[k] for k in QUALIFIER_MANIFEST_FIELDS}


# ---------------------------------------------------------------------------
# Checkers.
# ---------------------------------------------------------------------------

def constraints_block_findings(constraints) -> list[dict]:
    """BLOCK findings for a ``constraints`` block considered on its own."""
    f: list[dict] = []
    if not isinstance(constraints, dict):
        return [_finding(
            f"manifest.constraints must be an object with "
            f"{{track, parameterCount, weightsLicense, weightsPublic, "
            f"trainingData}} (got {type(constraints).__name__}).")]

    track = constraints.get("track")
    if track not in TRACKS:
        f.append(_finding(
            f"constraints.track {track!r} is not one of {list(TRACKS)} — "
            f"declare 'constrained' (trained only on the data the organizer "
            f"allowed) or 'unconstrained'. There is no default; the track is "
            f"a claim only you can make."))

    count = constraints.get("parameterCount")
    if not _is_parameter_count(count):
        f.append(_finding(
            f"constraints.parameterCount must be an integer >= 0 "
            f"(got {count!r}). Count every trainable parameter of the system "
            f"you are entering, and declare 0 if it has none — a rule-based "
            f"or dictionary method is entered as 0, not as 1. For Lane A the "
            f"node re-derives the count from the safetensors header and "
            f"refuses a claim off by more than "
            f"{PARAMETER_COUNT_TOLERANCE:.0%}."))

    # No trainable parameters means no weights: nothing to license or
    # publish, so the pair may be null ("not applicable"). A count above 0
    # (or a missing / malformed count) keeps both required.
    weightless = _is_parameter_count(count) and count == 0
    licence = constraints.get("weightsLicense")
    if weightless and licence is None:
        pass
    elif not isinstance(licence, str) or not licence.strip():
        f.append(_finding(
            f"constraints.weightsLicense is required (got {licence!r}) — an "
            f"SPDX identifier (e.g. 'Apache-2.0', 'CC-BY-NC-4.0') or a "
            f"'LicenseRef-…' name for a bespoke licence. A method with no "
            f"trained weights declares parameterCount 0 and leaves it null."))

    public = constraints.get("weightsPublic")
    if weightless and public is None:
        pass
    elif not isinstance(public, bool):
        f.append(_finding(
            f"constraints.weightsPublic must be true or false (got "
            f"{public!r}) — whether the weights are publicly downloadable. It "
            f"is recorded as a claim, never inferred. A method with no "
            f"trained weights declares parameterCount 0 and leaves it null."))

    training = constraints.get("trainingData")
    if training is None or not isinstance(training, str):
        f.append(_finding(
            f"constraints.trainingData must be a string (got {training!r}); "
            f"pass '' only on the unconstrained track."))
    else:
        if len(training) > MAX_TRAINING_DATA_CHARS:
            f.append(_finding(
                f"constraints.trainingData is {len(training)} characters — "
                f"the limit is {MAX_TRAINING_DATA_CHARS}. Name the corpora, "
                f"do not paste them."))
        if track == "constrained" and not training.strip():
            f.append(_finding(
                "constraints.trainingData is required and non-empty on the "
                "constrained track — the track claim means nothing without "
                "the data list it is a claim about (--training-data-file)."))
    return f


def submission_block_findings(submission) -> list[dict]:
    """BLOCK findings for a ``submission`` block considered on its own."""
    f: list[dict] = []
    if not isinstance(submission, dict):
        return [_finding(
            f"manifest.submission must be an object with {{isPrimary, "
            f"description, methodReleaseUrl}} (got "
            f"{type(submission).__name__}).", check="submission")]

    if not isinstance(submission.get("isPrimary"), bool):
        f.append(_finding(
            f"submission.isPrimary must be true or false (got "
            f"{submission.get('isPrimary')!r}) — exactly one primary entry "
            f"per team is ranked; contrastive entries are reported in their "
            f"own section and never win.", check="submission"))

    description = submission.get("description")
    if description is None or not isinstance(description, str):
        f.append(_finding(
            f"submission.description must be a string (got {description!r}); "
            f"pass '' when the contest does not require one.",
            check="submission"))
    elif len(description) > MAX_DESCRIPTION_CHARS:
        f.append(_finding(
            f"submission.description is {len(description)} characters — the "
            f"limit is {MAX_DESCRIPTION_CHARS}.", check="submission"))

    url = submission.get("methodReleaseUrl")
    if url is not None:
        problem = url_problem(url)
        if problem:
            f.append(_finding(
                f"submission.methodReleaseUrl {url!r} {problem}.",
                check="submission"))

    accepted = submission.get(ACCEPTED_TERMS_KEY)
    if accepted is not None and not (isinstance(accepted, str)
                                     and _SHA256_RE.match(accepted)):
        f.append(_finding(
            f"submission.{ACCEPTED_TERMS_KEY} {accepted!r} must be a "
            f"lowercase 64-hex SHA-256 — the hash of the contest's declared "
            f"prize terms, printed by `mt-eval contest show` and passed to "
            f"--accept-terms. Omit the key entirely when the contest declares "
            f"no prize terms.", check="submission"))
    return f


def accepted_prize_terms_sha(manifest) -> str | None:
    """The prize-terms hash this manifest accepted, or None if it accepted none."""
    if not isinstance(manifest, dict):
        return None
    submission = manifest.get("submission")
    if not isinstance(submission, dict):
        return None
    value = submission.get(ACCEPTED_TERMS_KEY)
    return value if isinstance(value, str) else None


def accepted_terms_findings(manifest, *,
                            contest_terms_sha: str | None = None,
                            contest_id: str | None = None) -> list[dict]:
    """Does this bundle accept the terms the contest is actually promising?

    Two states, both stated rather than assumed:

    * ``contest_terms_sha`` given — the caller read the contest row (the
      organizer node does, online). The manifest must carry exactly that hash.
      Accepting nothing while the contest declares terms is a BLOCK; accepting
      a DIFFERENT hash is a BLOCK; accepting terms a contest does not declare
      is a BLOCK, because the bundle was built for something else.
    * ``contest_terms_sha`` None — there is nothing to compare against here (an
      air-gapped import, a local `contest validate`, a bundle packed offline).
      An acceptance present in the manifest is reported as a WARN naming the
      hash so a human can check it against the contest's published terms; it is
      never silently treated as verified.
    """
    accepted = accepted_prize_terms_sha(manifest)
    where = f" for contest {contest_id!r}" if contest_id else ""

    if contest_terms_sha:
        if accepted is None:
            return [_finding(
                f"this contest declares prize terms{where} (sha256 "
                f"{contest_terms_sha}) and this bundle accepts none. Read the "
                f"terms and re-pack with --accept-terms {contest_terms_sha}; "
                f"the acceptance is covered by method_sha, so it cannot be "
                f"added afterwards.", check="prize_terms")]
        if accepted != contest_terms_sha:
            return [_finding(
                f"this bundle accepted prize terms {accepted} but the "
                f"contest{where} declares {contest_terms_sha}. The terms are "
                f"frozen once a contest has entries, so a mismatch means the "
                f"bundle was built against different terms — it is refused "
                f"rather than scored under terms its author never saw.",
                check="prize_terms")]
        return []

    if accepted is not None:
        return [{"check": "prize_terms", "severity": "WARN",
                 "detail": (f"this bundle accepts prize terms {accepted}, "
                            f"which could NOT be checked here{where}: there is "
                            f"no contest row to compare against (offline / "
                            f"air-gapped import / local validation). Compare "
                            f"it by hand against the contest's declared terms "
                            f"hash before authorizing.")}]
    return []


def parameter_count_findings(manifest: dict, bundle_dir: Path) -> list[dict]:
    """Lane A only: cross-check ``parameterCount`` against the weights header.

    The ONE declaration the host can check. Fails loud in both directions: a
    missing or unreadable weights file is a BLOCK (the bundle would not run
    anyway), and a mismatch names both numbers so the participant can see
    exactly what was measured.
    """
    constraints = manifest.get("constraints")
    if not isinstance(constraints, dict):
        return []
    claimed = constraints.get("parameterCount")
    if not _is_parameter_count(claimed):
        return []  # already blocked by constraints_block_findings
    if claimed == 0:
        # 0 is admissible in Lane B (a rule-based method really has none), but
        # a WEIGHTS submission has parameters by construction, so here it is a
        # claim the artifact itself contradicts.
        return [_finding(
            "constraints.parameterCount is 0, but this is a weights "
            "submission: a model with no trainable parameters has no "
            "safetensors to submit. Declare the real count (the node reads "
            "it back out of the header), or enter the method as Lane B code "
            "if it genuinely has none.")]

    model = manifest.get("model") or {}
    weights_name = str(model.get("weightsFile") or "").strip()
    if not weights_name:
        return []  # already blocked by manifest_declarative_findings

    weights_path = Path(bundle_dir) / weights_name
    if not weights_path.is_file():
        return [_finding(
            f"constraints.parameterCount cannot be verified: the declared "
            f"weights file {weights_name!r} is not in the bundle.")]

    from mt_eval_harness.model_runner import parameter_count_from_header

    try:
        measured = parameter_count_from_header(weights_path)
    except ValueError as exc:
        return [_finding(
            f"constraints.parameterCount cannot be verified: {weights_name} "
            f"is not well-formed safetensors ({exc}).")]

    if measured <= 0:
        return [_finding(
            f"constraints.parameterCount cannot be verified: {weights_name} "
            f"declares no parameters.")]

    drift = abs(claimed - measured) / measured
    if drift > PARAMETER_COUNT_TOLERANCE:
        # Say WHICH count is checked: torch's sum(p.numel()) is the number a
        # trainer prints, and it differs from what the file stores (tied or
        # shared weights stored once, non-saved tables) — a researcher
        # declared 100,544 against 92,487 stored and had to guess why
        # (synthetic researcher, Round 6). The rule is unchanged: the file's
        # count is the one the host can verify and the one recorded.
        return [_finding(
            f"constraints.parameterCount {claimed:,} does not match the "
            f"{measured:,} parameters stored in {weights_name} — the sum of "
            f"the tensor sizes in its safetensors header, which is the count "
            f"this check uses ({drift:.1%} off, tolerance "
            f"{PARAMETER_COUNT_TOLERANCE:.0%}). A count taken in torch can "
            f"differ from what the file stores: a tied or shared weight is "
            f"stored once, and a table the model rebuilds at load (e.g. "
            f"sinusoidal positions) may not be saved at all. Declare "
            f"--parameter-count "
            f"{measured} if these are the weights you meant to enter. This "
            f"is the one declaration the host can check.")]
    return []


def constraints_findings(manifest, *, bundle_dir=None) -> list[dict]:
    """The declarations gate — the SSOT both sides run.

    The participant CLI runs it before packing (instant refusal); the organizer
    node runs it again inside ``sandbox_runner.run_static_checks`` and
    ``model_runner.validate_declarative_bundle`` (its verdict gates). Pass
    ``bundle_dir`` to enable the Lane A parameter-count cross-check.

    Returns ``{"check", "severity", "detail"}`` dicts; empty list = pass.
    """
    if not isinstance(manifest, dict):
        return [_finding(
            f"manifest is not a JSON object (got {type(manifest).__name__}) — "
            f"declarations cannot be read.")]

    f: list[dict] = []
    if "constraints" not in manifest:
        f.append(_finding(
            "manifest.constraints is missing — every contest entry declares "
            "its track, parameter count, weights licence, whether the weights "
            "are public, and (on the constrained track) its training data. "
            "Rebuild the bundle with --track/--parameter-count/"
            "--weights-license/--weights-public|--weights-private."))
    else:
        f.extend(constraints_block_findings(manifest["constraints"]))

    if "submission" not in manifest:
        f.append(_finding(
            "manifest.submission is missing — every contest entry declares "
            "whether it is the team's primary or a contrastive entry "
            "(--primary/--contrastive).", check="submission"))
    else:
        f.extend(submission_block_findings(manifest["submission"]))

    if (bundle_dir is not None
            and manifest.get("submissionKind") == DECLARATIVE_SUBMISSION_KIND
            and not any(x["check"] == "constraints" for x in f)):
        f.extend(parameter_count_findings(manifest, Path(bundle_dir)))
    return f


# ---------------------------------------------------------------------------
# Manifest → the contest_submissions row.
# ---------------------------------------------------------------------------

def submitter_label_from_manifest(manifest: dict) -> str:
    """The public display name for a submission — NEVER an email address.

    ``run_cards.submitter`` is world-readable, and the node used to write the
    participant's JWT email into it. The label is the developer's declared
    name, falling back to the method name when the developer field is absent
    or is itself an address.
    """
    developer = manifest.get("developer") or {}
    method = manifest.get("method") or {}
    candidates = [str(developer.get("name") or "").strip(),
                  str(method.get("name") or "").strip()]
    for candidate in candidates:
        if candidate and "@" not in candidate:
            return candidate
    raise DeclarationError(
        "No public submitter label available: developer.name and method.name "
        "are both empty or look like email addresses. The label is displayed "
        "publicly, so an address is never used — pass a --developer name.")


def submission_fields_from_manifest(manifest: dict) -> dict:
    """The `contest_submissions` columns carried by a bundle manifest.

    Returns EXACTLY the migration-074 column names in ``SUBMISSION_COLUMNS``;
    the writers POST this dict as-is. Refuses a manifest whose declarations
    would be blocked rather than writing a half-formed row.
    """
    problems = constraints_findings(manifest)
    if problems:
        raise DeclarationError(
            "Refusing to build a submission row from a manifest whose "
            "declarations are invalid:\n    "
            + "\n    ".join(p["detail"] for p in problems))
    constraints = dict(manifest["constraints"])
    submission = manifest["submission"]
    return {
        "track": constraints["track"],
        "is_primary": submission["isPrimary"],
        "description": submission["description"],
        "method_release_url": submission["methodReleaseUrl"],
        "constraints": constraints,
        "submitter_label": submitter_label_from_manifest(manifest),
    }
