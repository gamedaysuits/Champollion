"""split-guard — group-disjoint splitting; leakage impossible BY CONSTRUCTION.

The catalogued failure (mistake #1): a textbook maps many English drills to
one target ("Feed him" and "Feed her" both → ``asam``). A row-level random
split put one copy in training and its twin in test — the model had literally
seen 17 of 54 "test" answers, and those rows scored 83 chrF++ against 44 for
clean rows. Post-hoc filtering of a leaked split is NOT the fix (it silently
shrinks and biases the test set); regrouping and re-carving is.

The construction (extracted from crk-translate's v2 carve, 2026-07-12):
pairs sharing a canonical SOURCE key OR a canonical TARGET key are union-found
into one group; whole groups land on one side of the split. Verification runs
after every carve and hard-fails on any shared key — belt and braces.

Allocation order is test → dev → train, so the test set stays stable as dev
size changes (the dev carve comes out of the TRAIN side — checkpoint
selection must never see test; that is dev-fence's guard, #2).
"""

from __future__ import annotations

import json
import random
from dataclasses import dataclass, field
from pathlib import Path

from collections import Counter

from ..canonical import Canonicalizer, canonical_key, jaccard, similarity_units
from ..errors import SplitLeakageError


@dataclass
class GroupSplit:
    train: list[dict]
    dev: list[dict]
    test: list[dict]
    manifest: dict = field(default_factory=dict)

    def sides(self) -> dict[str, list[dict]]:
        return {"train": self.train, "dev": self.dev, "test": self.test}


def _keys(row: dict, source_field: str, target_field: str,
          canonicalizer: Canonicalizer | None) -> tuple[str, str]:
    return (
        canonical_key(str(row.get(source_field, "")), canonicalizer),
        canonical_key(str(row.get(target_field, "")), canonicalizer),
    )


def group_split(
    pairs: list[dict],
    *,
    test_size: int,
    dev_size: int = 0,
    seed: int,
    source_field: str = "source",
    target_field: str = "target",
    canonicalizer: Canonicalizer | None = None,
    near_dupe_jaccard: float | None = None,
) -> GroupSplit:
    """Carve ``pairs`` into group-disjoint train/dev/test.

    ``test_size``/``dev_size`` are minimum row counts; whole groups are
    allocated, so a side may overshoot by at most (largest group − 1) rows.
    The overshoot is recorded in the manifest — never silently trimmed,
    because trimming rows out of an allocated group re-opens the leak.

    ``near_dupe_jaccard`` (e.g. 0.6) additionally unions rows whose source
    OR target similarity-units overlap at ≥ that Jaccard — the near-dupe-
    disjoint carve (crk finding, 2026-07-12: exact-key grouping left 37
    reworded train↔battery siblings). SMALL-CORPUS COLLAPSE RISK: near-dupe
    edges are transitive under union-find, and textbook drills chain
    ("this dress is black" ~ "this coat is black" ~ "this coat is white"…),
    so one giant group can swallow a register and starve a side. The
    manifest's ``group_size_report`` makes this visible — read it after
    every near-dupe carve, and loosen the threshold (or carve exact-only)
    if the largest group dominates.
    """
    if test_size <= 0:
        raise SplitLeakageError(
            "test_size must be positive",
            why="a split with no test side cannot be verified honest",
            fix="pass test_size >= 1 (and dev_size >= 1 if you will train)",
        )
    if test_size + dev_size >= len(pairs):
        raise SplitLeakageError(
            f"test_size+dev_size ({test_size + dev_size}) >= corpus size ({len(pairs)})",
            why="nothing would remain to train on",
            fix="lower the carve sizes or bring more data",
        )

    # -- union-find over shared canonical source/target keys ------------------
    parent = list(range(len(pairs)))

    def find(i: int) -> int:
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    def union(a: int, b: int) -> None:
        ra, rb = find(a), find(b)
        if ra != rb:
            parent[rb] = ra

    by_src: dict[str, list[int]] = {}
    by_tgt: dict[str, list[int]] = {}
    for i, row in enumerate(pairs):
        s_key, t_key = _keys(row, source_field, target_field, canonicalizer)
        by_src.setdefault(s_key, []).append(i)
        by_tgt.setdefault(t_key, []).append(i)
    for idxs in list(by_src.values()) + list(by_tgt.values()):
        for j in idxs[1:]:
            union(idxs[0], j)

    if near_dupe_jaccard is not None:
        # side-matched near-dupe edges (source~source, target~target) via an
        # inverted unit index — the same candidate pruning leak-audit uses
        for f in (source_field, target_field):
            unitsets: list[frozenset[str]] = []
            unit_index: dict[str, set[int]] = {}
            for i, row in enumerate(pairs):
                key = canonical_key(str(row.get(f, "")), canonicalizer)
                units = similarity_units(key)
                unitsets.append(units)
                for u in units:
                    unit_index.setdefault(u, set()).add(i)
            for i, units in enumerate(unitsets):
                if not units:
                    continue
                counts = Counter()
                for u in units:
                    for j in unit_index[u]:
                        if j > i:
                            counts[j] += 1
                for j, shared in counts.items():
                    other = unitsets[j]
                    if shared / min(len(units), len(other)) < near_dupe_jaccard:
                        continue
                    if jaccard(units, other) >= near_dupe_jaccard:
                        union(i, j)

    groups: dict[int, list[int]] = {}
    for i in range(len(pairs)):
        groups.setdefault(find(i), []).append(i)
    # sort for determinism BEFORE the seeded shuffle (dict order is insertion
    # order, but sorting makes the shuffle input independent of that)
    group_list = sorted(groups.values(), key=lambda g: (len(g), g[0]))
    rng = random.Random(seed)
    rng.shuffle(group_list)

    test: list[dict] = []
    dev: list[dict] = []
    train: list[dict] = []
    for g in group_list:
        rows = [pairs[i] for i in g]
        if len(test) < test_size:
            test.extend(rows)
        elif len(dev) < dev_size:
            dev.extend(rows)
        else:
            train.extend(rows)

    split = GroupSplit(train=train, dev=dev, test=test)
    verify_disjoint(
        split.sides(),
        source_field=source_field,
        target_field=target_field,
        canonicalizer=canonicalizer,
    )
    split.manifest = {
        "guard": "split-guard",
        "rows": len(pairs),
        "groups": len(group_list),
        "largest_group": max(len(g) for g in group_list),
        "sizes": {"train": len(train), "dev": len(dev), "test": len(test)},
        "requested": {"test": test_size, "dev": dev_size},
        "overshoot": {
            "test": max(0, len(test) - test_size),
            "dev": max(0, len(dev) - dev_size),
        },
        "seed": seed,
        "near_dupe_jaccard": near_dupe_jaccard,
        "group_size_report": {
            "top_sizes": sorted((len(g) for g in group_list), reverse=True)[:10],
            "largest_group_fraction": round(
                max(len(g) for g in group_list) / len(pairs), 4),
            "singletons": sum(1 for g in group_list if len(g) == 1),
        },
        "key_params": {
            "source_field": source_field,
            "target_field": target_field,
            "canonicalizer": getattr(canonicalizer, "__name__", None)
            if canonicalizer else None,
        },
        "verified": "0 shared canonical source/target keys across sides",
    }
    return split


