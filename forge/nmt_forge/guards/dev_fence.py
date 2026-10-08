"""dev-fence — checkpoint selection must never see the test set (guard #2).

The catalogued failure: training periodically evaluated and kept the
checkpoint with the best score — computed ON THE TEST SET. Like letting
students peek at the final exam after every study session and keeping
whichever study state did best on it. Every run before 2026-07-12 had this,
which is why the ledger's entry #3 concludes THERE IS NO VALID BASELINE.

The fence has two independent layers:

1. **Identity**: the training runner accepts a dev set only through
   :meth:`DevFence.require_dev` — a registry name with ``role=dev``, sha
   verified, read ledgered. A missing dev set refuses to train at all
   (the reference trainer's "refuses to start if dev.jsonl is missing").

2. **Content**: the dev rows' canonical source AND target keys must not
   intersect any registered ``test``/``sealed`` set. This catches the file
   tricks identity checks can't: ``cp test.jsonl dev.jsonl``, a re-export of
   test rows under a new name, a dev file that quietly grew test rows.

Users wiring their own trainer (raw HF ``Seq2SeqTrainer`` etc.) get the same
content layer via :meth:`DevFence.check_rows` — run it on whatever you are
about to pass as ``eval_dataset``.

3. **Training side** (synthetic hospital persona, Round 12): no training row
   may BE a dev row — the same canonical source or target, the rule the
   split's group-disjoint carve keeps. A file the split never carved can
   break it: the twin-free corpus ``leak-audit --drop-test-twins`` wrote
   BEFORE the split still held 111 rows the split then put in dev, and the
   run trained on them without a word (the dev rows count as non-fatal in
   the leak audit). :meth:`DevFence.require_disjoint_training` refuses that
   in ``nmt-forge run``, and ``preflight run``'s dev-fence gate runs the same
   check on every training file a config names.
"""

from __future__ import annotations

from pathlib import Path
from typing import Callable

from ..canonical import Canonicalizer, canonical_key
from ..errors import DevFenceError
from ..workspace import Workspace


