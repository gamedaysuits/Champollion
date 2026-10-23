"""contest_validate — `mt-eval contest validate`: the participant-run
pre-flight (shared-task practice 5).

Every serious shared-task platform ships one of these — TIRA's `tira-run`,
Codabench's local ingestion check, WMT's submission-format validator. The
reason is always the same: a participant should never discover a packaging
mistake from a rejection notice days later, and an organizer should never
spend a custody ceremony on a bundle that was never going to run.

So this runs, LOCALLY and OFFLINE, exactly the checks the organizer's node
runs FIRST, in the same order and with the same finding shape:

  1. the lane's static checks — `sandbox_runner.run_static_checks` for a Lane B
     code bundle, `model_runner.validate_declarative_bundle` for a Lane A
     model bundle (both already fold in
     `contest_declarations.constraints_findings`, so a missing or malformed
     track / parameter count / weights licence / training-data / description
     declaration shows up here);
  2. with ``--dev``: that the dev hypotheses ALIGN with the released public
     dev corpus one-for-one, and the self-score through
     `contest_qualify.qualify` (as a rehearsal: no receipt is written),
     checked against the receipt a packed bundle carries (the one the node
     reads), or — for a source directory packed here with --manifest — the
     receipt `submit-method` / `submit-model` will embed.

**What this is not.** It is a REHEARSAL. The node re-executes the bundle
itself — it builds the image with `--network=none`, runs the container, and
re-runs the qualifier on its own copy of the dev set before any grant is
claimed. A green validate means "nothing here is already known to be wrong",
never "this will score". Nothing about the sealed set is checked, because
nothing about the sealed set is knowable from here.

Exit code: 0 only when there are zero BLOCK findings.
"""

from __future__ import annotations

import json
import shutil
import tempfile
from pathlib import Path
from typing import Optional

REHEARSAL_NOTE = (
    "This is a REHEARSAL of the node's first checks, run on your machine. "
    "The organizer's node re-executes the bundle itself (--network=none "
    "build, container run) and re-runs the qualifier on its own copy of the "
    "dev set before any grant is claimed. Zero BLOCKs here means nothing is "
    "already known to be wrong — never that the run will score."
)

LANES = ("method", "model")


class ValidateError(RuntimeError):
    """The validator could not run at all — always with the reason. Distinct
    from a BLOCK finding, which IS a successful validation with a bad
    verdict."""


def _finding(check: str, detail: str, *, severity: str = "BLOCK",
             category: str = "validate", file: str = "", line: int = 0) -> dict:
    """A finding in the node's own shape (sandbox_runner.run_static_checks)."""
    return {"check": check, "category": category, "severity": severity,
            "file": file, "line": line, "detail": detail}


# ---------------------------------------------------------------------------
# Staging — validate exactly the bytes that would be submitted.
# ---------------------------------------------------------------------------

def detect_lane(bundle_dir: Path, manifest: dict | None,
                declared: str | None = None) -> str:
    """Which lane a bundle belongs to. Declared wins; otherwise the manifest
    decides (a `model` block with weights is Lane A, a Dockerfile is Lane B).
    An undecidable bundle is a refusal, never a guess — the two lanes have
    different static checks, and running the wrong one would clear a bundle
    against rules that do not apply to it."""
    if declared:
        if declared not in LANES:
            raise ValidateError(
                f"--lane must be one of {LANES} (got {declared!r}).")
        return declared
    m = manifest or {}
    has_model = bool((m.get("model") or {}).get("weightsFile"))
    has_dockerfile = (bundle_dir / "Dockerfile").is_file()
    if has_model and not has_dockerfile:
        return "model"
    if has_dockerfile and not has_model:
        return "method"
    raise ValidateError(
        f"Cannot tell which lane {bundle_dir} is: a Lane B (sandbox) bundle "
        f"has a Dockerfile, a Lane A (declarative model) bundle has "
        f"manifest.model.weightsFile. This one has "
        f"{'both' if has_model and has_dockerfile else 'neither'}. Pass "
        f"--lane method|model.")


