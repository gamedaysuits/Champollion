"""nmt-forge CLI — thin argparse layer over the library.

Every command is a guard's library call plus rendering; refusals surface as
the guard's what/why/fix message and exit code 2.

Output contract (agents and the MCP server rely on it):

- every subcommand accepts ``--json``; with it, stdout carries EXACTLY ONE
  JSON document (the command's payload — shapes in docs/JSON_OUTPUT.md) and
  everything else the command prints (training logs, harness chatter) goes
  to stderr;
- a refusal under ``--json`` prints ``{"error": {...}}`` on stdout (type,
  guard, message, why, fix) and exits 2 — never a traceback;
- without ``--json`` you get the human rendering.

Content discipline: payloads are content-free (counts, hashes, paths, row
numbers) except where a command's PURPOSE is text (``prereg template``);
the human leak-audit rendering may quote the user's own corpus rows as
examples, never eval-set text. A corpus the harness withholds text for
(local-only, sealed, consent-required — ``privacy``) is never quoted, and
nor is a row that matched such a set: line numbers instead, said once why;
``--show-text`` is for a person at the terminal. An error message that
quotes such a corpus's sentence (a plugin's, a tokenizer's) is scrubbed the
same way. Files written into the user's folders keep the text; files carved
from a marked corpus carry its mark.
"""

from __future__ import annotations

import argparse
import contextlib
import json
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from .errors import ForgeError
from .registry import load_rows
from .workspace import Workspace


@dataclass
class Out:
    """A command's result: the JSON payload, its human rendering (None →
    pretty-printed payload), and the exit code."""

    payload: Any
    text: str | None = None
    code: int = 0


class UsageError(ForgeError):
    """Bad command-line arguments (argparse's complaint, made catchable so
    ``--json`` callers get a JSON error instead of usage text)."""


GLOSSARY_HELP = (
    "an evaluation glossary for the mt-eval report's terminology metric: "
    'JSON {"source term": "translation" or ["accepted", "forms"]} (or a '
    "coaching file's \"dictionary\") — what `mt-eval run --glossary` takes. "
    "A scoring input only: the model never sees it. Overrides the config's "
    "eval.glossary")


PREREG_HELP = (
    "the preregistration this run is judged against (an id from `nmt-forge "
    "status`). Needed when several preregs bind the test set for this run "
    "(e.g. two models on one fixed test set): forge refuses to guess. "
    "Without it: the only valid prereg, else the one this run's first test "
    "read was bound to, else the one pinned to this run's config hash")


class _Parser(argparse.ArgumentParser):
    def __init__(self, *a, **kw):
        # abbreviations broke SHIPPED flags once (`--eval` silently meant
        # `--eval-set` on one Python and not another) — exact flags only
        kw.setdefault("allow_abbrev", False)
        super().__init__(*a, **kw)

    def error(self, message):
        raise UsageError(f"{self.prog}: {message}\n  fix: "
                         f"{self.prog} --help")


class _VersionRequested(Exception):
    """``--version`` was given: main() answers it (text, or one JSON
    document under --json) instead of argparse printing and exiting."""


class _VersionAction(argparse.Action):
    def __init__(self, option_strings, dest=argparse.SUPPRESS,
                 default=argparse.SUPPRESS, help=None):
        super().__init__(option_strings, dest=dest, default=default,
                         nargs=0, help=help)

    def __call__(self, parser, namespace, values, option_string=None):
        # raised before argparse checks for the required subcommand, so
        # `nmt-forge --version` alone is enough
        raise _VersionRequested()


def version_info() -> dict:
    """forge's version and the harness it scores with (forge implements no
    metric — the harness version decides the numbers)."""
    from . import __version__, _harness

    try:
        harness = _harness.harness_version()
    except ForgeError as e:
        harness = f"not importable ({str(e).splitlines()[0]})"
    return {"nmt_forge": __version__, "mt_eval_harness": harness,
            "python": sys.version.split()[0]}


def _ws(args) -> Workspace:
    return Workspace(args.workspace)


def _load_hyps(path: str) -> list[str]:
    p = Path(path)
    if p.suffix == ".jsonl":
        rows = load_rows(p)
        for field in ("predicted", "hypothesis"):
            if all(field in r for r in rows):
                return [str(r[field]) for r in rows]
        raise ForgeError(
            f"{p}: .jsonl hypotheses need a uniform 'predicted' or "
            "'hypothesis' field; or pass plain text (one line per row)"
        )
    return p.read_text(encoding="utf-8").splitlines()


def _dumps(obj) -> str:
    return json.dumps(obj, indent=2, ensure_ascii=False, default=str)


# -- commands -----------------------------------------------------------------

def _listed_entry(ws: Workspace, name: str) -> dict:
    """A registry entry as listed: the stored, content-free entry plus what
    is resolved live from the file's terms — the dataset id mt-eval knows
    it by (``registry.dataset_identity``; ``name`` stays forge's) and
    whether its sentences are withheld from output (``privacy``)."""
    entry = dict(ws.registry.get(name))
    ident = ws.registry.identity(name, strict=False)
    entry.update(dataset_id=ident["dataset_id"],
                 dataset_id_source=ident["dataset_id_source"],
                 corpus_card=ident["corpus_card"],
                 dataset_id_note=ident["note"],
                 text_withheld=(ws.registry.text_withheld(
                     name, identity=ident) or None))
    return entry


def _entry_lines(name: str, e: dict) -> list[str]:
    """The human lines for a listed entry's live identity + text status."""
    lines = []
    if e.get("dataset_id") and e["dataset_id"] != name:
        lines.append(f"      dataset {e['dataset_id']} (from "
                     f"{e['dataset_id_source']})")
    if e.get("dataset_id_note"):
        lines.append(f"      note: {e['dataset_id_note']}")
    if e.get("text_withheld"):
        lines.append(f"      sentences withheld from output: "
                     f"{e['text_withheld']}")
    return lines


def _read_log_lines(entry: dict) -> list[str]:
    """What registering a test/sealed set did to read accounting: the read
    log starts now, so register BEFORE any benchmark run; and the mt-eval
    runs of this exact file found from before (said, never counted). Empty
    for a dev set (read freely)."""
    from .advisor import before_registration_text
    from .registry import (REGISTER_FIRST_NOTE, WATCHED_ROLES,
                           read_log_path)

    if entry.get("role") not in WATCHED_ROLES:
        return []
    lines = [f"  read log: {read_log_path(entry['path'])} — every mt-eval "
             "run / compare on this file from now on is counted",
             f"  {REGISTER_FIRST_NOTE[:1].upper()}{REGISTER_FIRST_NOTE[1:]}"]
    before = entry.get("reads_before_registration")
    if not isinstance(before, dict):
        return lines             # registered before this check existed
    runs = before.get("runs") or []
    where = ", ".join(before.get("searched") or []) or "no harness log folder"
    if runs:
        lines.append(f"  ⚠ {before_registration_text(runs)}. forge's read "
                     "accounting starts now and does not count them: a "
                     "preregistration written now comes AFTER them — count "
                     "them yourself when you judge a test score "
                     f"(found in: {where})")
    else:
        lines.append("  no earlier mt-eval run of this file found (searched "
                     f"the harness's default log folders: {where}"
                     + ("; search capped" if before.get("capped") else "")
                     + "); a run written to another --output-dir cannot be "
                     "seen")
    if before.get("capped") and runs:
        lines.append("    (search capped at the file bound — there may be "
                     "more)")
    if before.get("too_large"):
        lines.append(f"    ({len(before['too_large'])} RunLog(s) too large "
                     "to check were skipped: "
                     + ", ".join(before["too_large"][:3]) + ")")
    return lines


def _eval_file_missing(path: str) -> ForgeError:
    """A registry add whose file is not there: what forge looked for (the
    resolved path), why relative paths resolve where they do, and the exact
    fix (Round 12 school persona: a bare FileNotFoundError, why/fix null,
    left the agent to guess that the path is read from the project
    directory the MCP runs forge in)."""
    import os

    from .errors import EvalFileMissing

    cwd = Path.cwd()
    relative = not Path(path).is_absolute()
    looked = (cwd / path) if relative else Path(path)
    fix = ("pass the file's absolute path, or its path relative to "
           f"{cwd} (forge's working directory)")
    # the usual slip: a path written from the directory ABOVE the project
    # (where the agent works), read from inside the project
    above = cwd.parent / path
    if relative and above.is_file():
        fix = (f"the file is at {above}: pass {os.path.relpath(above, cwd)} "
               f"(relative to {cwd}) or {above}")
    return EvalFileMissing(
        f"no eval file at {looked} — {path!r} was read relative to "
        f"{cwd}, the directory forge runs in",
        why="forge reads every relative path (eval files, corpora, "
            "config.json's data paths) from the directory it runs in — the "
            "project directory (MCP: project_dir) — so the registry, its "
            "read log and the configs agree on one file",
        fix=fix)


def cmd_registry_add(args) -> Out:
    ws = _ws(args)
    if not Path(args.path).is_file():
        raise _eval_file_missing(args.path)
    ws.registry.register(
        args.name, args.path, args.role,
        source_field=args.source_field, target_field=args.target_field,
        note=args.note, allow_rotate=args.allow_rotate,
    )
    entry = _listed_entry(ws, args.name)
    return Out({args.name: entry},
               "\n".join([f"registered {args.name!r} as role={entry['role']} "
                          f"— {entry['rows']} rows, sha256 "
                          f"{entry['sha256'][:12]}…, fields "
                          f"{entry['source_field']}→{entry['target_field']}"]
                         + _entry_lines(args.name, entry)
                         + _read_log_lines(entry)
                         + [f"  ({ws.registry.path})"]))


def cmd_registry_list(args) -> Out:
    ws = _ws(args)
    data = {n: _listed_entry(ws, n) for n in ws.registry.names()}
    lines = [f"workspace: {ws.root}"]
    for n, e in data.items():
        lines.append(f"  {n:<24} {e['role']:<7} {e['rows']:>6} rows  "
                     f"{e['path']}")
        lines += _entry_lines(n, e)
    if not data:
        lines.append("  (no eval sets registered)")
    return Out(data, "\n".join(lines))


def cmd_registry_add_harness(args) -> Out:
    from .harness_data import register_harness_dataset

    ws = _ws(args)
    summary = register_harness_dataset(ws, args.dataset_id, args.role,
                                       assume_yes=args.yes)
    withheld = ws.registry.text_withheld(summary["registered"])
    summary["text_withheld"] = withheld or None
    entry = ws.registry.get(summary["registered"])
    summary["reads_before_registration"] = entry.get(
        "reads_before_registration")
    return Out(summary, f"registered {summary['registered']!r} as "
                        f"role={summary['role']} ({summary['rows']} rows)\n"
                        f"  {summary['note']}"
                        + (f"\n  sentences withheld from output: {withheld}"
                           if withheld else "")
                        + "".join("\n" + ln for ln in _read_log_lines(entry)))


def _screen_sides_against_tests(ws: Workspace, split, args) -> dict | None:
    """When the workspace already holds test/sealed sets (the --test 0
    path), screen the fresh train/dev sides against them right away."""
    if not ws.registry.names(roles=("test", "sealed")):
        return None
    from .guards.leak_audit import leak_audit

    out = {}
    for side in ("train", "dev"):
        rows = getattr(split, side)
        if not rows:
            continue
        rep = leak_audit(rows, ws, roles=("test", "sealed"),
                         source_field=args.source_field,
                         target_field=args.target_field)
        out[side] = {"rows": len(rows),
                     "would_drop": len(rep.leaking_row_indices),
                     "template_siblings": len(rep.template_row_indices
                                              - rep.leaking_row_indices)}
    return out


