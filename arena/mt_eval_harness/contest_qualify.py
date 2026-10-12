"""contest_qualify — the PUBLIC QUALIFIER, the one admission gate a
participant can run alone.

Founder ruling 2026-09-06 (R2): a *contest* means sovereign hosting. Entries
are METHODS handed to the organizer's node — Lane A (declarative weights,
`contest submit-model`) or Lane B (code, `contest submit-method`, executed
`--network=none`). Uploading translations of a blind set is no longer an
entry path, so the thing that used to gate it (`contest submit-hypotheses`'s
local preview) becomes this: a standalone, offline, self-scored ADMISSION
gate over the PUBLIC dev set, whose result is a receipt on disk.

  mt-eval contest qualify <contest-id> --dev my-dev-hyps.txt \
      --dev-corpus eval-…-qualifier-v2026.json --system "acme-nmt" \
      --method-class pipeline

What the receipt IS: evidence that YOU scored YOUR system on the PUBLIC dev
set (references are published — instant, offline, free) at or above the
contest's threshold. `submit-method`/`submit-model` refuse to build a
submission without one and embed it in the bundle manifest as
``manifest["qualifier"]``.

What the receipt IS NOT: a verdict. It is unsigned and self-reported. The
organizer's node RE-EXECUTES the submitted method on the same dev set before
any grant is claimed (sandbox_runner.verify_qualifier_by_execution) and its
own measurement gates. A receipt that overstates the method is caught there,
with claimed-vs-measured in the denial.

The gate rule itself is not reimplemented here: it is
``qualifier_gate.is_eligible_for_sealed_run`` (the Python mirror of
``cli/lib/sealed-qualifier.mjs``), and the score comes from the ONE scorer,
``external_scoring.score_hypotheses``.
"""

from __future__ import annotations

import hashlib
import json
import re
from datetime import datetime, timezone
from pathlib import Path

from mt_eval_harness.external_scoring import score_hypotheses, sha256_file
from mt_eval_harness.qualifier_gate import (
    QUALIFIER_METRIC,
    QUALIFIER_SCALE,
    is_eligible_for_sealed_run,
    resolve_qualifier_metric,
    score_phrase,
    threshold_phrase,
)

RECEIPT_VERSION = "1.0.0"

# The one qualifier metric: corpus chrF++ on its 0-100 scale (scoring
# standard/1; qualifier_gate.QUALIFIER_SCALE). The receipt names it so it is
# honest about WHICH number it holds (card-integrity rule R4's doctrine applied
# to a receipt). It is the same number an `mt-eval run` card headlines for the
# same outputs. The retired qualifier composite is never computed here.
RECEIPT_METRIC = QUALIFIER_METRIC

#: The secondary standard metrics a receipt records beside chrF++ (never
#: blended into the score), and the diagnostic it records apart from both.
_RECEIPT_SECONDARY = ("corpus_bleu", "spbleu", "ter", "comet_score")
_RECEIPT_DIAGNOSTICS = ("exact_match_rate",)


def score_basis(result: dict) -> dict:
    """What a receipt's ``score`` is, from score_hypotheses' result: the
    scale, the standard, the chrF++ sacreBLEU signature, the secondary
    standard metrics beside it and the diagnostics apart from it (each only
    when computed — a metric that was not computed is absent, never 0)."""
    def present(keys):
        return {k: result.get(k) for k in keys
                if isinstance(result.get(k), (int, float))
                and not isinstance(result.get(k), bool)}
    return {
        "scale": "chrF++ 0-100 (corpus chrF++, sacreBLEU chrF word_order=2)",
        "scoringStandard": result.get("scoring_standard"),
        "signature": result.get("chrf_signature"),
        "secondary": present(_RECEIPT_SECONDARY),
        "diagnostics": present(_RECEIPT_DIAGNOSTICS),
    }


def secondary_line(result: dict) -> str:
    """``BLEU 21.3 · TER 61.2`` — the secondary standard metrics, or ''."""
    from mt_eval_harness.scoring import format_secondary
    return format_secondary({k: result.get(k) for k in _RECEIPT_SECONDARY})


def source_copy_refusal(report_path: str | Path) -> dict | None:
    """The qualifier's source-copy refusal for a scored dev run (a
    TestReport path), or None.

    A system whose dev outputs are mostly copies of their source is not
    translating, whatever its score: the contest lane runs no metric plugins,
    so an English echo scored chrF++ against the references cleared a
    threshold an LLM-backed method missed (8.7 vs 6.09 — synthetic
    researcher, Round 5). The rule is the harness's ONE source-copy rule —
    score_caveats.source_copy_refusal over score_caveats.source_copies — at
    the share bound the ``source_copy`` caveat uses. The organizer node
    applies the same function to its own re-execution. Gate policy is a
    founder item; the refusal ships because passing the gate with an echo is
    a bug.
    """
    from mt_eval_harness.score_caveats import (
        source_copy_refusal as _refusal,
    )
    report = json.loads(Path(report_path).read_text(encoding="utf-8"))
    return _refusal(report.get("entries") or [])


RECEIPT_NOTE = ("Local, unsigned self-score. The organizer node re-executes "
                "your method on the dev set; its verdict gates.")


