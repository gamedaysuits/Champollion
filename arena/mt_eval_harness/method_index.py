"""method_index — the public index record of a contest method (V2 items 0b / 7).

A method enters a sealed contest as a deterministic bundle whose sha256 is its
identity (``method_sha``: model_bundle for Lane A weights, method_bundle for
Lane B code). That manifest also binds the entry to ONE contest (target
corpus, qualifier receipt) and carries the developer's email. Neither belongs
in a public method index: the same weights entered twice would get two
identities, and an email is not a byline.

The INDEX RECORD is a deterministic projection of the bundle manifest — what
the method is, who owns it, under what licence, how it decodes — plus the
bundle's ``method_sha``, so the record points at the exact bytes that were
scored. Its canonical bytes (sorted keys, no whitespace, UTF-8) are minted
here, once, in Python; ``index_record_sha256`` is what the node's signed
score manifest carries (``indexEntrySha256``). Anyone holding the bundle's
manifest.json can re-derive the record and check the sha — and a JS consumer
only ever verifies the sha of the bytes it is given, so no second
canonicalizer exists to drift.

An index ENTRY (V2 item 7) is this record plus a score with its CI and rank
cluster, keyed to the variety measured and never compared across test sets;
it is assembled from a frozen contest ranking, not here.
"""

from __future__ import annotations

import hashlib
import json
from typing import Optional

INDEX_RECORD_VERSION = 1

LANE_DECLARATIVE_MODEL = "declarative-model"   # Lane A: weights, trusted engine
LANE_METHOD_EXECUTION = "method-execution"     # Lane B: code, --network=none


class MethodIndexError(ValueError):
    """A manifest that cannot be projected into an honest index record."""


def _lane(manifest: dict) -> str:
    from mt_eval_harness.model_bundle import SUBMISSION_KIND
    return (LANE_DECLARATIVE_MODEL if manifest.get("submissionKind") == SUBMISSION_KIND
            else LANE_METHOD_EXECUTION)


def index_record(manifest: dict, *, method_sha: str,
                 image_digest: Optional[str] = None) -> dict:
    """Project a bundle manifest into the public index record.

    Kept: method identity, owner (name + affiliation — never the email),
    licence and openness of the weights, parameter count, track, declared
    training data, the language pair measured, and the decoding config (Lane
    A) or declared resources (Lane B). Dropped: the contest binding
    (target.corpusId), the qualifier receipt, the submission declarations,
    the agreement fields and the developer email.
    """
    if not isinstance(method_sha, str) or len(method_sha) != 64:
        raise MethodIndexError("method_sha must be the bundle's 64-hex sha256")
    method = manifest.get("method") or {}
    developer = manifest.get("developer") or {}
    constraints = manifest.get("constraints") or {}
    pair = (manifest.get("target") or {}).get("languagePair") or {}
    lane = _lane(manifest)
    # A method with no trained weights (parameterCount 0) has no weights
    # licence to record — the record says null rather than refusing the
    # method (contest_declarations: the weights pair is null when 0).
    weightless = constraints.get("parameterCount") == 0 and not isinstance(
        constraints.get("parameterCount"), bool)
    required = [("method.name", method.get("name")),
                ("method.version", method.get("version")),
                ("target.languagePair", pair.get("source") and pair.get("target"))]
    if not weightless:
        required.append(("constraints.weightsLicense",
                         constraints.get("weightsLicense")))
    for key, value in required:
        if not value:
            raise MethodIndexError(f"{key} is required for an index record")

    record = {
        "indexRecordVersion": INDEX_RECORD_VERSION,
        "lane": lane,
        "method": {
            "name": method["name"],
            "version": method["version"],
            "class": method.get("class"),
            "paradigm": method.get("paradigm"),
        },
        "owner": {
            "name": developer.get("name"),
            "affiliation": developer.get("affiliation") or None,
        },
        "licence": constraints.get("weightsLicense"),
        "weightsPublic": constraints.get("weightsPublic"),
        "parameterCount": constraints.get("parameterCount"),
        "track": constraints.get("track"),
        "trainingData": constraints.get("trainingData"),
        "languagePair": {"source": pair["source"], "target": pair["target"]},
        "methodSha256": method_sha,
    }
    if lane == LANE_DECLARATIVE_MODEL:
        model = manifest.get("model") or {}
        record["model"] = {
            "architecture": model.get("architecture"),
            "srcLang": model.get("srcLang"),
            "tgtLang": model.get("tgtLang"),
            "generation": dict(model.get("generation") or {}),
        }
    else:
        record["requirements"] = dict(manifest.get("requirements") or {})
        record["imageDigest"] = image_digest
    return record


def canonical_bytes(record: dict) -> bytes:
    """The one serialization of a record: sorted keys, no whitespace, UTF-8."""
    return json.dumps(record, sort_keys=True, ensure_ascii=False,
                      separators=(",", ":")).encode("utf-8")


def index_record_sha256(record: dict) -> str:
    return hashlib.sha256(canonical_bytes(record)).hexdigest()


def engine_versions() -> dict:
    """Installed versions of what computed a score — the harness alone does
    not pin sacreBLEU, transformers or torch. None where a package is absent."""
    import platform
    from importlib import metadata

    out = {"python": platform.python_version()}
    for dist in ("sacrebleu", "transformers", "torch", "ctranslate2",
                 "sentencepiece", "unbabel-comet"):
        try:
            out[dist] = metadata.version(dist)
        except metadata.PackageNotFoundError:
            out[dist] = None
    return out