def stage_bundle(path: str | Path, *, work_dir: Path,
                 manifest_path: str | Path | None = None,
                 method_dir: str = "method",
                 dockerfile: str = "Dockerfile") -> dict:
    """Produce the bundle directory the checks run against.

    Three accepted inputs, because a participant has one of three things:

    * a ``.tar.gz`` written by ``submit-method/-model --offline --bundle-out``
      — extracted and validated as the node would;
    * a directory that already IS a bundle (it has ``manifest.json``) —
      validated in place;
    * a source directory plus ``--manifest`` — PACKED first with the real
      packer, then validated, so what is checked is byte-for-byte what would
      be submitted (a README or a scratch file sitting next to the method is
      not in the bundle, and must not be scanned as if it were).

    Returns {bundle_dir, manifest, tarball, staged}.
    """
    src = Path(path)
    if not src.exists():
        raise ValidateError(f"Nothing to validate at {src} — no such path.")

    if src.is_file():
        if manifest_path:
            raise ValidateError(
                "--manifest applies to a source DIRECTORY; a packed bundle "
                "carries its own manifest.json and it may not be overridden "
                "(the manifest is inside the hash the node checks).")
        from mt_eval_harness.contest_node import extract_bundle
        dest = work_dir / "bundle"
        manifest = extract_bundle(src.read_bytes(), dest)
        return {"bundle_dir": dest, "manifest": manifest, "tarball": src,
                "staged": False}

    if manifest_path is None:
        if not (src / "manifest.json").is_file():
            raise ValidateError(
                f"{src} has no manifest.json, so it is not a packed bundle. "
                f"Either point at the .tar.gz your submit command wrote, or "
                f"pass --manifest <manifest.json> to pack this directory the "
                f"way the submit command would.")
        try:
            manifest = json.loads(
                (src / "manifest.json").read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError) as exc:
            raise ValidateError(
                f"{src / 'manifest.json'} is not readable JSON: {exc}") from exc
        tarball = src.with_suffix(".tar.gz")
        return {"bundle_dir": src, "manifest": manifest,
                "tarball": tarball if tarball.is_file() else None,
                "staged": False}

    mpath = Path(manifest_path)
    if not mpath.is_file():
        raise ValidateError(f"--manifest {mpath} does not exist.")
    try:
        manifest = json.loads(mpath.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError) as exc:
        raise ValidateError(f"--manifest {mpath} is not readable JSON: "
                            f"{exc}") from exc

    lane = detect_lane(src, manifest)
    dest = work_dir / "bundle"
    if lane == "method":
        from mt_eval_harness.method_bundle import build_method_bundle
        md = src / method_dir
        df = src / dockerfile
        if not md.is_dir():
            raise ValidateError(
                f"{md} is not a directory — a Lane B bundle's code lives in "
                f"method/ (override with --method-dir).")
        if not df.is_file():
            raise ValidateError(
                f"{df} is not a file — a Lane B bundle needs a Dockerfile "
                f"(override with --dockerfile).")
        built = build_method_bundle(method_dir=md, dockerfile=df,
                                    manifest=manifest,
                                    out_path=work_dir / "bundle.tar.gz")
    else:
        from mt_eval_harness.model_bundle import build_model_bundle
        # The same file selection submit-model packs (declarative_model_files):
        # a README/DEPLOY.md or a plugin folder beside the weights is left out,
        # not refused — validate rehearses exactly what would be submitted.
        built = build_model_bundle(model_dir=src, manifest=manifest,
                                   out_path=work_dir / "bundle.tar.gz",
                                   select_declarative=True)
    from mt_eval_harness.contest_node import extract_bundle
    staged_manifest = extract_bundle(Path(built["path"]).read_bytes(), dest)
    return {"bundle_dir": dest, "manifest": staged_manifest,
            "tarball": Path(built["path"]), "staged": True,
            "left_out": list(built.get("left_out") or [])}


# ---------------------------------------------------------------------------
# The qualifier rehearsal.
# ---------------------------------------------------------------------------