def receipt_run_block(identity: dict | None, dev_hyp_path) -> dict | None:
    """What the receipt records about the run behind ``--dev``: the run id
    and the model it names. None for a hypotheses file that is not a run
    (plain text / id-keyed JSON names no model — the node's re-execution is
    the only check there).

    Refuses a run that cannot name the model it ran: a `--method
    local-model` run log written before Round 10 recorded no model, because
    the runner dropped -m and the engine could run its old default
    (Helsinki-NLP/opus-mt-en-es) instead — a receipt minted from it claimed
    a model that never ran (synthetic researcher, Round 10)."""
    if identity is None:
        return None
    from mt_eval_harness import engine_model as _em
    config = identity.get("config") or {}
    provenance = identity.get("provenance") or {}
    engine = _em.from_run(config, provenance)
    if engine is None and _em.engine_requires_model(config):
        raise QualifierError(
            f"{dev_hyp_path} is a `--method {config.get('mt_method')}` "
            f"{identity['kind']} that does not name the model that produced "
            f"it. Harness versions before Round 10 never passed -m to this "
            f"engine, which then ran Helsinki-NLP/opus-mt-en-es in its place "
            f"— look at the outputs. A receipt must come from a run that "
            f"names its model: re-run `mt-eval run --corpus <the dev corpus> "
            f"--method {config.get('mt_method')} -m <your model>` with this "
            f"harness and pass that run log.")
    block = {"kind": identity["kind"], "runId": identity.get("run_id")}
    if engine is not None:
        block["system"] = config.get("mt_method")
        block["model"] = _em.method_config_model(engine)
        block["engineModel"] = _em.public_block(engine)
        if engine.get("files"):
            # Per-file hashes: `contest submit-model` checks the weights it
            # packs are among them (the receipt names THESE weights).
            block["engineModel"]["files"] = [
                {"path": f.get("path"), "sha256": f.get("sha256")}
                for f in engine["files"] if isinstance(f, dict)]
    elif (config.get("method_path") or "").strip():
        plugin = provenance.get("method_plugin") or {}
        block["system"] = config.get("model") or config.get("method_path")
        block["model"] = (plugin.get("model_given") or config.get("method_model")
                          or ", ".join(plugin.get("models_called") or [])
                          or None)
        block["codeSha256"] = plugin.get("sha256")
    elif (config.get("mt_method") or "").strip():
        block["system"] = config.get("mt_method")
        block["model"] = None   # the engine translates with its own model
    else:
        block["system"] = "harness LLM"
        block["model"] = config.get("_model_id") or config.get("model")
    return block


def run_block_line(block: dict | None) -> str:
    """The qualify screen's "produced by" line."""
    if block is None:
        return ("not named — a hypotheses file names no model; the node's "
                "re-execution of what you submit is the check")
    engine = block.get("engineModel")
    if engine:
        from mt_eval_harness import engine_model as _em
        what = f"{block.get('system')} running {_em.label(engine)}"
    else:
        model = block.get("model")
        what = f"{block.get('system')}" + (f", model {model}" if model else "")
    return f"{what} — the {block.get('kind')} {block.get('runId') or '(no id)'}"


class QualifierError(RuntimeError):
    """A qualifier attempt that cannot proceed / did not clear — with the
    participant-facing reason. Never a bare traceback."""


class ContestRecordUnavailable(QualifierError):
    """The contest's qualifier could not be read from the contest database —
    not there (no such contest, no contest lane, no active qualifier) or not
    reachable. qualify() adds the offline route to the message: the
    qualifier is an offline self-score, and the two facts it reads from the
    database are published with the dev release."""


def offline_route(contest_id: str, *, dev_hyp_path, dev_corpus_path,
                  system_label: str, method_class: str,
                  paradigm: str | None = None,
                  receipt_dir=None) -> str:
    """The exact `contest qualify` command that needs no contest database:
    the caller's own arguments plus --offline-qualifier-id and
    --offline-threshold.

    The qualifier id is filled in only as what it demonstrably is for a
    contest made with `contest prepare` — the released dev corpus's own id
    (prepare names the qualifier after the dev set) — and labelled so. The
    threshold is never filled in: it is the organizer's number. When the dev
    file's description states it in words, that description is quoted so the
    entrant can read it there (synthetic researcher, Round 11: the not-found
    error named only endpoints, and the offline route was found by reading
    --help)."""
    import shlex

    corpus_id = description = None
    try:
        raw = Path(dev_corpus_path).read_text(encoding="utf-8")
        dataset = json.loads(raw).get("dataset") or {}
        corpus_id = str(dataset.get("corpus_id") or "").strip() or None
        description = str(dataset.get("description") or "").strip() or None
    except (OSError, json.JSONDecodeError, AttributeError):
        pass
    argv = ["mt-eval", "contest", "qualify", str(contest_id),
            "--dev", str(dev_hyp_path), "--dev-corpus", str(dev_corpus_path),
            "--system", str(system_label), "--method-class", str(method_class)]
    if paradigm:
        argv += ["--paradigm", str(paradigm)]
    if receipt_dir:
        argv += ["--receipt-dir", str(receipt_dir)]
    command = " ".join(shlex.quote(a) for a in argv)
    qid = shlex.quote(corpus_id) if corpus_id else "<qualifier-id>"
    lines = [
        "    qualify itself needs no contest database: it is an offline "
        "self-score. Pass the two qualifier facts the organizer published "
        "with the dev release:",
        f"      {command} \\",
        f"          --offline-qualifier-id {qid} --offline-threshold "
        f"<threshold>",
    ]
    if corpus_id:
        lines.append(
            f"    The qualifier id of a contest made with `mt-eval contest "
            f"prepare` is its dev corpus's own id — {corpus_id}, this "
            f"file's dataset.corpus_id; use the id the organizer published "
            f"if it differs.")
    lines.append(
        "    <threshold> is the organizer's number on the chrF++ 0-100 "
        "qualifier scale (corpus chrF++ of the dev outputs) and is never "
        "guessed"
        + (f". The dev file's own description says: \"{description}\""
           if description else "; ask the organizer if it was not published "
                               "with the dev set."))
    return "\n".join(lines)