def verify_disjoint(
    sides: dict[str, list[dict]],
    *,
    source_field: str = "source",
    target_field: str = "target",
    canonicalizer: Canonicalizer | None = None,
) -> None:
    """Hard-fail if any two sides share a canonical source or target key.

    Public and standalone on purpose: run it on ANY existing split (yours,
    inherited, someone else's) before trusting numbers computed on it.
    """
    keysets: dict[str, tuple[set[str], set[str]]] = {}
    for name, rows in sides.items():
        srcs, tgts = set(), set()
        for row in rows:
            s_key, t_key = _keys(row, source_field, target_field, canonicalizer)
            if s_key:
                srcs.add(s_key)
            if t_key:
                tgts.add(t_key)
        keysets[name] = (srcs, tgts)

    names = [n for n in sides if sides[n]]
    for i, a in enumerate(names):
        for b in names[i + 1:]:
            shared_src = keysets[a][0] & keysets[b][0]
            shared_tgt = keysets[a][1] & keysets[b][1]
            if shared_src or shared_tgt:
                raise SplitLeakageError(
                    f"{len(shared_src)} shared canonical source keys and "
                    f"{len(shared_tgt)} shared target keys between "
                    f"{a!r} and {b!r}",
                    why="rows sharing a source or target across sides mean the "
                        "model has seen the eval answer; scores measure memory, "
                        "not translation (measured on crk: 83 vs 44 chrF++)",
                    fix="rebuild with nmt_forge.guards.split_guard.group_split(), "
                        "which allocates whole share-groups to one side. Do not "
                        "delete offending rows post-hoc — regroup and re-carve.",
                )


def write_split(split: GroupSplit, out_dir: str | Path) -> dict[str, Path]:
    """Write train/dev/test .jsonl + the manifest; returns the paths."""
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    paths: dict[str, Path] = {}
    for name, rows in split.sides().items():
        if not rows:
            continue
        p = out_dir / f"{name}.jsonl"
        p.write_text(
            "\n".join(json.dumps(r, ensure_ascii=False) for r in rows) + "\n",
            encoding="utf-8",
        )
        paths[name] = p
    mp = out_dir / "split-manifest.json"
    mp.write_text(json.dumps(split.manifest, indent=2) + "\n", encoding="utf-8")
    paths["manifest"] = mp
    return paths
