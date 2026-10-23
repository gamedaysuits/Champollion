#!/usr/bin/env python3
"""Build the corpus wish-list — the acquisition frontier the queue cannot rank.

Ninth principle (founder, 2026-08-27): the frontier of the map is corpus
acquisition, not just ranking. No ordering of existing queue items can reach
a language with no catalogued corpus — as of 2026-08-27 that is ~8.3k of the
index's 8,685 languages. This script publishes the ranked ask-list:

  every LIVING language with NO entry in the corpora registry, ranked by
  best cited speaker count DESCENDING — speaker count as the founder's
  proxy for "a community exists that could actually build a corpus" (a
  language with four remaining speakers is not an acquisition target; a
  million-speaker language with zero measurements is the mission's most
  reachable dark spot).

Every displayed value is a CITED claim read through the mandatory card
adapter (mt_eval_harness.language_cards — never bare JSON.parse): the
speaker count is the maximum cited claim WITH its source attributed; the
family is Glottolog's own claim; nothing is invented for languages whose
cards carry no parseable estimate (they list with speakers=null and rank
last). The ranking itself is a Champollion derivation and says so.

Output: cli/website/static/corpus-wishlist.json (published beside the
queue artifacts).

Usage:  python3 arena/scripts/build_corpus_wishlist.py
"""
from __future__ import annotations

import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

ARENA = Path(__file__).resolve().parent.parent
if str(ARENA) not in sys.path:
    sys.path.insert(0, str(ARENA))
from mt_eval_harness.language_cards import attributions, display  # noqa: E402

ROOT = ARENA.parent
CARDS_DIR = ROOT / "cli" / "shared" / "language-cards"
DATASETS_DIR = ARENA / "datasets"
COVERAGE = ROOT / "shared" / "catalogue" / "method-coverage.json"
OUT = ROOT / "cli" / "website" / "static" / "corpus-wishlist.json"

#: Number with optional magnitude suffix — the card schema blesses forms
#: like "~50M" and "20K-25K", and prose claims like "2.5 million".
_NUM = re.compile(
    r"(\d[\d,]*(?:\.\d+)?)\s*(million|billion|thousand|[MKB])?\b",
    re.IGNORECASE,
)
#: Parenthetical years ("(2020)") and bare census years must never be read
#: as speaker counts.
_PAREN = re.compile(r"\([^)]*\)")
_MULT = {"k": 1_000, "thousand": 1_000, "m": 1_000_000,
         "million": 1_000_000, "b": 1_000_000_000, "billion": 1_000_000_000}


def parse_speakers(value) -> int | None:
    """Best-effort numeric read of a cited speaker claim.

    Handles magnitude suffixes ("~50M" → 50,000,000; "2.5 million" →
    2,500,000), takes the upper bound of ranges ("10-99" → 99), strips
    parentheticals so census years never masquerade as counts, and rejects
    bare 4-digit year-like tokens. None when nothing numeric is claimed.
    """
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return int(value)
    if not isinstance(value, str):
        return None
    text = _PAREN.sub(" ", value)
    nums = []
    for m in _NUM.finditer(text):
        raw, suffix = m.group(1), (m.group(2) or "").lower()
        n = float(raw.replace(",", ""))
        if suffix:
            n *= _MULT[suffix]
        elif n != int(n):
            continue  # a bare decimal without a magnitude is not a count
        n = int(n)
        # A bare 1900-2099 token with no suffix and no thousands separator
        # is treated as a year, not a count ("census 2020"). The trade-off
        # is deliberate: a genuine claim of that size is normally formatted
        # with a separator ("1,950") and still parses; misreading census
        # years as speaker counts is the worse failure.
        if not suffix and "," not in raw and "." not in raw                 and 1900 <= n <= 2099:
            continue
        nums.append(n)
    return max(nums) if nums else None


def registry_languages() -> set[str]:
    """Every language with ANY catalogued corpus entry, across all split
    registry files (the widest reading — quarantined and catalogue-only
    entries count: a corpus exists, so acquisition is not the blocker)."""
    langs: set[str] = set()
    unreadable = 0
    paths = sorted(DATASETS_DIR.glob("registry-*.json"))
    canonical = DATASETS_DIR / "registry.json"
    if canonical.is_file():
        paths.append(canonical)
    for path in paths:
        try:
            doc = json.loads(path.read_text(encoding="utf-8"))
        except Exception as e:
            unreadable += 1
            print(f"  ⚠ unreadable registry shard skipped: {path.name} ({e})")
            continue
        for e in doc.get("datasets", []):
            lp = e.get("language_pair") or {}
            for side in (lp.get("source"), lp.get("target")):
                if side:
                    langs.add(str(side).strip().lower())
    return langs


def service_covered_languages() -> set[str]:
    try:
        cov = json.loads(COVERAGE.read_text(encoding="utf-8"))
    except Exception:
        return set()
    out: set[str] = set()
    methods = cov.get("methods") if isinstance(cov, dict) else None
    entries = methods.values() if isinstance(methods, dict) else (methods or [])
    for entry in entries:
        if not isinstance(entry, dict):
            continue
        for code in entry.get("iso6393") or []:
            out.add(str(code).strip().lower())
    return out


