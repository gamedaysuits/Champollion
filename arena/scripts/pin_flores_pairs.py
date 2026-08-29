#!/usr/bin/env python3
"""Pin per-pair built-corpus sha256 for the promoted FLORES+ subset.

The promoted FLORES+ pairs enter the runnable lane (segment=development) and so
must carry a non-null ``sha256`` — the hash of the deterministically built
corpus, the one ``corpus_fetch._verify_sha256`` checks at fetch time (the
sha-pin doctrine that gates the runnable lane). This one-shot tool builds every
ordered promoted pair from the gated HF flores_plus dataset (pinned to the
card's immutable ``revision``), hashes the built corpus, and writes the map back
into the card's ``promotedSubset.builtShas``. Then ``build_registry.py`` surfaces
each sha on the per-pair registry entry.

Mirrors the SMOL/WMT24++ pinning (``pin_smol_wmt24pp_pairs.py``).

Usage (needs HF_TOKEN for the gated dataset; the built corpora go to a temp dir,
never tracked):
    HF_TOKEN=hf_xxx python3 arena/scripts/pin_flores_pairs.py
    python3 arena/scripts/pin_flores_pairs.py --dry-run   # build + hash, don't write
"""

import hashlib
import json
import sys
import tempfile
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent
REPO_ROOT = SCRIPT_DIR.parent.parent
ARENA_DIR = REPO_ROOT / "arena"
CARD_PATH = REPO_ROOT / "cli" / "shared" / "corpora-cards" / "eval-flores-devtest-v1.json"

if str(ARENA_DIR) not in sys.path:
    sys.path.insert(0, str(ARENA_DIR))

from mt_eval_harness import corpus_fetch  # noqa: E402

DRY_RUN = "--dry-run" in sys.argv


def main() -> int:
    card = json.loads(CARD_PATH.read_text(encoding="utf-8"))
    promoted = card.get("promotedSubset") or {}
    langs = promoted.get("languages") or []
    if not langs:
        print("No promotedSubset.languages on the card — nothing to pin.")
        return 1

    revision = promoted.get("revision") or (card.get("download") or {}).get("revision")
    segment = card.get("pairGeneration", {}).get("segment", "devtest")
    token_env = (card.get("download") or {}).get("tokenEnv") or "HF_TOKEN"
    code = {p["iso"]: p.get("sourceCode", p["iso"]) for p in langs}
    isos = list(code)

    n_pairs = len(isos) * (len(isos) - 1)
    print(f"Pinning {n_pairs} ordered pairs across {len(isos)} languages "
          f"(revision {revision[:12] if revision else 'main'}, segment {segment}).")

    tmp = Path(tempfile.mkdtemp(prefix="flores-pin-"))
    built_shas: dict[str, str] = {}
    done = 0
    for iso_src in isos:
        for iso_tgt in isos:
            if iso_src == iso_tgt:
                continue
            slug = f"{iso_src}-{iso_tgt}"
            entry = {
                "id": f"eval-flores-devtest-v1-{slug}",
                "language_pair": {"source": iso_src, "target": iso_tgt},
                "source_codes": {"source": code[iso_src], "target": code[iso_tgt]},
                "source_export": {
                    "builder": "flores-parallel",
                    "segment": segment,
                    "revision": revision,
                    "token_env": token_env,
                },
            }
            dest = tmp / f"{slug}.json"
            corpus_fetch._build_flores_parallel(entry, dest, assume_yes=True)
            built_shas[slug] = hashlib.sha256(dest.read_bytes()).hexdigest()
            dest.unlink()  # don't accumulate corpus content on disk
            done += 1
            if done % 50 == 0 or done == n_pairs:
                print(f"  pinned {done}/{n_pairs}")

    print(f"Built + hashed {len(built_shas)} pairs.")
    if DRY_RUN:
        print("Dry run — not writing the card. fao-que sha:",
              built_shas.get("fao-que"))
        return 0

    # Targeted replacement of the empty placeholder so the card's hand
    # formatting (inline `languages`, etc.) is preserved — only builtShas grows.
    text = CARD_PATH.read_text(encoding="utf-8")
    block_lines = ["    \"builtShas\": {"]
    items = sorted(built_shas.items())
    for i, (slug, sha) in enumerate(items):
        comma = "," if i < len(items) - 1 else ""
        block_lines.append(f"      \"{slug}\": \"{sha}\"{comma}")
    block_lines.append("    }")
    block = "\n".join(block_lines)

    if "\"builtShas\": {}" in text:
        text = text.replace("    \"builtShas\": {}", block, 1)
    else:
        print("ERROR: could not find the `\"builtShas\": {}` placeholder to "
              "replace. Reset it to `{}` and re-run.")
        return 1
    # Validate the result parses and round-trips.
    reparsed = json.loads(text)
    assert reparsed["promotedSubset"]["builtShas"] == built_shas, "round-trip mismatch"
    CARD_PATH.write_text(text, encoding="utf-8")
    print(f"Wrote {len(built_shas)} built shas into {CARD_PATH.relative_to(REPO_ROOT)}.")
    print("fao-que sha:", built_shas.get("fao-que"))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
