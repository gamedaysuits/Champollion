"""external_scoring — score third-party HYPOTHESES through the standard pipeline.

The organizer scoring node (contest_node.py) and the participant CLI
(contest_intake.py) both need to score a file of translations that the harness
did NOT generate: a contest participant translated the released source side
with their own system and submitted the outputs. This module adapts that
external artifact into the harness's native flow so there is exactly ONE
scoring path (no parallel scorer that could drift):

    hypotheses file + corpus ──► RunLog (pipeline.build_run_log shape)
                                   └─► tester.analyze_run_log ─► TestReport
                                         └─► publish.assemble_run_card (unchanged)

Honesty rules (CLAUDE.md build-for-prod):
  * NOTHING is mocked: cost is 0.0 because scoring third-party hypotheses
    genuinely spends no API money; latency/usage fields are zero and the run
    is labeled ``condition='hypotheses-submission'`` so a reader can never
    mistake it for a live model run.
  * Method identity is PARTICIPANT-CLAIMED and unverifiable in this lane. The
    embedded method card says so explicitly; the claimed ``class``/``paradigm``
    must come from the canonical vocabularies (config.VALID_METHOD_CLASSES /
    VALID_PARADIGMS) or loading fails loud.
  * Alignment is exact or nothing: a hypotheses file that does not cover the
    corpus one-for-one (by id, or line-for-line) raises — never partial,
    never silently reordered.

The QUALIFIER SCALE: scoring.compute_composite_score returns 0.0–1.0; the
public qualifier threshold (cli/lib/sealed-qualifier.mjs, migration 042) is
expressed on the leaderboard's 0–100 scale. ``composite_to_qualifier_scale``
is the one conversion point.
"""

from __future__ import annotations

import hashlib
import json
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path

from mt_eval_harness.config import (
    DEFAULT_PARADIGM,
    RunConfig,
    VALID_METHOD_CLASSES,
    VALID_PARADIGMS,
)
from mt_eval_harness.corpus_loader import load_corpus
from mt_eval_harness.pipeline import build_run_log, write_run_log
from mt_eval_harness.tester import analyze_run_log

# The condition label every hypotheses-submission run carries (founder decision
# 2026-07-07: trust may read 'verified' — the ORGANIZER scored it — but the
# method is participant-claimed, and this label + the method-card note say so).
HYPOTHESES_CONDITION = "hypotheses-submission"

# The condition label for the Phase-B T2 lane: the organizer node EXECUTED the
# submitted method bundle itself inside a network-isolated sandbox
# (sandbox_runner.py), so method identity is execution-verified, not claimed.
METHOD_EXECUTION_CONDITION = "method-execution"

# The condition label for the DECLARATIVE-MODEL lane (Lane A, model_runner.py):
# the submission was DATA ONLY — safetensors weights + a declarative tokenizer
# + a config naming a whitelisted architecture — validated code-free and loaded
# into the organizer's OWN trusted inference engine (transformers,
# trust_remote_code=False, offline). No participant code ran at all, so this is
# the strongest provenance tier: not merely execution-verified but code-free by
# construction (no sandbox needed because there is nothing untrusted to jail).
DECLARATIVE_MODEL_CONDITION = "declarative-model"

_HYP_TEXT_KEYS = ("hypothesis", "predicted", "translation", "target")


class HypothesesFormatError(ValueError):
    """A hypotheses file that cannot be aligned exactly to the corpus."""