def default_receipt_dir() -> Path:
    return Path.home() / ".mt-eval" / "qualifier"


def _contest_slug(contest_id: str) -> str:
    cid = str(contest_id or "").strip()
    if not cid:
        raise QualifierError("A contest id is required.")
    if "/" in cid or "\\" in cid or cid in (".", "..") or cid.startswith("."):
        raise QualifierError(
            f"Contest id {contest_id!r} is not a slug — refusing to build a "
            f"receipt path from it.")
    return cid


def contest_receipt_dir(contest_id: str,
                        receipt_dir: str | Path | None = None) -> Path:
    """The directory holding a contest's receipts, one per system."""
    base = Path(receipt_dir).expanduser() if receipt_dir else default_receipt_dir()
    return base / _contest_slug(contest_id)


def _system_label(system: str) -> str:
    label = str(system or "").strip()
    if not label:
        raise QualifierError(
            "A system name is required: a receipt is one system's admission "
            "to a contest (`contest qualify --system <name>`).")
    return label


def receipt_path(contest_id: str, receipt_dir: str | Path | None = None, *,
                 system: str) -> Path:
    """Where one system's receipt for a contest lives:
    ``<receipt-dir>/<contest-id>/<system-slug>-<8 hex>.json``.

    Keyed by contest AND system, because a contest admits several systems
    from one entrant: receipts were one file per contest, so qualifying a
    second system silently replaced the first (synthetic researcher, Round
    5). The slug keeps the file readable; the 8 hex characters are the
    sha256 of the exact label, so two labels that slug alike ("Acme NMT",
    "acme-nmt") never share a file. Contest ids are slugs; anything with a
    path separator is refused rather than silently normalized."""
    label = _system_label(system)
    slug = re.sub(r"[^a-z0-9]+", "-", label.lower()).strip("-")[:48] or "system"
    digest = hashlib.sha256(label.encode("utf-8")).hexdigest()[:8]
    return contest_receipt_dir(contest_id, receipt_dir) / f"{slug}-{digest}.json"


def legacy_receipt_path(contest_id: str,
                        receipt_dir: str | Path | None = None) -> Path:
    """Where a receipt written before receipts were keyed by system lived
    (``<receipt-dir>/<contest-id>.json``)."""
    base = Path(receipt_dir).expanduser() if receipt_dir else default_receipt_dir()
    return base / f"{_contest_slug(contest_id)}.json"


def _harness_version() -> str:
    from mt_eval_harness import __version__
    return __version__


def _resolve_qualifier(contest_id: str, offline_qualifier: dict | None) -> dict:
    """The qualifier row this receipt is scored against.

    Online: the contest's ACTIVE qualifier (anon-readable by design — the gate
    is public). Offline: the organizer-published qualifier_id + threshold,
    supplied by the caller; nothing is invented, so a missing field is loud.
    """
    if offline_qualifier is not None:
        if not isinstance(offline_qualifier, dict):
            raise QualifierError(
                "offline_qualifier must be a dict of the organizer-published "
                "qualifier facts (qualifier_id, threshold, corpus_card_id).")
        qid = str(offline_qualifier.get("qualifier_id") or "").strip()
        if not qid:
            raise QualifierError(
                "offline_qualifier needs qualifier_id — the id the organizer "
                "published with the dev release (there is no default).")
        if offline_qualifier.get("threshold") is None:
            raise QualifierError(
                "offline_qualifier needs threshold — the calibrated floor the "
                "organizer published. A qualifier threshold is contest DATA, "
                "never a code default.")
        try:
            threshold = float(offline_qualifier["threshold"])
        except (TypeError, ValueError) as exc:
            raise QualifierError(
                f"offline_qualifier threshold is not a number: "
                f"{offline_qualifier['threshold']!r}") from exc
        return {
            "contest": {"id": contest_id,
                        "language_pair": offline_qualifier.get(
                            "language_pair", ">")},
            "qualifier": {
                "qualifier_id": qid,
                "corpus_card_id": offline_qualifier.get("corpus_card_id"),
                "threshold": threshold,
                "metric": offline_qualifier.get("metric", RECEIPT_METRIC),
                "year": offline_qualifier.get("year"),
            },
            "offline": True,
        }

    from mt_eval_harness.contest_intake import (
        ContestUnavailable, IntakeError, fetch_contest_bundle,
    )
    try:
        bundle = fetch_contest_bundle(contest_id)
    except ContestUnavailable as exc:
        raise ContestRecordUnavailable(str(exc)) from exc
    except IntakeError as exc:
        # The contest IS there and says no (closed, intake not open): no
        # offline route is offered for that.
        raise QualifierError(str(exc)) from exc
    except RuntimeError as exc:
        # Network error or a server error reading the contest database.
        raise ContestRecordUnavailable(
            f"Could not read contest {contest_id!r} from the contest "
            f"database: {exc}") from exc
    return {"contest": bundle["contest"], "qualifier": bundle["qualifier"],
            "offline": False}


