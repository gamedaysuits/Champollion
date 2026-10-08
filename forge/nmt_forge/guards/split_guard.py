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
import math
import random
from collections import Counter
from collections.abc import Iterator
from dataclasses import dataclass, field
from pathlib import Path

from ..canonical import Canonicalizer, canonical_key, jaccard, similarity_units
from ..errors import SplitLeakageError, SplitSizeRefused

#: How far a carved side may exceed the rows asked for. Whole share-groups go
#: to one side (cutting a group re-opens the leak), so SOME overshoot is
#: inherent — up to (largest group - 1) rows. A side holding more than 1.5x its
#: request is no longer the split that was asked for: the extra rows come out
#: of training, and the side's composition is decided by one group. Beyond
#: this, split refuses and writes nothing.
SIDE_TOLERANCE = 1.5

#: Training must keep at least this share of the rows the request leaves it
#: (corpus - test - dev). Below it the carve starved the model, whatever the
#: carved sides look like.
TRAIN_KEEP_SHARE = 0.5

#: A share-group holding at least this share of the corpus is a CHAINED
#: carve: near-duplicate links are transitive (A~B and B~C put A and C in one
#: group even when A and C share little), and on a templated corpus they chain
#: most rows into one group — which ``--near-dupe`` can then only hand, whole,
#: to one side. The split output and the near-twin advice read this number.
CHAIN_SHARE = 0.5


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


def near_dupe_links(unitsets: list[frozenset[str]],
                    threshold: float) -> Iterator[tuple[int, int, float]]:
    """Every pair ``(i, j, jaccard)`` with ``i < j`` whose unit sets overlap
    at Jaccard ≥ ``threshold`` — EXACT (no pair is missed), found by prefix
    filtering (Chaudhuri et al. 2006; Bayardo et al. 2007, "Scaling up all
    pairs similarity search"): units are ordered rarest-first, and two sets
    with Jaccard ≥ t must share a unit among the first ``|x| - ceil(t|x|) + 1``
    units of each. A function word shared by every row ("the", "your") is
    then never a candidate key, so a templated corpus is not an all-pairs
    scan. The exact Jaccard is computed for every candidate."""
    freq = Counter(u for s in unitsets for u in s)
    index: dict[str, list[int]] = {}
    for i, units in enumerate(unitsets):
        if not units:
            continue
        ordered = sorted(units, key=lambda u: (freq[u], u))
        size = len(ordered)
        # overlap ≥ ceil(t·|x|); the epsilon keeps a float like 0.6×5 from
        # rounding the bound UP (a longer prefix is always safe)
        prefix = size - math.ceil(threshold * size - 1e-9) + 1
        candidates: set[int] = set()
        for u in ordered[:prefix]:
            seen = index.setdefault(u, [])
            candidates.update(seen)
            seen.append(i)
        for j in sorted(candidates):
            other = unitsets[j]
            small, big = sorted((len(units), len(other)))
            if small < threshold * big - 1e-9:      # length filter
                continue
            jac = jaccard(units, other)
            if jac >= threshold:
                yield j, i, jac