def alignment_findings(dev_corpus_path: Path, dev_hyp_path: Path) -> list[dict]:
    """Do the dev hypotheses cover the dev corpus one-for-one?

    This is the single most common submission mistake there is (a blank line,
    a trailing newline, a shuffled id set), and it is the cheapest to catch.
    Same loader and same aligner the scorer uses — never a second
    implementation with its own idea of 'aligned'.
    """
    from mt_eval_harness.config import RunConfig
    from mt_eval_harness.corpus_loader import load_corpus
    from mt_eval_harness.external_scoring import (
        HypothesesFormatError,
        align_hypotheses,
        load_hypotheses,
    )
    try:
        entries, _meta = load_corpus(RunConfig(corpus_path=str(dev_corpus_path)))
    except Exception as exc:  # noqa: BLE001 — any loader failure is a finding
        return [_finding("dev-corpus",
                         f"the public dev corpus {dev_corpus_path} could not "
                         f"be loaded: {type(exc).__name__}: {exc}",
                         file=str(dev_corpus_path))]
    if not entries:
        return [_finding("dev-corpus",
                         f"the public dev corpus {dev_corpus_path} has no "
                         f"entries.", file=str(dev_corpus_path))]
    try:
        hyps = load_hypotheses(dev_hyp_path)
    except (HypothesesFormatError, ValueError, OSError) as exc:
        return [_finding("dev-hypotheses",
                         f"your dev hypotheses could not be read: {exc}",
                         file=str(dev_hyp_path))]
    try:
        align_hypotheses(entries, hyps)
    except HypothesesFormatError as exc:
        return [_finding("dev-alignment",
                         f"your dev hypotheses do not line up with the dev "
                         f"corpus ({len(entries)} entries): {exc}",
                         file=str(dev_hyp_path))]
    return [_finding("dev-alignment",
                     f"dev hypotheses align with all {len(entries)} dev "
                     f"corpus entries.", severity="INFO",
                     file=str(dev_hyp_path))]


def _qualifier_from_manifest(manifest: dict) -> dict:
    q = (manifest or {}).get("qualifier") or {}
    return {"qualifier_id": q.get("qualifierId"),
            "threshold": q.get("threshold"),
            "dev_corpus_sha256": q.get("devCorpusSha256")}


def _receipt_comparison(receipt: dict, *, rescored: dict,
                        dev_hyp_sha: str, dev_corpus_sha: str,
                        contest_id: str,
                        label: str | None = None) -> list[dict]:
    """Findings from checking the entrant's EXISTING receipt for this system
    against the rehearsal's re-score (validate writes no receipt).

    ``label`` names the receipt in the findings ("the receipt this bundle
    carries (system 'x')"); default: "your receipt for system 'x'"."""
    system = receipt.get("system")
    what = label or f"your receipt for system {system!r}"
    requalify = (f"re-run `mt-eval contest qualify {contest_id} --dev <hyps> "
                 f"--dev-corpus <dev-corpus> --system "
                 f"{repr(system) if system else '<name>'}` to refresh it")
    out: list[dict] = []
    if receipt.get("devCorpusSha256") and \
            receipt["devCorpusSha256"] != dev_corpus_sha:
        out.append(_finding(
            "qualifier receipt",
            f"{what} was scored against a dev "
            f"corpus with sha256 {str(receipt['devCorpusSha256'])[:12]}…, "
            f"not the file given here ({dev_corpus_sha[:12]}…); {requalify}.",
            severity="WARN"))
    if receipt.get("hypothesesSha256") and \
            receipt["hypothesesSha256"] != dev_hyp_sha:
        out.append(_finding(
            "qualifier receipt",
            f"{what} covers different dev "
            f"hypotheses (sha256 {str(receipt['hypothesesSha256'])[:12]}…) "
            f"than the ones validated here ({dev_hyp_sha[:12]}…); "
            f"{requalify}.", severity="WARN"))
    if receipt.get("qualifierId") and \
            receipt["qualifierId"] != rescored.get("qualifierId"):
        out.append(_finding(
            "qualifier receipt",
            f"{what} cleared "
            f"{receipt['qualifierId']!r}, not {rescored.get('qualifierId')!r}; "
            f"{requalify}.", severity="WARN"))
    if not out:
        same = receipt.get("score") == rescored.get("score")
        out.append(_finding(
            "qualifier receipt",
            f"matches {what} (scored "
            f"{receipt.get('score')}"
            + ("" if same else f"; this rehearsal re-scored "
                               f"{rescored.get('score')}")
            + f", passed={bool(receipt.get('passed'))}, at "
              f"{receipt.get('scoredAt')}). No receipt was written.",
            severity="INFO" if same else "WARN"))
    return out


