#!/usr/bin/env python3
"""Reconstruct SIL comparative wordlist columns from Vision OCR bounding boxes.

The SIL Philippines unpublished-archive wordlists (OLAC `vw_*` items) are scanned
typewritten survey forms laid out in fixed columns — typically English gloss,
Tagalog, then the target language. Plain text extraction destroys that: reading
order emits an entire column as one run, so the gloss/target correspondence is
lost. This clusters observations by x-position back into columns, then pairs them
by y-position back into rows.

INPUT is the bbox TSV emitted by the Vision OCR helper:
    confidence <TAB> minX <TAB> maxX <TAB> yTop <TAB> text
(coordinates normalised 0..1, y measured from the page top)

OUTPUT NEVER GOES IN GIT. The source PDFs are third-party (SIL International /
SIL Philippines, CC BY-NC-SA on the unpublished-archive items) and live under the
gitignored local-assets/ fetch cache; a reconstructed wordlist is lexical corpus
content derived from them, so it inherits the same handling. Default output path
is under local-assets/ and scripts/quarantine_gate.sh check 4 backstops it.

Every row carries the OCR confidence of each cell. These are LOW-CONFIDENCE
CANDIDATES for a community workshop to confirm or reject — never a lexicon, and
never a source of clinical vocabulary. Field notation in these documents predates
the 2017 DepEd/SIL Ambala orthography (N for the velar nasal, + for the central
vowel), so forms need transliteration before they mean anything to a reader.
"""

import argparse
import collections
import csv
import pathlib
import statistics
import sys


def load(path):
    """Parse the bbox TSV into {page: [(conf, x0, x1, y, text), ...]}."""
    pages = collections.defaultdict(list)
    page = None
    for line in pathlib.Path(path).read_text(encoding="utf-8", errors="replace").splitlines():
        if line.startswith("### PAGE"):
            page = line.split()[-1]
            continue
        if not line.strip() or page is None:
            continue
        parts = line.split("\t")
        if len(parts) < 5:
            continue
        try:
            conf, x0, x1, y = (float(parts[0]), float(parts[1]),
                               float(parts[2]), float(parts[3]))
        except ValueError:
            continue
        pages[page].append((conf, x0, x1, y, parts[4]))
    return pages


def find_columns(obs, n_cols, min_gap=0.06):
    """1-D cluster of minX into n_cols column centres.

    Deliberately simple: these are typed forms with wide, consistent gutters, so
    a sorted-gap split is more predictable than k-means and cannot silently
    reorder columns. Returns centres sorted left to right, or None if the page
    does not actually have the expected column structure (cover pages, notes
    pages) — those must be skipped rather than force-fitted.
    """
    xs = sorted(o[1] for o in obs)
    if len(xs) < n_cols * 3:
        return None
    gaps = sorted(((xs[i + 1] - xs[i], i) for i in range(len(xs) - 1)), reverse=True)
    cuts = sorted(i for gap, i in gaps[: n_cols - 1] if gap >= min_gap)
    if len(cuts) != n_cols - 1:
        return None
    groups, start = [], 0
    for c in cuts + [len(xs) - 1]:
        groups.append(xs[start : c + 1])
        start = c + 1
    return [statistics.median(g) for g in groups if g]


def reconstruct(obs, centres, row_tol):
    """Assign each observation to its nearest column, then bucket into rows by y."""
    rows = collections.defaultdict(lambda: [None] * len(centres))
    for conf, x0, _x1, y, txt in obs:
        col = min(range(len(centres)), key=lambda i: abs(centres[i] - x0))
        key = round(y / row_tol)
        # keep the higher-confidence reading if two land in the same cell
        cur = rows[key][col]
        if cur is None or conf > cur[0]:
            rows[key][col] = (conf, txt)
    return [rows[k] for k in sorted(rows)]


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("bbox_tsv", help="bbox TSV from the Vision OCR helper")
    ap.add_argument("-o", "--out", required=True,
                    help="output CSV (MUST be under local-assets/ — see module docstring)")
    ap.add_argument("--columns", type=int, default=3)
    ap.add_argument("--labels", default="gloss,tagalog,target",
                    help="comma-separated column labels, left to right")
    ap.add_argument("--row-tol", type=float, default=0.012,
                    help="y-tolerance for grouping observations into one row")
    ap.add_argument("--min-conf", type=float, default=0.0,
                    help="drop rows where every cell is below this confidence")
    args = ap.parse_args()

    labels = [s.strip() for s in args.labels.split(",")]
    if len(labels) != args.columns:
        sys.exit(f"error: {len(labels)} labels for {args.columns} columns")

    out = pathlib.Path(args.out)
    if "local-assets" not in out.parts:
        sys.exit("refusing to write outside local-assets/: reconstructed wordlists are "
                 "corpus content derived from third-party sources and are never tracked")
    out.parent.mkdir(parents=True, exist_ok=True)

    pages = load(args.bbox_tsv)
    header = ["page", "row"]
    for l in labels:
        header += [l, f"{l}_conf"]

    written = skipped = 0
    with out.open("w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(header)
        for page in sorted(pages):
            obs = pages[page]
            centres = find_columns(obs, args.columns)
            if centres is None:
                skipped += 1
                continue
            for i, row in enumerate(reconstruct(obs, centres, args.row_tol)):
                cells = [c for c in row if c]
                if not cells or max(c[0] for c in cells) < args.min_conf:
                    continue
                rec = [page, i]
                for cell in row:
                    rec += [cell[1] if cell else "", f"{cell[0]:.2f}" if cell else ""]
                w.writerow(rec)
                written += 1

    print(f"pages parsed : {len(pages) - skipped}")
    print(f"pages skipped: {skipped} (no {args.columns}-column structure — cover/notes pages)")
    print(f"rows written : {written}")
    print(f"output       : {out}")
    print("\nCANDIDATES ONLY. Unverified OCR of a pre-orthography field transcription.")
    print("Not a lexicon. Not a source of clinical vocabulary. For workshop review.")


if __name__ == "__main__":
    main()
