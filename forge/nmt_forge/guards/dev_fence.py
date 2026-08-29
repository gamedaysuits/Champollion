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
"""

from __future__ import annotations

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
                fix="carve one from the TRAIN side with group_split(dev_size=...) "
                    "and register it: workspace.registry.register(name, path, 'dev')",
            ) from e
        if entry["role"] != "dev":
            raise DevFenceError(
                f"{name!r} is registered as role={entry['role']!r}, not 'dev'",
                why="selecting checkpoints on a test/sealed set is adaptive "
                    "contamination: the test stops measuring generalization",
                fix="carve a group-disjoint dev slice from the TRAIN side "
                    "(group_split dev_size=...) and register it as role='dev'",
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
