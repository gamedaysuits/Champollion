#!/usr/bin/env python3
"""Import publicly reported MT scores from the Helsinki-NLP leaderboards.

Two upstream, machine-readable SQLite score databases (both maintained by the
OPUS-MT / Tatoeba Translation Challenge project — Jörg Tiedemann et al.,
Helsinki-NLP; CC-BY-SA-4.0):

  * OPUS-MT-leaderboard     — ~1,900 released OPUS-MT models
  * External-MT-leaderboard — ~215 external systems (NLLB-200, M2M-100, WMT
    winners, Mozilla translate models, other HF-published systems)

This importer extracts, for every (language pair, public test set, metric), the
BEST published score across BOTH leaderboards and writes a compact, commit-pinned
index:

    shared/catalogue/external-mt-index.json   (version 2)

This is the bulk "publicly reported results" registration tier — machine-derived,
verbatim upstream values, one lookup per pair — complementing the small curated
tier in shared/catalogue/external-results.json (rich, hand-verified headline
results). Tracked in the monorepo, deliberately NOT bundled into the npm package
(consumers: website/mesh build via generateCatalogueJson, harness tooling).

Honesty rules baked in:
  * Values are the leaderboards' published scores VERBATIM (chrF++ rescaled to
    the conventional 0-100). The best-per-pair *selection* is the Champollion
    derivation, so the index carries champollion-derived provenance naming the
    upstreams — never the reverse (docs/FACT_PROVENANCE_AUDIT.md doctrine).
  * Every test set here is public → contamination posture is recorded and every
    consumer must treat these as RELATIVE-ONLY signals, never absolute quality
    claims (same lane as the external-results manifest).
  * Non-numeric/empty upstream score rows are skipped and counted, never
    coerced to 0.
  * Which leaderboard a value came from is recoverable from the model id prefix
    (family_derivation in the output).

Usage:
    python3 arena/scripts/import_mt_leaderboards.py \\
        --opus-commit dcc11795b3653d36865af674ffa784808d721a12 \\
        --external-commit e770bb935e0afbcf006664c5339b358731a8aff1 \\
        [--db-dir ~/.mt-eval/mt-leaderboards] [--out shared/catalogue/external-mt-index.json]

The score DBs (~25-35 MB each) are cached in --db-dir and NEVER written into
the repository.
"""

from __future__ import annotations

import argparse
import datetime as _dt
import json
import sqlite3
import sys
import urllib.parse
import urllib.request
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent

RAW_URL = "https://raw.githubusercontent.com/Helsinki-NLP/{repo}/{commit}/scores/{db}"

# metric id (ours) -> (upstream db filename, conventional scale multiplier)
# chrF++ is stored 0-1 upstream; published convention is 0-100.
#
# COMET is DELIBERATELY NOT IMPORTED (investigated 2026-07-07): the upstream
# comet_scores.db rows do not record which COMET model scored them, and the
# value range (-2.4 .. +1.3) shows a mix of the old unbounded-era and the new
# 0-1 wmt22-era models. A best-per-pair max() across incomparable eras would
# be meaningless — fail-honest beats coverage. Revisit if upstream ever pins
# the COMET model per row.
METRIC_DBS = {
    "chrf_pp": ("chrf++_scores.db", 100.0),
    "bleu": ("bleu_scores.db", 1.0),
}

# Public test sets worth indexing (all pairs they cover). Everything here is
# public → relative-only. Keys are the upstream testset ids, verbatim.
TESTSETS = {
    "flores200-devtest": "HIGH — FLORES-200 devtest is the most broadly trained-on public suite; relative-only lane, never an absolute quality claim.",
    "ntrex128": "HIGH — public news test set (NTREX-128); relative-only lane.",
    "tatoeba-test-v2021-08-07": "MEDIUM-HIGH — public Tatoeba-derived test set (OPUS-MT models train on Tatoeba Challenge data); relative-only lane.",
    "tatoeba-test-v2021-03-30": "MEDIUM-HIGH — public Tatoeba-derived test set (earlier version); relative-only lane.",
    "tatoeba-test-v2020-07-28": "MEDIUM-HIGH — public Tatoeba-derived test set (earlier version); relative-only lane.",
    "tico19-test": "varies — TICO-19 public health test set; eligibility-gated per dataset in the curated manifest; relative-only here.",
}