def qualify(contest_id: str, *,
            dev_hyp_path: str | Path,
            dev_corpus_path: str | Path,
            system_label: str,
            method_class: str,
            paradigm: str | None = None,
            receipt_dir: str | Path | None = None,
            offline_qualifier: dict | None = None,
            write_receipt: bool = True,
            scratch_dir: str | Path | None = None) -> dict:
    """Self-score the PUBLIC dev set and write the qualifier receipt.

    ``write_receipt=False`` is the rehearsal (`contest validate`): the same
    scoring, verdict and refusal, and NO receipt file — no new one, none
    moved to history. validate used to call this and mint a second receipt
    under the bundle's name beside the one the entrant had qualified
    (synthetic researcher, Round 6). ``scratch_dir`` overrides where the
    scored run files go (validate keeps them in its own temp dir).

    ``dev_corpus_path`` is the released public dev corpus (source + refs); its
    ``dataset.corpus_id`` must BE the qualifier's corpus card, so a right
    score against the wrong file is impossible.

    Returns the receipt dict. A FAILING score still writes the receipt (with
    ``passed: false`` — the attempt is a fact, not something to hide) and then
    raises :class:`QualifierError`.
    """
    dev_hyp_path = Path(dev_hyp_path)
    dev_corpus_path = Path(dev_corpus_path)
    for p, what in ((dev_hyp_path, "dev hypotheses"),
                    (dev_corpus_path, "public dev corpus")):
        if not p.exists():
            raise QualifierError(f"{what} file not found: {p}")

    try:
        resolved = _resolve_qualifier(contest_id, offline_qualifier)
    except ContestRecordUnavailable as exc:
        raise QualifierError(
            f"{exc}\n" + offline_route(
                contest_id, dev_hyp_path=dev_hyp_path,
                dev_corpus_path=dev_corpus_path, system_label=system_label,
                method_class=method_class, paradigm=paradigm,
                receipt_dir=receipt_dir)) from exc
    contest, qualifier = resolved["contest"], resolved["qualifier"]

    try:
        dev_meta = json.loads(dev_corpus_path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError) as exc:
        raise QualifierError(
            f"public dev corpus {dev_corpus_path} is not readable JSON: "
            f"{exc}") from exc
    dev_corpus_id = ((dev_meta.get("dataset") or {}).get("corpus_id") or "")
    expected_corpus_id = qualifier.get("corpus_card_id")
    if not expected_corpus_id:
        raise QualifierError(
            f"The qualifier {qualifier['qualifier_id']!r} carries no "
            f"corpus_card_id — without it the dev file cannot be verified as "
            f"the right one. Ask the organizer (fail-safe).")
    if dev_corpus_id != expected_corpus_id:
        raise QualifierError(
            f"The dev corpus file identifies as {dev_corpus_id!r} but the "
            f"contest's qualifier is {expected_corpus_id!r} — download the "
            f"current qualifier release and retry.")

    # What gates: corpus chrF++ (scoring standard/1). A qualifier row that
    # names the retired composite (042's column default) is gated on chrF++
    # with its threshold read on the chrF++ scale, and that is said below and
    # recorded in the receipt; any other metric is refused before scoring.
    threshold = float(qualifier["threshold"])
    try:
        metric_basis = resolve_qualifier_metric(qualifier.get("metric"),
                                                threshold)
    except ValueError as exc:
        raise QualifierError(
            f"Qualifier {qualifier['qualifier_id']!r}: {exc}") from exc

    # The run behind --dev, when it is a run log or TestReport: the receipt
    # names the model it ran, and a run that cannot name it is refused
    # before anything is scored (receipt_run_block).
    from mt_eval_harness.external_scoring import run_output_identity
    _identity = run_output_identity(dev_hyp_path)
    run_block = receipt_run_block(_identity, dev_hyp_path)

    if scratch_dir is not None:
        scratch = Path(scratch_dir).expanduser()
    elif receipt_dir:
        scratch = Path(receipt_dir).expanduser() / "scratch"
    else:
        scratch = Path.home() / ".mt-eval" / "qualifier-scratch" / str(contest_id)
    scratch.mkdir(parents=True, exist_ok=True)
    from mt_eval_harness.pair_notation import split_pair
    src, tgt = split_pair(contest.get("language_pair"))
    result = score_hypotheses(
        corpus_path=dev_corpus_path,
        hypotheses_path=dev_hyp_path,
        dataset_id=expected_corpus_id,
        source_lang=src or "source",
        target_lang=tgt or "target",
        system_label=system_label,
        method_class=method_class,
        paradigm=paradigm,
        output_dir=scratch,
        compute_ci=False,
        # ONE gating number on this screen — the qualifier score below;
        # qualify publishes nothing (Round 8).
        summary_composite=False,
    )

    # What qualifies the score (score_caveats over these dev outputs): a
    # system that repeats one sentence, drops words, or echoes its source is
    # named here beside its chrF++, the same caveats a run card carries.
    from mt_eval_harness.score_caveats import collect as _collect_caveats
    try:
        caveats = _collect_caveats(json.loads(
            Path(result["report_path"]).read_text(encoding="utf-8")))
    except (OSError, json.JSONDecodeError) as exc:
        raise QualifierError(
            f"the scored dev report {result['report_path']} is not readable: "
            f"{exc}") from exc

    verdict = is_eligible_for_sealed_run(
        qualifier_id=qualifier["qualifier_id"],
        score=result["qualifier_score"],
        threshold=threshold,
        qualifier_year=qualifier.get("year"),
        current_year=datetime.now(timezone.utc).year,
    )
    # Mostly copies of the source is not translating — refused whatever the
    # score (source_copy_refusal; the organizer node applies the same rule).
    refusal = source_copy_refusal(result["report_path"])

    receipt = {
        "receiptVersion": RECEIPT_VERSION,
        "contestId": contest_id,
        # The system this receipt admits (receipts are keyed by contest AND
        # system — receipt_path) and what it claimed to be.
        "system": system_label,
        "methodClass": method_class,
        "paradigm": paradigm,
        "qualifierId": qualifier["qualifier_id"],
        "devCorpusSha256": sha256_file(dev_corpus_path),
        "hypothesesSha256": sha256_file(dev_hyp_path),
        "metric": RECEIPT_METRIC,
        "score": result["qualifier_score"],
        # What `score` is: corpus chrF++, its signature, and the standard
        # metrics beside it (never blended in). Local detail only: the
        # manifest copies QUALIFIER_MANIFEST_FIELDS, never this, so no
        # declaration a bundle records changes.
        "scoreBasis": score_basis(result),
        "threshold": threshold,
        # The run the hypotheses came from and the model it names (None for a
        # plain hypotheses file). `submit-model` checks a directory model's
        # weights against it; the node's re-execution checks the score.
        "run": run_block,
        "passed": bool(verdict["eligible"]) and refusal is None,
        "harnessVersion": _harness_version(),
        "scoredAt": datetime.now(timezone.utc).isoformat(),
        "selfReported": True,
        "note": RECEIPT_NOTE,
    }
    if metric_basis["note"]:
        # The qualifier row named the retired composite: what it recorded,
        # and how its threshold was read.
        receipt["thresholdMetricAsRecorded"] = metric_basis["recorded"]
        receipt["thresholdNote"] = metric_basis["note"]
    if refusal is not None:
        receipt["refusal"] = refusal
    dest = receipt_path(contest_id, receipt_dir, system=system_label)
    kept = None
    if write_receipt:
        kept = _keep_previous_receipt(dest)
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(json.dumps(receipt, ensure_ascii=False, indent=2)
                        + "\n", encoding="utf-8")

    print(f"\n  Qualifier {qualifier['qualifier_id']} ({contest_id}) — "
          f"nothing is published by qualify:")
    print(f"    Qualifier score (what gates): "
          f"{score_phrase(result['qualifier_score'])} vs threshold "
          f"{threshold_phrase(threshold)}")
    if metric_basis["note"]:
        print(f"    Note: {metric_basis['note']}")
    print(f"    Produced by: {run_block_line(run_block)}")
    # What the number is, every time: the metric, its signature, and the
    # standard metrics beside it — none of them blended into it.
    print(f"    What it is: {QUALIFIER_SCALE}.")
    if result.get("chrf_signature"):
        print(f"      sacreBLEU signature: {result['chrf_signature']}")
    _secondary = secondary_line(result)
    if _secondary:
        print(f"      Beside it (standard metrics, never blended): "
              f"{_secondary}")
    if isinstance(result.get("exact_match_rate"), (int, float)):
        print(f"      Diagnostic (never gates): exact match "
              f"{result['exact_match_rate']:.1%}")
    if caveats:
        from mt_eval_harness.score_caveats import caveat_lines
        for line in caveat_lines(caveats, width=78, indent="      "):
            print(line)
    if verdict.get("badge") and verdict["badge"].get("badge") \
            and refusal is None:
        print(f"    {verdict['badge']['badge']}")
    if refusal is not None:
        # Not "cleared … eligible to propose": the score is not the verdict.
        print(f"    ✗ Refused: {refusal['reason']}")
    else:
        print(f"    {verdict['reason']}")
    if write_receipt:
        print(f"    Receipt: {dest} (system {system_label!r})")
        if kept is not None:
            print(f"    The previous receipt for this system is kept at "
                  f"{kept}.")
    else:
        print("    Rehearsal: no receipt written (`mt-eval contest qualify` "
              "writes receipts).")
    print(f"    {RECEIPT_NOTE}")

    written = (f" Receipt written to {dest} with passed=false"
               if write_receipt else " (rehearsal: no receipt written)")
    if refusal is not None:
        print("    ✗ FAIL")
        raise QualifierError(
            f"Qualifier NOT met: {refusal['reason']}{written}"
            + (" and the refusal recorded." if write_receipt else "."))
    if not verdict["eligible"]:
        print("    ✗ FAIL")
        raise QualifierError(
            f"Qualifier NOT met: {verdict['reason']}{written}; improve the "
            f"dev score and re-run `mt-eval contest qualify {contest_id} …` "
            f"before submitting.")
    ready_lines, readiness = submit_readiness(_identity)
    for line in ready_lines:
        print(line)
    if readiness == "blocked":
        print("    ✅ PASS on the qualifier — but `contest submit-method` "
              "will refuse the method as it stands (above); fix that before "
              "submitting.")
    elif readiness == "no-method":
        print("    ✅ PASS on the qualifier — these outputs are not an entry "
              "yet: submit a method that carries its model (above).")
    elif write_receipt:
        print("    ✅ PASS on the qualifier. Next: submit the method that made "
              "these outputs (`mt-eval contest submit-method` / "
              "`submit-model`). Submitting checks more before anything is "
              "sent — the static scan the node runs (no network library or "
              "shell network tool, no forbidden filesystem path), that every "
              "model the method calls is inside the bundle, and that the "
              "bundle matches this receipt — and the node then re-executes "
              "it with no network.")
    else:
        print("    ✅ PASS on this rehearsal.")
    return receipt