def _split_config_check(ws, paths: dict, args) -> dict | None:
    """Does the project's config.json train on the train side this split
    wrote? ``None`` without a config.json beside the workspace (or without a
    train side); else ``{ok, config, gold, wrote, missing, message, fix}``
    — content-free paths only. Only a config naming a file that does NOT
    exist is flagged: a config pointing at another existing corpus is a
    choice, not a mistake."""
    import os

    if ws is None or "train" not in paths:
        return None
    project = ws.root.parent
    cfg_path = project / "config.json"
    if not cfg_path.is_file():
        return None
    try:
        raw = json.loads(cfg_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    data = (raw.get("data") or {}) if isinstance(raw, dict) else {}
    gold = [str(g) for g in data.get("gold") or []]
    ndc = (raw.get("eval") or {}).get("near_dupe_corpus")

    def resolved(p):
        q = Path(p)
        return (q if q.is_absolute() else project / q).resolve()

    wrote = Path(paths["train"]).resolve()
    try:
        shown = os.path.relpath(wrote, project.resolve())
    except ValueError:
        shown = str(wrote)
    if any(resolved(g) == wrote for g in gold):
        return {"ok": True, "config": str(cfg_path), "gold": gold,
                "wrote": shown, "missing": [], "message": None, "fix": None}
    missing = [g for g in gold if not resolved(g).is_file()]
    if ndc and not resolved(ndc).is_file() and ndc not in missing:
        missing.append(ndc)
    if not missing:
        return {"ok": True, "config": str(cfg_path), "gold": gold,
                "wrote": shown, "missing": [], "message": None, "fix": None}
    return {
        "ok": False, "config": str(cfg_path), "gold": gold, "wrote": shown,
        "missing": missing,
        "message": (f"config.json trains on {', '.join(missing)}, which does "
                    f"not exist — this split wrote its train side to {shown}"),
        "fix": (f"in config.json set data.gold to [\"{shown}\"]"
                + (f" and eval.near_dupe_corpus to \"{shown}\"" if ndc else "")
                + f", or carve again with --out "
                f"{os.path.dirname(missing[0]) or '.'} (the path config.json "
                "names)"),
    }


def cmd_split(args) -> Out:
    from .canonical import sha256_file
    from .guards.split_guard import group_split, write_split
    from .privacy import carried_mark, carry_mark, render_carried

    rows = load_rows(args.corpus)
    # the sides ARE the corpus's text: a local-only corpus's pieces stay
    # local-only (and keep its licence / sealed segment) — read first, so an
    # unreadable sidecar refuses before anything is written
    mark = carried_mark(args.corpus)
    if args.near_dupe is not None and not 0 < args.near_dupe <= 1:
        raise UsageError(f"--near-dupe {args.near_dupe}: a Jaccard threshold "
                         "is in (0, 1] — 0.6 is the value the test-score "
                         "near-twin check uses")
    if args.max_group is not None:
        if args.near_dupe is None:
            raise UsageError(
                "--max-group caps near-duplicate share-groups — add "
                "--near-dupe <JACCARD> (exact-duplicate groups are never "
                "capped: a shared sentence across sides IS the leak)\n  fix: "
                f"nmt-forge split {args.corpus} … --near-dupe 0.6 "
                f"--max-group {args.max_group}")
        if args.max_group < 2:
            raise UsageError(f"--max-group {args.max_group}: a group cap is "
                             "at least 2 rows")
    split = group_split(
        rows, test_size=args.test, dev_size=args.dev, seed=args.seed,
        source_field=args.source_field, target_field=args.target_field,
        near_dupe_jaccard=args.near_dupe, max_group=args.max_group,
    )
    # never conjure an empty workspace just to look inside it
    ws = (_ws(args) if (args.register or Path(args.workspace).is_dir())
          else None)
    # every registration conflict is decided BEFORE a file is written: a
    # refused re-split used to overwrite data/split/* first, leaving the
    # registered dev set's file out of step with its recorded hash (Round 5)
    rotations = _split_rotations(ws, split, args)
    # which file the sides were carved from (path + sha256, content-free):
    # leak-audit --clean-to refuses to rewrite it under a registered split
    # (Round 10)
    split.manifest["source_corpus"] = {
        "path": str(Path(args.corpus).resolve()),
        "sha256": sha256_file(args.corpus)}
    paths = write_split(split, args.out)
    carried = carry_mark(args.corpus, [v for k, v in paths.items()
                                       if k != "manifest"], command="split",
                         mark=mark)
    registered = []
    if args.register:
        for side, role in (("test", "test"), ("dev", "dev")):
            if side in paths:
                name = f"{args.register}-{side}"
                ws.registry.register(name, paths[side], role,
                                     source_field=args.source_field,
                                     target_field=args.target_field,
                                     allow_rotate=name in rotations)
                registered.append({"name": name, "role": role,
                                   **({"rotated_from": rotations[name]}
                                      if name in rotations else {})})
    screen = (_screen_sides_against_tests(ws, split, args)
              if ws is not None else None)
    near_twin = _split_near_twin(ws, split, args)
    dev_twin = _split_dev_near_twin(split, args)
    carve_check = _split_carve_check(rows, near_twin, dev_twin, args)
    dev_name = (f"{args.register}-dev" if args.register and "dev" in paths
                else None)
    capped = ({"max_group": args.max_group,
               "links": split.manifest.get("near_dupe_links") or 0,
               "uncut": split.manifest.get("near_dupe_links_left_uncut") or 0}
              if args.max_group else None)
    _tailor_near_twin_advice(near_twin, dev_twin, carve_check,
                             capped=capped, carved_test=bool(args.test),
                             dev_name=dev_name)
    _split_two_model(ws, near_twin, args)
    if ws is not None and dev_name and dev_twin and dev_twin.get("checked"):
        from .advisor import record_dev_twin_verdict

        record_dev_twin_verdict(ws, dev_name, dev_twin,
                                compared_with=[str(Path(paths["train"])
                                                   .resolve())],
                                carve_check=carve_check, capped=capped)
    payload = dict(split.manifest)
    payload["paths"] = {k: str(v) for k, v in paths.items()}
    payload["registered"] = registered
    payload["near_twin"] = near_twin
    payload["dev_near_twin"] = dev_twin
    payload["near_dupe_carve_check"] = carve_check
    payload["carried_mark"] = carried
    if screen is not None:
        payload["registered_test_screen"] = screen
    # the project config trains on a file this split did not write (Round 10
    # researcher: --out elsewhere left config.json naming a missing
    # data/split/train.jsonl, and nothing said so until training)
    config_check = _split_config_check(ws, paths, args)
    payload["config_check"] = config_check
    m = split.manifest
    lines = [f"split {args.corpus}: {m['rows']} rows in {m['groups']} "
             f"share-groups (largest {m['largest_group']})",
             f"  train {m['sizes']['train']} · dev {m['sizes']['dev']} · "
             f"test {m['sizes']['test']}  → {args.out}/",
             f"  verified: {m['verified']}"] + render_carried(carried)
    if dev_twin and dev_twin.get("checked"):
        # the exact-key check above says nothing about template siblings
        # (Round 6: "no overlap" here, 7 dev near-duplicates found later)
        mark = "⚠ " if dev_twin["near_twin_rows"] else ""
        lines.append(f"  {mark}dev: {dev_twin['message']}")
        if dev_twin.get("advice"):
            lines.append(f"    → {dev_twin['advice']}")
    if any(m["overshoot"].values()):
        lines.append(f"  overshoot (whole groups, never trimmed): "
                     f"{m['overshoot']}")
    if config_check and not config_check["ok"]:
        lines.append(f"  ⚠ {config_check['message']}")
        lines.append(f"    fix: {config_check['fix']}")
    if not args.test:
        lines.append("  test side: none (--test 0) — your test set is a "
                     "separate file; register it with role=test "
                     "(nmt-forge registry add <name> <file> --role test)")
    for r in registered:
        rot = r.get("rotated_from")
        if not rot:
            lines.append(f"  registered {r['name']} (role={r['role']})")
            continue
        reads = rot["reads_by_purpose"]
        lines.append(
            f"  ROTATED {r['name']} (role={r['role']}): new content replaces "
            f"sha {rot['sha256'][:12]}… ({rot['rows']} rows) — ledgered")
        if reads:
            lines.append(
                "    the replaced content had been read "
                + ", ".join(f"{n}× for {p}" for p, n in sorted(reads.items()))
                + "; those reads stay in the ledger under this name "
                f"(nmt-forge ledger show --set {r['name']})")
        if r["role"] == "test":
            lines.append(
                "    preregistrations bound to the old content no longer "
                "apply — write a new one before scoring this set")
    if screen:
        for side, st in screen.items():
            if st["would_drop"]:
                lines.append(
                    f"  ⚠ {side}: {st['would_drop']} row(s) share an answer "
                    "with your registered test set — `nmt-forge run` will "
                    "refuse them. Screen the corpus first: nmt-forge "
                    "leak-audit <corpus> --clean-to <clean.jsonl>, then split "
                    "the cleaned file")
            elif st["template_siblings"]:
                lines.append(
                    f"  {side}: {st['template_siblings']} template sibling(s) "
                    "of test rows (kept; see nmt-forge leak-audit)")
    if args.near_dupe is not None:
        g = m["group_size_report"]
        lines.append(
            f"  near-dupe carve (Jaccard ≥ {args.near_dupe:g}"
            + (f", groups capped at {args.max_group}" if args.max_group
               else "")
            + f"): largest group = {g['largest_group']} rows "
            f"({g['largest_group_fraction']:.0%} of the corpus)"
            + (f" — the templates chain into this one group; it went to "
               f"{g.get('largest_group_side')} whole, so the other sides "
               "hold none of its sentences (they are not a sample of the "
               "whole corpus)" if g.get("chained") else ""))
        if m.get("near_dupe_links_left_uncut"):
            lines.append(
                f"    {m['near_dupe_links_left_uncut']} of "
                f"{m['near_dupe_links']} near-duplicate links left uncut by "
                f"--max-group {args.max_group}: those near-twin pairs may "
                "sit on opposite sides (the near-twin checks here count "
                "them)")
    if near_twin:
        from .guards.ci_scoring import render_near_twin_forecast

        # on the two-model route the all-data/twin-free decision is made:
        # its note would ask the user to make it again
        decided = all(f.get("two_model") for f in near_twin.values()
                      if f.get("recall_not_translation"))
        lines += [""] + render_near_twin_forecast(near_twin,
                                                  decision=not decided)
    return Out(payload, "\n".join(lines))


def _split_rotations(ws: Workspace | None, split, args) -> dict[str, dict]:
    """Decide, BEFORE anything is written, which registered sets this split
    would replace; refuse (writing nothing) without --allow-rotate.

    Two ways a split touches a registration: ``--register PREFIX`` re-registers
    ``PREFIX-dev`` / ``PREFIX-test`` with new content, and writing ``--out``
    overwrites the very file a registered set points at (its recorded hash
    would then no longer match). The second is allowed only for a set this
    split re-registers with ``--allow-rotate``. Returns ``{name: what rotating
    it replaces}`` (``EvalRegistry.rotation_record``)."""
    from .canonical import sha256_text
    from .errors import RotationRefused
    from .guards.split_guard import side_text

    if ws is None:
        return {}
    out_dir = Path(args.out).resolve()
    new = {side: (out_dir / f"{side}.jsonl", sha256_text(side_text(rows)))
           for side, rows in split.sides().items() if rows}
    sets = {n: ws.registry.get(n) for n in ws.registry.names()}
    rotations: dict[str, dict] = {}
    conflicts: list[dict] = []
    explained: set[str] = set()
    if args.register:
        for side, role in (("test", "test"), ("dev", "dev")):
            name = f"{args.register}-{side}"
            e = sets.get(name)
            if side not in new or e is None:
                continue
            if e["sha256"] == new[side][1] and e["role"] == role:
                continue                       # idempotent re-register
            if args.allow_rotate:
                rotations[name] = ws.registry.rotation_record(name, e)
            else:
                conflicts.append(ws.registry.rotation_refusal(
                    name, e, new[side][1], role))
                explained.add(name)
    for side, (path, sha) in new.items():
        for name, e in sets.items():
            if (Path(e["path"]) != path or e["sha256"] == sha
                    or name in rotations or name in explained):
                continue
            rereg = (f", or re-register that set from this split: "
                     f"--register {name[:-len(side) - 1]} --allow-rotate "
                     "(MCP: forge_split register + allow_rotate: true)"
                     if name.endswith(f"-{side}") and side in ("dev", "test")
                     and e["role"] == side else "")
            conflicts.append({
                "message": (f"writing {path} would overwrite the file "
                            f"registered as {name!r} (role={e['role']})"),
                "why": ("its recorded hash would no longer match the file, "
                        "and every score on it would be orphaned"),
                "fix": "write the split somewhere else (--out <new dir>)"
                       + rereg})
    if conflicts:
        raise RotationRefused(
            "split refused — nothing was written: "
            + "; ".join(c["message"] for c in conflicts),
            why=conflicts[0]["why"],
            fix=" | ".join(dict.fromkeys(c["fix"] for c in conflicts)))
    return rotations


def _split_near_twin(ws: Workspace | None, split, args) -> dict[str, dict]:
    """The near-twin share the export will report, measured NOW: test rows
    (the carved test side, or — with --test 0 — the registered test/sealed
    sets) that have a near-twin on the train side."""
    from .guards.ci_scoring import (near_twin_forecast,
                                    registered_near_twin_forecast)

    if not split.train:
        return {}
    if split.test:
        label = f"{args.register}-test" if args.register else "test side"
        return {label: {"role": "test", **near_twin_forecast(
            split.test, split.train,
            eval_source_field=args.source_field,
            eval_target_field=args.target_field,
            source_field=args.source_field,
            target_field=args.target_field)}}
    if ws is not None and ws.registry.names(roles=("test", "sealed")):
        return registered_near_twin_forecast(
            ws, split.train, source_field=args.source_field,
            target_field=args.target_field)
    return {}


def _split_carve_check(rows: list[dict], near_twin: dict | None,
                       dev_twin: dict | None, args) -> dict | None:
    """When twins cross the split, check whether a ``--near-dupe 0.6`` carve
    can hold out whole templates on THIS corpus — or whether its templates
    chain into one group (``split_guard.near_dupe_chaining``). Measured also
    after a ``--near-dupe … --max-group`` carve: the cap is no evidence the
    corpus can be separated, and without the check the advice went back to
    recommending the carve that cannot work (Round 11 school persona). None
    when no advice is due."""
    from .guards.ci_scoring import near_dupe_carve_check

    twinned = any((f or {}).get("near_twin_rows")
                  for f in (near_twin or {}).values())
    if not twinned and not (dev_twin or {}).get("near_twin_rows"):
        return None
    return near_dupe_carve_check(rows, source_field=args.source_field,
                                 target_field=args.target_field)


def _tailor_near_twin_advice(near_twin: dict | None, dev_twin: dict | None,
                             carve_check: dict | None, *,
                             capped: dict | None = None,
                             carved_test: bool = False,
                             dev_name: str | None = None) -> None:
    """Tailor the split's (or an audit's) near-twin advice to the corpus:
    the ``--near-dupe`` recommendation goes when the carve check says it
    cannot work here; after a ``--max-group`` carve, a carved test side's
    remaining twins are the links the cap left uncut. The dev side gets THE
    dev twin verdict (``ci_scoring.dev_twin_verdict`` — what preflight and
    status say too)."""
    from .guards.ci_scoring import (_chained, apply_dev_twin_verdict,
                                    dev_twin_verdict, near_twin_advice)

    chained = _chained(carve_check)
    for f in (near_twin or {}).values():
        if not f.get("advice"):
            continue
        if chained:
            f["advice"] = near_twin_advice(carve_check)
            f["near_dupe_carve_check"] = carve_check
        elif capped and carved_test:
            # a carved test side; a registered (fixed) test set's twins keep
            # their own advice — the cap has nothing to do with them
            f["advice"] = dev_twin_verdict(None, capped=capped)["advice"]
    apply_dev_twin_verdict(dev_twin, carve_check, dev_name=dev_name,
                           capped=capped)


def _split_two_model(ws: Workspace | None, near_twin: dict | None,
                     args) -> dict:
    """A registered (fixed) test set whose twin-free companion corpus
    leak-audit already wrote: the twins in THIS split's training side are
    the all-data model's, expected on the two-model route — say that (the
    words preflight's test-near-twins gate says, ``advisor.two_model_note``)
    instead of "fix it before training" again (Round 11 school persona)."""
    if ws is None or not near_twin or args.test:
        return {}
    from .advisor import snapshot, twin_free_pair, two_model_note

    snap = None
    out = {}
    for name, f in near_twin.items():
        if not f.get("near_twin_rows"):
            continue
        snap = snap or snapshot(ws)
        pair = twin_free_pair(ws, name, [str(Path(args.corpus).resolve())],
                              snap)
        if not pair:
            continue
        detail, fix = two_model_note(ws, name, None, pair)
        f["two_model"] = {**pair, "note": detail}
        f["advice"] = detail + (f". {fix[:1].upper()}{fix[1:]}" if fix
                                else "")
        out[name] = f["two_model"]
    return out


def _split_dev_near_twin(split, args) -> dict | None:
    """Dev rows with a near-twin on the train side — the test forecast's
    measure and threshold, for the set checkpoint selection reads."""
    from .guards.ci_scoring import dev_near_twin_forecast

    if not split.dev or not split.train:
        return None
    return dev_near_twin_forecast(
        split.dev, split.train, dev_source_field=args.source_field,
        dev_target_field=args.target_field, source_field=args.source_field,
        target_field=args.target_field)


def cmd_verify_split(args) -> Out:
    from .guards.split_guard import verify_disjoint

    sides = {Path(p).stem: load_rows(p) for p in args.sides}
    verify_disjoint(sides, source_field=args.source_field,
                    target_field=args.target_field)
    return Out({"ok": True, "sides": {n: len(r) for n, r in sides.items()},
                "verified": "0 shared canonical source/target keys"},
               f"OK: {', '.join(sides)} are group-disjoint "
               "(0 shared canonical source/target keys)")


def _near_twin_for_training(ws: Workspace, train_rows: list[dict],
                            target_field: str | None) -> dict[str, dict]:
    """For every registered test/sealed set: the share of its rows with a
    near-twin in ``train_rows`` — the measure export reports after scoring,
    said BEFORE training (``ci_scoring.registered_near_twin_forecast``)."""
    from .guards.ci_scoring import registered_near_twin_forecast

    if not train_rows:
        return {}
    return registered_near_twin_forecast(ws, train_rows,
                                         target_field=target_field)


def _audit_carve_check(train_rows: list[dict], near_twin: dict | None,
                       target_field: str | None) -> dict | None:
    """When test rows have a near-twin in what will be trained on: can a
    ``split --near-dupe`` re-carve hold out whole templates on these rows?
    Tailors the forecast's advice in place; None when no advice is due."""
    from .guards.ci_scoring import near_dupe_carve_check

    if not any((f or {}).get("near_twin_rows")
               for f in (near_twin or {}).values()):
        return None
    check = near_dupe_carve_check(train_rows, target_field=target_field)
    _tailor_near_twin_advice(near_twin, None, check)
    return check


def _audit_text_policy(ws: Workspace, corpus, report) -> dict:
    """Whose sentences leak-audit must not quote: the corpus itself, and
    every registered set an example row matched (a row that matched a
    private test answer IS most of that answer). The harness decides
    (``privacy``); forge's own sealed role is handled by the renderer."""
    from .privacy import withheld_reason

    sets = sorted({ex["set"] for lane in report.examples.values()
                   for ex in lane})
    return {"corpus": withheld_reason(corpus),
            "sets": {n: r for n in sets
                     if (r := ws.registry.text_withheld(n))}}


def _text_withheld_payload(policy: dict, corpus) -> dict | None:
    """The ``text_withheld`` field of a ``--json`` payload: why rows of these
    corpora are never quoted (``--json`` carries no sentences either way;
    this tells an agent which files not to go and read out)."""
    from .privacy import combine, note

    labels = ({Path(corpus).name: policy["corpus"]} if policy["corpus"]
              else {})
    labels.update(policy["sets"])
    if not labels:
        return None
    reason = combine(labels)
    return {"reason": reason, "corpus": policy["corpus"] or None,
            "sets": policy["sets"], "note": note(reason)}


#: The companion config `leak-audit --drop-test-twins` writes beside the
#: project's config.json (Round 9: the school and the hospital both wrote it
#: by hand — run_name, data.gold, eval.near_dupe_corpus).
COMPANION_CONFIG = "config-notwins.json"


def _ledger_audit_verdict(ws: Workspace, args, report, near_twin: dict | None,
                          verdict: dict, *, clean_to: str | None = None,
                          companion: dict | None = None) -> None:
    """Ledger the audit's verdict, content-free (counts per test/sealed set,
    paths): `nmt-forge status` carries a SEVERE verdict, the two-model
    decision and the twin-free corpus after this output has scrolled away
    (Round 9: status said `warnings: []` right after a SEVERE audit)."""
    from .advisor import AUDIT_EVENT

    sets = {n: {"n": f.get("n"), "near_twin_rows": f.get("near_twin_rows"),
                "strict_n": f.get("strict_n"),
                "severe": bool(f.get("recall_not_translation"))}
            for n, f in (near_twin or {}).items() if f.get("checked")}
    ws.ledger.append(
        AUDIT_EVENT, corpus=str(Path(args.corpus).resolve()),
        corpus_sha256=report.params.get("corpus_sha256"),
        severity=verdict.get("severity"),
        drop_test_twins=bool(args.drop_test_twins),
        clean_to=str(Path(clean_to).resolve()) if clean_to else None,
        companion_config=((companion or {}).get("path")
                          if (companion or {}).get("path") else None),
        sets=sets)


def _unpreregistered(ws: Workspace) -> list[str]:
    """Registered test/sealed sets no preregistration names yet."""
    from .advisor import snapshot

    s = snapshot(ws)
    named = {p["eval"] for p in s["preregs"] if p.get("eval")}
    return [n for n in s["roles"]["test"] + s["roles"]["sealed"]
            if n not in named]


def _companion_config(ws: Workspace, clean: Path, args) -> dict:
    """After ``--drop-test-twins``: write the config of the twin-free model
    beside the project's config.json — the same config with its own
    run_name, ``data.gold`` and ``eval.near_dupe_corpus`` pointing at the
    twin-free corpus — and say exactly what to run. Never overwrites a file.

    ``{written, path, run_name, gold, dev, dev_registered, next, note}``;
    ``path`` None (and ``note`` saying why) when there is no project
    config.json to base it on."""
    import os

    project = ws.root.parent
    base = project / "config.json"
    target = (Path(args.companion_config) if args.companion_config
              else project / COMPANION_CONFIG)
    gold = os.path.relpath(clean.resolve(), project.resolve())
    if not base.is_file():
        return {"written": False, "path": None, "run_name": None,
                "gold": gold, "dev": None, "dev_registered": None,
                "next": None,
                "note": (f"no config.json beside the workspace ({project}) "
                         "to base the twin-free model's config on: copy your "
                         "run config, give it its own run_name, and set "
                         f"data.gold and eval.near_dupe_corpus to {gold}")}
    try:
        raw = json.loads(base.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as e:
        return {"written": False, "path": None, "run_name": None,
                "gold": gold, "dev": None, "dev_registered": None,
                "next": None,
                "note": f"{base} is not readable ({e}) — fix it, then run "
                        "this command again"}
    shown = (os.path.relpath(target.resolve(), project.resolve())
             if target.resolve().is_relative_to(project.resolve())
             else str(target))
    data = dict(raw.get("data") or {})
    dev = data.get("dev")
    dev_registered = bool(dev) and dev in ws.registry.names(roles=("dev",))
    run_name = f"{raw.get('run_name') or 'model'}-notwins"
    run_cmd = (f"nmt-forge preflight run --config {shown} && "
               f"nmt-forge run {shown}")
    notes = []
    if not dev_registered:
        notes.append(
            f"the dev set {dev!r} is not registered yet, so this twin-free "
            "file still holds the rows a split would put in dev: carve the "
            "dev set first (`nmt-forge status` names the split), then run "
            "this leak-audit again — with the dev set registered, its rows "
            "are dropped from the twin-free file too")
    if data.get("synthetic"):
        notes.append(
            "config.json also trains on synthetic lanes; they were not "
            "screened for near-twins of the test set — run `leak-audit "
            "<lane> --clean-to <lane>.notwins.jsonl --drop-test-twins` on "
            "each (its own file, never the lane itself) and point "
            f"the lane at its cleaned file in {shown}")
    from .advisor import twin_free_prereg_clause

    sets = ws.registry.names(roles=("test", "sealed"))
    notes.append("; ".join(
        f"{name}: " + twin_free_prereg_clause(
            ws, name, target if target.is_file() else None)
        for name in sets) if sets else
        "the twin-free model is judged against its OWN preregistration — "
        "write it before any benchmark run on the test set (`nmt-forge "
        "prereg new <id> --eval-set <test set> --predictions <file>`); "
        "export's `--prereg <id>` says which prereg judges which model")
    out = {"path": str(target), "run_name": run_name, "gold": gold,
           "dev": dev, "dev_registered": dev_registered,
           "next": run_cmd if dev_registered else None,
           "note": "; ".join(notes)}
    if target.exists():
        try:
            held = json.loads(target.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            held = {}
        same = ((held.get("data") or {}).get("gold") == [gold]
                and (held.get("eval") or {}).get("near_dupe_corpus",
                                                 gold) == gold)
        out.update(
            written=False, run_name=held.get("run_name") or run_name,
            note=(f"{shown} already exists — left as it is (forge never "
                  "overwrites a config)"
                  + ("" if same else
                     f"; it does NOT train on {gold}: set its data.gold to "
                     f"[\"{gold}\"] and eval.near_dupe_corpus to \"{gold}\", "
                     "or pass --companion-config <new file>")
                  + ". " + out["note"]),
            next=(run_cmd if dev_registered and same else None))
        return out
    cfg = dict(raw)
    cfg["run_name"] = run_name
    data["gold"] = [gold]
    cfg["data"] = data
    if isinstance(cfg.get("eval"), dict):
        # export measures near-twins against the file the model trained on:
        # zero twins there is what makes its score the twin-free number
        cfg["eval"] = {**cfg["eval"], "near_dupe_corpus": gold}
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(cfg, indent=2, ensure_ascii=False) + "\n",
                      encoding="utf-8")
    out["written"] = True
    return out


def _render_companion(c: dict | None) -> list[str]:
    if not c:
        return []
    if not c.get("path"):
        return ["", f"companion config: not written — {c['note']}"]
    head = (f"companion config: wrote {c['path']} (run_name {c['run_name']}"
            f", data.gold [{c['gold']}], dev {c['dev']})" if c["written"] else
            f"companion config: {c['path']}")
    lines = ["", head, f"  {c['note']}"]
    if c.get("next"):
        lines.append(f"NEXT (the twin-free model): {c['next']}")
    return lines


def cmd_leak_audit(args) -> Out:
    from .guards.leak_audit import (assert_clean, audit_verdict, clean,
                                    default_twin_free_path, leak_audit,
                                    render_audit)
    from .privacy import carried_mark, carry_mark, render_carried

    ws = _ws(args)
    target_field = args.target_field or None
    if args.companion_config and not args.drop_test_twins:
        raise UsageError(
            "leak-audit --companion-config names the config of the "
            "twin-free model, which only --drop-test-twins writes — add "
            "--clean-to <notwins.jsonl> --drop-test-twins, or drop "
            "--companion-config")
    if args.drop_test_twins:
        if not args.clean_to:
            raise UsageError(
                "leak-audit --drop-test-twins writes the twin-free corpus to "
                "its own file — add --clean-to (never the all-data clean "
                "corpus: the all-data model still trains on it)\n  fix: "
                f"nmt-forge leak-audit {args.corpus} --clean-to "
                f"{default_twin_free_path(args.corpus)} --drop-test-twins")
        if not ws.registry.names(roles=("test", "sealed")):
            raise UsageError(
                "leak-audit --drop-test-twins: no test/sealed set is "
                f"registered in {ws.root} — there is nothing to drop twins "
                "of\n  fix: nmt-forge registry add <name> <test file> --role "
                "test, then run this again")
    if args.clean_to and not args.overwrite:
        # never replace a file something else depends on (Round 10: the
        # SEVERE fix, run as printed, wrote the twin-free corpus over the
        # all-data one) — decided BEFORE anything is read or written
        _refuse_clean_to_in_use(ws, args)
    rows = load_rows(args.corpus)
    if args.clean_to:
        mark = carried_mark(args.corpus)   # before the survivors are written
        manifest_path = args.manifest or str(
            Path(args.clean_to).with_suffix("")) + ".audit.json"
        # refuses (writing nothing) when dropping the test twins would leave
        # no row to train on
        survivors, report = clean(
            args.corpus, ws, manifest_path=manifest_path,
            target_field=target_field, drop_test_twins=args.drop_test_twins,
        )
        out = Path(args.clean_to)
        out.write_text(
            "\n".join(json.dumps(r, ensure_ascii=False) for r in survivors)
            + "\n", encoding="utf-8",
        )
        carried = carry_mark(args.corpus, [out], command="leak-audit",
                             mark=mark)
        policy = _audit_text_policy(ws, args.corpus, report)
        # the cleaned file is what will be trained on: the near-twin share
        # is measured against IT (by the twin-drop plan itself, when asked —
        # one audited read per set)
        near_twin = (report.near_twin_after if args.drop_test_twins
                     else _near_twin_for_training(
                         ws, survivors, report.params["target_field"]))
        carve_check = _audit_carve_check(survivors, near_twin,
                                         report.params["target_field"])
        verdict = audit_verdict(report, near_twin, corpus=args.corpus,
                                clean_to=str(out),
                                drop_test_twins=args.drop_test_twins,
                                carve_check=carve_check)
        # the twin-free model's config, beside the project's (Round 9)
        companion = (_companion_config(ws, out, args)
                     if args.drop_test_twins else None)
        _ledger_audit_verdict(ws, args, report, near_twin, verdict,
                              clean_to=str(out), companion=companion)
        need_prereg = _unpreregistered(ws)
        # the verdict leads the document: an agent reads it first
        payload = {"verdict": verdict, **report.to_manifest()}
        payload.update(rows_removed=len(rows) - len(survivors),
                       rows_kept=len(survivors),
                       removed_row_indices=sorted(
                           report.removed_row_indices()),
                       clean_to=str(out), manifest=manifest_path,
                       near_twin=near_twin, carried_mark=carried,
                       test_twins=report.test_twins,
                       companion_config=companion,
                       preregistration_needed=need_prereg,
                       text_withheld=_text_withheld_payload(policy,
                                                            args.corpus))
        payload = _index_view(payload, args, manifest_path)
        text = render_audit(
            report, rows, corpus_name=args.corpus,
            show_examples=not args.no_examples,
            target_field=report.params["target_field"],
            survivors_path=str(out), manifest_path=manifest_path,
            near_twin=near_twin, withheld=policy["sets"],
            corpus_withheld=policy["corpus"], show_text=args.show_text,
            verdict=verdict)
        return Out(payload, _before_next(
            "\n".join([text] + render_carried(carried)
                      + _render_companion(companion)),
            _prereg_needed_lines(need_prereg)))
    fn = assert_clean if args.strict else leak_audit
    report = fn(args.corpus, ws, target_field=target_field)
    # without --clean-to the corpus as it stands is the training candidate;
    # rows the audit would drop are excluded (training would refuse them)
    kept = [r for i, r in enumerate(rows)
            if i not in report.leaking_row_indices]
    near_twin = _near_twin_for_training(ws, kept,
                                        report.params["target_field"])
    carve_check = _audit_carve_check(kept, near_twin,
                                     report.params["target_field"])
    verdict = audit_verdict(report, near_twin, corpus=args.corpus,
                            carve_check=carve_check)
    _ledger_audit_verdict(ws, args, report, near_twin, verdict)
    need_prereg = _unpreregistered(ws)
    # the verdict leads the document: an agent reads it first
    manifest = {"verdict": verdict, **report.to_manifest()}
    manifest["near_twin"] = near_twin
    manifest["test_twins"] = None          # --drop-test-twins needs --clean-to
    manifest["companion_config"] = None
    manifest["preregistration_needed"] = need_prereg
    if args.manifest:
        Path(args.manifest).write_text(_dumps(manifest) + "\n",
                                       encoding="utf-8")
    policy = _audit_text_policy(ws, args.corpus, report)
    manifest["text_withheld"] = _text_withheld_payload(policy, args.corpus)
    manifest = _index_view(manifest, args, args.manifest)
    return Out(manifest, _before_next(render_audit(
        report, rows, corpus_name=args.corpus,
        show_examples=not args.no_examples,
        target_field=report.params["target_field"], near_twin=near_twin,
        withheld=policy["sets"], corpus_withheld=policy["corpus"],
        show_text=args.show_text, verdict=verdict),
        _prereg_needed_lines(need_prereg)))


def _index_view(payload: dict, args, written: str | None) -> dict:
    """The ``--json`` payload's row-index lists: in full with
    ``--full-indices``; otherwise each long list as ``{count, first}`` and
    one ``indices`` key saying where the full lists are (Round 10: the
    answer an agent reads was thousands of tokens of row numbers)."""
    from .guards.leak_audit import INDEX_PREVIEW, summarize_indices

    if args.full_indices:
        return {**payload, "indices": {"summarized": False}}
    out = summarize_indices(payload)
    out["indices"] = {
        "summarized": True,
        "note": (f"each row-index list longer than {INDEX_PREVIEW} is shown "
                 f"as {{count, first: [its first {INDEX_PREVIEW}]}}"),
        "full_lists": written,
        "flag": "--full-indices",
    }
    return out


def _clean_to_users(ws: Workspace, target: Path) -> list[tuple[str, str]]:
    """What depends on ``target`` (resolved) as it is now — ``(kind,
    phrase)`` pairs, content-free: ``config`` (a project config trains on it
    or measures near-twins against it), ``run`` (a run trained on it),
    ``split`` (a registered split was carved from it). Empty when nothing
    does."""
    from .advisor import _resolve_project_path, _run_training_files

    users: list[str] = []
    t = str(target)
    project = ws.root.parent
    for cfg in sorted(project.glob("config*.json")):
        try:
            raw = json.loads(cfg.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        if not isinstance(raw, dict):
            continue
        data = raw.get("data") or {}
        uses = []
        if any(_resolve_project_path(ws, g) == t
               for g in data.get("gold") or []):
            uses.append("data.gold")
        if any(isinstance(lane, dict) and lane.get("path")
               and _resolve_project_path(ws, lane["path"]) == t
               for lane in data.get("synthetic") or []):
            uses.append("a synthetic lane")
        ndc = (raw.get("eval") or {}).get("near_dupe_corpus")
        if ndc and _resolve_project_path(ws, ndc) == t:
            uses.append("eval.near_dupe_corpus")
        if uses:
            users.append(("config", f"{cfg.name} reads it ({', '.join(uses)})"))
    if ws.runs_dir.exists():
        for d in sorted(ws.runs_dir.iterdir()):
            man = d / "run-manifest.json"
            if not man.is_file():
                continue
            try:
                m = json.loads(man.read_text(encoding="utf-8"))
            except (OSError, json.JSONDecodeError):
                continue
            if t in _run_training_files(ws, m):
                users.append(("run", f"run {m.get('run_name') or d.name} "
                                     "trained on it"))
    for name in ws.registry.names(roles=("dev", "test", "sealed")):
        try:
            entry = ws.registry.get(name)
            sm = Path(entry["path"]).parent / "split-manifest.json"
            src = (json.loads(sm.read_text(encoding="utf-8"))
                   .get("source_corpus") or {}) if sm.is_file() else {}
        except (OSError, KeyError, json.JSONDecodeError, TypeError):
            continue
        if src.get("path") and _resolve_project_path(ws, src["path"]) == t:
            users.append(("split", f"the split that registered {name} was "
                                   "carved from it"))
    return users


def _last_audit_into(ws: Workspace, target: Path) -> dict | None:
    """The newest leak-audit verdict whose --clean-to was ``target``."""
    from .advisor import AUDIT_EVENT

    try:
        events = ws.ledger.find(AUDIT_EVENT)
    except Exception:
        return None
    for e in reversed(events):
        if e.get("clean_to") and _same_file(e["clean_to"], target):
            return e
    return None


def _same_file(a, b) -> bool:
    try:
        return Path(a).resolve() == Path(b).resolve()
    except (OSError, ValueError):
        return str(a) == str(b)


def _refuse_clean_to_in_use(ws: Workspace, args) -> None:
    """Refuse a --clean-to that would replace a file in use (see
    ``--overwrite``). Re-running the SAME audit (same corpus, same kind) into
    its own output is allowed while nothing trained on it and no split was
    carved from it — the guide's twin-free re-run after the split."""
    from .guards.leak_audit import default_twin_free_path

    target = Path(args.clean_to)
    if not target.exists():
        return
    target = target.resolve()
    users = _clean_to_users(ws, target)
    last = _last_audit_into(ws, target)
    writing = "twin-free" if args.drop_test_twins else "all-data clean"
    same_audit = (last is not None
                  and bool(last.get("drop_test_twins")) == bool(args.drop_test_twins)
                  and _same_file(last.get("corpus") or "", args.corpus))
    # the same audit rewriting its own output (the guide's twin-free re-run
    # after the split) is expected while only a config points at it; a run
    # that trained on it, or a split carved from it, always blocks
    blocking = [text for kind, text in users
                if not (same_audit and kind == "config")]
    if last is not None and not same_audit:
        was = ("the twin-free corpus" if last.get("drop_test_twins")
               else "the all-data clean corpus")
        blocking.insert(0, f"it is {was} an earlier leak-audit wrote "
                           f"({last.get('ts')}) from "
                           f"{Path(str(last.get('corpus') or '?')).name}")
    if not blocking:
        return
    if args.drop_test_twins:
        alt = default_twin_free_path(args.corpus, args.clean_to)
        if _same_file(alt, target):
            alt = str(target.with_name(target.stem + ".v2.jsonl"))
    else:
        from .guards.leak_audit import default_clean_path
        alt = default_clean_path(args.corpus)
        if _same_file(alt, target):
            alt = str(target.with_name(target.stem + ".v2.jsonl"))
    raise UsageError(
        f"leak-audit --clean-to {args.clean_to}: that file is in use — "
        + "; ".join(blocking)
        + f". Writing the {writing} corpus over it would change what "
          "they read without saying so (an all-data model would train on "
          "the twin-free corpus, or the reverse). Nothing was read or "
          "written"
        + f"\n  fix: write it to its own file — nmt-forge leak-audit "
          f"{args.corpus} --clean-to {alt}"
        + (" --drop-test-twins" if args.drop_test_twins else "")
        + "\n       or, to replace it on purpose, add --overwrite")


def _before_next(text: str, lines: list[str]) -> str:
    """``text`` with ``lines`` added — before its closing ``Next:`` line
    when it has one (the audit's own next command stays last)."""
    if not lines:
        return text
    body = text.splitlines()
    if body and body[-1].startswith(("Next:", "NEXT")):
        return "\n".join(body[:-1] + lines + ["", body[-1]])
    return "\n".join(body + lines)


def _prereg_needed_lines(names: list[str]) -> list[str]:
    """After an audit: the test sets still without a preregistration —
    written next, before any benchmark run on them (an audit read is not a
    scoring read; a benchmark is, and a prereg after it is refused)."""
    if not names:
        return []
    return ["", "next: write the preregistration for "
            + ", ".join(names) + " BEFORE any benchmark run on it (mt-eval "
            "run / run_benchmark is a scoring read; a preregistration written "
            "after one is refused) — one per model you will train: nmt-forge "
            "prereg template --out predictions.json && nmt-forge prereg new "
            f"<id> --eval-set {names[0]} --predictions predictions.json. "
            "(This audit's reads of the test set are audit reads: they never "
            "block a preregistration.)"]


def cmd_sample(args) -> Out:
    from .guards.sample_strata import stratified_sample

    from .privacy import carried_mark, carry_mark, render_carried

    rows = load_rows(args.corpus)
    mark = carried_mark(args.corpus)       # before the sample is written
    sample, manifest = stratified_sample(
        rows, args.n, cap_fraction=args.cap, key=args.key, seed=args.seed
    )
    Path(args.out).write_text(
        "\n".join(json.dumps(r, ensure_ascii=False) for r in sample) + "\n",
        encoding="utf-8",
    )
    carried = carry_mark(args.corpus, [args.out], command="sample",
                         mark=mark)
    payload = {**manifest, "out": args.out, "carried_mark": carried}
    return Out(payload, "\n".join(
        [f"sampled {len(sample)} rows (cap {args.cap:.0%} per {args.key!r}) "
         f"→ {args.out}"] + render_carried(carried) + [_dumps(manifest)]))


def cmd_ledger_show(args) -> Out:
    ws = _ws(args)
    if args.set:
        rep = ws.ledger.spend_report(args.set)
        if args.set in ws.registry.names():
            # reads mt-eval made of the same file, from the read log beside
            # it — they never reach this ledger (Round 7)
            rep["harness_reads"] = ws.registry.harness_reads(args.set)
        return Out(rep, _dumps(rep))
    entries = ws.ledger.entries()
    return Out(entries, "\n".join(json.dumps(e, ensure_ascii=False)
                                  for e in entries) or "(ledger is empty)")


def cmd_ledger_verify(args) -> Out:
    ws = _ws(args)
    n = ws.ledger.verify_chain()
    return Out({"ok": True, "entries": n},
               f"OK: hash chain intact over {n} entries")


def cmd_prereg_new(args) -> Out:
    from .guards import preregister

    ws = _ws(args)
    if (args.config_hash and len(args.config_hash) != 16
            and all(c in "0123456789abcdef" for c in args.config_hash)):
        # a hex prefix (preflight printed 12 characters before 2026-10-04)
        # pins to a hash no run has: export would then never find it
        raise UsageError(
            f"--config-hash {args.config_hash}: a run's config hash is 16 "
            "hex characters — a shorter prefix never matches the run "
            "manifest's config_hash, so the pin would bind no run\n  fix: "
            "`nmt-forge preflight run --config <the model's config>` prints "
            "the full hash (a run manifest's config_hash is the same value)")
    predictions = preregister.load_predictions(args.predictions)
    path = preregister.new(
        ws, prereg_id=args.id, eval_set=args.eval_set,
        predictions=predictions, author=args.author,
        config_hash=args.config_hash, consequences=args.consequences,
        allow_after_reads=args.allow_after_reads,
    )
    text = f"preregistered → {path} ({len(predictions)} prediction(s) bound " \
           f"to {args.eval_set!r})"
    before = ws.registry.harness_reads(args.eval_set)["before_registration"]
    if before:
        from .advisor import before_registration_text

        # accepted (they precede forge's read log, by design) — but said
        text += (f"\nnote: {before_registration_text(before)}. Whoever "
                 "wrote these predictions may have seen those scores — say "
                 "so when you report the verdicts")
    after = preregister.after_reads_info(ws, args.id)
    if after:
        text += (f"\n(override LEDGERED: {after['text']}. Every report, "
                 "export, DEPLOY.md and `nmt-forge status` says so beside "
                 "its verdicts)")
    elif args.allow_after_reads:
        text += ("\n(--allow-after-reads was not needed: no scoring read of "
                 f"{args.eval_set!r} came first)")
    # which model this prediction judges, said NOW (Round 10: the advice
    # arrived only at the end of training, after the point it could be
    # followed). export picks the prereg by --prereg; with two on one test
    # set and no --prereg, export refuses rather than guess.
    binding = [d.get("id") for d in preregister.find_for(ws, args.eval_set)
               if d.get("id")]
    model_note = (f"name each preregistration after the model it predicts "
                  f"('{args.id}' here); export judges a model against it with "
                  f"`nmt-forge export <run manifest> --prereg {args.id} --out "
                  f"<dir>` (MCP: forge_export prereg: \"{args.id}\")")
    if len(binding) > 1:
        model_note += (f". {len(binding)} preregistrations now bind "
                       f"{args.eval_set!r} ({', '.join(binding)}): export "
                       "refuses without --prereg, so pass the one that "
                       "predicted each model")
    if args.config_hash:
        model_note += (f". This one is pinned to run config "
                       f"{args.config_hash}: only that run binds it")
    text += f"\nmodel: {model_note}"
    return Out({"id": args.id, "path": str(path), "eval_set": args.eval_set,
                "predictions": len(predictions),
                "allow_after_reads": bool(args.allow_after_reads),
                # the override's size when it was used, else null
                "after_reads": after,
                "reads_before_registration": before or None,
                # every prereg binding this set now, and the export flag
                # that judges a model against THIS one (Round 10)
                "binding_preregs": binding,
                "export_with": f"--prereg {args.id}",
                "model_note": model_note}, text)


def cmd_prereg_template(args) -> Out:
    from .guards import preregister

    payload = {"format": preregister.PREDICTIONS_FORMAT,
               "template": preregister.PREDICTIONS_TEMPLATE, "path": None}
    text = preregister.PREDICTIONS_FORMAT
    if args.out:
        out = Path(args.out)
        if out.exists() and not args.force:
            raise ForgeError(f"{out} exists — pass --force to overwrite, or "
                             "choose another --out")
        out.write_text(_dumps(preregister.PREDICTIONS_TEMPLATE) + "\n",
                       encoding="utf-8")
        payload["path"] = str(out)
        text += (f"\nwrote {out} — EDIT it (the REPLACE placeholders are "
                 "refused), then: nmt-forge prereg new <id> --eval-set "
                 f"<test set> --predictions {out}")
    else:
        text += "\n" + _dumps(preregister.PREDICTIONS_TEMPLATE)
    return Out(payload, text)


def _latest_export_for(ws, eval_set: str, *, prereg_id: str | None = None
                       ) -> tuple[Path | None, list[tuple[str, str]]]:
    """The newest evaluated export (ledger order) whose test battery is
    ``eval_set`` — and, with ``prereg_id``, that was judged against THAT
    prereg (its forge-model.json records which) — what `prereg check <id>`
    reads when --results is not given. Returns ``(dir or None, [(dir,
    prereg) of the set's exports judged against another prereg])``."""
    from .export import find_forge_model

    others: list[tuple[str, str]] = []
    for e in reversed(ws.ledger.entries()):
        if e.get("event") != "export" or not e.get("evaluated") \
                or not e.get("dir"):
            continue
        fm = find_forge_model(e["dir"])   # any export layout
        if fm is None:
            continue
        try:
            doc = json.loads(fm.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        tr = doc.get("test_report") or {}
        if tr.get("set") != eval_set:
            continue
        judged = (tr.get("prereg") or {}).get("id")
        if prereg_id is None or judged == prereg_id:
            return fm.parent, others
        others.append((e["dir"], judged or "none"))
    return None, others


def render_prereg_rows(prereg_id: str, rows: list[dict],
                       after_reads: dict | None = None) -> list[str]:
    """The human rendering of prereg verdicts (prereg check AND export).
    A person's recorded verdict is shown AS a person's — who, when — never
    as a computed one. ``after_reads`` (``preregister.after_reads_info``):
    the prereg was written after scoring reads, under the override — said
    right under the verdict counts."""
    from .guards.preregister import counts_text, verdict_counts

    lines = []
    for i, r in enumerate(rows, 1):
        if r["baseline_score"] is not None and r["predicted"] in (
                "increase", "decrease", "no_change"):
            pred = (f"{r['predicted']} vs {r['baseline_score']}"
                    + (f" (margin {r['margin']})" if r["margin"] else ""))
        else:
            pred = f"\"{r['predicted']}\""
        obs = ("—" if r["observed"] is None else f"{r['observed']:.2f}"
               + (f" [{r['observed_ci'][0]:.2f}, {r['observed_ci'][1]:.2f}]"
                  if r.get("observed_ci") else ""))
        hv = r.get("human_verdict")
        if r["verdict"] == "manual" and hv:
            outcome = (f"{hv['verdict'].upper()} — human verdict by "
                       f"{hv['by']}, {hv['ts']}"
                       + (" (revised)" if hv.get("revises") else ""))
        elif r["verdict"] == "manual":
            outcome = ("MANUAL — a human compares (record it: nmt-forge "
                       f"prereg verdict {prereg_id} --prediction "
                       f"{r.get('number', i)} --held|--missed --by <name>)")
        else:
            outcome = f"{r['verdict'].upper()} (computed)"
        lines.append(f"  #{r.get('number', i)} {r['metric']} "
                     f"[{r['subset']}]: predicted {pred}; observed {obs} → "
                     f"{outcome}")
        if hv and hv.get("note"):
            lines.append(f"      human note: {hv['note']}")
        if r.get("note") and not (r["verdict"] == "manual" and hv):
            lines.append(f"      ({r['note']})")
    lines.insert(0, f"prereg {prereg_id}: "
                    + counts_text(verdict_counts(rows)))
    if after_reads:
        lines.insert(1, f"  ⚠ {after_reads['text']}")
    return lines


def cmd_prereg_check(args) -> Out:
    from .guards import preregister

    ws = _ws(args)
    prereg = preregister.load(ws, args.id)
    eval_set = (prereg.get("eval_set") or {}).get("name")
    source = args.results
    if source is None:
        # the newest export JUDGED AGAINST THIS PREREG — never merely the
        # newest export of the set: with two runs on one test set that is
        # the other run's model (Round 5 school persona)
        found, others = _latest_export_for(ws, eval_set, prereg_id=args.id)
        if found is None:
            other = (f" ({len(others)} evaluated export(s) of {eval_set!r} "
                     "were judged against another preregistration: "
                     + ", ".join(f"{d} → {pid}" for d, pid in others) + ")"
                     if others else "")
            raise ForgeError(
                f"no --results given and no evaluated export of "
                f"{eval_set!r} judged against prereg {args.id!r} in this "
                f"workspace's ledger{other}\n"
                f"  fix: nmt-forge export <run-manifest> --out <dir> --prereg "
                f"{args.id} (it scores {eval_set!r} and prints these "
                f"verdicts), or pass --results: {preregister.RESULTS_SHAPES}")
        source = str(found)
    try:
        doc, path = preregister.load_results(source)
    except ValueError as e:
        raise ForgeError(f"{e}\n  fix: pass --results "
                         "<export dir> (what `nmt-forge export` wrote) or "
                         "the JSON of `nmt-forge score --json-out`") from e
    scored = preregister.results_eval_set(doc)
    # an mt-eval TestReport names the set by its dataset id (a registered
    # card's id) — the same file as forge's name for it
    known = {eval_set}
    if scored and eval_set and scored != eval_set:
        try:
            known.add(ws.registry.identity(eval_set)["dataset_id"])
        except ForgeError:
            pass
    if scored and eval_set and scored not in known:
        raise ForgeError(
            f"{path} scores eval set {scored!r}, but prereg {args.id!r} "
            f"predicts {eval_set!r}\n"
            "  why: a prediction is checked only against the set it was "
            "written for\n"
            f"  fix: pass results for {eval_set!r}")
    rows = preregister.check(prereg, subsets=preregister.scores_by_subset(doc))
    # a person's recorded verdicts ride along, labelled as theirs
    rows = preregister.attach_human_verdicts(ws, args.id, rows)
    lines = render_prereg_rows(args.id, rows,
                               preregister.after_reads_info(ws, args.id))
    lines.insert(1, f"  results: {path}")
    return Out(rows, "\n".join(lines))


def cmd_prereg_verdict(args) -> Out:
    import getpass

    from .export import refresh_deploy_prereg
    from .guards import preregister

    ws = _ws(args)
    if args.held == args.missed:
        raise UsageError("prereg verdict needs exactly one of --held or "
                         "--missed\n  fix: nmt-forge prereg verdict "
                         f"{args.id} --prediction <n> --held (or --missed)")
    by, by_source = args.by, "--by"
    if not (by or "").strip():
        try:
            by, by_source = getpass.getuser(), "os-user"
        except Exception:      # no login name: the person must say who
            by = ""
    rec = preregister.record_verdict(
        ws, args.id, args.prediction, "held" if args.held else "missed",
        by=by, by_source=by_source, note=args.note or "",
        revise=args.revise)
    # DEPLOY.md of every export judged against this prereg shows the
    # verdict too — as a person's, never as computed
    updated = refresh_deploy_prereg(ws, args.id)
    rec["deploy_updated"] = updated
    who = (f"{rec['by']}" + (" (your login name — pass --by to name the "
                             "person who judged)"
                             if by_source == "os-user" else ""))
    lines = [f"recorded: prereg {args.id} prediction #{rec['prediction']} "
             f"({rec['metric']}: \"{rec['expected']}\") → "
             f"{rec['verdict'].upper()} — human verdict by {who}, "
             f"{rec['ts']}",
             f"  ledger entry {rec['ledger_entry']} (tamper-evident: "
             "nmt-forge ledger verify)"]
    if rec.get("revised"):
        lines.append(f"  revises the verdict {rec['revised']['verdict'].upper()}"
                     f" by {rec['revised']['by']} ({rec['revised']['ts']}) — "
                     "both stay in the ledger")
    if rec["note"]:
        lines.append(f"  note: {rec['note']}")
    for d in updated:
        lines.append(f"  updated {d}")
    lines.append(f"  see: nmt-forge prereg check {args.id}")
    return Out(rec, "\n".join(lines))


def _cli_plugins(args) -> tuple:
    from .plugins import discover_plugins_for_language, load_plugins

    plugins = tuple(load_plugins(args.plugin))
    if getattr(args, "card_plugins", None):
        plugins = plugins + tuple(discover_plugins_for_language(
            args.card_plugins, skip_fst=True))
    return plugins


def _load_hyp_rows(path: str):
    """Hypotheses preserving ids when the file carries them (battery join)."""
    p = Path(path)
    if p.suffix == ".jsonl":
        rows = load_rows(p)
        if all("id" in r for r in rows):
            return rows
        return _load_hyps(path)
    return _load_hyps(path)


def _load_attr(spec: str):
    from importlib import import_module

    module, _, attr = str(spec).partition(":")
    if not module or not attr:
        raise ForgeError(f"{spec!r} must look like 'package.module:attr'")
    return getattr(import_module(module), attr)


def cmd_score_config(args) -> Out:
    """The config-driven battery: config.eval names the registered battery,
    the grouping field, the referee plugins, the boundary canonicalizer, and
    the preregistration — one file expresses the whole eval."""
    from .guards.ci_scoring import score_battery
    from .plugins import discover_plugins_for_language, load_plugins
    from .reporting import render_battery_report
    from .training.config import RunConfig

    cfg = RunConfig.from_file(args.config)
    ev = cfg.eval_battery
    if not ev:
        raise ForgeError(
            f"{args.config}: no eval block — add "
            '"eval": {"battery": "<registered set>", …} to the config'
        )
    ws = Workspace(cfg.workspace)
    plugins = tuple(load_plugins(ev.get("plugins", [])))
    if ev.get("card_plugins"):
        plugins += tuple(discover_plugins_for_language(
            ev["card_plugins"], skip_fst=True))
    conventions = _load_attr(ev["conventions"]) if ev.get("conventions") else None
    canonicalizer = (_load_attr(ev["canonicalizer"])
                     if ev.get("canonicalizer") else None)
    report = score_battery(
        ws, ev["battery"], _load_hyp_rows(args.hyps),
        by=ev.get("by", "register"),
        metrics=tuple(ev.get("metrics", ["chrf++"])),
        plugins=plugins,
        conventions=conventions,
        canonicalizer=canonicalizer,
        target_lang=(cfg.language or {}).get("target", ""),
        n_bootstrap=int(ev.get("n_bootstrap", 1000)),
        seed=int(ev.get("seed", 12345)),
        config_hash=cfg.hash(),
        override_respend=args.override_respend,
        near_dupe_corpus=ev.get("near_dupe_corpus"),
        prereg_id=args.prereg,
    )
    out_base = Path(args.hyps).with_suffix("")
    manifest_path = Path(args.json_out) if args.json_out else \
        out_base.with_name(out_base.name + "-battery.json")
    manifest = report.to_manifest()
    manifest_path.write_text(_dumps(manifest) + "\n", encoding="utf-8")
    report_md = manifest_path.with_suffix(".md")
    report_md.write_text(render_battery_report(manifest), encoding="utf-8")
    return Out({**manifest, "written": {"manifest": str(manifest_path),
                                        "report_md": str(report_md)}},
               report.format() + f"\n\nwrote {manifest_path} and {report_md}")


def cmd_score(args) -> Out:
    if getattr(args, "config", None):
        return cmd_score_config(args)
    from .guards.ci_scoring import DEFAULT_METRICS, score_eval_set

    if not args.eval_set:
        raise ForgeError("pass --eval-set (or --config with an eval block)")
    ws = _ws(args)
    hyps = _load_hyps(args.hyps)
    metrics = tuple(args.metric) if args.metric else DEFAULT_METRICS
    report = score_eval_set(
        ws, args.eval_set, hyps, config_hash=args.config_hash,
        metrics=metrics, plugins=_cli_plugins(args),
        target_lang=args.target_lang,
        override_respend=args.override_respend,
        prereg_id=args.prereg,
    )
    manifest = report.to_manifest()
    if args.json_out:
        Path(args.json_out).write_text(_dumps(manifest) + "\n",
                                       encoding="utf-8")
    return Out(manifest, report.format())


def _export_for_hyps(ws: Workspace, eval_set: str, hyps) -> dict | None:
    """The export whose evaluation wrote these hypotheses (the same file, or
    the same bytes), for ``eval_set`` — read from the workspace ledger's
    exports. Its forge-model.json carries the near-twin reading export and
    DEPLOY.md print."""
    from .canonical import sha256_file
    from .export import workspace_exports

    hp = Path(hyps).resolve()
    sha = sha256_file(hp) if hp.is_file() else None
    for x in reversed(workspace_exports(ws)):
        tr = x["doc"].get("test_report") or {}
        if tr.get("set") != eval_set or not tr.get("battery_manifest"):
            continue
        written = (x["fm"].parent / tr["battery_manifest"]).parent \
            / "battery-hyps.jsonl"
        try:
            same = (written.resolve() == hp
                    or (sha is not None and written.is_file()
                        and sha256_file(written) == sha))
        except OSError:
            same = False
        if same:
            return x
    return None


def _compare_side(ws: Workspace, eval_set: str, hyps, run_manifest,
                  ) -> dict | None:
    """One system's near-twin reading for `compare`: from its run manifest's
    training files (``--run-a/--run-b``: the forecast preflight and split
    use), else from the export that wrote these hypotheses (the reading its
    DEPLOY.md carries) — or None when forge cannot know what it trained
    on. Never a different measure: the same function, threshold and
    count."""
    from .guards.ci_scoring import registered_near_twin_forecast

    if run_manifest:
        try:
            m = json.loads(Path(run_manifest).read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as e:
            raise ForgeError(f"{run_manifest}: not a readable run manifest "
                             f"({e})") from e
        ev = (m.get("config") or {}).get("eval") or {}
        data = (m.get("config") or {}).get("data") or {}
        files = ([ev["near_dupe_corpus"]] if ev.get("near_dupe_corpus") else
                 [str(g) for g in data.get("gold") or []]
                 + [str(lane.get("path")) for lane in
                    data.get("synthetic") or []
                    if isinstance(lane, dict) and lane.get("path")])
        resolved = []
        for f in files:
            q = Path(f)
            if not q.is_file() and not q.is_absolute():
                q = ws.root.parent / f           # the project directory
            resolved.append(q)
        missing = [str(q) for q in resolved if not q.is_file()]
        if not resolved or missing:
            return {"checked": False, "source": f"run manifest {run_manifest}",
                    "message": ("its training file(s) are not on disk: "
                                + ", ".join(missing) if missing else
                                "its config names no training file")}
        rows: list[dict] = []
        for q in resolved:
            rows.extend(load_rows(q))
        f = registered_near_twin_forecast(ws, rows, names=[eval_set])[eval_set]
        return {**f, "source": f"run {m.get('run_name')}: "
                               + ", ".join(str(q) for q in resolved)}
    x = _export_for_hyps(ws, eval_set, hyps)
    if x is None:
        return None
    nt = (x["doc"].get("test_report") or {}).get("near_twin")
    if not nt:
        return None
    return {**nt, "source": f"export {x['dir']}"}


def cmd_compare(args) -> Out:
    from dataclasses import asdict

    from .guards.ci_scoring import compare_near_twin, compare_on_eval_set

    ws = _ws(args)
    metrics = tuple(args.metric) if args.metric else ("chrf++",)
    report = compare_on_eval_set(
        ws, args.eval_set, _load_hyps(args.hyps_a), _load_hyps(args.hyps_b),
        labels=(args.label_a, args.label_b), config_hash=args.config_hash,
        metrics=metrics, plugins=_cli_plugins(args),
        target_lang=args.target_lang,
        override_respend=args.override_respend,
        prereg_id=args.prereg,
    )
    # a winner whose test rows are twinned in its training data won on
    # recall — say so beside the result (Round 9); and what mt-eval wrote
    # about the outputs of the export each hypotheses file came from
    # (Round 13: a near-constant twin-free model, "measures translation")
    compare_near_twin(report, {
        args.label_a: _compare_side(ws, args.eval_set, args.hyps_a,
                                    args.run_a),
        args.label_b: _compare_side(ws, args.eval_set, args.hyps_b,
                                    args.run_b)},
        harness_caveats={
            args.label_a: _compare_caveats(ws, args.eval_set, args.hyps_a),
            args.label_b: _compare_caveats(ws, args.eval_set, args.hyps_b)})
    return Out(asdict(report), report.format())


def _compare_caveats(ws: Workspace, eval_set: str, hyps) -> list | None:
    """mt-eval's ``score_caveats`` for these hypotheses: those of the export
    whose evaluation wrote them (the same file or bytes) — computed by the
    harness on exactly these outputs. None when no export matches or its
    TestReport carries none."""
    from .harness_caveats import for_export

    x = _export_for_hyps(ws, eval_set, hyps)
    if x is None:
        return None
    return for_export(x["fm"], x["doc"])["score_caveats"]


def cmd_discover(args) -> Out:
    from dataclasses import asdict

    from .cards import discover, format_report

    report = discover(args.code, cards_path=args.cards_dir,
                      check_registry=not args.no_registry)
    return Out(asdict(report), format_report(report))


def cmd_init(args) -> Out:
    from .scaffold import init_project

    summary = init_project(args.code, args.dir, pair=args.pair,
                           cards_path=args.cards_dir,
                           model_preset=args.model, base=args.base,
                           no_card=args.no_card, name=args.name)
    m = summary["model"]
    text = "\n".join([
        f"initialized {summary['project']} for {summary['language']['name']} "
        f"({summary['language']['code']})",
        f"  card:       {summary['language']['card']}",
        f"  config:     {summary['config']}",
        f"  workspace:  {summary['workspace']}",
        f"  model:      {summary['model_preset']} — backend {m['backend']}"
        + (f", base {m['base']}" if m.get("base") else ""),
        f"              needs: {m['needs']}",
        f"              expect: {m['expect']}",
        f"  time budget: {m['time_budget_note']}",
        f"  next steps: {summary['next_steps']}",
    ] + ([f"  optional:   {(summary.get('referee') or {})['note']}"]
         if (summary.get("referee") or {}).get("note") else []) + [
        "",
        f"NEXT: cd {summary['project']} && nmt-forge status",
    ])
    return Out(summary, text)


def cmd_synth(args) -> Out:
    from .synthesis.engine import SynthesisEngine
    from .synthesis.packs import load_pack

    pack = load_pack(args.pack)
    engine = SynthesisEngine(pack, seed=args.seed)
    manifest = engine.run(args.out, limit_per_kind=args.limit)
    return Out(manifest, _dumps(manifest))


def cmd_run(args) -> Out:
    from .export import (EXPORT_ORDER_NOTE, suggest_export_dir,
                         workspace_run_count)
    from .guards import ci_scoring
    from .training.run import run

    manifest = run(args.config)
    # a run-named folder when the workspace holds several runs (or export/
    # already holds another run's export)
    run_ws = Workspace((manifest.get("config") or {}).get("workspace")
                       or args.workspace)
    out_dir = suggest_export_dir(manifest["run_name"], workspace=run_ws)
    several = workspace_run_count(run_ws) >= 2
    # two preregistrations on the test set: the NEXT line carries the
    # --prereg export needs, as status does (Round 8)
    from .advisor import export_prereg_for

    prereg_flag, prereg_note = export_prereg_for(run_ws,
                                                 manifest["manifest_path"])
    nxt = (f"nmt-forge export {manifest['manifest_path']}{prereg_flag} "
           f"--out {out_dir}")
    payload = {
        "run": manifest["run_name"],
        "config_hash": manifest["config_hash"],
        "selected_checkpoint": manifest["selected_checkpoint"],
        "selected_path": manifest.get("selected_path"),
        "backend": manifest.get("backend"),
        "manifest": manifest["manifest_path"],
        "report_path": manifest.get("report_path"),
        "dev_set": manifest["dev_set"],
        "dev_report": manifest["dev_report"],
        "dev_saturation": manifest.get("dev_saturation"),
        "export_out": out_dir,
        "next": nxt,
        # why `next` carries --prereg (or the choice of it), or None
        "prereg_note": prereg_note or None,
        "export_order_note": EXPORT_ORDER_NOTE if several else None,
    }
    report = ci_scoring.ScoreReport(
        n=manifest["dev_report"]["n"],
        scores=manifest["dev_report"]["scores"],
        eval_set=manifest["dev_set"]["name"],
        dataset_id=manifest["dev_set"].get("dataset_id"),
    )
    text = "\n".join([
        _dumps({k: payload[k] for k in ("run", "config_hash",
                                        "selected_checkpoint", "manifest")}),
        "",
        "dev report (95% CIs — there is no bare-score rendering):",
        report.format(),
        *ci_scoring.render_dev_saturation(manifest.get("dev_saturation")),
        "",
        f"NEXT: {nxt}"
        + ("   # a folder of its own: this workspace holds several runs"
           if several else
           "   # export/ already holds another export — a fresh folder"
           if out_dir != "export/" else ""),
        *([f"  ({prereg_note})"] if prereg_note else []),
        *([f"  ({EXPORT_ORDER_NOTE})"] if several else []),
    ])
    return Out(payload, text)


def cmd_evaluate(args) -> Out:
    from .training.evaluate import evaluate

    from .harness_bridge import render_metric_coverage

    if args.glossary and not args.harness_out:
        raise UsageError("--glossary scores terminology in the mt-eval "
                         "report, which only --harness-out DIR writes — add "
                         "--harness-out, or drop --glossary")
    report, paths = evaluate(
        args.run_manifest, config_path=args.config, out_hyps=args.out_hyps,
        harness_out=args.harness_out, glossary=args.glossary,
        prereg_id=args.prereg)
    lines = [report.format(), "",
             f"wrote {paths['hyps']}, {paths['manifest']} and "
             f"{paths['report_md']}"]
    if paths.get("harness_report"):
        from .harness_caveats import text_lines

        lines.append(f"mt-eval RunLog + TestReport: {paths['harness_runlog']} "
                     f"· {paths['harness_report']}")
        from .scoring_standard import HEADLINE_NOTE, headline_text

        # scoring standard/1: the TestReport's corpus chrF++ with its CI
        lines.append("headline: "
                     + headline_text(paths.get("harness_headline"),
                                     signature=True)
                     + f" — {HEADLINE_NOTE}")
        # what mt-eval says qualifies these scores, in its words (Round 13)
        lines += text_lines(paths.get("harness_score_caveats"))
        lines += render_metric_coverage(paths.get("harness_metrics"),
                                        indent="")
    if paths.get("mark"):
        terms = ", ".join(f"{k} {v}" for k, v in paths["mark"].items())
        lines.append(f"the written files keep the test set's terms ({terms}):"
                     " a .champollion.json sidecar next to each")
    lines += ["", "(the battery report ends with a Diagnosis & "
                  "Recommendations section — read it, then run `nmt-forge "
                  "lint` for --json findings)"]
    return Out({"battery": report.to_manifest(), "paths": paths},
               "\n".join(lines))


def cmd_export(args) -> Out:
    from .export import export_run

    from .harness_bridge import render_metric_coverage

    summary = export_run(
        args.run_manifest, args.out, config_path=args.config,
        evaluate_battery=not args.no_eval, include_model=not args.no_model,
        endpoint=args.endpoint, port=args.port, name=args.name,
        force=args.force, glossary=args.glossary, prereg_id=args.prereg)
    lines = [f"exported {summary['run']} → {summary['export_dir']}"]
    if summary.get("evaluated"):
        groups = summary.get("test_groups") or {}
        did = summary.get("dataset_id")
        if did and did != summary["battery"]:
            lines.append(f"  test set {summary['battery']} = dataset {did} "
                         f"(from {summary.get('dataset_id_source')})")
        from .scoring_standard import HEADLINE_NOTE, cite, score_line

        # scoring standard/1: ONE headline — the TestReport's corpus chrF++
        # with its 95% CI and sacreBLEU signature; BLEU/spBLEU/TER/COMET
        # beside it; everything else a diagnostic
        hl = summary.get("headline") or {}
        lines.append(f"  headline: {hl.get('text') or 'chrF++ —'} on test "
                     f"set {summary['battery']} — {HEADLINE_NOTE}")
        if hl.get("secondary_text"):
            lines.append(f"    beside it, never blended: "
                         f"{hl['secondary_text']}")
        if hl.get("signature"):
            lines.append(f"    sacreBLEU signature: {hl['signature']}")
        for g, scores in groups.items():
            if len(groups) == 1:
                # the headline above already gives this read's chrF++
                rest = score_line(scores, primary=False)
                if rest:
                    lines.append(f"  also on this read (test battery "
                                 f"{summary['battery']}): {rest}")
                continue
            lines.append(f"  test battery {summary['battery']} · {g}: "
                         + score_line(scores))
        if len(groups) > 1:
            w = summary.get("test_weighted") or {}
            lines.append("  weighted across groups (no CI; a summary, "
                         "never the headline): "
                         + ", ".join(f"{k} {v:.2f}" for k, v in w.items()))
        nt = summary.get("near_twin")
        sibs = summary.get("twin_free_siblings") or []
        from .harness_caveats import QUOTE_WITH_CAVEAT, majors, text_lines

        if nt:
            mark = "⚠ " if nt.get("recall_not_translation") else ""
            lines.append(f"  {mark}{nt['message']}")
        # what mt-eval says qualifies this score, in its words (Round 13)
        lines += text_lines(summary.get("score_caveats"), prefix="  ")
        if nt:
            if sibs:
                # a twin-free model of the same test set is already
                # exported here: name it instead of "go train one" — with
                # what mt-eval says qualifies ITS score
                for s in sibs:
                    flagged = bool(majors(s.get("score_caveats")))
                    lines.append(
                        "    → THE NUMBER TO QUOTE for new sentences"
                        + (f" — {QUOTE_WITH_CAVEAT}" if flagged else "")
                        + f": the twin-free model {s['name']} (run "
                        f"{s['run']}, {s['model_dir'] or s['export_dir']}) — "
                        f"{cite(s['score'])} on this same "
                        "test set, no test row twinned in its training "
                        "data (that model's score; DEPLOY.md cites it"
                        + (" with the caveat" if flagged else "") + "). "
                        "Never quote this model's score alone")
                    lines += text_lines(s.get("score_caveats"),
                                        prefix="      on that model's test "
                                               "output: ")
            elif nt.get("advice"):
                lines.append(f"    → {nt['advice']}")
        if summary.get("prereg"):
            pre = summary["prereg"]
            lines.append(f"  judged against preregistration {pre['id']} "
                         f"({pre.get('bound_by')})")
            lines += ["  " + ln for ln in
                      render_prereg_rows(pre["id"], pre["verdicts"],
                                         pre.get("after_reads"))]
        lines += render_metric_coverage(summary.get("harness_metrics"))
        lines.append(f"  evaluation (your test sentences — NEVER copy it "
                     f"with the model): {summary['evaluation_dir']}")
        if summary.get("evaluation_mark"):
            terms = ", ".join(f"{k} {v}" for k, v in
                              summary["evaluation_mark"].items())
            lines.append(f"    every file in it keeps the test set's terms "
                         f"({terms}) as a .champollion.json sidecar")
        lines.append(f"    battery report: {summary['battery_report']}")
        lines.append(f"    mt-eval TestReport: {summary['harness_report']}")
        if summary.get("hypotheses"):
            # the file `compare` takes (Round 13: the persona guessed it)
            lines.append(f"    hypotheses (for `nmt-forge compare --hyps-a/"
                         f"--hyps-b`): {summary['hypotheses']}")
        flagged = bool(majors(summary.get("score_caveats")))
        for d in summary.get("cited_in") or []:
            lines.append(
                ("  " + d) if " NOT updated: " in d else
                f"  this twin-free score is now cited as the number to quote "
                f"in the inflated export's {d}"
                + (" — WITH its score caveat above, which that DEPLOY.md "
                   "now carries beside it" if flagged else ""))
    from .guards.ci_scoring import render_dev_saturation

    lines += render_dev_saturation(summary.get("dev_saturation"),
                                   prefix="  ")
    if summary.get("model_dir"):
        lines.append(f"  model to deploy (copy this folder, and only it): "
                     f"{summary['model_dir']}")
        lines.append(f"    champollion plugin manifest: "
                     f"{summary['method_manifest']}")
        lines.append(f"    how to deploy: {summary['deploy']}")
        lines.append("")
        lines.append(f"NEXT: {summary['serve']}")
    return Out(summary, "\n".join(lines))


def cmd_serve(args) -> Out:
    import os

    from .serve import TOKEN_ENV, build_server

    httpd, model = build_server(
        args.export_dir, host=args.host, port=args.port, token=args.token,
        device=args.device, allow_no_hook=args.no_hook,
        allow_locales=args.allow_locale)
    host, port = httpd.server_address[:2]
    base = f"http://{host}:{port}"
    # Serving is recorded as SERVED — a trial, an agent's provisional pick —
    # never as the user's choice (Round 10 hospital persona: the agent's
    # provisional serve became "the export you chose"). Only `nmt-forge
    # choose` (or `serve --choose`) records the choice.
    choice_note = None
    serve_ws = serve_rec = None
    if Path(args.workspace).is_dir():
        from .export import find_forge_model

        fm = find_forge_model(args.export_dir)
        if fm is not None:
            import socket
            import time

            ws = _ws(args)
            model_dir = str(fm.parent.resolve())
            # where and by which process: `status` reads it to tell
            # "served and answering" from "served once, now down" (Round 12
            # hospital persona: status said "serve <chosen>/model" while it
            # was being served and the app had synced against it)
            serve_rec = {"model_dir": model_dir, "model": model.name,
                         "url": base, "host": host, "port": port,
                         "pid": os.getpid(),
                         "hostname": socket.gethostname(),
                         "started": time.time()}
            ws.ledger.append(SERVE_EVENT, **serve_rec)
            serve_ws = ws
            if args.choose:
                ws.ledger.append(CHOOSE_EVENT, model_dir=model_dir,
                                 model=model.name, via="serve --choose")
            else:
                choice_note = _choice_note(ws, model_dir)
    ready = {"serving": base, "model": model.name,
             "endpoints": {"champollion_api": f"{base}/translate",
                           "openai_chat": f"{base}/v1/chat/completions",
                           "openai_base": f"{base}/v1",
                           "health": f"{base}/health"},
             "pair": model.health()["pair"],
             "auth": ("bearer token required"
                      if (args.token or os.environ.get(TOKEN_ENV))
                      else "none (loopback only)"),
             "chosen": bool(args.choose),
             "choice_note": choice_note}
    args._emit_ready(ready, "\n".join([
        f"[serve] {model.name} ({ready['pair']}) on {base}",
        f"  champollion api method:  {ready['endpoints']['champollion_api']}",
        f"  OpenAI-compatible base:  {ready['endpoints']['openai_base']}",
        f"  auth: {ready['auth']} · Ctrl-C to stop"]
        + ([f"  {choice_note}"] if choice_note else [])
        + (["  recorded as the deployment choice (--choose)"]
           if args.choose else [])))
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        httpd.server_close()
        if serve_ws is not None:
            # a clean stop is recorded; a killed server is found by status's
            # pid check and health probe instead
            try:
                serve_ws.ledger.append(SERVE_STOP_EVENT,
                                       model_dir=serve_rec["model_dir"],
                                       url=serve_rec["url"],
                                       pid=serve_rec["pid"])
            except Exception as e:      # never mask the server's own exit
                print(f"[serve] could not record the stop in the ledger "
                      f"({type(e).__name__}: {e}) — `nmt-forge status` "
                      "finds the server gone by its health probe",
                      file=sys.stderr)
    return Out(None)


#: The ledger events `nmt-forge serve` writes when it starts serving (with
#: its address and pid) and when it stops — what `status` reads (Round 12).
from .advisor import SERVE_EVENT, SERVE_STOP_EVENT  # noqa: E402

#: The ledger event that records the USER's deployment choice among
#: exports — written only by `nmt-forge choose` / `serve --choose`.
CHOOSE_EVENT = "choose"


def _servable_exports(ws: Workspace) -> list[dict]:
    from .advisor import snapshot

    return [x for x in snapshot(ws).get("exports", [])
            if x.get("model_included", True) and x.get("dir")]


def _choice_note(ws: Workspace, model_dir: str) -> str | None:
    """After a serve without --choose: when several exports exist and none
    is chosen, say that this serve is not the choice, and how to record it."""
    from .advisor import _same_path

    servable = _servable_exports(ws)
    if len(servable) < 2:
        return None
    chosen = [e for e in ws.ledger.entries()
              if e.get("event") == CHOOSE_EVENT]
    if chosen and _same_path(chosen[-1].get("model_dir"), model_dir):
        return None
    return ("served — NOT recorded as the deployment choice: "
            f"{len(servable)} exports exist and choosing between them is the "
            "user's call (`nmt-forge status` lists each with its scores). "
            f"Record it with `nmt-forge choose {model_dir}`")


def cmd_choose(args) -> Out:
    """Record the user's deployment choice among the exports — the one
    `nmt-forge status` then names. Never inferred from a serve."""
    from .advisor import _same_path
    from .export import find_forge_model

    ws = _ws(args)
    fm = find_forge_model(args.model_dir)
    servable = _servable_exports(ws)
    dirs = [x.get("model_dir") or x["dir"] for x in servable]
    if fm is None or not any(_same_path(fm.parent, d) for d in dirs):
        raise UsageError(
            f"nmt-forge choose {args.model_dir}: not an export this workspace "
            f"recorded — the exports with a model are: {dirs or 'NONE'}\n"
            "  fix: nmt-forge choose <one of those model directories> (or "
            "export the run first: nmt-forge export <run-manifest> --out "
            "<dir>)")
    model_dir = str(fm.parent.resolve())
    ws.ledger.append(CHOOSE_EVENT, model_dir=model_dir,
                     via="choose", note=args.note or None)
    return Out({"chosen": model_dir, "exports": len(servable),
                "note": args.note or None,
                "next": f"nmt-forge serve {model_dir}"},
               f"recorded the deployment choice: {model_dir}"
               + (f" ({args.note})" if args.note else "")
               + f"\nNext: nmt-forge serve {model_dir}")


def cmd_monitor(args) -> Out:
    import time

    from .monitor import watch

    mon = watch(args.run_dir, pid=args.pid, port=args.port,
                open_browser=not args.no_browser, log_path=args.log)
    args._emit_ready({"monitor": mon.url, "run_dir": str(args.run_dir)},
                     f"[monitor] watching {args.run_dir} — Ctrl-C to detach "
                     "(training keeps running)")
    try:
        while True:
            time.sleep(3600)
    except KeyboardInterrupt:
        mon.shutdown()
    return Out(None)


def cmd_report(args) -> Out:
    from .reporting import render

    text = render(args.manifest, workspace=args.workspace)
    return Out({"manifest": str(args.manifest), "markdown": text}, text)


def cmd_status(args) -> Out:
    from .advisor import next_action, render_status, snapshot

    ws = _ws(args)
    return Out({"snapshot": snapshot(ws), "advice": next_action(ws).to_json()},
               render_status(ws))


def cmd_preflight(args) -> Out:
    from .advisor import preflight, render_preflight

    ws = _ws(args)
    gates = preflight(ws, args.target, args.config)
    return Out([g.to_json() for g in gates],
               render_preflight(ws, args.target, args.config, gates=gates),
               0 if all(g.ok for g in gates) else 2)


def _is_run_manifest(doc: dict) -> bool:
    """A run-manifest.json `nmt-forge run` wrote (not a battery manifest)."""
    return (doc.get("guard") != "ci-scoring/battery"
            and ("selected_checkpoint" in doc
                 or ("run_name" in doc and "stages" in doc)))


def cmd_lint(args) -> Out:
    from .guards.battery_lint import lint_battery, render_diagnosis

    from .harness_caveats import for_battery_manifest
    from .scoring_standard import for_battery_manifest as headline_for

    manifest = json.loads(Path(args.manifest).read_text())
    run_manifest = (json.loads(Path(args.run_manifest).read_text())
                    if args.run_manifest else None)
    if _is_run_manifest(manifest):
        # Round 14: a run manifest here linted as an empty battery — "0
        # findings" for a model whose score carries a MAJOR mt-eval caveat
        return _lint_run_manifest(args, manifest)
    # the harness's caveats on the TestReport of the same read: recorded in
    # the manifest, or (an export written before Round 13) read from the
    # matching runlog_report.json beside it — with the read's headline
    # (scoring standard/1: corpus chrF++ and its CI) they qualify
    findings = lint_battery(
        manifest, run_manifest=run_manifest,
        harness_caveats=for_battery_manifest(manifest, args.manifest),
        headline=headline_for(manifest, args.manifest))
    return Out([f.to_json() for f in findings], render_diagnosis(findings))


def _lint_run_manifest(args, run_manifest: dict) -> Out:
    """``nmt-forge lint <run-manifest.json>``: lint the battery manifest of
    every export of that run (its scored test read), with the run manifest
    for the schedule/plateau signals — so the harness's caveats on the
    run's exported score (R9, with the headline chrF++ and its CI) are
    relayed. A run with no scored export is REFUSED with the exact export
    command; never "0 findings" (Round 14)."""
    from dataclasses import replace

    from .errors import LintInputError
    from .export import suggest_export_dir, workspace_exports
    from .guards.battery_lint import lint_battery, render_diagnosis
    from .harness_caveats import for_export, text_lines
    from .reporting import workspace_for_manifest
    from .scoring_standard import HEADLINE_NOTE
    from .scoring_standard import for_export as headline_for_export

    mp = Path(args.manifest)
    name = run_manifest.get("run_name") or "?"
    ws = workspace_for_manifest(mp, getattr(args, "workspace", None))
    evaluated, unscored = [], []
    if ws is not None:
        for x in workspace_exports(ws):
            rm = (x["doc"].get("run") or {}).get("manifest")
            if not rm or Path(rm).resolve() != mp.resolve():
                continue
            (evaluated if x["doc"].get("test_report") else unscored).append(x)
    if not evaluated:
        fresh = suggest_export_dir(name, workspace=ws)
        battery = f"{fresh}/evaluation/battery-hyps-battery.json"
        why = ("lint diagnoses the battery manifest of a SCORED test read "
               "(and relays every caveat mt-eval wrote on that score); a run "
               "manifest holds no test score"
               + (f" — run {name!r} was exported only without a test score "
                  "(--no-eval): " + ", ".join(x["dir"] for x in unscored)
                  if unscored else
                  f" and run {name!r} has no export in "
                  + (f"the workspace {ws.root}" if ws is not None else
                     "a workspace forge could find from where the manifest "
                     "sits (pass --workspace <dir>)")))
        raise LintInputError(
            f"{mp} is a run manifest, not a battery manifest",
            why=why,
            fix=(f"nmt-forge export {mp} --out {fresh} (scores the test set "
                 "once, prereg-gated), then `nmt-forge lint "
                 f"{battery} --run-manifest {mp}` — or lint a battery "
                 "manifest `nmt-forge evaluate` wrote "
                 "(`<out-hyps>-battery.json`)"))
    findings, lines = [], [f"lint of run {name} — its scored export(s):"]
    for x in evaluated:
        doc, fm = x["doc"], x["fm"]
        tr = doc.get("test_report") or {}
        bpath = (fm.parent / tr["battery_manifest"]
                 if tr.get("battery_manifest") else None)
        try:
            battery = json.loads(bpath.read_text(encoding="utf-8")) \
                if bpath is not None else None
        except (OSError, json.JSONDecodeError):
            battery = None
        if battery is None:
            # the evaluation folder is gone (moved, or never copied): lint
            # the numbers forge-model.json kept — the harness's caveats on
            # the score are there too
            battery = {"guard": "ci-scoring/battery", "eval_set": tr.get("set"),
                       "n": tr.get("n"),
                       "groups": {g: {"scores": sc} for g, sc in
                                  (tr.get("groups") or {}).items()}}
        caveats = for_export(fm, doc)["score_caveats"]
        headline = headline_for_export(fm, doc)
        where = {"export": x["dir"],
                 "battery_manifest": str(bpath.resolve()) if bpath else None}
        for f in lint_battery(battery, run_manifest=run_manifest,
                              harness_caveats=caveats, headline=headline):
            findings.append(replace(f, evidence={**f.evidence, **where}))
        lines.append(f"  {x['dir']} — test set {tr.get('set')} "
                     f"(n={tr.get('n')}): "
                     f"{(headline or {}).get('text') or 'chrF++ —'} "
                     f"({HEADLINE_NOTE})")
        lines += text_lines(caveats, prefix="    ")
        on_disk = bpath is not None and bpath.is_file()
        lines.append(f"    battery manifest: {bpath.resolve()}" if on_disk else
                     "    battery manifest not on disk — linted from "
                     f"{fm}")
    return Out([f.to_json() for f in findings],
               "\n".join(lines + ["", render_diagnosis(findings)]))


# -- parser -------------------------------------------------------------------

def _add(sub, name: str, func, **kw) -> argparse.ArgumentParser:
    p = sub.add_parser(name, **kw)
    p.add_argument("--json", action="store_true",
                   help="print exactly one JSON document on stdout (other "
                        "output → stderr); errors as {\"error\": …}, exit 2")
    p.set_defaults(func=func)
    return p


def _add_show_text(p: argparse.ArgumentParser, *, errors_only: bool) -> None:
    """``--show-text``: the one opt-in that prints a withheld corpus's
    sentences (local-only / sealed / consent-required — ``privacy``), for a
    person at the terminal. ``errors_only``: the command prints no sentences
    except inside an error message it relays."""
    from .privacy import SHOW_TEXT_ERRORS_HELP, SHOW_TEXT_FLAG, SHOW_TEXT_HELP

    p.add_argument(SHOW_TEXT_FLAG, dest="show_text", action="store_true",
                   help=SHOW_TEXT_ERRORS_HELP if errors_only
                   else SHOW_TEXT_HELP)


def build_parser() -> argparse.ArgumentParser:
    from .guards.leak_audit import INDEX_PREVIEW, NEAR_TWIN_JACCARD
    from .training.presets import DEFAULT_PRESET, MODEL_PRESETS

    ap = _Parser(
        prog="nmt-forge",
        description="NMT training suite with guardrails: group-disjoint splits, "
                    "dev fencing, leak audits, CIs by default, preregistration. "
                    "Every command takes --json.",
    )
    ap.add_argument("--workspace", default=".forge",
                    help="workspace directory (default ./.forge)")
    ap.add_argument("--version", action=_VersionAction,
                    help="print nmt-forge's version (and the eval harness "
                         "it scores with) and exit")
    sub = ap.add_subparsers(dest="command", required=True,
                            parser_class=_Parser)

    p = _add(sub, "discover", cmd_discover,
             help="what does this language have? (reads the language card "
                  "through the eval harness's resolver; absence = unknown, "
                  "never zero)")
    p.add_argument("code", help="ISO 639-3 code (e.g. crk, fra, nav, arb)")
    p.add_argument("--cards-dir", default=None,
                   help="a directory of <code>.json language cards (e.g. "
                        "exported with `champollion network card <code> --json`). "
                        "Default: $MT_EVAL_CARDS_DIR / $CHAMPOLLION_CARDS_DIR, "
                        "a checkout or node_modules/champollion above the "
                        "working directory, else the public card index "
                        "(cached; reused offline)")
    p.add_argument("--no-registry", action="store_true",
                   help="skip the mt-eval registry cross-check of eval datasets")

    presets_help = "; ".join(f"{k}: {v['summary']}"
                             for k, v in MODEL_PRESETS.items())
    p = _add(sub, "init", cmd_init,
             help="scaffold a project from a language card: workspace + "
                  "starter config + NEXT_STEPS.md")
    p.add_argument("code", help="ISO 639-3 code of the TARGET language")
    p.add_argument("--dir", default=".", help="project directory (default .)")
    p.add_argument("--pair", default=None,
                   help="language pair: eng-crk, or 'eng>crk' (quote the > "
                        "form — an unquoted > is a shell redirect) (default "
                        "eng-<code>)")
    p.add_argument("--cards-dir", default=None,
                   help="a directory of <code>.json language cards (see "
                        "`discover --help`)")
    p.add_argument("--model", default=DEFAULT_PRESET,
                   choices=sorted(MODEL_PRESETS),
                   help=f"model preset (default {DEFAULT_PRESET}) — "
                        + presets_help)
    p.add_argument("--no-card", action="store_true",
                   help="scaffold a language the card index doesn't have "
                        "yet (everything a card would say is then unknown)")
    p.add_argument("--name", default=None,
                   help="the language's name (with --no-card)")
    p.add_argument("--base", default=None,
                   help="pretrained model for --model cpu-finetune (a Hugging "
                        "Face id or a local dir, e.g. an opus-mt model for a "
                        "RELATED pair); optional override for nllb-600m")

    p = _add(sub, "status", cmd_status,
             help="where am I? state table + THE next command "
                  "(agents: call this first, use --json)")

    p = _add(sub, "preflight", cmd_preflight,
             help="will <command> refuse? every gate it will hit, "
                  "with fixes (exit 2 if any gate fails)")
    p.add_argument("target", help="command to preflight: run|evaluate|export|"
                                  "serve|score|split|prereg|leak-audit")
    p.add_argument("--config", default=None,
                   help="run config for run/evaluate/export (default "
                        "./config.json) — checks it parses, its dev set, its "
                        "data files, and that the backend's extra is "
                        "installed")

    p = _add(sub, "lint", cmd_lint,
             help="diagnose a battery manifest: weak registers → "
                  "likeliest cause → the lever to pull next; every caveat "
                  "mt-eval wrote on the same read's TestReport (a "
                  "near-constant output, length, copies) is a finding, "
                  "beside the headline chrF++ and its CI")
    p.add_argument("manifest", help="battery manifest json "
                                    "(guard: ci-scoring/battery); an "
                                    "export's is `<export>/evaluation/"
                                    "battery-hyps-battery.json`. A run's "
                                    "run-manifest.json lints the battery "
                                    "of every scored export of that run "
                                    "(refused, with the export command, "
                                    "when it has none)")
    p.add_argument("--run-manifest", default=None,
                   help="run manifest for schedule/transfer-plateau signals")

    p = sub.add_parser("registry", help="eval-set registry")
    rsub = p.add_subparsers(dest="registry_command", required=True,
                            parser_class=_Parser)
    pa = _add(rsub, "add", cmd_registry_add,
              help="register an eval file (dev|test|sealed)")
    pa.add_argument("name")
    pa.add_argument("path")
    pa.add_argument("--role", dest="role", required=True,
                    choices=("dev", "test", "sealed"))
    pa.add_argument("--source-field", default="source")
    pa.add_argument("--target-field", default=None)
    pa.add_argument("--note", default="")
    pa.add_argument("--allow-rotate", action="store_true",
                    help="replace a set already registered under NAME with "
                         "other content/role — ledgered with what it replaced "
                         "and how often that content was read")
    _add(rsub, "list", cmd_registry_list, help="list registered eval sets")
    ph = _add(rsub, "add-harness", cmd_registry_add_harness,
              help="materialize an mt-eval registry dataset "
                   "(fetch-from-source) and register it as an "
                   "eval set — contamination flags stamped; "
                   "quarantined sets refused; do_not_train means "
                   "it can never enter a training mix")
    ph.add_argument("dataset_id")
    ph.add_argument("--role", default="test", choices=("dev", "test", "sealed"))
    ph.add_argument("--yes", action="store_true",
                    help="accept the harness's fetch prompts non-interactively")

    p = _add(sub, "split", cmd_split, help="group-disjoint train/dev/test carve")
    p.add_argument("corpus")
    p.add_argument("--test", type=int, required=True,
                   help="test rows to carve (≥ 0). Use 0 when your test set "
                        "is a SEPARATE file (teacher-checked, private): "
                        "register it with `registry add <name> <file> --role "
                        "test` and carve only train/dev")
    p.add_argument("--dev", type=int, default=0,
                   help="dev rows to carve (checkpoint selection runs on "
                        "these; training refuses without a dev set)")
    p.add_argument("--seed", type=int, required=True)
    p.add_argument("--out", required=True)
    p.add_argument("--source-field", default="source")
    p.add_argument("--target-field", default="target")
    p.add_argument("--register", default=None, metavar="PREFIX",
                   help="also register PREFIX-test / PREFIX-dev in the workspace")
    p.add_argument("--allow-rotate", action="store_true",
                   help="with --register: replace PREFIX-dev / PREFIX-test "
                        "when they are already registered with other content "
                        "(e.g. re-splitting after leak-audit --clean-to). "
                        "The rotation is ledgered with what it replaced and "
                        "how often that content was read; without the flag a "
                        "conflicting split is refused before any file is "
                        "written")
    p.add_argument("--near-dupe", type=float, default=None, metavar="JACCARD",
                   help="also keep NEAR-duplicates on one side (e.g. 0.6): "
                        "rows whose source or target words overlap at ≥ this "
                        "Jaccard are grouped, so sentences built on the same "
                        "template/frame never straddle train and test. Use it "
                        "when the split reports test rows with a near-twin in "
                        "training. Templates can chain into one huge group on "
                        "a small templated corpus: when a side would get "
                        "far more rows than asked (over 1.5x), split refuses "
                        "and says what to do")
    p.add_argument("--max-group", type=int, default=None, metavar="N",
                   help="with --near-dupe: cap near-duplicate share-groups at "
                        "N rows (strongest links first), so templates that "
                        "chain cannot form one giant group. Exact-duplicate "
                        "groups are never capped. Near-duplicate links left "
                        "uncut are counted, and the split's near-twin check "
                        "reports the twins that cross sides")

    p = _add(sub, "verify-split", cmd_verify_split,
             help="zero-overlap check on existing files")
    p.add_argument("sides", nargs="+", help="train/dev/test files (any subset)")
    p.add_argument("--source-field", default="source")
    p.add_argument("--target-field", default="target")

    p = _add(sub, "leak-audit", cmd_leak_audit,
             help="screen a corpus vs registered evals — explains what it "
                  "would drop (exact / near-duplicate answers) and what it "
                  "keeps on purpose (template siblings; a NEAR-duplicate "
                  "prompt with a different answer — an IDENTICAL prompt is "
                  "dropped), with examples; deterministic. With a fixed "
                  "test set, --drop-test-twins also drops the training rows "
                  "that are near-twins of it")
    p.add_argument("corpus")
    p.add_argument("--strict", action="store_true",
                   help="hard-fail on test/sealed hits")
    p.add_argument("--clean-to", default=None,
                   help="write surviving rows here (plus an audit manifest "
                        "next to it)")
    p.add_argument("--drop-test-twins", action="store_true",
                   help="with --clean-to: ALSO drop the training rows that "
                        "are near-twins of a registered test/sealed row "
                        "(identical, or a word overlap — Jaccard — ≥ "
                        f"{NEAR_TWIN_JACCARD} on the source or the target "
                        "side: the measure the "
                        "test-score near-twin check uses), template siblings "
                        "included. For a FIXED test set (teacher-written, "
                        "registered — not carved by split, so split "
                        "--near-dupe cannot help) whose rows mostly have a "
                        "twin in training: without this, the test score "
                        "measures recall of training phrases. Says how many "
                        "rows it drops and what the strict subset becomes; "
                        "refuses to leave nothing to train on. Also writes "
                        "the twin-free model's config (--companion-config) "
                        "and names the command that trains it")
    p.add_argument("--companion-config", default=None, metavar="PATH",
                   help="with --drop-test-twins: where to write the config "
                        "of the twin-free model (default: "
                        f"{COMPANION_CONFIG} beside the project's "
                        "config.json) — the same config with its own "
                        "run_name, data.gold and eval.near_dupe_corpus set to "
                        "the --clean-to file. An existing file is never "
                        "overwritten")
    p.add_argument("--manifest", default=None,
                   help="content-free audit manifest path (default with "
                        "--clean-to: <clean-to>.audit.json)")
    p.add_argument("--overwrite", action="store_true",
                   help="let --clean-to replace a file that is in use: one a "
                        "project config trains on (data.gold, a synthetic "
                        "lane, eval.near_dupe_corpus), one a run trained on, "
                        "the corpus a registered split was carved from, or "
                        "the output of a different audit (the all-data clean "
                        "corpus vs the twin-free one). Refused without it")
    p.add_argument("--full-indices", action="store_true",
                   help="--json: print every row-index list in full (by "
                        "default each list longer than "
                        f"{INDEX_PREVIEW} shows its count and first "
                        f"{INDEX_PREVIEW}; the audit file written beside "
                        "--clean-to always keeps them in full)")
    p.add_argument("--target-field", default=None)
    p.add_argument("--no-examples", action="store_true",
                   help="don't quote corpus rows in the human output")
    _add_show_text(p, errors_only=False)

    p = _add(sub, "sample", cmd_sample, help="per-kind capped reservoir sample")
    p.add_argument("corpus")
    p.add_argument("--n", type=int, required=True)
    p.add_argument("--cap", type=float, default=0.15)
    p.add_argument("--key", default="kind")
    p.add_argument("--seed", type=int, required=True)
    p.add_argument("--out", required=True)

    p = sub.add_parser("ledger", help="eval-ledger inspection")
    lsub = p.add_subparsers(dest="ledger_command", required=True,
                            parser_class=_Parser)
    ps = _add(lsub, "show", cmd_ledger_show, help="ledger entries or a spend "
                                                  "report")
    ps.add_argument("--set", default=None, help="spend report for one set")
    _add(lsub, "verify", cmd_ledger_verify, help="verify the hash chain")

    p = sub.add_parser("prereg", help="preregistration")
    psub = p.add_subparsers(dest="prereg_command", required=True,
                            parser_class=_Parser)
    pt = _add(psub, "template", cmd_prereg_template,
              help="print the ONE predictions-file format and (with --out) "
                   "write a valid template to edit")
    pt.add_argument("--out", default=None, help="write the template here")
    pt.add_argument("--force", action="store_true")
    pn = _add(psub, "new", cmd_prereg_new,
              help="bind predictions to a registered test/sealed set BEFORE "
                   "any score exists")
    pn.add_argument("id")
    pn.add_argument("--eval-set", required=True)
    pn.add_argument("--predictions", required=True,
                    help="a .json file holding a JSON ARRAY of prediction "
                         "objects — see `nmt-forge prereg template`")
    pn.add_argument("--author", default="")
    pn.add_argument("--config-hash", default=None,
                    help="pin this prediction to ONE run config: its full "
                         "16-character hash (`nmt-forge preflight run "
                         "--config <file>` prints it; a run manifest's "
                         "config_hash). Only a run of exactly that config "
                         "binds it — any edit of the config changes the "
                         "hash. Unpinned, name the prereg after its model "
                         "and pass --prereg on export")
    pn.add_argument("--consequences", default="")
    pn.add_argument("--allow-after-reads", action="store_true",
                    help="preregister a NEW experiment on an eval set that "
                         "already has scored reads (delta-predictions "
                         "against known baselines). The override is "
                         "ledgered — never silent.")
    pc = _add(psub, "check", cmd_prereg_check,
              help="verdict predictions against a score report")
    pc.add_argument("id")
    pc.add_argument("--results", default=None,
                    help="an export directory (what `export` wrote), its "
                         "battery manifest (eval/*-battery.json), its mt-eval "
                         "TestReport, or a ScoreReport (score --json-out). "
                         "Default: the newest evaluated export in the "
                         "ledger that was JUDGED AGAINST THIS prereg (never "
                         "merely the newest export of its eval set — with "
                         "two runs on one set that is the other model)")
    pv = _add(psub, "verdict", cmd_prereg_verdict,
              help="record a PERSON's verdict on a prediction forge cannot "
                   "verdict itself (free-text, or no baseline_score): "
                   "ledgered with who, when and a note; shown as human, "
                   "never as computed")
    pv.add_argument("id", help="the preregistration id")
    pv.add_argument("--prediction", required=True, metavar="N|ID",
                    help="the prediction's number as `prereg check` prints "
                         "it (#1 → 1), or its own \"id\"")
    pvv = pv.add_mutually_exclusive_group(required=True)
    pvv.add_argument("--held", action="store_true",
                     help="the observed result matches what was predicted")
    pvv.add_argument("--missed", action="store_true",
                     help="the observed result does not match the "
                          "prediction")
    pv.add_argument("--by", default=None, metavar="NAME",
                    help="who judged (default: your login name, recorded as "
                         "such)")
    pv.add_argument("--note", default="",
                    help="why — e.g. 'predicted 15-60, observed 100.00'")
    pv.add_argument("--revise", action="store_true",
                    help="replace an earlier verdict on this prediction "
                         "(both stay in the ledger; the newest is shown)")

    p = _add(sub, "score", cmd_score,
             help="score hypotheses on a registered set (CIs always)")
    p.add_argument("--eval-set", default=None)
    p.add_argument("--config", default=None,
                   help="run-config path: drives the battery from its eval "
                        "block (registered battery, grouping, plugins, "
                        "canonicalizer, prereg binding) — one file, whole eval")
    p.add_argument("--hyps", required=True)
    p.add_argument("--config-hash", default=None)
    p.add_argument("--metric", action="append", default=[],
                   help="lane to score (repeatable): chrf++, bleu, "
                        "exact_match, comet, comet-qe, metricx "
                        "(default: chrf++/bleu/exact_match)")
    p.add_argument("--target-lang", default="",
                   help="ISO 639-3 target code — resolves the right neural "
                        "metric model and its low-resource warning")
    p.add_argument("--plugin", action="append", default=[],
                   help="LYSS-protocol metric plugin, 'module.path:ClassName' "
                        "(repeatable); its numeric aggregates become CI'd lanes")
    p.add_argument("--card-plugins", default=None, metavar="CODE",
                   help="run the harness's plugin discovery for this language "
                        "(card evalMetrics + FST validity + behavioral linters)")
    p.add_argument("--override-respend", default=None)
    p.add_argument("--prereg", default=None, metavar="ID", help=PREREG_HELP)
    p.add_argument("--json-out", default=None)
    _add_show_text(p, errors_only=True)

    p = _add(sub, "compare", cmd_compare,
             help="A/B on a registered set (prereg-gated) — with each "
                  "system's near-twin caveat (a win on recall of training "
                  "phrases is said to be one) and the score caveats mt-eval "
                  "wrote on the export that produced its hypotheses")
    p.add_argument("--eval-set", required=True)
    p.add_argument("--hyps-a", required=True,
                   help="system A's hypotheses: an export's is "
                        "`<export>/evaluation/battery-hyps.jsonl` (the "
                        "export summary's `hypotheses`)")
    p.add_argument("--hyps-b", required=True,
                   help="system B's hypotheses (as --hyps-a)")
    p.add_argument("--label-a", default="A")
    p.add_argument("--label-b", default="B")
    p.add_argument("--run-a", default=None, metavar="RUN_MANIFEST",
                   help="the run-manifest.json of system A's model: its "
                        "training files are checked for near-twins of the "
                        "eval set (the measure export reports), so a win on "
                        "recall is said to be one. Without it, hypotheses "
                        "an export wrote (<export>/evaluation/"
                        "battery-hyps.jsonl) are matched to that export's "
                        "reading; anything else is said to be unchecked")
    p.add_argument("--run-b", default=None, metavar="RUN_MANIFEST",
                   help="the same for system B")
    p.add_argument("--config-hash", default=None)
    p.add_argument("--metric", action="append", default=[],
                   help="lane to compare (repeatable; default chrf++) — "
                        "incl. comet/comet-qe/metricx")
    p.add_argument("--target-lang", default="")
    p.add_argument("--plugin", action="append", default=[],
                   help="LYSS-protocol metric plugin (repeatable)")
    p.add_argument("--card-plugins", default=None, metavar="CODE",
                   help="harness plugin discovery for this language")
    p.add_argument("--override-respend", default=None)
    p.add_argument("--prereg", default=None, metavar="ID", help=PREREG_HELP)
    _add_show_text(p, errors_only=True)

    p = _add(sub, "synth", cmd_synth, help="run a language pack's synthesis")
    p.add_argument("pack",
                   help="a 'module.path:get_pack' spec (e.g. "
                        "nmt_forge_crk.pack:get_pack) or an installed pack's "
                        "entry-point name (e.g. crk)")
    p.add_argument("--out", required=True)
    p.add_argument("--seed", type=int, default=42)
    p.add_argument("--limit", type=int, default=None)

    p = _add(sub, "run", cmd_run,
             help="single-command reproducible training run")
    p.add_argument("config")
    _add_show_text(p, errors_only=True)

    p = _add(sub, "evaluate", cmd_evaluate,
             help="close the loop: decode the config's battery with the "
                  "run's SELECTED checkpoint, score it (CIs, prereg-gated) "
                  "and auto-diagnose — no manual decode")
    p.add_argument("run_manifest",
                   help="run-manifest.json written by `nmt-forge run`")
    p.add_argument("--config", default=None,
                   help="run-config path (defaults to the config embedded in "
                        "the run manifest); must carry an eval block")
    p.add_argument("--out-hyps", default=None,
                   help="where to write decoded battery hypotheses "
                        "(default: alongside the run manifest)")
    p.add_argument("--harness-out", default=None, metavar="DIR",
                   help="also write an mt-eval RunLog + TestReport here "
                        "(built by the harness from this same read; they "
                        "contain the eval set's text)")
    p.add_argument("--glossary", default=None, metavar="FILE.json",
                   help=GLOSSARY_HELP)
    p.add_argument("--prereg", default=None, metavar="ID", help=PREREG_HELP)
    _add_show_text(p, errors_only=True)

    p = _add(sub, "export", cmd_export,
             help="evaluate the run on its test battery (prereg-gated) AND "
                  "package it: model/ (in the --out directory) is the "
                  "deployable model — weights, tokenizer, forge-model.json, "
                  "DEPLOY.md, champollion plugin manifest, no test "
                  "sentences; evaluation/ beside it holds the battery report "
                  "and the mt-eval RunLog + TestReport — your test "
                  "sentences, never deployed")
    p.add_argument("run_manifest",
                   help="run-manifest.json written by `nmt-forge run`")
    p.add_argument("--out", required=True,
                   help="export directory (new/empty); gets model/ and "
                        "evaluation/")
    p.add_argument("--config", default=None,
                   help="run-config path (defaults to the embedded config)")
    p.add_argument("--no-eval", action="store_true",
                   help="package without scoring the test battery (e.g. a "
                        "sealed set already spent)")
    p.add_argument("--no-model", action="store_true",
                   help="write the evaluation + mt-eval report only")
    p.add_argument("--glossary", default=None, metavar="FILE.json",
                   help=GLOSSARY_HELP)
    p.add_argument("--endpoint", default=None,
                   help="URL the champollion plugin manifest points at "
                        "(default http://127.0.0.1:<port>/translate)")
    p.add_argument("--port", type=int, default=8378)
    p.add_argument("--name", default=None,
                   help="plugin/model name (kebab-case; default "
                        "nmt-forge-<run>)")
    p.add_argument("--force", action="store_true",
                   help="replace a non-empty --out directory")
    p.add_argument("--prereg", default=None, metavar="ID", help=PREREG_HELP)
    _add_show_text(p, errors_only=True)

    p = _add(sub, "serve", cmd_serve,
             help="serve an exported model: champollion api contract "
                  "(POST /translate) + OpenAI-compatible "
                  "/v1/chat/completions; binds 127.0.0.1")
    p.add_argument("export_dir",
                   help="the model directory `nmt-forge export` wrote "
                        "(model/ in its --out directory), or the export "
                        "directory itself")
    p.add_argument("--host", default="127.0.0.1",
                   help="bind address (non-loopback requires a token)")
    p.add_argument("--port", type=int, default=8378,
                   help="port to listen on (default 8378); if it is in use, "
                        "pick another and point the champollion endpoint at "
                        "it")
    p.add_argument("--token", default=None,
                   help="bearer token clients must send (default "
                        "$NMT_FORGE_SERVE_TOKEN; required off-loopback)")
    p.add_argument("--device", default="auto", choices=("auto", "cpu"))
    p.add_argument("--no-hook", action="store_true",
                   help="serve WITHOUT the run's decode hook (reported on "
                        "/health and every response)")
    p.add_argument("--allow-locale", action="append", default=[],
                   metavar="CODE|SRC:TGT",
                   help="also accept this locale code (repeatable) — e.g. "
                        "--allow-locale en:crk when the export could not "
                        "resolve the card aliases offline")
    p.add_argument("--choose", action="store_true",
                   help="also record this export as the USER's deployment "
                        "choice (as `nmt-forge choose` does). Without it a "
                        "serve is recorded as served — a trial — never as "
                        "the choice")

    p = _add(sub, "choose", cmd_choose,
             help="record the user's deployment choice among several "
                  "exports — the one `nmt-forge status` then names. Serving "
                  "a model never records it")
    p.add_argument("model_dir",
                   help="the chosen export's model directory (model/ in its "
                        "--out directory)")
    p.add_argument("--note", default=None,
                   help="why (kept in the ledger), e.g. 'chosen by the "
                        "clinical lead, 2026-10-04'")

    p = _add(sub, "monitor", cmd_monitor,
             help="attach the human-facing GUI to a running (or "
                  "finished) run dir: loss curves + floor + a loud "
                  "stop button; read-only otherwise (new runs open "
                  "it automatically)")
    p.add_argument("run_dir", help="the run directory under <ws>/runs/")
    p.add_argument("--pid", type=int, default=None,
                   help="training process id — lets the stop button actually "
                        "kill an attached run")
    p.add_argument("--log", default=None,
                   help="the trainer's stdout log — makes the panel live "
                        "from minute one (loss every logging step + rate/ETA) "
                        "instead of waiting for the first checkpoint dump")
    p.add_argument("--port", type=int, default=8377)
    p.add_argument("--no-browser", action="store_true")

    p = _add(sub, "report", cmd_report,
             help="re-render the plain-language report from a run "
                  "or battery manifest")
    p.add_argument("manifest")

    return ap


def _command_corpora(args) -> tuple[list[str], list[str]]:
    """``(workspaces, corpus files)`` a command touched — where an error
    message's sentences could have come from (``privacy.scrub_error``):
    the workspace(s), positional corpora, ``verify-split`` sides, ``registry
    add``'s file, and the data files a run config names."""
    workspaces = [getattr(args, "workspace", None)]
    paths = [v for a in ("corpus", "path")
             if isinstance(v := getattr(args, a, None), str)]
    paths += [str(x) for x in (getattr(args, "sides", None) or [])]
    raw = None
    cfg = getattr(args, "config", None)
    try:
        if isinstance(cfg, str) and Path(cfg).is_file():
            raw = json.loads(Path(cfg).read_text(encoding="utf-8"))
        elif isinstance(getattr(args, "run_manifest", None), str):
            raw = json.loads(Path(args.run_manifest).read_text(
                encoding="utf-8")).get("config")
    except (OSError, ValueError, AttributeError):
        raw = None
    if isinstance(raw, dict):
        workspaces.append(raw.get("workspace"))
        data = raw.get("data") or {}
        paths += [str(g) for g in data.get("gold") or []]
        paths += [str(lane.get("path")) for lane in data.get("synthetic") or []
                  if isinstance(lane, dict) and lane.get("path")]
    return [w for w in workspaces if w], paths


def _withhold_in_error(args, text: str) -> tuple[str, str]:
    """``(text, note)``: an error's text with the sentences of any corpus the
    harness withholds replaced (``privacy.scrub_error``), and the one line
    saying so (``""`` when nothing was replaced). Never raises — this runs
    while reporting another failure; if the check itself fails, the error is
    shown as raised and the note says, loudly, that it was NOT checked."""
    if args is None or not text:
        return text, ""
    from .privacy import note, scrub_error

    original = text
    try:
        workspaces, paths = _command_corpora(args)
        reasons = []
        for i, ws in enumerate(workspaces):
            text, why = scrub_error(
                text, workspace=ws, paths=paths if i == 0 else (),
                show_text=bool(getattr(args, "show_text", False)))
            if why:
                reasons.append(why)
    except Exception as exc:   # never mask the real error — but never silently
        return original, (
            f"WARNING: this error was NOT checked for sentences of a "
            f"local-only / sealed / consent-required corpus — the check "
            f"failed ({type(exc).__name__}: {exc}). An AI agent should not "
            f"pass it on.")
    if not reasons:
        return text, ""
    return text, note("; ".join(reasons), flag=hasattr(args, "show_text"))


def _scrub_payload(args, payload: dict) -> dict:
    """``_error_payload`` with every text field through
    :func:`_withhold_in_error` (+ ``text_withheld``: the note, when any)."""
    err = dict(payload["error"])
    notes = []
    for k, v in err.items():
        if isinstance(v, str) and v:
            err[k], n = _withhold_in_error(args, v)
            if n:
                notes.append(n)
    if notes:
        err["text_withheld"] = notes[0]
    return {"error": err}


def _error_payload(e: BaseException) -> dict:
    text = str(e)
    return {"error": {
        "type": type(e).__name__,
        "guard": getattr(e, "guard", None),
        "message": text.splitlines()[0] if text else type(e).__name__,
        "why": getattr(e, "why", "") or None,
        "fix": getattr(e, "fix", "") or None,
        "how_to_get": getattr(e, "how_to_get", "") or None,
        "text": text,
        **({"details": e.details} if getattr(e, "details", None) else {}),
    }}


def main(argv: list[str] | None = None) -> int:
    argv = list(sys.argv[1:] if argv is None else argv)
    json_mode = "--json" in argv
    real_stdout = sys.stdout

    def emit_json(obj) -> None:
        real_stdout.write(_dumps(obj) + "\n")
        real_stdout.flush()

    try:
        args = build_parser().parse_args(argv)
    except _VersionRequested:
        info = version_info()
        if json_mode:
            emit_json(info)
        else:
            print(f"nmt-forge {info['nmt_forge']} (mt-eval-harness "
                  f"{info['mt_eval_harness']}; Python {info['python']})")
        return 0
    except UsageError as e:
        if json_mode:
            emit_json(_error_payload(e))
        else:
            print(str(e), file=sys.stderr)
        return 2

    json_mode = bool(getattr(args, "json", False))

    def emit_ready(payload, text) -> None:
        # long-running commands (serve, monitor) announce readiness once
        if json_mode:
            emit_json(payload)
        else:
            print(text, file=real_stdout, flush=True)

    args._emit_ready = emit_ready
    if getattr(args, "command", None) != "run":
        return _execute(args, json_mode, emit_json)
    # `nmt-forge run`: whatever happens, the LAST line is `RUN EXIT <code> —
    # …` — the line NEXT_STEPS.md tells an agent watching the log to wait
    # for (it used to be printed by nothing, so a finished run looked hung)
    args._run_exit = "crashed before reporting"
    try:
        code = _execute(args, json_mode, emit_json)
    except KeyboardInterrupt:
        code, args._run_exit = 130, "interrupted (Ctrl-C / SIGINT) — no model"
    _print_run_exit(code, args._run_exit, json_mode, real_stdout)
    return code


#: The exit codes the RUN EXIT line names (and `nmt-forge run` returns).
RUN_EXIT_MEANING = {0: "finished", 1: "crashed", 2: "refused",
                    130: "interrupted"}


def _print_run_exit(code: int, detail: str, json_mode: bool,
                    real_stdout) -> None:
    """The run's last line. Under --json stdout carries only the JSON
    document, so the line goes to stderr (where the training log goes);
    otherwise to stdout after the human report. Both streams are flushed
    first, so in a combined log (`> run.log 2>&1`) it really is last."""
    line = (f"RUN EXIT {code} ({RUN_EXIT_MEANING.get(code, 'failed')}) — "
            f"{detail}")
    stream = sys.stderr if json_mode else real_stdout
    for s in (real_stdout, sys.stderr):
        with contextlib.suppress(Exception):
            s.flush()
    print(line, file=stream, flush=True)


def _run_finished_detail(payload: dict) -> str:
    nxt = payload.get("next") or (f"nmt-forge export {payload.get('manifest')}"
                                  " --out export/")
    sat = (" ⚠ dev set SATURATED — selection had nothing to choose between "
           "(see the dev report)" if payload.get("dev_saturation") else "")
    order = (f" ({payload['export_order_note']})"
             if payload.get("export_order_note") else "")
    return (f"run {payload.get('run')!r} finished; selected checkpoint "
            f"{payload.get('selected_checkpoint')};{sat} next: {nxt}{order}")


def _execute(args, json_mode: bool, emit_json) -> int:
    """Run the parsed command and render its result or refusal; returns the
    exit code. ``args._run_exit`` (set only for `run`) receives the one-line
    outcome the RUN EXIT line reports."""
    is_run = hasattr(args, "_run_exit")
    try:
        if json_mode:
            # stdout is reserved for the ONE JSON document: anything the
            # command (or a trainer it drives) prints goes to stderr
            with contextlib.redirect_stdout(sys.stderr):
                out = args.func(args)
        else:
            out = args.func(args)
    except (ForgeError, OSError, KeyError) as e:
        # a refusal: forge's own messages are content-free, but an error
        # raised inside a plugin / tokenizer / model can quote a row — the
        # sentences of a withheld corpus are scrubbed before printing
        if isinstance(e, KeyError):
            # e.g. rows without a detectable target/reference field
            e = ForgeError(f"data error: {e}")
        text = (f"file error: {e}" if isinstance(e, OSError)
                else str(e))
        text, withheld = _withhold_in_error(args, text)
        if is_run:
            args._run_exit = ("refused: " + (text.splitlines() or [""])[0]
                              + " (the full message is above)")
        if json_mode:
            emit_json(_scrub_payload(args, _error_payload(e)))
        else:
            print(text + (f"\n{withheld}" if withheld else ""),
                  file=sys.stderr)
        return 2
    except Exception as e:
        # unexpected: shown as Python would show it — unless the traceback
        # quotes a withheld corpus's sentence, which is scrubbed first
        import traceback

        tb = traceback.format_exc()
        safe, withheld = _withhold_in_error(args, tb)
        if is_run:
            last = (safe.strip().splitlines() or [type(e).__name__])[-1]
            args._run_exit = f"crashed: {last} (traceback above)"
        if not withheld:
            if not is_run:
                raise
            print(tb, file=sys.stderr, end="")   # then the RUN EXIT line
            return 1
        if json_mode:
            emit_json(_scrub_payload(args, _error_payload(e)))
        print(safe + withheld, file=sys.stderr)
        return 1
    if is_run and isinstance(out.payload, dict):
        args._run_exit = _run_finished_detail(out.payload)
    if out.payload is None and out.text is None:
        return out.code
    if json_mode:
        emit_json(out.payload)
    else:
        print(out.text if out.text is not None else _dumps(out.payload))
    return out.code

if __name__ == "__main__":
    sys.exit(main())