def share_groups(
    pairs: list[dict],
    *,
    source_field: str = "source",
    target_field: str = "target",
    canonicalizer: Canonicalizer | None = None,
    near_dupe_jaccard: float | None = None,
    max_group: int | None = None,
) -> tuple[list[list[int]], dict]:
    """The share-groups a carve allocates whole: row indices union-found over
    shared canonical source/target keys (never capped) and, with
    ``near_dupe_jaccard``, over side-matched near-duplicate links (source ~
    source, target ~ target). ``max_group`` cuts a near-duplicate link only
    while the merged group stays ≤ that many rows, strongest links first.

    Returns ``(groups, link_report)``: groups as sorted index lists, and
    ``{near_dupe_links, near_dupe_links_left_uncut}`` (None without the
    near-dupe lane) — an uncut link is a near-twin pair that may straddle
    sides."""
    n = len(pairs)
    parent = list(range(n))
    size = [1] * n

    def find(i: int) -> int:
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    def union(a: int, b: int) -> None:
        ra, rb = find(a), find(b)
        if ra == rb:
            return
        if size[ra] < size[rb]:
            ra, rb = rb, ra
        parent[rb] = ra
        size[ra] += size[rb]

    by_src: dict[str, list[int]] = {}
    by_tgt: dict[str, list[int]] = {}
    for i, row in enumerate(pairs):
        s_key, t_key = _keys(row, source_field, target_field, canonicalizer)
        by_src.setdefault(s_key, []).append(i)
        by_tgt.setdefault(t_key, []).append(i)
    for idxs in list(by_src.values()) + list(by_tgt.values()):
        for j in idxs[1:]:
            union(idxs[0], j)

    report: dict = {"near_dupe_links": None, "near_dupe_links_left_uncut": None}
    if near_dupe_jaccard is not None:
        links: dict[tuple[int, int], float] = {}
        for f in (source_field, target_field):
            unitsets = [similarity_units(canonical_key(str(row.get(f, "")),
                                                       canonicalizer))
                        for row in pairs]
            for i, j, jac in near_dupe_links(unitsets, near_dupe_jaccard):
                if max_group is None:
                    union(i, j)
                links[(i, j)] = max(jac, links.get((i, j), 0.0))
        if max_group is not None:
            for (i, j), _ in sorted(links.items(),
                                    key=lambda kv: (-kv[1], kv[0])):
                ra, rb = find(i), find(j)
                if ra != rb and size[ra] + size[rb] <= max_group:
                    union(i, j)
        report = {"near_dupe_links": len(links),
                  "near_dupe_links_left_uncut": sum(
                      1 for (i, j) in links if find(i) != find(j))}

    groups: dict[int, list[int]] = {}
    for i in range(n):
        groups.setdefault(find(i), []).append(i)
    return list(groups.values()), report


def group_size_report(groups: list[list[int]], rows: int) -> dict:
    """How the rows fall into share-groups: the ten largest sizes, the
    largest group's share of the corpus, singletons, and whether the carve
    is CHAINED (largest group ≥ :data:`CHAIN_SHARE` of the rows)."""
    largest = max((len(g) for g in groups), default=0)
    share = round(largest / rows, 4) if rows else 0.0
    return {
        "top_sizes": sorted((len(g) for g in groups), reverse=True)[:10],
        "largest_group": largest,
        "largest_group_fraction": share,
        "singletons": sum(1 for g in groups if len(g) == 1),
        "chained": share >= CHAIN_SHARE,
    }


def size_deviations(sizes: dict, requested: dict, rows: int, *,
                    tolerance: float = SIDE_TOLERANCE) -> list[dict]:
    """The sides of a carve that deviate GROSSLY from the request: a carved
    side holding more than ``tolerance`` × its request, or training keeping
    less than :data:`TRAIN_KEEP_SHARE` of the rows the request leaves it.
    Content-free ``[{side, requested, got, ...}]``; empty = within tolerance."""
    out = []
    for side in ("test", "dev"):
        want = int(requested.get(side) or 0)
        got = int(sizes.get(side) or 0)
        if want and got > tolerance * want:
            out.append({"side": side, "requested": want, "got": got,
                        "ratio": round(got / want, 2)})
    left = rows - int(requested.get("test") or 0) - int(requested.get("dev") or 0)
    got_train = int(sizes.get("train") or 0)
    if left > 0 and got_train < TRAIN_KEEP_SHARE * left:
        out.append({"side": "train", "requested": left, "got": got_train,
                    "ratio": round(got_train / left, 2)})
    return out


def suggested_max_group(requested: dict, tolerance: float = SIDE_TOLERANCE) -> int:
    """The largest ``--max-group`` that keeps every carved side within
    tolerance: a group of g rows overshoots by at most g - 1, so g - 1 ≤
    (tolerance - 1) × the smallest carved request."""
    carved = [int(v) for v in requested.values() if v]
    smallest = min(carved) if carved else 2
    return max(2, int((tolerance - 1) * smallest) + 1)