def qualifier_findings(manifest: dict, *, contest_id: str,
                       dev_hyp_path: Path, dev_corpus_path: Path,
                       system_label: str, method_class: str,
                       paradigm: str | None = None,
                       qualifier_id: str | None = None,
                       threshold: float | None = None,
                       receipt_dir: str | Path | None = None,
                       system: str | None = None,
                       scratch_dir: str | Path | None = None,
                       packed: bool = False) -> list[dict]:
    """Alignment + the offline self-score, as findings — writing NOTHING.

    The qualifier id and threshold come from the organizer's release. When
    they are not passed they are read from the bundle manifest's embedded
    receipt block — the values this bundle already claims — so the rehearsal
    scores against the same bar the submission will be judged on. Nothing is
    invented: with neither source the qualifier leg refuses.

    The self-score is a rehearsal (``qualify(write_receipt=False)``): no
    receipt is minted. It is then checked against a receipt:

    * a PACKED bundle (``packed``: the .tar.gz or bundle directory a submit
      command wrote) whose manifest carries a receipt — submit-method/-model
      copy the receipt of their ``--system`` onto ``manifest["qualifier"]``
      — is checked against THAT receipt, the one the node reads. The
      receipt on this machine it was copied from is found by matching every
      copied field (``find_receipt_for_block``), so its system is named
      whatever the bundle's method is called. Looking it up by the method's
      --name instead found nothing ("none for SME Rules") for a bundle
      packaged with ``--system rules-v1`` (synthetic researcher, Round 11).
      A ``--system`` naming another receipt is a WARN: the bundle still
      carries the one it was packaged with.
    * otherwise (a source directory packed here with ``--manifest``, whose
      qualifier block — if any — is not what a submit command would embed:
      submit builds its own manifest) the receipt submit-method WILL embed
      is found the way it finds it (``load_receipt``: ``system`` when given
      — validate's --system — else the receipt named like the bundle, else
      the contest's only receipt).

    validate used to write a second receipt under the bundle's --name ("Toy
    Lex") beside the one the entrant had qualified as "toy-lex", which
    submit-method then called ambiguous (synthetic researcher, Round 6).
    """
    from mt_eval_harness.contest_qualify import (
        QualifierError, find_receipt_for_block, load_receipt, qualify,
    )
    from mt_eval_harness.external_scoring import sha256_file

    findings = alignment_findings(dev_corpus_path, dev_hyp_path)
    if any(f["severity"] == "BLOCK" for f in findings):
        return findings

    claimed = _qualifier_from_manifest(manifest)
    qid = qualifier_id or claimed["qualifier_id"]
    thr = threshold if threshold is not None else claimed["threshold"]
    if not qid or thr is None:
        findings.append(_finding(
            "qualifier",
            "cannot self-score: no qualifier id/threshold. Pass "
            "--offline-qualifier-id and --offline-threshold (the values the "
            "organizer published with the dev release), or validate a bundle "
            "whose manifest already carries a qualifier receipt. A threshold "
            "is contest data and is never guessed."))
        return findings

    # The dev file this bundle was qualified against, if it says.
    if claimed["dev_corpus_sha256"]:
        actual = sha256_file(dev_corpus_path)
        if actual != claimed["dev_corpus_sha256"]:
            findings.append(_finding(
                "qualifier",
                f"the bundle's receipt was scored against a dev corpus with "
                f"sha256 {claimed['dev_corpus_sha256'][:12]}… but "
                f"{dev_corpus_path} hashes to {actual[:12]}… — one of them is "
                f"not the released dev set.", file=str(dev_corpus_path)))
            return findings

    # The receipt this bundle carries, and the one on this machine it was
    # copied from (None when it carries none, or none here matches it).
    carried_block = _carried_receipt_block(manifest) if packed else None
    carried = (find_receipt_for_block(contest_id, carried_block, receipt_dir)
               if carried_block is not None else None)
    carried_system = carried[1].get("system") if carried else None

    dev_meta = {}
    try:
        dev_meta = (json.loads(dev_corpus_path.read_text(encoding="utf-8"))
                    .get("dataset") or {})
    except (json.JSONDecodeError, OSError):
        dev_meta = {}
    pair = dev_meta.get("language_pair")
    offline_qualifier = {
        "qualifier_id": qid,
        "threshold": float(thr),
        "corpus_card_id": dev_meta.get("corpus_id"),
    }
    if isinstance(pair, dict) and pair.get("source"):
        offline_qualifier["language_pair"] = (
            f"{pair['source']}>{pair.get('target', '')}")

    try:
        rescored = qualify(
            contest_id,
            dev_hyp_path=dev_hyp_path,
            dev_corpus_path=dev_corpus_path,
            system_label=system or carried_system or system_label,
            method_class=method_class,
            paradigm=paradigm,
            receipt_dir=receipt_dir,
            offline_qualifier=offline_qualifier,
            write_receipt=False,
            scratch_dir=scratch_dir,
        )
    except QualifierError as exc:
        findings.append(_finding("qualifier", str(exc)))
        return findings
    findings.append(_finding(
        "qualifier",
        f"self-scored chrF++ {rescored['score']} on the chrF++ 0-100 "
        f"qualifier scale (corpus chrF++ of the dev outputs — the same "
        f"number an `mt-eval run` card headlines) against threshold "
        f"{rescored['threshold']} on {qid} — PASS. "
        f"{_bar_source(qualifier_id, threshold)} A rehearsal: no receipt "
        f"written; the node re-executes your method on its own copy of this "
        f"set and its measurement is the one that gates.",
        severity="INFO"))

    dev_hyp_sha = sha256_file(dev_hyp_path)
    dev_corpus_sha = sha256_file(dev_corpus_path)
    if carried_block is not None:
        # A packed bundle: the receipt it carries is the one the node reads.
        findings.extend(_carried_receipt_findings(
            carried_block, carried, system=system, contest_id=contest_id,
            receipt_dir=receipt_dir))
        receipt, label = _carried_receipt_label(carried_block, carried)
        findings.extend(_receipt_comparison(
            receipt, rescored=rescored, dev_hyp_sha=dev_hyp_sha,
            dev_corpus_sha=dev_corpus_sha, contest_id=contest_id,
            label=label))
        return findings

    # No receipt in the manifest yet: the one submit-method WILL embed — the
    # entrant's own, for this system — checked against the re-score.
    try:
        existing = load_receipt(contest_id, receipt_dir, system=system,
                                name_hint=system_label)
    except QualifierError as exc:
        findings.append(_finding(
            "qualifier receipt",
            f"{exc} (validate writes no receipt — `mt-eval contest qualify` "
            f"does.)", severity="WARN"))
        return findings
    findings.extend(_receipt_comparison(
        existing, rescored=rescored,
        dev_hyp_sha=dev_hyp_sha,
        dev_corpus_sha=dev_corpus_sha,
        contest_id=contest_id))
    return findings