def best_speaker_claim(card: dict) -> tuple[int | None, str | None]:
    """(max cited count, its source) — a cited claim, never a synthesis."""
    best_n, best_src = None, None
    for claim in attributions(card.get("speakerEstimates")):
        n = parse_speakers(claim.get("value"))
        if n is not None and (best_n is None or n > best_n):
            best_n, best_src = n, claim.get("source")
    return best_n, best_src


def glottolog_family(card: dict) -> str | None:
    """Glottolog's OWN family claim, or None — never another source's
    (the docstring promise; family authority is Glottolog, lint rule R5)."""
    fam = (card.get("classification") or {}).get("family")
    for claim in attributions(fam):
        if str(claim.get("source", "")).lower().startswith("glottolog"):
            return claim.get("value")
    return None


def endangerment_claim(card: dict) -> dict | None:
    claims = attributions(card.get("endangerment"))
    for claim in claims:
        if str(claim.get("source", "")).lower().startswith("glottolog"):
            return {"value": claim.get("value"), "source": claim.get("source")}
    if claims:
        return {"value": claims[0].get("value"),
                "source": claims[0].get("source")}
    return None


def main() -> int:
    have_corpus = registry_languages()
    covered = service_covered_languages()

    rows = []
    n_locales = n_nonliving = n_macro = 0
    unreadable_cards = 0
    for path in sorted(CARDS_DIR.glob("*.json")):
        try:
            card = json.loads(path.read_text(encoding="utf-8"))
        except Exception as e:
            unreadable_cards += 1
            print(f"  ⚠ unreadable card skipped: {path.name} ({e})")
            continue
        # A locale card is a projection, not a language — excluded by its
        # locale block, never by code shape (CLAUDE.md invariant).
        if card.get("locale"):
            n_locales += 1
            continue
        code = (card.get("iso6393") or card.get("code") or path.stem)
        code = str(code).strip().lower()
        if code in have_corpus:
            continue
        # Living languages only: an extinct or historical language has no
        # community to build with — the founder's feasibility criterion.
        iso_type = card.get("isoLanguageType") or card.get("isoType")
        if iso_type and str(iso_type).strip().lower() not in ("living", "l"):
            n_nonliving += 1
            continue
        # Doctrine (Position 4 v2): individual codes only. A macrolanguage
        # is a label to resolve, not an acquisition target — its members
        # rank on their own rows.
        if str(card.get("isoScope") or "").strip().lower() == "macrolanguage":
            n_macro += 1
            continue
        speakers, spk_src = best_speaker_claim(card)
        rows.append({
            "code": code,
            "name": display(card.get("name")),
            "family": glottolog_family(card),
            "speakers": speakers,
            "speakers_source": spk_src,
            "speakers_agreement": (card.get("speakerEstimates") or {}).get(
                "agreement") if isinstance(
                card.get("speakerEstimates"), dict) else None,
            "endangerment": endangerment_claim(card),
            "reachable_by_any_mt_service": code in covered,
        })

    rows.sort(key=lambda r: (
        -(r["speakers"] if r["speakers"] is not None else -1), r["code"]))
    for rank, r in enumerate(rows, start=1):
        r["rank"] = rank

    doc = {
        "metadata": {
            "generated_at": datetime.now(timezone.utc).isoformat(
                timespec="seconds"),
            "what": (
                "Languages with NO corpus in the Champollion corpora "
                "registry, ranked by best cited speaker count descending — "
                "the acquisition frontier: no evaluation queue can reach a "
                "language until a corpus exists for it."
            ),
            "ranking_provenance": (
                "champollion-derived [rank order derived from the cited "
                "speaker claims listed per row; each speakers value is the "
                "maximum single cited claim, attributed to its source — "
                "sources may disagree; see the language card for all "
                "claims]"
            ),
            "living_only": True,
            "total": len(rows),
            "with_cited_speaker_count": sum(
                1 for r in rows if r["speakers"] is not None),
            "reachable_by_no_mt_service": sum(
                1 for r in rows if not r["reachable_by_any_mt_service"]),
            "excluded": {"locale_cards": n_locales,
                         "non_living": n_nonliving,
                         "macrolanguages": n_macro},
            "claims_caveat": (
                "speaker counts are cited claims reproduced verbatim from "
                "their sources — sources disagree and some upstream records "
                "carry known anomalies; the language card lists every claim "
                "attributed, and this list never corrects or arbitrates them"
            ),
        },
        "languages": rows,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(
        json.dumps(doc, ensure_ascii=False, separators=(",", ":")) + "\n",
        encoding="utf-8",
    )
    top = rows[:5]
    print(f"corpus wish-list: {len(rows)} languages -> {OUT} "
          f"({OUT.stat().st_size / 1e6:.2f} MB)")
    for r in top:
        print(f"  #{r['rank']} {r['code']} {r['name']} — "
              f"{r['speakers']:,} speakers [{r['speakers_source']}]"
              if r['speakers'] is not None else f"  #{r['rank']} {r['code']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