def submit_readiness(identity: dict | None) -> tuple[list[str], str]:
    """What qualify can already say about SUBMITTING the method behind
    ``--dev``: ``(lines, status)`` — status ``blocked`` (the static scan
    refuses it), ``no-method`` (outputs of the harness's own LLM path),
    ``ok`` (the scan passes) or ``unknown`` (nothing to check here).

    A qualifier pass said "you may now submit a method" for outputs that no
    submission could carry: a method calling a model server over the network
    (the persona's own plugin, refused at submit by the static scan for
    ``import urllib``), and a harness LLM run that has no method directory
    at all (synthetic researcher, Round 13). Now:

    * a method-plugin run whose directory is on this machine gets the SAME
      static scan ``submit-method`` and the node run (sandbox_runner
      ``scan_network_calls`` + ``audit_filesystem_access``) — a BLOCK is
      shown here (status ``blocked``);
    * a harness-LLM run (a model reached through a provider) is told it has
      no method to submit as it is: a sealed node runs a submitted method
      with no network, so the model must be bundled.
    Nothing here changes the qualifier verdict or the receipt.
    """
    if not identity:
        return [], "unknown"
    config = identity.get("config") or {}
    method_path = str(config.get("method_path") or "").strip()
    if method_path and not config.get("mt_method"):
        mdir = Path(method_path).expanduser()
        if not mdir.is_dir():
            return [f"    Submit check: the method directory this run used "
                    f"({method_path}) is not on this machine, so its static "
                    f"scan was not run here — `submit-method` runs it."], "unknown"
        from mt_eval_harness.sandbox_runner import (
            audit_filesystem_access, scan_network_calls)
        findings = scan_network_calls(mdir) + audit_filesystem_access(mdir)
        blocks = [f for f in findings if f.get("severity") == "BLOCK"]
        if blocks:
            return ([f"    ⚠ Submit check: `contest submit-method` and the "
                     f"node's static scan would refuse {mdir} as it stands "
                     f"(the node runs methods with no network):"]
                    + [f"        {b['detail']}" for b in blocks[:8]]
                    + ([f"        … and {len(blocks) - 8} more"]
                       if len(blocks) > 8 else [])
                    + ["      Bundle every model the method calls (Lane A: "
                       "`submit-model` with its weights; Lane B: a "
                       "self-contained method) — see the sovereign-contest "
                       "guide, 'Bundle every model your method calls'."],
                    "blocked")
        return [f"    Submit check: {mdir} passes the static scan "
                f"`submit-method` and the node run (network, filesystem)."], "ok"
    if not config.get("mt_method") and config.get("provider") != "external":
        model = config.get("_model_id") or config.get("model") or "?"
        provider = config.get("provider") or "openrouter"
        return [f"    ⚠ Submit check: these outputs came from the harness's own "
                f"LLM path (model {model} through provider {provider}), which "
                f"is not a method you can submit: a sealed node runs a "
                f"submitted method with no network, so a model reached "
                f"through a provider cannot run there. Enter a method that "
                f"carries its model (Lane A: `submit-model` with its weights; "
                f"Lane B: a self-contained `submit-method` bundle)."], "no-method"
    return [], "unknown"