def size_refusal(deviations: list[dict], report: dict, *, rows: int,
                 near_dupe_jaccard: float | None, max_group: int | None,
                 requested: dict,
                 tolerance: float = SIDE_TOLERANCE) -> SplitSizeRefused:
    """The refusal for a carve whose sides deviate grossly from the request:
    the numbers, why whole groups made it happen (the chaining, when it is
    chaining), and every route that does work."""
    parts = []
    for d in deviations:
        if d["side"] == "train":
            parts.append(f"training keeps {d['got']} of the {d['requested']} "
                         "rows the request leaves it")
        else:
            parts.append(f"{d['side']}: asked for {d['requested']} rows, the "
                         f"carve put {d['got']} there ({d['ratio']:g}×)")
    largest = report["largest_group"]
    share = report["largest_group_fraction"]
    rows_total = rows
    if near_dupe_jaccard is not None:
        why = (f"whole share-groups go to one side (cutting one re-opens the "
               f"leak), and near-duplicate links chain: A~B and B~C put A and "
               f"C in one group even when A and C share little. With "
               f"--near-dupe {near_dupe_jaccard:g}"
               + (f" (groups capped at {max_group})" if max_group else "")
               + f", {largest} of the {rows_total} rows ({share:.0%}) form ONE "
               "group — on a templated corpus the templates chain into it — "
               "and the side that received it took all of it")
    else:
        why = (f"whole share-groups go to one side (cutting one re-opens the "
               f"leak), and shared keys chain: rows sharing a source or a "
               f"target are grouped, and A shares a target with B, B a source "
               f"with C… — {largest} of the {rows_total} rows ({share:.0%}) "
               "form ONE group, and the side that received it took all of it")
    why += (f". Tolerance: a carved side may hold up to {tolerance:g}× the "
            f"rows asked for, and training keeps at least "
            f"{TRAIN_KEEP_SHARE:.0%} of the rows the request leaves it")
    cap = suggested_max_group(requested, tolerance)
    routes = []
    if near_dupe_jaccard is not None:
        higher = min(0.9, round(near_dupe_jaccard + 0.2, 1))
        routes.append(
            f"a higher threshold links fewer rows — e.g. --near-dupe "
            f"{higher:g} (more template twins stay uncut; the split reports "
            "them)")
        if max_group is None or max_group > cap:
            routes.append(
                f"cap the groups — --near-dupe {near_dupe_jaccard:g} "
                f"--max-group {cap} (near-duplicate links beyond the cap stay "
                "uncut; the split counts them and its near-twin check reports "
                "what crosses sides)")
        routes.append(
            "carve on exact keys only (drop --near-dupe) and read the "
            "near-twin check the split prints")
    routes += [
        "if what you are after is a twin-free score on a FIXED, separate "
        "test set (registered with --role test): carve train/dev only "
        "(--test 0) and drop the training rows that are near-twins of it "
        "(`nmt-forge leak-audit <corpus> --clean-to <corpus.notwins.jsonl> "
        "--drop-test-twins`, then split the cleaned file) — no near-dupe "
        "carve needed",
        "write dev/test sentences independently of the training material "
        "(by someone who has not seen it) and register them "
        "(`nmt-forge registry add <name> <file> --role dev|test`)",
    ]
    return SplitSizeRefused(
        "split refused — nothing was written: the carve does not match the "
        "request (" + "; ".join(parts) + ")",
        why=why,
        fix=" | ".join(f"({k}) {r}" for k, r in enumerate(routes, 1)),
        deviations=deviations, group_size_report=report)