# Model-id prefix -> provider family (documented in the output so consumers can
# roll up "who wins this pair" without string heuristics of their own). Longest
# prefix wins at read time.
FAMILY_DERIVATION = {
    "Tatoeba-MT-models/": "opus-mt",
    "OPUS-MT-models/": "opus-mt",
    "HPLT-MT-models/": "hplt",
    "huggingface/facebook/nllb-200": "nllb-200",
    "huggingface/facebook/m2m100": "m2m-100",
    "huggingface/facebook/": "meta-other",
    "huggingface/allenai/": "allenai-wmt",
    "huggingface/Helsinki-NLP/": "opus-mt",
    "mozilla/": "mozilla-translate",
    "huggingface/": "hf-other",
}


def fetch_db(repo: str, commit: str, db_name: str, db_dir: Path) -> Path:
    """Download (or reuse) one score DB, cached outside the repo."""
    db_dir.mkdir(parents=True, exist_ok=True)
    target = db_dir / f"{repo}-{commit[:12]}-{db_name}"
    if target.exists() and target.stat().st_size > 0:
        return target
    url = RAW_URL.format(repo=repo, commit=commit, db=urllib.parse.quote(db_name))
    print(f"  fetching {url} …")
    with urllib.request.urlopen(url, timeout=600) as resp:
        target.write_bytes(resp.read())
    return target


def best_scores(db_path: Path, scale: float) -> tuple[dict, int]:
    """Return {(langpair, testset): (model, value)} best rows + skipped count."""
    con = sqlite3.connect(db_path)
    cur = con.cursor()
    placeholders = ",".join("?" for _ in TESTSETS)
    skipped = cur.execute(
        f"SELECT COUNT(*) FROM scores WHERE testset IN ({placeholders}) "
        f"AND (score IS NULL OR TRIM(CAST(score AS TEXT)) = '')",
        list(TESTSETS),
    ).fetchone()[0]
    rows = cur.execute(
        f"""
        SELECT langpair, testset, model, MAX(CAST(score AS REAL)) AS best
        FROM scores
        WHERE testset IN ({placeholders})
          AND score IS NOT NULL AND TRIM(CAST(score AS TEXT)) != ''
        GROUP BY langpair, testset
        """,
        list(TESTSETS),
    ).fetchall()
    con.close()
    out = {}
    for langpair, testset, model, best in rows:
        if best is None:
            continue
        out[(langpair, testset)] = (model, round(best * scale, 1))
    return out, skipped


def merge_best(per_source: list[dict]) -> dict:
    """Union of {(pair, testset): (model, value)} keeping the max value."""
    merged: dict = {}
    for cells in per_source:
        for key, (model, value) in cells.items():
            if key not in merged or value > merged[key][1]:
                merged[key] = (model, value)
    return merged