class DevFence:
    def __init__(self, workspace: Workspace, canonicalizer: Canonicalizer | None = None):
        self.workspace = workspace
        self.canonicalizer = canonicalizer

    def require_dev(self, name: str, *, config_hash: str | None = None) -> list[dict]:
        """The ONLY way the training runner takes a dev set.

        Refuses: unregistered names, non-dev roles, content drift (sha),
        and dev rows overlapping registered test/sealed content.
        """
        try:
            entry = self.workspace.registry.get(name)
        except Exception as e:
            raise DevFenceError(
                f"no registered dev set named {name!r} ({e})",
                why="without a dev set, checkpoint selection has nothing legal "
                    "to select on — and 'just use the test set' is the exact "
                    "mistake this fence exists to stop",
                fix="carve one from the TRAIN side and register it in one "
                    "step: `nmt-forge split <corpus> --test 0 --dev <N> --seed "
                    "<S> --out data/split --register <prefix>` (MCP: "
                    "forge_split), or register a dev file you hold: "
                    "`nmt-forge registry add <name> <file> --role dev` (MCP: "
                    "forge_register_eval)",
            ) from e
        if entry["role"] != "dev":
            raise DevFenceError(
                f"{name!r} is registered as role={entry['role']!r}, not 'dev'",
                why="selecting checkpoints on a test/sealed set is adaptive "
                    "contamination: the test stops measuring generalization",
                fix="carve a group-disjoint dev slice from the TRAIN side "
                    "(`nmt-forge split <corpus> --test 0 --dev <N> --seed <S> "
                    "--out data/split --register <prefix>`; MCP: forge_split) "
                    "and point the config's dev set at <prefix>-dev",
            )
        rows = self.workspace.registry.open_eval(
            name, "dev-selection", config_hash=config_hash
        )
        self.check_rows(
            rows,
            source_field=entry["source_field"],
            target_field=entry["target_field"],
            _context=f"registered dev set {name!r}",
        )
        return rows

    def check_rows(
        self,
        rows: list[dict],
        *,
        source_field: str = "source",
        target_field: str | None = None,
        _context: str = "candidate dev rows",
    ) -> None:
        """Content check: rows must not overlap any registered test/sealed set."""
        if not rows:
            raise DevFenceError(
                f"{_context}: empty",
                why="an empty dev set silently disables early stopping and "
                    "checkpoint selection",
                fix="provide a non-empty group-disjoint dev carve",
            )
        if target_field is None:
            from ..canonical import detect_target_field

            target_field = detect_target_field(rows)
        eval_keys = self.workspace.registry.key_sets(
            roles=("test", "sealed"), canonicalizer=self.canonicalizer
        )
        if not eval_keys:
            return  # nothing registered to protect yet
        row_src = {canonical_key(str(r.get(source_field, "")), self.canonicalizer)
                   for r in rows}
        row_tgt = {canonical_key(str(r.get(target_field, "")), self.canonicalizer)
                   for r in rows}
        for name, ks in eval_keys.items():
            hit_src = row_src & ks["source"]
            hit_tgt = row_tgt & ks["target"]
            if hit_src or hit_tgt:
                raise DevFenceError(
                    f"{_context} overlaps registered {ks['role']} set {name!r}: "
                    f"{len(hit_src)} shared source keys, {len(hit_tgt)} shared "
                    "target keys",
                    why="checkpoint selection on rows the test set contains "
                        "(even paraphrased file-copies of it) lets the test "
                        "pick the model — the ledger's mistake #2",
                    fix="carve dev from the TRAIN side with group_split(); "
                        "verify with split_guard.verify_disjoint() if you "
                        "assembled the files by hand",
                )

    def training_overlap(self, dev_rows: list[dict], files, *,
                         source_field: str = "source",
                         target_field: str | None = None) -> dict[str, int]:
        """Per training file (in the order given): how many of its rows ARE
        rows of the dev set — the same canonical source or target. Files that
        do not exist are left out (the training-data check names them).
        Content-free: counts only."""
        from ..canonical import detect_target_field
        from ..registry import load_rows

        if target_field is None:
            target_field = detect_target_field(dev_rows)
        dev_src = {canonical_key(str(r.get(source_field, "")),
                                 self.canonicalizer) for r in dev_rows}
        dev_tgt = {canonical_key(str(r.get(target_field, "")),
                                 self.canonicalizer) for r in dev_rows}
        dev_src.discard("")
        dev_tgt.discard("")
        out: dict[str, int] = {}
        for f in files:
            if not Path(str(f)).is_file():
                continue
            rows = load_rows(f)
            try:
                tf = detect_target_field(rows)
            except KeyError:          # the mix reads row["target"] too
                tf = "target"
            out[str(f)] = sum(
                1 for r in rows
                if canonical_key(str(r.get("source", "")),
                                 self.canonicalizer) in dev_src
                or canonical_key(str(r.get(tf, "")),
                                 self.canonicalizer) in dev_tgt)
        return out

    def require_disjoint_training(
            self, dev_name: str, dev_rows: list[dict], files, *,
            source_field: str = "source", target_field: str | None = None,
            fix_for: Callable[[str], str] | None = None) -> dict[str, int]:
        """Refuse training files that hold rows of the dev set ``dev_name``
        (:meth:`training_overlap`). ``fix_for(file)`` names the exact fix for
        one file (``advisor.dev_overlap_fix``: re-run the twin-free audit, or
        train on the split's train side); the counts are returned when
        nothing overlaps."""
        overlap = self.training_overlap(dev_rows, files,
                                        source_field=source_field,
                                        target_field=target_field)
        hit = {f: n for f, n in overlap.items() if n}
        if not hit:
            return overlap
        fixes = [fix_for(f) if fix_for else
                 f"nmt-forge leak-audit {f} --clean-to <its own new file> "
                 "(it drops the dev set's rows) and point the config at it"
                 for f in hit]
        err = DevFenceError(
            f"{sum(hit.values())} training row(s) ARE rows of the registered "
            f"dev set {dev_name!r} (the same source or target): "
            + "; ".join(f"{f}: {n}" for f, n in hit.items()),
            why="checkpoint selection reads the dev set to pick the "
                "checkpoint; a model trained on those very rows is picked "
                "for recalling them, so the dev score stops measuring "
                "anything. A file written before the split (the twin-free "
                "corpus, say) still holds the rows the split later put in "
                "dev — the split keeps only its own train side disjoint",
            fix="; ".join(fixes),
        )
        # content-free counts for --json (the error document's `details`)
        err.details = {"dev_set": dev_name, "training_dev_overlap": overlap}
        err.overlap = overlap
        raise err