def sha256_file(path: str | Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


# ---------------------------------------------------------------------------
# Loading — two formats, exact alignment or a loud failure.
# ---------------------------------------------------------------------------

def load_hypotheses(path: str | Path) -> dict[str, str] | list[str]:
    """Load a hypotheses file.

    Accepted formats:
      * ``.json`` — id-keyed (preferred, order-independent):
          - ``{"hypotheses": {"<id>": "text", ...}}``
          - ``{"<id>": "text", ...}``
          - ``[{"id": ..., "hypothesis"|"predicted"|"translation"|"target": ...}, ...]``
      * anything else — plain text, ONE hypothesis per line, aligned to the
        corpus entry order (the classic WMT/AmericasNLP submission shape).

    Returns a ``{str(id): text}`` dict (JSON) or a ``list[str]`` (line-aligned).
    Raises HypothesesFormatError on anything ambiguous — never guesses.
    """
    p = Path(path)
    if not p.exists():
        raise HypothesesFormatError(f"Hypotheses file not found: {p}")

    if p.suffix.lower() == ".json":
        try:
            data = json.loads(p.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:
            raise HypothesesFormatError(
                f"Hypotheses file is not valid JSON: {p} ({exc})")
        if isinstance(data, dict) and isinstance(data.get("hypotheses"), dict):
            data = data["hypotheses"]
        if isinstance(data, dict):
            out = {}
            for key, value in data.items():
                if not isinstance(value, str):
                    raise HypothesesFormatError(
                        f"Hypothesis for id {key!r} is not a string "
                        f"(got {type(value).__name__}).")
                out[str(key)] = value
            if not out:
                raise HypothesesFormatError(f"Hypotheses file is empty: {p}")
            return out
        if isinstance(data, list):
            out = {}
            for i, item in enumerate(data):
                if not isinstance(item, dict) or "id" not in item:
                    raise HypothesesFormatError(
                        f"Hypotheses list item {i} has no 'id' field.")
                text = next(
                    (item[k] for k in _HYP_TEXT_KEYS if isinstance(item.get(k), str)),
                    None)
                if text is None:
                    raise HypothesesFormatError(
                        f"Hypotheses list item {i} (id={item['id']!r}) has none "
                        f"of the text fields {_HYP_TEXT_KEYS}.")
                key = str(item["id"])
                if key in out:
                    raise HypothesesFormatError(
                        f"Duplicate hypothesis id {key!r} — every corpus entry "
                        f"gets exactly one hypothesis.")
                out[key] = text
            if not out:
                raise HypothesesFormatError(f"Hypotheses file is empty: {p}")
            return out
        raise HypothesesFormatError(
            f"Unrecognized JSON hypotheses shape in {p} — expected an id-keyed "
            f"object, a {{'hypotheses': {{...}}}} wrapper, or a list of "
            f"{{'id', 'hypothesis'}} objects.")

    # Plain text: one hypothesis per line, corpus order. A trailing newline is
    # tolerated; interior blank lines are kept (they may be real translations
    # of blank segments — count is what must match).
    raw = p.read_text(encoding="utf-8")
    lines = raw.split("\n")
    if lines and lines[-1] == "":
        lines = lines[:-1]
    if not lines:
        raise HypothesesFormatError(f"Hypotheses file is empty: {p}")
    return lines


def align_hypotheses(
    corpus_entries: list[dict],
    hypotheses: dict[str, str] | list[str],
) -> list[str]:
    """Return hypotheses in corpus order — exact coverage or a loud error."""
    if isinstance(hypotheses, list):
        if len(hypotheses) != len(corpus_entries):
            raise HypothesesFormatError(
                f"Line-aligned hypotheses count mismatch: corpus has "
                f"{len(corpus_entries)} entries, file has {len(hypotheses)} "
                f"lines. Exact one-per-line coverage is required — a partial "
                f"file is never scored.")
        return list(hypotheses)

    wanted = [str(e["id"]) for e in corpus_entries]
    missing = [i for i in wanted if i not in hypotheses]
    extra = [k for k in hypotheses if k not in set(wanted)]
    if missing or extra:
        raise HypothesesFormatError(
            f"Id-keyed hypotheses do not cover the corpus exactly: "
            f"{len(missing)} missing (first few: {missing[:5]}), "
            f"{len(extra)} unknown ids (first few: {extra[:5]}). "
            f"Every corpus entry needs exactly one hypothesis.")
    return [hypotheses[i] for i in wanted]


# ---------------------------------------------------------------------------
# The claimed method card — participant-claimed, honestly labeled.
# ---------------------------------------------------------------------------

def build_claimed_method_card(
    *,
    system_label: str,
    method_class: str,
    paradigm: str | None = None,
    description: str = "",
) -> dict:
    """A method card for a hypotheses submission.

    The class/paradigm are the PARTICIPANT'S claim, validated against the
    canonical vocabularies so the leaderboard's method-axis stays clean, and
    the card says out loud that the claim is not verifiable in this lane.
    """
    if not system_label or not system_label.strip():
        raise ValueError("A hypotheses submission must name its system "
                         "(system_label) — anonymous rows are meaningless.")
    if method_class not in VALID_METHOD_CLASSES:
        raise ValueError(
            f"Claimed method class {method_class!r} is not in the canonical "
            f"vocabulary {sorted(VALID_METHOD_CLASSES)} (method-card-spec).")
    paradigm = paradigm or DEFAULT_PARADIGM
    if paradigm not in VALID_PARADIGMS:
        raise ValueError(
            f"Claimed paradigm {paradigm!r} is not in the canonical "
            f"vocabulary {sorted(VALID_PARADIGMS)}.")
    return {
        "name": system_label.strip(),
        "class": method_class,
        "paradigm": paradigm,
        "description": description or "Contest hypotheses submission.",
        "submission_lane": "hypotheses",
        "provenance_note": (
            "Method identity is PARTICIPANT-CLAIMED. This run scored a "
            "submitted hypotheses file; the organizer node verified the "
            "scores, not that the named method produced them (the T2 "
            "method-execution lane is where provenance becomes verifiable)."
        ),
    }


def build_executed_method_card(
    *,
    system_label: str,
    method_class: str,
    paradigm: str | None = None,
    description: str = "",
    method_sha: str,
    node_id: str,
) -> dict:
    """A method card for a T2 METHOD-EXECUTION run (Phase B).

    Unlike the hypotheses lane, provenance here is executable: the organizer
    node ran the submitted bundle (identified by ``method_sha``) itself inside
    a network-isolated sandbox, so the translations demonstrably came from the
    named artifact. Class/paradigm still validate against the canonical
    vocabularies. Honest limit stated on the card: the sandbox verifies WHAT
    ran, not the participant's description of how it was built.
    """
    if not method_sha or not str(method_sha).strip():
        raise ValueError("An executed-method card requires the method bundle "
                         "sha (method_sha) — that hash IS the provenance.")
    if not node_id or not str(node_id).strip():
        raise ValueError("An executed-method card requires the executing "
                         "node_id (self-reported Wave-1 identity).")
    card = build_claimed_method_card(
        system_label=system_label,
        method_class=method_class,
        paradigm=paradigm,
        description=description or "Contest method-bundle submission.",
    )
    card["submission_lane"] = "method-execution"
    card["method_sha"] = str(method_sha).strip()
    card["provenance_note"] = (
        f"Method identity is EXECUTION-VERIFIED: the organizer node "
        f"'{node_id}' ran the submitted method bundle "
        f"(sha256 {card['method_sha']}) inside a network-isolated container "
        f"(--network=none; sandbox-evaluation-spec) and scored its stdout "
        f"contract output. The sandbox proves WHICH artifact produced these "
        f"translations; the participant's class/paradigm description of that "
        f"artifact remains their claim. Node identity is self-reported "
        f"(no hardware attestation yet — Wave 2)."
    )
    return card


def build_declarative_model_card(
    *,
    system_label: str,
    method_class: str,
    paradigm: str | None = None,
    description: str = "",
    method_sha: str,
    node_id: str,
    architecture: str,
    engine: str = "transformers",
) -> dict:
    """A method card for a DECLARATIVE-MODEL run (Lane A, model_runner.py).

    The strongest provenance tier. Unlike the sandbox lane (which CONTAINS
    untrusted code), the declarative lane runs NO participant code at all: the
    submission was validated to be data only — safetensors weights + a
    declarative tokenizer + a config naming the whitelisted ``architecture`` —
    and loaded into the organizer's own trusted inference engine
    (``trust_remote_code=False``, offline). The card says so, and states the
    honest residual (trust reduces to the inference library + the weights are
    numerically the participant's, which can only affect translation quality,
    never exfiltrate).
    """
    if not method_sha or not str(method_sha).strip():
        raise ValueError("A declarative-model card requires the bundle sha "
                         "(method_sha) — that hash IS the provenance.")
    if not node_id or not str(node_id).strip():
        raise ValueError("A declarative-model card requires the executing "
                         "node_id (self-reported Wave-1 identity).")
    if not architecture or not str(architecture).strip():
        raise ValueError("A declarative-model card requires the whitelisted "
                         "architecture the trusted engine loaded.")
    card = build_claimed_method_card(
        system_label=system_label,
        method_class=method_class,
        paradigm=paradigm,
        description=description or "Contest declarative-model submission.",
    )
    card["submission_lane"] = "declarative-model"
    card["method_sha"] = str(method_sha).strip()
    card["architecture"] = str(architecture).strip()
    card["inference_engine"] = str(engine).strip()
    card["provenance_note"] = (
        f"Method identity is CODE-FREE BY CONSTRUCTION: the submission "
        f"(sha256 {card['method_sha']}) was validated to contain DATA ONLY — "
        f"safetensors weights + a declarative tokenizer + a config for the "
        f"whitelisted architecture '{card['architecture']}' — with NO "
        f"executable code, no pickle, and no trust_remote_code/auto_map. The "
        f"organizer node '{node_id}' loaded it into its OWN trusted inference "
        f"engine ({card['inference_engine']}, trust_remote_code=False, "
        f"offline) and scored the output. No participant code ran, so nothing "
        f"needed to be sandboxed. The participant's weights can only affect "
        f"translation quality, never exfiltrate; trust reduces to the "
        f"inference library. Node identity is self-reported (Wave-1)."
    )
    return card


# ---------------------------------------------------------------------------
# The RunLog adapter + the one scoring entry point.
# ---------------------------------------------------------------------------

def build_hypotheses_run_log(
    *,
    config: RunConfig,
    corpus_entries: list[dict],
    dataset_meta: dict,
    ordered_hypotheses: list[str],
    method_card: dict,
    corpus_sha256: str,
    hypotheses_sha256: str,
    elapsed_s: float,
    submission: dict | None = None,
    default_segment: str = "",
) -> dict:
    """Assemble a RunLog for externally-produced hypotheses.

    Entries follow pipeline.enrich_results' exact shape; telemetry fields are
    ZERO (no API was called — that is the truth, not a mock) and each entry is
    tagged external in metadata.
    """
    results = []
    for entry, hyp in zip(corpus_entries, ordered_hypotheses):
        results.append({
            "id": entry["id"],
            "cached": False,
            "source": entry.get(config.source_field, ""),
            "expected": entry.get(config.target_field, ""),
            "raw_predicted": hyp,
            "predicted": hyp,
            "segment": entry.get("segment", default_segment),
            "difficulty": entry.get("difficulty", 0),
            "domain": entry.get("domain", ""),
            "latency_s": 0,
            "usage": {},
            "cost_usd": 0.0,
            "tool_calls": [],
            "tool_call_count": 0,
            "error": None,
            "metadata": {"external_hypotheses": True},
        })

    run_id = (
        f"hypsub_{config.dataset_id or 'contest'}_"
        f"{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}_"
        f"{uuid.uuid4().hex[:6]}"
    )
    run_log = build_run_log(
        config=config,
        enriched_results=results,
        run_id=run_id,
        timestamp_start=datetime.now(timezone.utc).isoformat(),
        elapsed_s=elapsed_s,
        cache_hits=0,
        total_cost=0.0,   # truthful: scoring a submitted file spends nothing
        cached_cost=0.0,
        system_prompt="",
        system_prompt_sha256="",
        corpus_sha256=corpus_sha256,
        dataset_meta=dataset_meta,
        method_card=method_card,
    )
    # Submission provenance — who/what/where, digests only. The lane follows
    # the method card: 'hypotheses' (claimed) or 'method-execution' (Phase B,
    # execution-verified).
    run_log["provenance"]["hypotheses_sha256"] = hypotheses_sha256
    run_log["provenance"]["submission_lane"] = method_card.get(
        "submission_lane", "hypotheses")
    if submission:
        run_log["provenance"]["submission"] = dict(submission)
    return run_log


def composite_to_qualifier_scale(composite: float | None) -> float | None:
    """scoring.py composite (0.0–1.0) -> the qualifier/leaderboard 0–100 scale."""
    if composite is None:
        return None
    return round(float(composite) * 100.0, 2)


def score_hypotheses(
    *,
    corpus_path: str | Path,
    hypotheses_path: str | Path,
    dataset_id: str,
    source_lang: str,
    target_lang: str,
    system_label: str,
    method_class: str,
    paradigm: str | None = None,
    description: str = "",
    output_dir: str | Path,
    source_field: str = "source",
    target_field: str = "reference",
    target_lang_code: str = "",
    default_segment: str = "",
    submission: dict | None = None,
    compute_ci: bool = True,
    condition: str = HYPOTHESES_CONDITION,
    method_card: dict | None = None,
) -> dict:
    """Score a hypotheses file against a reference corpus. THE entry point.

    Writes a RunLog + TestReport pair to ``output_dir`` (the file contract
    publish.assemble_run_card already understands — reused unchanged) and
    returns paths + headline numbers, including the composite on both scales.

    ``corpus_path`` may be the PUBLIC dev corpus (participant self-score /
    the node's qualifier check) or the SECRET refs corpus decrypted to the
    organizer's scratch dir (the node's real scoring) — this function neither
    knows nor cares; the caller controls where the report lands and what gets
    published.

    ``condition``/``method_card`` default to the hypotheses lane. The Phase-B
    method-execution lane (sandbox_runner.py) passes
    ``condition=METHOD_EXECUTION_CONDITION`` and an execution-verified card
    (``build_executed_method_card``) — SAME scoring path, different honest
    labels; there is still exactly one scorer.
    """
    started = time.monotonic()
    corpus_path = Path(corpus_path)
    hypotheses_path = Path(hypotheses_path)

    config = RunConfig(
        dataset="all",
        dataset_id=dataset_id,
        corpus_path=str(corpus_path),
        source_field=source_field,
        target_field=target_field,
        source_lang=source_lang,
        target_lang=target_lang,
        target_lang_code=target_lang_code,
        model=system_label,
        provider="external",
        prompt_version=condition,
        cache_enabled=False,
    )

    corpus_entries, dataset_meta = load_corpus(config)
    if not corpus_entries:
        raise HypothesesFormatError(f"Corpus has no entries: {corpus_path}")

    hypotheses = load_hypotheses(hypotheses_path)
    ordered = align_hypotheses(corpus_entries, hypotheses)

    if method_card is None:
        method_card = build_claimed_method_card(
            system_label=system_label,
            method_class=method_class,
            paradigm=paradigm,
            description=description,
        )

    run_log = build_hypotheses_run_log(
        config=config,
        corpus_entries=corpus_entries,
        dataset_meta=dataset_meta,
        ordered_hypotheses=ordered,
        method_card=method_card,
        corpus_sha256=sha256_file(corpus_path),
        hypotheses_sha256=sha256_file(hypotheses_path),
        elapsed_s=time.monotonic() - started,
        submission=submission,
        default_segment=default_segment,
    )

    run_log_path = write_run_log(run_log, str(output_dir))
    report_path = run_log_path.with_name(run_log_path.stem + "_report.json")
    report = analyze_run_log(
        run_log,
        output_path=report_path,
        compute_ci=compute_ci,
        source_log_path=str(run_log_path.resolve()),
    )
    if report.get("error"):
        raise RuntimeError(
            f"Scoring failed for {hypotheses_path}: {report['error']}")

    # The composite is deliberately NOT recomputed here — assemble_run_card
    # (publish.py) is its one home (SCORING_SPEC §4 SSOT). Lazy import: publish
    # pulls in auth/network modules the pure scoring path doesn't need.
    from mt_eval_harness.publish import assemble_run_card

    run_card, card_uuid, fingerprint_hash = assemble_run_card(report_path)
    composite = run_card["scores"].get("composite")

    overall = report.get("overall", {})
    return {
        "run_log_path": str(run_log_path),
        "report_path": str(report_path),
        "run_id": run_log["run_id"],
        "evaluated": overall.get("evaluated", 0),
        "chrf_plus_plus": overall.get("corpus_chrf"),
        "corpus_bleu": overall.get("corpus_bleu"),
        "exact_match_rate": overall.get("exact_match_rate"),
        "composite": composite,                       # scoring.py 0.0–1.0
        "qualifier_score": composite_to_qualifier_scale(composite),  # 0–100
        "quality_tier": run_card["scores"].get("quality_tier"),
        "run_card_uuid": card_uuid,
        "fingerprint_hash": fingerprint_hash,
        "hypotheses_sha256": run_log["provenance"]["hypotheses_sha256"],
        "corpus_sha256": run_log["provenance"]["corpus_sha256"],
    }