def _carried_receipt_block(manifest: dict) -> dict | None:
    """``manifest["qualifier"]`` when it is a receipt copy (every field
    submit-method/-model copy is present), else None."""
    from mt_eval_harness.contest_declarations import QUALIFIER_MANIFEST_FIELDS
    block = (manifest or {}).get("qualifier")
    if isinstance(block, dict) and all(
            k in block for k in QUALIFIER_MANIFEST_FIELDS):
        return block
    return None


def _bar_source(qualifier_id: str | None, threshold: float | None) -> str:
    """Where the qualifier id and threshold the rehearsal used came from —
    said on the finding, because validate reads them from the bundle when no
    flag is given, which is the value `contest qualify` was given, not a
    fresh read of the organizer's release (synthetic researcher, Round 11:
    validate "found" the threshold with no flags while qualify asked for
    them)."""
    if qualifier_id and threshold is not None:
        return ("Qualifier id and threshold from --offline-qualifier-id / "
                "--offline-threshold.")
    if not qualifier_id and threshold is None:
        return ("Qualifier id and threshold from the receipt this bundle "
                "carries — the values `contest qualify` used for it, not a "
                "fresh read of the organizer's release; the organizer's node "
                "applies its own.")
    given = ("qualifier id from --offline-qualifier-id"
             if qualifier_id else "threshold from --offline-threshold")
    other = "threshold" if qualifier_id else "qualifier id"
    return (f"The {given}; the {other} from the receipt this bundle carries "
            f"(what `contest qualify` used for it).")


def _carried_receipt_label(block: dict, carried) -> tuple[dict, str]:
    """The receipt to compare the rehearsal with, and its name in findings:
    the matching receipt on this machine when there is one (it names the
    system), else the bundle's own copy."""
    if carried is None:
        return dict(block), "the receipt this bundle carries"
    path, receipt = carried
    return receipt, (f"the receipt this bundle carries (system "
                     f"{receipt.get('system')!r}, {path})")