def _keep_previous_receipt(dest: Path) -> Path | None:
    """Move an existing receipt for the same contest + system into
    ``history/`` before it is replaced, and say where (re-qualifying a system
    after improving it is the normal loop, so this keeps the old attempt
    rather than refusing — it is never silently overwritten). None when
    there was nothing to keep."""
    if not dest.is_file():
        return None
    stamp = ""
    try:
        stamp = str(json.loads(dest.read_text(encoding="utf-8"))
                    .get("scoredAt") or "")
    except (OSError, json.JSONDecodeError, AttributeError):
        stamp = ""
    stamp = (re.sub(r"[^0-9A-Za-z]+", "", stamp)[:22]
             or datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%f"))
    history = dest.parent / "history"
    history.mkdir(parents=True, exist_ok=True)
    target = history / f"{dest.stem}.{stamp}.json"
    n = 1
    while target.exists():
        target = history / f"{dest.stem}.{stamp}.{n}.json"
        n += 1
    dest.replace(target)
    return target


def contest_receipts(contest_id: str,
                     receipt_dir: str | Path | None = None) -> list[tuple[Path, dict | None]]:
    """Every system's receipt for a contest: ``[(path, receipt or None)]``
    (None for a file that does not parse — it is still listed)."""
    d = contest_receipt_dir(contest_id, receipt_dir)
    out: list[tuple[Path, dict | None]] = []
    if d.is_dir():
        for f in sorted(d.glob("*.json")):
            try:
                r = json.loads(f.read_text(encoding="utf-8"))
            except (OSError, json.JSONDecodeError):
                r = None
            out.append((f, r if isinstance(r, dict) else None))
    return out


def find_receipt_for_block(contest_id: str, block: dict,
                           receipt_dir: str | Path | None = None,
                           ) -> tuple[Path, dict] | None:
    """The receipt on this machine that a bundle's ``manifest["qualifier"]``
    was copied from, as ``(path, receipt)``, or None.

    submit-method / submit-model copy the receipt they were given
    (``--system``) onto the manifest field for field (contest_declarations.
    QUALIFIER_MANIFEST_FIELDS, ``scoredAt`` and the hypotheses hash among
    them), so the one receipt every copied field matches IS the one the
    bundle was packaged with — whatever the bundle's method is called. Current
    receipts are searched first, then ``history/`` (a receipt the entrant has
    since replaced by re-qualifying the same system)."""
    from mt_eval_harness.contest_declarations import QUALIFIER_MANIFEST_FIELDS
    if not isinstance(block, dict) or any(
            k not in block for k in QUALIFIER_MANIFEST_FIELDS):
        return None
    d = contest_receipt_dir(contest_id, receipt_dir)
    candidates = [p for p, _r in contest_receipts(contest_id, receipt_dir)]
    if (d / "history").is_dir():
        candidates += sorted((d / "history").glob("*.json"))
    for path in candidates:
        try:
            receipt = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        if isinstance(receipt, dict) and all(
                receipt.get(k) == block[k] for k in QUALIFIER_MANIFEST_FIELDS):
            return path, receipt
    return None


def _receipt_summary(path: Path, receipt: dict | None) -> str:
    if receipt is None:
        return f"{path.name} (unreadable)"
    state = "passed" if receipt.get("passed") else "did not pass"
    return f"{receipt.get('system')!r} ({state}, {receipt.get('score')})"


def _read_receipt(dest: Path, contest_id: str,
                  expect_system: str | None = None) -> dict:
    try:
        receipt = json.loads(dest.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError) as exc:
        raise QualifierError(
            f"Qualifier receipt {dest} is unreadable ({exc}) — delete it and "
            f"re-run `mt-eval contest qualify {contest_id} …`.") from exc
    if not isinstance(receipt, dict):
        raise QualifierError(
            f"Qualifier receipt {dest} is not a JSON object — delete it and "
            f"re-run `mt-eval contest qualify {contest_id} …`.")
    if expect_system is not None and receipt.get("system") != expect_system:
        raise QualifierError(
            f"Qualifier receipt {dest} names system "
            f"{receipt.get('system')!r}, not {expect_system!r} — it was "
            f"edited or moved. Re-run `mt-eval contest qualify {contest_id} "
            f"… --system {expect_system!r}`.")
    return receipt


def load_receipt(contest_id: str,
                 receipt_dir: str | Path | None = None, *,
                 system: str | None = None,
                 name_hint: str | None = None) -> dict:
    """Read the receipt a submission is gated on. Missing, ambiguous or
    unparseable is a loud refusal — a submission may never proceed on an
    assumed pass, nor on another system's receipt.

    ``system`` (submit's ``--system``) names the receipt exactly. Without it,
    the receipt of the system called ``name_hint`` (the submission's
    ``--name``) is used when there is one, else the contest's ONLY receipt;
    several and none matching is refused with the list. A receipt written
    before receipts were keyed by system (``<contest-id>.json``) is read
    only when the contest has no keyed receipt, and said so.
    """
    cid = _contest_slug(contest_id)
    run_qualify = (f"`mt-eval contest qualify {cid} --dev <your-dev-hyps> "
                   f"--dev-corpus <released-dev-corpus> --system <name> "
                   f"--method-class <class>`")
    found = contest_receipts(cid, receipt_dir)
    others = ", ".join(_receipt_summary(p, r) for p, r in found)
    if system is not None:
        dest = receipt_path(cid, receipt_dir, system=system)
        if not dest.is_file():
            raise QualifierError(
                f"No qualifier receipt for system {system!r} in contest "
                f"{cid!r} (looked for {dest})."
                + (f" Receipts for this contest: {others}." if found else "")
                + f" Run {run_qualify.replace('<name>', repr(system))} "
                  f"first, or pass the --system a receipt was written for.")
        return _read_receipt(dest, cid, expect_system=system)
    if name_hint:
        dest = receipt_path(cid, receipt_dir, system=name_hint)
        if dest.is_file():
            return _read_receipt(dest, cid, expect_system=name_hint)
    if len(found) == 1:
        path, _r = found[0]
        receipt = _read_receipt(path, cid)
        print(f"  Using the contest's only qualifier receipt: system "
              f"{receipt.get('system')!r} ({path}).")
        return receipt
    if len(found) > 1:
        raise QualifierError(
            f"Several systems have qualifier receipts for contest {cid!r}: "
            f"{others}"
            + (f" — none for {name_hint!r}" if name_hint else "")
            + ". Pass --system <name> to say which system this submission "
              "is (the name given to `contest qualify --system`).")
    legacy = legacy_receipt_path(cid, receipt_dir)
    if legacy.is_file():
        receipt = _read_receipt(legacy, cid)
        print(f"  Note: using {legacy}, a receipt written before receipts "
              f"were kept per system; re-run `mt-eval contest qualify {cid} "
              f"… --system <name>` to replace it with a keyed one.")
        return receipt
    raise QualifierError(
        f"No qualifier receipt for contest {cid!r} under "
        f"{contest_receipt_dir(cid, receipt_dir)}. Run {run_qualify} first — "
        f"the public dev set is the admission gate for the sealed lane.")


def require_pass(receipt: dict, *, contest_id: str, qualifier_id: str,
                 threshold: float) -> dict:
    """Gate a submission on a receipt. Fail-safe in every direction: a
    failing receipt, a receipt for another contest or another qualifier, or
    one scored against a LOWER bar than the live one, all refuse. So does a
    receipt whose score is not chrF++: one minted before scoring standard/1
    holds the retired qualifier composite (``metric: "composite"``), a
    different number on a different scale from what the threshold now gates.

    Returns the receipt so callers can embed it verbatim in the manifest."""
    if not isinstance(receipt, dict):
        raise QualifierError("Qualifier receipt is not a JSON object.")
    if receipt.get("metric") != RECEIPT_METRIC:
        raise QualifierError(
            f"Qualifier receipt for {receipt.get('contestId')!r} holds metric "
            f"{receipt.get('metric')!r}, not {RECEIPT_METRIC!r}: it was "
            f"scored before scoring standard/1 retired the qualifier "
            f"composite, and the qualifier now gates on corpus chrF++ "
            f"(0-100). Re-run `mt-eval contest qualify {contest_id} …` — "
            f"the same dev outputs are rescored offline in seconds.")
    if receipt.get("contestId") != contest_id:
        raise QualifierError(
            f"Qualifier receipt is for contest "
            f"{receipt.get('contestId')!r}, not {contest_id!r} — run "
            f"`mt-eval contest qualify {contest_id} …`.")
    if receipt.get("qualifierId") != qualifier_id:
        raise QualifierError(
            f"Qualifier receipt cleared {receipt.get('qualifierId')!r} but "
            f"this contest's ACTIVE qualifier is {qualifier_id!r} (the "
            f"qualifier rotates yearly) — re-qualify against the current "
            f"release.")
    if not receipt.get("passed"):
        raise QualifierError(
            f"Qualifier receipt for {contest_id!r} records passed=false "
            f"(scored {receipt.get('score')} against threshold "
            f"{receipt.get('threshold')}) — the sealed lane is not open to "
            f"this method yet.")
    try:
        live = float(threshold)
    except (TypeError, ValueError) as exc:
        raise QualifierError(
            f"Live qualifier threshold is not a number: {threshold!r}") from exc
    try:
        receipt_threshold = float(receipt.get("threshold"))
    except (TypeError, ValueError) as exc:
        raise QualifierError(
            f"Qualifier receipt carries no usable threshold "
            f"({receipt.get('threshold')!r}) — re-run "
            f"`mt-eval contest qualify {contest_id} …`.") from exc
    if receipt_threshold < live:
        raise QualifierError(
            f"Qualifier receipt was scored against threshold "
            f"{receipt_threshold} but the contest's live threshold is "
            f"{live} — the bar moved; re-qualify.")
    try:
        score = float(receipt.get("score"))
    except (TypeError, ValueError) as exc:
        raise QualifierError(
            f"Qualifier receipt carries no usable score "
            f"({receipt.get('score')!r}) — re-run "
            f"`mt-eval contest qualify {contest_id} …`.") from exc
    if score < live:
        raise QualifierError(
            f"Qualifier receipt scored {score}, below the contest's live "
            f"threshold {live} — re-qualify.")
    return receipt