def near_dupe_chaining(rows: list[dict], *, threshold: float,
                       source_field: str = "source",
                       target_field: str = "target",
                       canonicalizer: Canonicalizer | None = None) -> dict:
    """Can ``split --near-dupe <threshold>`` hold out whole templates on
    these rows, or do the near-duplicate links chain most of them into one
    group? Content-free ``{checked, threshold, rows, groups, largest_group,
    largest_group_fraction, chained, message}`` — the near-twin advice reads
    it so it never recommends a carve that cannot work on this corpus."""
    if not rows:
        return {"checked": False, "threshold": threshold, "rows": 0,
                "chained": False, "message": "no rows to check"}
    groups, _ = share_groups(rows, source_field=source_field,
                             target_field=target_field,
                             canonicalizer=canonicalizer,
                             near_dupe_jaccard=threshold)
    rep = group_size_report(groups, len(rows))
    msg = (f"at --near-dupe {threshold:g} the near-duplicate links chain "
           f"{rep['largest_group']} of the {len(rows)} rows "
           f"({rep['largest_group_fraction']:.0%}) into ONE share-group"
           if rep["chained"] else
           f"at --near-dupe {threshold:g} the largest share-group is "
           f"{rep['largest_group']} of the {len(rows)} rows "
           f"({rep['largest_group_fraction']:.0%}) — whole templates can be "
           "held out")
    return {"checked": True, "threshold": threshold, "rows": len(rows),
            "groups": len(groups), "largest_group": rep["largest_group"],
            "largest_group_fraction": rep["largest_group_fraction"],
            "chained": rep["chained"], "message": msg}


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
    max_group: int | None = None,
    size_tolerance: float | None = SIDE_TOLERANCE,
) -> GroupSplit:
    """Carve ``pairs`` into group-disjoint train/dev/test.

    ``test_size``/``dev_size`` are minimum row counts; whole groups are
    allocated, so a side may overshoot by at most (largest group − 1) rows.
    The overshoot is recorded in the manifest — never silently trimmed,
    because trimming rows out of an allocated group re-opens the leak.

    ``test_size=0`` is the train/dev-only carve for a community that keeps
    its OWN test set (teacher-checked, private, sensitive) in a separate
    file: register that file as role=test, and forge's leak-audit and
    dev-fence keep train and dev away from it at run time. Screen the corpus
    against it BEFORE carving (``nmt-forge leak-audit corpus --clean-to``)
    so no dev row can share an answer with it.

    ``near_dupe_jaccard`` (e.g. 0.6) additionally unions rows whose source
    OR target similarity-units overlap at ≥ that Jaccard — the near-dupe-
    disjoint carve (crk finding, 2026-07-12: exact-key grouping left 37
    reworded train↔battery siblings). SMALL-CORPUS COLLAPSE RISK: near-dupe
    edges are transitive under union-find, and textbook drills chain
    ("this dress is black" ~ "this coat is black" ~ "this coat is white"…),
    so one giant group can swallow a register and starve a side. The
    manifest's ``group_size_report`` makes this visible, and the size check
    below refuses the carve when a side receives such a group.

    ``max_group`` caps the near-duplicate links: a link is cut only while
    the merged group stays ≤ ``max_group`` rows (strongest links first).
    Exact-key groups are never capped — a shared source or target across
    sides IS the leak. Links left uncut are counted in the manifest
    (``near_dupe_links_left_uncut``): those near-twins may straddle sides,
    and the split's own near-twin check reports them.

    ``size_tolerance`` (default :data:`SIDE_TOLERANCE`): refuse — raise
    :class:`SplitSizeRefused`, nothing returned — when a carved side holds
    more than ``size_tolerance`` × its request, or training keeps less than
    :data:`TRAIN_KEEP_SHARE` of the rows the request leaves it. ``None``
    returns the carve whatever its sizes (the manifest still records the
    deviation).
    """
    if test_size < 0 or dev_size < 0:
        raise SplitLeakageError(
            f"carve sizes must be ≥ 0 (test={test_size}, dev={dev_size})")
    if test_size == 0 and dev_size == 0:
        raise SplitLeakageError(
            "test_size and dev_size are both 0 — nothing to carve",
            why="training needs a dev side (checkpoint selection) and an "
                "honest result needs a test side",
            fix="pass --dev N (and --test M, or --test 0 when your test set "
                "is a separate, already-registered file)",
        )
    if test_size + dev_size >= len(pairs):
        raise SplitLeakageError(
            f"test_size+dev_size ({test_size + dev_size}) >= corpus size ({len(pairs)})",
            why="nothing would remain to train on",
            fix="lower the carve sizes or bring more data",
        )

    group_lists, link_report = share_groups(
        pairs, source_field=source_field, target_field=target_field,
        canonicalizer=canonicalizer, near_dupe_jaccard=near_dupe_jaccard,
        max_group=max_group)
    # sort for determinism BEFORE the seeded shuffle (each group is an
    # ascending index list; sorting makes the shuffle input independent of
    # union-find order)
    group_list = sorted(group_lists, key=lambda g: (len(g), g[0]))
    rng = random.Random(seed)
    rng.shuffle(group_list)

    test: list[dict] = []
    dev: list[dict] = []
    train: list[dict] = []
    largest = max(group_list, key=len)
    largest_side = "train"
    for g in group_list:
        rows = [pairs[i] for i in g]
        if len(test) < test_size:
            test.extend(rows)
            side = "test"
        elif len(dev) < dev_size:
            dev.extend(rows)
            side = "dev"
        else:
            train.extend(rows)
            side = "train"
        if g is largest:
            largest_side = side

    sizes = {"train": len(train), "dev": len(dev), "test": len(test)}
    requested = {"test": test_size, "dev": dev_size}
    report = group_size_report(group_list, len(pairs))
    report["largest_group_side"] = largest_side
    tolerance = size_tolerance or SIDE_TOLERANCE
    deviations = size_deviations(sizes, requested, len(pairs),
                                 tolerance=tolerance)
    if deviations and size_tolerance is not None:
        raise size_refusal(deviations, report, rows=len(pairs),
                           near_dupe_jaccard=near_dupe_jaccard,
                           max_group=max_group, requested=requested,
                           tolerance=tolerance)

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
        "test_side": ("carved from this corpus" if test_size else
                      "none (--test 0): the test set is a separate file — "
                      "register it with role=test; leak-audit and the "
                      "dev-fence keep train/dev away from it"),
        "near_dupe_jaccard": near_dupe_jaccard,
        "max_group": max_group,
        **link_report,
        "group_size_report": report,
        "size_check": {
            "tolerance": (f"a carved side may hold up to {tolerance:g}× "
                          "the rows asked for; training keeps at least "
                          f"{TRAIN_KEEP_SHARE:.0%} of the rows the request "
                          "leaves it"),
            "deviations": deviations,
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
                    fix="re-carve with `nmt-forge split <corpus> --test <M> "
                        "--dev <N> --seed <S> --out <dir>` (MCP: forge_split), "
                        "which allocates whole share-groups to one side. Do not "
                        "delete offending rows post-hoc — regroup and re-carve.",
                )


def side_text(rows: list[dict]) -> str:
    """The exact text :func:`write_split` writes for one side — so a caller
    can know a side's sha256 (what registering it would record) BEFORE
    anything is written."""
    return "\n".join(json.dumps(r, ensure_ascii=False) for r in rows) + "\n"


def write_split(split: GroupSplit, out_dir: str | Path) -> dict[str, Path]:
    """Write train/dev/test .jsonl + the manifest; returns the paths."""
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    paths: dict[str, Path] = {}
    for name, rows in split.sides().items():
        if not rows:
            continue
        p = out_dir / f"{name}.jsonl"
        p.write_text(side_text(rows), encoding="utf-8")
        paths[name] = p
    mp = out_dir / "split-manifest.json"
    mp.write_text(json.dumps(split.manifest, indent=2) + "\n", encoding="utf-8")
    paths["manifest"] = mp
    return paths