def _carried_receipt_findings(block: dict, carried, *, system: str | None,
                              contest_id: str,
                              receipt_dir: str | Path | None) -> list[dict]:
    """What validate says about the receipt a packed bundle carries before
    comparing it with the rehearsal: which local receipt it is, whether that
    receipt has since been replaced, and whether ``--system`` names another
    one."""
    from mt_eval_harness.contest_qualify import (
        contest_receipt_dir, receipt_path,
    )
    out: list[dict] = []
    if carried is None:
        out.append(_finding(
            "qualifier receipt",
            f"this bundle carries a receipt (scored {block.get('score')} at "
            f"{block.get('scoredAt')}) that matches no receipt under "
            f"{contest_receipt_dir(contest_id, receipt_dir)} — it was "
            f"qualified on another machine, or the receipt file is gone. "
            f"Checked against the bundle's own copy, which is what the node "
            f"reads.", severity="INFO"))
        if system is not None:
            out.append(_finding(
                "qualifier receipt",
                f"--system {system!r} was not used: the bundle carries the "
                f"receipt it was packaged with, and that is the one the node "
                f"reads. To submit the receipt for {system!r} instead, "
                f"package again with `submit-method/submit-model --system "
                f"{system!r}`.", severity="WARN"))
        return out
    path, receipt = carried
    packaged = receipt.get("system")
    if path.parent.name == "history":
        newer = (receipt_path(contest_id, receipt_dir, system=packaged)
                 if packaged else None)
        out.append(_finding(
            "qualifier receipt",
            f"this bundle carries an EARLIER receipt for system "
            f"{packaged!r} (scored {receipt.get('score')} at "
            f"{receipt.get('scoredAt')}, kept at {path}); `contest qualify` "
            f"has written a newer one for that system since"
            + (f" ({newer})" if newer is not None and newer.is_file()
               else "")
            + f". The bundle still carries the earlier one — package again "
              f"with `--system {packaged!r}` to carry the newer receipt.",
            severity="WARN"))
    if system is not None and system != packaged:
        out.append(_finding(
            "qualifier receipt",
            f"--system {system!r} names a different receipt from the one "
            f"this bundle was packaged with (the receipt for system "
            f"{packaged!r}). The node reads the receipt inside the bundle, so "
            f"this rehearsal is checked against that one; to submit the "
            f"receipt for {system!r}, package again with `--system "
            f"{system!r}`.", severity="WARN"))
    return out


# ---------------------------------------------------------------------------
# The one entry point.
# ---------------------------------------------------------------------------