def build_index(sources: list[dict], db_dir: Path) -> dict:
    per_metric: dict[str, dict] = {}
    skipped_total = 0
    for metric, (db_name, scale) in METRIC_DBS.items():
        collected = []
        for src in sources:
            db_path = fetch_db(src["repo"], src["commit"], db_name, db_dir)
            cells, skipped = best_scores(db_path, scale)
            skipped_total += skipped
            print(f"  {src['repo']}/{metric}: {len(cells)} best cells "
                  f"({skipped} non-numeric upstream rows skipped)")
            collected.append(cells)
        per_metric[metric] = merge_best(collected)
        print(f"  {metric}: {len(per_metric[metric])} union-best cells")

    # Model string table (dedup) — indices keep the pairs block compact.
    model_set = sorted({m for cells in per_metric.values() for m, _v in cells.values()})
    model_idx = {m: i for i, m in enumerate(model_set)}

    pairs: dict[str, dict] = {}
    for metric, cells in per_metric.items():
        for (langpair, testset), (model, value) in cells.items():
            pairs.setdefault(langpair, {}).setdefault(testset, {})[metric] = [
                model_idx[model], value,
            ]

    return {
        "_comment": (
            "MACHINE-DERIVED bulk index of publicly reported MT benchmark "
            "scores: best published score per (language pair, public test set, "
            "metric) across the Helsinki-NLP OPUS-MT-leaderboard (~1,900 OPUS-MT "
            "models) AND External-MT-leaderboard (NLLB-200, M2M-100, WMT "
            "winners, Mozilla, other published systems). Values are the "
            "leaderboards' published scores verbatim (chrF++ rescaled 0-100); "
            "the best-per-pair selection is champollion-derived. RELATIVE-ONLY "
            "lane: every test set here is public (contamination_posture below) "
            "— never cite these as absolute quality claims or let them rank "
            "against held-out-lane results. Which leaderboard a value came from "
            "is recoverable from the model-id prefix (family_derivation). "
            "Regenerate with arena/scripts/import_mt_leaderboards.py. The "
            "curated, hand-verified headline tier lives in external-results.json; "
            "this file is its exhaustive machine sibling. NOT bundled into the "
            "npm package."
        ),
        "version": 2,
        "provider": "mt-leaderboards",
        "sources": [
            {
                "name": f"Helsinki-NLP {src['repo']}",
                "repo": f"https://github.com/Helsinki-NLP/{src['repo']}",
                "commit": src["commit"],
                "retrieved": _dt.date.today().isoformat(),
                "license": "CC-BY-SA-4.0",
                "credit": (
                    "Jörg Tiedemann et al. — OPUS-MT / Tatoeba Translation "
                    "Challenge (Helsinki-NLP)."
                ),
                "score_db_url_template": RAW_URL.replace("{repo}", src["repo"]),
                "model_id_prefixes": src["prefixes"],
            }
            for src in sources
        ],
        "provenance": (
            "champollion-derived [derived from Helsinki-NLP/OPUS-MT-leaderboard "
            "+ Helsinki-NLP/External-MT-leaderboard] — best-per-pair selection; "
            "score values verbatim from upstream"
        ),
        "skipped_non_numeric_rows": skipped_total,
        "contamination_posture": dict(TESTSETS),
        "family_derivation": FAMILY_DERIVATION,
        "metrics": {
            "chrf_pp": {
                "display_name": "chrF++ (word_order=2)",
                "scale": "0-100",
                "direction": "higher",
                "note": "Upstream stores 0-1; rescaled ×100 to the published convention.",
            },
            "bleu": {
                "display_name": "BLEU",
                "scale": "0-100",
                "direction": "higher",
            },
        },
        "models": model_set,
        "pairs": {k: pairs[k] for k in sorted(pairs)},
    }


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--opus-commit", required=True,
                    help="OPUS-MT-leaderboard commit SHA to pin (provenance)")
    ap.add_argument("--external-commit", required=True,
                    help="External-MT-leaderboard commit SHA to pin (provenance)")
    ap.add_argument("--db-dir", default=str(Path.home() / ".mt-eval" / "mt-leaderboards"),
                    help="cache dir for the upstream score DBs (never the repo)")
    ap.add_argument("--out", default=str(REPO_ROOT / "shared" / "catalogue" / "external-mt-index.json"))
    args = ap.parse_args()

    sources = [
        {
            "repo": "OPUS-MT-leaderboard",
            "commit": args.opus_commit,
            "prefixes": ["Tatoeba-MT-models/", "OPUS-MT-models/", "HPLT-MT-models/"],
        },
        {
            "repo": "External-MT-leaderboard",
            "commit": args.external_commit,
            "prefixes": ["huggingface/", "mozilla/"],
        },
    ]

    out_path = Path(args.out)
    index = build_index(sources, Path(args.db_dir))

    n_pairs = len(index["pairs"])
    n_cells = sum(len(ts) for ts in index["pairs"].values())
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(index, ensure_ascii=False, separators=(",", ":")) + "\n")
    size_mb = out_path.stat().st_size / 1e6
    print(f"✅ {out_path} — {n_pairs} pairs, {n_cells} (pair, testset) cells, "
          f"{len(index['models'])} models, {size_mb:.2f} MB")
    return 0


if __name__ == "__main__":
    sys.exit(main())
