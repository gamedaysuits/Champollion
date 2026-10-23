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

The QUALIFIER SCORE (scoring standard/1, 2026-10-04): corpus chrF++ on its
native 0–100 scale — the standard's headline metric (scoring.PRIMARY_METRIC),
read from the TestReport this module's one scoring path produces. The public
qualifier threshold (cli/lib/sealed-qualifier.mjs, migration 042) is on that
scale. ``qualifier_score_from_report`` is the one place it is read. The
retired weighted composite is not computed into, returned by, or gated on by
this lane.
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
from mt_eval_harness.contest_declarations import (
    constraints_block_findings,
    url_problem,
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


#: The accepted hypotheses shapes, said in every refusal that names a shape.
HYPOTHESES_SHAPES = (
    "plain text, one translation per line in corpus order; or JSON keyed by "
    "entry id — {\"<id>\": \"text\", ...}, {\"hypotheses\": {...}}, or "
    "[{\"id\": ..., \"hypothesis\": ...}, ...]; or the harness run log "
    "(run_*.json, what `mt-eval run` writes) or its TestReport "
    "(*_report.json) as they are — their translations are read by entry id")


class RunOutputHypotheses(dict):
    """Translations read out of a harness run log or TestReport, by entry
    id, with the source sentence each one translated — so alignment can
    check that the run translated THIS corpus, not another with the same
    ids. ``origin`` names the file in messages."""

    def __init__(self, data: dict, *, sources: dict, origin: str):
        super().__init__(data)
        self.sources = sources
        self.origin = origin


def _run_output_hypotheses(data, p: Path) -> "RunOutputHypotheses | None":
    """A harness run log (``results``) or TestReport (``entries`` +
    ``overall``) as hypotheses — or None when ``data`` is neither. Passing a
    run log to `contest qualify --dev` used to fail with "Hypothesis for id
    'config' is not a string" (Round 9 researcher)."""
    if not isinstance(data, dict):
        return None
    if isinstance(data.get("results"), list) and ("config" in data
                                                  or "run_id" in data):
        rows, kind = data["results"], "run log"
    elif isinstance(data.get("entries"), list) and "overall" in data:
        rows, kind = data["entries"], "TestReport"
    else:
        return None
    out: dict[str, str] = {}
    sources: dict[str, str | None] = {}
    errored: list[str] = []
    for i, row in enumerate(rows):
        if not isinstance(row, dict) or "id" not in row:
            raise HypothesesFormatError(
                f"{p} is a harness {kind}, but its row {i} has no 'id'.")
        key = str(row["id"])
        if key in out or key in errored:
            raise HypothesesFormatError(
                f"{p} is a harness {kind} with entry id {key!r} twice — "
                f"every corpus entry gets exactly one hypothesis.")
        if row.get("error"):
            errored.append(key)
            continue
        text = row.get("predicted")
        if not isinstance(text, str):
            raise HypothesesFormatError(
                f"{p} is a harness {kind}, but entry {key!r} has no "
                f"'predicted' text.")
        out[key] = text
        sources[key] = row.get("source")
    if errored:
        raise HypothesesFormatError(
            f"{p} is a harness {kind} with {len(errored)} errored "
            f"entr{'y' if len(errored) == 1 else 'ies'} (first: "
            f"{', '.join(repr(e) for e in errored[:5])}) — an errored entry "
            f"has no translation, and every corpus entry is scored. Re-run "
            f"the run until every entry has a translation, then pass that run "
            f"log.")
    if not out:
        raise HypothesesFormatError(f"{p} is a harness {kind} with no rows.")
    return RunOutputHypotheses(out, sources=sources,
                               origin=f"the harness {kind} {p.name}")


def run_output_identity(path: str | Path) -> dict | None:
    """What a harness run log or TestReport says about the run that produced
    it — ``{kind, run_id, config, provenance}`` — or None for any other
    hypotheses file (plain text, id-keyed JSON), which names no run.

    `contest qualify` reads it to put the model on the receipt, and refuses
    a run that cannot name the model it ran (``engine_model``)."""
    p = Path(path)
    if p.suffix.lower() != ".json" or not p.is_file():
        return None
    try:
        data = json.loads(p.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    if not isinstance(data, dict):
        return None
    if isinstance(data.get("results"), list) and ("config" in data
                                                  or "run_id" in data):
        kind = "run log"
    elif isinstance(data.get("entries"), list) and "overall" in data:
        kind = "TestReport"
    else:
        return None
    return {"kind": kind, "run_id": data.get("run_id"),
            "config": data.get("config") or {},
            "provenance": data.get("provenance") or {}}


def source_run_summary(path: str | Path) -> dict | None:
    """The harness run a run-log / TestReport hypotheses file came from —
    ``{kind, run_id, model, method, cost_label}`` — or None for any other
    file, and for a file whose own outputs were scored as a file (a
    hypotheses run's log: it records its own source, if any, which is
    passed on). Recorded on the scoring run's config so the summary, the
    cost and the qualify screen tell one story (Round 13)."""
    ident = run_output_identity(path)
    if ident is None:
        return None
    cfg = ident["config"] or {}
    if cfg.get("provider") == "external":
        src = cfg.get("outputs_from_run")
        return dict(src) if isinstance(src, dict) else None
    try:
        data = json.loads(Path(path).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        data = {}
    from mt_eval_harness.run_card import run_cost_label
    label = (run_cost_label(data, None) if ident["kind"] == "run log"
             else run_cost_label(None, data))
    method = cfg.get("mt_method") or (
        f"method plugin {Path(str(cfg['method_path'])).name}"
        if str(cfg.get("method_path") or "").strip() else None)
    return {"kind": ident["kind"], "run_id": ident.get("run_id"),
            "model": cfg.get("model") or None, "method": method,
            "provider": cfg.get("provider") or None, "cost_label": label}


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
          - a harness run log (``results``) or TestReport (``entries``):
            each entry's ``predicted`` by its id (:class:`RunOutputHypotheses`
            — alignment also checks the run translated this corpus's sources)
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
        run_output = _run_output_hypotheses(data, p)
        if run_output is not None:
            return run_output
        if isinstance(data, dict) and isinstance(data.get("hypotheses"), dict):
            data = data["hypotheses"]
        if isinstance(data, dict):
            out = {}
            for key, value in data.items():
                if not isinstance(value, str):
                    raise HypothesesFormatError(
                        f"{p}: the value for id {key!r} is not a translation "
                        f"string (got {type(value).__name__}), so this is not "
                        f"a hypotheses file. Accepted: {HYPOTHESES_SHAPES}.")
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
            f"Unrecognized JSON hypotheses shape in {p}. Accepted: "
            f"{HYPOTHESES_SHAPES}.")

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
        origin = getattr(hypotheses, "origin", None)
        raise HypothesesFormatError(
            (f"{_cap(origin)} does not cover the corpus exactly"
             if origin else
             "Id-keyed hypotheses do not cover the corpus exactly")
            + f": {len(missing)} missing (first few: {missing[:5]}), "
            f"{len(extra)} unknown ids (first few: {extra[:5]}). "
            f"Every corpus entry needs exactly one hypothesis"
            + (" — run the method on THIS corpus file and pass that run log."
               if origin else "."))
    if isinstance(hypotheses, RunOutputHypotheses):
        # Same ids, other sentences = a run on another corpus (or another
        # version of it): its outputs are not translations of these sources.
        differ = [e_id for e_id, e in zip(wanted, corpus_entries)
                  if isinstance(e.get("source"), str)
                  and isinstance(hypotheses.sources.get(e_id), str)
                  and " ".join(e["source"].split())
                  != " ".join(hypotheses.sources[e_id].split())]
        if differ:
            raise HypothesesFormatError(
                f"{_cap(hypotheses.origin)} translated different source text "
                f"than this corpus for {len(differ)} of {len(wanted)} ids "
                f"(first: {differ[0]!r}) — it is a run on another corpus, or "
                f"another version of it. Run the method on THIS corpus file "
                f"and pass that run log.")
    return [hypotheses[i] for i in wanted]


def _cap(text: str) -> str:
    return text[:1].upper() + text[1:] if text else text


# ---------------------------------------------------------------------------
# The claimed method card — participant-claimed, honestly labeled.
# ---------------------------------------------------------------------------

def build_claimed_method_card(
    *,
    system_label: str,
    method_class: str,
    paradigm: str | None = None,
    description: str = "",
    constraints: dict | None = None,
    open_source_url: str | None = None,
) -> dict:
    """A method card for a self-scored / claimed submission.

    The class/paradigm are the PARTICIPANT'S claim, validated against the
    canonical vocabularies so the leaderboard's method-axis stays clean, and
    the card says out loud that the claim is not verifiable in this lane.

    ``constraints`` is the contract-C2 declarations block (track, parameter
    count, weights licence, weights public, training data) — carried onto the
    card so a reader can see what the entrant DECLARED. In this lane every one
    of those is a claim; only the Lane A card can say otherwise (the node
    re-derives parameterCount from the weights header). ``open_source_url`` is
    the optional public release location of the method — public information,
    never a condition of ranking.
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
    card = {
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
    if constraints is not None:
        problems = constraints_block_findings(constraints)
        if problems:
            raise ValueError(
                "Refusing to put an invalid constraints declaration on a "
                "method card:\n  - "
                + "\n  - ".join(p["detail"] for p in problems))
        card["constraints"] = dict(constraints)
        card["constraints_note"] = (
            "Participant DECLARATIONS. The track, weights licence, weights "
            "visibility and training-data list are unverifiable claims "
            "recorded as claims; nothing here was measured.")
    if open_source_url is not None:
        problem = url_problem(open_source_url)
        if problem:
            raise ValueError(
                f"open_source_url {open_source_url!r} {problem}.")
        card["open_source_url"] = open_source_url.strip()
    return card


def build_executed_method_card(
    *,
    system_label: str,
    method_class: str,
    paradigm: str | None = None,
    description: str = "",
    method_sha: str,
    node_id: str,
    constraints: dict | None = None,
    open_source_url: str | None = None,
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
        constraints=constraints,
        open_source_url=open_source_url,
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
    constraints: dict | None = None,
    open_source_url: str | None = None,
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
        constraints=constraints,
        open_source_url=open_source_url,
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
    if "constraints" in card:
        card["constraints_note"] = (
            "Participant DECLARATIONS, with ONE exception: parameterCount was "
            "re-derived from the submitted safetensors header and a claim off "
            "by more than 1% would have been refused. The track, weights "
            "licence, weights visibility and training-data list remain "
            "unverifiable claims recorded as claims.")
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
    execution: dict | None = None,
    by_test_suite: dict | None = None,
) -> dict:
    """Assemble a RunLog for externally-produced hypotheses.

    Entries follow pipeline.enrich_results' exact shape; telemetry fields are
    ZERO (no API was called — that is the truth, not a mock) and each entry is
    tagged external in metadata.

    ``execution`` and ``by_test_suite`` are contract C4: facts the EXECUTOR
    measured (a sandbox run's wall clock, the node's caps, the image digest;
    per-test-suite aggregates) travel with the report, so the publisher stays
    a pure function of the report instead of being handed side-channel data.
    Both are omitted entirely when None — an old run log is byte-identical.
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
            # The outputs were made outside the harness, so what they cost is
            # not known here (the one cost rule, run_card.cost_label: $0
            # only for a verified loopback model, else unknown). A stored
            # 0.0 printed "$0.0000" under `contest qualify` and wins every
            # cost comparison (synthetic researcher, Round 5).
            "cost_usd": None,
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
        # Unknown, not $0: scoring the file spends nothing, but the outputs
        # were produced elsewhere at a cost this harness never saw.
        total_cost=None,
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
    if execution is not None:
        run_log["provenance"]["execution"] = dict(execution)
    if by_test_suite is not None:
        run_log["provenance"]["by_test_suite"] = dict(by_test_suite)
    return run_log


def qualifier_score_from_report(overall: dict) -> float | None:
    """The chrF++ 0–100 qualifier score of a TestReport's ``overall`` block:
    corpus chrF++ (sacreBLEU chrF, word_order=2), rounded to 2 decimals —
    the scoring standard's headline metric. None when no chrF++ was
    computed (an empty or errored run): never a guess, never 0."""
    value = (overall or {}).get("corpus_chrf")
    if not isinstance(value, (int, float)) or isinstance(value, bool):
        return None
    return round(float(value), 2)


def _primary_ci(overall: dict) -> tuple[float | None, float | None]:
    """The chrF++ 95% bootstrap CI ``(lower, upper)`` when it was computed."""
    from mt_eval_harness.scoring import PRIMARY_CI_KEY
    ci = ((overall or {}).get("confidence_intervals") or {}).get(
        PRIMARY_CI_KEY) or {}
    lo, hi = ci.get("ci_lower"), ci.get("ci_upper")
    if isinstance(lo, (int, float)) and isinstance(hi, (int, float)):
        return round(float(lo), 2), round(float(hi), 2)
    return None, None


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
    execution: dict | None = None,
    by_test_suite: dict | None = None,
    summary_composite: bool = True,
) -> dict:
    """Score a hypotheses file against a reference corpus. THE entry point.

    Writes a RunLog + TestReport pair to ``output_dir`` (the file contract
    publish.assemble_run_card already understands — reused unchanged) and
    returns paths + the standard headline: ``qualifier_score`` IS corpus
    chrF++ (0–100) with its CI and signature; BLEU/spBLEU/TER/COMET beside
    it; exact match as a diagnostic. No composite and no tier (retired).

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

    ``execution`` / ``by_test_suite`` (contract C4) are recorded under
    ``run_log["provenance"]`` and copied onto the run card by
    publish.assemble_run_card. The hypotheses lane passes neither: nobody
    measured an execution there, and a zero would be a fabrication.
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
        execution=execution,
        by_test_suite=by_test_suite,
    )

    # A harness run log / TestReport as the hypotheses: the harness made
    # those outputs — say so, with that run's cost (run_card.outputs_line,
    # cost_label), not "made outside the harness" (Round 13).
    _src = source_run_summary(hypotheses_path)
    if _src:
        run_log["config"]["outputs_from_run"] = _src

    run_log_path = write_run_log(run_log, str(output_dir))
    report_path = run_log_path.with_name(run_log_path.stem + "_report.json")
    report = analyze_run_log(
        run_log,
        output_path=report_path,
        compute_ci=compute_ci,
        source_log_path=str(run_log_path.resolve()),
        # tester's flag; no composite line is printed since standard/1
        summary_composite=summary_composite,
    )
    if report.get("error"):
        raise RuntimeError(
            f"Scoring failed for {hypotheses_path}: {report['error']}")

    # The run card is assembled by its one home (publish.assemble_run_card)
    # for the uuid and fingerprint the node records. Lazy import: publish
    # pulls in auth/network modules the pure scoring path doesn't need.
    from mt_eval_harness.publish import assemble_run_card
    from mt_eval_harness.scoring import (
        PRIMARY_METRIC, SCORING_STANDARD, primary_signature,
    )

    _run_card, card_uuid, fingerprint_hash = assemble_run_card(report_path)

    overall = report.get("overall", {})
    ci_lower, ci_upper = _primary_ci(overall)
    return {
        "run_log_path": str(run_log_path),
        "report_path": str(report_path),
        "run_id": run_log["run_id"],
        "evaluated": overall.get("evaluated", 0),
        "scoring_standard": SCORING_STANDARD,
        # The headline and THE gating number: corpus chrF++ (0–100).
        "qualifier_metric": PRIMARY_METRIC,
        "qualifier_score": qualifier_score_from_report(overall),
        "chrf_plus_plus": overall.get("corpus_chrf"),
        "chrf_ci_lower": ci_lower,
        "chrf_ci_upper": ci_upper,
        "chrf_signature": primary_signature(overall.get("sacrebleu_signatures")),
        # Secondary standard metrics — beside chrF++, never blended.
        "corpus_bleu": overall.get("corpus_bleu"),
        "spbleu": overall.get("corpus_spbleu"),
        "ter": overall.get("corpus_ter"),
        "comet_score": overall.get("comet_score"),
        # A diagnostic, reported separately, never in the headline.
        "exact_match_rate": overall.get("exact_match_rate"),
        "run_card_uuid": card_uuid,
        "fingerprint_hash": fingerprint_hash,
        "hypotheses_sha256": run_log["provenance"]["hypotheses_sha256"],
        "corpus_sha256": run_log["provenance"]["corpus_sha256"],
    }