def validate(path: str | Path, *,
             lane: str | None = None,
             manifest_path: str | Path | None = None,
             method_dir: str = "method",
             dockerfile: str = "Dockerfile",
             expected_corpus_id: str | None = None,
             architecture_policy=None,
             contest_id: str | None = None,
             dev_hyp_path: str | Path | None = None,
             dev_corpus_path: str | Path | None = None,
             system_label: str | None = None,
             method_class: str | None = None,
             paradigm: str | None = None,
             qualifier_id: str | None = None,
             threshold: float | None = None,
             receipt_dir: str | Path | None = None,
             work_dir: str | Path | None = None) -> dict:
    """Run the node's first checks locally. Returns the result dict:

        {lane, source, staged, findings, blocks, warns, infos, ok, note}

    ``ok`` is True only when there are zero BLOCK findings.
    """
    tmp: Optional[str] = None
    if work_dir is None:
        tmp = tempfile.mkdtemp(prefix="mteval-validate-")
        work = Path(tmp)
    else:
        work = Path(work_dir)
        work.mkdir(parents=True, exist_ok=True)
    try:
        staged = stage_bundle(path, work_dir=work,
                              manifest_path=manifest_path,
                              method_dir=method_dir, dockerfile=dockerfile)
        bundle_dir = staged["bundle_dir"]
        resolved_lane = detect_lane(bundle_dir, staged["manifest"], lane)

        if resolved_lane == "method":
            from mt_eval_harness.sandbox_runner import run_static_checks
            checks = run_static_checks(
                bundle_dir, tarball_path=staged.get("tarball"),
                expected_corpus_id=expected_corpus_id)
        else:
            from mt_eval_harness.model_runner import validate_declarative_bundle
            checks = validate_declarative_bundle(
                bundle_dir, tarball_path=staged.get("tarball"),
                expected_corpus_id=expected_corpus_id,
                architecture_policy=architecture_policy)
        findings = list(checks["findings"])
        if staged.get("left_out"):
            # What submit-model leaves out of a model directory, said here
            # too: validate rehearses exactly the package that is submitted.
            findings.append(_finding(
                "packing",
                f"left out of the bundle (not part of the model the node "
                f"runs): {', '.join(staged['left_out'])}",
                severity="INFO"))
        manifest = checks.get("manifest") or staged["manifest"] or {}

        if dev_hyp_path or dev_corpus_path:
            missing = [n for n, v in (("--dev", dev_hyp_path),
                                      ("--dev-corpus", dev_corpus_path),
                                      ("--contest", contest_id))
                       if not v]
            if missing:
                raise ValidateError(
                    f"The qualifier rehearsal needs {', '.join(missing)} as "
                    f"well — it self-scores YOUR hypotheses against the "
                    f"released dev corpus for a named contest.")
            method = manifest.get("method") or {}
            findings.extend(qualifier_findings(
                manifest,
                contest_id=str(contest_id),
                dev_hyp_path=Path(dev_hyp_path),
                dev_corpus_path=Path(dev_corpus_path),
                system_label=system_label or method.get("name") or "unnamed",
                method_class=method_class or method.get("class") or "pipeline",
                paradigm=paradigm or method.get("paradigm"),
                qualifier_id=qualifier_id,
                threshold=threshold,
                receipt_dir=receipt_dir,
                system=system_label,
                scratch_dir=work / "qualifier-scratch",
                packed=not staged["staged"],
            ))

        blocks = [f for f in findings if f["severity"] == "BLOCK"]
        warns = [f for f in findings if f["severity"] == "WARN"]
        infos = [f for f in findings if f["severity"] not in ("BLOCK", "WARN")]
        return {
            "lane": resolved_lane,
            "source": str(Path(path)),
            "staged": staged["staged"],
            "findings": findings,
            "blocks": blocks,
            "warns": warns,
            "infos": infos,
            "ok": not blocks,
            "qualifier_checked": bool(dev_hyp_path),
            "note": REHEARSAL_NOTE,
        }
    finally:
        if tmp:
            shutil.rmtree(tmp, ignore_errors=True)


LANE_LABELS = {
    "method": "Lane B — runnable bundle (sandbox, --network=none)",
    "model": "Lane A — declarative model (trusted engine, code-free)",
}


def format_report(result: dict) -> str:
    """The findings table, in severity order. Never a bare traceback and
    never a summary that hides a finding."""
    lines = [
        "",
        f"  contest validate — {LANE_LABELS.get(result['lane'], result['lane'])}",
        f"  Bundle: {result['source']}"
        + ("  (packed for validation, as your submit command would)"
           if result.get("staged") else ""),
        "",
    ]
    if not result["findings"]:
        lines.append("  (no findings)")
    else:
        width = max(len(f["check"]) for f in result["findings"])
        order = {"BLOCK": 0, "WARN": 1}
        for f in sorted(result["findings"],
                        key=lambda x: (order.get(x["severity"], 2),
                                       x["check"])):
            where = f" [{f['file']}" + (f":{f['line']}]" if f.get("line")
                                        else "]") if f.get("file") else ""
            lines.append(f"  {f['severity']:<5} {f['check']:<{width}}  "
                         f"{f['detail']}{where}")
    lines += [
        "",
        f"  {len(result['blocks'])} BLOCK · {len(result['warns'])} WARN · "
        f"{len(result['infos'])} INFO",
    ]
    if result["ok"]:
        lines.append("  ✅ Nothing here blocks submission.")
    else:
        lines.append("  ✗ BLOCKED — the node would refuse this bundle for the "
                     "reasons above.")
    if not result.get("qualifier_checked"):
        lines.append("  (qualifier not rehearsed — pass --contest --dev "
                     "--dev-corpus to self-score the public dev set too)")
    lines += ["", f"  {REHEARSAL_NOTE}", ""]
    return "\n".join(lines)
